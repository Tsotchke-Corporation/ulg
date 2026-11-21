import { runSphLedgerParcelCandidateWebGpu, resolveSphLedgerParcelCandidateSourceCapture,
  retainedSphLedgerParcelCandidateBuffers } from './sphLedgerParcelCandidateGpu.js';
import { resolveSphWallReservoirAuthority } from '../thermalEnvironmentAuthority.js';
import {
  runSchroederPhaseSlotRefinementWebGpu, resolveSchroederPhaseSlotRefinementSourceCapture,
  retainedSchroederPhaseSlotRefinementBuffers
} from './schroederPhaseSlotRefinementGpu.js';
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
import { deferSubmittedWorkCleanup, deferConfirmedSubmittedWorkCleanup,
  createQueueOrderedCleanupClaimIssuer, registerQueueOrderedCleanupClaim,
  cancelQueueOrderedCleanupClaim, releaseSubmittedWorkCleanupQueueOrdered } from '../webgpuComputeLayout.js';
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
  webGpuBufferMatchesDevice, tagWebGpuBufferDevice
} from './sphGpuDeviceIdentity.js';
import {
  resolveResidentProductEventCountAuthority,
  productEventLiveCountCopyDescriptor,
  validateProductEventLiveCountCopyDescriptor
} from './sphResidentProductHistoryGpu.js';
import {
  runSphAerosolCondensateExtractionWebGpu,
  prepareSphAerosolCondensateTransition,
  prepareSphAerosolVaporTransition,
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
  sphGpuParticleUploadAdvertisesExactMass, sphGpuParticleUploadAdvertisesDispersedMediumOptics, sphGpuParticleUploadExactEnergyRows,
  sphGpuParticleUploadLedgerParcels,
  markSphExactMassDerivedBuffers } from './sphGpuBuffers.js';
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
const phaseSlotRetirementFamily = 'post-mechanics-phase-slot-retirement';
const phaseSlotRetirementIssuer = createQueueOrderedCleanupClaimIssuer({
  producerFamily: phaseSlotRetirementFamily
});
const POST_MECHANICS_COMPONENTS = Object.freeze([
  'state',
  'thermo',
  'mechanics'
]);
const POST_MECHANICS_CLOSURE_AUTHORITIES = new WeakMap();
const MLS_MPM_TERMINAL_PARTICLE_FAMILIES = new WeakSet();
const POST_MECHANICS_GAS_READS = new WeakMap();
const POST_MECHANICS_EXACT_GAS_READS = new WeakMap();
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
  const [thermal] = capture.seals;
  const reaction = capture.stageNames.includes('reactionStep') ? capture.seals[1] : null;
  const phase = capture.seals[capture.stageNames.indexOf('phaseCarrierTransfer')] ?? null;
  const refresh = capture.seals.at(-1);
  const refinement = capture.seals[capture.stageNames.indexOf('phaseSlotRefinement')] ?? null;
  const parcels = capture.seals[capture.stageNames.indexOf('ledgerParcels')] ?? null;
  const current = parcels ?? refinement ?? phase ?? reaction ?? thermal;
  const predecessor = capture.exchange?.sourceContinuation ?? authority.continuation;
  if (!phase && !reaction && thermal.exactThermal && refresh.exactMechanics?.source !== thermal.exactThermal) {
    throw new TypeError('Mechanics refresh must evolve the retained thermal quantities before publication');
  }
  const expectedStages = ['thermalStep', ...(reaction ? ['reactionStep'] : []),
    ...(phase ? ['phaseCarrierTransfer'] : []), ...(refinement ? ['phaseSlotRefinement'] : []), ...(parcels ? ['ledgerParcels'] : []), 'mechanicsRefresh'].join(',');
  if (capture.stageNames.join(',') !== expectedStages
      || thermal.inputs.sourceStateBuffer !== capture.g2p.stateBuffer
      || thermal.inputs.sourceThermoBuffer !== capture.g2p.thermoBuffer
      || refresh.inputs.sourceStateBuffer !== current.output.stateBuffer
      || refresh.inputs.sourceThermoBuffer !== current.output.thermoBuffer
      || refresh.inputs.sourceMechanicsBuffer !== (parcels?.output.mechanicsBuffer ?? refinement?.output.mechanicsBuffer ?? phase?.output.mechanicsBuffer ?? reaction?.output.mechanicsBuffer ?? capture.g2p.mechanicsBuffer)
      || authority.closure.continuation !== authority.continuation
      || predecessor.stateBuffer !== current.output.stateBuffer
      || predecessor.thermoBuffer !== current.output.thermoBuffer
      || predecessor.mechanicsBuffer !== refresh.output.mechanicsBuffer
      || (!reaction && !capture.g2p.history && predecessor.residentProductMass != null
        && !(thermal.exactEnergy && !thermal.exactThermal))) {
    throw new TypeError('Exact inventory requires its genuine G2P/thermal/reaction/refresh chain');
  }
  if (refinement && (!phase?.exactLedgerPhase || !refinement.exactLedgerRefinement
      || refinement.sourcePhaseSeal !== phase
      || refinement.inputs.sourceStateBuffer !== phase.output.stateBuffer
      || refinement.inputs.sourceThermoBuffer !== phase.output.thermoBuffer
      || refinement.inputs.sourceMechanicsBuffer !== phase.output.mechanicsBuffer
      || refinement.exactLedgerRefinement.carrierMassRead.rowCount !== capture.g2p.particleCount)) {
    throw new TypeError('Refinement continuation lost its original phase ledger or aligned successor');
  }
  if (parcels && (!parcels.exactLedgerParcels || parcels.sourcePredecessorSeal !== (refinement ?? phase)
    || parcels.inputs.sourceStateBuffer !== (refinement ?? phase)?.output.stateBuffer
    || parcels.inputs.sourceThermoBuffer !== (refinement ?? phase)?.output.thermoBuffer
    || parcels.inputs.sourceMechanicsBuffer !== (refinement ?? phase)?.output.mechanicsBuffer)) {
    throw new TypeError('Parcel continuation lost its genuine predecessor and successor inventory');
  }
  const ledgerReaction = reaction?.exactLedgerReaction ?? null;
  if (phase?.exactLedgerPhase) {
    const beforePhase = ledgerReaction ? reaction : thermal;
    if ((reaction && !ledgerReaction) || !thermal.exactEnergy || thermal.exactThermal || refresh.exactMechanics
        || phase.inputs.sourceStateBuffer !== beforePhase.output.stateBuffer
        || phase.inputs.sourceThermoBuffer !== beforePhase.output.thermoBuffer
        || phase.inputs.sourceMechanicsBuffer !== (ledgerReaction ? reaction.output.mechanicsBuffer : capture.g2p.mechanicsBuffer)
        || phase.exactLedgerPhase.carrierMassRead?.rowCount !== capture.g2p.particleCount) {
      throw new TypeError('Ledger phase continuation lost its thermal energy record or aligned mass successor');
    }
  } else if (phase) {
    const beforePhase = reaction ?? thermal;
    if (!phase.exactPhase || phase.exactPhase.source !== (reaction?.exactReaction ?? thermal.exactThermal ?? thermal)
        || phase.inputs.sourceStateBuffer !== beforePhase.output.stateBuffer
        || phase.inputs.sourceThermoBuffer !== beforePhase.output.thermoBuffer
        || phase.inputs.sourceMechanicsBuffer !== (reaction?.output.mechanicsBuffer ?? capture.g2p.mechanicsBuffer)
        || refresh.exactMechanics?.source !== phase.exactPhase
        || phase.exactPhase.carrierMassRead?.rowCount !== capture.g2p.particleCount
        || refresh.exactMechanics.quantityLayout.rowCount !== capture.g2p.particleCount) {
      throw new TypeError('Exact phase continuation lost its original source or aligned mass/quantity successor');
    }
  }
  if (capture.g2p.history) {
    if (!capture.motionValidate || !capture.mergeValidate
        || predecessor.inputResidentProductMass !== capture.motionHistory
        || predecessor.residentProductMass !== capture.history) {
      throw new TypeError('Exact continuation must publish the updated original G2P history');
    }
    capture.motionValidate(); capture.mergeValidate();
  }
  if (ledgerReaction) {
    if (reaction.inputs.sourceStateBuffer !== thermal.output.stateBuffer
        || reaction.inputs.sourceThermoBuffer !== thermal.output.thermoBuffer
        || reaction.inputs.sourceMechanicsBuffer !== capture.g2p.mechanicsBuffer
        || !thermal.exactEnergy || thermal.exactThermal || refresh.exactMechanics
        || ledgerReaction.carrierMassRead?.rowCount !== capture.g2p.particleCount) {
      throw new TypeError('Ledger reaction continuation lost its thermal energy record or aligned mass successor');
    }
  } else if (reaction) {
    if (reaction.inputs.sourceStateBuffer !== thermal.output.stateBuffer
        || reaction.inputs.sourceThermoBuffer !== thermal.output.thermoBuffer
        || reaction.inputs.sourceMechanicsBuffer !== capture.g2p.mechanicsBuffer
        || !reaction.exactReaction || (!phase && refresh.exactMechanics?.source !== reaction.exactReaction)
        || refresh.exactMechanics.quantityLayout.rowCount !== capture.g2p.particleCount
        || reaction.exactReaction.carrierMassRead.rowCount !== capture.g2p.particleCount
        || !capture.mergeValidate || predecessor.residentProductMass !== capture.history) {
      throw new TypeError('Exact reaction continuation lost its carrier quantities or separate product history');
    }
    capture.mergeValidate();
  }
  capture.exchange?.validate(authority);
  return capture;
}

// The captured reaction seal of a G2 ledger reaction, shaped as the energy
// record input the ledger phase transfer reads.
function reactionLedgerSeal(capture) {
  const seal = capture?.seals?.[capture.stageNames.indexOf('reactionStep')];
  if (!seal?.exactLedgerReaction) return null;
  return Object.freeze({ exactEnergy: seal.exactLedgerReaction.exactEnergy,
    exactLedgerReaction: seal.exactLedgerReaction, output: seal.output, validate: () => seal.validate() });
}

export function resolveMlsMpmPostMechanicsExactMassContinuation(closure, claim, nextParticleUploads) {
  const authority = closureAuthorityFor(closure);
  if (!validateMlsMpmPostMechanicsContinuationClaim(closure, claim, { nextParticleUploads })) {
    throw new TypeError('Exact inventory requires the original claimed continuation');
  }
  return exactMassContinuationCapture(authority);
}

