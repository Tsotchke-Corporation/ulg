import {
  SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT,
  ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_PARITY_SCHEMA,
  ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_UPDATE_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import {
  SEPARATION_BIN_CAPACITY,
  mlsMpmG2pReconstructWgsl,
  mlsMpmParticleSeparationApplyWgsl,
  mlsMpmParticleSeparationBinFillWgsl,
  mlsMpmParticleSeparationComputeWgsl
} from '../../../ulg-gpu-abi/src/wgsl.js';
import { requestOpticalGpuDevice } from '../material/opticalGpuBuffers.js';
import { computeBufferBinding, createCachedExplicitComputePipeline, deferSubmittedWorkCleanup } from '../webgpuComputeLayout.js';
import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
  MLS_MPM_PARTICLE_SEPARATION_RELAXATION_DEFAULT,
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_THERMO_FLOATS
} from './sphGpuBuffers.js';

export { MLS_MPM_PARTICLE_SEPARATION_RELAXATION_DEFAULT };
import { MLS_MPM_GPU_GRID_VELOCITY_FLOATS } from './sphGridUpdateGpuKernel.js';

export {
  ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_PARITY_SCHEMA,
  ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_SCHEMA,
  mlsMpmG2pReconstructWgsl
};

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
const G2P_SCOPE = 'mls-mpm-g2p-velocity-affine-deformation-reconstruction';
const FULL_READBACK_MODE = 'full-parity-readback';
const NO_FULL_READBACK_MODE = 'no-full-readback';
const SCHROEDER_LEVEL_ASSIGNMENT_FLOATS = SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT.length;
const EOS_MODEL_IDS = Object.freeze({
  disabled: 0,
  taitCondensed: 1
});
export const MLS_MPM_CONDENSED_VOLUME_STRAIN_TOLERANCE = 5e-2;
const CONDENSED_MIN_VOLUME_RATIO_J = 1 - MLS_MPM_CONDENSED_VOLUME_STRAIN_TOLERANCE;
const CONDENSED_MAX_VOLUME_RATIO_J = 1 + MLS_MPM_CONDENSED_VOLUME_STRAIN_TOLERANCE;
const CONDENSED_MAX_VOLUME_RATIO_CHANGE_PER_STEP = 1.5;
export const MLS_MPM_G2P_MIN_VOLUME_RATIO_J = 0.1;
export const MLS_MPM_G2P_MAX_RADIUS_GROWTH_RATIO = 4;
export const MLS_MPM_G2P_MAX_VOLUME_RATIO_J = MLS_MPM_G2P_MAX_RADIUS_GROWTH_RATIO ** 3;
export const ULG_MLS_MPM_G2P_PARTICLE_SCALE_STABILITY_SCHEMA =
  'peercompute.ulg.mls-mpm-g2p-particle-scale-stability.v0';
const G2P_PARAMS_BYTES = 80;
const SEPARATION_PARAMS_BYTES = 48;
const SEPARATION_BIN_MAX_CELLS = 262144;

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

function particleWallClearanceM(restVolumeM3, boxDimsM = DEFAULT_BOX_DIMS_M) {
  const volume = finiteNumber(restVolumeM3, 0);
  if (!(volume > 0)) return 0;
  const minDim = Math.min(...boxDimsM.filter((value) => value > 0));
  const clearance = 0.5 * Math.cbrt(volume);
  return Number.isFinite(minDim) && minDim > 0
    ? Math.min(clearance, 0.49 * minDim)
    : clearance;
}

function assertInputs({ sphParticleState, mlsMpmParticleState, gridUpdate, requireUpdatedGridNodes = true }) {
  if (sphParticleState?.schema !== ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError('MLS-MPM G2P requires a packed SPH GPU particle buffer');
  }
  if (mlsMpmParticleState?.schema !== ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError('MLS-MPM G2P requires a packed MLS-MPM GPU particle buffer');
  }
  if (sphParticleState.particleCount !== mlsMpmParticleState.particleCount) {
    throw new RangeError('SPH and MLS-MPM particle counts must match');
  }
  if (
    gridUpdate?.schema !== ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA
    && gridUpdate?.schema !== ULG_MLS_MPM_GPU_GRID_UPDATE_EXECUTION_SCHEMA
    && gridUpdate?.updateSchema !== ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA
  ) {
    throw new TypeError('MLS-MPM G2P requires a grid update artifact');
  }
  if (requireUpdatedGridNodes && !(gridUpdate.updatedGridNodes instanceof Float32Array)) {
    throw new TypeError('MLS-MPM G2P requires Float32Array updatedGridNodes');
  }
}

function quadraticWeights(fx) {
  const a = 1.5 - fx;
  const b = fx - 1;
  const c = fx - 0.5;
  return [0.5 * a * a, 0.75 - b * b, 0.5 * c * c];
}

function det3(F) {
  return F[0] * (F[4] * F[8] - F[5] * F[7])
    - F[1] * (F[3] * F[8] - F[5] * F[6])
    + F[2] * (F[3] * F[7] - F[4] * F[6]);
}

function multiplyGradF(F, C, dt) {
  const grad = [
    1 + dt * C[0], dt * C[1], dt * C[2],
    dt * C[3], 1 + dt * C[4], dt * C[5],
    dt * C[6], dt * C[7], 1 + dt * C[8]
  ];
  return [
    grad[0] * F[0] + grad[1] * F[3] + grad[2] * F[6],
    grad[0] * F[1] + grad[1] * F[4] + grad[2] * F[7],
    grad[0] * F[2] + grad[1] * F[5] + grad[2] * F[8],
    grad[3] * F[0] + grad[4] * F[3] + grad[5] * F[6],
    grad[3] * F[1] + grad[4] * F[4] + grad[5] * F[7],
    grad[3] * F[2] + grad[4] * F[5] + grad[5] * F[8],
    grad[6] * F[0] + grad[7] * F[3] + grad[8] * F[6],
    grad[6] * F[1] + grad[7] * F[4] + grad[8] * F[7],
    grad[6] * F[2] + grad[7] * F[5] + grad[8] * F[8]
  ];
}

