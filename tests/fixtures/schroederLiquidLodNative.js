import { tagWebGpuBufferDevice } from '../../src/runtime/sph/sphGpuDeviceIdentity.js';
import * as ip from '../../src/runtime/sph/sphImplicitPressureGpu.js';
import {
  createSchroederSplitSpareLineageScan,
  encodeSchroederSplitSpareLineageScan
} from '../../src/runtime/sph/schroederSplitSpareLineageScanGpu.js';
import { createSchroederPhaseSlotMaterializer } from '../../src/runtime/sph/schroederPhaseSlotMaterializationGpu.js';
import {
  createSphExactMassInventoryWebGpu,
  acquireSphExactMassRead,
  releaseSphExactMassRead,
  releaseSphExactMassInventory
} from '../../src/runtime/sph/sphExactMassInventoryGpu.js';
import {
  SPH_EXACT_THERMAL_ENERGY_FORMAT as format,
  sphExactThermalEnergyRecordWords
} from '../../src/runtime/sph/sphExactThermalEnergyWgsl.js';
import { createSphExactMassWgsl } from '../../src/runtime/sph/sphExactMassWgsl.js';
import { createSphExactLedgerWgsl } from '../../src/runtime/sph/sphExactLedgerWgsl.js';
import { encodeSphExactMass } from '../../ulg-gpu-abi/src/sphExactMassInventory.js';
import {
  mlsMpmP2gGridProjectionWgsl,
  schroederPhaseVolumeTargetAggregateWgsl,
  schroederPhaseVolumeMigrationWgsl
} from '../../ulg-gpu-abi/src/wgsl.js';
import {
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_MAGIC,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_VERSION
} from '../../ulg-gpu-abi/src/schroederSpatialMechanicsFieldView.js';