function exactMassContinuationCapture(authority) {
  const capture = validateCapturedExactMass(authority);
  const finalRefresh = capture.exchange?.refreshSeal ?? capture.seals.at(-1);
  const phase = capture.seals[capture.stageNames.indexOf('phaseCarrierTransfer')] ?? null;
  // The thermal energy record is current only if no later stage wrote u;
  // phase transfer, reaction and exchange end the ledger instead.
  const thermalSeal = capture.seals[0];
  const ledgerPhase = phase?.exactLedgerPhase ?? null;
  const ledgerReaction = capture.seals[capture.stageNames.indexOf('reactionStep')]?.exactLedgerReaction ?? null;
  const exactEnergyCurrent = Boolean(thermalSeal?.exactEnergy) && !phase && !capture.exchange
    && !capture.stageNames.includes('reactionStep');
  // The newest ledger writer hands its record over: phase, else reaction,
  // else thermal when nothing after it wrote u.
  const ledgerRefinement = capture.seals[capture.stageNames.indexOf('phaseSlotRefinement')]?.exactLedgerRefinement ?? null;
  const ledgerParcels = capture.seals[capture.stageNames.indexOf('ledgerParcels')]?.exactLedgerParcels;
  const ledgerStage = ledgerParcels ?? ledgerRefinement ?? ledgerPhase ?? (phase ? null : ledgerReaction);
  const energySeal = ledgerStage && !capture.exchange ? ledgerStage : exactEnergyCurrent ? thermalSeal : null;
  return Object.freeze({ sourceRead: capture.g2p.sourceRead,
    ...(authority.chainCapture && ledgerPhase && capture.g2p.sourceRead.residualMechanicsSource?.phaseLayout ? {
      residualPhasePlan:capture.g2p.sourceRead.residualMechanicsSource.phaseLayout.plan,
      residualPhaseValidationBuffer:phase.phaseValidationBuffer
    } : {}),
    ...(energySeal ? { exactEnergy: energySeal.exactEnergy,
      transferExactEnergy: energySeal.transferExactEnergy } : {}),
    ...(ledgerStage ? { carrierMassRead: capture.exchange?.massRead ?? ledgerStage.carrierMassRead } : {}),
    ...(ledgerParcels ? { parcels:ledgerParcels.parcels,transferParcels:ledgerParcels.transferParcels } : {}),
    ...(authority.chainCapture ? {residentClock:authority.chainCapture.finalization.clock,
      transferResidentClock:authority.chainCapture.finalization.transferClock,
      residentProductMass:authority.continuation.residentProductMass??null} : {}),
    ...(authority.chainCapture?.wallRecord ? {finiteWall:thermalSeal.exactFiniteWall,
      transferFiniteWall:thermalSeal.transferExactFiniteWall} : {}),
    ...(authority.chainCapture && ledgerReaction?.lineageRecord ? {reactionLineage:ledgerReaction.lineageRecord,
      transferReactionLineage:ledgerReaction.transferLineage} : {}),
    ...(authority.chainCapture?.finalization.residualHistory ? {
      residualHistory:authority.chainCapture.finalization.residualHistory,
      transferResidualHistory:authority.chainCapture.finalization.transferResidualHistory} : {}),
    sourceSphUpload: capture.g2p.sourceSphUpload ?? capture.g2p.sourceRead.sourceSphUpload,
    sourceMlsUpload: capture.g2p.sourceMlsUpload,
    transaction: authority.transaction, generation: authority.generation,
    ...(finalRefresh.exactMechanics ? {
      carrierMassRead: capture.exchange?.massRead ?? phase?.exactPhase.carrierMassRead ?? (capture.stageNames.includes('reactionStep')
        ? capture.seals[1].exactReaction.carrierMassRead : capture.g2p.sourceRead.read),
      exactQuantities: finalRefresh.exactMechanics,
      transferExactQuantities: finalRefresh.transferExactQuantities
    } : {}) });
}

// Private chaining retains numerical candidates inside the existing resident
// lane. It never grants the ordinary continuation/StateManager claim.
export function resolveMlsMpmChainPrivateSource(closure) {
  const authority=closureAuthorityFor(closure);
  resolveMlsMpmChainClosureAdmission(closure);
  const capture=validateCapturedExactMass(authority);
  if(authority.retirementMode || authority.continuation.productMassMergeRequired) {
    throw new TypeError('Private chain requires its completed history merge');
  }
  return Object.freeze({device:authority.device,
    sphParticleUpload:capture.g2p.sourceRead.sourceSphUpload,
    mlsMpmParticleUpload:capture.g2p.sourceMlsUpload,
    sphParticleState:capture.seals[0].inputs.sphParticleState,
    mlsMpmParticleState:capture.seals.at(-1).inputs.mlsMpmParticleState,
    clock:authority.chainCapture.finalization.clock,
    residentProductMass:authority.continuation.residentProductMass??null,
    particleFamily:Object.freeze({stateBuffer:authority.continuation.stateBuffer,
      thermoBuffer:authority.continuation.thermoBuffer,mechanicsBuffer:authority.continuation.mechanicsBuffer,
      particleCount:capture.g2p.particleCount,phaseSlotRefinementSelected:Boolean(closure.phaseSlotRefinementStep),
      phaseCarrierFamilySelected:Boolean(closure.phaseCarrierTransferStep),
      thermoSource:'private-chain-closure',schroederParticleStorageSelected:false})});
}

export function resolveMlsMpmChainPrivateExactMassContinuation(closure,claim,nextParticleUploads) {
  if(!validateMlsMpmChainPrivateContinuationClaim(closure,claim,{nextParticleUploads})) {
    throw new TypeError('Private chain requires its original private continuation claim');
  }
  return exactMassContinuationCapture(closureAuthorityFor(closure));
}

export function validateMlsMpmChainPrivateRetirement(closure,claim,nextParticleUploads) {
  if(!validateMlsMpmChainPrivateContinuationClaim(closure,claim,{nextParticleUploads})) return false;
  const receipt=closureAuthorityFor(closure).retirementReceipt;
  return receipt?.claimReceipt===claim && receipt.abandoned===false;
}

/** Pooled stage allocations cannot be destroyed one selected buffer at a time.
 * Transfer the entire original family with its selected private S/T/M rows. */
export function transferMlsMpmChainPrivatePhysicalFamilies(closure,claim,nextParticleUploads) {
  if(!validateMlsMpmChainPrivateContinuationClaim(closure,claim,{nextParticleUploads})) {
    throw new TypeError('Private physical handover requires its original continuation claim');
  }
  const authority=closureAuthorityFor(closure);
  if(authority.retirementMode || authority.privatePhysicalFamilies) {
    throw new TypeError('Private physical families were already transferred or retired');
  }
  const selected=new Set([claim.stateBuffer,claim.thermoBuffer,claim.mechanicsBuffer]);
  const families=new Set(authority.ownedFamilies.filter(family=>family.managedBuffers.some(buffer=>selected.has(buffer))));
  const buffers=new Set([...families].flatMap(family=>family.managedBuffers));
  const retired=new Set();
  let completion=null;
  const transfer=Object.freeze({buffers,
    retire() {
      completion??=(async()=>{
        for(const family of families) {
          if(retired.has(family)) continue;
          const capability=family.output.queueOrderedRetainedOutputFinalConsumerCapability;
          const options=capability?{queueOrderedFinalConsumer:capability}:undefined;
          let released;
          if(family.externallyPreservedBuffers.length) {
            if(typeof family.destroyOutputParticleBufferComponents!=='function') {
              throw new TypeError(`Private ${family.stage} cannot retire an external alias`);
            }
            released=await family.destroyOutputParticleBufferComponents.call(family.output,
              Object.fromEntries(family.managedComponents.map(({component})=>[component,true])),options);
          } else released=await family.destroyOutputParticleBuffers.call(family.output,options);
          if(released===false) throw new Error(`Private ${family.stage} family did not confirm retirement`);
          retired.add(family);
        }
        return true;
      })().catch(error=>{completion=null;throw error;});
      return completion;
    }});
  authority.privatePhysicalFamilies={families,transfer};
  return transfer;
}

function releaseChainClosureCapture(capture) {
  if (!capture || capture.released) return false;
  capture.released = true;
  if (capture.ownsSeals) for (const seal of capture.seals) seal.release();
  capture.producer.release();
  capture.finalization?.destroy();
  return true;
}

// Consumer descriptor, not publication authority. A future resident runner
// must consume this control in its atomic state/clock admission submission.
export function resolveMlsMpmChainClosureAdmission(closure) {
  const authority = closureAuthorityFor(closure);
  const capture = authority.chainCapture;
  if (!capture || capture.released || closure.continuation !== authority.continuation
    || closure.chainAdmissionControlBuffer !== capture.finalization.controlBuffer) {
    throw new TypeError('Chain admission requires the original live closure');
  }
  capture.producer.validate();
  for (const seal of capture.seals) seal.validate();
  return Object.freeze({ controlBuffer: capture.finalization.controlBuffer,
    stateBuffer: authority.continuation.stateBuffer, thermoBuffer: authority.continuation.thermoBuffer,
    mechanicsBuffer: authority.continuation.mechanicsBuffer,
    exactQuantities: authority.exactMassCapture?.seals.at(-1)?.exactMechanics ?? null,
    exactEnergy: capture.energy ?? null,
    carrierMassRead: capture.massRead ?? null,
    parcelRecord: capture.parcelRecord ?? null,
    wallRecord: capture.wallRecord ?? null,
    lineageRecord: capture.lineageRecord ?? null,
    clock: capture.finalization.clock,
    transaction: authority.transaction, generation: authority.generation });
}

function releaseExactMassCapture(capture) {
  if (!capture || capture.released) return false;
  capture.released = true;
  for (const seal of capture.seals) seal.release();
  capture.mergeRelease?.();
  capture.exchange?.release();
  if (capture.motionHistory && capture.motionHistory !== capture.history) {
    capture.motionHistory.destroyResidentProductMassBuffers();
  }
  capture.g2p?.release();
  return true;
}

export function releaseMlsMpmPostMechanicsExactMassCapture(closure) {
  const authority = closureAuthorityFor(closure);
  if (authority.exchangeOperation || authority.gasSourceCapture?.activeReads > 0) {
    throw gasSourceError('Current gas reads or exchange still pin the exact stage quantities');
  }
  return releaseExactMassCapture(authority.exactMassCapture);
}

async function readExchangeRefreshAcceptance(device, source) {
  const staging = device.createBuffer({ label: 'ulg-vapor-refresh-acceptance', size: 4, usage: 1 | 8 });
  let submitted = false, fence = null, mapped = false;
  try {
    const encoder = device.createCommandEncoder(); encoder.copyBufferToBuffer(source, 0, staging, 0, 4);
    submitted = true; device.queue.submit([encoder.finish()]);
    fence = deferConfirmedSubmittedWorkCleanup(device, () => {});
    await Promise.race([staging.mapAsync(1), fence.then(confirmed => {
      if (!confirmed) throw new Error('Device lost during exchange mechanics acceptance');
      return new Promise(() => {});
    })]);
    mapped = true;
    const failures = new Uint32Array(staging.getMappedRange())[0];
    staging.unmap(); mapped = false;
    if (!await fence) throw new Error('Exchange mechanics completion was not confirmed');
    return failures;
  } finally {
    if (submitted) await (fence ?? deferConfirmedSubmittedWorkCleanup(device, () => {}));
    if (mapped) staging.unmap();
    staging.destroy();
  }
}

