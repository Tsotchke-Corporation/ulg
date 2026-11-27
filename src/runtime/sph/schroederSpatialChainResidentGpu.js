import { flushWorkerQueueSubmitBurst } from '../webgpuComputeLayout.js';
import { normalizeSchroederChainSubcyclePlan } from './schroederSpatialChainSubcycling.js';

// The existing resident sequence/ComputeManager owns scheduling and admission.
// This adapter supplies its numerical batch and its original cleanup owner.
export const SCHROEDER_CHAIN_PRIVATE_DT_REFINEMENT_LADDER = Object.freeze([4, 8, 16, 32, 64, 128, 256]);
const SCHROEDER_CHAIN_MIN_REFINED_DT_S = 1e-8;
const residentSteps = new WeakMap();
const residentDeltas = new WeakMap();

export function bindSchroederSpatialChainResidentDelta(delta, step) {
  const record = residentSteps.get(step);
  if (record) residentDeltas.set(delta,{step,record});
  return delta;
}

/** The synchronous StateManager bridge consumes this private association.
 * Rejection has no returned execution for the caller to clean up. Its error
 * owns the asynchronous cleanup; only this failure path observes the queue. */
export function settleSchroederSpatialChainResidentDelta(delta, accepted) {
  const pending = residentDeltas.get(delta);
  if (!pending) return null;
  residentDeltas.delete(delta);
  if (accepted) return null;
  const after = pending.record.device.queue.onSubmittedWorkDone().then(() => true);
  retireSchroederSpatialChainResidentStep(pending.step,{after});
  return pending.step.residentCleanupCompletion;
}

export function schroederSpatialChainResidentClock(step, execution = null) {
  const record = residentSteps.get(step);
  if (!record) {
    if (step?.chainClockReceipt != null || step?.status === 'schroeder-chain-resident-step-executed') {
      throw new TypeError('Resident chain requires its original state and accepted clock');
    }
    return null;
  }
  const { publication } = record;
  if (record.retiring || step.nextParticleUploads !== publication.nextParticleUploads
      || step.step !== publication.clockReceipt.step || step.time !== publication.clockReceipt.time
      || step.chainClockReceipt !== record.clock
      || [step.nextParticleUploads.sphParticleUpload,step.nextParticleUploads.mlsMpmParticleUpload].some(upload =>
        upload.step !== step.step || upload.time !== step.time
        || upload.physicsTick !== step.step || upload.physicsSubstep !== 0)
      || (execution && (execution.completedStepCount !== record.clock.acceptedBatchStepCount
        || execution.nextParticleUploads !== publication.nextParticleUploads
        || execution.nextSphParticleState !== publication.sphParticleState
        || execution.nextMlsMpmParticleState !== publication.mlsMpmParticleState))
      || [publication.sphParticleState,publication.mlsMpmParticleState].some(state =>
        state.step !== step.step || state.time !== step.time)) {
    throw new TypeError('Resident chain lost its original state and accepted clock');
  }
  record.resolveFamily(publication.publication.sourceFamily, {
    device:record.device, ...publication.nextParticleUploads
  });
  return record.clock;
}

/** Ordinary resident cleanup consumes the owner's existing batch fence. It
 * never introduces another queue fence into the normal numerical path. */
export function retireSchroederSpatialChainResidentStep(step, { after, preserveBuffers = [] } = {}) {
  const record = residentSteps.get(step);
  if (!record) return null;
  const uploads = record.publication.nextParticleUploads;
  const buffers = [uploads.sphParticleUpload.stateBuffer, uploads.sphParticleUpload.thermoBuffer,
    uploads.mlsMpmParticleUpload.mechanicsBuffer];
  if (buffers.some(buffer => preserveBuffers.includes(buffer))) {
    return Object.freeze({ schema:'peercompute.ulg.mls-mpm-resident-buffer-retirement-evidence.v0',
      status:'resident-buffer-retirement-preserved', retiredBuffers:new Set(),
      ownerManagedBuffers:new Set(buffers), rawRetirementAttempted:new Set() });
  }
  if (!after || typeof after.then !== 'function') {
    throw new TypeError('Resident chain retirement requires the existing owner batch completion');
  }
  if (!record.retirement) {
    record.retiring = true;
    record.retirement = (async () => {
      if (await after !== true) throw new TypeError('Resident chain batch completion was not confirmed');
      await record.publication.retire(Promise.resolve(true));
      for (const privateStep of [...record.privateSteps].reverse()) await privateStep.retire(Promise.resolve(true));
      record.privateSteps.length = 0;
      delete step.residentCleanupError;
      return { schema:'peercompute.ulg.mls-mpm-resident-cleanup-completion.v1', status:'resident-cleanup-complete' };
    })().catch(error => {
      record.retirement = null;
      record.retiring = false;
      throw error;
    });
    step.residentCleanupCompletion = record.retirement;
    // Retain the failure for callers awaiting normal cleanup, without an
    // unhandled rejection when a caller only inspects the immediate receipt.
    void record.retirement.catch(error => { step.residentCleanupError = error; });
  }
  return Object.freeze({ schema:'peercompute.ulg.mls-mpm-resident-buffer-retirement-evidence.v0',
    status:'resident-buffer-retirement-attempted', retiredBuffers:new Set(),
    ownerManagedBuffers:new Set(buffers), rawRetirementAttempted:new Set() });
}