function isotropicF(volumeRatioJ) {
  const s = Math.cbrt(Math.max(volumeRatioJ, 1e-12));
  return [s, 0, 0, 0, s, 0, 0, 0, s];
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function condensedTargetVolumeRatioJ(rawNextJ, previousJ) {
  const previousBounded = clamp(
    finiteNumber(previousJ, 1),
    CONDENSED_MIN_VOLUME_RATIO_J,
    CONDENSED_MAX_VOLUME_RATIO_J
  );
  const lower = Math.max(
    CONDENSED_MIN_VOLUME_RATIO_J,
    previousBounded / CONDENSED_MAX_VOLUME_RATIO_CHANGE_PER_STEP
  );
  const upper = Math.min(
    CONDENSED_MAX_VOLUME_RATIO_J,
    previousBounded * CONDENSED_MAX_VOLUME_RATIO_CHANGE_PER_STEP
  );
  return clamp(finiteNumber(rawNextJ, previousBounded), lower, upper);
}

function isCondensedMechanicsRow(mechanics, mechanicsOffset) {
  const solidFlag = mechanics[mechanicsOffset + 20];
  const eosModelId = Math.round(mechanics[mechanicsOffset + 26]);
  return solidFlag > 0.5 || eosModelId === EOS_MODEL_IDS.taitCondensed;
}

// 0 = excluded (gas/EOS-disabled), 1 = liquid, 2 = solid. Mirrors
// separation_phase_class in mlsMpmParticleSeparationComputeWgsl.
function separationPhaseClass(mechanics, mechanicsOffset) {
  if (mechanics[mechanicsOffset + 20] > 0.5) return 2;
  const eosModelId = mechanics[mechanicsOffset + 26];
  if (eosModelId > 0.5 && eosModelId < 1.5) return 1;
  return 0;
}

/**
 * Excluded-volume particle separation (CPU mirror of the WGSL pass).
 * MLS-MPM J is reconstructed from the grid velocity gradient, so two
 * particles inside one grid cell sample the same velocity field and their
 * overlap never registers as compression. This pass projects pair overlap
 * out at the particle level: pair rest distance derives from each particle's
 * rest volume (cbrt(V0)), corrections are inverse-mass weighted and
 * symmetric (momentum/COM conserving), and approaching normal velocity is
 * removed inelastically. Solid-solid pairs are skipped (the elastic
 * constitutive law owns intra-lattice repulsion); gas is skipped (gas EOS
 * owns compressibility). Mutates state in place.
 */
export function applyMlsMpmParticleSeparationCpu({
  state,
  mechanics,
  particleCount,
  boxDimsM = DEFAULT_BOX_DIMS_M,
  relaxation = MLS_MPM_PARTICLE_SEPARATION_RELAXATION_DEFAULT
} = {}) {
  const alpha = finiteNumber(relaxation, 0);
  if (!(alpha > 0) || !(particleCount > 1)) return { correctedCount: 0 };
  const dims = finiteVector3(boxDimsM, DEFAULT_BOX_DIMS_M);
  const corrections = new Float64Array(particleCount * 6);
  const stateStride = SPH_GPU_PARTICLE_STATE_FLOATS;
  const mechanicsStride = MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS;
  let correctedCount = 0;
  for (let i = 0; i < particleCount; i += 1) {
    const iState = i * stateStride;
    const iMech = i * mechanicsStride;
    const phaseClass = separationPhaseClass(mechanics, iMech);
    if (phaseClass === 0) continue;
    const massI = state[iState + 3];
    if (!(massI > 0)) continue;
    const restVolumeI = Math.max(mechanics[iMech + 19], 0);
    if (!(restVolumeI > 0)) continue;
    const dSelf = Math.cbrt(Math.max(restVolumeI, 1e-18));
    const wSelf = 1 / Math.max(massI, 1e-30);
    let dxX = 0; let dxY = 0; let dxZ = 0;
    let dvX = 0; let dvY = 0; let dvZ = 0;
    for (let other = 0; other < particleCount; other += 1) {
      if (other === i) continue;
      const oState = other * stateStride;
      const massOther = state[oState + 3];
      if (!(massOther > 0)) continue;
      const oMech = other * mechanicsStride;
      const otherClass = separationPhaseClass(mechanics, oMech);
      if (otherClass === 0) continue;
      if (phaseClass === 2 && otherClass === 2) continue;
      const restVolumeOther = Math.max(mechanics[oMech + 19], 0);
      if (!(restVolumeOther > 0)) continue;
      const pairRestDistance = 0.5 * (dSelf + Math.cbrt(Math.max(restVolumeOther, 1e-18)));
      const deltaX = state[iState] - state[oState];
      const deltaY = state[iState + 1] - state[oState + 1];
      const deltaZ = state[iState + 2] - state[oState + 2];
      let dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ);
      if (dist >= pairRestDistance) continue;
      let nX = 0; let nY = 1; let nZ = 0;
      if (dist > 1e-9) {
        nX = deltaX / dist; nY = deltaY / dist; nZ = deltaZ / dist;
      } else {
        nY = i > other ? 1 : -1;
        dist = 0;
      }
      const wOther = 1 / Math.max(massOther, 1e-30);
      const share = wSelf / (wSelf + wOther);
      const push = alpha * share * (pairRestDistance - dist);
      dxX += push * nX; dxY += push * nY; dxZ += push * nZ;
      const approach = (state[iState + 4] - state[oState + 4]) * nX
        + (state[iState + 5] - state[oState + 5]) * nY
        + (state[iState + 6] - state[oState + 6]) * nZ;
      if (approach < 0) {
        const impulse = -share * approach;
        dvX += impulse * nX; dvY += impulse * nY; dvZ += impulse * nZ;
      }
    }
    const dxLen = Math.sqrt(dxX * dxX + dxY * dxY + dxZ * dxZ);
    const maxStep = 0.5 * dSelf;
    if (dxLen > maxStep) {
      const scale = maxStep / dxLen;
      dxX *= scale; dxY *= scale; dxZ *= scale;
    }
    if (dxLen > 0 || dvX !== 0 || dvY !== 0 || dvZ !== 0) {
      const base = i * 6;
      corrections[base] = dxX; corrections[base + 1] = dxY; corrections[base + 2] = dxZ;
      corrections[base + 3] = dvX; corrections[base + 4] = dvY; corrections[base + 5] = dvZ;
      correctedCount += 1;
    }
  }
  if (correctedCount === 0) return { correctedCount };
  for (let i = 0; i < particleCount; i += 1) {
    const base = i * 6;
    if (corrections[base] === 0 && corrections[base + 1] === 0 && corrections[base + 2] === 0
      && corrections[base + 3] === 0 && corrections[base + 4] === 0 && corrections[base + 5] === 0) continue;
    const iState = i * stateStride;
    const iMech = i * mechanicsStride;
    const position = [
      state[iState] + corrections[base],
      state[iState + 1] + corrections[base + 1],
      state[iState + 2] + corrections[base + 2]
    ];
    const velocity = [
      state[iState + 4] + corrections[base + 3],
      state[iState + 5] + corrections[base + 4],
      state[iState + 6] + corrections[base + 5]
    ];
    const wallClearance = particleWallClearanceM(mechanics[iMech + 19], dims);
    for (let axis = 0; axis < 3; axis += 1) {
      const lower = wallClearance;
      const upper = Math.max(lower, dims[axis] - wallClearance);
      if (position[axis] < lower) {
        position[axis] = lower;
        if (velocity[axis] < 0) velocity[axis] = 0;
      } else if (position[axis] > upper) {
        position[axis] = upper;
        if (velocity[axis] > 0) velocity[axis] = 0;
      }
    }
    state[iState] = position[0];
    state[iState + 1] = position[1];
    state[iState + 2] = position[2];
    state[iState + 4] = velocity[0];
    state[iState + 5] = velocity[1];
    state[iState + 6] = velocity[2];
  }
  return { correctedCount };
}

function stabilizeCondensedF(nextF, rawNextJ, previousJ, solid) {
  const targetJ = condensedTargetVolumeRatioJ(rawNextJ, previousJ);
  if (!solid) {
    return {
      nextF: isotropicF(targetJ),
      nextJ: targetJ
    };
  }
  if (!(rawNextJ > 1e-12)) {
    return {
      nextF: isotropicF(targetJ),
      nextJ: targetJ
    };
  }
  const scale = Math.cbrt(targetJ / rawNextJ);
  return {
    nextF: nextF.map((value) => value * scale),
    nextJ: targetJ
  };
}

function stabilizeGeneralParticleScaleF(nextF, rawNextJ) {
  const numericJ = Number(rawNextJ);
  const finiteRawJ = Number.isFinite(numericJ);
  const finiteF = Array.isArray(nextF)
    && nextF.length === 9
    && nextF.every((value) => Number.isFinite(Number(value)));
  if (!finiteF || !finiteRawJ) {
    const targetJ = clamp(finiteNumber(rawNextJ, 1), MLS_MPM_G2P_MIN_VOLUME_RATIO_J, MLS_MPM_G2P_MAX_VOLUME_RATIO_J);
    return {
      nextF: isotropicF(targetJ),
      nextJ: targetJ,
      capped: true,
      invalid: true,
      rawVolumeRatioJ: finiteRawJ ? numericJ : null,
      reason: 'non-finite-deformation'
    };
  }
  if (numericJ < MLS_MPM_G2P_MIN_VOLUME_RATIO_J) {
    return {
      nextF: isotropicF(MLS_MPM_G2P_MIN_VOLUME_RATIO_J),
      nextJ: MLS_MPM_G2P_MIN_VOLUME_RATIO_J,
      capped: true,
      invalid: false,
      rawVolumeRatioJ: numericJ,
      reason: 'below-min-volume-ratio'
    };
  }
  if (numericJ > MLS_MPM_G2P_MAX_VOLUME_RATIO_J) {
    const scale = Math.cbrt(MLS_MPM_G2P_MAX_VOLUME_RATIO_J / Math.max(numericJ, 1e-12));
    const scaledF = nextF.map((value) => value * scale);
    if (scaledF.every((value) => Number.isFinite(value))) {
      return {
        nextF: scaledF,
        nextJ: MLS_MPM_G2P_MAX_VOLUME_RATIO_J,
        capped: true,
        invalid: false,
        rawVolumeRatioJ: numericJ,
        reason: 'above-max-volume-ratio'
      };
    }
    return {
      nextF: isotropicF(MLS_MPM_G2P_MAX_VOLUME_RATIO_J),
      nextJ: MLS_MPM_G2P_MAX_VOLUME_RATIO_J,
      capped: true,
      invalid: true,
      rawVolumeRatioJ: numericJ,
      reason: 'above-max-volume-ratio-non-finite-scale'
    };
  }
  return {
    nextF,
    nextJ: numericJ,
    capped: false,
    invalid: false,
    rawVolumeRatioJ: numericJ,
    reason: null
  };
}

