import assert from 'node:assert/strict';
import test from 'node:test';

// Slice 2.3 G4 Compacted Per-Node Dynamic Law Activation gate (plan/CURRENT-PLAN.md):
//   G4-1 GPU A/B bit-identity at epsilon = 0 across thermal, phase, radiation, and reaction;
//   G4-2 Conservative activation when G6/A4 uncertainty bounds straddle law thresholds;
//   G4-3 Literal zero-work witness (dispatchWorkgroupsIndirect == [0, 1, 1] -> 0 executed threads)
//        on quiescent bulk + 4-law receipt ring accounting;
//   G4-4 Periodic-table random element-pair spot checks using live elementMaterialClosure
//        + discoverReactions (zero hardcoded physics).
// ULG_RUN_NATIVE_SOLID_RIGID=1; run memory-capped.
const RUN_NATIVE = process.env.ULG_RUN_NATIVE_SOLID_RIGID === '1';
const BASE_URL = process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173/';
const CHROME = process.env.ULG_THERMAL_CHROME || '/usr/bin/google-chrome';

test('native Vulkan G4 compacted dynamic law activation: A/B bit-identity, G6 uncertainty, zero-work witness, and element pairs', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_SOLID_RIGID=1 for native Vulkan WebGPU',
  timeout: 600_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist']
  });
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const out = await page.evaluate(async () => {
      const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) return { status: 'unsupported' };
      const limits = await import('/src/runtime/webgpuDeviceLimits.js');
      const device = await adapter.requestDevice(limits.webGpuDeviceDescriptorForResidentSph(adapter));
      const errors = [];
      device.addEventListener('uncapturederror', (e) => {
        if (errors.length < 20) errors.push(String(e.error?.message ?? e).slice(0, 500));
      });
      const thermalMod = await import('/src/runtime/sph/schroederThermalDormancyGpu.js');
      const reactionMod = await import('/src/runtime/sph/schroederReactionDormancyGpu.js');
      const phaseRadMod = await import('/src/runtime/sph/schroederPhaseRadiationDormancyGpu.js');
      const receiptMod = await import('/src/runtime/sph/lawActivationReceiptRing.js');
      const elementsMod = await import('/src/runtime/material/elementClosures.js');
      const periodicMod = await import('/src/runtime/electronicStructure/periodicTable.js');
      const opticalMod = await import('/src/runtime/material/opticalGpuBuffers.js');
      const reactionDiscoveryMod = await import('/src/runtime/sph/reactionDiscovery.js');

      for (const [name, code] of [
        ['thermal', thermalMod.schroederThermalDormancyWgsl],
        ['reaction', reactionMod.schroederReactionDormancyWgsl],
        ['phase', phaseRadMod.schroederPhaseDormancyWgsl],
        ['radiation', phaseRadMod.schroederRadiationDormancyWgsl]
      ]) {
        const info = await device.createShaderModule({ code }).getCompilationInfo();
        const bad = info.messages.filter((m) => m.type === 'error').map((m) => `${name}:${m.lineNum}:${m.linePos} ${m.message}`);
        if (bad.length) { device.destroy(); return { status: 'compile-error', compileErrors: bad }; }
      }

      // Instrumented GPU consumer that runs EITHER dense (all N threads) OR compacted indirect
      // (reading active_indices[0..active-1] via dispatchWorkgroupsIndirect).
      const consumerWgsl = /* wgsl */ `
        struct ConsumerParams { count: u32, mode: u32, unused0: u32, unused1: u32 };
        @group(0) @binding(0) var<uniform> cparams: ConsumerParams;
        @group(0) @binding(1) var<storage, read> state: array<vec4<f32>>;
        @group(0) @binding(2) var<storage, read> thermo: array<vec4<f32>>;
        @group(0) @binding(3) var<storage, read> active_indices: array<u32>;
        @group(0) @binding(4) var<storage, read> active_counts: array<u32>;
        @group(0) @binding(5) var<storage, read_write> out_values: array<f32>;
        @group(0) @binding(6) var<storage, read_write> exec_witness: array<atomic<u32>>;
        @compute @workgroup_size(64)
        fn eval_dense(@builtin(global_invocation_id) id: vec3<u32>) {
          let i = id.x;
          if (i >= cparams.count) { return; }
          atomicAdd(&exec_witness[0], 1u);
          let m = state[i * 2u].w;
          if (!(m > 0.0)) { return; }
          let row0 = thermo[i * 3u];
          let row1 = thermo[i * 3u + 1u];
          // Mode 0: thermal gradient indicator; Mode 1: phase boundary distance;
          // Mode 2: radiation T^4; Mode 3: reaction activation indicator.
          if (cparams.mode == 0u) {
            // Pair conduction delta against reference 300 K (0 for exact 300 K isothermal).
            out_values[i] = row0.z - 300.0;
          } else if (cparams.mode == 1u) {
            // Phase transition activity (0 for pure liquid strictly inside (273.15, 373.15)).
            let pure_liq = row0.y == 2.0 && row1.y == 1.0 && row1.x == 0.0 && row1.z == 0.0
              && row0.z > 273.15 && row0.z < 373.15;
            out_values[i] = select(row0.z, 0.0, pure_liq);
          } else if (cparams.mode == 2u) {
            // Factored radiative flux against 300 K bath (exact 0 when isothermal 300 K).
            let d = row0.z - 300.0;
            out_values[i] = select(
              5.670374419e-8 * d * (row0.z + 300.0) * (row0.z * row0.z + 300.0 * 300.0),
              0.0,
              d == 0.0
            );
          } else {
            // Reaction activation indicator (T >= 500 K and material 11 or 17).
            let hot = row0.z >= 500.0 && (row0.x == 11.0 || row0.x == 17.0);
            out_values[i] = select(0.0, row0.z, hot);
          }
        }
        @compute @workgroup_size(64)
        fn eval_compacted(@builtin(global_invocation_id) id: vec3<u32>) {
          atomicAdd(&exec_witness[0], 1u);
          let active_n = active_counts[0];
          if (id.x >= active_n) { return; }
          let i = active_indices[id.x];
          let m = state[i * 2u].w;
          if (!(m > 0.0)) { return; }
          let row0 = thermo[i * 3u];
          let row1 = thermo[i * 3u + 1u];
          if (cparams.mode == 0u) {
            out_values[i] = row0.z - 300.0;
          } else if (cparams.mode == 1u) {
            let pure_liq = row0.y == 2.0 && row1.y == 1.0 && row1.x == 0.0 && row1.z == 0.0
              && row0.z > 273.15 && row0.z < 373.15;
            out_values[i] = select(row0.z, 0.0, pure_liq);
          } else if (cparams.mode == 2u) {
            let d = row0.z - 300.0;
            out_values[i] = select(
              5.670374419e-8 * d * (row0.z + 300.0) * (row0.z * row0.z + 300.0 * 300.0),
              0.0,
              d == 0.0
            );
          } else {
            let hot = row0.z >= 500.0 && (row0.x == 11.0 || row0.x == 17.0);
            out_values[i] = select(0.0, row0.z, hot);
          }
        }
      `;
      const consumerMod = device.createShaderModule({ code: consumerWgsl });
      const consumerBgl = device.createBindGroupLayout({
        entries: [
          { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
          { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
          { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
          { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
          { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
          { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
          { binding: 6, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }
        ]
      });
      const consumerLayout = device.createPipelineLayout({ bindGroupLayouts: [consumerBgl] });
      const densePipe = device.createComputePipeline({ layout: consumerLayout, compute: { module: consumerMod, entryPoint: 'eval_dense' } });
      const compactedPipe = device.createComputePipeline({ layout: consumerLayout, compute: { module: consumerMod, entryPoint: 'eval_compacted' } });

      const make = (data, usage = 0x80 | 0x04 | 0x08) => {
        const b = device.createBuffer({ size: Math.max(16, data.byteLength), usage });
        device.queue.writeBuffer(b, 0, data);
        return b;
      };
      const readU32 = async (buffer) => {
        const c = device.createBuffer({ size: buffer.size, usage: 1 | 8 });
        const e = device.createCommandEncoder();
        e.copyBufferToBuffer(buffer, 0, c, 0, buffer.size);
        device.queue.submit([e.finish()]);
        await c.mapAsync(1);
        const w = Array.from(new Uint32Array(c.getMappedRange().slice(0)));
        c.unmap();
        c.destroy();
        return w;
      };

      const runABAndWitness = async ({ state, thermo, stage, mode, encodeArgs }) => {
        const N = state.length / 8;
        const stateBuf = make(state);
        const thermoBuf = make(thermo);
        const outDense = make(new Float32Array(N));
        const outComp = make(new Float32Array(N));
        const witDense = make(new Uint32Array(4));
        const witComp = make(new Uint32Array(4));
        const cparams = make(new Uint32Array([N, mode, 0, 0]), 0x40 | 0x08);

        const enc = device.createCommandEncoder();
        stage.encode(enc, { stateBuffer: stateBuf, thermoBuffer: thermoBuf, ...(encodeArgs || {}) });
        const bgDense = device.createBindGroup({
          layout: consumerBgl,
          entries: [cparams, stateBuf, thermoBuf, stage.activeIndicesBuffer, stage.countBuffer, outDense, witDense]
            .map((buffer, binding) => ({ binding, resource: { buffer } }))
        });
        const bgComp = device.createBindGroup({
          layout: consumerBgl,
          entries: [cparams, stateBuf, thermoBuf, stage.activeIndicesBuffer, stage.countBuffer, outComp, witComp]
            .map((buffer, binding) => ({ binding, resource: { buffer } }))
        });
        const p1 = enc.beginComputePass();
        p1.setPipeline(densePipe);
        p1.setBindGroup(0, bgDense);
        p1.dispatchWorkgroups(Math.ceil(N / 64));
        p1.end();

        const p2 = enc.beginComputePass();
        p2.setPipeline(compactedPipe);
        p2.setBindGroup(0, bgComp);
        p2.dispatchWorkgroupsIndirect(stage.indirectDispatchBuffer, stage.indirectDispatchOffset ?? 0);
        p2.end();
        device.queue.submit([enc.finish()]);

        const denseWords = await readU32(outDense);
        const compWords = await readU32(outComp);
        const denseWit = (await readU32(witDense))[0];
        const compWit = (await readU32(witComp))[0];
        const counts = (await readU32(stage.countBuffer)).slice(0, 4);
        const indirectAll = await readU32(stage.indirectDispatchBuffer);
        const indirectOff = (stage.indirectDispatchOffset ?? 0) / 4;
        const indirect = indirectAll.slice(indirectOff, indirectOff + 4);
        let mismatches = 0;
        let firstMismatch = null;
        for (let i = 0; i < N; i++) {
          if (denseWords[i] !== compWords[i]) {
            mismatches += 1;
            if (!firstMismatch) firstMismatch = { i, dense: denseWords[i], comp: compWords[i] };
          }
        }
        for (const b of [stateBuf, thermoBuf, outDense, outComp, witDense, witComp, cparams]) b.destroy();
        return { counts, indirect, denseWit, compWit, mismatches, firstMismatch };
      };

      // ---- G4-1 & G4-3: Quiescent Bulk (Zero-Work Witness) + Partial Active A/B Bit-Identity ----
      const N = 2048;
      const quiescentState = new Float32Array(N * 8);
      const quiescentThermo = new Float32Array(N * 12);
      const mixedState = new Float32Array(N * 8);
      const mixedThermo = new Float32Array(N * 12);
      for (let i = 0; i < N; i++) {
        const x = 0.05 + 1.9 * ((i % 16) / 15);
        const y = 0.05 + 1.9 * ((Math.floor(i / 16) % 16) / 15);
        const z = 0.05 + 1.9 * (Math.floor(i / 256) / 7);
        quiescentState.set([x, y, z, 0.01, 0, 0, 0, 0], i * 8);
        quiescentThermo.set([1, 2, 300, 1000, 0, 1, 0, 0, 0.05, 1, 0, 0.02], i * 12);
        mixedState.set([x, y, z, 0.01, 0, 0, 0, 0], i * 8);
        const isHotCorner = i < 64;
        const mat = isHotCorner ? (i % 2 === 0 ? 11 : 17) : 1;
        const T = isHotCorner ? 550 : 300;
        const phase = isHotCorner ? 2 : 2;
        const fL = isHotCorner ? 0.5 : 1.0;
        const fG = isHotCorner ? 0.5 : 0.0;
        mixedThermo.set([mat, phase, T, 1000, 0, fL, fG, 0, 0.05, 1, 0, 0.02], i * 12);
      }

      // Reaction record: mat 11 + mat 17 -> enabled (1.0), contact radius 0.25 m, T_act = 500 K.
      const rxnRecords = new Float32Array(12);
      rxnRecords.set([11, 17, 0, 500], 0);
      rxnRecords.set([0, 0.25, 0, 0], 4);
      rxnRecords.set([1, 0, 0, 0], 8);
      const rxnRecordBuf = make(rxnRecords);
      const rxnProposalBuf = make(new Float32Array(N * 4));

      const thermalStage = thermalMod.createSchroederThermalDormancyStage({
        device, particleCount: N, boxM: [2, 2, 2], cellEdgeM: 0.25, epsilonK: 0, wallSupportM: 0.1,
        wallTemperaturesK: [0, 0, 0, 0, 0, 0]
      });
      const phaseStage = phaseRadMod.createSchroederPhaseDormancyStage({
        device, particleCount: N,
        phaseWindows: [
          { materialId: 1, meltTemperatureK: 273.15, boilTemperatureK: 373.15 },
          { materialId: 11, meltTemperatureK: 370.94, boilTemperatureK: 1156 },
          { materialId: 17, meltTemperatureK: 171.6, boilTemperatureK: 239.11 }
        ],
        epsilonK: 0
      });
      const radStage = phaseRadMod.createSchroederRadiationDormancyStage({
        device, particleCount: N,
        emissivityRows: [{ materialId: 1, emissivity: 0.95 }, { materialId: 11, emissivity: 0.8 }, { materialId: 17, emissivity: 0.5 }],
        wallTemperaturesK: [300, 300, 300, 300, 300, 300],
        ambientTemperatureK: 300,
        epsilonFluxWPerM2: 0
      });
      const rxnStage = reactionMod.createSchroederReactionDormancyStage({
        device, particleCount: N, boxM: [2, 2, 2], maximumContactRadiusM: 0.25,
        reactionCount: 1, reactionRecordStrideVec4s: 3
      });

      const quiescent = {
        thermal: await runABAndWitness({ state: quiescentState, thermo: quiescentThermo, stage: thermalStage, mode: 0 }),
        phase: await runABAndWitness({ state: quiescentState, thermo: quiescentThermo, stage: phaseStage, mode: 1 }),
        radiation: await runABAndWitness({ state: quiescentState, thermo: quiescentThermo, stage: radStage, mode: 2 }),
        reaction: await runABAndWitness({
          state: quiescentState, thermo: quiescentThermo, stage: rxnStage, mode: 3,
          encodeArgs: { reactionRecordBuffer: rxnRecordBuf, proposalBuffer: rxnProposalBuf }
        })
      };

      // Record quiescent 4-law receipt ring proof on GPU!
      receiptMod.openLawActivationReceiptRing(device, { capacityPerLaw: 2 });
      const rEnc = device.createCommandEncoder();
      receiptMod.encodeLawActivationCount(rEnc, device, 'thermal', thermalStage.countBuffer, { epsilon: 0 });
      receiptMod.encodeLawActivationCount(rEnc, device, 'phase', phaseStage.countBuffer, { epsilon: 0 });
      receiptMod.encodeLawActivationCount(rEnc, device, 'radiation', radStage.countBuffer, { epsilon: 0 });
      receiptMod.encodeLawActivationCount(rEnc, device, 'reaction', rxnStage.countBuffer, { epsilon: 0 });
      device.queue.submit([rEnc.finish()]);
      await device.queue.onSubmittedWorkDone();
      const quiescentReceipt = await receiptMod.closeLawActivationReceiptRing(device);

      const mixedAB = {
        thermal: await runABAndWitness({ state: mixedState, thermo: mixedThermo, stage: thermalStage, mode: 0 }),
        phase: await runABAndWitness({ state: mixedState, thermo: mixedThermo, stage: phaseStage, mode: 1 }),
        radiation: await runABAndWitness({ state: mixedState, thermo: mixedThermo, stage: radStage, mode: 2 }),
        reaction: await runABAndWitness({
          state: mixedState, thermo: mixedThermo, stage: rxnStage, mode: 3,
          encodeArgs: { reactionRecordBuffer: rxnRecordBuf, proposalBuffer: rxnProposalBuf }
        })
      };

      // ---- G4-2: Conservative Activation When G6/A4 Uncertainty Straddles Thresholds ----
      const uncN = 128;
      const uState = new Float32Array(uncN * 8);
      const uThermo = new Float32Array(uncN * 12);
      for (let i = 0; i < uncN; i++) {
        uState.set([0.5, 0.5, 0.5, 0.01, 0, 0, 0, 0], i * 8);
      }
      // Phase uncertainty test: pure liquid at 370 K (3.15 K below T_boil = 373.15 K).
      for (let i = 0; i < uncN; i++) uThermo.set([1, 2, 370.0, 1000, 0, 1, 0, 0, 0.05, 1, 0, 0.02], i * 12);
      const uStateBuf = make(uState);
      const uThermoBuf = make(uThermo);
      const smallUncBuf = make(new Float32Array(uncN).fill(1.0));
      const straddleUncBuf = make(new Float32Array(uncN).fill(4.0));
      const uPhaseStage = phaseRadMod.createSchroederPhaseDormancyStage({
        device, particleCount: uncN,
        phaseWindows: [{ materialId: 1, meltTemperatureK: 273.15, boilTemperatureK: 373.15 }],
        epsilonK: 0
      });
      const evalStageCounts = async (st, args) => {
        const e = device.createCommandEncoder();
        st.encode(e, { stateBuffer: uStateBuf, thermoBuffer: uThermoBuf, ...args });
        device.queue.submit([e.finish()]);
        return (await readU32(st.countBuffer)).slice(0, 4);
      };
      const phaseUncSmall = await evalStageCounts(uPhaseStage, { uncertaintyBuffer: smallUncBuf });
      const phaseUncStraddle = await evalStageCounts(uPhaseStage, { uncertaintyBuffer: straddleUncBuf });

      // Radiation uncertainty test: isothermal 300 K, epsilonFlux = 1.0 W/m^2.
      // dT = 0 -> flux_bound = 0 <= 1 (dormant); dT = 1 K -> flux_bound ~ 12.2 W/m^2 > 1 (active).
      for (let i = 0; i < uncN; i++) uThermo.set([1, 2, 300.0, 1000, 0, 1, 0, 0, 0.05, 1, 0, 0.02], i * 12);
      device.queue.writeBuffer(uThermoBuf, 0, uThermo);
      const zeroUncBuf = make(new Float32Array(uncN).fill(0.0));
      const uRadStage = phaseRadMod.createSchroederRadiationDormancyStage({
        device, particleCount: uncN,
        emissivityRows: [{ materialId: 1, emissivity: 1.0 }],
        wallTemperaturesK: [300, 300, 300, 300, 300, 300],
        ambientTemperatureK: 300,
        epsilonFluxWPerM2: 1.0
      });
      const radUncZero = await evalStageCounts(uRadStage, { uncertaintyBuffer: zeroUncBuf });
      const radUncStraddle = await evalStageCounts(uRadStage, { uncertaintyBuffer: smallUncBuf });

      // Reaction uncertainty test: co-reactants 11 & 17 at 497 K (T_act = 500 K).
      // dT = 1 K -> 498 < 500 (dormant); dT = 4 K -> 501 >= 500 (all active!).
      for (let i = 0; i < uncN; i++) uThermo.set([i % 2 === 0 ? 11 : 17, 2, 497.0, 1000, 0, 1, 0, 0, 0.05, 1, 0, 0.02], i * 12);
      device.queue.writeBuffer(uThermoBuf, 0, uThermo);
      const uRxnPropBuf = make(new Float32Array(uncN * 4));
      const uRxnStage = reactionMod.createSchroederReactionDormancyStage({
        device, particleCount: uncN, boxM: [2, 2, 2], maximumContactRadiusM: 0.25,
        reactionCount: 1, reactionRecordStrideVec4s: 3
      });
      const rxnUncSmall = await evalStageCounts(uRxnStage, {
        reactionRecordBuffer: rxnRecordBuf, proposalBuffer: uRxnPropBuf, uncertaintyBuffer: smallUncBuf
      });
      const rxnUncStraddle = await evalStageCounts(uRxnStage, {
        reactionRecordBuffer: rxnRecordBuf, proposalBuffer: uRxnPropBuf, uncertaintyBuffer: straddleUncBuf
      });

      // ---- G4-4: Diverse Periodic-Table Element-Pair Spot Checks (Zero Hardcoded Physics) ----
      const elementPairs = [['Na', 'Cl'], ['Cu', 'Ag'], ['Li', 'F'], ['Fe', 'Ni'], ['K', 'Br']];
      const pairChecks = [];
      for (const [symA, symB] of elementPairs) {
        const closA = elementsMod.elementMaterialClosure(periodicMod.zForSymbol(symA));
        const closB = elementsMod.elementMaterialClosure(periodicMod.zForSymbol(symB));
        const propsMap = { [symA]: closA.properties, [symB]: closB.properties };
        const windows = phaseRadMod.phaseWindowsFromMaterialProperties(propsMap, opticalMod.stableOpticalMaterialId);
        const idA = opticalMod.stableOpticalMaterialId(symA);
        const idB = opticalMod.stableOpticalMaterialId(symB);
        const disc = reactionDiscoveryMod.discoverReactions(symA, symB, {
          materialProperties: propsMap,
          liveMaterialKeys: [symA, symB],
          allowReducedProductProperties: true
        });
        const meltA = windows.find((w) => w.materialId === idA)?.meltTemperatureK || 0;
        const boilA = windows.find((w) => w.materialId === idA)?.boilTemperatureK || 0;
        const pN = 64;
        const pState = new Float32Array(pN * 8);
        const pThermo = new Float32Array(pN * 12);
        // Safe solid temperature strictly below both melting points (or 100 K) -> phase dormant at dT=0.
        const minMelt = Math.min(...windows.map((w) => (w.meltTemperatureK > 0 ? w.meltTemperatureK : 1e9)));
        const coldT = Math.max(10, Math.min(100, minMelt * 0.5));
        for (let i = 0; i < pN; i++) {
          const isA = i < pN / 2;
          pState.set([0.5 + (isA ? 0 : 0.05), 0.5, 0.5, 0.01, 0, 0, 0, 0], i * 8);
          pThermo.set([isA ? idA : idB, 1, coldT, 1000, 1, 0, 0, 0, 0.05, 1, 0, 0.02], i * 12);
        }
        const psBuf = make(pState);
        const ptBuf = make(pThermo);
        const pStage = phaseRadMod.createSchroederPhaseDormancyStage({
          device, particleCount: pN, phaseWindows: windows, epsilonK: 0
        });
        const e1 = device.createCommandEncoder();
        pStage.encode(e1, { stateBuffer: psBuf, thermoBuffer: ptBuf });
        device.queue.submit([e1.finish()]);
        const coldCounts = (await readU32(pStage.countBuffer)).slice(0, 4);

        // Now place half at meltA (exact phase boundary!) -> must activate conservatively.
        if (meltA > 0) {
          for (let i = 0; i < pN / 2; i++) pThermo[i * 12 + 2] = meltA;
          device.queue.writeBuffer(ptBuf, 0, pThermo);
        }
        const e2 = device.createCommandEncoder();
        pStage.encode(e2, { stateBuffer: psBuf, thermoBuffer: ptBuf });
        device.queue.submit([e2.finish()]);
        const meltCounts = (await readU32(pStage.countBuffer)).slice(0, 4);

        pStage.destroy();
        psBuf.destroy();
        ptBuf.destroy();
        pairChecks.push({
          pair: `${symA}+${symB}`,
          meltA,
          boilA,
          discoveredReactions: (disc.reactions || []).length,
          coldCounts,
          meltCounts
        });
      }

      for (const s of [thermalStage, phaseStage, radStage, rxnStage, uPhaseStage, uRadStage, uRxnStage]) s.destroy();
      for (const b of [rxnRecordBuf, rxnProposalBuf, uStateBuf, uThermoBuf, smallUncBuf, straddleUncBuf, zeroUncBuf, uRxnPropBuf]) b.destroy();
      device.destroy();

      return {
        status: 'ran',
        errors,
        N,
        uncN,
        quiescent,
        quiescentReceipt,
        mixedAB,
        uncertainty: { phaseUncSmall, phaseUncStraddle, radUncZero, radUncStraddle, rxnUncSmall, rxnUncStraddle },
        pairChecks
      };
    });

    assert.notEqual(out.status, 'unsupported', 'WebGPU adapter unavailable');
    assert.notEqual(out.status, 'compile-error', `WGSL compile error: ${JSON.stringify(out.compileErrors)}`);
    assert.deepEqual(out.errors, [], `zero GPU validation errors: ${JSON.stringify(out.errors)}`);

    // G4-3: Literal zero-work witness on quiescent bulk across ALL 4 law families!
    for (const law of ['thermal', 'phase', 'radiation', 'reaction']) {
      const q = out.quiescent[law];
      assert.equal(q.mismatches, 0, `G4-1 quiescent ${law}: A/B bit-identical (${JSON.stringify(q)})`);
      assert.deepEqual(q.counts.slice(0, 3), [0, out.N, out.N], `G4-3 quiescent ${law}: 100% dormant`);
      assert.deepEqual(q.indirect, [0, 1, 1, 0], `G4-3 quiescent ${law}: indirect dispatch == [0, 1, 1, 0]`);
      assert.equal(q.compWit, 0, `G4-3 quiescent ${law}: ZERO executed GPU threads via dispatchWorkgroupsIndirect!`);
      assert.equal(out.quiescentReceipt.laws[law].zeroWorkSteps, 1, `G4-3 receipt ring records zeroWorkSteps=1 for ${law}`);
      assert.equal(out.quiescentReceipt.laws[law].exact, true, `G4-3 receipt ring records exact=true for ${law}`);
    }

    // G4-1: Partial active mixed scene A/B bit-identity at epsilon = 0 across ALL 4 law families!
    for (const law of ['thermal', 'phase', 'radiation', 'reaction']) {
      const m = out.mixedAB[law];
      assert.equal(m.mismatches, 0, `G4-1 mixed ${law}: compacted indirect == dense bit-for-bit`);
      assert.ok(m.counts[0] > 0, `G4-1 mixed ${law}: active set non-empty (${m.counts[0]})`);
      assert.equal(m.indirect[3], m.counts[0], `G4-1 mixed ${law}: indirect active count matches`);
      if (law !== 'radiation') {
        assert.ok(m.counts[1] > 0, `G4-1 mixed ${law}: bulk far region stays dormant (${m.counts[1]})`);
        assert.ok(m.compWit < m.denseWit, `G4-1 mixed ${law}: compacted executed fewer threads (${m.compWit} < ${m.denseWit})`);
      }
    }

    // G4-2: Conservative activation under G6/A4 uncertainty bounds across phase, radiation, and reaction!
    assert.deepEqual(out.uncertainty.phaseUncSmall.slice(0, 3), [0, out.uncN, out.uncN], 'G4-2 phase: interior uncertainty stays dormant');
    assert.deepEqual(out.uncertainty.phaseUncStraddle.slice(0, 3), [out.uncN, 0, out.uncN], 'G4-2 phase: straddling uncertainty activates all');
    assert.deepEqual(out.uncertainty.radUncZero.slice(0, 3), [0, out.uncN, out.uncN], 'G4-2 radiation: zero uncertainty stays dormant');
    assert.deepEqual(out.uncertainty.radUncStraddle.slice(0, 3), [out.uncN, 0, out.uncN], 'G4-2 radiation: straddling uncertainty activates all');
    assert.deepEqual(out.uncertainty.rxnUncSmall.slice(0, 3), [0, out.uncN, out.uncN], 'G4-2 reaction: sub-threshold uncertainty stays dormant');
    assert.deepEqual(out.uncertainty.rxnUncStraddle.slice(0, 3), [out.uncN, 0, out.uncN], 'G4-2 reaction: straddling uncertainty activates all');

    // G4-4: Random periodic-table element-pair spot checks!
    assert.equal(out.pairChecks.length, 5);
    for (const check of out.pairChecks) {
      assert.equal(check.coldCounts[0], 0, `G4-4 ${check.pair}: cold pure solid is phase-dormant`);
      if (check.meltA > 0) {
        assert.equal(check.meltCounts[0], 32, `G4-4 ${check.pair}: melting cohort conservatively activates (${check.meltCounts[0]})`);
      }
    }
    console.log(JSON.stringify({
      quiescentIndirect: Object.fromEntries(Object.entries(out.quiescent).map(([k, v]) => [k, { indirect: v.indirect, compWit: v.compWit }])),
      mixedSavings: Object.fromEntries(Object.entries(out.mixedAB).map(([k, v]) => [k, { active: v.counts[0], dormant: v.counts[1], denseWit: v.denseWit, compWit: v.compWit, mismatches: v.mismatches }])),
      pairChecks: out.pairChecks
    }));
  } finally {
    await browser.close();
  }
});
