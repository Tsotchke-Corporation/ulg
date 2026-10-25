import { createSphMlsMpmKernelBundleLoader } from './sphMlsMpmKernelBundleLoader.js';
import { runMlsMpmMechanicsRefreshWithOptionalWebGpu,
  runMlsMpmMechanicsRefreshWebGpu,
  resolveMlsMpmMechanicsRefreshSourceCapture } from './sphMechanicsRefreshGpuKernel.js';
import {
  retainedPhaseCarrierTransferOutputBuffers,
  runSphPhaseCarrierTransferWebGpu,
  resolveSphPhaseCarrierTransferSourceCapture
} from './sphPhaseCarrierTransferGpu.js';
import { createResidentProductMassHandle } from './sphReactionGpuSummary.js';
import { deferSubmittedWorkCleanup } from '../webgpuComputeLayout.js';
import {
  validateSchroederSpatialEpochTransactionSourceFamily
} from './schroederSpatialEpochTransaction.js';
import {
  releasePostSeparationThermalBinAuthorityAfterQueue
} from './sphPostSeparationThermalBinAuthority.js';
import {
  createGpuReadbackTelemetryAccumulator
} from './sphGpuReadbackTelemetry.js';
import {
  residentProductMassDevice,
  webGpuBufferMatchesDevice
} from './sphGpuDeviceIdentity.js';
import {
  resolveResidentProductEventCountAuthority,
  productEventLiveCountCopyDescriptor,
  validateProductEventLiveCountCopyDescriptor
} from './sphResidentProductHistoryGpu.js';
import {
  runSphAerosolCondensateExtractionWebGpu,
  prepareSphAerosolCondensateTransition,
  discardSphAerosolCondensateExtraction,
  discardSphAerosolCondensateTransition,
  releaseSphAerosolParcelRead,
  validateSphAerosolParcelRead,
  forkSphAerosolParcelRead
} from './sphAerosolParcelGpu.js';
import {
  sphAerosolSourceFamily,
  acquireSphAerosolSpatialParcelRead,
  bindSphAerosolSpatialContinuation
} from './sphAerosolSpatialBinding.js';
import { ensureSphGpuParticleBufferSetBorrowLifecycle,
  sphGpuParticleUploadAdvertisesExactMass, sphGpuParticleUploadAdvertisesDispersedMediumOptics } from './sphGpuBuffers.js';
import { validateSchroederSpatialEpochGenerationLevelAssignment } from './schroederSpatialEpochGpu.js';

// SS source authentication imports this closure through the aerosol binding.
// Eager stage imports would cycle back into the thermal proposal module before
// its protocol constants initialize. Cache module resolution, not GPU state or
// authority; actual callers still execute the same generalized stage kernels.
const loadThermalKernel = createSphMlsMpmKernelBundleLoader(
  () => import('./sphThermalGpuKernel.js')
);
const loadReactionKernel = createSphMlsMpmKernelBundleLoader(
  () => import('./sphReactionGpuKernel.js')
);
const loadProductHistoryMerger = createSphMlsMpmKernelBundleLoader(
  () => import('./sphMlsMpmGpuStep.js')
);
async function runSphThermalStepWebGpu(options) {
  return (await loadThermalKernel()).runSphThermalStepWebGpu(options);
}
async function runSphReactionStepWebGpu(options) {
  return (await loadReactionKernel()).runSphReactionStepWebGpu(options);
}

export const ULG_MLS_MPM_POST_MECHANICS_CLOSURE_SCHEMA =
  'peercompute.ulg.mls-mpm-post-mechanics-closure.v1';
export const ULG_MLS_MPM_TERMINAL_PARTICLE_FAMILY_SCHEMA =
  'peercompute.ulg.mls-mpm-terminal-particle-family.v0';

export const MLS_MPM_POST_MECHANICS_CLOSURE_STAGE_ORDER = Object.freeze([
  'schroeder-far-force-delta-fusion',
  'thermal-phase',
  'reaction-discovery',
  'reaction-product',
  'phase-carrier-transfer-v2',
  'mechanics-constitutive-refresh'
]);
const CONDENSATE_CLOSURE_STAGE_ORDER = Object.freeze(
  MLS_MPM_POST_MECHANICS_CLOSURE_STAGE_ORDER.flatMap((stage) => (
    stage === 'phase-carrier-transfer-v2'
      ? ['pending-condensate-extraction', stage]
      : [stage]
  ))
);

const NO_FULL_READBACK_MODE = 'no-full-readback';
const POST_MECHANICS_COMPONENTS = Object.freeze([
  'state',
  'thermo',
  'mechanics'
]);
const POST_MECHANICS_CLOSURE_AUTHORITIES = new WeakMap();
const MLS_MPM_TERMINAL_PARTICLE_FAMILIES = new WeakSet();
const POST_MECHANICS_GAS_READS = new WeakMap();
const GAS_SOURCE_EPOCH_FIELDS = Object.freeze(['storageGeneration', 'physicsTick', 'physicsSubstep',
  'positionEpoch', 'topologyEpoch', 'chartEpoch', 'levelEpoch', 'supportEpoch']);

function gasSourceError(message) {
  return postMechanicsClosureError(message, 'ERR_MLS_MPM_POST_MECHANICS_GAS_SOURCE');
}

function validateCapturedExactMass(authority) {
  const capture = authority.exactMassCapture;
  if (!capture || capture.released) throw new TypeError('Closure has no live exact inventory capture');
  capture.g2p.validate();
  for (const seal of capture.seals) seal.validate();
  const [thermal, refresh] = capture.seals;
  if (capture.seals.length !== 2 || capture.stageNames.join(',') !== 'thermalStep,mechanicsRefresh'
      || thermal.inputs.sourceStateBuffer !== capture.g2p.stateBuffer
      || thermal.inputs.sourceThermoBuffer !== capture.g2p.thermoBuffer
      || refresh.inputs.sourceStateBuffer !== thermal.output.stateBuffer
      || refresh.inputs.sourceThermoBuffer !== thermal.output.thermoBuffer
      || refresh.inputs.sourceMechanicsBuffer !== capture.g2p.mechanicsBuffer
      || authority.closure.continuation !== authority.continuation
      || authority.continuation.stateBuffer !== thermal.output.stateBuffer
      || authority.continuation.thermoBuffer !== thermal.output.thermoBuffer
      || authority.continuation.mechanicsBuffer !== refresh.output.mechanicsBuffer
      || authority.continuation.residentProductMass != null) {
    throw new TypeError('Exact inventory requires the unchanged genuine G2P/thermal/refresh chain');
  }
  return capture;
}

export function resolveMlsMpmPostMechanicsExactMassContinuation(closure, claim, nextParticleUploads) {
  const authority = closureAuthorityFor(closure);
  if (!validateMlsMpmPostMechanicsContinuationClaim(closure, claim, { nextParticleUploads })) {
    throw new TypeError('Exact inventory requires the original claimed continuation');
  }
  const capture = validateCapturedExactMass(authority);
  return Object.freeze({ sourceRead: capture.g2p.sourceRead,
    sourceSphUpload: capture.g2p.sourceSphUpload ?? capture.g2p.sourceRead.sourceSphUpload,
    sourceMlsUpload: capture.g2p.sourceMlsUpload,
    transaction: authority.transaction, generation: authority.generation });
}

function releaseExactMassCapture(capture) {
  if (!capture || capture.released) return false;
  capture.released = true;
  for (const seal of capture.seals) seal.release();
  capture.g2p?.release();
  return true;
}

export function releaseMlsMpmPostMechanicsExactMassCapture(closure) {
  return releaseExactMassCapture(closureAuthorityFor(closure).exactMassCapture);
}

function validateCapturedGasSource(authority) {
  const capture = authority.gasSourceCapture;
  const packet = capture?.packet;
  if (!packet || authority.closure.continuation !== authority.continuation
      || authority.closure.residentProductMass !== packet.residentProductMass
      || authority.continuation.residentProductMass !== packet.residentProductMass
      || authority.continuation.stateBuffer !== packet.stateBuffer
      || authority.continuation.thermoBuffer !== packet.thermoBuffer
      || authority.continuation.mechanicsBuffer !== packet.mechanicsBuffer) {
    throw gasSourceError('Closure has no unchanged captured current gas source');
  }
  for (const seal of capture.seals) seal.validate();
  capture.mergeValidate?.();
  for (const [object, snapshot] of capture.sourceSnapshots) {
    for (const [key, value] of Object.entries(snapshot)) {
      if (object[key] !== value) throw gasSourceError(`Captured source changed ${key}`);
    }
  }
  if (packet.productCountDescriptor && !validateProductEventLiveCountCopyDescriptor(
    packet.productCountDescriptor, { handle: packet.residentProductMass, device: authority.device })) {
    throw gasSourceError('Captured full product history was changed or retired');
  }
  if (capture.aerosolRead && !validateSphAerosolParcelRead(capture.aerosolRead, {
    device: authority.device, family: packet.aerosolFamily,
    expectedGeneration: capture.aerosolRead.generation
  })) throw gasSourceError('Captured aerosol owner read is no longer valid');
  return capture;
}

function releaseGasCapturePins(authority) {
  const capture = authority.gasSourceCapture;
  if (!capture || capture.pinsReleased) return;
  capture.pinsReleased = true;
  for (const seal of capture.seals) seal.release();
  capture.mergeRelease?.();
  capture.originalUploadRelease?.();
  if (capture.aerosolRead) releaseSphAerosolParcelRead(capture.aerosolRead);
}

/** Source provenance only: no kinetic rate, physical exchange interval or
 * successor publication is authorized by this private one-shot owner read. */
export function acquireMlsMpmPostMechanicsGasSourceRead(closure, { device } = {}) {
  const authority = closureAuthorityFor(closure);
  if (authority.device !== device || authority.claimReceipt || authority.retirementMode
      || authority.gasSourceCapture?.readIssued) {
    throw gasSourceError('Current closure source cannot be acquired after claim, retirement or a prior read');
  }
  const capture = authority.gasSourceCapture;
  if (!capture) throw gasSourceError('Closure did not capture a current gas source');
  // Reserve before resolving any public fields: a getter must not recursively
  // issue a second read or claim/retire the closure during admission.
  capture.readIssued = true;
  capture.activeReads += 1;
  try {
    validateCapturedGasSource(authority);
    const aerosolRead = capture.aerosolRead ? forkSphAerosolParcelRead(capture.aerosolRead, {
      device, family: capture.packet.aerosolFamily, expectedGeneration: capture.aerosolRead.generation
    }) : null;
    const read = Object.freeze({ schema: 'peercompute.ulg.post-mechanics-gas-source-read.v0' });
    const packet = Object.freeze({ ...capture.packet, aerosolRead });
    POST_MECHANICS_GAS_READS.set(read, { authority, packet, aerosolRead,
      released: false, drained: false, releasePromise: null });
    return read;
  } catch (error) {
    capture.activeReads -= 1;
    capture.readIssued = false;
    throw error;
  }
}

export function resolveMlsMpmPostMechanicsGasSourceRead(read, { device } = {}) {
  const record = POST_MECHANICS_GAS_READS.get(read);
  if (!record || record.released || record.authority.device !== device) {
    throw gasSourceError('Unknown, copied, released or wrong-device current closure read');
  }
  validateCapturedGasSource(record.authority);
  if (record.aerosolRead && !validateSphAerosolParcelRead(record.aerosolRead, {
    device, family: record.packet.aerosolFamily, expectedGeneration: record.aerosolRead.generation
  })) throw gasSourceError('Current closure aerosol read was changed or released');
  if (record.released) throw gasSourceError('Current closure read ended during resolution');
  return record.packet;
}

export function releaseMlsMpmPostMechanicsGasSourceReadAfterQueue(read, { device } = {}) {
  const record = POST_MECHANICS_GAS_READS.get(read);
  if (!record || record.authority.device !== device) throw gasSourceError('Unknown current closure read release');
  if (record.releasePromise) return record.releasePromise;
  record.released = true;
  let finishRelease;
  record.releasePromise = new Promise((resolve) => { finishRelease = resolve; });
  // Logical release is immediate. No source owner is unpinned by a rejected or
  // missing fence; a live device then stays quarantined until confirmed loss.
  const loss = device?.lost?.then ? Promise.resolve(device.lost).then(
    () => true, () => new Promise(() => {})) : new Promise(() => {});
  let fence;
  try { fence = device.queue?.onSubmittedWorkDone?.(); } catch { fence = null; }
  const confirmed = fence?.then ? Promise.resolve(fence).then(
    () => true, () => loss) : loss;
  Promise.race([confirmed, loss]).then(() => {
    if (record.aerosolRead) releaseSphAerosolParcelRead(record.aerosolRead);
    record.drained = true;
    record.authority.gasSourceCapture.activeReads -= 1;
    finishRelease(true);
  });
  return record.releasePromise;
}

function retainedStageSource(stage) {
  return stage?.result || stage || null;
}

function componentOwnershipValue(source, component, buffer) {
  if (!buffer) return false;
  const property = `owns${component[0].toUpperCase()}${component.slice(1)}Buffer`;
  if (typeof source?.[property] === 'boolean') return source[property];
  const declared = source?.componentOwnership?.[component]
    ?? source?.bufferOwnership?.[component];
  if (typeof declared === 'boolean') return declared;
  if (declared === 'borrowed' || declared === 'external') return false;
  if (declared === 'owned' || declared === 'producer') return true;
  // Retained stage outputs are producer-owned unless the runner explicitly
  // marks an aliased/borrowed component. Input upload families never pass
  // through this helper when closure ownership is computed.
  return true;
}

function componentOwnershipFields(source, components) {
  return Object.fromEntries(components.map((component) => {
    const buffer = source?.[`${component}Buffer`] || null;
    return [
      `owns${component[0].toUpperCase()}${component.slice(1)}Buffer`,
      componentOwnershipValue(source, component, buffer)
    ];
  }));
}

export function phaseCarrierPlanReady(plan) {
  return plan?.status === 'phase-lane-capacity-ready'
    || plan?.status === 'phase-companion-capacity-ready';
}

export function retainedG2pOutputBuffers(g2pReconstruction) {
  const source = g2pReconstruction?.gpuResult || g2pReconstruction;
  return {
    stateBuffer: source?.stateBuffer || null,
    mechanicsBuffer: source?.mechanicsBuffer || null,
    stateBufferByteLength: source?.stateBufferByteLength || 0,
    mechanicsBufferByteLength: source?.mechanicsBufferByteLength || 0,
    destroyOutputParticleBuffers: source?.destroyOutputParticleBuffers || null,
    destroyOutputParticleBufferComponents:
      source?.destroyOutputParticleBufferComponents || null,
    postSeparationThermalBinAuthority:
      source?.postSeparationThermalBinAuthority || null,
    ...componentOwnershipFields(source, ['state', 'mechanics'])
  };
}

export function retainedSchroederFarForceDeltaFusionOutputBuffers(
  schroederFarForceDeltaFusion
) {
  const source = schroederFarForceDeltaFusion?.result
    || schroederFarForceDeltaFusion;
  return {
    stateBuffer: source?.stateBuffer || source?.outputStateBuffer || null,
    stateBufferByteLength: source?.stateBufferByteLength || 0,
    destroyOutputParticleBuffers: source?.destroyOutputParticleBuffers || null,
    destroyOutputParticleBufferComponents:
      source?.destroyOutputParticleBufferComponents || null,
    ...componentOwnershipFields(source, ['state'])
  };
}

export function retainedThermalOutputBuffers(thermalStep) {
  const source = thermalStep?.result || thermalStep;
  return {
    stateBuffer: source?.stateBuffer || null,
    thermoBuffer: source?.thermoBuffer || null,
    stateBufferByteLength: source?.stateBufferByteLength || 0,
    thermoBufferByteLength: source?.thermoBufferByteLength || 0,
    destroyOutputParticleBuffers: source?.destroyOutputParticleBuffers || null,
    destroyOutputParticleBufferComponents:
      source?.destroyOutputParticleBufferComponents || null,
    queueOrderedRetainedOutputFinalConsumerCapability:
      source?.queueOrderedRetainedOutputFinalConsumerCapability ?? null,
    ...componentOwnershipFields(source, ['state', 'thermo'])
  };
}

export function residentProductMassFromReactionStep(reactionStep) {
  const source = reactionStep?.result || reactionStep;
  return source?.residentProductMass
    || createResidentProductMassHandle(source?.reactionSummary || null);
}

