import assert from 'node:assert/strict';
import test from 'node:test';

test('phase-slot closure consumes final phase state, refreshes and retires only superseded GPU outputs', {
  skip: process.env.ULG_RUN_NATIVE_PHASE_SLOT_CLOSURE !== '1', timeout: 120_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true,
    args: ['--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer', '--enable-unsafe-webgpu',
      '--ignore-gpu-blocklist', '--enable-webgpu-developer-features'] });
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    const url = 'https://127.0.0.1:5173/__phase_slot_closure_test__';
    await page.route(url, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Phase closure gate</title>' }));
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const result = await page.evaluate(async () => {
      let adapter;
      for (let i = 0; i < 5 && !adapter; i++) {
        adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
        if (!adapter) await new Promise(resolve => setTimeout(resolve, 500));
      }
      if (!adapter) throw new Error('Native WebGPU adapter unavailable');
      const device = await adapter.requestDevice({ requiredLimits: { maxStorageBuffersPerShaderStage: 12 } });
      const owned = [], closures = [], errors = [], destroyed = new Set();
      const createBuffer = device.createBuffer.bind(device);
      device.createBuffer = descriptor => {
        const buffer = createBuffer(descriptor), destroy = buffer.destroy.bind(buffer);
        buffer.destroy = () => { destroyed.add(buffer); destroy(); };
        return buffer;
      };
      const check = (value, message) => { if (!value) throw new Error(message); };
      device.addEventListener('uncapturederror', event => errors.push(event.error.message));
      device.pushErrorScope('validation');
      try {
        const c = await import('/src/runtime/sph/sphMlsMpmPostMechanicsClosure.js');
        const h = await import('/src/runtime/sph/schroederHierarchyGpu.js');
        const abi = await import('/ulg-gpu-abi/src/index.js');
        const identity = await import('/src/runtime/sph/sphGpuDeviceIdentity.js');
        const mechanics = await import('/src/runtime/sph/sphMechanicsMaterialTable.js');
        const make = (values, usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST) => {
          const buffer = identity.tagWebGpuBufferDevice(device.createBuffer({
            size: typeof values === 'number' ? values : values.byteLength, usage
          }), device);
          owned.push(buffer);
          if (typeof values !== 'number') device.queue.writeBuffer(buffer, 0, values);
          return buffer;
        };
        const count = 16, capacity = 4;
        const plan = { schema: 'peercompute.ulg.sph-phase-carrier-plan.v2', status: 'phase-lane-capacity-ready',
          lineageCapacity: capacity, primaryCapacity: capacity, phaseLaneStride: capacity, phaseLaneCount: 4,
          companionStart: capacity, companionCapacity: 12, particleCapacity: count,
          stableLaneAddress: 'phaseLane*phaseLaneStride+lineageIndex', phaseCompanionLanesRequired: true,
          splitSpareReserve: { schema: 'peercompute.ulg.schroeder-split-spare-reserve.v1',
            firstLineageIndex: 1, count: 3, firstContinuityDomainId: 101 } };
        const state = new Float32Array(count * 8), thermo = new Float32Array(count * 12), mech = new Float32Array(count * 32);
        for (let i = 0; i < count; i++) {
          state.set([5, 5, 5, i === 0 ? 8 : 0, 0, 0, 0, 1000], i * 8);
          thermo.set([7, 3, 100, 1, 0, 0, 1, 0, 0.2, i === 0 ? 8 : 0, i === 0 ? 1 : 254, i === 0 ? 0.1 : 0], i * 12);
          mech[i * 32] = 1; mech[i * 32 + 4] = 1; mech[i * 32 + 8] = 1;
          mech.set([1, i === 0 ? 8 : 0, 0, 1, 100, 0, 0, 10, 2, 1, 101325, 0, 0, i === 0 ? 8 : 0], i * 32 + 18);
        }
        // Manufactured post-mechanics state has different energy from the cold
        // upload. The actual phase producer moves its gas from lane 0 to lane 2.
        const hot = new Float32Array(state); hot[7] = 2000;
        const sphState = { schema: abi.ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA, particleCount: count,
          state, thermo, stateStrideBytes: 32, thermoStrideBytes: 48, phaseCarrierPlan: plan };
        const mlsState = { schema: abi.ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA, particleCount: count,
          mechanics: mech, mechanicsStrideBytes: 128, phaseCarrierPlan: plan };
        const sph = { status: 'webgpu-uploaded', particleCount: count, phaseCarrierPlan: plan,
          topologyEpoch: 0, identityRevision: 'manufactured-phase-closure', identityBuffer: make(new Uint32Array(count)),
          stateBuffer: make(state), thermoBuffer: make(thermo) };
        const mls = { status: 'webgpu-uploaded', particleCount: count, phaseCarrierPlan: plan, mechanicsBuffer: make(mech) };
        const row = new Float32Array(32);
        row[0] = 8; row[3] = 9; row[6] = 1; row[8] = 5; row[9] = 0; row[10] = 3; row[11] = -1; row[20] = 2;
        const assignment = { status: 'schroeder-particle-storage-slot-assignment-submitted',
          preservePhaseSlots: true, particleStorageSlotAssignmentAdmissionApproved: true,
          allocationRowCount: 1, slotAssignmentBuffer: make(row) };
        const admission = { committed: true, particleStorageMaterializationApproved: true,
          particleIdentityMutationApproved: true, slotAssignmentDescriptorApproved: true,
          outputFamilies: ['schroeder-particle-storage-materialization'],
          targetStateFamilies: [...h.SCHROEDER_PARTICLE_STORAGE_TARGET_FAMILIES],
          schroederParticleStorageMaterializationRowCount: 1 };
        const request = { sourceSphParticleUpload: sph, sourceMlsMpmParticleUpload: mls,
          particleStorageSlotAssignment: assignment, particleStorageMaterializationAdmission: admission,
          spareLineagesBuffer: make(new Uint32Array([1, 2, 3])) };
        const args = { device, sphParticleState: sphState, mlsMpmParticleState: mlsState,
          sphParticleUpload: sph, mlsMpmParticleUpload: mls,
          postMechanicsParticleBuffers: { stateBuffer: make(hot), mechanicsBuffer: mls.mechanicsBuffer },
          thermalMaterialTable: {
            schema: abi.ULG_SPH_GPU_THERMAL_MATERIAL_TABLE_SCHEMA, materialCount: 1, segmentCount: 1,
            recordStrideFloats: 8, segmentStrideFloats: 12,
            segments: new Float32Array([7, 5, 3, 3, 100, 10000, 10, 1000, 1, 1, 1, 0]),
            records: new Float32Array([7, 0, 1, 1, 0, 0, 101325, 0]) },
          mechanicsMaterialTable: { schema: mechanics.ULG_MLS_MPM_MECHANICS_MATERIAL_TABLE_SCHEMA,
            phaseRecordCount: 1, records: new Float32Array([7, 3, 1, 900, 0, 0, 30, 2, 0, 1, 0, 0]) },
          thermalStepOptions: { conductionRate: 0, wallRate: 0, ambientTemperatureK: 200, wallModel: 'adiabatic', smoothingLengthM: 0.2 },
          phaseSlotRefinement: request,
          dtSeconds: 0.001, boxDimsM: [10, 10, 10], preferWebGpu: true, readbackMode: 'no-full-readback' };
        const closure = await c.runMlsMpmPostMechanicsClosureWebGpu(args); closures.push(closure);
        check(closure.executedStageOrder.join(',') === 'thermal-phase,phase-carrier-transfer-v2,phase-slot-refinement,mechanics-constitutive-refresh', 'Incorrect producer order');
        check(closure.residentContinuationReady && closure.fullParticleReadbackFree, 'Closure did not produce a resident continuation');
        let missingRefresh = false;
        try { c.resolveMlsMpmPostMechanicsContinuation({
          phaseSlotRefinementStep: closure.phaseSlotRefinementStep,
          phaseCarrierTransferStep: closure.phaseCarrierTransferStep,
          postMechanicsParticleBuffers: args.postMechanicsParticleBuffers
        }); } catch (error) { missingRefresh = error.message.includes('constitutive refresh'); }
        check(missingRefresh, 'Unrefreshed candidate passed continuation selection');
        const selected = c.selectMlsMpmTerminalParticleFamily({ postMechanicsClosure: closure,
          sphParticleState: sphState, sphParticleUpload: sph, phaseCarrierTransferStep: closure.phaseCarrierTransferStep,
          mechanicsRefreshStep: closure.mechanicsRefreshStep });
        check(selected.phaseSlotRefinementSelected && selected.stateBuffer === closure.phaseSlotRefinementStep.stateBuffer,
          'Terminal selection discarded refinement');
        check(selected.mechanicsBuffer === closure.mechanicsRefreshStep.mechanicsBuffer
          && selected.mechanicsBuffer !== closure.phaseSlotRefinementStep.mechanicsBuffer, 'Refresh not selected');
        let refused = false;
        try { closure.phaseSlotRefinementStep.destroyOutputParticleBuffers(); } catch { refused = true; }
        check(refused, 'Captured outputs retired before their owner fence');
        const refinementState = closure.phaseSlotRefinementStep.stateBuffer;
        closure.phaseSlotRefinementStep.stateBuffer = sph.stateBuffer;
        let substituted = false;
        try { c.selectMlsMpmTerminalParticleFamily({ postMechanicsClosure: closure,
          sphParticleState: sphState, sphParticleUpload: sph, mechanicsRefreshStep: closure.mechanicsRefreshStep }); }
        catch { substituted = true; }
        finally { closure.phaseSlotRefinementStep.stateBuffer = refinementState; }
        check(substituted, 'A substituted producer output passed terminal selection');
        let failedOutput = null, failure = null;
        try {
          await c.runMlsMpmPostMechanicsClosureWebGpu({ ...args, phaseSlotRefinement: { ...request },
            timedStage: async (name, run) => {
              const output = await run();
              if (name === 'phaseSlotRefinement') { failedOutput = output; throw new Error('injected-after-refinement'); }
              return output;
            }
          });
        } catch (error) { failure = error; }
        check(failure?.message === 'injected-after-refinement' && failedOutput, 'Failure hook did not reach actual refinement');
        const cleanup = await failure.postMechanicsCleanupCompletion;
        check(cleanup && !cleanup.blockers.length, 'Failed refinement left blocked cleanup');
        for (const key of ['stateBuffer', 'thermoBuffer', 'mechanicsBuffer']) {
          check(destroyed.has(failedOutput[key]), 'Failed producer leaked ' + key);
        }
        check(!destroyed.has(sph.stateBuffer) && !destroyed.has(mls.mechanicsBuffer), 'Failure cleanup destroyed source inputs');
        let denied = null;
        try {
          await c.runMlsMpmPostMechanicsClosureWebGpu({ ...args, phaseSlotRefinement: {
            ...request, particleStorageMaterializationAdmission: { ...admission, particleStorageMaterializationApproved: false }
          } });
        } catch (error) { denied = error; }
        check(denied?.message.includes('StateManager materialization admission'), 'Missing admission was not refused');
        const deniedCleanup = await denied.postMechanicsCleanupCompletion;
        check(deniedCleanup && !deniedCleanup.blockers.length, 'Denied request leaked upstream producers');
        const claim = c.claimMlsMpmPostMechanicsContinuation(closure, selected);
        check(claim.stateBuffer === selected.stateBuffer, 'Claim changed terminal family');
        await c.retireMlsMpmPostMechanicsClosureOutputsAfter(closure, {
          after: device.queue.onSubmittedWorkDone().then(() => true) });
        check(destroyed.has(closure.phaseSlotRefinementStep.mechanicsBuffer), 'Superseded refinement mechanics leaked');
        for (const key of ['stateBuffer', 'thermoBuffer', 'mechanicsBuffer']) {
          check(!destroyed.has(selected[key]), 'Claimed component was destroyed: ' + key);
        }
        // A GPU consumer AFTER retirement proves the selected outputs survived.
        const receipt = make(32);
        const pipeline = device.createComputePipeline({ layout: 'auto', compute: { entryPoint: 'main',
          module: device.createShaderModule({ code: `
            @group(0) @binding(0) var<storage, read> s: array<vec4<f32>>;
            @group(0) @binding(1) var<storage, read> t: array<vec4<f32>>;
            @group(0) @binding(2) var<storage, read> m: array<vec4<f32>>;
            @group(0) @binding(3) var<storage, read> cold: array<vec4<f32>>;
            @group(0) @binding(4) var<storage, read_write> receipt: array<u32>;
            fn expect(a: f32, b: f32, code: u32) {
              if (!(abs(a-b) <= 0.001 * max(1.0, abs(b)))) {
                receipt[0]++; if (receipt[2] == 0u) { receipt[2]=code; receipt[3]=bitcast<u32>(a); receipt[4]=bitcast<u32>(b); }
              }
            }
            @compute @workgroup_size(1) fn main() {
              var mass = 0.0; var energy = 0.0; var volume = 0.0;
              for (var i=0u; i<16u; i++) {
                let p=s[i*2u]; let v=s[i*2u+1u];
                mass+=p.w; energy+=p.w*v.w; volume+=m[i*8u+4u].z*m[i*8u+4u].w;
                if (i>=8u && i<12u) {
                  expect(p.w, 2.0, 10u+i); expect(v.w, 2000.0, 30u+i);
                  expect(t[i*3u].z, 200.0, 50u+i); expect(m[i*8u+5u].z, 900.0, 70u+i);
                  expect(m[i*8u+6u].y, 30.0, 90u+i);
                } else { expect(p.w, 0.0, 110u+i); }
              }
              expect(mass, 8.0, 1u); expect(energy, 16000.0, 2u); expect(volume, 8.0, 3u);
              expect(cold[0].w, 8.0, 4u); expect(cold[1].w, 1000.0, 5u); receipt[1]=1u;
            }
          ` }) } });
        const group = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0),
          entries: [selected.stateBuffer, selected.thermoBuffer, selected.mechanicsBuffer, sph.stateBuffer, receipt]
            .map((buffer,binding) => ({ binding, resource: { buffer } })) });
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginComputePass(); pass.setPipeline(pipeline); pass.setBindGroup(0,group); pass.dispatchWorkgroups(1); pass.end();
        const read = make(32, GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ);
        encoder.copyBufferToBuffer(receipt,0,read,0,32); device.queue.submit([encoder.finish()]);
        await read.mapAsync(GPUMapMode.READ); const words = [...new Uint32Array(read.getMappedRange())]; read.unmap();
        for (const buffer of [selected.stateBuffer, selected.thermoBuffer, selected.mechanicsBuffer]) buffer.destroy();
        const validation = await device.popErrorScope(); if (validation) errors.push(validation.message);
        return { words, errors, order: closure.executedStageOrder, ownershipChecks: ['captured-pin', 'missing-refresh-rejected', 'substitution-rejected', 'failure-retirement', 'admission-denied', 'partial-retirement'] };
      } finally {
        await device.queue.onSubmittedWorkDone().catch(() => {});
        for (const buffer of owned) buffer.destroy();
        device.destroy();
      }
    });
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.words, [0, 1, 0, 0, 0, 0, 0, 0]);
    console.log(JSON.stringify(result));
  } finally { await browser.close(); }
});