// This is part of the original closure builder, before its continuation is
// exposed. Numerical producer reads are not themselves publication authority.
// Only the existing closure claim and outer SS transaction can commit the
// particle/history/aerosol result assembled here.
async function applyPostMechanicsVaporExchange(closure, request, timedStage, telemetry) {
  const authority = closureAuthorityFor(closure), device = authority.device;
  if (!request || Object.getPrototypeOf(request) !== Object.prototype
      || Reflect.ownKeys(request).some(key => !['caloricAuthority', 'surfaceModels', 'edges', 'pressureWorkMode', 'rateModels', 'rateIntegration', 'rateSubsteps', 'transportPacketMode'].includes(key))) {
    throw new TypeError('Vapor exchange requires explicit caloricAuthority, surfaceModels and prescribed edges');
  }
  const options = Object.fromEntries(['caloricAuthority', 'surfaceModels', 'edges'].map(key => {
    const property = Object.getOwnPropertyDescriptor(request, key);
    if (!property || !Object.hasOwn(property, 'value')) throw new TypeError('Vapor exchange inputs must be own data');
    return [key, property.value];
  }));
  const workMode = Object.getOwnPropertyDescriptor(request, 'pressureWorkMode');
  if (workMode && !Object.hasOwn(workMode, 'value')) throw new TypeError('Pressure-work mode must be own data');
  options.pressureWorkMode = workMode ? workMode.value : 'prescribed';
  const rates = Object.getOwnPropertyDescriptor(request, 'rateModels');
  if (rates && !Object.hasOwn(rates, 'value')) throw new TypeError('Rate models must be own data');
  if (rates) options.rateModels = rates.value;
  const integration = Object.getOwnPropertyDescriptor(request, 'rateIntegration');
  if (integration && !Object.hasOwn(integration, 'value')) throw new TypeError('Rate integration must be own data');
  if (integration) options.rateIntegration = integration.value;
  const substeps = Object.getOwnPropertyDescriptor(request, 'rateSubsteps');
  if (substeps && !Object.hasOwn(substeps, 'value')) throw new TypeError('Rate substeps must be own data');
  if (substeps) options.rateSubsteps = substeps.value;
  const packets = Object.getOwnPropertyDescriptor(request, 'transportPacketMode');
  if (packets && !Object.hasOwn(packets, 'value')) throw new TypeError('Transport packet mode must be own data');
  if (packets) options.transportPacketMode = packets.value;
  if (authority.exchangeOperation || authority.claimReceipt || authority.retirementMode
      || authority.aerosolCondensateTransition || !authority.exactMassCapture
      || !authority.gasSourceCapture || authority.gasSourceCapture.readIssued) {
    throw new TypeError('Vapor exchange requires one unused original exact current closure');
  }
  const capture = validateCapturedExactMass(authority), sourceContinuation = authority.continuation;
  const operation = Object.freeze({}); authority.exchangeOperation = operation;
  const exchange = { sourceContinuation, state: null, thermo: null, history: null, mass: null, massRead: null,
    refresh: null, refreshSeal: null, transition: null, producerRead: null, cleanupCompletion: null };
  let current = null, candidate = null, currentModule, producerModule, massModule, historyModule;
  let source, historyCleanup = null, candidateRetirement = null, installed = false, released = false;
  const validateOperation = () => {
    if (authority.exchangeOperation !== operation || authority.continuation !== sourceContinuation
        || closure.continuation !== sourceContinuation || authority.claimReceipt || authority.retirementMode) {
      throw new TypeError('Original closure changed during vapor exchange');
    }
    validateCapturedExactMass(authority);
  };
  const retireCurrent = async () => {
    if (!current) return;
    if (await currentModule.releaseSphPostMechanicsGasStateAfterQueue(current, { device }) !== true) {
      // Preserve the predecessor capture while cleanup is quarantined. A
      // failed fence cannot authorize releasing its original stage producers.
      await new Promise(resolve => device.lost.then(resolve, () => {}));
      if (await currentModule.releaseSphPostMechanicsGasStateAfterQueue(current, { device }) !== true) {
        throw new Error('Current gas source did not retire after confirmed device loss');
      }
    }
    current = null;
  };
  const releaseOutputs = () => {
    if (released) return exchange.cleanupCompletion;
    released = true;
    exchange.refreshSeal?.release();
    if (exchange.mass) massModule.releaseSphExactMassInventory(exchange.mass);
    const massCleanup = exchange.massRead ? massModule.releaseSphExactMassRead(exchange.massRead) : null;
    if (exchange.producerRead) producerModule.releaseSphSpatialVaporAerosolProducerRead(exchange.producerRead);
    if (candidate?.ready) candidateRetirement ??= producerModule.releaseSphSpatialVaporAerosolExchangeCandidate(candidate);
    exchange.cleanupCompletion = Promise.all([massCleanup, historyCleanup, candidateRetirement,
      exchange.refreshSeal?.sourceCleanupCompletion?.()]).then(async () => {
      if (installed && capture.mergeRetire && !capture.mergeRetired) {
        // The base merged history is superseded by this exchange's arena
        // owner. Its original captured source pins have already been released.
        await capture.mergeRetire(); capture.mergeRetired = true;
      }
    });
    void exchange.cleanupCompletion.catch(() => {});
    return exchange.cleanupCompletion;
  };
  try {
    [currentModule, producerModule, massModule, historyModule] = await Promise.all([
      import('./sphPostMechanicsGasStateGpu.js'), import('./sphSpatialGasLedgerEosGpu.js'),
      import('./sphExactMassInventoryGpu.js'), loadProductHistoryMerger()
    ]);
    validateOperation();
    const packet = authority.gasSourceCapture.packet;
    await timedStage('vaporExchangeGasState', async () => {
      current = await currentModule.runSphPostMechanicsGasStateWebGpu({ device, closure,
        closureExchangeOperation: operation, caloricAuthority: options.caloricAuthority,
        caloricThermalMaterialTable: packet.thermalMaterialTable });
      return current;
    });
    validateOperation();
    await timedStage('vaporExchangeCandidate', async () => {
      candidate = await producerModule.runSphSpatialVaporAerosolExchangeCandidate(current.gasEos,
        { surfaceModels: options.surfaceModels, edges: options.edges, pressureWorkMode: options.pressureWorkMode,
          ...(rates ? { rateModels: options.rateModels } : {}),
          ...(integration ? { rateIntegration: options.rateIntegration } : {}),
          ...(substeps ? { rateSubsteps: options.rateSubsteps } : {}),
          ...(packets ? { transportPacketMode: options.transportPacketMode } : {}) });
      return candidate;
    });
    if (!candidate.ready) {
      const error = new Error('Prescribed vapor exchange was rejected before closure adoption');
      error.vaporExchangeReceipt = candidate.receipt; throw error;
    }
    validateOperation();
    exchange.producerRead = producerModule.acquireSphSpatialVaporAerosolProducerRead(candidate, { device, closure });
    source = producerModule.resolveSphSpatialVaporAerosolProducerRead(exchange.producerRead, { device });
    exchange.transition = await prepareSphAerosolVaporTransition({ device, producerRead: exchange.producerRead });
    exchange.mass = await massModule.createSphExactMassInventoryFromVaporExchangeWebGpu({ device, producerRead: exchange.producerRead });
    exchange.massRead = massModule.acquireSphExactMassRead({ device, family: exchange.mass });
    if (source.sourceHistory) {
      exchange.history = await historyModule.publishResidentProductVaporHistoryWebGpu({ device,
        producerRead: exchange.producerRead, inputResidentProductMass: source.sourceHistory });
      historyCleanup = historyModule.resolveResidentProductVaporHistoryPublication(exchange.history, {
        device, producerRead: exchange.producerRead, inputResidentProductMass: source.sourceHistory }).cleanupCompletion;
    }
    const refreshToken = Object.freeze({});
    await timedStage('vaporExchangeMechanicsRefresh', async () => {
      exchange.refresh = await runMlsMpmMechanicsRefreshWebGpu({ device, exactVaporProducerRead: exchange.producerRead,
        sphParticleState: packet.sphParticleState, mlsMpmParticleState: packet.mlsMpmParticleState,
        sphParticleUpload: packet.originalSphParticleUpload, mlsMpmParticleUpload: packet.originalMlsMpmParticleUpload,
        mechanicsMaterialTable: packet.mechanicsMaterialTable, sourceStateBuffer: source.stateBuffer,
        sourceThermoBuffer: source.thermoBuffer, sourceMechanicsBuffer: source.mechanicsBuffer,
        postMechanicsSourceCapture: refreshToken, retainOutputParticleBuffers: true, readbackMode: NO_FULL_READBACK_MODE });
      exchange.refreshSeal = resolveMlsMpmMechanicsRefreshSourceCapture(exchange.refresh, refreshToken);
      exchange.acceptanceBuffer = exchange.refresh.authorityValidationBuffer;
      return exchange.refresh;
    });
    exchange.refreshSeal.validate();
    if (await readExchangeRefreshAcceptance(device, exchange.acceptanceBuffer) !== 0) {
      throw new Error('Vapor exchange mechanics refresh rejected; no endpoint may be adopted');
    }
    validateOperation();
    exchange.refreshSeal.validate();
    for (const [component, buffer] of [['state', source.stateBuffer], ['thermo', source.thermoBuffer]]) {
      exchange[component] = device.createBuffer({
        label: `ulg-vapor-closure-${component}`, size: buffer.size, usage: 128 | 4 | 8 });
      tagWebGpuBufferDevice(exchange[component], device);
    }
    markSphExactMassDerivedBuffers(source.sourceParticleRead, [exchange.state, exchange.thermo, exchange.refresh.mechanicsBuffer]);
    const encoder = device.createCommandEncoder({ label: 'ulg-vapor-closure-particle-copy' });
    encoder.copyBufferToBuffer(source.stateBuffer, 0, exchange.state, 0, exchange.state.size);
    encoder.copyBufferToBuffer(source.thermoBuffer, 0, exchange.thermo, 0, exchange.thermo.size);
    device.queue.submit([encoder.finish()]);
    telemetry.merge(current.gasEos, 'vapor-exchange-current-gas');
    telemetry.merge(exchange.refresh, 'vapor-exchange-mechanics');
    telemetry.markUnknown('vapor-exchange-candidate-and-lifetime-fences');
    await retireCurrent();
    validateOperation();
    const components = { state: exchange.state, thermo: exchange.thermo, mechanics: exchange.refresh.mechanicsBuffer };
    const continuation = Object.freeze({ ...sourceContinuation, stateBuffer: components.state,
      thermoBuffer: components.thermo, mechanicsBuffer: components.mechanics,
      residentProductMass: exchange.history,
      componentSources: Object.freeze(Object.fromEntries(POST_MECHANICS_COMPONENTS.map(key => [key, 'vapor-aerosol-exchange']))),
      componentOwnership: Object.freeze(Object.fromEntries(POST_MECHANICS_COMPONENTS.map(key => [key, 'closure-owned-transfer']))),
      componentLineage: Object.freeze(Object.fromEntries(POST_MECHANICS_COMPONENTS.map(key => [key,
        Object.freeze({ stage: 'vapor-aerosol-exchange', buffer: components[key], ownedByClosure: true })]))) });
    exchange.validate = currentAuthority => {
      if (released || producerModule.resolveSphSpatialVaporAerosolProducerRead(exchange.producerRead, { device }) !== source
          || currentAuthority.continuation !== continuation || currentAuthority.closure.continuation !== continuation
          || currentAuthority.closure.residentProductMass !== exchange.history
          || currentAuthority.aerosolCondensateTransition !== exchange.transition
          || exchange.refreshSeal.exactMechanics.source !== source
          || exchange.refreshSeal.inputs.mechanicsMaterialTable !== packet.mechanicsMaterialTable
          || !massModule.validateSphExactMassRead(exchange.massRead, { device, family: exchange.mass,
            format: source.format, expectedGeneration: exchange.mass.generation, rowCount: packet.particleCount })) {
        throw new TypeError('Exact exchange continuation lost its original coupled producer');
      }
      exchange.refreshSeal.validate();
      if (exchange.history) historyModule.resolveResidentProductVaporHistoryPublication(exchange.history,
        { device, producerRead: exchange.producerRead, inputResidentProductMass: source.sourceHistory });
    };
    exchange.release = releaseOutputs;
    // All fallible GPU work and predecessor retirement precede these adjacent
    // original-owner updates. No caller-supplied tuple enters this commit.
    for (const [component, buffer] of Object.entries(components)) authority.ownedBuffers.set(buffer,
      [Object.freeze({ stage: 'vapor-aerosol-exchange', component, buffer })]);
    authority.ownedFamilies.push(...postMechanicsOwnedOutputFamilies({ mechanicsRefreshStep: exchange.refresh }));
    authority.aerosolCondensateTransition = exchange.transition;
    authority.continuation = continuation;
    authority.residentProductEventBuffer = exchange.history?.productEventBuffer ?? null;
    closure.continuation = continuation; closure.residentProductMass = exchange.history;
    capture.exchange = exchange; installed = true;
    closure.vaporAerosolExchangeStep = Object.freeze({ status: 'coupled-exchange-awaiting-outer-publication',
      receipt: candidate.receipt, kineticsAdmitted: false, exchangeIntervalAdmitted: false,
      rateModel: candidate.rateModel, rateIntervalSeconds: candidate.rateIntervalSeconds,
      rateIntegration: candidate.rateIntegration, rateSubsteps: candidate.rateSubsteps, transportPacketMode: candidate.transportPacketMode,
      fullPhysicsValidation: false, mechanicsRefresh: exchange.refresh });
    closure.executedStageOrder = Object.freeze([...closure.executedStageOrder,
      'current-gas-state', 'vapor-aerosol-exchange', 'exchange-mechanics-refresh']);
    Object.assign(closure, telemetry.snapshot());
    candidateRetirement = producerModule.releaseSphSpatialVaporAerosolExchangeCandidate(candidate);
  } catch (error) {
    current ??= error.retainedGasState ?? null;
    await retireCurrent();
    if (exchange.transition) discardSphAerosolCondensateTransition(exchange.transition);
    await deferConfirmedSubmittedWorkCleanup(device, () => {});
    await Promise.all([error.exactVaporTransitionCleanupCompletion, error.exactMechanicsRefreshCleanupCompletion,
      error.exactHistoryPublicationCleanupCompletion]);
    await releaseOutputs();
    if (exchange.transition) await exchange.transition.cleanupCompletion;
    exchange.refresh?.destroyOutputParticleBuffers();
    if (exchange.history) await exchange.history.destroyResidentProductMassBuffers();
    exchange.state?.destroy(); exchange.thermo?.destroy();
    throw error;
  } finally {
    if (authority.exchangeOperation === operation) authority.exchangeOperation = null;
  }
}