export function retainedReactionOutputBuffers(reactionStep) {
  const source = reactionStep?.result || reactionStep;
  const residentProductMass = residentProductMassFromReactionStep(reactionStep);
  return {
    stateBuffer: source?.stateBuffer || null,
    thermoBuffer: source?.thermoBuffer || null,
    mechanicsBuffer: source?.mechanicsBuffer || null,
    stateBufferByteLength: source?.stateBufferByteLength || 0,
    thermoBufferByteLength: source?.thermoBufferByteLength || 0,
    mechanicsBufferByteLength: source?.mechanicsBufferByteLength || 0,
    residentProductMass,
    destroyOutputParticleBuffers: source?.destroyOutputParticleBuffers || null,
    destroyOutputParticleBufferComponents:
      source?.destroyOutputParticleBufferComponents || null,
    queueOrderedRetainedOutputFinalConsumerCapability:
      source?.queueOrderedRetainedOutputFinalConsumerCapability ?? null,
    ...componentOwnershipFields(source, ['state', 'thermo', 'mechanics'])
  };
}

export function retainedMechanicsRefreshOutputBuffers(mechanicsRefreshStep) {
  const source = mechanicsRefreshStep?.result || mechanicsRefreshStep;
  return {
    mechanicsBuffer: source?.mechanicsBuffer || null,
    mechanicsBufferByteLength: source?.mechanicsBufferByteLength || 0,
    destroyOutputParticleBuffers: source?.destroyOutputParticleBuffers || null,
    destroyOutputParticleBufferComponents:
      source?.destroyOutputParticleBufferComponents || null,
    ...componentOwnershipFields(source, ['mechanics'])
  };
}

function nonzeroSummaryValue(value, tolerance = 1e-12) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && Math.abs(numeric) > tolerance;
}

export function reactionOutputComponentMutations(reactionStep) {
  const reactionResult = reactionStep?.result || reactionStep;
  if (!reactionResult) {
    return Object.freeze({
      state: false,
      thermo: false,
      mechanics: false,
      any: false,
      complete: false,
      summarySuppressed: false
    });
  }
  const available = {
    state: Boolean(reactionResult.stateBuffer),
    thermo: Boolean(reactionResult.thermoBuffer),
    mechanics: Boolean(reactionResult.mechanicsBuffer)
  };
  if (!Object.values(available).some(Boolean)) {
    return Object.freeze({
      ...available,
      any: false,
      complete: false,
      summarySuppressed: false
    });
  }
  const summary = reactionResult.reactionSummary || null;
  const summaryMutates = !summary?.reactionSummaryAvailable || [
    summary.changedMaterialCount,
    summary.changedMassCount,
    summary.visibleProductMassKg,
    summary.visibleGasProductMassKg,
    summary.outputGasPhaseMassKg,
    summary.canonicalReactionEventCount,
    summary.consumedReactantMassKg,
    summary.expectedProductMassKg,
    summary.rawProductMassKg,
    summary.ledgerVisibleProductMassKg,
    summary.ledgerUnplacedProductMassKg,
    summary.ledgerGasProductMassKg,
    summary.ledgerVisibleGasProductMassKg,
    summary.ledgerUnplacedGasProductMassKg,
    summary.sealedBoxGasProductMoles,
    summary.reactionHeatJ,
    summary.ledgerReadyEventCount,
    summary.ledgerProblemEventCount,
    summary.productEventActiveEventCount
  ].some((value) => nonzeroSummaryValue(value));
  const mutations = {
    state: summaryMutates && available.state,
    thermo: summaryMutates && available.thermo,
    mechanics: summaryMutates && available.mechanics
  };
  return Object.freeze({
    ...mutations,
    any: Object.values(mutations).some(Boolean),
    complete: Object.values(mutations).every(Boolean),
    summarySuppressed: !summaryMutates
  });
}

export function reactionOutputMutatesParticles(reactionStep) {
  return reactionOutputComponentMutations(reactionStep).any;
}

export function selectMlsMpmTerminalParticleFamily({
  sphParticleState = null,
  sphParticleUpload = null,
  g2pReconstruction = null,
  schroederFarForceDeltaFusion = null,
  schroederParticleStorageAdoption = null,
  thermalStep = null,
  reactionStep = null,
  mechanicsRefreshStep = null,
  phaseCarrierTransferStep = null
} = {}) {
  const g2p = retainedG2pOutputBuffers(g2pReconstruction);
  const farForce = retainedSchroederFarForceDeltaFusionOutputBuffers(
    schroederFarForceDeltaFusion
  );
  const thermal = retainedThermalOutputBuffers(thermalStep);
  const reaction = retainedReactionOutputBuffers(reactionStep);
  const mechanicsRefresh = retainedMechanicsRefreshOutputBuffers(
    mechanicsRefreshStep
  );
  const phase = retainedPhaseCarrierTransferOutputBuffers(
    phaseCarrierTransferStep
  );
  const phaseCarrierFamilySelected = Boolean(
    phase.stateBuffer && phase.thermoBuffer && phase.mechanicsBuffer
  );
  const storage = !phaseCarrierFamilySelected
    && schroederParticleStorageAdoption?.adopted === true
    ? schroederParticleStorageAdoption
    : null;
  const reactionMutations = reactionOutputComponentMutations(reactionStep);
  const sourceThermoBuffer = sphParticleUpload?.status === 'webgpu-uploaded'
    ? sphParticleUpload.thermoBuffer ?? null
    : null;
  const stateBuffer = (
    (phaseCarrierFamilySelected ? phase.stateBuffer : null)
    || storage?.stateBuffer
    || (reactionMutations.state ? reaction.stateBuffer : null)
    || thermal.stateBuffer
    || farForce.stateBuffer
    || g2p.stateBuffer
    || null
  );
  const thermoBuffer = (
    (phaseCarrierFamilySelected ? phase.thermoBuffer : null)
    || storage?.thermoBuffer
    || (reactionMutations.thermo ? reaction.thermoBuffer : null)
    || thermal.thermoBuffer
    || sourceThermoBuffer
    || null
  );
  const mechanicsBuffer = (
    storage?.mechanicsBuffer
    || mechanicsRefresh.mechanicsBuffer
    || (phaseCarrierFamilySelected ? phase.mechanicsBuffer : null)
    || (reactionMutations.mechanics ? reaction.mechanicsBuffer : null)
    || g2p.mechanicsBuffer
    || null
  );
  const sourceParticleCount = Number(sphParticleState?.particleCount);
  const particleCount = Number(
    storage?.authoritativeParticleCount ?? sourceParticleCount
  );
  const ready = Boolean(
    stateBuffer
    && thermoBuffer
    && mechanicsBuffer
    && Number.isSafeInteger(sourceParticleCount)
    && sourceParticleCount >= 0
    && Number.isSafeInteger(particleCount)
    && particleCount >= 0
  );
  const stateSource = phaseCarrierFamilySelected
    ? 'phase-carrier-transfer-v2'
    : (storage
      ? 'schroeder-particle-storage-materialization'
      : (reactionMutations.state && reaction.stateBuffer
        ? 'reaction-product'
        : (thermal.stateBuffer
          ? 'thermal-phase'
          : (farForce.stateBuffer
            ? 'schroeder-far-force-delta-fusion'
            : 'g2p'))));
  const thermoSource = phaseCarrierFamilySelected
    ? 'phase-carrier-transfer-v2'
    : (storage
      ? 'schroeder-particle-storage-materialization'
      : (reactionMutations.thermo && reaction.thermoBuffer
        ? 'reaction-product'
        : (thermal.thermoBuffer ? 'thermal-phase' : 'source-thermo-buffer')));
  const mechanicsSource = storage
    ? 'schroeder-particle-storage-materialization'
    : (mechanicsRefresh.mechanicsBuffer
      ? 'mechanics-constitutive-refresh'
      : (phaseCarrierFamilySelected
        ? 'phase-carrier-transfer-v2'
        : (reactionMutations.mechanics && reaction.mechanicsBuffer
          ? 'reaction-product'
          : 'g2p')));
  const family = Object.freeze({
    schema: ULG_MLS_MPM_TERMINAL_PARTICLE_FAMILY_SCHEMA,
    status: ready
      ? 'mls-mpm-terminal-particle-family-ready'
      : 'mls-mpm-terminal-particle-family-incomplete',
    ready,
    sourceParticleCount,
    particleCount,
    cardinalityPreserved: particleCount === sourceParticleCount,
    phaseCarrierFamilySelected,
    schroederParticleStorageSelected: Boolean(storage),
    reactionMutations,
    stateBuffer,
    thermoBuffer,
    mechanicsBuffer,
    stateSource,
    thermoSource,
    mechanicsSource
  });
  MLS_MPM_TERMINAL_PARTICLE_FAMILIES.add(family);
  return family;
}

export function isMlsMpmTerminalParticleFamily(family) {
  return Boolean(
    family
    && Object.isFrozen(family)
    && MLS_MPM_TERMINAL_PARTICLE_FAMILIES.has(family)
    && family.schema === ULG_MLS_MPM_TERMINAL_PARTICLE_FAMILY_SCHEMA
  );
}

export function destroyReactionOutputAfterFailedMechanicsRefresh(reactionStep) {
  const source = reactionStep?.result || reactionStep;
  if (!source) return false;
  if (typeof source.destroyOutputParticleBuffers === 'function') {
    source.destroyOutputParticleBuffers();
    return true;
  }
  const buffers = new Set([
    source.stateBuffer,
    source.thermoBuffer,
    source.mechanicsBuffer
  ].filter(Boolean));
  for (const buffer of buffers) buffer.destroy?.();
  const residentProductMass = source.residentProductMass || null;
  residentProductMass?.destroyResidentProductMassBuffers?.();
  return buffers.size > 0 || Boolean(residentProductMass);
}

function sameResidentProductMass(left, right) {
  if (!left || !right) return false;
  if (left === right) return true;
  return Boolean(
    left.productEventBuffer
    && left.productEventBuffer === right.productEventBuffer
  );
}

function exactResidentProductMassDeviceMatch(residentProductMass, device) {
  return Boolean(
    residentProductMass?.productEventBuffer
    && device
    && residentProductMassDevice(residentProductMass) === device
    && webGpuBufferMatchesDevice(
      residentProductMass.productEventBuffer,
      device
    )
  );
}

function authenticatedResidentProductMassGpuCount(
  residentProductMass,
  device
) {
  if (!exactResidentProductMassDeviceMatch(residentProductMass, device)) {
    return null;
  }
  return resolveResidentProductEventCountAuthority(
    residentProductMass,
    device
  );
}

function postMechanicsOwnedOutputFamilies({
  schroederFarForceDeltaFusion,
  thermalStep,
  reactionStep,
  mechanicsRefreshStep,
  phaseCarrierTransferStep,
  preservedBuffers = new Set()
}) {
  const far = retainedSchroederFarForceDeltaFusionOutputBuffers(
    schroederFarForceDeltaFusion
  );
  const thermal = retainedThermalOutputBuffers(thermalStep);
  const reaction = retainedReactionOutputBuffers(reactionStep);
  const mechanics = retainedMechanicsRefreshOutputBuffers(
    mechanicsRefreshStep
  );
  const phase = retainedPhaseCarrierTransferOutputBuffers(
    phaseCarrierTransferStep
  );
  const phaseSource = retainedStageSource(phaseCarrierTransferStep);
  const candidates = [
    {
      stage: 'schroeder-far-force-delta-fusion',
      output: far,
      components: [
        ['state', far.stateBuffer, far.ownsStateBuffer]
      ]
    },
    {
      stage: 'thermal-phase',
      output: thermal,
      components: [
        ['state', thermal.stateBuffer, thermal.ownsStateBuffer],
        ['thermo', thermal.thermoBuffer, thermal.ownsThermoBuffer]
      ]
    },
    {
      stage: 'reaction-product',
      output: reaction,
      residentProductMass: reaction.residentProductMass,
      components: [
        ['state', reaction.stateBuffer, reaction.ownsStateBuffer],
        ['thermo', reaction.thermoBuffer, reaction.ownsThermoBuffer],
        ['mechanics', reaction.mechanicsBuffer,
          reaction.ownsMechanicsBuffer]
      ]
    },
    {
      stage: 'mechanics-constitutive-refresh',
      output: mechanics,
      components: [
        ['mechanics', mechanics.mechanicsBuffer,
          mechanics.ownsMechanicsBuffer]
      ]
    },
    {
      stage: 'phase-carrier-transfer-v2',
      output: {
        ...phase,
        destroyOutputParticleBuffers:
          phaseSource?.destroyOutputParticleBuffers || null
      },
      components: [
        ['state', phase.stateBuffer,
          componentOwnershipValue(phaseSource, 'state', phase.stateBuffer)],
        ['thermo', phase.thermoBuffer,
          componentOwnershipValue(phaseSource, 'thermo', phase.thermoBuffer)],
        ['mechanics', phase.mechanicsBuffer,
          componentOwnershipValue(
            phaseSource,
            'mechanics',
            phase.mechanicsBuffer
          )]
      ]
    }
  ];
  return candidates.flatMap((candidate) => {
    const destroyOutputParticleBuffers =
      candidate.output?.destroyOutputParticleBuffers;
    const destroyOutputParticleBufferComponents =
      candidate.output?.destroyOutputParticleBufferComponents;
    if (
      typeof destroyOutputParticleBuffers !== 'function'
      && typeof destroyOutputParticleBufferComponents !== 'function'
    ) return [];
    const ownedComponents = candidate.components.filter(
      ([, buffer, owned]) => buffer && owned === true
    );
    const managedComponents = ownedComponents.filter(
      ([, buffer]) => !preservedBuffers.has(buffer)
    );
    const managedBuffers = [...new Set(managedComponents.map(([, buffer]) => buffer))];
    if (managedBuffers.length === 0) return [];
    const externallyPreservedComponents = ownedComponents.filter(
      ([, buffer]) => preservedBuffers.has(buffer)
    );
    return [Object.freeze({
      stage: candidate.stage,
      output: candidate.output,
      destroyOutputParticleBuffers,
      destroyOutputParticleBufferComponents,
      residentProductMass: candidate.residentProductMass || null,
      managedComponents: Object.freeze(managedComponents.map(
        ([component, buffer]) => Object.freeze({ component, buffer })
      )),
      managedBuffers: Object.freeze(managedBuffers),
      externallyPreservedComponents: Object.freeze(
        externallyPreservedComponents.map(
          ([component, buffer]) => Object.freeze({ component, buffer })
        )
      ),
      externallyPreservedBuffers: Object.freeze([...new Set(
        externallyPreservedComponents.map(([, buffer]) => buffer)
      )])
    })];
  });
}

