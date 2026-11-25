// Extracted from sphPhaseScene.js (Gate 6 Phase D mechanical decomposition).

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';
import {
  SCHROEDER_ACTIVE_NODE_ROW_LAYOUT,
  SCHROEDER_HIERARCHY_AGGREGATE_NODE_ROW_LAYOUT,
  SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_ROW_LAYOUT,
  SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_LANES,
  SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL,
  ULG_MLS_MPM_GPU_RESIDENT_STEPS_EXECUTION_SCHEMA,
  ULG_SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_EXECUTION_SCHEMA,
  ULG_SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_EXECUTION_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_ASSIGNMENT_OVERLAY_SCHEMA,
  ULG_SCHROEDER_PORTABLE_SUMMARY_SCHEMA,
  ULG_SCHROEDER_RENDER_LOD_SUMMARY_SCHEMA,
  SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_STATUS,
  ULG_SPH_GPU_RENDER_FIELD_SCHEMA,
  ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_TABLE_SCHEMA,
  ULG_SPH_GPU_REACTION_TABLE_SCHEMA,
  ULG_SPH_INTERFACE_SOURCE_KEY_SCHEMA
} from '../../ulg-gpu-abi/src/index.js';
import {
  GPU_PHASE_IDS,
  OPTICAL_GPU_RECORD_LAYOUT,
  buildOpticalGpuLookupQueries,
  buildOpticalGpuTable,
  decodeOpticalGpuLookupOutputRows,
  gpuPhaseId,
  requestOpticalGpuDevice,
  runOpticalGpuLookupWithOptionalWebGpu,
  sampleOpticalGpuTableCpu,
  stableOpticalMaterialId,
  stableOpticalStateId,
  stableOpticalStateKey,
  uploadOpticalGpuTable
} from '../runtime/material/opticalGpuBuffers.js';
import {
  SPH_GPU_PARTICLE_IDENTITY_UINTS,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
  destroyMlsMpmGpuParticleBuffers,
  destroySphGpuParticleBuffers,
  mlsMpmGpuParticleUploadMatchesDevice,
  sphGpuParticleStateHasGasCandidateIndication,
  sphGpuParticleUploadAdvertisesDispersedMediumOptics,
  sphGpuParticleUploadMatchesDevice,
  sphParticleStateRequiresExplicitIdentity,
  uploadMlsMpmGpuParticleBuffers,
  uploadSphGpuParticleBuffers
} from '../runtime/sph/sphGpuBuffers.js';
import {
  createDirectResidentPressureInterfaceGridForceAdmission,
  SCHROEDER_PHASE_VOLUME_SURFACE_STRESS_ENTRY_POINTS,
  ULG_SCHROEDER_PHASE_VOLUME_SURFACE_STRESS_SUBMISSION_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_SURFACE_STRESS_SUBMISSION_STATUS,
  ULG_PRESSURE_INTERFACE_GRID_FORCE_CONSUMPTION_ADMISSION_SCHEMA,
  pressureInterfaceForceSolverAllowsGridApplication,
  pressureInterfaceGridForceAdmissionAllowsApplication,
  runMlsMpmGridUpdateWithOptionalWebGpu
} from '../runtime/sph/sphGridUpdateGpuKernel.js';
import {
  ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA,
  ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_IMPORT_SCHEMA,
  MLS_MPM_ACTIVE_GRID_PLAN_REFRESH_MODE_EVERY_STEP,
  MLS_MPM_ACTIVE_GRID_PLAN_REFRESH_MODE_FINAL_ONLY,
  MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_EVERY_STEP,
  MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_FINAL_ONLY,
  MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_NONE,
  cloneMlsMpmParticleStateForNext,
  cloneSphParticleStateForNext,
  createMlsMpmResidentStepGpuFenceReport,
  createSchroederAdoptedParticleStorageDescriptorFromStep,
  destroyMlsMpmResidentStepBuffers,
  destroyMlsMpmResidentStepsBuffers,
  isExactQuiescentSphReactionTable,
  normalizePressureInterfaceGasCellFieldImport,
  normalizeMlsMpmActiveGridPlanRefreshMode,
  normalizeMlsMpmResidentCompactSummaryMode,
  retainedContinuationBuffersFromUploads,
  retainedGasCellFieldMetadataFromImport,
  runMlsMpmResidentStepWithOptionalWebGpu,
  runMlsMpmResidentStepsWithOptionalWebGpu,
  submitMlsMpmResidentStepsComputeTask
} from '../runtime/sph/sphMlsMpmGpuStep.js';
import {
  acquireSchroederSpatialSuccessorSourceFamilyLease,
  isFinalizedSchroederSpatialSuccessorSourceFamily,
  releaseSchroederSpatialSuccessorSourceFamilyLease,
  releaseSchroederSpatialSuccessorSourceFamilyLeaseAfter,
  retireSchroederSpatialSuccessorSourceFamilyAfterLeases,
  resolveSchroederSpatialSuccessorSourceFamily
} from '../runtime/sph/schroederSpatialSuccessorSourceFamily.js';
import {
  COLLECTIVE_DISPERSED_MEDIUM_OPTICAL_ROUTE_SCHEMA,
  collectiveOpticalRouteDescriptor
} from '../runtime/sph/sphOpticalRouteIdentity.js';
import {
  createGpuReadbackTelemetry,
  mergeGpuReadbackTelemetry,
  normalizePageVisibleGpuReadbackTelemetry
} from '../runtime/sph/sphGpuReadbackTelemetry.js';
import {
  residentProductMassDevice,
  residentProductMassMatchesDevice,
  tagWebGpuBufferDevice,
  webGpuDeviceId,
  webGpuBufferDevice
} from '../runtime/sph/sphGpuDeviceIdentity.js';
import {
  ULG_SPH_GAS_PRESSURE_AUTHORITY_TELEMETRY_SCHEMA,
  ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA,
  ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V1,
  ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V2,
  ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V3,
  ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V4,
  describeSphSpatialGasPressureAuthority,
  isExactSphSpatialGasPressureAuthoritySource
} from '../runtime/sph/sphSpatialGasLedgerEosGpu.js';
import {
  SPH_GPU_RENDER_FIELD_CELL_FLOATS,
  SPH_GPU_RENDER_ROW_FLOATS,
  SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_UINTS,
  SPH_GPU_RENDER_SURFACE_VERTEX_FLOATS,
  buildSphRenderFieldSurfaceTable,
  buildSphRenderFieldWebGpu,
  buildSphRenderMaterialMap,
  buildSphPhysicsMaterialInterfaceFieldWebGpu,
  buildSphRenderSurfaceDrawMetadataWebGpu,
  buildSphRenderSurfaceVerticesWebGpu,
  decodeSphRenderRows,
  extractSphRenderRowsWebGpu,
  SPH_RENDER_ROW_MAX_VOLUME_RATIO_J,
  splitSphRenderFieldBySurface,
  summarizeSphResidentParticleUploadWebGpu,
  summarizeSphRenderFieldSurfacesWebGpu
} from '../runtime/sph/sphRenderGpuKernel.js';
import {
  bindUlgWebGpuMarchingCubesVolumeSuccessorLineage,
  buildWebGpuMarchingCubesExtensionSurfaceRowsWebGpu,
  createUlgWebGpuMarchingCubesExtensionAdapter,
  createUlgRenderFieldBufferVolumeDescriptor,
  hasSchroederSpatialLineageClaim,
  validateUlgRenderFieldBufferVolumeSuccessorLineage,
  validateUlgWebGpuMarchingCubesExtensionExecutionSuccessorLineage,
  validateUlgWebGpuMarchingCubesSurfaceSuccessorLineage
} from '../runtime/sph/sphMarchingCubesSurfaceAdapter.js';
import {
  gasPressureInterfaceCouplingSummary,
  gasPressureInterfaceForcePreview,
  gasPressureInterfaceForceSolver,
  gasPressureSummaryFromResidentThermalPhase
} from '../runtime/sphPhaseDemo.js';
import { opticalRenderParams } from '../runtime/material/opticalClosure.js';
import {
  cancelQueueOrderedCleanupClaim,
  createQueueOrderedCleanupClaimIssuer,
  deferSubmittedWorkCleanup,
  registerQueueOrderedCleanupClaim,
  releaseSubmittedWorkCleanupQueueOrdered,
  sealQueueOrderedFinalConsumerCapability,
  submitQueueOrderedWork,
  submitQueueOrderedFinalConsumerWork
} from '../runtime/webgpuComputeLayout.js';
import {
  resolveSphThermalEnvironmentAuthority,
  resolveSphWallReservoirAuthority
} from '../runtime/thermalEnvironmentAuthority.js';
import {
  ULG_WORKER_LANE_COMPUTE_MANAGER_COMPLETION_SCHEMA,
  ULG_WORKER_OFFSCREEN_COMMITTED_RESIDENT_SCHEDULE_PRESENTATION_SCHEMA,
  ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_ENQUEUED_STATUS,
  ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_GEOMETRY,
  ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_SCHEMA,
  createUlgWorkerOffscreenPresentationBridge
} from './offscreenPresentationBridge.js';
import {
  createNativeSurfaceCommittedFinisher,
  createNativeSurfaceLatestValidationScheduler,
  createNativeSurfaceProvisionalResourceReceipt,
  createNativeSurfaceResourceOwner,
  installNativeSurfaceResourceOwner,
  markNativeSurfaceDeviceLostForCurrentOwners,
  nativeSurfaceBridgeFailureReason,
  nativeSurfaceDrawStateUsesExecution,
  nativeSurfacePreviousOwnerLineageMatches,
  prepareNativeSurfaceBridgeForForcedDisposal,
  rendererCanvasResizeRequired,
  resolveNativeSurfaceBridgeDeviceAdmission,
  resolveNativeSurfaceConsumerDeviceTransition,
  resolveNativeSurfaceCompositeDescriptorAdmission,
  resolveNativeSurfaceAnimationFramePolicy,
  resolveNativeSurfacePreSubmitDrawStateLiveness,
  resolveNativeSurfaceSubmitFailureAction,
  resolveNativeSurfaceSubmitSynchronization,
  settleNativeSurfaceProvisionalResourceReceipt,
  retireNativeRefractionTargetSet,
  resolveAdditionalNativeSurfaceGenerationAttempt,
  resolveNativeRefractionTargetSetAction,
  resolveNativeSurfaceResourceReleaseAction,
  resolveNativeSurfaceResidentStepSignature,
  resolveNativeSurfaceSuccessorPromotion,
  shouldCommitAdditionalNativeSurfaceCandidate,
  takeNativeSurfaceResourceOwners
} from './nativeSurfaceResourceLifecycle.js';


export function resolveSphSceneThermalStepOptions({
  wallTemperaturesK,
  wallReservoirAuthority = null,
  ambientTemperatureK,
  thermalEnvironmentAuthority = null,
  overrides = null
} = {}) {
  const resolvedOverrides = overrides && typeof overrides === 'object'
    ? overrides
    : {};
  const hasAmbientOverride = Object.prototype.hasOwnProperty.call(
    resolvedOverrides,
    'ambientTemperatureK'
  );
  const hasAuthorityOverride = Object.prototype.hasOwnProperty.call(
    resolvedOverrides,
    'thermalEnvironmentAuthority'
  );
  const hasWallTemperaturesOverride = Object.prototype.hasOwnProperty.call(
    resolvedOverrides,
    'wallTemperaturesK'
  );
  const hasWallAuthorityOverride = Object.prototype.hasOwnProperty.call(
    resolvedOverrides,
    'wallReservoirAuthority'
  );
  const hasWallModelOverride = Object.prototype.hasOwnProperty.call(
    resolvedOverrides,
    'wallModel'
  );
  const resolvedAuthority = resolveSphThermalEnvironmentAuthority({
    ambientTemperatureK: hasAmbientOverride
      ? resolvedOverrides.ambientTemperatureK
      : ambientTemperatureK,
    thermalEnvironmentAuthority: hasAuthorityOverride
      ? resolvedOverrides.thermalEnvironmentAuthority
      : (hasAmbientOverride ? null : thermalEnvironmentAuthority),
    source: hasAmbientOverride
      ? 'sph-phase-scene-step-override'
      : 'sph-phase-scene'
  });
  // A wall-temperature override on finite walls keeps the finite model and its
  // face capacities; the walls restart (new instance) at the set temperatures.
  const baseFiniteWalls = !hasWallAuthorityOverride
    && wallReservoirAuthority?.finiteCapacity === true
    ? wallReservoirAuthority
    : null;
  const overriddenWallModel = hasWallModelOverride
    ? resolvedOverrides.wallModel
    : (hasWallTemperaturesOverride && baseFiniteWalls
        ? baseFiniteWalls.model
        : undefined);
  const resolvedWallAuthority = resolveSphWallReservoirAuthority({
    wallTemperaturesK: hasWallTemperaturesOverride
      ? resolvedOverrides.wallTemperaturesK
      : wallTemperaturesK,
    wallReservoirAuthority: hasWallAuthorityOverride
      ? resolvedOverrides.wallReservoirAuthority
      : (
          hasWallTemperaturesOverride || hasWallModelOverride
            ? null
            : wallReservoirAuthority
        ),
    wallModel: overriddenWallModel,
    ...(baseFiniteWalls
      && (hasWallTemperaturesOverride || hasWallModelOverride)
      && overriddenWallModel === baseFiniteWalls.model
      ? {
          wallFaceHeatCapacitiesJPerK: baseFiniteWalls.faceHeatCapacitiesJPerK,
          wallMaterial: baseFiniteWalls.wallMaterial,
          wallThicknessM: baseFiniteWalls.wallThicknessM
        }
      : {}),
    source:
      hasWallTemperaturesOverride || hasWallModelOverride
        ? 'sph-phase-scene-step-override'
        : 'sph-phase-scene'
  });
  return {
    ...resolvedOverrides,
    wallTemperaturesK: { ...resolvedWallAuthority.faces },
    wallReservoirAuthority: resolvedWallAuthority,
    ambientTemperatureK: resolvedAuthority.ambientTemperatureK,
    thermalEnvironmentAuthority: resolvedAuthority
  };
}
import {
  ULG_NATIVE_SURFACE_TEMPERATURE_LAYOUT_NAME,
  ULG_NATIVE_SURFACE_TEMPERATURE_ROWS_SCHEMA,
  encodeNativeSurfaceTemperatureRowsWebGpu
} from './nativeSurfaceTemperatureWgsl.js';

// Matches the native WebGPU surface consumer's historical clear color so the
// default look is consistent across the webgl and native renderer backends
// (it was '#87ceeb' sky blue when the CPU/webgl path was the flagship view).
export const SPH_SCENE_BACKGROUND_COLOR_DEFAULT = '#18222b';
export const SPH_SCENE_LIGHTING_MODE_DEFAULT = 'normal';
export const SPH_SCENE_LIGHTING_MODE_DARK_LAB = 'dark-lab';

export function compactPageVisibleGpuReadbackTelemetry(telemetry = null) {
  return normalizePageVisibleGpuReadbackTelemetry(telemetry);
}

export function pageVisibleProductionHotLoopHostDependencyEvidence(
  telemetry = null
) {
  const compact = compactPageVisibleGpuReadbackTelemetry(telemetry);
  if (compact.productionHotLoopHostDependencyFree != null) {
    return compact.productionHotLoopHostDependencyFree;
  }
  return compact.legacyExactZeroProductionEvidence;
}

export function normalizeResidentProductMassAuthorityForPublicationRevalidation(
  authority = null
) {
  return authority === 'gpu-authored-filtered-live-prefix-revoked'
    ? 'gpu-authored-filtered-live-prefix'
    : authority;
}

const MLS_MPM_RESIDENT_EXECUTION_SETTLEMENT_CAPABILITIES = Object.freeze([
  'schroederBackgroundSettlementPromise'
]);

export function markMlsMpmResidentExecutionStale(execution, {
  startGeneration,
  currentGeneration,
  reason = 'resident-execution-generation-stale'
} = {}) {
  const staleExecution = {
    ...execution,
    stale: true,
    staleReason: reason,
    residentExecutionGeneration: startGeneration,
    currentResidentExecutionGeneration: currentGeneration
  };
  for (const capability of MLS_MPM_RESIDENT_EXECUTION_SETTLEMENT_CAPABILITIES) {
    const descriptor = execution && typeof execution === 'object'
      ? Object.getOwnPropertyDescriptor(execution, capability)
      : null;
    if (!descriptor) continue;
    Object.defineProperty(staleExecution, capability, descriptor);
  }
  return staleExecution;
}

export async function settleSupersededMlsMpmResidentExecutions({
  previousSettlement = null,
  pendingExecutions = [],
  publishedExecutions = []
} = {}) {
  if (previousSettlement?.then) {
    const previousSettled = await previousSettlement;
    if (previousSettled !== true) {
      const error = new Error(
        'prior resident execution generation handoff was not confirmed'
      );
      error.code = 'ERR_MLS_MPM_RESIDENT_GENERATION_HANDOFF_UNCONFIRMED';
      throw error;
    }
  }
  const executionOwners = [...new Set([
    ...(Array.isArray(pendingExecutions) ? pendingExecutions : []),
    ...(Array.isArray(publishedExecutions) ? publishedExecutions : [])
  ].filter(Boolean))];
  const executions = await Promise.all(
    executionOwners.map((owner) => Promise.resolve(owner))
  );
  const backgroundSettlements = [...new Set(executions
    .map((execution) => execution?.schroederBackgroundSettlementPromise)
    .filter((settlement) => settlement?.then))];
  const confirmations = await Promise.all(
    backgroundSettlements.map((settlement) => Promise.resolve(settlement))
  );
  if (confirmations.some((confirmed) => confirmed !== true)) {
    const error = new Error(
      'superseded resident execution background settlement was not confirmed'
    );
    error.code = 'ERR_MLS_MPM_RESIDENT_GENERATION_HANDOFF_UNCONFIRMED';
    throw error;
  }
  return true;
}

export function schroederHierarchyArtifactLedgerSettlementEvidence(summary = null) {
  const resources = summary?.resources && typeof summary.resources === 'object'
    ? Object.values(summary.resources)
    : [];
  const resourceCount = Number.isInteger(summary?.resourceCount)
    ? summary.resourceCount
    : null;
  const unretiredOwnedResources = resources.filter((resource) => (
    resource?.owned === true
    && resource?.destroyed !== true
    && resource?.externallyOwned !== true
  ));
  const unsafeUnretiredOwnedResources = unretiredOwnedResources.filter((resource) => !(
    resource?.transfer?.status === 'active'
    && ['ledger-consumer', 'external-owner'].includes(
      resource.transfer.retirementAuthority
    )
  ));
  const blockers = Array.isArray(summary?.blockers) ? summary.blockers : [];
  const resourceInventoryComplete = resourceCount !== null
    && resourceCount === resources.length;
  const unretiredOwnedResourceCountMatches = Number.isInteger(
    summary?.unretiredOwnedResourceCount
  ) && summary.unretiredOwnedResourceCount === unretiredOwnedResources.length;
  const safe = Boolean(
    summary
    && summary.retirementScheduled === true
    && summary.retirementCompleted === true
    && summary.failedDestroyResourceCount === 0
    && blockers.length === 0
    && resourceInventoryComplete
    && unretiredOwnedResourceCountMatches
    && unsafeUnretiredOwnedResources.length === 0
  );
  return {
    schema: summary?.schema ?? null,
    ledgerId: summary?.ledgerId ?? null,
    hierarchyGenerationId: summary?.generationId ?? null,
    spatialEpochGenerationId: summary?.spatialEpochGenerationId ?? null,
    status: summary?.status ?? null,
    resourceCount,
    ownedResourceCount: summary?.ownedResourceCount ?? null,
    borrowedResourceCount: summary?.borrowedResourceCount ?? null,
    transferredResourceCount: summary?.transferredResourceCount ?? null,
    pendingTransferCount: summary?.pendingTransferCount ?? null,
    retirementAttemptedResourceCount:
      summary?.retirementAttemptedResourceCount ?? null,
    destroyedResourceCount: summary?.destroyedResourceCount ?? null,
    failedDestroyResourceCount: summary?.failedDestroyResourceCount ?? null,
    unretiredOwnedResourceCount: summary?.unretiredOwnedResourceCount ?? null,
    unsafeUnretiredOwnedResourceCount: unsafeUnretiredOwnedResources.length,
    resourceInventoryComplete,
    unretiredOwnedResourceCountMatches,
    retirementScheduled: summary?.retirementScheduled === true,
    retirementCompleted: summary?.retirementCompleted === true,
    blockerCount: blockers.length,
    blockers: [...blockers],
    safe
  };
}

export async function settleSchroederSpatialEpochBatchEvidence({
  settlements = [],
  expectedCount
} = {}) {
  if (
    !Number.isInteger(expectedCount)
    || expectedCount < 1
    || !Array.isArray(settlements)
    || settlements.length !== expectedCount
  ) {
    const error = new Error(
      `Schroeder spatial epoch batch has ${settlements?.length ?? 0}/${expectedCount ?? 'unknown'} release hooks`
    );
    error.code = 'ERR_SCHROEDER_SPATIAL_EPOCH_BATCH_RELEASE_HOOKS';
    throw error;
  }
  for (const settlement of settlements) {
    const missingHooks = [
      typeof settlement?.releasePromise?.then === 'function'
        ? null
        : 'releasePromise',
      typeof settlement?.currentTransactionSummary === 'function'
        ? null
        : 'currentTransactionSummary',
      typeof settlement?.currentGenerationSummary === 'function'
        ? null
        : 'currentGenerationSummary',
      typeof settlement?.artifactRetirementPromise?.then === 'function'
        ? null
        : 'artifactRetirementPromise',
      typeof settlement?.currentArtifactLedgerSummary === 'function'
        ? null
        : 'currentArtifactLedgerSummary'
    ].filter(Boolean);
    if (missingHooks.length > 0) {
      const transactionSummary = typeof settlement?.currentTransactionSummary === 'function'
        ? settlement.currentTransactionSummary()
        : null;
      const generationSummary = typeof settlement?.currentGenerationSummary === 'function'
        ? settlement.currentGenerationSummary()
        : null;
      const error = new Error(
        `Schroeder spatial epoch batch step ${settlement?.index ?? 'unknown'} lacks owner settlement hooks: ${missingHooks.join(', ')}; transaction=${transactionSummary?.state ?? 'none'} generation=${generationSummary?.status ?? 'none'} selected=${generationSummary?.selected === true}`
      );
      error.code = 'ERR_SCHROEDER_SPATIAL_EPOCH_BATCH_RELEASE_HOOKS';
      throw error;
    }
  }
  let releaseConfirmations;
  try {
    releaseConfirmations = await Promise.all(
      settlements.map(({ releasePromise }) => Promise.resolve(releasePromise))
    );
    await Promise.all(
      settlements.map(({ artifactRetirementPromise }) => (
        Promise.resolve(artifactRetirementPromise)
      ))
    );
  } catch (cause) {
    const error = new Error('Schroeder spatial epoch batch owner settlement rejected');
    error.code = 'ERR_SCHROEDER_SPATIAL_EPOCH_BATCH_RELEASE_REJECTED';
    error.cause = cause;
    throw error;
  }
  return settlements.map((settlement, settlementIndex) => {
    const transactionSummary = settlement.currentTransactionSummary();
    const generationSummary = settlement.currentGenerationSummary();
    const artifactLedgerSummary = settlement.currentArtifactLedgerSummary();
    const artifactLedgerEvidence =
      schroederHierarchyArtifactLedgerSettlementEvidence(artifactLedgerSummary);
    if (
      releaseConfirmations[settlementIndex] !== true
      || transactionSummary?.state !== 'released'
      || transactionSummary?.counters?.releaseCount !== 1
      || !Number.isInteger(transactionSummary?.generationId)
      || transactionSummary.generationId !== generationSummary?.generationId
      || transactionSummary.generationId
        !== artifactLedgerEvidence.spatialEpochGenerationId
      || ![
        'spatial-epoch-generation-released-after-final-consumer',
        'spatial-epoch-generation-released-queue-ordered-after-exact-successor',
        'spatial-epoch-generation-released-queue-ordered-after-final-consumer'
      ].includes(generationSummary?.releaseStatus)
      || generationSummary?.releaseAttemptCount !== 1
      || generationSummary?.releaseFailureCount !== 0
      || artifactLedgerEvidence.safe !== true
    ) {
      const error = new Error(
        `Schroeder spatial epoch ${transactionSummary?.generationId ?? 'unknown'} did not complete its owner settlement`
      );
      error.code = 'ERR_SCHROEDER_SPATIAL_EPOCH_BATCH_RELEASE_UNCONFIRMED';
      error.transactionSummary = transactionSummary;
      error.generationSummary = generationSummary;
      error.artifactLedgerSummary = artifactLedgerEvidence;
      throw error;
    }
    return {
      ...settlement,
      transactionSummary,
      generationSummary,
      artifactLedgerSummary: artifactLedgerEvidence
    };
  });
}

export const SPH_SCENE_LIGHTING_PROFILES = Object.freeze({
  normal: Object.freeze({
    mode: 'normal',
    ambientIntensity: 1.4,
    hemisphereIntensity: 0.9,
    keyIntensity: 1.1,
    fillIntensity: 0.5,
    environmentIntensity: 1,
    nativeAmbientSuppression: 0,
    nativeDirectSuppression: 0,
    nativeEnvironmentSuppression: 0,
    containerWireOpacity: 0.6,
    containerGridOpacity: 1,
    nativeContainerWireOpacity: 0.42
  }),
  'dark-lab': Object.freeze({
    mode: 'dark-lab',
    ambientIntensity: 0.03,
    hemisphereIntensity: 0,
    keyIntensity: 0,
    fillIntensity: 0,
    environmentIntensity: 0,
    nativeAmbientSuppression: 1,
    nativeDirectSuppression: 1,
    nativeEnvironmentSuppression: 1,
    containerWireOpacity: 0.1,
    containerGridOpacity: 0.06,
    nativeContainerWireOpacity: 0.08
  })
});
export const ULG_PRESENTATION_WORKER_RETAINED_STATE_PROMOTION_CANDIDATE_SCHEMA =
  'peercompute.ulg.presentation-worker-retained-state-promotion-candidate.v0';
export const ULG_PRESENTATION_WORKER_RETAINED_STATE_PROMOTION_CANDIDATE_READY_STATUS =
  'presentation-worker-retained-state-promotion-candidate-ready';
export const ULG_PRESENTATION_WORKER_RETAINED_STATE_PROMOTION_PENDING_ADMISSION_STATUS =
  'pending-state-manager-admission-worker-local-retained-refs';
export const ULG_REMOTE_TASK_GRAPH_COMPACT_BUFFER_SNAPSHOT_SCHEMA =
  'peercompute.ulg.remote-task-graph-compact-buffer-snapshot.v0';
export const ULG_WORKER_RETAINED_PORTABLE_MATERIALIZATION_CONTRACT_SCHEMA =
  'peercompute.ulg.worker-retained-portable-materialization-contract.v0';
export const ULG_PRESENTATION_WORKER_RETAINED_COMPACT_SNAPSHOT_EXPORT_SCHEMA =
  'peercompute.ulg.presentation-worker-retained-compact-snapshot-export.v0';
export const ULG_SPH_SCENE_SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_STATUS_SCHEMA =
  'peercompute.ulg.sph-scene-schroeder-phase-volume-diagnostic-status.v0';
export const ULG_SPH_SCENE_SCHROEDER_PHASE_VOLUME_ASSIGNMENT_OVERLAY_FEEDBACK_SCHEMA =
  'peercompute.ulg.sph-scene-schroeder-phase-volume-assignment-overlay-feedback.v0';
export const ULG_SPH_SCENE_SCHROEDER_RENDER_SOURCE_SCHEMA =
  'peercompute.ulg.sph-scene-schroeder-render-source.v0';
export const ULG_SPH_SCENE_SCHROEDER_RENDER_PROXY_DESCRIPTOR_PLAN_SCHEMA =
  'peercompute.ulg.sph-scene-schroeder-render-proxy-descriptor-plan.v0';
export const ULG_SPH_SCENE_SCHROEDER_RENDER_PROXY_DESCRIPTOR_SCHEMA =
  'peercompute.ulg.sph-scene-schroeder-render-proxy-descriptor.v0';
export const ULG_SPH_SCENE_SCHROEDER_RENDER_PROXY_VISIBLE_CONSUMER_SCHEMA =
  'peercompute.ulg.sph-scene-schroeder-render-proxy-visible-consumer.v0';
export const ULG_SPH_SCENE_SCHROEDER_RENDER_PROXY_DRAW_SOURCE_SCHEMA =
  'peercompute.ulg.sph-scene-schroeder-render-proxy-draw-source.v0';
export const ULG_SPH_SCENE_SCHROEDER_RENDER_PROXY_BACKEND_SELECTION_SCHEMA =
  'peercompute.ulg.sph-scene-schroeder-render-proxy-backend-selection.v0';
export const ULG_SPH_SCENE_SCHROEDER_RENDER_PROXY_NATIVE_EXECUTOR_SCHEMA =
  'peercompute.ulg.sph-scene-schroeder-render-proxy-native-executor.v0';
export const ULG_SPH_SCENE_SCHROEDER_SOURCE_KEY_REPLAY_DIAGNOSTICS_SCHEMA =
  'peercompute.ulg.schroeder-source-key-replay-diagnostics.v0';
export const SPH_SCHROEDER_RENDER_PROXY_ACTIVE_NODE_FLOATS =
  SCHROEDER_ACTIVE_NODE_ROW_LAYOUT.length;
export const SPH_SCHROEDER_RENDER_PROXY_AGGREGATE_NODE_FLOATS =
  SCHROEDER_HIERARCHY_AGGREGATE_NODE_ROW_LAYOUT.length;
export const SPH_SCHROEDER_RENDER_PROXY_NATIVE_CAMERA_FLOATS = 24;
export const SPH_SCHROEDER_RENDER_PROXY_NATIVE_BATCH_FLOATS = 8;

const SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_FIELD_INDEX = Object.freeze(
  Object.fromEntries(SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_ROW_LAYOUT.map((entry, index) => [
    String(entry).split(':')[0],
    index
  ]))
);

const SCHROEDER_PHASE_VOLUME_REFINE_PRESSURE_REASONS = Object.freeze([
  [1, 'aggregate-missing-or-interface-pressure'],
  [2, 'conservation-residual-pressure'],
  [4, 'sparse-surface-preserve-fine-pressure'],
  [8, 'reaction-front-pressure-reserved'],
  [16, 'wall-boundary-pressure-reserved'],
  [32, 'shock-or-high-gradient-pressure-reserved']
]);

function normalizeHexColor(value) {
  const raw = String(value ?? '').trim();
  const six = raw.match(/^#?([0-9a-f]{6})$/i);
  if (six) return `#${six[1].toLowerCase()}`;
  const three = raw.match(/^#?([0-9a-f]{3})$/i);
  if (!three) return null;
  const [r, g, b] = three[1].toLowerCase();
  return `#${r}${r}${g}${g}${b}${b}`;
}

export function normalizeSphSceneBackgroundColorHex(
  value,
  fallback = SPH_SCENE_BACKGROUND_COLOR_DEFAULT
) {
  return normalizeHexColor(value)
    || normalizeHexColor(fallback)
    || SPH_SCENE_BACKGROUND_COLOR_DEFAULT;
}

export function normalizeSphSceneLightingMode(
  value,
  fallback = SPH_SCENE_LIGHTING_MODE_DEFAULT
) {
  const normalized = String(value ?? '').trim().toLowerCase().replace(/[_\s]+/g, '-');
  if (['dark', 'darklab', SPH_SCENE_LIGHTING_MODE_DARK_LAB].includes(normalized)) {
    return SPH_SCENE_LIGHTING_MODE_DARK_LAB;
  }
  if (['normal', 'default', 'lit'].includes(normalized)) {
    return SPH_SCENE_LIGHTING_MODE_DEFAULT;
  }
  const normalizedFallback = String(fallback ?? '').trim().toLowerCase().replace(/[_\s]+/g, '-');
  return ['dark', 'darklab', SPH_SCENE_LIGHTING_MODE_DARK_LAB].includes(normalizedFallback)
    ? SPH_SCENE_LIGHTING_MODE_DARK_LAB
    : SPH_SCENE_LIGHTING_MODE_DEFAULT;
}

export function resolveSphSceneLightingProfile(value) {
  return SPH_SCENE_LIGHTING_PROFILES[normalizeSphSceneLightingMode(value)];
}

export function nativeSurfaceBackgroundCoverScale({
  imageWidth,
  imageHeight,
  canvasWidth,
  canvasHeight
} = {}) {
  const sourceWidth = Math.max(1, Number(imageWidth) || 1);
  const sourceHeight = Math.max(1, Number(imageHeight) || 1);
  const targetWidth = Math.max(1, Number(canvasWidth) || 1);
  const targetHeight = Math.max(1, Number(canvasHeight) || 1);
  const imageAspect = sourceWidth / sourceHeight;
  const canvasAspect = targetWidth / targetHeight;
  return imageAspect > canvasAspect
    ? [canvasAspect / imageAspect, 1]
    : [1, imageAspect / canvasAspect];
}

function schroederPhaseVolumeDiagnosticField(row, fieldName) {
  const index = SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_FIELD_INDEX[fieldName];
  return Number.isInteger(index) ? finiteNumberOrNull(row?.[index]) : null;
}

function schroederPhaseVolumeDiagnosticCount(row, fieldName) {
  const value = schroederPhaseVolumeDiagnosticField(row, fieldName);
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : null;
}

function schroederPhaseVolumeRefinePressureReasons(mask) {
  const numericMask = Math.max(0, Math.round(Number(mask ?? 0)));
  if (!Number.isFinite(numericMask) || numericMask === 0) return [];
  return SCHROEDER_PHASE_VOLUME_REFINE_PRESSURE_REASONS
    .filter(([bit]) => (numericMask & bit) !== 0)
    .map(([, reason]) => reason);
}

function normalizeSchroederPhaseVolumeDiagnosticSummaryRow(summary = null) {
  const rows = summary?.summaryRows ?? summary?.summaryRow ?? null;
  if (rows instanceof Float32Array) return Array.from(rows);
  if (ArrayBuffer.isView(rows)) return Array.from(rows);
  if (!Array.isArray(rows)) return null;
  const first = rows[0];
  if (Array.isArray(first) || ArrayBuffer.isView(first)) return Array.from(first);
  return [...rows];
}

function schroederPhaseVolumeNextTickAssignmentOverlayFromExecution(residentExecution = null) {
  const sourceStep = residentExecution?.finalStep
    || residentExecution?.residentStep
    || residentExecution
    || null;
  return residentExecution?.schroederPhaseVolumeNextTickAssignmentOverlay
    || sourceStep?.schroederPhaseVolumeNextTickAssignmentOverlay
    || residentExecution?.phaseVolumeAssignmentOverlayFeedback?.phaseVolumeAssignmentOverlay
    || sourceStep?.phaseVolumeAssignmentOverlayFeedback?.phaseVolumeAssignmentOverlay
    || null;
}

export function createSchroederPhaseVolumeAssignmentOverlayFeedbackCacheEntry({
  residentExecution = null,
  residentExecutionGeneration = null,
  currentResidentExecutionGeneration = null,
  source = 'resident-step-publication'
} = {}) {
  const sourceStep = residentExecution?.finalStep
    || residentExecution?.residentStep
    || residentExecution
    || null;
  const overlay = schroederPhaseVolumeNextTickAssignmentOverlayFromExecution(residentExecution);
  const inferredGeneration = finiteNumberOrNull(
    residentExecutionGeneration
      ?? residentExecution?.residentExecutionGeneration
      ?? sourceStep?.residentExecutionGeneration
  );
  const currentGeneration = finiteNumberOrNull(
    currentResidentExecutionGeneration
      ?? residentExecution?.currentResidentExecutionGeneration
      ?? sourceStep?.currentResidentExecutionGeneration
      ?? inferredGeneration
  );
  const rowCount = Math.max(0, Math.round(Number(
    overlay?.phaseVolumeAssignmentOverlayRowCount
      ?? overlay?.levelUpdateRowCount
      ?? 0
  ) || 0));
  const retainedLevelUpdateBuffer = Boolean(overlay?.levelUpdateBuffer);
  const schemaReady =
    overlay?.schema === ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_ASSIGNMENT_OVERLAY_SCHEMA;
  const overlayEnabled = overlay?.phaseVolumeAssignmentOverlayEnabled === true;
  const noRawGpuBufferTransfer = overlay?.rawGpuBufferTransferAllowed !== true;
  const noFullParticleReadback = overlay?.fullParticleReadbackRequired !== true;
  const ready = Boolean(
    schemaReady
      && overlayEnabled
      && rowCount > 0
      && retainedLevelUpdateBuffer
      && noRawGpuBufferTransfer
      && noFullParticleReadback
  );
  const status = ready
    ? 'schroeder-phase-volume-assignment-overlay-feedback-ready'
    : (!overlay
        ? 'schroeder-phase-volume-assignment-overlay-feedback-empty'
        : (!schemaReady
            ? 'schroeder-phase-volume-assignment-overlay-feedback-blocked-schema-mismatch'
            : (!overlayEnabled
                ? 'schroeder-phase-volume-assignment-overlay-feedback-disabled'
                : (!retainedLevelUpdateBuffer
                    ? 'schroeder-phase-volume-assignment-overlay-feedback-blocked-retained-buffer-required'
                    : (!noRawGpuBufferTransfer || !noFullParticleReadback
                        ? 'schroeder-phase-volume-assignment-overlay-feedback-blocked-nonportable-transfer-required'
                        : 'schroeder-phase-volume-assignment-overlay-feedback-blocked-empty-overlay')))));
  const entry = {
    schema: ULG_SPH_SCENE_SCHROEDER_PHASE_VOLUME_ASSIGNMENT_OVERLAY_FEEDBACK_SCHEMA,
    status,
    ready,
    source,
    sourceSchema: residentExecution?.schema ?? null,
    sourceStatus: residentExecution?.status ?? null,
    sourceStepSchema: sourceStep?.schema ?? null,
    sourceStepStatus: sourceStep?.status ?? null,
    residentExecutionGeneration: inferredGeneration,
    currentResidentExecutionGeneration: currentGeneration,
    overlaySchema: overlay?.schema ?? null,
    overlayStatus: overlay?.status ?? null,
    overlayConsumerStatus: overlay?.consumerStatus ?? null,
    levelUpdateRowCount: rowCount,
    rowAlignedWithParticles: overlay?.rowAlignedWithParticles === true,
    sparseOverlayIndexRequired: overlay?.sparseOverlayIndexRequired === true,
    overlayIndexMode: overlay?.overlayIndexMode ?? null,
    sparseOverlayIndexStatus: overlay?.sparseOverlayIndexStatus ?? null,
    retainedLevelUpdateBuffer,
    levelUpdateBufferByteLength: overlay?.levelUpdateBufferByteLength ?? 0,
    transferMode: overlay?.transferMode ?? null,
    sameDeviceOnly: true,
    peerComputePortable: false,
    descriptorOnlyPeerComputeHandoff: true,
    rawGpuBufferTransferAllowed: false,
    fullParticleReadbackRequired: overlay?.fullParticleReadbackRequired === true,
    nativeLevelSource: ready
      ? 'phase-volume-level-update-target-level'
      : 'level-assignment-native-support-radius',
    selectedLevelSource: ready
      ? 'state-manager-admitted-phase-volume-level-update'
      : 'configured-selected-schroeder-level',
    phaseVolumeAssignmentOverlay: ready ? overlay : null
  };
  if (ready && typeof sourceStep?.releaseSchroederHierarchyArtifactTransfers === 'function') {
    let released = false;
    Object.defineProperty(entry, 'releaseSchroederPhaseVolumeOverlayTransfer', {
      enumerable: false,
      value: ({
        reason = 'phase-volume-overlay-cache-owner-released',
        queueOrderedFinalConsumer = null
      } = {}) => {
        if (released) return false;
        const releaseOptions = {
          transferClass: 'next-tick',
          families: 'phase-volume-level-update',
          reason,
          submitted: true
        };
        if (queueOrderedFinalConsumer != null) {
          releaseOptions.queueOrderedFinalConsumer =
            queueOrderedFinalConsumer;
        }
        sourceStep.releaseSchroederHierarchyArtifactTransfers(releaseOptions);
        released = true;
        return true;
      }
    });
  }
  return entry;
}

export function summarizeSchroederPhaseVolumeAssignmentOverlayFeedback(feedback = null) {
  if (!feedback) {
    return {
      schema: ULG_SPH_SCENE_SCHROEDER_PHASE_VOLUME_ASSIGNMENT_OVERLAY_FEEDBACK_SCHEMA,
      status: 'schroeder-phase-volume-assignment-overlay-feedback-empty',
      ready: false,
      rawGpuBufferTransferAllowed: false,
      fullParticleReadbackRequired: false
    };
  }
  const { phaseVolumeAssignmentOverlay: _phaseVolumeAssignmentOverlay, ...summary } = feedback;
  return {
    ...summary,
    rawGpuBufferTransferAllowed: false,
    descriptorOnlyPeerComputeHandoff: true
  };
}

export function summarizeSchroederPhaseVolumeDiagnosticStatus(residentExecution = null) {
  const sourceStep = residentExecution?.finalStep || residentExecution || null;
  const sourceMechanics = sourceStep?.schroederSameLevelMechanics
    || residentExecution?.schroederSameLevelMechanics
    || null;
  const sourceSummary = sourceStep?.phaseVolumeDiagnosticSummary
    || sourceStep?.schroederPhaseVolumeDiagnosticSummary
    || residentExecution?.phaseVolumeDiagnosticSummary
    || residentExecution?.schroederPhaseVolumeDiagnosticSummary
    || sourceMechanics?.phaseVolumeDiagnosticSummary
    || null;
  const sourceStatus = sourceStep?.phaseVolumeDiagnosticSummaryStatus
    || sourceStep?.schroederPhaseVolumeDiagnosticSummaryStatus
    || residentExecution?.phaseVolumeDiagnosticSummaryStatus
    || residentExecution?.schroederPhaseVolumeDiagnosticSummaryStatus
    || sourceMechanics?.phaseVolumeDiagnosticSummaryStatus
    || sourceSummary?.status
    || null;
  const phaseVolumeAssignmentOverlayFeedback = summarizeSchroederPhaseVolumeAssignmentOverlayFeedback(
    sourceStep?.schroederPhaseVolumeAssignmentOverlayFeedback
      || residentExecution?.schroederPhaseVolumeAssignmentOverlayFeedback
      || sourceStep?.phaseVolumeAssignmentOverlayFeedback
      || residentExecution?.phaseVolumeAssignmentOverlayFeedback
      || null
  );
  if (
    !sourceSummary
    && !sourceStatus
    && phaseVolumeAssignmentOverlayFeedback.ready !== true
  ) {
    return null;
  }
  const row = normalizeSchroederPhaseVolumeDiagnosticSummaryRow(sourceSummary);
  const activeUpdateCount = schroederPhaseVolumeDiagnosticCount(row, 'activeUpdateCount');
  const steamExpansionCandidateCount = schroederPhaseVolumeDiagnosticCount(row, 'steamExpansionCandidateCount');
  const visibleMigrationCount = schroederPhaseVolumeDiagnosticCount(row, 'visibleMigrationCount');
  const levelChangedCount = schroederPhaseVolumeDiagnosticCount(row, 'levelChangedCount');
  const migrationRowCount = schroederPhaseVolumeDiagnosticCount(row, 'migrationRowCount');
  const maxPositiveLevelDelta = schroederPhaseVolumeDiagnosticField(row, 'maxPositiveLevelDelta');
  const totalRestVolumeM3 = schroederPhaseVolumeDiagnosticField(row, 'totalRestVolumeM3');
  const totalRepresentedVolumeM3 = schroederPhaseVolumeDiagnosticField(row, 'totalRepresentedVolumeM3');
  const refinePressureCount = schroederPhaseVolumeDiagnosticCount(row, 'refinePressureCount');
  const refinePressureReasonMask = schroederPhaseVolumeDiagnosticField(row, 'refinePressureReasonMask');
  const refinePressureReasons = schroederPhaseVolumeRefinePressureReasons(refinePressureReasonMask);
  const selectedLevel = finiteNumberOrNull(
    sourceStep?.selectedLevel
      ?? sourceStep?.schroederSelectedLevel
      ?? residentExecution?.selectedLevel
      ?? residentExecution?.schroederSelectedLevel
      ?? sourceMechanics?.selectedLevel
      ?? sourceStep?.portableSummary?.renderLod?.selectedLevel
      ?? residentExecution?.portableSummary?.renderLod?.selectedLevel
      ?? sourceMechanics?.portableSummary?.renderLod?.selectedLevel
  );
  const sourceParticleCount = finiteNumberOrNull(
    sourceStep?.phaseVolumeMigration?.particleCount
      ?? sourceStep?.schroederPhaseVolumeMigration?.particleCount
      ?? residentExecution?.phaseVolumeMigration?.particleCount
      ?? residentExecution?.schroederPhaseVolumeMigration?.particleCount
      ?? sourceMechanics?.phaseVolumeMigrationParticleCount
      ?? sourceMechanics?.sourceParticleCount
      ?? sourceStep?.particleCount
      ?? residentExecution?.particleCount
  );
  const particleCountGrowthFactor = sourceParticleCount > 0 && migrationRowCount != null
    ? migrationRowCount / sourceParticleCount
    : null;
  const volumeExpansionRatio = totalRestVolumeM3 > 0 && totalRepresentedVolumeM3 != null
    ? totalRepresentedVolumeM3 / totalRestVolumeM3
    : null;
  const representedRadiusScale = volumeExpansionRatio != null && volumeExpansionRatio > 0
    ? Math.cbrt(volumeExpansionRatio)
    : null;
  const expectedLevelDelta = representedRadiusScale != null && representedRadiusScale > 0
    ? Math.log2(representedRadiusScale)
    : null;
  const expectedPositiveLevelDelta = expectedLevelDelta != null && expectedLevelDelta > 0.01;
  const observedPositiveLevelUpdateDelta = maxPositiveLevelDelta != null && maxPositiveLevelDelta > 0.01;
  const levelUpdateChanged = observedPositiveLevelUpdateDelta || (levelChangedCount ?? 0) > 0;
  const phaseVolumeExpansionDetected = Boolean(
    expectedPositiveLevelDelta
      && (steamExpansionCandidateCount ?? 0) > 0
      && volumeExpansionRatio != null
      && volumeExpansionRatio >= 1
  );
  const migrationObserved = Boolean(
    phaseVolumeExpansionDetected
      || (steamExpansionCandidateCount ?? 0) > 0
      || (visibleMigrationCount ?? 0) > 0
      || (levelChangedCount ?? 0) > 0
  );
  const levelUpdateConsumed = sourceStep?.phaseVolumeLevelUpdateStatus === 'schroeder-phase-volume-level-update-submitted'
    || sourceStep?.phaseVolumeLevelUpdate?.status === 'schroeder-phase-volume-level-update-submitted'
    || sourceStep?.schroederPhaseVolumeLevelUpdate?.status === 'schroeder-phase-volume-level-update-submitted'
    || residentExecution?.phaseVolumeLevelUpdateStatus === 'schroeder-phase-volume-level-update-submitted'
    || residentExecution?.schroederPhaseVolumeLevelUpdateStatus === 'schroeder-phase-volume-level-update-submitted'
    || sourceMechanics?.phaseVolumeLevelUpdateStatus === 'schroeder-phase-volume-level-update-submitted';
  const retainedLevelUpdateBuffer = Boolean(
    sourceStep?.phaseVolumeLevelUpdate?.retainedLevelUpdateBuffer
      ?? sourceStep?.phaseVolumeLevelUpdate?.levelUpdateBuffer
      ?? sourceStep?.schroederPhaseVolumeLevelUpdate?.retainedLevelUpdateBuffer
      ?? sourceStep?.schroederPhaseVolumeLevelUpdate?.levelUpdateBuffer
      ?? residentExecution?.phaseVolumeLevelUpdate?.retainedLevelUpdateBuffer
      ?? residentExecution?.phaseVolumeLevelUpdate?.levelUpdateBuffer
      ?? residentExecution?.schroederPhaseVolumeLevelUpdate?.retainedLevelUpdateBuffer
      ?? sourceMechanics?.phaseVolumeLevelUpdateRetainedBuffer
  );
  const noFullParticleReadback = sourceSummary
    ? sourceSummary.fullParticleReadbackPerformed !== true && sourceSummary.fullReadbackPerformed !== true
    : null;
  const status = row
    ? 'schroeder-phase-volume-visible-diagnostics-ready'
    : (phaseVolumeAssignmentOverlayFeedback.ready === true
        ? 'schroeder-phase-volume-feedback-diagnostics-ready'
        : 'schroeder-phase-volume-visible-diagnostics-missing-summary-row');
  return {
    schema: ULG_SPH_SCENE_SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_STATUS_SCHEMA,
    status,
    sourceSchema: residentExecution?.schema ?? null,
    sourceStatus: residentExecution?.status ?? null,
    sourceStepSchema: sourceStep?.schema ?? null,
    sourceStepStatus: sourceStep?.status ?? null,
    phaseVolumeDiagnosticSummarySchema:
      sourceSummary?.schema ?? ULG_SCHROEDER_PHASE_VOLUME_DIAGNOSTIC_SUMMARY_EXECUTION_SCHEMA,
    phaseVolumeDiagnosticSummaryStatus: sourceStatus,
    phaseVolumeMigrationStatus:
      sourceStep?.phaseVolumeMigrationStatus
      ?? residentExecution?.phaseVolumeMigrationStatus
      ?? sourceMechanics?.phaseVolumeMigrationStatus
      ?? null,
    phaseVolumeLevelUpdateStatus:
      sourceStep?.phaseVolumeLevelUpdateStatus
      ?? residentExecution?.phaseVolumeLevelUpdateStatus
      ?? sourceMechanics?.phaseVolumeLevelUpdateStatus
      ?? null,
    phaseVolumeAssignmentOverlayFeedbackStatus: phaseVolumeAssignmentOverlayFeedback.status,
    phaseVolumeAssignmentOverlayFeedbackReady: phaseVolumeAssignmentOverlayFeedback.ready === true,
    phaseVolumeAssignmentOverlayFeedbackRowCount:
      phaseVolumeAssignmentOverlayFeedback.levelUpdateRowCount ?? 0,
    phaseVolumeAssignmentOverlayFeedbackIndexRequired:
      phaseVolumeAssignmentOverlayFeedback.sparseOverlayIndexRequired === true,
    phaseVolumeAssignmentOverlayFeedbackRawGpuBufferTransferAllowed:
      phaseVolumeAssignmentOverlayFeedback.rawGpuBufferTransferAllowed === true,
    phaseVolumeNextTickAssignmentOverlayStatus:
      sourceStep?.phaseVolumeNextTickAssignmentOverlayStatus
      ?? residentExecution?.phaseVolumeNextTickAssignmentOverlayStatus
      ?? sourceMechanics?.phaseVolumeNextTickAssignmentOverlayStatus
      ?? null,
    phaseVolumeNextTickAssignmentOverlayConsumerStatus:
      sourceStep?.phaseVolumeNextTickAssignmentOverlayConsumerStatus
      ?? residentExecution?.phaseVolumeNextTickAssignmentOverlayConsumerStatus
      ?? sourceMechanics?.phaseVolumeNextTickAssignmentOverlayConsumerStatus
      ?? null,
    visibleStressCaseStatus: sourceSummary?.visibleStressCaseStatus ?? null,
    readbackPolicy: sourceSummary?.readbackPolicy ?? 'compact-summary-only-no-particle-readback',
    compactSummaryReadbackPerformed: sourceSummary?.compactSummaryReadbackPerformed ?? null,
    fullReadbackPerformed: sourceSummary?.fullReadbackPerformed ?? null,
    fullParticleReadbackPerformed: sourceSummary?.fullParticleReadbackPerformed ?? null,
    noFullParticleReadback,
    selectedLevel,
    nativeLevelSource: levelUpdateConsumed
      ? 'state-manager-admitted-phase-volume-level-update'
      : (selectedLevel != null ? 'configured-or-portable-selected-level' : null),
    phaseVolumeLevelUpdateConsumed: levelUpdateConsumed,
    phaseVolumeLevelUpdateRetainedBuffer: retainedLevelUpdateBuffer,
    summaryRowCount: sourceSummary?.summaryRowCount ?? (row ? 1 : 0),
    summaryStrideFloats: sourceSummary?.summaryStrideFloats ?? row?.length ?? null,
    migrationRowCount,
    sourceParticleCount,
    particleCountGrowthFactor,
    activeUpdateCount,
    coarsenEligibleCount: schroederPhaseVolumeDiagnosticCount(row, 'coarsenEligibleCount'),
    refineRequiredCount: schroederPhaseVolumeDiagnosticCount(row, 'refineRequiredCount'),
    aggregateCoherentCount: schroederPhaseVolumeDiagnosticCount(row, 'aggregateCoherentCount'),
    conservationResidualIssueCount:
      schroederPhaseVolumeDiagnosticCount(row, 'conservationResidualIssueCount'),
    refinePressureCount,
    refinePressureReasonMask,
    refinePressureReasons,
    refinePressurePolicyStatus: (refinePressureCount ?? 0) > 0
      ? 'phase-volume-refine-pressure-detected'
      : 'phase-volume-refine-pressure-clear',
    minSourceLevelId: activeUpdateCount > 0
      ? schroederPhaseVolumeDiagnosticField(row, 'minSourceLevelId')
      : null,
    maxSourceLevelId: activeUpdateCount > 0
      ? schroederPhaseVolumeDiagnosticField(row, 'maxSourceLevelId')
      : null,
    minTargetLevelId: activeUpdateCount > 0
      ? schroederPhaseVolumeDiagnosticField(row, 'minTargetLevelId')
      : null,
    maxTargetLevelId: activeUpdateCount > 0
      ? schroederPhaseVolumeDiagnosticField(row, 'maxTargetLevelId')
      : null,
    maxPositiveLevelDelta,
    maxNegativeLevelDelta: schroederPhaseVolumeDiagnosticField(row, 'maxNegativeLevelDelta'),
    totalRestVolumeM3,
    totalRepresentedVolumeM3,
    representedToRestVolumeRatio: volumeExpansionRatio,
    representedRadiusScale,
    expectedLevelDeltaFromVolume: expectedLevelDelta,
    expectedPositiveLevelDelta,
    expectedWaterToSteamLevelDelta: Math.log2(Math.cbrt(700)),
    observedPositiveLevelDelta: maxPositiveLevelDelta,
    observedPositiveLevelUpdateDelta,
    phaseVolumeLevelUpdateChanged: levelUpdateChanged,
    phaseVolumeExpansionDetected,
    phaseVolumeUpdateEffectStatus: levelUpdateChanged
      ? 'admitted-phase-volume-level-update-changed-level'
      : (phaseVolumeExpansionDetected
          ? 'phase-volume-expansion-detected-without-additional-level-change'
          : 'phase-volume-expansion-not-detected'),
    expectedObservedLevelDeltaAgreement:
      expectedLevelDelta != null && maxPositiveLevelDelta != null
        ? Math.abs(maxPositiveLevelDelta - expectedLevelDelta)
        : null,
    totalAggregateMassKg: schroederPhaseVolumeDiagnosticField(row, 'totalAggregateMassKg'),
    totalAggregateRepresentedVolumeM3:
      schroederPhaseVolumeDiagnosticField(row, 'totalAggregateRepresentedVolumeM3'),
    totalAbsAggregateMassResidualKg:
      schroederPhaseVolumeDiagnosticField(row, 'totalAbsAggregateMassResidualKg'),
    totalAbsAggregateVolumeResidualM3:
      schroederPhaseVolumeDiagnosticField(row, 'totalAbsAggregateVolumeResidualM3'),
    steamExpansionCandidateCount,
    admittedUpdateCount: schroederPhaseVolumeDiagnosticCount(row, 'admittedUpdateCount'),
    stateAdmissionRequiredCount:
      schroederPhaseVolumeDiagnosticCount(row, 'stateAdmissionRequiredCount'),
    visibleMigrationCount,
    aggregateMissingCount: schroederPhaseVolumeDiagnosticCount(row, 'aggregateMissingCount'),
    levelChangedCount,
    summaryModeId: schroederPhaseVolumeDiagnosticField(row, 'summaryModeId'),
    migrationEpoch: schroederPhaseVolumeDiagnosticField(row, 'migrationEpoch'),
    stateFamilyId: schroederPhaseVolumeDiagnosticField(row, 'stateFamilyId'),
    capacityStatus: schroederPhaseVolumeDiagnosticField(row, 'capacityStatus'),
    waterToSteamScaleMigrationObserved: migrationObserved,
    waterToSteamStressCaseStatus: migrationObserved
      ? 'water-to-steam-level-migration-observable'
      : (sourceSummary?.visibleStressCaseStatus || 'water-to-steam-level-migration-not-observed'),
    particleExplosionAvoidanceStatus: migrationObserved
      ? 'phase-volume-level-migration-represented-without-particle-count-growth'
      : 'phase-volume-level-migration-not-observed',
    particleCountGrowthStatus: particleCountGrowthFactor == null
      ? 'particle-count-growth-not-measured'
      : (particleCountGrowthFactor <= 1
          ? 'particle-count-stable-or-reduced'
          : 'particle-count-growth-observed'),
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function schroederRenderSourceCount(value, fallback = 0) {
  if (value == null || value === '') return fallback;
  const number = Math.round(Number(value));
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function schroederRenderSourcePositiveNumber(value, fallback = null) {
  if (value == null || value === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function schroederRenderSourceRawGpuBufferTransferDetected(retainedRefs = []) {
  if (!Array.isArray(retainedRefs)) return false;
  return retainedRefs.some((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    return Object.hasOwn(entry, 'buffer')
      || Object.hasOwn(entry, 'gpuBuffer')
      || (
        entry.transferMode
        && entry.transferMode !== 'descriptor-only-no-raw-gpubuffer-transfer'
      );
  });
}

function normalizeSchroederRetainedProxySourceRef(entry = null) {
  if (!entry || typeof entry !== 'object') return null;
  if (Object.hasOwn(entry, 'buffer') || Object.hasOwn(entry, 'gpuBuffer')) return null;
  const family = String(entry.family || entry.schema || '').trim();
  const role = String(entry.role || '').trim();
  const transferMode = String(entry.transferMode || '').trim();
  const sourceFamily =
    entry.sourceFamily
    ?? entry.schroederSpatialSourceFamily
    ?? null;
  if (!family && !role) return null;
  if (transferMode && transferMode !== 'descriptor-only-no-raw-gpubuffer-transfer') return null;
  return {
    family: entry.family || null,
    role: entry.role || null,
    sourceFamily,
    sourceFamilyRole: entry.sourceFamilyRole || null,
    sourceFamilyStatus:
      entry.sourceFamilyStatus
      ?? sourceFamily?.status
      ?? null,
    sourceDeviceId:
      entry.sourceDeviceId
      ?? entry.deviceId
      ?? sourceFamily?.deviceId
      ?? null,
    sourceGenerationId: entry.sourceGenerationId ?? null,
    sourceEpochIdentity: entry.sourceEpochIdentity
      ?? entry.schroederSpatialSuccessorEpochIdentity
      ?? null,
    positionAuthority: entry.positionAuthority || null,
    finalContinuationAuthority:
      entry.finalContinuationAuthority === true,
    coherentSolidAuthority: entry.coherentSolidAuthority === true,
    schema: entry.schema || null,
    status: entry.status || null,
    retained: Boolean(entry.retained),
    retainedBufferRef: entry.retainedBufferRef || entry.ref || entry.resourceKey || null,
    rowCount: schroederRenderSourceCount(entry.rowCount, 0),
    strideFloats: schroederRenderSourceCount(entry.strideFloats, 0),
    byteLength: schroederRenderSourceCount(entry.byteLength, 0),
    transferMode: transferMode || 'descriptor-only-no-raw-gpubuffer-transfer'
  };
}

function schroederRenderProxyFinalCommittedFamilyRefFailure(
  ref,
  finalSuccessorSourceFamily,
  refIndex
) {
  const failure = (blocker, reason) => ({
    refIndex,
    family: ref?.family ?? null,
    role: ref?.role ?? null,
    blocker,
    reason
  });
  if (
    ref?.sourceFamilyRole !== 'committed-successor-x-n-plus-1'
    || ref?.finalContinuationAuthority !== true
  ) {
    return failure(
      'schroeder-render-proxy-source-not-final-committed-family',
      'proxy reference is not branded as an authoritative committed successor'
    );
  }
  if (
    finalSuccessorSourceFamily?.deviceId != null
    && ref?.sourceDeviceId !== finalSuccessorSourceFamily.deviceId
  ) {
    return failure(
      'schroeder-render-proxy-source-device-mismatch',
      'proxy reference and final successor belong to different WebGPU devices'
    );
  }
  if (ref?.sourceFamily !== finalSuccessorSourceFamily) {
    return failure(
      'schroeder-render-proxy-source-family-mismatch',
      'proxy reference does not retain the exact finalized successor family'
    );
  }
  if (
    ref?.sourceFamilyStatus !== finalSuccessorSourceFamily?.status
    || ref?.sourceGenerationId !== finalSuccessorSourceFamily?.sourceGenerationId
  ) {
    return failure(
      'schroeder-render-proxy-source-generation-mismatch',
      'proxy reference generation does not match the final successor family'
    );
  }
  if (
    ref?.sourceEpochIdentity
      !== finalSuccessorSourceFamily?.successorEpochIdentity
  ) {
    return failure(
      'schroeder-render-proxy-source-epoch-mismatch',
      'proxy reference does not retain the exact successor epoch identity'
    );
  }
  if (
    ref?.positionAuthority !== finalSuccessorSourceFamily?.positionAuthority
  ) {
    return failure(
      'schroeder-render-proxy-source-position-authority-mismatch',
      'proxy reference position authority does not match the final successor family'
    );
  }
  return null;
}

export function validateSchroederRenderProxyFinalCommittedFamilyRefs({
  retainedRefs = [],
  finalSuccessorSourceFamily = null,
  required = false
} = {}) {
  const refs = Array.isArray(retainedRefs)
    ? retainedRefs
      .map(normalizeSchroederRetainedProxySourceRef)
      .filter(Boolean)
    : [];
  if (!required) {
    return {
      status: 'schroeder-render-proxy-final-committed-family-refs-not-required',
      required: false,
      ready: true,
      blocker: null,
      refCount: refs.length,
      invalidRefCount: 0,
      failures: []
    };
  }
  if (!finalSuccessorSourceFamily) {
    return {
      status: 'blocked-schroeder-render-proxy-final-committed-family-refs',
      required: true,
      ready: false,
      blocker: 'schroeder-render-proxy-final-successor-family-missing',
      refCount: refs.length,
      invalidRefCount: refs.length,
      failures: []
    };
  }
  if (refs.length === 0) {
    return {
      status: 'blocked-schroeder-render-proxy-final-committed-family-refs',
      required: true,
      ready: false,
      blocker: 'schroeder-render-proxy-final-successor-refs-missing',
      refCount: 0,
      invalidRefCount: 0,
      failures: []
    };
  }
  const failures = refs
    .map((ref, refIndex) => (
      schroederRenderProxyFinalCommittedFamilyRefFailure(
        ref,
        finalSuccessorSourceFamily,
        refIndex
      )
    ))
    .filter(Boolean);
  return {
    status: failures.length === 0
      ? 'schroeder-render-proxy-final-committed-family-refs-ready'
      : 'blocked-schroeder-render-proxy-final-committed-family-refs',
    required: true,
    ready: failures.length === 0,
    blocker: failures[0]?.blocker ?? null,
    refCount: refs.length,
    invalidRefCount: failures.length,
    failures
  };
}

function schroederRetainedSourceRefMatches(ref = null, matchers = []) {
  if (!ref) return false;
  const family = String(ref.family || '').toLowerCase();
  const role = String(ref.role || '').toLowerCase();
  const schema = String(ref.schema || '').toLowerCase();
  return matchers.some((matcher) => (
    family.includes(matcher)
    || role.includes(matcher)
    || schema.includes(matcher)
  ));
}

function selectSchroederRetainedProxySourceRefs(retainedRefs = []) {
  const refs = Array.isArray(retainedRefs)
    ? retainedRefs.map(normalizeSchroederRetainedProxySourceRef).filter(Boolean)
    : [];
  const activeLeafSourceRef = refs.find((ref) => schroederRetainedSourceRefMatches(ref, [
    'active-node-list',
    'render-lod-leaf-source',
    'activenodes'
  ])) || null;
  const aggregateSourceRef = refs.find((ref) => schroederRetainedSourceRefMatches(ref, [
    'hierarchy-aggregate-node',
    'spatial-aggregate-render-proxy-source',
    'coherent-aggregate-render-proxy-source',
    'aggregatenodes'
  ])) || null;
  const lawQueueSourceRef = refs.find((ref) => schroederRetainedSourceRefMatches(ref, [
    'law-queue',
    'near-field-law-work',
    'lawqueue'
  ])) || null;
  return {
    refs,
    activeLeafSourceRef,
    aggregateSourceRef,
    lawQueueSourceRef,
    retainedSourceRefCount: refs.filter((ref) => ref.retained).length,
    descriptorSourceRefCount: refs.length
  };
}

function resolveSchroederRenderLodInputs({
  residentExecution = null,
  finalStep = null,
  schroederPortableSummary = null,
  schroederRenderLodSummary = null,
  schroederPortableSummaryAdmission = null
} = {}) {
  const sourceStep = finalStep || residentExecution?.finalStep || residentExecution || null;
  const portable = schroederPortableSummary
    || sourceStep?.portableSummary
    || residentExecution?.portableSummary
    || schroederPortableSummaryAdmission?.portableSummary
    || null;
  const renderLod = schroederRenderLodSummary
    || portable?.renderLod
    || sourceStep?.renderLod
    || residentExecution?.renderLod
    || schroederPortableSummaryAdmission?.renderLod
    || null;
  return { sourceStep, portable, renderLod };
}

export function resolveSchroederRenderFinalContinuation({
  sourceStep = null,
  residentExecution = null
} = {}) {
  const candidates = [
    ['source-step-next-particle-uploads', sourceStep?.nextParticleUploads],
    ['source-step-resident-step-next-particle-uploads', sourceStep?.residentStep?.nextParticleUploads],
    [
      'source-step-schroeder-mechanics-next-particle-uploads',
      sourceStep?.schroederSameLevelMechanics?.nextParticleUploads
    ],
    ['resident-execution-next-particle-uploads', residentExecution?.nextParticleUploads],
    ['resident-final-step-next-particle-uploads', residentExecution?.finalStep?.nextParticleUploads],
    [
      'resident-final-step-resident-step-next-particle-uploads',
      residentExecution?.finalStep?.residentStep?.nextParticleUploads
    ],
    [
      'resident-final-step-schroeder-mechanics-next-particle-uploads',
      residentExecution?.finalStep?.schroederSameLevelMechanics?.nextParticleUploads
    ]
  ];
  for (const [evidence, uploads] of candidates) {
    const sphUpload = uploads?.sphParticleUpload ?? null;
    const mlsUpload = uploads?.mlsMpmParticleUpload ?? null;
    const particleCount = sphUpload?.particleCount;
    if (
      sphUpload?.stateBuffer
      && sphUpload?.thermoBuffer
      && sphUpload?.identityBuffer
      && mlsUpload?.mechanicsBuffer
      && Number.isInteger(particleCount)
      && particleCount > 0
      && mlsUpload.particleCount === particleCount
    ) {
      return {
        exists: true,
        evidence,
        uploads,
        sphUpload,
        mlsUpload,
        particleCount
      };
    }
  }
  return {
    exists: false,
    evidence: null,
    uploads: null,
    sphUpload: null,
    mlsUpload: null,
    particleCount: 0
  };
}

export function schroederRenderContinuationRequiresSourceFamily({
  sourceStep = null,
  residentExecution = null,
  uploads = null,
  renderOnlyWorkerSnapshotAdmitted = false
} = {}) {
  // A terminal worker snapshot is a presentation-only, cross-device mirror.
  // It has already been bound to the exact schedule/lane/state, terminal
  // fence, StateManager commit, slot identity, and particle identity rows by
  // resolveWorkerLaneNativeSurfacePresentationSource. The worker-private
  // successor family is a physics-continuation capability and must not cross
  // into this page-owned renderer. Ordinary Schroeder continuations retain
  // the strict source-family requirement below.
  if (renderOnlyWorkerSnapshotAdmitted === true) return false;
  return Boolean(
    uploads?.schroederSpatialSuccessorSourceFamily
    || sourceStep?.schroederSimulation === true
    || sourceStep?.residentStep?.schroederSimulation === true
    || sourceStep?.schroederSameLevelMechanics
    || residentExecution?.schroederSimulation === true
    || residentExecution?.residentExecutionPolicy?.schroederSimulation === true
    || residentExecution?.schroederSameLevelMechanics
    || residentExecution?.finalStep?.schroederSimulation === true
    || residentExecution?.finalStep?.residentStep?.schroederSimulation === true
    || residentExecution?.finalStep?.schroederSameLevelMechanics
  );
}

function schroederRenderFinalSuccessorLineageValid(
  sourceFamily,
  finalContinuation
) {
  if (!isFinalizedSchroederSpatialSuccessorSourceFamily(sourceFamily)) {
    return false;
  }
  if (!finalContinuation?.exists) return true;
  if (
    finalContinuation.uploads?.schroederSpatialSuccessorSourceFamily
      !== sourceFamily
  ) {
    return false;
  }
  const device = webGpuBufferDevice(finalContinuation.sphUpload.stateBuffer);
  if (!device) return false;
  try {
    resolveSchroederSpatialSuccessorSourceFamily(sourceFamily, {
      device,
      particleCount: finalContinuation.particleCount,
      stateBuffer: finalContinuation.sphUpload.stateBuffer,
      thermoBuffer: finalContinuation.sphUpload.thermoBuffer,
      identityBuffer: finalContinuation.sphUpload.identityBuffer,
      mechanicsBuffer: finalContinuation.mlsUpload.mechanicsBuffer
    });
    return true;
  } catch {
    return false;
  }
}

export function schroederSpatialSuccessorSourceFamiliesFromResidentExecution(
  execution = null
) {
  if (!execution || typeof execution !== 'object') return [];
  const steps = [
    execution,
    execution.finalStep,
    execution.residentStep,
    ...(Array.isArray(execution.retainedSteps) ? execution.retainedSteps : [])
  ].filter(Boolean);
  const candidates = [];
  for (const step of steps) {
    candidates.push(
      step.schroederSpatialSuccessorSourceFamily,
      step.nextParticleUploads?.schroederSpatialSuccessorSourceFamily,
      step.residentStep?.schroederSpatialSuccessorSourceFamily,
      step.residentStep?.nextParticleUploads?.schroederSpatialSuccessorSourceFamily,
      step.schroederSameLevelMechanics?.schroederSpatialSuccessorSourceFamily,
      step.schroederSameLevelMechanics
        ?.nextParticleUploads
        ?.schroederSpatialSuccessorSourceFamily
    );
  }
  return [...new Set(candidates.filter(
    (sourceFamily) => isFinalizedSchroederSpatialSuccessorSourceFamily(sourceFamily)
  ))];
}

/**
 * Revoke one published continuation before its particle buffers can be reused.
 * The caller owns the exact consumer queue fence and must release through the
 * returned closure after its submission. A previously drained owner path can
 * use an already-settled owner fence; the active compute lease remains the
 * retirement gate.
 */
export function beginSchroederSpatialSuccessorSourceFamilyConsumption({
  sourceFamily = null,
  device = null,
  particleCount = sourceFamily?.particleCount,
  stateBuffer = null,
  thermoBuffer = null,
  identityBuffer = null,
  mechanicsBuffer = null,
  consumerStage = 'schroeder-resident-continuation-consumer',
  retirementReason = 'schroeder resident continuation superseded',
  ownerFence = Promise.resolve()
} = {}) {
  if (!sourceFamily) return null;
  const lease = acquireSchroederSpatialSuccessorSourceFamilyLease(
    sourceFamily,
    { device, consumerStage }
  );
  let resolution;
  let retirementPromise;
  try {
    // Resolve while the family is still active, then keep its exact private
    // assignment alive with the consumer lease until the submitted mechanics
    // work drains. Retirement revokes future consumers without forcing this
    // admitted next-tick consumer to rebuild the same classifier.
    resolution = resolveSchroederSpatialSuccessorSourceFamily(
      sourceFamily,
      {
        device,
        particleCount,
        stateBuffer,
        thermoBuffer,
        identityBuffer,
        mechanicsBuffer
      }
    );
    retirementPromise =
      retireSchroederSpatialSuccessorSourceFamilyAfterLeases(
        sourceFamily,
        {
          device,
          reason: retirementReason,
          after: ownerFence
        }
      );
  } catch (error) {
    releaseSchroederSpatialSuccessorSourceFamilyLease(
      sourceFamily,
      lease,
      { device }
    );
    throw error;
  }
  let releasePromise = null;
  return Object.freeze({
    sourceFamily,
    sourceFamilyLease: lease,
    levelAssignment: resolution.levelAssignment,
    levelAssignmentSeal: resolution.levelAssignmentSeal,
    retirementPromise,
    releaseAfter(after = null) {
      if (!releasePromise) {
        const attempt =
          releaseSchroederSpatialSuccessorSourceFamilyLeaseAfter(
            sourceFamily,
            lease,
            { device, after }
          );
        releasePromise = attempt;
        attempt.catch(() => {
          if (releasePromise === attempt) releasePromise = null;
        });
      }
      return releasePromise;
    }
  });
}

export function createSchroederRenderSourceMetadata({
  residentExecution = null,
  finalStep = null,
  schroederPortableSummary = null,
  schroederRenderLodSummary = null,
  schroederPortableSummaryAdmission = null,
  renderOwnershipPolicy = null,
  source = 'resident-render-refresh'
} = {}) {
  const { sourceStep, portable, renderLod } = resolveSchroederRenderLodInputs({
    residentExecution,
    finalStep,
    schroederPortableSummary,
    schroederRenderLodSummary,
    schroederPortableSummaryAdmission
  });
  const policy = renderOwnershipPolicy && typeof renderOwnershipPolicy === 'object'
    ? renderOwnershipPolicy
    : {};
  const retainedRefs = Array.isArray(portable?.retainedRefs) ? portable.retainedRefs : [];
  const proxySourceRefs = selectSchroederRetainedProxySourceRefs(retainedRefs);
  const finalContinuation = resolveSchroederRenderFinalContinuation({
    sourceStep,
    residentExecution
  });
  const finalSuccessorSourceFamily =
    sourceStep?.schroederSpatialSuccessorSourceFamily
    ?? sourceStep?.nextParticleUploads?.schroederSpatialSuccessorSourceFamily
    ?? finalContinuation.uploads?.schroederSpatialSuccessorSourceFamily
    ?? sourceStep?.residentStep?.schroederSpatialSuccessorSourceFamily
    ?? residentExecution?.schroederSpatialSuccessorSourceFamily
    ?? null;
  const finalSuccessorLineageValid =
    schroederRenderFinalSuccessorLineageValid(
      finalSuccessorSourceFamily,
      finalContinuation
    );
  const finalCommittedSuccessorExists = Boolean(
    finalContinuation.exists || finalSuccessorLineageValid
  );
  const finalSuccessorLineageMissing = Boolean(
    finalContinuation.exists && !finalSuccessorLineageValid
  );
  const finalCommittedFamilyRequired = finalCommittedSuccessorExists;
  const finalCommittedProxySourceRefValidation =
    validateSchroederRenderProxyFinalCommittedFamilyRefs({
      retainedRefs: proxySourceRefs.refs,
      finalSuccessorSourceFamily,
      required: finalCommittedFamilyRequired
    });
  const retainedProxyIsPreIntegration = proxySourceRefs.refs.some(
    (ref) => ref.sourceFamilyRole === 'canonical-pre-integration-x-n'
  );
  const staleFinalContinuationProxyBlocked = Boolean(
    finalCommittedSuccessorExists && retainedProxyIsPreIntegration
  );
  const portablePresent = Boolean(portable);
  const renderLodPresent = Boolean(renderLod);
  if (!portablePresent && !renderLodPresent && !policy.schroederRenderLodSummaryPresent) return null;

  const portableSchemaAccepted = !portablePresent || portable.schema === ULG_SCHROEDER_PORTABLE_SUMMARY_SCHEMA;
  const renderLodSchemaAccepted = !renderLodPresent || renderLod.schema === ULG_SCHROEDER_RENDER_LOD_SUMMARY_SCHEMA;
  const transferMode = portable?.transferMode || policy.schroederPortableSummaryTransferMode || null;
  const portableSummaryMode = portable?.portableSummaryMode || policy.schroederPortableSummaryMode || null;
  const descriptorOnlyTransfer = Boolean(
    policy.schroederPortableSummaryDescriptorOnlyTransfer === true
      || !portablePresent
      || transferMode === 'peercompute-portable-summary-descriptors'
      || portableSummaryMode === 'portable-descriptors-not-raw-gpubuffers'
  );
  const rawGpuBufferTransferDetected = Boolean(
    policy.schroederPortableSummaryRawGpuBufferTransferDetected === true
      || schroederRenderSourceRawGpuBufferTransferDetected(retainedRefs)
  );
  const fullParticleReadbackRequired = Boolean(
    portable?.fullParticleReadbackRequired === true
      || renderLod?.fullParticleReadbackRequired === true
      || policy.schroederRenderLodFullParticleReadbackRequired === true
  );
  const policyPresentationReadyVeto = Boolean(
    policy.schroederRenderLodPresentationReady === false
    && !portablePresent
    && !renderLodPresent
  );
  const presentationReady = Boolean(
    renderLodPresent
      && portableSchemaAccepted
      && renderLodSchemaAccepted
      && descriptorOnlyTransfer
      && !rawGpuBufferTransferDetected
      && !fullParticleReadbackRequired
      && !policyPresentationReadyVeto
      && !staleFinalContinuationProxyBlocked
      && (!finalCommittedFamilyRequired || (
        finalSuccessorLineageValid
        && finalCommittedProxySourceRefValidation.ready
      ))
  );
  const admissionStatus = schroederPortableSummaryAdmission?.status || null;
  const admissionPublished = Boolean(
    admissionStatus === 'schroeder-portable-summary-admission-published'
      || admissionStatus === 'schroeder-portable-summary-admitted'
  );
  let blocker = null;
  if (!presentationReady) {
    if (finalSuccessorLineageMissing) {
      blocker = 'schroeder-render-final-successor-lineage-missing';
    } else if (staleFinalContinuationProxyBlocked) {
      blocker = 'schroeder-render-proxy-source-not-final-committed-family';
    } else if (
      finalCommittedFamilyRequired
      && !finalCommittedProxySourceRefValidation.ready
    ) {
      blocker = finalCommittedProxySourceRefValidation.blocker;
    } else if (!renderLodPresent) {
      blocker = 'schroeder-render-lod-summary-missing';
    } else if (!portableSchemaAccepted) {
      blocker = 'schroeder-portable-summary-schema-mismatch';
    } else if (!renderLodSchemaAccepted) {
      blocker = 'schroeder-render-lod-summary-schema-mismatch';
    } else if (!descriptorOnlyTransfer) {
      blocker = 'schroeder-portable-summary-not-descriptor-only';
    } else if (rawGpuBufferTransferDetected) {
      blocker = 'schroeder-portable-summary-raw-gpubuffer-transfer-detected';
    } else if (fullParticleReadbackRequired) {
      blocker = 'schroeder-render-lod-summary-requires-full-particle-readback';
    } else {
      blocker = policy.schroederRenderLodBlocker || 'schroeder-render-lod-summary-not-ready';
    }
  }
  const status = presentationReady
    ? (admissionPublished
      ? 'schroeder-render-source-admitted'
      : 'schroeder-render-source-local-observation-ready')
    : 'blocked-schroeder-render-source';
  const activeLeafProxyCount = schroederRenderSourceCount(
    renderLod?.activeLeafProxyCount ?? policy.schroederRenderLodActiveLeafProxyCount,
    0
  );
  const aggregateProxyCount = schroederRenderSourceCount(
    renderLod?.aggregateProxyCount ?? policy.schroederRenderLodAggregateProxyCount,
    0
  );
  const lawQueueProxyCount = schroederRenderSourceCount(
    renderLod?.lawQueueProxyCount ?? policy.schroederRenderLodLawQueueProxyCount,
    0
  );
  return {
    schema: ULG_SPH_SCENE_SCHROEDER_RENDER_SOURCE_SCHEMA,
    status,
    blocker,
    source,
    sourceSchema: residentExecution?.schema ?? null,
    sourceStatus: residentExecution?.status ?? null,
    sourceStepSchema: sourceStep?.schema ?? null,
    sourceStepStatus: sourceStep?.status ?? null,
    portableSummarySchema: portable?.schema || policy.schroederPortableSummarySchema || null,
    portableSummaryStatus: portable?.status || policy.schroederPortableSummaryStatus || null,
    portableSummaryMode,
    portableSummaryTransferMode: transferMode,
    portableSummaryDescriptorOnlyTransfer: descriptorOnlyTransfer,
    portableSummaryRetainedRefCount: schroederRenderSourceCount(
      portable?.retainedRefCount ?? policy.schroederPortableSummaryRetainedRefCount,
      retainedRefs.length
    ),
    portableSummaryRetainedBufferRefCount: schroederRenderSourceCount(
      portable?.retainedBufferRefCount ?? policy.schroederPortableSummaryRetainedBufferRefCount,
      0
    ),
    retainedProxySourceRefs: proxySourceRefs.refs,
    retainedProxySourceRefCount: proxySourceRefs.retainedSourceRefCount,
    descriptorProxySourceRefCount: proxySourceRefs.descriptorSourceRefCount,
    activeLeafSourceRef: proxySourceRefs.activeLeafSourceRef,
    aggregateProxySourceRef: proxySourceRefs.aggregateSourceRef,
    lawQueueSourceRef: proxySourceRefs.lawQueueSourceRef,
    retainedProxySourceFamilyRole: retainedProxyIsPreIntegration
      ? 'canonical-pre-integration-x-n'
      : null,
    finalCommittedFamilyRequired,
    finalCommittedSuccessorExists,
    finalCommittedSuccessorEvidence: finalContinuation.evidence,
    finalCommittedSuccessorParticleCount: finalContinuation.particleCount,
    finalParticleSourceLineageValid: finalSuccessorLineageValid,
    finalParticleSourceLineageMissing: finalSuccessorLineageMissing,
    staleFinalContinuationProxyBlocked,
    finalCommittedProxySourceRefsRequired:
      finalCommittedProxySourceRefValidation.required,
    finalCommittedProxySourceRefsValid:
      finalCommittedProxySourceRefValidation.ready,
    finalCommittedProxySourceRefValidationStatus:
      finalCommittedProxySourceRefValidation.status,
    finalCommittedProxySourceRefValidationBlocker:
      finalCommittedProxySourceRefValidation.blocker,
    finalCommittedProxySourceRefInvalidCount:
      finalCommittedProxySourceRefValidation.invalidRefCount,
    finalCommittedProxySourceRefFailures:
      finalCommittedProxySourceRefValidation.failures,
    finalParticleSourceLineage: finalSuccessorSourceFamily,
    finalParticleSourceLineageStatus:
      finalSuccessorSourceFamily?.status ?? null,
    finalParticleSourceLineageReady:
      finalSuccessorSourceFamily?.ready === true,
    finalParticleSourceRole:
      finalSuccessorSourceFamily?.sourceFamilyRole ?? null,
    finalParticleSourceGenerationId:
      finalSuccessorSourceFamily?.sourceGenerationId ?? null,
    finalParticleSuccessorEpochIdentity:
      finalSuccessorSourceFamily?.successorEpochIdentity ?? null,
    rawGpuBufferTransferDetected,
    rawGpuBufferTransferAllowed: false,
    renderLodSummarySchema: renderLod?.schema || policy.schroederRenderLodSummarySchema || null,
    renderLodSummaryStatus: renderLod?.status || policy.schroederRenderLodSummaryStatus || null,
    renderLodStatus: policy.schroederRenderLodStatus || null,
    renderLodMode: renderLod?.mode || policy.schroederRenderLodMode || null,
    renderLodPresentationReady: presentationReady,
    renderLodPresentationSourceMode: presentationReady
      ? (policy.schroederRenderLodPresentationSourceMode || 'schroeder-portable-summary-render-lod')
      : null,
    selectedLevel: finiteNumberOrNull(renderLod?.selectedLevel),
    nativeGridSpacingM: schroederRenderSourcePositiveNumber(
      renderLod?.nativeGridSpacingM ?? policy.schroederRenderLodNativeGridSpacingM,
      null
    ),
    activeLeafProxyCount,
    aggregateProxyCount,
    lawQueueProxyCount,
    totalProxyCount: activeLeafProxyCount + aggregateProxyCount + lawQueueProxyCount,
    phaseVolumeDiagnosticRowsAvailable: Boolean(renderLod?.phaseVolumeDiagnosticRowsAvailable),
    geometryPolicy: renderLod?.geometryPolicy || policy.schroederRenderLodGeometryPolicy || null,
    opticalPolicy: renderLod?.opticalPolicy || policy.schroederRenderLodOpticalPolicy || null,
    closureDerivedPbr: (
      renderLod?.opticalPolicy === 'closure-derived-pbr-materials'
      || policy.schroederRenderLodOpticalPolicy === 'closure-derived-pbr-materials'
    ),
    presentationAuthority: portable?.presentationAuthority
      || policy.schroederRenderLodPresentationAuthority
      || (presentationReady ? 'presentation-consumes-render-lod-summary-not-physics-state' : null),
    stateAuthorityStatus: portable?.stateAuthorityStatus
      || policy.schroederRenderLodStateAuthorityStatus
      || (renderLodPresent ? 'state-manager-admission-required-before-authoritative-remote-replay' : null),
    physicsAuthority: 'resident-schroeder-mechanics',
    admissionSchema: schroederPortableSummaryAdmission?.schema || null,
    admissionStatus,
    admissionPublished,
    admissionScope: schroederPortableSummaryAdmission?.scope || null,
    admissionStateKey: schroederPortableSummaryAdmission?.stateKey || null,
    admissionCacheKey: schroederPortableSummaryAdmission?.cacheKey || null,
    admissionHotBufferKey: schroederPortableSummaryAdmission?.hotBufferKey || null,
    descriptorOnlyPeerComputeHandoff: descriptorOnlyTransfer && !rawGpuBufferTransferDetected,
    fullParticleReadbackRequired,
    fullParticleReadbackAvoided: presentationReady && !fullParticleReadbackRequired,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

export function createSchroederRenderProxyDescriptorPlan({
  schroederRenderSource = null,
  source = 'resident-render-refresh'
} = {}) {
  const renderSource = schroederRenderSource?.schroederRenderSource || schroederRenderSource || null;
  if (!renderSource) return null;
  const sourceReady = Boolean(
    renderSource.status === 'schroeder-render-source-admitted'
      || renderSource.status === 'schroeder-render-source-local-observation-ready'
  );
  const descriptorOnly = Boolean(renderSource.descriptorOnlyPeerComputeHandoff);
  const rawGpuBufferTransferDetected = Boolean(renderSource.rawGpuBufferTransferDetected);
  const fullParticleReadbackRequired = Boolean(renderSource.fullParticleReadbackRequired);
  const noFullReadback = Boolean(
    !fullParticleReadbackRequired
      && renderSource.fullParticleReadbackAvoided !== false
  );
  const blocked = Boolean(
    !sourceReady
      || !descriptorOnly
      || rawGpuBufferTransferDetected
      || fullParticleReadbackRequired
  );
  let blocker = null;
  if (blocked) {
    if (!sourceReady) {
      blocker = renderSource.blocker || 'schroeder-render-source-not-ready';
    } else if (!descriptorOnly) {
      blocker = 'schroeder-render-source-not-descriptor-only';
    } else if (rawGpuBufferTransferDetected) {
      blocker = 'schroeder-render-source-raw-gpubuffer-transfer-detected';
    } else {
      blocker = 'schroeder-render-source-requires-full-particle-readback';
    }
  }

  const activeLeafProxyCount = schroederRenderSourceCount(renderSource.activeLeafProxyCount, 0);
  const aggregateProxyCount = schroederRenderSourceCount(renderSource.aggregateProxyCount, 0);
  const lawQueueProxyCount = schroederRenderSourceCount(renderSource.lawQueueProxyCount, 0);
  const selectedLevel = finiteNumberOrNull(renderSource.selectedLevel);
  const nativeGridSpacingM = schroederRenderSourcePositiveNumber(renderSource.nativeGridSpacingM, null);
  const closurePbrRequired = true;
  const closurePbrAvailable = Boolean(renderSource.closureDerivedPbr);
  const pbrMaterialSource = closurePbrAvailable
    ? 'closure-derived-pbr-deferred-by-ss-node-material-histogram'
    : 'blocked-until-closure-derived-pbr-available';
  const common = {
    sourceRenderSourceSchema: renderSource.schema || null,
    sourceRenderSourceStatus: renderSource.status || null,
    sourceRenderLodMode: renderSource.renderLodMode || null,
    selectedLevel,
    nativeGridSpacingM,
    geometryPolicy: renderSource.geometryPolicy || null,
    opticalPolicy: renderSource.opticalPolicy || null,
    closurePbrRequired,
    closurePbrAvailable,
    pbrMaterialSource,
    materialSource: 'deferred-to-ss-node-material-phase-histograms',
    presentationAuthority: renderSource.presentationAuthority || null,
    stateAuthorityStatus: renderSource.stateAuthorityStatus || null,
    descriptorOnlyPeerComputeHandoff: descriptorOnly,
    fullParticleReadbackRequired: false,
    fullParticleReadbackAvoided: noFullReadback,
    rawGpuBufferTransferDetected,
    rawGpuBufferTransferAllowed: false
  };
  const descriptors = [];
  const pushDescriptor = ({
    proxyClass,
    proxyRole,
    proxyCount,
    sourceRefKind,
    sourceRef,
    geometryKind,
    renderParticipation,
    drawableProxy
  }) => {
    if (proxyCount <= 0) return;
    descriptors.push({
      schema: ULG_SPH_SCENE_SCHROEDER_RENDER_PROXY_DESCRIPTOR_SCHEMA,
      proxyClass,
      proxyRole,
      proxyCount,
      sourceRefKind,
      sourceRef: sourceRef || null,
      sourceRefRetained: Boolean(sourceRef?.retained),
      sourceRefRowCount: sourceRef?.rowCount ?? 0,
      sourceRefByteLength: sourceRef?.byteLength ?? 0,
      geometryKind,
      renderParticipation,
      drawableProxy: Boolean(drawableProxy),
      ...common
    });
  };
  pushDescriptor({
    proxyClass: 'active-leaf',
    proxyRole: 'near-field-visible-leaf-proxy',
    proxyCount: activeLeafProxyCount,
    sourceRefKind: 'schroeder-active-node-list-retained-ref',
    sourceRef: renderSource.activeLeafSourceRef || null,
    geometryKind: 'active-leaf-sphere-or-splat-proxy',
    renderParticipation: 'renderer-visible-proxy',
    drawableProxy: true
  });
  pushDescriptor({
    proxyClass: 'spatial-aggregate',
    proxyRole: 'far-field-spatial-lod-proxy',
    proxyCount: aggregateProxyCount,
    sourceRefKind: 'schroeder-hierarchy-aggregate-node-retained-ref',
    sourceRef: renderSource.aggregateProxySourceRef || null,
    geometryKind: 'spatial-aggregate-volume-proxy',
    renderParticipation: 'renderer-visible-proxy',
    drawableProxy: true
  });
  pushDescriptor({
    proxyClass: 'law-queue',
    proxyRole: 'law-work-queue-diagnostic-proxy',
    proxyCount: lawQueueProxyCount,
    sourceRefKind: 'schroeder-law-queue-retained-ref',
    sourceRef: renderSource.lawQueueSourceRef || null,
    geometryKind: 'law-queue-diagnostic-bounds-proxy',
    renderParticipation: 'diagnostic-metadata-only',
    drawableProxy: false
  });
  const drawableProxyCount = descriptors
    .filter((descriptor) => descriptor.drawableProxy)
    .reduce((sum, descriptor) => sum + descriptor.proxyCount, 0);
  const totalProxyCount = activeLeafProxyCount + aggregateProxyCount + lawQueueProxyCount;
  const status = blocked
    ? 'blocked-schroeder-render-proxy-descriptors'
    : (totalProxyCount > 0
      ? 'schroeder-render-proxy-descriptors-ready'
      : 'schroeder-render-proxy-descriptors-empty');
  return {
    schema: ULG_SPH_SCENE_SCHROEDER_RENDER_PROXY_DESCRIPTOR_PLAN_SCHEMA,
    status,
    blocker,
    source,
    renderSourceSchema: renderSource.schema || null,
    renderSourceStatus: renderSource.status || null,
    renderSourceAdmissionStatus: renderSource.admissionStatus || null,
    renderSourceAdmissionPublished: Boolean(renderSource.admissionPublished),
    renderSourcePresentationReady: Boolean(renderSource.renderLodPresentationReady),
    descriptorCount: descriptors.length,
    descriptors,
    retainedSourceRefCount: renderSource.retainedProxySourceRefCount ?? 0,
    descriptorSourceRefCount: renderSource.descriptorProxySourceRefCount ?? 0,
    activeLeafSourceRefAvailable: Boolean(renderSource.activeLeafSourceRef),
    aggregateProxySourceRefAvailable: Boolean(renderSource.aggregateProxySourceRef),
    lawQueueSourceRefAvailable: Boolean(renderSource.lawQueueSourceRef),
    activeLeafProxyCount,
    aggregateProxyCount,
    lawQueueProxyCount,
    drawableProxyCount,
    diagnosticProxyCount: lawQueueProxyCount,
    totalProxyCount,
    selectedLevel,
    nativeGridSpacingM,
    geometryPolicy: renderSource.geometryPolicy || null,
    opticalPolicy: renderSource.opticalPolicy || null,
    closurePbrRequired,
    closurePbrAvailable,
    pbrMaterialSource,
    descriptorOnlyPeerComputeHandoff: descriptorOnly,
    fullParticleReadbackRequired,
    fullParticleReadbackAvoided: noFullReadback && !blocked,
    rawGpuBufferTransferDetected,
    rawGpuBufferTransferAllowed: false,
    rendererIntegration: 'scene-resident-schroeder-render-source-consumer',
    visibleRenderSource: 'schroeder-render-lod-proxy-descriptors',
    presentationOwnsPhysicsCadence: false,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

export function resolveSchroederRenderProxyVisibleConsumer({
  proxyDescriptorPlan = null,
  rendererCapability = null,
  renderBridgeMode = null,
  renderBridgeStatus = null,
  requestRawGpuBufferDrawBinding = false
} = {}) {
  const plan = proxyDescriptorPlan?.schroederRenderProxyDescriptorPlan
    || proxyDescriptorPlan
    || null;
  const inputReady = Boolean(plan?.status === 'schroeder-render-proxy-descriptors-ready');
  const inputBlocked = Boolean(plan?.status === 'blocked-schroeder-render-proxy-descriptors');
  const rawDrawRequested = Boolean(requestRawGpuBufferDrawBinding);
  const visibleNoReadbackSupported = Boolean(rendererCapability?.visibleNoReadbackSupported);
  const rendererCapabilityStatus = rendererCapability?.status ?? null;
  const rendererCapabilityReason = rendererCapability?.reason ?? null;
  const bridgeBound = Boolean(
    (
      renderBridgeMode === SPH_THREE_WEBGPU_SURFACE_BUFFER_BRIDGE_MODE
      && renderBridgeStatus === SPH_THREE_WEBGPU_SURFACE_BUFFER_BRIDGE_STATUS
    )
      || (
        renderBridgeMode === SPH_NATIVE_WEBGPU_SURFACE_CONSUMER_BRIDGE_MODE
        && renderBridgeStatus === SPH_NATIVE_WEBGPU_SURFACE_CONSUMER_BRIDGE_STATUS
      )
  );
  let rawGpuBufferDrawBindingStatus = 'deferred-raw-gpubuffer-draw-binding-not-admitted';
  if (rawDrawRequested && !inputReady) {
    rawGpuBufferDrawBindingStatus = 'blocked-raw-gpubuffer-draw-binding-input-not-ready';
  } else if (rawDrawRequested && !visibleNoReadbackSupported) {
    rawGpuBufferDrawBindingStatus = 'blocked-raw-gpubuffer-draw-binding-renderer-capability';
  } else if (rawDrawRequested && !bridgeBound) {
    rawGpuBufferDrawBindingStatus = 'blocked-raw-gpubuffer-draw-binding-render-bridge-not-bound';
  } else if (rawDrawRequested) {
    rawGpuBufferDrawBindingStatus = 'raw-gpubuffer-draw-binding-ready';
  }
  const rawGpuBufferDrawBindingReady = rawGpuBufferDrawBindingStatus === 'raw-gpubuffer-draw-binding-ready';
  const metadataConsumerReady = Boolean(inputReady && !rawDrawRequested);
  let status = 'schroeder-render-proxy-visible-consumer-blocked-input-not-ready';
  let reason = 'Schroeder render proxy descriptors are not ready for renderer-visible consumption';
  if (inputBlocked) {
    status = 'schroeder-render-proxy-visible-consumer-blocked-input';
    reason = plan?.blocker || 'Schroeder render proxy descriptor plan is blocked';
  } else if (metadataConsumerReady) {
    status = 'schroeder-render-proxy-visible-consumer-ready';
    reason = null;
  } else if (rawDrawRequested && inputReady && !visibleNoReadbackSupported) {
    status = 'schroeder-render-proxy-visible-consumer-blocked-renderer-capability';
    reason = rendererCapabilityReason || 'raw SS proxy drawing requires a validated no-readback renderer capability';
  } else if (rawDrawRequested && inputReady && visibleNoReadbackSupported && !bridgeBound) {
    status = 'schroeder-render-proxy-visible-consumer-blocked-render-bridge-not-bound';
    reason = 'raw SS proxy drawing requires a bound same-device renderer bridge';
  } else if (rawGpuBufferDrawBindingReady) {
    status = 'schroeder-render-proxy-visible-consumer-raw-gpubuffer-ready';
    reason = null;
  }
  return {
    schema: ULG_SPH_SCENE_SCHROEDER_RENDER_PROXY_VISIBLE_CONSUMER_SCHEMA,
    status,
    reason,
    ready: status === 'schroeder-render-proxy-visible-consumer-ready'
      || status === 'schroeder-render-proxy-visible-consumer-raw-gpubuffer-ready',
    inputReady,
    inputBlocked,
    inputSchema: plan?.schema ?? null,
    inputStatus: plan?.status ?? null,
    inputBlocker: plan?.blocker ?? null,
    descriptorCount: plan?.descriptorCount ?? 0,
    activeLeafProxyCount: plan?.activeLeafProxyCount ?? 0,
    aggregateProxyCount: plan?.aggregateProxyCount ?? 0,
    lawQueueProxyCount: plan?.lawQueueProxyCount ?? 0,
    drawableProxyCount: plan?.drawableProxyCount ?? 0,
    diagnosticProxyCount: plan?.diagnosticProxyCount ?? 0,
    totalProxyCount: plan?.totalProxyCount ?? 0,
    consumerKind: rawDrawRequested
      ? 'same-device-raw-gpubuffer-proxy-draw'
      : 'renderer-visible-descriptor-import',
    metadataDescriptorImportReady: metadataConsumerReady,
    rendererCapabilityStatus,
    rendererCapabilityReason,
    rendererBackend: rendererCapability?.rendererBackend ?? null,
    visibleNoReadbackSupported,
    renderBridgeMode,
    renderBridgeStatus,
    renderBridgeBound: bridgeBound,
    requestRawGpuBufferDrawBinding: rawDrawRequested,
    rawGpuBufferDrawBindingStatus,
    rawGpuBufferDrawBindingReady,
    frameCopyReadbackRequired: false,
    overlayRequired: false,
    presentationOwnsPhysicsCadence: false,
    fullParticleReadbackRequired: false,
    fullParticleReadbackAvoided: Boolean(plan?.fullParticleReadbackAvoided),
    closurePbrAvailable: Boolean(plan?.closurePbrAvailable),
    pbrMaterialSource: plan?.pbrMaterialSource ?? null,
    visibleRenderSource: plan?.visibleRenderSource ?? null,
    rendererIntegration: plan?.rendererIntegration ?? null
  };
}

export function createSchroederRenderProxyDrawSource({
  proxyDescriptorPlan = null,
  visibleConsumer = null,
  source = 'resident-render-refresh'
} = {}) {
  const plan = proxyDescriptorPlan?.schroederRenderProxyDescriptorPlan
    || proxyDescriptorPlan
    || null;
  if (!plan) return null;
  const consumer = visibleConsumer?.schroederRenderProxyVisibleConsumer
    || visibleConsumer
    || resolveSchroederRenderProxyVisibleConsumer({ proxyDescriptorPlan: plan });
  const descriptors = Array.isArray(plan.descriptors) ? plan.descriptors : [];
  const drawableDescriptors = descriptors.filter((descriptor) => descriptor?.drawableProxy);
  const missingSourceRefs = drawableDescriptors.filter((descriptor) => (
    !descriptor.sourceRef?.retained
    || !descriptor.sourceRef?.retainedBufferRef
  ));
  const sourceRefsReady = missingSourceRefs.length === 0;
  const inputReady = Boolean(
    plan.status === 'schroeder-render-proxy-descriptors-ready'
      && consumer?.ready
      && sourceRefsReady
  );
  const drawBatches = !inputReady
    ? []
    : drawableDescriptors.map((descriptor, index) => ({
      batchIndex: index,
      proxyClass: descriptor.proxyClass,
      proxyRole: descriptor.proxyRole,
      proxyCount: descriptor.proxyCount,
      geometryKind: descriptor.geometryKind,
      sourceRefKind: descriptor.sourceRefKind,
      sourceRef: descriptor.sourceRef,
      materialSource: descriptor.materialSource,
      pbrMaterialSource: descriptor.pbrMaterialSource,
      opticalPolicy: descriptor.opticalPolicy,
      closurePbrAvailable: Boolean(descriptor.closurePbrAvailable),
      selectedLevel: descriptor.selectedLevel,
      nativeGridSpacingM: descriptor.nativeGridSpacingM,
      drawBindingMode: 'descriptor-batched-retained-ss-source',
      rawGpuBufferBinding: false,
      cpuGeometryMaterialized: false,
      fullParticleReadbackRequired: false
    }));
  const blocker = inputReady
    ? null
    : (plan.status !== 'schroeder-render-proxy-descriptors-ready'
      ? (plan.blocker || 'schroeder-render-proxy-descriptors-not-ready')
      : (!consumer?.ready
        ? (consumer?.reason || consumer?.status || 'schroeder-render-proxy-visible-consumer-not-ready')
        : 'schroeder-render-proxy-draw-source-missing-retained-source-ref'));
  const drawableProxyCount = drawBatches.reduce((sum, batch) => sum + batch.proxyCount, 0);
  return {
    schema: ULG_SPH_SCENE_SCHROEDER_RENDER_PROXY_DRAW_SOURCE_SCHEMA,
    status: inputReady
      ? 'schroeder-render-proxy-draw-source-ready'
      : 'blocked-schroeder-render-proxy-draw-source',
    blocker,
    source,
    inputPlanSchema: plan.schema ?? null,
    inputPlanStatus: plan.status ?? null,
    visibleConsumerSchema: consumer?.schema ?? null,
    visibleConsumerStatus: consumer?.status ?? null,
    visibleConsumerReady: Boolean(consumer?.ready),
    sourceRefsReady,
    missingSourceRefCount: missingSourceRefs.length,
    drawBatchCount: drawBatches.length,
    drawBatches,
    drawableProxyCount,
    activeLeafProxyCount: plan.activeLeafProxyCount ?? 0,
    aggregateProxyCount: plan.aggregateProxyCount ?? 0,
    lawQueueProxyCount: plan.lawQueueProxyCount ?? 0,
    diagnosticProxyCount: plan.diagnosticProxyCount ?? 0,
    totalProxyCount: plan.totalProxyCount ?? 0,
    retainedSourceRefCount: plan.retainedSourceRefCount ?? 0,
    descriptorSourceRefCount: plan.descriptorSourceRefCount ?? 0,
    materializationMode: 'descriptor-batched-retained-ss-source',
    rendererIntegration: plan.rendererIntegration ?? null,
    visibleRenderSource: plan.visibleRenderSource ?? null,
    rawGpuBufferBinding: false,
    frameCopyReadbackRequired: false,
    overlayRequired: false,
    cpuGeometryMaterialized: false,
    fullParticleReadbackRequired: false,
    fullParticleReadbackAvoided: inputReady && plan.fullParticleReadbackAvoided !== false,
    presentationOwnsPhysicsCadence: false,
    closurePbrAvailable: Boolean(plan.closurePbrAvailable),
    pbrMaterialSource: plan.pbrMaterialSource ?? null,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function normalizeSchroederRenderProxyBackendPreference(value = 'auto') {
  const normalized = String(value ?? 'auto').trim().toLowerCase();
  if (['0', 'false', 'off', 'disabled', 'disable', 'none'].includes(normalized)) return 'disabled';
  if (['native', 'webgpu', 'gpu', 'native-webgpu', 'retained-gpu', 'retained-webgpu'].includes(normalized)) {
    return 'native-webgpu';
  }
  if (['cpu', 'diagnostic', 'diagnostic-cpu', 'cpu-diagnostic', 'descriptor-cpu'].includes(normalized)) {
    return 'diagnostic-cpu';
  }
  return 'auto';
}

function schroederRenderProxyBackendBridgeState({
  renderBridgeMode = null,
  renderBridgeStatus = null
} = {}) {
  const threeWebGpuBridgeBound = Boolean(
    renderBridgeMode === SPH_THREE_WEBGPU_SURFACE_BUFFER_BRIDGE_MODE
      && renderBridgeStatus === SPH_THREE_WEBGPU_SURFACE_BUFFER_BRIDGE_STATUS
  );
  const nativeWebGpuBridgeBound = Boolean(
    renderBridgeMode === SPH_NATIVE_WEBGPU_SURFACE_CONSUMER_BRIDGE_MODE
      && renderBridgeStatus === SPH_NATIVE_WEBGPU_SURFACE_CONSUMER_BRIDGE_STATUS
  );
  return {
    threeWebGpuBridgeBound,
    nativeWebGpuBridgeBound,
    renderBridgeBound: threeWebGpuBridgeBound || nativeWebGpuBridgeBound
  };
}

function schroederRenderProxyNativeVisibleValidationReady({
  rendererCapability = null,
  renderBridgeMode = null,
  pixelValidationStatus = null
} = {}) {
  if (renderBridgeMode !== SPH_NATIVE_WEBGPU_SURFACE_CONSUMER_BRIDGE_MODE) return true;
  // Same-queue staging proves that the candidate draw and canvas copy were
  // submitted in the required order. It admits runtime publication, but it
  // does not observe compositor pixels and therefore cannot make this
  // specifically named visible-validation claim true.
  const exactNonNegativeInteger = (value) => (
    typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= 0
      ? value
      : null
  );
  const activeGeneration = exactNonNegativeInteger(
    rendererCapability?.nativeSurfaceConsumerActiveResourceGeneration
  );
  if (activeGeneration == null) return false;
  const pixelGeneration = exactNonNegativeInteger(
    rendererCapability?.nativeSurfaceConsumerPixelValidationResourceGeneration
  );
  const pixelCount = exactNonNegativeInteger(
    rendererCapability?.nativeSurfaceConsumerPixelValidationNonzeroPixelCount
  );
  const pixelSource = String(
    rendererCapability?.nativeSurfaceConsumerPixelValidationSource ?? ''
  );
  const browserFrameForegroundValidated = Boolean(
    (
      pixelValidationStatus === 'passed'
      || rendererCapability?.nativeSurfaceConsumerPixelValidationStatus === 'passed'
    )
    && /browser-frame|playwright.*compositor|composited-frame/i.test(pixelSource)
    && pixelCount > 0
    && pixelGeneration != null
    && pixelGeneration === activeGeneration
  );
  const offscreenGeneration = exactNonNegativeInteger(
    rendererCapability?.nativeSurfaceConsumerOffscreenValidationResourceGeneration
  );
  const offscreenPixelCount = exactNonNegativeInteger(
    rendererCapability?.nativeSurfaceConsumerOffscreenValidationNonzeroPixelCount
  );
  const privateCompositePixelValidated = Boolean(
    rendererCapability?.nativeSurfaceConsumerOffscreenValidationStatus === 'passed'
    && offscreenPixelCount > 0
    && offscreenGeneration != null
    && offscreenGeneration === activeGeneration
  );
  return browserFrameForegroundValidated || privateCompositePixelValidated;
}

export function resolveSchroederRenderProxyBackendSelection({
  drawSource = null,
  rendererCapability = null,
  renderBridgeMode = null,
  renderBridgeStatus = null,
  pixelValidationStatus = null,
  backendPreference = 'auto',
  allowDiagnosticCpuProxy = false,
  diagnosticMaxProxyCount = 256,
  source = 'resident-render-refresh'
} = {}) {
  const resolvedDrawSource = drawSource?.schroederRenderProxyDrawSource || drawSource || null;
  if (!resolvedDrawSource) return null;

  const preference = normalizeSchroederRenderProxyBackendPreference(backendPreference);
  const inputReady = resolvedDrawSource.status === 'schroeder-render-proxy-draw-source-ready';
  const proxyCount = Math.max(0, Math.round(Number(resolvedDrawSource.drawableProxyCount) || 0));
  const drawBatchCount = Math.max(0, Math.round(Number(resolvedDrawSource.drawBatchCount) || 0));
  const visibleNoReadbackSupported = Boolean(rendererCapability?.visibleNoReadbackSupported);
  const {
    threeWebGpuBridgeBound,
    nativeWebGpuBridgeBound,
    renderBridgeBound
  } = schroederRenderProxyBackendBridgeState({ renderBridgeMode, renderBridgeStatus });
  const nativeSubmitReady = Boolean(inputReady && visibleNoReadbackSupported && renderBridgeBound);
  const visibleValidationReady = nativeSubmitReady && schroederRenderProxyNativeVisibleValidationReady({
    rendererCapability,
    renderBridgeMode,
    pixelValidationStatus
  });
  const diagnosticLimit = Math.max(0, Math.round(Number(diagnosticMaxProxyCount) || 0));
  const diagnosticAllowed = Boolean(allowDiagnosticCpuProxy);
  const diagnosticWithinBudget = proxyCount <= diagnosticLimit;
  const diagnosticExplicitlyRequested = preference === 'diagnostic-cpu';
  const diagnosticReady = Boolean(
    inputReady
      && diagnosticExplicitlyRequested
      && diagnosticAllowed
      && diagnosticWithinBudget
  );
  const nativeRequested = preference === 'auto' || preference === 'native-webgpu';
  const diagnosticRequested = diagnosticExplicitlyRequested;

  let selectedBackend = 'none';
  let status = 'blocked-schroeder-render-proxy-backend-source';
  let blocker = resolvedDrawSource.blocker || resolvedDrawSource.status || 'schroeder-render-proxy-draw-source-not-ready';
  if (preference === 'disabled') {
    status = 'schroeder-render-proxy-backend-disabled';
    blocker = 'schroeder-render-proxy-backend-disabled-by-policy';
  } else if (!inputReady) {
    status = 'blocked-schroeder-render-proxy-backend-source';
  } else if (nativeRequested && nativeSubmitReady) {
    selectedBackend = 'native-webgpu-retained-proxy';
    status = visibleValidationReady
      ? 'schroeder-render-proxy-backend-native-webgpu-visible-ready'
      : 'schroeder-render-proxy-backend-native-webgpu-submit-ready';
    blocker = null;
  } else if (diagnosticRequested && diagnosticReady) {
    selectedBackend = 'diagnostic-cpu-descriptor-proxy';
    status = 'schroeder-render-proxy-backend-diagnostic-cpu-ready';
    blocker = null;
  } else if (preference === 'diagnostic-cpu' && !diagnosticAllowed) {
    selectedBackend = 'diagnostic-cpu-descriptor-proxy';
    status = 'blocked-schroeder-render-proxy-backend-diagnostic-not-admitted';
    blocker = 'diagnostic CPU SS proxy geometry requires explicit diagnostic admission';
  } else if (preference === 'diagnostic-cpu' && !diagnosticWithinBudget) {
    selectedBackend = 'diagnostic-cpu-descriptor-proxy';
    status = 'blocked-schroeder-render-proxy-backend-diagnostic-budget';
    blocker = 'diagnostic CPU SS proxy geometry exceeds the configured descriptor proxy budget';
  } else if (nativeRequested && !visibleNoReadbackSupported) {
    selectedBackend = 'native-webgpu-retained-proxy';
    status = 'blocked-schroeder-render-proxy-backend-renderer-capability';
    blocker = rendererCapability?.reason || 'native SS proxy backend requires a same-device no-readback renderer capability';
  } else if (nativeRequested && visibleNoReadbackSupported && !renderBridgeBound) {
    selectedBackend = 'native-webgpu-retained-proxy';
    status = 'blocked-schroeder-render-proxy-backend-render-bridge';
    blocker = 'native SS proxy backend requires a bound same-device render bridge';
  } else if (diagnosticRequested && !diagnosticAllowed) {
    selectedBackend = 'diagnostic-cpu-descriptor-proxy';
    status = 'blocked-schroeder-render-proxy-backend-diagnostic-not-admitted';
    blocker = 'diagnostic CPU SS proxy geometry requires explicit diagnostic admission';
  } else {
    selectedBackend = 'diagnostic-cpu-descriptor-proxy';
    status = 'blocked-schroeder-render-proxy-backend-diagnostic-budget';
    blocker = 'diagnostic CPU SS proxy geometry exceeds the configured descriptor proxy budget';
  }

  const nativeSelected = selectedBackend === 'native-webgpu-retained-proxy';
  const diagnosticSelected = selectedBackend === 'diagnostic-cpu-descriptor-proxy';
  const backendReady = status === 'schroeder-render-proxy-backend-native-webgpu-visible-ready'
    || status === 'schroeder-render-proxy-backend-native-webgpu-submit-ready'
    || status === 'schroeder-render-proxy-backend-diagnostic-cpu-ready';
  return {
    schema: ULG_SPH_SCENE_SCHROEDER_RENDER_PROXY_BACKEND_SELECTION_SCHEMA,
    status,
    blocker,
    ready: backendReady,
    source,
    backendPreference: preference,
    selectedBackend,
    selectedBackendKind: nativeSelected
      ? 'same-device-retained-webgpu-draw'
      : (diagnosticSelected ? 'diagnostic-descriptor-cpu-proxy' : null),
    inputReady,
    inputSchema: resolvedDrawSource.schema ?? null,
    inputStatus: resolvedDrawSource.status ?? null,
    drawBatchCount,
    drawableProxyCount: proxyCount,
    sourceRefsReady: Boolean(resolvedDrawSource.sourceRefsReady),
    materializationMode: nativeSelected
      ? 'same-device-retained-ss-source-webgpu-draw'
      : (diagnosticSelected ? 'diagnostic-cpu-descriptor-proxy' : null),
    rendererCapabilitySchema: rendererCapability?.schema ?? null,
    rendererCapabilityStatus: rendererCapability?.status ?? null,
    rendererCapabilityReason: rendererCapability?.reason ?? null,
    rendererBackend: rendererCapability?.rendererBackend ?? null,
    visibleNoReadbackSupported,
    renderBridgeMode,
    renderBridgeStatus,
    renderBridgeBound,
    threeWebGpuBridgeBound,
    nativeWebGpuBridgeBound,
    nativeSubmitReady,
    visibleValidationReady,
    pixelValidationStatus: pixelValidationStatus || rendererCapability?.nativeSurfaceConsumerPixelValidationStatus || null,
    sameDeviceRetainedBufferBindingRequired: nativeSelected,
    sameDeviceRetainedBufferBindingReady: nativeSubmitReady,
    rawGpuBufferTransferRequired: false,
    rawGpuBufferBinding: false,
    descriptorOnlyPeerComputeHandoff: true,
    frameCopyReadbackRequired: false,
    overlayRequired: false,
    fullParticleReadbackRequired: false,
    presentationOwnsPhysicsCadence: false,
    diagnosticCpuProxyExplicitlyRequested: diagnosticExplicitlyRequested,
    diagnosticCpuProxyAllowedByPolicy: diagnosticAllowed,
    diagnosticCpuProxyAdmitted: diagnosticSelected && diagnosticAllowed && diagnosticExplicitlyRequested,
    diagnosticCpuProxyReady: diagnosticSelected && diagnosticReady,
    diagnosticCpuProxyBudget: diagnosticLimit,
    diagnosticCpuProxyBudgetSource: 'schroederRenderProxyDiagnosticMaxProxyCount',
    diagnosticCpuProxyWithinBudget: diagnosticWithinBudget,
    diagnosticCpuProxyHotPathAllowed: false,
    diagnosticCpuProxyMaterializationMode: diagnosticSelected
      ? 'diagnostic-cpu-descriptor-proxy-metadata-only'
      : null,
    diagnosticOnly: diagnosticSelected,
    peerComputeHotPath: nativeSelected && backendReady,
    cpuGeometryMaterialized: false,
    cpuGeometryMaterializationAdmitted:
      diagnosticSelected && diagnosticAllowed && diagnosticExplicitlyRequested,
    cpuGeometryMaterializationPolicy: diagnosticSelected
      ? 'explicit-diagnostic-capped-metadata-only'
      : 'disabled',
    closurePbrAvailable: Boolean(resolvedDrawSource.closurePbrAvailable),
    pbrMaterialSource: resolvedDrawSource.pbrMaterialSource ?? null,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function schroederNativeProxyBatchKindId(proxyClass = '') {
  return String(proxyClass || '').toLowerCase() === 'spatial-aggregate' ? 1 : 0;
}

function schroederNativeProxyBatchStrideFloats(batch = {}) {
  const explicit = Math.max(0, Math.round(Number(batch?.sourceRef?.strideFloats) || 0));
  if (explicit > 0) return explicit;
  return schroederNativeProxyBatchKindId(batch.proxyClass) === 1
    ? SPH_SCHROEDER_RENDER_PROXY_AGGREGATE_NODE_FLOATS
    : SPH_SCHROEDER_RENDER_PROXY_ACTIVE_NODE_FLOATS;
}

function schroederNativeProxyBatchColor(proxyClass = '') {
  return schroederNativeProxyBatchKindId(proxyClass) === 1
    ? [0.78, 0.84, 1.0]
    : [0.25, 0.76, 1.0];
}

function resolveSchroederNativeProxyRetainedBuffer({
  retainedBufferResolver = null,
  sourceRef = null,
  batch = null
} = {}) {
  if (!sourceRef?.retainedBufferRef) return null;
  let resolved = null;
  if (typeof retainedBufferResolver === 'function') {
    resolved = retainedBufferResolver(sourceRef.retainedBufferRef, { sourceRef, batch });
  } else if (retainedBufferResolver instanceof Map) {
    resolved = retainedBufferResolver.get(sourceRef.retainedBufferRef);
  } else if (retainedBufferResolver && typeof retainedBufferResolver === 'object') {
    resolved = retainedBufferResolver[sourceRef.retainedBufferRef] || null;
  }
  if (!resolved) return null;
  const buffer = resolved.buffer || resolved.gpuBuffer || null;
  if (!buffer) return null;
  return {
    buffer,
    byteLength: Math.max(0, Math.round(Number(resolved.byteLength ?? sourceRef.byteLength) || 0)),
    rowCount: Math.max(0, Math.round(Number(resolved.rowCount ?? sourceRef.rowCount) || 0)),
    strideFloats: Math.max(0, Math.round(Number(resolved.strideFloats ?? sourceRef.strideFloats) || 0)),
    sourceStatus: resolved.status || null,
    resourceKey: resolved.resourceKey || sourceRef.retainedBufferRef
  };
}

export function createSchroederRenderProxyLocalRetainedBufferResolver({
  residentExecution = null,
  finalStep = null,
  localRetainedRenderBuffers = null,
  source = 'resident-render-refresh'
} = {}) {
  const localSource = localRetainedRenderBuffers
    || residentExecution?.localRetainedRenderBuffers
    || residentExecution?.schroederLocalRetainedRenderBuffers
    || finalStep?.localRetainedRenderBuffers
    || finalStep?.schroederLocalRetainedRenderBuffers
    || null;
  const buffers = Array.isArray(localSource?.buffers) ? localSource.buffers : [];
  const retainedBufferResolver = new Map();
  for (const entry of buffers) {
    const retainedBufferRef = entry?.retainedBufferRef || entry?.resourceKey || null;
    const buffer = entry?.buffer || entry?.gpuBuffer || null;
    if (!retainedBufferRef || !buffer) continue;
    retainedBufferResolver.set(retainedBufferRef, {
      buffer,
      gpuBuffer: buffer,
      byteLength: entry.byteLength,
      rowCount: entry.rowCount,
      strideFloats: entry.strideFloats,
      status: entry.status,
      resourceKey: retainedBufferRef
    });
  }
  return {
    schema: 'peercompute.ulg.sph-scene-schroeder-render-proxy-local-retained-buffer-resolver.v0',
    status: retainedBufferResolver.size > 0
      ? 'schroeder-render-proxy-local-retained-buffer-resolver-ready'
      : 'blocked-schroeder-render-proxy-local-retained-buffer-resolver-empty',
    source,
    inputSchema: localSource?.schema ?? null,
    inputStatus: localSource?.status ?? null,
    ready: retainedBufferResolver.size > 0,
    sameDeviceOnly: true,
    peerComputePortable: false,
    descriptorOnlyPeerComputeHandoff: true,
    rawGpuBufferTransferAllowed: false,
    rawGpuBufferTransferRequired: false,
    frameCopyReadbackRequired: false,
    fullParticleReadbackRequired: false,
    retainedBufferRefCount: retainedBufferResolver.size,
    retainedBufferRefs: [...retainedBufferResolver.keys()],
    retainedBufferResolver,
    retainedBufferOwner: localSource,
    releaseRetainedBuffers: typeof localSource?.destroyRetainedBuffers === 'function'
      ? (options = {}) => localSource.destroyRetainedBuffers(options)
      : null,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

export function createSchroederRenderProxyNativeCameraUniformPayload({
  viewProjection = null,
  viewportWidth = 1,
  viewportHeight = 1,
  nativeGridSpacingM = 1,
  gridBiasM = 0,
  mode = 0
} = {}) {
  const payload = new Float32Array(SPH_SCHROEDER_RENDER_PROXY_NATIVE_CAMERA_FLOATS);
  const elements = viewProjection?.elements || viewProjection;
  if (elements && typeof elements.length === 'number' && elements.length >= 16) {
    for (let i = 0; i < 16; i += 1) {
      payload[i] = Number.isFinite(Number(elements[i])) ? Number(elements[i]) : 0;
    }
  } else {
    payload[0] = 1;
    payload[5] = 1;
    payload[10] = 1;
    payload[15] = 1;
  }
  payload[16] = Math.max(1, Math.round(Number(viewportWidth) || 1));
  payload[17] = Math.max(1, Math.round(Number(viewportHeight) || 1));
  payload[18] = 0;
  payload[19] = Number.isFinite(Number(mode)) ? Number(mode) : 0;
  payload[20] = Number.isFinite(Number(nativeGridSpacingM)) && Number(nativeGridSpacingM) > 0
    ? Number(nativeGridSpacingM)
    : 1;
  payload[21] = Number.isFinite(Number(gridBiasM)) ? Number(gridBiasM) : 0;
  payload[22] = 0;
  payload[23] = 0;
  return payload;
}

// Proxy programs are immutable render algorithms. Simulation generations,
// proxy classes/counts, retained-buffer identities, and scenario properties
// belong to per-executor bind groups and uniforms, never the program key.
// Color/depth attachment formats are genuine render-pipeline state and are
// therefore the only variants retained per GPUDevice.
const schroederRenderProxyNativeProgramsByDevice = new WeakMap();

function schroederRenderProxyNativeProgram(device, {
  format,
  depthFormat = null
} = {}) {
  let programs = schroederRenderProxyNativeProgramsByDevice.get(device);
  if (!programs) {
    programs = new Map();
    schroederRenderProxyNativeProgramsByDevice.set(device, programs);
  }
  const programKey = JSON.stringify([
    'ulg-schroeder-render-proxy-native.v0',
    format,
    depthFormat || null
  ]);
  const cached = programs.get(programKey);
  if (cached) return cached;

  const module = device.createShaderModule({
    label: 'ulg-schroeder-render-proxy-native',
    code: SPH_SCHROEDER_RENDER_PROXY_NATIVE_WGSL
  });
  const bindGroupLayout = device.createBindGroupLayout({
    label: 'ulg-schroeder-render-proxy-native-bind-group-layout',
    entries: [
      {
        binding: 0,
        visibility: GPU_SHADER_STAGE.VERTEX,
        buffer: { type: 'read-only-storage' }
      },
      {
        binding: 1,
        visibility: GPU_SHADER_STAGE.VERTEX,
        buffer: { type: 'uniform' }
      },
      {
        binding: 2,
        visibility: GPU_SHADER_STAGE.VERTEX,
        buffer: { type: 'uniform' }
      }
    ]
  });
  const pipelineLayout = device.createPipelineLayout({
    label: 'ulg-schroeder-render-proxy-native-pipeline-layout',
    bindGroupLayouts: [bindGroupLayout]
  });
  const pipeline = device.createRenderPipeline({
    label: 'ulg-schroeder-render-proxy-native-pipeline',
    layout: pipelineLayout,
    vertex: {
      module,
      entryPoint: 'vs_main'
    },
    fragment: {
      module,
      entryPoint: 'fs_main',
      targets: [{
        format,
        blend: {
          color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
          alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
        }
      }]
    },
    primitive: {
      topology: 'triangle-list',
      cullMode: 'none'
    },
    ...(depthFormat ? {
      depthStencil: {
        format: depthFormat,
        depthWriteEnabled: false,
        depthCompare: 'less-equal'
      }
    } : {})
  });
  const program = Object.freeze({
    key: programKey,
    module,
    bindGroupLayout,
    pipelineLayout,
    pipeline
  });
  programs.set(programKey, program);
  return program;
}

export function createSchroederRenderProxyNativeWebGpuExecutor({
  drawSource = null,
  backendSelection = null,
  device = null,
  format = null,
  depthFormat = null,
  retainedBufferResolver = null,
  retainedBufferOwner = null,
  releaseRetainedBuffers = null,
  cameraBuffer = null,
  adoptCameraBuffer = false,
  source = 'resident-render-refresh'
} = {}) {
  const resolvedDrawSource = drawSource?.schroederRenderProxyDrawSource || drawSource || null;
  const selection = backendSelection?.schroederRenderProxyBackendSelection || backendSelection || null;
  const drawBatches = Array.isArray(resolvedDrawSource?.drawBatches)
    ? resolvedDrawSource.drawBatches
    : [];
  const nativeBackendSelected = selection?.selectedBackend === 'native-webgpu-retained-proxy';
  const nativeSubmitReady = selection?.nativeSubmitReady === true;
  const base = {
    schema: ULG_SPH_SCENE_SCHROEDER_RENDER_PROXY_NATIVE_EXECUTOR_SCHEMA,
    source,
    inputDrawSourceSchema: resolvedDrawSource?.schema ?? null,
    inputDrawSourceStatus: resolvedDrawSource?.status ?? null,
    backendSelectionSchema: selection?.schema ?? null,
    backendSelectionStatus: selection?.status ?? null,
    selectedBackend: selection?.selectedBackend ?? null,
    drawBatchCount: drawBatches.length,
    drawableProxyCount: resolvedDrawSource?.drawableProxyCount ?? 0,
    nativeSubmitReady,
    nativeBackendSelected,
    frameCopyReadbackRequired: false,
    overlayRequired: false,
    fullParticleReadbackRequired: false,
    rawGpuBufferTransferRequired: false,
    descriptorOnlyPeerComputeHandoff: true,
    inputDrawSource: resolvedDrawSource,
    inputRetainedBufferResolver: retainedBufferResolver,
    retainedBufferOwner,
    presentationOwnsPhysicsCadence: false,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
  if (!resolvedDrawSource || resolvedDrawSource.status !== 'schroeder-render-proxy-draw-source-ready') {
    return {
      ...base,
      status: 'blocked-schroeder-render-proxy-native-executor-draw-source',
      blocker: resolvedDrawSource?.blocker || resolvedDrawSource?.status || 'schroeder-render-proxy-draw-source-not-ready',
      ready: false,
      drawCommands: []
    };
  }
  if (!nativeBackendSelected || !nativeSubmitReady) {
    return {
      ...base,
      status: 'blocked-schroeder-render-proxy-native-executor-backend',
      blocker: selection?.blocker || selection?.status || 'native-webgpu-retained-proxy-backend-not-ready',
      ready: false,
      drawCommands: []
    };
  }
  if (
    !device?.createShaderModule
    || !device?.createBindGroupLayout
    || !device?.createPipelineLayout
    || !device?.createRenderPipeline
    || !device?.createBuffer
    || !device?.createBindGroup
    || !device.queue?.writeBuffer
  ) {
    return {
      ...base,
      status: 'blocked-schroeder-render-proxy-native-executor-device',
      blocker: 'same-device WebGPU render pipeline/device APIs are required',
      ready: false,
      drawCommands: []
    };
  }
  if (!format) {
    return {
      ...base,
      status: 'blocked-schroeder-render-proxy-native-executor-format',
      blocker: 'native SS proxy executor requires a target color format',
      ready: false,
      drawCommands: []
    };
  }
  if (
    typeof retainedBufferResolver !== 'function'
    && !(retainedBufferResolver instanceof Map)
    && !(retainedBufferResolver && typeof retainedBufferResolver === 'object')
  ) {
    return {
      ...base,
      status: 'blocked-schroeder-render-proxy-native-executor-buffer-resolver',
      blocker: 'same-device retained buffer resolver is required',
      ready: false,
      drawCommands: []
    };
  }

  const resolvedBatches = [];
  const missingSourceRefs = [];
  for (const batch of drawBatches) {
    const resolved = resolveSchroederNativeProxyRetainedBuffer({
      retainedBufferResolver,
      sourceRef: batch.sourceRef,
      batch
    });
    if (!resolved?.buffer) {
      missingSourceRefs.push(batch.sourceRef?.retainedBufferRef || batch.proxyClass || 'unknown');
      continue;
    }
    const strideFloats = resolved.strideFloats || schroederNativeProxyBatchStrideFloats(batch);
    const proxyCount = Math.max(0, Math.round(Number(batch.proxyCount) || resolved.rowCount || 0));
    const rowCount = Math.max(0, Math.min(
      proxyCount,
      resolved.rowCount || batch.sourceRef?.rowCount || proxyCount
    ));
    if (rowCount <= 0) continue;
    resolvedBatches.push({
      batch,
      resolved,
      proxyKindId: schroederNativeProxyBatchKindId(batch.proxyClass),
      strideFloats,
      rowCount
    });
  }
  if (missingSourceRefs.length > 0 || resolvedBatches.length === 0) {
    return {
      ...base,
      status: 'blocked-schroeder-render-proxy-native-executor-retained-source',
      blocker: 'all native SS proxy draw batches require same-device retained GPU buffers',
      ready: false,
      missingSourceRefCount: missingSourceRefs.length || drawBatches.length,
      missingSourceRefs,
      drawCommands: []
    };
  }

  const {
    key: programKey,
    module,
    bindGroupLayout,
    pipelineLayout,
    pipeline
  } = schroederRenderProxyNativeProgram(device, { format, depthFormat });
  const resolvedCameraBuffer = cameraBuffer || device.createBuffer({
    label: 'ulg-schroeder-render-proxy-native-camera',
    size: SPH_SCHROEDER_RENDER_PROXY_NATIVE_CAMERA_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const resolvedCameraBufferOwned = !cameraBuffer || adoptCameraBuffer === true;
  const drawCommands = resolvedBatches.map((entry, index) => {
    const batchParamsBuffer = device.createBuffer({
      label: `ulg-schroeder-render-proxy-native-batch-${index}`,
      size: SPH_SCHROEDER_RENDER_PROXY_NATIVE_BATCH_FLOATS * Float32Array.BYTES_PER_ELEMENT,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
    });
    const color = schroederNativeProxyBatchColor(entry.batch.proxyClass);
    const nativeGridSpacingM = Number.isFinite(Number(entry.batch.nativeGridSpacingM))
      ? Number(entry.batch.nativeGridSpacingM)
      : 1;
    const radiusPx = entry.proxyKindId === 1 ? 10 : 7;
    const payload = new Float32Array(SPH_SCHROEDER_RENDER_PROXY_NATIVE_BATCH_FLOATS);
    payload[0] = entry.rowCount;
    payload[1] = entry.strideFloats;
    payload[2] = entry.proxyKindId;
    payload[3] = radiusPx;
    payload[4] = nativeGridSpacingM;
    payload[5] = color[0];
    payload[6] = color[1];
    payload[7] = color[2];
    device.queue.writeBuffer(batchParamsBuffer, 0, payload);
    const bindGroup = device.createBindGroup({
      label: `ulg-schroeder-render-proxy-native-bind-group-${index}`,
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: entry.resolved.buffer } },
        { binding: 1, resource: { buffer: resolvedCameraBuffer } },
        { binding: 2, resource: { buffer: batchParamsBuffer } }
      ]
    });
    return {
      batchIndex: index,
      proxyClass: entry.batch.proxyClass,
      proxyRole: entry.batch.proxyRole,
      sourceRef: entry.batch.sourceRef,
      retainedBufferRef: entry.batch.sourceRef?.retainedBufferRef ?? null,
      retainedBuffer: entry.resolved.buffer,
      retainedBufferByteLength: entry.resolved.byteLength,
      rowCount: entry.rowCount,
      strideFloats: entry.strideFloats,
      proxyKindId: entry.proxyKindId,
      batchParamsBuffer,
      bindGroup,
      drawVertexCount: 6,
      drawInstanceCount: entry.rowCount,
      drawMethod: 'draw-instanced-proxy-splats'
    };
  });
  const destroyedBatchParamsBuffers = new Set();
  let cameraResourceSettled = !resolvedCameraBufferOwned;
  let retainedBuffersReleased = typeof releaseRetainedBuffers !== 'function';
  let destroyed = false;
  return {
    ...base,
    status: 'schroeder-render-proxy-native-executor-ready',
    blocker: null,
    ready: true,
    format,
    depthFormat: depthFormat || null,
    programKey,
    programIdentity:
      'device-color-format-depth-format-shader-abi',
    module,
    bindGroupLayout,
    pipelineLayout,
    pipeline,
    cameraBuffer: resolvedCameraBuffer,
    cameraBufferOwned: resolvedCameraBufferOwned,
    cameraUniformFloats: SPH_SCHROEDER_RENDER_PROXY_NATIVE_CAMERA_FLOATS,
    batchUniformFloats: SPH_SCHROEDER_RENDER_PROXY_NATIVE_BATCH_FLOATS,
    drawCommands,
    resolvedBatchCount: drawCommands.length,
    missingSourceRefCount: 0,
    sameDeviceRetainedBufferBindingReady: true,
    rawGpuBufferBinding: true,
    rawGpuBufferTransferRequired: false,
    updateCamera({
      viewProjection = null,
      viewportWidth = 1,
      viewportHeight = 1,
      nativeGridSpacingM = resolvedDrawSource.nativeGridSpacingM ?? 1,
      gridBiasM = 0,
      mode = 0
    } = {}) {
      const payload = createSchroederRenderProxyNativeCameraUniformPayload({
        viewProjection,
        viewportWidth,
        viewportHeight,
        nativeGridSpacingM,
        gridBiasM,
        mode
      });
      device.queue.writeBuffer(resolvedCameraBuffer, 0, payload);
      return {
        status: 'schroeder-render-proxy-native-camera-uniform-updated',
        byteLength: payload.byteLength,
        viewportWidth: payload[16],
        viewportHeight: payload[17],
        nativeGridSpacingM: payload[20]
      };
    },
    execute(pass) {
      if (!pass?.setPipeline || !pass?.setBindGroup || !pass?.draw) {
        throw new Error('Schroeder native proxy executor requires a GPURenderPassEncoder-like pass');
      }
      pass.setPipeline(pipeline);
      for (const command of drawCommands) {
        pass.setBindGroup(0, command.bindGroup);
        pass.draw(command.drawVertexCount, command.drawInstanceCount);
      }
      return {
        status: 'schroeder-render-proxy-native-executor-submitted-to-pass',
        drawCommandCount: drawCommands.length,
        drawInstanceCount: drawCommands.reduce((sum, command) => sum + command.drawInstanceCount, 0)
      };
    },
    destroy({
      preserveCameraBuffer = null
    } = {}) {
      if (destroyed) return false;
      let changed = false;
      for (const command of drawCommands) {
        const buffer = command.batchParamsBuffer ?? null;
        if (!buffer || destroyedBatchParamsBuffers.has(buffer)) continue;
        buffer.destroy?.();
        destroyedBatchParamsBuffers.add(buffer);
        changed = true;
      }
      if (!cameraResourceSettled) {
        if (resolvedCameraBuffer !== preserveCameraBuffer) {
          resolvedCameraBuffer.destroy?.();
        }
        cameraResourceSettled = true;
        changed = true;
      }
      if (!retainedBuffersReleased) {
        releaseRetainedBuffers();
        retainedBuffersReleased = true;
        changed = true;
      }
      destroyed = Boolean(
        destroyedBatchParamsBuffers.size === drawCommands.length
        && cameraResourceSettled
        && retainedBuffersReleased
      );
      return changed;
    }
  };
}

export const SPH_PHASE_RENDER_MODE = 'continuous-marching-cubes';
export const SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT = 'no-full-readback';
export const SPH_PHASE_RENDER_ORDER = Object.freeze({
  opaqueSurface: 100,
  transmissiveSurface: 200,
  vaporSurface: 300,
  alphaSurface: 320,
  containerWire: 500
});
export const SPH_RENDER_FIELD_VISIBILITY_HYSTERESIS = 0.92;
export const SPH_SURFACE_INACTIVE_GRACE_FRAMES = 2;
export const SPH_SURFACE_RADIUS_SCALE_DEFAULT = 0.15;
export const SPH_SPARSE_SURFACE_RADIUS_SCALE_MIN = 0.2;
export const SPH_H2O_LIQUID_CONTINUITY_RADIUS_SCALE_MAX = 1.75;
export const SPH_GAS_CONTINUITY_RADIUS_SCALE_MAX = 2;
export const SPH_REACTION_PRODUCT_LIQUID_CONTINUITY_RADIUS_SCALE_MAX = 12;
export const SPH_SPARSE_SURFACE_RADIUS_SCALE_MAX_PARTICLES = 27;
export const SPH_SPARSE_RENDER_FIELD_RESOLUTION_MIN = 64;
export const SPH_CPU_MARCHING_CUBES_RESOLUTION_MIN = 32;
export const SPH_CPU_MARCHING_CUBES_RADIUS_FLOOR_CELLS = 0.5;
// GPU render-field radius floor, in grid cells. The metaball field only
// exceeds the isovalue within radiusNorm of a particle; grid corners sit up
// to ~0.87 cells away (half a cell diagonal), so a radius under ~1 cell makes
// an isolated particle's surface a sampling coin-flip - small clusters
// (drops, solidified lumps) flickered per refresh or vanished entirely once
// dispersed. The nearest grid corner sits at most ~0.87 cells away, so 1.0
// cell is the tightest floor that guarantees a corner inside the ball; going
// higher visibly inflates small blocks (a 3^3 iron drop ballooned ~2.5x its
// physical size at 1.5 cells - user-reported).
// Scoped to SPARSE batches only: dense pools cross the isovalue by summing
// many overlapping particle fields, and flooring them inflates the liquid
// into a blob that swallows (occludes) everything inside it.
export const SPH_RENDER_FIELD_RADIUS_FLOOR_CELLS = 1.0;
export const SPH_RENDER_FIELD_RADIUS_FLOOR_MAX_PARTICLES = 64;
// Admit a vapor surface once its Beer-Lambert contrast is large enough to
// survive display quantization.  A 0.4% onset keeps effectively clear gases
// out of the geometry lane while preserving measured weak visible-band
// absorption (for example F2 at ordinary chamber path lengths).  The lower
// hide threshold supplies hysteresis without inventing material-specific
// opacity.
export const SPH_VAPOR_SURFACE_OPTICAL_DEPTH_SHOW = 4e-3;
export const SPH_VAPOR_SURFACE_OPTICAL_DEPTH_HIDE = 2e-3;
export const SPH_VAPOR_SURFACE_SCATTER_SHOW_PER_M = 1e-6;
export const SPH_DEFAULT_OPTICAL_PATH_LENGTH_M = 0.25;
export const SPH_RESIDENT_SURFACE_DRAW_DEPTH_FORMAT = 'depth24plus';
export const SPH_RESIDENT_SURFACE_REFRACTION_BACKFACE_DEPTH_FORMAT = 'depth32float';
export const SPH_RESIDENT_SURFACE_DRAW_OIT_ACCUM_FORMAT = 'rgba16float';
export const SPH_RESIDENT_SURFACE_DRAW_OIT_REVEAL_FORMAT = 'rgba8unorm';
export const SPH_RESIDENT_SURFACE_DRAW_TEMPORAL_SWAP_POLICY = 'retain-last-overlay-until-replacement-ready';
export const SPH_NATIVE_WEBGPU_SURFACE_OFFSCREEN_VALIDATION_SIZE_PX = 64;
export const SPH_NATIVE_WEBGPU_SURFACE_OFFSCREEN_VALIDATION_MAX_ATTEMPTS = 3;
export const SPH_NATIVE_WEBGPU_SURFACE_READBACK_SMOKE_FORMAT = 'rgba8unorm';
// A staged native surface can wait this long for its GPU readback proof. The
// mounted scheduler derives its presentation watchdog from this same limit so
// a valid candidate is never superseded before Scene has exhausted admission.
export const SPH_NATIVE_WEBGPU_SURFACE_VALIDATION_MAP_TIMEOUT_MS = 1000;
// A private native candidate is rendered with one exact camera transform. If
// OrbitControls changes that transform before its validated texture copy, the
// texture must be discarded rather than presented under the new camera. The
// mount may safely rebuild that same resident source after the camera settles,
// but only this narrow pre-submit condition is retryable.
export const SPH_NATIVE_SURFACE_CAMERA_SNAPSHOT_STALE_ERROR_CODE =
  'ERR_NATIVE_SURFACE_CAMERA_SNAPSHOT_STALE';
// Camera damping below this magnitude is sub-pixel for the native surface
// contract. It is deliberately narrower than all other snapshot inputs:
// lighting, domain, source buffers, and lifecycle identities remain exact.
export const SPH_NATIVE_SURFACE_CAMERA_SNAPSHOT_ABSOLUTE_TOLERANCE = 1e-6;

export function sphNativeSurfaceCandidatePresentationNumberListsMatch(
  left,
  right,
  {
    absoluteTolerance = 0
  } = {}
) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
    return false;
  }
  const tolerance = Number.isFinite(Number(absoluteTolerance))
    ? Math.max(0, Number(absoluteTolerance))
    : 0;
  return left.every((value, index) => {
    const other = right[index];
    if (Object.is(value, other)) return true;
    return tolerance > 0
      && Number.isFinite(Number(value))
      && Number.isFinite(Number(other))
      && Math.abs(Number(value) - Number(other)) <= tolerance;
  });
}
export const SPH_SURFACE_DRAW_DIAGNOSTIC_MAX_FIELD_CELLS_DEFAULT = 100_000;
export const SPH_SURFACE_DRAW_DIAGNOSTIC_MAX_RESOLUTION_DEFAULT = 8;
export const SPH_MATERIAL_INTERFACE_MAX_FIELD_CELLS_DEFAULT = 8_000;
export const SPH_MATERIAL_INTERFACE_MAX_RESOLUTION_DEFAULT = 14;
export const SPH_NATIVE_MARCHING_CUBES_MAX_VERTICES_PER_VOXEL = 15;
// 256MB worst-case vertex-row allocation (actual MC output is far smaller):
// at 128MB a typical 4-6 surface scene budgeted down to resolution 29-33,
// which reads as octahedral droplets and lets small volumes flicker below
// the isovalue. 256MB lifts those tiers to 37-42 (single surface caps at
// the 64 max). Active-voxel compaction is the real fix (task list).
export const SPH_NATIVE_MARCHING_CUBES_VERTEX_ROWS_BYTE_BUDGET_DEFAULT = 256 * 1024 * 1024;
export const SPH_SCENE_MAX_DEVICE_PIXEL_RATIO = 2;
const SPH_THREE_WEBGPU_RENDERER_REQUIRED_LIMITS_DEFAULT = Object.freeze({});
const SPH_THREE_WEBGPU_RENDERER_RESIDENT_REQUIRED_LIMITS = Object.freeze({
  maxStorageBuffersPerShaderStage: 10,
  maxBufferSize: 512 * 1024 * 1024,
  maxStorageBufferBindingSize: 512 * 1024 * 1024
});
export const SPH_THREE_WEBGPU_RENDERER_PRESENTATION_ENABLED = false;
const SPH_THREE_WEBGPU_RENDERER_PRESENTATION_RUNTIME_VALIDATED = false;
export const SPH_THREE_WEBGPU_RENDERER_OWNED_RESIDENT_DEVICE_ENABLED = false;
const SPH_THREE_WEBGPU_RENDERER_OWNED_RESIDENT_DEVICE_RUNTIME_VALIDATED = false;
export const SPH_THREE_WEBGPU_SURFACE_BUFFER_INDIRECT_RUNTIME_VALIDATED = false;
export let activeThreeNamespace = THREE;
export function setActiveThreeNamespace(ns) {
  activeThreeNamespace = ns || THREE;
}

export function nowMs() {
  return typeof globalThis.performance?.now === 'function'
    ? globalThis.performance.now()
    : Date.now();
}

function compactResidentLaneStateKeySuffix(stateKey = '') {
  let hash = 2166136261;
  const text = String(stateKey || '');
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(36);
}

const workerResidentRenderProducerSourceKeyFloat32 = new Float32Array(1);
const workerResidentRenderProducerSourceKeyUint32 =
  new Uint32Array(workerResidentRenderProducerSourceKeyFloat32.buffer);

function updateWorkerResidentRenderProducerSourceHash(hash, bits, index) {
  const value = bits >>> 0;
  hash.h1 ^= value;
  hash.h1 = Math.imul(hash.h1, 16777619) >>> 0;
  hash.h2 = (hash.h2 + Math.imul(value ^ Math.imul(index + 1, 0x45d9f3b), 0x27d4eb2d)) >>> 0;
  hash.h2 = ((hash.h2 << 13) | (hash.h2 >>> 19)) >>> 0;
}

function workerResidentRenderProducerNumericSourceKeyPart(label, value) {
  const length = value && Number.isFinite(Number(value.length))
    ? Math.max(0, Math.floor(Number(value.length)))
    : 0;
  const hash = {
    h1: (2166136261 ^ length) >>> 0,
    h2: (0x9e3779b9 ^ length) >>> 0
  };
  if (value instanceof Float32Array) {
    const bits = new Uint32Array(value.buffer, value.byteOffset, value.length);
    for (let index = 0; index < bits.length; index += 1) {
      updateWorkerResidentRenderProducerSourceHash(hash, bits[index], index);
    }
  } else if (value) {
    for (let index = 0; index < length; index += 1) {
      const number = Number(value[index]);
      workerResidentRenderProducerSourceKeyFloat32[0] = Number.isFinite(number)
        ? Math.fround(number)
        : 0;
      updateWorkerResidentRenderProducerSourceHash(
        hash,
        workerResidentRenderProducerSourceKeyUint32[0],
        index
      );
    }
  }
  return `${label}:${length}:${hash.h1.toString(36)}:${hash.h2.toString(36)}`;
}

export function workerResidentRenderProducerSourceCacheKey(
  decoded = null,
  particlePhaseIds = null
) {
  const positionsM = decoded?.positionsM || null;
  const positionLength = positionsM && Number.isFinite(Number(positionsM.length))
    ? Math.max(0, Math.floor(Number(positionsM.length)))
    : 0;
  if (positionLength <= 0) return null;
  return [
    'peercompute.ulg.worker-resident-render-producer-source-cache.v0',
    workerResidentRenderProducerNumericSourceKeyPart('positionsM', positionsM),
    workerResidentRenderProducerNumericSourceKeyPart('colorsRgb', decoded?.colorsRgb || null),
    workerResidentRenderProducerNumericSourceKeyPart('particleRadiiM', decoded?.particleRadiiM || null),
    workerResidentRenderProducerNumericSourceKeyPart('particlePhaseIds', particlePhaseIds)
  ].join('|');
}

export const WORKER_RESIDENT_PARTICLE_STATE_COLOR_ROW_FLOATS = 8;

export function workerResidentParticleStateProducerColorRows(
  decoded = null,
  {
    sphParticleState = null,
    materialProperties = null,
    reactionTable = null
  } = {}
) {
  const rows = Array.isArray(decoded?.rows) ? decoded.rows : [];
  const colorsRgb = decoded?.colorsRgb || null;
  const colorRowsByKey = new Map();
  const addColorRow = ({
    materialId,
    phaseId,
    red = 1,
    green = 1,
    blue = 1,
    alpha = 1
  } = {}) => {
    const resolvedMaterialId = Number(materialId);
    const resolvedPhaseId = Number(phaseId);
    if (!Number.isFinite(resolvedMaterialId) || !Number.isFinite(resolvedPhaseId)) return;
    const key = `${Math.round(resolvedMaterialId)}:${Math.round(resolvedPhaseId)}`;
    if (colorRowsByKey.has(key)) return;
    colorRowsByKey.set(key, {
      materialId: resolvedMaterialId,
      phaseId: resolvedPhaseId,
      red: Number.isFinite(Number(red)) ? Math.max(0, Math.min(1, Number(red))) : 1,
      green: Number.isFinite(Number(green)) ? Math.max(0, Math.min(1, Number(green))) : 1,
      blue: Number.isFinite(Number(blue)) ? Math.max(0, Math.min(1, Number(blue))) : 1,
      alpha: Number.isFinite(Number(alpha)) ? Math.max(0, Math.min(1, Number(alpha))) : 1
    });
  };
  const materialMap = buildSphRenderMaterialMap(materialProperties || {}, reactionTable);
  const colorForDescriptor = (descriptor) => {
    const properties = materialPropertiesForSurfaceDescriptor(descriptor, materialProperties);
    const optics = opticalRenderParams(opticalQueryForDescriptor(descriptor, properties));
    const intrinsicColor = Array.isArray(properties?.intrinsicColorSrgb)
      && properties.intrinsicColorSrgb.length >= 3
      ? properties.intrinsicColorSrgb
      : null;
    const opticsBlocked = optics?.blocked === true
      || optics?.provenance?.status === 'blocked';
    return {
      properties,
      color: opticsBlocked && intrinsicColor
        ? intrinsicColor
        : (optics.baseColorSrgb ?? optics.pbr?.baseColorSrgb ?? intrinsicColor ?? [1, 1, 1])
    };
  };
  for (let index = 0; index < (sphParticleState?.metadata?.length || 0); index += 1) {
    const meta = sphParticleState.metadata[index];
    const materialId = Number(meta?.materialId);
    const phaseId = Number(meta?.phaseId);
    const colorRowKey = Number.isFinite(materialId) && Number.isFinite(phaseId)
      ? `${Math.round(materialId)}:${Math.round(phaseId)}`
      : null;
    // Color rows are keyed by material + phase, not by particle. Large
    // presets may carry tens of thousands of identical metadata records;
    // resolving optical descriptors for every duplicate made presentation
    // request construction dominate the resident hot loop.
    if (colorRowKey && colorRowsByKey.has(colorRowKey)) continue;
    const descriptor = renderDescriptorForSurfaceRecord(meta, index, {
      materialProperties,
      reactionTable,
      materialMap
    });
    const { color } = colorForDescriptor(descriptor);
    addColorRow({
      materialId,
      phaseId,
      red: color[0],
      green: color[1],
      blue: color[2],
      alpha: 1
    });
  }
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const materialId = Number(row?.materialId);
    const phaseId = Number(row?.phaseId);
    const colorRowKey = Number.isFinite(materialId) && Number.isFinite(phaseId)
      ? `${Math.round(materialId)}:${Math.round(phaseId)}`
      : null;
    if (colorRowKey && colorRowsByKey.has(colorRowKey)) continue;
    const colorOffset = index * 3;
    const red = Number(colorsRgb?.[colorOffset + 0]);
    const green = Number(colorsRgb?.[colorOffset + 1]);
    const blue = Number(colorsRgb?.[colorOffset + 2]);
    addColorRow({ materialId, phaseId, red, green, blue, alpha: 1 });
  }
  const admittedPhaseIds = [
    GPU_PHASE_IDS.solid,
    GPU_PHASE_IDS.liquid,
    GPU_PHASE_IDS.gas,
    GPU_PHASE_IDS.plasma
  ];
  for (const [materialId, material] of materialMap.entries()) {
    for (const phaseId of admittedPhaseIds) {
      const descriptor = renderDescriptorForSurfaceRecord({
        materialId,
        phaseId,
        material,
        phase: phaseFromGpuPhaseId(phaseId)
      }, colorRowsByKey.size, {
        materialProperties,
        reactionTable,
        materialMap
      });
      const { color } = colorForDescriptor(descriptor);
      addColorRow({
        materialId,
        phaseId,
        red: color[0],
        green: color[1],
        blue: color[2],
        alpha: 1
      });
    }
  }
  const colorRows = new Float32Array(
    colorRowsByKey.size * WORKER_RESIDENT_PARTICLE_STATE_COLOR_ROW_FLOATS
  );
  let offset = 0;
  for (const row of colorRowsByKey.values()) {
    colorRows[offset + 0] = row.materialId;
    colorRows[offset + 1] = row.phaseId;
    colorRows[offset + 2] = 0;
    colorRows[offset + 3] = 0;
    colorRows[offset + 4] = row.red;
    colorRows[offset + 5] = row.green;
    colorRows[offset + 6] = row.blue;
    colorRows[offset + 7] = row.alpha;
    offset += WORKER_RESIDENT_PARTICLE_STATE_COLOR_ROW_FLOATS;
  }
  return colorRows;
}

function workerResidentParticleStateProducerVersionKeyPart(label, value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${label}:${number}` : `${label}:unknown`;
}

export function workerResidentParticleStateProducerSourceCacheDescriptor(sphParticleState = null, colorRows = null) {
  const particleCount = Math.max(0, Math.floor(Number(sphParticleState?.particleCount) || 0));
  if (particleCount <= 0) {
    return {
      key: null,
      strategy: 'empty',
      cpuStateStale: Boolean(sphParticleState?.cpuStateStale),
      particleCount
    };
  }
  const cpuStateStale = Boolean(
    sphParticleState?.cpuStateStale
    || sphParticleState?.status === 'gpu-resident-unread-ready'
  );
  const step = Number(sphParticleState?.step);
  const time = Number(sphParticleState?.time);
  const stateByteLength = sphParticleState?.state?.byteLength ?? 0;
  const thermoByteLength = sphParticleState?.thermo?.byteLength ?? 0;
  const stateStrideFloats = Math.max(0, Math.floor(Number(sphParticleState?.stateStrideFloats) || 0));
  const thermoStrideFloats = Math.max(0, Math.floor(Number(sphParticleState?.thermoStrideFloats) || 0));
  const colorKey = workerResidentRenderProducerNumericSourceKeyPart('materialColorRows', colorRows || null);
  const canUseVersionedKey = Number.isFinite(step) && !cpuStateStale;
  const dynamicStateKeyParts = canUseVersionedKey
    ? [
        'sourceKeyStrategy:step-time',
        workerResidentParticleStateProducerVersionKeyPart('step', step),
        workerResidentParticleStateProducerVersionKeyPart('time', time),
        `stateBytes:${stateByteLength}`,
        `thermoBytes:${thermoByteLength}`
      ]
    : [
        'sourceKeyStrategy:content-hash',
        `cpuStateStale:${cpuStateStale}`,
        workerResidentRenderProducerNumericSourceKeyPart('state', sphParticleState?.state || null),
        workerResidentRenderProducerNumericSourceKeyPart('thermo', sphParticleState?.thermo || null)
      ];
  const key = [
    'peercompute.ulg.worker-resident-particle-state-producer-source-cache.v0',
    `particleCount:${particleCount}`,
    `stateStride:${stateStrideFloats}`,
    `thermoStride:${thermoStrideFloats}`,
    ...dynamicStateKeyParts,
    colorKey
  ].join('|');
  return {
    key,
    strategy: canUseVersionedKey ? 'step-time' : 'content-hash',
    cpuStateStale,
    particleCount,
    step: Number.isFinite(step) ? step : null,
    time: Number.isFinite(time) ? time : null,
    stateByteLength,
    thermoByteLength,
    colorRowsByteLength: colorRows?.byteLength ?? 0
  };
}

export function workerResidentParticleStateProducerSourceCacheKey(sphParticleState = null, colorRows = null) {
  return workerResidentParticleStateProducerSourceCacheDescriptor(sphParticleState, colorRows).key;
}

export function scopedResidentComputeLaneId(laneId = 'ulg:sph-resident:scene', stateKey = null) {
  const base = String(laneId || 'ulg:sph-resident:scene');
  if (!stateKey) return base;
  return `${base}:state-${compactResidentLaneStateKeySuffix(stateKey)}`;
}

export function resolveSphScenePixelRatio(devicePixelRatio = globalThis.devicePixelRatio) {
  const ratio = Number(devicePixelRatio);
  if (!Number.isFinite(ratio) || ratio <= 0) return 1;
  return Math.max(1, Math.min(ratio, SPH_SCENE_MAX_DEVICE_PIXEL_RATIO));
}

export function normalizeSphRendererBackend(value, fallback = 'webgl') {
  const normalized = String(value ?? fallback).trim().toLowerCase();
  if (normalized === 'native-webgpu' || normalized === 'webgpu-native') return 'native-webgpu';
  if (normalized === 'webgpu' || normalized === 'three-webgpu') return 'webgpu';
  if (normalized === 'webgl' || normalized === 'three-webgl') return 'webgl';
  return normalizeSphRendererBackend(fallback, 'webgl');
}

export function createNativeWebGpuCanvasRenderer({
  documentRef = globalThis.document,
  width = 1,
  height = 1,
  preserveDrawingBuffer = false
} = {}) {
  const canvas = documentRef?.createElement?.('canvas');
  if (!canvas) throw new Error('native WebGPU renderer requires document canvas creation');
  const renderer = {
    isNativeWebGPURenderer: true,
    isWebGLRenderer: false,
    isWebGPURenderer: false,
    domElement: canvas,
    userData: {
      sphNativeWebGpuRenderer: true,
      sphNativeWebGpuPreserveDrawingBuffer: Boolean(preserveDrawingBuffer)
    },
    outputColorSpace: null,
    toneMapping: null,
    toneMappingExposure: 1,
    _pixelRatio: 1,
    _width: Math.max(1, Math.round(Number(width) || 1)),
    _height: Math.max(1, Math.round(Number(height) || 1)),
    setPixelRatio(pixelRatio = 1) {
      const ratio = Number(pixelRatio);
      this._pixelRatio = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
      this.setSize(this._width, this._height, false);
    },
    getPixelRatio() {
      return this._pixelRatio;
    },
    setSize(nextWidth = this._width, nextHeight = this._height, updateStyle = true) {
      this._width = Math.max(1, Math.round(Number(nextWidth) || 1));
      this._height = Math.max(1, Math.round(Number(nextHeight) || 1));
      const backingWidth = Math.max(1, Math.floor(this._width * this._pixelRatio));
      const backingHeight = Math.max(1, Math.floor(this._height * this._pixelRatio));
      if (canvas.width !== backingWidth) canvas.width = backingWidth;
      if (canvas.height !== backingHeight) canvas.height = backingHeight;
      if (updateStyle) {
        canvas.style.width = `${this._width}px`;
        canvas.style.height = `${this._height}px`;
      }
    },
    getDrawingBufferSize(target = null) {
      if (target && typeof target.set === 'function') return target.set(canvas.width, canvas.height);
      if (target) {
        target.x = canvas.width;
        target.y = canvas.height;
        return target;
      }
      return { x: canvas.width, y: canvas.height };
    },
    render() {
      this.userData.sphNativeWebGpuRendererFrameCount =
        (this.userData.sphNativeWebGpuRendererFrameCount || 0) + 1;
    },
    dispose() {
      const consumer = this.userData.sphNativeWebGpuSurfaceConsumer;
      consumer?.context?.unconfigure?.();
      consumer?.depthTexture?.destroy?.();
      consumer?.oitAccumTexture?.destroy?.();
      consumer?.oitRevealTexture?.destroy?.();
      this.userData.sphNativeWebGpuSurfaceConsumer = null;
    }
  };
  renderer.setSize(width, height, false);
  return renderer;
}

export function resolveThreeWebGpuRendererRequiredLimits({
  rendererWebGpuResidentDevice = SPH_THREE_WEBGPU_RENDERER_OWNED_RESIDENT_DEVICE_ENABLED
} = {}) {
  const requiredLimits = rendererWebGpuResidentDevice
    ? SPH_THREE_WEBGPU_RENDERER_RESIDENT_REQUIRED_LIMITS
    : SPH_THREE_WEBGPU_RENDERER_REQUIRED_LIMITS_DEFAULT;
  return { ...requiredLimits };
}

export function resolveThreeWebGpuPresentationPolicy({
  webGpuRendererAvailable = false,
  requestedPresentation = SPH_THREE_WEBGPU_RENDERER_PRESENTATION_ENABLED,
  rendererWebGpuResidentDevice = SPH_THREE_WEBGPU_RENDERER_OWNED_RESIDENT_DEVICE_ENABLED,
  runtimeValidated = SPH_THREE_WEBGPU_RENDERER_PRESENTATION_RUNTIME_VALIDATED,
  unsafeDiagnosticOverride = false
} = {}) {
  const requested = Boolean(requestedPresentation);
  const available = Boolean(webGpuRendererAvailable);
  const unsafeOverride = Boolean(unsafeDiagnosticOverride);
  const blockedByRuntime = Boolean(
    available
    && requested
    && !runtimeValidated
    && !unsafeOverride
  );
  const blockedByResidentDevice = Boolean(
    available
    && requested
    && !blockedByRuntime
    && !unsafeOverride
    && !rendererWebGpuResidentDevice
  );
  const blocked = Boolean(blockedByRuntime || blockedByResidentDevice);
  const unsafeRuntimeBypass = Boolean(available && requested && unsafeOverride && !runtimeValidated);
  const enabled = Boolean(available && requested && !blocked);
  const reason = blocked
    ? (blockedByRuntime
      ? 'Three WebGPU presentation is blocked because the current renderer path still fails WebGPU error-scope validation; falling back to WebGL engine rendering while preserving WebGPU compute'
      : 'Three WebGPU presentation is blocked until renderer-owned resident-device usage is explicitly enabled; falling back to WebGL engine rendering')
    : (unsafeRuntimeBypass
      ? (rendererWebGpuResidentDevice
        ? 'Three WebGPU presentation is enabled only for the explicit unsafe diagnostic route; browser console and pixel validation must pass before promotion'
        : 'Three WebGPU presentation is enabled only for the explicit unsafe presentation-only diagnostic route; resident compute uses its separate GPUDevice and this cannot validate same-device no-readback surface buffers')
      : null);
  const enabledUnsafeDiagnostic = Boolean(enabled && unsafeRuntimeBypass);
  const enabledStatus = enabledUnsafeDiagnostic
    ? 'three-webgpu-presentation-enabled-unsafe-diagnostic'
    : 'three-webgpu-presentation-enabled';
  const status = !available
    ? 'three-webgpu-presentation-unavailable'
    : (!requested
      ? 'three-webgpu-presentation-not-requested'
      : (enabled
        ? enabledStatus
        : (blockedByRuntime
          ? 'three-webgpu-presentation-blocked-runtime-validation'
          : 'three-webgpu-presentation-blocked-resident-device')));
  return {
    schema: 'peercompute.ulg.sph-three-webgpu-presentation-policy.v0',
    status,
    reason,
    webGpuRendererAvailable: available,
    requestedPresentation: requested,
    rendererWebGpuResidentDevice: Boolean(rendererWebGpuResidentDevice),
    runtimeValidated: Boolean(runtimeValidated),
    unsafeDiagnosticOverride: unsafeOverride,
    unsafeRuntimeBypass,
    enabledUnsafeDiagnostic,
    blocked,
    blockedByRuntime,
    blockedByResidentDevice,
    enabled
  };
}

export function summarizeThreeWebGpuDeviceLimits(device = null) {
  const limits = device?.limits || {};
  const summary = {};
  for (const key of [
    'maxStorageBuffersPerShaderStage',
    'maxBufferSize',
    'maxStorageBufferBindingSize'
  ]) {
    const value = Number(limits[key]);
    summary[key] = Number.isFinite(value) && value > 0 ? value : null;
  }
  return summary;
}

export function resolveSphSceneViewportSize(container, {
  fallbackWidth = 800,
  fallbackHeight = 520,
  visualViewport = globalThis.visualViewport
} = {}) {
  const rect = typeof container?.getBoundingClientRect === 'function'
    ? container.getBoundingClientRect()
    : null;
  const candidates = {
    clientWidth: Number(container?.clientWidth),
    clientHeight: Number(container?.clientHeight),
    rectWidth: Number(rect?.width),
    rectHeight: Number(rect?.height),
    visualViewportWidth: Number(visualViewport?.width),
    visualViewportHeight: Number(visualViewport?.height)
  };
  const firstPositive = (...values) => {
    for (const value of values) {
      if (Number.isFinite(value) && value > 0) return value;
    }
    return 1;
  };
  const width = firstPositive(
    candidates.clientWidth,
    candidates.rectWidth,
    candidates.visualViewportWidth,
    fallbackWidth
  );
  const height = firstPositive(
    candidates.clientHeight,
    candidates.rectHeight,
    candidates.visualViewportHeight,
    fallbackHeight
  );
  return {
    width,
    height,
    aspect: width / height,
    ...candidates
  };
}

export function resolveSphSurfaceRendererMaterialPolicy({
  rendererBackend = 'three-webgl',
  navigatorRef = globalThis.navigator,
  container = null,
  visualViewport = globalThis.visualViewport
} = {}) {
  const backend = String(rendererBackend || 'three-webgl').trim().toLowerCase();
  const rect = typeof container?.getBoundingClientRect === 'function'
    ? container.getBoundingClientRect()
    : null;
  const viewportWidth = Number(visualViewport?.width ?? rect?.width ?? container?.clientWidth ?? globalThis.innerWidth);
  const viewportHeight = Number(visualViewport?.height ?? rect?.height ?? container?.clientHeight ?? globalThis.innerHeight);
  const viewportMin = Math.min(
    Number.isFinite(viewportWidth) && viewportWidth > 0 ? viewportWidth : Infinity,
    Number.isFinite(viewportHeight) && viewportHeight > 0 ? viewportHeight : Infinity
  );
  const userAgent = String(navigatorRef?.userAgent || '').toLowerCase();
  const maxTouchPoints = Math.max(0, Math.round(Number(navigatorRef?.maxTouchPoints) || 0));
  const coarsePointer = Boolean(
    typeof globalThis.matchMedia === 'function'
    && globalThis.matchMedia('(pointer: coarse)')?.matches
  );
  const touchTarget = maxTouchPoints > 0
    || coarsePointer
    || Boolean(globalThis.ontouchstart);
  const mobileUserAgent = /android|iphone|ipad|ipod|mobile/.test(userAgent);
  const mobileViewport = Number.isFinite(viewportMin) && viewportMin <= 640;
  const mobileTarget = Boolean(mobileUserAgent || (touchTarget && mobileViewport));
  const rendererIsWebGL = backend === 'three-webgl' || backend === 'three-webgpu-webgl-fallback';
  const rendererIsWebGPU = backend === 'three-webgpu';
  const transmissiveProxyRequired = Boolean(rendererIsWebGPU || (rendererIsWebGL && mobileTarget));
  const status = transmissiveProxyRequired
    ? (rendererIsWebGPU
      ? 'surface-material-three-webgpu-transmission-proxy'
      : 'surface-material-mobile-webgl-transmission-proxy')
    : 'surface-material-true-pbr';
  const reason = transmissiveProxyRequired
    ? (rendererIsWebGPU
      ? 'Three WebGPU surface meshes proxy transmissive materials through visible closure-derived color because MeshPhysicalMaterial transmission is not stable across the current renderer paths'
      : 'mobile WebGL surface meshes proxy transmissive materials through visible closure-derived color because MeshPhysicalMaterial transmission can render black')
    : null;
  const signature = [
    status,
    backend,
    mobileTarget ? 'mobile' : 'desktop',
    rendererIsWebGPU ? 'webgpu' : (rendererIsWebGL ? 'webgl' : 'unknown')
  ].join(':');
  return {
    schema: 'peercompute.ulg.sph-surface-renderer-material-policy.v0',
    status,
    reason,
    signature,
    rendererBackend: backend,
    rendererIsWebGL,
    rendererIsWebGPU,
    mobileTarget,
    touchTarget,
    mobileUserAgent,
    mobileViewport,
    viewportWidth: Number.isFinite(viewportWidth) ? viewportWidth : null,
    viewportHeight: Number.isFinite(viewportHeight) ? viewportHeight : null,
    maxTouchPoints,
    transmissiveProxyRequired
  };
}

export const RESIDENT_FULL_READBACK_MODE = 'full-parity-readback';
export const RESIDENT_NO_FULL_READBACK_MODE = 'no-full-readback';

export function rendererOwnedCpuRenderRowsFallbackAllowed({
  rendererOwnedDevice = false,
  readbackMode = RESIDENT_FULL_READBACK_MODE,
  sphParticleUpload = null
} = {}) {
  return Boolean(
    rendererOwnedDevice
    && readbackMode !== RESIDENT_NO_FULL_READBACK_MODE
    && !sphGpuParticleUploadAdvertisesDispersedMediumOptics(
      sphParticleUpload
    )
  );
}

export function resolveRenderFieldCpuParityDispersedMediumAdmission(
  renderRowsExecution
) {
  const residentDispersedMedium =
    sphGpuParticleUploadAdvertisesDispersedMediumOptics(
      renderRowsExecution
    );
  const hostRows = renderRowsExecution?.dispersedMediumOpticsRows ?? null;
  const authenticatedHostSnapshot =
    renderRowsExecution?.dispersedMediumOpticsHostReadback === true;
  if (hostRows != null && !(hostRows instanceof Float32Array)) {
    return Object.freeze({
      ok: false,
      status: 'render-field-cpu-parity-unavailable-dispersed-medium',
      reason: 'dispersed-medium CPU parity requires exact Float32Array host rows',
      dispersedMediumOpticsRows: null
    });
  }
  if (
    residentDispersedMedium
    && (hostRows == null || !authenticatedHostSnapshot)
  ) {
    return Object.freeze({
      ok: false,
      status: 'render-field-cpu-parity-unavailable-dispersed-medium',
      reason:
        'resident dispersed-medium optics have no authenticated host snapshot; legacy material geometry is not a valid CPU parity reference',
      dispersedMediumOpticsRows: null
    });
  }
  return Object.freeze({
    ok: true,
    status: 'render-field-cpu-parity-admitted',
    reason: null,
    dispersedMediumOpticsRows: hostRows
  });
}

export const SPH_RESIDENT_SURFACE_DRAW_OVERLAY_MODE_DEFAULT = 'disabled';
export const SPH_THREE_WEBGPU_BINDING_REASON = 'raw WebGPU canvas overlay disabled until it can share Three scene depth; using Three/MarchingCubes render-field readback';
export const SPH_THREE_COMPACT_VERTEX_BRIDGE_MODE = 'three-compact-vertices';
export const SPH_THREE_COMPACT_VERTEX_BRIDGE_STATUS = 'three-compact-surface-geometry-ready';
export const SPH_THREE_WEBGPU_SURFACE_BUFFER_BRIDGE_MODE = 'three-webgpu-surface-buffers';
export const SPH_THREE_WEBGPU_SURFACE_BUFFER_BRIDGE_STATUS = 'three-webgpu-surface-buffers-ready';
export const SPH_RESIDENT_SURFACE_BUFFER_HANDOFF_MODE = 'resident-surface-buffers-no-overlay';
export const SPH_EXTENSION_RESIDENT_SURFACE_BUFFER_HANDOFF_MODE = 'extension-resident-surface-buffers-no-overlay';
export const SPH_NATIVE_WEBGPU_SURFACE_CONSUMER_BRIDGE_MODE = 'native-webgpu-surface-consumer';
export const SPH_NATIVE_WEBGPU_SURFACE_CONSUMER_BRIDGE_STATUS = 'native-webgpu-surface-consumer-ready';
const SPH_NATIVE_WEBGPU_SURFACE_CONSUMER_DEBUG_MODES = new Set(['none', 'clear-only']);
export const SPH_NATIVE_WEBGPU_SURFACE_CONSUMER_CLEAR_SENTINEL_VALUE = Object.freeze({
  r: 0.08,
  g: 0.48,
  b: 0.76,
  a: 1
});
const SPH_THREE_COMPACT_VERTEX_PRESENTATION_ENABLED = false;
const SPH_THREE_COMPACT_VERTEX_PRESENTATION_BLOCK_REASON =
  'three-compact-vertices disabled: current WebGPU surface extraction emits tetrahedralized render-field cubes and compact readback can stall; using the engine-managed marching-cubes/render-field path until webgpu-marching-cubes direct-buffer integration is pixel validated';
export const SPH_THREE_WEBGPU_SURFACE_BUFFER_PRESENTATION_ENABLED = false;
const SPH_THREE_WEBGPU_EXTERNAL_BUFFER_PIPELINE_RUNTIME_VALIDATED = false;
export const SPH_THREE_RENDER_ROW_POINTS_BRIDGE_MODE = 'three-render-row-points';
export const SPH_THREE_RENDER_ROW_POINTS_BRIDGE_STATUS = 'three-render-row-points-ready';
export const SPH_THREE_RENDER_ROW_SPHERES_BRIDGE_MODE = 'three-render-row-spheres';
export const SPH_THREE_RENDER_ROW_SPHERES_BRIDGE_STATUS = 'three-render-row-spheres-ready';
export const SPH_THREE_RENDER_ROW_SPHERES_MAX_INSTANCES = 4096;
export const SPH_WEBGPU_RENDER_ROW_POINTS_BRIDGE_MODE = 'webgpu-render-row-points';
export const SPH_WEBGPU_RENDER_ROW_POINTS_BRIDGE_STATUS = 'webgpu-render-row-points-ready';
export const SPH_WEBGPU_RENDER_ROW_SPHERES_BRIDGE_MODE = 'webgpu-render-row-spheres';
export const SPH_WEBGPU_RENDER_ROW_SPHERES_BRIDGE_STATUS = 'webgpu-render-row-spheres-ready';
export const SPH_RENDER_ROW_WEBGPU_OVERLAY_CAMERA_FLOATS = 20;
export const SPH_WEBGPU_RENDER_ROW_OVERLAY_PRESENTATION_ENABLED = false;

export function resolveSphSurfaceDrawDiagnosticPresentationMode({
  requestedMode = 'auto',
  compactVertexPresentationEnabled = SPH_THREE_COMPACT_VERTEX_PRESENTATION_ENABLED,
  webGpuRenderRowOverlayRequestedButDisabled = false
} = {}) {
  const requested = String(requestedMode || 'auto').trim().toLowerCase() || 'auto';
  if (requested === SPH_THREE_COMPACT_VERTEX_BRIDGE_MODE && !compactVertexPresentationEnabled) {
    return {
      schema: 'peercompute.ulg.sph-surface-draw-diagnostic-presentation-mode.v0',
      requestedMode: requested,
      effectiveMode: 'auto',
      fallbackReason: SPH_THREE_COMPACT_VERTEX_PRESENTATION_BLOCK_REASON,
      compactVertexPresentationBlocked: true,
      webGpuRenderRowOverlayBlocked: false
    };
  }
  if (webGpuRenderRowOverlayRequestedButDisabled && isWebGpuResidentRenderRowBridgeMode(requested)) {
    const effectiveMode = requested === SPH_WEBGPU_RENDER_ROW_SPHERES_BRIDGE_MODE
      || requested === 'webgpu-spheres'
      ? SPH_THREE_RENDER_ROW_SPHERES_BRIDGE_MODE
      : SPH_THREE_RENDER_ROW_POINTS_BRIDGE_MODE;
    return {
      schema: 'peercompute.ulg.sph-surface-draw-diagnostic-presentation-mode.v0',
      requestedMode: requested,
      effectiveMode,
      fallbackReason: 'webgpu-render-row-overlay-disabled-pending-pixel-validation',
      compactVertexPresentationBlocked: false,
      webGpuRenderRowOverlayBlocked: true
    };
  }
  return {
    schema: 'peercompute.ulg.sph-surface-draw-diagnostic-presentation-mode.v0',
    requestedMode: requested,
    effectiveMode: requested,
    fallbackReason: null,
    compactVertexPresentationBlocked: false,
    webGpuRenderRowOverlayBlocked: false
  };
}

export function resolveSphSurfaceDrawRefreshContinuityMode({
  requestedMode = 'auto',
  previousVisibleRendererBridge = null,
  previousBridgeVisible = false
} = {}) {
  const requested = String(requestedMode || 'auto').trim().toLowerCase() || 'auto';
  const previous = String(previousVisibleRendererBridge || '').trim().toLowerCase();
  const retainedPreviousNativeSurfaceConsumer = Boolean(
    requested === 'auto'
    && previousBridgeVisible === true
    && previous === SPH_NATIVE_WEBGPU_SURFACE_CONSUMER_BRIDGE_MODE
  );
  return {
    schema: 'peercompute.ulg.sph-surface-draw-refresh-continuity-mode.v0',
    status: retainedPreviousNativeSurfaceConsumer
      ? 'surface-draw-auto-retained-visible-native-consumer'
      : 'surface-draw-refresh-mode-unchanged',
    requestedMode: requested,
    effectiveMode: retainedPreviousNativeSurfaceConsumer
      ? SPH_NATIVE_WEBGPU_SURFACE_CONSUMER_BRIDGE_MODE
      : requested,
    previousVisibleRendererBridge: previous || null,
    previousBridgeVisible: Boolean(previousBridgeVisible),
    retainedPreviousNativeSurfaceConsumer,
    reason: retainedPreviousNativeSurfaceConsumer
      ? 'auto refresh must keep the committed native presenter until a different visible replacement is explicitly selected'
      : null
  };
}

/**
 * Decide how a native presentation refresh handles an explicitly deferred
 * marching-cubes extraction. A raw render-field buffer handoff is not itself a
 * runtime-admitted native presentation, so it may only be retained while an
 * already admitted native surface remains bound.
 */
export function resolveSphNativeSurfaceExtractionDeferralPolicy({
  nativeSurfaceConsumerRequested = false,
  nativeSurfaceExtractionAllowed = true,
  previousNativeSurfaceVisible = false,
  deferredRenderFieldHandoff = false
} = {}) {
  const nativeConsumer = nativeSurfaceConsumerRequested === true;
  const extractionAllowed = nativeSurfaceExtractionAllowed !== false;
  const previousVisible = previousNativeSurfaceVisible === true;
  const deferredHandoff = deferredRenderFieldHandoff === true;
  const deferralRequested = nativeConsumer && !extractionAllowed;
  const forceInitialExtraction = deferralRequested && !previousVisible;
  const retainPreviousNativeSurface = deferralRequested
    && previousVisible
    && deferredHandoff;
  const status = !nativeConsumer
    ? 'native-surface-extraction-deferral-not-applicable'
    : extractionAllowed
    ? 'native-surface-extraction-deferral-not-requested'
    : forceInitialExtraction
    ? 'native-surface-extraction-forced-for-first-visible-presentation'
    : retainPreviousNativeSurface
    ? 'native-surface-extraction-deferred-retaining-previous-presentation'
    : 'native-surface-extraction-deferral-awaiting-render-field-handoff';
  return Object.freeze({
    schema: 'peercompute.ulg.sph-native-surface-extraction-deferral-policy.v0',
    status,
    nativeSurfaceConsumerRequested: nativeConsumer,
    nativeSurfaceExtractionAllowedByCaller: extractionAllowed,
    previousNativeSurfaceVisible: previousVisible,
    deferredRenderFieldHandoff: deferredHandoff,
    nativeSurfaceExtractionEffectiveAllowed:
      extractionAllowed || forceInitialExtraction,
    nativeSurfaceExtractionForcedForFirstVisiblePresentation:
      forceInitialExtraction,
    retainPreviousNativeSurface,
    releaseDeferredRenderFieldHandoff: retainPreviousNativeSurface,
    reason: forceInitialExtraction
      ? 'a native presentation has no runtime-admitted predecessor, so its first surface extraction cannot be deferred'
      : retainPreviousNativeSurface
      ? 'a zero-geometry render-field handoff has no native consumer; retain the runtime-admitted prior presentation until a real replacement is ready'
      : null
  });
}

export function resolveRenderRowSphereBridgeContract({
  sphereBridgeUsed = false,
  materialRendererProxy = false
} = {}) {
  const used = Boolean(sphereBridgeUsed);
  return {
    particleRenderMode: used ? 'variable-size-spheres' : 'points',
    sphereBridgeSizingMode: used ? 'per-particle-radius' : null,
    sphereBridgeVariableSize: used,
    sphereBridgePbrMaterialSource: used
      ? (materialRendererProxy ? 'closure-derived-pbr-proxied-for-renderer' : 'closure-derived-pbr')
      : null,
    sphereBridgeClosurePbr: used,
    pointsVertexColorOnly: !used
  };
}

export function resolveResidentRenderRowBridgeReadbackPlan({
  requestedRenderRowsReadbackMode = null,
  useThreeRenderRowBridge = false,
  useWebGpuRenderRowOverlayBridge = false,
  useWorkerOffscreenPresentation = false,
  usePresentationWorkerRetainedOutputPresentationOnly = false,
  workerOffscreenRetainedStageOutputAvailable = false,
  useWorkerOwnedResidentRenderProducer = false,
  useWorkerOwnedResidentParticleStateProducer = false,
  previousThreeRenderRowBridgeVisible = false
} = {}) {
  const requestedRenderRowsReadbackModeFromCaller =
    requestedRenderRowsReadbackMode === RESIDENT_FULL_READBACK_MODE
    || requestedRenderRowsReadbackMode === RESIDENT_NO_FULL_READBACK_MODE
      ? requestedRenderRowsReadbackMode
      : SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT;
  const threeBridge = Boolean(useThreeRenderRowBridge);
  const webGpuOverlayBridge = Boolean(useWebGpuRenderRowOverlayBridge);
  const workerOffscreenPresentationBridge = Boolean(useWorkerOffscreenPresentation);
  const presentationWorkerRetainedOutputPresentationOnlyBridge = Boolean(
    workerOffscreenPresentationBridge
    && usePresentationWorkerRetainedOutputPresentationOnly
    && workerOffscreenRetainedStageOutputAvailable
  );
  const effectiveThreeBridge = Boolean(threeBridge && !presentationWorkerRetainedOutputPresentationOnlyBridge);
  const workerOwnedResidentRenderProducerBridge = Boolean(useWorkerOwnedResidentRenderProducer);
  const workerOwnedResidentParticleStateProducerBridge = Boolean(
    workerOwnedResidentRenderProducerBridge
    && useWorkerOwnedResidentParticleStateProducer
  );
  const workerOwnedResidentRenderRowsSourceTransferBridge = Boolean(
    workerOwnedResidentRenderProducerBridge
    && !workerOwnedResidentParticleStateProducerBridge
  );
  const workerOwnedResidentParticleStatePresentationOnlyBridge = Boolean(
    effectiveThreeBridge
    && workerOffscreenPresentationBridge
    && workerOwnedResidentParticleStateProducerBridge
  );
  const workerOffscreenRenderRowsTransferBridge = Boolean(
    workerOffscreenPresentationBridge
    && !presentationWorkerRetainedOutputPresentationOnlyBridge
    && !workerOwnedResidentParticleStateProducerBridge
  );
  const retainPreviousThreeRenderRowBridgeNoFull = Boolean(
    workerOwnedResidentParticleStatePresentationOnlyBridge
    && previousThreeRenderRowBridgeVisible
    && requestedRenderRowsReadbackModeFromCaller === RESIDENT_NO_FULL_READBACK_MODE
  );
  let requestedRenderRowsReadbackModeResolved = requestedRenderRowsReadbackModeFromCaller;
  if (webGpuOverlayBridge) {
    requestedRenderRowsReadbackModeResolved = RESIDENT_NO_FULL_READBACK_MODE;
  } else if (
    !retainPreviousThreeRenderRowBridgeNoFull
    && !workerOwnedResidentParticleStatePresentationOnlyBridge
    && (
      effectiveThreeBridge
      || workerOffscreenRenderRowsTransferBridge
      || workerOwnedResidentRenderRowsSourceTransferBridge
    )
  ) {
    requestedRenderRowsReadbackModeResolved = RESIDENT_FULL_READBACK_MODE;
  }
  let renderRowsReadbackModeCoercionReason = null;
  if (retainPreviousThreeRenderRowBridgeNoFull) {
    renderRowsReadbackModeCoercionReason = 'three-render-row-bridge-retains-previous-no-full-readback';
  } else if (
    effectiveThreeBridge
    && requestedRenderRowsReadbackModeFromCaller === RESIDENT_NO_FULL_READBACK_MODE
    && !workerOwnedResidentParticleStatePresentationOnlyBridge
  ) {
    renderRowsReadbackModeCoercionReason = 'three-render-row-bridge-requires-fresh-physics-readback';
  } else if (
    workerOwnedResidentRenderRowsSourceTransferBridge
    && requestedRenderRowsReadbackModeFromCaller === RESIDENT_NO_FULL_READBACK_MODE
    && !webGpuOverlayBridge
  ) {
    renderRowsReadbackModeCoercionReason =
      'worker-owned-resident-render-producer-source-transfer-requires-fresh-physics-readback';
  } else if (
    workerOffscreenRenderRowsTransferBridge
    && requestedRenderRowsReadbackModeFromCaller === RESIDENT_NO_FULL_READBACK_MODE
    && !webGpuOverlayBridge
  ) {
    renderRowsReadbackModeCoercionReason =
      'worker-offscreen-render-rows-transitional-bridge-requires-fresh-physics-readback';
  }
  return {
    schema: 'peercompute.ulg.sph-resident-render-row-bridge-readback-plan.v0',
    requestedRenderRowsReadbackModeFromCaller,
    requestedRenderRowsReadbackMode: requestedRenderRowsReadbackModeResolved,
    renderRowsReadbackModeCoercionReason,
    retainPreviousThreeRenderRowBridgeNoFull,
    previousThreeRenderRowBridgeVisible: Boolean(previousThreeRenderRowBridgeVisible),
    freshPhysicsReadbackRequired:
      (effectiveThreeBridge || workerOffscreenRenderRowsTransferBridge || workerOwnedResidentRenderRowsSourceTransferBridge)
      && !webGpuOverlayBridge
      && !retainPreviousThreeRenderRowBridgeNoFull
      && !workerOwnedResidentParticleStatePresentationOnlyBridge,
    webGpuOverlayNoFullReadback: webGpuOverlayBridge,
    presentationWorkerRetainedOutputPresentationOnlyReadbackFree:
      presentationWorkerRetainedOutputPresentationOnlyBridge,
    workerOffscreenPresentationReadbackRequired:
      workerOffscreenRenderRowsTransferBridge && !webGpuOverlayBridge,
    workerOwnedResidentRenderProducerReadbackRequired:
      workerOwnedResidentRenderRowsSourceTransferBridge && !webGpuOverlayBridge,
    workerOwnedResidentParticleStateProducerReadbackFree:
      workerOwnedResidentParticleStateProducerBridge && !webGpuOverlayBridge,
    workerOwnedResidentParticleStateProducerPresentationOnly:
      workerOwnedResidentParticleStatePresentationOnlyBridge
  };
}

function normalizeSphNativeWebGpuSurfaceConsumerDebugMode(value, fallback = 'none') {
  if ((value == null || String(value).trim() === '') && fallback === '') return '';
  const normalized = String(value ?? fallback).trim().toLowerCase();
  if (SPH_NATIVE_WEBGPU_SURFACE_CONSUMER_DEBUG_MODES.has(normalized)) return normalized;
  if (normalized === 'clear' || normalized === 'clearonly' || normalized === 'sentinel-clear') return 'clear-only';
  return SPH_NATIVE_WEBGPU_SURFACE_CONSUMER_DEBUG_MODES.has(fallback) ? fallback : 'none';
}

function nativeSurfaceValidationAttemptCount(value) {
  return Math.max(0, Math.round(Number(value) || 0));
}

export function resolveSphNativeWebGpuSurfaceValidationCadence({
  bridge = null,
  rendererBridge = null,
  submittedDrawCount = 0,
  debugClearOnly = false,
  bridgeFormat = null,
  readbackSmokeValidationPending = null,
  readbackSmokeValidationStatus = null,
  readbackSmokeValidationFormat = null,
  readbackSmokeValidationAttemptCount = null,
  offscreenValidationPending = null,
  offscreenValidationStatus = null,
  offscreenValidationTextureFormat = null,
  offscreenValidationAttemptCount = null,
  maxAttempts = SPH_NATIVE_WEBGPU_SURFACE_OFFSCREEN_VALIDATION_MAX_ATTEMPTS
} = {}) {
  const normalizedRendererBridge = rendererBridge ?? bridge?.rendererBridge ?? null;
  const nativeSurfaceConsumer =
    normalizedRendererBridge === SPH_NATIVE_WEBGPU_SURFACE_CONSUMER_BRIDGE_MODE;
  const sameDeviceReadbackValidationEnabled =
    bridge?.enableRuntimePixelReadback === true;
  const normalizedMaxAttempts = Math.max(0, Math.round(Number(maxAttempts) || 0));
  const normalizedSubmittedDrawCount = Math.max(0, Math.round(Number(submittedDrawCount) || 0));
  const nativeSurfaceDebugClearOnly = Boolean(nativeSurfaceConsumer && debugClearOnly);
  const nativeSurfaceSubmittedDrawsAvailable = normalizedSubmittedDrawCount > 0;
  const validationScope = nativeSurfaceDebugClearOnly
    ? 'native-current-texture-debug-clear'
    : (nativeSurfaceSubmittedDrawsAvailable ? 'native-surface-draw' : 'native-no-submitted-draws');
  const normalizedBridgeFormat = bridgeFormat ?? bridge?.format ?? null;
  const normalizedReadbackStatus = String(
    readbackSmokeValidationStatus
      ?? bridge?.readbackSmokeValidationStatus
      ?? 'not-run'
  );
  const normalizedReadbackFormat =
    readbackSmokeValidationFormat ?? bridge?.readbackSmokeValidationFormat ?? null;
  const normalizedReadbackAttemptCount = nativeSurfaceValidationAttemptCount(
    readbackSmokeValidationAttemptCount ?? bridge?.readbackSmokeValidationAttemptCount
  );
  const readbackPending = Boolean(
    readbackSmokeValidationPending ?? bridge?.readbackSmokeValidationPending
  );
  const readbackPassedCurrentFormat = Boolean(
    normalizedReadbackStatus === 'passed'
    && normalizedReadbackFormat === SPH_NATIVE_WEBGPU_SURFACE_READBACK_SMOKE_FORMAT
  );
  const readbackAttemptsExhausted = Boolean(
    normalizedReadbackAttemptCount >= normalizedMaxAttempts
    && normalizedReadbackStatus
    && normalizedReadbackStatus !== 'pending'
  );
  const readbackSmokeValidationNeeded = Boolean(
    nativeSurfaceConsumer
    && sameDeviceReadbackValidationEnabled
    && !readbackPending
    && !readbackPassedCurrentFormat
    && !readbackAttemptsExhausted
  );

  const normalizedOffscreenStatus = String(
    offscreenValidationStatus
      ?? bridge?.offscreenValidationStatus
      ?? 'not-run'
  );
  const normalizedOffscreenTextureFormat =
    offscreenValidationTextureFormat ?? bridge?.offscreenValidationTextureFormat ?? null;
  const targetResourceGeneration = Number.isFinite(Number(
    bridge?.offscreenValidationTargetResourceGeneration
    ?? bridge?.activeSurfaceResourceOwner?.generation
    ?? bridge?.nativeSurfaceResourceGeneration
  ))
    ? Math.max(0, Math.round(Number(
      bridge?.offscreenValidationTargetResourceGeneration
      ?? bridge?.activeSurfaceResourceOwner?.generation
      ?? bridge?.nativeSurfaceResourceGeneration
    )))
    : null;
  const validatedResourceGeneration = Number.isFinite(Number(
    bridge?.offscreenValidationResourceGeneration
  ))
    ? Math.max(0, Math.round(Number(bridge.offscreenValidationResourceGeneration)))
    : null;
  const attemptResourceGeneration = Number.isFinite(Number(
    bridge?.offscreenValidationAttemptResourceGeneration
  ))
    ? Math.max(0, Math.round(Number(bridge.offscreenValidationAttemptResourceGeneration)))
    : null;
  const normalizedOffscreenAttemptCount = attemptResourceGeneration === targetResourceGeneration
    ? nativeSurfaceValidationAttemptCount(
      offscreenValidationAttemptCount ?? bridge?.offscreenValidationAttemptCount
    )
    : 0;
  const offscreenPending = Boolean(
    offscreenValidationPending ?? bridge?.offscreenValidationPending
  );
  const offscreenPassedCurrentFormat = Boolean(
    normalizedOffscreenStatus === 'passed'
    && normalizedOffscreenTextureFormat === normalizedBridgeFormat
    && targetResourceGeneration != null
    && validatedResourceGeneration === targetResourceGeneration
  );
  const offscreenAttemptsExhausted = Boolean(
    normalizedOffscreenAttemptCount >= normalizedMaxAttempts
    && normalizedOffscreenStatus
    && normalizedOffscreenStatus !== 'pending'
  );
  const offscreenValidationEligible = Boolean(
    nativeSurfaceConsumer
    && sameDeviceReadbackValidationEnabled
    && !nativeSurfaceDebugClearOnly
    && nativeSurfaceSubmittedDrawsAvailable
  );
  const offscreenValidationSkippedReason = (() => {
    if (!nativeSurfaceConsumer || offscreenValidationEligible || offscreenPassedCurrentFormat) return null;
    if (nativeSurfaceDebugClearOnly) {
      return 'native WebGPU debug clear-only validates the current texture; offscreen surface validation requires submitted surface draws';
    }
    return 'native WebGPU offscreen surface validation requires submitted surface draws';
  })();
  const offscreenValidationNeeded = Boolean(
    offscreenValidationEligible
    && !offscreenPending
    && !offscreenPassedCurrentFormat
    && !offscreenAttemptsExhausted
  );
  const validationEncoderRequired = Boolean(
    nativeSurfaceConsumer
    && (readbackSmokeValidationNeeded || offscreenValidationNeeded)
  );
  let status = 'native-webgpu-surface-validation-skipped-non-native-consumer';
  let reason = 'native WebGPU surface validation only runs for the native surface consumer bridge';
  if (nativeSurfaceConsumer && validationEncoderRequired) {
    status = 'native-webgpu-surface-validation-needed';
    reason = nativeSurfaceDebugClearOnly
      ? 'native WebGPU debug clear-only still needs same-device readback smoke validation'
      : 'one or more native surface validation stages still need GPU work';
  } else if (nativeSurfaceConsumer && (readbackPending || offscreenPending)) {
    status = 'native-webgpu-surface-validation-pending';
    reason = 'native surface validation readback is already pending';
  } else if (
    nativeSurfaceConsumer
    && offscreenPassedCurrentFormat
  ) {
    status = 'native-webgpu-surface-validation-passed';
    reason = null;
  } else if (nativeSurfaceConsumer && !sameDeviceReadbackValidationEnabled) {
    status = 'native-webgpu-surface-validation-browser-frame-required';
    reason = 'native current-texture readback is disabled; foreground geometry validation was not eligible or did not pass';
  } else if (
    nativeSurfaceConsumer
    && readbackAttemptsExhausted
    && offscreenAttemptsExhausted
  ) {
    status = 'native-webgpu-surface-validation-attempts-exhausted';
    reason = 'native surface validation attempts reached the retry budget';
  } else if (
    nativeSurfaceConsumer
    && nativeSurfaceDebugClearOnly
    && readbackPassedCurrentFormat
  ) {
    status = 'native-webgpu-surface-validation-debug-clear-only';
    reason = 'native WebGPU debug clear-only validated current-texture readback but did not validate surface geometry';
  } else if (
    nativeSurfaceConsumer
    && !nativeSurfaceSubmittedDrawsAvailable
    && readbackPassedCurrentFormat
  ) {
    status = 'native-webgpu-surface-validation-no-surface-draws';
    reason = 'native WebGPU validation has no submitted surface draws for offscreen geometry validation';
  } else if (nativeSurfaceConsumer) {
    status = 'native-webgpu-surface-validation-idle';
    reason = null;
  }
  return {
    schema: 'peercompute.ulg.sph-native-webgpu-surface-validation-cadence.v0',
    status,
    reason,
    nativeSurfaceConsumer,
    validationEncoderRequired,
    submittedDrawCount: normalizedSubmittedDrawCount,
    debugClearOnly: nativeSurfaceDebugClearOnly,
    validationScope,
    maxAttempts: normalizedMaxAttempts,
    sameDeviceReadbackValidationEnabled,
    readbackSmokeValidationNeeded,
    readbackSmokeValidationPending: readbackPending,
    readbackSmokeValidationStatus: normalizedReadbackStatus,
    readbackSmokeValidationFormat: normalizedReadbackFormat,
    readbackSmokeValidationAttemptCount: normalizedReadbackAttemptCount,
    readbackSmokeValidationPassedCurrentFormat: readbackPassedCurrentFormat,
    readbackSmokeValidationAttemptsExhausted: readbackAttemptsExhausted,
    offscreenValidationEligible,
    offscreenValidationSkippedReason,
    offscreenValidationNeeded,
    offscreenValidationPending: offscreenPending,
    offscreenValidationStatus: normalizedOffscreenStatus,
    offscreenValidationTextureFormat: normalizedOffscreenTextureFormat,
    offscreenValidationTargetResourceGeneration: targetResourceGeneration,
    offscreenValidationResourceGeneration: validatedResourceGeneration,
    offscreenValidationAttemptResourceGeneration: attemptResourceGeneration,
    offscreenValidationAttemptCount: normalizedOffscreenAttemptCount,
    offscreenValidationPassedCurrentFormat: offscreenPassedCurrentFormat,
    offscreenValidationAttemptsExhausted: offscreenAttemptsExhausted
  };
}

const SPH_NATIVE_SURFACE_CANDIDATE_ERROR_SCOPE_FILTERS = Object.freeze([
  'validation',
  'internal',
  'out-of-memory'
]);

function nativeSurfaceCandidateValidationErrorRecord(error, {
  source,
  filter = null
} = {}) {
  if (error == null) return null;
  return {
    source,
    filter,
    name: typeof error?.name === 'string' && error.name
      ? error.name
      : null,
    message: typeof error?.message === 'string' && error.message
      ? error.message
      : String(error)
  };
}

const sphNativeSurfacePreparedCandidateSubmissionRecords = new WeakMap();
const sphNativeSurfaceCleanValidationTransactionRecords = new WeakMap();
const sphNativeSurfaceCommandFamilyAttestationRecords = new WeakMap();

export function createSphNativeSurfaceCommandFamilyAttestation({
  device = null,
  commandFamilyKey = '',
  validationTransaction = null
} = {}) {
  const transactionRecord =
    sphNativeSurfaceCleanValidationTransactionRecords.get(
      validationTransaction
    );
  const normalizedKey = typeof commandFamilyKey === 'string'
    ? commandFamilyKey.trim()
    : '';
  if (
    !transactionRecord
    || transactionRecord.device !== device
    || transactionRecord.scopeValidated !== true
    || transactionRecord.attestationIssued === true
    || !normalizedKey
  ) {
    throw new TypeError(
      'native surface command-family attestation requires one exact clean scoped transaction'
    );
  }
  transactionRecord.attestationIssued = true;
  const attestation = Object.freeze({
    schema:
      'peercompute.ulg.sph-native-surface-command-family-attestation.v0',
    status: 'native-surface-command-family-attested'
  });
  sphNativeSurfaceCommandFamilyAttestationRecords.set(attestation, {
    device,
    commandFamilyKey: normalizedKey
  });
  return attestation;
}

export function createSphNativeSurfacePreparedCandidateSubmission({
  device = null,
  validate = null,
  submit = null,
  discard = null
} = {}) {
  if (
    !device?.queue?.submit
    || typeof validate !== 'function'
    || typeof submit !== 'function'
  ) {
    throw new TypeError(
      'prepared native surface candidate requires an exact device, liveness validator, and submitter'
    );
  }
  const receipt = Object.freeze({
    schema:
      'peercompute.ulg.sph-native-surface-prepared-candidate-submission.v0',
    status: 'native-surface-candidate-command-prepared'
  });
  sphNativeSurfacePreparedCandidateSubmissionRecords.set(receipt, {
    device,
    validate,
    submit,
    discard,
    state: 'prepared'
  });
  return receipt;
}

export function submitSphNativeSurfacePreparedCandidateSubmission(
  receipt,
  device
) {
  const record =
    sphNativeSurfacePreparedCandidateSubmissionRecords.get(receipt);
  if (
    !record
    || record.device !== device
    || record.state !== 'prepared'
  ) {
    throw new TypeError(
      'prepared native surface candidate submission is stale, foreign, or already consumed'
    );
  }
  const liveness = record.validate();
  if (liveness !== true && liveness?.valid !== true) {
    record.state = 'rejected';
    throw new TypeError(
      liveness?.reason
      || 'prepared native surface candidate lost exact pre-submit liveness'
    );
  }
  record.state = 'submitting';
  try {
    const submitted = record.submit();
    if (submitted && typeof submitted.then === 'function') {
      Promise.resolve(submitted).catch(() => {});
      throw new TypeError(
        'prepared native surface candidate submitter must settle synchronously'
      );
    }
    record.state = 'submitted';
    return submitted;
  } catch (error) {
    record.state = 'submit-error';
    throw error;
  }
}

export function discardSphNativeSurfacePreparedCandidateSubmission(receipt) {
  const record =
    sphNativeSurfacePreparedCandidateSubmissionRecords.get(receipt);
  if (!record || record.state === 'submitted' || record.state === 'discarded') {
    return false;
  }
  record.state = 'discarded';
  const discardValue = record.discard?.();
  if (discardValue && typeof discardValue.then === 'function') {
    Promise.resolve(discardValue).catch(() => {});
    throw new TypeError(
      'prepared native surface candidate discard must settle synchronously'
    );
  }
  return true;
}

/**
 * Run one provisional native-surface foreground proof under every WebGPU
 * error scope capable of invalidating the command buffer. WebGPU validation
 * failures are asynchronous and queue.submit() does not throw for them, so a
 * successful-looking transaction value is not admissible until every scope
 * has been popped and proven clean.
 */
export async function runSphNativeSurfaceCandidateValidationTransaction({
  device = null,
  transaction = null,
  submitPreparedTransaction = null,
  startCompletion = null,
  completeTransaction = null,
  discardTransaction = null,
  commandFamilyAttestation = null,
  commandFamilyKey = ''
} = {}) {
  if (typeof transaction !== 'function') {
    throw new TypeError('native surface candidate validation transaction is required');
  }
  const errorScopeSupported = Boolean(
    typeof device?.pushErrorScope === 'function'
    && typeof device?.popErrorScope === 'function'
  );
  const pushedFilters = [];
  const errors = [];
  const normalizedCommandFamilyKey = typeof commandFamilyKey === 'string'
    ? commandFamilyKey.trim()
    : '';
  const commandFamilyAttestationRecord = commandFamilyAttestation == null
    ? null
    : sphNativeSurfaceCommandFamilyAttestationRecords.get(
      commandFamilyAttestation
    );
  const commandFamilyAttestationUsed = Boolean(
    commandFamilyAttestationRecord
    && commandFamilyAttestationRecord.device === device
    && normalizedCommandFamilyKey
    && commandFamilyAttestationRecord.commandFamilyKey
      === normalizedCommandFamilyKey
  );
  if (
    commandFamilyAttestation != null
    && !commandFamilyAttestationUsed
  ) {
    errors.push(nativeSurfaceCandidateValidationErrorRecord(
      new TypeError(
        'native surface command-family attestation is stale, foreign, or mismatched'
      ),
      { source: 'command-family-attestation' }
    ));
  }
  // Candidate-local foreground proof makes an irreversible publication
  // decision. A browser/device lacking WebGPU error scopes cannot prove that
  // its private command buffer was valid, so it must fail closed before any
  // candidate submission rather than treating missing diagnostics as clean.
  if (!commandFamilyAttestationUsed && !errorScopeSupported) {
    errors.push(nativeSurfaceCandidateValidationErrorRecord(
      new TypeError(
        'native surface candidate validation requires WebGPU error scope support'
      ),
      { source: 'error-scope-unsupported' }
    ));
  }
  if (!commandFamilyAttestationUsed && errorScopeSupported) {
    for (const filter of SPH_NATIVE_SURFACE_CANDIDATE_ERROR_SCOPE_FILTERS) {
      try {
        device.pushErrorScope(filter);
        pushedFilters.push(filter);
      } catch (error) {
        errors.push(nativeSurfaceCandidateValidationErrorRecord(error, {
          source: 'error-scope-push',
          filter
        }));
        break;
      }
    }
  }

  let submissionValue = null;
  let transactionValue = null;
  if (errors.length === 0) {
    try {
      submissionValue = transaction();
      if (submissionValue && typeof submissionValue.then === 'function') {
        Promise.resolve(submissionValue).catch(() => {});
        throw new TypeError(
          'native surface candidate submission must return synchronously so GPU error scopes close before readback mapping'
        );
      }
    } catch (error) {
      errors.push(nativeSurfaceCandidateValidationErrorRecord(error, {
        source: 'candidate-submission'
      }));
    }
  }

  const scopedErrorsByFilter = new Map();
  const pendingScopePops = [];
  const errorScopesStartedAtMs = nowMs();
  for (let index = pushedFilters.length - 1; index >= 0; index -= 1) {
    const filter = pushedFilters[index];
    try {
      // popErrorScope removes the scope synchronously.  Pop every scope in
      // LIFO order before waiting for any of their asynchronous results so
      // independent scope-result latency does not serialize the candidate
      // proof. A later MAP_READ request may overlap those reports, but no
      // mapped byte can be consumed until *all* scopes prove clean.
      const result = device.popErrorScope();
      pendingScopePops.push(
        Promise.resolve(result).then(
          (error) => ({ filter, error, popFailure: null }),
          (popFailure) => ({ filter, error: null, popFailure })
        )
      );
    } catch (error) {
      scopedErrorsByFilter.set(
        filter,
        nativeSurfaceCandidateValidationErrorRecord(error, {
          source: 'error-scope-pop',
          filter
        })
      );
    }
  }
  // A completion request such as MAP_READ may be started after every LIFO
  // popErrorScope() call has been issued, but before their asynchronous
  // reports resolve.
  // It must return synchronously and must not inspect its result; the
  // completeTransaction gate below remains the only admission path after all
  // scope reports prove clean. This hides request latency without allowing a
  // scope-covered submission to publish mapped-looking stale bytes.
  let completionStartValue = null;
  let completionSubmissionValue = submissionValue;
  let preparedTransactionSubmitted = false;
  if (
    errors.length === 0
    && submissionValue != null
    && scopedErrorsByFilter.size === 0
    && typeof submitPreparedTransaction !== 'function'
    && typeof startCompletion === 'function'
  ) {
    try {
      completionStartValue = startCompletion(submissionValue);
      if (
        completionStartValue
        && typeof completionStartValue.then === 'function'
      ) {
        Promise.resolve(completionStartValue).catch(() => {});
        throw new TypeError(
          'native surface candidate completion start must return synchronously'
        );
      }
    } catch (error) {
      errors.push(nativeSurfaceCandidateValidationErrorRecord(error, {
        source: 'candidate-completion-start'
      }));
    }
  }
  const settledScopePops = await Promise.all(pendingScopePops);
  const errorScopesMs = Math.max(0, nowMs() - errorScopesStartedAtMs);
  for (const { filter, error, popFailure } of settledScopePops) {
    if (popFailure != null) {
      scopedErrorsByFilter.set(
        filter,
        nativeSurfaceCandidateValidationErrorRecord(popFailure, {
          source: 'error-scope-pop',
          filter
        })
      );
    } else if (error != null) {
      scopedErrorsByFilter.set(
        filter,
        nativeSurfaceCandidateValidationErrorRecord(error, {
          source: 'gpu-error-scope',
          filter
        })
      );
    }
  }
  for (const filter of SPH_NATIVE_SURFACE_CANDIDATE_ERROR_SCOPE_FILTERS) {
    const scopedError = scopedErrorsByFilter.get(filter);
    if (scopedError) errors.push(scopedError);
  }

  // The production staged-composite route can scope its complete private
  // command encoding before submitting it. The returned receipt is opaque and
  // single-use; its submitter must re-prove every project-owned resource lease
  // and frozen input immediately before issuing the command buffer. This keeps
  // slow GPU execution outside the error-scope settlement interval without
  // treating a merely encoded command as a submitted foreground proof.
  if (
    errors.length === 0
    && submissionValue != null
    && typeof submitPreparedTransaction === 'function'
  ) {
    try {
      const preparedSubmissionValue =
        submitPreparedTransaction(submissionValue);
      if (
        preparedSubmissionValue
        && typeof preparedSubmissionValue.then === 'function'
      ) {
        Promise.resolve(preparedSubmissionValue).catch(() => {});
        throw new TypeError(
          'native surface prepared candidate submission must settle synchronously'
        );
      }
      completionSubmissionValue = preparedSubmissionValue;
      preparedTransactionSubmitted = true;
    } catch (error) {
      errors.push(nativeSurfaceCandidateValidationErrorRecord(error, {
        source: 'candidate-prepared-submission'
      }));
    }
  }
  if (
    errors.length === 0
    && completionSubmissionValue != null
    && typeof submitPreparedTransaction === 'function'
    && typeof startCompletion === 'function'
  ) {
    try {
      completionStartValue = startCompletion(completionSubmissionValue);
      if (
        completionStartValue
        && typeof completionStartValue.then === 'function'
      ) {
        Promise.resolve(completionStartValue).catch(() => {});
        throw new TypeError(
          'native surface candidate completion start must return synchronously'
        );
      }
    } catch (error) {
      errors.push(nativeSurfaceCandidateValidationErrorRecord(error, {
        source: 'candidate-completion-start'
      }));
    }
  }

  if (errors.length === 0) {
    try {
      transactionValue = typeof completeTransaction === 'function'
        ? await completeTransaction(
          completionSubmissionValue,
          completionStartValue
        )
        : completionSubmissionValue;
    } catch (error) {
      errors.push(nativeSurfaceCandidateValidationErrorRecord(error, {
        source: 'candidate-completion'
      }));
    }
  }

  if (errors.length > 0 && submissionValue != null && typeof discardTransaction === 'function') {
    try {
      const discardValue = discardTransaction(
        completionSubmissionValue ?? submissionValue,
        completionStartValue
      );
      if (discardValue && typeof discardValue.then === 'function') {
        throw new TypeError(
          'native surface candidate discard must settle synchronously'
        );
      }
    } catch (error) {
      errors.push(nativeSurfaceCandidateValidationErrorRecord(error, {
        source: 'candidate-discard'
      }));
    }
  }

  const ok = errors.length === 0;
  const result = {
    schema:
      'peercompute.ulg.sph-native-surface-candidate-validation-transaction.v0',
    status: ok
      ? 'native-surface-candidate-validation-transaction-clean'
      : 'native-surface-candidate-validation-transaction-error',
    ok,
    errorScopeSupported,
    errorScopeMode: commandFamilyAttestationUsed
      ? 'validated-command-family-cache-hit'
      : 'scoped-command-family-validation',
    commandFamilyAttestationUsed,
    commandFamilyKey: normalizedCommandFamilyKey || null,
    pushedFilters: [...pushedFilters],
    errorScopesMs,
    preparedTransactionRequested:
      typeof submitPreparedTransaction === 'function',
    preparedTransactionSubmitted,
    errors,
    reason: errors[0]?.message ?? null,
    transactionValue: ok ? transactionValue : null,
    transactionValueDiscarded: !ok && (
      submissionValue != null || transactionValue != null
    )
  };
  if (
    ok
    && !commandFamilyAttestationUsed
    && pushedFilters.length
      === SPH_NATIVE_SURFACE_CANDIDATE_ERROR_SCOPE_FILTERS.length
    && SPH_NATIVE_SURFACE_CANDIDATE_ERROR_SCOPE_FILTERS.every(
      (filter, index) => pushedFilters[index] === filter
    )
  ) {
    sphNativeSurfaceCleanValidationTransactionRecords.set(result, {
      device,
      scopeValidated: true,
      attestationIssued: false
    });
  }
  return result;
}

export function resolveSphNativeWebGpuSurfaceConsumerDebugMode({
  bridge = null,
  locationRef = globalThis.location
} = {}) {
  const direct = bridge?.nativeSurfaceDebugMode
    ?? globalThis.__ULG_SPH_NATIVE_SURFACE_DEBUG_MODE
    ?? globalThis.__ULG_SPH_NATIVE_SURFACE_CONSUMER_DEBUG_MODE;
  const directMode = normalizeSphNativeWebGpuSurfaceConsumerDebugMode(direct, '');
  if (directMode) return directMode;
  try {
    const search = new URLSearchParams(String(locationRef?.search || '').replace(/^\?/, ''));
    const hash = new URLSearchParams(String(locationRef?.hash || '').replace(/^#/, ''));
    for (const key of [
      'nativeSurfaceDebug',
      'nativeSurfaceDebugMode',
      'nativeWebGpuSurfaceDebug',
      'nativeWebGpuSurfaceDebugMode'
    ]) {
      const mode = normalizeSphNativeWebGpuSurfaceConsumerDebugMode(
        hash.get(key) ?? search.get(key),
        ''
      );
      if (mode) return mode;
    }
  } catch {
    // Query parsing is diagnostic-only; leave production rendering untouched.
  }
  return 'none';
}

export function resolveThreeWebGpuRendererOwnedResidentDevicePolicy({
  renderer = null,
  requested = SPH_THREE_WEBGPU_RENDERER_OWNED_RESIDENT_DEVICE_ENABLED,
  runtimeValidated = SPH_THREE_WEBGPU_RENDERER_OWNED_RESIDENT_DEVICE_RUNTIME_VALIDATED,
  unsafeDiagnosticOverride = false
} = {}) {
  const rendererIsWebGPU = Boolean(renderer?.isWebGPURenderer);
  const rendererPresentationEnabled = renderer?.userData?.sphWebGpuPresentationEnabled !== false;
  const rendererBackendDeviceReady = Boolean(renderer?.backend?.device);
  const rendererBackendBufferBindingAvailable = Boolean(
    renderer?.backend
    && typeof renderer.backend.get === 'function'
  );
  const requestedUse = Boolean(requested);
  const rendererOwnedRuntimeValidated = Boolean(runtimeValidated);
  const unsafeOverride = Boolean(unsafeDiagnosticOverride);
  const unsafeRuntimeBypass = Boolean(
    requestedUse
    && unsafeOverride
    && !rendererOwnedRuntimeValidated
    && rendererIsWebGPU
    && rendererPresentationEnabled
    && rendererBackendDeviceReady
    && rendererBackendBufferBindingAvailable
  );
  let status = 'renderer-owned-resident-device-disabled';
  let reason = 'renderer-owned Three WebGPU presentation device is reserved for presentation/same-device bridge capability; resident compute uses its own GPUDevice';
  if (!rendererIsWebGPU) {
    status = 'renderer-owned-resident-device-blocked-non-webgpu-renderer';
    reason = 'renderer-owned resident GPUDevice requires Three WebGPU renderer';
  } else if (!rendererPresentationEnabled) {
    status = 'renderer-owned-resident-device-blocked-presentation-disabled';
    reason = 'Three WebGPU presentation is disabled';
  } else if (!rendererBackendDeviceReady) {
    status = 'renderer-owned-resident-device-blocked-device-pending';
    reason = 'Three WebGPU renderer backend device is not initialized yet';
  } else if (!rendererBackendBufferBindingAvailable) {
    status = 'renderer-owned-resident-device-blocked-backend-api';
    reason = 'Three WebGPU renderer did not expose backend buffer binding API';
  } else if (requestedUse && !rendererOwnedRuntimeValidated && !unsafeRuntimeBypass) {
    status = 'renderer-owned-resident-device-blocked-runtime-validation';
    reason = 'Three WebGPU renderer-owned resident device sharing still fails renderer error-scope validation; resident compute uses a separate WebGPU device until the shared-device path is validated';
  } else if (requestedUse && unsafeRuntimeBypass) {
    status = 'renderer-owned-resident-device-enabled-unsafe-diagnostic';
    reason = 'using Three WebGPU renderer-owned device only for the explicit unsafe diagnostic route';
  } else if (requestedUse) {
    status = 'renderer-owned-resident-device-enabled';
    reason = 'using Three WebGPU renderer-owned device for same-device resident compute/render buffers';
  }
  return {
    schema: 'peercompute.ulg.sph-three-webgpu-renderer-owned-resident-device-policy.v0',
    status,
    reason,
    requested: requestedUse,
    rendererIsWebGPU,
    rendererPresentationEnabled,
    rendererBackendDeviceReady,
    rendererBackendBufferBindingAvailable,
    runtimeValidated: rendererOwnedRuntimeValidated,
    unsafeDiagnosticOverride: unsafeOverride,
    unsafeRuntimeBypass,
    rendererOwnedDeviceAllowed: status === 'renderer-owned-resident-device-enabled'
      || status === 'renderer-owned-resident-device-enabled-unsafe-diagnostic'
  };
}

export function resolveResidentExtensionSurfaceRendererCapability({
  renderer = null,
  renderBridgeMode = null,
  readbackMode = SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT,
  device = null,
  surfaceBufferPresentationEnabled = SPH_THREE_WEBGPU_SURFACE_BUFFER_PRESENTATION_ENABLED,
  nativeWebGpuSurfaceConsumer = null
} = {}) {
  const mode = String(renderBridgeMode || '').trim().toLowerCase() || null;
  const normalizedReadbackMode = String(readbackMode || SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT).trim().toLowerCase();
  const nativeConsumer = nativeWebGpuSurfaceConsumer || renderer?.userData?.sphNativeWebGpuSurfaceConsumer || null;
  const rendererBackend = renderer?.isNativeWebGPURenderer
    ? 'native-webgpu'
    : renderer?.isWebGPURenderer
    ? 'three-webgpu'
    : renderer?.isWebGLRenderer
    ? 'three-webgl'
    : renderer?.domElement
    ? 'three-unknown'
    : 'none';
  const backendBufferBindingAvailable = Boolean(
    renderer?.backend
    && typeof renderer.backend.get === 'function'
  );
  const rendererBackendDevice = renderer?.isNativeWebGPURenderer
    ? (nativeConsumer?.device || nativeConsumer?.gpuDevice || null)
    : (renderer?.backend?.device || null);
  const rendererBackendDeviceReady = Boolean(rendererBackendDevice);
  const rendererPresentationDisabled = Boolean(
    rendererBackend === 'three-webgpu'
    && renderer?.userData?.sphWebGpuPresentationEnabled === false
  );
  const sameDeviceAsResident = Boolean(
    rendererBackendDevice
    && (!device || rendererBackendDevice === device)
  );
  const externalBufferPresentationEnabled = Boolean(
    surfaceBufferPresentationEnabled
    || renderer?.userData?.sphThreeWebGpuSurfaceBufferPresentationEnabled === true
  );
  const externalBufferPipelineUnsafeDiagnosticOverride = Boolean(
    externalBufferPresentationEnabled
    && renderer?.userData?.sphWebGpuPresentationUnsafeDiagnosticOverride === true
  );
  const externalBufferPipelineRuntimeValidated = Boolean(
    SPH_THREE_WEBGPU_EXTERNAL_BUFFER_PIPELINE_RUNTIME_VALIDATED
    || externalBufferPipelineUnsafeDiagnosticOverride
  );
  const externalBufferPipelineRuntimeValidationSource = externalBufferPipelineRuntimeValidated
    ? (SPH_THREE_WEBGPU_EXTERNAL_BUFFER_PIPELINE_RUNTIME_VALIDATED
      ? 'runtime-validated'
      : 'unsafe-diagnostic-override')
    : 'unvalidated';
  const nativeSurfaceConsumerRequested = Boolean(
    mode === SPH_NATIVE_WEBGPU_SURFACE_CONSUMER_BRIDGE_MODE
    || nativeConsumer?.requested
  );
  const nativeSurfaceConsumerEngineIntegration = String(
    nativeConsumer?.engineIntegration || ''
  ).trim().toLowerCase();
  const nativeSurfaceConsumerOwnsMainCanvas = Boolean(
    nativeSurfaceConsumerEngineIntegration === 'engine-owned-main-canvas'
    || nativeSurfaceConsumerEngineIntegration === 'renderer-owned-webgpu-texture-view'
  );
  const nativeSurfaceConsumerDevice = nativeConsumer?.device || nativeConsumer?.gpuDevice || null;
  const nativeSurfaceConsumerDeviceReady = Boolean(
    nativeSurfaceConsumerDevice
    || (nativeConsumer?.usesResidentDevice === true && device)
  );
  const nativeSurfaceConsumerSameDevice = Boolean(
    nativeSurfaceConsumerDeviceReady
    && (!device || !nativeSurfaceConsumerDevice || nativeSurfaceConsumerDevice === device)
  );
  const nativeSurfaceConsumerRenderTargetReady = Boolean(
    nativeConsumer?.textureViewReady === true
    || nativeConsumer?.renderTargetReady === true
    || typeof nativeConsumer?.getCurrentTextureView === 'function'
    || typeof nativeConsumer?.createRenderPass === 'function'
  );
  const nativeSurfaceConsumerRuntimeValidated = Boolean(nativeConsumer?.runtimeValidated);
  const nativeSurfaceConsumerPixelValidationStatus = nativeConsumer?.pixelValidationStatus || null;
  const nativeSurfaceConsumerPixelValidationReason = nativeConsumer?.pixelValidationReason || null;
  const nativeSurfaceConsumerAvailable = Boolean(
    nativeSurfaceConsumerRequested
    && nativeSurfaceConsumerOwnsMainCanvas
    && nativeSurfaceConsumerDeviceReady
    && nativeSurfaceConsumerSameDevice
    && nativeSurfaceConsumerRenderTargetReady
  );
  const nativeSurfaceConsumerSupported = Boolean(
    normalizedReadbackMode === RESIDENT_NO_FULL_READBACK_MODE
    && nativeSurfaceConsumerAvailable
    && nativeSurfaceConsumerRuntimeValidated
  );
  const sameDeviceGpuBufferGeometryAvailable = Boolean(
    rendererBackend === 'three-webgpu'
    && backendBufferBindingAvailable
    && rendererBackendDeviceReady
    && !rendererPresentationDisabled
    && sameDeviceAsResident
  );
  const sameDeviceGpuBufferGeometrySupported = Boolean(
    sameDeviceGpuBufferGeometryAvailable
    && externalBufferPresentationEnabled
    && externalBufferPipelineRuntimeValidated
  );
  const requestedThreeCompactReadbackBridge = mode === SPH_THREE_COMPACT_VERTEX_BRIDGE_MODE;
  const noFullReadback = normalizedReadbackMode === RESIDENT_NO_FULL_READBACK_MODE;
  const visibleNoReadbackSupported = Boolean(
    noFullReadback
    && (sameDeviceGpuBufferGeometrySupported || nativeSurfaceConsumerSupported)
  );
  let status = 'extension-surface-renderer-capability-blocked';
  let reason = 'extension surface renderer capability unavailable';
  if (nativeSurfaceConsumerSupported) {
    status = 'native-webgpu-surface-consumer-supported';
    reason = null;
  } else if (visibleNoReadbackSupported) {
    status = 'same-device-gpu-buffer-geometry-supported';
    reason = null;
  } else if (nativeSurfaceConsumerRequested && !nativeSurfaceConsumerOwnsMainCanvas) {
    status = 'native-webgpu-surface-consumer-blocked-engine-integration';
    reason = 'native WebGPU surface consumer must own the engine main canvas or a renderer-owned WebGPU texture view; separate overlay canvases are not accepted';
  } else if (nativeSurfaceConsumerRequested && !nativeSurfaceConsumerDeviceReady) {
    status = 'native-webgpu-surface-consumer-blocked-device';
    reason = 'native WebGPU surface consumer needs a same-device GPUDevice or an explicit resident-device lease';
  } else if (nativeSurfaceConsumerRequested && !nativeSurfaceConsumerSameDevice) {
    status = 'native-webgpu-surface-consumer-blocked-cross-device';
    reason = 'native WebGPU surface consumer device does not match the resident surface-buffer device';
  } else if (nativeSurfaceConsumerRequested && !nativeSurfaceConsumerRenderTargetReady) {
    status = 'native-webgpu-surface-consumer-blocked-render-target';
    reason = 'native WebGPU surface consumer needs an engine-owned current GPUTextureView/render-pass target';
  } else if (nativeSurfaceConsumerRequested && !nativeSurfaceConsumerRuntimeValidated) {
    status = 'native-webgpu-surface-consumer-blocked-runtime-validation';
    reason = 'native WebGPU surface consumer requires a validated same-device canvas context, render-pass pipeline, and main-thread import before it can accept retained surface buffers';
  } else if (sameDeviceGpuBufferGeometryAvailable && !externalBufferPipelineRuntimeValidated) {
    status = 'same-device-gpu-buffer-geometry-blocked-three-webgpu-external-buffer-pipeline-unvalidated';
    reason = 'Three WebGPU external GPUBuffer surface presentation reaches retained buffers but currently fails renderer pipeline validation; retained buffers are exposed for native/direct renderer work but hidden from Three mesh presentation until that path is validated';
  } else if (sameDeviceGpuBufferGeometryAvailable && !externalBufferPresentationEnabled) {
    status = 'same-device-gpu-buffer-geometry-blocked-three-webgpu-external-buffer-presentation-disabled';
    reason = 'Three WebGPU external GPUBuffer surface presentation is disabled; retaining resident GPU buffers for direct renderer handoff';
  } else if (requestedThreeCompactReadbackBridge && !noFullReadback) {
    status = 'three-compact-readback-bridge-supported';
    reason = 'requested bridge uses full readback into Three geometry';
  } else if (rendererBackend === 'native-webgpu') {
    status = 'native-webgpu-surface-consumer-blocked-runtime-validation';
    reason = 'native WebGPU renderer is active, but the main-canvas surface consumer has not passed context/pipeline validation';
  } else if (rendererBackend === 'three-webgl') {
    status = 'same-device-gpu-buffer-geometry-blocked-webgl-renderer';
    reason = 'same-device GPUBuffer geometry requires Three WebGPU renderer; current scene renderer is WebGLRenderer';
  } else if (rendererBackend === 'three-webgpu' && !backendBufferBindingAvailable) {
    status = 'same-device-gpu-buffer-geometry-blocked-three-webgpu-backend-api';
    reason = 'Three WebGPU renderer did not expose backend buffer binding API';
  } else if (rendererPresentationDisabled) {
    status = 'same-device-gpu-buffer-geometry-blocked-three-webgpu-presentation-disabled';
    reason = 'Three WebGPU renderer device is initialized, but scene presentation is disabled pending the Three WebGPU presentation lifetime fix';
  } else if (rendererBackend === 'three-webgpu' && !rendererBackendDeviceReady) {
    status = 'same-device-gpu-buffer-geometry-blocked-three-webgpu-device-pending';
    reason = 'Three WebGPU renderer backend device is not initialized yet';
  } else if (rendererBackend === 'three-webgpu' && device && !sameDeviceAsResident) {
    status = 'same-device-gpu-buffer-geometry-blocked-cross-device';
    reason = 'resident surface GPUBuffer belongs to a different GPUDevice than the Three WebGPU renderer';
  } else if (rendererBackend === 'none') {
    status = 'same-device-gpu-buffer-geometry-blocked-missing-renderer';
    reason = 'no engine-owned Three renderer is available';
  } else {
    status = 'same-device-gpu-buffer-geometry-blocked-unknown-renderer';
    reason = 'engine-owned renderer does not advertise a supported same-device GPUBuffer geometry path';
  }
  return {
    schema: 'peercompute.ulg.sph-resident-extension-surface-renderer-capability.v0',
    status,
    reason,
    rendererBackend,
    rendererIsWebGL: rendererBackend === 'three-webgl',
    rendererIsWebGPU: rendererBackend === 'three-webgpu' || rendererBackend === 'native-webgpu',
    rendererIsNativeWebGPU: rendererBackend === 'native-webgpu',
    backendBufferBindingAvailable,
    rendererBackendDeviceReady,
    rendererPresentationDisabled,
    residentDeviceProvided: Boolean(device),
    sameDeviceAsResident,
    sameDeviceGpuBufferGeometryAvailable,
    sameDeviceGpuBufferGeometrySupported,
    externalBufferPresentationEnabled,
    externalBufferPipelineUnsafeDiagnosticOverride,
    externalBufferPipelineRuntimeValidated,
    externalBufferPipelineRuntimeValidationSource,
    nativeSurfaceConsumerRequested,
    nativeSurfaceConsumerEngineIntegration: nativeSurfaceConsumerEngineIntegration || null,
    nativeSurfaceConsumerOwnsMainCanvas,
    nativeSurfaceConsumerDeviceReady,
    nativeSurfaceConsumerSameDevice,
    nativeSurfaceConsumerRenderTargetReady,
    nativeSurfaceConsumerRuntimeValidated,
    nativeSurfaceConsumerPixelValidationStatus,
    nativeSurfaceConsumerPixelValidationReason,
    nativeSurfaceConsumerAvailable,
    nativeSurfaceConsumerSupported,
    visibleNoReadbackSupported,
    requestedRenderBridgeMode: mode,
    requestedThreeCompactReadbackBridge,
    readbackMode: normalizedReadbackMode,
    noFullReadback
  };
}

export function resolveExtensionSurfaceRenderBridgePlan({
  renderBridgeMode = null,
  readbackMode = SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT,
  rendererCapability = null,
  compactVertexPresentationEnabled = SPH_THREE_COMPACT_VERTEX_PRESENTATION_ENABLED
} = {}) {
  const requestedRenderBridgeMode = String(renderBridgeMode || '').trim().toLowerCase() || null;
  const requestedReadbackMode = normalizeResidentReadbackMode(readbackMode);
  const requestedThreeCompactBridge = requestedRenderBridgeMode === SPH_THREE_COMPACT_VERTEX_BRIDGE_MODE;
  const requestedThreeWebGpuSurfaceBufferBridge =
    requestedRenderBridgeMode === SPH_THREE_WEBGPU_SURFACE_BUFFER_BRIDGE_MODE;
  const requestedNativeWebGpuSurfaceConsumerBridge =
    requestedRenderBridgeMode === SPH_NATIVE_WEBGPU_SURFACE_CONSUMER_BRIDGE_MODE;
  const canUseNativeWebGpuSurfaceConsumerBridge = Boolean(
    !requestedThreeCompactBridge
    && rendererCapability?.nativeSurfaceConsumerSupported
  );
  const canUseThreeWebGpuSurfaceBufferBridge = Boolean(
    !requestedThreeCompactBridge
    && !canUseNativeWebGpuSurfaceConsumerBridge
    && rendererCapability?.visibleNoReadbackSupported
  );
  const compactBridgeBlocked = Boolean(requestedThreeCompactBridge && !compactVertexPresentationEnabled);
  const compactBridgeBlockedReason = compactBridgeBlocked
    ? SPH_THREE_COMPACT_VERTEX_PRESENTATION_BLOCK_REASON
    : null;
  const canUseDirectGpuSurfaceConsumer = Boolean(
    canUseNativeWebGpuSurfaceConsumerBridge
    || canUseThreeWebGpuSurfaceBufferBridge
  );
  const retainResidentSurfaceBufferHandoff = Boolean(
    (!requestedThreeCompactBridge || compactBridgeBlocked)
    && requestedReadbackMode === RESIDENT_NO_FULL_READBACK_MODE
    && !canUseDirectGpuSurfaceConsumer
  );
  const fallbackThreeCompactBridge = Boolean(
    !requestedThreeCompactBridge
    && !canUseDirectGpuSurfaceConsumer
    && !retainResidentSurfaceBufferHandoff
  );
  const useThreeCompactBridge = Boolean((requestedThreeCompactBridge && !compactBridgeBlocked) || fallbackThreeCompactBridge);
  const useThreeWebGpuSurfaceBufferBridge = !useThreeCompactBridge && canUseThreeWebGpuSurfaceBufferBridge;
  const useNativeWebGpuSurfaceConsumerBridge = !useThreeCompactBridge && canUseNativeWebGpuSurfaceConsumerBridge;
  const translationReadbackMode = useThreeCompactBridge
    ? RESIDENT_FULL_READBACK_MODE
    : requestedReadbackMode;
  const effectiveRenderBridgeMode = useThreeCompactBridge
    ? SPH_THREE_COMPACT_VERTEX_BRIDGE_MODE
    : (useNativeWebGpuSurfaceConsumerBridge
      ? SPH_NATIVE_WEBGPU_SURFACE_CONSUMER_BRIDGE_MODE
      : (useThreeWebGpuSurfaceBufferBridge
        ? SPH_THREE_WEBGPU_SURFACE_BUFFER_BRIDGE_MODE
        : (retainResidentSurfaceBufferHandoff ? SPH_RESIDENT_SURFACE_BUFFER_HANDOFF_MODE : null)));
  const fallbackReason = fallbackThreeCompactBridge
    ? (rendererCapability?.reason || 'same-device Three WebGPU surface buffers unavailable; using engine-owned Three compact geometry readback')
    : null;
  const handoffReason = retainResidentSurfaceBufferHandoff
    ? (compactBridgeBlockedReason || rendererCapability?.reason || 'same-device Three WebGPU surface buffers unavailable; retaining resident GPU buffers for direct renderer handoff')
    : null;
  return {
    schema: 'peercompute.ulg.sph-extension-surface-render-bridge-plan.v0',
    status: useNativeWebGpuSurfaceConsumerBridge
      ? 'extension-surface-render-plan-native-webgpu-surface-consumer'
      : (useThreeWebGpuSurfaceBufferBridge
        ? 'extension-surface-render-plan-three-webgpu-surface-buffers'
      : (useThreeCompactBridge
        ? (fallbackThreeCompactBridge
          ? 'extension-surface-render-plan-three-compact-fallback'
          : 'extension-surface-render-plan-three-compact-requested')
        : (retainResidentSurfaceBufferHandoff
          ? 'extension-surface-render-plan-resident-surface-buffer-handoff'
          : 'extension-surface-render-plan-unavailable'))),
    requestedRenderBridgeMode,
    effectiveRenderBridgeMode,
    requestedReadbackMode,
    translationReadbackMode,
    requestedThreeCompactBridge,
    requestedThreeWebGpuSurfaceBufferBridge,
    requestedNativeWebGpuSurfaceConsumerBridge,
    useThreeCompactBridge,
    useThreeWebGpuSurfaceBufferBridge,
    useNativeWebGpuSurfaceConsumerBridge,
    retainResidentSurfaceBufferHandoff,
    fallbackThreeCompactBridge,
    compactBridgeBlocked,
    compactBridgeBlockedReason,
    fallbackReason,
    handoffReason,
    rendererCapabilityStatus: rendererCapability?.status ?? null,
    rendererCapabilityReason: rendererCapability?.reason ?? null,
    nativeSurfaceConsumerSupported: Boolean(rendererCapability?.nativeSurfaceConsumerSupported),
    visibleNoReadbackSupported: Boolean(rendererCapability?.visibleNoReadbackSupported)
  };
}

export function resolveResidentSurfaceBufferHandoff({
  surfaceDraw = null,
  readbackMode = null
} = {}) {
  const normalizedReadbackMode = normalizeResidentReadbackMode(
    readbackMode ?? surfaceDraw?.readbackMode ?? SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT
  );
  const sourceVertexRowCount = Math.max(0, Math.floor(Number(surfaceDraw?.sourceVertexRowCount) || 0));
  const sourceVertexCounterMode = surfaceDraw?.sourceVertexCounterMode ?? null;
  const sourceVertexCounterBufferBound = Boolean(surfaceDraw?.sourceVertexCounterBufferBound);
  const sourceVertexCounterBufferByteLength = Math.max(
    0,
    Math.round(Number(surfaceDraw?.sourceVertexCounterBufferByteLength) || 0)
  );
  const drawRowsBufferByteLength = Math.max(0, Math.round(Number(surfaceDraw?.drawRowsBufferByteLength) || 0));
  const drawIndirectRowsBufferByteLength = Math.max(
    0,
    Math.round(Number(surfaceDraw?.drawIndirectRowsBufferByteLength) || 0)
  );
  const drawAggregateIndirectRowsBufferByteLength = Math.max(
    0,
    Math.round(Number(surfaceDraw?.drawAggregateIndirectRowsBufferByteLength) || 0)
  );
  const compactedVertexRowsBufferByteLength = Math.max(
    0,
    Math.round(Number(surfaceDraw?.compactedVertexRowsBufferByteLength) || 0)
  );
  const compactPositionRowsBufferRetained = Boolean(surfaceDraw?.compactPositionRowsBufferRetained);
  const compactPositionRowsBufferByteLength = Math.max(
    0,
    Math.round(Number(surfaceDraw?.compactPositionRowsBufferByteLength) || 0)
  );
  const compactPositionRowsStrideFloats = Math.max(
    0,
    Math.round(Number(surfaceDraw?.compactPositionRowsStrideFloats) || 0)
  );
  const compactPositionRowsFromBytes = compactPositionRowsStrideFloats > 0
    ? Math.floor(compactPositionRowsBufferByteLength / (compactPositionRowsStrideFloats * Float32Array.BYTES_PER_ELEMENT))
    : 0;
  const compactedRowsFromBytes = Math.floor(
    compactedVertexRowsBufferByteLength / (SPH_GPU_RENDER_SURFACE_VERTEX_FLOATS * Float32Array.BYTES_PER_ELEMENT)
  );
  const renderFieldRowsBufferRetained = Boolean(surfaceDraw?.renderFieldRowsBufferRetained);
  const renderFieldRowsBufferByteLength = Math.max(
    0,
    Math.round(Number(surfaceDraw?.renderFieldRowsBufferByteLength) || 0)
  );
  const renderFieldSurfaceBufferRetained = Boolean(surfaceDraw?.renderFieldSurfaceBufferRetained);
  const renderFieldSurfaceBufferByteLength = Math.max(
    0,
    Math.round(Number(surfaceDraw?.renderFieldSurfaceBufferByteLength) || 0)
  );
  const sourceRenderFieldSchema = surfaceDraw?.sourceRenderFieldSchema
    ?? surfaceDraw?.renderFieldExecution?.schema
    ?? null;
  const renderFieldSchemaCompatible = sourceRenderFieldSchema === ULG_SPH_GPU_RENDER_FIELD_SCHEMA;
  const upperBoundVertexCount = Math.max(
    0,
    Math.floor(Number(surfaceDraw?.surfaceDrawGpuOnlyUpperBoundVertexCount) || 0),
    sourceVertexRowCount,
    compactedRowsFromBytes,
    compactPositionRowsFromBytes
  );
  const alignedUpperBoundVertexCount = upperBoundVertexCount - (upperBoundVertexCount % 3);
  const upperBoundTriangleCount = Math.max(
    0,
    Math.floor(Number(surfaceDraw?.surfaceDrawGpuOnlyUpperBoundTriangleCount) || 0),
    Math.floor(alignedUpperBoundVertexCount / 3)
  );
  const drawRowsBufferRetained = Boolean(surfaceDraw?.drawRowsBufferRetained);
  const drawIndirectRowsBufferRetained = Boolean(surfaceDraw?.drawIndirectRowsBufferRetained);
  const drawAggregateIndirectRowsBufferRetained = Boolean(surfaceDraw?.drawAggregateIndirectRowsBufferRetained);
  const compactedVertexRowsBufferRetained = Boolean(surfaceDraw?.compactedVertexRowsBufferRetained);
  const noFullReadback = normalizedReadbackMode === RESIDENT_NO_FULL_READBACK_MODE
    && !surfaceDraw?.surfaceDrawReadback
    && !surfaceDraw?.fullSurfaceDrawReadback;
  const noSummaryReadback = !surfaceDraw?.surfaceDrawSummaryReadback;
  const hasRetainedBuffers = drawRowsBufferRetained
    && drawRowsBufferByteLength > 0
    && drawIndirectRowsBufferRetained
    && drawIndirectRowsBufferByteLength > 0
    && (
      (compactedVertexRowsBufferRetained && compactedVertexRowsBufferByteLength > 0)
      || (compactPositionRowsBufferRetained && compactPositionRowsBufferByteLength > 0)
    );
  const hasRetainedRenderFieldBuffers = renderFieldRowsBufferRetained
    && renderFieldRowsBufferByteLength > 0
    && renderFieldSurfaceBufferRetained
    && renderFieldSurfaceBufferByteLength > 0;
  const hasDrawableRange = alignedUpperBoundVertexCount >= 3 && upperBoundTriangleCount > 0;
  let status = 'resident-surface-buffer-direct-consumer-blocked-unavailable';
  let reason = 'resident surface draw buffers are unavailable';
  let handoffKind = null;
  if (!surfaceDraw) {
    status = 'resident-surface-buffer-direct-consumer-blocked-missing-surface-draw';
    reason = 'surface draw metadata is missing';
  } else if (!noFullReadback) {
    status = 'resident-surface-buffer-direct-consumer-blocked-readback-mode';
    reason = 'direct GPU consumer handoff requires no-full-readback resident buffers';
  } else if (!noSummaryReadback) {
    status = 'resident-surface-buffer-direct-consumer-blocked-summary-readback';
    reason = 'surface draw summary readback was used; this is diagnostic/parity mode, not the direct hot path';
  } else if (!hasRetainedBuffers) {
    if (hasRetainedRenderFieldBuffers) {
      if (!renderFieldSchemaCompatible) {
        status = 'resident-render-field-buffer-direct-consumer-blocked-schema';
        reason = `retained render-field handoff requires ${ULG_SPH_GPU_RENDER_FIELD_SCHEMA}; received ${sourceRenderFieldSchema ?? 'missing schema'}`;
      } else {
        status = 'resident-render-field-buffer-direct-consumer-ready';
        reason = null;
        handoffKind = 'render-field-buffers';
      }
    } else {
      status = 'resident-surface-buffer-direct-consumer-blocked-missing-retained-buffers';
      reason = 'retained draw/indirect/compact-vertex buffers or retained render-field/surface buffers are required';
    }
  } else if (!hasDrawableRange) {
    status = 'resident-surface-buffer-direct-consumer-blocked-empty-draw-range';
    reason = 'retained surface buffers do not expose a non-empty conservative draw range';
  } else {
    status = 'resident-surface-buffer-direct-consumer-ready';
    reason = null;
    handoffKind = 'surface-draw-buffers';
  }
  const ready = status === 'resident-surface-buffer-direct-consumer-ready'
    || status === 'resident-render-field-buffer-direct-consumer-ready';
  const surfaceExtractionInputKind = handoffKind === 'render-field-buffers'
    ? 'render-field-density-storage-buffer'
    : (handoffKind === 'surface-draw-buffers'
      ? (compactPositionRowsBufferRetained
        ? 'surface-draw-compact-position-buffer'
        : 'surface-draw-compact-vertex-buffer')
      : null);
  const surfaceExtractionConsumerKind = handoffKind === 'render-field-buffers'
    ? 'native-webgpu-marching-cubes-buffer-volume'
    : (handoffKind === 'surface-draw-buffers' ? 'direct-gpu-draw-consumer' : null);
  const surfaceExtractionBridgeStatus = handoffKind === 'render-field-buffers'
    ? 'requires-buffer-native-marching-cubes-adapter'
    : (handoffKind === 'surface-draw-buffers' ? 'surface-extraction-not-required' : 'direct-consumer-blocked');
  const surfaceExtractionBridgeReason = handoffKind === 'render-field-buffers'
    ? 'retained ULG render-field buffers are storage-buffer scalar fields; native webgpu-marching-cubes consumption requires buffer-backed scalar-volume support or a GPU texture bridge'
    : null;
  return {
    schema: 'peercompute.ulg.sph-resident-surface-buffer-handoff.v0',
    status,
    reason,
    ready,
    handoffKind,
    directConsumerInputSchema: handoffKind === 'render-field-buffers'
      ? sourceRenderFieldSchema
      : (surfaceDraw?.surfaceDrawSchema ?? surfaceDraw?.schema ?? null),
    sourceRenderFieldSchema,
    renderFieldSchemaCompatible,
    requiresSurfaceExtraction: handoffKind === 'render-field-buffers',
    surfaceExtractionInputKind,
    surfaceExtractionInputLayout: handoffKind === 'render-field-buffers'
      ? 'peercompute.ulg.sph-gpu-render-field-cell-row.density-x-f32.v0'
      : (handoffKind === 'surface-draw-buffers'
        ? (compactPositionRowsBufferRetained
          ? 'peercompute.webgpu-marching-cubes.compact-position-rows.v0'
          : 'peercompute.ulg.sph-gpu-render-surface-vertex-row.v0')
        : null),
    surfaceExtractionConsumerKind,
    surfaceExtractionRequiredAdapter: handoffKind === 'render-field-buffers'
      ? 'webgpu-marching-cubes.buffer-volume.v0'
      : null,
    surfaceExtractionBridgeStatus,
    surfaceExtractionBridgeReason,
    readbackMode: normalizedReadbackMode,
    noFullReadback,
    noSummaryReadback,
    drawRowsBufferRetained,
    drawRowsBufferByteLength,
    drawIndirectRowsBufferRetained,
    drawIndirectRowsBufferByteLength,
    drawAggregateIndirectRowsBufferRetained,
    drawAggregateIndirectRowsBufferByteLength,
    compactedVertexRowsBufferRetained,
    compactedVertexRowsBufferByteLength,
    compactPositionRowsBufferRetained,
    compactPositionRowsBufferByteLength,
    compactPositionRowsStrideFloats,
    renderFieldRowsBufferRetained,
    renderFieldRowsBufferByteLength,
    renderFieldSurfaceBufferRetained,
    renderFieldSurfaceBufferByteLength,
    sourceVertexRowCount,
    sourceVertexCounterMode,
    sourceVertexCounterBufferBound,
    sourceVertexCounterBufferByteLength,
    upperBoundVertexCount: alignedUpperBoundVertexCount,
    upperBoundTriangleCount,
    conservativeDrawRange: Boolean(
      surfaceDraw?.surfaceDrawGpuOnlyDrawRangeConservative
      || surfaceDraw?.surfaceDrawGpuOnlyHandoff
      || surfaceDraw?.surfaceDrawGpuOnlyHandoffStatus === 'surface-draw-gpu-resident-draw-range-available'
      || (
        (surfaceDraw?.activeSurfaceCount ?? null) == null
        && (surfaceDraw?.vertexCount ?? null) == null
        && hasDrawableRange
      )
    )
  };
}

export function isNativeWebGpuTextureReadbackUnavailableReason(value) {
  return /external Instance reference no longer exists|texture readback unavailable/i.test(
    String(value || '')
  );
}

function isNativeWebGpuBrowserFrameValidationRequiredReason(value) {
  return /runtime pixel readback is disabled|browser harness composited-frame analysis owns visible-output validation/i.test(
    String(value || '')
  );
}

function nativeSurfaceConsumerValidationBlockerFamily({
  nativeWebGpuBridgeBound = false,
  consumerValidated = false,
  pixelValidationStatus = null,
  pixelValidationReason = null,
  readbackSmokeValidationStatus = null,
  readbackSmokeValidationReason = null,
  offscreenValidationStatus = null,
  offscreenValidationReason = null,
  deviceMapSmokeStatus = null,
  deviceTextureReadbackSmokeStatus = null,
  deviceTextureReadbackSmokeReason = null,
  nativeValidationPendingWithRenderedFrame = false,
  textureReadbackUnavailable = false
} = {}) {
  if (!nativeWebGpuBridgeBound || consumerValidated) return null;
  if (deviceMapSmokeStatus && deviceMapSmokeStatus !== 'passed') {
    return 'resident-device-map-smoke';
  }
  if (
    deviceTextureReadbackSmokeStatus
    && deviceTextureReadbackSmokeStatus !== 'passed'
    && isNativeWebGpuTextureReadbackUnavailableReason(deviceTextureReadbackSmokeReason)
  ) {
    return 'resident-device-texture-readback-unavailable';
  }
  const surfaceReadbackUnavailable = Boolean(
    textureReadbackUnavailable
    && isNativeWebGpuTextureReadbackUnavailableReason(
      `${readbackSmokeValidationReason || ''} ${offscreenValidationReason || ''}`
    )
  );
  if (surfaceReadbackUnavailable) {
    return 'native-surface-validation-readback-lifetime';
  }
  if (nativeValidationPendingWithRenderedFrame) {
    return 'native-surface-validation-pending';
  }
  if (
    pixelValidationStatus === 'unsupported'
    || pixelValidationStatus === 'capture-unsupported'
  ) {
    return 'browser-frame-validation-capture-unsupported';
  }
  if (
    pixelValidationStatus
    && pixelValidationStatus !== 'not-run'
    && pixelValidationStatus !== 'passed'
  ) {
    return 'browser-pixel-validation-failed';
  }
  if (isNativeWebGpuTextureReadbackUnavailableReason(pixelValidationReason)) {
    return 'browser-pixel-validation-readback-lifetime';
  }
  if (
    pixelValidationStatus === 'not-run'
    && isNativeWebGpuBrowserFrameValidationRequiredReason(pixelValidationReason)
  ) {
    return 'browser-frame-validation-required';
  }
  if (
    readbackSmokeValidationStatus === 'error'
    || offscreenValidationStatus === 'error'
  ) {
    return 'native-surface-validation-error';
  }
  return 'browser-pixel-validation-not-run';
}

export function resolveResidentSurfaceVisibleGpuConsumer({
  handoff = null,
  rendererCapability = null,
  renderBridgeStatus = null,
  renderBridgeMode = null,
  pixelValidationStatus = null
} = {}) {
  const exactNonNegativeInteger = (value) => (
    typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= 0
      ? value
      : null
  );
  const inputReady = Boolean(handoff?.ready);
  const inputKind = handoff?.handoffKind ?? null;
  const rendererCapabilityStatus = rendererCapability?.status ?? null;
  const rendererCapabilityReason = rendererCapability?.reason ?? null;
  const visibleNoReadbackSupported = Boolean(rendererCapability?.visibleNoReadbackSupported);
  const threeWebGpuBridgeBound = Boolean(
    renderBridgeMode === SPH_THREE_WEBGPU_SURFACE_BUFFER_BRIDGE_MODE
    && renderBridgeStatus === SPH_THREE_WEBGPU_SURFACE_BUFFER_BRIDGE_STATUS
  );
  const nativeWebGpuBridgeBound = Boolean(
    renderBridgeMode === SPH_NATIVE_WEBGPU_SURFACE_CONSUMER_BRIDGE_MODE
    && renderBridgeStatus === SPH_NATIVE_WEBGPU_SURFACE_CONSUMER_BRIDGE_STATUS
  );
  const nativeWebGpuMainThreadImportSelected = Boolean(
    renderBridgeMode === SPH_NATIVE_WEBGPU_SURFACE_CONSUMER_BRIDGE_MODE
  );
  const renderBridgeBound = Boolean(threeWebGpuBridgeBound || nativeWebGpuBridgeBound);
  const normalizedPixelValidationStatus = pixelValidationStatus || 'not-run';
  const pixelValidationReason =
    rendererCapability?.nativeSurfaceConsumerPixelValidationReason ?? null;
  const readbackSmokeValidationStatus =
    rendererCapability?.nativeSurfaceConsumerReadbackSmokeValidationStatus ?? null;
  const readbackSmokeValidationReason =
    rendererCapability?.nativeSurfaceConsumerReadbackSmokeValidationReason ?? null;
  const offscreenValidationStatus =
    rendererCapability?.nativeSurfaceConsumerOffscreenValidationStatus ?? null;
  const offscreenValidationReason =
    rendererCapability?.nativeSurfaceConsumerOffscreenValidationReason ?? null;
  const offscreenValidationNonzeroPixelCount = exactNonNegativeInteger(
    rendererCapability?.nativeSurfaceConsumerOffscreenValidationNonzeroPixelCount
  ) ?? 0;
  const activeSurfaceResourceGeneration = exactNonNegativeInteger(
    rendererCapability?.nativeSurfaceConsumerActiveResourceGeneration
  );
  const offscreenValidationResourceGeneration = exactNonNegativeInteger(
    rendererCapability?.nativeSurfaceConsumerOffscreenValidationResourceGeneration
  );
  const pixelValidationSource =
    rendererCapability?.nativeSurfaceConsumerPixelValidationSource ?? null;
  const pixelValidationNonzeroPixelCount = exactNonNegativeInteger(
    rendererCapability?.nativeSurfaceConsumerPixelValidationNonzeroPixelCount
  ) ?? 0;
  const pixelValidationResourceGeneration = exactNonNegativeInteger(
    rendererCapability?.nativeSurfaceConsumerPixelValidationResourceGeneration
  );
  const deviceMapSmokeStatus =
    rendererCapability?.nativeSurfaceConsumerDeviceMapSmokeStatus ?? null;
  const deviceTextureReadbackSmokeStatus =
    rendererCapability?.nativeSurfaceConsumerDeviceTextureReadbackSmokeStatus ?? null;
  const deviceTextureReadbackSmokeReason =
    rendererCapability?.nativeSurfaceConsumerDeviceTextureReadbackSmokeReason ?? null;
  const nativeRenderedFrameCount = exactNonNegativeInteger(
    rendererCapability?.nativeSurfaceConsumerRenderedFrameCount
  ) ?? 0;
  const textureReadbackUnavailable = isNativeWebGpuTextureReadbackUnavailableReason(
    `${pixelValidationReason || ''} ${readbackSmokeValidationReason || ''} ${offscreenValidationReason || ''} ${deviceTextureReadbackSmokeReason || ''}`
  );
  const nativeValidationPendingWithRenderedFrame = Boolean(
    nativeWebGpuBridgeBound
    && normalizedPixelValidationStatus === 'not-run'
    && deviceMapSmokeStatus === 'passed'
    && nativeRenderedFrameCount > 0
    && (
      readbackSmokeValidationStatus === 'pending'
      || offscreenValidationStatus === 'pending'
    )
  );
  const offscreenForegroundValidated = Boolean(
    nativeWebGpuBridgeBound
    && offscreenValidationStatus === 'passed'
    && offscreenValidationNonzeroPixelCount > 0
    && activeSurfaceResourceGeneration != null
    && offscreenValidationResourceGeneration === activeSurfaceResourceGeneration
  );
  const candidateForegroundProofKind =
    rendererCapability?.nativeSurfaceConsumerCandidateForegroundProofKind
    ?? null;
  const candidateForegroundValidationStatus =
    rendererCapability?.nativeSurfaceConsumerCandidateForegroundValidationStatus
    ?? null;
  const candidateForegroundGpuFenceSatisfied =
    rendererCapability
      ?.nativeSurfaceConsumerCandidateForegroundGpuFenceSatisfied === true;
  const candidateForegroundSameQueueSubmissionBoundary =
    rendererCapability
      ?.nativeSurfaceConsumerCandidateForegroundSameQueueSubmissionBoundary
        === true;
  const candidateForegroundSubmittedDrawCount = exactNonNegativeInteger(
    rendererCapability
      ?.nativeSurfaceConsumerCandidateForegroundSubmittedDrawCount
  ) ?? 0;
  const candidateForegroundResourceGeneration = exactNonNegativeInteger(
    rendererCapability
      ?.nativeSurfaceConsumerCandidateForegroundResourceGeneration
  );
  const sameQueueStructuralSubmissionAdmitted = Boolean(
    nativeWebGpuBridgeBound
    && candidateForegroundValidationStatus === 'passed'
    && candidateForegroundProofKind
      === 'same-queue-private-staged-composite-submission'
    && candidateForegroundSameQueueSubmissionBoundary
    && candidateForegroundSubmittedDrawCount > 0
    && activeSurfaceResourceGeneration != null
    && candidateForegroundResourceGeneration === activeSurfaceResourceGeneration
  );
  const pixelValidated = normalizedPixelValidationStatus === 'passed';
  const browserFrameForegroundValidated = Boolean(
    nativeWebGpuBridgeBound
    && pixelValidated
    && /browser-frame|playwright.*compositor|composited-frame/i.test(
      String(pixelValidationSource || '')
    )
    && pixelValidationNonzeroPixelCount > 0
    && activeSurfaceResourceGeneration != null
    && pixelValidationResourceGeneration === activeSurfaceResourceGeneration
  );
  const foregroundProofValidated = Boolean(
    offscreenForegroundValidated
    || browserFrameForegroundValidated
  );
  const runtimePresentationAdmitted = Boolean(
    sameQueueStructuralSubmissionAdmitted
    || foregroundProofValidated
  );
  const nativeReadbackFallbackValidated = offscreenForegroundValidated;
  // Browser-frame publication is useful compositor telemetry, but it is a
  // caller-supplied receipt. Runtime admission may also use the exact
  // same-queue structural submission so the no-readback default can advance;
  // only actual pixel evidence is reported as foreground proof.
  const consumerValidated = nativeWebGpuBridgeBound
    ? runtimePresentationAdmitted
    : pixelValidated;
  const nativeValidationBlockerFamily = nativeSurfaceConsumerValidationBlockerFamily({
    nativeWebGpuBridgeBound,
    consumerValidated,
    pixelValidationStatus: normalizedPixelValidationStatus,
    pixelValidationReason,
    readbackSmokeValidationStatus,
    readbackSmokeValidationReason,
    offscreenValidationStatus,
    offscreenValidationReason,
    deviceMapSmokeStatus,
    deviceTextureReadbackSmokeStatus,
    deviceTextureReadbackSmokeReason,
    nativeValidationPendingWithRenderedFrame,
    textureReadbackUnavailable
  });
  const runtimeConsumerReady = Boolean(
    inputReady
    && inputKind === 'surface-draw-buffers'
    && visibleNoReadbackSupported
    && renderBridgeBound
  );
  let sameDeviceMainThreadImportStatus = null;
  if (nativeWebGpuMainThreadImportSelected) {
    sameDeviceMainThreadImportStatus = 'same-device-main-thread-import-blocked-input-not-ready';
    if (inputReady && inputKind !== 'surface-draw-buffers') {
      sameDeviceMainThreadImportStatus = 'same-device-main-thread-import-blocked-unsupported-input-kind';
    } else if (inputReady && !visibleNoReadbackSupported) {
      sameDeviceMainThreadImportStatus = 'same-device-main-thread-import-blocked-renderer-capability';
    } else if (inputReady && visibleNoReadbackSupported && !nativeWebGpuBridgeBound) {
      sameDeviceMainThreadImportStatus = 'same-device-main-thread-import-awaiting-native-bridge';
    } else if (runtimeConsumerReady && !consumerValidated) {
      sameDeviceMainThreadImportStatus =
        'same-device-main-thread-import-awaiting-presentation-admission';
    } else if (runtimeConsumerReady && consumerValidated) {
      sameDeviceMainThreadImportStatus = 'same-device-main-thread-import-ready';
    }
  }
  let status = 'resident-surface-visible-gpu-consumer-blocked-input-not-ready';
  let reason = handoff?.reason || 'resident GPU surface buffers are not ready for a visible direct consumer';
  if (inputReady && inputKind === 'render-field-buffers') {
    status = 'resident-surface-visible-gpu-consumer-blocked-surface-extraction-required';
    reason = 'retained render-field buffers require native marching-cubes extraction before a visible direct GPU draw consumer can bind them';
  } else if (inputReady && inputKind !== 'surface-draw-buffers') {
    status = 'resident-surface-visible-gpu-consumer-blocked-unsupported-input-kind';
    reason = 'visible direct GPU consumer requires retained surface draw buffers';
  } else if (inputReady && !visibleNoReadbackSupported) {
    status = 'resident-surface-visible-gpu-consumer-blocked-renderer-capability';
    reason = rendererCapabilityReason || 'engine-owned renderer has no validated same-device GPUBuffer presentation path';
  } else if (inputReady && visibleNoReadbackSupported && !renderBridgeBound) {
    status = 'resident-surface-visible-gpu-consumer-blocked-render-bridge-not-bound';
    reason = 'same-device renderer capability is present, but the engine-owned surface-buffer bridge is not bound';
  } else if (runtimeConsumerReady && !consumerValidated) {
    status = nativeWebGpuBridgeBound
      ? 'resident-surface-visible-gpu-consumer-blocked-presentation-admission'
      : 'resident-surface-visible-gpu-consumer-blocked-pixel-validation';
    reason = nativeWebGpuBridgeBound
      ? 'engine-owned native WebGPU presentation requires either an exact same-queue structural submission receipt or generation-bound nonzero pixel proof before runtime admission'
      : 'engine-owned GPU surface consumer must pass browser console and pixel validation before it can count as visible no-readback rendering';
  } else if (runtimeConsumerReady && consumerValidated) {
    status = 'resident-surface-visible-gpu-consumer-ready';
    reason = null;
  }
  return {
    schema: 'peercompute.ulg.sph-resident-surface-visible-gpu-consumer.v0',
    status,
    reason,
    ready: status === 'resident-surface-visible-gpu-consumer-ready',
    inputReady,
    inputKind,
    inputStatus: handoff?.status ?? null,
    inputSchema: handoff?.directConsumerInputSchema ?? null,
    runtimeConsumerReady,
    sameDeviceMainThreadImportSelected: nativeWebGpuMainThreadImportSelected,
    sameDeviceMainThreadImportRoute: nativeWebGpuMainThreadImportSelected
      ? SPH_NATIVE_WEBGPU_SURFACE_CONSUMER_BRIDGE_MODE
      : null,
    sameDeviceMainThreadImportThread: nativeWebGpuMainThreadImportSelected ? 'main-thread' : null,
    sameDeviceMainThreadImportDeviceScope: nativeWebGpuMainThreadImportSelected
      ? 'engine-owned-native-webgpu-canvas-device'
      : null,
    sameDeviceMainThreadImportStatus,
    renderBridgeMode,
    renderBridgeStatus,
    renderBridgeBound,
    rendererCapabilityStatus,
    rendererCapabilityReason,
    rendererBackend: rendererCapability?.rendererBackend ?? null,
    visibleNoReadbackSupported,
    pixelValidationRequiredForForegroundProof: !foregroundProofValidated,
    // Deprecated compatibility alias. Pixel proof is not required for
    // structural runtime admission, only for a foreground-pixel claim.
    pixelValidationRequired: !foregroundProofValidated,
    pixelValidationStatus: normalizedPixelValidationStatus,
    pixelValidationReason,
    pixelValidated,
    consumerValidated,
    runtimePresentationAdmitted,
    foregroundProofValidated,
    sameQueueStructuralSubmissionAdmitted,
    // Deprecated compatibility telemetry. Structural submission is not a
    // foreground-pixel proof, so this legacy claim must remain false.
    sameQueueForegroundSubmissionValidated: false,
    browserFrameForegroundValidated,
    offscreenForegroundValidated,
    nativeReadbackFallbackValidated,
    nativeValidationPendingWithRenderedFrame,
    nativeSurfaceConsumerRenderedFrameCount: nativeRenderedFrameCount,
    nativeSurfaceConsumerReadbackSmokeValidationStatus: readbackSmokeValidationStatus,
    nativeSurfaceConsumerReadbackSmokeValidationReason: readbackSmokeValidationReason,
    nativeSurfaceConsumerOffscreenValidationStatus: offscreenValidationStatus,
    nativeSurfaceConsumerOffscreenValidationReason: offscreenValidationReason,
    nativeSurfaceConsumerOffscreenValidationNonzeroPixelCount:
      offscreenValidationNonzeroPixelCount,
    nativeSurfaceConsumerCandidateForegroundProofKind:
      candidateForegroundProofKind,
    nativeSurfaceConsumerCandidateForegroundValidationStatus:
      candidateForegroundValidationStatus,
    nativeSurfaceConsumerCandidateForegroundGpuFenceSatisfied:
      candidateForegroundGpuFenceSatisfied,
    nativeSurfaceConsumerCandidateForegroundSameQueueSubmissionBoundary:
      candidateForegroundSameQueueSubmissionBoundary,
    nativeSurfaceConsumerCandidateForegroundSubmittedDrawCount:
      candidateForegroundSubmittedDrawCount,
    nativeSurfaceConsumerCandidateForegroundResourceGeneration:
      candidateForegroundResourceGeneration,
    nativeSurfaceConsumerActiveResourceGeneration: activeSurfaceResourceGeneration,
    nativeSurfaceConsumerOffscreenValidationResourceGeneration:
      offscreenValidationResourceGeneration,
    nativeSurfaceConsumerPixelValidationSource: pixelValidationSource,
    nativeSurfaceConsumerPixelValidationNonzeroPixelCount:
      pixelValidationNonzeroPixelCount,
    nativeSurfaceConsumerPixelValidationResourceGeneration:
      pixelValidationResourceGeneration,
    nativeSurfaceConsumerDeviceMapSmokeStatus: deviceMapSmokeStatus,
    nativeSurfaceConsumerDeviceTextureReadbackSmokeStatus: deviceTextureReadbackSmokeStatus,
    nativeSurfaceConsumerDeviceTextureReadbackSmokeReason: deviceTextureReadbackSmokeReason,
    nativeSurfaceConsumerValidationBlockerFamily: nativeValidationBlockerFamily,
    nativeSurfaceConsumerTextureReadbackUnavailable: textureReadbackUnavailable
  };
}

export function assignResidentSurfaceVisibleGpuConsumer(target, visibleGpuConsumer) {
  if (!target || !visibleGpuConsumer) return target;
  target.surfaceDrawVisibleGpuConsumerSchema = visibleGpuConsumer.schema;
  target.surfaceDrawVisibleGpuConsumerReady = visibleGpuConsumer.ready;
  target.surfaceDrawVisibleGpuConsumerStatus = visibleGpuConsumer.status;
  target.surfaceDrawVisibleGpuConsumerReason = visibleGpuConsumer.reason;
  target.surfaceDrawVisibleGpuConsumerInputReady = visibleGpuConsumer.inputReady;
  target.surfaceDrawVisibleGpuConsumerInputKind = visibleGpuConsumer.inputKind;
  target.surfaceDrawVisibleGpuConsumerInputStatus = visibleGpuConsumer.inputStatus;
  target.surfaceDrawVisibleGpuConsumerInputSchema = visibleGpuConsumer.inputSchema;
  target.surfaceDrawVisibleGpuConsumerRuntimeReady = visibleGpuConsumer.runtimeConsumerReady;
  target.surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportSelected =
    visibleGpuConsumer.sameDeviceMainThreadImportSelected;
  target.surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportRoute =
    visibleGpuConsumer.sameDeviceMainThreadImportRoute;
  target.surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportThread =
    visibleGpuConsumer.sameDeviceMainThreadImportThread;
  target.surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportDeviceScope =
    visibleGpuConsumer.sameDeviceMainThreadImportDeviceScope;
  target.surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportStatus =
    visibleGpuConsumer.sameDeviceMainThreadImportStatus;
  target.surfaceDrawVisibleGpuConsumerRenderBridgeMode = visibleGpuConsumer.renderBridgeMode;
  target.surfaceDrawVisibleGpuConsumerRenderBridgeStatus = visibleGpuConsumer.renderBridgeStatus;
  target.surfaceDrawVisibleGpuConsumerRenderBridgeBound = visibleGpuConsumer.renderBridgeBound;
  target.surfaceDrawVisibleGpuConsumerRendererCapabilityStatus = visibleGpuConsumer.rendererCapabilityStatus;
  target.surfaceDrawVisibleGpuConsumerRendererCapabilityReason = visibleGpuConsumer.rendererCapabilityReason;
  target.surfaceDrawVisibleGpuConsumerRendererBackend = visibleGpuConsumer.rendererBackend;
  target.surfaceDrawVisibleGpuConsumerVisibleNoReadbackSupported =
    visibleGpuConsumer.visibleNoReadbackSupported;
  target.surfaceDrawVisibleGpuConsumerPixelValidationRequired =
    visibleGpuConsumer.pixelValidationRequired;
  target.surfaceDrawVisibleGpuConsumerPixelValidationRequiredForForegroundProof =
    visibleGpuConsumer.pixelValidationRequiredForForegroundProof;
  target.surfaceDrawVisibleGpuConsumerPixelValidationStatus = visibleGpuConsumer.pixelValidationStatus;
  target.surfaceDrawVisibleGpuConsumerPixelValidated = visibleGpuConsumer.pixelValidated;
  target.surfaceDrawVisibleGpuConsumerValidated = visibleGpuConsumer.consumerValidated;
  target.surfaceDrawVisibleGpuConsumerRuntimePresentationAdmitted =
    visibleGpuConsumer.runtimePresentationAdmitted;
  target.surfaceDrawVisibleGpuConsumerForegroundProofValidated =
    visibleGpuConsumer.foregroundProofValidated;
  target.surfaceDrawVisibleGpuConsumerSameQueueStructuralSubmissionAdmitted =
    visibleGpuConsumer.sameQueueStructuralSubmissionAdmitted;
  target.surfaceDrawVisibleGpuConsumerSameQueueForegroundSubmissionValidated =
    visibleGpuConsumer.sameQueueForegroundSubmissionValidated;
  target.surfaceDrawVisibleGpuConsumerBrowserFrameForegroundValidated =
    visibleGpuConsumer.browserFrameForegroundValidated;
  target.surfaceDrawVisibleGpuConsumerOffscreenForegroundValidated =
    visibleGpuConsumer.offscreenForegroundValidated;
  target.surfaceDrawVisibleGpuConsumerNativeReadbackFallbackValidated =
    visibleGpuConsumer.nativeReadbackFallbackValidated;
  target.surfaceDrawVisibleGpuConsumerNativeValidationPendingWithRenderedFrame =
    visibleGpuConsumer.nativeValidationPendingWithRenderedFrame;
  target.surfaceDrawVisibleGpuConsumerNativeRenderedFrameCount =
    visibleGpuConsumer.nativeSurfaceConsumerRenderedFrameCount;
  target.surfaceDrawVisibleGpuConsumerNativeReadbackSmokeValidationStatus =
    visibleGpuConsumer.nativeSurfaceConsumerReadbackSmokeValidationStatus;
  target.surfaceDrawVisibleGpuConsumerNativeOffscreenValidationStatus =
    visibleGpuConsumer.nativeSurfaceConsumerOffscreenValidationStatus;
  target.surfaceDrawVisibleGpuConsumerNativeOffscreenValidationNonzeroPixelCount =
    visibleGpuConsumer.nativeSurfaceConsumerOffscreenValidationNonzeroPixelCount;
  target.surfaceDrawVisibleGpuConsumerNativeCandidateForegroundProofKind =
    visibleGpuConsumer.nativeSurfaceConsumerCandidateForegroundProofKind;
  target.surfaceDrawVisibleGpuConsumerNativeCandidateForegroundValidationStatus =
    visibleGpuConsumer.nativeSurfaceConsumerCandidateForegroundValidationStatus;
  target.surfaceDrawVisibleGpuConsumerNativeCandidateForegroundGpuFenceSatisfied =
    visibleGpuConsumer
      .nativeSurfaceConsumerCandidateForegroundGpuFenceSatisfied;
  target.surfaceDrawVisibleGpuConsumerNativeCandidateForegroundSameQueueSubmissionBoundary =
    visibleGpuConsumer
      .nativeSurfaceConsumerCandidateForegroundSameQueueSubmissionBoundary;
  target.surfaceDrawVisibleGpuConsumerNativeCandidateForegroundSubmittedDrawCount =
    visibleGpuConsumer
      .nativeSurfaceConsumerCandidateForegroundSubmittedDrawCount;
  target.surfaceDrawVisibleGpuConsumerNativeCandidateForegroundResourceGeneration =
    visibleGpuConsumer
      .nativeSurfaceConsumerCandidateForegroundResourceGeneration;
  target.surfaceDrawVisibleGpuConsumerNativeActiveResourceGeneration =
    visibleGpuConsumer.nativeSurfaceConsumerActiveResourceGeneration;
  target.surfaceDrawVisibleGpuConsumerNativeOffscreenValidationResourceGeneration =
    visibleGpuConsumer.nativeSurfaceConsumerOffscreenValidationResourceGeneration;
  target.surfaceDrawVisibleGpuConsumerNativePixelValidationSource =
    visibleGpuConsumer.nativeSurfaceConsumerPixelValidationSource;
  target.surfaceDrawVisibleGpuConsumerNativePixelValidationNonzeroPixelCount =
    visibleGpuConsumer.nativeSurfaceConsumerPixelValidationNonzeroPixelCount;
  target.surfaceDrawVisibleGpuConsumerNativePixelValidationResourceGeneration =
    visibleGpuConsumer.nativeSurfaceConsumerPixelValidationResourceGeneration;
  target.surfaceDrawVisibleGpuConsumerNativeDeviceMapSmokeStatus =
    visibleGpuConsumer.nativeSurfaceConsumerDeviceMapSmokeStatus;
  target.surfaceDrawVisibleGpuConsumerNativeDeviceTextureReadbackSmokeStatus =
    visibleGpuConsumer.nativeSurfaceConsumerDeviceTextureReadbackSmokeStatus;
  target.surfaceDrawVisibleGpuConsumerNativeDeviceTextureReadbackSmokeReason =
    visibleGpuConsumer.nativeSurfaceConsumerDeviceTextureReadbackSmokeReason;
  target.surfaceDrawVisibleGpuConsumerNativeValidationBlockerFamily =
    visibleGpuConsumer.nativeSurfaceConsumerValidationBlockerFamily;
  target.surfaceDrawVisibleGpuConsumerNativeTextureReadbackUnavailable =
    visibleGpuConsumer.nativeSurfaceConsumerTextureReadbackUnavailable;
  return target;
}

export function createThreeWebGpuExternalInterleavedBufferAttribute({
  renderer = null,
  buffer = null,
  count = 0,
  stride = 0,
  itemSize = 3,
  offset = 0,
  name = ''
} = {}) {
  const Three = renderer?.userData?.sphThreeNamespace || activeThreeNamespace || THREE;
  const vertexCount = Math.max(0, Math.floor(Number(count) || 0));
  const rowStride = Math.max(1, Math.floor(Number(stride) || 0));
  const attributeItemSize = Math.max(1, Math.floor(Number(itemSize) || 0));
  const attributeOffset = Math.max(0, Math.floor(Number(offset) || 0));
  if (!renderer?.isWebGPURenderer || typeof renderer?.backend?.get !== 'function') {
    throw new Error('Three WebGPU renderer backend buffer binding is required');
  }
  if (!buffer) {
    throw new Error('caller-owned GPUBuffer is required');
  }
  const interleavedBuffer = new Three.InterleavedBuffer(new Float32Array(rowStride), rowStride);
  interleavedBuffer.count = vertexCount;
  const attribute = new Three.InterleavedBufferAttribute(
    interleavedBuffer,
    attributeItemSize,
    attributeOffset,
    false
  );
  attribute.name = name;
  renderer.backend.get(interleavedBuffer).buffer = buffer;
  return {
    attribute,
    interleavedBuffer,
    buffer,
    count: vertexCount,
    stride: rowStride,
    itemSize: attributeItemSize,
    offset: attributeOffset
  };
}

export function createThreeWebGpuExternalIndirectBufferAttribute({
  renderer = null,
  buffer = null,
  itemSize = 4,
  name = ''
} = {}) {
  const Three = renderer?.userData?.sphThreeNamespace || activeThreeNamespace || THREE;
  const indirectItemSize = Math.max(1, Math.floor(Number(itemSize) || 0));
  if (!renderer?.isWebGPURenderer || typeof renderer?.backend?.get !== 'function') {
    throw new Error('Three WebGPU renderer backend indirect buffer binding is required');
  }
  if (!buffer) {
    throw new Error('caller-owned GPU indirect buffer is required');
  }
  if (typeof Three.IndirectStorageBufferAttribute !== 'function') {
    throw new Error('Three WebGPU IndirectStorageBufferAttribute is required');
  }
  const attribute = new Three.IndirectStorageBufferAttribute(1, indirectItemSize);
  attribute.name = name;
  renderer.backend.get(attribute).buffer = buffer;
  return {
    attribute,
    buffer,
    count: 1,
    itemSize: indirectItemSize
  };
}

export function resolveThreeWebGpuSurfaceBufferDrawRecords({
  surfaceDrawExecution = null,
  rowStride = SPH_GPU_RENDER_SURFACE_VERTEX_FLOATS
} = {}) {
  const sourceSurfaces = Array.isArray(surfaceDrawExecution?.surfaces)
    ? surfaceDrawExecution.surfaces
    : [];
  const hasExactDrawRows = sourceSurfaces.some((surface) => {
    const status = String(surface?.status || '');
    if (
      status === 'surface-draw-summary-not-read'
      || status === 'surface-draw-conservative-no-readback-range'
    ) {
      return false;
    }
    const vertexCount = Math.max(0, Math.floor(Number(surface?.vertexCount) || 0));
    return vertexCount - (vertexCount % 3) >= 3;
  });
  if (hasExactDrawRows) {
    return {
      schema: 'peercompute.ulg.sph-three-webgpu-surface-buffer-draw-records.v0',
      status: 'exact-surface-draw-records',
      reason: null,
      records: sourceSurfaces,
      conservativeNoReadbackDrawRange: false,
      aggregateVertexCount: null
    };
  }
  const sourceVertexRowCount = Math.max(
    0,
    Math.floor(Number(
      surfaceDrawExecution?.sourceVertexRowCount
        ?? surfaceDrawExecution?.vertexCount
        ?? (
          surfaceDrawExecution?.compactedVertexRowsBufferByteLength
            ? surfaceDrawExecution.compactedVertexRowsBufferByteLength
              / (Math.max(1, rowStride) * Float32Array.BYTES_PER_ELEMENT)
            : 0
        )
    ) || 0)
  );
  const alignedVertexCount = sourceVertexRowCount - (sourceVertexRowCount % 3);
  if (alignedVertexCount < 3) {
    return {
      schema: 'peercompute.ulg.sph-three-webgpu-surface-buffer-draw-records.v0',
      status: 'surface-draw-records-empty',
      reason: 'retained GPU vertex buffer does not contain a drawable triangle range',
      records: sourceSurfaces,
      conservativeNoReadbackDrawRange: false,
      aggregateVertexCount: alignedVertexCount
    };
  }
  const templateSurface = sourceSurfaces.find((surface) => surface && typeof surface === 'object') || {};
  const surfaceIndex = Math.max(0, Math.round(Number(templateSurface.surfaceIndex) || 0));
  const explicitTransparencyClassId = Number(templateSurface.transparencyClassId);
  const phaseId = Math.round(Number(templateSurface.phaseId) || 0);
  const fallbackTransparencyClassId = phaseId === GPU_PHASE_IDS.gas
    ? 3
    : (phaseId === GPU_PHASE_IDS.liquid ? 2 : 0);
  const transparencyClassId = Number.isFinite(explicitTransparencyClassId) && explicitTransparencyClassId >= 0
    ? explicitTransparencyClassId
    : fallbackTransparencyClassId;
  const explicitDepthWriteFlag = Number(templateSurface.depthWriteFlag);
  const depthWriteFlag = Number.isFinite(explicitDepthWriteFlag) && explicitDepthWriteFlag >= 0
    ? explicitDepthWriteFlag
    : (transparencyClassId > 0 ? 0 : 1);
  const explicitRenderOrder = Number(templateSurface.renderOrder);
  const renderOrder = Number.isFinite(explicitRenderOrder)
    ? explicitRenderOrder
    : (transparencyClassId * 1000 + surfaceIndex);
  const aggregateRecord = {
    ...templateSurface,
    surfaceKey: templateSurface.surfaceKey || 'resident-gpu-surface-buffer-aggregate',
    material: templateSurface.material || templateSurface.renderKey || 'unknown',
    phase: templateSurface.phase || 'unknown',
    renderKey: templateSurface.renderKey || templateSurface.material || 'resident-gpu-surface-buffer-aggregate',
    renderLayer: templateSurface.renderLayer ?? null,
    surfaceIndex,
    vertexOffset: 0,
    vertexCount: alignedVertexCount,
    triangleOffset: 0,
    triangleCount: Math.floor(alignedVertexCount / 3),
    renderOrder,
    transparencyClassId,
    depthWriteFlag,
    boundsCenterM: Array.isArray(templateSurface.boundsCenterM) ? templateSurface.boundsCenterM : null,
    boundsRadiusM: Number.isFinite(Number(templateSurface.boundsRadiusM))
      ? Number(templateSurface.boundsRadiusM)
      : null,
    status: 'surface-draw-conservative-no-readback-range'
  };
  return {
    schema: 'peercompute.ulg.sph-three-webgpu-surface-buffer-draw-records.v0',
    status: 'conservative-no-readback-aggregate',
    reason: 'exact surface draw rows are GPU-resident; using an aggregate draw range to avoid compact summary readback',
    records: [aggregateRecord],
    conservativeNoReadbackDrawRange: true,
    aggregateVertexCount: alignedVertexCount
  };
}

export function isThreeResidentSurfaceBridgeMode(value) {
  const mode = String(value || '').trim().toLowerCase();
  return mode === SPH_THREE_RENDER_ROW_POINTS_BRIDGE_MODE
    || mode === 'three-points'
    || mode === SPH_THREE_RENDER_ROW_SPHERES_BRIDGE_MODE
    || mode === 'three-spheres'
    || mode === SPH_THREE_COMPACT_VERTEX_BRIDGE_MODE
    || mode === SPH_THREE_WEBGPU_SURFACE_BUFFER_BRIDGE_MODE
    || mode === SPH_NATIVE_WEBGPU_SURFACE_CONSUMER_BRIDGE_MODE
    || mode === 'three'
    || mode === SPH_WEBGPU_RENDER_ROW_POINTS_BRIDGE_MODE
    || mode === SPH_WEBGPU_RENDER_ROW_SPHERES_BRIDGE_MODE
    || mode === 'webgpu-points'
    || mode === 'webgpu-spheres';
}
export function isWebGpuResidentRenderRowBridgeMode(value) {
  const mode = String(value || '').trim().toLowerCase();
  return mode === SPH_WEBGPU_RENDER_ROW_POINTS_BRIDGE_MODE
    || mode === 'webgpu-points'
    || mode === SPH_WEBGPU_RENDER_ROW_SPHERES_BRIDGE_MODE
    || mode === 'webgpu-spheres';
}
export function isThreeResidentRenderRowBridgeMode(value) {
  const mode = String(value || '').trim().toLowerCase();
  return mode === SPH_THREE_RENDER_ROW_POINTS_BRIDGE_MODE
    || mode === 'three-points'
    || mode === SPH_THREE_RENDER_ROW_SPHERES_BRIDGE_MODE
    || mode === 'three-spheres'
    || mode === 'three';
}
// Modes whose visible output is produced on the main thread from copied
// compact data. When the caller marks the mode as an explicit selection
// (URL param or render-mode menu), these must win over the auto
// render-ownership policy's worker-owned presentation, mirroring the
// existing native-webgpu-surface-consumer bypass.
export function isMainThreadResidentSurfaceDrawBridgeMode(value) {
  const mode = String(value || '').trim().toLowerCase();
  return isThreeResidentRenderRowBridgeMode(mode)
    || isWebGpuResidentRenderRowBridgeMode(mode)
    || mode === SPH_THREE_COMPACT_VERTEX_BRIDGE_MODE
    || mode === SPH_THREE_WEBGPU_SURFACE_BUFFER_BRIDGE_MODE
    || mode === SPH_NATIVE_WEBGPU_SURFACE_CONSUMER_BRIDGE_MODE;
}
function isResidentRenderRowBridgeMode(value) {
  const mode = String(value || '').trim().toLowerCase();
  return isThreeResidentRenderRowBridgeMode(mode)
    || isWebGpuResidentRenderRowBridgeMode(mode);
}
export const SPH_SURFACE_VERTEX_ROW_INDEX = Object.freeze({
  surfaceIndex: 0,
  materialId: 1,
  phaseId: 2,
  triangleIndex: 3,
  vertexIndex: 4,
  positionXM: 5,
  positionYM: 6,
  positionZM: 7,
  normalX: 8,
  normalY: 9,
  normalZ: 10,
  opticalStateId: 11,
  density: 12,
  isolation: 13,
  sourceVoxelLinearIndex: 14,
  status: 15
});
export const GPU_TEXTURE_USAGE = {
  COPY_SRC: globalThis.GPUTextureUsage?.COPY_SRC ?? 1,
  COPY_DST: globalThis.GPUTextureUsage?.COPY_DST ?? 2,
  TEXTURE_BINDING: globalThis.GPUTextureUsage?.TEXTURE_BINDING ?? 4,
  RENDER_ATTACHMENT: globalThis.GPUTextureUsage?.RENDER_ATTACHMENT ?? 16
};
export const GPU_BUFFER_USAGE = {
  MAP_READ: globalThis.GPUBufferUsage?.MAP_READ ?? 1,
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  INDIRECT: globalThis.GPUBufferUsage?.INDIRECT ?? 256
};
export const SPH_NATIVE_WEBGPU_SURFACE_CANVAS_USAGE = GPU_TEXTURE_USAGE.RENDER_ATTACHMENT
  | GPU_TEXTURE_USAGE.COPY_SRC
  | GPU_TEXTURE_USAGE.COPY_DST;
export const GPU_MAP_MODE = {
  READ: globalThis.GPUMapMode?.READ ?? 1
};
export const GPU_SHADER_STAGE = {
  VERTEX: globalThis.GPUShaderStage?.VERTEX ?? 1,
  FRAGMENT: globalThis.GPUShaderStage?.FRAGMENT ?? 2
};

export function normalizeResidentSurfaceDrawOverlayMode(mode = SPH_RESIDENT_SURFACE_DRAW_OVERLAY_MODE_DEFAULT) {
  const normalized = String(mode ?? SPH_RESIDENT_SURFACE_DRAW_OVERLAY_MODE_DEFAULT).trim().toLowerCase();
  if (['1', 'true', 'on', 'yes', 'enabled', 'enable', 'webgpu', 'overlay', 'resident'].includes(normalized)) return 'enabled';
  if (['0', 'false', 'off', 'no', 'disabled', 'disable', 'three', 'marching-cubes', 'readback'].includes(normalized)) return 'disabled';
  return 'auto';
}

export function resolveResidentSurfaceDrawOverlayPolicy({
  mode = SPH_RESIDENT_SURFACE_DRAW_OVERLAY_MODE_DEFAULT,
  container = null,
  navigatorRef = globalThis.navigator
} = {}) {
  const normalizedMode = normalizeResidentSurfaceDrawOverlayMode(mode);
  if (normalizedMode === 'disabled') {
    return {
      schema: 'peercompute.ulg.sph-resident-surface-draw-overlay-policy.v0',
      mode: normalizedMode,
      enabled: false,
      status: 'surface-draw-overlay-disabled-by-policy',
      reason: SPH_THREE_WEBGPU_BINDING_REASON
    };
  }
  if (normalizedMode === 'enabled') {
    return {
      schema: 'peercompute.ulg.sph-resident-surface-draw-overlay-policy.v0',
      mode: normalizedMode,
      enabled: true,
      status: 'surface-draw-overlay-forced',
      reason: 'raw WebGPU canvas overlay forced by scene option'
    };
  }
  const gpu = navigatorRef?.gpu || globalThis.navigator?.gpu;
  if (!gpu?.getPreferredCanvasFormat) {
    return {
      schema: 'peercompute.ulg.sph-resident-surface-draw-overlay-policy.v0',
      mode: normalizedMode,
      enabled: false,
      status: 'surface-draw-overlay-auto-unavailable',
      reason: 'navigator.gpu canvas format support unavailable'
    };
  }
  if (typeof container?.ownerDocument?.createElement !== 'function') {
    return {
      schema: 'peercompute.ulg.sph-resident-surface-draw-overlay-policy.v0',
      mode: normalizedMode,
      enabled: false,
      status: 'surface-draw-overlay-auto-unavailable',
      reason: 'document canvas creation unavailable'
    };
  }
  try {
    const probeCanvas = container.ownerDocument.createElement('canvas');
    if (!probeCanvas?.getContext?.('webgpu')) {
      return {
        schema: 'peercompute.ulg.sph-resident-surface-draw-overlay-policy.v0',
        mode: normalizedMode,
        enabled: false,
        status: 'surface-draw-overlay-auto-unavailable',
        reason: 'WebGPU canvas context unavailable'
      };
    }
  } catch (error) {
    return {
      schema: 'peercompute.ulg.sph-resident-surface-draw-overlay-policy.v0',
      mode: normalizedMode,
      enabled: false,
      status: 'surface-draw-overlay-auto-unavailable',
      reason: error instanceof Error ? error.message : String(error)
    };
  }
  return {
    schema: 'peercompute.ulg.sph-resident-surface-draw-overlay-policy.v0',
    mode: normalizedMode,
    enabled: true,
    status: 'surface-draw-overlay-auto-ready',
    reason: 'WebGPU canvas overlay available'
  };
}

export function residentRenderFieldReadbackModeForSurfaceOverlay(enabled) {
  return enabled ? RESIDENT_NO_FULL_READBACK_MODE : RESIDENT_FULL_READBACK_MODE;
}

export function selectPressureInterfaceGridForceAdmissionForExecutionMode({
  residentComputeManagerMode = null,
  directAdmission = null,
  priorAdmission = null
} = {}) {
  return residentComputeManagerMode === 'direct'
    ? (directAdmission || null)
    : (priorAdmission || null);
}

export function pressureFeedbackFromGasPressureSummary(gasPressureSummary) {
  if (!gasPressureSummary) return null;
  if (gasPressureSummary.pressureFeedback) return gasPressureSummary.pressureFeedback;
  if (gasPressureSummary.gasCellField || gasPressureSummary.pressureGaugePa != null) return gasPressureSummary;
  return null;
}

export function resolveMlsMpmAmbientPressureEvidence({
  ambientPressurePa = null,
  pressureFeedback = null,
  gasPressureSummary = null
} = {}) {
  if (ambientPressurePa !== null && ambientPressurePa !== undefined) {
    const explicitAmbientPressurePa = finiteNumberOrNull(ambientPressurePa);
    if (explicitAmbientPressurePa !== null && explicitAmbientPressurePa >= 0) {
      return {
        schema: 'peercompute.ulg.mls-mpm-ambient-pressure-evidence.v0',
        status: 'ambient-pressure-ready',
        source: 'explicit-ambient-pressure-option',
        ambientPressurePa: explicitAmbientPressurePa
      };
    }
  }
  const summaryPressureFeedback = pressureFeedbackFromGasPressureSummary(gasPressureSummary);
  for (const effectivePressureFeedback of [pressureFeedback, summaryPressureFeedback]) {
    const externalPressurePa = finiteNumberOrNull(effectivePressureFeedback?.externalPressurePa);
    if (externalPressurePa !== null && externalPressurePa >= 0) {
      return {
        schema: 'peercompute.ulg.mls-mpm-ambient-pressure-evidence.v0',
        status: 'ambient-pressure-ready',
        source: 'pressure-feedback-external-pressure-pa',
        ambientPressurePa: externalPressurePa,
        pressureFeedbackSchema: effectivePressureFeedback?.schema ?? null,
        pressureFeedbackStatus: effectivePressureFeedback?.status ?? null
      };
    }
  }
  return {
    schema: 'peercompute.ulg.mls-mpm-ambient-pressure-evidence.v0',
    status: 'vacuum-default-ready',
    source: 'vacuum-default-no-atmospheric-evidence',
    ambientPressurePa: 0,
    pressureFeedbackSchema: pressureFeedback?.schema ?? summaryPressureFeedback?.schema ?? null,
    pressureFeedbackStatus: pressureFeedback?.status ?? summaryPressureFeedback?.status ?? null
  };
}

export function createLatestSceneRefreshRequestGate() {
  let latestRequestToken = 0;
  return {
    begin() {
      latestRequestToken += 1;
      return latestRequestToken;
    },
    invalidate() {
      latestRequestToken += 1;
      return latestRequestToken;
    },
    isLatest(requestToken) {
      return requestToken === latestRequestToken;
    }
  };
}

export function sphResidentRenderRefreshPublicationIsCurrent({
  running = false,
  residentExecutionGeneration = null,
  currentResidentExecutionGeneration = null,
  requestSerial = null,
  currentRequestSerial = null,
  callerPublicationCurrent = true
} = {}) {
  if (running !== true || callerPublicationCurrent !== true) return false;
  if (
    residentExecutionGeneration == null
    || currentResidentExecutionGeneration == null
    || residentExecutionGeneration !== currentResidentExecutionGeneration
  ) return false;
  if (
    requestSerial != null
    || currentRequestSerial != null
  ) {
    if (
      requestSerial == null
      || currentRequestSerial == null
      || requestSerial !== currentRequestSerial
    ) return false;
  }
  return true;
}

export function residentSpatialEpochU32(value, { positive = false } = {}) {
  if (
    typeof value !== 'number'
    || !Number.isInteger(value)
    || value < (positive ? 1 : 0)
    || value > 0xffff_ffff
  ) return null;
  return value;
}

export function resolveSphMaterialInterfacePreIntegrationProvenance({
  sphParticleState = null,
  mlsMpmParticleState = null,
  sphParticleUpload = null,
  mlsMpmParticleUpload = null,
  device = null
} = {}) {
  const blockers = [];
  const block = (condition, reason) => {
    if (condition && !blockers.includes(reason)) blockers.push(reason);
  };
  const sphStorageGeneration = residentSpatialEpochU32(
    sphParticleUpload?.storageGeneration ?? sphParticleUpload?.bufferFamilyGeneration,
    { positive: true }
  );
  const mlsStorageGeneration = residentSpatialEpochU32(
    mlsMpmParticleUpload?.storageGeneration ?? mlsMpmParticleUpload?.bufferFamilyGeneration,
    { positive: true }
  );
  const particleCount = residentSpatialEpochU32(sphParticleUpload?.particleCount);
  const mlsParticleCount = residentSpatialEpochU32(mlsMpmParticleUpload?.particleCount);
  const stateParticleCount = residentSpatialEpochU32(sphParticleState?.particleCount);
  const mlsStateParticleCount = mlsMpmParticleState == null
    ? particleCount
    : residentSpatialEpochU32(mlsMpmParticleState?.particleCount);
  const positionEpoch = residentSpatialEpochU32(sphParticleUpload?.positionEpoch);
  const topologyEpoch = residentSpatialEpochU32(sphParticleUpload?.topologyEpoch);
  const chartEpoch = residentSpatialEpochU32(sphParticleUpload?.chartEpoch);
  const levelEpoch = residentSpatialEpochU32(sphParticleUpload?.levelEpoch);
  const supportEpoch = residentSpatialEpochU32(sphParticleUpload?.supportEpoch);
  // These are deliberately the same authorities used by the canonical
  // Schroeder level-assignment producer and the pressure particle-source
  // adapter. A disagreement is not repaired by choosing one side: the field
  // remains useful for rendering, but is rejected as exact-near evidence.
  const hierarchyPhysicsTick = residentSpatialEpochU32(
    sphParticleState?.step ?? mlsMpmParticleState?.step ?? 0
  );
  const particlePhysicsTick = residentSpatialEpochU32(
    sphParticleUpload?.physicsTick
      ?? sphParticleState?.physicsTick
      ?? positionEpoch
  );
  const hierarchyPhysicsSubstep = residentSpatialEpochU32(
    sphParticleState?.physicsSubstep ?? mlsMpmParticleState?.physicsSubstep ?? 0
  );
  const particlePhysicsSubstep = residentSpatialEpochU32(
    sphParticleUpload?.physicsSubstep ?? sphParticleState?.physicsSubstep ?? 0
  );
  const declaredStateEpochs = [
    ['position', sphParticleState?.positionEpoch, positionEpoch],
    ['topology', sphParticleState?.topologyEpoch, topologyEpoch],
    ['chart', sphParticleState?.chartEpoch, chartEpoch],
    ['level', sphParticleState?.levelEpoch, levelEpoch],
    ['support', sphParticleState?.supportEpoch, supportEpoch]
  ];

  block(sphParticleState?.schema == null, 'sph-particle-state-unavailable');
  block(
    sphParticleUpload?.status !== 'webgpu-uploaded',
    'sph-particle-buffer-family-unavailable'
  );
  block(
    mlsMpmParticleUpload?.status !== 'webgpu-uploaded',
    'mls-mpm-particle-buffer-family-unavailable'
  );
  block(
    sphStorageGeneration == null
      || mlsStorageGeneration == null
      || sphStorageGeneration !== mlsStorageGeneration,
    'storage-generation-mismatch'
  );
  block(
    particleCount == null
      || particleCount <= 0
      || mlsParticleCount !== particleCount
      || stateParticleCount !== particleCount
      || mlsStateParticleCount !== particleCount,
    'particle-count-mismatch'
  );
  block(
    !sphParticleUpload?.stateBuffer
      || !sphParticleUpload?.thermoBuffer
      || !sphParticleUpload?.identityBuffer,
    'sph-buffer-identity-incomplete'
  );
  block(
    !mlsMpmParticleUpload?.mechanicsBuffer,
    'mls-mpm-buffer-identity-incomplete'
  );
  block(
    [positionEpoch, topologyEpoch, chartEpoch, levelEpoch, supportEpoch]
      .some((epoch) => epoch == null),
    'particle-epoch-family-incomplete'
  );
  block(
    hierarchyPhysicsTick == null
      || particlePhysicsTick == null
      || hierarchyPhysicsTick !== particlePhysicsTick,
    'physics-tick-mismatch'
  );
  block(
    hierarchyPhysicsSubstep == null
      || particlePhysicsSubstep == null
      || hierarchyPhysicsSubstep !== particlePhysicsSubstep,
    'physics-substep-mismatch'
  );
  if (mlsMpmParticleState?.step != null) {
    block(
      residentSpatialEpochU32(mlsMpmParticleState.step) !== hierarchyPhysicsTick,
      'sph-mls-physics-tick-mismatch'
    );
  }
  for (const [name, declared, uploaded] of declaredStateEpochs) {
    if (declared == null) continue;
    block(
      residentSpatialEpochU32(declared) !== uploaded,
      `${name}-epoch-state-upload-mismatch`
    );
  }
  for (const state of [sphParticleState, mlsMpmParticleState]) {
    if (state?.storageGeneration == null) continue;
    block(
      residentSpatialEpochU32(state.storageGeneration, { positive: true })
        !== sphStorageGeneration,
      'storage-generation-state-upload-mismatch'
    );
  }
  if (device) {
    block(
      !sphGpuParticleUploadMatchesDevice(sphParticleUpload, device),
      'sph-buffer-family-device-mismatch'
    );
    block(
      !mlsMpmGpuParticleUploadMatchesDevice(mlsMpmParticleUpload, device),
      'mls-mpm-buffer-family-device-mismatch'
    );
  }

  const ready = blockers.length === 0;
  return {
    schema: 'peercompute.ulg.sph-material-interface-pre-integration-provenance.v0',
    status: ready
      ? 'material-interface-current-particle-epoch-ready'
      : 'material-interface-current-particle-epoch-rejected-incomplete-provenance',
    ready,
    reason: ready ? null : blockers.join(', '),
    blockers,
    positionAuthority: 'same-epoch-pre-integration-particle-state',
    storageGeneration: ready ? sphStorageGeneration : null,
    physicsTick: ready ? hierarchyPhysicsTick : null,
    physicsSubstep: ready ? hierarchyPhysicsSubstep : null,
    positionEpoch: ready ? positionEpoch : null,
    topologyEpoch: ready ? topologyEpoch : null,
    chartEpoch: ready ? chartEpoch : null,
    levelEpoch: ready ? levelEpoch : null,
    supportEpoch: ready ? supportEpoch : null,
    particleCount: ready ? particleCount : null,
    sourceStateBuffer: ready ? sphParticleUpload.stateBuffer : null,
    sourceThermoBuffer: ready ? sphParticleUpload.thermoBuffer : null,
    sourceIdentityBuffer: ready ? sphParticleUpload.identityBuffer : null,
    sourceMechanicsBuffer: ready ? mlsMpmParticleUpload.mechanicsBuffer : null
  };
}

export function createResidentGpuArtifactRetirementBarrier({
  deferCleanup = deferSubmittedWorkCleanup,
  releaseQueueOrderedCleanup =
    releaseSubmittedWorkCleanupQueueOrdered
} = {}) {
  let activeLeaseCount = 0;
  const pendingRetirements = [];

  const scheduleRetirement = (retirement) => {
    const {
      device = null,
      cleanup,
      queueOrderedFinalConsumer = null,
      producerClaim = null,
      producerOutput = null,
      producerFamily = null
    } = retirement;
    let cleaned = false;
    const cleanupOnce = () => {
      if (cleaned) return;
      cleaned = true;
      cleanup();
    };
    try {
      if (
        queueOrderedFinalConsumer
        && producerClaim
        && producerOutput
        && producerFamily
      ) {
        cleaned = true;
        releaseQueueOrderedCleanup(device, cleanup, {
          queueOrderedFinalConsumer,
          producerClaim,
          producerOutput,
          producerFamily
        });
      } else {
        deferCleanup(device, cleanupOnce);
      }
    } catch (error) {
      if (cleaned) throw error;
      deferCleanup(device, cleanupOnce);
    }
  };

  const flush = () => {
    if (activeLeaseCount > 0 || pendingRetirements.length === 0) return false;
    const retirements = pendingRetirements.splice(0, pendingRetirements.length);
    for (const retirement of retirements) scheduleRetirement(retirement);
    return true;
  };

  return {
    acquire() {
      activeLeaseCount += 1;
      let released = false;
      return () => {
        if (released) return false;
        released = true;
        activeLeaseCount = Math.max(0, activeLeaseCount - 1);
        flush();
        return true;
      };
    },
    retire({
      device = null,
      cleanup = null,
      submissionObserved = false,
      queueOrderedFinalConsumer = null,
      producerClaim = null,
      producerOutput = null,
      producerFamily = null
    } = {}) {
      if (typeof cleanup !== 'function') return false;
      const retirement = Object.freeze({
        device,
        cleanup,
        submissionObserved: submissionObserved === true,
        queueOrderedFinalConsumer,
        producerClaim,
        producerOutput,
        producerFamily
      });
      if (activeLeaseCount > 0) {
        pendingRetirements.push(retirement);
      } else {
        scheduleRetirement(retirement);
      }
      return true;
    },
    flush,
    get activeLeaseCount() {
      return activeLeaseCount;
    },
    get pendingRetirementCount() {
      return pendingRetirements.length;
    }
  };
}

export function resolveSchroederSceneHierarchyQueueOrderedTransfer({
  priorStep = null,
  currentResult = null,
  additionalProducerClaims = [],
  residentStepOptions = null,
  enableTwoLevelMechanics = false,
  enableMechanicsFieldPairV2 = false,
  enableCanonicalSingleLevelQueueOrderedCleanup = false,
  twoLevelMechanicsAuthority = 'observation',
  readbackMode = SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT
} = {}) {
  const exactTwoLevelQueueOrderedRoute = Boolean(
    enableTwoLevelMechanics
    && twoLevelMechanicsAuthority === 'authoritative'
    && readbackMode === RESIDENT_NO_FULL_READBACK_MODE
  );
  const exactCanonicalSingleLevelRoute = Boolean(
    enableCanonicalSingleLevelQueueOrderedCleanup
    && !enableTwoLevelMechanics
    && !enableMechanicsFieldPairV2
    && readbackMode === RESIDENT_NO_FULL_READBACK_MODE
    && (
      residentStepOptions == null
      || Object.keys(residentStepOptions).every((key) => (
        !key.endsWith('Runner')
        || residentStepOptions[key] == null
      ))
    )
  );
  const exactResidentQueueOrderedRoute = Boolean(
    exactTwoLevelQueueOrderedRoute
    || exactCanonicalSingleLevelRoute
  );
  const exactPairedCanonicalRoute = Boolean(
    exactTwoLevelQueueOrderedRoute
    && enableMechanicsFieldPairV2
  );
  const priorSingleLevelRouteIssued = Boolean(
    priorStep?.canonicalSingleLevelQueueOrderedCleanupEligible === true
  );
  const currentSingleLevelRouteIssued = Boolean(
    currentResult?.canonicalSingleLevelQueueOrderedCleanupEligible === true
  );
  const priorTransferEligible = Boolean(
    exactTwoLevelQueueOrderedRoute
    || (exactCanonicalSingleLevelRoute && priorSingleLevelRouteIssued)
  );
  const producerClaims = exactResidentQueueOrderedRoute
    ? [
        ...(
          priorTransferEligible
          && Array.isArray(
            priorStep?.schroederHierarchyArtifactTransferCleanupClaims
          )
            ? priorStep.schroederHierarchyArtifactTransferCleanupClaims
            : []
        ),
        ...(Array.isArray(additionalProducerClaims)
          ? additionalProducerClaims
          : [])
      ]
    : [];
  return Object.freeze({
    exactResidentQueueOrderedRoute,
    exactTwoLevelQueueOrderedRoute,
    exactCanonicalSingleLevelRoute,
    exactPairedCanonicalRoute,
    currentResultQueueOrderedCleanupEligible: Boolean(
      exactTwoLevelQueueOrderedRoute
      || (exactCanonicalSingleLevelRoute && currentSingleLevelRouteIssued)
    ),
    producerClaims: Object.freeze(producerClaims),
    finalConsumer:
      (
        exactTwoLevelQueueOrderedRoute
        || (exactCanonicalSingleLevelRoute && currentSingleLevelRouteIssued)
      )
        ? currentResult?.queueOrderedFinalConsumerCapability ?? null
        : null
  });
}

export function submitSchroederSceneTerminalCleanupBoundary({
  device = null,
  commandBuffers = [],
  finalConsumerOwner = null,
  producerClaims = []
} = {}) {
  if (!Array.isArray(commandBuffers) || commandBuffers.length === 0) {
    throw new TypeError(
      'scene terminal cleanup boundary requires nonempty useful command buffers'
    );
  }
  if (Array.isArray(producerClaims) && producerClaims.length > 0) {
    return submitQueueOrderedFinalConsumerWork(
      device,
      commandBuffers,
      {
        finalConsumerOwner,
        producerClaims
      }
    );
  }
  device.queue.submit(commandBuffers);
  return null;
}

export function mlsMpmAmbientPressureEvidenceSignature(evidence = null) {
  return [
    evidence?.schema ?? 'none',
    evidence?.status ?? 'none',
    evidence?.source ?? 'none',
    evidence?.pressureFeedbackSchema ?? 'none',
    evidence?.pressureFeedbackStatus ?? 'none'
  ].join(':');
}

function sceneStringList(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry ?? '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(',').map((entry) => entry.trim()).filter(Boolean);
  }
  return [];
}

function uniqueSceneStringList(values = []) {
  return [...new Set(sceneStringList(values))];
}

function scenePressureInterfaceSourceKeyRef(value) {
  const text = String(value || '').toLowerCase();
  const squashed = text.replace(/[^a-z0-9]/g, '');
  return text.includes('sph-interface-source-key')
    || text.includes('interface-source-key')
    || text.includes('source-key-buffer')
    || squashed.includes('interfacesourcekey')
    || squashed.includes('sourcekeybuffer');
}

function sceneSourceKeyCount(value, fallback = 0) {
  const number = finiteNumberOrNull(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : fallback;
}

function sourceKeyRefsFromSceneSources(...sources) {
  return uniqueSceneStringList(sources.flatMap((source) => [
    ...sceneStringList(source?.retainedSourceKeyBufferRefs),
    ...sceneStringList(source?.workerRetainedSourceKeyBufferRefs),
    ...sceneStringList(source?.retainedBufferRefs),
    ...sceneStringList(source?.workerRetainedBufferRefs),
    ...sceneStringList(source?.pressureInterfaceSourceKeyRetainedBufferRefs),
    ...sceneStringList(source?.pressureInterfaceSourceKeyWorkerRetainedBufferRefs)
  ])).filter(scenePressureInterfaceSourceKeyRef);
}

export function buildSchroederSourceKeyReplayDiagnostics({
  materialInterfaceField = null,
  pressureInterfaceState = null,
  pressureInterfaceForceSolver = null,
  pressureInterfaceWorkerCompactPublicationCandidate = null,
  pressureInterfaceWorkerCompactPublication = null,
  pressureInterfaceStageSummary = null
} = {}) {
  const materialField = materialInterfaceField
    || pressureInterfaceState?.materialInterfaceField
    || null;
  const solver = pressureInterfaceForceSolver
    || pressureInterfaceState?.pressureInterfaceForceSolver
    || null;
  const publicationCandidate = pressureInterfaceWorkerCompactPublicationCandidate
    || pressureInterfaceState?.pressureInterfaceWorkerCompactPublicationCandidate
    || null;
  const publication = pressureInterfaceWorkerCompactPublication
    || pressureInterfaceState?.pressureInterfaceWorkerCompactPublication
    || null;
  const stageSummary = pressureInterfaceStageSummary
    || pressureInterfaceState?.pressureInterfaceStageSummary
    || null;
  const sourceKeyRefs = sourceKeyRefsFromSceneSources(
    publicationCandidate,
    publication,
    stageSummary,
    pressureInterfaceState
  );
  const productionRowCount = sceneSourceKeyCount(
    materialField?.interfaceSourceKeyRowCount ?? materialField?.sourceKeyRowCount,
    0
  );
  const productionReadyCount = sceneSourceKeyCount(
    materialField?.interfaceSourceKeyReadyCount ?? materialField?.sourceKeyReadyCount,
    productionRowCount
  );
  const productionBufferRetained = Boolean(
    materialField?.interfaceSourceKeyBufferRetained
    || materialField?.sourceKeyBufferRetained
    || materialField?.interfaceSourceKeyBuffer
    || materialField?.sourceKeyBuffer
  );
  const productionStatus = materialField?.interfaceSourceKeyStatus
    ?? materialField?.sourceKeyStatus
    ?? null;
  const productionReady = productionReadyCount > 0
    && (productionBufferRetained || productionStatus === 'interface-source-key-retained');
  const solverRowCount = sceneSourceKeyCount(
    solver?.interfaceSourceKeyRowCount
      ?? pressureInterfaceState?.pressureInterfaceSourceKeyRowCount
      ?? stageSummary?.pressureInterfaceSourceKeyRowCount,
    0
  );
  const solverReadyCount = sceneSourceKeyCount(
    solver?.interfaceSourceKeyReadyCount
      ?? pressureInterfaceState?.pressureInterfaceSourceKeyReadyCount
      ?? stageSummary?.pressureInterfaceSourceKeyReadyCount,
    solverRowCount
  );
  const consumerObserved = Boolean(
    solver?.interfaceSourceKeyBufferObserved
    || pressureInterfaceState?.pressureInterfaceSourceKeyBufferObserved
    || stageSummary?.pressureInterfaceSourceKeyBufferObserved
  );
  const consumerConsumed = Boolean(
    solver?.interfaceSourceKeyBufferConsumed
    || pressureInterfaceState?.pressureInterfaceSourceKeyBufferConsumed
    || stageSummary?.pressureInterfaceSourceKeyBufferConsumed
  );
  const publicationReady = Boolean(
    publicationCandidate?.retainedSourceKeySourceReady
    || publication?.retainedSourceKeySourceReady
    || sourceKeyRefs.length > 0
  );
  const rowCountMatch = productionRowCount > 0 && solverRowCount > 0
    ? productionRowCount === solverRowCount
    : null;
  const replayReady = productionReady && (publicationReady || consumerObserved || consumerConsumed);
  const status = consumerConsumed
    ? 'schroeder-source-key-replay-consumed'
    : (consumerObserved
        ? 'schroeder-source-key-replay-consumer-observed'
        : (publicationReady
            ? 'schroeder-source-key-replay-retained-ref-published'
            : (productionReady
                ? 'schroeder-source-key-replay-produced'
                : 'schroeder-source-key-replay-unavailable')));
  return {
    schema: ULG_SPH_SCENE_SCHROEDER_SOURCE_KEY_REPLAY_DIAGNOSTICS_SCHEMA,
    status,
    replayReady,
    sourceKeySchema: materialField?.interfaceSourceKeySchema
      ?? solver?.interfaceSourceKeySchema
      ?? pressureInterfaceState?.pressureInterfaceSourceKeySchema
      ?? ULG_SPH_INTERFACE_SOURCE_KEY_SCHEMA,
    productionStatus,
    productionSourceFieldStatus: materialField?.interfaceSourceFieldSourceIndexStatus ?? null,
    productionSourceFieldBufferRetained:
      Boolean(materialField?.interfaceSourceFieldSourceIndexBufferRetained),
    productionBufferRetained,
    productionBufferByteLength: sceneSourceKeyCount(materialField?.interfaceSourceKeyBufferByteLength, 0),
    productionRowCount,
    productionReadyCount,
    productionStrideFloats: sceneSourceKeyCount(materialField?.interfaceSourceKeyStrideFloats, 0) || null,
    retainedRefPublicationStatus: publicationReady
      ? 'schroeder-source-key-retained-ref-published'
      : (productionReady
          ? 'blocked-source-key-retained-ref-publication-not-observed'
          : 'blocked-source-key-production-not-ready'),
    retainedRefPublicationReady: publicationReady,
    retainedSourceKeySourceStatus: publicationCandidate?.retainedSourceKeySourceStatus
      ?? publication?.retainedSourceKeySourceStatus
      ?? null,
    retainedBufferRefs: sourceKeyRefs,
    retainedBufferRefCount: sourceKeyRefs.length,
    pressureConsumerStatus: solver?.interfaceSourceKeyConsumerStatus
      ?? pressureInterfaceState?.pressureInterfaceSourceKeyConsumerStatus
      ?? stageSummary?.pressureInterfaceSourceKeyConsumerStatus
      ?? null,
    pressureConsumerObserved: consumerObserved,
    pressureConsumerConsumed: consumerConsumed,
    pressureConsumerRowCount: solverRowCount,
    pressureConsumerReadyCount: solverReadyCount,
    pressureConsumerSurfaceIndexFallbackEnabled:
      solver?.interfaceSourceKeySurfaceIndexFallbackEnabled
      ?? pressureInterfaceState?.pressureInterfaceSourceKeySurfaceIndexFallbackEnabled
      ?? materialField?.interfaceSourceKeySurfaceIndexFallbackEnabled
      ?? null,
    productionConsumerRowCountMatch: rowCountMatch,
    portablePayloadMode: 'descriptor-only-no-raw-gpubuffer',
    rawGpuBufferSerialized: false,
    hotPath: 'source-local-source-index-buffer-to-compact-source-key-sidecar-to-pressure-contact-kinematics',
    stateManagerAdmissionRequired: true,
    authoritativeStateMutation: false
  };
}

const PRESSURE_INTERFACE_GAS_CELL_IMPORT_GRAPH_KEYS = Object.freeze([
  'retainedGasCellFieldSource',
  'pressureInterfaceRetainedGasCellFieldSource',
  'pressureInterfaceGasCellFieldImport',
  'pressureInterfaceGasCellFieldAdmission',
  'gasCellFieldAdmission',
  'admission',
  'sourceSchroederFarAggregateGasCellImport'
]);

const PRESSURE_INTERFACE_GAS_CELL_IMPORT_ADMISSION_KEYS = Object.freeze([
  'pressureInterfaceGasCellFieldAdmission',
  'gasCellFieldAdmission',
  'admission'
]);

const PRESSURE_INTERFACE_GAS_CELL_IMPORT_GRAPH_LIMIT = 64;
const PRESSURE_INTERFACE_GAS_CELL_IMPORT_PROTOTYPE_LIMIT = 64;

const PRESSURE_INTERFACE_GAS_CELL_IMPORT_PRESSURE_ALIAS_KEYS = Object.freeze([
  'gasPressureCellsBuffer',
  'retainedGasPressureCellsBuffer',
  'pressureInterfaceGasPressureCellsBuffer'
]);

const PRESSURE_INTERFACE_GAS_CELL_IMPORT_CONTROL_ALIAS_KEYS = Object.freeze([
  'gasAuthorityControlBuffer',
  'retainedGasAuthorityControlBuffer',
  'pressureInterfaceGasAuthorityControlBuffer'
]);

const PRESSURE_INTERFACE_GAS_CELL_IMPORT_SCALAR_KEYS = Object.freeze([
  'schema',
  'status',
  'sourceSchema',
  'sourceStatus',
  'sourceSchroederFarAggregateGasCellImportSchema',
  'ready',
  'localPressureGradientReady',
  'localPressureGradientStatus',
  'retainedGasCellFieldSourceReady',
  'pressureInterfaceImportReady',
  'stateKey',
  'sourceTaskId',
  'deviceId',
  'sameDevice',
  'sourceHotBufferKey',
  'hotBufferKey',
  'sourceNodeId',
  'sourceStage',
  'pressureFieldMode',
  'pressureFieldResolution',
  'gasCellFieldConsumptionApproved',
  'pressureInterfaceGasPressureCellRowCount',
  'gasPressureCellRowCount',
  'pressureInterfaceGasPressureCellRowCapacity',
  'gasPressureCellRowCapacity',
  'pressureInterfaceGasPressureCellRowStrideFloats',
  'gasPressureCellRowStrideFloats',
  'pressureInterfaceGasPressureCellRowByteLength',
  'gasPressureCellRowByteLength',
  'pressureInterfaceGasPressureCellRowsBufferRetained',
  'gasPressureCellRowsBufferRetained',
  'retainedGasPressureBufferRefs',
  'workerRetainedGasPressureBufferRefs',
  'sourceFamilies',
  'gasCellFieldSnapshot',
  'gasCellField',
  'sourceSpatialGasLedger',
  'spatialGasLedgerEosExecution',
  'sourceSpatialGasLedgerGenerationId',
  'epochIdentity',
  'lifecycleStatus',
  'retainedGasCellFieldLifecycleStatus',
  'releaseStatus',
  'consumed',
  'released',
  'releaseScheduled',
  'terminal',
  'telemetryOnly',
  'bindable'
]);

const PRESSURE_INTERFACE_GAS_CELL_IMPORT_CAPTURE_KEYS = Object.freeze([
  ...new Set([
    ...PRESSURE_INTERFACE_GAS_CELL_IMPORT_GRAPH_KEYS,
    ...PRESSURE_INTERFACE_GAS_CELL_IMPORT_PRESSURE_ALIAS_KEYS,
    ...PRESSURE_INTERFACE_GAS_CELL_IMPORT_CONTROL_ALIAS_KEYS,
    ...PRESSURE_INTERFACE_GAS_CELL_IMPORT_SCALAR_KEYS
  ])
]);

const PRESSURE_INTERFACE_GAS_CELL_IMPORT_RETIRED_SCHEMAS = new Set([
  ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V2,
  ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V3,
  ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V4
]);

const pressureInterfaceExactAuthoritySignatureIds = new WeakMap();
let pressureInterfaceNextExactAuthoritySignatureId = 1;

export function pressureInterfaceExactAuthoritySignatureId(source) {
  if (!source || (typeof source !== 'object' && typeof source !== 'function')) {
    return 'missing';
  }
  let identity = pressureInterfaceExactAuthoritySignatureIds.get(source);
  if (identity == null) {
    identity = pressureInterfaceNextExactAuthoritySignatureId;
    pressureInterfaceNextExactAuthoritySignatureId += 1;
    pressureInterfaceExactAuthoritySignatureIds.set(source, identity);
  }
  return identity;
}

function pressureInterfaceGasCellFieldDescriptorSnapshot(
  descriptorCache,
  record,
  key
) {
  let properties = descriptorCache.get(record);
  if (!properties) {
    properties = new Map();
    descriptorCache.set(record, properties);
  }
  if (properties.has(key)) return properties.get(key);
  let descriptor;
  try {
    descriptor = Object.getOwnPropertyDescriptor(record, key);
  } catch (error) {
    const property = Object.freeze({
      present: false,
      accessor: false,
      value: undefined,
      enumerable: false,
      error
    });
    properties.set(key, property);
    return property;
  }
  const property = descriptor
    ? Object.freeze({
        present: true,
        accessor: !Object.hasOwn(descriptor, 'value'),
        value: Object.hasOwn(descriptor, 'value')
          ? descriptor.value
          : undefined,
        enumerable: descriptor.enumerable === true,
        error: null
      })
    : Object.freeze({
        present: false,
        accessor: false,
        value: undefined,
        enumerable: false,
        error: null
      });
  properties.set(key, property);
  return property;
}

function pressureInterfaceGasCellFieldPrototypeSchemas({
  descriptorCache,
  prototypeCache,
  record
}) {
  const schemas = [];
  const seen = new Set();
  let cursor = record;
  for (
    let depth = 0;
    depth < PRESSURE_INTERFACE_GAS_CELL_IMPORT_PROTOTYPE_LIMIT;
    depth += 1
  ) {
    let prototypeSnapshot = prototypeCache.get(cursor);
    if (!prototypeSnapshot) {
      let prototype = null;
      let error = null;
      try {
        prototype = Object.getPrototypeOf(cursor);
      } catch (cause) {
        error = cause;
      }
      prototypeSnapshot = Object.freeze({ prototype, error });
      prototypeCache.set(cursor, prototypeSnapshot);
    }
    if (prototypeSnapshot.error) {
      return Object.freeze({
        schemas: Object.freeze(schemas),
        issue: Object.freeze({
          kind: 'prototype-inspection',
          error: prototypeSnapshot.error
        })
      });
    }
    const prototype = prototypeSnapshot.prototype;
    if (!prototype) {
      return Object.freeze({
        schemas: Object.freeze(schemas),
        issue: null
      });
    }
    if (seen.has(prototype)) {
      return Object.freeze({
        schemas: Object.freeze(schemas),
        issue: Object.freeze({ kind: 'prototype-cycle', error: null })
      });
    }
    seen.add(prototype);
    schemas.push(Object.freeze({
      owner: prototype,
      property: pressureInterfaceGasCellFieldDescriptorSnapshot(
        descriptorCache,
        prototype,
        'schema'
      )
    }));
    cursor = prototype;
  }
  return Object.freeze({
    schemas: Object.freeze(schemas),
    issue: Object.freeze({ kind: 'prototype-limit', error: null })
  });
}

function pressureInterfaceGasCellFieldImportGraph(importDescriptor = null) {
  const pending = [];
  const scheduled = new Set();
  const records = [];
  const links = [];
  const byRecord = new Map();
  const descriptorCache = new WeakMap();
  const prototypeCache = new WeakMap();
  let graphInspectionFailed = false;
  let graphBoundExceeded = false;
  const enqueue = (record) => {
    if (
      !record
      || (typeof record !== 'object' && typeof record !== 'function')
      || scheduled.has(record)
    ) return;
    scheduled.add(record);
    pending.push(record);
  };
  enqueue(importDescriptor);
  while (pending.length > 0) {
    if (records.length >= PRESSURE_INTERFACE_GAS_CELL_IMPORT_GRAPH_LIMIT) {
      graphBoundExceeded = true;
      break;
    }
    const record = pending.shift();
    const descriptors = new Map();
    for (const key of PRESSURE_INTERFACE_GAS_CELL_IMPORT_CAPTURE_KEYS) {
      const property = pressureInterfaceGasCellFieldDescriptorSnapshot(
        descriptorCache,
        record,
        key
      );
      descriptors.set(key, property);
      if (property.error) graphInspectionFailed = true;
    }
    let exactAuthority = false;
    try {
      exactAuthority = isExactSphSpatialGasPressureAuthoritySource(record);
    } catch {
      graphInspectionFailed = true;
    }
    const prototypeSchemas = pressureInterfaceGasCellFieldPrototypeSchemas({
      descriptorCache,
      prototypeCache,
      record
    });
    if (prototypeSchemas.issue) graphInspectionFailed = true;
    const captured = Object.freeze({
      record,
      descriptors,
      exactAuthority,
      prototypeSchemas
    });
    records.push(captured);
    byRecord.set(record, captured);
    for (const key of PRESSURE_INTERFACE_GAS_CELL_IMPORT_GRAPH_KEYS) {
      const property = descriptors.get(key);
      if (property.error || property.accessor) {
        graphInspectionFailed = true;
        continue;
      }
      if (!property.present) continue;
      links.push(Object.freeze({ record, key, value: property.value }));
      enqueue(property.value);
    }
  }
  return Object.freeze({
    records: Object.freeze(records),
    links: Object.freeze(links),
    byRecord,
    descriptorCache,
    graphInspectionFailed,
    graphBoundExceeded
  });
}

function pressureInterfaceGasCellFieldCapturedProperty(graph, record, key) {
  return graph?.byRecord?.get(record)?.descriptors?.get(key) || null;
}

function pressureInterfaceGasCellFieldCapturedValue(graph, record, key) {
  const property = pressureInterfaceGasCellFieldCapturedProperty(
    graph,
    record,
    key
  );
  return property
    && !property.error
    && !property.accessor
    && property.present
    ? property.value
    : undefined;
}

function pressureInterfaceGasCellFieldImportGraphDataValue(graph, key) {
  for (const captured of graph?.records || []) {
    const value = pressureInterfaceGasCellFieldCapturedValue(
      graph,
      captured.record,
      key
    );
    if (value !== undefined && value !== null) return value;
  }
  return null;
}

function pressureInterfaceGasCellFieldImportSchemaObservation(graph) {
  const exactSources = [];
  const mutatedExactSources = [];
  const forgedCurrentSources = [];
  const retiredV2Sources = [];
  const retiredV3Sources = [];
  const retiredV4Sources = [];
  const schemaAccessorRecords = [];
  const inheritedProtectedSchemas = [];
  let prototypeInspectionFailed = false;
  for (const captured of graph?.records || []) {
    const property = captured.descriptors.get('schema');
    if (property?.error || property?.accessor) {
      schemaAccessorRecords.push(captured.record);
    }
    const schema = pressureInterfaceGasCellFieldCapturedValue(
      graph,
      captured.record,
      'schema'
    );
    if (captured.exactAuthority) {
      exactSources.push(captured.record);
      if (schema !== ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA) {
        mutatedExactSources.push(captured.record);
      }
    } else if (schema === ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA) {
      forgedCurrentSources.push(captured.record);
    } else if (schema === ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V2) {
      retiredV2Sources.push(captured.record);
    } else if (schema === ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V3) {
      retiredV3Sources.push(captured.record);
    } else if (schema === ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V4) {
      retiredV4Sources.push(captured.record);
    }
    if (captured.prototypeSchemas.issue) {
      prototypeInspectionFailed = true;
      continue;
    }
    for (const inherited of captured.prototypeSchemas.schemas) {
      const inheritedProperty = inherited.property;
      if (inheritedProperty.error || inheritedProperty.accessor) {
        schemaAccessorRecords.push(captured.record);
        continue;
      }
      if (!inheritedProperty.present) continue;
      if (
        inheritedProperty.value === ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA
        || PRESSURE_INTERFACE_GAS_CELL_IMPORT_RETIRED_SCHEMAS.has(
          inheritedProperty.value
        )
      ) {
        inheritedProtectedSchemas.push(Object.freeze({
          record: captured.record,
          owner: inherited.owner,
          schema: inheritedProperty.value
        }));
        if (
          inheritedProperty.value
            === ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA
        ) {
          forgedCurrentSources.push(captured.record);
        } else if (
          inheritedProperty.value
            === ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V2
        ) {
          retiredV2Sources.push(captured.record);
        } else if (inheritedProperty.value === ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V3) {
          retiredV3Sources.push(captured.record);
        } else {
          retiredV4Sources.push(captured.record);
        }
      }
    }
  }
  return Object.freeze({
    exactSources: Object.freeze([...new Set(exactSources)]),
    mutatedExactSources: Object.freeze([...new Set(mutatedExactSources)]),
    forgedCurrentSources: Object.freeze([...new Set(forgedCurrentSources)]),
    retiredV2Sources: Object.freeze([...new Set(retiredV2Sources)]),
    retiredV3Sources: Object.freeze([...new Set(retiredV3Sources)]),
    retiredV4Sources: Object.freeze([...new Set(retiredV4Sources)]),
    schemaAccessorRecords: Object.freeze([...new Set(schemaAccessorRecords)]),
    inheritedProtectedSchemas: Object.freeze(inheritedProtectedSchemas),
    prototypeInspectionFailed
  });
}

function pressureInterfaceGasCellFieldImportAliasObservation(graph) {
  const entries = [];
  for (const captured of graph?.records || []) {
    for (const key of [
      ...PRESSURE_INTERFACE_GAS_CELL_IMPORT_PRESSURE_ALIAS_KEYS,
      ...PRESSURE_INTERFACE_GAS_CELL_IMPORT_CONTROL_ALIAS_KEYS
    ]) {
      const property = captured.descriptors.get(key);
      if (!property?.present && !property?.error) continue;
      entries.push(Object.freeze({
        record: captured.record,
        key,
        pressureAlias:
          PRESSURE_INTERFACE_GAS_CELL_IMPORT_PRESSURE_ALIAS_KEYS.includes(key),
        controlAlias:
          PRESSURE_INTERFACE_GAS_CELL_IMPORT_CONTROL_ALIAS_KEYS.includes(key),
        accessor: property?.accessor === true,
        inspectionFailed: Boolean(property?.error),
        value: property?.accessor === true ? undefined : property?.value
      }));
    }
  }
  return Object.freeze({
    entries: Object.freeze(entries),
    anyPresent: entries.some((entry) => !entry.inspectionFailed),
    accessorObserved: entries.some((entry) => entry.accessor),
    inspectionFailed: entries.some((entry) => entry.inspectionFailed)
  });
}

function pressureInterfaceGasCellFieldImportAdmissionObservation(
  graph,
  exactAuthoritySource
) {
  const candidates = new Map();
  for (const link of graph?.links || []) {
    if (!PRESSURE_INTERFACE_GAS_CELL_IMPORT_ADMISSION_KEYS.includes(link.key)) {
      continue;
    }
    const admission = link.value;
    if (!graph.byRecord.has(admission)) continue;
    if (
      pressureInterfaceGasCellFieldCapturedValue(
        graph,
        admission,
        'schema'
      ) !== ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA
      || pressureInterfaceGasCellFieldCapturedValue(
        graph,
        admission,
        'status'
      ) !== 'pressure-interface-gas-cell-field-consumption-approved'
      || pressureInterfaceGasCellFieldCapturedValue(
        graph,
        admission,
        'gasCellFieldConsumptionApproved'
      ) !== true
    ) continue;
    candidates.set(admission, Object.freeze({
      admission,
      retainedGasCellFieldSource:
        pressureInterfaceGasCellFieldCapturedValue(
          graph,
          admission,
          'retainedGasCellFieldSource'
        )
    }));
  }
  const approvedAdmissions = [...candidates.values()];
  const sourceMatchedAdmissions = approvedAdmissions.filter((candidate) => (
    candidate.retainedGasCellFieldSource === exactAuthoritySource
  ));
  return Object.freeze({
    approvedAdmissions: Object.freeze(approvedAdmissions),
    sourceMatchedAdmissions: Object.freeze(sourceMatchedAdmissions),
    ambiguous: approvedAdmissions.length > 1,
    sourceMismatch: approvedAdmissions.some((candidate) => (
      candidate.retainedGasCellFieldSource !== exactAuthoritySource
    )),
    approved: Boolean(
      exactAuthoritySource
      && approvedAdmissions.length === 1
      && sourceMatchedAdmissions.length === 1
    )
  });
}

function pressureInterfaceGasCellFieldLegacySnapshot(graph, root) {
  if (!graph?.byRecord?.has(root)) {
    return Object.freeze({ value: null, captureFailed: true });
  }
  let captureFailed = false;
  const detachedEpochIdentities = new WeakMap();
  const detachedExecutions = new WeakMap();
  const detachedSpatialLedgers = new WeakMap();
  const detachedGasSnapshots = new WeakMap();
  const detachedArrays = new WeakMap();
  const property = (record, key) => (
    pressureInterfaceGasCellFieldDescriptorSnapshot(
      graph.descriptorCache,
      record,
      key
    )
  );
  const detachedArray = (value) => {
    if (!Array.isArray(value)) return value;
    if (detachedArrays.has(value)) return detachedArrays.get(value);
    const lengthProperty = property(value, 'length');
    if (
      lengthProperty.error
      || lengthProperty.accessor
      || !lengthProperty.present
      || !Number.isSafeInteger(lengthProperty.value)
      || lengthProperty.value < 0
      || lengthProperty.value > PRESSURE_INTERFACE_GAS_CELL_IMPORT_GRAPH_LIMIT * 1024
    ) {
      captureFailed = true;
      return null;
    }
    const output = new Array(lengthProperty.value);
    detachedArrays.set(value, output);
    for (let index = 0; index < lengthProperty.value; index += 1) {
      const entry = property(value, String(index));
      if (entry.error || entry.accessor) {
        captureFailed = true;
        continue;
      }
      if (entry.present) output[index] = entry.value;
    }
    return Object.freeze(output);
  };
  const detachedEpochIdentity = (value) => {
    if (!value || (typeof value !== 'object' && typeof value !== 'function')) {
      return value;
    }
    if (detachedEpochIdentities.has(value)) {
      return detachedEpochIdentities.get(value);
    }
    const output = {};
    detachedEpochIdentities.set(value, output);
    for (const field of SPH_SPATIAL_GAS_EPOCH_IDENTITY_FIELDS) {
      const fieldProperty = property(value, field);
      if (fieldProperty.error || fieldProperty.accessor) {
        captureFailed = true;
        continue;
      }
      if (fieldProperty.present) output[field] = fieldProperty.value;
    }
    return Object.freeze(output);
  };
  const detachedExecution = (value) => {
    if (!value || (typeof value !== 'object' && typeof value !== 'function')) {
      return value;
    }
    if (detachedExecutions.has(value)) return detachedExecutions.get(value);
    const output = {};
    detachedExecutions.set(value, output);
    for (const key of [
      'releaseStatus',
      'released',
      'releaseScheduled',
      'terminal'
    ]) {
      const executionProperty = property(value, key);
      if (executionProperty.error || executionProperty.accessor) {
        captureFailed = true;
        continue;
      }
      if (executionProperty.present) output[key] = executionProperty.value;
    }
    return Object.freeze(output);
  };
  const detachedSpatialLedger = (value) => {
    if (!value || (typeof value !== 'object' && typeof value !== 'function')) {
      return value;
    }
    if (detachedSpatialLedgers.has(value)) {
      return detachedSpatialLedgers.get(value);
    }
    const output = {};
    detachedSpatialLedgers.set(value, output);
    for (const key of [
      'spatialEpochGenerationId',
      'deviceId',
      'epochIdentity'
    ]) {
      const ledgerProperty = property(value, key);
      if (ledgerProperty.error || ledgerProperty.accessor) {
        captureFailed = true;
        continue;
      }
      if (!ledgerProperty.present) continue;
      output[key] = key === 'epochIdentity'
        ? detachedEpochIdentity(ledgerProperty.value)
        : ledgerProperty.value;
    }
    return Object.freeze(output);
  };
  const detachedGasSnapshot = (value) => {
    if (!value || (typeof value !== 'object' && typeof value !== 'function')) {
      return value;
    }
    if (detachedGasSnapshots.has(value)) {
      return detachedGasSnapshots.get(value);
    }
    const output = {};
    detachedGasSnapshots.set(value, output);
    for (const key of ['localPressureGradientReady', 'cells']) {
      const snapshotProperty = property(value, key);
      if (snapshotProperty.error || snapshotProperty.accessor) {
        captureFailed = true;
        continue;
      }
      if (!snapshotProperty.present) continue;
      output[key] = key === 'cells'
        ? detachedArray(snapshotProperty.value)
        : snapshotProperty.value;
    }
    return Object.freeze(output);
  };
  const detachedValue = (key, value) => {
    if (key === 'epochIdentity') return detachedEpochIdentity(value);
    if (key === 'sourceSpatialGasLedger') return detachedSpatialLedger(value);
    if (key === 'spatialGasLedgerEosExecution') {
      return detachedExecution(value);
    }
    if (key === 'gasCellFieldSnapshot' || key === 'gasCellField') {
      return detachedGasSnapshot(value);
    }
    if (
      key === 'retainedGasPressureBufferRefs'
      || key === 'workerRetainedGasPressureBufferRefs'
      || key === 'sourceFamilies'
    ) return detachedArray(value);
    return value;
  };
  const materialized = new Map();
  for (const captured of graph.records) {
    materialized.set(captured.record, Array.isArray(captured.record) ? [] : {});
  }
  for (const captured of graph.records) {
    const target = materialized.get(captured.record);
    for (const key of PRESSURE_INTERFACE_GAS_CELL_IMPORT_CAPTURE_KEYS) {
      const property = captured.descriptors.get(key);
      if (
        !property
        || property.error
        || !property.present
      ) continue;
      if (property.accessor) {
        captureFailed = true;
        continue;
      }
      const capturedValue = materialized.has(property.value)
        ? materialized.get(property.value)
        : detachedValue(key, property.value);
      Object.defineProperty(target, key, {
        configurable: true,
        enumerable: property.enumerable,
        writable: true,
        value: capturedValue
      });
    }
  }
  for (const target of materialized.values()) Object.freeze(target);
  return Object.freeze({
    value: captureFailed ? null : (materialized.get(root) || null),
    captureFailed
  });
}

function pressureInterfaceGasCellFieldInspectionStatus({
  graph,
  schemas,
  aliases,
  admission,
  telemetryWrapperObserved,
  legacyCaptureFailed,
  exactAuthorityReady
}) {
  if (graph.graphBoundExceeded) {
    return 'blocked-gas-pressure-import-graph-bound-exceeded';
  }
  if (graph.graphInspectionFailed || schemas.prototypeInspectionFailed) {
    return 'blocked-uninspectable-gas-pressure-import-graph';
  }
  if (schemas.exactSources.length > 1) {
    return 'blocked-ambiguous-exact-v4-gas-pressure-authority';
  }
  if (schemas.mutatedExactSources.length > 0) {
    return 'blocked-mutated-exact-v4-gas-pressure-authority';
  }
  if (schemas.forgedCurrentSources.length > 0) {
    return 'blocked-forged-v4-gas-pressure-authority';
  }
  if (schemas.retiredV3Sources.length > 0) {
    return 'blocked-retired-v3-gas-pressure-authority';
  }
  if (schemas.retiredV4Sources.length > 0) {
    return 'blocked-retired-v4-gas-pressure-authority';
  }
  if (schemas.retiredV2Sources.length > 0) {
    return 'blocked-retired-v2-gas-pressure-authority';
  }
  if (schemas.schemaAccessorRecords.length > 0) {
    return 'blocked-gas-pressure-authority-schema-accessor';
  }
  if (telemetryWrapperObserved) {
    return 'blocked-gas-pressure-authority-telemetry-wrapper';
  }
  if (aliases.inspectionFailed) {
    return 'blocked-uninspectable-gas-pressure-buffer-alias';
  }
  if (aliases.accessorObserved) {
    return 'blocked-gas-pressure-buffer-alias-accessor';
  }
  if (schemas.exactSources.length === 1 && aliases.anyPresent) {
    return 'blocked-exact-v4-gas-pressure-raw-or-control-alias';
  }
  if (schemas.exactSources.length === 1 && admission.ambiguous) {
    return 'blocked-ambiguous-exact-v4-gas-pressure-admission';
  }
  if (schemas.exactSources.length === 1 && admission.sourceMismatch) {
    return 'blocked-mismatched-exact-v4-gas-pressure-admission-source';
  }
  if (schemas.exactSources.length === 1 && !admission.approved) {
    return 'blocked-exact-v4-gas-pressure-admission-missing';
  }
  if (schemas.exactSources.length === 1) {
    return exactAuthorityReady
      ? 'exact-v4-gas-pressure-authority-ready'
      : 'blocked-exact-v4-gas-pressure-authority-unavailable';
  }
  if (legacyCaptureFailed) {
    return 'blocked-uninspectable-legacy-gas-pressure-import';
  }
  return 'legacy-gas-pressure-import-graph-safe';
}

function pressureInterfaceExactEpochIdentityMatches(
  actualEpochIdentity,
  expectedEpochIdentity
) {
  if (expectedEpochIdentity == null) return true;
  if (!actualEpochIdentity) return false;
  const ownDataValue = (record, field) => {
    if (!record || (typeof record !== 'object' && typeof record !== 'function')) {
      return undefined;
    }
    try {
      const descriptor = Object.getOwnPropertyDescriptor(record, field);
      return descriptor && Object.hasOwn(descriptor, 'value')
        ? descriptor.value
        : undefined;
    } catch {
      return undefined;
    }
  };
  for (const field of SPH_SPATIAL_GAS_EPOCH_IDENTITY_FIELDS) {
    if (
      ownDataValue(actualEpochIdentity, field)
      !== ownDataValue(expectedEpochIdentity, field)
    ) return false;
  }
  return true;
}

/**
 * Capture the known wrapper links and consumed scalars once, authenticate the
 * exact v4 identity, and derive its readiness exclusively from the producer's
 * private description record. Raw pressure/control aliases are inspected by
 * descriptor and reject an exact graph even when null or accessor-backed;
 * public lifecycle accessors are captured but never dereferenced.
 */
export function inspectExactSphSpatialGasPressureAuthorityImport(
  importDescriptor = null,
  {
    expectedDevice = null,
    expectedStateKey = null,
    expectedSourceTaskId = null,
    expectedDeviceId = null,
    expectedSpatialGasLedgerGenerationId = null,
    expectedEpochIdentity = null
  } = {}
) {
  const graph = pressureInterfaceGasCellFieldImportGraph(importDescriptor);
  const schemas = pressureInterfaceGasCellFieldImportSchemaObservation(graph);
  const aliases = pressureInterfaceGasCellFieldImportAliasObservation(graph);
  const exactAuthorityObserved = schemas.exactSources.length > 0;
  const exactAuthoritySource = schemas.exactSources.length === 1
    ? schemas.exactSources[0]
    : null;
  const admission = pressureInterfaceGasCellFieldImportAdmissionObservation(
    graph,
    exactAuthoritySource
  );
  const telemetryWrapperObserved = graph.records.some((captured) => (
    !captured.exactAuthority
    && (
      pressureInterfaceGasCellFieldCapturedValue(
        graph,
        captured.record,
        'schema'
      ) === ULG_SPH_GAS_PRESSURE_AUTHORITY_TELEMETRY_SCHEMA
      || pressureInterfaceGasCellFieldCapturedValue(
        graph,
        captured.record,
        'telemetryOnly'
      ) === true
      || pressureInterfaceGasCellFieldCapturedValue(
        graph,
        captured.record,
        'bindable'
      ) === false
    )
  ));
  const graphProtectedSchemaSafe = Boolean(
    schemas.mutatedExactSources.length === 0
    && schemas.forgedCurrentSources.length === 0
    && schemas.retiredV2Sources.length === 0
    && schemas.retiredV3Sources.length === 0
    && schemas.retiredV4Sources.length === 0
    && schemas.schemaAccessorRecords.length === 0
    && schemas.inheritedProtectedSchemas.length === 0
    && !schemas.prototypeInspectionFailed
  );
  const legacyGraphPreliminarilySafe = Boolean(
    !exactAuthorityObserved
    && !graph.graphInspectionFailed
    && !graph.graphBoundExceeded
    && graphProtectedSchemaSafe
    && !aliases.inspectionFailed
    && !aliases.accessorObserved
    && !telemetryWrapperObserved
  );
  const legacyCapture = legacyGraphPreliminarilySafe
    ? pressureInterfaceGasCellFieldLegacySnapshot(graph, importDescriptor)
    : Object.freeze({ value: null, captureFailed: false });
  const graphSafeForLegacyFallback = Boolean(
    legacyGraphPreliminarilySafe
    && !legacyCapture.captureFailed
    && legacyCapture.value
  );
  let description = null;
  if (exactAuthoritySource) {
    try {
      description = describeSphSpatialGasPressureAuthority(
        exactAuthoritySource,
        expectedDevice ? { device: expectedDevice } : {}
      );
    } catch {
      description = null;
    }
  }
  const pressureCellCapacity = Number.isSafeInteger(
    description?.pressureCellCapacity
  )
    ? description.pressureCellCapacity
    : 0;
  const pressureCellStrideFloats = Number.isSafeInteger(
    description?.pressureCellStrideFloats
  )
    ? description.pressureCellStrideFloats
    : 0;
  const admissionApproved = admission.approved;
  const actualStateKey =
    pressureInterfaceGasCellFieldImportGraphDataValue(graph, 'stateKey');
  const actualSourceTaskId =
    pressureInterfaceGasCellFieldImportGraphDataValue(graph, 'sourceTaskId');
  let authenticatedDeviceId = null;
  try {
    authenticatedDeviceId = expectedDevice ? webGpuDeviceId(expectedDevice) : null;
  } catch {
    authenticatedDeviceId = null;
  }
  const observedDeviceId =
    pressureInterfaceGasCellFieldImportGraphDataValue(graph, 'deviceId');
  const exactGraphReady = Boolean(
    exactAuthoritySource
    && schemas.exactSources.length === 1
    && !graph.graphInspectionFailed
    && !graph.graphBoundExceeded
    && graphProtectedSchemaSafe
    && !aliases.anyPresent
    && !aliases.inspectionFailed
    && !telemetryWrapperObserved
    && admissionApproved
    && !admission.ambiguous
    && !admission.sourceMismatch
  );
  const exactAuthorityReady = Boolean(
    exactGraphReady
    &&
    description?.schema === ULG_SPH_GAS_PRESSURE_AUTHORITY_TELEMETRY_SCHEMA
    && description.status === 'gas-pressure-authority-telemetry-only'
    && description.telemetryOnly === true
    && description.bindable === false
    && description.sourceSchema
      === ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA
    && description.sourceStatusObserved
      === 'retained-gas-cell-eos-source-submitted'
    && description.readyObserved === true
    && description.exactSourceObserved === true
    && description.deviceAuthenticated === true
    && description.releaseStatusObserved
      === 'spatial-gas-ledger-eos-retained-for-final-consumer'
    && description.releaseScheduledObserved === false
    && description.releasedObserved === false
    && description.terminalObserved === false
    && description.consumerBorrowedObserved === false
    && description.consumerSubmittedObserved === false
    && pressureCellCapacity > 0
    && pressureCellStrideFloats === 12
    && admissionApproved
    && (expectedStateKey == null || actualStateKey === expectedStateKey)
    && (
      expectedSourceTaskId == null
      || actualSourceTaskId === expectedSourceTaskId
    )
    && (
      expectedDeviceId == null
      || authenticatedDeviceId === expectedDeviceId
      || (!expectedDevice && observedDeviceId === expectedDeviceId)
    )
    && (
      expectedSpatialGasLedgerGenerationId == null
      || description.spatialGenerationId
        === expectedSpatialGasLedgerGenerationId
    )
    && pressureInterfaceExactEpochIdentityMatches(
      description.epochIdentity,
      expectedEpochIdentity
    )
  );
  const status = pressureInterfaceGasCellFieldInspectionStatus({
    graph,
    schemas,
    aliases,
    admission,
    telemetryWrapperObserved,
    legacyCaptureFailed: legacyCapture.captureFailed,
    exactAuthorityReady
  });
  return Object.freeze({
    status,
    blocker: exactAuthorityReady || graphSafeForLegacyFallback ? null : status,
    exactAuthorityObserved,
    exactAuthorityReady,
    exactAuthoritySource,
    exactAuthorityDescription: description,
    pressureInterfaceGasPressureCellRowCount: 0,
    pressureInterfaceGasPressureCellRowCapacity: pressureCellCapacity,
    pressureInterfaceGasPressureCellRowStrideFloats: pressureCellStrideFloats,
    admissionApproved,
    admissionAmbiguous: admission.ambiguous,
    admissionSourceMismatch: admission.sourceMismatch,
    exactAuthorityAmbiguous: schemas.exactSources.length > 1,
    exactAuthorityMutated: schemas.mutatedExactSources.length > 0,
    forgedV4AuthorityObserved: schemas.forgedCurrentSources.length > 0,
    retiredV2AuthorityObserved: schemas.retiredV2Sources.length > 0,
    retiredV3AuthorityObserved: schemas.retiredV3Sources.length > 0,
    retiredV4AuthorityObserved: schemas.retiredV4Sources.length > 0,
    inheritedProtectedSchemaObserved:
      schemas.inheritedProtectedSchemas.length > 0,
    schemaAccessorObserved: schemas.schemaAccessorRecords.length > 0,
    rawOrControlAliasObserved: aliases.anyPresent,
    rawOrControlAliasAccessorObserved: aliases.accessorObserved,
    telemetryWrapperObserved,
    legacyCaptureFailed: legacyCapture.captureFailed,
    graphInspectionFailed: graph.graphInspectionFailed,
    graphBoundExceeded: graph.graphBoundExceeded,
    graphSafeForLegacyFallback,
    legacyImportDescriptor: graphSafeForLegacyFallback
      ? legacyCapture.value
      : null
  });
}

export function pressureInterfaceGasCellFieldImportBuffer(importDescriptor = null) {
  const inspection = inspectExactSphSpatialGasPressureAuthorityImport(
    importDescriptor
  );
  if (
    inspection.exactAuthorityObserved
    || !inspection.graphSafeForLegacyFallback
  ) return null;
  const legacyImportDescriptor = inspection.legacyImportDescriptor;
  return legacyImportDescriptor?.gasPressureCellsBuffer
    || legacyImportDescriptor?.pressureInterfaceGasPressureCellsBuffer
    || legacyImportDescriptor?.retainedGasPressureCellsBuffer
    || null;
}

function pressureInterfaceGasCellFieldImportRowsRetained(importDescriptor = null) {
  return Boolean(
    importDescriptor?.pressureInterfaceGasPressureCellRowsBufferRetained === true
      || importDescriptor?.gasPressureCellRowsBufferRetained === true
      || importDescriptor?.retainedGasCellFieldSource?.pressureInterfaceGasPressureCellRowsBufferRetained === true
  );
}

export const SPH_SPATIAL_GAS_EPOCH_IDENTITY_FIELDS = Object.freeze([
  'storageGeneration',
  'physicsTick',
  'physicsSubstep',
  'positionEpoch',
  'topologyEpoch',
  'chartEpoch',
  'levelEpoch',
  'supportEpoch'
]);

export function pressureInterfaceRetainedGasCellSource(importDescriptor = null) {
  const inspection = inspectExactSphSpatialGasPressureAuthorityImport(
    importDescriptor
  );
  if (
    inspection.exactAuthorityObserved
    || !inspection.graphSafeForLegacyFallback
  ) return null;
  const legacyImportDescriptor = inspection.legacyImportDescriptor;
  return legacyImportDescriptor?.retainedGasCellFieldSource
    || legacyImportDescriptor?.pressureInterfaceGasCellFieldAdmission?.retainedGasCellFieldSource
    || legacyImportDescriptor?.admission?.retainedGasCellFieldSource
    || null;
}

export function pressureInterfaceGasCellFieldImportEpochIdentity(importDescriptor = null) {
  const source = pressureInterfaceRetainedGasCellSource(importDescriptor);
  return source?.sourceSpatialGasLedger?.epochIdentity
    || source?.epochIdentity
    || importDescriptor?.epochIdentity
    || null;
}

export function pressureInterfaceGasCellFieldImportGenerationId(importDescriptor = null) {
  const source = pressureInterfaceRetainedGasCellSource(importDescriptor);
  return source?.sourceSpatialGasLedgerGenerationId
    ?? source?.sourceSpatialGasLedger?.spatialEpochGenerationId
    ?? importDescriptor?.sourceSpatialGasLedgerGenerationId
    ?? null;
}

function pressureInterfaceGasCellFieldImportWorkerRef(value = null) {
  return value?.schema === 'peercompute.ulg.worker-retained-buffer-ref.v0';
}

function pressureInterfaceGasCellFieldImportLifecycleAvailable(importDescriptor = null) {
  const source = pressureInterfaceRetainedGasCellSource(importDescriptor);
  const execution = importDescriptor?.spatialGasLedgerEosExecution
    || source?.spatialGasLedgerEosExecution
    || null;
  const statuses = [
    importDescriptor?.lifecycleStatus,
    importDescriptor?.retainedGasCellFieldLifecycleStatus,
    source?.lifecycleStatus,
    source?.releaseStatus,
    execution?.releaseStatus
  ].filter(Boolean).map((value) => String(value).toLowerCase());
  return Boolean(
    importDescriptor?.consumed !== true
    && importDescriptor?.released !== true
    && importDescriptor?.releaseScheduled !== true
    && source?.consumed !== true
    && source?.released !== true
    && source?.releaseScheduled !== true
    && execution?.released !== true
    && execution?.releaseScheduled !== true
    && !statuses.some((status) => (
      status.includes('released')
      || status.includes('release-scheduled')
      || status.includes('consumed')
      || status.includes('terminal')
      || status.includes('quarantined')
    ))
  );
}

function pressureInterfaceGasCellFieldImportExactIdentityMatches(importDescriptor = null, {
  expectedStateKey = null,
  expectedSourceTaskId = null,
  expectedDeviceId = null,
  expectedSpatialGasLedgerGenerationId = null,
  expectedEpochIdentity = null
} = {}) {
  const retainedSource = pressureInterfaceRetainedGasCellSource(importDescriptor);
  const actualStateKey = importDescriptor?.stateKey
    || retainedSource?.stateKey
    || null;
  const actualSourceTaskId = importDescriptor?.sourceTaskId
    || retainedSource?.sourceTaskId
    || null;
  const actualDeviceId = importDescriptor?.deviceId
    || retainedSource?.deviceId
    || null;
  if (expectedStateKey != null && actualStateKey !== expectedStateKey) return false;
  if (expectedSourceTaskId != null && actualSourceTaskId !== expectedSourceTaskId) return false;
  if (expectedDeviceId != null && actualDeviceId !== expectedDeviceId) return false;
  if (
    expectedSpatialGasLedgerGenerationId != null
    && pressureInterfaceGasCellFieldImportGenerationId(importDescriptor)
      !== expectedSpatialGasLedgerGenerationId
  ) return false;
  if (expectedEpochIdentity != null) {
    const actualEpochIdentity = pressureInterfaceGasCellFieldImportEpochIdentity(importDescriptor);
    if (!actualEpochIdentity) return false;
    for (const field of SPH_SPATIAL_GAS_EPOCH_IDENTITY_FIELDS) {
      if (actualEpochIdentity[field] !== expectedEpochIdentity[field]) return false;
    }
  }
  return true;
}

export function pressureInterfaceGasCellFieldImportReadyForScene(importDescriptor = null, {
  expectedDevice = null,
  expectedStateKey = null,
  expectedSourceTaskId = null,
  expectedDeviceId = null,
  expectedSpatialGasLedgerGenerationId = null,
  expectedEpochIdentity = null
} = {}) {
  const exactAuthority = inspectExactSphSpatialGasPressureAuthorityImport(
    importDescriptor,
    {
      expectedDevice,
      expectedStateKey,
      expectedSourceTaskId,
      expectedDeviceId,
      expectedSpatialGasLedgerGenerationId,
      expectedEpochIdentity
    }
  );
  if (exactAuthority.exactAuthorityObserved) {
    return exactAuthority.exactAuthorityReady;
  }
  if (!exactAuthority.graphSafeForLegacyFallback) return false;
  importDescriptor = exactAuthority.legacyImportDescriptor;
  const importSchema = importDescriptor?.schema;
  const importStatus = importDescriptor?.status;
  if (!importSchema) return false;
  const legacyRetainedSource = pressureInterfaceRetainedGasCellSource(
    importDescriptor
  );
  let legacyExpectedDeviceId = expectedDeviceId;
  if (
    legacyExpectedDeviceId == null
    && expectedDevice
    && legacyRetainedSource?.schema
      === ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V1
  ) {
    try {
      legacyExpectedDeviceId = webGpuDeviceId(expectedDevice);
    } catch {
      return false;
    }
  }
  if (!pressureInterfaceGasCellFieldImportLifecycleAvailable(importDescriptor)) return false;
  if (!pressureInterfaceGasCellFieldImportExactIdentityMatches(importDescriptor, {
    expectedStateKey,
    expectedSourceTaskId,
    expectedDeviceId: legacyExpectedDeviceId,
    expectedSpatialGasLedgerGenerationId,
    expectedEpochIdentity
  })) return false;
  if (
    importSchema === ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_IMPORT_SCHEMA
    && importStatus === 'pressure-interface-gas-cell-field-import-ready'
  ) {
    const admission = importDescriptor.pressureInterfaceGasCellFieldAdmission
      || importDescriptor.admission
      || null;
    const admissionApproved = admission?.schema === ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA
      && admission?.status === 'pressure-interface-gas-cell-field-consumption-approved'
      && admission?.gasCellFieldConsumptionApproved === true;
    if (!admissionApproved) return false;
    const snapshot = importDescriptor.gasCellFieldSnapshot
      || importDescriptor.gasCellField
      || null;
    const snapshotReady = snapshot?.localPressureGradientReady === true
      && Array.isArray(snapshot?.cells)
      && snapshot.cells.length > 0;
    const retainedSource = pressureInterfaceRetainedGasCellSource(importDescriptor);
    const buffer = pressureInterfaceGasCellFieldImportBuffer(importDescriptor)
      || retainedSource?.gasPressureCellsBuffer
      || retainedSource?.retainedGasPressureCellsBuffer
      || retainedSource?.pressureInterfaceGasPressureCellsBuffer
      || null;
    const rowCount = Math.max(0, Math.round(Number(
      importDescriptor.pressureInterfaceGasPressureCellRowCount
        ?? retainedSource?.pressureInterfaceGasPressureCellRowCount
    ) || 0));
    const rowStrideFloats = Math.max(0, Math.round(Number(
      importDescriptor.pressureInterfaceGasPressureCellRowStrideFloats
        ?? retainedSource?.pressureInterfaceGasPressureCellRowStrideFloats
    ) || 0));
    const retainedV1Ready = retainedSource?.schema === ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V1
      && retainedSource.status === 'retained-gas-cell-eos-source-submitted'
      && retainedSource.ready === true
      && retainedSource.localPressureGradientReady === true
      && importDescriptor.sameDevice !== false
      && !pressureInterfaceGasCellFieldImportWorkerRef(buffer)
      && Boolean(buffer)
      && rowCount > 0
      && rowStrideFloats === 12
      && pressureInterfaceGasCellFieldImportRowsRetained(importDescriptor);
    return snapshotReady || retainedV1Ready;
  }
  if (
    importSchema !== ULG_SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_EXECUTION_SCHEMA
    && importSchema !== ULG_SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_SCHEMA
  ) {
    return false;
  }
  const rowCount = Math.max(0, Math.round(Number(
    importDescriptor.pressureInterfaceGasPressureCellRowCount
      ?? importDescriptor.gasPressureCellRowCount
  ) || 0));
  return Boolean(
    importStatus === 'schroeder-far-aggregate-gas-cell-import-submitted'
      && importDescriptor.pressureInterfaceImportReady === true
      && rowCount > 0
      && pressureInterfaceGasCellFieldImportBuffer(importDescriptor)
      && pressureInterfaceGasCellFieldImportRowsRetained(importDescriptor)
  );
}

function schroederGasCellImportCandidateFromValue(value = null) {
  const source = value?.result || value;
  if (
    source?.schema !== ULG_SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_EXECUTION_SCHEMA
    && source?.schema !== ULG_SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_SCHEMA
  ) {
    return null;
  }
  if (!pressureInterfaceGasCellFieldImportReadyForScene(source)) return null;
  return source;
}

export function selectSchroederPressureInterfaceGasCellFieldImportFromResidentExecution(execution = null) {
  const retainedSteps = Array.isArray(execution?.retainedSteps) ? execution.retainedSteps : [];
  const candidates = [
    execution?.finalStep?.schroederFarAggregateGasCellImport,
    execution?.schroederFarAggregateGasCellImport,
    execution?.farAggregateGasCellImport,
    execution?.schroederSameLevelMechanics?.farAggregateGasCellImport,
    ...retainedSteps.slice().reverse().map((step) => step?.schroederFarAggregateGasCellImport)
  ];
  for (const candidate of candidates) {
    const source = schroederGasCellImportCandidateFromValue(candidate);
    if (source) return source;
  }
  return null;
}

function schroederGasCellTransferOwnerFromResidentExecution(execution, gasPressureCellsBuffer) {
  if (!gasPressureCellsBuffer) return null;
  const retainedSteps = Array.isArray(execution?.retainedSteps) ? execution.retainedSteps : [];
  const candidates = [execution?.finalStep, execution, ...retainedSteps.slice().reverse()];
  for (const candidate of candidates) {
    if (typeof candidate?.releaseSchroederHierarchyArtifactTransfers !== 'function') continue;
    const importDescriptor = candidate?.schroederFarAggregateGasCellImport?.result
      || candidate?.schroederFarAggregateGasCellImport
      || candidate?.farAggregateGasCellImport?.result
      || candidate?.farAggregateGasCellImport
      || null;
    if (pressureInterfaceGasCellFieldImportBuffer(importDescriptor) === gasPressureCellsBuffer) {
      return candidate;
    }
  }
  return null;
}

export function buildSchroederPressureInterfaceGasCellFieldImportPublicationFromResidentExecution({
  execution = null,
  source = 'resident-steps-schroeder-pressure-interface-gas-cell-import-promotion',
  sourceCadence = 'resident-step-completed'
} = {}) {
  const schroederImport = selectSchroederPressureInterfaceGasCellFieldImportFromResidentExecution(execution);
  if (!schroederImport) return null;
  const retainedGasCellFieldSource = schroederImport.retainedGasCellFieldSource || null;
  const retainedGasPressureBufferRefs = uniqueSceneStringList([
    ...sceneStringList(schroederImport.retainedGasPressureBufferRefs),
    ...sceneStringList(retainedGasCellFieldSource?.retainedGasPressureBufferRefs)
  ]);
  const workerRetainedGasPressureBufferRefs = uniqueSceneStringList([
    ...sceneStringList(schroederImport.workerRetainedGasPressureBufferRefs),
    ...sceneStringList(retainedGasCellFieldSource?.workerRetainedGasPressureBufferRefs)
  ]);
  const rowCount = Math.max(0, Math.round(Number(
    schroederImport.pressureInterfaceGasPressureCellRowCount
      ?? schroederImport.gasPressureCellRowCount
  ) || 0));
  const rowStrideFloats = Math.max(0, Math.round(Number(
    schroederImport.pressureInterfaceGasPressureCellRowStrideFloats
      ?? schroederImport.gasPressureCellRowStrideFloats
  ) || 0));
  const rowByteLength = Math.max(0, Math.round(Number(
    schroederImport.pressureInterfaceGasPressureCellRowByteLength
      ?? schroederImport.gasPressureCellRowByteLength
      ?? (rowCount * rowStrideFloats * Float32Array.BYTES_PER_ELEMENT)
  ) || 0));
  const gasPressureCellsBuffer = pressureInterfaceGasCellFieldImportBuffer(schroederImport);
  const sourceTaskId = schroederImport.sourceTaskId
    || execution?.computeManagerTask?.acceptedTaskId
    || execution?.commitDelta?.taskId
    || null;
  const sourceHotBufferKey = schroederImport.sourceHotBufferKey
    || schroederImport.hotBufferKey
    || retainedGasCellFieldSource?.sourceHotBufferKey
    || execution?.sameDeviceRetainedBufferImport?.sourceHotBufferKey
    || execution?.sameDeviceHotBufferSourcePublication?.hotBufferKey
    || null;
  const pressureInterfaceGasCellFieldAdmission = schroederImport.pressureInterfaceGasCellFieldAdmission
    || schroederImport.admission
    || {
      schema: ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA,
      status: 'pressure-interface-gas-cell-field-consumption-approved',
      gasCellFieldConsumptionApproved: true,
      sourceSchema: schroederImport.schema,
      sourceHotBufferKey,
      sourceTaskId,
      sourceStage: schroederImport.sourceStage
        || retainedGasCellFieldSource?.sourceStage
        || 'schroederFarAggregateGasCellImport',
      retainedGasPressureBufferRefs,
      workerRetainedGasPressureBufferRefs,
      retainedGasCellFieldSource,
      pressureInterfaceGasPressureCellRowCount: rowCount,
      pressureInterfaceGasPressureCellRowStrideFloats: rowStrideFloats,
      pressureInterfaceGasPressureCellRowByteLength: rowByteLength,
      stateManagerAdmitted: true,
      authoritativeStateMutation: false
    };
  const pressureInterfaceGasCellFieldImport = {
    ...schroederImport,
    schema: ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_IMPORT_SCHEMA,
    status: 'pressure-interface-gas-cell-field-import-ready',
    sourceSchema: schroederImport.schema,
    sourceStatus: schroederImport.status,
    sourceHotBufferKey,
    sourceTaskId,
    sourceNodeId: schroederImport.sourceNodeId || 'ulg-schroeder-far-aggregate-gas-cell-import',
    sourceStage: schroederImport.sourceStage
      || retainedGasCellFieldSource?.sourceStage
      || 'schroederFarAggregateGasCellImport',
    retainedGasPressureBufferRefs,
    workerRetainedGasPressureBufferRefs,
    gasPressureCellsBuffer,
    pressureInterfaceGasPressureCellsBuffer: gasPressureCellsBuffer,
    retainedGasPressureCellsBuffer: gasPressureCellsBuffer,
    gasPressureCellRowsBufferRetained: true,
    pressureInterfaceGasPressureCellRowsBufferRetained: true,
    pressureInterfaceGasPressureCellRowCount: rowCount,
    pressureInterfaceGasPressureCellRowStrideFloats: rowStrideFloats,
    pressureInterfaceGasPressureCellRowByteLength: rowByteLength,
    retainedGasCellFieldSource,
    pressureInterfaceGasCellFieldAdmission,
    pressureFieldMode: schroederImport.pressureFieldMode || 'local-gas-cell-pressure-gradient',
    pressureFieldResolution: schroederImport.pressureFieldResolution || 'structured-gas-cell-grid',
    sourceSchroederFarAggregateGasCellImport: schroederImport,
    sourceSchroederFarAggregateGasCellImportSchema: schroederImport.schema,
    sourceSchroederFarAggregateGasCellImportStatus: schroederImport.status,
    stateManagerAdmissionRequired: true,
    authoritativeStateMutation: false
  };
  const publication = {
    schema: 'peercompute.ulg.sph-scene-pressure-interface-gas-cell-field-import-publication.v0',
    status: 'schroeder-pressure-interface-gas-cell-field-import-promoted',
    blocker: null,
    source,
    sourceCadence,
    publication: null,
    hotBufferKey: sourceHotBufferKey,
    committed: false,
    pressureInterfaceGasCellFieldImport,
    pressureInterfaceGasCellFieldImportReady: true,
    pressureInterfaceGasCellFieldImportSchema: pressureInterfaceGasCellFieldImport.schema,
    pressureInterfaceGasCellFieldImportStatus: pressureInterfaceGasCellFieldImport.status,
    pressureInterfaceGasCellFieldImportSourceHotBufferKey: sourceHotBufferKey,
    pressureInterfaceGasCellFieldAdmission,
    pressureInterfaceGasCellFieldAdmissionSchema: pressureInterfaceGasCellFieldAdmission.schema,
    pressureInterfaceGasCellFieldAdmissionStatus: pressureInterfaceGasCellFieldAdmission.status,
    pressureInterfaceGasCellFieldAdmissionApproved: true,
    retainedGasPressureBufferRefs,
    workerRetainedGasPressureBufferRefs,
    retainedGasPressureBufferRefCount: retainedGasPressureBufferRefs.length,
    workerRetainedGasPressureBufferRefCount: workerRetainedGasPressureBufferRefs.length,
    pressureInterfaceGasPressureCellRowCount: rowCount,
    pressureInterfaceGasPressureCellRowStrideFloats: rowStrideFloats,
    pressureInterfaceGasPressureCellRowByteLength: rowByteLength,
    schroederFarAggregateGasCellImportSchema: schroederImport.schema,
    schroederFarAggregateGasCellImportStatus: schroederImport.status,
    authoritativeStateMutation: false,
    stateManagerAdmissionRequired: true,
    scientificValidation: false,
    gasValidation: false,
    sphValidation: false,
    fullPhysicsValidation: false
  };
  const transferOwner = schroederGasCellTransferOwnerFromResidentExecution(
    execution,
    gasPressureCellsBuffer
  );
  if (transferOwner) {
    let released = false;
    Object.defineProperty(publication, 'releaseSchroederGasCellTransfer', {
      enumerable: false,
      value: ({
        reason = 'persistent-pressure-gas-cell-owner-released',
        queueOrderedFinalConsumer = null
      } = {}) => {
        if (released) return false;
        const releaseOptions = {
          transferClass: 'next-tick',
          families: 'far-aggregate-gas-cell-import',
          reason,
          submitted: true
        };
        if (queueOrderedFinalConsumer != null) {
          releaseOptions.queueOrderedFinalConsumer =
            queueOrderedFinalConsumer;
        }
        transferOwner.releaseSchroederHierarchyArtifactTransfers(
          releaseOptions
        );
        released = true;
        return true;
      }
    });
  }
  return publication;
}

function pressureInterfaceGasCellFieldFromSummary(gasPressureSummary = null) {
  const pressureFeedback = pressureFeedbackFromGasPressureSummary(gasPressureSummary);
  return pressureFeedback?.gasCellField
    || gasPressureSummary?.gasCellField
    || gasPressureSummary?.localGasCellField
    || null;
}

function pressureInterfaceGasCellFieldFromProducerResult(producerResult = null) {
  return producerResult?.gasCellFieldSnapshot
    || producerResult?.gasCellField
    || producerResult?.pressureFeedback?.gasCellField
    || null;
}

export function pressureInterfaceSpatialGasSpeciesLedgerFromSummary(gasPressureSummary = null) {
  const pressureFeedback = pressureFeedbackFromGasPressureSummary(gasPressureSummary);
  return gasPressureSummary?.spatialGasSpeciesLedger
    || pressureFeedback?.spatialGasSpeciesLedger
    || gasPressureSummary?.gasCellField?.spatialGasSpeciesLedger
    || null;
}

export function pressureInterfaceSpatialGasSpeciesLedgerReady(spatialGasSpeciesLedger = null) {
  return spatialGasSpeciesLedger?.schema === 'peercompute.ulg.sph-spatial-gas-species-ledger.v0'
    && Array.isArray(spatialGasSpeciesLedger.cells)
    && spatialGasSpeciesLedger.cells.length > 0;
}

function pressureInterfaceRetainedGasCellFieldSourceFromProducerResult(producerResult = null) {
  return producerResult?.retainedGasCellFieldSource
    || producerResult?.pressureInterfaceGasCellFieldImport?.retainedGasCellFieldSource
    || producerResult?.pressureInterfaceGasCellFieldAdmission?.retainedGasCellFieldSource
    || null;
}

function pressureInterfaceGasCellFieldAdmissionFromSummary(gasPressureSummary = null, explicitAdmission = null) {
  const pressureFeedback = pressureFeedbackFromGasPressureSummary(gasPressureSummary);
  return explicitAdmission
    || gasPressureSummary?.pressureInterfaceGasCellFieldAdmission
    || gasPressureSummary?.gasCellFieldAdmission
    || pressureFeedback?.pressureInterfaceGasCellFieldAdmission
    || pressureFeedback?.gasCellFieldAdmission
    || pressureInterfaceGasCellFieldFromSummary(gasPressureSummary)?.pressureInterfaceGasCellFieldAdmission
    || null;
}

function retainedGasPressureRefsFromSummary(gasPressureSummary = null) {
  const pressureFeedback = pressureFeedbackFromGasPressureSummary(gasPressureSummary);
  const gasCellField = pressureInterfaceGasCellFieldFromSummary(gasPressureSummary);
  return uniqueSceneStringList([
    ...sceneStringList(gasPressureSummary?.retainedGasPressureBufferRefs),
    ...sceneStringList(gasPressureSummary?.residentGasPressureBufferRefs),
    ...sceneStringList(gasPressureSummary?.pressureInterfaceRetainedGasPressureBufferRefs),
    ...sceneStringList(pressureFeedback?.retainedGasPressureBufferRefs),
    ...sceneStringList(pressureFeedback?.residentGasPressureBufferRefs),
    ...sceneStringList(gasCellField?.retainedGasPressureBufferRefs),
    ...sceneStringList(gasCellField?.residentGasPressureBufferRefs)
  ]);
}

function retainedGasPressureRefsFromProducerResult(producerResult = null) {
  const retainedSource = pressureInterfaceRetainedGasCellFieldSourceFromProducerResult(producerResult);
  return uniqueSceneStringList([
    ...sceneStringList(producerResult?.retainedGasPressureBufferRefs),
    ...sceneStringList(producerResult?.residentGasPressureBufferRefs),
    ...sceneStringList(retainedSource?.retainedGasPressureBufferRefs)
  ]);
}

function workerRetainedGasPressureRefsFromSummary(gasPressureSummary = null) {
  const pressureFeedback = pressureFeedbackFromGasPressureSummary(gasPressureSummary);
  const gasCellField = pressureInterfaceGasCellFieldFromSummary(gasPressureSummary);
  return uniqueSceneStringList([
    ...sceneStringList(gasPressureSummary?.workerRetainedGasPressureBufferRefs),
    ...sceneStringList(pressureFeedback?.workerRetainedGasPressureBufferRefs),
    ...sceneStringList(gasCellField?.workerRetainedGasPressureBufferRefs)
  ]);
}

function workerRetainedGasPressureRefsFromProducerResult(producerResult = null) {
  const retainedSource = pressureInterfaceRetainedGasCellFieldSourceFromProducerResult(producerResult);
  return uniqueSceneStringList([
    ...sceneStringList(producerResult?.workerRetainedGasPressureBufferRefs),
    ...sceneStringList(retainedSource?.workerRetainedGasPressureBufferRefs)
  ]);
}

function gasCellEosProducerResultFromSubmission(submission = null) {
  return submission?.result
    || submission?.taskResult
    || submission?.execution
    || submission?.value
    || submission
    || null;
}

function spatialGasLedgerProducerResultFromSubmission(submission = null) {
  return submission?.result
    || submission?.taskResult
    || submission?.execution
    || submission?.value
    || submission
    || null;
}

export async function submitSceneSpatialGasLedgerProducerStageForPressureInterface({
  residentAuthorityHost = null,
  gasPressureSummary = null,
  residentProductMass = null,
  reactionSummary = null,
  reactionTable = null,
  preferWebGpu = true,
  navigatorRef = null,
  device = null,
  deviceResult = null,
  readbackMode = RESIDENT_NO_FULL_READBACK_MODE,
  cacheKey = null,
  stateKey = null,
  source = 'resident-pressure-interface-physics-refresh',
  sourceCadence = null,
  sourceTaskId = null,
  sourceStage = 'residentProductMass',
  boxDimsM = null
} = {}) {
  const existingLedger = pressureInterfaceSpatialGasSpeciesLedgerFromSummary(gasPressureSummary);
  const productEventRowCount = Math.max(0, Math.round(Number(
    residentProductMass?.productEventRowCount ?? reactionSummary?.productEventRowCount
  ) || 0));
  const productEventBufferRetained = residentProductMass?.productEventBufferRetained === true
    || reactionSummary?.productEventBufferRetained === true;
  const taskId = sourceTaskId || cacheKey || `ulg:scene-spatial-gas-ledger-producer:${source}:${stateKey || 'active'}`;
  const base = {
    schema: 'peercompute.ulg.sph-scene-spatial-gas-ledger-producer-stage-request.v0',
    source,
    sourceCadence,
    sourceStage,
    sourceTaskId: taskId,
    stateKey,
    gasPressureSummarySchema: gasPressureSummary?.schema || null,
    gasPressureSummaryStatus: gasPressureSummary?.status || null,
    existingSpatialGasSpeciesLedgerSchema: existingLedger?.schema || null,
    existingSpatialGasSpeciesLedgerStatus: existingLedger?.status || null,
    existingSpatialGasSpeciesLedgerCellCount: Array.isArray(existingLedger?.cells) ? existingLedger.cells.length : 0,
    productEventRowCount,
    productEventBufferRetained,
    spatialGasLedgerProducerStageResult: null,
    spatialGasLedgerProducerStageResultReady: false,
    spatialGasLedgerProducerRetainedSourceReady: false,
    spatialGasSpeciesLedger: null
  };
  if (pressureInterfaceSpatialGasSpeciesLedgerReady(existingLedger)) {
    return {
      ...base,
      status: 'spatial-gas-ledger-already-ready',
      blocker: null,
      spatialGasLedgerProducerStageResultReady: true,
      spatialGasSpeciesLedger: existingLedger,
      spatialGasSpeciesLedgerCellCount: Array.isArray(existingLedger.cells) ? existingLedger.cells.length : 0
    };
  }
  if (!productEventRowCount || !productEventBufferRetained) {
    return {
      ...base,
      status: 'blocked-retained-product-event-buffer-required',
      blocker: 'retained-product-event-buffer-with-rows-required'
    };
  }
  const submitter = residentAuthorityHost?.submitSpatialGasLedgerProducerStageTask;
  if (typeof submitter !== 'function') {
    return {
      ...base,
      status: 'blocked-resident-authority-host-spatial-gas-ledger-producer-submit-required',
      blocker: 'resident-authority-host-spatial-gas-ledger-producer-submit-required'
    };
  }
  try {
    const submission = await submitter.call(residentAuthorityHost, {
      taskId,
      gasPressureSummary,
      residentProductMass,
      reactionSummary,
      reactionTable,
      productEventBuffer: residentProductMass?.productEventBuffer || reactionSummary?.productEventBuffer || null,
      productEventRowCount,
      productEventStrideFloats: residentProductMass?.productEventStrideFloats
        ?? reactionSummary?.productEvents?.rowStrideFloats
        ?? undefined,
      boxDimsM: boxDimsM || gasPressureSummary?.boxDimsM || null,
      preferWebGpu,
      navigatorRef,
      device,
      deviceResult,
      readbackMode,
      stateKey,
      laneId: stateKey ? `ulg:scene-spatial-gas-ledger-producer:${stateKey}` : undefined,
      source: 'scene-mounted-pressure-interface-spatial-gas-ledger-producer'
    });
    const result = spatialGasLedgerProducerResultFromSubmission(submission);
    const spatialGasSpeciesLedger = result?.spatialGasSpeciesLedger || null;
    const resultReady = pressureInterfaceSpatialGasSpeciesLedgerReady(spatialGasSpeciesLedger);
    return {
      ...base,
      status: resultReady
        ? 'spatial-gas-ledger-producer-stage-result-ready'
        : (result?.status || 'spatial-gas-ledger-producer-stage-result-blocked'),
      blocker: resultReady ? null : (result?.reason || 'spatial-gas-ledger-producer-stage-result-not-ready'),
      submissionStatus: submission?.status || null,
      spatialGasLedgerProducerStageResult: result,
      spatialGasLedgerProducerStageResultReady: resultReady,
      spatialGasLedgerProducerRetainedSourceReady: result?.retainedSpatialGasLedgerSourceReady === true,
      spatialGasSpeciesLedger,
      spatialGasSpeciesLedgerCellCount: Array.isArray(spatialGasSpeciesLedger?.cells)
        ? spatialGasSpeciesLedger.cells.length
        : 0,
      aggregateSpatialGasLedgerFallbackUsed: result?.aggregateSpatialGasLedgerFallbackUsed === true,
      spatialGasLedgerDerivation: result?.spatialGasLedgerDerivation
        || spatialGasSpeciesLedger?.spatialGasLedgerDerivation
        || null,
      spatialGasPositionSource: result?.spatialGasPositionSource
        || spatialGasSpeciesLedger?.spatialGasPositionSource
        || null,
      compactSpatialGasRowCount: result?.compactSpatialGasRowCount ?? 0,
      compactSpatialGasReadbackByteLength: result?.compactSpatialGasReadbackByteLength ?? 0,
      fullProductEventReadbackPerformed: result?.fullProductEventReadbackPerformed === true
    };
  } catch (error) {
    return {
      ...base,
      status: 'spatial-gas-ledger-producer-stage-submit-error',
      blocker: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function submitSceneGasCellEosProducerStageForPressureInterface({
  residentAuthorityHost = null,
  gasPressureSummary = null,
  preferWebGpu = true,
  navigatorRef = null,
  device = null,
  deviceResult = null,
  readbackMode = RESIDENT_NO_FULL_READBACK_MODE,
  cacheKey = null,
  stateKey = null,
  source = 'resident-pressure-interface-physics-refresh',
  sourceCadence = null,
  sourceTaskId = null,
  sourceStage = 'residentGasPressure',
  boxDimsM = null
} = {}) {
  const spatialGasSpeciesLedger = pressureInterfaceSpatialGasSpeciesLedgerFromSummary(gasPressureSummary);
  const taskId = sourceTaskId || cacheKey || `ulg:scene-gas-cell-eos-producer:${source}:${stateKey || 'active'}`;
  const base = {
    schema: 'peercompute.ulg.sph-scene-gas-cell-eos-producer-stage-request.v0',
    source,
    sourceCadence,
    sourceStage,
    sourceTaskId: taskId,
    stateKey,
    gasPressureSummarySchema: gasPressureSummary?.schema || null,
    gasPressureSummaryStatus: gasPressureSummary?.status || null,
    spatialGasSpeciesLedgerSchema: spatialGasSpeciesLedger?.schema || null,
    spatialGasSpeciesLedgerStatus: spatialGasSpeciesLedger?.status || null,
    spatialGasSpeciesLedgerCellCount: Array.isArray(spatialGasSpeciesLedger?.cells)
      ? spatialGasSpeciesLedger.cells.length
      : 0,
    gasCellEosProducerStageResult: null,
    gasCellEosProducerStageResultReady: false,
    gasCellEosProducerRetainedSourceReady: false
  };
  if (!pressureInterfaceSpatialGasSpeciesLedgerReady(spatialGasSpeciesLedger)) {
    return {
      ...base,
      status: 'blocked-spatial-gas-species-ledger-required',
      blocker: 'ready-spatial-gas-species-ledger-required'
    };
  }
  const submitter = residentAuthorityHost?.submitGasCellEosProducerStageTask;
  if (typeof submitter !== 'function') {
    return {
      ...base,
      status: 'blocked-resident-authority-host-gas-cell-eos-producer-submit-required',
      blocker: 'resident-authority-host-gas-cell-eos-producer-submit-required'
    };
  }
  try {
    const submission = await submitter.call(residentAuthorityHost, {
      taskId,
      gasPressureSummary,
      pressureSummary: gasPressureSummary,
      spatialGasSpeciesLedger,
      boxDimsM: boxDimsM || gasPressureSummary?.boxDimsM || null,
      preferWebGpu,
      navigatorRef,
      device,
      deviceResult,
      readbackMode,
      stateKey,
      laneId: stateKey ? `ulg:scene-gas-cell-eos-producer:${stateKey}` : undefined,
      source: 'scene-mounted-pressure-interface-gas-cell-eos-producer'
    });
    const result = gasCellEosProducerResultFromSubmission(submission);
    const gasCellField = pressureInterfaceGasCellFieldFromProducerResult(result);
    const resultReady = Boolean(
      result
        && gasCellField?.localPressureGradientReady === true
        && Array.isArray(gasCellField.cells)
        && gasCellField.cells.length > 0
    );
    const retainedSourceReady = result?.retainedGasCellFieldSourceReady === true
      || pressureInterfaceRetainedGasCellFieldSourceFromProducerResult(result)?.status === 'pressure-interface-retained-gas-cell-field-source-ready';
    return {
      ...base,
      status: resultReady
        ? 'gas-cell-eos-producer-stage-result-ready'
        : (result?.status || 'gas-cell-eos-producer-stage-result-blocked'),
      blocker: resultReady ? null : (result?.reason || 'gas-cell-eos-producer-stage-result-not-ready'),
      submissionStatus: submission?.status || null,
      gasCellEosProducerStageResult: result,
      gasCellEosProducerStageResultReady: resultReady,
      gasCellEosProducerRetainedSourceReady: retainedSourceReady,
      retainedGasPressureBufferRefs: retainedGasPressureRefsFromProducerResult(result),
      workerRetainedGasPressureBufferRefs: workerRetainedGasPressureRefsFromProducerResult(result)
    };
  } catch (error) {
    return {
      ...base,
      status: 'gas-cell-eos-producer-stage-request-error',
      blocker: error instanceof Error ? error.message : String(error)
    };
  }
}

function blockedPressureInterfaceGasCellFieldImportPublication({
  status,
  blocker,
  source = 'resident-pressure-interface-physics-refresh',
  sourceCadence = null,
  gasPressureSummary = null,
  gasCellField = null,
  pressureInterfaceGasCellFieldAdmission = null,
  pressureInterfaceGasCellFieldAdmissionPublication = null,
  retainedGasPressureBufferRefs = [],
  workerRetainedGasPressureBufferRefs = []
} = {}) {
  return {
    schema: 'peercompute.ulg.sph-scene-pressure-interface-gas-cell-field-import-publication.v0',
    status,
    blocker: blocker || status,
    source,
    sourceCadence,
    sourceGasPressureSummarySchema: gasPressureSummary?.schema ?? null,
    sourceGasPressureSummaryStatus: gasPressureSummary?.status ?? null,
    pressureInterfaceGasCellFieldImport: null,
    pressureInterfaceGasCellFieldImportReady: false,
    pressureInterfaceGasCellFieldImportSchema: null,
    pressureInterfaceGasCellFieldImportStatus: status,
    pressureInterfaceGasCellFieldImportSourceHotBufferKey: null,
    gasCellFieldSnapshotReady: Boolean(
      gasCellField?.localPressureGradientReady === true
      && Array.isArray(gasCellField?.cells)
      && gasCellField.cells.length > 0
    ),
    pressureInterfaceGasCellFieldAdmission,
    pressureInterfaceGasCellFieldAdmissionSchema: pressureInterfaceGasCellFieldAdmission?.schema || null,
    pressureInterfaceGasCellFieldAdmissionStatus: pressureInterfaceGasCellFieldAdmission?.status || null,
    pressureInterfaceGasCellFieldAdmissionApproved: pressureInterfaceGasCellFieldAdmission?.schema === ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA
      && pressureInterfaceGasCellFieldAdmission?.status === 'pressure-interface-gas-cell-field-consumption-approved'
      && pressureInterfaceGasCellFieldAdmission?.gasCellFieldConsumptionApproved === true,
    pressureInterfaceGasCellFieldAdmissionPublication,
    pressureInterfaceGasCellFieldAdmissionPublicationSchema: pressureInterfaceGasCellFieldAdmissionPublication?.schema || null,
    pressureInterfaceGasCellFieldAdmissionPublicationStatus: pressureInterfaceGasCellFieldAdmissionPublication?.status || null,
    pressureInterfaceGasCellFieldAdmissionPublicationHotBufferKey: pressureInterfaceGasCellFieldAdmissionPublication?.hotBufferKey || null,
    retainedGasPressureBufferRefs: [...retainedGasPressureBufferRefs],
    workerRetainedGasPressureBufferRefs: [...workerRetainedGasPressureBufferRefs],
    retainedGasPressureBufferRefCount: retainedGasPressureBufferRefs.length,
    workerRetainedGasPressureBufferRefCount: workerRetainedGasPressureBufferRefs.length,
    authoritativeStateMutation: false,
    stateManagerAdmissionRequired: true,
    scientificValidation: false,
    gasValidation: false,
    sphValidation: false,
    fullPhysicsValidation: false
  };
}

export function publishScenePressureInterfaceGasCellFieldImportSource({
  residentAuthorityHost = null,
  gasPressureSummary = null,
  gasCellEosProducerStageResult = null,
  pressureInterfaceGasCellFieldAdmission = null,
  cacheKey = null,
  stateKey = null,
  source = 'resident-pressure-interface-physics-refresh',
  sourceCadence = null,
  sourceTaskId = null,
  sourceNodeId = 'ulg-resident-gas-pressure-law',
  sourceStage = 'residentGasPressure',
  hotBufferKeyPrefix = 'ulg:scene-pressure-interface-gas-cell-field-import',
  allowSummaryGasCellFieldImport = true
} = {}) {
  const producerGasCellField = pressureInterfaceGasCellFieldFromProducerResult(gasCellEosProducerStageResult);
  const summaryGasCellField = pressureInterfaceGasCellFieldFromSummary(gasPressureSummary);
  const candidateGasCellField = producerGasCellField || summaryGasCellField;
  const gasCellField = producerGasCellField || (allowSummaryGasCellFieldImport ? summaryGasCellField : null);
  const sourceObject = producerGasCellField
    ? gasCellEosProducerStageResult
    : (allowSummaryGasCellFieldImport ? gasPressureSummary : null);
  const effectiveSourceStage = producerGasCellField ? 'gasCellEosProducer' : sourceStage;
  const effectiveSourceTaskId = sourceTaskId || (producerGasCellField ? gasCellEosProducerStageResult?.computeTaskId : null);
  let admission = pressureInterfaceGasCellFieldAdmissionFromSummary(
    gasPressureSummary,
    pressureInterfaceGasCellFieldAdmission
  );
  const retainedGasPressureBufferRefs = uniqueSceneStringList([
    ...retainedGasPressureRefsFromProducerResult(gasCellEosProducerStageResult),
    ...retainedGasPressureRefsFromSummary(gasPressureSummary)
  ]);
  const workerRetainedGasPressureBufferRefs = uniqueSceneStringList([
    ...workerRetainedGasPressureRefsFromProducerResult(gasCellEosProducerStageResult),
    ...workerRetainedGasPressureRefsFromSummary(gasPressureSummary)
  ]);
  const localPressureGradientReady = gasCellField?.localPressureGradientReady === true
    && Array.isArray(gasCellField?.cells)
    && gasCellField.cells.length > 0;
  let admissionApproved = admission?.schema === ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA
    && admission?.status === 'pressure-interface-gas-cell-field-consumption-approved'
    && admission?.gasCellFieldConsumptionApproved === true;
  const publisher = residentAuthorityHost?.publishPressureInterfaceGasCellFieldImportSource;
  const admissionPublisher = residentAuthorityHost?.publishPressureInterfaceGasCellFieldAdmission;
  let admissionPublication = null;
  const blockedBase = {
    source,
    sourceCadence,
    gasPressureSummary,
    gasCellField: candidateGasCellField,
    pressureInterfaceGasCellFieldAdmission: admission,
    pressureInterfaceGasCellFieldAdmissionPublication: admissionPublication,
    retainedGasPressureBufferRefs,
    workerRetainedGasPressureBufferRefs
  };
  if (!gasPressureSummary && !sourceObject) {
    return blockedPressureInterfaceGasCellFieldImportPublication({
      ...blockedBase,
      status: 'blocked-gas-pressure-summary-unavailable',
      blocker: 'gas-pressure-summary-or-gas-cell-eos-producer-result-required'
    });
  }
  if (!producerGasCellField && !allowSummaryGasCellFieldImport) {
    return blockedPressureInterfaceGasCellFieldImportPublication({
      ...blockedBase,
      status: 'blocked-snapshot-gas-cell-import-disabled',
      blocker: 'gas-cell-eos-producer-result-or-supplied-import-required'
    });
  }
  if (!localPressureGradientReady) {
    return blockedPressureInterfaceGasCellFieldImportPublication({
      ...blockedBase,
      status: 'blocked-local-gas-cell-gradient-field-unavailable',
      blocker: 'ready-local-gas-cell-gradient-field-required'
    });
  }
  if (!admissionApproved && (retainedGasPressureBufferRefs.length > 0 || workerRetainedGasPressureBufferRefs.length > 0) && typeof admissionPublisher === 'function') {
    try {
      admissionPublication = admissionPublisher.call(residentAuthorityHost, {
        cacheKey,
        stateKey,
        source: sourceObject,
        sourceTaskId: effectiveSourceTaskId,
        sourceNodeId,
        sourceStage: effectiveSourceStage,
        gasCellFieldSnapshot: gasCellField,
        retainedGasPressureBufferRefs,
        workerRetainedGasPressureBufferRefs
      });
      admission = admissionPublication?.pressureInterfaceGasCellFieldAdmission || admission;
      admissionApproved = admission?.schema === ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA
        && admission?.status === 'pressure-interface-gas-cell-field-consumption-approved'
        && admission?.gasCellFieldConsumptionApproved === true;
    } catch (error) {
      return blockedPressureInterfaceGasCellFieldImportPublication({
        ...blockedBase,
        pressureInterfaceGasCellFieldAdmission: admission,
        pressureInterfaceGasCellFieldAdmissionPublication: admissionPublication,
        status: 'pressure-interface-gas-cell-field-admission-publication-error',
        blocker: error instanceof Error ? error.message : String(error)
      });
    }
  }
  if (!admissionApproved) {
    return blockedPressureInterfaceGasCellFieldImportPublication({
      ...blockedBase,
      pressureInterfaceGasCellFieldAdmission: admission,
      pressureInterfaceGasCellFieldAdmissionPublication: admissionPublication,
      status: 'blocked-gas-cell-field-consumption-admission-required',
      blocker: 'pressure-interface-gas-cell-field-admission-required'
    });
  }
  if (retainedGasPressureBufferRefs.length === 0 && workerRetainedGasPressureBufferRefs.length === 0) {
    return blockedPressureInterfaceGasCellFieldImportPublication({
      ...blockedBase,
      pressureInterfaceGasCellFieldAdmission: admission,
      pressureInterfaceGasCellFieldAdmissionPublication: admissionPublication,
      status: 'blocked-retained-gas-cell-buffer-ref-required',
      blocker: 'retained-gas-cell-buffer-ref-required'
    });
  }
  if (typeof publisher !== 'function') {
    return blockedPressureInterfaceGasCellFieldImportPublication({
      ...blockedBase,
      pressureInterfaceGasCellFieldAdmission: admission,
      pressureInterfaceGasCellFieldAdmissionPublication: admissionPublication,
      status: 'blocked-resident-authority-host-publisher-unavailable',
      blocker: 'resident-authority-host-publisher-required'
    });
  }
  try {
    const publication = publisher.call(residentAuthorityHost, {
      cacheKey,
      stateKey,
      hotBufferKeyPrefix,
      source: sourceObject,
      sourceTaskId: effectiveSourceTaskId,
      sourceNodeId,
      sourceStage: effectiveSourceStage,
      gasCellFieldSnapshot: gasCellField,
      pressureInterfaceGasCellFieldAdmission: admission,
      retainedGasPressureBufferRefs,
      workerRetainedGasPressureBufferRefs
    });
    const importDescriptor = publication?.pressureInterfaceGasCellFieldImport || null;
    return {
      schema: 'peercompute.ulg.sph-scene-pressure-interface-gas-cell-field-import-publication.v0',
      status: publication?.status || 'pressure-interface-gas-cell-field-import-published',
      blocker: null,
      source,
      sourceCadence,
      publication,
      hotBufferKey: publication?.hotBufferKey || importDescriptor?.sourceHotBufferKey || null,
      committed: publication?.committed === true,
      commitDeltaTaskId: publication?.commitDeltaTaskId || null,
      commitDeltaScope: publication?.commitDeltaScope || null,
      pressureInterfaceGasCellFieldImport: importDescriptor,
      pressureInterfaceGasCellFieldImportReady: importDescriptor?.status === 'pressure-interface-gas-cell-field-import-ready',
      pressureInterfaceGasCellFieldImportSchema: importDescriptor?.schema || null,
      pressureInterfaceGasCellFieldImportStatus: importDescriptor?.status || null,
      pressureInterfaceGasCellFieldImportSourceHotBufferKey: importDescriptor?.sourceHotBufferKey || publication?.hotBufferKey || null,
      gasCellFieldSnapshotReady: true,
      pressureInterfaceGasCellFieldAdmission: admission,
      pressureInterfaceGasCellFieldAdmissionSchema: admission.schema,
      pressureInterfaceGasCellFieldAdmissionStatus: admission.status,
      pressureInterfaceGasCellFieldAdmissionApproved: true,
      pressureInterfaceGasCellFieldAdmissionPublication: admissionPublication,
      pressureInterfaceGasCellFieldAdmissionPublicationSchema: admissionPublication?.schema || null,
      pressureInterfaceGasCellFieldAdmissionPublicationStatus: admissionPublication?.status || null,
      pressureInterfaceGasCellFieldAdmissionPublicationHotBufferKey: admissionPublication?.hotBufferKey || null,
      retainedGasPressureBufferRefs,
      workerRetainedGasPressureBufferRefs,
      retainedGasPressureBufferRefCount: retainedGasPressureBufferRefs.length,
      workerRetainedGasPressureBufferRefCount: workerRetainedGasPressureBufferRefs.length,
      authoritativeStateMutation: false,
      stateManagerAdmissionRequired: true,
      scientificValidation: false,
      gasValidation: false,
      sphValidation: false,
      fullPhysicsValidation: false
    };
  } catch (error) {
    return blockedPressureInterfaceGasCellFieldImportPublication({
      ...blockedBase,
      pressureInterfaceGasCellFieldAdmission: admission,
      pressureInterfaceGasCellFieldAdmissionPublication: admissionPublication,
      status: 'pressure-interface-gas-cell-field-import-publication-error',
      blocker: error instanceof Error ? error.message : String(error)
    });
  }
}

export function pressureInterfaceForceRowsUploadFields(upload = null) {
  return {
    pressureInterfaceForceRowsUploadStatus: upload?.pressureInterfaceForceRowsUploadStatus ?? upload?.status ?? null,
    pressureInterfaceForceRowsUploadBlocker: upload?.blocker
      ?? upload?.pressureInterfaceForceRowsUploadBlocker
      ?? null,
    pressureInterfaceForceRowsBufferRetained: Boolean(
      upload?.bufferRetained ?? upload?.pressureInterfaceForceRowsBufferRetained
    ),
    pressureInterfaceForceRowsBufferByteLength: upload?.forceRowByteLength
      ?? upload?.pressureInterfaceForceRowsBufferByteLength
      ?? 0,
    pressureInterfaceForceRowsCandidateByteLength: upload?.candidateForceRowByteLength
      ?? upload?.pressureInterfaceForceRowsCandidateByteLength
      ?? 0,
    pressureInterfaceForceRowsUploadSignature: upload?.signature
      ?? upload?.pressureInterfaceForceRowsUploadSignature
      ?? null,
    pressureInterfaceForceRowsUploadQueueCompletionStatus: upload?.pressureInterfaceForceRowsUploadQueueCompletionStatus
      ?? upload?.queueCompletionStatus
      ?? null,
    pressureInterfaceForceRowsUploadQueueCompletionMethod: upload?.pressureInterfaceForceRowsUploadQueueCompletionMethod
      ?? upload?.queueCompletionMethod
      ?? null,
    pressureInterfaceForceRowsConsumerQueueCompletionStatus: upload?.pressureInterfaceForceRowsConsumerQueueCompletionStatus
      ?? null,
    pressureInterfaceForceRowsConsumerQueueCompletionMethod: upload?.pressureInterfaceForceRowsConsumerQueueCompletionMethod
      ?? null,
    pressureInterfaceForceRowsUploadCleanupStatus: upload?.pressureInterfaceForceRowsUploadCleanupStatus
      ?? null,
    pressureInterfaceForceRowsUploadDestroyStatus: upload?.pressureInterfaceForceRowsUploadDestroyStatus
      ?? null,
    pressureInterfaceGridForceAdmissionSchema: upload?.pressureInterfaceGridForceAdmissionSchema
      ?? upload?.gridForceAdmissionSchema
      ?? null,
    pressureInterfaceGridForceAdmissionStatus: upload?.pressureInterfaceGridForceAdmissionStatus
      ?? upload?.gridForceAdmissionStatus
      ?? null,
    pressureInterfaceGridForceAdmissionApproved: Boolean(
      upload?.pressureInterfaceGridForceAdmissionApproved
      ?? upload?.gridForceAdmissionApproved
    ),
    pressureInterfaceGridForceAdmissionDescriptorStatus: upload?.pressureInterfaceGridForceAdmissionDescriptorStatus
      ?? upload?.gridForceAdmissionDescriptorStatus
      ?? null,
    pressureInterfaceGridForceAdmissionSourceHotBufferKey: upload?.pressureInterfaceGridForceAdmissionSourceHotBufferKey
      ?? upload?.gridForceAdmissionSourceHotBufferKey
      ?? null,
    pressureInterfaceForceRowsLeaseStatus: upload?.residentBufferLeaseLedgerStatus
      ?? upload?.pressureInterfaceForceRowsLeaseStatus
      ?? null,
    pressureInterfaceForceRowsLeaseResourceCount: upload?.residentBufferLeaseResourceCount
      ?? upload?.pressureInterfaceForceRowsLeaseResourceCount
      ?? 0,
    pressureInterfaceForceRowsLeaseActiveCount: upload?.residentBufferLeaseActiveLeaseCount
      ?? upload?.pressureInterfaceForceRowsLeaseActiveCount
      ?? 0,
    pressureInterfaceForceRowsLeaseSummary: upload?.residentBufferLeaseSummary
      ?? upload?.pressureInterfaceForceRowsLeaseSummary
      ?? null
  };
}

export function buildSphResidentPressureInterfaceStateSummary({
  materialInterfaceField = null,
  gasPressureSummary = null,
  pressureInterfaceCoupling = null,
  pressureInterfaceForcePreview = null,
  pressureInterfaceForceSolver = null,
  pressureInterfaceForceRowsUpload = null,
  pressureInterfaceGridForceAdmission = null,
  pressureInterfaceGasCellFieldImportPublication = null,
  spatialGasLedgerProducerStageRequest = null,
  gasCellEosProducerStageRequest = null,
  source = 'resident-pressure-interface-state',
  sourceCadence = null
} = {}) {
  const pressureFeedback = pressureFeedbackFromGasPressureSummary(gasPressureSummary);
  const coupling = pressureInterfaceCoupling || gasPressureInterfaceCouplingSummary({
    pressureFeedback,
    materialInterfaceField
  });
  const preview = pressureInterfaceForcePreview || gasPressureInterfaceForcePreview({
    pressureFeedback,
    materialInterfaceField,
    pressureInterfaceCoupling: coupling
  });
  const solver = pressureInterfaceForceSolver || gasPressureInterfaceForceSolver({
    pressureFeedback,
    materialInterfaceField,
    pressureInterfaceCoupling: coupling
  });
  const uploadFields = pressureInterfaceForceRowsUploadFields(pressureInterfaceForceRowsUpload);
  const solverReady = solver.status === 'pressure-interface-force-solver-ready';
  const uploadBlockedForAdmission = solverReady
    && uploadFields.pressureInterfaceForceRowsUploadStatus === 'blocked-pressure-interface-grid-force-admission-required';
  const rowsReady = solverReady
    && uploadFields.pressureInterfaceForceRowsBufferRetained
    && uploadFields.pressureInterfaceGridForceAdmissionApproved;
  const schroederSourceKeyReplayDiagnostics = buildSchroederSourceKeyReplayDiagnostics({
    materialInterfaceField,
    pressureInterfaceForceSolver: solver
  });
  return {
    schema: 'peercompute.ulg.sph-resident-pressure-interface-state.v0',
    status: rowsReady
      ? 'resident-pressure-interface-force-rows-ready'
      : (uploadBlockedForAdmission
          ? 'resident-pressure-interface-force-rows-admission-required'
          : solverReady
          ? 'resident-pressure-interface-force-solver-ready'
          : 'resident-pressure-interface-blocked'),
    source,
    sourceCadence,
    pressureAuthority: 'resident-pressure-interface-state',
    sourceGasPressureSummarySchema: gasPressureSummary?.schema ?? null,
    sourceGasPressureSummaryStatus: gasPressureSummary?.status ?? null,
    pressureFeedbackSchema: pressureFeedback?.schema ?? null,
    pressureFeedbackStatus: pressureFeedback?.status ?? null,
    materialInterfaceField,
    materialInterfaceFieldSchema: materialInterfaceField?.schema ?? null,
    materialInterfaceFieldStatus: materialInterfaceField?.status ?? null,
    materialInterfaceReadySurfaceCount: materialInterfaceField?.readySurfaceCount ?? 0,
    materialInterfaceTotalSurfaceAreaM2: materialInterfaceField?.totalSurfaceAreaM2 ?? 0,
    materialInterfaceForceCouplingStatus: solver.forceCouplingStatus
      ?? materialInterfaceField?.forceCouplingStatus
      ?? null,
    pressureInterfaceCoupling: coupling,
    pressureInterfaceCouplingSchema: coupling.schema,
    pressureInterfaceCouplingStatus: coupling.status,
    pressureInterfaceCouplingPreSolverStatus: coupling.forceCouplingStatus,
    pressureInterfaceForceCouplingStatus: solver.forceCouplingStatus
      ?? coupling.forceCouplingStatus,
    pressureInterfaceForcePreview: preview,
    pressureInterfaceForcePreviewSchema: preview.schema,
    pressureInterfaceForcePreviewStatus: preview.status,
    pressureInterfaceForceApplicationStatus: preview.forceApplicationStatus,
    pressureInterfacePreviewedElementCount: preview.previewedElementCount,
    pressureInterfaceTotalAbsForceN: preview.totalAbsInterfaceForceN,
    pressureInterfaceForceSolver: solver,
    pressureInterfaceForceSolverSchema: solver.schema,
    pressureInterfaceForceSolverStatus: solver.status,
    schroederSourceKeyReplayDiagnostics,
    schroederSourceKeyReplayDiagnosticsSchema: schroederSourceKeyReplayDiagnostics.schema,
    schroederSourceKeyReplayDiagnosticsStatus: schroederSourceKeyReplayDiagnostics.status,
    schroederSourceKeyReplayReady: schroederSourceKeyReplayDiagnostics.replayReady,
    schroederSourceKeyReplayRetainedRefPublicationReady:
      schroederSourceKeyReplayDiagnostics.retainedRefPublicationReady,
    schroederSourceKeyReplayPressureConsumerConsumed:
      schroederSourceKeyReplayDiagnostics.pressureConsumerConsumed,
    pressureInterfaceSolverApplicationStatus: solver.forceApplicationStatus,
    pressureInterfaceSolverForceRowCount: solver.forceRowCount,
    pressureInterfaceSolverConservationStatus: solver.conservationStatus,
    pressureInterfaceSolverConservationResidualMagnitudeN: solver.conservationResidualMagnitudeN,
    pressureInterfaceGridForceAdmission,
    pressureInterfaceGridForceAdmissionSchema: uploadFields.pressureInterfaceGridForceAdmissionSchema
      ?? pressureInterfaceGridForceAdmission?.schema
      ?? null,
    pressureInterfaceGridForceAdmissionStatus: uploadFields.pressureInterfaceGridForceAdmissionStatus
      ?? pressureInterfaceGridForceAdmission?.status
      ?? null,
    pressureInterfaceGridForceAdmissionApproved: uploadFields.pressureInterfaceGridForceAdmissionApproved,
    pressureInterfaceGridForceAdmissionDescriptorStatus: uploadFields.pressureInterfaceGridForceAdmissionDescriptorStatus
      ?? pressureInterfaceGridForceAdmission?.publicationStatus
      ?? pressureInterfaceGridForceAdmission?.admittedStatus
      ?? null,
    pressureInterfaceGridForceAdmissionSourceHotBufferKey: uploadFields.pressureInterfaceGridForceAdmissionSourceHotBufferKey
      ?? pressureInterfaceGridForceAdmission?.sourceHotBufferKey
      ?? pressureInterfaceGridForceAdmission?.hotBufferKey
      ?? null,
    pressureInterfaceGasCellFieldImportPublication,
    pressureInterfaceGasCellFieldImportPublicationSchema: pressureInterfaceGasCellFieldImportPublication?.schema ?? null,
    pressureInterfaceGasCellFieldImportPublicationStatus: pressureInterfaceGasCellFieldImportPublication?.status ?? null,
    pressureInterfaceGasCellFieldImportPublicationBlocker: pressureInterfaceGasCellFieldImportPublication?.blocker ?? null,
    pressureInterfaceGasCellFieldImportPublicationCommitted: pressureInterfaceGasCellFieldImportPublication?.committed === true,
    pressureInterfaceGasCellFieldImportPublicationHotBufferKey: pressureInterfaceGasCellFieldImportPublication?.hotBufferKey
      ?? pressureInterfaceGasCellFieldImportPublication?.pressureInterfaceGasCellFieldImportSourceHotBufferKey
      ?? null,
    pressureInterfaceGasCellFieldImport: pressureInterfaceGasCellFieldImportPublication?.pressureInterfaceGasCellFieldImport ?? null,
    pressureInterfaceGasCellFieldImportSchema: pressureInterfaceGasCellFieldImportPublication?.pressureInterfaceGasCellFieldImportSchema ?? null,
    pressureInterfaceGasCellFieldImportStatus: pressureInterfaceGasCellFieldImportPublication?.pressureInterfaceGasCellFieldImportStatus ?? null,
    pressureInterfaceGasCellFieldImportReady: pressureInterfaceGasCellFieldImportPublication?.pressureInterfaceGasCellFieldImportReady === true,
    pressureInterfaceGasCellFieldImportSourceHotBufferKey: pressureInterfaceGasCellFieldImportPublication?.pressureInterfaceGasCellFieldImportSourceHotBufferKey ?? null,
    pressureInterfaceGasCellFieldAdmission: pressureInterfaceGasCellFieldImportPublication?.pressureInterfaceGasCellFieldAdmission ?? null,
    pressureInterfaceGasCellFieldAdmissionSchema: pressureInterfaceGasCellFieldImportPublication?.pressureInterfaceGasCellFieldAdmissionSchema ?? null,
    pressureInterfaceGasCellFieldAdmissionStatus: pressureInterfaceGasCellFieldImportPublication?.pressureInterfaceGasCellFieldAdmissionStatus ?? null,
    pressureInterfaceGasCellFieldAdmissionApproved: pressureInterfaceGasCellFieldImportPublication?.pressureInterfaceGasCellFieldAdmissionApproved === true,
    pressureInterfaceGasCellFieldAdmissionPublication: pressureInterfaceGasCellFieldImportPublication?.pressureInterfaceGasCellFieldAdmissionPublication ?? null,
    pressureInterfaceGasCellFieldAdmissionPublicationSchema: pressureInterfaceGasCellFieldImportPublication?.pressureInterfaceGasCellFieldAdmissionPublicationSchema ?? null,
    pressureInterfaceGasCellFieldAdmissionPublicationStatus: pressureInterfaceGasCellFieldImportPublication?.pressureInterfaceGasCellFieldAdmissionPublicationStatus ?? null,
    pressureInterfaceGasCellFieldAdmissionPublicationHotBufferKey: pressureInterfaceGasCellFieldImportPublication?.pressureInterfaceGasCellFieldAdmissionPublicationHotBufferKey ?? null,
    pressureInterfaceGasCellFieldRetainedGasPressureBufferRefs: [
      ...(pressureInterfaceGasCellFieldImportPublication?.retainedGasPressureBufferRefs || [])
    ],
    pressureInterfaceGasCellFieldWorkerRetainedGasPressureBufferRefs: [
      ...(pressureInterfaceGasCellFieldImportPublication?.workerRetainedGasPressureBufferRefs || [])
    ],
    spatialGasLedgerProducerStageRequest,
    spatialGasLedgerProducerStageRequestSchema: spatialGasLedgerProducerStageRequest?.schema ?? null,
    spatialGasLedgerProducerStageRequestStatus: spatialGasLedgerProducerStageRequest?.status ?? null,
    spatialGasLedgerProducerStageRequestBlocker: spatialGasLedgerProducerStageRequest?.blocker ?? null,
    spatialGasLedgerProducerStageResultReady: spatialGasLedgerProducerStageRequest?.spatialGasLedgerProducerStageResultReady === true,
    spatialGasLedgerProducerRetainedSourceReady: spatialGasLedgerProducerStageRequest?.spatialGasLedgerProducerRetainedSourceReady === true,
    spatialGasLedgerProducerStageSpatialLedgerCellCount: spatialGasLedgerProducerStageRequest?.spatialGasSpeciesLedgerCellCount ?? 0,
    spatialGasLedgerProducerAggregateFallbackUsed: spatialGasLedgerProducerStageRequest?.aggregateSpatialGasLedgerFallbackUsed === true,
    spatialGasLedgerProducerSpatialGasLedgerDerivation: spatialGasLedgerProducerStageRequest?.spatialGasLedgerDerivation
      ?? spatialGasLedgerProducerStageRequest?.spatialGasSpeciesLedger?.spatialGasLedgerDerivation
      ?? null,
    spatialGasLedgerProducerSpatialGasPositionSource: spatialGasLedgerProducerStageRequest?.spatialGasPositionSource
      ?? spatialGasLedgerProducerStageRequest?.spatialGasSpeciesLedger?.spatialGasPositionSource
      ?? null,
    spatialGasLedgerProducerCompactSpatialGasRowCount: spatialGasLedgerProducerStageRequest?.compactSpatialGasRowCount ?? 0,
    spatialGasLedgerProducerCompactSpatialGasReadbackByteLength: spatialGasLedgerProducerStageRequest?.compactSpatialGasReadbackByteLength ?? 0,
    spatialGasLedgerProducerFullProductEventReadbackPerformed: spatialGasLedgerProducerStageRequest?.fullProductEventReadbackPerformed === true,
    gasCellEosProducerStageRequest,
    gasCellEosProducerStageRequestSchema: gasCellEosProducerStageRequest?.schema ?? null,
    gasCellEosProducerStageRequestStatus: gasCellEosProducerStageRequest?.status ?? null,
    gasCellEosProducerStageRequestBlocker: gasCellEosProducerStageRequest?.blocker ?? null,
    gasCellEosProducerStageResultReady: gasCellEosProducerStageRequest?.gasCellEosProducerStageResultReady === true,
    gasCellEosProducerRetainedSourceReady: gasCellEosProducerStageRequest?.gasCellEosProducerRetainedSourceReady === true,
    gasCellEosProducerStageSpatialLedgerCellCount: gasCellEosProducerStageRequest?.spatialGasSpeciesLedgerCellCount ?? 0,
    ...uploadFields,
    gpuAuthoritativeState: Boolean(rowsReady || materialInterfaceField?.sourceRenderFieldReadback === false),
    scientificValidation: false,
    gasValidation: false,
    sphValidation: false,
    pressureInterfaceValidation: false,
    fullPhysicsValidation: false
  };
}

export function compactResidentBufferLeaseSummary(summary = null) {
  if (!summary) return null;
  return {
    schema: summary.schema ?? null,
    ledgerId: summary.ledgerId ?? null,
    stateKey: summary.stateKey ?? null,
    scope: summary.scope ?? null,
    status: summary.status ?? null,
    resourceCount: summary.resourceCount ?? 0,
    activeLeaseCount: summary.activeLeaseCount ?? 0,
    destroyedResourceCount: summary.destroyedResourceCount ?? 0,
    skippedDestroyCount: summary.skippedDestroyCount ?? 0,
    warnings: [...(summary.warnings || [])],
    blockers: [...(summary.blockers || [])]
  };
}

function compactPressureStateObject(value = null, fields = []) {
  if (!value) return null;
  const compact = {
    schema: value.schema ?? null,
    status: value.status ?? null
  };
  for (const field of fields) {
    if (value[field] !== undefined) compact[field] = value[field];
  }
  return compact;
}

function compactPressureInterfaceForceRowsUploadFields(fields = {}) {
  return {
    ...fields,
    pressureInterfaceForceRowsLeaseSummary: compactResidentBufferLeaseSummary(
      fields.pressureInterfaceForceRowsLeaseSummary
    )
  };
}

export function compactMaterialInterfaceFieldSummary(field = null) {
  if (!field) return null;
  return {
    schema: field.schema ?? null,
    status: field.status ?? null,
    reason: field.reason ?? null,
    sourceRenderFieldSchema: field.sourceRenderFieldSchema ?? null,
    sourceRenderFieldStatus: field.sourceRenderFieldStatus ?? null,
    sourceRenderFieldReadback: Boolean(field.sourceRenderFieldReadback),
    sourceRenderFieldReadbackMode: field.sourceRenderFieldReadbackMode ?? null,
    interfaceSourceFieldSchema: field.interfaceSourceFieldSchema ?? field.sourceFieldSchema ?? null,
    interfaceSourceFieldStatus: field.interfaceSourceFieldStatus ?? field.sourceFieldStatus ?? null,
    interfaceSourceFieldBackend: field.interfaceSourceFieldBackend ?? field.sourceFieldBackend ?? null,
    interfaceSourceFieldKernelScope: field.interfaceSourceFieldKernelScope ?? null,
    interfaceSourceFieldSourceLocal: Boolean(field.interfaceSourceFieldSourceLocal),
    interfaceSourceFieldSourceLocalEstimatedCellVisits:
      field.interfaceSourceFieldSourceLocalEstimatedCellVisits ?? null,
    interfaceSourceFieldDenseCellParticlePairs:
      field.interfaceSourceFieldDenseCellParticlePairs ?? null,
    interfaceSourceFieldSourceLocalEstimatedVisitRatio:
      field.interfaceSourceFieldSourceLocalEstimatedVisitRatio ?? null,
    interfaceSourceFieldSourceLocalSourceCount:
      field.interfaceSourceFieldSourceLocalSourceCount ?? null,
    interfaceSourceFieldSourceLocalDensityScale:
      field.interfaceSourceFieldSourceLocalDensityScale ?? null,
    interfaceSourceFieldQueueCompletionStatus: field.interfaceSourceFieldQueueCompletionStatus ?? null,
    interfaceSourceFieldQueueCompletionMethod: field.interfaceSourceFieldQueueCompletionMethod ?? null,
    interfaceSourceFieldRowsBufferBorrowed: Boolean(field.interfaceSourceFieldRowsBufferBorrowed),
    interfaceSourceFieldRowsBufferReused: Boolean(field.interfaceSourceFieldRowsBufferReused),
    interfaceSourceFieldRowsBufferPoolStatus: field.interfaceSourceFieldRowsBufferPoolStatus ?? null,
    interfaceSourceFieldRowsBufferPoolReason: field.interfaceSourceFieldRowsBufferPoolReason ?? null,
    interfaceSourceFieldRowsBufferPoolReused: Boolean(field.interfaceSourceFieldRowsBufferPoolReused),
    interfaceSourceFieldRowsBufferPoolByteLength: field.interfaceSourceFieldRowsBufferPoolByteLength ?? 0,
    interfaceSourceFieldSourceIndexStatus: field.interfaceSourceFieldSourceIndexStatus ?? null,
    interfaceSourceFieldSourceIndexBufferRetained:
      Boolean(field.interfaceSourceFieldSourceIndexBufferRetained),
    interfaceSourceFieldSourceIndexBufferByteLength:
      field.interfaceSourceFieldSourceIndexBufferByteLength ?? 0,
    interfaceSourceKeySchema: field.interfaceSourceKeySchema ?? null,
    interfaceSourceKeyStatus: field.interfaceSourceKeyStatus ?? null,
    interfaceSourceKeySourceStatus: field.interfaceSourceKeySourceStatus ?? null,
    interfaceSourceKeyReason: field.interfaceSourceKeyReason ?? null,
    interfaceSourceKeyRowCount: field.interfaceSourceKeyRowCount ?? 0,
    interfaceSourceKeyReadyCount: field.interfaceSourceKeyReadyCount ?? 0,
    interfaceSourceKeyStrideFloats: field.interfaceSourceKeyStrideFloats ?? null,
    interfaceSourceKeyBufferRetained: Boolean(field.interfaceSourceKeyBufferRetained),
    interfaceSourceKeyBufferByteLength: field.interfaceSourceKeyBufferByteLength ?? 0,
    interfaceSourceKeySurfaceIndexFallbackEnabled:
      field.interfaceSourceKeySurfaceIndexFallbackEnabled !== false,
    sourceFieldPipelineCacheStatus: field.sourceFieldPipelineCacheStatus ?? null,
    sourceRenderFieldPipelineCacheStatus: field.sourceRenderFieldPipelineCacheStatus ?? null,
    candidatePipelineCacheStatus: field.candidatePipelineCacheStatus ?? null,
    materialInterfaceRefreshStageMs: field.materialInterfaceRefreshStageMs ?? null,
    materialInterfaceRefreshTotalMs: field.materialInterfaceRefreshTotalMs ?? null,
    renderRowsReadback: Boolean(field.renderRowsReadback),
    renderRowsReadbackMode: field.renderRowsReadbackMode ?? null,
    materialInterfaceSurfaceTableSeedStatus: field.materialInterfaceSurfaceTableSeedStatus ?? null,
    materialInterfaceSurfaceTableSeedSource: field.materialInterfaceSurfaceTableSeedSource ?? null,
    materialInterfaceSurfaceTableSeedReadbackFree:
      Boolean(field.materialInterfaceSurfaceTableSeedReadbackFree),
    materialInterfaceSurfaceTableStatus: field.materialInterfaceSurfaceTableStatus ?? null,
    materialInterfaceSurfaceTableSurfaceCount: field.materialInterfaceSurfaceTableSurfaceCount ?? null,
    materialInterfaceSurfaceTableTotalFieldCells: field.materialInterfaceSurfaceTableTotalFieldCells ?? null,
    materialInterfaceSurfaceTableMaxResolution: field.materialInterfaceSurfaceTableMaxResolution ?? null,
    materialInterfaceSurfaceTableMaxFieldCells: field.materialInterfaceSurfaceTableMaxFieldCells ?? null,
    materialInterfaceSurfaceTableCoarse: Boolean(field.materialInterfaceSurfaceTableCoarse),
    residentSurfaceTableTotalFieldCells: field.residentSurfaceTableTotalFieldCells ?? null,
    renderFieldReadback: Boolean(field.renderFieldReadback),
    renderFieldReadbackMode: field.renderFieldReadbackMode ?? null,
    renderFieldSurfaceSummaryMode: field.renderFieldSurfaceSummaryMode ?? null,
    renderFieldSurfaceSummaryStatus: field.renderFieldSurfaceSummaryStatus ?? null,
    renderFieldSurfaceSummaryActiveSurfaceCount: field.renderFieldSurfaceSummaryActiveSurfaceCount ?? 0,
    renderFieldSurfaceSummaryActiveCellCount: field.renderFieldSurfaceSummaryActiveCellCount ?? 0,
    renderFieldSurfaceSummarySkipped: Boolean(field.renderFieldSurfaceSummarySkipped),
    renderFieldSurfaceSummarySkipReason: field.renderFieldSurfaceSummarySkipReason ?? null,
    surfaceCount: field.surfaceCount ?? 0,
    readySurfaceCount: field.readySurfaceCount ?? 0,
    totalSurfaceAreaM2: field.totalSurfaceAreaM2 ?? 0,
    elementCount: field.elementCount ?? 0,
    forceCouplingStatus: field.forceCouplingStatus ?? null,
    gpuAuthoritativeState: Boolean(field.gpuAuthoritativeState),
    compactRenderReadback: Boolean(field.compactRenderReadback)
  };
}

export function pressureInterfaceRenderStateFields(pressureState = null) {
  const forceRowsUploadFields = compactPressureInterfaceForceRowsUploadFields(
    pressureInterfaceForceRowsUploadFields(pressureState)
  );
  const schroederSourceKeyReplayDiagnostics = pressureState?.schroederSourceKeyReplayDiagnostics
    || buildSchroederSourceKeyReplayDiagnostics({ pressureInterfaceState: pressureState });
  return {
    residentPressureInterfaceStateSchema: pressureState?.schema ?? null,
    residentPressureInterfaceStateStatus: pressureState?.status ?? null,
    residentPressureInterfaceStateSource: pressureState?.source ?? null,
    residentPressureInterfaceStateSourceCadence: pressureState?.sourceCadence ?? null,
    pressureAuthority: pressureState?.pressureAuthority ?? null,
    materialInterfaceForceCouplingStatus: pressureState?.materialInterfaceForceCouplingStatus ?? null,
    pressureInterfaceCoupling: compactPressureStateObject(pressureState?.pressureInterfaceCoupling, [
      'forceCouplingStatus',
      'pressureFieldMode',
      'pressureFieldResolution',
      'localPressureGradientReady',
      'localPressureGradientStatus',
      'localPressureGradientForceCouplingStatus',
      'materialInterfaceReadySurfaceCount',
      'materialInterfaceTotalSurfaceAreaM2'
    ]),
    pressureInterfaceCouplingSchema: pressureState?.pressureInterfaceCouplingSchema ?? null,
    pressureInterfaceCouplingStatus: pressureState?.pressureInterfaceCouplingStatus ?? null,
    pressureInterfaceCouplingPreSolverStatus: pressureState?.pressureInterfaceCouplingPreSolverStatus ?? null,
    pressureInterfaceForceCouplingStatus: pressureState?.pressureInterfaceForceCouplingStatus ?? null,
    pressureInterfaceForcePreview: compactPressureStateObject(pressureState?.pressureInterfaceForcePreview, [
      'forceApplicationStatus',
      'previewedElementCount',
      'totalAbsInterfaceForceN',
      'pressureFieldMode',
      'pressureFieldResolution'
    ]),
    pressureInterfaceForcePreviewSchema: pressureState?.pressureInterfaceForcePreviewSchema ?? null,
    pressureInterfaceForcePreviewStatus: pressureState?.pressureInterfaceForcePreviewStatus ?? null,
    pressureInterfaceForceApplicationStatus: pressureState?.pressureInterfaceForceApplicationStatus ?? null,
    pressureInterfacePreviewedElementCount: pressureState?.pressureInterfacePreviewedElementCount ?? 0,
    pressureInterfaceTotalAbsForceN: pressureState?.pressureInterfaceTotalAbsForceN ?? 0,
    pressureInterfaceForceSolver: compactPressureStateObject(pressureState?.pressureInterfaceForceSolver, [
      'forceApplicationStatus',
      'forceCouplingStatus',
      'forceRowCount',
      'forceRowStrideFloats',
      'forceRowByteLength',
      'conservationStatus',
      'conservationResidualMagnitudeN',
      'pressureFieldMode',
      'pressureFieldResolution',
      'pressureGradientStatus',
      'localPressureGradientReady',
      'localPressureGradientStatus',
      'localPressureGradientForceCouplingStatus',
      'gasPressureCellRowCount',
      'gasPressureCellRowsBufferRetained',
      'interfaceSourceKeySchema',
      'interfaceSourceKeyStatus',
      'interfaceSourceKeyConsumerStatus',
      'interfaceSourceKeyRowCount',
      'interfaceSourceKeyReadyCount',
      'interfaceSourceKeyBufferObserved',
      'interfaceSourceKeyBufferConsumed',
      'interfaceSourceKeySurfaceIndexFallbackEnabled',
      'gridForceApplicationApproved'
    ]),
    pressureInterfaceForceSolverSchema: pressureState?.pressureInterfaceForceSolverSchema ?? null,
    pressureInterfaceForceSolverStatus: pressureState?.pressureInterfaceForceSolverStatus ?? null,
    schroederSourceKeyReplayDiagnostics,
    schroederSourceKeyReplayDiagnosticsSchema: schroederSourceKeyReplayDiagnostics?.schema ?? null,
    schroederSourceKeyReplayDiagnosticsStatus: schroederSourceKeyReplayDiagnostics?.status ?? null,
    schroederSourceKeyReplayReady: schroederSourceKeyReplayDiagnostics?.replayReady ?? false,
    schroederSourceKeyReplayProductionStatus:
      schroederSourceKeyReplayDiagnostics?.productionStatus ?? null,
    schroederSourceKeyReplayProductionRowCount:
      schroederSourceKeyReplayDiagnostics?.productionRowCount ?? 0,
    schroederSourceKeyReplayProductionReadyCount:
      schroederSourceKeyReplayDiagnostics?.productionReadyCount ?? 0,
    schroederSourceKeyReplayRetainedRefPublicationStatus:
      schroederSourceKeyReplayDiagnostics?.retainedRefPublicationStatus ?? null,
    schroederSourceKeyReplayRetainedRefPublicationReady:
      schroederSourceKeyReplayDiagnostics?.retainedRefPublicationReady ?? false,
    schroederSourceKeyReplayRetainedBufferRefCount:
      schroederSourceKeyReplayDiagnostics?.retainedBufferRefCount ?? 0,
    schroederSourceKeyReplayPressureConsumerStatus:
      schroederSourceKeyReplayDiagnostics?.pressureConsumerStatus ?? null,
    schroederSourceKeyReplayPressureConsumerObserved:
      schroederSourceKeyReplayDiagnostics?.pressureConsumerObserved ?? false,
    schroederSourceKeyReplayPressureConsumerConsumed:
      schroederSourceKeyReplayDiagnostics?.pressureConsumerConsumed ?? false,
    schroederSourceKeyReplayPressureConsumerRowCount:
      schroederSourceKeyReplayDiagnostics?.pressureConsumerRowCount ?? 0,
    schroederSourceKeyReplayPressureConsumerReadyCount:
      schroederSourceKeyReplayDiagnostics?.pressureConsumerReadyCount ?? 0,
    schroederSourceKeyReplayRawGpuBufferSerialized:
      schroederSourceKeyReplayDiagnostics?.rawGpuBufferSerialized ?? false,
    schroederSourceKeyReplayPortablePayloadMode:
      schroederSourceKeyReplayDiagnostics?.portablePayloadMode ?? null,
    pressureInterfaceSolverApplicationStatus: pressureState?.pressureInterfaceSolverApplicationStatus ?? null,
    pressureInterfaceSolverForceRowCount: pressureState?.pressureInterfaceSolverForceRowCount ?? 0,
    pressureInterfaceSolverConservationStatus: pressureState?.pressureInterfaceSolverConservationStatus ?? null,
    pressureInterfaceSolverConservationResidualMagnitudeN: pressureState?.pressureInterfaceSolverConservationResidualMagnitudeN ?? 0,
    pressureInterfaceGridForceAdmission: compactPressureStateObject(pressureState?.pressureInterfaceGridForceAdmission, [
      'publicationStatus',
      'admittedStatus',
      'sourceHotBufferKey',
      'hotBufferKey'
    ]),
    pressureInterfaceGridForceAdmissionSchema: pressureState?.pressureInterfaceGridForceAdmissionSchema ?? null,
    pressureInterfaceGridForceAdmissionStatus: pressureState?.pressureInterfaceGridForceAdmissionStatus ?? null,
    pressureInterfaceGridForceAdmissionApproved: pressureState?.pressureInterfaceGridForceAdmissionApproved ?? false,
    pressureInterfaceGridForceAdmissionDescriptorStatus: pressureState?.pressureInterfaceGridForceAdmissionDescriptorStatus ?? null,
    pressureInterfaceGridForceAdmissionSourceHotBufferKey: pressureState?.pressureInterfaceGridForceAdmissionSourceHotBufferKey ?? null,
    pressureInterfaceGasCellFieldImportPublication: compactPressureStateObject(pressureState?.pressureInterfaceGasCellFieldImportPublication, [
      'blocker',
      'committed',
      'hotBufferKey',
      'pressureInterfaceGasCellFieldImportStatus',
      'pressureInterfaceGasCellFieldImportReady',
      'pressureInterfaceGasCellFieldAdmissionStatus',
      'pressureInterfaceGasCellFieldAdmissionApproved'
    ]),
    pressureInterfaceGasCellFieldImportPublicationSchema: pressureState?.pressureInterfaceGasCellFieldImportPublicationSchema ?? null,
    pressureInterfaceGasCellFieldImportPublicationStatus: pressureState?.pressureInterfaceGasCellFieldImportPublicationStatus ?? null,
    pressureInterfaceGasCellFieldImportPublicationBlocker: pressureState?.pressureInterfaceGasCellFieldImportPublicationBlocker ?? null,
    pressureInterfaceGasCellFieldImportPublicationCommitted: pressureState?.pressureInterfaceGasCellFieldImportPublicationCommitted ?? false,
    pressureInterfaceGasCellFieldImportPublicationHotBufferKey: pressureState?.pressureInterfaceGasCellFieldImportPublicationHotBufferKey ?? null,
    pressureInterfaceGasCellFieldImport: compactPressureStateObject(pressureState?.pressureInterfaceGasCellFieldImport, [
      'cellCount',
      'rowCount',
      'sourceHotBufferKey',
      'hotBufferKey',
      'bufferRetained'
    ]),
    pressureInterfaceGasCellFieldImportSchema: pressureState?.pressureInterfaceGasCellFieldImportSchema ?? null,
    pressureInterfaceGasCellFieldImportStatus: pressureState?.pressureInterfaceGasCellFieldImportStatus ?? null,
    pressureInterfaceGasCellFieldImportReady: pressureState?.pressureInterfaceGasCellFieldImportReady ?? false,
    pressureInterfaceGasCellFieldImportSourceHotBufferKey: pressureState?.pressureInterfaceGasCellFieldImportSourceHotBufferKey ?? null,
    pressureInterfaceGasCellFieldAdmission: compactPressureStateObject(pressureState?.pressureInterfaceGasCellFieldAdmission, [
      'publicationStatus',
      'admittedStatus',
      'sourceHotBufferKey',
      'hotBufferKey'
    ]),
    pressureInterfaceGasCellFieldAdmissionSchema: pressureState?.pressureInterfaceGasCellFieldAdmissionSchema ?? null,
    pressureInterfaceGasCellFieldAdmissionStatus: pressureState?.pressureInterfaceGasCellFieldAdmissionStatus ?? null,
    pressureInterfaceGasCellFieldAdmissionApproved: pressureState?.pressureInterfaceGasCellFieldAdmissionApproved ?? false,
    pressureInterfaceGasCellFieldAdmissionPublication: compactPressureStateObject(pressureState?.pressureInterfaceGasCellFieldAdmissionPublication, [
      'publicationStatus',
      'admittedStatus',
      'sourceHotBufferKey',
      'hotBufferKey'
    ]),
    pressureInterfaceGasCellFieldAdmissionPublicationSchema: pressureState?.pressureInterfaceGasCellFieldAdmissionPublicationSchema ?? null,
    pressureInterfaceGasCellFieldAdmissionPublicationStatus: pressureState?.pressureInterfaceGasCellFieldAdmissionPublicationStatus ?? null,
    pressureInterfaceGasCellFieldAdmissionPublicationHotBufferKey: pressureState?.pressureInterfaceGasCellFieldAdmissionPublicationHotBufferKey ?? null,
    pressureInterfaceGasCellFieldRetainedGasPressureBufferRefs: [
      ...(pressureState?.pressureInterfaceGasCellFieldRetainedGasPressureBufferRefs || [])
    ],
    pressureInterfaceGasCellFieldWorkerRetainedGasPressureBufferRefs: [
      ...(pressureState?.pressureInterfaceGasCellFieldWorkerRetainedGasPressureBufferRefs || [])
    ],
    ...forceRowsUploadFields
  };
}

const CONDENSED_SURFACE_BASELINE = Object.freeze({
  resolution: 18,
  subtract: 24,
  isolation: 80,
  maxPolyCount: 24000
});
const VAPOR_SURFACE_BASELINE = Object.freeze({
  resolution: 16,
  subtract: 10,
  isolation: 24,
  maxPolyCount: 20000
});

// Derive marching-cubes field thresholds continuously from phase and condensed
// reference density (zero material-name h2o/fe/steam lookup hacks).
export function surfaceConfigForDescriptor(renderKey, phase, densityKgPerM3 = null) {
  const phaseName = String(phase ?? '').toLowerCase();
  if (phaseName === 'gas' || phaseName === 'vapor' || phaseName === 'plasma') {
    return VAPOR_SURFACE_BASELINE;
  }
  const rho = Number(densityKgPerM3);
  if (Number.isFinite(rho) && rho > 0) {
    const densityFactor = Math.min(1, Math.max(0, Math.log10(Math.max(rho, 500) / 1000)));
    return {
      resolution: CONDENSED_SURFACE_BASELINE.resolution,
      subtract: CONDENSED_SURFACE_BASELINE.subtract + 2 * densityFactor,
      isolation: CONDENSED_SURFACE_BASELINE.isolation + 2 * densityFactor,
      maxPolyCount: CONDENSED_SURFACE_BASELINE.maxPolyCount
    };
  }
  return CONDENSED_SURFACE_BASELINE;
}

const CPU_SURFACE_ADAPTIVE_RESOLUTION = Object.freeze([
  { maxParticles: 8, resolution: 12, maxPolyCount: 9000 },
  { maxParticles: 27, resolution: 14, maxPolyCount: 14000 },
  { maxParticles: 64, resolution: 16, maxPolyCount: 19000 }
]);

export const SPH_RESIDENT_SURFACE_DRAW_OIT_COMPOSITE_WGSL = `
struct VertexOut {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@group(0) @binding(0) var accum_texture: texture_2d<f32>;
@group(0) @binding(1) var reveal_texture: texture_2d<f32>;
@group(0) @binding(2) var linear_sampler: sampler;

@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32) -> VertexOut {
  var positions = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );
  let position = positions[vertex_index];
  var out: VertexOut;
  out.position = vec4<f32>(position, 0.0, 1.0);
  out.uv = position * 0.5 + vec2<f32>(0.5, 0.5);
  return out;
}

@fragment
fn fs_main(in: VertexOut) -> @location(0) vec4<f32> {
  let accum = textureSampleLevel(accum_texture, linear_sampler, in.uv, 0.0);
  let reveal = textureSampleLevel(reveal_texture, linear_sampler, in.uv, 0.0).r;
  let alpha = clamp(1.0 - reveal, 0.0, 1.0);
  let color = accum.rgb / max(accum.a, 0.00001);
  return vec4<f32>(color * alpha, alpha);
}
`;

export const SPH_RESIDENT_RENDER_ROW_OVERLAY_WGSL = `
struct CameraUniform {
  view_projection: mat4x4<f32>,
  viewport_radius_mode: vec4<f32>,
};

struct VertexOut {
  @builtin(position) position: vec4<f32>,
  @location(0) quad_uv: vec2<f32>,
  @location(1) color: vec4<f32>,
};

@group(0) @binding(0) var<storage, read> render_rows: array<vec4<f32>>;
@group(0) @binding(1) var<uniform> camera_data: CameraUniform;

const RENDER_ROW_VEC4_STRIDE: u32 = ${Math.max(1, Math.ceil(SPH_GPU_RENDER_ROW_FLOATS / 4))}u;

fn render_row0(particle_index: u32) -> vec4<f32> {
  return render_rows[particle_index * RENDER_ROW_VEC4_STRIDE];
}

fn render_row1(particle_index: u32) -> vec4<f32> {
  return render_rows[particle_index * RENDER_ROW_VEC4_STRIDE + 1u];
}

fn render_row2(particle_index: u32) -> vec4<f32> {
  return render_rows[particle_index * RENDER_ROW_VEC4_STRIDE + 2u];
}

fn render_row_color(row1: vec4<f32>, row2: vec4<f32>) -> vec4<f32> {
  let phase_id = round(row1.y);
  let render_domain_id = round(row2.w);
  var color = vec3<f32>(0.55, 0.78, 1.0);
  if (phase_id < 1.5) {
    color = vec3<f32>(0.9, 0.95, 1.0);
  } else if (phase_id < 2.5) {
    color = vec3<f32>(0.1, 0.72, 1.0);
  } else if (phase_id < 3.5) {
    color = vec3<f32>(0.82, 1.0, 1.0);
  }
  if (render_domain_id == 2.0) {
    color = mix(color, vec3<f32>(1.0, 0.62, 0.25), 0.35);
  }
  let heat = clamp((row1.z - 300.0) / 1200.0, 0.0, 1.0);
  color = mix(color, vec3<f32>(1.0, 0.28, 0.08), heat * 0.45);
  return vec4<f32>(color, 1.0);
}

fn quad_corner(vertex_index: u32) -> vec2<f32> {
  var corners = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(1.0, -1.0),
    vec2<f32>(-1.0, 1.0),
    vec2<f32>(-1.0, 1.0),
    vec2<f32>(1.0, -1.0),
    vec2<f32>(1.0, 1.0)
  );
  return corners[vertex_index % 6u];
}

@vertex
fn vs_main(
  @builtin(vertex_index) vertex_index: u32,
  @builtin(instance_index) instance_index: u32
) -> VertexOut {
  let row0 = render_row0(instance_index);
  let row1 = render_row1(instance_index);
  let row2 = render_row2(instance_index);
  let represented_count = row2.z;
  let corner = quad_corner(vertex_index);
  var clip = camera_data.view_projection * vec4<f32>(row0.xyz, 1.0);
  clip.z = clip.z * 0.5 + clip.w * 0.5;
  let viewport = max(camera_data.viewport_radius_mode.xy, vec2<f32>(1.0, 1.0));
  let radius_px = max(camera_data.viewport_radius_mode.z, 1.0);
  let pixel_scale = vec2<f32>(2.0 / viewport.x, 2.0 / viewport.y);
  let expanded_radius = radius_px * clamp(sqrt(max(represented_count, 1.0)), 1.0, 3.5);
  clip.xy = clip.xy + corner * pixel_scale * expanded_radius * clip.w;
  if (clip.w <= 0.0) {
    clip = vec4<f32>(2.0, 2.0, 1.0, 1.0);
  }
  var out: VertexOut;
  out.position = clip;
  out.quad_uv = corner;
  out.color = render_row_color(row1, row2);
  return out;
}

@fragment
fn fs_main(in: VertexOut) -> @location(0) vec4<f32> {
  let r2 = dot(in.quad_uv, in.quad_uv);
  if (r2 > 1.0) {
    discard;
  }
  let edge = 1.0 - smoothstep(0.72, 1.0, r2);
  return vec4<f32>(in.color.rgb * in.color.a * edge, in.color.a * edge);
}
`;

export const SPH_SCHROEDER_RENDER_PROXY_NATIVE_WGSL = `
struct CameraUniform {
  view_projection: mat4x4<f32>,
  viewport_radius_mode: vec4<f32>,
  grid_scale_bias: vec4<f32>,
};

struct BatchUniform {
  row_count_stride_kind_radius: vec4<f32>,
  native_grid_spacing_and_color: vec4<f32>,
};

struct VertexOut {
  @builtin(position) position: vec4<f32>,
  @location(0) quad_uv: vec2<f32>,
  @location(1) color: vec4<f32>,
};

@group(0) @binding(0) var<storage, read> proxy_rows: array<vec4<f32>>;
@group(0) @binding(1) var<uniform> camera_data: CameraUniform;
@group(0) @binding(2) var<uniform> batch_data: BatchUniform;

fn row_vec4(row_index: u32, slot_index: u32) -> vec4<f32> {
  let stride_vec4 = max(1u, u32(batch_data.row_count_stride_kind_radius.y) / 4u);
  return proxy_rows[row_index * stride_vec4 + slot_index];
}

fn proxy_position_m(row_index: u32) -> vec3<f32> {
  let proxy_kind = batch_data.row_count_stride_kind_radius.z;
  if (proxy_kind < 0.5) {
    return row_vec4(row_index, 3u).xyz;
  }
  let aggregate_cell = row_vec4(row_index, 1u).xyz;
  let spacing = max(batch_data.native_grid_spacing_and_color.x, camera_data.grid_scale_bias.x);
  return aggregate_cell * max(spacing, 0.000001) + vec3<f32>(camera_data.grid_scale_bias.y);
}

fn proxy_radius_px(row_index: u32) -> f32 {
  let base_radius = max(batch_data.row_count_stride_kind_radius.w, 1.0);
  let proxy_kind = batch_data.row_count_stride_kind_radius.z;
  if (proxy_kind < 0.5) {
    let support_radius_m = max(row_vec4(row_index, 2u).y, 0.000001);
    return clamp(base_radius * sqrt(support_radius_m / max(camera_data.grid_scale_bias.x, 0.000001)), 2.0, 28.0);
  }
  let represented_volume = max(row_vec4(row_index, 2u).y, 0.000001);
  return clamp(base_radius * pow(represented_volume, 1.0 / 6.0), 3.0, 36.0);
}

fn quad_corner(vertex_index: u32) -> vec2<f32> {
  var corners = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(1.0, -1.0),
    vec2<f32>(-1.0, 1.0),
    vec2<f32>(-1.0, 1.0),
    vec2<f32>(1.0, -1.0),
    vec2<f32>(1.0, 1.0)
  );
  return corners[vertex_index % 6u];
}

@vertex
fn vs_main(
  @builtin(vertex_index) vertex_index: u32,
  @builtin(instance_index) instance_index: u32
) -> VertexOut {
  let row_count = u32(batch_data.row_count_stride_kind_radius.x);
  var clip = vec4<f32>(2.0, 2.0, 1.0, 1.0);
  let corner = quad_corner(vertex_index);
  if (instance_index < row_count) {
    let position_m = proxy_position_m(instance_index);
    clip = camera_data.view_projection * vec4<f32>(position_m, 1.0);
    clip.z = clip.z * 0.5 + clip.w * 0.5;
    let viewport = max(camera_data.viewport_radius_mode.xy, vec2<f32>(1.0, 1.0));
    let radius_px = proxy_radius_px(instance_index);
    let pixel_scale = vec2<f32>(2.0 / viewport.x, 2.0 / viewport.y);
    clip.xy = clip.xy + corner * pixel_scale * radius_px * clip.w;
    if (clip.w <= 0.0) {
      clip = vec4<f32>(2.0, 2.0, 1.0, 1.0);
    }
  }
  var out: VertexOut;
  out.position = clip;
  out.quad_uv = corner;
  out.color = vec4<f32>(
    batch_data.native_grid_spacing_and_color.y,
    batch_data.native_grid_spacing_and_color.z,
    batch_data.native_grid_spacing_and_color.w,
    0.82
  );
  return out;
}

@fragment
fn fs_main(in: VertexOut) -> @location(0) vec4<f32> {
  let r2 = dot(in.quad_uv, in.quad_uv);
  if (r2 > 1.0) {
    discard;
  }
  let edge = 1.0 - smoothstep(0.72, 1.0, r2);
  return vec4<f32>(in.color.rgb * in.color.a * edge, in.color.a * edge);
}
`;

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeResidentReadbackMode(value) {
  return value === RESIDENT_FULL_READBACK_MODE ? RESIDENT_FULL_READBACK_MODE : RESIDENT_NO_FULL_READBACK_MODE;
}

// Inset the simulation box inside the marching-cubes field cube so an isosurface that reaches a box
// face is NOT hard-clipped flat at the field boundary — the metaball is given room on the far side
// of the wall to close into a rounded surface, so a blob resting against the floor/wall renders as a
// complete dome instead of a sliced-off plane. The padding is mapped per-axis (below); the mesh
// scale is widened by 1/(1-2·pad) so the padded [0,1] field still aligns with the box wireframe.
// A metaball's surface extends ~radiusNorm·√((iso+sub)/iso) ≈ 1.15·radiusNorm from its centre, and
// radiusNorm is clamped to ≤0.14, so the surface reaches ~0.16 past a wall-hugging particle — the
// padding must exceed that to fully contain the dome. Resolutions are raised to keep box detail
// since the box now occupies only (1−2·pad) of each field axis.
export const FIELD_PADDING = 0.22;
// First worker-owned keyframe tier. At 48^3 the generalized dense field and
// marching-cubes passes are small enough to remain a presentation consumer,
// while preserving a smooth true surface. Temporal presentation can redraw
// and advect this retained mesh independently between authoritative keyframes.
export const SPH_WORKER_OWNED_ISOSURFACE_FIELD_RESOLUTION = 48;
// 96 (from 64) after the extraction vertex-rows budget landed: vertex
// allocation no longer scales with res³ (extension clamp), so the ceiling is
// bound by field-buffer memory and field-kernel cost, not by worst-case
// marching-cubes vertices. The total-cell budget below preserves that
// four-surface working set when dynamic material/phase lanes expand.
export const RESIDENT_RENDER_FIELD_MAX_RESOLUTION = 96;
export const SPH_NATIVE_RENDER_FIELD_TOTAL_CELLS_BUDGET_DEFAULT =
  4 * RESIDENT_RENDER_FIELD_MAX_RESOLUTION ** 3;

export function estimateNativeMarchingCubesVertexRowsByteLengthForResolution(
  resolution,
  surfaceCount = 1
) {
  const resolvedResolution = Math.max(2, Math.round(Number(resolution) || 2));
  const resolvedSurfaceCount = Math.max(1, Math.round(Number(surfaceCount) || 1));
  const dualGridVoxelCount = Math.max(0, resolvedResolution - 1) ** 3;
  return resolvedSurfaceCount
    * dualGridVoxelCount
    * SPH_NATIVE_MARCHING_CUBES_MAX_VERTICES_PER_VOXEL
    * SPH_GPU_RENDER_SURFACE_VERTEX_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
}

// Per-surface vertex-rows cap for the extraction extension's budget clamp:
// the extension allocates min(worst-case, budget) rows, bounds-guards writes,
// and clamps the indirect draw count, so the translated-rows budget below is
// a hard allocation bound rather than a resolution driver.
export function nativeMarchingCubesVertexRowsBudgetPerSurface(surfaceCount, {
  maxVertexRowsBufferByteLength = SPH_NATIVE_MARCHING_CUBES_VERTEX_ROWS_BYTE_BUDGET_DEFAULT,
  device = null,
  maxStorageBufferBindingSize = null
} = {}) {
  const resolvedSurfaceCount = Math.max(1, Math.round(Number(surfaceCount) || 1));
  const bytesPerVertexRow = SPH_GPU_RENDER_SURFACE_VERTEX_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const deviceStorageLimit = Number(
    maxStorageBufferBindingSize ?? device?.limits?.maxStorageBufferBindingSize
  );
  const rawBudget = Math.max(
    bytesPerVertexRow,
    Math.round(
      Number(maxVertexRowsBufferByteLength)
      || SPH_NATIVE_MARCHING_CUBES_VERTEX_ROWS_BYTE_BUDGET_DEFAULT
    )
  );
  const resolvedBudget = Number.isFinite(deviceStorageLimit) && deviceStorageLimit >= bytesPerVertexRow
    ? Math.min(rawBudget, Math.floor(deviceStorageLimit))
    : rawBudget;
  return Math.max(3, Math.floor(resolvedBudget / resolvedSurfaceCount / bytesPerVertexRow));
}

export function nativeMarchingCubesRenderFieldResolutionForVertexRowsBudget(surfaceCount, {
  maxVertexRowsBufferByteLength = SPH_NATIVE_MARCHING_CUBES_VERTEX_ROWS_BYTE_BUDGET_DEFAULT,
  device = null,
  maxStorageBufferBindingSize = null,
  maxResolution = RESIDENT_RENDER_FIELD_MAX_RESOLUTION,
  maxTotalFieldCells = SPH_NATIVE_RENDER_FIELD_TOTAL_CELLS_BUDGET_DEFAULT,
  // When the extraction path enforces a per-surface vertex-rows budget
  // (extension clamp), the worst-case allocation math no longer binds the
  // field resolution — only the requested/global caps apply.
  vertexRowsBudgetEnforcedByExtraction = false
} = {}) {
  const resolvedSurfaceCount = Math.max(1, Math.round(Number(surfaceCount) || 1));
  const bytesPerVertexRow = SPH_GPU_RENDER_SURFACE_VERTEX_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const deviceStorageLimit = Number(
    maxStorageBufferBindingSize ?? device?.limits?.maxStorageBufferBindingSize
  );
  const rawBudget = Math.max(
    bytesPerVertexRow,
    Math.round(
      Number(maxVertexRowsBufferByteLength)
      || SPH_NATIVE_MARCHING_CUBES_VERTEX_ROWS_BYTE_BUDGET_DEFAULT
    )
  );
  const resolvedBudget = Number.isFinite(deviceStorageLimit) && deviceStorageLimit >= bytesPerVertexRow
    ? Math.min(rawBudget, Math.floor(deviceStorageLimit))
    : rawBudget;
  const resolvedRequestedMax = Math.max(
    2,
    Math.round(Number(maxResolution) || RESIDENT_RENDER_FIELD_MAX_RESOLUTION)
  );
  const resolvedTotalFieldCellBudget = Math.max(
    8,
    Math.round(
      Number(maxTotalFieldCells)
      || SPH_NATIVE_RENDER_FIELD_TOTAL_CELLS_BUDGET_DEFAULT
    )
  );
  const totalFieldCellBudgetResolution = Math.max(
    2,
    Math.floor(Math.cbrt(
      Math.max(8, Math.floor(resolvedTotalFieldCellBudget / resolvedSurfaceCount))
    ))
  );
  if (vertexRowsBudgetEnforcedByExtraction) {
    return Math.max(2, Math.min(
      resolvedRequestedMax,
      RESIDENT_RENDER_FIELD_MAX_RESOLUTION,
      totalFieldCellBudgetResolution
    ));
  }
  const bytesPerDualGridVoxel = SPH_NATIVE_MARCHING_CUBES_MAX_VERTICES_PER_VOXEL
    * SPH_GPU_RENDER_SURFACE_VERTEX_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  const budgetedDualGridVoxelsPerSurface = Math.max(
    1,
    Math.floor(resolvedBudget / resolvedSurfaceCount / bytesPerDualGridVoxel)
  );
  const budgetedDualGridResolution = Math.max(1, Math.floor(Math.cbrt(budgetedDualGridVoxelsPerSurface)));
  return Math.max(2, Math.min(
    resolvedRequestedMax,
    RESIDENT_RENDER_FIELD_MAX_RESOLUTION,
    totalFieldCellBudgetResolution,
    budgetedDualGridResolution + 1
  ));
}

export function normalizeSurfaceRadiusForRenderField(radiusM, refEdgeM, fieldPadding = FIELD_PADDING) {
  const radius = Number.isFinite(radiusM) && radiusM > 0 ? radiusM : 0;
  const refEdge = Math.max(Number.isFinite(refEdgeM) && refEdgeM > 0 ? refEdgeM : 1, 1e-12);
  const span = Math.max(1e-12, 1 - 2 * fieldPadding);
  return clamp((radius / refEdge) * span, 0.001, 0.14);
}

export function surfaceRadiusMetersFromRenderFieldRadius(radiusNorm, refEdgeM, fieldPadding = FIELD_PADDING) {
  const norm = Number.isFinite(radiusNorm) && radiusNorm > 0 ? radiusNorm : 0;
  const refEdge = Math.max(Number.isFinite(refEdgeM) && refEdgeM > 0 ? refEdgeM : 1, 1e-12);
  const span = Math.max(1e-12, 1 - 2 * fieldPadding);
  return norm * refEdge / span;
}

export function cpuMarchingCubesCellSizeM(refEdgeM, resolution, fieldPadding = FIELD_PADDING) {
  const refEdge = Math.max(Number.isFinite(refEdgeM) && refEdgeM > 0 ? refEdgeM : 1, 1e-12);
  const span = Math.max(1e-12, 1 - 2 * fieldPadding);
  const res = Math.max(2, Math.round(Number(resolution) || 2));
  return (1 / (res - 1)) * (refEdge / span);
}

export function cpuMarchingCubesRadiusFloorM(
  refEdgeM,
  resolution,
  fieldPadding = FIELD_PADDING,
  floorCells = SPH_CPU_MARCHING_CUBES_RADIUS_FLOOR_CELLS
) {
  const cells = Math.max(
    1e-6,
    Number.isFinite(floorCells) && floorCells > 0
      ? floorCells
      : SPH_CPU_MARCHING_CUBES_RADIUS_FLOOR_CELLS
  );
  return cells * cpuMarchingCubesCellSizeM(refEdgeM, resolution, fieldPadding);
}

function materialKeyOf(value) {
  return typeof value === 'string' && value.length > 0 ? value : 'default';
}

export function adaptiveCpuSurfaceConfig(baseConfig, particleCount = Infinity) {
  const count = Number.isFinite(particleCount) ? particleCount : Infinity;
  if (count > 0 && count <= SPH_SPARSE_SURFACE_RADIUS_SCALE_MAX_PARTICLES) {
    return {
      ...baseConfig,
      resolution: Math.max(baseConfig.resolution, SPH_SPARSE_RENDER_FIELD_RESOLUTION_MIN),
      maxPolyCount: Math.max(baseConfig.maxPolyCount, 24000)
    };
  }
  const adaptive = CPU_SURFACE_ADAPTIVE_RESOLUTION.find((entry) => count <= entry.maxParticles);
  if (!adaptive) {
    return {
      ...baseConfig,
      resolution: Math.max(baseConfig.resolution, SPH_CPU_MARCHING_CUBES_RESOLUTION_MIN),
      maxPolyCount: Math.max(baseConfig.maxPolyCount, 48000)
    };
  }
  return {
    ...baseConfig,
    resolution: Math.max(
      Math.min(baseConfig.resolution, adaptive.resolution),
      SPH_CPU_MARCHING_CUBES_RESOLUTION_MIN
    ),
    maxPolyCount: Math.max(
      Math.min(baseConfig.maxPolyCount, adaptive.maxPolyCount),
      24000
    )
  };
}

export function normalizeRenderDomainId(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
}

export function normalizeRenderDomainCounts(counts = null) {
  const base = Math.max(0, Math.round(Number(counts?.base) || 0));
  const drop = Math.max(0, Math.round(Number(counts?.drop) || 0));
  const live = Math.max(0, Math.round(Number(counts?.live) || (base + drop)));
  const total = Math.max(0, Math.round(Number(counts?.total) || (base + drop)));
  if (base <= 0 && drop <= 0) return null;
  return { base, drop, live, total };
}

export function cohortRangesFromRenderDomainCounts(counts = null) {
  const normalized = normalizeRenderDomainCounts(counts);
  if (!normalized) return null;
  return {
    schema: 'peercompute.ulg.sph-role-cohort-ranges.v0',
    source: 'initial-particle-order',
    base: {
      role: 'base',
      startIndex: 0,
      endIndex: normalized.base,
      count: normalized.base
    },
    drop: {
      role: 'drop',
      startIndex: normalized.base,
      endIndex: normalized.base + normalized.drop,
      count: normalized.drop
    },
    total: normalized.total
  };
}

export function renderDomainPositionBoundsFromPositions(positionsM, counts = null) {
  const normalized = normalizeRenderDomainCounts(counts);
  const particleCount = Math.floor((positionsM?.length || 0) / 3);
  if (!normalized || particleCount <= 0) return null;
  const rangeBounds = (role, startIndex, endIndex) => {
    const start = Math.max(0, Math.min(particleCount, Math.round(startIndex)));
    const end = Math.max(start, Math.min(particleCount, Math.round(endIndex)));
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    let finitePositionCount = 0;
    for (let index = start; index < end; index += 1) {
      const x = Number(positionsM[index * 3]);
      const y = Number(positionsM[index * 3 + 1]);
      const z = Number(positionsM[index * 3 + 2]);
      if (![x, y, z].every(Number.isFinite)) continue;
      finitePositionCount += 1;
      min[0] = Math.min(min[0], x);
      min[1] = Math.min(min[1], y);
      min[2] = Math.min(min[2], z);
      max[0] = Math.max(max[0], x);
      max[1] = Math.max(max[1], y);
      max[2] = Math.max(max[2], z);
    }
    const boundsReady = finitePositionCount > 0;
    const size = boundsReady
      ? max.map((value, axis) => value - min[axis])
      : null;
    return {
      role,
      startIndex: start,
      endIndex: end,
      count: end - start,
      finitePositionCount,
      min: boundsReady ? min : null,
      max: boundsReady ? max : null,
      size,
      center: boundsReady
        ? min.map((value, axis) => value + size[axis] * 0.5)
        : null,
      status: boundsReady ? 'position-bounds-ready' : 'position-bounds-empty'
    };
  };
  const base = rangeBounds('base', 0, normalized.base);
  const drop = rangeBounds('drop', normalized.base, normalized.base + normalized.drop);
  const expectedTotal = normalized.base + normalized.drop;
  const capacityTailParticleCount = Math.max(0, particleCount - expectedTotal);
  return {
    schema: 'peercompute.ulg.sph-render-domain-position-bounds.v0',
    // Base/drop only describe live initial-body rows. The mechanics upload
    // may also contain zero-mass reaction reserves and fixed phase-carrier
    // lanes, so those live domains need to fit the capacity, not exhaust it.
    status: expectedTotal === normalized.live
      && normalized.live <= particleCount
      && normalized.total === particleCount
      ? 'render-domain-position-bounds-ready'
      : 'render-domain-position-count-mismatch',
    source: 'set-particles-positions-render-domain-counts',
    particleCount,
    expectedTotal,
    liveRenderDomainParticleCount: expectedTotal,
    capacityTailParticleCount,
    renderDomainCounts: { ...normalized },
    base,
    drop
  };
}

export function renderDomainExtractionOptions(counts = null) {
  const normalized = normalizeRenderDomainCounts(counts);
  return {
    renderDomainBaseCount: normalized?.base ?? 0,
    renderDomainDropCount: normalized?.drop ?? 0
  };
}

function renderDomainIdForParticleIndexFromCounts(index, counts = null) {
  const normalized = normalizeRenderDomainCounts(counts);
  if (!normalized) return 0;
  const particleIndex = Math.max(0, Math.round(Number(index) || 0));
  if (normalized.base > 0 && particleIndex < normalized.base) return 1;
  if (
    normalized.drop > 0
    && particleIndex >= normalized.base
    && particleIndex < normalized.base + normalized.drop
  ) {
    return 2;
  }
  return 0;
}

export function normalizePhysicalLawGroups(groups = null) {
  const defaults = {
    mechanics: true,
    gravity: true,
    eos: true,
    pressure: true,
    thermal: true,
    reactions: true,
    viscosity: true,
    surfaceTension: false
  };
  const normalized = { ...defaults };
  for (const key of Object.keys(defaults)) {
    if (groups && Object.prototype.hasOwnProperty.call(groups, key)) normalized[key] = groups[key] !== false;
  }
  return normalized;
}

export function physicalLawGroupsSignature(groups = currentPhysicalLawGroups) {
  const normalized = normalizePhysicalLawGroups(groups);
  return ['mechanics', 'gravity', 'eos', 'pressure', 'thermal', 'reactions', 'viscosity', 'surfaceTension']
    .map((key) => `${key}:${normalized[key] ? 1 : 0}`)
    .join(',');
}

export function compactPhaseVolumeSurfaceStressSubmissionForScene(step = null) {
  const submission = step?.gridUpdate?.phaseVolumeSurfaceStressSubmission
    ?? step?.phaseVolumeSurfaceStressSubmission
    ?? null;
  if (!submission) return null;
  return {
    schema: submission.schema ?? null,
    status: submission.status ?? null,
    requested: submission.requested === true,
    submitted: submission.submitted === true,
    dispatchCount: submission.dispatchCount ?? null,
    entryPoints: [...(submission.entryPoints || [])],
    lifecycleDispatchCount: submission.lifecycleDispatchCount ?? null,
    lifecycleMode: submission.lifecycleMode ?? null,
    ambientBuoyancyMode: submission.ambientBuoyancyMode ?? null,
    generationId: submission.generationId ?? null,
    selectedLevel: submission.selectedLevel ?? null,
    levelRole: submission.levelRole ?? null,
    twoLevel: submission.twoLevel === true,
    fieldCompletionOrdinal: submission.fieldCompletionOrdinal ?? null,
    materialTableSchema: submission.materialTableSchema ?? null,
    phaseRecordCount: submission.phaseRecordCount ?? null,
    positiveSurfaceTensionPhaseRecordCount:
      submission.positiveSurfaceTensionPhaseRecordCount ?? null,
    surfaceTensionCoefficientStatus:
      submission.surfaceTensionCoefficientStatus ?? null,
    authority: submission.authority ?? null,
    verification: submission.verification ?? null
  };
}

export function exactPhaseVolumeSurfaceStressSubmissionForScene(
  submission,
  schroederSummary
) {
  return Boolean(
    submission?.schema
      === ULG_SCHROEDER_PHASE_VOLUME_SURFACE_STRESS_SUBMISSION_SCHEMA
    && submission?.status
      === ULG_SCHROEDER_PHASE_VOLUME_SURFACE_STRESS_SUBMISSION_STATUS
    && submission?.requested === true
    && submission?.submitted === true
    && Number(submission?.dispatchCount)
      === SCHROEDER_PHASE_VOLUME_SURFACE_STRESS_ENTRY_POINTS.length
    && Number(submission?.lifecycleDispatchCount)
      === SCHROEDER_PHASE_VOLUME_SURFACE_STRESS_ENTRY_POINTS.length + 3
    && submission?.lifecycleMode
      === 'standalone-s9ab-initialize-ambient-eighteen-central-bonds-validate-commit'
    && submission?.ambientBuoyancyMode
      === 'field-local-s9ab-current-volume-ambient-source'
    && submission?.levelRole === 'single'
    && submission?.twoLevel === false
    && Number(submission?.fieldCompletionOrdinal) >= 1
    && Number(submission?.phaseRecordCount) > 0
    && Number(submission?.positiveSurfaceTensionPhaseRecordCount) > 0
    && submission?.surfaceTensionCoefficientStatus
      === 'positive-surface-tension-coefficient-ready'
    && submission?.authority
      === 'exact-s9-phase-volume-moment-and-mechanics-material-records'
    && submission?.verification === 'queue-submitted-no-full-readback'
    && submission?.generationId != null
    && submission.generationId
      === schroederSummary?.spatialEpochGeneration?.generationId
    && Number(submission?.selectedLevel)
      === Number(schroederSummary?.selectedLevel)
    && Array.isArray(submission?.entryPoints)
    && submission.entryPoints.length
      === SCHROEDER_PHASE_VOLUME_SURFACE_STRESS_ENTRY_POINTS.length
    && submission.entryPoints.every(
      (entryPoint, index) => (
        entryPoint
          === SCHROEDER_PHASE_VOLUME_SURFACE_STRESS_ENTRY_POINTS[index]
      )
    )
  );
}

function renderDomainKeyForId(renderDomainId) {
  const id = normalizeRenderDomainId(renderDomainId);
  if (id === 1) return 'base';
  if (id === 2) return 'drop';
  return null;
}

export function emissiveAuthorityValueForSurface(values, descriptor = {}) {
  const renderDomainId = normalizeRenderDomainId(descriptor.renderDomainId);
  const material = descriptor.material || 'unknown';
  const phase = descriptor.phase || 'unknown';
  if (renderDomainId > 0) {
    // Explicit initial-body identity is the stronger authority. Never fall
    // back to a material-wide hot average for a cold body of the same
    // material; absence of a domain value means that exact surface is not
    // incandescent.
    const key = `render-domain:${renderDomainId}|material:${material}|phase:${phase}`;
    return values?.[key] ?? null;
  }
  return values?.[material] ?? values?.[descriptor.renderKey] ?? null;
}

function surfaceKeyForDescriptor({
  renderKey,
  material,
  phase,
  opticalState = null,
  renderDomainId = 0,
  renderDomainKey = null,
  surfaceIdentityKey = null
}) {
  if (surfaceIdentityKey != null && String(surfaceIdentityKey).length > 0) {
    return String(surfaceIdentityKey);
  }
  const base = `${renderKey}|${material}|${phase ?? 'phase-unspecified'}`;
  // Legacy/ad-hoc callers can still describe two simultaneous optical
  // cohorts of the same material and phase without supplying a domain. Once
  // a descriptor has a surface key, subsequent live optical updates preserve
  // it through surfaceIdentityKey instead of recomputing from these values.
  const opticalStateKey = stableOpticalStateKey(opticalState);
  const opticalKey = opticalStateKey === 'default' ? base : `${base}|opt:${opticalStateKey}`;
  const domainId = normalizeRenderDomainId(renderDomainId);
  if (domainId <= 0) return opticalKey;
  return `${opticalKey}|domain:${renderDomainKey || renderDomainKeyForId(domainId) || domainId}`;
}

export function renderDescriptorOf(value) {
  if (value && typeof value === 'object') {
    const collectiveOpticalRoute = Boolean(
      value.schema === COLLECTIVE_DISPERSED_MEDIUM_OPTICAL_ROUTE_SCHEMA
      || value.collectiveOpticalRoute === true
    );
    const renderKey = materialKeyOf(value.renderKey ?? value.key ?? value.material);
    const material = materialKeyOf(value.material ?? ((renderKey === 'steam' || renderKey === 'ice') ? 'h2o' : renderKey));
    const phase = value.phase ?? (renderKey === 'steam' ? 'gas' : (renderKey === 'ice' ? 'solid' : null));
    const opticalState = value.opticalState || null;
    const renderDomainId = normalizeRenderDomainId(value.renderDomainId);
    const renderDomainKey = value.renderDomainKey || renderDomainKeyForId(renderDomainId);
    const surfaceKey = surfaceKeyForDescriptor({
      renderKey,
      material,
      phase,
      opticalState,
      renderDomainId,
      renderDomainKey,
      surfaceIdentityKey: value.surfaceIdentityKey ?? null
    });
    return {
      renderKey,
      material,
      phase,
      opticalState,
      opticalStateKey: stableOpticalStateKey(opticalState),
      // Positive optical state IDs are reserved for canonical collective
      // dispersed-medium routes. Ordinary carrier geometry always uses zero.
      opticalStateId: collectiveOpticalRoute
        && Number.isFinite(Number(value.opticalStateId))
        ? Number(value.opticalStateId)
        : 0,
      surfaceIdentityKey: value.surfaceIdentityKey ?? null,
      collectiveOpticalRoute,
      collectiveOpticalRouteSchema: collectiveOpticalRoute
        ? COLLECTIVE_DISPERSED_MEDIUM_OPTICAL_ROUTE_SCHEMA
        : null,
      collectiveOpticalRouteKey: collectiveOpticalRoute
        ? (value.routeKey ?? value.surfaceIdentityKey ?? null)
        : null,
      // Preserve the canonical route dimensions through the resident render
      // descriptor.  The collective optical presentation gate revalidates
      // these fields against the closure table before it grants visible-media
      // authority; reducing the descriptor to a surface key/id makes every
      // otherwise-valid route look forged at that boundary.
      routeId: collectiveOpticalRoute
        ? (value.routeId ?? value.collectiveOpticalRouteId ?? null)
        : null,
      materialId: collectiveOpticalRoute
        ? (value.materialId ?? null)
        : null,
      condensedPhase: collectiveOpticalRoute
        ? (value.condensedPhase ?? phase)
        : null,
      condensedPhaseId: collectiveOpticalRoute
        ? (value.condensedPhaseId ?? value.phaseId ?? null)
        : null,
      vaporPhase: collectiveOpticalRoute
        ? (value.vaporPhase ?? null)
        : null,
      vaporPhaseId: collectiveOpticalRoute
        ? (value.vaporPhaseId ?? null)
        : null,
      closureModel: collectiveOpticalRoute
        ? (value.closureModel ?? null)
        : null,
      closureModelId: collectiveOpticalRoute
        ? (value.closureModelId ?? null)
        : null,
      renderDomainId,
      renderDomainKey,
      surfaceKey
    };
  }
  const renderKey = materialKeyOf(value);
  const material = (renderKey === 'steam' || renderKey === 'ice') ? 'h2o' : renderKey;
  const phase = renderKey === 'steam' ? 'gas' : (renderKey === 'ice' ? 'solid' : null);
  const surfaceKey = surfaceKeyForDescriptor({ renderKey, material, phase });
  return {
    renderKey,
    material,
    phase,
    opticalState: null,
    opticalStateKey: 'default',
    opticalStateId: 0,
    surfaceIdentityKey: null,
    collectiveOpticalRoute: false,
    collectiveOpticalRouteSchema: null,
    collectiveOpticalRouteKey: null,
    renderDomainId: 0,
    renderDomainKey: null,
    surfaceKey
  };
}

export function buildResidentCollectiveOpticalRouteDescriptorSet({
  ordinaryDescriptors = [],
  collectiveRoutes = []
} = {}) {
  if (!Array.isArray(ordinaryDescriptors) || !Array.isArray(collectiveRoutes)) {
    throw new TypeError('resident optical descriptor inputs must be arrays');
  }
  const ordinary = ordinaryDescriptors.map((value) => {
    const descriptor = renderDescriptorOf(value);
    if (
      descriptor.collectiveOpticalRoute === true
      || descriptor.opticalStateId !== 0
    ) {
      throw new RangeError(
        'ordinary resident surfaces must use optical state id zero'
      );
    }
    return Object.freeze({ ...descriptor });
  });
  const routeIds = new Set();
  const routeKeys = new Set();
  const collective = collectiveRoutes.map((route) => {
    // Re-derive the route so an arbitrary self-consistent key/id pair cannot
    // claim canonical collective presentation authority.
    const canonicalRoute = collectiveOpticalRouteDescriptor(route);
    if (
      canonicalRoute.schema !== COLLECTIVE_DISPERSED_MEDIUM_OPTICAL_ROUTE_SCHEMA
      || !Number.isSafeInteger(Number(canonicalRoute.opticalStateId))
      || Number(canonicalRoute.opticalStateId) <= 0
      || canonicalRoute.routeId !== canonicalRoute.opticalStateId
      || canonicalRoute.routeKey !== canonicalRoute.surfaceIdentityKey
      || routeIds.has(canonicalRoute.opticalStateId)
      || routeKeys.has(canonicalRoute.routeKey)
    ) {
      throw new TypeError(
        'resident collective optical surfaces require unique canonical route descriptors'
      );
    }
    routeIds.add(canonicalRoute.opticalStateId);
    routeKeys.add(canonicalRoute.routeKey);
    const descriptor = Object.freeze(renderDescriptorOf({
      ...canonicalRoute,
      collectiveOpticalRoute: true,
      surfaceIdentityKey: canonicalRoute.routeKey,
      opticalStateId: canonicalRoute.opticalStateId,
      renderDomainId: 0,
      renderDomainKey: null
    }));
    if (
      descriptor.opticalStateId !== canonicalRoute.opticalStateId
      || descriptor.surfaceKey !== canonicalRoute.routeKey
      || descriptor.collectiveOpticalRoute !== true
    ) {
      throw new RangeError(
        'resident collective optical surface lost its canonical route identity'
      );
    }
    return Object.freeze({ route: canonicalRoute, descriptor });
  });
  return Object.freeze({
    ordinaryDescriptors: Object.freeze(ordinary),
    collective: Object.freeze(collective),
    positiveOpticalStateIds: Object.freeze([...routeIds].sort((a, b) => a - b))
  });
}

export function residentRenderGasPressureSummary({
  baselineSummary = null,
  residentStep = null,
  fieldBatches = [],
  materialProperties = null
} = {}) {
  const renderMaterials = [...new Set((fieldBatches || [])
    .map((batch) => String(batch?.material || '').trim().toLowerCase())
    .filter((material) => material && material !== 'unknown' && material !== 'air'))];
  if (!renderMaterials.includes('h2o')) return baselineSummary;
  const diagnostics = residentStep?.diagnostics || residentStep?.compactGpuSummary || null;
  const h2oGas = diagnostics?.residentPhaseGasSpeciesSummary?.bySpecies?.h2o
    || residentStep?.residentPhaseGasSpeciesSummary?.bySpecies?.h2o
    || null;
  // New resident summaries carry a species-resolved H2O gas row, so mixed
  // H2/H2O reaction scenes are safe. Older/fixture summaries may use the
  // aggregate phase mass only when H2O is provably the sole render material.
  const speciesResolved = h2oGas?.status === 'resident-phase-gas-species-ready';
  if (!speciesResolved && (renderMaterials.length !== 1 || renderMaterials[0] !== 'h2o')) {
    return baselineSummary;
  }
  const gasMassKg = Number(speciesResolved ? h2oGas.massKg : diagnostics?.phaseMassKg?.gas);
  if (!Number.isFinite(gasMassKg) || gasMassKg < 0) return baselineSummary;
  return gasPressureSummaryFromResidentThermalPhase({
    baselineSummary,
    gasMassKg,
    material: 'h2o',
    materialProperties: materialProperties || {},
    temperatureK: speciesResolved
      ? h2oGas.temperatureK
      : diagnostics?.temperatureMassWeightedMeanK
  }) || baselineSummary;
}

export function applyResidentWaterVaporOpticalStateToSurfaceBatches(
  batches = []
) {
  // Compatibility shim for external diagnostics. Aggregate gas pressure is
  // not conserved condensed-mass evidence and therefore may not mutate live
  // render-route authority.
  return [...(batches || [])];
}

export function materialKeyForSurfaceMaterialId(
  materialId,
  materialProperties = null,
  reactionTable = null,
  materialMap = null
) {
  const id = Math.round(Number(materialId));
  if (!Number.isFinite(id) || id <= 0) return null;
  const map = materialMap instanceof Map
    ? materialMap
    : buildSphRenderMaterialMap(materialProperties || {}, reactionTable);
  return map.get(id) ?? null;
}

export function renderDescriptorForSurfaceRecord(
  sourceSurface = {},
  surfaceIndex = 0,
  {
    materialProperties = null,
    reactionTable = null,
    materialMap = null
  } = {}
) {
  const surfaceMaterialId = Number(sourceSurface?.materialId);
  const surfacePhaseId = Number(sourceSurface?.phaseId);
  const material = sourceSurface?.material
    ?? materialKeyForSurfaceMaterialId(surfaceMaterialId, materialProperties, reactionTable, materialMap)
    ?? `material-${Number.isFinite(surfaceMaterialId) ? Math.round(surfaceMaterialId) : surfaceIndex}`;
  const phase = sourceSurface?.phase
    ?? phaseFromGpuPhaseId(surfacePhaseId)
    ?? `phase-${Number.isFinite(surfacePhaseId) ? Math.round(surfacePhaseId) : 0}`;
  const renderKey = sourceSurface?.renderKey
    ?? renderKeyForMaterialPhase(material, phase)
    ?? sourceSurface?.material
    ?? `surface-${surfaceIndex}`;
  const opticalStateId = Number(sourceSurface?.opticalStateId);
  // Positive optical IDs are an ABI-level collective-route discriminator.
  // Compact GPU metadata may retain only the numeric ID and stable surface
  // key, while richer CPU metadata also carries the explicit route schema.
  const collectiveOpticalRoute = Boolean(
    sourceSurface?.collectiveOpticalRoute === true
    || sourceSurface?.schema
      === COLLECTIVE_DISPERSED_MEDIUM_OPTICAL_ROUTE_SCHEMA
    || sourceSurface?.collectiveOpticalRouteSchema
      === COLLECTIVE_DISPERSED_MEDIUM_OPTICAL_ROUTE_SCHEMA
    || (Number.isSafeInteger(opticalStateId) && opticalStateId > 0)
  );
  const collectiveOpticalRouteKey =
    sourceSurface?.collectiveOpticalRouteKey
    ?? sourceSurface?.routeKey
    ?? sourceSurface?.surfaceIdentityKey
    ?? sourceSurface?.surfaceKey
    ?? null;
  return renderDescriptorOf({
    schema: sourceSurface?.schema
      ?? sourceSurface?.collectiveOpticalRouteSchema,
    collectiveOpticalRoute,
    routeKey: collectiveOpticalRouteKey,
    routeId: sourceSurface?.routeId ?? sourceSurface?.collectiveOpticalRouteId,
    material,
    materialId: sourceSurface?.materialId,
    phase,
    condensedPhase: sourceSurface?.condensedPhase ?? phase,
    condensedPhaseId: sourceSurface?.condensedPhaseId ?? sourceSurface?.phaseId,
    vaporPhase: sourceSurface?.vaporPhase,
    vaporPhaseId: sourceSurface?.vaporPhaseId,
    closureModel: sourceSurface?.closureModel,
    closureModelId: sourceSurface?.closureModelId,
    renderKey,
    surfaceIdentityKey: sourceSurface?.surfaceIdentityKey ?? sourceSurface?.surfaceKey,
    opticalState: sourceSurface?.opticalState || null,
    opticalStateKey: sourceSurface?.opticalStateKey ?? 'default',
    opticalStateId,
    renderDomainId: sourceSurface?.renderDomainId,
    renderDomainKey: sourceSurface?.renderDomainKey
  });
}

export function canonicalMaterialKeyByStableId(
  material,
  materialProperties = null,
  reactionTable = null
) {
  if (!material) return null;
  const materialId = stableOpticalMaterialId(material);
  // Closure-bank spelling is authoritative for rendering. Reaction tables
  // intentionally tolerate aliases (for example `F` and `f`), but letting a
  // later alias replace the bank key produces a second surface and can route
  // optical lookup through an unavailable record.
  for (const key of Object.keys(materialProperties || {})) {
    if (stableOpticalMaterialId(key) === materialId) return key;
  }
  const renderMap = buildSphRenderMaterialMap(
    materialProperties || {},
    reactionTable
  );
  return renderMap.get(materialId) ?? material;
}

export function canonicalizeResidentRenderSurfaceBatchMaterials(
  batches = [],
  {
    materialProperties = null,
    reactionTable = null
  } = {}
) {
  if (!Array.isArray(batches) || batches.length === 0) return [];
  return batches.map((batch) => {
    if (!batch?.material) return batch;
    const material = canonicalMaterialKeyByStableId(
      batch.material,
      materialProperties,
      reactionTable
    );
    if (!material || material === batch.material) return batch;
    const phase = batch.phase ?? batch.descriptor?.phase ?? null;
    const renderKey = renderKeyForMaterialPhase(material, phase);
    const descriptor = renderDescriptorOf({
      material,
      phase,
      renderKey,
      opticalState: batch.opticalState || batch.descriptor?.opticalState || null,
      opticalStateKey:
        batch.opticalStateKey
        ?? batch.descriptor?.opticalStateKey
        ?? null,
      opticalStateId:
        batch.opticalStateId
        ?? batch.descriptor?.opticalStateId,
      renderDomainId:
        batch.renderDomainId
        ?? batch.descriptor?.renderDomainId,
      renderDomainKey:
        batch.renderDomainKey
        ?? batch.descriptor?.renderDomainKey
    });
    return {
      ...batch,
      surfaceKey: descriptor.surfaceKey,
      renderKey,
      material,
      descriptor
    };
  });
}

export function materialPropertiesForSurfaceDescriptor(descriptor, materialProperties) {
  if (!materialProperties) return null;
  const materialKey = descriptor.material;
  const renderKey = descriptor.renderKey;
  const direct = materialProperties[materialKey]
    ?? materialProperties[materialKey?.toLowerCase?.()]
    ?? materialProperties[materialKey?.toUpperCase?.()]
    ?? materialProperties[renderKey]
    ?? materialProperties[renderKey?.toLowerCase?.()]
    ?? materialProperties[renderKey?.toUpperCase?.()]
    ?? null;
  if (direct) return direct;
  const materialId = stableOpticalMaterialId(materialKey || renderKey);
  for (const [key, properties] of Object.entries(materialProperties)) {
    if (stableOpticalMaterialId(key) === materialId) return properties;
  }
  return null;
}

export function opticalQueryForDescriptor(descriptor, properties = null) {
  return {
    material: descriptor.material,
    phase: descriptor.phase ?? (descriptor.renderKey === 'steam' ? 'gas' : (descriptor.renderKey === 'ice' ? 'solid' : 'liquid')),
    properties,
    opticalState: descriptor.opticalState || null
  };
}

export function opticalCoverageKey({ material, phase, opticalStateKey = null, opticalState = null, opticalStateId = 0 }) {
  const stateKey = opticalStateKey || stableOpticalStateKey(opticalState);
  return `${material}|${phase}|${Number(opticalStateId) || 0}|${stateKey}`;
}

function opticalRecordIndex(layout = OPTICAL_GPU_RECORD_LAYOUT, fieldName) {
  return layout.findIndex((entry) => String(entry).split(':')[0] === fieldName);
}

function opticalRecordValue(table, recordIndex, fieldName, fallback = 0) {
  const layout = table?.recordLayout || OPTICAL_GPU_RECORD_LAYOUT;
  const fieldIndex = opticalRecordIndex(layout, fieldName);
  const stride = table?.recordStrideFloats || layout.length;
  const offset = recordIndex * stride + fieldIndex;
  const value = fieldIndex >= 0 ? table?.records?.[offset] : undefined;
  return Number.isFinite(value) ? value : fallback;
}

export function opticalParamsFromGpuTableRecord(table, descriptor) {
  if (!table?.schema || !(table.records instanceof Float32Array) || !Array.isArray(table.recordMetadata)) return null;
  const coverage = opticalCoverageKey(descriptor);
  const record = table.recordMetadata.find((candidate) => opticalCoverageKey(candidate) === coverage);
  if (!record || !Number.isFinite(record.recordIndex)) return null;
  return {
    source: 'optical-gpu-table-row',
    material: record.material,
    phase: record.phase,
    opticalState: record.opticalState || null,
    opticalStateKey: record.opticalStateKey || 'default',
    opticalStateId: record.opticalStateId || 0,
    baseColorLinear: [
      opticalRecordValue(table, record.recordIndex, 'baseColorLinearR', 1),
      opticalRecordValue(table, record.recordIndex, 'baseColorLinearG', 1),
      opticalRecordValue(table, record.recordIndex, 'baseColorLinearB', 1)
    ],
    metalness: opticalRecordValue(table, record.recordIndex, 'metalness', 0),
    roughness: opticalRecordValue(table, record.recordIndex, 'roughness', 0.5),
    transmission: opticalRecordValue(table, record.recordIndex, 'transmission', 0),
    opacity: opticalRecordValue(table, record.recordIndex, 'opacity', 1),
    ior: opticalRecordValue(table, record.recordIndex, 'ior', 1),
    attenuationLinear: [
      opticalRecordValue(table, record.recordIndex, 'attenuationLinearR', 1),
      opticalRecordValue(table, record.recordIndex, 'attenuationLinearG', 1),
      opticalRecordValue(table, record.recordIndex, 'attenuationLinearB', 1)
    ],
    attenuationDistanceM: opticalRecordValue(table, record.recordIndex, 'attenuationDistanceM', 1e20),
    absorptionCoefficientPerM: opticalRecordValue(table, record.recordIndex, 'absorptionCoefficientPerM', 0),
    scatteringCoefficientPerM: opticalRecordValue(table, record.recordIndex, 'scatteringCoefficientPerM', 0),
    renderModelId: opticalRecordValue(table, record.recordIndex, 'renderModelId', 0),
    vertexColorPolicyId: opticalRecordValue(table, record.recordIndex, 'vertexColorPolicyId', 1),
    opticalDepth: opticalRecordValue(table, record.recordIndex, 'opticalDepth', 0),
    blocked: opticalRecordValue(table, record.recordIndex, 'blocked', 0) > 0,
    status: opticalRecordValue(table, record.recordIndex, 'status', 1),
    provenance: record.provenance || null
  };
}

export function opticalSignatureForMaterial(optics = null) {
  if (!optics) return 'cpu-optical-render-params';
  return [
    optics.source || 'optics',
    optics.material || '',
    optics.phase || '',
    optics.opticalStateKey || 'default',
    optics.metalness,
    optics.roughness,
    optics.transmission,
    optics.opacity,
    optics.ior,
    optics.attenuationDistanceM,
    optics.absorptionCoefficientPerM,
    optics.scatteringCoefficientPerM,
    optics.opticalDepth,
    optics.renderModelId,
    optics.vertexColorPolicyId,
    ...(optics.baseColorLinear || optics.baseColorSrgb || [])
  ].map((value) => String(value)).join('|');
}

function surfaceRenderOrderKey(descriptorOrRow = {}) {
  if (descriptorOrRow.surfaceKey) return descriptorOrRow.surfaceKey;
  return [
    descriptorOrRow.renderKey ?? descriptorOrRow.renderMaterialKey ?? '',
    descriptorOrRow.material ?? '',
    descriptorOrRow.phase ?? '',
    descriptorOrRow.opticalStateKey ?? stableOpticalStateKey(descriptorOrRow.opticalState || null),
    normalizeRenderDomainId(descriptorOrRow.renderDomainId)
  ].join('|');
}

export function stableSurfaceRenderOrder(baseOrder, surfaceKey = '') {
  const base = Number.isFinite(baseOrder) ? baseOrder : 0;
  const key = String(surfaceKey || '');
  let hash = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return base + ((hash >>> 0) % 1000) / 100000;
}

export function surfaceObjectRenderOrder(baseOrder, surfaceKey = '', {
  renderLayer = null,
  depthWrite = true
} = {}) {
  const base = Number.isFinite(baseOrder) ? baseOrder : 0;
  const transparentLayer = renderLayer === 'vapor-surface'
    || renderLayer === 'alpha-surface'
    || depthWrite === false;
  if (transparentLayer) return base;
  return stableSurfaceRenderOrder(base, surfaceKey);
}

export function resolveRenderFieldSurfaceVisibility({
  maxDensity = 0,
  isolation = 0,
  wasVisible = false
} = {}) {
  const density = Number.isFinite(maxDensity) ? Math.max(0, maxDensity) : 0;
  const showIsolation = Number.isFinite(isolation) ? Math.max(0, isolation) : 0;
  const hideIsolation = showIsolation * SPH_RENDER_FIELD_VISIBILITY_HYSTERESIS;
  const visible = density >= showIsolation || (wasVisible && density >= hideIsolation);
  return {
    visible,
    retainPreviousSurface: !visible && wasVisible,
    showIsolation,
    hideIsolation,
    renderIsolation: visible && density < showIsolation ? hideIsolation : showIsolation
  };
}

export function hideRenderFieldSurfaceAfterGrace(surface, renderSource, {
  immediate = false
} = {}) {
  surface.inactiveFrameCount = Math.max(0, surface.inactiveFrameCount || 0) + 1;
  surface.mesh.userData.surfaceInactiveFrameCount = surface.inactiveFrameCount;
  surface.mesh.userData.renderSource = renderSource;
  if (!immediate && surface.inactiveFrameCount <= SPH_SURFACE_INACTIVE_GRACE_FRAMES) {
    return false;
  }
  surface.mesh.isolation = surface.config.isolation;
  surface.mesh.reset();
  surface.mesh.update();
  surface.mesh.visible = false;
  return true;
}

function opticalPhaseOf(optics = {}, descriptorOrRow = {}) {
  return descriptorOrRow.phase
    ?? optics.phase
    ?? (descriptorOrRow.renderKey === 'steam' ? 'gas' : null);
}

function isVaporOpticalSurface(optics = {}, descriptorOrRow = {}) {
  if (Number(descriptorOrRow.opticalStateId ?? optics.opticalStateId) > 0) {
    return true;
  }
  const phase = opticalPhaseOf(optics, descriptorOrRow);
  const material = descriptorOrRow.material ?? optics.material ?? null;
  const renderKey = descriptorOrRow.renderKey ?? descriptorOrRow.renderMaterialKey ?? null;
  return phase === 'gas' || material === 'steam' || renderKey === 'steam';
}

function opticalDepthFromOpacity(opacity) {
  const alpha = clamp(Number.isFinite(opacity) ? opacity : 0, 0, 1);
  if (!(alpha > 0)) return 0;
  if (alpha >= 1) return Number.POSITIVE_INFINITY;
  return -Math.log(1 - alpha);
}

export function resolveOpticalSurfaceVisibility({
  optics = {},
  descriptorOrRow = {},
  wasVisible = false
} = {}) {
  if (!isVaporOpticalSurface(optics, descriptorOrRow)) {
    return {
      visible: true,
      reason: 'non-vapor-surface',
      opticalDepth: Number.isFinite(optics.opticalDepth) ? Math.max(0, optics.opticalDepth) : null,
      scatteringCoefficientPerM: Number.isFinite(optics.scatteringCoefficientPerM)
        ? Math.max(0, optics.scatteringCoefficientPerM)
        : null,
      showOpticalDepth: null,
      hideOpticalDepth: null,
      retainPreviousSurface: false
    };
  }
  const scatteringCoefficientPerM = Math.max(
    0,
    Number.isFinite(optics.scatteringCoefficientPerM) ? optics.scatteringCoefficientPerM : 0,
    Number.isFinite(optics.condensationScatter) ? optics.condensationScatter : 0,
    Number.isFinite(optics.internalScatter) ? optics.internalScatter : 0
  );
  const opticalDepth = Math.max(
    0,
    Number.isFinite(optics.opticalDepth) ? optics.opticalDepth : 0,
    opticalDepthFromOpacity(optics.opacity)
  );
  const hasScattering = scatteringCoefficientPerM >= SPH_VAPOR_SURFACE_SCATTER_SHOW_PER_M;
  const depthThreshold = wasVisible ? SPH_VAPOR_SURFACE_OPTICAL_DEPTH_HIDE : SPH_VAPOR_SURFACE_OPTICAL_DEPTH_SHOW;
  const visible = hasScattering || opticalDepth >= depthThreshold;
  return {
    visible,
    reason: visible
      ? (hasScattering ? 'derived-droplet-scattering-visible' : 'derived-vapor-optical-depth-visible')
      : 'derived-pure-vapor-optically-thin',
    opticalDepth,
    scatteringCoefficientPerM,
    showOpticalDepth: SPH_VAPOR_SURFACE_OPTICAL_DEPTH_SHOW,
    hideOpticalDepth: SPH_VAPOR_SURFACE_OPTICAL_DEPTH_HIDE,
    scatteringThresholdPerM: SPH_VAPOR_SURFACE_SCATTER_SHOW_PER_M,
    retainPreviousSurface: !visible && wasVisible
  };
}

// Compact, renderer-neutral optical presentation contract. Gas geometry is
// still useful as a transported field, but it must not become a visible cloud
// merely because its phase is `gas`: pure water vapour and H2 are optically
// thin, while condensed water droplets and absorbing gases earn visibility
// from the material closure. Keeping this decision in metadata lets every
// surface consumer share the same physics-derived answer without adding a
// scenario-specific shader branch.
export function closureDerivedSurfaceOpticalPresentation({
  optics = {},
  descriptorOrRow = {},
  wasVisible = false
} = {}) {
  const vaporSurface = isVaporOpticalSurface(optics, descriptorOrRow);
  const visibility = resolveOpticalSurfaceVisibility({
    optics,
    descriptorOrRow,
    wasVisible
  });
  const opacityReady = optics?.opacity != null
    && Number.isFinite(Number(optics.opacity));
  const opacity = clamp(
    opacityReady ? Number(optics.opacity) : 0,
    0,
    1
  );
  const opticalDepth = visibility.opticalDepth != null
    && Number.isFinite(Number(visibility.opticalDepth))
    ? Math.max(0, Number(visibility.opticalDepth))
    : null;
  const scatteringCoefficientPerM = visibility.scatteringCoefficientPerM != null
    && Number.isFinite(Number(visibility.scatteringCoefficientPerM))
    ? Math.max(0, Number(visibility.scatteringCoefficientPerM))
    : null;
  const closureBlocked = optics?.blocked === true
    || Number(optics?.blocked) > 0;
  const closureResponseReady = Boolean(
    !closureBlocked
    && opacityReady
    && opticalDepth != null
    && scatteringCoefficientPerM != null
  );
  const effectiveOpacity = vaporSurface
    ? (closureResponseReady && visibility.visible ? opacity : 0)
    : 1;
  return Object.freeze({
    opticalResponseAuthorityFlag: vaporSurface ? 1 : 0,
    opticalResponseAuthority: vaporSurface
      ? (closureResponseReady
        ? 'closure-derived-gas-optical-response'
        : 'closure-blocked-gas-hidden')
      : 'non-gas-surface-optics',
    opticalResponseReady: closureResponseReady,
    opticalVisibilityFlag: visibility.visible ? 1 : 0,
    opticalVisibilityReason: visibility.reason,
    opticalOpacity: opacity,
    opticalEffectiveOpacity: effectiveOpacity,
    opticalDepth,
    opticalScatteringCoefficientPerM: scatteringCoefficientPerM,
    opticalTransmission: optics?.transmission != null
      && Number.isFinite(Number(optics.transmission))
      ? clamp(Number(optics.transmission), 0, 1)
      : null,
    opticalRoughness: optics?.roughness != null
      && Number.isFinite(Number(optics.roughness))
      ? clamp(Number(optics.roughness), 0, 1)
      : null,
    opticalBlockedFlag: closureBlocked ? 1 : 0,
    opticalProvenanceSource: optics?.provenance?.source
      ?? optics?.source
      ?? null
  });
}

// A collective dispersed-medium field stores integrated scattering and
// absorption optical depth, scaled by the surface isolation value. Marching
// cubes therefore extracts its boundary at tau = 1 exactly:
//
//   field = isolation * tau;  field == isolation  =>  tau == 1
//
// The boundary opacity must come from that transported optical-depth field,
// not from the static bulk condensed-material opacity used to seed its color.
// Beer-Lambert gives transmission exp(-tau) and opacity 1 - exp(-tau). The
// static closure table gates this presentation so a missing/blocked material
// response cannot acquire visible-media authority merely by declaring a
// positive route id. With no dynamic moments, the field remains empty and no
// geometry is emitted even though the ready route has a renderable opacity.
export function collectiveOpticalDepthIsosurfacePresentation({
  optics = {},
  descriptorOrRow = {},
  closureTable = null
} = {}) {
  const opticalStateId = Number(descriptorOrRow?.opticalStateId);
  const routeKey = descriptorOrRow?.collectiveOpticalRouteKey
    ?? descriptorOrRow?.surfaceIdentityKey
    ?? descriptorOrRow?.surfaceKey
    ?? null;
  const material = String(descriptorOrRow?.material ?? '').trim();
  const phase = String(
    descriptorOrRow?.condensedPhase ?? descriptorOrRow?.phase ?? ''
  ).trim().toLowerCase();
  const materialId = material ? stableOpticalMaterialId(material) : null;
  const condensedPhaseId = phase ? gpuPhaseId(phase) : null;
  const routeId = Number(descriptorOrRow?.routeId);
  const canonicalRoute = Boolean(
    descriptorOrRow?.collectiveOpticalRoute === true
    && descriptorOrRow?.collectiveOpticalRouteSchema
      === COLLECTIVE_DISPERSED_MEDIUM_OPTICAL_ROUTE_SCHEMA
    && Number.isSafeInteger(opticalStateId)
    && opticalStateId > 0
    && routeId === opticalStateId
    && material.length > 0
    && Number(descriptorOrRow?.materialId) === materialId
    && [GPU_PHASE_IDS.solid, GPU_PHASE_IDS.liquid].includes(condensedPhaseId)
    && Number(
      descriptorOrRow?.condensedPhaseId ?? descriptorOrRow?.phaseId
    ) === condensedPhaseId
    && typeof routeKey === 'string'
    && routeKey.length > 0
  );
  const closureMetadata = canonicalRoute
    && closureTable?.schema
      === ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_TABLE_SCHEMA
    && Array.isArray(closureTable?.metadata)
    ? closureTable.metadata.find((row) => (
        Number(row?.opticalStateId) === opticalStateId
        && Number(row?.routeId) === opticalStateId
        && Number(row?.dispersedMaterialId) === materialId
        && Number(row?.condensedPhaseId) === condensedPhaseId
        && row?.routeSchema
          === COLLECTIVE_DISPERSED_MEDIUM_OPTICAL_ROUTE_SCHEMA
        && row?.routeKey === routeKey
      )) ?? null
    : null;
  const closureReady = Boolean(
    closureMetadata?.status
      === SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_STATUS.ready
    && Array.isArray(closureTable?.readyOpticalStateIds)
    && closureTable.readyOpticalStateIds.includes(opticalStateId)
  );
  const closureRowOffset = Number.isSafeInteger(closureMetadata?.rowIndex)
    && closureMetadata.rowIndex >= 0
    && closureTable?.rows instanceof Float32Array
    && Number.isSafeInteger(closureTable?.rowStrideFloats)
    && closureTable.rowStrideFloats > 0
    ? closureMetadata.rowIndex * closureTable.rowStrideFloats
    : null;
  const closureValue = (lane) => closureRowOffset == null
    ? null
    : Number(closureTable.rows[closureRowOffset + lane]);
  const morphologyModelId = closureValue(
    SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_LANES.morphologyModelId
  );
  const scatteringParameter = closureValue(
    SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_LANES.scatteringEfficiencyQsca
  );
  const absorptionParameter = closureValue(
    SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_LANES.absorptionEfficiencyQabs
  );
  let singleScatteringAlbedo = null;
  if (
    closureReady
    && morphologyModelId
      === SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL
        .singleCompactSphereComplexIndex
    && absorptionParameter === 0
  ) {
    // k=0 makes the compact-sphere response lossless at the declared
    // wavelength: extinction is scattering, so the scalar transported field
    // may use an achromatic unit scattering source under scene illumination.
    singleScatteringAlbedo = 1;
  } else if (
    closureReady
    && Number.isFinite(scatteringParameter)
    && Number.isFinite(absorptionParameter)
    && scatteringParameter + absorptionParameter > 0
  ) {
    singleScatteringAlbedo = scatteringParameter
      / (scatteringParameter + absorptionParameter);
  }
  const achromaticScattering = singleScatteringAlbedo === 1;
  const opticalDepth = closureReady ? 1 : 0;
  const transmission = closureReady ? Math.exp(-opticalDepth) : null;
  const opacity = closureReady ? -Math.expm1(-opticalDepth) : 0;
  const provenanceSource = closureMetadata?.provenance?.source
    ?? optics?.provenance?.source
    ?? optics?.source
    ?? null;
  return Object.freeze({
    opticalResponseAuthorityFlag: canonicalRoute ? 1 : 0,
    opticalResponseAuthority: closureReady
      ? 'conserved-dispersed-extinction-optical-depth-isosurface'
      : 'collective-optical-depth-closure-blocked-hidden',
    opticalResponseReady: closureReady,
    opticalVisibilityFlag: closureReady ? 1 : 0,
    opticalVisibilityReason: closureReady
      ? 'derived-collective-optical-depth-isosurface-visible'
      : 'collective-optical-depth-closure-blocked',
    opticalOpacity: opacity,
    opticalEffectiveOpacity: opacity,
    opticalDepth,
    // The field carries integrated optical depth rather than one uniform
    // per-metre coefficient; publishing zero here would falsely claim a
    // measured absence, so retain an explicit null.
    opticalScatteringCoefficientPerM: null,
    opticalSingleScatteringAlbedo: singleScatteringAlbedo,
    opticalAchromaticScattering: achromaticScattering,
    opticalScatteringSourceLinear: achromaticScattering ? [1, 1, 1] : null,
    opticalTransmission: transmission,
    // A participating medium is not a polished material boundary.
    opticalRoughness: closureReady ? 1 : null,
    opticalBlockedFlag: closureReady ? 0 : 1,
    opticalProvenanceSource: provenanceSource
  });
}

// Sphere/CPU-mesh lane counterpart of the surface WGSL blackbody_emission_rgb
// intensity: 1.8 is the calibrated sphere anchor that matches the surface
// quad ramp at its 2200 K saturation (quad_scale 2.1); above the anchor the
// radiance follows Stefan-Boltzmann (T/2200)^4 relative growth with the same
// relative ceiling (60/2.1). Without a temperature the legacy 1.8 applies, so
// pre-change callers keep their exact behavior.
export function sphereEmissiveIntensityForTemperature(temperatureK) {
  const anchorK = 2200;
  const base = 1.8;
  const t = Number(temperatureK);
  if (!Number.isFinite(t) || t <= anchorK) return base;
  const rel = t / anchorK;
  return Math.min(base * rel * rel * rel * rel, base * (60 / 2.1));
}

export function renderAlphaFromOpticalResponse(optics = {}, descriptorOrRow = {}) {
  if (isVaporOpticalSurface(optics, descriptorOrRow)) {
    return clamp(Number.isFinite(optics.opacity) ? optics.opacity : 0, 0, 1);
  }
  return 1;
}

export function hasAdmittedClosureRefraction(optics = {}, descriptorOrRow = {}) {
  const transmission = clamp(Number.isFinite(optics.transmission) ? optics.transmission : 0, 0, 1);
  const metalness = clamp(Number.isFinite(optics.metalness) ? optics.metalness : 0, 0, 1);
  const ior = Number(optics.ior);
  const status = Number(optics.status);
  return transmission > 0.01
    && metalness < 0.1
    && !isVaporOpticalSurface(optics, descriptorOrRow)
    && optics.blocked !== true
    && (!Number.isFinite(status) || status !== 255)
    && Number.isFinite(ior)
    && ior > 1.000001;
}

export function renderDepthWriteFromOpticalResponse(optics = {}, descriptorOrRow = {}) {
  // A gas is a participating medium, not an opaque boundary.  Even an
  // optically dense vapor must not stamp a closed marching-cubes shell into
  // the depth buffer: that shell previously hid every condensed surface
  // behind it (including sodium, reaction products, and the water itself).
  if (isVaporOpticalSurface(optics, descriptorOrRow)) return false;
  return true;
}

export function renderLayerFromOpticalResponse(optics = {}, descriptorOrRow = {}) {
  if (isVaporOpticalSurface(optics, descriptorOrRow)) return 'vapor-surface';
  return hasAdmittedClosureRefraction(optics, descriptorOrRow)
    ? 'refractive-surface'
    : 'opaque-surface';
}

export function renderOrderFromOpticalResponse(optics = {}, descriptorOrRow = {}) {
  const layer = renderLayerFromOpticalResponse(optics, descriptorOrRow);
  if (layer === 'vapor-surface') return SPH_PHASE_RENDER_ORDER.vaporSurface;
  if (layer === 'refractive-surface') return SPH_PHASE_RENDER_ORDER.transmissiveSurface;
  return SPH_PHASE_RENDER_ORDER.opaqueSurface;
}

export function residentSurfaceDrawOrder(surfaces = [], {
  indirectStrideBytes = 4 * Uint32Array.BYTES_PER_ELEMENT,
  // Blended surfaces must be drawn back-to-front from the current viewpoint.
  // Without a camera the order below stays view-independent, which is correct
  // for opaque draws but lets a farther blended surface draw over a nearer one
  // as the camera rotates.
  cameraPositionM = null
} = {}) {
  if (!Array.isArray(surfaces)) return [];
  return surfaces
    .map((surface, index) => {
      const surfaceIndex = Math.max(0, Math.round(Number(surface?.surfaceIndex ?? index) || 0));
      const transparencyClassId = Number.isFinite(Number(surface?.transparencyClassId))
        ? Number(surface.transparencyClassId)
        : 0;
      const explicitDepthWriteFlag = Number(surface?.depthWriteFlag);
      const depthWriteFlag = Number.isFinite(explicitDepthWriteFlag)
        ? (explicitDepthWriteFlag > 0 ? 1 : 0)
        : (transparencyClassId === 1 ? 0 : 1);
      const hasExplicitRenderOrder = Number.isFinite(Number(surface?.renderOrder));
      const renderOrder = hasExplicitRenderOrder
        ? Number(surface.renderOrder)
        : (transparencyClassId * 1000 + surfaceIndex);
      // An explicit render order is author intent and stays the primary key —
      // it is what lets opaque -> refractive -> vapor override class order. A
      // derived one is transparencyClassId * 1000 + surfaceIndex, whose
      // per-surface term would otherwise pin the ordering to the surface list
      // and make it view-independent, so only its class part is used here.
      const layerOrder = hasExplicitRenderOrder
        ? Number(surface.renderOrder)
        : transparencyClassId;
      const explicitIndirectOffsetBytes = Number(surface?.indirectOffsetBytes);
      const explicitIndirectRowIndex = Number(surface?.indirectRowIndex);
      const indirectRowIndex = Number.isFinite(explicitIndirectRowIndex) && explicitIndirectRowIndex >= 0
        ? Math.round(explicitIndirectRowIndex)
        : surfaceIndex;
      const indirectOffsetBytes = Number.isFinite(explicitIndirectOffsetBytes) && explicitIndirectOffsetBytes >= 0
        ? Math.round(explicitIndirectOffsetBytes)
        : indirectRowIndex * indirectStrideBytes;
      const center = surface?.boundsCenterM;
      let viewDepth = 0;
      if (
        Array.isArray(cameraPositionM)
        && cameraPositionM.length >= 3
        && Array.isArray(center)
        && center.length >= 3
      ) {
        const dx = Number(center[0]) - Number(cameraPositionM[0]);
        const dy = Number(center[1]) - Number(cameraPositionM[1]);
        const dz = Number(center[2]) - Number(cameraPositionM[2]);
        const squared = dx * dx + dy * dy + dz * dz;
        viewDepth = Number.isFinite(squared) ? squared : 0;
      }
      return {
        surfaceIndex,
        renderOrder,
        transparencyClassId,
        depthWriteFlag,
        renderLayer: surface?.renderLayer ?? null,
        indirectRowIndex,
        indirectOffsetBytes,
        layerOrder,
        viewDepth
      };
    })
    .sort((a, b) => (
      // Group by the layer the render order encodes, not by its exact value.
      // A derived render order is transparencyClassId * 1000 + surfaceIndex,
      // so comparing it first made the whole ordering view-independent and
      // left the depth term below unreachable.
      a.layerOrder - b.layerOrder
      || b.depthWriteFlag - a.depthWriteFlag
      // Blended classes resolve back-to-front; opaque draws stay front-to-back
      // so early-z still rejects. With no camera every viewDepth is 0 and this
      // degrades to the render-order/surfaceIndex ordering below.
      || (a.transparencyClassId > 0
        ? b.viewDepth - a.viewDepth
        : a.viewDepth - b.viewDepth)
      || a.renderOrder - b.renderOrder
      || a.surfaceIndex - b.surfaceIndex
    ));
}

export function residentSurfaceDrawPipelineKey(draw = {}) {
  if (
    draw?.renderLayer === 'vapor-surface'
    || Number(draw?.transparencyClassId) === 1
  ) return 'vapor-alpha-blend';
  return draw?.renderLayer === 'refractive-surface'
    || Number(draw?.transparencyClassId) === 2
    ? 'refractive-depth-write'
    : 'opaque-depth-write';
}

export function resolveSphNativeSurfaceDiagnosticDrawPlan({
  drawOrder = [],
  additionalSurfaceDraws = [],
  filter = null
} = {}) {
  const primaryDraws = Array.isArray(drawOrder) ? drawOrder : [];
  const secondaryDraws = Array.isArray(additionalSurfaceDraws)
    ? additionalSurfaceDraws
    : [];
  const token = typeof filter?.token === 'string' && filter.token.trim()
    ? filter.token
    : null;
  const active = Boolean(token && filter?.enabled === true);
  if (!active) {
    return {
      active: false,
      token: null,
      drawOrder: primaryDraws,
      additionalSurfaceDraws: secondaryDraws,
      suppressBackgroundImage: false,
      suppressBoxWireframe: false,
      suppressSchroederProxyDraws: false,
      sourcePrimaryDrawCount: primaryDraws.length,
      sourceAdditionalDrawCount: secondaryDraws.length,
      selectedPrimaryDrawCount: primaryDraws.length,
      selectedAdditionalDrawCount: secondaryDraws.length,
      selectedAdditionalSurfaceKeys: []
    };
  }
  const allowedSurfaceKeys = new Set(
    (Array.isArray(filter?.additionalSurfaceKeys) ? filter.additionalSurfaceKeys : [])
      .map((key) => String(key || ''))
      .filter(Boolean)
  );
  const filteredSecondaryDraws = filter?.filterAdditionalSurfaceDraws === true
    ? secondaryDraws.filter((draw) => allowedSurfaceKeys.has(String(draw?.surfaceKey || '')))
    : secondaryDraws;
  return {
    active: true,
    token,
    drawOrder: filter?.suppressPrimarySurfaceDraws === true ? [] : primaryDraws,
    additionalSurfaceDraws: filteredSecondaryDraws,
    suppressBackgroundImage: filter?.suppressBackgroundImage === true,
    suppressBoxWireframe: filter?.suppressBoxWireframe === true,
    suppressSchroederProxyDraws: filter?.suppressSchroederProxyDraws === true,
    sourcePrimaryDrawCount: primaryDraws.length,
    sourceAdditionalDrawCount: secondaryDraws.length,
    selectedPrimaryDrawCount:
      filter?.suppressPrimarySurfaceDraws === true ? 0 : primaryDraws.length,
    selectedAdditionalDrawCount: filteredSecondaryDraws.length,
    selectedAdditionalSurfaceKeys: filteredSecondaryDraws.map((draw) => draw?.surfaceKey ?? null)
  };
}

export function finiteNumberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export const ULG_WORKER_LANE_NATIVE_SURFACE_PRESENTATION_SOURCE_SCHEMA =
  'peercompute.ulg.worker-lane-native-surface-presentation-source.v0';

export function resolveWorkerLaneNativeSurfacePresentationSource({
  residentSteps = null,
  source = null
} = {}) {
  const lane = residentSteps?.workerOwnedResidentLane || null;
  const blocked = (reason) => ({
    schema: ULG_WORKER_LANE_NATIVE_SURFACE_PRESENTATION_SOURCE_SCHEMA,
    status: 'worker-lane-native-surface-presentation-source-blocked',
    ready: false,
    reason,
    source: null
  });
  if (!source) return blocked('presentation source was not supplied');
  if (!lane?.scheduleId || !lane?.laneId || !lane?.stateKey) {
    return blocked('worker-owned resident lane identity is required');
  }
  if (
    lane.residentScheduleStatus !== 'worker-resident-schedule-completed'
    || lane.terminalStatus
      !== 'worker-offscreen-resident-schedule-on-presentation-device-completed'
    || lane.cancelled === true
    || Number(lane.completedStepCount) !== Number(lane.requestedStepCount)
    || lane.gpuFence?.terminalScheduleFence !== true
    || lane.gpuFence?.fenceSatisfied !== true
    || lane.gpuFence?.authorityAdmissionReady !== true
    || lane.authority?.status !== 'state-manager-committed-worker-schedule'
    || lane.authority?.computeManagerLeaseStatus !== 'completed'
    || lane.authority?.computeManagerFenceSatisfied !== true
    || lane.authority?.stateManagerCommitStatus !== 'committed'
    || lane.committedPresentation?.stateManagerCommittedPresentation !== true
    || lane.committedPresentation?.scheduleId !== lane.scheduleId
    || lane.committedPresentation?.laneId !== lane.laneId
    || lane.committedPresentation?.stateKey !== lane.stateKey
  ) {
    return blocked('worker schedule terminal authority is incomplete');
  }
  if (
    source.schema !== ULG_WORKER_LANE_NATIVE_SURFACE_PRESENTATION_SOURCE_SCHEMA
    || source.status !== 'worker-lane-native-surface-presentation-source-ready'
  ) {
    return blocked('presentation source schema/status is not ready');
  }
  if (
    source.scheduleId !== lane.scheduleId
    || source.laneId !== lane.laneId
    || source.stateKey !== lane.stateKey
    || source.sourceStageId !== 'schroederSameLevelMechanics'
    || typeof source.cacheKey !== 'string'
    || !source.cacheKey.startsWith(`${lane.scheduleId}:native-surface:`)
    || source.requestId !== source.cacheKey
  ) {
    return blocked('presentation source does not match the committed worker schedule');
  }
  // The retained snapshot is the post-step continuation state. The committed
  // worker candidate names the last consumed macro epoch; its successor upload
  // is exactly one step newer even when this lane was seeded after page work.
  const expectedStep = Number(lane?.committedPresentation?.sphStep) + 1;
  const expectedTimeS = Number(lane?.laneSimTimeS);
  if (
    !Number.isSafeInteger(expectedStep)
    || expectedStep < 0
    || Number(source.sourceStep) !== expectedStep
    || Number(source.sphParticleState?.step) !== expectedStep
    || Number(source.mlsMpmParticleState?.step) !== expectedStep
  ) {
    return blocked('presentation source step does not match the worker terminal epoch');
  }
  if (
    !Number.isFinite(expectedTimeS)
    || !Number.isFinite(Number(source.sourceTimeS))
    || Math.abs(Number(source.sourceTimeS) - expectedTimeS) > 1e-9
  ) {
    return blocked('presentation source time does not match the worker lane time');
  }
  const particleCount = Number(source.particleCount);
  if (
    !Number.isSafeInteger(particleCount)
    || particleCount <= 0
    || source.sphParticleState?.schema !== ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA
    || source.mlsMpmParticleState?.schema
      !== ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA
    || Number(source.sphParticleState?.particleCount) !== particleCount
    || Number(source.mlsMpmParticleState?.particleCount) !== particleCount
    || source.sphParticleUpload?.schema !== ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA
    || source.sphParticleUpload?.status !== 'webgpu-uploaded'
    || source.mlsMpmParticleUpload?.schema
      !== ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA
    || source.mlsMpmParticleUpload?.status !== 'webgpu-uploaded'
    || Number(source.sphParticleUpload?.particleCount) !== particleCount
    || Number(source.mlsMpmParticleUpload?.particleCount) !== particleCount
  ) {
    return blocked('presentation source packed rows/uploads are incomplete');
  }
  if (
    source.sphParticleState?.identityRequired === true
    && (
      source.sphParticleState.identitySchema
        !== ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA
      || !(source.sphParticleState.identity instanceof Uint32Array)
      || source.sphParticleState.identity.length
        !== particleCount * SPH_GPU_PARTICLE_IDENTITY_UINTS
      || source.sphParticleUpload?.identityRequired !== true
      || source.sphParticleUpload?.identitySchema
        !== ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA
    )
  ) {
    return blocked('presentation source explicit particle identity is incomplete');
  }
  if (
    source.sharedSlotIdentityVerified !== true
    || source.workerLineageMetadataStatus
      !== 'worker-retained-compact-snapshot-lineage-metadata-ready'
  ) {
    return blocked('presentation source worker lineage is incomplete');
  }
  return {
    schema: ULG_WORKER_LANE_NATIVE_SURFACE_PRESENTATION_SOURCE_SCHEMA,
    status: 'worker-lane-native-surface-presentation-source-admitted',
    ready: true,
    reason: null,
    source
  };
}

export function createResidentRenderSourceMetadata({
  residentSteps = null,
  finalStep = null,
  residentExecutionGeneration = null,
  currentResidentExecutionGeneration = null,
  stepsSignature = null,
  stepSignature = null,
  schroederPortableSummary = null,
  schroederRenderLodSummary = null,
  schroederPortableSummaryAdmission = null,
  renderOwnershipPolicy = null,
  schroederRenderProxyRendererCapability = null,
  schroederRenderProxyRenderBridgeMode = null,
  schroederRenderProxyRenderBridgeStatus = null,
  schroederRenderProxyPixelValidationStatus = null,
  schroederRenderProxyBackendPreference = 'auto',
  schroederRenderProxyAllowDiagnosticCpuProxy = false,
  schroederRenderProxyDiagnosticMaxProxyCount = 256,
  source = 'resident-render-refresh'
} = {}) {
  const step = finalStep || residentSteps?.finalStep || null;
  const nextSphParticleState = residentSteps?.nextSphParticleState
    || step?.nextSphParticleState
    || null;
  const nextMlsMpmParticleState = residentSteps?.nextMlsMpmParticleState
    || step?.nextMlsMpmParticleState
    || null;
  const particlePingPong = step?.particlePingPong || {};
  const sourceStep = finiteNumberOrNull(particlePingPong.sourceStep);
  const nextStep = finiteNumberOrNull(
    particlePingPong.nextStep
      ?? nextSphParticleState?.step
      ?? nextMlsMpmParticleState?.step
  );
  const sourceTimeS = finiteNumberOrNull(particlePingPong.sourceTime);
  const nextTimeS = finiteNumberOrNull(
    particlePingPong.nextTime
      ?? nextSphParticleState?.time
      ?? nextMlsMpmParticleState?.time
  );
  const generation = finiteNumberOrNull(
    residentExecutionGeneration
      ?? residentSteps?.residentExecutionGeneration
      ?? step?.residentExecutionGeneration
  );
  const currentGeneration = finiteNumberOrNull(
    currentResidentExecutionGeneration
      ?? residentSteps?.currentResidentExecutionGeneration
      ?? step?.currentResidentExecutionGeneration
      ?? generation
  );
  const generationMatchesCurrent = (
    generation != null
    && currentGeneration != null
    && generation === currentGeneration
  );
  const schroederRenderSource = createSchroederRenderSourceMetadata({
    residentExecution: residentSteps,
    finalStep: step,
    schroederPortableSummary,
    schroederRenderLodSummary,
    schroederPortableSummaryAdmission,
    renderOwnershipPolicy,
    source
  });
  const schroederRenderProxyDescriptorPlan = createSchroederRenderProxyDescriptorPlan({
    schroederRenderSource,
    source
  });
  const schroederRenderProxyVisibleConsumer = resolveSchroederRenderProxyVisibleConsumer({
    proxyDescriptorPlan: schroederRenderProxyDescriptorPlan
  });
  const schroederRenderProxyDrawSource = createSchroederRenderProxyDrawSource({
    proxyDescriptorPlan: schroederRenderProxyDescriptorPlan,
    visibleConsumer: schroederRenderProxyVisibleConsumer,
    source
  });
  const schroederRenderProxyBackendSelection = resolveSchroederRenderProxyBackendSelection({
    drawSource: schroederRenderProxyDrawSource,
    rendererCapability: schroederRenderProxyRendererCapability,
    renderBridgeMode: schroederRenderProxyRenderBridgeMode,
    renderBridgeStatus: schroederRenderProxyRenderBridgeStatus,
    pixelValidationStatus: schroederRenderProxyPixelValidationStatus,
    backendPreference: schroederRenderProxyBackendPreference,
    allowDiagnosticCpuProxy: schroederRenderProxyAllowDiagnosticCpuProxy,
    diagnosticMaxProxyCount: schroederRenderProxyDiagnosticMaxProxyCount,
    source
  });

  return {
    schema: 'peercompute.ulg.sph-resident-render-source.v0',
    status: generationMatchesCurrent
      ? 'resident-render-source-current'
      : 'resident-render-source-stale-or-unknown',
    source,
    residentExecutionGeneration: generation,
    currentResidentExecutionGeneration: currentGeneration,
    residentExecutionGenerationMatchesCurrent: generationMatchesCurrent,
    residentStepsSignature: stepsSignature ?? residentSteps?.signature ?? null,
    residentStepSignature: stepSignature ?? step?.signature ?? null,
    residentSourceMode: residentSteps?.residentSourceMode ?? null,
    completedStepCount: finiteNumberOrNull(residentSteps?.completedStepCount),
    finalStepSequenceIndex: finiteNumberOrNull(step?.sequenceIndex),
    sourceStep,
    nextStep,
    sourceTimeS,
    nextTimeS,
    particleCount: finiteNumberOrNull(
      nextSphParticleState?.particleCount
        ?? nextMlsMpmParticleState?.particleCount
        ?? step?.particleCount
    ),
    workerLaneNativeSurfaceSnapshotHandoff:
      residentSteps?.workerLaneNativeSurfaceSnapshotHandoff?.schema
        ? { ...residentSteps.workerLaneNativeSurfaceSnapshotHandoff }
        : null,
    schroederRenderSource,
    schroederRenderProxyDescriptorPlan,
    schroederRenderProxyVisibleConsumer,
    schroederRenderProxyDrawSource,
    schroederRenderProxyBackendSelection,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

export function applyResidentRenderSourceMetadata(target, metadata, {
  markRetainedPrevious = false,
  retentionReason = null
} = {}) {
  if (!target || !metadata) return target;
  target.residentRenderSource = metadata;
  target.sourceResidentRenderSourceSchema = metadata.schema;
  target.sourceResidentRenderSourceStatus = metadata.status;
  target.sourceResidentRenderSource = metadata.source;
  target.sourceResidentExecutionGeneration = metadata.residentExecutionGeneration;
  target.sourceResidentCurrentExecutionGeneration = metadata.currentResidentExecutionGeneration;
  target.sourceResidentExecutionGenerationMatchesCurrent =
    metadata.residentExecutionGenerationMatchesCurrent;
  target.sourceResidentStepsSignature = metadata.residentStepsSignature;
  target.sourceResidentStepSignature = metadata.residentStepSignature;
  target.sourceResidentSourceMode = metadata.residentSourceMode;
  target.sourceResidentCompletedStepCount = metadata.completedStepCount;
  target.sourceResidentFinalStepSequenceIndex = metadata.finalStepSequenceIndex;
  target.sourceResidentSourceStep = metadata.sourceStep;
  target.sourceResidentNextStep = metadata.nextStep;
  target.sourceResidentSourceTimeS = metadata.sourceTimeS;
  target.sourceResidentNextTimeS = metadata.nextTimeS;
  target.sourceResidentParticleCount = metadata.particleCount;
  target.schroederRenderSource = metadata.schroederRenderSource || null;
  target.sourceSchroederRenderSourceSchema = metadata.schroederRenderSource?.schema ?? null;
  target.sourceSchroederRenderSourceStatus = metadata.schroederRenderSource?.status ?? null;
  target.sourceSchroederRenderSourceBlocker = metadata.schroederRenderSource?.blocker ?? null;
  target.sourceSchroederRenderSourceMode = metadata.schroederRenderSource?.renderLodMode ?? null;
  target.sourceSchroederRenderSourcePresentationReady =
    Boolean(metadata.schroederRenderSource?.renderLodPresentationReady);
  target.sourceSchroederRenderSourcePresentationSourceMode =
    metadata.schroederRenderSource?.renderLodPresentationSourceMode ?? null;
  target.sourceSchroederRenderSourceActiveLeafProxyCount =
    metadata.schroederRenderSource?.activeLeafProxyCount ?? 0;
  target.sourceSchroederRenderSourceAggregateProxyCount =
    metadata.schroederRenderSource?.aggregateProxyCount ?? 0;
  target.sourceSchroederRenderSourceLawQueueProxyCount =
    metadata.schroederRenderSource?.lawQueueProxyCount ?? 0;
  target.sourceSchroederRenderSourceTotalProxyCount =
    metadata.schroederRenderSource?.totalProxyCount ?? 0;
  target.sourceSchroederRenderSourceNativeGridSpacingM =
    metadata.schroederRenderSource?.nativeGridSpacingM ?? null;
  target.sourceSchroederRenderSourceGeometryPolicy =
    metadata.schroederRenderSource?.geometryPolicy ?? null;
  target.sourceSchroederRenderSourceOpticalPolicy =
    metadata.schroederRenderSource?.opticalPolicy ?? null;
  target.sourceSchroederRenderSourceClosureDerivedPbr =
    Boolean(metadata.schroederRenderSource?.closureDerivedPbr);
  target.sourceSchroederRenderSourceDescriptorOnlyHandoff =
    Boolean(metadata.schroederRenderSource?.descriptorOnlyPeerComputeHandoff);
  target.sourceSchroederRenderSourceFullParticleReadbackAvoided =
    Boolean(metadata.schroederRenderSource?.fullParticleReadbackAvoided);
  target.sourceSchroederRenderSourceRawGpuBufferTransferDetected =
    Boolean(metadata.schroederRenderSource?.rawGpuBufferTransferDetected);
  target.sourceSchroederRenderSourceAdmissionStatus =
    metadata.schroederRenderSource?.admissionStatus ?? null;
  target.sourceSchroederRenderSourceAdmissionPublished =
    Boolean(metadata.schroederRenderSource?.admissionPublished);
  target.sourceSchroederRenderSourceAdmissionStateKey =
    metadata.schroederRenderSource?.admissionStateKey ?? null;
  target.schroederRenderProxyDescriptorPlan = metadata.schroederRenderProxyDescriptorPlan || null;
  target.sourceSchroederRenderProxyDescriptorPlanSchema =
    metadata.schroederRenderProxyDescriptorPlan?.schema ?? null;
  target.sourceSchroederRenderProxyDescriptorPlanStatus =
    metadata.schroederRenderProxyDescriptorPlan?.status ?? null;
  target.sourceSchroederRenderProxyDescriptorPlanBlocker =
    metadata.schroederRenderProxyDescriptorPlan?.blocker ?? null;
  target.sourceSchroederRenderProxyDescriptorCount =
    metadata.schroederRenderProxyDescriptorPlan?.descriptorCount ?? 0;
  target.sourceSchroederRenderProxyActiveLeafProxyCount =
    metadata.schroederRenderProxyDescriptorPlan?.activeLeafProxyCount ?? 0;
  target.sourceSchroederRenderProxyAggregateProxyCount =
    metadata.schroederRenderProxyDescriptorPlan?.aggregateProxyCount ?? 0;
  target.sourceSchroederRenderProxyLawQueueProxyCount =
    metadata.schroederRenderProxyDescriptorPlan?.lawQueueProxyCount ?? 0;
  target.sourceSchroederRenderProxyDrawableProxyCount =
    metadata.schroederRenderProxyDescriptorPlan?.drawableProxyCount ?? 0;
  target.sourceSchroederRenderProxyDiagnosticProxyCount =
    metadata.schroederRenderProxyDescriptorPlan?.diagnosticProxyCount ?? 0;
  target.sourceSchroederRenderProxyTotalProxyCount =
    metadata.schroederRenderProxyDescriptorPlan?.totalProxyCount ?? 0;
  target.sourceSchroederRenderProxyClosurePbrAvailable =
    Boolean(metadata.schroederRenderProxyDescriptorPlan?.closurePbrAvailable);
  target.sourceSchroederRenderProxyPbrMaterialSource =
    metadata.schroederRenderProxyDescriptorPlan?.pbrMaterialSource ?? null;
  target.sourceSchroederRenderProxyVisibleRenderSource =
    metadata.schroederRenderProxyDescriptorPlan?.visibleRenderSource ?? null;
  target.sourceSchroederRenderProxyRendererIntegration =
    metadata.schroederRenderProxyDescriptorPlan?.rendererIntegration ?? null;
  target.sourceSchroederRenderProxyFullParticleReadbackAvoided =
    Boolean(metadata.schroederRenderProxyDescriptorPlan?.fullParticleReadbackAvoided);
  target.sourceSchroederRenderProxyPresentationOwnsPhysicsCadence =
    Boolean(metadata.schroederRenderProxyDescriptorPlan?.presentationOwnsPhysicsCadence);
  target.schroederRenderProxyVisibleConsumer = metadata.schroederRenderProxyVisibleConsumer || null;
  target.sourceSchroederRenderProxyVisibleConsumerSchema =
    metadata.schroederRenderProxyVisibleConsumer?.schema ?? null;
  target.sourceSchroederRenderProxyVisibleConsumerStatus =
    metadata.schroederRenderProxyVisibleConsumer?.status ?? null;
  target.sourceSchroederRenderProxyVisibleConsumerReady =
    Boolean(metadata.schroederRenderProxyVisibleConsumer?.ready);
  target.sourceSchroederRenderProxyVisibleConsumerReason =
    metadata.schroederRenderProxyVisibleConsumer?.reason ?? null;
  target.sourceSchroederRenderProxyVisibleConsumerKind =
    metadata.schroederRenderProxyVisibleConsumer?.consumerKind ?? null;
  target.sourceSchroederRenderProxyVisibleConsumerMetadataDescriptorImportReady =
    Boolean(metadata.schroederRenderProxyVisibleConsumer?.metadataDescriptorImportReady);
  target.sourceSchroederRenderProxyVisibleConsumerRawGpuBufferDrawBindingReady =
    Boolean(metadata.schroederRenderProxyVisibleConsumer?.rawGpuBufferDrawBindingReady);
  target.sourceSchroederRenderProxyVisibleConsumerRawGpuBufferDrawBindingStatus =
    metadata.schroederRenderProxyVisibleConsumer?.rawGpuBufferDrawBindingStatus ?? null;
  target.sourceSchroederRenderProxyVisibleConsumerFrameCopyReadbackRequired =
    Boolean(metadata.schroederRenderProxyVisibleConsumer?.frameCopyReadbackRequired);
  target.sourceSchroederRenderProxyVisibleConsumerOverlayRequired =
    Boolean(metadata.schroederRenderProxyVisibleConsumer?.overlayRequired);
  target.sourceSchroederRenderProxyVisibleConsumerPresentationOwnsPhysicsCadence =
    Boolean(metadata.schroederRenderProxyVisibleConsumer?.presentationOwnsPhysicsCadence);
  target.schroederRenderProxyDrawSource = metadata.schroederRenderProxyDrawSource || null;
  target.sourceSchroederRenderProxyDrawSourceSchema =
    metadata.schroederRenderProxyDrawSource?.schema ?? null;
  target.sourceSchroederRenderProxyDrawSourceStatus =
    metadata.schroederRenderProxyDrawSource?.status ?? null;
  target.sourceSchroederRenderProxyDrawSourceBlocker =
    metadata.schroederRenderProxyDrawSource?.blocker ?? null;
  target.sourceSchroederRenderProxyDrawSourceReady =
    metadata.schroederRenderProxyDrawSource?.status === 'schroeder-render-proxy-draw-source-ready';
  target.sourceSchroederRenderProxyDrawBatchCount =
    metadata.schroederRenderProxyDrawSource?.drawBatchCount ?? 0;
  target.sourceSchroederRenderProxyDrawSourceRefsReady =
    Boolean(metadata.schroederRenderProxyDrawSource?.sourceRefsReady);
  target.sourceSchroederRenderProxyDrawMissingSourceRefCount =
    metadata.schroederRenderProxyDrawSource?.missingSourceRefCount ?? 0;
  target.sourceSchroederRenderProxyDrawDrawableProxyCount =
    metadata.schroederRenderProxyDrawSource?.drawableProxyCount ?? 0;
  target.sourceSchroederRenderProxyDrawMaterializationMode =
    metadata.schroederRenderProxyDrawSource?.materializationMode ?? null;
  target.sourceSchroederRenderProxyDrawRawGpuBufferBinding =
    Boolean(metadata.schroederRenderProxyDrawSource?.rawGpuBufferBinding);
  target.sourceSchroederRenderProxyDrawCpuGeometryMaterialized =
    Boolean(metadata.schroederRenderProxyDrawSource?.cpuGeometryMaterialized);
  target.sourceSchroederRenderProxyDrawFrameCopyReadbackRequired =
    Boolean(metadata.schroederRenderProxyDrawSource?.frameCopyReadbackRequired);
  target.sourceSchroederRenderProxyDrawOverlayRequired =
    Boolean(metadata.schroederRenderProxyDrawSource?.overlayRequired);
  target.schroederRenderProxyBackendSelection = metadata.schroederRenderProxyBackendSelection || null;
  target.sourceSchroederRenderProxyBackendSelectionSchema =
    metadata.schroederRenderProxyBackendSelection?.schema ?? null;
  target.sourceSchroederRenderProxyBackendSelectionStatus =
    metadata.schroederRenderProxyBackendSelection?.status ?? null;
  target.sourceSchroederRenderProxyBackendSelectionBlocker =
    metadata.schroederRenderProxyBackendSelection?.blocker ?? null;
  target.sourceSchroederRenderProxyBackendSelectionReady =
    Boolean(metadata.schroederRenderProxyBackendSelection?.ready);
  target.sourceSchroederRenderProxyBackendSelected =
    metadata.schroederRenderProxyBackendSelection?.selectedBackend ?? null;
  target.sourceSchroederRenderProxyBackendSelectedKind =
    metadata.schroederRenderProxyBackendSelection?.selectedBackendKind ?? null;
  target.sourceSchroederRenderProxyBackendPreference =
    metadata.schroederRenderProxyBackendSelection?.backendPreference ?? null;
  target.sourceSchroederRenderProxyBackendNativeSubmitReady =
    Boolean(metadata.schroederRenderProxyBackendSelection?.nativeSubmitReady);
  target.sourceSchroederRenderProxyBackendVisibleValidationReady =
    Boolean(metadata.schroederRenderProxyBackendSelection?.visibleValidationReady);
  target.sourceSchroederRenderProxyBackendRenderBridgeBound =
    Boolean(metadata.schroederRenderProxyBackendSelection?.renderBridgeBound);
  target.sourceSchroederRenderProxyBackendVisibleNoReadbackSupported =
    Boolean(metadata.schroederRenderProxyBackendSelection?.visibleNoReadbackSupported);
  target.sourceSchroederRenderProxyBackendSameDeviceRetainedBufferBindingRequired =
    Boolean(metadata.schroederRenderProxyBackendSelection?.sameDeviceRetainedBufferBindingRequired);
  target.sourceSchroederRenderProxyBackendSameDeviceRetainedBufferBindingReady =
    Boolean(metadata.schroederRenderProxyBackendSelection?.sameDeviceRetainedBufferBindingReady);
  target.sourceSchroederRenderProxyBackendDiagnosticCpuProxyExplicitlyRequested =
    Boolean(metadata.schroederRenderProxyBackendSelection?.diagnosticCpuProxyExplicitlyRequested);
  target.sourceSchroederRenderProxyBackendDiagnosticCpuProxyAllowedByPolicy =
    Boolean(metadata.schroederRenderProxyBackendSelection?.diagnosticCpuProxyAllowedByPolicy);
  target.sourceSchroederRenderProxyBackendDiagnosticCpuProxyAdmitted =
    Boolean(metadata.schroederRenderProxyBackendSelection?.diagnosticCpuProxyAdmitted);
  target.sourceSchroederRenderProxyBackendDiagnosticCpuProxyReady =
    Boolean(metadata.schroederRenderProxyBackendSelection?.diagnosticCpuProxyReady);
  target.sourceSchroederRenderProxyBackendDiagnosticCpuProxyBudget =
    metadata.schroederRenderProxyBackendSelection?.diagnosticCpuProxyBudget ?? 0;
  target.sourceSchroederRenderProxyBackendDiagnosticCpuProxyWithinBudget =
    Boolean(metadata.schroederRenderProxyBackendSelection?.diagnosticCpuProxyWithinBudget);
  target.sourceSchroederRenderProxyBackendDiagnosticCpuProxyHotPathAllowed =
    Boolean(metadata.schroederRenderProxyBackendSelection?.diagnosticCpuProxyHotPathAllowed);
  target.sourceSchroederRenderProxyBackendDiagnosticCpuProxyMaterializationMode =
    metadata.schroederRenderProxyBackendSelection?.diagnosticCpuProxyMaterializationMode ?? null;
  target.sourceSchroederRenderProxyBackendDiagnosticOnly =
    Boolean(metadata.schroederRenderProxyBackendSelection?.diagnosticOnly);
  target.sourceSchroederRenderProxyBackendPeerComputeHotPath =
    Boolean(metadata.schroederRenderProxyBackendSelection?.peerComputeHotPath);
  target.sourceSchroederRenderProxyBackendFrameCopyReadbackRequired =
    Boolean(metadata.schroederRenderProxyBackendSelection?.frameCopyReadbackRequired);
  target.sourceSchroederRenderProxyBackendOverlayRequired =
    Boolean(metadata.schroederRenderProxyBackendSelection?.overlayRequired);
  target.sourceSchroederRenderProxyBackendFullParticleReadbackRequired =
    Boolean(metadata.schroederRenderProxyBackendSelection?.fullParticleReadbackRequired);
  target.sourceSchroederRenderProxyBackendCpuGeometryMaterialized =
    Boolean(metadata.schroederRenderProxyBackendSelection?.cpuGeometryMaterialized);
  target.sourceSchroederRenderProxyBackendCpuGeometryMaterializationAdmitted =
    Boolean(metadata.schroederRenderProxyBackendSelection?.cpuGeometryMaterializationAdmitted);
  target.sourceSchroederRenderProxyBackendCpuGeometryMaterializationPolicy =
    metadata.schroederRenderProxyBackendSelection?.cpuGeometryMaterializationPolicy ?? null;
  target.sourceResidentRetainedPrevious = Boolean(markRetainedPrevious);
  target.sourceResidentRetentionReason = retentionReason ?? null;
  if (!markRetainedPrevious) {
    target.residentRenderSourceStaleAfterPublish = false;
    target.residentRenderSourceStaleReason = null;
    target.residentRenderSourceStaleAgainst = null;
  }
  return target;
}

function finiteVector3OrNull(value) {
  if (!Array.isArray(value) || value.length < 3) return null;
  const vector = value.slice(0, 3).map((entry) => Number(entry));
  return vector.every(Number.isFinite) ? vector : null;
}

export function compactResidentSurfaceDrawSurfaces(surfaces = [], limit = 8, opticalTable = null) {
  if (!Array.isArray(surfaces)) return [];
  return surfaces.slice(0, Math.max(0, Math.floor(Number(limit) || 0))).map((surface, index) => {
    const opticalRecord = Array.isArray(opticalTable?.recordMetadata)
      ? opticalTable.recordMetadata.find((record) => (
          opticalCoverageKey(record) === opticalCoverageKey(surface || {})
        )) || null
      : null;
    const optics = opticalRecord
      ? opticalParamsFromGpuTableRecord(opticalTable, surface || {})
      : null;
    return {
      surfaceIndex: Math.max(0, Math.round(Number(surface?.surfaceIndex ?? index) || 0)),
      surfaceKey: surface?.surfaceKey ?? null,
      material: surface?.material ?? null,
      phase: surface?.phase ?? null,
      renderKey: surface?.renderKey ?? null,
      renderLayer: surface?.renderLayer ?? null,
      opticalStateId: finiteNumberOrNull(surface?.opticalStateId),
      opticalPathLengthM: finiteNumberOrNull(opticalRecord?.pathLengthM),
      opticalPathLengthSource: opticalRecord?.pathLengthSource ?? null,
      opacity: finiteNumberOrNull(optics?.opacity),
      opticalDepth: finiteNumberOrNull(optics?.opticalDepth),
      scatteringCoefficientPerM: finiteNumberOrNull(optics?.scatteringCoefficientPerM),
      vertexOffset: finiteNumberOrNull(surface?.vertexOffset),
      vertexCount: finiteNumberOrNull(surface?.vertexCount),
      triangleOffset: finiteNumberOrNull(surface?.triangleOffset),
      triangleCount: finiteNumberOrNull(surface?.triangleCount),
      renderOrder: finiteNumberOrNull(surface?.renderOrder),
      transparencyClassId: finiteNumberOrNull(surface?.transparencyClassId),
      depthWriteFlag: finiteNumberOrNull(surface?.depthWriteFlag),
      boundsCenterM: finiteVector3OrNull(surface?.boundsCenterM),
      boundsRadiusM: finiteNumberOrNull(surface?.boundsRadiusM),
      status: surface?.status ?? null
    };
  });
}

function projectResidentSurfaceDrawBounds({ surface = null, viewProjection = null } = {}) {
  const center = finiteVector3OrNull(surface?.boundsCenterM);
  const radius = finiteNumberOrNull(surface?.boundsRadiusM);
  const elements = viewProjection?.elements;
  if (!center || !elements || elements.length < 16) return null;
  const [x, y, z] = center;
  const clipX = elements[0] * x + elements[4] * y + elements[8] * z + elements[12];
  const clipY = elements[1] * x + elements[5] * y + elements[9] * z + elements[13];
  const clipZ = elements[2] * x + elements[6] * y + elements[10] * z + elements[14];
  const clipW = elements[3] * x + elements[7] * y + elements[11] * z + elements[15];
  const ndcCenter = Number.isFinite(clipW) && Math.abs(clipW) > 1e-9
    ? [clipX / clipW, clipY / clipW, clipZ / clipW]
    : null;
  const centerInsideClip = Boolean(
    ndcCenter
    && ndcCenter[0] >= -1
    && ndcCenter[0] <= 1
    && ndcCenter[1] >= -1
    && ndcCenter[1] <= 1
    && ndcCenter[2] >= -1
    && ndcCenter[2] <= 1
  );
  return {
    boundsCenterM: center,
    boundsRadiusM: Number.isFinite(radius) && radius > 0 ? radius : null,
    clipCenter: [clipX, clipY, clipZ, clipW],
    clipW,
    ndcCenter,
    inFront: Number.isFinite(clipW) && clipW > 0,
    centerInsideClip,
    maybeVisible: centerInsideClip
  };
}

export function updateResidentSurfaceDrawRenderBridgeDiagnostics(bridge, {
  viewProjection = null,
  drawOrder = [],
  opaqueDraws = [],
  refractiveDraws = null,
  vaporDraws = [],
  // Compatibility input for callers/tests written before refractive surfaces
  // became opaque framebuffer writes rather than transparent composites.
  transparentDraws = null
} = {}) {
  if (!bridge) return null;
  const surfaces = Array.isArray(bridge.drawState?.surfaces) ? bridge.drawState.surfaces : [];
  const primaryDraw = Array.isArray(drawOrder) && drawOrder.length ? drawOrder[0] : null;
  const primarySurfaceIndex = Math.max(0, Math.round(Number(primaryDraw?.surfaceIndex ?? 0) || 0));
  const primarySurface = surfaces.find((surface, index) => (
    Math.max(0, Math.round(Number(surface?.surfaceIndex ?? index) || 0)) === primarySurfaceIndex
  )) || surfaces[0] || null;
  const projectedBounds = projectResidentSurfaceDrawBounds({
    surface: primarySurface,
    viewProjection
  });
  bridge.lastCanvasWidth = bridge.canvas?.width ?? null;
  bridge.lastCanvasHeight = bridge.canvas?.height ?? null;
  bridge.lastCanvasClientWidth = finiteNumberOrNull(bridge.canvas?.clientWidth);
  bridge.lastCanvasClientHeight = finiteNumberOrNull(bridge.canvas?.clientHeight);
  const bridgeWindow = bridge.canvas?.ownerDocument?.defaultView || globalThis;
  bridge.lastDevicePixelRatio = bridge.lastCanvasResizePixelRatio
    ?? finiteNumberOrNull(resolveSphScenePixelRatio(bridgeWindow.devicePixelRatio ?? globalThis.devicePixelRatio));
  bridge.lastDrawOrderCount = Array.isArray(drawOrder) ? drawOrder.length : 0;
  bridge.lastOpaqueDrawCount = Array.isArray(opaqueDraws) ? opaqueDraws.length : 0;
  const resolvedRefractiveDraws = Array.isArray(refractiveDraws)
    ? refractiveDraws
    : (Array.isArray(transparentDraws) ? transparentDraws : []);
  bridge.lastRefractiveDrawCount = resolvedRefractiveDraws.length;
  bridge.lastVaporDrawCount = Array.isArray(vaporDraws) ? vaporDraws.length : 0;
  // Retain the old aggregate field for downstream probes. Refractive draws
  // are alpha-one; only vapor draws use alpha blending.
  bridge.lastTransparentDrawCount = bridge.lastRefractiveDrawCount
    + bridge.lastVaporDrawCount;
  bridge.primarySurfaceIndex = primarySurfaceIndex;
  bridge.primarySurfaceBoundsCenterM = projectedBounds?.boundsCenterM ?? null;
  bridge.primarySurfaceBoundsRadiusM = projectedBounds?.boundsRadiusM ?? null;
  bridge.primarySurfaceBoundsClipCenter = projectedBounds?.clipCenter ?? null;
  bridge.primarySurfaceBoundsClipW = projectedBounds?.clipW ?? null;
  bridge.primarySurfaceBoundsNdcCenter = projectedBounds?.ndcCenter ?? null;
  bridge.primarySurfaceBoundsInFront = projectedBounds?.inFront ?? null;
  bridge.primarySurfaceBoundsCenterInsideClip = projectedBounds?.centerInsideClip ?? null;
  bridge.primarySurfaceBoundsMaybeVisible = projectedBounds?.maybeVisible ?? null;
  return projectedBounds;
}

export function publishResidentSurfaceDrawRenderBridgeDiagnostics(target, bridge) {
  if (!target || !bridge) return target;
  target.renderBridgeRenderAttemptCount = bridge.renderAttemptCount ?? null;
  target.renderBridgeRenderSkipCount = bridge.renderSkipCount ?? null;
  target.renderBridgeLastRenderAttemptReason = bridge.lastRenderAttemptReason ?? null;
  target.renderBridgeLastRenderAttemptAtMs = bridge.lastRenderAttemptAtMs ?? null;
  target.renderBridgeLastRenderSkipStatus = bridge.lastRenderSkipStatus ?? null;
  target.renderBridgeLastRenderSkipReason = bridge.lastRenderSkipReason ?? null;
  target.renderBridgeReused = Boolean(bridge.threeRenderBridgeReused);
  target.renderBridgeUpdateCount = bridge.updateCount ?? 0;
  target.renderBridgeNativeSurfaceReuseStatus = bridge.nativeSurfaceRenderBridgeReuseStatus ?? null;
  target.renderBridgeNativeSurfaceConsumerRafSustain = Boolean(bridge.nativeSurfaceConsumerRafSustain);
  target.renderBridgeLastNativeSurfaceConsumerRafReason = bridge.lastNativeSurfaceConsumerRafReason ?? null;
  target.renderBridgeLastNativeSurfaceConsumerRafScheduleReason =
    bridge.lastNativeSurfaceConsumerRafScheduleReason ?? null;
  target.renderBridgeNativeSurfaceConsumerRafBlockedReason =
    bridge.nativeSurfaceConsumerRafBlockedReason ?? null;
  target.renderBridgeNativeSurfaceConsumerSubmitFencePending =
    Boolean(bridge.nativeSurfaceConsumerSubmitFencePending);
  target.renderBridgeNativeSurfaceConsumerSubmitFenceSerial =
    bridge.nativeSurfaceConsumerSubmitFenceSerial ?? null;
  target.renderBridgeNativeSurfaceConsumerSubmitFenceReason =
    bridge.nativeSurfaceConsumerSubmitFenceReason ?? null;
  target.renderBridgeNativeSurfaceConsumerSubmitFenceElapsedMs =
    bridge.nativeSurfaceConsumerSubmitFenceElapsedMs ?? null;
  target.renderBridgeNativeSurfaceConsumerSubmitFenceTimedOut =
    bridge.nativeSurfaceConsumerSubmitFenceTimedOut ?? null;
  target.renderBridgeNativeSurfaceConsumerSubmitFenceFailed =
    bridge.nativeSurfaceConsumerSubmitFenceFailed ?? null;
  target.renderBridgeNativeSurfaceConsumerSubmitFenceExceededBudget =
    bridge.nativeSurfaceConsumerSubmitFenceExceededBudget ?? null;
  target.renderBridgeNativeSurfaceConsumerInFlightSubmitCount = Math.max(
    0,
    Math.round(Number(bridge.nativeSurfaceConsumerInFlightSubmitCount) || 0)
  );
  target.renderBridgeNativeSurfaceResourceGeneration =
    bridge.activeSurfaceResourceOwner?.generation ?? bridge.nativeSurfaceResourceGeneration ?? null;
  target.renderBridgeNativeSurfaceRetiredGenerationCount = Array.isArray(
    bridge.retiredSurfaceResourceOwners
  ) ? bridge.retiredSurfaceResourceOwners.length : 0;
  target.renderBridgeAdditionalSurfaceAttachStatus = bridge.additionalSurfaceAttachStatus ?? null;
  target.renderBridgeAdditionalSurfaceAttachReason = bridge.additionalSurfaceAttachReason ?? null;
  target.renderBridgeAdditionalSurfaceDrawCount = Array.isArray(
    bridge.drawState?.additionalSurfaceDraws
  ) ? bridge.drawState.additionalSurfaceDraws.length : 0;
  target.renderBridgeCanvasWidth = bridge.lastCanvasWidth ?? null;
  target.renderBridgeCanvasHeight = bridge.lastCanvasHeight ?? null;
  target.renderBridgeCanvasCssWidth = bridge.lastCanvasCssWidth ?? null;
  target.renderBridgeCanvasCssHeight = bridge.lastCanvasCssHeight ?? null;
  target.renderBridgeCanvasClientWidth = bridge.lastCanvasClientWidth ?? null;
  target.renderBridgeCanvasClientHeight = bridge.lastCanvasClientHeight ?? null;
  target.renderBridgeDevicePixelRatio = bridge.lastDevicePixelRatio ?? null;
  target.renderBridgeCanvasResizePixelRatio = bridge.lastCanvasResizePixelRatio ?? null;
  target.renderBridgeConfiguredCanvasWidth = bridge.configuredCanvasWidth ?? null;
  target.renderBridgeConfiguredCanvasHeight = bridge.configuredCanvasHeight ?? null;
  target.renderBridgeContextConfigureCount = bridge.contextConfigureCount ?? null;
  target.renderBridgeLastContextConfigureReason = bridge.lastContextConfigureReason ?? null;
  target.renderBridgeLastNativeContextReconfigured = bridge.lastNativeContextReconfigured ?? null;
  target.renderBridgeDeviceLost = Boolean(bridge.deviceLost);
  target.renderBridgeDeviceLostReason = bridge.deviceLostReason ?? null;
  target.renderBridgeDeviceLostInfo = bridge.deviceLostInfo ?? null;
  target.renderBridgeLastDrawOrderCount = bridge.lastDrawOrderCount ?? null;
  target.renderBridgePrimarySurfaceIndex = bridge.primarySurfaceIndex ?? null;
  target.renderBridgePrimaryBoundsCenterM = bridge.primarySurfaceBoundsCenterM ?? null;
  target.renderBridgePrimaryBoundsRadiusM = bridge.primarySurfaceBoundsRadiusM ?? null;
  target.renderBridgePrimaryBoundsClipCenter = bridge.primarySurfaceBoundsClipCenter ?? null;
  target.renderBridgePrimaryBoundsClipW = bridge.primarySurfaceBoundsClipW ?? null;
  target.renderBridgePrimaryBoundsNdcCenter = bridge.primarySurfaceBoundsNdcCenter ?? null;
  target.renderBridgePrimaryBoundsInFront = bridge.primarySurfaceBoundsInFront ?? null;
  target.renderBridgePrimaryBoundsCenterInsideClip = bridge.primarySurfaceBoundsCenterInsideClip ?? null;
  target.renderBridgePrimaryBoundsMaybeVisible = bridge.primarySurfaceBoundsMaybeVisible ?? null;
  target.renderBridgeOffscreenValidationStatus = bridge.offscreenValidationStatus ?? null;
  target.renderBridgeNativeWebGpuSurfaceConsumerOffscreenValidationStatus =
    bridge.nativeWebGpuSurfaceConsumerOffscreenValidationStatus ?? null;
  target.renderBridgeOffscreenValidationReason = bridge.offscreenValidationReason ?? null;
  target.renderBridgeOffscreenValidationSample = Array.isArray(bridge.offscreenValidationSample)
    ? [...bridge.offscreenValidationSample]
    : null;
    target.renderBridgeReadbackSmokeValidationStatus = bridge.readbackSmokeValidationStatus ?? null;
    target.renderBridgeReadbackSmokeValidationReason = bridge.readbackSmokeValidationReason ?? null;
    target.renderBridgeReadbackSmokeValidationSample = Array.isArray(bridge.readbackSmokeValidationSample)
      ? [...bridge.readbackSmokeValidationSample]
      : null;
    target.renderBridgeReadbackSmokeValidationAttemptCount =
      bridge.readbackSmokeValidationAttemptCount ?? null;
    target.renderBridgeNativeSurfaceValidationCadenceStatus =
      bridge.nativeSurfaceValidationCadenceStatus ?? null;
    target.renderBridgeNativeSurfaceValidationCadenceReason =
      bridge.nativeSurfaceValidationCadenceReason ?? null;
    target.renderBridgeNativeSurfaceValidationEncoderRequired =
      bridge.nativeSurfaceValidationEncoderRequired ?? null;
    target.renderBridgeNativeSurfaceValidationScope =
      bridge.nativeSurfaceValidationScope ?? null;
    target.renderBridgeNativeSurfaceReadbackSmokeValidationNeeded =
      bridge.nativeSurfaceReadbackSmokeValidationNeeded ?? null;
    target.renderBridgeNativeSurfaceOffscreenValidationEligible =
      bridge.nativeSurfaceOffscreenValidationEligible ?? null;
    target.renderBridgeNativeSurfaceOffscreenValidationNeeded =
      bridge.nativeSurfaceOffscreenValidationNeeded ?? null;
    target.renderBridgeNativeSurfaceOffscreenValidationSkippedReason =
      bridge.nativeSurfaceOffscreenValidationSkippedReason ?? null;
    target.renderBridgeOffscreenValidationNonzeroPixelCount =
      bridge.offscreenValidationNonzeroPixelCount ?? null;
    target.renderBridgeOffscreenValidationPixelCount = bridge.offscreenValidationPixelCount ?? null;
    target.renderBridgeOffscreenValidationResourceGeneration =
      bridge.offscreenValidationResourceGeneration ?? null;
    target.renderBridgeOffscreenValidationTargetResourceGeneration =
      bridge.offscreenValidationTargetResourceGeneration ?? null;
    target.renderBridgeOffscreenValidationWidth = bridge.offscreenValidationWidth ?? null;
    target.renderBridgeOffscreenValidationHeight = bridge.offscreenValidationHeight ?? null;
    target.renderBridgeOffscreenValidationAttemptCount = bridge.offscreenValidationAttemptCount ?? null;
    target.renderBridgeLastSubmittedDrawCount = bridge.lastSubmittedDrawCount ?? null;
    target.renderBridgeTransparencyCompositeMode = bridge.lastTransparentCompositeMode
      || bridge.transparencyCompositeMode
      || null;
    target.renderBridgeLastOpaqueDrawCount = bridge.lastOpaqueDrawCount ?? 0;
    target.renderBridgeLastTransparentDrawCount = bridge.lastTransparentDrawCount ?? 0;
    target.renderBridgeLastRefractiveDrawCount = bridge.lastRefractiveDrawCount
      ?? bridge.lastTransparentDrawCount
      ?? 0;
    target.renderBridgeConfiguredAlphaMode = bridge.configuredAlphaMode ?? null;
    target.renderBridgeSurfaceAlphaMode = bridge.surfaceAlphaMode ?? null;
    target.renderBridgeSurfaceBlendEnabled = Boolean(bridge.surfaceBlendEnabled);
    target.renderBridgeSurfaceDepthWriteEnabled = Boolean(bridge.surfaceDepthWriteEnabled);
    target.renderBridgePackedNormalReady = Boolean(
      bridge.drawState?.packedNormalBuffer
      && (bridge.drawState?.packedNormalRowCount ?? 0) > 0
    );
    target.renderBridgePackedNormalByteLength = bridge.externalGpuBufferPackedNormalByteLength ?? 0;
    target.renderBridgePackedNormalRowCount = bridge.externalGpuBufferPackedNormalRowCount ?? 0;
    target.renderBridgePackedNormalEncoding = bridge.externalGpuBufferPackedNormalEncoding ?? null;
    target.renderBridgePackedNormalSurfaceGenerationId =
      bridge.externalGpuBufferPackedNormalSurfaceGenerationId ?? null;
    target.renderBridgePackedNormalAdditionalSubmitCount =
      bridge.externalGpuBufferPackedNormalAdditionalSubmitCount ?? null;
    target.renderBridgeVertexTemperatureReady = Boolean(
      bridge.drawState?.vertexTemperatureBuffer
      && (bridge.drawState?.vertexTemperatureRowCount ?? 0) > 0
    );
    target.renderBridgeVertexTemperatureByteLength =
      bridge.externalGpuBufferVertexTemperatureByteLength ?? 0;
    target.renderBridgeVertexTemperatureRowCount =
      bridge.externalGpuBufferVertexTemperatureRowCount ?? 0;
    target.renderBridgeVertexTemperatureEncoding =
      bridge.externalGpuBufferVertexTemperatureEncoding ?? null;
    target.renderBridgeVertexTemperatureSurfaceGenerationId =
      bridge.externalGpuBufferVertexTemperatureSurfaceGenerationId ?? null;
    target.renderBridgeVertexTemperatureVolumeGenerationId =
      bridge.externalGpuBufferVertexTemperatureVolumeGenerationId ?? null;
    target.renderBridgeVertexTemperatureAdditionalSubmitCount =
      bridge.externalGpuBufferVertexTemperatureAdditionalSubmitCount ?? null;
    target.renderBridgeVertexTemperatureAdditionalReadyCount = (
      bridge.drawState?.additionalSurfaceDraws || []
    ).filter((draw) => draw?.temperatureBuffer && (draw?.temperatureRowCount ?? 0) > 0).length;
    target.renderBridgeRefractionTargetLifecycleStatus = bridge.refractionTargetLifecycleStatus ?? null;
    target.renderBridgeRefractionTargetLifecycleReason = bridge.refractionTargetLifecycleReason ?? null;
    target.renderBridgeRefractionTargetGeneration = bridge.refractionTargetSet?.generation
      ?? bridge.refractionTargetGeneration
      ?? null;
    target.renderBridgeRefractionTargetWidth = bridge.refractionTargetSet?.width
      ?? bridge.refractionCopyWidth
      ?? 0;
    target.renderBridgeRefractionTargetHeight = bridge.refractionTargetSet?.height
      ?? bridge.refractionCopyHeight
      ?? 0;
    target.renderBridgeRefractionTargetColorFormat = bridge.refractionTargetSet?.colorFormat
      ?? bridge.refractionCopyFormat
      ?? null;
    target.renderBridgeRefractionTargetDepthFormat = bridge.refractionTargetSet?.depthFormat
      ?? bridge.refractionBackfaceDepthFormat
      ?? null;
    target.renderBridgeRefractionTargetRetirementPendingCount =
      bridge.refractionTargetRetirementPendingCount ?? 0;
    target.renderBridgeRefractionTargetRetirementCount = bridge.refractionTargetRetirementCount ?? 0;
    target.renderBridgeRefractionBackfaceStatus = bridge.refractionBackfaceStatus ?? null;
    target.renderBridgeRefractionBackfaceCacheHit = bridge.lastRefractionBackfaceCacheHit ?? null;
    target.renderBridgeRefractionBackfacePassDrawCount =
      bridge.lastRefractionBackfacePassDrawCount ?? 0;
    target.renderBridgeRefractionBackfaceAdditionalSubmitCount =
      bridge.refractionBackfaceAdditionalSubmitCount ?? null;
    target.renderBridgeBackgroundImageGpuStatus = bridge.backgroundImageGpuStatus ?? null;
    target.renderBridgeBackgroundImageDrawCount = bridge.backgroundImageDrawCount ?? 0;
  target.renderBridgeNativeSurfaceCandidateStageSubmissionCount =
    bridge.nativeSurfaceCandidateStageSubmissionCount ?? 0;
  target.renderBridgeNativeSurfaceCandidateStageSubmittedAtMs =
    bridge.nativeSurfaceCandidateStageSubmittedAtMs ?? null;
  target.renderBridgeNativeSurfaceCandidatePresentationCopyCount =
    bridge.nativeSurfaceCandidatePresentationCopyCount ?? 0;
  target.renderBridgeNativeSurfaceCandidatePresentationPostAdmissionGeometrySubmitCount =
    bridge.nativeSurfaceCandidatePresentationPostAdmissionGeometrySubmitCount ?? null;
  target.renderBridgeNativeSurfaceCandidateStagedPresentationStatus =
    bridge.nativeSurfaceCandidateStagedPresentationStatus ?? null;
  target.renderBridgeNativeSurfaceCandidateStagedPresentationReason =
    bridge.nativeSurfaceCandidateStagedPresentationReason ?? null;
  target.renderBridgeCandidateForegroundValidationStatus =
    bridge.nativeSurfaceCandidateForegroundValidationStatus ?? null;
  target.renderBridgeCandidateForegroundValidationReason =
    bridge.nativeSurfaceCandidateForegroundValidationReason ?? null;
  target.renderBridgeCandidateForegroundProofKind =
    bridge.nativeSurfaceCandidateForegroundProofKind ?? null;
  target.renderBridgeCandidateForegroundGpuFenceSatisfied =
    bridge.nativeSurfaceCandidateForegroundGpuFenceSatisfied ?? null;
  target.renderBridgeCandidateForegroundSameQueueSubmissionBoundary =
    bridge.nativeSurfaceCandidateForegroundSameQueueSubmissionBoundary ?? null;
  target.renderBridgeCandidateForegroundSubmittedDrawCount =
    bridge.nativeSurfaceCandidateForegroundSubmittedDrawCount ?? null;
  target.renderBridgeCandidateForegroundResourceGeneration =
    bridge.nativeSurfaceCandidateForegroundResourceGeneration ?? null;
  target.renderBridgeNativeSurfaceCandidateStagedPresentationChangedPixelCount =
    bridge.nativeSurfaceCandidateStagedPresentation?.changedPixelCount ?? null;
  target.renderBridgeNativeSurfaceCandidateStagedPresentationGeneration =
    bridge.nativeSurfaceCandidateStagedPresentation?.candidateGeneration ?? null;
  target.renderBridgeNativeSurfaceCandidateStagedPresentationTiming =
    bridge.nativeSurfaceCandidateStagedPresentationTiming ?? null;
  target.renderBridgeSchroederRenderProxyLocalResolverStatus =
    bridge.schroederRenderProxyLocalResolverStatus
    ?? bridge.schroederRenderProxyLocalRetainedBufferResolver?.status
    ?? null;
  target.renderBridgeSchroederRenderProxyLocalResolverRetainedBufferRefCount =
    bridge.schroederRenderProxyLocalResolverRetainedBufferRefCount
    ?? bridge.schroederRenderProxyLocalRetainedBufferResolver?.retainedBufferRefCount
    ?? 0;
  target.renderBridgeSchroederRenderProxyNativeExecutorStatus =
    bridge.schroederRenderProxyNativeExecutorStatus
    ?? bridge.schroederRenderProxyNativeExecutor?.status
    ?? null;
  target.renderBridgeSchroederRenderProxyNativeExecutorReady =
    Boolean(
      bridge.schroederRenderProxyNativeExecutorReady
      ?? bridge.schroederRenderProxyNativeExecutor?.ready
    );
  target.renderBridgeSchroederRenderProxyNativeExecutorDrawCommandCount =
    bridge.schroederRenderProxyNativeExecutorDrawCommandCount
    ?? bridge.schroederRenderProxyNativeExecutor?.drawCommands?.length
    ?? 0;
  target.renderBridgeSchroederRenderProxyNativeExecutorDrawInstanceCount =
    bridge.schroederRenderProxyNativeExecutorDrawInstanceCount ?? 0;
  target.renderBridgeSchroederRenderProxyNativeCameraUpdateStatus =
    bridge.schroederRenderProxyNativeCameraUpdateStatus ?? null;
  target.renderBridgeSchroederRenderProxyNativeLastSubmitStatus =
    bridge.lastSchroederRenderProxyNativeSubmitStatus ?? null;
  target.renderBridgeSchroederRenderProxyNativeLastSubmitDrawCommandCount =
    bridge.lastSchroederRenderProxyNativeDrawCommandCount ?? 0;
  target.renderBridgeSchroederRenderProxyNativeLastSubmitDrawInstanceCount =
    bridge.lastSchroederRenderProxyNativeDrawInstanceCount ?? 0;
    target.renderBridgeNativeSurfaceDebugMode = bridge.lastNativeSurfaceDebugMode
      || bridge.nativeSurfaceDebugMode
      || 'none';
    target.renderBridgeNativeSurfaceDebugStatus = bridge.lastNativeSurfaceDebugStatus ?? null;
    target.renderBridgeNativeSurfaceDebugSkippedDrawCount =
      bridge.lastNativeSurfaceDebugSkippedDrawCount ?? null;
    target.renderBridgeNativeSurfaceDebugClearValue = bridge.lastNativeSurfaceDebugClearValue ?? null;
    target.renderBridgeNativeSurfaceDeferredResourceReleaseStatus =
      bridge.nativeSurfaceDeferredResourceReleaseStatus ?? null;
    target.renderBridgeNativeSurfaceDeferredResourceReleaseReason =
      bridge.nativeSurfaceDeferredResourceReleaseReason ?? null;
    target.renderBridgeNativeSurfaceDeferredResourceReleasePending =
      bridge.nativeSurfaceDeferredResourceReleasePending ?? 0;
  target.renderBridgeExternalGpuBufferByteLength = bridge.externalGpuBufferByteLength ?? 0;
  target.renderBridgeExternalGpuBufferInputLayout = bridge.externalGpuBufferInputLayout ?? null;
  target.renderBridgeExternalGpuBufferVertexRowStrideFloats =
    bridge.externalGpuBufferVertexRowStrideFloats ?? 0;
  target.renderBridgeCompactPositionDirectInput = Boolean(bridge.compactPositionDirectInput);
  target.renderBridgeCompactPositionDirectInputByteLength =
    bridge.compactPositionDirectInputByteLength ?? 0;
  target.renderBridgeCompactPositionDirectInputVertexCount =
    bridge.compactPositionDirectInputVertexCount ?? 0;
    return target;
  }

export function publishResidentRenderStateSurfaceDrawRenderBridgeDiagnostics(target, bridge) {
  if (!target || !bridge) return target;
  target.surfaceDrawRenderBridgeRenderAttemptCount = bridge.renderAttemptCount ?? null;
  target.surfaceDrawRenderBridgeRenderSkipCount = bridge.renderSkipCount ?? null;
  target.surfaceDrawRenderBridgeLastRenderAttemptReason = bridge.lastRenderAttemptReason ?? null;
  target.surfaceDrawRenderBridgeLastRenderAttemptAtMs = bridge.lastRenderAttemptAtMs ?? null;
  target.surfaceDrawRenderBridgeLastRenderSkipStatus = bridge.lastRenderSkipStatus ?? null;
  target.surfaceDrawRenderBridgeLastRenderSkipReason = bridge.lastRenderSkipReason ?? null;
  target.surfaceDrawRenderBridgeNativeSurfaceConsumerRafSustain =
    Boolean(bridge.nativeSurfaceConsumerRafSustain);
  target.surfaceDrawRenderBridgeLastNativeSurfaceConsumerRafReason =
    bridge.lastNativeSurfaceConsumerRafReason ?? null;
  target.surfaceDrawRenderBridgeLastNativeSurfaceConsumerRafScheduleReason =
    bridge.lastNativeSurfaceConsumerRafScheduleReason ?? null;
  target.surfaceDrawRenderBridgeNativeSurfaceConsumerRafBlockedReason =
    bridge.nativeSurfaceConsumerRafBlockedReason ?? null;
  target.surfaceDrawRenderBridgeNativeSurfaceConsumerSubmitFencePending =
    Boolean(bridge.nativeSurfaceConsumerSubmitFencePending);
  target.surfaceDrawRenderBridgeNativeSurfaceConsumerSubmitFenceSerial =
    bridge.nativeSurfaceConsumerSubmitFenceSerial ?? null;
  target.surfaceDrawRenderBridgeNativeSurfaceConsumerSubmitFenceReason =
    bridge.nativeSurfaceConsumerSubmitFenceReason ?? null;
  target.surfaceDrawRenderBridgeNativeSurfaceConsumerSubmitFenceElapsedMs =
    bridge.nativeSurfaceConsumerSubmitFenceElapsedMs ?? null;
  target.surfaceDrawRenderBridgeNativeSurfaceConsumerSubmitFenceTimedOut =
    bridge.nativeSurfaceConsumerSubmitFenceTimedOut ?? null;
  target.surfaceDrawRenderBridgeNativeSurfaceConsumerInFlightSubmitCount = Math.max(
    0,
    Math.round(Number(bridge.nativeSurfaceConsumerInFlightSubmitCount) || 0)
  );
  target.surfaceDrawRenderBridgeCanvasWidth = bridge.lastCanvasWidth ?? null;
  target.surfaceDrawRenderBridgeCanvasHeight = bridge.lastCanvasHeight ?? null;
  target.surfaceDrawRenderBridgeCanvasCssWidth = bridge.lastCanvasCssWidth ?? null;
  target.surfaceDrawRenderBridgeCanvasCssHeight = bridge.lastCanvasCssHeight ?? null;
  target.surfaceDrawRenderBridgeCanvasClientWidth = bridge.lastCanvasClientWidth ?? null;
  target.surfaceDrawRenderBridgeCanvasClientHeight = bridge.lastCanvasClientHeight ?? null;
  target.surfaceDrawRenderBridgeDevicePixelRatio = bridge.lastDevicePixelRatio ?? null;
  target.surfaceDrawRenderBridgeCanvasResizePixelRatio = bridge.lastCanvasResizePixelRatio ?? null;
  target.surfaceDrawRenderBridgeConfiguredCanvasWidth = bridge.configuredCanvasWidth ?? null;
  target.surfaceDrawRenderBridgeConfiguredCanvasHeight = bridge.configuredCanvasHeight ?? null;
  target.surfaceDrawRenderBridgeContextConfigureCount = bridge.contextConfigureCount ?? null;
  target.surfaceDrawRenderBridgeLastContextConfigureReason = bridge.lastContextConfigureReason ?? null;
  target.surfaceDrawRenderBridgeLastNativeContextReconfigured = bridge.lastNativeContextReconfigured ?? null;
  target.surfaceDrawRenderBridgeDeviceLost = Boolean(bridge.deviceLost);
  target.surfaceDrawRenderBridgeDeviceLostReason = bridge.deviceLostReason ?? null;
  target.surfaceDrawRenderBridgeDeviceLostInfo = bridge.deviceLostInfo ?? null;
  target.surfaceDrawRenderBridgeLastDrawOrderCount = bridge.lastDrawOrderCount ?? null;
  target.surfaceDrawRenderBridgePrimarySurfaceIndex = bridge.primarySurfaceIndex ?? null;
  target.surfaceDrawRenderBridgePrimaryBoundsCenterM = bridge.primarySurfaceBoundsCenterM ?? null;
  target.surfaceDrawRenderBridgePrimaryBoundsRadiusM = bridge.primarySurfaceBoundsRadiusM ?? null;
  target.surfaceDrawRenderBridgePrimaryBoundsClipCenter = bridge.primarySurfaceBoundsClipCenter ?? null;
  target.surfaceDrawRenderBridgePrimaryBoundsClipW = bridge.primarySurfaceBoundsClipW ?? null;
  target.surfaceDrawRenderBridgePrimaryBoundsNdcCenter = bridge.primarySurfaceBoundsNdcCenter ?? null;
  target.surfaceDrawRenderBridgePrimaryBoundsInFront = bridge.primarySurfaceBoundsInFront ?? null;
  target.surfaceDrawRenderBridgePrimaryBoundsCenterInsideClip =
    bridge.primarySurfaceBoundsCenterInsideClip ?? null;
  target.surfaceDrawRenderBridgePrimaryBoundsMaybeVisible = bridge.primarySurfaceBoundsMaybeVisible ?? null;
  target.surfaceDrawRenderBridgeOffscreenValidationStatus = bridge.offscreenValidationStatus ?? null;
  target.surfaceDrawRenderBridgeNativeWebGpuSurfaceConsumerOffscreenValidationStatus =
    bridge.nativeWebGpuSurfaceConsumerOffscreenValidationStatus ?? null;
  target.surfaceDrawRenderBridgeOffscreenValidationReason = bridge.offscreenValidationReason ?? null;
  target.surfaceDrawRenderBridgeOffscreenValidationSample = Array.isArray(bridge.offscreenValidationSample)
    ? [...bridge.offscreenValidationSample]
    : null;
  target.surfaceDrawRenderBridgeReadbackSmokeValidationStatus =
    bridge.readbackSmokeValidationStatus ?? null;
  target.surfaceDrawRenderBridgeReadbackSmokeValidationReason =
    bridge.readbackSmokeValidationReason ?? null;
  target.surfaceDrawRenderBridgeReadbackSmokeValidationSample = Array.isArray(bridge.readbackSmokeValidationSample)
    ? [...bridge.readbackSmokeValidationSample]
    : null;
  target.surfaceDrawRenderBridgeReadbackSmokeValidationAttemptCount =
    bridge.readbackSmokeValidationAttemptCount ?? null;
  target.surfaceDrawRenderBridgeNativeSurfaceValidationCadenceStatus =
    bridge.nativeSurfaceValidationCadenceStatus ?? null;
  target.surfaceDrawRenderBridgeNativeSurfaceValidationCadenceReason =
    bridge.nativeSurfaceValidationCadenceReason ?? null;
  target.surfaceDrawRenderBridgeNativeSurfaceValidationEncoderRequired =
    bridge.nativeSurfaceValidationEncoderRequired ?? null;
  target.surfaceDrawRenderBridgeNativeSurfaceValidationScope =
    bridge.nativeSurfaceValidationScope ?? null;
  target.surfaceDrawRenderBridgeNativeSurfaceReadbackSmokeValidationNeeded =
    bridge.nativeSurfaceReadbackSmokeValidationNeeded ?? null;
  target.surfaceDrawRenderBridgeNativeSurfaceOffscreenValidationEligible =
    bridge.nativeSurfaceOffscreenValidationEligible ?? null;
  target.surfaceDrawRenderBridgeNativeSurfaceOffscreenValidationNeeded =
    bridge.nativeSurfaceOffscreenValidationNeeded ?? null;
  target.surfaceDrawRenderBridgeNativeSurfaceOffscreenValidationSkippedReason =
    bridge.nativeSurfaceOffscreenValidationSkippedReason ?? null;
  target.surfaceDrawRenderBridgeOffscreenValidationNonzeroPixelCount =
    bridge.offscreenValidationNonzeroPixelCount ?? null;
    target.surfaceDrawRenderBridgeOffscreenValidationPixelCount = bridge.offscreenValidationPixelCount ?? null;
    target.surfaceDrawRenderBridgeOffscreenValidationWidth = bridge.offscreenValidationWidth ?? null;
    target.surfaceDrawRenderBridgeOffscreenValidationHeight = bridge.offscreenValidationHeight ?? null;
    target.surfaceDrawRenderBridgeOffscreenValidationAttemptCount =
      bridge.offscreenValidationAttemptCount ?? null;
    target.surfaceDrawRenderBridgeTransparencyCompositeMode = bridge.lastTransparentCompositeMode
      || bridge.transparencyCompositeMode
      || null;
    target.surfaceDrawRenderBridgeLastOpaqueDrawCount = bridge.lastOpaqueDrawCount ?? 0;
    target.surfaceDrawRenderBridgeLastTransparentDrawCount = bridge.lastTransparentDrawCount ?? 0;
    target.surfaceDrawRenderBridgeLastRefractiveDrawCount = bridge.lastRefractiveDrawCount
      ?? bridge.lastTransparentDrawCount
      ?? 0;
    target.surfaceDrawRenderBridgeConfiguredAlphaMode = bridge.configuredAlphaMode ?? null;
    target.surfaceDrawRenderBridgeSurfaceAlphaMode = bridge.surfaceAlphaMode ?? null;
    target.surfaceDrawRenderBridgeSurfaceBlendEnabled = Boolean(bridge.surfaceBlendEnabled);
    target.surfaceDrawRenderBridgeSurfaceDepthWriteEnabled = Boolean(bridge.surfaceDepthWriteEnabled);
    target.surfaceDrawRenderBridgePackedNormalReady = Boolean(
      bridge.drawState?.packedNormalBuffer
      && (bridge.drawState?.packedNormalRowCount ?? 0) > 0
    );
    target.surfaceDrawRenderBridgePackedNormalByteLength =
      bridge.externalGpuBufferPackedNormalByteLength ?? 0;
    target.surfaceDrawRenderBridgePackedNormalRowCount = bridge.externalGpuBufferPackedNormalRowCount ?? 0;
    target.surfaceDrawRenderBridgePackedNormalEncoding = bridge.externalGpuBufferPackedNormalEncoding ?? null;
    target.surfaceDrawRenderBridgePackedNormalSurfaceGenerationId =
      bridge.externalGpuBufferPackedNormalSurfaceGenerationId ?? null;
    target.surfaceDrawRenderBridgePackedNormalAdditionalSubmitCount =
      bridge.externalGpuBufferPackedNormalAdditionalSubmitCount ?? null;
    target.surfaceDrawRenderBridgeVertexTemperatureReady = Boolean(
      bridge.drawState?.vertexTemperatureBuffer
      && (bridge.drawState?.vertexTemperatureRowCount ?? 0) > 0
    );
    target.surfaceDrawRenderBridgeVertexTemperatureByteLength =
      bridge.externalGpuBufferVertexTemperatureByteLength ?? 0;
    target.surfaceDrawRenderBridgeVertexTemperatureRowCount =
      bridge.externalGpuBufferVertexTemperatureRowCount ?? 0;
    target.surfaceDrawRenderBridgeVertexTemperatureEncoding =
      bridge.externalGpuBufferVertexTemperatureEncoding ?? null;
    target.surfaceDrawRenderBridgeVertexTemperatureSurfaceGenerationId =
      bridge.externalGpuBufferVertexTemperatureSurfaceGenerationId ?? null;
    target.surfaceDrawRenderBridgeVertexTemperatureVolumeGenerationId =
      bridge.externalGpuBufferVertexTemperatureVolumeGenerationId ?? null;
    target.surfaceDrawRenderBridgeVertexTemperatureAdditionalSubmitCount =
      bridge.externalGpuBufferVertexTemperatureAdditionalSubmitCount ?? null;
    target.surfaceDrawRenderBridgeVertexTemperatureAdditionalReadyCount = (
      bridge.drawState?.additionalSurfaceDraws || []
    ).filter((draw) => draw?.temperatureBuffer && (draw?.temperatureRowCount ?? 0) > 0).length;
    target.surfaceDrawRenderBridgeRefractionTargetLifecycleStatus =
      bridge.refractionTargetLifecycleStatus ?? null;
    target.surfaceDrawRenderBridgeRefractionTargetLifecycleReason =
      bridge.refractionTargetLifecycleReason ?? null;
    target.surfaceDrawRenderBridgeRefractionTargetGeneration = bridge.refractionTargetSet?.generation
      ?? bridge.refractionTargetGeneration
      ?? null;
    target.surfaceDrawRenderBridgeRefractionTargetWidth = bridge.refractionTargetSet?.width
      ?? bridge.refractionCopyWidth
      ?? 0;
    target.surfaceDrawRenderBridgeRefractionTargetHeight = bridge.refractionTargetSet?.height
      ?? bridge.refractionCopyHeight
      ?? 0;
    target.surfaceDrawRenderBridgeRefractionTargetColorFormat = bridge.refractionTargetSet?.colorFormat
      ?? bridge.refractionCopyFormat
      ?? null;
    target.surfaceDrawRenderBridgeRefractionTargetDepthFormat = bridge.refractionTargetSet?.depthFormat
      ?? bridge.refractionBackfaceDepthFormat
      ?? null;
    target.surfaceDrawRenderBridgeRefractionTargetRetirementPendingCount =
      bridge.refractionTargetRetirementPendingCount ?? 0;
    target.surfaceDrawRenderBridgeRefractionTargetRetirementCount =
      bridge.refractionTargetRetirementCount ?? 0;
    target.surfaceDrawRenderBridgeRefractionBackfaceStatus = bridge.refractionBackfaceStatus ?? null;
    target.surfaceDrawRenderBridgeRefractionBackfaceCacheHit =
      bridge.lastRefractionBackfaceCacheHit ?? null;
    target.surfaceDrawRenderBridgeRefractionBackfacePassDrawCount =
      bridge.lastRefractionBackfacePassDrawCount ?? 0;
    target.surfaceDrawRenderBridgeRefractionBackfaceAdditionalSubmitCount =
      bridge.refractionBackfaceAdditionalSubmitCount ?? null;
    target.surfaceDrawRenderBridgeBackgroundImageGpuStatus = bridge.backgroundImageGpuStatus ?? null;
    target.surfaceDrawRenderBridgeBackgroundImageDrawCount = bridge.backgroundImageDrawCount ?? 0;
  target.surfaceDrawRenderBridgeNativeSurfaceCandidateStageSubmissionCount =
    bridge.nativeSurfaceCandidateStageSubmissionCount ?? 0;
  target.surfaceDrawRenderBridgeNativeSurfaceCandidateStageSubmittedAtMs =
    bridge.nativeSurfaceCandidateStageSubmittedAtMs ?? null;
  target.surfaceDrawRenderBridgeNativeSurfaceCandidatePresentationCopyCount =
    bridge.nativeSurfaceCandidatePresentationCopyCount ?? 0;
  target.surfaceDrawRenderBridgeNativeSurfaceCandidatePresentationPostAdmissionGeometrySubmitCount =
    bridge.nativeSurfaceCandidatePresentationPostAdmissionGeometrySubmitCount ?? null;
  target.surfaceDrawRenderBridgeNativeSurfaceCandidateStagedPresentationStatus =
    bridge.nativeSurfaceCandidateStagedPresentationStatus ?? null;
  target.surfaceDrawRenderBridgeNativeSurfaceCandidateStagedPresentationReason =
    bridge.nativeSurfaceCandidateStagedPresentationReason ?? null;
  target.surfaceDrawRenderBridgeCandidateForegroundValidationStatus =
    bridge.nativeSurfaceCandidateForegroundValidationStatus ?? null;
  target.surfaceDrawRenderBridgeCandidateForegroundValidationReason =
    bridge.nativeSurfaceCandidateForegroundValidationReason ?? null;
  target.surfaceDrawRenderBridgeCandidateForegroundProofKind =
    bridge.nativeSurfaceCandidateForegroundProofKind ?? null;
  target.surfaceDrawRenderBridgeCandidateForegroundGpuFenceSatisfied =
    bridge.nativeSurfaceCandidateForegroundGpuFenceSatisfied ?? null;
  target.surfaceDrawRenderBridgeCandidateForegroundSameQueueSubmissionBoundary =
    bridge.nativeSurfaceCandidateForegroundSameQueueSubmissionBoundary ?? null;
  target.surfaceDrawRenderBridgeCandidateForegroundSubmittedDrawCount =
    bridge.nativeSurfaceCandidateForegroundSubmittedDrawCount ?? null;
  target.surfaceDrawRenderBridgeCandidateForegroundResourceGeneration =
    bridge.nativeSurfaceCandidateForegroundResourceGeneration ?? null;
  target.surfaceDrawRenderBridgeNativeSurfaceCandidateStagedPresentationChangedPixelCount =
    bridge.nativeSurfaceCandidateStagedPresentation?.changedPixelCount ?? null;
  target.surfaceDrawRenderBridgeNativeSurfaceCandidateStagedPresentationGeneration =
    bridge.nativeSurfaceCandidateStagedPresentation?.candidateGeneration ?? null;
  target.surfaceDrawRenderBridgeNativeSurfaceCandidateStagedPresentationTiming =
    bridge.nativeSurfaceCandidateStagedPresentationTiming ?? null;
  target.surfaceDrawRenderBridgeSchroederRenderProxyLocalResolverStatus =
    bridge.schroederRenderProxyLocalResolverStatus
    ?? bridge.schroederRenderProxyLocalRetainedBufferResolver?.status
    ?? null;
  target.surfaceDrawRenderBridgeSchroederRenderProxyLocalResolverRetainedBufferRefCount =
    bridge.schroederRenderProxyLocalResolverRetainedBufferRefCount
    ?? bridge.schroederRenderProxyLocalRetainedBufferResolver?.retainedBufferRefCount
    ?? 0;
  target.surfaceDrawRenderBridgeSchroederRenderProxyNativeExecutorStatus =
    bridge.schroederRenderProxyNativeExecutorStatus
    ?? bridge.schroederRenderProxyNativeExecutor?.status
    ?? null;
  target.surfaceDrawRenderBridgeSchroederRenderProxyNativeExecutorReady =
    Boolean(
      bridge.schroederRenderProxyNativeExecutorReady
      ?? bridge.schroederRenderProxyNativeExecutor?.ready
    );
  target.surfaceDrawRenderBridgeSchroederRenderProxyNativeExecutorDrawCommandCount =
    bridge.schroederRenderProxyNativeExecutorDrawCommandCount
    ?? bridge.schroederRenderProxyNativeExecutor?.drawCommands?.length
    ?? 0;
  target.surfaceDrawRenderBridgeSchroederRenderProxyNativeExecutorDrawInstanceCount =
    bridge.schroederRenderProxyNativeExecutorDrawInstanceCount ?? 0;
  target.surfaceDrawRenderBridgeSchroederRenderProxyNativeCameraUpdateStatus =
    bridge.schroederRenderProxyNativeCameraUpdateStatus ?? null;
  target.surfaceDrawRenderBridgeSchroederRenderProxyNativeLastSubmitStatus =
    bridge.lastSchroederRenderProxyNativeSubmitStatus ?? null;
  target.surfaceDrawRenderBridgeSchroederRenderProxyNativeLastSubmitDrawCommandCount =
    bridge.lastSchroederRenderProxyNativeDrawCommandCount ?? 0;
  target.surfaceDrawRenderBridgeSchroederRenderProxyNativeLastSubmitDrawInstanceCount =
    bridge.lastSchroederRenderProxyNativeDrawInstanceCount ?? 0;
    target.surfaceDrawRenderBridgeNativeSurfaceDebugMode = bridge.lastNativeSurfaceDebugMode
      || bridge.nativeSurfaceDebugMode
      || 'none';
    target.surfaceDrawRenderBridgeNativeSurfaceDebugStatus =
      bridge.lastNativeSurfaceDebugStatus ?? null;
    target.surfaceDrawRenderBridgeNativeSurfaceDebugSkippedDrawCount =
      bridge.lastNativeSurfaceDebugSkippedDrawCount ?? null;
    target.surfaceDrawRenderBridgeNativeSurfaceDebugClearValue =
      bridge.lastNativeSurfaceDebugClearValue ?? null;
    target.surfaceDrawRenderBridgeNativeSurfaceDeferredResourceReleaseStatus =
      bridge.nativeSurfaceDeferredResourceReleaseStatus ?? null;
    target.surfaceDrawRenderBridgeNativeSurfaceDeferredResourceReleaseReason =
      bridge.nativeSurfaceDeferredResourceReleaseReason ?? null;
    target.surfaceDrawRenderBridgeNativeSurfaceDeferredResourceReleasePending =
      bridge.nativeSurfaceDeferredResourceReleasePending ?? 0;
  target.surfaceDrawRenderBridgeExternalGpuBufferByteLength = bridge.externalGpuBufferByteLength ?? 0;
  target.surfaceDrawRenderBridgeExternalGpuBufferInputLayout = bridge.externalGpuBufferInputLayout ?? null;
  target.surfaceDrawRenderBridgeExternalGpuBufferVertexRowStrideFloats =
    bridge.externalGpuBufferVertexRowStrideFloats ?? 0;
  target.surfaceDrawRenderBridgeCompactPositionDirectInput = Boolean(bridge.compactPositionDirectInput);
  target.surfaceDrawRenderBridgeCompactPositionDirectInputByteLength =
    bridge.compactPositionDirectInputByteLength ?? 0;
  target.surfaceDrawRenderBridgeCompactPositionDirectInputVertexCount =
    bridge.compactPositionDirectInputVertexCount ?? 0;
    return target;
  }

export function makeSurfaceMaterial(descriptorOrKey, properties = null, opticsOverride = null) {
  const Three = activeThreeNamespace || THREE;
  const descriptor = renderDescriptorOf(descriptorOrKey);
  // Transmission / IOR / attenuation come from the optical closure (refractive index + Beer–Lambert
  // extinction): clear media transmit according to optical depth; conductors become opaque from
  // Drude skin depth; missing optical closures block rather than falling back to fake opacity.
  const optics = opticsOverride || opticalRenderParams(opticalQueryForDescriptor(descriptor, properties));
  const usesTransmission = optics.transmission > 0.01;
  const renderAlpha = renderAlphaFromOpticalResponse(optics, descriptor);
  const transparent = usesTransmission || renderAlpha < 0.999;
  const baseColor = optics.baseColorSrgb ?? optics.pbr?.baseColorSrgb ?? [1, 1, 1];
  const baseColorLinear = optics.baseColorLinear || null;
  const materialColor = new Three.Color();
  if (baseColorLinear) {
    materialColor.setRGB(baseColorLinear[0], baseColorLinear[1], baseColorLinear[2], Three.LinearSRGBColorSpace);
  } else {
    materialColor.setRGB(baseColor[0], baseColor[1], baseColor[2], Three.SRGBColorSpace);
  }
  const material = new Three.MeshPhysicalMaterial({
    color: materialColor,
    vertexColors: optics.vertexColorPolicy === 'particle-diagnostic' || Math.round(optics.vertexColorPolicyId || 0) === 2,
    side: Three.DoubleSide,
    clearcoat: optics.metalness > 0.5 ? 0.18 : 0.05,
    metalness: optics.metalness,
    roughness: optics.roughness,
    ior: optics.ior ?? 1.5,
    transmission: optics.transmission,
    thickness: usesTransmission ? 0.6 : 0,
    envMapIntensity: optics.metalness > 0.5 ? 1.3 : 0.85,
    transparent,
    depthWrite: renderDepthWriteFromOpticalResponse(optics, descriptor),
    opacity: renderAlpha
  });
  material.userData.renderLayer = renderLayerFromOpticalResponse(optics, descriptor);
  material.userData.renderOrder = renderOrderFromOpticalResponse(optics, descriptor);
  const attenuationColor = optics.attenuationLinear || optics.attenuationColor || null;
  if (attenuationColor) {
    material.attenuationColor = new Three.Color();
    if (optics.attenuationLinear) {
      material.attenuationColor.setRGB(
        attenuationColor[0],
        attenuationColor[1],
        attenuationColor[2],
        Three.LinearSRGBColorSpace
      );
    } else {
      material.attenuationColor.setRGB(
        attenuationColor[0],
        attenuationColor[1],
        attenuationColor[2],
        Three.SRGBColorSpace
      );
    }
    material.attenuationDistance = Math.max(0.05, optics.attenuationDistanceM);
  }
  material.userData.optical = optics;
  material.userData.opticalRenderAlpha = renderAlpha;
  material.userData.renderDescriptor = descriptor;
  return material;
}

const RENDER_ROW_SPHERE_BRIDGE_MIN_TRANSMISSIVE_OPACITY = 0.66;
// Gas parcels are physically near-invisible (Rayleigh optical depth ~1e-6 at
// particle scale), but the sphere bridge is an explicit particle diagnostic
// view, so gas keeps its closure-derived color at a ghost-visibility floor.
const RENDER_ROW_SPHERE_BRIDGE_GAS_DISPLAY_MIN_OPACITY = 0.18;
const RENDER_ROW_SPHERE_BRIDGE_METALLIC_VISIBILITY_MIN_METALNESS = 0.72;
const RENDER_ROW_SPHERE_BRIDGE_METALLIC_VISIBILITY_LOW_LUMINANCE = 0.08;
const RENDER_ROW_SPHERE_BRIDGE_METALLIC_VISIBILITY_PROXY_MIN_IOR = 1.0;
const RENDER_ROW_SPHERE_BRIDGE_METALLIC_DISPLAY_MAX_METALNESS = 1.0;
const RENDER_ROW_SPHERE_BRIDGE_METALLIC_DISPLAY_MIN_ROUGHNESS = 0.5;
const RENDER_ROW_SPHERE_BRIDGE_METALLIC_DISPLAY_MIN_ENVMAP_INTENSITY = 1.8;
const RENDER_ROW_SPHERE_BRIDGE_METALLIC_DISPLAY_EMISSIVE_FILL = 0.04;
const SURFACE_MESH_MOBILE_TRANSMISSIVE_OPACITY = 0.78;

function srgbLuminance(color = []) {
  const r = Number(color[0]);
  const g = Number(color[1]);
  const b = Number(color[2]);
  if (![r, g, b].every(Number.isFinite)) return 0;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function threeColorLuminance(color = null) {
  const r = Number(color?.r);
  const g = Number(color?.g);
  const b = Number(color?.b);
  if (![r, g, b].every(Number.isFinite)) return 0;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function finiteMaterialDiagnosticNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function colorDiagnosticTriplet(color = null) {
  const r = finiteMaterialDiagnosticNumber(color?.r);
  const g = finiteMaterialDiagnosticNumber(color?.g);
  const b = finiteMaterialDiagnosticNumber(color?.b);
  return r == null || g == null || b == null ? null : [r, g, b];
}

function opticalBaseColorSrgbDiagnostic(optics = {}) {
  const color = optics.baseColorSrgb ?? optics.pbr?.baseColorSrgb ?? null;
  if (!Array.isArray(color) || color.length < 3) return null;
  const r = finiteMaterialDiagnosticNumber(color[0]);
  const g = finiteMaterialDiagnosticNumber(color[1]);
  const b = finiteMaterialDiagnosticNumber(color[2]);
  return r == null || g == null || b == null ? null : [r, g, b];
}

function fallbackBridgeColorSrgbForDescriptor(descriptor = {}) {
  const material = String(descriptor.material || descriptor.renderKey || '').toLowerCase();
  if (material === 'h2o' || material === 'water' || descriptor.renderKey === 'ice') return [0.44, 0.76, 0.91];
  if (material === 'fe' || material === 'iron') return [0.66, 0.62, 0.56];
  if (material === 'pd' || material === 'palladium') return [0.72, 0.7, 0.66];
  if (material === 'cs' || material === 'cesium') return [0.78, 0.68, 0.44];
  if (material === 'na' || material === 'sodium') return [0.72, 0.70, 0.62];
  if (material === 'csoh' || material === 'naoh') return [0.72, 0.82, 0.9];
  if (material === 'air') return [0.72, 0.86, 1.0];
  return [0.8, 0.82, 0.86];
}

export function averageRenderRowColorSrgb(colorsRgb, indices = [], descriptor = {}) {
  if (!(colorsRgb instanceof Float32Array) || !Array.isArray(indices) || indices.length === 0) {
    return fallbackBridgeColorSrgbForDescriptor(descriptor);
  }
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (const index of indices) {
    const offset = Math.max(0, Math.round(Number(index) || 0)) * 3;
    const cr = colorsRgb[offset];
    const cg = colorsRgb[offset + 1];
    const cb = colorsRgb[offset + 2];
    if (![cr, cg, cb].every(Number.isFinite)) continue;
    r += clamp(cr, 0, 1);
    g += clamp(cg, 0, 1);
    b += clamp(cb, 0, 1);
    count += 1;
  }
  const color = count > 0
    ? [r / count, g / count, b / count]
    : fallbackBridgeColorSrgbForDescriptor(descriptor);
  return srgbLuminance(color) > 0.025 ? color : fallbackBridgeColorSrgbForDescriptor(descriptor);
}

export function createThreeWebGpuResidentBridgeMaterialProxy(material, {
  descriptor = null,
  fallbackColorSrgb = null,
  bridgeMode = null,
  proxyReason = 'three-webgpu-resident-bridge-basic-material-pipeline-proxy'
} = {}) {
  if (!material) return material;
  const Three = activeThreeNamespace || THREE;
  const MaterialCtor = Three.MeshBasicMaterial;
  if (typeof MaterialCtor !== 'function') return material;
  const fallbackColor = Array.isArray(fallbackColorSrgb)
    ? fallbackColorSrgb
    : fallbackBridgeColorSrgbForDescriptor(descriptor || material.userData?.renderDescriptor || {});
  const fallbackColorObject = new Three.Color().setRGB(
    clamp(fallbackColor[0], 0, 1),
    clamp(fallbackColor[1], 0, 1),
    clamp(fallbackColor[2], 0, 1),
    Three.SRGBColorSpace
  );
  const sourceColor = material.color?.clone?.() || null;
  const sourceLuminance = threeColorLuminance(sourceColor);
  const fallbackLuminance = srgbLuminance(fallbackColor);
  const useFallbackColor = !sourceColor || (
    sourceLuminance <= 0.025
    && fallbackLuminance > sourceLuminance + 0.025
  );
  const color = useFallbackColor ? fallbackColorObject : sourceColor;
  const opacity = Number.isFinite(Number(material.opacity)) ? Number(material.opacity) : 1;
  const renderRowSphereProxy = bridgeMode === SPH_THREE_RENDER_ROW_SPHERES_BRIDGE_MODE
    || String(proxyReason || '').includes('render-row-spheres');
  const proxy = new MaterialCtor({
    color,
    side: Three.DoubleSide,
    transparent: Boolean(material.transparent) || opacity < 0.999,
    opacity,
    depthWrite: material.depthWrite !== false,
    depthTest: material.depthTest !== false
  });
  proxy.name = `${material.name || material.type || 'surface'}-three-webgpu-resident-bridge-proxy`;
  proxy.userData = {
    ...(material.userData || {}),
    surfaceMaterialRendererProxy: true,
    surfaceMaterialRendererProxyReason: proxyReason,
    surfaceMaterialRendererBridgeMode: bridgeMode || material.userData?.surfaceMaterialRendererBridgeMode || null,
    surfaceMaterialOriginalType: material.type || null,
    surfaceMaterialFallbackColor: [...fallbackColor],
    surfaceMaterialProxyColorSource: useFallbackColor
      ? 'closure-derived-fallback-color'
      : 'source-material-color',
    ...(renderRowSphereProxy
      ? {
          renderRowSphereMaterialRendererProxy: true,
          renderRowSphereMaterialRendererProxyReason: proxyReason,
          renderRowSphereMaterialRendererProxyColorSource: useFallbackColor
            ? 'closure-derived-fallback-color'
            : 'source-material-color',
          renderRowSpherePbrMaterialSource: 'closure-derived-pbr-proxied-for-renderer',
          renderRowSphereClosurePbr: true
        }
      : {})
  };
  return proxy;
}

export function stabilizeSurfaceMeshMaterialForRenderer(material, {
  descriptor = null,
  fallbackColorSrgb = null,
  rendererMaterialPolicy = null,
  bridgeMode = null,
  minTransmissiveOpacity = SURFACE_MESH_MOBILE_TRANSMISSIVE_OPACITY
} = {}) {
  if (!material) return material;
  const policy = rendererMaterialPolicy || resolveSphSurfaceRendererMaterialPolicy();
  material.userData.surfaceMaterialRendererPolicy = policy.status;
  material.userData.surfaceMaterialRendererPolicyReason = policy.reason || null;
  material.userData.surfaceMaterialRendererPolicySignature = policy.signature || null;
  material.userData.surfaceMaterialRendererBridgeMode = bridgeMode || null;
  const optics = material.userData?.optical || {};
  const transmission = Number(material.transmission ?? optics.transmission ?? 0);
  const threeWebGpuExternalBufferProxyRequired = Boolean(
    bridgeMode === SPH_THREE_WEBGPU_SURFACE_BUFFER_BRIDGE_MODE
    && Number.isFinite(transmission)
    && transmission > 0.01
  );
  if (threeWebGpuExternalBufferProxyRequired) {
    const fallbackColor = Array.isArray(fallbackColorSrgb)
      ? fallbackColorSrgb
      : fallbackBridgeColorSrgbForDescriptor(descriptor || material.userData?.renderDescriptor || {});
    material.userData.surfaceMaterialOriginalTransmission = transmission;
    material.userData.surfaceMaterialOriginalThickness = Number(material.thickness ?? 0);
    material.userData.surfaceMaterialRendererProxy = true;
    material.userData.surfaceMaterialRendererProxyReason = 'three-webgpu-external-buffer-transmissive-surface-proxy';
    material.transmission = 0;
    material.thickness = 0;
    material.opacity = Math.max(
      Number.isFinite(Number(material.opacity)) ? Number(material.opacity) : 1,
      0.92
    );
    material.transparent = material.opacity < 0.999;
    material.depthWrite = material.opacity >= 0.999;
    if (material.color) {
      material.color.setRGB(
        clamp(fallbackColor[0], 0, 1),
        clamp(fallbackColor[1], 0, 1),
        clamp(fallbackColor[2], 0, 1),
        (activeThreeNamespace || THREE).SRGBColorSpace
      );
      material.userData.surfaceMaterialFallbackColor = [...fallbackColor];
    }
    material.needsUpdate = true;
    return material;
  }
  if (!(policy.transmissiveProxyRequired && Number.isFinite(transmission) && transmission > 0.01)) {
    return material;
  }

  const fallbackColor = Array.isArray(fallbackColorSrgb)
    ? fallbackColorSrgb
    : fallbackBridgeColorSrgbForDescriptor(descriptor || material.userData?.renderDescriptor || {});
  material.userData.surfaceMaterialOriginalTransmission = transmission;
  material.userData.surfaceMaterialRendererProxy = true;
  material.userData.surfaceMaterialRendererProxyReason = policy.rendererIsWebGPU
    ? 'three-webgpu-transmissive-surface-proxy'
    : 'mobile-webgl-transmissive-surface-proxy';
  material.transmission = 0;
  material.thickness = 0;
  material.opacity = Math.max(
    Number.isFinite(Number(material.opacity)) ? Number(material.opacity) : 1,
    minTransmissiveOpacity
  );
  material.transparent = material.opacity < 0.999;
  material.envMapIntensity = Math.max(Number(material.envMapIntensity) || 0, 0.9);
  if (Number.isFinite(Number(material.roughness))) {
    material.roughness = Math.max(Number(material.roughness), 0.18);
  }
  if (material.color) {
    material.color.setRGB(
      clamp(fallbackColor[0], 0, 1),
      clamp(fallbackColor[1], 0, 1),
      clamp(fallbackColor[2], 0, 1),
      (activeThreeNamespace || THREE).SRGBColorSpace
    );
    material.userData.surfaceMaterialFallbackColor = [...fallbackColor];
  }
  material.needsUpdate = true;
  return material;
}

export function createThreeWebGpuSurfaceBufferMaterialProxy(material, {
  descriptor = null,
  fallbackColorSrgb = null
} = {}) {
  if (!material) return material;
  const Three = activeThreeNamespace || THREE;
  if (typeof Three.MeshNormalMaterial === 'function') {
    const fallbackColor = Array.isArray(fallbackColorSrgb)
      ? fallbackColorSrgb
      : fallbackBridgeColorSrgbForDescriptor(descriptor || material.userData?.renderDescriptor || {});
    const proxy = new Three.MeshNormalMaterial({
      flatShading: true,
      side: Three.DoubleSide,
      transparent: false,
      opacity: 1,
      depthWrite: material.depthWrite !== false,
      depthTest: material.depthTest !== false
    });
    proxy.name = `${material.name || material.type || 'surface'}-three-webgpu-surface-buffer-normal-proxy`;
    proxy.userData = {
      ...(material.userData || {}),
      surfaceMaterialRendererProxy: true,
      surfaceMaterialRendererProxyReason: 'three-webgpu-external-buffer-normal-material-pipeline-proxy',
      surfaceMaterialRendererBridgeMode: SPH_THREE_WEBGPU_SURFACE_BUFFER_BRIDGE_MODE,
      surfaceMaterialOriginalType: material.type || null,
      surfaceMaterialFallbackColor: [...fallbackColor]
    };
    return proxy;
  }
  return createThreeWebGpuResidentBridgeMaterialProxy(material, {
    descriptor,
    fallbackColorSrgb,
    bridgeMode: SPH_THREE_WEBGPU_SURFACE_BUFFER_BRIDGE_MODE,
    proxyReason: 'three-webgpu-external-buffer-basic-material-pipeline-proxy'
  });
}

// GGX importance-sampled prefilter for a latlong environment (split-sum
// convention, Karis N=V=R). Pure and CPU-side: takes the base level's
// display-encoded RGBA8 pixels, returns every mip level's pixels with mip L
// prefiltered at roughness L/(mipLevelCount-1). Filtering happens in linear
// light (decode 2.2 in, encode 1/2.2 out) to match env_latlong_sample's
// post-sample decode. Exported for unit tests.
export function buildGgxPrefilteredLatlongMips({
  pixels,
  width,
  height,
  mipLevelCount,
  sampleCount = 64
} = {}) {
  const baseW = Math.max(1, Math.round(Number(width) || 0));
  const baseH = Math.max(1, Math.round(Number(height) || 0));
  const mips = Math.max(1, Math.round(Number(mipLevelCount) || 1));
  const samples = Math.max(1, Math.round(Number(sampleCount) || 1));
  // Linear-light base for bilinear taps.
  const linear = new Float32Array(baseW * baseH * 3);
  for (let i = 0; i < baseW * baseH; i += 1) {
    linear[i * 3 + 0] = Math.pow((pixels[i * 4 + 0] || 0) / 255, 2.2);
    linear[i * 3 + 1] = Math.pow((pixels[i * 4 + 1] || 0) / 255, 2.2);
    linear[i * 3 + 2] = Math.pow((pixels[i * 4 + 2] || 0) / 255, 2.2);
  }
  const sampleBase = (u, v, out) => {
    // Bilinear, wrap in u (azimuth), clamp in v (polar).
    const x = u * baseW - 0.5;
    const y = Math.min(Math.max(v * baseH - 0.5, 0), baseH - 1);
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const xa = ((x0 % baseW) + baseW) % baseW;
    const xb = (xa + 1) % baseW;
    const ya = Math.min(Math.max(y0, 0), baseH - 1);
    const yb = Math.min(ya + 1, baseH - 1);
    for (let c = 0; c < 3; c += 1) {
      const a = linear[(ya * baseW + xa) * 3 + c] * (1 - fx) + linear[(ya * baseW + xb) * 3 + c] * fx;
      const b = linear[(yb * baseW + xa) * 3 + c] * (1 - fx) + linear[(yb * baseW + xb) * 3 + c] * fx;
      out[c] = a * (1 - fy) + b * fy;
    }
  };
  const levels = [];
  let levelW = baseW;
  let levelH = baseH;
  const tap = [0, 0, 0];
  for (let level = 0; level < mips; level += 1) {
    const out = new Uint8ClampedArray(levelW * levelH * 4);
    if (level === 0) {
      // Roughness 0: the base image unchanged.
      for (let i = 0; i < levelW * levelH; i += 1) {
        out[i * 4 + 0] = pixels[i * 4 + 0];
        out[i * 4 + 1] = pixels[i * 4 + 1];
        out[i * 4 + 2] = pixels[i * 4 + 2];
        out[i * 4 + 3] = 255;
      }
    } else {
      const roughness = level / Math.max(1, mips - 1);
      const alpha = roughness * roughness;
      // Tangent-space GGX half-vectors from the Hammersley set — identical for
      // every texel at this roughness, so precompute once per level.
      const dirs = new Float32Array(samples * 3);
      for (let i = 0; i < samples; i += 1) {
        const e1 = (i + 0.5) / samples;
        // Radical inverse base 2.
        let bits = i;
        bits = ((bits << 16) | (bits >>> 16)) >>> 0;
        bits = (((bits & 0x55555555) << 1) | ((bits & 0xaaaaaaaa) >>> 1)) >>> 0;
        bits = (((bits & 0x33333333) << 2) | ((bits & 0xcccccccc) >>> 2)) >>> 0;
        bits = (((bits & 0x0f0f0f0f) << 4) | ((bits & 0xf0f0f0f0) >>> 4)) >>> 0;
        bits = (((bits & 0x00ff00ff) << 8) | ((bits & 0xff00ff00) >>> 8)) >>> 0;
        const e2 = bits * 2.3283064365386963e-10;
        const phi = 2 * Math.PI * e1;
        const cosTheta = Math.sqrt((1 - e2) / (1 + (alpha * alpha - 1) * e2));
        const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta));
        dirs[i * 3 + 0] = Math.cos(phi) * sinTheta;
        dirs[i * 3 + 1] = Math.sin(phi) * sinTheta;
        dirs[i * 3 + 2] = cosTheta;
      }
      for (let ty = 0; ty < levelH; ty += 1) {
        const vPolar = ((ty + 0.5) / levelH) * Math.PI;
        const ny = Math.cos(vPolar);
        const rh = Math.sin(vPolar);
        for (let tx = 0; tx < levelW; tx += 1) {
          const azim = (((tx + 0.5) / levelW) - 0.5) * 2 * Math.PI;
          // N = V = R for the split-sum prefilter.
          const nx = Math.cos(azim) * rh;
          const nz = Math.sin(azim) * rh;
          // Orthonormal basis around N.
          const upIsY = Math.abs(ny) < 0.999;
          let t0x = upIsY ? 0 : 1;
          let t0y = upIsY ? 1 : 0;
          const t0z = 0;
          let tx0 = t0y * nz - t0z * ny;
          let tx1 = t0z * nx - t0x * nz;
          let tx2 = t0x * ny - t0y * nx;
          const tlen = Math.hypot(tx0, tx1, tx2) || 1;
          tx0 /= tlen; tx1 /= tlen; tx2 /= tlen;
          const bx = ny * tx2 - nz * tx1;
          const by = nz * tx0 - nx * tx2;
          const bz = nx * tx1 - ny * tx0;
          let accR = 0;
          let accG = 0;
          let accB = 0;
          let accW = 0;
          for (let i = 0; i < samples; i += 1) {
            const hx = dirs[i * 3 + 0] * tx0 + dirs[i * 3 + 1] * bx + dirs[i * 3 + 2] * nx;
            const hy = dirs[i * 3 + 0] * tx1 + dirs[i * 3 + 1] * by + dirs[i * 3 + 2] * ny;
            const hz = dirs[i * 3 + 0] * tx2 + dirs[i * 3 + 1] * bz + dirs[i * 3 + 2] * nz;
            const ndoth = nx * hx + ny * hy + nz * hz;
            const lx = 2 * ndoth * hx - nx;
            const ly = 2 * ndoth * hy - ny;
            const lz = 2 * ndoth * hz - nz;
            const ndotl = nx * lx + ny * ly + nz * lz;
            if (ndotl <= 0) continue;
            const u = Math.atan2(lz, lx) * 0.15915494 + 0.5;
            const v = Math.acos(Math.min(Math.max(ly, -1), 1)) * 0.31830989;
            sampleBase(u, v, tap);
            accR += tap[0] * ndotl;
            accG += tap[1] * ndotl;
            accB += tap[2] * ndotl;
            accW += ndotl;
          }
          const w = accW > 0 ? 1 / accW : 0;
          const o = (ty * levelW + tx) * 4;
          out[o + 0] = Math.round(Math.pow(Math.min(Math.max(accR * w, 0), 1), 1 / 2.2) * 255);
          out[o + 1] = Math.round(Math.pow(Math.min(Math.max(accG * w, 0), 1), 1 / 2.2) * 255);
          out[o + 2] = Math.round(Math.pow(Math.min(Math.max(accB * w, 0), 1), 1 / 2.2) * 255);
          out[o + 3] = 255;
        }
      }
    }
    levels.push({ width: levelW, height: levelH, pixels: out });
    levelW = Math.max(1, levelW >> 1);
    levelH = Math.max(1, levelH >> 1);
  }
  return levels;
}


export function stabilizeRenderRowSphereBridgeMaterial(material, {
  descriptor = null,
  fallbackColorSrgb = null,
  minTransmissiveOpacity = RENDER_ROW_SPHERE_BRIDGE_MIN_TRANSMISSIVE_OPACITY
} = {}) {
  if (!material) return material;
  const optics = material.userData?.optical || {};
  // Prefer the material's own derived optics colour as the fallback tint;
  // the hand-tabulated per-material list is the last resort for materials
  // whose optical closure is blocked or missing entirely.
  const derivedOpticsColor = !optics.blocked
    && optics.vertexColorPolicy !== 'blocked'
    && Array.isArray(optics.baseColorSrgb)
    && srgbLuminance(optics.baseColorSrgb) > 0.05
    ? optics.baseColorSrgb
    : null;
  const fallbackColor = Array.isArray(fallbackColorSrgb)
    ? fallbackColorSrgb
    : (derivedOpticsColor
      || fallbackBridgeColorSrgbForDescriptor(descriptor || material.userData?.renderDescriptor || {}));
  let changed = false;

  if (material.vertexColors) {
    // Instanced sphere proxy geometry does not carry per-vertex colors; mobile
    // drivers can multiply PBR color by missing vertex-color attributes.
    material.vertexColors = false;
    changed = true;
  }

  const blockedOptics = Boolean(optics.blocked)
    || Math.round(Number(optics.vertexColorPolicyId) || 0) === 255
    || optics.vertexColorPolicy === 'blocked'
    || Number(optics.status) === 0;
  const transmission = Number(material.transmission ?? optics.transmission ?? 0);
  if (Number.isFinite(transmission) && transmission > 0.01) {
    material.userData.renderRowSphereOriginalTransmission = transmission;
    material.userData.renderRowSphereOriginalThickness = Number(material.thickness ?? 0);
    if (blockedOptics) {
      material.transmission = 0;
      material.thickness = 0;
      material.opacity = Math.max(
        Number.isFinite(Number(material.opacity)) ? Number(material.opacity) : 1,
        minTransmissiveOpacity
      );
      material.transparent = material.opacity < 0.999;
      material.userData.renderRowSphereTransmissionProxy = true;
    } else {
      material.transmission = transmission;
      material.thickness = Math.max(Number(material.thickness) || 0, Number(optics.thickness) || 0.06);
      material.transparent = true;
      material.userData.renderRowSphereTransmissionProxy = false;
      material.userData.renderRowSpherePreservedTransmission = true;
      if ('ior' in material && Number(optics.ior) > 1) {
        material.ior = Number(optics.ior);
      }
    }
    changed = true;
  }

  const materialColor = material.color;
  const currentLuminance = materialColor
    ? 0.2126 * materialColor.r + 0.7152 * materialColor.g + 0.0722 * materialColor.b
    : 0;
  const fallbackLuminance = srgbLuminance(fallbackColor);
  const descriptorPhase = String(descriptor?.phase ?? optics.phase ?? '').toLowerCase();
  const gasLikeTransmissiveMaterial = descriptorPhase === 'gas' || descriptorPhase === 'vapor';
  const needsTransmissiveProxyColor = Boolean(material.userData.renderRowSphereTransmissionProxy)
    && currentLuminance < 0.08
    && srgbLuminance(fallbackColor) > currentLuminance;
  const needsTransmissiveDisplayTint = Boolean(material.userData.renderRowSphereTransmissionProxy)
    && !gasLikeTransmissiveMaterial
    && fallbackLuminance > 0.04
    && fallbackLuminance < currentLuminance - 0.02
    && !blockedOptics;
  if (
    materialColor
    && (blockedOptics || currentLuminance <= 0.01 || needsTransmissiveProxyColor || needsTransmissiveDisplayTint)
  ) {
    materialColor.setRGB(
      clamp(fallbackColor[0], 0, 1),
      clamp(fallbackColor[1], 0, 1),
      clamp(fallbackColor[2], 0, 1),
      (activeThreeNamespace || THREE).SRGBColorSpace
    );
    material.opacity = Math.max(Number.isFinite(Number(material.opacity)) ? Number(material.opacity) : 1, 0.72);
    material.transparent = material.opacity < 0.999;
    material.userData.renderRowSphereFallbackColor = [...fallbackColor];
    material.userData.renderRowSphereFallbackReason = blockedOptics
      ? 'blocked-optical-material'
      : needsTransmissiveProxyColor
      ? 'transmissive-proxy-low-luminance'
      : needsTransmissiveDisplayTint
      ? 'transmissive-proxy-display-tint'
      : 'low-luminance-material';
    changed = true;
  }

  const currentOpacity = Number.isFinite(Number(material.opacity)) ? Number(material.opacity) : 1;
  if (gasLikeTransmissiveMaterial && currentOpacity < RENDER_ROW_SPHERE_BRIDGE_GAS_DISPLAY_MIN_OPACITY) {
    material.userData.renderRowSphereGasDisplayOpacityFloor = true;
    if (!Number.isFinite(Number(material.userData.renderRowSphereOriginalOpacity))) {
      material.userData.renderRowSphereOriginalOpacity = currentOpacity;
    }
    material.opacity = RENDER_ROW_SPHERE_BRIDGE_GAS_DISPLAY_MIN_OPACITY;
    material.transparent = true;
    material.userData.renderRowSphereFallbackReason =
      material.userData.renderRowSphereFallbackReason || 'gas-display-opacity-floor';
    changed = true;
  }

  const metalness = Number(material.metalness ?? optics.metalness ?? 0);
  const metallicVisibilityCandidate = Number.isFinite(metalness)
    && metalness >= RENDER_ROW_SPHERE_BRIDGE_METALLIC_VISIBILITY_MIN_METALNESS
    && fallbackLuminance > 0.04
    && !blockedOptics;
  if (metallicVisibilityCandidate) {
    material.userData.renderRowSphereMetallicVisibilityProxy = true;
    material.userData.renderRowSphereMetallicDisplayProxy = true;
    if (!Number.isFinite(Number(material.userData.renderRowSphereOriginalMetalness))) {
      material.userData.renderRowSphereOriginalMetalness = metalness;
    }
    if (!Number.isFinite(Number(material.userData.renderRowSphereOriginalRoughness))) {
      material.userData.renderRowSphereOriginalRoughness = Number(material.roughness ?? optics.roughness ?? 0);
    }
    if (!Number.isFinite(Number(material.userData.renderRowSphereOriginalEnvMapIntensity))) {
      material.userData.renderRowSphereOriginalEnvMapIntensity = Number(material.envMapIntensity ?? 0);
    }
    if (!Number.isFinite(Number(material.userData.renderRowSphereOriginalEmissiveIntensity))) {
      material.userData.renderRowSphereOriginalEmissiveIntensity = Number(material.emissiveIntensity ?? 0);
    }
    if (!Number.isFinite(Number(material.userData.renderRowSphereOriginalIor))) {
      material.userData.renderRowSphereOriginalIor = Number(material.ior ?? optics.ior ?? 0);
    }
    material.userData.renderRowSphereFallbackColor = [...fallbackColor];
    const needsMetallicFallbackColor = Boolean(
      materialColor
      && currentLuminance < RENDER_ROW_SPHERE_BRIDGE_METALLIC_VISIBILITY_LOW_LUMINANCE
      && fallbackLuminance > currentLuminance
    );
    material.userData.renderRowSphereFallbackReason = needsMetallicFallbackColor
      ? 'metallic-sphere-low-luminance-pbr-color'
      : 'metallic-sphere-renderer-safe-pbr';
    if (needsMetallicFallbackColor) {
      materialColor.setRGB(
        clamp(fallbackColor[0], 0, 1),
        clamp(fallbackColor[1], 0, 1),
        clamp(fallbackColor[2], 0, 1),
        (activeThreeNamespace || THREE).SRGBColorSpace
      );
    }
    if ('metalness' in material) {
      const nextMetalness = Number.isFinite(metalness) ? metalness : RENDER_ROW_SPHERE_BRIDGE_METALLIC_DISPLAY_MAX_METALNESS;
      material.metalness = Math.max(0, Math.min(RENDER_ROW_SPHERE_BRIDGE_METALLIC_DISPLAY_MAX_METALNESS, nextMetalness));
    }
    if ('roughness' in material) {
      const roughness = Number(material.roughness ?? optics.roughness ?? 0);
      material.roughness = Math.max(
        RENDER_ROW_SPHERE_BRIDGE_METALLIC_DISPLAY_MIN_ROUGHNESS,
        Math.min(1, Number.isFinite(roughness) ? roughness : RENDER_ROW_SPHERE_BRIDGE_METALLIC_DISPLAY_MIN_ROUGHNESS)
      );
    }
    material.envMapIntensity = Math.max(
      Number(material.envMapIntensity) || 0,
      RENDER_ROW_SPHERE_BRIDGE_METALLIC_DISPLAY_MIN_ENVMAP_INTENSITY
    );
    if ('ior' in material) {
      material.ior = Math.max(
        Number(material.ior) || 0,
        RENDER_ROW_SPHERE_BRIDGE_METALLIC_VISIBILITY_PROXY_MIN_IOR
      );
    }
    if (material.emissive) {
      material.emissive.setRGB(
        clamp(fallbackColor[0] * RENDER_ROW_SPHERE_BRIDGE_METALLIC_DISPLAY_EMISSIVE_FILL, 0, 1),
        clamp(fallbackColor[1] * RENDER_ROW_SPHERE_BRIDGE_METALLIC_DISPLAY_EMISSIVE_FILL, 0, 1),
        clamp(fallbackColor[2] * RENDER_ROW_SPHERE_BRIDGE_METALLIC_DISPLAY_EMISSIVE_FILL, 0, 1),
        (activeThreeNamespace || THREE).SRGBColorSpace
      );
      material.emissiveIntensity = Math.max(Number(material.emissiveIntensity) || 0, 1);
      material.userData.renderRowSphereMetallicDisplayEmissiveFill =
        RENDER_ROW_SPHERE_BRIDGE_METALLIC_DISPLAY_EMISSIVE_FILL;
    }
    material.opacity = Math.max(Number.isFinite(Number(material.opacity)) ? Number(material.opacity) : 1, 0.84);
    material.transparent = material.opacity < 0.999;
    changed = true;
  }

  if (changed) material.needsUpdate = true;
  return material;
}

export function summarizeRenderRowSphereBridgeMaterial(mesh = null, materialOverride = null) {
  const material = materialOverride || (Array.isArray(mesh?.material) ? mesh.material[0] : mesh?.material) || null;
  if (!mesh || !material) return null;
  const userData = mesh.userData || {};
  const materialUserData = material.userData || {};
  const optics = materialUserData.optical || userData.optical || {};
  const fallbackColor = materialUserData.renderRowSphereFallbackColor
    || userData.renderRowSphereFallbackColor
    || null;
  return {
    surfaceKey: userData.surfaceKey ?? null,
    materialKey: userData.materialKey ?? optics.material ?? null,
    renderKey: userData.renderKey ?? optics.renderKey ?? null,
    phase: userData.phase ?? optics.phase ?? null,
    renderDomainId: userData.renderDomainId ?? null,
    renderDomainKey: userData.renderDomainKey ?? null,
    pointCount: finiteMaterialDiagnosticNumber(userData.pointCount ?? mesh.count),
    instanceCount: finiteMaterialDiagnosticNumber(mesh.count),
    materialType: material.type || null,
    materialName: material.name || null,
    colorLinear: colorDiagnosticTriplet(material.color),
    emissiveLinear: colorDiagnosticTriplet(material.emissive),
    colorLuminance: finiteMaterialDiagnosticNumber(threeColorLuminance(material.color)),
    emissiveLuminance: finiteMaterialDiagnosticNumber(threeColorLuminance(material.emissive)),
    opacity: finiteMaterialDiagnosticNumber(material.opacity),
    transparent: Boolean(material.transparent),
    depthWrite: material.depthWrite ?? null,
    depthTest: material.depthTest ?? null,
    metalness: finiteMaterialDiagnosticNumber(material.metalness),
    roughness: finiteMaterialDiagnosticNumber(material.roughness),
    transmission: finiteMaterialDiagnosticNumber(material.transmission),
    thickness: finiteMaterialDiagnosticNumber(material.thickness),
    ior: finiteMaterialDiagnosticNumber(material.ior),
    envMapIntensity: finiteMaterialDiagnosticNumber(material.envMapIntensity),
    emissiveIntensity: finiteMaterialDiagnosticNumber(material.emissiveIntensity),
    opticalBaseColorSrgb: opticalBaseColorSrgbDiagnostic(optics),
    opticalMetalness: finiteMaterialDiagnosticNumber(optics.metalness),
    opticalRoughness: finiteMaterialDiagnosticNumber(optics.roughness),
    opticalTransmission: finiteMaterialDiagnosticNumber(optics.transmission),
    opticalAlpha: finiteMaterialDiagnosticNumber(optics.alpha ?? optics.opacity),
    opticalStatus: finiteMaterialDiagnosticNumber(optics.status),
    opticalRecordIndex: finiteMaterialDiagnosticNumber(optics.recordIndex),
    opticalRenderModel: optics.renderModel ?? null,
    opticalSource: optics.source ?? optics.pbr?.source ?? null,
    renderRowSpherePbrMaterialSource: userData.renderRowSpherePbrMaterialSource
      ?? materialUserData.renderRowSpherePbrMaterialSource
      ?? null,
    renderRowSphereClosurePbr: Boolean(
      userData.renderRowSphereClosurePbr
      || materialUserData.renderRowSphereClosurePbr
    ),
    renderRowSphereTransmissionProxy: Boolean(
      userData.renderRowSphereTransmissionProxy
      || materialUserData.renderRowSphereTransmissionProxy
    ),
    renderRowSpherePreservedTransmission: Boolean(
      userData.renderRowSpherePreservedTransmission
      || materialUserData.renderRowSpherePreservedTransmission
    ),
    renderRowSphereFallbackColor: Array.isArray(fallbackColor) ? [...fallbackColor] : null,
    renderRowSphereFallbackReason: materialUserData.renderRowSphereFallbackReason
      || userData.renderRowSphereFallbackReason
      || null,
    renderRowSphereMetallicVisibilityProxy: Boolean(
      userData.renderRowSphereMetallicVisibilityProxy
      || materialUserData.renderRowSphereMetallicVisibilityProxy
    ),
    renderRowSphereMetallicDisplayProxy: Boolean(
      userData.renderRowSphereMetallicDisplayProxy
      || materialUserData.renderRowSphereMetallicDisplayProxy
    ),
    renderRowSphereOriginalMetalness: finiteMaterialDiagnosticNumber(
      materialUserData.renderRowSphereOriginalMetalness
    ),
    renderRowSphereOriginalRoughness: finiteMaterialDiagnosticNumber(
      materialUserData.renderRowSphereOriginalRoughness
    ),
    renderRowSphereOriginalIor: finiteMaterialDiagnosticNumber(
      materialUserData.renderRowSphereOriginalIor
    ),
    surfaceMaterialRendererProxy: Boolean(
      userData.surfaceMaterialRendererProxy
      || materialUserData.surfaceMaterialRendererProxy
    ),
    surfaceMaterialRendererProxyReason: materialUserData.surfaceMaterialRendererProxyReason
      || userData.surfaceMaterialRendererProxyReason
      || null
  };
}

export function applySurfaceRenderOrdering(mesh, optics = {}, descriptorOrRow = {}) {
  const layer = renderLayerFromOpticalResponse(optics, descriptorOrRow);
  const order = renderOrderFromOpticalResponse(optics, descriptorOrRow);
  const depthWrite = renderDepthWriteFromOpticalResponse(optics, descriptorOrRow);
  const objectOrder = surfaceObjectRenderOrder(order, surfaceRenderOrderKey(descriptorOrRow), {
    renderLayer: layer,
    depthWrite
  });
  mesh.renderOrder = objectOrder;
  mesh.userData.renderLayer = layer;
  mesh.userData.renderOrderBase = order;
  mesh.userData.renderOrderPolicy = depthWrite
    ? 'stable-opaque-layer-order'
    : 'three-transparent-depth-sort-within-layer';
  if (mesh.material) {
    mesh.material.depthWrite = depthWrite;
    mesh.material.userData.renderLayer = layer;
    mesh.material.userData.renderOrder = objectOrder;
    mesh.material.userData.renderOrderBase = order;
    mesh.material.userData.renderOrderPolicy = mesh.userData.renderOrderPolicy;
  }
  return { layer, order: objectOrder, baseOrder: order, depthWrite };
}

export function emptyBounds() {
  return {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity]
  };
}

function expandBounds(bounds, x, y, z) {
  bounds.min[0] = Math.min(bounds.min[0], x);
  bounds.min[1] = Math.min(bounds.min[1], y);
  bounds.min[2] = Math.min(bounds.min[2], z);
  bounds.max[0] = Math.max(bounds.max[0], x);
  bounds.max[1] = Math.max(bounds.max[1], y);
  bounds.max[2] = Math.max(bounds.max[2], z);
}

// Beer-Lambert absorption is a path integral, so a fixed renderer-wide path
// length makes the same gas arbitrarily more or less visible as body size
// changes. For a body with finite particle bounds, use Cauchy's mean chord
// length for its radius-expanded rectangular envelope: 4V/S. This is a
// geometry-derived representative line-of-sight distance, not a display
// opacity floor. A one-particle body falls back to the sphere mean chord
// (4r/3); only geometry-free metadata uses the historical table default.
export function opticalPathLengthMForSurfaceBatch(
  batch = {},
  { fallbackPathLengthM = SPH_DEFAULT_OPTICAL_PATH_LENGTH_M } = {}
) {
  const explicitPathLengthM = Number(batch?.opticalPathLengthM);
  if (Number.isFinite(explicitPathLengthM) && explicitPathLengthM > 0) {
    return explicitPathLengthM;
  }
  const representativeParticleRadiusM = Number(batch?.representativeParticleRadiusM);
  const surfaceRadiusM = Number(batch?.surfaceRadiusM);
  const envelopeRadiusM = Number.isFinite(representativeParticleRadiusM)
    && representativeParticleRadiusM > 0
    ? representativeParticleRadiusM
    : (Number.isFinite(surfaceRadiusM) && surfaceRadiusM > 0 ? surfaceRadiusM : 0);
  const min = batch?.bounds?.min;
  const max = batch?.bounds?.max;
  if (Array.isArray(min) && Array.isArray(max) && min.length >= 3 && max.length >= 3) {
    const spansM = [0, 1, 2].map((axis) => {
      const lower = Number(min[axis]);
      const upper = Number(max[axis]);
      if (!Number.isFinite(lower) || !Number.isFinite(upper) || upper < lower) return null;
      return Math.max(0, upper - lower) + 2 * envelopeRadiusM;
    });
    if (spansM.every((span) => Number.isFinite(span) && span > 0)) {
      const [a, b, c] = spansM;
      const denominator = a * b + a * c + b * c;
      if (denominator > 0) return (2 * a * b * c) / denominator;
    }
  }
  if (envelopeRadiusM > 0) return (4 * envelopeRadiusM) / 3;
  const fallback = Number(fallbackPathLengthM);
  return Number.isFinite(fallback) && fallback > 0
    ? fallback
    : SPH_DEFAULT_OPTICAL_PATH_LENGTH_M;
}

function estimateSurfaceRadiusM(bounds, count, spacingHintM = 0.25) {
  const hint = Number.isFinite(spacingHintM) && spacingHintM > 0 ? spacingHintM : 0.25;
  if (count <= 1) return hint * 0.8;
  const spans = bounds.max.map((max, index) => Math.max(max - bounds.min[index], hint));
  const occupiedVolumeM3 = spans[0] * spans[1] * spans[2];
  const spacingM = Math.cbrt(occupiedVolumeM3 / Math.max(1, count));
  return clamp(spacingM * 1.65, hint * 0.35, hint * 1.6);
}

function estimateGlobalParticleSpacingM(positionsM, particleCount) {
  if (particleCount <= 1) return null;
  const bounds = emptyBounds();
  for (let i = 0; i < particleCount; i += 1) {
    expandBounds(bounds, positionsM[i * 3], positionsM[i * 3 + 1], positionsM[i * 3 + 2]);
  }
  const spans = bounds.max.map((max, index) => max - bounds.min[index]).filter((span) => span > 1e-9);
  if (!spans.length) return null;
  const occupiedVolumeM3 = spans.reduce((product, span) => product * span, 1);
  const dimensionalCount = Math.max(1, spans.length);
  const densityLength = dimensionalCount === 3
    ? Math.cbrt(occupiedVolumeM3 / particleCount)
    : Math.max(...spans) / Math.max(1, Math.cbrt(particleCount) - 1);
  return Number.isFinite(densityLength) && densityLength > 0 ? densityLength : null;
}

function estimateSurfaceRadiusFromParticleRadiiM(radii = []) {
  const finite = radii
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
  if (!finite.length) return null;
  const median = finite[Math.floor(finite.length / 2)];
  const mean = finite.reduce((sum, value) => sum + value, 0) / finite.length;
  return Math.max(median, mean);
}

export function createContinuousSurfaceBatches({
  positionsM,
  colorsRgb,
  materials = null,
  particleRadiiM = null,
  renderDomainCounts = null,
  boxEdgeM = 10,
  boxDimsM = null,
  smoothingLengthM = null,
  particleSpacingM = null
} = {}) {
  if (!positionsM || !colorsRgb) {
    throw new Error('positionsM and colorsRgb are required for SPH continuous surfaces');
  }
  if (positionsM.length !== colorsRgb.length || positionsM.length % 3 !== 0) {
    throw new Error('positionsM and colorsRgb must be matching vec3 arrays');
  }
  const dims = boxDimsM ?? [boxEdgeM, boxEdgeM, boxEdgeM];
  const refEdgeM = Math.max(dims[0], dims[1], dims[2]);
  const batches = new Map();
  const particleCount = positionsM.length / 3;
  const spacingHintM = (Number.isFinite(particleSpacingM) && particleSpacingM > 0)
    ? particleSpacingM
    : ((Number.isFinite(smoothingLengthM) && smoothingLengthM > 0)
      ? smoothingLengthM
      : (estimateGlobalParticleSpacingM(positionsM, particleCount) ?? 0.25));
  for (let i = 0; i < particleCount; i += 1) {
    const source = materials?.[i];
    // Spare product slots decode with a masked material id (0 -> 'unknown');
    // they carry no mass and must not become sphere instances or batches.
    if (source && typeof source === 'object' && source.material === 'unknown') continue;
    const descriptorBase = renderDescriptorOf(source);
    const sourceObject = source && typeof source === 'object' ? source : {};
    const explicitDomainId = normalizeRenderDomainId(
      sourceObject.renderDomainId ?? descriptorBase.renderDomainId
    );
    const fallbackDomainId = renderDomainIdForParticleIndexFromCounts(i, renderDomainCounts);
    const renderDomainId = explicitDomainId > 0 ? explicitDomainId : fallbackDomainId;
    const descriptor = renderDomainId > 0 && descriptorBase.renderDomainId !== renderDomainId
      ? renderDescriptorOf({
        ...descriptorBase,
        // descriptorBase's derived binding belongs to its domain-free key;
        // derive a new one after assigning the fallback cohort domain.
        opticalStateId: undefined,
        renderDomainId,
        renderDomainKey: sourceObject.renderDomainKey
          || descriptorBase.renderDomainKey
          || renderDomainKeyForId(renderDomainId)
      })
      : descriptorBase;
    let batch = batches.get(descriptor.surfaceKey);
    if (!batch) {
      batch = {
        surfaceKey: descriptor.surfaceKey,
        renderKey: descriptor.renderKey,
        material: descriptor.material,
        phase: descriptor.phase,
        opticalState: descriptor.opticalState,
        opticalStateKey: descriptor.opticalStateKey,
        renderDomainId: descriptor.renderDomainId,
        renderDomainKey: descriptor.renderDomainKey,
        descriptor,
        positionsM: [],
        normalizedPositions: [],
        colorsRgb: [],
        particleRadiiM: [],
        liquidContinuityRadiiM: [],
        bounds: emptyBounds(),
        count: 0
      };
      batches.set(descriptor.surfaceKey, batch);
    }
    const x = positionsM[i * 3];
    const y = positionsM[i * 3 + 1];
    const z = positionsM[i * 3 + 2];
    batch.positionsM.push(x, y, z);
    // Isotropic mapping: every axis is normalized by the SAME factor (the largest box edge), so a
    // metaball stays spherical in the field. A non-cubic box therefore occupies a sub-region of the
    // [0,1] field cube (the short axes don't fill it) rather than being stretched to fill it — which
    // would deform round blobs into ellipsoids. The mesh scale (below) is the matching scalar.
    const span = 1 - 2 * FIELD_PADDING;
    batch.normalizedPositions.push(
      clamp(FIELD_PADDING + (x / refEdgeM) * span, 0.001, 0.999),
      clamp(FIELD_PADDING + (y / refEdgeM) * span, 0.001, 0.999),
      clamp(FIELD_PADDING + (z / refEdgeM) * span, 0.001, 0.999)
    );
    batch.colorsRgb.push(
      clamp(colorsRgb[i * 3], 0, 1),
      clamp(colorsRgb[i * 3 + 1], 0, 1),
      clamp(colorsRgb[i * 3 + 2], 0, 1)
    );
    const particleRadiusM = Number(particleRadiiM?.[i]);
    if (Number.isFinite(particleRadiusM) && particleRadiusM > 0) {
      batch.particleRadiiM.push(particleRadiusM);
    }
    const initialSpacingM = Number(sourceObject.initialParticleSpacingM);
    if (
      descriptor.phase === 'liquid'
      && Number.isFinite(initialSpacingM)
      && initialSpacingM > 0
    ) {
      batch.liquidContinuityRadiiM.push(initialSpacingM * 0.5);
    }
    expandBounds(batch.bounds, x, y, z);
    batch.count += 1;
  }
  return [...batches.values()].map((batch) => {
    const representativeParticleRadiusM =
      estimateSurfaceRadiusFromParticleRadiiM(batch.particleRadiiM);
    return {
      ...batch,
      representativeParticleRadiusM,
      smoothingLengthM: Number.isFinite(smoothingLengthM) && smoothingLengthM > 0
        ? smoothingLengthM
        : null,
      // Particle radii lead; the bounds-based spacing estimate stays a
      // FALLBACK only - as a floor it overshoots badly for sparse batches
      // (a 2-particle pair 0.2 m apart estimated 1.8 m). The continuity
      // floor that fixes boundary flakes is the smoothing-length floor in
      // the render-row and seed producers, where the fluid's interpolation
      // scale is known.
      surfaceRadiusM: Math.max(
        representativeParticleRadiusM
          ?? estimateSurfaceRadiusM(batch.bounds, batch.count, spacingHintM),
        estimateSurfaceRadiusFromParticleRadiiM(batch.liquidContinuityRadiiM) ?? 0
      )
    };
  });
}

export function createResidentMaterialSeedSurfaceBatches({
  materials = [],
  positionsM = null,
  colorsRgb = null,
  particleRadiiM = null,
  renderDomainCounts = null,
  smoothingLengthM = null
} = {}) {
  if (!Array.isArray(materials) || materials.length === 0) return [];
  const batches = new Map();
  for (let index = 0; index < materials.length; index += 1) {
    const source = materials[index];
    if (!source) continue;
    const particleMassKg = Number(source.particleMassKg ?? source.massKg);
    // Retained product capacity rows clone a real particle descriptor but
    // carry zero authoritative mass until a GPU reaction claims them. They
    // must remain in particle buffers, yet must not seed a wildcard material
    // surface from their placeholder descriptor. A rigid body's reserved
    // meltwater rows are different: their material and phase are the real
    // future liquid, whose optics rows are already routed, so they seed its
    // surface (zero mass contributes nothing to the field until release).
    if (Number.isFinite(particleMassKg) && particleMassKg <= 0 && source.solidReleaseSlot !== true) continue;
    const explicitDomainId = normalizeRenderDomainId(source.renderDomainId);
    const renderDomainId = explicitDomainId > 0
      ? explicitDomainId
      : renderDomainIdForParticleIndexFromCounts(index, renderDomainCounts);
    const renderDomainKey = source.renderDomainKey || renderDomainKeyForId(renderDomainId);
    const descriptor = renderDescriptorOf({
      ...source,
      renderDomainId,
      renderDomainKey
    });
    let batch = batches.get(descriptor.surfaceKey);
    if (!batch) {
      batch = {
        surfaceKey: descriptor.surfaceKey,
        renderKey: descriptor.renderKey,
        material: descriptor.material,
        phase: descriptor.phase,
        opticalState: descriptor.opticalState,
        opticalStateKey: descriptor.opticalStateKey,
        renderDomainId: descriptor.renderDomainId,
        renderDomainKey: descriptor.renderDomainKey,
        descriptor,
        positionsM: [],
        normalizedPositions: [],
        colorsRgb: [],
        averageColorRgb: [0, 0, 0],
        particleRadiiM: [],
        bounds: emptyBounds(),
        count: 0,
        colorCount: 0,
        radiusSumM: 0,
        radiusCount: 0,
        source: 'resident-material-domain-seed'
      };
      batches.set(descriptor.surfaceKey, batch);
    }
    batch.count += 1;
    const positionOffset = index * 3;
    const position = [
      Number(positionsM?.[positionOffset]),
      Number(positionsM?.[positionOffset + 1]),
      Number(positionsM?.[positionOffset + 2])
    ];
    if (position.every(Number.isFinite)) {
      expandBounds(batch.bounds, position[0], position[1], position[2]);
    }
    const colorOffset = index * 3;
    const color = [
      Number(colorsRgb?.[colorOffset]),
      Number(colorsRgb?.[colorOffset + 1]),
      Number(colorsRgb?.[colorOffset + 2])
    ];
    if (color.every(Number.isFinite)) {
      batch.averageColorRgb[0] += clamp(color[0], 0, 1);
      batch.averageColorRgb[1] += clamp(color[1], 0, 1);
      batch.averageColorRgb[2] += clamp(color[2], 0, 1);
      batch.colorCount += 1;
    }
    const radiusM = Number(
      particleRadiiM?.[index]
        ?? source.currentParticleRadiusM
        ?? source.particleRadiusM
        ?? source.restParticleRadiusM
        ?? source.initialParticleSpacingM
    );
    if (Number.isFinite(radiusM) && radiusM > 0) {
      batch.particleRadiiM.push(radiusM);
      batch.radiusSumM += radiusM;
      batch.radiusCount += 1;
    }
  }
  return [...batches.values()].map((batch) => {
    const averageColorRgb = batch.colorCount > 0
      ? batch.averageColorRgb.map((value) => clamp(value / batch.colorCount, 0, 1))
      : [1, 1, 1];
    const representativeParticleRadiusM = batch.radiusCount > 0
      ? batch.radiusSumM / batch.radiusCount
      : null;
    return {
      ...batch,
      averageColorRgb,
      colorsRgb: averageColorRgb,
      representativeParticleRadiusM,
      smoothingLengthM: Number.isFinite(smoothingLengthM) && smoothingLengthM > 0
        ? smoothingLengthM
        : null,
      // Physical particle radii run ~half the spacing; a metaball union at
      // that scale ripples across the isovalue into boundary flakes. The
      // SPH smoothing length is the fluid's own interpolation support and
      // the physically-derived surface continuity floor.
      surfaceRadiusM: Math.max(
        representativeParticleRadiusM ?? 0,
        (Number.isFinite(smoothingLengthM) && smoothingLengthM > 0) ? smoothingLengthM : 0.25
      )
    };
  });
}

export function mergeSameMaterialPhaseSurfaceBatchesForRenderField(batches = [], options = {}) {
  if (!Array.isArray(batches) || batches.length === 0) return [];
  const phasePredicate = typeof options.phasePredicate === 'function' ? options.phasePredicate : null;
  const groupKeyForBatch = (batch) => {
    if (!batch?.material || !batch?.phase || !batch?.renderKey) return null;
    if (phasePredicate && !phasePredicate(batch.phase, batch)) return null;
    if (!(Math.max(0, Math.round(Number(batch.renderDomainId) || 0)) > 0)) return null;
    const positionCount = Math.floor(Math.max(
      Number(batch.positionsM?.length) || 0,
      Number(batch.normalizedPositions?.length) || 0
    ) / 3);
    const batchCount = Math.max(0, Math.round(Number(batch.count) || 0));
    if (positionCount <= 0 && batchCount <= 0) return null;
    return [
      batch.renderKey,
      batch.material,
      batch.phase,
      batch.opticalStateKey || stableOpticalStateKey(batch.opticalState || batch.descriptor?.opticalState || null)
    ].join('|');
  };
  const groups = new Map();
  for (const batch of batches) {
    const key = groupKeyForBatch(batch);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(batch);
  }
  const mergedByKey = new Map();
  for (const [key, group] of groups) {
    const domains = new Set(group.map((batch) => Math.max(0, Math.round(Number(batch.renderDomainId) || 0))));
    if (group.length <= 1 || domains.size <= 1) continue;
    const first = group[0];
    const descriptor = renderDescriptorOf({
      renderKey: first.renderKey,
      material: first.material,
      phase: first.phase,
      opticalState: first.opticalState || first.descriptor?.opticalState || null
    });
    const positionsM = [];
    const normalizedPositions = [];
    const colorsRgb = [];
    const bounds = emptyBounds();
    let count = 0;
    let surfaceRadiusM = 0;
    let representativeParticleRadiusWeightedSumM = 0;
    let representativeParticleRadiusWeight = 0;
    let opticalPathLengthWeightedSumM = 0;
    let opticalPathLengthWeight = 0;
    let smoothingLengthM = 0;
    for (const batch of group) {
      for (const value of batch.positionsM || []) positionsM.push(value);
      for (const value of batch.normalizedPositions || []) normalizedPositions.push(value);
      for (const value of batch.colorsRgb || []) colorsRgb.push(value);
      const batchCount = Math.max(0, Math.round(Number(batch.count) || 0));
      count += batchCount;
      const batchOpticalPathLengthM = opticalPathLengthMForSurfaceBatch(batch);
      if (Number.isFinite(batchOpticalPathLengthM) && batchOpticalPathLengthM > 0) {
        const weight = Math.max(1, batchCount);
        opticalPathLengthWeightedSumM += batchOpticalPathLengthM * weight;
        opticalPathLengthWeight += weight;
      }
      const representativeParticleRadiusM = Number(batch.representativeParticleRadiusM);
      if (Number.isFinite(representativeParticleRadiusM) && representativeParticleRadiusM > 0) {
        const weight = Math.max(1, batchCount);
        representativeParticleRadiusWeightedSumM += representativeParticleRadiusM * weight;
        representativeParticleRadiusWeight += weight;
      }
      if (Number.isFinite(batch.smoothingLengthM) && batch.smoothingLengthM > smoothingLengthM) {
        smoothingLengthM = batch.smoothingLengthM;
      }
      if (Number.isFinite(batch.surfaceRadiusM) && batch.surfaceRadiusM > surfaceRadiusM) {
        surfaceRadiusM = batch.surfaceRadiusM;
      }
      for (let index = 0; index + 2 < (batch.positionsM?.length || 0); index += 3) {
        expandBounds(bounds, batch.positionsM[index], batch.positionsM[index + 1], batch.positionsM[index + 2]);
      }
      const batchBoundsMin = batch?.bounds?.min;
      const batchBoundsMax = batch?.bounds?.max;
      if (
        Array.isArray(batchBoundsMin)
        && Array.isArray(batchBoundsMax)
        && batchBoundsMin.length >= 3
        && batchBoundsMax.length >= 3
        && batchBoundsMin.every(Number.isFinite)
        && batchBoundsMax.every(Number.isFinite)
      ) {
        expandBounds(bounds, batchBoundsMin[0], batchBoundsMin[1], batchBoundsMin[2]);
        expandBounds(bounds, batchBoundsMax[0], batchBoundsMax[1], batchBoundsMax[2]);
      }
    }
    mergedByKey.set(key, {
      surfaceKey: descriptor.surfaceKey,
      renderKey: descriptor.renderKey,
      material: descriptor.material,
      phase: descriptor.phase,
      opticalState: descriptor.opticalState,
      opticalStateKey: descriptor.opticalStateKey,
      renderDomainId: 0,
      renderDomainKey: null,
      descriptor,
      positionsM,
      normalizedPositions,
      colorsRgb,
      bounds,
      count,
      surfaceRadiusM: surfaceRadiusM > 0 ? surfaceRadiusM : estimateSurfaceRadiusM(bounds, count),
      opticalPathLengthM: opticalPathLengthWeight > 0
        ? opticalPathLengthWeightedSumM / opticalPathLengthWeight
        : null,
      opticalPathLengthSource: opticalPathLengthWeight > 0
        ? 'component-count-weighted-cauchy-mean-chord'
        : null,
      representativeParticleRadiusM: representativeParticleRadiusWeight > 0
        ? representativeParticleRadiusWeightedSumM / representativeParticleRadiusWeight
        : null,
      smoothingLengthM: smoothingLengthM > 0 ? smoothingLengthM : null,
      source: 'merged-same-material-phase-render-surface',
      mergedRenderDomains: group.map((batch) => ({
        renderDomainId: Math.max(0, Math.round(Number(batch.renderDomainId) || 0)),
        renderDomainKey: batch.renderDomainKey ?? batch.descriptor?.renderDomainKey ?? null,
        count: Math.max(0, Math.round(Number(batch.count) || 0)),
        surfaceKey: batch.surfaceKey
      }))
    });
  }
  const emittedGroups = new Set();
  const output = [];
  for (const batch of batches) {
    const key = groupKeyForBatch(batch);
    const merged = key ? mergedByKey.get(key) : null;
    if (merged) {
      if (!emittedGroups.has(key)) {
        output.push(merged);
        emittedGroups.add(key);
      }
      continue;
    }
    output.push(batch);
  }
  return output;
}

export function sameMaterialDomainMergeDiagnosticsFromBatches(batches = []) {
  const surfaces = (Array.isArray(batches) ? batches : [])
    .filter((batch) => (
      batch?.source === 'merged-same-material-phase-render-surface'
      && Array.isArray(batch.mergedRenderDomains)
      && batch.mergedRenderDomains.length > 1
    ))
    .map((batch) => ({
      surfaceKey: batch.surfaceKey ?? null,
      renderKey: batch.renderKey ?? null,
      material: batch.material ?? null,
      phase: batch.phase ?? null,
      count: Math.max(0, Math.round(Number(batch.count) || 0)),
      reason: 'same material and phase role domains merged for a continuous visible surface',
      mergedRenderDomains: batch.mergedRenderDomains.map((domain) => ({
        renderDomainId: normalizeRenderDomainId(domain.renderDomainId),
        renderDomainKey: domain.renderDomainKey ?? null,
        count: Math.max(0, Math.round(Number(domain.count) || 0)),
        surfaceKey: domain.surfaceKey ?? null
      }))
    }));
  return {
    schema: 'peercompute.ulg.sph-same-material-domain-merge-diagnostics.v0',
    status: surfaces.length > 0
      ? 'same-material-domain-surfaces-merged'
      : 'no-same-material-domain-surface-merge',
    reason: surfaces.length > 0
      ? 'visible surface extraction merges same-material same-phase role domains'
      : null,
    mergedSurfaceCount: surfaces.length,
    surfaces
  };
}

export function materialPropertiesLookup(material, materialProperties) {
  if (!materialProperties || !material) return null;
  return materialProperties[material]
    ?? materialProperties[String(material).toLowerCase()]
    ?? materialProperties[String(material).toUpperCase()]
    ?? null;
}

export function phaseFromGpuPhaseId(phaseId) {
  const rounded = Math.round(Number(phaseId) || 0);
  if (rounded === 1) return 'solid';
  if (rounded === 2) return 'liquid';
  if (rounded === 3) return 'gas';
  if (rounded === 4) return 'plasma';
  return null;
}

function phaseForProductInventoryRecord(record, term = null, materialProperties = null) {
  if (record?.routing === 'gas' || term?.routing === 'gas' || record?.routingId === 1) return 'gas';
  const phaseFromId = phaseFromGpuPhaseId(record?.phaseId ?? term?.phaseId ?? term?.targetPhaseId);
  if (phaseFromId) return phaseFromId;
  const properties = materialPropertiesLookup(record?.material ?? term?.material, materialProperties);
  const phases = Array.isArray(properties?.phases) ? properties.phases : [];
  const nonGas = phases.find((phase) => phase?.name && phase.name !== 'gas');
  return nonGas?.name ?? phases[0]?.name ?? 'liquid';
}

export function renderKeyForMaterialPhase(material, phase) {
  if (material === 'h2o' && phase === 'solid') return 'ice';
  if (material === 'h2o' && phase === 'gas') return 'steam';
  return material || 'unknown';
}

export function createProductEventSurfaceBatches({
  baseBatches = [],
  reactionSummary = null,
  reactionTable = null,
  materialProperties = null,
  smoothingLengthM = null
} = {}) {
  const records = Array.isArray(reactionSummary?.productInventory?.records)
    ? reactionSummary.productInventory.records
    : [];
  const terms = Array.isArray(reactionTable?.productTermMetadata)
    ? reactionTable.productTermMetadata
    : [];
  const existingKeys = new Set((baseBatches || []).map((batch) => batch.surfaceKey));
  const existingMaterialPhaseKeys = new Set((baseBatches || [])
    .filter((batch) => batch?.material && batch?.phase)
    .map((batch) => `${batch.material}|${batch.phase}`));
  const createdKeys = new Set();
  const batches = [];
  for (const record of records) {
    if (record?.status && record.status !== 'ready') continue;
    if (!(Number(record?.unplacedMassKg) > 0)) continue;
    const term = terms.find((candidate) => candidate.productTermIndex === record.productTermIndex)
      || terms[record.productTermIndex]
      || null;
    const material = record.material || term?.material || null;
    if (!material) continue;
    const phase = phaseForProductInventoryRecord(record, term, materialProperties);
    if (existingMaterialPhaseKeys.has(`${material}|${phase}`)) continue;
    const renderKey = renderKeyForMaterialPhase(material, phase);
    const descriptor = renderDescriptorOf({ material, phase, renderKey });
    if (existingKeys.has(descriptor.surfaceKey) || createdKeys.has(descriptor.surfaceKey)) continue;
    const properties = materialPropertiesLookup(material, materialProperties);
    const optics = opticalRenderParams(opticalQueryForDescriptor(descriptor, properties));
    const color = optics.baseColorSrgb ?? optics.pbr?.baseColorSrgb ?? [1, 1, 1];
    const count = Math.max(1, Math.round(Number(record.eventCount) || 1));
    const colorsRgb = [];
    for (let i = 0; i < count; i += 1) {
      colorsRgb.push(
        clamp(color[0] ?? 1, 0, 1),
        clamp(color[1] ?? 1, 0, 1),
        clamp(color[2] ?? 1, 0, 1)
      );
    }
    batches.push({
      surfaceKey: descriptor.surfaceKey,
      renderKey,
      material,
      phase,
      opticalState: descriptor.opticalState,
      opticalStateKey: descriptor.opticalStateKey,
      renderDomainId: descriptor.renderDomainId,
      renderDomainKey: descriptor.renderDomainKey,
      descriptor,
      positionsM: [],
      normalizedPositions: [],
      colorsRgb,
      bounds: emptyBounds(),
      count,
      surfaceRadiusM: (Number.isFinite(smoothingLengthM) && smoothingLengthM > 0)
        ? smoothingLengthM
        : 0.25,
      source: 'reaction-product-event-buffer',
      productTermIndex: record.productTermIndex,
      reactionIndex: record.reactionIndex,
      unplacedMassKg: record.unplacedMassKg,
      eventCount: record.eventCount
    });
    createdKeys.add(descriptor.surfaceKey);
  }
  return batches;
}

export function createOpticalGpuTableForSurfaceBatches(batches, {
  materialProperties = null,
  materialPropertyBankGpuWarmInputTable = null,
  dispersedMediumOpticalClosureTable = null
} = {}) {
  const table = buildOpticalGpuTable(batches.map((batch) => {
    const pathLengthM = opticalPathLengthMForSurfaceBatch(batch);
    return {
      material: batch.material,
      phase: batch.phase ?? opticalQueryForDescriptor(batch.descriptor).phase,
      renderKey: batch.renderKey,
      opticalState: batch.descriptor?.opticalState || null,
      opticalStateId: batch.descriptor?.opticalStateId ?? batch.opticalStateId ?? 0,
      pathLengthM,
      pathLengthSource: batch?.opticalPathLengthSource
        || (pathLengthM === SPH_DEFAULT_OPTICAL_PATH_LENGTH_M
          && !(Number(batch?.representativeParticleRadiusM) > 0)
          && !(Number(batch?.surfaceRadiusM) > 0)
          ? 'surface-geometry-unavailable-default'
          : 'surface-body-cauchy-mean-chord'),
      properties: materialPropertiesForSurfaceDescriptor(batch.descriptor, materialProperties)
    };
  }), {
    materialProperties: materialProperties || {},
    materialPropertyBankGpuWarmInputTable
  });
  return applyCollectiveOpticalDepthPresentationToGpuTable(table, batches, {
    closureTable: dispersedMediumOpticalClosureTable
  });
}

// The native surface shader consumes the optical GPU table directly rather
// than the renderer-neutral surface metadata. Keep both consumers on the same
// physical contract: a collective field is extracted at integrated optical
// depth tau=1, so its boundary has Beer-Lambert transmission exp(-1). This is
// a presentation transform only; the conserved moments and material closure
// rows remain untouched.
export function applyCollectiveOpticalDepthPresentationToGpuTable(
  table,
  batches = [],
  { closureTable = null } = {}
) {
  if (
    !table?.schema
    || !(table.records instanceof Float32Array)
    || !Array.isArray(table.recordMetadata)
  ) {
    throw new TypeError('collective optical presentation requires an optical GPU table');
  }
  const collectiveBatches = (batches || []).filter((batch) => (
    batch?.collectiveOpticalRoute === true
    || batch?.descriptor?.collectiveOpticalRoute === true
  ));
  if (collectiveBatches.length === 0) return table;

  const records = new Float32Array(table.records);
  const metadata = table.recordMetadata.map((record) => ({ ...record }));
  const layout = table.recordLayout || OPTICAL_GPU_RECORD_LAYOUT;
  const stride = table.recordStrideFloats || layout.length;
  const fieldIndex = (name) => opticalRecordIndex(layout, name);
  const write = (recordIndex, name, value) => {
    const index = fieldIndex(name);
    if (index < 0) {
      throw new RangeError(`optical GPU table is missing ${name}`);
    }
    records[recordIndex * stride + index] = value;
  };
  let readyCount = 0;
  let blockedCount = 0;

  for (const batch of collectiveBatches) {
    const descriptor = batch?.descriptor || batch;
    const coverage = opticalCoverageKey({
      material: batch?.material ?? descriptor?.material,
      phase: batch?.phase ?? descriptor?.phase,
      opticalStateKey: descriptor?.opticalStateKey ?? batch?.opticalStateKey,
      opticalState: descriptor?.opticalState ?? batch?.opticalState,
      opticalStateId: descriptor?.opticalStateId ?? batch?.opticalStateId ?? 0
    });
    const record = metadata.find((candidate) => (
      opticalCoverageKey(candidate) === coverage
    ));
    if (!record || !Number.isSafeInteger(record.recordIndex)) {
      throw new RangeError(
        `collective optical route ${batch?.surfaceKey || coverage} has no optical GPU record`
      );
    }
    const presentation = collectiveOpticalDepthIsosurfacePresentation({
      descriptorOrRow: descriptor,
      closureTable
    });
    const ready = presentation.opticalResponseReady === true;
    write(record.recordIndex, 'roughness', ready ? presentation.opticalRoughness : 1);
    write(record.recordIndex, 'transmission', ready ? presentation.opticalTransmission : 0);
    write(record.recordIndex, 'opacity', presentation.opticalEffectiveOpacity);
    write(record.recordIndex, 'opticalDepth', presentation.opticalDepth);
    write(record.recordIndex, 'blocked', presentation.opticalBlockedFlag);
    write(record.recordIndex, 'status', ready ? 1 : 255);
    // The collective field already transports integrated scattering and
    // absorption depth. Do not tint it a second time with the condensed bulk
    // path coefficient. A lossless scalar scattering closure has no admitted
    // spectral tint, so its source term is neutral and scene illumination
    // supplies the visible colour.
    write(record.recordIndex, 'absorptionCoefficientPerM', 0);
    write(record.recordIndex, 'scatteringCoefficientPerM', 0);
    if (ready && presentation.opticalAchromaticScattering === true) {
      for (const name of [
        'baseColorLinearR',
        'baseColorLinearG',
        'baseColorLinearB',
        'attenuationLinearR',
        'attenuationLinearG',
        'attenuationLinearB'
      ]) {
        write(record.recordIndex, name, 1);
      }
    }
    record.underlyingMaterialClosureBlocked = record.blocked === true;
    record.blocked = !ready;
    record.status = ready ? 1 : 255;
    record.collectiveOpticalPresentation = presentation;
    record.collectiveOpticalAchromaticScattering =
      presentation.opticalAchromaticScattering === true;
    record.collectiveOpticalRoute = true;
    record.collectiveOpticalRouteKey =
      descriptor?.collectiveOpticalRouteKey ?? batch?.collectiveOpticalRouteKey ?? null;
    if (ready) readyCount += 1;
    else blockedCount += 1;
  }

  return {
    ...table,
    records,
    recordMetadata: metadata,
    collectiveOpticalPresentationRecordCount: collectiveBatches.length,
    collectiveOpticalPresentationReadyCount: readyCount,
    collectiveOpticalPresentationBlockedCount: blockedCount,
    collectiveOpticalPresentationAuthority:
      'conserved-dispersed-extinction-optical-depth-isosurface'
  };
}

export function createOpticalGpuLookupForSurfaceBatches(table, batches) {
  const lookup = buildOpticalGpuLookupQueries(table, batches.map((batch) => ({
    material: batch.material,
    phase: batch.phase ?? opticalQueryForDescriptor(batch.descriptor).phase,
    opticalState: batch.descriptor?.opticalState || null,
    opticalStateId: batch.descriptor?.opticalStateId ?? batch.opticalStateId ?? 0
  })));
  return {
    lookup,
    cpuReference: sampleOpticalGpuTableCpu(table, lookup),
    surfaceKeys: batches.map((batch) => batch.surfaceKey),
    signature: opticalGpuLookupSignature(table, lookup)
  };
}

export function residentSurfaceBatchIdentitySignature(batches = []) {
  if (!Array.isArray(batches) || batches.length === 0) return 'empty';
  return batches
    .map((batch) => {
      const descriptor = batch?.descriptor || batch || {};
      const surfaceKey = batch?.surfaceKey
        || surfaceKeyForDescriptor({
          renderKey: descriptor.renderKey ?? batch?.renderKey,
          material: descriptor.material ?? batch?.material,
          phase: descriptor.phase ?? batch?.phase,
          opticalState: descriptor.opticalState ?? batch?.opticalState ?? null
        });
      return [
        surfaceKey,
        descriptor.renderKey ?? batch?.renderKey ?? 'render-unspecified',
        descriptor.material ?? batch?.material ?? 'material-unspecified',
        descriptor.phase ?? batch?.phase ?? 'phase-unspecified',
        normalizeRenderDomainId(descriptor.renderDomainId ?? batch?.renderDomainId)
      ].join(':');
    })
    .sort()
    .join('|');
}

export function residentSurfaceBatchOpticalSignature(batches = []) {
  if (!Array.isArray(batches) || batches.length === 0) return 'empty';
  return batches
    .map((batch) => {
      const descriptor = batch?.descriptor || batch || {};
      return [
        batch?.surfaceKey ?? descriptor.surfaceKey ?? 'surface-unspecified',
        descriptor.opticalStateId ?? batch?.opticalStateId ?? 0,
        descriptor.opticalStateKey
          ?? batch?.opticalStateKey
          ?? stableOpticalStateKey(descriptor.opticalState ?? batch?.opticalState ?? null),
        opticalPathLengthMForSurfaceBatch(batch).toPrecision(12)
      ].join(':');
    })
    .sort()
    .join('|');
}

export function opticalGpuTableBindingLayoutSignature(table = null) {
  if (!table?.schema || !Array.isArray(table.recordMetadata)) return 'unavailable';
  return table.recordMetadata
    .map((record) => [
      record.materialId ?? 0,
      record.phaseId ?? 0,
      record.opticalStateId ?? 0
    ].join(':'))
    .sort()
    .join('|');
}

function typedArrayBytesEqual(left, right) {
  if (left === right) return true;
  if (
    !ArrayBuffer.isView(left)
    || !ArrayBuffer.isView(right)
    || left.byteLength !== right.byteLength
  ) return false;
  const leftBytes = new Uint8Array(
    left.buffer,
    left.byteOffset,
    left.byteLength
  );
  const rightBytes = new Uint8Array(
    right.buffer,
    right.byteOffset,
    right.byteLength
  );
  for (let index = 0; index < leftBytes.length; index += 1) {
    if (leftBytes[index] !== rightBytes[index]) return false;
  }
  return true;
}

export function opticalGpuTableBufferContentsEqual(left = null, right = null) {
  return Boolean(
    left?.schema
    && right?.schema
    && left.schema === right.schema
    && left.recordCount === right.recordCount
    && left.spectralSampleCount === right.spectralSampleCount
    && left.recordStrideBytes === right.recordStrideBytes
    && left.spectralSampleStrideBytes === right.spectralSampleStrideBytes
    && typedArrayBytesEqual(left.records, right.records)
    && typedArrayBytesEqual(left.spectralSamples, right.spectralSamples)
  );
}

export function canReuseSphNativeSurfaceDrawRenderBridge(
  previousBridge,
  {
    device = null,
    context = null,
    format = null,
    surfaceInputLayout = null,
    cameraBufferByteLength = 0
  } = {}
) {
  const compactPositionInput =
    surfaceInputLayout === 'webgpu-marching-cubes-compact-position-rows';
  return Boolean(
    previousBridge?.rendererBridge
      === SPH_NATIVE_WEBGPU_SURFACE_CONSUMER_BRIDGE_MODE
    && !nativeSurfaceBridgeFailureReason(previousBridge)
    && previousBridge.device === device
    && previousBridge.context === context
    && previousBridge.format === format
    && previousBridge.bindGroupLayout
    && previousBridge.cameraBuffer
    && previousBridge.opaquePipeline
    && previousBridge.refractivePipeline
    && previousBridge.vaporPipeline
    && (!compactPositionInput || previousBridge.refractiveBackfacePipeline)
    // Env-map era bridges carry envSampler; older layouts must rebuild
    // against the current refraction layout.
    && previousBridge.envSampler
    && previousBridge.surfaceInputLayout === surfaceInputLayout
    && (previousBridge.cameraBufferByteLength ?? 0) >= cameraBufferByteLength
    && previousBridge.opticalGpuBuffers?.recordsBuffer
    && previousBridge.opticalGpuBuffers?.spectralSamplesBuffer
    && previousBridge.fieldGradientDummyBuffer
    && previousBridge.temperatureDummyBuffer
    && previousBridge.refractionBindGroupLayout
    && previousBridge.refractionSampler
    && previousBridge.refractionDummyTexture
    && previousBridge.refractionDummyBindGroup
    && previousBridge.refractionBackfaceDummyTexture
    && previousBridge.refractionBackfaceDummyView
    && previousBridge.refractionOpaqueDepthDummyTexture
    && previousBridge.refractionOpaqueDepthDummyView
    && previousBridge.envDummyTexture
    && previousBridge.envDummyView
  );
}

export function shouldRetainResidentSurfaceDrawOverlay({
  previousSurfaceBatchSignature = null,
  nextSurfaceBatchSignature = null,
  hasResidentSurfaceDraw = false,
  hasResidentRenderBridge = false,
  allowEmptySurfaceSignature = false
} = {}) {
  const signaturesMatch = Boolean(
    previousSurfaceBatchSignature
    && nextSurfaceBatchSignature
    && previousSurfaceBatchSignature === nextSurfaceBatchSignature
  );
  return Boolean(
    hasResidentSurfaceDraw
    && hasResidentRenderBridge
    && signaturesMatch
    && (
      allowEmptySurfaceSignature
      || (
        previousSurfaceBatchSignature !== 'empty'
        && nextSurfaceBatchSignature !== 'empty'
      )
    )
  );
}

export function surfaceRadiusScaleForRenderBatch(
  batch,
  requestedScale = SPH_SURFACE_RADIUS_SCALE_DEFAULT,
  { explicitSurfaceRadius = false } = {}
) {
  const scale = Number.isFinite(requestedScale) && requestedScale > 0
    ? requestedScale
    : SPH_SURFACE_RADIUS_SCALE_DEFAULT;
  const count = Math.max(0, Math.round(Number(batch?.count) || 0));
  const usesDefaultScale = Math.abs(scale - SPH_SURFACE_RADIUS_SCALE_DEFAULT) < 1e-9;
  if (
    !explicitSurfaceRadius
    && usesDefaultScale
    && count > 0
    && count <= SPH_SPARSE_SURFACE_RADIUS_SCALE_MAX_PARTICLES
  ) {
    return Math.max(scale, SPH_SPARSE_SURFACE_RADIUS_SCALE_MIN);
  }
  return scale;
}

export function resolveRenderFieldParticleRadiusPolicy({
  batch = null,
  requestedScale = SPH_SURFACE_RADIUS_SCALE_DEFAULT,
  explicitSurfaceRadius = false,
  isolation = 80,
  subtract = 24,
  resolution = 32,
  fieldPadding = FIELD_PADDING,
  refEdgeM = 1
} = {}) {
  if (explicitSurfaceRadius) {
    return {
      status: 'surface-wide-explicit-radius',
      mode: 'surface-wide-constant-strength',
      eligible: false,
      floorApplied: false,
      requestedScale: 0,
      resolvedScale: 0,
      continuityFloorScale: null,
      continuityFloorScaleUnbounded: null,
      representativeParticleRadiusM: null,
      smoothingLengthM: null,
      supportMultiplier: null,
      supportTargetIsoradiusM: null,
      samplingMarginM: null,
      targetIsoradiusM: null
    };
  }
  const normalizedRequestedScale = surfaceRadiusScaleForRenderBatch(batch, requestedScale, {
    explicitSurfaceRadius: false
  });
  const material = String(batch?.material || '').trim().toLowerCase();
  const phase = String(batch?.phase || '').trim().toLowerCase();
  const source = String(batch?.source || '').trim().toLowerCase();
  const representativeParticleRadiusM = Number(batch?.representativeParticleRadiusM);
  const smoothingLengthM = Number(batch?.smoothingLengthM);
  const h2oLiquidContinuityEligible = material === 'h2o' && phase === 'liquid';
  const gasContinuityEligible = phase === 'gas' || phase === 'vapor';
  const reactionProductLiquidContinuityEligible = phase === 'liquid'
    && batch?.reactionProductMaterial === true;
  const continuityKind = gasContinuityEligible
    ? 'gas-vapor'
    : (reactionProductLiquidContinuityEligible
      ? 'reaction-product-liquid'
      : 'h2o-liquid');
  const hasRepresentativeParticleRadius = Number.isFinite(representativeParticleRadiusM)
    && representativeParticleRadiusM > 0;
  const hasSmoothingLength = Number.isFinite(smoothingLengthM)
    && smoothingLengthM > 0;
  const surfaceWideProductSupportEligible = reactionProductLiquidContinuityEligible
    && !hasRepresentativeParticleRadius;
  const eligible = (
    h2oLiquidContinuityEligible
    || gasContinuityEligible
    || reactionProductLiquidContinuityEligible
  )
    && source !== 'reaction-product-event-buffer'
    && hasSmoothingLength
    && (hasRepresentativeParticleRadius || surfaceWideProductSupportEligible);
  if (!eligible) {
    return {
      status: 'retained-particle-radius-no-liquid-continuity-floor',
      mode: 'retained-particle-physical-radius',
      eligible: false,
      floorApplied: false,
      requestedScale: normalizedRequestedScale,
      resolvedScale: normalizedRequestedScale,
      continuityFloorScale: null,
      continuityFloorScaleUnbounded: null,
      representativeParticleRadiusM: Number.isFinite(representativeParticleRadiusM)
        ? representativeParticleRadiusM
        : null,
      smoothingLengthM: Number.isFinite(smoothingLengthM) ? smoothingLengthM : null,
      supportMultiplier: null,
      supportTargetIsoradiusM: null,
      samplingMarginM: null,
      targetIsoradiusM: null
    };
  }
  const resolvedIsolation = Math.max(0, Number(isolation) || 0);
  const resolvedSubtract = Math.max(1e-12, Number(subtract) || 0);
  const supportMultiplier = Math.sqrt(
    (resolvedIsolation + resolvedSubtract) / resolvedSubtract
  );
  // Convert the desired SPH support at the visible isovalue back through the
  // metaball kernel. Using the full smoothing length as the isoradius inflates
  // the field far beyond the particle support, swallowing sodium/product
  // surfaces and turning the water cohort into one oversized blob.
  const supportTargetIsoradiusM = smoothingLengthM / Math.max(supportMultiplier, 1e-12);
  const resolvedResolution = Math.max(2, Math.round(Number(resolution) || 2));
  const fieldSpan = Math.max(1e-12, 1 - 2 * Math.max(0, Number(fieldPadding) || 0));
  const samplingCellSizeM = Math.max(0, Number(refEdgeM) || 0)
    / (fieldSpan * resolvedResolution);
  const samplingMarginM = samplingCellSizeM * 0.5;
  if (surfaceWideProductSupportEligible) {
    // Product capacity is seeded before the GPU claims any carrier, so the
    // no-full-readback surface table legitimately has no host particle radius
    // to scale. Once a real product material id appears in retained rows, use
    // the solver's own smoothing support as a constant reconstruction radius.
    // The render-field lattice floor below already owns sampling continuity,
    // so adding its margin again would make the visible cohort unnecessarily
    // wide. This changes presentation geometry only: the field still requires
    // authoritative, massive product rows and neither particle count nor
    // represented volume is altered.
    const surfaceSupportRadiusM = supportTargetIsoradiusM;
    return {
      status: 'reaction-product-liquid-surface-support-floor-applied',
      mode: 'surface-wide-reaction-product-smoothing-support-radius',
      eligible: true,
      floorApplied: true,
      requestedScale: normalizedRequestedScale,
      resolvedScale: 0,
      continuityFloorScale: null,
      continuityFloorScaleUnbounded: null,
      continuityFloorScaleMax: null,
      representativeParticleRadiusM: null,
      smoothingLengthM,
      supportMultiplier,
      supportTargetIsoradiusM,
      samplingCellSizeM,
      samplingMarginM,
      targetIsoradiusM: surfaceSupportRadiusM,
      surfaceSupportRadiusM
    };
  }
  const targetIsoradiusM = Math.max(
    representativeParticleRadiusM,
    supportTargetIsoradiusM + samplingMarginM
  );
  const continuityFloorScaleUnbounded = targetIsoradiusM / representativeParticleRadiusM;
  const continuityFloorScaleMax = gasContinuityEligible
    ? SPH_GAS_CONTINUITY_RADIUS_SCALE_MAX
    : (reactionProductLiquidContinuityEligible
      ? SPH_REACTION_PRODUCT_LIQUID_CONTINUITY_RADIUS_SCALE_MAX
      : SPH_H2O_LIQUID_CONTINUITY_RADIUS_SCALE_MAX);
  const continuityFloorScale = Math.min(
    continuityFloorScaleUnbounded,
    continuityFloorScaleMax
  );
  const resolvedScale = Math.max(normalizedRequestedScale, continuityFloorScale);
  const floorApplied = resolvedScale > normalizedRequestedScale + 1e-12;
  return {
    status: floorApplied
      ? `${continuityKind}-continuity-floor-applied`
      : `${continuityKind}-continuity-floor-not-needed`,
    mode: `retained-particle-radius-with-${continuityKind}-continuity-floor`,
    eligible: true,
    floorApplied,
    requestedScale: normalizedRequestedScale,
    resolvedScale,
    continuityFloorScale,
    continuityFloorScaleUnbounded,
    continuityFloorScaleMax,
    representativeParticleRadiusM,
    smoothingLengthM,
    supportMultiplier,
    supportTargetIsoradiusM,
    samplingCellSizeM,
    samplingMarginM,
    targetIsoradiusM
  };
}

export function renderFieldBatchNeedsAliasSafeResolution(batch = null) {
  const count = Math.max(0, Math.round(Number(batch?.count) || 0));
  const phase = String(batch?.phase || '').trim().toLowerCase();
  return count > 0 && (
    count <= SPH_SPARSE_SURFACE_RADIUS_SCALE_MAX_PARTICLES
    || batch?.source === 'merged-same-material-phase-render-surface'
    // A participating gas volume is reconstructed from the smoothing
    // support of comparatively sparse carrier particles. The old 16^3
    // steam field undersampled that support into faceted particle-sized
    // islands even when the optical closure itself was correct.
    || phase === 'gas'
    || phase === 'vapor'
  );
}

function opticalGpuLookupSignature(table, lookup) {
  return [
    table.recordCount,
    lookup.queryCount,
    Array.from(lookup.queries).join(','),
    Array.from(table.records).join(',')
  ].join('|');
}

function positiveIntegerOrDefault(value, fallback) {
  const number = Math.round(Number(value));
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

export function resolveMaterialInterfaceSurfaceTablePolicy(policy = null) {
  const source = policy?.source || policy?.configuredBy || 'scene-default';
  return {
    schema: 'peercompute.ulg.material-interface-surface-table-policy.v0',
    source,
    maxFieldCells: positiveIntegerOrDefault(
      policy?.maxFieldCells ?? policy?.materialInterfaceMaxFieldCells,
      SPH_MATERIAL_INTERFACE_MAX_FIELD_CELLS_DEFAULT
    ),
    maxResolution: positiveIntegerOrDefault(
      policy?.maxResolution ?? policy?.materialInterfaceMaxResolution,
      SPH_MATERIAL_INTERFACE_MAX_RESOLUTION_DEFAULT
    ),
    defaultMaxFieldCells: SPH_MATERIAL_INTERFACE_MAX_FIELD_CELLS_DEFAULT,
    defaultMaxResolution: SPH_MATERIAL_INTERFACE_MAX_RESOLUTION_DEFAULT,
    scientificValidation: false,
    sphValidation: false,
    fullPhysicsValidation: false
  };
}

export function packedNormalRowsCoverCompactPositionPrefix({
  normalRowCount = 0,
  normalBufferByteLength = 0,
  compactPositionVertexCount = 0
} = {}) {
  const drawVertexCount = Math.max(
    0,
    Math.floor(Number(compactPositionVertexCount) || 0)
  );
  const rowCount = Math.max(0, Math.floor(Number(normalRowCount) || 0));
  const byteLength = Math.max(0, Math.floor(Number(normalBufferByteLength) || 0));
  return drawVertexCount >= 3
    && rowCount >= drawVertexCount
    && byteLength >= drawVertexCount * Uint32Array.BYTES_PER_ELEMENT;
}

export function resolveSchroederNativeSurfaceAdmissionMode({
  hasPrivateAdmission = false,
  artifact = null
} = {}) {
  const hasPublicSuccessorClaim = hasSchroederSpatialLineageClaim(artifact);
  if (!hasPrivateAdmission && !hasPublicSuccessorClaim) return 'legacy';
  if (hasPrivateAdmission && hasPublicSuccessorClaim) return 'successor';
  return 'invalid-partial-or-downgraded-successor-lineage';
}

export function resolveSphSchroederHierarchyContactAdmission({
  schroederSimulation = false,
  contactSolver = true
} = {}) {
  const hierarchyRequested = schroederSimulation === true;
  const contactSolverRequested = contactSolver !== false;
  if (!hierarchyRequested) {
    return Object.freeze({
      schema: 'peercompute.ulg.sph-schroeder-hierarchy-contact-admission.v0',
      status: 'schroeder-hierarchy-not-requested',
      hierarchyRequested: false,
      contactSolverRequested,
      admitted: false,
      reason: null
    });
  }
  if (!contactSolverRequested) {
    // Explicit contact-free bulk mode: the MPM grid + EOS own liquid
    // volume (the WebGPU-Ocean shape) and no pair-contact projection
    // runs. Admission here is only the DECLARATION; the worker lane
    // enforces eligibility against its law-activation receipt and fails
    // closed with a typed reason when any law family that owns contact
    // consequences (thermal, reactions, migration, two-level, surface
    // tension, actionable gas boundary) is active for the schedule.
    // Rationale: the canonical contact stack's rest-distance projection
    // cancels the densification a lattice-seeded liquid needs to develop
    // its hydrostatic gradient — measured 2026-08-28, it holds a water
    // cube rigid at sim t=8s while the contact-free route collapses it
    // correctly (plan/todo/scale-adaptive-law-activation-plan.md).
    return Object.freeze({
      schema: 'peercompute.ulg.sph-schroeder-hierarchy-contact-admission.v0',
      status: 'schroeder-hierarchy-contact-free-admitted',
      hierarchyRequested: true,
      contactSolverRequested: false,
      admitted: true,
      mode: 'explicit-contact-free-bulk',
      reason: null
    });
  }
  return Object.freeze({
    schema: 'peercompute.ulg.sph-schroeder-hierarchy-contact-admission.v0',
    status: 'schroeder-hierarchy-contact-requirement-admitted',
    hierarchyRequested: true,
    contactSolverRequested: true,
    admitted: true,
    reason: null
  });
}

export function resolveSphWorkerLanePolicyAdmission(mountPolicy = null) {
  if (mountPolicy?.workerOwnedResidentProducerRequested !== true) {
    return Object.freeze({
      requested: false,
      eligible: false,
      reason: 'worker-lane-not-requested',
      detail: 'render ownership request does not select the worker-owned resident producer'
    });
  }
  if (mountPolicy?.workerOwnedResidentProducerReady !== true) {
    return Object.freeze({
      // The route remains requested even when its prerequisites are not ready.
      // The caller must fail closed instead of silently selecting page-owned SS.
      requested: true,
      eligible: false,
      reason: 'worker-lane-not-ready',
      detail: 'mounted render-ownership policy does not declare workerOwnedResidentProducerReady'
    });
  }
  return Object.freeze({
    requested: true,
    eligible: true,
    reason: null,
    detail: null
  });
}

export function nativeSurfaceTemperatureDestroyMethodIsAuthenticated(
  temperatureRows,
  destroyMethod
) {
  return Boolean(
    temperatureRows
    && typeof destroyMethod === 'function'
    && temperatureRows.destroy === destroyMethod
  );
}

export function nativeSurfaceTemperatureAttachmentIsRequired(
  surfaceDraw,
  hasPrivateAttachment = false
) {
  return Boolean(
    surfaceDraw?.compactTemperatureRowsBuffer
    || hasPrivateAttachment
  );
}

export function resolveNativeSurfaceTemperatureRetirement({
  translation = null,
  temperatureRecord = null
} = {}) {
  const exactTemperatureRows = temperatureRecord?.temperatureRows ?? null;
  const publicTemperatureRows =
    translation?.nativeSurfaceTemperatureRows ?? null;
  return {
    exactTemperatureRows,
    exactDestroyMethod:
      typeof temperatureRecord?.destroyMethod === 'function'
        ? temperatureRecord.destroyMethod
        : null,
    strayTemperatureRows:
      publicTemperatureRows && publicTemperatureRows !== exactTemperatureRows
        ? publicTemperatureRows
        : null
  };
}

function normalizedSphSceneCameraVector(value) {
  const entries = typeof value === 'string'
    ? value.split(',').map((entry) => entry.trim())
    : (Array.isArray(value) || ArrayBuffer.isView(value) ? Array.from(value) : null);
  if (!entries || entries.length !== 3) return null;
  const vector = entries.map(Number);
  return vector.every(Number.isFinite) ? vector : null;
}

/**
 * Resolve an optional box-normalized camera pose while preserving the exact
 * historical whole-box framing for every scene that does not request one.
 */
export function resolveSphSceneCameraPose({
  boxDimsM = [10, 10, 10],
  positionNormalized = null,
  targetNormalized = null,
  fovYDegrees = 46,
  aspect = 1,
  fitMargin = 1.08
} = {}) {
  const dimensions = (
    (Array.isArray(boxDimsM) || ArrayBuffer.isView(boxDimsM))
    && boxDimsM.length === 3
    && Array.from(boxDimsM).every((entry) => Number.isFinite(Number(entry)) && Number(entry) > 0)
  )
    ? Array.from(boxDimsM, Number)
    : [10, 10, 10];
  const refEdgeM = Math.max(...dimensions);
  const boxCenterM = dimensions.map((extent) => extent / 2);
  const legacyPositionM = [
    boxCenterM[0] + refEdgeM * 0.85,
    boxCenterM[1] + refEdgeM * 0.55,
    boxCenterM[2] + refEdgeM * 1.15
  ];
  const position = normalizedSphSceneCameraVector(positionNormalized);
  const target = normalizedSphSceneCameraVector(targetNormalized);
  if (!position || !target) {
    return Object.freeze({
      status: 'legacy-whole-box-camera',
      positionM: Object.freeze(legacyPositionM),
      targetM: Object.freeze(boxCenterM),
      positionNormalized: null,
      targetNormalized: null
    });
  }
  const positionM = position.map((entry, index) => entry * dimensions[index]);
  const targetM = target.map((entry, index) => entry * dimensions[index]);
  const viewBack = positionM.map((entry, index) => entry - targetM[index]);
  const separationM = Math.hypot(...viewBack);
  if (!(separationM > Math.max(refEdgeM * 1e-6, 1e-9))) {
    return Object.freeze({
      status: 'legacy-whole-box-camera',
      positionM: Object.freeze(legacyPositionM),
      targetM: Object.freeze(boxCenterM),
      positionNormalized: null,
      targetNormalized: null
    });
  }
  // A normalized pose defines composition (focus + view direction), not a
  // licence to crop the physical domain. Fit all eight box corners against
  // the actual vertical FOV and viewport aspect, moving only along the same
  // view ray. This keeps every preset on one geometry-derived camera policy;
  // no scenario identifier or hand-tuned absolute distance participates.
  const forward = viewBack.map((entry) => -entry / separationM);
  const worldUp = Math.abs(forward[1]) < 0.999
    ? [0, 1, 0]
    : [0, 0, 1];
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
  const normalize = (vector) => {
    const length = Math.hypot(...vector);
    return length > 0 ? vector.map((entry) => entry / length) : [1, 0, 0];
  };
  const right = normalize(cross(forward, worldUp));
  const up = normalize(cross(right, forward));
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const resolvedFovYDegrees = Math.min(179, Math.max(1, Number(fovYDegrees) || 46));
  const resolvedAspect = Math.max(1e-6, Number(aspect) || 1);
  const resolvedFitMargin = Math.max(1, Number(fitMargin) || 1.08);
  const tanY = Math.tan((resolvedFovYDegrees * Math.PI / 180) / 2);
  const tanX = tanY * resolvedAspect;
  let fittedDistanceM = separationM;
  for (const x of [0, dimensions[0]]) {
    for (const y of [0, dimensions[1]]) {
      for (const z of [0, dimensions[2]]) {
        const relative = [x - targetM[0], y - targetM[1], z - targetM[2]];
        const forwardOffsetM = dot(relative, forward);
        fittedDistanceM = Math.max(
          fittedDistanceM,
          resolvedFitMargin * Math.abs(dot(relative, right)) / tanX - forwardOffsetM,
          resolvedFitMargin * Math.abs(dot(relative, up)) / tanY - forwardOffsetM
        );
      }
    }
  }
  const fittedPositionM = targetM.map(
    (entry, index) => entry - forward[index] * fittedDistanceM
  );
  return Object.freeze({
    status: fittedDistanceM > separationM + refEdgeM * 1e-9
      ? 'box-normalized-camera-fitted'
      : 'box-normalized-camera',
    positionM: Object.freeze(fittedPositionM),
    targetM: Object.freeze(targetM),
    positionNormalized: Object.freeze(position),
    targetNormalized: Object.freeze(target),
    viewForward: Object.freeze(forward),
    viewRight: Object.freeze(right),
    viewUp: Object.freeze(up),
    desiredDistanceM: separationM,
    fittedDistanceM,
    fovYDegrees: resolvedFovYDegrees,
    aspect: resolvedAspect,
    fitMargin: resolvedFitMargin,
    fitPolicy: 'eight-corner-fov-aspect-domain-fit'
  });
}

export function applySphPresentationCanvasOwnership({
  mainCanvas = null,
  workerCanvasVisible = false
} = {}) {
  const workerOwnsVisibleFrame = Boolean(workerCanvasVisible);
  if (!mainCanvas?.style) {
    return Object.freeze({
      status: 'presentation-main-canvas-unavailable',
      workerCanvasVisible: workerOwnsVisibleFrame,
      mainCanvasComposited: null,
      mainCanvasOpacity: null
    });
  }
  // Keep the native canvas in the input/layout tree so OrbitControls still
  // receives pointer events through the worker canvas (which is pointer-event
  // transparent), but remove its pixels from composition while a complete
  // worker frame owns display. This prevents a committed native isosurface
  // from ghosting behind transparent live-preview particles and still lets a
  // CSS environment/background show through the worker's transparent clear.
  mainCanvas.style.opacity = workerOwnsVisibleFrame ? '0' : '1';
  mainCanvas.setAttribute?.(
    'data-ulg-presentation-compositor-owner',
    workerOwnsVisibleFrame ? 'worker' : 'main-native'
  );
  return Object.freeze({
    status: workerOwnsVisibleFrame
      ? 'presentation-worker-canvas-exclusively-composited'
      : 'presentation-main-native-canvas-composited',
    workerCanvasVisible: workerOwnsVisibleFrame,
    mainCanvasComposited: !workerOwnsVisibleFrame,
    mainCanvasOpacity: mainCanvas.style.opacity
  });
}

// A committed worker isosurface is the visible presentation authority until
// another exact worker frame supersedes it. The compact native snapshot is a
// diagnostic/fallback consumer after this point; it must never steal canvas
// ownership and clear the already-admitted worker surface.
export function workerOwnedIsosurfaceDisplayActive(residentSteps = null) {
  const lane = residentSteps?.workerOwnedResidentLane ?? null;
  const presentation = lane?.committedPresentation ?? null;
  return Boolean(
    residentSteps?.residentComputeManagerMode
      === 'worker-owned-resident-lane'
    && residentSteps?.workerLaneFallback == null
    && lane?.residentScheduleStatus === 'worker-resident-schedule-completed'
    && lane?.cancelled === false
    && Number.isSafeInteger(Number(lane?.completedStepCount))
    && Number(lane.completedStepCount) > 0
    && lane?.finalEpochIdentity
    && typeof lane.finalEpochIdentity === 'object'
    && Number.isSafeInteger(lane.finalEpochIdentity.storageGeneration)
    && lane.finalEpochIdentity.storageGeneration >= 0
    && Number.isSafeInteger(lane.finalEpochIdentity.physicsTick)
    && lane.finalEpochIdentity.physicsTick >= 0
    && Array.isArray(lane?.retainedBufferRefs)
    && lane.retainedBufferRefs.length > 0
    && typeof lane?.scheduleId === 'string'
    && lane.scheduleId.length > 0
    && typeof lane?.laneId === 'string'
    && lane.laneId.length > 0
    && typeof lane?.stateKey === 'string'
    && lane.stateKey.length > 0
    && presentation?.schema
      === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_SCHEMA
    && presentation?.status
      === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_ENQUEUED_STATUS
    && presentation?.presentationGeometry
      === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_GEOMETRY
    && presentation?.sourceCapturedBeforePhysicsContinuation === true
    && presentation?.committedPresentationSchema
      === ULG_WORKER_OFFSCREEN_COMMITTED_RESIDENT_SCHEDULE_PRESENTATION_SCHEMA
    && presentation?.committedPresentationStatus
      === 'state-manager-committed-resident-schedule-presentation-admission'
    && presentation?.residentScheduleCandidatePresentation === true
    && presentation?.stateManagerCommittedPresentation === true
    && presentation?.scheduleId === lane.scheduleId
    && presentation?.laneId === lane.laneId
    && presentation?.stateKey === lane.stateKey
    && Number.isSafeInteger(presentation?.residentExecutionGeneration)
    && presentation.residentExecutionGeneration >= 0
    && presentation.residentExecutionGeneration
      === lane.finalEpochIdentity.storageGeneration
    && Number.isSafeInteger(presentation?.sphStep)
    && presentation.sphStep >= 0
    && presentation.sphStep === lane.finalEpochIdentity.physicsTick
    && Number.isSafeInteger(presentation?.stepOrdinal)
    && presentation.stepOrdinal > 0
    && presentation.stepOrdinal === Number(lane.completedStepCount)
    && presentation?.authorityStatus
      === 'state-manager-committed-worker-schedule'
    && presentation?.computeManagerCompletionSchema
      === ULG_WORKER_LANE_COMPUTE_MANAGER_COMPLETION_SCHEMA
    && typeof presentation?.computeManagerLeaseId === 'string'
    && presentation.computeManagerLeaseId.length > 0
    && presentation?.computeManagerLeaseStatus === 'completed'
    && presentation?.computeManagerFenceSatisfied === true
    && presentation?.stateManagerCommitStatus === 'committed'
    && presentation?.stateManagerCommitAccepted === true
    && presentation?.terminalScheduleFence === true
    && presentation?.terminalFenceScope === 'resident-schedule-terminal'
    && presentation?.terminalFenceSatisfied === true
    && presentation?.terminalFenceAuthorityAdmissionReady === true
    && presentation?.producerSourceKind
      === 'worker-retained-resident-stage-output'
    && presentation?.producerSourceTransport
      === 'worker-retained-resident-stage-output'
    && presentation?.sourceStageId === 'schroederSameLevelMechanics'
    && presentation?.retainedParticleStateStatus
      === 'worker-retained-particle-state-ready'
  );
}

// Explicit main-thread presentation is a user choice, not an automatic
// fallback. It must therefore outrank every worker-owned continuity policy
// once a main-thread frame can be admitted. Keeping this arbitration pure
// makes the precedence independently testable instead of relying on source
// matching across the asynchronous candidate and resident-schedule paths.
export function workerLanePresentationHoldsDisplay({
  activeWorkerPresentation = false,
  laneSeeded = false,
  lanePoisoned = false,
  explicitMainThreadPresentationRequested = false
} = {}) {
  return Boolean(
    explicitMainThreadPresentationRequested !== true
    && activeWorkerPresentation === true
    && laneSeeded === true
    && lanePoisoned !== true
  );
}

export function resolveWorkerSchedulePresentationDisplayOwner({
  explicitMainThreadPresentationRequested = false,
  mainNativeDisplayOwnershipDeferred = false,
  workerLaneNativeSurfacePresentationRequested = false,
  workerLivePreviewRequested = false,
  workerOwnedIsosurfaceRequested = false
} = {}) {
  // An explicit main-thread request becomes visible only after its first
  // native frame is validated and submitted. Until that atomic handoff, keep
  // the retained worker frame composited instead of clearing both canvases.
  if (explicitMainThreadPresentationRequested === true) {
    return mainNativeDisplayOwnershipDeferred === true
      ? 'worker'
      : 'main-native';
  }
  return workerLaneNativeSurfacePresentationRequested === true
    && workerLivePreviewRequested !== true
    && workerOwnedIsosurfaceRequested !== true
    ? 'main-native'
    : 'worker';
}