function validateCapturedGasSource(authority) {
  const capture = authority.gasSourceCapture;
  if (capture?.exactCapture) validateCapturedExactMass(authority);
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
  // The exact closure owns shared stage seals through its eventual real
  // continuation binding. A gas observation must not retire that chain.
  if (!capture.exactCapture) {
    for (const seal of capture.seals) seal.release();
    capture.mergeRelease?.();
  }
  capture.originalUploadRelease?.();
  if (capture.aerosolRead) releaseSphAerosolParcelRead(capture.aerosolRead);
}

/** Source provenance only: no kinetic rate, physical exchange interval or
 * successor publication is authorized by this private one-shot owner read. */
export function acquireMlsMpmPostMechanicsGasSourceRead(closure, { device, exchangeOperation = null } = {}) {
  const authority = closureAuthorityFor(closure);
  if (authority.device !== device || authority.claimReceipt || authority.retirementMode
      || authority.gasSourceCapture?.readIssued
      || (authority.exchangeOperation && authority.exchangeOperation !== exchangeOperation)) {
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
      released: false, drained: false, releasePromise: null, exactChildren: 0, exactChildDrain: null });
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

function mintExactGasRead(parent, device) {
  const capture = validateCapturedExactMass(parent.authority);
  const final = capture.seals.at(-1).exactMechanics;
  const read = Object.freeze({ schema: 'peercompute.ulg.post-mechanics-exact-gas-read.v1' });
  const value = Object.freeze({ quantities: final,
    massRead: capture.stageNames.includes('reactionStep') ? capture.seals[1].exactReaction.carrierMassRead : capture.g2p.sourceRead.read,
    sourceParticleRead: capture.g2p.sourceRead,
    sourceSphUpload: parent.packet.sphParticleUpload, sourceMlsUpload: parent.packet.mlsMpmParticleUpload,
    particleCount: parent.packet.particleCount, dtSeconds: parent.packet.dtSeconds });
  parent.exactChildren++;
  POST_MECHANICS_EXACT_GAS_READS.set(read, { parent, device, value, released: false });
  return read;
}

/** A read of the original completed producers, not a new particle owner. */
export function acquireMlsMpmPostMechanicsExactGasRead(sourceRead, { device } = {}) {
  resolveMlsMpmPostMechanicsGasSourceRead(sourceRead, { device });
  const parent = POST_MECHANICS_GAS_READS.get(sourceRead);
  return parent.authority.exactMassCapture ? mintExactGasRead(parent, device) : null;
}

export function resolveMlsMpmPostMechanicsExactGasRead(read, { device } = {}) {
  const record = POST_MECHANICS_EXACT_GAS_READS.get(read);
  if (!record || record.released || record.device !== device || record.parent.drained) {
    throw gasSourceError('Exact current quantities require the original held closure read');
  }
  validateCapturedGasSource(record.parent.authority);
  const capture = validateCapturedExactMass(record.parent.authority);
  if (capture.seals.at(-1).exactMechanics !== record.value.quantities) {
    throw gasSourceError('Exact current quantity producer changed');
  }
  return record.value;
}

export function forkMlsMpmPostMechanicsExactGasRead(read, { device } = {}) {
  resolveMlsMpmPostMechanicsExactGasRead(read, { device });
  return mintExactGasRead(POST_MECHANICS_EXACT_GAS_READS.get(read).parent, device);
}