export async function runSchroederSpatialChainResidentBatchWebGpu({ stepCount, ...args } = {}) {
  const config = args.schroederSpatialChain;
  const device = args.device ?? args.deviceResult?.device;
  if (!device || args.preferWebGpu !== true || args.readbackMode !== 'no-full-readback'
      || !Number.isSafeInteger(stepCount) || stepCount < 1 || !config || typeof config !== 'object'
      || !Array.isArray(config.mechanicsLevels) || config.mechanicsLevels.length < 2
      || !config.classificationPolicy || !args.forceInputs
      || args.schroederSpatialEpochGeneration || args.schroederSpatialEpochTransaction) {
    throw new TypeError('Resident chain requires a native device, fresh per-interval hierarchy and explicit numerical inputs');
  }
  // These laws have separate existing authorities and must not silently vanish
  // while their chain consumers are being integrated. Ambient gas pressure is
  // admitted whenever gasPressureMechanicsBoundaryEnabled wires the original
  // chain gas-pressure consumer (prepareSchroederSpatialChainGasPressure).
  if (args.condensateExtraction || args.pressureInterfaceForceRowsBuffer || args.pressureInterfaceForceSolver
      || args.externalGaugePressureEnabled
      || (Number(args.ambientPressurePa) > 0 && args.gasPressureMechanicsBoundaryEnabled !== true)
      || args.schroederFarAggregateForceApplication || args.schroederParticleStorageMaterialization) {
    throw new TypeError('Resident chain requires its pressure, condensate and materialization consumers before adoption');
  }
  if ((args.dt != null && args.dt !== args.forceInputs.dt)
      || ['boxDimsM','gravityMPerS2'].some(key => args[key] != null
        && (args[key].length !== 3 || args[key].some((value,index) => value !== args.forceInputs[key]?.[index])))) {
    throw new TypeError('Resident chain force inputs disagree with the resident interval or domain');
  }
  const [{runSchroederSpatialChainStepWebGpu}, {publishSchroederSpatialChainBatchWebGpu}, abi,
    {resolveSchroederSpatialSuccessorSourceFamily:resolveFamily}] = await Promise.all([
    import('./schroederSpatialChainStepGpu.js'), import('./schroederSpatialChainPublicationGpu.js'),
    import('../../../ulg-gpu-abi/src/index.js'), import('./schroederSpatialSuccessorSourceFamily.js')]);
  const closureOptions = {...args.closureOptions};
  for (const key of ['thermalStepOptions','mechanicsRefreshOptions','phaseCarrierTransferOptions',
    'reactionTable','reactionStepOptions','reactionActivationWatchTable','phaseSlotRefinement']) {
    if (args[key] !== undefined) closureOptions[key] = args[key];
  }
  for (const key of ['thermalStepOptions','mechanicsRefreshOptions','phaseCarrierTransferOptions','reactionStepOptions']) {
    if (closureOptions[key]) closureOptions[key] = {...closureOptions[key]};
  }
  const forceInputs = {...args.forceInputs,boxDimsM:[...args.forceInputs.boxDimsM],
    gravityMPerS2:[...args.forceInputs.gravityMPerS2]};
  const mechanicsLevels = config.mechanicsLevels.map(level => ({...level,mechanicsGrid:{...level.mechanicsGrid,
    gridDims:[...level.mechanicsGrid.gridDims],boxDimsM:[...level.mechanicsGrid.boxDimsM]}}));
  const classificationPolicy = {...config.classificationPolicy};
  const mechanicsOptions = {...args.mechanicsOptions};
  const allowAdaptiveDtRefinement = args.allowAdaptiveDtRefinement === true;
  const onAdaptiveRetryAttempt = typeof args.onAdaptiveRetryAttempt === 'function'
    ? args.onAdaptiveRetryAttempt
    : null;
  const spatialEpochLaneId = args.prebuiltInitialSpatialEpoch?.generation?.source?.laneId ?? null;
  const spatialEpochDirectArenaCount = Number.isInteger(
    args.prebuiltInitialSpatialEpoch?.generation?.directArenaCount
  )
    ? args.prebuiltInitialSpatialEpoch.generation.directArenaCount
    : null;
  const fineSubstepsPerCoarseStep = Math.max(
    1,
    Math.round(Number(args.fineSubstepsPerCoarseStep ?? args.mechanicsOptions?.fineSubstepsPerCoarseStep ?? 1) || 1)
  );
  const subcyclePlan = normalizeSchroederChainSubcyclePlan({
    mechanicsLevels,
    fineSubstepsPerCoarseStep,
    macroDtS: forceInputs.dt
  });
  const baseDt = subcyclePlan.fineDtS;
  const effectiveStepCount = stepCount * subcyclePlan.fineSubstepsPerCoarseStep;
  const dtAttempts = [{ dt: baseDt, factor: 1 }];
  if (allowAdaptiveDtRefinement) {
    let previousDt = baseDt;
    for (const factor of SCHROEDER_CHAIN_PRIVATE_DT_REFINEMENT_LADDER) {
      const candidateDt = Math.fround(baseDt / factor);
      if (candidateDt >= SCHROEDER_CHAIN_MIN_REFINED_DT_S && candidateDt < previousDt) {
        dtAttempts.push({ dt: candidateDt, factor });
        previousDt = candidateDt;
      }
    }
  }
  const privateSteps = [];
  let publication;
  let activeDt = baseDt;
  let activeFactor = 1;
  try {
    // The CPU encodes the requested count, never decides whether an interval
    // passed. GPU rejection restores state and holds the accepted clock.
    // When adaptive dt refinement is enabled and an entire batch is rejected
    // solely by explicit mechanics/CFL admission (error === 1), cleanly retire
    // the unaccepted attempt before spatial publication and retry with a new
    // clock segment at dyadically refined dt.
    for (let attemptIndex = 0; attemptIndex < dtAttempts.length; attemptIndex++) {
      const { dt: attemptDt, factor } = dtAttempts[attemptIndex];
      const isFirstAttempt = attemptIndex === 0;
      const isLastAttempt = attemptIndex === dtAttempts.length - 1;
      activeDt = attemptDt;
      activeFactor = factor;
      const attemptForceInputs = attemptDt === forceInputs.dt
        ? forceInputs
        : { ...forceInputs, dt: attemptDt };
      let current = {
        sphParticleState: args.sphParticleState,
        mlsMpmParticleState: args.mlsMpmParticleState,
        nextParticleUploads: {
          sphParticleUpload: args.sphParticleUpload,
          mlsMpmParticleUpload: args.mlsMpmParticleUpload
        }
      };
      for (let index = 0; index < effectiveStepCount; index++) {
        const next = await runSchroederSpatialChainStepWebGpu({
          ...args, mechanicsLevels, classificationPolicy, forceInputs: attemptForceInputs, mechanicsOptions,
          ...current.nextParticleUploads,
          sphParticleState: current.sphParticleState,
          mlsMpmParticleState: current.mlsMpmParticleState,
          sourceFamilyConsumerLease: index === 0 ? args.sourceFamilyConsumerLease ?? null : null,
          prebuiltSpatialEpoch: isFirstAttempt && index === 0 ? args.prebuiltInitialSpatialEpoch ?? null : null,
          spatialEpochLaneId,
          spatialEpochDirectArenaCount,
          allowClockSegmentReset: index === 0 && allowAdaptiveDtRefinement,
          device,
          closureOptions: isFirstAttempt && index === 0
            ? closureOptions
            : (closureOptions.phaseSlotRefinement ? { ...closureOptions, phaseSlotRefinement: null } : closureOptions),
          retainForPublication: index === effectiveStepCount - 1
        });
        privateSteps.push(next);
        current = next;
      }
      publication = await publishSchroederSpatialChainBatchWebGpu({
        device,
        finalStep: privateSteps.at(-1),
        abortIfAcceptedBelow: allowAdaptiveDtRefinement && !isLastAttempt ? effectiveStepCount : 0
      });
      if (publication.published === false && publication.status === 'incomplete-mechanics-rejection') {
        const after = device.queue.onSubmittedWorkDone().then(() => true);
        await after;
        for (const privateStep of [...privateSteps].reverse()) await privateStep.retire(Promise.resolve(true));
        // Drain any burst-parked deferInBurst cleanups (finite-wall / parcel /
        // exact-mass source borrows) so the untouched original source owners
        // are completely released before retrying from the same batch origin.
        for (let drain = 0; drain < 2; drain++) {
          flushWorkerQueueSubmitBurst(device, 'chain-retry-retire');
          await device.queue.onSubmittedWorkDone();
          await Promise.resolve();
          await Promise.resolve();
        }
        privateSteps.length = 0;
        publication = null;
        const nextAttempt = dtAttempts[attemptIndex + 1];
        onAdaptiveRetryAttempt?.({ rejectedDt: attemptDt, nextDt: nextAttempt.dt, factor: nextAttempt.factor });
        continue;
      }
      break;
    }
    const accepted = publication.clockReceipt.acceptedStepCount;
    if (accepted > effectiveStepCount) throw new Error('Resident chain accepted more intervals than it executed');
    const clock = Object.freeze({
      ...publication.clockReceipt,
      dtSeconds: activeDt,
      baseDtSeconds: baseDt,
      refinedDtFactor: activeFactor,
      fineSubstepsPerCoarseStep: subcyclePlan.fineSubstepsPerCoarseStep,
      subcyclePlan,
      attemptedBatchStepCount: effectiveStepCount,
      acceptedBatchStepCount: accepted,
      rejectedBatchStepCount: effectiveStepCount - accepted
    });
    const finalStep = {
      schema:abi.ULG_MLS_MPM_GPU_RESIDENT_STEP_SCHEMA, backend:'webgpu',
      status:'schroeder-chain-resident-step-executed', step:clock.step, time:clock.time,
      dtSeconds:activeDt, sequence:clock.step,
      nextParticleUploads:publication.nextParticleUploads,
      nextParticleCount:publication.nextParticleUploads.sphParticleUpload.particleCount,
      schroederSpatialSuccessorSourceFamily:publication.publication.sourceFamily,
      nextParticleBufferMode:'gpu-resident-retained', residentContinuationReady:true,
      fullParticleReadbackFree:true, fullParticleReadbackPerformed:false, readbackMode:'no-full-readback',
      renderStateReadbackAvailable:false, residentBuffersRetained:true,
      continuationAvailable:true, continuedFromResidentState:true, stateManagerCommitted:false,
      residentSourceMode:'retained-gpu-particle-uploads',
      // The terminal map precedes final classification. Do not claim that it
      // completed the later queue work; normal same-device ordering applies.
      queueCompletionStatus:'queue-submitted', queueCompletionMethod:'queue.submit',
      readbackTelemetryComplete:false, readbackTelemetryUnknownSources:['chain-stage-aggregate'],
      chainClockReceipt:clock,
      particlePingPong:{sourceSlot:args.sphParticleUpload?.slot ?? 0,
        nextSlot:publication.nextParticleUploads.sphParticleUpload.slot ?? 0}
    };
    residentSteps.set(finalStep,{device,resolveFamily,publication,privateSteps,clock,retiring:false,retirement:null});
    return {
      schema:abi.ULG_MLS_MPM_GPU_RESIDENT_STEPS_EXECUTION_SCHEMA, backend:'webgpu',
      status:'resident-steps-executed', stepCount, attemptedStepCount:stepCount,
      completedStepCount:accepted, rejectedStepCount:stepCount - accepted,
      finalStep, retainedSteps:[], retainedIntermediateStepCount:0,
      nextSphParticleState:publication.sphParticleState, nextMlsMpmParticleState:publication.mlsMpmParticleState,
      nextParticleUploads:publication.nextParticleUploads,
      nextResidentProductMass:publication.nextParticleUploads.residentProductMass ?? null,
      readbackMode:'no-full-readback', requestedReadbackMode:'no-full-readback',
      fullParticleReadbackFree:true, fullParticleReadbackPerformed:false, residentContinuationReady:true,
      continuationAvailable:true, continuedFromResidentState:true,
      residentSourceMode:'retained-gpu-particle-uploads', stateManagerCommitted:false,
      readbackTelemetryComplete:false, readbackTelemetryUnknownSources:['chain-stage-aggregate'],
      chainClockReceipt:clock
    };
  } catch (error) {
    flushWorkerQueueSubmitBurst(device, 'chain-batch-error-cleanup');
    const after = device.queue.onSubmittedWorkDone().then(() => true);
    error.residentSequenceCleanupCompletion = (async () => {
      await after;
      if (publication) await publication.retire(after);
      for (const privateStep of privateSteps.reverse()) await privateStep.retire(after);
    })();
    try { await error.residentSequenceCleanupCompletion; }
    catch (cleanupError) { error.residentSequenceCleanupError = cleanupError; }
    throw error;
  }
}
