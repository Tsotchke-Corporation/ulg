import {
  MLS_MPM_GPU_RESIDENT_SUMMARY_ROW_LAYOUT,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_MLS_MPM_GPU_RESIDENT_SUMMARY_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_RESIDENT_SUMMARY_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import {
  mlsMpmActiveGridDispatchFromSummaryWgsl,
  mlsMpmResidentSummaryFinalizeWgsl,
  mlsMpmResidentSummaryPartialsWgsl,
  mlsMpmResidentSummaryWgsl
} from '../../../ulg-gpu-abi/src/wgsl.js';
import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_THERMO_FLOATS
} from './sphGpuBuffers.js';
import { stableOpticalMaterialId } from '../material/opticalGpuBuffers.js';
import { computeBufferBinding, createCachedExplicitComputePipeline } from '../webgpuComputeLayout.js';
import {
  addResidentBufferLease,
  createResidentBufferLeaseLedger,
  destroyResidentBufferWithLease,
  registerResidentBufferResource,
  releaseResidentBufferLease,
  summarizeResidentBufferLeaseLedger
} from '../residentBufferLease.js';
import {
  createGpuReadbackTelemetryAccumulator
} from './sphGpuReadbackTelemetry.js';
import {
  isMlsMpmTerminalParticleFamily,
  selectMlsMpmTerminalParticleFamily
} from './sphMlsMpmPostMechanicsClosure.js';

export {
  ULG_MLS_MPM_GPU_RESIDENT_SUMMARY_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_RESIDENT_SUMMARY_SCHEMA,
  mlsMpmActiveGridDispatchFromSummaryWgsl,
  mlsMpmResidentSummaryFinalizeWgsl,
  mlsMpmResidentSummaryPartialsWgsl,
  mlsMpmResidentSummaryWgsl
};

export const MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS = MLS_MPM_GPU_RESIDENT_SUMMARY_ROW_LAYOUT.length;
export const MLS_MPM_GPU_RESIDENT_SUMMARY_ROWS = MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS / 4;
export const MLS_MPM_RESIDENT_SUMMARY_SCOPE_FULL = 'full';
export const MLS_MPM_RESIDENT_SUMMARY_SCOPE_PARTICLE_VISUAL = 'particle-visual';

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

const SUMMARY_SCOPE = 'mls-mpm-resident-compact-gpu-summary';
const SUMMARY_WORKGROUP_SIZE = 32;
const ACTIVE_GRID_DISPATCH_ARGS_UINTS = 3;
const ACTIVE_GRID_DISPATCH_METADATA_UINTS = 16;
const ACTIVE_GRID_DISPATCH_WORKGROUP_SIZE = 64;
const DEFAULT_ACTIVE_GRID_SAFETY_CELLS = 3;
const DEFAULT_GRAVITY_M_PER_S2 = [0, -9.80665, 0];
const H2O_MATERIAL_ID = stableOpticalMaterialId('h2o');
const SPH_PHASE_CARRIER_PLAN_V2_SCHEMA = 'peercompute.ulg.sph-phase-carrier-plan.v2';

function nowMs() {
  return typeof globalThis.performance?.now === 'function'
    ? globalThis.performance.now()
    : Date.now();
}

