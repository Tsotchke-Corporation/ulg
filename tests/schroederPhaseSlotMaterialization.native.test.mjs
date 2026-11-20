import assert from 'node:assert/strict';
import test from 'node:test';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_PHASE_SLOT_MATERIALIZATION === '1';
const BASE_URL = process.env.ULG_SPLIT_SPARE_SCAN_BASE_URL || 'https://127.0.0.1:5173/';

test('fixed phase-slot materialization conserves GPU state and rejects conflicting writes', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_PHASE_SLOT_MATERIALIZATION=1 for native WebGPU',
  timeout: 120_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true,
    args: ['--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer', '--enable-unsafe-webgpu',
      '--ignore-gpu-blocklist', '--enable-webgpu-developer-features'] });
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    const url = new URL('/__phase_slot_materialization_test__', BASE_URL).href;
    await page.route(url, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>GPU materialization gate</title>' }));
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const result = await page.evaluate(async () => {
      let adapter;
      for (let n = 0; n < 5 && !adapter; n++) {
        adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
        if (!adapter) await new Promise(resolve => setTimeout(resolve, 500));
      }
      if (!adapter) throw new Error('Native WebGPU adapter unavailable');
      const device = await adapter.requestDevice({ requiredLimits: { maxStorageBuffersPerShaderStage: 11 } });
      const owned = [], stages = [], errors = [];
      device.pushErrorScope('validation');
      device.addEventListener('uncapturederror', e => errors.push(e.error.message));
      const storage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST;
      const make = (data, usage = storage) => {
        const b = device.createBuffer({ size: typeof data === 'number' ? data : data.byteLength, usage });
        owned.push(b); if (typeof data !== 'number') device.queue.writeBuffer(b, 0, data); return b;
      };
      try {
        const m = await import('/src/runtime/sph/schroederPhaseSlotMaterializationGpu.js');
        const scanModule = await import('/src/runtime/sph/schroederSplitSpareLineageScanGpu.js');
        const hierarchy = await import('/src/runtime/sph/schroederHierarchyGpu.js');
        const abi = await import('/ulg-gpu-abi/src/wgsl.js');
        const info = await device.createShaderModule({ code: m.schroederPhaseSlotMaterializationWgsl }).getCompilationInfo();
        const bad = info.messages.filter(x => x.type === 'error');
        if (bad.length) throw new Error(bad.map(x => `${x.lineNum}: ${x.message}`).join('\n'));
        const verifier = device.createComputePipeline({ layout: 'auto', compute: {
          entryPoint: 'main', module: device.createShaderModule({ code: `
            @group(0) @binding(0) var<storage, read> before_s: array<vec4<f32>>;
            @group(0) @binding(1) var<storage, read> before_t: array<vec4<f32>>;
            @group(0) @binding(2) var<storage, read> before_m: array<vec4<f32>>;
            @group(0) @binding(3) var<storage, read> after_s: array<vec4<f32>>;
            @group(0) @binding(4) var<storage, read> after_t: array<vec4<f32>>;
            @group(0) @binding(5) var<storage, read> after_m: array<vec4<f32>>;
            @group(0) @binding(6) var<storage, read> evidence: array<u32>;
            @group(0) @binding(7) var<storage, read_write> receipt: array<u32>;
            @group(0) @binding(8) var<uniform> config: vec4<u32>;
            @group(0) @binding(9) var<storage, read> returned_pool: array<f32>;
            fn expect(a: f32, b: f32, tolerance: f32, code: u32) {
              if (!(abs(a - b) <= tolerance)) {
                receipt[0]++;
                if (receipt[2] == 0u) {
                  receipt[2] = config.x + 1u; receipt[3] = code;
                  receipt[4] = bitcast<u32>(a); receipt[5] = bitcast<u32>(b);
                }
              }
            }
            fn same(a: vec4<f32>, b: vec4<f32>, code: u32) {
              if (any(bitcast<vec4<u32>>(a) != bitcast<vec4<u32>>(b))) { expect(1.0, 0.0, 0.0, code); }
            }
            @compute @workgroup_size(1) fn main() {
              let mode = config.x; receipt[1]++;
              var old_mass = 0.0; var new_mass = 0.0;
              var old_energy = 0.0; var new_energy = 0.0;
              var old_p = vec3<f32>(0.0); var new_p = vec3<f32>(0.0);
              var old_x = vec3<f32>(0.0); var new_x = vec3<f32>(0.0);
              var old_v = 0.0; var new_v = 0.0; var old_n = 0.0; var new_n = 0.0;
              var old_rest = 0.0; var new_rest = 0.0;
              var old_ref = 0.0; var new_ref = 0.0;
              for (var i = 0u; i < 32u; i++) {
                let a = before_s[i * 2u]; let b = after_s[i * 2u];
                let av = before_s[i * 2u + 1u]; let bv = after_s[i * 2u + 1u];
                old_mass += a.w; new_mass += b.w;
                old_p += a.w * av.xyz; new_p += b.w * bv.xyz;
                old_x += a.w * a.xyz; new_x += b.w * b.xyz;
                old_energy += a.w * (av.w + 0.5 * dot(av.xyz, av.xyz));
                new_energy += b.w * (bv.w + 0.5 * dot(bv.xyz, bv.xyz));
                old_v += before_m[i * 8u + 4u].z * before_m[i * 8u + 4u].w;
                new_v += after_m[i * 8u + 4u].z * after_m[i * 8u + 4u].w;
                old_rest += before_m[i * 8u + 4u].w; new_rest += after_m[i * 8u + 4u].w;
                old_n += before_t[i * 3u + 2u].y; new_n += after_t[i * 3u + 2u].y;
                old_ref += before_m[i * 8u + 7u].w; new_ref += after_m[i * 8u + 7u].w;
                if ((mode >= 2u && mode <= 5u) || mode == 8u) {
                  same(a, b, 100u + i); same(av, bv, 140u + i);
                  for (var r = 0u; r < 3u; r++) { same(before_t[i * 3u + r], after_t[i * 3u + r], 200u + i); }
                  for (var r = 0u; r < 8u; r++) { same(before_m[i * 8u + r], after_m[i * 8u + r], 300u + i); }
                }
                if (b.w > 0.0) {
                  let f = after_m[i * 8u]; let g = after_m[i * 8u + 1u]; let h = after_m[i * 8u + 2u];
                  let det = f.x * (g.x * h.x - g.y * g.w) - f.y * (f.w * h.x - g.y * g.z)
                    + f.z * (f.w * g.w - g.x * g.z);
                  expect(det, after_m[i * 8u + 4u].z, 0.0002, 400u + i);
                }
              }
              expect(new_mass, old_mass, 1e-5, 1u);
              expect(new_energy, old_energy, 0.02, 2u);
              expect(new_v, old_v, 0.0002, 3u); expect(new_n, old_n, 1e-4, 4u);
              expect(new_ref, old_ref, 1e-5, 5u);
              expect(new_rest, old_rest, 1e-5, 6u);
              var expected_free = 4.0;
              if (mode == 0u || mode == 7u) { expected_free = 1.0; }
              if (mode == 3u) { expected_free = 3.0; }
              expect(returned_pool[2], expected_free, 0.0, 7u);
              for (var k = 0u; k < 3u; k++) {
                expect(new_p[k], old_p[k], 1e-5, 10u + k);
                expect(new_x[k], old_x[k], 1e-4, 20u + k);
              }
              if (mode == 0u) {
                expect(f32(evidence[1]), 1.0, 0.0, 30u); expect(f32(evidence[4]), 3.0, 0.0, 31u);
                for (var lineage = 4u; lineage < 7u; lineage++) {
                  expect(after_s[(16u + lineage) * 2u].w, 2.0, 0.0, 32u);
                  for (var lane = 0u; lane < 4u; lane++) {
                    let i = lane * 8u + lineage;
                    expect(after_t[i * 3u].x, 7.0, 0.0, 33u);
                    expect(after_t[i * 3u].y, f32(lane + 1u), 0.0, 34u);
                    if (lane != 2u) { expect(after_t[i * 3u + 2u].z, 254.0, 0.0, 35u); }
                  }
                }
                // Splitting one phase must leave its live companion intact.
                same(before_s[9u * 2u], after_s[9u * 2u], 36u);
                same(before_t[9u * 3u], after_t[9u * 3u], 37u);
              }
              if (mode == 1u) {
                expect(after_s[16u * 2u].w, 8.0, 0.0, 40u);
                expect(after_s[16u * 2u].x, 5.0, 0.0, 41u);
                expect(after_s[16u * 2u + 1u].x, -0.5, 0.0, 42u);
                expect(after_s[16u * 2u + 1u].w, 1750.375, 0.001, 43u);
                expect(after_t[16u * 3u].z, 175.0375, 0.0001, 44u);
                expect(after_s[17u * 2u].w, 0.0, 0.0, 45u);
                expect(f32(evidence[2]), 1.0, 0.0, 46u); expect(f32(evidence[3]), 1.0, 0.0, 47u);
              }
              if (mode == 6u) {
                expect(after_s[17u * 2u].w, 8.0, 0.0, 50u);
                expect(after_s[17u * 2u].x, 4.0, 1e-5, 51u);
                expect(after_s[17u * 2u + 1u].w, 1000.0, 0.001, 52u);
                expect(f32(evidence[3]), 3.0, 0.0, 53u);
              }
              if (mode == 7u) {
                expect(f32(evidence[0]), 0.0, 0.0, 60u);
                expect(f32(evidence[1]), 1.0, 0.0, 61u);
                expect(f32(evidence[2]), 1.0, 0.0, 62u);
                expect(f32(evidence[3]), 1.0, 0.0, 63u);
                expect(f32(evidence[4]), 3.0, 0.0, 64u);
                expect(after_s[16u * 2u].w, 8.0, 0.0, 65u);
                expect(after_s[17u * 2u].w, 0.0, 0.0, 66u);
                expect(after_s[18u * 2u].w, 2.0, 0.0, 67u);
                for (var i = 20u; i <= 22u; i++) { expect(after_s[i * 2u].w, 2.0, 0.0, 68u); }
              }
            }
          ` })
        } });
        const receipt = make(32);
        const encoder = device.createCommandEncoder();
        const thermalMaterialTable = { segments: new Float32Array([7, 5, 3, 3, 100, 10000, 10, 1000, 1, 1, 1, 0]) };
        const assignment = (source, action, start, count, group = 2) => {
          const r = new Float32Array(32);
          r[0] = source; r[3] = 9; r[6] = 1; r[8] = action; r[9] = start; r[10] = count;
          r[11] = action === 7 ? source : -1; r[12] = action === 7 ? 1 : 0; r[20] = group;
          return r;
        };
        const dispatch = (code, buffers) => {
          const p = device.createComputePipeline({ layout: 'auto', compute: {
            module: device.createShaderModule({ code }), entryPoint: 'main' } });
          const group = device.createBindGroup({ layout: p.getBindGroupLayout(0),
            entries: buffers.map((buffer, binding) => ({ binding, resource: { buffer } })) });
          const pass = encoder.beginComputePass(); pass.setPipeline(p); pass.setBindGroup(0, group);
          pass.dispatchWorkgroups(1); pass.end();
        };
        const run = (source, rows, admitted = true, productionAllocation = false, legacyCaloric = false) => {
          const table = { segments: new Float32Array(thermalMaterialTable.segments) };
          if (legacyCaloric) table.segments[1] = 1;
          const stage = m.createSchroederPhaseSlotMaterializer(device, { lineageCapacity: 8, firstSpareLineage: 4,
            spareCount: 4, assignmentRowCount: rows.length, thermalMaterialTable: table, boxDimsM: [10, 10, 10], admissionApproved: admitted });
          stages.push(stage);
          const packed = new Float32Array(rows.length * 32);
          rows.forEach((r, i) => packed.set(r, i * 32));
          let slotAssignmentBuffer = make(packed);
          let spareLineagesBuffer = make(new Uint32Array([4, 5, 6, 7]));
          if (productionAllocation) {
            const scan = scanModule.createSchroederSplitSpareLineageScan(device, { spareCount: 4 });
            owned.push(scan.localPrefixBuffer, scan.groupOffsetsBuffer, scan.spareLineagesBuffer,
              scan.freeListBuffer, scan.paramsBuffer);
            scanModule.encodeSchroederSplitSpareLineageScan(device, encoder, {
              scan, stateBuffer: source[0], lineageCapacity: 8, firstSpareLineage: 4
            });
            spareLineagesBuffer = scan.spareLineagesBuffer;
            const apply = new Float32Array(3 * 32);
            [[16, 2, -1, 2], [17, 2, -1, 2], [18, 4, 3, -1]].forEach(([i, status, delta, group], row) => {
              apply[row * 32] = i; apply[row * 32 + 3] = status; apply[row * 32 + 6] = 1;
              apply[row * 32 + 7] = delta; apply[row * 32 + 21] = group;
            });
            const allocated = make(apply.byteLength);
            const usage = GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST;
            dispatch(abi.schroederParticleStorageAllocationWgsl, [make(apply), allocated,
              make(hierarchy.createSchroederParticleStorageAllocationParamsArray({ applyRowCount: 3,
                admissionApproved: true, currentParticleCapacity: 32, requiredParticleCapacity: 32, preservePhaseSlots: true }), usage)]);
            slotAssignmentBuffer = make(apply.byteLength);
            dispatch(abi.schroederParticleStorageSlotAssignmentWgsl, [allocated, scan.freeListBuffer, slotAssignmentBuffer,
              make(hierarchy.createSchroederParticleStorageSlotAssignmentParamsArray({ allocationRowCount: 3,
                admissionApproved: true, preservePhaseSlots: true }), usage)]);
          }
          stage.encode(encoder, { sourceStateBuffer: source[0], sourceThermoBuffer: source[1], sourceMechanicsBuffer: source[2],
            slotAssignmentBuffer, spareLineagesBuffer });
          let reused = false;
          try { stage.encode(encoder, {}); reused = true; } catch (error) {
            if (!String(error).includes('single-use')) throw error;
          }
          if (reused) throw new Error('Candidate accepted a second encoding');
          return stage;
        };
        for (let mode = 0; mode < 9; mode++) {
          const s = new Float32Array(32 * 8), t = new Float32Array(32 * 12), mechanics = new Float32Array(32 * 32);
          // Every empty companion starts as a different material. A split
          // must change all four material tags while keeping the lane address.
          for (let i = 0; i < 32; i++) { t.set([99, Math.floor(i / 8) + 1, 100, 1], i * 12); t[i * 12 + 10] = 254; }
          const particle = (i, mass, position, velocity, u, stretch = 1, material = 7) => {
            s.set([...position, mass, ...velocity, u], i * 8);
            t.set([material, 3, u / 10, 1, 0, 0, 1, 0, 1, mass * 10, 1, 0.5], i * 12);
            mechanics.set([stretch, 0, 0, 0, stretch, 0, 0, 0, stretch], i * 32);
            mechanics.set([stretch ** 3, mass, 0, 1, 1, 0, 0, 1, 2, 1, 101325, 0, 0, mass * 2], i * 32 + 18);
          };
          let rows;
          if (mode === 1 || mode === 2 || mode === 7 || mode === 8) {
            particle(16, 2, [2, 4, 4], [1, 0, 0], 1000);
            particle(17, 6, [6, 4, 4], [-1, 0, 0], 2000, 2, mode === 2 ? 9 : 7);
            rows = [assignment(17, 7, -1, 0), assignment(16, 6, 16, 1)];
            if (mode === 7) {
              particle(18, 8, [4, 4, 4], [1, 2, 3], 1000);
              rows.push(assignment(18, 5, 0, 3));
            }
          } else {
            particle(17, 8, [4, 4, 4], [1, 2, 3], 1000);
            rows = [assignment(17, 5, 0, 3)];
          }
          if (mode === 3) { s[5 * 8 + 3] = 1; }
          if (mode === 0) {
            particle(9, 2, [4, 4, 4], [0, 0, 0], 1000);
            t[9 * 12 + 1] = 2; t.set([0, 1, 0, 0], 9 * 12 + 4);
          }
          if (mode === 4) rows.push(assignment(17, 5, 0, 3));
          const source = [make(s), make(t), make(mechanics)];
          let stage = run(source, rows, mode !== 5, mode === 7, mode === 8);
          if (mode === 6) {
            stage = run([stage.stateBuffer, stage.thermoBuffer, stage.mechanicsBuffer],
              [assignment(22, 7, -1, 0), assignment(17, 6, 17, 1), assignment(20, 7, -1, 0), assignment(21, 7, -1, 0)]);
          }
          const returnedScan = scanModule.createSchroederSplitSpareLineageScan(device, { spareCount: 4 });
          owned.push(returnedScan.localPrefixBuffer, returnedScan.groupOffsetsBuffer, returnedScan.spareLineagesBuffer,
            returnedScan.freeListBuffer, returnedScan.paramsBuffer);
          scanModule.encodeSchroederSplitSpareLineageScan(device, encoder, {
            scan: returnedScan, stateBuffer: stage.stateBuffer, lineageCapacity: 8, firstSpareLineage: 4
          });
          const buffers = [...source, stage.stateBuffer, stage.thermoBuffer, stage.mechanicsBuffer, stage.evidenceBuffer,
            receipt, make(new Uint32Array([mode, 0, 0, 0]), GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST), returnedScan.freeListBuffer];
          const group = device.createBindGroup({ layout: verifier.getBindGroupLayout(0),
            entries: buffers.map((buffer, binding) => ({ binding, resource: { buffer } })) });
          const pass = encoder.beginComputePass(); pass.setPipeline(verifier); pass.setBindGroup(0, group);
          pass.dispatchWorkgroups(1); pass.end();
        }
        const read = make(32, GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST);
        encoder.copyBufferToBuffer(receipt, 0, read, 0, 32); device.queue.submit([encoder.finish()]);
        await read.mapAsync(GPUMapMode.READ);
        const words = Array.from(new Uint32Array(read.getMappedRange()).slice()); read.unmap();
        const validation = await device.popErrorScope(); if (validation) errors.push(validation.message);
        return { receipt: words, errors };
      } finally {
        for (const stage of stages) stage.destroy();
        for (const b of owned) b.destroy();
        device.destroy();
      }
    });
    assert.deepEqual(result.errors, []);
    assert.equal(result.receipt[1], 9);
    assert.equal(result.receipt[0], 0, `GPU invariant failure: ${JSON.stringify(result.receipt)}`);
    console.log(JSON.stringify(result));
  } finally { await browser.close(); }
});