function summarizeG2pParticleScaleStability({
  backend,
  particleCount,
  mechanics,
  capCount = null,
  invalidCount = null,
  maxRawVolumeRatioJ = null,
  cappedSamples = [],
  source = null
} = {}) {
  const count = Math.max(0, Math.round(finiteNumber(particleCount, 0)));
  const stride = MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS;
  const hasMechanics = mechanics instanceof Float32Array && mechanics.length >= count * stride;
  let minEffectiveVolumeRatioJ = Number.POSITIVE_INFINITY;
  let maxEffectiveVolumeRatioJ = 0;
  let effectiveFiniteCount = 0;
  if (hasMechanics) {
    for (let index = 0; index < count; index += 1) {
      const j = Number(mechanics[index * stride + 18]);
      if (!Number.isFinite(j)) continue;
      effectiveFiniteCount += 1;
      minEffectiveVolumeRatioJ = Math.min(minEffectiveVolumeRatioJ, j);
      maxEffectiveVolumeRatioJ = Math.max(maxEffectiveVolumeRatioJ, j);
    }
  }
  const knownCapCount = Number.isFinite(Number(capCount)) ? Math.max(0, Math.round(Number(capCount))) : null;
  const knownInvalidCount = Number.isFinite(Number(invalidCount)) ? Math.max(0, Math.round(Number(invalidCount))) : null;
  const policySource = source || (backend === 'webgpu'
    ? 'webgpu-g2p-shader'
    : 'cpu-reference-g2p-deformation-update');
  const status = knownCapCount > 0
    ? 'particle-scale-cap-applied'
    : (hasMechanics
        ? 'particle-scale-bounded'
        : 'gpu-g2p-cap-policy-applied-in-shader');
  return {
    schema: ULG_MLS_MPM_G2P_PARTICLE_SCALE_STABILITY_SCHEMA,
    status,
    source: policySource,
    particleCount: count,
    mechanicsStrideFloats: stride,
    mechanicsVolumeRatioJOffset: 18,
    minVolumeRatioJAllowed: MLS_MPM_G2P_MIN_VOLUME_RATIO_J,
    maxRadiusGrowthRatioAllowed: MLS_MPM_G2P_MAX_RADIUS_GROWTH_RATIO,
    maxVolumeRatioJAllowed: MLS_MPM_G2P_MAX_VOLUME_RATIO_J,
    policyAppliedInG2p: true,
    policyAppliedInShader: backend === 'webgpu',
    capCountKnown: knownCapCount != null,
    capCount: knownCapCount,
    invalidCountKnown: knownInvalidCount != null,
    invalidCount: knownInvalidCount,
    effectiveFiniteCount,
    minEffectiveVolumeRatioJ: effectiveFiniteCount > 0 ? minEffectiveVolumeRatioJ : null,
    maxEffectiveVolumeRatioJ: effectiveFiniteCount > 0 ? maxEffectiveVolumeRatioJ : null,
    maxRawVolumeRatioJ: Number.isFinite(Number(maxRawVolumeRatioJ))
      ? Number(maxRawVolumeRatioJ)
      : (effectiveFiniteCount > 0 ? maxEffectiveVolumeRatioJ : null),
    cappedSamples: cappedSamples.slice(0, 8)
  };
}

function gridIndex(gridUpdate, i, j, k) {
  const [, gny, gnz] = gridUpdate.gridDims;
  return ((i + gridUpdate.gridShift) * gny + (j + gridUpdate.gridShift)) * gnz + (k + gridUpdate.gridShift);
}

function inRange(gridUpdate, i, j, k) {
  const [gnx, gny, gnz] = gridUpdate.gridDims;
  return i + gridUpdate.gridShift >= 0 && i + gridUpdate.gridShift < gnx
    && j + gridUpdate.gridShift >= 0 && j + gridUpdate.gridShift < gny
    && k + gridUpdate.gridShift >= 0 && k + gridUpdate.gridShift < gnz;
}

