import {
  MLS_MPM_GPU_GRID_NODE_ROW_LAYOUT,
  MLS_MPM_GPU_GRID_VELOCITY_ROW_LAYOUT,
  SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT,
  ULG_MLS_MPM_GPU_GRID_PROJECTION_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_UPDATE_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_UPDATE_PARITY_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import { mlsMpmGridUpdateWgsl } from '../../../ulg-gpu-abi/src/wgsl.js';
import { requestOpticalGpuDevice } from '../material/opticalGpuBuffers.js';
import { computeBufferBinding, createCachedExplicitComputePipeline, deferSubmittedWorkCleanup } from '../webgpuComputeLayout.js';
import { MLS_MPM_GPU_GRID_NODE_FLOATS } from './sphGridGpuKernel.js';
import {
  typedArrayContentFingerprint,
  webGpuBufferDevice,
  webGpuDeviceId
} from './sphGpuDeviceIdentity.js';
import {
  strictReactionGateAllowsForceCoupling
} from './sphReactionGpuSummary.js';

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
const ULG_ALGORITHM_CONTACT_MATERIAL_ROWS_SCHEMA = 'peercompute.ulg.algorithm-material-contact-rows.v0';
const PRESSURE_INTERFACE_GRID_APPLICATION_STATUSES = new Set([
  'apply-to-mls-mpm-grid',
  'pressure-interface-grid-force-consumer-approved'
]);
const PRESSURE_INTERFACE_ADMITTED_DESCRIPTOR_STATUSES = new Set([
  'worker-retained-pressure-interface-output-admitted',
  'worker-retained-pressure-interface-output-published'
]);

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
  queueCompletionMethod = null
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
    normalHotLoopReadbackFree: noFullReadback,
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

function createGridUpdateParamsArray({
  p2gGridProjection,
  dt,
  gravityMPerS2,
  boxDimsM,
  cflFactor,
  pressureInterfaceForceRowCount = 0,
  wallBarrierElasticStiffnessNPerM = DEFAULT_WALL_BARRIER_ELASTIC_STIFFNESS_N_PER_M,
  wallBarrierContactScale = DEFAULT_WALL_BARRIER_CONTACT_SCALE,
  wallBarrierMinGapM = DEFAULT_WALL_BARRIER_MIN_GAP_M
}) {
  const buffer = new ArrayBuffer(80);
  const view = new DataView(buffer);
  const gridDims = p2gGridProjection.gridDims ?? [1, 1, 1];
  view.setUint32(0, p2gGridProjection.gridNodeCount ?? 0, true);
  view.setUint32(4, gridDims[0] ?? 1, true);
  view.setUint32(8, gridDims[1] ?? 1, true);
  view.setUint32(12, gridDims[2] ?? 1, true);
  view.setUint32(16, p2gGridProjection.gridShift ?? 1, true);
  view.setUint32(20, pressureInterfaceForceRowCount, true);
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

export async function runMlsMpmGridUpdateWebGpu({
  device,
  p2gGridProjection,
  p2gGridBuffer = null,
  pressureInterfaceForceRowsBuffer = null,
  pressureInterfaceForceSolver = null,
  pressureInterfaceGridForceAdmission = null,
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
  retainUpdatedGridBuffer = false,
  readbackMode = FULL_READBACK_MODE
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runMlsMpmGridUpdateWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  assertP2gGridProjection(p2gGridProjection);
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
    size: 80,
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
    const update = outputEnvelope({
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
      queueCompletionMethod
    });
    if (retainUpdatedGridBuffer) {
      update.updatedGridBuffer = updatedGridBuffer;
      update.updatedGridBufferByteLength = outputByteLength;
      update.destroyUpdatedGridBuffer = () => updatedGridBuffer.destroy?.();
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
      deferSubmittedWorkCleanup(device, cleanup);
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
    fullReadbackPerformed: update?.fullReadbackPerformed ?? true,
    normalHotLoopReadbackFree: update?.normalHotLoopReadbackFree ?? false,
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
      retainUpdatedGridBuffer,
      readbackMode: noFullReadback ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE
    });
    await Promise.resolve();
    if (lostInfo) {
      gpuResult.destroyUpdatedGridBuffer?.();
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