function destroyFailedPostMechanicsStageOutputs({
  postMechanicsParticleBuffers,
  sphParticleUpload,
  mlsMpmParticleUpload,
  schroederFarForceDeltaFusion,
  thermalStep,
  reactionStep,
  mechanicsRefreshStep,
  phaseCarrierTransferStep,
  inputResidentProductMass,
  replacementResidentProductMass = null
}) {
  const cleanupReceipt = {
    schema: 'peercompute.ulg.mls-mpm-post-mechanics-failure-cleanup.v1',
    status: 'post-mechanics-failure-cleanup-running',
    releasedOwnerFamilyCount: 0,
    releasedComponentCount: 0,
    releasedResidentProductMassCount: 0,
    rawDestroyedBufferCount: 0,
    blockers: []
  };
  const pendingCompletions = [];
  const addBlocker = (blocker) => {
    if (!cleanupReceipt.blockers.includes(blocker)) {
      cleanupReceipt.blockers.push(blocker);
    }
  };
  const preserved = new Set([
    postMechanicsParticleBuffers?.stateBuffer,
    postMechanicsParticleBuffers?.mechanicsBuffer,
    sphParticleUpload?.stateBuffer,
    sphParticleUpload?.thermoBuffer,
    sphParticleUpload?.identityBuffer,
    mlsMpmParticleUpload?.mechanicsBuffer
  ].filter(Boolean));
  const far = retainedSchroederFarForceDeltaFusionOutputBuffers(
    schroederFarForceDeltaFusion
  );
  const thermal = retainedThermalOutputBuffers(thermalStep);
  const reaction = retainedReactionOutputBuffers(reactionStep);
  const mechanics = retainedMechanicsRefreshOutputBuffers(
    mechanicsRefreshStep
  );
  const phase = retainedPhaseCarrierTransferOutputBuffers(
    phaseCarrierTransferStep
  );
  const phaseSource = retainedStageSource(phaseCarrierTransferStep);
  const ownerFamilies = postMechanicsOwnedOutputFamilies({
    schroederFarForceDeltaFusion,
    thermalStep,
    reactionStep,
    mechanicsRefreshStep,
    phaseCarrierTransferStep,
    preservedBuffers: preserved
  });
  const familyManagedBuffers = new Set(ownerFamilies.flatMap(
    (family) => family.managedBuffers
  ));
  for (const family of ownerFamilies) {
    if (family.externallyPreservedBuffers.length > 0) {
      // A whole-family destroyer may own both a borrowed input alias and a
      // newly produced sibling. Retire only the unpreserved siblings through
      // an explicit component owner; raw destruction would bypass a pooled or
      // arena owner. If no component surface exists, publish a durable blocker
      // on the thrown failure instead of silently reporting cleanup success.
      if (typeof family.destroyOutputParticleBufferComponents !== 'function') {
        addBlocker(
          `preserved-alias-owner-lacks-component-retirement:${family.stage}`
        );
        continue;
      }
      const selection = Object.fromEntries(
        family.managedComponents.map(({ component }) => [component, true])
      );
      try {
        const release = family.destroyOutputParticleBufferComponents.call(
          family.output,
          selection
        );
        if (release?.then) {
          pendingCompletions.push(Promise.resolve(release).then(
            (confirmed) => {
              if (confirmed !== true) {
                addBlocker(
                  `component-owner-release-unconfirmed:${family.stage}`
                );
                return false;
              }
              cleanupReceipt.releasedComponentCount +=
                family.managedBuffers.length;
              return true;
            },
            (error) => {
              addBlocker(
                `component-owner-release-failed:${family.stage}:${error instanceof Error ? error.message : String(error)}`
              );
              return false;
            }
          ));
        } else if (release === false) {
          addBlocker(`component-owner-release-refused:${family.stage}`);
        } else {
          cleanupReceipt.releasedComponentCount += family.managedBuffers.length;
        }
      } catch (error) {
        addBlocker(
          `component-owner-release-failed:${family.stage}:${error instanceof Error ? error.message : String(error)}`
        );
      }
      continue;
    }
    try {
      const preserveResidentProductMass = Boolean(
        family.residentProductMass
        && sameResidentProductMass(
          family.residentProductMass,
          inputResidentProductMass
        )
      );
      const exactQueueOrderedFinalConsumer =
        family.output
          .queueOrderedRetainedOutputFinalConsumerCapability
        ?? null;
      const release = family.destroyOutputParticleBuffers.call(
        family.output,
        {
          preserveResidentProductMass,
          ...(exactQueueOrderedFinalConsumer == null
            ? {}
            : {
                queueOrderedFinalConsumer:
                  exactQueueOrderedFinalConsumer
              })
        }
      );
      if (release?.then) {
        pendingCompletions.push(Promise.resolve(release).then(
          (confirmed) => {
            if (confirmed === false) {
              addBlocker(`owner-family-release-refused:${family.stage}`);
              return false;
            }
            cleanupReceipt.releasedOwnerFamilyCount += 1;
            return true;
          },
          (error) => {
            addBlocker(
              `owner-family-release-failed:${family.stage}:${error instanceof Error ? error.message : String(error)}`
            );
            return false;
          }
        ));
      } else if (release === false) {
        addBlocker(`owner-family-release-refused:${family.stage}`);
      } else {
        cleanupReceipt.releasedOwnerFamilyCount += 1;
      }
    } catch (error) {
      // An owner-family failure must never fall through to raw member
      // destruction: bounded arenas and pooled outputs retain authority over
      // every member even when their release callback rejects cleanup.
      addBlocker(
        `owner-family-release-failed:${family.stage}:${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  const outputs = new Set([
    far.ownsStateBuffer && far.stateBuffer,
    thermal.ownsStateBuffer && thermal.stateBuffer,
    thermal.ownsThermoBuffer && thermal.thermoBuffer,
    reaction.ownsStateBuffer && reaction.stateBuffer,
    reaction.ownsThermoBuffer && reaction.thermoBuffer,
    reaction.ownsMechanicsBuffer && reaction.mechanicsBuffer,
    mechanics.ownsMechanicsBuffer && mechanics.mechanicsBuffer,
    componentOwnershipValue(phaseSource, 'state', phase.stateBuffer)
      && phase.stateBuffer,
    componentOwnershipValue(phaseSource, 'thermo', phase.thermoBuffer)
      && phase.thermoBuffer,
    componentOwnershipValue(phaseSource, 'mechanics', phase.mechanicsBuffer)
      && phase.mechanicsBuffer
  ].filter((buffer) => (
    buffer
    && !preserved.has(buffer)
    && !familyManagedBuffers.has(buffer)
  )));
  for (const buffer of outputs) {
    try {
      buffer.destroy?.();
      cleanupReceipt.rawDestroyedBufferCount += 1;
    } catch (error) {
      addBlocker(
        `raw-buffer-retirement-failed:${buffer?.label || 'unlabelled'}:${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  const emittedResidentProductMass = reaction.residentProductMass;
  if (
    emittedResidentProductMass
    && !ownerFamilies.some((family) => (
      family.residentProductMass
      && sameResidentProductMass(
        family.residentProductMass,
        emittedResidentProductMass
      )
    ))
    && !sameResidentProductMass(
      emittedResidentProductMass,
      inputResidentProductMass
    )
  ) {
    try {
      const productRelease =
        emittedResidentProductMass.destroyResidentProductMassBuffers?.();
      if (productRelease?.then) {
        pendingCompletions.push(Promise.resolve(productRelease).then(
          (confirmed) => {
            if (confirmed !== true) {
              addBlocker('resident-product-mass-release-unconfirmed');
              return false;
            }
            return true;
          },
          (error) => {
            addBlocker(
              `resident-product-mass-release-failed:${error instanceof Error ? error.message : String(error)}`
            );
            return false;
          }
        ));
      }
    } catch (error) {
      // A product-mass cleanup failure must not strand later output buffers.
      addBlocker(
        `resident-product-mass-release-failed:${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  if (replacementResidentProductMass) {
    const releaseReplacement =
      replacementResidentProductMass.destroyResidentProductMassBuffers;
    if (typeof releaseReplacement !== 'function') {
      addBlocker('replacement-resident-product-mass-lacks-retirement');
    } else {
      try {
        const replacementRelease = releaseReplacement.call(
          replacementResidentProductMass
        );
        if (replacementRelease?.then) {
          pendingCompletions.push(Promise.resolve(replacementRelease).then(
            (confirmed) => {
              if (confirmed === false) {
                addBlocker(
                  'replacement-resident-product-mass-release-refused'
                );
                return false;
              }
              cleanupReceipt.releasedResidentProductMassCount += 1;
              return true;
            },
            (error) => {
              addBlocker(
                `replacement-resident-product-mass-release-failed:${error instanceof Error ? error.message : String(error)}`
              );
              return false;
            }
          ));
        } else if (replacementRelease === false) {
          addBlocker('replacement-resident-product-mass-release-refused');
        } else {
          cleanupReceipt.releasedResidentProductMassCount += 1;
        }
      } catch (error) {
        addBlocker(
          `replacement-resident-product-mass-release-failed:${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }
  const finish = () => {
    cleanupReceipt.status = cleanupReceipt.blockers.length > 0
      ? 'post-mechanics-failure-cleanup-blocked'
      : 'post-mechanics-failure-cleanup-complete';
    return cleanupReceipt;
  };
  const completion = pendingCompletions.length > 0
    ? Promise.all(pendingCompletions).then(finish)
    : Promise.resolve(finish());
  Object.defineProperty(cleanupReceipt, 'completion', {
    value: completion,
    enumerable: false
  });
  return cleanupReceipt;
}

function retainedGenerationMetadata({
  sphParticleUpload,
  mlsMpmParticleUpload,
  schroederSpatialEpochGeneration
}) {
  const execution = schroederSpatialEpochGeneration?.execution || null;
  return Object.freeze({
    storageGeneration:
      sphParticleUpload?.storageGeneration
      ?? sphParticleUpload?.bufferFamilyGeneration
      ?? null,
    mechanicsStorageGeneration:
      mlsMpmParticleUpload?.storageGeneration
      ?? mlsMpmParticleUpload?.bufferFamilyGeneration
      ?? null,
    positionEpoch:
      sphParticleUpload?.positionEpoch ?? execution?.positionEpoch ?? null,
    topologyEpoch:
      sphParticleUpload?.topologyEpoch ?? execution?.topologyEpoch ?? null,
    chartEpoch: sphParticleUpload?.chartEpoch ?? execution?.chartEpoch ?? null,
    levelEpoch: sphParticleUpload?.levelEpoch ?? execution?.levelEpoch ?? null,
    supportEpoch:
      sphParticleUpload?.supportEpoch ?? execution?.supportEpoch ?? null,
    spatialGenerationId: execution?.generationId ?? null,
    spatialStorageGeneration: execution?.storageGeneration ?? null,
    spatialPhysicsTick: execution?.physicsTick ?? null,
    spatialPhysicsSubstep: execution?.physicsSubstep ?? null
  });
}

export function resolveMlsMpmPostMechanicsContinuation({
  postMechanicsParticleBuffers,
  sourceThermoBuffer = null,
  schroederFarForceDeltaFusion = null,
  thermalStep = null,
  reactionStep = null,
  mechanicsRefreshStep = null,
  phaseCarrierTransferStep = null,
  phaseCarrierPlan = null,
  inputResidentProductMass = null,
  sphParticleUpload = null,
  mlsMpmParticleUpload = null,
  schroederSpatialEpochGeneration = null
} = {}) {
  const g2pOutput = postMechanicsParticleBuffers || {};
  const farForceOutput =
    retainedSchroederFarForceDeltaFusionOutputBuffers(
      schroederFarForceDeltaFusion
    );
  const thermalOutput = retainedThermalOutputBuffers(thermalStep);
  const reactionOutput = retainedReactionOutputBuffers(reactionStep);
  const mechanicsRefreshOutput =
    retainedMechanicsRefreshOutputBuffers(mechanicsRefreshStep);
  const phaseCarrierOutput = retainedPhaseCarrierTransferOutputBuffers(
    phaseCarrierTransferStep
  );
  const phaseSource = retainedStageSource(phaseCarrierTransferStep);
  const reactionComponentMutations =
    reactionOutputComponentMutations(reactionStep);
  const select = (candidates) => candidates.find(({ buffer }) => buffer) || {
    stage: null,
    buffer: null,
    ownedByClosure: false
  };
  const selected = {
    state: select([
      {
        stage: 'phase-carrier-transfer-v2',
        buffer: phaseCarrierOutput.stateBuffer,
        ownedByClosure: componentOwnershipValue(
          phaseSource,
          'state',
          phaseCarrierOutput.stateBuffer
        )
      },
      {
        stage: 'reaction-product',
        buffer: reactionComponentMutations.state
          ? reactionOutput.stateBuffer
          : null,
        ownedByClosure: reactionOutput.ownsStateBuffer === true
      },
      {
        stage: 'thermal-phase',
        buffer: thermalOutput.stateBuffer,
        ownedByClosure: thermalOutput.ownsStateBuffer === true
      },
      {
        stage: 'schroeder-far-force-delta-fusion',
        buffer: farForceOutput.stateBuffer,
        ownedByClosure: farForceOutput.ownsStateBuffer === true
      },
      {
        stage: 'post-mechanics-input',
        buffer: g2pOutput.stateBuffer,
        ownedByClosure: false
      }
    ]),
    thermo: select([
      {
        stage: 'phase-carrier-transfer-v2',
        buffer: phaseCarrierOutput.thermoBuffer,
        ownedByClosure: componentOwnershipValue(
          phaseSource,
          'thermo',
          phaseCarrierOutput.thermoBuffer
        )
      },
      {
        stage: 'reaction-product',
        buffer: reactionComponentMutations.thermo
          ? reactionOutput.thermoBuffer
          : null,
        ownedByClosure: reactionOutput.ownsThermoBuffer === true
      },
      {
        stage: 'thermal-phase',
        buffer: thermalOutput.thermoBuffer,
        ownedByClosure: thermalOutput.ownsThermoBuffer === true
      },
      {
        stage: 'source-thermo-input',
        buffer: sourceThermoBuffer,
        ownedByClosure: false
      }
    ]),
    mechanics: select([
      {
        stage: 'mechanics-constitutive-refresh',
        buffer: mechanicsRefreshOutput.mechanicsBuffer,
        ownedByClosure: mechanicsRefreshOutput.ownsMechanicsBuffer === true
      },
      {
        stage: 'phase-carrier-transfer-v2',
        buffer: phaseCarrierOutput.mechanicsBuffer,
        ownedByClosure: componentOwnershipValue(
          phaseSource,
          'mechanics',
          phaseCarrierOutput.mechanicsBuffer
        )
      },
      {
        stage: 'reaction-product',
        buffer: reactionComponentMutations.mechanics
          ? reactionOutput.mechanicsBuffer
          : null,
        ownedByClosure: reactionOutput.ownsMechanicsBuffer === true
      },
      {
        stage: 'post-mechanics-input',
        buffer: g2pOutput.mechanicsBuffer,
        ownedByClosure: false
      }
    ])
  };
  const stateBuffer = selected.state.buffer;
  const thermoBuffer = selected.thermo.buffer;
  const mechanicsBuffer = selected.mechanics.buffer;
  const emittedResidentProductMass = reactionOutput.residentProductMass || null;
  const productMassMergeRequired = Boolean(
    inputResidentProductMass
    && emittedResidentProductMass
    && !sameResidentProductMass(
      inputResidentProductMass,
      emittedResidentProductMass
    )
  );
  const residentProductMass = productMassMergeRequired
    ? null
    : (emittedResidentProductMass || inputResidentProductMass || null);
  return Object.freeze({
    status: stateBuffer && thermoBuffer && mechanicsBuffer
      ? 'post-mechanics-continuation-ready'
      : 'post-mechanics-continuation-incomplete',
    ready: Boolean(stateBuffer && thermoBuffer && mechanicsBuffer),
    stateBuffer,
    thermoBuffer,
    mechanicsBuffer,
    phaseCarrierPlan,
    phaseCarrierPlanStatus: phaseCarrierPlan?.status ?? null,
    phaseCarrierTransferApplied: Boolean(
      phaseCarrierOutput.stateBuffer
      && phaseCarrierOutput.thermoBuffer
      && phaseCarrierOutput.mechanicsBuffer
    ),
    reactionMutatesParticles: reactionComponentMutations.any,
    reactionComponentMutations,
    componentSources: Object.freeze(Object.fromEntries(
      POST_MECHANICS_COMPONENTS.map((component) => [
        component,
        selected[component].stage
      ])
    )),
    componentOwnership: Object.freeze(Object.fromEntries(
      POST_MECHANICS_COMPONENTS.map((component) => [
        component,
        selected[component].ownedByClosure
          ? 'closure-owned-transfer'
          : 'borrowed-input'
      ])
    )),
    componentLineage: Object.freeze(Object.fromEntries(
      POST_MECHANICS_COMPONENTS.map((component) => [
        component,
        Object.freeze({ ...selected[component] })
      ])
    )),
    inputResidentProductMass,
    emittedResidentProductMass,
    residentProductMass,
    productMassMergeRequired,
    productMassStatus: productMassMergeRequired
      ? 'resident-product-mass-merge-required'
      : (residentProductMass
          ? 'resident-product-mass-ready-without-merge'
          : 'resident-product-mass-not-present'),
    generation: retainedGenerationMetadata({
      sphParticleUpload,
      mlsMpmParticleUpload,
      schroederSpatialEpochGeneration
    })
  });
}

function postMechanicsClosureError(message, code, ErrorType = Error) {
  const error = new ErrorType(message);
  error.code = code;
  return error;
}

function assertExactPostMechanicsSourceFamily({
  schroederSpatialEpochTransaction,
  schroederSpatialEpochGeneration,
  sphParticleUpload,
  mlsMpmParticleUpload,
  expectedEpochIdentity
}) {
  if (schroederSpatialEpochTransaction != null && (
    !validateSchroederSpatialEpochTransactionSourceFamily(
      schroederSpatialEpochTransaction,
      {
        generation: schroederSpatialEpochGeneration,
        sphParticleUpload,
        mlsMpmParticleUpload
      }
    )
  )) {
    throw postMechanicsClosureError(
      'Post-mechanics sidecars do not bind the exact transaction-owned terminal state family',
      'ERR_MLS_MPM_POST_MECHANICS_EPOCH_MISMATCH'
    );
  }
  const generationIdentity = schroederSpatialEpochGeneration?.execution || null;
  const expected = expectedEpochIdentity || (
    schroederSpatialEpochTransaction?.epochIdentity ?? null
  );
  if (expected) {
    for (const field of [
      'storageGeneration',
      'physicsTick',
      'physicsSubstep',
      'positionEpoch',
      'topologyEpoch',
      'chartEpoch',
      'levelEpoch',
      'supportEpoch'
    ]) {
      const expectedValue = expected[field];
      if (
        !Number.isInteger(expectedValue)
        || generationIdentity?.[field] !== expectedValue
        || sphParticleUpload?.[field] !== expectedValue
        || (field === 'storageGeneration'
          && mlsMpmParticleUpload?.[field] !== expectedValue)
      ) {
        throw postMechanicsClosureError(
          `Post-mechanics terminal source ${field} does not match its public spatial epoch`,
          'ERR_MLS_MPM_POST_MECHANICS_EPOCH_MISMATCH'
        );
      }
    }
  }
  const generationSource = schroederSpatialEpochGeneration?.source || null;
  const aggregateView = schroederSpatialEpochGeneration?.aggregateView || null;
  if (schroederSpatialEpochGeneration && (
    (generationSource?.sourceStateBuffer
      && generationSource.sourceStateBuffer !== sphParticleUpload?.stateBuffer)
    || (aggregateView && (
      aggregateView.sourceStateBuffer !== sphParticleUpload?.stateBuffer
      || aggregateView.sourceThermoBuffer !== sphParticleUpload?.thermoBuffer
      || aggregateView.sourceIdentityBuffer
        !== (sphParticleUpload?.identityBuffer ?? null)
    ))
  )) {
    throw postMechanicsClosureError(
      'Post-mechanics terminal buffers do not match the selected public spatial generation',
      'ERR_MLS_MPM_POST_MECHANICS_EPOCH_MISMATCH'
    );
  }
  return true;
}

function ownedPostMechanicsStageEntries({
  schroederFarForceDeltaFusion,
  thermalStep,
  reactionStep,
  mechanicsRefreshStep,
  phaseCarrierTransferStep,
  preservedBuffers
}) {
  const far = retainedSchroederFarForceDeltaFusionOutputBuffers(
    schroederFarForceDeltaFusion
  );
  const thermal = retainedThermalOutputBuffers(thermalStep);
  const reaction = retainedReactionOutputBuffers(reactionStep);
  const mechanics = retainedMechanicsRefreshOutputBuffers(
    mechanicsRefreshStep
  );
  const phase = retainedPhaseCarrierTransferOutputBuffers(
    phaseCarrierTransferStep
  );
  const phaseSource = retainedStageSource(phaseCarrierTransferStep);
  const entries = [
    ['schroeder-far-force-delta-fusion', 'state', far.stateBuffer,
      far.ownsStateBuffer],
    ['thermal-phase', 'state', thermal.stateBuffer, thermal.ownsStateBuffer],
    ['thermal-phase', 'thermo', thermal.thermoBuffer,
      thermal.ownsThermoBuffer],
    ['reaction-product', 'state', reaction.stateBuffer,
      reaction.ownsStateBuffer],
    ['reaction-product', 'thermo', reaction.thermoBuffer,
      reaction.ownsThermoBuffer],
    ['reaction-product', 'mechanics', reaction.mechanicsBuffer,
      reaction.ownsMechanicsBuffer],
    ['mechanics-constitutive-refresh', 'mechanics',
      mechanics.mechanicsBuffer, mechanics.ownsMechanicsBuffer],
    ['phase-carrier-transfer-v2', 'state', phase.stateBuffer,
      componentOwnershipValue(phaseSource, 'state', phase.stateBuffer)],
    ['phase-carrier-transfer-v2', 'thermo', phase.thermoBuffer,
      componentOwnershipValue(phaseSource, 'thermo', phase.thermoBuffer)],
    ['phase-carrier-transfer-v2', 'mechanics', phase.mechanicsBuffer,
      componentOwnershipValue(
        phaseSource,
        'mechanics',
        phase.mechanicsBuffer
      )]
  ];
  return entries
    .filter(([, , buffer, owned]) => (
      buffer
      && owned === true
      && !preservedBuffers.has(buffer)
    ))
    .map(([stage, component, buffer]) => Object.freeze({
      stage,
      component,
      buffer
    }));
}

function registerPostMechanicsClosureAuthority(closure, {
  device,
  postMechanicsParticleBuffers,
  sphParticleUpload,
  mlsMpmParticleUpload,
  aerosolCondensateTransition = null,
  transaction = null,
  generation = null
}) {
  const preservedBuffers = new Set([
    postMechanicsParticleBuffers?.stateBuffer,
    postMechanicsParticleBuffers?.mechanicsBuffer,
    sphParticleUpload?.stateBuffer,
    sphParticleUpload?.thermoBuffer,
    sphParticleUpload?.identityBuffer,
    mlsMpmParticleUpload?.mechanicsBuffer
  ].filter(Boolean));
  const entries = ownedPostMechanicsStageEntries({
    schroederFarForceDeltaFusion:
      closure.schroederFarForceDeltaFusion,
    thermalStep: closure.thermalStep,
    reactionStep: closure.reactionStep,
    mechanicsRefreshStep: closure.mechanicsRefreshStep,
    phaseCarrierTransferStep: closure.phaseCarrierTransferStep,
    preservedBuffers
  });
  const ownedBuffers = new Map();
  for (const entry of entries) {
    if (!ownedBuffers.has(entry.buffer)) ownedBuffers.set(entry.buffer, []);
    ownedBuffers.get(entry.buffer).push(entry);
  }
  const ownedFamilies = postMechanicsOwnedOutputFamilies({
    schroederFarForceDeltaFusion:
      closure.schroederFarForceDeltaFusion,
    thermalStep: closure.thermalStep,
    reactionStep: closure.reactionStep,
    mechanicsRefreshStep: closure.mechanicsRefreshStep,
    phaseCarrierTransferStep: closure.phaseCarrierTransferStep,
    preservedBuffers
  });
  const authority = {
    device,
    closure,
    continuation: closure.continuation,
    residentProductEventBuffer: closure.continuation.residentProductMass?.productEventBuffer ?? null,
    aerosolCondensateTransition,
    transaction,
    generation,
    ownedBuffers,
    ownedFamilies,
    destroyedBuffers: new Set(),
    releasedFamilies: new Set(),
    retiredFamilyBuffers: new Map(),
    claimReceipt: null,
    retirementMode: null,
    retirementPromise: null,
    retirementReceipt: null,
    retirementFailureReason: null
  };
  POST_MECHANICS_CLOSURE_AUTHORITIES.set(closure, authority);
  return authority;
}

function closureAuthorityFor(closure) {
  const authority = POST_MECHANICS_CLOSURE_AUTHORITIES.get(closure);
  if (!authority) {
    throw postMechanicsClosureError(
      'Unknown or structurally copied post-mechanics closure',
      'ERR_MLS_MPM_POST_MECHANICS_FOREIGN_CLOSURE'
    );
  }
  return authority;
}

function continuationBuffersFromClaimInput({
  nextParticleUploads,
  stateBuffer,
  thermoBuffer,
  mechanicsBuffer
}) {
  return {
    stateBuffer: nextParticleUploads?.sphParticleUpload?.stateBuffer
      ?? stateBuffer
      ?? null,
    thermoBuffer: nextParticleUploads?.sphParticleUpload?.thermoBuffer
      ?? thermoBuffer
      ?? null,
    mechanicsBuffer:
      nextParticleUploads?.mlsMpmParticleUpload?.mechanicsBuffer
      ?? mechanicsBuffer
      ?? null
  };
}

function continuationEnvelopeProductMass(nextParticleUploads) {
  const descriptor = Object.getOwnPropertyDescriptor(nextParticleUploads, 'residentProductMass');
  if ((!descriptor && 'residentProductMass' in nextParticleUploads)
      || (descriptor && !Object.hasOwn(descriptor, 'value'))) {
    throw postMechanicsClosureError('Continuation resident product history must be an own data property',
      'ERR_MLS_MPM_POST_MECHANICS_CLAIM_MISMATCH');
  }
  return descriptor?.value ?? null;
}

function continuationClaimEnvelopeMatches(authority, nextParticleUploads) {
  const claim = authority.claimReceipt;
  if ((claim?.nextParticleUploads ?? null) !== (nextParticleUploads ?? null)) return false;
  // Legacy raw-buffer claims retain their component ownership semantics; they
  // do not attest an envelope/history pair and cannot later become one.
  if (nextParticleUploads == null) return true;
  return nextParticleUploads.sphParticleUpload === claim.sphParticleUpload
    && nextParticleUploads.mlsMpmParticleUpload === claim.mlsMpmParticleUpload
    && nextParticleUploads.sphParticleUpload?.stateBuffer === claim.stateBuffer
    && nextParticleUploads.sphParticleUpload?.thermoBuffer === claim.thermoBuffer
    && nextParticleUploads.mlsMpmParticleUpload?.mechanicsBuffer === claim.mechanicsBuffer
    && continuationEnvelopeProductMass(nextParticleUploads) === claim.residentProductMass
    && claim.residentProductMass === authority.continuation.residentProductMass
    && (claim.residentProductMass?.productEventBuffer ?? null) === authority.residentProductEventBuffer;
}

/**
 * Positively transfer the selected component family to one continuation.
 * Replaying the exact same claim is idempotent; a copied or different family
 * is rejected.
 */
export function claimMlsMpmPostMechanicsContinuation(
  closure,
  {
    nextParticleUploads = null,
    stateBuffer = null,
    thermoBuffer = null,
    mechanicsBuffer = null
  } = {}
) {
  const authority = closureAuthorityFor(closure);
  if (authority.exactMassCapture && !authority.claimReceipt) {
    if (!nextParticleUploads) throw new TypeError('Exact inventory requires a complete continuation envelope');
    validateCapturedExactMass(authority);
  }
  if (authority.gasSourceCapture?.activeReads > 0) {
    throw gasSourceError('A current closure source read still pins the continuation');
  }
  const continuation = authority.continuation;
  const claimed = continuationBuffersFromClaimInput({
    nextParticleUploads,
    stateBuffer,
    thermoBuffer,
    mechanicsBuffer
  });
  const exact = closure.continuation === continuation
    && continuation?.ready === true
    && claimed.stateBuffer === continuation.stateBuffer
    && claimed.thermoBuffer === continuation.thermoBuffer
    && claimed.mechanicsBuffer === continuation.mechanicsBuffer
    && (nextParticleUploads == null
      || (continuation.productMassMergeRequired !== true
        && nextParticleUploads.sphParticleUpload?.stateBuffer === claimed.stateBuffer
        && nextParticleUploads.sphParticleUpload?.thermoBuffer === claimed.thermoBuffer
        && nextParticleUploads.mlsMpmParticleUpload?.mechanicsBuffer === claimed.mechanicsBuffer
        && (continuation.residentProductMass?.productEventBuffer ?? null) === authority.residentProductEventBuffer
        && continuationEnvelopeProductMass(nextParticleUploads) === continuation.residentProductMass));
  if (!exact) {
    throw postMechanicsClosureError(
      'Post-mechanics continuation claim does not match the selected component family',
      'ERR_MLS_MPM_POST_MECHANICS_CLAIM_MISMATCH'
    );
  }
  if (authority.claimReceipt) {
    if (!continuationClaimEnvelopeMatches(authority, nextParticleUploads)) {
      throw postMechanicsClosureError('Continuation cannot be reclaimed by another envelope or a changed history',
        'ERR_MLS_MPM_POST_MECHANICS_CLAIM_MISMATCH');
    }
    return authority.claimReceipt;
  }
  const components = Object.freeze(Object.fromEntries(
    POST_MECHANICS_COMPONENTS.map((component) => {
      const buffer = claimed[`${component}Buffer`];
      const closureOwned = authority.ownedBuffers.has(buffer);
      return [component, Object.freeze({
        buffer,
        source: continuation.componentSources[component],
        closureOwned,
        ownership: closureOwned
          ? 'transferred-from-closure'
          : 'retained-by-existing-owner'
      })];
    })
  ));
  authority.claimReceipt = Object.freeze({
    schema: 'peercompute.ulg.mls-mpm-post-mechanics-continuation-claim.v1',
    status: 'post-mechanics-continuation-claimed',
    closure,
    continuation,
    nextParticleUploads,
    sphParticleUpload: nextParticleUploads?.sphParticleUpload ?? null,
    mlsMpmParticleUpload: nextParticleUploads?.mlsMpmParticleUpload ?? null,
    residentProductMass: continuation.residentProductMass,
    carrierProductPairAuthenticated: nextParticleUploads != null,
    aerosolCondensateTransition: authority.aerosolCondensateTransition,
    stateBuffer: claimed.stateBuffer,
    thermoBuffer: claimed.thermoBuffer,
    mechanicsBuffer: claimed.mechanicsBuffer,
    components,
    transferredOwnedComponentCount: POST_MECHANICS_COMPONENTS.filter(
      (component) => components[component].closureOwned
    ).length
  });
  if (authority.aerosolCondensateTransition) {
    try {
      bindSphAerosolSpatialContinuation({
        transition: authority.aerosolCondensateTransition, closure,
        claim: authority.claimReceipt, nextParticleUploads, device: authority.device,
        transaction: authority.transaction, generation: authority.generation
      });
    } catch (error) {
      authority.claimReceipt = null;
      discardSphAerosolCondensateTransition(authority.aerosolCondensateTransition);
      throw error;
    }
  }
  releaseGasCapturePins(authority);
  return authority.claimReceipt;
}

/** Failure-side cleanup only. After actual outer publication this is a no-op;
 * the successor source-family/lane, not the discarded step, owns the aerosol.
 */
export function abandonMlsMpmPostMechanicsCondensate(closure) {
  const authority = closureAuthorityFor(closure);
  return authority.aerosolCondensateTransition
    ? discardSphAerosolCondensateTransition(authority.aerosolCondensateTransition)
    : false;
}

export function validateMlsMpmPostMechanicsContinuationClaim(
  closure,
  claimReceipt,
  options = {}
) {
  try {
    const authority = closureAuthorityFor(closure);
    if (authority.claimReceipt !== claimReceipt) return false;
    const claimed = continuationBuffersFromClaimInput(options);
    return claimReceipt?.closure === closure
      && claimReceipt?.continuation === authority.continuation
      && closure.continuation === authority.continuation
      && continuationClaimEnvelopeMatches(authority, options.nextParticleUploads)
      && claimReceipt.aerosolCondensateTransition === authority.aerosolCondensateTransition
      && claimReceipt?.stateBuffer === claimed.stateBuffer
      && claimReceipt?.thermoBuffer === claimed.thermoBuffer
      && claimReceipt?.mechanicsBuffer === claimed.mechanicsBuffer;
  } catch {
    return false;
  }
}

/**
 * Retire only closure-owned buffers that were not adopted by the positive
 * continuation claim. The exact same retirement call is replay-safe.
 */
export function retireMlsMpmPostMechanicsClosureOutputsAfter(
  closure,
  {
    after,
    abandon = false,
    queueOrderedFinalConsumer = null
  } = {}
) {
  const authority = closureAuthorityFor(closure);
  if (authority.gasSourceCapture?.activeReads > 0) {
    throw gasSourceError('A current closure source read still pins closure retirement');
  }
  const requestedAbandon = abandon === true;
  if (
    authority.retirementMode
    && authority.retirementMode.abandon !== requestedAbandon
  ) {
    throw postMechanicsClosureError(
      'Post-mechanics output retirement cannot change abandon/preserve mode across retries',
      'ERR_MLS_MPM_POST_MECHANICS_RETIREMENT_MODE'
    );
  }
  if (authority.retirementReceipt) return Promise.resolve(
    authority.retirementReceipt
  );
  if (authority.retirementPromise) return authority.retirementPromise;
  if (!after || typeof after.then !== 'function') {
    throw postMechanicsClosureError(
      'Post-mechanics output retirement requires an exact owner fence',
      'ERR_MLS_MPM_POST_MECHANICS_RETIREMENT_FENCE',
      TypeError
    );
  }
  if (!authority.claimReceipt && !requestedAbandon) {
    throw postMechanicsClosureError(
      'Post-mechanics output retirement requires a positive continuation claim or explicit abandonment',
      'ERR_MLS_MPM_POST_MECHANICS_RETIREMENT_AUTHORITY'
    );
  }
  if (!authority.retirementMode) {
    authority.retirementMode = Object.freeze({
      abandon: requestedAbandon,
      preserved: Object.freeze(requestedAbandon
        ? []
        : [
            authority.claimReceipt.stateBuffer,
            authority.claimReceipt.thermoBuffer,
            authority.claimReceipt.mechanicsBuffer
          ].filter(Boolean))
    });
  }
  const retirementMode = authority.retirementMode;
  if (requestedAbandon) abandonMlsMpmPostMechanicsCondensate(closure);
  const preserved = new Set(retirementMode.preserved);
  authority.retirementFailureReason = null;
  const attempt = Promise.resolve(after).then(async (confirmed) => {
    if (confirmed !== true) {
      throw postMechanicsClosureError(
        'Post-mechanics output owner fence was not confirmed',
        'ERR_MLS_MPM_POST_MECHANICS_RETIREMENT_FENCE'
      );
    }
    releaseGasCapturePins(authority);
    releaseExactMassCapture(authority.exactMassCapture);
    const failures = [];
    if (requestedAbandon && authority.gasSourceCapture?.mergeRetire
        && !authority.gasSourceCapture.mergeRetired) {
      try {
        await authority.gasSourceCapture.mergeRetire();
        authority.gasSourceCapture.mergeRetired = true;
      } catch (error) { failures.push(error); }
    }
    const familyManagedBuffers = new Set();
    const familyPreservedBuffers = new Set();
    for (const family of authority.ownedFamilies) {
      for (const buffer of family.managedBuffers) {
        familyManagedBuffers.add(buffer);
      }
      if (authority.releasedFamilies.has(family)) continue;
      let retiredFamilyBuffers = authority.retiredFamilyBuffers.get(family);
      if (!retiredFamilyBuffers) {
        retiredFamilyBuffers = new Set();
        authority.retiredFamilyBuffers.set(family, retiredFamilyBuffers);
      }
      const pendingManagedComponents = family.managedComponents.filter(
        ({ buffer }) => !retiredFamilyBuffers.has(buffer)
      );
      const preservedManagedComponents = pendingManagedComponents.filter(
        ({ buffer }) => preserved.has(buffer)
      );
      const preservesResidentProductMass = Boolean(
        retirementMode.abandon !== true
        && family.residentProductMass
        && sameResidentProductMass(
          family.residentProductMass,
          closure.continuation?.residentProductMass
        )
      );
      if (preservesResidentProductMass) {
        for (const { buffer } of pendingManagedComponents) {
          familyPreservedBuffers.add(buffer);
        }
        continue;
      }
      const requiresComponentRetirement =
        family.externallyPreservedBuffers.length > 0
        || preservedManagedComponents.length > 0;
      if (requiresComponentRetirement) {
        for (const buffer of family.externallyPreservedBuffers) {
          familyPreservedBuffers.add(buffer);
        }
        for (const { buffer } of preservedManagedComponents) {
          familyPreservedBuffers.add(buffer);
        }
        const retirableComponents = pendingManagedComponents.filter(
          ({ buffer }) => !preserved.has(buffer)
        );
        if (retirableComponents.length === 0) continue;
        if (
          typeof family.destroyOutputParticleBufferComponents !== 'function'
        ) {
          failures.push(postMechanicsClosureError(
            `Post-mechanics ${family.stage} owner cannot retire unpreserved siblings beside a preserved alias`,
            'ERR_MLS_MPM_POST_MECHANICS_COMPONENT_RETIREMENT'
          ));
          continue;
        }
        try {
          const selection = Object.fromEntries(
            retirableComponents.map(({ component }) => [component, true])
          );
          const released = await Promise.resolve(
            family.destroyOutputParticleBufferComponents.call(
              family.output,
              selection
            )
          );
          if (released !== true) {
            throw postMechanicsClosureError(
              `Post-mechanics ${family.stage} owner refused component retirement`,
              'ERR_MLS_MPM_POST_MECHANICS_COMPONENT_RETIREMENT'
            );
          }
          for (const { buffer } of retirableComponents) {
            retiredFamilyBuffers.add(buffer);
            authority.destroyedBuffers.add(buffer);
          }
        } catch (error) {
          failures.push(error);
        }
        continue;
      }
      try {
        const queueOrderedProducerFamily =
          family.stage === 'reaction-product'
            ? 'reaction-product'
            : (
                family.stage === 'thermal-phase'
                  ? 'thermal-output'
                  : (
                      family.stage
                        === 'phase-carrier-transfer-v2'
                        ? 'sph-phase-carrier-output'
                        : null
                    )
              );
        const exactQueueOrderedFinalConsumer =
          queueOrderedProducerFamily
            ? family.output
              .queueOrderedRetainedOutputFinalConsumerCapability
              ?? null
            : null;
        const released = await Promise.resolve(
          family.destroyOutputParticleBuffers.call(
            family.output,
            exactQueueOrderedFinalConsumer
              ? {
                  queueOrderedFinalConsumer:
                    exactQueueOrderedFinalConsumer
                }
              : undefined
          )
        );
        if (released === false) {
          throw postMechanicsClosureError(
            `Post-mechanics ${family.stage} owner refused family retirement`,
            'ERR_MLS_MPM_POST_MECHANICS_FAMILY_RETIREMENT'
          );
        }
        for (const buffer of family.managedBuffers) {
          authority.destroyedBuffers.add(buffer);
          retiredFamilyBuffers.add(buffer);
        }
        authority.releasedFamilies.add(family);
      } catch (error) {
        failures.push(error);
      }
    }
    for (const buffer of authority.ownedBuffers.keys()) {
      if (
        preserved.has(buffer)
        || familyManagedBuffers.has(buffer)
        || authority.destroyedBuffers.has(buffer)
      ) {
        continue;
      }
      try {
        buffer.destroy?.();
        authority.destroyedBuffers.add(buffer);
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length > 0) {
      throw failures.length === 1
        ? failures[0]
        : new AggregateError(
          failures,
          'Post-mechanics component retirement was incomplete'
        );
    }
    authority.retirementReceipt = Object.freeze({
      schema: 'peercompute.ulg.mls-mpm-post-mechanics-retirement.v1',
      status: retirementMode.abandon === true
        ? 'post-mechanics-closure-abandoned'
        : 'post-mechanics-superseded-components-retired',
      closure,
      claimReceipt: authority.claimReceipt,
      abandoned: retirementMode.abandon === true,
      destroyedBufferCount: authority.destroyedBuffers.size,
      preservedBufferCount: new Set([
        ...preserved,
        ...familyPreservedBuffers
      ]).size,
      ownerFamilyCount: authority.ownedFamilies.length,
      preservedOwnerFamilyBufferCount: familyPreservedBuffers.size
    });
    return authority.retirementReceipt;
  }).then(
    (receipt) => {
      authority.retirementPromise = null;
      return receipt;
    },
    (error) => {
      authority.retirementFailureReason = error instanceof Error
        ? error.message
        : String(error);
      authority.retirementPromise = null;
      throw error;
    }
  );
  authority.retirementPromise = attempt;
  return attempt;
}

/**
 * Run the shared retained-buffer closure after any mechanics implementation.
 * The caller owns canonical spatial proposal lifecycle and supplies stage
 * hooks so proposal release/accounting remains ordered between thermal and
 * reaction exactly as it is in the resident step.
 */
export async function runMlsMpmPostMechanicsClosureWebGpu({
  device,
  sphParticleState,
  mlsMpmParticleState,
  sphParticleUpload,
  mlsMpmParticleUpload,
  postMechanicsParticleBuffers,
  postMechanicsG2pResult = null,
  postMechanicsBackend = 'webgpu',
  schroederFarAggregateForceApplication = null,
  schroederFarForceDeltaFusionRunner = null,
  thermalMaterialTable = null,
  thermalStepRunner = runSphThermalStepWebGpu,
  thermalStepOptions = {},
  reactionTable = null,
  reactionStepRunner = runSphReactionStepWebGpu,
  reactionStepOptions = {},
  reactionParticleBinMetadataReadback = false,
  mechanicsMaterialTable = null,
  mechanicsRefreshRunner = runMlsMpmMechanicsRefreshWithOptionalWebGpu,
  mechanicsRefreshOptions = {},
  phaseCarrierTransferRunner = runSphPhaseCarrierTransferWebGpu,
  phaseCarrierTransferOptions = {},
  condensateExtraction = null,
  captureGasSource = false,
  gasSourceLevelAssignment = null,
  boxDimsM,
  dtSeconds,
  preferWebGpu = true,
  readbackMode,
  thermalResponseGraphUpload = null,
  schroederSpatialEpochGeneration = null,
  schroederSpatialEpochTransaction = null,
  expectedEpochIdentity = null,
  schroederSpatialThermalProposal = null,
  schroederSpatialReactionDiscoveryProposal = null,
  spatialReactionDiscoveryProposalRunner = null,
  schroederLawQueue = null,
  schroederLawNeighborCandidates = null,
  reactionLawInputsQuarantined = false,
  inputResidentProductMass = null,
  residentProductMassMergeRunner = null,
  gpuTimestampRecorder = null,
  timedStage = async (_stage, runStage) => runStage(),
  afterThermalStep = null,
  afterReactionDiscoveryProposal = null,
  beforeReactionStep = null,
  // Opt-in per-stage mechanics snapshots. Off by default: each snapshot is an
  // extra submit plus a fixed-size map, which serializes this stage pipeline.
  // See sphStageMechanicsTracer.js for why aggregate evidence alone cannot say
  // which stage wrote a lane.
  stageMechanicsTracer = null,
  afterReactionStep = null,
  afterPhaseCarrierTransfer = null,
  queueOrderedProducerClaims = []
} = {}) {
  if (!postMechanicsParticleBuffers || typeof postMechanicsParticleBuffers !== 'object') {
    throw new TypeError(
      'Post-mechanics closure requires retained post-mechanics particle buffers'
    );
  }
  if (
    schroederSpatialEpochTransaction != null
    || expectedEpochIdentity != null
  ) {
    assertExactPostMechanicsSourceFamily({
      schroederSpatialEpochTransaction,
      schroederSpatialEpochGeneration,
      sphParticleUpload,
      mlsMpmParticleUpload,
      expectedEpochIdentity
    });
  }
  if (schroederSpatialReactionDiscoveryProposal != null) {
    throw new TypeError(
      'Post-mechanics closure rejects prebuilt reaction discovery; canonical discovery must be issued after the thermal stage'
    );
  }
  const stageEligible = postMechanicsBackend === 'webgpu'
    && sphParticleUpload?.status === 'webgpu-uploaded';
  const exactMassRequested = sphGpuParticleUploadAdvertisesExactMass(sphParticleUpload);
  if (exactMassRequested && (!stageEligible || !preferWebGpu || readbackMode !== NO_FULL_READBACK_MODE
      || !thermalMaterialTable || !mechanicsMaterialTable || !postMechanicsG2pResult
      || reactionTable || inputResidentProductMass || condensateExtraction || captureGasSource
      || sphParticleState?.phaseCarrierPlan || sphParticleUpload.phaseCarrierPlan
      || mlsMpmParticleState?.phaseCarrierPlan || phaseCarrierTransferOptions.phaseCarrierPlan
      || schroederFarAggregateForceApplication || sphAerosolSourceFamily(sphParticleUpload)
      || sphGpuParticleUploadAdvertisesDispersedMediumOptics(sphParticleUpload))) {
    throw new TypeError('Exact inventory closure requires the preserving standard GPU chain; mass writers remain unadmitted');
  }
  const massCapture = exactMassRequested ? { seals: [], stageNames: [], g2p: null, released: false } : null;
  let gasCapture = null;
  if (captureGasSource === true) {
    if (condensateExtraction || (schroederFarAggregateForceApplication
        && typeof schroederFarForceDeltaFusionRunner === 'function')
        || !stageEligible || !preferWebGpu || readbackMode !== NO_FULL_READBACK_MODE
        || !Number.isFinite(dtSeconds) || !(dtSeconds > 0)
        || !schroederSpatialEpochTransaction
        || !validateSchroederSpatialEpochGenerationLevelAssignment(schroederSpatialEpochGeneration, {
          device, levelAssignment: gasSourceLevelAssignment, sphParticleUpload, mlsMpmParticleUpload
        })) {
      throw gasSourceError('Gas source capture requires exact current standard stages, original assignment and positive duration; pending extraction/far-force capture is unsupported');
    }
    const copyVector = (value) => {
      if ((!Array.isArray(value) && !ArrayBuffer.isView(value)) || value.length !== 3
          || !Array.from(value).every(Number.isFinite)) throw gasSourceError('Captured grid/box requires a finite vector3');
      return Object.freeze(Array.from(value));
    };
    const epochIdentity = Object.freeze(Object.fromEntries(GAS_SOURCE_EPOCH_FIELDS.map(
      (key) => [key, schroederSpatialEpochGeneration.execution[key]])));
    const sourceSnapshots = [];
    const snapshot = (object, keys) => sourceSnapshots.push([object,
      Object.freeze(Object.fromEntries(keys.map((key) => [key, object[key]])))]);
    snapshot(sphParticleUpload, [...GAS_SOURCE_EPOCH_FIELDS, 'stateBuffer', 'thermoBuffer', 'identityBuffer', 'particleCount', 'identityRevision']);
    snapshot(mlsMpmParticleUpload, ['storageGeneration', 'mechanicsBuffer', 'particleCount']);
    snapshot(sphParticleState, ['particleCount']);
    snapshot(mlsMpmParticleState, ['particleCount']);
    snapshot(schroederSpatialEpochGeneration.execution, GAS_SOURCE_EPOCH_FIELDS);
    const policyKeys = ['baseGridSpacingM', 'minLevel', 'maxLevel', 'targetSupportCells',
      'supportRadiusScale', 'chartId', 'minSupportRadiusM', 'maxSupportRadiusM',
      'fallbackSupportRadiusM', 'hysteresisBand'];
    snapshot(gasSourceLevelAssignment, policyKeys);
    const classificationPolicy = Object.freeze(Object.fromEntries(policyKeys.map(
      (key) => [key, gasSourceLevelAssignment[key]])));
    const mechanicsLevels = Object.freeze((schroederSpatialEpochGeneration.mechanicsLevelViews ?? []).map((view) => {
      const grid = view.mechanicsGrid ?? view.grid;
      if (!grid) throw gasSourceError('Captured spatial generation has no original mechanics grid');
      if (!Number.isInteger(grid.gridShift) || grid.gridShift < 0) throw gasSourceError('Captured grid shift must be an unsigned integer');
      return Object.freeze({ selectedLevel: view.selectedLevel, grid: Object.freeze({ ...grid,
        gridDims: copyVector(grid.gridDims), gridShift: grid.gridShift }) });
    }));
    const aerosolFamily = sphAerosolSourceFamily(sphParticleUpload);
    gasCapture = { seals: [], sourceSnapshots, activeReads: 0, readIssued: false, pinsReleased: false,
      aerosolRead: null, packet: null, mergeValidate: null, mergeRelease: null,
      metadata: { device, sphParticleState, mlsMpmParticleState,
        thermalMaterialTable, mechanicsMaterialTable, reactionTable,
        originalSphParticleUpload: sphParticleUpload, originalMlsMpmParticleUpload: mlsMpmParticleUpload,
        identityBuffer: sphParticleUpload.identityBuffer, particleCount: sphParticleUpload.particleCount,
        epochIdentity, dtSeconds, boxDimsM: copyVector(boxDimsM), classificationPolicy, mechanicsLevels,
        levelAssignment: gasSourceLevelAssignment, sourceGeneration: schroederSpatialEpochGeneration,
        sourceTransaction: schroederSpatialEpochTransaction, aerosolFamily,
        kineticsAdmitted: false, exchangeIntervalAdmitted: false, outerPublicationAdmitted: false } };
  }
  const completedCapturedStages = new Map();
  const capturedStage = async (name, runner, optionsForStage) => {
    const capture = gasCapture ?? massCapture;
    if (!capture) return timedStage(name, () => runner(optionsForStage()));
    let standard;
    let resolve;
    if (name === 'thermalStep') {
      const module = await loadThermalKernel();
      standard = runner === runSphThermalStepWebGpu || runner === module.runSphThermalStepWebGpu;
      resolve = module.resolveSphThermalSourceCapture;
    } else if (name === 'reactionStep') {
      const module = await loadReactionKernel();
      standard = runner === runSphReactionStepWebGpu || runner === module.runSphReactionStepWebGpu;
      resolve = module.resolveSphReactionSourceCapture;
    } else if (name === 'phaseCarrierTransfer') {
      standard = runner === runSphPhaseCarrierTransferWebGpu;
      resolve = resolveSphPhaseCarrierTransferSourceCapture;
    } else {
      standard = runner === runMlsMpmMechanicsRefreshWithOptionalWebGpu || runner === runMlsMpmMechanicsRefreshWebGpu;
      resolve = resolveMlsMpmMechanicsRefreshSourceCapture;
    }
    if (!standard) throw gasSourceError(`Captured ${name} requires its standard producer`);
    const token = Object.freeze({});
    let calls = 0;
    let actual = null;
    const selected = await timedStage(name, async () => {
      calls += 1;
      if (calls !== 1) throw gasSourceError(`Captured ${name} cannot be repeated`);
      const inputs = Object.freeze({ ...optionsForStage(), postMechanicsSourceCapture: token });
      actual = await runner(inputs);
      // Timing/diagnostic wrappers can reject after a genuine producer has
      // returned. Keep its cleanup owner before validating or returning it.
      completedCapturedStages.set(name, actual);
      const seal = resolve(actual, token);
      capture.seals.push(seal);
      capture.stageNames?.push(name);
      for (const [key, value] of Object.entries(seal.inputs)) {
        const expected = key === 'dtSeconds' && name === 'thermalStep' ? inputs.dtS : inputs[key];
        if (value !== expected) throw gasSourceError(`Captured ${name} effective ${key} mismatch`);
      }
      return actual;
    });
    if (calls !== 1 || actual == null || selected !== actual) throw gasSourceError(`Captured ${name} result was skipped or replaced`);
    return actual;
  };
  const executedStageOrder = [];
  let schroederFarForceDeltaFusion = null;
  let thermalStep = null;
  let resolvedSchroederSpatialReactionDiscoveryProposal = null;
  let reactionStep = null;
  let mechanicsRefreshStep = null;
  let phaseCarrierTransferStep = null;
  let phaseCarrierTransferFamilyReceipt = null;
  let aerosolCondensateTransition = null;
  let queueOrderedFinalConsumerCapability = null;
  let mechanicsQueueOrderedFinalConsumerCapability = null;
  let replacementResidentProductMass = null;
  const readbackTelemetry = createGpuReadbackTelemetryAccumulator({
    scope: 'mls-mpm-post-mechanics-closure'
  });
  const postSeparationThermalBinAuthority =
    postMechanicsParticleBuffers.postSeparationThermalBinAuthority ?? null;
  let postSeparationThermalBinReleaseScheduled = false;
  const releasePostSeparationThermalBins = () => {
    if (
      !postSeparationThermalBinAuthority
      || postSeparationThermalBinReleaseScheduled
    ) return false;
    postSeparationThermalBinReleaseScheduled =
      releasePostSeparationThermalBinAuthorityAfterQueue(
        postSeparationThermalBinAuthority,
        { device }
      ) === true;
    return postSeparationThermalBinReleaseScheduled;
  };
  try {
  if (massCapture) {
    const { acquireMlsMpmMechanicsExactMassCapture } = await import('./sphG2pGpuKernel.js');
    massCapture.g2p = await acquireMlsMpmMechanicsExactMassCapture(postMechanicsG2pResult, { device, sphParticleUpload,
      transaction: schroederSpatialEpochTransaction, generation: schroederSpatialEpochGeneration, dt: dtSeconds });
    if (massCapture.g2p.transaction !== schroederSpatialEpochTransaction
        || massCapture.g2p.generation !== schroederSpatialEpochGeneration
        || massCapture.g2p.dt !== dtSeconds) {
      throw new TypeError('Exact closure requires G2P from its original spatial transaction, generation and duration');
    }
    if (postMechanicsParticleBuffers.stateBuffer !== massCapture.g2p.stateBuffer
        || postMechanicsParticleBuffers.mechanicsBuffer !== massCapture.g2p.mechanicsBuffer) {
      throw new TypeError('Exact closure input differs from its genuine G2P output');
    }
  }
  if (gasCapture) {
    if (!ensureSphGpuParticleBufferSetBorrowLifecycle(sphParticleUpload)) {
      throw gasSourceError('Original identity upload has no live borrow owner');
    }
    const before = sphParticleUpload.__ulgActiveBorrowCount;
    sphParticleUpload.__ulgActiveBorrowCount = before + 1;
    if (sphParticleUpload.__ulgActiveBorrowCount !== before + 1) {
      throw gasSourceError('Original identity upload refused its current source borrow');
    }
    let originalBorrowHeld = true;
    gasCapture.originalUploadRelease = () => {
      if (!originalBorrowHeld) return false;
      originalBorrowHeld = false;
      sphParticleUpload.__ulgActiveBorrowCount = Math.max(0, sphParticleUpload.__ulgActiveBorrowCount - 1);
      return true;
    };
    gasCapture.aerosolRead = acquireSphAerosolSpatialParcelRead({
      device, transaction: schroederSpatialEpochTransaction,
      generation: schroederSpatialEpochGeneration, family: gasCapture.metadata.aerosolFamily
    });
  }
  if (
    schroederFarAggregateForceApplication
    && typeof schroederFarForceDeltaFusionRunner === 'function'
    && stageEligible
    && postMechanicsParticleBuffers.stateBuffer
  ) {
    schroederFarForceDeltaFusion = await timedStage(
      'schroederFarForceDeltaFusion',
      () => schroederFarForceDeltaFusionRunner({
        device,
        sphParticleState,
        sourceStateBuffer: postMechanicsParticleBuffers.stateBuffer,
        schroederFarAggregateForceApplication,
        retainOutputParticleBuffers: true,
        readbackMode
      })
    );
    executedStageOrder.push('schroeder-far-force-delta-fusion');
  }

  const farForceOutput = retainedSchroederFarForceDeltaFusionOutputBuffers(
    schroederFarForceDeltaFusion
  );
  const thermalSourceStateBuffer = farForceOutput.stateBuffer
    || postMechanicsParticleBuffers.stateBuffer;
  if (
    thermalMaterialTable
    && typeof thermalStepRunner === 'function'
    && stageEligible
    && thermalSourceStateBuffer
  ) {
    thermalStep = await capturedStage('thermalStep', thermalStepRunner, () => ({
      ...thermalStepOptions,
      ...(massCapture ? { exactMassG2pResult: postMechanicsG2pResult,
        exactMassSpatialEpochTransaction: schroederSpatialEpochTransaction,
        exactMassSpatialEpochGeneration: schroederSpatialEpochGeneration } : {}),
      device,
      sphParticleState,
      thermalMaterialTable,
      sphParticleUpload,
      proposalStateBuffer: thermalSourceStateBuffer,
      proposalThermoBuffer: sphParticleUpload?.thermoBuffer,
      sourceStateBuffer: thermalSourceStateBuffer,
      sourceThermoBuffer: sphParticleUpload?.thermoBuffer,
      boxDimsM,
      dtS: dtSeconds,
      retainOutputParticleBuffers: true,
      readbackMode,
      neighborBins: farForceOutput.stateBuffer
        ? null
        : postSeparationThermalBinAuthority,
      thermalResponseGraphUpload:
        thermalResponseGraphUpload
        || thermalStepOptions.thermalResponseGraphUpload
        || null,
      schroederSpatialEpochGeneration:
        schroederSpatialThermalProposal
          ? schroederSpatialEpochGeneration
          : null,
      schroederSpatialThermalProposal,
      gpuTimestampRecorder:
        thermalStepOptions.gpuTimestampRecorder || gpuTimestampRecorder
    }));
    executedStageOrder.push('thermal-phase');
  }
  const traceStageMechanics = async (stage, stateBuffer, thermoBuffer, mechanicsBuffer) => {
    if (typeof stageMechanicsTracer?.snapshot !== 'function') return;
    await stageMechanicsTracer.snapshot({
      stage,
      stateBuffer: stateBuffer || null,
      thermoBuffer: thermoBuffer || null,
      mechanicsBuffer: mechanicsBuffer || null
    });
  };
  // The closure's INPUT, before any of its stages run. Without this the trace
  // can only say the closure did not change a value, not whether the value
  // arrived already wrong.
  await traceStageMechanics(
    'post-mechanics-closure-input',
    postMechanicsParticleBuffers?.stateBuffer,
    sphParticleUpload?.thermoBuffer,
    postMechanicsParticleBuffers?.mechanicsBuffer
  );
  releasePostSeparationThermalBins();
  if (typeof afterThermalStep === 'function') {
    await afterThermalStep({
      thermalStep,
      thermalSourceStateBuffer,
      thermalSourceThermoBuffer: sphParticleUpload?.thermoBuffer ?? null
    });
  }

  const thermalOutput = retainedThermalOutputBuffers(thermalStep);
  // Thermal runs between the closure input and the reaction, and the h2 gas J
  // moves 0.1000 -> 0.0999 across that span, so the two are worth separating.
  await traceStageMechanics(
    'thermal-phase',
    thermalOutput.stateBuffer || postMechanicsParticleBuffers?.stateBuffer,
    thermalOutput.thermoBuffer || sphParticleUpload?.thermoBuffer,
    postMechanicsParticleBuffers?.mechanicsBuffer
  );
  const reactionSourceStateBuffer = thermalOutput.stateBuffer
    || farForceOutput.stateBuffer
    || postMechanicsParticleBuffers.stateBuffer;
  const reactionSourceThermoBuffer = thermalOutput.thermoBuffer
    || sphParticleUpload?.thermoBuffer;
  const reactionStageEligible = Boolean(
    reactionTable?.reactionCount > 0
    && thermalMaterialTable
    && stageEligible
    && reactionSourceStateBuffer
    && reactionSourceThermoBuffer
  );
  if (
    reactionStageEligible
    && schroederSpatialEpochGeneration
    && !resolvedSchroederSpatialReactionDiscoveryProposal
    && typeof spatialReactionDiscoveryProposalRunner === 'function'
  ) {
    resolvedSchroederSpatialReactionDiscoveryProposal = await timedStage(
      'spatialReactionDiscoveryProposal',
      () => spatialReactionDiscoveryProposalRunner({
        device,
        generation: schroederSpatialEpochGeneration,
        sphParticleState,
        sphParticleUpload,
        reactionTable,
        sourceStateBuffer: reactionSourceStateBuffer,
        sourceThermoBuffer: reactionSourceThermoBuffer,
        sourceMechanicsBuffer:
          postMechanicsParticleBuffers.mechanicsBuffer,
        // This proposal is the current schedule's pre-reaction mutation
        // input. The next-schedule shadow observation must instead sample the
        // exact post-transfer/post-refresh continuation, so it is encoded by
        // the owning resident route after this closure returns.
        reactionMotionEnvelope: null,
        captureActivationObservation: false,
        gpuTimestampRecorder
      })
    );
    if (resolvedSchroederSpatialReactionDiscoveryProposal?.ready !== true) {
      throw new Error(
        'Canonical post-thermal reaction discovery did not publish a complete authenticated stage'
      );
    }
    executedStageOrder.push('reaction-discovery');
  }
  if (typeof afterReactionDiscoveryProposal === 'function') {
    await afterReactionDiscoveryProposal({
      spatialReactionDiscoveryProposal:
        resolvedSchroederSpatialReactionDiscoveryProposal,
      thermalStep,
      sourceStateBuffer: reactionSourceStateBuffer,
      sourceThermoBuffer: reactionSourceThermoBuffer
    });
  }

  const reactionStageInputs = typeof beforeReactionStep === 'function'
    ? (await beforeReactionStep({
        thermalStep,
        spatialReactionDiscoveryProposal:
          resolvedSchroederSpatialReactionDiscoveryProposal
      })) || {}
    : {};
  const effectiveSchroederLawQueue = Object.hasOwn(
    reactionStageInputs,
    'schroederLawQueue'
  )
    ? reactionStageInputs.schroederLawQueue
    : schroederLawQueue;
  const effectiveSchroederLawNeighborCandidates = Object.hasOwn(
    reactionStageInputs,
    'schroederLawNeighborCandidates'
  )
    ? reactionStageInputs.schroederLawNeighborCandidates
    : schroederLawNeighborCandidates;
  const effectiveReactionLawInputsQuarantined = Object.hasOwn(
    reactionStageInputs,
    'reactionLawInputsQuarantined'
  )
    ? reactionStageInputs.reactionLawInputsQuarantined === true
    : reactionLawInputsQuarantined;

  if (
    reactionStageEligible
    && typeof reactionStepRunner === 'function'
    && postMechanicsParticleBuffers.mechanicsBuffer
  ) {
    const noFullReactionSummaryDefaults = readbackMode === NO_FULL_READBACK_MODE
      ? {
          readCompactReactionSummary: false,
          // Gas/product state remains resident. Host species summaries are
          // diagnostics and must be requested explicitly (for example only on
          // the final step of a resident sequence), never inferred per tick.
          readReactionGasSpeciesSummary: false,
          readReactionProductInventory: false,
          readReactionAtomResidual: false
        }
      : {};
    reactionStep = await capturedStage('reactionStep', reactionStepRunner, () => ({
      // Options tune the stage; the shared closure owns its source family,
      // material tables, physical interval and retained-output contract. Keep
      // the same precedence as thermal so the receipt describes the inputs
      // actually consumed, including the post-thermal discovery selection.
      ...noFullReactionSummaryDefaults,
      ...reactionStepOptions,
      device,
      sphParticleState,
      mlsMpmParticleState,
      reactionTable,
      thermalMaterialTable,
      sphParticleUpload,
      mlsMpmParticleUpload,
      sourceStateBuffer: reactionSourceStateBuffer,
      sourceThermoBuffer: reactionSourceThermoBuffer,
      sourceMechanicsBuffer: postMechanicsParticleBuffers.mechanicsBuffer,
      boxDimsM,
      retainOutputParticleBuffers: true,
      readbackMode,
      dtSeconds,
      schroederLawQueue: effectiveSchroederLawQueue,
      schroederLawNeighborCandidates:
        effectiveSchroederLawNeighborCandidates,
      gpuTimestampRecorder:
        reactionStepOptions.gpuTimestampRecorder || gpuTimestampRecorder,
      thermalResponseGraphUpload:
        thermalResponseGraphUpload
        || reactionStepOptions.thermalResponseGraphUpload
        || null,
      schroederSpatialEpochGeneration:
        resolvedSchroederSpatialReactionDiscoveryProposal
          ? schroederSpatialEpochGeneration
          : null,
      schroederSpatialReactionDiscoveryProposal:
        resolvedSchroederSpatialReactionDiscoveryProposal,
      ...(effectiveReactionLawInputsQuarantined ? {
        schroederLawQueue: null,
        schroederLawNeighborCandidates: null
      } : {}),
      requestQueueOrderedCleanupClaim:
        Boolean(resolvedSchroederSpatialReactionDiscoveryProposal),
      reactionParticleBinMetadataReadback:
        reactionParticleBinMetadataReadback === true
        || reactionStepOptions.reactionParticleBinMetadataReadback === true
    }));
    executedStageOrder.push('reaction-product');
  }
  if (typeof afterReactionStep === 'function') {
    await afterReactionStep({
      reactionStep,
      spatialReactionDiscoveryProposal:
        resolvedSchroederSpatialReactionDiscoveryProposal
    });
  }

  const reactionComponentMutations =
    reactionOutputComponentMutations(reactionStep);
  const reactionMutatesParticles = reactionComponentMutations.any;
  const reactionOutput = retainedReactionOutputBuffers(reactionStep);
  const thermalQueueOrderedClaims =
    retainedStageSource(thermalStep)?.queueOrderedCleanupClaims
    ?? [
      retainedStageSource(thermalStep)?.queueOrderedCleanupClaim
    ].filter(Boolean);
  const reactionQueueOrderedClaims =
    retainedStageSource(reactionStep)?.queueOrderedCleanupClaims
    ?? [
      retainedStageSource(reactionStep)?.queueOrderedCleanupClaim
    ].filter(Boolean);
  const pendingQueueOrderedCleanupClaims = [
    ...(Array.isArray(queueOrderedProducerClaims)
      ? queueOrderedProducerClaims
      : []),
    ...thermalQueueOrderedClaims,
    ...reactionQueueOrderedClaims
  ];
  const attachRetainedOutputFinalConsumer = (
    stage,
    producerClaims,
    finalConsumer
  ) => {
    const output = retainedStageSource(stage);
    if (
      !output
      || !finalConsumer
      || !Array.isArray(producerClaims)
      || producerClaims.length === 0
    ) return false;
    const existingFinalConsumer =
      output.queueOrderedRetainedOutputFinalConsumerCapability
      ?? null;
    if (existingFinalConsumer != null) {
      if (existingFinalConsumer !== finalConsumer) {
        throw new Error(
          'retained output already has a different exact final-consumer capability'
        );
      }
      return true;
    }
    Object.defineProperty(
      output,
      'queueOrderedRetainedOutputFinalConsumerCapability',
      {
        value: finalConsumer,
        enumerable: false,
        configurable: false,
        writable: false
      }
    );
    return true;
  };
  const phaseCarrierPlan = sphParticleUpload?.phaseCarrierPlan
    || sphParticleState?.phaseCarrierPlan
    || null;
  let phaseCarrierSourceStateBuffer = (
    reactionComponentMutations.state ? reactionOutput.stateBuffer : null
  ) || thermalOutput.stateBuffer
    || farForceOutput.stateBuffer
    || postMechanicsParticleBuffers.stateBuffer;
  let phaseCarrierSourceThermoBuffer = (
    reactionComponentMutations.thermo ? reactionOutput.thermoBuffer : null
  ) || thermalOutput.thermoBuffer
    || sphParticleUpload?.thermoBuffer;
  let phaseCarrierSourceMechanicsBuffer = (
    reactionComponentMutations.mechanics ? reactionOutput.mechanicsBuffer : null
  ) || postMechanicsParticleBuffers.mechanicsBuffer;
  // The next stage's source triple is this stage's output, so the existing
  // chaining already names the post-reaction state exactly.
  await traceStageMechanics(
    'reaction-product',
    phaseCarrierSourceStateBuffer,
    phaseCarrierSourceThermoBuffer,
    phaseCarrierSourceMechanicsBuffer
  );
  const postReactionStateBuffer = phaseCarrierSourceStateBuffer;
  const postReactionThermoBuffer = phaseCarrierSourceThermoBuffer;
  const postReactionMechanicsBuffer = phaseCarrierSourceMechanicsBuffer;
  if (condensateExtraction != null) {
    if (!stageEligible || !thermalStep || !thermalMaterialTable || !mechanicsMaterialTable
        || !phaseCarrierPlanReady(phaseCarrierPlan) || typeof phaseCarrierTransferRunner !== 'function') {
      throw new TypeError('Condensate extraction requires the complete actual pre-transfer closure');
    }
    // The actual optical consumer receives this pending transition and both
    // reaction snapshots below. It excludes only GPU-validated extracted
    // donor liquid from both birth sums; existing optical inventory is not a
    // general-purpose debit for the newly extracted population.
    const sourceFamily = sphAerosolSourceFamily(sphParticleUpload);
    const sourceRead = acquireSphAerosolSpatialParcelRead({ device,
      transaction: schroederSpatialEpochTransaction, generation: schroederSpatialEpochGeneration,
      family: sourceFamily });
    let candidate = null;
    try {
      // The public request supplies physical activation declarations only.
      // It cannot override the actual reaction outputs, SS lineage or closure.
      candidate = await timedStage('condensateExtraction', () => runSphAerosolCondensateExtractionWebGpu({
        device, sourceFamily, sourceRead, expectedGeneration: sourceFamily?.generation,
        sourceLineage: { transaction: schroederSpatialEpochTransaction,
          generation: schroederSpatialEpochGeneration, sphParticleUpload, mlsMpmParticleUpload },
        sourceStateBuffer: postReactionStateBuffer, sourceThermoBuffer: postReactionThermoBuffer,
        sourceMechanicsBuffer: postReactionMechanicsBuffer, thermalMaterialTable, mechanicsMaterialTable,
        declarations: condensateExtraction.declarations, provenance: condensateExtraction.provenance,
        targetCapacity: condensateExtraction.targetCapacity,
        absolutePressureAuthority: phaseCarrierTransferOptions.absolutePressureAuthority === true
      }));
      aerosolCondensateTransition = prepareSphAerosolCondensateTransition(candidate, {
        device, transaction: schroederSpatialEpochTransaction, generation: schroederSpatialEpochGeneration,
        sphParticleUpload, mlsMpmParticleUpload, sourceStateBuffer: postReactionStateBuffer,
        sourceThermoBuffer: postReactionThermoBuffer, sourceMechanicsBuffer: postReactionMechanicsBuffer
      });
      phaseCarrierSourceStateBuffer = aerosolCondensateTransition.stateBuffer;
      phaseCarrierSourceThermoBuffer = aerosolCondensateTransition.thermoBuffer;
      phaseCarrierSourceMechanicsBuffer = aerosolCondensateTransition.mechanicsBuffer;
      executedStageOrder.push('pending-condensate-extraction');
    } catch (error) {
      if (candidate) discardSphAerosolCondensateExtraction(candidate);
      throw error;
    } finally {
      if (sourceRead) releaseSphAerosolParcelRead(sourceRead);
    }
  }
  if (
    phaseCarrierPlanReady(phaseCarrierPlan)
    && thermalStep
    && thermalMaterialTable
    && mechanicsMaterialTable
    && typeof phaseCarrierTransferRunner === 'function'
    && stageEligible
    && phaseCarrierSourceStateBuffer
    && phaseCarrierSourceThermoBuffer
    && phaseCarrierSourceMechanicsBuffer
  ) {
    const phaseCarrierParticleLineage = Object.freeze({
      particleCount: sphParticleUpload?.particleCount,
      topologyEpoch: sphParticleUpload?.topologyEpoch,
      identityRevision: sphParticleUpload?.identityRevision,
      identityBuffer: sphParticleUpload?.identityBuffer ?? null
    });
    phaseCarrierTransferStep = await capturedStage(
      'phaseCarrierTransfer',
      phaseCarrierTransferRunner, () => ({
        ...phaseCarrierTransferOptions,
        device,
        sphParticleState,
        mlsMpmParticleState,
        thermalMaterialTable,
        mechanicsMaterialTable,
        phaseCarrierPlan,
        sourceStateBuffer: phaseCarrierSourceStateBuffer,
        sourceThermoBuffer: phaseCarrierSourceThermoBuffer,
        sourceMechanicsBuffer: phaseCarrierSourceMechanicsBuffer,
        retainOutputParticleBuffers: true,
        readbackMode,
        queueOrderedProducerClaims:
          pendingQueueOrderedCleanupClaims
      })
    );
    queueOrderedFinalConsumerCapability =
      retainedStageSource(phaseCarrierTransferStep)
        ?.queueOrderedFinalConsumerCapability
      ?? null;
    // The phase submission has already sealed the upstream producer claims.
    // Publish that exact capability before any tracer or later stage can
    // throw, so failure cleanup can consume every sealed claim without a
    // second host fence or a stranded allocation owner.
    attachRetainedOutputFinalConsumer(
      thermalStep,
      thermalQueueOrderedClaims,
      queueOrderedFinalConsumerCapability
    );
    attachRetainedOutputFinalConsumer(
      reactionStep,
      reactionQueueOrderedClaims,
      queueOrderedFinalConsumerCapability
    );
    const retainedPhaseCarrierOutput =
      retainedPhaseCarrierTransferOutputBuffers(
        phaseCarrierTransferStep
      );
    phaseCarrierTransferFamilyReceipt = Object.freeze({
      schema:
        'peercompute.ulg.sph-phase-carrier-transfer-family-receipt.v0',
      status: 'phase-carrier-transfer-family-authenticated',
      device,
      phaseCarrierPlan,
      particleLineage: phaseCarrierParticleLineage,
      preReactionStateBuffer: reactionSourceStateBuffer,
      preReactionThermoBuffer: reactionSourceThermoBuffer,
      postReactionStateBuffer,
      postReactionThermoBuffer,
      postReactionMechanicsBuffer,
      aerosolCondensateTransition,
      aerosolOpticalAuthority: false,
      preTransferStateBuffer: phaseCarrierSourceStateBuffer,
      preTransferThermoBuffer: phaseCarrierSourceThermoBuffer,
      preTransferMechanicsBuffer: phaseCarrierSourceMechanicsBuffer,
      postTransferStateBuffer: retainedPhaseCarrierOutput.stateBuffer,
      postTransferThermoBuffer: retainedPhaseCarrierOutput.thermoBuffer,
      postTransferMechanicsBuffer:
        retainedPhaseCarrierOutput.mechanicsBuffer,
      reactionParticleMutationApplied: reactionMutatesParticles,
      reactionStateMutationApplied: reactionComponentMutations.state,
      reactionThermoMutationApplied: reactionComponentMutations.thermo
    });
    executedStageOrder.push('phase-carrier-transfer-v2');
    if (typeof afterPhaseCarrierTransfer === 'function') {
      await afterPhaseCarrierTransfer({
        phaseCarrierTransferStep,
        phaseCarrierTransferFamilyReceipt
      });
    }
  }

  const phaseCarrierOutput = retainedPhaseCarrierTransferOutputBuffers(
    phaseCarrierTransferStep
  );
  const phaseCarrierOutputCleanupClaim =
    retainedStageSource(phaseCarrierTransferStep)
      ?.queueOrderedCleanupClaim
    ?? null;
  const mechanicsRefreshSourceStateBuffer = phaseCarrierOutput.stateBuffer || (
    reactionComponentMutations.state ? reactionOutput.stateBuffer : null
  ) || thermalOutput.stateBuffer
    || farForceOutput.stateBuffer
    || postMechanicsParticleBuffers.stateBuffer;
  const mechanicsRefreshSourceThermoBuffer = phaseCarrierOutput.thermoBuffer || (
    reactionComponentMutations.thermo ? reactionOutput.thermoBuffer : null
  ) || thermalOutput.thermoBuffer
    || sphParticleUpload?.thermoBuffer;
  const mechanicsRefreshSourceMechanicsBuffer =
    phaseCarrierOutput.mechanicsBuffer
    || (reactionComponentMutations.mechanics
      ? reactionOutput.mechanicsBuffer
      : null)
    || postMechanicsParticleBuffers.mechanicsBuffer;
  await traceStageMechanics(
    'phase-carrier-transfer-v2',
    mechanicsRefreshSourceStateBuffer,
    mechanicsRefreshSourceThermoBuffer,
    mechanicsRefreshSourceMechanicsBuffer
  );
  if (
    (thermalStep || reactionMutatesParticles)
    && mechanicsMaterialTable
    && typeof mechanicsRefreshRunner === 'function'
    && stageEligible
    && mechanicsRefreshSourceStateBuffer
    && mechanicsRefreshSourceThermoBuffer
    && mechanicsRefreshSourceMechanicsBuffer
  ) {
    mechanicsRefreshStep = await capturedStage(
      'mechanicsRefresh',
      mechanicsRefreshRunner, () => ({
        ...mechanicsRefreshOptions,
        device,
        sphParticleState,
        mlsMpmParticleState,
        mechanicsMaterialTable,
        sphParticleUpload,
        mlsMpmParticleUpload,
        sourceStateBuffer: mechanicsRefreshSourceStateBuffer,
        sourceThermoBuffer: mechanicsRefreshSourceThermoBuffer,
        sourceMechanicsBuffer: mechanicsRefreshSourceMechanicsBuffer,
        preferWebGpu,
        retainOutputParticleBuffers: true,
        readbackMode,
        queueOrderedProducerClaims:
          phaseCarrierOutputCleanupClaim
            ? [phaseCarrierOutputCleanupClaim]
            : queueOrderedFinalConsumerCapability
              ? []
            : pendingQueueOrderedCleanupClaims
      })
    );
    mechanicsQueueOrderedFinalConsumerCapability =
        retainedStageSource(mechanicsRefreshStep)
          ?.queueOrderedFinalConsumerCapability
        ?? null;
    if (!queueOrderedFinalConsumerCapability) {
      queueOrderedFinalConsumerCapability =
        mechanicsQueueOrderedFinalConsumerCapability;
    }
    executedStageOrder.push('mechanics-constitutive-refresh');
  }
  // Thermal/reaction retained-output claims are consumed by the first exact
  // sidecar submission after those stages.  A later hierarchy submission has
  // a different bounded claim set, so keep the sealing capability beside each
  // exact producer instead of letting generic step teardown substitute the
  // hierarchy capability.
  attachRetainedOutputFinalConsumer(
    thermalStep,
    thermalQueueOrderedClaims,
    queueOrderedFinalConsumerCapability
  );
  attachRetainedOutputFinalConsumer(
    reactionStep,
    reactionQueueOrderedClaims,
    queueOrderedFinalConsumerCapability
  );
  attachRetainedOutputFinalConsumer(
    phaseCarrierTransferStep,
    phaseCarrierOutputCleanupClaim
      ? [phaseCarrierOutputCleanupClaim]
      : [],
    mechanicsQueueOrderedFinalConsumerCapability
  );
  // The refresh emits mechanics only, so it is paired with the state and thermo
  // it ran against. This is the LAST writer of the mechanics buffer -- the
  // closure runs thermal -> reaction -> transfer -> refresh, which is not the
  // order the stage list reads.
  await traceStageMechanics(
    'mechanics-constitutive-refresh',
    mechanicsRefreshSourceStateBuffer,
    mechanicsRefreshSourceThermoBuffer,
    retainedMechanicsRefreshOutputBuffers(mechanicsRefreshStep).mechanicsBuffer
      || mechanicsRefreshSourceMechanicsBuffer
  );

  let continuation = resolveMlsMpmPostMechanicsContinuation({
    postMechanicsParticleBuffers,
    sourceThermoBuffer: sphParticleUpload?.thermoBuffer || null,
    schroederFarForceDeltaFusion,
    thermalStep,
    schroederSpatialReactionDiscoveryProposal:
      resolvedSchroederSpatialReactionDiscoveryProposal,
    reactionStep,
    mechanicsRefreshStep,
    phaseCarrierTransferStep,
    phaseCarrierPlan,
    inputResidentProductMass,
    sphParticleUpload,
    mlsMpmParticleUpload,
    schroederSpatialEpochGeneration
  });
  const continuationInputResidentProductMass =
    continuation.inputResidentProductMass;
  const continuationEmittedResidentProductMass =
    continuation.emittedResidentProductMass;
  const inputProductMassPresent = Boolean(
    continuationInputResidentProductMass
  );
  const emittedProductMassPresent = Boolean(
    continuationEmittedResidentProductMass
  );
  const residentProductMassSourceCount =
    Number(inputProductMassPresent) + Number(emittedProductMassPresent);
  const oneSidedResidentProductMass = residentProductMassSourceCount === 1
    ? (
        continuationInputResidentProductMass
        || continuationEmittedResidentProductMass
      )
    : null;
  const noFullReadbackWebGpu = Boolean(
    readbackMode === NO_FULL_READBACK_MODE
    && postMechanicsBackend === 'webgpu'
  );
  const residentProductMassMergeRunnerAvailable =
    typeof residentProductMassMergeRunner === 'function';
  const distinctSharedBufferAliases = Boolean(
    inputProductMassPresent
    && emittedProductMassPresent
    && continuationInputResidentProductMass
      !== continuationEmittedResidentProductMass
    && sameResidentProductMass(
      continuationInputResidentProductMass,
      continuationEmittedResidentProductMass
    )
  );
  if (
    noFullReadbackWebGpu
    && residentProductMassMergeRunnerAvailable
    && distinctSharedBufferAliases
  ) {
    throw postMechanicsClosureError(
      'No-full-readback product history rejects distinct logical views over one physical product-event buffer',
      'ERR_MLS_MPM_POST_MECHANICS_PRODUCT_HISTORY_AMBIGUOUS_ALIAS'
    );
  }
  const exactSharedResidentProductMass = Boolean(
    inputProductMassPresent
    && emittedProductMassPresent
    && continuationInputResidentProductMass
      === continuationEmittedResidentProductMass
  );
  if (
    noFullReadbackWebGpu
    && residentProductMassMergeRunnerAvailable
    && exactSharedResidentProductMass
    && continuation.residentProductMass?.productEventBuffer
    && !authenticatedResidentProductMassGpuCount(
      continuation.residentProductMass,
      device
    )
  ) {
    throw postMechanicsClosureError(
      'No-full-readback product history cannot publish one raw handle through two logical source lanes',
      'ERR_MLS_MPM_POST_MECHANICS_PRODUCT_HISTORY_UNAUTHENTICATED_ALIAS'
    );
  }
  const oneSidedProductGpuCountAuthority =
    oneSidedResidentProductMass?.productEventBuffer
      ? authenticatedResidentProductMassGpuCount(
          oneSidedResidentProductMass,
          device
        )
      : null;
  const oneSidedProductPromotionRequired = Boolean(
    noFullReadbackWebGpu
    && residentProductMassMergeRunnerAvailable
    && residentProductMassSourceCount === 1
    && oneSidedResidentProductMass?.productEventBuffer
    && !oneSidedProductGpuCountAuthority
  );
  const residentProductMassMergeRequired = Boolean(
    continuation.productMassMergeRequired
  );
  const residentProductMassMergeRequested = Boolean(
    residentProductMassMergeRequired
    || oneSidedProductPromotionRequired
  );
  const noFullReadbackBufferedMerge = Boolean(
    noFullReadbackWebGpu
    && residentProductMassMergeRunnerAvailable
    && residentProductMassMergeRequested
    && (
      continuationInputResidentProductMass?.productEventBuffer
      || continuationEmittedResidentProductMass?.productEventBuffer
    )
  );
  if (noFullReadbackBufferedMerge) {
    if (
      typeof device?.createBuffer !== 'function'
      || typeof device?.queue?.submit !== 'function'
    ) {
      throw postMechanicsClosureError(
        'No-full-readback product-history promotion requires one live WebGPU device',
        'ERR_MLS_MPM_POST_MECHANICS_PRODUCT_HISTORY_DEVICE_REQUIRED'
      );
    }
    for (const source of [
      continuationInputResidentProductMass,
      continuationEmittedResidentProductMass
    ].filter((candidate) => candidate?.productEventBuffer)) {
      if (!exactResidentProductMassDeviceMatch(source, device)) {
        throw postMechanicsClosureError(
          'No-full-readback product-history source is not owned by the closure WebGPU device',
          'ERR_MLS_MPM_POST_MECHANICS_PRODUCT_HISTORY_DEVICE_MISMATCH'
        );
      }
    }
  }
  if ((residentProductMassMergeRequested && residentProductMassMergeRunnerAvailable) || gasCapture) {
    const mergeModule = gasCapture ? await loadProductHistoryMerger() : null;
    const mergeToken = gasCapture ? Object.freeze({}) : null;
    const mergeRunner = residentProductMassMergeRunner ?? mergeModule?.mergeResidentProductMassBuffersWebGpu;
    const mergedResidentProductMass = await mergeRunner({
      device,
      inputResidentProductMass: continuationInputResidentProductMass,
      emittedResidentProductMass: continuationEmittedResidentProductMass,
      readbackTelemetryAccumulator: readbackTelemetry,
      allowHostCompactionObservation:
        readbackMode !== NO_FULL_READBACK_MODE,
      ...(gasCapture ? { postMechanicsSourceCapture: mergeToken } : {})
    });
    if (mergedResidentProductMass && mergedResidentProductMass !== continuationInputResidentProductMass
        && mergedResidentProductMass !== continuationEmittedResidentProductMass) {
      replacementResidentProductMass = mergedResidentProductMass;
    }
    if (gasCapture) {
      const mergeRecord = mergeModule.resolveResidentProductMassMergeSourceCapture(mergedResidentProductMass, mergeToken);
      gasCapture.mergeRelease = mergeRecord.release;
      gasCapture.mergeRetire = mergeRecord.retireOwnedOutput;
      gasCapture.mergeValidate = () => mergeModule.resolveResidentProductMassMergeSourceCapture(mergedResidentProductMass, mergeToken);
      if (mergeRecord.device !== device
          || mergeRecord.inputResidentProductMass !== continuationInputResidentProductMass
          || mergeRecord.emittedResidentProductMass !== continuationEmittedResidentProductMass) {
        throw gasSourceError('Current closure merged a different product history pair');
      }
    }
    if (noFullReadbackBufferedMerge) {
      const mergeResultGpuCountAuthority =
        authenticatedResidentProductMassGpuCount(
          mergedResidentProductMass,
          device
        );
      const unchangedOneSidedSource = Boolean(
        oneSidedProductPromotionRequired
        && mergedResidentProductMass === oneSidedResidentProductMass
      );
      const unchangedTwoSourceResult = Boolean(
        residentProductMassMergeRequired
        && (
          mergedResidentProductMass
            === continuationInputResidentProductMass
          || mergedResidentProductMass
            === continuationEmittedResidentProductMass
        )
      );
      if (
        !mergeResultGpuCountAuthority
        || unchangedOneSidedSource
        || unchangedTwoSourceResult
      ) {
        throw postMechanicsClosureError(
          'No-full-readback product-history merge did not publish a distinct same-device GPU-count authority',
          'ERR_MLS_MPM_POST_MECHANICS_PRODUCT_HISTORY_PROMOTION_INVALID'
        );
      }
    }
    continuation = Object.freeze({
      ...continuation,
      residentProductMass: mergedResidentProductMass,
      productMassMergeRequired: gasCapture ? false : !mergedResidentProductMass,
      productMassStatus: mergedResidentProductMass
        ? 'resident-product-mass-merged-gpu-resident'
        : 'resident-product-mass-merge-failed'
    });
  }
  const executedReadbackStages = [
    ['schroeder-far-force-delta-fusion', schroederFarForceDeltaFusion],
    [
      'schroeder-spatial-thermal-proposal',
      thermalStep ? schroederSpatialThermalProposal : null
    ],
    ['thermal-step', thermalStep],
    [
      'schroeder-spatial-reaction-discovery-proposal',
      resolvedSchroederSpatialReactionDiscoveryProposal
    ],
    ['reaction-step', reactionStep],
    ...(aerosolCondensateTransition ? [['condensate-extraction', {
      backend: 'webgpu', fullParticleReadbackFree: true,
      mapAsyncCount: 1, readbackBytes: 64, hostQueueFenceCount: 0
    }]] : []),
    ['phase-carrier-transfer', phaseCarrierTransferStep],
    ['mechanics-refresh', mechanicsRefreshStep]
  ]
    .filter(([, stage]) => Boolean(stage))
    .map(([source, stage]) => [source, retainedStageSource(stage)]);
  for (const [source, stage] of executedReadbackStages) {
    readbackTelemetry.merge(stage, source);
  }
  if (
    typeof stageMechanicsTracer?.snapshot === 'function'
    && stageMechanicsTracer.enabled !== false
  ) {
    readbackTelemetry.markUnknown('stage-mechanics-tracer');
  }
  const fullParticleReadbackPerformed = executedReadbackStages.some(
    ([, stage]) => (
      stage?.fullParticleReadbackPerformed === true
      || stage?.fullReadbackPerformed === true
    )
  );
  const fullParticleReadbackFree = Boolean(
    postMechanicsBackend === 'webgpu'
    && !fullParticleReadbackPerformed
    && executedReadbackStages.every(
      ([, stage]) => (
        stage?.backend === 'webgpu'
        && stage?.fullParticleReadbackFree === true
      )
    )
  );
  const residentContinuationReady = Boolean(
    fullParticleReadbackFree
    && continuation.ready === true
    && continuation.productMassMergeRequired !== true
    && continuation.stateBuffer
    && continuation.thermoBuffer
    && continuation.mechanicsBuffer
  );
  const closure = {
    schema: ULG_MLS_MPM_POST_MECHANICS_CLOSURE_SCHEMA,
    status: continuation.ready && !continuation.productMassMergeRequired
      ? 'post-mechanics-closure-complete'
      : 'post-mechanics-closure-incomplete',
    backend: postMechanicsBackend,
    authoritativeStageOrder: aerosolCondensateTransition
      ? CONDENSATE_CLOSURE_STAGE_ORDER
      : MLS_MPM_POST_MECHANICS_CLOSURE_STAGE_ORDER,
    executedStageOrder: Object.freeze([...executedStageOrder]),
    // Reports its own absence rather than returning null, so a missing trace
    // says whether the tracer never reached this closure or reached it disabled.
    stageMechanicsTrace: typeof stageMechanicsTracer?.result === 'function'
      ? stageMechanicsTracer.result()
      : {
        schema: 'peercompute.ulg.sph-stage-mechanics-trace.v0',
        status: stageMechanicsTracer
          ? 'stage-mechanics-trace-tracer-malformed'
          : 'stage-mechanics-trace-tracer-absent',
        stages: []
      },
    schroederFarForceDeltaFusion,
    thermalStep,
    reactionStep,
    mechanicsRefreshStep,
    phaseCarrierTransferStep,
    phaseCarrierPlan,
    continuation,
    residentProductMass: continuation.residentProductMass,
    generation: continuation.generation,
    readbackMode,
    fullParticleReadbackPerformed,
    fullParticleReadbackFree,
    residentContinuationReady,
    ...readbackTelemetry.snapshot(),
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
  const queueOrderedCleanupClaims = Object.freeze([
    ...new Set([
      ...(
        queueOrderedFinalConsumerCapability
          ? []
          : pendingQueueOrderedCleanupClaims
      ),
      ...(
        phaseCarrierOutputCleanupClaim
          && !mechanicsQueueOrderedFinalConsumerCapability
          ? [phaseCarrierOutputCleanupClaim]
          : []
      )
    ])
  ]);
  Object.defineProperty(closure, 'queueOrderedCleanupClaims', {
    value: queueOrderedCleanupClaims,
    enumerable: false
  });
  Object.defineProperty(closure, 'phaseCarrierTransferFamilyReceipt', {
    value: phaseCarrierTransferFamilyReceipt,
    enumerable: false
  });
  Object.defineProperty(closure, 'aerosolCondensateTransition', {
    value: aerosolCondensateTransition, enumerable: false
  });
  if (queueOrderedFinalConsumerCapability) {
    Object.defineProperty(
      closure,
      'queueOrderedFinalConsumerCapability',
      {
        value: queueOrderedFinalConsumerCapability,
        enumerable: false
      }
    );
  }
  Object.defineProperty(
    closure,
    'queueOrderedFinalConsumerCapabilities',
    {
      value: Object.freeze({
        upstream:
          queueOrderedFinalConsumerCapability,
        phaseCarrierOutput:
          mechanicsQueueOrderedFinalConsumerCapability
      }),
      enumerable: false
    }
  );
  const closureAuthority = registerPostMechanicsClosureAuthority(closure, {
    device,
    postMechanicsParticleBuffers,
    sphParticleUpload,
    mlsMpmParticleUpload,
    aerosolCondensateTransition,
    transaction: schroederSpatialEpochTransaction,
    generation: schroederSpatialEpochGeneration
  });
  if (massCapture) {
    closureAuthority.exactMassCapture = massCapture;
    validateCapturedExactMass(closureAuthority);
  }
  if (gasCapture) {
    for (const key of ['stateBuffer', 'thermoBuffer', 'mechanicsBuffer']) {
      if (!continuation[key] || !gasCapture.seals.some((seal) => seal.output[key] === continuation[key])) {
        throw gasSourceError(`Captured current ${key} was not produced by a standard closure stage`);
      }
    }
    const epoch = gasCapture.metadata.epochIdentity;
    const finalSphUpload = { schema: sphParticleUpload.schema, status: 'webgpu-uploaded',
      ...epoch, particleCount: gasCapture.metadata.particleCount,
      aerosolFamily: gasCapture.metadata.aerosolFamily,
      identityRevision: sphParticleUpload.identityRevision,
      stateBuffer: continuation.stateBuffer, thermoBuffer: continuation.thermoBuffer,
      identityBuffer: sphParticleUpload.identityBuffer,
      stateStrideBytes: sphParticleUpload.stateStrideBytes,
      thermoStrideBytes: sphParticleUpload.thermoStrideBytes,
      identityStrideBytes: sphParticleUpload.identityStrideBytes,
      stateBufferByteLength: continuation.stateBuffer.size,
      thermoBufferByteLength: continuation.thermoBuffer.size,
      identityBufferByteLength: sphParticleUpload.identityBuffer?.size,
      ownsStateBuffer: false, ownsThermoBuffer: false, ownsIdentityBuffer: false };
    if (!ensureSphGpuParticleBufferSetBorrowLifecycle(finalSphUpload)) {
      throw gasSourceError('Current closure upload could not install its borrow lifecycle');
    }
    const finalMlsUpload = Object.freeze({ schema: mlsMpmParticleUpload.schema,
      status: 'webgpu-uploaded', ...epoch, particleCount: gasCapture.metadata.particleCount,
      mechanicsBuffer: continuation.mechanicsBuffer,
      mechanicsStrideBytes: mlsMpmParticleUpload.mechanicsStrideBytes,
      mechanicsBufferByteLength: continuation.mechanicsBuffer.size, ownsMechanicsBuffer: false });
    gasCapture.packet = Object.freeze({ ...gasCapture.metadata,
      sphParticleUpload: Object.freeze(finalSphUpload), mlsMpmParticleUpload: finalMlsUpload,
      stateBuffer: continuation.stateBuffer, thermoBuffer: continuation.thermoBuffer,
      mechanicsBuffer: continuation.mechanicsBuffer, residentProductMass: continuation.residentProductMass,
      productCountDescriptor: continuation.residentProductMass
        ? productEventLiveCountCopyDescriptor(continuation.residentProductMass, device) : null });
    if (continuation.residentProductMass) gasCapture.sourceSnapshots.push([
      continuation.residentProductMass, Object.freeze(Object.fromEntries([
        'productEventBuffer', 'productEventBufferByteLength', 'productEventRowCount',
        'productEventStrideFloats', 'productEventStrideBytes'
      ].map((key) => [key, continuation.residentProductMass[key]])))
    ]);
    closureAuthority.gasSourceCapture = gasCapture;
    validateCapturedGasSource(closureAuthority);
  }
  return closure;
  } catch (error) {
    releaseExactMassCapture(massCapture);
    if (gasCapture) {
      for (const seal of gasCapture.seals) seal.release();
      gasCapture.mergeRelease?.();
      gasCapture.originalUploadRelease?.();
      if (gasCapture.aerosolRead) releaseSphAerosolParcelRead(gasCapture.aerosolRead);
    }
    if (aerosolCondensateTransition) discardSphAerosolCondensateTransition(aerosolCondensateTransition);
    releasePostSeparationThermalBins();
    resolvedSchroederSpatialReactionDiscoveryProposal?.destroy?.();
    let resolveFailureCleanup = null;
    const failureCleanupReceipt = {
      schema: 'peercompute.ulg.mls-mpm-post-mechanics-failure-cleanup.v1',
      status: 'post-mechanics-failure-cleanup-pending-owner-fence',
      releasedOwnerFamilyCount: 0,
      releasedComponentCount: 0,
      releasedResidentProductMassCount: 0,
      rawDestroyedBufferCount: 0,
      blockers: []
    };
    const failureCleanupCompletion = new Promise((resolve) => {
      resolveFailureCleanup = resolve;
    });
    Object.defineProperty(failureCleanupReceipt, 'completion', {
      value: failureCleanupCompletion,
      enumerable: false
    });
    if (error && (typeof error === 'object' || typeof error === 'function')) {
      if (queueOrderedFinalConsumerCapability) {
        Object.defineProperty(
          error,
          'queueOrderedFinalConsumerCapability',
          {
            value: queueOrderedFinalConsumerCapability,
            enumerable: false,
            configurable: true
          }
        );
      }
      Object.defineProperty(
        error,
        'queueOrderedFinalConsumerCapabilities',
        {
          value: Object.freeze({
            upstream:
              queueOrderedFinalConsumerCapability,
            phaseCarrierOutput:
              mechanicsQueueOrderedFinalConsumerCapability
          }),
          enumerable: false,
          configurable: true
        }
      );
      Object.defineProperty(
        error,
        'queueOrderedCleanupClaims',
        {
          value: Object.freeze([]),
          enumerable: false,
          configurable: true
        }
      );
      Object.defineProperty(error, 'postMechanicsCleanupReceipt', {
        value: failureCleanupReceipt,
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(error, 'postMechanicsCleanupCompletion', {
        value: failureCleanupCompletion,
        enumerable: false,
        configurable: true
      });
    }
    deferSubmittedWorkCleanup(device, () => {
      const cleanup = destroyFailedPostMechanicsStageOutputs({
        postMechanicsParticleBuffers,
        sphParticleUpload,
        mlsMpmParticleUpload,
        schroederFarForceDeltaFusion,
        thermalStep: thermalStep ?? completedCapturedStages.get('thermalStep'),
        reactionStep: reactionStep ?? completedCapturedStages.get('reactionStep'),
        mechanicsRefreshStep: mechanicsRefreshStep ?? completedCapturedStages.get('mechanicsRefresh'),
        phaseCarrierTransferStep: phaseCarrierTransferStep ?? completedCapturedStages.get('phaseCarrierTransfer'),
        inputResidentProductMass,
        replacementResidentProductMass
      });
      Object.assign(failureCleanupReceipt, {
        ...cleanup,
        blockers: [...(cleanup.blockers || [])]
      });
      Promise.resolve(cleanup.completion).then((settled) => {
        Object.assign(failureCleanupReceipt, {
          ...settled,
          blockers: [...(settled.blockers || [])]
        });
        resolveFailureCleanup(failureCleanupReceipt);
      });
    });
    throw error;
  }
}
