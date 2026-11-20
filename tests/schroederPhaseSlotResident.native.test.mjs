import assert from 'node:assert/strict';
import test from 'node:test';

test('resident phase-slot refinement publishes topology and owns the refreshed continuation', {
  skip: process.env.ULG_RUN_NATIVE_PHASE_SLOT_RESIDENT !== '1'
    && process.env.ULG_RUN_NATIVE_PHASE_SLOT_HIERARCHY !== '1'
    && process.env.ULG_RUN_NATIVE_PHASE_SLOT_CANONICAL !== '1', timeout: 120_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true,
    args: ['--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer', '--enable-unsafe-webgpu',
      '--ignore-gpu-blocklist', '--enable-webgpu-developer-features'] });
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    const url = 'https://127.0.0.1:5173/__phase_slot_resident_test__';
    await page.route(url, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Phase closure gate</title>' }));
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const result = await page.evaluate(async ({ throughHierarchy, canonical }) => {
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
        const { hierarchy: h, resident, closure, spatial, abi, identity, mechanics } =
          await import('/tests/fixtures/schroederPhaseSlotResidentNative.js');
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
        Object.assign(sphState, { smoothingLengthM: 1, step: 0, time: 0, topologyEpoch: 7 });
        Object.assign(mlsState, { mechanicsDtS: 0.001, gridCflFactor: 0.4, gravityMPerS2: [0,0,0] });
        const sourceEpoch = { storageGeneration: 1, topologyEpoch: 7, positionEpoch: 0,
          physicsTick: 0, physicsSubstep: 0, chartEpoch: 0, levelEpoch: 0, supportEpoch: 0 };
        Object.assign(sph, sourceEpoch, { ownsIdentityBuffer: true });
        Object.assign(mls, sourceEpoch);
        const meta = { backend: 'webgpu', status: 'manufactured-mechanics-output',
          readbackMode: 'no-full-readback', normalHotLoopReadbackFree: true,
          fullParticleReadbackFree: true, mapAsyncCount: 0, readbackBytes: 0, hostQueueFenceCount: 0,
          state: new Float32Array(), thermo: new Float32Array(), mechanics: new Float32Array(),
          gridNodes: new Float32Array(), updatedGridNodes: new Float32Array(),
          particleCount: count, gridNodeCount: 8, gridDims: [2,2,2], gridSpacingM: 1,
          gridShift: 1, gridNodeStrideFloats: 8, dt: 0.001 };
        const residentArgs = { ...args, dt: 0.001, gridSpacingM: 1, gravityMPerS2: [0,0,0],
          summaryRunner: null, contactSolverEnabled: false,
          p2gRunner: async () => ({ ...meta, gridBuffer: make(256), gridBufferByteLength: 256 }),
          gridUpdateRunner: async () => ({ ...meta, updatedGridBuffer: make(256), updatedGridBufferByteLength: 256 }),
          g2pRunner: async () => ({ ...meta, stateBuffer: make(hot), mechanicsBuffer: make(mech),
            stateBufferByteLength: count*32, mechanicsBufferByteLength: count*128,
            retainedOutputParticleBuffers: true }) };
        let hierarchyResult, hierarchyArgs, deferredFenceRequests = 0;
        const withoutCompletionFence = async run => {
          const nativeFence = device.queue.onSubmittedWorkDone.bind(device.queue);
          const pending = [];
          let timer;
          device.queue.onSubmittedWorkDone = () => {
            deferredFenceRequests++;
            return new Promise((resolve, reject) => pending.push({ resolve, reject }));
          };
          try {
            return await Promise.race([run(), new Promise((_, reject) => {
              timer = setTimeout(() => reject(new Error('Refinement awaited a host completion fence')), 10000);
            })]);
          } finally {
            clearTimeout(timer);
            device.queue.onSubmittedWorkDone = nativeFence;
            // Pending deferred cleanup remains real queue-fenced work. Only
            // after the step returned do we let those callbacks observe it.
            if (pending.length) nativeFence().then(() => pending.forEach(p => p.resolve()),
              error => pending.forEach(p => p.reject(error)));
          }
        };
        if (throughHierarchy) {
          // Manufactured split intent and mechanics; the hierarchy executes its
          // real scan, allocator, assignment and post-phase resident writer.
          const apply = new Float32Array(32);
          apply[0] = 8; apply[3] = 4; apply[6] = 1; apply[7] = 3; apply[21] = -1;
          const { phaseSlotRefinement: omittedRequest, ...stepOptions } = residentArgs;
          hierarchyArgs = {
            device, sphParticleState: sphState, mlsMpmParticleState: mlsState,
            sphParticleUpload: sph, mlsMpmParticleUpload: mls,
            selectedLevel: 0, minLevel: 0, maxLevel: 0, baseGridSpacingM: 1,
            boxDimsM: [10,10,10], dt: 0.001, gravityMPerS2: [0,0,0],
            readbackMode: 'no-full-readback', enableSpatialEpochGeneration: canonical,
            enablePressureInterfaceOwnerScope: false, enableCrossLevelCoupling: false,
            enableLawQueue: false, enableLawNeighborCandidates: false,
            enablePhaseVolumeMigration: true, enablePhaseVolumeTargetAggregate: false,
            enablePhaseVolumeTargetAggregateNodeReduction: false,
            enablePhaseVolumeSplitMergeProposal: false, enablePhaseVolumeSplitMergeApply: true,
            enableParticleStorageAllocation: true, enableParticleStorageSlotAssignment: true,
            enableParticleStorageMaterialization: true, enablePhaseSlotRefinement: true,
            phaseVolumeSplitMergeApply: {
              schema: h.ULG_SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_APPLY_EXECUTION_SCHEMA,
              status: 'schroeder-phase-volume-split-merge-apply-submitted',
              proposalRowCount: 1, applyStrideFloats: 32, applyBuffer: make(apply)
            },
            particleStorageAllocatorAdmission: { committed: true,
              particleStorageAllocationApproved: true, particleCapacityApproved: true,
              outputFamilies: ['schroeder-particle-storage-allocation'],
              targetStateFamilies: [...h.SCHROEDER_PARTICLE_STORAGE_TARGET_FAMILIES],
              schroederParticleStorageAllocationRowCount: 1,
              currentParticleCapacity: count, requiredParticleCapacity: count },
            particleStorageSlotAssignmentAdmission: { committed: true,
              particleStorageSlotAssignmentApproved: true, freeListDescriptorApproved: true,
              outputFamilies: ['schroeder-particle-storage-slot-assignment'],
              targetStateFamilies: [...h.SCHROEDER_PARTICLE_STORAGE_TARGET_FAMILIES],
              schroederParticleStorageSlotAssignmentRowCount: 1 },
            particleStorageMaterializationAdmission: admission,
            residentStepOptions: { ...stepOptions, contactSolverEnabled: canonical,
              gasPressureMechanicsBoundaryEnabled: false }
          };
          hierarchyResult = await withoutCompletionFence(() => h.runSchroederSameLevelMechanicsWebGpu(hierarchyArgs));
        }
        if (throughHierarchy) check(hierarchyResult?.residentStep, 'Hierarchy omitted the resident step');
        const step = throughHierarchy ? hierarchyResult.residentStep
          : await withoutCompletionFence(() => resident.runMlsMpmResidentStepWithOptionalWebGpu(residentArgs));
        check(step.residentContinuationReady && step.nextUsesPhaseSlotRefinement, 'Resident refinement was not selected');
        check(step.phaseSlotRetirementMethod === 'authenticated-final-refresh-submission'
          && step.phaseSlotRefinementStep.hostQueueFenceCount === 0,
          'Refinement did not use the authenticated queue-ordered retirement path');
        const next = step.nextParticleUploads;
        check(next.sphParticleUpload.topologyEpoch === 8 && next.mlsMpmParticleUpload.topologyEpoch === 8,
          'Fixed-slot occupancy change failed to advance both topology epochs');
        check(next.sphParticleUpload.identityRevision !== sph.identityRevision
          && next.sphParticleUpload.identityBuffer === sph.identityBuffer,
          'Topology revision must advance without rewriting reserved identities');
        check(next.sphParticleUpload.sourceStage === 'phase-slot-refinement'
          && next.mlsMpmParticleUpload.sourceStage === 'mechanics-constitutive-refresh', 'Wrong source-stage publication');
        check(step.diagnostics.residentAuthorityParticleOwner === 'phase-slot-refinement'
          && step.diagnostics.residentAuthorityThermoOwner === 'phase-slot-refinement'
          && step.diagnostics.residentAuthorityMechanicsOwner === 'mechanics-constitutive-refresh', 'Wrong final authority owners');
        let selected = { stateBuffer: next.sphParticleUpload.stateBuffer,
          thermoBuffer: next.sphParticleUpload.thermoBuffer, mechanicsBuffer: next.mlsMpmParticleUpload.mechanicsBuffer };
        check(destroyed.has(step.phaseSlotRefinementStep.mechanicsBuffer), 'Superseded refinement mechanics leaked');
        check(!destroyed.has(sph.stateBuffer) && !destroyed.has(sph.thermoBuffer), 'Source buffers retired by child');
        for (const buffer of Object.values(selected)) check(!destroyed.has(buffer), 'Adopted output retired');
        let canonicalSteps = 0;
        if (canonical) {
          const family = next.schroederSpatialSuccessorSourceFamily;
          check(family, 'Canonical refinement did not publish a successor family');
          spatial.resolveSchroederSpatialSuccessorSourceFamily(family, { device,
            sphParticleUpload: next.sphParticleUpload, mlsMpmParticleUpload: next.mlsMpmParticleUpload });
          const lease = spatial.acquireSchroederSpatialSuccessorSourceFamilyLease(family, { device });
          try {
            const second = await withoutCompletionFence(() => h.runSchroederSameLevelMechanicsWebGpu({
              ...hierarchyArgs,
              sphParticleState: resident.cloneSphParticleStateForNext(sphState, step),
              mlsMpmParticleState: resident.cloneMlsMpmParticleStateForNext(mlsState, step),
              sphParticleUpload: next.sphParticleUpload, mlsMpmParticleUpload: next.mlsMpmParticleUpload,
              levelAssignment: next.schroederSpatialSuccessorLevelAssignment,
              levelAssignmentSourceFamily: family, levelAssignmentSourceFamilyLease: lease,
              residentStepOptions: { ...hierarchyArgs.residentStepOptions,
                // Manufactured zero-change mechanics reads the actual prior
                // GPU continuation, never the original cold host arrays.
                g2pRunner: async () => {
                  const stateBuffer = make(count * 32), mechanicsBuffer = make(count * 128);
                  const encoder = device.createCommandEncoder();
                  encoder.copyBufferToBuffer(next.sphParticleUpload.stateBuffer, 0, stateBuffer, 0, stateBuffer.size);
                  encoder.copyBufferToBuffer(next.mlsMpmParticleUpload.mechanicsBuffer, 0, mechanicsBuffer, 0, mechanicsBuffer.size);
                  device.queue.submit([encoder.finish()]);
                  return { ...meta, stateBuffer, mechanicsBuffer, stateBufferByteLength: stateBuffer.size,
                    mechanicsBufferByteLength: mechanicsBuffer.size, retainedOutputParticleBuffers: true };
                }
              }
            }));
            const secondNext = second.residentStep.nextParticleUploads;
            const secondFamily = secondNext.schroederSpatialSuccessorSourceFamily;
            check(secondFamily && secondFamily !== family, 'Second canonical step did not publish its own family');
            spatial.resolveSchroederSpatialSuccessorSourceFamily(secondFamily, { device,
              sphParticleUpload: secondNext.sphParticleUpload, mlsMpmParticleUpload: secondNext.mlsMpmParticleUpload });
            check(secondNext.sphParticleUpload.topologyEpoch > next.sphParticleUpload.topologyEpoch
              && secondNext.sphParticleUpload.physicsTick > next.sphParticleUpload.physicsTick,
              'Second canonical step did not advance its actual continuation');
            selected = { stateBuffer: secondNext.sphParticleUpload.stateBuffer,
              thermoBuffer: secondNext.sphParticleUpload.thermoBuffer,
              mechanicsBuffer: secondNext.mlsMpmParticleUpload.mechanicsBuffer };
            canonicalSteps = 2;
          } finally { spatial.releaseSchroederSpatialSuccessorSourceFamilyLease(family, lease, { device }); }
        }
        let unsupported = false;
        try { await resident.runMlsMpmResidentStepWithOptionalWebGpu({ ...residentArgs,
          phaseSlotRefinement: { ...request }, capturePostMechanicsGasSource: true }); }
        catch (error) { unsupported = error.message.includes('has not enrolled'); }
        check(unsupported, 'Unenrolled gas publication was not refused');
        const freshFailureSource = () => {
          const auxiliary = () => ({ materialPropertyBankWarmInputBuffer: make(16),
            materialPropertyBankWarmInputRowCount: 0, ownsMaterialPropertyBankWarmInputBuffer: true });
          return {
            sphParticleUpload: { ...sph, ...auxiliary(), identityBuffer: make(new Uint32Array(count)),
              ownsIdentityBuffer: true, identityOwnership: 'failure-source-owner' },
            mlsMpmParticleUpload: { ...mls, ...auxiliary() }
          };
        };
        const checkTransferredOwners = (source, output) => {
          check(source.sphParticleUpload.ownsIdentityBuffer === false
            && output.nextParticleUploads.sphParticleUpload.ownsIdentityBuffer === true,
          'Failure injection did not exercise identity ownership transfer');
          for (const family of ['sphParticleUpload', 'mlsMpmParticleUpload']) {
            check(source[family].ownsMaterialPropertyBankWarmInputBuffer === false
              && output.nextParticleUploads[family].ownsMaterialPropertyBankWarmInputBuffer === true,
            'Failure injection did not exercise auxiliary ownership transfer');
          }
        };
        const checkRestoredOwners = (source, output) => {
          check(source.sphParticleUpload.ownsIdentityBuffer === true
            && source.sphParticleUpload.identityOwnership === 'failure-source-owner'
            && output.nextParticleUploads.sphParticleUpload.ownsIdentityBuffer === false,
          `Rejected continuation did not restore exclusive source identity ownership: ${JSON.stringify({
            sourceOwns: source.sphParticleUpload.ownsIdentityBuffer,
            sourceOwnership: source.sphParticleUpload.identityOwnership,
            targetOwns: output.nextParticleUploads.sphParticleUpload.ownsIdentityBuffer,
            targetOwnership: output.nextParticleUploads.sphParticleUpload.identityOwnership })}`);
          for (const family of ['sphParticleUpload', 'mlsMpmParticleUpload']) {
            check(source[family].ownsMaterialPropertyBankWarmInputBuffer === true
              && output.nextParticleUploads[family].ownsMaterialPropertyBankWarmInputBuffer !== true,
            'Rejected continuation did not restore exclusive source auxiliary ownership');
          }
          for (const buffer of [source.sphParticleUpload.stateBuffer, source.sphParticleUpload.thermoBuffer,
            source.sphParticleUpload.identityBuffer, source.mlsMpmParticleUpload.mechanicsBuffer,
            source.sphParticleUpload.materialPropertyBankWarmInputBuffer,
            source.mlsMpmParticleUpload.materialPropertyBankWarmInputBuffer]) {
            check(!destroyed.has(buffer), 'Rejected continuation retired an original input');
          }
        };
        if (throughHierarchy) {
          const failureSource = freshFailureSource();
          let failedStep, failure;
          try {
            await h.runSchroederSameLevelMechanicsWebGpu({ ...hierarchyArgs, ...failureSource,
              // The ownership-rejection fixture uses independent unregistered
              // source views. Canonical continuation is tested above with its
              // actual published family and lease.
              enableSpatialEpochGeneration: false,
              residentStepOptions: { ...hierarchyArgs.residentStepOptions, contactSolverEnabled: false },
              residentStepRunner: async options => {
                failedStep = await resident.runMlsMpmResidentStepWithOptionalWebGpu(options);
                checkTransferredOwners(failureSource, failedStep);
                // Fail the publication write while leaving the owner's cleanup
                // record writable, as it is for a normal resident step.
                Object.defineProperty(failedStep, 'schroederRequestedReadbackMode', {
                  set() { throw new Error('injected-hierarchy-publication-failure'); }
                });
                return failedStep;
              } });
          } catch (error) { failure = error; }
          check(failedStep && failure, 'Hierarchy late failure was not exercised');
          check(failure.message === 'injected-hierarchy-publication-failure', 'Wrong hierarchy failure');
          check(failure.phaseSlotHierarchyRetirement?.then, 'Hierarchy omitted rejection cleanup');
          await failure.phaseSlotHierarchyRetirement;
          await failure.retryPhaseSlotHierarchyRetirement();
          checkRestoredOwners(failureSource, failedStep);
          for (const buffer of [failedStep.nextParticleUploads.sphParticleUpload.stateBuffer,
            failedStep.nextParticleUploads.sphParticleUpload.thermoBuffer,
            failedStep.nextParticleUploads.mlsMpmParticleUpload.mechanicsBuffer]) {
            check(destroyed.has(buffer), 'Hierarchy rejection stranded a refined output');
          }
        }
        for (const failure of ['envelope', 'retirement-fence']) {
          const failureSource = freshFailureSource();
          let failedClosure, failedEnvelope, rejection;
          const originalFence = device.queue.onSubmittedWorkDone.bind(device.queue);
          const failureMarker = new Error(`injected-${failure}`);
          try {
            await resident.runMlsMpmResidentStepWithOptionalWebGpu({ ...residentArgs, ...failureSource,
              phaseSlotRefinement: { ...request,
                sourceSphParticleUpload: failureSource.sphParticleUpload,
                sourceMlsMpmParticleUpload: failureSource.mlsMpmParticleUpload },
              gpuTimestampRecorder: { active: true, measureQueueStage: async ({ stage }, run) => {
                const output = await run();
                if (stage === 'postMechanicsClosure') {
                  failedClosure = output;
                  let rejected = false;
                  try { await closure.retireMlsMpmPostMechanicsClosureOutputsAfter(output, {
                    queueOrderedFinalConsumer: { ...output.queueOrderedFinalConsumerCapabilities.phaseCarrierOutput }
                  }); } catch (error) { rejected = error.code === 'ERR_MLS_MPM_POST_MECHANICS_RETIREMENT_AUTHORITY'; }
                  check(rejected, 'A structural copy authorized queue-ordered retirement');
                }
                if (stage === 'residentStepEnvelope') {
                  failedEnvelope = output;
                  checkTransferredOwners(failureSource, output);
                  if (failure === 'envelope') throw failureMarker;
                  device.queue.onSubmittedWorkDone = () => {
                    device.queue.onSubmittedWorkDone = originalFence;
                    return Promise.reject(failureMarker);
                  };
                  throw failureMarker;
                }
                return output;
              } }
            });
          } catch (error) { rejection = error; }
          finally { device.queue.onSubmittedWorkDone = originalFence; }
          check(rejection === failureMarker, `Lost the original ${failure} failure`);
          check(rejection.phaseSlotRefinementRetirement?.then, `${failure} has no cleanup completion`);
          if (failure === 'retirement-fence') {
            let fenceRejected = false;
            try { await rejection.phaseSlotRefinementRetirement; }
            catch (error) { fenceRejected = error === failureMarker; }
            check(fenceRejected, 'Failed cleanup fence was not retained for retry');
            check(!destroyed.has(failedClosure.phaseSlotRefinementStep.stateBuffer),
              'Failed cleanup fence retired a still-pinned output');
          } else await rejection.phaseSlotRefinementRetirement;
          await rejection.retryPhaseSlotRefinementRetirement();
          checkRestoredOwners(failureSource, failedEnvelope);
          for (const buffer of [failedClosure.phaseSlotRefinementStep.stateBuffer,
            failedClosure.phaseSlotRefinementStep.thermoBuffer, failedClosure.phaseSlotRefinementStep.mechanicsBuffer,
            failedEnvelope.nextParticleUploads.mlsMpmParticleUpload.mechanicsBuffer]) {
            check(destroyed.has(buffer), `${failure} stranded a private output`);
          }
          for (const buffer of [sph.stateBuffer, sph.thermoBuffer, sph.identityBuffer, mls.mechanicsBuffer]) {
            check(!destroyed.has(buffer), `${failure} retired an original input`);
          }
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
        return { words, errors, throughHierarchy, canonicalSteps, deferredFenceRequests, topologyEpoch: next.sphParticleUpload.topologyEpoch, ownershipChecks: ['resident-family', 'topology-advanced', 'identity-preserved', 'authority-owners', 'partial-retirement', 'unsupported-gas-refused', 'failed-envelope-retired', 'failed-fence-retry-retired', 'rejected-ownership-restored', ...(throughHierarchy ? ['hierarchy-rejection-retired'] : [])], scope: 'Manufactured mechanics and split intent; real GPU phase/refinement/refresh and optional hierarchy scan/allocation/assignment; canonical mode chains two actual published families; no live worker proof' };
      } finally {
        await device.queue.onSubmittedWorkDone().catch(() => {});
        for (const buffer of owned) buffer.destroy();
        device.destroy();
      }
    }, { throughHierarchy: process.env.ULG_RUN_NATIVE_PHASE_SLOT_HIERARCHY === '1'
      || process.env.ULG_RUN_NATIVE_PHASE_SLOT_CANONICAL === '1',
      canonical: process.env.ULG_RUN_NATIVE_PHASE_SLOT_CANONICAL === '1' });
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.words, [0, 1, 0, 0, 0, 0, 0, 0]);
    console.log(JSON.stringify(result));
  } finally { await browser.close(); }
});
