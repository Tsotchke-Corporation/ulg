import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT,
  SPH_GPU_PARTICLE_IDENTITY_ROW_LAYOUT,
  SPH_GPU_PARTICLE_STATE_ROW_LAYOUT,
  SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import { GPU_PHASE_IDS, gpuPhaseId, stableOpticalMaterialId } from '../material/opticalGpuBuffers.js';
import {
  buildMaterialPropertyBankGpuWarmInputTable,
  buildMaterialPropertyBankParticleSizePackingTable
} from '../material/materialPropertyBank.js';
import {
  buildAlgorithmMaterialContactRows,
  buildAlgorithmMlsMpmMechanicsRows,
  buildAlgorithmSurfaceExtractionRows
} from '../material/algorithmMaterialRows.js';
import { equilibriumFromSpecificEnergy } from '../material/phaseEquilibrium.js';
import { tagWebGpuBufferDevice, webGpuBufferDevice } from './sphGpuDeviceIdentity.js';

export {
  MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT,
  SPH_GPU_PARTICLE_IDENTITY_ROW_LAYOUT,
  SPH_GPU_PARTICLE_STATE_ROW_LAYOUT,
  SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA
};

export const SPH_GPU_PARTICLE_STATE_FLOATS = SPH_GPU_PARTICLE_STATE_ROW_LAYOUT.length;
export const SPH_GPU_PARTICLE_THERMO_FLOATS = SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT.length;
export const SPH_GPU_PARTICLE_IDENTITY_UINTS = SPH_GPU_PARTICLE_IDENTITY_ROW_LAYOUT.length;
export const MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS = MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length;
// PBD-style relaxation for the excluded-volume pair separation projection in
// G2P post-processing; 0 disables the pass.
export const MLS_MPM_PARTICLE_SEPARATION_RELAXATION_DEFAULT = 0.5;
// Excluded-volume projection preserves represented volume. Pair-normal
// velocity damping is a separate, optional collision response; physical
// viscosity and the constitutive laws own ordinary liquid dissipation.
export const MLS_MPM_PARTICLE_SEPARATION_VELOCITY_DAMPING_DEFAULT = 0;
export const SPH_GPU_PARTICLE_STATUS = Object.freeze({
  ready: 1,
  energyClampedLow: 2,
  energyClampedHigh: 3,
  phaseCompanionReserved: 254,
  missingMaterialProperties: 255
});

const AVOGADRO = 6.02214076e23;
const R_GAS = 8.314462618;
import { phaseSoundSpeedScaleFor } from './sphMechanicsMaterialTable.js';
const DEFAULT_SOUND_SPEED_SCALE = 1;
const DEFAULT_MIN_GAS_SOUND_SPEED_M_PER_S = 40;
const DEFAULT_MLS_MPM_ARTIFICIAL_VISCOSITY_ALPHA = 0.04;
const PHASE_FRACTION_ORDER = ['solid', 'liquid', 'gas', 'plasma'];
const MLS_MPM_EOS_MODEL_IDS = Object.freeze({
  disabled: 0,
  taitCondensed: 1,
  gasLinearized: 2
});

const GPU_BUFFER_USAGE = {
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128
};

// Render rows store the domain as f32 for the existing surface ABI, so keep
// structural ids inside the exact-integer range shared by u32 and f32.  This
// prevents two distinct body ids from silently aliasing after conversion.
export const SPH_GPU_RENDER_DOMAIN_ID_MAX = 0x00ff_ffff;

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizedRenderDomainId(value, { particleIndex = null } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  const domainId = Math.round(number);
  if (domainId > SPH_GPU_RENDER_DOMAIN_ID_MAX) {
    const suffix = particleIndex == null ? '' : ` for particle ${particleIndex}`;
    throw new RangeError(
      `render domain id${suffix} exceeds the exact GPU render range (${SPH_GPU_RENDER_DOMAIN_ID_MAX})`
    );
  }
  return domainId;
}

function legacyRenderDomainForParticle(particle) {
  const role = String(particle?.role ?? particle?.legacyRole ?? '').trim().toLowerCase();
  if (role === 'base') return { renderDomainId: 1, renderDomainKey: 'base' };
  if (role === 'drop') return { renderDomainId: 2, renderDomainKey: 'drop' };
  return { renderDomainId: 0, renderDomainKey: null };
}

export function renderDomainIdentityForSphParticle(particle, particleIndex = null) {
  const explicitValue = particle?.initialBodyDomainId ?? particle?.renderDomainId;
  if (explicitValue != null) {
    const renderDomainId = normalizedRenderDomainId(explicitValue, { particleIndex });
    return {
      renderDomainId,
      renderDomainKey: renderDomainId > 0
        ? (particle?.initialBodyId ?? particle?.renderDomainKey ?? null)
        : null,
      source: particle?.initialBodyDomainId != null
        ? 'initial-body-domain-id'
        : 'particle-render-domain-id'
    };
  }
  const legacy = legacyRenderDomainForParticle(particle);
  return {
    ...legacy,
    source: legacy.renderDomainId > 0 ? 'legacy-particle-role' : 'unassigned'
  };
}

export function sphParticleStateRequiresExplicitIdentity(sphParticleState = null) {
  if (sphParticleState?.identityRequired === true) return true;
  const particleCount = Math.max(0, Math.round(finiteNumber(sphParticleState?.particleCount, 0)));
  const identity = sphParticleState?.identity;
  if (identity instanceof Uint32Array) {
    const count = Math.min(particleCount, identity.length);
    for (let index = 0; index < count; index += 1) {
      if (identity[index] > 2) return true;
    }
  }
  const metadata = Array.isArray(sphParticleState?.metadata) ? sphParticleState.metadata : [];
  if (metadata.some((entry) => (
    entry?.renderDomainId > 0
    && entry?.renderDomainIdentitySource !== 'legacy-particle-role'
    && entry?.renderDomainIdentitySource !== 'unassigned'
  ))) {
    return true;
  }
  const renderDomainKeys = sphParticleState?.renderDomainKeys;
  if (renderDomainKeys && typeof renderDomainKeys === 'object') {
    return Object.entries(renderDomainKeys).some(([domainId, domainKey]) => {
      if (String(domainId) === '1' && String(domainKey) === 'base') return false;
      if (String(domainId) === '2' && String(domainKey) === 'drop') return false;
      return Number(domainId) > 0;
    });
  }
  return false;
}