export function releaseMlsMpmPostMechanicsExactGasRead(read) {
  const record = POST_MECHANICS_EXACT_GAS_READS.get(read);
  if (!record) throw gasSourceError('Unknown exact current quantity release');
  if (record.released) return false;
  record.released = true;
  record.parent.exactChildren--;
  if (record.parent.exactChildren === 0) record.parent.exactChildDrain?.();
  return true;
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
  Promise.race([confirmed, loss]).then(async () => {
    if (record.exactChildren > 0) await new Promise(resolve => { record.exactChildDrain = resolve; });
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
  postMechanicsClosure = null,
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
  const authority = postMechanicsClosure == null ? null : closureAuthorityFor(postMechanicsClosure);
  if (authority?.chainCapture) throw new TypeError('Chain terminal family still awaits resident state and clock admission');
  if (authority?.phaseSlotCapture && authority.retirementMode) throw new TypeError('Refined closure is already retired');
  const refinement = authority?.phaseSlotCapture
    ? retainedSchroederPhaseSlotRefinementBuffers(authority.phaseSlotRefinementStep) : {};
  const refinementSelected = Boolean(refinement.stateBuffer);
  if (refinementSelected) {
    for (const seal of (authority.exactMassCapture ?? authority.phaseSlotCapture).seals) seal.validate();
    if (authority.closure.phaseSlotRefinementStep !== authority.phaseSlotRefinementStep
        || authority.phaseSlotCapture.sphParticleState !== sphParticleState
        || authority.phaseSlotCapture.sphParticleUpload !== sphParticleUpload
        || authority.closure.continuation !== authority.continuation
        || authority.continuation.stateBuffer !== refinement.stateBuffer
        || authority.continuation.thermoBuffer !== refinement.thermoBuffer
        || authority.continuation.mechanicsBuffer !== retainedMechanicsRefreshOutputBuffers(mechanicsRefreshStep).mechanicsBuffer
        || schroederParticleStorageAdoption?.adopted === true) {
      throw new TypeError('Refined terminal family requires its captured constitutive continuation');
    }
  }
  let exchangeContinuation = null;
  if (authority?.exactMassCapture?.exchange) {
    validateCapturedExactMass(authority);
    const packet = authority.gasSourceCapture.packet;
    if (authority.exchangeOperation || authority.retirementMode
        || packet.sphParticleState !== sphParticleState
        || packet.originalSphParticleUpload !== sphParticleUpload
        || packet.particleCount !== sphParticleState.particleCount
        || schroederParticleStorageAdoption?.adopted === true
        || phaseCarrierTransferStep != null) {
      throw new TypeError('Exact exchange terminal selection requires its original live particle family');
    }
    exchangeContinuation = authority.continuation;
  }
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
  const phaseCarrierFamilySelected = !refinementSelected && Boolean(
    phase.stateBuffer && phase.thermoBuffer && phase.mechanicsBuffer
  );
  const storage = !refinementSelected && !phaseCarrierFamilySelected
    && schroederParticleStorageAdoption?.adopted === true
    ? schroederParticleStorageAdoption
    : null;
  const reactionMutations = reactionOutputComponentMutations(reactionStep);
  const sourceThermoBuffer = sphParticleUpload?.status === 'webgpu-uploaded'
    ? sphParticleUpload.thermoBuffer ?? null
    : null;
  const stateBuffer = (refinementSelected ? authority.continuation.stateBuffer : null) || exchangeContinuation?.stateBuffer || (
    (phaseCarrierFamilySelected ? phase.stateBuffer : null)
    || storage?.stateBuffer
    || (reactionMutations.state ? reaction.stateBuffer : null)
    || thermal.stateBuffer
    || farForce.stateBuffer
    || g2p.stateBuffer
    || null
  );
  const thermoBuffer = (refinementSelected ? authority.continuation.thermoBuffer : null) || exchangeContinuation?.thermoBuffer || (
    (phaseCarrierFamilySelected ? phase.thermoBuffer : null)
    || storage?.thermoBuffer
    || (reactionMutations.thermo ? reaction.thermoBuffer : null)
    || thermal.thermoBuffer
    || sourceThermoBuffer
    || null
  );
  const mechanicsBuffer = (refinementSelected ? authority.continuation.mechanicsBuffer : null) || exchangeContinuation?.mechanicsBuffer || (
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
    vaporAerosolExchangeSelected: exchangeContinuation != null,
    phaseCarrierFamilySelected,
    schroederParticleStorageSelected: Boolean(storage),
    phaseSlotRefinementSelected: refinementSelected,
    reactionMutations,
    stateBuffer,
    thermoBuffer,
    mechanicsBuffer,
    stateSource: refinementSelected ? 'phase-slot-refinement' : exchangeContinuation ? 'vapor-aerosol-exchange' : stateSource,
    thermoSource: refinementSelected ? 'phase-slot-refinement' : exchangeContinuation ? 'vapor-aerosol-exchange' : thermoSource,
    mechanicsSource: exchangeContinuation ? 'exchange-mechanics-refresh' : mechanicsSource
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
  phaseSlotRefinementStep,
  ledgerParcelStep,
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
  const refinement = retainedSchroederPhaseSlotRefinementBuffers(phaseSlotRefinementStep);
  const parcels = retainedSphLedgerParcelCandidateBuffers(ledgerParcelStep);
  const candidates = [
    { stage: 'ledger-vapor-parcel-transport', output: parcels,
      components: ['state','thermo','mechanics'].map(component => [component,
        parcels[`${component}Buffer`], parcels[`owns${component[0].toUpperCase()}${component.slice(1)}Buffer`]]) },
    { stage: 'phase-slot-refinement', output: refinement,
      components: ['state', 'thermo', 'mechanics'].map(component => [component,
        refinement[`${component}Buffer`], refinement[`owns${component[0].toUpperCase()}${component.slice(1)}Buffer`]]) },
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
  phaseSlotRefinementStep,
  ledgerParcelStep,
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
    phaseSlotRefinementStep,
    ledgerParcelStep,
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
  phaseSlotRefinementStep = null,
  ledgerParcelStep = null,
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
  const refinement = retainedSchroederPhaseSlotRefinementBuffers(phaseSlotRefinementStep);
  const parcels = retainedSphLedgerParcelCandidateBuffers(ledgerParcelStep);
  if ((refinement.stateBuffer || parcels.stateBuffer) && !mechanicsRefreshOutput.mechanicsBuffer) {
    throw new TypeError('Refined continuation requires constitutive refresh');
  }
  const selected = {
    state: select([
      {stage:'ledger-vapor-parcel-transport',buffer:parcels.stateBuffer,ownedByClosure:Boolean(parcels.stateBuffer)},
      { stage: 'phase-slot-refinement', buffer: refinement.stateBuffer, ownedByClosure: Boolean(refinement.stateBuffer) },
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
      {stage:'ledger-vapor-parcel-transport',buffer:parcels.thermoBuffer,ownedByClosure:Boolean(parcels.thermoBuffer)},
      { stage: 'phase-slot-refinement', buffer: refinement.thermoBuffer, ownedByClosure: Boolean(refinement.thermoBuffer) },
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
  phaseSlotRefinementStep,
  ledgerParcelStep,
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
  const refinement = retainedSchroederPhaseSlotRefinementBuffers(phaseSlotRefinementStep);
  const parcels = retainedSphLedgerParcelCandidateBuffers(ledgerParcelStep);
  const entries = [
    ...['state','thermo','mechanics'].map(component => ['ledger-vapor-parcel-transport',component,
      parcels[`${component}Buffer`],parcels[`owns${component[0].toUpperCase()}${component.slice(1)}Buffer`]]),
    ...['state', 'thermo', 'mechanics'].map(component => ['phase-slot-refinement', component,
      refinement[`${component}Buffer`], refinement[`owns${component[0].toUpperCase()}${component.slice(1)}Buffer`]]),
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
    phaseSlotRefinementStep: closure.phaseSlotRefinementStep,
    ledgerParcelStep: closure.ledgerParcelStep,
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
    phaseSlotRefinementStep: closure.phaseSlotRefinementStep,
    ledgerParcelStep: closure.ledgerParcelStep,
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
  closure,options={}
) {
  return claimPostMechanicsContinuation(closure,options,false);
}

export function claimMlsMpmChainPrivateContinuation(closure,options={}) {
  resolveMlsMpmChainPrivateSource(closure);
  return claimPostMechanicsContinuation(closure,options,true);
}

function claimPostMechanicsContinuation(
  closure,
  {
    nextParticleUploads = null,
    stateBuffer = null,
    thermoBuffer = null,
    mechanicsBuffer = null
  } = {}, privateChain=false
) {
  const authority = closureAuthorityFor(closure);
  if (authority.chainCapture && !privateChain) {
    throw new TypeError('Chain closure awaits resident GPU state and clock admission');
  }
  if (authority.exchangeOperation) throw gasSourceError('Vapor exchange still owns closure preparation');
  if (authority.phaseSlotCapture && !authority.claimReceipt) {
    if (authority.phaseSlotCapture.released || closure.phaseSlotRefinementStep !== authority.phaseSlotRefinementStep) {
      throw new TypeError('Refined continuation lost its captured producer');
    }
    for (const seal of (authority.exactMassCapture ?? authority.phaseSlotCapture).seals) seal.validate();
  }
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
    status: privateChain ? 'post-mechanics-private-chain-claimed' : 'post-mechanics-continuation-claimed',
    privateChain,
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
  closure,claimReceipt,options={}
) {
  return validateContinuationClaim(closure,claimReceipt,options,false);
}

export function validateMlsMpmChainPrivateContinuationClaim(closure,claimReceipt,options={}) {
  return validateContinuationClaim(closure,claimReceipt,options,true);
}

function validateContinuationClaim(
  closure,
  claimReceipt,
  options = {}, privateChain=false
) {
  try {
    const authority = closureAuthorityFor(closure);
    if (authority.claimReceipt !== claimReceipt) return false;
    if(claimReceipt?.privateChain!==privateChain || (privateChain && !authority.chainCapture)) return false;
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
  if (authority.exchangeOperation || authority.gasSourceCapture?.activeReads > 0) {
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
  const queueRetirement = authority.phaseSlotQueueRetirement;
  if (queueOrderedFinalConsumer != null && (!queueRetirement
      || queueRetirement.capability !== queueOrderedFinalConsumer
      || requestedAbandon || !authority.phaseSlotCapture)) {
    throw postMechanicsClosureError('Phase-slot retirement requires its exact final refresh submission',
      'ERR_MLS_MPM_POST_MECHANICS_RETIREMENT_AUTHORITY');
  }
  if (queueOrderedFinalConsumer == null && (!after || typeof after.then !== 'function')) {
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
  const retire = async (confirmed) => {
    if (confirmed !== true) {
      throw postMechanicsClosureError(
        'Post-mechanics output owner fence was not confirmed',
        'ERR_MLS_MPM_POST_MECHANICS_RETIREMENT_FENCE'
      );
    }
    releaseGasCapturePins(authority);
    if (authority.phaseSlotCapture && !authority.phaseSlotCapture.released) {
      for (const seal of authority.phaseSlotCapture.seals) seal.release();
      authority.phaseSlotCapture.released = true;
    }
    releaseChainClosureCapture(authority.chainCapture);
    releaseExactMassCapture(authority.exactMassCapture);
    await authority.exactMassCapture?.selectionCleanup;
    await authority.exactMassCapture?.motionCleanup;
    await authority.exactMassCapture?.exchange?.cleanupCompletion;
    if (requestedAbandon && authority.exactMassCapture?.exchange?.history) {
      await authority.exactMassCapture.exchange.history.destroyResidentProductMassBuffers();
    }
    await Promise.all(authority.exactMassCapture?.seals.map(seal => seal.sourceCleanupCompletion?.()) ?? []);
    const failures = [];
    if (requestedAbandon && authority.exactMassCapture?.mergeRetire
        && !authority.exactMassCapture.mergeRetired) {
      try {
        await authority.exactMassCapture.mergeRetire();
        authority.exactMassCapture.mergeRetired = true;
      } catch (error) { failures.push(error); }
    }
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
      if(!requestedAbandon && authority.privatePhysicalFamilies?.families.has(family)) {
        for(const buffer of family.managedBuffers) familyPreservedBuffers.add(buffer);
        continue;
      }
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
              selection,
              { queueOrderedFinalConsumer: family.output.queueOrderedRetainedOutputFinalConsumerCapability ?? null }
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
  };
  let retirement;
  if (queueOrderedFinalConsumer != null) {
    if (queueRetirement.started) {
      // A failed component retirement can retry the already authenticated
      // submission. Its preserve mode and claimed family remain immutable.
      retirement = Promise.resolve(true).then(retire);
    } else {
      queueRetirement.run = () => { queueRetirement.attempt = Promise.resolve(true).then(retire); };
      releaseSubmittedWorkCleanupQueueOrdered(authority.device, queueRetirement.cleanup, {
        queueOrderedFinalConsumer, producerClaim: queueRetirement.claim,
        producerOutput: queueRetirement, producerFamily: phaseSlotRetirementFamily
      });
      queueRetirement.started = true;
      retirement = queueRetirement.attempt;
    }
  } else {
    retirement = Promise.resolve(after).then(retire);
  }
  const attempt = retirement.then(
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
  phaseSlotRefinement = null,
  condensateExtraction = null,
  vaporAerosolExchange = null,
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
  if (vaporAerosolExchange != null) {
    if (condensateExtraction != null || !sphGpuParticleUploadAdvertisesExactMass(sphParticleUpload)) {
      throw new TypeError('Current vapor exchange requires the exact inventory closure without another aerosol writer');
    }
    captureGasSource = true;
  }
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
  if (exactMassRequested) {
    const unadmitted = Object.entries({
      'gpu-stage': !stageEligible || !preferWebGpu,
      'no-full-readback': readbackMode !== NO_FULL_READBACK_MODE,
      'thermal-table': !thermalMaterialTable,
      'mechanics-table': !mechanicsMaterialTable,
      'g2p-result': !postMechanicsG2pResult,
      'condensate-extraction': Boolean(condensateExtraction),
      'reaction-discovery': reactionTable?.reactionCount > 0 && (!schroederSpatialEpochTransaction
        || typeof spatialReactionDiscoveryProposalRunner !== 'function'),
      'far-aggregate-force': Boolean(schroederFarAggregateForceApplication),
      'aerosol-without-epoch': Boolean(sphAerosolSourceFamily(sphParticleUpload) && !schroederSpatialEpochTransaction),
      // The integer energy ledger runs the f32 phase split and refresh, which
      // carry the optics sidecar; optics writes optics rows, never mass or u.
      'dispersed-medium-optics': sphGpuParticleUploadAdvertisesDispersedMediumOptics(sphParticleUpload)
        && sphGpuParticleUploadExactEnergyRows(sphParticleUpload) == null
    }).filter(([, blocked]) => blocked).map(([name]) => name);
    if (unadmitted.length) {
      throw new TypeError('Exact inventory closure requires standard captured GPU producers; requested coupling '
        + `remains unadmitted: ${unadmitted.join(', ')}`);
    }
  }
  if (phaseSlotRefinement && ((exactMassRequested && !sphGpuParticleUploadExactEnergyRows(sphParticleUpload))
      || captureGasSource || condensateExtraction
      || !stageEligible || !preferWebGpu || readbackMode !== NO_FULL_READBACK_MODE
      || !thermalMaterialTable || !mechanicsMaterialTable)) {
    throw new TypeError('Phase-slot refinement requires captured f32 or integer-ledger producers; rational inventory and current gas/parcel topology remain unadmitted');
  }
  const phaseSlotCapture = phaseSlotRefinement ? { seals: [], released: false, sphParticleState, sphParticleUpload } : null;
  const massCapture = exactMassRequested ? { seals: [], stageNames: [], tokens: new Map(), g2p: null, released: false } : null;
  if (exactMassRequested && sphAerosolSourceFamily(sphParticleUpload)) {
    const parcels = acquireSphAerosolSpatialParcelRead({ device,
      transaction: schroederSpatialEpochTransaction, generation: schroederSpatialEpochGeneration,
      family: sphAerosolSourceFamily(sphParticleUpload) });
    try {
      if (!parcels?.exactQuantities || parcels.exactQuantities.format !== sphParticleUpload.exactMassInventory.format) {
        throw new TypeError('Exact closure requires the original aerosol quantities in the same run format');
      }
    } finally { if (parcels) releaseSphAerosolParcelRead(parcels); }
  }
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
    gasCapture = { seals: massCapture?.seals ?? [], exactCapture: massCapture,
      sourceSnapshots, activeReads: 0, readIssued: false, pinsReleased: false,
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
  let chainCapture = null;
  const completedCapturedStages = new Map();
  const capturedStage = async (name, runner, optionsForStage) => {
    const capture = massCapture ?? gasCapture ?? phaseSlotCapture ?? chainCapture;
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
    } else if (name === 'ledgerParcels') {
      standard = runner === runSphLedgerParcelCandidateWebGpu;
      resolve = resolveSphLedgerParcelCandidateSourceCapture;
    } else if (name === 'phaseSlotRefinement') {
      standard = runner === runSchroederPhaseSlotRefinementWebGpu;
      resolve = resolveSchroederPhaseSlotRefinementSourceCapture;
    } else if (name === 'phaseCarrierTransfer') {
      standard = runner === runSphPhaseCarrierTransferWebGpu;
      resolve = resolveSphPhaseCarrierTransferSourceCapture;
    } else {
      standard = runner === runMlsMpmMechanicsRefreshWithOptionalWebGpu || runner === runMlsMpmMechanicsRefreshWebGpu;
      resolve = resolveMlsMpmMechanicsRefreshSourceCapture;
    }
    if (!standard) throw gasSourceError(`Captured ${name} requires its standard producer`);
    const token = Object.freeze({});
    capture.tokens?.set(name, token);
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
  let phaseSlotRefinementStep = null;
  let ledgerParcelStep = null;
  let phaseSlotQueueRetirement = null;
  let phaseCarrierTransferFamilyReceipt = null;
  let aerosolCondensateTransition = null;
  let queueOrderedFinalConsumerCapability = null;
  let mechanicsQueueOrderedFinalConsumerCapability = null;
  let replacementResidentProductMass = null;
  let exactReactionSelection = null;
  let reactionLedgerMode = false;
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
  const { acquireMlsMpmLevelChainG2pCapture } = await import('./sphG2pGpuKernel.js');
  const chainProducer = acquireMlsMpmLevelChainG2pCapture(postMechanicsG2pResult, {
    device, transaction: schroederSpatialEpochTransaction, generation: schroederSpatialEpochGeneration,
    sphParticleUpload, mlsMpmParticleUpload, dt: dtSeconds,
    stateBuffer: postMechanicsParticleBuffers.stateBuffer, mechanicsBuffer: postMechanicsParticleBuffers.mechanicsBuffer
  });
  if (chainProducer) {
    chainCapture = { producer: chainProducer, seals: massCapture?.seals ?? [], ownsSeals: !massCapture,
      stageNames: massCapture?.stageNames ?? [], tokens: massCapture?.tokens ?? new Map(), released: false };
    const { resolveSphResidentClockOrigin } = await import('./sphResidentClockGpu.js');
    chainCapture.clockOrigin=resolveSphResidentClockOrigin(sphParticleState,mlsMpmParticleState,
      sphParticleUpload,mlsMpmParticleUpload);
    if (!thermalMaterialTable || !mechanicsMaterialTable || !stageEligible || !preferWebGpu
      || readbackMode !== NO_FULL_READBACK_MODE) {
      throw new TypeError('Chain closure requires retained standard thermal and mechanics producers');
    }
    thermalStepOptions = Object.freeze({ ...thermalStepOptions });
    // These writers require their own batch gate and successor mass/energy
    // rollback. Refusal preserves the missing integration instead of dropping it.
    if (captureGasSource
      || condensateExtraction || vaporAerosolExchange || schroederFarAggregateForceApplication) {
      throw new TypeError('Chain closure still requires batch admission for history/gas-capture writers');
    }
  }
  if (massCapture) {
    // The canonical thermal producer returns a separate wall candidate. Only
    // the multilevel batch currently retains, verifies and rolls it back;
    // another continuation must not adopt the particles and drop that owner.
    if (!chainCapture && schroederSpatialThermalProposal?.exactEnergyLedgerWords
      && resolveSphWallReservoirAuthority(thermalStepOptions).finiteCapacity) {
      throw new TypeError('Canonical finite wall continuation requires multilevel batch wall admission');
    }
    const { acquireMlsMpmMechanicsExactMassCapture } = await import('./sphG2pGpuKernel.js');
    massCapture.g2p = await acquireMlsMpmMechanicsExactMassCapture(postMechanicsG2pResult, { device, sphParticleUpload,
      transaction: schroederSpatialEpochTransaction, generation: schroederSpatialEpochGeneration, dt: dtSeconds });
    if(!chainCapture && massCapture.g2p.sourceRead.residentClock) {
      throw new TypeError('A private chain source requires its state/clock-aware chain producer');
    }
    if(chainCapture) chainCapture.sourceClock=massCapture.g2p.sourceRead.residentClock??null;
    if(chainCapture && inputResidentProductMass!==(massCapture.g2p.sourceRead.residentProductMass??null)) {
      throw new TypeError('Private chain history differs from its original particle owner');
    }
    if (chainCapture && !massCapture.g2p.quantities && sphGpuParticleUploadExactEnergyRows(sphParticleUpload)
      && !schroederSpatialThermalProposal?.exactEnergyLedgerWords) {
      throw new TypeError('Chain closure still requires its canonical integer-energy ledger consumer');
    }
    if (massCapture.g2p.transaction !== schroederSpatialEpochTransaction
        || massCapture.g2p.generation !== schroederSpatialEpochGeneration
        || massCapture.g2p.dt !== dtSeconds) {
      throw new TypeError('Exact closure requires G2P from its original spatial transaction, generation and duration');
    }
    if (postMechanicsParticleBuffers.stateBuffer !== massCapture.g2p.stateBuffer
        || postMechanicsParticleBuffers.mechanicsBuffer !== massCapture.g2p.mechanicsBuffer) {
      throw new TypeError('Exact closure input differs from its genuine G2P output');
    }
    // The G2 energy ledger keeps the f32 product-event history: its reaction
    // reconcile flags any event mass left in it (disposition 6), so the
    // history carries no ledger mass. The rational route keeps exact history.
    const energyLedgerRoute = sphGpuParticleUploadExactEnergyRows(sphParticleUpload) != null
      && !massCapture.g2p.history;
    if (!energyLedgerRoute && (massCapture.g2p.history?.sourceHandle ?? null) !== inputResidentProductMass) {
      throw new TypeError('Exact closure history differs from the original P2G/G2P input');
    }
  }
  if (chainCapture && phaseCarrierPlanReady(sphParticleUpload?.phaseCarrierPlan || sphParticleState?.phaseCarrierPlan)
    && (!massCapture?.g2p.sourceRead.energy || massCapture.g2p.quantities)) {
    throw new TypeError('Chain phase closure requires its canonical integer mass and energy owners');
  }
  if (chainCapture && reactionTable?.reactionCount > 0
    && (!massCapture?.g2p.sourceRead.energy || massCapture.g2p.quantities || reactionTable.energyAuthority)) {
    throw new TypeError('Chain reaction closure requires its canonical integer ledger and heat-proxy law');
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
        gpuTimestampRecorder,
        // G4 reaction node scope (exact; off unless the state declares it).
        reactionDormancy: sphParticleState?.reactionDormancy && boxDimsM
          ? { boxM: Array.from(boxDimsM, Number) }
          : null
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
    // The G2 integer energy ledger runs the f32 heat-proxy reaction plus its
    // exact reconcile; the rational exact chain serves the rest.
    reactionLedgerMode = Boolean(massCapture && massCapture.seals[0]?.exactEnergy && !massCapture.seals[0]?.exactThermal
      && massCapture.g2p.sourceRead.energy && !reactionTable?.energyAuthority);
    if (massCapture && !reactionLedgerMode) {
      const { runSphExactReactionSourceSelectionWebGpu } = await import('./sphExactReactionSourceGpu.js');
      exactReactionSelection = await runSphExactReactionSourceSelectionWebGpu({ device,
        thermalResult: thermalStep, thermalSourceCapture: massCapture.tokens.get('thermalStep'),
        g2pResult: postMechanicsG2pResult, transaction: schroederSpatialEpochTransaction,
        generation: schroederSpatialEpochGeneration, sphParticleState, sphParticleUpload,
        mlsMpmParticleUpload, thermalMaterialTable, reactionTable, dtSeconds,
        reactionDiscoveryProposal: resolvedSchroederSpatialReactionDiscoveryProposal });
    }
    reactionStep = await capturedStage('reactionStep', reactionStepRunner, () => ({
      // Options tune the stage; the shared closure owns its source family,
      // material tables, physical interval and retained-output contract. Keep
      // the same precedence as thermal so the receipt describes the inputs
      // actually consumed, including the post-thermal discovery selection.
      ...noFullReactionSummaryDefaults,
      ...reactionStepOptions,
      ...(reactionLedgerMode ? { exactLedger: Object.freeze({ thermalSeal: massCapture.seals[0],
        sourceRead: massCapture.g2p.sourceRead, privateLineage: Boolean(chainCapture) }) }
        : massCapture ? { exactReactionSourceSelection: exactReactionSelection } : {}),
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
    // The reaction now owns a retained source read. Close fresh selection
    // admission; its asynchronous retirement drains that read later.
    if (exactReactionSelection) massCapture.selectionCleanup = exactReactionSelection.release();
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
    && (thermalStep || phaseSlotRefinement)
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
        phaseDormancy: phaseCarrierTransferOptions?.phaseDormancy !== undefined
          ? phaseCarrierTransferOptions.phaseDormancy
          : ((thermalStepOptions.thermalDormancy ?? sphParticleState?.thermalDormancy)?.epsilonK >= 0
              ? { epsilonK: 0 }
              : null),
        // A thermal energy record (G2 ledger) continues through the f32 split
        // plus its exact reconcile; the rational stage serves the rest.
        ...(massCapture && !reactionStep && massCapture.seals[0]?.exactEnergy && !massCapture.seals[0]?.exactThermal ? {
          exactLedger: Object.freeze({ thermalSeal: massCapture.seals[0], sourceRead: massCapture.g2p.sourceRead })
        } : massCapture && reactionStep && reactionLedgerSeal(massCapture) ? {
          exactLedger: Object.freeze({ thermalSeal: reactionLedgerSeal(massCapture),
            sourceRead: massCapture.g2p.sourceRead,
            massRead: reactionLedgerSeal(massCapture).exactLedgerReaction.carrierMassRead })
        } : massCapture ? {
          ...(reactionStep ? { exactReactionResult: reactionStep,
            exactReactionSourceCapture: massCapture.tokens.get('reactionStep') }
            : { exactThermalResult: thermalStep, exactThermalSourceCapture: massCapture.tokens.get('thermalStep') }),
          sphParticleUpload, mlsMpmParticleUpload, exactMassG2pResult: postMechanicsG2pResult,
          exactMassSpatialEpochTransaction: schroederSpatialEpochTransaction,
          exactMassSpatialEpochGeneration: schroederSpatialEpochGeneration, dtSeconds
        } : {}),
        device,
        sphParticleState,
        mlsMpmParticleState,
        thermalMaterialTable,
        mechanicsMaterialTable,
        phaseCarrierPlan,
        sourceStateBuffer: phaseCarrierSourceStateBuffer,
        sourceThermoBuffer: phaseCarrierSourceThermoBuffer,
        sourceMechanicsBuffer: phaseCarrierSourceMechanicsBuffer,
        // The interface skin rows belong to the proposal this step's canonical
        // thermal apply consumed; the transfer converts only that epoch's rows.
        interfacePhaseFront: schroederSpatialThermalProposal
          ? schroederSpatialThermalProposal.interfacePhaseFront ?? null
          : null,
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
    const deferOpticsForChainLedgerParcels = Boolean(
      chainCapture
      && massCapture
      && (
        sphGpuParticleUploadLedgerParcels(sphParticleUpload)
        ?? sphGpuParticleUploadLedgerParcels(massCapture.g2p?.sourceRead?.sourceSphUpload)
      )
      && !globalThis.__ulgDisableLedgerParcelStage
    );
    executedStageOrder.push('phase-carrier-transfer-v2');
    if (!phaseSlotRefinement && !deferOpticsForChainLedgerParcels && typeof afterPhaseCarrierTransfer === 'function') {
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
  let mechanicsRefreshSourceStateBuffer = phaseCarrierOutput.stateBuffer || (
    reactionComponentMutations.state ? reactionOutput.stateBuffer : null
  ) || thermalOutput.stateBuffer
    || farForceOutput.stateBuffer
    || postMechanicsParticleBuffers.stateBuffer;
  let mechanicsRefreshSourceThermoBuffer = phaseCarrierOutput.thermoBuffer || (
    reactionComponentMutations.thermo ? reactionOutput.thermoBuffer : null
  ) || thermalOutput.thermoBuffer
    || sphParticleUpload?.thermoBuffer;
  let mechanicsRefreshSourceMechanicsBuffer =
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
  if (phaseSlotRefinement) {
    if (!phaseCarrierTransferStep) throw new TypeError('Refinement requires the final phase-transfer producer');
    phaseSlotRefinementStep = await capturedStage('phaseSlotRefinement', runSchroederPhaseSlotRefinementWebGpu, () => ({
      device, sphParticleState, mlsMpmParticleState, sphParticleUpload, mlsMpmParticleUpload,
      sourceStateBuffer: mechanicsRefreshSourceStateBuffer,
      sourceThermoBuffer: mechanicsRefreshSourceThermoBuffer,
      sourceMechanicsBuffer: mechanicsRefreshSourceMechanicsBuffer,
      thermalMaterialTable, boxDimsM, readbackMode, phaseSlotRefinement,
      ...(massCapture ? { exactLedger: { phaseResult: phaseCarrierTransferStep,
        phaseCapture: massCapture.tokens.get('phaseCarrierTransfer'), sourceRead: massCapture.g2p.sourceRead } } : {})
    }));
    mechanicsRefreshSourceStateBuffer = phaseSlotRefinementStep.stateBuffer;
    mechanicsRefreshSourceThermoBuffer = phaseSlotRefinementStep.thermoBuffer;
    mechanicsRefreshSourceMechanicsBuffer = phaseSlotRefinementStep.mechanicsBuffer;
    executedStageOrder.push('phase-slot-refinement');
    await traceStageMechanics('phase-slot-refinement', mechanicsRefreshSourceStateBuffer,
      mechanicsRefreshSourceThermoBuffer, mechanicsRefreshSourceMechanicsBuffer);
    // Only the standard captured refresh can seal this closure-owned cleanup
    // claim. The callback is installed when continuation ownership is claimed;
    // the producer output and cleanup function never cross the module boundary.
    phaseSlotQueueRetirement = { device, capability: null, started: false, run: null, attempt: null };
    phaseSlotQueueRetirement.cleanup = () => phaseSlotQueueRetirement.run();
    phaseSlotQueueRetirement.claim = registerQueueOrderedCleanupClaim(phaseSlotRetirementIssuer, device, {
      producerOutput: phaseSlotQueueRetirement, cleanup: phaseSlotQueueRetirement.cleanup
    });
  }
  // Consume the newest private carrier state: refinement when selected, phase
  // transfer otherwise. Exchange/transport update those same mass and energy
  // records before constitutive refresh and spatial publication claim them.
  const ledgerParcels = massCapture
    ? (sphGpuParticleUploadLedgerParcels(sphParticleUpload)
      ?? sphGpuParticleUploadLedgerParcels(massCapture.g2p?.sourceRead?.sourceSphUpload))
    : null;
  const ledgerRefinementRecord = massCapture?.seals[massCapture.stageNames.indexOf('phaseSlotRefinement')]?.exactLedgerRefinement;
  const ledgerPhaseRecord = massCapture?.seals[massCapture.stageNames.indexOf('phaseCarrierTransfer')]?.exactLedgerPhase;
  const ledgerParcelRecord = ledgerRefinementRecord ?? ledgerPhaseRecord;
  let ledgerParcelStagesRan = false;
  const parcelStageCounters = (globalThis.__ulgLedgerParcelStage ??= { ran: 0, noParcels: 0, noPhaseLedger: 0, noCapture: 0 });
  if (!massCapture) parcelStageCounters.noCapture++;
  else if (!ledgerParcels) parcelStageCounters.noParcels++;
  else if (!ledgerParcelRecord) parcelStageCounters.noPhaseLedger++;
  if (chainCapture && ledgerParcels && (!ledgerParcelRecord || globalThis.__ulgDisableLedgerParcelStage)) {
    throw new TypeError('Chain parcel closure requires its enabled phase ledger producer');
  }
  if (ledgerParcels && ledgerParcelRecord && !globalThis.__ulgDisableLedgerParcelStage) {
    if (chainCapture) {
      ledgerParcelStep = await capturedStage('ledgerParcels', runSphLedgerParcelCandidateWebGpu, () => ({
        device,sphParticleState,mlsMpmParticleState,sphParticleUpload,mlsMpmParticleUpload,
        sourceStateBuffer:mechanicsRefreshSourceStateBuffer,sourceThermoBuffer:mechanicsRefreshSourceThermoBuffer,
        sourceMechanicsBuffer:mechanicsRefreshSourceMechanicsBuffer,thermalMaterialTable,dtSeconds,readbackMode,
        exactLedger:{sourceRead:massCapture.g2p.sourceRead,phaseResult:phaseCarrierTransferStep,
          phaseCapture:massCapture.tokens.get('phaseCarrierTransfer'),refinementResult:phaseSlotRefinementStep,
          refinementCapture:massCapture.tokens.get('phaseSlotRefinement')}
      }));
      mechanicsRefreshSourceStateBuffer=ledgerParcelStep.stateBuffer;
      mechanicsRefreshSourceThermoBuffer=ledgerParcelStep.thermoBuffer;
      mechanicsRefreshSourceMechanicsBuffer=ledgerParcelStep.mechanicsBuffer;
    } else {
      const { runSphLedgerParcelStagesWebGpu } = await import('./sphLedgerParcelStagesGpu.js');
      await runSphLedgerParcelStagesWebGpu({ device, parcels: ledgerParcels,
        particleCount: sphParticleState.particleCount, dtSeconds,
        stateBuffer: mechanicsRefreshSourceStateBuffer, thermoBuffer: mechanicsRefreshSourceThermoBuffer,
        mechanicsBuffer: mechanicsRefreshSourceMechanicsBuffer,
        massRead: ledgerParcelRecord.carrierMassRead, energy: ledgerParcelRecord.exactEnergy,
        thermalMaterialTable });
    }
    parcelStageCounters.ran++;
    ledgerParcelStagesRan = true;
    executedStageOrder.push('ledger-vapor-parcel-transport');
  }
  if (
    (phaseSlotRefinementStep || (chainCapture && ledgerParcelStep && phaseCarrierTransferFamilyReceipt))
    && typeof afterPhaseCarrierTransfer === 'function'
  ) {
    // Condensed lanes keep their fixed addresses through gas refinement and
    // ledger-parcel candidate staging. Produce optics against the final family
    // after parcel exchange, while all phase inputs are still retained and
    // before refresh seals their cleanup claims.
    await afterPhaseCarrierTransfer({
      phaseCarrierTransferStep,
      phaseCarrierTransferFamilyReceipt,
      opticsTerminalBuffers: Object.freeze({
        stateBuffer: mechanicsRefreshSourceStateBuffer,
        thermoBuffer: mechanicsRefreshSourceThermoBuffer
      })
    });
  }
  if (
    (thermalStep || reactionMutatesParticles || phaseSlotRefinementStep)
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
        ...(massCapture && phaseCarrierTransferStep
          && massCapture.seals[massCapture.stageNames.indexOf('phaseCarrierTransfer')]?.exactLedgerPhase ? {}
          : massCapture && phaseCarrierTransferStep ? { exactPhaseResult: phaseCarrierTransferStep,
          exactPhaseSourceCapture: massCapture.tokens.get('phaseCarrierTransfer') }
          : massCapture && reactionStep && reactionLedgerSeal(massCapture) ? {}
          : massCapture && reactionStep ? { exactReactionResult: reactionStep,
          exactReactionSourceCapture: massCapture.tokens.get('reactionStep') }
          : massCapture?.seals[0]?.exactThermal ? { exactThermalResult: thermalStep,
            exactThermalSourceCapture: massCapture.tokens.get('thermalStep'), exactMassG2pResult: postMechanicsG2pResult,
            exactMassSpatialEpochTransaction: schroederSpatialEpochTransaction,
            exactMassSpatialEpochGeneration: schroederSpatialEpochGeneration, dtSeconds, thermalMaterialTable } : {}),
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
        queueOrderedProducerClaims: [
          ...(phaseSlotQueueRetirement ? [phaseSlotQueueRetirement.claim] : []),
          ...(phaseCarrierOutputCleanupClaim
            ? [phaseCarrierOutputCleanupClaim]
            : queueOrderedFinalConsumerCapability
              ? []
            : pendingQueueOrderedCleanupClaims)
        ]
      })
    );
    mechanicsQueueOrderedFinalConsumerCapability =
        retainedStageSource(mechanicsRefreshStep)
          ?.queueOrderedFinalConsumerCapability
        ?? null;
    if (phaseSlotQueueRetirement) {
      if (!mechanicsQueueOrderedFinalConsumerCapability) throw new TypeError('Refinement refresh omitted its final submission capability');
      phaseSlotQueueRetirement.capability = mechanicsQueueOrderedFinalConsumerCapability;
    }
    if (!queueOrderedFinalConsumerCapability) {
      queueOrderedFinalConsumerCapability =
        mechanicsQueueOrderedFinalConsumerCapability;
    }
    executedStageOrder.push('mechanics-constitutive-refresh');
  }
  if (phaseSlotRefinementStep && !mechanicsRefreshStep) throw new TypeError('Refinement constitutive refresh did not execute');
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

  if (massCapture?.g2p.history) {
    const historyModule = await loadProductHistoryMerger();
    massCapture.g2p.validate();
    massCapture.motionHistory = await historyModule.publishResidentProductG2pHistoryWebGpu({ device,
      g2pResult: postMechanicsG2pResult, sphParticleUpload, inputResidentProductMass });
    replacementResidentProductMass = massCapture.motionHistory;
    massCapture.motionValidate = () => historyModule.resolveResidentProductG2pHistoryPublication(
      massCapture.motionHistory, { device, g2pResult: postMechanicsG2pResult, inputResidentProductMass });
    massCapture.motionCleanup = massCapture.motionValidate().cleanupCompletion;
  }
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
    phaseSlotRefinementStep,
    ledgerParcelStep,
    phaseCarrierPlan,
    inputResidentProductMass: massCapture?.motionHistory ?? inputResidentProductMass,
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
  const historyCapture = massCapture && (reactionStep || massCapture.motionHistory) ? massCapture : gasCapture;
  if ((residentProductMassMergeRequested && residentProductMassMergeRunnerAvailable) || historyCapture) {
    const mergeModule = historyCapture ? await loadProductHistoryMerger() : null;
    const mergeToken = historyCapture ? Object.freeze({}) : null;
    const mergeRunner = residentProductMassMergeRunner ?? mergeModule?.mergeResidentProductMassBuffersWebGpu;
    if (historyCapture && mergeRunner !== mergeModule.mergeResidentProductMassBuffersWebGpu) {
      throw new TypeError('Captured product history requires its standard merge producer');
    }
    const mergedResidentProductMass = await mergeRunner({
      device,
      inputResidentProductMass: continuationInputResidentProductMass,
      emittedResidentProductMass: continuationEmittedResidentProductMass,
      readbackTelemetryAccumulator: readbackTelemetry,
      allowHostCompactionObservation:
        readbackMode !== NO_FULL_READBACK_MODE,
      ...(historyCapture ? { postMechanicsSourceCapture: mergeToken } : {})
    });
    if (mergedResidentProductMass && mergedResidentProductMass !== continuationInputResidentProductMass
        && mergedResidentProductMass !== continuationEmittedResidentProductMass) {
      replacementResidentProductMass = mergedResidentProductMass;
    }
    if (historyCapture) {
      const mergeRecord = mergeModule.resolveResidentProductMassMergeSourceCapture(mergedResidentProductMass, mergeToken);
      historyCapture.history = mergedResidentProductMass;
      historyCapture.mergeRelease = mergeRecord.release;
      historyCapture.mergeRetire = () => {
        const retired = mergeRecord.retireOwnedOutput();
        historyCapture.motionHistory?.destroyResidentProductMassBuffers();
        return retired;
      };
      historyCapture.mergeValidate = () => mergeModule.resolveResidentProductMassMergeSourceCapture(mergedResidentProductMass, mergeToken);
      if (gasCapture && historyCapture === massCapture) gasCapture.mergeValidate = historyCapture.mergeValidate;
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
      productMassMergeRequired: historyCapture ? false : !mergedResidentProductMass,
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
    ['phase-slot-refinement', phaseSlotRefinementStep],
    ['ledger-vapor-parcel-transport', ledgerParcelStep],
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
  if (chainCapture) {
    const refresh = retainedStageSource(mechanicsRefreshStep);
    const thermal = chainCapture.seals[0];
    chainCapture.wallRecord = thermal.exactFiniteWall ?? null;
    if (resolveSphWallReservoirAuthority(thermalStepOptions).finiteCapacity && !chainCapture.wallRecord) {
      throw new TypeError('Finite wall chain requires its genuine canonical wall successor');
    }
    const phase = chainCapture.seals[chainCapture.stageNames.indexOf('phaseCarrierTransfer')];
    const reaction = chainCapture.seals[chainCapture.stageNames.indexOf('reactionStep')];
    const reactionLedger = reaction?.exactLedgerReaction;
    const refinement = chainCapture.seals[chainCapture.stageNames.indexOf('phaseSlotRefinement')];
    const refinementLedger = refinement?.exactLedgerRefinement;
    const parcels = chainCapture.seals[chainCapture.stageNames.indexOf('ledgerParcels')];
    chainCapture.parcelRecord = parcels?.exactLedgerParcels ?? null;
    if ((ledgerParcels && (!chainCapture.parcelRecord || parcels.sourcePredecessorSeal !== (refinement ?? phase)))
      || !refresh?.authorityValidationBuffer || !continuation.ready
      || (reactionStep && !reactionLedger?.validationBuffer)
      || (phaseSlotRefinementStep && (!refinementLedger || !refinement.refinementValidationBuffer
        || refinement.sourcePhaseSeal !== phase))
      || (phaseCarrierTransferStep && (!phase?.exactLedgerPhase || !phase.phaseValidationBuffer))) {
      throw new TypeError('Chain closure requires captured thermal/refresh completion and reaction/phase rollback integration');
    }
    chainCapture.producer.validate();
    for (const seal of chainCapture.seals) seal.validate();
    const originalEnergy = massCapture && !massCapture.g2p.quantities
      ? massCapture.g2p.sourceRead.energy : null;
    chainCapture.energy = chainCapture.parcelRecord?.exactEnergy ?? refinementLedger?.exactEnergy ?? phase?.exactLedgerPhase?.exactEnergy
      ?? reactionLedger?.exactEnergy
      ?? (thermal.exactThermal ? null : thermal.exactEnergy ?? null);
    chainCapture.massRead = chainCapture.parcelRecord?.carrierMassRead ?? refinementLedger?.carrierMassRead ?? phase?.exactLedgerPhase?.carrierMassRead ?? reactionLedger?.carrierMassRead ?? null;
    const closureMassRead=chainCapture.massRead
      ?? (massCapture?.g2p.sourceRead.energy?massCapture.g2p.sourceRead.read:null);
    chainCapture.lineageRecord = reactionLedger?.lineageRecord ?? null;
    const { prepareSchroederSpatialChainClosure } = await import('./schroederSpatialChainClosureGpu.js');
    chainCapture.finalization = prepareSchroederSpatialChainClosure({ device, capture: chainCapture.producer,
      residualSourceControlBuffer:massCapture?.g2p.sourceRead.residualMechanicsSource?.controlBuffer??null,
      clockOrigin:chainCapture.clockOrigin,
      sourceClock:chainCapture.sourceClock,
      original: { stateBuffer: sphParticleUpload.stateBuffer, thermoBuffer: sphParticleUpload.thermoBuffer,
        mechanicsBuffer: mlsMpmParticleUpload.mechanicsBuffer }, candidate: continuation,
      refreshValidationBuffer: refresh.authorityValidationBuffer,
      thermalValidationBuffer: thermal?.exactThermal?.validationBuffer ?? refresh.authorityValidationBuffer,
      originalQuantities: massCapture?.g2p.sourceRead.quantities ?? null,
      candidateQuantities: massCapture?.seals.at(-1)?.exactMechanics ?? null,
      originalEnergy, candidateEnergy: chainCapture.energy,
      originalMassRead: closureMassRead ? massCapture.g2p.sourceRead.read : null,
      candidateMassRead: closureMassRead,
      parcelRecord: chainCapture.parcelRecord,
      wallRecord: chainCapture.wallRecord,
      lineageRecord: chainCapture.lineageRecord,
      sourceResidualHistory: massCapture?.g2p.sourceRead.residualHistory??null,
      emittedResidualLedger: reactionLedger?.residualLedger??null,
      phaseCandidateMassRead: phase?.exactLedgerPhase?.carrierMassRead ?? null,
      refinementValidationBuffer: refinement?.refinementValidationBuffer ?? null,
      phasePredecessorMassRead: reactionLedger?.carrierMassRead ?? massCapture?.g2p.sourceRead.read ?? null,
      reactionValidationBuffer: reactionLedger?.validationBuffer ?? null,
      sourceHistoryRead: massCapture?.g2p.sourceRead.residentProductHistoryRead ?? null,
      candidateHistory: continuation.residentProductMass ?? null,
      phaseValidationBuffer: phase?.phaseValidationBuffer ?? null,
      phaseLineageCount: phaseCarrierTransferStep?.lineageCount ?? 0
    });
    const encoder = device.createCommandEncoder();
    chainCapture.finalization.encode(encoder);
    chainCapture.producer.validate();
    for (const seal of chainCapture.seals) seal.validate();
    device.queue.submit([encoder.finish()]);
  }
  const closure = {
    schema: ULG_MLS_MPM_POST_MECHANICS_CLOSURE_SCHEMA,
    status: chainCapture ? 'post-mechanics-closure-awaiting-chain-admission'
      : continuation.ready && !continuation.productMassMergeRequired
      ? 'post-mechanics-closure-complete'
      : 'post-mechanics-closure-incomplete',
    backend: postMechanicsBackend,
    authoritativeStageOrder: Object.freeze((phaseSlotRefinementStep
      ? Object.freeze(MLS_MPM_POST_MECHANICS_CLOSURE_STAGE_ORDER.flatMap(stage =>
          stage === 'phase-carrier-transfer-v2' ? [stage, 'phase-slot-refinement'] : [stage]))
      : aerosolCondensateTransition
      ? CONDENSATE_CLOSURE_STAGE_ORDER
      : MLS_MPM_POST_MECHANICS_CLOSURE_STAGE_ORDER).flatMap(stage =>
        stage === 'mechanics-constitutive-refresh' && ledgerParcelStagesRan
          ? ['ledger-vapor-parcel-transport', stage] : [stage])),
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
    phaseSlotRefinementStep,
    ledgerParcelStep,
    phaseCarrierPlan,
    continuation,
    residentProductMass: continuation.residentProductMass,
    generation: continuation.generation,
    readbackMode,
    fullParticleReadbackPerformed,
    fullParticleReadbackFree,
    residentContinuationReady: !chainCapture && residentContinuationReady,
    ...(chainCapture ? { chainAdmissionControlBuffer: chainCapture.finalization.controlBuffer } : {}),
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
  if (chainCapture) closureAuthority.chainCapture = chainCapture;
  if (phaseSlotCapture) {
    closureAuthority.phaseSlotCapture = phaseSlotCapture;
    closureAuthority.phaseSlotRefinementStep = phaseSlotRefinementStep;
    closureAuthority.phaseSlotQueueRetirement = phaseSlotQueueRetirement;
  }
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
    // Exact views remain owned by the captured producers. Registering this
    // projection as a legacy upload would misidentify their inventory owner;
    // the current gas pair instead retains the original closure read.
    if (!massCapture && !ensureSphGpuParticleBufferSetBorrowLifecycle(finalSphUpload)) {
      throw gasSourceError('Current closure upload could not install its borrow lifecycle');
    }
    const finalMlsUpload = Object.freeze({ schema: mlsMpmParticleUpload.schema,
      status: 'webgpu-uploaded', ...epoch, particleCount: gasCapture.metadata.particleCount,
      mechanicsBuffer: continuation.mechanicsBuffer,
      mechanicsStrideBytes: mlsMpmParticleUpload.mechanicsStrideBytes,
      mechanicsBufferByteLength: continuation.mechanicsBuffer.size, ownsMechanicsBuffer: false });
    gasCapture.packet = Object.freeze({ ...gasCapture.metadata,
      exactInventory: Boolean(massCapture),
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
  if (vaporAerosolExchange != null) {
    await applyPostMechanicsVaporExchange(closure, vaporAerosolExchange, timedStage, readbackTelemetry);
    aerosolCondensateTransition = closureAuthority.aerosolCondensateTransition;
  }
  Object.defineProperty(closure, 'aerosolCondensateTransition', {
    value: aerosolCondensateTransition, enumerable: false
  });
  return closure;
  } catch (error) {
    // A timing hook can reject after the refresh submitted and sealed the
    // producer claims. Keep that actual capability even when assignment of
    // the awaited stage result never completed.
    const submittedRefresh = mechanicsRefreshStep ?? completedCapturedStages.get('mechanicsRefresh');
    if (phaseSlotQueueRetirement && !retainedStageSource(submittedRefresh)?.queueOrderedFinalConsumerCapability) {
      cancelQueueOrderedCleanupClaim(phaseSlotQueueRetirement.claim, device, {
        producerOutput: phaseSlotQueueRetirement, cleanup: phaseSlotQueueRetirement.cleanup
      });
    }
    mechanicsQueueOrderedFinalConsumerCapability ??=
      retainedStageSource(submittedRefresh)?.queueOrderedFinalConsumerCapability ?? null;
    queueOrderedFinalConsumerCapability ??= mechanicsQueueOrderedFinalConsumerCapability;
    for (const stage of [thermalStep ?? completedCapturedStages.get('thermalStep'),
      reactionStep ?? completedCapturedStages.get('reactionStep')]) {
      const output = retainedStageSource(stage);
      const claims = output?.queueOrderedCleanupClaims ?? [output?.queueOrderedCleanupClaim].filter(Boolean);
      if (claims.length && queueOrderedFinalConsumerCapability && !output.queueOrderedRetainedOutputFinalConsumerCapability) {
        output.queueOrderedRetainedOutputFinalConsumerCapability = queueOrderedFinalConsumerCapability;
      }
    }
    if (chainCapture) {
      error.chainClosureCleanupCompletion = deferConfirmedSubmittedWorkCleanup(device,
        () => releaseChainClosureCapture(chainCapture));
      void error.chainClosureCleanupCompletion.catch(() => {});
    }
    releaseExactMassCapture(massCapture);
    if (phaseSlotCapture) {
      for (const seal of phaseSlotCapture.seals) seal.release();
      phaseSlotCapture.released = true;
    }
    if (exactReactionSelection) massCapture.selectionCleanup = exactReactionSelection.release();
    if (gasCapture) {
      if (!gasCapture.exactCapture) {
        for (const seal of gasCapture.seals) seal.release();
        gasCapture.mergeRelease?.();
      }
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
    deferSubmittedWorkCleanup(device, async () => {
      try {
        await Promise.all([...(massCapture?.seals.map(seal => seal.sourceCleanupCompletion?.()) ?? []),
          massCapture?.selectionCleanup, massCapture?.motionCleanup, error?.exactHistoryPublicationCleanupCompletion, error?.exactThermalSourceCleanupCompletion, error?.exactReactionSourceCleanupCompletion,
          error?.exactReactionStepCleanupCompletion, error?.exactMechanicsRefreshCleanupCompletion]);
        const cleanup = destroyFailedPostMechanicsStageOutputs({
          postMechanicsParticleBuffers,
          sphParticleUpload,
          mlsMpmParticleUpload,
          schroederFarForceDeltaFusion,
          thermalStep: thermalStep ?? completedCapturedStages.get('thermalStep'),
          reactionStep: reactionStep ?? completedCapturedStages.get('reactionStep'),
          mechanicsRefreshStep: mechanicsRefreshStep ?? completedCapturedStages.get('mechanicsRefresh'),
          phaseCarrierTransferStep: phaseCarrierTransferStep ?? completedCapturedStages.get('phaseCarrierTransfer'),
          phaseSlotRefinementStep: phaseSlotRefinementStep ?? completedCapturedStages.get('phaseSlotRefinement'),
          ledgerParcelStep: ledgerParcelStep ?? completedCapturedStages.get('ledgerParcels'),
          inputResidentProductMass,
          replacementResidentProductMass
        });
        Object.assign(failureCleanupReceipt, {
          ...cleanup,
          blockers: [...(cleanup.blockers || [])]
        });
        await Promise.resolve(cleanup.completion).then((settled) => {
          Object.assign(failureCleanupReceipt, {
            ...settled,
            blockers: [...(settled.blockers || [])]
          });
          resolveFailureCleanup(failureCleanupReceipt);
        });
      } catch (cleanupError) {
        failureCleanupReceipt.status = 'post-mechanics-failure-cleanup-blocked';
        failureCleanupReceipt.blockers.push({ reason: String(cleanupError) });
        resolveFailureCleanup(failureCleanupReceipt);
      }
    });
    throw error;
  }
}
