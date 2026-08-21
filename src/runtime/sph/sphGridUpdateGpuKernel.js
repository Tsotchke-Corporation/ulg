import {
  MLS_MPM_GPU_GRID_NODE_ROW_LAYOUT,
  MLS_MPM_GPU_GRID_VELOCITY_ROW_LAYOUT,
  SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_MISSING_CELL_NO_LOAD,
  SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_PARAMS_BYTES,
  createSchroederSpatialGasPressureBoundaryTransportLayout,
  createSchroederSpatialGasPressureBoundaryTransportParams,
  createSchroederSpatialGasPressureBoundaryTransportScratchHeader,
  createSchroederSpatialPhaseVolumeTransportScratchHeader,
  SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_PARAMS_BYTES,
  schroederSpatialPhaseVolumeTransportScratchWordLength,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT,
  SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT,
  ULG_MLS_MPM_GPU_GRID_PROJECTION_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_UPDATE_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_UPDATE_PARITY_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import { mlsMpmGridUpdateWgsl } from '../../../ulg-gpu-abi/src/wgsl.js';
import {
  schroederSpatialGasPressureBoundaryTransportWgsl
} from '../../../ulg-gpu-abi/src/schroederSpatialGasPressureBoundaryTransportWgsl.js';
import {
  schroederSpatialPhaseVolumeTransportWgsl
} from '../../../ulg-gpu-abi/src/schroederSpatialPhaseVolumeTransportWgsl.js';
import {
  schroederSpatialPhaseVolumeSurfaceStressTransportWgsl
} from '../../../ulg-gpu-abi/src/schroederSpatialPhaseVolumeSurfaceStressTransportWgsl.js';
import { requestOpticalGpuDevice } from '../material/opticalGpuBuffers.js';
import {
  assertQueueOrderedCleanupClaimsRegistered,
  cancelQueueOrderedCleanupClaim,
  computeBufferBinding,
  createCachedExplicitComputePipeline,
  createQueueOrderedCleanupClaimIssuer,
  deferSubmittedWorkCleanup,
  registerQueueOrderedCleanupClaim,
  sealQueueOrderedFinalConsumerCapability,
  submitQueueOrderedFinalConsumerWork,
  submitQueueOrderedWork,
  releaseSubmittedWorkCleanupQueueOrdered
} from '../webgpuComputeLayout.js';
import {
  MLS_MPM_GPU_GRID_NODE_FLOATS,
  MLS_MPM_MECHANICS_FIELD_MODE_DISABLED,
  MLS_MPM_MECHANICS_FIELD_MODE_REQUIRED,
  validateLocallySubmittedMlsMpmActiveSourceDenseP2g,
  validateLocallySubmittedMlsMpmMechanicsFieldP2g
} from './sphGridGpuKernel.js';
import {
  claimSchroederFusedCoarseTerminalStageProducer,
  claimSchroederFusedFineSubstepStageProducer,
  markSchroederFusedCoarseTerminalStageSubmissionObserved,
  markSchroederFusedCoarseTerminalStageSubmitted,
  markSchroederFusedFineSubstepStageSubmissionObserved,
  markSchroederFusedFineSubstepStageSubmitted,
  quarantineSchroederFusedCoarseTerminalTransaction,
  quarantineSchroederFusedFineSubstepTransaction,
  releaseSchroederFusedCoarseTerminalStageProducer,
  releaseSchroederFusedFineSubstepStageProducer,
  validateSchroederFusedCoarseTerminalTransaction,
  validateSchroederFusedFineSubstepTransaction
} from './schroederFusedFineSubstepGpu.js';
import {
  typedArrayContentFingerprint,
  webGpuBufferMatchesDevice,
  webGpuBufferDevice,
  webGpuDeviceId
} from './sphGpuDeviceIdentity.js';
import {
  appendGpuReadbackTelemetryObservation,
  createGpuReadbackTelemetry,
  mergeGpuReadbackTelemetry
} from './sphGpuReadbackTelemetry.js';
import {
  strictReactionGateAllowsForceCoupling
} from './sphReactionGpuSummary.js';
import {
  resolveSchroederSpatialPhaseVolumeSurfaceStressAuthority,
  resolveSchroederSpatialPhaseVolumeTransportAuthority,
  validateSchroederSingleLevelQueueOrderedCleanupCapability
} from './schroederSpatialEpochTransaction.js';
import {
  uploadedMechanicsMaterialPhaseRecordsMatch
} from './sphMechanicsRefreshGpuKernel.js';
import {
  abandonSphSpatialGasPressureAuthority,
  bindSphSpatialGasPressureMechanicsAuthority,
  createSphSpatialGasPressureMechanicsAuthorityBinding,
  quarantineSphSpatialGasPressureAuthorityAfterSubmitFailure,
  retireSphSpatialGasPressureAuthorityQueueOrdered,
  sphSpatialGasPressureAuthorityQueueOrderedClaim
} from './sphSpatialGasLedgerEosGpu.js';

export {
  ULG_MLS_MPM_GPU_GRID_UPDATE_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_UPDATE_PARITY_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
  mlsMpmGridUpdateWgsl
};

export const MLS_MPM_GPU_GRID_VELOCITY_FLOATS = MLS_MPM_GPU_GRID_VELOCITY_ROW_LAYOUT.length;
export const SPH_PRESSURE_INTERFACE_FORCE_FLOATS = SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT.length;
export const ULG_PRESSURE_INTERFACE_GRID_FORCE_CONSUMPTION_ADMISSION_SCHEMA = 'peercompute.ulg.pressure-interface-grid-force-consumption-admission.v0';
export const ULG_DIRECT_RESIDENT_PRESSURE_INTERFACE_PUBLICATION_SCHEMA =
  'peercompute.ulg.direct-resident-pressure-interface-publication.v0';
export const ULG_DIRECT_RESIDENT_PRESSURE_INTERFACE_PUBLICATION_STATUS =
  'direct-resident-pressure-interface-output-published';
export const ULG_DIRECT_RESIDENT_PRESSURE_INTERFACE_AUTHORITY =
  'scene-local-direct-resident-same-device-queue';
export const ULG_MLS_MPM_WALL_BARRIER_CONTACT_SCHEMA = 'peercompute.ulg.mls-mpm-wall-barrier-contact.v0';
export const ULG_SCHROEDER_PHASE_VOLUME_SURFACE_STRESS_SUBMISSION_SCHEMA =
  'peercompute.ulg.schroeder-phase-volume-surface-stress-submission.v2';
export const ULG_SCHROEDER_PHASE_VOLUME_SURFACE_STRESS_SUBMISSION_STATUS =
  'eighteen-pass-central-bond-surface-stress-submitted-unverified';
export const ULG_SCHROEDER_PHASE_VOLUME_AMBIENT_BUOYANCY_SUBMISSION_SCHEMA =
  'peercompute.ulg.schroeder-phase-volume-ambient-buoyancy-submission.v0';
export const ULG_SCHROEDER_PHASE_VOLUME_AMBIENT_BUOYANCY_SUBMISSION_STATUS =
  'ambient-buoyancy-lifecycle-submitted-unverified';
export const ULG_SCHROEDER_GAS_PRESSURE_BOUNDARY_SUBMISSION_SCHEMA =
  'peercompute.ulg.schroeder-gas-pressure-boundary-submission.v1';
export const ULG_SCHROEDER_GAS_PRESSURE_BOUNDARY_SUBMISSION_STATUS =
  'exact-v4-gas-pressure-boundary-submitted-unverified';
export const SCHROEDER_GAS_PRESSURE_BOUNDARY_ENTRY_POINTS = Object.freeze([
  'prevalidate_field_boundary_transport',
  'prevalidate_source_boundary_transport',
  'initialize_boundary_transport',
  'stage_boundary_transport',
  'validate_boundary_transport',
  'commit_boundary_transport'
]);
export const SCHROEDER_PHASE_VOLUME_SURFACE_STRESS_ENTRY_POINTS = Object.freeze([
  'stage_surface_stress_x_even',
  'stage_surface_stress_x_odd',
  'stage_surface_stress_y_even',
  'stage_surface_stress_y_odd',
  'stage_surface_stress_z_even',
  'stage_surface_stress_z_odd',
  'stage_surface_stress_xy_positive_even',
  'stage_surface_stress_xy_positive_odd',
  'stage_surface_stress_xy_negative_even',
  'stage_surface_stress_xy_negative_odd',
  'stage_surface_stress_xz_positive_even',
  'stage_surface_stress_xz_positive_odd',
  'stage_surface_stress_xz_negative_even',
  'stage_surface_stress_xz_negative_odd',
  'stage_surface_stress_yz_positive_even',
  'stage_surface_stress_yz_positive_odd',
  'stage_surface_stress_yz_negative_even',
  'stage_surface_stress_yz_negative_odd'
]);

const GPU_BUFFER_USAGE = {
  MAP_READ: globalThis.GPUBufferUsage?.MAP_READ ?? 1,
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  INDIRECT: globalThis.GPUBufferUsage?.INDIRECT ?? 256,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64
};

const GPU_MAP_MODE = {
  READ: globalThis.GPUMapMode?.READ ?? 1
};

const DEFAULT_GRAVITY_M_PER_S2 = Object.freeze([0, -9.80665, 0]);
const DEFAULT_BOX_DIMS_M = Object.freeze([5, 5, 5]);
export const DEFAULT_CFL_FACTOR = 0.6;
const GRID_UPDATE_SCOPE = 'mls-mpm-grid-velocity-update-gravity-cfl-walls';
const FULL_READBACK_MODE = 'full-parity-readback';
const NO_FULL_READBACK_MODE = 'no-full-readback';
const EMPTY_PRESSURE_INTERFACE_FORCE_ROWS = new Float32Array(SPH_PRESSURE_INTERFACE_FORCE_FLOATS);
const DEFAULT_WALL_BARRIER_ELASTIC_STIFFNESS_N_PER_M = 0;
const DEFAULT_WALL_BARRIER_CONTACT_SCALE = 1;
const DEFAULT_WALL_BARRIER_MIN_GAP_M = 1e-6;
const MLS_MPM_GRID_UPDATE_PARAMS_BYTES = 80;
const ULG_ALGORITHM_CONTACT_MATERIAL_ROWS_SCHEMA = 'peercompute.ulg.algorithm-material-contact-rows.v0';
const mechanicsFieldGridUpdateOrigins = new WeakMap();
const activeSourceDenseGridUpdateOrigins = new WeakMap();
const gasPressureBoundaryPipelinesByDevice = new WeakMap();
const mechanicsFieldGridUpdatePipelinesByDevice = new WeakMap();
const phaseVolumeTransportPipelinesByDevice = new WeakMap();
const phaseVolumeSurfaceStressPipelinesByDevice = new WeakMap();
const gridUpdateSubmittedTemporaryCleanupClaimIssuer =
  createQueueOrderedCleanupClaimIssuer({
    producerFamily: 'mls-mpm-grid-update-submitted-temporaries'
  });
const PRESSURE_INTERFACE_GRID_APPLICATION_STATUSES = new Set([
  'apply-to-mls-mpm-grid',
  'pressure-interface-grid-force-consumer-approved'
]);

function mechanicsFieldGridUpdatePipelines(device, code) {
  const cached = mechanicsFieldGridUpdatePipelinesByDevice.get(device);
  if (cached) return cached;
  const bindings = [
    computeBufferBinding(0, 'storage'),
    computeBufferBinding(2, 'uniform')
  ];
  const pipeline = (cacheKey, label, entryPoint) => (
    createCachedExplicitComputePipeline(device, {
      cacheKey,
      label,
      code,
      entryPoint,
      bindings
    })
  );
  const bundle = Object.freeze({
    beginHeat: pipeline(
      'ulg-mls-mpm-grid-update.mechanics-field-begin-heat.v5',
      'ulg-mls-mpm-grid-update-mechanics-field-begin-heat',
      'begin_heat_receipt'
    ),
    clearHeat: pipeline(
      'ulg-mls-mpm-grid-update.mechanics-field-clear-heat.v5',
      'ulg-mls-mpm-grid-update-mechanics-field-clear-heat',
      'clear_heat_rows'
    ),
    buildHeat: pipeline(
      'ulg-mls-mpm-grid-update.mechanics-field-build-heat.v5',
      'ulg-mls-mpm-grid-update-mechanics-field-build-heat',
      'begin_heat_build'
    ),
    main: pipeline(
      'ulg-mls-mpm-grid-update.mechanics-field.v5',
      'ulg-mls-mpm-grid-update-mechanics-field',
      'main'
    ),
    claim: pipeline(
      'ulg-mls-mpm-grid-update.mechanics-field-claim.v6',
      'ulg-mls-mpm-grid-update-mechanics-field-claim',
      'claim_velocity_state'
    ),
    contact: pipeline(
      'ulg-mls-mpm-grid-update.mechanics-field-contact.v5',
      'ulg-mls-mpm-grid-update-mechanics-field-contact',
      'contact_fields'
    ),
    summarizeHeat: pipeline(
      'ulg-mls-mpm-grid-update.mechanics-field-summarize-heat.v5',
      'ulg-mls-mpm-grid-update-mechanics-field-summarize-heat',
      'summarize_heat_rows'
    ),
    seal: pipeline(
      'ulg-mls-mpm-grid-update.mechanics-field-seal-velocity.v5',
      'ulg-mls-mpm-grid-update-mechanics-field-seal-velocity',
      'seal_velocity_state'
    )
  });
  mechanicsFieldGridUpdatePipelinesByDevice.set(device, bundle);
  return bundle;
}

function phaseVolumeTransportPipelines(device) {
  const cached = phaseVolumeTransportPipelinesByDevice.get(device);
  if (cached) return cached;
  const bindings = [
    computeBufferBinding(0, 'storage'),
    computeBufferBinding(1, 'read-only-storage'),
    computeBufferBinding(2, 'read-only-storage'),
    computeBufferBinding(3, 'read-only-storage'),
    computeBufferBinding(4, 'read-only-storage'),
    computeBufferBinding(5, 'read-only-storage'),
    computeBufferBinding(6, 'uniform'),
    computeBufferBinding(7, 'storage')
  ];
  const pipeline = (cacheKey, label, entryPoint) => (
    createCachedExplicitComputePipeline(device, {
      cacheKey,
      label,
      code: schroederSpatialPhaseVolumeTransportWgsl,
      entryPoint,
      bindings
    })
  );
  const bundle = Object.freeze({
    stage: pipeline(
      'ulg-schroeder-phase-volume-transport.stage.v5',
      'ulg-schroeder-phase-volume-transport-stage',
      'stage_transport'
    ),
    validate: pipeline(
      'ulg-schroeder-phase-volume-transport.validate-staged.v5',
      'ulg-schroeder-phase-volume-transport-validate-staged',
      'validate_staged_transport'
    ),
    commit: pipeline(
      'ulg-schroeder-phase-volume-transport.commit.v5',
      'ulg-schroeder-phase-volume-transport-commit',
      'commit_transport'
    )
  });
  phaseVolumeTransportPipelinesByDevice.set(device, bundle);
  return bundle;
}

function phaseVolumeSurfaceStressPipelines(device) {
  const cached = phaseVolumeSurfaceStressPipelinesByDevice.get(device);
  if (cached) return cached;
  const bindings = [
    computeBufferBinding(0, 'storage'),
    computeBufferBinding(4, 'read-only-storage'),
    computeBufferBinding(5, 'read-only-storage'),
    computeBufferBinding(6, 'uniform'),
    computeBufferBinding(7, 'storage')
  ];
  const pipeline = (cacheKey, label, entryPoint) => (
    createCachedExplicitComputePipeline(device, {
      cacheKey,
      label,
      code: schroederSpatialPhaseVolumeSurfaceStressTransportWgsl,
      entryPoint,
      bindings
    })
  );
  const bundle = Object.freeze({
    stages: Object.freeze(
      SCHROEDER_PHASE_VOLUME_SURFACE_STRESS_ENTRY_POINTS.map(
        (entryPoint) => pipeline(
          `ulg-schroeder-phase-volume-surface-stress.${entryPoint}.v4`,
          `ulg-schroeder-phase-volume-surface-stress-${entryPoint}`,
          entryPoint
        )
      )
    ),
    initialize: pipeline(
      'ulg-schroeder-phase-volume-surface-stress.initialize.v2',
      'ulg-schroeder-phase-volume-surface-stress-initialize',
      'initialize_surface_stress'
    ),
    validate: pipeline(
      'ulg-schroeder-phase-volume-surface-stress.validate.v2',
      'ulg-schroeder-phase-volume-surface-stress-validate',
      'validate_surface_stress'
    ),
    commit: pipeline(
      'ulg-schroeder-phase-volume-surface-stress.commit.v2',
      'ulg-schroeder-phase-volume-surface-stress-commit',
      'commit_surface_stress'
    )
  });
  phaseVolumeSurfaceStressPipelinesByDevice.set(device, bundle);
  return bundle;
}
const PRESSURE_INTERFACE_ADMITTED_DESCRIPTOR_STATUSES = new Set([
  'worker-retained-pressure-interface-output-admitted',
  'worker-retained-pressure-interface-output-published'
]);

function createGasPressureBoundaryPipelines(device) {
  const cached = gasPressureBoundaryPipelinesByDevice.get(device);
  if (cached) return cached;
  if (
    typeof device?.createBindGroupLayout !== 'function'
    || typeof device?.createPipelineLayout !== 'function'
    || typeof device?.createShaderModule !== 'function'
    || typeof device?.createComputePipeline !== 'function'
  ) {
    throw new TypeError(
      'Gas pressure boundary transport requires explicit WebGPU pipeline layouts'
    );
  }
  const bindGroupLayout = device.createBindGroupLayout({
    label: 'ulg-schroeder-gas-pressure-boundary-bind-group-layout',
    entries: [
      computeBufferBinding(0, 'storage'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'read-only-storage'),
      computeBufferBinding(3, 'read-only-storage'),
      computeBufferBinding(4, 'read-only-storage'),
      computeBufferBinding(5, 'storage'),
      computeBufferBinding(6, 'read-only-storage'),
      computeBufferBinding(7, 'uniform')
    ]
  });
  const pipelineLayout = device.createPipelineLayout({
    label: 'ulg-schroeder-gas-pressure-boundary-pipeline-layout',
    bindGroupLayouts: [bindGroupLayout]
  });
  const module = device.createShaderModule({
    label: 'ulg-schroeder-gas-pressure-boundary-wgsl',
    code: schroederSpatialGasPressureBoundaryTransportWgsl
  });
  const pipelines = Object.freeze({
    bindGroupLayout,
    entryPoints: SCHROEDER_GAS_PRESSURE_BOUNDARY_ENTRY_POINTS,
    pipelines: Object.freeze(
      SCHROEDER_GAS_PRESSURE_BOUNDARY_ENTRY_POINTS.map((entryPoint) => (
        device.createComputePipeline({
          label: `ulg-schroeder-gas-pressure-boundary-${entryPoint}`,
          layout: pipelineLayout,
          compute: { module, entryPoint }
        })
      ))
    )
  });
  gasPressureBoundaryPipelinesByDevice.set(device, pipelines);
  return pipelines;
}

function exactGasPressureGridCellOrigin(binding) {
  const shift = Number(binding?.gasGridShift);
  if (
    !Number.isSafeInteger(shift)
    || shift < 0
    || shift > 0x7fff_ffff
  ) {
    throw new TypeError(
      'Gas pressure boundary requires an exact i32 mechanics-grid shift'
    );
  }
  // Mechanics field dense index (0,0,0) is the exact spatial cell
  // (-gridShift,-gridShift,-gridShift). Gas directory keys use those integer
  // floor(position/spacing) coordinates; boxMinM is a physical domain bound,
  // not the dense-grid cell origin.
  return Object.freeze([-shift, -shift, -shift]);
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function finiteVector3(value, fallback) {
  const source = Array.isArray(value) ? value : fallback;
  return [
    finiteNumber(source?.[0], fallback[0]),
    finiteNumber(source?.[1], fallback[1]),
    finiteNumber(source?.[2], fallback[2])
  ];
}

function clamp01(value) {
  const number = finiteNumber(value, 0);
  if (number <= 0) return 0;
  if (number >= 1) return 1;
  return number;
}

function exactArrayMatches(value, expected) {
  return Array.isArray(value)
    && value.length === expected.length
    && expected.every((entry, index) => Object.is(value[index], entry));
}

function mechanicsFieldGridUpdateMatchesOrigin(update, origin, {
  sourceProjection = null,
  fieldExecution = null,
  transaction = null,
  terminalTransaction = null,
  macroAuthority = null,
  microepochAuthority = null,
  particleContinuation = null,
  mutationSegment = null,
  priorArtifact = null,
  requireDeferred = null,
  proposalMode = null
} = {}) {
  const receipt = update?.mechanicsFieldEnergyReceipt ?? null;
  const fine = origin?.transactionMode === 'fine';
  const terminal = origin?.transactionMode === 'coarse-terminal';
  return Boolean(
    origin
    && update === origin.update
    && update?.schema === ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA
    && update?.backend === 'webgpu'
    && update?.status === 'submitted-unverified'
    && update?.sourceProjection === origin.sourceProjection
    && (sourceProjection == null || sourceProjection === origin.sourceProjection)
    && update?.mechanicsFieldViewExecution === origin.fieldExecution
    && (fieldExecution == null || fieldExecution === origin.fieldExecution)
    && update?.mechanicsFieldViewBuffer === origin.fieldBuffer
    && update?.mechanicsFieldViewByteLength === origin.fieldByteLength
    && update?.mechanicsFieldMode === MLS_MPM_MECHANICS_FIELD_MODE_REQUIRED
    && update?.mechanicsFieldViewEnabled === true
    && update?.gridStateAuthority
      === 'schroeder-spatial-mechanics-field-view-v1'
    && update?.denseGridAuthoritative === false
    && update?.fieldStateUpdateSubmittedInPlace === true
    && update?.fieldStateUpdatedInPlace === false
    && update?.mechanicsFieldMutationInputOrdinal === origin.inputOrdinal
    && update?.mechanicsFieldMutationOutputOrdinal === origin.outputOrdinal
    && update?.mechanicsFieldMutationInputStateEncoding === origin.inputEncoding
    && update?.mechanicsFieldMutationOutputStateEncoding === origin.outputEncoding
    && receipt === origin.receipt
    && receipt?.schema
      === 'peercompute.ulg.schroeder-mechanics-field-energy-receipt.v3'
    && receipt?.status === origin.receiptStatus
    && receipt?.deferSeal === origin.deferSeal
    && receipt?.fieldMutationOrdinal === origin.outputOrdinal
    && (requireDeferred == null
      || receipt.deferSeal === (requireDeferred === true))
    && Object.is(update?.dt, origin.dt)
    && exactArrayMatches(update?.gravityMPerS2, origin.gravity)
    && exactArrayMatches(update?.boxDimsM, origin.box)
    && Object.is(update?.cflFactor, origin.cflFactor)
    && Object.is(update?.gridSpacingM, origin.gridSpacingM)
    && exactArrayMatches(update?.gridDims, origin.gridDims)
    && update?.gridNodeCount === origin.gridNodeCount
    && update?.gridShift === origin.gridShift
    && update?.readbackMode === NO_FULL_READBACK_MODE
    && update?.fullReadbackPerformed === false
    && update?.normalHotLoopReadbackFree === true
    && (origin.transaction == null || (
      (fine
        ? update?.fusedFineSubstepTransaction === origin.transaction
          && update?.fineMicroepochAuthority === origin.microepochAuthority
          && update?.fusedCoarseTerminalTransaction == null
        : terminal
          ? update?.fusedCoarseTerminalTransaction === origin.transaction
            && update?.terminalMicroepochAuthority === origin.microepochAuthority
            && update?.fusedFineSubstepTransaction == null
          : false)
        && update?.sourceParticleContinuation === origin.particleContinuation
        && update?.proposalMode === origin.proposalMode
        && origin.transaction?.macroAuthority === origin.macroAuthority
        && origin.transaction?.microepochAuthority === origin.microepochAuthority
        && origin.transaction?.particleContinuation === origin.particleContinuation
        && origin.canonicalGeneration === origin.microepochAuthority?.generation
        && origin.transaction?.gridUpdateMutation === origin.mutationSegment
        && Object.is(
          origin.dt,
          fine ? origin.macroAuthority?.fineDt : origin.macroAuthority?.macroDt
        )
        && Object.is(
          origin.sourceProjection?.dt,
          fine ? origin.macroAuthority?.fineDt : origin.macroAuthority?.macroDt
        )
        && origin.fieldExecution === (fine
          ? origin.transaction?.fineFieldView
          : origin.transaction?.coarseFieldView)
        && origin.selectedLevel === (fine
          ? origin.macroAuthority?.fineLevel
          : origin.macroAuthority?.coarseLevel)
        && origin.sourceProjection?.schroederLevelFilter?.selectedLevel
          === origin.selectedLevel
        && origin.proposalMode === 'proposal-deferred-to-post-mechanics'
        && (fine
          ? validateSchroederFusedFineSubstepTransaction(
              origin.device,
              origin.transaction,
              {
                macroAuthority: origin.macroAuthority,
                microepochAuthority: origin.microepochAuthority,
                particleContinuation: origin.particleContinuation
              }
            )
          : validateSchroederFusedCoarseTerminalTransaction(
              origin.device,
              origin.transaction,
              {
                macroAuthority: origin.macroAuthority,
                microepochAuthority: origin.microepochAuthority,
                particleContinuation: origin.particleContinuation
              }
            ))
        && validateLocallySubmittedMlsMpmMechanicsFieldP2g(
          origin.device,
          origin.sourceProjection,
          {
            ...(fine
              ? { transaction: origin.transaction }
              : { terminalTransaction: origin.transaction }),
            macroAuthority: origin.macroAuthority,
            microepochAuthority: origin.microepochAuthority,
            particleContinuation: origin.particleContinuation,
            fieldExecution: origin.fieldExecution,
            mutationSegment: origin.transaction.p2gMutation,
            priorArtifact: null,
            requireDeferred: true,
            proposalMode: origin.proposalMode
          }
        )
      ))
    && (fine
      ? (transaction == null || transaction === origin.transaction)
        && terminalTransaction == null
      : terminal
        ? (terminalTransaction == null
            || terminalTransaction === origin.transaction)
          && transaction == null
        : transaction == null && terminalTransaction == null)
    && (macroAuthority == null || macroAuthority === origin.macroAuthority)
    && (microepochAuthority == null
      || microepochAuthority === origin.microepochAuthority)
    && (particleContinuation == null
      || particleContinuation === origin.particleContinuation)
    && (mutationSegment == null || mutationSegment === origin.mutationSegment)
    && (priorArtifact == null || priorArtifact === origin.sourceProjection)
    && (proposalMode == null || proposalMode === origin.proposalMode)
  );
}

export function validateLocallySubmittedMlsMpmMechanicsFieldGridUpdate(
  device,
  update,
  options = {}
) {
  const origin = update && mechanicsFieldGridUpdateOrigins.get(update);
  return Boolean(
    origin?.transaction
    && origin.deviceId === webGpuDeviceId(device)
    && mechanicsFieldGridUpdateMatchesOrigin(update, origin, options)
  );
}

export function validateSubmittedMlsMpmMechanicsFieldGridUpdate(
  device,
  update,
  options = {}
) {
  const localOrigin = update && mechanicsFieldGridUpdateOrigins.get(update);
  return Boolean(
    localOrigin?.deviceId === webGpuDeviceId(device)
    && mechanicsFieldGridUpdateMatchesOrigin(update, localOrigin, options)
  );
}

function registerSubmittedMechanicsFieldGridUpdate(
  device,
  update,
  sourceProjection,
  fieldExecution,
  {
    transaction = null,
    transactionMode = 'fine',
    particleContinuation = null,
    mutationSegment = null
  } = {}
) {
  const receipt = update.mechanicsFieldEnergyReceipt;
  const origin = Object.freeze({
    device,
    deviceId: webGpuDeviceId(device),
    update,
    sourceProjection,
    fieldExecution,
    transaction,
    transactionMode,
    macroAuthority: transaction?.macroAuthority ?? null,
    microepochAuthority: transaction?.microepochAuthority ?? null,
    particleContinuation,
    mutationSegment,
    canonicalGeneration: transaction?.microepochAuthority?.generation ?? null,
    selectedLevel:
      sourceProjection?.schroederLevelFilter?.selectedLevel ?? null,
    proposalMode: transaction == null
      ? null
      : 'proposal-deferred-to-post-mechanics',
    fieldBuffer: update.mechanicsFieldViewBuffer,
    fieldByteLength: update.mechanicsFieldViewByteLength,
    inputOrdinal: update.mechanicsFieldMutationInputOrdinal,
    outputOrdinal: update.mechanicsFieldMutationOutputOrdinal,
    inputEncoding: update.mechanicsFieldMutationInputStateEncoding,
    outputEncoding: update.mechanicsFieldMutationOutputStateEncoding,
    receipt,
    receiptStatus: receipt.status,
    deferSeal: receipt.deferSeal,
    dt: update.dt,
    gravity: Object.freeze([...update.gravityMPerS2]),
    box: Object.freeze([...update.boxDimsM]),
    cflFactor: update.cflFactor,
    gridSpacingM: update.gridSpacingM,
    gridDims: Object.freeze([...update.gridDims]),
    gridNodeCount: update.gridNodeCount,
    gridShift: update.gridShift
  });
  if (transaction != null && !mechanicsFieldGridUpdateMatchesOrigin(
    update,
    origin,
    {
      sourceProjection,
      fieldExecution,
      ...(transactionMode === 'coarse-terminal'
        ? { terminalTransaction: transaction }
        : { transaction }),
      macroAuthority: transaction.macroAuthority,
      microepochAuthority: transaction.microepochAuthority,
      particleContinuation,
      mutationSegment,
      priorArtifact: sourceProjection,
      requireDeferred: true,
      proposalMode: 'proposal-deferred-to-post-mechanics'
    }
  )) {
    throw new TypeError(
      'submitted mechanics-field grid update does not match its exact fused producer inputs'
    );
  }
  mechanicsFieldGridUpdateOrigins.set(update, origin);
  return update;
}

function activeSourceDenseGridUpdateMatchesOrigin(
  device,
  gridUpdate,
  origin,
  {
    sourceProjection = null,
    schroederSpatialEpochGeneration = null,
    selectedLevel = null,
    updatedGridBuffer = null,
    revalidateSourceProjection = false
  } = {}
) {
  if (!origin || origin.deviceId !== webGpuDeviceId(device)) return false;
  const submittedUpdate = origin.update;
  const suppliedUpdate = gridUpdate === submittedUpdate
    ? submittedUpdate
    : gridUpdate?.gpuResult === submittedUpdate
      ? gridUpdate
      : null;
  const resolvedUpdatedGridBuffer =
    updatedGridBuffer
    ?? submittedUpdate?.updatedGridBuffer
    ?? null;
  const rawMatches = Boolean(
    suppliedUpdate
    && submittedUpdate?.schema === ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA
    && submittedUpdate?.backend === 'webgpu'
    && submittedUpdate?.status === 'updated'
    && submittedUpdate?.sourceProjection === origin.sourceProjection
    && submittedUpdate?.gridStateAuthority
      === 'dense-mls-mpm-grid-state-v2-active-source-product-aware'
    && submittedUpdate?.denseGridAuthoritative === true
    && submittedUpdate?.activeSourceDenseCompatibilityEnabled === true
    && submittedUpdate?.activeSourceDenseCompatibilityScope
      === 'single-level-exact-query'
    && submittedUpdate?.activeSourceDenseCompatibilityPreflight
      === 'gpu-one-workgroup-before-particle-and-product-scatter'
    && submittedUpdate?.readbackMode === NO_FULL_READBACK_MODE
    && submittedUpdate?.fullReadbackPerformed === false
    && submittedUpdate?.gridNodeCount === origin.gridNodeCount
    && submittedUpdate?.gridShift === origin.gridShift
    && submittedUpdate?.gridSpacingM === origin.gridSpacingM
    && submittedUpdate?.dt === origin.dt
    && exactArrayMatches(submittedUpdate?.gridDims, origin.gridDims)
    && resolvedUpdatedGridBuffer === origin.updatedGridBuffer
    && origin.updatedGridBuffer?.destroyed !== true
    && webGpuBufferMatchesDevice(origin.updatedGridBuffer, device)
    && (
      sourceProjection == null
      || sourceProjection === origin.sourceProjection
    )
    && (
      selectedLevel == null
      || selectedLevel === origin.selectedLevel
    )
    && (
      revalidateSourceProjection !== true
      || validateLocallySubmittedMlsMpmActiveSourceDenseP2g(
        device,
        origin.sourceProjection,
        {
          schroederSpatialEpochGeneration,
          selectedLevel: origin.selectedLevel,
          gridBuffer: origin.sourceGridBuffer,
          requireNoFullReadback: true
        }
      )
    )
  );
  if (!rawMatches || suppliedUpdate === submittedUpdate) return rawMatches;
  return Boolean(
    suppliedUpdate?.schema === ULG_MLS_MPM_GPU_GRID_UPDATE_EXECUTION_SCHEMA
    && suppliedUpdate?.backend === submittedUpdate.backend
    && suppliedUpdate?.status === submittedUpdate.status
    && suppliedUpdate?.sourceProjection === origin.sourceProjection
    && suppliedUpdate?.gridStateAuthority
      === submittedUpdate.gridStateAuthority
    && suppliedUpdate?.denseGridAuthoritative
      === submittedUpdate.denseGridAuthoritative
    && suppliedUpdate?.activeSourceDenseCompatibilityEnabled === true
    && suppliedUpdate?.activeSourceDenseCompatibilityScope
      === submittedUpdate.activeSourceDenseCompatibilityScope
    && suppliedUpdate?.activeSourceDenseCompatibilityPreflight
      === submittedUpdate.activeSourceDenseCompatibilityPreflight
    && suppliedUpdate?.readbackMode === submittedUpdate.readbackMode
    && suppliedUpdate?.fullReadbackPerformed
      === submittedUpdate.fullReadbackPerformed
  );
}

function registerSubmittedActiveSourceDenseGridUpdate(
  device,
  update,
  {
    sourceProjection,
    sourceGridBuffer,
    updatedGridBuffer
  }
) {
  const origin = Object.freeze({
    deviceId: webGpuDeviceId(device),
    update,
    sourceProjection,
    sourceGridBuffer,
    updatedGridBuffer,
    selectedLevel:
      sourceProjection?.schroederLevelFilter?.selectedLevel ?? null,
    gridSpacingM: update.gridSpacingM,
    gridDims: Object.freeze([...update.gridDims]),
    gridNodeCount: update.gridNodeCount,
    gridShift: update.gridShift,
    dt: update.dt
  });
  if (!activeSourceDenseGridUpdateMatchesOrigin(
    device,
    update,
    origin,
    {
      sourceProjection,
      selectedLevel: origin.selectedLevel,
      updatedGridBuffer,
      revalidateSourceProjection: true
    }
  )) {
    throw new TypeError(
      'submitted ActiveSource-v2 dense grid update does not match its exact P2G producer'
    );
  }
  activeSourceDenseGridUpdateOrigins.set(update, origin);
  return update;
}

export function validateLocallySubmittedMlsMpmActiveSourceDenseGridUpdate(
  device,
  gridUpdate,
  options = {}
) {
  const submittedUpdate = activeSourceDenseGridUpdateOrigins.has(gridUpdate)
    ? gridUpdate
    : gridUpdate?.gpuResult ?? null;
  return activeSourceDenseGridUpdateMatchesOrigin(
    device,
    gridUpdate,
    activeSourceDenseGridUpdateOrigins.get(submittedUpdate),
    options
  );
}

export function mlsMpmWallBarrierContactResponse({
  gapM = 0,
  normalVelocityMPerS = 0,
  nodeMassKg = 0,
  dtSeconds = 0,
  elasticNormalStiffnessNPerM = DEFAULT_WALL_BARRIER_ELASTIC_STIFFNESS_N_PER_M,
  minGapM = DEFAULT_WALL_BARRIER_MIN_GAP_M,
  stiffnessScale = DEFAULT_WALL_BARRIER_CONTACT_SCALE
} = {}) {
  const mass = Math.max(0, finiteNumber(nodeMassKg, 0));
  const dt = Math.max(0, finiteNumber(dtSeconds, 0));
  const gap = Math.max(0, finiteNumber(gapM, 0));
  const minGap = Math.max(1e-12, Math.abs(finiteNumber(minGapM, DEFAULT_WALL_BARRIER_MIN_GAP_M)));
  const effectiveGap = Math.max(gap, minGap);
  const velocity = finiteNumber(normalVelocityMPerS, 0);
  const elasticStiffness = Math.max(0, finiteNumber(elasticNormalStiffnessNPerM, 0));
  const barrierStiffness = mass > 0 ? mass / (effectiveGap * effectiveGap) : 0;
  const normalStiffness = Math.max(0, barrierStiffness + elasticStiffness);
  const stiffnessRatio = mass > 0 && dt > 0
    ? (normalStiffness * dt * dt) / mass
    : 0;
  const responseAlpha = clamp01((stiffnessRatio / (1 + stiffnessRatio)) * clamp01(stiffnessScale));
  const inwardVelocityMPerS = Math.max(0, -velocity);
  const velocityCorrectionMPerS = inwardVelocityMPerS * responseAlpha;
  let correctedNormalVelocityMPerS = velocity + velocityCorrectionMPerS;
  if (responseAlpha >= 1 - 1e-6 && correctedNormalVelocityMPerS < 1e-6 && velocity < 0) {
    correctedNormalVelocityMPerS = 0;
  }
  return {
    schema: ULG_MLS_MPM_WALL_BARRIER_CONTACT_SCHEMA,
    status: responseAlpha > 0 ? 'wall-barrier-contact-response-ready' : 'wall-barrier-contact-response-inactive',
    mode: 'cubic-barrier-dynamic-grid-wall-response',
    gapM: gap,
    effectiveGapM: effectiveGap,
    nodeMassKg: mass,
    dtSeconds: dt,
    barrierNormalStiffness: barrierStiffness,
    elasticNormalStiffnessNPerM: elasticStiffness,
    normalStiffness,
    stiffnessRatio,
    stiffnessScale: clamp01(stiffnessScale),
    responseAlpha,
    inwardVelocityMPerS,
    velocityCorrectionMPerS,
    normalVelocityMPerS: velocity,
    correctedNormalVelocityMPerS,
    contactActive: responseAlpha > 0 && (inwardVelocityMPerS > 0 || gap <= minGap)
  };
}

export function estimateMlsMpmWallBarrierElasticStiffness({
  bulkModulusPa = 0,
  shearModulusPa = 0,
  supportLengthM = 0
} = {}) {
  const bulk = Math.max(0, finiteNumber(bulkModulusPa, 0));
  const shear = Math.max(0, finiteNumber(shearModulusPa, 0));
  const supportLength = Math.max(0, finiteNumber(supportLengthM, 0));
  const elasticityInclusiveNormalModulusPa = Math.max(0, bulk + (4 / 3) * shear);
  const elasticNormalStiffnessNPerM = elasticityInclusiveNormalModulusPa * supportLength;
  return {
    schema: ULG_MLS_MPM_WALL_BARRIER_CONTACT_SCHEMA,
    status: elasticNormalStiffnessNPerM > 0
      ? 'wall-barrier-elastic-stiffness-estimated'
      : 'wall-barrier-elastic-stiffness-unavailable',
    mode: 'elasticity-inclusive-dynamic-stiffness-estimate',
    bulkModulusPa: bulk,
    shearModulusPa: shear,
    supportLengthM: supportLength,
    elasticityInclusiveNormalModulusPa,
    elasticNormalStiffnessNPerM
  };
}

function representativeAlgorithmContactRow(algorithmMaterialContactRows = null) {
  if (algorithmMaterialContactRows?.schema !== ULG_ALGORITHM_CONTACT_MATERIAL_ROWS_SCHEMA) return null;
  const rows = Array.isArray(algorithmMaterialContactRows.rows) ? algorithmMaterialContactRows.rows : [];
  return rows.find((row) => finiteNumber(row?.normalStiffnessPa, 0) > 0) || null;
}

export function resolveWallBarrierContactMaterialPolicy({
  algorithmMaterialContactRows = null,
  supportLengthM = 0,
  wallBarrierElasticStiffnessNPerM = DEFAULT_WALL_BARRIER_ELASTIC_STIFFNESS_N_PER_M,
  wallBarrierMaterialBulkModulusPa = 0,
  wallBarrierMaterialShearModulusPa = 0
} = {}) {
  const explicit = Math.max(0, finiteNumber(wallBarrierElasticStiffnessNPerM, 0));
  const bulk = Math.max(0, finiteNumber(wallBarrierMaterialBulkModulusPa, 0));
  const shear = Math.max(0, finiteNumber(wallBarrierMaterialShearModulusPa, 0));
  const supportLength = Math.max(0, finiteNumber(supportLengthM, 0));
  if (explicit > 0 || bulk > 0 || shear > 0) {
    return {
      schema: 'peercompute.ulg.mls-mpm-wall-barrier-contact-material-policy.v0',
      status: explicit > 0
        ? 'wall-barrier-contact-material-policy-explicit-stiffness'
        : 'wall-barrier-contact-material-policy-explicit-modulus',
      source: explicit > 0 ? 'explicit-normal-stiffness' : 'explicit-bulk-shear-modulus',
      algorithmContactRowsSchema: algorithmMaterialContactRows?.schema ?? null,
      algorithmContactRowStatus: null,
      algorithmContactPairKey: null,
      algorithmContactMaterials: [],
      algorithmContactPhases: [],
      algorithmContactNormalStiffnessPa: 0,
      wallBarrierElasticStiffnessNPerM: explicit,
      wallBarrierMaterialBulkModulusPa: bulk,
      wallBarrierMaterialShearModulusPa: shear,
      supportLengthM: supportLength
    };
  }
  const contactRow = representativeAlgorithmContactRow(algorithmMaterialContactRows);
  const normalStiffnessPa = Math.max(0, finiteNumber(contactRow?.normalStiffnessPa, 0));
  return {
    schema: 'peercompute.ulg.mls-mpm-wall-barrier-contact-material-policy.v0',
    status: contactRow
      ? 'wall-barrier-contact-material-policy-algorithm-contact-row'
      : 'wall-barrier-contact-material-policy-unavailable',
    source: contactRow ? 'algorithm-contact-row-normal-stiffness-support' : 'unavailable-zero',
    algorithmContactRowsSchema: algorithmMaterialContactRows?.schema ?? null,
    algorithmContactRowStatus: contactRow?.status ?? null,
    algorithmContactPairKey: contactRow?.pairKey ?? null,
    algorithmContactMaterials: Array.isArray(contactRow?.materials) ? [...contactRow.materials] : [],
    algorithmContactPhases: Array.isArray(contactRow?.phases) ? [...contactRow.phases] : [],
    algorithmContactNormalStiffnessPa: normalStiffnessPa,
    wallBarrierElasticStiffnessNPerM: normalStiffnessPa * supportLength,
    wallBarrierMaterialBulkModulusPa: normalStiffnessPa,
    wallBarrierMaterialShearModulusPa: 0,
    supportLengthM: supportLength
  };
}

function resolveWallBarrierElasticStiffness({
  wallBarrierElasticStiffnessNPerM,
  wallBarrierMaterialBulkModulusPa,
  wallBarrierMaterialShearModulusPa,
  supportLengthM,
  algorithmMaterialContactRows
}) {
  const materialPolicy = resolveWallBarrierContactMaterialPolicy({
    algorithmMaterialContactRows,
    supportLengthM,
    wallBarrierElasticStiffnessNPerM,
    wallBarrierMaterialBulkModulusPa,
    wallBarrierMaterialShearModulusPa
  });
  if (materialPolicy.source === 'algorithm-contact-row-normal-stiffness-support') {
    return {
      schema: ULG_MLS_MPM_WALL_BARRIER_CONTACT_SCHEMA,
      status: 'wall-barrier-elastic-stiffness-from-algorithm-contact-row',
      source: materialPolicy.source,
      bulkModulusPa: materialPolicy.wallBarrierMaterialBulkModulusPa,
      shearModulusPa: materialPolicy.wallBarrierMaterialShearModulusPa,
      supportLengthM: materialPolicy.supportLengthM,
      elasticNormalStiffnessNPerM: materialPolicy.wallBarrierElasticStiffnessNPerM,
      materialPolicy
    };
  }
  const explicit = Math.max(0, finiteNumber(wallBarrierElasticStiffnessNPerM, 0));
  if (explicit > 0) {
    return {
      schema: ULG_MLS_MPM_WALL_BARRIER_CONTACT_SCHEMA,
      status: 'wall-barrier-elastic-stiffness-explicit',
      source: 'explicit-normal-stiffness',
      bulkModulusPa: Math.max(0, finiteNumber(wallBarrierMaterialBulkModulusPa, 0)),
      shearModulusPa: Math.max(0, finiteNumber(wallBarrierMaterialShearModulusPa, 0)),
      supportLengthM: Math.max(0, finiteNumber(supportLengthM, 0)),
      elasticNormalStiffnessNPerM: explicit,
      materialPolicy
    };
  }
  const estimated = estimateMlsMpmWallBarrierElasticStiffness({
    bulkModulusPa: wallBarrierMaterialBulkModulusPa,
    shearModulusPa: wallBarrierMaterialShearModulusPa,
    supportLengthM
  });
  return {
    ...estimated,
    source: estimated.elasticNormalStiffnessNPerM > 0
      ? 'bulk-shear-modulus-grid-support'
      : 'unavailable-zero',
    materialPolicy
  };
}

function createWallBarrierContactSummary({
  status,
  wallBarrierElasticStiffnessNPerM,
  wallBarrierContactScale,
  wallBarrierMinGapM,
  elasticStiffnessSource = null,
  materialPolicy = null,
  bulkModulusPa = 0,
  shearModulusPa = 0,
  supportLengthM = 0
}) {
  return {
    schema: ULG_MLS_MPM_WALL_BARRIER_CONTACT_SCHEMA,
    status,
    mode: 'cubic-barrier-dynamic-grid-wall-response',
    wallBarrierElasticStiffnessNPerM,
    wallBarrierElasticStiffnessSource: elasticStiffnessSource,
    wallBarrierContactMaterialPolicySchema: materialPolicy?.schema ?? null,
    wallBarrierContactMaterialPolicyStatus: materialPolicy?.status ?? null,
    wallBarrierContactMaterialPolicySource: materialPolicy?.source ?? null,
    wallBarrierContactAlgorithmRowsSchema: materialPolicy?.algorithmContactRowsSchema ?? null,
    wallBarrierContactAlgorithmRowStatus: materialPolicy?.algorithmContactRowStatus ?? null,
    wallBarrierContactAlgorithmPairKey: materialPolicy?.algorithmContactPairKey ?? null,
    wallBarrierContactAlgorithmMaterials: materialPolicy?.algorithmContactMaterials ?? [],
    wallBarrierContactAlgorithmPhases: materialPolicy?.algorithmContactPhases ?? [],
    wallBarrierContactAlgorithmNormalStiffnessPa: materialPolicy?.algorithmContactNormalStiffnessPa ?? 0,
    wallBarrierBulkModulusPa: bulkModulusPa,
    wallBarrierShearModulusPa: shearModulusPa,
    wallBarrierSupportLengthM: supportLengthM,
    wallBarrierContactScale,
    wallBarrierMinGapM,
    contactNodeCount: 0,
    maxResponseAlpha: 0,
    maxNormalStiffness: 0,
    totalVelocityCorrectionMPerS: 0,
    maxVelocityCorrectionMPerS: 0
  };
}

function recordWallBarrierContact(summary, response) {
  if (!summary || !response?.contactActive) return;
  summary.contactNodeCount += 1;
  summary.maxResponseAlpha = Math.max(summary.maxResponseAlpha, response.responseAlpha);
  summary.maxNormalStiffness = Math.max(summary.maxNormalStiffness, response.normalStiffness);
  summary.totalVelocityCorrectionMPerS += response.velocityCorrectionMPerS;
  summary.maxVelocityCorrectionMPerS = Math.max(
    summary.maxVelocityCorrectionMPerS,
    response.velocityCorrectionMPerS
  );
}

function quadraticWeights(fx) {
  const a = 1.5 - fx;
  const b = fx - 1;
  const c = fx - 0.5;
  return [0.5 * a * a, 0.75 - b * b, 0.5 * c * c];
}

function assertP2gGridProjection(p2gGridProjection, { requireGridNodes = true } = {}) {
  const projectionSchema = p2gGridProjection?.projectionSchema || p2gGridProjection?.schema;
  if (
    p2gGridProjection?.schema !== ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA
    && p2gGridProjection?.schema !== ULG_MLS_MPM_GPU_GRID_PROJECTION_EXECUTION_SCHEMA
    && projectionSchema !== ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA
  ) {
    throw new TypeError('MLS-MPM grid update requires a P2G grid projection artifact');
  }
  if (requireGridNodes && !(p2gGridProjection.gridNodes instanceof Float32Array)) {
    throw new TypeError('MLS-MPM grid update requires Float32Array gridNodes');
  }
  if (p2gGridProjection.gridNodeStrideFloats !== MLS_MPM_GPU_GRID_NODE_FLOATS) {
    throw new RangeError('MLS-MPM grid update requires the packed P2G grid node stride');
  }
}

function outputEnvelope({
  backend,
  p2gGridProjection,
  updatedGridNodes,
  dt,
  gravityMPerS2,
  boxDimsM,
  cflFactor,
  pressureInterfaceForceSolver = null,
  pressureInterfaceForceApplication = null,
  wallBarrierContact = null,
  readbackMode = FULL_READBACK_MODE,
  queueCompletionStatus = null,
  queueCompletionMethod = null,
  readbackTelemetry = createGpuReadbackTelemetry({
    scope: 'mls-mpm-grid-update',
    complete: false,
    unknownSources: ['unclassified-grid-update-backend']
  })
}) {
  const noFullReadback = readbackMode === NO_FULL_READBACK_MODE;
  return {
    schema: ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
    backend,
    status: 'updated',
    kernelScope: GRID_UPDATE_SCOPE,
    sourceSchema: p2gGridProjection.schema,
    sourceProjectionSchema: p2gGridProjection.projectionSchema || p2gGridProjection.schema,
    sourceBackend: p2gGridProjection.backend,
    particleCount: p2gGridProjection.particleCount ?? 0,
    gridSpacingM: p2gGridProjection.gridSpacingM ?? 0,
    gridDims: [...(p2gGridProjection.gridDims ?? [])],
    gridNodeCount: p2gGridProjection.gridNodeCount ?? 0,
    gridShift: p2gGridProjection.gridShift ?? 1,
    dt,
    gravityMPerS2: [...gravityMPerS2],
    boxDimsM: [...boxDimsM],
    cflFactor,
    pressureInterfaceForceSolverSchema: pressureInterfaceForceSolver?.schema ?? null,
    pressureInterfaceForceSolverStatus: pressureInterfaceForceSolver?.status ?? null,
    pressureInterfaceForceCouplingStatus: pressureInterfaceForceSolver?.forceCouplingStatus ?? null,
    pressureInterfaceForceApplicationStatus: pressureInterfaceForceApplication?.status ?? 'not-applied',
    pressureInterfaceGridForceAdmissionSchema: pressureInterfaceForceApplication?.gridForceAdmissionSchema ?? null,
    pressureInterfaceGridForceAdmissionStatus: pressureInterfaceForceApplication?.gridForceAdmissionStatus ?? null,
    pressureInterfaceGridForceAdmissionApproved: pressureInterfaceForceApplication?.gridForceAdmissionApproved ?? false,
    pressureInterfaceGridForceAdmissionDescriptorStatus: pressureInterfaceForceApplication?.gridForceAdmissionDescriptorStatus ?? null,
    pressureInterfaceGridForceAdmissionSourceHotBufferKey: pressureInterfaceForceApplication?.gridForceAdmissionSourceHotBufferKey ?? null,
    pressureInterfaceForceRowCount: pressureInterfaceForceApplication?.forceRowCount ?? 0,
    pressureInterfaceForceRowsSource: pressureInterfaceForceApplication?.forceRowsSource ?? null,
    pressureInterfaceForceRowsBufferSubmitted: pressureInterfaceForceApplication?.forceRowsBufferSubmitted === true,
    pressureInterfaceAppliedImpulseKnown: pressureInterfaceForceApplication?.appliedImpulseKnown ?? null,
    pressureInterfaceAppliedImpulseNSeconds: pressureInterfaceForceApplication?.appliedImpulseNSeconds ?? [0, 0, 0],
    pressureInterfaceAppliedImpulseMagnitudeNSeconds: pressureInterfaceForceApplication?.appliedImpulseMagnitudeNSeconds ?? 0,
    pressureInterfaceAppliedImpulseSource: pressureInterfaceForceApplication?.appliedImpulseSource ?? null,
    pressureInterfaceImpulseProofStatus: pressureInterfaceForceApplication?.impulseProofStatus ?? null,
    pressureInterfaceForceConsumerStatus: pressureInterfaceForceApplication?.consumerStatus ?? null,
    wallBarrierContactSchema: wallBarrierContact?.schema ?? ULG_MLS_MPM_WALL_BARRIER_CONTACT_SCHEMA,
    wallBarrierContactStatus: wallBarrierContact?.status ?? 'wall-barrier-contact-not-measured',
    wallBarrierContactMode: wallBarrierContact?.mode ?? 'cubic-barrier-dynamic-grid-wall-response',
    wallBarrierElasticStiffnessNPerM: wallBarrierContact?.wallBarrierElasticStiffnessNPerM
      ?? DEFAULT_WALL_BARRIER_ELASTIC_STIFFNESS_N_PER_M,
    wallBarrierElasticStiffnessSource: wallBarrierContact?.wallBarrierElasticStiffnessSource ?? null,
    wallBarrierContactMaterialPolicySchema: wallBarrierContact?.wallBarrierContactMaterialPolicySchema ?? null,
    wallBarrierContactMaterialPolicyStatus: wallBarrierContact?.wallBarrierContactMaterialPolicyStatus ?? null,
    wallBarrierContactMaterialPolicySource: wallBarrierContact?.wallBarrierContactMaterialPolicySource ?? null,
    wallBarrierContactAlgorithmRowsSchema: wallBarrierContact?.wallBarrierContactAlgorithmRowsSchema ?? null,
    wallBarrierContactAlgorithmRowStatus: wallBarrierContact?.wallBarrierContactAlgorithmRowStatus ?? null,
    wallBarrierContactAlgorithmPairKey: wallBarrierContact?.wallBarrierContactAlgorithmPairKey ?? null,
    wallBarrierContactAlgorithmMaterials: wallBarrierContact?.wallBarrierContactAlgorithmMaterials ?? [],
    wallBarrierContactAlgorithmPhases: wallBarrierContact?.wallBarrierContactAlgorithmPhases ?? [],
    wallBarrierContactAlgorithmNormalStiffnessPa:
      wallBarrierContact?.wallBarrierContactAlgorithmNormalStiffnessPa ?? 0,
    wallBarrierBulkModulusPa: wallBarrierContact?.wallBarrierBulkModulusPa ?? 0,
    wallBarrierShearModulusPa: wallBarrierContact?.wallBarrierShearModulusPa ?? 0,
    wallBarrierSupportLengthM: wallBarrierContact?.wallBarrierSupportLengthM ?? 0,
    wallBarrierContactScale: wallBarrierContact?.wallBarrierContactScale ?? DEFAULT_WALL_BARRIER_CONTACT_SCALE,
    wallBarrierMinGapM: wallBarrierContact?.wallBarrierMinGapM ?? DEFAULT_WALL_BARRIER_MIN_GAP_M,
    wallBarrierContactNodeCount: wallBarrierContact?.contactNodeCount ?? 0,
    wallBarrierContactMaxResponseAlpha: wallBarrierContact?.maxResponseAlpha ?? 0,
    wallBarrierContactMaxNormalStiffness: wallBarrierContact?.maxNormalStiffness ?? 0,
    wallBarrierContactTotalVelocityCorrectionMPerS: wallBarrierContact?.totalVelocityCorrectionMPerS ?? 0,
    wallBarrierContactMaxVelocityCorrectionMPerS: wallBarrierContact?.maxVelocityCorrectionMPerS ?? 0,
    sourceGridNodeLayout: [...MLS_MPM_GPU_GRID_NODE_ROW_LAYOUT],
    gridNodeLayout: [...MLS_MPM_GPU_GRID_VELOCITY_ROW_LAYOUT],
    gridNodeStrideFloats: MLS_MPM_GPU_GRID_VELOCITY_FLOATS,
    gridNodeStrideBytes: MLS_MPM_GPU_GRID_VELOCITY_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    updatedGridNodes,
    readbackMode,
    queueCompletionStatus,
    queueCompletionMethod,
    fullReadbackPerformed: !noFullReadback,
    fullParticleReadbackPerformed: !noFullReadback,
    fullParticleReadbackFree: noFullReadback,
    ...readbackTelemetry,
    mechanicsFieldMode:
      p2gGridProjection.mechanicsFieldMode
        ?? MLS_MPM_MECHANICS_FIELD_MODE_DISABLED,
    mechanicsFieldViewEnabled:
      p2gGridProjection.mechanicsFieldViewEnabled === true,
    mechanicsFieldViewExecution:
      p2gGridProjection.mechanicsFieldViewExecution ?? null,
    mechanicsFieldViewBuffer:
      p2gGridProjection.mechanicsFieldViewBuffer
        ?? p2gGridProjection.mechanicsFieldView
        ?? null,
    mechanicsFieldViewByteLength:
      p2gGridProjection.mechanicsFieldViewByteLength ?? 0,
    mechanicsFieldViewOwned: false,
    gridStateAuthority:
      p2gGridProjection.gridStateAuthority ?? 'dense-mls-mpm-grid-state',
    denseGridAuthoritative:
      p2gGridProjection.denseGridAuthoritative !== false,
    fieldStateUpdatedInPlace: false,
    fieldStateUpdateSubmittedInPlace: false,
    p2gProjectionValidation: false,
    stressProjectionValidation: false,
    gridUpdateValidation: false,
    gridValidation: false,
    g2pValidation: false,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function pressureForceRowsFromSolver(pressureInterfaceForceSolver) {
  if (
    pressureInterfaceForceSolver?.forceRowValues instanceof Float32Array
    && pressureInterfaceForceSolver.forceRowValues.length >= SPH_PRESSURE_INTERFACE_FORCE_FLOATS
  ) {
    return pressureInterfaceForceSolver.forceRowValues;
  }
  if (
    pressureInterfaceForceSolver?.forceRows instanceof Float32Array
    && pressureInterfaceForceSolver.forceRows.length >= SPH_PRESSURE_INTERFACE_FORCE_FLOATS
  ) {
    return pressureInterfaceForceSolver.forceRows;
  }
  return null;
}

function pressureForceRowCountFromSolver(pressureInterfaceForceSolver, rows) {
  const explicit = Math.max(0, Math.round(finiteNumber(pressureInterfaceForceSolver?.forceRowCount, 0)));
  if (rows instanceof Float32Array) {
    const fromRows = Math.floor(rows.length / SPH_PRESSURE_INTERFACE_FORCE_FLOATS);
    return explicit > 0 ? Math.min(explicit, fromRows) : fromRows;
  }
  return explicit;
}

export function pressureInterfaceForceSolverFingerprint(pressureInterfaceForceSolver = null) {
  const rows = pressureForceRowsFromSolver(pressureInterfaceForceSolver);
  const forceRowCount = pressureForceRowCountFromSolver(pressureInterfaceForceSolver, rows);
  if (
    pressureInterfaceForceSolver?.status !== 'pressure-interface-force-solver-ready'
    || !(rows instanceof Float32Array)
    || forceRowCount <= 0
  ) return null;
  return [
    pressureInterfaceForceSolver.schema ?? null,
    pressureInterfaceForceSolver.status,
    forceRowCount,
    pressureInterfaceForceSolver.forceRowStrideFloats ?? SPH_PRESSURE_INTERFACE_FORCE_FLOATS,
    typedArrayContentFingerprint(rows)
  ].join('|');
}

function strictReactionGateFingerprint(gate = null) {
  if (!strictReactionGateAllowsForceCoupling(gate)) return null;
  return JSON.stringify({
    schema: gate.schema,
    status: gate.status,
    strictForceCouplingAllowed: gate.strictForceCouplingAllowed,
    readbackMode: gate.readbackMode ?? null,
    compactSummaryStatus: gate.compactSummaryStatus ?? null,
    atomResidualStatus: gate.atomResidualStatus ?? null,
    maxAbsAtomResidualMol: gate.maxAbsAtomResidualMol ?? null,
    chargeResidualMol: gate.chargeResidualMol ?? null,
    blockers: [...(gate.blockers || [])],
    provisionalEnergetics: (gate.provisionalEnergetics || []).map((row) => ({ ...row }))
  });
}

export function createDirectResidentPressureInterfaceGridForceAdmission({
  pressureInterfaceForceSolver = null,
  strictReactionGate = null,
  producerDeviceId = null,
  residentComputeManagerMode = 'direct'
} = {}) {
  const rows = pressureForceRowsFromSolver(pressureInterfaceForceSolver);
  const forceRowCount = pressureForceRowCountFromSolver(pressureInterfaceForceSolver, rows);
  const solverFingerprint = pressureInterfaceForceSolverFingerprint(pressureInterfaceForceSolver);
  const gateFingerprint = strictReactionGateFingerprint(strictReactionGate);
  if (
    residentComputeManagerMode !== 'direct'
    || pressureInterfaceForceSolver?.status !== 'pressure-interface-force-solver-ready'
    || !(rows instanceof Float32Array)
    || forceRowCount <= 0
    || !solverFingerprint
    || !gateFingerprint
    || !String(producerDeviceId || '').trim()
  ) return null;
  const strictReactionGateEvidence = {
    ...strictReactionGate,
    blockers: [...(strictReactionGate.blockers || [])],
    warnings: [...(strictReactionGate.warnings || [])],
    provisionalEnergetics: (strictReactionGate.provisionalEnergetics || [])
      .map((row) => ({ ...row }))
  };
  const publication = {
    schema: ULG_DIRECT_RESIDENT_PRESSURE_INTERFACE_PUBLICATION_SCHEMA,
    status: ULG_DIRECT_RESIDENT_PRESSURE_INTERFACE_PUBLICATION_STATUS,
    authority: ULG_DIRECT_RESIDENT_PRESSURE_INTERFACE_AUTHORITY,
    residentComputeManagerMode: 'direct',
    computeManagerOwned: false,
    stateManagerCommitted: false,
    sameDeviceQueueOrdered: true,
    producerDeviceId,
    sourceKey: solverFingerprint,
    pressureInterfaceForceSolverFingerprint: solverFingerprint,
    strictReactionGate: strictReactionGateEvidence,
    strictReactionGateFingerprint: gateFingerprint,
    pressureInterfaceForceRowCount: forceRowCount,
    outputFamilies: ['pressure-interface-force-rows'],
    scientificValidation: false,
    sphValidation: false,
    fullPhysicsValidation: false
  };
  return {
    schema: ULG_PRESSURE_INTERFACE_GRID_FORCE_CONSUMPTION_ADMISSION_SCHEMA,
    status: 'pressure-interface-grid-force-consumption-approved',
    gridForceApplicationApproved: true,
    committed: false,
    publicationStatus: publication.status,
    authority: publication.authority,
    residentComputeManagerMode: 'direct',
    computeManagerOwned: false,
    stateManagerCommitted: false,
    sameDeviceQueueOrdered: true,
    producerDeviceId,
    sourceKey: publication.sourceKey,
    pressureInterfaceForceSolverFingerprint: solverFingerprint,
    strictReactionGate: { ...strictReactionGateEvidence },
    strictReactionGateFingerprint: gateFingerprint,
    pressureInterfaceForceRowCount: forceRowCount,
    outputFamilies: [...publication.outputFamilies],
    pressureInterfacePublication: publication
  };
}

export function pressureInterfaceForceSolverAllowsGridApplication(pressureInterfaceForceSolver) {
  if (!pressureInterfaceForceSolver) return false;
  return pressureInterfaceForceSolver.gridForceApplicationApproved === true
    && PRESSURE_INTERFACE_GRID_APPLICATION_STATUSES.has(
      pressureInterfaceForceSolver.forceApplicationStatus
    );
}

function pressureInterfaceGridForceAdmissionDescriptor(admission = null) {
  if (!admission || typeof admission !== 'object') return null;
  return admission.pressureInterfacePublication
    || admission.admittedPressureInterfacePublication
    || admission.publication
    || admission.descriptor
    || admission;
}

export function pressureInterfaceGridForceAdmissionAllowsApplication({
  pressureInterfaceGridForceAdmission = null,
  pressureInterfaceForceSolver = null,
  forceRowCount = 0,
  consumerDeviceId = null
} = {}) {
  const descriptor = pressureInterfaceGridForceAdmissionDescriptor(pressureInterfaceGridForceAdmission);
  const status = pressureInterfaceGridForceAdmission?.status || descriptor?.status || null;
  const descriptorStatus = descriptor?.status
    || pressureInterfaceGridForceAdmission?.publicationStatus
    || pressureInterfaceGridForceAdmission?.admittedStatus
    || status;
  const outputFamilies = Array.isArray(pressureInterfaceGridForceAdmission?.outputFamilies)
    ? pressureInterfaceGridForceAdmission.outputFamilies
    : (Array.isArray(descriptor?.outputFamilies) ? descriptor.outputFamilies : []);
  const admittedForceRowCount = Math.max(
    0,
    Math.round(finiteNumber(
      pressureInterfaceGridForceAdmission?.pressureInterfaceForceRowCount
        ?? descriptor?.pressureInterfaceForceRowCount,
      forceRowCount
    ))
  );
  const solverForceRowCount = Math.max(0, Math.round(finiteNumber(pressureInterfaceForceSolver?.forceRowCount, forceRowCount)));
  const admissionApproved = pressureInterfaceGridForceAdmission?.gridForceApplicationApproved === true;
  const directDescriptor = descriptor?.schema === ULG_DIRECT_RESIDENT_PRESSURE_INTERFACE_PUBLICATION_SCHEMA;
  const directDeviceAccepted = Boolean(consumerDeviceId)
    && descriptor?.producerDeviceId === consumerDeviceId;
  const directDescriptorForceRowCount = Math.max(
    0,
    Math.round(finiteNumber(descriptor?.pressureInterfaceForceRowCount, 0))
  );
  const directRowCountAccepted = directDescriptorForceRowCount >= solverForceRowCount
    && directDescriptorForceRowCount === admittedForceRowCount;
  const currentSolverFingerprint = pressureInterfaceForceSolverFingerprint(
    pressureInterfaceForceSolver
  );
  const directSolverAccepted = Boolean(currentSolverFingerprint)
    && descriptor?.pressureInterfaceForceSolverFingerprint === currentSolverFingerprint
    && pressureInterfaceGridForceAdmission?.pressureInterfaceForceSolverFingerprint
      === currentSolverFingerprint
    && descriptor?.sourceKey === currentSolverFingerprint
    && pressureInterfaceGridForceAdmission?.sourceKey === currentSolverFingerprint;
  const descriptorGateFingerprint = strictReactionGateFingerprint(
    descriptor?.strictReactionGate
  );
  const outerGateFingerprint = strictReactionGateFingerprint(
    pressureInterfaceGridForceAdmission?.strictReactionGate
  );
  const directStrictGateAccepted = Boolean(descriptorGateFingerprint)
    && descriptorGateFingerprint === outerGateFingerprint
    && descriptor?.strictReactionGateFingerprint === descriptorGateFingerprint
    && pressureInterfaceGridForceAdmission?.strictReactionGateFingerprint
      === descriptorGateFingerprint;
  const directOuterAccepted = pressureInterfaceGridForceAdmission?.schema
      === ULG_PRESSURE_INTERFACE_GRID_FORCE_CONSUMPTION_ADMISSION_SCHEMA
    && pressureInterfaceGridForceAdmission?.status
      === 'pressure-interface-grid-force-consumption-approved'
    && pressureInterfaceGridForceAdmission?.authority
      === ULG_DIRECT_RESIDENT_PRESSURE_INTERFACE_AUTHORITY
    && pressureInterfaceGridForceAdmission?.residentComputeManagerMode === 'direct'
    && pressureInterfaceGridForceAdmission?.computeManagerOwned === false
    && pressureInterfaceGridForceAdmission?.stateManagerCommitted === false
    && pressureInterfaceGridForceAdmission?.sameDeviceQueueOrdered === true;
  const directDescriptorAdmitted = directDescriptor
    && descriptorStatus === ULG_DIRECT_RESIDENT_PRESSURE_INTERFACE_PUBLICATION_STATUS
    && descriptor?.authority === ULG_DIRECT_RESIDENT_PRESSURE_INTERFACE_AUTHORITY
    && descriptor?.residentComputeManagerMode === 'direct'
    && descriptor?.computeManagerOwned === false
    && descriptor?.stateManagerCommitted === false
    && descriptor?.sameDeviceQueueOrdered === true
    && pressureInterfaceGridForceAdmission?.sameDeviceQueueOrdered === true
    && pressureInterfaceGridForceAdmission?.producerDeviceId === descriptor?.producerDeviceId
    && directOuterAccepted
    && directDeviceAccepted
    && directRowCountAccepted
    && directSolverAccepted
    && directStrictGateAccepted;
  const descriptorAdmitted = directDescriptor
    ? directDescriptorAdmitted
    : (PRESSURE_INTERFACE_ADMITTED_DESCRIPTOR_STATUSES.has(descriptorStatus)
      || descriptor?.committed === true
      || pressureInterfaceGridForceAdmission?.committed === true);
  const familyAccepted = outputFamilies.includes('pressure-interface-force-rows');
  const rowCountAccepted = admittedForceRowCount >= solverForceRowCount || solverForceRowCount === 0;
  return {
    schema: ULG_PRESSURE_INTERFACE_GRID_FORCE_CONSUMPTION_ADMISSION_SCHEMA,
    status: admissionApproved && descriptorAdmitted && familyAccepted && rowCountAccepted
      ? 'pressure-interface-grid-force-consumption-approved'
      : 'pressure-interface-grid-force-consumption-blocked',
    approved: admissionApproved && descriptorAdmitted && familyAccepted && rowCountAccepted,
    admissionApproved,
    descriptorAdmitted,
    directDescriptor,
    directDescriptorAdmitted,
    directOuterAccepted,
    directDeviceAccepted,
    directRowCountAccepted,
    directSolverAccepted,
    directStrictGateAccepted,
    descriptorStatus,
    familyAccepted,
    rowCountAccepted,
    forceRowCount: admittedForceRowCount,
    solverForceRowCount,
    sourceHotBufferKey: pressureInterfaceGridForceAdmission?.sourceHotBufferKey
      || pressureInterfaceGridForceAdmission?.hotBufferKey
      || descriptor?.sourceHotBufferKey
      || descriptor?.hotBufferKey
      || null,
    outputFamilies: [...outputFamilies]
  };
}

function pressureInterfaceForceApplicationSummary({
  pressureInterfaceForceSolver = null,
  pressureInterfaceGridForceAdmission = null,
  consumerDeviceId = null,
  forceRowCount = 0,
  forceRowsSource = null,
  forceRowsBufferSubmitted = false,
  appliedImpulseNSeconds = [0, 0, 0],
  appliedImpulseSource = 'grid-node-distributed-impulse',
  impulseProofStatus = 'actual-grid-node-impulse',
  applicationApproved = pressureInterfaceForceSolverAllowsGridApplication(pressureInterfaceForceSolver)
} = {}) {
  const solverReady = pressureInterfaceForceSolver?.status === 'pressure-interface-force-solver-ready';
  const admission = pressureInterfaceGridForceAdmissionAllowsApplication({
    pressureInterfaceGridForceAdmission,
    pressureInterfaceForceSolver,
    forceRowCount,
    consumerDeviceId
  });
  const approvedByAdmission = applicationApproved && admission.approved === true;
  const blockedNotApproved = solverReady && !approvedByAdmission;
  const ready = solverReady && approvedByAdmission && forceRowCount > 0;
  const proven = ready && impulseProofStatus === 'actual-grid-node-impulse';
  return {
    schema: 'peercompute.ulg.mls-mpm-pressure-interface-grid-force-consumer.v0',
    status: blockedNotApproved
      ? 'pressure-interface-grid-force-consumer-blocked-not-approved'
      : (ready
          ? (proven ? 'pressure-interface-grid-force-consumer-applied' : 'pressure-interface-grid-force-consumer-submitted-unverified')
          : 'pressure-interface-grid-force-consumer-blocked'),
    consumerStatus: blockedNotApproved
      ? 'blocked-pressure-force-solver-not-approved-for-grid-application'
      : (ready
          ? (proven ? 'grid-momentum-impulse-consumed' : 'grid-momentum-impulse-submitted-unverified-no-full-readback')
          : 'blocked-pressure-force-rows-unavailable'),
    forceSolverSchema: pressureInterfaceForceSolver?.schema ?? null,
    forceSolverStatus: pressureInterfaceForceSolver?.status ?? null,
    forceSolverApplicationStatus: pressureInterfaceForceSolver?.forceApplicationStatus ?? null,
    applicationApproved: approvedByAdmission,
    solverApplicationApproved: applicationApproved,
    gridForceAdmissionSchema: admission.schema,
    gridForceAdmissionStatus: admission.status,
    gridForceAdmissionApproved: admission.approved,
    gridForceAdmissionDescriptorStatus: admission.descriptorStatus,
    gridForceAdmissionSourceHotBufferKey: admission.sourceHotBufferKey,
    forceRowCount,
    forceRowsSource,
    forceRowsBufferSubmitted,
    appliedImpulseKnown: impulseProofStatus === 'actual-grid-node-impulse',
    appliedImpulseNSeconds: [...appliedImpulseNSeconds],
    appliedImpulseMagnitudeNSeconds: Math.hypot(
      appliedImpulseNSeconds[0],
      appliedImpulseNSeconds[1],
      appliedImpulseNSeconds[2]
    ),
    appliedImpulseSource: blockedNotApproved ? 'not-applied-solver-ready-not-approved' : appliedImpulseSource,
    impulseProofStatus: blockedNotApproved ? 'solver-force-application-status-not-approved' : impulseProofStatus,
    forceApplicationValidation: false,
    scientificValidation: false,
    sphValidation: false,
    fullPhysicsValidation: false
  };
}

function pressureInterfaceImpulseForNode({
  nodePosition,
  gridSpacingM,
  dtSeconds,
  forceRows,
  forceRowCount
}) {
  if (!(forceRows instanceof Float32Array) || !(forceRowCount > 0) || !(gridSpacingM > 0) || !(dtSeconds !== 0)) {
    return [0, 0, 0];
  }
  const nodeI = Math.round(nodePosition[0] / gridSpacingM);
  const nodeJ = Math.round(nodePosition[1] / gridSpacingM);
  const nodeK = Math.round(nodePosition[2] / gridSpacingM);
  const impulse = [0, 0, 0];
  for (let rowIndex = 0; rowIndex < forceRowCount; rowIndex += 1) {
    const offset = rowIndex * SPH_PRESSURE_INTERFACE_FORCE_FLOATS;
    const status = forceRows[offset + 15];
    if (!(status > 0)) continue;
    const pGrid = [
      forceRows[offset + 4] / gridSpacingM,
      forceRows[offset + 5] / gridSpacingM,
      forceRows[offset + 6] / gridSpacingM
    ];
    const base = pGrid.map((value) => Math.floor(value - 0.5));
    const ox = nodeI - base[0];
    const oy = nodeJ - base[1];
    const oz = nodeK - base[2];
    if (ox < 0 || ox > 2 || oy < 0 || oy > 2 || oz < 0 || oz > 2) continue;
    const wx = quadraticWeights(pGrid[0] - base[0]);
    const wy = quadraticWeights(pGrid[1] - base[1]);
    const wz = quadraticWeights(pGrid[2] - base[2]);
    const weight = wx[ox] * wy[oy] * wz[oz];
    impulse[0] += dtSeconds * weight * forceRows[offset + 8];
    impulse[1] += dtSeconds * weight * forceRows[offset + 9];
    impulse[2] += dtSeconds * weight * forceRows[offset + 10];
  }
  return impulse;
}

export function updateMlsMpmGridCpu({
  p2gGridProjection,
  dt = p2gGridProjection?.dt ?? 0,
  gravityMPerS2 = DEFAULT_GRAVITY_M_PER_S2,
  boxDimsM = DEFAULT_BOX_DIMS_M,
  cflFactor = DEFAULT_CFL_FACTOR,
  pressureInterfaceForceSolver = null,
  pressureInterfaceGridForceAdmission = null,
  wallBarrierElasticStiffnessNPerM = DEFAULT_WALL_BARRIER_ELASTIC_STIFFNESS_N_PER_M,
  wallBarrierMaterialBulkModulusPa = 0,
  wallBarrierMaterialShearModulusPa = 0,
  algorithmMaterialContactRows = null,
  wallBarrierContactScale = DEFAULT_WALL_BARRIER_CONTACT_SCALE,
  wallBarrierMinGapM = DEFAULT_WALL_BARRIER_MIN_GAP_M
} = {}) {
  const dtSeconds = finiteNumber(dt, 0);
  const gravity = finiteVector3(gravityMPerS2, DEFAULT_GRAVITY_M_PER_S2);
  const dims = finiteVector3(boxDimsM, DEFAULT_BOX_DIMS_M);
  const cfl = finiteNumber(cflFactor, DEFAULT_CFL_FACTOR);
  const gridSpacingM = finiteNumber(p2gGridProjection.gridSpacingM, 0);
  const boundaryEpsilonM = Math.max(1e-7, Math.abs(gridSpacingM) * 1e-6);
  const floorNoSlipLimitM = gridSpacingM - boundaryEpsilonM;
  const vmax = dtSeconds > 0 ? (cfl * gridSpacingM) / dtSeconds : Number.POSITIVE_INFINITY;
  const vmax2 = vmax * vmax;
  const source = p2gGridProjection.gridNodes;
  const updatedGridNodes = new Float32Array(p2gGridProjection.gridNodeCount * MLS_MPM_GPU_GRID_VELOCITY_FLOATS);
  const pressureForceApplicationApproved = pressureInterfaceForceSolverAllowsGridApplication(pressureInterfaceForceSolver)
    && pressureInterfaceGridForceAdmissionAllowsApplication({
      pressureInterfaceGridForceAdmission,
      pressureInterfaceForceSolver,
      forceRowCount: pressureInterfaceForceSolver?.forceRowCount ?? 0
    }).approved === true;
  const pressureForceRows = pressureForceApplicationApproved
    ? pressureForceRowsFromSolver(pressureInterfaceForceSolver)
    : null;
  const pressureForceRowCount = pressureForceApplicationApproved
    ? pressureForceRowCountFromSolver(pressureInterfaceForceSolver, pressureForceRows)
    : 0;
  const appliedImpulseNSeconds = [0, 0, 0];
  const elasticStiffness = resolveWallBarrierElasticStiffness({
    wallBarrierElasticStiffnessNPerM,
    wallBarrierMaterialBulkModulusPa,
    wallBarrierMaterialShearModulusPa,
    supportLengthM: gridSpacingM,
    algorithmMaterialContactRows
  });
  const wallBarrierContact = createWallBarrierContactSummary({
    status: 'wall-barrier-contact-applied-cpu-reference',
    wallBarrierElasticStiffnessNPerM: elasticStiffness.elasticNormalStiffnessNPerM,
    elasticStiffnessSource: elasticStiffness.source,
    materialPolicy: elasticStiffness.materialPolicy,
    bulkModulusPa: elasticStiffness.bulkModulusPa,
    shearModulusPa: elasticStiffness.shearModulusPa,
    supportLengthM: elasticStiffness.supportLengthM,
    wallBarrierContactScale: clamp01(wallBarrierContactScale),
    wallBarrierMinGapM: Math.max(1e-12, Math.abs(finiteNumber(wallBarrierMinGapM, DEFAULT_WALL_BARRIER_MIN_GAP_M)))
  });

  const applyWallBarrierNormal = ({ velocity, axis, normalSign, gapM, nodeMassKg, dampTangential = false }) => {
    const beforeNormalVelocity = velocity[axis] * normalSign;
    const response = mlsMpmWallBarrierContactResponse({
      gapM,
      normalVelocityMPerS: beforeNormalVelocity,
      nodeMassKg,
      dtSeconds,
      elasticNormalStiffnessNPerM: wallBarrierContact.wallBarrierElasticStiffnessNPerM,
      minGapM: wallBarrierContact.wallBarrierMinGapM,
      stiffnessScale: wallBarrierContact.wallBarrierContactScale
    });
    recordWallBarrierContact(wallBarrierContact, response);
    velocity[axis] = response.correctedNormalVelocityMPerS * normalSign;
    if (dampTangential && response.responseAlpha > 0) {
      const keep = 1 - response.responseAlpha;
      for (let component = 0; component < 3; component += 1) {
        if (component !== axis) velocity[component] *= keep;
      }
      if (response.responseAlpha >= 1 - 1e-6) {
        for (let component = 0; component < 3; component += 1) {
          if (component !== axis) velocity[component] = 0;
        }
      }
    }
  };

  for (let offset = 0; offset < source.length; offset += MLS_MPM_GPU_GRID_NODE_FLOATS) {
    const mass = source[offset];
    const out = offset;
    const nodePosition = [source[offset + 4], source[offset + 5], source[offset + 6]];
    const pressureImpulse = mass > 0
      ? pressureInterfaceImpulseForNode({
        nodePosition,
        gridSpacingM,
        dtSeconds,
        forceRows: pressureForceRows,
        forceRowCount: pressureForceRowCount
      })
      : [0, 0, 0];
    if (mass > 0) {
      appliedImpulseNSeconds[0] += pressureImpulse[0];
      appliedImpulseNSeconds[1] += pressureImpulse[1];
      appliedImpulseNSeconds[2] += pressureImpulse[2];
    }
    let velocity = [0, 0, 0];
    let status = 0;
    if (mass > 0) {
      velocity = [
        (source[offset + 1] + pressureImpulse[0]) / mass + dtSeconds * gravity[0],
        (source[offset + 2] + pressureImpulse[1]) / mass + dtSeconds * gravity[1],
        (source[offset + 3] + pressureImpulse[2]) / mass + dtSeconds * gravity[2]
      ];
      const speed2 = velocity[0] ** 2 + velocity[1] ** 2 + velocity[2] ** 2;
      if (speed2 > vmax2) {
        const scale = vmax / Math.sqrt(speed2);
        velocity = velocity.map((component) => component * scale);
      }
      if (nodePosition[1] < floorNoSlipLimitM) {
        applyWallBarrierNormal({
          velocity,
          axis: 1,
          normalSign: 1,
          nodeMassKg: mass,
          gapM: Math.max(0, nodePosition[1]),
          dampTangential: true
        });
      }
      if (nodePosition[0] <= gridSpacingM + boundaryEpsilonM && velocity[0] < 0) applyWallBarrierNormal({
        velocity,
        axis: 0,
        normalSign: 1,
        nodeMassKg: mass,
        gapM: Math.max(0, nodePosition[0] - gridSpacingM + boundaryEpsilonM)
      });
      if (nodePosition[0] >= dims[0] - gridSpacingM - boundaryEpsilonM && velocity[0] > 0) applyWallBarrierNormal({
        velocity,
        axis: 0,
        normalSign: -1,
        nodeMassKg: mass,
        gapM: Math.max(0, dims[0] - gridSpacingM - nodePosition[0] + boundaryEpsilonM)
      });
      if (nodePosition[1] >= dims[1] - gridSpacingM - boundaryEpsilonM && velocity[1] > 0) applyWallBarrierNormal({
        velocity,
        axis: 1,
        normalSign: -1,
        nodeMassKg: mass,
        gapM: Math.max(0, dims[1] - gridSpacingM - nodePosition[1] + boundaryEpsilonM)
      });
      if (nodePosition[2] <= gridSpacingM + boundaryEpsilonM && velocity[2] < 0) applyWallBarrierNormal({
        velocity,
        axis: 2,
        normalSign: 1,
        nodeMassKg: mass,
        gapM: Math.max(0, nodePosition[2] - gridSpacingM + boundaryEpsilonM)
      });
      if (nodePosition[2] >= dims[2] - gridSpacingM - boundaryEpsilonM && velocity[2] > 0) applyWallBarrierNormal({
        velocity,
        axis: 2,
        normalSign: -1,
        nodeMassKg: mass,
        gapM: Math.max(0, dims[2] - gridSpacingM - nodePosition[2] + boundaryEpsilonM)
      });
      status = 1;
    }
    updatedGridNodes.set([
      mass,
      velocity[0],
      velocity[1],
      velocity[2],
      nodePosition[0],
      nodePosition[1],
      nodePosition[2],
      status
    ], out);
  }

  return outputEnvelope({
    backend: 'cpu-reference',
    p2gGridProjection,
    updatedGridNodes,
    dt: dtSeconds,
    gravityMPerS2: gravity,
    boxDimsM: dims,
    cflFactor: cfl,
    pressureInterfaceForceSolver,
    wallBarrierContact,
    pressureInterfaceForceApplication: pressureInterfaceForceApplicationSummary({
      pressureInterfaceForceSolver,
      pressureInterfaceGridForceAdmission,
      forceRowCount: pressureForceRowCount,
      appliedImpulseNSeconds,
      appliedImpulseSource: 'grid-node-distributed-impulse',
      impulseProofStatus: 'actual-grid-node-impulse',
      applicationApproved: pressureForceApplicationApproved
    })
  });
}

function writeStorageBuffer(device, label, data) {
  const byteLength = Math.max(4, data.byteLength);
  const buffer = device.createBuffer({
    label,
    size: byteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
  });
  if (data.byteLength > 0) device.queue.writeBuffer(buffer, 0, data);
  return buffer;
}

function createGridUpdateParamsArray(options) {
  const buffer = new ArrayBuffer(MLS_MPM_GRID_UPDATE_PARAMS_BYTES);
  return writeGridUpdateParamsArray(buffer, options);
}

function createMechanicsFieldGridUpdateParamsArray(options) {
  const buffer = new ArrayBuffer(
    SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_PARAMS_BYTES
  );
  return writeGridUpdateParamsArray(buffer, options);
}

function writeGridUpdateParamsArray(buffer, {
  p2gGridProjection,
  dt,
  gravityMPerS2,
  boxDimsM,
  cflFactor,
  pressureInterfaceForceRowCount = 0,
  wallBarrierElasticStiffnessNPerM = DEFAULT_WALL_BARRIER_ELASTIC_STIFFNESS_N_PER_M,
  wallBarrierContactScale = DEFAULT_WALL_BARRIER_CONTACT_SCALE,
  wallBarrierMinGapM = DEFAULT_WALL_BARRIER_MIN_GAP_M,
  mechanicsFieldMutation = null,
  mechanicsFieldReceiptModeFlags = null,
  phaseVolumeTransportAuthority = null,
  phaseVolumeSurfaceStressAuthority = null,
  mechanicsMaterialPhaseUpload = null,
  ambientPressurePa = 0,
  ambientReferenceDensityKgPerM3 = 1.2041,
  phaseVolumePressureScale = 1,
  phaseVolumeDragScale = 1,
  phaseVolumeMaxImpulseFraction = 0.5,
  phaseVolumeSurfaceStressEnabled = false
}) {
  const view = new DataView(buffer);
  const gridDims = p2gGridProjection.gridDims ?? [1, 1, 1];
  view.setUint32(0, p2gGridProjection.gridNodeCount ?? 0, true);
  view.setUint32(4, gridDims[0] ?? 1, true);
  view.setUint32(8, gridDims[1] ?? 1, true);
  view.setUint32(12, gridDims[2] ?? 1, true);
  view.setUint32(16, p2gGridProjection.gridShift ?? 1, true);
  view.setUint32(
    20,
    mechanicsFieldReceiptModeFlags == null
      ? pressureInterfaceForceRowCount
      : (Number(mechanicsFieldReceiptModeFlags) >>> 0),
    true
  );
  view.setUint32(24, Math.max(0, Math.round(finiteNumber(
    mechanicsFieldMutation?.expectedOrdinal,
    0
  ))), true);
  view.setUint32(28, Math.max(0, Math.round(finiteNumber(
    mechanicsFieldMutation?.outputOrdinal,
    0
  ))), true);
  view.setFloat32(32, finiteNumber(p2gGridProjection.gridSpacingM, 0), true);
  view.setFloat32(36, dt, true);
  view.setFloat32(40, gravityMPerS2[0], true);
  view.setFloat32(44, gravityMPerS2[1], true);
  view.setFloat32(48, gravityMPerS2[2], true);
  view.setFloat32(52, boxDimsM[0], true);
  view.setFloat32(56, boxDimsM[1], true);
  view.setFloat32(60, boxDimsM[2], true);
  view.setFloat32(64, cflFactor, true);
  view.setFloat32(68, Math.max(0, finiteNumber(wallBarrierElasticStiffnessNPerM, 0)), true);
  view.setFloat32(72, clamp01(wallBarrierContactScale), true);
  view.setFloat32(76, Math.max(1e-12, Math.abs(finiteNumber(wallBarrierMinGapM, DEFAULT_WALL_BARRIER_MIN_GAP_M))), true);
  if (buffer.byteLength === MLS_MPM_GRID_UPDATE_PARAMS_BYTES) return buffer;
  if (
    buffer.byteLength
      !== SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_PARAMS_BYTES
  ) {
    throw new RangeError('mechanics-field grid-update params size is not canonical');
  }
  const transport = phaseVolumeTransportAuthority;
  const mechanicsAuthority =
    transport ?? phaseVolumeSurfaceStressAuthority;
  const proposal = transport?.phaseVolumeInterfaceProposal ?? null;
  const phaseRecordCount = mechanicsAuthority
    ? Math.max(0, Math.round(finiteNumber(
        mechanicsMaterialPhaseUpload?.phaseRecordCount,
        0
      )))
    : 0;
  view.setUint32(80, mechanicsAuthority ? 1 : 0, true);
  view.setUint32(84, phaseRecordCount, true);
  view.setInt32(
    88,
    Number(mechanicsAuthority?.selectedLevel ?? 0) | 0,
    true
  );
  view.setUint32(
    92,
    Number(mechanicsAuthority?.fieldCapacity ?? 0) >>> 0,
    true
  );
  view.setUint32(
    96,
    Number(transport?.phaseVolumeInterfaceLocalHeadOffsetWords ?? 0) >>> 0,
    true
  );
  view.setUint32(
    100,
    Number(mechanicsAuthority?.generationId ?? 0) >>> 0,
    true
  );
  view.setUint32(
    104,
    Number(
      mechanicsAuthority?.phaseVolumeReceipt?.completionOrdinal ?? 0
    ) >>> 0,
    true
  );
  view.setUint32(
    108,
    Number(
      transport?.levelIndex === 0
        ? proposal?.coarseReceiptCompletionOrdinal
        : proposal?.fineReceiptCompletionOrdinal
    ) >>> 0,
    true
  );
  view.setUint32(
    112,
    Number(proposal?.parentFieldCompletionOrdinal ?? 0) >>> 0,
    true
  );
  view.setInt32(
    116,
    Number(mechanicsAuthority?.fineLevel ?? 0) | 0,
    true
  );
  view.setInt32(
    120,
    Number(mechanicsAuthority?.coarseLevel ?? 0) | 0,
    true
  );
  view.setUint32(
    124,
    Number(mechanicsAuthority?.levelIndex ?? 0) >>> 0,
    true
  );
  const ambientPressure = Math.max(0, finiteNumber(ambientPressurePa, 0));
  const ambientDensity = mechanicsAuthority
    ? Math.max(0, finiteNumber(ambientReferenceDensityKgPerM3, 1.2041))
      * ambientPressure / 101325
    : 0;
  view.setFloat32(128, ambientPressure, true);
  view.setFloat32(132, ambientDensity, true);
  view.setFloat32(136, Math.max(0, finiteNumber(phaseVolumePressureScale, 1)), true);
  view.setFloat32(140, Math.max(0, finiteNumber(phaseVolumeDragScale, 1)), true);
  view.setFloat32(
    144,
    Math.max(0, finiteNumber(phaseVolumeMaxImpulseFraction, 0.5)),
    true
  );
  const identity = mechanicsAuthority?.epochIdentity ?? {};
  for (const [index, field] of [
    'storageGeneration',
    'physicsTick',
    'physicsSubstep',
    'positionEpoch',
    'topologyEpoch',
    'chartEpoch',
    'levelEpoch',
    'supportEpoch'
  ].entries()) {
    view.setUint32(160 + index * 4, Number(identity[field] ?? 0) >>> 0, true);
  }
  view.setUint32(
    192,
    mechanicsAuthority && phaseVolumeSurfaceStressEnabled === true ? 1 : 0,
    true
  );
  return buffer;
}

function pressureInterfaceAppliedImpulseFromRows(forceRows, forceRowCount, dtSeconds) {
  const impulse = [0, 0, 0];
  if (!(forceRows instanceof Float32Array) || !(forceRowCount > 0) || !(dtSeconds !== 0)) return impulse;
  for (let rowIndex = 0; rowIndex < forceRowCount; rowIndex += 1) {
    const offset = rowIndex * SPH_PRESSURE_INTERFACE_FORCE_FLOATS;
    if (!(forceRows[offset + 15] > 0)) continue;
    impulse[0] += forceRows[offset + 8] * dtSeconds;
    impulse[1] += forceRows[offset + 9] * dtSeconds;
    impulse[2] += forceRows[offset + 10] * dtSeconds;
  }
  return impulse;
}

function fusedMechanicsFieldGridUpdateAdmission(
  device,
  {
    p2gGridProjection,
    transaction,
    transactionMode,
    fieldExecution,
    dt
  }
) {
  const fine = transactionMode === 'fine';
  const terminal = transactionMode === 'coarse-terminal';
  if (!transaction || (!fine && !terminal)) return false;
  const macroAuthority = transaction.macroAuthority;
  const microepochAuthority = transaction.microepochAuthority;
  const particleContinuation = transaction.particleContinuation;
  const expectedField = fine
    ? transaction.fineFieldView
    : transaction.coarseFieldView;
  const expectedLevel = fine
    ? macroAuthority?.fineLevel
    : macroAuthority?.coarseLevel;
  const expectedDt = fine
    ? macroAuthority?.fineDt
    : macroAuthority?.macroDt;
  return Boolean(
    expectedField === fieldExecution
    && particleContinuation === p2gGridProjection?.sourceParticleContinuation
    && microepochAuthority === (fine
      ? p2gGridProjection?.fineMicroepochAuthority
      : p2gGridProjection?.terminalMicroepochAuthority)
    && transaction.proposalMode === 'proposal-deferred-to-post-mechanics'
    && p2gGridProjection?.proposalMode
      === 'proposal-deferred-to-post-mechanics'
    && p2gGridProjection?.schroederLevelFilter?.selectedLevel === expectedLevel
    && expectedField?.selectedLevel === expectedLevel
    && Object.is(Number(dt), Number(expectedDt))
    && Object.is(p2gGridProjection?.dt, expectedDt)
    && (fine
      ? validateSchroederFusedFineSubstepTransaction(
          device,
          transaction,
          { stage: 'grid-update', artifact: p2gGridProjection }
        )
      : validateSchroederFusedCoarseTerminalTransaction(
          device,
          transaction,
          { stage: 'grid-update', artifact: p2gGridProjection }
        ))
    && validateLocallySubmittedMlsMpmMechanicsFieldP2g(
      device,
      p2gGridProjection,
      {
        ...(fine
          ? { transaction }
          : { terminalTransaction: transaction }),
        macroAuthority,
        microepochAuthority,
        particleContinuation,
        fieldExecution,
        mutationSegment: transaction.p2gMutation,
        priorArtifact: null,
        requireDeferred: true,
        proposalMode: 'proposal-deferred-to-post-mechanics'
      }
    )
  );
}

async function runMlsMpmMechanicsFieldGridUpdateWebGpu({
  device,
  p2gGridProjection,
  p2gGridBuffer,
  pressureInterfaceForceRowsBuffer,
  pressureInterfaceForceSolver,
  dt,
  gravityMPerS2,
  boxDimsM,
  cflFactor,
  wallBarrierElasticStiffnessNPerM,
  wallBarrierMaterialBulkModulusPa,
  wallBarrierMaterialShearModulusPa,
  algorithmMaterialContactRows,
  wallBarrierContactScale,
  wallBarrierMinGapM,
  mechanicsFieldEnergyReceipt,
  schroederSpatialEpochTransaction,
  schroederSingleLevelQueueOrderedCleanupCapability,
  mechanicsMaterialTable,
  mechanicsMaterialPhaseUpload,
  ambientPressurePa,
  ambientReferenceDensityKgPerM3,
  phaseVolumePressureScale,
  phaseVolumeDragScale,
  phaseVolumeMaxImpulseFraction,
  phaseVolumeInterfaceTransportRequired,
  phaseVolumeAmbientBuoyancyRequired,
  gasPressureMechanicsAuthoritySource,
  gasPressureMechanicsChartId,
  fusedFineSubstepTransaction,
  fusedCoarseTerminalTransaction,
  fusedProducerCapability,
  retainUpdatedGridBuffer,
  readbackMode
}) {
  if (readbackMode !== NO_FULL_READBACK_MODE) {
    throw new Error('Mechanics-field grid update supports resident no-full-readback execution only');
  }
  if (retainUpdatedGridBuffer || p2gGridBuffer) {
    throw new Error(
      'Mechanics-field grid update mutates the borrowed field in place and cannot publish a dense updated-grid buffer'
    );
  }
  const fieldExecution = p2gGridProjection.mechanicsFieldViewExecution;
  const fieldBuffer = p2gGridProjection.mechanicsFieldViewBuffer
    ?? p2gGridProjection.mechanicsFieldView
    ?? null;
  let liveFieldExecution = false;
  const fieldRuntime = fieldExecution?.ownerRuntime ?? null;
  const fusedFineSubstep = fusedFineSubstepTransaction != null;
  const fusedCoarseTerminal = fusedCoarseTerminalTransaction != null;
  const fusedTransaction = fusedFineSubstepTransaction
    ?? fusedCoarseTerminalTransaction;
  const fusedTransactionMode = fusedFineSubstep
    ? 'fine'
    : fusedCoarseTerminal
      ? 'coarse-terminal'
      : null;
  if (
    typeof fieldRuntime?.reserveStateMutation !== 'function'
    || typeof fieldRuntime?.markStateMutationSubmitted !== 'function'
    || typeof fieldRuntime?.discardStateMutation !== 'function'
    || typeof fieldRuntime?.quarantineStateMutation !== 'function'
  ) {
    throw new TypeError(
      'Mechanics-field grid update needs exact mutable-field operation provenance'
    );
  }
  const p2gMutationOrdinal =
    p2gGridProjection.mechanicsFieldMutationOutputOrdinal;
  const fusedTransactionAdmitted = fusedTransaction == null
    || fusedMechanicsFieldGridUpdateAdmission(device, {
      p2gGridProjection,
      transaction: fusedTransaction,
      transactionMode: fusedTransactionMode,
      fieldExecution,
      dt
    });
  try {
    liveFieldExecution = Boolean(
      fieldExecution
      && fieldExecution.fieldViewBuffer === fieldBuffer
      && fieldExecution.indirectDispatchBuffer === fieldBuffer
      && fieldExecution.indirectDispatchOffsetBytes === 60 * Uint32Array.BYTES_PER_ELEMENT
      && Number(fieldBuffer?.size ?? 0)
        >= Number(p2gGridProjection.mechanicsFieldViewByteLength ?? 0)
      && fieldExecution.ownerRuntime?.ownsExecution?.(fieldExecution) === true
      && fieldExecution.ownerRuntime?.isExecutionSubmitted?.(fieldExecution) === true
      && p2gGridProjection.mechanicsFieldMutationOutputStateEncoding
        === SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT
      && (
        fusedTransaction != null
          ? fusedTransactionAdmitted
            && fieldRuntime?.isStatePublicationLockActive?.(
              fieldExecution,
              fusedFineSubstep
                ? fusedFineSubstepTransaction.publicationLock
                : fusedCoarseTerminalTransaction.coarsePublicationLock
            ) === true
          : fieldRuntime?.isCurrentStateArtifact?.(fieldExecution, {
              mutationOrdinal: p2gMutationOrdinal,
              stateEncoding:
                SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT
            }) === true
      )
    );
  } catch {
    liveFieldExecution = false;
  }
  if (
    p2gGridProjection.mechanicsFieldViewEnabled !== true
    || p2gGridProjection.mechanicsFieldMode
      !== MLS_MPM_MECHANICS_FIELD_MODE_REQUIRED
    || p2gGridProjection.gridStateAuthority
      !== 'schroeder-spatial-mechanics-field-view-v1'
    || p2gGridProjection.denseGridAuthoritative !== false
    || !fieldBuffer
    || !webGpuBufferMatchesDevice(fieldBuffer, device)
    || !liveFieldExecution
  ) {
    throw new TypeError(
      'Mechanics-field grid update requires the exact live generation-owned field published by P2G'
    );
  }
  const approvedPressureRows = pressureInterfaceForceSolverAllowsGridApplication(
    pressureInterfaceForceSolver
  )
    ? pressureForceRowCountFromSolver(
        pressureInterfaceForceSolver,
        pressureForceRowsFromSolver(pressureInterfaceForceSolver)
      )
    : 0;
  if (pressureInterfaceForceRowsBuffer || approvedPressureRows > 0) {
    throw new Error(
      'Mechanics-field grid update cannot consume dense pressure-interface rows'
    );
  }
  const gasPressureBoundaryRequested =
    gasPressureMechanicsAuthoritySource != null;
  if (gasPressureBoundaryRequested && fusedTransaction != null) {
    throw new Error(
      'Exact v4 gas pressure boundary transport is not supported by fused mechanics transactions'
    );
  }
  if (
    gasPressureBoundaryRequested
    && phaseVolumeInterfaceTransportRequired === true
  ) {
    throw new Error(
      'Exact v4 gas pressure boundary transport cannot share the S9-C pressure/drag path'
    );
  }
  if (
    gasPressureBoundaryRequested
    && (
      p2gGridProjection.externalGaugePressureEnabled === true
      || p2gGridProjection.externalGaugePressureAppliedInStressProjection
        === true
    )
  ) {
    throw new Error(
      'Exact v4 gas pressure boundary transport cannot double-apply a uniform P2G gauge pressure'
    );
  }
  const spatialGeneration = fusedTransaction?.microepochAuthority?.generation
    ?? schroederSpatialEpochTransaction?.generation
    ?? null;
  const singleLevelQueueOrderedCleanupRequested =
    schroederSingleLevelQueueOrderedCleanupCapability != null;
  const singleLevelQueueOrderedCleanup =
    singleLevelQueueOrderedCleanupRequested
    && fusedTransaction == null
    && validateSchroederSingleLevelQueueOrderedCleanupCapability(
      schroederSingleLevelQueueOrderedCleanupCapability,
      {
        transaction: schroederSpatialEpochTransaction,
        device,
        generation: spatialGeneration,
        readbackMode
      }
    );
  if (
    singleLevelQueueOrderedCleanupRequested
    && singleLevelQueueOrderedCleanup !== true
  ) {
    const error = new Error(
      'Mechanics-field grid update rejected a foreign single-level cleanup capability'
    );
    error.code =
      'ERR_SCHROEDER_SINGLE_LEVEL_QUEUE_ORDERED_CLEANUP_AUTHORITY';
    throw error;
  }
  const phaseVolumeSurfaceStressRequired =
    mechanicsMaterialTable?.surfaceTensionEnabled === true;
  const ambientBuoyancyRequired =
    phaseVolumeAmbientBuoyancyRequired === true;
  const phaseVolumeStandaloneLifecycleRequired =
    phaseVolumeSurfaceStressRequired || ambientBuoyancyRequired;
  if (
    phaseVolumeSurfaceStressRequired
    && mechanicsMaterialTable?.positiveSurfaceTensionPhaseRecordCount < 1
  ) {
    throw new TypeError(
      'Required surface stress lacks a positive mechanics material coefficient'
    );
  }
  let phaseVolumeTransportAuthority = null;
  let phaseVolumeSurfaceStressAuthority = null;
  let gasPressureBoundaryPhaseVolumeAuthority = null;
  if (schroederSpatialEpochTransaction != null) {
    if (
      fusedTransaction != null
      && spatialGeneration !== schroederSpatialEpochTransaction.generation
    ) {
      throw new TypeError(
        'Phase-volume transport transaction does not match the active mechanics microepoch'
      );
    }
    if (phaseVolumeInterfaceTransportRequired === true) {
      phaseVolumeTransportAuthority =
        resolveSchroederSpatialPhaseVolumeTransportAuthority(
          schroederSpatialEpochTransaction,
          {
            generation: spatialGeneration,
            selectedLevel: fieldExecution.selectedLevel,
            mechanicsFieldView: fieldExecution
          }
        );
    }
    if (
      phaseVolumeStandaloneLifecycleRequired
      || gasPressureBoundaryRequested
    ) {
      const surfaceAuthority =
        resolveSchroederSpatialPhaseVolumeSurfaceStressAuthority(
        schroederSpatialEpochTransaction,
        {
          generation: spatialGeneration,
          selectedLevel: fieldExecution.selectedLevel,
          mechanicsFieldView: fieldExecution
        }
      );
      if (phaseVolumeStandaloneLifecycleRequired) {
        phaseVolumeSurfaceStressAuthority = surfaceAuthority;
      }
      if (gasPressureBoundaryRequested) {
        gasPressureBoundaryPhaseVolumeAuthority = surfaceAuthority;
      }
    }
  }
  if (
    gasPressureBoundaryRequested
    && gasPressureBoundaryPhaseVolumeAuthority == null
  ) {
    throw new TypeError(
      'Exact v4 gas pressure boundary transport requires the exact live S9-A/S9-B authority'
    );
  }
  const phaseVolumeMechanicsAuthority =
    phaseVolumeTransportAuthority ?? phaseVolumeSurfaceStressAuthority;
  const materialPhaseUploadReady = Boolean(
    phaseVolumeMechanicsAuthority
    && uploadedMechanicsMaterialPhaseRecordsMatch(
      mechanicsMaterialPhaseUpload,
      mechanicsMaterialTable,
      device
    )
  );
  if (
    phaseVolumeInterfaceTransportRequired === true
    && (!phaseVolumeTransportAuthority || !materialPhaseUploadReady)
  ) {
    throw new TypeError(
      'Required phase-volume transport lacks exact S9 authority or mechanics material records'
    );
  }
  if (
    phaseVolumeSurfaceStressRequired
    && (!phaseVolumeSurfaceStressAuthority || !materialPhaseUploadReady)
  ) {
    throw new TypeError(
      'Required surface stress lacks exact S9 authority or mechanics material records'
    );
  }
  if (
    ambientBuoyancyRequired
    && (!phaseVolumeSurfaceStressAuthority || !materialPhaseUploadReady)
  ) {
    throw new TypeError(
      'Required ambient buoyancy lacks exact S9 authority or mechanics material records'
    );
  }
  if (!materialPhaseUploadReady) {
    phaseVolumeTransportAuthority = null;
    phaseVolumeSurfaceStressAuthority = null;
  }
  if (
    phaseVolumeTransportAuthority
    || gasPressureBoundaryPhaseVolumeAuthority
  ) {
    // The transport operator reads absolute pressures that P2G resolved
    // against a specific ambient reference and EOS gauge scale, and the
    // shader authenticates the receipt's sealed ambient bits against the
    // ambient we upload here. Prove the match on the host too, so a mismatched
    // caller fails with the actual cause instead of an opaque fail-closed
    // receipt. Compare f32 bits: the receipt stores the bit pattern.
    const sealedAmbientPa = Math.max(
      0,
      finiteNumber(p2gGridProjection?.ambientPressurePa, 0)
    );
    const requestedAmbientPa = Math.max(0, finiteNumber(ambientPressurePa, 0));
    if (
      !Object.is(Math.fround(sealedAmbientPa), Math.fround(requestedAmbientPa))
    ) {
      throw new TypeError(
        'Phase-volume pressure transport ambient does not match the ambient '
          + `sealed by its originating P2G (${sealedAmbientPa} vs `
          + `${requestedAmbientPa})`
      );
    }
  }
  const materialPhaseBuffer = phaseVolumeMechanicsAuthority
    ? mechanicsMaterialPhaseUpload.recordsBuffer
      ?? mechanicsMaterialPhaseUpload.materialPhaseBuffer
    : null;
  const transportScratchWordLength = phaseVolumeMechanicsAuthority
    ? schroederSpatialPhaseVolumeTransportScratchWordLength(
        phaseVolumeMechanicsAuthority.fieldCapacity
      )
    : 0;
  const transportScratchByteLength =
    transportScratchWordLength * Uint32Array.BYTES_PER_ELEMENT;
  if (phaseVolumeMechanicsAuthority) {
    const maxStorageBindings = Number(
      device.limits?.maxStorageBuffersPerShaderStage ?? 8
    );
    const maxStorageBindingBytes = Number(
      device.limits?.maxStorageBufferBindingSize
        ?? Number.POSITIVE_INFINITY
    );
    const maxBufferBytes = Number(
      device.limits?.maxBufferSize ?? Number.POSITIVE_INFINITY
    );
    if (
      !Number.isSafeInteger(transportScratchByteLength)
      || transportScratchByteLength < Uint32Array.BYTES_PER_ELEMENT
      || maxStorageBindings < 7
      || transportScratchByteLength > maxStorageBindingBytes
      || transportScratchByteLength > maxBufferBytes
    ) {
      throw new RangeError(
        'Phase-volume transport scratch exceeds the admitted WebGPU storage limits'
      );
    }
  }
  const gasPressureBoundaryLayout = gasPressureBoundaryRequested
    ? createSchroederSpatialGasPressureBoundaryTransportLayout({
        fieldCapacity: gasPressureBoundaryPhaseVolumeAuthority.fieldCapacity,
        maxComputeWorkgroupsPerDimension: Number(
          device.limits?.maxComputeWorkgroupsPerDimension ?? 65535
        )
      })
    : null;
  if (gasPressureBoundaryLayout) {
    const maxStorageBindings = Number(
      device.limits?.maxStorageBuffersPerShaderStage ?? 8
    );
    const maxStorageBindingBytes = Number(
      device.limits?.maxStorageBufferBindingSize
        ?? Number.POSITIVE_INFINITY
    );
    const maxBufferBytes = Number(
      device.limits?.maxBufferSize ?? Number.POSITIVE_INFINITY
    );
    if (
      maxStorageBindings < 7
      || gasPressureBoundaryLayout.scratchByteLength
        > maxStorageBindingBytes
      || gasPressureBoundaryLayout.scratchByteLength > maxBufferBytes
    ) {
      throw new RangeError(
        'Gas pressure boundary scratch exceeds the admitted WebGPU storage limits'
      );
    }
  }
  const dtSeconds = finiteNumber(dt, 0);
  const gravity = finiteVector3(gravityMPerS2, DEFAULT_GRAVITY_M_PER_S2);
  const dims = finiteVector3(boxDimsM, DEFAULT_BOX_DIMS_M);
  const cfl = finiteNumber(cflFactor, DEFAULT_CFL_FACTOR);
  const elasticStiffness = resolveWallBarrierElasticStiffness({
    wallBarrierElasticStiffnessNPerM,
    wallBarrierMaterialBulkModulusPa,
    wallBarrierMaterialShearModulusPa,
    supportLengthM: finiteNumber(p2gGridProjection.gridSpacingM, 0),
    algorithmMaterialContactRows
  });
  const wallBarrierContact = createWallBarrierContactSummary({
    status: 'wall-barrier-contact-submitted-unverified-mechanics-field',
    wallBarrierElasticStiffnessNPerM: elasticStiffness.elasticNormalStiffnessNPerM,
    elasticStiffnessSource: elasticStiffness.source,
    materialPolicy: elasticStiffness.materialPolicy,
    bulkModulusPa: elasticStiffness.bulkModulusPa,
    shearModulusPa: elasticStiffness.shearModulusPa,
    supportLengthM: elasticStiffness.supportLengthM,
    wallBarrierContactScale: clamp01(wallBarrierContactScale),
    wallBarrierMinGapM: Math.max(
      1e-12,
      Math.abs(finiteNumber(wallBarrierMinGapM, DEFAULT_WALL_BARRIER_MIN_GAP_M))
    )
  });
  const receiptModeFlags = mechanicsFieldEnergyReceipt?.deferSeal === true ? 1 : 0;
  const ownedBuffers = new Set();
  let publishedUpdate = null;
  let queueOrderedSubmissionReceipt = null;
  const trackOwnedBuffer = (buffer) => {
    if (buffer?.destroy) ownedBuffers.add(buffer);
    return buffer;
  };
  const cleanupOwnedBuffers = () => {
    for (let attempt = 0; attempt < 2 && ownedBuffers.size > 0; attempt += 1) {
      for (const buffer of [...ownedBuffers]) {
        try {
          buffer.destroy?.();
          ownedBuffers.delete(buffer);
        } catch {
          // Continue across the complete ledger and retry each failed
          // destructor once without replacing the producer's error.
        }
      }
    }
  };
  const scheduleOwnedBufferCleanup = () => {
    // The exact v4 path consumes its temporary-allocation claim immediately
    // after the useful queue submission. Do not turn an already-empty owner
    // ledger into a redundant host queue fence in the shared finally path.
    if (ownedBuffers.size === 0) return;
    if (!submitted) {
      cleanupOwnedBuffers();
      return;
    }
    if (
      (fusedTransaction != null || singleLevelQueueOrderedCleanup)
      && mutationCommitted === true
      && publishedUpdate
      && (
        singleLevelQueueOrderedCleanup
        || (
          fusedFineSubstep
            ? publishedUpdate.fusedFineSubstepTransaction
              === fusedTransaction
            : publishedUpdate.fusedCoarseTerminalTransaction
              === fusedTransaction
        )
      )
    ) {
      const producerFamily =
        'mls-mpm-grid-update-submitted-temporaries';
      let producerClaim = null;
      try {
        producerClaim = registerQueueOrderedCleanupClaim(
          gridUpdateSubmittedTemporaryCleanupClaimIssuer,
          device,
          {
            producerOutput: publishedUpdate,
            cleanup: cleanupOwnedBuffers
          }
        );
        const queueOrderedFinalConsumer =
          sealQueueOrderedFinalConsumerCapability(
            queueOrderedSubmissionReceipt,
            device,
            {
              finalConsumerOwner: publishedUpdate,
              producerClaims: [producerClaim]
            }
          );
        const receipt = releaseSubmittedWorkCleanupQueueOrdered(
          device,
          cleanupOwnedBuffers,
          {
            queueOrderedFinalConsumer,
            producerClaim,
            producerOutput: publishedUpdate,
            producerFamily
          }
        );
        publishedUpdate.queueOrderedCleanupReceipt = receipt;
        publishedUpdate.queueCompletionStatus =
          receipt.queueCompletionStatus;
        publishedUpdate.queueCompletionMethod =
          receipt.queueCompletionMethod;
        return;
      } catch {
        if (producerClaim != null) {
          try {
            cancelQueueOrderedCleanupClaim(
              producerClaim,
              device,
              {
                producerOutput: publishedUpdate,
                cleanup: cleanupOwnedBuffers
              }
            );
          } catch {
            // A sealed claim cannot be cancelled. The fenced fallback below
            // remains the exact allocation owner.
          }
        }
      }
    }
    try {
      const fence = device.queue?.onSubmittedWorkDone?.();
      if (fence && publishedUpdate) {
        appendGpuReadbackTelemetryObservation(publishedUpdate, {
          hostQueueFenceCount: 1,
          deferredCleanupHostQueueFenceCount: 1
        }, {
          source: 'mechanics-field-grid-update-owned-buffer-cleanup'
        });
      }
      if (!fence?.then) {
        cleanupOwnedBuffers();
      } else {
        Promise.resolve(fence)
          .catch(() => null)
          .finally(cleanupOwnedBuffers);
      }
    } catch {
      cleanupOwnedBuffers();
    }
  };
  let paramsBuffer = null;
  let indirectBuffer = null;
  let transportScratchBuffer = null;
  let gasPressureBoundaryScratchBuffer = null;
  let gasPressureBoundaryParamsBuffer = null;
  let gasPressureBoundaryBinding = null;
  let gasPressureBoundaryProducerClaim = null;
  let gasPressureBoundaryFinalConsumer = null;
  let gasPressureBoundaryRetired = false;
  let gasPressureBoundarySubmissionAttempted = false;
  let gasPressureBoundarySubmitFailureQuarantined = false;
  let gasPressureBoundaryOwnedCleanupClaim = null;
  let gasPressureBoundaryOwnedCleanupReceipt = null;
  let gasPressureBoundaryOwnedCleanupClaimConsumed = false;
  let submitted = false;
  let mutationCommitted = false;
  let mutationToken = null;
  const gridUpdateWorkspace =
    fieldRuntime.gridUpdateWorkspaceForExecution?.(fieldExecution) ?? null;
  if (
    gridUpdateWorkspace
    && (
      !webGpuBufferMatchesDevice(gridUpdateWorkspace.paramsBuffer, device)
      || Number(gridUpdateWorkspace.paramsBuffer?.size ?? 0)
        < SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_PARAMS_BYTES
      || !webGpuBufferMatchesDevice(gridUpdateWorkspace.indirectBuffer, device)
      || Number(gridUpdateWorkspace.indirectBuffer?.size ?? 0)
        < 3 * Uint32Array.BYTES_PER_ELEMENT
      || !webGpuBufferMatchesDevice(
        gridUpdateWorkspace.transportScratchBuffer,
        device
      )
      || Number(gridUpdateWorkspace.transportScratchBuffer?.size ?? 0)
        < transportScratchByteLength
    )
  ) {
    throw new TypeError(
      'Mechanics-field grid update workspace must be an exact same-device arena allocation'
    );
  }
  try {
    paramsBuffer = gridUpdateWorkspace?.paramsBuffer
      ?? trackOwnedBuffer(device.createBuffer({
        label: 'ulg-mls-mpm-mechanics-field-grid-update-params',
        size: SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_PARAMS_BYTES,
        usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
      }));
    indirectBuffer = gridUpdateWorkspace?.indirectBuffer
      ?? trackOwnedBuffer(device.createBuffer({
        label: 'ulg-mls-mpm-mechanics-field-grid-update-indirect',
        size: 3 * Uint32Array.BYTES_PER_ELEMENT,
        usage: GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.INDIRECT
      }));
    if (phaseVolumeMechanicsAuthority) {
      transportScratchBuffer = gridUpdateWorkspace?.transportScratchBuffer
        ?? trackOwnedBuffer(device.createBuffer({
          label: 'ulg-schroeder-phase-volume-transport-scratch',
          size: transportScratchByteLength,
          usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
        }));
      device.queue.writeBuffer(
        transportScratchBuffer,
        0,
        createSchroederSpatialPhaseVolumeTransportScratchHeader({
          fieldCapacity: phaseVolumeMechanicsAuthority.fieldCapacity,
          generationId: phaseVolumeMechanicsAuthority.generationId,
          fieldCompletionOrdinal:
            phaseVolumeMechanicsAuthority.phaseVolumeReceipt
              ?.completionOrdinal
        })
      );
    }
    if (gasPressureBoundaryLayout) {
      gasPressureBoundaryScratchBuffer = trackOwnedBuffer(
        device.createBuffer({
          label: 'ulg-schroeder-gas-pressure-boundary-scratch',
          size: gasPressureBoundaryLayout.scratchByteLength,
          usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
        })
      );
      gasPressureBoundaryParamsBuffer = trackOwnedBuffer(
        device.createBuffer({
          label: 'ulg-schroeder-gas-pressure-boundary-params',
          size: SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_PARAMS_BYTES,
          usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
        })
      );
    }
    mutationToken = fusedTransaction != null
      ? fusedTransaction.gridUpdateMutation
      : fieldRuntime.reserveStateMutation(fieldExecution, {
          expectedOrdinal: p2gMutationOrdinal,
          expectedEncoding:
            SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT,
          outputEncoding:
            SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT,
          operation: 'grid-update-mass-velocity-gradient-submitted'
        });
    device.queue.writeBuffer(
      paramsBuffer,
      0,
      createMechanicsFieldGridUpdateParamsArray({
      p2gGridProjection,
      dt: dtSeconds,
      gravityMPerS2: gravity,
      boxDimsM: dims,
      cflFactor: cfl,
      pressureInterfaceForceRowCount: 0,
      wallBarrierElasticStiffnessNPerM: wallBarrierContact.wallBarrierElasticStiffnessNPerM,
      wallBarrierContactScale: wallBarrierContact.wallBarrierContactScale,
      wallBarrierMinGapM: wallBarrierContact.wallBarrierMinGapM,
      mechanicsFieldMutation: mutationToken,
      mechanicsFieldReceiptModeFlags: receiptModeFlags,
      phaseVolumeTransportAuthority,
      phaseVolumeSurfaceStressAuthority,
      mechanicsMaterialPhaseUpload,
      ambientPressurePa,
      ambientReferenceDensityKgPerM3,
      phaseVolumePressureScale,
      phaseVolumeDragScale,
      phaseVolumeMaxImpulseFraction,
      phaseVolumeSurfaceStressEnabled:
        phaseVolumeStandaloneLifecycleRequired
      })
    );
    const { mlsMpmMechanicsFieldGridUpdateWgsl } = await import(
      './sphMlsMpmGpuStep.js'
    );
    if (fusedTransaction != null && !fusedMechanicsFieldGridUpdateAdmission(
      device,
      {
        p2gGridProjection,
        transaction: fusedTransaction,
        transactionMode: fusedTransactionMode,
        fieldExecution,
        dt
      }
    )) {
      throw new Error(
        'Fused grid update lost its exact pending transaction before submission'
      );
    }
    const {
      beginHeat,
      clearHeat,
      buildHeat,
      main,
      claim,
      contact,
      summarizeHeat,
      seal
    } = mechanicsFieldGridUpdatePipelines(
      device,
      mlsMpmMechanicsFieldGridUpdateWgsl
    );
    const transportPipelines = phaseVolumeTransportAuthority
      ? phaseVolumeTransportPipelines(device)
      : null;
    const transportStage = transportPipelines?.stage ?? null;
    const transportValidate = transportPipelines?.validate ?? null;
    const surfaceStressStages =
      phaseVolumeSurfaceStressRequired
        && phaseVolumeSurfaceStressAuthority
        ? phaseVolumeSurfaceStressPipelines(device).stages
        : [];
    const standalonePhaseVolumeLifecycle =
      phaseVolumeSurfaceStressAuthority && !phaseVolumeTransportAuthority;
    const surfaceStressPipelines = standalonePhaseVolumeLifecycle
      ? phaseVolumeSurfaceStressPipelines(device)
      : null;
    const surfaceStressInitialize = surfaceStressPipelines?.initialize ?? null;
    const surfaceStressValidate = surfaceStressPipelines?.validate ?? null;
    const surfaceStressCommit = surfaceStressPipelines?.commit ?? null;
    const transportCommit = transportPipelines?.commit ?? null;
    const gasPressureBoundaryPipelines = gasPressureBoundaryLayout
      ? createGasPressureBoundaryPipelines(device)
      : null;
    if (gasPressureBoundaryPipelines) {
      gasPressureBoundaryBinding =
        createSphSpatialGasPressureMechanicsAuthorityBinding(
          gasPressureMechanicsAuthoritySource,
          {
            device,
            bindGroupLayout: gasPressureBoundaryPipelines.bindGroupLayout,
            publicEntries: [
              { binding: 0, resource: { buffer: fieldBuffer } },
              {
                binding: 1,
                resource: {
                  buffer: gasPressureBoundaryPhaseVolumeAuthority
                    .phaseVolumeReceiptControlBuffer
                }
              },
              {
                binding: 2,
                resource: {
                  buffer: gasPressureBoundaryPhaseVolumeAuthority
                    .phaseVolumeMomentBuffer
                }
              },
              {
                binding: 5,
                resource: { buffer: gasPressureBoundaryScratchBuffer }
              },
              {
                binding: 7,
                resource: { buffer: gasPressureBoundaryParamsBuffer }
              }
            ],
            phaseVolumeAuthority:
              gasPressureBoundaryPhaseVolumeAuthority,
            chartId: gasPressureMechanicsChartId
          }
        );
      const gridCellOrigin = exactGasPressureGridCellOrigin(
        gasPressureBoundaryBinding
      );
      const boundaryEpoch = gasPressureBoundaryBinding.epochIdentity;
      const boundaryDirectory = gasPressureBoundaryBinding.gasDirectory;
      device.queue.writeBuffer(
        gasPressureBoundaryScratchBuffer,
        0,
        createSchroederSpatialGasPressureBoundaryTransportScratchHeader({
          fieldCapacity: gasPressureBoundaryBinding.fieldCapacity,
          generationId:
            gasPressureBoundaryPhaseVolumeAuthority.generationId,
          fieldCompletionOrdinal:
            gasPressureBoundaryPhaseVolumeAuthority.phaseVolumeReceipt
              .completionOrdinal,
          gasAuthorityExecutionGeneration:
            gasPressureBoundaryBinding.executionGeneration
        })
      );
      device.queue.writeBuffer(
        gasPressureBoundaryParamsBuffer,
        0,
        createSchroederSpatialGasPressureBoundaryTransportParams({
          transportEnabled: true,
          missingCellPolicy:
            SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_MISSING_CELL_NO_LOAD,
          fieldCapacity: gasPressureBoundaryBinding.fieldCapacity,
          maxComputeWorkgroupsPerDimension: Number(
            device.limits?.maxComputeWorkgroupsPerDimension ?? 65535
          ),
          generationId:
            gasPressureBoundaryPhaseVolumeAuthority.generationId,
          fieldCompletionOrdinal:
            gasPressureBoundaryPhaseVolumeAuthority.phaseVolumeReceipt
              .completionOrdinal,
          fieldMutationOrdinal: mutationToken.outputOrdinal,
          storageGeneration: boundaryEpoch.storageGeneration,
          physicsTick: boundaryEpoch.physicsTick,
          physicsSubstep: boundaryEpoch.physicsSubstep,
          positionEpoch: boundaryEpoch.positionEpoch,
          topologyEpoch: boundaryEpoch.topologyEpoch,
          chartEpoch: boundaryEpoch.chartEpoch,
          levelEpoch: boundaryEpoch.levelEpoch,
          supportEpoch: boundaryEpoch.supportEpoch,
          selectedLevel: gasPressureBoundaryBinding.level,
          gridNodeCount: gasPressureBoundaryBinding.gasGridNodeCount,
          gridDimensions: gasPressureBoundaryBinding.gasGridDims,
          gridCellOrigin,
          chartId: gasPressureBoundaryBinding.chartId,
          dt: dtSeconds,
          ambientPressurePa: Math.max(
            0,
            finiteNumber(ambientPressurePa, 0)
          ),
          pressureScale: Math.max(
            0,
            finiteNumber(phaseVolumePressureScale, 1)
          ),
          gridSpacingM: gasPressureBoundaryBinding.gasGridSpacingM,
          gasAuthorityExecutionGeneration:
            gasPressureBoundaryBinding.executionGeneration,
          gasAuthorityStorageGeneration:
            gasPressureBoundaryBinding.storageGeneration,
          gasPressureCellCapacity:
            gasPressureBoundaryBinding.gasPressureCellRowCapacity,
          gasPressureCellStrideFloats:
            gasPressureBoundaryBinding.gasPressureCellRowStrideFloats,
          gasDirectoryGeneration: boundaryDirectory.generationId,
          gasDirectoryWordLength: boundaryDirectory.capacityWords,
          gasDirectoryCellCapacity: boundaryDirectory.cellCapacity,
          gasDirectoryCellKeysOffsetWords:
            boundaryDirectory.cellKeysOffsetWords,
          gasDirectoryCellOffsetsOffsetWords:
            boundaryDirectory.cellOffsetsOffsetWords,
          gasDirectoryCellMembersOffsetWords:
            boundaryDirectory.cellMembersOffsetWords,
          gasDirectoryParticleToCellOffsetWords:
            boundaryDirectory.memberToCellOffsetWords
        })
      );
    }
    const entries = [
      { binding: 0, resource: { buffer: fieldBuffer } },
      { binding: 2, resource: { buffer: paramsBuffer } }
    ];
    const mainBindGroup = gridUpdateWorkspace
      && typeof fieldRuntime.createExactConsumerBindGroup === 'function'
      ? fieldRuntime.createExactConsumerBindGroup(fieldExecution, {
          cacheKey: 'grid-update-main',
          layout: main.bindGroupLayout,
          entries,
          label: 'ulg-mls-mpm-mechanics-field-grid-update-main-bind-group'
        })
      : device.createBindGroup({
          layout: main.bindGroupLayout,
          entries
        });
    const bindGroupForMechanicsPipeline = (pipelineInfo) => (
      pipelineInfo.bindGroupLayout === main.bindGroupLayout
        ? mainBindGroup
        : device.createBindGroup({
            layout: pipelineInfo.bindGroupLayout,
            entries
          })
    );
    const beginHeatBindGroup = bindGroupForMechanicsPipeline(beginHeat);
    const clearHeatBindGroup = bindGroupForMechanicsPipeline(clearHeat);
    const buildHeatBindGroup = bindGroupForMechanicsPipeline(buildHeat);
    const claimBindGroup = bindGroupForMechanicsPipeline(claim);
    const contactBindGroup = bindGroupForMechanicsPipeline(contact);
    const summarizeHeatBindGroup = bindGroupForMechanicsPipeline(summarizeHeat);
    const sealBindGroup = bindGroupForMechanicsPipeline(seal);
    const transportEntries = phaseVolumeTransportAuthority
      ? [
          { binding: 0, resource: { buffer: fieldBuffer } },
          {
            binding: 1,
            resource: {
              buffer: phaseVolumeTransportAuthority
                .phaseVolumeInterfaceProposalControlBuffer
            }
          },
          {
            binding: 2,
            resource: {
              buffer: phaseVolumeTransportAuthority
                .phaseVolumeInterfaceLocalHeadBuffer
            }
          },
          {
            binding: 3,
            resource: {
              buffer: phaseVolumeTransportAuthority
                .phaseVolumeReceiptControlBuffer
            }
          },
          {
            binding: 4,
            resource: {
              buffer: phaseVolumeTransportAuthority.phaseVolumeMomentBuffer
            }
          },
          { binding: 5, resource: { buffer: materialPhaseBuffer } },
          { binding: 6, resource: { buffer: paramsBuffer } },
          { binding: 7, resource: { buffer: transportScratchBuffer } }
        ]
      : null;
    const surfaceStressEntries = phaseVolumeSurfaceStressAuthority
      ? [
          { binding: 0, resource: { buffer: fieldBuffer } },
          {
            binding: 4,
            resource: {
              buffer:
                phaseVolumeSurfaceStressAuthority.phaseVolumeMomentBuffer
            }
          },
          { binding: 5, resource: { buffer: materialPhaseBuffer } },
          { binding: 6, resource: { buffer: paramsBuffer } },
          { binding: 7, resource: { buffer: transportScratchBuffer } }
        ]
      : null;
    const transportStageBindGroup = transportStage
      ? (gridUpdateWorkspace
          && typeof fieldRuntime.createExactConsumerBindGroup === 'function'
          ? fieldRuntime.createExactConsumerBindGroup(fieldExecution, {
              cacheKey: 'grid-update-phase-volume-transport-stage',
              layout: transportStage.bindGroupLayout,
              entries: transportEntries,
              label: 'ulg-mls-mpm-grid-update-phase-volume-transport-stage-bind-group'
            })
          : device.createBindGroup({
              layout: transportStage.bindGroupLayout,
              entries: transportEntries
            }))
      : null;
    const transportValidateBindGroup = transportValidate
      ? (transportValidate.bindGroupLayout === transportStage.bindGroupLayout
          ? transportStageBindGroup
          : (gridUpdateWorkspace
              && typeof fieldRuntime.createExactConsumerBindGroup === 'function'
              ? fieldRuntime.createExactConsumerBindGroup(fieldExecution, {
                  cacheKey: 'grid-update-phase-volume-transport-validate',
                  layout: transportValidate.bindGroupLayout,
                  entries: transportEntries,
                  label: 'ulg-mls-mpm-grid-update-phase-volume-transport-validate-bind-group'
                })
              : device.createBindGroup({
                  layout: transportValidate.bindGroupLayout,
                  entries: transportEntries
                })))
      : null;
    const surfaceStressPrimaryPipeline = surfaceStressStages[0]
      ?? surfaceStressInitialize
      ?? surfaceStressValidate
      ?? surfaceStressCommit
      ?? null;
    const surfaceStressPrimaryBindGroup = surfaceStressPrimaryPipeline
      ? (gridUpdateWorkspace
          && typeof fieldRuntime.createExactConsumerBindGroup === 'function'
          ? fieldRuntime.createExactConsumerBindGroup(fieldExecution, {
              cacheKey: 'grid-update-phase-volume-surface-stress-primary',
              layout: surfaceStressPrimaryPipeline.bindGroupLayout,
              entries: surfaceStressEntries,
              label: 'ulg-mls-mpm-grid-update-phase-volume-surface-stress-primary-bind-group'
            })
          : device.createBindGroup({
              layout: surfaceStressPrimaryPipeline.bindGroupLayout,
              entries: surfaceStressEntries
            }))
      : null;
    const bindGroupForSurfaceStressPipeline = (pipelineInfo) => (
      pipelineInfo.bindGroupLayout === surfaceStressPrimaryPipeline.bindGroupLayout
        ? surfaceStressPrimaryBindGroup
        : (gridUpdateWorkspace
            && typeof fieldRuntime.createExactConsumerBindGroup === 'function'
            ? fieldRuntime.createExactConsumerBindGroup(fieldExecution, {
                cacheKey: `grid-update-phase-volume-surface-stress-${pipelineInfo.pipeline?.label ?? 'stage'}`,
                layout: pipelineInfo.bindGroupLayout,
                entries: surfaceStressEntries,
                label: 'ulg-mls-mpm-grid-update-phase-volume-surface-stress-bind-group'
              })
            : device.createBindGroup({
                layout: pipelineInfo.bindGroupLayout,
                entries: surfaceStressEntries
              }))
    );
    const surfaceStressStageBindGroups = surfaceStressStages.map(
      (pipelineInfo, stageIndex) => (
        pipelineInfo.bindGroupLayout === surfaceStressPrimaryPipeline.bindGroupLayout
          ? surfaceStressPrimaryBindGroup
          : (gridUpdateWorkspace
              && typeof fieldRuntime.createExactConsumerBindGroup === 'function'
              ? fieldRuntime.createExactConsumerBindGroup(fieldExecution, {
                  cacheKey: `grid-update-phase-volume-surface-stress-stage-${stageIndex}`,
                  layout: pipelineInfo.bindGroupLayout,
                  entries: surfaceStressEntries,
                  label: 'ulg-mls-mpm-grid-update-phase-volume-surface-stress-bind-group'
                })
              : device.createBindGroup({
                  layout: pipelineInfo.bindGroupLayout,
                  entries: surfaceStressEntries
                }))
      )
    );
    const surfaceStressInitializeBindGroup = surfaceStressInitialize
      ? bindGroupForSurfaceStressPipeline(surfaceStressInitialize)
      : null;
    const surfaceStressValidateBindGroup = surfaceStressValidate
      ? bindGroupForSurfaceStressPipeline(surfaceStressValidate)
      : null;
    const surfaceStressCommitBindGroup = surfaceStressCommit
      ? bindGroupForSurfaceStressPipeline(surfaceStressCommit)
      : null;
    const transportCommitBindGroup = transportCommit
      ? (transportCommit.bindGroupLayout === transportStage.bindGroupLayout
          ? transportStageBindGroup
          : (gridUpdateWorkspace
              && typeof fieldRuntime.createExactConsumerBindGroup === 'function'
              ? fieldRuntime.createExactConsumerBindGroup(fieldExecution, {
                  cacheKey: 'grid-update-phase-volume-transport-commit',
                  layout: transportCommit.bindGroupLayout,
                  entries: transportEntries,
                  label: 'ulg-mls-mpm-grid-update-phase-volume-transport-commit-bind-group'
                })
              : device.createBindGroup({
                  layout: transportCommit.bindGroupLayout,
                  entries: transportEntries
                })))
      : null;
    const encoder = device.createCommandEncoder();
    if (typeof encoder.copyBufferToBuffer !== 'function') {
      throw new Error('Mechanics-field grid update requires indirect-dispatch staging');
    }
    encoder.copyBufferToBuffer(
      fieldExecution.indirectDispatchBuffer,
      fieldExecution.indirectDispatchOffsetBytes,
      indirectBuffer,
      0,
      3 * Uint32Array.BYTES_PER_ELEMENT
    );
    const sequencePass = encoder.beginComputePass({
      label: 'ulg-mls-mpm-grid-update-mechanics-field-sequence'
    });
    sequencePass.setPipeline(beginHeat.pipeline);
    sequencePass.setBindGroup(0, beginHeatBindGroup);
    sequencePass.dispatchWorkgroups(1);
    sequencePass.setPipeline(clearHeat.pipeline);
    sequencePass.setBindGroup(0, clearHeatBindGroup);
    sequencePass.dispatchWorkgroupsIndirect(indirectBuffer, 0);
    sequencePass.setPipeline(buildHeat.pipeline);
    sequencePass.setBindGroup(0, buildHeatBindGroup);
    sequencePass.dispatchWorkgroups(1);
    sequencePass.setPipeline(claim.pipeline);
    sequencePass.setBindGroup(0, claimBindGroup);
    sequencePass.dispatchWorkgroups(1);
    sequencePass.setPipeline(main.pipeline);
    sequencePass.setBindGroup(0, mainBindGroup);
    sequencePass.dispatchWorkgroupsIndirect(indirectBuffer, 0);
    if (gasPressureBoundaryPipelines) {
      for (
        let passIndex = 0;
        passIndex < gasPressureBoundaryPipelines.pipelines.length;
        passIndex += 1
      ) {
        sequencePass.setPipeline(
          gasPressureBoundaryPipelines.pipelines[passIndex]
        );
        bindSphSpatialGasPressureMechanicsAuthority(
          gasPressureBoundaryBinding,
          {
            device,
            passEncoder: sequencePass,
            bindGroupIndex: 0
          }
        );
        sequencePass.dispatchWorkgroups(
          ...gasPressureBoundaryLayout.dispatchWorkgroups
        );
      }
    }
    if (transportStage) {
      sequencePass.setPipeline(transportStage.pipeline);
      sequencePass.setBindGroup(0, transportStageBindGroup);
      sequencePass.dispatchWorkgroupsIndirect(indirectBuffer, 0);
    } else if (surfaceStressInitialize) {
      sequencePass.setPipeline(
        surfaceStressInitialize.pipeline
      );
      sequencePass.setBindGroup(
        0,
        surfaceStressInitializeBindGroup
      );
      sequencePass.dispatchWorkgroupsIndirect(
        indirectBuffer,
        0
      );
    }
    for (
      let passIndex = 0;
      passIndex < surfaceStressStages.length;
      passIndex += 1
    ) {
      sequencePass.setPipeline(
        surfaceStressStages[passIndex].pipeline
      );
      sequencePass.setBindGroup(
        0,
        surfaceStressStageBindGroups[passIndex]
      );
      sequencePass.dispatchWorkgroupsIndirect(indirectBuffer, 0);
    }
    if (transportValidate && transportCommit) {
      sequencePass.setPipeline(transportValidate.pipeline);
      sequencePass.setBindGroup(0, transportValidateBindGroup);
      sequencePass.dispatchWorkgroupsIndirect(indirectBuffer, 0);
      sequencePass.setPipeline(transportCommit.pipeline);
      sequencePass.setBindGroup(0, transportCommitBindGroup);
      sequencePass.dispatchWorkgroupsIndirect(indirectBuffer, 0);
    } else if (surfaceStressValidate && surfaceStressCommit) {
      sequencePass.setPipeline(
        surfaceStressValidate.pipeline
      );
      sequencePass.setBindGroup(
        0,
        surfaceStressValidateBindGroup
      );
      sequencePass.dispatchWorkgroupsIndirect(
        indirectBuffer,
        0
      );
      sequencePass.setPipeline(surfaceStressCommit.pipeline);
      sequencePass.setBindGroup(
        0,
        surfaceStressCommitBindGroup
      );
      sequencePass.dispatchWorkgroupsIndirect(indirectBuffer, 0);
    }
    sequencePass.setPipeline(contact.pipeline);
    sequencePass.setBindGroup(0, contactBindGroup);
    sequencePass.dispatchWorkgroupsIndirect(indirectBuffer, 0);
    sequencePass.setPipeline(summarizeHeat.pipeline);
    sequencePass.setBindGroup(0, summarizeHeatBindGroup);
    sequencePass.dispatchWorkgroupsIndirect(indirectBuffer, 0);
    sequencePass.setPipeline(seal.pipeline);
    sequencePass.setBindGroup(0, sealBindGroup);
    sequencePass.dispatchWorkgroups(1);
    sequencePass.end();
    const commandBuffer = encoder.finish();
    if (gasPressureBoundaryBinding) {
      gasPressureBoundaryProducerClaim =
        sphSpatialGasPressureAuthorityQueueOrderedClaim(
          gasPressureBoundaryBinding.receipt,
          device
        );
      gasPressureBoundaryOwnedCleanupClaim =
        registerQueueOrderedCleanupClaim(
          gridUpdateSubmittedTemporaryCleanupClaimIssuer,
          device,
          {
            producerOutput: gasPressureBoundaryBinding,
            cleanup: cleanupOwnedBuffers
          }
        );
      const producerClaims = [
        gasPressureBoundaryProducerClaim,
        gasPressureBoundaryOwnedCleanupClaim
      ];
      assertQueueOrderedCleanupClaimsRegistered(device, producerClaims);
      try {
        gasPressureBoundarySubmissionAttempted = true;
        gasPressureBoundaryFinalConsumer =
          submitQueueOrderedFinalConsumerWork(
            device,
            [commandBuffer],
            {
              finalConsumerOwner: gasPressureBoundaryBinding,
              producerClaims
            }
          );
        submitted = true;
      } catch (error) {
        // Preflight above is synchronous and non-mutating; after it succeeds,
        // a throw from the combined helper is queue.submit uncertainty. Never
        // reopen the exact v4 consumer slot or its owner graph for a retry.
        submitted = true;
        gasPressureBoundarySubmitFailureQuarantined =
          quarantineSphSpatialGasPressureAuthorityAfterSubmitFailure(
            gasPressureBoundaryBinding.receipt,
            device,
            error instanceof Error ? error.message : String(error)
          );
        try {
          cancelQueueOrderedCleanupClaim(
            gasPressureBoundaryOwnedCleanupClaim,
            device,
            {
              producerOutput: gasPressureBoundaryBinding,
              cleanup: cleanupOwnedBuffers
            }
          );
          gasPressureBoundaryOwnedCleanupClaim = null;
        } catch {
          // Unknown submission acceptance keeps temporaries behind the fenced
          // failure cleanup in finally; it never authorizes immediate reuse.
        }
        throw error;
      }
      let postSubmitError = null;
      try {
        if (retireSphSpatialGasPressureAuthorityQueueOrdered(
          gasPressureBoundaryBinding.receipt,
          device,
          gasPressureBoundaryFinalConsumer
        ) !== true) {
          throw new Error(
            'Exact v4 gas pressure boundary submission did not retire its authority'
          );
        }
        gasPressureBoundaryRetired = true;
      } catch (error) {
        postSubmitError = error;
        gasPressureBoundarySubmitFailureQuarantined =
          quarantineSphSpatialGasPressureAuthorityAfterSubmitFailure(
            gasPressureBoundaryBinding.receipt,
            device,
            error instanceof Error ? error.message : String(error)
          ) || gasPressureBoundarySubmitFailureQuarantined;
      }
      try {
        gasPressureBoundaryOwnedCleanupReceipt =
          releaseSubmittedWorkCleanupQueueOrdered(
            device,
            cleanupOwnedBuffers,
            {
              queueOrderedFinalConsumer:
                gasPressureBoundaryFinalConsumer,
              producerClaim: gasPressureBoundaryOwnedCleanupClaim,
              producerOutput: gasPressureBoundaryBinding,
              producerFamily:
                'mls-mpm-grid-update-submitted-temporaries'
            }
          );
        gasPressureBoundaryOwnedCleanupClaimConsumed = true;
        if (ownedBuffers.size !== 0) {
          throw new Error(
            'Exact v4 gas pressure boundary temporary cleanup retained owned buffers'
          );
        }
      } catch (error) {
        postSubmitError ??= error;
      }
      if (postSubmitError) throw postSubmitError;
    } else if (fusedTransaction != null || singleLevelQueueOrderedCleanup) {
      queueOrderedSubmissionReceipt = submitQueueOrderedWork(
        device,
        [commandBuffer]
      );
    } else {
      device.queue.submit([commandBuffer]);
    }
    submitted = true;
    if (fusedTransaction != null) {
      if (fusedFineSubstep) {
        markSchroederFusedFineSubstepStageSubmissionObserved(
          device,
          fusedFineSubstepTransaction,
          {
            stage: 'grid-update',
            producerCapability: fusedProducerCapability
          }
        );
      } else {
        markSchroederFusedCoarseTerminalStageSubmissionObserved(
          device,
          fusedCoarseTerminalTransaction,
          {
            stage: 'grid-update',
            producerCapability: fusedProducerCapability
          }
        );
      }
    }
    const update = outputEnvelope({
      backend: 'webgpu',
      p2gGridProjection,
      updatedGridNodes: new Float32Array(),
      dt: dtSeconds,
      gravityMPerS2: gravity,
      boxDimsM: dims,
      cflFactor: cfl,
      pressureInterfaceForceSolver,
      wallBarrierContact,
      pressureInterfaceForceApplication: pressureInterfaceForceApplicationSummary({
        pressureInterfaceForceSolver,
        forceRowCount: 0,
        applicationApproved: false,
        impulseProofStatus: 'not-applicable-mechanics-field-grid-update'
      }),
      readbackMode: NO_FULL_READBACK_MODE,
      queueCompletionStatus:
        gasPressureBoundaryOwnedCleanupReceipt?.queueCompletionStatus
        ?? (device.queue?.onSubmittedWorkDone
          ? 'queue-submitted-cleanup-deferred'
          : 'queue-submitted-no-explicit-completion'),
      queueCompletionMethod:
        gasPressureBoundaryOwnedCleanupReceipt?.queueCompletionMethod
        ?? (device.queue?.onSubmittedWorkDone
          ? 'deferred queue.onSubmittedWorkDone cleanup'
          : null),
      readbackTelemetry: createGpuReadbackTelemetry({
        scope: 'mls-mpm-grid-update-webgpu',
        mapAsyncCount: 0,
        readbackBytes: 0
      })
    });
    update.mechanicsFieldMode = MLS_MPM_MECHANICS_FIELD_MODE_REQUIRED;
    update.status = 'submitted-unverified';
    update.fieldStateUpdateSubmittedInPlace = true;
    update.fieldStateUpdatedInPlace = false;
    update.mechanicsFieldIndirectDispatchDimensions = 2;
    update.mechanicsFieldIndirectDispatchLinearization =
      'linearGroup=workgroup.x+workgroup.y*dispatchX';
    update.mechanicsFieldSourceDispatchWorkgroups =
      fieldExecution.sourceDispatchWorkgroups;
    update.mechanicsFieldCandidateDispatchWorkgroups =
      fieldExecution.candidateDispatchWorkgroups;
    update.phaseVolumeSurfaceStressRequested =
      phaseVolumeSurfaceStressRequired;
    update.phaseVolumeSurfaceStressSubmitted =
      phaseVolumeSurfaceStressRequired
      && phaseVolumeSurfaceStressAuthority != null;
    update.phaseVolumeSurfaceStressSubmission =
      update.phaseVolumeSurfaceStressSubmitted
        ? Object.freeze({
            schema:
              ULG_SCHROEDER_PHASE_VOLUME_SURFACE_STRESS_SUBMISSION_SCHEMA,
            status:
              ULG_SCHROEDER_PHASE_VOLUME_SURFACE_STRESS_SUBMISSION_STATUS,
            requested: true,
            submitted: true,
            dispatchCount: surfaceStressStages.length,
            entryPoints: SCHROEDER_PHASE_VOLUME_SURFACE_STRESS_ENTRY_POINTS,
            lifecycleDispatchCount:
              standalonePhaseVolumeLifecycle
                ? surfaceStressStages.length + 3
                : surfaceStressStages.length,
            lifecycleMode:
              standalonePhaseVolumeLifecycle
                ? 'standalone-s9ab-initialize-ambient-eighteen-central-bonds-validate-commit'
                : 'integrated-s9c-transport-eighteen-central-bonds-validate-commit',
            ambientBuoyancyMode:
              standalonePhaseVolumeLifecycle
                ? 'field-local-s9ab-current-volume-ambient-source'
                : 'integrated-s9c-current-volume-ambient-source',
            generationId: phaseVolumeSurfaceStressAuthority.generationId,
            selectedLevel: fieldExecution.selectedLevel,
            levelRole: phaseVolumeSurfaceStressAuthority.levelRole,
            twoLevel: phaseVolumeSurfaceStressAuthority.twoLevel,
            fieldCompletionOrdinal:
              phaseVolumeSurfaceStressAuthority.phaseVolumeReceipt
                ?.completionOrdinal ?? null,
            materialTableSchema: mechanicsMaterialTable?.schema ?? null,
            phaseRecordCount:
              mechanicsMaterialPhaseUpload?.phaseRecordCount ?? 0,
            positiveSurfaceTensionPhaseRecordCount:
              mechanicsMaterialTable
                ?.positiveSurfaceTensionPhaseRecordCount ?? 0,
            surfaceTensionCoefficientStatus:
              mechanicsMaterialTable?.surfaceTensionCoefficientStatus ?? null,
            authority:
              'exact-s9-phase-volume-moment-and-mechanics-material-records',
            verification:
              'queue-submitted-no-full-readback'
          })
        : null;
    update.phaseVolumeAmbientBuoyancyRequired =
      ambientBuoyancyRequired;
    update.phaseVolumeAmbientBuoyancySubmitted =
      ambientBuoyancyRequired
      && phaseVolumeSurfaceStressAuthority != null;
    update.phaseVolumeAmbientBuoyancySubmission =
      update.phaseVolumeAmbientBuoyancySubmitted
        ? Object.freeze({
            schema:
              ULG_SCHROEDER_PHASE_VOLUME_AMBIENT_BUOYANCY_SUBMISSION_SCHEMA,
            status:
              ULG_SCHROEDER_PHASE_VOLUME_AMBIENT_BUOYANCY_SUBMISSION_STATUS,
            requested: true,
            submitted: true,
            dispatchCount: 3,
            entryPoints: standalonePhaseVolumeLifecycle
              ? [
                  'initialize_surface_stress',
                  'validate_surface_stress',
                  'commit_surface_stress'
                ]
              : [
                  'stage_transport',
                  'validate_staged_transport',
                  'commit_transport'
                ],
            lifecycleMode: standalonePhaseVolumeLifecycle
              ? 'standalone-s9ab-initialize-ambient-validate-commit'
              : 'integrated-s9c-transport-validate-commit',
            ambientBuoyancyMode: standalonePhaseVolumeLifecycle
              ? 'field-local-s9ab-current-volume-ambient-source'
              : 'integrated-s9c-current-volume-ambient-source',
            surfaceStressDispatchCount: surfaceStressStages.length,
            generationId: phaseVolumeSurfaceStressAuthority.generationId,
            selectedLevel: fieldExecution.selectedLevel,
            levelRole: phaseVolumeSurfaceStressAuthority.levelRole,
            twoLevel: phaseVolumeSurfaceStressAuthority.twoLevel,
            fieldCompletionOrdinal:
              phaseVolumeSurfaceStressAuthority.phaseVolumeReceipt
                ?.completionOrdinal ?? null,
            materialTableSchema: mechanicsMaterialTable?.schema ?? null,
            phaseRecordCount:
              mechanicsMaterialPhaseUpload?.phaseRecordCount ?? 0,
            ambientPressurePa:
              Math.max(0, finiteNumber(ambientPressurePa, 0)),
            ambientReferenceDensityKgPerM3:
              Math.max(
                0,
                finiteNumber(ambientReferenceDensityKgPerM3, 1.2041)
              ),
            authority:
              'exact-s9-phase-volume-moment-and-mechanics-material-records',
            verification:
              'queue-submitted-no-full-readback'
          })
        : null;
    update.gasPressureBoundaryRequested = gasPressureBoundaryRequested;
    update.gasPressureBoundarySubmitted =
      gasPressureBoundaryRequested
      && gasPressureBoundaryRetired
      && gasPressureBoundaryOwnedCleanupClaimConsumed;
    update.gasPressureBoundarySubmission =
      update.gasPressureBoundarySubmitted
        ? Object.freeze({
            schema:
              ULG_SCHROEDER_GAS_PRESSURE_BOUNDARY_SUBMISSION_SCHEMA,
            status:
              ULG_SCHROEDER_GAS_PRESSURE_BOUNDARY_SUBMISSION_STATUS,
            requested: true,
            submitted: true,
            authorityRetiredQueueOrdered: true,
            temporaryBuffersRetiredQueueOrdered: true,
            hostQueueFenceCount: 0,
            mapAsyncCount: 0,
            hostLogicalCountReadCount: 0,
            lifecycleDispatchCount:
              SCHROEDER_GAS_PRESSURE_BOUNDARY_ENTRY_POINTS.length,
            entryPoints: SCHROEDER_GAS_PRESSURE_BOUNDARY_ENTRY_POINTS,
            pipelineOrder:
              'post-grid-main-pre-s9-contact-summary-seal',
            sharedBindGroupLayout: true,
            capacityDispatchWorkgroups: Object.freeze([
              ...gasPressureBoundaryLayout.dispatchWorkgroups
            ]),
            fieldCapacity: gasPressureBoundaryBinding.fieldCapacity,
            generationId:
              gasPressureBoundaryPhaseVolumeAuthority.generationId,
            fieldCompletionOrdinal:
              gasPressureBoundaryPhaseVolumeAuthority.phaseVolumeReceipt
                .completionOrdinal,
            fieldMutationOrdinal: mutationToken.outputOrdinal,
            selectedLevel: gasPressureBoundaryBinding.level,
            chartId: gasPressureBoundaryBinding.chartId,
            gasAuthorityExecutionGeneration:
              gasPressureBoundaryBinding.executionGeneration,
            gasAuthorityStorageGeneration:
              gasPressureBoundaryBinding.storageGeneration,
            gasDirectoryGeneration:
              gasPressureBoundaryBinding.gasDirectory.generationId,
            ambientPressurePa: Math.max(
              0,
              finiteNumber(ambientPressurePa, 0)
            ),
            pressureScale: Math.max(
              0,
              finiteNumber(phaseVolumePressureScale, 1)
            ),
            missingCellPolicy: 'no-load-only-when-directory-key-absent',
            pressureAuthority:
              'exact-private-v4-gas-pressure-rows-and-sorted-directory',
            geometryAuthority:
              'exact-s9a-phase-volume-moments-authenticated-by-s9b',
            coupledPhases: Object.freeze(['solid', 'liquid']),
            oneSidedBoundaryLoad: true,
            reciprocalGasMomentumConservation: false,
            gasVelocityDegreeOfFreedomMode: 'not-modeled',
            reactionProductPressureAvailability:
              'next-mechanics-step-after-eos-publication',
            verification: 'queue-submitted-no-full-readback'
          })
        : null;
    if (gasPressureBoundaryOwnedCleanupReceipt) {
      update.queueOrderedCleanupReceipt =
        gasPressureBoundaryOwnedCleanupReceipt;
    }
    update.mechanicsFieldEnergyReceipt = Object.freeze({
      schema: 'peercompute.ulg.schroeder-mechanics-field-energy-receipt.v3',
      status: receiptModeFlags === 0
        ? 'energy-ready-submitted-unverified'
        : 'heat-building-deferred-to-reflux-owner',
      deferSeal: receiptModeFlags !== 0,
      fieldMutationOrdinal: mutationToken.outputOrdinal
    });
    Object.defineProperty(update, 'sourceProjection', {
      value: p2gGridProjection,
      enumerable: true
    });
    update.mechanicsFieldMutationInputOrdinal = mutationToken.expectedOrdinal;
    update.mechanicsFieldMutationOutputOrdinal = mutationToken.outputOrdinal;
    update.mechanicsFieldMutationInputStateEncoding = mutationToken.expectedEncoding;
    update.mechanicsFieldMutationOutputStateEncoding = mutationToken.outputEncoding;
    update.mechanicsFieldGridUpdateWorkspaceBorrowed = Boolean(
      gridUpdateWorkspace
    );
    update.mechanicsFieldGridUpdateHotPathAllocationCount =
      gridUpdateWorkspace ? 0 : 2;
    if (fusedTransaction != null) {
      const transactionProperty = fusedFineSubstep
        ? 'fusedFineSubstepTransaction'
        : 'fusedCoarseTerminalTransaction';
      const microepochProperty = fusedFineSubstep
        ? 'fineMicroepochAuthority'
        : 'terminalMicroepochAuthority';
      Object.defineProperties(update, {
        [transactionProperty]: {
          value: fusedTransaction,
          enumerable: false,
          configurable: false,
          writable: false
        },
        [microepochProperty]: {
          value: fusedTransaction.microepochAuthority,
          enumerable: false,
          configurable: false,
          writable: false
        },
        sourceParticleContinuation: {
          value: fusedTransaction.particleContinuation,
          enumerable: false,
          configurable: false,
          writable: false
        },
        proposalMode: {
          value: 'proposal-deferred-to-post-mechanics',
          enumerable: false,
          configurable: false,
          writable: false
        }
      });
    }
    registerSubmittedMechanicsFieldGridUpdate(
      device,
      update,
      p2gGridProjection,
      fieldExecution,
      fusedTransaction != null
        ? {
            transaction: fusedTransaction,
            transactionMode: fusedTransactionMode,
            particleContinuation: fusedTransaction.particleContinuation,
            mutationSegment: mutationToken,
          }
        : {}
    );
    if (fusedTransaction != null) {
      try {
        if (fusedFineSubstep) {
          markSchroederFusedFineSubstepStageSubmitted(
            device,
            fusedFineSubstepTransaction,
            {
              stage: 'grid-update',
              artifact: update,
              priorArtifact: p2gGridProjection,
              producerCapability: fusedProducerCapability
            }
          );
        } else {
          markSchroederFusedCoarseTerminalStageSubmitted(
            device,
            fusedCoarseTerminalTransaction,
            {
              stage: 'grid-update',
              artifact: update,
              priorArtifact: p2gGridProjection,
              producerCapability: fusedProducerCapability
            }
          );
        }
      } catch (error) {
        mechanicsFieldGridUpdateOrigins.delete(update);
        throw error;
      }
      mutationCommitted = true;
    }
    if (fusedTransaction == null) {
      fieldRuntime.markStateMutationSubmitted(mutationToken);
      mutationCommitted = true;
    }
    publishedUpdate = update;
    return update;
  } finally {
    if (fusedTransaction != null && submitted && !mutationCommitted) {
      try {
        const error = new Error(
          'Grid-update submission completed before fused artifact publication'
        );
        if (fusedFineSubstep) {
          quarantineSchroederFusedFineSubstepTransaction(
            device,
            fusedFineSubstepTransaction,
            error
          );
        } else {
          quarantineSchroederFusedCoarseTerminalTransaction(
            device,
            fusedCoarseTerminalTransaction,
            error
          );
        }
      } catch {
        // Preserve the producer error. This invocation submitted GPU work, so
        // the exact transaction is already observed or quarantined and cannot
        // be safely retried.
      }
    }
    if (mutationToken && !mutationCommitted && fusedTransaction == null) {
      try {
        if (submitted) {
          fieldRuntime.quarantineStateMutation(mutationToken, {
            submissionObserved: true,
            reason: new Error(
              'Grid-update submission completed before mechanics-field artifact publication'
            )
          });
        } else {
          fieldRuntime.discardStateMutation(
            mutationToken,
            { discardedEncoder: true }
          );
        }
      } catch {
        // Preserve the producer error. Submitted field state stays pending or
        // quarantined and cannot be mistaken for a publishable artifact.
      }
    }
    if (
      gasPressureBoundaryOwnedCleanupClaim != null
      && gasPressureBoundaryOwnedCleanupClaimConsumed !== true
      && gasPressureBoundarySubmissionAttempted !== true
    ) {
      try {
        cancelQueueOrderedCleanupClaim(
          gasPressureBoundaryOwnedCleanupClaim,
          device,
          {
            producerOutput: gasPressureBoundaryBinding,
            cleanup: cleanupOwnedBuffers
          }
        );
        gasPressureBoundaryOwnedCleanupClaim = null;
      } catch {
        // Preserve the producer error. A claim that became sealed implies
        // submission uncertainty and therefore must not authorize retry.
      }
    }
    if (
      gasPressureBoundaryBinding != null
      && gasPressureBoundarySubmissionAttempted !== true
      && gasPressureBoundaryRetired !== true
      && gasPressureBoundarySubmitFailureQuarantined !== true
    ) {
      try {
        abandonSphSpatialGasPressureAuthority(
          gasPressureBoundaryBinding.receipt
        );
      } catch {
        // Preserve the producer error; abandonment is limited to an exact
        // unsubmitted borrow and cannot release submitted authority.
      }
    }
    scheduleOwnedBufferCleanup();
  }
}

export async function runMlsMpmGridUpdateWebGpu({
  device,
  p2gGridProjection,
  p2gGridBuffer = null,
  pressureInterfaceForceRowsBuffer = null,
  pressureInterfaceForceSolver = null,
  pressureInterfaceGridForceAdmission = null,
  mechanicsFieldMode = p2gGridProjection?.mechanicsFieldMode
    ?? MLS_MPM_MECHANICS_FIELD_MODE_DISABLED,
  dt = p2gGridProjection?.dt ?? 0,
  gravityMPerS2 = DEFAULT_GRAVITY_M_PER_S2,
  boxDimsM = DEFAULT_BOX_DIMS_M,
  cflFactor = DEFAULT_CFL_FACTOR,
  wallBarrierElasticStiffnessNPerM = DEFAULT_WALL_BARRIER_ELASTIC_STIFFNESS_N_PER_M,
  wallBarrierMaterialBulkModulusPa = 0,
  wallBarrierMaterialShearModulusPa = 0,
  algorithmMaterialContactRows = null,
  wallBarrierContactScale = DEFAULT_WALL_BARRIER_CONTACT_SCALE,
  wallBarrierMinGapM = DEFAULT_WALL_BARRIER_MIN_GAP_M,
  mechanicsFieldEnergyReceipt = null,
  schroederSpatialEpochTransaction = null,
  schroederSingleLevelQueueOrderedCleanupCapability = null,
  mechanicsMaterialTable = null,
  mechanicsMaterialPhaseUpload = null,
  ambientPressurePa = 0,
  ambientReferenceDensityKgPerM3 = 1.2041,
  phaseVolumePressureScale = 1,
  phaseVolumeDragScale = 1,
  phaseVolumeMaxImpulseFraction = 0.5,
  phaseVolumeInterfaceTransportRequired = false,
  phaseVolumeAmbientBuoyancyRequired = false,
  gasPressureMechanicsAuthoritySource = null,
  gasPressureMechanicsChartId = 0,
  fusedFineSubstepTransaction = null,
  fusedCoarseTerminalTransaction = null,
  retainUpdatedGridBuffer = false,
  readbackMode = FULL_READBACK_MODE
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runMlsMpmGridUpdateWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  if (fusedFineSubstepTransaction != null
      && fusedCoarseTerminalTransaction != null) {
    throw new TypeError(
      'grid update accepts either a fused fine transaction or fused coarse-terminal transaction, never both'
    );
  }
  assertP2gGridProjection(p2gGridProjection);
  if (
    mechanicsFieldMode !== MLS_MPM_MECHANICS_FIELD_MODE_DISABLED
    && mechanicsFieldMode !== MLS_MPM_MECHANICS_FIELD_MODE_REQUIRED
  ) {
    throw new RangeError(
      `mechanicsFieldMode must be '${MLS_MPM_MECHANICS_FIELD_MODE_DISABLED}' or '${MLS_MPM_MECHANICS_FIELD_MODE_REQUIRED}'`
    );
  }
  if (
    p2gGridProjection.mechanicsFieldMode === MLS_MPM_MECHANICS_FIELD_MODE_REQUIRED
    && mechanicsFieldMode !== MLS_MPM_MECHANICS_FIELD_MODE_REQUIRED
  ) {
    throw new Error(
      'A required mechanics-field P2G artifact cannot be consumed through the dense grid-update mode'
    );
  }
  if (mechanicsFieldMode === MLS_MPM_MECHANICS_FIELD_MODE_REQUIRED) {
    if (p2gGridProjection.mechanicsFieldMode !== MLS_MPM_MECHANICS_FIELD_MODE_REQUIRED) {
      throw new Error(
        'Required mechanics-field grid update needs an explicitly required upstream P2G artifact'
      );
    }
    const fusedFineSubstep = fusedFineSubstepTransaction != null;
    const fusedCoarseTerminal = fusedCoarseTerminalTransaction != null;
    const fusedTransaction = fusedFineSubstepTransaction
      ?? fusedCoarseTerminalTransaction;
    const fusedTransactionMode = fusedFineSubstep
      ? 'fine'
      : fusedCoarseTerminal
        ? 'coarse-terminal'
        : null;
    if (
      fusedTransaction != null
      && mechanicsFieldEnergyReceipt?.deferSeal !== true
    ) {
      throw new TypeError(
        'Fused mechanics-field grid update requires deferred heat sealing for reflux ownership'
      );
    }
    if (fusedTransaction != null && !fusedMechanicsFieldGridUpdateAdmission(
      device,
      {
        p2gGridProjection,
        transaction: fusedTransaction,
        transactionMode: fusedTransactionMode,
        fieldExecution: fusedFineSubstep
          ? fusedTransaction.fineFieldView
          : fusedTransaction.coarseFieldView,
        dt
      }
    )) {
      throw new TypeError(
        'Fused mechanics-field grid update requires the exact locally submitted P2G artifact'
      );
    }
    const fusedProducerCapability = fusedTransaction == null
      ? null
      : fusedFineSubstep
        ? claimSchroederFusedFineSubstepStageProducer(
            device,
            fusedTransaction,
            { stage: 'grid-update', priorArtifact: p2gGridProjection }
          )
        : claimSchroederFusedCoarseTerminalStageProducer(
            device,
            fusedTransaction,
            { stage: 'grid-update', priorArtifact: p2gGridProjection }
          );
    try {
      return await runMlsMpmMechanicsFieldGridUpdateWebGpu({
        device,
        p2gGridProjection,
        p2gGridBuffer,
        pressureInterfaceForceRowsBuffer,
        pressureInterfaceForceSolver,
        dt,
        gravityMPerS2,
        boxDimsM,
        cflFactor,
        wallBarrierElasticStiffnessNPerM,
        wallBarrierMaterialBulkModulusPa,
        wallBarrierMaterialShearModulusPa,
        algorithmMaterialContactRows,
        wallBarrierContactScale,
        wallBarrierMinGapM,
        mechanicsFieldEnergyReceipt,
        schroederSpatialEpochTransaction,
        schroederSingleLevelQueueOrderedCleanupCapability,
        mechanicsMaterialTable,
        mechanicsMaterialPhaseUpload,
        ambientPressurePa,
        ambientReferenceDensityKgPerM3,
        phaseVolumePressureScale,
        phaseVolumeDragScale,
        phaseVolumeMaxImpulseFraction,
        phaseVolumeInterfaceTransportRequired,
        phaseVolumeAmbientBuoyancyRequired,
        gasPressureMechanicsAuthoritySource,
        gasPressureMechanicsChartId,
        fusedFineSubstepTransaction,
        fusedCoarseTerminalTransaction,
        fusedProducerCapability,
        retainUpdatedGridBuffer,
        readbackMode
      });
    } finally {
      if (fusedProducerCapability != null) {
        try {
          if (fusedFineSubstep) {
            releaseSchroederFusedFineSubstepStageProducer(
              device,
              fusedTransaction,
              fusedProducerCapability
            );
          } else {
            releaseSchroederFusedCoarseTerminalStageProducer(
              device,
              fusedTransaction,
              fusedProducerCapability
            );
          }
        } catch {
          // Observed/submitted work consumes or quarantines the capability;
          // only an unsubmitted producer is returned for an exact retry.
        }
      }
    }
  }
  if (p2gGridProjection.mechanicsFieldViewEnabled === true) {
    throw new Error(
      'A mechanics-field P2G artifact must be consumed with mechanicsFieldMode required'
    );
  }
  if (gasPressureMechanicsAuthoritySource != null) {
    throw new Error(
      'Exact v4 gas pressure mechanics authority requires mechanicsFieldMode required'
    );
  }
  const dtSeconds = finiteNumber(dt, 0);
  const gravity = finiteVector3(gravityMPerS2, DEFAULT_GRAVITY_M_PER_S2);
  const dims = finiteVector3(boxDimsM, DEFAULT_BOX_DIMS_M);
  const cfl = finiteNumber(cflFactor, DEFAULT_CFL_FACTOR);
  const elasticStiffness = resolveWallBarrierElasticStiffness({
    wallBarrierElasticStiffnessNPerM,
    wallBarrierMaterialBulkModulusPa,
    wallBarrierMaterialShearModulusPa,
    supportLengthM: finiteNumber(p2gGridProjection.gridSpacingM, 0),
    algorithmMaterialContactRows
  });
  const wallBarrierContact = createWallBarrierContactSummary({
    status: readbackMode === NO_FULL_READBACK_MODE
      ? 'wall-barrier-contact-submitted-unverified-no-full-readback'
      : 'wall-barrier-contact-submitted-webgpu-readback',
    wallBarrierElasticStiffnessNPerM: elasticStiffness.elasticNormalStiffnessNPerM,
    elasticStiffnessSource: elasticStiffness.source,
    materialPolicy: elasticStiffness.materialPolicy,
    bulkModulusPa: elasticStiffness.bulkModulusPa,
    shearModulusPa: elasticStiffness.shearModulusPa,
    supportLengthM: elasticStiffness.supportLengthM,
    wallBarrierContactScale: clamp01(wallBarrierContactScale),
    wallBarrierMinGapM: Math.max(1e-12, Math.abs(finiteNumber(wallBarrierMinGapM, DEFAULT_WALL_BARRIER_MIN_GAP_M)))
  });
  const outputByteLength = p2gGridProjection.gridNodeCount * MLS_MPM_GPU_GRID_VELOCITY_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const borrowedGridBuffer = p2gGridBuffer || p2gGridProjection.gridBuffer || p2gGridProjection.gpuResult?.gridBuffer || null;
  assertP2gGridProjection(p2gGridProjection, { requireGridNodes: !borrowedGridBuffer });
  const activeSourceDenseCompatibility =
    p2gGridProjection.activeSourceDenseCompatibilityEnabled === true;
  if (
    activeSourceDenseCompatibility
    && (
      readbackMode !== NO_FULL_READBACK_MODE
      || retainUpdatedGridBuffer !== true
    )
  ) {
    const error = new TypeError(
      'ActiveSource-v2 dense grid update requires retained no-full-readback execution'
    );
    error.code =
      'ERR_ACTIVE_SOURCE_V2_DENSE_GRID_RESIDENCY_REQUIRED';
    throw error;
  }
  if (
    activeSourceDenseCompatibility
    && !validateLocallySubmittedMlsMpmActiveSourceDenseP2g(
      device,
      p2gGridProjection,
      {
        selectedLevel:
          p2gGridProjection.schroederLevelFilter?.selectedLevel ?? null,
        gridBuffer: borrowedGridBuffer,
        requireNoFullReadback: true
      }
    )
  ) {
    const error = new TypeError(
      'ActiveSource-v2 dense grid update requires the exact locally submitted single-level P2G artifact'
    );
    error.code =
      'ERR_ACTIVE_SOURCE_V2_DENSE_P2G_PROVENANCE_REJECTED';
    throw error;
  }
  if (
    activeSourceDenseCompatibility
    && (
      !borrowedGridBuffer
      || borrowedGridBuffer.destroyed === true
      || !webGpuBufferMatchesDevice(borrowedGridBuffer, device)
      || (
        Number.isFinite(Number(borrowedGridBuffer.size))
        && Number(borrowedGridBuffer.size) < outputByteLength
      )
    )
  ) {
    const error = new TypeError(
      'ActiveSource-v2 dense grid update requires the exact live retained P2G grid buffer'
    );
    error.code =
      'ERR_ACTIVE_SOURCE_V2_DENSE_GRID_BUFFER_REJECTED';
    throw error;
  }
  const solverGridApplicationApproved = pressureInterfaceForceSolverAllowsGridApplication(pressureInterfaceForceSolver);
  const candidatePressureForceRows = solverGridApplicationApproved
    ? pressureForceRowsFromSolver(pressureInterfaceForceSolver)
    : null;
  const candidatePressureForceRowCount = solverGridApplicationApproved
    ? pressureForceRowCountFromSolver(pressureInterfaceForceSolver, candidatePressureForceRows)
    : 0;
  const borrowedPressureForceRowsBuffer = pressureInterfaceForceRowsBuffer || null;
  const pressureAdmissionDescriptor = pressureInterfaceGridForceAdmissionDescriptor(
    pressureInterfaceGridForceAdmission
  );
  const directPressureRowsBufferDeviceAccepted =
    pressureAdmissionDescriptor?.schema
      !== ULG_DIRECT_RESIDENT_PRESSURE_INTERFACE_PUBLICATION_SCHEMA
    || (
      Boolean(borrowedPressureForceRowsBuffer)
      && webGpuBufferDevice(borrowedPressureForceRowsBuffer) === device
    );
  const pressureForceApplicationApproved = solverGridApplicationApproved
    && directPressureRowsBufferDeviceAccepted
    && pressureInterfaceGridForceAdmissionAllowsApplication({
      pressureInterfaceGridForceAdmission,
      pressureInterfaceForceSolver,
      forceRowCount: candidatePressureForceRowCount,
      consumerDeviceId: webGpuDeviceId(device)
    }).approved === true;
  const pressureForceRows = pressureForceApplicationApproved ? candidatePressureForceRows : null;
  const pressureForceRowCount = pressureForceApplicationApproved ? candidatePressureForceRowCount : 0;
  const pressureForceRowsFromArray = pressureForceRows instanceof Float32Array
    && pressureForceRows.length >= SPH_PRESSURE_INTERFACE_FORCE_FLOATS;
  const pressureForceRowsFromBorrowedBuffer = Boolean(borrowedPressureForceRowsBuffer)
    && pressureForceApplicationApproved
    && pressureForceRowCount > 0;
  const pressureForceRowsSource = pressureForceRowsFromBorrowedBuffer && !pressureForceRowsFromArray
    ? 'retained-gpu-pressure-force-row-buffer'
    : (pressureForceRowsFromArray ? 'solver-force-row-values' : null);
  const sourceGridBuffer = borrowedGridBuffer || writeStorageBuffer(device, 'ulg-mls-mpm-grid-update-p2g-in', p2gGridProjection.gridNodes);
  const sourcePressureForceRowsBuffer = borrowedPressureForceRowsBuffer || writeStorageBuffer(
    device,
    'ulg-mls-mpm-grid-update-pressure-force-rows',
    pressureForceRows instanceof Float32Array && pressureForceRows.length >= SPH_PRESSURE_INTERFACE_FORCE_FLOATS
      ? pressureForceRows
      : EMPTY_PRESSURE_INTERFACE_FORCE_ROWS
  );
  const updatedGridBuffer = device.createBuffer({
    label: 'ulg-mls-mpm-grid-update-out',
    size: Math.max(4, outputByteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-mls-mpm-grid-update-params',
    size: MLS_MPM_GRID_UPDATE_PARAMS_BYTES,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const noFullReadback = readbackMode === NO_FULL_READBACK_MODE;
  let queueCompletionStatus = 'not-submitted';
  let queueCompletionMethod = null;
  const readBuffer = noFullReadback
    ? null
    : device.createBuffer({
      label: 'ulg-mls-mpm-grid-update-readback',
      size: Math.max(4, outputByteLength),
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  let returnedRetainedUpdatedGridBuffer = false;
  let update = null;

  try {
    device.queue.writeBuffer(paramsBuffer, 0, createGridUpdateParamsArray({
      p2gGridProjection,
      dt: dtSeconds,
      gravityMPerS2: gravity,
      boxDimsM: dims,
      cflFactor: cfl,
      pressureInterfaceForceRowCount: pressureForceRowCount,
      wallBarrierElasticStiffnessNPerM: wallBarrierContact.wallBarrierElasticStiffnessNPerM,
      wallBarrierContactScale: wallBarrierContact.wallBarrierContactScale,
      wallBarrierMinGapM: wallBarrierContact.wallBarrierMinGapM
    }));
    const { pipeline, bindGroupLayout } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-mls-mpm-grid-update.v2',
      label: 'ulg-mls-mpm-grid-update',
      code: mlsMpmGridUpdateWgsl,
      entryPoint: 'main',
      bindings: [
        computeBufferBinding(0, 'read-only-storage'),
        computeBufferBinding(1, 'storage'),
        computeBufferBinding(2, 'uniform'),
        computeBufferBinding(3, 'read-only-storage')
      ]
    });
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: sourceGridBuffer } },
        { binding: 1, resource: { buffer: updatedGridBuffer } },
        { binding: 2, resource: { buffer: paramsBuffer } },
        { binding: 3, resource: { buffer: sourcePressureForceRowsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.max(1, Math.ceil(p2gGridProjection.gridNodeCount / 64)));
    pass.end();
    if (!noFullReadback) {
      encoder.copyBufferToBuffer(updatedGridBuffer, 0, readBuffer, 0, Math.max(4, outputByteLength));
    }
    device.queue.submit([encoder.finish()]);
    queueCompletionStatus = 'queue-submitted';
    queueCompletionMethod = 'queue.submit';
    let updatedGridNodes = new Float32Array();
    if (!noFullReadback) {
      await readBuffer.mapAsync(GPU_MAP_MODE.READ);
      queueCompletionStatus = 'readback-map-completed';
      queueCompletionMethod = 'mapAsync(readback-buffer)';
      updatedGridNodes = new Float32Array(readBuffer.getMappedRange()).slice(0, p2gGridProjection.gridNodeCount * MLS_MPM_GPU_GRID_VELOCITY_FLOATS);
      readBuffer.unmap();
    } else {
      queueCompletionStatus = device.queue?.onSubmittedWorkDone
        ? 'queue-submitted-cleanup-deferred'
        : 'queue-submitted-no-explicit-completion';
      queueCompletionMethod = device.queue?.onSubmittedWorkDone
        ? 'deferred queue.onSubmittedWorkDone cleanup'
        : null;
    }
    update = outputEnvelope({
      backend: 'webgpu',
      p2gGridProjection,
      updatedGridNodes,
      dt: dtSeconds,
      gravityMPerS2: gravity,
      boxDimsM: dims,
      cflFactor: cfl,
      pressureInterfaceForceSolver,
      wallBarrierContact,
      pressureInterfaceForceApplication: pressureInterfaceForceApplicationSummary({
        pressureInterfaceForceSolver,
        pressureInterfaceGridForceAdmission,
        consumerDeviceId: webGpuDeviceId(device),
        forceRowCount: pressureForceRowCount,
        forceRowsSource: pressureForceRowsSource,
        forceRowsBufferSubmitted: pressureForceRowsFromBorrowedBuffer,
        appliedImpulseNSeconds: pressureForceRowsFromArray
          ? pressureInterfaceAppliedImpulseFromRows(pressureForceRows, pressureForceRowCount, dtSeconds)
          : [0, 0, 0],
        appliedImpulseSource: pressureForceRowsFromBorrowedBuffer && !pressureForceRowsFromArray
          ? (noFullReadback
              ? 'pressure-force-row-buffer-submitted-no-full-readback'
              : 'pressure-force-row-buffer-submitted')
          : (noFullReadback
              ? 'pressure-force-row-sum-unverified-no-full-readback'
              : 'pressure-force-row-sum-unverified'),
        impulseProofStatus: pressureForceRowsFromBorrowedBuffer && !pressureForceRowsFromArray
          ? (noFullReadback
              ? 'submitted-retained-pressure-force-row-buffer-to-gpu-grid-update-no-full-readback'
              : 'submitted-retained-pressure-force-row-buffer-to-gpu-grid-update')
          : (noFullReadback
              ? 'submitted-to-gpu-grid-update-no-full-readback'
              : 'submitted-to-gpu-grid-update'),
        applicationApproved: pressureForceApplicationApproved
      }),
      readbackMode: noFullReadback ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE,
      queueCompletionStatus,
      queueCompletionMethod,
      readbackTelemetry: createGpuReadbackTelemetry({
        scope: 'mls-mpm-grid-update-webgpu',
        mapAsyncCount: noFullReadback ? 0 : 1,
        readbackBytes: noFullReadback ? 0 : Math.max(4, outputByteLength)
      })
    });
    Object.defineProperty(update, 'sourceProjection', {
      value: p2gGridProjection,
      enumerable: true
    });
    update.activeSourceDenseCompatibilityEnabled =
      activeSourceDenseCompatibility;
    update.activeSourceDenseCompatibilityScope =
      activeSourceDenseCompatibility
        ? p2gGridProjection.activeSourceDenseCompatibilityScope
        : null;
    update.activeSourceDenseCompatibilityPreflight =
      activeSourceDenseCompatibility
        ? p2gGridProjection.activeSourceDenseCompatibilityPreflight
        : null;
    if (retainUpdatedGridBuffer) {
      update.updatedGridBuffer = updatedGridBuffer;
      update.updatedGridBufferByteLength = outputByteLength;
      update.destroyUpdatedGridBuffer = () => updatedGridBuffer.destroy?.();
    }
    if (activeSourceDenseCompatibility) {
      registerSubmittedActiveSourceDenseGridUpdate(device, update, {
        sourceProjection: p2gGridProjection,
        sourceGridBuffer,
        updatedGridBuffer
      });
    }
    if (retainUpdatedGridBuffer) {
      returnedRetainedUpdatedGridBuffer = true;
    }
    return update;
  } finally {
    const cleanup = () => {
      if (!borrowedGridBuffer) sourceGridBuffer.destroy?.();
      if (!borrowedPressureForceRowsBuffer) sourcePressureForceRowsBuffer.destroy?.();
      if (!retainUpdatedGridBuffer || !returnedRetainedUpdatedGridBuffer) updatedGridBuffer.destroy?.();
      paramsBuffer.destroy?.();
      readBuffer?.destroy?.();
    };
    if (noFullReadback) {
      const deferredHostQueueFenceScheduled =
        deferSubmittedWorkCleanup(device, cleanup);
      if (deferredHostQueueFenceScheduled && update) {
        appendGpuReadbackTelemetryObservation(update, {
          hostQueueFenceCount: 1,
          deferredCleanupHostQueueFenceCount: 1
        }, {
          source: 'mls-mpm-grid-update-temporary-cleanup'
        });
      }
    } else {
      cleanup();
    }
  }
}

function createNoFullReadbackParityReport(tolerance = 1e-5) {
  return {
    schema: ULG_MLS_MPM_GPU_GRID_UPDATE_PARITY_SCHEMA,
    status: 'not-run-no-full-readback',
    tolerance,
    maxGridAbs: null,
    lengthMismatch: null,
    reason: 'Full grid-update readback and CPU parity were skipped for resident WebGPU execution',
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

export function createMlsMpmGridUpdateParityReport({ cpuReference, gpuResult, tolerance = 1e-5 } = {}) {
  const cpuGrid = cpuReference?.updatedGridNodes;
  const gpuGrid = gpuResult?.updatedGridNodes;
  if (!(cpuGrid instanceof Float32Array) || !(gpuGrid instanceof Float32Array)) {
    return {
      schema: ULG_MLS_MPM_GPU_GRID_UPDATE_PARITY_SCHEMA,
      status: 'fail',
      tolerance,
      maxGridAbs: Number.POSITIVE_INFINITY,
      lengthMismatch: true,
      reason: 'missing updated grid buffers',
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  }
  const comparisonCount = Math.min(cpuGrid.length, gpuGrid.length);
  let maxGridAbs = 0;
  for (let index = 0; index < comparisonCount; index += 1) {
    maxGridAbs = Math.max(maxGridAbs, Math.abs(cpuGrid[index] - gpuGrid[index]));
  }
  const lengthMismatch = cpuGrid.length !== gpuGrid.length;
  return {
    schema: ULG_MLS_MPM_GPU_GRID_UPDATE_PARITY_SCHEMA,
    status: !lengthMismatch && maxGridAbs <= tolerance ? 'pass' : 'fail',
    tolerance,
    maxGridAbs,
    lengthMismatch,
    gridNodeCount: cpuReference?.gridNodeCount ?? gpuResult?.gridNodeCount ?? 0,
    cpuBackend: cpuReference?.backend ?? null,
    gpuBackend: gpuResult?.backend ?? null,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function executionFromUpdate(update, {
  cpuReference = null,
  gpuResult = null,
  webgpuStatus,
  webgpuParity = null
} = {}) {
  return {
    schema: ULG_MLS_MPM_GPU_GRID_UPDATE_EXECUTION_SCHEMA,
    updateSchema: update?.schema || ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
    backend: update?.backend || 'cpu-reference',
    status: update?.status || 'updated',
    kernelScope: GRID_UPDATE_SCOPE,
    particleCount: update?.particleCount ?? 0,
    gridSpacingM: update?.gridSpacingM ?? 0,
    gridDims: update?.gridDims ?? [],
    gridNodeCount: update?.gridNodeCount ?? 0,
    gridShift: update?.gridShift ?? 1,
    gridNodeStrideFloats: MLS_MPM_GPU_GRID_VELOCITY_FLOATS,
    dt: update?.dt ?? 0,
    gravityMPerS2: update?.gravityMPerS2 ?? [],
    boxDimsM: update?.boxDimsM ?? [],
    cflFactor: update?.cflFactor ?? 0,
    pressureInterfaceForceSolverSchema: update?.pressureInterfaceForceSolverSchema ?? null,
    pressureInterfaceForceSolverStatus: update?.pressureInterfaceForceSolverStatus ?? null,
    pressureInterfaceForceCouplingStatus: update?.pressureInterfaceForceCouplingStatus ?? null,
    pressureInterfaceForceApplicationStatus: update?.pressureInterfaceForceApplicationStatus ?? null,
    pressureInterfaceGridForceAdmissionSchema: update?.pressureInterfaceGridForceAdmissionSchema ?? null,
    pressureInterfaceGridForceAdmissionStatus: update?.pressureInterfaceGridForceAdmissionStatus ?? null,
    pressureInterfaceGridForceAdmissionApproved: update?.pressureInterfaceGridForceAdmissionApproved ?? false,
    pressureInterfaceGridForceAdmissionDescriptorStatus: update?.pressureInterfaceGridForceAdmissionDescriptorStatus ?? null,
    pressureInterfaceGridForceAdmissionSourceHotBufferKey: update?.pressureInterfaceGridForceAdmissionSourceHotBufferKey ?? null,
    pressureInterfaceForceRowCount: update?.pressureInterfaceForceRowCount ?? 0,
    pressureInterfaceAppliedImpulseNSeconds: update?.pressureInterfaceAppliedImpulseNSeconds ?? [0, 0, 0],
    pressureInterfaceAppliedImpulseMagnitudeNSeconds: update?.pressureInterfaceAppliedImpulseMagnitudeNSeconds ?? 0,
    pressureInterfaceAppliedImpulseSource: update?.pressureInterfaceAppliedImpulseSource ?? null,
    pressureInterfaceImpulseProofStatus: update?.pressureInterfaceImpulseProofStatus ?? null,
    pressureInterfaceForceConsumerStatus: update?.pressureInterfaceForceConsumerStatus ?? null,
    wallBarrierContactSchema: update?.wallBarrierContactSchema ?? ULG_MLS_MPM_WALL_BARRIER_CONTACT_SCHEMA,
    wallBarrierContactStatus: update?.wallBarrierContactStatus ?? null,
    wallBarrierContactMode: update?.wallBarrierContactMode ?? null,
    wallBarrierElasticStiffnessNPerM: update?.wallBarrierElasticStiffnessNPerM ?? DEFAULT_WALL_BARRIER_ELASTIC_STIFFNESS_N_PER_M,
    wallBarrierElasticStiffnessSource: update?.wallBarrierElasticStiffnessSource ?? null,
    wallBarrierContactMaterialPolicySchema: update?.wallBarrierContactMaterialPolicySchema ?? null,
    wallBarrierContactMaterialPolicyStatus: update?.wallBarrierContactMaterialPolicyStatus ?? null,
    wallBarrierContactMaterialPolicySource: update?.wallBarrierContactMaterialPolicySource ?? null,
    wallBarrierContactAlgorithmRowsSchema: update?.wallBarrierContactAlgorithmRowsSchema ?? null,
    wallBarrierContactAlgorithmRowStatus: update?.wallBarrierContactAlgorithmRowStatus ?? null,
    wallBarrierContactAlgorithmPairKey: update?.wallBarrierContactAlgorithmPairKey ?? null,
    wallBarrierContactAlgorithmMaterials: update?.wallBarrierContactAlgorithmMaterials ?? [],
    wallBarrierContactAlgorithmPhases: update?.wallBarrierContactAlgorithmPhases ?? [],
    wallBarrierContactAlgorithmNormalStiffnessPa: update?.wallBarrierContactAlgorithmNormalStiffnessPa ?? 0,
    wallBarrierBulkModulusPa: update?.wallBarrierBulkModulusPa ?? 0,
    wallBarrierShearModulusPa: update?.wallBarrierShearModulusPa ?? 0,
    wallBarrierSupportLengthM: update?.wallBarrierSupportLengthM ?? 0,
    wallBarrierContactScale: update?.wallBarrierContactScale ?? DEFAULT_WALL_BARRIER_CONTACT_SCALE,
    wallBarrierMinGapM: update?.wallBarrierMinGapM ?? DEFAULT_WALL_BARRIER_MIN_GAP_M,
    wallBarrierContactNodeCount: update?.wallBarrierContactNodeCount ?? 0,
    wallBarrierContactMaxResponseAlpha: update?.wallBarrierContactMaxResponseAlpha ?? 0,
    wallBarrierContactMaxNormalStiffness: update?.wallBarrierContactMaxNormalStiffness ?? 0,
    wallBarrierContactTotalVelocityCorrectionMPerS: update?.wallBarrierContactTotalVelocityCorrectionMPerS ?? 0,
    wallBarrierContactMaxVelocityCorrectionMPerS: update?.wallBarrierContactMaxVelocityCorrectionMPerS ?? 0,
    updatedGridNodes: update?.updatedGridNodes ?? new Float32Array(),
    readbackMode: update?.readbackMode ?? FULL_READBACK_MODE,
    queueCompletionStatus: update?.queueCompletionStatus ?? null,
    queueCompletionMethod: update?.queueCompletionMethod ?? null,
    fullReadbackPerformed:
      update?.fullReadbackPerformed
      ?? update?.readbackMode !== NO_FULL_READBACK_MODE,
    normalHotLoopReadbackFree: update?.normalHotLoopReadbackFree ?? false,
    fullParticleReadbackPerformed:
      update?.fullParticleReadbackPerformed
      ?? update?.fullReadbackPerformed
      ?? update?.readbackMode !== NO_FULL_READBACK_MODE,
    fullParticleReadbackFree:
      typeof update?.fullParticleReadbackFree === 'boolean'
        ? update.fullParticleReadbackFree
        : (
            update?.readbackMode === NO_FULL_READBACK_MODE
            || update?.fullParticleReadbackPerformed === false
          ),
    ...mergeGpuReadbackTelemetry([
      { source: 'update', telemetry: update }
    ], {
      scope: 'mls-mpm-grid-update-execution'
    }),
    mechanicsFieldMode:
      update?.mechanicsFieldMode ?? MLS_MPM_MECHANICS_FIELD_MODE_DISABLED,
    mechanicsFieldViewEnabled:
      update?.mechanicsFieldViewEnabled === true,
    mechanicsFieldViewExecution:
      update?.mechanicsFieldViewExecution ?? null,
    mechanicsFieldViewBuffer:
      update?.mechanicsFieldViewBuffer ?? null,
    mechanicsFieldViewByteLength:
      update?.mechanicsFieldViewByteLength ?? 0,
    mechanicsFieldViewOwned: false,
    gridStateAuthority:
      update?.gridStateAuthority ?? 'dense-mls-mpm-grid-state',
    denseGridAuthoritative:
      update?.denseGridAuthoritative !== false,
    activeSourceDenseCompatibilityEnabled:
      update?.activeSourceDenseCompatibilityEnabled === true,
    activeSourceDenseCompatibilityScope:
      update?.activeSourceDenseCompatibilityScope ?? null,
    activeSourceDenseCompatibilityPreflight:
      update?.activeSourceDenseCompatibilityPreflight ?? null,
    fieldStateUpdatedInPlace:
      update?.fieldStateUpdatedInPlace === true,
    fieldStateUpdateSubmittedInPlace:
      update?.fieldStateUpdateSubmittedInPlace === true,
    sourceProjection: update?.sourceProjection ?? null,
    mechanicsFieldMutationInputOrdinal:
      update?.mechanicsFieldMutationInputOrdinal ?? null,
    mechanicsFieldMutationOutputOrdinal:
      update?.mechanicsFieldMutationOutputOrdinal ?? null,
    mechanicsFieldMutationInputStateEncoding:
      update?.mechanicsFieldMutationInputStateEncoding ?? null,
    mechanicsFieldMutationOutputStateEncoding:
      update?.mechanicsFieldMutationOutputStateEncoding ?? null,
    phaseVolumeSurfaceStressRequested:
      update?.phaseVolumeSurfaceStressRequested === true,
    phaseVolumeSurfaceStressSubmitted:
      update?.phaseVolumeSurfaceStressSubmitted === true,
    phaseVolumeSurfaceStressSubmission:
      update?.phaseVolumeSurfaceStressSubmission ?? null,
    phaseVolumeAmbientBuoyancyRequired:
      update?.phaseVolumeAmbientBuoyancyRequired === true,
    phaseVolumeAmbientBuoyancySubmitted:
      update?.phaseVolumeAmbientBuoyancySubmitted === true,
    phaseVolumeAmbientBuoyancySubmission:
      update?.phaseVolumeAmbientBuoyancySubmission ?? null,
    gasPressureBoundaryRequested:
      update?.gasPressureBoundaryRequested === true,
    gasPressureBoundarySubmitted:
      update?.gasPressureBoundarySubmitted === true,
    gasPressureBoundarySubmission:
      update?.gasPressureBoundarySubmission ?? null,
    cpuReference,
    gpuResult,
    webgpuStatus,
    webgpuParity,
    p2gProjectionValidation: false,
    stressProjectionValidation: false,
    gridUpdateValidation: false,
    gridValidation: false,
    g2pValidation: false,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function describeDeviceLost(info) {
  return info?.reason || info?.message || 'device lost';
}

function watchDeviceLost(device, onDeviceLost) {
  if (!device?.lost?.then) return;
  device.lost.then((info) => onDeviceLost(info)).catch((error) => onDeviceLost(error));
}

export async function runMlsMpmGridUpdateWithOptionalWebGpu({
  p2gGridProjection,
  p2gGridBuffer = null,
  pressureInterfaceForceRowsBuffer = null,
  pressureInterfaceForceSolver = null,
  pressureInterfaceGridForceAdmission = null,
  mechanicsFieldMode = p2gGridProjection?.mechanicsFieldMode
    ?? MLS_MPM_MECHANICS_FIELD_MODE_DISABLED,
  dt = p2gGridProjection?.dt ?? 0,
  gravityMPerS2 = DEFAULT_GRAVITY_M_PER_S2,
  boxDimsM = DEFAULT_BOX_DIMS_M,
  cflFactor = DEFAULT_CFL_FACTOR,
  wallBarrierElasticStiffnessNPerM = DEFAULT_WALL_BARRIER_ELASTIC_STIFFNESS_N_PER_M,
  wallBarrierMaterialBulkModulusPa = 0,
  wallBarrierMaterialShearModulusPa = 0,
  algorithmMaterialContactRows = null,
  wallBarrierContactScale = DEFAULT_WALL_BARRIER_CONTACT_SCALE,
  wallBarrierMinGapM = DEFAULT_WALL_BARRIER_MIN_GAP_M,
  fusedFineSubstepTransaction = null,
  fusedCoarseTerminalTransaction = null,
  mechanicsFieldEnergyReceipt = null,
  schroederSpatialEpochTransaction = null,
  schroederSingleLevelQueueOrderedCleanupCapability = null,
  mechanicsMaterialTable = null,
  mechanicsMaterialPhaseUpload = null,
  ambientPressurePa = 0,
  ambientReferenceDensityKgPerM3 = 1.2041,
  phaseVolumePressureScale = 1,
  phaseVolumeDragScale = 1,
  phaseVolumeMaxImpulseFraction = 0.5,
  phaseVolumeInterfaceTransportRequired = false,
  phaseVolumeAmbientBuoyancyRequired = false,
  gasPressureMechanicsAuthoritySource = null,
  gasPressureMechanicsChartId = 0,
  preferWebGpu = false,
  navigatorRef = globalThis.navigator,
  device = null,
  deviceResult = null,
  parityTolerance = 1e-5,
  retainUpdatedGridBuffer = false,
  onDeviceLost = null,
  webGpuRunner = runMlsMpmGridUpdateWebGpu,
  readbackMode = FULL_READBACK_MODE
} = {}) {
  const noFullReadback = readbackMode === NO_FULL_READBACK_MODE;
  const mechanicsFieldRequired =
    mechanicsFieldMode === MLS_MPM_MECHANICS_FIELD_MODE_REQUIRED;
  const activeSourceDenseCompatibilityRequired =
    p2gGridProjection?.activeSourceDenseCompatibilityEnabled === true;
  if (
    gasPressureMechanicsAuthoritySource != null
    && !mechanicsFieldRequired
  ) {
    throw new Error(
      'Exact v4 gas pressure mechanics authority requires mechanicsFieldMode required'
    );
  }
  const residentWebGpuRequired =
    mechanicsFieldRequired
    || activeSourceDenseCompatibilityRequired
    || gasPressureMechanicsAuthoritySource != null;
  if (
    mechanicsFieldMode !== MLS_MPM_MECHANICS_FIELD_MODE_DISABLED
    && !mechanicsFieldRequired
  ) {
    throw new RangeError(
      `mechanicsFieldMode must be '${MLS_MPM_MECHANICS_FIELD_MODE_DISABLED}' or '${MLS_MPM_MECHANICS_FIELD_MODE_REQUIRED}'`
    );
  }
  if (
    activeSourceDenseCompatibilityRequired
    && (
      !noFullReadback
      || retainUpdatedGridBuffer !== true
    )
  ) {
    throw new TypeError(
      'ActiveSource-v2 dense grid update requires retained no-full-readback WebGPU execution'
    );
  }
  let cpuReference = null;
  const getCpuReference = () => {
    if (!cpuReference) {
      cpuReference = updateMlsMpmGridCpu({
        p2gGridProjection,
        dt,
        gravityMPerS2,
        boxDimsM,
        cflFactor,
        wallBarrierElasticStiffnessNPerM,
        wallBarrierMaterialBulkModulusPa,
        wallBarrierMaterialShearModulusPa,
        algorithmMaterialContactRows,
        wallBarrierContactScale,
        wallBarrierMinGapM,
        pressureInterfaceForceSolver,
        pressureInterfaceGridForceAdmission
      });
    }
    return cpuReference;
  };
  if (!preferWebGpu) {
    if (residentWebGpuRequired) {
      throw new Error(
        'Required resident grid update cannot use the CPU reference path'
      );
    }
    const reference = getCpuReference();
    return executionFromUpdate(reference, {
      cpuReference: reference,
      webgpuStatus: {
        status: 'not-requested',
        reason: 'WebGPU MLS-MPM grid update path not requested'
      }
    });
  }
  try {
    let lostInfo = null;
    const resolvedDeviceResult = device
      ? { status: 'webgpu-device-ready', reason: 'provided device', device }
      : (deviceResult || await requestOpticalGpuDevice(navigatorRef, {
        onDeviceLost(info) {
          lostInfo = info;
          if (typeof onDeviceLost === 'function') onDeviceLost(info);
        }
      }));
    if (resolvedDeviceResult.device && device) {
      watchDeviceLost(resolvedDeviceResult.device, (info) => {
        lostInfo = info;
        if (typeof onDeviceLost === 'function') onDeviceLost(info);
      });
    }
    if (!resolvedDeviceResult.device) {
      if (residentWebGpuRequired) {
        throw new Error(
          resolvedDeviceResult.reason
          || 'Required resident grid update has no WebGPU device'
        );
      }
      const reference = getCpuReference();
      return executionFromUpdate(reference, {
        cpuReference: reference,
        webgpuStatus: {
          status: resolvedDeviceResult.status,
          reason: resolvedDeviceResult.reason,
          fallback: 'cpu-reference'
        }
      });
    }
    await Promise.resolve();
    if (lostInfo) {
      if (residentWebGpuRequired) {
        throw new Error(
          `Required resident grid update lost its device: ${describeDeviceLost(lostInfo)}`
        );
      }
      const reference = getCpuReference();
      return executionFromUpdate(reference, {
        cpuReference: reference,
        webgpuStatus: {
          status: 'webgpu-device-lost-fallback',
          reason: describeDeviceLost(lostInfo),
          fallback: 'cpu-reference'
        }
      });
    }
    const gpuResult = await webGpuRunner({
      device: resolvedDeviceResult.device,
      p2gGridProjection,
      p2gGridBuffer,
      pressureInterfaceForceRowsBuffer,
      pressureInterfaceForceSolver,
      pressureInterfaceGridForceAdmission,
      mechanicsFieldMode,
      dt,
      gravityMPerS2,
      boxDimsM,
      cflFactor,
      wallBarrierElasticStiffnessNPerM,
      wallBarrierMaterialBulkModulusPa,
      wallBarrierMaterialShearModulusPa,
      algorithmMaterialContactRows,
      wallBarrierContactScale,
      wallBarrierMinGapM,
      fusedFineSubstepTransaction,
      fusedCoarseTerminalTransaction,
      mechanicsFieldEnergyReceipt,
      schroederSpatialEpochTransaction,
      schroederSingleLevelQueueOrderedCleanupCapability,
      mechanicsMaterialTable,
      mechanicsMaterialPhaseUpload,
      ambientPressurePa,
      ambientReferenceDensityKgPerM3,
      phaseVolumePressureScale,
      phaseVolumeDragScale,
      phaseVolumeMaxImpulseFraction,
      phaseVolumeInterfaceTransportRequired,
      phaseVolumeAmbientBuoyancyRequired,
      gasPressureMechanicsAuthoritySource,
      gasPressureMechanicsChartId,
      retainUpdatedGridBuffer,
      readbackMode: noFullReadback ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE
    });
    await Promise.resolve();
    if (lostInfo) {
      gpuResult.destroyUpdatedGridBuffer?.();
      if (residentWebGpuRequired) {
        throw new Error(
          `Required resident grid update lost its device: ${describeDeviceLost(lostInfo)}`
        );
      }
      const reference = getCpuReference();
      return executionFromUpdate(reference, {
        cpuReference: reference,
        gpuResult,
        webgpuStatus: {
          status: 'webgpu-device-lost-fallback',
          reason: describeDeviceLost(lostInfo),
          fallback: 'cpu-reference'
        }
      });
    }
    if (noFullReadback) {
      return executionFromUpdate(gpuResult, {
        cpuReference: null,
        gpuResult,
        webgpuStatus: {
          status: 'webgpu-executed-no-full-readback',
          reason: 'WebGPU MLS-MPM grid update executed without full grid readback'
        },
        webgpuParity: createNoFullReadbackParityReport(parityTolerance)
      });
    }
    const reference = getCpuReference();
    const webgpuParity = createMlsMpmGridUpdateParityReport({
      cpuReference: reference,
      gpuResult,
      tolerance: parityTolerance
    });
    if (webgpuParity.status !== 'pass') {
      gpuResult.destroyUpdatedGridBuffer?.();
      return executionFromUpdate(reference, {
        cpuReference: reference,
        gpuResult,
        webgpuStatus: {
          status: 'webgpu-parity-failed',
          reason: 'CPU/WebGPU MLS-MPM grid update parity exceeded tolerance',
          fallback: 'cpu-reference'
        },
        webgpuParity
      });
    }
    return executionFromUpdate(gpuResult, {
      cpuReference: reference,
      gpuResult,
      webgpuStatus: {
        status: 'webgpu-executed',
        reason: 'CPU/WebGPU MLS-MPM grid update parity passed'
      },
      webgpuParity
    });
  } catch (error) {
    if (residentWebGpuRequired) throw error;
    const reference = getCpuReference();
    return executionFromUpdate(reference, {
      cpuReference: reference,
      webgpuStatus: {
        status: 'webgpu-error-fallback',
        reason: error instanceof Error ? error.message : String(error),
        fallback: 'cpu-reference'
      }
    });
  }
}