function particleIdentityRevision(identity, renderDomainKeys = {}) {
  let hash = 0x811c9dc5;
  const updateByte = (value) => {
    hash ^= value & 0xff;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  };
  if (identity instanceof Uint32Array) {
    for (const value of identity) {
      updateByte(value);
      updateByte(value >>> 8);
      updateByte(value >>> 16);
      updateByte(value >>> 24);
    }
  }
  for (const [domainId, domainKey] of Object.entries(renderDomainKeys).sort((a, b) => (
    Number(a[0]) - Number(b[0])
  ))) {
    const text = `${domainId}:${domainKey};`;
    for (let index = 0; index < text.length; index += 1) {
      const code = text.charCodeAt(index);
      updateByte(code);
      updateByte(code >>> 8);
    }
  }
  return `fnv1a32:${identity?.length ?? 0}:${hash.toString(16).padStart(8, '0')}`;
}

function materialPropertiesFor(material, materialProperties) {
  if (!materialProperties || !material) return null;
  return materialProperties[material]
    ?? materialProperties[String(material).toLowerCase()]
    ?? materialProperties[String(material).toUpperCase()]
    ?? null;
}

function restDensityFor(properties, phase, particle) {
  const particleRestDensity = finiteNumber(particle.restDensityKgPerM3, 0);
  if (particleRestDensity > 0) return particleRestDensity;
  const exact = properties?.phases?.find((candidate) => candidate.name === phase);
  const fallback = properties?.phases?.find((candidate) => candidate.densityKgPerM3 > 0);
  return finiteNumber(exact?.densityKgPerM3 ?? fallback?.densityKgPerM3, 0);
}

function representedEntityCount(particle, properties) {
  const massKg = finiteNumber(particle.massKg, 0);
  const molarMassKgPerMol = finiteNumber(properties?.molarMassKgPerMol, 0);
  return massKg > 0 && molarMassKgPerMol > 0
    ? (massKg / molarMassKgPerMol) * AVOGADRO
    : 0;
}

function identityF() {
  return [1, 0, 0, 0, 1, 0, 0, 0, 1];
}

function zeros9() {
  return [0, 0, 0, 0, 0, 0, 0, 0, 0];
}

function finiteMatrix9(value, fallback) {
  const source = value && value.length === 9 ? Array.from(value) : fallback;
  return source.map((entry) => finiteNumber(entry, 0));
}

function solidFlagFor(particle, eq, constitutive = null) {
  if (constitutive) return constitutive.solid ? 1 : 0;
  if (particle.mpmSolid === true) return 1;
  if (particle.mpmSolid === false) return 0;
  return eq?.stablePhase === 'solid' ? 1 : 0;
}

function statusForEquilibrium(eq, properties) {
  if (!properties) return SPH_GPU_PARTICLE_STATUS.missingMaterialProperties;
  if (eq?.clamped === 'low') return SPH_GPU_PARTICLE_STATUS.energyClampedLow;
  if (eq?.clamped === 'high') return SPH_GPU_PARTICLE_STATUS.energyClampedHigh;
  return SPH_GPU_PARTICLE_STATUS.ready;
}

function phaseFractionsFor(eq) {
  return PHASE_FRACTION_ORDER.map((phase) => finiteNumber(eq?.phaseFractions?.[phase], 0));
}

function equilibriumForParticle(particle, properties) {
  if (!properties) {
    return {
      temperatureK: 0,
      stablePhase: 'unknown',
      phaseFractions: {},
      clamped: null
    };
  }
  return equilibriumFromSpecificEnergy(properties, finiteNumber(particle.specificInternalEnergyJPerKg, 0));
}

function phasePropertiesFor(properties, phase) {
  if (!properties?.phases?.length) return null;
  return properties.phases.find((candidate) => candidate.name === phase) || properties.phases[0];
}

function mechanicsScaleOptions(state, {
  soundSpeedScale,
  minGasSoundSpeedMPerS,
  viscosityEnabled,
  mlsMpmArtificialViscosityAlpha,
  viscosityLengthM,
  liquidWallDampingAlpha,
  liquidWallDampingDistanceM
} = {}) {
  const stateParams = state?.gpuMechanics || {};
  const lawGroups = state?.physicalLawGroups || stateParams.physicalLawGroups || {};
  const viscosityActive = Boolean(viscosityEnabled ?? lawGroups.viscosity);
  return {
    soundSpeedScale: finiteNumber(
      soundSpeedScale ?? stateParams.soundSpeedScale,
      DEFAULT_SOUND_SPEED_SCALE
    ),
    cflMaxSoundSpeedMPerS: finiteNumber(stateParams.cflMaxSoundSpeedMPerS, 0),
    minGasSoundSpeedMPerS: finiteNumber(
      minGasSoundSpeedMPerS ?? stateParams.minGasSoundSpeedMPerS,
      DEFAULT_MIN_GAS_SOUND_SPEED_M_PER_S
    ),
    viscosityEnabled: viscosityActive,
    mlsMpmArtificialViscosityAlpha: finiteNumber(
      mlsMpmArtificialViscosityAlpha ?? stateParams.mlsMpmArtificialViscosityAlpha,
      DEFAULT_MLS_MPM_ARTIFICIAL_VISCOSITY_ALPHA
    ),
    viscosityLengthM: finiteNumber(
      viscosityLengthM ?? stateParams.gridSpacingM ?? state?.smoothingLengthM,
      0
    ),
    liquidWallDampingAlpha: viscosityActive
      ? finiteNumber(
        liquidWallDampingAlpha ?? stateParams.mlsMpmLiquidWallDampingAlpha,
        0
      )
      : 0,
    liquidWallDampingDistanceM: finiteNumber(
      liquidWallDampingDistanceM ?? stateParams.mlsMpmLiquidWallDampingDistanceM,
      0
    ),
    particleSeparationRelaxation: finiteNumber(
      stateParams.mlsMpmParticleSeparationRelaxation,
      MLS_MPM_PARTICLE_SEPARATION_RELAXATION_DEFAULT
    ),
    particleSeparationVelocityDamping: Math.min(Math.max(finiteNumber(
      stateParams.mlsMpmParticleSeparationVelocityDamping,
      MLS_MPM_PARTICLE_SEPARATION_VELOCITY_DAMPING_DEFAULT
    ), 0), 1)
  };
}