export async function runLiquidCavitationAndLodNative() {
  let adapter = null;
  for (let i = 0; i < 5 && !adapter; i += 1) {
    adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) await new Promise((r) => setTimeout(r, 500));
  }
  if (!adapter) return { status: 'unsupported' };
  const device = await adapter.requestDevice({
    requiredLimits: {
      maxStorageBuffersPerShaderStage: Math.min(12, adapter.limits.maxStorageBuffersPerShaderStage)
    }
  });
  const uncapturedErrors = [];
  device.addEventListener('uncapturederror', (e) => uncapturedErrors.push(e.error?.message || String(e.error)));
  device.pushErrorScope('validation');

  const owned = [];
  const stages = [];
  const committed = [];
  const reads = [];
  const families = [];
  const storage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST;
  const make = (data, usage = storage) => {
    const b = tagWebGpuBufferDevice(
      device.createBuffer({ size: typeof data === 'number' ? data : data.byteLength, usage }),
      device
    );
    owned.push(b);
    if (typeof data !== 'number') device.queue.writeBuffer(b, 0, data);
    return b;
  };

  try {
    // --- PART 1: Verify compiled production WGSL cavitation behavior on GPU ---
    const compileCheck = async (label, code) => {
      const info = await device.createShaderModule({ label, code }).getCompilationInfo();
      return info.messages.filter((m) => m.type === 'error').map((m) => `${label}:${m.lineNum}: ${m.message}`);
    };
    const compileErrors = [
      ...(await compileCheck('p2g', mlsMpmP2gGridProjectionWgsl)),
      ...(await compileCheck('pvta', schroederPhaseVolumeTargetAggregateWgsl)),
      ...(await compileCheck('pvm', schroederPhaseVolumeMigrationWgsl)),
      ...(await ip.sphImplicitPressureCompilationErrors(device))
    ];

    const runImplicitCase = async (volumeRatioJ) => {
      const h = 0.1, shift = 2, box = [0.7, 0.7, 0.7];
      const dims = box.map((b) => Math.round(b / h) + 5);
      const gridSpec = { gridSpacingM: h, boxDimsM: box, shift, gridDims: dims, gridNodeCount: dims[0] * dims[1] * dims[2] };
      const spacing = h / 2, rho0 = 1000, c = 50, dt = 0.008;
      const positions = [];
      for (let x = 0.2 + spacing / 2; x < 0.5; x += spacing)
        for (let y = 0.2 + spacing / 2; y < 0.5; y += spacing)
          for (let z = 0.2 + spacing / 2; z < 0.5; z += spacing) positions.push([x, y, z]);
      const n = positions.length, vol = spacing ** 3, mass = rho0 * vol;
      const state = new Float32Array(n * 8), thermo = new Float32Array(n * 12), mech = new Float32Array(n * 32);
      positions.forEach((p, i) => {
        state.set([...p, mass], i * 8);
        thermo[i * 12 + 3] = rho0;
        mech.set([0, 0, volumeRatioJ, vol], i * 32 + 16);
        mech.set([0, c, 1, 0], i * 32 + 24);
      });
      const weights = (fx) => [0.5 * (1.5 - fx) ** 2, 0.75 - (fx - 1) ** 2, 0.5 * (fx - 0.5) ** 2];
      const index = (i, j, k) => ((i + shift) * dims[1] + (j + shift)) * dims[2] + (k + shift);
      const nodeMass = new Float64Array(gridSpec.gridNodeCount);
      const stencil = (p, visit) => {
        const g = p.map((v) => v / h), b = g.map((v) => Math.floor(v - 0.5));
        const w = g.map((v, a) => weights(v - b[a]));
        for (let a = 0; a < 3; a += 1) for (let bb = 0; bb < 3; bb += 1) for (let cc = 0; cc < 3; cc += 1) {
          const node = [b[0] + a, b[1] + bb, b[2] + cc];
          visit(index(...node), w[0][a] * w[1][bb] * w[2][cc], node.map((v, d) => (v - g[d]) * h));
        }
      };
      positions.forEach((p) => stencil(p, (idx, w) => { nodeMass[idx] += w * mass; }));
      const grid = new Float32Array(gridSpec.gridNodeCount * 8);
      for (let i = -shift; i < dims[0] - shift; i += 1) for (let j = -shift; j < dims[1] - shift; j += 1)
        for (let k = -shift; k < dims[2] - shift; k += 1) {
          const idx = index(i, j, k), pos = [i * h, j * h, k * h];
          const vel = pos.map((v) => -(v - 0.35));
          if (nodeMass[idx] > 0) grid.set([nodeMass[idx], ...vel], idx * 8);
          grid.set([...pos, nodeMass[idx] > 0 ? 1 : 0], idx * 8 + 4);
        }
      const bState = make(state), bThermo = make(thermo), bMech = make(mech), bGrid = make(grid);
      const read = make(grid.byteLength, GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST);
      const enc = device.createCommandEncoder();
      ip.encodeSphImplicitPressureSolve(device, enc, {
        options: ip.normalizeSphImplicitPressureOptions({ iterations: 20, cflSafety: 4 }),
        stateBuffer: bState, thermoBuffer: bThermo, mechanicsBuffer: bMech,
        gridBuffer: bGrid, gridSpec, particleCount: n, dt
      });
      enc.copyBufferToBuffer(bGrid, 0, read, 0, grid.byteLength);
      device.queue.submit([enc.finish()]);
      await read.mapAsync(GPUMapMode.READ);
      const out = new Float32Array(read.getMappedRange().slice(0));
      read.unmap();
      let maxDelta = 0;
      for (let i = 0; i < gridSpec.gridNodeCount; i += 1) {
        for (let d = 1; d < 4; d += 1) maxDelta = Math.max(maxDelta, Math.abs(out[i * 8 + d] - grid[i * 8 + d]));
      }
      return { volumeRatioJ, maxDelta };
    };
    const cavitationExpanded = await runImplicitCase(1.15);
    const cavitationAtRest = await runImplicitCase(1.0);
    const cavitationCompressed = await runImplicitCase(0.96);

    // --- PART 2: Liquid 1->8 split + 8->1 bulk coarsen + exact 2^-149 integer ledgers + translation invariance ---
    const capacity = 9;
    const count = capacity * 4;
    const words = format.wordCount;
    const arithmetic = createSphExactMassWgsl(format) + createSphExactLedgerWgsl(format);
    const table = {
      segments: new Float32Array([
        7, 4, 1, 1, -5000, 0, 100, 273, 1, 1, 1, 0,
        7, 4, 2, 2, 0, 20000, 273, 373, 1, 1, 1, 0,
        7, 4, 3, 3, 20000, 60000, 373, 1373, 1, 1, 1, 0
      ])
    };
    const makeAssignment = (src, action, rank, n, group = 2) => {
      const a = new Float32Array(32);
      a[0] = src; a[3] = 9; a[6] = 1; a[8] = action;
      a[9] = rank; a[10] = n; a[11] = action === 7 ? src : -1; a[12] = action === 7 ? 1 : 0; a[20] = group;
      return a;
    };
    const dispatch = (encoder, code, buffers) => {
      const p = device.createComputePipeline({
        layout: 'auto',
        compute: { entryPoint: 'main', module: device.createShaderModule({ code }) }
      });
      const g = device.createBindGroup({
        layout: p.getBindGroupLayout(0),
        entries: buffers.map((buffer, binding) => ({ binding, resource: { buffer } }))
      });
      const pass = encoder.beginComputePass();
      pass.setPipeline(p); pass.setBindGroup(0, g); pass.dispatchWorkgroups(1); pass.end();
    };

    const runLiquidLodCycle = async (originShift) => {
      const state = new Float32Array(count * 8);
      const thermo = new Float32Array(count * 12);
      const mechanics = new Float32Array(count * 32);
      const massWords = new Uint32Array(count * words);
      for (let i = 0; i < count; i += 1) {
        thermo.set([99, Math.floor(i / capacity) + 1, 300, 1000], i * 12);
        thermo[i * 12 + 10] = 254;
        mechanics[i * 32] = mechanics[i * 32 + 4] = mechanics[i * 32 + 8] = 1;
        massWords.set(encodeSphExactMass(0, format), i * words);
      }
      const liquidRow = capacity + 0;
      const massKg = 8.0;
      const uJPerKg = 5400.0;
      const pos = [4.0 + originShift[0], 4.0 + originShift[1], 4.0 + originShift[2]];
      state.set([...pos, massKg, 0.25, -0.5, 0.125, uJPerKg], liquidRow * 8);
      thermo.set([7, 2, 300, 1000, 0, 1, 0, 0, 0.12, massKg * 100, 1, 0.2], liquidRow * 12);
      mechanics.set([1, 0, 0, 0, 1, 0, 0, 0, 1], liquidRow * 32);
      mechanics.set([1, 0.008, 0, 1, 300, 0, 0, 150, 1, 1, 101325, 0, 0, massKg], liquidRow * 32 + 18);
      massWords.set(encodeSphExactMass(massKg, format), liquidRow * words);
      massWords[liquidRow * words] = 1;

      const gasRow = 2 * capacity + 1;
      state.set([pos[0] + 0.5, pos[1], pos[2], 2.0, 0, 0, 0, 30000], gasRow * 8);
      thermo.set([7, 3, 623, 1.0, 0, 0, 1, 0, 0.2, 200, 1, 0.3], gasRow * 12);
      mechanics.set([1, 0, 0, 0, 1, 0, 0, 0, 1], gasRow * 32);
      mechanics.set([1, 2.0, 0, 1, 623, 0, 0, 300, 2, 1, 101325, 0, 0, 2.0], gasRow * 32 + 18);
      massWords.set(encodeSphExactMass(2.0, format), gasRow * words);

      const family = createSphExactMassInventoryWebGpu({
        device, format, massWords,
        provenance: { kind: 'initial-conditions', reference: 'liquid-lod-1to8-8to1' }
      });
      families.push(family);
      const massRead = acquireSphExactMassRead({ family, device });
      reads.push(massRead);
      const energyBuffer = make(sphExactThermalEnergyRecordWords(count) * 4);
      const bState = make(state);
      const bThermo = make(thermo);
      const bMech = make(mechanics);

      const seedEnc = device.createCommandEncoder();
      dispatch(seedEnc, `${arithmetic}
        @group(0) @binding(0) var<storage,read> st:array<vec4<f32>>;
        @group(0) @binding(1) var<storage,read_write> en:array<u32>;
        @compute @workgroup_size(1) fn main(){
          for(var i=0u;i<${count}u;i++){
            var u=el_from_f32_bits(bitcast<u32>(st[2u*i].w*st[2u*i+1u].w)).value;
            var s=ExactMass();
            if(st[2u*i].w>0.0){s=el_from_f32_bits(bitcast<u32>(-2.0)).value;}
            if(i==${liquidRow}u){var q:ExactMass;q.words[0]=5u;u=el_add(u,q).value;s=el_add(s,q).value;}
            for(var w=0u;w<EM_WORDS;w++){en[i*EM_WORDS+w]=u.words[w];en[(${count}u+i)*EM_WORDS+w]=s.words[w];}
          }
        }`, [bState, energyBuffer]);
      device.queue.submit([seedEnc.finish()]);

      const runStage = (input, rows) => {
        const packed = new Float32Array(rows.length * 32);
        rows.forEach((r, idx) => packed.set(r, idx * 32));
        const scan = createSchroederSplitSpareLineageScan(device, { spareCount: 7 });
        owned.push(scan.localPrefixBuffer, scan.groupOffsetsBuffer, scan.spareLineagesBuffer, scan.freeListBuffer, scan.paramsBuffer);
        const stage = createSchroederPhaseSlotMaterializer(device, {
          lineageCapacity: capacity, firstSpareLineage: 2, spareCount: 7,
          assignmentRowCount: rows.length, thermalMaterialTable: table,
          boxDimsM: [20, 20, 20], admissionApproved: true,
          exactLedger: { massRead: input.mass, energy: input.energy }
        });
        stages.push(stage);
        const enc = device.createCommandEncoder();
        encodeSchroederSplitSpareLineageScan(device, enc, {
          scan, stateBuffer: input.s, lineageCapacity: capacity, firstSpareLineage: 2,
          exactLedger: { massRead: input.mass, energy: input.energy }
        });
        stage.encode(enc, {
          sourceStateBuffer: input.s, sourceThermoBuffer: input.t, sourceMechanicsBuffer: input.m,
          slotAssignmentBuffer: make(packed), spareLineagesBuffer: scan.spareLineagesBuffer
        });
        device.queue.submit([enc.finish()]);
        const record = stage.ledgerStage.commit();
        committed.push([stage.ledgerStage, record]);
        return {
          s: stage.stateBuffer, t: stage.thermoBuffer, m: stage.mechanicsBuffer,
          mass: record.carrierMassRead, energy: record.exactEnergy, evidence: stage.evidenceBuffer
        };
      };

      const initial = { s: bState, t: bThermo, m: bMech, mass: massRead, energy: { energyBuffer, format, rowCount: count } };
      const afterSplit = runStage(initial, [makeAssignment(liquidRow, 5, 0, 7)]);

      const perturbEnc = device.createCommandEncoder();
      dispatch(perturbEnc, `
        @group(0) @binding(0) var<storage,read_write> st:array<vec4<f32>>;
        @compute @workgroup_size(1) fn main(){
          let rows = array<u32, 8>(9u, 11u, 12u, 13u, 14u, 15u, 16u, 17u);
          for (var k = 0u; k < 8u; k++) {
            let sign = select(-1.0, 1.0, (k & 1u) == 0u);
            st[rows[k] * 2u + 1u].x += 0.5 * sign;
          }
        }`, [afterSplit.s]);
      device.queue.submit([perturbEnc.finish()]);

      const mergeRows = [
        makeAssignment(liquidRow, 6, liquidRow, 1, 2),
        ...[2, 3, 4, 5, 6, 7, 8].map((lin) => makeAssignment(capacity + lin, 7, -1, 0, 2))
      ];
      const afterMerge = runStage(afterSplit, mergeRows);

      const afterCrossPhase = runStage(afterMerge, [
        makeAssignment(liquidRow, 6, liquidRow, 1, 3),
        makeAssignment(gasRow, 7, -1, 0, 3)
      ]);

      const scanAfterSplit = createSchroederSplitSpareLineageScan(device, { spareCount: 7 });
      const scanAfterMerge = createSchroederSplitSpareLineageScan(device, { spareCount: 7 });
      for (const sc of [scanAfterSplit, scanAfterMerge]) {
        owned.push(sc.localPrefixBuffer, sc.groupOffsetsBuffer, sc.spareLineagesBuffer, sc.freeListBuffer, sc.paramsBuffer);
      }

      const receipt = make(48);
      const verifyEnc = device.createCommandEncoder();
      encodeSchroederSplitSpareLineageScan(device, verifyEnc, {
        scan: scanAfterSplit, stateBuffer: afterSplit.s, lineageCapacity: capacity, firstSpareLineage: 2,
        exactLedger: { massRead: afterSplit.mass, energy: afterSplit.energy }
      });
      encodeSchroederSplitSpareLineageScan(device, verifyEnc, {
        scan: scanAfterMerge, stateBuffer: afterMerge.s, lineageCapacity: capacity, firstSpareLineage: 2,
        exactLedger: { massRead: afterMerge.mass, energy: afterMerge.energy }
      });
      dispatch(verifyEnc, `${arithmetic}
        @group(0) @binding(0) var<storage,read> init_m:array<u32>;
        @group(0) @binding(1) var<storage,read> init_e:array<u32>;
        @group(0) @binding(2) var<storage,read> split_m:array<u32>;
        @group(0) @binding(3) var<storage,read> split_e:array<u32>;
        @group(0) @binding(4) var<storage,read> merge_m:array<u32>;
        @group(0) @binding(5) var<storage,read> merge_e:array<u32>;
        @group(0) @binding(6) var<storage,read> split_s:array<vec4<f32>>;
        @group(0) @binding(7) var<storage,read> merge_s:array<vec4<f32>>;
        @group(0) @binding(8) var<storage,read> merge_t:array<vec4<f32>>;
        @group(0) @binding(9) var<storage,read> cross_ev:array<u32>;
        @group(0) @binding(10) var<storage,read> free_split:array<f32>;
        @group(0) @binding(11) var<storage,read_write> out:array<u32>;
        fn eq(a:ExactMass,b:ExactMass)->bool{for(var w=0u;w<EM_WORDS;w++){if(a.words[w]!=b.words[w]){return false;}}return true;}
        @compute @workgroup_size(1) fn main(){
          var m0:ExactMass; var m1:ExactMass; var m2:ExactMass;
          var u0:ExactMass; var u1:ExactMass; var u2:ExactMass;
          var s0:ExactMass; var s1:ExactMass; var s2:ExactMass;
          var split_liq=0u; var merge_liq=0u;
          for(var i=0u;i<${count}u;i++){
            var a0:ExactMass; var a1:ExactMass; var a2:ExactMass;
            var b0:ExactMass; var b1:ExactMass; var b2:ExactMass;
            var c0:ExactMass; var c1:ExactMass; var c2:ExactMass;
            for(var w=0u;w<EM_WORDS;w++){
              a0.words[w]=init_m[i*EM_WORDS+w]; a1.words[w]=split_m[i*EM_WORDS+w]; a2.words[w]=merge_m[i*EM_WORDS+w];
              b0.words[w]=init_e[i*EM_WORDS+w]; b1.words[w]=split_e[i*EM_WORDS+w]; b2.words[w]=merge_e[i*EM_WORDS+w];
              c0.words[w]=init_e[(${count}u+i)*EM_WORDS+w]; c1.words[w]=split_e[(${count}u+i)*EM_WORDS+w]; c2.words[w]=merge_e[(${count}u+i)*EM_WORDS+w];
            }
            m0=em_add(m0,a0).value; m1=em_add(m1,a1).value; m2=em_add(m2,a2).value;
            u0=el_add(u0,b0).value; u1=el_add(u1,b1).value; u2=el_add(u2,b2).value;
            s0=el_add(s0,c0).value; s1=el_add(s1,c1).value; s2=el_add(s2,c2).value;
            if(i>=${capacity}u && i<${2 * capacity}u){
              if(split_s[2u*i].w>0.0){split_liq++;}
              if(merge_s[2u*i].w>0.0){merge_liq++;}
            }
          }
          out[0] = select(0u, 1u, eq(m0, m1) && eq(m0, m2));
          out[1] = select(0u, 1u, eq(el_subtract(u0, s0).value, el_subtract(u1, s1).value)
            && eq(el_subtract(u0, s0).value, el_subtract(u2, s2).value));
          out[2] = split_liq;
          out[3] = merge_liq;
          out[4] = u32(free_split[2]);
          out[5] = cross_ev[0];
          out[6] = bitcast<u32>(merge_t[${liquidRow * 3}u].z);
          out[7] = bitcast<u32>(merge_s[${liquidRow * 2}u].x);
          out[8] = bitcast<u32>(merge_s[${liquidRow * 2 + 1}u].x);
        }`, [
        initial.mass.buffer, initial.energy.energyBuffer,
        afterSplit.mass.buffer, afterSplit.energy.energyBuffer,
        afterMerge.mass.buffer, afterMerge.energy.energyBuffer,
        afterSplit.s, afterMerge.s, afterMerge.t, afterCrossPhase.evidence,
        scanAfterSplit.freeListBuffer, receipt
      ]);
      const readReceipt = make(48, GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST);
      const readMergeFree = make(32, GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST);
      verifyEnc.copyBufferToBuffer(receipt, 0, readReceipt, 0, 48);
      verifyEnc.copyBufferToBuffer(scanAfterMerge.freeListBuffer, 0, readMergeFree, 0, 32);
      device.queue.submit([verifyEnc.finish()]);
      await readReceipt.mapAsync(GPUMapMode.READ);
      await readMergeFree.mapAsync(GPUMapMode.READ);
      const rw = new Uint32Array(readReceipt.getMappedRange().slice(0));
      const mf = new Float32Array(readMergeFree.getMappedRange().slice(0));
      readReceipt.unmap();
      readMergeFree.unmap();
      const f32 = (w) => new Float32Array(Uint32Array.of(w).buffer)[0];
      return {
        exactMassConserved: rw[0] === 1,
        exactEnergyConserved: rw[1] === 1,
        splitLiquidCount: rw[2],
        mergeLiquidCount: rw[3],
        freeSparesAfterSplit: rw[4],
        freeSparesAfterMerge: mf[2],
        crossPhaseRejectedCount: rw[5],
        postMergeTempK: f32(rw[6]),
        postMergeComX: f32(rw[7]),
        postMergeVelX: f32(rw[8])
      };
    };

    const centeredLod = await runLiquidLodCycle([0, 0, 0]);
    const shiftedLod = await runLiquidLodCycle([3.7, 2.4, 1.9]);

    // --- PART 3: Canonical SS mechanicsFieldView liquid interface detection ---
    const descOffset = 64, descStride = 32, keyOffset = 128, keyStride = 4;
    const fieldsU32 = new Uint32Array(256);
    fieldsU32[0] = SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_MAGIC;
    fieldsU32[1] = SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_VERSION;
    fieldsU32[2] = 3;
    fieldsU32[16] = 2;
    fieldsU32[19] = 8; fieldsU32[20] = 8; fieldsU32[21] = 8;
    fieldsU32[22] = 0;
    fieldsU32[23] = new Uint32Array(Float32Array.of(0.1).buffer)[0];
    fieldsU32[24] = descOffset; fieldsU32[25] = descStride;
    fieldsU32[26] = keyOffset; fieldsU32[27] = keyStride;
    fieldsU32[34] = 3;
    fieldsU32.set([10, 1, 26, 1], keyOffset + 0);
    fieldsU32.set([10, 2, 7, 2], keyOffset + 4);
    fieldsU32.set([20, 2, 7, 2], keyOffset + 8);
    fieldsU32.set([2, 7, 2, 1], descOffset);
    fieldsU32.fill(0xffffffff, descOffset + 4, descOffset + 31);
    fieldsU32[descOffset + 4] = 1;
    fieldsU32.set([2, 7, 2, 1], descOffset + descStride);
    fieldsU32.fill(0xffffffff, descOffset + descStride + 4, descOffset + descStride + 31);
    fieldsU32[descOffset + descStride + 4] = 2;

    const levelAssignments = new Float32Array(2 * 16);
    levelAssignments.set([0, 0.1, 0.25, 0.05, 0.05, 0.05, 50, 1, 2, 7, 0, 0.05, 0.2, 0.2, 0.2, 0], 0);
    levelAssignments.set([0, 0.1, 0.25, 0.05, 0.05, 0.05, 50, 1, 2, 7, 0, 0.05, 0.6, 0.6, 0.6, 0], 16);

    const aggNodes = new Float32Array(32);
    const migOut = make(2 * 32 * 4);
    const migParams = new ArrayBuffer(64);
    new Uint32Array(migParams, 0, 8).set([2, 0, 16, 32, 32, 0, 0, 3]);
    new Float32Array(migParams, 32, 8).set([0.1, 1.0, 1.0, 4.0, 1.0, 3.0, 1.0, 1e-4]);
    const migPipe = device.createComputePipeline({
      layout: 'auto',
      compute: { entryPoint: 'main', module: device.createShaderModule({ code: schroederPhaseVolumeMigrationWgsl }) }
    });
    const migBg = device.createBindGroup({
      layout: migPipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: make(levelAssignments) } },
        { binding: 1, resource: { buffer: make(aggNodes) } },
        { binding: 2, resource: { buffer: migOut } },
        { binding: 3, resource: { buffer: make(new Uint8Array(migParams), GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST) } },
        { binding: 4, resource: { buffer: make(new Uint32Array([2, 2])) } },
        { binding: 5, resource: { buffer: make(fieldsU32) } }
      ]
    });
    const migRead = make(2 * 32 * 4, GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST);
    const migEnc = device.createCommandEncoder();
    const migPass = migEnc.beginComputePass();
    migPass.setPipeline(migPipe); migPass.setBindGroup(0, migBg); migPass.dispatchWorkgroups(1); migPass.end();
    migEnc.copyBufferToBuffer(migOut, 0, migRead, 0, 2 * 32 * 4);
    device.queue.submit([migEnc.finish()]);
    await migRead.mapAsync(GPUMapMode.READ);
    const migRows = new Float32Array(migRead.getMappedRange().slice(0));
    migRead.unmap();

    const validationError = await device.popErrorScope();
    return {
      status: 'ok',
      compileErrors,
      cavitation: { cavitationExpanded, cavitationAtRest, cavitationCompressed },
      centeredLod,
      shiftedLod,
      interfaceDetection: {
        nearSolidRefineRequired: migRows[23],
        nearSolidReasonMask: migRows[31],
        bulkLiquidRefineRequired: migRows[32 + 23],
        bulkLiquidReasonMask: migRows[32 + 31]
      },
      validationError: validationError ? validationError.message : null,
      uncapturedErrors
    };
  } finally {
    await device.queue.onSubmittedWorkDone();
    for (const [stage, rec] of committed) stage.releaseUnadopted(rec);
    for (const st of stages) st.destroy();
    await Promise.all(reads.map((r) => releaseSphExactMassRead(r)));
    for (const f of families) releaseSphExactMassInventory(f);
    for (const b of owned) b.destroy();
    device.destroy();
  }
}
