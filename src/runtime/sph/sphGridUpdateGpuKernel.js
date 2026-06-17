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

export {
  ULG_MLS_MPM_GPU_GRID_UPDATE_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_UPDATE_PARITY_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
  mlsMpmGridUpdateWgsl
};

export const MLS_MPM_GPU_GRID_VELOCITY_FLOATS = MLS_MPM_GPU_GRID_VELOCITY_ROW_LAYOUT.length;
export const SPH_PRESSURE_INTERFACE_FORCE_FLOATS = SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT.length;
export const ULG_PRESSURE_INTERFACE_GRID_FORCE_CONSUMPTION_ADMISSION_SCHEMA = 'peercompute.ulg.pressure-interface-grid-force-consumption-admission.v0';

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
const DEFAULT_CFL_FACTOR = 0.6;
const GRID_UPDATE_SCOPE = 'mls-mpm-grid-velocity-update-gravity-cfl-walls';
const FULL_READBACK_MODE = 'full-parity-readback';
const NO_FULL_READBACK_MODE = 'no-full-readback';
const EMPTY_PRESSURE_INTERFACE_FORCE_ROWS = new Float32Array(SPH_PRESSURE_INTERFACE_FORCE_FLOATS);
const PRESSURE_INTERFACE_GRID_APPLICATION_STATUSES = new Set([
  'apply-to-mls-mpm-grid',
  'pressure-interface-grid-force-consumer-approved'
]);
const PRESSURE_INTERFACE_ADMITTED_DESCRIPTOR_STATUSES = new Set([
  'worker-retained-pressure-interface-output-admitted',
  'worker-retained-pressure-interface-output-published',
  'pressure-interface-grid-force-consumption-approved'
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
  forceRowCount = 0
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
  const descriptorAdmitted = PRESSURE_INTERFACE_ADMITTED_DESCRIPTOR_STATUSES.has(descriptorStatus)
    || descriptor?.committed === true
    || pressureInterfaceGridForceAdmission?.committed === true;
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
    forceRowCount
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
  pressureInterfaceGridForceAdmission = null
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
        velocity = [0, 0, 0];
      }
      if ((nodePosition[0] <= gridSpacingM + boundaryEpsilonM && velocity[0] < 0) || (nodePosition[0] >= dims[0] - gridSpacingM - boundaryEpsilonM && velocity[0] > 0)) velocity[0] = 0;
      if (nodePosition[1] >= dims[1] - gridSpacingM - boundaryEpsilonM && velocity[1] > 0) velocity[1] = 0;
      if ((nodePosition[2] <= gridSpacingM + boundaryEpsilonM && velocity[2] < 0) || (nodePosition[2] >= dims[2] - gridSpacingM - boundaryEpsilonM && velocity[2] > 0)) velocity[2] = 0;
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
  pressureInterfaceForceRowCount = 0
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
  const pressureForceApplicationApproved = solverGridApplicationApproved
    && pressureInterfaceGridForceAdmissionAllowsApplication({
      pressureInterfaceGridForceAdmission,
      pressureInterfaceForceSolver,
      forceRowCount: candidatePressureForceRowCount
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
      pressureInterfaceForceRowCount: pressureForceRowCount
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
      pressureInterfaceForceApplication: pressureInterfaceForceApplicationSummary({
        pressureInterfaceForceSolver,
        pressureInterfaceGridForceAdmission,
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