function gasSoundSpeedMPerS(properties, phaseProperties, temperatureK, soundSpeedScale, minGasSoundSpeedMPerS) {
  const molarMassKgPerMol = finiteNumber(properties?.molarMassKgPerMol, 0);
  const cp = finiteNumber(phaseProperties?.cpJPerKgK, 0);
  if (!(molarMassKgPerMol > 0)) return 0;
  const specificGasConstant = R_GAS / molarMassKgPerMol;
  const gamma = cp > specificGasConstant ? cp / (cp - specificGasConstant) : 1.33;
  const realSoundSpeed = Math.sqrt(Math.max(gamma * specificGasConstant * temperatureK, 0));
  return Math.max(realSoundSpeed * soundSpeedScale, minGasSoundSpeedMPerS);
}

function dynamicViscosityPaSForPhase(phase, phaseProperties, {
  restDensityKgPerM3,
  soundSpeedMPerS,
  viscosityEnabled,
  mlsMpmArtificialViscosityAlpha,
  viscosityLengthM
} = {}) {
  if (!viscosityEnabled) return 0;
  const closureViscosityPaS = Math.max(finiteNumber(phaseProperties?.dynamicViscosityPaS, 0), 0);
  const artificialViscosityPaS = phase === 'liquid'
    ? Math.max(
      finiteNumber(restDensityKgPerM3, 0)
        * finiteNumber(soundSpeedMPerS, 0)
        * finiteNumber(viscosityLengthM, 0)
        * finiteNumber(mlsMpmArtificialViscosityAlpha, DEFAULT_MLS_MPM_ARTIFICIAL_VISCOSITY_ALPHA),
      0
    )
    : 0;
  return closureViscosityPaS + artificialViscosityPaS;
}

function constitutivePropertiesFor(particle, properties, eq, options) {
  if (!properties) {
    return {
      solid: false,
      effectiveBulkModulusPa: 0,
      shearModulusPa: 0,
      lameLambdaPa: 0,
      soundSpeedMPerS: 0,
      eosModelId: MLS_MPM_EOS_MODEL_IDS.disabled,
      constitutiveStatus: SPH_GPU_PARTICLE_STATUS.missingMaterialProperties,
      dynamicViscosityPaS: 0,
      surfaceTensionNPerM: 0
    };
  }
  const phase = eq?.stablePhase || 'liquid';
  const ph = phasePropertiesFor(properties, phase);
  // Per-phase CFL clamp: each phase is as stiff as the carrier dt allows,
  // instead of a global factor set by the stiffest phase in the table.
  const soundSpeedScale = phaseSoundSpeedScaleFor(properties, ph, {
    soundSpeedScale: finiteNumber(options.soundSpeedScale, DEFAULT_SOUND_SPEED_SCALE),
    cflMaxSoundSpeedMPerS: finiteNumber(options.cflMaxSoundSpeedMPerS, 0)
  });
  const modulusScale = soundSpeedScale * soundSpeedScale;
  const restDensity = finiteNumber(ph?.densityKgPerM3 ?? particle.restDensityKgPerM3, 0);
  const bulkRaw = finiteNumber(ph?.bulkModulusPa, 0);
  const shearRaw = phase === 'solid' ? finiteNumber(ph?.shearModulusPa, 0) : 0;
  if (phase === 'gas') {
    return {
      solid: false,
      effectiveBulkModulusPa: 0,
      shearModulusPa: 0,
      lameLambdaPa: 0,
      soundSpeedMPerS: gasSoundSpeedMPerS(
        properties,
        ph,
        finiteNumber(eq?.temperatureK, 0),
        soundSpeedScale,
        finiteNumber(options.minGasSoundSpeedMPerS, DEFAULT_MIN_GAS_SOUND_SPEED_M_PER_S)
      ),
      eosModelId: MLS_MPM_EOS_MODEL_IDS.gasLinearized,
      constitutiveStatus: SPH_GPU_PARTICLE_STATUS.ready,
      dynamicViscosityPaS: dynamicViscosityPaSForPhase(phase, ph, {
        restDensityKgPerM3: restDensity,
        soundSpeedMPerS: gasSoundSpeedMPerS(
          properties,
          ph,
          finiteNumber(eq?.temperatureK, 0),
          soundSpeedScale,
          finiteNumber(options.minGasSoundSpeedMPerS, DEFAULT_MIN_GAS_SOUND_SPEED_M_PER_S)
        ),
        viscosityEnabled: options.viscosityEnabled,
        mlsMpmArtificialViscosityAlpha: options.mlsMpmArtificialViscosityAlpha,
        viscosityLengthM: options.viscosityLengthM
      }),
      surfaceTensionNPerM: 0
    };
  }
  const effectiveBulkModulusPa = bulkRaw * modulusScale;
  const shearModulusPa = shearRaw * modulusScale;
  const soundSpeedMPerS = restDensity > 0 && effectiveBulkModulusPa > 0
    ? Math.sqrt(effectiveBulkModulusPa / restDensity)
    : 0;
  return {
    solid: phase === 'solid' && shearModulusPa > 0,
    effectiveBulkModulusPa,
    shearModulusPa,
    lameLambdaPa: phase === 'solid' ? Math.max((bulkRaw - (2 / 3) * shearRaw) * modulusScale, 0) : 0,
    soundSpeedMPerS,
    eosModelId: effectiveBulkModulusPa > 0
      ? MLS_MPM_EOS_MODEL_IDS.taitCondensed
      : MLS_MPM_EOS_MODEL_IDS.disabled,
    constitutiveStatus: SPH_GPU_PARTICLE_STATUS.ready,
    dynamicViscosityPaS: dynamicViscosityPaSForPhase(phase, ph, {
      restDensityKgPerM3: restDensity,
      soundSpeedMPerS,
      viscosityEnabled: options.viscosityEnabled,
      mlsMpmArtificialViscosityAlpha: options.mlsMpmArtificialViscosityAlpha,
      viscosityLengthM: options.viscosityLengthM
    }),
    surfaceTensionNPerM: options.surfaceTensionEnabled
      ? Math.max(finiteNumber(ph?.surfaceTensionNPerM, 0), 0)
      : 0
  };
}

