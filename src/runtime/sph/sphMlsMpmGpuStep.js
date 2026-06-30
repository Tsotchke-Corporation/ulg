import {
  ULG_MLS_MPM_GPU_RESIDENT_STEP_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_RESIDENT_STEP_SCHEMA,
  ULG_MLS_MPM_GPU_RESIDENT_STEPS_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_PROJECTION_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_UPDATE_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_PRESSURE_INTERFACE_FORCE_PREVIEW_SCHEMA,
  ULG_SPH_PRESSURE_INTERFACE_FORCE_SOLVER_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import {
  mlsMpmG2pReconstructWgsl,
  mlsMpmGridUpdateWgsl,
  mlsMpmP2gGridProjectionWgsl
} from '../../../ulg-gpu-abi/src/wgsl.js';
import { requestOpticalGpuDevice } from '../material/opticalGpuBuffers.js';
import { computeBufferBinding, createCachedExplicitComputePipeline, deferSubmittedWorkCleanup } from '../webgpuComputeLayout.js';
import {
  destroyMlsMpmGpuParticleBuffers,
  destroySphGpuParticleBuffers,
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_THERMO_FLOATS,
  MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS
} from './sphGpuBuffers.js';
import {
  createMlsMpmGridSpec,
  MLS_MPM_P2G_BACKEND_RESIDENT_SCATTER,
  MLS_MPM_GPU_GRID_NODE_FLOATS,
  resolveMlsMpmP2gBackendPolicy,
  SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS,
  runMlsMpmP2gGridProjectionWithOptionalWebGpu
} from './sphGridGpuKernel.js';
import {
  MLS_MPM_GPU_GRID_VELOCITY_FLOATS,
  SPH_PRESSURE_INTERFACE_FORCE_FLOATS,
  runMlsMpmGridUpdateWithOptionalWebGpu
} from './sphGridUpdateGpuKernel.js';
import {
  SPH_GAS_PRESSURE_CELL_FLOATS,
  packGasPressureCellRows,
  runSphPressureInterfaceForceRowsWebGpu
} from './sphPressureInterfaceGpuKernel.js';
import {
  MLS_MPM_G2P_MAX_RADIUS_GROWTH_RATIO,
  MLS_MPM_G2P_MAX_VOLUME_RATIO_J,
  ULG_MLS_MPM_G2P_PARTICLE_SCALE_STABILITY_SCHEMA,
  runMlsMpmG2pWithOptionalWebGpu
} from './sphG2pGpuKernel.js';
import {
  ULG_MLS_MPM_GPU_RESIDENT_SUMMARY_EXECUTION_SCHEMA,
  MLS_MPM_RESIDENT_SUMMARY_SCOPE_FULL,
  MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS,
  normalizeMlsMpmResidentSummaryScope,
  runMlsMpmResidentSummaryWebGpu
} from './sphMlsMpmGpuSummary.js';
import {
  runSphThermalStepWithOptionalWebGpu,
  runSphThermalStepWebGpu
} from './sphThermalGpuKernel.js';
import {
  runSphReactionStepWebGpu,
  runSphReactionStepWithOptionalWebGpu
} from './sphReactionGpuKernel.js';
import {
  runMlsMpmMechanicsRefreshWithOptionalWebGpu
} from './sphMechanicsRefreshGpuKernel.js';
import {
  createResidentProductMassHandle,
  mergeResidentGasSpeciesLedgers
} from './sphReactionGpuSummary.js';
import {
  residentProductMassMatchesDevice,
  tagResidentProductMassDevice,
  tagWebGpuBufferDevice,
  webGpuDeviceId,
  webGpuDeviceMismatchInfo
} from './sphGpuDeviceIdentity.js';
import {
  buildMlsMpmResidentStepAuthorityLedger,
  summarizeResidentStateAuthorityLedger
} from '../residentStateAuthority.js';
import {
  deriveLocalGasCellPressureFieldFromSpatialGasLedger,
  gasPressureFeedbackSummary,
  gasPressureInterfaceCouplingSummary,
  gasPressureInterfaceForcePreview,
  gasPressureInterfaceForceSolver
} from '../sphPhaseDemo.js';
import {
  addResidentBufferLease,
  buildMlsMpmResidentStepBufferLeaseLedger,
  createResidentBufferLeaseLedger,
  destroyResidentBufferWithLease,
  registerResidentBufferResource,
  residentProductMassResourceKey,
  summarizeResidentBufferLeaseLedger
} from '../residentBufferLease.js';

export {
  ULG_MLS_MPM_GPU_RESIDENT_STEP_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_RESIDENT_STEP_SCHEMA,
  ULG_MLS_MPM_GPU_RESIDENT_STEPS_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_RESIDENT_SUMMARY_EXECUTION_SCHEMA
};

const STEP_SCOPE = 'mls-mpm-resident-step-p2g-grid-update-g2p';
const DEFAULT_BOX_DIMS_M = Object.freeze([5, 5, 5]);
const DEFAULT_GRAVITY_M_PER_S2 = Object.freeze([0, -9.80665, 0]);
const DEFAULT_CFL_FACTOR = 0.6;
const FULL_READBACK_MODE = 'full-parity-readback';
const NO_FULL_READBACK_MODE = 'no-full-readback';
export const MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_EVERY_STEP = 'every-step';
export const MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_FINAL_ONLY = 'final-only';
export const MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_PLAN_ONLY = 'plan-only';
export const MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_NONE = 'none';
export const MLS_MPM_ACTIVE_GRID_PLAN_REFRESH_MODE_EVERY_STEP = 'every-step';
export const MLS_MPM_ACTIVE_GRID_PLAN_REFRESH_MODE_FINAL_ONLY = 'final-only';
export const MLS_MPM_ACTIVE_GRID_PLAN_REFRESH_MODE_NONE = 'none';
const P2G_ACCUMULATOR_COMPONENTS = 4;
const ULG_MLS_MPM_RESIDENT_STAGE_TIMING_SCHEMA = 'peercompute.ulg.mls-mpm-resident-stage-timing.v0';
const ULG_MLS_MPM_RESIDENT_DISPATCH_TOPOLOGY_SCHEMA = 'peercompute.ulg.mls-mpm-resident-dispatch-topology.v0';
const ULG_MLS_MPM_RESIDENT_GPU_LANE_ADAPTER_SCHEMA = 'peercompute.ulg.mls-mpm-resident-gpu-lane-adapter.v0';
const ULG_MLS_MPM_FUSED_ACTIVE_GRID_DISPATCH_SCHEMA = 'peercompute.ulg.mls-mpm-fused-active-grid-dispatch.v0';
const ULG_MLS_MPM_ACTIVE_GRID_DISPATCH_POLICY_SCHEMA = 'peercompute.ulg.mls-mpm-active-grid-dispatch-policy.v0';
const ULG_MLS_MPM_RESIDENT_SEQUENCE_LANE_CONTRACT_SCHEMA = 'peercompute.ulg.mls-mpm-resident-sequence-lane-contract.v0';
export const ULG_MLS_MPM_FUSED_RESIDENT_SEQUENCE_PREFLIGHT_SCHEMA = 'peercompute.ulg.mls-mpm-fused-resident-sequence-preflight.v0';
export const ULG_MLS_MPM_WEBGPU_OCEAN_HOT_LOOP_BUDGET_SCHEMA = 'peercompute.ulg.mls-mpm-webgpu-ocean-hot-loop-budget.v0';
export const ULG_MLS_MPM_RESIDENT_COMPUTE_TASK_SCHEMA = 'peercompute.ulg.mls-mpm-resident-compute-task.v0';
export const ULG_MLS_MPM_RESIDENT_COMPUTE_TASK_RESULT_SCHEMA = 'peercompute.ulg.mls-mpm-resident-compute-task-result.v0';
export const ULG_MLS_MPM_RESIDENT_STEPS_COMPUTE_TASK_SCHEMA = 'peercompute.ulg.mls-mpm-resident-steps-compute-task.v0';
export const ULG_MLS_MPM_RESIDENT_STEPS_COMPUTE_TASK_RESULT_SCHEMA = 'peercompute.ulg.mls-mpm-resident-steps-compute-task-result.v0';
export const ULG_MLS_MPM_MECHANICS_ONLY_RESIDENT_STEPS_COMPUTE_TASK_SCHEMA = 'peercompute.ulg.mls-mpm-mechanics-only-resident-steps-compute-task.v0';
export const ULG_MLS_MPM_MECHANICS_ONLY_RESIDENT_STEPS_COMPUTE_TASK_RESULT_SCHEMA = 'peercompute.ulg.mls-mpm-mechanics-only-resident-steps-compute-task-result.v0';
export const ULG_MLS_MPM_MECHANICS_P2G_STAGE_COMPUTE_TASK_SCHEMA = 'peercompute.ulg.mls-mpm-mechanics-p2g-stage-compute-task.v0';
export const ULG_MLS_MPM_MECHANICS_P2G_STAGE_COMPUTE_TASK_RESULT_SCHEMA = 'peercompute.ulg.mls-mpm-mechanics-p2g-stage-compute-task-result.v0';
export const ULG_MLS_MPM_MECHANICS_P2G_STAGE_TASK_EVIDENCE_SCHEMA = 'peercompute.ulg.mechanics-p2g-stage-task-evidence.v0';
export const ULG_MLS_MPM_MECHANICS_GRID_UPDATE_STAGE_COMPUTE_TASK_SCHEMA = 'peercompute.ulg.mls-mpm-mechanics-grid-update-stage-compute-task.v0';
export const ULG_MLS_MPM_MECHANICS_GRID_UPDATE_STAGE_COMPUTE_TASK_RESULT_SCHEMA = 'peercompute.ulg.mls-mpm-mechanics-grid-update-stage-compute-task-result.v0';
export const ULG_MLS_MPM_MECHANICS_GRID_UPDATE_STAGE_TASK_EVIDENCE_SCHEMA = 'peercompute.ulg.mechanics-grid-update-stage-task-evidence.v0';
export const ULG_MLS_MPM_MECHANICS_G2P_STAGE_COMPUTE_TASK_SCHEMA = 'peercompute.ulg.mls-mpm-mechanics-g2p-stage-compute-task.v0';
export const ULG_MLS_MPM_MECHANICS_G2P_STAGE_COMPUTE_TASK_RESULT_SCHEMA = 'peercompute.ulg.mls-mpm-mechanics-g2p-stage-compute-task-result.v0';
export const ULG_MLS_MPM_MECHANICS_G2P_STAGE_TASK_EVIDENCE_SCHEMA = 'peercompute.ulg.mechanics-g2p-stage-task-evidence.v0';
export const ULG_MLS_MPM_MECHANICS_STAGE_TASK_CHAIN_SCHEMA = 'peercompute.ulg.mls-mpm-mechanics-stage-task-chain.v0';
export const ULG_MLS_MPM_MECHANICS_WORKER_COMPACT_PUBLICATION_CANDIDATE_SCHEMA = 'peercompute.ulg.mls-mpm-mechanics-worker-compact-publication-candidate.v0';
export const ULG_SPH_PRESSURE_INTERFACE_STAGE_COMPUTE_TASK_SCHEMA = 'peercompute.ulg.sph-pressure-interface-stage-compute-task.v0';
export const ULG_SPH_PRESSURE_INTERFACE_STAGE_COMPUTE_TASK_RESULT_SCHEMA = 'peercompute.ulg.sph-pressure-interface-stage-compute-task-result.v0';
export const ULG_SPH_PRESSURE_INTERFACE_STAGE_TASK_EVIDENCE_SCHEMA = 'peercompute.ulg.pressure-interface-stage-task-evidence.v0';
export const ULG_SPH_PRESSURE_INTERFACE_WORKER_COMPACT_PUBLICATION_CANDIDATE_SCHEMA = 'peercompute.ulg.sph-pressure-interface-worker-compact-publication-candidate.v0';
export const ULG_SPH_SPATIAL_GAS_LEDGER_PRODUCER_STAGE_COMPUTE_TASK_SCHEMA = 'peercompute.ulg.sph-spatial-gas-ledger-producer-stage-compute-task.v0';
export const ULG_SPH_SPATIAL_GAS_LEDGER_PRODUCER_STAGE_COMPUTE_TASK_RESULT_SCHEMA = 'peercompute.ulg.sph-spatial-gas-ledger-producer-stage-compute-task-result.v0';
export const ULG_SPH_SPATIAL_GAS_LEDGER_PRODUCER_STAGE_TASK_EVIDENCE_SCHEMA = 'peercompute.ulg.spatial-gas-ledger-producer-stage-task-evidence.v0';
export const ULG_SPH_SPATIAL_GAS_SPECIES_LEDGER_SCHEMA = 'peercompute.ulg.sph-spatial-gas-species-ledger.v0';
export const ULG_SPH_RETAINED_SPATIAL_GAS_LEDGER_SOURCE_SCHEMA = 'peercompute.ulg.sph-retained-spatial-gas-species-ledger-source.v0';
export const ULG_SPH_GAS_CELL_EOS_PRODUCER_STAGE_COMPUTE_TASK_SCHEMA = 'peercompute.ulg.sph-gas-cell-eos-producer-stage-compute-task.v0';
export const ULG_SPH_GAS_CELL_EOS_PRODUCER_STAGE_COMPUTE_TASK_RESULT_SCHEMA = 'peercompute.ulg.sph-gas-cell-eos-producer-stage-compute-task-result.v0';
export const ULG_SPH_GAS_CELL_EOS_PRODUCER_STAGE_TASK_EVIDENCE_SCHEMA = 'peercompute.ulg.gas-cell-eos-producer-stage-task-evidence.v0';
export const ULG_PRESSURE_INTERFACE_RETAINED_GAS_CELL_FIELD_SOURCE_SCHEMA = 'peercompute.ulg.pressure-interface-retained-gas-cell-field-source.v0';
export const ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA = 'peercompute.ulg.pressure-interface-gas-cell-field-admission.v0';
export const ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_IMPORT_SCHEMA = 'peercompute.ulg.pressure-interface-gas-cell-field-import.v0';
export const ULG_SPH_THERMAL_PHASE_WORKER_COMPACT_PUBLICATION_CANDIDATE_SCHEMA = 'peercompute.ulg.sph-thermal-phase-worker-compact-publication-candidate.v0';
export const ULG_SPH_REACTION_PRODUCT_WORKER_COMPACT_PUBLICATION_CANDIDATE_SCHEMA = 'peercompute.ulg.sph-reaction-product-worker-compact-publication-candidate.v0';
export const ULG_SPH_THERMAL_PHASE_STAGE_COMPUTE_TASK_SCHEMA = 'peercompute.ulg.sph-thermal-phase-stage-compute-task.v0';
export const ULG_SPH_THERMAL_PHASE_STAGE_COMPUTE_TASK_RESULT_SCHEMA = 'peercompute.ulg.sph-thermal-phase-stage-compute-task-result.v0';
export const ULG_SPH_THERMAL_PHASE_STAGE_TASK_EVIDENCE_SCHEMA = 'peercompute.ulg.thermal-phase-stage-task-evidence.v0';
export const ULG_SPH_REACTION_PRODUCT_STAGE_COMPUTE_TASK_SCHEMA = 'peercompute.ulg.sph-reaction-product-stage-compute-task.v0';
export const ULG_SPH_REACTION_PRODUCT_STAGE_COMPUTE_TASK_RESULT_SCHEMA = 'peercompute.ulg.sph-reaction-product-stage-compute-task-result.v0';
export const ULG_SPH_REACTION_PRODUCT_STAGE_TASK_EVIDENCE_SCHEMA = 'peercompute.ulg.reaction-product-stage-task-evidence.v0';
const ULG_MLS_MPM_MECHANICS_STAGE_LANE_CONTRACT_SCHEMA = 'peercompute.ulg.mls-mpm-mechanics-stage-lane-contract.v0';
export const ULG_MLS_MPM_MECHANICS_CHILD_STAGE_KERNEL_EVIDENCE_SCHEMA = 'peercompute.ulg.mechanics-child-stage-kernel-evidence.v0';
export const ULG_MLS_MPM_MECHANICS_CHILD_P2G_STAGE_EVIDENCE_SCHEMA = 'peercompute.ulg.mechanics-child-p2g-stage-evidence.v0';
export const ULG_MLS_MPM_MECHANICS_CHILD_GRID_UPDATE_STAGE_EVIDENCE_SCHEMA = 'peercompute.ulg.mechanics-child-grid-update-stage-evidence.v0';
export const ULG_MLS_MPM_MECHANICS_CHILD_G2P_STAGE_EVIDENCE_SCHEMA = 'peercompute.ulg.mechanics-child-g2p-stage-evidence.v0';
export const ULG_MLS_MPM_RESIDENT_STEPS_COMMIT_DELTA_SCHEMA = 'peercompute.ulg.mls-mpm-resident-steps-commit-delta.v0';
export const ULG_MLS_MPM_RESIDENT_STEPS_STATE_DELTA_SCHEMA = 'peercompute.ulg.mls-mpm-resident-steps-state-delta.v0';
export const ULG_MLS_MPM_RESIDENT_STEPS_SOLVER_TASK_BRIDGE_SCHEMA = 'peercompute.ulg.mls-mpm-resident-steps-solver-task-bridge.v0';

export function normalizeMlsMpmResidentCompactSummaryMode(value) {
  const mode = String(value || MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_EVERY_STEP).trim().toLowerCase();
  if (mode === MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_FINAL_ONLY) {
    return MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_FINAL_ONLY;
  }
  if (
    mode === MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_PLAN_ONLY
    || mode === 'active-grid-plan-only'
    || mode === 'dispatch-plan-only'
    || mode === 'no-readback-plan'
  ) {
    return MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_PLAN_ONLY;
  }
  if (
    mode === MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_NONE
    || mode === 'skip'
    || mode === 'disabled'
  ) {
    return MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_NONE;
  }
  return MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_EVERY_STEP;
}

export function normalizeMlsMpmActiveGridPlanRefreshMode(value) {
  const mode = String(value || MLS_MPM_ACTIVE_GRID_PLAN_REFRESH_MODE_EVERY_STEP).trim().toLowerCase();
  if (mode === MLS_MPM_ACTIVE_GRID_PLAN_REFRESH_MODE_FINAL_ONLY) {
    return MLS_MPM_ACTIVE_GRID_PLAN_REFRESH_MODE_FINAL_ONLY;
  }
  if (
    mode === MLS_MPM_ACTIVE_GRID_PLAN_REFRESH_MODE_NONE
    || mode === 'skip'
    || mode === 'disabled'
  ) {
    return MLS_MPM_ACTIVE_GRID_PLAN_REFRESH_MODE_NONE;
  }
  return MLS_MPM_ACTIVE_GRID_PLAN_REFRESH_MODE_EVERY_STEP;
}

function compactSummaryStepCountForMode({
  readbackMode = FULL_READBACK_MODE,
  compactSummaryMode = MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_EVERY_STEP,
  stepCount = 1
} = {}) {
  if (readbackMode !== NO_FULL_READBACK_MODE) return 0;
  if (compactSummaryMode === MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_NONE) return 0;
  if (compactSummaryMode === MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_PLAN_ONLY) return 0;
  if (compactSummaryMode === MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_FINAL_ONLY) return 1;
  return Math.max(1, Math.round(finiteNumber(stepCount, 1)));
}

function compactSummaryModeRequestsReadback(mode) {
  return mode !== MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_NONE
    && mode !== MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_PLAN_ONLY;
}
const ULG_LAW_GRAPH_NODE_TASK_REF_SCHEMA = 'peercompute.ulg.law-graph-node-task-ref.v0';
const PEERCOMPUTE_GPU_FENCE_REPORT_SCHEMA = 'peercompute.compute.gpu-fence-report.v0';
const PEERCOMPUTE_GPU_FENCE_REQUIREMENT_SCHEMA = 'peercompute.compute.gpu-fence-requirement.v0';
const PEERCOMPUTE_GPU_RESIDENT_LANE_TASK_SCHEMA = 'peercompute.compute.gpu-resident-lane-task.v0';
const COMPACT_SUMMARY_READBACK_BYTES = MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS * Float32Array.BYTES_PER_ELEMENT;
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
const DEFAULT_FUSED_ACTIVE_GRID_SAFETY_CELLS = 3;
const COMPUTE_DISPATCH_INDIRECT_UINTS = 3;
const MECHANICS_STAGE_ORDER = Object.freeze(['p2g', 'gridUpdate', 'g2p']);
const SPATIAL_GAS_LEDGER_PRODUCER_STAGE_ID = 'spatialGasLedgerProducer';
const GAS_CELL_EOS_PRODUCER_STAGE_ID = 'gasCellEosProducer';
const PRESSURE_INTERFACE_STAGE_ID = 'pressureInterface';
const THERMAL_PHASE_STAGE_ID = 'thermalPhase';
const REACTION_PRODUCT_STAGE_ID = 'reactionProduct';
export const SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS = 12;

function nowMs() {
  return typeof globalThis.performance?.now === 'function'
    ? globalThis.performance.now()
    : Date.now();
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function uniqueNonEmptyStrings(values = []) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map((value) => String(value ?? '').trim())
    .filter(Boolean))];
}

function normalizeSameDeviceRetainedBufferImportDescriptor(source = null) {
  if (!source || typeof source !== 'object' || source.sameDevice !== true) return null;
  const sourceHotBufferKey = typeof source.sourceHotBufferKey === 'string' && source.sourceHotBufferKey.trim()
    ? source.sourceHotBufferKey.trim()
    : (
        typeof source.hotBufferKey === 'string' && source.hotBufferKey.trim()
          ? source.hotBufferKey.trim()
          : (
              typeof source.hotBufferRecordKey === 'string' && source.hotBufferRecordKey.trim()
                ? source.hotBufferRecordKey.trim()
                : null
            )
      );
  if (!sourceHotBufferKey) return null;
  return {
    ...source,
    sourceHotBufferKey,
    sameDevice: true
  };
}

function isPressureInterfaceGasCellFieldAdmissionApproved(admission = null) {
  return admission?.schema === ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA
    && admission?.status === 'pressure-interface-gas-cell-field-consumption-approved'
    && admission?.gasCellFieldConsumptionApproved === true;
}

function normalizePressureInterfaceGasCellFieldImport(importValue = null) {
  const source = importValue && typeof importValue === 'object' ? importValue : null;
  const gasCellField = source?.gasCellFieldSnapshot
    || source?.gasCellField
    || source?.pressureFeedback?.gasCellField
    || null;
  const admission = source?.pressureInterfaceGasCellFieldAdmission
    || source?.gasCellFieldAdmission
    || source?.admission
    || null;
  const retainedGasPressureBufferRefs = uniqueNonEmptyStrings(
    source?.retainedGasPressureBufferRefs
      || source?.workerRetainedGasPressureBufferRefs
      || admission?.retainedGasPressureBufferRefs
      || admission?.workerRetainedGasPressureBufferRefs
      || []
  );
  const schemaAccepted = source?.schema === ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_IMPORT_SCHEMA;
  const statusAccepted = source?.status === 'pressure-interface-gas-cell-field-import-ready';
  const localPressureGradientReady = gasCellField?.localPressureGradientReady === true
    && Array.isArray(gasCellField?.cells)
    && gasCellField.cells.length > 0;
  const admissionApproved = isPressureInterfaceGasCellFieldAdmissionApproved(admission);
  const retainedRefsReady = retainedGasPressureBufferRefs.length > 0;
  const importReady = Boolean(
    schemaAccepted
      && statusAccepted
      && localPressureGradientReady
      && admissionApproved
      && retainedRefsReady
  );
  const blocker = !source
    ? 'pressure-interface-gas-cell-field-import-not-supplied'
    : (!schemaAccepted
        ? 'pressure-interface-gas-cell-field-import-schema-invalid'
        : (!statusAccepted
            ? 'pressure-interface-gas-cell-field-import-not-ready'
            : (!localPressureGradientReady
                ? 'pressure-interface-gas-cell-field-import-local-gradient-required'
                : (!admissionApproved
                    ? 'pressure-interface-gas-cell-field-import-admission-required'
                    : (!retainedRefsReady
                        ? 'pressure-interface-gas-cell-field-import-retained-buffer-ref-required'
                        : null)))));
  return {
    schema: ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_IMPORT_SCHEMA,
    sourceSchema: source?.schema || null,
    status: importReady ? 'pressure-interface-gas-cell-field-import-ready' : blocker,
    blocker,
    importReady,
    gasCellField: importReady ? gasCellField : null,
    gasCellFieldPresent: Boolean(gasCellField),
    localPressureGradientReady,
    pressureInterfaceGasCellFieldAdmission: admission,
    pressureInterfaceGasCellFieldAdmissionApproved: admissionApproved,
    sourceHotBufferKey: source?.sourceHotBufferKey || source?.hotBufferKey || admission?.sourceHotBufferKey || null,
    retainedGasPressureBufferRefs,
    workerRetainedGasPressureBufferRefs: uniqueNonEmptyStrings(source?.workerRetainedGasPressureBufferRefs || [])
  };
}

function gasCellEosProducerGasCellField(result = null) {
  return result?.gasCellFieldSnapshot
    || result?.gasCellField
    || result?.pressureFeedback?.gasCellField
    || null;
}

function gasCellEosProducerResultReady(result = null) {
  const gasCellField = gasCellEosProducerGasCellField(result);
  return Boolean(
    result
      && gasCellField?.localPressureGradientReady === true
      && Array.isArray(gasCellField?.cells)
      && gasCellField.cells.length > 0
  );
}

function spatialGasLedgerProducerResultReady(result = null) {
  return Boolean(
    result?.spatialGasSpeciesLedger?.status === 'spatial-gas-species-ledger-ready'
      && Array.isArray(result.spatialGasSpeciesLedger.cells)
      && result.spatialGasSpeciesLedger.cells.length > 0
  );
}

function spatialGasLedgerFromProducerOrOptions(stageResults = {}, stepOptions = {}) {
  const produced = stageResults[SPATIAL_GAS_LEDGER_PRODUCER_STAGE_ID]?.spatialGasSpeciesLedger || null;
  if (produced?.status === 'spatial-gas-species-ledger-ready') return produced;
  return stepOptions.spatialGasSpeciesLedger
    || stepOptions.gasPressureSummary?.spatialGasSpeciesLedger
    || stepOptions.pressureSummary?.spatialGasSpeciesLedger
    || null;
}

function pressureSummaryWithSpatialGasLedgerProducerResult(pressureSummary = null, result = null) {
  const ledger = result?.spatialGasSpeciesLedger || null;
  if (ledger?.status !== 'spatial-gas-species-ledger-ready') return pressureSummary;
  const base = pressureSummary && typeof pressureSummary === 'object'
    ? pressureSummary
    : {
        schema: 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0',
        status: 'spatial-gas-ledger-producer-pressure-summary-local',
        source: 'spatial-gas-ledger-producer-stage'
      };
  return {
    ...base,
    spatialGasSpeciesLedger: ledger,
    spatialGasSpeciesLedgerSchema: ledger.schema,
    spatialGasSpeciesLedgerStatus: ledger.status,
    residentSpatialGasSpeciesLedgerStatus: 'resident-spatial-gas-species-ledger-available'
  };
}

function pressureSummaryWithGasCellEosProducerResult(pressureSummary = null, result = null) {
  const gasCellField = gasCellEosProducerGasCellField(result);
  if (!gasCellField?.localPressureGradientReady) return pressureSummary;
  const base = pressureSummary && typeof pressureSummary === 'object'
    ? pressureSummary
    : {
        schema: 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0',
        status: 'gas-cell-eos-producer-pressure-summary-local',
        source: 'gas-cell-eos-producer-stage'
      };
  return {
    ...base,
    gasCellField,
    pressureFeedback: base.pressureFeedback && typeof base.pressureFeedback === 'object'
      ? {
          ...base.pressureFeedback,
          gasCellField
        }
      : base.pressureFeedback
  };
}

function pressureFeedbackWithGasCellEosProducerResult(pressureFeedback = null, result = null) {
  const gasCellField = gasCellEosProducerGasCellField(result);
  if (!gasCellField?.localPressureGradientReady) return pressureFeedback;
  if (!pressureFeedback || typeof pressureFeedback !== 'object') return null;
  return {
    ...pressureFeedback,
    schema: pressureFeedback.schema || 'peercompute.ulg.sph-gas-pressure-feedback.v0',
    status: pressureFeedback.status || 'gas-cell-eos-producer-pressure-feedback-local',
    gasCellField
  };
}

function gasCellEosProducerRetainedGasPressureRefs(result = null) {
  return uniqueNonEmptyStrings([
    ...(result?.retainedGasPressureBufferRefs || []),
    ...(result?.retainedGasCellFieldSource?.retainedGasPressureBufferRefs || [])
  ]);
}

function gasCellEosProducerWorkerRetainedGasPressureRefs(result = null) {
  return uniqueNonEmptyStrings([
    ...(result?.workerRetainedGasPressureBufferRefs || []),
    ...(result?.retainedGasCellFieldSource?.workerRetainedGasPressureBufferRefs || [])
  ]);
}

function publishGasCellEosProducerImportForPressureInterface({
  residentAuthorityHost = null,
  gasCellEosProducerResult = null,
  pressureInterfaceGasCellFieldAdmission = null,
  cacheKey = null,
  stateKey = null,
  sourceTaskId = null,
  sourceNodeId = 'ulg-resident-gas-cell-eos-law',
  sourceStage = GAS_CELL_EOS_PRODUCER_STAGE_ID
} = {}) {
  const gasCellField = gasCellEosProducerGasCellField(gasCellEosProducerResult);
  const retainedGasPressureBufferRefs = gasCellEosProducerRetainedGasPressureRefs(gasCellEosProducerResult);
  const workerRetainedGasPressureBufferRefs = gasCellEosProducerWorkerRetainedGasPressureRefs(gasCellEosProducerResult);
  const resultBase = {
    schema: 'peercompute.ulg.gas-cell-eos-producer-pressure-interface-import-publication.v0',
    sourceStage,
    sourceTaskId: sourceTaskId || gasCellEosProducerResult?.computeTaskId || null,
    pressureInterfaceGasCellFieldAdmission,
    pressureInterfaceGasCellFieldImport: null,
    admissionPublication: null,
    importPublication: null,
    retainedGasPressureBufferRefs,
    workerRetainedGasPressureBufferRefs
  };
  if (!gasCellEosProducerResultReady(gasCellEosProducerResult)) {
    return {
      ...resultBase,
      status: 'blocked-gas-cell-eos-producer-result-required',
      blocker: 'ready-gas-cell-eos-producer-result-required'
    };
  }
  let admission = pressureInterfaceGasCellFieldAdmission;
  let admissionPublication = null;
  const admissionApproved = () => isPressureInterfaceGasCellFieldAdmissionApproved(admission);
  if (!admissionApproved() && typeof residentAuthorityHost?.publishPressureInterfaceGasCellFieldAdmission === 'function') {
    admissionPublication = residentAuthorityHost.publishPressureInterfaceGasCellFieldAdmission({
      cacheKey,
      stateKey,
      source: gasCellEosProducerResult,
      sourceTaskId: sourceTaskId || gasCellEosProducerResult?.computeTaskId || null,
      sourceNodeId,
      sourceStage,
      gasCellFieldSnapshot: gasCellField,
      retainedGasPressureBufferRefs,
      workerRetainedGasPressureBufferRefs
    });
    admission = admissionPublication?.pressureInterfaceGasCellFieldAdmission || admission;
  }
  if (!admissionApproved()) {
    return {
      ...resultBase,
      status: 'blocked-gas-cell-eos-producer-admission-required',
      blocker: 'pressure-interface-gas-cell-field-admission-required',
      pressureInterfaceGasCellFieldAdmission: admission,
      admissionPublication
    };
  }
  if (typeof residentAuthorityHost?.publishPressureInterfaceGasCellFieldImportSource !== 'function') {
    return {
      ...resultBase,
      status: 'blocked-gas-cell-eos-producer-import-publisher-required',
      blocker: 'resident-authority-host-import-publisher-required',
      pressureInterfaceGasCellFieldAdmission: admission,
      admissionPublication
    };
  }
  const importPublication = residentAuthorityHost.publishPressureInterfaceGasCellFieldImportSource({
    cacheKey,
    stateKey,
    source: gasCellEosProducerResult,
    sourceTaskId: sourceTaskId || gasCellEosProducerResult?.computeTaskId || null,
    sourceNodeId,
    sourceStage,
    gasCellFieldSnapshot: gasCellField,
    pressureInterfaceGasCellFieldAdmission: admission,
    retainedGasPressureBufferRefs,
    workerRetainedGasPressureBufferRefs
  });
  return {
    ...resultBase,
    status: importPublication?.pressureInterfaceGasCellFieldImport?.status === 'pressure-interface-gas-cell-field-import-ready'
      ? 'gas-cell-eos-producer-import-published'
      : (importPublication?.status || 'gas-cell-eos-producer-import-publication-blocked'),
    blocker: null,
    pressureInterfaceGasCellFieldAdmission: admission,
    pressureInterfaceGasCellFieldImport: importPublication?.pressureInterfaceGasCellFieldImport || null,
    admissionPublication,
    importPublication
  };
}

function pressureInterfaceLocalGasCellFieldReadyFromOptions(options = {}) {
  const pressureInterfaceGasCellFieldImport = normalizePressureInterfaceGasCellFieldImport(
    options.pressureInterfaceGasCellFieldImport
      || options.gasCellFieldImport
      || null
  );
  if (pressureInterfaceGasCellFieldImport.localPressureGradientReady === true) return true;
  const gasCellField = options.pressureFeedback?.gasCellField
    || options.gasPressureSummary?.gasCellField
    || options.pressureSummary?.gasCellField
    || options.gasCellField
    || null;
  return gasCellField?.localPressureGradientReady === true
    && Array.isArray(gasCellField?.cells)
    && gasCellField.cells.length > 0;
}

function pressureInterfaceStageRetainedBufferRefs(retainedBufferRefs = [], stageOptions = {}) {
  return uniqueNonEmptyStrings([
    ...(Array.isArray(retainedBufferRefs) ? retainedBufferRefs : []),
    ...(pressureInterfaceLocalGasCellFieldReadyFromOptions(stageOptions)
      ? ['resident-gas-pressure-cells-buffer']
      : [])
  ]);
}

function pressureFeedbackWithImportedGasCellField(pressureFeedback = null, importResult = null) {
  if (!pressureFeedback || importResult?.importReady !== true || !importResult.gasCellField) return pressureFeedback;
  const gasCellField = importResult.gasCellField;
  return {
    ...pressureFeedback,
    gasCellField,
    pressureGradientStatus: gasCellField.gradientStatus || pressureFeedback.pressureGradientStatus || null,
    pressureFieldMode: gasCellField.pressureFieldMode || pressureFeedback.pressureFieldMode || null,
    pressureFieldResolution: gasCellField.pressureFieldResolution || pressureFeedback.pressureFieldResolution || null,
    localPressureGradientSchema: gasCellField.localPressureGradientSchema || pressureFeedback.localPressureGradientSchema || null,
    localPressureGradientReady: gasCellField.localPressureGradientReady === true,
    localPressureGradientStatus: gasCellField.localPressureGradientStatus || pressureFeedback.localPressureGradientStatus || null,
    localPressureGradientBlockers: [...(gasCellField.localPressureGradientBlockers || [])],
    localPressureGradientForceCouplingStatus: gasCellField.localPressureGradientForceCouplingStatus
      || pressureFeedback.localPressureGradientForceCouplingStatus
      || null
  };
}

function finiteVector3(value, fallback) {
  const source = Array.isArray(value) ? value : fallback;
  return [
    finiteNumber(source?.[0], fallback[0]),
    finiteNumber(source?.[1], fallback[1]),
    finiteNumber(source?.[2], fallback[2])
  ];
}

function noFullReadbackG2pParticleScaleStability({
  particleCount = 0,
  source = 'webgpu-g2p-shader'
} = {}) {
  return {
    schema: ULG_MLS_MPM_G2P_PARTICLE_SCALE_STABILITY_SCHEMA,
    status: 'gpu-g2p-cap-policy-applied-in-shader',
    source,
    particleCount: Math.max(0, Math.round(finiteNumber(particleCount, 0))),
    mechanicsStrideFloats: MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
    mechanicsVolumeRatioJOffset: 18,
    minVolumeRatioJAllowed: 0.1,
    maxRadiusGrowthRatioAllowed: MLS_MPM_G2P_MAX_RADIUS_GROWTH_RATIO,
    maxVolumeRatioJAllowed: MLS_MPM_G2P_MAX_VOLUME_RATIO_J,
    policyAppliedInG2p: true,
    policyAppliedInShader: true,
    capCountKnown: false,
    capCount: null,
    invalidCountKnown: false,
    invalidCount: null,
    effectiveFiniteCount: 0,
    minEffectiveVolumeRatioJ: null,
    maxEffectiveVolumeRatioJ: null,
    maxRawVolumeRatioJ: null,
    cappedSamples: []
  };
}

function createResidentDispatchTopology({
  particleCount = 0,
  gridSpec = null,
  activeGridDispatch = null,
  substepCount = 1,
  fusedResidentMechanics = false,
  fusedResidentSequence = false,
  p2gBackend = MLS_MPM_P2G_BACKEND_RESIDENT_SCATTER
} = {}) {
  const boundedParticleCount = Math.max(0, Math.floor(finiteNumber(particleCount, 0)));
  const workgroupSize = 64;
  const gridNodeCount = Math.max(0, Math.floor(finiteNumber(gridSpec?.gridNodeCount, 0)));
  const useActiveGrid = activeGridDispatch?.useActiveGrid === true;
  const activeGridNodeCount = useActiveGrid
    ? Math.max(0, Math.floor(finiteNumber(activeGridDispatch?.activeNodeCount, 0)))
    : gridNodeCount;
  const boundedSubstepCount = Math.max(1, Math.floor(finiteNumber(substepCount, 1)));
  const particleWorkgroups = Math.max(1, Math.ceil(boundedParticleCount / workgroupSize));
  const gridWorkgroups = Math.max(1, Math.ceil(activeGridNodeCount / workgroupSize));
  const activeGridAxis = useActiveGrid ? 'active-grid-node' : 'grid-node';
  const p2gBackendPolicy = resolveMlsMpmP2gBackendPolicy({
    requestedBackend: p2gBackend,
    supportsOceanTiledKernel: false
  });
  const p2g = {
    stageId: 'p2g',
    topology: 'particle-parallel-scatter',
    backendPolicy: p2gBackendPolicy,
    backendPolicyStatus: p2gBackendPolicy.status,
    requestedBackend: p2gBackendPolicy.requestedBackend,
    effectiveBackend: p2gBackendPolicy.effectiveBackend,
    backendFallbackReason: p2gBackendPolicy.fallbackReason,
    entryPoint: 'main',
    dispatchAxis: 'particle',
    dispatchWorkgroupsPerSubstep: particleWorkgroups,
    invocationLimitPerSubstep: boundedParticleCount,
    workgroupSize,
    particleCount: boundedParticleCount,
    particleLoopInShader: false,
    perParticleLocalStencil: 'quadratic-3x3x3-grid-stencil',
    perParticleLocalStencilNodeCount: 27,
    gridWriteMode: 'atomic-grid-accumulator-scatter',
    gridAccumulatorComponents: P2G_ACCUMULATOR_COMPONENTS
  };
  const p2gFinalize = {
    stageId: 'p2gFinalize',
    topology: 'grid-node-parallel-finalize',
    entryPoint: 'finalize_grid',
    dispatchAxis: activeGridAxis,
    dispatchWorkgroupsPerSubstep: gridWorkgroups,
    invocationLimitPerSubstep: activeGridNodeCount,
    workgroupSize,
    fullGridNodeCount: gridNodeCount,
    activeGridNodeCount,
    activeGridEnabled: useActiveGrid,
    particleLoopInShader: false
  };
  const p2gAccumulatorClear = {
    stageId: 'p2gAccumulatorClear',
    topology: useActiveGrid ? 'active-grid-node-parallel-accumulator-clear' : 'encoder-full-buffer-clear',
    entryPoint: useActiveGrid ? 'clear_accumulators' : 'GPUCommandEncoder.clearBuffer',
    dispatchAxis: useActiveGrid ? activeGridAxis : 'full-grid-buffer',
    dispatchWorkgroupsPerSubstep: useActiveGrid ? gridWorkgroups : 0,
    invocationLimitPerSubstep: useActiveGrid ? activeGridNodeCount : gridNodeCount,
    workgroupSize,
    fullGridNodeCount: gridNodeCount,
    activeGridNodeCount,
    activeGridEnabled: useActiveGrid,
    particleLoopInShader: false,
    bufferClearMode: useActiveGrid ? 'active-grid-compute-clear' : 'full-accumulator-clearBuffer'
  };
  const gridUpdate = {
    stageId: 'gridUpdate',
    topology: 'grid-node-parallel-update',
    entryPoint: 'main',
    dispatchAxis: activeGridAxis,
    dispatchWorkgroupsPerSubstep: gridWorkgroups,
    invocationLimitPerSubstep: activeGridNodeCount,
    workgroupSize,
    fullGridNodeCount: gridNodeCount,
    activeGridNodeCount,
    activeGridEnabled: useActiveGrid,
    particleLoopInShader: false
  };
  const g2p = {
    stageId: 'g2p',
    topology: 'particle-parallel-gather',
    entryPoint: 'main',
    dispatchAxis: 'particle',
    dispatchWorkgroupsPerSubstep: particleWorkgroups,
    invocationLimitPerSubstep: boundedParticleCount,
    workgroupSize,
    particleCount: boundedParticleCount,
    particleLoopInShader: false,
    perParticleLocalStencil: 'quadratic-3x3x3-grid-stencil',
    perParticleLocalStencilNodeCount: 27,
    gridReadMode: 'grid-node-gather'
  };
  return {
    schema: ULG_MLS_MPM_RESIDENT_DISPATCH_TOPOLOGY_SCHEMA,
    status: 'resident-dispatch-topology-ready',
    backend: 'webgpu',
    fusedResidentMechanics: fusedResidentMechanics === true,
    fusedResidentSequence: fusedResidentSequence === true,
    substepCount: boundedSubstepCount,
    workgroupSize,
    particleCount: boundedParticleCount,
    fullGridNodeCount: gridNodeCount,
    activeGridNodeCount,
    activeGridEnabled: useActiveGrid,
    activeGridDispatchStatus: activeGridDispatch?.status || null,
    p2gBackendPolicy,
    p2gBackendPolicyStatus: p2gBackendPolicy.status,
    p2gBackendRequested: p2gBackendPolicy.requestedBackend,
    p2gBackendEffective: p2gBackendPolicy.effectiveBackend,
    p2gBackendFallbackReason: p2gBackendPolicy.fallbackReason,
    particleParallelStages: ['p2g', 'g2p'],
    gridParallelStages: useActiveGrid
      ? ['p2gAccumulatorClear', 'p2gFinalize', 'gridUpdate']
      : ['p2gFinalize', 'gridUpdate'],
    cpuParticleLoopInHotPath: false,
    p2g,
    p2gAccumulatorClear,
    p2gFinalize,
    gridUpdate,
    g2p,
    dispatchesPerSubstep: useActiveGrid ? 5 : 4,
    totalDispatches: boundedSubstepCount * (useActiveGrid ? 5 : 4),
    workgroupsPerSubstep: particleWorkgroups
      + (useActiveGrid ? gridWorkgroups : 0)
      + gridWorkgroups
      + gridWorkgroups
      + particleWorkgroups,
    totalWorkgroups: boundedSubstepCount * (
      particleWorkgroups
      + (useActiveGrid ? gridWorkgroups : 0)
      + gridWorkgroups
      + gridWorkgroups
      + particleWorkgroups
    )
  };
}

function writeGpuBuffer(device, label, data, usage = GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST) {
  const byteLength = Math.max(4, data?.byteLength ?? 0);
  const buffer = device.createBuffer({ label, size: byteLength, usage });
  if (data?.byteLength > 0) device.queue.writeBuffer(buffer, 0, data);
  return buffer;
}

function createComputeDispatchIndirectArgs(workgroupCountX, workgroupCountY = 1, workgroupCountZ = 1) {
  const args = new Uint32Array(COMPUTE_DISPATCH_INDIRECT_UINTS);
  args[0] = Math.max(1, Math.floor(finiteNumber(workgroupCountX, 1)));
  args[1] = Math.max(1, Math.floor(finiteNumber(workgroupCountY, 1)));
  args[2] = Math.max(1, Math.floor(finiteNumber(workgroupCountZ, 1)));
  return args;
}

function activeGridDispatchPlanBuffers(planHint = null) {
  return [
    planHint?.dispatchArgsBuffer,
    planHint?.metadataBuffer
  ].filter(Boolean);
}

function activeGridDispatchPlanHintFromCompactSummary(compactGpuSummary = null) {
  const plan = compactGpuSummary?.activeGridDispatchPlan;
  const dispatchArgsBuffer = compactGpuSummary?.activeGridDispatchPlanDispatchArgsBuffer ?? null;
  const metadataBuffer = compactGpuSummary?.activeGridDispatchPlanMetadataBuffer ?? null;
  if (
    plan?.status !== 'gpu-active-grid-summary-dispatch-plan-ready'
    || !dispatchArgsBuffer
    || !metadataBuffer
  ) {
    return null;
  }
  const hint = {
    schema: 'peercompute.ulg.mls-mpm-active-grid-summary-dispatch-plan-hint.v0',
    status: 'active-grid-summary-dispatch-plan-hint-ready',
    source: plan.source || 'compact-summary-gpu-sidecar',
    plan: { ...plan },
    dispatchArgsBuffer,
    metadataBuffer,
    dispatchArgsBufferByteLength: compactGpuSummary.activeGridDispatchPlanDispatchArgsBufferByteLength
      ?? plan.dispatchArgsBufferByteLength
      ?? 0,
    metadataBufferByteLength: compactGpuSummary.activeGridDispatchPlanMetadataBufferByteLength
      ?? plan.metadataBufferByteLength
      ?? 0,
    destroyed: false
  };
  hint.destroyActiveGridDispatchPlanBuffers = () => {
    if (hint.destroyed) return;
    hint.destroyed = true;
    compactGpuSummary.destroyActiveGridDispatchPlanBuffers?.();
  };
  return hint;
}

function activeGridDispatchPlanHintCompatibility(planHint, {
  activeGridDispatch,
  gridSpec,
  stepCount = 1,
  dt = 0
} = {}) {
  const result = (compatible, reason, details = {}) => ({
    compatible,
    reason,
    ...details
  });
  if (!planHint) {
    return result(false, 'no-active-grid-dispatch-plan-hint');
  }
  if (planHint.status !== 'active-grid-summary-dispatch-plan-hint-ready') {
    return result(false, 'active-grid-dispatch-plan-hint-status-not-ready', {
      hintStatus: planHint.status ?? null
    });
  }
  if (planHint.destroyed === true) {
    return result(false, 'active-grid-dispatch-plan-hint-destroyed');
  }
  if (!planHint.dispatchArgsBuffer) {
    return result(false, 'active-grid-dispatch-plan-hint-missing-dispatch-args-buffer');
  }
  if (activeGridDispatch?.useActiveGrid !== true) {
    return result(false, 'active-grid-dispatch-disabled');
  }
  if (!gridSpec) {
    return result(false, 'active-grid-dispatch-grid-spec-missing');
  }
  const plan = planHint.plan || {};
  const planDims = Array.isArray(plan.gridDims) ? plan.gridDims : [];
  if (planDims.length < 3 || planDims.some((value, axis) => Math.round(Number(value)) !== gridSpec.gridDims[axis])) {
    return result(false, 'active-grid-dispatch-plan-grid-dims-mismatch', {
      planGridDims: planDims.slice(0, 3),
      expectedGridDims: [...gridSpec.gridDims]
    });
  }
  if (Math.round(Number(plan.gridShift)) !== gridSpec.shift) {
    return result(false, 'active-grid-dispatch-plan-grid-shift-mismatch', {
      planGridShift: Math.round(Number(plan.gridShift)),
      expectedGridShift: gridSpec.shift
    });
  }
  if (Math.abs(finiteNumber(plan.gridSpacingM, Number.NaN) - gridSpec.gridSpacingM) > 1e-9) {
    return result(false, 'active-grid-dispatch-plan-grid-spacing-mismatch', {
      planGridSpacingM: finiteNumber(plan.gridSpacingM, Number.NaN),
      expectedGridSpacingM: gridSpec.gridSpacingM
    });
  }
  if (Math.round(Number(plan.gridNodeCount)) !== gridSpec.gridNodeCount) {
    return result(false, 'active-grid-dispatch-plan-grid-node-count-mismatch', {
      planGridNodeCount: Math.round(Number(plan.gridNodeCount)),
      expectedGridNodeCount: gridSpec.gridNodeCount
    });
  }
  if (Math.round(Number(plan.safetyCells)) !== Math.round(Number(activeGridDispatch.safetyCells))) {
    return result(false, 'active-grid-dispatch-plan-safety-cells-mismatch', {
      planSafetyCells: Math.round(Number(plan.safetyCells)),
      expectedSafetyCells: Math.round(Number(activeGridDispatch.safetyCells))
    });
  }
  const expectedStepCount = Math.max(1, Math.round(finiteNumber(stepCount, 1)));
  if (Math.round(Number(plan.stepCount)) !== expectedStepCount) {
    return result(false, 'active-grid-dispatch-plan-step-count-mismatch', {
      planStepCount: Math.round(Number(plan.stepCount)),
      expectedStepCount
    });
  }
  if (Math.abs(finiteNumber(plan.dt, 0) - finiteNumber(dt, 0)) > 1e-9) {
    return result(false, 'active-grid-dispatch-plan-dt-mismatch', {
      planDt: finiteNumber(plan.dt, 0),
      expectedDt: finiteNumber(dt, 0)
    });
  }
  return result(true, 'active-grid-dispatch-plan-compatible', {
    hintStatus: planHint.status,
    hintSource: planHint.source ?? null
  });
}

function activeGridDispatchPlanHintCompatible(planHint, options = {}) {
  return activeGridDispatchPlanHintCompatibility(planHint, options).compatible === true;
}

function createActiveGridComputeDispatchArgsBuffer(
  device,
  activeGridDispatch,
  workgroupCountX,
  activeGridDispatchPlanHint = null,
  planCompatibility = {}
) {
  if (activeGridDispatch?.useActiveGrid !== true) return null;
  const hintCompatibility = activeGridDispatchPlanHintCompatibility(activeGridDispatchPlanHint, {
    activeGridDispatch,
    ...planCompatibility
  });
  if (hintCompatibility.compatible) {
    return {
      schema: 'peercompute.ulg.mls-mpm-active-grid-compute-dispatch-indirect.v0',
      status: 'gpu-summary-active-grid-indirect-dispatch-ready',
      source: 'compact-summary-gpu-sidecar',
      buffer: activeGridDispatchPlanHint.dispatchArgsBuffer,
      metadataBuffer: activeGridDispatchPlanHint.metadataBuffer,
      ownsBuffer: false,
      bufferByteLength: activeGridDispatchPlanHint.dispatchArgsBufferByteLength,
      metadataBufferByteLength: activeGridDispatchPlanHint.metadataBufferByteLength,
      offsetBytes: 0,
      workgroupCountX: Math.max(1, Math.floor(finiteNumber(workgroupCountX, 1))),
      workgroupCountY: 1,
      workgroupCountZ: 1,
      workgroupSize: 64,
      activeGridNodeCount: Math.max(0, Math.floor(finiteNumber(activeGridDispatch.activeNodeCount, 0))),
      fullGridNodeCount: Math.max(0, Math.floor(finiteNumber(activeGridDispatch.fullGridNodeCount, 0))),
      indirectDispatchUsed: false,
      indirectDispatchUseCount: 0,
      directDispatchFallbackCount: 0,
      dispatchMode: 'pending',
      dispatchPlanHintStatus: activeGridDispatchPlanHint.status,
      dispatchPlanHintSource: activeGridDispatchPlanHint.source,
      dispatchPlanHintBorrowed: true,
      dispatchPlanHintCompatibilityReason: hintCompatibility.reason,
      dispatchPlanHintCompatibility: hintCompatibility
    };
  }
  const args = createComputeDispatchIndirectArgs(workgroupCountX);
  const buffer = writeGpuBuffer(
    device,
    'ulg-mls-mpm-active-grid-dispatch-indirect-args',
    args,
    GPU_BUFFER_USAGE.INDIRECT | GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  );
  return {
    schema: 'peercompute.ulg.mls-mpm-active-grid-compute-dispatch-indirect.v0',
    status: 'cpu-seeded-active-grid-indirect-dispatch-ready',
    source: 'active-grid-dispatch-cpu-metadata',
    buffer,
    ownsBuffer: true,
    bufferByteLength: args.byteLength,
    offsetBytes: 0,
    workgroupCountX: args[0],
    workgroupCountY: args[1],
    workgroupCountZ: args[2],
    workgroupSize: 64,
    activeGridNodeCount: Math.max(0, Math.floor(finiteNumber(activeGridDispatch.activeNodeCount, 0))),
    fullGridNodeCount: Math.max(0, Math.floor(finiteNumber(activeGridDispatch.fullGridNodeCount, 0))),
    indirectDispatchUsed: false,
    indirectDispatchUseCount: 0,
    directDispatchFallbackCount: 0,
    dispatchMode: 'pending',
    dispatchPlanHintStatus: activeGridDispatchPlanHint?.status ?? null,
    dispatchPlanHintSource: activeGridDispatchPlanHint?.source ?? null,
    dispatchPlanHintBorrowed: false,
    dispatchPlanHintCompatibilityReason: hintCompatibility.reason,
    dispatchPlanHintCompatibility: hintCompatibility
  };
}

function dispatchActiveGridComputePass(pass, directWorkgroupCount, indirectDispatchArgs) {
  if (indirectDispatchArgs?.buffer && typeof pass.dispatchWorkgroupsIndirect === 'function') {
    pass.dispatchWorkgroupsIndirect(indirectDispatchArgs.buffer, indirectDispatchArgs.offsetBytes);
    indirectDispatchArgs.indirectDispatchUsed = true;
    indirectDispatchArgs.indirectDispatchUseCount += 1;
    indirectDispatchArgs.dispatchMode = 'dispatchWorkgroupsIndirect';
    return 'dispatchWorkgroupsIndirect';
  }
  pass.dispatchWorkgroups(directWorkgroupCount);
  if (indirectDispatchArgs) {
    indirectDispatchArgs.directDispatchFallbackCount += 1;
    if (indirectDispatchArgs.dispatchMode === 'pending') {
      indirectDispatchArgs.dispatchMode = 'dispatchWorkgroups';
    }
  }
  return 'dispatchWorkgroups';
}

function activeGridIndirectDispatchDescriptor(indirectDispatchArgs) {
  if (!indirectDispatchArgs) return null;
  return {
    schema: indirectDispatchArgs.schema,
    status: indirectDispatchArgs.status,
    source: indirectDispatchArgs.source,
    bufferByteLength: indirectDispatchArgs.bufferByteLength,
    metadataBufferByteLength: indirectDispatchArgs.metadataBufferByteLength ?? 0,
    ownsBuffer: indirectDispatchArgs.ownsBuffer !== false,
    offsetBytes: indirectDispatchArgs.offsetBytes,
    workgroupCountX: indirectDispatchArgs.workgroupCountX,
    workgroupCountY: indirectDispatchArgs.workgroupCountY,
    workgroupCountZ: indirectDispatchArgs.workgroupCountZ,
    workgroupSize: indirectDispatchArgs.workgroupSize,
    activeGridNodeCount: indirectDispatchArgs.activeGridNodeCount,
    fullGridNodeCount: indirectDispatchArgs.fullGridNodeCount,
    indirectDispatchUsed: indirectDispatchArgs.indirectDispatchUsed,
    indirectDispatchUseCount: indirectDispatchArgs.indirectDispatchUseCount,
    directDispatchFallbackCount: indirectDispatchArgs.directDispatchFallbackCount,
    dispatchMode: indirectDispatchArgs.dispatchMode,
    dispatchPlanHintStatus: indirectDispatchArgs.dispatchPlanHintStatus ?? null,
    dispatchPlanHintSource: indirectDispatchArgs.dispatchPlanHintSource ?? null,
    dispatchPlanHintBorrowed: indirectDispatchArgs.dispatchPlanHintBorrowed === true,
    dispatchPlanHintCompatibilityReason: indirectDispatchArgs.dispatchPlanHintCompatibilityReason ?? null,
    dispatchPlanHintCompatibility: indirectDispatchArgs.dispatchPlanHintCompatibility
      ? { ...indirectDispatchArgs.dispatchPlanHintCompatibility }
      : null
  };
}

function attachActiveGridIndirectDispatchTopology(dispatchTopology, indirectDispatchArgs) {
  if (!dispatchTopology || !indirectDispatchArgs) return dispatchTopology;
  const descriptor = activeGridIndirectDispatchDescriptor(indirectDispatchArgs);
  dispatchTopology.activeGridIndirectDispatch = descriptor;
  for (const stageId of ['p2gAccumulatorClear', 'p2gFinalize', 'gridUpdate']) {
    if (!dispatchTopology[stageId]) continue;
    dispatchTopology[stageId].dispatchSubmissionMode = descriptor.dispatchMode;
    dispatchTopology[stageId].indirectDispatchReady = true;
    dispatchTopology[stageId].indirectDispatchUsed = descriptor.indirectDispatchUsed;
    dispatchTopology[stageId].indirectDispatchArgsBufferByteLength = descriptor.bufferByteLength;
    dispatchTopology[stageId].indirectDispatchWorkgroupCountX = descriptor.workgroupCountX;
  }
  return dispatchTopology;
}

async function readGpuBuffer(device, sourceBuffer, byteLength, label) {
  const readback = device.createBuffer({
    label,
    size: Math.max(4, byteLength),
    usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
  });
  const encoder = device.createCommandEncoder();
  encoder.copyBufferToBuffer(sourceBuffer, 0, readback, 0, byteLength);
  device.queue.submit([encoder.finish()]);
  await readback.mapAsync(GPU_MAP_MODE.READ);
  const copy = readback.getMappedRange().slice(0, byteLength);
  readback.unmap();
  readback.destroy?.();
  return copy;
}

function createSpatialGasLedgerProductEventCompactParams({
  productEventRowCount,
  productEventStrideFloats,
  spatialGasSupportVolumeFallbackM3 = 0
} = {}) {
  const buffer = new ArrayBuffer(32);
  const view = new DataView(buffer);
  view.setUint32(0, Math.max(0, Math.floor(finiteNumber(productEventRowCount, 0))), true);
  view.setUint32(4, Math.max(1, Math.floor(finiteNumber(productEventStrideFloats, SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS))), true);
  view.setUint32(8, SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS, true);
  view.setUint32(12, 0, true);
  view.setFloat32(16, Math.max(0, finiteNumber(spatialGasSupportVolumeFallbackM3, 0)), true);
  view.setUint32(20, 0, true);
  view.setUint32(24, 0, true);
  view.setUint32(28, 0, true);
  return buffer;
}

function createSpatialGasLedgerProductEventCompactWgsl() {
  return `
struct Params {
  product_event_row_count: u32,
  product_event_stride_floats: u32,
  compact_stride_floats: u32,
  pad0: u32,
  spatial_gas_support_volume_fallback_m3: f32,
  pad1: u32,
  pad2: u32,
  pad3: u32,
};

@group(0) @binding(0) var<storage, read> product_events: array<f32>;
@group(0) @binding(1) var<storage, read_write> compact_rows: array<f32>;
@group(0) @binding(2) var<uniform> params: Params;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row = global_id.x;
  if (row >= params.product_event_row_count) {
    return;
  }
  let src = row * params.product_event_stride_floats;
  let dst = row * params.compact_stride_floats;
  let status = product_events[src + 18u];
  let routing = product_events[src + 10u];
  let moles = product_events[src + 9u];
  let source_support_volume = product_events[src + 23u];
  let support_volume = select(
    params.spatial_gas_support_volume_fallback_m3,
    source_support_volume,
    source_support_volume > 0.0
  );
  compact_rows[dst + 0u] = product_events[src + 0u];
  compact_rows[dst + 1u] = product_events[src + 1u];
  compact_rows[dst + 2u] = product_events[src + 2u];
  compact_rows[dst + 3u] = product_events[src + 4u];
  compact_rows[dst + 4u] = product_events[src + 3u];
  compact_rows[dst + 5u] = moles;
  compact_rows[dst + 6u] = product_events[src + 16u];
  compact_rows[dst + 7u] = support_volume;
  compact_rows[dst + 8u] = product_events[src + 5u];
  compact_rows[dst + 9u] = f32(row);
  compact_rows[dst + 10u] = status;
  compact_rows[dst + 11u] = routing;
}
`;
}

function productTermMetadataByIndexForSpatialLedger(reactionTable) {
  const terms = Array.isArray(reactionTable?.productTermMetadata)
    ? reactionTable.productTermMetadata
    : [];
  return new Map(terms.map((term) => [Math.round(Number(term.productTermIndex) || 0), term]));
}

function materialForSpatialGasCompactRow(row, terms) {
  const productTermIndex = Math.round(Number(row.productTermIndex) || 0);
  const term = terms.get(productTermIndex) || null;
  return String(term?.material || Math.round(Number(row.materialId) || 0)).toLowerCase();
}

function spatialGasGridKey(index) {
  return index.map((value) => Math.round(value)).join(',');
}

function decodeSpatialGasLedgerCompactRows(values, {
  productEventRowCount = null,
  boxDimsM = null,
  reactionTable = null,
  source = 'gpu-resident-product-event-compact-spatial-ledger',
  spatialGasSupportVolumeFallbackM3 = 0,
  retainedSpatialGasSourceBufferRefs = [],
  workerRetainedSpatialGasSourceBufferRefs = [],
  retainedSpatialGasLedgerBufferRefs = [],
  workerRetainedSpatialGasLedgerBufferRefs = []
} = {}) {
  if (!(values instanceof Float32Array) || values.length % SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS !== 0) {
    throw new TypeError('decodeSpatialGasLedgerCompactRows requires f32 rows aligned to the compact spatial gas layout');
  }
  const dims = finiteVector3(boxDimsM, DEFAULT_BOX_DIMS_M).map((value) => Math.max(value, 1e-9));
  const terms = productTermMetadataByIndexForSpatialLedger(reactionTable);
  const rows = [];
  const maxRows = productEventRowCount == null
    ? values.length / SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS
    : Math.min(
        Math.max(0, Math.floor(finiteNumber(productEventRowCount, 0))),
        values.length / SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS
      );
  for (let rowIndex = 0; rowIndex < maxRows; rowIndex += 1) {
    const offset = rowIndex * SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS;
    const status = values[offset + 10];
    const moles = finiteNumber(values[offset + 5], 0);
    const supportVolumeM3 = finiteNumber(values[offset + 7], 0);
    const routingId = finiteNumber(values[offset + 11], 1);
    const positionM = [values[offset], values[offset + 1], values[offset + 2]].map((value) => finiteNumber(value, NaN));
    if (
      status <= 0.5
      || routingId <= 0.5
      || routingId >= 1.5
      || moles <= 0
      || supportVolumeM3 <= 0
      || positionM.some((value) => !Number.isFinite(value))
    ) {
      continue;
    }
    rows.push({
      positionM,
      materialId: finiteNumber(values[offset + 3], 0),
      massKg: finiteNumber(values[offset + 4], 0),
      moles,
      temperatureK: finiteNumber(values[offset + 6], 293.15),
      supportVolumeM3,
      productTermIndex: Math.round(finiteNumber(values[offset + 8], 0)),
      sourceRowIndex: Math.round(finiteNumber(values[offset + 9], rowIndex)),
      routingId,
      status: 'ready'
    });
  }
  if (!rows.length) return null;
  const meanSupportVolumeM3 = rows.reduce((sum, row) => sum + row.supportVolumeM3, 0) / rows.length;
  const supportEdgeM = Math.cbrt(Math.max(meanSupportVolumeM3, 1e-12));
  const cellDims = dims.map((dim) => Math.max(1, Math.ceil(dim / supportEdgeM)));
  const buckets = new Map();
  for (const row of rows) {
    const gridIndex = row.positionM.map((position, axis) => {
      const normalized = dims[axis] > 0 ? position / dims[axis] : 0;
      return Math.max(0, Math.min(cellDims[axis] - 1, Math.floor(normalized * cellDims[axis])));
    });
    const key = spatialGasGridKey(gridIndex);
    const bucket = buckets.get(key) || {
      index: buckets.size,
      gridIndex,
      weightedPositionM: [0, 0, 0],
      weightMoles: 0,
      volumeM3: 0,
      bySpecies: {},
      sourceEventCount: 0,
      sourceRowIndices: []
    };
    bucket.weightMoles += row.moles;
    bucket.volumeM3 += row.supportVolumeM3;
    bucket.weightedPositionM = bucket.weightedPositionM.map((value, axis) => value + row.positionM[axis] * row.moles);
    bucket.sourceEventCount += 1;
    bucket.sourceRowIndices.push(row.sourceRowIndex);
    const material = materialForSpatialGasCompactRow(row, terms);
    const species = bucket.bySpecies[material] || (bucket.bySpecies[material] = {
      material,
      materialId: row.materialId,
      massKg: 0,
      moles: 0,
      temperatureMoleK: 0,
      eventCount: 0
    });
    species.massKg += row.massKg;
    species.moles += row.moles;
    species.temperatureMoleK += row.moles * row.temperatureK;
    species.eventCount += 1;
    buckets.set(key, bucket);
  }
  const cells = [...buckets.values()].map((bucket) => ({
    index: bucket.index,
    gridIndex: bucket.gridIndex,
    centerM: bucket.weightMoles > 0
      ? bucket.weightedPositionM.map((value) => value / bucket.weightMoles)
      : bucket.gridIndex.map((value, axis) => (value + 0.5) * (dims[axis] / cellDims[axis])),
    volumeM3: bucket.volumeM3,
    sourceEventCount: bucket.sourceEventCount,
    sourceRowIndices: [...bucket.sourceRowIndices],
    bySpecies: Object.fromEntries(Object.entries(bucket.bySpecies).map(([material, species]) => [
      material,
      {
        material,
        materialId: species.materialId,
        massKg: species.massKg,
        moles: species.moles,
        temperatureK: species.moles > 0 ? species.temperatureMoleK / species.moles : 293.15,
        eventCount: species.eventCount
      }
    ]))
  }));
  const retainedSourceRefs = uniqueNonEmptyStrings([
    ...retainedSpatialGasSourceBufferRefs,
    ...workerRetainedSpatialGasSourceBufferRefs
  ]);
  const retainedLedgerRefs = uniqueNonEmptyStrings([
    ...retainedSpatialGasLedgerBufferRefs,
    ...workerRetainedSpatialGasLedgerBufferRefs
  ]);
  return {
    schema: ULG_SPH_SPATIAL_GAS_SPECIES_LEDGER_SCHEMA,
    status: 'spatial-gas-species-ledger-ready',
    source,
    spatialGasLedgerDerivation: 'positioned-product-event-rows',
    spatialGasPositionSource: 'resident-product-event-row-positions',
    spatialGasSupportVolumeSource: spatialGasSupportVolumeFallbackM3 > 0
      ? 'product-event-row-support-volume-or-derived-gas-ledger-share'
      : 'product-event-row-support-volume',
    spatialGasSupportVolumeFallbackM3: Math.max(0, finiteNumber(spatialGasSupportVolumeFallbackM3, 0)),
    retainedSpatialGasSourceBufferRefs: uniqueNonEmptyStrings(retainedSpatialGasSourceBufferRefs),
    workerRetainedSpatialGasSourceBufferRefs: uniqueNonEmptyStrings(workerRetainedSpatialGasSourceBufferRefs),
    spatialGasSourceBufferRetained: retainedSourceRefs.length > 0,
    retainedSpatialGasLedgerBufferRefs: uniqueNonEmptyStrings(retainedSpatialGasLedgerBufferRefs),
    workerRetainedSpatialGasLedgerBufferRefs: uniqueNonEmptyStrings(workerRetainedSpatialGasLedgerBufferRefs),
    spatialGasLedgerBufferRetained: retainedLedgerRefs.length > 0,
    cellDims,
    cellCount: cells.length,
    cells,
    sourceEventRowCount: rows.length,
    scannedProductEventRowCount: maxRows,
    pressureClosure: 'ideal-gas-law-per-cell',
    spatialGasSpeciesLedgerValidation: false,
    scientificValidation: false,
    gasValidation: false,
    fullPhysicsValidation: false
  };
}

function aggregateGasRecordsForSpatialLedger(...sources) {
  const records = [];
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    if (Array.isArray(source.gasSpeciesLedger?.records)) records.push(...source.gasSpeciesLedger.records);
    if (Array.isArray(source.records)) records.push(...source.records);
    if (source.bySpecies && typeof source.bySpecies === 'object') records.push(...Object.values(source.bySpecies));
  }
  const byMaterial = new Map();
  for (const record of records) {
    const moles = finiteNumber(record?.moles, 0);
    const massKg = finiteNumber(record?.massKg, 0);
    if (!(moles > 0) || !(massKg >= 0)) continue;
    const material = String(record?.material || Math.round(finiteNumber(record?.materialId, 0))).toLowerCase();
    const bucket = byMaterial.get(material) || {
      material,
      materialId: finiteNumber(record?.materialId, 0),
      massKg: 0,
      moles: 0,
      temperatureMoleK: 0,
      eventCount: 0
    };
    const temperatureK = finiteNumber(record?.temperatureK, 293.15);
    bucket.massKg += massKg;
    bucket.moles += moles;
    bucket.temperatureMoleK += moles * temperatureK;
    bucket.eventCount += Math.max(0, finiteNumber(record?.eventCount, 0));
    byMaterial.set(material, bucket);
  }
  return [...byMaterial.values()];
}

function deriveSpatialGasSupportVolumeFallbackM3({
  boxDimsM = null,
  residentProductMass = null,
  reactionSummary = null,
  gasPressureSummary = null,
  productEventRowCount = 0,
  explicitFallbackM3 = null
} = {}) {
  const explicit = finiteNumber(explicitFallbackM3, 0);
  if (explicit > 0) return explicit;
  const records = aggregateGasRecordsForSpatialLedger(
    residentProductMass,
    reactionSummary,
    gasPressureSummary?.gasSpeciesLedger,
    gasPressureSummary
  );
  if (!records.length) return 0;
  const dims = finiteVector3(boxDimsM || gasPressureSummary?.boxDimsM, DEFAULT_BOX_DIMS_M)
    .map((value) => Math.max(value, 1e-9));
  const volumeM3 = dims.reduce((product, value) => product * value, 1);
  const gasEventCount = records.reduce((sum, record) => sum + Math.max(0, finiteNumber(record?.eventCount, 0)), 0);
  const denominator = gasEventCount > 0
    ? gasEventCount
    : Math.max(1, Math.floor(finiteNumber(productEventRowCount, 0)) || records.length);
  return volumeM3 / denominator;
}

function spatialGasLedgerFromAggregateGasLedger({
  residentProductMass = null,
  reactionSummary = null,
  gasPressureSummary = null,
  boxDimsM = null,
  source = 'resident-product-mass-aggregate-gas-ledger-uniform-spatial-ledger',
  retainedSpatialGasSourceBufferRefs = [],
  workerRetainedSpatialGasSourceBufferRefs = [],
  retainedSpatialGasLedgerBufferRefs = [],
  workerRetainedSpatialGasLedgerBufferRefs = []
} = {}) {
  const records = aggregateGasRecordsForSpatialLedger(
    residentProductMass,
    reactionSummary,
    gasPressureSummary?.gasSpeciesLedger,
    gasPressureSummary
  );
  if (records.length === 0) return null;
  const dims = finiteVector3(boxDimsM || gasPressureSummary?.boxDimsM, DEFAULT_BOX_DIMS_M)
    .map((value) => Math.max(value, 1e-9));
  const volumeM3 = dims.reduce((product, value) => product * value, 1);
  const bySpecies = Object.fromEntries(records.map((record) => [
    record.material,
    {
      material: record.material,
      materialId: record.materialId,
      massKg: record.massKg,
      moles: record.moles,
      temperatureK: record.moles > 0 ? record.temperatureMoleK / record.moles : 293.15,
      eventCount: record.eventCount
    }
  ]));
  const retainedSourceRefs = uniqueNonEmptyStrings([
    ...retainedSpatialGasSourceBufferRefs,
    ...workerRetainedSpatialGasSourceBufferRefs
  ]);
  const retainedLedgerRefs = uniqueNonEmptyStrings([
    ...retainedSpatialGasLedgerBufferRefs,
    ...workerRetainedSpatialGasLedgerBufferRefs
  ]);
  return {
    schema: ULG_SPH_SPATIAL_GAS_SPECIES_LEDGER_SCHEMA,
    status: 'spatial-gas-species-ledger-ready',
    source,
    spatialGasLedgerDerivation: 'aggregate-gas-ledger-single-cell-sealed-box',
    spatialGasPositionSource: 'aggregate-gas-ledger-no-positioned-product-events',
    retainedSpatialGasSourceBufferRefs: uniqueNonEmptyStrings(retainedSpatialGasSourceBufferRefs),
    workerRetainedSpatialGasSourceBufferRefs: uniqueNonEmptyStrings(workerRetainedSpatialGasSourceBufferRefs),
    spatialGasSourceBufferRetained: retainedSourceRefs.length > 0,
    retainedSpatialGasLedgerBufferRefs: uniqueNonEmptyStrings(retainedSpatialGasLedgerBufferRefs),
    workerRetainedSpatialGasLedgerBufferRefs: uniqueNonEmptyStrings(workerRetainedSpatialGasLedgerBufferRefs),
    spatialGasLedgerBufferRetained: retainedLedgerRefs.length > 0,
    cellDims: [1, 1, 1],
    cellCount: 1,
    cells: [{
      index: 0,
      gridIndex: [0, 0, 0],
      centerM: dims.map((value) => value * 0.5),
      volumeM3,
      sourceEventCount: records.reduce((sum, record) => sum + record.eventCount, 0),
      sourceRowIndices: [],
      bySpecies
    }],
    sourceEventRowCount: 0,
    sourceAggregateGasRecordCount: records.length,
    pressureClosure: 'ideal-gas-law-single-cell-sealed-box',
    spatialGasSpeciesLedgerValidation: false,
    scientificValidation: false,
    gasValidation: false,
    fullPhysicsValidation: false
  };
}

function compactSpatialGasRowsFromProductEventRows(productEventRows, {
  productEventRowCount = null,
  productEventStrideFloats = SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS,
  spatialGasSupportVolumeFallbackM3 = 0
} = {}) {
  if (!(productEventRows instanceof Float32Array)) return null;
  const stride = Math.max(1, Math.floor(finiteNumber(productEventStrideFloats, SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS)));
  const rowCount = Math.min(
    Math.floor(productEventRows.length / stride),
    productEventRowCount == null
      ? Math.floor(productEventRows.length / stride)
      : Math.max(0, Math.floor(finiteNumber(productEventRowCount, 0)))
  );
  const compactRows = new Float32Array(rowCount * SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS);
  for (let row = 0; row < rowCount; row += 1) {
    const src = row * stride;
    const dst = row * SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS;
    const status = productEventRows[src + 18] ?? 0;
    const routing = productEventRows[src + 10] ?? 0;
    const moles = productEventRows[src + 9] ?? 0;
    const sourceSupportVolume = productEventRows[src + 23] ?? 0;
    const supportVolume = sourceSupportVolume > 0
      ? sourceSupportVolume
      : Math.max(0, finiteNumber(spatialGasSupportVolumeFallbackM3, 0));
    const active = status > 0.5 && routing > 0.5 && routing < 1.5 && moles > 0 && supportVolume > 0;
    if (!active) continue;
    compactRows[dst] = productEventRows[src] ?? 0;
    compactRows[dst + 1] = productEventRows[src + 1] ?? 0;
    compactRows[dst + 2] = productEventRows[src + 2] ?? 0;
    compactRows[dst + 3] = productEventRows[src + 4] ?? 0;
    compactRows[dst + 4] = productEventRows[src + 3] ?? 0;
    compactRows[dst + 5] = moles;
    compactRows[dst + 6] = productEventRows[src + 16] ?? 293.15;
    compactRows[dst + 7] = supportVolume;
    compactRows[dst + 8] = productEventRows[src + 5] ?? 0;
    compactRows[dst + 9] = row;
    compactRows[dst + 10] = 1;
    compactRows[dst + 11] = routing;
  }
  return compactRows;
}

function replaceRequiredWgsl(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`Unable to build active-grid WGSL variant; missing ${label}`);
  }
  return source.replace(search, replacement);
}

function createActiveGridP2gProjectionWgsl() {
  const withParams = replaceRequiredWgsl(
    mlsMpmP2gGridProjectionWgsl,
    `  pad1: u32,
};`,
    `  pad1: u32,
  active_start_i: u32,
  active_start_j: u32,
  active_start_k: u32,
  active_count_i: u32,
  active_count_j: u32,
  active_count_k: u32,
  active_node_count: u32,
  active_pad0: u32,
};`,
    'P2G active parameter fields'
  );
  const withEnabledFilter = replaceRequiredWgsl(
    withParams,
    `fn p2g_node_enabled(i: u32, j: u32, k: u32) -> bool {
  return true;
}`,
    `fn p2g_node_enabled(i: u32, j: u32, k: u32) -> bool {
  return i >= params.active_start_i
    && j >= params.active_start_j
    && k >= params.active_start_k
    && i < params.active_start_i + params.active_count_i
    && j < params.active_start_j + params.active_count_j
    && k < params.active_start_k + params.active_count_k;
}`,
    'P2G active node write filter'
  );
  const withActiveFinalizeIndex = replaceRequiredWgsl(
    withEnabledFilter,
    `fn p2g_finalize_node_index(global_index: u32) -> u32 {
  if (global_index >= params.grid_node_count) {
    return params.grid_node_count;
  }
  return global_index;
}`,
    `fn p2g_finalize_node_index(global_index: u32) -> u32 {
  if (global_index >= params.active_node_count) {
    return params.grid_node_count;
  }
  let active_plane = max(params.active_count_j * params.active_count_k, 1u);
  let active_i = global_index / active_plane;
  let active_rem = global_index - active_i * active_plane;
  let active_j = active_rem / max(params.active_count_k, 1u);
  let active_k = active_rem - active_j * params.active_count_k;
  let i = active_i + params.active_start_i;
  let j = active_j + params.active_start_j;
  let k = active_k + params.active_start_k;
  if (i >= params.grid_nx || j >= params.grid_ny || k >= params.grid_nz) {
    return params.grid_node_count;
  }
  return (i * params.grid_ny + j) * params.grid_nz + k;
}`,
    'P2G active finalize node index mapping'
  );
  return `${withActiveFinalizeIndex}

@compute @workgroup_size(64)
fn clear_accumulators(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let node_index = p2g_finalize_node_index(global_id.x);
  if (node_index >= params.grid_node_count) {
    return;
  }
  let accumulator_base = node_index * 4u;
  atomicStore(&grid_accumulators[accumulator_base], 0);
  atomicStore(&grid_accumulators[accumulator_base + 1u], 0);
  atomicStore(&grid_accumulators[accumulator_base + 2u], 0);
  atomicStore(&grid_accumulators[accumulator_base + 3u], 0);
}
`;
}

function createActiveGridUpdateWgsl() {
  const withParams = replaceRequiredWgsl(
    mlsMpmGridUpdateWgsl,
    `  wall_barrier_min_gap_m: f32,
};`,
    `  wall_barrier_min_gap_m: f32,
  active_start_i: u32,
  active_start_j: u32,
  active_start_k: u32,
  active_count_i: u32,
  active_count_j: u32,
  active_count_k: u32,
  active_node_count: u32,
  active_pad0: u32,
};`,
    'grid-update active parameter fields'
  );
  return replaceRequiredWgsl(
    withParams,
    `  let node_index = global_id.x;
  if (node_index >= params.grid_node_count) {
    return;
  }

  let row0 = p2g_grid_nodes[node_index * 2u];`,
    `  let active_index = global_id.x;
  if (active_index >= params.active_node_count) {
    return;
  }
  let active_plane = max(params.active_count_j * params.active_count_k, 1u);
  let active_i = active_index / active_plane;
  let active_rem = active_index - active_i * active_plane;
  let active_j = active_rem / max(params.active_count_k, 1u);
  let active_k = active_rem - active_j * params.active_count_k;
  let i = active_i + params.active_start_i;
  let j = active_j + params.active_start_j;
  let k = active_k + params.active_start_k;
  if (i >= params.grid_nx || j >= params.grid_ny || k >= params.grid_nz) {
    return;
  }
  let node_index = (i * params.grid_ny + j) * params.grid_nz + k;

  let row0 = p2g_grid_nodes[node_index * 2u];`,
    'grid-update active node index mapping'
  );
}

const mlsMpmP2gGridProjectionActiveGridWgsl = createActiveGridP2gProjectionWgsl();
const mlsMpmGridUpdateActiveGridWgsl = createActiveGridUpdateWgsl();

function createFusedP2gParamsArray(gridSpec, particleCount, dt, internalPressureScale = 1) {
  const buffer = new ArrayBuffer(48);
  const view = new DataView(buffer);
  view.setUint32(0, particleCount, true);
  view.setUint32(4, gridSpec.gridNodeCount, true);
  view.setUint32(8, gridSpec.gridDims[0], true);
  view.setUint32(12, gridSpec.gridDims[1], true);
  view.setUint32(16, gridSpec.gridDims[2], true);
  view.setUint32(20, gridSpec.shift, true);
  view.setFloat32(24, gridSpec.gridSpacingM, true);
  view.setFloat32(28, gridSpec.invGridSpacingM, true);
  view.setFloat32(32, finiteNumber(dt, 0), true);
  view.setUint32(36, 0, true);
  view.setFloat32(40, finiteNumber(internalPressureScale, 1), true);
  return buffer;
}

function createFusedActiveP2gParamsArray(gridSpec, particleCount, dt, internalPressureScale, activeGridDispatch) {
  const buffer = new ArrayBuffer(80);
  new Uint8Array(buffer).set(new Uint8Array(createFusedP2gParamsArray(
    gridSpec,
    particleCount,
    dt,
    internalPressureScale
  )));
  const view = new DataView(buffer);
  view.setUint32(48, activeGridDispatch.activeStart[0], true);
  view.setUint32(52, activeGridDispatch.activeStart[1], true);
  view.setUint32(56, activeGridDispatch.activeStart[2], true);
  view.setUint32(60, activeGridDispatch.activeCount[0], true);
  view.setUint32(64, activeGridDispatch.activeCount[1], true);
  view.setUint32(68, activeGridDispatch.activeCount[2], true);
  view.setUint32(72, activeGridDispatch.activeNodeCount, true);
  return buffer;
}

function createFusedGridUpdateParamsArray({
  gridSpec,
  dt,
  gravityMPerS2,
  boxDimsM,
  cflFactor,
  pressureInterfaceForceRowCount = 0
}) {
  const buffer = new ArrayBuffer(80);
  const view = new DataView(buffer);
  view.setUint32(0, gridSpec.gridNodeCount, true);
  view.setUint32(4, gridSpec.gridDims[0], true);
  view.setUint32(8, gridSpec.gridDims[1], true);
  view.setUint32(12, gridSpec.gridDims[2], true);
  view.setUint32(16, gridSpec.shift, true);
  view.setUint32(20, pressureInterfaceForceRowCount, true);
  view.setFloat32(32, gridSpec.gridSpacingM, true);
  view.setFloat32(36, finiteNumber(dt, 0), true);
  view.setFloat32(40, gravityMPerS2[0], true);
  view.setFloat32(44, gravityMPerS2[1], true);
  view.setFloat32(48, gravityMPerS2[2], true);
  view.setFloat32(52, boxDimsM[0], true);
  view.setFloat32(56, boxDimsM[1], true);
  view.setFloat32(60, boxDimsM[2], true);
  view.setFloat32(64, finiteNumber(cflFactor, DEFAULT_CFL_FACTOR), true);
  view.setFloat32(68, 0, true);
  view.setFloat32(72, 1, true);
  view.setFloat32(76, 1e-6, true);
  return buffer;
}

function createFusedActiveGridUpdateParamsArray({
  gridSpec,
  dt,
  gravityMPerS2,
  boxDimsM,
  cflFactor,
  pressureInterfaceForceRowCount = 0,
  activeGridDispatch
}) {
  const buffer = new ArrayBuffer(112);
  new Uint8Array(buffer).set(new Uint8Array(createFusedGridUpdateParamsArray({
    gridSpec,
    dt,
    gravityMPerS2,
    boxDimsM,
    cflFactor,
    pressureInterfaceForceRowCount
  })));
  const view = new DataView(buffer);
  view.setUint32(80, activeGridDispatch.activeStart[0], true);
  view.setUint32(84, activeGridDispatch.activeStart[1], true);
  view.setUint32(88, activeGridDispatch.activeStart[2], true);
  view.setUint32(92, activeGridDispatch.activeCount[0], true);
  view.setUint32(96, activeGridDispatch.activeCount[1], true);
  view.setUint32(100, activeGridDispatch.activeCount[2], true);
  view.setUint32(104, activeGridDispatch.activeNodeCount, true);
  return buffer;
}

function createFusedG2pParamsArray({
  particleCount,
  gridSpec,
  dt,
  boxDimsM,
  internalPressureScale,
  liquidWallDampingAlpha = 0,
  liquidWallDampingDistanceM = 0
}) {
  const buffer = new ArrayBuffer(80);
  const view = new DataView(buffer);
  view.setUint32(0, particleCount, true);
  view.setUint32(4, gridSpec.gridNodeCount, true);
  view.setUint32(8, gridSpec.gridDims[0], true);
  view.setUint32(12, gridSpec.gridDims[1], true);
  view.setUint32(16, gridSpec.gridDims[2], true);
  view.setUint32(20, gridSpec.shift, true);
  view.setFloat32(32, gridSpec.gridSpacingM, true);
  view.setFloat32(36, gridSpec.invGridSpacingM, true);
  view.setFloat32(40, finiteNumber(dt, 0), true);
  view.setFloat32(44, boxDimsM[0], true);
  view.setFloat32(48, boxDimsM[1], true);
  view.setFloat32(52, boxDimsM[2], true);
  view.setFloat32(56, finiteNumber(internalPressureScale, 1), true);
  view.setFloat32(60, Math.min(Math.max(finiteNumber(liquidWallDampingAlpha, 0), 0), 1), true);
  view.setFloat32(64, Math.max(finiteNumber(liquidWallDampingDistanceM, 0), 0), true);
  return buffer;
}

function clampInteger(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(Number(value) || 0)));
}

function normalizePositionBoundsM(bounds) {
  if (
    bounds?.status
    && !['position-bounds-ready', 'resident-active-grid-predicted-bounds'].includes(bounds.status)
  ) {
    return null;
  }
  const min = bounds?.min;
  const max = bounds?.max;
  if (!Array.isArray(min) || !Array.isArray(max) || min.length < 3 || max.length < 3) return null;
  const normalizedMin = [
    finiteNumber(min[0], Number.NaN),
    finiteNumber(min[1], Number.NaN),
    finiteNumber(min[2], Number.NaN)
  ];
  const normalizedMax = [
    finiteNumber(max[0], Number.NaN),
    finiteNumber(max[1], Number.NaN),
    finiteNumber(max[2], Number.NaN)
  ];
  if (
    !normalizedMin.every(Number.isFinite)
    || !normalizedMax.every(Number.isFinite)
    || normalizedMin.some((value, axis) => value > normalizedMax[axis])
  ) {
    return null;
  }
  return {
    status: bounds.status || 'position-bounds-ready',
    min: normalizedMin,
    max: normalizedMax,
    massKg: Number.isFinite(bounds.massKg) ? bounds.massKg : null
  };
}

function computePackedSphStateMotionSummary(sphParticleState) {
  if (sphParticleState?.cpuStateStale) return null;
  const state = sphParticleState?.state;
  const particleCount = Math.max(0, Math.round(Number(sphParticleState?.particleCount) || 0));
  if (!(state instanceof Float32Array) || particleCount <= 0) return null;
  const min = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  const max = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
  let massKg = 0;
  let maxSpeedMPerS = 0;
  for (let index = 0; index < particleCount; index += 1) {
    const offset = index * SPH_GPU_PARTICLE_STATE_FLOATS;
    const x = state[offset];
    const y = state[offset + 1];
    const z = state[offset + 2];
    const mass = state[offset + 3];
    if (![x, y, z, mass].every(Number.isFinite) || !(mass > 0)) continue;
    min[0] = Math.min(min[0], x);
    min[1] = Math.min(min[1], y);
    min[2] = Math.min(min[2], z);
    max[0] = Math.max(max[0], x);
    max[1] = Math.max(max[1], y);
    max[2] = Math.max(max[2], z);
    massKg += mass;
    const vx = finiteNumber(state[offset + 4], 0);
    const vy = finiteNumber(state[offset + 5], 0);
    const vz = finiteNumber(state[offset + 6], 0);
    maxSpeedMPerS = Math.max(maxSpeedMPerS, Math.hypot(vx, vy, vz));
  }
  if (!(massKg > 0) || !min.every(Number.isFinite) || !max.every(Number.isFinite)) return null;
  return {
    boundsM: {
      status: 'position-bounds-ready',
      min,
      max,
      massKg
    },
    maxSpeedMPerS
  };
}

function predictedResidentBoundsFromActiveGridDispatch(activeGridDispatch) {
  const bounds = normalizePositionBoundsM(activeGridDispatch?.sourcePositionBoundsM);
  const expansion = Array.isArray(activeGridDispatch?.predictedMotionM)
    ? activeGridDispatch.predictedMotionM
    : activeGridDispatch?.predictedExpansionM;
  if (!bounds || !Array.isArray(expansion) || expansion.length < 3) return null;
  const predicted = normalizePositionBoundsM({
    status: 'position-bounds-ready',
    min: [0, 1, 2].map((axis) => bounds.min[axis] - Math.max(0, finiteNumber(expansion[axis], 0))),
    max: [0, 1, 2].map((axis) => bounds.max[axis] + Math.max(0, finiteNumber(expansion[axis], 0))),
    massKg: bounds.massKg
  });
  return predicted ? { ...predicted, status: 'resident-active-grid-predicted-bounds' } : null;
}

function residentBoundsContinuationFromStep(step, activeGridDispatch = null, source = null) {
  const compactBounds = normalizePositionBoundsM(step?.diagnostics?.nextPositionBoundsM);
  if (compactBounds) {
    return {
      boundsM: compactBounds,
      maxSpeedMPerS: finiteNumber(step?.diagnostics?.maxSpeedMPerS, null),
      source: 'compact-gpu-summary-next-bounds'
    };
  }
  const stepBounds = normalizePositionBoundsM(step?.residentPositionBoundsM);
  if (stepBounds) {
    return {
      boundsM: stepBounds,
      maxSpeedMPerS: finiteNumber(step?.residentMaxSpeedMPerS, null),
      source: step?.residentPositionBoundsSource || 'resident-step-bounds'
    };
  }
  const predictedBounds = predictedResidentBoundsFromActiveGridDispatch(activeGridDispatch);
  if (predictedBounds) {
    return {
      boundsM: predictedBounds,
      maxSpeedMPerS: finiteNumber(activeGridDispatch?.maxSpeedMPerS, null),
      source: 'active-grid-predicted-bounds'
    };
  }
  const sourceBounds = normalizePositionBoundsM(source?.residentPositionBoundsM);
  return {
    boundsM: sourceBounds,
    maxSpeedMPerS: finiteNumber(source?.residentMaxSpeedMPerS, null),
    source: sourceBounds ? 'source-resident-bounds' : null
  };
}

function fullGridDispatchMetadata({ status, reason = null, gridSpec, requested = false }) {
  return {
    schema: ULG_MLS_MPM_FUSED_ACTIVE_GRID_DISPATCH_SCHEMA,
    status,
    reason,
    requested,
    useActiveGrid: false,
    fullGridNodeCount: gridSpec.gridNodeCount,
    activeNodeCount: gridSpec.gridNodeCount,
    activeGridRatio: 1,
    activeStart: [0, 0, 0],
    activeCount: [...gridSpec.gridDims],
    gridDims: [...gridSpec.gridDims],
    safetyCells: 0,
    boundsSource: null,
    sourcePositionBoundsM: null,
    predictedMotionM: [0, 0, 0],
    safetyMarginM: [0, 0, 0],
    predictedExpansionM: [0, 0, 0]
  };
}

function resolveFusedActiveGridDispatch({
  requested,
  sphParticleState,
  gridSpec,
  dt,
  stepCount,
  gravityMPerS2,
  safetyCells = DEFAULT_FUSED_ACTIVE_GRID_SAFETY_CELLS
}) {
  if (!requested) {
    return fullGridDispatchMetadata({
      status: 'active-grid-dispatch-not-requested',
      gridSpec,
      requested: false
    });
  }
  const residentBounds = normalizePositionBoundsM(
    sphParticleState?.residentPositionBoundsM
      || sphParticleState?.nextPositionBoundsM
      || sphParticleState?.positionBoundsM
  );
  const packedSummary = computePackedSphStateMotionSummary(sphParticleState);
  const boundsM = residentBounds || packedSummary?.boundsM || null;
  const boundsSource = residentBounds ? 'resident-position-bounds' : (packedSummary ? 'cpu-packed-state' : null);
  if (!boundsM) {
    return fullGridDispatchMetadata({
      status: 'active-grid-dispatch-fallback-full',
      reason: 'position-bounds-unavailable',
      gridSpec,
      requested: true
    });
  }
  const dtSeconds = Math.abs(finiteNumber(dt, 0));
  const count = Math.max(1, Math.round(finiteNumber(stepCount, 1)));
  const horizonS = dtSeconds * count;
  const gravity = finiteVector3(gravityMPerS2, DEFAULT_GRAVITY_M_PER_S2);
  const residentMaxSpeed = finiteNumber(sphParticleState?.residentMaxSpeedMPerS, Number.NaN);
  const maxSpeedMPerS = Number.isFinite(residentMaxSpeed)
    ? residentMaxSpeed
    : finiteNumber(packedSummary?.maxSpeedMPerS, 0);
  const dx = gridSpec.gridSpacingM;
  const resolvedSafetyCells = Math.max(1, Math.round(finiteNumber(
    safetyCells == null ? DEFAULT_FUSED_ACTIVE_GRID_SAFETY_CELLS : safetyCells,
    DEFAULT_FUSED_ACTIVE_GRID_SAFETY_CELLS
  )));
  const predictedMotionM = gravity.map((component) => {
    return maxSpeedMPerS * horizonS + 0.5 * Math.abs(component) * horizonS * horizonS;
  });
  const safetyMarginM = [resolvedSafetyCells * dx, resolvedSafetyCells * dx, resolvedSafetyCells * dx];
  const predictedExpansionM = predictedMotionM.map((motionM, axis) => motionM + safetyMarginM[axis]);
  const activeStart = [0, 0, 0];
  const activeEnd = [0, 0, 0];
  for (let axis = 0; axis < 3; axis += 1) {
    const rawNodeMin = Math.floor((boundsM.min[axis] - predictedExpansionM[axis]) / dx - 0.5) - 1;
    const rawNodeMax = Math.floor((boundsM.max[axis] + predictedExpansionM[axis]) / dx - 0.5) + 3;
    activeStart[axis] = clampInteger(rawNodeMin + gridSpec.shift, 0, gridSpec.gridDims[axis] - 1);
    activeEnd[axis] = clampInteger(rawNodeMax + gridSpec.shift, activeStart[axis], gridSpec.gridDims[axis] - 1);
  }
  const activeCount = activeEnd.map((end, axis) => Math.max(1, end - activeStart[axis] + 1));
  const activeNodeCount = activeCount[0] * activeCount[1] * activeCount[2];
  const activeGridRatio = activeNodeCount / Math.max(1, gridSpec.gridNodeCount);
  if (!(activeNodeCount > 0) || activeNodeCount >= gridSpec.gridNodeCount) {
    return {
      ...fullGridDispatchMetadata({
        status: 'active-grid-dispatch-fallback-full',
        reason: 'active-grid-covers-full-domain',
        gridSpec,
        requested: true
      }),
      safetyCells: resolvedSafetyCells,
      boundsSource,
      sourcePositionBoundsM: boundsM,
      predictedMotionM,
      safetyMarginM,
      predictedExpansionM
    };
  }
  return {
    schema: ULG_MLS_MPM_FUSED_ACTIVE_GRID_DISPATCH_SCHEMA,
    status: 'active-grid-dispatch-ready',
    requested: true,
    useActiveGrid: true,
    fullGridNodeCount: gridSpec.gridNodeCount,
    activeNodeCount,
    activeGridRatio,
    activeStart,
    activeCount,
    activeEnd,
    gridDims: [...gridSpec.gridDims],
    safetyCells: resolvedSafetyCells,
    boundsSource,
    sourcePositionBoundsM: boundsM,
    predictedMotionM,
    safetyMarginM,
    predictedExpansionM,
    maxSpeedMPerS,
    horizonS
  };
}

function pressureInterfaceGridForceBlockedFields() {
  return {
    pressureInterfaceForceSolverSchema: null,
    pressureInterfaceForceSolverStatus: null,
    pressureInterfaceForceCouplingStatus: 'pressure-interface-grid-force-rows-unavailable',
    pressureInterfaceForceApplicationStatus: 'blocked-pressure-force-rows-unavailable',
    pressureInterfaceForceRowCount: 0,
    pressureInterfaceAppliedImpulseNSeconds: [0, 0, 0],
    pressureInterfaceAppliedImpulseMagnitudeNSeconds: 0,
    pressureInterfaceAppliedImpulseSource: 'no-pressure-interface-force-rows',
    pressureInterfaceImpulseProofStatus: 'not-submitted-no-pressure-interface-force-rows',
    pressureInterfaceForceConsumerStatus: 'blocked-pressure-force-rows-unavailable'
  };
}

function canUseFusedNoFullMechanicsPath({
  requestedReadbackMode,
  preferWebGpu,
  resolvedDevice,
  sphParticleUpload,
  mlsMpmParticleUpload,
  p2gRunner,
  gridUpdateRunner,
  g2pRunner,
  pressureInterfaceForceRowsBuffer,
  pressureInterfaceForceSolver,
  pressureInterfaceGridForceAdmission,
  residentProductMass
}) {
  return requestedReadbackMode === NO_FULL_READBACK_MODE
    && preferWebGpu
    && Boolean(resolvedDevice?.createBuffer && resolvedDevice.queue?.writeBuffer)
    && sphParticleUpload?.status === 'webgpu-uploaded'
    && mlsMpmParticleUpload?.status === 'webgpu-uploaded'
    && !p2gRunner
    && !gridUpdateRunner
    && !g2pRunner
    && !pressureInterfaceForceRowsBuffer
    && !pressureInterfaceForceSolver
    && !pressureInterfaceGridForceAdmission
    && !residentProductMass;
}

async function runFusedNoFullMlsMpmMechanicsWebGpu({
  device,
  sphParticleState,
  mlsMpmParticleState,
  sphParticleUpload,
  mlsMpmParticleUpload,
  gridSpacingM = sphParticleState?.smoothingLengthM,
  boxDimsM = DEFAULT_BOX_DIMS_M,
  dt = mlsMpmParticleState?.mechanicsDtS ?? 0,
  gravityMPerS2 = DEFAULT_GRAVITY_M_PER_S2,
  cflFactor = DEFAULT_CFL_FACTOR,
  internalPressureScale = 1,
  fuseActiveGrid = false,
  activeGridSafetyCells = DEFAULT_FUSED_ACTIVE_GRID_SAFETY_CELLS,
  p2gBackend = MLS_MPM_P2G_BACKEND_RESIDENT_SCATTER
}) {
  const dims = finiteVector3(boxDimsM, DEFAULT_BOX_DIMS_M);
  const gravity = finiteVector3(gravityMPerS2, DEFAULT_GRAVITY_M_PER_S2);
  const dtSeconds = finiteNumber(dt, 0);
  const particleCount = sphParticleState.particleCount;
  const gridSpec = createMlsMpmGridSpec({ boxDimsM: dims, gridSpacingM });
  const gridByteLength = gridSpec.gridNodeCount * MLS_MPM_GPU_GRID_NODE_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const p2gAccumulatorElementCount = Math.max(1, gridSpec.gridNodeCount * P2G_ACCUMULATOR_COMPONENTS);
  const p2gAccumulatorByteLength = p2gAccumulatorElementCount * Int32Array.BYTES_PER_ELEMENT;
  const updatedGridByteLength = gridSpec.gridNodeCount * MLS_MPM_GPU_GRID_VELOCITY_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const stateByteLength = sphParticleState.state.byteLength;
  const mechanicsByteLength = mlsMpmParticleState.mechanics.byteLength;
  const activeGridDispatch = resolveFusedActiveGridDispatch({
    requested: fuseActiveGrid,
    sphParticleState,
    gridSpec,
    dt: dtSeconds,
    stepCount: 1,
    gravityMPerS2: gravity,
    safetyCells: activeGridSafetyCells
  });
  const activeGridNodeDispatchCount = activeGridDispatch.useActiveGrid
    ? activeGridDispatch.activeNodeCount
    : gridSpec.gridNodeCount;
  const activeGridDispatchPlanHint = sphParticleState?.residentActiveGridDispatchPlanHint ?? null;
  const activeGridIndirectDispatchArgs = createActiveGridComputeDispatchArgsBuffer(
    device,
    activeGridDispatch,
    Math.max(1, Math.ceil(activeGridNodeDispatchCount / 64)),
    activeGridDispatchPlanHint,
    {
      gridSpec,
      stepCount: 1,
      dt: dtSeconds
    }
  );
  const dispatchTopology = createResidentDispatchTopology({
    particleCount,
    gridSpec,
    activeGridDispatch,
    substepCount: 1,
    fusedResidentMechanics: true,
    p2gBackend
  });
  const gridBuffer = device.createBuffer({
    label: 'ulg-mls-mpm-fused-p2g-grid-out',
    size: Math.max(4, gridByteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | (activeGridDispatch.useActiveGrid ? GPU_BUFFER_USAGE.COPY_DST : 0)
  });
  const p2gAccumulatorBuffer = device.createBuffer({
    label: 'ulg-mls-mpm-fused-p2g-grid-accumulators',
    size: Math.max(4, p2gAccumulatorByteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
  });
  const updatedGridBuffer = device.createBuffer({
    label: 'ulg-mls-mpm-fused-grid-update-out',
    size: Math.max(4, updatedGridByteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | (activeGridDispatch.useActiveGrid ? GPU_BUFFER_USAGE.COPY_DST : 0)
  });
  const outStateBuffer = device.createBuffer({
    label: 'ulg-mls-mpm-fused-g2p-state-out',
    size: Math.max(4, stateByteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const outMechanicsBuffer = device.createBuffer({
    label: 'ulg-mls-mpm-fused-g2p-mechanics-out',
    size: Math.max(4, mechanicsByteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const p2gParamsBuffer = writeGpuBuffer(
    device,
    'ulg-mls-mpm-fused-p2g-params',
    activeGridDispatch.useActiveGrid
      ? createFusedActiveP2gParamsArray(gridSpec, particleCount, dtSeconds, internalPressureScale, activeGridDispatch)
      : createFusedP2gParamsArray(gridSpec, particleCount, dtSeconds, internalPressureScale),
    GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  );
  const gridUpdateParamsBuffer = writeGpuBuffer(
    device,
    'ulg-mls-mpm-fused-grid-update-params',
    activeGridDispatch.useActiveGrid
      ? createFusedActiveGridUpdateParamsArray({
          gridSpec,
          dt: dtSeconds,
          gravityMPerS2: gravity,
          boxDimsM: dims,
          cflFactor,
          pressureInterfaceForceRowCount: 0,
          activeGridDispatch
        })
      : createFusedGridUpdateParamsArray({
          gridSpec,
          dt: dtSeconds,
          gravityMPerS2: gravity,
          boxDimsM: dims,
          cflFactor,
          pressureInterfaceForceRowCount: 0
        }),
    GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  );
  const g2pParamsBuffer = writeGpuBuffer(
    device,
    'ulg-mls-mpm-fused-g2p-params',
    createFusedG2pParamsArray({
      particleCount,
      gridSpec,
      dt: dtSeconds,
      boxDimsM: dims,
      internalPressureScale,
      liquidWallDampingAlpha: mlsMpmParticleState.liquidWallDampingAlpha,
      liquidWallDampingDistanceM: mlsMpmParticleState.liquidWallDampingDistanceM
    }),
    GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  );
  const productEventBuffer = writeGpuBuffer(
    device,
    'ulg-mls-mpm-fused-empty-product-events',
    new Float32Array(SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS),
    GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
  );
  const pressureRowsBuffer = writeGpuBuffer(
    device,
    'ulg-mls-mpm-fused-empty-pressure-force-rows',
    new Float32Array(SPH_PRESSURE_INTERFACE_FORCE_FLOATS),
    GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
  );
  const tempBuffers = [
    p2gAccumulatorBuffer,
    p2gParamsBuffer,
    gridUpdateParamsBuffer,
    g2pParamsBuffer,
    productEventBuffer,
    pressureRowsBuffer,
    ...(activeGridIndirectDispatchArgs?.ownsBuffer !== false ? [activeGridIndirectDispatchArgs?.buffer].filter(Boolean) : [])
  ];
  let retained = false;
  try {
    const p2gBindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'read-only-storage'),
      computeBufferBinding(3, 'storage'),
      computeBufferBinding(4, 'uniform'),
      computeBufferBinding(5, 'read-only-storage'),
      computeBufferBinding(6, 'storage')
    ];
    const { pipeline: p2gPipeline, bindGroupLayout: p2gBindGroupLayout } = createCachedExplicitComputePipeline(device, {
      cacheKey: activeGridDispatch.useActiveGrid
        ? 'ulg-mls-mpm-p2g-grid-projection.active-grid.scatter.v1'
        : 'ulg-mls-mpm-p2g-grid-projection.scatter.v1',
      label: activeGridDispatch.useActiveGrid
        ? 'ulg-mls-mpm-p2g-grid-projection-active-grid'
        : 'ulg-mls-mpm-p2g-grid-projection',
      code: activeGridDispatch.useActiveGrid
        ? mlsMpmP2gGridProjectionActiveGridWgsl
        : mlsMpmP2gGridProjectionWgsl,
      entryPoint: 'main',
      bindings: p2gBindings
    });
    const { pipeline: p2gFinalizePipeline, bindGroupLayout: p2gFinalizeBindGroupLayout } = createCachedExplicitComputePipeline(device, {
      cacheKey: activeGridDispatch.useActiveGrid
        ? 'ulg-mls-mpm-p2g-grid-projection.active-grid.finalize.v1'
        : 'ulg-mls-mpm-p2g-grid-projection.finalize.v1',
      label: activeGridDispatch.useActiveGrid
        ? 'ulg-mls-mpm-p2g-grid-finalize-active-grid'
        : 'ulg-mls-mpm-p2g-grid-finalize',
      code: activeGridDispatch.useActiveGrid
        ? mlsMpmP2gGridProjectionActiveGridWgsl
        : mlsMpmP2gGridProjectionWgsl,
      entryPoint: 'finalize_grid',
      bindings: p2gBindings
    });
    const activeAccumulatorClearPipelineInfo = activeGridDispatch.useActiveGrid
      ? createCachedExplicitComputePipeline(device, {
        cacheKey: 'ulg-mls-mpm-p2g-grid-projection.active-grid.clear-accumulators.v1',
        label: 'ulg-mls-mpm-p2g-grid-accumulator-clear-active-grid',
        code: mlsMpmP2gGridProjectionActiveGridWgsl,
        entryPoint: 'clear_accumulators',
        bindings: p2gBindings
      })
      : null;
    const p2gEntries = [
        { binding: 0, resource: { buffer: sphParticleUpload.stateBuffer } },
        { binding: 1, resource: { buffer: sphParticleUpload.thermoBuffer } },
        { binding: 2, resource: { buffer: mlsMpmParticleUpload.mechanicsBuffer } },
        { binding: 3, resource: { buffer: p2gAccumulatorBuffer } },
        { binding: 4, resource: { buffer: p2gParamsBuffer } },
        { binding: 5, resource: { buffer: productEventBuffer } },
        { binding: 6, resource: { buffer: gridBuffer } }
      ];
    const p2gBindGroup = device.createBindGroup({ layout: p2gBindGroupLayout, entries: p2gEntries });
    const p2gFinalizeBindGroup = device.createBindGroup({ layout: p2gFinalizeBindGroupLayout, entries: p2gEntries });
    const activeAccumulatorClearBindGroup = activeAccumulatorClearPipelineInfo
      ? device.createBindGroup({
        layout: activeAccumulatorClearPipelineInfo.bindGroupLayout,
        entries: p2gEntries
      })
      : null;
    const { pipeline: gridUpdatePipeline, bindGroupLayout: gridUpdateBindGroupLayout } = createCachedExplicitComputePipeline(device, {
      cacheKey: activeGridDispatch.useActiveGrid
        ? 'ulg-mls-mpm-grid-update.active-grid.v2'
        : 'ulg-mls-mpm-grid-update.v2',
      label: activeGridDispatch.useActiveGrid
        ? 'ulg-mls-mpm-grid-update-active-grid'
        : 'ulg-mls-mpm-grid-update',
      code: activeGridDispatch.useActiveGrid
        ? mlsMpmGridUpdateActiveGridWgsl
        : mlsMpmGridUpdateWgsl,
      entryPoint: 'main',
      bindings: [
        computeBufferBinding(0, 'read-only-storage'),
        computeBufferBinding(1, 'storage'),
        computeBufferBinding(2, 'uniform'),
        computeBufferBinding(3, 'read-only-storage')
      ]
    });
    const gridUpdateBindGroup = device.createBindGroup({
      layout: gridUpdateBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: gridBuffer } },
        { binding: 1, resource: { buffer: updatedGridBuffer } },
        { binding: 2, resource: { buffer: gridUpdateParamsBuffer } },
        { binding: 3, resource: { buffer: pressureRowsBuffer } }
      ]
    });
    const { pipeline: g2pPipeline, bindGroupLayout: g2pBindGroupLayout } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-mls-mpm-g2p-reconstruct.v2',
      label: 'ulg-mls-mpm-g2p-reconstruct',
      code: mlsMpmG2pReconstructWgsl,
      entryPoint: 'main',
      bindings: [
        computeBufferBinding(0, 'read-only-storage'),
        computeBufferBinding(1, 'read-only-storage'),
        computeBufferBinding(2, 'read-only-storage'),
        computeBufferBinding(3, 'read-only-storage'),
        computeBufferBinding(4, 'storage'),
        computeBufferBinding(5, 'storage'),
        computeBufferBinding(6, 'uniform')
      ]
    });
    const g2pBindGroup = device.createBindGroup({
      layout: g2pBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: sphParticleUpload.stateBuffer } },
        { binding: 1, resource: { buffer: sphParticleUpload.thermoBuffer } },
        { binding: 2, resource: { buffer: mlsMpmParticleUpload.mechanicsBuffer } },
        { binding: 3, resource: { buffer: updatedGridBuffer } },
        { binding: 4, resource: { buffer: outStateBuffer } },
        { binding: 5, resource: { buffer: outMechanicsBuffer } },
        { binding: 6, resource: { buffer: g2pParamsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    if (typeof encoder.clearBuffer !== 'function') {
      throw new Error('Fused resident mechanics requires GPUCommandEncoder.clearBuffer for particle-parallel P2G');
    }
    if (activeGridDispatch.useActiveGrid) {
      const accumulatorClearPass = encoder.beginComputePass();
      accumulatorClearPass.setPipeline(activeAccumulatorClearPipelineInfo.pipeline);
      accumulatorClearPass.setBindGroup(0, activeAccumulatorClearBindGroup);
      dispatchActiveGridComputePass(
        accumulatorClearPass,
        Math.max(1, Math.ceil(activeGridNodeDispatchCount / 64)),
        activeGridIndirectDispatchArgs
      );
      accumulatorClearPass.end();
    } else {
      encoder.clearBuffer(p2gAccumulatorBuffer, 0, Math.max(4, p2gAccumulatorByteLength));
    }
    const p2gPass = encoder.beginComputePass();
    p2gPass.setPipeline(p2gPipeline);
    p2gPass.setBindGroup(0, p2gBindGroup);
    p2gPass.dispatchWorkgroups(Math.max(1, Math.ceil(particleCount / 64)));
    p2gPass.end();
    const p2gFinalizePass = encoder.beginComputePass();
    p2gFinalizePass.setPipeline(p2gFinalizePipeline);
    p2gFinalizePass.setBindGroup(0, p2gFinalizeBindGroup);
    dispatchActiveGridComputePass(
      p2gFinalizePass,
      Math.max(1, Math.ceil(activeGridNodeDispatchCount / 64)),
      activeGridIndirectDispatchArgs
    );
    p2gFinalizePass.end();
    const gridUpdatePass = encoder.beginComputePass();
    gridUpdatePass.setPipeline(gridUpdatePipeline);
    gridUpdatePass.setBindGroup(0, gridUpdateBindGroup);
    dispatchActiveGridComputePass(
      gridUpdatePass,
      Math.max(1, Math.ceil(activeGridNodeDispatchCount / 64)),
      activeGridIndirectDispatchArgs
    );
    gridUpdatePass.end();
    const g2pPass = encoder.beginComputePass();
    g2pPass.setPipeline(g2pPipeline);
    g2pPass.setBindGroup(0, g2pBindGroup);
    g2pPass.dispatchWorkgroups(Math.max(1, Math.ceil(particleCount / 64)));
    g2pPass.end();
    device.queue.submit([encoder.finish()]);
    attachActiveGridIndirectDispatchTopology(dispatchTopology, activeGridIndirectDispatchArgs);
    const activeGridIndirectDispatch = activeGridIndirectDispatchDescriptor(activeGridIndirectDispatchArgs);
    retained = true;
    const webgpuStatus = {
      status: 'webgpu-executed-no-full-readback',
      reason: 'Fused WebGPU MLS-MPM P2G/grid-update/G2P executed without full readback'
    };
    const pressureFields = pressureInterfaceGridForceBlockedFields();
    const p2gGridProjection = {
      schema: ULG_MLS_MPM_GPU_GRID_PROJECTION_EXECUTION_SCHEMA,
      projectionSchema: ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
      backend: 'webgpu',
      status: webgpuStatus.status,
      kernelScope: 'particle-parallel-scatter-p2g-stress-momentum-projection',
      particleCount,
      gridSpacingM: gridSpec.gridSpacingM,
      gridDims: [...gridSpec.gridDims],
      gridNodeCount: gridSpec.gridNodeCount,
      gridShift: gridSpec.shift,
      dt: dtSeconds,
      internalPressureScale,
      gridNodes: new Float32Array(),
      gridBuffer,
      gridBufferByteLength: gridByteLength,
      readbackMode: NO_FULL_READBACK_MODE,
      fullReadbackPerformed: false,
      retainedGridBuffer: true,
      webgpuStatus,
      webgpuParity: {
        status: 'not-run-no-full-readback',
        reason: 'fused no-full resident mechanics skipped P2G readback'
      },
      dispatchTopology: dispatchTopology.p2g,
      residentDispatchTopology: dispatchTopology,
      fusedResidentMechanics: true,
      activeGridDispatch,
      activeGridIndirectDispatch
    };
    const gridUpdate = {
      schema: ULG_MLS_MPM_GPU_GRID_UPDATE_EXECUTION_SCHEMA,
      updateSchema: ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
      backend: 'webgpu',
      status: webgpuStatus.status,
      kernelScope: 'mls-mpm-grid-velocity-update-gravity-cfl-walls',
      particleCount,
      gridSpacingM: gridSpec.gridSpacingM,
      gridDims: [...gridSpec.gridDims],
      gridNodeCount: gridSpec.gridNodeCount,
      gridShift: gridSpec.shift,
      dt: dtSeconds,
      gravityMPerS2: [...gravity],
      boxDimsM: [...dims],
      cflFactor,
      updatedGridNodes: new Float32Array(),
      updatedGridBuffer,
      updatedGridBufferByteLength: updatedGridByteLength,
      readbackMode: NO_FULL_READBACK_MODE,
      fullReadbackPerformed: false,
      retainedUpdatedGridBuffer: true,
      queueCompletionStatus: 'queue-submitted-cleanup-deferred',
      queueCompletionMethod: 'deferred unified fused mechanics cleanup',
      webgpuStatus,
      webgpuParity: {
        status: 'not-run-no-full-readback',
        reason: 'fused no-full resident mechanics skipped grid-update readback'
      },
      ...pressureFields,
      dispatchTopology: dispatchTopology.gridUpdate,
      residentDispatchTopology: dispatchTopology,
      fusedResidentMechanics: true,
      activeGridDispatch,
      activeGridIndirectDispatch
    };
    const g2pParticleScaleStability = noFullReadbackG2pParticleScaleStability({
      particleCount,
      source: 'webgpu-fused-g2p-shader'
    });
    const g2pReconstruction = {
      schema: ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_EXECUTION_SCHEMA,
      reconstructionSchema: ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_SCHEMA,
      backend: 'webgpu',
      status: 'reconstructed',
      kernelScope: 'mls-mpm-g2p-velocity-affine-deformation-reconstruction',
      particleCount,
      gridNodeCount: gridSpec.gridNodeCount,
      gridSpacingM: gridSpec.gridSpacingM,
      gridDims: [...gridSpec.gridDims],
      gridShift: gridSpec.shift,
      dt: dtSeconds,
      internalPressureScale,
      stateStrideFloats: SPH_GPU_PARTICLE_STATE_FLOATS,
      mechanicsStrideFloats: MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
      state: new Float32Array(),
      mechanics: new Float32Array(),
      stateBuffer: outStateBuffer,
      mechanicsBuffer: outMechanicsBuffer,
      stateBufferByteLength: stateByteLength,
      mechanicsBufferByteLength: mechanicsByteLength,
      retainedOutputParticleBuffers: true,
      readbackMode: NO_FULL_READBACK_MODE,
      fullReadbackPerformed: false,
      particleScaleStability: g2pParticleScaleStability,
      particleScaleStabilitySchema: g2pParticleScaleStability.schema,
      particleScaleStabilityStatus: g2pParticleScaleStability.status,
      particleScalePolicyAppliedInG2p: true,
      particleScaleMaxVolumeRatioJAllowed: g2pParticleScaleStability.maxVolumeRatioJAllowed,
      particleScaleMaxRadiusGrowthRatioAllowed: g2pParticleScaleStability.maxRadiusGrowthRatioAllowed,
      webgpuStatus,
      webgpuParity: {
        status: 'not-run-no-full-readback',
        reason: 'fused no-full resident mechanics skipped G2P readback'
      },
      gpuResult: {
        backend: 'webgpu',
        readbackMode: NO_FULL_READBACK_MODE,
        stateBuffer: outStateBuffer,
        mechanicsBuffer: outMechanicsBuffer,
        stateBufferByteLength: stateByteLength,
        mechanicsBufferByteLength: mechanicsByteLength,
        retainedOutputParticleBuffers: true,
        destroyOutputParticleBuffers: () => {
          outStateBuffer.destroy?.();
          outMechanicsBuffer.destroy?.();
        }
      },
      dispatchTopology: dispatchTopology.g2p,
      residentDispatchTopology: dispatchTopology,
      destroyOutputParticleBuffers: () => {
        outStateBuffer.destroy?.();
        outMechanicsBuffer.destroy?.();
      },
      fusedResidentMechanics: true,
      activeGridDispatch,
      activeGridIndirectDispatch
    };
    return {
      schema: 'peercompute.ulg.mls-mpm-fused-mechanics-step.v0',
      backend: 'webgpu',
      status: 'fused-mechanics-webgpu-executed-no-full-readback',
      activeGridDispatch,
      activeGridIndirectDispatch,
      dispatchTopology,
      p2gGridProjection,
      gridUpdate,
      g2pReconstruction
    };
  } finally {
    const cleanup = () => {
      for (const buffer of tempBuffers) buffer.destroy?.();
      if (!retained) {
        gridBuffer.destroy?.();
        updatedGridBuffer.destroy?.();
        outStateBuffer.destroy?.();
        outMechanicsBuffer.destroy?.();
      }
    };
    deferSubmittedWorkCleanup(device, cleanup);
  }
}

async function runFusedNoFullMlsMpmMechanicsSequenceWebGpu({
  device,
  sphParticleState,
  mlsMpmParticleState,
  sphParticleUpload,
  mlsMpmParticleUpload,
  gridSpacingM = sphParticleState?.smoothingLengthM,
  boxDimsM = DEFAULT_BOX_DIMS_M,
  dt = mlsMpmParticleState?.mechanicsDtS ?? 0,
  gravityMPerS2 = DEFAULT_GRAVITY_M_PER_S2,
  cflFactor = DEFAULT_CFL_FACTOR,
  internalPressureScale = 1,
  stepCount = 1,
  summaryRunner = runMlsMpmResidentSummaryWebGpu,
  compactSummaryScope = MLS_MPM_RESIDENT_SUMMARY_SCOPE_FULL,
  cohortRanges = null,
  sourceSlot = sphParticleUpload?.slot ?? 0,
  preferWebGpu = true,
  fuseActiveGrid = false,
  activeGridSafetyCells = DEFAULT_FUSED_ACTIVE_GRID_SAFETY_CELLS,
  p2gBackend = MLS_MPM_P2G_BACKEND_RESIDENT_SCATTER,
  measureQueueFence = false
}) {
  const count = Math.max(1, Math.round(finiteNumber(stepCount, 1)));
  const dims = finiteVector3(boxDimsM, DEFAULT_BOX_DIMS_M);
  const gravity = finiteVector3(gravityMPerS2, DEFAULT_GRAVITY_M_PER_S2);
  const dtSeconds = finiteNumber(dt, 0);
  const particleCount = sphParticleState.particleCount;
  const gridSpec = createMlsMpmGridSpec({ boxDimsM: dims, gridSpacingM });
  const gridByteLength = gridSpec.gridNodeCount * MLS_MPM_GPU_GRID_NODE_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const p2gAccumulatorElementCount = Math.max(1, gridSpec.gridNodeCount * P2G_ACCUMULATOR_COMPONENTS);
  const p2gAccumulatorByteLength = p2gAccumulatorElementCount * Int32Array.BYTES_PER_ELEMENT;
  const updatedGridByteLength = gridSpec.gridNodeCount * MLS_MPM_GPU_GRID_VELOCITY_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const stateByteLength = sphParticleState.state.byteLength;
  const mechanicsByteLength = mlsMpmParticleState.mechanics.byteLength;
  const activeGridDispatch = resolveFusedActiveGridDispatch({
    requested: fuseActiveGrid,
    sphParticleState,
    gridSpec,
    dt: dtSeconds,
    stepCount: count,
    gravityMPerS2: gravity,
    safetyCells: activeGridSafetyCells
  });
  const activeGridNodeDispatchCount = activeGridDispatch.useActiveGrid
    ? activeGridDispatch.activeNodeCount
    : gridSpec.gridNodeCount;
  const activeGridDispatchPlanHint = sphParticleState?.residentActiveGridDispatchPlanHint ?? null;
  const activeGridIndirectDispatchArgs = createActiveGridComputeDispatchArgsBuffer(
    device,
    activeGridDispatch,
    Math.max(1, Math.ceil(activeGridNodeDispatchCount / 64)),
    activeGridDispatchPlanHint,
    {
      gridSpec,
      stepCount: count,
      dt: dtSeconds
    }
  );
  const dispatchTopology = createResidentDispatchTopology({
    particleCount,
    gridSpec,
    activeGridDispatch,
    substepCount: count,
    fusedResidentSequence: true,
    p2gBackend
  });
  const stageTimingStartMs = nowMs();
  const stageMs = {
    deviceAcquire: 0,
    fusedMechanicsSequence: 0,
    p2gGridProjection: 0,
    gridUpdate: 0,
    g2pReconstruction: 0,
    thermalStep: 0,
    reactionStep: 0,
    mechanicsRefresh: 0,
    compactSummary: 0
  };
  const sequenceEncodeStartMs = nowMs();
  const gridBuffer = device.createBuffer({
    label: 'ulg-mls-mpm-fused-sequence-p2g-grid-out',
    size: Math.max(4, gridByteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | (activeGridDispatch.useActiveGrid ? GPU_BUFFER_USAGE.COPY_DST : 0)
  });
  const p2gAccumulatorBuffer = device.createBuffer({
    label: 'ulg-mls-mpm-fused-sequence-p2g-grid-accumulators',
    size: Math.max(4, p2gAccumulatorByteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
  });
  const updatedGridBuffer = device.createBuffer({
    label: 'ulg-mls-mpm-fused-sequence-grid-update-out',
    size: Math.max(4, updatedGridByteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | (activeGridDispatch.useActiveGrid ? GPU_BUFFER_USAGE.COPY_DST : 0)
  });
  const statePingBuffers = [
    device.createBuffer({
      label: 'ulg-mls-mpm-fused-sequence-g2p-state-ping-a',
      size: Math.max(4, stateByteLength),
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
    }),
    device.createBuffer({
      label: 'ulg-mls-mpm-fused-sequence-g2p-state-ping-b',
      size: Math.max(4, stateByteLength),
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
    })
  ];
  const mechanicsPingBuffers = [
    device.createBuffer({
      label: 'ulg-mls-mpm-fused-sequence-g2p-mechanics-ping-a',
      size: Math.max(4, mechanicsByteLength),
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
    }),
    device.createBuffer({
      label: 'ulg-mls-mpm-fused-sequence-g2p-mechanics-ping-b',
      size: Math.max(4, mechanicsByteLength),
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
    })
  ];
  const p2gParamsBuffer = writeGpuBuffer(
    device,
    'ulg-mls-mpm-fused-sequence-p2g-params',
    activeGridDispatch.useActiveGrid
      ? createFusedActiveP2gParamsArray(gridSpec, particleCount, dtSeconds, internalPressureScale, activeGridDispatch)
      : createFusedP2gParamsArray(gridSpec, particleCount, dtSeconds, internalPressureScale),
    GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  );
  const gridUpdateParamsBuffer = writeGpuBuffer(
    device,
    'ulg-mls-mpm-fused-sequence-grid-update-params',
    activeGridDispatch.useActiveGrid
      ? createFusedActiveGridUpdateParamsArray({
          gridSpec,
          dt: dtSeconds,
          gravityMPerS2: gravity,
          boxDimsM: dims,
          cflFactor,
          pressureInterfaceForceRowCount: 0,
          activeGridDispatch
        })
      : createFusedGridUpdateParamsArray({
          gridSpec,
          dt: dtSeconds,
          gravityMPerS2: gravity,
          boxDimsM: dims,
          cflFactor,
          pressureInterfaceForceRowCount: 0
        }),
    GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  );
  const g2pParamsBuffer = writeGpuBuffer(
    device,
    'ulg-mls-mpm-fused-sequence-g2p-params',
    createFusedG2pParamsArray({
      particleCount,
      gridSpec,
      dt: dtSeconds,
      boxDimsM: dims,
      internalPressureScale,
      liquidWallDampingAlpha: mlsMpmParticleState.liquidWallDampingAlpha,
      liquidWallDampingDistanceM: mlsMpmParticleState.liquidWallDampingDistanceM
    }),
    GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  );
  const productEventBuffer = writeGpuBuffer(
    device,
    'ulg-mls-mpm-fused-sequence-empty-product-events',
    new Float32Array(SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS),
    GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
  );
  const pressureRowsBuffer = writeGpuBuffer(
    device,
    'ulg-mls-mpm-fused-sequence-empty-pressure-force-rows',
    new Float32Array(SPH_PRESSURE_INTERFACE_FORCE_FLOATS),
    GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
  );
  const allCreatedBuffers = [
    gridBuffer,
    p2gAccumulatorBuffer,
    updatedGridBuffer,
    ...statePingBuffers,
    ...mechanicsPingBuffers,
    p2gParamsBuffer,
    gridUpdateParamsBuffer,
    g2pParamsBuffer,
    productEventBuffer,
    pressureRowsBuffer,
    ...(activeGridIndirectDispatchArgs?.ownsBuffer !== false ? [activeGridIndirectDispatchArgs?.buffer].filter(Boolean) : [])
  ];
  let finalStateBuffer = null;
  let finalMechanicsBuffer = null;
  let finalSourceStateBuffer = sphParticleUpload.stateBuffer;
  let finalSourceMechanicsBuffer = mlsMpmParticleUpload.mechanicsBuffer;
  let returned = false;
  try {
    const p2gBindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'read-only-storage'),
      computeBufferBinding(3, 'storage'),
      computeBufferBinding(4, 'uniform'),
      computeBufferBinding(5, 'read-only-storage'),
      computeBufferBinding(6, 'storage')
    ];
    const { pipeline: p2gPipeline, bindGroupLayout: p2gBindGroupLayout } = createCachedExplicitComputePipeline(device, {
      cacheKey: activeGridDispatch.useActiveGrid
        ? 'ulg-mls-mpm-p2g-grid-projection.active-grid.scatter.v1'
        : 'ulg-mls-mpm-p2g-grid-projection.scatter.v1',
      label: activeGridDispatch.useActiveGrid
        ? 'ulg-mls-mpm-p2g-grid-projection-active-grid'
        : 'ulg-mls-mpm-p2g-grid-projection',
      code: activeGridDispatch.useActiveGrid
        ? mlsMpmP2gGridProjectionActiveGridWgsl
        : mlsMpmP2gGridProjectionWgsl,
      entryPoint: 'main',
      bindings: p2gBindings
    });
    const { pipeline: p2gFinalizePipeline, bindGroupLayout: p2gFinalizeBindGroupLayout } = createCachedExplicitComputePipeline(device, {
      cacheKey: activeGridDispatch.useActiveGrid
        ? 'ulg-mls-mpm-p2g-grid-projection.active-grid.finalize.v1'
        : 'ulg-mls-mpm-p2g-grid-projection.finalize.v1',
      label: activeGridDispatch.useActiveGrid
        ? 'ulg-mls-mpm-p2g-grid-finalize-active-grid'
        : 'ulg-mls-mpm-p2g-grid-finalize',
      code: activeGridDispatch.useActiveGrid
        ? mlsMpmP2gGridProjectionActiveGridWgsl
        : mlsMpmP2gGridProjectionWgsl,
      entryPoint: 'finalize_grid',
      bindings: p2gBindings
    });
    const activeAccumulatorClearPipelineInfo = activeGridDispatch.useActiveGrid
      ? createCachedExplicitComputePipeline(device, {
        cacheKey: 'ulg-mls-mpm-p2g-grid-projection.active-grid.clear-accumulators.v1',
        label: 'ulg-mls-mpm-p2g-grid-accumulator-clear-active-grid',
        code: mlsMpmP2gGridProjectionActiveGridWgsl,
        entryPoint: 'clear_accumulators',
        bindings: p2gBindings
      })
      : null;
    const { pipeline: gridUpdatePipeline, bindGroupLayout: gridUpdateBindGroupLayout } = createCachedExplicitComputePipeline(device, {
      cacheKey: activeGridDispatch.useActiveGrid
        ? 'ulg-mls-mpm-grid-update.active-grid.v2'
        : 'ulg-mls-mpm-grid-update.v2',
      label: activeGridDispatch.useActiveGrid
        ? 'ulg-mls-mpm-grid-update-active-grid'
        : 'ulg-mls-mpm-grid-update',
      code: activeGridDispatch.useActiveGrid
        ? mlsMpmGridUpdateActiveGridWgsl
        : mlsMpmGridUpdateWgsl,
      entryPoint: 'main',
      bindings: [
        computeBufferBinding(0, 'read-only-storage'),
        computeBufferBinding(1, 'storage'),
        computeBufferBinding(2, 'uniform'),
        computeBufferBinding(3, 'read-only-storage')
      ]
    });
    const { pipeline: g2pPipeline, bindGroupLayout: g2pBindGroupLayout } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-mls-mpm-g2p-reconstruct.v2',
      label: 'ulg-mls-mpm-g2p-reconstruct',
      code: mlsMpmG2pReconstructWgsl,
      entryPoint: 'main',
      bindings: [
        computeBufferBinding(0, 'read-only-storage'),
        computeBufferBinding(1, 'read-only-storage'),
        computeBufferBinding(2, 'read-only-storage'),
        computeBufferBinding(3, 'read-only-storage'),
        computeBufferBinding(4, 'storage'),
        computeBufferBinding(5, 'storage'),
        computeBufferBinding(6, 'uniform')
      ]
    });
    const encoder = device.createCommandEncoder();
    if (typeof encoder.clearBuffer !== 'function') {
      throw new Error('Fused resident mechanics sequence requires GPUCommandEncoder.clearBuffer for particle-parallel P2G');
    }
    let currentStateBuffer = sphParticleUpload.stateBuffer;
    let currentMechanicsBuffer = mlsMpmParticleUpload.mechanicsBuffer;
    for (let index = 0; index < count; index += 1) {
      if (index === count - 1) {
        finalSourceStateBuffer = currentStateBuffer;
        finalSourceMechanicsBuffer = currentMechanicsBuffer;
      }
      const pingIndex = index % 2;
      const outStateBuffer = statePingBuffers[pingIndex];
      const outMechanicsBuffer = mechanicsPingBuffers[pingIndex];
      const p2gBindGroup = device.createBindGroup({
        layout: p2gBindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: currentStateBuffer } },
          { binding: 1, resource: { buffer: sphParticleUpload.thermoBuffer } },
          { binding: 2, resource: { buffer: currentMechanicsBuffer } },
          { binding: 3, resource: { buffer: p2gAccumulatorBuffer } },
          { binding: 4, resource: { buffer: p2gParamsBuffer } },
          { binding: 5, resource: { buffer: productEventBuffer } },
          { binding: 6, resource: { buffer: gridBuffer } }
        ]
      });
      const p2gFinalizeBindGroup = device.createBindGroup({
        layout: p2gFinalizeBindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: currentStateBuffer } },
          { binding: 1, resource: { buffer: sphParticleUpload.thermoBuffer } },
          { binding: 2, resource: { buffer: currentMechanicsBuffer } },
          { binding: 3, resource: { buffer: p2gAccumulatorBuffer } },
          { binding: 4, resource: { buffer: p2gParamsBuffer } },
          { binding: 5, resource: { buffer: productEventBuffer } },
          { binding: 6, resource: { buffer: gridBuffer } }
        ]
      });
      const activeAccumulatorClearBindGroup = activeAccumulatorClearPipelineInfo
        ? device.createBindGroup({
          layout: activeAccumulatorClearPipelineInfo.bindGroupLayout,
          entries: [
            { binding: 0, resource: { buffer: currentStateBuffer } },
            { binding: 1, resource: { buffer: sphParticleUpload.thermoBuffer } },
            { binding: 2, resource: { buffer: currentMechanicsBuffer } },
            { binding: 3, resource: { buffer: p2gAccumulatorBuffer } },
            { binding: 4, resource: { buffer: p2gParamsBuffer } },
            { binding: 5, resource: { buffer: productEventBuffer } },
            { binding: 6, resource: { buffer: gridBuffer } }
          ]
        })
        : null;
      if (activeGridDispatch.useActiveGrid) {
        const accumulatorClearPass = encoder.beginComputePass();
        accumulatorClearPass.setPipeline(activeAccumulatorClearPipelineInfo.pipeline);
        accumulatorClearPass.setBindGroup(0, activeAccumulatorClearBindGroup);
        dispatchActiveGridComputePass(
          accumulatorClearPass,
          Math.max(1, Math.ceil(activeGridNodeDispatchCount / 64)),
          activeGridIndirectDispatchArgs
        );
        accumulatorClearPass.end();
      } else {
        encoder.clearBuffer(p2gAccumulatorBuffer, 0, Math.max(4, p2gAccumulatorByteLength));
      }
      const p2gPass = encoder.beginComputePass();
      p2gPass.setPipeline(p2gPipeline);
      p2gPass.setBindGroup(0, p2gBindGroup);
      p2gPass.dispatchWorkgroups(Math.max(1, Math.ceil(particleCount / 64)));
      p2gPass.end();
      const p2gFinalizePass = encoder.beginComputePass();
      p2gFinalizePass.setPipeline(p2gFinalizePipeline);
      p2gFinalizePass.setBindGroup(0, p2gFinalizeBindGroup);
      dispatchActiveGridComputePass(
        p2gFinalizePass,
        Math.max(1, Math.ceil(activeGridNodeDispatchCount / 64)),
        activeGridIndirectDispatchArgs
      );
      p2gFinalizePass.end();

      const gridUpdateBindGroup = device.createBindGroup({
        layout: gridUpdateBindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: gridBuffer } },
          { binding: 1, resource: { buffer: updatedGridBuffer } },
          { binding: 2, resource: { buffer: gridUpdateParamsBuffer } },
          { binding: 3, resource: { buffer: pressureRowsBuffer } }
        ]
      });
      const gridUpdatePass = encoder.beginComputePass();
      gridUpdatePass.setPipeline(gridUpdatePipeline);
      gridUpdatePass.setBindGroup(0, gridUpdateBindGroup);
      dispatchActiveGridComputePass(
        gridUpdatePass,
        Math.max(1, Math.ceil(activeGridNodeDispatchCount / 64)),
        activeGridIndirectDispatchArgs
      );
      gridUpdatePass.end();

      const g2pBindGroup = device.createBindGroup({
        layout: g2pBindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: currentStateBuffer } },
          { binding: 1, resource: { buffer: sphParticleUpload.thermoBuffer } },
          { binding: 2, resource: { buffer: currentMechanicsBuffer } },
          { binding: 3, resource: { buffer: updatedGridBuffer } },
          { binding: 4, resource: { buffer: outStateBuffer } },
          { binding: 5, resource: { buffer: outMechanicsBuffer } },
          { binding: 6, resource: { buffer: g2pParamsBuffer } }
        ]
      });
      const g2pPass = encoder.beginComputePass();
      g2pPass.setPipeline(g2pPipeline);
      g2pPass.setBindGroup(0, g2pBindGroup);
      g2pPass.dispatchWorkgroups(Math.max(1, Math.ceil(particleCount / 64)));
      g2pPass.end();
      currentStateBuffer = outStateBuffer;
      currentMechanicsBuffer = outMechanicsBuffer;
      finalStateBuffer = outStateBuffer;
      finalMechanicsBuffer = outMechanicsBuffer;
    }
    device.queue.submit([encoder.finish()]);
    attachActiveGridIndirectDispatchTopology(dispatchTopology, activeGridIndirectDispatchArgs);
    const activeGridIndirectDispatch = activeGridIndirectDispatchDescriptor(activeGridIndirectDispatchArgs);
    stageMs.fusedMechanicsSequence = Math.max(0, nowMs() - sequenceEncodeStartMs);
    let fusedMechanicsSequenceQueueFenceMs = null;
    let fusedMechanicsSequenceQueueFenceStatus = measureQueueFence ? 'requested' : 'not-requested';
    let fusedMechanicsSequenceQueueFenceMethod = null;
    if (measureQueueFence) {
      if (typeof device.queue?.onSubmittedWorkDone === 'function') {
        const queueFenceStartMs = nowMs();
        await device.queue.onSubmittedWorkDone();
        fusedMechanicsSequenceQueueFenceMs = Math.max(0, nowMs() - queueFenceStartMs);
        fusedMechanicsSequenceQueueFenceStatus = 'complete';
        fusedMechanicsSequenceQueueFenceMethod = 'queue.onSubmittedWorkDone';
      } else {
        fusedMechanicsSequenceQueueFenceStatus = 'unavailable';
      }
    }
    const webgpuStatus = {
      status: 'webgpu-executed-no-full-readback',
      reason: `Fused WebGPU MLS-MPM mechanics sequence executed ${count} substeps without full readback`
    };
    const pressureFields = pressureInterfaceGridForceBlockedFields();
    const p2gGridProjection = {
      schema: ULG_MLS_MPM_GPU_GRID_PROJECTION_EXECUTION_SCHEMA,
      projectionSchema: ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
      backend: 'webgpu',
      status: webgpuStatus.status,
      kernelScope: 'particle-parallel-scatter-p2g-stress-momentum-projection',
      particleCount,
      gridSpacingM: gridSpec.gridSpacingM,
      gridDims: [...gridSpec.gridDims],
      gridNodeCount: gridSpec.gridNodeCount,
      gridShift: gridSpec.shift,
      gridNodeStrideFloats: MLS_MPM_GPU_GRID_NODE_FLOATS,
      dt: dtSeconds,
      internalPressureScale,
      gridNodes: new Float32Array(),
      gridBuffer,
      gridBufferByteLength: gridByteLength,
      readbackMode: NO_FULL_READBACK_MODE,
      fullReadbackPerformed: false,
      retainedGridBuffer: true,
      webgpuStatus,
      webgpuParity: {
        status: 'not-run-no-full-readback',
        reason: 'fused no-full resident mechanics sequence skipped P2G readback'
      },
      dispatchTopology: dispatchTopology.p2g,
      residentDispatchTopology: dispatchTopology,
      fusedResidentSequence: true,
      fusedResidentSequenceStepCount: count,
      activeGridDispatch,
      activeGridIndirectDispatch
    };
    const gridUpdate = {
      schema: ULG_MLS_MPM_GPU_GRID_UPDATE_EXECUTION_SCHEMA,
      updateSchema: ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
      backend: 'webgpu',
      status: webgpuStatus.status,
      kernelScope: 'mls-mpm-grid-velocity-update-gravity-cfl-walls',
      particleCount,
      gridSpacingM: gridSpec.gridSpacingM,
      gridDims: [...gridSpec.gridDims],
      gridNodeCount: gridSpec.gridNodeCount,
      gridShift: gridSpec.shift,
      gridNodeStrideFloats: MLS_MPM_GPU_GRID_VELOCITY_FLOATS,
      dt: dtSeconds,
      gravityMPerS2: [...gravity],
      boxDimsM: [...dims],
      cflFactor,
      updatedGridNodes: new Float32Array(),
      updatedGridBuffer,
      updatedGridBufferByteLength: updatedGridByteLength,
      readbackMode: NO_FULL_READBACK_MODE,
      fullReadbackPerformed: false,
      retainedUpdatedGridBuffer: true,
      queueCompletionStatus: 'queue-submitted-cleanup-deferred',
      queueCompletionMethod: 'deferred fused mechanics sequence cleanup',
      webgpuStatus,
      webgpuParity: {
        status: 'not-run-no-full-readback',
        reason: 'fused no-full resident mechanics sequence skipped grid-update readback'
      },
      ...pressureFields,
      dispatchTopology: dispatchTopology.gridUpdate,
      residentDispatchTopology: dispatchTopology,
      fusedResidentSequence: true,
      fusedResidentSequenceStepCount: count,
      activeGridDispatch,
      activeGridIndirectDispatch
    };
    const g2pParticleScaleStability = noFullReadbackG2pParticleScaleStability({
      particleCount,
      source: 'webgpu-fused-sequence-g2p-shader'
    });
    const g2pReconstruction = {
      schema: ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_EXECUTION_SCHEMA,
      reconstructionSchema: ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_SCHEMA,
      backend: 'webgpu',
      status: 'reconstructed',
      kernelScope: 'mls-mpm-g2p-velocity-affine-deformation-reconstruction',
      particleCount,
      gridNodeCount: gridSpec.gridNodeCount,
      gridSpacingM: gridSpec.gridSpacingM,
      gridDims: [...gridSpec.gridDims],
      gridShift: gridSpec.shift,
      dt: dtSeconds,
      internalPressureScale,
      stateStrideFloats: SPH_GPU_PARTICLE_STATE_FLOATS,
      mechanicsStrideFloats: MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
      state: new Float32Array(),
      mechanics: new Float32Array(),
      stateBuffer: finalStateBuffer,
      mechanicsBuffer: finalMechanicsBuffer,
      stateBufferByteLength: stateByteLength,
      mechanicsBufferByteLength: mechanicsByteLength,
      retainedOutputParticleBuffers: true,
      readbackMode: NO_FULL_READBACK_MODE,
      fullReadbackPerformed: false,
      particleScaleStability: g2pParticleScaleStability,
      particleScaleStabilitySchema: g2pParticleScaleStability.schema,
      particleScaleStabilityStatus: g2pParticleScaleStability.status,
      particleScalePolicyAppliedInG2p: true,
      particleScaleMaxVolumeRatioJAllowed: g2pParticleScaleStability.maxVolumeRatioJAllowed,
      particleScaleMaxRadiusGrowthRatioAllowed: g2pParticleScaleStability.maxRadiusGrowthRatioAllowed,
      webgpuStatus,
      webgpuParity: {
        status: 'not-run-no-full-readback',
        reason: 'fused no-full resident mechanics sequence skipped G2P readback'
      },
      gpuResult: {
        backend: 'webgpu',
        readbackMode: NO_FULL_READBACK_MODE,
        stateBuffer: finalStateBuffer,
        mechanicsBuffer: finalMechanicsBuffer,
        stateBufferByteLength: stateByteLength,
        mechanicsBufferByteLength: mechanicsByteLength,
        retainedOutputParticleBuffers: true,
        destroyOutputParticleBuffers: () => {
          finalStateBuffer.destroy?.();
          finalMechanicsBuffer.destroy?.();
        }
      },
      dispatchTopology: dispatchTopology.g2p,
      residentDispatchTopology: dispatchTopology,
      destroyOutputParticleBuffers: () => {
        finalStateBuffer.destroy?.();
        finalMechanicsBuffer.destroy?.();
      },
      fusedResidentSequence: true,
      fusedResidentSequenceStepCount: count,
      activeGridDispatch,
      activeGridIndirectDispatch
    };
    const sourceStep = finiteNumber(sphParticleState.step ?? mlsMpmParticleState.step, 0);
    const sourceTime = finiteNumber(sphParticleState.time ?? mlsMpmParticleState.time, 0);
    const finalSourceStep = sourceStep + count - 1;
    const finalSourceTime = sourceTime + dtSeconds * (count - 1);
    const finalSourceSlot = sourceSlot === 0
      ? ((count - 1) % 2)
      : (1 - ((count - 1) % 2));
    const finalSourceSphParticleState = {
      ...sphParticleState,
      step: finalSourceStep,
      time: finalSourceTime,
      status: 'gpu-resident-unread-ready',
      cpuStateStale: true,
      residentPositionBoundsM: predictedResidentBoundsFromActiveGridDispatch(activeGridDispatch)
        || sphParticleState.residentPositionBoundsM
        || null,
      residentMaxSpeedMPerS: activeGridDispatch.maxSpeedMPerS
        ?? sphParticleState.residentMaxSpeedMPerS
        ?? null,
      residentActiveGridDispatchHint: activeGridDispatch
    };
    const finalSourceMlsMpmParticleState = {
      ...mlsMpmParticleState,
      step: finalSourceStep,
      time: finalSourceTime,
      status: 'gpu-resident-unread-ready',
      cpuStateStale: true
    };
    const finalSourceSphParticleUpload = {
      ...sphParticleUpload,
      stateBuffer: finalSourceStateBuffer,
      ownsStateBuffer: false,
      slot: finalSourceSlot,
      sourceSlot: finalSourceSlot,
      nextSlot: finalSourceSlot,
      step: finalSourceStep,
      time: finalSourceTime
    };
    const finalSourceMlsMpmParticleUpload = {
      ...mlsMpmParticleUpload,
      mechanicsBuffer: finalSourceMechanicsBuffer,
      ownsMechanicsBuffer: false,
      slot: finalSourceSlot,
      sourceSlot: finalSourceSlot,
      nextSlot: finalSourceSlot,
      step: finalSourceStep,
      time: finalSourceTime
    };
    let compactGpuSummary = null;
    if (typeof summaryRunner === 'function') {
      const compactSummaryStartMs = nowMs();
      try {
        compactGpuSummary = await summaryRunner({
          device,
          sphParticleState: finalSourceSphParticleState,
          mlsMpmParticleState: finalSourceMlsMpmParticleState,
          sphParticleUpload: finalSourceSphParticleUpload,
          mlsMpmParticleUpload: finalSourceMlsMpmParticleUpload,
          gridUpdate,
          g2pReconstruction,
          thermalStep: null,
          reactionStep: null,
          mechanicsRefreshStep: null,
          cohortRanges,
          summaryScope: compactSummaryScope,
          activeGridDispatchPlan: activeGridDispatch.useActiveGrid
            ? {
              requested: true,
              dt: dtSeconds,
              stepCount: count,
              gravityMPerS2: gravity,
              safetyCells: activeGridDispatch.safetyCells ?? activeGridSafetyCells
            }
            : false
        });
      } catch (error) {
        compactGpuSummary = {
          schema: ULG_MLS_MPM_GPU_RESIDENT_SUMMARY_EXECUTION_SCHEMA,
          backend: 'webgpu',
          status: 'compact-summary-unavailable',
          reason: error instanceof Error ? error.message : String(error),
          compactGpuSummaryAvailable: false,
          scientificValidation: false,
          sphValidation: false,
          phaseChangeValidation: false,
          fullPhysicsValidation: false
        };
      }
      stageMs.compactSummary = Math.max(0, nowMs() - compactSummaryStartMs);
    } else if (activeGridDispatch.useActiveGrid) {
      const compactSummaryStartMs = nowMs();
      try {
        compactGpuSummary = await runMlsMpmResidentSummaryWebGpu({
          device,
          sphParticleState: finalSourceSphParticleState,
          mlsMpmParticleState: finalSourceMlsMpmParticleState,
          sphParticleUpload: finalSourceSphParticleUpload,
          mlsMpmParticleUpload: finalSourceMlsMpmParticleUpload,
          gridUpdate,
          g2pReconstruction,
          thermalStep: null,
          reactionStep: null,
          mechanicsRefreshStep: null,
          cohortRanges,
          summaryScope: compactSummaryScope,
          readCompactSummary: false,
          activeGridDispatchPlan: {
            requested: true,
            dt: dtSeconds,
            stepCount: count,
            gravityMPerS2: gravity,
            safetyCells: activeGridDispatch.safetyCells ?? activeGridSafetyCells
          }
        });
      } catch (error) {
        compactGpuSummary = {
          schema: ULG_MLS_MPM_GPU_RESIDENT_SUMMARY_EXECUTION_SCHEMA,
          backend: 'webgpu',
          status: 'compact-summary-plan-only-unavailable',
          reason: error instanceof Error ? error.message : String(error),
          compactGpuSummaryAvailable: false,
          scientificValidation: false,
          sphValidation: false,
          phaseChangeValidation: false,
          fullPhysicsValidation: false
        };
      }
      stageMs.compactSummary = Math.max(0, nowMs() - compactSummaryStartMs);
    }
    const stageTiming = {
      schema: ULG_MLS_MPM_RESIDENT_STAGE_TIMING_SCHEMA,
      totalMs: Math.max(0, nowMs() - stageTimingStartMs),
      stageMs: { ...stageMs },
      queueFenceMs: {
        compactSummaryMapAsync: compactGpuSummary?.mapAsyncWaitMs ?? compactGpuSummary?.timing?.mapAsyncWaitMs ?? null,
        fusedMechanicsSequence: fusedMechanicsSequenceQueueFenceMs
      },
      queueFenceStatus: {
        fusedMechanicsSequence: fusedMechanicsSequenceQueueFenceStatus
      },
      queueFenceMethod: {
        fusedMechanicsSequence: fusedMechanicsSequenceQueueFenceMethod
      },
      compactSummaryTiming: compactGpuSummary?.timing ?? null,
      fusedResidentSequence: true,
      fusedResidentSequenceStepCount: count,
      dispatchTopology,
      activeGridDispatch,
      activeGridIndirectDispatch,
      requestedReadbackMode: NO_FULL_READBACK_MODE,
      preferWebGpu,
      compactSummaryRequested: typeof summaryRunner === 'function',
      activeGridDispatchPlanOnlyRequested: typeof summaryRunner !== 'function' && activeGridDispatch.useActiveGrid,
      compactSummaryScope,
      thermalRequested: false,
      mechanicsRefreshRequested: false,
      reactionRequested: false,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
    const finalStep = await residentStepEnvelope({
      sphParticleState: finalSourceSphParticleState,
      mlsMpmParticleState: finalSourceMlsMpmParticleState,
      p2gGridProjection,
      gridUpdate,
      g2pReconstruction,
      thermalStep: null,
      reactionStep: null,
      mechanicsRefreshStep: null,
      inputResidentProductMass: null,
      compactGpuSummary,
      dt: dtSeconds,
      gravityMPerS2: gravity,
      boxDimsM: dims,
      cflFactor,
      preferWebGpu,
      device,
      sphParticleUpload: finalSourceSphParticleUpload,
      mlsMpmParticleUpload: finalSourceMlsMpmParticleUpload,
      sourceSlot: finalSourceSlot,
      pressureInterfaceForceSolver: null,
      internalPressureScale,
      stageTiming
    });
    finalStep.sequenceIndex = count - 1;
    const continuationBounds = residentBoundsContinuationFromStep(
      finalStep,
      activeGridDispatch,
      finalSourceSphParticleState
    );
    finalStep.residentPositionBoundsM = continuationBounds.boundsM;
    finalStep.residentMaxSpeedMPerS = continuationBounds.maxSpeedMPerS;
    finalStep.residentPositionBoundsSource = continuationBounds.source;
    finalStep.residentActiveGridDispatchHint = activeGridDispatch;
    finalStep.fusedResidentSequence = {
      schema: 'peercompute.ulg.mls-mpm-fused-resident-sequence.v0',
      status: 'fused-resident-sequence-executed',
      stepCount: count,
      commandSubmissionCount: 1,
      dispatchCount: dispatchTopology.totalDispatches,
      queueFenceRequested: measureQueueFence,
      queueFenceMs: fusedMechanicsSequenceQueueFenceMs,
      queueFenceStatus: fusedMechanicsSequenceQueueFenceStatus,
      queueFenceMethod: fusedMechanicsSequenceQueueFenceMethod,
      dispatchTopology,
      activeGridDispatch,
      residentPositionBoundsSource: continuationBounds.source,
      retainedBufferMode: 'ping-pong-state-mechanics-single-grid',
      finalSourceSlot,
      finalNextSlot: finalStep.particlePingPong?.nextSlot ?? null
    };
    const temporaryBuffers = [
      p2gAccumulatorBuffer,
      p2gParamsBuffer,
      gridUpdateParamsBuffer,
      g2pParamsBuffer,
      productEventBuffer,
      pressureRowsBuffer,
      ...statePingBuffers.filter((buffer) => buffer !== finalStateBuffer),
      ...mechanicsPingBuffers.filter((buffer) => buffer !== finalMechanicsBuffer)
    ];
    deferSubmittedWorkCleanup(device, () => {
      for (const buffer of temporaryBuffers) buffer.destroy?.();
    });
    returned = true;
    return finalStep;
  } finally {
    if (!returned) {
      for (const buffer of allCreatedBuffers) buffer.destroy?.();
    }
  }
}

function assertPackedInputs({ sphParticleState, mlsMpmParticleState }) {
  if (sphParticleState?.schema !== ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError('MLS-MPM resident step requires a packed SPH GPU particle buffer');
  }
  if (mlsMpmParticleState?.schema !== ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError('MLS-MPM resident step requires a packed MLS-MPM GPU particle buffer');
  }
  if (sphParticleState.particleCount !== mlsMpmParticleState.particleCount) {
    throw new RangeError('SPH and MLS-MPM particle counts must match');
  }
}

function assertResidentCpuMirrorGuards({
  sphParticleState,
  mlsMpmParticleState,
  sphParticleUpload = null,
  mlsMpmParticleUpload = null,
  preferWebGpu = false,
  readbackMode = FULL_READBACK_MODE
} = {}) {
  const residentNoFullWebGpu = preferWebGpu && readbackMode === NO_FULL_READBACK_MODE;
  if (sphParticleState?.cpuStateStale && sphParticleUpload?.status !== 'webgpu-uploaded') {
    throw new Error('Stale SPH CPU mirror cannot drive an MLS-MPM resident step without the retained SPH GPU upload or an admitted readback');
  }
  if (sphParticleState?.cpuStateStale && !residentNoFullWebGpu) {
    throw new Error('Stale SPH CPU mirror requires an explicit no-full-readback WebGPU resident step or an admitted readback');
  }
  if (mlsMpmParticleState?.cpuStateStale && mlsMpmParticleUpload?.status !== 'webgpu-uploaded') {
    throw new Error('Stale MLS-MPM CPU mirror cannot drive an MLS-MPM resident step without the retained mechanics GPU upload or an admitted readback');
  }
  if (mlsMpmParticleState?.cpuStateStale && !residentNoFullWebGpu) {
    throw new Error('Stale MLS-MPM CPU mirror requires an explicit no-full-readback WebGPU resident step or an admitted readback');
  }
}

function summarizeParticles({ sourceState, sourceMechanics, nextState, nextMechanics, particleCount }) {
  let sourceMassKg = 0;
  let nextMassKg = 0;
  const sourceMomentumKgMPerS = [0, 0, 0];
  const nextMomentumKgMPerS = [0, 0, 0];
  let maxSpeedMPerS = 0;
  let maxDisplacementM = 0;
  let minVolumeRatioJ = Number.POSITIVE_INFINITY;
  let maxVolumeRatioJ = 0;

  for (let index = 0; index < particleCount; index += 1) {
    const stateOffset = index * SPH_GPU_PARTICLE_STATE_FLOATS;
    const mechanicsOffset = index * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS;
    const m0 = sourceState[stateOffset + 3] ?? 0;
    const m1 = nextState?.[stateOffset + 3] ?? m0;
    sourceMassKg += m0;
    nextMassKg += m1;
    for (let axis = 0; axis < 3; axis += 1) {
      sourceMomentumKgMPerS[axis] += m0 * (sourceState[stateOffset + 4 + axis] ?? 0);
      nextMomentumKgMPerS[axis] += m1 * (nextState?.[stateOffset + 4 + axis] ?? 0);
    }
    const vx = nextState?.[stateOffset + 4] ?? 0;
    const vy = nextState?.[stateOffset + 5] ?? 0;
    const vz = nextState?.[stateOffset + 6] ?? 0;
    maxSpeedMPerS = Math.max(maxSpeedMPerS, Math.hypot(vx, vy, vz));
    const dx = (nextState?.[stateOffset] ?? sourceState[stateOffset]) - sourceState[stateOffset];
    const dy = (nextState?.[stateOffset + 1] ?? sourceState[stateOffset + 1]) - sourceState[stateOffset + 1];
    const dz = (nextState?.[stateOffset + 2] ?? sourceState[stateOffset + 2]) - sourceState[stateOffset + 2];
    maxDisplacementM = Math.max(maxDisplacementM, Math.hypot(dx, dy, dz));
    const j = finiteNumber(nextMechanics?.[mechanicsOffset + 18] ?? sourceMechanics?.[mechanicsOffset + 18], 1);
    minVolumeRatioJ = Math.min(minVolumeRatioJ, j);
    maxVolumeRatioJ = Math.max(maxVolumeRatioJ, j);
  }

  return {
    sourceMassKg,
    nextMassKg,
    massDeltaKg: nextMassKg - sourceMassKg,
    sourceMomentumKgMPerS,
    nextMomentumKgMPerS,
    momentumDeltaKgMPerS: nextMomentumKgMPerS.map((value, axis) => value - sourceMomentumKgMPerS[axis]),
    maxSpeedMPerS,
    maxDisplacementM,
    minVolumeRatioJ: Number.isFinite(minVolumeRatioJ) ? minVolumeRatioJ : 0,
    maxVolumeRatioJ
  };
}

function summarizeActiveGridNodes(gridUpdate) {
  const nodes = gridUpdate?.updatedGridNodes;
  const stride = gridUpdate?.gridNodeStrideFloats ?? 8;
  if (!(nodes instanceof Float32Array) || stride <= 0) return 0;
  let activeNodes = 0;
  for (let offset = 0; offset < nodes.length; offset += stride) {
    if ((nodes[offset] ?? 0) > 0) activeNodes += 1;
  }
  return activeNodes;
}

function reactionSummaryDiagnostics(reactionStep) {
  const reactionResult = reactionStep?.result || reactionStep;
  const summary = reactionResult?.reactionSummary || null;
  const residentProductMass = residentProductMassFromReactionStep(reactionStep);
  return {
    reactionSummaryAvailable: Boolean(summary?.reactionSummaryAvailable),
    reactionSummaryStatus: summary?.status || reactionResult?.reactionSummaryStatus || (reactionResult ? 'not-run' : 'not-required'),
    reactionSummaryReadbackMode: summary?.readbackMode ?? null,
    reactionSummaryReadbackByteLength: summary?.compactReadbackByteLength ?? 0,
    reactionSummaryReductionStrategy: summary?.reductionStrategy ?? null,
    reactionVisibleProductMassKg: summary?.visibleProductMassKg ?? null,
    reactionVisibleGasProductMassKg: summary?.visibleGasProductMassKg ?? null,
    reactionOutputGasPhaseMassKg: summary?.outputGasPhaseMassKg ?? null,
    reactionChangedMaterialCount: summary?.changedMaterialCount ?? null,
    reactionChangedMassCount: summary?.changedMassCount ?? null,
    reactionCanonicalEventCount: summary?.canonicalReactionEventCount ?? null,
    reactionConsumedReactantMassKg: summary?.consumedReactantMassKg ?? null,
    reactionExpectedProductMassKg: summary?.expectedProductMassKg ?? null,
    reactionRawProductMassKg: summary?.rawProductMassKg ?? null,
    reactionLedgerVisibleProductMassKg: summary?.ledgerVisibleProductMassKg ?? null,
    reactionLedgerUnplacedProductMassKg: summary?.ledgerUnplacedProductMassKg ?? null,
    reactionLedgerGasProductMassKg: summary?.ledgerGasProductMassKg ?? null,
    reactionLedgerVisibleGasProductMassKg: summary?.ledgerVisibleGasProductMassKg ?? null,
    reactionLedgerUnplacedGasProductMassKg: summary?.ledgerUnplacedGasProductMassKg ?? null,
    reactionSealedBoxGasProductMoles: summary?.sealedBoxGasProductMoles ?? null,
    reactionHeatJ: summary?.reactionHeatJ ?? null,
    reactionLedgerMassResidualKg: summary?.ledgerMassResidualKg ?? null,
    reactionLedgerReadyEventCount: summary?.ledgerReadyEventCount ?? null,
    reactionLedgerProblemEventCount: summary?.ledgerProblemEventCount ?? null,
    reactionProposalMutualPairCount: summary?.proposalMutualPairCount ?? null,
    reactionProposalNeighborMode: reactionResult?.reactionProposalNeighborMode ?? null,
    reactionParticleBinGridSchema: reactionResult?.reactionParticleBinGridSchema ?? null,
    reactionParticleBinGridStatus: reactionResult?.reactionParticleBinGridStatus ?? null,
    reactionParticleBinGridReason: reactionResult?.reactionParticleBinGridReason ?? null,
    reactionParticleBinGridEnabled: reactionResult?.reactionParticleBinGridEnabled === true,
    reactionParticleBinGridBoundsSource: reactionResult?.reactionParticleBinGridBoundsSource ?? null,
    reactionParticleBinGridDims: reactionResult?.reactionParticleBinGridDims
      ? [...reactionResult.reactionParticleBinGridDims]
      : null,
    reactionParticleBinGridCellCount: reactionResult?.reactionParticleBinGridCellCount ?? 0,
    reactionParticleBinGridCellSizeM: reactionResult?.reactionParticleBinGridCellSizeM ?? 0,
    reactionParticleBinGridBinCapacity: reactionResult?.reactionParticleBinGridBinCapacity ?? 0,
    reactionParticleBinGridAverageOccupancy: reactionResult?.reactionParticleBinGridAverageOccupancy ?? 0,
    reactionParticleBinGridEstimatedOverflowRisk: reactionResult?.reactionParticleBinGridEstimatedOverflowRisk === true,
    reactionParticleBinGridIndexBufferByteLength: reactionResult?.reactionParticleBinGridIndexBufferByteLength ?? 0,
    reactionParticleBinGridMaxContactRadiusM: reactionResult?.reactionParticleBinGridMaxContactRadiusM ?? 0,
    reactionParticleBinOverflowStatus: reactionResult?.reactionParticleBinOverflowStatus ?? null,
    reactionParticleBinOverflowCount: reactionResult?.reactionParticleBinOverflowCount ?? null,
    reactionParticleBinOverflowMetadataReadbackRequested:
      reactionResult?.reactionParticleBinOverflowMetadataReadbackRequested === true,
    reactionCompactLedgerAvailable: summary?.compactLedgerAvailable ?? false,
    reactionProductInventoryCount: summary?.productInventoryCount ?? 0,
    reactionProductInventoryReadbackByteLength: summary?.productInventoryReadbackByteLength ?? 0,
    reactionProductEventRowCount: summary?.productEventRowCount ?? 0,
    reactionProductEventActiveEventCount: summary?.productEventActiveEventCount ?? 0,
    reactionProductEventReadbackByteLength: summary?.productEventReadbackByteLength ?? 0,
    reactionProductEventBufferByteLength: summary?.productEventBufferByteLength ?? 0,
    reactionProductEventBufferRetained: summary?.productEventBufferRetained ?? false,
    reactionResidentProductMassStatus: residentProductMass?.status ?? null,
    reactionResidentProductMassBufferRetained: residentProductMass?.productEventBufferRetained ?? false,
    reactionResidentProductMassBufferByteLength: residentProductMass?.productEventBufferByteLength ?? 0,
    reactionResidentProductMassProductEventRowCount: residentProductMass?.productEventRowCount ?? 0,
    reactionResidentProductMassUnplacedProductMassKg: residentProductMass?.unplacedProductMassKg ?? null,
    reactionResidentProductMassUnplacedGasProductMassKg: residentProductMass?.unplacedGasProductMassKg ?? null,
    reactionResidentProductMassEosCouplingStatus: residentProductMass?.eosCouplingStatus ?? null,
    reactionProductInventory: summary?.productInventory
      ? {
          ...summary.productInventory,
          records: Array.isArray(summary.productInventory.records)
            ? summary.productInventory.records.map((row) => ({ ...row }))
            : [],
          byMaterial: Object.fromEntries(
            Object.entries(summary.productInventory.byMaterial || {})
              .map(([key, row]) => [key, { ...row, productTermIndices: [...(row.productTermIndices || [])] }])
          )
        }
      : null,
    reactionAtomResidualCount: summary?.atomResidualCount ?? 0,
    reactionAtomResidualReadbackByteLength: summary?.atomResidualReadbackByteLength ?? 0,
    reactionAtomResidualSummary: summary?.atomResidualSummary
      ? {
          ...summary.atomResidualSummary,
          records: Array.isArray(summary.atomResidualSummary.records)
            ? summary.atomResidualSummary.records.map((row) => ({ ...row }))
            : [],
          atomResidualMolByZ: { ...(summary.atomResidualSummary.atomResidualMolByZ || {}) }
        }
      : null,
    reactionStrictGateStatus: summary?.strictReactionGate?.status ?? null,
    reactionStrictGateBlockers: Array.isArray(summary?.strictReactionGate?.blockers)
      ? [...summary.strictReactionGate.blockers]
      : [],
    reactionStrictGate: summary?.strictReactionGate
      ? {
          ...summary.strictReactionGate,
          blockers: [...(summary.strictReactionGate.blockers || [])],
          warnings: [...(summary.strictReactionGate.warnings || [])],
          provisionalEnergetics: (summary.strictReactionGate.provisionalEnergetics || []).map((row) => ({ ...row }))
        }
      : null,
    reactionGasSpeciesLedgerCount: summary?.gasSpeciesLedgerCount ?? 0,
    reactionGasSpeciesReadbackByteLength: summary?.gasSpeciesReadbackByteLength ?? 0,
    reactionGasSpeciesLedger: summary?.gasSpeciesLedger
      ? {
          ...summary.gasSpeciesLedger,
          records: Array.isArray(summary.gasSpeciesLedger.records)
            ? summary.gasSpeciesLedger.records.map((row) => ({ ...row }))
            : [],
          bySpecies: Object.fromEntries(
            Object.entries(summary.gasSpeciesLedger.bySpecies || {})
              .map(([key, row]) => [key, { ...row, gasProductIndices: [...(row.gasProductIndices || [])] }])
          )
        }
      : null,
    reactionSummaryVisibleOnly: summary?.visibleOnly ?? null,
    reactionSummaryUnplacedProductInventoryIncluded: summary?.unplacedProductInventoryIncluded ?? null
  };
}

function nonzeroSummaryValue(value, tolerance = 1e-12) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && Math.abs(numeric) > tolerance;
}

function reactionOutputMutatesParticles(reactionStep) {
  const reactionResult = reactionStep?.result || reactionStep;
  if (!reactionResult) return false;
  const hasOutputBuffers = Boolean(
    reactionResult.stateBuffer || reactionResult.thermoBuffer || reactionResult.mechanicsBuffer
  );
  if (!hasOutputBuffers) return false;
  const summary = reactionResult.reactionSummary || null;
  if (!summary?.reactionSummaryAvailable) return true;
  return [
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
}

function pressureInterfaceGridForceDiagnostics(gridUpdate) {
  return {
    pressureInterfaceForceSolverSchema: gridUpdate?.pressureInterfaceForceSolverSchema ?? null,
    pressureInterfaceForceSolverStatus: gridUpdate?.pressureInterfaceForceSolverStatus ?? null,
    pressureInterfaceForceCouplingStatus: gridUpdate?.pressureInterfaceForceCouplingStatus ?? null,
    pressureInterfaceForceApplicationStatus: gridUpdate?.pressureInterfaceForceApplicationStatus ?? null,
    pressureInterfaceGridForceAdmissionSchema: gridUpdate?.pressureInterfaceGridForceAdmissionSchema ?? null,
    pressureInterfaceGridForceAdmissionStatus: gridUpdate?.pressureInterfaceGridForceAdmissionStatus ?? null,
    pressureInterfaceGridForceAdmissionApproved: gridUpdate?.pressureInterfaceGridForceAdmissionApproved ?? false,
    pressureInterfaceGridForceAdmissionDescriptorStatus: gridUpdate?.pressureInterfaceGridForceAdmissionDescriptorStatus ?? null,
    pressureInterfaceGridForceAdmissionSourceHotBufferKey: gridUpdate?.pressureInterfaceGridForceAdmissionSourceHotBufferKey ?? null,
    pressureInterfaceForceRowCount: gridUpdate?.pressureInterfaceForceRowCount ?? 0,
    pressureInterfaceAppliedImpulseNSeconds: [...(gridUpdate?.pressureInterfaceAppliedImpulseNSeconds ?? [0, 0, 0])],
    pressureInterfaceAppliedImpulseMagnitudeNSeconds: gridUpdate?.pressureInterfaceAppliedImpulseMagnitudeNSeconds ?? 0,
    pressureInterfaceAppliedImpulseSource: gridUpdate?.pressureInterfaceAppliedImpulseSource ?? null,
    pressureInterfaceImpulseProofStatus: gridUpdate?.pressureInterfaceImpulseProofStatus ?? null,
    pressureInterfaceForceConsumerStatus: gridUpdate?.pressureInterfaceForceConsumerStatus ?? null
  };
}

function wallBarrierContactDiagnostics(gridUpdate) {
  return {
    wallBarrierContactSchema: gridUpdate?.wallBarrierContactSchema ?? null,
    wallBarrierContactStatus: gridUpdate?.wallBarrierContactStatus ?? null,
    wallBarrierContactMode: gridUpdate?.wallBarrierContactMode ?? null,
    wallBarrierElasticStiffnessNPerM: gridUpdate?.wallBarrierElasticStiffnessNPerM ?? 0,
    wallBarrierElasticStiffnessSource: gridUpdate?.wallBarrierElasticStiffnessSource ?? null,
    wallBarrierContactMaterialPolicySchema: gridUpdate?.wallBarrierContactMaterialPolicySchema ?? null,
    wallBarrierContactMaterialPolicyStatus: gridUpdate?.wallBarrierContactMaterialPolicyStatus ?? null,
    wallBarrierContactMaterialPolicySource: gridUpdate?.wallBarrierContactMaterialPolicySource ?? null,
    wallBarrierContactAlgorithmRowsSchema: gridUpdate?.wallBarrierContactAlgorithmRowsSchema ?? null,
    wallBarrierContactAlgorithmRowStatus: gridUpdate?.wallBarrierContactAlgorithmRowStatus ?? null,
    wallBarrierContactAlgorithmPairKey: gridUpdate?.wallBarrierContactAlgorithmPairKey ?? null,
    wallBarrierContactAlgorithmMaterials: gridUpdate?.wallBarrierContactAlgorithmMaterials ?? [],
    wallBarrierContactAlgorithmPhases: gridUpdate?.wallBarrierContactAlgorithmPhases ?? [],
    wallBarrierContactAlgorithmNormalStiffnessPa: gridUpdate?.wallBarrierContactAlgorithmNormalStiffnessPa ?? 0,
    wallBarrierContactScale: gridUpdate?.wallBarrierContactScale ?? 0,
    wallBarrierMinGapM: gridUpdate?.wallBarrierMinGapM ?? 0,
    wallBarrierContactNodeCount: gridUpdate?.wallBarrierContactNodeCount ?? 0,
    wallBarrierContactMaxResponseAlpha: gridUpdate?.wallBarrierContactMaxResponseAlpha ?? 0,
    wallBarrierContactMaxNormalStiffness: gridUpdate?.wallBarrierContactMaxNormalStiffness ?? 0,
    wallBarrierContactTotalVelocityCorrectionMPerS: gridUpdate?.wallBarrierContactTotalVelocityCorrectionMPerS ?? 0,
    wallBarrierContactMaxVelocityCorrectionMPerS: gridUpdate?.wallBarrierContactMaxVelocityCorrectionMPerS ?? 0
  };
}

function residentDispatchTopologyDiagnostics({
  dispatchTopology = null,
  p2gGridProjection = null,
  gridUpdate = null,
  g2pReconstruction = null
} = {}) {
  const resolved = dispatchTopology
    || p2gGridProjection?.residentDispatchTopology
    || gridUpdate?.residentDispatchTopology
    || g2pReconstruction?.residentDispatchTopology
    || null;
  return {
    dispatchTopology: resolved,
    dispatchTopologyStatus: resolved?.status || null,
    dispatchTopologySchema: resolved?.schema || null,
    p2gBackendPolicy: resolved?.p2gBackendPolicy || null,
    p2gBackendPolicyStatus: resolved?.p2gBackendPolicyStatus || null,
    p2gBackendRequested: resolved?.p2gBackendRequested || null,
    p2gBackendEffective: resolved?.p2gBackendEffective || null,
    p2gBackendFallbackReason: resolved?.p2gBackendFallbackReason || null,
    cpuParticleLoopInHotPath: resolved?.cpuParticleLoopInHotPath ?? null,
    particleParallelStages: [...(resolved?.particleParallelStages || [])],
    gridParallelStages: [...(resolved?.gridParallelStages || [])],
    dispatchesPerSubstep: resolved?.dispatchesPerSubstep ?? null,
    totalDispatches: resolved?.totalDispatches ?? null,
    workgroupsPerSubstep: resolved?.workgroupsPerSubstep ?? null,
    totalWorkgroups: resolved?.totalWorkgroups ?? null,
    p2gDispatchTopology: p2gGridProjection?.dispatchTopology || resolved?.p2g || null,
    p2gFinalizeDispatchTopology: resolved?.p2gFinalize || null,
    gridUpdateDispatchTopology: gridUpdate?.dispatchTopology || resolved?.gridUpdate || null,
    g2pDispatchTopology: g2pReconstruction?.dispatchTopology || resolved?.g2p || null
  };
}

function residentParticleScaleStabilityDiagnostics({
  g2pReconstruction,
  compactGpuSummary = null,
  readbackMode = FULL_READBACK_MODE
} = {}) {
  const g2pStability = g2pReconstruction?.particleScaleStability || null;
  const status = g2pStability?.status || (readbackMode === NO_FULL_READBACK_MODE
    ? 'gpu-g2p-cap-policy-applied-in-shader'
    : 'particle-scale-bounded');
  return {
    particleScaleStability: g2pStability,
    particleScaleStabilitySchema: g2pStability?.schema || ULG_MLS_MPM_G2P_PARTICLE_SCALE_STABILITY_SCHEMA,
    particleScaleStabilityStatus: status,
    particleScalePolicySource: g2pStability?.source || null,
    particleScalePolicyAppliedInG2p: g2pStability?.policyAppliedInG2p === true,
    particleScalePolicyAppliedInShader: g2pStability?.policyAppliedInShader === true,
    particleScaleMaxRadiusGrowthRatioAllowed: g2pStability?.maxRadiusGrowthRatioAllowed
      ?? MLS_MPM_G2P_MAX_RADIUS_GROWTH_RATIO,
    particleScaleMaxVolumeRatioJAllowed: g2pStability?.maxVolumeRatioJAllowed
      ?? MLS_MPM_G2P_MAX_VOLUME_RATIO_J,
    particleScaleCapCountKnown: g2pStability?.capCountKnown === true,
    particleScaleCapCount: g2pStability?.capCount ?? null,
    particleScaleInvalidCountKnown: g2pStability?.invalidCountKnown === true,
    particleScaleInvalidCount: g2pStability?.invalidCount ?? null,
    particleScaleMaxRawVolumeRatioJ: g2pStability?.maxRawVolumeRatioJ ?? null,
    particleScaleMaxEffectiveVolumeRatioJ: g2pStability?.maxEffectiveVolumeRatioJ
      ?? compactGpuSummary?.maxVolumeRatioJ
      ?? null,
    particleScaleMinEffectiveVolumeRatioJ: g2pStability?.minEffectiveVolumeRatioJ
      ?? compactGpuSummary?.minVolumeRatioJ
      ?? null,
    particleScaleCappedSamples: [...(g2pStability?.cappedSamples || [])]
  };
}

export function compactMlsMpmResidentStepDiagnostics({
  sphParticleState,
  mlsMpmParticleState,
  p2gGridProjection,
  gridUpdate,
  g2pReconstruction,
  reactionStep = null,
  compactGpuSummary = null,
  readbackMode = FULL_READBACK_MODE,
  dispatchTopology = null
} = {}) {
  assertPackedInputs({ sphParticleState, mlsMpmParticleState });
  const reactionSummary = reactionSummaryDiagnostics(reactionStep);
  const pressureInterfaceGridForce = pressureInterfaceGridForceDiagnostics(gridUpdate);
  const wallBarrierContact = wallBarrierContactDiagnostics(gridUpdate);
  const topologyDiagnostics = residentDispatchTopologyDiagnostics({
    dispatchTopology,
    p2gGridProjection,
    gridUpdate,
    g2pReconstruction
  });
  const particleScaleStability = residentParticleScaleStabilityDiagnostics({
    g2pReconstruction,
    compactGpuSummary,
    readbackMode
  });
  if (compactGpuSummary?.compactGpuSummaryAvailable) {
    return {
      particleCount: compactGpuSummary.particleCount,
      gridNodeCount: compactGpuSummary.gridNodeCount,
      activeGridNodeCount: compactGpuSummary.activeGridNodeCount,
      sourceMassKg: compactGpuSummary.sourceMassKg,
      nextMassKg: compactGpuSummary.nextMassKg,
      massDeltaKg: compactGpuSummary.massDeltaKg,
      sourceMomentumKgMPerS: compactGpuSummary.sourceMomentumKgMPerS,
      nextMomentumKgMPerS: compactGpuSummary.nextMomentumKgMPerS,
      momentumDeltaKgMPerS: compactGpuSummary.momentumDeltaKgMPerS,
      sourceCenterOfMassM: compactGpuSummary.sourceCenterOfMassM,
      nextCenterOfMassM: compactGpuSummary.nextCenterOfMassM,
      centerOfMassDeltaM: compactGpuSummary.centerOfMassDeltaM,
      sourcePositionBoundsM: compactGpuSummary.sourcePositionBoundsM,
      nextPositionBoundsM: compactGpuSummary.nextPositionBoundsM,
      cohortDiagnostics: compactGpuSummary.cohortDiagnostics ?? null,
      cohortSummaryAvailable: compactGpuSummary.cohortSummaryAvailable ?? false,
      maxSpeedMPerS: compactGpuSummary.maxSpeedMPerS,
      maxDisplacementM: compactGpuSummary.maxDisplacementM,
      minVolumeRatioJ: compactGpuSummary.minVolumeRatioJ,
      maxVolumeRatioJ: compactGpuSummary.maxVolumeRatioJ,
      phaseMassKg: compactGpuSummary.phaseMassKg,
      temperatureMassWeightedMeanK: compactGpuSummary.temperatureMassWeightedMeanK,
      minTemperatureK: compactGpuSummary.minTemperatureK,
      maxTemperatureK: compactGpuSummary.maxTemperatureK,
      thermalReadyCount: compactGpuSummary.thermalReadyCount,
      thermalProblemCount: compactGpuSummary.thermalProblemCount,
      finiteTemperatureCount: compactGpuSummary.finiteTemperatureCount,
      phaseMassTotalKg: compactGpuSummary.phaseMassTotalKg,
      thermalPhaseSummaryAvailable: compactGpuSummary.thermalPhaseSummaryAvailable,
      thermalSummaryStatus: compactGpuSummary.thermalSummaryStatus,
      readbackMode,
      compactGpuSummaryAvailable: true,
      compactGpuSummaryStatus: compactGpuSummary.status,
      compactGpuSummaryReadbackMode: compactGpuSummary.readbackMode,
      compactSummaryScope: compactGpuSummary.summaryScope ?? null,
      activeGridNodeCountAvailable: compactGpuSummary.activeGridNodeCountAvailable ?? null,
      activeGridNodeSummaryStatus: compactGpuSummary.activeGridNodeSummaryStatus ?? null,
      gridNodeScanCount: compactGpuSummary.gridNodeScanCount ?? null,
      gridNodeScanSkipped: compactGpuSummary.gridNodeScanSkipped === true,
      compactReadbackByteLength: compactGpuSummary.compactReadbackByteLength ?? 0,
      compactSummaryReductionStrategy: compactGpuSummary.reductionStrategy ?? null,
      compactSummaryTiming: compactGpuSummary.timing ?? null,
      compactSummaryMapAsyncWaitMs: compactGpuSummary.mapAsyncWaitMs ?? compactGpuSummary.timing?.mapAsyncWaitMs ?? null,
      compactSummaryQueueFenceAttribution: compactGpuSummary.queueFenceAttribution ?? compactGpuSummary.timing?.queueFenceAttribution ?? null,
      activeGridDispatchPlanStatus: compactGpuSummary.activeGridDispatchPlan?.status ?? null,
      activeGridDispatchPlanSource: compactGpuSummary.activeGridDispatchPlan?.source ?? null,
      activeGridDispatchPlanDispatchArgsBufferRetained: compactGpuSummary.activeGridDispatchPlan?.dispatchArgsBufferRetained ?? false,
      activeGridDispatchPlanDispatchArgsBufferByteLength: compactGpuSummary.activeGridDispatchPlan?.dispatchArgsBufferByteLength ?? 0,
      activeGridDispatchPlanMetadataBufferRetained: compactGpuSummary.activeGridDispatchPlan?.metadataBufferRetained ?? false,
      activeGridDispatchPlanMetadataBufferByteLength: compactGpuSummary.activeGridDispatchPlan?.metadataBufferByteLength ?? 0,
      ...topologyDiagnostics,
      ...particleScaleStability,
      ...pressureInterfaceGridForce,
      ...wallBarrierContact,
      ...reactionSummary,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  }
  if (readbackMode === NO_FULL_READBACK_MODE) {
    return {
      particleCount: sphParticleState.particleCount,
      gridNodeCount: gridUpdate?.gridNodeCount ?? p2gGridProjection?.gridNodeCount ?? 0,
      activeGridNodeCount: null,
      sourceMassKg: null,
      nextMassKg: null,
      massDeltaKg: null,
      sourceMomentumKgMPerS: null,
      nextMomentumKgMPerS: null,
      momentumDeltaKgMPerS: null,
      sourceCenterOfMassM: null,
      nextCenterOfMassM: null,
      centerOfMassDeltaM: null,
      sourcePositionBoundsM: null,
      nextPositionBoundsM: null,
      maxSpeedMPerS: null,
      maxDisplacementM: null,
      minVolumeRatioJ: null,
      maxVolumeRatioJ: null,
      phaseMassKg: null,
      temperatureMassWeightedMeanK: null,
      minTemperatureK: null,
      maxTemperatureK: null,
      thermalReadyCount: null,
      thermalProblemCount: null,
      finiteTemperatureCount: null,
      phaseMassTotalKg: null,
      thermalPhaseSummaryAvailable: false,
      thermalSummaryStatus: compactGpuSummary?.thermalSummaryStatus ?? null,
      readbackMode,
      compactGpuSummaryAvailable: false,
      compactGpuSummaryStatus: compactGpuSummary?.status ?? 'not-run',
      compactGpuSummaryReason: compactGpuSummary?.reason ?? null,
      compactGpuSummaryReadbackMode: compactGpuSummary?.readbackMode ?? null,
      compactSummaryScope: compactGpuSummary?.summaryScope ?? null,
      activeGridNodeCountAvailable: compactGpuSummary?.activeGridNodeCountAvailable ?? null,
      activeGridNodeSummaryStatus: compactGpuSummary?.activeGridNodeSummaryStatus ?? null,
      gridNodeScanCount: compactGpuSummary?.gridNodeScanCount ?? null,
      gridNodeScanSkipped: compactGpuSummary?.gridNodeScanSkipped === true,
      compactReadbackByteLength: compactGpuSummary?.compactReadbackByteLength ?? 0,
      compactSummaryReductionStrategy: compactGpuSummary?.reductionStrategy ?? null,
      compactSummaryTiming: compactGpuSummary?.timing ?? null,
      compactSummaryMapAsyncWaitMs: compactGpuSummary?.mapAsyncWaitMs ?? compactGpuSummary?.timing?.mapAsyncWaitMs ?? null,
      compactSummaryQueueFenceAttribution: compactGpuSummary?.queueFenceAttribution ?? compactGpuSummary?.timing?.queueFenceAttribution ?? null,
      activeGridDispatchPlanStatus: compactGpuSummary?.activeGridDispatchPlan?.status ?? null,
      activeGridDispatchPlanSource: compactGpuSummary?.activeGridDispatchPlan?.source ?? null,
      activeGridDispatchPlanDispatchArgsBufferRetained: compactGpuSummary?.activeGridDispatchPlan?.dispatchArgsBufferRetained ?? false,
      activeGridDispatchPlanDispatchArgsBufferByteLength: compactGpuSummary?.activeGridDispatchPlan?.dispatchArgsBufferByteLength ?? 0,
      activeGridDispatchPlanMetadataBufferRetained: compactGpuSummary?.activeGridDispatchPlan?.metadataBufferRetained ?? false,
      activeGridDispatchPlanMetadataBufferByteLength: compactGpuSummary?.activeGridDispatchPlan?.metadataBufferByteLength ?? 0,
      ...topologyDiagnostics,
      ...particleScaleStability,
      ...pressureInterfaceGridForce,
      ...wallBarrierContact,
      ...reactionSummary,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  }
  const particleSummary = summarizeParticles({
    sourceState: sphParticleState.state,
    sourceMechanics: mlsMpmParticleState.mechanics,
    nextState: g2pReconstruction?.state,
    nextMechanics: g2pReconstruction?.mechanics,
    particleCount: sphParticleState.particleCount
  });
  return {
    particleCount: sphParticleState.particleCount,
    gridNodeCount: gridUpdate?.gridNodeCount ?? p2gGridProjection?.gridNodeCount ?? 0,
    activeGridNodeCount: summarizeActiveGridNodes(gridUpdate),
    ...particleSummary,
    phaseMassKg: null,
    temperatureMassWeightedMeanK: null,
    minTemperatureK: null,
    maxTemperatureK: null,
    thermalReadyCount: null,
    thermalProblemCount: null,
    finiteTemperatureCount: null,
    phaseMassTotalKg: null,
    thermalPhaseSummaryAvailable: false,
    thermalSummaryStatus: compactGpuSummary?.thermalSummaryStatus ?? null,
    readbackMode,
    compactGpuSummaryAvailable: false,
    compactGpuSummaryStatus: compactGpuSummary?.status ?? 'not-run',
    compactGpuSummaryReason: compactGpuSummary?.reason ?? null,
    compactGpuSummaryReadbackMode: compactGpuSummary?.readbackMode ?? null,
    compactSummaryScope: compactGpuSummary?.summaryScope ?? null,
    activeGridNodeCountAvailable: compactGpuSummary?.activeGridNodeCountAvailable ?? null,
    activeGridNodeSummaryStatus: compactGpuSummary?.activeGridNodeSummaryStatus ?? null,
    gridNodeScanCount: compactGpuSummary?.gridNodeScanCount ?? null,
    gridNodeScanSkipped: compactGpuSummary?.gridNodeScanSkipped === true,
    compactReadbackByteLength: compactGpuSummary?.compactReadbackByteLength ?? 0,
    compactSummaryReductionStrategy: compactGpuSummary?.reductionStrategy ?? null,
    compactSummaryTiming: compactGpuSummary?.timing ?? null,
    compactSummaryMapAsyncWaitMs: compactGpuSummary?.mapAsyncWaitMs ?? compactGpuSummary?.timing?.mapAsyncWaitMs ?? null,
    compactSummaryQueueFenceAttribution: compactGpuSummary?.queueFenceAttribution ?? compactGpuSummary?.timing?.queueFenceAttribution ?? null,
    activeGridDispatchPlanStatus: compactGpuSummary?.activeGridDispatchPlan?.status ?? null,
    activeGridDispatchPlanSource: compactGpuSummary?.activeGridDispatchPlan?.source ?? null,
    activeGridDispatchPlanDispatchArgsBufferRetained: compactGpuSummary?.activeGridDispatchPlan?.dispatchArgsBufferRetained ?? false,
    activeGridDispatchPlanDispatchArgsBufferByteLength: compactGpuSummary?.activeGridDispatchPlan?.dispatchArgsBufferByteLength ?? 0,
    activeGridDispatchPlanMetadataBufferRetained: compactGpuSummary?.activeGridDispatchPlan?.metadataBufferRetained ?? false,
    activeGridDispatchPlanMetadataBufferByteLength: compactGpuSummary?.activeGridDispatchPlan?.metadataBufferByteLength ?? 0,
    ...topologyDiagnostics,
    ...particleScaleStability,
    ...pressureInterfaceGridForce,
    ...wallBarrierContact,
    ...reactionSummary,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function stageStatus(stage) {
  return stage?.webgpuStatus?.status || stage?.status || 'missing';
}

function executionBackend(stages) {
  const backends = stages.map((stage) => stage?.backend || 'missing');
  if (backends.every((backend) => backend === 'webgpu')) return 'webgpu';
  if (backends.every((backend) => backend === 'cpu-reference')) return 'cpu-reference';
  return 'mixed-fallback';
}

function hasRetainedStageBuffers({ p2gGridProjection, gridUpdate }) {
  return Boolean(
    (p2gGridProjection?.gpuResult?.gridBuffer || p2gGridProjection?.gridBuffer)
    && (gridUpdate?.gpuResult?.updatedGridBuffer || gridUpdate?.updatedGridBuffer)
  );
}

function retainedG2pOutputBuffers(g2pReconstruction) {
  const source = g2pReconstruction?.gpuResult || g2pReconstruction;
  return {
    stateBuffer: source?.stateBuffer || null,
    mechanicsBuffer: source?.mechanicsBuffer || null,
    stateBufferByteLength: source?.stateBufferByteLength || 0,
    mechanicsBufferByteLength: source?.mechanicsBufferByteLength || 0,
    destroyOutputParticleBuffers: source?.destroyOutputParticleBuffers || null
  };
}

function retainedThermalOutputBuffers(thermalStep) {
  const source = thermalStep?.result || thermalStep;
  return {
    stateBuffer: source?.stateBuffer || null,
    thermoBuffer: source?.thermoBuffer || null,
    stateBufferByteLength: source?.stateBufferByteLength || 0,
    thermoBufferByteLength: source?.thermoBufferByteLength || 0,
    destroyOutputParticleBuffers: source?.destroyOutputParticleBuffers || null
  };
}

function thermalPhaseTransitionDiagnostics(thermalStep) {
  const source = thermalStep?.result || thermalStep;
  if (!source) {
    return {
      thermalPhaseTransitionStatus: null,
      thermalPhaseTransitionCount: 0,
      thermalPhaseTransitionRowsRetained: false
    };
  }
  const explicitCount = Number(source.phaseTransitionCount ?? source.phaseChangeCount);
  const phaseTransitions = Array.isArray(source.phaseTransitions) ? source.phaseTransitions : [];
  const count = Number.isFinite(explicitCount)
    ? Math.max(0, Math.round(explicitCount))
    : phaseTransitions.length;
  const status = source.thermalPhaseTransitionStatus
    || source.phaseTransitionStatus
    || source.phaseChangeStatus
    || (count > 0 ? 'thermal-phase-transition-detected' : 'thermal-phase-transition-not-detected');
  return {
    thermalPhaseTransitionStatus: status,
    thermalPhaseTransitionCount: count,
    thermalPhaseTransitionRowsRetained: Boolean(source.stateBuffer && source.thermoBuffer),
    thermalPhaseTransitionSourcePhaseId: source.phaseTransitionSourcePhaseId ?? source.sourcePhaseId ?? null,
    thermalPhaseTransitionNextPhaseId: source.phaseTransitionNextPhaseId ?? source.nextPhaseId ?? null
  };
}

function retainedReactionOutputBuffers(reactionStep) {
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
    destroyOutputParticleBuffers: source?.destroyOutputParticleBuffers || null
  };
}

function retainedMechanicsRefreshOutputBuffers(mechanicsRefreshStep) {
  const source = mechanicsRefreshStep?.result || mechanicsRefreshStep;
  return {
    mechanicsBuffer: source?.mechanicsBuffer || null,
    mechanicsBufferByteLength: source?.mechanicsBufferByteLength || 0,
    destroyOutputParticleBuffers: source?.destroyOutputParticleBuffers || null
  };
}

function estimatedPackedBytes(source, {
  valuesKey,
  byteLengthKey,
  strideBytesKey,
  count,
  fallbackStrideFloats
} = {}) {
  const explicitByteLength = finiteNumber(source?.[byteLengthKey] ?? source?.[valuesKey]?.byteLength, -1);
  if (explicitByteLength >= 0) return Math.max(0, Math.round(explicitByteLength));
  const strideBytes = finiteNumber(
    source?.[strideBytesKey],
    fallbackStrideFloats * Float32Array.BYTES_PER_ELEMENT
  );
  return Math.max(0, Math.round(count * Math.max(0, strideBytes)));
}

function estimateResidentGpuLaneCopyBudget({
  sphParticleState,
  mlsMpmParticleState,
  sphParticleUpload = null,
  mlsMpmParticleUpload = null,
  readbackMode = FULL_READBACK_MODE
} = {}) {
  const sphCount = Math.max(0, Math.round(finiteNumber(sphParticleState?.particleCount, 0)));
  const mlsCount = Math.max(0, Math.round(finiteNumber(mlsMpmParticleState?.particleCount, sphCount)));
  const sphStateBytes = estimatedPackedBytes(sphParticleState, {
    valuesKey: 'state',
    byteLengthKey: 'stateBufferByteLength',
    strideBytesKey: 'stateStrideBytes',
    count: sphCount,
    fallbackStrideFloats: SPH_GPU_PARTICLE_STATE_FLOATS
  });
  const sphThermoBytes = estimatedPackedBytes(sphParticleState, {
    valuesKey: 'thermo',
    byteLengthKey: 'thermoBufferByteLength',
    strideBytesKey: 'thermoStrideBytes',
    count: sphCount,
    fallbackStrideFloats: SPH_GPU_PARTICLE_THERMO_FLOATS
  });
  const mechanicsBytes = estimatedPackedBytes(mlsMpmParticleState, {
    valuesKey: 'mechanics',
    byteLengthKey: 'mechanicsBufferByteLength',
    strideBytesKey: 'mechanicsStrideBytes',
    count: mlsCount,
    fallbackStrideFloats: MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS
  });
  const uploadBytes = (sphParticleUpload?.status === 'webgpu-uploaded' ? 0 : (sphStateBytes + sphThermoBytes))
    + (mlsMpmParticleUpload?.status === 'webgpu-uploaded' ? 0 : mechanicsBytes);
  const compactSummaryBytes = readbackMode === NO_FULL_READBACK_MODE ? COMPACT_SUMMARY_READBACK_BYTES : 0;
  return {
    schema: 'peercompute.compute.gpu-resident-lane-copy-budget.v0',
    uploadBytes,
    readbackBytes: readbackMode === NO_FULL_READBACK_MODE ? compactSummaryBytes : (sphStateBytes + sphThermoBytes + mechanicsBytes),
    retainedBytes: sphStateBytes + sphThermoBytes + mechanicsBytes,
    compactSummaryBytes,
    fullReadbackReason: readbackMode === NO_FULL_READBACK_MODE ? null : 'resident-step-full-readback-mode'
  };
}

function acquireResidentGpuLaneLease(manager, spec) {
  if (!manager) return null;
  if (typeof manager.acquireGpuResidentLaneLease === 'function') return manager.acquireGpuResidentLaneLease(spec);
  if (typeof manager.acquireLease === 'function') return manager.acquireLease(spec);
  throw new Error('GPU resident lane manager must expose acquireGpuResidentLaneLease() or acquireLease()');
}

function completeResidentGpuLaneLease(manager, leaseId, options) {
  if (!manager || !leaseId) return null;
  if (typeof manager.completeGpuResidentLaneLease === 'function') return manager.completeGpuResidentLaneLease(leaseId, options);
  if (typeof manager.completeLease === 'function') return manager.completeLease(leaseId, options);
  throw new Error('GPU resident lane manager must expose completeGpuResidentLaneLease() or completeLease()');
}

function rejectResidentGpuLaneLease(manager, leaseId, reason) {
  if (!manager || !leaseId) return null;
  if (typeof manager.rejectGpuResidentLaneLease === 'function') return manager.rejectGpuResidentLaneLease(leaseId, reason);
  if (typeof manager.rejectLease === 'function') return manager.rejectLease(leaseId, reason);
  return null;
}

function queueEvidenceFromResidentStep(step) {
  const retainedNoFullWebGpuChain = Boolean(
    step?.backend === 'webgpu'
    && step?.readbackMode === NO_FULL_READBACK_MODE
    && (
      step?.normalHotLoopReadbackFree === true
      || step?.residentBuffersRetained === true
      || step?.nextParticleUploads?.sphParticleUpload?.stateBuffer
      || step?.nextParticleUploads?.mlsMpmParticleUpload?.mechanicsBuffer
    )
  );
  const fusedQueueFenceStatus =
    step?.fusedResidentSequence?.queueFenceStatus
    ?? step?.stageTiming?.queueFenceStatus?.fusedMechanicsSequence
    ?? null;
  const fusedQueueFenceMethod =
    step?.fusedResidentSequence?.queueFenceMethod
    ?? step?.stageTiming?.queueFenceMethod?.fusedMechanicsSequence
    ?? null;
  if (fusedQueueFenceStatus === 'complete') {
    return {
      status: 'queue-work-completed',
      method: fusedQueueFenceMethod || 'queue.onSubmittedWorkDone',
      fenceSatisfied: true,
      satisfactionReason: 'fused-resident-mechanics-sequence-queue-fence-completed'
    };
  }
  const candidates = [
    step?.compactGpuSummary,
    step?.residentProductMass,
    step?.reactionStep?.result || step?.reactionStep,
    step?.mechanicsRefreshStep?.result || step?.mechanicsRefreshStep,
    step?.thermalStep?.result || step?.thermalStep,
    step?.g2pReconstruction,
    step?.gridUpdate,
    step?.p2gGridProjection
  ];
  let firstQueueEvidence = null;
  for (const candidate of candidates) {
    const status = candidate?.queueCompletionStatus
      ?? candidate?.productEventMergeQueueCompletionStatus
      ?? candidate?.gpuResult?.queueCompletionStatus
      ?? null;
    const method = candidate?.queueCompletionMethod
      ?? candidate?.productEventMergeQueueCompletionMethod
      ?? candidate?.gpuResult?.queueCompletionMethod
      ?? null;
    if (status || method) {
      const resolvedStatus = status || 'queue-work-completed';
      const resolvedMethod = method || 'queue.onSubmittedWorkDone';
      const evidence = {
        status: resolvedStatus,
        method: resolvedMethod
      };
      if (resolvedStatus === 'queue-submitted-cleanup-deferred' && retainedNoFullWebGpuChain) {
        evidence.fenceSatisfied = true;
        evidence.satisfactionReason =
          'retained-webgpu-no-full-readback-chain-submitted-before-deferred-cleanup';
      }
      if (!firstQueueEvidence) firstQueueEvidence = evidence;
      if (evidence.fenceSatisfied === true || residentStepFenceSatisfied(resolvedStatus)) return evidence;
    }
  }
  if (firstQueueEvidence) return firstQueueEvidence;
  if (step?.backend === 'webgpu') {
    return step.readbackMode === NO_FULL_READBACK_MODE
      ? { status: 'queue-work-completed', method: 'resident-step-retained-webgpu-chain' }
      : { status: 'readback-map-completed', method: 'resident-step-readback' };
  }
  return { status: 'gpu-fence-not-submitted', method: null };
}

function retainedBufferRefsFromResidentStep(step) {
  const refs = [];
  if (step?.p2gGridProjection?.gpuResult?.gridBuffer || step?.p2gGridProjection?.gridBuffer) refs.push('p2g-grid-buffer');
  if (step?.gridUpdate?.gpuResult?.updatedGridBuffer || step?.gridUpdate?.updatedGridBuffer) refs.push('updated-grid-buffer');
  if (step?.nextParticleUploads?.sphParticleUpload?.stateBuffer) refs.push('sph-state-buffer');
  if (step?.nextParticleUploads?.sphParticleUpload?.thermoBuffer) refs.push('sph-thermo-buffer');
  if (step?.nextParticleUploads?.mlsMpmParticleUpload?.mechanicsBuffer) refs.push('mls-mpm-mechanics-buffer');
  if (step?.residentProductMass?.productEventBufferRetained) refs.push('resident-product-mass-buffer');
  if (step?.compactGpuSummary?.compactSummaryBufferAuthority) refs.push('compact-summary-diagnostics');
  return [...new Set(refs)];
}

function residentStepFenceSatisfied(status) {
  return [
    'gpu-fence-completed',
    'queue-work-completed',
    'readback-map-completed',
    'ordered-before-consumer-queue-completed'
  ].includes(String(status || ''));
}

export function createMlsMpmResidentStepGpuFenceReport(step, requirement = {}) {
  const queueEvidence = queueEvidenceFromResidentStep(step);
  const status = queueEvidence.status || 'gpu-fence-report-missing';
  const method = queueEvidence.method || null;
  const retainedBufferRefs = retainedBufferRefsFromResidentStep(step);
  const fenceSatisfied = queueEvidence.fenceSatisfied === true
    || residentStepFenceSatisfied(status);
  return {
    schema: PEERCOMPUTE_GPU_FENCE_REPORT_SCHEMA,
    status,
    method,
    fenceSatisfied,
    required: requirement?.required !== false,
    laneId: requirement?.laneId || requirement?.gpuLaneId || null,
    stateKey: requirement?.stateKey || requirement?.gpuStateKey || null,
    queueFencePolicy: requirement?.queueFencePolicy || requirement?.fencePolicy || 'queue.onSubmittedWorkDone-before-admission',
    queueCompletionStatus: status,
    queueCompletionMethod: method,
    retainedBufferRefs,
    source: 'ulg-mls-mpm-resident-step-compute-task',
    backend: step?.backend || null,
    readbackMode: step?.readbackMode || null,
    satisfactionReason: queueEvidence.satisfactionReason || null,
    step: step?.step ?? null,
    sequence: step?.sequence ?? null
  };
}

function compactGpuFenceForStateDelta(gpuFence = null) {
  if (!gpuFence || typeof gpuFence !== 'object') return null;
  return {
    schema: gpuFence.schema || PEERCOMPUTE_GPU_FENCE_REPORT_SCHEMA,
    status: gpuFence.status || null,
    method: gpuFence.method || null,
    fenceSatisfied: gpuFence.fenceSatisfied === true,
    required: gpuFence.required === true,
    laneId: gpuFence.laneId || gpuFence.gpuLaneId || null,
    stateKey: gpuFence.stateKey || gpuFence.gpuStateKey || null,
    queueFencePolicy: gpuFence.queueFencePolicy || gpuFence.fencePolicy || null,
    queueCompletionStatus: gpuFence.queueCompletionStatus || null,
    queueCompletionMethod: gpuFence.queueCompletionMethod || null,
    retainedBufferRefs: [...(gpuFence.retainedBufferRefs || [])],
    source: gpuFence.source || null
  };
}

function compactResidentStepSummaryForStateDelta(summary = null) {
  if (!summary || typeof summary !== 'object') return null;
  return {
    schema: summary.schema || 'peercompute.ulg.mls-mpm-resident-step-sequence-summary.v0',
    stepIndex: summary.stepIndex ?? null,
    backend: summary.backend ?? null,
    status: summary.status ?? null,
    readbackMode: summary.readbackMode ?? null,
    normalHotLoopReadbackFree: summary.normalHotLoopReadbackFree === true,
    gpuAuthoritativeState: summary.gpuAuthoritativeState === true,
    renderStateReadbackAvailable: summary.renderStateReadbackAvailable === true,
    compactSummaryAuthority: summary.compactSummaryAuthority ?? null,
    compactSummaryAdmissionStatus: summary.compactSummaryAdmissionStatus ?? null,
    compactSummaryAuthoritativeMutation: summary.compactSummaryAuthoritativeMutation === true,
    diagnostics: summary.diagnostics && typeof summary.diagnostics === 'object'
      ? {
          particleCount: summary.diagnostics.particleCount ?? null,
          sourceMassKg: summary.diagnostics.sourceMassKg ?? null,
          nextMassKg: summary.diagnostics.nextMassKg ?? null,
          massDeltaKg: summary.diagnostics.massDeltaKg ?? null,
          maxDisplacementM: summary.diagnostics.maxDisplacementM ?? null,
          maxSpeedMPerS: summary.diagnostics.maxSpeedMPerS ?? null,
          reactionResidentProductMassStatus: summary.diagnostics.reactionResidentProductMassStatus ?? null,
          pressureInterfaceForceApplicationStatus: summary.diagnostics.pressureInterfaceForceApplicationStatus ?? null,
          residentAuthorityLedgerStatus: summary.diagnostics.residentAuthorityLedgerStatus ?? null,
          residentAuthorityWarnings: [...(summary.diagnostics.residentAuthorityWarnings || [])],
          residentAuthorityBlockers: [...(summary.diagnostics.residentAuthorityBlockers || [])],
          residentBufferLeaseLedgerStatus: summary.diagnostics.residentBufferLeaseLedgerStatus ?? null,
          gpuResidentLaneFenceSatisfied: summary.diagnostics.gpuResidentLaneFenceSatisfied === true
        }
      : null
  };
}

export function createMlsMpmResidentStepsCommitDelta(execution = {}, {
  taskId = null,
  scope = 'ulg-sph-resident-pass-dag',
  stateKey = null,
  lawGraphNode = null,
  outputFamilies = [],
  gpuResidentLane = null,
  residentSequenceLaneContract = null
} = {}) {
  const stepSummaries = Array.isArray(execution?.stepSummaries) ? execution.stepSummaries : [];
  const finalStepSummary = stepSummaries.length
    ? stepSummaries[stepSummaries.length - 1]
    : summarizeResidentStepForSequence(execution?.finalStep || execution, Math.max(0, stepSummaries.length - 1));
  const gpuFence = compactGpuFenceForStateDelta(execution?.gpuFence || execution?.gpuFenceReport || null);
  const resolvedStateKey = stateKey || gpuFence?.stateKey || gpuResidentLane?.stateKey || null;
  const completedStepCount = Math.max(0, Math.round(finiteNumber(execution?.completedStepCount, stepSummaries.length)));
  const version = Math.max(
    0,
    Math.round(finiteNumber(
      execution?.finalStep?.step
        ?? execution?.finalStep?.sequence
        ?? finalStepSummary?.stepIndex
        ?? completedStepCount,
      completedStepCount
    ))
  );
  return {
    schema: ULG_MLS_MPM_RESIDENT_STEPS_COMMIT_DELTA_SCHEMA,
    taskId: taskId || `ulg:sph-resident-steps:${resolvedStateKey || 'local'}`,
    scope,
    version,
    timestamp: Date.now(),
    payload: {
      schema: ULG_MLS_MPM_RESIDENT_STEPS_STATE_DELTA_SCHEMA,
      status: execution?.status || 'resident-steps-delta-ready',
      stateKey: resolvedStateKey,
      backend: execution?.backend || null,
      readbackMode: execution?.readbackMode || execution?.finalStep?.readbackMode || null,
      requestedReadbackMode: execution?.requestedReadbackMode || null,
      completedStepCount,
      continuationAvailable: execution?.continuationAvailable === true,
      continuedFromResidentState: execution?.continuedFromResidentState === true,
      residentSourceMode: execution?.residentSourceMode || null,
      lawGraphNode: lawGraphNode || execution?.lawGraphNode || null,
      outputFamilies: [...(outputFamilies || [])],
      gpuFence,
      retainedBufferRefs: [...(gpuFence?.retainedBufferRefs || [])],
      gpuResidentLaneRequirement: gpuResidentLane || execution?.gpuResidentLaneRequirement || null,
      residentSequenceLaneContract: residentSequenceLaneContract || execution?.residentSequenceLaneContract || null,
      finalStep: compactResidentStepSummaryForStateDelta(finalStepSummary),
      stepSummaries: stepSummaries.slice(-4).map((summary) => compactResidentStepSummaryForStateDelta(summary)),
      normalHotLoopReadbackFree: execution?.finalStep?.normalHotLoopReadbackFree === true,
      gpuAuthoritativeState: execution?.finalStep?.gpuAuthoritativeState === true,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    }
  };
}

function attachResidentGpuLaneExecution(step, { lease = null, execution = null, error = null } = {}) {
  const gpuFence = execution?.gpuFence || execution?.lease?.gpuFence || null;
  step.gpuResidentLane = {
    schema: ULG_MLS_MPM_RESIDENT_GPU_LANE_ADAPTER_SCHEMA,
    status: error ? 'gpu-resident-lane-error' : (execution ? 'gpu-resident-lane-completed' : (lease ? 'gpu-resident-lane-lease-active' : 'gpu-resident-lane-not-configured')),
    lease,
    execution,
    gpuFence,
    error: error ? (error instanceof Error ? error.message : String(error)) : null
  };
  step.gpuResidentLaneStatus = step.gpuResidentLane.status;
  step.gpuResidentLaneLeaseId = lease?.leaseId || execution?.lease?.leaseId || null;
  step.gpuResidentLaneFenceStatus = gpuFence?.status || null;
  step.gpuResidentLaneFenceSatisfied = gpuFence?.fenceSatisfied === true;
  step.gpuResidentLaneRetainedBufferRefs = [...(gpuFence?.retainedBufferRefs || lease?.retainedBufferRefs || [])];
  if (step.diagnostics) {
    step.diagnostics.gpuResidentLaneStatus = step.gpuResidentLaneStatus;
    step.diagnostics.gpuResidentLaneLeaseId = step.gpuResidentLaneLeaseId;
    step.diagnostics.gpuResidentLaneFenceStatus = step.gpuResidentLaneFenceStatus;
    step.diagnostics.gpuResidentLaneFenceSatisfied = step.gpuResidentLaneFenceSatisfied;
    step.diagnostics.gpuResidentLaneRetainedBufferRefCount = step.gpuResidentLaneRetainedBufferRefs.length;
  }
  return step;
}

function computeResidentLaneTaskCopyBudget({
  sphParticleState,
  mlsMpmParticleState,
  sphParticleUpload = null,
  mlsMpmParticleUpload = null,
  readbackMode = FULL_READBACK_MODE,
  gpuResidentLaneCopyBudget = null,
  copyBudget = null
} = {}) {
  if (copyBudget && typeof copyBudget === 'object') return { ...copyBudget };
  if (gpuResidentLaneCopyBudget && typeof gpuResidentLaneCopyBudget === 'object') return { ...gpuResidentLaneCopyBudget };
  return estimateResidentGpuLaneCopyBudget({
    sphParticleState,
    mlsMpmParticleState,
    sphParticleUpload,
    mlsMpmParticleUpload,
    readbackMode
  });
}

export function summarizeMlsMpmResidentHotLoopBudget({
  sphParticleState,
  mlsMpmParticleState,
  sphParticleUpload = null,
  mlsMpmParticleUpload = null,
  readbackMode = FULL_READBACK_MODE,
  stepCount = 1,
  compactSummaryMode = MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_EVERY_STEP,
  activeGridDispatchPolicy = null,
  gpuResidentLaneCopyBudget = null,
  copyBudget = null
} = {}) {
  const normalizedReadbackMode = readbackMode === NO_FULL_READBACK_MODE
    ? NO_FULL_READBACK_MODE
    : FULL_READBACK_MODE;
  const normalizedStepCount = Math.max(1, Math.round(finiteNumber(stepCount, 1)));
  const normalizedCompactSummaryMode = normalizeMlsMpmResidentCompactSummaryMode(compactSummaryMode);
  const summarizedStepCount = compactSummaryStepCountForMode({
    readbackMode: normalizedReadbackMode,
    compactSummaryMode: normalizedCompactSummaryMode,
    stepCount: normalizedStepCount
  });
  const singleStepCopyBudget = computeResidentLaneTaskCopyBudget({
    sphParticleState,
    mlsMpmParticleState,
    sphParticleUpload,
    mlsMpmParticleUpload,
    readbackMode: normalizedReadbackMode,
    gpuResidentLaneCopyBudget,
    copyBudget
  });
  const normalizedCopyBudget = normalizedReadbackMode === NO_FULL_READBACK_MODE
    ? {
        ...singleStepCopyBudget,
        readbackBytes: COMPACT_SUMMARY_READBACK_BYTES * summarizedStepCount,
        compactSummaryBytes: COMPACT_SUMMARY_READBACK_BYTES * summarizedStepCount
      }
    : {
        ...singleStepCopyBudget,
        readbackBytes: singleStepCopyBudget.readbackBytes * normalizedStepCount
      };
  const activeGridEnabled = activeGridDispatchPolicy?.enabled === true;
  const noFullReadback = normalizedReadbackMode === NO_FULL_READBACK_MODE;
  const noSummaryReadback = noFullReadback
    && !compactSummaryModeRequestsReadback(normalizedCompactSummaryMode);
  const activeGridPlanOnlySummary = noFullReadback
    && normalizedCompactSummaryMode === MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_PLAN_ONLY;
  const status = noFullReadback
    ? (noSummaryReadback
        ? (activeGridPlanOnlySummary
            ? 'webgpu-ocean-hot-loop-active-grid-plan-only-budget'
            : 'webgpu-ocean-hot-loop-no-readback-budget')
        : 'webgpu-ocean-hot-loop-compact-summary-budget')
    : 'full-readback-transition-budget';
  return {
    schema: ULG_MLS_MPM_WEBGPU_OCEAN_HOT_LOOP_BUDGET_SCHEMA,
    status,
    readbackMode: normalizedReadbackMode,
    stepCount: normalizedStepCount,
    compactSummaryMode: normalizedCompactSummaryMode,
    compactSummaryStepCount: summarizedStepCount,
    normalHotLoopReadbackFree: noFullReadback,
    noSummaryReadback,
    activeGridPlanOnlySummary,
    activeGridEnabled,
    activeGridDispatchPolicyStatus: activeGridDispatchPolicy?.promotionStatus || null,
    activeGridDispatchPlanRefreshMode:
      activeGridDispatchPolicy?.activeGridDispatchPlanRefreshMode || null,
    activeGridDispatchPlanFinalOnly:
      activeGridDispatchPolicy?.activeGridDispatchPlanRefreshMode === MLS_MPM_ACTIVE_GRID_PLAN_REFRESH_MODE_FINAL_ONLY,
    uploadBytes: normalizedCopyBudget.uploadBytes ?? 0,
    readbackBytes: normalizedCopyBudget.readbackBytes ?? 0,
    retainedBytes: normalizedCopyBudget.retainedBytes ?? 0,
    compactSummaryBytes: normalizedCopyBudget.compactSummaryBytes ?? 0,
    fullReadbackReason: normalizedCopyBudget.fullReadbackReason ?? null,
    singleStepCopyBudget,
    copyBudget: normalizedCopyBudget
  };
}

function createResidentLawGraphNodeTaskRef({
  graphId = 'peercompute.ulg.local-sph-law-closure-graph',
  graphSchema = 'peercompute.ulg.law-closure-graph.v0',
  nodeId = 'ulg-mls-mpm-sph-resident-step',
  solverId = 'ulg-mls-mpm-sph-resident-step',
  runtimeTarget = 'webgpu-resident-lane',
  readFamilies = [],
  writeFamilies = [],
  requiredClosures = [
    'mechanics-material-table',
    'thermal-material-table',
    'thermal-response-graph',
    'reaction-table',
    'pressure-interface-force-rows'
  ],
  validationGates = [
    'resident-authority-ledger',
    'gpu-fence-report',
    'copy-budget',
    'compact-summary'
  ],
  cachePolicy = 'hot-gpu-lane-with-warm-closure-tables'
} = {}) {
  return {
    schema: ULG_LAW_GRAPH_NODE_TASK_REF_SCHEMA,
    graphSchema,
    graphId,
    nodeId,
    solverId,
    runtimeTarget,
    readFamilies: [...readFamilies],
    writeFamilies: [...writeFamilies],
    requiredClosures: [...requiredClosures],
    validationGates: [...validationGates],
    cachePolicy,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function createResidentGpuFenceRequirement({
  laneId,
  stateKey,
  queueFencePolicy,
  retainedBufferRefs,
  source,
  required = true
}) {
  return {
    schema: PEERCOMPUTE_GPU_FENCE_REQUIREMENT_SCHEMA,
    required: required !== false,
    laneId,
    stateKey,
    queueFencePolicy,
    retainedBufferRefs: [...retainedBufferRefs],
    source
  };
}

function createResidentActiveGridDispatchPolicy({
  requested = false,
  fusedResidentSequence = false,
  stepCount = 1,
  readbackMode = FULL_READBACK_MODE,
  compactSummaryMode = MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_EVERY_STEP,
  activeGridDispatchPlanRefreshMode = MLS_MPM_ACTIVE_GRID_PLAN_REFRESH_MODE_EVERY_STEP,
  safetyCells = DEFAULT_FUSED_ACTIVE_GRID_SAFETY_CELLS
} = {}) {
  const normalizedCompactSummaryMode = normalizeMlsMpmResidentCompactSummaryMode(compactSummaryMode);
  const normalizedActiveGridDispatchPlanRefreshMode = normalizeMlsMpmActiveGridPlanRefreshMode(
    activeGridDispatchPlanRefreshMode
  );
  const activeRequested = requested === true;
  const sequenceRequested = fusedResidentSequence === true;
  const enabled = activeRequested && sequenceRequested;
  return {
    schema: ULG_MLS_MPM_ACTIVE_GRID_DISPATCH_POLICY_SCHEMA,
    enabled,
    mode: enabled ? 'fused-resident-sequence-active-grid-aabb' : 'full-grid-dispatch',
    requested: activeRequested,
    fusedResidentSequenceRequested: sequenceRequested,
    stepCount,
    readbackMode,
    compactSummaryMode: normalizedCompactSummaryMode,
    activeGridDispatchPlanRefreshMode: normalizedActiveGridDispatchPlanRefreshMode,
    safetyCells: enabled
      ? Math.max(1, Math.round(finiteNumber(
          safetyCells == null ? DEFAULT_FUSED_ACTIVE_GRID_SAFETY_CELLS : safetyCells,
          DEFAULT_FUSED_ACTIVE_GRID_SAFETY_CELLS
        )))
      : 0,
    requiresNoFullReadback: enabled,
    requiresFinalOnlyCompactSummary: enabled,
    allowsFinalOnlyActiveGridPlanRefresh:
      normalizedActiveGridDispatchPlanRefreshMode === MLS_MPM_ACTIVE_GRID_PLAN_REFRESH_MODE_FINAL_ONLY,
    requiresFusedResidentSequence: activeRequested,
    requiresTrustworthyPositionBounds: enabled,
    requiresGridClearBeforeG2p: enabled,
    retainedGridLayout: 'full-grid-row-layout',
    authority: 'compute-manager-gpu-resident-lane-policy',
    promotionStatus: enabled
      ? 'opt-in-validation-required'
      : (activeRequested ? 'blocked-fused-resident-sequence-not-requested' : 'not-requested')
  };
}

function fusedResidentSequenceSidecarBlockers({
  thermalMaterialTable = null,
  reactionTable = null,
  pressureInterfaceForceRowsBuffer = null,
  pressureInterfaceForceSolver = null,
  residentProductMass = null
} = {}) {
  const blockers = [];
  if (thermalMaterialTable) blockers.push('thermal-sidecar');
  if (finiteNumber(reactionTable?.reactionCount, 0) > 0) blockers.push('reaction-sidecar');
  if (pressureInterfaceForceRowsBuffer) blockers.push('pressure-interface-force-rows');
  if (pressureInterfaceForceSolver) blockers.push('pressure-interface-force-solver');
  if (residentProductMass) blockers.push('resident-product-mass-sidecar');
  return blockers;
}

function uniqueStringList(values = []) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim()))];
}

function createFusedResidentSequencePreflight({
  requested = false,
  stepCount = 1,
  readbackMode = FULL_READBACK_MODE,
  compactSummaryMode = MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_EVERY_STEP,
  preferWebGpu = false,
  device = null,
  sphParticleUpload = null,
  mlsMpmParticleUpload = null,
  requestPerStepFusedNoFullMechanics = false,
  requestActiveGridFusedNoFullMechanics = false,
  customRunnerBlockers = [],
  sidecarBlockers = []
} = {}) {
  const normalizedStepCount = Math.max(1, Math.round(finiteNumber(stepCount, 1)));
  const normalizedCompactSummaryMode = normalizeMlsMpmResidentCompactSummaryMode(compactSummaryMode);
  const sequenceRequested = requested === true;
  const blockers = [];
  if (sequenceRequested) {
    if (normalizedStepCount <= 1) blockers.push('step-count-not-greater-than-one');
    if (normalizedCompactSummaryMode === MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_EVERY_STEP) {
      blockers.push('compact-summary-every-step');
    }
    if (readbackMode !== NO_FULL_READBACK_MODE) blockers.push('full-readback-requested');
    if (preferWebGpu !== true) blockers.push('webgpu-not-preferred');
    if (!(device?.createBuffer && device.queue?.writeBuffer)) blockers.push('webgpu-device-unavailable');
    if (sphParticleUpload?.status !== 'webgpu-uploaded') blockers.push('sph-particle-upload-not-resident');
    if (mlsMpmParticleUpload?.status !== 'webgpu-uploaded') blockers.push('mls-mpm-upload-not-resident');
    blockers.push(...uniqueStringList(customRunnerBlockers));
    blockers.push(...uniqueStringList(sidecarBlockers));
  }
  const uniqueBlockers = uniqueStringList(blockers);
  const sequenceRunnable = sequenceRequested && uniqueBlockers.length === 0;
  const perStepFusedMechanicsFallbackEligible = Boolean(
    sequenceRequested
    && requestPerStepFusedNoFullMechanics
    && requestActiveGridFusedNoFullMechanics
    && readbackMode === NO_FULL_READBACK_MODE
    && preferWebGpu === true
    && device?.createBuffer
    && device.queue?.writeBuffer
    && sphParticleUpload?.status === 'webgpu-uploaded'
    && mlsMpmParticleUpload?.status === 'webgpu-uploaded'
  );
  const fallbackMode = sequenceRunnable
    ? 'fused-no-full-resident-mechanics-sequence'
    : (perStepFusedMechanicsFallbackEligible
        ? 'per-step-fused-mechanics-active-grid'
        : 'per-step-resident-pass-dag');
  return {
    schema: ULG_MLS_MPM_FUSED_RESIDENT_SEQUENCE_PREFLIGHT_SCHEMA,
    status: sequenceRunnable
      ? 'fused-resident-sequence-preflight-ready'
      : (sequenceRequested ? 'blocked-fused-resident-sequence' : 'fused-resident-sequence-not-requested'),
    sequenceRequested,
    sequenceRunnable,
    stepCount: normalizedStepCount,
    readbackMode,
    compactSummaryMode: normalizedCompactSummaryMode,
    preferWebGpu: preferWebGpu === true,
    deviceReady: Boolean(device?.createBuffer && device.queue?.writeBuffer),
    residentUploadsReady: Boolean(
      sphParticleUpload?.status === 'webgpu-uploaded'
      && mlsMpmParticleUpload?.status === 'webgpu-uploaded'
    ),
    blockers: uniqueBlockers,
    sidecarBlockers: uniqueStringList(sidecarBlockers),
    customRunnerBlockers: uniqueStringList(customRunnerBlockers),
    fallbackMode,
    perStepFusedMechanicsFallbackEligible,
    activeGridFallbackRequested: requestActiveGridFusedNoFullMechanics === true,
    thermalAwareFusionRequired: uniqueBlockers.includes('thermal-sidecar'),
    reactionAwareFusionRequired: uniqueBlockers.includes('reaction-sidecar'),
    pressureInterfaceAwareFusionRequired:
      uniqueBlockers.includes('pressure-interface-force-rows')
      || uniqueBlockers.includes('pressure-interface-force-solver'),
    residentProductMassAwareFusionRequired: uniqueBlockers.includes('resident-product-mass-sidecar')
  };
}

function createResidentSequenceLaneContract({
  laneId,
  stateKey,
  domainKey = null,
  stepCount = 1,
  readbackMode = FULL_READBACK_MODE,
  compactSummaryMode = MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_EVERY_STEP,
  queueFencePolicy,
  readFamilies = [],
  writeFamilies = [],
  retainedBufferRefs = [],
  activeGridDispatchPolicy = null,
  fusedResidentSequence = false,
  sidecarBlockers = []
} = {}) {
  const normalizedStepCount = Math.max(1, Math.round(finiteNumber(stepCount, 1)));
  const normalizedCompactSummaryMode = normalizeMlsMpmResidentCompactSummaryMode(compactSummaryMode);
  const sequenceRequested = fusedResidentSequence === true;
  const normalizedSidecarBlockers = uniqueStringList(sidecarBlockers);
  const requirementBlockers = [];
  if (sequenceRequested) {
    if (normalizedStepCount <= 1) requirementBlockers.push('step-count-not-greater-than-one');
    if (readbackMode !== NO_FULL_READBACK_MODE) requirementBlockers.push('full-readback-requested');
    if (normalizedCompactSummaryMode === MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_EVERY_STEP) {
      requirementBlockers.push('compact-summary-every-step');
    }
    requirementBlockers.push(...normalizedSidecarBlockers);
  }
  const blockers = uniqueStringList(requirementBlockers);
  const sequenceRunnable = sequenceRequested
    && normalizedStepCount > 1
    && readbackMode === NO_FULL_READBACK_MODE
    && normalizedCompactSummaryMode !== MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_EVERY_STEP
    && blockers.length === 0;
  const activeGridEnabled = activeGridDispatchPolicy?.enabled === true;
  const sequenceMode = sequenceRunnable
    ? (activeGridEnabled
      ? 'fused-no-full-active-grid-mechanics-sequence'
      : 'fused-no-full-full-grid-mechanics-sequence')
    : 'per-step-resident-pass-dag';
  const fallbackMode = sequenceRunnable
    ? sequenceMode
    : (sequenceRequested && activeGridEnabled
        ? 'per-step-fused-mechanics-active-grid'
        : 'per-step-resident-pass-dag');
  return {
    schema: ULG_MLS_MPM_RESIDENT_SEQUENCE_LANE_CONTRACT_SCHEMA,
    authority: 'compute-manager-gpuhub-resident-lane-contract',
    status: sequenceRunnable
      ? 'lane-owned-fused-sequence-contract-ready'
      : (sequenceRequested ? 'blocked-fused-sequence-requirements-not-met' : 'per-step-pass-dag-contract'),
    laneId,
    stateKey,
    domainKey,
    queueFencePolicy,
    stepCount: normalizedStepCount,
    readbackMode,
    compactSummaryMode: normalizedCompactSummaryMode,
    sequenceRequested,
    sequenceRunnable,
    blockers,
    sidecarBlockers: normalizedSidecarBlockers,
    sequenceMode,
    fallbackMode,
    thermalAwareFusionRequired: blockers.includes('thermal-sidecar'),
    reactionAwareFusionRequired: blockers.includes('reaction-sidecar'),
    pressureInterfaceAwareFusionRequired:
      blockers.includes('pressure-interface-force-rows')
      || blockers.includes('pressure-interface-force-solver'),
    residentProductMassAwareFusionRequired: blockers.includes('resident-product-mass-sidecar'),
    activeGridDispatchPolicy,
    defaultEnabled: false,
    laneMustRetainBuffers: [...retainedBufferRefs],
    readFamilies: [...readFamilies],
    writeFamilies: [...writeFamilies],
    passDagStages: [
      {
        id: 'mechanics-p2g',
        lawNodeId: 'ulg-mls-mpm-mechanics-law',
        runtimeTarget: 'webgpu-compute',
        reads: ['sph-particle-state', 'mls-mpm-mechanics'],
        writes: ['mls-mpm-grid-momentum']
      },
      {
        id: 'mechanics-grid-update',
        lawNodeId: 'ulg-mls-mpm-mechanics-law',
        runtimeTarget: 'webgpu-compute',
        reads: ['mls-mpm-grid-momentum', 'pressure-interface-force-rows'],
        writes: ['mls-mpm-grid-velocity']
      },
      {
        id: 'mechanics-g2p',
        lawNodeId: 'ulg-mls-mpm-mechanics-law',
        runtimeTarget: 'webgpu-compute',
        reads: ['mls-mpm-grid-velocity', 'sph-particle-state', 'mls-mpm-mechanics'],
        writes: ['sph-particle-state', 'mls-mpm-mechanics']
      },
      {
        id: 'resident-compact-summary',
        lawNodeId: 'ulg-mls-mpm-sph-resident-pass-dag',
        runtimeTarget: 'webgpu-compute',
        reads: ['sph-particle-state', 'sph-thermo-phase', 'mls-mpm-mechanics'],
        writes: ['resident-compact-summary']
      }
    ],
    ownershipRules: [
      'single-authoritative-owner-after-each-stage',
      'same-device-hot-buffers-retained-until-fence-or-explicit-handoff',
      'state-manager-admission-required-before-authoritative-mutation',
      'scene-local-execution-must-not-become-a-parallel-scheduler'
    ],
    promotionStatus: activeGridEnabled
      ? 'active-grid-opt-in-scene-evidence-ready'
      : (sequenceRunnable ? 'fused-sequence-opt-in-evidence-ready' : 'metadata-only')
  };
}

function createResidentGpuLaneTaskDescriptor({
  laneId,
  stateKey,
  domainKey = null,
  solverId,
  owner,
  localExecution = 'inline',
  readFamilies = [],
  writeFamilies = [],
  retainedBufferRefs = [],
  queueFencePolicy,
  copyBudget,
  activeGridDispatchPolicy = null,
  residentSequenceLaneContract = null
}) {
  return {
    schema: PEERCOMPUTE_GPU_RESIDENT_LANE_TASK_SCHEMA,
    enabled: true,
    localExecution: localExecution === 'worker' ? 'worker' : 'inline',
    laneId,
    stateKey,
    domainKey,
    solverId,
    owner,
    readFamilies: [...readFamilies],
    writeFamilies: [...writeFamilies],
    retainedBufferRefs: [...retainedBufferRefs],
    queueFencePolicy,
    copyBudget: { ...copyBudget },
    activeGridDispatchPolicy,
    residentSequenceLaneContract
  };
}

export function createMlsMpmResidentStepComputeTask({
  modulePath,
  taskId = null,
  taskFamily = 'ulg-mls-mpm-sph-resident-step',
  solverId = 'ulg-mls-mpm-sph-resident-step',
  owner = 'ulg-sph-resident-step',
  lawGraphId = 'peercompute.ulg.local-sph-law-closure-graph',
  lawGraphNodeId = 'ulg-mls-mpm-sph-resident-step',
  laneId = 'ulg:sph-resident:active',
  stateKey = 'ulg:sph-resident-state',
  domainKey = null,
  localExecution = 'inline',
  queueFencePolicy = 'queue.onSubmittedWorkDone-before-admission',
  readFamilies = ['sph-particle-state', 'mls-mpm-mechanics', 'resident-product-mass', 'pressure-interface-force-rows'],
  writeFamilies = ['sph-particle-state', 'sph-thermo-phase', 'mls-mpm-mechanics', 'resident-product-mass'],
  retainedBufferRefs = ['sph-state-buffer', 'sph-thermo-buffer', 'mls-mpm-mechanics-buffer'],
  returnEnvelope = true,
  suppressCommitDelta = false,
  ...residentStepOptions
} = {}) {
  if (typeof modulePath !== 'string' || modulePath.trim() === '') {
    throw new Error('createMlsMpmResidentStepComputeTask requires a modulePath for the ULG resident step task handler');
  }
  const {
    gpuResidentLaneManager: _ignoredLaneManager,
    gpuResidentLaneId: _ignoredLaneId,
    gpuResidentLaneStateKey: _ignoredLaneStateKey,
    gpuResidentLaneDomainKey: _ignoredLaneDomainKey,
    ...taskStepOptions
  } = residentStepOptions;
  const readbackMode = taskStepOptions.readbackMode === NO_FULL_READBACK_MODE ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE;
  const hotLoopBudget = summarizeMlsMpmResidentHotLoopBudget({
    ...taskStepOptions,
    readbackMode,
    gpuResidentLaneCopyBudget: residentStepOptions.gpuResidentLaneCopyBudget
  });
  const laneCopyBudget = hotLoopBudget.copyBudget;
  const lawGraphNode = createResidentLawGraphNodeTaskRef({
    graphId: lawGraphId,
    nodeId: lawGraphNodeId,
    solverId,
    readFamilies,
    writeFamilies
  });
  lawGraphNode.hotLoopBudget = hotLoopBudget;
  const gpuFence = createResidentGpuFenceRequirement({
    laneId,
    stateKey,
    queueFencePolicy,
    retainedBufferRefs,
    source: 'ulg-mls-mpm-resident-step-compute-task'
  });
  const gpuResidentLane = createResidentGpuLaneTaskDescriptor({
    laneId,
    stateKey,
    domainKey,
    solverId,
    owner,
    localExecution,
    readFamilies,
    writeFamilies,
    retainedBufferRefs,
    queueFencePolicy,
    copyBudget: laneCopyBudget
  });
  gpuResidentLane.hotLoopBudget = hotLoopBudget;
  const id = taskId || `ulg-mls-mpm-resident-step:${finiteNumber(taskStepOptions.sphParticleState?.step ?? taskStepOptions.mlsMpmParticleState?.step, 0)}`;
  return {
    schema: ULG_MLS_MPM_RESIDENT_COMPUTE_TASK_SCHEMA,
    id,
    runtime: 'js',
    taskFamily,
    solverId,
    module: modulePath,
    exportName: 'runMlsMpmResidentStepComputeTask',
    returnEnvelope,
    suppressCommitDelta,
    residency: 'gpu-lane',
    lawGraphNode,
    readFamilies: [...readFamilies],
    writeFamilies: [...writeFamilies],
    expectedOutputFamilies: [...writeFamilies],
    webgpu: {
      residency: 'gpu-lane',
      requiresQueueFence: true,
      laneId,
      stateKey,
      domainKey,
      queueFencePolicy,
      retainedBufferRefs: [...retainedBufferRefs],
      copyBudget: { ...laneCopyBudget },
      hotLoopBudget
    },
    gpuFence,
    gpuResidentLane,
    data: {
      ...taskStepOptions,
      readbackMode,
      gpuFenceRequirement: gpuFence,
      gpuResidentLane,
      lawGraphNode,
      hotLoopBudget,
      computeTaskSchema: ULG_MLS_MPM_RESIDENT_COMPUTE_TASK_SCHEMA
    }
  };
}

export async function runMlsMpmResidentStepComputeTask(data = {}) {
  const {
    gpuResidentLaneManager: _ignoredLaneManager,
    gpuFenceRequirement = null,
    gpuResidentLane = null,
    lawGraphNode = null,
    computeTaskSchema = ULG_MLS_MPM_RESIDENT_COMPUTE_TASK_SCHEMA,
    ...residentStepOptions
  } = data || {};
  const step = await runMlsMpmResidentStepWithOptionalWebGpu({
    ...residentStepOptions,
    gpuResidentLaneManager: null
  });
  const gpuFence = createMlsMpmResidentStepGpuFenceReport(
    step,
    gpuFenceRequirement || gpuResidentLane || {}
  );
  return {
    ...step,
    schema: step?.schema || ULG_MLS_MPM_GPU_RESIDENT_STEP_SCHEMA,
    computeTaskResultSchema: ULG_MLS_MPM_RESIDENT_COMPUTE_TASK_RESULT_SCHEMA,
    computeTaskSchema,
    lawGraphNode,
    gpuFence,
    gpuFenceReport: gpuFence,
    gpuResidentLaneRequirement: gpuResidentLane || null
  };
}

export function submitMlsMpmResidentStepComputeTask({ computeManager, ...taskOptions } = {}) {
  if (!computeManager || typeof computeManager.submitTask !== 'function') {
    throw new Error('submitMlsMpmResidentStepComputeTask requires a ComputeManager-compatible submitTask() method');
  }
  return computeManager.submitTask(createMlsMpmResidentStepComputeTask(taskOptions));
}

export function createMlsMpmResidentStepsComputeTask({
  modulePath,
  taskId = null,
  taskFamily = 'ulg-mls-mpm-sph-resident-steps',
  solverId = 'ulg-mls-mpm-sph-resident-steps',
  owner = 'ulg-sph-resident-steps',
  lawGraphId = 'peercompute.ulg.local-sph-law-closure-graph',
  lawGraphNodeId = 'ulg-mls-mpm-sph-resident-pass-dag',
  laneId = 'ulg:sph-resident:active',
  stateKey = 'ulg:sph-resident-state',
  domainKey = null,
  localExecution = 'inline',
  queueFencePolicy = 'queue.onSubmittedWorkDone-before-admission',
  readFamilies = ['sph-particle-state', 'mls-mpm-mechanics', 'resident-product-mass', 'pressure-interface-force-rows'],
  writeFamilies = ['sph-particle-state', 'sph-thermo-phase', 'mls-mpm-mechanics', 'resident-product-mass'],
  retainedBufferRefs = ['sph-state-buffer', 'sph-thermo-buffer', 'mls-mpm-mechanics-buffer'],
  returnEnvelope = true,
  suppressCommitDelta = false,
  emitCommitDelta = true,
  commitDeltaScope = 'ulg-sph-resident-pass-dag',
  commitDeltaStateKey = null,
  ...residentStepOptions
} = {}) {
  if (typeof modulePath !== 'string' || modulePath.trim() === '') {
    throw new Error('createMlsMpmResidentStepsComputeTask requires a modulePath for the ULG resident steps task handler');
  }
  const {
    gpuResidentLaneManager: _ignoredLaneManager,
    gpuResidentLaneId: _ignoredLaneId,
    gpuResidentLaneStateKey: _ignoredLaneStateKey,
    gpuResidentLaneDomainKey: _ignoredLaneDomainKey,
    ...taskStepOptions
  } = residentStepOptions;
  const readbackMode = taskStepOptions.readbackMode === NO_FULL_READBACK_MODE ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE;
  const stepCount = Math.max(1, Math.round(finiteNumber(taskStepOptions.stepCount, 1)));
  const compactSummaryMode = normalizeMlsMpmResidentCompactSummaryMode(taskStepOptions.compactSummaryMode);
  const activeGridDispatchPlanRefreshMode = normalizeMlsMpmActiveGridPlanRefreshMode(
    taskStepOptions.activeGridDispatchPlanRefreshMode
  );
  const activeGridDispatchPolicy = createResidentActiveGridDispatchPolicy({
    requested: Boolean(taskStepOptions.fuseNoFullResidentMechanicsActiveGrid || taskStepOptions.fuseNoFullResidentActiveGrid),
    fusedResidentSequence: Boolean(taskStepOptions.fuseNoFullResidentMechanicsSequence),
    stepCount,
    readbackMode,
    compactSummaryMode,
    activeGridDispatchPlanRefreshMode,
    safetyCells: taskStepOptions.activeGridSafetyCells ?? taskStepOptions.fusedActiveGridSafetyCells
  });
  const residentSequenceSidecarBlockers = fusedResidentSequenceSidecarBlockers({
    thermalMaterialTable: taskStepOptions.thermalMaterialTable,
    reactionTable: taskStepOptions.reactionTable,
    pressureInterfaceForceRowsBuffer: taskStepOptions.pressureInterfaceForceRowsBuffer,
    pressureInterfaceForceSolver: taskStepOptions.pressureInterfaceForceSolver,
    residentProductMass: taskStepOptions.residentProductMass ?? taskStepOptions.nextParticleUploads?.residentProductMass ?? null
  });
  const residentSequenceLaneContract = createResidentSequenceLaneContract({
    laneId,
    stateKey,
    domainKey,
    stepCount,
    readbackMode,
    compactSummaryMode,
    queueFencePolicy,
    readFamilies,
    writeFamilies,
    retainedBufferRefs,
    activeGridDispatchPolicy,
    fusedResidentSequence: Boolean(taskStepOptions.fuseNoFullResidentMechanicsSequence),
    sidecarBlockers: residentSequenceSidecarBlockers
  });
  const hotLoopBudget = summarizeMlsMpmResidentHotLoopBudget({
    ...taskStepOptions,
    readbackMode,
    stepCount,
    compactSummaryMode,
    activeGridDispatchPolicy,
    gpuResidentLaneCopyBudget: residentStepOptions.gpuResidentLaneCopyBudget
  });
  const laneCopyBudget = hotLoopBudget.copyBudget;
  const lawGraphNode = createResidentLawGraphNodeTaskRef({
    graphId: lawGraphId,
    nodeId: lawGraphNodeId,
    solverId,
    readFamilies,
    writeFamilies
  });
  lawGraphNode.activeGridDispatchPolicy = activeGridDispatchPolicy;
  lawGraphNode.residentSequenceLaneContract = residentSequenceLaneContract;
  lawGraphNode.hotLoopBudget = hotLoopBudget;
  const gpuFence = createResidentGpuFenceRequirement({
    laneId,
    stateKey,
    queueFencePolicy,
    retainedBufferRefs,
    source: 'ulg-mls-mpm-resident-steps-compute-task'
  });
  const gpuResidentLane = createResidentGpuLaneTaskDescriptor({
    laneId,
    stateKey,
    domainKey,
    solverId,
    owner,
    localExecution,
    readFamilies,
    writeFamilies,
    retainedBufferRefs,
    queueFencePolicy,
    copyBudget: laneCopyBudget,
    activeGridDispatchPolicy,
    residentSequenceLaneContract
  });
  gpuResidentLane.hotLoopBudget = hotLoopBudget;
  const id = taskId || `ulg-mls-mpm-resident-steps:${finiteNumber(taskStepOptions.sphParticleState?.step ?? taskStepOptions.mlsMpmParticleState?.step, 0)}:${stepCount}`;
  return {
    schema: ULG_MLS_MPM_RESIDENT_STEPS_COMPUTE_TASK_SCHEMA,
    id,
    runtime: 'js',
    taskFamily,
    solverId,
    module: modulePath,
    exportName: 'runMlsMpmResidentStepsComputeTask',
    returnEnvelope,
    suppressCommitDelta,
    residency: 'gpu-lane',
    lawGraphNode,
    readFamilies: [...readFamilies],
    writeFamilies: [...writeFamilies],
    expectedOutputFamilies: [...writeFamilies],
    webgpu: {
      residency: 'gpu-lane',
      requiresQueueFence: true,
      laneId,
      stateKey,
      domainKey,
      queueFencePolicy,
      retainedBufferRefs: [...retainedBufferRefs],
      copyBudget: { ...laneCopyBudget },
      hotLoopBudget,
      activeGridDispatchPolicy,
      residentSequenceLaneContract
    },
    gpuFence,
    gpuResidentLane,
    data: {
      ...taskStepOptions,
      stepCount,
      readbackMode,
      compactSummaryMode,
      activeGridDispatchPlanRefreshMode,
      activeGridDispatchPolicy,
      residentSequenceLaneContract,
      hotLoopBudget,
      gpuFenceRequirement: gpuFence,
      gpuResidentLane,
      lawGraphNode,
      computeTaskSchema: ULG_MLS_MPM_RESIDENT_STEPS_COMPUTE_TASK_SCHEMA,
      computeTaskId: id,
      emitCommitDelta,
      commitDeltaScope,
      commitDeltaStateKey: commitDeltaStateKey || stateKey,
      expectedOutputFamilies: [...writeFamilies]
    }
  };
}

function createMlsMpmResidentStepsSolverTaskBridgeMetadata(baseTask, solverTask = null, {
  status = null,
  reason = null
} = {}) {
  const solverData = solverTask?.data && typeof solverTask.data === 'object' ? solverTask.data : {};
  return {
    schema: ULG_MLS_MPM_RESIDENT_STEPS_SOLVER_TASK_BRIDGE_SCHEMA,
    status: status || (solverTask ? 'solver-task-created' : 'direct-ulg-task'),
    created: Boolean(solverTask),
    reason: reason || null,
    solverTaskSchema: solverData.schema || null,
    solverId: solverTask?.solverId || baseTask?.solverId || null,
    taskFamily: solverTask?.taskFamily || baseTask?.taskFamily || null,
    runtime: solverTask?.runtime || baseTask?.runtime || null,
    module: solverTask?.module || baseTask?.module || null,
    exportName: solverTask?.exportName || baseTask?.exportName || null,
    affinityKey: solverTask?.affinityKey || null,
    warmDeltaScope: solverData.scope || solverData.solver?.warmDelta?.scope || null,
    placementHint: solverTask?.placementHint || null
  };
}

export function createMlsMpmResidentStepsSolverComputeTask({
  computeManager = null,
  ...taskOptions
} = {}) {
  const baseTask = createMlsMpmResidentStepsComputeTask(taskOptions);
  const solverRegistry = computeManager?.solverRegistry;
  if (!solverRegistry || typeof solverRegistry.createTask !== 'function') {
    const bridge = createMlsMpmResidentStepsSolverTaskBridgeMetadata(baseTask, null, {
      status: 'direct-ulg-task',
      reason: 'solver-registry-unavailable'
    });
    return {
      ...baseTask,
      peerComputeSolverTask: bridge,
      data: {
        ...baseTask.data,
        peerComputeSolverTask: bridge
      }
    };
  }

  let solverTask = null;
  try {
    const stateKey = baseTask.gpuResidentLane?.stateKey
      || baseTask.data?.commitDeltaStateKey
      || baseTask.webgpu?.stateKey
      || baseTask.id;
    solverTask = solverRegistry.createTask(baseTask.solverId, {
      id: baseTask.id,
      stateKey,
      scope: baseTask.data?.commitDeltaScope || 'ulg-sph-resident-pass-dag',
      input: {
        stateKey,
        laneId: baseTask.gpuResidentLane?.laneId || baseTask.webgpu?.laneId || null,
        domainKey: baseTask.gpuResidentLane?.domainKey || baseTask.webgpu?.domainKey || null,
        stepCount: baseTask.data?.stepCount ?? null,
        readbackMode: baseTask.data?.readbackMode || null,
        activeGridDispatchPolicy: baseTask.data?.activeGridDispatchPolicy || null,
        residentSequenceLaneContract: baseTask.data?.residentSequenceLaneContract || null,
        computeTaskSchema: baseTask.schema,
        lawGraphNodeId: baseTask.lawGraphNode?.nodeId || null
      },
      data: baseTask.data,
      webgpu: baseTask.webgpu
    });
  } catch (error) {
    const bridge = createMlsMpmResidentStepsSolverTaskBridgeMetadata(baseTask, null, {
      status: 'direct-ulg-task',
      reason: error instanceof Error ? error.message : String(error)
    });
    return {
      ...baseTask,
      peerComputeSolverTask: bridge,
      data: {
        ...baseTask.data,
        peerComputeSolverTask: bridge
      }
    };
  }

  const bridge = createMlsMpmResidentStepsSolverTaskBridgeMetadata(baseTask, solverTask);
  return {
    ...baseTask,
    ...solverTask,
    schema: baseTask.schema,
    id: baseTask.id,
    taskFamily: baseTask.taskFamily,
    solverId: baseTask.solverId,
    runtime: solverTask.runtime || baseTask.runtime,
    module: solverTask.module || baseTask.module,
    exportName: solverTask.exportName || baseTask.exportName,
    returnEnvelope: baseTask.returnEnvelope,
    suppressCommitDelta: baseTask.suppressCommitDelta,
    residency: baseTask.residency,
    lawGraphNode: baseTask.lawGraphNode,
    readFamilies: [...baseTask.readFamilies],
    writeFamilies: [...baseTask.writeFamilies],
    expectedOutputFamilies: [...baseTask.expectedOutputFamilies],
    webgpu: baseTask.webgpu,
    gpuFence: baseTask.gpuFence,
    gpuResidentLane: baseTask.gpuResidentLane,
    peerComputeSolverTask: bridge,
    data: {
      ...(solverTask.data || {}),
      ...baseTask.data,
      peerComputeSolverTask: bridge
    }
  };
}

export async function runMlsMpmResidentStepsComputeTask(data = {}) {
  const {
    gpuResidentLaneManager: _ignoredLaneManager,
    gpuFenceRequirement = null,
    gpuResidentLane = null,
    lawGraphNode = null,
    computeTaskSchema = ULG_MLS_MPM_RESIDENT_STEPS_COMPUTE_TASK_SCHEMA,
    computeTaskId = null,
    peerComputeSolverTask = null,
    activeGridDispatchPolicy = null,
    residentSequenceLaneContract = null,
    emitCommitDelta = true,
    commitDeltaScope = 'ulg-sph-resident-pass-dag',
    commitDeltaStateKey = null,
    expectedOutputFamilies = [],
    ...residentStepOptions
  } = data || {};
  const execution = await runMlsMpmResidentStepsWithOptionalWebGpu({
    ...residentStepOptions,
    gpuResidentLaneManager: null
  });
  const gpuFence = createMlsMpmResidentStepGpuFenceReport(
    execution?.finalStep || execution,
    gpuFenceRequirement || gpuResidentLane || {}
  );
  const result = {
    ...execution,
    schema: execution?.schema || ULG_MLS_MPM_GPU_RESIDENT_STEPS_EXECUTION_SCHEMA,
    computeTaskResultSchema: ULG_MLS_MPM_RESIDENT_STEPS_COMPUTE_TASK_RESULT_SCHEMA,
    computeTaskSchema,
    lawGraphNode,
    peerComputeSolverTask,
    activeGridDispatchPolicy,
    residentSequenceLaneContract,
    gpuFence,
    gpuFenceReport: gpuFence,
    gpuResidentLaneRequirement: gpuResidentLane || null
  };
  if (emitCommitDelta !== false) {
    result.commitDelta = createMlsMpmResidentStepsCommitDelta(result, {
      taskId: computeTaskId,
      scope: commitDeltaScope,
      stateKey: commitDeltaStateKey,
      lawGraphNode,
      outputFamilies: expectedOutputFamilies,
      gpuResidentLane,
      residentSequenceLaneContract
    });
  }
  return result;
}

export function submitMlsMpmResidentStepsComputeTask({ computeManager, ...taskOptions } = {}) {
  if (!computeManager || typeof computeManager.submitTask !== 'function') {
    throw new Error('submitMlsMpmResidentStepsComputeTask requires a ComputeManager-compatible submitTask() method');
  }
  return computeManager.submitTask(createMlsMpmResidentStepsSolverComputeTask({
    computeManager,
    ...taskOptions
  }));
}

function createMlsMpmMechanicsP2gStageTaskEvidence(projection = {}, {
  computeTaskId = null,
  lawGraphNode = null,
  gpuFenceRequirement = null
} = {}) {
  const backend = projection?.backend || null;
  const acceptedBackend = ['cpu', 'cpu-reference', 'webgpu'].includes(String(backend || ''));
  const pressureSuppressed = finiteNumber(projection?.internalPressureScale, 1) === 0;
  const productSuppressed = finiteNumber(projection?.residentProductMassInputProductEventCount, 0) === 0
    && !projection?.residentProductMass;
  const gridNodeStrideBytes = finiteNumber(
    projection?.gridNodeStrideBytes,
    finiteNumber(projection?.gridNodeStrideFloats, 0) * Float32Array.BYTES_PER_ELEMENT
  );
  const gridProjected = projection?.status === 'projected'
    && finiteNumber(projection?.gridNodeCount, 0) > 0
    && gridNodeStrideBytes > 0;
  const passed = Boolean(
    projection
      && acceptedBackend
      && pressureSuppressed
      && productSuppressed
      && gridProjected
  );
  return {
    schema: ULG_MLS_MPM_MECHANICS_P2G_STAGE_TASK_EVIDENCE_SCHEMA,
    passed,
    status: passed ? 'mechanics-p2g-stage-task-evidence-ready' : 'mechanics-p2g-stage-task-evidence-failed',
    reason: passed
      ? 'compute-manager-owned-p2g-stage-task-ready'
      : !acceptedBackend
        ? 'mechanics-p2g-stage-task-backend-invalid'
        : !pressureSuppressed
          ? 'mechanics-p2g-stage-task-pressure-not-suppressed'
          : !productSuppressed
            ? 'mechanics-p2g-stage-task-product-input-not-suppressed'
            : 'mechanics-p2g-stage-task-grid-output-missing',
    computeTaskId,
    lawGraphNodeId: lawGraphNode?.nodeId || 'ulg-mls-mpm-mechanics-law',
    solverId: lawGraphNode?.solverId || 'ulg-mls-mpm-mechanics-p2g-stage',
    stageId: 'p2g',
    executionSource: 'runMlsMpmP2gGridProjectionWithOptionalWebGpu',
    backend,
    acceptedBackend,
    kernelScope: projection?.kernelScope || null,
    readbackMode: projection?.readbackMode || null,
    fullReadbackPerformed: projection?.fullReadbackPerformed === true,
    normalHotLoopReadbackFree: projection?.normalHotLoopReadbackFree === true,
    gridNodeCount: finiteNumber(projection?.gridNodeCount, 0),
    gridNodeStrideBytes,
    gridBufferRetained: Boolean(projection?.gridBuffer || projection?.gpuResult?.gridBuffer),
    pressureInterface: {
      suppressed: pressureSuppressed,
      internalPressureScale: finiteNumber(projection?.internalPressureScale, 1)
    },
    productInput: {
      suppressed: productSuppressed,
      productEventCount: finiteNumber(projection?.residentProductMassInputProductEventCount, 0),
      residentProductMassStatus: projection?.residentProductMassStatus || null
    },
    webgpuStatus: projection?.webgpuStatus ? { ...projection.webgpuStatus } : null,
    webgpuParityStatus: projection?.webgpuParity?.status || null,
    gpuFenceRequired: gpuFenceRequirement?.required === true,
    readFamilies: ['sph-particle-state', 'mls-mpm-mechanics'],
    transientWriteFamilies: ['mls-mpm-grid'],
    authoritativeWriteFamilies: [],
    mustNotWriteFamilies: ['sph-thermo-phase', 'resident-product-mass', 'pressure-interface-force-rows'],
    promotionStatus: 'stage-task-evidence-only-not-authoritative',
    scientificValidation: false,
    fullPhysicsValidation: false
  };
}

function createMlsMpmMechanicsP2gStageGpuFenceReport(projection = {}, requirement = {}) {
  const required = requirement?.required === true;
  const webgpuCompleted = projection?.backend !== 'webgpu'
    || projection?.fullReadbackPerformed === true
    || projection?.webgpuStatus?.status === 'webgpu-executed';
  const fenceSatisfied = !required || webgpuCompleted;
  return {
    schema: PEERCOMPUTE_GPU_FENCE_REPORT_SCHEMA,
    required,
    fenceSatisfied,
    status: fenceSatisfied ? 'gpu-fence-satisfied' : 'gpu-fence-unsatisfied',
    reason: fenceSatisfied
      ? (required ? 'mechanics-p2g-stage-queue-completion-evidenced' : 'gpu-fence-not-required')
      : 'mechanics-p2g-stage-queue-completion-not-evidenced',
    laneId: requirement?.laneId || null,
    stateKey: requirement?.stateKey || null,
    source: 'ulg-mls-mpm-mechanics-p2g-stage-compute-task',
    backend: projection?.backend || null,
    readbackMode: projection?.readbackMode || null,
    fullReadbackPerformed: projection?.fullReadbackPerformed === true
  };
}

export function createMlsMpmMechanicsP2gStageComputeTask({
  modulePath,
  taskId = null,
  taskFamily = 'ulg-mls-mpm-mechanics-p2g-stage',
  solverId = 'ulg-mls-mpm-mechanics-p2g-stage',
  owner = 'ulg-mls-mpm-mechanics-law',
  lawGraphId = 'peercompute.ulg.local-sph-law-closure-graph',
  lawGraphNodeId = 'ulg-mls-mpm-mechanics-law',
  laneId = 'ulg:mechanics-p2g-stage:active',
  stateKey = 'ulg:mechanics-p2g-stage-state',
  domainKey = null,
  localExecution = 'inline',
  queueFencePolicy = 'queue.onSubmittedWorkDone-before-admission',
  readFamilies = ['sph-particle-state', 'mls-mpm-mechanics'],
  writeFamilies = ['mls-mpm-grid'],
  retainedBufferRefs = ['mls-mpm-p2g-grid-buffer'],
  returnEnvelope = true,
  suppressCommitDelta = true,
  ...stageOptions
} = {}) {
  if (typeof modulePath !== 'string' || modulePath.trim() === '') {
    throw new Error('createMlsMpmMechanicsP2gStageComputeTask requires a modulePath for the ULG mechanics P2G stage task handler');
  }
  const {
    gpuResidentLaneManager: _ignoredLaneManager,
    gpuResidentLaneId: _ignoredLaneId,
    gpuResidentLaneStateKey: _ignoredLaneStateKey,
    gpuResidentLaneDomainKey: _ignoredLaneDomainKey,
    residentProductMass: _ignoredResidentProductMass,
    internalPressureScale: _ignoredInternalPressureScale,
    ...taskStageOptions
  } = stageOptions;
  const readbackMode = taskStageOptions.readbackMode === NO_FULL_READBACK_MODE ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE;
  const laneCopyBudget = computeResidentLaneTaskCopyBudget({
    ...taskStageOptions,
    readbackMode,
    gpuResidentLaneCopyBudget: stageOptions.gpuResidentLaneCopyBudget
  });
  const requiresGpuLane = taskStageOptions.preferWebGpu === true
    || readbackMode === NO_FULL_READBACK_MODE
    || Boolean(taskStageOptions.sphParticleUpload || taskStageOptions.mlsMpmParticleUpload);
  const lawGraphNode = createResidentLawGraphNodeTaskRef({
    graphId: lawGraphId,
    nodeId: lawGraphNodeId,
    solverId,
    readFamilies,
    writeFamilies,
    requiredClosures: ['mechanics-material-table'],
    validationGates: [
      'mechanics-child-p2g-stage-evidence',
      'mechanics-p2g-stage-task-evidence',
      'cpu-reference-oracle-parity',
      'gpu-fence-report'
    ],
    cachePolicy: 'hot-p2g-stage-gpu-lane-or-cpu-oracle'
  });
  const gpuFence = requiresGpuLane
    ? createResidentGpuFenceRequirement({
        laneId,
        stateKey,
        queueFencePolicy,
        retainedBufferRefs,
        source: 'ulg-mls-mpm-mechanics-p2g-stage-compute-task',
        required: true
      })
    : null;
  const gpuResidentLane = requiresGpuLane
    ? createResidentGpuLaneTaskDescriptor({
        laneId,
        stateKey,
        domainKey,
        solverId,
        owner,
        localExecution,
        readFamilies,
        writeFamilies,
        retainedBufferRefs,
        queueFencePolicy,
        copyBudget: laneCopyBudget
      })
    : null;
  const id = taskId || `ulg-mls-mpm-mechanics-p2g-stage:${finiteNumber(taskStageOptions.sphParticleState?.step ?? taskStageOptions.mlsMpmParticleState?.step, 0)}`;
  return {
    schema: ULG_MLS_MPM_MECHANICS_P2G_STAGE_COMPUTE_TASK_SCHEMA,
    id,
    runtime: 'js',
    taskFamily,
    solverId,
    module: modulePath,
    exportName: 'runMlsMpmMechanicsP2gStageComputeTask',
    returnEnvelope,
    suppressCommitDelta,
    residency: requiresGpuLane ? 'gpu-lane' : 'cpu-oracle',
    lawGraphNode,
    readFamilies: [...readFamilies],
    writeFamilies: [...writeFamilies],
    expectedOutputFamilies: [...writeFamilies],
    ...(requiresGpuLane ? {
      webgpu: {
        residency: 'gpu-lane',
        requiresQueueFence: true,
        laneId,
        stateKey,
        domainKey,
        queueFencePolicy,
        retainedBufferRefs: [...retainedBufferRefs],
        copyBudget: { ...laneCopyBudget }
      },
      gpuFence,
      gpuResidentLane
    } : {}),
    data: {
      ...taskStageOptions,
      readbackMode,
      residentProductMass: null,
      internalPressureScale: 0,
      retainGridBuffer: taskStageOptions.retainGridBuffer ?? true,
      gpuFenceRequirement: gpuFence,
      gpuResidentLane,
      lawGraphNode,
      computeTaskSchema: ULG_MLS_MPM_MECHANICS_P2G_STAGE_COMPUTE_TASK_SCHEMA,
      computeTaskId: id,
      expectedOutputFamilies: [...writeFamilies],
      mechanicsP2gStageTask: true
    }
  };
}

export async function runMlsMpmMechanicsP2gStageComputeTask(data = {}) {
  const {
    gpuResidentLaneManager: _ignoredLaneManager,
    gpuFenceRequirement = null,
    gpuResidentLane = null,
    lawGraphNode = null,
    computeTaskSchema = ULG_MLS_MPM_MECHANICS_P2G_STAGE_COMPUTE_TASK_SCHEMA,
    computeTaskId = null,
    expectedOutputFamilies = [],
    mechanicsP2gStageTask = true,
    ...stageOptions
  } = data || {};
  const projection = await runMlsMpmP2gGridProjectionWithOptionalWebGpu({
    ...stageOptions,
    residentProductMass: null,
    internalPressureScale: 0,
    retainGridBuffer: stageOptions.retainGridBuffer ?? true
  });
  const fenceRequirement = gpuFenceRequirement || gpuResidentLane || { required: false };
  const gpuFence = createMlsMpmMechanicsP2gStageGpuFenceReport(projection, fenceRequirement);
  const mechanicsP2gStageTaskEvidence = createMlsMpmMechanicsP2gStageTaskEvidence(projection, {
    computeTaskId,
    lawGraphNode,
    gpuFenceRequirement: fenceRequirement
  });
  return {
    ...projection,
    schema: projection?.schema || ULG_MLS_MPM_GPU_RESIDENT_STEP_EXECUTION_SCHEMA,
    computeTaskResultSchema: ULG_MLS_MPM_MECHANICS_P2G_STAGE_COMPUTE_TASK_RESULT_SCHEMA,
    computeTaskSchema,
    computeTaskId,
    lawGraphNode,
    gpuFence,
    gpuFenceReport: gpuFence,
    gpuResidentLaneRequirement: gpuResidentLane || null,
    expectedOutputFamilies: [...expectedOutputFamilies],
    mechanicsP2gStageTask: mechanicsP2gStageTask === true,
    mechanicsP2gStageTaskEvidence,
    mechanicsP2gStageTaskAuthority: {
      schema: 'peercompute.ulg.mechanics-p2g-stage-task-authority.v0',
      status: 'compute-manager-owned-non-mutating-p2g-stage-task',
      taskId: computeTaskId,
      lawGraphNodeId: lawGraphNode?.nodeId || 'ulg-mls-mpm-mechanics-law',
      solverId: lawGraphNode?.solverId || 'ulg-mls-mpm-mechanics-p2g-stage',
      readFamilies: [...(lawGraphNode?.readFamilies || ['sph-particle-state', 'mls-mpm-mechanics'])],
      writeFamilies: [...(lawGraphNode?.writeFamilies || ['mls-mpm-grid'])],
      commitDeltaSuppressed: true,
      authoritativeStateMutation: false,
      gpuFenceRequired: gpuFenceRequirement?.required === true,
      gpuFenceSatisfied: gpuFence.fenceSatisfied === true
    }
  };
}

export function submitMlsMpmMechanicsP2gStageComputeTask({ computeManager, ...taskOptions } = {}) {
  if (!computeManager || typeof computeManager.submitTask !== 'function') {
    throw new Error('submitMlsMpmMechanicsP2gStageComputeTask requires a ComputeManager-compatible submitTask() method');
  }
  return computeManager.submitTask(createMlsMpmMechanicsP2gStageComputeTask(taskOptions));
}

function createMlsMpmMechanicsGridUpdateStageTaskEvidence(update = {}, {
  computeTaskId = null,
  lawGraphNode = null,
  gpuFenceRequirement = null
} = {}) {
  const backend = update?.backend || null;
  const acceptedBackend = ['cpu', 'cpu-reference', 'webgpu'].includes(String(backend || ''));
  const pressureSuppressed = finiteNumber(update?.pressureInterfaceForceRowCount, 0) === 0
    && finiteNumber(update?.pressureInterfaceAppliedImpulseMagnitudeNSeconds, 0) === 0
    && (!update?.pressureInterfaceForceSolverStatus || update.pressureInterfaceForceApplicationStatus === 'not-applied');
  const pressureApproved = update?.pressureInterfaceGridForceAdmissionApproved === true
    && update?.pressureInterfaceForceApplicationStatus === 'pressure-interface-grid-force-consumer-applied'
    && update?.pressureInterfaceForceConsumerStatus === 'grid-momentum-impulse-consumed'
    && update?.pressureInterfaceImpulseProofStatus === 'actual-grid-node-impulse'
    && finiteNumber(update?.pressureInterfaceForceRowCount, 0) > 0;
  const gridNodeStrideBytes = finiteNumber(
    update?.gridNodeStrideBytes,
    finiteNumber(update?.gridNodeStrideFloats, 0) * Float32Array.BYTES_PER_ELEMENT
  );
  const gridUpdated = update?.status === 'updated'
    && finiteNumber(update?.gridNodeCount, 0) > 0
    && gridNodeStrideBytes > 0;
  const passed = Boolean(
    update
      && acceptedBackend
      && (pressureSuppressed || pressureApproved)
      && gridUpdated
  );
  return {
    schema: ULG_MLS_MPM_MECHANICS_GRID_UPDATE_STAGE_TASK_EVIDENCE_SCHEMA,
    passed,
    status: passed ? 'mechanics-grid-update-stage-task-evidence-ready' : 'mechanics-grid-update-stage-task-evidence-failed',
    reason: passed
      ? 'compute-manager-owned-grid-update-stage-task-ready'
      : !acceptedBackend
        ? 'mechanics-grid-update-stage-task-backend-invalid'
        : !(pressureSuppressed || pressureApproved)
          ? 'mechanics-grid-update-stage-task-pressure-interface-not-admitted-or-suppressed'
          : 'mechanics-grid-update-stage-task-grid-output-missing',
    computeTaskId,
    lawGraphNodeId: lawGraphNode?.nodeId || 'ulg-mls-mpm-mechanics-law',
    solverId: lawGraphNode?.solverId || 'ulg-mls-mpm-mechanics-grid-update-stage',
    stageId: 'gridUpdate',
    executionSource: 'runMlsMpmGridUpdateWithOptionalWebGpu',
    backend,
    acceptedBackend,
    kernelScope: update?.kernelScope || null,
    readbackMode: update?.readbackMode || null,
    fullReadbackPerformed: update?.fullReadbackPerformed === true,
    normalHotLoopReadbackFree: update?.normalHotLoopReadbackFree === true,
    gridNodeCount: finiteNumber(update?.gridNodeCount, 0),
    gridNodeStrideBytes,
    updatedGridBufferRetained: Boolean(update?.updatedGridBuffer || update?.gpuResult?.updatedGridBuffer),
    pressureInterface: {
      suppressed: pressureSuppressed,
      admittedAndApproved: pressureApproved,
      gridForceAdmissionStatus: update?.pressureInterfaceGridForceAdmissionStatus || null,
      gridForceAdmissionApproved: update?.pressureInterfaceGridForceAdmissionApproved === true,
      gridForceAdmissionSourceHotBufferKey: update?.pressureInterfaceGridForceAdmissionSourceHotBufferKey || null,
      forceRowCount: finiteNumber(update?.pressureInterfaceForceRowCount, 0),
      appliedImpulseMagnitudeNSeconds: finiteNumber(update?.pressureInterfaceAppliedImpulseMagnitudeNSeconds, 0),
      applicationStatus: update?.pressureInterfaceForceApplicationStatus || null
    },
    webgpuStatus: update?.webgpuStatus ? { ...update.webgpuStatus } : null,
    webgpuParityStatus: update?.webgpuParity?.status || null,
    queueCompletionStatus: update?.queueCompletionStatus || null,
    queueCompletionMethod: update?.queueCompletionMethod || null,
    gpuFenceRequired: gpuFenceRequirement?.required === true,
    readFamilies: ['mls-mpm-grid'],
    transientReadFamilies: ['mls-mpm-grid'],
    transientWriteFamilies: ['mls-mpm-grid'],
    authoritativeWriteFamilies: [],
    mustNotWriteFamilies: ['sph-particle-state', 'mls-mpm-mechanics', 'sph-thermo-phase', 'resident-product-mass', 'pressure-interface-force-rows'],
    promotionStatus: 'stage-task-evidence-only-not-authoritative',
    scientificValidation: false,
    fullPhysicsValidation: false
  };
}

function createMlsMpmMechanicsGridUpdateStageGpuFenceReport(update = {}, requirement = {}) {
  const required = requirement?.required === true;
  const queueEvidenceStatus = update?.queueCompletionStatus || null;
  const webgpuCompleted = update?.backend !== 'webgpu'
    || update?.fullReadbackPerformed === true
    || queueEvidenceStatus === 'readback-map-completed'
    || queueEvidenceStatus === 'queue-submitted-cleanup-deferred';
  const fenceSatisfied = !required || webgpuCompleted;
  return {
    schema: PEERCOMPUTE_GPU_FENCE_REPORT_SCHEMA,
    required,
    fenceSatisfied,
    status: fenceSatisfied ? 'gpu-fence-satisfied' : 'gpu-fence-unsatisfied',
    reason: fenceSatisfied
      ? (required ? 'mechanics-grid-update-stage-queue-completion-evidenced' : 'gpu-fence-not-required')
      : 'mechanics-grid-update-stage-queue-completion-not-evidenced',
    laneId: requirement?.laneId || null,
    stateKey: requirement?.stateKey || null,
    source: 'ulg-mls-mpm-mechanics-grid-update-stage-compute-task',
    backend: update?.backend || null,
    readbackMode: update?.readbackMode || null,
    fullReadbackPerformed: update?.fullReadbackPerformed === true,
    queueCompletionStatus: queueEvidenceStatus,
    queueCompletionMethod: update?.queueCompletionMethod || null
  };
}

export function createMlsMpmMechanicsGridUpdateStageComputeTask({
  modulePath,
  taskId = null,
  taskFamily = 'ulg-mls-mpm-mechanics-grid-update-stage',
  solverId = 'ulg-mls-mpm-mechanics-grid-update-stage',
  owner = 'ulg-mls-mpm-mechanics-law',
  lawGraphId = 'peercompute.ulg.local-sph-law-closure-graph',
  lawGraphNodeId = 'ulg-mls-mpm-mechanics-law',
  laneId = 'ulg:mechanics-grid-update-stage:active',
  stateKey = 'ulg:mechanics-grid-update-stage-state',
  domainKey = null,
  localExecution = 'inline',
  queueFencePolicy = 'queue.onSubmittedWorkDone-before-admission',
  readFamilies = ['mls-mpm-grid'],
  writeFamilies = ['mls-mpm-grid'],
  retainedBufferRefs = ['mls-mpm-grid-update-buffer'],
  returnEnvelope = true,
  suppressCommitDelta = true,
  ...stageOptions
} = {}) {
  if (typeof modulePath !== 'string' || modulePath.trim() === '') {
    throw new Error('createMlsMpmMechanicsGridUpdateStageComputeTask requires a modulePath for the ULG mechanics grid-update stage task handler');
  }
  const {
    gpuResidentLaneManager: _ignoredLaneManager,
    gpuResidentLaneId: _ignoredLaneId,
    gpuResidentLaneStateKey: _ignoredLaneStateKey,
    gpuResidentLaneDomainKey: _ignoredLaneDomainKey,
    ...taskStageOptions
  } = stageOptions;
  const readbackMode = taskStageOptions.readbackMode === NO_FULL_READBACK_MODE ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE;
  const requiresGpuLane = taskStageOptions.preferWebGpu === true
    || readbackMode === NO_FULL_READBACK_MODE
    || Boolean(taskStageOptions.p2gGridBuffer);
  const lawGraphNode = createResidentLawGraphNodeTaskRef({
    graphId: lawGraphId,
    nodeId: lawGraphNodeId,
    solverId,
    readFamilies,
    writeFamilies,
    requiredClosures: ['mechanics-material-table'],
    validationGates: [
      'mechanics-child-grid-update-stage-evidence',
      'mechanics-grid-update-stage-task-evidence',
      'cpu-reference-oracle-parity',
      'gpu-fence-report'
    ],
    cachePolicy: 'hot-grid-update-stage-gpu-lane-or-cpu-oracle'
  });
  const gpuFence = requiresGpuLane
    ? createResidentGpuFenceRequirement({
        laneId,
        stateKey,
        queueFencePolicy,
        retainedBufferRefs,
        source: 'ulg-mls-mpm-mechanics-grid-update-stage-compute-task',
        required: true
      })
    : null;
  const gpuResidentLane = requiresGpuLane
    ? createResidentGpuLaneTaskDescriptor({
        laneId,
        stateKey,
        domainKey,
        solverId,
        owner,
        localExecution,
        readFamilies,
        writeFamilies,
        retainedBufferRefs,
        queueFencePolicy,
        copyBudget: {
          schema: 'peercompute.compute.gpu-resident-lane-copy-budget.v0',
          uploadBytes: 0,
          readbackBytes: 0,
          retainedBytes: Math.max(0, finiteNumber(taskStageOptions.p2gGridProjection?.gridNodeCount, 0))
            * Math.max(0, finiteNumber(taskStageOptions.p2gGridProjection?.gridNodeStrideBytes, 0)),
          compactSummaryBytes: 0,
          fullReadbackReason: readbackMode === NO_FULL_READBACK_MODE ? null : 'grid-update-stage-full-readback-mode'
        }
      })
    : null;
  const id = taskId || `ulg-mls-mpm-mechanics-grid-update-stage:${finiteNumber(taskStageOptions.p2gGridProjection?.sourceStep, 0)}`;
  return {
    schema: ULG_MLS_MPM_MECHANICS_GRID_UPDATE_STAGE_COMPUTE_TASK_SCHEMA,
    id,
    runtime: 'js',
    taskFamily,
    solverId,
    module: modulePath,
    exportName: 'runMlsMpmMechanicsGridUpdateStageComputeTask',
    returnEnvelope,
    suppressCommitDelta,
    residency: requiresGpuLane ? 'gpu-lane' : 'cpu-oracle',
    lawGraphNode,
    readFamilies: [...readFamilies],
    writeFamilies: [...writeFamilies],
    expectedOutputFamilies: [...writeFamilies],
    ...(requiresGpuLane ? {
      webgpu: {
        residency: 'gpu-lane',
        requiresQueueFence: true,
        laneId,
        stateKey,
        domainKey,
        queueFencePolicy,
        retainedBufferRefs: [...retainedBufferRefs],
        copyBudget: { ...gpuResidentLane.copyBudget }
      },
      gpuFence,
      gpuResidentLane
    } : {}),
    data: {
      ...taskStageOptions,
      readbackMode,
      retainUpdatedGridBuffer: taskStageOptions.retainUpdatedGridBuffer ?? true,
      gpuFenceRequirement: gpuFence,
      gpuResidentLane,
      lawGraphNode,
      computeTaskSchema: ULG_MLS_MPM_MECHANICS_GRID_UPDATE_STAGE_COMPUTE_TASK_SCHEMA,
      computeTaskId: id,
      expectedOutputFamilies: [...writeFamilies],
      mechanicsGridUpdateStageTask: true
    }
  };
}

export async function runMlsMpmMechanicsGridUpdateStageComputeTask(data = {}) {
  const {
    gpuResidentLaneManager: _ignoredLaneManager,
    gpuFenceRequirement = null,
    gpuResidentLane = null,
    lawGraphNode = null,
    computeTaskSchema = ULG_MLS_MPM_MECHANICS_GRID_UPDATE_STAGE_COMPUTE_TASK_SCHEMA,
    computeTaskId = null,
    expectedOutputFamilies = [],
    mechanicsGridUpdateStageTask = true,
    ...stageOptions
  } = data || {};
  const update = await runMlsMpmGridUpdateWithOptionalWebGpu({
    ...stageOptions,
    retainUpdatedGridBuffer: stageOptions.retainUpdatedGridBuffer ?? true
  });
  const fenceRequirement = gpuFenceRequirement || gpuResidentLane || { required: false };
  const gpuFence = createMlsMpmMechanicsGridUpdateStageGpuFenceReport(update, fenceRequirement);
  const mechanicsGridUpdateStageTaskEvidence = createMlsMpmMechanicsGridUpdateStageTaskEvidence(update, {
    computeTaskId,
    lawGraphNode,
    gpuFenceRequirement: fenceRequirement
  });
  return {
    ...update,
    computeTaskResultSchema: ULG_MLS_MPM_MECHANICS_GRID_UPDATE_STAGE_COMPUTE_TASK_RESULT_SCHEMA,
    computeTaskSchema,
    computeTaskId,
    lawGraphNode,
    gpuFence,
    gpuFenceReport: gpuFence,
    gpuResidentLaneRequirement: gpuResidentLane || null,
    expectedOutputFamilies: [...expectedOutputFamilies],
    mechanicsGridUpdateStageTask: mechanicsGridUpdateStageTask === true,
    mechanicsGridUpdateStageTaskEvidence,
    mechanicsGridUpdateStageTaskAuthority: {
      schema: 'peercompute.ulg.mechanics-grid-update-stage-task-authority.v0',
      status: 'compute-manager-owned-non-mutating-grid-update-stage-task',
      taskId: computeTaskId,
      lawGraphNodeId: lawGraphNode?.nodeId || 'ulg-mls-mpm-mechanics-law',
      solverId: lawGraphNode?.solverId || 'ulg-mls-mpm-mechanics-grid-update-stage',
      readFamilies: [...(lawGraphNode?.readFamilies || ['mls-mpm-grid'])],
      writeFamilies: [...(lawGraphNode?.writeFamilies || ['mls-mpm-grid'])],
      commitDeltaSuppressed: true,
      authoritativeStateMutation: false,
      gpuFenceRequired: gpuFenceRequirement?.required === true,
      gpuFenceSatisfied: gpuFence.fenceSatisfied === true
    }
  };
}

export function submitMlsMpmMechanicsGridUpdateStageComputeTask({ computeManager, ...taskOptions } = {}) {
  if (!computeManager || typeof computeManager.submitTask !== 'function') {
    throw new Error('submitMlsMpmMechanicsGridUpdateStageComputeTask requires a ComputeManager-compatible submitTask() method');
  }
  return computeManager.submitTask(createMlsMpmMechanicsGridUpdateStageComputeTask(taskOptions));
}

function createMlsMpmMechanicsG2pStageTaskEvidence(reconstruction = {}, {
  computeTaskId = null,
  lawGraphNode = null,
  gpuFenceRequirement = null
} = {}) {
  const backend = reconstruction?.backend || null;
  const acceptedBackend = ['cpu', 'cpu-reference', 'webgpu'].includes(String(backend || ''));
  const pressureSuppressed = finiteNumber(reconstruction?.internalPressureScale, 1) === 0;
  const stateOutputPresent = reconstruction?.state instanceof Float32Array
    ? reconstruction.state.length > 0
    : finiteNumber(reconstruction?.stateBufferByteLength, 0) > 0;
  const mechanicsOutputPresent = reconstruction?.mechanics instanceof Float32Array
    ? reconstruction.mechanics.length > 0
    : finiteNumber(reconstruction?.mechanicsBufferByteLength, 0) > 0;
  const particlesReconstructed = reconstruction?.status === 'reconstructed'
    && finiteNumber(reconstruction?.particleCount, 0) > 0
    && stateOutputPresent
    && mechanicsOutputPresent;
  const passed = Boolean(
    reconstruction
      && acceptedBackend
      && pressureSuppressed
      && particlesReconstructed
  );
  return {
    schema: ULG_MLS_MPM_MECHANICS_G2P_STAGE_TASK_EVIDENCE_SCHEMA,
    passed,
    status: passed ? 'mechanics-g2p-stage-task-evidence-ready' : 'mechanics-g2p-stage-task-evidence-failed',
    reason: passed
      ? 'compute-manager-owned-g2p-stage-task-ready'
      : !acceptedBackend
        ? 'mechanics-g2p-stage-task-backend-invalid'
        : !pressureSuppressed
          ? 'mechanics-g2p-stage-task-pressure-not-suppressed'
          : 'mechanics-g2p-stage-task-particle-output-missing',
    computeTaskId,
    lawGraphNodeId: lawGraphNode?.nodeId || 'ulg-mls-mpm-mechanics-law',
    solverId: lawGraphNode?.solverId || 'ulg-mls-mpm-mechanics-g2p-stage',
    stageId: 'g2p',
    executionSource: 'runMlsMpmG2pWithOptionalWebGpu',
    backend,
    acceptedBackend,
    kernelScope: reconstruction?.kernelScope || null,
    readbackMode: reconstruction?.readbackMode || null,
    fullReadbackPerformed: reconstruction?.fullReadbackPerformed === true,
    normalHotLoopReadbackFree: reconstruction?.normalHotLoopReadbackFree === true,
    particleCount: finiteNumber(reconstruction?.particleCount, 0),
    gridNodeCount: finiteNumber(reconstruction?.gridNodeCount, 0),
    outputBuffersRetained: Boolean(reconstruction?.retainedOutputParticleBuffers || reconstruction?.stateBuffer || reconstruction?.mechanicsBuffer),
    stateOutputPresent,
    mechanicsOutputPresent,
    pressureInterface: {
      suppressed: pressureSuppressed,
      internalPressureScale: finiteNumber(reconstruction?.internalPressureScale, 1)
    },
    webgpuStatus: reconstruction?.webgpuStatus ? { ...reconstruction.webgpuStatus } : null,
    webgpuParityStatus: reconstruction?.webgpuParity?.status || null,
    gpuFenceRequired: gpuFenceRequirement?.required === true,
    readFamilies: ['sph-particle-state', 'mls-mpm-mechanics', 'mls-mpm-grid'],
    transientReadFamilies: ['mls-mpm-grid'],
    transientWriteFamilies: [],
    candidateWriteFamilies: ['sph-particle-state', 'mls-mpm-mechanics'],
    authoritativeWriteFamilies: [],
    mustNotWriteFamilies: ['sph-thermo-phase', 'resident-product-mass', 'pressure-interface-force-rows'],
    promotionStatus: 'stage-task-evidence-only-not-authoritative',
    scientificValidation: false,
    fullPhysicsValidation: false
  };
}

function createMlsMpmMechanicsG2pStageGpuFenceReport(reconstruction = {}, requirement = {}) {
  const required = requirement?.required === true;
  const webgpuCompleted = reconstruction?.backend !== 'webgpu'
    || reconstruction?.fullReadbackPerformed === true
    || reconstruction?.webgpuStatus?.status === 'webgpu-executed';
  const fenceSatisfied = !required || webgpuCompleted;
  return {
    schema: PEERCOMPUTE_GPU_FENCE_REPORT_SCHEMA,
    required,
    fenceSatisfied,
    status: fenceSatisfied ? 'gpu-fence-satisfied' : 'gpu-fence-unsatisfied',
    reason: fenceSatisfied
      ? (required ? 'mechanics-g2p-stage-queue-completion-evidenced' : 'gpu-fence-not-required')
      : 'mechanics-g2p-stage-queue-completion-not-evidenced',
    laneId: requirement?.laneId || null,
    stateKey: requirement?.stateKey || null,
    source: 'ulg-mls-mpm-mechanics-g2p-stage-compute-task',
    backend: reconstruction?.backend || null,
    readbackMode: reconstruction?.readbackMode || null,
    fullReadbackPerformed: reconstruction?.fullReadbackPerformed === true
  };
}

export function createMlsMpmMechanicsG2pStageComputeTask({
  modulePath,
  taskId = null,
  taskFamily = 'ulg-mls-mpm-mechanics-g2p-stage',
  solverId = 'ulg-mls-mpm-mechanics-g2p-stage',
  owner = 'ulg-mls-mpm-mechanics-law',
  lawGraphId = 'peercompute.ulg.local-sph-law-closure-graph',
  lawGraphNodeId = 'ulg-mls-mpm-mechanics-law',
  laneId = 'ulg:mechanics-g2p-stage:active',
  stateKey = 'ulg:mechanics-g2p-stage-state',
  domainKey = null,
  localExecution = 'inline',
  queueFencePolicy = 'queue.onSubmittedWorkDone-before-admission',
  readFamilies = ['sph-particle-state', 'mls-mpm-mechanics', 'mls-mpm-grid'],
  writeFamilies = ['sph-particle-state', 'mls-mpm-mechanics'],
  retainedBufferRefs = ['sph-state-buffer', 'mls-mpm-mechanics-buffer'],
  returnEnvelope = true,
  suppressCommitDelta = true,
  ...stageOptions
} = {}) {
  if (typeof modulePath !== 'string' || modulePath.trim() === '') {
    throw new Error('createMlsMpmMechanicsG2pStageComputeTask requires a modulePath for the ULG mechanics G2P stage task handler');
  }
  const {
    gpuResidentLaneManager: _ignoredLaneManager,
    gpuResidentLaneId: _ignoredLaneId,
    gpuResidentLaneStateKey: _ignoredLaneStateKey,
    gpuResidentLaneDomainKey: _ignoredLaneDomainKey,
    internalPressureScale: _ignoredInternalPressureScale,
    ...taskStageOptions
  } = stageOptions;
  const readbackMode = taskStageOptions.readbackMode === NO_FULL_READBACK_MODE ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE;
  const requiresGpuLane = taskStageOptions.preferWebGpu === true
    || readbackMode === NO_FULL_READBACK_MODE
    || Boolean(taskStageOptions.sphParticleUpload || taskStageOptions.mlsMpmParticleUpload || taskStageOptions.updatedGridBuffer);
  const lawGraphNode = createResidentLawGraphNodeTaskRef({
    graphId: lawGraphId,
    nodeId: lawGraphNodeId,
    solverId,
    readFamilies,
    writeFamilies,
    requiredClosures: ['mechanics-material-table'],
    validationGates: [
      'mechanics-child-g2p-stage-evidence',
      'mechanics-g2p-stage-task-evidence',
      'cpu-reference-oracle-parity',
      'gpu-fence-report'
    ],
    cachePolicy: 'hot-g2p-stage-gpu-lane-or-cpu-oracle'
  });
  const gpuFence = requiresGpuLane
    ? createResidentGpuFenceRequirement({
        laneId,
        stateKey,
        queueFencePolicy,
        retainedBufferRefs,
        source: 'ulg-mls-mpm-mechanics-g2p-stage-compute-task',
        required: true
      })
    : null;
  const gpuResidentLane = requiresGpuLane
    ? createResidentGpuLaneTaskDescriptor({
        laneId,
        stateKey,
        domainKey,
        solverId,
        owner,
        localExecution,
        readFamilies,
        writeFamilies,
        retainedBufferRefs,
        queueFencePolicy,
        copyBudget: computeResidentLaneTaskCopyBudget({
          ...taskStageOptions,
          readbackMode,
          gpuResidentLaneCopyBudget: stageOptions.gpuResidentLaneCopyBudget
        })
      })
    : null;
  const id = taskId || `ulg-mls-mpm-mechanics-g2p-stage:${finiteNumber(taskStageOptions.sphParticleState?.step ?? taskStageOptions.mlsMpmParticleState?.step, 0)}`;
  return {
    schema: ULG_MLS_MPM_MECHANICS_G2P_STAGE_COMPUTE_TASK_SCHEMA,
    id,
    runtime: 'js',
    taskFamily,
    solverId,
    module: modulePath,
    exportName: 'runMlsMpmMechanicsG2pStageComputeTask',
    returnEnvelope,
    suppressCommitDelta,
    residency: requiresGpuLane ? 'gpu-lane' : 'cpu-oracle',
    lawGraphNode,
    readFamilies: [...readFamilies],
    writeFamilies: [...writeFamilies],
    expectedOutputFamilies: [...writeFamilies],
    ...(requiresGpuLane ? {
      webgpu: {
        residency: 'gpu-lane',
        requiresQueueFence: true,
        laneId,
        stateKey,
        domainKey,
        queueFencePolicy,
        retainedBufferRefs: [...retainedBufferRefs],
        copyBudget: { ...gpuResidentLane.copyBudget }
      },
      gpuFence,
      gpuResidentLane
    } : {}),
    data: {
      ...taskStageOptions,
      readbackMode,
      internalPressureScale: 0,
      retainOutputParticleBuffers: taskStageOptions.retainOutputParticleBuffers ?? true,
      gpuFenceRequirement: gpuFence,
      gpuResidentLane,
      lawGraphNode,
      computeTaskSchema: ULG_MLS_MPM_MECHANICS_G2P_STAGE_COMPUTE_TASK_SCHEMA,
      computeTaskId: id,
      expectedOutputFamilies: [...writeFamilies],
      mechanicsG2pStageTask: true
    }
  };
}

export async function runMlsMpmMechanicsG2pStageComputeTask(data = {}) {
  const {
    gpuResidentLaneManager: _ignoredLaneManager,
    gpuFenceRequirement = null,
    gpuResidentLane = null,
    lawGraphNode = null,
    computeTaskSchema = ULG_MLS_MPM_MECHANICS_G2P_STAGE_COMPUTE_TASK_SCHEMA,
    computeTaskId = null,
    expectedOutputFamilies = [],
    mechanicsG2pStageTask = true,
    sameDeviceRetainedBufferImport = null,
    ...stageOptions
  } = data || {};
  const reconstruction = await runMlsMpmG2pWithOptionalWebGpu({
    ...stageOptions,
    internalPressureScale: 0,
    retainOutputParticleBuffers: stageOptions.retainOutputParticleBuffers ?? true
  });
  const fenceRequirement = gpuFenceRequirement || gpuResidentLane || { required: false };
  const gpuFence = createMlsMpmMechanicsG2pStageGpuFenceReport(reconstruction, fenceRequirement);
  const mechanicsG2pStageTaskEvidence = createMlsMpmMechanicsG2pStageTaskEvidence(reconstruction, {
    computeTaskId,
    lawGraphNode,
    gpuFenceRequirement: fenceRequirement
  });
  return {
    ...reconstruction,
    computeTaskResultSchema: ULG_MLS_MPM_MECHANICS_G2P_STAGE_COMPUTE_TASK_RESULT_SCHEMA,
    computeTaskSchema,
    computeTaskId,
    lawGraphNode,
    gpuFence,
    gpuFenceReport: gpuFence,
    gpuResidentLaneRequirement: gpuResidentLane || null,
    ...(sameDeviceRetainedBufferImport ? {
      sameDeviceRetainedBufferImport: { ...sameDeviceRetainedBufferImport }
    } : {}),
    expectedOutputFamilies: [...expectedOutputFamilies],
    mechanicsG2pStageTask: mechanicsG2pStageTask === true,
    mechanicsG2pStageTaskEvidence,
    mechanicsG2pStageTaskAuthority: {
      schema: 'peercompute.ulg.mechanics-g2p-stage-task-authority.v0',
      status: 'compute-manager-owned-non-mutating-g2p-stage-task',
      taskId: computeTaskId,
      lawGraphNodeId: lawGraphNode?.nodeId || 'ulg-mls-mpm-mechanics-law',
      solverId: lawGraphNode?.solverId || 'ulg-mls-mpm-mechanics-g2p-stage',
      readFamilies: [...(lawGraphNode?.readFamilies || ['sph-particle-state', 'mls-mpm-mechanics', 'mls-mpm-grid'])],
      writeFamilies: [...(lawGraphNode?.writeFamilies || ['sph-particle-state', 'mls-mpm-mechanics'])],
      commitDeltaSuppressed: true,
      authoritativeStateMutation: false,
      gpuFenceRequired: gpuFenceRequirement?.required === true,
      gpuFenceSatisfied: gpuFence.fenceSatisfied === true
    }
  };
}

export function submitMlsMpmMechanicsG2pStageComputeTask({ computeManager, ...taskOptions } = {}) {
  if (!computeManager || typeof computeManager.submitTask !== 'function') {
    throw new Error('submitMlsMpmMechanicsG2pStageComputeTask requires a ComputeManager-compatible submitTask() method');
  }
  return computeManager.submitTask(createMlsMpmMechanicsG2pStageComputeTask(taskOptions));
}

function estimatedGasCellEosRowCount(stageOptions = {}) {
  const pressureSummary = stageOptions.gasPressureSummary || stageOptions.pressureSummary || null;
  const ledger = stageOptions.spatialGasSpeciesLedger || pressureSummary?.spatialGasSpeciesLedger || null;
  return Math.max(0, finiteNumber(ledger?.cellCount ?? ledger?.cells?.length, 0));
}

function estimatedSpatialGasLedgerProducerRowCount(stageOptions = {}) {
  const residentProductMass = stageOptions.residentProductMass || stageOptions.reactionSummary?.residentProductMass || null;
  return Math.max(0, finiteNumber(
    stageOptions.productEventRowCount
      ?? residentProductMass?.productEventRowCount
      ?? stageOptions.reactionSummary?.productEventRowCount,
    0
  ));
}

function createSphSpatialGasLedgerProducerStageTaskEvidence(result = {}, {
  computeTaskId = null,
  lawGraphNode = null,
  gpuFenceRequirement = null
} = {}) {
  const acceptedBackend = result?.backend === 'webgpu' || result?.backend === 'cpu-reference';
  const ledgerReady = result?.spatialGasSpeciesLedger?.status === 'spatial-gas-species-ledger-ready'
    && Math.max(0, finiteNumber(result?.spatialGasSpeciesLedger?.cellCount, 0)) > 0;
  const compactRowsReady = Math.max(0, finiteNumber(result?.compactSpatialGasRowCount, 0)) > 0;
  const noFullProductReadback = result?.fullProductEventReadbackPerformed !== true;
  const passed = acceptedBackend && ledgerReady && compactRowsReady && noFullProductReadback;
  return {
    schema: ULG_SPH_SPATIAL_GAS_LEDGER_PRODUCER_STAGE_TASK_EVIDENCE_SCHEMA,
    passed,
    status: passed
      ? 'spatial-gas-ledger-producer-stage-task-evidence-pass'
      : 'spatial-gas-ledger-producer-stage-task-evidence-fail',
    reason: passed
      ? 'resident-product-event-buffer-derived-spatial-gas-ledger'
      : (!acceptedBackend
          ? 'spatial-gas-ledger-producer-stage-backend-invalid'
          : (!noFullProductReadback
              ? 'full-product-event-readback-performed'
              : (result?.reason || result?.spatialGasSpeciesLedgerStatus || result?.status || 'spatial-gas-ledger-unavailable'))),
    computeTaskId,
    lawGraphNodeId: lawGraphNode?.nodeId || 'ulg-resident-spatial-gas-ledger-law',
    solverId: lawGraphNode?.solverId || 'ulg-sph-spatial-gas-ledger-producer-stage',
    stageId: SPATIAL_GAS_LEDGER_PRODUCER_STAGE_ID,
    executionSource: result?.executionSource || null,
    backend: result?.backend || null,
    acceptedBackend,
    executionStatus: result?.status || null,
    readbackMode: result?.readbackMode || null,
    fullReadbackPerformed: result?.fullReadbackPerformed === true,
    fullProductEventReadbackPerformed: result?.fullProductEventReadbackPerformed === true,
    compactSpatialGasReadbackPerformed: result?.compactSpatialGasReadbackPerformed === true,
    compactSpatialGasReadbackByteLength: Math.max(0, finiteNumber(result?.compactSpatialGasReadbackByteLength, 0)),
    compactSpatialGasRowCount: Math.max(0, finiteNumber(result?.compactSpatialGasRowCount, 0)),
    productEventRowCount: Math.max(0, finiteNumber(result?.productEventRowCount, 0)),
    productEventStrideFloats: Math.max(0, finiteNumber(result?.productEventStrideFloats, 0)),
    spatialGasSpeciesLedgerSchema: result?.spatialGasSpeciesLedger?.schema || result?.spatialGasSpeciesLedgerSchema || null,
    spatialGasSpeciesLedgerStatus: result?.spatialGasSpeciesLedger?.status || result?.spatialGasSpeciesLedgerStatus || null,
    spatialGasSpeciesLedgerCellCount: Math.max(0, finiteNumber(
      result?.spatialGasSpeciesLedger?.cellCount ?? result?.spatialGasSpeciesLedgerCellCount,
      0
    )),
    retainedSpatialGasLedgerSourceReady: result?.retainedSpatialGasLedgerSourceReady === true,
    retainedSpatialGasLedgerSourceStatus: result?.retainedSpatialGasLedgerSourceStatus || null,
    gpuFenceRequired: gpuFenceRequirement?.required === true,
    readFamilies: ['resident-product-mass', 'reaction-closure-table'],
    candidateWriteFamilies: ['resident-spatial-gas-species-ledger'],
    authoritativeWriteFamilies: [],
    mustNotWriteFamilies: ['resident-gas-pressure', 'pressure-interface-force-rows', 'sph-particle-state', 'mls-mpm-mechanics', 'sph-thermo-phase'],
    promotionStatus: 'spatial-gas-ledger-producer-stage-task-evidence-only-not-authoritative',
    scientificValidation: false,
    gasValidation: false,
    fullPhysicsValidation: false
  };
}

function createSphSpatialGasLedgerProducerStageGpuFenceReport(result = {}, requirement = {}) {
  const required = requirement?.required === true;
  const webgpuCompleted = result?.backend !== 'webgpu'
    || result?.queueCompletionStatus === 'readback-map-completed'
    || result?.queueCompletionStatus === 'queue-work-completed';
  const fenceSatisfied = !required || webgpuCompleted;
  return {
    schema: PEERCOMPUTE_GPU_FENCE_REPORT_SCHEMA,
    required,
    fenceSatisfied,
    status: fenceSatisfied ? 'gpu-fence-satisfied' : 'gpu-fence-unsatisfied',
    reason: fenceSatisfied
      ? (required ? 'spatial-gas-ledger-producer-stage-queue-completion-evidenced' : 'gpu-fence-not-required')
      : 'spatial-gas-ledger-producer-stage-queue-completion-not-evidenced',
    laneId: requirement?.laneId || null,
    stateKey: requirement?.stateKey || null,
    source: 'ulg-sph-spatial-gas-ledger-producer-stage-compute-task',
    backend: result?.backend || null,
    readbackMode: result?.readbackMode || null,
    fullReadbackPerformed: result?.fullReadbackPerformed === true,
    queueCompletionStatus: result?.queueCompletionStatus || null,
    queueCompletionMethod: result?.queueCompletionMethod || null
  };
}

export function createSphSpatialGasLedgerProducerStageComputeTask({
  modulePath,
  taskId = null,
  taskFamily = 'ulg-sph-spatial-gas-ledger-producer-stage',
  solverId = 'ulg-sph-spatial-gas-ledger-producer-stage',
  owner = 'ulg-resident-spatial-gas-ledger-law',
  lawGraphId = 'peercompute.ulg.local-sph-law-closure-graph',
  lawGraphNodeId = 'ulg-resident-spatial-gas-ledger-law',
  laneId = 'ulg:spatial-gas-ledger-producer-stage:active',
  stateKey = 'ulg:spatial-gas-ledger-producer-stage-state',
  domainKey = null,
  localExecution = 'inline',
  queueFencePolicy = 'queue.onSubmittedWorkDone-before-admission',
  readFamilies = ['resident-product-mass', 'reaction-closure-table'],
  writeFamilies = ['resident-spatial-gas-species-ledger'],
  retainedBufferRefs = ['resident-spatial-gas-species-ledger-buffer'],
  returnEnvelope = true,
  suppressCommitDelta = true,
  ...stageOptions
} = {}) {
  if (typeof modulePath !== 'string' || modulePath.trim() === '') {
    throw new Error('createSphSpatialGasLedgerProducerStageComputeTask requires a modulePath for the ULG spatial gas ledger producer stage task handler');
  }
  const {
    gpuResidentLaneManager: _ignoredLaneManager,
    gpuResidentLaneId: _ignoredLaneId,
    gpuResidentLaneStateKey: _ignoredLaneStateKey,
    gpuResidentLaneDomainKey: _ignoredLaneDomainKey,
    ...taskStageOptions
  } = stageOptions;
  const readbackMode = taskStageOptions.readbackMode === NO_FULL_READBACK_MODE ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE;
  const estimatedRows = estimatedSpatialGasLedgerProducerRowCount(taskStageOptions);
  const compactReadbackBytes = estimatedRows * SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const residentProductMass = taskStageOptions.residentProductMass || taskStageOptions.reactionSummary?.residentProductMass || null;
  const requiresGpuLane = taskStageOptions.preferWebGpu === true
    || readbackMode === NO_FULL_READBACK_MODE
    || residentProductMass?.productEventBufferRetained === true
    || taskStageOptions.productEventBufferRetained === true;
  const lawGraphNode = createResidentLawGraphNodeTaskRef({
    graphId: lawGraphId,
    nodeId: lawGraphNodeId,
    solverId,
    readFamilies,
    writeFamilies,
    requiredClosures: ['reaction-product-event-buffer', 'spatial-gas-species-ledger'],
    validationGates: [
      'product-event-buffer-retained-or-rows-supplied',
      'compact-spatial-gas-readback-not-full-product-events',
      'gpu-fence-report'
    ],
    cachePolicy: 'hot-spatial-gas-ledger-stage-gpu-lane-compact-readback'
  });
  const copyBudget = {
    schema: 'peercompute.compute.gpu-resident-lane-copy-budget.v0',
    uploadBytes: 0,
    readbackBytes: compactReadbackBytes,
    retainedBytes: compactReadbackBytes,
    compactSummaryBytes: compactReadbackBytes,
    fullReadbackReason: null
  };
  const gpuFence = requiresGpuLane
    ? createResidentGpuFenceRequirement({
        laneId,
        stateKey,
        queueFencePolicy,
        retainedBufferRefs,
        source: 'ulg-sph-spatial-gas-ledger-producer-stage-compute-task',
        required: true
      })
    : null;
  const gpuResidentLane = requiresGpuLane
    ? createResidentGpuLaneTaskDescriptor({
        laneId,
        stateKey,
        domainKey,
        solverId,
        owner,
        localExecution,
        readFamilies,
        writeFamilies,
        retainedBufferRefs,
        queueFencePolicy,
        copyBudget
      })
    : null;
  const id = taskId || `ulg-sph-spatial-gas-ledger-producer-stage:${finiteNumber(taskStageOptions.sphParticleState?.step, 0)}`;
  return {
    schema: ULG_SPH_SPATIAL_GAS_LEDGER_PRODUCER_STAGE_COMPUTE_TASK_SCHEMA,
    id,
    runtime: 'js',
    taskFamily,
    solverId,
    module: modulePath,
    exportName: 'runSphSpatialGasLedgerProducerStageComputeTask',
    returnEnvelope,
    suppressCommitDelta,
    residency: requiresGpuLane ? 'gpu-lane' : 'cpu-oracle',
    lawGraphNode,
    readFamilies: [...readFamilies],
    writeFamilies: [...writeFamilies],
    expectedOutputFamilies: [...writeFamilies],
    ...(requiresGpuLane ? {
      webgpu: {
        residency: 'gpu-lane',
        requiresQueueFence: true,
        laneId,
        stateKey,
        domainKey,
        queueFencePolicy,
        retainedBufferRefs: [...retainedBufferRefs],
        copyBudget: { ...copyBudget }
      },
      gpuFence,
      gpuResidentLane
    } : {}),
    data: {
      ...taskStageOptions,
      readbackMode,
      retainSpatialGasLedgerBuffer: taskStageOptions.retainSpatialGasLedgerBuffer ?? true,
      gpuFenceRequirement: gpuFence,
      gpuResidentLane,
      lawGraphNode,
      computeTaskSchema: ULG_SPH_SPATIAL_GAS_LEDGER_PRODUCER_STAGE_COMPUTE_TASK_SCHEMA,
      computeTaskId: id,
      expectedOutputFamilies: [...writeFamilies],
      spatialGasLedgerProducerStageTask: true
    }
  };
}

export async function runSphSpatialGasLedgerProducerStageComputeTask(data = {}) {
  const {
    gpuResidentLaneManager: _ignoredLaneManager,
    gpuFenceRequirement = null,
    gpuResidentLane = null,
    lawGraphNode = null,
    computeTaskSchema = ULG_SPH_SPATIAL_GAS_LEDGER_PRODUCER_STAGE_COMPUTE_TASK_SCHEMA,
    computeTaskId = null,
    expectedOutputFamilies = [],
    spatialGasLedgerProducerStageTask = true,
    ...stageOptions
  } = data || {};
  const readbackMode = stageOptions.readbackMode === NO_FULL_READBACK_MODE ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE;
  const residentProductMass = stageOptions.residentProductMass || stageOptions.reactionSummary?.residentProductMass || null;
  const productEventRowCount = Math.max(0, Math.floor(finiteNumber(
    stageOptions.productEventRowCount
      ?? residentProductMass?.productEventRowCount
      ?? stageOptions.reactionSummary?.productEventRowCount,
    0
  )));
  const productEventStrideFloats = Math.max(1, Math.floor(finiteNumber(
    stageOptions.productEventStrideFloats
      ?? residentProductMass?.productEventStrideFloats
      ?? stageOptions.reactionSummary?.productEvents?.rowStrideFloats,
    SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS
  )));
  const spatialGasSupportVolumeFallbackM3 = deriveSpatialGasSupportVolumeFallbackM3({
    boxDimsM: stageOptions.boxDimsM,
    residentProductMass,
    reactionSummary: stageOptions.reactionSummary,
    gasPressureSummary: stageOptions.gasPressureSummary || stageOptions.pressureSummary || null,
    productEventRowCount,
    explicitFallbackM3: stageOptions.spatialGasSupportVolumeFallbackM3
  });
  const retainedSpatialGasSourceBufferRefs = uniqueNonEmptyStrings([
    ...(stageOptions.retainedSpatialGasSourceBufferRefs || []),
    ...(residentProductMass?.retainedProductBufferRefs || []),
    ...(stageOptions.reactionSummary?.retainedProductBufferRefs || []),
    ...(residentProductMass?.productEventBufferRetained || stageOptions.productEventBufferRetained ? ['resident-product-mass-buffer'] : [])
  ]);
  const workerRetainedSpatialGasSourceBufferRefs = uniqueNonEmptyStrings([
    ...(stageOptions.workerRetainedSpatialGasSourceBufferRefs || []),
    ...(residentProductMass?.workerRetainedProductBufferRefs || []),
    ...(stageOptions.reactionSummary?.workerRetainedProductBufferRefs || [])
  ]);
  let backend = 'cpu-reference';
  let webgpuStatus = null;
  let queueCompletionStatus = 'not-submitted';
  let queueCompletionMethod = null;
  let compactRows = null;
  let compactRowsBuffer = null;
  let spatialGasLedgerRowsBufferRetained = false;
  let reason = null;
  const compactReadbackByteLength = productEventRowCount
    * SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  if (stageOptions.preferWebGpu === true && productEventRowCount > 0) {
    let deviceResult = stageOptions.deviceResult || null;
    if (!deviceResult?.device && stageOptions.device?.createBuffer) {
      deviceResult = { status: 'webgpu-ready-supplied-device', device: stageOptions.device };
    }
    if (!deviceResult?.device && (stageOptions.navigatorRef || globalThis.navigator)) {
      deviceResult = await requestOpticalGpuDevice(stageOptions.navigatorRef || globalThis.navigator);
    }
    const device = deviceResult?.device || null;
    const rawProductEventBuffer = stageOptions.productEventBuffer
      || residentProductMass?.productEventBuffer
      || stageOptions.reactionSummary?.productEventBuffer
      || null;
    const productEventRowsAvailable = stageOptions.productEventRows instanceof Float32Array;
    const productEventBufferDeviceMismatch = rawProductEventBuffer && device?.createBuffer && !productEventRowsAvailable
      ? webGpuDeviceMismatchInfo({
          buffer: rawProductEventBuffer,
          residentProductMass,
          device
        })
      : { mismatch: false, sourceDeviceId: null, consumerDeviceId: device ? webGpuDeviceId(device) : null };
    const productEventBuffer = productEventBufferDeviceMismatch.mismatch ? null : rawProductEventBuffer;
    const uploadedProductEventBuffer = !productEventBuffer
      && !productEventBufferDeviceMismatch.mismatch
      && device?.createBuffer
      && productEventRowsAvailable
      ? tagWebGpuBufferDevice(writeGpuBuffer(
          device,
          'ulg-sph-spatial-gas-ledger-product-events-in',
          stageOptions.productEventRows,
          GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
        ), device)
      : null;
    const sourceBuffer = productEventBuffer || uploadedProductEventBuffer;
    if (productEventBufferDeviceMismatch.mismatch) {
      webgpuStatus = {
        status: 'blocked-cross-device-product-event-buffer',
        fallback: 'aggregate-gas-ledger-or-cpu-product-event-rows',
        reason: 'product-event-buffer-created-on-different-webgpu-device',
        sourceDeviceId: productEventBufferDeviceMismatch.sourceDeviceId,
        consumerDeviceId: productEventBufferDeviceMismatch.consumerDeviceId
      };
      reason = webgpuStatus.reason;
    } else if (device?.createBuffer && device.queue?.writeBuffer && sourceBuffer) {
      try {
        compactRowsBuffer = device.createBuffer({
          label: 'ulg-sph-spatial-gas-ledger-compact-rows-out',
          size: Math.max(4, compactReadbackByteLength),
          usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
        });
        const paramsBuffer = writeGpuBuffer(
          device,
          'ulg-sph-spatial-gas-ledger-compact-params',
          createSpatialGasLedgerProductEventCompactParams({
            productEventRowCount,
            productEventStrideFloats,
            spatialGasSupportVolumeFallbackM3
          }),
          GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
        );
        const { pipeline, bindGroupLayout } = createCachedExplicitComputePipeline(device, {
          label: 'ulg-sph-spatial-gas-ledger-product-event-compact',
          code: createSpatialGasLedgerProductEventCompactWgsl(),
          entryPoint: 'main',
          bindings: [
            computeBufferBinding(0, 'read-only-storage'),
            computeBufferBinding(1, 'storage'),
            computeBufferBinding(2, 'uniform')
          ]
        });
        const bindGroup = device.createBindGroup({
          layout: bindGroupLayout,
          entries: [
            { binding: 0, resource: { buffer: sourceBuffer } },
            { binding: 1, resource: { buffer: compactRowsBuffer } },
            { binding: 2, resource: { buffer: paramsBuffer } }
          ]
        });
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginComputePass();
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroups(Math.max(1, Math.ceil(productEventRowCount / 64)));
        pass.end();
        device.queue.submit([encoder.finish()]);
        const compactCopy = await readGpuBuffer(
          device,
          compactRowsBuffer,
          compactReadbackByteLength,
          'ulg-sph-spatial-gas-ledger-compact-readback'
        );
        compactRows = new Float32Array(compactCopy);
        queueCompletionStatus = 'readback-map-completed';
        queueCompletionMethod = 'mapAsync(compact-spatial-gas-ledger-readback-buffer)';
        backend = 'webgpu';
        spatialGasLedgerRowsBufferRetained = stageOptions.retainSpatialGasLedgerBuffer !== false;
        webgpuStatus = {
          status: 'webgpu-derived-compact-spatial-gas-ledger-rows',
          fallback: null,
          deviceStatus: deviceResult.status || null
        };
        paramsBuffer.destroy?.();
        uploadedProductEventBuffer?.destroy?.();
        if (!spatialGasLedgerRowsBufferRetained) {
          compactRowsBuffer.destroy?.();
          compactRowsBuffer = null;
        }
      } catch (error) {
        compactRowsBuffer?.destroy?.();
        compactRowsBuffer = null;
        uploadedProductEventBuffer?.destroy?.();
        webgpuStatus = {
          status: 'webgpu-failed',
          fallback: 'cpu-reference',
          reason: error?.message || String(error)
        };
        queueCompletionStatus = 'not-submitted';
        queueCompletionMethod = null;
        backend = 'cpu-reference';
        reason = error?.message || String(error);
      }
    } else {
      webgpuStatus = {
        status: 'blocked-webgpu-product-event-buffer-unavailable',
        fallback: stageOptions.productEventRows instanceof Float32Array ? 'cpu-reference' : null,
        reason: sourceBuffer ? 'webgpu-device-unavailable' : 'product-event-buffer-unavailable'
      };
      reason = webgpuStatus.reason;
    }
  }
  if (!compactRows && stageOptions.productEventCompactRows instanceof Float32Array) {
    compactRows = stageOptions.productEventCompactRows;
    reason = null;
  }
  if (!compactRows && stageOptions.productEventRows instanceof Float32Array) {
    compactRows = compactSpatialGasRowsFromProductEventRows(stageOptions.productEventRows, {
      productEventRowCount,
      productEventStrideFloats,
      spatialGasSupportVolumeFallbackM3
    });
    reason = null;
  }
  const retainedSpatialGasLedgerBufferRefs = spatialGasLedgerRowsBufferRetained
    ? ['resident-spatial-gas-species-ledger-buffer']
    : [];
  const workerRetainedSpatialGasLedgerBufferRefs = [];
  let aggregateSpatialGasLedgerFallbackUsed = false;
  let spatialGasSpeciesLedger = compactRows
    ? decodeSpatialGasLedgerCompactRows(compactRows, {
        productEventRowCount: productEventRowCount || null,
        boxDimsM: stageOptions.boxDimsM,
        reactionTable: stageOptions.reactionTable,
        source: backend === 'webgpu'
          ? 'gpu-resident-product-event-compact-spatial-ledger'
          : 'cpu-product-event-compact-spatial-ledger',
        spatialGasSupportVolumeFallbackM3,
        retainedSpatialGasSourceBufferRefs,
        workerRetainedSpatialGasSourceBufferRefs,
        retainedSpatialGasLedgerBufferRefs,
        workerRetainedSpatialGasLedgerBufferRefs
      })
    : null;
  if (!spatialGasSpeciesLedger) {
    spatialGasSpeciesLedger = spatialGasLedgerFromAggregateGasLedger({
      residentProductMass,
      reactionSummary: stageOptions.reactionSummary,
      gasPressureSummary: stageOptions.gasPressureSummary || stageOptions.pressureSummary || null,
      boxDimsM: stageOptions.boxDimsM,
      retainedSpatialGasSourceBufferRefs,
      workerRetainedSpatialGasSourceBufferRefs,
      retainedSpatialGasLedgerBufferRefs,
      workerRetainedSpatialGasLedgerBufferRefs
    });
    aggregateSpatialGasLedgerFallbackUsed = spatialGasSpeciesLedger != null;
  }
  const compactSpatialGasRowCount = compactRows
    ? Math.floor(compactRows.length / SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS)
    : 0;
  const ledgerReady = spatialGasSpeciesLedger?.status === 'spatial-gas-species-ledger-ready';
  const retainedSpatialGasLedgerSourceReady = ledgerReady && spatialGasLedgerRowsBufferRetained;
  const retainedSpatialGasLedgerSource = retainedSpatialGasLedgerSourceReady
    ? {
        schema: ULG_SPH_RETAINED_SPATIAL_GAS_LEDGER_SOURCE_SCHEMA,
        status: 'sph-retained-spatial-gas-species-ledger-source-ready',
        sourceHotBufferKey: null,
        sourceTaskId: computeTaskId,
        sourceStage: SPATIAL_GAS_LEDGER_PRODUCER_STAGE_ID,
        retainedSpatialGasSourceBufferRefs,
        workerRetainedSpatialGasSourceBufferRefs,
        retainedSpatialGasLedgerBufferRefs,
        workerRetainedSpatialGasLedgerBufferRefs,
        spatialGasSpeciesLedgerSchema: spatialGasSpeciesLedger.schema,
        spatialGasSpeciesLedgerStatus: spatialGasSpeciesLedger.status,
        spatialGasSpeciesLedgerCellCount: spatialGasSpeciesLedger.cellCount,
        compactSpatialGasRowCount,
        compactSpatialGasRowStrideFloats: SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS,
        compactSpatialGasRowByteLength: compactReadbackByteLength,
        sourceFamilies: ['resident-product-mass'],
        outputFamilies: ['resident-spatial-gas-species-ledger'],
        consumerAccessProtocol: aggregateSpatialGasLedgerFallbackUsed
          ? 'same-device-retained-buffer-ref-plus-aggregate-single-cell-ledger-snapshot'
          : 'same-device-retained-buffer-ref-plus-compact-ledger-snapshot',
        stateManagerAdmissionRequired: true
      }
    : null;
  const result = {
    schema: ULG_SPH_SPATIAL_GAS_LEDGER_PRODUCER_STAGE_COMPUTE_TASK_RESULT_SCHEMA,
    backend,
    status: ledgerReady
      ? 'spatial-gas-ledger-producer-stage-ready'
      : 'spatial-gas-ledger-producer-stage-blocked',
    reason: ledgerReady
      ? null
      : (reason || 'spatial-gas-ledger-empty-or-unavailable'),
    executionSource: aggregateSpatialGasLedgerFallbackUsed
      ? 'aggregate-gas-ledger-single-cell-spatial-fallback'
      : (backend === 'webgpu'
          ? 'webgpu-product-event-buffer-compact-spatial-gas-ledger'
          : 'cpu-product-event-compact-spatial-gas-ledger'),
    readbackMode,
    fullReadbackPerformed: false,
    fullProductEventReadbackPerformed: false,
    compactSpatialGasReadbackPerformed: backend === 'webgpu' && compactRows instanceof Float32Array,
    normalHotLoopReadbackFree: false,
    webgpuStatus,
    productEventBufferDeviceMismatch: webgpuStatus?.status === 'blocked-cross-device-product-event-buffer',
    productEventBufferSourceDeviceId: webgpuStatus?.sourceDeviceId || null,
    productEventBufferConsumerDeviceId: webgpuStatus?.consumerDeviceId || null,
    queueCompletionStatus,
    queueCompletionMethod,
    productEventRowCount,
    productEventStrideFloats,
    spatialGasSupportVolumeFallbackM3,
    spatialGasSupportVolumeFallbackSource: spatialGasSupportVolumeFallbackM3 > 0
      ? 'aggregate-gas-ledger-event-count-box-volume-share'
      : null,
    compactSpatialGasRows: compactRows,
    compactSpatialGasRowCount,
    compactSpatialGasRowStrideFloats: SPH_SPATIAL_GAS_LEDGER_COMPACT_ROW_FLOATS,
    compactSpatialGasReadbackByteLength: backend === 'webgpu' ? compactReadbackByteLength : 0,
    spatialGasSpeciesLedger,
    aggregateSpatialGasLedgerFallbackUsed,
    spatialGasLedgerDerivation: spatialGasSpeciesLedger?.spatialGasLedgerDerivation || null,
    spatialGasPositionSource: spatialGasSpeciesLedger?.spatialGasPositionSource || null,
    spatialGasSpeciesLedgerSchema: spatialGasSpeciesLedger?.schema ?? ULG_SPH_SPATIAL_GAS_SPECIES_LEDGER_SCHEMA,
    spatialGasSpeciesLedgerStatus: spatialGasSpeciesLedger?.status ?? 'blocked-spatial-gas-species-ledger-required',
    spatialGasSpeciesLedgerCellCount: spatialGasSpeciesLedger?.cellCount ?? 0,
    spatialGasLedgerRowsBuffer: compactRowsBuffer,
    spatialGasLedgerRowsBufferRetained,
    retainedSpatialGasSourceBufferRefs,
    workerRetainedSpatialGasSourceBufferRefs,
    retainedSpatialGasLedgerBufferRefs,
    workerRetainedSpatialGasLedgerBufferRefs,
    retainedSpatialGasLedgerSourceSchema: ULG_SPH_RETAINED_SPATIAL_GAS_LEDGER_SOURCE_SCHEMA,
    retainedSpatialGasLedgerSourceStatus: retainedSpatialGasLedgerSourceReady
      ? 'sph-retained-spatial-gas-species-ledger-source-ready'
      : (ledgerReady
          ? 'blocked-retained-spatial-gas-ledger-buffer-required'
          : 'blocked-spatial-gas-species-ledger-required'),
    retainedSpatialGasLedgerSourceReady,
    retainedSpatialGasLedgerSource,
    retainedSourceFamilies: retainedSpatialGasLedgerSourceReady ? ['resident-spatial-gas-species-ledger'] : [],
    destroySpatialGasLedgerRowsBuffer: compactRowsBuffer
      ? () => compactRowsBuffer?.destroy?.()
      : null
  };
  const fenceRequirement = gpuFenceRequirement || gpuResidentLane || { required: false };
  const gpuFence = createSphSpatialGasLedgerProducerStageGpuFenceReport(result, fenceRequirement);
  const spatialGasLedgerProducerStageTaskEvidence = createSphSpatialGasLedgerProducerStageTaskEvidence(result, {
    computeTaskId,
    lawGraphNode,
    gpuFenceRequirement: fenceRequirement
  });
  return {
    ...result,
    computeTaskResultSchema: ULG_SPH_SPATIAL_GAS_LEDGER_PRODUCER_STAGE_COMPUTE_TASK_RESULT_SCHEMA,
    computeTaskSchema,
    computeTaskId,
    lawGraphNode,
    gpuFence,
    gpuFenceReport: gpuFence,
    gpuResidentLaneRequirement: gpuResidentLane || null,
    expectedOutputFamilies: [...expectedOutputFamilies],
    spatialGasLedgerProducerStageTask: spatialGasLedgerProducerStageTask === true,
    spatialGasLedgerProducerStageTaskEvidence,
    spatialGasLedgerProducerStageTaskAuthority: {
      schema: 'peercompute.ulg.spatial-gas-ledger-producer-stage-task-authority.v0',
      status: 'compute-manager-owned-non-mutating-spatial-gas-ledger-producer-stage-task',
      taskId: computeTaskId,
      lawGraphNodeId: lawGraphNode?.nodeId || 'ulg-resident-spatial-gas-ledger-law',
      solverId: lawGraphNode?.solverId || 'ulg-sph-spatial-gas-ledger-producer-stage',
      readFamilies: [...(lawGraphNode?.readFamilies || ['resident-product-mass', 'reaction-closure-table'])],
      writeFamilies: [...(lawGraphNode?.writeFamilies || ['resident-spatial-gas-species-ledger'])],
      commitDeltaSuppressed: true,
      authoritativeStateMutation: false,
      pressureInterfaceMutationApproved: false,
      gpuFenceRequired: gpuFenceRequirement?.required === true,
      gpuFenceSatisfied: gpuFence.fenceSatisfied === true
    }
  };
}

export function submitSphSpatialGasLedgerProducerStageComputeTask({ computeManager, ...taskOptions } = {}) {
  if (!computeManager || typeof computeManager.submitTask !== 'function') {
    throw new Error('submitSphSpatialGasLedgerProducerStageComputeTask requires a ComputeManager-compatible submitTask() method');
  }
  return computeManager.submitTask(createSphSpatialGasLedgerProducerStageComputeTask(taskOptions));
}

function createSphGasCellEosProducerStageTaskEvidence(result = {}, {
  computeTaskId = null,
  lawGraphNode = null,
  gpuFenceRequirement = null
} = {}) {
  const acceptedBackend = result?.backend === 'webgpu' || result?.backend === 'cpu-reference';
  const fieldReady = result?.gasCellField?.localPressureGradientReady === true
    && Array.isArray(result?.gasCellField?.cells)
    && result.gasCellField.cells.length > 0;
  const rowCount = Math.max(0, finiteNumber(result?.pressureInterfaceGasPressureCellRowCount, 0));
  const passed = acceptedBackend && fieldReady && rowCount > 0;
  return {
    schema: ULG_SPH_GAS_CELL_EOS_PRODUCER_STAGE_TASK_EVIDENCE_SCHEMA,
    passed,
    status: passed ? 'gas-cell-eos-producer-stage-task-evidence-pass' : 'gas-cell-eos-producer-stage-task-evidence-fail',
    reason: passed
      ? 'resident-gas-cell-eos-producer-stage-produced-local-pressure-field'
      : (!acceptedBackend
          ? 'gas-cell-eos-producer-stage-backend-invalid'
          : (result?.gasCellField?.localPressureGradientStatus || result?.status || 'gas-cell-eos-producer-stage-field-unavailable')),
    computeTaskId,
    lawGraphNodeId: lawGraphNode?.nodeId || 'ulg-resident-gas-cell-eos-law',
    solverId: lawGraphNode?.solverId || 'ulg-sph-gas-cell-eos-producer-stage',
    stageId: 'gasCellEosProducer',
    executionSource: 'deriveLocalGasCellPressureFieldFromSpatialGasLedger',
    backend: result?.backend || null,
    acceptedBackend,
    executionStatus: result?.status || null,
    readbackMode: result?.readbackMode || null,
    fullReadbackPerformed: result?.fullReadbackPerformed === true,
    normalHotLoopReadbackFree: result?.normalHotLoopReadbackFree === true,
    localPressureGradientReady: fieldReady,
    localPressureGradientStatus: result?.gasCellField?.localPressureGradientStatus || null,
    pressureFieldMode: result?.gasCellField?.pressureFieldMode || null,
    pressureFieldResolution: result?.gasCellField?.pressureFieldResolution || null,
    pressureInterfaceGasPressureCellRowCount: rowCount,
    pressureInterfaceGasPressureCellRowStrideFloats: Math.max(0, finiteNumber(result?.pressureInterfaceGasPressureCellRowStrideFloats, 0)),
    pressureInterfaceGasPressureCellRowByteLength: Math.max(0, finiteNumber(result?.pressureInterfaceGasPressureCellRowByteLength, 0)),
    pressureInterfaceGasPressureCellRowsBufferRetained: result?.pressureInterfaceGasPressureCellRowsBufferRetained === true,
    retainedGasCellFieldSourceReady: result?.retainedGasCellFieldSourceReady === true,
    retainedGasCellFieldSourceStatus: result?.retainedGasCellFieldSourceStatus || null,
    spatialGasSpeciesLedgerSchema: result?.gasCellField?.spatialGasSpeciesLedgerSchema || null,
    spatialGasSpeciesLedgerStatus: result?.gasCellField?.spatialGasSpeciesLedgerStatus || null,
    gpuFenceRequired: gpuFenceRequirement?.required === true,
    readFamilies: ['resident-spatial-gas-species-ledger', 'resident-product-mass'],
    candidateWriteFamilies: ['resident-gas-pressure'],
    authoritativeWriteFamilies: [],
    mustNotWriteFamilies: ['pressure-interface-force-rows', 'sph-particle-state', 'mls-mpm-mechanics', 'sph-thermo-phase'],
    promotionStatus: 'gas-cell-eos-producer-stage-task-evidence-only-not-authoritative',
    scientificValidation: false,
    gasValidation: result?.gasCellField?.gasValidation === true,
    fullPhysicsValidation: false
  };
}

function createSphGasCellEosProducerStageGpuFenceReport(result = {}, requirement = {}) {
  const required = requirement?.required === true;
  const webgpuCompleted = result?.backend !== 'webgpu'
    || result?.queueCompletionStatus === 'queue-work-completed';
  const fenceSatisfied = !required || webgpuCompleted;
  return {
    schema: PEERCOMPUTE_GPU_FENCE_REPORT_SCHEMA,
    required,
    fenceSatisfied,
    status: fenceSatisfied ? 'gpu-fence-satisfied' : 'gpu-fence-unsatisfied',
    reason: fenceSatisfied
      ? (required ? 'gas-cell-eos-producer-stage-queue-completion-evidenced' : 'gpu-fence-not-required')
      : 'gas-cell-eos-producer-stage-queue-completion-not-evidenced',
    laneId: requirement?.laneId || null,
    stateKey: requirement?.stateKey || null,
    source: 'ulg-sph-gas-cell-eos-producer-stage-compute-task',
    backend: result?.backend || null,
    readbackMode: result?.readbackMode || null,
    fullReadbackPerformed: result?.fullReadbackPerformed === true,
    queueCompletionStatus: result?.queueCompletionStatus || null,
    queueCompletionMethod: result?.queueCompletionMethod || null
  };
}

export function createSphGasCellEosProducerStageComputeTask({
  modulePath,
  taskId = null,
  taskFamily = 'ulg-sph-gas-cell-eos-producer-stage',
  solverId = 'ulg-sph-gas-cell-eos-producer-stage',
  owner = 'ulg-resident-gas-cell-eos-law',
  lawGraphId = 'peercompute.ulg.local-sph-law-closure-graph',
  lawGraphNodeId = 'ulg-resident-gas-cell-eos-law',
  laneId = 'ulg:gas-cell-eos-producer-stage:active',
  stateKey = 'ulg:gas-cell-eos-producer-stage-state',
  domainKey = null,
  localExecution = 'inline',
  queueFencePolicy = 'queue.onSubmittedWorkDone-before-admission',
  readFamilies = ['resident-spatial-gas-species-ledger', 'resident-product-mass'],
  writeFamilies = ['resident-gas-pressure'],
  retainedBufferRefs = ['resident-gas-pressure-cells-buffer'],
  returnEnvelope = true,
  suppressCommitDelta = true,
  ...stageOptions
} = {}) {
  if (typeof modulePath !== 'string' || modulePath.trim() === '') {
    throw new Error('createSphGasCellEosProducerStageComputeTask requires a modulePath for the ULG gas-cell EOS producer stage task handler');
  }
  const {
    gpuResidentLaneManager: _ignoredLaneManager,
    gpuResidentLaneId: _ignoredLaneId,
    gpuResidentLaneStateKey: _ignoredLaneStateKey,
    gpuResidentLaneDomainKey: _ignoredLaneDomainKey,
    ...taskStageOptions
  } = stageOptions;
  const readbackMode = taskStageOptions.readbackMode === NO_FULL_READBACK_MODE ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE;
  const estimatedRows = estimatedGasCellEosRowCount(taskStageOptions);
  const retainedBytes = estimatedRows * SPH_GAS_PRESSURE_CELL_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const requiresGpuLane = taskStageOptions.preferWebGpu === true
    || readbackMode === NO_FULL_READBACK_MODE
    || taskStageOptions.spatialGasSpeciesLedger?.spatialGasSourceBufferRetained === true
    || taskStageOptions.gasPressureSummary?.spatialGasSpeciesLedger?.spatialGasSourceBufferRetained === true
    || taskStageOptions.pressureSummary?.spatialGasSpeciesLedger?.spatialGasSourceBufferRetained === true;
  const lawGraphNode = createResidentLawGraphNodeTaskRef({
    graphId: lawGraphId,
    nodeId: lawGraphNodeId,
    solverId,
    readFamilies,
    writeFamilies,
    requiredClosures: ['ideal-gas-law', 'spatial-gas-species-ledger'],
    validationGates: [
      'spatial-gas-species-ledger-ready',
      'ideal-gas-law-per-cell',
      'gpu-fence-report'
    ],
    cachePolicy: 'hot-gas-cell-eos-stage-gpu-lane-or-cpu-oracle'
  });
  const copyBudget = {
    schema: 'peercompute.compute.gpu-resident-lane-copy-budget.v0',
    uploadBytes: requiresGpuLane ? retainedBytes : 0,
    readbackBytes: 0,
    retainedBytes,
    compactSummaryBytes: 0,
    fullReadbackReason: readbackMode === NO_FULL_READBACK_MODE ? null : 'gas-cell-eos-producer-stage-full-readback-mode'
  };
  const gpuFence = requiresGpuLane
    ? createResidentGpuFenceRequirement({
        laneId,
        stateKey,
        queueFencePolicy,
        retainedBufferRefs,
        source: 'ulg-sph-gas-cell-eos-producer-stage-compute-task',
        required: true
      })
    : null;
  const gpuResidentLane = requiresGpuLane
    ? createResidentGpuLaneTaskDescriptor({
        laneId,
        stateKey,
        domainKey,
        solverId,
        owner,
        localExecution,
        readFamilies,
        writeFamilies,
        retainedBufferRefs,
        queueFencePolicy,
        copyBudget
      })
    : null;
  const id = taskId || `ulg-sph-gas-cell-eos-producer-stage:${finiteNumber(taskStageOptions.sphParticleState?.step, 0)}`;
  return {
    schema: ULG_SPH_GAS_CELL_EOS_PRODUCER_STAGE_COMPUTE_TASK_SCHEMA,
    id,
    runtime: 'js',
    taskFamily,
    solverId,
    module: modulePath,
    exportName: 'runSphGasCellEosProducerStageComputeTask',
    returnEnvelope,
    suppressCommitDelta,
    residency: requiresGpuLane ? 'gpu-lane' : 'cpu-oracle',
    lawGraphNode,
    readFamilies: [...readFamilies],
    writeFamilies: [...writeFamilies],
    expectedOutputFamilies: [...writeFamilies],
    ...(requiresGpuLane ? {
      webgpu: {
        residency: 'gpu-lane',
        requiresQueueFence: true,
        laneId,
        stateKey,
        domainKey,
        queueFencePolicy,
        retainedBufferRefs: [...retainedBufferRefs],
        copyBudget: { ...copyBudget }
      },
      gpuFence,
      gpuResidentLane
    } : {}),
    data: {
      ...taskStageOptions,
      readbackMode,
      retainGasPressureCellsBuffer: taskStageOptions.retainGasPressureCellsBuffer ?? true,
      gpuFenceRequirement: gpuFence,
      gpuResidentLane,
      lawGraphNode,
      computeTaskSchema: ULG_SPH_GAS_CELL_EOS_PRODUCER_STAGE_COMPUTE_TASK_SCHEMA,
      computeTaskId: id,
      expectedOutputFamilies: [...writeFamilies],
      gasCellEosProducerStageTask: true
    }
  };
}

export async function runSphGasCellEosProducerStageComputeTask(data = {}) {
  const {
    gpuResidentLaneManager: _ignoredLaneManager,
    gpuFenceRequirement = null,
    gpuResidentLane = null,
    lawGraphNode = null,
    computeTaskSchema = ULG_SPH_GAS_CELL_EOS_PRODUCER_STAGE_COMPUTE_TASK_SCHEMA,
    computeTaskId = null,
    expectedOutputFamilies = [],
    gasCellEosProducerStageTask = true,
    gasCellEosProducerRunner = deriveLocalGasCellPressureFieldFromSpatialGasLedger,
    ...stageOptions
  } = data || {};
  const readbackMode = stageOptions.readbackMode === NO_FULL_READBACK_MODE ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE;
  const pressureSummary = stageOptions.gasPressureSummary || stageOptions.pressureSummary || null;
  const gasCellField = gasCellEosProducerRunner({
    pressureSummary,
    spatialGasSpeciesLedger: stageOptions.spatialGasSpeciesLedger || pressureSummary?.spatialGasSpeciesLedger || null,
    boxDimsM: stageOptions.boxDimsM || pressureSummary?.boxDimsM || null,
    fallbackTemperatureK: finiteNumber(stageOptions.fallbackTemperatureK, 293.15),
    source: stageOptions.source || 'resident-gas-cell-eos-producer-stage'
  });
  const packedGasPressureCells = packGasPressureCellRows(gasCellField);
  const localPressureGradientReady = gasCellField?.localPressureGradientReady === true
    && packedGasPressureCells.rowCount > 0;
  let backend = 'cpu-reference';
  let webgpuStatus = null;
  let queueCompletionStatus = 'not-submitted';
  let queueCompletionMethod = null;
  let gasPressureCellsBuffer = null;
  let gasPressureCellRowsBufferRetained = false;
  if (
    stageOptions.preferWebGpu === true
    && localPressureGradientReady
    && stageOptions.retainGasPressureCellsBuffer !== false
  ) {
    let deviceResult = stageOptions.deviceResult || null;
    if (!deviceResult?.device && stageOptions.device?.createBuffer) {
      deviceResult = { status: 'webgpu-ready-supplied-device', device: stageOptions.device };
    }
    if (!deviceResult?.device && (stageOptions.navigatorRef || globalThis.navigator)) {
      deviceResult = await requestOpticalGpuDevice(stageOptions.navigatorRef || globalThis.navigator);
    }
    if (deviceResult?.device?.createBuffer && deviceResult.device.queue?.writeBuffer) {
      try {
        gasPressureCellsBuffer = writeGpuBuffer(
          deviceResult.device,
          'ulg-sph-gas-cell-eos-pressure-cells-out',
          packedGasPressureCells.rows,
          GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.COPY_SRC
        );
        queueCompletionStatus = 'queue-write-buffer-submitted';
        queueCompletionMethod = 'queue.writeBuffer';
        if (typeof deviceResult.device.queue.onSubmittedWorkDone === 'function') {
          await deviceResult.device.queue.onSubmittedWorkDone();
          queueCompletionStatus = 'queue-work-completed';
          queueCompletionMethod = 'queue.onSubmittedWorkDone';
        }
        backend = 'webgpu';
        gasPressureCellRowsBufferRetained = true;
        webgpuStatus = {
          status: 'webgpu-uploaded-retained-gas-cell-rows',
          fallback: null,
          deviceStatus: deviceResult.status || null
        };
      } catch (error) {
        gasPressureCellsBuffer?.destroy?.();
        gasPressureCellsBuffer = null;
        webgpuStatus = {
          status: 'webgpu-failed',
          fallback: 'cpu-reference',
          reason: error?.message || String(error)
        };
        queueCompletionStatus = 'not-submitted';
        queueCompletionMethod = null;
        backend = 'cpu-reference';
      }
    } else {
      webgpuStatus = {
        status: 'blocked-webgpu-unavailable',
        fallback: 'cpu-reference',
        reason: deviceResult?.reason || deviceResult?.status || 'webgpu-device-unavailable'
      };
    }
  }
  const retainedGasPressureBufferRefs = gasPressureCellRowsBufferRetained
    ? ['resident-gas-pressure-cells-buffer']
    : [];
  const retainedGasCellFieldSourceReady = localPressureGradientReady
    && gasPressureCellRowsBufferRetained
    && retainedGasPressureBufferRefs.length > 0;
  const retainedGasCellFieldSource = retainedGasCellFieldSourceReady
    ? {
        schema: ULG_PRESSURE_INTERFACE_RETAINED_GAS_CELL_FIELD_SOURCE_SCHEMA,
        status: 'pressure-interface-retained-gas-cell-field-source-ready',
        sourceHotBufferKey: null,
        sourceTaskId: computeTaskId,
        sourceStage: 'gasCellEosProducer',
        retainedGasPressureBufferRefs,
        workerRetainedGasPressureBufferRefs: [],
        pressureInterfaceGasPressureCellRowCount: packedGasPressureCells.rowCount,
        pressureInterfaceGasPressureCellRowStrideFloats: packedGasPressureCells.rowStrideFloats,
        pressureInterfaceGasPressureCellRowByteLength: packedGasPressureCells.rowByteLength,
        pressureInterfaceGasPressureCellRowsBufferRetained: true,
        pressureFieldMode: gasCellField?.pressureFieldMode || null,
        pressureFieldResolution: gasCellField?.pressureFieldResolution || null,
        sourceFamilies: ['resident-gas-pressure'],
        consumerAccessProtocol: 'same-device-retained-buffer-ref',
        stateManagerAdmissionRequired: true
      }
    : null;
  const result = {
    schema: ULG_SPH_GAS_CELL_EOS_PRODUCER_STAGE_COMPUTE_TASK_RESULT_SCHEMA,
    backend,
    status: localPressureGradientReady
      ? 'gas-cell-eos-producer-stage-ready'
      : 'gas-cell-eos-producer-stage-blocked',
    reason: localPressureGradientReady ? null : gasCellField?.localPressureGradientStatus || 'local-gas-cell-pressure-field-unavailable',
    executionSource: 'deriveLocalGasCellPressureFieldFromSpatialGasLedger',
    readbackMode,
    fullReadbackPerformed: false,
    normalHotLoopReadbackFree: readbackMode === NO_FULL_READBACK_MODE,
    webgpuStatus,
    queueCompletionStatus,
    queueCompletionMethod,
    gasCellField,
    gasCellFieldSnapshot: gasCellField,
    gasPressureCellRows: packedGasPressureCells.rows,
    gasPressureCellRowCount: packedGasPressureCells.rowCount,
    gasPressureCellRowStrideFloats: packedGasPressureCells.rowStrideFloats,
    gasPressureCellRowByteLength: packedGasPressureCells.rowByteLength,
    gasPressureCellRowsBufferRetained,
    gasPressureCellsBuffer,
    pressureInterfaceGasPressureCellRowCount: packedGasPressureCells.rowCount,
    pressureInterfaceGasPressureCellRowStrideFloats: packedGasPressureCells.rowStrideFloats,
    pressureInterfaceGasPressureCellRowByteLength: packedGasPressureCells.rowByteLength,
    pressureInterfaceGasPressureCellRowsBufferRetained: gasPressureCellRowsBufferRetained,
    retainedGasPressureBufferRefs,
    workerRetainedGasPressureBufferRefs: [],
    retainedGasCellFieldSourceSchema: ULG_PRESSURE_INTERFACE_RETAINED_GAS_CELL_FIELD_SOURCE_SCHEMA,
    retainedGasCellFieldSourceStatus: retainedGasCellFieldSourceReady
      ? 'pressure-interface-retained-gas-cell-field-source-ready'
      : (localPressureGradientReady
          ? 'blocked-retained-gas-cell-field-source-required'
          : 'blocked-local-gas-cell-pressure-field-required'),
    retainedGasCellFieldSourceReady,
    retainedGasCellFieldSource,
    retainedSourceFamilies: retainedGasCellFieldSourceReady ? ['resident-gas-pressure'] : [],
    destroyGasPressureCellsBuffer: gasPressureCellsBuffer
      ? () => gasPressureCellsBuffer?.destroy?.()
      : null
  };
  const fenceRequirement = gpuFenceRequirement || gpuResidentLane || { required: false };
  const gpuFence = createSphGasCellEosProducerStageGpuFenceReport(result, fenceRequirement);
  const gasCellEosProducerStageTaskEvidence = createSphGasCellEosProducerStageTaskEvidence(result, {
    computeTaskId,
    lawGraphNode,
    gpuFenceRequirement: fenceRequirement
  });
  return {
    ...result,
    computeTaskResultSchema: ULG_SPH_GAS_CELL_EOS_PRODUCER_STAGE_COMPUTE_TASK_RESULT_SCHEMA,
    computeTaskSchema,
    computeTaskId,
    lawGraphNode,
    gpuFence,
    gpuFenceReport: gpuFence,
    gpuResidentLaneRequirement: gpuResidentLane || null,
    expectedOutputFamilies: [...expectedOutputFamilies],
    gasCellEosProducerStageTask: gasCellEosProducerStageTask === true,
    gasCellEosProducerStageTaskEvidence,
    gasCellEosProducerStageTaskAuthority: {
      schema: 'peercompute.ulg.gas-cell-eos-producer-stage-task-authority.v0',
      status: 'compute-manager-owned-non-mutating-gas-cell-eos-producer-stage-task',
      taskId: computeTaskId,
      lawGraphNodeId: lawGraphNode?.nodeId || 'ulg-resident-gas-cell-eos-law',
      solverId: lawGraphNode?.solverId || 'ulg-sph-gas-cell-eos-producer-stage',
      readFamilies: [...(lawGraphNode?.readFamilies || ['resident-spatial-gas-species-ledger', 'resident-product-mass'])],
      writeFamilies: [...(lawGraphNode?.writeFamilies || ['resident-gas-pressure'])],
      commitDeltaSuppressed: true,
      authoritativeStateMutation: false,
      pressureInterfaceMutationApproved: false,
      gpuFenceRequired: gpuFenceRequirement?.required === true,
      gpuFenceSatisfied: gpuFence.fenceSatisfied === true
    }
  };
}

export function submitSphGasCellEosProducerStageComputeTask({ computeManager, ...taskOptions } = {}) {
  if (!computeManager || typeof computeManager.submitTask !== 'function') {
    throw new Error('submitSphGasCellEosProducerStageComputeTask requires a ComputeManager-compatible submitTask() method');
  }
  return computeManager.submitTask(createSphGasCellEosProducerStageComputeTask(taskOptions));
}

function createSphPressureInterfaceStageTaskEvidence(pressureResult = {}, {
  computeTaskId = null,
  lawGraphNode = null,
  gpuFenceRequirement = null
} = {}) {
  const solver = pressureResult?.pressureInterfaceForceSolver || pressureResult || {};
  const preview = pressureResult?.pressureInterfaceForcePreview || null;
  const acceptedBackend = pressureResult?.backend === 'webgpu' || pressureResult?.backend === 'cpu-reference';
  const forceRowsPresent = solver?.forceRowValues instanceof Float32Array
    || solver?.forceRows instanceof Float32Array
    || (Array.isArray(solver?.forceRows) && solver.forceRows.length > 0)
    || (pressureResult?.forceRowByteLength ?? 0) > 0;
  const passed = acceptedBackend
    && solver?.schema === ULG_SPH_PRESSURE_INTERFACE_FORCE_SOLVER_SCHEMA
    && solver?.status === 'pressure-interface-force-solver-ready'
    && forceRowsPresent;
  return {
    schema: ULG_SPH_PRESSURE_INTERFACE_STAGE_TASK_EVIDENCE_SCHEMA,
    passed,
    status: passed ? 'pressure-interface-stage-task-evidence-pass' : 'pressure-interface-stage-task-evidence-fail',
    reason: passed
      ? 'pressure-interface-stage-produced-force-rows'
      : (!acceptedBackend
        ? 'pressure-interface-stage-task-backend-invalid'
        : (solver?.status || 'pressure-interface-force-solver-not-ready')),
    computeTaskId,
    lawGraphNodeId: lawGraphNode?.nodeId || 'ulg-pressure-interface-force-law',
    solverId: lawGraphNode?.solverId || 'ulg-sph-pressure-interface-stage',
    stageId: PRESSURE_INTERFACE_STAGE_ID,
    executionSource: pressureResult?.executionSource || 'gasPressureInterfaceForceSolver',
    backend: pressureResult?.backend || null,
    acceptedBackend,
    executionStatus: pressureResult?.status || null,
    readbackMode: pressureResult?.readbackMode || null,
    fullReadbackPerformed: pressureResult?.fullReadbackPerformed === true,
    normalHotLoopReadbackFree: pressureResult?.normalHotLoopReadbackFree === true,
    pressureFeedbackStatus: pressureResult?.pressureFeedback?.status || null,
    pressureInterfaceCouplingStatus: pressureResult?.pressureInterfaceCoupling?.status || null,
    pressureInterfaceForcePreviewSchema: preview?.schema || null,
    pressureInterfaceForcePreviewStatus: preview?.status || null,
    pressureInterfaceForceSolverSchema: solver?.schema || null,
    pressureInterfaceForceSolverStatus: solver?.status || null,
    algorithmContactPairResponseSchema: solver?.algorithmContactPairResponseSchema || null,
    algorithmContactPairResponseStatus: solver?.algorithmContactPairResponseStatus || null,
    algorithmContactPolicyRowsSchema: solver?.algorithmContactPolicyRowsSchema || null,
    algorithmContactPolicyRowsStatus: solver?.algorithmContactPolicyRowsStatus || null,
    algorithmContactPolicyRowCount: finiteNumber(solver?.algorithmContactPolicyRowCount, 0),
    algorithmContactForceRowCount: finiteNumber(solver?.algorithmContactForceRowCount, 0),
    algorithmContactPairKeys: Array.isArray(solver?.algorithmContactPairKeys) ? [...solver.algorithmContactPairKeys] : [],
    maxAlgorithmContactPressurePa: finiteNumber(solver?.maxAlgorithmContactPressurePa, 0),
    interfaceContactKinematicsStatus: solver?.interfaceContactKinematicsStatus || null,
    interfaceContactKinematicsRowCount: finiteNumber(solver?.interfaceContactKinematicsRowCount, 0),
    interfaceContactKinematicsReadyCount: finiteNumber(solver?.interfaceContactKinematicsReadyCount, 0),
    interfaceContactKinematicsGpuDerivationEligible: solver?.interfaceContactKinematicsGpuDerivationEligible === true,
    interfaceContactKinematicsGpuDerived: solver?.interfaceContactKinematicsGpuDerived === true,
    interfaceContactKinematicsDerivationStatus: solver?.interfaceContactKinematicsDerivationStatus || null,
    interfaceContactKinematicsParticleSourceStatus: solver?.interfaceContactKinematicsParticleSourceStatus || null,
    interfaceContactKinematicsParticleCount: finiteNumber(solver?.interfaceContactKinematicsParticleCount, 0),
    interfaceContactKinematicsParticleBinGridStatus: solver?.interfaceContactKinematicsParticleBinGridStatus || null,
    interfaceContactKinematicsParticleBinGridEnabled: solver?.interfaceContactKinematicsParticleBinGridEnabled === true,
    interfaceContactKinematicsParticleBinGridCellCount: finiteNumber(solver?.interfaceContactKinematicsParticleBinGridCellCount, 0),
    interfaceContactKinematicsParticleBinGridBinCapacity: finiteNumber(solver?.interfaceContactKinematicsParticleBinGridBinCapacity, 0),
    interfaceContactKinematicsParticleBinGridAverageOccupancy: finiteNumber(solver?.interfaceContactKinematicsParticleBinGridAverageOccupancy, 0),
    interfaceContactKinematicsParticleBinGridEstimatedOverflowRisk: solver?.interfaceContactKinematicsParticleBinGridEstimatedOverflowRisk === true,
    interfaceContactKinematicsParticleBinGridIndexBufferByteLength: finiteNumber(solver?.interfaceContactKinematicsParticleBinGridIndexBufferByteLength, 0),
    interfaceContactKinematicsParticleBinOverflowStatus: solver?.interfaceContactKinematicsParticleBinOverflowStatus || null,
    interfaceContactKinematicsParticleBinOverflowCount: solver?.interfaceContactKinematicsParticleBinOverflowCount ?? null,
    pressureFieldMode: solver?.pressureFieldMode || pressureResult?.pressureFeedback?.pressureFieldMode || null,
    pressureFieldResolution: solver?.pressureFieldResolution || pressureResult?.pressureFeedback?.pressureFieldResolution || null,
    pressureGradientStatus: solver?.pressureGradientStatus || pressureResult?.pressureFeedback?.pressureGradientStatus || null,
    localPressureGradientReady: solver?.localPressureGradientReady === true,
    localPressureGradientStatus: solver?.localPressureGradientStatus
      || pressureResult?.pressureFeedback?.localPressureGradientStatus
      || null,
    localPressureGradientForceCouplingStatus: solver?.localPressureGradientForceCouplingStatus
      || pressureResult?.pressureFeedback?.localPressureGradientForceCouplingStatus
      || null,
    pressureInterfaceGasCellFieldAdmissionSchema: pressureResult?.pressureInterfaceGasCellFieldAdmissionSchema || null,
    pressureInterfaceGasCellFieldAdmissionStatus: pressureResult?.pressureInterfaceGasCellFieldAdmissionStatus || null,
    pressureInterfaceGasCellFieldAdmissionApproved: pressureResult?.pressureInterfaceGasCellFieldAdmissionApproved === true,
    pressureInterfaceGasCellFieldConsumerStatus: pressureResult?.pressureInterfaceGasCellFieldConsumerStatus || null,
    pressureInterfaceGasCellFieldImportSchema: pressureResult?.pressureInterfaceGasCellFieldImportSchema || null,
    pressureInterfaceGasCellFieldImportStatus: pressureResult?.pressureInterfaceGasCellFieldImportStatus || null,
    pressureInterfaceGasCellFieldImportReady: pressureResult?.pressureInterfaceGasCellFieldImportReady === true,
    pressureInterfaceGasCellFieldImportSourceHotBufferKey: pressureResult?.pressureInterfaceGasCellFieldImportSourceHotBufferKey || null,
    pressureInterfaceForceRowCount: finiteNumber(solver?.forceRowCount ?? pressureResult?.forceRowCount, 0),
    pressureInterfaceForceRowsPresent: forceRowsPresent,
    pressureInterfaceConservationStatus: solver?.conservationStatus || null,
    pressureInterfaceConservationResidualMagnitudeN: finiteNumber(solver?.conservationResidualMagnitudeN, 0),
    gpuFenceRequired: gpuFenceRequirement?.required === true,
    readFamilies: ['resident-gas-pressure', 'sph-material-interface-field'],
    candidateWriteFamilies: ['pressure-interface-force-rows'],
    authoritativeWriteFamilies: [],
    mustNotWriteFamilies: ['sph-particle-state', 'mls-mpm-mechanics', 'sph-thermo-phase', 'resident-product-mass'],
    promotionStatus: 'pressure-interface-stage-task-evidence-only-not-authoritative',
    scientificValidation: false,
    gasValidation: false,
    sphValidation: false,
    pressureInterfaceValidation: false,
    fullPhysicsValidation: false
  };
}

function createSphPressureInterfaceStageGpuFenceReport(pressureResult = {}, requirement = {}) {
  const required = requirement?.required === true;
  const webgpuCompleted = pressureResult?.backend !== 'webgpu'
    || pressureResult?.fullReadbackPerformed === true
    || pressureResult?.queueCompletionStatus === 'queue-work-completed';
  const fenceSatisfied = !required || webgpuCompleted;
  return {
    schema: PEERCOMPUTE_GPU_FENCE_REPORT_SCHEMA,
    required,
    fenceSatisfied,
    status: fenceSatisfied ? 'gpu-fence-satisfied' : 'gpu-fence-unsatisfied',
    reason: fenceSatisfied
      ? (required ? 'pressure-interface-stage-queue-completion-evidenced' : 'gpu-fence-not-required')
      : 'pressure-interface-stage-queue-completion-not-evidenced',
    laneId: requirement?.laneId || null,
    stateKey: requirement?.stateKey || null,
    source: 'ulg-sph-pressure-interface-stage-compute-task',
    backend: pressureResult?.backend || null,
    readbackMode: pressureResult?.readbackMode || null,
    fullReadbackPerformed: pressureResult?.fullReadbackPerformed === true
  };
}

export function createSphPressureInterfaceStageComputeTask({
  modulePath,
  taskId = null,
  taskFamily = 'ulg-sph-pressure-interface-stage',
  solverId = 'ulg-sph-pressure-interface-stage',
  owner = 'ulg-pressure-interface-force-law',
  lawGraphId = 'peercompute.ulg.local-sph-law-closure-graph',
  lawGraphNodeId = 'ulg-pressure-interface-force-law',
  laneId = 'ulg:pressure-interface-stage:active',
  stateKey = 'ulg:pressure-interface-stage-state',
  domainKey = null,
  localExecution = 'inline',
  queueFencePolicy = 'queue.onSubmittedWorkDone-before-admission',
  readFamilies = ['resident-gas-pressure', 'sph-material-interface-field'],
  writeFamilies = ['pressure-interface-force-rows'],
  retainedBufferRefs = ['pressure-interface-force-rows-buffer'],
  returnEnvelope = true,
  suppressCommitDelta = true,
  ...stageOptions
} = {}) {
  if (typeof modulePath !== 'string' || modulePath.trim() === '') {
    throw new Error('createSphPressureInterfaceStageComputeTask requires a modulePath for the ULG pressure/interface stage task handler');
  }
  const {
    gpuResidentLaneManager: _ignoredLaneManager,
    gpuResidentLaneId: _ignoredLaneId,
    gpuResidentLaneStateKey: _ignoredLaneStateKey,
    gpuResidentLaneDomainKey: _ignoredLaneDomainKey,
    ...taskStageOptions
  } = stageOptions;
  const readbackMode = taskStageOptions.readbackMode === NO_FULL_READBACK_MODE ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE;
  const resolvedRetainedBufferRefs = pressureInterfaceStageRetainedBufferRefs(retainedBufferRefs, taskStageOptions);
  const requiresGpuLane = taskStageOptions.preferWebGpu === true
    || readbackMode === NO_FULL_READBACK_MODE
    || taskStageOptions.materialInterfaceField?.sourceRenderFieldReadback === false;
  const lawGraphNode = createResidentLawGraphNodeTaskRef({
    graphId: lawGraphId,
    nodeId: lawGraphNodeId,
    solverId,
    readFamilies,
    writeFamilies,
    requiredClosures: ['resident-gas-pressure-summary', 'material-interface-field'],
    validationGates: [
      'pressure-interface-force-row-conservation',
      'material-interface-normal-area-ledger',
      'gpu-fence-report'
    ],
    cachePolicy: 'hot-pressure-interface-stage-gpu-lane-or-cpu-oracle'
  });
  const gpuFence = requiresGpuLane
    ? createResidentGpuFenceRequirement({
        laneId,
        stateKey,
        queueFencePolicy,
        retainedBufferRefs: resolvedRetainedBufferRefs,
        source: 'ulg-sph-pressure-interface-stage-compute-task',
        required: true
      })
    : null;
  const gpuResidentLane = requiresGpuLane
    ? createResidentGpuLaneTaskDescriptor({
        laneId,
        stateKey,
        domainKey,
        solverId,
        owner,
        localExecution,
        readFamilies,
        writeFamilies,
        retainedBufferRefs: resolvedRetainedBufferRefs,
        queueFencePolicy,
        copyBudget: computeResidentLaneTaskCopyBudget({
          ...taskStageOptions,
          readbackMode,
          gpuResidentLaneCopyBudget: stageOptions.gpuResidentLaneCopyBudget
        })
      })
    : null;
  const id = taskId || `ulg-sph-pressure-interface-stage:${finiteNumber(taskStageOptions.sphParticleState?.step, 0)}`;
  return {
    schema: ULG_SPH_PRESSURE_INTERFACE_STAGE_COMPUTE_TASK_SCHEMA,
    id,
    runtime: 'js',
    taskFamily,
    solverId,
    module: modulePath,
    exportName: 'runSphPressureInterfaceStageComputeTask',
    returnEnvelope,
    suppressCommitDelta,
    residency: requiresGpuLane ? 'gpu-lane' : 'cpu-oracle',
    lawGraphNode,
    readFamilies: [...readFamilies],
    writeFamilies: [...writeFamilies],
    expectedOutputFamilies: [...writeFamilies],
    ...(requiresGpuLane ? {
      webgpu: {
        residency: 'gpu-lane',
        requiresQueueFence: true,
        laneId,
        stateKey,
        domainKey,
        queueFencePolicy,
        retainedBufferRefs: [...resolvedRetainedBufferRefs],
        copyBudget: { ...gpuResidentLane.copyBudget }
      },
      gpuFence,
      gpuResidentLane
    } : {}),
    data: {
      ...taskStageOptions,
      readbackMode,
      gpuFenceRequirement: gpuFence,
      gpuResidentLane,
      lawGraphNode,
      computeTaskSchema: ULG_SPH_PRESSURE_INTERFACE_STAGE_COMPUTE_TASK_SCHEMA,
      computeTaskId: id,
      expectedOutputFamilies: [...writeFamilies],
      pressureInterfaceStageTask: true
    }
  };
}

export async function runSphPressureInterfaceStageComputeTask(data = {}) {
  const {
    gpuResidentLaneManager: _ignoredLaneManager,
    gpuFenceRequirement = null,
    gpuResidentLane = null,
    lawGraphNode = null,
    computeTaskSchema = ULG_SPH_PRESSURE_INTERFACE_STAGE_COMPUTE_TASK_SCHEMA,
    computeTaskId = null,
    expectedOutputFamilies = [],
    pressureInterfaceStageTask = true,
    pressureInterfaceForceSolverRunner = gasPressureInterfaceForceSolver,
    pressureInterfaceForceRowsWebGpuRunner = runSphPressureInterfaceForceRowsWebGpu,
    ...stageOptions
  } = data || {};
  const pressureInterfaceGasCellFieldImport = normalizePressureInterfaceGasCellFieldImport(
    stageOptions.pressureInterfaceGasCellFieldImport
      || stageOptions.gasCellFieldImport
      || null
  );
  const pressureSummaryInput = stageOptions.gasPressureSummary || stageOptions.pressureSummary || null;
  const pressureSummaryForFeedback = pressureInterfaceGasCellFieldImport.importReady && pressureSummaryInput
    ? {
        ...pressureSummaryInput,
        gasCellField: pressureInterfaceGasCellFieldImport.gasCellField
      }
    : pressureSummaryInput;
  const pressureFeedback = stageOptions.pressureFeedback
    ? pressureFeedbackWithImportedGasCellField(stageOptions.pressureFeedback, pressureInterfaceGasCellFieldImport)
    : gasPressureFeedbackSummary({
        pressureSummary: pressureSummaryForFeedback,
        boxDimsM: stageOptions.boxDimsM || null,
        source: stageOptions.source || 'pressure-interface-stage',
        materialInterfaceField: stageOptions.materialInterfaceField || null
      });
  const pressureInterfaceCoupling = stageOptions.pressureInterfaceCoupling || gasPressureInterfaceCouplingSummary({
    pressureFeedback,
    materialInterfaceField: stageOptions.materialInterfaceField || null
  });
  const pressureInterfaceForcePreview = stageOptions.pressureInterfaceForcePreview || gasPressureInterfaceForcePreview({
    pressureFeedback,
    materialInterfaceField: stageOptions.materialInterfaceField || null,
    pressureInterfaceCoupling,
    algorithmMaterialContactRows: stageOptions.algorithmMaterialContactRows || null,
    algorithmContactPairResponseScale: stageOptions.algorithmContactPairResponseScale,
    algorithmContactMaxPressurePa: stageOptions.algorithmContactMaxPressurePa
  });
  const pressureInterfaceGasCellFieldAdmission = stageOptions.pressureInterfaceGasCellFieldAdmission
    || stageOptions.gasPressureCellFieldAdmission
    || pressureInterfaceGasCellFieldImport.pressureInterfaceGasCellFieldAdmission
    || null;
  const localPressureGradientReady = pressureFeedback?.gasCellField?.localPressureGradientReady === true;
  const pressureInterfaceGasCellFieldAdmissionApproved = !localPressureGradientReady
    || isPressureInterfaceGasCellFieldAdmissionApproved(pressureInterfaceGasCellFieldAdmission);
  const pressureInterfaceGasCellFieldAdmissionStatus = localPressureGradientReady
    ? (pressureInterfaceGasCellFieldAdmissionApproved
        ? 'pressure-interface-gas-cell-field-consumption-approved'
        : 'pressure-interface-gas-cell-field-admission-required')
    : 'not-required-uniform-pressure-field';
  const pressureInterfaceGasCellFieldConsumerStatus = localPressureGradientReady
    ? (pressureInterfaceGasCellFieldAdmissionApproved
        ? 'admitted-local-gas-cell-field-consumer-ready'
        : 'blocked-local-gas-cell-field-admission-required')
    : 'uniform-pressure-field-no-local-gas-cell-admission-required';
  let pressureResult = null;
  let webgpuStatus = null;
  if (
    stageOptions.preferWebGpu === true
    && typeof pressureInterfaceForceRowsWebGpuRunner === 'function'
  ) {
    let deviceResult = stageOptions.deviceResult || null;
    if (!deviceResult?.device && stageOptions.device?.createBuffer) {
      deviceResult = { status: 'webgpu-ready-supplied-device', device: stageOptions.device };
    }
    if (!deviceResult?.device && (stageOptions.navigatorRef || globalThis.navigator)) {
      deviceResult = await requestOpticalGpuDevice(stageOptions.navigatorRef || globalThis.navigator);
    }
    if (deviceResult?.device?.createBuffer && deviceResult.device.queue?.writeBuffer) {
      try {
        pressureResult = await pressureInterfaceForceRowsWebGpuRunner({
          device: deviceResult.device,
          pressureFeedback,
          pressureInterfaceCoupling,
          pressureInterfaceForcePreview,
          materialInterfaceField: stageOptions.materialInterfaceField || null,
          algorithmMaterialContactRows: stageOptions.algorithmMaterialContactRows || null,
          algorithmContactPairResponseScale: stageOptions.algorithmContactPairResponseScale,
          algorithmContactMaxPressurePa: stageOptions.algorithmContactMaxPressurePa,
          sphParticleState: stageOptions.sphParticleState || null,
          sphParticleUpload: stageOptions.sphParticleUpload || null,
          particleStateBuffer: stageOptions.particleStateBuffer || stageOptions.sourceStateBuffer || stageOptions.sphParticleUpload?.stateBuffer || null,
          particleThermoBuffer: stageOptions.particleThermoBuffer || stageOptions.sourceThermoBuffer || stageOptions.sphParticleUpload?.thermoBuffer || null,
          particleCount: stageOptions.particleCount ?? stageOptions.sphParticleState?.particleCount ?? stageOptions.sphParticleUpload?.particleCount ?? null,
          boxDimsM: stageOptions.boxDimsM || null,
          retainForceRowsBuffer: stageOptions.retainForceRowsBuffer !== false,
          contactKinematicsParticleBinMetadataReadback:
            stageOptions.contactKinematicsParticleBinMetadataReadback === true,
          readbackMode: stageOptions.readbackMode === NO_FULL_READBACK_MODE ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE
        });
        webgpuStatus = {
          status: 'webgpu-executed',
          fallback: null,
          deviceStatus: deviceResult.status || null
        };
      } catch (error) {
        webgpuStatus = {
          status: 'webgpu-failed',
          fallback: 'cpu-reference',
          reason: error?.message || String(error)
        };
        pressureResult = null;
      }
    } else {
      webgpuStatus = {
        status: 'blocked-webgpu-unavailable',
        fallback: 'cpu-reference',
        reason: deviceResult?.reason || deviceResult?.status || 'webgpu-device-unavailable'
      };
    }
  }
  const pressureInterfaceForceSolver = pressureResult?.pressureInterfaceForceSolver || await pressureInterfaceForceSolverRunner({
    pressureFeedback,
    materialInterfaceField: stageOptions.materialInterfaceField || null,
    pressureInterfaceCoupling,
    algorithmMaterialContactRows: stageOptions.algorithmMaterialContactRows || null,
    algorithmContactPairResponseScale: stageOptions.algorithmContactPairResponseScale,
    algorithmContactMaxPressurePa: stageOptions.algorithmContactMaxPressurePa
  });
  const forceRowValues = pressureInterfaceForceSolver?.forceRowValues instanceof Float32Array
    ? pressureInterfaceForceSolver.forceRowValues
    : new Float32Array(0);
  pressureResult = {
    schema: ULG_SPH_PRESSURE_INTERFACE_STAGE_COMPUTE_TASK_RESULT_SCHEMA,
    ...(pressureResult || {}),
    backend: pressureResult?.backend || 'cpu-reference',
    status: pressureInterfaceForceSolver?.status === 'pressure-interface-force-solver-ready'
      ? 'pressure-interface-stage-solver-ready'
      : 'pressure-interface-stage-solver-blocked',
    readbackMode: stageOptions.readbackMode === NO_FULL_READBACK_MODE ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE,
    fullReadbackPerformed: pressureResult?.fullReadbackPerformed === true,
    normalHotLoopReadbackFree: pressureResult?.normalHotLoopReadbackFree ?? true,
    webgpuStatus,
    pressureFeedback,
    pressureInterfaceCoupling,
    pressureInterfaceForcePreview,
    pressureInterfaceForceSolver,
    pressureInterfaceGasCellFieldAdmission,
    pressureInterfaceGasCellFieldAdmissionSchema: pressureInterfaceGasCellFieldAdmission?.schema || null,
    pressureInterfaceGasCellFieldAdmissionStatus,
    pressureInterfaceGasCellFieldAdmissionApproved,
    pressureInterfaceGasCellFieldConsumerStatus,
    pressureInterfaceGasCellFieldImport,
    pressureInterfaceGasCellFieldImportSchema: pressureInterfaceGasCellFieldImport.schema,
    pressureInterfaceGasCellFieldImportStatus: pressureInterfaceGasCellFieldImport.status,
    pressureInterfaceGasCellFieldImportReady: pressureInterfaceGasCellFieldImport.importReady === true,
    pressureInterfaceGasCellFieldImportSourceHotBufferKey: pressureInterfaceGasCellFieldImport.sourceHotBufferKey || null,
    pressureInterfaceGasCellFieldImportRetainedGasPressureBufferRefs: [...pressureInterfaceGasCellFieldImport.retainedGasPressureBufferRefs],
    forceRowCount: finiteNumber(pressureInterfaceForceSolver?.forceRowCount, 0),
    forceRowStrideFloats: finiteNumber(pressureInterfaceForceSolver?.forceRowStrideFloats, SPH_PRESSURE_INTERFACE_FORCE_FLOATS),
    forceRowByteLength: pressureResult?.forceRowByteLength ?? forceRowValues.byteLength,
    forceRowValues,
    pressureInterfaceForceRowsRetained: pressureResult?.pressureInterfaceForceRowsRetained === true || forceRowValues.byteLength > 0,
    pressureInterfaceForceRowsBufferByteLength: pressureResult?.forceRowsBufferByteLength ?? pressureResult?.forceRowByteLength ?? forceRowValues.byteLength,
    pressureInterfaceForceRowsBufferRetained: Boolean(pressureResult?.forceRowsBuffer || pressureResult?.pressureInterfaceForceRowsBuffer)
      || pressureInterfaceForceSolver?.forceRowsBufferRetained === true,
    algorithmContactPairResponseSchema: pressureInterfaceForceSolver?.algorithmContactPairResponseSchema || null,
    algorithmContactPairResponseStatus: pressureInterfaceForceSolver?.algorithmContactPairResponseStatus || null,
    algorithmContactPolicyRowsSchema: pressureInterfaceForceSolver?.algorithmContactPolicyRowsSchema || null,
    algorithmContactPolicyRowsStatus: pressureInterfaceForceSolver?.algorithmContactPolicyRowsStatus || null,
    algorithmContactPolicyRowCount: finiteNumber(pressureInterfaceForceSolver?.algorithmContactPolicyRowCount, 0),
    algorithmContactForceRowCount: finiteNumber(pressureInterfaceForceSolver?.algorithmContactForceRowCount, 0),
    algorithmContactPairKeys: Array.isArray(pressureInterfaceForceSolver?.algorithmContactPairKeys)
      ? [...pressureInterfaceForceSolver.algorithmContactPairKeys]
      : [],
    maxAlgorithmContactPressurePa: finiteNumber(pressureInterfaceForceSolver?.maxAlgorithmContactPressurePa, 0),
    interfaceContactKinematicsStatus: pressureInterfaceForceSolver?.interfaceContactKinematicsStatus || null,
    interfaceContactKinematicsRowCount: finiteNumber(pressureInterfaceForceSolver?.interfaceContactKinematicsRowCount, 0),
    interfaceContactKinematicsReadyCount: finiteNumber(pressureInterfaceForceSolver?.interfaceContactKinematicsReadyCount, 0),
    interfaceContactKinematicsGpuDerivationEligible: pressureInterfaceForceSolver?.interfaceContactKinematicsGpuDerivationEligible === true,
    interfaceContactKinematicsGpuDerived: pressureInterfaceForceSolver?.interfaceContactKinematicsGpuDerived === true,
    interfaceContactKinematicsDerivationStatus: pressureInterfaceForceSolver?.interfaceContactKinematicsDerivationStatus || null,
    interfaceContactKinematicsParticleSourceStatus: pressureInterfaceForceSolver?.interfaceContactKinematicsParticleSourceStatus || null,
    interfaceContactKinematicsParticleCount: finiteNumber(pressureInterfaceForceSolver?.interfaceContactKinematicsParticleCount, 0),
    interfaceContactKinematicsParticleBinGridStatus: pressureInterfaceForceSolver?.interfaceContactKinematicsParticleBinGridStatus || null,
    interfaceContactKinematicsParticleBinGridEnabled: pressureInterfaceForceSolver?.interfaceContactKinematicsParticleBinGridEnabled === true,
    interfaceContactKinematicsParticleBinGridCellCount: finiteNumber(pressureInterfaceForceSolver?.interfaceContactKinematicsParticleBinGridCellCount, 0),
    interfaceContactKinematicsParticleBinGridBinCapacity: finiteNumber(pressureInterfaceForceSolver?.interfaceContactKinematicsParticleBinGridBinCapacity, 0),
    interfaceContactKinematicsParticleBinGridAverageOccupancy: finiteNumber(pressureInterfaceForceSolver?.interfaceContactKinematicsParticleBinGridAverageOccupancy, 0),
    interfaceContactKinematicsParticleBinGridEstimatedOverflowRisk: pressureInterfaceForceSolver?.interfaceContactKinematicsParticleBinGridEstimatedOverflowRisk === true,
    interfaceContactKinematicsParticleBinGridIndexBufferByteLength: finiteNumber(pressureInterfaceForceSolver?.interfaceContactKinematicsParticleBinGridIndexBufferByteLength, 0),
    interfaceContactKinematicsParticleBinOverflowStatus: pressureInterfaceForceSolver?.interfaceContactKinematicsParticleBinOverflowStatus || null,
    interfaceContactKinematicsParticleBinOverflowCount: pressureInterfaceForceSolver?.interfaceContactKinematicsParticleBinOverflowCount ?? null
  };
  const fenceRequirement = gpuFenceRequirement || gpuResidentLane || { required: false };
  const gpuFence = createSphPressureInterfaceStageGpuFenceReport(pressureResult, fenceRequirement);
  const pressureInterfaceStageTaskEvidence = createSphPressureInterfaceStageTaskEvidence(pressureResult, {
    computeTaskId,
    lawGraphNode,
    gpuFenceRequirement: fenceRequirement
  });
  return {
    ...pressureResult,
    computeTaskResultSchema: ULG_SPH_PRESSURE_INTERFACE_STAGE_COMPUTE_TASK_RESULT_SCHEMA,
    computeTaskSchema,
    computeTaskId,
    lawGraphNode,
    gpuFence,
    gpuFenceReport: gpuFence,
    gpuResidentLaneRequirement: gpuResidentLane || null,
    expectedOutputFamilies: [...expectedOutputFamilies],
    pressureInterfaceStageTask: pressureInterfaceStageTask === true,
    pressureInterfaceStageTaskEvidence,
    pressureInterfaceStageTaskAuthority: {
      schema: 'peercompute.ulg.pressure-interface-stage-task-authority.v0',
      status: 'compute-manager-owned-non-mutating-pressure-interface-stage-task',
      taskId: computeTaskId,
      lawGraphNodeId: lawGraphNode?.nodeId || 'ulg-pressure-interface-force-law',
      solverId: lawGraphNode?.solverId || 'ulg-sph-pressure-interface-stage',
      readFamilies: [...(lawGraphNode?.readFamilies || ['resident-gas-pressure', 'sph-material-interface-field'])],
      writeFamilies: [...(lawGraphNode?.writeFamilies || ['pressure-interface-force-rows'])],
      pressureInterfaceGasCellFieldAdmissionRequired: localPressureGradientReady,
      pressureInterfaceGasCellFieldAdmissionApproved,
      pressureInterfaceGasCellFieldImportReady: pressureInterfaceGasCellFieldImport.importReady === true,
      commitDeltaSuppressed: true,
      authoritativeStateMutation: false,
      gridForceApplicationApproved: false,
      gpuFenceRequired: gpuFenceRequirement?.required === true,
      gpuFenceSatisfied: gpuFence.fenceSatisfied === true
    }
  };
}

export function submitSphPressureInterfaceStageComputeTask({ computeManager, ...taskOptions } = {}) {
  if (!computeManager || typeof computeManager.submitTask !== 'function') {
    throw new Error('submitSphPressureInterfaceStageComputeTask requires a ComputeManager-compatible submitTask() method');
  }
  return computeManager.submitTask(createSphPressureInterfaceStageComputeTask(taskOptions));
}

function createSphThermalPhaseStageTaskEvidence(thermalExecution = {}, {
  computeTaskId = null,
  lawGraphNode = null,
  gpuFenceRequirement = null
} = {}) {
  const result = thermalExecution?.result || thermalExecution || {};
  const backend = thermalExecution?.backend || result?.backend || null;
  const stateOutputPresent = Boolean(result?.stateBuffer || result?.state instanceof Float32Array || result?.state?.length > 0);
  const thermoOutputPresent = Boolean(result?.thermoBuffer || result?.thermo instanceof Float32Array || result?.thermo?.length > 0);
  const acceptedBackend = backend === 'webgpu' || backend === 'cpu-reference';
  const passed = acceptedBackend && thermoOutputPresent;
  return {
    schema: ULG_SPH_THERMAL_PHASE_STAGE_TASK_EVIDENCE_SCHEMA,
    passed,
    status: passed ? 'thermal-phase-stage-task-evidence-pass' : 'thermal-phase-stage-task-evidence-fail',
    reason: passed
      ? 'thermal-phase-stage-task-produced-thermo-output'
      : (!acceptedBackend ? 'thermal-phase-stage-task-backend-invalid' : 'thermal-phase-stage-task-thermo-output-missing'),
    computeTaskId,
    lawGraphNodeId: lawGraphNode?.nodeId || 'ulg-thermal-phase-law',
    solverId: lawGraphNode?.solverId || 'ulg-sph-thermal-phase-stage',
    stageId: 'thermalPhase',
    executionSource: 'runSphThermalStepWithOptionalWebGpu',
    backend,
    acceptedBackend,
    executionStatus: thermalExecution?.status || result?.status || null,
    readbackMode: result?.readbackMode || thermalExecution?.readbackMode || null,
    fullReadbackPerformed: result?.fullReadbackPerformed === true,
    normalHotLoopReadbackFree: result?.normalHotLoopReadbackFree === true,
    particleCount: finiteNumber(result?.particleCount, 0),
    outputBuffersRetained: Boolean(result?.retainedOutputParticleBuffers || result?.stateBuffer || result?.thermoBuffer),
    stateOutputPresent,
    thermoOutputPresent,
    webgpuStatus: thermalExecution?.webgpuStatus ? { ...thermalExecution.webgpuStatus } : null,
    webgpuParityStatus: thermalExecution?.webgpuParity?.status || null,
    gpuFenceRequired: gpuFenceRequirement?.required === true,
    readFamilies: ['sph-particle-state', 'sph-thermo-phase', 'mls-mpm-mechanics'],
    candidateWriteFamilies: ['sph-thermo-phase'],
    authoritativeWriteFamilies: [],
    mustNotWriteFamilies: ['mls-mpm-mechanics', 'resident-product-mass', 'pressure-interface-force-rows'],
    promotionStatus: 'thermal-phase-stage-task-evidence-only-not-authoritative',
    scientificValidation: false,
    materialValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function createSphThermalPhaseStageGpuFenceReport(thermalExecution = {}, requirement = {}) {
  const result = thermalExecution?.result || thermalExecution || {};
  const required = requirement?.required === true;
  const webgpuCompleted = (thermalExecution?.backend || result?.backend) !== 'webgpu'
    || result?.fullReadbackPerformed === true
    || thermalExecution?.webgpuStatus?.status === 'webgpu-executed';
  const fenceSatisfied = !required || webgpuCompleted;
  return {
    schema: PEERCOMPUTE_GPU_FENCE_REPORT_SCHEMA,
    required,
    fenceSatisfied,
    status: fenceSatisfied ? 'gpu-fence-satisfied' : 'gpu-fence-unsatisfied',
    reason: fenceSatisfied
      ? (required ? 'thermal-phase-stage-queue-completion-evidenced' : 'gpu-fence-not-required')
      : 'thermal-phase-stage-queue-completion-not-evidenced',
    laneId: requirement?.laneId || null,
    stateKey: requirement?.stateKey || null,
    source: 'ulg-sph-thermal-phase-stage-compute-task',
    backend: thermalExecution?.backend || result?.backend || null,
    readbackMode: result?.readbackMode || thermalExecution?.readbackMode || null,
    fullReadbackPerformed: result?.fullReadbackPerformed === true
  };
}

export function createSphThermalPhaseStageComputeTask({
  modulePath,
  taskId = null,
  taskFamily = 'ulg-sph-thermal-phase-stage',
  solverId = 'ulg-sph-thermal-phase-stage',
  owner = 'ulg-thermal-phase-law',
  lawGraphId = 'peercompute.ulg.local-sph-law-closure-graph',
  lawGraphNodeId = 'ulg-thermal-phase-law',
  laneId = 'ulg:thermal-phase-stage:active',
  stateKey = 'ulg:thermal-phase-stage-state',
  domainKey = null,
  localExecution = 'inline',
  queueFencePolicy = 'queue.onSubmittedWorkDone-before-admission',
  readFamilies = ['sph-particle-state', 'sph-thermo-phase', 'mls-mpm-mechanics'],
  writeFamilies = ['sph-thermo-phase'],
  retainedBufferRefs = ['sph-state-buffer', 'sph-thermo-buffer'],
  returnEnvelope = true,
  suppressCommitDelta = true,
  ...stageOptions
} = {}) {
  if (typeof modulePath !== 'string' || modulePath.trim() === '') {
    throw new Error('createSphThermalPhaseStageComputeTask requires a modulePath for the ULG thermal/phase stage task handler');
  }
  const {
    gpuResidentLaneManager: _ignoredLaneManager,
    gpuResidentLaneId: _ignoredLaneId,
    gpuResidentLaneStateKey: _ignoredLaneStateKey,
    gpuResidentLaneDomainKey: _ignoredLaneDomainKey,
    ...taskStageOptions
  } = stageOptions;
  const readbackMode = taskStageOptions.readbackMode === NO_FULL_READBACK_MODE ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE;
  const requiresGpuLane = taskStageOptions.preferWebGpu === true
    || readbackMode === NO_FULL_READBACK_MODE
    || Boolean(taskStageOptions.sphParticleUpload || taskStageOptions.sourceStateBuffer || taskStageOptions.sourceThermoBuffer);
  const lawGraphNode = createResidentLawGraphNodeTaskRef({
    graphId: lawGraphId,
    nodeId: lawGraphNodeId,
    solverId,
    readFamilies,
    writeFamilies,
    requiredClosures: ['thermal-material-table', 'thermal-phase-response-table'],
    validationGates: [
      'phase-boundary-oracle',
      'energy-ledger',
      'wall-heat-boundary-contract',
      'gpu-fence-report'
    ],
    cachePolicy: 'hot-thermal-phase-stage-gpu-lane-or-cpu-oracle'
  });
  const gpuFence = requiresGpuLane
    ? createResidentGpuFenceRequirement({
        laneId,
        stateKey,
        queueFencePolicy,
        retainedBufferRefs,
        source: 'ulg-sph-thermal-phase-stage-compute-task',
        required: true
      })
    : null;
  const gpuResidentLane = requiresGpuLane
    ? createResidentGpuLaneTaskDescriptor({
        laneId,
        stateKey,
        domainKey,
        solverId,
        owner,
        localExecution,
        readFamilies,
        writeFamilies,
        retainedBufferRefs,
        queueFencePolicy,
        copyBudget: computeResidentLaneTaskCopyBudget({
          ...taskStageOptions,
          readbackMode,
          gpuResidentLaneCopyBudget: stageOptions.gpuResidentLaneCopyBudget
        })
      })
    : null;
  const id = taskId || `ulg-sph-thermal-phase-stage:${finiteNumber(taskStageOptions.sphParticleState?.step, 0)}`;
  return {
    schema: ULG_SPH_THERMAL_PHASE_STAGE_COMPUTE_TASK_SCHEMA,
    id,
    runtime: 'js',
    taskFamily,
    solverId,
    module: modulePath,
    exportName: 'runSphThermalPhaseStageComputeTask',
    returnEnvelope,
    suppressCommitDelta,
    residency: requiresGpuLane ? 'gpu-lane' : 'cpu-oracle',
    lawGraphNode,
    readFamilies: [...readFamilies],
    writeFamilies: [...writeFamilies],
    expectedOutputFamilies: [...writeFamilies],
    ...(requiresGpuLane ? {
      webgpu: {
        residency: 'gpu-lane',
        requiresQueueFence: true,
        laneId,
        stateKey,
        domainKey,
        queueFencePolicy,
        retainedBufferRefs: [...retainedBufferRefs],
        copyBudget: { ...gpuResidentLane.copyBudget }
      },
      gpuFence,
      gpuResidentLane
    } : {}),
    data: {
      ...taskStageOptions,
      readbackMode,
      retainOutputParticleBuffers: taskStageOptions.retainOutputParticleBuffers ?? true,
      gpuFenceRequirement: gpuFence,
      gpuResidentLane,
      lawGraphNode,
      computeTaskSchema: ULG_SPH_THERMAL_PHASE_STAGE_COMPUTE_TASK_SCHEMA,
      computeTaskId: id,
      expectedOutputFamilies: [...writeFamilies],
      thermalPhaseStageTask: true
    }
  };
}

export async function runSphThermalPhaseStageComputeTask(data = {}) {
  const {
    gpuResidentLaneManager: _ignoredLaneManager,
    gpuFenceRequirement = null,
    gpuResidentLane = null,
    lawGraphNode = null,
    computeTaskSchema = ULG_SPH_THERMAL_PHASE_STAGE_COMPUTE_TASK_SCHEMA,
    computeTaskId = null,
    expectedOutputFamilies = [],
    thermalPhaseStageTask = true,
    thermalStepRunner = runSphThermalStepWithOptionalWebGpu,
    ...stageOptions
  } = data || {};
  const thermalExecution = await thermalStepRunner({
    ...stageOptions,
    retainOutputParticleBuffers: stageOptions.retainOutputParticleBuffers ?? true
  });
  const thermalResult = thermalExecution?.result || thermalExecution || {};
  const fenceRequirement = gpuFenceRequirement || gpuResidentLane || { required: false };
  const gpuFence = createSphThermalPhaseStageGpuFenceReport(thermalExecution, fenceRequirement);
  const thermalPhaseStageTaskEvidence = createSphThermalPhaseStageTaskEvidence(thermalExecution, {
    computeTaskId,
    lawGraphNode,
    gpuFenceRequirement: fenceRequirement
  });
  return {
    ...thermalResult,
    backend: thermalExecution?.backend || thermalResult?.backend || null,
    status: thermalExecution?.status || thermalResult?.status || null,
    thermalExecution,
    computeTaskResultSchema: ULG_SPH_THERMAL_PHASE_STAGE_COMPUTE_TASK_RESULT_SCHEMA,
    computeTaskSchema,
    computeTaskId,
    lawGraphNode,
    gpuFence,
    gpuFenceReport: gpuFence,
    gpuResidentLaneRequirement: gpuResidentLane || null,
    expectedOutputFamilies: [...expectedOutputFamilies],
    thermalPhaseStageTask: thermalPhaseStageTask === true,
    thermalPhaseStageTaskEvidence,
    thermalPhaseStageTaskAuthority: {
      schema: 'peercompute.ulg.thermal-phase-stage-task-authority.v0',
      status: 'compute-manager-owned-non-mutating-thermal-phase-stage-task',
      taskId: computeTaskId,
      lawGraphNodeId: lawGraphNode?.nodeId || 'ulg-thermal-phase-law',
      solverId: lawGraphNode?.solverId || 'ulg-sph-thermal-phase-stage',
      readFamilies: [...(lawGraphNode?.readFamilies || ['sph-particle-state', 'sph-thermo-phase', 'mls-mpm-mechanics'])],
      writeFamilies: [...(lawGraphNode?.writeFamilies || ['sph-thermo-phase'])],
      commitDeltaSuppressed: true,
      authoritativeStateMutation: false,
      gpuFenceRequired: gpuFenceRequirement?.required === true,
      gpuFenceSatisfied: gpuFence.fenceSatisfied === true
    }
  };
}

export function submitSphThermalPhaseStageComputeTask({ computeManager, ...taskOptions } = {}) {
  if (!computeManager || typeof computeManager.submitTask !== 'function') {
    throw new Error('submitSphThermalPhaseStageComputeTask requires a ComputeManager-compatible submitTask() method');
  }
  return computeManager.submitTask(createSphThermalPhaseStageComputeTask(taskOptions));
}

function createSphReactionProductStageTaskEvidence(reactionExecution = {}, {
  computeTaskId = null,
  lawGraphNode = null,
  gpuFenceRequirement = null
} = {}) {
  const result = reactionExecution?.result || reactionExecution || {};
  const backend = reactionExecution?.backend || result?.backend || null;
  const stateOutputPresent = Boolean(result?.stateBuffer || result?.state instanceof Float32Array || result?.state?.length > 0);
  const thermoOutputPresent = Boolean(result?.thermoBuffer || result?.thermo instanceof Float32Array || result?.thermo?.length > 0);
  const mechanicsOutputPresent = Boolean(result?.mechanicsBuffer || result?.mechanics instanceof Float32Array || result?.mechanics?.length > 0);
  const residentProductMassPresent = Boolean(
    result?.residentProductMass
      || result?.residentProductMassBufferRetained
      || result?.reactionSummary?.productEventBufferRetained
      || result?.reactionSummary?.productInventory?.schema
  );
  const acceptedBackend = backend === 'webgpu' || backend === 'cpu-reference';
  const passed = acceptedBackend && stateOutputPresent && thermoOutputPresent && mechanicsOutputPresent;
  return {
    schema: ULG_SPH_REACTION_PRODUCT_STAGE_TASK_EVIDENCE_SCHEMA,
    passed,
    status: passed ? 'reaction-product-stage-task-evidence-pass' : 'reaction-product-stage-task-evidence-fail',
    reason: passed
      ? 'reaction-product-stage-produced-particle-output'
      : (!acceptedBackend
        ? 'reaction-product-stage-task-backend-invalid'
        : 'reaction-product-stage-output-missing'),
    computeTaskId,
    lawGraphNodeId: lawGraphNode?.nodeId || 'ulg-reaction-product-gas-law',
    solverId: lawGraphNode?.solverId || 'ulg-sph-reaction-product-stage',
    stageId: REACTION_PRODUCT_STAGE_ID,
    executionSource: 'runSphReactionStepWithOptionalWebGpu',
    backend,
    acceptedBackend,
    executionStatus: reactionExecution?.status || result?.status || null,
    readbackMode: result?.readbackMode || reactionExecution?.readbackMode || null,
    fullReadbackPerformed: result?.fullReadbackPerformed === true,
    normalHotLoopReadbackFree: result?.normalHotLoopReadbackFree === true,
    particleCount: finiteNumber(result?.particleCount, 0),
    reactionCount: finiteNumber(result?.reactionCount, 0),
    productTermCount: finiteNumber(result?.productTermCount, 0),
    gasProductCount: finiteNumber(result?.gasProductCount, 0),
    outputBuffersRetained: Boolean(result?.retainedOutputParticleBuffers || result?.stateBuffer || result?.thermoBuffer || result?.mechanicsBuffer),
    stateOutputPresent,
    thermoOutputPresent,
    mechanicsOutputPresent,
    residentProductMassPresent,
    residentProductMassStatus: result?.residentProductMassStatus || result?.residentProductMass?.status || null,
    residentProductMassBufferRetained: result?.residentProductMassBufferRetained === true
      || result?.residentProductMass?.productEventBufferRetained === true,
    webgpuStatus: reactionExecution?.webgpuStatus ? { ...reactionExecution.webgpuStatus } : null,
    webgpuParityStatus: reactionExecution?.webgpuParity?.status || null,
    gpuFenceRequired: gpuFenceRequirement?.required === true,
    readFamilies: ['sph-particle-state', 'sph-thermo-phase', 'mls-mpm-mechanics', 'reaction-closure-table'],
    candidateWriteFamilies: ['sph-particle-state', 'sph-thermo-phase', 'mls-mpm-mechanics', 'resident-product-mass'],
    authoritativeWriteFamilies: [],
    mustNotWriteFamilies: ['pressure-interface-force-rows'],
    promotionStatus: 'reaction-product-stage-task-evidence-only-not-authoritative',
    scientificValidation: false,
    materialValidation: false,
    chemistryValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function createSphReactionProductStageGpuFenceReport(reactionExecution = {}, requirement = {}) {
  const result = reactionExecution?.result || reactionExecution || {};
  const required = requirement?.required === true;
  const status = reactionExecution?.webgpuStatus?.status || null;
  const webgpuCompleted = (reactionExecution?.backend || result?.backend) !== 'webgpu'
    || result?.fullReadbackPerformed === true
    || status === 'webgpu-executed'
    || status === 'webgpu-executed-no-full-readback';
  const fenceSatisfied = !required || webgpuCompleted;
  return {
    schema: PEERCOMPUTE_GPU_FENCE_REPORT_SCHEMA,
    required,
    fenceSatisfied,
    status: fenceSatisfied ? 'gpu-fence-satisfied' : 'gpu-fence-unsatisfied',
    reason: fenceSatisfied
      ? (required ? 'reaction-product-stage-queue-completion-evidenced' : 'gpu-fence-not-required')
      : 'reaction-product-stage-queue-completion-not-evidenced',
    laneId: requirement?.laneId || null,
    stateKey: requirement?.stateKey || null,
    source: 'ulg-sph-reaction-product-stage-compute-task',
    backend: reactionExecution?.backend || result?.backend || null,
    readbackMode: result?.readbackMode || reactionExecution?.readbackMode || null,
    fullReadbackPerformed: result?.fullReadbackPerformed === true
  };
}

export function createSphReactionProductStageComputeTask({
  modulePath,
  taskId = null,
  taskFamily = 'ulg-sph-reaction-product-stage',
  solverId = 'ulg-sph-reaction-product-stage',
  owner = 'ulg-reaction-product-gas-law',
  lawGraphId = 'peercompute.ulg.local-sph-law-closure-graph',
  lawGraphNodeId = 'ulg-reaction-product-gas-law',
  laneId = 'ulg:reaction-product-stage:active',
  stateKey = 'ulg:reaction-product-stage-state',
  domainKey = null,
  localExecution = 'inline',
  queueFencePolicy = 'queue.onSubmittedWorkDone-before-admission',
  readFamilies = ['sph-particle-state', 'sph-thermo-phase', 'mls-mpm-mechanics', 'reaction-closure-table'],
  writeFamilies = ['sph-particle-state', 'sph-thermo-phase', 'mls-mpm-mechanics', 'resident-product-mass'],
  retainedBufferRefs = ['sph-state-buffer', 'sph-thermo-buffer', 'mls-mpm-mechanics-buffer', 'resident-product-mass-buffer'],
  returnEnvelope = true,
  suppressCommitDelta = true,
  ...stageOptions
} = {}) {
  if (typeof modulePath !== 'string' || modulePath.trim() === '') {
    throw new Error('createSphReactionProductStageComputeTask requires a modulePath for the ULG reaction/product stage task handler');
  }
  const {
    gpuResidentLaneManager: _ignoredLaneManager,
    gpuResidentLaneId: _ignoredLaneId,
    gpuResidentLaneStateKey: _ignoredLaneStateKey,
    gpuResidentLaneDomainKey: _ignoredLaneDomainKey,
    ...taskStageOptions
  } = stageOptions;
  const readbackMode = taskStageOptions.readbackMode === NO_FULL_READBACK_MODE ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE;
  const requiresGpuLane = taskStageOptions.preferWebGpu === true
    || readbackMode === NO_FULL_READBACK_MODE
    || Boolean(taskStageOptions.sphParticleUpload || taskStageOptions.sourceStateBuffer || taskStageOptions.sourceThermoBuffer || taskStageOptions.sourceMechanicsBuffer);
  const lawGraphNode = createResidentLawGraphNodeTaskRef({
    graphId: lawGraphId,
    nodeId: lawGraphNodeId,
    solverId,
    readFamilies,
    writeFamilies,
    requiredClosures: ['reaction-table', 'thermal-material-table', 'thermal-phase-response-table', 'sedenion-reaction-scope'],
    validationGates: [
      'reaction-mass-ledger',
      'stoichiometry-ledger',
      'sedenion-scope-check',
      'gpu-fence-report'
    ],
    cachePolicy: 'hot-reaction-product-stage-gpu-lane-or-cpu-oracle'
  });
  const gpuFence = requiresGpuLane
    ? createResidentGpuFenceRequirement({
        laneId,
        stateKey,
        queueFencePolicy,
        retainedBufferRefs,
        source: 'ulg-sph-reaction-product-stage-compute-task',
        required: true
      })
    : null;
  const gpuResidentLane = requiresGpuLane
    ? createResidentGpuLaneTaskDescriptor({
        laneId,
        stateKey,
        domainKey,
        solverId,
        owner,
        localExecution,
        readFamilies,
        writeFamilies,
        retainedBufferRefs,
        queueFencePolicy,
        copyBudget: computeResidentLaneTaskCopyBudget({
          ...taskStageOptions,
          readbackMode,
          gpuResidentLaneCopyBudget: stageOptions.gpuResidentLaneCopyBudget
        })
      })
    : null;
  const id = taskId || `ulg-sph-reaction-product-stage:${finiteNumber(taskStageOptions.sphParticleState?.step, 0)}`;
  return {
    schema: ULG_SPH_REACTION_PRODUCT_STAGE_COMPUTE_TASK_SCHEMA,
    id,
    runtime: 'js',
    taskFamily,
    solverId,
    module: modulePath,
    exportName: 'runSphReactionProductStageComputeTask',
    returnEnvelope,
    suppressCommitDelta,
    residency: requiresGpuLane ? 'gpu-lane' : 'cpu-oracle',
    lawGraphNode,
    readFamilies: [...readFamilies],
    writeFamilies: [...writeFamilies],
    expectedOutputFamilies: [...writeFamilies],
    ...(requiresGpuLane ? {
      webgpu: {
        residency: 'gpu-lane',
        requiresQueueFence: true,
        laneId,
        stateKey,
        domainKey,
        queueFencePolicy,
        retainedBufferRefs: [...retainedBufferRefs],
        copyBudget: { ...gpuResidentLane.copyBudget }
      },
      gpuFence,
      gpuResidentLane
    } : {}),
    data: {
      ...taskStageOptions,
      readbackMode,
      retainOutputParticleBuffers: taskStageOptions.retainOutputParticleBuffers ?? true,
      ...(readbackMode === NO_FULL_READBACK_MODE ? {
        readCompactReactionSummary: taskStageOptions.readCompactReactionSummary ?? true,
        readReactionGasSpeciesSummary: taskStageOptions.readReactionGasSpeciesSummary ?? true,
        readReactionProductInventory: taskStageOptions.readReactionProductInventory ?? false,
        readReactionAtomResidual: taskStageOptions.readReactionAtomResidual ?? false
      } : {}),
      gpuFenceRequirement: gpuFence,
      gpuResidentLane,
      lawGraphNode,
      computeTaskSchema: ULG_SPH_REACTION_PRODUCT_STAGE_COMPUTE_TASK_SCHEMA,
      computeTaskId: id,
      expectedOutputFamilies: [...writeFamilies],
      reactionProductStageTask: true
    }
  };
}

export async function runSphReactionProductStageComputeTask(data = {}) {
  const {
    gpuResidentLaneManager: _ignoredLaneManager,
    gpuFenceRequirement = null,
    gpuResidentLane = null,
    lawGraphNode = null,
    computeTaskSchema = ULG_SPH_REACTION_PRODUCT_STAGE_COMPUTE_TASK_SCHEMA,
    computeTaskId = null,
    expectedOutputFamilies = [],
    reactionProductStageTask = true,
    reactionStepRunner = runSphReactionStepWithOptionalWebGpu,
    ...stageOptions
  } = data || {};
  const reactionExecution = await reactionStepRunner({
    ...stageOptions,
    retainOutputParticleBuffers: stageOptions.retainOutputParticleBuffers ?? true
  });
  const reactionResult = reactionExecution?.result || reactionExecution || {};
  const fenceRequirement = gpuFenceRequirement || gpuResidentLane || { required: false };
  const gpuFence = createSphReactionProductStageGpuFenceReport(reactionExecution, fenceRequirement);
  const reactionProductStageTaskEvidence = createSphReactionProductStageTaskEvidence(reactionExecution, {
    computeTaskId,
    lawGraphNode,
    gpuFenceRequirement: fenceRequirement
  });
  return {
    ...reactionResult,
    backend: reactionExecution?.backend || reactionResult?.backend || null,
    status: reactionExecution?.status || reactionResult?.status || null,
    reactionExecution,
    computeTaskResultSchema: ULG_SPH_REACTION_PRODUCT_STAGE_COMPUTE_TASK_RESULT_SCHEMA,
    computeTaskSchema,
    computeTaskId,
    lawGraphNode,
    gpuFence,
    gpuFenceReport: gpuFence,
    gpuResidentLaneRequirement: gpuResidentLane || null,
    expectedOutputFamilies: [...expectedOutputFamilies],
    reactionProductStageTask: reactionProductStageTask === true,
    reactionProductStageTaskEvidence,
    reactionProductStageTaskAuthority: {
      schema: 'peercompute.ulg.reaction-product-stage-task-authority.v0',
      status: 'compute-manager-owned-non-mutating-reaction-product-stage-task',
      taskId: computeTaskId,
      lawGraphNodeId: lawGraphNode?.nodeId || 'ulg-reaction-product-gas-law',
      solverId: lawGraphNode?.solverId || 'ulg-sph-reaction-product-stage',
      readFamilies: [...(lawGraphNode?.readFamilies || ['sph-particle-state', 'sph-thermo-phase', 'mls-mpm-mechanics', 'reaction-closure-table'])],
      writeFamilies: [...(lawGraphNode?.writeFamilies || ['sph-particle-state', 'sph-thermo-phase', 'mls-mpm-mechanics', 'resident-product-mass'])],
      commitDeltaSuppressed: true,
      authoritativeStateMutation: false,
      gpuFenceRequired: gpuFenceRequirement?.required === true,
      gpuFenceSatisfied: gpuFence.fenceSatisfied === true
    }
  };
}

export function submitSphReactionProductStageComputeTask({ computeManager, ...taskOptions } = {}) {
  if (!computeManager || typeof computeManager.submitTask !== 'function') {
    throw new Error('submitSphReactionProductStageComputeTask requires a ComputeManager-compatible submitTask() method');
  }
  return computeManager.submitTask(createSphReactionProductStageComputeTask(taskOptions));
}

function stripMechanicsStageTaskRuntimeFields({
  defaultRunner: _defaultRunner,
  stageId: _stageId,
  webGpuRunner: _webGpuRunner,
  onDeviceLost: _onDeviceLost,
  navigatorRef: _navigatorRef,
  device: _device,
  deviceResult: _deviceResult,
  ...stageOptions
} = {}) {
  return stageOptions;
}

function createMlsMpmMechanicsStageLaneContract({
  laneId,
  stateKey,
  domainKey = null,
  queueFencePolicy = 'queue.onSubmittedWorkDone-before-admission',
  readFamilies = ['sph-particle-state', 'mls-mpm-mechanics'],
  writeFamilies = ['sph-particle-state', 'mls-mpm-mechanics'],
  retainedBufferRefs = ['mls-mpm-p2g-grid-buffer', 'mls-mpm-grid-update-buffer', 'sph-state-buffer', 'mls-mpm-mechanics-buffer'],
  includeSpatialGasLedgerProducerStage = false,
  includeGasCellEosProducerStage = false,
  includePressureInterfaceStage = false,
  includeThermalPhaseStage = false,
  includeReactionProductStage = false
} = {}) {
  const contractReadFamilies = uniqueNonEmptyStrings([
    ...readFamilies,
    ...(includeSpatialGasLedgerProducerStage ? ['resident-product-mass', 'reaction-closure-table'] : []),
    ...(includeGasCellEosProducerStage ? ['resident-spatial-gas-species-ledger', 'resident-product-mass'] : []),
    ...(includePressureInterfaceStage ? ['resident-gas-pressure', 'sph-material-interface-field'] : []),
    ...(includeThermalPhaseStage || includeReactionProductStage ? ['sph-thermo-phase'] : []),
    ...(includeReactionProductStage ? ['reaction-closure-table'] : [])
  ]);
  const contractWriteFamilies = uniqueNonEmptyStrings([
    ...writeFamilies,
    ...(includeSpatialGasLedgerProducerStage ? ['resident-spatial-gas-species-ledger'] : []),
    ...(includeGasCellEosProducerStage ? ['resident-gas-pressure'] : []),
    ...(includePressureInterfaceStage ? ['pressure-interface-force-rows'] : []),
    ...(includeThermalPhaseStage || includeReactionProductStage ? ['sph-thermo-phase'] : []),
    ...(includeReactionProductStage ? ['resident-product-mass'] : [])
  ]);
  const laneRetainedBufferRefs = uniqueNonEmptyStrings([
    ...retainedBufferRefs,
    ...(includeSpatialGasLedgerProducerStage ? ['resident-spatial-gas-species-ledger-buffer'] : []),
    ...(includeGasCellEosProducerStage ? ['resident-gas-pressure-cells-buffer'] : []),
    ...(includePressureInterfaceStage ? ['pressure-interface-force-rows-buffer'] : []),
    ...(includeThermalPhaseStage || includeReactionProductStage ? ['sph-thermo-buffer'] : []),
    ...(includeReactionProductStage ? ['resident-product-mass-buffer'] : [])
  ]);
  const passDagStages = [
    {
      id: 'p2g',
      lawNodeId: 'ulg-mls-mpm-mechanics-p2g-stage',
      runtimeTarget: 'compute-manager-stage-task',
      reads: ['sph-particle-state', 'mls-mpm-mechanics'],
      writes: ['mls-mpm-grid']
    },
    ...(includeSpatialGasLedgerProducerStage ? [{
      id: SPATIAL_GAS_LEDGER_PRODUCER_STAGE_ID,
      lawNodeId: 'ulg-resident-spatial-gas-ledger-law',
      runtimeTarget: 'compute-manager-stage-task',
      dependsOn: [],
      reads: ['resident-product-mass', 'reaction-closure-table'],
      writes: ['resident-spatial-gas-species-ledger']
    }] : []),
    ...(includeGasCellEosProducerStage ? [{
      id: GAS_CELL_EOS_PRODUCER_STAGE_ID,
      lawNodeId: 'ulg-resident-gas-cell-eos-law',
      runtimeTarget: 'compute-manager-stage-task',
      dependsOn: includeSpatialGasLedgerProducerStage ? [SPATIAL_GAS_LEDGER_PRODUCER_STAGE_ID] : [],
      reads: ['resident-spatial-gas-species-ledger', 'resident-product-mass'],
      writes: ['resident-gas-pressure']
    }] : []),
    ...(includePressureInterfaceStage ? [{
      id: PRESSURE_INTERFACE_STAGE_ID,
      lawNodeId: 'ulg-pressure-interface-force-law',
      runtimeTarget: 'compute-manager-stage-task',
      dependsOn: includeGasCellEosProducerStage ? [GAS_CELL_EOS_PRODUCER_STAGE_ID] : [],
      reads: ['resident-gas-pressure', 'sph-material-interface-field'],
      writes: ['pressure-interface-force-rows']
    }] : []),
    {
      id: 'gridUpdate',
      lawNodeId: 'ulg-mls-mpm-mechanics-grid-update-stage',
      runtimeTarget: 'compute-manager-stage-task',
      dependsOn: uniqueNonEmptyStrings([
        'p2g',
        ...(includePressureInterfaceStage ? [PRESSURE_INTERFACE_STAGE_ID] : [])
      ]),
      inputFrom: includePressureInterfaceStage ? PRESSURE_INTERFACE_STAGE_ID : 'p2g',
      reads: ['mls-mpm-grid'],
      writes: ['mls-mpm-grid']
    },
    {
      id: 'g2p',
      lawNodeId: 'ulg-mls-mpm-mechanics-g2p-stage',
      runtimeTarget: 'compute-manager-stage-task',
      dependsOn: ['gridUpdate'],
      inputFrom: 'gridUpdate',
      reads: ['mls-mpm-grid', 'sph-particle-state', 'mls-mpm-mechanics'],
      writes: ['sph-particle-state', 'mls-mpm-mechanics']
    }
  ];
  if (includeThermalPhaseStage) {
    passDagStages.push({
      id: THERMAL_PHASE_STAGE_ID,
      lawNodeId: 'ulg-thermal-phase-law',
      runtimeTarget: 'compute-manager-stage-task',
      dependsOn: ['g2p'],
      inputFrom: 'g2p',
      reads: ['sph-particle-state', 'sph-thermo-phase', 'mls-mpm-mechanics'],
      writes: ['sph-thermo-phase']
    });
  }
  if (includeReactionProductStage) {
    passDagStages.push({
      id: REACTION_PRODUCT_STAGE_ID,
      lawNodeId: 'ulg-reaction-product-gas-law',
      runtimeTarget: 'compute-manager-stage-task',
      dependsOn: [includeThermalPhaseStage ? THERMAL_PHASE_STAGE_ID : 'g2p'],
      inputFrom: includeThermalPhaseStage ? THERMAL_PHASE_STAGE_ID : 'g2p',
      reads: ['sph-particle-state', 'sph-thermo-phase', 'mls-mpm-mechanics', 'reaction-closure-table'],
      writes: ['sph-particle-state', 'sph-thermo-phase', 'mls-mpm-mechanics', 'resident-product-mass']
    });
  }
  const gasEosPrefix = includeSpatialGasLedgerProducerStage
    ? 'spatial-gas-ledger-eos'
    : 'gas-eos';
  let sequenceMode = 'mechanics-stage-task-chain';
  if (includeReactionProductStage) {
    sequenceMode = includeGasCellEosProducerStage
      ? `mechanics-plus-${gasEosPrefix}-pressure-thermal-reaction-product-stage-task-chain`
      : 'mechanics-plus-thermal-reaction-product-stage-task-chain';
  } else if (includeThermalPhaseStage) {
    sequenceMode = includeGasCellEosProducerStage
      ? `mechanics-plus-${gasEosPrefix}-pressure-thermal-phase-stage-task-chain`
      : 'mechanics-plus-thermal-phase-stage-task-chain';
  } else if (includePressureInterfaceStage) {
    sequenceMode = includeGasCellEosProducerStage
      ? `mechanics-plus-${gasEosPrefix}-pressure-interface-stage-task-chain`
      : 'mechanics-plus-pressure-interface-stage-task-chain';
  } else if (includeGasCellEosProducerStage) {
    sequenceMode = includeSpatialGasLedgerProducerStage
      ? 'mechanics-plus-spatial-gas-ledger-eos-stage-task-chain'
      : 'mechanics-plus-gas-cell-eos-stage-task-chain';
  } else if (includeSpatialGasLedgerProducerStage) {
    sequenceMode = 'mechanics-plus-spatial-gas-ledger-stage-task-chain';
  }
  return {
    schema: ULG_MLS_MPM_MECHANICS_STAGE_LANE_CONTRACT_SCHEMA,
    authority: 'compute-manager-gpuhub-resident-lane-contract',
    status: 'mechanics-stage-plan-contract-ready',
    laneId,
    stateKey,
    domainKey,
    queueFencePolicy,
    readFamilies: contractReadFamilies,
    writeFamilies: contractWriteFamilies,
    laneMustRetainBuffers: laneRetainedBufferRefs,
    sequenceRequested: true,
    sequenceRunnable: true,
    sequenceMode,
    stageDependencyMode: 'explicit-stage-dependencies',
    parallelStageExecution: true,
    defaultEnabled: false,
    passDagStages,
    ownershipRules: [
      'single-authoritative-owner-after-each-stage',
      'stage-output-remains-non-authoritative-until-state-manager-admission',
      'scene-local-execution-must-not-become-a-parallel-scheduler'
    ],
    promotionStatus: 'mechanics-stage-plan-evidence-only'
  };
}

function retainedBufferRefsForMechanicsStageResult(stageId, result = {}) {
  const refs = [];
  if (stageId === 'p2g' && (result?.gridBuffer || result?.gpuResult?.gridBuffer || result?.gridBufferByteLength > 0)) {
    refs.push('mls-mpm-p2g-grid-buffer');
  }
  if (stageId === 'gridUpdate' && (result?.updatedGridBuffer || result?.gpuResult?.updatedGridBuffer || result?.updatedGridBufferByteLength > 0)) {
    refs.push('mls-mpm-grid-update-buffer');
  }
  if (stageId === PRESSURE_INTERFACE_STAGE_ID && (
    result?.pressureInterfaceForceRowsRetained
    || result?.forceRowValues instanceof Float32Array
    || result?.forceRowByteLength > 0
  )) {
    refs.push('pressure-interface-force-rows-buffer');
  }
  if (stageId === PRESSURE_INTERFACE_STAGE_ID && (
    result?.gasPressureCellRowsBufferRetained
    || result?.gasPressureCellsBuffer
    || result?.pressureInterfaceForceSolver?.gasPressureCellRowsBufferRetained
  )) {
    refs.push('resident-gas-pressure-cells-buffer');
  }
  if (stageId === SPATIAL_GAS_LEDGER_PRODUCER_STAGE_ID && (
    result?.spatialGasLedgerRowsBufferRetained
    || result?.spatialGasLedgerRowsBuffer
  )) {
    refs.push('resident-spatial-gas-species-ledger-buffer');
  }
  if (stageId === GAS_CELL_EOS_PRODUCER_STAGE_ID && (
    result?.gasPressureCellRowsBufferRetained
    || result?.pressureInterfaceGasPressureCellRowsBufferRetained
    || result?.gasPressureCellsBuffer
  )) {
    refs.push('resident-gas-pressure-cells-buffer');
  }
  if (stageId === 'g2p') {
    if (result?.stateBuffer || result?.gpuResult?.stateBuffer || result?.state instanceof Float32Array || result?.stateBufferByteLength > 0) {
      refs.push('sph-state-buffer');
    }
    if (result?.mechanicsBuffer || result?.gpuResult?.mechanicsBuffer || result?.mechanics instanceof Float32Array || result?.mechanicsBufferByteLength > 0) {
      refs.push('mls-mpm-mechanics-buffer');
    }
  }
  if (stageId === THERMAL_PHASE_STAGE_ID) {
    if (result?.stateBuffer || result?.gpuResult?.stateBuffer || result?.state instanceof Float32Array || result?.stateBufferByteLength > 0) {
      refs.push('sph-state-buffer');
    }
    if (result?.thermoBuffer || result?.gpuResult?.thermoBuffer || result?.thermo instanceof Float32Array || result?.thermoBufferByteLength > 0) {
      refs.push('sph-thermo-buffer');
    }
  }
  if (stageId === REACTION_PRODUCT_STAGE_ID) {
    if (result?.stateBuffer || result?.gpuResult?.stateBuffer || result?.state instanceof Float32Array || result?.stateBufferByteLength > 0) {
      refs.push('sph-state-buffer');
    }
    if (result?.thermoBuffer || result?.gpuResult?.thermoBuffer || result?.thermo instanceof Float32Array || result?.thermoBufferByteLength > 0) {
      refs.push('sph-thermo-buffer');
    }
    if (result?.mechanicsBuffer || result?.gpuResult?.mechanicsBuffer || result?.mechanics instanceof Float32Array || result?.mechanicsBufferByteLength > 0) {
      refs.push('mls-mpm-mechanics-buffer');
    }
    if (
      result?.residentProductMass?.productEventBufferRetained
      || result?.residentProductMassBufferRetained
      || result?.reactionSummary?.productEventBufferRetained
    ) {
      refs.push('resident-product-mass-buffer');
    }
  }
  return refs;
}

function isPressureInterfaceGasPressureRef(ref) {
  const text = String(ref || '').toLowerCase();
  const squashed = text.replace(/[^a-z0-9]/g, '');
  return text.includes('gas-pressure')
    || text.includes('gas-cells')
    || squashed.includes('gaspressure')
    || squashed.includes('gascells');
}

function isPressureInterfaceForceRowRef(ref) {
  const text = String(ref || '').toLowerCase();
  const squashed = text.replace(/[^a-z0-9]/g, '');
  return text.includes('pressure-interface-force-rows')
    || text.includes('force-rows')
    || squashed.includes('forcerows');
}

function isWorkerRetainedRef(ref) {
  return String(ref || '').startsWith('ulg-worker:');
}

function resolveMechanicsStageGpuHub(computeManager) {
  const laneManager = typeof computeManager?.getGpuResidentLaneManager === 'function'
    ? computeManager.getGpuResidentLaneManager()
    : computeManager?.gpuResidentLaneManager;
  return laneManager?.gpuHub || computeManager?.gpuHub || null;
}

function resolveMechanicsStageWorkerRunner(workerRunner, stageId) {
  if (!workerRunner) return null;
  if (typeof workerRunner === 'function' || typeof workerRunner.runStage === 'function') return workerRunner;
  if (workerRunner && typeof workerRunner === 'object') {
    return workerRunner[stageId] || workerRunner.default || workerRunner['*'] || null;
  }
  return null;
}

async function executeMechanicsStageWorkerRunner(workerRunner, args) {
  if (typeof workerRunner === 'function') return workerRunner(args);
  if (workerRunner && typeof workerRunner.runStage === 'function') return workerRunner.runStage(args);
  throw new Error(`Mechanics stage worker runner is not executable: ${args?.stage?.id || 'unknown-stage'}`);
}

function summarizeMechanicsStageLaneResult(stageId, result = {}) {
  const gpuResidentLaneRequirement = result?.gpuResidentLaneRequirement
    || result?.gpuResidentLane
    || result?.computeExecution?.gpuResidentLaneRequirement
    || null;
  const gpuResidentLaneExecution = result?.gpuResidentLaneExecution
    || result?.computeExecution?.gpuResidentLaneExecution
    || null;
  const gpuFence = result?.gpuFence
    || result?.gpuFenceReport
    || result?.computeExecution?.gpuFence
    || gpuResidentLaneExecution?.gpuFence
    || null;
  const copyBudget = gpuResidentLaneRequirement?.copyBudget
    || result?.hotLoopBudget?.copyBudget
    || result?.webgpu?.copyBudget
    || null;
  return {
    stageId,
    executionStatus: result?.status || null,
    backend: result?.backend || null,
    residency: gpuResidentLaneRequirement ? 'gpu-lane' : 'cpu-oracle',
    laneId: gpuResidentLaneRequirement?.laneId || gpuResidentLaneExecution?.lease?.laneId || null,
    stateKey: gpuResidentLaneRequirement?.stateKey || gpuResidentLaneExecution?.lease?.stateKey || null,
    copyBudget: copyBudget ? { ...copyBudget } : null,
    copyBudgetUploadBytes: finiteNumber(copyBudget?.uploadBytes, 0),
    copyBudgetReadbackBytes: finiteNumber(copyBudget?.readbackBytes, 0),
    copyBudgetRetainedBytes: finiteNumber(copyBudget?.retainedBytes, 0),
    copyBudgetCompactSummaryBytes: finiteNumber(copyBudget?.compactSummaryBytes, 0),
    stateBufferByteLength: finiteNumber(
      result?.stateBufferByteLength
        ?? result?.nextParticleStateBufferByteLength
        ?? result?.state?.byteLength,
      0
    ),
    thermoBufferByteLength: finiteNumber(
      result?.thermoBufferByteLength
        ?? result?.nextParticleThermoBufferByteLength
        ?? result?.thermo?.byteLength,
      0
    ),
    mechanicsBufferByteLength: finiteNumber(
      result?.mechanicsBufferByteLength
        ?? result?.nextParticleMechanicsBufferByteLength
        ?? result?.mechanics?.byteLength,
      0
    ),
    gridBufferByteLength: finiteNumber(
      result?.gridBufferByteLength
        ?? result?.gridNodes?.byteLength,
      0
    ),
    updatedGridBufferByteLength: finiteNumber(
      result?.updatedGridBufferByteLength
        ?? result?.updatedGridNodes?.byteLength,
      0
    ),
    readbackMode: result?.readbackMode || null,
    fullReadbackPerformed: result?.fullReadbackPerformed === true,
    normalHotLoopReadbackFree: result?.normalHotLoopReadbackFree === true,
    fenceRequired: gpuFence?.required === true,
    fenceSatisfied: gpuFence?.fenceSatisfied === true,
    fenceStatus: gpuFence?.status || null,
    workerResidentStageSchema: result?.workerResidentStage?.schema || null,
    workerResidentStageStatus: result?.workerResidentStage?.status || null,
    workerWebGpuRequested: result?.workerResidentStage?.workerWebGpuRequested === true,
    workerWebGpuStatus: result?.workerResidentStage?.workerWebGpuStatus || null,
    workerDeviceCached: result?.workerResidentStage?.workerDeviceCached === true,
    workerRetainedContinuationInputStatus: result?.workerResidentStage?.workerRetainedContinuationInputStatus || null,
    workerRetainedContinuationInput: result?.workerResidentStage?.workerRetainedContinuationInput || null,
    workerRetainedThermoInputStatus: result?.workerResidentStage?.workerRetainedThermoInputStatus || null,
    workerRetainedThermoInput: result?.workerResidentStage?.workerRetainedThermoInput || null,
    workerRetainedThermoOutputStatus: result?.workerResidentStage?.workerRetainedThermoOutputStatus || null,
    workerRetainedThermoOutput: result?.workerResidentStage?.workerRetainedThermoOutput || null,
    workerRetainedBufferRefs: uniqueNonEmptyStrings(result?.workerResidentStage?.workerRetainedBufferRefs || []),
    spatialGasLedgerProducerEvidencePassed: result?.spatialGasLedgerProducerStageTaskEvidence?.passed === true,
    spatialGasLedgerProducerAuthoritativeMutation: result?.spatialGasLedgerProducerStageTaskAuthority?.authoritativeStateMutation ?? null,
    spatialGasLedgerProducerStatus: stageId === SPATIAL_GAS_LEDGER_PRODUCER_STAGE_ID ? result?.status || null : null,
    spatialGasLedgerProducerReady: stageId === SPATIAL_GAS_LEDGER_PRODUCER_STAGE_ID
      ? spatialGasLedgerProducerResultReady(result)
      : false,
    spatialGasLedgerProducerCompactRowCount: finiteNumber(result?.compactSpatialGasRowCount, 0),
    spatialGasLedgerProducerCompactReadbackByteLength: finiteNumber(result?.compactSpatialGasReadbackByteLength, 0),
    spatialGasLedgerProducerFullProductEventReadbackPerformed: result?.fullProductEventReadbackPerformed === true,
    spatialGasLedgerProducerRetainedSourceSchema: result?.retainedSpatialGasLedgerSourceSchema
      || result?.retainedSpatialGasLedgerSource?.schema
      || null,
    spatialGasLedgerProducerRetainedSourceStatus: result?.retainedSpatialGasLedgerSourceStatus
      || result?.retainedSpatialGasLedgerSource?.status
      || null,
    spatialGasLedgerProducerRetainedSourceReady: result?.retainedSpatialGasLedgerSourceReady === true,
    spatialGasLedgerProducerCellCount: finiteNumber(
      result?.spatialGasSpeciesLedger?.cellCount ?? result?.spatialGasSpeciesLedgerCellCount,
      0
    ),
    spatialGasLedgerProducerRowsBufferRetained: result?.spatialGasLedgerRowsBufferRetained === true
      || Boolean(result?.spatialGasLedgerRowsBuffer),
    gasCellEosProducerEvidencePassed: result?.gasCellEosProducerStageTaskEvidence?.passed === true,
    gasCellEosProducerAuthoritativeMutation: result?.gasCellEosProducerStageTaskAuthority?.authoritativeStateMutation ?? null,
    gasCellEosProducerStatus: stageId === GAS_CELL_EOS_PRODUCER_STAGE_ID ? result?.status || null : null,
    gasCellEosProducerLocalPressureGradientReady: stageId === GAS_CELL_EOS_PRODUCER_STAGE_ID
      ? gasCellEosProducerResultReady(result)
      : false,
    gasCellEosProducerRetainedGasCellFieldSourceSchema: result?.retainedGasCellFieldSourceSchema
      || result?.retainedGasCellFieldSource?.schema
      || null,
    gasCellEosProducerRetainedGasCellFieldSourceStatus: result?.retainedGasCellFieldSourceStatus
      || result?.retainedGasCellFieldSource?.status
      || null,
    gasCellEosProducerRetainedGasCellFieldSourceReady: result?.retainedGasCellFieldSourceReady === true,
    gasCellEosProducerGasPressureCellRowCount: finiteNumber(
      result?.gasPressureCellRowCount ?? result?.pressureInterfaceGasPressureCellRowCount,
      0
    ),
    gasCellEosProducerGasPressureCellRowsBufferRetained: result?.gasPressureCellRowsBufferRetained === true
      || result?.pressureInterfaceGasPressureCellRowsBufferRetained === true
      || Boolean(result?.gasPressureCellsBuffer),
    pressureInterfaceEvidencePassed: result?.pressureInterfaceStageTaskEvidence?.passed === true,
    pressureInterfaceAuthoritativeMutation: result?.pressureInterfaceStageTaskAuthority?.authoritativeStateMutation ?? null,
    pressureInterfaceForceSolverStatus: result?.pressureInterfaceForceSolver?.status || result?.pressureInterfaceForceSolverStatus || null,
    pressureFieldMode: result?.pressureInterfaceForceSolver?.pressureFieldMode
      || result?.pressureFeedback?.pressureFieldMode
      || null,
    pressureFieldResolution: result?.pressureInterfaceForceSolver?.pressureFieldResolution
      || result?.pressureFeedback?.pressureFieldResolution
      || null,
    pressureGradientStatus: result?.pressureInterfaceForceSolver?.pressureGradientStatus
      || result?.pressureFeedback?.pressureGradientStatus
      || null,
    localPressureGradientReady: result?.pressureInterfaceForceSolver?.localPressureGradientReady === true
      || result?.pressureFeedback?.localPressureGradientReady === true,
    localPressureGradientStatus: result?.pressureInterfaceForceSolver?.localPressureGradientStatus
      || result?.pressureFeedback?.localPressureGradientStatus
      || null,
    localPressureGradientForceCouplingStatus: result?.pressureInterfaceForceSolver?.localPressureGradientForceCouplingStatus
      || result?.pressureFeedback?.localPressureGradientForceCouplingStatus
      || null,
    pressureInterfaceGasCellFieldAdmissionSchema: result?.pressureInterfaceGasCellFieldAdmissionSchema
      || result?.pressureInterfaceGasCellFieldAdmission?.schema
      || null,
    pressureInterfaceGasCellFieldAdmissionStatus: result?.pressureInterfaceGasCellFieldAdmissionStatus || null,
    pressureInterfaceGasCellFieldAdmissionApproved: result?.pressureInterfaceGasCellFieldAdmissionApproved === true,
    pressureInterfaceGasCellFieldConsumerStatus: result?.pressureInterfaceGasCellFieldConsumerStatus || null,
    pressureInterfaceGasCellFieldImportSchema: result?.pressureInterfaceGasCellFieldImportSchema
      || result?.pressureInterfaceGasCellFieldImport?.schema
      || null,
    pressureInterfaceGasCellFieldImportStatus: result?.pressureInterfaceGasCellFieldImportStatus
      || result?.pressureInterfaceGasCellFieldImport?.status
      || null,
    pressureInterfaceGasCellFieldImportReady: result?.pressureInterfaceGasCellFieldImportReady === true
      || result?.pressureInterfaceGasCellFieldImport?.importReady === true,
    pressureInterfaceGasCellFieldImportSourceHotBufferKey: result?.pressureInterfaceGasCellFieldImportSourceHotBufferKey
      || result?.pressureInterfaceGasCellFieldImport?.sourceHotBufferKey
      || null,
    pressureInterfaceGasPressureCellRowCount: finiteNumber(
      result?.gasPressureCellRowCount
        ?? result?.pressureInterfaceForceSolver?.gasPressureCellRowCount,
      0
    ),
    pressureInterfaceGasPressureCellRowStrideFloats: finiteNumber(
      result?.gasPressureCellRowStrideFloats
        ?? result?.pressureInterfaceForceSolver?.gasPressureCellRowStrideFloats,
      0
    ),
    pressureInterfaceGasPressureCellRowByteLength: finiteNumber(
      result?.gasPressureCellRowByteLength
        ?? result?.gasPressureCellRowsBufferByteLength
        ?? result?.pressureInterfaceForceSolver?.gasPressureCellRowByteLength,
      0
    ),
    pressureInterfaceGasPressureCellRowsBufferRetained: result?.gasPressureCellRowsBufferRetained === true
      || result?.pressureInterfaceForceSolver?.gasPressureCellRowsBufferRetained === true
      || Boolean(result?.gasPressureCellsBuffer),
    pressureInterfaceForceRowCount: finiteNumber(result?.forceRowCount ?? result?.pressureInterfaceForceSolver?.forceRowCount, 0),
    pressureInterfaceForceRowStrideFloats: finiteNumber(result?.forceRowStrideFloats ?? result?.pressureInterfaceForceSolver?.forceRowStrideFloats, SPH_PRESSURE_INTERFACE_FORCE_FLOATS),
    pressureInterfaceForceRowByteLength: finiteNumber(result?.forceRowByteLength ?? result?.pressureInterfaceForceSolver?.forceRowByteLength, 0),
    pressureInterfaceContactBinGridStatus: result?.interfaceContactKinematicsParticleBinGridStatus
      || result?.pressureInterfaceForceSolver?.interfaceContactKinematicsParticleBinGridStatus
      || null,
    pressureInterfaceContactBinGridEnabled: result?.interfaceContactKinematicsParticleBinGridEnabled === true
      || result?.pressureInterfaceForceSolver?.interfaceContactKinematicsParticleBinGridEnabled === true,
    pressureInterfaceContactBinGridCellCount: finiteNumber(
      result?.interfaceContactKinematicsParticleBinGridCellCount
        ?? result?.pressureInterfaceForceSolver?.interfaceContactKinematicsParticleBinGridCellCount,
      0
    ),
    pressureInterfaceContactBinGridBinCapacity: finiteNumber(
      result?.interfaceContactKinematicsParticleBinGridBinCapacity
        ?? result?.pressureInterfaceForceSolver?.interfaceContactKinematicsParticleBinGridBinCapacity,
      0
    ),
    pressureInterfaceContactBinGridAverageOccupancy: finiteNumber(
      result?.interfaceContactKinematicsParticleBinGridAverageOccupancy
        ?? result?.pressureInterfaceForceSolver?.interfaceContactKinematicsParticleBinGridAverageOccupancy,
      0
    ),
    pressureInterfaceContactBinGridEstimatedOverflowRisk: result?.interfaceContactKinematicsParticleBinGridEstimatedOverflowRisk === true
      || result?.pressureInterfaceForceSolver?.interfaceContactKinematicsParticleBinGridEstimatedOverflowRisk === true,
    pressureInterfaceContactBinGridIndexBufferByteLength: finiteNumber(
      result?.interfaceContactKinematicsParticleBinGridIndexBufferByteLength
        ?? result?.pressureInterfaceForceSolver?.interfaceContactKinematicsParticleBinGridIndexBufferByteLength,
      0
    ),
    pressureInterfaceContactBinOverflowStatus: result?.interfaceContactKinematicsParticleBinOverflowStatus
      || result?.pressureInterfaceForceSolver?.interfaceContactKinematicsParticleBinOverflowStatus
      || null,
    pressureInterfaceContactBinOverflowCount: result?.interfaceContactKinematicsParticleBinOverflowCount
      ?? result?.pressureInterfaceForceSolver?.interfaceContactKinematicsParticleBinOverflowCount
      ?? null,
    pressureInterfaceForceRowsBufferByteLength: finiteNumber(
      result?.forceRowsBufferByteLength
        ?? result?.pressureInterfaceForceRowsBufferByteLength
        ?? result?.forceRowByteLength,
      0
    ),
    pressureInterfaceForceRowsRetained: result?.pressureInterfaceForceRowsRetained === true || (result?.forceRowByteLength ?? 0) > 0,
    pressureInterfaceForceRowsBufferRetained: result?.pressureInterfaceForceRowsBufferRetained === true
      || Boolean(result?.forceRowsBuffer || result?.pressureInterfaceForceRowsBuffer)
      || result?.pressureInterfaceForceSolver?.forceRowsBufferRetained === true
      || result?.pressureInterfaceForceSolver?.pressureInterfaceForceRowsBufferRetained === true,
    pressureInterfaceGridForceAdmissionStatus: result?.pressureInterfaceGridForceAdmissionStatus || null,
    pressureInterfaceGridForceAdmissionApproved: result?.pressureInterfaceGridForceAdmissionApproved ?? false,
    pressureInterfaceGridForceAdmissionSourceHotBufferKey: result?.pressureInterfaceGridForceAdmissionSourceHotBufferKey || null,
    pressureInterfaceForceApplicationStatus: result?.pressureInterfaceForceApplicationStatus || null,
    pressureInterfaceForceConsumerStatus: result?.pressureInterfaceForceConsumerStatus || null,
    thermalPhaseEvidencePassed: result?.thermalPhaseStageTaskEvidence?.passed === true,
    thermalPhaseAuthoritativeMutation: result?.thermalPhaseStageTaskAuthority?.authoritativeStateMutation ?? null,
    reactionProductEvidencePassed: result?.reactionProductStageTaskEvidence?.passed === true,
    reactionProductAuthoritativeMutation: result?.reactionProductStageTaskAuthority?.authoritativeStateMutation ?? null,
    reactionProductOutputMutatesParticles: reactionOutputMutatesParticles(result),
    reactionProductResidentProductMassStatus: result?.residentProductMassStatus || result?.residentProductMass?.status || null,
    reactionProductResidentProductMassBufferRetained: result?.residentProductMassBufferRetained === true
      || result?.residentProductMass?.productEventBufferRetained === true
  };
}

function retainedRefsFromStageExecution(stageExecution = null, allowedStageIds = null) {
  const allowed = Array.isArray(allowedStageIds) ? new Set(allowedStageIds) : null;
  return uniqueNonEmptyStrings(
    (stageExecution?.stageResults || [])
      .filter((entry) => !allowed || allowed.has(entry?.stageId))
      .flatMap((entry) => entry?.retainedBufferRefs || [])
  );
}

function workerRetainedRefsFromStageExecution(stageExecution = null, allowedStageIds = null) {
  return retainedRefsFromStageExecution(stageExecution, allowedStageIds)
    .filter((ref) => String(ref || '').startsWith('ulg-worker:'));
}

function stageExecutionSummariesByStage(stageExecution = null) {
  return Object.fromEntries(
    (stageExecution?.stageResults || [])
      .map((entry) => [entry.stageId, entry.summary || null])
      .filter(([stageId]) => Boolean(stageId))
  );
}

function firstMechanicsWorkerPublicationBlocker({
  workerRunnerSupplied,
  stageExecutionCompleted,
  allWorkerReady,
  allWebGpuBackends,
  hasWorkerRetainedRefs,
  noFullReadback
} = {}) {
  if (!workerRunnerSupplied) return 'worker-runner-not-supplied';
  if (!stageExecutionCompleted) return 'worker-stage-execution-not-completed';
  if (!allWorkerReady) return 'worker-residency-not-ready';
  if (!allWebGpuBackends) return 'worker-webgpu-backends-not-proven';
  if (!hasWorkerRetainedRefs) return 'worker-retained-buffer-refs-missing';
  if (!noFullReadback) return 'compact-summary-no-full-readback-required';
  return null;
}

function buildMechanicsWorkerCompactPublicationCandidate({
  stageExecution = null,
  stageLaneSummaries = {},
  stageWorkerResidencyStatuses = {},
  workerRunnerSupplied = false,
  workerModuleUrl = null,
  sameDeviceRetainedBufferImport = null,
  laneId = null,
  stateKey = null
} = {}) {
  const workerRetainedBufferRefs = workerRetainedRefsFromStageExecution(stageExecution, MECHANICS_STAGE_ORDER);
  const retainedBufferRefs = retainedRefsFromStageExecution(stageExecution, MECHANICS_STAGE_ORDER);
  const normalizedSameDeviceRetainedBufferImport = normalizeSameDeviceRetainedBufferImportDescriptor(
    sameDeviceRetainedBufferImport
  );
  const sameDeviceRetainedBufferImportAvailable = Boolean(normalizedSameDeviceRetainedBufferImport);
  const hasWorkerSignals = workerRunnerSupplied || workerRetainedBufferRefs.length > 0;
  if (!hasWorkerSignals) return null;
  const stageSummaries = stageExecutionSummariesByStage(stageExecution);
  const stageBackends = Object.fromEntries(
    MECHANICS_STAGE_ORDER.map((stageId) => [stageId, stageLaneSummaries[stageId]?.backend || null])
  );
  const stageReadbackModes = Object.fromEntries(
    MECHANICS_STAGE_ORDER.map((stageId) => [stageId, stageLaneSummaries[stageId]?.readbackMode || null])
  );
  const stageWorkerWebGpuStatuses = Object.fromEntries(
    MECHANICS_STAGE_ORDER.map((stageId) => [
      stageId,
      stageLaneSummaries[stageId]?.workerWebGpuStatus || stageSummaries[stageId]?.workerWebGpuStatus || null
    ])
  );
  const stageWorkerRetainedBufferRefCounts = Object.fromEntries(
    MECHANICS_STAGE_ORDER.map((stageId) => [
      stageId,
      Math.max(
        0,
        stageLaneSummaries[stageId]?.workerRetainedBufferRefs?.length
          ?? stageSummaries[stageId]?.workerRetainedBufferRefCount
          ?? 0
      )
    ])
  );
  const completedStageIds = new Set((stageExecution?.stageResults || [])
    .filter((entry) => entry?.status === 'completed')
    .map((entry) => entry.stageId));
  const stageExecutionCompleted = stageExecution?.status === 'completed'
    && MECHANICS_STAGE_ORDER.every((stageId) => completedStageIds.has(stageId));
  const allWorkerReady = MECHANICS_STAGE_ORDER.every((stageId) => (
    stageWorkerResidencyStatuses[stageId] === 'worker-ready'
  ));
  const allWebGpuBackends = MECHANICS_STAGE_ORDER.every((stageId) => stageBackends[stageId] === 'webgpu');
  const noFullReadback = MECHANICS_STAGE_ORDER.every((stageId) => (
    stageReadbackModes[stageId] === NO_FULL_READBACK_MODE
      && stageLaneSummaries[stageId]?.normalHotLoopReadbackFree === true
  ));
  const blocker = firstMechanicsWorkerPublicationBlocker({
    workerRunnerSupplied,
    stageExecutionCompleted,
    allWorkerReady,
    allWebGpuBackends,
    hasWorkerRetainedRefs: workerRetainedBufferRefs.length > 0,
    noFullReadback
  });
  const candidateReady = !blocker;
  return {
    schema: ULG_MLS_MPM_MECHANICS_WORKER_COMPACT_PUBLICATION_CANDIDATE_SCHEMA,
    candidateStatus: candidateReady
      ? 'worker-retained-compact-publication-candidate-ready'
      : 'worker-retained-compact-publication-candidate-blocked',
    blocker,
    authority: 'compute-manager-gpuhub-worker-stage-output',
    publicationAuthority: 'nodekernel-state-manager-admission-required',
    publicationStatus: candidateReady
      ? 'blocked-authorized-worker-publication-required'
      : 'blocked-candidate-not-ready',
    publicationReason: candidateReady
      ? 'worker-retained-gpu-handles-are-not-main-thread-transferable'
      : blocker,
    sameDeviceMainThreadHandlesAvailable: false,
    sameDeviceRetainedBufferImportAvailable,
    sameDeviceRetainedBufferImport: normalizedSameDeviceRetainedBufferImport,
    localSameDeviceRetainedBufferImport: normalizedSameDeviceRetainedBufferImport,
    sameDeviceSourceHotBufferKey: normalizedSameDeviceRetainedBufferImport?.sourceHotBufferKey || null,
    localMaterializationStatus: sameDeviceRetainedBufferImportAvailable
      ? 'same-device-retained-buffer-import-ready'
      : 'same-worker-lane-retained-buffer-ref-ready',
    localMaterializationBlocker: sameDeviceRetainedBufferImportAvailable
      ? null
      : null,
    acceptedMaterializationModes: sameDeviceRetainedBufferImportAvailable
      ? ['same-device-retained-buffer-import', 'same-worker-lane-retained-buffer-ref']
      : ['same-worker-lane-retained-buffer-ref'],
    acceptedConsumerModes: sameDeviceRetainedBufferImportAvailable
      ? ['same-device-retained-buffer-import', 'same-worker-lane-retained-buffer-ref']
      : ['same-worker-lane-retained-buffer-ref'],
    workerLocalRetainedRefsOnly: true,
    compactSummaryStatus: noFullReadback
      ? 'worker-compact-summary-required'
      : 'blocked-full-readback-mode',
    compactSummaryRequired: true,
    stateManagerAdmissionRequired: true,
    laneId,
    stateKey,
    workerModuleUrl,
    stageOrder: [...MECHANICS_STAGE_ORDER],
    observedStageOrder: (stageExecution?.stageResults || []).map((entry) => entry.stageId).filter(Boolean),
    stageBackends,
    stageReadbackModes,
    stageWorkerWebGpuStatuses,
    stageWorkerResidencyStatuses: { ...stageWorkerResidencyStatuses },
    stageWorkerRetainedBufferRefCounts,
    workerRetainedBufferRefs,
    workerRetainedBufferRefCount: workerRetainedBufferRefs.length,
    retainedBufferRefs,
    outputFamilies: ['sph-particle-state', 'mls-mpm-mechanics'],
    requiredPublicationProtocol: 'worker-posts-compact-summary-and-retained-ref-descriptor-to-nodekernel-state-manager',
    nextRequiredImplementation: 'authorized-worker-compact-output-publication'
  };
}

function buildPressureInterfaceWorkerCompactPublicationCandidate({
  stageExecution = null,
  stageLaneSummaries = {},
  stageWorkerResidencyStatuses = {},
  workerRunnerSupplied = false,
  workerModuleUrl = null,
  laneId = null,
  stateKey = null
} = {}) {
  const stageResults = stageExecution?.stageResults || [];
  const pressureStageCompleted = stageExecution?.status === 'completed'
    && stageResults.some((entry) => entry?.stageId === PRESSURE_INTERFACE_STAGE_ID && entry.status === 'completed');
  const pressureSummary = stageLaneSummaries[PRESSURE_INTERFACE_STAGE_ID] || {};
  const retainedBufferRefs = retainedRefsFromStageExecution(stageExecution, [PRESSURE_INTERFACE_STAGE_ID]);
  const workerRetainedBufferRefs = workerRetainedRefsFromStageExecution(stageExecution, [PRESSURE_INTERFACE_STAGE_ID]);
  const workerRetainedPressureBufferRefs = uniqueNonEmptyStrings(
    workerRetainedBufferRefs.filter(isPressureInterfaceForceRowRef)
  );
  const workerRetainedGasPressureBufferRefs = uniqueNonEmptyStrings(
    workerRetainedBufferRefs.filter(isPressureInterfaceGasPressureRef)
  );
  const retainedPressureBufferRefs = uniqueNonEmptyStrings(
    retainedBufferRefs.filter((ref) => !isWorkerRetainedRef(ref) && isPressureInterfaceForceRowRef(ref))
  );
  const retainedGasPressureBufferRefs = uniqueNonEmptyStrings(
    retainedBufferRefs.filter((ref) => !isWorkerRetainedRef(ref) && isPressureInterfaceGasPressureRef(ref))
  );
  const hasPressureRef = workerRetainedPressureBufferRefs.length > 0 || retainedPressureBufferRefs.length > 0;
  const hasGasPressureRef = workerRetainedGasPressureBufferRefs.length > 0 || retainedGasPressureBufferRefs.length > 0;
  const forceRowCount = Math.max(0, finiteNumber(pressureSummary.pressureInterfaceForceRowCount, 0));
  const forceRowStrideFloats = Math.max(0, finiteNumber(pressureSummary.pressureInterfaceForceRowStrideFloats, SPH_PRESSURE_INTERFACE_FORCE_FLOATS));
  const forceRowByteLength = Math.max(0, finiteNumber(pressureSummary.pressureInterfaceForceRowByteLength, 0));
  const forceRowsBufferByteLength = Math.max(0, finiteNumber(pressureSummary.pressureInterfaceForceRowsBufferByteLength, forceRowByteLength));
  const localPressureGradientReady = pressureSummary.localPressureGradientReady === true;
  const gasPressureCellRowCount = Math.max(0, finiteNumber(pressureSummary.pressureInterfaceGasPressureCellRowCount, 0));
  const gasPressureCellRowStrideFloats = Math.max(0, finiteNumber(pressureSummary.pressureInterfaceGasPressureCellRowStrideFloats, 0));
  const gasPressureCellRowByteLength = Math.max(0, finiteNumber(pressureSummary.pressureInterfaceGasPressureCellRowByteLength, 0));
  const gasPressureCellRowsBufferRetained = pressureSummary.pressureInterfaceGasPressureCellRowsBufferRetained === true;
  const gasCellFieldAdmissionApproved = !localPressureGradientReady
    || pressureSummary.pressureInterfaceGasCellFieldAdmissionApproved === true;
  const backend = pressureSummary.backend || null;
  const readbackMode = pressureSummary.readbackMode || null;
  const workerResidencyStatus = stageWorkerResidencyStatuses[PRESSURE_INTERFACE_STAGE_ID] || null;
  const solverStatus = pressureSummary.pressureInterfaceForceSolverStatus || null;
  const evidencePassed = pressureSummary.pressureInterfaceEvidencePassed === true;
  const mutationSuppressed = pressureSummary.pressureInterfaceAuthoritativeMutation === false;
  const backendAllowed = backend === 'webgpu';
  const retainedGpuForceRowsProven = backend === 'webgpu'
    && hasPressureRef
    && forceRowsBufferByteLength > 0
    && pressureSummary.pressureInterfaceForceRowsBufferRetained === true;
  const retainedGpuGasCellsProven = !localPressureGradientReady
    || (
      backend === 'webgpu'
      && hasGasPressureRef
      && gasPressureCellRowCount > 0
      && gasPressureCellRowByteLength > 0
      && gasPressureCellRowsBufferRetained
    );
  const retainedGasCellFieldSourceReady = localPressureGradientReady
    && retainedGpuGasCellsProven
    && hasGasPressureRef;
  let blocker = null;
  if (!workerRunnerSupplied) {
    blocker = 'worker-runner-not-supplied';
  } else if (!pressureStageCompleted) {
    blocker = 'pressure-interface-stage-execution-not-completed';
  } else if (workerResidencyStatus !== 'worker-ready') {
    blocker = 'pressure-interface-worker-residency-not-ready';
  } else if (!backendAllowed) {
    blocker = 'pressure-interface-worker-webgpu-retained-buffer-required';
  } else if (readbackMode !== NO_FULL_READBACK_MODE || pressureSummary.normalHotLoopReadbackFree !== true) {
    blocker = 'pressure-interface-no-full-readback-required';
  } else if (!evidencePassed) {
    blocker = 'pressure-interface-force-row-evidence-not-passed';
  } else if (solverStatus !== 'pressure-interface-force-solver-ready') {
    blocker = 'pressure-interface-force-solver-not-ready';
  } else if (!mutationSuppressed) {
    blocker = 'pressure-interface-authority-must-remain-non-mutating';
  } else if (!retainedGpuForceRowsProven) {
    blocker = 'pressure-interface-retained-gpu-force-row-buffer-required';
  } else if (!retainedGpuGasCellsProven) {
    blocker = 'pressure-interface-retained-local-gas-cell-buffer-required';
  } else if (!gasCellFieldAdmissionApproved) {
    blocker = 'pressure-interface-local-gas-cell-field-admission-required';
  }
  const candidateReady = !blocker;
  return {
    schema: ULG_SPH_PRESSURE_INTERFACE_WORKER_COMPACT_PUBLICATION_CANDIDATE_SCHEMA,
    candidateStatus: candidateReady
      ? 'worker-retained-pressure-interface-publication-candidate-ready'
      : 'worker-retained-pressure-interface-publication-candidate-blocked',
    blocker,
    authority: 'compute-manager-gpuhub-worker-stage-output',
    publicationAuthority: 'nodekernel-state-manager-admission-required',
    publicationStatus: candidateReady
      ? 'blocked-authorized-pressure-interface-publication-required'
      : 'blocked-candidate-not-ready',
    publicationReason: candidateReady
      ? 'worker-retained-pressure-interface-force-rows-require-state-manager-admission-before-grid-consumption'
      : blocker,
    sameDeviceMainThreadHandlesAvailable: false,
    workerLocalRetainedRefsOnly: true,
    compactSummaryStatus: readbackMode === NO_FULL_READBACK_MODE && pressureSummary.normalHotLoopReadbackFree === true
      ? 'worker-pressure-interface-compact-summary-required'
      : 'blocked-full-readback-mode',
    compactSummaryRequired: true,
    stateManagerAdmissionRequired: true,
    laneId,
    stateKey,
    workerModuleUrl,
    stageOrder: [PRESSURE_INTERFACE_STAGE_ID],
    observedStageOrder: stageResults.map((entry) => entry.stageId).filter(Boolean),
    stageBackends: { [PRESSURE_INTERFACE_STAGE_ID]: backend },
    stageReadbackModes: { [PRESSURE_INTERFACE_STAGE_ID]: readbackMode },
    stageWorkerResidencyStatuses: { [PRESSURE_INTERFACE_STAGE_ID]: workerResidencyStatus },
    pressureInterfaceEvidencePassed: evidencePassed,
    pressureInterfaceAuthoritativeMutation: pressureSummary.pressureInterfaceAuthoritativeMutation ?? null,
    pressureInterfaceForceSolverStatus: solverStatus,
    pressureInterfaceForceRowCount: forceRowCount,
    pressureInterfaceForceRowStrideFloats: forceRowStrideFloats,
    pressureInterfaceForceRowByteLength: forceRowByteLength,
    pressureInterfaceForceRowsBufferByteLength: forceRowsBufferByteLength,
    pressureInterfaceForceRowsRetained: pressureSummary.pressureInterfaceForceRowsRetained === true,
    pressureInterfaceForceRowsBufferRetained: pressureSummary.pressureInterfaceForceRowsBufferRetained === true,
    pressureFieldMode: pressureSummary.pressureFieldMode || null,
    pressureFieldResolution: pressureSummary.pressureFieldResolution || null,
    localPressureGradientReady,
    localPressureGradientStatus: pressureSummary.localPressureGradientStatus || null,
    localPressureGradientForceCouplingStatus: pressureSummary.localPressureGradientForceCouplingStatus || null,
    pressureInterfaceGasCellFieldAdmissionSchema: pressureSummary.pressureInterfaceGasCellFieldAdmissionSchema || null,
    pressureInterfaceGasCellFieldAdmissionStatus: pressureSummary.pressureInterfaceGasCellFieldAdmissionStatus || null,
    pressureInterfaceGasCellFieldAdmissionApproved: gasCellFieldAdmissionApproved,
    pressureInterfaceGasCellFieldConsumerStatus: pressureSummary.pressureInterfaceGasCellFieldConsumerStatus || null,
    pressureInterfaceGasCellFieldImportSchema: pressureSummary.pressureInterfaceGasCellFieldImportSchema || null,
    pressureInterfaceGasCellFieldImportStatus: pressureSummary.pressureInterfaceGasCellFieldImportStatus || null,
    pressureInterfaceGasCellFieldImportReady: pressureSummary.pressureInterfaceGasCellFieldImportReady === true,
    pressureInterfaceGasCellFieldImportSourceHotBufferKey: pressureSummary.pressureInterfaceGasCellFieldImportSourceHotBufferKey || null,
    pressureInterfaceGasPressureCellRowCount: gasPressureCellRowCount,
    pressureInterfaceGasPressureCellRowStrideFloats: gasPressureCellRowStrideFloats,
    pressureInterfaceGasPressureCellRowByteLength: gasPressureCellRowByteLength,
    pressureInterfaceGasPressureCellRowsBufferRetained: gasPressureCellRowsBufferRetained,
    retainedGasCellFieldSourceSchema: ULG_PRESSURE_INTERFACE_RETAINED_GAS_CELL_FIELD_SOURCE_SCHEMA,
    retainedGasCellFieldSourceStatus: retainedGasCellFieldSourceReady
      ? 'pressure-interface-retained-gas-cell-field-source-ready'
      : (localPressureGradientReady
          ? 'blocked-retained-gas-cell-field-source-required'
          : 'not-required-uniform-pressure-field'),
    retainedGasCellFieldSourceReady,
    retainedGasCellFieldSourceFamilies: retainedGasCellFieldSourceReady ? ['resident-gas-pressure'] : [],
    retainedGasCellFieldSourceRefCount: workerRetainedGasPressureBufferRefs.length + retainedGasPressureBufferRefs.length,
    pressureInterfaceBufferResidency: backend === 'webgpu'
      ? 'worker-lane-gpu-buffer-retained'
      : 'blocked-non-webgpu-pressure-interface-output',
    pressureInterfaceConsumerAccessProtocol: backend === 'webgpu'
      ? 'same-worker-lane-retained-buffer-ref'
      : 'blocked-cloneable-pressure-interface-force-row-array',
    retainedBufferRefs,
    retainedPressureBufferRefs,
    retainedGasPressureBufferRefs,
    workerRetainedBufferRefs,
    workerRetainedBufferRefCount: workerRetainedBufferRefs.length,
    workerRetainedPressureBufferRefs,
    workerRetainedPressureBufferRefCount: workerRetainedPressureBufferRefs.length,
    workerRetainedGasPressureBufferRefs,
    workerRetainedGasPressureBufferRefCount: workerRetainedGasPressureBufferRefs.length,
    inputFamilies: ['resident-gas-pressure', 'sph-material-interface-field'],
    outputFamilies: ['pressure-interface-force-rows'],
    retainedSourceFamilies: retainedGasCellFieldSourceReady ? ['resident-gas-pressure'] : [],
    requiredPublicationProtocol: 'worker-posts-pressure-interface-compact-summary-and-retained-ref-descriptor-to-nodekernel-state-manager',
    nextRequiredImplementation: 'authorized-pressure-interface-grid-force-consumption'
  };
}

function retainedRefsFromPressureInterfaceStageValue(result = {}) {
  return uniqueNonEmptyStrings([
    ...retainedBufferRefsForMechanicsStageResult(PRESSURE_INTERFACE_STAGE_ID, result),
    ...(result?.retainedBufferRefs || []),
    ...(result?.pressureInterfaceStageRetainedBufferRefs || []),
    ...(result?.workerResidentStage?.retainedBufferRefs || []),
    ...(result?.workerResidentStage?.workerRetainedBufferRefs || [])
  ]);
}

function buildPressureInterfaceWorkerCompactPublicationCandidateFromStageValue({
  pressureResult = null,
  workerRunnerSupplied = false,
  workerModuleUrl = null,
  laneId = null,
  stateKey = null
} = {}) {
  if (!pressureResult || typeof pressureResult !== 'object') return null;
  const pressureSummary = summarizeMechanicsStageLaneResult(PRESSURE_INTERFACE_STAGE_ID, pressureResult);
  const stageExecution = {
    schema: 'peercompute.compute.gpu-resident-lane-stage-execution.v0',
    status: 'completed',
    stageResults: [
      {
        stageId: PRESSURE_INTERFACE_STAGE_ID,
        status: 'completed',
        retainedBufferRefs: retainedRefsFromPressureInterfaceStageValue(pressureResult),
        summary: pressureSummary
      }
    ]
  };
  return buildPressureInterfaceWorkerCompactPublicationCandidate({
    stageExecution,
    stageLaneSummaries: { [PRESSURE_INTERFACE_STAGE_ID]: pressureSummary },
    stageWorkerResidencyStatuses: { [PRESSURE_INTERFACE_STAGE_ID]: 'worker-ready' },
    workerRunnerSupplied,
    workerModuleUrl,
    laneId,
    stateKey
  });
}

function createPressureInterfaceGridForceAdmissionFromPublication({
  publication = null,
  candidate = null,
  pressureResult = null
} = {}) {
  if (!publication || typeof publication !== 'object') return null;
  return {
    schema: 'peercompute.ulg.pressure-interface-grid-force-consumption-admission.v0',
    status: 'pressure-interface-grid-force-consumption-approved',
    gridForceApplicationApproved: true,
    publicationStatus: publication.status || null,
    committed: publication.committed === true,
    hotBufferKey: publication.hotBufferKey || null,
    sourceHotBufferKey: publication.hotBufferKey || null,
    pressureInterfaceForceRowCount: publication.pressureInterfaceForceRowCount
      ?? candidate?.pressureInterfaceForceRowCount
      ?? pressureResult?.forceRowCount
      ?? pressureResult?.pressureInterfaceForceSolver?.forceRowCount
      ?? 0,
    outputFamilies: uniqueNonEmptyStrings(publication.outputFamilies || candidate?.outputFamilies || ['pressure-interface-force-rows']),
    pressureInterfacePublication: publication,
    pressureInterfacePublicationCandidate: candidate || null
  };
}

function pressureInterfaceForceSolverApprovedForGridConsumption(pressureResult = {}, admission = null) {
  const solver = pressureResult?.pressureInterfaceForceSolver || pressureResult?.pressureInterfaceForceSolverResult || null;
  if (!solver || typeof solver !== 'object' || !admission) return null;
  return {
    ...solver,
    forceApplicationStatus: 'pressure-interface-grid-force-consumer-approved',
    gridForceApplicationApproved: true,
    gridForceApplicationAdmission: admission
  };
}

function buildThermalPhaseWorkerCompactPublicationCandidate({
  stageExecution = null,
  stageLaneSummaries = {},
  stageWorkerResidencyStatuses = {},
  workerRunnerSupplied = false,
  workerModuleUrl = null,
  laneId = null,
  stateKey = null
} = {}) {
  const stageResults = stageExecution?.stageResults || [];
  const thermalStageCompleted = stageExecution?.status === 'completed'
    && stageResults.some((entry) => entry?.stageId === THERMAL_PHASE_STAGE_ID && entry.status === 'completed');
  const thermalSummary = stageLaneSummaries[THERMAL_PHASE_STAGE_ID] || {};
  const retainedBufferRefs = retainedRefsFromStageExecution(stageExecution, [THERMAL_PHASE_STAGE_ID]);
  const workerRetainedBufferRefs = workerRetainedRefsFromStageExecution(stageExecution, [THERMAL_PHASE_STAGE_ID]);
  const workerRetainedThermoBufferRefs = uniqueNonEmptyStrings(
    workerRetainedBufferRefs.filter((ref) => String(ref || '').includes('thermo'))
  );
  const retainedThermoBufferRefs = uniqueNonEmptyStrings(
    retainedBufferRefs.filter((ref) => String(ref || '').includes('thermo'))
  );
  const hasThermoRef = workerRetainedThermoBufferRefs.length > 0 || retainedThermoBufferRefs.length > 0;
  const backend = thermalSummary.backend || null;
  const readbackMode = thermalSummary.readbackMode || null;
  const workerResidencyStatus = stageWorkerResidencyStatuses[THERMAL_PHASE_STAGE_ID] || null;
  const blocker = !workerRunnerSupplied
    ? 'worker-runner-not-supplied'
    : (!thermalStageCompleted
      ? 'thermal-phase-stage-execution-not-completed'
      : (workerResidencyStatus !== 'worker-ready'
        ? 'thermal-phase-worker-residency-not-ready'
        : (backend !== 'webgpu'
          ? 'thermal-phase-webgpu-backend-not-proven'
          : (readbackMode !== NO_FULL_READBACK_MODE || thermalSummary.normalHotLoopReadbackFree !== true
            ? 'thermal-phase-no-full-readback-required'
            : (!hasThermoRef
              ? 'worker-retained-thermal-buffer-ref-missing'
              : null)))));
  const candidateReady = !blocker;
  return {
    schema: ULG_SPH_THERMAL_PHASE_WORKER_COMPACT_PUBLICATION_CANDIDATE_SCHEMA,
    candidateStatus: candidateReady
      ? 'worker-retained-thermal-phase-publication-candidate-ready'
      : 'worker-retained-thermal-phase-publication-candidate-blocked',
    blocker,
    authority: 'compute-manager-gpuhub-worker-stage-output',
    publicationAuthority: 'nodekernel-state-manager-admission-required',
    publicationStatus: candidateReady
      ? 'blocked-authorized-thermal-phase-publication-required'
      : 'blocked-candidate-not-ready',
    publicationReason: candidateReady
      ? 'worker-retained-thermal-phase-gpu-handles-are-not-main-thread-transferable'
      : blocker,
    sameDeviceMainThreadHandlesAvailable: false,
    workerLocalRetainedRefsOnly: true,
    compactSummaryStatus: readbackMode === NO_FULL_READBACK_MODE && thermalSummary.normalHotLoopReadbackFree === true
      ? 'worker-thermal-phase-compact-summary-required'
      : 'blocked-full-readback-mode',
    compactSummaryRequired: true,
    stateManagerAdmissionRequired: true,
    laneId,
    stateKey,
    workerModuleUrl,
    stageOrder: [THERMAL_PHASE_STAGE_ID],
    observedStageOrder: stageResults.map((entry) => entry.stageId).filter(Boolean),
    stageBackends: { [THERMAL_PHASE_STAGE_ID]: backend },
    stageReadbackModes: { [THERMAL_PHASE_STAGE_ID]: readbackMode },
    stageWorkerResidencyStatuses: { [THERMAL_PHASE_STAGE_ID]: workerResidencyStatus },
    thermalPhaseEvidencePassed: thermalSummary.thermalPhaseEvidencePassed === true,
    thermalPhaseAuthoritativeMutation: thermalSummary.thermalPhaseAuthoritativeMutation ?? null,
    workerRetainedThermoInputStatus: thermalSummary.workerRetainedThermoInputStatus || null,
    workerRetainedThermoOutputStatus: thermalSummary.workerRetainedThermoOutputStatus || null,
    retainedBufferRefs,
    retainedThermoBufferRefs,
    workerRetainedBufferRefs,
    workerRetainedBufferRefCount: workerRetainedBufferRefs.length,
    workerRetainedThermoBufferRefs,
    workerRetainedThermoBufferRefCount: workerRetainedThermoBufferRefs.length,
    outputFamilies: ['sph-thermo-phase'],
    requiredPublicationProtocol: 'worker-posts-thermal-phase-compact-summary-and-retained-ref-descriptor-to-nodekernel-state-manager',
    nextRequiredImplementation: 'authorized-worker-thermal-phase-output-publication'
  };
}

function buildReactionProductWorkerCompactPublicationCandidate({
  stageExecution = null,
  stageLaneSummaries = {},
  stageWorkerResidencyStatuses = {},
  workerRunnerSupplied = false,
  workerModuleUrl = null,
  laneId = null,
  stateKey = null
} = {}) {
  const stageResults = stageExecution?.stageResults || [];
  const reactionStageCompleted = stageExecution?.status === 'completed'
    && stageResults.some((entry) => entry?.stageId === REACTION_PRODUCT_STAGE_ID && entry.status === 'completed');
  const reactionSummary = stageLaneSummaries[REACTION_PRODUCT_STAGE_ID] || {};
  const retainedBufferRefs = retainedRefsFromStageExecution(stageExecution, [REACTION_PRODUCT_STAGE_ID]);
  const workerRetainedBufferRefs = workerRetainedRefsFromStageExecution(stageExecution, [REACTION_PRODUCT_STAGE_ID]);
  const workerRetainedProductBufferRefs = uniqueNonEmptyStrings(
    workerRetainedBufferRefs.filter((ref) => {
      const text = String(ref || '').toLowerCase();
      return text.includes('product') || text.includes('residentproductmass') || text.includes('producteventbuffer');
    })
  );
  const retainedProductBufferRefs = uniqueNonEmptyStrings(
    retainedBufferRefs.filter((ref) => String(ref || '').includes('resident-product-mass'))
  );
  const hasWorkerRetainedRefs = workerRetainedBufferRefs.length > 0;
  const hasProductRef = workerRetainedProductBufferRefs.length > 0 || retainedProductBufferRefs.length > 0;
  const backend = reactionSummary.backend || null;
  const readbackMode = reactionSummary.readbackMode || null;
  const workerResidencyStatus = stageWorkerResidencyStatuses[REACTION_PRODUCT_STAGE_ID] || null;
  const blocker = !workerRunnerSupplied
    ? 'worker-runner-not-supplied'
    : (!reactionStageCompleted
      ? 'reaction-product-stage-execution-not-completed'
      : (workerResidencyStatus !== 'worker-ready'
        ? 'reaction-product-worker-residency-not-ready'
        : (backend !== 'webgpu'
          ? 'reaction-product-webgpu-backend-not-proven'
          : (readbackMode !== NO_FULL_READBACK_MODE || reactionSummary.normalHotLoopReadbackFree !== true
            ? 'reaction-product-no-full-readback-required'
            : (!hasWorkerRetainedRefs
              ? 'worker-retained-reaction-product-buffer-refs-missing'
              : (!hasProductRef
                ? 'worker-retained-resident-product-mass-ref-missing'
                : null))))));
  const candidateReady = !blocker;
  return {
    schema: ULG_SPH_REACTION_PRODUCT_WORKER_COMPACT_PUBLICATION_CANDIDATE_SCHEMA,
    candidateStatus: candidateReady
      ? 'worker-retained-reaction-product-publication-candidate-ready'
      : 'worker-retained-reaction-product-publication-candidate-blocked',
    blocker,
    authority: 'compute-manager-gpuhub-worker-stage-output',
    publicationAuthority: 'nodekernel-state-manager-admission-required',
    publicationStatus: candidateReady
      ? 'blocked-authorized-reaction-product-publication-required'
      : 'blocked-candidate-not-ready',
    publicationReason: candidateReady
      ? 'worker-retained-reaction-product-gpu-handles-are-not-main-thread-transferable'
      : blocker,
    sameDeviceMainThreadHandlesAvailable: false,
    workerLocalRetainedRefsOnly: true,
    compactSummaryStatus: readbackMode === NO_FULL_READBACK_MODE && reactionSummary.normalHotLoopReadbackFree === true
      ? 'worker-reaction-product-compact-summary-required'
      : 'blocked-full-readback-mode',
    compactSummaryRequired: true,
    stateManagerAdmissionRequired: true,
    laneId,
    stateKey,
    workerModuleUrl,
    stageOrder: [REACTION_PRODUCT_STAGE_ID],
    observedStageOrder: stageResults.map((entry) => entry.stageId).filter(Boolean),
    stageBackends: { [REACTION_PRODUCT_STAGE_ID]: backend },
    stageReadbackModes: { [REACTION_PRODUCT_STAGE_ID]: readbackMode },
    stageWorkerResidencyStatuses: { [REACTION_PRODUCT_STAGE_ID]: workerResidencyStatus },
    reactionProductEvidencePassed: reactionSummary.reactionProductEvidencePassed === true,
    reactionProductAuthoritativeMutation: reactionSummary.reactionProductAuthoritativeMutation ?? null,
    reactionProductOutputMutatesParticles: reactionSummary.reactionProductOutputMutatesParticles ?? null,
    reactionProductResidentProductMassStatus: reactionSummary.reactionProductResidentProductMassStatus || null,
    reactionProductResidentProductMassBufferRetained: reactionSummary.reactionProductResidentProductMassBufferRetained === true,
    workerRetainedThermoInputStatus: reactionSummary.workerRetainedThermoInputStatus || null,
    workerRetainedThermoOutputStatus: reactionSummary.workerRetainedThermoOutputStatus || null,
    retainedBufferRefs,
    retainedProductBufferRefs,
    workerRetainedBufferRefs,
    workerRetainedBufferRefCount: workerRetainedBufferRefs.length,
    workerRetainedProductBufferRefs,
    workerRetainedProductBufferRefCount: workerRetainedProductBufferRefs.length,
    outputFamilies: ['sph-particle-state', 'sph-thermo-phase', 'mls-mpm-mechanics', 'resident-product-mass'],
    requiredPublicationProtocol: 'worker-posts-reaction-product-compact-summary-and-retained-ref-descriptor-to-nodekernel-state-manager',
    nextRequiredImplementation: 'authorized-worker-reaction-product-output-publication'
  };
}

export async function runMlsMpmMechanicsOnlyResidentStepWithComputeManagerStageTasks({
  computeManager,
  nodeKernel = null,
  modulePath,
  stageTaskIdPrefix = null,
  useNativeTaskGraph = true,
  useGpuResidentLaneStagePlan = true,
  useGpuHubResidentStageExecutors = true,
  requestGpuHubWorkerResidency = true,
  gpuHubResidentStageWorkerRunner = null,
  gpuHubResidentStageWorkerPolicy = null,
  gpuHubResidentStageWorkerModuleUrl = null,
  gpuHubResidentStageWorkerOutputPublisher = null,
  gpuHubResidentPressureInterfaceStageWorkerOutputPublisher = null,
  gpuHubResidentThermalStageWorkerOutputPublisher = null,
  gpuHubResidentReactionProductStageWorkerOutputPublisher = null,
  gpuHubResidentStageWorkerUseRetainedInput = false,
  gpuHubResidentStageWorkerRetainedContinuationPlan = null,
  gpuHubResidentStageWorkerRetainedContinuationSource = null,
  gpuHubResidentStageWorkerRetainedContinuationHotBufferKey = null,
  gpuHubResidentStageWorkerRetainedAccessContract = null,
  sameDeviceRetainedBufferImport = null,
  localSameDeviceRetainedBufferImport = null,
  residentAuthorityHost = null,
  includeSpatialGasLedgerProducerStage = false,
  includeGasCellEosProducerStage = false,
  includePressureInterfaceStage = false,
  includeThermalPhaseStage = false,
  includeReactionProductStage = false,
  gpuResidentLaneId = null,
  gpuResidentLaneStateKey = null,
  gpuResidentLaneDomainKey = null,
  ...stepOptions
} = {}) {
  if (!computeManager || typeof computeManager.submitTask !== 'function') {
    throw new Error('runMlsMpmMechanicsOnlyResidentStepWithComputeManagerStageTasks requires a ComputeManager-compatible submitTask() method');
  }
  if (typeof modulePath !== 'string' || modulePath.trim() === '') {
    throw new Error('runMlsMpmMechanicsOnlyResidentStepWithComputeManagerStageTasks requires a modulePath for stage task handlers');
  }
  const stepIndex = finiteNumber(stepOptions.sphParticleState?.step ?? stepOptions.mlsMpmParticleState?.step, 0);
  const taskIdPrefix = stageTaskIdPrefix || `ulg:mechanics-stage-chain:${stepIndex}`;
  const submittedStageTasks = [];
  const stageResults = {};
  const normalizedSameDeviceRetainedBufferImport = normalizeSameDeviceRetainedBufferImportDescriptor(
    sameDeviceRetainedBufferImport || localSameDeviceRetainedBufferImport
  );
  let nativeTaskGraph = null;
  let gpuResidentLaneStagePlanLease = null;
  let gpuResidentLaneStageNodeKernelPlacementPreflight = null;
  let gpuResidentLaneStageNodeKernelExecutionAuthority = null;
  let gpuResidentLaneStagePlacementPreflight = null;
  let gpuResidentLaneStagePlanExecution = null;
  let gpuResidentLaneStagePlanLeaseExecution = null;
  let gpuResidentLaneStagePlanRejected = null;
  let gpuHubResidentStageExecutorRegistrations = [];
  let gpuHubResidentStageExecutorMode = 'not-requested';
  const laneStagePlanId = gpuResidentLaneId || `${taskIdPrefix}:mechanics-stage-lane`;
  const laneStagePlanStateKey = gpuResidentLaneStateKey || `${taskIdPrefix}:mechanics-stage-state`;
  const laneStagePlanContract = createMlsMpmMechanicsStageLaneContract({
    laneId: laneStagePlanId,
    stateKey: laneStagePlanStateKey,
    domainKey: gpuResidentLaneDomainKey,
    includeSpatialGasLedgerProducerStage,
    includeGasCellEosProducerStage,
    includePressureInterfaceStage,
    includeThermalPhaseStage,
    includeReactionProductStage
  });
  const stageOrder = laneStagePlanContract.passDagStages.map((stage) => stage.id);
  const preflightGpuResidentLaneStagePlacement = (leaseId, options = {}) => {
    if (typeof nodeKernel?.preflightGpuResidentLaneStagePlacement === 'function') {
      gpuResidentLaneStageNodeKernelPlacementPreflight = nodeKernel.preflightGpuResidentLaneStagePlacement(
        leaseId,
        options
      );
      gpuResidentLaneStagePlacementPreflight =
        gpuResidentLaneStageNodeKernelPlacementPreflight?.computeManagerPreflight || null;
      return gpuResidentLaneStagePlacementPreflight;
    }
    if (typeof computeManager.preflightGpuResidentLaneStagePlacement === 'function') {
      gpuResidentLaneStagePlacementPreflight = computeManager.preflightGpuResidentLaneStagePlacement(
        leaseId,
        options
      );
      return gpuResidentLaneStagePlacementPreflight;
    }
    return null;
  };
  const executeGpuResidentLaneStagePlan = async (leaseId, options = {}) => {
    if (typeof nodeKernel?.executeGpuResidentLaneStagePlan === 'function') {
      const execution = await nodeKernel.executeGpuResidentLaneStagePlan(leaseId, options);
      gpuResidentLaneStageNodeKernelExecutionAuthority =
        execution?.nodeKernelGpuResidentStageAuthority || null;
      return execution;
    }
    if (typeof computeManager.executeGpuResidentLaneStagePlan === 'function') {
      gpuResidentLaneStageNodeKernelExecutionAuthority = null;
      return computeManager.executeGpuResidentLaneStagePlan(leaseId, options);
    }
    return null;
  };
  const completeGpuResidentLaneStagePlanLease = (source) => {
    if (!gpuResidentLaneStagePlanLease?.leaseId) return null;
    if (gpuResidentLaneStageNodeKernelExecutionAuthority?.localHotBufferRefreshRequired === true) {
      if (typeof computeManager.rejectGpuResidentLaneLease === 'function') {
        gpuResidentLaneStagePlanRejected = computeManager.rejectGpuResidentLaneLease(
          gpuResidentLaneStagePlanLease.leaseId,
          'remote-stage-result-requires-local-hot-buffer-refresh'
        );
      }
      return null;
    }
    return computeManager.completeGpuResidentLaneLease(
      gpuResidentLaneStagePlanLease.leaseId,
      {
        status: 'queue-work-completed',
        method: gpuResidentLaneStageNodeKernelExecutionAuthority
          ? 'node-kernel.executeGpuResidentLaneStagePlan'
          : 'compute-manager.executeGpuResidentLaneStagePlan',
        queueCompletionStatus: 'queue-work-completed',
        queueCompletionMethod: gpuResidentLaneStageNodeKernelExecutionAuthority
          ? 'node-kernel.executeGpuResidentLaneStagePlan'
          : 'compute-manager.executeGpuResidentLaneStagePlan',
        retainedBufferRefs: gpuResidentLaneStagePlanExecution?.retainedBufferRefs || [],
        source
      }
    );
  };
  const workerRetainedContinuationPlan = gpuHubResidentStageWorkerRetainedContinuationPlan
    || (typeof residentAuthorityHost?.planWorkerRetainedContinuation === 'function'
      && (
        gpuHubResidentStageWorkerRetainedContinuationSource
        || gpuHubResidentStageWorkerRetainedContinuationHotBufferKey
        || gpuHubResidentStageWorkerRetainedAccessContract
      )
      ? residentAuthorityHost.planWorkerRetainedContinuation({
          source: gpuHubResidentStageWorkerRetainedContinuationSource,
          hotBufferKey: gpuHubResidentStageWorkerRetainedContinuationHotBufferKey,
          workerRetainedAccessContract: gpuHubResidentStageWorkerRetainedAccessContract,
          workerRunner: gpuHubResidentStageWorkerRunner,
          requiredOutputFamilies: ['sph-particle-state', 'mls-mpm-mechanics'],
          consumerStageId: 'p2g',
          consumerLawNodeId: 'ulg-mls-mpm-mechanics-p2g-stage',
          requestedLaneId: laneStagePlanId,
          requestedStateKey: laneStagePlanStateKey
        })
      : null);
  const useWorkerRetainedG2pInput = gpuHubResidentStageWorkerUseRetainedInput === true
    || workerRetainedContinuationPlan?.useWorkerRetainedInput === true;
  const sphParticleState = stepOptions.sphParticleState;
  const mlsMpmParticleState = stepOptions.mlsMpmParticleState;
  const dims = finiteVector3(stepOptions.boxDimsM, DEFAULT_BOX_DIMS_M);
  const gravity = finiteVector3(
    stepOptions.gravityMPerS2 ?? mlsMpmParticleState?.gravityMPerS2,
    DEFAULT_GRAVITY_M_PER_S2
  );
  const dtSeconds = finiteNumber(stepOptions.dt ?? mlsMpmParticleState?.mechanicsDtS, 0);
  const cflFactor = stepOptions.cflFactor ?? mlsMpmParticleState?.gridCflFactor ?? DEFAULT_CFL_FACTOR;
  const readbackMode = stepOptions.readbackMode === NO_FULL_READBACK_MODE ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE;
  const nativeTaskGraphSubmitter = nodeKernel && typeof nodeKernel.submitTaskGraph === 'function'
    ? nodeKernel
    : computeManager;
  const canUseNativeTaskGraph = useNativeTaskGraph !== false
    && typeof nativeTaskGraphSubmitter.submitTaskGraph === 'function'
    && stepOptions.preferWebGpu !== true
    && includeSpatialGasLedgerProducerStage !== true
    && includeGasCellEosProducerStage !== true
    && includePressureInterfaceStage !== true
    && includeThermalPhaseStage !== true
    && includeReactionProductStage !== true
    && !stepOptions.sphParticleUpload
    && !stepOptions.mlsMpmParticleUpload;
  if (canUseNativeTaskGraph) {
    nativeTaskGraph = await nativeTaskGraphSubmitter.submitTaskGraph({
      graphId: `${taskIdPrefix}:native-graph`,
      cachePolicy: {
        mode: 'record-only',
        scope: 'ulg-mechanics-stage-chain-local-oracle'
      },
      cacheAdmission: {
        status: 'recorded-not-admitted',
        admitted: false,
        authority: 'peercompute-state-manager-admission-required',
        validatorId: 'ulg-mechanics-stage-chain-cpu-oracle',
        reason: 'physics-stage-cache-artifact-recorded-for-provenance-not-replay',
        invalidationRefs: [
          `module:${modulePath}`,
          `readback:${readbackMode}`,
          `prefer-webgpu:false`
        ]
      },
      cacheInputs: {
        graphFamily: 'ulg-mls-mpm-mechanics-stage-chain',
        graphVersion: ULG_MLS_MPM_MECHANICS_STAGE_TASK_CHAIN_SCHEMA,
        lawGraphId: 'peercompute.ulg.local-sph-law-closure-graph',
        lawIds: [
          'ulg-mls-mpm-mechanics-law',
          'ulg-mls-mpm-mechanics-p2g-stage',
          'ulg-mls-mpm-mechanics-grid-update-stage',
          'ulg-mls-mpm-mechanics-g2p-stage'
        ],
        stateFamilies: ['sph-particle-state', 'mls-mpm-mechanics', 'mls-mpm-grid'],
        readFamilies: ['sph-particle-state', 'mls-mpm-mechanics'],
        writeFamilies: ['sph-particle-state', 'mls-mpm-mechanics'],
        closureRefs: [
          'mls-mpm-transfer-kernel',
          'mechanics-material-table',
          'sealed-container-boundary',
          'gravity-field'
        ],
        invalidationRefs: [
          `module:${modulePath}`,
          `readback:${readbackMode}`,
          `prefer-webgpu:false`
        ],
        stateRefs: [
          `sph-step:${finiteNumber(sphParticleState?.step, stepIndex)}`,
          `sph-count:${Math.max(0, Math.round(finiteNumber(sphParticleState?.particleCount, 0)))}`,
          `mls-step:${finiteNumber(mlsMpmParticleState?.step, stepIndex)}`,
          `mls-count:${Math.max(0, Math.round(finiteNumber(mlsMpmParticleState?.particleCount, sphParticleState?.particleCount || 0)))}`
        ],
        units: {
          length: 'm',
          time: 's',
          acceleration: 'm/s^2'
        },
        values: {
          stepIndex,
          dtSeconds,
          boxDimsM: dims,
          gravityMPerS2: gravity,
          gridSpacingM: finiteNumber(stepOptions.gridSpacingM ?? sphParticleState?.smoothingLengthM, 0),
          cflFactor,
          readbackMode
        }
      },
      placementPolicy: {
        mode: 'local-cpu-oracle',
        locality: 'local-inline',
        authority: 'compute-manager',
        advisory: false
      },
      cancellation: {
        mode: 'cooperative'
      },
      nodes: [
        {
          id: 'p2g',
          cacheInput: {
            stage: 'p2g',
            reads: ['sph-particle-state', 'mls-mpm-mechanics'],
            writes: ['mls-mpm-grid']
          },
          createTask: () => createMlsMpmMechanicsP2gStageComputeTask({
            sphParticleState,
            mlsMpmParticleState,
            gridSpacingM: stepOptions.gridSpacingM ?? sphParticleState?.smoothingLengthM,
            boxDimsM: dims,
            dt: dtSeconds,
            modulePath,
            taskId: `${taskIdPrefix}:p2g`,
            preferWebGpu: false,
            readbackMode
          })
        },
        {
          id: 'gridUpdate',
          dependsOn: ['p2g'],
          cacheInput: {
            stage: 'gridUpdate',
            reads: ['mls-mpm-grid'],
            writes: ['mls-mpm-grid']
          },
          createTask: ({ getResult }) => createMlsMpmMechanicsGridUpdateStageComputeTask({
            p2gGridProjection: getResult('p2g'),
          dt: dtSeconds,
          gravityMPerS2: gravity,
          boxDimsM: dims,
          cflFactor,
          pressureInterfaceForceRowsBuffer: stepOptions.pressureInterfaceForceRowsBuffer || null,
          pressureInterfaceForceSolver: stepOptions.pressureInterfaceForceSolver || null,
          pressureInterfaceGridForceAdmission: stepOptions.pressureInterfaceGridForceAdmission || null,
          modulePath,
            taskId: `${taskIdPrefix}:gridUpdate`,
            preferWebGpu: false,
            readbackMode
          })
        },
        {
          id: 'g2p',
          dependsOn: ['gridUpdate'],
          cacheInput: {
            stage: 'g2p',
            reads: ['mls-mpm-grid', 'sph-particle-state', 'mls-mpm-mechanics'],
            writes: ['sph-particle-state', 'mls-mpm-mechanics']
          },
          createTask: ({ getResult }) => createMlsMpmMechanicsG2pStageComputeTask({
            sphParticleState,
            mlsMpmParticleState,
            gridUpdate: getResult('gridUpdate'),
            dt: dtSeconds,
            boxDimsM: dims,
            modulePath,
            taskId: `${taskIdPrefix}:g2p`,
            preferWebGpu: false,
            readbackMode,
            sameDeviceRetainedBufferImport: normalizedSameDeviceRetainedBufferImport
          })
        }
      ]
    });
    for (const report of nativeTaskGraph.nodeReports || []) {
      submittedStageTasks.push({
        stageId: report.nodeId,
        taskId: report.taskId,
        taskFamily: report.taskFamily,
        schema: null,
        residency: 'cpu-oracle',
        suppressCommitDelta: true
      });
    }
    Object.assign(stageResults, nativeTaskGraph.nodeResults || {});
  }
  const canUseGpuResidentLaneStagePlan = useGpuResidentLaneStagePlan !== false
    && typeof computeManager.acquireGpuResidentLaneLease === 'function'
    && typeof computeManager.executeGpuResidentLaneStagePlan === 'function'
    && typeof computeManager.completeGpuResidentLaneLease === 'function'
    && nativeTaskGraph?.nodeResults;
  if (canUseGpuResidentLaneStagePlan) {
    try {
      gpuResidentLaneStagePlanLease = computeManager.acquireGpuResidentLaneLease({
        laneId: laneStagePlanId,
        stateKey: laneStagePlanStateKey,
        domainKey: gpuResidentLaneDomainKey,
        solverId: 'ulg-mls-mpm-mechanics-stage-plan',
        taskId: `${taskIdPrefix}:mechanics-stage-plan`,
        owner: 'ulg-mls-mpm-mechanics-law',
        readFamilies: laneStagePlanContract.readFamilies,
        writeFamilies: laneStagePlanContract.writeFamilies,
        retainedBufferRefs: laneStagePlanContract.laneMustRetainBuffers,
        queueFencePolicy: 'queue.onSubmittedWorkDone-before-admission',
        residentSequenceLaneContract: laneStagePlanContract,
        copyBudget: {
          schema: 'peercompute.compute.gpu-resident-lane-copy-budget.v0',
          uploadBytes: 0,
          readbackBytes: 0,
          retainedBytes: 0,
          compactSummaryBytes: 0,
          fullReadbackReason: null
        }
      });
      const stagePlanExecutionOptions = {
        input: {
          source: 'ulg-mechanics-stage-chain-native-task-graph-results',
          taskIdPrefix
        },
        context: {
          nodeKernelOwned: nativeTaskGraph?.nodeKernelOwned === true,
          nativeTaskGraphSchema: nativeTaskGraph?.schema || null,
          nativeTaskGraphStatus: nativeTaskGraph?.status || null
        },
        stageExecutors: {
          p2g: () => ({
            value: stageResults.p2g,
            retainedBufferRefs: retainedBufferRefsForMechanicsStageResult('p2g', stageResults.p2g),
            summary: {
              computeTaskResultSchema: stageResults.p2g?.computeTaskResultSchema || null,
              evidencePassed: stageResults.p2g?.mechanicsP2gStageTaskEvidence?.passed === true,
              ...summarizeMechanicsStageLaneResult('p2g', stageResults.p2g)
            }
          }),
          gridUpdate: () => ({
            value: stageResults.gridUpdate,
            retainedBufferRefs: retainedBufferRefsForMechanicsStageResult('gridUpdate', stageResults.gridUpdate),
            summary: {
              computeTaskResultSchema: stageResults.gridUpdate?.computeTaskResultSchema || null,
              evidencePassed: stageResults.gridUpdate?.mechanicsGridUpdateStageTaskEvidence?.passed === true,
              ...summarizeMechanicsStageLaneResult('gridUpdate', stageResults.gridUpdate)
            }
          }),
          g2p: () => ({
            value: stageResults.g2p,
            retainedBufferRefs: retainedBufferRefsForMechanicsStageResult('g2p', stageResults.g2p),
            summary: {
              computeTaskResultSchema: stageResults.g2p?.computeTaskResultSchema || null,
              evidencePassed: stageResults.g2p?.mechanicsG2pStageTaskEvidence?.passed === true,
              ...summarizeMechanicsStageLaneResult('g2p', stageResults.g2p)
            }
          })
        }
      };
      preflightGpuResidentLaneStagePlacement(gpuResidentLaneStagePlanLease.leaseId, stagePlanExecutionOptions);
      gpuResidentLaneStagePlanExecution = await executeGpuResidentLaneStagePlan(
        gpuResidentLaneStagePlanLease.leaseId,
        stagePlanExecutionOptions
      );
      gpuResidentLaneStagePlanLeaseExecution =
        completeGpuResidentLaneStagePlanLease('ulg-mechanics-stage-plan-executor');
    } catch (error) {
      if (gpuResidentLaneStagePlanLease?.leaseId && typeof computeManager.rejectGpuResidentLaneLease === 'function') {
        try {
          gpuResidentLaneStagePlanRejected = computeManager.rejectGpuResidentLaneLease(
            gpuResidentLaneStagePlanLease.leaseId,
            'mechanics-stage-plan-executor-error'
          );
        } catch {
          // Keep the original stage-plan error as the diagnostic source.
        }
      }
      gpuResidentLaneStagePlanExecution = {
        schema: 'peercompute.compute.gpu-resident-lane-stage-execution.v0',
        status: 'failed',
        reason: error instanceof Error ? error.message : String(error)
      };
    }
  }
  const submitStageTask = async (stageId, createTask, stageOptions) => {
    if (nativeTaskGraph?.nodeResults?.[stageId]) return nativeTaskGraph.nodeResults[stageId];
    if (stageResults[stageId]) return stageResults[stageId];
    const stageTaskOptions = {
      ...stripMechanicsStageTaskRuntimeFields(stageOptions),
      modulePath,
      taskId: `${taskIdPrefix}:${stageId}`,
      preferWebGpu: stageOptions.preferWebGpu === true,
      readbackMode: stageOptions.readbackMode
    };
    if (stageOptions.preferWebGpu === true) {
      stageTaskOptions.laneId = stageOptions.laneId || laneStagePlanId;
      stageTaskOptions.stateKey = stageOptions.stateKey || laneStagePlanStateKey;
      stageTaskOptions.domainKey = stageOptions.domainKey ?? gpuResidentLaneDomainKey;
      stageTaskOptions.localExecution = stageOptions.localExecution || 'inline';
      stageTaskOptions.queueFencePolicy = stageOptions.queueFencePolicy || 'queue.onSubmittedWorkDone-before-admission';
      stageTaskOptions.device = stageOptions.device ?? stepOptions.device ?? null;
      stageTaskOptions.deviceResult = stageOptions.deviceResult ?? stepOptions.deviceResult ?? null;
      if (stageOptions.navigatorRef) stageTaskOptions.navigatorRef = stageOptions.navigatorRef;
      else if (stepOptions.navigatorRef) stageTaskOptions.navigatorRef = stepOptions.navigatorRef;
    }
    const task = createTask(stageTaskOptions);
    submittedStageTasks.push({
      stageId,
      taskId: task.id,
      taskFamily: task.taskFamily,
      schema: task.schema,
      residency: task.residency,
      gpuResidentLaneLaneId: task.gpuResidentLane?.laneId || null,
      gpuResidentLaneStateKey: task.gpuResidentLane?.stateKey || null,
      gpuFenceRequired: task.gpuFence?.required === true,
      suppressCommitDelta: task.suppressCommitDelta === true
    });
    const result = await computeManager.submitTask(task);
    stageResults[stageId] = result;
    return result;
  };
  let gasCellEosProducerImportPublication = null;
  const pressureInterfaceInputsFromGasCellEosProducer = () => {
    const gasCellEosProducerResult = stageResults[GAS_CELL_EOS_PRODUCER_STAGE_ID] || null;
    if (!gasCellEosProducerResultReady(gasCellEosProducerResult)) {
      return {
        gasCellEosProducerResult,
        gasPressureSummary: stepOptions.gasPressureSummary || null,
        pressureFeedback: stepOptions.pressureFeedback || null,
        pressureInterfaceGasCellFieldImport: stepOptions.pressureInterfaceGasCellFieldImport || null,
        pressureInterfaceGasCellFieldAdmission: stepOptions.pressureInterfaceGasCellFieldAdmission || null,
        gasCellEosProducerImportPublication
      };
    }
    if (!stepOptions.pressureInterfaceGasCellFieldImport && !gasCellEosProducerImportPublication) {
      try {
        gasCellEosProducerImportPublication = publishGasCellEosProducerImportForPressureInterface({
          residentAuthorityHost,
          gasCellEosProducerResult,
          pressureInterfaceGasCellFieldAdmission: stepOptions.pressureInterfaceGasCellFieldAdmission || null,
          cacheKey: `${taskIdPrefix}:gas-cell-eos-producer-pressure-interface-import`,
          stateKey: laneStagePlanStateKey,
          sourceTaskId: gasCellEosProducerResult.computeTaskId || `${taskIdPrefix}:${GAS_CELL_EOS_PRODUCER_STAGE_ID}`,
          sourceNodeId: 'ulg-resident-gas-cell-eos-law',
          sourceStage: GAS_CELL_EOS_PRODUCER_STAGE_ID
        });
      } catch (error) {
        gasCellEosProducerImportPublication = {
          schema: 'peercompute.ulg.gas-cell-eos-producer-pressure-interface-import-publication.v0',
          status: 'gas-cell-eos-producer-import-publication-error',
          blocker: error instanceof Error ? error.message : String(error),
          pressureInterfaceGasCellFieldImport: null,
          pressureInterfaceGasCellFieldAdmission: stepOptions.pressureInterfaceGasCellFieldAdmission || null
        };
      }
    }
    return {
      gasCellEosProducerResult,
      gasPressureSummary: pressureSummaryWithGasCellEosProducerResult(
        stepOptions.gasPressureSummary || null,
        gasCellEosProducerResult
      ),
      pressureFeedback: pressureFeedbackWithGasCellEosProducerResult(
        stepOptions.pressureFeedback || null,
        gasCellEosProducerResult
      ),
      pressureInterfaceGasCellFieldImport: stepOptions.pressureInterfaceGasCellFieldImport
        || gasCellEosProducerImportPublication?.pressureInterfaceGasCellFieldImport
        || null,
      pressureInterfaceGasCellFieldAdmission: stepOptions.pressureInterfaceGasCellFieldAdmission
        || gasCellEosProducerImportPublication?.pressureInterfaceGasCellFieldAdmission
        || null,
      gasCellEosProducerImportPublication
    };
  };
  let pressureInterfaceSameFrameWorkerCompactPublicationCandidate = null;
  let pressureInterfaceSameFrameWorkerCompactPublication = null;
  let pressureInterfaceSameFrameGridForceAdmission = stepOptions.pressureInterfaceGridForceAdmission || null;
  const publishSameFramePressureInterfaceForGridUpdate = async (pressureResult = null) => {
    if (
      !pressureResult
      || pressureInterfaceSameFrameGridForceAdmission
      || stepOptions.approveSameFramePressureInterfaceGridForces !== true
      || typeof gpuHubResidentPressureInterfaceStageWorkerOutputPublisher !== 'function'
    ) {
      return {
        pressureInterfaceForceSolver: stepOptions.pressureInterfaceForceSolver || null,
        pressureInterfaceGridForceAdmission: pressureInterfaceSameFrameGridForceAdmission,
        pressureInterfaceForceRowsBuffer: stepOptions.pressureInterfaceForceRowsBuffer || null
      };
    }
    const candidate = buildPressureInterfaceWorkerCompactPublicationCandidateFromStageValue({
      pressureResult,
      workerRunnerSupplied: Boolean(gpuHubResidentStageWorkerRunner),
      workerModuleUrl: gpuHubResidentStageWorkerModuleUrl || null,
      laneId: laneStagePlanId,
      stateKey: laneStagePlanStateKey
    });
    pressureInterfaceSameFrameWorkerCompactPublicationCandidate = candidate;
    if (candidate?.candidateStatus !== 'worker-retained-pressure-interface-publication-candidate-ready') {
      return {
        pressureInterfaceForceSolver: null,
        pressureInterfaceGridForceAdmission: null,
        pressureInterfaceForceRowsBuffer: null
      };
    }
    pressureInterfaceSameFrameWorkerCompactPublication = await gpuHubResidentPressureInterfaceStageWorkerOutputPublisher({
      candidate,
      workerRunner: gpuHubResidentStageWorkerRunner,
      workerModuleUrl: gpuHubResidentStageWorkerModuleUrl || null,
      laneId: laneStagePlanId,
      stateKey: laneStagePlanStateKey,
      sourceTaskId: `${taskIdPrefix}:mechanics-stage-plan`,
      sourceNodeId: 'ulg-pressure-interface-force-law',
      sourceStage: PRESSURE_INTERFACE_STAGE_ID,
      sameFrameConsumerStage: 'gridUpdate'
    });
    pressureInterfaceSameFrameGridForceAdmission = createPressureInterfaceGridForceAdmissionFromPublication({
      publication: pressureInterfaceSameFrameWorkerCompactPublication,
      candidate,
      pressureResult
    });
    return {
      pressureInterfaceForceSolver: pressureInterfaceForceSolverApprovedForGridConsumption(
        pressureResult,
        pressureInterfaceSameFrameGridForceAdmission
      ),
      pressureInterfaceGridForceAdmission: pressureInterfaceSameFrameGridForceAdmission,
      pressureInterfaceForceRowsBuffer: pressureResult.forceRowsBuffer || pressureResult.pressureInterfaceForceRowsBuffer || null
    };
  };
  const laneStageExecutors = {
    p2g: async () => {
      const result = await submitStageTask('p2g', createMlsMpmMechanicsP2gStageComputeTask, {
        sphParticleState,
        mlsMpmParticleState,
        gridSpacingM: stepOptions.gridSpacingM ?? sphParticleState?.smoothingLengthM,
        boxDimsM: dims,
        dt: dtSeconds,
        laneId: laneStagePlanId,
        stateKey: laneStagePlanStateKey,
        domainKey: gpuResidentLaneDomainKey,
        preferWebGpu: stepOptions.preferWebGpu === true,
        readbackMode,
        sameDeviceRetainedBufferImport: normalizedSameDeviceRetainedBufferImport
      });
      return {
        value: result,
        retainedBufferRefs: retainedBufferRefsForMechanicsStageResult('p2g', result),
        summary: {
          computeTaskResultSchema: result?.computeTaskResultSchema || null,
          evidencePassed: result?.mechanicsP2gStageTaskEvidence?.passed === true,
          ...summarizeMechanicsStageLaneResult('p2g', result)
        }
      };
    },
    [SPATIAL_GAS_LEDGER_PRODUCER_STAGE_ID]: async () => {
      const result = await submitStageTask(SPATIAL_GAS_LEDGER_PRODUCER_STAGE_ID, createSphSpatialGasLedgerProducerStageComputeTask, {
        residentProductMass: stepOptions.residentProductMass || stepOptions.gasPressureSummary?.residentProductMass || null,
        reactionSummary: stepOptions.reactionSummary || null,
        reactionTable: stepOptions.reactionTable || null,
        productEventBuffer: stepOptions.productEventBuffer || null,
        productEventRows: stepOptions.productEventRows || null,
        productEventCompactRows: stepOptions.productEventCompactRows || null,
        productEventRowCount: stepOptions.productEventRowCount,
        productEventStrideFloats: stepOptions.productEventStrideFloats,
        boxDimsM: dims,
        laneId: laneStagePlanId,
        stateKey: laneStagePlanStateKey,
        domainKey: gpuResidentLaneDomainKey,
        preferWebGpu: stepOptions.preferWebGpu === true,
        readbackMode
      });
      return {
        value: result,
        retainedBufferRefs: retainedBufferRefsForMechanicsStageResult(SPATIAL_GAS_LEDGER_PRODUCER_STAGE_ID, result),
        summary: {
          computeTaskResultSchema: result?.computeTaskResultSchema || null,
          evidencePassed: result?.spatialGasLedgerProducerStageTaskEvidence?.passed === true,
          ...summarizeMechanicsStageLaneResult(SPATIAL_GAS_LEDGER_PRODUCER_STAGE_ID, result)
        }
      };
    },
    [GAS_CELL_EOS_PRODUCER_STAGE_ID]: async () => {
      const producedSpatialLedger = spatialGasLedgerFromProducerOrOptions(stageResults, stepOptions);
      const producerPressureSummary = pressureSummaryWithSpatialGasLedgerProducerResult(
        stepOptions.gasPressureSummary || stepOptions.pressureSummary || null,
        stageResults[SPATIAL_GAS_LEDGER_PRODUCER_STAGE_ID] || null
      );
      const result = await submitStageTask(GAS_CELL_EOS_PRODUCER_STAGE_ID, createSphGasCellEosProducerStageComputeTask, {
        gasPressureSummary: producerPressureSummary || stepOptions.gasPressureSummary || null,
        pressureSummary: producerPressureSummary || stepOptions.pressureSummary || stepOptions.gasPressureSummary || null,
        spatialGasSpeciesLedger: producedSpatialLedger,
        boxDimsM: dims,
        laneId: laneStagePlanId,
        stateKey: laneStagePlanStateKey,
        domainKey: gpuResidentLaneDomainKey,
        preferWebGpu: stepOptions.preferWebGpu === true,
        readbackMode
      });
      return {
        value: result,
        retainedBufferRefs: retainedBufferRefsForMechanicsStageResult(GAS_CELL_EOS_PRODUCER_STAGE_ID, result),
        summary: {
          computeTaskResultSchema: result?.computeTaskResultSchema || null,
          evidencePassed: result?.gasCellEosProducerStageTaskEvidence?.passed === true,
          ...summarizeMechanicsStageLaneResult(GAS_CELL_EOS_PRODUCER_STAGE_ID, result)
        }
      };
    },
    [PRESSURE_INTERFACE_STAGE_ID]: async () => {
      const pressureInputs = pressureInterfaceInputsFromGasCellEosProducer();
      const result = await submitStageTask(PRESSURE_INTERFACE_STAGE_ID, createSphPressureInterfaceStageComputeTask, {
        pressureFeedback: pressureInputs.pressureFeedback,
        pressureSummary: stepOptions.pressureSummary || null,
        gasPressureSummary: pressureInputs.gasPressureSummary,
        materialInterfaceField: stepOptions.materialInterfaceField || null,
        algorithmMaterialContactRows: stepOptions.algorithmMaterialContactRows
          || mlsMpmParticleState?.algorithmMaterialContactRows
          || null,
        algorithmContactPairResponseScale: stepOptions.algorithmContactPairResponseScale,
        algorithmContactMaxPressurePa: stepOptions.algorithmContactMaxPressurePa,
        pressureInterfaceCoupling: stepOptions.pressureInterfaceCoupling || null,
        pressureInterfaceForcePreview: stepOptions.pressureInterfaceForcePreview || null,
        pressureInterfaceGasCellFieldImport: pressureInputs.pressureInterfaceGasCellFieldImport,
        pressureInterfaceGasCellFieldAdmission: pressureInputs.pressureInterfaceGasCellFieldAdmission,
        sphParticleState,
        sphParticleUpload: stepOptions.sphParticleUpload || null,
        particleStateBuffer: stepOptions.sphParticleUpload?.stateBuffer || null,
        particleThermoBuffer: stepOptions.sphParticleUpload?.thermoBuffer || null,
        particleCount: sphParticleState?.particleCount ?? stepOptions.sphParticleUpload?.particleCount ?? null,
        boxDimsM: dims,
        laneId: laneStagePlanId,
        stateKey: laneStagePlanStateKey,
        domainKey: gpuResidentLaneDomainKey,
        preferWebGpu: stepOptions.preferWebGpu === true,
        readbackMode
      });
      return {
        value: result,
        retainedBufferRefs: retainedBufferRefsForMechanicsStageResult(PRESSURE_INTERFACE_STAGE_ID, result),
        summary: {
          computeTaskResultSchema: result?.computeTaskResultSchema || null,
          evidencePassed: result?.pressureInterfaceStageTaskEvidence?.passed === true,
          ...summarizeMechanicsStageLaneResult(PRESSURE_INTERFACE_STAGE_ID, result)
        }
      };
    },
    gridUpdate: async ({ input } = {}) => {
      const sameFramePressure = includePressureInterfaceStage && input?.pressureInterfaceStageTask === true
        ? await publishSameFramePressureInterfaceForGridUpdate(input)
        : {
            pressureInterfaceForceSolver: stepOptions.pressureInterfaceForceSolver || null,
            pressureInterfaceGridForceAdmission: stepOptions.pressureInterfaceGridForceAdmission || null,
            pressureInterfaceForceRowsBuffer: stepOptions.pressureInterfaceForceRowsBuffer || null
          };
      const result = await submitStageTask('gridUpdate', createMlsMpmMechanicsGridUpdateStageComputeTask, {
        p2gGridProjection: stageResults.p2g,
        dt: dtSeconds,
        gravityMPerS2: gravity,
        boxDimsM: dims,
        cflFactor,
        pressureInterfaceForceRowsBuffer: sameFramePressure.pressureInterfaceForceRowsBuffer || stepOptions.pressureInterfaceForceRowsBuffer || null,
        pressureInterfaceForceSolver: sameFramePressure.pressureInterfaceForceSolver,
        pressureInterfaceGridForceAdmission: sameFramePressure.pressureInterfaceGridForceAdmission,
        laneId: laneStagePlanId,
        stateKey: laneStagePlanStateKey,
        domainKey: gpuResidentLaneDomainKey,
        preferWebGpu: stepOptions.preferWebGpu === true,
        readbackMode
      });
      return {
        value: result,
        retainedBufferRefs: retainedBufferRefsForMechanicsStageResult('gridUpdate', result),
        summary: {
          computeTaskResultSchema: result?.computeTaskResultSchema || null,
          evidencePassed: result?.mechanicsGridUpdateStageTaskEvidence?.passed === true,
          ...summarizeMechanicsStageLaneResult('gridUpdate', result)
        }
      };
    },
    g2p: async () => {
      const result = await submitStageTask('g2p', createMlsMpmMechanicsG2pStageComputeTask, {
        sphParticleState,
        mlsMpmParticleState,
        gridUpdate: stageResults.gridUpdate,
        dt: dtSeconds,
        boxDimsM: dims,
        laneId: laneStagePlanId,
        stateKey: laneStagePlanStateKey,
        domainKey: gpuResidentLaneDomainKey,
        preferWebGpu: stepOptions.preferWebGpu === true,
        readbackMode
      });
      return {
        value: result,
        retainedBufferRefs: retainedBufferRefsForMechanicsStageResult('g2p', result),
        summary: {
          computeTaskResultSchema: result?.computeTaskResultSchema || null,
          evidencePassed: result?.mechanicsG2pStageTaskEvidence?.passed === true,
          ...summarizeMechanicsStageLaneResult('g2p', result)
        }
      };
    },
    [THERMAL_PHASE_STAGE_ID]: async () => {
      const result = await submitStageTask(THERMAL_PHASE_STAGE_ID, createSphThermalPhaseStageComputeTask, {
        sphParticleState,
        mlsMpmParticleState,
        thermalMaterialTable: stepOptions.thermalMaterialTable || null,
        thermalClosureGraphSet: stepOptions.thermalClosureGraphSet || null,
        thermalClosureGraphBank: stepOptions.thermalClosureGraphBank || null,
        thermalPhaseResponseTable: stepOptions.thermalPhaseResponseTable || null,
        wallTemperaturesK: stepOptions.wallTemperaturesK || {},
        boxDimsM: dims,
        dtS: stepOptions.dtS ?? dtSeconds,
        laneId: laneStagePlanId,
        stateKey: laneStagePlanStateKey,
        domainKey: gpuResidentLaneDomainKey,
        preferWebGpu: stepOptions.preferWebGpu === true,
        readbackMode
      });
      return {
        value: result,
        retainedBufferRefs: retainedBufferRefsForMechanicsStageResult(THERMAL_PHASE_STAGE_ID, result),
        summary: {
          computeTaskResultSchema: result?.computeTaskResultSchema || null,
          evidencePassed: result?.thermalPhaseStageTaskEvidence?.passed === true,
          ...summarizeMechanicsStageLaneResult(THERMAL_PHASE_STAGE_ID, result)
        }
      };
    },
    [REACTION_PRODUCT_STAGE_ID]: async () => {
      const g2pOutput = retainedG2pOutputBuffers(stageResults.g2p);
      const thermalOutput = retainedThermalOutputBuffers(stageResults[THERMAL_PHASE_STAGE_ID]);
      const sourceStateBuffer = thermalOutput.stateBuffer || g2pOutput.stateBuffer || null;
      const sourceThermoBuffer = thermalOutput.thermoBuffer || stepOptions.sphParticleUpload?.thermoBuffer || null;
      const result = await submitStageTask(REACTION_PRODUCT_STAGE_ID, createSphReactionProductStageComputeTask, {
        sphParticleState,
        mlsMpmParticleState,
        reactionTable: stepOptions.reactionTable || null,
        thermalMaterialTable: stepOptions.thermalMaterialTable || null,
        thermalClosureGraphSet: stepOptions.thermalClosureGraphSet || null,
        thermalClosureGraphBank: stepOptions.thermalClosureGraphBank || null,
        thermalPhaseResponseTable: stepOptions.thermalPhaseResponseTable || null,
        sphParticleUpload: sourceStateBuffer || sourceThermoBuffer
          ? {
            ...(stepOptions.sphParticleUpload || {}),
            schema: stepOptions.sphParticleUpload?.schema || 'peercompute.ulg.reaction-product-stage-sph-particle-upload.v0',
            status: 'webgpu-uploaded',
            sourceStage: thermalOutput.stateBuffer ? THERMAL_PHASE_STAGE_ID : 'g2p',
            stateBuffer: sourceStateBuffer,
            thermoBuffer: sourceThermoBuffer
          }
          : stepOptions.sphParticleUpload,
        mlsMpmParticleUpload: g2pOutput.mechanicsBuffer
          ? {
            ...(stepOptions.mlsMpmParticleUpload || {}),
            schema: stepOptions.mlsMpmParticleUpload?.schema || 'peercompute.ulg.reaction-product-stage-mls-mpm-particle-upload.v0',
            status: 'webgpu-uploaded',
            sourceStage: 'g2p',
            mechanicsBuffer: g2pOutput.mechanicsBuffer
          }
          : stepOptions.mlsMpmParticleUpload,
        sourceStateBuffer,
        sourceThermoBuffer,
        sourceMechanicsBuffer: g2pOutput.mechanicsBuffer || null,
        resetMechanics: stepOptions.reactionStepOptions?.resetMechanics ?? true,
        laneId: laneStagePlanId,
        stateKey: laneStagePlanStateKey,
        domainKey: gpuResidentLaneDomainKey,
        preferWebGpu: stepOptions.preferWebGpu === true,
        readbackMode
      });
      return {
        value: result,
        retainedBufferRefs: retainedBufferRefsForMechanicsStageResult(REACTION_PRODUCT_STAGE_ID, result),
        summary: {
          computeTaskResultSchema: result?.computeTaskResultSchema || null,
          evidencePassed: result?.reactionProductStageTaskEvidence?.passed === true,
          ...summarizeMechanicsStageLaneResult(REACTION_PRODUCT_STAGE_ID, result)
        }
      };
    }
  };
  const gpuHubForStageExecutors = resolveMechanicsStageGpuHub(computeManager);
  const canUseGpuHubResidentStageExecutors = useGpuHubResidentStageExecutors !== false
    && !nativeTaskGraph
    && gpuHubForStageExecutors
    && typeof gpuHubForStageExecutors.registerResidentStageExecutor === 'function'
    && typeof gpuHubForStageExecutors.hasResidentStageExecutor === 'function'
    && typeof gpuHubForStageExecutors.executeResidentStage === 'function';
  if (canUseGpuHubResidentStageExecutors) {
    const attachRetainedRefsToWorkerStageValue = (result) => {
      const object = result && typeof result === 'object' ? result : { value: result };
      const hasValue = Object.prototype.hasOwnProperty.call(object, 'value');
      const value = hasValue ? object.value : result;
      if (!value || typeof value !== 'object') return result;
      const retainedBufferRefs = uniqueNonEmptyStrings([
        ...(object.retainedBufferRefs || []),
        ...(object.gpuFence?.retainedBufferRefs || []),
        ...(value.retainedBufferRefs || []),
        ...(value.workerResidentStage?.retainedBufferRefs || []),
        ...(value.workerResidentStage?.workerRetainedBufferRefs || [])
      ]);
      if (retainedBufferRefs.length === 0) return result;
      const nextValue = {
        ...value,
        retainedBufferRefs,
        workerResidentStage: value.workerResidentStage && typeof value.workerResidentStage === 'object'
          ? {
              ...value.workerResidentStage,
              retainedBufferRefs: uniqueNonEmptyStrings([
                ...(value.workerResidentStage.retainedBufferRefs || []),
                ...retainedBufferRefs
              ])
            }
          : value.workerResidentStage
      };
      return hasValue
        ? { ...object, value: nextValue, retainedBufferRefs }
        : { value: nextValue, retainedBufferRefs };
    };
    const workerArgsWithGasCellEosProducerPressureInput = (stage, args = {}) => {
      if (stage?.id !== PRESSURE_INTERFACE_STAGE_ID) return args;
      const pressureInputs = pressureInterfaceInputsFromGasCellEosProducer();
      if (!pressureInputs.gasCellEosProducerResult) return args;
      const context = args?.context || {};
      const workerContext = context.ulgMechanicsResidentStageWorker || {};
      const common = workerContext.common || {};
      const stageOptions = workerContext.stageOptions || {};
      return {
        ...args,
        context: {
          ...context,
          ulgMechanicsResidentStageWorker: {
            ...workerContext,
            common: {
              ...common,
              gasPressureSummary: pressureInputs.gasPressureSummary,
              pressureFeedback: pressureInputs.pressureFeedback,
              pressureInterfaceGasCellFieldImport: pressureInputs.pressureInterfaceGasCellFieldImport,
              pressureInterfaceGasCellFieldAdmission: pressureInputs.pressureInterfaceGasCellFieldAdmission
            },
            stageOptions: {
              ...stageOptions,
              [PRESSURE_INTERFACE_STAGE_ID]: {
                ...(stageOptions[PRESSURE_INTERFACE_STAGE_ID] || {}),
                gasPressureSummary: pressureInputs.gasPressureSummary,
                pressureFeedback: pressureInputs.pressureFeedback,
                pressureInterfaceGasCellFieldImport: pressureInputs.pressureInterfaceGasCellFieldImport,
                pressureInterfaceGasCellFieldAdmission: pressureInputs.pressureInterfaceGasCellFieldAdmission,
                gasCellEosProducerImportPublication: pressureInputs.gasCellEosProducerImportPublication
              }
            }
          }
        }
      };
    };
    gpuHubResidentStageExecutorRegistrations = laneStagePlanContract.passDagStages
      .map((stage) => {
        const stageWorkerRunner = resolveMechanicsStageWorkerRunner(gpuHubResidentStageWorkerRunner, stage.id);
        const shouldWrapGridUpdateWorkerForSameFramePressure = stage.id === 'gridUpdate'
          && includePressureInterfaceStage
          && stepOptions.approveSameFramePressureInterfaceGridForces === true
          && typeof gpuHubResidentPressureInterfaceStageWorkerOutputPublisher === 'function'
          && Boolean(stageWorkerRunner);
        const wrappedWorkerRunner = stageWorkerRunner
          ? async (args) => {
              const workerArgs = workerArgsWithGasCellEosProducerPressureInput(stage, args);
              const result = attachRetainedRefsToWorkerStageValue(await executeMechanicsStageWorkerRunner(stageWorkerRunner, {
                ...workerArgs,
                stageId: stage.id,
                taskIdPrefix,
                stageResults
              }));
              const resultObject = result && typeof result === 'object' ? result : { value: result };
              stageResults[stage.id] = Object.prototype.hasOwnProperty.call(resultObject, 'value')
                ? resultObject.value
                : result;
              return result;
            }
          : null;
        const sameFrameGridUpdateExecutor = shouldWrapGridUpdateWorkerForSameFramePressure
          ? async (args) => {
              const sameFramePressure = args?.input?.pressureInterfaceStageTask === true
                ? await publishSameFramePressureInterfaceForGridUpdate(args.input)
                : {
                    pressureInterfaceForceSolver: stepOptions.pressureInterfaceForceSolver || null,
                    pressureInterfaceGridForceAdmission: stepOptions.pressureInterfaceGridForceAdmission || null,
                    pressureInterfaceForceRowsBuffer: stepOptions.pressureInterfaceForceRowsBuffer || null
                  };
              const workerContext = args?.context?.ulgMechanicsResidentStageWorker || {};
              const nextContext = {
                ...(args?.context || {}),
                ulgMechanicsResidentStageWorker: {
                  ...workerContext,
                  stageOptions: {
                    ...(workerContext.stageOptions || {}),
                    gridUpdate: {
                      ...(workerContext.stageOptions?.gridUpdate || {}),
                      pressureInterfaceForceSolver: sameFramePressure.pressureInterfaceForceSolver,
                      pressureInterfaceGridForceAdmission: sameFramePressure.pressureInterfaceGridForceAdmission,
                      pressureInterfaceForceRowsBuffer: sameFramePressure.pressureInterfaceForceRowsBuffer || null
                    }
                  }
                }
              };
              const result = attachRetainedRefsToWorkerStageValue(await executeMechanicsStageWorkerRunner(stageWorkerRunner, {
                ...args,
                context: nextContext,
                stageId: stage.id,
                taskIdPrefix,
                stageResults
              }));
              const resultObject = result && typeof result === 'object' ? result : { value: result };
              stageResults[stage.id] = Object.prototype.hasOwnProperty.call(resultObject, 'value')
                ? resultObject.value
                : result;
              return result;
            }
          : null;
        const requestedWorkerPolicy = requestGpuHubWorkerResidency !== false
          ? {
            mode: 'dedicated-worker',
            workerType: stepOptions.preferWebGpu === true
              ? 'webgpu-compute-worker'
              : 'cpu-compute-worker',
            workerModuleUrl: gpuHubResidentStageWorkerModuleUrl,
            startupMode: 'warm-on-first-use',
            idleTtlMs: 60000,
            sameDeviceRequired: stepOptions.preferWebGpu === true,
            bufferTransferPolicy: stepOptions.preferWebGpu === true
              ? 'worker-owns-device-and-retained-buffers-required'
              : 'worker-local-cpu-state-required',
            workerReady: Boolean(wrappedWorkerRunner || sameFrameGridUpdateExecutor),
            ...(gpuHubResidentStageWorkerPolicy || {})
          }
          : {
            mode: 'inline'
          };
        return gpuHubForStageExecutors.registerResidentStageExecutor({
          stageId: stage.id,
          lawNodeId: stage.lawNodeId,
          runtimeTarget: stepOptions.preferWebGpu === true
            ? 'webgpu-compute-manager-stage-task'
            : 'cpu-compute-manager-stage-task',
          workerPolicy: requestedWorkerPolicy,
          metadata: {
            source: 'ulg-mechanics-stage-task-chain',
            taskIdPrefix,
            laneId: laneStagePlanId,
            stateKey: laneStagePlanStateKey,
            defaultEnabled: false,
            workerRunnerSupplied: Boolean(wrappedWorkerRunner || sameFrameGridUpdateExecutor)
          },
          ...(wrappedWorkerRunner && !sameFrameGridUpdateExecutor ? { workerRunner: wrappedWorkerRunner } : {}),
          executor: sameFrameGridUpdateExecutor || laneStageExecutors[stage.id]
        });
      })
      .filter(Boolean);
    gpuHubResidentStageExecutorMode = gpuHubResidentStageExecutorRegistrations.length === laneStagePlanContract.passDagStages.length
      ? 'registered'
      : 'partial-registration';
  } else if (useGpuHubResidentStageExecutors === false) {
    gpuHubResidentStageExecutorMode = 'disabled';
  } else if (nativeTaskGraph) {
    gpuHubResidentStageExecutorMode = 'skipped-native-task-graph';
  } else {
    gpuHubResidentStageExecutorMode = 'unavailable';
  }
  const useRegisteredGpuHubStageExecutors = gpuHubResidentStageExecutorMode === 'registered';
  const canExecuteStageTasksThroughLanePlan = useGpuResidentLaneStagePlan !== false
    && !gpuResidentLaneStagePlanExecution
    && typeof computeManager.acquireGpuResidentLaneLease === 'function'
    && typeof computeManager.executeGpuResidentLaneStagePlan === 'function'
    && typeof computeManager.completeGpuResidentLaneLease === 'function';
  if (canExecuteStageTasksThroughLanePlan) {
    try {
      gpuResidentLaneStagePlanLease = computeManager.acquireGpuResidentLaneLease({
        laneId: laneStagePlanId,
        stateKey: laneStagePlanStateKey,
        domainKey: gpuResidentLaneDomainKey,
        solverId: 'ulg-mls-mpm-mechanics-stage-plan',
        taskId: `${taskIdPrefix}:mechanics-stage-plan`,
        owner: 'ulg-mls-mpm-mechanics-law',
        readFamilies: laneStagePlanContract.readFamilies,
        writeFamilies: laneStagePlanContract.writeFamilies,
        retainedBufferRefs: laneStagePlanContract.laneMustRetainBuffers,
        queueFencePolicy: 'queue.onSubmittedWorkDone-before-admission',
        residentSequenceLaneContract: laneStagePlanContract,
        copyBudget: {
          schema: 'peercompute.compute.gpu-resident-lane-copy-budget.v0',
          uploadBytes: 0,
          readbackBytes: 0,
          retainedBytes: 0,
          compactSummaryBytes: 0,
          fullReadbackReason: null
        }
      });
      const mechanicsResidentStageWorkerContext = gpuHubResidentStageWorkerRunner
        ? {
            schema: 'peercompute.ulg.mechanics-resident-stage-worker-context.v0',
            taskIdPrefix,
            preferWebGpu: stepOptions.preferWebGpu === true,
            readbackMode,
            useWorkerRetainedG2pInput,
            workerRetainedContinuationPlan,
            common: {
              sphParticleState,
              mlsMpmParticleState,
              gridSpacingM: stepOptions.gridSpacingM ?? sphParticleState?.smoothingLengthM,
              boxDimsM: dims,
              dt: dtSeconds,
              gravityMPerS2: gravity,
              cflFactor,
              laneId: laneStagePlanId,
              stateKey: laneStagePlanStateKey,
              domainKey: gpuResidentLaneDomainKey,
              ...(includeSpatialGasLedgerProducerStage ? {
                residentProductMass: stepOptions.residentProductMass || stepOptions.gasPressureSummary?.residentProductMass || null,
                reactionSummary: stepOptions.reactionSummary || null,
                reactionTable: stepOptions.reactionTable || null,
                productEventBuffer: stepOptions.productEventBuffer || null,
                productEventRows: stepOptions.productEventRows || null,
                productEventCompactRows: stepOptions.productEventCompactRows || null,
                productEventRowCount: stepOptions.productEventRowCount,
                productEventStrideFloats: stepOptions.productEventStrideFloats
              } : {}),
              ...(includeGasCellEosProducerStage ? {
                gasPressureSummary: stepOptions.gasPressureSummary || null,
                pressureSummary: stepOptions.pressureSummary || stepOptions.gasPressureSummary || null,
                spatialGasSpeciesLedger: spatialGasLedgerFromProducerOrOptions(stageResults, stepOptions)
              } : {}),
              ...(includePressureInterfaceStage ? {
                pressureFeedback: stepOptions.pressureFeedback || null,
                pressureSummary: stepOptions.pressureSummary || null,
                gasPressureSummary: stepOptions.gasPressureSummary || null,
                materialInterfaceField: stepOptions.materialInterfaceField || null,
                algorithmMaterialContactRows: stepOptions.algorithmMaterialContactRows
                  || mlsMpmParticleState?.algorithmMaterialContactRows
                  || null,
                algorithmContactPairResponseScale: stepOptions.algorithmContactPairResponseScale,
                algorithmContactMaxPressurePa: stepOptions.algorithmContactMaxPressurePa,
                pressureInterfaceCoupling: stepOptions.pressureInterfaceCoupling || null,
                pressureInterfaceForcePreview: stepOptions.pressureInterfaceForcePreview || null,
                pressureInterfaceGasCellFieldImport: stepOptions.pressureInterfaceGasCellFieldImport || null,
                pressureInterfaceGasCellFieldAdmission: stepOptions.pressureInterfaceGasCellFieldAdmission || null,
                contactKinematicsParticleBinMetadataReadback:
                  stepOptions.contactKinematicsParticleBinMetadataReadback === true
              } : {}),
              ...(includeThermalPhaseStage ? {
                thermalMaterialTable: stepOptions.thermalMaterialTable || null,
                thermalClosureGraphSet: stepOptions.thermalClosureGraphSet || null,
                thermalClosureGraphBank: stepOptions.thermalClosureGraphBank || null,
                thermalPhaseResponseTable: stepOptions.thermalPhaseResponseTable || null,
                wallTemperaturesK: stepOptions.wallTemperaturesK || {},
                dtS: stepOptions.dtS ?? dtSeconds
              } : {}),
              ...(includeReactionProductStage ? {
                reactionTable: stepOptions.reactionTable || null,
                reactionStepOptions: {
                  ...(stepOptions.reactionStepOptions || {}),
                  reactionParticleBinMetadataReadback:
                    stepOptions.reactionParticleBinMetadataReadback === true
                    || stepOptions.reactionStepOptions?.reactionParticleBinMetadataReadback === true
                }
              } : {})
            }
          }
        : null;
      const stagePlanExecutionOptions = {
        input: {
          source: nativeTaskGraph
            ? 'ulg-mechanics-stage-chain-native-task-graph-results'
            : 'ulg-mechanics-stage-chain-lane-executor-stage-tasks',
          taskIdPrefix
        },
        context: {
          nodeKernelOwned: nativeTaskGraph?.nodeKernelOwned === true,
          nativeTaskGraphSchema: nativeTaskGraph?.schema || null,
          nativeTaskGraphStatus: nativeTaskGraph?.status || null,
          stageTasksSubmittedByLaneExecutor: !nativeTaskGraph,
          gpuHubResidentStageExecutorMode,
          gpuHubResidentStageExecutorStageIds: gpuHubResidentStageExecutorRegistrations.map((entry) => entry.stageId),
          ...(mechanicsResidentStageWorkerContext
            ? { ulgMechanicsResidentStageWorker: mechanicsResidentStageWorkerContext }
            : {})
        }
      };
      if (!useRegisteredGpuHubStageExecutors) {
        stagePlanExecutionOptions.stageExecutors = laneStageExecutors;
      }
      preflightGpuResidentLaneStagePlacement(gpuResidentLaneStagePlanLease.leaseId, stagePlanExecutionOptions);
      gpuResidentLaneStagePlanExecution = await executeGpuResidentLaneStagePlan(
        gpuResidentLaneStagePlanLease.leaseId,
        stagePlanExecutionOptions
      );
      gpuResidentLaneStagePlanLeaseExecution = completeGpuResidentLaneStagePlanLease(
        nativeTaskGraph
          ? 'ulg-mechanics-stage-plan-executor'
          : 'ulg-mechanics-stage-plan-executor-stage-tasks'
      );
    } catch (error) {
      if (gpuResidentLaneStagePlanLease?.leaseId && typeof computeManager.rejectGpuResidentLaneLease === 'function') {
        try {
          gpuResidentLaneStagePlanRejected = computeManager.rejectGpuResidentLaneLease(
            gpuResidentLaneStagePlanLease.leaseId,
            'mechanics-stage-plan-executor-error'
          );
        } catch {
          // Keep the original stage-plan error as the diagnostic source.
        }
      }
      gpuResidentLaneStagePlanExecution = {
        schema: 'peercompute.compute.gpu-resident-lane-stage-execution.v0',
        status: 'failed',
        reason: error instanceof Error ? error.message : String(error)
      };
    }
  }
  const step = await runMlsMpmMechanicsOnlyResidentStepWithOptionalWebGpu({
    ...stepOptions,
    sameDeviceRetainedBufferImport: normalizedSameDeviceRetainedBufferImport,
    p2gStageRunner: (stageOptions) => submitStageTask(
      'p2g',
      createMlsMpmMechanicsP2gStageComputeTask,
      stageOptions
    ),
    gridUpdateStageRunner: (stageOptions) => submitStageTask(
      'gridUpdate',
      createMlsMpmMechanicsGridUpdateStageComputeTask,
      stageOptions
    ),
    g2pStageRunner: (stageOptions) => submitStageTask(
      'g2p',
      createMlsMpmMechanicsG2pStageComputeTask,
      stageOptions
    )
  });
  const stageTaskBoundaries = { ...(step.mechanicsOnlySplitPath?.stageTaskBoundaries || {}) };
  const evidence = step.mechanicsOnlySplitPath?.stageTaskEvidence || {};
  const stageEvidenceByStage = {
    p2g: evidence.p2g || null,
    gridUpdate: evidence.gridUpdate || null,
    g2p: evidence.g2p || null,
    ...(includeSpatialGasLedgerProducerStage ? {
      [SPATIAL_GAS_LEDGER_PRODUCER_STAGE_ID]:
        stageResults[SPATIAL_GAS_LEDGER_PRODUCER_STAGE_ID]?.spatialGasLedgerProducerStageTaskEvidence || null
    } : {}),
    ...(includeGasCellEosProducerStage ? {
      [GAS_CELL_EOS_PRODUCER_STAGE_ID]: stageResults[GAS_CELL_EOS_PRODUCER_STAGE_ID]?.gasCellEosProducerStageTaskEvidence || null
    } : {}),
    ...(includePressureInterfaceStage ? {
      [PRESSURE_INTERFACE_STAGE_ID]: stageResults[PRESSURE_INTERFACE_STAGE_ID]?.pressureInterfaceStageTaskEvidence || null
    } : {}),
    ...(includeThermalPhaseStage ? {
      [THERMAL_PHASE_STAGE_ID]: stageResults[THERMAL_PHASE_STAGE_ID]?.thermalPhaseStageTaskEvidence || null
    } : {}),
    ...(includeReactionProductStage ? {
      [REACTION_PRODUCT_STAGE_ID]: stageResults[REACTION_PRODUCT_STAGE_ID]?.reactionProductStageTaskEvidence || null
    } : {})
  };
  if (
    includeSpatialGasLedgerProducerStage
    && stageResults[SPATIAL_GAS_LEDGER_PRODUCER_STAGE_ID]?.spatialGasLedgerProducerStageTask === true
  ) {
    stageTaskBoundaries[SPATIAL_GAS_LEDGER_PRODUCER_STAGE_ID] = true;
  }
  if (includeGasCellEosProducerStage && stageResults[GAS_CELL_EOS_PRODUCER_STAGE_ID]?.gasCellEosProducerStageTask === true) {
    stageTaskBoundaries[GAS_CELL_EOS_PRODUCER_STAGE_ID] = true;
  }
  if (includeThermalPhaseStage && stageResults[THERMAL_PHASE_STAGE_ID]?.thermalPhaseStageTask === true) {
    stageTaskBoundaries[THERMAL_PHASE_STAGE_ID] = true;
  }
  if (includePressureInterfaceStage && stageResults[PRESSURE_INTERFACE_STAGE_ID]?.pressureInterfaceStageTask === true) {
    stageTaskBoundaries[PRESSURE_INTERFACE_STAGE_ID] = true;
  }
  if (includeReactionProductStage && stageResults[REACTION_PRODUCT_STAGE_ID]?.reactionProductStageTask === true) {
    stageTaskBoundaries[REACTION_PRODUCT_STAGE_ID] = true;
  }
  const stageLaneSummaries = Object.fromEntries(
    stageOrder.map((stageId) => [
      stageId,
      summarizeMechanicsStageLaneResult(stageId, stageResults[stageId])
    ])
  );
  const stageTaskLaneIds = Object.fromEntries(
    Object.entries(stageLaneSummaries).map(([stageId, summary]) => [stageId, summary.laneId])
  );
  const stageTaskStateKeys = Object.fromEntries(
    Object.entries(stageLaneSummaries).map(([stageId, summary]) => [stageId, summary.stateKey])
  );
  const stageTaskBackends = Object.fromEntries(
    Object.entries(stageLaneSummaries).map(([stageId, summary]) => [stageId, summary.backend])
  );
  const stageTaskResidencies = Object.fromEntries(
    Object.entries(stageLaneSummaries).map(([stageId, summary]) => [stageId, summary.residency])
  );
  const stageTaskFenceSatisfied = Object.fromEntries(
    Object.entries(stageLaneSummaries).map(([stageId, summary]) => [stageId, summary.fenceSatisfied])
  );
  const stageTaskReadbackModes = Object.fromEntries(
    Object.entries(stageLaneSummaries).map(([stageId, summary]) => [stageId, summary.readbackMode])
  );
  const stageTaskNormalHotLoopReadbackFree = Object.fromEntries(
    Object.entries(stageLaneSummaries).map(([stageId, summary]) => [stageId, summary.normalHotLoopReadbackFree])
  );
  const stageTaskExecutionStatuses = Object.fromEntries(
    Object.entries(stageLaneSummaries).map(([stageId, summary]) => [stageId, summary.executionStatus])
  );
  const stageTaskEvidencePassed = Object.fromEntries(
    stageOrder.map((stageId) => [stageId, stageEvidenceByStage[stageId]?.passed === true])
  );
  const stageExecutionExecutorSources = Object.fromEntries(
    (gpuResidentLaneStagePlanExecution?.stageResults || [])
      .map((entry) => [entry.stageId, entry.executorSource || null])
  );
  const stageExecutionWorkerResidency = Object.fromEntries(
    (gpuResidentLaneStagePlanExecution?.stageResults || [])
      .map((entry) => [entry.stageId, entry.workerResidency || null])
  );
  const stageExecutionWorkerResidencyStatuses = Object.fromEntries(
    Object.entries(stageExecutionWorkerResidency)
      .map(([stageId, workerResidency]) => [stageId, workerResidency?.status || null])
  );
  const laneTaskSummaries = Object.values(stageLaneSummaries).filter((summary) => summary.laneId || summary.stateKey);
  const allStageTaskLaneIdsMatchPlan = laneTaskSummaries.length > 0
    ? laneTaskSummaries.every((summary) => summary.laneId === laneStagePlanId && summary.stateKey === laneStagePlanStateKey)
    : null;
  const workerCompactPublicationCandidate = buildMechanicsWorkerCompactPublicationCandidate({
    stageExecution: gpuResidentLaneStagePlanExecution,
    stageLaneSummaries,
    stageWorkerResidencyStatuses: stageExecutionWorkerResidencyStatuses,
    workerRunnerSupplied: Boolean(gpuHubResidentStageWorkerRunner),
    workerModuleUrl: gpuHubResidentStageWorkerModuleUrl || null,
    sameDeviceRetainedBufferImport: normalizedSameDeviceRetainedBufferImport,
    laneId: laneStagePlanId,
    stateKey: laneStagePlanStateKey
  });
  let workerCompactPublication = null;
  if (
    workerCompactPublicationCandidate?.candidateStatus === 'worker-retained-compact-publication-candidate-ready'
    && typeof gpuHubResidentStageWorkerOutputPublisher === 'function'
  ) {
    try {
      workerCompactPublication = await gpuHubResidentStageWorkerOutputPublisher({
        candidate: workerCompactPublicationCandidate,
        workerRunner: gpuHubResidentStageWorkerRunner,
        workerModuleUrl: gpuHubResidentStageWorkerModuleUrl || null,
        laneId: laneStagePlanId,
        stateKey: laneStagePlanStateKey,
        sourceTaskId: `${taskIdPrefix}:mechanics-stage-plan`,
        sourceNodeId: 'ulg-mls-mpm-mechanics-law',
        sourceStage: 'g2p',
        sameDeviceRetainedBufferImport: normalizedSameDeviceRetainedBufferImport,
        stageExecution: gpuResidentLaneStagePlanExecution
      });
    } catch (error) {
      workerCompactPublication = {
        schema: 'peercompute.ulg.mechanics-worker-retained-hot-buffer-publication.v0',
        status: 'worker-retained-mechanics-output-publication-failed',
        reason: error instanceof Error ? error.message : String(error)
      };
    }
  }
  const pressureInterfaceWorkerCompactPublicationCandidate = includePressureInterfaceStage
    ? (pressureInterfaceSameFrameWorkerCompactPublicationCandidate || buildPressureInterfaceWorkerCompactPublicationCandidate({
        stageExecution: gpuResidentLaneStagePlanExecution,
        stageLaneSummaries,
        stageWorkerResidencyStatuses: stageExecutionWorkerResidencyStatuses,
        workerRunnerSupplied: Boolean(gpuHubResidentStageWorkerRunner),
        workerModuleUrl: gpuHubResidentStageWorkerModuleUrl || null,
        laneId: laneStagePlanId,
        stateKey: laneStagePlanStateKey
      }))
    : null;
  let pressureInterfaceWorkerCompactPublication = pressureInterfaceSameFrameWorkerCompactPublication;
  if (
    !pressureInterfaceWorkerCompactPublication
    &&
    pressureInterfaceWorkerCompactPublicationCandidate?.candidateStatus === 'worker-retained-pressure-interface-publication-candidate-ready'
    && typeof gpuHubResidentPressureInterfaceStageWorkerOutputPublisher === 'function'
  ) {
    try {
      pressureInterfaceWorkerCompactPublication = await gpuHubResidentPressureInterfaceStageWorkerOutputPublisher({
        candidate: pressureInterfaceWorkerCompactPublicationCandidate,
        workerRunner: gpuHubResidentStageWorkerRunner,
        workerModuleUrl: gpuHubResidentStageWorkerModuleUrl || null,
        laneId: laneStagePlanId,
        stateKey: laneStagePlanStateKey,
        sourceTaskId: `${taskIdPrefix}:mechanics-stage-plan`,
        sourceNodeId: 'ulg-pressure-interface-force-law',
        sourceStage: PRESSURE_INTERFACE_STAGE_ID,
        stageExecution: gpuResidentLaneStagePlanExecution
      });
    } catch (error) {
      pressureInterfaceWorkerCompactPublication = {
        schema: 'peercompute.ulg.pressure-interface-worker-retained-hot-buffer-publication.v0',
        status: 'worker-retained-pressure-interface-output-publication-failed',
        reason: error instanceof Error ? error.message : String(error)
      };
    }
  }
  const thermalWorkerCompactPublicationCandidate = includeThermalPhaseStage
    ? buildThermalPhaseWorkerCompactPublicationCandidate({
        stageExecution: gpuResidentLaneStagePlanExecution,
        stageLaneSummaries,
        stageWorkerResidencyStatuses: stageExecutionWorkerResidencyStatuses,
        workerRunnerSupplied: Boolean(gpuHubResidentStageWorkerRunner),
        workerModuleUrl: gpuHubResidentStageWorkerModuleUrl || null,
        laneId: laneStagePlanId,
        stateKey: laneStagePlanStateKey
      })
    : null;
  let thermalWorkerCompactPublication = null;
  if (
    thermalWorkerCompactPublicationCandidate?.candidateStatus === 'worker-retained-thermal-phase-publication-candidate-ready'
    && typeof gpuHubResidentThermalStageWorkerOutputPublisher === 'function'
  ) {
    try {
      thermalWorkerCompactPublication = await gpuHubResidentThermalStageWorkerOutputPublisher({
        candidate: thermalWorkerCompactPublicationCandidate,
        workerRunner: gpuHubResidentStageWorkerRunner,
        workerModuleUrl: gpuHubResidentStageWorkerModuleUrl || null,
        laneId: laneStagePlanId,
        stateKey: laneStagePlanStateKey,
        sourceTaskId: `${taskIdPrefix}:mechanics-stage-plan`,
        sourceNodeId: 'ulg-thermal-phase-law',
        sourceStage: THERMAL_PHASE_STAGE_ID,
        stageExecution: gpuResidentLaneStagePlanExecution
      });
    } catch (error) {
      thermalWorkerCompactPublication = {
        schema: 'peercompute.ulg.thermal-phase-worker-retained-hot-buffer-publication.v0',
        status: 'worker-retained-thermal-phase-output-publication-failed',
        reason: error instanceof Error ? error.message : String(error)
      };
    }
  }
  const reactionProductWorkerCompactPublicationCandidate = includeReactionProductStage
    ? buildReactionProductWorkerCompactPublicationCandidate({
        stageExecution: gpuResidentLaneStagePlanExecution,
        stageLaneSummaries,
        stageWorkerResidencyStatuses: stageExecutionWorkerResidencyStatuses,
        workerRunnerSupplied: Boolean(gpuHubResidentStageWorkerRunner),
        workerModuleUrl: gpuHubResidentStageWorkerModuleUrl || null,
        laneId: laneStagePlanId,
        stateKey: laneStagePlanStateKey
      })
    : null;
  let reactionProductWorkerCompactPublication = null;
  if (
    reactionProductWorkerCompactPublicationCandidate?.candidateStatus === 'worker-retained-reaction-product-publication-candidate-ready'
    && typeof gpuHubResidentReactionProductStageWorkerOutputPublisher === 'function'
  ) {
    try {
      reactionProductWorkerCompactPublication = await gpuHubResidentReactionProductStageWorkerOutputPublisher({
        candidate: reactionProductWorkerCompactPublicationCandidate,
        workerRunner: gpuHubResidentStageWorkerRunner,
        workerModuleUrl: gpuHubResidentStageWorkerModuleUrl || null,
        laneId: laneStagePlanId,
        stateKey: laneStagePlanStateKey,
        sourceTaskId: `${taskIdPrefix}:mechanics-stage-plan`,
        sourceNodeId: 'ulg-reaction-product-gas-law',
        sourceStage: REACTION_PRODUCT_STAGE_ID,
        stageExecution: gpuResidentLaneStagePlanExecution
      });
    } catch (error) {
      reactionProductWorkerCompactPublication = {
        schema: 'peercompute.ulg.reaction-product-worker-retained-hot-buffer-publication.v0',
        status: 'worker-retained-reaction-product-output-publication-failed',
        reason: error instanceof Error ? error.message : String(error)
      };
    }
  }
  const stageTaskChain = {
    schema: ULG_MLS_MPM_MECHANICS_STAGE_TASK_CHAIN_SCHEMA,
    status: 'compute-manager-stage-task-chain-executed',
    source: 'runMlsMpmMechanicsOnlyResidentStepWithComputeManagerStageTasks',
    schedulerStatus: nativeTaskGraph
      ? 'peercompute-native-task-graph-used'
      : 'ulg-helper-stage-runners-used-awaiting-gpu-graph-semantics',
    taskIdPrefix,
    nativeTaskGraphSchema: nativeTaskGraph?.schema || null,
    nativeTaskGraphStatus: nativeTaskGraph?.status || null,
    nativeTaskGraphExecutionOrder: [...(nativeTaskGraph?.executionOrder || [])],
    nativeTaskGraphExecutionBatches: (nativeTaskGraph?.executionBatches || []).map((batch) => [...batch]),
    nativeTaskGraphCachePolicySchema: nativeTaskGraph?.cachePolicy?.schema || null,
    nativeTaskGraphCacheKey: nativeTaskGraph?.cachePolicy?.cacheKey || null,
    nativeTaskGraphCacheKeySource: nativeTaskGraph?.cachePolicy?.keySource || null,
    nativeTaskGraphCacheInputHash: nativeTaskGraph?.cachePolicy?.inputHash || null,
    nativeTaskGraphCacheInputsSchema: nativeTaskGraph?.cachePolicy?.inputs?.schema || null,
    nativeTaskGraphCacheAdmissionStatus: nativeTaskGraph?.cacheAdmissionStatus || null,
    nativeTaskGraphCacheArtifactSchema: nativeTaskGraph?.cacheArtifactSchema || null,
    nativeTaskGraphCacheArtifactStatus: nativeTaskGraph?.cacheArtifactStatus || null,
    nativeTaskGraphCacheArtifactAdmitted: nativeTaskGraph?.cacheArtifact?.admitted === true,
    nativeTaskGraphCacheArtifactResultHash: nativeTaskGraph?.cacheArtifact?.resultHash || null,
    nativeTaskGraphCacheStatus: nativeTaskGraph?.cacheStatus || null,
    nativeTaskGraphPlacementPolicySchema: nativeTaskGraph?.placementPolicy?.schema || null,
    nativeTaskGraphPlacementPolicy: nativeTaskGraph?.placementPolicy
      ? { ...nativeTaskGraph.placementPolicy }
      : null,
    nativeTaskGraphCancellationStatus: nativeTaskGraph?.cancellationStatus || null,
    nativeTaskGraphLeaseRequired: nativeTaskGraph?.graphLeaseRequired === true,
    nativeTaskGraphLeaseStatus: nativeTaskGraph?.graphLeaseStatus || null,
    nativeTaskGraphNodeKernelAuthoritySchema: nativeTaskGraph?.nodeKernelAuthority?.schema || null,
    nativeTaskGraphNodeKernelAuthorityStatus: nativeTaskGraph?.nodeKernelAuthority?.status || null,
    nativeTaskGraphNodeKernelId: nativeTaskGraph?.nodeKernelAuthority?.nodeId || null,
    nativeTaskGraphPlacementPreflightSchema: nativeTaskGraph?.nodeKernelAuthority?.placementPreflight?.schema || null,
    nativeTaskGraphPlacementPreflightStatus: nativeTaskGraph?.nodeKernelAuthority?.placementPreflight?.status || null,
    nativeTaskGraphAuthorityPath: nativeTaskGraph?.nodeKernelOwned === true
      ? 'node-kernel-submit-task-graph'
      : (nativeTaskGraph ? 'compute-manager-submit-task-graph' : 'stage-runner-submit-task'),
    gpuResidentLaneStagePlanLaneId: laneStagePlanId,
    gpuResidentLaneStagePlanStateKey: laneStagePlanStateKey,
    gpuResidentLaneStagePlanSchema: gpuResidentLaneStagePlanLeaseExecution?.stagePlan?.schema
      || gpuResidentLaneStagePlanExecution?.stagePlan?.schema
      || null,
    gpuResidentLaneStagePlanContractSchema: gpuResidentLaneStagePlanLeaseExecution?.stagePlan?.contractSchema
      || gpuResidentLaneStagePlanExecution?.stagePlan?.contractSchema
      || null,
    gpuResidentLaneStagePlanStatus: gpuResidentLaneStagePlanLeaseExecution?.stagePlan?.status
      || gpuResidentLaneStagePlanExecution?.stagePlan?.status
      || null,
    gpuResidentLaneStagePlanDefaultEnabled: gpuResidentLaneStagePlanLeaseExecution?.stagePlan?.defaultEnabled === true,
    gpuResidentLaneStageExecutionSchema: gpuResidentLaneStagePlanExecution?.schema || null,
    gpuResidentLaneStageExecutionStatus: gpuResidentLaneStagePlanExecution?.status || null,
    gpuResidentLaneStageExecutionCompletedStageCount: gpuResidentLaneStagePlanExecution?.completedStageCount ?? 0,
    gpuResidentLaneStageExecutionStageOrder: (gpuResidentLaneStagePlanExecution?.stageResults || [])
      .map((entry) => entry.stageId),
    gpuResidentLaneStageExecutionDependencyMode: gpuResidentLaneStagePlanExecution?.dependencyMode || null,
    gpuResidentLaneStageExecutionParallel: gpuResidentLaneStagePlanExecution?.parallelStageExecution === true,
    gpuResidentLaneStageExecutionBatches: (gpuResidentLaneStagePlanExecution?.executionBatches || [])
      .map((batch) => [...batch]),
    gpuResidentLaneStageExecutionMaxConcurrentStageCount: gpuResidentLaneStagePlanExecution?.maxConcurrentStageCount ?? 0,
    gpuResidentLaneStageExecutionStateFamilyConflictPolicy:
      gpuResidentLaneStagePlanExecution?.stateFamilyConflictPolicy || null,
    gpuResidentLaneStageExecutionStateFamilyConflictDeferrals:
      (gpuResidentLaneStagePlanExecution?.stateFamilyConflictDeferrals || [])
        .map((entry) => ({ ...entry })),
    gpuResidentLaneStageExecutionStateFamilyConflictDeferralCount:
      gpuResidentLaneStagePlanExecution?.stateFamilyConflictDeferralCount ?? 0,
    gpuResidentLaneStageExecutionAuthorityPath: gpuResidentLaneStageNodeKernelExecutionAuthority
      ? 'node-kernel-execution'
      : (gpuResidentLaneStagePlanExecution ? 'compute-manager-execution' : null),
    gpuResidentLaneStageNodeKernelExecutionAuthority:
      gpuResidentLaneStageNodeKernelExecutionAuthority
        ? { ...gpuResidentLaneStageNodeKernelExecutionAuthority }
        : null,
    gpuResidentLaneStageNodeKernelExecutionAuthoritySchema:
      gpuResidentLaneStageNodeKernelExecutionAuthority?.schema || null,
    gpuResidentLaneStageNodeKernelExecutionAuthorityStatus:
      gpuResidentLaneStageNodeKernelExecutionAuthority?.status || null,
    gpuResidentLaneStageNodeKernelExecutionAuthorityRequestedPlacement:
      gpuResidentLaneStageNodeKernelExecutionAuthority?.requestedPlacement || null,
    gpuResidentLaneStageNodeKernelExecutionAuthorityLocalPlacement:
      gpuResidentLaneStageNodeKernelExecutionAuthority?.localPlacement === true,
    gpuResidentLaneStageNodeKernelExecutionAuthorityAdvisory:
      gpuResidentLaneStageNodeKernelExecutionAuthority?.advisory === true,
    gpuResidentLaneStageNodeKernelExecutionAuthorityRemoteResultPreflightSchema:
      gpuResidentLaneStageNodeKernelExecutionAuthority?.remoteResultPreflight?.schema || null,
    gpuResidentLaneStageNodeKernelExecutionAuthorityRemoteResultPreflightStatus:
      gpuResidentLaneStageNodeKernelExecutionAuthority?.remoteResultPreflight?.status || null,
    gpuResidentLaneStageNodeKernelExecutionAuthorityRemoteResultAdmitted:
      gpuResidentLaneStageNodeKernelExecutionAuthority?.remoteResultAdmitted === true,
    gpuResidentLaneStageNodeKernelExecutionAuthorityRemoteRetainedRefsUsableLocally:
      gpuResidentLaneStageNodeKernelExecutionAuthority?.remoteRetainedRefsUsableLocally === true,
    gpuResidentLaneStageNodeKernelExecutionAuthorityLocalHotBufferRefreshRequired:
      gpuResidentLaneStageNodeKernelExecutionAuthority?.localHotBufferRefreshRequired === true,
    gpuResidentLaneStagePlacementPreflight,
    gpuResidentLaneStagePlacementPreflightSchema: gpuResidentLaneStagePlacementPreflight?.schema || null,
    gpuResidentLaneStagePlacementPreflightStatus: gpuResidentLaneStagePlacementPreflight?.status || null,
    gpuResidentLaneStagePlacementPreflightCanExecute: gpuResidentLaneStagePlacementPreflight?.canExecute === true,
    gpuResidentLaneStagePlacementPreflightBatches: (gpuResidentLaneStagePlacementPreflight?.placementBatches || [])
      .map((batch) => [...batch]),
    gpuResidentLaneStagePlacementPreflightMaxConcurrentStageCount:
      gpuResidentLaneStagePlacementPreflight?.maxConcurrentStageCount ?? 0,
    gpuResidentLaneStagePlacementPreflightStateFamilyConflictPolicy:
      gpuResidentLaneStagePlacementPreflight?.stateFamilyConflictPolicy || null,
    gpuResidentLaneStagePlacementPreflightStateFamilyConflictDeferrals:
      (gpuResidentLaneStagePlacementPreflight?.stateFamilyConflictDeferrals || [])
        .map((entry) => ({ ...entry })),
    gpuResidentLaneStagePlacementPreflightStateFamilyConflictDeferralCount:
      gpuResidentLaneStagePlacementPreflight?.stateFamilyConflictDeferralCount ?? 0,
    gpuResidentLaneStagePlacementPreflightExecutorSources:
      { ...(gpuResidentLaneStagePlacementPreflight?.executorSources || {}) },
    gpuResidentLaneStagePlacementPreflightWorkerResidencyStatuses:
      { ...(gpuResidentLaneStagePlacementPreflight?.workerResidencyStatuses || {}) },
    gpuResidentLaneStagePlacementPreflightWorkerRequestedCount:
      gpuResidentLaneStagePlacementPreflight?.workerRequestedCount ?? 0,
    gpuResidentLaneStagePlacementPreflightWorkerReadyCount:
      gpuResidentLaneStagePlacementPreflight?.workerReadyCount ?? 0,
    gpuResidentLaneStagePlacementPreflightWorkerFallbackCount:
      gpuResidentLaneStagePlacementPreflight?.workerFallbackCount ?? 0,
    gpuResidentLaneStagePlacementPreflightMissingExecutorCount:
      gpuResidentLaneStagePlacementPreflight?.missingExecutorCount ?? 0,
    gpuResidentLaneStagePlacementAuthorityPath: gpuResidentLaneStageNodeKernelPlacementPreflight
      ? 'node-kernel-preflight'
      : (gpuResidentLaneStagePlacementPreflight ? 'compute-manager-preflight' : null),
    gpuResidentLaneStageNodeKernelPlacementPreflight,
    gpuResidentLaneStageNodeKernelPlacementPreflightSchema:
      gpuResidentLaneStageNodeKernelPlacementPreflight?.schema || null,
    gpuResidentLaneStageNodeKernelPlacementPreflightStatus:
      gpuResidentLaneStageNodeKernelPlacementPreflight?.status || null,
    gpuResidentLaneStageNodeKernelPlacementPreflightRequestedPlacement:
      gpuResidentLaneStageNodeKernelPlacementPreflight?.requestedPlacement || null,
    gpuResidentLaneStageNodeKernelPlacementPreflightAdvisory:
      gpuResidentLaneStageNodeKernelPlacementPreflight?.advisory === true,
    gpuResidentLaneStageNodeKernelPlacementPreflightComputeManagerStatus:
      gpuResidentLaneStageNodeKernelPlacementPreflight?.computeManagerPreflightStatus || null,
    gpuResidentLaneStageNodeKernelPlacementPreflightCanExecute:
      gpuResidentLaneStageNodeKernelPlacementPreflight?.computeManagerCanExecute === true,
    gpuResidentLaneStageExecutionExecutorSources: stageExecutionExecutorSources,
    gpuResidentLaneStageExecutionUsedGpuHubExecutors: Object.values(stageExecutionExecutorSources).length > 0
      ? Object.values(stageExecutionExecutorSources).every((source) => source === 'gpu-hub-resident-stage-executor')
      : false,
    gpuResidentLaneStageExecutionWorkerResidency: stageExecutionWorkerResidency,
    gpuResidentLaneStageExecutionWorkerResidencyStatuses: stageExecutionWorkerResidencyStatuses,
    gpuResidentLaneStageExecutionRequestedWorkerResidency: requestGpuHubWorkerResidency !== false,
    gpuResidentLaneStageExecutionWorkerRunnerSupplied: Boolean(gpuHubResidentStageWorkerRunner),
    gpuResidentLaneStageExecutionWorkerModuleUrl: gpuHubResidentStageWorkerModuleUrl || null,
    workerRetainedContinuationPlan,
    workerRetainedContinuationPlanSchema: workerRetainedContinuationPlan?.schema || null,
    workerRetainedContinuationPlanStatus: workerRetainedContinuationPlan?.status || null,
    workerRetainedContinuationPlanBlocker: workerRetainedContinuationPlan?.blocker || null,
    workerRetainedContinuationPlanUseWorkerInput: workerRetainedContinuationPlan?.useWorkerRetainedInput === true,
    workerRetainedContinuationPlanSourceHotBufferKey: workerRetainedContinuationPlan?.sourceHotBufferKey || null,
    workerRetainedContinuationPlanWorkerRunnerAvailable: workerRetainedContinuationPlan?.workerRunnerAvailable === true,
    workerRetainedContinuationPlanWorkerRetainedBufferRefs: workerRetainedContinuationPlan?.workerRetainedBufferRefs || [],
    workerRetainedContinuationPlanRequiredOutputFamilies: workerRetainedContinuationPlan?.requiredOutputFamilies || [],
    workerRetainedContinuationPlanOutputFamilies: workerRetainedContinuationPlan?.outputFamilies || [],
    workerRetainedContinuationPlanMissingOutputFamilies: workerRetainedContinuationPlan?.missingOutputFamilies || [],
    gpuHubResidentStageExecutorMode,
    gpuHubResidentStageExecutorRegisteredCount: gpuHubResidentStageExecutorRegistrations.length,
    gpuHubResidentStageExecutorStageIds: gpuHubResidentStageExecutorRegistrations.map((entry) => entry.stageId),
    gpuResidentLaneStageTaskLaneSummaries: stageLaneSummaries,
    gpuResidentLaneStageTaskLaneIds: stageTaskLaneIds,
    gpuResidentLaneStageTaskStateKeys: stageTaskStateKeys,
    gpuResidentLaneStageTaskBackends: stageTaskBackends,
    gpuResidentLaneStageTaskResidencies: stageTaskResidencies,
    gpuResidentLaneStageTaskFenceSatisfied: stageTaskFenceSatisfied,
    gpuResidentLaneStageTaskReadbackModes: stageTaskReadbackModes,
    gpuResidentLaneStageTaskNormalHotLoopReadbackFree: stageTaskNormalHotLoopReadbackFree,
    gpuResidentLaneStageTaskExecutionStatuses: stageTaskExecutionStatuses,
    gpuResidentLaneStageTaskLaneAligned: allStageTaskLaneIdsMatchPlan,
    gpuResidentLaneStageLeaseId: gpuResidentLaneStagePlanLease?.leaseId || null,
    gpuResidentLaneStageLeaseFenceStatus: gpuResidentLaneStagePlanLeaseExecution?.gpuFence?.status || null,
    gpuResidentLaneStageLeaseFenceSatisfied: gpuResidentLaneStagePlanLeaseExecution?.gpuFence?.fenceSatisfied === true,
    gpuResidentLaneStageRejectedStatus: gpuResidentLaneStagePlanRejected?.status || null,
    workerCompactPublicationCandidate,
    workerCompactPublicationCandidateStatus: workerCompactPublicationCandidate?.candidateStatus || null,
    workerCompactPublicationCandidateSameDeviceRetainedBufferImportAvailable:
      workerCompactPublicationCandidate?.sameDeviceRetainedBufferImportAvailable === true,
    workerCompactPublicationCandidateSameDeviceSourceHotBufferKey:
      workerCompactPublicationCandidate?.sameDeviceSourceHotBufferKey || null,
    workerCompactPublicationCandidateLocalMaterializationStatus:
      workerCompactPublicationCandidate?.localMaterializationStatus || null,
    workerCompactPublicationCandidateAcceptedMaterializationModes:
      workerCompactPublicationCandidate?.acceptedMaterializationModes || [],
    workerCompactPublication,
    workerCompactPublicationStatus: workerCompactPublication?.status
      || workerCompactPublicationCandidate?.publicationStatus
      || null,
    workerCompactPublicationCommitted: workerCompactPublication?.committed === true,
    workerCompactPublicationHotBufferKey: workerCompactPublication?.hotBufferKey || null,
    workerCompactPublicationCommitDeltaTaskId: workerCompactPublication?.commitDeltaTaskId || null,
    workerCompactPublicationSameDeviceRetainedBufferImportAvailable:
      workerCompactPublication?.sameDeviceRetainedBufferImportAvailable === true,
    workerCompactPublicationSameDeviceSourceHotBufferKey:
      workerCompactPublication?.sameDeviceSourceHotBufferKey || null,
    workerCompactSummaryStatus: workerCompactPublicationCandidate?.compactSummaryStatus || null,
    pressureInterfaceWorkerCompactPublicationCandidate,
    pressureInterfaceWorkerCompactPublicationCandidateStatus: pressureInterfaceWorkerCompactPublicationCandidate?.candidateStatus || null,
    pressureInterfaceWorkerCompactPublication,
    pressureInterfaceWorkerCompactPublicationStatus: pressureInterfaceWorkerCompactPublication?.status
      || pressureInterfaceWorkerCompactPublicationCandidate?.publicationStatus
      || null,
    pressureInterfaceWorkerCompactPublicationCommitted: pressureInterfaceWorkerCompactPublication?.committed === true,
    pressureInterfaceWorkerCompactPublicationHotBufferKey: pressureInterfaceWorkerCompactPublication?.hotBufferKey || null,
    pressureInterfaceWorkerCompactPublicationCommitDeltaTaskId: pressureInterfaceWorkerCompactPublication?.commitDeltaTaskId || null,
    pressureInterfaceWorkerCompactSummaryStatus: pressureInterfaceWorkerCompactPublicationCandidate?.compactSummaryStatus || null,
    pressureInterfaceWorkerRetainedBufferRefs: pressureInterfaceWorkerCompactPublicationCandidate?.workerRetainedBufferRefs || [],
    pressureInterfaceWorkerRetainedBufferRefCount: pressureInterfaceWorkerCompactPublicationCandidate?.workerRetainedBufferRefCount ?? 0,
    pressureInterfaceWorkerRetainedPressureBufferRefs: pressureInterfaceWorkerCompactPublicationCandidate?.workerRetainedPressureBufferRefs || [],
    pressureInterfaceWorkerRetainedPressureBufferRefCount: pressureInterfaceWorkerCompactPublicationCandidate?.workerRetainedPressureBufferRefCount ?? 0,
    pressureInterfaceRetainedPressureBufferRefs: pressureInterfaceWorkerCompactPublicationCandidate?.retainedPressureBufferRefs || [],
    pressureInterfaceRetainedPressureBufferRefCount: pressureInterfaceWorkerCompactPublicationCandidate?.retainedPressureBufferRefs?.length ?? 0,
    pressureInterfaceRetainedGasCellFieldSourceSchema: pressureInterfaceWorkerCompactPublication?.retainedGasCellFieldSourceSchema
      || pressureInterfaceWorkerCompactPublicationCandidate?.retainedGasCellFieldSourceSchema
      || null,
    pressureInterfaceRetainedGasCellFieldSourceStatus: pressureInterfaceWorkerCompactPublication?.retainedGasCellFieldSourceStatus
      || pressureInterfaceWorkerCompactPublicationCandidate?.retainedGasCellFieldSourceStatus
      || null,
    pressureInterfaceRetainedGasCellFieldSourceReady: pressureInterfaceWorkerCompactPublication?.retainedGasCellFieldSourceReady === true
      || pressureInterfaceWorkerCompactPublicationCandidate?.retainedGasCellFieldSourceReady === true,
    pressureInterfaceRetainedSourceFamilies: pressureInterfaceWorkerCompactPublication?.retainedSourceFamilies
      || pressureInterfaceWorkerCompactPublicationCandidate?.retainedSourceFamilies
      || [],
    spatialGasLedgerProducerStatus: stageResults[SPATIAL_GAS_LEDGER_PRODUCER_STAGE_ID]?.status || null,
    spatialGasLedgerProducerReady:
      spatialGasLedgerProducerResultReady(stageResults[SPATIAL_GAS_LEDGER_PRODUCER_STAGE_ID]),
    spatialGasLedgerProducerCellCount:
      stageResults[SPATIAL_GAS_LEDGER_PRODUCER_STAGE_ID]?.spatialGasSpeciesLedger?.cellCount ?? 0,
    spatialGasLedgerProducerCompactRowCount:
      stageResults[SPATIAL_GAS_LEDGER_PRODUCER_STAGE_ID]?.compactSpatialGasRowCount ?? 0,
    spatialGasLedgerProducerCompactReadbackByteLength:
      stageResults[SPATIAL_GAS_LEDGER_PRODUCER_STAGE_ID]?.compactSpatialGasReadbackByteLength ?? 0,
    spatialGasLedgerProducerFullProductEventReadbackPerformed:
      stageResults[SPATIAL_GAS_LEDGER_PRODUCER_STAGE_ID]?.fullProductEventReadbackPerformed === true,
    spatialGasLedgerProducerRetainedSourceReady:
      stageResults[SPATIAL_GAS_LEDGER_PRODUCER_STAGE_ID]?.retainedSpatialGasLedgerSourceReady === true,
    spatialGasLedgerProducerRetainedSourceStatus:
      stageResults[SPATIAL_GAS_LEDGER_PRODUCER_STAGE_ID]?.retainedSpatialGasLedgerSourceStatus || null,
    spatialGasLedgerProducerRetainedSpatialGasLedgerBufferRefs:
      stageResults[SPATIAL_GAS_LEDGER_PRODUCER_STAGE_ID]?.retainedSpatialGasLedgerBufferRefs || [],
    spatialGasLedgerProducerWorkerRetainedSpatialGasLedgerBufferRefs:
      stageResults[SPATIAL_GAS_LEDGER_PRODUCER_STAGE_ID]?.workerRetainedSpatialGasLedgerBufferRefs || [],
    gasCellEosProducerImportPublication,
    gasCellEosProducerImportPublicationStatus: gasCellEosProducerImportPublication?.status || null,
    gasCellEosProducerImportPublicationBlocker: gasCellEosProducerImportPublication?.blocker || null,
    gasCellEosProducerPressureInterfaceImportReady:
      gasCellEosProducerImportPublication?.pressureInterfaceGasCellFieldImport?.status === 'pressure-interface-gas-cell-field-import-ready',
    gasCellEosProducerPressureInterfaceAdmissionApproved:
      gasCellEosProducerImportPublication?.pressureInterfaceGasCellFieldAdmission?.gasCellFieldConsumptionApproved === true,
    gasCellEosProducerRetainedGasPressureBufferRefs:
      gasCellEosProducerRetainedGasPressureRefs(stageResults[GAS_CELL_EOS_PRODUCER_STAGE_ID]),
    gasCellEosProducerWorkerRetainedGasPressureBufferRefs:
      gasCellEosProducerWorkerRetainedGasPressureRefs(stageResults[GAS_CELL_EOS_PRODUCER_STAGE_ID]),
    pressureInterfacePublishedForceRowCount: pressureInterfaceWorkerCompactPublicationCandidate?.pressureInterfaceForceRowCount ?? 0,
    pressureInterfacePublicationAuthority: pressureInterfaceWorkerCompactPublicationCandidate?.publicationAuthority || null,
    pressureInterfaceSameFrameGridForceAdmission: pressureInterfaceSameFrameGridForceAdmission,
    pressureInterfaceSameFrameGridForceAdmissionStatus: pressureInterfaceSameFrameGridForceAdmission?.status || null,
    pressureInterfaceSameFrameGridForceAdmissionApproved: pressureInterfaceSameFrameGridForceAdmission?.gridForceApplicationApproved === true,
    pressureInterfaceSameFrameGridForceAdmissionHotBufferKey: pressureInterfaceSameFrameGridForceAdmission?.hotBufferKey || null,
    thermalWorkerCompactPublicationCandidate,
    thermalWorkerCompactPublicationCandidateStatus: thermalWorkerCompactPublicationCandidate?.candidateStatus || null,
    thermalWorkerCompactPublication,
    thermalWorkerCompactPublicationStatus: thermalWorkerCompactPublication?.status
      || thermalWorkerCompactPublicationCandidate?.publicationStatus
      || null,
    thermalWorkerCompactPublicationCommitted: thermalWorkerCompactPublication?.committed === true,
    thermalWorkerCompactPublicationHotBufferKey: thermalWorkerCompactPublication?.hotBufferKey || null,
    thermalWorkerCompactPublicationCommitDeltaTaskId: thermalWorkerCompactPublication?.commitDeltaTaskId || null,
    thermalWorkerCompactSummaryStatus: thermalWorkerCompactPublicationCandidate?.compactSummaryStatus || null,
    thermalWorkerRetainedBufferRefs: thermalWorkerCompactPublicationCandidate?.workerRetainedBufferRefs || [],
    thermalWorkerRetainedBufferRefCount: thermalWorkerCompactPublicationCandidate?.workerRetainedBufferRefCount ?? 0,
    thermalWorkerRetainedThermoBufferRefs: thermalWorkerCompactPublicationCandidate?.workerRetainedThermoBufferRefs || [],
    thermalWorkerRetainedThermoBufferRefCount: thermalWorkerCompactPublicationCandidate?.workerRetainedThermoBufferRefCount ?? 0,
    reactionProductWorkerCompactPublicationCandidate,
    reactionProductWorkerCompactPublicationCandidateStatus: reactionProductWorkerCompactPublicationCandidate?.candidateStatus || null,
    reactionProductWorkerCompactPublication,
    reactionProductWorkerCompactPublicationStatus: reactionProductWorkerCompactPublication?.status
      || reactionProductWorkerCompactPublicationCandidate?.publicationStatus
      || null,
    reactionProductWorkerCompactPublicationCommitted: reactionProductWorkerCompactPublication?.committed === true,
    reactionProductWorkerCompactPublicationHotBufferKey: reactionProductWorkerCompactPublication?.hotBufferKey || null,
    reactionProductWorkerCompactPublicationCommitDeltaTaskId: reactionProductWorkerCompactPublication?.commitDeltaTaskId || null,
    reactionProductWorkerCompactSummaryStatus: reactionProductWorkerCompactPublicationCandidate?.compactSummaryStatus || null,
    reactionProductWorkerRetainedBufferRefs: reactionProductWorkerCompactPublicationCandidate?.workerRetainedBufferRefs || [],
    reactionProductWorkerRetainedBufferRefCount: reactionProductWorkerCompactPublicationCandidate?.workerRetainedBufferRefCount ?? 0,
    reactionProductWorkerRetainedProductBufferRefs: reactionProductWorkerCompactPublicationCandidate?.workerRetainedProductBufferRefs || [],
    reactionProductWorkerRetainedProductBufferRefCount: reactionProductWorkerCompactPublicationCandidate?.workerRetainedProductBufferRefCount ?? 0,
    workerRetainedBufferRefs: workerCompactPublicationCandidate?.workerRetainedBufferRefs || [],
    workerRetainedBufferRefCount: workerCompactPublicationCandidate?.workerRetainedBufferRefCount ?? 0,
    computeManagerOwned: true,
    nodeKernelOwned: nativeTaskGraph?.nodeKernelOwned === true,
    authoritativeStateMutation: false,
    childLawAuthority: 'not-admitted',
    stageOrder: [...stageOrder],
    stageTaskBoundaries,
    submittedStageTasks,
    stageTaskResultSchemas: Object.fromEntries(
      stageOrder.map((stageId) => [stageId, stageResults[stageId]?.computeTaskResultSchema || null])
    ),
    stageTaskEvidenceSchemas: Object.fromEntries(
      stageOrder.map((stageId) => [stageId, stageEvidenceByStage[stageId]?.schema || null])
    ),
    stageTaskEvidencePassed,
    allStageTaskEvidencePassed: stageOrder
      .every((stageId) => stageEvidenceByStage[stageId]?.passed === true),
    scientificValidation: false,
    fullPhysicsValidation: false
  };
  step.mechanicsStageTaskChain = stageTaskChain;
  if (step.mechanicsOnlySplitPath) {
    step.mechanicsOnlySplitPath.stageTaskChain = {
      schema: stageTaskChain.schema,
      status: stageTaskChain.status,
      schedulerStatus: stageTaskChain.schedulerStatus,
      taskIdPrefix,
      stageOrder: [...stageTaskChain.stageOrder],
      stageTaskBoundaries: { ...stageTaskBoundaries },
      nativeTaskGraphCacheKeySource: stageTaskChain.nativeTaskGraphCacheKeySource,
      nativeTaskGraphCacheInputHash: stageTaskChain.nativeTaskGraphCacheInputHash,
      nativeTaskGraphCacheInputsSchema: stageTaskChain.nativeTaskGraphCacheInputsSchema,
      nativeTaskGraphCacheAdmissionStatus: stageTaskChain.nativeTaskGraphCacheAdmissionStatus,
      nativeTaskGraphCacheArtifactSchema: stageTaskChain.nativeTaskGraphCacheArtifactSchema,
      nativeTaskGraphCacheArtifactStatus: stageTaskChain.nativeTaskGraphCacheArtifactStatus,
      nativeTaskGraphCacheArtifactAdmitted: stageTaskChain.nativeTaskGraphCacheArtifactAdmitted,
      nativeTaskGraphCacheStatus: stageTaskChain.nativeTaskGraphCacheStatus,
      nativeTaskGraphPlacementPolicySchema: stageTaskChain.nativeTaskGraphPlacementPolicySchema,
      nativeTaskGraphCancellationStatus: stageTaskChain.nativeTaskGraphCancellationStatus,
      nativeTaskGraphLeaseStatus: stageTaskChain.nativeTaskGraphLeaseStatus,
      nativeTaskGraphNodeKernelAuthoritySchema: stageTaskChain.nativeTaskGraphNodeKernelAuthoritySchema,
      nativeTaskGraphNodeKernelAuthorityStatus: stageTaskChain.nativeTaskGraphNodeKernelAuthorityStatus,
      nativeTaskGraphNodeKernelId: stageTaskChain.nativeTaskGraphNodeKernelId,
      nativeTaskGraphPlacementPreflightSchema: stageTaskChain.nativeTaskGraphPlacementPreflightSchema,
      nativeTaskGraphPlacementPreflightStatus: stageTaskChain.nativeTaskGraphPlacementPreflightStatus,
      nativeTaskGraphAuthorityPath: stageTaskChain.nativeTaskGraphAuthorityPath,
      gpuResidentLaneStagePlanSchema: stageTaskChain.gpuResidentLaneStagePlanSchema,
      gpuResidentLaneStagePlanContractSchema: stageTaskChain.gpuResidentLaneStagePlanContractSchema,
      gpuResidentLaneStagePlanStatus: stageTaskChain.gpuResidentLaneStagePlanStatus,
      gpuResidentLaneStagePlanDefaultEnabled: stageTaskChain.gpuResidentLaneStagePlanDefaultEnabled,
      gpuResidentLaneStagePlanLaneId: stageTaskChain.gpuResidentLaneStagePlanLaneId,
      gpuResidentLaneStagePlanStateKey: stageTaskChain.gpuResidentLaneStagePlanStateKey,
      gpuResidentLaneStageExecutionSchema: stageTaskChain.gpuResidentLaneStageExecutionSchema,
      gpuResidentLaneStageExecutionStatus: stageTaskChain.gpuResidentLaneStageExecutionStatus,
      gpuResidentLaneStageExecutionCompletedStageCount: stageTaskChain.gpuResidentLaneStageExecutionCompletedStageCount,
      gpuResidentLaneStageExecutionStageOrder: [...stageTaskChain.gpuResidentLaneStageExecutionStageOrder],
      gpuResidentLaneStageExecutionAuthorityPath:
        stageTaskChain.gpuResidentLaneStageExecutionAuthorityPath,
      gpuResidentLaneStageNodeKernelExecutionAuthoritySchema:
        stageTaskChain.gpuResidentLaneStageNodeKernelExecutionAuthoritySchema,
      gpuResidentLaneStageNodeKernelExecutionAuthorityStatus:
        stageTaskChain.gpuResidentLaneStageNodeKernelExecutionAuthorityStatus,
      gpuResidentLaneStageNodeKernelExecutionAuthorityRequestedPlacement:
        stageTaskChain.gpuResidentLaneStageNodeKernelExecutionAuthorityRequestedPlacement,
      gpuResidentLaneStageNodeKernelExecutionAuthorityLocalPlacement:
        stageTaskChain.gpuResidentLaneStageNodeKernelExecutionAuthorityLocalPlacement,
      gpuResidentLaneStageNodeKernelExecutionAuthorityAdvisory:
        stageTaskChain.gpuResidentLaneStageNodeKernelExecutionAuthorityAdvisory,
      gpuResidentLaneStageNodeKernelExecutionAuthorityRemoteResultPreflightSchema:
        stageTaskChain.gpuResidentLaneStageNodeKernelExecutionAuthorityRemoteResultPreflightSchema,
      gpuResidentLaneStageNodeKernelExecutionAuthorityRemoteResultPreflightStatus:
        stageTaskChain.gpuResidentLaneStageNodeKernelExecutionAuthorityRemoteResultPreflightStatus,
      gpuResidentLaneStageNodeKernelExecutionAuthorityRemoteResultAdmitted:
        stageTaskChain.gpuResidentLaneStageNodeKernelExecutionAuthorityRemoteResultAdmitted,
      gpuResidentLaneStageNodeKernelExecutionAuthorityRemoteRetainedRefsUsableLocally:
        stageTaskChain.gpuResidentLaneStageNodeKernelExecutionAuthorityRemoteRetainedRefsUsableLocally,
      gpuResidentLaneStageNodeKernelExecutionAuthorityLocalHotBufferRefreshRequired:
        stageTaskChain.gpuResidentLaneStageNodeKernelExecutionAuthorityLocalHotBufferRefreshRequired,
      gpuResidentLaneStagePlacementPreflightSchema: stageTaskChain.gpuResidentLaneStagePlacementPreflightSchema,
      gpuResidentLaneStagePlacementPreflightStatus: stageTaskChain.gpuResidentLaneStagePlacementPreflightStatus,
      gpuResidentLaneStagePlacementPreflightCanExecute: stageTaskChain.gpuResidentLaneStagePlacementPreflightCanExecute,
      gpuResidentLaneStagePlacementPreflightBatches:
        stageTaskChain.gpuResidentLaneStagePlacementPreflightBatches.map((batch) => [...batch]),
      gpuResidentLaneStagePlacementPreflightMaxConcurrentStageCount:
        stageTaskChain.gpuResidentLaneStagePlacementPreflightMaxConcurrentStageCount,
      gpuResidentLaneStagePlacementPreflightStateFamilyConflictPolicy:
        stageTaskChain.gpuResidentLaneStagePlacementPreflightStateFamilyConflictPolicy,
      gpuResidentLaneStagePlacementPreflightStateFamilyConflictDeferralCount:
        stageTaskChain.gpuResidentLaneStagePlacementPreflightStateFamilyConflictDeferralCount,
      gpuResidentLaneStagePlacementPreflightExecutorSources:
        { ...stageTaskChain.gpuResidentLaneStagePlacementPreflightExecutorSources },
      gpuResidentLaneStagePlacementPreflightWorkerResidencyStatuses:
        { ...stageTaskChain.gpuResidentLaneStagePlacementPreflightWorkerResidencyStatuses },
      gpuResidentLaneStagePlacementPreflightWorkerRequestedCount:
        stageTaskChain.gpuResidentLaneStagePlacementPreflightWorkerRequestedCount,
      gpuResidentLaneStagePlacementPreflightWorkerReadyCount:
        stageTaskChain.gpuResidentLaneStagePlacementPreflightWorkerReadyCount,
      gpuResidentLaneStagePlacementPreflightWorkerFallbackCount:
        stageTaskChain.gpuResidentLaneStagePlacementPreflightWorkerFallbackCount,
      gpuResidentLaneStagePlacementPreflightMissingExecutorCount:
        stageTaskChain.gpuResidentLaneStagePlacementPreflightMissingExecutorCount,
      gpuResidentLaneStagePlacementAuthorityPath: stageTaskChain.gpuResidentLaneStagePlacementAuthorityPath,
      gpuResidentLaneStageNodeKernelPlacementPreflightSchema:
        stageTaskChain.gpuResidentLaneStageNodeKernelPlacementPreflightSchema,
      gpuResidentLaneStageNodeKernelPlacementPreflightStatus:
        stageTaskChain.gpuResidentLaneStageNodeKernelPlacementPreflightStatus,
      gpuResidentLaneStageNodeKernelPlacementPreflightRequestedPlacement:
        stageTaskChain.gpuResidentLaneStageNodeKernelPlacementPreflightRequestedPlacement,
      gpuResidentLaneStageNodeKernelPlacementPreflightAdvisory:
        stageTaskChain.gpuResidentLaneStageNodeKernelPlacementPreflightAdvisory,
      gpuResidentLaneStageNodeKernelPlacementPreflightComputeManagerStatus:
        stageTaskChain.gpuResidentLaneStageNodeKernelPlacementPreflightComputeManagerStatus,
      gpuResidentLaneStageNodeKernelPlacementPreflightCanExecute:
        stageTaskChain.gpuResidentLaneStageNodeKernelPlacementPreflightCanExecute,
      gpuResidentLaneStageExecutionExecutorSources: { ...stageTaskChain.gpuResidentLaneStageExecutionExecutorSources },
      gpuResidentLaneStageExecutionUsedGpuHubExecutors: stageTaskChain.gpuResidentLaneStageExecutionUsedGpuHubExecutors,
      gpuResidentLaneStageExecutionWorkerResidency: { ...stageTaskChain.gpuResidentLaneStageExecutionWorkerResidency },
      gpuResidentLaneStageExecutionWorkerResidencyStatuses: { ...stageTaskChain.gpuResidentLaneStageExecutionWorkerResidencyStatuses },
      gpuResidentLaneStageExecutionRequestedWorkerResidency: stageTaskChain.gpuResidentLaneStageExecutionRequestedWorkerResidency,
      gpuResidentLaneStageExecutionWorkerRunnerSupplied: stageTaskChain.gpuResidentLaneStageExecutionWorkerRunnerSupplied,
      gpuResidentLaneStageExecutionWorkerModuleUrl: stageTaskChain.gpuResidentLaneStageExecutionWorkerModuleUrl,
      gpuHubResidentStageExecutorMode: stageTaskChain.gpuHubResidentStageExecutorMode,
      gpuHubResidentStageExecutorRegisteredCount: stageTaskChain.gpuHubResidentStageExecutorRegisteredCount,
      gpuHubResidentStageExecutorStageIds: [...stageTaskChain.gpuHubResidentStageExecutorStageIds],
      gpuResidentLaneStageTaskLaneIds: { ...stageTaskChain.gpuResidentLaneStageTaskLaneIds },
      gpuResidentLaneStageTaskStateKeys: { ...stageTaskChain.gpuResidentLaneStageTaskStateKeys },
      gpuResidentLaneStageTaskBackends: { ...stageTaskChain.gpuResidentLaneStageTaskBackends },
      gpuResidentLaneStageTaskResidencies: { ...stageTaskChain.gpuResidentLaneStageTaskResidencies },
      gpuResidentLaneStageTaskFenceSatisfied: { ...stageTaskChain.gpuResidentLaneStageTaskFenceSatisfied },
      gpuResidentLaneStageTaskReadbackModes: { ...stageTaskChain.gpuResidentLaneStageTaskReadbackModes },
      gpuResidentLaneStageTaskNormalHotLoopReadbackFree: { ...stageTaskChain.gpuResidentLaneStageTaskNormalHotLoopReadbackFree },
      gpuResidentLaneStageTaskExecutionStatuses: { ...stageTaskChain.gpuResidentLaneStageTaskExecutionStatuses },
      gpuResidentLaneStageTaskLaneAligned: stageTaskChain.gpuResidentLaneStageTaskLaneAligned,
      gpuResidentLaneStageLeaseFenceStatus: stageTaskChain.gpuResidentLaneStageLeaseFenceStatus,
      gpuResidentLaneStageLeaseFenceSatisfied: stageTaskChain.gpuResidentLaneStageLeaseFenceSatisfied,
      pressureInterfaceWorkerCompactPublicationStatus: stageTaskChain.pressureInterfaceWorkerCompactPublicationStatus,
      pressureInterfaceWorkerCompactPublicationCommitted: stageTaskChain.pressureInterfaceWorkerCompactPublicationCommitted,
      pressureInterfaceWorkerCompactPublicationHotBufferKey: stageTaskChain.pressureInterfaceWorkerCompactPublicationHotBufferKey,
      pressureInterfaceWorkerCompactSummaryStatus: stageTaskChain.pressureInterfaceWorkerCompactSummaryStatus,
      pressureInterfacePublishedForceRowCount: stageTaskChain.pressureInterfacePublishedForceRowCount,
      spatialGasLedgerProducerStatus: stageTaskChain.spatialGasLedgerProducerStatus,
      spatialGasLedgerProducerReady: stageTaskChain.spatialGasLedgerProducerReady,
      spatialGasLedgerProducerCellCount: stageTaskChain.spatialGasLedgerProducerCellCount,
      spatialGasLedgerProducerCompactRowCount: stageTaskChain.spatialGasLedgerProducerCompactRowCount,
      spatialGasLedgerProducerCompactReadbackByteLength: stageTaskChain.spatialGasLedgerProducerCompactReadbackByteLength,
      spatialGasLedgerProducerFullProductEventReadbackPerformed: stageTaskChain.spatialGasLedgerProducerFullProductEventReadbackPerformed,
      spatialGasLedgerProducerRetainedSourceReady: stageTaskChain.spatialGasLedgerProducerRetainedSourceReady,
      spatialGasLedgerProducerRetainedSourceStatus: stageTaskChain.spatialGasLedgerProducerRetainedSourceStatus,
      gasCellEosProducerImportPublicationStatus: stageTaskChain.gasCellEosProducerImportPublicationStatus,
      gasCellEosProducerImportPublicationBlocker: stageTaskChain.gasCellEosProducerImportPublicationBlocker,
      gasCellEosProducerPressureInterfaceImportReady: stageTaskChain.gasCellEosProducerPressureInterfaceImportReady,
      gasCellEosProducerPressureInterfaceAdmissionApproved: stageTaskChain.gasCellEosProducerPressureInterfaceAdmissionApproved,
      gasCellEosProducerRetainedGasPressureBufferRefs: [...stageTaskChain.gasCellEosProducerRetainedGasPressureBufferRefs],
      gasCellEosProducerWorkerRetainedGasPressureBufferRefs: [...stageTaskChain.gasCellEosProducerWorkerRetainedGasPressureBufferRefs],
      pressureInterfaceSameFrameGridForceAdmissionStatus: stageTaskChain.pressureInterfaceSameFrameGridForceAdmissionStatus,
      pressureInterfaceSameFrameGridForceAdmissionApproved: stageTaskChain.pressureInterfaceSameFrameGridForceAdmissionApproved,
      pressureInterfaceSameFrameGridForceAdmissionHotBufferKey: stageTaskChain.pressureInterfaceSameFrameGridForceAdmissionHotBufferKey,
      thermalWorkerCompactPublicationStatus: stageTaskChain.thermalWorkerCompactPublicationStatus,
      thermalWorkerCompactPublicationCommitted: stageTaskChain.thermalWorkerCompactPublicationCommitted,
      thermalWorkerCompactPublicationHotBufferKey: stageTaskChain.thermalWorkerCompactPublicationHotBufferKey,
      thermalWorkerCompactSummaryStatus: stageTaskChain.thermalWorkerCompactSummaryStatus,
      reactionProductWorkerCompactPublicationStatus: stageTaskChain.reactionProductWorkerCompactPublicationStatus,
      reactionProductWorkerCompactPublicationCommitted: stageTaskChain.reactionProductWorkerCompactPublicationCommitted,
      reactionProductWorkerCompactPublicationHotBufferKey: stageTaskChain.reactionProductWorkerCompactPublicationHotBufferKey,
      reactionProductWorkerCompactSummaryStatus: stageTaskChain.reactionProductWorkerCompactSummaryStatus,
      nodeKernelOwned: stageTaskChain.nodeKernelOwned,
      stageTaskResultSchemas: { ...stageTaskChain.stageTaskResultSchemas },
      stageTaskEvidenceSchemas: { ...stageTaskChain.stageTaskEvidenceSchemas },
      stageTaskEvidencePassed: { ...stageTaskChain.stageTaskEvidencePassed },
      allStageTaskEvidencePassed: stageTaskChain.allStageTaskEvidencePassed
    };
  }
  return step;
}

export function createMlsMpmMechanicsOnlyResidentStepsComputeTask({
  modulePath,
  taskId = null,
  taskFamily = 'ulg-mls-mpm-mechanics-only-resident-steps',
  solverId = 'ulg-mls-mpm-mechanics-only-resident-steps',
  owner = 'ulg-mls-mpm-mechanics-law',
  lawGraphId = 'peercompute.ulg.local-sph-law-closure-graph',
  lawGraphNodeId = 'ulg-mls-mpm-mechanics-law',
  laneId = 'ulg:mechanics-child:active',
  stateKey = 'ulg:mechanics-child-state',
  domainKey = null,
  localExecution = 'inline',
  queueFencePolicy = 'queue.onSubmittedWorkDone-before-admission',
  readFamilies = ['sph-particle-state', 'mls-mpm-mechanics'],
  writeFamilies = ['sph-particle-state', 'mls-mpm-mechanics'],
  retainedBufferRefs = ['sph-state-buffer', 'mls-mpm-mechanics-buffer'],
  returnEnvelope = true,
  suppressCommitDelta = true,
  emitCommitDelta = false,
  ...residentStepOptions
} = {}) {
  if (typeof modulePath !== 'string' || modulePath.trim() === '') {
    throw new Error('createMlsMpmMechanicsOnlyResidentStepsComputeTask requires a modulePath for the ULG mechanics-only resident steps task handler');
  }
  const {
    gpuResidentLaneManager: _ignoredLaneManager,
    gpuResidentLaneId: _ignoredLaneId,
    gpuResidentLaneStateKey: _ignoredLaneStateKey,
    gpuResidentLaneDomainKey: _ignoredLaneDomainKey,
    ...taskStepOptions
  } = residentStepOptions;
  const readbackMode = taskStepOptions.readbackMode === NO_FULL_READBACK_MODE ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE;
  const stepCount = Math.max(1, Math.round(finiteNumber(taskStepOptions.stepCount, 1)));
  const compactSummaryMode = normalizeMlsMpmResidentCompactSummaryMode(taskStepOptions.compactSummaryMode);
  const hotLoopBudget = summarizeMlsMpmResidentHotLoopBudget({
    ...taskStepOptions,
    readbackMode,
    stepCount,
    compactSummaryMode,
    gpuResidentLaneCopyBudget: residentStepOptions.gpuResidentLaneCopyBudget
  });
  const laneCopyBudget = hotLoopBudget.copyBudget;
  const requiresGpuLane = taskStepOptions.preferWebGpu === true
    || readbackMode === NO_FULL_READBACK_MODE
    || Boolean(taskStepOptions.sphParticleUpload || taskStepOptions.mlsMpmParticleUpload);
  const lawGraphNode = createResidentLawGraphNodeTaskRef({
    graphId: lawGraphId,
    nodeId: lawGraphNodeId,
    solverId,
    readFamilies,
    writeFamilies,
    requiredClosures: ['mechanics-material-table'],
    validationGates: [
      'mechanics-only-stage-contract',
      'cpu-reference-oracle-parity',
      'gpu-fence-report',
      'copy-budget',
      'visual-sequence-sanity'
    ],
    cachePolicy: 'hot-mechanics-gpu-lane-or-cpu-oracle-with-warm-closure-tables'
  });
  lawGraphNode.hotLoopBudget = hotLoopBudget;
  const gpuFence = requiresGpuLane
    ? createResidentGpuFenceRequirement({
        laneId,
        stateKey,
        queueFencePolicy,
        retainedBufferRefs,
        source: 'ulg-mls-mpm-mechanics-only-resident-steps-compute-task',
        required: true
      })
    : null;
  const gpuResidentLane = requiresGpuLane
    ? createResidentGpuLaneTaskDescriptor({
        laneId,
        stateKey,
        domainKey,
        solverId,
        owner,
        localExecution,
        readFamilies,
        writeFamilies,
        retainedBufferRefs,
        queueFencePolicy,
        copyBudget: laneCopyBudget
      })
    : null;
  if (gpuResidentLane) gpuResidentLane.hotLoopBudget = hotLoopBudget;
  const id = taskId || `ulg-mls-mpm-mechanics-only-resident-steps:${finiteNumber(taskStepOptions.sphParticleState?.step ?? taskStepOptions.mlsMpmParticleState?.step, 0)}:${stepCount}`;
  return {
    schema: ULG_MLS_MPM_MECHANICS_ONLY_RESIDENT_STEPS_COMPUTE_TASK_SCHEMA,
    id,
    runtime: 'js',
    taskFamily,
    solverId,
    module: modulePath,
    exportName: 'runMlsMpmMechanicsOnlyResidentStepsComputeTask',
    returnEnvelope,
    suppressCommitDelta,
    residency: requiresGpuLane ? 'gpu-lane' : 'cpu-oracle',
    lawGraphNode,
    readFamilies: [...readFamilies],
    writeFamilies: [...writeFamilies],
    expectedOutputFamilies: [...writeFamilies],
    ...(requiresGpuLane ? {
      webgpu: {
        residency: 'gpu-lane',
        requiresQueueFence: true,
        laneId,
        stateKey,
        domainKey,
        queueFencePolicy,
        retainedBufferRefs: [...retainedBufferRefs],
        copyBudget: { ...laneCopyBudget },
        hotLoopBudget
      },
      gpuFence,
      gpuResidentLane
    } : {}),
    data: {
      ...taskStepOptions,
      stepCount,
      readbackMode,
      compactSummaryMode,
      hotLoopBudget,
      gpuFenceRequirement: gpuFence,
      gpuResidentLane,
      lawGraphNode,
      computeTaskSchema: ULG_MLS_MPM_MECHANICS_ONLY_RESIDENT_STEPS_COMPUTE_TASK_SCHEMA,
      computeTaskId: id,
      emitCommitDelta,
      expectedOutputFamilies: [...writeFamilies],
      mechanicsOnlyChildTask: true
    }
  };
}

function createMlsMpmMechanicsChildStageKernelEvidence(execution = {}, {
  computeTaskId = null,
  lawGraphNode = null,
  gpuFenceRequirement = null
} = {}) {
  const finalStep = execution?.finalStep || {};
  const stageStatus = finalStep.stageStatus || {};
  const stageBackends = finalStep.stageBackends || {};
  const stageTiming = finalStep.stageTiming || {};
  const stageMs = stageTiming.stageMs || {};
  const requiredStages = [
    { id: 'p2g', timingKey: 'p2gGridProjection' },
    { id: 'gridUpdate', timingKey: 'gridUpdate' },
    { id: 'g2p', timingKey: 'g2pReconstruction' }
  ];
  const forbiddenStages = ['thermal', 'reaction', 'mechanicsRefresh'];
  const stages = requiredStages.map(({ id, timingKey }, order) => {
    const status = stageStatus[id] || null;
    const backend = stageBackends[id] || null;
    const elapsedMs = finiteNumber(stageMs[timingKey], 0);
    return {
      id,
      order,
      status,
      backend,
      elapsedMs,
      executed: Boolean(status && status !== 'missing'),
      acceptedBackend: ['cpu', 'cpu-reference', 'webgpu'].includes(String(backend || ''))
    };
  });
  const forbidden = forbiddenStages.map((id) => ({
    id,
    status: stageStatus[id] || null,
    backend: stageBackends[id] || null,
    skipped: !stageStatus[id] || stageStatus[id] === 'missing'
  }));
  const requiredPassed = stages.every((entry) => entry.executed && entry.acceptedBackend);
  const forbiddenSkipped = forbidden.every((entry) => entry.skipped);
  const nonMechanicsNotRequested = stageTiming.thermalRequested !== true
    && stageTiming.reactionRequested !== true
    && stageTiming.mechanicsRefreshRequested !== true;
  const splitPath = finalStep.mechanicsOnlySplitPath || {};
  const splitPathPassed = splitPath.status === 'mechanics-only-direct-step-executed'
    && Array.isArray(splitPath.requiredStages)
    && requiredStages.every((entry) => splitPath.requiredStages.includes(entry.id))
    && splitPath.suppressesPressureInterfaceForces === true;
  const pressureSuppressed = finalStep.internalPressureScale === 0
    && finalStep.pressureInterfaceForceRowCount === 0
    && finiteNumber(finalStep.pressureInterfaceAppliedImpulseMagnitudeNSeconds, 0) === 0;
  const writeFamilies = ['sph-particle-state', 'mls-mpm-mechanics'];
  const p2gStage = stages.find((entry) => entry.id === 'p2g') || null;
  const mechanicsChildP2gStageEvidencePassed = Boolean(
    execution?.completedStepCount >= 1
      && p2gStage?.executed === true
      && p2gStage.acceptedBackend === true
      && splitPathPassed
      && pressureSuppressed
  );
  const mechanicsChildP2gStageEvidence = {
    schema: ULG_MLS_MPM_MECHANICS_CHILD_P2G_STAGE_EVIDENCE_SCHEMA,
    passed: mechanicsChildP2gStageEvidencePassed,
    status: mechanicsChildP2gStageEvidencePassed
      ? 'mechanics-child-p2g-stage-evidence-ready'
      : 'mechanics-child-p2g-stage-evidence-failed',
    reason: mechanicsChildP2gStageEvidencePassed
      ? 'mechanics-child-p2g-stage-isolated'
      : !p2gStage?.executed
        ? 'mechanics-child-p2g-stage-not-executed'
        : p2gStage.acceptedBackend !== true
          ? 'mechanics-child-p2g-stage-backend-invalid'
          : !splitPathPassed
            ? 'mechanics-child-p2g-split-path-missing'
            : 'mechanics-child-p2g-pressure-interface-not-suppressed',
    computeTaskId,
    lawGraphNodeId: lawGraphNode?.nodeId || 'ulg-mls-mpm-mechanics-law',
    solverId: lawGraphNode?.solverId || 'ulg-mls-mpm-mechanics-only-resident-steps',
    stageId: 'p2g',
    stageOrder: p2gStage?.order ?? 0,
    sourceStatus: p2gStage?.status || null,
    backend: p2gStage?.backend || null,
    acceptedBackend: p2gStage?.acceptedBackend === true,
    executed: p2gStage?.executed === true,
    elapsedMs: finiteNumber(p2gStage?.elapsedMs, 0),
    completedStepCount: finiteNumber(execution?.completedStepCount, 0),
    splitPath: {
      schema: splitPath.schema || null,
      status: splitPath.status || null,
      source: splitPath.source || null,
      requiredStages: [...(splitPath.requiredStages || [])],
      stageTaskBoundary: splitPath.stageTaskBoundaries?.p2g === true,
      stageTaskEvidenceSchema: splitPath.stageTaskEvidence?.p2g?.schema || null,
      suppressesPressureInterfaceForces: splitPath.suppressesPressureInterfaceForces === true
    },
    pressureInterface: {
      suppressed: pressureSuppressed,
      internalPressureScale: finiteNumber(finalStep.internalPressureScale, 0),
      forceRowCount: finiteNumber(finalStep.pressureInterfaceForceRowCount, 0),
      appliedImpulseMagnitudeNSeconds: finiteNumber(finalStep.pressureInterfaceAppliedImpulseMagnitudeNSeconds, 0)
    },
    readFamilies: ['sph-particle-state', 'mls-mpm-mechanics'],
    transientWriteFamilies: ['mls-mpm-grid'],
    authoritativeWriteFamilies: [],
    mustNotWriteFamilies: ['sph-thermo-phase', 'resident-product-mass', 'pressure-interface-force-rows'],
    promotionStatus: 'stage-evidence-only-not-authoritative',
    scientificValidation: false,
    fullPhysicsValidation: false
  };
  const gridUpdateStage = stages.find((entry) => entry.id === 'gridUpdate') || null;
  const mechanicsChildGridUpdateStageEvidencePassed = Boolean(
    execution?.completedStepCount >= 1
      && gridUpdateStage?.executed === true
      && gridUpdateStage.acceptedBackend === true
      && splitPathPassed
      && pressureSuppressed
  );
  const mechanicsChildGridUpdateStageEvidence = {
    schema: ULG_MLS_MPM_MECHANICS_CHILD_GRID_UPDATE_STAGE_EVIDENCE_SCHEMA,
    passed: mechanicsChildGridUpdateStageEvidencePassed,
    status: mechanicsChildGridUpdateStageEvidencePassed
      ? 'mechanics-child-grid-update-stage-evidence-ready'
      : 'mechanics-child-grid-update-stage-evidence-failed',
    reason: mechanicsChildGridUpdateStageEvidencePassed
      ? 'mechanics-child-grid-update-stage-isolated'
      : !gridUpdateStage?.executed
        ? 'mechanics-child-grid-update-stage-not-executed'
        : gridUpdateStage.acceptedBackend !== true
          ? 'mechanics-child-grid-update-stage-backend-invalid'
          : !splitPathPassed
            ? 'mechanics-child-grid-update-split-path-missing'
            : 'mechanics-child-grid-update-pressure-interface-not-suppressed',
    computeTaskId,
    lawGraphNodeId: lawGraphNode?.nodeId || 'ulg-mls-mpm-mechanics-law',
    solverId: lawGraphNode?.solverId || 'ulg-mls-mpm-mechanics-only-resident-steps',
    stageId: 'gridUpdate',
    stageOrder: gridUpdateStage?.order ?? 1,
    sourceStatus: gridUpdateStage?.status || null,
    backend: gridUpdateStage?.backend || null,
    acceptedBackend: gridUpdateStage?.acceptedBackend === true,
    executed: gridUpdateStage?.executed === true,
    elapsedMs: finiteNumber(gridUpdateStage?.elapsedMs, 0),
    completedStepCount: finiteNumber(execution?.completedStepCount, 0),
    splitPath: {
      schema: splitPath.schema || null,
      status: splitPath.status || null,
      source: splitPath.source || null,
      requiredStages: [...(splitPath.requiredStages || [])],
      stageTaskBoundary: splitPath.stageTaskBoundaries?.gridUpdate === true,
      stageTaskEvidenceSchema: splitPath.stageTaskEvidence?.gridUpdate?.schema || null,
      suppressesPressureInterfaceForces: splitPath.suppressesPressureInterfaceForces === true
    },
    pressureInterface: {
      suppressed: pressureSuppressed,
      internalPressureScale: finiteNumber(finalStep.internalPressureScale, 0),
      forceRowCount: finiteNumber(finalStep.pressureInterfaceForceRowCount, 0),
      appliedImpulseMagnitudeNSeconds: finiteNumber(finalStep.pressureInterfaceAppliedImpulseMagnitudeNSeconds, 0)
    },
    readFamilies: ['mls-mpm-grid'],
    transientReadFamilies: ['mls-mpm-grid'],
    transientWriteFamilies: ['mls-mpm-grid'],
    authoritativeWriteFamilies: [],
    mustNotWriteFamilies: ['sph-particle-state', 'mls-mpm-mechanics', 'sph-thermo-phase', 'resident-product-mass', 'pressure-interface-force-rows'],
    promotionStatus: 'stage-evidence-only-not-authoritative',
    scientificValidation: false,
    fullPhysicsValidation: false
  };
  const g2pStage = stages.find((entry) => entry.id === 'g2p') || null;
  const mechanicsChildG2pStageEvidencePassed = Boolean(
    execution?.completedStepCount >= 1
      && g2pStage?.executed === true
      && g2pStage.acceptedBackend === true
      && splitPathPassed
      && pressureSuppressed
  );
  const mechanicsChildG2pStageEvidence = {
    schema: ULG_MLS_MPM_MECHANICS_CHILD_G2P_STAGE_EVIDENCE_SCHEMA,
    passed: mechanicsChildG2pStageEvidencePassed,
    status: mechanicsChildG2pStageEvidencePassed
      ? 'mechanics-child-g2p-stage-evidence-ready'
      : 'mechanics-child-g2p-stage-evidence-failed',
    reason: mechanicsChildG2pStageEvidencePassed
      ? 'mechanics-child-g2p-stage-isolated'
      : !g2pStage?.executed
        ? 'mechanics-child-g2p-stage-not-executed'
        : g2pStage.acceptedBackend !== true
          ? 'mechanics-child-g2p-stage-backend-invalid'
          : !splitPathPassed
            ? 'mechanics-child-g2p-split-path-missing'
            : 'mechanics-child-g2p-pressure-interface-not-suppressed',
    computeTaskId,
    lawGraphNodeId: lawGraphNode?.nodeId || 'ulg-mls-mpm-mechanics-law',
    solverId: lawGraphNode?.solverId || 'ulg-mls-mpm-mechanics-only-resident-steps',
    stageId: 'g2p',
    stageOrder: g2pStage?.order ?? 2,
    sourceStatus: g2pStage?.status || null,
    backend: g2pStage?.backend || null,
    acceptedBackend: g2pStage?.acceptedBackend === true,
    executed: g2pStage?.executed === true,
    elapsedMs: finiteNumber(g2pStage?.elapsedMs, 0),
    completedStepCount: finiteNumber(execution?.completedStepCount, 0),
    splitPath: {
      schema: splitPath.schema || null,
      status: splitPath.status || null,
      source: splitPath.source || null,
      requiredStages: [...(splitPath.requiredStages || [])],
      stageTaskBoundary: splitPath.stageTaskBoundaries?.g2p === true,
      stageTaskEvidenceSchema: splitPath.stageTaskEvidence?.g2p?.schema || null,
      suppressesPressureInterfaceForces: splitPath.suppressesPressureInterfaceForces === true
    },
    pressureInterface: {
      suppressed: pressureSuppressed,
      internalPressureScale: finiteNumber(finalStep.internalPressureScale, 0),
      forceRowCount: finiteNumber(finalStep.pressureInterfaceForceRowCount, 0),
      appliedImpulseMagnitudeNSeconds: finiteNumber(finalStep.pressureInterfaceAppliedImpulseMagnitudeNSeconds, 0)
    },
    readFamilies: ['sph-particle-state', 'mls-mpm-mechanics', 'mls-mpm-grid'],
    transientReadFamilies: ['mls-mpm-grid'],
    transientWriteFamilies: [],
    authoritativeWriteFamilies: ['sph-particle-state', 'mls-mpm-mechanics'],
    mustNotWriteFamilies: ['sph-thermo-phase', 'resident-product-mass', 'pressure-interface-force-rows'],
    promotionStatus: 'stage-evidence-only-not-authoritative',
    scientificValidation: false,
    fullPhysicsValidation: false
  };
  const passed = Boolean(
    execution?.completedStepCount >= 1
      && requiredPassed
      && forbiddenSkipped
      && nonMechanicsNotRequested
      && splitPathPassed
      && pressureSuppressed
  );
  return {
    schema: ULG_MLS_MPM_MECHANICS_CHILD_STAGE_KERNEL_EVIDENCE_SCHEMA,
    passed,
    status: passed ? 'mechanics-child-stage-kernel-evidence-ready' : 'mechanics-child-stage-kernel-evidence-failed',
    reason: passed
      ? 'mechanics-child-required-kernels-isolated'
      : !requiredPassed
        ? 'mechanics-child-required-stage-missing-or-backend-invalid'
        : !forbiddenSkipped || !nonMechanicsNotRequested
          ? 'mechanics-child-forbidden-stage-ran'
          : !splitPathPassed
            ? 'mechanics-child-split-path-missing'
            : 'mechanics-child-pressure-interface-not-suppressed',
    computeTaskId,
    lawGraphNodeId: lawGraphNode?.nodeId || 'ulg-mls-mpm-mechanics-law',
    solverId: lawGraphNode?.solverId || 'ulg-mls-mpm-mechanics-only-resident-steps',
    completedStepCount: finiteNumber(execution?.completedStepCount, 0),
    requiredStages: stages,
    forbiddenStages: forbidden,
    requiredStageOrder: requiredStages.map((entry) => entry.id),
    requiredPerStageEvidence: [
      'mechanics-child-p2g-stage-evidence',
      'mechanics-child-grid-update-stage-evidence',
      'mechanics-child-g2p-stage-evidence'
    ],
    perStageEvidence: {
      p2g: mechanicsChildP2gStageEvidence,
      gridUpdate: mechanicsChildGridUpdateStageEvidence,
      g2p: mechanicsChildG2pStageEvidence
    },
    mechanicsChildP2gStageEvidence,
    mechanicsChildGridUpdateStageEvidence,
    mechanicsChildG2pStageEvidence,
    stageTiming: {
      schema: stageTiming.schema || null,
      totalMs: finiteNumber(stageTiming.totalMs, 0),
      stageMs: { ...stageMs },
      readbackMode: stageTiming.requestedReadbackMode || finalStep.readbackMode || null,
      mechanicsOnlyEntrypoint: stageTiming.mechanicsOnlyEntrypoint === true
    },
    splitPath: {
      schema: splitPath.schema || null,
      status: splitPath.status || null,
      source: splitPath.source || null,
      requiredStages: [...(splitPath.requiredStages || [])],
      disabledLawStages: [...(splitPath.disabledLawStages || [])],
      stageTaskBoundaries: { ...(splitPath.stageTaskBoundaries || {}) },
      stageTaskEvidenceSchemas: {
        p2g: splitPath.stageTaskEvidence?.p2g?.schema || null,
        gridUpdate: splitPath.stageTaskEvidence?.gridUpdate?.schema || null,
        g2p: splitPath.stageTaskEvidence?.g2p?.schema || null
      },
      suppressesPressureInterfaceForces: splitPath.suppressesPressureInterfaceForces === true
    },
    pressureInterface: {
      suppressed: pressureSuppressed,
      internalPressureScale: finiteNumber(finalStep.internalPressureScale, 0),
      forceRowCount: finiteNumber(finalStep.pressureInterfaceForceRowCount, 0),
      appliedImpulseMagnitudeNSeconds: finiteNumber(finalStep.pressureInterfaceAppliedImpulseMagnitudeNSeconds, 0)
    },
    gpuFenceRequired: gpuFenceRequirement?.required === true,
    readFamilies: ['sph-particle-state', 'mls-mpm-mechanics'],
    writeFamilies,
    mustNotWriteFamilies: ['sph-thermo-phase', 'resident-product-mass', 'pressure-interface-force-rows'],
    scientificValidation: false,
    fullPhysicsValidation: false
  };
}

export async function runMlsMpmMechanicsOnlyResidentStepsComputeTask(data = {}) {
  const {
    gpuResidentLaneManager: _ignoredLaneManager,
    gpuFenceRequirement = null,
    gpuResidentLane = null,
    lawGraphNode = null,
    computeTaskSchema = ULG_MLS_MPM_MECHANICS_ONLY_RESIDENT_STEPS_COMPUTE_TASK_SCHEMA,
    computeTaskId = null,
    peerComputeSolverTask = null,
    emitCommitDelta = false,
    expectedOutputFamilies = [],
    mechanicsOnlyChildTask = true,
    ...residentStepOptions
  } = data || {};
  const execution = await runMlsMpmMechanicsOnlyResidentStepsWithOptionalWebGpu({
    ...residentStepOptions,
    gpuResidentLaneManager: null
  });
  const fenceRequirement = gpuFenceRequirement || gpuResidentLane || { required: false };
  const gpuFence = createMlsMpmResidentStepGpuFenceReport(
    execution?.finalStep || execution,
    fenceRequirement
  );
  const mechanicsChildStageKernelEvidence = createMlsMpmMechanicsChildStageKernelEvidence(execution, {
    computeTaskId,
    lawGraphNode,
    gpuFenceRequirement: fenceRequirement
  });
  const result = {
    ...execution,
    schema: execution?.schema || ULG_MLS_MPM_GPU_RESIDENT_STEPS_EXECUTION_SCHEMA,
    computeTaskResultSchema: ULG_MLS_MPM_MECHANICS_ONLY_RESIDENT_STEPS_COMPUTE_TASK_RESULT_SCHEMA,
    computeTaskSchema,
    computeTaskId,
    lawGraphNode,
    peerComputeSolverTask,
    gpuFence,
    gpuFenceReport: gpuFence,
    gpuResidentLaneRequirement: gpuResidentLane || null,
    expectedOutputFamilies: [...expectedOutputFamilies],
    mechanicsOnlyChildTask: mechanicsOnlyChildTask === true,
    mechanicsChildStageKernelEvidence,
    mechanicsChildP2gStageEvidence: mechanicsChildStageKernelEvidence.mechanicsChildP2gStageEvidence,
    mechanicsChildGridUpdateStageEvidence: mechanicsChildStageKernelEvidence.mechanicsChildGridUpdateStageEvidence,
    mechanicsChildG2pStageEvidence: mechanicsChildStageKernelEvidence.mechanicsChildG2pStageEvidence,
    mechanicsOnlyChildTaskAuthority: {
      schema: 'peercompute.ulg.mechanics-only-child-task-authority.v0',
      status: 'compute-manager-owned-non-mutating-child-task',
      taskId: computeTaskId,
      lawGraphNodeId: lawGraphNode?.nodeId || 'ulg-mls-mpm-mechanics-law',
      solverId: lawGraphNode?.solverId || 'ulg-mls-mpm-mechanics-only-resident-steps',
      readFamilies: [...(lawGraphNode?.readFamilies || ['sph-particle-state', 'mls-mpm-mechanics'])],
      writeFamilies: [...(lawGraphNode?.writeFamilies || ['sph-particle-state', 'mls-mpm-mechanics'])],
      commitDeltaSuppressed: emitCommitDelta === false,
      gpuFenceRequired: gpuFenceRequirement?.required === true,
      gpuFenceSatisfied: gpuFence.fenceSatisfied === true
    }
  };
  if (emitCommitDelta !== false) {
    result.commitDelta = createMlsMpmResidentStepsCommitDelta(result, {
      taskId: computeTaskId,
      scope: 'ulg-mls-mpm-mechanics-only-resident-steps',
      stateKey: gpuResidentLane?.stateKey || null,
      lawGraphNode,
      outputFamilies: expectedOutputFamilies,
      gpuResidentLane
    });
  }
  return result;
}

export function submitMlsMpmMechanicsOnlyResidentStepsComputeTask({ computeManager, ...taskOptions } = {}) {
  if (!computeManager || typeof computeManager.submitTask !== 'function') {
    throw new Error('submitMlsMpmMechanicsOnlyResidentStepsComputeTask requires a ComputeManager-compatible submitTask() method');
  }
  return computeManager.submitTask(createMlsMpmMechanicsOnlyResidentStepsComputeTask(taskOptions));
}

function residentProductMassFromReactionStep(reactionStep) {
  const source = reactionStep?.result || reactionStep;
  return source?.residentProductMass || createResidentProductMassHandle(source?.reactionSummary || null);
}

function isSameResidentProductMass(left, right) {
  if (!left || !right) return false;
  if (left === right) return true;
  return Boolean(left.productEventBuffer && left.productEventBuffer === right.productEventBuffer);
}

function canMergeResidentProductMassBuffers(device, left, right) {
  return Boolean(
    device?.createBuffer
    && device.queue?.submit
    && residentProductMassMatchesDevice(left, device)
    && residentProductMassMatchesDevice(right, device)
    && left?.productEventBuffer
    && right?.productEventBuffer
    && left.productEventBuffer !== right.productEventBuffer
    && left.productEventStrideFloats === right.productEventStrideFloats
    && left.productEventStrideBytes === right.productEventStrideBytes
    && (left.productEventBufferByteLength ?? 0) > 0
    && (right.productEventBufferByteLength ?? 0) > 0
  );
}

function residentProductMassSourceRowCounts(handle) {
  const prior = handle?.productEventSourceRowCounts || handle?.mergeSourceProductEventRowCounts;
  if (Array.isArray(prior) && prior.length > 0) return prior.map((value) => Math.max(0, Math.round(Number(value) || 0)));
  return [Math.max(0, Math.round(Number(handle?.productEventRowCount) || 0))];
}

function residentProductMassSourceByteLengths(handle) {
  const prior = handle?.mergeSourceProductEventBufferByteLengths;
  if (Array.isArray(prior) && prior.length > 0) return prior.map((value) => Math.max(0, Math.round(Number(value) || 0)));
  return [Math.max(0, Math.round(Number(handle?.productEventBufferByteLength) || 0))];
}

async function mergeResidentProductMassBuffersWebGpu({
  device,
  inputResidentProductMass = null,
  emittedResidentProductMass = null
} = {}) {
  if (!inputResidentProductMass) return emittedResidentProductMass;
  if (!emittedResidentProductMass) return inputResidentProductMass;
  if (isSameResidentProductMass(inputResidentProductMass, emittedResidentProductMass)) {
    return emittedResidentProductMass;
  }
  if (!canMergeResidentProductMassBuffers(device, inputResidentProductMass, emittedResidentProductMass)) {
    return emittedResidentProductMass;
  }
  const inputByteLength = inputResidentProductMass.productEventBufferByteLength ?? 0;
  const emittedByteLength = emittedResidentProductMass.productEventBufferByteLength ?? 0;
  const mergedByteLength = inputByteLength + emittedByteLength;
  const sourceRowCounts = [
    ...residentProductMassSourceRowCounts(inputResidentProductMass),
    ...residentProductMassSourceRowCounts(emittedResidentProductMass)
  ];
  const sourceByteLengths = [
    ...residentProductMassSourceByteLengths(inputResidentProductMass),
    ...residentProductMassSourceByteLengths(emittedResidentProductMass)
  ];
  const gasSpeciesLedger = mergeResidentGasSpeciesLedgers(
    inputResidentProductMass.gasSpeciesLedger,
    emittedResidentProductMass.gasSpeciesLedger
  );
  const mergedBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'ulg-sph-resident-product-mass-merged-product-events',
    size: Math.max(4, mergedByteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  }), device);
  const encoder = device.createCommandEncoder();
  encoder.copyBufferToBuffer(inputResidentProductMass.productEventBuffer, 0, mergedBuffer, 0, inputByteLength);
  encoder.copyBufferToBuffer(emittedResidentProductMass.productEventBuffer, 0, mergedBuffer, inputByteLength, emittedByteLength);
  let productEventMergeQueueCompletionStatus = 'not-submitted';
  let productEventMergeQueueCompletionMethod = null;
  device.queue.submit([encoder.finish()]);
  productEventMergeQueueCompletionStatus = 'queue-submitted';
  productEventMergeQueueCompletionMethod = 'queue.submit';
  if (device.queue?.onSubmittedWorkDone) {
    await device.queue.onSubmittedWorkDone();
    productEventMergeQueueCompletionStatus = 'queue-work-completed';
    productEventMergeQueueCompletionMethod = 'queue.onSubmittedWorkDone';
  } else {
    productEventMergeQueueCompletionStatus = 'queue-submitted-no-explicit-completion';
  }
  let destroyed = false;
  const handle = {
    schema: inputResidentProductMass.schema || emittedResidentProductMass.schema,
    status: 'resident-product-mass-merged-gpu-resident',
    source: 'resident-product-mass-merged-product-events',
    productEventBuffer: mergedBuffer,
    productEventBufferRetained: true,
    productEventBufferByteLength: mergedByteLength,
    productEventRowCount: (inputResidentProductMass.productEventRowCount ?? 0)
      + (emittedResidentProductMass.productEventRowCount ?? 0),
    productEventActiveEventCount: (inputResidentProductMass.productEventActiveEventCount ?? 0)
      + (emittedResidentProductMass.productEventActiveEventCount ?? 0),
    productEventStrideFloats: emittedResidentProductMass.productEventStrideFloats,
    productEventStrideBytes: emittedResidentProductMass.productEventStrideBytes,
    productEventGenerationCount: sourceRowCounts.length,
    productEventSourceRowCounts: sourceRowCounts,
    productInventorySchema: emittedResidentProductMass.productInventorySchema || inputResidentProductMass.productInventorySchema || null,
    productInventoryCount: (inputResidentProductMass.productInventoryCount ?? 0)
      + (emittedResidentProductMass.productInventoryCount ?? 0),
    gasSpeciesLedgerSchema: gasSpeciesLedger?.schema
      ?? emittedResidentProductMass.gasSpeciesLedgerSchema
      ?? inputResidentProductMass.gasSpeciesLedgerSchema
      ?? null,
    gasSpeciesLedger,
    gasSpeciesLedgerCount: gasSpeciesLedger?.recordCount
      ?? ((inputResidentProductMass.gasSpeciesLedgerCount ?? 0) + (emittedResidentProductMass.gasSpeciesLedgerCount ?? 0)),
    gasSpeciesReadbackByteLength: (inputResidentProductMass.gasSpeciesReadbackByteLength ?? 0)
      + (emittedResidentProductMass.gasSpeciesReadbackByteLength ?? 0),
    sealedBoxGasProductMoles: (inputResidentProductMass.sealedBoxGasProductMoles ?? 0)
      + (emittedResidentProductMass.sealedBoxGasProductMoles ?? 0),
    visibleProductMassKg: (inputResidentProductMass.visibleProductMassKg ?? 0)
      + (emittedResidentProductMass.visibleProductMassKg ?? 0),
    unplacedProductMassKg: (inputResidentProductMass.unplacedProductMassKg ?? 0)
      + (emittedResidentProductMass.unplacedProductMassKg ?? 0),
    unplacedGasProductMassKg: (inputResidentProductMass.unplacedGasProductMassKg ?? 0)
      + (emittedResidentProductMass.unplacedGasProductMassKg ?? 0),
    consumeMassPolicy: 'unplaced-product-mass-only',
    visibleMassAlreadyInParticleBuffers: true,
    mergePolicy: 'gpu-buffer-concat-preserve-sparse-product-event-rows',
    mergeSourceProductEventBufferCount: sourceByteLengths.length,
    mergeSourceProductEventRowCounts: sourceRowCounts,
    mergeSourceProductEventBufferByteLengths: sourceByteLengths,
    productEventMergeQueueCompletionStatus,
    productEventMergeQueueCompletionMethod,
    eosCouplingStatus: emittedResidentProductMass.eosCouplingStatus ?? inputResidentProductMass.eosCouplingStatus ?? null,
    forceCouplingStatus: emittedResidentProductMass.forceCouplingStatus ?? inputResidentProductMass.forceCouplingStatus ?? null,
    destroyResidentProductMassBuffers() {
      if (destroyed) return;
      destroyed = true;
      mergedBuffer.destroy?.();
    },
    scientificValidation: false,
    chemistryValidation: false,
    gasValidation: false,
    sphValidation: false,
    fullPhysicsValidation: false
  };
  return tagResidentProductMassDevice(handle, device);
}

function residentProductMassMergeStatus({ inputResidentProductMass = null, emittedResidentProductMass = null, mergedResidentProductMass = null } = {}) {
  if (mergedResidentProductMass?.status === 'resident-product-mass-merged-gpu-resident') {
    return 'resident-product-mass-merged-gpu-resident';
  }
  if (inputResidentProductMass && emittedResidentProductMass) {
    return 'resident-product-mass-merge-pending';
  }
  if (emittedResidentProductMass) return 'resident-product-mass-emitted-only';
  if (inputResidentProductMass) return 'resident-product-mass-input-only';
  return null;
}

function preservedResidentProductMassList({
  preserveResidentProductMass = null,
  preserveResidentProductMassHandles = []
} = {}) {
  return [
    preserveResidentProductMass,
    ...(Array.isArray(preserveResidentProductMassHandles) ? preserveResidentProductMassHandles : [])
  ].filter(Boolean);
}

function isPreservedResidentProductMass(candidate, preservedHandles) {
  return preservedHandles.some((handle) => isSameResidentProductMass(candidate, handle));
}

function destroyResidentProductMassFromStep(step, {
  preserveResidentProductMass = null,
  preserveResidentProductMassHandles = [],
  destroyInputResidentProductMass = false,
  preserveBuffers = []
} = {}) {
  const preservedHandles = preservedResidentProductMassList({
    preserveResidentProductMass,
    preserveResidentProductMassHandles
  });
  const preservedBuffers = new Set((preserveBuffers || []).filter(Boolean));
  const cleanupLedger = createResidentBufferLeaseLedger({
    ledgerId: `mls-mpm-resident-step:${step?.particlePingPong?.nextStep ?? 'unknown'}:buffer-cleanup`,
    stateKey: 'mls-mpm-resident-step',
    step: step?.particlePingPong?.nextStep ?? null,
    time: step?.particlePingPong?.nextTime ?? null,
    scope: 'mls-mpm-resident-step-buffer-cleanup'
  });
  const candidates = [
    { role: 'resident-product-mass', handle: step?.residentProductMass || null },
    { role: 'emitted-resident-product-mass', handle: step?.emittedResidentProductMass || residentProductMassFromReactionStep(step?.reactionStep) },
    { role: 'input-resident-product-mass', handle: destroyInputResidentProductMass ? step?.inputResidentProductMass || null : null }
  ];
  const destroyed = [];
  const skipped = [];
  for (const { role, handle: residentProductMass } of candidates) {
    if (!residentProductMass) continue;
    const resourceKey = residentProductMassResourceKey(role, residentProductMass);
    registerResidentBufferResource(cleanupLedger, {
      resourceKey,
      resourceKind: 'resident-product-event-buffer',
      stateFamily: 'reaction-products',
      ownerStage: role,
      producerStage: residentProductMass.source || residentProductMass.status,
      source: residentProductMass.source,
      status: residentProductMass.status,
      retained: Boolean(residentProductMass.productEventBufferRetained || residentProductMass.productEventBuffer),
      byteLength: residentProductMass.productEventBufferByteLength,
      rowCount: residentProductMass.productEventRowCount,
      bufferLabel: residentProductMass.productEventBuffer?.label,
      expectedConsumers: ['cleanup']
    });
    const preservedByHandle = isPreservedResidentProductMass(residentProductMass, preservedHandles);
    const preservedByBuffer = Boolean(
      residentProductMass.productEventBuffer
      && preservedBuffers.has(residentProductMass.productEventBuffer)
    );
    const preserved = preservedByHandle || preservedByBuffer;
    if (preserved) {
      addResidentBufferLease(cleanupLedger, {
        resourceKey,
        consumerStage: 'preserved-resident-product-mass',
        reason: preservedByHandle
          ? 'preserve-resident-product-mass-handle'
          : 'preserve-resident-product-event-buffer'
      });
    }
    if (destroyed.some((item) => isSameResidentProductMass(item, residentProductMass))) continue;
    if (skipped.some((item) => isSameResidentProductMass(item, residentProductMass))) continue;
    const cleanupEvent = destroyResidentBufferWithLease(
      cleanupLedger,
      resourceKey,
      () => residentProductMass.destroyResidentProductMassBuffers?.(),
      { reason: preserved ? 'preserved-for-next-consumer' : 'resident-step-cleanup' }
    );
    if (cleanupEvent.status === 'destroy-skipped-active-lease') {
      skipped.push(residentProductMass);
      continue;
    }
    destroyed.push(residentProductMass);
  }
  if (step) {
    step.residentBufferLeaseCleanup = summarizeResidentBufferLeaseLedger(cleanupLedger);
    step.residentBufferLeaseCleanupStatus = step.residentBufferLeaseCleanup.status;
  }
}

function buildNextParticleUploads({
  sphParticleState,
  mlsMpmParticleState,
  sphParticleUpload,
  g2pReconstruction,
  thermalStep = null,
  reactionStep = null,
  mechanicsRefreshStep = null,
  inputResidentProductMass = null,
  mergedResidentProductMass = null,
  particlePingPong
}) {
  const retained = retainedG2pOutputBuffers(g2pReconstruction);
  const thermal = retainedThermalOutputBuffers(thermalStep);
  const reaction = retainedReactionOutputBuffers(reactionStep);
  const mechanicsRefresh = retainedMechanicsRefreshOutputBuffers(mechanicsRefreshStep);
  const reactionMutatesParticles = reactionOutputMutatesParticles(reactionStep);
  const stateBuffer = (reactionMutatesParticles ? reaction.stateBuffer : null)
    || thermal.stateBuffer
    || retained.stateBuffer;
  const thermoBuffer = (reactionMutatesParticles ? reaction.thermoBuffer : null)
    || thermal.thermoBuffer
    || (sphParticleUpload?.status === 'webgpu-uploaded' ? sphParticleUpload.thermoBuffer : null);
  const mechanicsBuffer = (reactionMutatesParticles ? reaction.mechanicsBuffer : null)
    || mechanicsRefresh.mechanicsBuffer
    || retained.mechanicsBuffer;
  const residentProductMass = mergedResidentProductMass || reaction.residentProductMass || inputResidentProductMass || null;
  if (!stateBuffer || !mechanicsBuffer) return null;
  if (!thermoBuffer) return null;
  return {
    residentProductMass,
    sphParticleUpload: {
      schema: ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
      status: 'webgpu-uploaded',
      sourceSchema: sphParticleState.schema,
      particleCount: sphParticleState.particleCount,
      stateStrideBytes: sphParticleState.stateStrideBytes,
      thermoStrideBytes: sphParticleState.thermoStrideBytes,
      stateBuffer,
      thermoBuffer,
      ownsStateBuffer: true,
      ownsThermoBuffer: Boolean(reaction.thermoBuffer || thermal.thermoBuffer),
      slot: particlePingPong.nextSlot,
      sourceSlot: particlePingPong.sourceSlot,
      nextSlot: particlePingPong.nextSlot,
      step: particlePingPong.nextStep,
      time: particlePingPong.nextTime,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    },
    mlsMpmParticleUpload: {
      schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
      status: 'webgpu-uploaded',
      sourceSchema: mlsMpmParticleState.schema,
      particleCount: mlsMpmParticleState.particleCount,
      mechanicsStrideBytes: mlsMpmParticleState.mechanicsStrideBytes,
      mechanicsBuffer,
      ownsMechanicsBuffer: true,
      slot: particlePingPong.nextSlot,
      sourceSlot: particlePingPong.sourceSlot,
      nextSlot: particlePingPong.nextSlot,
      step: particlePingPong.nextStep,
      time: particlePingPong.nextTime,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    }
  };
}

async function residentStepEnvelope({
  sphParticleState,
  mlsMpmParticleState,
  sphParticleUpload = null,
  mlsMpmParticleUpload = null,
  p2gGridProjection,
  gridUpdate,
  g2pReconstruction,
  thermalStep = null,
  reactionStep = null,
  mechanicsRefreshStep = null,
  compactGpuSummary = null,
  dt,
  gravityMPerS2,
  boxDimsM,
  cflFactor,
  preferWebGpu,
  device = null,
  sourceSlot = 0,
  inputResidentProductMass = null,
  pressureInterfaceForceSolver = null,
  internalPressureScale = 1,
  stageTiming = null
}) {
  const optionalStages = [thermalStep, reactionStep, mechanicsRefreshStep].filter(Boolean).map((stage) => stage?.result || stage);
  const stages = [p2gGridProjection, gridUpdate, g2pReconstruction, ...optionalStages];
  const backend = executionBackend(stages);
  const stageBuffersRetained = hasRetainedStageBuffers({ p2gGridProjection, gridUpdate });
  const g2pOutput = retainedG2pOutputBuffers(g2pReconstruction);
  const thermalOutput = retainedThermalOutputBuffers(thermalStep);
  const thermalPhaseTransition = thermalPhaseTransitionDiagnostics(thermalStep);
  const reactionOutput = retainedReactionOutputBuffers(reactionStep);
  const mechanicsRefreshOutput = retainedMechanicsRefreshOutputBuffers(mechanicsRefreshStep);
  const reactionOutputParticleMutation = reactionOutputMutatesParticles(reactionStep);
  const nextUsesReactionState = Boolean(reactionOutputParticleMutation && reactionOutput.stateBuffer);
  const nextUsesReactionThermo = Boolean(reactionOutputParticleMutation && reactionOutput.thermoBuffer);
  const nextUsesReactionMechanics = Boolean(reactionOutputParticleMutation && reactionOutput.mechanicsBuffer);
  const nextUsesMechanicsRefresh = Boolean(!nextUsesReactionMechanics && mechanicsRefreshOutput.mechanicsBuffer);
  const nextUsesThermalState = Boolean(!nextUsesReactionState && thermalOutput.stateBuffer);
  const nextUsesThermalThermo = Boolean(!nextUsesReactionThermo && thermalOutput.thermoBuffer);
  const thermalMechanicsRefreshStatus = thermalStep
    ? (nextUsesReactionMechanics
        ? 'mechanics-refreshed-by-reaction-output'
        : (nextUsesMechanicsRefresh
            ? 'mechanics-constitutive-refreshed-after-thermal-state'
            : (nextUsesThermalState
            ? 'mechanics-constitutive-refresh-pending-after-thermal-state'
            : 'mechanics-constitutive-refresh-not-required')))
    : null;
  const thermalPhaseTransitionCouplingStatus = thermalStep
    ? (thermalPhaseTransition.thermalPhaseTransitionCount > 0
        ? (nextUsesThermalState && nextUsesThermalThermo && (nextUsesMechanicsRefresh || nextUsesReactionMechanics)
            ? 'phase-transition-thermal-thermo-mechanics-advanced'
            : 'phase-transition-coupling-incomplete')
        : 'thermal-phase-transition-not-detected')
    : null;
  const emittedResidentProductMass = reactionOutput.residentProductMass || null;
  const residentProductMass = await mergeResidentProductMassBuffersWebGpu({
    device,
    inputResidentProductMass,
    emittedResidentProductMass
  });
  const mergeStatus = residentProductMassMergeStatus({
    inputResidentProductMass,
    emittedResidentProductMass,
    mergedResidentProductMass: residentProductMass
  });
  const g2pOutputBuffersRetained = Boolean(g2pOutput.stateBuffer && g2pOutput.mechanicsBuffer);
  const thermalOutputRequired = Boolean(thermalStep);
  const reactionOutputRequired = Boolean(reactionStep);
  const mechanicsRefreshOutputRequired = Boolean(mechanicsRefreshStep);
  const thermalOutputBuffersRetained = thermalOutputRequired && Boolean(thermalOutput.stateBuffer && thermalOutput.thermoBuffer);
  const reactionOutputBuffersRetained = reactionOutputRequired && Boolean(reactionOutput.stateBuffer && reactionOutput.thermoBuffer && reactionOutput.mechanicsBuffer);
  const mechanicsRefreshOutputBuffersRetained = mechanicsRefreshOutputRequired && Boolean(mechanicsRefreshOutput.mechanicsBuffer);
  const thermalOutputSatisfied = !thermalOutputRequired || thermalOutputBuffersRetained;
  const reactionOutputSatisfied = !reactionOutputRequired || reactionOutputBuffersRetained;
  const mechanicsRefreshOutputSatisfied = !mechanicsRefreshOutputRequired || mechanicsRefreshOutputBuffersRetained;
  const residentBuffersRetained = stageBuffersRetained
    && g2pOutputBuffersRetained
    && thermalOutputSatisfied
    && reactionOutputSatisfied
    && mechanicsRefreshOutputSatisfied;
  const noFullReadback = residentBuffersRetained
    && stages.every((stage) => stage?.backend === 'webgpu' && stage?.readbackMode === NO_FULL_READBACK_MODE);
  const readbackMode = noFullReadback ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE;
  const dispatchTopology = stageTiming?.dispatchTopology
    || p2gGridProjection?.residentDispatchTopology
    || gridUpdate?.residentDispatchTopology
    || g2pReconstruction?.residentDispatchTopology
    || null;
  const sourceStep = finiteNumber(sphParticleState.step ?? mlsMpmParticleState.step, 0);
  const sourceTime = finiteNumber(sphParticleState.time ?? mlsMpmParticleState.time, 0);
  const particlePingPong = {
    sourceSlot,
    nextSlot: sourceSlot === 0 ? 1 : 0,
    step: sourceStep,
    nextStep: sourceStep + 1,
    time: sourceTime,
    nextTime: sourceTime + dt
  };
  const nextParticleUploads = buildNextParticleUploads({
    sphParticleState,
    mlsMpmParticleState,
    sphParticleUpload,
    g2pReconstruction,
    thermalStep,
    reactionStep,
    mechanicsRefreshStep,
    inputResidentProductMass,
    mergedResidentProductMass: residentProductMass,
    particlePingPong
  });
  const activeGridDispatchPlanHint = activeGridDispatchPlanHintFromCompactSummary(compactGpuSummary);
  if (nextParticleUploads && activeGridDispatchPlanHint) {
    nextParticleUploads.activeGridDispatchPlanHint = activeGridDispatchPlanHint;
  }
  const diagnostics = compactMlsMpmResidentStepDiagnostics({
    sphParticleState,
    mlsMpmParticleState,
    sphParticleUpload,
    mlsMpmParticleUpload,
    p2gGridProjection,
    gridUpdate,
    g2pReconstruction,
    thermalStep,
    reactionStep,
    compactGpuSummary,
    readbackMode,
    dispatchTopology
  });
  const stageStatusSummary = {
    p2g: stageStatus(p2gGridProjection),
    gridUpdate: stageStatus(gridUpdate),
    g2p: stageStatus(g2pReconstruction),
    thermal: stageStatus(thermalStep?.result || thermalStep),
    reaction: stageStatus(reactionStep?.result || reactionStep),
    mechanicsRefresh: stageStatus(mechanicsRefreshStep?.result || mechanicsRefreshStep)
  };
  const stageBackendSummary = {
    p2g: p2gGridProjection?.backend || null,
    gridUpdate: gridUpdate?.backend || null,
    g2p: g2pReconstruction?.backend || null,
    thermal: thermalStep?.backend || thermalStep?.result?.backend || null,
    reaction: reactionStep?.backend || reactionStep?.result?.backend || null,
    mechanicsRefresh: mechanicsRefreshStep?.backend || mechanicsRefreshStep?.result?.backend || null
  };
  const residentAuthorityLedger = buildMlsMpmResidentStepAuthorityLedger({
    step: particlePingPong.nextStep,
    time: particlePingPong.nextTime,
    readbackMode,
    backend,
    stageStatus: stageStatusSummary,
    stageBackends: stageBackendSummary,
    thermalStep,
    reactionStep,
    reactionOutputParticleMutation,
    nextUsesReactionState,
    nextUsesReactionThermo,
    nextUsesReactionMechanics,
    nextUsesMechanicsRefresh,
    nextUsesThermalState,
    nextUsesThermalThermo,
    residentProductMass,
    inputResidentProductMass,
    emittedResidentProductMass,
    pressureInterfaceForceSolverStatus: gridUpdate?.pressureInterfaceForceSolverStatus ?? null,
    pressureInterfaceForceApplicationStatus: gridUpdate?.pressureInterfaceForceApplicationStatus ?? null,
    pressureInterfaceForceRowCount: gridUpdate?.pressureInterfaceForceRowCount ?? 0,
    compactGpuSummary,
    residentBuffersRetained
  });
  const residentAuthoritySummary = summarizeResidentStateAuthorityLedger(residentAuthorityLedger);
  const residentBufferLeaseLedger = buildMlsMpmResidentStepBufferLeaseLedger({
    step: particlePingPong.nextStep,
    time: particlePingPong.nextTime,
    inputResidentProductMass,
    emittedResidentProductMass,
    residentProductMass,
    nextParticleUploads,
    pressureInterfaceForceRowCount: gridUpdate?.pressureInterfaceForceRowCount ?? 0,
    compactGpuSummary
  });
  const residentBufferLeaseSummary = summarizeResidentBufferLeaseLedger(residentBufferLeaseLedger);
  const diagnosticsWithAuthority = {
    ...diagnostics,
    internalPressureScale,
    residentAuthorityLedgerStatus: residentAuthorityLedger.status,
    residentAuthorityFamilyCount: residentAuthorityLedger.familyCount,
    residentAuthorityWarnings: [...residentAuthorityLedger.warnings],
    residentAuthorityBlockers: [...residentAuthorityLedger.blockers],
    residentAuthorityParticleOwner: residentAuthoritySummary.familyOwners['particle-kinematics']?.ownerStage ?? null,
    residentAuthorityMechanicsOwner: residentAuthoritySummary.familyOwners.mechanics?.ownerStage ?? null,
    residentAuthorityThermoOwner: residentAuthoritySummary.familyOwners['thermo-phase']?.ownerStage ?? null,
    thermalMechanicsRefreshStatus,
    ...thermalPhaseTransition,
    thermalPhaseTransitionCouplingStatus,
    residentBufferLeaseLedgerStatus: residentBufferLeaseLedger.status,
    residentBufferLeaseResourceCount: residentBufferLeaseLedger.resourceCount,
    residentBufferLeaseActiveLeaseCount: residentBufferLeaseLedger.activeLeaseCount,
    residentBufferLeaseWarnings: [...residentBufferLeaseLedger.warnings],
    residentBufferLeaseBlockers: [...residentBufferLeaseLedger.blockers]
  };

  return {
    schema: ULG_MLS_MPM_GPU_RESIDENT_STEP_EXECUTION_SCHEMA,
    stepSchema: ULG_MLS_MPM_GPU_RESIDENT_STEP_SCHEMA,
    backend,
    status: backend === 'webgpu' ? 'resident-step-webgpu-executed' : 'resident-step-cpu-or-fallback',
    kernelScope: STEP_SCOPE,
    preferWebGpu,
    particleCount: sphParticleState.particleCount,
    gridNodeCount: gridUpdate?.gridNodeCount ?? p2gGridProjection?.gridNodeCount ?? 0,
    dt,
    gravityMPerS2: [...gravityMPerS2],
    boxDimsM: [...boxDimsM],
    cflFactor,
    stateStrideFloats: SPH_GPU_PARTICLE_STATE_FLOATS,
    mechanicsStrideFloats: MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
    state: (reactionStep?.state?.length ? reactionStep.state : (thermalStep?.state?.length ? thermalStep.state : g2pReconstruction?.state)) ?? new Float32Array(),
    mechanics: (reactionStep?.mechanics?.length
      ? reactionStep.mechanics
      : (mechanicsRefreshStep?.mechanics?.length ? mechanicsRefreshStep.mechanics : g2pReconstruction?.mechanics)) ?? new Float32Array(),
    p2gGridProjection,
    gridUpdate,
    g2pReconstruction,
    thermalStep,
    reactionStep,
    mechanicsRefreshStep,
    inputResidentProductMass,
    inputResidentProductMassStatus: inputResidentProductMass?.status ?? null,
    inputResidentProductMassProductEventRowCount: inputResidentProductMass?.productEventRowCount ?? 0,
    emittedResidentProductMass,
    emittedResidentProductMassStatus: emittedResidentProductMass?.status ?? null,
    emittedResidentProductMassProductEventRowCount: emittedResidentProductMass?.productEventRowCount ?? 0,
    residentProductMass,
    residentProductMassStatus: residentProductMass?.status ?? null,
    residentProductMassBufferRetained: residentProductMass?.productEventBufferRetained ?? false,
    residentProductMassBufferByteLength: residentProductMass?.productEventBufferByteLength ?? 0,
    residentProductMassProductEventRowCount: residentProductMass?.productEventRowCount ?? 0,
    residentProductMassUnplacedProductMassKg: residentProductMass?.unplacedProductMassKg ?? null,
    residentProductMassUnplacedGasProductMassKg: residentProductMass?.unplacedGasProductMassKg ?? null,
    residentProductMassGasSpeciesLedgerCount: residentProductMass?.gasSpeciesLedgerCount ?? 0,
    residentProductMassSealedBoxGasProductMoles: residentProductMass?.sealedBoxGasProductMoles ?? null,
    residentProductMassEosCouplingStatus: residentProductMass?.eosCouplingStatus ?? null,
    residentProductMassMergeStatus: mergeStatus,
    residentProductMassMergeQueueCompletionStatus: residentProductMass?.productEventMergeQueueCompletionStatus ?? null,
    residentProductMassMergeQueueCompletionMethod: residentProductMass?.productEventMergeQueueCompletionMethod ?? null,
    residentProductMassGenerationCount: residentProductMass?.productEventGenerationCount
      ?? ((inputResidentProductMass ? 1 : 0) + (emittedResidentProductMass ? 1 : 0)),
    mergedResidentProductMassProductEventRowCount: residentProductMass?.productEventRowCount ?? 0,
    residentProductMassMergedBufferByteLength: residentProductMass?.status === 'resident-product-mass-merged-gpu-resident'
      ? (residentProductMass.productEventBufferByteLength ?? 0)
      : 0,
    residentProductMassMergedInputBufferRetained: Boolean(inputResidentProductMass?.productEventBufferRetained),
    residentProductMassMergedEmittedBufferRetained: Boolean(emittedResidentProductMass?.productEventBufferRetained),
    residentProductMassGridCouplingStatus: p2gGridProjection?.residentProductMassGridCouplingStatus
      ?? p2gGridProjection?.gpuResult?.residentProductMassGridCouplingStatus
      ?? null,
    pressureInterfaceForceSolver,
    pressureInterfaceForceSolverSchema: gridUpdate?.pressureInterfaceForceSolverSchema ?? null,
    pressureInterfaceForceSolverStatus: gridUpdate?.pressureInterfaceForceSolverStatus ?? null,
    pressureInterfaceForceCouplingStatus: gridUpdate?.pressureInterfaceForceCouplingStatus ?? null,
    pressureInterfaceForceApplicationStatus: gridUpdate?.pressureInterfaceForceApplicationStatus ?? null,
    pressureInterfaceGridForceAdmissionSchema: gridUpdate?.pressureInterfaceGridForceAdmissionSchema ?? null,
    pressureInterfaceGridForceAdmissionStatus: gridUpdate?.pressureInterfaceGridForceAdmissionStatus ?? null,
    pressureInterfaceGridForceAdmissionApproved: gridUpdate?.pressureInterfaceGridForceAdmissionApproved ?? false,
    pressureInterfaceGridForceAdmissionDescriptorStatus: gridUpdate?.pressureInterfaceGridForceAdmissionDescriptorStatus ?? null,
    pressureInterfaceGridForceAdmissionSourceHotBufferKey: gridUpdate?.pressureInterfaceGridForceAdmissionSourceHotBufferKey ?? null,
    pressureInterfaceForceRowCount: gridUpdate?.pressureInterfaceForceRowCount ?? 0,
    pressureInterfaceAppliedImpulseNSeconds: [...(gridUpdate?.pressureInterfaceAppliedImpulseNSeconds ?? [0, 0, 0])],
    pressureInterfaceAppliedImpulseMagnitudeNSeconds: gridUpdate?.pressureInterfaceAppliedImpulseMagnitudeNSeconds ?? 0,
    pressureInterfaceAppliedImpulseSource: gridUpdate?.pressureInterfaceAppliedImpulseSource ?? null,
    pressureInterfaceImpulseProofStatus: gridUpdate?.pressureInterfaceImpulseProofStatus ?? null,
    pressureInterfaceForceConsumerStatus: gridUpdate?.pressureInterfaceForceConsumerStatus ?? null,
    wallBarrierContactSchema: gridUpdate?.wallBarrierContactSchema ?? null,
    wallBarrierContactStatus: gridUpdate?.wallBarrierContactStatus ?? null,
    wallBarrierContactMode: gridUpdate?.wallBarrierContactMode ?? null,
    wallBarrierElasticStiffnessNPerM: gridUpdate?.wallBarrierElasticStiffnessNPerM ?? 0,
    wallBarrierElasticStiffnessSource: gridUpdate?.wallBarrierElasticStiffnessSource ?? null,
    wallBarrierContactMaterialPolicySchema: gridUpdate?.wallBarrierContactMaterialPolicySchema ?? null,
    wallBarrierContactMaterialPolicyStatus: gridUpdate?.wallBarrierContactMaterialPolicyStatus ?? null,
    wallBarrierContactMaterialPolicySource: gridUpdate?.wallBarrierContactMaterialPolicySource ?? null,
    wallBarrierContactAlgorithmRowsSchema: gridUpdate?.wallBarrierContactAlgorithmRowsSchema ?? null,
    wallBarrierContactAlgorithmRowStatus: gridUpdate?.wallBarrierContactAlgorithmRowStatus ?? null,
    wallBarrierContactAlgorithmPairKey: gridUpdate?.wallBarrierContactAlgorithmPairKey ?? null,
    wallBarrierContactAlgorithmMaterials: gridUpdate?.wallBarrierContactAlgorithmMaterials ?? [],
    wallBarrierContactAlgorithmPhases: gridUpdate?.wallBarrierContactAlgorithmPhases ?? [],
    wallBarrierContactAlgorithmNormalStiffnessPa: gridUpdate?.wallBarrierContactAlgorithmNormalStiffnessPa ?? 0,
    wallBarrierContactScale: gridUpdate?.wallBarrierContactScale ?? 0,
    wallBarrierMinGapM: gridUpdate?.wallBarrierMinGapM ?? 0,
    wallBarrierContactNodeCount: gridUpdate?.wallBarrierContactNodeCount ?? 0,
    wallBarrierContactMaxResponseAlpha: gridUpdate?.wallBarrierContactMaxResponseAlpha ?? 0,
    wallBarrierContactMaxNormalStiffness: gridUpdate?.wallBarrierContactMaxNormalStiffness ?? 0,
    wallBarrierContactTotalVelocityCorrectionMPerS: gridUpdate?.wallBarrierContactTotalVelocityCorrectionMPerS ?? 0,
    wallBarrierContactMaxVelocityCorrectionMPerS: gridUpdate?.wallBarrierContactMaxVelocityCorrectionMPerS ?? 0,
    internalPressureScale,
    dispatchTopology,
    dispatchTopologyStatus: dispatchTopology?.status || null,
    p2gBackendPolicy: dispatchTopology?.p2gBackendPolicy || null,
    p2gBackendPolicyStatus: dispatchTopology?.p2gBackendPolicyStatus || null,
    p2gBackendRequested: dispatchTopology?.p2gBackendRequested || null,
    p2gBackendEffective: dispatchTopology?.p2gBackendEffective || null,
    p2gBackendFallbackReason: dispatchTopology?.p2gBackendFallbackReason || null,
    cpuParticleLoopInHotPath: dispatchTopology?.cpuParticleLoopInHotPath ?? null,
    stageStatus: stageStatusSummary,
    stageBackends: stageBackendSummary,
    residentAuthorityLedger,
    residentAuthoritySummary,
    residentAuthorityLedgerStatus: residentAuthorityLedger.status,
    residentAuthorityFamilyOwners: residentAuthoritySummary.familyOwners,
    residentAuthorityWarnings: [...residentAuthorityLedger.warnings],
    residentAuthorityBlockers: [...residentAuthorityLedger.blockers],
    residentBufferLeaseLedger,
    residentBufferLeaseSummary,
    residentBufferLeaseLedgerStatus: residentBufferLeaseLedger.status,
    residentBufferLeaseResourceCount: residentBufferLeaseLedger.resourceCount,
    residentBufferLeaseActiveLeaseCount: residentBufferLeaseLedger.activeLeaseCount,
    residentBufferLeaseWarnings: [...residentBufferLeaseLedger.warnings],
    residentBufferLeaseBlockers: [...residentBufferLeaseLedger.blockers],
    stageTiming: stageTiming
      ? {
          ...stageTiming,
          backend,
          readbackMode,
          stageStatus: stageStatusSummary,
          stageBackends: stageBackendSummary
        }
      : null,
    residentBuffersRetained,
    stageBuffersRetained,
    g2pOutputBuffersRetained,
    thermalOutputBuffersRetained,
    reactionOutputBuffersRetained,
    mechanicsRefreshOutputBuffersRetained,
    thermalMechanicsRefreshStatus,
    ...thermalPhaseTransition,
    thermalPhaseTransitionCouplingStatus,
    residentBufferMode: residentBuffersRetained ? 'retained-stage-and-output-buffers' : 'cpu-artifact-fallback',
    particlePingPong,
    residentActiveGridDispatchPlanHint: activeGridDispatchPlanHint,
    residentActiveGridDispatchPlanHintStatus: activeGridDispatchPlanHint?.status ?? null,
    residentActiveGridDispatchPlanHintSource: activeGridDispatchPlanHint?.source ?? null,
    residentActiveGridDispatchPlanHintDispatchArgsBufferByteLength: activeGridDispatchPlanHint?.dispatchArgsBufferByteLength ?? 0,
    residentActiveGridDispatchPlanHintMetadataBufferByteLength: activeGridDispatchPlanHint?.metadataBufferByteLength ?? 0,
    nextParticleUploads,
    nextParticleBufferMode: nextParticleUploads
      ? (nextUsesReactionState
          ? 'retained-reaction-output-buffers'
          : (thermalOutput.stateBuffer
              ? (nextUsesMechanicsRefresh ? 'retained-thermal-output-and-refreshed-mechanics-buffers' : 'retained-thermal-output-and-g2p-mechanics-buffers')
              : 'retained-g2p-output-buffers'))
      : 'not-available',
    nextParticleStateBufferByteLength: (nextUsesReactionState ? reactionOutput.stateBufferByteLength : 0)
      || (nextUsesThermalState ? thermalOutput.stateBufferByteLength : 0)
      || g2pOutput.stateBufferByteLength,
    nextParticleThermoBufferByteLength: (nextUsesReactionThermo ? reactionOutput.thermoBufferByteLength : 0) || thermalOutput.thermoBufferByteLength,
    nextParticleMechanicsBufferByteLength: (nextUsesReactionMechanics ? reactionOutput.mechanicsBufferByteLength : 0)
      || (nextUsesMechanicsRefresh ? mechanicsRefreshOutput.mechanicsBufferByteLength : 0)
      || g2pOutput.mechanicsBufferByteLength,
    g2pStateBufferReplacedByThermalStep: nextUsesThermalState,
    g2pMechanicsBufferReplacedByMechanicsRefresh: nextUsesMechanicsRefresh,
    thermalThermoBufferHandoffStatus: thermalStep
      ? (nextUsesThermalThermo
        ? 'thermal-thermo-buffer-drives-next-particles'
        : 'thermal-thermo-buffer-skipped')
      : null,
    thermalStateBufferHandoffStatus: thermalStep
      ? (nextUsesThermalState
        ? 'thermal-state-buffer-drives-next-particles'
        : 'thermal-state-buffer-skipped-no-retained-output')
      : null,
    thermalOutputReplacedByReactionStep: nextUsesReactionState,
    g2pMechanicsBufferReplacedByReactionStep: nextUsesReactionMechanics,
    reactionOutputParticleMutation,
    reactionOutputBufferHandoffStatus: reactionStep
      ? (reactionOutputParticleMutation
        ? 'reaction-output-buffers-drive-next-particles'
        : 'reaction-output-buffers-skipped-no-particle-mutation')
      : null,
    readbackMode,
    compactGpuSummary,
    normalHotLoopReadbackFree: noFullReadback,
    renderStateReadbackAvailable: !noFullReadback,
    gpuAuthoritativeState: false,
    diagnostics: diagnosticsWithAuthority,
    p2gProjectionValidation: false,
    stressProjectionValidation: false,
    gridUpdateValidation: false,
    g2pValidation: false,
    gridValidation: false,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

export async function runMlsMpmResidentStepWithOptionalWebGpu({
  sphParticleState,
  mlsMpmParticleState,
  sphParticleUpload = null,
  mlsMpmParticleUpload = null,
  gridSpacingM = sphParticleState?.smoothingLengthM,
  boxDimsM = DEFAULT_BOX_DIMS_M,
  dt = mlsMpmParticleState?.mechanicsDtS ?? 0,
  gravityMPerS2 = mlsMpmParticleState?.gravityMPerS2 ?? DEFAULT_GRAVITY_M_PER_S2,
  cflFactor = mlsMpmParticleState?.gridCflFactor || DEFAULT_CFL_FACTOR,
  residentProductMass = null,
  internalPressureScale = 1,
  pressureInterfaceForceRowsBuffer = null,
  pressureInterfaceForceSolver = null,
  pressureInterfaceGridForceAdmission = null,
  preferWebGpu = false,
  navigatorRef = globalThis.navigator,
  device = null,
  deviceResult = null,
  parityTolerances = {},
  onDeviceLost = null,
  p2gRunner = undefined,
  gridUpdateRunner = undefined,
  g2pRunner = undefined,
  p2gStageRunner = undefined,
  gridUpdateStageRunner = undefined,
  g2pStageRunner = undefined,
  summaryRunner = runMlsMpmResidentSummaryWebGpu,
  cohortRanges = null,
  thermalMaterialTable = null,
  thermalStepRunner = runSphThermalStepWebGpu,
  thermalStepOptions = {},
  mechanicsMaterialTable = null,
  mechanicsRefreshRunner = runMlsMpmMechanicsRefreshWithOptionalWebGpu,
  mechanicsRefreshOptions = {},
  reactionTable = null,
  reactionStepRunner = runSphReactionStepWebGpu,
  reactionStepOptions = {},
  reactionParticleBinMetadataReadback = false,
  sourceSlot = sphParticleUpload?.slot ?? 0,
  readbackMode = FULL_READBACK_MODE,
  p2gBackend = MLS_MPM_P2G_BACKEND_RESIDENT_SCATTER,
  compactSummaryScope = MLS_MPM_RESIDENT_SUMMARY_SCOPE_FULL,
  gpuResidentLaneManager = null,
  gpuResidentLaneId = 'ulg:sph-resident:active',
  gpuResidentLaneStateKey = 'ulg:sph-resident-state',
  gpuResidentLaneDomainKey = null,
  gpuResidentLaneCopyBudget: gpuResidentLaneCopyBudgetOverride = null,
  sequenceIndex = null,
  sequenceStepCount = null,
  fuseNoFullResidentMechanics = false,
  fuseNoFullResidentMechanicsActiveGrid = false,
  fuseNoFullResidentActiveGrid = false,
  activeGridDispatchPlanRefreshMode = MLS_MPM_ACTIVE_GRID_PLAN_REFRESH_MODE_EVERY_STEP,
  activeGridSafetyCells = undefined,
  fusedActiveGridSafetyCells = undefined,
  onResidentStageProgress = null
} = {}) {
  assertPackedInputs({ sphParticleState, mlsMpmParticleState });
  assertResidentCpuMirrorGuards({
    sphParticleState,
    mlsMpmParticleState,
    sphParticleUpload,
    mlsMpmParticleUpload,
    preferWebGpu,
    readbackMode
  });
  const dims = finiteVector3(boxDimsM, DEFAULT_BOX_DIMS_M);
  const gravity = finiteVector3(gravityMPerS2, DEFAULT_GRAVITY_M_PER_S2);
  const dtSeconds = finiteNumber(dt, 0);
  const algorithmMaterialContactRows = mlsMpmParticleState?.algorithmMaterialContactRows ?? null;
  const requestedReadbackMode = readbackMode === NO_FULL_READBACK_MODE ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE;
  const resolvedCompactSummaryScope = normalizeMlsMpmResidentSummaryScope(compactSummaryScope);
  const resolvedActiveGridDispatchPlanRefreshMode = normalizeMlsMpmActiveGridPlanRefreshMode(
    activeGridDispatchPlanRefreshMode
  );
  const activeGridDispatchPlanRefreshFinalStep = sequenceIndex == null
    || sequenceStepCount == null
    || Math.max(0, Math.round(finiteNumber(sequenceIndex, 0))) >= Math.max(0, Math.round(finiteNumber(sequenceStepCount, 1)) - 1);
  const residentLaneCopyBudget = gpuResidentLaneCopyBudgetOverride || estimateResidentGpuLaneCopyBudget({
    sphParticleState,
    mlsMpmParticleState,
    sphParticleUpload,
    mlsMpmParticleUpload,
    readbackMode: requestedReadbackMode
  });
  const gpuResidentLaneLease = acquireResidentGpuLaneLease(gpuResidentLaneManager, gpuResidentLaneManager ? {
    laneId: gpuResidentLaneId,
    stateKey: gpuResidentLaneStateKey,
    domainKey: gpuResidentLaneDomainKey,
    solverId: 'ulg-mls-mpm-sph-resident-step',
    taskId: `mls-mpm-resident-step:${finiteNumber(sphParticleState.step ?? mlsMpmParticleState.step, 0)}:${sourceSlot}`,
    owner: 'ulg-sph-resident-step',
    readFamilies: ['sph-particle-state', 'mls-mpm-mechanics', 'resident-product-mass', 'pressure-interface-force-rows'],
    writeFamilies: ['sph-particle-state', 'sph-thermo-phase', 'mls-mpm-mechanics', 'resident-product-mass'],
    retainedBufferRefs: ['sph-state-buffer', 'sph-thermo-buffer', 'mls-mpm-mechanics-buffer'],
    queueFencePolicy: 'queue.onSubmittedWorkDone-before-readback-map',
    copyBudget: residentLaneCopyBudget
  } : null);
  const stageTimingStartMs = nowMs();
  const stageMs = {};
  const markStageProgress = (status, extra = {}) => {
    if (typeof onResidentStageProgress !== 'function') return;
    try {
      onResidentStageProgress({
        schema: 'peercompute.ulg.mls-mpm-resident-stage-progress.v0',
        status,
        sequenceIndex,
        sequenceStepCount,
        sourceSlot,
        readbackMode: requestedReadbackMode,
        compactSummaryScope: resolvedCompactSummaryScope,
        updatedAtMs: nowMs(),
        ...extra
      });
    } catch {
      // Diagnostic progress must never affect the physics step.
    }
  };
  const recordStageMs = (name, startMs) => {
    stageMs[name] = Math.max(0, nowMs() - startMs);
    return stageMs[name];
  };
  const timedStage = async (name, runStage) => {
    const startMs = nowMs();
    markStageProgress('resident-stage-started', { stage: name });
    try {
      const result = await runStage();
      markStageProgress('resident-stage-complete', {
        stage: name,
        elapsedMs: recordStageMs(name, startMs)
      });
      return result;
    } catch (error) {
      markStageProgress('resident-stage-error', {
        stage: name,
        elapsedMs: recordStageMs(name, startMs),
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  };
  let lostInfo = null;
  let resolvedDeviceResult = deviceResult;
  try {
    await timedStage('deviceAcquire', async () => {
      if (preferWebGpu && !device && !deviceResult) {
        resolvedDeviceResult = await requestOpticalGpuDevice(navigatorRef, {
          onDeviceLost(info) {
            lostInfo = info;
            if (typeof onDeviceLost === 'function') onDeviceLost(info);
          }
        });
      }
    });
    const resolvedDevice = device || resolvedDeviceResult?.device || null;
    const sharedDeviceResult = resolvedDevice
      ? { status: 'webgpu-device-ready', reason: device ? 'provided device' : (resolvedDeviceResult?.reason || 'resident step shared device'), device: resolvedDevice }
      : resolvedDeviceResult;

    let fusedMechanics = null;
    stageMs.fusedMechanics = 0;
    const useFusedNoFullMechanics = Boolean(fuseNoFullResidentMechanics) && canUseFusedNoFullMechanicsPath({
      requestedReadbackMode,
      preferWebGpu,
      resolvedDevice,
      sphParticleUpload,
      mlsMpmParticleUpload,
      p2gRunner,
      gridUpdateRunner,
      g2pRunner,
      pressureInterfaceForceRowsBuffer,
      pressureInterfaceForceSolver,
      pressureInterfaceGridForceAdmission,
      residentProductMass
    });
    if (useFusedNoFullMechanics) {
      fusedMechanics = await timedStage('fusedMechanics', () => runFusedNoFullMlsMpmMechanicsWebGpu({
        device: resolvedDevice,
        sphParticleState,
        mlsMpmParticleState,
        sphParticleUpload,
        mlsMpmParticleUpload,
        gridSpacingM,
        boxDimsM: dims,
        dt: dtSeconds,
        gravityMPerS2: gravity,
        cflFactor,
        internalPressureScale,
        fuseActiveGrid: Boolean(fuseNoFullResidentMechanicsActiveGrid || fuseNoFullResidentActiveGrid),
        activeGridSafetyCells: fusedActiveGridSafetyCells ?? activeGridSafetyCells,
        p2gBackend
      }));
      stageMs.p2gGridProjection = 0;
      stageMs.gridUpdate = 0;
      stageMs.g2pReconstruction = 0;
    }

    const p2gGridProjection = fusedMechanics?.p2gGridProjection || await timedStage('p2gGridProjection', () => runMlsMpmP2gGridProjectionWithOptionalWebGpu({
    sphParticleState,
    mlsMpmParticleState,
    sphParticleUpload,
    mlsMpmParticleUpload,
    gridSpacingM,
    boxDimsM: dims,
    dt: dtSeconds,
    residentProductMass,
    internalPressureScale,
    preferWebGpu,
    navigatorRef,
    device: resolvedDevice,
    deviceResult: sharedDeviceResult,
    parityTolerance: parityTolerances.p2g ?? 5e-2,
    retainGridBuffer: true,
    readbackMode: requestedReadbackMode,
    p2gBackend,
    webGpuRunner: p2gRunner,
    onDeviceLost(info) {
      lostInfo = info;
      if (typeof onDeviceLost === 'function') onDeviceLost(info);
    }
  }));

  const gridUpdate = fusedMechanics?.gridUpdate || await timedStage('gridUpdate', () => runMlsMpmGridUpdateWithOptionalWebGpu({
    p2gGridProjection,
    p2gGridBuffer: p2gGridProjection?.gpuResult?.gridBuffer ?? p2gGridProjection?.gridBuffer ?? null,
    pressureInterfaceForceRowsBuffer,
    pressureInterfaceForceSolver,
    pressureInterfaceGridForceAdmission,
    dt: dtSeconds,
    gravityMPerS2: gravity,
    boxDimsM: dims,
    cflFactor,
    algorithmMaterialContactRows,
    preferWebGpu: preferWebGpu && p2gGridProjection.backend === 'webgpu' && !lostInfo,
    navigatorRef,
    device: resolvedDevice,
    deviceResult: sharedDeviceResult,
    parityTolerance: parityTolerances.gridUpdate ?? 1e-5,
    retainUpdatedGridBuffer: true,
    readbackMode: requestedReadbackMode,
    webGpuRunner: gridUpdateRunner,
    onDeviceLost(info) {
      lostInfo = info;
      if (typeof onDeviceLost === 'function') onDeviceLost(info);
    }
  }));

  const g2pReconstruction = fusedMechanics?.g2pReconstruction || await timedStage('g2pReconstruction', () => runMlsMpmG2pWithOptionalWebGpu({
    sphParticleState,
    mlsMpmParticleState,
    gridUpdate,
    sphParticleUpload,
    mlsMpmParticleUpload,
    updatedGridBuffer: gridUpdate?.gpuResult?.updatedGridBuffer ?? gridUpdate?.updatedGridBuffer ?? null,
    dt: dtSeconds,
    boxDimsM: dims,
    internalPressureScale,
    preferWebGpu: preferWebGpu && gridUpdate.backend === 'webgpu' && !lostInfo,
    navigatorRef,
    device: resolvedDevice,
    deviceResult: sharedDeviceResult,
    parityTolerance: parityTolerances.g2p ?? 5e-2,
    retainOutputParticleBuffers: true,
    readbackMode: requestedReadbackMode,
    webGpuRunner: g2pRunner,
    onDeviceLost(info) {
      lostInfo = info;
      if (typeof onDeviceLost === 'function') onDeviceLost(info);
    }
  }));

  let thermalStep = null;
  stageMs.thermalStep = 0;
  if (
    thermalMaterialTable
    && typeof thermalStepRunner === 'function'
    && g2pReconstruction?.backend === 'webgpu'
    && sphParticleUpload?.status === 'webgpu-uploaded'
  ) {
    const g2pOutput = retainedG2pOutputBuffers(g2pReconstruction);
    if (g2pOutput.stateBuffer) {
      thermalStep = await timedStage('thermalStep', () => thermalStepRunner({
        device: resolvedDevice,
        sphParticleState,
        thermalMaterialTable,
        sphParticleUpload,
        sourceStateBuffer: g2pOutput.stateBuffer,
        sourceThermoBuffer: sphParticleUpload.thermoBuffer,
        boxDimsM: dims,
        dtS: dtSeconds,
        retainOutputParticleBuffers: true,
        readbackMode: requestedReadbackMode,
        ...thermalStepOptions
      }));
    }
  }

  let reactionStep = null;
  stageMs.reactionStep = 0;
  if (
    reactionTable?.reactionCount > 0
    && thermalMaterialTable
    && typeof reactionStepRunner === 'function'
    && g2pReconstruction?.backend === 'webgpu'
    && sphParticleUpload?.status === 'webgpu-uploaded'
  ) {
    const g2pOutput = retainedG2pOutputBuffers(g2pReconstruction);
    const thermalOutput = retainedThermalOutputBuffers(thermalStep);
    const sourceStateBuffer = thermalOutput.stateBuffer || g2pOutput.stateBuffer;
    const sourceThermoBuffer = thermalOutput.thermoBuffer || sphParticleUpload.thermoBuffer;
    if (sourceStateBuffer && sourceThermoBuffer && g2pOutput.mechanicsBuffer) {
      const noFullReactionSummaryDefaults = requestedReadbackMode === NO_FULL_READBACK_MODE
        ? {
          readCompactReactionSummary: false,
          readReactionGasSpeciesSummary: false,
          readReactionProductInventory: false,
          readReactionAtomResidual: false
        }
        : {};
      reactionStep = await timedStage('reactionStep', () => reactionStepRunner({
        device: resolvedDevice,
        sphParticleState,
        mlsMpmParticleState,
        reactionTable,
        thermalMaterialTable,
        sphParticleUpload,
        mlsMpmParticleUpload,
        sourceStateBuffer,
        sourceThermoBuffer,
        sourceMechanicsBuffer: g2pOutput.mechanicsBuffer,
        boxDimsM: dims,
        retainOutputParticleBuffers: true,
        readbackMode: requestedReadbackMode,
        ...noFullReactionSummaryDefaults,
        ...reactionStepOptions,
        reactionParticleBinMetadataReadback:
          reactionParticleBinMetadataReadback === true
          || reactionStepOptions.reactionParticleBinMetadataReadback === true
      }));
    }
  }

  let mechanicsRefreshStep = null;
  stageMs.mechanicsRefresh = 0;
  if (
    thermalStep
    && mechanicsMaterialTable
    && typeof mechanicsRefreshRunner === 'function'
    && g2pReconstruction?.backend === 'webgpu'
    && sphParticleUpload?.status === 'webgpu-uploaded'
  ) {
    const g2pOutput = retainedG2pOutputBuffers(g2pReconstruction);
    const thermalOutput = retainedThermalOutputBuffers(thermalStep);
    const reactionOutput = retainedReactionOutputBuffers(reactionStep);
    const reactionMutatesParticles = reactionOutputMutatesParticles(reactionStep);
    const reactionHasMechanicsAuthority = Boolean(reactionMutatesParticles && reactionOutput.mechanicsBuffer);
    const sourceStateBuffer = (reactionMutatesParticles ? reactionOutput.stateBuffer : null)
      || thermalOutput.stateBuffer
      || g2pOutput.stateBuffer;
    const sourceThermoBuffer = (reactionMutatesParticles ? reactionOutput.thermoBuffer : null)
      || thermalOutput.thermoBuffer
      || sphParticleUpload.thermoBuffer;
    if (!reactionHasMechanicsAuthority && sourceStateBuffer && sourceThermoBuffer && g2pOutput.mechanicsBuffer) {
      mechanicsRefreshStep = await timedStage('mechanicsRefresh', () => mechanicsRefreshRunner({
        device: resolvedDevice,
        sphParticleState,
        mlsMpmParticleState,
        mechanicsMaterialTable,
        sphParticleUpload,
        mlsMpmParticleUpload,
        sourceStateBuffer,
        sourceThermoBuffer,
        sourceMechanicsBuffer: g2pOutput.mechanicsBuffer,
        preferWebGpu: preferWebGpu && !lostInfo,
        retainOutputParticleBuffers: true,
        readbackMode: requestedReadbackMode,
        ...mechanicsRefreshOptions
      }));
    }
  }

  const hasWebGpuLikeSummaryDevice = Boolean(resolvedDevice?.createBuffer && resolvedDevice.queue?.writeBuffer);
  const customSummaryRunner = summaryRunner && summaryRunner !== runMlsMpmResidentSummaryWebGpu;
  const compactSummaryRequested = requestedReadbackMode === NO_FULL_READBACK_MODE
    && typeof summaryRunner === 'function';
  const activeGridDispatchPlanRefreshRequested = resolvedActiveGridDispatchPlanRefreshMode === MLS_MPM_ACTIVE_GRID_PLAN_REFRESH_MODE_EVERY_STEP
    || (
      resolvedActiveGridDispatchPlanRefreshMode === MLS_MPM_ACTIVE_GRID_PLAN_REFRESH_MODE_FINAL_ONLY
      && activeGridDispatchPlanRefreshFinalStep
    );
  const activeGridDispatchPlanOnlyEligible = requestedReadbackMode === NO_FULL_READBACK_MODE
    && !compactSummaryRequested
    && fusedMechanics?.activeGridDispatch?.useActiveGrid === true;
  const activeGridDispatchPlanOnlyRequested = activeGridDispatchPlanOnlyEligible
    && activeGridDispatchPlanRefreshRequested;
  const activeGridDispatchPlanRefreshSkippedReason = activeGridDispatchPlanOnlyEligible && !activeGridDispatchPlanOnlyRequested
    ? (
      resolvedActiveGridDispatchPlanRefreshMode === MLS_MPM_ACTIVE_GRID_PLAN_REFRESH_MODE_NONE
        ? 'active-grid-plan-refresh-disabled'
        : 'active-grid-plan-refresh-deferred-until-final-step'
    )
    : null;
  let compactGpuSummary = null;
  stageMs.compactSummary = 0;
  if (
    compactSummaryRequested
    && (hasWebGpuLikeSummaryDevice || customSummaryRunner)
  ) {
    try {
      compactGpuSummary = await timedStage('compactSummary', () => summaryRunner({
        device: resolvedDevice,
        sphParticleState,
        mlsMpmParticleState,
        sphParticleUpload,
        mlsMpmParticleUpload,
        gridUpdate,
        g2pReconstruction,
        thermalStep,
        reactionStep,
        mechanicsRefreshStep,
        cohortRanges,
        summaryScope: resolvedCompactSummaryScope,
        activeGridDispatchPlan: fusedMechanics?.activeGridDispatch?.useActiveGrid === true
          ? {
            requested: true,
            dt: dtSeconds,
            stepCount: 1,
            gravityMPerS2: gravity,
            safetyCells: fusedMechanics.activeGridDispatch.safetyCells
              ?? fusedActiveGridSafetyCells
              ?? activeGridSafetyCells
          }
          : false
      }));
    } catch (error) {
      compactGpuSummary = {
        schema: ULG_MLS_MPM_GPU_RESIDENT_SUMMARY_EXECUTION_SCHEMA,
        backend: 'webgpu',
        status: 'compact-summary-unavailable',
        reason: error instanceof Error ? error.message : String(error),
        compactGpuSummaryAvailable: false,
        scientificValidation: false,
        sphValidation: false,
        phaseChangeValidation: false,
        fullPhysicsValidation: false
      };
    }
  } else if (activeGridDispatchPlanOnlyRequested && hasWebGpuLikeSummaryDevice) {
    try {
      compactGpuSummary = await timedStage('compactSummary', () => runMlsMpmResidentSummaryWebGpu({
        device: resolvedDevice,
        sphParticleState,
        mlsMpmParticleState,
        sphParticleUpload,
        mlsMpmParticleUpload,
        gridUpdate,
        g2pReconstruction,
        thermalStep,
        reactionStep,
        mechanicsRefreshStep,
        cohortRanges,
        summaryScope: resolvedCompactSummaryScope,
        readCompactSummary: false,
        activeGridDispatchPlan: {
          requested: true,
          dt: dtSeconds,
          stepCount: 1,
          gravityMPerS2: gravity,
          safetyCells: fusedMechanics.activeGridDispatch.safetyCells
            ?? fusedActiveGridSafetyCells
            ?? activeGridSafetyCells
        }
      }));
    } catch (error) {
      compactGpuSummary = {
        schema: ULG_MLS_MPM_GPU_RESIDENT_SUMMARY_EXECUTION_SCHEMA,
        backend: 'webgpu',
        status: 'compact-summary-plan-only-unavailable',
        reason: error instanceof Error ? error.message : String(error),
        compactGpuSummaryAvailable: false,
        scientificValidation: false,
        sphValidation: false,
        phaseChangeValidation: false,
        fullPhysicsValidation: false
      };
    }
  }
  const stageTiming = {
    schema: ULG_MLS_MPM_RESIDENT_STAGE_TIMING_SCHEMA,
    totalMs: Math.max(0, nowMs() - stageTimingStartMs),
    stageMs: { ...stageMs },
    queueFenceMs: {
      compactSummaryMapAsync: compactGpuSummary?.mapAsyncWaitMs ?? compactGpuSummary?.timing?.mapAsyncWaitMs ?? null
    },
    compactSummaryTiming: compactGpuSummary?.timing ?? null,
    fusedResidentMechanics: Boolean(fusedMechanics),
    dispatchTopology: fusedMechanics?.dispatchTopology
      || p2gGridProjection?.residentDispatchTopology
      || gridUpdate?.residentDispatchTopology
      || g2pReconstruction?.residentDispatchTopology
      || null,
    activeGridDispatch: fusedMechanics?.activeGridDispatch
      || gridUpdate?.activeGridDispatch
      || p2gGridProjection?.activeGridDispatch
      || null,
    activeGridIndirectDispatch: fusedMechanics?.activeGridIndirectDispatch
      || gridUpdate?.activeGridIndirectDispatch
      || p2gGridProjection?.activeGridIndirectDispatch
      || null,
    requestedReadbackMode,
    preferWebGpu,
    compactSummaryRequested,
    activeGridDispatchPlanOnlyRequested,
    activeGridDispatchPlanOnlyEligible,
    activeGridDispatchPlanRefreshMode: resolvedActiveGridDispatchPlanRefreshMode,
    activeGridDispatchPlanRefreshRequested,
    activeGridDispatchPlanRefreshFinalStep,
    activeGridDispatchPlanRefreshSkippedReason,
    compactSummaryScope: resolvedCompactSummaryScope,
    thermalRequested: Boolean(thermalMaterialTable),
    mechanicsRefreshRequested: Boolean(thermalStep && mechanicsMaterialTable),
    reactionRequested: Boolean(reactionTable?.reactionCount > 0),
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };

  const step = await timedStage('residentStepEnvelope', () => residentStepEnvelope({
    sphParticleState,
    mlsMpmParticleState,
    p2gGridProjection,
    gridUpdate,
    g2pReconstruction,
    thermalStep,
    reactionStep,
    mechanicsRefreshStep,
    inputResidentProductMass: residentProductMass,
    compactGpuSummary,
    dt: dtSeconds,
    gravityMPerS2: gravity,
    boxDimsM: dims,
    cflFactor,
    preferWebGpu,
    device: resolvedDevice,
    sphParticleUpload,
    mlsMpmParticleUpload,
    sourceSlot,
    pressureInterfaceForceSolver,
    internalPressureScale,
    stageTiming
  }));
  if (gpuResidentLaneLease) {
    const queueEvidence = queueEvidenceFromResidentStep(step);
    const gpuResidentLaneExecution = completeResidentGpuLaneLease(gpuResidentLaneManager, gpuResidentLaneLease.leaseId, {
      status: queueEvidence.status,
      method: queueEvidence.method,
      queueCompletionStatus: queueEvidence.status,
      queueCompletionMethod: queueEvidence.method,
      retainedBufferRefs: retainedBufferRefsFromResidentStep(step),
      completed: queueEvidence.fenceSatisfied === true ? true : undefined,
      source: 'ulg-mls-mpm-resident-step'
    });
    attachResidentGpuLaneExecution(step, {
      lease: gpuResidentLaneLease,
      execution: gpuResidentLaneExecution
    });
  }
  return step;
  } catch (error) {
    if (gpuResidentLaneLease) {
      rejectResidentGpuLaneLease(gpuResidentLaneManager, gpuResidentLaneLease.leaseId, 'resident-step-error');
    }
    throw error;
  }
}

export async function runMlsMpmMechanicsOnlyResidentStepWithOptionalWebGpu({
  sphParticleState,
  mlsMpmParticleState,
  sphParticleUpload = null,
  mlsMpmParticleUpload = null,
  gridSpacingM = sphParticleState?.smoothingLengthM,
  boxDimsM = DEFAULT_BOX_DIMS_M,
  dt = mlsMpmParticleState?.mechanicsDtS ?? 0,
  gravityMPerS2 = mlsMpmParticleState?.gravityMPerS2 ?? DEFAULT_GRAVITY_M_PER_S2,
  cflFactor = mlsMpmParticleState?.gridCflFactor || DEFAULT_CFL_FACTOR,
  preferWebGpu = false,
  navigatorRef = globalThis.navigator,
  device = null,
  deviceResult = null,
  parityTolerances = {},
  onDeviceLost = null,
  p2gRunner = undefined,
  gridUpdateRunner = undefined,
  g2pRunner = undefined,
  p2gStageRunner = undefined,
  gridUpdateStageRunner = undefined,
  g2pStageRunner = undefined,
  summaryRunner = runMlsMpmResidentSummaryWebGpu,
  cohortRanges = null,
  sourceSlot = sphParticleUpload?.slot ?? 0,
  readbackMode = FULL_READBACK_MODE,
  compactSummaryScope = MLS_MPM_RESIDENT_SUMMARY_SCOPE_FULL,
  gpuResidentLaneManager = null,
  gpuResidentLaneId = 'ulg:mechanics-child:active',
  gpuResidentLaneStateKey = 'ulg:mechanics-child-state',
  gpuResidentLaneDomainKey = null,
  gpuResidentLaneCopyBudget: gpuResidentLaneCopyBudgetOverride = null,
  sequenceIndex = null,
  sequenceStepCount = null,
  onResidentStageProgress = null
} = {}) {
  assertPackedInputs({ sphParticleState, mlsMpmParticleState });
  assertResidentCpuMirrorGuards({
    sphParticleState,
    mlsMpmParticleState,
    sphParticleUpload,
    mlsMpmParticleUpload,
    preferWebGpu,
    readbackMode
  });
  const dims = finiteVector3(boxDimsM, DEFAULT_BOX_DIMS_M);
  const gravity = finiteVector3(gravityMPerS2, DEFAULT_GRAVITY_M_PER_S2);
  const dtSeconds = finiteNumber(dt, 0);
  const algorithmMaterialContactRows = mlsMpmParticleState?.algorithmMaterialContactRows ?? null;
  const requestedReadbackMode = readbackMode === NO_FULL_READBACK_MODE ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE;
  const resolvedCompactSummaryScope = normalizeMlsMpmResidentSummaryScope(compactSummaryScope);
  const residentLaneCopyBudget = gpuResidentLaneCopyBudgetOverride || estimateResidentGpuLaneCopyBudget({
    sphParticleState,
    mlsMpmParticleState,
    sphParticleUpload,
    mlsMpmParticleUpload,
    readbackMode: requestedReadbackMode
  });
  const gpuResidentLaneLease = acquireResidentGpuLaneLease(gpuResidentLaneManager, gpuResidentLaneManager ? {
    laneId: gpuResidentLaneId,
    stateKey: gpuResidentLaneStateKey,
    domainKey: gpuResidentLaneDomainKey,
    solverId: 'ulg-mls-mpm-mechanics-law',
    taskId: `mls-mpm-mechanics-only-step:${finiteNumber(sphParticleState.step ?? mlsMpmParticleState.step, 0)}:${sourceSlot}`,
    owner: 'ulg-mls-mpm-mechanics-law',
    readFamilies: ['sph-particle-state', 'mls-mpm-mechanics'],
    writeFamilies: ['sph-particle-state', 'mls-mpm-mechanics'],
    retainedBufferRefs: ['sph-state-buffer', 'mls-mpm-mechanics-buffer'],
    queueFencePolicy: 'queue.onSubmittedWorkDone-before-readback-map',
    copyBudget: residentLaneCopyBudget
  } : null);
  const stageTimingStartMs = nowMs();
  const stageMs = {};
  const markStageProgress = (status, extra = {}) => {
    if (typeof onResidentStageProgress !== 'function') return;
    try {
      onResidentStageProgress({
        schema: 'peercompute.ulg.mls-mpm-mechanics-only-stage-progress.v0',
        status,
        sequenceIndex,
        sequenceStepCount,
        sourceSlot,
        readbackMode: requestedReadbackMode,
        compactSummaryScope: resolvedCompactSummaryScope,
        updatedAtMs: nowMs(),
        ...extra
      });
    } catch {
      // Diagnostic progress must never affect the physics step.
    }
  };
  const recordStageMs = (name, startMs) => {
    stageMs[name] = Math.max(0, nowMs() - startMs);
    return stageMs[name];
  };
  const timedStage = async (name, runStage) => {
    const startMs = nowMs();
    markStageProgress('mechanics-only-stage-started', { stage: name });
    try {
      const result = await runStage();
      markStageProgress('mechanics-only-stage-complete', {
        stage: name,
        elapsedMs: recordStageMs(name, startMs)
      });
      return result;
    } catch (error) {
      markStageProgress('mechanics-only-stage-error', {
        stage: name,
        elapsedMs: recordStageMs(name, startMs),
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  };
  let lostInfo = null;
  let resolvedDeviceResult = deviceResult;
  try {
    await timedStage('deviceAcquire', async () => {
      if (preferWebGpu && !device && !deviceResult) {
        resolvedDeviceResult = await requestOpticalGpuDevice(navigatorRef, {
          onDeviceLost(info) {
            lostInfo = info;
            if (typeof onDeviceLost === 'function') onDeviceLost(info);
          }
        });
      }
    });
    const resolvedDevice = device || resolvedDeviceResult?.device || null;
    const sharedDeviceResult = resolvedDevice
      ? { status: 'webgpu-device-ready', reason: device ? 'provided device' : (resolvedDeviceResult?.reason || 'mechanics-only shared device'), device: resolvedDevice }
      : resolvedDeviceResult;

    const p2gStageOptions = {
      sphParticleState,
      mlsMpmParticleState,
      sphParticleUpload,
      mlsMpmParticleUpload,
      gridSpacingM,
      boxDimsM: dims,
      dt: dtSeconds,
      residentProductMass: null,
      internalPressureScale: 0,
      preferWebGpu,
      navigatorRef,
      device: resolvedDevice,
      deviceResult: sharedDeviceResult,
      parityTolerance: parityTolerances.p2g ?? 5e-2,
      retainGridBuffer: true,
      readbackMode: requestedReadbackMode,
      webGpuRunner: p2gRunner,
      onDeviceLost(info) {
        lostInfo = info;
        if (typeof onDeviceLost === 'function') onDeviceLost(info);
      }
    };
    const p2gGridProjection = await timedStage('p2gGridProjection', () => (
      typeof p2gStageRunner === 'function'
        ? p2gStageRunner({
            ...p2gStageOptions,
            stageId: 'p2g',
            defaultRunner: runMlsMpmP2gGridProjectionWithOptionalWebGpu
          })
        : runMlsMpmP2gGridProjectionWithOptionalWebGpu(p2gStageOptions)
    ));

    const gridUpdateStageOptions = {
      p2gGridProjection,
      p2gGridBuffer: p2gGridProjection?.gpuResult?.gridBuffer ?? p2gGridProjection?.gridBuffer ?? null,
      pressureInterfaceForceRowsBuffer: null,
      pressureInterfaceForceSolver: null,
      dt: dtSeconds,
      gravityMPerS2: gravity,
      boxDimsM: dims,
      cflFactor,
      algorithmMaterialContactRows,
      preferWebGpu: preferWebGpu && p2gGridProjection.backend === 'webgpu' && !lostInfo,
      navigatorRef,
      device: resolvedDevice,
      deviceResult: sharedDeviceResult,
      parityTolerance: parityTolerances.gridUpdate ?? 1e-5,
      retainUpdatedGridBuffer: true,
      readbackMode: requestedReadbackMode,
      webGpuRunner: gridUpdateRunner,
      onDeviceLost(info) {
        lostInfo = info;
        if (typeof onDeviceLost === 'function') onDeviceLost(info);
      }
    };
    const gridUpdate = await timedStage('gridUpdate', () => (
      typeof gridUpdateStageRunner === 'function'
        ? gridUpdateStageRunner({
            ...gridUpdateStageOptions,
            stageId: 'gridUpdate',
            defaultRunner: runMlsMpmGridUpdateWithOptionalWebGpu
          })
        : runMlsMpmGridUpdateWithOptionalWebGpu(gridUpdateStageOptions)
    ));

    const g2pStageOptions = {
      sphParticleState,
      mlsMpmParticleState,
      gridUpdate,
      sphParticleUpload,
      mlsMpmParticleUpload,
      updatedGridBuffer: gridUpdate?.gpuResult?.updatedGridBuffer ?? gridUpdate?.updatedGridBuffer ?? null,
      dt: dtSeconds,
      boxDimsM: dims,
      internalPressureScale: 0,
      preferWebGpu: preferWebGpu && gridUpdate.backend === 'webgpu' && !lostInfo,
      navigatorRef,
      device: resolvedDevice,
      deviceResult: sharedDeviceResult,
      parityTolerance: parityTolerances.g2p ?? 5e-2,
      retainOutputParticleBuffers: true,
      readbackMode: requestedReadbackMode,
      webGpuRunner: g2pRunner,
      onDeviceLost(info) {
        lostInfo = info;
        if (typeof onDeviceLost === 'function') onDeviceLost(info);
      }
    };
    const g2pReconstruction = await timedStage('g2pReconstruction', () => (
      typeof g2pStageRunner === 'function'
        ? g2pStageRunner({
            ...g2pStageOptions,
            stageId: 'g2p',
            defaultRunner: runMlsMpmG2pWithOptionalWebGpu
          })
        : runMlsMpmG2pWithOptionalWebGpu(g2pStageOptions)
    ));

    const hasWebGpuLikeSummaryDevice = Boolean(resolvedDevice?.createBuffer && resolvedDevice.queue?.writeBuffer);
    const customSummaryRunner = summaryRunner && summaryRunner !== runMlsMpmResidentSummaryWebGpu;
    const compactSummaryRequested = requestedReadbackMode === NO_FULL_READBACK_MODE
      && typeof summaryRunner === 'function';
    let compactGpuSummary = null;
    stageMs.compactSummary = 0;
    if (
      compactSummaryRequested
      && (hasWebGpuLikeSummaryDevice || customSummaryRunner)
    ) {
      try {
        compactGpuSummary = await timedStage('compactSummary', () => summaryRunner({
          device: resolvedDevice,
          sphParticleState,
          mlsMpmParticleState,
          sphParticleUpload,
          mlsMpmParticleUpload,
          gridUpdate,
          g2pReconstruction,
          thermalStep: null,
          reactionStep: null,
          mechanicsRefreshStep: null,
          cohortRanges,
          summaryScope: resolvedCompactSummaryScope,
          activeGridDispatchPlan: false
        }));
      } catch (error) {
        compactGpuSummary = {
          schema: ULG_MLS_MPM_GPU_RESIDENT_SUMMARY_EXECUTION_SCHEMA,
          backend: 'webgpu',
          status: 'compact-summary-unavailable',
          reason: error instanceof Error ? error.message : String(error),
          compactGpuSummaryAvailable: false,
          scientificValidation: false,
          sphValidation: false,
          phaseChangeValidation: false,
          fullPhysicsValidation: false
        };
      }
    }
    const stageTiming = {
      schema: ULG_MLS_MPM_RESIDENT_STAGE_TIMING_SCHEMA,
      totalMs: Math.max(0, nowMs() - stageTimingStartMs),
      stageMs: { ...stageMs },
      requestedReadbackMode,
      preferWebGpu,
      compactSummaryRequested,
      compactSummaryScope: resolvedCompactSummaryScope,
      thermalRequested: false,
      mechanicsRefreshRequested: false,
      reactionRequested: false,
      mechanicsOnlyEntrypoint: true,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };

    const step = await timedStage('mechanicsOnlyResidentStepEnvelope', () => residentStepEnvelope({
      sphParticleState,
      mlsMpmParticleState,
      p2gGridProjection,
      gridUpdate,
      g2pReconstruction,
      thermalStep: null,
      reactionStep: null,
      mechanicsRefreshStep: null,
      inputResidentProductMass: null,
      compactGpuSummary,
      dt: dtSeconds,
      gravityMPerS2: gravity,
      boxDimsM: dims,
      cflFactor,
      preferWebGpu,
      device: resolvedDevice,
      sphParticleUpload,
      mlsMpmParticleUpload,
      sourceSlot,
      pressureInterfaceForceSolver: null,
      internalPressureScale: 0,
      stageTiming
    }));
    const stageTaskEvidence = {
      p2g: p2gGridProjection?.mechanicsP2gStageTaskEvidence || null,
      gridUpdate: gridUpdate?.mechanicsGridUpdateStageTaskEvidence || null,
      g2p: g2pReconstruction?.mechanicsG2pStageTaskEvidence || null
    };
    const stageTaskBoundaries = {
      p2g: stageTaskEvidence.p2g?.passed === true,
      gridUpdate: stageTaskEvidence.gridUpdate?.passed === true,
      g2p: stageTaskEvidence.g2p?.passed === true
    };
    step.mechanicsOnlySplitPath = {
      schema: 'peercompute.ulg.mls-mpm-mechanics-only-split-step.v0',
      status: 'mechanics-only-direct-step-executed',
      source: 'runMlsMpmMechanicsOnlyResidentStepWithOptionalWebGpu',
      requiredStages: ['p2g', 'gridUpdate', 'g2p'],
      disabledLawStages: ['thermal', 'reaction', 'mechanicsRefresh', 'pressure-interface'],
      authoritativeWriteFamilies: ['particle-kinematics', 'mechanics'],
      stageTaskBoundaries,
      stageTaskEvidence,
      suppressesPressureInterfaceForces: true,
      scientificValidation: false,
      fullPhysicsValidation: false
    };
    step.mechanicsOnlyStageTaskBoundaries = stageTaskBoundaries;
    if (gpuResidentLaneLease) {
      const queueEvidence = queueEvidenceFromResidentStep(step);
      const gpuResidentLaneExecution = completeResidentGpuLaneLease(gpuResidentLaneManager, gpuResidentLaneLease.leaseId, {
        status: queueEvidence.status,
        method: queueEvidence.method,
        queueCompletionStatus: queueEvidence.status,
        queueCompletionMethod: queueEvidence.method,
        retainedBufferRefs: retainedBufferRefsFromResidentStep(step),
        completed: queueEvidence.fenceSatisfied === true ? true : undefined,
        source: 'ulg-mls-mpm-mechanics-only-step'
      });
      attachResidentGpuLaneExecution(step, {
        lease: gpuResidentLaneLease,
        execution: gpuResidentLaneExecution
      });
    }
    return step;
  } catch (error) {
    if (gpuResidentLaneLease) {
      rejectResidentGpuLaneLease(gpuResidentLaneManager, gpuResidentLaneLease.leaseId, 'mechanics-only-step-error');
    }
    throw error;
  }
}

export function destroyMlsMpmResidentStepBuffers(step, {
  preserveResidentProductMass = null,
  preserveResidentProductMassHandles = [],
  destroyInputResidentProductMass = false,
  preserveBuffers = []
} = {}) {
  const preserved = new Set((preserveBuffers || []).filter(Boolean));
  const released = new Set();
  const releaseRetainedOutputBuffers = (output, buffers) => {
    const retainedBuffers = (buffers || []).filter(Boolean);
    if (!retainedBuffers.length || typeof output?.destroyOutputParticleBuffers !== 'function') return false;
    if (retainedBuffers.some((buffer) => preserved.has(buffer))) return false;
    output.destroyOutputParticleBuffers();
    for (const buffer of retainedBuffers) released.add(buffer);
    return true;
  };
  const destroyUnlessPreserved = (buffer) => {
    if (!buffer || preserved.has(buffer) || released.has(buffer)) return;
    buffer.destroy?.();
  };
  const destroySphUploadUnlessPreserved = (upload) => {
    if (!upload) return;
    if (upload.ownsStateBuffer !== false) destroyUnlessPreserved(upload.stateBuffer);
    if (upload.ownsThermoBuffer !== false) destroyUnlessPreserved(upload.thermoBuffer);
  };
  const destroyMlsUploadUnlessPreserved = (upload) => {
    if (!upload || upload.ownsMechanicsBuffer === false) return;
    destroyUnlessPreserved(upload.mechanicsBuffer);
  };
  const activeGridPlanHint = step?.residentActiveGridDispatchPlanHint
    || step?.nextParticleUploads?.activeGridDispatchPlanHint
    || null;
  const activeGridPlanBuffers = activeGridDispatchPlanBuffers(activeGridPlanHint);
  if (!activeGridPlanBuffers.some((buffer) => preserved.has(buffer))) {
    if (activeGridPlanHint?.destroyActiveGridDispatchPlanBuffers) {
      activeGridPlanHint.destroyActiveGridDispatchPlanBuffers();
    } else {
      step?.compactGpuSummary?.destroyActiveGridDispatchPlanBuffers?.();
    }
  }
  destroyUnlessPreserved(step?.p2gGridProjection?.gpuResult?.gridBuffer);
  destroyUnlessPreserved(step?.p2gGridProjection?.gridBuffer);
  destroyUnlessPreserved(step?.gridUpdate?.gpuResult?.updatedGridBuffer);
  destroyUnlessPreserved(step?.gridUpdate?.updatedGridBuffer);
  if (step?.nextParticleUploads) {
    const usedStateBuffer = step.nextParticleUploads.sphParticleUpload?.stateBuffer || null;
    const usedThermoBuffer = step.nextParticleUploads.sphParticleUpload?.thermoBuffer || null;
    const usedMechanicsBuffer = step.nextParticleUploads.mlsMpmParticleUpload?.mechanicsBuffer || null;
    const g2pOutput = retainedG2pOutputBuffers(step.g2pReconstruction);
    const thermalOutput = retainedThermalOutputBuffers(step.thermalStep);
    const reactionOutput = retainedReactionOutputBuffers(step.reactionStep);
    const mechanicsRefreshOutput = retainedMechanicsRefreshOutputBuffers(step.mechanicsRefreshStep);
    releaseRetainedOutputBuffers(thermalOutput, [thermalOutput.stateBuffer, thermalOutput.thermoBuffer]);
    destroySphUploadUnlessPreserved(step.nextParticleUploads.sphParticleUpload);
    destroyMlsUploadUnlessPreserved(step.nextParticleUploads.mlsMpmParticleUpload);
    if (g2pOutput.stateBuffer && g2pOutput.stateBuffer !== usedStateBuffer) destroyUnlessPreserved(g2pOutput.stateBuffer);
    if (g2pOutput.mechanicsBuffer && g2pOutput.mechanicsBuffer !== usedMechanicsBuffer) destroyUnlessPreserved(g2pOutput.mechanicsBuffer);
    if (thermalOutput.stateBuffer && thermalOutput.stateBuffer !== usedStateBuffer) destroyUnlessPreserved(thermalOutput.stateBuffer);
    if (thermalOutput.thermoBuffer && thermalOutput.thermoBuffer !== usedThermoBuffer) destroyUnlessPreserved(thermalOutput.thermoBuffer);
    if (reactionOutput.stateBuffer && reactionOutput.stateBuffer !== usedStateBuffer) destroyUnlessPreserved(reactionOutput.stateBuffer);
    if (reactionOutput.thermoBuffer && reactionOutput.thermoBuffer !== usedThermoBuffer) destroyUnlessPreserved(reactionOutput.thermoBuffer);
    if (reactionOutput.mechanicsBuffer && reactionOutput.mechanicsBuffer !== usedMechanicsBuffer) destroyUnlessPreserved(reactionOutput.mechanicsBuffer);
    if (mechanicsRefreshOutput.mechanicsBuffer && mechanicsRefreshOutput.mechanicsBuffer !== usedMechanicsBuffer) destroyUnlessPreserved(mechanicsRefreshOutput.mechanicsBuffer);
    destroyResidentProductMassFromStep(step, {
      preserveResidentProductMass,
      preserveResidentProductMassHandles,
      destroyInputResidentProductMass,
      preserveBuffers
    });
  } else if (step?.g2pReconstruction?.destroyOutputParticleBuffers) {
    step.g2pReconstruction.destroyOutputParticleBuffers();
  } else if (step?.reactionStep?.destroyOutputParticleBuffers) {
    step.reactionStep.destroyOutputParticleBuffers();
  } else if (step?.mechanicsRefreshStep?.destroyOutputParticleBuffers) {
    step.mechanicsRefreshStep.destroyOutputParticleBuffers();
  } else if (step?.thermalStep?.destroyOutputParticleBuffers) {
    step.thermalStep.destroyOutputParticleBuffers();
  } else {
    step?.g2pReconstruction?.gpuResult?.destroyOutputParticleBuffers?.();
  }
}

function retainedContinuationBuffersFromUploads(nextParticleUploads = null) {
  return [
    nextParticleUploads?.sphParticleUpload?.stateBuffer,
    nextParticleUploads?.sphParticleUpload?.thermoBuffer,
    nextParticleUploads?.mlsMpmParticleUpload?.mechanicsBuffer,
    ...activeGridDispatchPlanBuffers(nextParticleUploads?.activeGridDispatchPlanHint)
  ].filter(Boolean);
}

function cloneSphParticleStateForNext(source, step) {
  const noFullReadback = step.readbackMode === NO_FULL_READBACK_MODE;
  const reactionResult = step.reactionStep?.result || step.reactionStep;
  const thermalResult = step.thermalStep?.result || step.thermalStep;
  const activeGridDispatch = step.stageTiming?.activeGridDispatch
    || step.fusedResidentSequence?.activeGridDispatch
    || step.gridUpdate?.activeGridDispatch
    || step.p2gGridProjection?.activeGridDispatch
    || null;
  const continuationBounds = residentBoundsContinuationFromStep(step, activeGridDispatch, source);
  const residentMaxSpeedMPerS = continuationBounds.maxSpeedMPerS
    ?? activeGridDispatch?.maxSpeedMPerS
    ?? source.residentMaxSpeedMPerS
    ?? null;
  return {
    ...source,
    status: noFullReadback ? 'gpu-resident-unread-ready' : 'gpu-resident-readback-ready',
    step: step.particlePingPong?.nextStep ?? ((source.step ?? 0) + 1),
    time: step.particlePingPong?.nextTime ?? ((source.time ?? 0) + (step.dt ?? 0)),
    state: noFullReadback ? source.state : (reactionResult?.state?.length ? reactionResult.state : (thermalResult?.state?.length ? thermalResult.state : step.state)),
    cpuStateStale: noFullReadback,
    thermo: noFullReadback ? source.thermo : (reactionResult?.thermo?.length ? reactionResult.thermo : (thermalResult?.thermo?.length ? thermalResult.thermo : source.thermo)),
    residentPositionBoundsM: continuationBounds.boundsM,
    residentMaxSpeedMPerS,
    residentPositionBoundsSource: continuationBounds.source,
    residentActiveGridDispatchHint: step.residentActiveGridDispatchHint
      || activeGridDispatch
      || source.residentActiveGridDispatchHint
      || null,
    residentActiveGridDispatchPlanHint: step.residentActiveGridDispatchPlanHint
      || step.nextParticleUploads?.activeGridDispatchPlanHint
      || null
  };
}

function cloneMlsMpmParticleStateForNext(source, step) {
  const noFullReadback = step.readbackMode === NO_FULL_READBACK_MODE;
  const reactionResult = step.reactionStep?.result || step.reactionStep;
  return {
    ...source,
    status: noFullReadback ? 'gpu-resident-unread-ready' : 'gpu-resident-readback-ready',
    step: step.particlePingPong?.nextStep ?? ((source.step ?? 0) + 1),
    time: step.particlePingPong?.nextTime ?? ((source.time ?? 0) + (step.dt ?? 0)),
    mechanics: noFullReadback ? source.mechanics : (reactionResult?.mechanics?.length ? reactionResult.mechanics : step.mechanics),
    cpuStateStale: noFullReadback
  };
}

function compactResidentAuthorityFamilyOwners(familyOwners = {}) {
  return Object.fromEntries(
    Object.entries(familyOwners || {}).map(([family, owner]) => [family, {
      family,
      ownerStage: owner?.ownerStage ?? null,
      status: owner?.status ?? null,
      mutationMode: owner?.mutationMode ?? null,
      backend: owner?.backend ?? null,
      validationStatus: owner?.validationStatus ?? null,
      source: owner?.source ?? null,
      reads: [...(owner?.reads || [])],
      writes: [...(owner?.writes || [])],
      nextConsumers: [...(owner?.nextConsumers || [])]
    }])
  );
}

function summarizeResidentStepForSequence(step, index) {
  const compactSummaryPresent = Boolean(
    step.compactGpuSummary
    || step.diagnostics?.compactGpuSummaryStatus
    || step.diagnostics?.compactGpuSummaryAvailable
  );
  return {
    index,
    backend: step.backend,
    status: step.status,
    stageStatus: { ...step.stageStatus },
    stageBackends: { ...step.stageBackends },
    residentAuthorityLedgerStatus: step.residentAuthorityLedgerStatus ?? null,
    residentAuthorityFamilyOwners: compactResidentAuthorityFamilyOwners(
      step.residentAuthorityFamilyOwners || step.residentAuthoritySummary?.familyOwners
    ),
    residentAuthorityWarnings: [...(step.residentAuthorityWarnings || [])],
    residentAuthorityBlockers: [...(step.residentAuthorityBlockers || [])],
    residentBufferLeaseLedgerStatus: step.residentBufferLeaseLedgerStatus ?? null,
    residentBufferLeaseResourceCount: step.residentBufferLeaseResourceCount ?? 0,
    residentBufferLeaseActiveLeaseCount: step.residentBufferLeaseActiveLeaseCount ?? 0,
    residentBufferLeaseWarnings: [...(step.residentBufferLeaseWarnings || [])],
    residentBufferLeaseBlockers: [...(step.residentBufferLeaseBlockers || [])],
    gpuResidentLaneStatus: step.gpuResidentLaneStatus ?? null,
    gpuResidentLaneLeaseId: step.gpuResidentLaneLeaseId ?? null,
    gpuResidentLaneFenceStatus: step.gpuResidentLaneFenceStatus ?? null,
    gpuResidentLaneFenceSatisfied: step.gpuResidentLaneFenceSatisfied === true,
    gpuResidentLaneRetainedBufferRefs: [...(step.gpuResidentLaneRetainedBufferRefs || [])],
    stageTiming: step.stageTiming
      ? {
          schema: step.stageTiming.schema,
          totalMs: step.stageTiming.totalMs,
          stageMs: { ...(step.stageTiming.stageMs || {}) },
          backend: step.stageTiming.backend || step.backend,
          readbackMode: step.stageTiming.readbackMode || step.readbackMode,
          dispatchTopology: step.stageTiming.dispatchTopology || step.dispatchTopology || null,
          activeGridDispatch: step.stageTiming.activeGridDispatch || null,
          activeGridIndirectDispatch: step.stageTiming.activeGridIndirectDispatch || null,
          activeGridDispatchPlanOnlyRequested: step.stageTiming.activeGridDispatchPlanOnlyRequested ?? null,
          activeGridDispatchPlanOnlyEligible: step.stageTiming.activeGridDispatchPlanOnlyEligible ?? null,
          activeGridDispatchPlanRefreshMode: step.stageTiming.activeGridDispatchPlanRefreshMode ?? null,
          activeGridDispatchPlanRefreshRequested: step.stageTiming.activeGridDispatchPlanRefreshRequested ?? null,
          activeGridDispatchPlanRefreshFinalStep: step.stageTiming.activeGridDispatchPlanRefreshFinalStep ?? null,
          activeGridDispatchPlanRefreshSkippedReason: step.stageTiming.activeGridDispatchPlanRefreshSkippedReason ?? null,
          compactSummaryScope: step.stageTiming.compactSummaryScope ?? null
        }
      : null,
    residentBuffersRetained: step.residentBuffersRetained,
    stageBuffersRetained: step.stageBuffersRetained,
    g2pOutputBuffersRetained: step.g2pOutputBuffersRetained,
    thermalStepRetained: Boolean(step.thermalStep?.retainedOutputParticleBuffers || step.thermalStep?.result?.retainedOutputParticleBuffers),
    reactionStepRetained: Boolean(step.reactionStep?.retainedOutputParticleBuffers || step.reactionStep?.result?.retainedOutputParticleBuffers),
    mechanicsRefreshStepRetained: Boolean(step.mechanicsRefreshStep?.retainedOutputParticleBuffers || step.mechanicsRefreshStep?.result?.retainedOutputParticleBuffers),
    thermalMechanicsRefreshStatus: step.thermalMechanicsRefreshStatus ?? null,
    compactSummaryAuthority: compactSummaryPresent ? 'diagnostic-only-unless-state-manager-admitted' : null,
    compactSummaryAdmissionStatus: compactSummaryPresent ? 'not-admitted-diagnostic-only' : null,
    compactSummaryAuthoritativeMutation: false,
    residentProductMassStatus: step.residentProductMassStatus ?? null,
    residentProductMassBufferRetained: step.residentProductMassBufferRetained ?? false,
    residentProductMassBufferByteLength: step.residentProductMassBufferByteLength ?? 0,
    residentProductMassProductEventRowCount: step.residentProductMassProductEventRowCount ?? 0,
    residentProductMassUnplacedProductMassKg: step.residentProductMassUnplacedProductMassKg ?? null,
    residentProductMassUnplacedGasProductMassKg: step.residentProductMassUnplacedGasProductMassKg ?? null,
    residentProductMassGasSpeciesLedgerCount: step.residentProductMassGasSpeciesLedgerCount ?? 0,
    residentProductMassSealedBoxGasProductMoles: step.residentProductMassSealedBoxGasProductMoles ?? null,
    residentProductMassEosCouplingStatus: step.residentProductMassEosCouplingStatus ?? null,
    residentProductMassMergeStatus: step.residentProductMassMergeStatus ?? null,
    residentProductMassMergeQueueCompletionStatus: step.residentProductMassMergeQueueCompletionStatus ?? null,
    residentProductMassMergeQueueCompletionMethod: step.residentProductMassMergeQueueCompletionMethod ?? null,
    residentProductMassGenerationCount: step.residentProductMassGenerationCount ?? 0,
    inputResidentProductMassProductEventRowCount: step.inputResidentProductMassProductEventRowCount ?? 0,
    emittedResidentProductMassProductEventRowCount: step.emittedResidentProductMassProductEventRowCount ?? 0,
    mergedResidentProductMassProductEventRowCount: step.mergedResidentProductMassProductEventRowCount ?? 0,
    residentProductMassMergedBufferByteLength: step.residentProductMassMergedBufferByteLength ?? 0,
    residentProductMassMergedInputBufferRetained: step.residentProductMassMergedInputBufferRetained ?? false,
    residentProductMassMergedEmittedBufferRetained: step.residentProductMassMergedEmittedBufferRetained ?? false,
    pressureInterfaceForceSolverSchema: step.pressureInterfaceForceSolverSchema ?? null,
    pressureInterfaceForceSolverStatus: step.pressureInterfaceForceSolverStatus ?? null,
    pressureInterfaceForceCouplingStatus: step.pressureInterfaceForceCouplingStatus ?? null,
    pressureInterfaceForceApplicationStatus: step.pressureInterfaceForceApplicationStatus ?? null,
    pressureInterfaceGridForceAdmissionSchema: step.pressureInterfaceGridForceAdmissionSchema ?? null,
    pressureInterfaceGridForceAdmissionStatus: step.pressureInterfaceGridForceAdmissionStatus ?? null,
    pressureInterfaceGridForceAdmissionApproved: step.pressureInterfaceGridForceAdmissionApproved ?? false,
    pressureInterfaceGridForceAdmissionDescriptorStatus: step.pressureInterfaceGridForceAdmissionDescriptorStatus ?? null,
    pressureInterfaceGridForceAdmissionSourceHotBufferKey: step.pressureInterfaceGridForceAdmissionSourceHotBufferKey ?? null,
    pressureInterfaceForceRowCount: step.pressureInterfaceForceRowCount ?? 0,
    pressureInterfaceAppliedImpulseNSeconds: [...(step.pressureInterfaceAppliedImpulseNSeconds ?? [0, 0, 0])],
    pressureInterfaceAppliedImpulseMagnitudeNSeconds: step.pressureInterfaceAppliedImpulseMagnitudeNSeconds ?? 0,
    pressureInterfaceAppliedImpulseSource: step.pressureInterfaceAppliedImpulseSource ?? null,
    pressureInterfaceImpulseProofStatus: step.pressureInterfaceImpulseProofStatus ?? null,
    pressureInterfaceForceConsumerStatus: step.pressureInterfaceForceConsumerStatus ?? null,
    internalPressureScale: step.internalPressureScale ?? null,
    nextParticleBufferMode: step.nextParticleBufferMode,
    particlePingPong: { ...step.particlePingPong },
    diagnostics: {
      particleCount: step.diagnostics?.particleCount ?? 0,
      gridNodeCount: step.diagnostics?.gridNodeCount ?? 0,
      dispatchTopologyStatus: step.diagnostics?.dispatchTopologyStatus ?? null,
      p2gBackendPolicyStatus: step.diagnostics?.p2gBackendPolicyStatus ?? null,
      p2gBackendRequested: step.diagnostics?.p2gBackendRequested ?? null,
      p2gBackendEffective: step.diagnostics?.p2gBackendEffective ?? null,
      p2gBackendFallbackReason: step.diagnostics?.p2gBackendFallbackReason ?? null,
      cpuParticleLoopInHotPath: step.diagnostics?.cpuParticleLoopInHotPath ?? null,
      particleParallelStages: [...(step.diagnostics?.particleParallelStages || [])],
      dispatchesPerSubstep: step.diagnostics?.dispatchesPerSubstep ?? null,
      totalDispatches: step.diagnostics?.totalDispatches ?? null,
      activeGridNodeCount: step.diagnostics?.activeGridNodeCount ?? null,
      activeGridNodeCountAvailable: step.diagnostics?.activeGridNodeCountAvailable ?? null,
      activeGridNodeSummaryStatus: step.diagnostics?.activeGridNodeSummaryStatus ?? null,
      gridNodeScanCount: step.diagnostics?.gridNodeScanCount ?? null,
      gridNodeScanSkipped: step.diagnostics?.gridNodeScanSkipped === true,
      massDeltaKg: step.diagnostics?.massDeltaKg ?? null,
      sourceCenterOfMassM: step.diagnostics?.sourceCenterOfMassM ?? null,
      nextCenterOfMassM: step.diagnostics?.nextCenterOfMassM ?? null,
      centerOfMassDeltaM: step.diagnostics?.centerOfMassDeltaM ?? null,
      sourcePositionBoundsM: step.diagnostics?.sourcePositionBoundsM ?? null,
      nextPositionBoundsM: step.diagnostics?.nextPositionBoundsM ?? null,
      maxSpeedMPerS: step.diagnostics?.maxSpeedMPerS ?? null,
      maxDisplacementM: step.diagnostics?.maxDisplacementM ?? null,
      particleScaleStability: step.diagnostics?.particleScaleStability ?? null,
      particleScaleStabilitySchema: step.diagnostics?.particleScaleStabilitySchema ?? null,
      particleScaleStabilityStatus: step.diagnostics?.particleScaleStabilityStatus ?? null,
      particleScalePolicyAppliedInG2p: step.diagnostics?.particleScalePolicyAppliedInG2p === true,
      particleScalePolicyAppliedInShader: step.diagnostics?.particleScalePolicyAppliedInShader === true,
      particleScaleMaxRadiusGrowthRatioAllowed: step.diagnostics?.particleScaleMaxRadiusGrowthRatioAllowed ?? null,
      particleScaleMaxVolumeRatioJAllowed: step.diagnostics?.particleScaleMaxVolumeRatioJAllowed ?? null,
      particleScaleCapCountKnown: step.diagnostics?.particleScaleCapCountKnown === true,
      particleScaleCapCount: step.diagnostics?.particleScaleCapCount ?? null,
      particleScaleMaxRawVolumeRatioJ: step.diagnostics?.particleScaleMaxRawVolumeRatioJ ?? null,
      particleScaleMaxEffectiveVolumeRatioJ: step.diagnostics?.particleScaleMaxEffectiveVolumeRatioJ ?? null,
      compactGpuSummaryAvailable: step.diagnostics?.compactGpuSummaryAvailable ?? false,
      compactGpuSummaryStatus: step.diagnostics?.compactGpuSummaryStatus ?? null,
      compactSummaryScope: step.diagnostics?.compactSummaryScope ?? null,
      reactionSummaryAvailable: step.diagnostics?.reactionSummaryAvailable ?? false,
      internalPressureScale: step.diagnostics?.internalPressureScale ?? null,
      reactionSummaryStatus: step.diagnostics?.reactionSummaryStatus ?? null,
      reactionCanonicalEventCount: step.diagnostics?.reactionCanonicalEventCount ?? null,
      reactionConsumedReactantMassKg: step.diagnostics?.reactionConsumedReactantMassKg ?? null,
      reactionLedgerVisibleProductMassKg: step.diagnostics?.reactionLedgerVisibleProductMassKg ?? null,
      reactionLedgerUnplacedProductMassKg: step.diagnostics?.reactionLedgerUnplacedProductMassKg ?? null,
      reactionLedgerGasProductMassKg: step.diagnostics?.reactionLedgerGasProductMassKg ?? null,
      reactionLedgerVisibleGasProductMassKg: step.diagnostics?.reactionLedgerVisibleGasProductMassKg ?? null,
      reactionLedgerUnplacedGasProductMassKg: step.diagnostics?.reactionLedgerUnplacedGasProductMassKg ?? null,
      reactionSealedBoxGasProductMoles: step.diagnostics?.reactionSealedBoxGasProductMoles ?? null,
      reactionHeatJ: step.diagnostics?.reactionHeatJ ?? null,
      reactionLedgerMassResidualKg: step.diagnostics?.reactionLedgerMassResidualKg ?? null,
      reactionCompactLedgerAvailable: step.diagnostics?.reactionCompactLedgerAvailable ?? false,
      reactionProposalNeighborMode: step.diagnostics?.reactionProposalNeighborMode ?? null,
      reactionParticleBinGridSchema: step.diagnostics?.reactionParticleBinGridSchema ?? null,
      reactionParticleBinGridStatus: step.diagnostics?.reactionParticleBinGridStatus ?? null,
      reactionParticleBinGridReason: step.diagnostics?.reactionParticleBinGridReason ?? null,
      reactionParticleBinGridEnabled: step.diagnostics?.reactionParticleBinGridEnabled === true,
      reactionParticleBinGridBoundsSource: step.diagnostics?.reactionParticleBinGridBoundsSource ?? null,
      reactionParticleBinGridDims: step.diagnostics?.reactionParticleBinGridDims
        ? [...step.diagnostics.reactionParticleBinGridDims]
        : null,
      reactionParticleBinGridCellCount: step.diagnostics?.reactionParticleBinGridCellCount ?? 0,
      reactionParticleBinGridCellSizeM: step.diagnostics?.reactionParticleBinGridCellSizeM ?? 0,
      reactionParticleBinGridBinCapacity: step.diagnostics?.reactionParticleBinGridBinCapacity ?? 0,
      reactionParticleBinGridAverageOccupancy: step.diagnostics?.reactionParticleBinGridAverageOccupancy ?? 0,
      reactionParticleBinGridEstimatedOverflowRisk: step.diagnostics?.reactionParticleBinGridEstimatedOverflowRisk === true,
      reactionParticleBinGridIndexBufferByteLength: step.diagnostics?.reactionParticleBinGridIndexBufferByteLength ?? 0,
      reactionParticleBinGridMaxContactRadiusM: step.diagnostics?.reactionParticleBinGridMaxContactRadiusM ?? 0,
      reactionParticleBinOverflowStatus: step.diagnostics?.reactionParticleBinOverflowStatus ?? null,
      reactionParticleBinOverflowCount: step.diagnostics?.reactionParticleBinOverflowCount ?? null,
      reactionParticleBinOverflowMetadataReadbackRequested:
        step.diagnostics?.reactionParticleBinOverflowMetadataReadbackRequested === true,
      reactionProductInventoryCount: step.diagnostics?.reactionProductInventoryCount ?? 0,
      reactionProductInventoryReadbackByteLength: step.diagnostics?.reactionProductInventoryReadbackByteLength ?? 0,
      reactionProductEventRowCount: step.diagnostics?.reactionProductEventRowCount ?? 0,
      reactionProductEventActiveEventCount: step.diagnostics?.reactionProductEventActiveEventCount ?? 0,
      reactionProductEventReadbackByteLength: step.diagnostics?.reactionProductEventReadbackByteLength ?? 0,
      reactionProductEventBufferByteLength: step.diagnostics?.reactionProductEventBufferByteLength ?? 0,
      reactionProductEventBufferRetained: step.diagnostics?.reactionProductEventBufferRetained ?? false,
      reactionResidentProductMassStatus: step.diagnostics?.reactionResidentProductMassStatus ?? null,
      reactionResidentProductMassBufferRetained: step.diagnostics?.reactionResidentProductMassBufferRetained ?? false,
      reactionResidentProductMassBufferByteLength: step.diagnostics?.reactionResidentProductMassBufferByteLength ?? 0,
      reactionResidentProductMassProductEventRowCount: step.diagnostics?.reactionResidentProductMassProductEventRowCount ?? 0,
      reactionResidentProductMassUnplacedProductMassKg: step.diagnostics?.reactionResidentProductMassUnplacedProductMassKg ?? null,
      reactionResidentProductMassUnplacedGasProductMassKg: step.diagnostics?.reactionResidentProductMassUnplacedGasProductMassKg ?? null,
      reactionResidentProductMassEosCouplingStatus: step.diagnostics?.reactionResidentProductMassEosCouplingStatus ?? null,
	      reactionAtomResidualCount: step.diagnostics?.reactionAtomResidualCount ?? 0,
      reactionAtomResidualReadbackByteLength: step.diagnostics?.reactionAtomResidualReadbackByteLength ?? 0,
      reactionStrictGateStatus: step.diagnostics?.reactionStrictGateStatus ?? null,
      reactionStrictGateBlockers: [...(step.diagnostics?.reactionStrictGateBlockers || [])],
      reactionGasSpeciesLedgerCount: step.diagnostics?.reactionGasSpeciesLedgerCount ?? 0,
      reactionGasSpeciesReadbackByteLength: step.diagnostics?.reactionGasSpeciesReadbackByteLength ?? 0,
      pressureInterfaceForceSolverSchema: step.diagnostics?.pressureInterfaceForceSolverSchema ?? null,
      pressureInterfaceForceSolverStatus: step.diagnostics?.pressureInterfaceForceSolverStatus ?? null,
      pressureInterfaceForceCouplingStatus: step.diagnostics?.pressureInterfaceForceCouplingStatus ?? null,
      pressureInterfaceForceApplicationStatus: step.diagnostics?.pressureInterfaceForceApplicationStatus ?? null,
      pressureInterfaceGridForceAdmissionSchema: step.diagnostics?.pressureInterfaceGridForceAdmissionSchema ?? null,
      pressureInterfaceGridForceAdmissionStatus: step.diagnostics?.pressureInterfaceGridForceAdmissionStatus ?? null,
      pressureInterfaceGridForceAdmissionApproved: step.diagnostics?.pressureInterfaceGridForceAdmissionApproved ?? false,
      pressureInterfaceGridForceAdmissionDescriptorStatus: step.diagnostics?.pressureInterfaceGridForceAdmissionDescriptorStatus ?? null,
      pressureInterfaceGridForceAdmissionSourceHotBufferKey: step.diagnostics?.pressureInterfaceGridForceAdmissionSourceHotBufferKey ?? null,
      pressureInterfaceForceRowCount: step.diagnostics?.pressureInterfaceForceRowCount ?? 0,
      pressureInterfaceAppliedImpulseNSeconds: [...(step.diagnostics?.pressureInterfaceAppliedImpulseNSeconds ?? [0, 0, 0])],
      pressureInterfaceAppliedImpulseMagnitudeNSeconds: step.diagnostics?.pressureInterfaceAppliedImpulseMagnitudeNSeconds ?? 0,
      pressureInterfaceAppliedImpulseSource: step.diagnostics?.pressureInterfaceAppliedImpulseSource ?? null,
      pressureInterfaceImpulseProofStatus: step.diagnostics?.pressureInterfaceImpulseProofStatus ?? null,
      pressureInterfaceForceConsumerStatus: step.diagnostics?.pressureInterfaceForceConsumerStatus ?? null,
      residentAuthorityLedgerStatus: step.diagnostics?.residentAuthorityLedgerStatus ?? null,
      residentAuthorityFamilyCount: step.diagnostics?.residentAuthorityFamilyCount ?? 0,
      residentAuthorityWarnings: [...(step.diagnostics?.residentAuthorityWarnings || [])],
      residentAuthorityBlockers: [...(step.diagnostics?.residentAuthorityBlockers || [])],
      residentAuthorityParticleOwner: step.diagnostics?.residentAuthorityParticleOwner ?? null,
      residentAuthorityMechanicsOwner: step.diagnostics?.residentAuthorityMechanicsOwner ?? null,
      residentAuthorityThermoOwner: step.diagnostics?.residentAuthorityThermoOwner ?? null,
      residentBufferLeaseLedgerStatus: step.diagnostics?.residentBufferLeaseLedgerStatus ?? null,
      residentBufferLeaseResourceCount: step.diagnostics?.residentBufferLeaseResourceCount ?? 0,
      residentBufferLeaseActiveLeaseCount: step.diagnostics?.residentBufferLeaseActiveLeaseCount ?? 0,
      residentBufferLeaseWarnings: [...(step.diagnostics?.residentBufferLeaseWarnings || [])],
      residentBufferLeaseBlockers: [...(step.diagnostics?.residentBufferLeaseBlockers || [])],
      gpuResidentLaneStatus: step.diagnostics?.gpuResidentLaneStatus ?? null,
      gpuResidentLaneLeaseId: step.diagnostics?.gpuResidentLaneLeaseId ?? null,
      gpuResidentLaneFenceStatus: step.diagnostics?.gpuResidentLaneFenceStatus ?? null,
      gpuResidentLaneFenceSatisfied: step.diagnostics?.gpuResidentLaneFenceSatisfied === true,
      gpuResidentLaneRetainedBufferRefCount: step.diagnostics?.gpuResidentLaneRetainedBufferRefCount ?? 0
    },
    readbackMode: step.readbackMode,
    normalHotLoopReadbackFree: step.normalHotLoopReadbackFree,
    renderStateReadbackAvailable: step.renderStateReadbackAvailable,
    gpuAuthoritativeState: step.gpuAuthoritativeState,
    fullPhysicsValidation: false
  };
}

export async function runMlsMpmResidentStepsWithOptionalWebGpu({
  stepCount = 1,
  retainIntermediateSteps = false,
  compactSummaryMode = MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_EVERY_STEP,
  compactSummaryScope = MLS_MPM_RESIDENT_SUMMARY_SCOPE_FULL,
  activeGridDispatchPlanRefreshMode = MLS_MPM_ACTIVE_GRID_PLAN_REFRESH_MODE_EVERY_STEP,
  onResidentStageProgress = null,
  ...args
} = {}) {
  const count = Math.max(1, Math.round(finiteNumber(stepCount, 1)));
  const resolvedCompactSummaryMode = normalizeMlsMpmResidentCompactSummaryMode(compactSummaryMode);
  const resolvedCompactSummaryScope = normalizeMlsMpmResidentSummaryScope(compactSummaryScope);
  const resolvedActiveGridDispatchPlanRefreshMode = normalizeMlsMpmActiveGridPlanRefreshMode(
    activeGridDispatchPlanRefreshMode
  );
  let sphParticleState = args.sphParticleState;
  let mlsMpmParticleState = args.mlsMpmParticleState;
  let sphParticleUpload = args.sphParticleUpload ?? null;
  let mlsMpmParticleUpload = args.mlsMpmParticleUpload ?? null;
  let residentProductMass = args.residentProductMass ?? args.nextParticleUploads?.residentProductMass ?? null;
  let sourceSlot = args.sourceSlot ?? sphParticleUpload?.slot ?? 0;
  let finalStep = null;
  const retainedSteps = [];
  const stepSummaries = [];
  const markSequenceProgress = (status, extra = {}) => {
    if (typeof onResidentStageProgress !== 'function') return;
    try {
      onResidentStageProgress({
        schema: 'peercompute.ulg.mls-mpm-resident-sequence-progress.v0',
        status,
        stepCount: count,
        compactSummaryMode: resolvedCompactSummaryMode,
        compactSummaryScope: resolvedCompactSummaryScope,
        activeGridDispatchPlanRefreshMode: resolvedActiveGridDispatchPlanRefreshMode,
        updatedAtMs: nowMs(),
        ...extra
      });
    } catch {
      // Diagnostic progress must never affect the physics sequence.
    }
  };

  markSequenceProgress('resident-sequence-started');

  const requestedReadbackMode = args.readbackMode === NO_FULL_READBACK_MODE ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE;
  const resolvedDevice = args.device || args.deviceResult?.device || null;
  const requestActiveGridFusedNoFullMechanics = Boolean(
    args.fuseNoFullResidentMechanicsActiveGrid || args.fuseNoFullResidentActiveGrid
  );
  const requestPerStepFusedNoFullMechanics = Boolean(
    args.fuseNoFullResidentMechanics
    || (args.fuseNoFullResidentMechanicsSequence && requestActiveGridFusedNoFullMechanics)
  );
  const fusedSequenceCustomRunnerBlockers = [
    args.p2gRunner ? 'custom-p2g-runner' : null,
    args.gridUpdateRunner ? 'custom-grid-update-runner' : null,
    args.g2pRunner ? 'custom-g2p-runner' : null,
    args.p2gStageRunner ? 'custom-p2g-stage-runner' : null,
    args.gridUpdateStageRunner ? 'custom-grid-update-stage-runner' : null,
    args.g2pStageRunner ? 'custom-g2p-stage-runner' : null
  ];
  const fusedResidentSequencePreflight = createFusedResidentSequencePreflight({
    requested: Boolean(args.fuseNoFullResidentMechanicsSequence),
    stepCount: count,
    readbackMode: requestedReadbackMode,
    compactSummaryMode: resolvedCompactSummaryMode,
    preferWebGpu: args.preferWebGpu === true,
    device: resolvedDevice,
    sphParticleUpload,
    mlsMpmParticleUpload,
    requestPerStepFusedNoFullMechanics,
    requestActiveGridFusedNoFullMechanics,
    customRunnerBlockers: fusedSequenceCustomRunnerBlockers,
    sidecarBlockers: fusedResidentSequenceSidecarBlockers({
      thermalMaterialTable: args.thermalMaterialTable,
      reactionTable: args.reactionTable,
      pressureInterfaceForceRowsBuffer: args.pressureInterfaceForceRowsBuffer,
      pressureInterfaceForceSolver: args.pressureInterfaceForceSolver,
      residentProductMass
    })
  });
  const useFusedNoFullResidentMechanicsSequence = fusedResidentSequencePreflight.sequenceRunnable === true;
  if (useFusedNoFullResidentMechanicsSequence) {
    markSequenceProgress('resident-sequence-fused-mechanics-started', {
      stepCount: count
    });
    const finalStep = await runFusedNoFullMlsMpmMechanicsSequenceWebGpu({
      device: resolvedDevice,
      sphParticleState,
      mlsMpmParticleState,
      sphParticleUpload,
      mlsMpmParticleUpload,
      gridSpacingM: args.gridSpacingM,
      boxDimsM: args.boxDimsM,
      dt: args.dt,
      gravityMPerS2: args.gravityMPerS2,
      cflFactor: args.cflFactor,
      internalPressureScale: args.internalPressureScale,
      stepCount: count,
      summaryRunner: compactSummaryModeRequestsReadback(resolvedCompactSummaryMode)
        ? (args.summaryRunner ?? runMlsMpmResidentSummaryWebGpu)
        : null,
      compactSummaryScope: resolvedCompactSummaryScope,
      cohortRanges: args.cohortRanges ?? null,
      sourceSlot,
      preferWebGpu: args.preferWebGpu,
      fuseActiveGrid: Boolean(args.fuseNoFullResidentMechanicsActiveGrid || args.fuseNoFullResidentActiveGrid),
      activeGridSafetyCells: args.fusedActiveGridSafetyCells ?? args.activeGridSafetyCells,
      p2gBackend: args.p2gBackend ?? MLS_MPM_P2G_BACKEND_RESIDENT_SCATTER,
      measureQueueFence: Boolean(
        args.measureFusedSequenceQueueFence
        || args.measureGpuQueueFence
        || args.benchmarkQueueFence
      )
    });
    const nextSphParticleState = cloneSphParticleStateForNext(sphParticleState, finalStep);
    const nextMlsMpmParticleState = cloneMlsMpmParticleStateForNext(mlsMpmParticleState, finalStep);
    finalStep.fusedResidentSequencePreflight = fusedResidentSequencePreflight;
    if (finalStep.stageTiming) {
      finalStep.stageTiming.fusedResidentSequencePreflight = fusedResidentSequencePreflight;
    }
    const stepSummaries = Array.from({ length: count }, (_, index) => {
      const summary = summarizeResidentStepForSequence(finalStep, index);
      summary.status = index === count - 1
        ? finalStep.status
        : 'resident-step-fused-sequence-intermediate';
      summary.fusedResidentSequence = true;
      summary.fusedResidentSequenceStepCount = count;
      summary.compactSummaryMode = resolvedCompactSummaryMode;
      summary.compactSummaryAvailable = compactSummaryModeRequestsReadback(resolvedCompactSummaryMode)
        && index === count - 1;
      return summary;
    });
    markSequenceProgress('resident-sequence-fused-mechanics-complete', {
      completedStepCount: count,
      backend: finalStep.backend,
      stageTiming: finalStep.stageTiming || null
    });
    return {
      schema: ULG_MLS_MPM_GPU_RESIDENT_STEPS_EXECUTION_SCHEMA,
      backend: finalStep.backend || 'webgpu',
      status: 'resident-steps-executed',
      stepCount: count,
      completedStepCount: count,
      compactSummaryMode: resolvedCompactSummaryMode,
      compactSummaryScope: resolvedCompactSummaryScope,
      activeGridDispatchPlanRefreshMode: resolvedActiveGridDispatchPlanRefreshMode,
      retainIntermediateSteps,
      retainedIntermediateStepCount: 0,
      retainedSteps,
      finalStep,
      stepSummaries,
      nextSphParticleState,
      nextMlsMpmParticleState,
      nextParticleUploads: finalStep.nextParticleUploads ?? null,
      nextResidentProductMass: null,
      nextParticleBufferMode: finalStep.nextParticleBufferMode ?? 'not-available',
      readbackMode: finalStep.readbackMode ?? NO_FULL_READBACK_MODE,
      normalHotLoopReadbackFree: Boolean(finalStep.normalHotLoopReadbackFree),
      renderStateReadbackAvailable: finalStep.renderStateReadbackAvailable ?? false,
      residentAuthorityLedgerStatus: finalStep.residentAuthorityLedgerStatus ?? null,
      residentAuthorityFamilyOwners: compactResidentAuthorityFamilyOwners(
        finalStep.residentAuthorityFamilyOwners || finalStep.residentAuthoritySummary?.familyOwners
      ),
      residentAuthorityWarnings: [...(finalStep.residentAuthorityWarnings || [])],
      residentAuthorityBlockers: [...(finalStep.residentAuthorityBlockers || [])],
      residentBufferLeaseLedgerStatus: finalStep.residentBufferLeaseLedgerStatus ?? null,
      residentBufferLeaseResourceCount: finalStep.residentBufferLeaseResourceCount ?? 0,
      residentBufferLeaseActiveLeaseCount: finalStep.residentBufferLeaseActiveLeaseCount ?? 0,
      residentBufferLeaseWarnings: [...(finalStep.residentBufferLeaseWarnings || [])],
      residentBufferLeaseBlockers: [...(finalStep.residentBufferLeaseBlockers || [])],
      fusedResidentSequence: finalStep.fusedResidentSequence,
      fusedResidentSequencePreflight,
      gpuAuthoritativeState: false,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  }

  for (let index = 0; index < count; index += 1) {
    const summarizeStep = compactSummaryModeRequestsReadback(resolvedCompactSummaryMode)
      && (resolvedCompactSummaryMode !== MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_FINAL_ONLY || index === count - 1);
    markSequenceProgress('resident-sequence-step-started', {
      stepIndex: index,
      summarizeStep
    });
    const stepArgs = {
      ...args,
      sphParticleState,
      mlsMpmParticleState,
      sphParticleUpload,
      mlsMpmParticleUpload,
      residentProductMass,
      sourceSlot,
      compactSummaryScope: resolvedCompactSummaryScope,
      fuseNoFullResidentMechanics: requestPerStepFusedNoFullMechanics,
      activeGridDispatchPlanRefreshMode: resolvedActiveGridDispatchPlanRefreshMode,
      sequenceIndex: index,
      sequenceStepCount: count,
      onResidentStageProgress(progress = {}) {
        markSequenceProgress(progress.status || 'resident-stage-progress', {
          ...progress,
          stepIndex: progress.stepIndex ?? progress.sequenceIndex ?? index,
          summarizeStep
        });
      }
    };
    if (!summarizeStep) stepArgs.summaryRunner = null;
    const step = await runMlsMpmResidentStepWithOptionalWebGpu(stepArgs);
    step.sequenceIndex = index;
    stepSummaries.push(summarizeResidentStepForSequence(step, index));
    markSequenceProgress('resident-sequence-step-complete', {
      stepIndex: index,
      summarizeStep,
      backend: step.backend,
      stageTiming: step.stageTiming || null
    });
    const carriedResidentProductMass = step.nextParticleUploads?.residentProductMass ?? step.residentProductMass ?? null;
    if (finalStep && !retainIntermediateSteps) {
      destroyMlsMpmResidentStepBuffers(finalStep, {
        preserveResidentProductMass: carriedResidentProductMass,
        preserveResidentProductMassHandles: [
          step.inputResidentProductMass,
          step.emittedResidentProductMass,
          carriedResidentProductMass
        ].filter(Boolean),
        destroyInputResidentProductMass: true,
        preserveBuffers: retainedContinuationBuffersFromUploads(step.nextParticleUploads)
      });
    } else if (finalStep) {
      retainedSteps.push(finalStep);
    }
    finalStep = step;
    sphParticleState = cloneSphParticleStateForNext(sphParticleState, step);
    mlsMpmParticleState = cloneMlsMpmParticleStateForNext(mlsMpmParticleState, step);
    sphParticleUpload = step.nextParticleUploads?.sphParticleUpload ?? null;
    mlsMpmParticleUpload = step.nextParticleUploads?.mlsMpmParticleUpload ?? null;
    residentProductMass = carriedResidentProductMass;
    sourceSlot = step.particlePingPong?.nextSlot ?? (sourceSlot === 0 ? 1 : 0);
  }

  markSequenceProgress('resident-sequence-complete', {
    completedStepCount: stepSummaries.length,
    backend: finalStep?.backend || 'cpu-reference'
  });
  if (finalStep && fusedResidentSequencePreflight.sequenceRequested) {
    finalStep.fusedResidentSequencePreflight = fusedResidentSequencePreflight;
    if (finalStep.stageTiming) {
      finalStep.stageTiming.fusedResidentSequencePreflight = fusedResidentSequencePreflight;
    }
  }

  return {
    schema: ULG_MLS_MPM_GPU_RESIDENT_STEPS_EXECUTION_SCHEMA,
    backend: finalStep?.backend || 'cpu-reference',
    status: 'resident-steps-executed',
    stepCount: count,
    completedStepCount: stepSummaries.length,
    compactSummaryMode: resolvedCompactSummaryMode,
    compactSummaryScope: resolvedCompactSummaryScope,
    activeGridDispatchPlanRefreshMode: resolvedActiveGridDispatchPlanRefreshMode,
    retainIntermediateSteps,
    retainedIntermediateStepCount: retainedSteps.length,
    retainedSteps,
    finalStep,
    stepSummaries,
    nextSphParticleState: sphParticleState,
    nextMlsMpmParticleState: mlsMpmParticleState,
    nextParticleUploads: finalStep?.nextParticleUploads ?? null,
    nextResidentProductMass: residentProductMass,
    nextParticleBufferMode: finalStep?.nextParticleBufferMode ?? 'not-available',
    readbackMode: finalStep?.readbackMode ?? FULL_READBACK_MODE,
    normalHotLoopReadbackFree: Boolean(finalStep?.normalHotLoopReadbackFree),
    renderStateReadbackAvailable: finalStep?.renderStateReadbackAvailable ?? true,
    residentAuthorityLedgerStatus: finalStep?.residentAuthorityLedgerStatus ?? null,
    residentAuthorityFamilyOwners: compactResidentAuthorityFamilyOwners(
      finalStep?.residentAuthorityFamilyOwners || finalStep?.residentAuthoritySummary?.familyOwners
    ),
    residentAuthorityWarnings: [...(finalStep?.residentAuthorityWarnings || [])],
    residentAuthorityBlockers: [...(finalStep?.residentAuthorityBlockers || [])],
    residentBufferLeaseLedgerStatus: finalStep?.residentBufferLeaseLedgerStatus ?? null,
    residentBufferLeaseResourceCount: finalStep?.residentBufferLeaseResourceCount ?? 0,
    residentBufferLeaseActiveLeaseCount: finalStep?.residentBufferLeaseActiveLeaseCount ?? 0,
    residentBufferLeaseWarnings: [...(finalStep?.residentBufferLeaseWarnings || [])],
    residentBufferLeaseBlockers: [...(finalStep?.residentBufferLeaseBlockers || [])],
    fusedResidentSequencePreflight,
    gpuAuthoritativeState: false,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

export async function runMlsMpmMechanicsOnlyResidentStepsWithOptionalWebGpu({
  stepCount = 1,
  retainIntermediateSteps = false,
  compactSummaryMode = MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_EVERY_STEP,
  compactSummaryScope = MLS_MPM_RESIDENT_SUMMARY_SCOPE_FULL,
  onResidentStageProgress = null,
  ...args
} = {}) {
  const count = Math.max(1, Math.round(finiteNumber(stepCount, 1)));
  const resolvedCompactSummaryMode = normalizeMlsMpmResidentCompactSummaryMode(compactSummaryMode);
  const resolvedCompactSummaryScope = normalizeMlsMpmResidentSummaryScope(compactSummaryScope);
  let sphParticleState = args.sphParticleState;
  let mlsMpmParticleState = args.mlsMpmParticleState;
  let sphParticleUpload = args.sphParticleUpload ?? null;
  let mlsMpmParticleUpload = args.mlsMpmParticleUpload ?? null;
  let sourceSlot = args.sourceSlot ?? sphParticleUpload?.slot ?? 0;
  let finalStep = null;
  const retainedSteps = [];
  const stepSummaries = [];
  const markSequenceProgress = (status, extra = {}) => {
    if (typeof onResidentStageProgress !== 'function') return;
    try {
      onResidentStageProgress({
        schema: 'peercompute.ulg.mls-mpm-mechanics-only-sequence-progress.v0',
        status,
        stepCount: count,
        compactSummaryMode: resolvedCompactSummaryMode,
        compactSummaryScope: resolvedCompactSummaryScope,
        updatedAtMs: nowMs(),
        ...extra
      });
    } catch {
      // Diagnostic progress must never affect the physics sequence.
    }
  };

  markSequenceProgress('mechanics-only-sequence-started');

  for (let index = 0; index < count; index += 1) {
    const summarizeStep = compactSummaryModeRequestsReadback(resolvedCompactSummaryMode)
      && (resolvedCompactSummaryMode !== MLS_MPM_RESIDENT_COMPACT_SUMMARY_MODE_FINAL_ONLY || index === count - 1);
    markSequenceProgress('mechanics-only-sequence-step-started', {
      stepIndex: index,
      summarizeStep
    });
    const stepArgs = {
      ...args,
      sphParticleState,
      mlsMpmParticleState,
      sphParticleUpload,
      mlsMpmParticleUpload,
      sourceSlot,
      compactSummaryScope: resolvedCompactSummaryScope,
      sequenceIndex: index,
      sequenceStepCount: count,
      internalPressureScale: 0,
      pressureInterfaceForceRowsBuffer: null,
      pressureInterfaceForceSolver: null,
      onResidentStageProgress(progress = {}) {
        markSequenceProgress(progress.status || 'mechanics-only-stage-progress', {
          ...progress,
          stepIndex: progress.stepIndex ?? progress.sequenceIndex ?? index,
          summarizeStep
        });
      }
    };
    if (!summarizeStep) stepArgs.summaryRunner = null;
    const step = await runMlsMpmMechanicsOnlyResidentStepWithOptionalWebGpu(stepArgs);
    step.sequenceIndex = index;
    stepSummaries.push(summarizeResidentStepForSequence(step, index));
    markSequenceProgress('mechanics-only-sequence-step-complete', {
      stepIndex: index,
      summarizeStep,
      backend: step.backend,
      stageTiming: step.stageTiming || null
    });
    if (finalStep && !retainIntermediateSteps) {
      destroyMlsMpmResidentStepBuffers(finalStep, {
        destroyInputResidentProductMass: true,
        preserveBuffers: retainedContinuationBuffersFromUploads(step.nextParticleUploads)
      });
    } else if (finalStep) {
      retainedSteps.push(finalStep);
    }
    finalStep = step;
    sphParticleState = cloneSphParticleStateForNext(sphParticleState, step);
    mlsMpmParticleState = cloneMlsMpmParticleStateForNext(mlsMpmParticleState, step);
    sphParticleUpload = step.nextParticleUploads?.sphParticleUpload ?? null;
    mlsMpmParticleUpload = step.nextParticleUploads?.mlsMpmParticleUpload ?? null;
    sourceSlot = step.particlePingPong?.nextSlot ?? (sourceSlot === 0 ? 1 : 0);
  }

  markSequenceProgress('mechanics-only-sequence-complete', {
    completedStepCount: stepSummaries.length,
    backend: finalStep?.backend || 'cpu-reference'
  });

  const execution = {
    schema: ULG_MLS_MPM_GPU_RESIDENT_STEPS_EXECUTION_SCHEMA,
    backend: finalStep?.backend || 'cpu-reference',
    status: 'mechanics-only-resident-steps-executed',
    stepCount: count,
    completedStepCount: stepSummaries.length,
    compactSummaryMode: resolvedCompactSummaryMode,
    compactSummaryScope: resolvedCompactSummaryScope,
    retainIntermediateSteps,
    retainedIntermediateStepCount: retainedSteps.length,
    retainedSteps,
    finalStep,
    stepSummaries,
    nextSphParticleState: sphParticleState,
    nextMlsMpmParticleState: mlsMpmParticleState,
    nextParticleUploads: finalStep?.nextParticleUploads ?? null,
    nextResidentProductMass: null,
    nextParticleBufferMode: finalStep?.nextParticleBufferMode ?? 'not-available',
    readbackMode: finalStep?.readbackMode ?? FULL_READBACK_MODE,
    normalHotLoopReadbackFree: Boolean(finalStep?.normalHotLoopReadbackFree),
    renderStateReadbackAvailable: finalStep?.renderStateReadbackAvailable ?? true,
    residentAuthorityLedgerStatus: finalStep?.residentAuthorityLedgerStatus ?? null,
    residentAuthorityFamilyOwners: compactResidentAuthorityFamilyOwners(
      finalStep?.residentAuthorityFamilyOwners || finalStep?.residentAuthoritySummary?.familyOwners
    ),
    residentAuthorityWarnings: [...(finalStep?.residentAuthorityWarnings || [])],
    residentAuthorityBlockers: [...(finalStep?.residentAuthorityBlockers || [])],
    residentBufferLeaseLedgerStatus: finalStep?.residentBufferLeaseLedgerStatus ?? null,
    residentBufferLeaseResourceCount: finalStep?.residentBufferLeaseResourceCount ?? 0,
    residentBufferLeaseActiveLeaseCount: finalStep?.residentBufferLeaseActiveLeaseCount ?? 0,
    residentBufferLeaseWarnings: [...(finalStep?.residentBufferLeaseWarnings || [])],
    residentBufferLeaseBlockers: [...(finalStep?.residentBufferLeaseBlockers || [])],
    gpuAuthoritativeState: false,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
  return {
    ...execution,
    mechanicsOnlyExecutionPath: {
      schema: 'peercompute.ulg.mls-mpm-mechanics-only-execution-path.v0',
      status: 'mechanics-only-entrypoint-enforced',
      source: 'runMlsMpmMechanicsOnlyResidentStepsWithOptionalWebGpu',
      stepSource: 'runMlsMpmMechanicsOnlyResidentStepWithOptionalWebGpu',
      disabledLawStages: ['thermal', 'reaction', 'mechanicsRefresh', 'pressure-interface'],
      authoritativeWriteFamilies: ['particle-kinematics', 'mechanics'],
      suppressesPressureInterfaceForces: true,
      internalPressureScale: 0,
      scientificValidation: false,
      fullPhysicsValidation: false
    }
  };
}

export function destroyMlsMpmResidentStepsBuffers(execution, {
  preserveBuffers = []
} = {}) {
  for (const step of execution?.retainedSteps ?? []) {
    destroyMlsMpmResidentStepBuffers(step, { destroyInputResidentProductMass: true, preserveBuffers });
  }
  destroyMlsMpmResidentStepBuffers(execution?.finalStep, { destroyInputResidentProductMass: true, preserveBuffers });
}