function outputEnvelope({
  backend,
  sphParticleState,
  mlsMpmParticleState,
  gridUpdate,
  state,
  mechanics,
  dt,
  boxDimsM,
  internalPressureScale = 1,
  readbackMode = FULL_READBACK_MODE,
  particleScaleStability = null
}) {
  const noFullReadback = readbackMode === NO_FULL_READBACK_MODE;
  const particleScaleStabilitySummary = particleScaleStability || summarizeG2pParticleScaleStability({
    backend,
    particleCount: sphParticleState?.particleCount ?? 0,
    mechanics,
    source: backend === 'webgpu' ? 'webgpu-g2p-shader' : 'cpu-reference-g2p-deformation-update'
  });
  return {
    schema: ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_SCHEMA,
    backend,
    status: 'reconstructed',
    kernelScope: G2P_SCOPE,
    sourceSchemas: {
      sphParticleState: sphParticleState.schema,
      mlsMpmParticleState: mlsMpmParticleState.schema,
      gridUpdate: gridUpdate.schema
    },
    particleCount: sphParticleState.particleCount,
    gridNodeCount: gridUpdate.gridNodeCount,
    gridSpacingM: gridUpdate.gridSpacingM,
    gridDims: [...gridUpdate.gridDims],
    gridShift: gridUpdate.gridShift,
    dt,
    boxDimsM: [...boxDimsM],
    internalPressureScale,
    stateStrideFloats: SPH_GPU_PARTICLE_STATE_FLOATS,
    thermoStrideFloats: SPH_GPU_PARTICLE_THERMO_FLOATS,
    mechanicsStrideFloats: MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
    state,
    mechanics,
    readbackMode,
    fullReadbackPerformed: !noFullReadback,
    normalHotLoopReadbackFree: noFullReadback,
    particleScaleStability: particleScaleStabilitySummary,
    particleScaleStabilitySchema: particleScaleStabilitySummary.schema,
    particleScaleStabilityStatus: particleScaleStabilitySummary.status,
    particleScalePolicyAppliedInG2p: particleScaleStabilitySummary.policyAppliedInG2p === true,
    particleScaleMaxVolumeRatioJAllowed: particleScaleStabilitySummary.maxVolumeRatioJAllowed,
    particleScaleMaxRadiusGrowthRatioAllowed: particleScaleStabilitySummary.maxRadiusGrowthRatioAllowed,
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

export function reconstructMlsMpmG2pCpu({
  sphParticleState,
  mlsMpmParticleState,
  gridUpdate,
  dt = gridUpdate?.dt ?? mlsMpmParticleState?.mechanicsDtS ?? 0,
  boxDimsM = DEFAULT_BOX_DIMS_M,
  internalPressureScale = 1,
  liquidWallDampingAlpha = mlsMpmParticleState?.liquidWallDampingAlpha ?? 0,
  liquidWallDampingDistanceM = mlsMpmParticleState?.liquidWallDampingDistanceM ?? 0,
  particleSeparationRelaxation = mlsMpmParticleState?.particleSeparationRelaxation
    ?? MLS_MPM_PARTICLE_SEPARATION_RELAXATION_DEFAULT
} = {}) {
  assertInputs({ sphParticleState, mlsMpmParticleState, gridUpdate });
  const dtSeconds = finiteNumber(dt, 0);
  const dims = finiteVector3(boxDimsM, DEFAULT_BOX_DIMS_M);
  const invDx = 1 / gridUpdate.gridSpacingM;
  const state = new Float32Array(sphParticleState.state);
  const mechanics = new Float32Array(mlsMpmParticleState.mechanics);
  let particleScaleCapCount = 0;
  let particleScaleInvalidCount = 0;
  let maxRawVolumeRatioJ = 0;
  const cappedSamples = [];

  for (let particleIndex = 0; particleIndex < sphParticleState.particleCount; particleIndex += 1) {
    const stateOffset = particleIndex * SPH_GPU_PARTICLE_STATE_FLOATS;
    const mechanicsOffset = particleIndex * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS;
    const position0 = [state[stateOffset], state[stateOffset + 1], state[stateOffset + 2]];
    const pGrid = position0.map((value) => value * invDx);
    const base = pGrid.map((value) => Math.floor(value - 0.5));
    const weights = [
      quadraticWeights(pGrid[0] - base[0]),
      quadraticWeights(pGrid[1] - base[1]),
      quadraticWeights(pGrid[2] - base[2])
    ];
    const velocity = [0, 0, 0];
    const C = new Array(9).fill(0);
    let sampledWeight = 0;
    for (let a = 0; a < 3; a += 1) for (let b = 0; b < 3; b += 1) for (let c = 0; c < 3; c += 1) {
      const i = base[0] + a;
      const j = base[1] + b;
      const k = base[2] + c;
      if (!inRange(gridUpdate, i, j, k)) continue;
      const w = weights[0][a] * weights[1][b] * weights[2][c];
      const nodeIndex = gridIndex(gridUpdate, i, j, k);
      const gridOffset = nodeIndex * MLS_MPM_GPU_GRID_VELOCITY_FLOATS;
      const gridMass = gridUpdate.updatedGridNodes[gridOffset];
      const gridStatus = gridUpdate.updatedGridNodes[gridOffset + 7];
      if (!(gridMass > 0) && !(gridStatus > 0)) continue;
      sampledWeight += w;
      const gv = [
        gridUpdate.updatedGridNodes[gridOffset + 1],
        gridUpdate.updatedGridNodes[gridOffset + 2],
        gridUpdate.updatedGridNodes[gridOffset + 3]
      ];
      velocity[0] += w * gv[0];
      velocity[1] += w * gv[1];
      velocity[2] += w * gv[2];
      const dpos = [
        (i - pGrid[0]) * gridUpdate.gridSpacingM,
        (j - pGrid[1]) * gridUpdate.gridSpacingM,
        (k - pGrid[2]) * gridUpdate.gridSpacingM
      ];
      const s = 4 * invDx * invDx * w;
      C[0] += s * gv[0] * dpos[0]; C[1] += s * gv[0] * dpos[1]; C[2] += s * gv[0] * dpos[2];
      C[3] += s * gv[1] * dpos[0]; C[4] += s * gv[1] * dpos[1]; C[5] += s * gv[1] * dpos[2];
      C[6] += s * gv[2] * dpos[0]; C[7] += s * gv[2] * dpos[1]; C[8] += s * gv[2] * dpos[2];
    }
    if (sampledWeight > 1e-8 && sampledWeight < 1 - 1e-6) {
      const normalization = 1 / sampledWeight;
      velocity[0] *= normalization;
      velocity[1] *= normalization;
      velocity[2] *= normalization;
      for (let index = 0; index < C.length; index += 1) C[index] *= normalization;
    }
    const position = [
      position0[0] + dtSeconds * velocity[0],
      position0[1] + dtSeconds * velocity[1],
      position0[2] + dtSeconds * velocity[2]
    ];
    const solid = mechanics[mechanicsOffset + 20] > 0.5;
    const condensed = isCondensedMechanicsRow(mechanics, mechanicsOffset);
    const wallClearance = particleWallClearanceM(mechanics[mechanicsOffset + 19], dims);
    for (let axis = 0; axis < 3; axis += 1) {
      const lower = wallClearance;
      const upper = Math.max(lower, dims[axis] - wallClearance);
      if (position[axis] < lower) {
        position[axis] = lower;
        if (velocity[axis] < 0) velocity[axis] = 0;
      } else if (position[axis] > upper) {
        position[axis] = upper;
        if (velocity[axis] > 0) velocity[axis] = 0;
      }
    }
    const wallDampingAlpha = clamp(finiteNumber(liquidWallDampingAlpha, 0), 0, 1);
    const wallDampingDistance = Math.max(finiteNumber(liquidWallDampingDistanceM, 0), 1e-9);
    if (!solid && condensed && wallDampingAlpha > 0) {
      const floorDistance = Math.max(0, position[1] - wallClearance);
      if (floorDistance < wallDampingDistance) {
        const q = 1 - (floorDistance / wallDampingDistance);
        const keep = clamp(1 - wallDampingAlpha * q * q, 0, 1);
        velocity[0] *= keep;
        velocity[1] *= keep;
        velocity[2] *= keep;
      }
    }
    state[stateOffset] = position[0];
    state[stateOffset + 1] = position[1];
    state[stateOffset + 2] = position[2];
    state[stateOffset + 4] = velocity[0];
    state[stateOffset + 5] = velocity[1];
    state[stateOffset + 6] = velocity[2];

    const eosModelId = Math.round(mechanics[mechanicsOffset + 26]);
    const F = Array.from(mechanics.slice(mechanicsOffset, mechanicsOffset + 9));
    const pressureScale = finiteNumber(internalPressureScale, 1);
    const deformationDisabled = !solid && (eosModelId === EOS_MODEL_IDS.disabled || pressureScale === 0);
    const effectiveC = deformationDisabled ? new Array(9).fill(0) : C;
    let nextF = F;
    let nextJ = finiteNumber(mechanics[mechanicsOffset + 18], det3(F));
    if (!deformationDisabled) {
      nextF = multiplyGradF(F, effectiveC, dtSeconds);
      nextJ = det3(nextF);
      if (condensed) {
        const stabilized = stabilizeCondensedF(
          nextF,
          nextJ,
          mechanics[mechanicsOffset + 18],
          solid
        );
        nextF = stabilized.nextF;
        nextJ = stabilized.nextJ;
      } else if (!solid) {
        nextF = isotropicF(Math.max(nextJ, 0.05));
        nextJ = det3(nextF);
      }
    }
    const scaleStability = stabilizeGeneralParticleScaleF(nextF, nextJ);
    maxRawVolumeRatioJ = Math.max(maxRawVolumeRatioJ, finiteNumber(scaleStability.rawVolumeRatioJ, 0));
    if (scaleStability.capped) {
      particleScaleCapCount += 1;
      if (scaleStability.invalid) particleScaleInvalidCount += 1;
      if (cappedSamples.length < 8) {
        cappedSamples.push({
          particleIndex,
          rawVolumeRatioJ: scaleStability.rawVolumeRatioJ,
          volumeRatioJ: scaleStability.nextJ,
          rawRadiusGrowthRatio: scaleStability.rawVolumeRatioJ != null
            ? Math.cbrt(Math.max(scaleStability.rawVolumeRatioJ, 1e-12))
            : null,
          radiusGrowthRatio: Math.cbrt(Math.max(scaleStability.nextJ, 1e-12)),
          reason: scaleStability.reason
        });
      }
    }
    nextF = scaleStability.nextF;
    nextJ = scaleStability.nextJ;
    mechanics.set(nextF, mechanicsOffset);
    mechanics.set(effectiveC, mechanicsOffset + 9);
    mechanics[mechanicsOffset + 18] = nextJ;
  }

  applyMlsMpmParticleSeparationCpu({
    state,
    mechanics,
    particleCount: sphParticleState.particleCount,
    boxDimsM: dims,
    relaxation: particleSeparationRelaxation
  });

  return outputEnvelope({
    backend: 'cpu-reference',
    sphParticleState,
    mlsMpmParticleState,
    gridUpdate,
    state,
    mechanics,
    dt: dtSeconds,
    boxDimsM: dims,
    internalPressureScale,
    particleScaleStability: summarizeG2pParticleScaleStability({
      backend: 'cpu-reference',
      particleCount: sphParticleState.particleCount,
      mechanics,
      capCount: particleScaleCapCount,
      invalidCount: particleScaleInvalidCount,
      maxRawVolumeRatioJ,
      cappedSamples,
      source: 'cpu-reference-g2p-deformation-update'
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

function createParamsArray({
  particleCount,
  gridUpdate,
  dt,
  boxDimsM,
  internalPressureScale,
  liquidWallDampingAlpha = 0,
  liquidWallDampingDistanceM = 0,
  schroederActiveNodeFilterEnabled = false,
  schroederLevelFilterEnabled = false,
  schroederSelectedLevel = -1
}) {
  const buffer = new ArrayBuffer(G2P_PARAMS_BYTES);
  const view = new DataView(buffer);
  view.setUint32(0, particleCount, true);
  view.setUint32(4, gridUpdate.gridNodeCount, true);
  view.setUint32(8, gridUpdate.gridDims[0], true);
  view.setUint32(12, gridUpdate.gridDims[1], true);
  view.setUint32(16, gridUpdate.gridDims[2], true);
  view.setUint32(20, gridUpdate.gridShift, true);
  view.setUint32(24, schroederActiveNodeFilterEnabled ? 1 : 0, true);
  view.setInt32(28, Math.round(finiteNumber(schroederSelectedLevel, -1)), true);
  view.setFloat32(32, gridUpdate.gridSpacingM, true);
  view.setFloat32(36, 1 / gridUpdate.gridSpacingM, true);
  view.setFloat32(40, dt, true);
  view.setFloat32(44, boxDimsM[0], true);
  view.setFloat32(48, boxDimsM[1], true);
  view.setFloat32(52, boxDimsM[2], true);
  view.setFloat32(56, finiteNumber(internalPressureScale, 1), true);
  view.setFloat32(60, clamp(finiteNumber(liquidWallDampingAlpha, 0), 0, 1), true);
  view.setFloat32(64, Math.max(finiteNumber(liquidWallDampingDistanceM, 0), 0), true);
  view.setUint32(68, SCHROEDER_LEVEL_ASSIGNMENT_FLOATS, true);
  view.setUint32(72, schroederLevelFilterEnabled ? 1 : 0, true);
  return buffer;
}

/**
 * Largest pair rest distance in the current mechanics rows (cbrt of the
 * per-particle rest volume). Used to size the separation neighbor-bin cells
 * so a 3x3x3 cell scan covers every interacting pair. Cached on the
 * mechanics array since rest volumes only drift on phase change (the 1.25
 * sizing margin in the caller absorbs that drift).
 */
export function maxSeparationRestDistanceM(mechanics, particleCount) {
  if (!(mechanics instanceof Float32Array) || mechanics.length === 0) return 0;
  let maxVolume = 0;
  const count = Math.min(
    Math.max(0, Math.floor(particleCount)),
    Math.floor(mechanics.length / MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS)
  );
  for (let index = 0; index < count; index += 1) {
    const volume = mechanics[index * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS + 19];
    if (volume > maxVolume) maxVolume = volume;
  }
  return maxVolume > 0 ? Math.cbrt(maxVolume) : 0;
}

function separationBinPlan({ boxDimsM, maxPairRestDistanceM, minCellSizeM = 0 }) {
  const restDistance = finiteNumber(maxPairRestDistanceM, 0);
  if (!(restDistance > 0)) return null;
  // 1.25 margin over the largest rest distance absorbs phase-change rest
  // volume drift while keeping the 3x3x3 scan complete. minCellSizeM lets a
  // sharing consumer (thermal conduction, support 2h with scan radius <= 3)
  // demand cells large enough that its clamped scan still covers its support.
  let cellSizeM = Math.max(1.25 * restDistance, finiteNumber(minCellSizeM, 0));
  const dims = boxDimsM;
  const cellsFor = (size) => [0, 1, 2].map((axis) => Math.max(1, Math.ceil(dims[axis] / size)));
  let counts = cellsFor(cellSizeM);
  let total = counts[0] * counts[1] * counts[2];
  while (total > SEPARATION_BIN_MAX_CELLS) {
    cellSizeM *= 2;
    counts = cellsFor(cellSizeM);
    total = counts[0] * counts[1] * counts[2];
  }
  return { cellSizeM, nx: counts[0], ny: counts[1], nz: counts[2], cellCount: total };
}

/**
 * Encode the excluded-volume separation passes onto an existing command
 * encoder, after G2P has written post-integration particle state. Pass 1
 * fills fixed-capacity grid-cell bins, pass 2 scans the 3x3x3 cell
 * neighborhood from the frozen state and writes per-particle corrections
 * (race-free: each thread writes only its own rows), pass 3 applies the
 * corrections to the state buffer in place and re-clamps to the sealed box.
 * Pass `scratch` (from a previous call on the same encoder sequence) to
 * reuse the bin/corrections/params buffers across fused substeps.
 * Returns transient buffers the caller must destroy after submission.
 */
export function encodeMlsMpmParticleSeparationPasses(device, encoder, {
  stateBuffer,
  mechanicsBuffer,
  particleCount,
  boxDimsM = DEFAULT_BOX_DIMS_M,
  relaxation = MLS_MPM_PARTICLE_SEPARATION_RELAXATION_DEFAULT,
  maxPairRestDistanceM = 0,
  minCellSizeM = 0,
  scratch = null
} = {}) {
  const alpha = finiteNumber(relaxation, 0);
  if (!(alpha > 0) || !(particleCount > 1) || !stateBuffer || !mechanicsBuffer) {
    return { enabled: false, transientBuffers: scratch?.transientBuffers || [], scratch };
  }
  const dims = finiteVector3(boxDimsM, DEFAULT_BOX_DIMS_M);
  const binPlan = separationBinPlan({ boxDimsM: dims, maxPairRestDistanceM, minCellSizeM });
  if (!binPlan) {
    return { enabled: false, transientBuffers: scratch?.transientBuffers || [], scratch };
  }
  let activeScratch = scratch;
  if (!activeScratch
    || activeScratch.particleCount !== particleCount
    || activeScratch.cellCount !== binPlan.cellCount) {
    const paramsBuffer = device.createBuffer({
      label: 'ulg-mls-mpm-separation-params',
      size: SEPARATION_PARAMS_BYTES,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
    });
    const paramsData = new ArrayBuffer(SEPARATION_PARAMS_BYTES);
    const view = new DataView(paramsData);
    view.setUint32(0, particleCount >>> 0, true);
    view.setFloat32(4, alpha, true);
    view.setFloat32(8, dims[0], true);
    view.setFloat32(12, dims[1], true);
    view.setFloat32(16, dims[2], true);
    view.setUint32(20, 1, true);
    view.setUint32(24, binPlan.nx >>> 0, true);
    view.setUint32(28, binPlan.ny >>> 0, true);
    view.setUint32(32, binPlan.nz >>> 0, true);
    view.setUint32(36, SEPARATION_BIN_CAPACITY >>> 0, true);
    view.setFloat32(40, binPlan.cellSizeM, true);
    device.queue.writeBuffer(paramsBuffer, 0, paramsData);
    const correctionsBuffer = device.createBuffer({
      label: 'ulg-mls-mpm-separation-corrections',
      size: Math.max(4, particleCount * 32),
      usage: GPU_BUFFER_USAGE.STORAGE
    });
    // Combined layout: counts prefix [0, cellCount), then entry slots. One
    // buffer keeps every consumer within the default 10-storage-buffer
    // per-stage device limit.
    const binsBuffer = device.createBuffer({
      label: 'ulg-mls-mpm-separation-bins',
      size: Math.max(4, binPlan.cellCount * (1 + SEPARATION_BIN_CAPACITY) * 4),
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
    });
    activeScratch = {
      particleCount,
      cellCount: binPlan.cellCount,
      paramsBuffer,
      correctionsBuffer,
      binsBuffer,
      // Shared neighbor-bin contract for sibling consumers (thermal pair
      // conduction) encoded in the same submission after the bin fill.
      neighborBins: {
        binsBuffer,
        capacity: SEPARATION_BIN_CAPACITY,
        nx: binPlan.nx,
        ny: binPlan.ny,
        nz: binPlan.nz,
        cellSizeM: binPlan.cellSizeM,
        cellCount: binPlan.cellCount
      },
      transientBuffers: [paramsBuffer, correctionsBuffer, binsBuffer]
    };
  }
  const binFillPipelineInfo = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-mls-mpm-particle-separation-bin-fill.v2',
    label: 'ulg-mls-mpm-particle-separation-bin-fill',
    code: mlsMpmParticleSeparationBinFillWgsl,
    entryPoint: 'main',
    bindings: [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'storage'),
      computeBufferBinding(3, 'uniform')
    ]
  });
  const computePipelineInfo = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-mls-mpm-particle-separation-compute.v3',
    label: 'ulg-mls-mpm-particle-separation-compute',
    code: mlsMpmParticleSeparationComputeWgsl,
    entryPoint: 'main',
    bindings: [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'storage'),
      computeBufferBinding(3, 'uniform'),
      computeBufferBinding(4, 'read-only-storage')
    ]
  });
  const applyPipelineInfo = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-mls-mpm-particle-separation-apply.v2',
    label: 'ulg-mls-mpm-particle-separation-apply',
    code: mlsMpmParticleSeparationApplyWgsl,
    entryPoint: 'main',
    bindings: [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'storage'),
      computeBufferBinding(3, 'uniform')
    ]
  });
  const binFillBindGroup = device.createBindGroup({
    layout: binFillPipelineInfo.bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: stateBuffer } },
      { binding: 1, resource: { buffer: mechanicsBuffer } },
      { binding: 2, resource: { buffer: activeScratch.binsBuffer } },
      { binding: 3, resource: { buffer: activeScratch.paramsBuffer } }
    ]
  });
  const computeBindGroup = device.createBindGroup({
    layout: computePipelineInfo.bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: stateBuffer } },
      { binding: 1, resource: { buffer: mechanicsBuffer } },
      { binding: 2, resource: { buffer: activeScratch.correctionsBuffer } },
      { binding: 3, resource: { buffer: activeScratch.paramsBuffer } },
      { binding: 4, resource: { buffer: activeScratch.binsBuffer } }
    ]
  });
  const applyBindGroup = device.createBindGroup({
    layout: applyPipelineInfo.bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: activeScratch.correctionsBuffer } },
      { binding: 1, resource: { buffer: mechanicsBuffer } },
      { binding: 2, resource: { buffer: stateBuffer } },
      { binding: 3, resource: { buffer: activeScratch.paramsBuffer } }
    ]
  });
  encoder.clearBuffer(activeScratch.binsBuffer, 0, Math.max(4, activeScratch.cellCount * 4));
  const workgroups = Math.max(1, Math.ceil(particleCount / 64));
  const binFillPass = encoder.beginComputePass();
  binFillPass.setPipeline(binFillPipelineInfo.pipeline);
  binFillPass.setBindGroup(0, binFillBindGroup);
  binFillPass.dispatchWorkgroups(workgroups);
  binFillPass.end();
  const computePass = encoder.beginComputePass();
  computePass.setPipeline(computePipelineInfo.pipeline);
  computePass.setBindGroup(0, computeBindGroup);
  computePass.dispatchWorkgroups(workgroups);
  computePass.end();
  const applyPass = encoder.beginComputePass();
  applyPass.setPipeline(applyPipelineInfo.pipeline);
  applyPass.setBindGroup(0, applyBindGroup);
  applyPass.dispatchWorkgroups(workgroups);
  applyPass.end();
  return { enabled: true, transientBuffers: activeScratch.transientBuffers, scratch: activeScratch };
}