function deferSubmittedSummaryCleanup(device, cleanup) {
  if (typeof cleanup !== 'function') return false;
  if (typeof device?.queue?.onSubmittedWorkDone === 'function') {
    device.queue.onSubmittedWorkDone().then(cleanup, cleanup);
    return true;
  }
  setTimeout(cleanup, 0);
  return false;
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function finiteVector3(value, fallback = DEFAULT_GRAVITY_M_PER_S2) {
  const source = Array.isArray(value) ? value : fallback;
  return [
    finiteNumber(source?.[0], fallback[0]),
    finiteNumber(source?.[1], fallback[1]),
    finiteNumber(source?.[2], fallback[2])
  ];
}

export function normalizeMlsMpmResidentSummaryScope(value) {
  const scope = String(value || MLS_MPM_RESIDENT_SUMMARY_SCOPE_FULL).trim().toLowerCase();
  if (scope === MLS_MPM_RESIDENT_SUMMARY_SCOPE_PARTICLE_VISUAL) {
    return MLS_MPM_RESIDENT_SUMMARY_SCOPE_PARTICLE_VISUAL;
  }
  return MLS_MPM_RESIDENT_SUMMARY_SCOPE_FULL;
}

function gridNodeScanCountForSummaryScope(summaryScope, gridNodeCount) {
  return summaryScope === MLS_MPM_RESIDENT_SUMMARY_SCOPE_PARTICLE_VISUAL
    ? 0
    : gridNodeCount;
}

function mechanicsFieldViewEnabledForSummary({ gridUpdate, g2pReconstruction }) {
  return gridUpdate?.mechanicsFieldViewEnabled === true
    || gridUpdate?.schroederSpatialDirectory?.mechanicsFieldViewEnabled === true
    || g2pReconstruction?.mechanicsFieldViewEnabled === true
    || g2pReconstruction?.schroederSpatialDirectory?.mechanicsFieldViewEnabled === true;
}

function assertPackedInputs({ sphParticleState, mlsMpmParticleState }) {
  if (sphParticleState?.schema !== ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError('MLS-MPM resident summary requires a packed SPH GPU particle buffer');
  }
  if (mlsMpmParticleState?.schema !== ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError('MLS-MPM resident summary requires a packed MLS-MPM GPU particle buffer');
  }
  if (sphParticleState.particleCount !== mlsMpmParticleState.particleCount) {
    throw new RangeError('SPH and MLS-MPM particle counts must match for resident summary');
  }
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

function normalizedCohortRange(range, particleCount) {
  const start = Math.max(0, Math.min(particleCount, Math.round(Number(range?.startIndex ?? 0) || 0)));
  const end = Math.max(start, Math.min(particleCount, Math.round(Number(range?.endIndex ?? start) || start)));
  return { start, end };
}

function normalizedPhaseLineageSummaryPlan(plan, particleCount) {
  const lineageCapacity = Number(plan?.lineageCapacity);
  const phaseLaneCount = Number(plan?.phaseLaneCount);
  const phaseLaneStride = Number(plan?.phaseLaneStride);
  const particleCapacity = Number(plan?.particleCapacity);
  const accepted = plan?.schema === SPH_PHASE_CARRIER_PLAN_V2_SCHEMA
    && plan?.status === 'phase-lane-capacity-ready'
    && Number.isSafeInteger(lineageCapacity)
    && lineageCapacity > 0
    && Number.isSafeInteger(phaseLaneCount)
    && phaseLaneCount === 4
    && Number.isSafeInteger(phaseLaneStride)
    && phaseLaneStride === lineageCapacity
    && Number.isSafeInteger(particleCapacity)
    && particleCapacity === particleCount
    && lineageCapacity * phaseLaneCount === particleCount;
  return accepted
    ? { lineageCapacity, phaseLaneCount }
    : { lineageCapacity: 0, phaseLaneCount: 0 };
}

function createSummaryParamsArray({
  particleCount,
  gridNodeCount,
  partialCount,
  cohortRanges = null,
  phaseCarrierPlan = null,
  h2oMaterialId = H2O_MATERIAL_ID
}) {
  const phaseLineage = normalizedPhaseLineageSummaryPlan(phaseCarrierPlan, particleCount);
  const cohortCapacity = phaseLineage.lineageCapacity || particleCount;
  const buffer = new ArrayBuffer(48);
  const view = new DataView(buffer);
  view.setUint32(0, particleCount, true);
  view.setUint32(4, gridNodeCount, true);
  view.setUint32(8, partialCount, true);
  const base = normalizedCohortRange(cohortRanges?.base, cohortCapacity);
  const drop = normalizedCohortRange(cohortRanges?.drop, cohortCapacity);
  view.setUint32(12, base.start, true);
  view.setUint32(16, base.end, true);
  view.setUint32(20, drop.start, true);
  view.setUint32(24, drop.end, true);
  view.setUint32(28, Math.max(0, Math.round(finiteNumber(h2oMaterialId, H2O_MATERIAL_ID))), true);
  view.setUint32(32, phaseLineage.lineageCapacity, true);
  view.setUint32(36, phaseLineage.phaseLaneCount, true);
  return buffer;
}

function createActiveGridDispatchPlanParamsArray({
  gridDims,
  gridShift,
  gridNodeCount,
  gridSpacingM,
  dt = 0,
  stepCount = 1,
  gravityMPerS2 = DEFAULT_GRAVITY_M_PER_S2,
  safetyCells = DEFAULT_ACTIVE_GRID_SAFETY_CELLS,
  summaryStrideFloats = MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS
} = {}) {
  const buffer = new ArrayBuffer(64);
  const view = new DataView(buffer);
  const dims = Array.isArray(gridDims) && gridDims.length >= 3 ? gridDims : [1, 1, 1];
  const gravity = finiteVector3(gravityMPerS2, DEFAULT_GRAVITY_M_PER_S2);
  view.setUint32(0, Math.max(1, Math.round(finiteNumber(dims[0], 1))), true);
  view.setUint32(4, Math.max(1, Math.round(finiteNumber(dims[1], 1))), true);
  view.setUint32(8, Math.max(1, Math.round(finiteNumber(dims[2], 1))), true);
  view.setInt32(12, Math.round(finiteNumber(gridShift, 0)), true);
  view.setUint32(16, Math.max(1, Math.round(finiteNumber(gridNodeCount, 1))), true);
  view.setUint32(20, ACTIVE_GRID_DISPATCH_WORKGROUP_SIZE, true);
  view.setUint32(24, Math.max(1, Math.round(finiteNumber(safetyCells, DEFAULT_ACTIVE_GRID_SAFETY_CELLS))), true);
  view.setUint32(28, Math.max(MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS, Math.round(finiteNumber(summaryStrideFloats, MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS))), true);
  view.setFloat32(32, Math.max(0.000001, finiteNumber(gridSpacingM, 1)), true);
  view.setFloat32(36, finiteNumber(dt, 0), true);
  view.setUint32(40, Math.max(1, Math.round(finiteNumber(stepCount, 1))), true);
  view.setUint32(44, 0, true);
  view.setFloat32(48, gravity[0], true);
  view.setFloat32(52, gravity[1], true);
  view.setFloat32(56, gravity[2], true);
  view.setFloat32(60, 0, true);
  return buffer;
}

function activeGridDispatchPlanRequest(value) {
  if (value === true) return { requested: true };
  if (value && typeof value === 'object') return { requested: value.requested !== false, ...value };
  return { requested: false };
}

function resolveActiveGridDispatchPlanGrid({ gridUpdate, g2pReconstruction, gridNodeCount }) {
  const gridDims = Array.isArray(g2pReconstruction?.gridDims)
    ? g2pReconstruction.gridDims
    : (Array.isArray(gridUpdate?.gridDims) ? gridUpdate.gridDims : null);
  const gridShift = g2pReconstruction?.gridShift ?? gridUpdate?.gridShift ?? null;
  const gridSpacingM = g2pReconstruction?.gridSpacingM ?? gridUpdate?.gridSpacingM ?? null;
  if (!Array.isArray(gridDims) || gridDims.length < 3) return null;
  if (!Number.isFinite(Number(gridShift)) || !Number.isFinite(Number(gridSpacingM))) return null;
  return {
    gridDims: gridDims.slice(0, 3).map((value) => Math.max(1, Math.round(finiteNumber(value, 1)))),
    gridShift: Math.round(finiteNumber(gridShift, 0)),
    gridSpacingM: Math.max(0.000001, finiteNumber(gridSpacingM, 1)),
    gridNodeCount: Math.max(1, Math.round(finiteNumber(gridNodeCount, 1)))
  };
}

function activeGridDispatchPlanDescriptor(plan) {
  if (!plan) return null;
  return {
    schema: 'peercompute.ulg.mls-mpm-active-grid-summary-dispatch-plan.v0',
    status: plan.status,
    reason: plan.reason ?? null,
    source: plan.source ?? null,
    dispatchArgsBufferRetained: Boolean(plan.dispatchArgsBuffer),
    dispatchArgsBufferByteLength: plan.dispatchArgsBufferByteLength ?? 0,
    metadataBufferRetained: Boolean(plan.metadataBuffer),
    metadataBufferByteLength: plan.metadataBufferByteLength ?? 0,
    metadataUintCount: ACTIVE_GRID_DISPATCH_METADATA_UINTS,
    workgroupSize: ACTIVE_GRID_DISPATCH_WORKGROUP_SIZE,
    gridDims: plan.gridDims ? [...plan.gridDims] : null,
    gridShift: plan.gridShift ?? null,
    gridNodeCount: plan.gridNodeCount ?? null,
    gridSpacingM: plan.gridSpacingM ?? null,
    safetyCells: plan.safetyCells ?? null,
    stepCount: plan.stepCount ?? null,
    dt: plan.dt ?? null,
    gravityMPerS2: plan.gravityMPerS2 ? [...plan.gravityMPerS2] : null,
    normalHotLoopReadbackFree: true
  };
}

function updatedGridBufferFromGridUpdate(gridUpdate) {
  if (gridUpdate?.mechanicsFieldViewEnabled === true) {
    return gridUpdate.mechanicsFieldViewBuffer
      ?? gridUpdate.mechanicsFieldView
      ?? gridUpdate?.gpuResult?.mechanicsFieldViewBuffer
      ?? gridUpdate?.gpuResult?.updatedGridBuffer
      ?? gridUpdate?.updatedGridBuffer
      ?? null;
  }
  return gridUpdate?.gpuResult?.updatedGridBuffer ?? gridUpdate?.updatedGridBuffer ?? null;
}

function optionalSourceStateBuffer(sphParticleUpload) {
  return sphParticleUpload?.status === 'webgpu-uploaded' ? sphParticleUpload.stateBuffer : null;
}

function optionalSourceThermoBuffer(sphParticleUpload) {
  return sphParticleUpload?.status === 'webgpu-uploaded' ? sphParticleUpload.thermoBuffer : null;
}

function optionalSourceMechanicsBuffer(mlsMpmParticleUpload) {
  return mlsMpmParticleUpload?.status === 'webgpu-uploaded' ? mlsMpmParticleUpload.mechanicsBuffer : null;
}

function sourceThermoArray(sphParticleState) {
  return sphParticleState.thermo instanceof Float32Array
    ? sphParticleState.thermo
    : new Float32Array(sphParticleState.particleCount * SPH_GPU_PARTICLE_THERMO_FLOATS);
}

export function decodeMlsMpmResidentSummaryValues(values, {
  particleCount = values?.[0] ?? 0,
  gridNodeCount = values?.[1] ?? 0,
  readbackMode = 'compact-summary-readback',
  reductionStrategy = 'two-pass-workgroup-reduction',
  summaryScope = MLS_MPM_RESIDENT_SUMMARY_SCOPE_FULL,
  gridNodeScanCount = gridNodeCount,
  activeGridNodeCountAvailable = true
} = {}) {
  if (!(values instanceof Float32Array) || values.length < MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS) {
    throw new TypeError('decodeMlsMpmResidentSummaryValues requires a compact resident summary Float32Array');
  }
  const resolvedSummaryScope = normalizeMlsMpmResidentSummaryScope(summaryScope);
  const resolvedActiveGridNodeCountAvailable = activeGridNodeCountAvailable === true;
  const activeGridNodeSummaryStatus = resolvedActiveGridNodeCountAvailable
    ? 'active-grid-node-summary-ready'
    : 'active-grid-node-summary-not-requested';
  const sourceMomentumKgMPerS = [values[6], values[7], values[8]];
  const nextMomentumKgMPerS = [values[9], values[10], values[11]];
  const momentumDeltaKgMPerS = [values[12], values[13], values[14]];
  const sourceCenterOfMassM = [values[32], values[33], values[34]];
  const nextCenterOfMassM = [values[35], values[36], values[37]];
  const sourcePositionBoundsM = {
    status: values[50] > 0 ? 'position-bounds-ready' : 'position-bounds-empty',
    min: [values[38], values[39], values[40]],
    max: [values[41], values[42], values[43]],
    massKg: values[52]
  };
  const nextPositionBoundsM = {
    status: values[51] > 0 ? 'position-bounds-ready' : 'position-bounds-empty',
    min: [values[44], values[45], values[46]],
    max: [values[47], values[48], values[49]],
    massKg: values[53]
  };
  const decodeCohort = ({
    role,
    startIndex,
    endIndex,
    massKg,
    centerOffset,
    minOffset,
    maxOffset,
    maxSpeedOffset
  }) => ({
    role,
    status: values[56] > 0 && massKg > 0 ? 'cohort-summary-ready' : 'cohort-summary-empty',
    source: 'compact-resident-summary',
    startIndex,
    endIndex,
    count: Math.max(0, endIndex - startIndex),
    massKg,
    centerOfMassM: [values[centerOffset], values[centerOffset + 1], values[centerOffset + 2]],
    boundsM: {
      status: values[56] > 0 && massKg > 0 ? 'position-bounds-ready' : 'position-bounds-empty',
      min: [values[minOffset], values[minOffset + 1], values[minOffset + 2]],
      max: [values[maxOffset], values[maxOffset + 1], values[maxOffset + 2]],
      size: [
        values[maxOffset] - values[minOffset],
        values[maxOffset + 1] - values[minOffset + 1],
        values[maxOffset + 2] - values[minOffset + 2]
      ]
    },
    maxSpeedMPerS: values[maxSpeedOffset]
  });
  const cohortSummaryAvailable = values[56] > 0;
  const baseCohortStartIndex = Math.round(values[57] || 0);
  const baseCohortEndIndex = Math.round(values[58] || 0);
  const dropCohortStartIndex = Math.round(values[59] || 0);
  const dropCohortEndIndex = Math.round(values[60] || 0);
  const cohortDiagnostics = {
    schema: 'peercompute.ulg.sph-role-cohort-diagnostics.v0',
    source: 'compact-resident-summary',
    readbackRequired: false,
    status: cohortSummaryAvailable ? 'cohort-summary-ready' : 'cohort-summary-empty',
    base: decodeCohort({
      role: 'base',
      startIndex: baseCohortStartIndex,
      endIndex: baseCohortEndIndex,
      massKg: values[61],
      centerOffset: 62,
      minOffset: 65,
      maxOffset: 68,
      maxSpeedOffset: 71
    }),
    drop: decodeCohort({
      role: 'drop',
      startIndex: dropCohortStartIndex,
      endIndex: dropCohortEndIndex,
      massKg: values[72],
      centerOffset: 73,
      minOffset: 76,
      maxOffset: 79,
      maxSpeedOffset: 82
    })
  };
  const phaseMassKg = {
    solid: values[20],
    liquid: values[21],
    gas: values[22],
    plasma: values[23]
  };
  const h2oGasSummaryReady = values[87] > 0;
  const residentPhaseGasSpeciesSummary = {
    schema: 'peercompute.ulg.resident-phase-gas-species-summary.v0',
    status: h2oGasSummaryReady
      ? 'resident-phase-gas-species-summary-ready'
      : 'resident-phase-gas-species-summary-unavailable',
    source: 'compact-resident-summary-h2o-gas-reduction',
    fullParticleReadbackPerformed: false,
    speciesCount: h2oGasSummaryReady ? 1 : 0,
    bySpecies: h2oGasSummaryReady
      ? {
        h2o: {
          material: 'h2o',
          massKg: Math.max(0, values[84]),
          temperatureK: Math.max(0, values[85]),
          phaseWeight: Math.max(0, values[86]),
          status: 'resident-phase-gas-species-ready'
        }
      }
      : {},
    scientificValidation: false,
    gasValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
  return {
    schema: ULG_MLS_MPM_GPU_RESIDENT_SUMMARY_SCHEMA,
    executionSchema: ULG_MLS_MPM_GPU_RESIDENT_SUMMARY_EXECUTION_SCHEMA,
    backend: 'webgpu',
    status: values[19] > 0 ? 'compact-summary-ready' : 'compact-summary-empty',
    kernelScope: SUMMARY_SCOPE,
    reductionStrategy,
    summaryScope: resolvedSummaryScope,
    particleCount,
    gridNodeCount,
    gridNodeScanCount,
    gridNodeScanSkipped: gridNodeScanCount < gridNodeCount,
    activeGridNodeCount: resolvedActiveGridNodeCountAvailable ? values[2] : null,
    activeGridNodeCountAvailable: resolvedActiveGridNodeCountAvailable,
    activeGridNodeSummaryStatus,
    sourceMassKg: values[3],
    nextMassKg: values[4],
    massDeltaKg: values[5],
    sourceMomentumKgMPerS,
    nextMomentumKgMPerS,
    momentumDeltaKgMPerS,
    sourceCenterOfMassM,
    nextCenterOfMassM,
    centerOfMassDeltaM: nextCenterOfMassM.map((value, axis) => value - sourceCenterOfMassM[axis]),
    sourcePositionBoundsM,
    nextPositionBoundsM,
    cohortDiagnostics,
    cohortSummaryAvailable,
    maxSpeedMPerS: values[15],
    maxDisplacementM: values[16],
    minVolumeRatioJ: values[17],
    maxVolumeRatioJ: values[18],
    phaseMassKg,
    residentPhaseGasSpeciesSummary,
    temperatureMassWeightedMeanK: values[24],
    minTemperatureK: values[25],
    maxTemperatureK: values[26],
    thermalReadyCount: values[27],
    thermalProblemCount: values[28],
    finiteTemperatureCount: values[29],
    phaseMassTotalKg: values[30],
    thermalSummaryStatus: values[31] > 0 ? 'thermal-phase-summary-ready' : 'thermal-phase-summary-empty',
    thermalPhaseSummaryAvailable: values[31] > 0,
    readbackMode,
    compactGpuSummaryAvailable: true,
    fullParticleReadbackPerformed: false,
    fullGridReadbackPerformed: false,
    rowLayout: [...MLS_MPM_GPU_RESIDENT_SUMMARY_ROW_LAYOUT],
    summaryStrideFloats: MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS,
    summaryStrideBytes: MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

export async function runMlsMpmResidentSummaryWebGpu({
  device,
  sphParticleState,
  mlsMpmParticleState,
  sphParticleUpload = null,
  mlsMpmParticleUpload = null,
  gridUpdate,
  g2pReconstruction,
  terminalParticleFamily = null,
  schroederFarForceDeltaFusion = null,
  thermalStep = null,
  reactionStep = null,
  mechanicsRefreshStep = null,
  phaseCarrierTransferStep = null,
  cohortRanges = null,
  summaryScope = MLS_MPM_RESIDENT_SUMMARY_SCOPE_FULL,
  activeGridDispatchPlan = false,
  readCompactSummary = true,
  compactSummaryReadbackClassification = 'unclassified'
} = {}) {
  const summaryTimingStartMs = nowMs();
  const readbackTelemetry = createGpuReadbackTelemetryAccumulator({
    scope: 'mls-mpm-resident-compact-summary'
  });
  const shouldReadCompactSummary = readCompactSummary !== false;
  const resolvedCompactSummaryReadbackClassification =
    compactSummaryReadbackClassification === 'final-diagnostic'
      ? 'final-diagnostic'
      : 'unclassified';
  if (
    compactSummaryReadbackClassification !== 'unclassified'
    && compactSummaryReadbackClassification !== 'final-diagnostic'
  ) {
    readbackTelemetry.markUnknown(
      'mls-mpm-resident-compact-summary:invalid-readback-classification'
    );
  }
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runMlsMpmResidentSummaryWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  assertPackedInputs({ sphParticleState, mlsMpmParticleState });
  const particleCount = sphParticleState.particleCount;
  const selectedTerminalParticleFamily = terminalParticleFamily
    ?? selectMlsMpmTerminalParticleFamily({
      sphParticleState,
      sphParticleUpload,
      g2pReconstruction,
      schroederFarForceDeltaFusion,
      thermalStep,
      reactionStep,
      mechanicsRefreshStep,
      phaseCarrierTransferStep
    });
  if (!isMlsMpmTerminalParticleFamily(selectedTerminalParticleFamily)) {
    throw new TypeError(
      'MLS-MPM resident summary requires one authentic terminal particle family'
    );
  }
  if (
    selectedTerminalParticleFamily.ready !== true
    || selectedTerminalParticleFamily.sourceParticleCount !== particleCount
  ) {
    throw new TypeError(
      'MLS-MPM resident summary terminal particle family is incomplete or source-mismatched'
    );
  }
  if (selectedTerminalParticleFamily.particleCount !== particleCount) {
    throw new RangeError(
      'MLS-MPM resident summary does not yet support distinct source and terminal particle counts'
    );
  }
  if (selectedTerminalParticleFamily.schroederParticleStorageSelected) {
    throw new Error(
      'MLS-MPM resident summary requires stable particle-index correspondence after storage adoption'
    );
  }
  const gridNodeCount = gridUpdate?.gridNodeCount ?? g2pReconstruction?.gridNodeCount ?? 0;
  const resolvedSummaryScope = normalizeMlsMpmResidentSummaryScope(summaryScope);
  const mechanicsFieldViewEnabled = mechanicsFieldViewEnabledForSummary({
    gridUpdate,
    g2pReconstruction
  });
  const gridNodeScanCount = mechanicsFieldViewEnabled
    ? 0
    : gridNodeScanCountForSummaryScope(resolvedSummaryScope, gridNodeCount);
  const activeGridNodeCountAvailable = !mechanicsFieldViewEnabled
    && resolvedSummaryScope !== MLS_MPM_RESIDENT_SUMMARY_SCOPE_PARTICLE_VISUAL;
  const activeGridNodeSummaryStatus = mechanicsFieldViewEnabled
    ? 'superseded-by-schroeder-spatial-mechanics-field-view'
    : (activeGridNodeCountAvailable
      ? 'active-grid-node-summary-ready'
      : 'active-grid-node-summary-not-requested');
  const partialCount = Math.max(1, Math.ceil(Math.max(particleCount, gridNodeScanCount) / SUMMARY_WORKGROUP_SIZE));
  const setupStartMs = nowMs();
  const nextStateBuffer = selectedTerminalParticleFamily.stateBuffer;
  const nextMechanicsBuffer = selectedTerminalParticleFamily.mechanicsBuffer;
  const updatedGridBuffer = updatedGridBufferFromGridUpdate(gridUpdate);
  if (!nextStateBuffer || !nextMechanicsBuffer || !updatedGridBuffer) {
    throw new TypeError('MLS-MPM resident summary requires retained G2P state/mechanics and updated-grid buffers');
  }
  const borrowedSourceStateBuffer = optionalSourceStateBuffer(sphParticleUpload);
  const borrowedSourceThermoBuffer = optionalSourceThermoBuffer(sphParticleUpload);
  const borrowedSourceMechanicsBuffer = optionalSourceMechanicsBuffer(mlsMpmParticleUpload);
  const sourceStateBuffer = borrowedSourceStateBuffer
    || writeStorageBuffer(device, 'ulg-mls-mpm-summary-source-sph-state', sphParticleState.state);
  let nextThermoBuffer = selectedTerminalParticleFamily.thermoBuffer;
  let nextThermoBufferMode =
    selectedTerminalParticleFamily.thermoSource === 'phase-carrier-transfer-v2'
      ? 'retained-phase-carrier-transfer-output'
      : (selectedTerminalParticleFamily.thermoSource
          === 'schroeder-particle-storage-materialization'
        ? 'retained-schroeder-particle-storage-adoption'
        : (selectedTerminalParticleFamily.thermoSource === 'reaction-product'
          ? 'retained-reaction-output'
          : (selectedTerminalParticleFamily.thermoSource === 'thermal-phase'
            ? 'retained-thermal-output'
            : (borrowedSourceThermoBuffer
              ? 'borrowed-webgpu-upload'
              : 'temporary-source-upload'))));
  if (!nextThermoBuffer) {
    nextThermoBuffer = writeStorageBuffer(device, 'ulg-mls-mpm-summary-source-sph-thermo', sourceThermoArray(sphParticleState));
    nextThermoBufferMode = 'temporary-source-upload';
  }
  const sourceMechanicsBuffer = borrowedSourceMechanicsBuffer
    || writeStorageBuffer(device, 'ulg-mls-mpm-summary-source-mechanics', mlsMpmParticleState.mechanics);
  const summaryByteLength = MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const partialsByteLength = partialCount * summaryByteLength;
  const partialsBuffer = device.createBuffer({
    label: 'ulg-mls-mpm-resident-summary-partials',
    size: Math.max(4, partialsByteLength),
    usage: GPU_BUFFER_USAGE.STORAGE
  });
  const summaryBuffer = device.createBuffer({
    label: 'ulg-mls-mpm-resident-summary-out',
    size: summaryByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const readBuffer = shouldReadCompactSummary
    ? device.createBuffer({
      label: 'ulg-mls-mpm-resident-summary-readback',
      size: summaryByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    })
    : null;
  const paramsBuffer = device.createBuffer({
    label: 'ulg-mls-mpm-resident-summary-params',
    size: 48,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const activeGridPlanRequest = activeGridDispatchPlanRequest(activeGridDispatchPlan);
  const legacyActiveGridPlanRequested = activeGridPlanRequest.requested
    && !mechanicsFieldViewEnabled;
  const activeGridPlanGrid = legacyActiveGridPlanRequested
    ? resolveActiveGridDispatchPlanGrid({ gridUpdate, g2pReconstruction, gridNodeCount })
    : null;
  const activeGridPlanArgsByteLength = ACTIVE_GRID_DISPATCH_ARGS_UINTS * Uint32Array.BYTES_PER_ELEMENT;
  const activeGridPlanMetadataByteLength = ACTIVE_GRID_DISPATCH_METADATA_UINTS * Uint32Array.BYTES_PER_ELEMENT;
  let activeGridPlanState = activeGridPlanRequest.requested
    ? (mechanicsFieldViewEnabled
      ? {
        status: 'active-grid-summary-dispatch-plan-superseded',
        reason: 'schroeder-spatial-mechanics-field-view-owns-indirect-dispatch',
        source: 'schroeder-spatial-mechanics-field-view-v1'
      }
      : {
      status: 'active-grid-summary-dispatch-plan-unavailable',
      reason: activeGridPlanGrid ? null : 'grid-dims-shift-or-spacing-unavailable',
      source: 'compact-summary-gpu-sidecar'
      })
    : null;
  if (legacyActiveGridPlanRequested && activeGridPlanGrid) {
    const gravity = finiteVector3(activeGridPlanRequest.gravityMPerS2, DEFAULT_GRAVITY_M_PER_S2);
    const safetyCells = Math.max(1, Math.round(finiteNumber(activeGridPlanRequest.safetyCells, DEFAULT_ACTIVE_GRID_SAFETY_CELLS)));
    const stepCount = Math.max(1, Math.round(finiteNumber(activeGridPlanRequest.stepCount, 1)));
    const dtSeconds = finiteNumber(activeGridPlanRequest.dt, 0);
    const dispatchArgsBuffer = device.createBuffer({
      label: 'ulg-mls-mpm-active-grid-summary-dispatch-args',
      size: activeGridPlanArgsByteLength,
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.INDIRECT | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
    });
    const metadataBuffer = device.createBuffer({
      label: 'ulg-mls-mpm-active-grid-summary-dispatch-metadata',
      size: activeGridPlanMetadataByteLength,
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
    });
    const planParamsBuffer = device.createBuffer({
      label: 'ulg-mls-mpm-active-grid-summary-dispatch-params',
      size: 64,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
    });
    device.queue.writeBuffer(planParamsBuffer, 0, createActiveGridDispatchPlanParamsArray({
      ...activeGridPlanGrid,
      dt: dtSeconds,
      stepCount,
      gravityMPerS2: gravity,
      safetyCells
    }));
    activeGridPlanState = {
      status: 'gpu-active-grid-summary-dispatch-plan-ready',
      source: 'compact-summary-gpu-sidecar',
      dispatchArgsBuffer,
      metadataBuffer,
      planParamsBuffer,
      dispatchArgsBufferByteLength: activeGridPlanArgsByteLength,
      metadataBufferByteLength: activeGridPlanMetadataByteLength,
      gridDims: [...activeGridPlanGrid.gridDims],
      gridShift: activeGridPlanGrid.gridShift,
      gridNodeCount: activeGridPlanGrid.gridNodeCount,
      gridSpacingM: activeGridPlanGrid.gridSpacingM,
      safetyCells,
      stepCount,
      dt: dtSeconds,
      gravityMPerS2: gravity,
      destroyed: false,
      destroyActiveGridDispatchPlanBuffers() {
        if (this.destroyed) return;
        this.destroyed = true;
        this.dispatchArgsBuffer?.destroy?.();
        this.metadataBuffer?.destroy?.();
      }
    };
  }
  const compactSummaryLeaseLedger = createResidentBufferLeaseLedger({
    ledgerId: `mls-mpm-compact-summary:${particleCount}:${gridNodeCount}:${gridNodeScanCount}:${partialCount}:${resolvedSummaryScope}`,
    stateKey: 'mls-mpm-resident-compact-summary',
    scope: 'mls-mpm-compact-summary-buffer-leases'
  });
  const compactSummaryLeaseIds = [];
  const registerCompactSummaryBuffer = ({
    resourceKey,
    resourceKind,
    buffer,
    byteLength,
    rowCount,
    expectedConsumers
  }) => {
    registerResidentBufferResource(compactSummaryLeaseLedger, {
      resourceKey,
      resourceKind,
      stateFamily: 'diagnostics',
      ownerStage: 'compact-summary',
      producerStage: 'compact-summary',
      source: 'runMlsMpmResidentSummaryWebGpu',
      status: 'compact-summary-buffer-temporary',
      retained: false,
      byteLength,
      rowCount,
      bufferLabel: buffer?.label,
      expectedConsumers
    });
    for (const consumerStage of expectedConsumers) {
      const lease = addResidentBufferLease(compactSummaryLeaseLedger, {
        resourceKey,
        consumerStage,
        reason: 'compact-summary-diagnostic-buffer'
      });
      compactSummaryLeaseIds.push(lease.leaseId);
    }
  };
  const partialsResourceKey = `compact-summary:partials:${partialCount}:${partialsByteLength}`;
  const summaryResourceKey = `compact-summary:summary:${summaryByteLength}`;
  const readbackResourceKey = shouldReadCompactSummary ? `compact-summary:readback:${summaryByteLength}` : null;
  registerCompactSummaryBuffer({
    resourceKey: partialsResourceKey,
    resourceKind: 'compact-summary-partials-buffer',
    buffer: partialsBuffer,
    byteLength: partialsByteLength,
    rowCount: partialCount,
    expectedConsumers: ['compact-summary-finalize']
  });
  registerCompactSummaryBuffer({
    resourceKey: summaryResourceKey,
    resourceKind: 'compact-summary-output-buffer',
    buffer: summaryBuffer,
    byteLength: summaryByteLength,
    rowCount: 1,
    expectedConsumers: ['compact-summary-readback']
  });
  if (shouldReadCompactSummary) {
    registerCompactSummaryBuffer({
      resourceKey: readbackResourceKey,
      resourceKind: 'compact-summary-readback-buffer',
      buffer: readBuffer,
      byteLength: summaryByteLength,
      rowCount: 1,
      expectedConsumers: ['compact-summary-cpu-decode']
    });
  }
  let compactSummaryResult = null;
  let deferTemporaryCleanup = false;
  let compactSummaryLeasesReleased = false;
  const releaseCompactSummaryLeases = (status = 'released-after-compact-summary-readback') => {
    if (compactSummaryLeasesReleased) return;
    compactSummaryLeasesReleased = true;
    for (const leaseId of compactSummaryLeaseIds) {
      releaseResidentBufferLease(compactSummaryLeaseLedger, leaseId, { status });
    }
  };

  try {
    device.queue.writeBuffer(paramsBuffer, 0, createSummaryParamsArray({
      particleCount,
      gridNodeCount: gridNodeScanCount,
      partialCount,
      cohortRanges,
      phaseCarrierPlan: sphParticleUpload?.phaseCarrierPlan
        || sphParticleState?.phaseCarrierPlan
        || phaseCarrierTransferStep?.result?.phaseCarrierPlan
        || phaseCarrierTransferStep?.phaseCarrierPlan
        || null
    }));
    const { pipeline: partialsPipeline, bindGroupLayout: partialsBindGroupLayout } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-mls-mpm-resident-summary-partials.v4',
      label: 'ulg-mls-mpm-resident-summary-partials',
      code: mlsMpmResidentSummaryPartialsWgsl,
      entryPoint: 'main',
      bindings: [
        computeBufferBinding(0, 'read-only-storage'),
        computeBufferBinding(1, 'read-only-storage'),
        computeBufferBinding(2, 'read-only-storage'),
        computeBufferBinding(3, 'read-only-storage'),
        computeBufferBinding(4, 'read-only-storage'),
        computeBufferBinding(5, 'storage'),
        computeBufferBinding(6, 'uniform'),
        computeBufferBinding(7, 'read-only-storage')
      ]
    });
    const partialsBindGroup = device.createBindGroup({
      layout: partialsBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: sourceStateBuffer } },
        { binding: 1, resource: { buffer: nextStateBuffer } },
        { binding: 2, resource: { buffer: sourceMechanicsBuffer } },
        { binding: 3, resource: { buffer: nextMechanicsBuffer } },
        { binding: 4, resource: { buffer: updatedGridBuffer } },
        { binding: 5, resource: { buffer: partialsBuffer } },
        { binding: 6, resource: { buffer: paramsBuffer } },
        { binding: 7, resource: { buffer: nextThermoBuffer } }
      ]
    });
    const { pipeline: finalizePipeline, bindGroupLayout: finalizeBindGroupLayout } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-mls-mpm-resident-summary-finalize.v4',
      label: 'ulg-mls-mpm-resident-summary-finalize',
      code: mlsMpmResidentSummaryFinalizeWgsl,
      entryPoint: 'main',
      bindings: [
        computeBufferBinding(0, 'read-only-storage'),
        computeBufferBinding(1, 'storage'),
        computeBufferBinding(2, 'uniform')
      ]
    });
  const finalizeBindGroup = device.createBindGroup({
      layout: finalizeBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: partialsBuffer } },
        { binding: 1, resource: { buffer: summaryBuffer } },
        { binding: 2, resource: { buffer: paramsBuffer } }
      ]
    });
    let activeGridPlanPipeline = null;
    let activeGridPlanBindGroup = null;
    if (activeGridPlanState?.status === 'gpu-active-grid-summary-dispatch-plan-ready') {
      const planPipelineInfo = createCachedExplicitComputePipeline(device, {
        cacheKey: 'ulg-mls-mpm-active-grid-summary-dispatch-plan.v1',
        label: 'ulg-mls-mpm-active-grid-summary-dispatch-plan',
        code: mlsMpmActiveGridDispatchFromSummaryWgsl,
        entryPoint: 'main',
        bindings: [
          computeBufferBinding(0, 'read-only-storage'),
          computeBufferBinding(1, 'storage'),
          computeBufferBinding(2, 'storage'),
          computeBufferBinding(3, 'uniform')
        ]
      });
      activeGridPlanPipeline = planPipelineInfo.pipeline;
      activeGridPlanBindGroup = device.createBindGroup({
        layout: planPipelineInfo.bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: summaryBuffer } },
          { binding: 1, resource: { buffer: activeGridPlanState.dispatchArgsBuffer } },
          { binding: 2, resource: { buffer: activeGridPlanState.metadataBuffer } },
          { binding: 3, resource: { buffer: activeGridPlanState.planParamsBuffer } }
        ]
      });
    }
    const setupMs = Math.max(0, nowMs() - setupStartMs);
    const encodeStartMs = nowMs();
    const encoder = device.createCommandEncoder();
    const partialsPass = encoder.beginComputePass();
    partialsPass.setPipeline(partialsPipeline);
    partialsPass.setBindGroup(0, partialsBindGroup);
    partialsPass.dispatchWorkgroups(partialCount);
    partialsPass.end();
    const finalizePass = encoder.beginComputePass();
    finalizePass.setPipeline(finalizePipeline);
    finalizePass.setBindGroup(0, finalizeBindGroup);
    finalizePass.dispatchWorkgroups(1);
    finalizePass.end();
    if (activeGridPlanPipeline && activeGridPlanBindGroup) {
      const activeGridPlanPass = encoder.beginComputePass();
      activeGridPlanPass.setPipeline(activeGridPlanPipeline);
      activeGridPlanPass.setBindGroup(0, activeGridPlanBindGroup);
      activeGridPlanPass.dispatchWorkgroups(1);
      activeGridPlanPass.end();
    }
    if (shouldReadCompactSummary) {
      encoder.copyBufferToBuffer(summaryBuffer, 0, readBuffer, 0, summaryByteLength);
    }
    const encodeMs = Math.max(0, nowMs() - encodeStartMs);
    const submitStartMs = nowMs();
    device.queue.submit([encoder.finish()]);
    const submitMs = Math.max(0, nowMs() - submitStartMs);
    if (!shouldReadCompactSummary) {
      const timing = {
        schema: 'peercompute.ulg.mls-mpm-resident-summary-timing.v0',
        totalMs: Math.max(0, nowMs() - summaryTimingStartMs),
        setupMs,
        encodeMs,
        submitMs,
        mapAsyncWaitMs: null,
        decodeMs: 0,
        queueFenceAttribution: 'none-no-compact-summary-readback',
        summaryKernelDispatchCount: activeGridPlanPipeline ? 3 : 2,
        summaryWorkgroupCount: partialCount + 1 + (activeGridPlanPipeline ? 1 : 0),
        compactReadbackByteLength: 0
      };
      compactSummaryResult = {
        schema: ULG_MLS_MPM_GPU_RESIDENT_SUMMARY_EXECUTION_SCHEMA,
        backend: 'webgpu',
        status: activeGridPlanState?.status === 'gpu-active-grid-summary-dispatch-plan-ready'
          ? 'compact-summary-plan-only-ready'
          : 'compact-summary-plan-only-unavailable',
        reason: activeGridPlanState?.reason ?? null,
        particleCount,
        gridNodeCount,
        readbackMode: 'no-compact-summary-readback',
        compactSummaryReadbackClassification:
          resolvedCompactSummaryReadbackClassification,
        compactGpuSummaryAvailable: false,
        compactGpuSummaryStatus: 'not-read-no-compact-summary-readback',
        summaryScope: resolvedSummaryScope,
        mechanicsFieldViewEnabled,
        gridNodeSummaryAuthority: mechanicsFieldViewEnabled
          ? 'schroeder-spatial-mechanics-field-view-v1'
          : 'legacy-dense-grid-v1',
        gridNodeScanCount,
        gridNodeScanSkipped: gridNodeScanCount < gridNodeCount,
        activeGridNodeCountAvailable: false,
        activeGridNodeSummaryStatus: mechanicsFieldViewEnabled
          ? activeGridNodeSummaryStatus
          : 'active-grid-node-summary-not-read',
        compactReadbackFloatCount: 0,
        compactReadbackByteLength: 0,
        queueCompletionStatus: 'submitted-no-compact-summary-readback',
        queueCompletionMethod: 'queue.submit',
        compactPartialSummaryCount: partialCount,
        compactPartialSummaryByteLength: partialsByteLength,
        compactReductionWorkgroupSize: SUMMARY_WORKGROUP_SIZE,
        timing,
        mapAsyncWaitMs: null,
        queueFenceAttribution: timing.queueFenceAttribution,
        sourceStateBufferMode: borrowedSourceStateBuffer ? 'borrowed-webgpu-upload' : 'temporary-source-upload',
        thermoBufferMode: nextThermoBufferMode,
        sourceMechanicsBufferMode: borrowedSourceMechanicsBuffer ? 'borrowed-webgpu-upload' : 'temporary-source-upload',
        sourceStateStrideFloats: SPH_GPU_PARTICLE_STATE_FLOATS,
        thermoStrideFloats: SPH_GPU_PARTICLE_THERMO_FLOATS,
        sourceMechanicsStrideFloats: MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
        activeGridDispatchPlan: activeGridDispatchPlanDescriptor(activeGridPlanState),
        activeGridDispatchPlanDispatchArgsBuffer: activeGridPlanState?.dispatchArgsBuffer ?? null,
        activeGridDispatchPlanMetadataBuffer: activeGridPlanState?.metadataBuffer ?? null,
        activeGridDispatchPlanDispatchArgsBufferByteLength: activeGridPlanState?.dispatchArgsBufferByteLength ?? 0,
        activeGridDispatchPlanMetadataBufferByteLength: activeGridPlanState?.metadataBufferByteLength ?? 0,
        activeGridDispatchPlanBuffersRetained: activeGridPlanState?.status === 'gpu-active-grid-summary-dispatch-plan-ready',
        destroyActiveGridDispatchPlanBuffers: activeGridPlanState?.destroyActiveGridDispatchPlanBuffers
          ? () => activeGridPlanState.destroyActiveGridDispatchPlanBuffers()
          : null,
        ...readbackTelemetry.snapshot(),
        scientificValidation: false,
        sphValidation: false,
        phaseChangeValidation: false,
        fullPhysicsValidation: false
      };
      deferTemporaryCleanup = true;
      return compactSummaryResult;
    }
    const mapAsyncStartMs = nowMs();
    if (
      resolvedCompactSummaryReadbackClassification === 'final-diagnostic'
    ) {
      readbackTelemetry.recordFinalDiagnosticMapAsync(
        summaryByteLength,
        'mls-mpm-final-compact-summary'
      );
    } else {
      readbackTelemetry.recordMapAsync(
        summaryByteLength,
        'mls-mpm-compact-summary'
      );
    }
    await readBuffer.mapAsync(GPU_MAP_MODE.READ);
    const mapAsyncWaitMs = Math.max(0, nowMs() - mapAsyncStartMs);
    const decodeStartMs = nowMs();
    const values = new Float32Array(readBuffer.getMappedRange()).slice(0, MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS);
    readBuffer.unmap();
    const decodeMs = Math.max(0, nowMs() - decodeStartMs);
    const timing = {
      schema: 'peercompute.ulg.mls-mpm-resident-summary-timing.v0',
      totalMs: Math.max(0, nowMs() - summaryTimingStartMs),
      setupMs,
      encodeMs,
      submitMs,
      mapAsyncWaitMs,
      decodeMs,
      queueFenceAttribution: 'mapAsync(readback-buffer)-may-include-prior-queued-resident-work',
      summaryKernelDispatchCount: activeGridPlanPipeline ? 3 : 2,
      summaryWorkgroupCount: partialCount + 1 + (activeGridPlanPipeline ? 1 : 0),
      compactReadbackByteLength: summaryByteLength
    };
    compactSummaryResult = {
      ...decodeMlsMpmResidentSummaryValues(values, {
        particleCount,
        gridNodeCount,
        readbackMode: 'compact-summary-readback',
        reductionStrategy: 'two-pass-workgroup-reduction',
        summaryScope: resolvedSummaryScope,
        gridNodeScanCount,
        activeGridNodeCountAvailable
      }),
      gridNodeScanCount,
      gridNodeScanSkipped: gridNodeScanCount < gridNodeCount,
      activeGridNodeCountAvailable,
      activeGridNodeSummaryStatus,
      mechanicsFieldViewEnabled,
      gridNodeSummaryAuthority: mechanicsFieldViewEnabled
        ? 'schroeder-spatial-mechanics-field-view-v1'
        : 'legacy-dense-grid-v1',
      compactReadbackFloatCount: MLS_MPM_GPU_RESIDENT_SUMMARY_FLOATS,
      compactReadbackByteLength: summaryByteLength,
      compactSummaryReadbackClassification:
        resolvedCompactSummaryReadbackClassification,
      queueCompletionStatus: 'readback-map-completed',
      queueCompletionMethod: 'mapAsync(readback-buffer)',
      compactPartialSummaryCount: partialCount,
      compactPartialSummaryByteLength: partialsByteLength,
      compactReductionWorkgroupSize: SUMMARY_WORKGROUP_SIZE,
      timing,
      mapAsyncWaitMs,
      queueFenceAttribution: timing.queueFenceAttribution,
      sourceStateBufferMode: borrowedSourceStateBuffer ? 'borrowed-webgpu-upload' : 'temporary-source-upload',
      thermoBufferMode: nextThermoBufferMode,
      sourceMechanicsBufferMode: borrowedSourceMechanicsBuffer ? 'borrowed-webgpu-upload' : 'temporary-source-upload',
      sourceStateStrideFloats: SPH_GPU_PARTICLE_STATE_FLOATS,
      thermoStrideFloats: SPH_GPU_PARTICLE_THERMO_FLOATS,
      sourceMechanicsStrideFloats: MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
      activeGridDispatchPlan: activeGridDispatchPlanDescriptor(activeGridPlanState),
      activeGridDispatchPlanDispatchArgsBuffer: activeGridPlanState?.dispatchArgsBuffer ?? null,
      activeGridDispatchPlanMetadataBuffer: activeGridPlanState?.metadataBuffer ?? null,
      activeGridDispatchPlanDispatchArgsBufferByteLength: activeGridPlanState?.dispatchArgsBufferByteLength ?? 0,
      activeGridDispatchPlanMetadataBufferByteLength: activeGridPlanState?.metadataBufferByteLength ?? 0,
      activeGridDispatchPlanBuffersRetained: activeGridPlanState?.status === 'gpu-active-grid-summary-dispatch-plan-ready',
      destroyActiveGridDispatchPlanBuffers: activeGridPlanState?.destroyActiveGridDispatchPlanBuffers
        ? () => activeGridPlanState.destroyActiveGridDispatchPlanBuffers()
        : null,
      ...readbackTelemetry.snapshot()
    };
    return compactSummaryResult;
  } finally {
    const cleanupTemporaryBuffers = () => {
      if (!borrowedSourceStateBuffer) sourceStateBuffer.destroy?.();
      if (nextThermoBufferMode === 'temporary-source-upload') nextThermoBuffer.destroy?.();
      if (!borrowedSourceMechanicsBuffer) sourceMechanicsBuffer.destroy?.();
      releaseCompactSummaryLeases(deferTemporaryCleanup
        ? 'released-after-compact-summary-plan-submit'
        : 'released-after-compact-summary-readback');
      destroyResidentBufferWithLease(compactSummaryLeaseLedger, partialsResourceKey, () => {
        partialsBuffer.destroy?.();
      }, { reason: 'compact-summary-cleanup' });
      destroyResidentBufferWithLease(compactSummaryLeaseLedger, summaryResourceKey, () => {
        summaryBuffer.destroy?.();
      }, { reason: 'compact-summary-cleanup' });
      if (readbackResourceKey && readBuffer) {
        destroyResidentBufferWithLease(compactSummaryLeaseLedger, readbackResourceKey, () => {
          readBuffer.destroy?.();
        }, { reason: 'compact-summary-cleanup' });
      }
      paramsBuffer.destroy?.();
      activeGridPlanState?.planParamsBuffer?.destroy?.();
      if (!compactSummaryResult && activeGridPlanState?.destroyActiveGridDispatchPlanBuffers) {
        activeGridPlanState.destroyActiveGridDispatchPlanBuffers();
      }
    };
    if (deferTemporaryCleanup) {
      const deferredHostQueueFenceScheduled =
        deferSubmittedSummaryCleanup(device, cleanupTemporaryBuffers);
      if (deferredHostQueueFenceScheduled) {
        readbackTelemetry.recordDeferredCleanupHostQueueFence(
          1,
          'mls-mpm-summary-temporary-cleanup'
        );
        if (compactSummaryResult) {
          Object.assign(compactSummaryResult, readbackTelemetry.snapshot());
        }
      }
    } else {
      cleanupTemporaryBuffers();
    }
    if (compactSummaryResult) {
      compactSummaryResult.residentBufferLeaseLedger = compactSummaryLeaseLedger;
      compactSummaryResult.residentBufferLeaseSummary = summarizeResidentBufferLeaseLedger(compactSummaryLeaseLedger);
      compactSummaryResult.residentBufferLeaseLedgerStatus = compactSummaryLeaseLedger.status;
      compactSummaryResult.residentBufferLeaseResourceCount = compactSummaryLeaseLedger.resourceCount;
      compactSummaryResult.residentBufferLeaseActiveLeaseCount = compactSummaryLeaseLedger.activeLeaseCount;
      compactSummaryResult.compactSummaryBufferAuthority = 'diagnostics-only';
    }
  }
}
