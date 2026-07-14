import {
  MLS_MPM_GPU_GRID_NODE_ROW_LAYOUT,
  SCHROEDER_ACTIVE_NODE_ROW_LAYOUT,
  SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT,
  SPH_GPU_REACTION_PRODUCT_EVENT_ROW_LAYOUT,
  ULG_MLS_MPM_GPU_GRID_PROJECTION_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_PROJECTION_PARITY_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import { mlsMpmP2gGridProjectionWgsl } from '../../../ulg-gpu-abi/src/wgsl.js';
import { requestOpticalGpuDevice } from '../material/opticalGpuBuffers.js';
import { computeBufferBinding, createCachedExplicitComputePipeline, deferSubmittedWorkCleanup } from '../webgpuComputeLayout.js';
import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_THERMO_FLOATS
} from './sphGpuBuffers.js';
import {
  tagWebGpuBufferDevice,
  webGpuBufferMatchesDevice,
  webGpuDeviceMismatchInfo
} from './sphGpuDeviceIdentity.js';

export {
  ULG_MLS_MPM_GPU_GRID_PROJECTION_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_PROJECTION_PARITY_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
  mlsMpmP2gGridProjectionWgsl
};

export const MLS_MPM_GPU_GRID_NODE_FLOATS = MLS_MPM_GPU_GRID_NODE_ROW_LAYOUT.length;
const SCHROEDER_ACTIVE_NODE_FLOATS = SCHROEDER_ACTIVE_NODE_ROW_LAYOUT.length;
const SCHROEDER_LEVEL_ASSIGNMENT_FLOATS = SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT.length;
export const SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS = SPH_GPU_REACTION_PRODUCT_EVENT_ROW_LAYOUT.length;
export const ULG_MLS_MPM_P2G_BACKEND_POLICY_SCHEMA = 'peercompute.ulg.mls-mpm-p2g-backend-policy.v0';
export const MLS_MPM_P2G_BACKEND_CPU_REFERENCE = 'cpu-reference';
export const MLS_MPM_P2G_BACKEND_RESIDENT_SCATTER = 'resident-scatter';
export const MLS_MPM_P2G_BACKEND_OCEAN_TILED_EXPERIMENTAL = 'ocean-tiled-experimental';

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

const DEFAULT_BOX_DIMS_M = Object.freeze([5, 5, 5]);
const DEFAULT_GRID_SHIFT = 1;
const GRID_SCOPE = 'particle-parallel-scatter-p2g-stress-momentum-projection';
const FULL_READBACK_MODE = 'full-parity-readback';
const NO_FULL_READBACK_MODE = 'no-full-readback';
const EMPTY_PRODUCT_EVENT_STORAGE_ROWS = new Float32Array(SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS);
const P2G_ACCUMULATOR_COMPONENTS = 4;
const TAIT_EXPONENT = 7;
const EOS_MODEL_IDS = Object.freeze({
  disabled: 0,
  taitCondensed: 1,
  gasLinearized: 2
});