export async function runMlsMpmG2pWebGpu({
  device,
  sphParticleState,
  mlsMpmParticleState,
  gridUpdate,
  sphParticleUpload = null,
  mlsMpmParticleUpload = null,
  updatedGridBuffer = null,
  dt = gridUpdate?.dt ?? mlsMpmParticleState?.mechanicsDtS ?? 0,
  boxDimsM = DEFAULT_BOX_DIMS_M,
  internalPressureScale = 1,
  liquidWallDampingAlpha = mlsMpmParticleState?.liquidWallDampingAlpha ?? 0,
  liquidWallDampingDistanceM = mlsMpmParticleState?.liquidWallDampingDistanceM ?? 0,
  particleSeparationRelaxation = mlsMpmParticleState?.particleSeparationRelaxation
    ?? MLS_MPM_PARTICLE_SEPARATION_RELAXATION_DEFAULT,
  schroederLevelAssignment = null,
  schroederActiveNodeList = null,
  schroederSelectedLevel = null,
  retainOutputParticleBuffers = false,
  readbackMode = FULL_READBACK_MODE
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runMlsMpmG2pWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  if (schroederActiveNodeList) {
    // The compacted active-node list is tile/node-aligned, not
    // particle-parallel; using it as a per-particle G2P filter silently
    // froze the simulation. Callers must pass the level assignment.
    throw new TypeError(
      'runMlsMpmG2pWebGpu no longer accepts schroederActiveNodeList; pass schroederLevelAssignment (particle-parallel rows) instead'
    );
  }
  assertInputs({ sphParticleState, mlsMpmParticleState, gridUpdate });
  const dtSeconds = finiteNumber(dt, 0);
  const dims = finiteVector3(boxDimsM, DEFAULT_BOX_DIMS_M);
  // Never size GPU output buffers from the CPU arrays alone: under
  // GPU-resident continuation the CPU copies can be stale or detached
  // (byteLength 0), which would allocate 4-byte outputs and fail every
  // downstream binding. particleCount * stride is authoritative.
  const stateByteLength = Math.max(
    sphParticleState.state.byteLength,
    sphParticleState.particleCount * (sphParticleState.stateStrideBytes
      ?? SPH_GPU_PARTICLE_STATE_FLOATS * Float32Array.BYTES_PER_ELEMENT)
  );
  const mechanicsByteLength = Math.max(
    mlsMpmParticleState.mechanics.byteLength,
    mlsMpmParticleState.particleCount * (mlsMpmParticleState.mechanicsStrideBytes
      ?? MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS * Float32Array.BYTES_PER_ELEMENT)
  );
  const borrowedStateBuffer = sphParticleUpload?.status === 'webgpu-uploaded' ? sphParticleUpload.stateBuffer : null;
  const borrowedThermoBuffer = sphParticleUpload?.status === 'webgpu-uploaded' ? sphParticleUpload.thermoBuffer : null;
  const borrowedMechanicsBuffer = mlsMpmParticleUpload?.status === 'webgpu-uploaded' ? mlsMpmParticleUpload.mechanicsBuffer : null;
  const borrowedGridBuffer = updatedGridBuffer || gridUpdate.gpuResult?.updatedGridBuffer || gridUpdate.updatedGridBuffer || null;
  assertInputs({
    sphParticleState,
    mlsMpmParticleState,
    gridUpdate,
    requireUpdatedGridNodes: !borrowedGridBuffer
  });
  const stateBuffer = borrowedStateBuffer || writeStorageBuffer(device, 'ulg-mls-mpm-g2p-sph-state-in', sphParticleState.state);
  const thermoBuffer = borrowedThermoBuffer || writeStorageBuffer(device, 'ulg-mls-mpm-g2p-sph-thermo-in', sphParticleState.thermo);
  const mechanicsBuffer = borrowedMechanicsBuffer || writeStorageBuffer(device, 'ulg-mls-mpm-g2p-mechanics-in', mlsMpmParticleState.mechanics);
  const gridBuffer = borrowedGridBuffer || writeStorageBuffer(device, 'ulg-mls-mpm-g2p-grid-in', gridUpdate.updatedGridNodes);
  const outStateBuffer = device.createBuffer({ label: 'ulg-mls-mpm-g2p-state-out', size: Math.max(4, stateByteLength), usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC });
  const outMechanicsBuffer = device.createBuffer({ label: 'ulg-mls-mpm-g2p-mechanics-out', size: Math.max(4, mechanicsByteLength), usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC });
  const paramsBuffer = device.createBuffer({ label: 'ulg-mls-mpm-g2p-params', size: G2P_PARAMS_BYTES, usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });
  const borrowedAssignmentBuffer = schroederLevelAssignment?.assignmentBuffer
    || schroederLevelAssignment?.buffer
    || null;
  const assignmentRows = schroederLevelAssignment?.assignments instanceof Float32Array
    ? schroederLevelAssignment.assignments
    : null;
  const schroederActiveNodeFilterEnabled = Boolean(
    (borrowedAssignmentBuffer || assignmentRows)
    && Number.isFinite(Number(schroederSelectedLevel))
  );
  const schroederLevelFilterEnabled = schroederActiveNodeFilterEnabled;
  const schroederActiveNodeBuffer = borrowedAssignmentBuffer || writeStorageBuffer(
    device,
    schroederActiveNodeFilterEnabled
      ? 'ulg-mls-mpm-g2p-schroeder-level-assignments-in'
      : 'ulg-mls-mpm-g2p-schroeder-level-assignments-dummy',
    assignmentRows || new Float32Array(SCHROEDER_LEVEL_ASSIGNMENT_FLOATS)
  );
  const noFullReadback = readbackMode === NO_FULL_READBACK_MODE;
  const stateReadBuffer = noFullReadback
    ? null
    : device.createBuffer({ label: 'ulg-mls-mpm-g2p-state-readback', size: Math.max(4, stateByteLength), usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST });
  const mechanicsReadBuffer = noFullReadback
    ? null
    : device.createBuffer({ label: 'ulg-mls-mpm-g2p-mechanics-readback', size: Math.max(4, mechanicsByteLength), usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST });
  let returnedRetainedOutputBuffers = false;
  let separationTransientBuffers = [];

  try {
    device.queue.writeBuffer(paramsBuffer, 0, createParamsArray({
      particleCount: sphParticleState.particleCount,
      gridUpdate,
      dt: dtSeconds,
      boxDimsM: dims,
      internalPressureScale,
      liquidWallDampingAlpha,
      liquidWallDampingDistanceM,
      schroederActiveNodeFilterEnabled,
      schroederLevelFilterEnabled,
      schroederSelectedLevel: schroederLevelFilterEnabled
        ? Math.round(Number(schroederSelectedLevel))
        : -1
    }));
    const { pipeline, bindGroupLayout } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-mls-mpm-g2p-reconstruct.v4',
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
        computeBufferBinding(6, 'uniform'),
        computeBufferBinding(7, 'read-only-storage')
      ]
    });
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: stateBuffer } },
        { binding: 1, resource: { buffer: thermoBuffer } },
        { binding: 2, resource: { buffer: mechanicsBuffer } },
        { binding: 3, resource: { buffer: gridBuffer } },
        { binding: 4, resource: { buffer: outStateBuffer } },
        { binding: 5, resource: { buffer: outMechanicsBuffer } },
        { binding: 6, resource: { buffer: paramsBuffer } },
        { binding: 7, resource: { buffer: schroederActiveNodeBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.max(1, Math.ceil(sphParticleState.particleCount / 64)));
    pass.end();
    const separation = encodeMlsMpmParticleSeparationPasses(device, encoder, {
      stateBuffer: outStateBuffer,
      mechanicsBuffer: outMechanicsBuffer,
      particleCount: sphParticleState.particleCount,
      boxDimsM: dims,
      relaxation: particleSeparationRelaxation,
      maxPairRestDistanceM: maxSeparationRestDistanceM(
        mlsMpmParticleState.mechanics,
        sphParticleState.particleCount
      )
    });
    separationTransientBuffers = separation.transientBuffers;
    if (!noFullReadback) {
      encoder.copyBufferToBuffer(outStateBuffer, 0, stateReadBuffer, 0, Math.max(4, stateByteLength));
      encoder.copyBufferToBuffer(outMechanicsBuffer, 0, mechanicsReadBuffer, 0, Math.max(4, mechanicsByteLength));
    }
    device.queue.submit([encoder.finish()]);
    let state = new Float32Array();
    let mechanics = new Float32Array();
    if (!noFullReadback) {
      await stateReadBuffer.mapAsync(GPU_MAP_MODE.READ);
      await mechanicsReadBuffer.mapAsync(GPU_MAP_MODE.READ);
      state = new Float32Array(stateReadBuffer.getMappedRange()).slice(0, sphParticleState.state.length);
      mechanics = new Float32Array(mechanicsReadBuffer.getMappedRange()).slice(0, mlsMpmParticleState.mechanics.length);
      stateReadBuffer.unmap();
      mechanicsReadBuffer.unmap();
    }
    const reconstruction = outputEnvelope({
      backend: 'webgpu',
      sphParticleState,
      mlsMpmParticleState,
      gridUpdate,
      state,
      mechanics,
      dt: dtSeconds,
      boxDimsM: dims,
      internalPressureScale,
      readbackMode: noFullReadback ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE
    });
    if (retainOutputParticleBuffers) {
      reconstruction.stateBuffer = outStateBuffer;
      reconstruction.mechanicsBuffer = outMechanicsBuffer;
      reconstruction.stateBufferByteLength = stateByteLength;
      reconstruction.mechanicsBufferByteLength = mechanicsByteLength;
      reconstruction.retainedOutputParticleBuffers = true;
      reconstruction.destroyOutputParticleBuffers = () => {
        outStateBuffer.destroy?.();
        outMechanicsBuffer.destroy?.();
      };
      returnedRetainedOutputBuffers = true;
    }
    return reconstruction;
  } finally {
    const cleanup = () => {
      if (!borrowedStateBuffer) stateBuffer.destroy?.();
      if (!borrowedThermoBuffer) thermoBuffer.destroy?.();
      if (!borrowedMechanicsBuffer) mechanicsBuffer.destroy?.();
      if (!borrowedGridBuffer) gridBuffer.destroy?.();
      if (!retainOutputParticleBuffers || !returnedRetainedOutputBuffers) {
        outStateBuffer.destroy?.();
        outMechanicsBuffer.destroy?.();
      }
      if (!borrowedAssignmentBuffer) schroederActiveNodeBuffer.destroy?.();
      paramsBuffer.destroy?.();
      for (const transientBuffer of separationTransientBuffers) transientBuffer.destroy?.();
      stateReadBuffer?.destroy?.();
      mechanicsReadBuffer?.destroy?.();
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
    schema: ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_PARITY_SCHEMA,
    status: 'not-run-no-full-readback',
    tolerance,
    maxStateAbs: null,
    maxMechanicsAbs: null,
    lengthMismatch: null,
    reason: 'Full G2P particle readback and CPU parity were skipped for resident WebGPU execution',
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

export function createMlsMpmG2pParityReport({ cpuReference, gpuResult, tolerance = 5e-2 } = {}) {
  if (!(cpuReference?.state instanceof Float32Array) || !(gpuResult?.state instanceof Float32Array)) {
    return { schema: ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_PARITY_SCHEMA, status: 'fail', tolerance, maxStateAbs: Infinity, maxMechanicsAbs: Infinity, lengthMismatch: true, scientificValidation: false, sphValidation: false, phaseChangeValidation: false, fullPhysicsValidation: false };
  }
  const stateCount = Math.min(cpuReference.state.length, gpuResult.state.length);
  const mechanicsCount = Math.min(cpuReference.mechanics.length, gpuResult.mechanics.length);
  let maxStateAbs = 0;
  let maxMechanicsAbs = 0;
  for (let i = 0; i < stateCount; i += 1) maxStateAbs = Math.max(maxStateAbs, Math.abs(cpuReference.state[i] - gpuResult.state[i]));
  for (let i = 0; i < mechanicsCount; i += 1) maxMechanicsAbs = Math.max(maxMechanicsAbs, Math.abs(cpuReference.mechanics[i] - gpuResult.mechanics[i]));
  const lengthMismatch = cpuReference.state.length !== gpuResult.state.length || cpuReference.mechanics.length !== gpuResult.mechanics.length;
  return {
    schema: ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_PARITY_SCHEMA,
    status: !lengthMismatch && maxStateAbs <= tolerance && maxMechanicsAbs <= tolerance ? 'pass' : 'fail',
    tolerance,
    maxStateAbs,
    maxMechanicsAbs,
    lengthMismatch,
    particleCount: cpuReference.particleCount ?? gpuResult.particleCount ?? 0,
    cpuBackend: cpuReference.backend,
    gpuBackend: gpuResult.backend,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function executionFromReconstruction(reconstruction, { cpuReference = null, gpuResult = null, webgpuStatus, webgpuParity = null } = {}) {
  return {
    schema: ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_EXECUTION_SCHEMA,
    reconstructionSchema: reconstruction?.schema || ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_SCHEMA,
    backend: reconstruction?.backend || 'cpu-reference',
    status: reconstruction?.status || 'reconstructed',
    kernelScope: G2P_SCOPE,
    particleCount: reconstruction?.particleCount ?? 0,
    gridNodeCount: reconstruction?.gridNodeCount ?? 0,
    gridSpacingM: reconstruction?.gridSpacingM ?? 0,
    gridDims: reconstruction?.gridDims ?? [],
    gridShift: reconstruction?.gridShift ?? 1,
    dt: reconstruction?.dt ?? 0,
    internalPressureScale: reconstruction?.internalPressureScale ?? 1,
    stateStrideFloats: SPH_GPU_PARTICLE_STATE_FLOATS,
    mechanicsStrideFloats: MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
    state: reconstruction?.state ?? new Float32Array(),
    mechanics: reconstruction?.mechanics ?? new Float32Array(),
    stateBuffer: reconstruction?.stateBuffer ?? null,
    mechanicsBuffer: reconstruction?.mechanicsBuffer ?? null,
    stateBufferByteLength: reconstruction?.stateBufferByteLength ?? 0,
    mechanicsBufferByteLength: reconstruction?.mechanicsBufferByteLength ?? 0,
    retainedOutputParticleBuffers: Boolean(reconstruction?.retainedOutputParticleBuffers),
    destroyOutputParticleBuffers: reconstruction?.destroyOutputParticleBuffers ?? null,
    readbackMode: reconstruction?.readbackMode ?? FULL_READBACK_MODE,
    fullReadbackPerformed: reconstruction?.fullReadbackPerformed ?? true,
    normalHotLoopReadbackFree: reconstruction?.normalHotLoopReadbackFree ?? false,
    particleScaleStability: reconstruction?.particleScaleStability ?? null,
    particleScaleStabilitySchema: reconstruction?.particleScaleStabilitySchema ?? null,
    particleScaleStabilityStatus: reconstruction?.particleScaleStabilityStatus ?? null,
    particleScalePolicyAppliedInG2p: reconstruction?.particleScalePolicyAppliedInG2p === true,
    particleScaleMaxVolumeRatioJAllowed: reconstruction?.particleScaleMaxVolumeRatioJAllowed ?? null,
    particleScaleMaxRadiusGrowthRatioAllowed: reconstruction?.particleScaleMaxRadiusGrowthRatioAllowed ?? null,
    cpuReference,
    gpuResult,
    webgpuStatus,
    webgpuParity,
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

function describeDeviceLost(info) {
  return info?.reason || info?.message || 'device lost';
}

function watchDeviceLost(device, onDeviceLost) {
  if (!device?.lost?.then) return;
  device.lost.then((info) => onDeviceLost(info)).catch((error) => onDeviceLost(error));
}

export async function runMlsMpmG2pWithOptionalWebGpu({
  sphParticleState,
  mlsMpmParticleState,
  gridUpdate,
  sphParticleUpload = null,
  mlsMpmParticleUpload = null,
  updatedGridBuffer = null,
  dt = gridUpdate?.dt ?? mlsMpmParticleState?.mechanicsDtS ?? 0,
  boxDimsM = DEFAULT_BOX_DIMS_M,
  internalPressureScale = 1,
  liquidWallDampingAlpha = mlsMpmParticleState?.liquidWallDampingAlpha ?? 0,
  liquidWallDampingDistanceM = mlsMpmParticleState?.liquidWallDampingDistanceM ?? 0,
  particleSeparationRelaxation = mlsMpmParticleState?.particleSeparationRelaxation
    ?? MLS_MPM_PARTICLE_SEPARATION_RELAXATION_DEFAULT,
  preferWebGpu = false,
  navigatorRef = globalThis.navigator,
  device = null,
  deviceResult = null,
  parityTolerance = 5e-2,
  retainOutputParticleBuffers = false,
  onDeviceLost = null,
  webGpuRunner = runMlsMpmG2pWebGpu,
  readbackMode = FULL_READBACK_MODE
} = {}) {
  const noFullReadback = readbackMode === NO_FULL_READBACK_MODE;
  let cpuReference = null;
  const getCpuReference = () => {
    if (!cpuReference) {
      cpuReference = reconstructMlsMpmG2pCpu({
        sphParticleState,
        mlsMpmParticleState,
        gridUpdate,
        dt,
        boxDimsM,
        internalPressureScale,
        liquidWallDampingAlpha,
        liquidWallDampingDistanceM,
        particleSeparationRelaxation
      });
    }
    return cpuReference;
  };
  if (!preferWebGpu) {
    const reference = getCpuReference();
    return executionFromReconstruction(reference, { cpuReference: reference, webgpuStatus: { status: 'not-requested', reason: 'WebGPU MLS-MPM G2P path not requested' } });
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
      return executionFromReconstruction(reference, { cpuReference: reference, webgpuStatus: { status: resolvedDeviceResult.status, reason: resolvedDeviceResult.reason, fallback: 'cpu-reference' } });
    }
    await Promise.resolve();
    if (lostInfo) {
      const reference = getCpuReference();
      return executionFromReconstruction(reference, { cpuReference: reference, webgpuStatus: { status: 'webgpu-device-lost-fallback', reason: describeDeviceLost(lostInfo), fallback: 'cpu-reference' } });
    }
    const gpuResult = await webGpuRunner({
      device: resolvedDeviceResult.device,
      sphParticleState,
      mlsMpmParticleState,
      gridUpdate,
      sphParticleUpload,
      mlsMpmParticleUpload,
      updatedGridBuffer,
      dt,
      boxDimsM,
      internalPressureScale,
      liquidWallDampingAlpha,
      liquidWallDampingDistanceM,
      particleSeparationRelaxation,
      retainOutputParticleBuffers,
      readbackMode: noFullReadback ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE
    });
    await Promise.resolve();
    if (lostInfo) {
      gpuResult.destroyOutputParticleBuffers?.();
      const reference = getCpuReference();
      return executionFromReconstruction(reference, { cpuReference: reference, gpuResult, webgpuStatus: { status: 'webgpu-device-lost-fallback', reason: describeDeviceLost(lostInfo), fallback: 'cpu-reference' } });
    }
    if (noFullReadback) {
      return executionFromReconstruction(gpuResult, {
        cpuReference: null,
        gpuResult,
        webgpuStatus: {
          status: 'webgpu-executed-no-full-readback',
          reason: 'WebGPU MLS-MPM G2P executed without full particle readback'
        },
        webgpuParity: createNoFullReadbackParityReport(parityTolerance)
      });
    }
    const reference = getCpuReference();
    const webgpuParity = createMlsMpmG2pParityReport({ cpuReference: reference, gpuResult, tolerance: parityTolerance });
    if (webgpuParity.status !== 'pass') {
      gpuResult.destroyOutputParticleBuffers?.();
      return executionFromReconstruction(reference, { cpuReference: reference, gpuResult, webgpuStatus: { status: 'webgpu-parity-failed', reason: 'CPU/WebGPU MLS-MPM G2P parity exceeded tolerance', fallback: 'cpu-reference' }, webgpuParity });
    }
    return executionFromReconstruction(gpuResult, { cpuReference: reference, gpuResult, webgpuStatus: { status: 'webgpu-executed', reason: 'CPU/WebGPU MLS-MPM G2P parity passed' }, webgpuParity });
  } catch (error) {
    const reference = getCpuReference();
    return executionFromReconstruction(reference, { cpuReference: reference, webgpuStatus: { status: 'webgpu-error-fallback', reason: error instanceof Error ? error.message : String(error), fallback: 'cpu-reference' } });
  }
}