export function buildSphGpuParticleBuffers(state, {
  materialProperties = {},
  initialParticleSpacing = null
} = {}) {
  if (!state?.particles || !Array.isArray(state.particles)) {
    throw new TypeError('buildSphGpuParticleBuffers requires a SPH state with particles');
  }
  const particleCount = state.particles.length;
  const stateValues = new Float32Array(particleCount * SPH_GPU_PARTICLE_STATE_FLOATS);
  const thermoValues = new Float32Array(particleCount * SPH_GPU_PARTICLE_THERMO_FLOATS);
  const identityValues = new Uint32Array(particleCount * SPH_GPU_PARTICLE_IDENTITY_UINTS);
  const renderDomainKeys = {};
  const metadata = [];
  const smoothingLengthM = finiteNumber(state.smoothingLengthM, 0);

  for (let index = 0; index < particleCount; index += 1) {
    const particle = state.particles[index];
    const material = particle.material || 'unknown';
    const properties = materialPropertiesFor(material, materialProperties);
    const eq = equilibriumForParticle(particle, properties);
    const phase = eq.stablePhase || 'unknown';
    const phaseFractions = phaseFractionsFor(eq);
    const stateOffset = index * SPH_GPU_PARTICLE_STATE_FLOATS;
    const thermoOffset = index * SPH_GPU_PARTICLE_THERMO_FLOATS;
    const identityOffset = index * SPH_GPU_PARTICLE_IDENTITY_UINTS;
    const renderDomain = renderDomainIdentityForSphParticle(particle, index);
    stateValues.set([
      finiteNumber(particle.x?.[0]),
      finiteNumber(particle.x?.[1]),
      finiteNumber(particle.x?.[2]),
      finiteNumber(particle.massKg),
      finiteNumber(particle.v?.[0]),
      finiteNumber(particle.v?.[1]),
      finiteNumber(particle.v?.[2]),
      finiteNumber(particle.specificInternalEnergyJPerKg)
    ], stateOffset);
    const status = particle.phaseCompanionSlot === true
      ? SPH_GPU_PARTICLE_STATUS.phaseCompanionReserved
      : statusForEquilibrium(eq, properties);
    thermoValues.set([
      properties ? stableOpticalMaterialId(material) : 0,
      gpuPhaseId(phase),
      finiteNumber(eq.temperatureK),
      restDensityFor(properties, phase, particle),
      phaseFractions[0],
      phaseFractions[1],
      phaseFractions[2],
      phaseFractions[3],
      smoothingLengthM,
      representedEntityCount(particle, properties),
      status,
      finiteNumber(
        particle.visualRestParticleRadiusM
          ?? particle.visualParticleRadiusM
          ?? particle.restParticleRadiusM
          ?? particle.particleRadiusM,
        0
      )
    ], thermoOffset);
    identityValues[identityOffset] = renderDomain.renderDomainId;
    if (renderDomain.renderDomainId > 0 && renderDomain.renderDomainKey != null) {
      const domainKey = String(renderDomain.renderDomainKey);
      const priorDomainKey = renderDomainKeys[renderDomain.renderDomainId];
      if (priorDomainKey != null && priorDomainKey !== domainKey) {
        throw new RangeError(
          `render domain id ${renderDomain.renderDomainId} maps to both "${priorDomainKey}" and "${domainKey}"`
        );
      }
      renderDomainKeys[renderDomain.renderDomainId] = domainKey;
    }
    metadata.push({
      id: particle.id ?? `p${index}`,
      material,
      materialId: properties ? stableOpticalMaterialId(material) : 0,
      phase,
      phaseId: gpuPhaseId(phase),
      status,
      spareProductSlot: particle.spareProductSlot === true,
      phaseCompanionSlot: particle.phaseCompanionSlot === true,
      phaseCarrierPrimaryIndex: Number.isSafeInteger(particle.phaseCarrierPrimaryIndex)
        ? particle.phaseCarrierPrimaryIndex
        : null,
      phaseCarrierCompanionIndex: Number.isSafeInteger(particle.phaseCarrierCompanionIndex)
        ? particle.phaseCarrierCompanionIndex
        : null,
      phaseCarrierLineageIndex: Number.isSafeInteger(particle.phaseCarrierLineageIndex)
        ? particle.phaseCarrierLineageIndex
        : null,
      phaseCarrierLane: Number.isSafeInteger(particle.phaseCarrierLane)
        ? particle.phaseCarrierLane
        : null,
      phaseCarrierTargetPhaseId: Number.isSafeInteger(particle.phaseCarrierTargetPhaseId)
        ? particle.phaseCarrierTargetPhaseId
        : null,
      initialBodyId: particle.initialBodyId ?? null,
      initialBodyDomainId: normalizedRenderDomainId(particle.initialBodyDomainId, { particleIndex: index }),
      renderDomainId: renderDomain.renderDomainId,
      renderDomainKey: renderDomain.renderDomainKey,
      renderDomainIdentitySource: renderDomain.source
    });
  }

  const materialPropertyBankWarmInputTable = buildMaterialPropertyBankGpuWarmInputTable(
    initialParticleSpacing?.materialPropertyBankWarmInputs
  );
  const materialPropertyBankParticleSizeTable = buildMaterialPropertyBankParticleSizePackingTable(
    initialParticleSpacing
  );

  return {
    schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
    status: 'cpu-derived-gpu-buffer-ready',
    particleCount,
    dimension: state.dimension ?? 3,
    step: state.step ?? 0,
    time: state.time ?? 0,
    positionEpoch: Number.isInteger(Number(state.positionEpoch))
      ? Number(state.positionEpoch)
      : Math.max(0, Math.round(Number(state.step) || 0)),
    topologyEpoch: Number.isInteger(Number(state.topologyEpoch))
      ? Number(state.topologyEpoch)
      : 0,
    chartEpoch: Number.isInteger(Number(state.chartEpoch))
      ? Number(state.chartEpoch)
      : 0,
    levelEpoch: Number.isInteger(Number(state.levelEpoch))
      ? Number(state.levelEpoch)
      : Math.max(0, Math.round(Number(state.step) || 0)),
    supportEpoch: Number.isInteger(Number(state.supportEpoch))
      ? Number(state.supportEpoch)
      : Math.max(0, Math.round(Number(state.step) || 0)),
    smoothingLengthM,
    phaseIds: { ...GPU_PHASE_IDS },
    stateLayout: [...SPH_GPU_PARTICLE_STATE_ROW_LAYOUT],
    thermoLayout: [...SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT],
    identitySchema: ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
    identityLayout: [...SPH_GPU_PARTICLE_IDENTITY_ROW_LAYOUT],
    stateStrideFloats: SPH_GPU_PARTICLE_STATE_FLOATS,
    thermoStrideFloats: SPH_GPU_PARTICLE_THERMO_FLOATS,
    identityStrideUints: SPH_GPU_PARTICLE_IDENTITY_UINTS,
    stateStrideBytes: SPH_GPU_PARTICLE_STATE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    thermoStrideBytes: SPH_GPU_PARTICLE_THERMO_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    identityStrideBytes: SPH_GPU_PARTICLE_IDENTITY_UINTS * Uint32Array.BYTES_PER_ELEMENT,
    identityBufferByteLength: Math.max(
      Uint32Array.BYTES_PER_ELEMENT,
      particleCount * SPH_GPU_PARTICLE_IDENTITY_UINTS * Uint32Array.BYTES_PER_ELEMENT
    ),
    state: stateValues,
    thermo: thermoValues,
    identity: identityValues,
    identityRequired: metadata.some((entry) => (
      entry.renderDomainId > 0
      && entry.renderDomainIdentitySource !== 'legacy-particle-role'
      && entry.renderDomainIdentitySource !== 'unassigned'
    )),
    renderDomainKeys,
    identityRevision: particleIdentityRevision(identityValues, renderDomainKeys),
    cpuIdentityStale: false,
    metadata,
    phaseCarrierPlan: state.phaseCarrierPlan ? { ...state.phaseCarrierPlan } : null,
    materialPropertyBankWarmInputTable,
    materialPropertyBankParticleSizeTable,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function writeStorageBuffer(device, label, data, { copySource = false } = {}) {
  const byteLength = Math.max(4, data.byteLength);
  const buffer = device.createBuffer({
    label,
    size: byteLength,
    usage: GPU_BUFFER_USAGE.STORAGE
      | GPU_BUFFER_USAGE.COPY_DST
      | (copySource ? GPU_BUFFER_USAGE.COPY_SRC : 0)
  });
  if (data.byteLength > 0) device.queue.writeBuffer(buffer, 0, data);
  return tagWebGpuBufferDevice(buffer, device);
}

function optionalStorageBuffer(device, label, data) {
  return data?.byteLength > 0 ? writeStorageBuffer(device, label, data) : null;
}

export function uploadSphGpuParticleBuffers(device, packed) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('uploadSphGpuParticleBuffers requires a WebGPU-like device with queue.writeBuffer');
  }
  if (packed?.schema !== ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError('uploadSphGpuParticleBuffers requires a packed SPH GPU particle buffer');
  }
  if (packed.cpuIdentityStale === true && sphParticleStateRequiresExplicitIdentity(packed)) {
    throw new TypeError(
      'uploadSphGpuParticleBuffers refuses a stale CPU identity mirror for arbitrary render domains'
    );
  }
  const materialPropertyBankWarmInputBuffer = optionalStorageBuffer(
    device,
    'ulg-sph-material-bank-warm-input-rows',
    packed.materialPropertyBankWarmInputTable?.rows
  );
  const materialPropertyBankParticleSizeBuffer = optionalStorageBuffer(
    device,
    'ulg-sph-material-bank-particle-size-rows',
    packed.materialPropertyBankParticleSizeTable?.rows
  );
  return {
    schema: ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
    status: 'webgpu-uploaded',
    sourceSchema: packed.schema,
    particleCount: packed.particleCount,
    storageGeneration: Number.isInteger(Number(packed.storageGeneration))
      && Number(packed.storageGeneration) > 0
      ? Number(packed.storageGeneration)
      : null,
    positionEpoch: packed.positionEpoch ?? null,
    topologyEpoch: packed.topologyEpoch ?? null,
    chartEpoch: packed.chartEpoch ?? null,
    levelEpoch: packed.levelEpoch ?? null,
    supportEpoch: packed.supportEpoch ?? null,
    stateStrideBytes: packed.stateStrideBytes,
    thermoStrideBytes: packed.thermoStrideBytes,
    stateBufferByteLength: Math.max(4, packed.state.byteLength),
    thermoBufferByteLength: Math.max(4, packed.thermo.byteLength),
    identitySchema: packed.identitySchema ?? ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
    identityStrideBytes: packed.identityStrideBytes
      ?? (SPH_GPU_PARTICLE_IDENTITY_UINTS * Uint32Array.BYTES_PER_ELEMENT),
    identityRequired: sphParticleStateRequiresExplicitIdentity(packed),
    identityRevision: packed.identityRevision ?? null,
    identityBufferByteLength: Math.max(
      Uint32Array.BYTES_PER_ELEMENT,
      packed.particleCount * SPH_GPU_PARTICLE_IDENTITY_UINTS * Uint32Array.BYTES_PER_ELEMENT
    ),
    stateBuffer: writeStorageBuffer(device, 'ulg-sph-particle-state', packed.state, { copySource: true }),
    thermoBuffer: writeStorageBuffer(device, 'ulg-sph-particle-thermo', packed.thermo, { copySource: true }),
    identityBuffer: writeStorageBuffer(
      device,
      'ulg-sph-particle-identity',
      packed.identity instanceof Uint32Array
        ? packed.identity
        : new Uint32Array(packed.particleCount * SPH_GPU_PARTICLE_IDENTITY_UINTS),
      { copySource: true }
    ),
    renderDomainKeys: { ...(packed.renderDomainKeys || {}) },
    phaseCarrierPlan: packed.phaseCarrierPlan ? { ...packed.phaseCarrierPlan } : null,
    materialPropertyBankWarmInputBuffer,
    materialPropertyBankParticleSizeBuffer,
    materialPropertyBankWarmInputRowCount: packed.materialPropertyBankWarmInputTable?.rowCount ?? 0,
    materialPropertyBankParticleSizeRowCount: packed.materialPropertyBankParticleSizeTable?.rowCount ?? 0,
    ownsStateBuffer: true,
    ownsThermoBuffer: true,
    ownsIdentityBuffer: true,
    ownsMaterialPropertyBankWarmInputBuffer: Boolean(materialPropertyBankWarmInputBuffer),
    ownsMaterialPropertyBankParticleSizeBuffer: Boolean(materialPropertyBankParticleSizeBuffer),
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

export function sphGpuParticleUploadMatchesDevice(upload, device) {
  if (upload?.status !== 'webgpu-uploaded' || upload.destroyed || !device) return false;
  if (
    !upload.stateBuffer
    || !upload.thermoBuffer
    || webGpuBufferDevice(upload.stateBuffer) !== device
    || webGpuBufferDevice(upload.thermoBuffer) !== device
  ) return false;
  const optionalBuffers = [
    upload.identityBuffer,
    upload.materialPropertyBankWarmInputBuffer,
    upload.materialPropertyBankParticleSizeBuffer
  ].filter(Boolean);
  return optionalBuffers.every((buffer) => webGpuBufferDevice(buffer) === device);
}

export function buildMlsMpmGpuParticleBuffers(state, options = {}) {
  const { materialProperties = {}, initialParticleSpacing = null } = options;
  if (!state?.particles || !Array.isArray(state.particles)) {
    throw new TypeError('buildMlsMpmGpuParticleBuffers requires a SPH state with particles');
  }
  const scaleOptions = mechanicsScaleOptions(state, options);
  const particleCount = state.particles.length;
  const mechanics = new Float32Array(particleCount * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS);
  const metadata = [];
  for (let index = 0; index < particleCount; index += 1) {
    const particle = state.particles[index];
    const material = particle.material || 'unknown';
    const properties = materialPropertiesFor(material, materialProperties);
    const eq = equilibriumForParticle(particle, properties);
    const constitutive = constitutivePropertiesFor(particle, properties, eq, scaleOptions);
    const F = finiteMatrix9(particle.mpmF, identityF());
    const C = finiteMatrix9(particle.mpmC, zeros9());
    const restDensity = restDensityFor(properties, eq.stablePhase, particle);
    const volume0 = finiteNumber(particle.mpmVolume0, restDensity > 0 ? finiteNumber(particle.massKg) / restDensity : 0);
    const J = finiteNumber(particle.mpmJ, 1);
    const status = particle.phaseCompanionSlot === true
      ? SPH_GPU_PARTICLE_STATUS.phaseCompanionReserved
      : statusForEquilibrium(eq, properties);
    const phaseVolumeReferenceMassKg = finiteNumber(
      particle.phaseVolumeReferenceMassKg,
      finiteNumber(particle.massKg, 0)
    );
    const offset = index * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS;
    mechanics.set([
      F[0], F[1], F[2], F[3],
      F[4], F[5], F[6], F[7],
      F[8], C[0], C[1], C[2],
      C[3], C[4], C[5], C[6],
      C[7], C[8], J, volume0,
      solidFlagFor(particle, eq, constitutive),
      status,
      constitutive.effectiveBulkModulusPa,
      constitutive.shearModulusPa,
      constitutive.lameLambdaPa,
      constitutive.soundSpeedMPerS,
      constitutive.eosModelId,
      particle.phaseCompanionSlot === true ? status : constitutive.constitutiveStatus,
      Math.max(finiteNumber(particle.hydrostaticPressurePa, 0), 0),
      constitutive.dynamicViscosityPaS,
      constitutive.surfaceTensionNPerM,
      phaseVolumeReferenceMassKg
    ], offset);
    metadata.push({
      id: particle.id ?? `p${index}`,
      material,
      phase: eq.stablePhase,
      solid: constitutive.solid,
      status,
      spareProductSlot: particle.spareProductSlot === true,
      phaseCompanionSlot: particle.phaseCompanionSlot === true,
      effectiveBulkModulusPa: constitutive.effectiveBulkModulusPa,
      shearModulusPa: constitutive.shearModulusPa,
      lameLambdaPa: constitutive.lameLambdaPa,
      soundSpeedMPerS: constitutive.soundSpeedMPerS,
      eosModelId: constitutive.eosModelId,
      resolvedAbsolutePressurePa:
        Math.max(finiteNumber(particle.hydrostaticPressurePa, 0), 0),
      hydrostaticPressurePa:
        Math.max(finiteNumber(particle.hydrostaticPressurePa, 0), 0),
      dynamicViscosityPaS: constitutive.dynamicViscosityPaS,
      surfaceTensionNPerM: constitutive.surfaceTensionNPerM,
      phaseVolumeReferenceMassKg
    });
  }
  const materialPropertyBankWarmInputTable = buildMaterialPropertyBankGpuWarmInputTable(
    initialParticleSpacing?.materialPropertyBankWarmInputs
  );
  const materialPropertyBankParticleSizeTable = buildMaterialPropertyBankParticleSizePackingTable(
    initialParticleSpacing
  );
  const algorithmMaterialMlsMpmMechanicsRows = buildAlgorithmMlsMpmMechanicsRows({
    particles: state.particles,
    metadata,
    mechanics,
    mechanicsStrideFloats: MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
    particleInitializationRows: initialParticleSpacing?.algorithmMaterialParticleInitializationRows ?? null
  });
  const algorithmMaterialContactRows = buildAlgorithmMaterialContactRows({
    mlsMpmMechanicsRows: algorithmMaterialMlsMpmMechanicsRows
  });
  const algorithmMaterialSurfaceExtractionRows = buildAlgorithmSurfaceExtractionRows({
    particleInitializationRows: initialParticleSpacing?.algorithmMaterialParticleInitializationRows ?? null,
    mlsMpmMechanicsRows: algorithmMaterialMlsMpmMechanicsRows,
    contactRows: algorithmMaterialContactRows
  });
  return {
    schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
    status: 'cpu-derived-gpu-buffer-ready',
    particleCount,
    step: state.step ?? 0,
    time: state.time ?? 0,
    mechanicsLayout: [...MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT],
    mechanicsStrideFloats: MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
    mechanicsStrideBytes: MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    soundSpeedScale: scaleOptions.soundSpeedScale,
    cflMaxSoundSpeedMPerS: scaleOptions.cflMaxSoundSpeedMPerS,
    minGasSoundSpeedMPerS: scaleOptions.minGasSoundSpeedMPerS,
    viscosityEnabled: scaleOptions.viscosityEnabled,
    mlsMpmArtificialViscosityAlpha: scaleOptions.mlsMpmArtificialViscosityAlpha,
    viscosityLengthM: scaleOptions.viscosityLengthM,
    liquidWallDampingAlpha: scaleOptions.liquidWallDampingAlpha,
    liquidWallDampingDistanceM: scaleOptions.liquidWallDampingDistanceM,
    particleSeparationRelaxation: scaleOptions.particleSeparationRelaxation,
    particleSeparationVelocityDamping: scaleOptions.particleSeparationVelocityDamping,
    mechanicsDtS: finiteNumber(state.gpuMechanics?.dt, 0),
    mechanicalSubsteps: Math.max(1, Math.round(finiteNumber(state.gpuMechanics?.mechanicalSubsteps, 1))),
    gridCflFactor: finiteNumber(state.gpuMechanics?.gridCflFactor, 0),
    gravityMPerS2: Array.isArray(state.gpuMechanics?.gravityMPerS2)
      ? state.gpuMechanics.gravityMPerS2.map((value) => finiteNumber(value, 0))
      : [0, -9.80665, 0],
    mechanics,
    metadata,
    phaseCarrierPlan: state.phaseCarrierPlan ? { ...state.phaseCarrierPlan } : null,
    materialPropertyBankWarmInputTable,
    materialPropertyBankParticleSizeTable,
    algorithmMaterialMlsMpmMechanicsRows,
    algorithmMaterialContactRows,
    algorithmMaterialSurfaceExtractionRows,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

export function uploadMlsMpmGpuParticleBuffers(device, packed) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('uploadMlsMpmGpuParticleBuffers requires a WebGPU-like device with queue.writeBuffer');
  }
  if (packed?.schema !== ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError('uploadMlsMpmGpuParticleBuffers requires a packed MLS-MPM GPU particle buffer');
  }
  const materialPropertyBankWarmInputBuffer = optionalStorageBuffer(
    device,
    'ulg-mls-mpm-material-bank-warm-input-rows',
    packed.materialPropertyBankWarmInputTable?.rows
  );
  const materialPropertyBankParticleSizeBuffer = optionalStorageBuffer(
    device,
    'ulg-mls-mpm-material-bank-particle-size-rows',
    packed.materialPropertyBankParticleSizeTable?.rows
  );
  return {
    schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
    status: 'webgpu-uploaded',
    sourceSchema: packed.schema,
    particleCount: packed.particleCount,
    storageGeneration: Number.isInteger(Number(packed.storageGeneration))
      && Number(packed.storageGeneration) > 0
      ? Number(packed.storageGeneration)
      : null,
    mechanicsStrideBytes: packed.mechanicsStrideBytes,
    mechanicsBufferByteLength: Math.max(4, packed.mechanics.byteLength),
    mechanicsBuffer: writeStorageBuffer(
      device,
      'ulg-mls-mpm-particle-mechanics',
      packed.mechanics,
      { copySource: true }
    ),
    phaseCarrierPlan: packed.phaseCarrierPlan ? { ...packed.phaseCarrierPlan } : null,
    materialPropertyBankWarmInputBuffer,
    materialPropertyBankParticleSizeBuffer,
    materialPropertyBankWarmInputRowCount: packed.materialPropertyBankWarmInputTable?.rowCount ?? 0,
    materialPropertyBankParticleSizeRowCount: packed.materialPropertyBankParticleSizeTable?.rowCount ?? 0,
    ownsMechanicsBuffer: true,
    ownsMaterialPropertyBankWarmInputBuffer: Boolean(materialPropertyBankWarmInputBuffer),
    ownsMaterialPropertyBankParticleSizeBuffer: Boolean(materialPropertyBankParticleSizeBuffer),
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

export function mlsMpmGpuParticleUploadMatchesDevice(upload, device) {
  if (upload?.status !== 'webgpu-uploaded' || upload.destroyed || !device) return false;
  if (
    !upload.mechanicsBuffer
    || webGpuBufferDevice(upload.mechanicsBuffer) !== device
  ) return false;
  const optionalBuffers = [
    upload.materialPropertyBankWarmInputBuffer,
    upload.materialPropertyBankParticleSizeBuffer
  ].filter(Boolean);
  return optionalBuffers.every((buffer) => webGpuBufferDevice(buffer) === device);
}

export function destroyMlsMpmGpuParticleBuffers(buffers) {
  if (!buffers || buffers.destroyed) return;
  if (buffers.ownsMechanicsBuffer !== false) buffers.mechanicsBuffer?.destroy?.();
  if (buffers.ownsMaterialPropertyBankWarmInputBuffer !== false) {
    buffers.materialPropertyBankWarmInputBuffer?.destroy?.();
  }
  if (buffers.ownsMaterialPropertyBankParticleSizeBuffer !== false) {
    buffers.materialPropertyBankParticleSizeBuffer?.destroy?.();
  }
  buffers.destroyed = true;
}

export function destroySphGpuParticleBuffers(buffers) {
  if (!buffers || buffers.destroyed) return;
  if (buffers.ownsStateBuffer !== false) buffers.stateBuffer?.destroy?.();
  if (buffers.ownsThermoBuffer !== false) buffers.thermoBuffer?.destroy?.();
  if (buffers.ownsIdentityBuffer !== false) buffers.identityBuffer?.destroy?.();
  if (buffers.ownsMaterialPropertyBankWarmInputBuffer !== false) {
    buffers.materialPropertyBankWarmInputBuffer?.destroy?.();
  }
  if (buffers.ownsMaterialPropertyBankParticleSizeBuffer !== false) {
    buffers.materialPropertyBankParticleSizeBuffer?.destroy?.();
  }
  buffers.destroyed = true;
}

export function decodeSphGpuParticleRows(packed) {
  if (packed?.schema !== ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError('decodeSphGpuParticleRows requires a packed SPH GPU particle buffer');
  }
  const rows = [];
  for (let index = 0; index < packed.particleCount; index += 1) {
    const stateOffset = index * SPH_GPU_PARTICLE_STATE_FLOATS;
    const thermoOffset = index * SPH_GPU_PARTICLE_THERMO_FLOATS;
    const identityOffset = index * SPH_GPU_PARTICLE_IDENTITY_UINTS;
    rows.push({
      index,
      metadata: packed.metadata[index],
      positionM: [
        packed.state[stateOffset],
        packed.state[stateOffset + 1],
        packed.state[stateOffset + 2]
      ],
      massKg: packed.state[stateOffset + 3],
      velocityMPerS: [
        packed.state[stateOffset + 4],
        packed.state[stateOffset + 5],
        packed.state[stateOffset + 6]
      ],
      specificInternalEnergyJPerKg: packed.state[stateOffset + 7],
      materialId: packed.thermo[thermoOffset],
      phaseId: packed.thermo[thermoOffset + 1],
      temperatureK: packed.thermo[thermoOffset + 2],
      restDensityKgPerM3: packed.thermo[thermoOffset + 3],
      phaseFractions: {
        solid: packed.thermo[thermoOffset + 4],
        liquid: packed.thermo[thermoOffset + 5],
        gas: packed.thermo[thermoOffset + 6],
        plasma: packed.thermo[thermoOffset + 7]
      },
      smoothingLengthM: packed.thermo[thermoOffset + 8],
      representedEntityCount: packed.thermo[thermoOffset + 9],
      status: packed.thermo[thermoOffset + 10],
      visualParticleRadiusM: packed.thermo[thermoOffset + 11],
      renderDomainId: packed.identity instanceof Uint32Array
        ? packed.identity[identityOffset]
        : 0,
      renderDomainKey: packed.metadata?.[index]?.renderDomainKey ?? null
    });
  }
  return rows;
}

export function decodeMlsMpmGpuParticleRows(packed) {
  if (packed?.schema !== ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError('decodeMlsMpmGpuParticleRows requires a packed MLS-MPM GPU particle buffer');
  }
  const rows = [];
  for (let index = 0; index < packed.particleCount; index += 1) {
    const offset = index * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS;
    rows.push({
      index,
      metadata: packed.metadata[index],
      deformationF: [
        packed.mechanics[offset],
        packed.mechanics[offset + 1],
        packed.mechanics[offset + 2],
        packed.mechanics[offset + 3],
        packed.mechanics[offset + 4],
        packed.mechanics[offset + 5],
        packed.mechanics[offset + 6],
        packed.mechanics[offset + 7],
        packed.mechanics[offset + 8]
      ],
      affineC: [
        packed.mechanics[offset + 9],
        packed.mechanics[offset + 10],
        packed.mechanics[offset + 11],
        packed.mechanics[offset + 12],
        packed.mechanics[offset + 13],
        packed.mechanics[offset + 14],
        packed.mechanics[offset + 15],
        packed.mechanics[offset + 16],
        packed.mechanics[offset + 17]
      ],
      volumeRatioJ: packed.mechanics[offset + 18],
      restVolumeM3: packed.mechanics[offset + 19],
      solidFlag: packed.mechanics[offset + 20],
      status: packed.mechanics[offset + 21],
      effectiveBulkModulusPa: packed.mechanics[offset + 22],
      shearModulusPa: packed.mechanics[offset + 23],
      lameLambdaPa: packed.mechanics[offset + 24],
      soundSpeedMPerS: packed.mechanics[offset + 25],
      eosModelId: packed.mechanics[offset + 26],
      constitutiveStatus: packed.mechanics[offset + 27],
      resolvedAbsolutePressurePa: packed.mechanics[offset + 28],
      // Deprecated alias: this lane carries resolved absolute pressure
      // after G2P, not hydrostatic pressure. Kept so existing readers do
      // not break while callers migrate.
      hydrostaticPressurePa: packed.mechanics[offset + 28],
      dynamicViscosityPaS: packed.mechanics[offset + 29],
      surfaceTensionNPerM: packed.mechanics[offset + 30],
      phaseVolumeReferenceMassKg: packed.mechanics[offset + 31]
    });
  }
  return rows;
}
