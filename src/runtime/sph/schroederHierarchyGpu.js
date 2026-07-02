import {
  SCHROEDER_ACTIVE_NODE_ROW_LAYOUT,
  SCHROEDER_CONSERVATION_SUMMARY_ROW_LAYOUT,
  SCHROEDER_CROSS_LEVEL_COUPLING_ROW_LAYOUT,
  SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_ROW_LAYOUT,
  SCHROEDER_CROSS_LEVEL_STATE_DELTA_ROW_LAYOUT,
  SCHROEDER_CROSS_LEVEL_TRANSFER_ROW_LAYOUT,
  SCHROEDER_HIERARCHY_AGGREGATE_NODE_ROW_LAYOUT,
  SCHROEDER_HIERARCHY_AGGREGATE_ROW_LAYOUT,
  SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT,
  SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_ROW_LAYOUT,
  SCHROEDER_PHASE_VOLUME_MIGRATION_ROW_LAYOUT,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SCHROEDER_ACTIVE_NODE_LIST_EXECUTION_SCHEMA,
  ULG_SCHROEDER_ACTIVE_NODE_LIST_SCHEMA,
  ULG_SCHROEDER_CONSERVATION_SUMMARY_EXECUTION_SCHEMA,
  ULG_SCHROEDER_CONSERVATION_SUMMARY_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_COUPLING_EXECUTION_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_COUPLING_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_EXECUTION_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_EXECUTION_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_TRANSFER_EXECUTION_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_TRANSFER_SCHEMA,
  ULG_SCHROEDER_HIERARCHY_AGGREGATE_EXECUTION_SCHEMA,
  ULG_SCHROEDER_HIERARCHY_AGGREGATE_NODE_EXECUTION_SCHEMA,
  ULG_SCHROEDER_HIERARCHY_AGGREGATE_NODE_SCHEMA,
  ULG_SCHROEDER_HIERARCHY_AGGREGATE_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_MIGRATION_EXECUTION_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_EXECUTION_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_MIGRATION_ADMISSION_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_MIGRATION_SCHEMA,
  ULG_SCHROEDER_STATE_DELTA_MERGE_ADMISSION_SCHEMA,
  ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA,
  ULG_SCHROEDER_LEVEL_ASSIGNMENT_SCHEMA,
  ULG_SCHROEDER_SAME_LEVEL_MECHANICS_EXECUTION_SCHEMA,
  ULG_SCHROEDER_SAME_LEVEL_MECHANICS_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import {
  schroederHierarchyAggregateNodeReduceWgsl,
  schroederHierarchyAggregateWgsl,
  schroederActiveNodeListWgsl,
  schroederConservationSummaryWgsl,
  schroederCrossLevelCouplingWgsl,
  schroederCrossLevelStateDeltaMergeWgsl,
  schroederCrossLevelStateDeltaWgsl,
  schroederCrossLevelTransferWgsl,
  schroederLevelAssignmentWgsl,
  schroederPhaseVolumeLevelUpdateWgsl,
  schroederPhaseVolumeMigrationWgsl
} from '../../../ulg-gpu-abi/src/wgsl.js';
import { computeBufferBinding, createCachedExplicitComputePipeline, deferSubmittedWorkCleanup } from '../webgpuComputeLayout.js';
import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_THERMO_FLOATS
} from './sphGpuBuffers.js';
import { runMlsMpmResidentStepWithOptionalWebGpu } from './sphMlsMpmGpuStep.js';

export {
  ULG_SCHROEDER_ACTIVE_NODE_LIST_EXECUTION_SCHEMA,
  ULG_SCHROEDER_ACTIVE_NODE_LIST_SCHEMA,
  ULG_SCHROEDER_CONSERVATION_SUMMARY_EXECUTION_SCHEMA,
  ULG_SCHROEDER_CONSERVATION_SUMMARY_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_COUPLING_EXECUTION_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_COUPLING_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_EXECUTION_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_EXECUTION_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_TRANSFER_EXECUTION_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_TRANSFER_SCHEMA,
  ULG_SCHROEDER_HIERARCHY_AGGREGATE_EXECUTION_SCHEMA,
  ULG_SCHROEDER_HIERARCHY_AGGREGATE_NODE_EXECUTION_SCHEMA,
  ULG_SCHROEDER_HIERARCHY_AGGREGATE_NODE_SCHEMA,
  ULG_SCHROEDER_HIERARCHY_AGGREGATE_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_MIGRATION_EXECUTION_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_EXECUTION_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_MIGRATION_ADMISSION_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_MIGRATION_SCHEMA,
  ULG_SCHROEDER_STATE_DELTA_MERGE_ADMISSION_SCHEMA,
  ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA,
  ULG_SCHROEDER_LEVEL_ASSIGNMENT_SCHEMA,
  ULG_SCHROEDER_SAME_LEVEL_MECHANICS_EXECUTION_SCHEMA,
  ULG_SCHROEDER_SAME_LEVEL_MECHANICS_SCHEMA
};

export const SCHROEDER_ACTIVE_NODE_FLOATS = SCHROEDER_ACTIVE_NODE_ROW_LAYOUT.length;
export const SCHROEDER_CONSERVATION_SUMMARY_FLOATS = SCHROEDER_CONSERVATION_SUMMARY_ROW_LAYOUT.length;
export const SCHROEDER_CROSS_LEVEL_COUPLING_FLOATS = SCHROEDER_CROSS_LEVEL_COUPLING_ROW_LAYOUT.length;
export const SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_FLOATS = SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_ROW_LAYOUT.length;
export const SCHROEDER_CROSS_LEVEL_STATE_DELTA_FLOATS = SCHROEDER_CROSS_LEVEL_STATE_DELTA_ROW_LAYOUT.length;
export const SCHROEDER_CROSS_LEVEL_TRANSFER_FLOATS = SCHROEDER_CROSS_LEVEL_TRANSFER_ROW_LAYOUT.length;
export const SCHROEDER_HIERARCHY_AGGREGATE_NODE_FLOATS = SCHROEDER_HIERARCHY_AGGREGATE_NODE_ROW_LAYOUT.length;
export const SCHROEDER_HIERARCHY_AGGREGATE_FLOATS = SCHROEDER_HIERARCHY_AGGREGATE_ROW_LAYOUT.length;
export const SCHROEDER_LEVEL_ASSIGNMENT_FLOATS = SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT.length;
export const SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS = SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_ROW_LAYOUT.length;
export const SCHROEDER_PHASE_VOLUME_MIGRATION_FLOATS = SCHROEDER_PHASE_VOLUME_MIGRATION_ROW_LAYOUT.length;
export const SCHROEDER_ACTIVE_NODE_WORKGROUP_SIZE = 64;
export const SCHROEDER_CONSERVATION_SUMMARY_WORKGROUP_SIZE = 64;
export const SCHROEDER_CROSS_LEVEL_COUPLING_WORKGROUP_SIZE = 64;
export const SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_WORKGROUP_SIZE = 64;
export const SCHROEDER_CROSS_LEVEL_STATE_DELTA_WORKGROUP_SIZE = 64;
export const SCHROEDER_CROSS_LEVEL_TRANSFER_WORKGROUP_SIZE = 64;
export const SCHROEDER_HIERARCHY_AGGREGATE_NODE_WORKGROUP_SIZE = 64;
export const SCHROEDER_HIERARCHY_AGGREGATE_WORKGROUP_SIZE = 64;
export const SCHROEDER_LEVEL_ASSIGNMENT_WORKGROUP_SIZE = 64;
export const SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_WORKGROUP_SIZE = 64;
export const SCHROEDER_PHASE_VOLUME_MIGRATION_WORKGROUP_SIZE = 64;
export const SCHROEDER_ACTIVE_NODE_SCOPE = 'schroeder-gpu-active-node-list';
export const SCHROEDER_CROSS_LEVEL_COUPLING_SCOPE = 'schroeder-gpu-cross-level-coupling';
export const SCHROEDER_LEVEL_ASSIGNMENT_SCOPE = 'schroeder-gpu-level-assignment';
export const SCHROEDER_SAME_LEVEL_MECHANICS_SCOPE = 'schroeder-same-level-mls-mpm-ocean-mechanics';
export const SCHROEDER_NO_FULL_READBACK_MODE = 'no-full-readback';
export const SCHROEDER_FULL_READBACK_MODE = 'full-assignment-readback';
export const SCHROEDER_FULL_ACTIVE_NODE_READBACK_MODE = 'full-active-node-readback';
export const SCHROEDER_FULL_CROSS_LEVEL_READBACK_MODE = 'full-cross-level-readback';
export const SCHROEDER_FULL_CONSERVATION_SUMMARY_READBACK_MODE = 'full-conservation-summary-readback';
export const SCHROEDER_FULL_CROSS_LEVEL_STATE_DELTA_MERGE_READBACK_MODE = 'full-cross-level-state-delta-merge-readback';
export const SCHROEDER_FULL_CROSS_LEVEL_STATE_DELTA_READBACK_MODE = 'full-cross-level-state-delta-readback';
export const SCHROEDER_FULL_CROSS_LEVEL_TRANSFER_READBACK_MODE = 'full-cross-level-transfer-readback';
export const SCHROEDER_FULL_HIERARCHY_AGGREGATE_NODE_READBACK_MODE = 'full-schroeder-hierarchy-aggregate-node-readback';
export const SCHROEDER_FULL_HIERARCHY_AGGREGATE_READBACK_MODE = 'full-schroeder-hierarchy-aggregate-readback';
export const SCHROEDER_FULL_PHASE_VOLUME_LEVEL_UPDATE_READBACK_MODE = 'full-schroeder-phase-volume-level-update-readback';
export const SCHROEDER_FULL_PHASE_VOLUME_MIGRATION_READBACK_MODE = 'full-schroeder-phase-volume-migration-readback';

const DEFAULT_MIN_LEVEL = -8;
const DEFAULT_MAX_LEVEL = 8;
const DEFAULT_BASE_GRID_SPACING_M = 1;
const DEFAULT_TARGET_SUPPORT_CELLS = 1.5;
const DEFAULT_SUPPORT_RADIUS_SCALE = 1;
const DEFAULT_HYSTERESIS_BAND = 0.15;
const DEFAULT_TILE_CELL_COUNT = 8;
const DEFAULT_SUPPORT_INFLATE_CELLS = 1;
const DEFAULT_GAS_PHASE_ID = 3;
const DEFAULT_PHASE_VOLUME_EXPAND_THRESHOLD = 64;
const DEFAULT_COARSEN_LEVEL_DELTA_THRESHOLD = 1;
const DEFAULT_AGGREGATE_RESIDUAL_TOLERANCE = 1e-4;
const SCHROEDER_STATE_DELTA_OUTPUT_FAMILY = 'schroeder-hierarchy-state-delta';
const SCHROEDER_STATE_DELTA_MERGE_STATE_FAMILY = 'schroeder-hierarchy';
const SCHROEDER_STATE_DELTA_MERGE_ADMITTED_STATUSES = new Set([
  'schroeder-state-delta-merge-admission-published',
  'schroeder-state-delta-merge-admission-admitted',
  'worker-retained-schroeder-state-delta-output-admitted',
  'accepted',
  'admitted'
]);
const SCHROEDER_PHASE_VOLUME_MIGRATION_ADMITTED_STATUSES = new Set([
  'schroeder-phase-volume-migration-admission-published',
  'schroeder-phase-volume-migration-admission-admitted',
  'worker-retained-schroeder-phase-volume-migration-output-admitted',
  'accepted',
  'admitted'
]);

const GPU_BUFFER_USAGE = {
  MAP_READ: globalThis.GPUBufferUsage?.MAP_READ ?? 1,
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64
};

const GPU_MAP_MODE = {
  READ: globalThis.GPUMapMode?.READ ?? 1
};

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function finitePositive(value, fallback) {
  const number = finiteNumber(value, fallback);
  return number > 0 ? number : fallback;
}

function clampInteger(value, min, max) {
  const rounded = Math.round(finiteNumber(value, 0));
  return Math.max(Math.round(min), Math.min(Math.round(max), rounded));
}