export function resolveMlsMpmP2gBackendPolicy({
  requestedBackend = MLS_MPM_P2G_BACKEND_RESIDENT_SCATTER,
  supportsOceanTiledKernel = false
} = {}) {
  const normalizedRequestedBackend = typeof requestedBackend === 'string' && requestedBackend.trim()
    ? requestedBackend.trim()
    : MLS_MPM_P2G_BACKEND_RESIDENT_SCATTER;
  if (normalizedRequestedBackend === MLS_MPM_P2G_BACKEND_CPU_REFERENCE) {
    return {
      schema: ULG_MLS_MPM_P2G_BACKEND_POLICY_SCHEMA,
      status: 'cpu-reference-backend-selected',
      requestedBackend: normalizedRequestedBackend,
      effectiveBackend: MLS_MPM_P2G_BACKEND_CPU_REFERENCE,
      fallbackBackend: null,
      fallbackReason: null,
      experimentalBackendRequested: false,
      oceanTiledKernelAvailable: false,
      kernelScope: 'cpu-reference-p2g-stress-momentum-projection',
      dispatchTopology: 'cpu-reference-particle-loop',
      particleLoopInHotPath: true,
      gridWriteMode: 'cpu-grid-accumulate'
    };
  }
  const aliases = new Set([
    MLS_MPM_P2G_BACKEND_RESIDENT_SCATTER,
    'current',
    'current-resident',
    'webgpu-scatter',
    'particle-parallel-scatter'
  ]);
  if (aliases.has(normalizedRequestedBackend)) {
    return {
      schema: ULG_MLS_MPM_P2G_BACKEND_POLICY_SCHEMA,
      status: 'resident-scatter-backend-selected',
      requestedBackend: normalizedRequestedBackend,
      effectiveBackend: MLS_MPM_P2G_BACKEND_RESIDENT_SCATTER,
      fallbackBackend: null,
      fallbackReason: null,
      experimentalBackendRequested: false,
      oceanTiledKernelAvailable: false,
      kernelScope: GRID_SCOPE,
      dispatchTopology: 'particle-parallel-scatter',
      particleLoopInHotPath: false,
      gridWriteMode: 'atomic-grid-accumulator-scatter'
    };
  }
  if (normalizedRequestedBackend === MLS_MPM_P2G_BACKEND_OCEAN_TILED_EXPERIMENTAL) {
    const effectiveBackend = supportsOceanTiledKernel
      ? MLS_MPM_P2G_BACKEND_OCEAN_TILED_EXPERIMENTAL
      : MLS_MPM_P2G_BACKEND_RESIDENT_SCATTER;
    return {
      schema: ULG_MLS_MPM_P2G_BACKEND_POLICY_SCHEMA,
      status: supportsOceanTiledKernel
        ? 'ocean-tiled-backend-selected'
        : 'ocean-tiled-backend-fallback-resident-scatter',
      requestedBackend: normalizedRequestedBackend,
      effectiveBackend,
      fallbackBackend: supportsOceanTiledKernel ? null : MLS_MPM_P2G_BACKEND_RESIDENT_SCATTER,
      fallbackReason: supportsOceanTiledKernel ? null : 'ocean-tiled-p2g-kernel-not-available',
      experimentalBackendRequested: true,
      oceanTiledKernelAvailable: supportsOceanTiledKernel,
      kernelScope: supportsOceanTiledKernel ? 'ocean-tiled-p2g-stress-momentum-projection' : GRID_SCOPE,
      dispatchTopology: supportsOceanTiledKernel ? 'tile-parallel-scatter' : 'particle-parallel-scatter',
      particleLoopInHotPath: false,
      gridWriteMode: supportsOceanTiledKernel
        ? 'tile-local-accumulator-flush'
        : 'atomic-grid-accumulator-scatter'
    };
  }
  return {
    schema: ULG_MLS_MPM_P2G_BACKEND_POLICY_SCHEMA,
    status: 'unknown-backend-fallback-resident-scatter',
    requestedBackend: normalizedRequestedBackend,
    effectiveBackend: MLS_MPM_P2G_BACKEND_RESIDENT_SCATTER,
    fallbackBackend: MLS_MPM_P2G_BACKEND_RESIDENT_SCATTER,
    fallbackReason: 'unknown-p2g-backend',
    experimentalBackendRequested: false,
    oceanTiledKernelAvailable: false,
    kernelScope: GRID_SCOPE,
    dispatchTopology: 'particle-parallel-scatter',
    particleLoopInHotPath: false,
    gridWriteMode: 'atomic-grid-accumulator-scatter'
  };
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

function normalizeSchroederLevelFilter({
  schroederLevelAssignment = null,
  schroederSelectedLevel = null
} = {}) {
  const filterEnabled = schroederLevelAssignment
    && Number.isFinite(Number(schroederSelectedLevel));
  const assignmentStrideFloats = Math.max(1, Math.round(finiteNumber(
    schroederLevelAssignment?.assignmentStrideFloats,
    SCHROEDER_LEVEL_ASSIGNMENT_FLOATS
  )));
  return {
    enabled: Boolean(filterEnabled),
    selectedLevel: Math.round(finiteNumber(schroederSelectedLevel, 0)),
    assignmentStrideFloats
  };
}

function particlePassesSchroederLevelFilter(particleIndex, filter, assignmentRows = null) {
  if (!filter?.enabled) return true;
  if (!(assignmentRows instanceof Float32Array)) return false;
  const offset = particleIndex * filter.assignmentStrideFloats;
  return Math.round(finiteNumber(assignmentRows[offset], Number.NaN)) === filter.selectedLevel;
}

function assertPackedInputs({ sphParticleState, mlsMpmParticleState }) {
  if (sphParticleState?.schema !== ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError('MLS-MPM grid projection requires a packed SPH GPU particle buffer');
  }
  if (mlsMpmParticleState?.schema !== ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError('MLS-MPM grid projection requires a packed MLS-MPM GPU particle buffer');
  }
  if (sphParticleState.particleCount !== mlsMpmParticleState.particleCount) {
    throw new RangeError('SPH and MLS-MPM particle buffer counts must match');
  }
}

export function createMlsMpmGridSpec({
  boxDimsM = DEFAULT_BOX_DIMS_M,
  gridSpacingM,
  shift = DEFAULT_GRID_SHIFT
} = {}) {
  const dims = finiteVector3(boxDimsM, DEFAULT_BOX_DIMS_M);
  const dx = finiteNumber(gridSpacingM, 0);
  if (!(dx > 0)) throw new RangeError('createMlsMpmGridSpec requires a positive gridSpacingM');
  const gridDims = [
    Math.round(dims[0] / dx) + 5,
    Math.round(dims[1] / dx) + 5,
    Math.round(dims[2] / dx) + 5
  ];
  return {
    gridSpacingM: dx,
    invGridSpacingM: 1 / dx,
    boxDimsM: dims,
    shift,
    gridDims,
    gridNodeCount: gridDims[0] * gridDims[1] * gridDims[2]
  };
}

function quadraticWeights(fx) {
  const a = 1.5 - fx;
  const b = fx - 1;
  const c = fx - 0.5;
  return [0.5 * a * a, 0.75 - b * b, 0.5 * c * c];
}

function gridNodeCoords(nodeIndex, gridSpec) {
  const [, gny, gnz] = gridSpec.gridDims;
  const plane = gny * gnz;
  const i = Math.floor(nodeIndex / plane);
  const rem = nodeIndex - i * plane;
  const j = Math.floor(rem / gnz);
  const k = rem - j * gnz;
  return {
    i,
    j,
    k,
    nodeI: i - gridSpec.shift,
    nodeJ: j - gridSpec.shift,
    nodeK: k - gridSpec.shift
  };
}

function gridNodeIndexFromCoords(i, j, k, gridSpec) {
  if (
    i < 0 || j < 0 || k < 0
    || i >= gridSpec.gridDims[0]
    || j >= gridSpec.gridDims[1]
    || k >= gridSpec.gridDims[2]
  ) {
    return -1;
  }
  return (i * gridSpec.gridDims[1] + j) * gridSpec.gridDims[2] + k;
}

function det3(F) {
  return F[0] * (F[4] * F[8] - F[5] * F[7])
    - F[1] * (F[3] * F[8] - F[5] * F[6])
    + F[2] * (F[3] * F[7] - F[4] * F[6]);
}

function corotatedCauchyStress(F, mu, lambda) {
  const [f0, f1, f2, f3, f4, f5, f6, f7, f8] = F;
  let r0 = f0; let r1 = f1; let r2 = f2;
  let r3 = f3; let r4 = f4; let r5 = f5;
  let r6 = f6; let r7 = f7; let r8 = f8;
  for (let it = 0; it < 12; it += 1) {
    const det = r0 * (r4 * r8 - r5 * r7) - r1 * (r3 * r8 - r5 * r6) + r2 * (r3 * r7 - r4 * r6);
    if (Math.abs(det) < 1e-12) break;
    const id = 1 / det;
    const t0 = (r4 * r8 - r5 * r7) * id; const t3 = (r2 * r7 - r1 * r8) * id; const t6 = (r1 * r5 - r2 * r4) * id;
    const t1 = (r5 * r6 - r3 * r8) * id; const t4 = (r0 * r8 - r2 * r6) * id; const t7 = (r2 * r3 - r0 * r5) * id;
    const t2 = (r3 * r7 - r4 * r6) * id; const t5 = (r1 * r6 - r0 * r7) * id; const t8 = (r0 * r4 - r1 * r3) * id;
    const n0 = 0.5 * (r0 + t0); const n1 = 0.5 * (r1 + t1); const n2 = 0.5 * (r2 + t2);
    const n3 = 0.5 * (r3 + t3); const n4 = 0.5 * (r4 + t4); const n5 = 0.5 * (r5 + t5);
    const n6 = 0.5 * (r6 + t6); const n7 = 0.5 * (r7 + t7); const n8 = 0.5 * (r8 + t8);
    const diff = Math.abs(n0 - r0) + Math.abs(n4 - r4) + Math.abs(n8 - r8);
    r0 = n0; r1 = n1; r2 = n2; r3 = n3; r4 = n4; r5 = n5; r6 = n6; r7 = n7; r8 = n8;
    if (diff < 1e-10) break;
  }
  const J = det3(F);
  if (Math.abs(J) < 1e-12) return new Array(9).fill(0);
  const jid = 1 / J;
  const ft0 = (f4 * f8 - f5 * f7) * jid; const ft3 = (f2 * f7 - f1 * f8) * jid; const ft6 = (f1 * f5 - f2 * f4) * jid;
  const ft1 = (f5 * f6 - f3 * f8) * jid; const ft4 = (f0 * f8 - f2 * f6) * jid; const ft7 = (f2 * f3 - f0 * f5) * jid;
  const ft2 = (f3 * f7 - f4 * f6) * jid; const ft5 = (f1 * f6 - f0 * f7) * jid; const ft8 = (f0 * f4 - f1 * f3) * jid;
  const c = lambda * (J - 1) * J;
  const p0 = 2 * mu * (f0 - r0) + c * ft0; const p1 = 2 * mu * (f1 - r1) + c * ft1; const p2 = 2 * mu * (f2 - r2) + c * ft2;
  const p3 = 2 * mu * (f3 - r3) + c * ft3; const p4 = 2 * mu * (f4 - r4) + c * ft4; const p5 = 2 * mu * (f5 - r5) + c * ft5;
  const p6 = 2 * mu * (f6 - r6) + c * ft6; const p7 = 2 * mu * (f7 - r7) + c * ft7; const p8 = 2 * mu * (f8 - r8) + c * ft8;
  return [
    (p0 * f0 + p1 * f1 + p2 * f2) * jid, (p0 * f3 + p1 * f4 + p2 * f5) * jid, (p0 * f6 + p1 * f7 + p2 * f8) * jid,
    (p3 * f0 + p4 * f1 + p5 * f2) * jid, (p3 * f3 + p4 * f4 + p5 * f5) * jid, (p3 * f6 + p4 * f7 + p5 * f8) * jid,
    (p6 * f0 + p7 * f1 + p8 * f2) * jid, (p6 * f3 + p7 * f4 + p8 * f5) * jid, (p6 * f6 + p7 * f7 + p8 * f8) * jid
  ];
}

function pressureFromPackedParticle({
  densityKgPerM3,
  restDensityKgPerM3,
  soundSpeedMPerS,
  eosModelId,
  internalPressureScale = 1
}) {
  if (!(densityKgPerM3 > 0) || !(restDensityKgPerM3 > 0) || !(soundSpeedMPerS > 0)) return 0;
  const pressureScale = finiteNumber(internalPressureScale, 1);
  if (pressureScale === 0) return 0;
  if (Math.round(eosModelId) === EOS_MODEL_IDS.gasLinearized) {
    return pressureScale * Math.max(0, soundSpeedMPerS * soundSpeedMPerS * (densityKgPerM3 - restDensityKgPerM3));
  }
  if (Math.round(eosModelId) === EOS_MODEL_IDS.taitCondensed) {
    const ratio = densityKgPerM3 / Math.max(restDensityKgPerM3, 1e-9);
    const stiffnessPa = restDensityKgPerM3 * soundSpeedMPerS * soundSpeedMPerS / TAIT_EXPONENT;
    // Cavitation clamp (WGSL packed_pressure parity): unbounded signed Tait
    // tension is bulk-scale artificial cohesion and drives the MLS-MPM
    // tensile pairing instability (mm-separation pairs, pearl-string clumps).
    const pressurePa = Math.max(
      stiffnessPa * (ratio ** TAIT_EXPONENT - 1),
      -0.05 * stiffnessPa
    );
    return pressureScale * pressurePa;
  }
  return 0;
}

function addNewtonianViscousStress(stress, C, dynamicViscosityPaS) {
  const mu = Math.max(finiteNumber(dynamicViscosityPaS, 0), 0);
  if (!(mu > 0)) return stress;
  const divThird = (C[0] + C[4] + C[8]) / 3;
  stress[0] += 2 * mu * (C[0] - divThird);
  stress[4] += 2 * mu * (C[4] - divThird);
  stress[8] += 2 * mu * (C[8] - divThird);
  const s01 = mu * (C[1] + C[3]);
  const s02 = mu * (C[2] + C[6]);
  const s12 = mu * (C[5] + C[7]);
  stress[1] += s01; stress[3] += s01;
  stress[2] += s02; stress[6] += s02;
  stress[5] += s12; stress[7] += s12;
  return stress;
}

function stressTensorForPackedParticle({
  sphParticleState,
  mlsMpmParticleState,
  stateOffset,
  thermoOffset,
  mechanicsOffset,
  internalPressureScale = 1
}) {
  const F = [
    mlsMpmParticleState.mechanics[mechanicsOffset],
    mlsMpmParticleState.mechanics[mechanicsOffset + 1],
    mlsMpmParticleState.mechanics[mechanicsOffset + 2],
    mlsMpmParticleState.mechanics[mechanicsOffset + 3],
    mlsMpmParticleState.mechanics[mechanicsOffset + 4],
    mlsMpmParticleState.mechanics[mechanicsOffset + 5],
    mlsMpmParticleState.mechanics[mechanicsOffset + 6],
    mlsMpmParticleState.mechanics[mechanicsOffset + 7],
    mlsMpmParticleState.mechanics[mechanicsOffset + 8]
  ];
  const restVolumeM3 = mlsMpmParticleState.mechanics[mechanicsOffset + 19];
  const J = finiteNumber(mlsMpmParticleState.mechanics[mechanicsOffset + 18], det3(F));
  const volumeM3 = Math.max(restVolumeM3 * Math.max(J, 1e-9), 1e-30);
  const densityKgPerM3 = sphParticleState.state[stateOffset + 3] / volumeM3;
  const restDensityKgPerM3 = sphParticleState.thermo[thermoOffset + 3];
  const solidFlag = mlsMpmParticleState.mechanics[mechanicsOffset + 20];
  const shearModulusPa = mlsMpmParticleState.mechanics[mechanicsOffset + 23];
  const lambdaPa = mlsMpmParticleState.mechanics[mechanicsOffset + 24];
  if (solidFlag > 0.5 && shearModulusPa > 0) {
    return corotatedCauchyStress(F, shearModulusPa, lambdaPa);
  }
  const pressurePa = pressureFromPackedParticle({
    densityKgPerM3,
    restDensityKgPerM3,
    soundSpeedMPerS: mlsMpmParticleState.mechanics[mechanicsOffset + 25],
    eosModelId: mlsMpmParticleState.mechanics[mechanicsOffset + 26],
    internalPressureScale
  }) + finiteNumber(internalPressureScale, 1) * Math.max(
    finiteNumber(mlsMpmParticleState.mechanics[mechanicsOffset + 28], 0),
    0
  );
  return addNewtonianViscousStress(
    [-pressurePa, 0, 0, 0, -pressurePa, 0, 0, 0, -pressurePa],
    Array.from(mlsMpmParticleState.mechanics.slice(mechanicsOffset + 9, mechanicsOffset + 18)),
    mlsMpmParticleState.mechanics[mechanicsOffset + 29]
  );
}

function productEventRowsFromResidentProductMass(residentProductMass) {
  if (residentProductMass?.productEventRows instanceof Float32Array) return residentProductMass.productEventRows;
  if (residentProductMass?.productEventValues instanceof Float32Array) return residentProductMass.productEventValues;
  if (residentProductMass?.productEvents?.values instanceof Float32Array) return residentProductMass.productEvents.values;
  return null;
}

function productEventRecordsFromResidentProductMass(residentProductMass) {
  if (Array.isArray(residentProductMass?.productEventRecords)) return residentProductMass.productEventRecords;
  if (Array.isArray(residentProductMass?.productEvents?.records)) return residentProductMass.productEvents.records;
  return null;
}

function productEventRowCountFromResidentProductMass(residentProductMass, productEventRows = null) {
  const explicitRows = Math.max(0, Math.round(finiteNumber(residentProductMass?.productEventRowCount, 0)));
  if (productEventRows instanceof Float32Array) {
    const rowsFromBuffer = Math.floor(productEventRows.length / SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS);
    return explicitRows > 0 ? Math.min(explicitRows, rowsFromBuffer) : rowsFromBuffer;
  }
  if (residentProductMass?.productEventBuffer) return explicitRows;
  const records = productEventRecordsFromResidentProductMass(residentProductMass);
  return records?.length ?? explicitRows;
}

function residentProductMassGridCouplingStatus({ residentProductMass, productEventCount, backend }) {
  if (!residentProductMass) return null;
  if (productEventCount > 0) {
    return backend === 'webgpu'
      ? 'resident-product-mass-bound-to-p2g-grid'
      : 'resident-product-mass-coupled-to-cpu-p2g-grid';
  }
  if (residentProductMass.productEventBufferRetained || residentProductMass.productEventBuffer) {
    return 'resident-product-mass-buffer-retained-empty';
  }
  return 'resident-product-mass-summary-only-p2g-force-pending';
}

function splatProductMassPointToGrid({
  px,
  py,
  pz,
  massKg,
  velocityMPerS = [0, 0, 0],
  supportVolumeM3 = 0,
  restDensityKgPerM3 = 0,
  soundSpeedMPerS = 0,
  eosModelId = 0,
  internalPressureScale = 1,
  dtSeconds = 0,
  gridSpec,
  gridNodes,
  activateNode
}) {
  if (!(massKg > 0)) return false;
  const pressurePa = supportVolumeM3 > 0 && dtSeconds !== 0
    ? pressureFromPackedParticle({
      densityKgPerM3: massKg / Math.max(supportVolumeM3, 1e-30),
      restDensityKgPerM3,
      soundSpeedMPerS,
      eosModelId,
      internalPressureScale
    })
    : 0;
  const diagonalAffine = pressurePa !== 0
    ? (-dtSeconds * supportVolumeM3 * 4 * gridSpec.invGridSpacingM * gridSpec.invGridSpacingM) * -pressurePa
    : 0;
  const pGridX = px * gridSpec.invGridSpacingM;
  const pGridY = py * gridSpec.invGridSpacingM;
  const pGridZ = pz * gridSpec.invGridSpacingM;
  const baseX = Math.floor(pGridX - 0.5);
  const baseY = Math.floor(pGridY - 0.5);
  const baseZ = Math.floor(pGridZ - 0.5);
  const wx = quadraticWeights(pGridX - baseX);
  const wy = quadraticWeights(pGridY - baseY);
  const wz = quadraticWeights(pGridZ - baseZ);
  let deposited = false;
  for (let ox = 0; ox < 3; ox += 1) {
    const i = baseX + ox + gridSpec.shift;
    const nodeX = (baseX + ox) * gridSpec.gridSpacingM;
    for (let oy = 0; oy < 3; oy += 1) {
      const j = baseY + oy + gridSpec.shift;
      const nodeY = (baseY + oy) * gridSpec.gridSpacingM;
      for (let oz = 0; oz < 3; oz += 1) {
        const k = baseZ + oz + gridSpec.shift;
        const nodeIndex = gridNodeIndexFromCoords(i, j, k, gridSpec);
        if (nodeIndex < 0) continue;
        const weight = wx[ox] * wy[oy] * wz[oz];
        if (weight === 0) continue;
        const nodeZ = (baseZ + oz) * gridSpec.gridSpacingM;
        const nodeOffset = activateNode(nodeIndex, nodeX, nodeY, nodeZ);
        gridNodes[nodeOffset] += weight * massKg;
        const dx = nodeX - px;
        const dy = nodeY - py;
        const dz = nodeZ - pz;
        gridNodes[nodeOffset + 1] += weight * (massKg * finiteNumber(velocityMPerS[0], 0) + diagonalAffine * dx);
        gridNodes[nodeOffset + 2] += weight * (massKg * finiteNumber(velocityMPerS[1], 0) + diagonalAffine * dy);
        gridNodes[nodeOffset + 3] += weight * (massKg * finiteNumber(velocityMPerS[2], 0) + diagonalAffine * dz);
        deposited = true;
      }
    }
  }
  return deposited;
}

function splatResidentProductMassToGridCpu({
  residentProductMass,
  gridSpec,
  gridNodes,
  activateNode,
  dtSeconds = 0,
  internalPressureScale = 1
}) {
  if (!residentProductMass) {
    return {
      productEventCount: 0,
      coupledEventCount: 0,
      coupledUnplacedMassKg: 0
    };
  }
  const productEventRows = productEventRowsFromResidentProductMass(residentProductMass);
  const productEventCount = productEventRowCountFromResidentProductMass(residentProductMass, productEventRows);
  let coupledEventCount = 0;
  let coupledUnplacedMassKg = 0;
  if (productEventRows instanceof Float32Array) {
    const rowLimit = Math.min(
      productEventCount,
      Math.floor(productEventRows.length / SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS)
    );
    for (let row = 0; row < rowLimit; row += 1) {
      const offset = row * SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS;
      const statusCode = productEventRows[offset + 18];
      const unplacedMassKg = productEventRows[offset + 13];
      if (statusCode !== 1 || !(unplacedMassKg > 0)) continue;
      const deposited = splatProductMassPointToGrid({
        px: productEventRows[offset],
        py: productEventRows[offset + 1],
        pz: productEventRows[offset + 2],
        massKg: unplacedMassKg,
        velocityMPerS: [
          productEventRows[offset + 20],
          productEventRows[offset + 21],
          productEventRows[offset + 22]
        ],
        supportVolumeM3: productEventRows[offset + 23],
        restDensityKgPerM3: productEventRows[offset + 17],
        soundSpeedMPerS: productEventRows[offset + 27],
        eosModelId: productEventRows[offset + 28],
        internalPressureScale,
        dtSeconds,
        gridSpec,
        gridNodes,
        activateNode
      });
      if (!deposited) continue;
      coupledEventCount += 1;
      coupledUnplacedMassKg += unplacedMassKg;
    }
    return {
      productEventCount,
      coupledEventCount,
      coupledUnplacedMassKg
    };
  }

  const records = productEventRecordsFromResidentProductMass(residentProductMass);
  if (Array.isArray(records)) {
    for (const record of records) {
      const statusCode = Number(record?.statusCode);
      if (Number.isFinite(statusCode) && statusCode !== 1) continue;
      if (record?.status && record.status !== 'ready') continue;
      const position = Array.isArray(record?.positionM) ? record.positionM : null;
      const unplacedMassKg = finiteNumber(record?.unplacedMassKg, 0);
      if (!position || !(unplacedMassKg > 0)) continue;
      const deposited = splatProductMassPointToGrid({
        px: finiteNumber(position[0], 0),
        py: finiteNumber(position[1], 0),
        pz: finiteNumber(position[2], 0),
        massKg: unplacedMassKg,
        velocityMPerS: Array.isArray(record?.velocityMPerS) ? record.velocityMPerS : [0, 0, 0],
        supportVolumeM3: finiteNumber(record?.supportVolumeM3, 0),
        restDensityKgPerM3: finiteNumber(record?.restDensityKgPerM3, 0),
        soundSpeedMPerS: finiteNumber(record?.soundSpeedMPerS, 0),
        eosModelId: finiteNumber(record?.eosModelId, 0),
        internalPressureScale,
        dtSeconds,
        gridSpec,
        gridNodes,
        activateNode
      });
      if (!deposited) continue;
      coupledEventCount += 1;
      coupledUnplacedMassKg += unplacedMassKg;
    }
  }
  return {
    productEventCount,
    coupledEventCount,
    coupledUnplacedMassKg
  };
}

function outputEnvelope({
  backend,
  sphParticleState,
  mlsMpmParticleState,
  gridSpec,
  gridNodes,
  dt = 0,
  internalPressureScale = 1,
  ambientPressurePa = 0,
  readbackMode = FULL_READBACK_MODE,
  p2gBackendPolicy = null,
  residentProductMass = null,
  residentProductMassProductEventCount = 0,
  residentProductMassCoupledEventCount = null,
  residentProductMassCoupledUnplacedMassKg = null,
  residentProductMassProductEventBufferDeviceMismatch = false,
  residentProductMassProductEventBufferSourceDeviceId = null,
  residentProductMassProductEventBufferConsumerDeviceId = null,
  schroederLevelFilter = null
}) {
  const noFullReadback = readbackMode === NO_FULL_READBACK_MODE;
  const resolvedP2gBackendPolicy = p2gBackendPolicy || resolveMlsMpmP2gBackendPolicy({
    requestedBackend: backend === MLS_MPM_P2G_BACKEND_CPU_REFERENCE
      ? MLS_MPM_P2G_BACKEND_CPU_REFERENCE
      : MLS_MPM_P2G_BACKEND_RESIDENT_SCATTER
  });
  return {
    schema: ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
    backend,
    status: 'projected',
    kernelScope: GRID_SCOPE,
    p2gBackendPolicy: resolvedP2gBackendPolicy,
    p2gBackendPolicyStatus: resolvedP2gBackendPolicy.status,
    p2gBackendRequested: resolvedP2gBackendPolicy.requestedBackend,
    p2gBackendEffective: resolvedP2gBackendPolicy.effectiveBackend,
    p2gBackendFallbackReason: resolvedP2gBackendPolicy.fallbackReason,
    particleCount: sphParticleState.particleCount,
    sourceSchemas: {
      sphParticleState: sphParticleState.schema,
      mlsMpmParticleState: mlsMpmParticleState.schema
    },
    sourceStep: sphParticleState.step ?? mlsMpmParticleState.step ?? 0,
    sourceTime: sphParticleState.time ?? mlsMpmParticleState.time ?? 0,
    dt,
    gridSpacingM: gridSpec.gridSpacingM,
    gridDims: [...gridSpec.gridDims],
    gridNodeCount: gridSpec.gridNodeCount,
    gridShift: gridSpec.shift,
    gridNodeLayout: [...MLS_MPM_GPU_GRID_NODE_ROW_LAYOUT],
    gridNodeStrideFloats: MLS_MPM_GPU_GRID_NODE_FLOATS,
    gridNodeStrideBytes: MLS_MPM_GPU_GRID_NODE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    gridNodes,
    internalPressureScale,
    ambientPressurePa: Math.max(0, finiteNumber(ambientPressurePa, 0)),
    ambientPressureAppliedInStressProjection: backend === 'webgpu',
    schroederLevelFilter: schroederLevelFilter ? { ...schroederLevelFilter } : null,
    schroederLevelFilterEnabled: schroederLevelFilter?.enabled === true,
    schroederSelectedLevel: schroederLevelFilter?.enabled === true ? schroederLevelFilter.selectedLevel : null,
    readbackMode,
    fullReadbackPerformed: !noFullReadback,
    normalHotLoopReadbackFree: noFullReadback,
    p2gProjectionValidation: false,
    stressProjectionValidation: false,
    gridValidation: false,
    g2pValidation: false,
    residentProductMass,
    residentProductMassStatus: residentProductMass?.status ?? null,
    residentProductMassInputProductEventCount: residentProductMassProductEventCount,
    residentProductMassCoupledEventCount,
    residentProductMassCoupledUnplacedMassKg,
    residentProductMassConsumeMassPolicy: residentProductMass?.consumeMassPolicy ?? null,
    residentProductMassGridCouplingStatus: residentProductMassProductEventBufferDeviceMismatch
      ? 'blocked-cross-device-product-event-buffer'
      : residentProductMassGridCouplingStatus({
          residentProductMass,
          productEventCount: residentProductMassProductEventCount,
          backend
        }),
    residentProductMassProductEventBufferDeviceMismatch,
    residentProductMassProductEventBufferSourceDeviceId,
    residentProductMassProductEventBufferConsumerDeviceId,
    residentProductMassEosCouplingStatus: residentProductMass?.eosCouplingStatus ?? null,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

export function projectMlsMpmP2gGridCpu({
  sphParticleState,
  mlsMpmParticleState,
  gridSpacingM = sphParticleState?.smoothingLengthM,
  boxDimsM = DEFAULT_BOX_DIMS_M,
  dt = mlsMpmParticleState?.mechanicsDtS ?? 0,
  residentProductMass = null,
  internalPressureScale = 1,
  ambientPressurePa = 0,
  p2gBackend = MLS_MPM_P2G_BACKEND_CPU_REFERENCE,
  schroederLevelAssignment = null,
  schroederSelectedLevel = null
} = {}) {
  assertPackedInputs({ sphParticleState, mlsMpmParticleState });
  const gridSpec = createMlsMpmGridSpec({ boxDimsM, gridSpacingM });
  const dtSeconds = finiteNumber(dt, 0);
  const schroederFilter = normalizeSchroederLevelFilter({ schroederLevelAssignment, schroederSelectedLevel });
  const schroederAssignmentRows = schroederLevelAssignment?.assignments instanceof Float32Array
    ? schroederLevelAssignment.assignments
    : null;
  if (schroederFilter.enabled && !(schroederAssignmentRows instanceof Float32Array)) {
    throw new TypeError('CPU MLS-MPM P2G Schroeder level filtering requires assignment rows');
  }
  const p2gBackendPolicy = resolveMlsMpmP2gBackendPolicy({
    requestedBackend: p2gBackend === MLS_MPM_P2G_BACKEND_CPU_REFERENCE
      ? MLS_MPM_P2G_BACKEND_CPU_REFERENCE
      : p2gBackend
  });
  const gridNodes = new Float32Array(gridSpec.gridNodeCount * MLS_MPM_GPU_GRID_NODE_FLOATS);
  const activeNodeIndices = [];

  const activateNode = (nodeIndex, nodeX, nodeY, nodeZ) => {
    const nodeOffset = nodeIndex * MLS_MPM_GPU_GRID_NODE_FLOATS;
    if (gridNodes[nodeOffset + 7] === 0) {
      gridNodes[nodeOffset + 4] = nodeX;
      gridNodes[nodeOffset + 5] = nodeY;
      gridNodes[nodeOffset + 6] = nodeZ;
      gridNodes[nodeOffset + 7] = 1;
      activeNodeIndices.push(nodeIndex);
    }
    return nodeOffset;
  };

  for (let particleIndex = 0; particleIndex < sphParticleState.particleCount; particleIndex += 1) {
    if (!particlePassesSchroederLevelFilter(particleIndex, schroederFilter, schroederAssignmentRows)) {
      continue;
    }
    const stateOffset = particleIndex * SPH_GPU_PARTICLE_STATE_FLOATS;
    const thermoOffset = particleIndex * SPH_GPU_PARTICLE_THERMO_FLOATS;
    const mechanicsOffset = particleIndex * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS;
    const px = sphParticleState.state[stateOffset];
    const py = sphParticleState.state[stateOffset + 1];
    const pz = sphParticleState.state[stateOffset + 2];
    const particleMass = sphParticleState.state[stateOffset + 3];
    const vx = sphParticleState.state[stateOffset + 4];
    const vy = sphParticleState.state[stateOffset + 5];
    const vz = sphParticleState.state[stateOffset + 6];
    const pGridX = px * gridSpec.invGridSpacingM;
    const pGridY = py * gridSpec.invGridSpacingM;
    const pGridZ = pz * gridSpec.invGridSpacingM;
    const baseX = Math.floor(pGridX - 0.5);
    const baseY = Math.floor(pGridY - 0.5);
    const baseZ = Math.floor(pGridZ - 0.5);
    const wx = quadraticWeights(pGridX - baseX);
    const wy = quadraticWeights(pGridY - baseY);
    const wz = quadraticWeights(pGridZ - baseZ);
    const C0 = mlsMpmParticleState.mechanics[mechanicsOffset + 9];
    const C1 = mlsMpmParticleState.mechanics[mechanicsOffset + 10];
    const C2 = mlsMpmParticleState.mechanics[mechanicsOffset + 11];
    const C3 = mlsMpmParticleState.mechanics[mechanicsOffset + 12];
    const C4 = mlsMpmParticleState.mechanics[mechanicsOffset + 13];
    const C5 = mlsMpmParticleState.mechanics[mechanicsOffset + 14];
    const C6 = mlsMpmParticleState.mechanics[mechanicsOffset + 15];
    const C7 = mlsMpmParticleState.mechanics[mechanicsOffset + 16];
    const C8 = mlsMpmParticleState.mechanics[mechanicsOffset + 17];
    const restVolumeM3 = Math.max(mlsMpmParticleState.mechanics[mechanicsOffset + 19], 0);
    const J = Math.max(mlsMpmParticleState.mechanics[mechanicsOffset + 18], 1e-9);
    const volumeM3 = restVolumeM3 * J;
    const sigma = dtSeconds !== 0 && volumeM3 > 0
      ? stressTensorForPackedParticle({
        sphParticleState,
        mlsMpmParticleState,
        stateOffset,
        thermoOffset,
        mechanicsOffset,
        internalPressureScale
      })
      : null;
    const stressScale = -dtSeconds * volumeM3 * 4 * gridSpec.invGridSpacingM * gridSpec.invGridSpacingM;
    const aff0 = particleMass * C0 + stressScale * (sigma?.[0] ?? 0);
    const aff1 = particleMass * C1 + stressScale * (sigma?.[1] ?? 0);
    const aff2 = particleMass * C2 + stressScale * (sigma?.[2] ?? 0);
    const aff3 = particleMass * C3 + stressScale * (sigma?.[3] ?? 0);
    const aff4 = particleMass * C4 + stressScale * (sigma?.[4] ?? 0);
    const aff5 = particleMass * C5 + stressScale * (sigma?.[5] ?? 0);
    const aff6 = particleMass * C6 + stressScale * (sigma?.[6] ?? 0);
    const aff7 = particleMass * C7 + stressScale * (sigma?.[7] ?? 0);
    const aff8 = particleMass * C8 + stressScale * (sigma?.[8] ?? 0);

    for (let ox = 0; ox < 3; ox += 1) {
      const i = baseX + ox + gridSpec.shift;
      const nodeX = (baseX + ox) * gridSpec.gridSpacingM;
      for (let oy = 0; oy < 3; oy += 1) {
        const j = baseY + oy + gridSpec.shift;
        const nodeY = (baseY + oy) * gridSpec.gridSpacingM;
        for (let oz = 0; oz < 3; oz += 1) {
          const k = baseZ + oz + gridSpec.shift;
          const nodeIndex = gridNodeIndexFromCoords(i, j, k, gridSpec);
          if (nodeIndex < 0) continue;
          const weight = wx[ox] * wy[oy] * wz[oz];
          if (weight === 0) continue;
          const nodeZ = (baseZ + oz) * gridSpec.gridSpacingM;
          const nodeOffset = activateNode(nodeIndex, nodeX, nodeY, nodeZ);
          const dx = nodeX - px;
          const dy = nodeY - py;
          const dz = nodeZ - pz;
          const affineX = aff0 * dx + aff1 * dy + aff2 * dz;
          const affineY = aff3 * dx + aff4 * dy + aff5 * dz;
          const affineZ = aff6 * dx + aff7 * dy + aff8 * dz;
          gridNodes[nodeOffset] += weight * particleMass;
          gridNodes[nodeOffset + 1] += weight * (particleMass * vx + affineX);
          gridNodes[nodeOffset + 2] += weight * (particleMass * vy + affineY);
          gridNodes[nodeOffset + 3] += weight * (particleMass * vz + affineZ);
        }
      }
    }
  }

  const productMassContribution = splatResidentProductMassToGridCpu({
    residentProductMass,
    gridSpec,
    gridNodes,
    activateNode,
    dtSeconds,
    internalPressureScale
  });

  for (const nodeIndex of activeNodeIndices) {
    const offset = nodeIndex * MLS_MPM_GPU_GRID_NODE_FLOATS;
    gridNodes[offset + 7] = gridNodes[offset] > 0 ? 1 : 0;
  }

  return outputEnvelope({
    backend: 'cpu-reference',
    sphParticleState,
    mlsMpmParticleState,
    gridSpec,
    gridNodes,
    dt: dtSeconds,
    internalPressureScale,
    ambientPressurePa,
    p2gBackendPolicy,
    residentProductMass,
    schroederLevelFilter: schroederFilter,
    residentProductMassProductEventCount: productMassContribution.productEventCount,
    residentProductMassCoupledEventCount: productMassContribution.coupledEventCount,
    residentProductMassCoupledUnplacedMassKg: productMassContribution.coupledUnplacedMassKg
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

function createProjectionParamsArray(
  gridSpec,
  particleCount,
  dt,
  productEventCount = 0,
  internalPressureScale = 1,
  schroederLevelFilter = null,
  ambientPressurePa = 0
) {
  const buffer = new ArrayBuffer(80);
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
  view.setUint32(36, Math.max(0, Math.round(finiteNumber(productEventCount, 0))), true);
  view.setFloat32(40, finiteNumber(internalPressureScale, 1), true);
  view.setUint32(44, schroederLevelFilter?.enabled === true ? 1 : 0, true);
  view.setInt32(48, Math.round(finiteNumber(schroederLevelFilter?.selectedLevel, 0)), true);
  view.setUint32(52, Math.max(1, Math.round(finiteNumber(
    schroederLevelFilter?.assignmentStrideFloats,
    SCHROEDER_LEVEL_ASSIGNMENT_FLOATS
  ))), true);
  view.setUint32(56, 0, true);
  view.setUint32(60, SCHROEDER_ACTIVE_NODE_FLOATS, true);
  // grid_density_pressure_enabled + pads: the standalone runner keeps the
  // spatial-density EOS term off (no previous-substep grid available); the
  // fused resident sequence enables it.
  view.setUint32(64, 0, true);
  // ambient_pressure_pa: the gauge reference for the ideal-gas partial
  // pressure. 0 = vacuum box (default); a uniform atmosphere would exert no
  // net force on immersed bodies, so gas stress is measured relative to it.
  view.setFloat32(68, Math.max(0, finiteNumber(ambientPressurePa, 0)), true);
  return buffer;
}

export async function runMlsMpmP2gGridProjectionWebGpu({
  device,
  sphParticleState,
  mlsMpmParticleState,
  sphParticleUpload = null,
  mlsMpmParticleUpload = null,
  schroederLevelAssignment = null,
  schroederSelectedLevel = null,
  gridSpacingM = sphParticleState?.smoothingLengthM,
  boxDimsM = DEFAULT_BOX_DIMS_M,
  dt = mlsMpmParticleState?.mechanicsDtS ?? 0,
  residentProductMass = null,
  internalPressureScale = 1,
  ambientPressurePa = 0,
  retainGridBuffer = false,
  readbackMode = FULL_READBACK_MODE,
  p2gBackend = MLS_MPM_P2G_BACKEND_RESIDENT_SCATTER
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runMlsMpmP2gGridProjectionWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  assertPackedInputs({ sphParticleState, mlsMpmParticleState });
  const gridSpec = createMlsMpmGridSpec({ boxDimsM, gridSpacingM });
  const p2gBackendPolicy = resolveMlsMpmP2gBackendPolicy({
    requestedBackend: p2gBackend,
    supportsOceanTiledKernel: false
  });
  const outputByteLength = gridSpec.gridNodeCount * MLS_MPM_GPU_GRID_NODE_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const accumulatorElementCount = Math.max(1, gridSpec.gridNodeCount * P2G_ACCUMULATOR_COMPONENTS);
  const accumulatorByteLength = accumulatorElementCount * Int32Array.BYTES_PER_ELEMENT;
  const borrowedStateBuffer = sphParticleUpload?.status === 'webgpu-uploaded' ? sphParticleUpload.stateBuffer : null;
  const borrowedThermoBuffer = sphParticleUpload?.status === 'webgpu-uploaded' ? sphParticleUpload.thermoBuffer : null;
  const borrowedMechanicsBuffer = mlsMpmParticleUpload?.status === 'webgpu-uploaded'
    ? mlsMpmParticleUpload.mechanicsBuffer
    : null;
  const productEventRows = productEventRowsFromResidentProductMass(residentProductMass);
  const schroederFilter = normalizeSchroederLevelFilter({ schroederLevelAssignment, schroederSelectedLevel });
  const schroederAssignmentRows = schroederLevelAssignment?.assignments instanceof Float32Array
    ? schroederLevelAssignment.assignments
    : null;
  const borrowedSchroederAssignmentBuffer = schroederFilter.enabled
    ? (schroederLevelAssignment?.assignmentBuffer || null)
    : null;
  if (schroederFilter.enabled && !borrowedSchroederAssignmentBuffer && !(schroederAssignmentRows instanceof Float32Array)) {
    throw new TypeError('WebGPU MLS-MPM P2G Schroeder level filtering requires retained assignment buffer or assignment rows');
  }
  const rawBorrowedProductEventBuffer = residentProductMass?.productEventBuffer || null;
  const productEventBufferMismatch = rawBorrowedProductEventBuffer && !(productEventRows instanceof Float32Array)
    ? webGpuDeviceMismatchInfo({
        buffer: rawBorrowedProductEventBuffer,
        residentProductMass,
        device
      })
    : { mismatch: false, sourceDeviceId: null, consumerDeviceId: null };
  const borrowedProductEventBuffer = rawBorrowedProductEventBuffer
    && webGpuBufferMatchesDevice(rawBorrowedProductEventBuffer, device)
    ? rawBorrowedProductEventBuffer
    : null;
  const productEventCount = borrowedProductEventBuffer || productEventRows instanceof Float32Array
    ? productEventRowCountFromResidentProductMass(residentProductMass, productEventRows)
    : 0;
  const stateBuffer = borrowedStateBuffer || writeStorageBuffer(device, 'ulg-mls-mpm-p2g-sph-state-in', sphParticleState.state);
  const thermoBuffer = borrowedThermoBuffer || writeStorageBuffer(device, 'ulg-mls-mpm-p2g-sph-thermo-in', sphParticleState.thermo);
  const mechanicsBuffer = borrowedMechanicsBuffer || writeStorageBuffer(device, 'ulg-mls-mpm-p2g-mechanics-in', mlsMpmParticleState.mechanics);
  const productEventBuffer = borrowedProductEventBuffer
    || tagWebGpuBufferDevice(writeStorageBuffer(
      device,
      'ulg-mls-mpm-p2g-resident-product-events-in',
      productEventRows instanceof Float32Array && productEventRows.length >= SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS
        ? productEventRows
        : EMPTY_PRODUCT_EVENT_STORAGE_ROWS
    ), device);
  const schroederAssignmentBuffer = borrowedSchroederAssignmentBuffer
    || writeStorageBuffer(
      device,
      schroederFilter.enabled
        ? 'ulg-mls-mpm-p2g-schroeder-level-assignments-in'
        : 'ulg-mls-mpm-p2g-schroeder-level-assignments-dummy',
      schroederFilter.enabled ? schroederAssignmentRows : new Float32Array(SCHROEDER_LEVEL_ASSIGNMENT_FLOATS)
    );
  const schroederActiveNodeBuffer = writeStorageBuffer(
    device,
    'ulg-mls-mpm-p2g-schroeder-active-nodes-dummy',
    new Float32Array(SCHROEDER_ACTIVE_NODE_FLOATS)
  );
  const gridBuffer = device.createBuffer({
    label: 'ulg-mls-mpm-p2g-grid-out',
    size: Math.max(4, outputByteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const accumulatorBuffer = device.createBuffer({
    label: 'ulg-mls-mpm-p2g-grid-accumulators',
    size: Math.max(4, accumulatorByteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-mls-mpm-p2g-params',
    size: 80,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const noFullReadback = readbackMode === NO_FULL_READBACK_MODE;
  const readBuffer = noFullReadback
    ? null
    : device.createBuffer({
      label: 'ulg-mls-mpm-p2g-grid-readback',
      size: Math.max(4, outputByteLength),
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
  let returnedRetainedGridBuffer = false;

  try {
    device.queue.writeBuffer(paramsBuffer, 0, createProjectionParamsArray(
      gridSpec,
      sphParticleState.particleCount,
      dt,
      productEventCount,
      internalPressureScale,
      schroederFilter,
      ambientPressurePa
    ));
    const p2gBindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'read-only-storage'),
      computeBufferBinding(3, 'storage'),
      computeBufferBinding(4, 'uniform'),
      computeBufferBinding(5, 'read-only-storage'),
      computeBufferBinding(6, 'storage'),
      computeBufferBinding(7, 'read-only-storage'),
      computeBufferBinding(8, 'read-only-storage')
    ];
    const { pipeline, bindGroupLayout } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-mls-mpm-p2g-grid-projection.scatter.v5',
      label: 'ulg-mls-mpm-p2g-grid-projection',
      code: mlsMpmP2gGridProjectionWgsl,
      entryPoint: 'main',
      bindings: p2gBindings
    });
    const { pipeline: productPipeline, bindGroupLayout: productBindGroupLayout } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-mls-mpm-p2g-grid-projection.product-scatter.v5',
      label: 'ulg-mls-mpm-p2g-product-event-scatter',
      code: mlsMpmP2gGridProjectionWgsl,
      entryPoint: 'scatter_product_events',
      bindings: p2gBindings
    });
    const { pipeline: finalizePipeline, bindGroupLayout: finalizeBindGroupLayout } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-mls-mpm-p2g-grid-projection.finalize.v5',
      label: 'ulg-mls-mpm-p2g-grid-finalize',
      code: mlsMpmP2gGridProjectionWgsl,
      entryPoint: 'finalize_grid',
      bindings: p2gBindings
    });
    const p2gEntries = [
        { binding: 0, resource: { buffer: stateBuffer } },
        { binding: 1, resource: { buffer: thermoBuffer } },
        { binding: 2, resource: { buffer: mechanicsBuffer } },
        { binding: 3, resource: { buffer: accumulatorBuffer } },
        { binding: 4, resource: { buffer: paramsBuffer } },
        { binding: 5, resource: { buffer: productEventBuffer } },
        { binding: 6, resource: { buffer: gridBuffer } },
        { binding: 7, resource: { buffer: schroederAssignmentBuffer } },
        { binding: 8, resource: { buffer: schroederActiveNodeBuffer } }
      ];
    const bindGroup = device.createBindGroup({ layout: bindGroupLayout, entries: p2gEntries });
    const productBindGroup = device.createBindGroup({ layout: productBindGroupLayout, entries: p2gEntries });
    const finalizeBindGroup = device.createBindGroup({ layout: finalizeBindGroupLayout, entries: p2gEntries });
    const encoder = device.createCommandEncoder();
    if (typeof encoder.clearBuffer === 'function') {
      encoder.clearBuffer(accumulatorBuffer, 0, Math.max(4, accumulatorByteLength));
    } else {
      device.queue.writeBuffer(accumulatorBuffer, 0, new Int32Array(accumulatorElementCount));
    }
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.max(1, Math.ceil(sphParticleState.particleCount / 64)));
    pass.end();
    if (productEventCount > 0) {
      const productPass = encoder.beginComputePass();
      productPass.setPipeline(productPipeline);
      productPass.setBindGroup(0, productBindGroup);
      productPass.dispatchWorkgroups(Math.max(1, Math.ceil(productEventCount / 64)));
      productPass.end();
    }
    const finalizePass = encoder.beginComputePass();
    finalizePass.setPipeline(finalizePipeline);
    finalizePass.setBindGroup(0, finalizeBindGroup);
    finalizePass.dispatchWorkgroups(Math.max(1, Math.ceil(gridSpec.gridNodeCount / 64)));
    finalizePass.end();
    if (!noFullReadback) {
      encoder.copyBufferToBuffer(gridBuffer, 0, readBuffer, 0, Math.max(4, outputByteLength));
    }
    device.queue.submit([encoder.finish()]);
    let gridNodes = new Float32Array();
    if (!noFullReadback) {
      await readBuffer.mapAsync(GPU_MAP_MODE.READ);
      gridNodes = new Float32Array(readBuffer.getMappedRange()).slice(0, gridSpec.gridNodeCount * MLS_MPM_GPU_GRID_NODE_FLOATS);
      readBuffer.unmap();
    }
    const projection = outputEnvelope({
      backend: 'webgpu',
      sphParticleState,
      mlsMpmParticleState,
      gridSpec,
      gridNodes,
      dt,
      internalPressureScale,
      ambientPressurePa,
      readbackMode: noFullReadback ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE,
      p2gBackendPolicy,
      residentProductMass,
      residentProductMassProductEventCount: productEventCount,
      residentProductMassCoupledEventCount: productEventCount > 0
        ? (residentProductMass?.productEventActiveEventCount ?? null)
        : 0,
      residentProductMassCoupledUnplacedMassKg: productEventCount > 0
        ? (residentProductMass?.unplacedProductMassKg ?? null)
        : 0,
      residentProductMassProductEventBufferDeviceMismatch: productEventBufferMismatch.mismatch,
      residentProductMassProductEventBufferSourceDeviceId: productEventBufferMismatch.sourceDeviceId,
      residentProductMassProductEventBufferConsumerDeviceId: productEventBufferMismatch.consumerDeviceId,
      schroederLevelFilter: schroederFilter
    });
    if (retainGridBuffer) {
      projection.gridBuffer = gridBuffer;
      projection.gridBufferByteLength = outputByteLength;
      projection.destroyGridBuffer = () => gridBuffer.destroy?.();
      returnedRetainedGridBuffer = true;
    }
    return projection;
  } finally {
    const cleanup = () => {
      if (!borrowedStateBuffer) stateBuffer.destroy?.();
      if (!borrowedThermoBuffer) thermoBuffer.destroy?.();
      if (!borrowedMechanicsBuffer) mechanicsBuffer.destroy?.();
      if (!borrowedProductEventBuffer) productEventBuffer.destroy?.();
      if (!borrowedSchroederAssignmentBuffer) schroederAssignmentBuffer.destroy?.();
      schroederActiveNodeBuffer.destroy?.();
      if (!retainGridBuffer || !returnedRetainedGridBuffer) gridBuffer.destroy?.();
      accumulatorBuffer.destroy?.();
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

function createNoFullReadbackParityReport(tolerance = 5e-2) {
  return {
    schema: ULG_MLS_MPM_GPU_GRID_PROJECTION_PARITY_SCHEMA,
    status: 'not-run-no-full-readback',
    tolerance,
    maxGridAbs: null,
    lengthMismatch: null,
    reason: 'Full P2G grid readback and CPU parity were skipped for resident WebGPU execution',
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

export function createMlsMpmP2gGridProjectionParityReport({ cpuReference, gpuResult, tolerance = 5e-2 } = {}) {
  const cpuGrid = cpuReference?.gridNodes;
  const gpuGrid = gpuResult?.gridNodes;
  if (!(cpuGrid instanceof Float32Array) || !(gpuGrid instanceof Float32Array)) {
    return {
      schema: ULG_MLS_MPM_GPU_GRID_PROJECTION_PARITY_SCHEMA,
      status: 'fail',
      tolerance,
      maxGridAbs: Number.POSITIVE_INFINITY,
      lengthMismatch: true,
      reason: 'missing grid projection buffers',
      cpuBackend: cpuReference?.backend || null,
      gpuBackend: gpuResult?.backend || null,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  }
  const comparisonCount = Math.min(cpuGrid.length, gpuGrid.length);
  let maxGridAbs = 0;
  let ignoredInactivePositionMaxAbs = 0;
  let ignoredInactivePositionCount = 0;
  for (let index = 0; index < comparisonCount; index += 1) {
    const field = index % MLS_MPM_GPU_GRID_NODE_FLOATS;
    const rowOffset = index - field;
    const inactiveInBoth = (cpuGrid[rowOffset] ?? 0) === 0
      && (gpuGrid[rowOffset] ?? 0) === 0
      && (cpuGrid[rowOffset + 7] ?? 0) === 0
      && (gpuGrid[rowOffset + 7] ?? 0) === 0;
    const diff = Math.abs(cpuGrid[index] - gpuGrid[index]);
    if (inactiveInBoth && field >= 4 && field <= 6) {
      ignoredInactivePositionMaxAbs = Math.max(ignoredInactivePositionMaxAbs, diff);
      if (diff > tolerance) ignoredInactivePositionCount += 1;
      continue;
    }
    maxGridAbs = Math.max(maxGridAbs, diff);
  }
  const lengthMismatch = cpuGrid.length !== gpuGrid.length;
  const passed = !lengthMismatch && maxGridAbs <= tolerance;
  return {
    schema: ULG_MLS_MPM_GPU_GRID_PROJECTION_PARITY_SCHEMA,
    status: passed ? 'pass' : 'fail',
    tolerance,
    maxGridAbs,
    lengthMismatch,
    ignoredInactivePositionMaxAbs,
    ignoredInactivePositionCount,
    gridNodeCount: cpuReference?.gridNodeCount ?? gpuResult?.gridNodeCount ?? 0,
    cpuBackend: cpuReference.backend,
    gpuBackend: gpuResult.backend,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function executionFromProjection(projection, {
  cpuReference = null,
  gpuResult = null,
  webgpuStatus,
  webgpuParity = null
} = {}) {
  return {
    schema: ULG_MLS_MPM_GPU_GRID_PROJECTION_EXECUTION_SCHEMA,
    projectionSchema: projection?.schema || ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
    backend: projection?.backend || 'cpu-reference',
    status: projection?.status || 'projected',
    kernelScope: GRID_SCOPE,
    particleCount: projection?.particleCount ?? 0,
    dt: projection?.dt ?? 0,
    gridSpacingM: projection?.gridSpacingM ?? 0,
    gridDims: projection?.gridDims ?? [],
    gridNodeCount: projection?.gridNodeCount ?? 0,
    gridShift: projection?.gridShift ?? 1,
    gridNodeStrideFloats: MLS_MPM_GPU_GRID_NODE_FLOATS,
    gridNodes: projection?.gridNodes ?? new Float32Array(),
    internalPressureScale: projection?.internalPressureScale ?? 1,
    ambientPressurePa: projection?.ambientPressurePa ?? 0,
    ambientPressureAppliedInStressProjection:
      projection?.ambientPressureAppliedInStressProjection === true,
    schroederLevelFilter: projection?.schroederLevelFilter ?? null,
    schroederLevelFilterEnabled: projection?.schroederLevelFilterEnabled === true,
    schroederSelectedLevel: projection?.schroederSelectedLevel ?? null,
    readbackMode: projection?.readbackMode ?? FULL_READBACK_MODE,
    fullReadbackPerformed: projection?.fullReadbackPerformed ?? true,
    normalHotLoopReadbackFree: projection?.normalHotLoopReadbackFree ?? false,
    p2gBackendPolicy: projection?.p2gBackendPolicy ?? null,
    p2gBackendPolicyStatus: projection?.p2gBackendPolicyStatus ?? null,
    p2gBackendRequested: projection?.p2gBackendRequested ?? null,
    p2gBackendEffective: projection?.p2gBackendEffective ?? null,
    p2gBackendFallbackReason: projection?.p2gBackendFallbackReason ?? null,
    cpuReference,
    gpuResult,
    webgpuStatus,
    webgpuParity,
    p2gProjectionValidation: false,
    stressProjectionValidation: false,
    gridValidation: false,
    g2pValidation: false,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    residentProductMass: projection?.residentProductMass ?? null,
    residentProductMassStatus: projection?.residentProductMassStatus ?? null,
    residentProductMassInputProductEventCount: projection?.residentProductMassInputProductEventCount ?? 0,
    residentProductMassCoupledEventCount: projection?.residentProductMassCoupledEventCount ?? null,
    residentProductMassCoupledUnplacedMassKg: projection?.residentProductMassCoupledUnplacedMassKg ?? null,
    residentProductMassConsumeMassPolicy: projection?.residentProductMassConsumeMassPolicy ?? null,
    residentProductMassGridCouplingStatus: projection?.residentProductMassGridCouplingStatus ?? null,
    residentProductMassEosCouplingStatus: projection?.residentProductMassEosCouplingStatus ?? null,
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

export async function runMlsMpmP2gGridProjectionWithOptionalWebGpu({
  sphParticleState,
  mlsMpmParticleState,
  sphParticleUpload = null,
  mlsMpmParticleUpload = null,
  schroederLevelAssignment = null,
  schroederSelectedLevel = null,
  gridSpacingM = sphParticleState?.smoothingLengthM,
  boxDimsM = DEFAULT_BOX_DIMS_M,
  dt = mlsMpmParticleState?.mechanicsDtS ?? 0,
  residentProductMass = null,
  internalPressureScale = 1,
  ambientPressurePa = 0,
  preferWebGpu = false,
  navigatorRef = globalThis.navigator,
  device = null,
  deviceResult = null,
  parityTolerance = 5e-2,
  retainGridBuffer = false,
  onDeviceLost = null,
  webGpuRunner = runMlsMpmP2gGridProjectionWebGpu,
  readbackMode = FULL_READBACK_MODE,
  p2gBackend = MLS_MPM_P2G_BACKEND_RESIDENT_SCATTER
} = {}) {
  const noFullReadback = readbackMode === NO_FULL_READBACK_MODE;
  let cpuReference = null;
  const getCpuReference = () => {
    if (!cpuReference) {
      cpuReference = projectMlsMpmP2gGridCpu({
        sphParticleState,
        mlsMpmParticleState,
        gridSpacingM,
        boxDimsM,
        dt,
        residentProductMass,
        internalPressureScale,
        ambientPressurePa,
        schroederLevelAssignment,
        schroederSelectedLevel,
        p2gBackend: MLS_MPM_P2G_BACKEND_CPU_REFERENCE
      });
    }
    return cpuReference;
  };
  if (!preferWebGpu) {
    const reference = getCpuReference();
    return executionFromProjection(reference, {
      cpuReference: reference,
      webgpuStatus: {
        status: 'not-requested',
        reason: 'WebGPU MLS-MPM P2G grid projection path not requested'
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
      return executionFromProjection(reference, {
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
      return executionFromProjection(reference, {
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
      sphParticleState,
      mlsMpmParticleState,
      sphParticleUpload,
      mlsMpmParticleUpload,
      schroederLevelAssignment,
      schroederSelectedLevel,
      gridSpacingM,
      boxDimsM,
      dt,
      residentProductMass,
      internalPressureScale,
      ambientPressurePa,
      retainGridBuffer,
      readbackMode: noFullReadback ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE,
      p2gBackend
    });
    await Promise.resolve();
    if (lostInfo) {
      const reference = getCpuReference();
      return executionFromProjection(reference, {
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
      return executionFromProjection(gpuResult, {
        cpuReference: null,
        gpuResult,
        webgpuStatus: {
          status: 'webgpu-executed-no-full-readback',
          reason: 'WebGPU MLS-MPM P2G grid projection executed without full grid readback'
        },
        webgpuParity: createNoFullReadbackParityReport(parityTolerance)
      });
    }
    const reference = getCpuReference();
    const webgpuParity = createMlsMpmP2gGridProjectionParityReport({
      cpuReference: reference,
      gpuResult,
      tolerance: parityTolerance
    });
    if (webgpuParity.status !== 'pass') {
      gpuResult.destroyGridBuffer?.();
      return executionFromProjection(reference, {
        cpuReference: reference,
        gpuResult,
        webgpuStatus: {
          status: 'webgpu-parity-failed',
          reason: 'CPU/WebGPU MLS-MPM P2G grid projection parity exceeded tolerance',
          fallback: 'cpu-reference'
        },
        webgpuParity
      });
    }
    return executionFromProjection(gpuResult, {
      cpuReference: reference,
      gpuResult,
      webgpuStatus: {
        status: 'webgpu-executed',
        reason: 'CPU/WebGPU MLS-MPM P2G grid projection parity passed'
      },
      webgpuParity
    });
  } catch (error) {
    const reference = getCpuReference();
    return executionFromProjection(reference, {
      cpuReference: reference,
      webgpuStatus: {
        status: 'webgpu-error-fallback',
        reason: error instanceof Error ? error.message : String(error),
        fallback: 'cpu-reference'
      }
    });
  }
}