function assertPackedInputs({ sphParticleState, mlsMpmParticleState }) {
  if (sphParticleState?.schema !== ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError('Schroeder level assignment requires a packed SPH GPU particle buffer');
  }
  if (mlsMpmParticleState?.schema !== ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError('Schroeder level assignment requires a packed MLS-MPM GPU particle buffer');
  }
  if (sphParticleState.particleCount !== mlsMpmParticleState.particleCount) {
    throw new RangeError('SPH and MLS-MPM particle counts must match for Schroeder level assignment');
  }
  if (!(sphParticleState.state instanceof Float32Array) || !(sphParticleState.thermo instanceof Float32Array)) {
    throw new TypeError('Schroeder level assignment requires packed Float32Array SPH state and thermo rows');
  }
  if (!(mlsMpmParticleState.mechanics instanceof Float32Array)) {
    throw new TypeError('Schroeder level assignment requires packed Float32Array MLS-MPM mechanics rows');
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

function optionalSourceStateBuffer(sphParticleUpload) {
  return sphParticleUpload?.status === 'webgpu-uploaded' ? sphParticleUpload.stateBuffer : null;
}

function optionalSourceThermoBuffer(sphParticleUpload) {
  return sphParticleUpload?.status === 'webgpu-uploaded' ? sphParticleUpload.thermoBuffer : null;
}

function optionalSourceMechanicsBuffer(mlsMpmParticleUpload) {
  return mlsMpmParticleUpload?.status === 'webgpu-uploaded' ? mlsMpmParticleUpload.mechanicsBuffer : null;
}

export function estimateSchroederLevelFromSupportRadius({
  supportRadiusM,
  baseGridSpacingM = DEFAULT_BASE_GRID_SPACING_M,
  targetSupportCells = DEFAULT_TARGET_SUPPORT_CELLS,
  minLevel = DEFAULT_MIN_LEVEL,
  maxLevel = DEFAULT_MAX_LEVEL
} = {}) {
  const supportRadius = finitePositive(supportRadiusM, 0);
  const baseDx = finitePositive(baseGridSpacingM, DEFAULT_BASE_GRID_SPACING_M);
  const targetCells = finitePositive(targetSupportCells, DEFAULT_TARGET_SUPPORT_CELLS);
  if (!(supportRadius > 0)) {
    return clampInteger(0, minLevel, maxLevel);
  }
  const nativeDx = supportRadius / targetCells;
  const rawLevel = Math.round(Math.log2(Math.max(nativeDx / baseDx, 1e-12)));
  return clampInteger(rawLevel, minLevel, maxLevel);
}

export function estimateSchroederLevelDeltaForVolumeRatio(volumeRatio) {
  const ratio = finitePositive(volumeRatio, 1);
  return Math.round(Math.log2(Math.cbrt(ratio)));
}

export function createSchroederLevelAssignmentParamsArray({
  particleCount = 0,
  minLevel = DEFAULT_MIN_LEVEL,
  maxLevel = DEFAULT_MAX_LEVEL,
  baseGridSpacingM = DEFAULT_BASE_GRID_SPACING_M,
  targetSupportCells = DEFAULT_TARGET_SUPPORT_CELLS,
  supportRadiusScale = DEFAULT_SUPPORT_RADIUS_SCALE,
  chartId = 0,
  minSupportRadiusM = 0,
  maxSupportRadiusM = 0,
  fallbackSupportRadiusM = 0,
  hysteresisBand = DEFAULT_HYSTERESIS_BAND,
  flags = 0
} = {}) {
  const buffer = new ArrayBuffer(48);
  const view = new DataView(buffer);
  view.setUint32(0, Math.max(0, Math.round(finiteNumber(particleCount, 0))), true);
  view.setInt32(4, Math.round(finiteNumber(minLevel, DEFAULT_MIN_LEVEL)), true);
  view.setInt32(8, Math.round(finiteNumber(maxLevel, DEFAULT_MAX_LEVEL)), true);
  view.setUint32(12, Math.max(0, Math.round(finiteNumber(flags, 0))), true);
  view.setFloat32(16, finitePositive(baseGridSpacingM, DEFAULT_BASE_GRID_SPACING_M), true);
  view.setFloat32(20, finitePositive(targetSupportCells, DEFAULT_TARGET_SUPPORT_CELLS), true);
  view.setFloat32(24, Math.max(0, finiteNumber(supportRadiusScale, DEFAULT_SUPPORT_RADIUS_SCALE)), true);
  view.setFloat32(28, finiteNumber(chartId, 0), true);
  view.setFloat32(32, Math.max(0, finiteNumber(minSupportRadiusM, 0)), true);
  view.setFloat32(36, Math.max(0, finiteNumber(maxSupportRadiusM, 0)), true);
  view.setFloat32(40, Math.max(0, finiteNumber(fallbackSupportRadiusM, 0)), true);
  view.setFloat32(44, Math.max(0, finiteNumber(hysteresisBand, DEFAULT_HYSTERESIS_BAND)), true);
  return buffer;
}

export function createSchroederLevelAssignmentPlan({
  sphParticleState,
  mlsMpmParticleState,
  baseGridSpacingM = sphParticleState?.smoothingLengthM ?? DEFAULT_BASE_GRID_SPACING_M,
  minLevel = DEFAULT_MIN_LEVEL,
  maxLevel = DEFAULT_MAX_LEVEL,
  targetSupportCells = DEFAULT_TARGET_SUPPORT_CELLS,
  supportRadiusScale = DEFAULT_SUPPORT_RADIUS_SCALE,
  chartId = 0,
  minSupportRadiusM = 0,
  maxSupportRadiusM = 0,
  fallbackSupportRadiusM = 0,
  hysteresisBand = DEFAULT_HYSTERESIS_BAND
} = {}) {
  assertPackedInputs({ sphParticleState, mlsMpmParticleState });
  const particleCount = sphParticleState.particleCount;
  const assignmentByteLength = Math.max(
    4,
    particleCount * SCHROEDER_LEVEL_ASSIGNMENT_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
  return {
    schema: ULG_SCHROEDER_LEVEL_ASSIGNMENT_SCHEMA,
    status: 'schroeder-level-assignment-plan-ready',
    algorithm: 'schroeder-algorithm',
    dataStructure: 'schroeder-tree',
    kernelScope: SCHROEDER_LEVEL_ASSIGNMENT_SCOPE,
    particleCount,
    minLevel: Math.round(finiteNumber(minLevel, DEFAULT_MIN_LEVEL)),
    maxLevel: Math.round(finiteNumber(maxLevel, DEFAULT_MAX_LEVEL)),
    baseGridSpacingM: finitePositive(baseGridSpacingM, DEFAULT_BASE_GRID_SPACING_M),
    targetSupportCells: finitePositive(targetSupportCells, DEFAULT_TARGET_SUPPORT_CELLS),
    supportRadiusScale: Math.max(0, finiteNumber(supportRadiusScale, DEFAULT_SUPPORT_RADIUS_SCALE)),
    chartId: finiteNumber(chartId, 0),
    minSupportRadiusM: Math.max(0, finiteNumber(minSupportRadiusM, 0)),
    maxSupportRadiusM: Math.max(0, finiteNumber(maxSupportRadiusM, 0)),
    fallbackSupportRadiusM: Math.max(0, finiteNumber(fallbackSupportRadiusM, 0)),
    hysteresisBand: Math.max(0, finiteNumber(hysteresisBand, DEFAULT_HYSTERESIS_BAND)),
    assignmentRowLayout: [...SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT],
    assignmentStrideFloats: SCHROEDER_LEVEL_ASSIGNMENT_FLOATS,
    assignmentStrideBytes: SCHROEDER_LEVEL_ASSIGNMENT_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    assignmentByteLength,
    sourceStateStrideFloats: SPH_GPU_PARTICLE_STATE_FLOATS,
    sourceThermoStrideFloats: SPH_GPU_PARTICLE_THERMO_FLOATS,
    sourceMechanicsStrideFloats: MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
    gpuFirst: true,
    cpuReferenceRequired: false,
    fullParticleReadbackRequired: false
  };
}

export function createSchroederActiveNodeParamsArray({
  particleCount = 0,
  tileCellCount = DEFAULT_TILE_CELL_COUNT,
  supportInflateCells = DEFAULT_SUPPORT_INFLATE_CELLS,
  minTileSpacingM = 0,
  maxTileSpacingM = 0,
  flags = 0
} = {}) {
  const buffer = new ArrayBuffer(32);
  const view = new DataView(buffer);
  view.setUint32(0, Math.max(0, Math.round(finiteNumber(particleCount, 0))), true);
  view.setUint32(4, Math.max(1, Math.round(finiteNumber(tileCellCount, DEFAULT_TILE_CELL_COUNT))), true);
  view.setUint32(8, Math.max(0, Math.round(finiteNumber(flags, 0))), true);
  view.setUint32(12, 0, true);
  view.setFloat32(16, Math.max(0, finiteNumber(supportInflateCells, DEFAULT_SUPPORT_INFLATE_CELLS)), true);
  view.setFloat32(20, Math.max(0, finiteNumber(minTileSpacingM, 0)), true);
  view.setFloat32(24, Math.max(0, finiteNumber(maxTileSpacingM, 0)), true);
  view.setFloat32(28, 0, true);
  return buffer;
}

export function createSchroederCrossLevelCouplingParamsArray({
  particleCount = 0,
  maxLevel = DEFAULT_MAX_LEVEL,
  parentLevelDelta = 1,
  baseGridSpacingM = DEFAULT_BASE_GRID_SPACING_M,
  couplingHaloCells = DEFAULT_SUPPORT_INFLATE_CELLS,
  minCouplingRadiusM = 0,
  maxCouplingRadiusM = 0,
  tileCellCount = DEFAULT_TILE_CELL_COUNT,
  flags = 0
} = {}) {
  const buffer = new ArrayBuffer(48);
  const view = new DataView(buffer);
  view.setUint32(0, Math.max(0, Math.round(finiteNumber(particleCount, 0))), true);
  view.setInt32(4, Math.round(finiteNumber(maxLevel, DEFAULT_MAX_LEVEL)), true);
  view.setInt32(8, Math.max(1, Math.round(finiteNumber(parentLevelDelta, 1))), true);
  view.setUint32(12, Math.max(0, Math.round(finiteNumber(flags, 0))), true);
  view.setFloat32(16, finitePositive(baseGridSpacingM, DEFAULT_BASE_GRID_SPACING_M), true);
  view.setFloat32(20, Math.max(0, finiteNumber(couplingHaloCells, DEFAULT_SUPPORT_INFLATE_CELLS)), true);
  view.setFloat32(24, Math.max(0, finiteNumber(minCouplingRadiusM, 0)), true);
  view.setFloat32(28, Math.max(0, finiteNumber(maxCouplingRadiusM, 0)), true);
  view.setUint32(32, Math.max(1, Math.round(finiteNumber(tileCellCount, DEFAULT_TILE_CELL_COUNT))), true);
  view.setUint32(36, 0, true);
  view.setFloat32(40, 0, true);
  view.setFloat32(44, 0, true);
  return buffer;
}

export function createSchroederConservationSummaryParamsArray({
  crossLevelCandidateCount = 0,
  crossLevelStrideFloats = SCHROEDER_CROSS_LEVEL_COUPLING_FLOATS,
  summaryStrideFloats = SCHROEDER_CONSERVATION_SUMMARY_FLOATS,
  flags = 0
} = {}) {
  const buffer = new ArrayBuffer(16);
  const view = new DataView(buffer);
  view.setUint32(0, Math.max(0, Math.round(finiteNumber(crossLevelCandidateCount, 0))), true);
  view.setUint32(4, Math.max(1, Math.round(finiteNumber(
    crossLevelStrideFloats,
    SCHROEDER_CROSS_LEVEL_COUPLING_FLOATS
  ))), true);
  view.setUint32(8, Math.max(1, Math.round(finiteNumber(
    summaryStrideFloats,
    SCHROEDER_CONSERVATION_SUMMARY_FLOATS
  ))), true);
  view.setUint32(12, Math.max(0, Math.round(finiteNumber(flags, 0))), true);
  return buffer;
}

export function createSchroederCrossLevelTransferParamsArray({
  crossLevelCandidateCount = 0,
  crossLevelStrideFloats = SCHROEDER_CROSS_LEVEL_COUPLING_FLOATS,
  stateStrideFloats = SPH_GPU_PARTICLE_STATE_FLOATS,
  transferStrideFloats = SCHROEDER_CROSS_LEVEL_TRANSFER_FLOATS,
  flags = 0
} = {}) {
  const buffer = new ArrayBuffer(32);
  const view = new DataView(buffer);
  view.setUint32(0, Math.max(0, Math.round(finiteNumber(crossLevelCandidateCount, 0))), true);
  view.setUint32(4, Math.max(1, Math.round(finiteNumber(
    crossLevelStrideFloats,
    SCHROEDER_CROSS_LEVEL_COUPLING_FLOATS
  ))), true);
  view.setUint32(8, Math.max(1, Math.round(finiteNumber(
    stateStrideFloats,
    SPH_GPU_PARTICLE_STATE_FLOATS
  ))), true);
  view.setUint32(12, Math.max(1, Math.round(finiteNumber(
    transferStrideFloats,
    SCHROEDER_CROSS_LEVEL_TRANSFER_FLOATS
  ))), true);
  view.setUint32(16, Math.max(0, Math.round(finiteNumber(flags, 0))), true);
  view.setUint32(20, 0, true);
  view.setUint32(24, 0, true);
  view.setUint32(28, 0, true);
  return buffer;
}

export function createSchroederCrossLevelStateDeltaParamsArray({
  crossLevelCandidateCount = 0,
  transferStrideFloats = SCHROEDER_CROSS_LEVEL_TRANSFER_FLOATS,
  stateDeltaStrideFloats = SCHROEDER_CROSS_LEVEL_STATE_DELTA_FLOATS,
  flags = 0
} = {}) {
  const buffer = new ArrayBuffer(32);
  const view = new DataView(buffer);
  view.setUint32(0, Math.max(0, Math.round(finiteNumber(crossLevelCandidateCount, 0))), true);
  view.setUint32(4, Math.max(1, Math.round(finiteNumber(
    transferStrideFloats,
    SCHROEDER_CROSS_LEVEL_TRANSFER_FLOATS
  ))), true);
  view.setUint32(8, Math.max(1, Math.round(finiteNumber(
    stateDeltaStrideFloats,
    SCHROEDER_CROSS_LEVEL_STATE_DELTA_FLOATS
  ))), true);
  view.setUint32(12, Math.max(0, Math.round(finiteNumber(flags, 0))), true);
  view.setUint32(16, 0, true);
  view.setUint32(20, 0, true);
  view.setUint32(24, 0, true);
  view.setUint32(28, 0, true);
  return buffer;
}

export function createSchroederCrossLevelStateDeltaMergeParamsArray({
  crossLevelCandidateCount = 0,
  stateDeltaStrideFloats = SCHROEDER_CROSS_LEVEL_STATE_DELTA_FLOATS,
  mergeStrideFloats = SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_FLOATS,
  flags = 0,
  mergeEpoch = 0
} = {}) {
  const buffer = new ArrayBuffer(32);
  const view = new DataView(buffer);
  view.setUint32(0, Math.max(0, Math.round(finiteNumber(crossLevelCandidateCount, 0))), true);
  view.setUint32(4, Math.max(1, Math.round(finiteNumber(
    stateDeltaStrideFloats,
    SCHROEDER_CROSS_LEVEL_STATE_DELTA_FLOATS
  ))), true);
  view.setUint32(8, Math.max(1, Math.round(finiteNumber(
    mergeStrideFloats,
    SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_FLOATS
  ))), true);
  view.setUint32(12, Math.max(0, Math.round(finiteNumber(flags, 0))), true);
  view.setFloat32(16, finiteNumber(mergeEpoch, 0), true);
  view.setFloat32(20, 0, true);
  view.setFloat32(24, 0, true);
  view.setFloat32(28, 0, true);
  return buffer;
}

export function createSchroederHierarchyAggregateParamsArray({
  aggregateRowCount = 0,
  mergeStrideFloats = SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_FLOATS,
  aggregateStrideFloats = SCHROEDER_HIERARCHY_AGGREGATE_FLOATS,
  flags = 0
} = {}) {
  const buffer = new ArrayBuffer(32);
  const view = new DataView(buffer);
  view.setUint32(0, Math.max(0, Math.round(finiteNumber(aggregateRowCount, 0))), true);
  view.setUint32(4, Math.max(1, Math.round(finiteNumber(
    mergeStrideFloats,
    SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_FLOATS
  ))), true);
  view.setUint32(8, Math.max(1, Math.round(finiteNumber(
    aggregateStrideFloats,
    SCHROEDER_HIERARCHY_AGGREGATE_FLOATS
  ))), true);
  view.setUint32(12, Math.max(0, Math.round(finiteNumber(flags, 0))), true);
  view.setUint32(16, 0, true);
  view.setUint32(20, 0, true);
  view.setUint32(24, 0, true);
  view.setUint32(28, 0, true);
  return buffer;
}

export function createSchroederHierarchyAggregateNodeParamsArray({
  aggregateRowCount = 0,
  aggregateStrideFloats = SCHROEDER_HIERARCHY_AGGREGATE_FLOATS,
  aggregateNodeStrideFloats = SCHROEDER_HIERARCHY_AGGREGATE_NODE_FLOATS,
  flags = 0
} = {}) {
  const buffer = new ArrayBuffer(32);
  const view = new DataView(buffer);
  view.setUint32(0, Math.max(0, Math.round(finiteNumber(aggregateRowCount, 0))), true);
  view.setUint32(4, Math.max(1, Math.round(finiteNumber(
    aggregateStrideFloats,
    SCHROEDER_HIERARCHY_AGGREGATE_FLOATS
  ))), true);
  view.setUint32(8, Math.max(1, Math.round(finiteNumber(
    aggregateNodeStrideFloats,
    SCHROEDER_HIERARCHY_AGGREGATE_NODE_FLOATS
  ))), true);
  view.setUint32(12, Math.max(0, Math.round(finiteNumber(flags, 0))), true);
  view.setUint32(16, 0, true);
  view.setUint32(20, 0, true);
  view.setUint32(24, 0, true);
  view.setUint32(28, 0, true);
  return buffer;
}

export function createSchroederPhaseVolumeMigrationParamsArray({
  particleCount = 0,
  aggregateNodeCount = 0,
  assignmentStrideFloats = SCHROEDER_LEVEL_ASSIGNMENT_FLOATS,
  aggregateNodeStrideFloats = SCHROEDER_HIERARCHY_AGGREGATE_NODE_FLOATS,
  migrationStrideFloats = SCHROEDER_PHASE_VOLUME_MIGRATION_FLOATS,
  minLevel = DEFAULT_MIN_LEVEL,
  maxLevel = DEFAULT_MAX_LEVEL,
  flags = 0,
  baseGridSpacingM = DEFAULT_BASE_GRID_SPACING_M,
  targetSupportCells = DEFAULT_TARGET_SUPPORT_CELLS,
  supportRadiusScale = DEFAULT_SUPPORT_RADIUS_SCALE,
  phaseVolumeExpandThreshold = DEFAULT_PHASE_VOLUME_EXPAND_THRESHOLD,
  coarsenLevelDeltaThreshold = DEFAULT_COARSEN_LEVEL_DELTA_THRESHOLD,
  gasPhaseId = DEFAULT_GAS_PHASE_ID,
  migrationEpoch = 0,
  aggregateResidualTolerance = DEFAULT_AGGREGATE_RESIDUAL_TOLERANCE
} = {}) {
  const buffer = new ArrayBuffer(64);
  const view = new DataView(buffer);
  view.setUint32(0, Math.max(0, Math.round(finiteNumber(particleCount, 0))), true);
  view.setUint32(4, Math.max(0, Math.round(finiteNumber(aggregateNodeCount, 0))), true);
  view.setUint32(8, Math.max(1, Math.round(finiteNumber(assignmentStrideFloats, SCHROEDER_LEVEL_ASSIGNMENT_FLOATS))), true);
  view.setUint32(12, Math.max(1, Math.round(finiteNumber(
    aggregateNodeStrideFloats,
    SCHROEDER_HIERARCHY_AGGREGATE_NODE_FLOATS
  ))), true);
  view.setUint32(16, Math.max(1, Math.round(finiteNumber(
    migrationStrideFloats,
    SCHROEDER_PHASE_VOLUME_MIGRATION_FLOATS
  ))), true);
  view.setInt32(20, Math.round(finiteNumber(minLevel, DEFAULT_MIN_LEVEL)), true);
  view.setInt32(24, Math.round(finiteNumber(maxLevel, DEFAULT_MAX_LEVEL)), true);
  view.setUint32(28, Math.max(0, Math.round(finiteNumber(flags, 0))), true);
  view.setFloat32(32, finitePositive(baseGridSpacingM, DEFAULT_BASE_GRID_SPACING_M), true);
  view.setFloat32(36, finitePositive(targetSupportCells, DEFAULT_TARGET_SUPPORT_CELLS), true);
  view.setFloat32(40, Math.max(0, finiteNumber(supportRadiusScale, DEFAULT_SUPPORT_RADIUS_SCALE)), true);
  view.setFloat32(44, Math.max(1, finiteNumber(
    phaseVolumeExpandThreshold,
    DEFAULT_PHASE_VOLUME_EXPAND_THRESHOLD
  )), true);
  view.setFloat32(48, Math.max(0, finiteNumber(
    coarsenLevelDeltaThreshold,
    DEFAULT_COARSEN_LEVEL_DELTA_THRESHOLD
  )), true);
  view.setFloat32(52, finiteNumber(gasPhaseId, DEFAULT_GAS_PHASE_ID), true);
  view.setFloat32(56, finiteNumber(migrationEpoch, 0), true);
  view.setFloat32(60, Math.max(0, finiteNumber(
    aggregateResidualTolerance,
    DEFAULT_AGGREGATE_RESIDUAL_TOLERANCE
  )), true);
  return buffer;
}

export function createSchroederPhaseVolumeLevelUpdateParamsArray({
  migrationRowCount = 0,
  migrationStrideFloats = SCHROEDER_PHASE_VOLUME_MIGRATION_FLOATS,
  levelUpdateStrideFloats = SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS,
  admissionApproved = false,
  stateFamilyId = 1,
  migrationEpoch = 0,
  flags = 0
} = {}) {
  const buffer = new ArrayBuffer(32);
  const view = new DataView(buffer);
  view.setUint32(0, Math.max(0, Math.round(finiteNumber(migrationRowCount, 0))), true);
  view.setUint32(4, Math.max(1, Math.round(finiteNumber(
    migrationStrideFloats,
    SCHROEDER_PHASE_VOLUME_MIGRATION_FLOATS
  ))), true);
  view.setUint32(8, Math.max(1, Math.round(finiteNumber(
    levelUpdateStrideFloats,
    SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS
  ))), true);
  view.setUint32(12, admissionApproved ? 1 : 0, true);
  view.setFloat32(16, finiteNumber(stateFamilyId, 1), true);
  view.setFloat32(20, finiteNumber(migrationEpoch, 0), true);
  view.setUint32(24, Math.max(0, Math.round(finiteNumber(flags, 0))), true);
  view.setUint32(28, 0, true);
  return buffer;
}

function assertLevelAssignmentInput(levelAssignment) {
  if (
    levelAssignment?.schema !== ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA
    && levelAssignment?.schema !== ULG_SCHROEDER_LEVEL_ASSIGNMENT_SCHEMA
  ) {
    throw new TypeError('Schroeder active node list requires a Schroeder level assignment input');
  }
  const particleCount = Math.max(0, Math.round(finiteNumber(levelAssignment.particleCount, 0)));
  if (particleCount <= 0) {
    throw new RangeError('Schroeder active node list requires at least one level-assigned particle');
  }
  const stride = Math.max(0, Math.round(finiteNumber(
    levelAssignment.assignmentStrideFloats,
    SCHROEDER_LEVEL_ASSIGNMENT_FLOATS
  )));
  if (stride !== SCHROEDER_LEVEL_ASSIGNMENT_FLOATS) {
    throw new RangeError('Schroeder active node list requires the current level-assignment row layout');
  }
}

function assertActiveNodeListInput(activeNodeList, particleCount) {
  if (
    activeNodeList?.schema !== ULG_SCHROEDER_ACTIVE_NODE_LIST_EXECUTION_SCHEMA
    && activeNodeList?.schema !== ULG_SCHROEDER_ACTIVE_NODE_LIST_SCHEMA
  ) {
    throw new TypeError('Schroeder cross-level coupling requires a Schroeder active-node input');
  }
  const activeCandidateCount = Math.max(0, Math.round(finiteNumber(activeNodeList.activeCandidateCount, 0)));
  if (activeCandidateCount !== particleCount) {
    throw new RangeError('Schroeder cross-level coupling requires active-node rows for every level-assigned particle');
  }
  const stride = Math.max(0, Math.round(finiteNumber(
    activeNodeList.activeNodeStrideFloats,
    SCHROEDER_ACTIVE_NODE_FLOATS
  )));
  if (stride !== SCHROEDER_ACTIVE_NODE_FLOATS) {
    throw new RangeError('Schroeder cross-level coupling requires the current active-node row layout');
  }
}

function assertCrossLevelCouplingInput(crossLevelCoupling) {
  if (
    crossLevelCoupling?.schema !== ULG_SCHROEDER_CROSS_LEVEL_COUPLING_EXECUTION_SCHEMA
    && crossLevelCoupling?.schema !== ULG_SCHROEDER_CROSS_LEVEL_COUPLING_SCHEMA
  ) {
    throw new TypeError('Schroeder conservation summary requires a Schroeder cross-level coupling input');
  }
  const candidateCount = Math.max(0, Math.round(finiteNumber(crossLevelCoupling.crossLevelCandidateCount, 0)));
  if (candidateCount <= 0) {
    throw new RangeError('Schroeder conservation summary requires at least one cross-level candidate');
  }
  const stride = Math.max(0, Math.round(finiteNumber(
    crossLevelCoupling.crossLevelStrideFloats,
    SCHROEDER_CROSS_LEVEL_COUPLING_FLOATS
  )));
  if (stride !== SCHROEDER_CROSS_LEVEL_COUPLING_FLOATS) {
    throw new RangeError('Schroeder conservation summary requires the current cross-level row layout');
  }
}

function assertSphParticleStateInput(sphParticleState) {
  if (sphParticleState?.schema !== ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError('Schroeder cross-level transfer requires a packed SPH GPU particle buffer');
  }
  if (!(sphParticleState.state instanceof Float32Array)) {
    throw new TypeError('Schroeder cross-level transfer requires packed Float32Array SPH state rows');
  }
}

function assertCrossLevelTransferInput(crossLevelTransfer) {
  if (
    crossLevelTransfer?.schema !== ULG_SCHROEDER_CROSS_LEVEL_TRANSFER_EXECUTION_SCHEMA
    && crossLevelTransfer?.schema !== ULG_SCHROEDER_CROSS_LEVEL_TRANSFER_SCHEMA
  ) {
    throw new TypeError('Schroeder cross-level state delta requires a Schroeder cross-level transfer input');
  }
  const candidateCount = Math.max(0, Math.round(finiteNumber(crossLevelTransfer.crossLevelCandidateCount, 0)));
  if (candidateCount <= 0) {
    throw new RangeError('Schroeder cross-level state delta requires at least one transfer candidate');
  }
  const stride = Math.max(0, Math.round(finiteNumber(
    crossLevelTransfer.transferStrideFloats,
    SCHROEDER_CROSS_LEVEL_TRANSFER_FLOATS
  )));
  if (stride !== SCHROEDER_CROSS_LEVEL_TRANSFER_FLOATS) {
    throw new RangeError('Schroeder cross-level state delta requires the current transfer row layout');
  }
}

function assertCrossLevelStateDeltaInput(crossLevelStateDelta) {
  if (
    crossLevelStateDelta?.schema !== ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_EXECUTION_SCHEMA
    && crossLevelStateDelta?.schema !== ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_SCHEMA
  ) {
    throw new TypeError('Schroeder cross-level state-delta merge requires a Schroeder cross-level state-delta input');
  }
  const candidateCount = Math.max(0, Math.round(finiteNumber(crossLevelStateDelta.crossLevelCandidateCount, 0)));
  if (candidateCount <= 0) {
    throw new RangeError('Schroeder cross-level state-delta merge requires at least one pending state-delta row');
  }
  const stride = Math.max(0, Math.round(finiteNumber(
    crossLevelStateDelta.stateDeltaStrideFloats,
    SCHROEDER_CROSS_LEVEL_STATE_DELTA_FLOATS
  )));
  if (stride !== SCHROEDER_CROSS_LEVEL_STATE_DELTA_FLOATS) {
    throw new RangeError('Schroeder cross-level state-delta merge requires the current state-delta row layout');
  }
}

function schroederStateDeltaMergeAdmissionDescriptor(admission = null) {
  if (!admission || typeof admission !== 'object') return null;
  return admission.schroederStateDeltaPublication
    || admission.admittedSchroederStateDeltaPublication
    || admission.publication
    || admission.descriptor
    || admission;
}

export function schroederStateDeltaMergeAdmissionAllowsApplication({
  stateDeltaMergeAdmission = null,
  crossLevelStateDelta = null,
  stateDeltaRowCount = 0
} = {}) {
  const descriptor = schroederStateDeltaMergeAdmissionDescriptor(stateDeltaMergeAdmission);
  const status = stateDeltaMergeAdmission?.status || descriptor?.status || null;
  const descriptorStatus = descriptor?.status
    || stateDeltaMergeAdmission?.publicationStatus
    || stateDeltaMergeAdmission?.admittedStatus
    || status;
  const outputFamilies = Array.isArray(stateDeltaMergeAdmission?.outputFamilies)
    ? stateDeltaMergeAdmission.outputFamilies
    : (Array.isArray(descriptor?.outputFamilies) ? descriptor.outputFamilies : []);
  const admittedRowCount = Math.max(
    0,
    Math.round(finiteNumber(
      stateDeltaMergeAdmission?.schroederStateDeltaRowCount
        ?? descriptor?.schroederStateDeltaRowCount
        ?? stateDeltaMergeAdmission?.stateDeltaRowCount
        ?? descriptor?.stateDeltaRowCount,
      stateDeltaRowCount
    ))
  );
  const requiredRowCount = Math.max(
    0,
    Math.round(finiteNumber(
      crossLevelStateDelta?.crossLevelCandidateCount,
      stateDeltaRowCount
    ))
  );
  const admissionApproved = stateDeltaMergeAdmission?.stateDeltaMergeApproved === true;
  const descriptorAdmitted = SCHROEDER_STATE_DELTA_MERGE_ADMITTED_STATUSES.has(descriptorStatus)
    || descriptor?.committed === true
    || stateDeltaMergeAdmission?.committed === true;
  const familyAccepted = outputFamilies.includes(SCHROEDER_STATE_DELTA_OUTPUT_FAMILY);
  const rowCountAccepted = admittedRowCount >= requiredRowCount || requiredRowCount === 0;
  return {
    schema: ULG_SCHROEDER_STATE_DELTA_MERGE_ADMISSION_SCHEMA,
    status: admissionApproved && descriptorAdmitted && familyAccepted && rowCountAccepted
      ? 'schroeder-state-delta-merge-admission-approved'
      : 'schroeder-state-delta-merge-admission-blocked',
    approved: admissionApproved && descriptorAdmitted && familyAccepted && rowCountAccepted,
    admissionApproved,
    descriptorAdmitted,
    descriptorStatus,
    familyAccepted,
    rowCountAccepted,
    stateDeltaRowCount: admittedRowCount,
    requiredStateDeltaRowCount: requiredRowCount,
    sourceHotBufferKey: stateDeltaMergeAdmission?.sourceHotBufferKey
      || stateDeltaMergeAdmission?.hotBufferKey
      || descriptor?.sourceHotBufferKey
      || descriptor?.hotBufferKey
      || null,
    outputFamilies: [...outputFamilies]
  };
}

function schroederPhaseVolumeMigrationAdmissionDescriptor(admission = null) {
  if (!admission || typeof admission !== 'object') return null;
  return admission.schroederPhaseVolumeMigrationPublication
    || admission.admittedSchroederPhaseVolumeMigrationPublication
    || admission.publication
    || admission.descriptor
    || admission;
}

export function schroederPhaseVolumeMigrationAdmissionAllowsApplication({
  phaseVolumeMigrationAdmission = null,
  phaseVolumeMigration = null,
  migrationRowCount = 0
} = {}) {
  const descriptor = schroederPhaseVolumeMigrationAdmissionDescriptor(phaseVolumeMigrationAdmission);
  const status = phaseVolumeMigrationAdmission?.status || descriptor?.status || null;
  const descriptorStatus = descriptor?.status
    || phaseVolumeMigrationAdmission?.publicationStatus
    || phaseVolumeMigrationAdmission?.admittedStatus
    || status;
  const outputFamilies = Array.isArray(phaseVolumeMigrationAdmission?.outputFamilies)
    ? phaseVolumeMigrationAdmission.outputFamilies
    : (Array.isArray(descriptor?.outputFamilies) ? descriptor.outputFamilies : []);
  const admittedRowCount = Math.max(
    0,
    Math.round(finiteNumber(
      phaseVolumeMigrationAdmission?.schroederPhaseVolumeMigrationRowCount
        ?? descriptor?.schroederPhaseVolumeMigrationRowCount
        ?? phaseVolumeMigrationAdmission?.migrationRowCount
        ?? descriptor?.migrationRowCount,
      migrationRowCount
    ))
  );
  const requiredRowCount = Math.max(
    0,
    Math.round(finiteNumber(
      phaseVolumeMigration?.particleCount,
      migrationRowCount
    ))
  );
  const admissionApproved = phaseVolumeMigrationAdmission?.phaseVolumeMigrationApproved === true;
  const descriptorAdmitted = SCHROEDER_PHASE_VOLUME_MIGRATION_ADMITTED_STATUSES.has(descriptorStatus)
    || descriptor?.committed === true
    || phaseVolumeMigrationAdmission?.committed === true;
  const familyAccepted = outputFamilies.includes('schroeder-phase-volume-migration');
  const rowCountAccepted = admittedRowCount >= requiredRowCount || requiredRowCount === 0;
  return {
    schema: ULG_SCHROEDER_PHASE_VOLUME_MIGRATION_ADMISSION_SCHEMA,
    status: admissionApproved && descriptorAdmitted && familyAccepted && rowCountAccepted
      ? 'schroeder-phase-volume-migration-admission-approved'
      : 'schroeder-phase-volume-migration-admission-blocked',
    approved: admissionApproved && descriptorAdmitted && familyAccepted && rowCountAccepted,
    admissionApproved,
    descriptorAdmitted,
    descriptorStatus,
    familyAccepted,
    rowCountAccepted,
    migrationRowCount: admittedRowCount,
    requiredMigrationRowCount: requiredRowCount,
    sourceHotBufferKey: phaseVolumeMigrationAdmission?.sourceHotBufferKey
      || phaseVolumeMigrationAdmission?.hotBufferKey
      || descriptor?.sourceHotBufferKey
      || descriptor?.hotBufferKey
      || null,
    outputFamilies: [...outputFamilies]
  };
}

function assertCrossLevelStateDeltaMergeInput(crossLevelStateDeltaMerge) {
  if (
    crossLevelStateDeltaMerge?.schema !== ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_EXECUTION_SCHEMA
    && crossLevelStateDeltaMerge?.schema !== ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_SCHEMA
  ) {
    throw new TypeError('Schroeder hierarchy aggregate requires an admitted cross-level state-delta merge input');
  }
  const candidateCount = Math.max(0, Math.round(finiteNumber(crossLevelStateDeltaMerge.crossLevelCandidateCount, 0)));
  if (candidateCount <= 0) {
    throw new RangeError('Schroeder hierarchy aggregate requires at least one admitted merge row');
  }
  const stride = Math.max(0, Math.round(finiteNumber(
    crossLevelStateDeltaMerge.mergeStrideFloats,
    SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_FLOATS
  )));
  if (stride !== SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_FLOATS) {
    throw new RangeError('Schroeder hierarchy aggregate requires the current merge row layout');
  }
}

function assertHierarchyAggregateInput(hierarchyAggregate) {
  if (
    hierarchyAggregate?.schema !== ULG_SCHROEDER_HIERARCHY_AGGREGATE_EXECUTION_SCHEMA
    && hierarchyAggregate?.schema !== ULG_SCHROEDER_HIERARCHY_AGGREGATE_SCHEMA
  ) {
    throw new TypeError('Schroeder hierarchy aggregate-node reduction requires a Schroeder hierarchy aggregate input');
  }
  const aggregateRowCount = Math.max(0, Math.round(finiteNumber(hierarchyAggregate.aggregateRowCount, 0)));
  if (aggregateRowCount <= 0) {
    throw new RangeError('Schroeder hierarchy aggregate-node reduction requires at least one aggregate contribution row');
  }
  const stride = Math.max(0, Math.round(finiteNumber(
    hierarchyAggregate.aggregateStrideFloats,
    SCHROEDER_HIERARCHY_AGGREGATE_FLOATS
  )));
  if (stride !== SCHROEDER_HIERARCHY_AGGREGATE_FLOATS) {
    throw new RangeError('Schroeder hierarchy aggregate-node reduction requires the current aggregate contribution row layout');
  }
}

function assertHierarchyAggregateNodeInput(hierarchyAggregateNode) {
  if (
    hierarchyAggregateNode?.schema !== ULG_SCHROEDER_HIERARCHY_AGGREGATE_NODE_EXECUTION_SCHEMA
    && hierarchyAggregateNode?.schema !== ULG_SCHROEDER_HIERARCHY_AGGREGATE_NODE_SCHEMA
  ) {
    throw new TypeError('Schroeder phase-volume migration requires a Schroeder hierarchy aggregate-node input');
  }
  const aggregateNodeCount = Math.max(0, Math.round(finiteNumber(
    hierarchyAggregateNode.aggregateNodeCount ?? hierarchyAggregateNode.aggregateRowCount,
    0
  )));
  if (aggregateNodeCount <= 0) {
    throw new RangeError('Schroeder phase-volume migration requires at least one aggregate-node row');
  }
  const stride = Math.max(0, Math.round(finiteNumber(
    hierarchyAggregateNode.aggregateNodeStrideFloats,
    SCHROEDER_HIERARCHY_AGGREGATE_NODE_FLOATS
  )));
  if (stride !== SCHROEDER_HIERARCHY_AGGREGATE_NODE_FLOATS) {
    throw new RangeError('Schroeder phase-volume migration requires the current aggregate-node row layout');
  }
}

function assertPhaseVolumeMigrationInput(phaseVolumeMigration) {
  if (
    phaseVolumeMigration?.schema !== ULG_SCHROEDER_PHASE_VOLUME_MIGRATION_EXECUTION_SCHEMA
    && phaseVolumeMigration?.schema !== ULG_SCHROEDER_PHASE_VOLUME_MIGRATION_SCHEMA
  ) {
    throw new TypeError('Schroeder phase-volume level update requires a Schroeder phase-volume migration input');
  }
  const migrationRowCount = Math.max(0, Math.round(finiteNumber(phaseVolumeMigration.particleCount, 0)));
  if (migrationRowCount <= 0) {
    throw new RangeError('Schroeder phase-volume level update requires at least one migration row');
  }
  const stride = Math.max(0, Math.round(finiteNumber(
    phaseVolumeMigration.migrationStrideFloats,
    SCHROEDER_PHASE_VOLUME_MIGRATION_FLOATS
  )));
  if (stride !== SCHROEDER_PHASE_VOLUME_MIGRATION_FLOATS) {
    throw new RangeError('Schroeder phase-volume level update requires the current migration row layout');
  }
}

export function createSchroederActiveNodeListPlan({
  levelAssignment,
  tileCellCount = DEFAULT_TILE_CELL_COUNT,
  supportInflateCells = DEFAULT_SUPPORT_INFLATE_CELLS,
  minTileSpacingM = 0,
  maxTileSpacingM = 0
} = {}) {
  assertLevelAssignmentInput(levelAssignment);
  const particleCount = Math.max(0, Math.round(finiteNumber(levelAssignment.particleCount, 0)));
  const activeNodeByteLength = Math.max(
    4,
    particleCount * SCHROEDER_ACTIVE_NODE_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
  return {
    schema: ULG_SCHROEDER_ACTIVE_NODE_LIST_SCHEMA,
    status: 'schroeder-active-node-list-plan-ready',
    algorithm: 'schroeder-algorithm',
    dataStructure: 'schroeder-tree',
    kernelScope: SCHROEDER_ACTIVE_NODE_SCOPE,
    sourceAssignmentSchema: levelAssignment.schema,
    sourceAssignmentStatus: levelAssignment.status ?? null,
    particleCount,
    activeCandidateCount: particleCount,
    tileCellCount: Math.max(1, Math.round(finiteNumber(tileCellCount, DEFAULT_TILE_CELL_COUNT))),
    supportInflateCells: Math.max(0, finiteNumber(supportInflateCells, DEFAULT_SUPPORT_INFLATE_CELLS)),
    minTileSpacingM: Math.max(0, finiteNumber(minTileSpacingM, 0)),
    maxTileSpacingM: Math.max(0, finiteNumber(maxTileSpacingM, 0)),
    assignmentRowLayout: [...SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT],
    assignmentStrideFloats: SCHROEDER_LEVEL_ASSIGNMENT_FLOATS,
    activeNodeRowLayout: [...SCHROEDER_ACTIVE_NODE_ROW_LAYOUT],
    activeNodeStrideFloats: SCHROEDER_ACTIVE_NODE_FLOATS,
    activeNodeStrideBytes: SCHROEDER_ACTIVE_NODE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    activeNodeByteLength,
    outputCompaction: 'unsorted-one-row-per-particle-tile-range',
    gpuFirst: true,
    cpuReferenceRequired: false,
    fullParticleReadbackRequired: false
  };
}

export function createSchroederCrossLevelCouplingPlan({
  levelAssignment,
  activeNodeList,
  parentLevelDelta = 1,
  baseGridSpacingM = levelAssignment?.baseGridSpacingM ?? DEFAULT_BASE_GRID_SPACING_M,
  maxLevel = levelAssignment?.maxLevel ?? DEFAULT_MAX_LEVEL,
  couplingHaloCells = DEFAULT_SUPPORT_INFLATE_CELLS,
  minCouplingRadiusM = 0,
  maxCouplingRadiusM = 0,
  tileCellCount = activeNodeList?.tileCellCount ?? DEFAULT_TILE_CELL_COUNT
} = {}) {
  assertLevelAssignmentInput(levelAssignment);
  const particleCount = Math.max(0, Math.round(finiteNumber(levelAssignment.particleCount, 0)));
  assertActiveNodeListInput(activeNodeList, particleCount);
  const crossLevelByteLength = Math.max(
    4,
    particleCount * SCHROEDER_CROSS_LEVEL_COUPLING_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
  return {
    schema: ULG_SCHROEDER_CROSS_LEVEL_COUPLING_SCHEMA,
    status: 'schroeder-cross-level-coupling-plan-ready',
    algorithm: 'schroeder-algorithm',
    dataStructure: 'schroeder-tree',
    kernelScope: SCHROEDER_CROSS_LEVEL_COUPLING_SCOPE,
    sourceAssignmentSchema: levelAssignment.schema,
    sourceAssignmentStatus: levelAssignment.status ?? null,
    sourceActiveNodeSchema: activeNodeList.schema,
    sourceActiveNodeStatus: activeNodeList.status ?? null,
    particleCount,
    crossLevelCandidateCount: particleCount,
    parentLevelDelta: Math.max(1, Math.round(finiteNumber(parentLevelDelta, 1))),
    maxLevel: Math.round(finiteNumber(maxLevel, DEFAULT_MAX_LEVEL)),
    baseGridSpacingM: finitePositive(baseGridSpacingM, DEFAULT_BASE_GRID_SPACING_M),
    couplingHaloCells: Math.max(0, finiteNumber(couplingHaloCells, DEFAULT_SUPPORT_INFLATE_CELLS)),
    minCouplingRadiusM: Math.max(0, finiteNumber(minCouplingRadiusM, 0)),
    maxCouplingRadiusM: Math.max(0, finiteNumber(maxCouplingRadiusM, 0)),
    tileCellCount: Math.max(1, Math.round(finiteNumber(tileCellCount, DEFAULT_TILE_CELL_COUNT))),
    assignmentRowLayout: [...SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT],
    assignmentStrideFloats: SCHROEDER_LEVEL_ASSIGNMENT_FLOATS,
    activeNodeRowLayout: [...SCHROEDER_ACTIVE_NODE_ROW_LAYOUT],
    activeNodeStrideFloats: SCHROEDER_ACTIVE_NODE_FLOATS,
    crossLevelRowLayout: [...SCHROEDER_CROSS_LEVEL_COUPLING_ROW_LAYOUT],
    crossLevelStrideFloats: SCHROEDER_CROSS_LEVEL_COUPLING_FLOATS,
    crossLevelStrideBytes: SCHROEDER_CROSS_LEVEL_COUPLING_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    crossLevelByteLength,
    outputCompaction: 'one-child-parent-candidate-row-per-particle',
    hierarchyRole: 'cross-level-parent-candidate-generation',
    couplingConsumerStatus: 'planned-not-yet-applied-to-mls-mpm-grid-transfer',
    conservationRole: 'candidate-rows-carry-mass-and-volume-for-later-conservative-transfer',
    gpuFirst: true,
    cpuReferenceRequired: false,
    fullParticleReadbackRequired: false
  };
}

export function createSchroederCrossLevelTransferPlan({
  crossLevelCoupling,
  sphParticleState
} = {}) {
  assertCrossLevelCouplingInput(crossLevelCoupling);
  assertSphParticleStateInput(sphParticleState);
  const candidateCount = Math.max(0, Math.round(finiteNumber(crossLevelCoupling.crossLevelCandidateCount, 0)));
  const transferByteLength = Math.max(
    4,
    candidateCount * SCHROEDER_CROSS_LEVEL_TRANSFER_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
  return {
    schema: ULG_SCHROEDER_CROSS_LEVEL_TRANSFER_SCHEMA,
    status: 'schroeder-cross-level-transfer-plan-ready',
    algorithm: 'schroeder-algorithm',
    dataStructure: 'schroeder-tree',
    kernelScope: 'schroeder-gpu-cross-level-transfer-rows',
    sourceCrossLevelSchema: crossLevelCoupling.schema,
    sourceCrossLevelStatus: crossLevelCoupling.status ?? null,
    sourceParticleSchema: sphParticleState.schema,
    crossLevelCandidateCount: candidateCount,
    crossLevelStrideFloats: SCHROEDER_CROSS_LEVEL_COUPLING_FLOATS,
    stateStrideFloats: SPH_GPU_PARTICLE_STATE_FLOATS,
    transferRowLayout: [...SCHROEDER_CROSS_LEVEL_TRANSFER_ROW_LAYOUT],
    transferStrideFloats: SCHROEDER_CROSS_LEVEL_TRANSFER_FLOATS,
    transferStrideBytes: SCHROEDER_CROSS_LEVEL_TRANSFER_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    transferByteLength,
    outputCompaction: 'one-conservative-transfer-row-per-cross-level-candidate',
    conservativeTransferStatus: 'transfer-rows-ready-no-state-mutation',
    conservedQuantities: ['mass', 'represented-volume', 'momentum', 'internal-energy'],
    gpuFirst: true,
    cpuReferenceRequired: false,
    fullParticleReadbackRequired: false
  };
}

export function createSchroederCrossLevelStateDeltaPlan({
  crossLevelTransfer
} = {}) {
  assertCrossLevelTransferInput(crossLevelTransfer);
  const candidateCount = Math.max(0, Math.round(finiteNumber(crossLevelTransfer.crossLevelCandidateCount, 0)));
  const stateDeltaByteLength = Math.max(
    4,
    candidateCount * SCHROEDER_CROSS_LEVEL_STATE_DELTA_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
  return {
    schema: ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_SCHEMA,
    status: 'schroeder-cross-level-state-delta-plan-ready',
    algorithm: 'schroeder-algorithm',
    dataStructure: 'schroeder-tree',
    kernelScope: 'schroeder-gpu-cross-level-state-delta',
    sourceTransferSchema: crossLevelTransfer.schema,
    sourceTransferStatus: crossLevelTransfer.status ?? null,
    crossLevelCandidateCount: candidateCount,
    transferStrideFloats: SCHROEDER_CROSS_LEVEL_TRANSFER_FLOATS,
    stateDeltaRowLayout: [...SCHROEDER_CROSS_LEVEL_STATE_DELTA_ROW_LAYOUT],
    stateDeltaStrideFloats: SCHROEDER_CROSS_LEVEL_STATE_DELTA_FLOATS,
    stateDeltaStrideBytes: SCHROEDER_CROSS_LEVEL_STATE_DELTA_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    stateDeltaByteLength,
    outputCompaction: 'one-pending-state-delta-row-per-transfer-candidate',
    conservativeTransferStatus: 'pending-state-delta-planned',
    stateMutationTarget: 'schroeder-pending-state-delta-buffer',
    stateMutationStatus: 'pending-state-delta-not-authoritative',
    stateAuthorityStatus: 'requires-state-manager-admission-before-authoritative-merge',
    conservedQuantities: ['mass', 'represented-volume', 'momentum', 'internal-energy'],
    gpuFirst: true,
    cpuReferenceRequired: false,
    fullParticleReadbackRequired: false
  };
}

export function createSchroederCrossLevelStateDeltaMergePlan({
  crossLevelStateDelta,
  stateDeltaMergeAdmission = null,
  mergeEpoch = 0
} = {}) {
  assertCrossLevelStateDeltaInput(crossLevelStateDelta);
  const candidateCount = Math.max(0, Math.round(finiteNumber(crossLevelStateDelta.crossLevelCandidateCount, 0)));
  const admission = schroederStateDeltaMergeAdmissionAllowsApplication({
    stateDeltaMergeAdmission,
    crossLevelStateDelta,
    stateDeltaRowCount: candidateCount
  });
  const mergeByteLength = Math.max(
    4,
    candidateCount * SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
  return {
    schema: ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_SCHEMA,
    status: admission.approved
      ? 'schroeder-cross-level-state-delta-merge-plan-ready'
      : 'schroeder-cross-level-state-delta-merge-plan-blocked-admission-required',
    algorithm: 'schroeder-algorithm',
    dataStructure: 'schroeder-tree',
    kernelScope: 'schroeder-gpu-cross-level-state-delta-merge',
    sourceStateDeltaSchema: crossLevelStateDelta.schema,
    sourceStateDeltaStatus: crossLevelStateDelta.status ?? null,
    crossLevelCandidateCount: candidateCount,
    stateDeltaStrideFloats: SCHROEDER_CROSS_LEVEL_STATE_DELTA_FLOATS,
    mergeRowLayout: [...SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_ROW_LAYOUT],
    mergeStrideFloats: SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_FLOATS,
    mergeStrideBytes: SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    mergeByteLength,
    outputCompaction: 'one-admitted-state-delta-merge-row-per-pending-delta',
    outputFamilies: [SCHROEDER_STATE_DELTA_OUTPUT_FAMILY],
    stateFamily: SCHROEDER_STATE_DELTA_MERGE_STATE_FAMILY,
    admission,
    stateDeltaMergeAdmissionSchema: admission.schema,
    stateDeltaMergeAdmissionStatus: admission.status,
    stateDeltaMergeAdmissionApproved: admission.approved,
    stateDeltaMergeAdmissionSourceHotBufferKey: admission.sourceHotBufferKey,
    conservativeTransferStatus: admission.approved
      ? 'state-delta-merge-ready'
      : 'state-delta-merge-blocked-admission-required',
    stateMutationTarget: 'schroeder-retained-admitted-state-delta-merge-buffer',
    stateMutationStatus: admission.approved
      ? 'state-delta-merge-planned'
      : 'blocked-state-delta-merge-admission-required',
    stateAuthorityStatus: admission.approved
      ? 'state-manager-admission-present'
      : 'requires-state-manager-admission-before-authoritative-merge',
    mergeEpoch: finiteNumber(mergeEpoch, 0),
    conservedQuantities: ['mass', 'represented-volume', 'momentum', 'internal-energy'],
    gpuFirst: true,
    cpuReferenceRequired: false,
    fullParticleReadbackRequired: false
  };
}

export function createSchroederHierarchyAggregatePlan({
  crossLevelStateDeltaMerge
} = {}) {
  assertCrossLevelStateDeltaMergeInput(crossLevelStateDeltaMerge);
  const aggregateRowCount = Math.max(0, Math.round(finiteNumber(
    crossLevelStateDeltaMerge.crossLevelCandidateCount,
    0
  )));
  const aggregateByteLength = Math.max(
    4,
    aggregateRowCount * SCHROEDER_HIERARCHY_AGGREGATE_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
  return {
    schema: ULG_SCHROEDER_HIERARCHY_AGGREGATE_SCHEMA,
    status: 'schroeder-hierarchy-aggregate-plan-ready',
    algorithm: 'schroeder-algorithm',
    dataStructure: 'schroeder-tree',
    kernelScope: 'schroeder-gpu-hierarchy-aggregate-contributions',
    sourceStateDeltaMergeSchema: crossLevelStateDeltaMerge.schema,
    sourceStateDeltaMergeStatus: crossLevelStateDeltaMerge.status ?? null,
    aggregateRowCount,
    mergeStrideFloats: SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_FLOATS,
    aggregateRowLayout: [...SCHROEDER_HIERARCHY_AGGREGATE_ROW_LAYOUT],
    aggregateStrideFloats: SCHROEDER_HIERARCHY_AGGREGATE_FLOATS,
    aggregateStrideBytes: SCHROEDER_HIERARCHY_AGGREGATE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    aggregateByteLength,
    outputCompaction: 'unsorted-one-aggregate-contribution-row-per-admitted-merge-row',
    aggregateReductionStatus: 'pending-keyed-reduction',
    stateFamily: SCHROEDER_STATE_DELTA_MERGE_STATE_FAMILY,
    outputFamilies: [SCHROEDER_STATE_DELTA_OUTPUT_FAMILY, 'schroeder-hierarchy-aggregate-contributions'],
    stateMutationTarget: 'schroeder-retained-hierarchy-aggregate-contribution-buffer',
    stateMutationStatus: 'aggregate-contribution-materialization-planned',
    stateAuthorityStatus: 'state-manager-admitted-merge-buffer-source',
    conservativeTransferStatus: 'hierarchy-aggregate-contributions-ready',
    conservedQuantities: ['mass', 'represented-volume', 'momentum', 'internal-energy'],
    gpuFirst: true,
    cpuReferenceRequired: false,
    fullParticleReadbackRequired: false
  };
}

export function createSchroederHierarchyAggregateNodePlan({
  hierarchyAggregate
} = {}) {
  assertHierarchyAggregateInput(hierarchyAggregate);
  const aggregateRowCount = Math.max(0, Math.round(finiteNumber(hierarchyAggregate.aggregateRowCount, 0)));
  const aggregateNodeByteLength = Math.max(
    4,
    aggregateRowCount * SCHROEDER_HIERARCHY_AGGREGATE_NODE_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
  return {
    schema: ULG_SCHROEDER_HIERARCHY_AGGREGATE_NODE_SCHEMA,
    status: 'schroeder-hierarchy-aggregate-node-plan-ready',
    algorithm: 'schroeder-algorithm',
    dataStructure: 'schroeder-tree',
    kernelScope: 'schroeder-gpu-hierarchy-aggregate-node-reduction',
    sourceHierarchyAggregateSchema: hierarchyAggregate.schema,
    sourceHierarchyAggregateStatus: hierarchyAggregate.status ?? null,
    aggregateRowCount,
    aggregateStrideFloats: SCHROEDER_HIERARCHY_AGGREGATE_FLOATS,
    aggregateNodeRowLayout: [...SCHROEDER_HIERARCHY_AGGREGATE_NODE_ROW_LAYOUT],
    aggregateNodeStrideFloats: SCHROEDER_HIERARCHY_AGGREGATE_NODE_FLOATS,
    aggregateNodeStrideBytes: SCHROEDER_HIERARCHY_AGGREGATE_NODE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    aggregateNodeByteLength,
    outputCompaction: 'one-row-per-contribution-first-occurrence-nodes-active-duplicates-suppressed',
    aggregateReductionStatus: 'exact-first-occurrence-global-scan',
    aggregateReductionMode: 'gpu-exact-global-scan-o-n2',
    capacityStatus: 'no-extra-capacity-required-output-row-per-input-row',
    stateFamily: SCHROEDER_STATE_DELTA_MERGE_STATE_FAMILY,
    outputFamilies: [SCHROEDER_STATE_DELTA_OUTPUT_FAMILY, 'schroeder-hierarchy-aggregate-nodes'],
    stateMutationTarget: 'schroeder-retained-hierarchy-aggregate-node-buffer',
    stateMutationStatus: 'aggregate-node-reduction-planned',
    stateAuthorityStatus: 'state-manager-admitted-aggregate-contribution-source',
    conservativeTransferStatus: 'hierarchy-aggregate-nodes-ready',
    conservedQuantities: ['mass', 'represented-volume', 'momentum', 'internal-energy'],
    gpuFirst: true,
    cpuReferenceRequired: false,
    fullParticleReadbackRequired: false
  };
}

export function createSchroederPhaseVolumeMigrationPlan({
  levelAssignment,
  hierarchyAggregateNode,
  baseGridSpacingM = levelAssignment?.baseGridSpacingM ?? DEFAULT_BASE_GRID_SPACING_M,
  minLevel = levelAssignment?.minLevel ?? DEFAULT_MIN_LEVEL,
  maxLevel = levelAssignment?.maxLevel ?? DEFAULT_MAX_LEVEL,
  targetSupportCells = levelAssignment?.targetSupportCells ?? DEFAULT_TARGET_SUPPORT_CELLS,
  supportRadiusScale = levelAssignment?.supportRadiusScale ?? DEFAULT_SUPPORT_RADIUS_SCALE,
  phaseVolumeExpandThreshold = DEFAULT_PHASE_VOLUME_EXPAND_THRESHOLD,
  coarsenLevelDeltaThreshold = DEFAULT_COARSEN_LEVEL_DELTA_THRESHOLD,
  gasPhaseId = DEFAULT_GAS_PHASE_ID,
  migrationEpoch = 0,
  aggregateResidualTolerance = DEFAULT_AGGREGATE_RESIDUAL_TOLERANCE
} = {}) {
  assertLevelAssignmentInput(levelAssignment);
  assertHierarchyAggregateNodeInput(hierarchyAggregateNode);
  const particleCount = Math.max(0, Math.round(finiteNumber(levelAssignment.particleCount, 0)));
  const aggregateNodeCount = Math.max(0, Math.round(finiteNumber(
    hierarchyAggregateNode.aggregateNodeCount ?? hierarchyAggregateNode.aggregateRowCount,
    0
  )));
  const migrationByteLength = Math.max(
    4,
    particleCount * SCHROEDER_PHASE_VOLUME_MIGRATION_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
  return {
    schema: ULG_SCHROEDER_PHASE_VOLUME_MIGRATION_SCHEMA,
    status: 'schroeder-phase-volume-migration-plan-ready',
    algorithm: 'schroeder-algorithm',
    dataStructure: 'schroeder-tree',
    kernelScope: 'schroeder-gpu-phase-volume-migration',
    sourceAssignmentSchema: levelAssignment.schema,
    sourceAssignmentStatus: levelAssignment.status ?? null,
    sourceHierarchyAggregateNodeSchema: hierarchyAggregateNode.schema,
    sourceHierarchyAggregateNodeStatus: hierarchyAggregateNode.status ?? null,
    particleCount,
    aggregateNodeCount,
    minLevel: Math.round(finiteNumber(minLevel, DEFAULT_MIN_LEVEL)),
    maxLevel: Math.round(finiteNumber(maxLevel, DEFAULT_MAX_LEVEL)),
    baseGridSpacingM: finitePositive(baseGridSpacingM, DEFAULT_BASE_GRID_SPACING_M),
    targetSupportCells: finitePositive(targetSupportCells, DEFAULT_TARGET_SUPPORT_CELLS),
    supportRadiusScale: Math.max(0, finiteNumber(supportRadiusScale, DEFAULT_SUPPORT_RADIUS_SCALE)),
    phaseVolumeExpandThreshold: Math.max(1, finiteNumber(
      phaseVolumeExpandThreshold,
      DEFAULT_PHASE_VOLUME_EXPAND_THRESHOLD
    )),
    coarsenLevelDeltaThreshold: Math.max(0, finiteNumber(
      coarsenLevelDeltaThreshold,
      DEFAULT_COARSEN_LEVEL_DELTA_THRESHOLD
    )),
    gasPhaseId: finiteNumber(gasPhaseId, DEFAULT_GAS_PHASE_ID),
    migrationEpoch: finiteNumber(migrationEpoch, 0),
    aggregateResidualTolerance: Math.max(0, finiteNumber(
      aggregateResidualTolerance,
      DEFAULT_AGGREGATE_RESIDUAL_TOLERANCE
    )),
    assignmentStrideFloats: SCHROEDER_LEVEL_ASSIGNMENT_FLOATS,
    aggregateNodeStrideFloats: SCHROEDER_HIERARCHY_AGGREGATE_NODE_FLOATS,
    migrationRowLayout: [...SCHROEDER_PHASE_VOLUME_MIGRATION_ROW_LAYOUT],
    migrationStrideFloats: SCHROEDER_PHASE_VOLUME_MIGRATION_FLOATS,
    migrationStrideBytes: SCHROEDER_PHASE_VOLUME_MIGRATION_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    migrationByteLength,
    phaseVolumeStatus: 'phase-volume-migration-planned',
    migrationMode: 'physical-volume-level-target-with-aggregate-coherence',
    aggregateCoherenceRequirement: 'retained-aggregate-node-buffer-consumed',
    waterToSteamScaleStatus: 'water-to-steam-expansion-maps-to-coarser-levels-without-particle-multiplication',
    stateFamily: SCHROEDER_STATE_DELTA_MERGE_STATE_FAMILY,
    outputFamilies: [
      SCHROEDER_STATE_DELTA_OUTPUT_FAMILY,
      'schroeder-phase-volume-migration',
      'schroeder-hierarchy-aggregate-nodes'
    ],
    stateMutationTarget: 'schroeder-retained-phase-volume-migration-buffer',
    stateMutationStatus: 'phase-volume-migration-planned',
    stateAuthorityStatus: 'requires-state-manager-admission-for-authoritative-level-migration',
    conservativeTransferStatus: 'phase-volume-migration-ready',
    conservedQuantities: ['mass', 'represented-volume', 'momentum', 'internal-energy'],
    gpuFirst: true,
    cpuReferenceRequired: false,
    fullParticleReadbackRequired: false
  };
}

export function createSchroederPhaseVolumeLevelUpdatePlan({
  phaseVolumeMigration,
  phaseVolumeMigrationAdmission = null,
  migrationEpoch = phaseVolumeMigration?.migrationEpoch ?? 0,
  stateFamilyId = 1
} = {}) {
  assertPhaseVolumeMigrationInput(phaseVolumeMigration);
  const migrationRowCount = Math.max(0, Math.round(finiteNumber(phaseVolumeMigration.particleCount, 0)));
  const admission = schroederPhaseVolumeMigrationAdmissionAllowsApplication({
    phaseVolumeMigrationAdmission,
    phaseVolumeMigration,
    migrationRowCount
  });
  const levelUpdateByteLength = Math.max(
    4,
    migrationRowCount * SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
  return {
    schema: ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_SCHEMA,
    status: admission.approved
      ? 'schroeder-phase-volume-level-update-plan-ready'
      : 'schroeder-phase-volume-level-update-plan-blocked-admission-required',
    algorithm: 'schroeder-algorithm',
    dataStructure: 'schroeder-tree',
    kernelScope: 'schroeder-gpu-phase-volume-level-update',
    sourcePhaseVolumeMigrationSchema: phaseVolumeMigration.schema,
    sourcePhaseVolumeMigrationStatus: phaseVolumeMigration.status ?? null,
    migrationRowCount,
    migrationStrideFloats: SCHROEDER_PHASE_VOLUME_MIGRATION_FLOATS,
    levelUpdateRowLayout: [...SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_ROW_LAYOUT],
    levelUpdateStrideFloats: SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS,
    levelUpdateStrideBytes: SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    levelUpdateByteLength,
    outputCompaction: 'one-admitted-phase-volume-level-update-row-per-migration-row',
    admission,
    phaseVolumeMigrationAdmissionSchema: admission.schema,
    phaseVolumeMigrationAdmissionStatus: admission.status,
    phaseVolumeMigrationAdmissionApproved: admission.approved,
    phaseVolumeMigrationAdmissionSourceHotBufferKey: admission.sourceHotBufferKey,
    stateFamily: SCHROEDER_STATE_DELTA_MERGE_STATE_FAMILY,
    stateFamilyId: finiteNumber(stateFamilyId, 1),
    migrationEpoch: finiteNumber(migrationEpoch, 0),
    outputFamilies: [
      SCHROEDER_STATE_DELTA_OUTPUT_FAMILY,
      'schroeder-phase-volume-migration',
      'schroeder-phase-volume-level-update'
    ],
    stateMutationTarget: 'schroeder-retained-phase-volume-level-update-buffer',
    conservativeTransferStatus: admission.approved
      ? 'phase-volume-level-update-ready'
      : 'phase-volume-level-update-blocked-admission-required',
    stateMutationStatus: admission.approved
      ? 'phase-volume-level-update-planned'
      : 'blocked-phase-volume-level-update-admission-required',
    stateAuthorityStatus: admission.approved
      ? 'state-manager-admission-present'
      : 'requires-state-manager-admission-for-authoritative-level-migration',
    conservedQuantities: ['mass', 'represented-volume', 'momentum', 'internal-energy'],
    gpuFirst: true,
    cpuReferenceRequired: false,
    fullParticleReadbackRequired: false
  };
}

export function createSchroederConservationSummaryPlan({
  crossLevelCoupling,
  summaryWorkgroupSize = SCHROEDER_CONSERVATION_SUMMARY_WORKGROUP_SIZE
} = {}) {
  assertCrossLevelCouplingInput(crossLevelCoupling);
  const candidateCount = Math.max(0, Math.round(finiteNumber(crossLevelCoupling.crossLevelCandidateCount, 0)));
  const workgroupSize = Math.max(1, Math.round(finiteNumber(
    summaryWorkgroupSize,
    SCHROEDER_CONSERVATION_SUMMARY_WORKGROUP_SIZE
  )));
  const summaryRowCount = Math.max(1, Math.ceil(candidateCount / workgroupSize));
  const summaryByteLength = Math.max(
    4,
    summaryRowCount * SCHROEDER_CONSERVATION_SUMMARY_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
  return {
    schema: ULG_SCHROEDER_CONSERVATION_SUMMARY_SCHEMA,
    status: 'schroeder-conservation-summary-plan-ready',
    algorithm: 'schroeder-algorithm',
    dataStructure: 'schroeder-tree',
    kernelScope: 'schroeder-gpu-cross-level-conservation-summary',
    sourceCrossLevelSchema: crossLevelCoupling.schema,
    sourceCrossLevelStatus: crossLevelCoupling.status ?? null,
    crossLevelCandidateCount: candidateCount,
    crossLevelStrideFloats: SCHROEDER_CROSS_LEVEL_COUPLING_FLOATS,
    summaryRowLayout: [...SCHROEDER_CONSERVATION_SUMMARY_ROW_LAYOUT],
    summaryStrideFloats: SCHROEDER_CONSERVATION_SUMMARY_FLOATS,
    summaryStrideBytes: SCHROEDER_CONSERVATION_SUMMARY_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    summaryWorkgroupSize: workgroupSize,
    summaryRowCount,
    summaryByteLength,
    outputCompaction: 'one-conservation-summary-row-per-workgroup',
    conservativeTransferStatus: 'summary-only-no-state-mutation',
    residualCounterStatus: 'planned-gpu-resident-workgroup-partials',
    conservedQuantities: ['mass', 'represented-volume'],
    gpuFirst: true,
    cpuReferenceRequired: false,
    fullParticleReadbackRequired: false
  };
}

export function schroederGridSpacingForLevel({
  selectedLevel = 0,
  baseGridSpacingM = DEFAULT_BASE_GRID_SPACING_M,
  minLevel = DEFAULT_MIN_LEVEL,
  maxLevel = DEFAULT_MAX_LEVEL
} = {}) {
  const level = clampInteger(selectedLevel, minLevel, maxLevel);
  const baseDx = finitePositive(baseGridSpacingM, DEFAULT_BASE_GRID_SPACING_M);
  return baseDx * (2 ** level);
}

export function createSchroederSameLevelMechanicsPlan({
  sphParticleState,
  mlsMpmParticleState,
  selectedLevel = 0,
  baseGridSpacingM = sphParticleState?.smoothingLengthM ?? DEFAULT_BASE_GRID_SPACING_M,
  minLevel = DEFAULT_MIN_LEVEL,
  maxLevel = DEFAULT_MAX_LEVEL,
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE,
  tileCellCount = DEFAULT_TILE_CELL_COUNT
} = {}) {
  assertPackedInputs({ sphParticleState, mlsMpmParticleState });
  const level = clampInteger(selectedLevel, minLevel, maxLevel);
  const nativeGridSpacingM = schroederGridSpacingForLevel({
    selectedLevel: level,
    baseGridSpacingM,
    minLevel,
    maxLevel
  });
  return {
    schema: ULG_SCHROEDER_SAME_LEVEL_MECHANICS_SCHEMA,
    status: 'schroeder-same-level-mechanics-plan-ready',
    algorithm: 'schroeder-algorithm',
    dataStructure: 'schroeder-tree',
    kernelScope: SCHROEDER_SAME_LEVEL_MECHANICS_SCOPE,
    particleCount: sphParticleState.particleCount,
    selectedLevel: level,
    minLevel: Math.round(finiteNumber(minLevel, DEFAULT_MIN_LEVEL)),
    maxLevel: Math.round(finiteNumber(maxLevel, DEFAULT_MAX_LEVEL)),
    baseGridSpacingM: finitePositive(baseGridSpacingM, DEFAULT_BASE_GRID_SPACING_M),
    nativeGridSpacingM,
    tileCellCount: Math.max(1, Math.round(finiteNumber(tileCellCount, DEFAULT_TILE_CELL_COUNT))),
    readbackMode,
    mechanicsBackend: 'mls-mpm-resident-step-selected-schroeder-level',
    denseLocalBackend: 'existing-mls-mpm-ocean-resident-mechanics',
    hierarchyRole: 'same-level-dense-local-mechanics',
    crossLevelCouplingStatus: 'optional-candidate-generation-available-not-yet-consumed',
    gpuFirst: true,
    cpuReferenceRequired: false,
    fullParticleReadbackRequired: false
  };
}

export async function runSchroederLevelAssignmentWebGpu({
  device,
  sphParticleState,
  mlsMpmParticleState,
  sphParticleUpload = null,
  mlsMpmParticleUpload = null,
  baseGridSpacingM = sphParticleState?.smoothingLengthM ?? DEFAULT_BASE_GRID_SPACING_M,
  minLevel = DEFAULT_MIN_LEVEL,
  maxLevel = DEFAULT_MAX_LEVEL,
  targetSupportCells = DEFAULT_TARGET_SUPPORT_CELLS,
  supportRadiusScale = DEFAULT_SUPPORT_RADIUS_SCALE,
  chartId = 0,
  minSupportRadiusM = 0,
  maxSupportRadiusM = 0,
  fallbackSupportRadiusM = 0,
  hysteresisBand = DEFAULT_HYSTERESIS_BAND,
  retainAssignmentBuffer = true,
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSchroederLevelAssignmentWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  assertPackedInputs({ sphParticleState, mlsMpmParticleState });
  const plan = createSchroederLevelAssignmentPlan({
    sphParticleState,
    mlsMpmParticleState,
    baseGridSpacingM,
    minLevel,
    maxLevel,
    targetSupportCells,
    supportRadiusScale,
    chartId,
    minSupportRadiusM,
    maxSupportRadiusM,
    fallbackSupportRadiusM,
    hysteresisBand
  });
  const noFullReadback = readbackMode === SCHROEDER_NO_FULL_READBACK_MODE;
  const borrowedStateBuffer = optionalSourceStateBuffer(sphParticleUpload);
  const borrowedThermoBuffer = optionalSourceThermoBuffer(sphParticleUpload);
  const borrowedMechanicsBuffer = optionalSourceMechanicsBuffer(mlsMpmParticleUpload);
  const stateBuffer = borrowedStateBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-level-sph-state-in', sphParticleState.state);
  const thermoBuffer = borrowedThermoBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-level-sph-thermo-in', sphParticleState.thermo);
  const mechanicsBuffer = borrowedMechanicsBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-level-mls-mpm-mechanics-in', mlsMpmParticleState.mechanics);
  const assignmentBuffer = device.createBuffer({
    label: 'ulg-schroeder-level-assignments-out',
    size: plan.assignmentByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-schroeder-level-assignment-params',
    size: 48,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const readBuffer = noFullReadback
    ? null
    : device.createBuffer({
      label: 'ulg-schroeder-level-assignments-readback',
      size: plan.assignmentByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  let returnedRetainedAssignmentBuffer = false;

  try {
    device.queue.writeBuffer(paramsBuffer, 0, createSchroederLevelAssignmentParamsArray(plan));
    const bindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'read-only-storage'),
      computeBufferBinding(3, 'storage'),
      computeBufferBinding(4, 'uniform')
    ];
    const { pipeline, bindGroupLayout, cacheStatus } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-level-assignment.v0',
      label: 'ulg-schroeder-level-assignment',
      code: schroederLevelAssignmentWgsl,
      entryPoint: 'main',
      bindings
    });
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: stateBuffer } },
        { binding: 1, resource: { buffer: thermoBuffer } },
        { binding: 2, resource: { buffer: mechanicsBuffer } },
        { binding: 3, resource: { buffer: assignmentBuffer } },
        { binding: 4, resource: { buffer: paramsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.max(1, Math.ceil(plan.particleCount / SCHROEDER_LEVEL_ASSIGNMENT_WORKGROUP_SIZE)));
    pass.end();
    if (!noFullReadback) {
      encoder.copyBufferToBuffer(assignmentBuffer, 0, readBuffer, 0, plan.assignmentByteLength);
    }
    device.queue.submit([encoder.finish()]);

    let assignments = new Float32Array();
    if (!noFullReadback) {
      await readBuffer.mapAsync(GPU_MAP_MODE.READ);
      assignments = new Float32Array(readBuffer.getMappedRange()).slice(
        0,
        plan.particleCount * SCHROEDER_LEVEL_ASSIGNMENT_FLOATS
      );
      readBuffer.unmap();
    }

    const result = {
      ...plan,
      schema: ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA,
      assignmentSchema: plan.schema,
      status: 'schroeder-level-assignment-submitted',
      backend: 'webgpu',
      kernelScope: SCHROEDER_LEVEL_ASSIGNMENT_SCOPE,
      pipelineCacheStatus: cacheStatus,
      readbackMode: noFullReadback ? SCHROEDER_NO_FULL_READBACK_MODE : SCHROEDER_FULL_READBACK_MODE,
      fullReadbackPerformed: !noFullReadback,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: noFullReadback,
      retainedAssignmentBuffer: Boolean(retainAssignmentBuffer),
      assignmentBufferByteLength: plan.assignmentByteLength,
      assignments,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
    if (retainAssignmentBuffer) {
      result.assignmentBuffer = assignmentBuffer;
      result.destroyAssignmentBuffer = () => assignmentBuffer.destroy?.();
      returnedRetainedAssignmentBuffer = true;
    }
    return result;
  } finally {
    const cleanup = () => {
      if (!borrowedStateBuffer) stateBuffer.destroy?.();
      if (!borrowedThermoBuffer) thermoBuffer.destroy?.();
      if (!borrowedMechanicsBuffer) mechanicsBuffer.destroy?.();
      if (!retainAssignmentBuffer || !returnedRetainedAssignmentBuffer) assignmentBuffer.destroy?.();
      paramsBuffer.destroy?.();
      readBuffer?.destroy?.();
    };
    if (noFullReadback) {
      deferSubmittedWorkCleanup(device, cleanup);
    } else {
      cleanup();
    }
  }
}

export async function runSchroederActiveNodeListWebGpu({
  device,
  levelAssignment,
  tileCellCount = DEFAULT_TILE_CELL_COUNT,
  supportInflateCells = DEFAULT_SUPPORT_INFLATE_CELLS,
  minTileSpacingM = 0,
  maxTileSpacingM = 0,
  retainActiveNodeBuffer = true,
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSchroederActiveNodeListWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  const plan = createSchroederActiveNodeListPlan({
    levelAssignment,
    tileCellCount,
    supportInflateCells,
    minTileSpacingM,
    maxTileSpacingM
  });
  const noFullReadback = readbackMode === SCHROEDER_NO_FULL_READBACK_MODE;
  const borrowedAssignmentBuffer = levelAssignment?.assignmentBuffer || null;
  const assignmentRows = levelAssignment?.assignments instanceof Float32Array
    ? levelAssignment.assignments
    : null;
  if (!borrowedAssignmentBuffer && !(assignmentRows instanceof Float32Array)) {
    throw new TypeError('Schroeder active node list requires a retained assignment buffer or explicit assignment rows');
  }
  const assignmentBuffer = borrowedAssignmentBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-active-node-assignment-in', assignmentRows);
  const activeNodeBuffer = device.createBuffer({
    label: 'ulg-schroeder-active-nodes-out',
    size: plan.activeNodeByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-schroeder-active-node-params',
    size: 32,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const readBuffer = noFullReadback
    ? null
    : device.createBuffer({
      label: 'ulg-schroeder-active-nodes-readback',
      size: plan.activeNodeByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  let returnedRetainedActiveNodeBuffer = false;

  try {
    device.queue.writeBuffer(paramsBuffer, 0, createSchroederActiveNodeParamsArray(plan));
    const bindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'storage'),
      computeBufferBinding(2, 'uniform')
    ];
    const { pipeline, bindGroupLayout, cacheStatus } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-active-node-list.v0',
      label: 'ulg-schroeder-active-node-list',
      code: schroederActiveNodeListWgsl,
      entryPoint: 'main',
      bindings
    });
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: assignmentBuffer } },
        { binding: 1, resource: { buffer: activeNodeBuffer } },
        { binding: 2, resource: { buffer: paramsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.max(1, Math.ceil(plan.particleCount / SCHROEDER_ACTIVE_NODE_WORKGROUP_SIZE)));
    pass.end();
    if (!noFullReadback) {
      encoder.copyBufferToBuffer(activeNodeBuffer, 0, readBuffer, 0, plan.activeNodeByteLength);
    }
    device.queue.submit([encoder.finish()]);

    let activeNodes = new Float32Array();
    if (!noFullReadback) {
      await readBuffer.mapAsync(GPU_MAP_MODE.READ);
      activeNodes = new Float32Array(readBuffer.getMappedRange()).slice(
        0,
        plan.activeCandidateCount * SCHROEDER_ACTIVE_NODE_FLOATS
      );
      readBuffer.unmap();
    }

    const result = {
      ...plan,
      schema: ULG_SCHROEDER_ACTIVE_NODE_LIST_EXECUTION_SCHEMA,
      activeNodeListSchema: plan.schema,
      status: 'schroeder-active-node-list-submitted',
      backend: 'webgpu',
      pipelineCacheStatus: cacheStatus,
      readbackMode: noFullReadback ? SCHROEDER_NO_FULL_READBACK_MODE : SCHROEDER_FULL_ACTIVE_NODE_READBACK_MODE,
      fullReadbackPerformed: !noFullReadback,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: noFullReadback,
      retainedActiveNodeBuffer: Boolean(retainActiveNodeBuffer),
      activeNodeBufferByteLength: plan.activeNodeByteLength,
      activeNodes,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
    if (retainActiveNodeBuffer) {
      result.activeNodeBuffer = activeNodeBuffer;
      result.destroyActiveNodeBuffer = () => activeNodeBuffer.destroy?.();
      returnedRetainedActiveNodeBuffer = true;
    }
    return result;
  } finally {
    const cleanup = () => {
      if (!borrowedAssignmentBuffer) assignmentBuffer.destroy?.();
      if (!retainActiveNodeBuffer || !returnedRetainedActiveNodeBuffer) activeNodeBuffer.destroy?.();
      paramsBuffer.destroy?.();
      readBuffer?.destroy?.();
    };
    if (noFullReadback) {
      deferSubmittedWorkCleanup(device, cleanup);
    } else {
      cleanup();
    }
  }
}

export async function runSchroederCrossLevelCouplingWebGpu({
  device,
  levelAssignment,
  activeNodeList,
  parentLevelDelta = 1,
  baseGridSpacingM = levelAssignment?.baseGridSpacingM ?? DEFAULT_BASE_GRID_SPACING_M,
  maxLevel = levelAssignment?.maxLevel ?? DEFAULT_MAX_LEVEL,
  couplingHaloCells = DEFAULT_SUPPORT_INFLATE_CELLS,
  minCouplingRadiusM = 0,
  maxCouplingRadiusM = 0,
  tileCellCount = activeNodeList?.tileCellCount ?? DEFAULT_TILE_CELL_COUNT,
  retainCrossLevelBuffer = true,
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSchroederCrossLevelCouplingWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  const plan = createSchroederCrossLevelCouplingPlan({
    levelAssignment,
    activeNodeList,
    parentLevelDelta,
    baseGridSpacingM,
    maxLevel,
    couplingHaloCells,
    minCouplingRadiusM,
    maxCouplingRadiusM,
    tileCellCount
  });
  const noFullReadback = readbackMode === SCHROEDER_NO_FULL_READBACK_MODE;
  const borrowedAssignmentBuffer = levelAssignment?.assignmentBuffer || null;
  const assignmentRows = levelAssignment?.assignments instanceof Float32Array
    ? levelAssignment.assignments
    : null;
  if (!borrowedAssignmentBuffer && !(assignmentRows instanceof Float32Array)) {
    throw new TypeError('Schroeder cross-level coupling requires a retained assignment buffer or explicit assignment rows');
  }
  const borrowedActiveNodeBuffer = activeNodeList?.activeNodeBuffer || null;
  const activeNodeRows = activeNodeList?.activeNodes instanceof Float32Array
    ? activeNodeList.activeNodes
    : null;
  if (!borrowedActiveNodeBuffer && !(activeNodeRows instanceof Float32Array)) {
    throw new TypeError('Schroeder cross-level coupling requires a retained active-node buffer or explicit active-node rows');
  }
  const assignmentBuffer = borrowedAssignmentBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-cross-level-assignment-in', assignmentRows);
  const activeNodeBuffer = borrowedActiveNodeBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-cross-level-active-node-in', activeNodeRows);
  const crossLevelBuffer = device.createBuffer({
    label: 'ulg-schroeder-cross-level-couplings-out',
    size: plan.crossLevelByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-schroeder-cross-level-params',
    size: 48,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const readBuffer = noFullReadback
    ? null
    : device.createBuffer({
      label: 'ulg-schroeder-cross-level-couplings-readback',
      size: plan.crossLevelByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  let returnedRetainedCrossLevelBuffer = false;

  try {
    device.queue.writeBuffer(paramsBuffer, 0, createSchroederCrossLevelCouplingParamsArray(plan));
    const bindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'storage'),
      computeBufferBinding(3, 'uniform')
    ];
    const { pipeline, bindGroupLayout, cacheStatus } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-cross-level-coupling.v0',
      label: 'ulg-schroeder-cross-level-coupling',
      code: schroederCrossLevelCouplingWgsl,
      entryPoint: 'main',
      bindings
    });
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: assignmentBuffer } },
        { binding: 1, resource: { buffer: activeNodeBuffer } },
        { binding: 2, resource: { buffer: crossLevelBuffer } },
        { binding: 3, resource: { buffer: paramsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.max(
      1,
      Math.ceil(plan.particleCount / SCHROEDER_CROSS_LEVEL_COUPLING_WORKGROUP_SIZE)
    ));
    pass.end();
    if (!noFullReadback) {
      encoder.copyBufferToBuffer(crossLevelBuffer, 0, readBuffer, 0, plan.crossLevelByteLength);
    }
    device.queue.submit([encoder.finish()]);

    let crossLevelCouplings = new Float32Array();
    if (!noFullReadback) {
      await readBuffer.mapAsync(GPU_MAP_MODE.READ);
      crossLevelCouplings = new Float32Array(readBuffer.getMappedRange()).slice(
        0,
        plan.crossLevelCandidateCount * SCHROEDER_CROSS_LEVEL_COUPLING_FLOATS
      );
      readBuffer.unmap();
    }

    const result = {
      ...plan,
      schema: ULG_SCHROEDER_CROSS_LEVEL_COUPLING_EXECUTION_SCHEMA,
      crossLevelCouplingSchema: plan.schema,
      status: 'schroeder-cross-level-coupling-submitted',
      backend: 'webgpu',
      pipelineCacheStatus: cacheStatus,
      readbackMode: noFullReadback ? SCHROEDER_NO_FULL_READBACK_MODE : SCHROEDER_FULL_CROSS_LEVEL_READBACK_MODE,
      fullReadbackPerformed: !noFullReadback,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: noFullReadback,
      retainedCrossLevelBuffer: Boolean(retainCrossLevelBuffer),
      crossLevelBufferByteLength: plan.crossLevelByteLength,
      crossLevelCouplings,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
    if (retainCrossLevelBuffer) {
      result.crossLevelBuffer = crossLevelBuffer;
      result.destroyCrossLevelBuffer = () => crossLevelBuffer.destroy?.();
      returnedRetainedCrossLevelBuffer = true;
    }
    return result;
  } finally {
    const cleanup = () => {
      if (!borrowedAssignmentBuffer) assignmentBuffer.destroy?.();
      if (!borrowedActiveNodeBuffer) activeNodeBuffer.destroy?.();
      if (!retainCrossLevelBuffer || !returnedRetainedCrossLevelBuffer) crossLevelBuffer.destroy?.();
      paramsBuffer.destroy?.();
      readBuffer?.destroy?.();
    };
    if (noFullReadback) {
      deferSubmittedWorkCleanup(device, cleanup);
    } else {
      cleanup();
    }
  }
}

export async function runSchroederConservationSummaryWebGpu({
  device,
  crossLevelCoupling,
  retainSummaryBuffer = true,
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSchroederConservationSummaryWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  const plan = createSchroederConservationSummaryPlan({ crossLevelCoupling });
  const noFullReadback = readbackMode === SCHROEDER_NO_FULL_READBACK_MODE;
  const borrowedCrossLevelBuffer = crossLevelCoupling?.crossLevelBuffer || null;
  const crossLevelRows = crossLevelCoupling?.crossLevelCouplings instanceof Float32Array
    ? crossLevelCoupling.crossLevelCouplings
    : null;
  if (!borrowedCrossLevelBuffer && !(crossLevelRows instanceof Float32Array)) {
    throw new TypeError('Schroeder conservation summary requires a retained cross-level buffer or explicit rows');
  }
  const crossLevelBuffer = borrowedCrossLevelBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-conservation-cross-level-in', crossLevelRows);
  const summaryBuffer = device.createBuffer({
    label: 'ulg-schroeder-conservation-summary-out',
    size: plan.summaryByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-schroeder-conservation-summary-params',
    size: 16,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const readBuffer = noFullReadback
    ? null
    : device.createBuffer({
      label: 'ulg-schroeder-conservation-summary-readback',
      size: plan.summaryByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  let returnedRetainedSummaryBuffer = false;

  try {
    device.queue.writeBuffer(paramsBuffer, 0, createSchroederConservationSummaryParamsArray(plan));
    const bindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'storage'),
      computeBufferBinding(2, 'uniform')
    ];
    const { pipeline, bindGroupLayout, cacheStatus } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-conservation-summary.v0',
      label: 'ulg-schroeder-conservation-summary',
      code: schroederConservationSummaryWgsl,
      entryPoint: 'main',
      bindings
    });
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: crossLevelBuffer } },
        { binding: 1, resource: { buffer: summaryBuffer } },
        { binding: 2, resource: { buffer: paramsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(plan.summaryRowCount);
    pass.end();
    if (!noFullReadback) {
      encoder.copyBufferToBuffer(summaryBuffer, 0, readBuffer, 0, plan.summaryByteLength);
    }
    device.queue.submit([encoder.finish()]);

    let summaryRows = new Float32Array();
    if (!noFullReadback) {
      await readBuffer.mapAsync(GPU_MAP_MODE.READ);
      summaryRows = new Float32Array(readBuffer.getMappedRange()).slice(
        0,
        plan.summaryRowCount * SCHROEDER_CONSERVATION_SUMMARY_FLOATS
      );
      readBuffer.unmap();
    }

    const result = {
      ...plan,
      schema: ULG_SCHROEDER_CONSERVATION_SUMMARY_EXECUTION_SCHEMA,
      conservationSummarySchema: plan.schema,
      status: 'schroeder-conservation-summary-submitted',
      backend: 'webgpu',
      pipelineCacheStatus: cacheStatus,
      readbackMode: noFullReadback
        ? SCHROEDER_NO_FULL_READBACK_MODE
        : SCHROEDER_FULL_CONSERVATION_SUMMARY_READBACK_MODE,
      fullReadbackPerformed: !noFullReadback,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: noFullReadback,
      retainedSummaryBuffer: Boolean(retainSummaryBuffer),
      summaryBufferByteLength: plan.summaryByteLength,
      summaryRows,
      residualCounterStatus: 'workgroup-partial-summary-gpu-resident',
      conservativeTransferStatus: 'summary-only-no-state-mutation',
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
    if (retainSummaryBuffer) {
      result.summaryBuffer = summaryBuffer;
      result.destroySummaryBuffer = () => summaryBuffer.destroy?.();
      returnedRetainedSummaryBuffer = true;
    }
    return result;
  } finally {
    const cleanup = () => {
      if (!borrowedCrossLevelBuffer) crossLevelBuffer.destroy?.();
      if (!retainSummaryBuffer || !returnedRetainedSummaryBuffer) summaryBuffer.destroy?.();
      paramsBuffer.destroy?.();
      readBuffer?.destroy?.();
    };
    if (noFullReadback) {
      deferSubmittedWorkCleanup(device, cleanup);
    } else {
      cleanup();
    }
  }
}

export async function runSchroederCrossLevelTransferWebGpu({
  device,
  sphParticleState,
  sphParticleUpload = null,
  crossLevelCoupling,
  retainTransferBuffer = true,
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSchroederCrossLevelTransferWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  const plan = createSchroederCrossLevelTransferPlan({ crossLevelCoupling, sphParticleState });
  const noFullReadback = readbackMode === SCHROEDER_NO_FULL_READBACK_MODE;
  const borrowedCrossLevelBuffer = crossLevelCoupling?.crossLevelBuffer || null;
  const crossLevelRows = crossLevelCoupling?.crossLevelCouplings instanceof Float32Array
    ? crossLevelCoupling.crossLevelCouplings
    : null;
  if (!borrowedCrossLevelBuffer && !(crossLevelRows instanceof Float32Array)) {
    throw new TypeError('Schroeder cross-level transfer requires a retained cross-level buffer or explicit rows');
  }
  const borrowedStateBuffer = optionalSourceStateBuffer(sphParticleUpload);
  const crossLevelBuffer = borrowedCrossLevelBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-transfer-cross-level-in', crossLevelRows);
  const stateBuffer = borrowedStateBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-transfer-sph-state-in', sphParticleState.state);
  const transferBuffer = device.createBuffer({
    label: 'ulg-schroeder-cross-level-transfer-out',
    size: plan.transferByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-schroeder-cross-level-transfer-params',
    size: 32,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const readBuffer = noFullReadback
    ? null
    : device.createBuffer({
      label: 'ulg-schroeder-cross-level-transfer-readback',
      size: plan.transferByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  let returnedRetainedTransferBuffer = false;

  try {
    device.queue.writeBuffer(paramsBuffer, 0, createSchroederCrossLevelTransferParamsArray(plan));
    const bindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'storage'),
      computeBufferBinding(3, 'uniform')
    ];
    const { pipeline, bindGroupLayout, cacheStatus } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-cross-level-transfer.v0',
      label: 'ulg-schroeder-cross-level-transfer',
      code: schroederCrossLevelTransferWgsl,
      entryPoint: 'main',
      bindings
    });
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: crossLevelBuffer } },
        { binding: 1, resource: { buffer: stateBuffer } },
        { binding: 2, resource: { buffer: transferBuffer } },
        { binding: 3, resource: { buffer: paramsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.max(
      1,
      Math.ceil(plan.crossLevelCandidateCount / SCHROEDER_CROSS_LEVEL_TRANSFER_WORKGROUP_SIZE)
    ));
    pass.end();
    if (!noFullReadback) {
      encoder.copyBufferToBuffer(transferBuffer, 0, readBuffer, 0, plan.transferByteLength);
    }
    device.queue.submit([encoder.finish()]);

    let transferRows = new Float32Array();
    if (!noFullReadback) {
      await readBuffer.mapAsync(GPU_MAP_MODE.READ);
      transferRows = new Float32Array(readBuffer.getMappedRange()).slice(
        0,
        plan.crossLevelCandidateCount * SCHROEDER_CROSS_LEVEL_TRANSFER_FLOATS
      );
      readBuffer.unmap();
    }

    const result = {
      ...plan,
      schema: ULG_SCHROEDER_CROSS_LEVEL_TRANSFER_EXECUTION_SCHEMA,
      crossLevelTransferSchema: plan.schema,
      status: 'schroeder-cross-level-transfer-submitted',
      backend: 'webgpu',
      pipelineCacheStatus: cacheStatus,
      readbackMode: noFullReadback
        ? SCHROEDER_NO_FULL_READBACK_MODE
        : SCHROEDER_FULL_CROSS_LEVEL_TRANSFER_READBACK_MODE,
      fullReadbackPerformed: !noFullReadback,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: noFullReadback,
      retainedTransferBuffer: Boolean(retainTransferBuffer),
      transferBufferByteLength: plan.transferByteLength,
      transferRows,
      conservativeTransferStatus: 'transfer-rows-ready-no-state-mutation',
      stateMutationStatus: 'not-applied-transfer-rows-only',
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
    if (retainTransferBuffer) {
      result.transferBuffer = transferBuffer;
      result.destroyTransferBuffer = () => transferBuffer.destroy?.();
      returnedRetainedTransferBuffer = true;
    }
    return result;
  } finally {
    const cleanup = () => {
      if (!borrowedCrossLevelBuffer) crossLevelBuffer.destroy?.();
      if (!borrowedStateBuffer) stateBuffer.destroy?.();
      if (!retainTransferBuffer || !returnedRetainedTransferBuffer) transferBuffer.destroy?.();
      paramsBuffer.destroy?.();
      readBuffer?.destroy?.();
    };
    if (noFullReadback) {
      deferSubmittedWorkCleanup(device, cleanup);
    } else {
      cleanup();
    }
  }
}

export async function runSchroederCrossLevelStateDeltaWebGpu({
  device,
  crossLevelTransfer,
  retainStateDeltaBuffer = true,
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSchroederCrossLevelStateDeltaWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  const plan = createSchroederCrossLevelStateDeltaPlan({ crossLevelTransfer });
  const noFullReadback = readbackMode === SCHROEDER_NO_FULL_READBACK_MODE;
  const borrowedTransferBuffer = crossLevelTransfer?.transferBuffer || null;
  const transferRows = crossLevelTransfer?.transferRows instanceof Float32Array
    ? crossLevelTransfer.transferRows
    : null;
  if (!borrowedTransferBuffer && !(transferRows instanceof Float32Array)) {
    throw new TypeError('Schroeder cross-level state delta requires a retained transfer buffer or explicit rows');
  }
  const transferBuffer = borrowedTransferBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-state-delta-transfer-in', transferRows);
  const stateDeltaBuffer = device.createBuffer({
    label: 'ulg-schroeder-cross-level-state-delta-out',
    size: plan.stateDeltaByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-schroeder-cross-level-state-delta-params',
    size: 32,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const readBuffer = noFullReadback
    ? null
    : device.createBuffer({
      label: 'ulg-schroeder-cross-level-state-delta-readback',
      size: plan.stateDeltaByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  let returnedRetainedStateDeltaBuffer = false;

  try {
    device.queue.writeBuffer(paramsBuffer, 0, createSchroederCrossLevelStateDeltaParamsArray(plan));
    const bindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'storage'),
      computeBufferBinding(2, 'uniform')
    ];
    const { pipeline, bindGroupLayout, cacheStatus } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-cross-level-state-delta.v0',
      label: 'ulg-schroeder-cross-level-state-delta',
      code: schroederCrossLevelStateDeltaWgsl,
      entryPoint: 'main',
      bindings
    });
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: transferBuffer } },
        { binding: 1, resource: { buffer: stateDeltaBuffer } },
        { binding: 2, resource: { buffer: paramsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.max(
      1,
      Math.ceil(plan.crossLevelCandidateCount / SCHROEDER_CROSS_LEVEL_STATE_DELTA_WORKGROUP_SIZE)
    ));
    pass.end();
    if (!noFullReadback) {
      encoder.copyBufferToBuffer(stateDeltaBuffer, 0, readBuffer, 0, plan.stateDeltaByteLength);
    }
    device.queue.submit([encoder.finish()]);

    let stateDeltaRows = new Float32Array();
    if (!noFullReadback) {
      await readBuffer.mapAsync(GPU_MAP_MODE.READ);
      stateDeltaRows = new Float32Array(readBuffer.getMappedRange()).slice(
        0,
        plan.crossLevelCandidateCount * SCHROEDER_CROSS_LEVEL_STATE_DELTA_FLOATS
      );
      readBuffer.unmap();
    }

    const result = {
      ...plan,
      schema: ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_EXECUTION_SCHEMA,
      stateDeltaSchema: plan.schema,
      status: 'schroeder-cross-level-state-delta-submitted',
      backend: 'webgpu',
      pipelineCacheStatus: cacheStatus,
      readbackMode: noFullReadback
        ? SCHROEDER_NO_FULL_READBACK_MODE
        : SCHROEDER_FULL_CROSS_LEVEL_STATE_DELTA_READBACK_MODE,
      fullReadbackPerformed: !noFullReadback,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: noFullReadback,
      retainedStateDeltaBuffer: Boolean(retainStateDeltaBuffer),
      stateDeltaBufferByteLength: plan.stateDeltaByteLength,
      stateDeltaRows,
      conservativeTransferStatus: 'state-delta-ready-pending-admission',
      stateMutationStatus: 'pending-state-delta-submitted-awaiting-admission',
      stateAuthorityStatus: 'requires-state-manager-admission-before-authoritative-merge',
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
    if (retainStateDeltaBuffer) {
      result.stateDeltaBuffer = stateDeltaBuffer;
      result.destroyStateDeltaBuffer = () => stateDeltaBuffer.destroy?.();
      returnedRetainedStateDeltaBuffer = true;
    }
    return result;
  } finally {
    const cleanup = () => {
      if (!borrowedTransferBuffer) transferBuffer.destroy?.();
      if (!retainStateDeltaBuffer || !returnedRetainedStateDeltaBuffer) stateDeltaBuffer.destroy?.();
      paramsBuffer.destroy?.();
      readBuffer?.destroy?.();
    };
    if (noFullReadback) {
      deferSubmittedWorkCleanup(device, cleanup);
    } else {
      cleanup();
    }
  }
}

export async function runSchroederCrossLevelStateDeltaMergeWebGpu({
  device,
  crossLevelStateDelta,
  stateDeltaMergeAdmission = null,
  mergeEpoch = 0,
  retainMergedStateDeltaBuffer = true,
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSchroederCrossLevelStateDeltaMergeWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  const plan = createSchroederCrossLevelStateDeltaMergePlan({
    crossLevelStateDelta,
    stateDeltaMergeAdmission,
    mergeEpoch
  });
  const noFullReadback = readbackMode === SCHROEDER_NO_FULL_READBACK_MODE;
  if (!plan.stateDeltaMergeAdmissionApproved) {
    return {
      ...plan,
      schema: ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_EXECUTION_SCHEMA,
      stateDeltaMergeSchema: plan.schema,
      status: 'schroeder-cross-level-state-delta-merge-blocked-admission-required',
      backend: 'webgpu',
      readbackMode,
      fullReadbackPerformed: false,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: noFullReadback,
      retainedMergedStateDeltaBuffer: false,
      mergedStateDeltaBufferByteLength: 0,
      mergedStateDeltaRows: new Float32Array(),
      conservativeTransferStatus: 'state-delta-merge-blocked-admission-required',
      stateMutationStatus: 'blocked-state-delta-merge-admission-required',
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  }

  const borrowedStateDeltaBuffer = crossLevelStateDelta?.stateDeltaBuffer || null;
  const stateDeltaRows = crossLevelStateDelta?.stateDeltaRows instanceof Float32Array
    ? crossLevelStateDelta.stateDeltaRows
    : null;
  if (!borrowedStateDeltaBuffer && !(stateDeltaRows instanceof Float32Array)) {
    throw new TypeError('Schroeder cross-level state-delta merge requires a retained state-delta buffer or explicit rows');
  }
  const stateDeltaBuffer = borrowedStateDeltaBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-state-delta-merge-in', stateDeltaRows);
  const mergedStateDeltaBuffer = device.createBuffer({
    label: 'ulg-schroeder-cross-level-state-delta-merge-out',
    size: plan.mergeByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-schroeder-cross-level-state-delta-merge-params',
    size: 32,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const readBuffer = noFullReadback
    ? null
    : device.createBuffer({
      label: 'ulg-schroeder-cross-level-state-delta-merge-readback',
      size: plan.mergeByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  let returnedRetainedMergedStateDeltaBuffer = false;

  try {
    device.queue.writeBuffer(paramsBuffer, 0, createSchroederCrossLevelStateDeltaMergeParamsArray(plan));
    const bindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'storage'),
      computeBufferBinding(2, 'uniform')
    ];
    const { pipeline, bindGroupLayout, cacheStatus } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-cross-level-state-delta-merge.v0',
      label: 'ulg-schroeder-cross-level-state-delta-merge',
      code: schroederCrossLevelStateDeltaMergeWgsl,
      entryPoint: 'main',
      bindings
    });
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: stateDeltaBuffer } },
        { binding: 1, resource: { buffer: mergedStateDeltaBuffer } },
        { binding: 2, resource: { buffer: paramsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.max(
      1,
      Math.ceil(plan.crossLevelCandidateCount / SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_WORKGROUP_SIZE)
    ));
    pass.end();
    if (!noFullReadback) {
      encoder.copyBufferToBuffer(mergedStateDeltaBuffer, 0, readBuffer, 0, plan.mergeByteLength);
    }
    device.queue.submit([encoder.finish()]);

    let mergedStateDeltaRows = new Float32Array();
    if (!noFullReadback) {
      await readBuffer.mapAsync(GPU_MAP_MODE.READ);
      mergedStateDeltaRows = new Float32Array(readBuffer.getMappedRange()).slice(
        0,
        plan.crossLevelCandidateCount * SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_FLOATS
      );
      readBuffer.unmap();
    }

    const result = {
      ...plan,
      schema: ULG_SCHROEDER_CROSS_LEVEL_STATE_DELTA_MERGE_EXECUTION_SCHEMA,
      stateDeltaMergeSchema: plan.schema,
      status: 'schroeder-cross-level-state-delta-merge-submitted',
      backend: 'webgpu',
      pipelineCacheStatus: cacheStatus,
      readbackMode: noFullReadback
        ? SCHROEDER_NO_FULL_READBACK_MODE
        : SCHROEDER_FULL_CROSS_LEVEL_STATE_DELTA_MERGE_READBACK_MODE,
      fullReadbackPerformed: !noFullReadback,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: noFullReadback,
      retainedMergedStateDeltaBuffer: Boolean(retainMergedStateDeltaBuffer),
      mergedStateDeltaBufferByteLength: plan.mergeByteLength,
      mergedStateDeltaRows,
      conservativeTransferStatus: 'state-delta-merge-submitted',
      stateMutationStatus: 'admitted-state-delta-merge-buffer-submitted',
      stateAuthorityStatus: 'state-manager-admitted-retained-merge-buffer',
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
    if (retainMergedStateDeltaBuffer) {
      result.mergedStateDeltaBuffer = mergedStateDeltaBuffer;
      result.destroyMergedStateDeltaBuffer = () => mergedStateDeltaBuffer.destroy?.();
      returnedRetainedMergedStateDeltaBuffer = true;
    }
    return result;
  } finally {
    const cleanup = () => {
      if (!borrowedStateDeltaBuffer) stateDeltaBuffer.destroy?.();
      if (!retainMergedStateDeltaBuffer || !returnedRetainedMergedStateDeltaBuffer) mergedStateDeltaBuffer.destroy?.();
      paramsBuffer.destroy?.();
      readBuffer?.destroy?.();
    };
    if (noFullReadback) {
      deferSubmittedWorkCleanup(device, cleanup);
    } else {
      cleanup();
    }
  }
}

export async function runSchroederHierarchyAggregateWebGpu({
  device,
  crossLevelStateDeltaMerge,
  retainAggregateBuffer = true,
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSchroederHierarchyAggregateWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  const plan = createSchroederHierarchyAggregatePlan({ crossLevelStateDeltaMerge });
  const noFullReadback = readbackMode === SCHROEDER_NO_FULL_READBACK_MODE;
  const borrowedMergeBuffer = crossLevelStateDeltaMerge?.mergedStateDeltaBuffer || null;
  const mergeRows = crossLevelStateDeltaMerge?.mergedStateDeltaRows instanceof Float32Array
    ? crossLevelStateDeltaMerge.mergedStateDeltaRows
    : null;
  if (!borrowedMergeBuffer && !(mergeRows instanceof Float32Array)) {
    throw new TypeError('Schroeder hierarchy aggregate requires a retained merge buffer or explicit rows');
  }
  const mergeBuffer = borrowedMergeBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-hierarchy-aggregate-merge-in', mergeRows);
  const aggregateBuffer = device.createBuffer({
    label: 'ulg-schroeder-hierarchy-aggregate-out',
    size: plan.aggregateByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-schroeder-hierarchy-aggregate-params',
    size: 32,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const readBuffer = noFullReadback
    ? null
    : device.createBuffer({
      label: 'ulg-schroeder-hierarchy-aggregate-readback',
      size: plan.aggregateByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  let returnedRetainedAggregateBuffer = false;

  try {
    device.queue.writeBuffer(paramsBuffer, 0, createSchroederHierarchyAggregateParamsArray(plan));
    const bindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'storage'),
      computeBufferBinding(2, 'uniform')
    ];
    const { pipeline, bindGroupLayout, cacheStatus } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-hierarchy-aggregate.v0',
      label: 'ulg-schroeder-hierarchy-aggregate',
      code: schroederHierarchyAggregateWgsl,
      entryPoint: 'main',
      bindings
    });
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: mergeBuffer } },
        { binding: 1, resource: { buffer: aggregateBuffer } },
        { binding: 2, resource: { buffer: paramsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.max(
      1,
      Math.ceil(plan.aggregateRowCount / SCHROEDER_HIERARCHY_AGGREGATE_WORKGROUP_SIZE)
    ));
    pass.end();
    if (!noFullReadback) {
      encoder.copyBufferToBuffer(aggregateBuffer, 0, readBuffer, 0, plan.aggregateByteLength);
    }
    device.queue.submit([encoder.finish()]);

    let aggregateRows = new Float32Array();
    if (!noFullReadback) {
      await readBuffer.mapAsync(GPU_MAP_MODE.READ);
      aggregateRows = new Float32Array(readBuffer.getMappedRange()).slice(
        0,
        plan.aggregateRowCount * SCHROEDER_HIERARCHY_AGGREGATE_FLOATS
      );
      readBuffer.unmap();
    }

    const result = {
      ...plan,
      schema: ULG_SCHROEDER_HIERARCHY_AGGREGATE_EXECUTION_SCHEMA,
      hierarchyAggregateSchema: plan.schema,
      status: 'schroeder-hierarchy-aggregate-submitted',
      backend: 'webgpu',
      pipelineCacheStatus: cacheStatus,
      readbackMode: noFullReadback
        ? SCHROEDER_NO_FULL_READBACK_MODE
        : SCHROEDER_FULL_HIERARCHY_AGGREGATE_READBACK_MODE,
      fullReadbackPerformed: !noFullReadback,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: noFullReadback,
      retainedAggregateBuffer: Boolean(retainAggregateBuffer),
      aggregateBufferByteLength: plan.aggregateByteLength,
      aggregateRows,
      aggregateReductionStatus: 'pending-keyed-reduction',
      conservativeTransferStatus: 'hierarchy-aggregate-contributions-submitted',
      stateMutationStatus: 'aggregate-contribution-buffer-submitted',
      stateAuthorityStatus: 'state-manager-admitted-merge-buffer-materialized',
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
    if (retainAggregateBuffer) {
      result.aggregateBuffer = aggregateBuffer;
      result.destroyAggregateBuffer = () => aggregateBuffer.destroy?.();
      returnedRetainedAggregateBuffer = true;
    }
    return result;
  } finally {
    const cleanup = () => {
      if (!borrowedMergeBuffer) mergeBuffer.destroy?.();
      if (!retainAggregateBuffer || !returnedRetainedAggregateBuffer) aggregateBuffer.destroy?.();
      paramsBuffer.destroy?.();
      readBuffer?.destroy?.();
    };
    if (noFullReadback) {
      deferSubmittedWorkCleanup(device, cleanup);
    } else {
      cleanup();
    }
  }
}

export async function runSchroederHierarchyAggregateNodeReductionWebGpu({
  device,
  hierarchyAggregate,
  retainAggregateNodeBuffer = true,
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSchroederHierarchyAggregateNodeReductionWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  const plan = createSchroederHierarchyAggregateNodePlan({ hierarchyAggregate });
  const noFullReadback = readbackMode === SCHROEDER_NO_FULL_READBACK_MODE;
  const borrowedAggregateBuffer = hierarchyAggregate?.aggregateBuffer || null;
  const aggregateRows = hierarchyAggregate?.aggregateRows instanceof Float32Array
    ? hierarchyAggregate.aggregateRows
    : null;
  if (!borrowedAggregateBuffer && !(aggregateRows instanceof Float32Array)) {
    throw new TypeError('Schroeder hierarchy aggregate-node reduction requires a retained aggregate buffer or explicit rows');
  }
  const aggregateBuffer = borrowedAggregateBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-hierarchy-aggregate-node-in', aggregateRows);
  const aggregateNodeBuffer = device.createBuffer({
    label: 'ulg-schroeder-hierarchy-aggregate-nodes-out',
    size: plan.aggregateNodeByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-schroeder-hierarchy-aggregate-node-params',
    size: 32,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const readBuffer = noFullReadback
    ? null
    : device.createBuffer({
      label: 'ulg-schroeder-hierarchy-aggregate-node-readback',
      size: plan.aggregateNodeByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  let returnedRetainedAggregateNodeBuffer = false;

  try {
    device.queue.writeBuffer(paramsBuffer, 0, createSchroederHierarchyAggregateNodeParamsArray(plan));
    const bindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'storage'),
      computeBufferBinding(2, 'uniform')
    ];
    const { pipeline, bindGroupLayout, cacheStatus } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-hierarchy-aggregate-node-reduction.v0',
      label: 'ulg-schroeder-hierarchy-aggregate-node-reduction',
      code: schroederHierarchyAggregateNodeReduceWgsl,
      entryPoint: 'main',
      bindings
    });
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: aggregateBuffer } },
        { binding: 1, resource: { buffer: aggregateNodeBuffer } },
        { binding: 2, resource: { buffer: paramsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.max(
      1,
      Math.ceil(plan.aggregateRowCount / SCHROEDER_HIERARCHY_AGGREGATE_NODE_WORKGROUP_SIZE)
    ));
    pass.end();
    if (!noFullReadback) {
      encoder.copyBufferToBuffer(aggregateNodeBuffer, 0, readBuffer, 0, plan.aggregateNodeByteLength);
    }
    device.queue.submit([encoder.finish()]);

    let aggregateNodeRows = new Float32Array();
    if (!noFullReadback) {
      await readBuffer.mapAsync(GPU_MAP_MODE.READ);
      aggregateNodeRows = new Float32Array(readBuffer.getMappedRange()).slice(
        0,
        plan.aggregateRowCount * SCHROEDER_HIERARCHY_AGGREGATE_NODE_FLOATS
      );
      readBuffer.unmap();
    }

    const result = {
      ...plan,
      schema: ULG_SCHROEDER_HIERARCHY_AGGREGATE_NODE_EXECUTION_SCHEMA,
      hierarchyAggregateNodeSchema: plan.schema,
      status: 'schroeder-hierarchy-aggregate-node-reduction-submitted',
      backend: 'webgpu',
      pipelineCacheStatus: cacheStatus,
      readbackMode: noFullReadback
        ? SCHROEDER_NO_FULL_READBACK_MODE
        : SCHROEDER_FULL_HIERARCHY_AGGREGATE_NODE_READBACK_MODE,
      fullReadbackPerformed: !noFullReadback,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: noFullReadback,
      retainedAggregateNodeBuffer: Boolean(retainAggregateNodeBuffer),
      aggregateNodeBufferByteLength: plan.aggregateNodeByteLength,
      aggregateNodeRows,
      aggregateReductionStatus: 'exact-first-occurrence-global-scan',
      aggregateReductionMode: 'gpu-exact-global-scan-o-n2',
      capacityStatus: 'no-extra-capacity-required-output-row-per-input-row',
      conservativeTransferStatus: 'hierarchy-aggregate-nodes-submitted',
      stateMutationStatus: 'aggregate-node-buffer-submitted',
      stateAuthorityStatus: 'state-manager-admitted-aggregate-nodes-materialized',
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
    if (retainAggregateNodeBuffer) {
      result.aggregateNodeBuffer = aggregateNodeBuffer;
      result.destroyAggregateNodeBuffer = () => aggregateNodeBuffer.destroy?.();
      returnedRetainedAggregateNodeBuffer = true;
    }
    return result;
  } finally {
    const cleanup = () => {
      if (!borrowedAggregateBuffer) aggregateBuffer.destroy?.();
      if (!retainAggregateNodeBuffer || !returnedRetainedAggregateNodeBuffer) aggregateNodeBuffer.destroy?.();
      paramsBuffer.destroy?.();
      readBuffer?.destroy?.();
    };
    if (noFullReadback) {
      deferSubmittedWorkCleanup(device, cleanup);
    } else {
      cleanup();
    }
  }
}

export async function runSchroederPhaseVolumeMigrationWebGpu({
  device,
  levelAssignment,
  hierarchyAggregateNode,
  baseGridSpacingM = levelAssignment?.baseGridSpacingM ?? DEFAULT_BASE_GRID_SPACING_M,
  minLevel = levelAssignment?.minLevel ?? DEFAULT_MIN_LEVEL,
  maxLevel = levelAssignment?.maxLevel ?? DEFAULT_MAX_LEVEL,
  targetSupportCells = levelAssignment?.targetSupportCells ?? DEFAULT_TARGET_SUPPORT_CELLS,
  supportRadiusScale = levelAssignment?.supportRadiusScale ?? DEFAULT_SUPPORT_RADIUS_SCALE,
  phaseVolumeExpandThreshold = DEFAULT_PHASE_VOLUME_EXPAND_THRESHOLD,
  coarsenLevelDeltaThreshold = DEFAULT_COARSEN_LEVEL_DELTA_THRESHOLD,
  gasPhaseId = DEFAULT_GAS_PHASE_ID,
  migrationEpoch = 0,
  aggregateResidualTolerance = DEFAULT_AGGREGATE_RESIDUAL_TOLERANCE,
  retainMigrationBuffer = true,
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSchroederPhaseVolumeMigrationWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  const plan = createSchroederPhaseVolumeMigrationPlan({
    levelAssignment,
    hierarchyAggregateNode,
    baseGridSpacingM,
    minLevel,
    maxLevel,
    targetSupportCells,
    supportRadiusScale,
    phaseVolumeExpandThreshold,
    coarsenLevelDeltaThreshold,
    gasPhaseId,
    migrationEpoch,
    aggregateResidualTolerance
  });
  const noFullReadback = readbackMode === SCHROEDER_NO_FULL_READBACK_MODE;
  const borrowedAssignmentBuffer = levelAssignment?.assignmentBuffer || null;
  const assignmentRows = levelAssignment?.assignments instanceof Float32Array
    ? levelAssignment.assignments
    : null;
  if (!borrowedAssignmentBuffer && !(assignmentRows instanceof Float32Array)) {
    throw new TypeError('Schroeder phase-volume migration requires a retained assignment buffer or explicit rows');
  }
  const borrowedAggregateNodeBuffer = hierarchyAggregateNode?.aggregateNodeBuffer || null;
  const aggregateNodeRows = hierarchyAggregateNode?.aggregateNodeRows instanceof Float32Array
    ? hierarchyAggregateNode.aggregateNodeRows
    : null;
  if (!borrowedAggregateNodeBuffer && !(aggregateNodeRows instanceof Float32Array)) {
    throw new TypeError('Schroeder phase-volume migration requires a retained aggregate-node buffer or explicit rows');
  }

  const assignmentBuffer = borrowedAssignmentBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-phase-volume-assignment-in', assignmentRows);
  const aggregateNodeBuffer = borrowedAggregateNodeBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-phase-volume-aggregate-node-in', aggregateNodeRows);
  const migrationBuffer = device.createBuffer({
    label: 'ulg-schroeder-phase-volume-migration-out',
    size: plan.migrationByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-schroeder-phase-volume-migration-params',
    size: 64,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const readBuffer = noFullReadback
    ? null
    : device.createBuffer({
      label: 'ulg-schroeder-phase-volume-migration-readback',
      size: plan.migrationByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  let returnedRetainedMigrationBuffer = false;

  try {
    device.queue.writeBuffer(paramsBuffer, 0, createSchroederPhaseVolumeMigrationParamsArray(plan));
    const bindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'storage'),
      computeBufferBinding(3, 'uniform')
    ];
    const { pipeline, bindGroupLayout, cacheStatus } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-phase-volume-migration.v0',
      label: 'ulg-schroeder-phase-volume-migration',
      code: schroederPhaseVolumeMigrationWgsl,
      entryPoint: 'main',
      bindings
    });
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: assignmentBuffer } },
        { binding: 1, resource: { buffer: aggregateNodeBuffer } },
        { binding: 2, resource: { buffer: migrationBuffer } },
        { binding: 3, resource: { buffer: paramsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.max(
      1,
      Math.ceil(plan.particleCount / SCHROEDER_PHASE_VOLUME_MIGRATION_WORKGROUP_SIZE)
    ));
    pass.end();
    if (!noFullReadback) {
      encoder.copyBufferToBuffer(migrationBuffer, 0, readBuffer, 0, plan.migrationByteLength);
    }
    device.queue.submit([encoder.finish()]);

    let migrationRows = new Float32Array();
    if (!noFullReadback) {
      await readBuffer.mapAsync(GPU_MAP_MODE.READ);
      migrationRows = new Float32Array(readBuffer.getMappedRange()).slice(
        0,
        plan.particleCount * SCHROEDER_PHASE_VOLUME_MIGRATION_FLOATS
      );
      readBuffer.unmap();
    }

    const result = {
      ...plan,
      schema: ULG_SCHROEDER_PHASE_VOLUME_MIGRATION_EXECUTION_SCHEMA,
      phaseVolumeMigrationSchema: plan.schema,
      status: 'schroeder-phase-volume-migration-submitted',
      backend: 'webgpu',
      pipelineCacheStatus: cacheStatus,
      readbackMode: noFullReadback
        ? SCHROEDER_NO_FULL_READBACK_MODE
        : SCHROEDER_FULL_PHASE_VOLUME_MIGRATION_READBACK_MODE,
      fullReadbackPerformed: !noFullReadback,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: noFullReadback,
      retainedMigrationBuffer: Boolean(retainMigrationBuffer),
      migrationBufferByteLength: plan.migrationByteLength,
      migrationRows,
      phaseVolumeStatus: 'phase-volume-migration-submitted',
      migrationMode: 'physical-volume-level-target-with-aggregate-coherence',
      aggregateCoherenceRequirement: 'retained-aggregate-node-buffer-consumed',
      conservativeTransferStatus: 'phase-volume-migration-submitted',
      stateMutationStatus: 'phase-volume-migration-buffer-submitted',
      stateAuthorityStatus: 'requires-state-manager-admission-for-authoritative-level-migration',
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
    if (retainMigrationBuffer) {
      result.migrationBuffer = migrationBuffer;
      result.destroyMigrationBuffer = () => migrationBuffer.destroy?.();
      returnedRetainedMigrationBuffer = true;
    }
    return result;
  } finally {
    const cleanup = () => {
      if (!borrowedAssignmentBuffer) assignmentBuffer.destroy?.();
      if (!borrowedAggregateNodeBuffer) aggregateNodeBuffer.destroy?.();
      if (!retainMigrationBuffer || !returnedRetainedMigrationBuffer) migrationBuffer.destroy?.();
      paramsBuffer.destroy?.();
      readBuffer?.destroy?.();
    };
    if (noFullReadback) {
      deferSubmittedWorkCleanup(device, cleanup);
    } else {
      cleanup();
    }
  }
}

export async function runSchroederPhaseVolumeLevelUpdateWebGpu({
  device,
  phaseVolumeMigration,
  phaseVolumeMigrationAdmission = null,
  migrationEpoch = phaseVolumeMigration?.migrationEpoch ?? 0,
  stateFamilyId = 1,
  retainLevelUpdateBuffer = true,
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSchroederPhaseVolumeLevelUpdateWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  const plan = createSchroederPhaseVolumeLevelUpdatePlan({
    phaseVolumeMigration,
    phaseVolumeMigrationAdmission,
    migrationEpoch,
    stateFamilyId
  });
  const noFullReadback = readbackMode === SCHROEDER_NO_FULL_READBACK_MODE;
  if (!plan.phaseVolumeMigrationAdmissionApproved) {
    return {
      ...plan,
      schema: ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_EXECUTION_SCHEMA,
      phaseVolumeLevelUpdateSchema: plan.schema,
      status: 'schroeder-phase-volume-level-update-blocked-admission-required',
      backend: 'webgpu',
      readbackMode,
      fullReadbackPerformed: false,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: noFullReadback,
      retainedLevelUpdateBuffer: false,
      levelUpdateBufferByteLength: 0,
      levelUpdateRows: new Float32Array(),
      conservativeTransferStatus: 'phase-volume-level-update-blocked-admission-required',
      stateMutationStatus: 'blocked-phase-volume-level-update-admission-required',
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  }

  const borrowedMigrationBuffer = phaseVolumeMigration?.migrationBuffer || null;
  const migrationRows = phaseVolumeMigration?.migrationRows instanceof Float32Array
    ? phaseVolumeMigration.migrationRows
    : null;
  if (!borrowedMigrationBuffer && !(migrationRows instanceof Float32Array)) {
    throw new TypeError('Schroeder phase-volume level update requires a retained migration buffer or explicit rows');
  }
  const migrationBuffer = borrowedMigrationBuffer
    || writeStorageBuffer(device, 'ulg-schroeder-phase-volume-level-update-in', migrationRows);
  const levelUpdateBuffer = device.createBuffer({
    label: 'ulg-schroeder-phase-volume-level-update-out',
    size: plan.levelUpdateByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-schroeder-phase-volume-level-update-params',
    size: 32,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const readBuffer = noFullReadback
    ? null
    : device.createBuffer({
      label: 'ulg-schroeder-phase-volume-level-update-readback',
      size: plan.levelUpdateByteLength,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  let returnedRetainedLevelUpdateBuffer = false;

  try {
    device.queue.writeBuffer(paramsBuffer, 0, createSchroederPhaseVolumeLevelUpdateParamsArray({
      ...plan,
      admissionApproved: plan.phaseVolumeMigrationAdmissionApproved
    }));
    const bindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'storage'),
      computeBufferBinding(2, 'uniform')
    ];
    const { pipeline, bindGroupLayout, cacheStatus } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-phase-volume-level-update.v0',
      label: 'ulg-schroeder-phase-volume-level-update',
      code: schroederPhaseVolumeLevelUpdateWgsl,
      entryPoint: 'main',
      bindings
    });
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: migrationBuffer } },
        { binding: 1, resource: { buffer: levelUpdateBuffer } },
        { binding: 2, resource: { buffer: paramsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.max(
      1,
      Math.ceil(plan.migrationRowCount / SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_WORKGROUP_SIZE)
    ));
    pass.end();
    if (!noFullReadback) {
      encoder.copyBufferToBuffer(levelUpdateBuffer, 0, readBuffer, 0, plan.levelUpdateByteLength);
    }
    device.queue.submit([encoder.finish()]);

    let levelUpdateRows = new Float32Array();
    if (!noFullReadback) {
      await readBuffer.mapAsync(GPU_MAP_MODE.READ);
      levelUpdateRows = new Float32Array(readBuffer.getMappedRange()).slice(
        0,
        plan.migrationRowCount * SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_FLOATS
      );
      readBuffer.unmap();
    }

    const result = {
      ...plan,
      schema: ULG_SCHROEDER_PHASE_VOLUME_LEVEL_UPDATE_EXECUTION_SCHEMA,
      phaseVolumeLevelUpdateSchema: plan.schema,
      status: 'schroeder-phase-volume-level-update-submitted',
      backend: 'webgpu',
      pipelineCacheStatus: cacheStatus,
      readbackMode: noFullReadback
        ? SCHROEDER_NO_FULL_READBACK_MODE
        : SCHROEDER_FULL_PHASE_VOLUME_LEVEL_UPDATE_READBACK_MODE,
      fullReadbackPerformed: !noFullReadback,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: noFullReadback,
      retainedLevelUpdateBuffer: Boolean(retainLevelUpdateBuffer),
      levelUpdateBufferByteLength: plan.levelUpdateByteLength,
      levelUpdateRows,
      conservativeTransferStatus: 'phase-volume-level-update-submitted',
      stateMutationStatus: 'phase-volume-level-update-buffer-submitted',
      stateAuthorityStatus: 'state-manager-admitted-phase-volume-level-update-materialized',
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
    if (retainLevelUpdateBuffer) {
      result.levelUpdateBuffer = levelUpdateBuffer;
      result.destroyLevelUpdateBuffer = () => levelUpdateBuffer.destroy?.();
      returnedRetainedLevelUpdateBuffer = true;
    }
    return result;
  } finally {
    const cleanup = () => {
      if (!borrowedMigrationBuffer) migrationBuffer.destroy?.();
      if (!retainLevelUpdateBuffer || !returnedRetainedLevelUpdateBuffer) levelUpdateBuffer.destroy?.();
      paramsBuffer.destroy?.();
      readBuffer?.destroy?.();
    };
    if (noFullReadback) {
      deferSubmittedWorkCleanup(device, cleanup);
    } else {
      cleanup();
    }
  }
}

export async function runSchroederSameLevelMechanicsWebGpu({
  device,
  sphParticleState,
  mlsMpmParticleState,
  sphParticleUpload = null,
  mlsMpmParticleUpload = null,
  levelAssignment = null,
  activeNodeList = null,
  crossLevelCoupling = null,
  conservationSummary = null,
  crossLevelTransfer = null,
  crossLevelStateDelta = null,
  crossLevelStateDeltaMerge = null,
  hierarchyAggregate = null,
  hierarchyAggregateNode = null,
  phaseVolumeMigration = null,
  phaseVolumeLevelUpdate = null,
  stateDeltaMergeAdmission = null,
  phaseVolumeMigrationAdmission = null,
  selectedLevel = 0,
  baseGridSpacingM = sphParticleState?.smoothingLengthM ?? DEFAULT_BASE_GRID_SPACING_M,
  minLevel = DEFAULT_MIN_LEVEL,
  maxLevel = DEFAULT_MAX_LEVEL,
  targetSupportCells = DEFAULT_TARGET_SUPPORT_CELLS,
  supportRadiusScale = DEFAULT_SUPPORT_RADIUS_SCALE,
  tileCellCount = DEFAULT_TILE_CELL_COUNT,
  supportInflateCells = DEFAULT_SUPPORT_INFLATE_CELLS,
  enableCrossLevelCoupling = true,
  enableConservationSummary = enableCrossLevelCoupling,
  enableCrossLevelTransfer = enableConservationSummary,
  enableCrossLevelStateDelta = enableCrossLevelTransfer,
  enableCrossLevelStateDeltaMerge = Boolean(stateDeltaMergeAdmission),
  enableHierarchyAggregate = enableCrossLevelStateDeltaMerge,
  enableHierarchyAggregateNodeReduction = enableHierarchyAggregate,
  enablePhaseVolumeMigration = enableHierarchyAggregateNodeReduction,
  enablePhaseVolumeLevelUpdate = Boolean(phaseVolumeMigrationAdmission),
  parentLevelDelta = 1,
  couplingHaloCells = supportInflateCells,
  minCouplingRadiusM = 0,
  maxCouplingRadiusM = 0,
  phaseVolumeExpandThreshold = DEFAULT_PHASE_VOLUME_EXPAND_THRESHOLD,
  coarsenLevelDeltaThreshold = DEFAULT_COARSEN_LEVEL_DELTA_THRESHOLD,
  gasPhaseId = DEFAULT_GAS_PHASE_ID,
  aggregateResidualTolerance = DEFAULT_AGGREGATE_RESIDUAL_TOLERANCE,
  boxDimsM = [5, 5, 5],
  dt = mlsMpmParticleState?.mechanicsDtS ?? 0,
  gravityMPerS2 = mlsMpmParticleState?.gravityMPerS2,
  cflFactor = mlsMpmParticleState?.gridCflFactor,
  readbackMode = SCHROEDER_NO_FULL_READBACK_MODE,
  crossLevelCouplingRunner = runSchroederCrossLevelCouplingWebGpu,
  conservationSummaryRunner = runSchroederConservationSummaryWebGpu,
  crossLevelTransferRunner = runSchroederCrossLevelTransferWebGpu,
  crossLevelStateDeltaRunner = runSchroederCrossLevelStateDeltaWebGpu,
  crossLevelStateDeltaMergeRunner = runSchroederCrossLevelStateDeltaMergeWebGpu,
  hierarchyAggregateRunner = runSchroederHierarchyAggregateWebGpu,
  hierarchyAggregateNodeReductionRunner = runSchroederHierarchyAggregateNodeReductionWebGpu,
  phaseVolumeMigrationRunner = runSchroederPhaseVolumeMigrationWebGpu,
  phaseVolumeLevelUpdateRunner = runSchroederPhaseVolumeLevelUpdateWebGpu,
  mergeEpoch = 0,
  residentStepRunner = runMlsMpmResidentStepWithOptionalWebGpu,
  residentStepOptions = {}
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSchroederSameLevelMechanicsWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  if (typeof residentStepRunner !== 'function') {
    throw new TypeError('runSchroederSameLevelMechanicsWebGpu requires a residentStepRunner function');
  }
  if (enableCrossLevelCoupling && typeof crossLevelCouplingRunner !== 'function') {
    throw new TypeError('runSchroederSameLevelMechanicsWebGpu requires a crossLevelCouplingRunner function');
  }
  if (enableCrossLevelCoupling && enableConservationSummary && typeof conservationSummaryRunner !== 'function') {
    throw new TypeError('runSchroederSameLevelMechanicsWebGpu requires a conservationSummaryRunner function');
  }
  if (enableCrossLevelCoupling && enableCrossLevelTransfer && typeof crossLevelTransferRunner !== 'function') {
    throw new TypeError('runSchroederSameLevelMechanicsWebGpu requires a crossLevelTransferRunner function');
  }
  if (enableCrossLevelCoupling && enableCrossLevelTransfer && enableCrossLevelStateDelta && typeof crossLevelStateDeltaRunner !== 'function') {
    throw new TypeError('runSchroederSameLevelMechanicsWebGpu requires a crossLevelStateDeltaRunner function');
  }
  if (
    enableCrossLevelCoupling
    && enableCrossLevelTransfer
    && enableCrossLevelStateDelta
    && enableCrossLevelStateDeltaMerge
    && typeof crossLevelStateDeltaMergeRunner !== 'function'
  ) {
    throw new TypeError('runSchroederSameLevelMechanicsWebGpu requires a crossLevelStateDeltaMergeRunner function');
  }
  if (
    enableCrossLevelCoupling
    && enableCrossLevelTransfer
    && enableCrossLevelStateDelta
    && enableCrossLevelStateDeltaMerge
    && enableHierarchyAggregate
    && typeof hierarchyAggregateRunner !== 'function'
  ) {
    throw new TypeError('runSchroederSameLevelMechanicsWebGpu requires a hierarchyAggregateRunner function');
  }
  if (
    enableCrossLevelCoupling
    && enableCrossLevelTransfer
    && enableCrossLevelStateDelta
    && enableCrossLevelStateDeltaMerge
    && enableHierarchyAggregate
    && enableHierarchyAggregateNodeReduction
    && typeof hierarchyAggregateNodeReductionRunner !== 'function'
  ) {
    throw new TypeError('runSchroederSameLevelMechanicsWebGpu requires a hierarchyAggregateNodeReductionRunner function');
  }
  if (
    enableCrossLevelCoupling
    && enableCrossLevelTransfer
    && enableCrossLevelStateDelta
    && enableCrossLevelStateDeltaMerge
    && enableHierarchyAggregate
    && enableHierarchyAggregateNodeReduction
    && enablePhaseVolumeMigration
    && typeof phaseVolumeMigrationRunner !== 'function'
  ) {
    throw new TypeError('runSchroederSameLevelMechanicsWebGpu requires a phaseVolumeMigrationRunner function');
  }
  if (
    enableCrossLevelCoupling
    && enableCrossLevelTransfer
    && enableCrossLevelStateDelta
    && enableCrossLevelStateDeltaMerge
    && enableHierarchyAggregate
    && enableHierarchyAggregateNodeReduction
    && enablePhaseVolumeMigration
    && enablePhaseVolumeLevelUpdate
    && typeof phaseVolumeLevelUpdateRunner !== 'function'
  ) {
    throw new TypeError('runSchroederSameLevelMechanicsWebGpu requires a phaseVolumeLevelUpdateRunner function');
  }
  const plan = createSchroederSameLevelMechanicsPlan({
    sphParticleState,
    mlsMpmParticleState,
    selectedLevel,
    baseGridSpacingM,
    minLevel,
    maxLevel,
    readbackMode,
    tileCellCount
  });
  const resolvedLevelAssignment = levelAssignment || await runSchroederLevelAssignmentWebGpu({
    device,
    sphParticleState,
    mlsMpmParticleState,
    sphParticleUpload,
    mlsMpmParticleUpload,
    baseGridSpacingM: plan.baseGridSpacingM,
    minLevel: plan.minLevel,
    maxLevel: plan.maxLevel,
    targetSupportCells,
    supportRadiusScale,
    retainAssignmentBuffer: true,
    readbackMode
  });
  const resolvedActiveNodeList = activeNodeList || await runSchroederActiveNodeListWebGpu({
    device,
    levelAssignment: resolvedLevelAssignment,
    tileCellCount,
    supportInflateCells,
    retainActiveNodeBuffer: true,
    readbackMode
  });
  const resolvedCrossLevelCoupling = !enableCrossLevelCoupling
    ? null
    : crossLevelCoupling || await crossLevelCouplingRunner({
      device,
      levelAssignment: resolvedLevelAssignment,
      activeNodeList: resolvedActiveNodeList,
      parentLevelDelta,
      baseGridSpacingM: plan.baseGridSpacingM,
      maxLevel: plan.maxLevel,
      couplingHaloCells,
      minCouplingRadiusM,
      maxCouplingRadiusM,
      tileCellCount,
      retainCrossLevelBuffer: true,
      readbackMode
    });
  const resolvedConservationSummary = !resolvedCrossLevelCoupling || !enableConservationSummary
    ? null
    : conservationSummary || await conservationSummaryRunner({
      device,
      crossLevelCoupling: resolvedCrossLevelCoupling,
      retainSummaryBuffer: true,
      readbackMode
    });
  const resolvedCrossLevelTransfer = !resolvedCrossLevelCoupling || !enableCrossLevelTransfer
    ? null
    : crossLevelTransfer || await crossLevelTransferRunner({
      device,
      sphParticleState,
      sphParticleUpload,
      crossLevelCoupling: resolvedCrossLevelCoupling,
      retainTransferBuffer: true,
      readbackMode
    });
  const resolvedCrossLevelStateDelta = !resolvedCrossLevelTransfer || !enableCrossLevelStateDelta
    ? null
    : crossLevelStateDelta || await crossLevelStateDeltaRunner({
      device,
      crossLevelTransfer: resolvedCrossLevelTransfer,
      retainStateDeltaBuffer: true,
      readbackMode
    });
  const resolvedCrossLevelStateDeltaMerge = !resolvedCrossLevelStateDelta || !enableCrossLevelStateDeltaMerge
    ? null
    : crossLevelStateDeltaMerge || await crossLevelStateDeltaMergeRunner({
      device,
      crossLevelStateDelta: resolvedCrossLevelStateDelta,
      stateDeltaMergeAdmission,
      mergeEpoch,
      retainMergedStateDeltaBuffer: true,
      readbackMode
    });
  const resolvedHierarchyAggregate = !resolvedCrossLevelStateDeltaMerge || !enableHierarchyAggregate
    ? null
    : hierarchyAggregate || await hierarchyAggregateRunner({
      device,
      crossLevelStateDeltaMerge: resolvedCrossLevelStateDeltaMerge,
      retainAggregateBuffer: true,
      readbackMode
    });
  const resolvedHierarchyAggregateNode = !resolvedHierarchyAggregate || !enableHierarchyAggregateNodeReduction
    ? null
    : hierarchyAggregateNode || await hierarchyAggregateNodeReductionRunner({
      device,
      hierarchyAggregate: resolvedHierarchyAggregate,
      retainAggregateNodeBuffer: true,
      readbackMode
    });
  const resolvedPhaseVolumeMigration = !resolvedLevelAssignment || !resolvedHierarchyAggregateNode || !enablePhaseVolumeMigration
    ? null
    : phaseVolumeMigration || await phaseVolumeMigrationRunner({
      device,
      levelAssignment: resolvedLevelAssignment,
      hierarchyAggregateNode: resolvedHierarchyAggregateNode,
      baseGridSpacingM: plan.baseGridSpacingM,
      minLevel: plan.minLevel,
      maxLevel: plan.maxLevel,
      targetSupportCells,
      supportRadiusScale,
      phaseVolumeExpandThreshold,
      coarsenLevelDeltaThreshold,
      gasPhaseId,
      migrationEpoch: mergeEpoch,
      aggregateResidualTolerance,
      retainMigrationBuffer: true,
      readbackMode
    });
  const resolvedPhaseVolumeLevelUpdate = !resolvedPhaseVolumeMigration || !enablePhaseVolumeLevelUpdate
    ? null
    : phaseVolumeLevelUpdate || await phaseVolumeLevelUpdateRunner({
      device,
      phaseVolumeMigration: resolvedPhaseVolumeMigration,
      phaseVolumeMigrationAdmission,
      migrationEpoch: mergeEpoch,
      retainLevelUpdateBuffer: true,
      readbackMode
    });
  const residentStep = await residentStepRunner({
    ...residentStepOptions,
    sphParticleState,
    mlsMpmParticleState,
    sphParticleUpload,
    mlsMpmParticleUpload,
    gridSpacingM: plan.nativeGridSpacingM,
    boxDimsM,
    dt,
    gravityMPerS2,
    cflFactor,
    preferWebGpu: true,
    device,
    readbackMode,
    schroederLevelAssignment: resolvedLevelAssignment,
    schroederSelectedLevel: plan.selectedLevel,
    schroederCrossLevelCoupling: resolvedCrossLevelCoupling,
    schroederConservationSummary: resolvedConservationSummary,
    schroederCrossLevelTransfer: resolvedCrossLevelTransfer,
    schroederCrossLevelStateDelta: resolvedCrossLevelStateDelta,
    schroederCrossLevelStateDeltaMerge: resolvedCrossLevelStateDeltaMerge,
    schroederHierarchyAggregate: resolvedHierarchyAggregate,
    schroederHierarchyAggregateNode: resolvedHierarchyAggregateNode,
    schroederPhaseVolumeMigration: resolvedPhaseVolumeMigration,
    schroederPhaseVolumeLevelUpdate: resolvedPhaseVolumeLevelUpdate,
    fuseNoFullResidentMechanics: true,
    fuseNoFullResidentMechanicsActiveGrid: true,
    fuseNoFullResidentActiveGrid: true
  });

  return {
    ...plan,
    schema: ULG_SCHROEDER_SAME_LEVEL_MECHANICS_EXECUTION_SCHEMA,
    sameLevelMechanicsSchema: plan.schema,
    status: 'schroeder-same-level-mechanics-submitted',
    backend: 'webgpu',
    readbackMode,
    fullParticleReadbackPerformed: false,
    normalHotLoopReadbackFree: readbackMode === SCHROEDER_NO_FULL_READBACK_MODE,
    levelAssignment: {
      schema: resolvedLevelAssignment.schema,
      status: resolvedLevelAssignment.status,
      particleCount: resolvedLevelAssignment.particleCount,
      retainedAssignmentBuffer: Boolean(resolvedLevelAssignment.assignmentBuffer),
      assignmentBufferByteLength: resolvedLevelAssignment.assignmentBufferByteLength ?? resolvedLevelAssignment.assignmentByteLength ?? 0
    },
    activeNodeList: {
      schema: resolvedActiveNodeList.schema,
      status: resolvedActiveNodeList.status,
      activeCandidateCount: resolvedActiveNodeList.activeCandidateCount,
      outputCompaction: resolvedActiveNodeList.outputCompaction,
      retainedActiveNodeBuffer: Boolean(resolvedActiveNodeList.activeNodeBuffer),
      activeNodeBufferByteLength: resolvedActiveNodeList.activeNodeBufferByteLength ?? resolvedActiveNodeList.activeNodeByteLength ?? 0
    },
    crossLevelCoupling: resolvedCrossLevelCoupling ? {
      schema: resolvedCrossLevelCoupling.schema,
      status: resolvedCrossLevelCoupling.status,
      crossLevelCandidateCount: resolvedCrossLevelCoupling.crossLevelCandidateCount,
      outputCompaction: resolvedCrossLevelCoupling.outputCompaction,
      retainedCrossLevelBuffer: Boolean(resolvedCrossLevelCoupling.crossLevelBuffer),
      crossLevelBufferByteLength: resolvedCrossLevelCoupling.crossLevelBufferByteLength
        ?? resolvedCrossLevelCoupling.crossLevelByteLength
        ?? 0
    } : null,
    conservationSummary: resolvedConservationSummary ? {
      schema: resolvedConservationSummary.schema,
      status: resolvedConservationSummary.status,
      summaryRowCount: resolvedConservationSummary.summaryRowCount,
      outputCompaction: resolvedConservationSummary.outputCompaction,
      residualCounterStatus: resolvedConservationSummary.residualCounterStatus,
      conservativeTransferStatus: resolvedConservationSummary.conservativeTransferStatus,
      retainedSummaryBuffer: Boolean(resolvedConservationSummary.summaryBuffer),
      summaryBufferByteLength: resolvedConservationSummary.summaryBufferByteLength
        ?? resolvedConservationSummary.summaryByteLength
        ?? 0
    } : null,
    crossLevelTransfer: resolvedCrossLevelTransfer ? {
      schema: resolvedCrossLevelTransfer.schema,
      status: resolvedCrossLevelTransfer.status,
      crossLevelCandidateCount: resolvedCrossLevelTransfer.crossLevelCandidateCount,
      outputCompaction: resolvedCrossLevelTransfer.outputCompaction,
      conservativeTransferStatus: resolvedCrossLevelTransfer.conservativeTransferStatus,
      stateMutationStatus: resolvedCrossLevelTransfer.stateMutationStatus,
      retainedTransferBuffer: Boolean(resolvedCrossLevelTransfer.transferBuffer),
      transferBufferByteLength: resolvedCrossLevelTransfer.transferBufferByteLength
        ?? resolvedCrossLevelTransfer.transferByteLength
        ?? 0
    } : null,
    crossLevelStateDelta: resolvedCrossLevelStateDelta ? {
      schema: resolvedCrossLevelStateDelta.schema,
      status: resolvedCrossLevelStateDelta.status,
      crossLevelCandidateCount: resolvedCrossLevelStateDelta.crossLevelCandidateCount,
      outputCompaction: resolvedCrossLevelStateDelta.outputCompaction,
      conservativeTransferStatus: resolvedCrossLevelStateDelta.conservativeTransferStatus,
      stateMutationStatus: resolvedCrossLevelStateDelta.stateMutationStatus,
      stateAuthorityStatus: resolvedCrossLevelStateDelta.stateAuthorityStatus,
      retainedStateDeltaBuffer: Boolean(resolvedCrossLevelStateDelta.stateDeltaBuffer),
      stateDeltaBufferByteLength: resolvedCrossLevelStateDelta.stateDeltaBufferByteLength
        ?? resolvedCrossLevelStateDelta.stateDeltaByteLength
        ?? 0
    } : null,
    crossLevelStateDeltaMerge: resolvedCrossLevelStateDeltaMerge ? {
      schema: resolvedCrossLevelStateDeltaMerge.schema,
      status: resolvedCrossLevelStateDeltaMerge.status,
      crossLevelCandidateCount: resolvedCrossLevelStateDeltaMerge.crossLevelCandidateCount,
      outputCompaction: resolvedCrossLevelStateDeltaMerge.outputCompaction,
      conservativeTransferStatus: resolvedCrossLevelStateDeltaMerge.conservativeTransferStatus,
      stateMutationStatus: resolvedCrossLevelStateDeltaMerge.stateMutationStatus,
      stateAuthorityStatus: resolvedCrossLevelStateDeltaMerge.stateAuthorityStatus,
      retainedMergedStateDeltaBuffer: Boolean(resolvedCrossLevelStateDeltaMerge.mergedStateDeltaBuffer),
      mergedStateDeltaBufferByteLength: resolvedCrossLevelStateDeltaMerge.mergedStateDeltaBufferByteLength
        ?? resolvedCrossLevelStateDeltaMerge.mergeByteLength
        ?? 0
    } : null,
    hierarchyAggregate: resolvedHierarchyAggregate ? {
      schema: resolvedHierarchyAggregate.schema,
      status: resolvedHierarchyAggregate.status,
      aggregateRowCount: resolvedHierarchyAggregate.aggregateRowCount,
      outputCompaction: resolvedHierarchyAggregate.outputCompaction,
      aggregateReductionStatus: resolvedHierarchyAggregate.aggregateReductionStatus,
      conservativeTransferStatus: resolvedHierarchyAggregate.conservativeTransferStatus,
      stateMutationStatus: resolvedHierarchyAggregate.stateMutationStatus,
      stateAuthorityStatus: resolvedHierarchyAggregate.stateAuthorityStatus,
      retainedAggregateBuffer: Boolean(resolvedHierarchyAggregate.aggregateBuffer),
      aggregateBufferByteLength: resolvedHierarchyAggregate.aggregateBufferByteLength
        ?? resolvedHierarchyAggregate.aggregateByteLength
        ?? 0
    } : null,
    hierarchyAggregateNode: resolvedHierarchyAggregateNode ? {
      schema: resolvedHierarchyAggregateNode.schema,
      status: resolvedHierarchyAggregateNode.status,
      aggregateRowCount: resolvedHierarchyAggregateNode.aggregateRowCount,
      outputCompaction: resolvedHierarchyAggregateNode.outputCompaction,
      aggregateReductionStatus: resolvedHierarchyAggregateNode.aggregateReductionStatus,
      aggregateReductionMode: resolvedHierarchyAggregateNode.aggregateReductionMode,
      capacityStatus: resolvedHierarchyAggregateNode.capacityStatus,
      conservativeTransferStatus: resolvedHierarchyAggregateNode.conservativeTransferStatus,
      stateMutationStatus: resolvedHierarchyAggregateNode.stateMutationStatus,
      stateAuthorityStatus: resolvedHierarchyAggregateNode.stateAuthorityStatus,
      retainedAggregateNodeBuffer: Boolean(resolvedHierarchyAggregateNode.aggregateNodeBuffer),
      aggregateNodeBufferByteLength: resolvedHierarchyAggregateNode.aggregateNodeBufferByteLength
        ?? resolvedHierarchyAggregateNode.aggregateNodeByteLength
        ?? 0
    } : null,
    phaseVolumeMigration: resolvedPhaseVolumeMigration ? {
      schema: resolvedPhaseVolumeMigration.schema,
      status: resolvedPhaseVolumeMigration.status,
      particleCount: resolvedPhaseVolumeMigration.particleCount,
      aggregateNodeCount: resolvedPhaseVolumeMigration.aggregateNodeCount,
      phaseVolumeStatus: resolvedPhaseVolumeMigration.phaseVolumeStatus,
      migrationMode: resolvedPhaseVolumeMigration.migrationMode,
      aggregateCoherenceRequirement: resolvedPhaseVolumeMigration.aggregateCoherenceRequirement,
      phaseVolumeExpandThreshold: resolvedPhaseVolumeMigration.phaseVolumeExpandThreshold,
      coarsenLevelDeltaThreshold: resolvedPhaseVolumeMigration.coarsenLevelDeltaThreshold,
      conservativeTransferStatus: resolvedPhaseVolumeMigration.conservativeTransferStatus,
      stateMutationStatus: resolvedPhaseVolumeMigration.stateMutationStatus,
      stateAuthorityStatus: resolvedPhaseVolumeMigration.stateAuthorityStatus,
      retainedMigrationBuffer: Boolean(resolvedPhaseVolumeMigration.migrationBuffer),
      migrationBufferByteLength: resolvedPhaseVolumeMigration.migrationBufferByteLength
        ?? resolvedPhaseVolumeMigration.migrationByteLength
        ?? 0
    } : null,
    phaseVolumeLevelUpdate: resolvedPhaseVolumeLevelUpdate ? {
      schema: resolvedPhaseVolumeLevelUpdate.schema,
      status: resolvedPhaseVolumeLevelUpdate.status,
      migrationRowCount: resolvedPhaseVolumeLevelUpdate.migrationRowCount,
      outputCompaction: resolvedPhaseVolumeLevelUpdate.outputCompaction,
      phaseVolumeMigrationAdmissionApproved: resolvedPhaseVolumeLevelUpdate.phaseVolumeMigrationAdmissionApproved,
      conservativeTransferStatus: resolvedPhaseVolumeLevelUpdate.conservativeTransferStatus,
      stateMutationStatus: resolvedPhaseVolumeLevelUpdate.stateMutationStatus,
      stateAuthorityStatus: resolvedPhaseVolumeLevelUpdate.stateAuthorityStatus,
      retainedLevelUpdateBuffer: Boolean(resolvedPhaseVolumeLevelUpdate.levelUpdateBuffer),
      levelUpdateBufferByteLength: resolvedPhaseVolumeLevelUpdate.levelUpdateBufferByteLength
        ?? resolvedPhaseVolumeLevelUpdate.levelUpdateByteLength
        ?? 0
    } : null,
    residentStep,
    residentStepStatus: residentStep?.status ?? null,
    residentStepSchema: residentStep?.schema ?? null,
    mechanicsGridSpacingM: plan.nativeGridSpacingM,
    denseLocalBackend: 'existing-mls-mpm-ocean-resident-mechanics',
    activeNodeConsumerStatus: 'planned-not-yet-consumed-by-mls-mpm-kernels',
    crossLevelCouplingStatus: resolvedCrossLevelCoupling
      ? 'candidate-generation-submitted-not-yet-consumed-by-mls-mpm-grid-transfer'
      : 'disabled-same-level-only-mechanics',
    conservationSummaryStatus: resolvedConservationSummary?.status ?? (
      resolvedCrossLevelCoupling ? 'disabled-cross-level-summary' : 'disabled-same-level-only-mechanics'
    ),
    crossLevelTransferStatus: resolvedCrossLevelTransfer?.status ?? (
      resolvedCrossLevelCoupling ? 'disabled-cross-level-transfer' : 'disabled-same-level-only-mechanics'
    ),
    crossLevelStateDeltaStatus: resolvedCrossLevelStateDelta?.status ?? (
      resolvedCrossLevelTransfer ? 'disabled-cross-level-state-delta' : (
        resolvedCrossLevelCoupling ? 'disabled-cross-level-transfer' : 'disabled-same-level-only-mechanics'
      )
    ),
    crossLevelStateDeltaMergeStatus: resolvedCrossLevelStateDeltaMerge?.status ?? (
      resolvedCrossLevelStateDelta
        ? 'disabled-cross-level-state-delta-merge-admission-not-provided'
        : (resolvedCrossLevelCoupling ? 'disabled-cross-level-state-delta' : 'disabled-same-level-only-mechanics')
    ),
    hierarchyAggregateStatus: resolvedHierarchyAggregate?.status ?? (
      resolvedCrossLevelStateDeltaMerge
        ? 'disabled-hierarchy-aggregate-materialization'
        : (resolvedCrossLevelStateDelta ? 'disabled-cross-level-state-delta-merge' : 'disabled-same-level-only-mechanics')
    ),
    hierarchyAggregateNodeStatus: resolvedHierarchyAggregateNode?.status ?? (
      resolvedHierarchyAggregate
        ? 'disabled-hierarchy-aggregate-node-reduction'
        : (resolvedCrossLevelStateDeltaMerge ? 'disabled-hierarchy-aggregate-materialization' : 'disabled-same-level-only-mechanics')
    ),
    phaseVolumeMigrationStatus: resolvedPhaseVolumeMigration?.status ?? (
      resolvedHierarchyAggregateNode
        ? 'disabled-phase-volume-migration'
        : (resolvedHierarchyAggregate
          ? 'disabled-hierarchy-aggregate-node-reduction'
          : (resolvedCrossLevelStateDeltaMerge ? 'disabled-hierarchy-aggregate-materialization' : 'disabled-same-level-only-mechanics'))
    ),
    phaseVolumeLevelUpdateStatus: resolvedPhaseVolumeLevelUpdate?.status ?? (
      resolvedPhaseVolumeMigration
        ? 'disabled-phase-volume-level-update-admission-not-provided'
        : (resolvedHierarchyAggregateNode ? 'disabled-phase-volume-migration' : 'disabled-same-level-only-mechanics')
    ),
    conservativeTransferStatus: resolvedPhaseVolumeLevelUpdate?.conservativeTransferStatus
      ?? resolvedPhaseVolumeMigration?.conservativeTransferStatus
      ?? resolvedHierarchyAggregateNode?.conservativeTransferStatus
      ?? resolvedHierarchyAggregate?.conservativeTransferStatus
      ?? resolvedCrossLevelStateDeltaMerge?.conservativeTransferStatus
      ?? resolvedCrossLevelStateDelta?.conservativeTransferStatus
      ?? resolvedCrossLevelTransfer?.conservativeTransferStatus
      ?? resolvedConservationSummary?.conservativeTransferStatus
      ?? 'not-run',
    stateMutationStatus: resolvedPhaseVolumeLevelUpdate?.stateMutationStatus
      ?? resolvedPhaseVolumeMigration?.stateMutationStatus
      ?? resolvedHierarchyAggregateNode?.stateMutationStatus
      ?? resolvedHierarchyAggregate?.stateMutationStatus
      ?? resolvedCrossLevelStateDeltaMerge?.stateMutationStatus
      ?? resolvedCrossLevelStateDelta?.stateMutationStatus
      ?? resolvedCrossLevelTransfer?.stateMutationStatus
      ?? 'not-run',
    stateAuthorityStatus: resolvedPhaseVolumeLevelUpdate?.stateAuthorityStatus
      ?? resolvedPhaseVolumeMigration?.stateAuthorityStatus
      ?? resolvedHierarchyAggregateNode?.stateAuthorityStatus
      ?? resolvedHierarchyAggregate?.stateAuthorityStatus
      ?? resolvedCrossLevelStateDeltaMerge?.stateAuthorityStatus
      ?? resolvedCrossLevelStateDelta?.stateAuthorityStatus
      ?? 'not-run',
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}
