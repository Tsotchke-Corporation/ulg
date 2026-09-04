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
import {
  advanceSphDispersedMediumGpuBufferParticleTopologyEpoch,
  buildSphDispersedMediumGpuBuffers,
  consumeSphDispersedMediumOpticsProducerClaimAsGpuBuffer,
  destroySphDispersedMediumGpuBuffers,
  registerSphDispersedMediumGpuBufferParticleSourceFamilyContinuation,
  sphDispersedMediumGpuBufferNewOwnerEligible,
  sphDispersedMediumGpuBufferParticleLineageMatches,
  sphDispersedMediumGpuBufferParticleSourceFamilyMatches,
  sphDispersedMediumGpuBufferParticleTopologyEpochTransitionMatches,
  uploadSphDispersedMediumGpuBuffers,
  validateSphDispersedMediumGpuBufferAuthority
} from './sphDispersedMediumGpuBuffers.js';

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
  reactionProductReserved: 253,
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
const identityValueMaxByBuffer = new WeakMap();
const sphParticleBufferSetLifecycleRecords = new WeakMap();
const sphDispersedMediumSourceFamilyRegistrars = new WeakMap();
const sphDispersedMediumOwnershipStates = new WeakMap();
const sphDispersedMediumSourceFamilyContinuationsInProgress = new WeakSet();
const sphDispersedMediumParentTopologyEpochTransitionRecords = new WeakMap();
const SPH_GPU_PARTICLE_DISPERSED_MEDIUM_OPTICS_ALIAS_FIELDS = Object.freeze([
  'dispersedMediumOptics',
  'dispersedMediumOpticsAuthority',
  'dispersedMediumOpticsBuffer',
  'dispersedMediumOpticsRowCount',
  'dispersedMediumOpticsRowStrideFloats',
  'dispersedMediumOpticsBufferByteLength',
  'ownsDispersedMediumOpticsBuffer'
]);

export const ULG_SPH_GPU_PARTICLE_DISPERSED_MEDIUM_OPTICS_TOPOLOGY_EPOCH_TRANSITION_SCHEMA =
  'peercompute.ulg.sph-particle-dispersed-medium-optics-topology-epoch-transition.v0';

function nextSphDispersedMediumOwnershipGeneration() {
  return Object.freeze({});
}

function initializeSphDispersedMediumOwnershipState(
  parentUpload,
  privateSidecar
) {
  if (!privateSidecar || privateSidecar.ownsBuffer !== true) return true;
  const existing = sphDispersedMediumOwnershipStates.get(
    privateSidecar.upload
  );
  if (existing) {
    return existing.owner === parentUpload;
  }
  sphDispersedMediumOwnershipStates.set(privateSidecar.upload, {
    owner: parentUpload,
    generation: nextSphDispersedMediumOwnershipGeneration()
  });
  return true;
}

function retireSphDispersedMediumOwnershipState(
  parentUpload,
  privateSidecar
) {
  const state = privateSidecar
    && sphDispersedMediumOwnershipStates.get(privateSidecar.upload);
  if (!state || state.owner !== parentUpload) return false;
  state.owner = null;
  state.generation = nextSphDispersedMediumOwnershipGeneration();
  return true;
}

export function sphGpuParticleUploadAdvertisesDispersedMediumOptics(upload) {
  const scalarAdvertised = (value) => (
    value != null && !(typeof value === 'number' && value === 0)
  );
  return Boolean(
    upload?.dispersedMediumOptics != null
    || upload?.dispersedMediumOpticsAuthority != null
    || upload?.dispersedMediumOpticsBuffer != null
    || scalarAdvertised(upload?.dispersedMediumOpticsRowCount)
    || scalarAdvertised(upload?.dispersedMediumOpticsRowStrideFloats)
    || scalarAdvertised(upload?.dispersedMediumOpticsBufferByteLength)
    || upload?.ownsDispersedMediumOpticsBuffer === true
  );
}

/**
 * Clone only the public core particle-upload family. Dispersed-medium optics
 * children are privately registered to one exact parent upload object, so a
 * structural spread must not make the child appear to belong to a different
 * state/thermo family. A caller that creates a new parent must explicitly
 * continue or replace the child through the authenticated lifecycle APIs.
 */
export function cloneSphGpuParticleUploadWithoutDispersedMediumOptics(upload) {
  if (!upload || typeof upload !== 'object') {
    throw new TypeError(
      'Core SPH particle upload cloning requires one source upload object'
    );
  }
  const coreUpload = { ...upload };
  for (const field of SPH_GPU_PARTICLE_DISPERSED_MEDIUM_OPTICS_ALIAS_FIELDS) {
    delete coreUpload[field];
  }
  return coreUpload;
}

// Render rows store the domain as f32 for the existing surface ABI, so keep
// structural ids inside the exact-integer range shared by u32 and f32.  This
// prevents two distinct body ids from silently aliasing after conversion.
export const SPH_GPU_RENDER_DOMAIN_ID_MAX = 0x00ff_ffff;

export function sphGpuIdentityValueMaxForBuffer(buffer) {
  const value = buffer && identityValueMaxByBuffer.get(buffer);
  return Number.isInteger(value) && value >= 0 && value <= 0xffff_ffff
    ? value
    : null;
}

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

function statusForParticle(particle, eq, properties) {
  if (particle?.phaseCompanionSlot === true) {
    return SPH_GPU_PARTICLE_STATUS.phaseCompanionReserved;
  }
  // A product slot is a real, stable particle-storage address but carries no
  // physical inventory until reaction placement commits into it.  Give that
  // dormant state its own GPU-visible status: the placement free-list must be
  // able to distinguish it from phase-companion capacity, while gas-ledger
  // classification must not mistake the template material/phase for live gas.
  if (
    particle?.spareProductSlot === true
    && !(finiteNumber(particle?.massKg, 0) > 0)
  ) {
    return SPH_GPU_PARTICLE_STATUS.reactionProductReserved;
  }
  return statusForEquilibrium(eq, properties);
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
  // PHYSICAL shear viscosity only.
  //
  // This lane lands in mechanics row 29 and is read by the P2G shader as the
  // coefficient of a traceless deviatoric stress, so whatever goes here acts
  // purely against shear and never against compression. Folding the artificial
  // alpha*rho*c*h term in here therefore gave water about 2000 Pa.s of shear
  // viscosity against a physical 0.001 -- roughly two million times too much,
  // thicker than molasses -- so liquids crept instead of flowing and settled
  // into a mound rather than a flat free surface.
  //
  // Artificial viscosity is a shock/acoustic stabilizer and belongs in the
  // compressive part of the stress. It is applied in the P2G shader as a bulk
  // pressure gated on div(v) < 0, driven by
  // params.artificial_bulk_viscosity_alpha.
  return Math.max(finiteNumber(phaseProperties?.dynamicViscosityPaS, 0), 0);
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
    const status = statusForParticle(particle, eq, properties);
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
  const dispersedMediumOptics = buildSphDispersedMediumGpuBuffers(state.particles);

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
    dispersedMediumOptics,
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

function exactSphParticleUploadLineage(upload) {
  const particleCount = upload?.particleCount;
  const topologyEpoch = upload?.topologyEpoch;
  const identityRevision = typeof upload?.identityRevision === 'string'
    ? upload.identityRevision
    : '';
  const identityBuffer = upload?.identityBuffer ?? null;
  if (
    !Number.isSafeInteger(particleCount)
    || particleCount <= 0
    || !Number.isSafeInteger(topologyEpoch)
    || topologyEpoch < 0
    || topologyEpoch > 0xffff_ffff
    || identityRevision.length === 0
    || (
      (typeof identityBuffer !== 'object' && typeof identityBuffer !== 'function')
      || identityBuffer === null
    )
  ) return null;
  return { particleCount, topologyEpoch, identityRevision, identityBuffer };
}

function captureExactSphParticleUploadCoreFamily(upload, device = null) {
  const lineage = exactSphParticleUploadLineage(upload);
  const stateBuffer = upload?.stateBuffer ?? null;
  const thermoBuffer = upload?.thermoBuffer ?? null;
  const resolvedDevice = device ?? webGpuBufferDevice(stateBuffer);
  if (
    upload?.status !== 'webgpu-uploaded'
    || upload.destroyed === true
    || !lineage
    || !stateBuffer
    || !thermoBuffer
    || !resolvedDevice
    || webGpuBufferDevice(stateBuffer) !== resolvedDevice
    || webGpuBufferDevice(thermoBuffer) !== resolvedDevice
    || webGpuBufferDevice(lineage.identityBuffer) !== resolvedDevice
  ) return null;
  return {
    device: resolvedDevice,
    stateBuffer,
    thermoBuffer,
    identityBuffer: lineage.identityBuffer,
    particleCount: lineage.particleCount,
    topologyEpoch: lineage.topologyEpoch,
    identityRevision: lineage.identityRevision
  };
}

function uploadSphDispersedMediumOpticsWithPrivateSourceFamilyRegistrar(
  device,
  packed,
  {
    label,
    particleLineage,
    stateBuffer,
    thermoBuffer
  }
) {
  const registrar = Object.freeze(Object.create(null));
  const upload = uploadSphDispersedMediumGpuBuffers(
    device,
    packed,
    {
      ...(label == null ? {} : { label }),
      particleLineage,
      particleSourceFamily: {
        ...particleLineage,
        stateBuffer,
        thermoBuffer
      },
      particleSourceFamilyRegistrar: registrar
    }
  );
  sphDispersedMediumSourceFamilyRegistrars.set(upload, registrar);
  return upload;
}

function captureCandidateSphParticleUploadDispersedMediumOptics(
  upload,
  device = null,
  { requireNewOwnerEligible = false } = {}
) {
  if (!sphGpuParticleUploadAdvertisesDispersedMediumOptics(upload)) return null;
  const sidecar = upload?.dispersedMediumOptics ?? null;
  const lineage = exactSphParticleUploadLineage(upload);
  const stateBuffer = upload?.stateBuffer ?? null;
  const thermoBuffer = upload?.thermoBuffer ?? null;
  const resolvedDevice = device ?? webGpuBufferDevice(sidecar?.buffer);
  if (
    !sidecar
    || !lineage
    || !stateBuffer
    || !thermoBuffer
    || !resolvedDevice
    || typeof upload.ownsDispersedMediumOpticsBuffer !== 'boolean'
    || upload.dispersedMediumOpticsAuthority !== sidecar.authority
    || upload.dispersedMediumOpticsBuffer !== sidecar.buffer
    || upload.dispersedMediumOpticsRowCount !== sidecar.rowCount
    || upload.dispersedMediumOpticsRowStrideFloats !== sidecar.rowStrideFloats
    || upload.dispersedMediumOpticsBufferByteLength !== sidecar.bufferByteLength
    || (
      requireNewOwnerEligible
      && !sphDispersedMediumGpuBufferNewOwnerEligible(sidecar)
    )
    || !sphDispersedMediumGpuBufferParticleLineageMatches(sidecar, lineage)
    || !validateSphDispersedMediumGpuBufferAuthority(
      resolvedDevice,
      sidecar.authority,
      {
        upload: sidecar,
        buffer: sidecar.buffer,
        particleCount: lineage.particleCount,
        rowCount: sidecar.rowCount,
        rowStrideFloats: sidecar.rowStrideFloats,
        bufferByteLength: sidecar.bufferByteLength,
        particleLineage: lineage,
        requireParticleLineage: true
      }
    )
  ) return false;
  return {
    upload: sidecar,
    authority: sidecar.authority,
    buffer: sidecar.buffer,
    rowCount: sidecar.rowCount,
    rowStrideFloats: sidecar.rowStrideFloats,
    bufferByteLength: sidecar.bufferByteLength,
    stateBuffer,
    thermoBuffer,
    identityBuffer: lineage.identityBuffer,
    particleCount: lineage.particleCount,
    topologyEpoch: lineage.topologyEpoch,
    identityRevision: lineage.identityRevision,
    ownsBuffer: upload.ownsDispersedMediumOpticsBuffer
  };
}

function captureExactSphParticleUploadDispersedMediumOptics(
  upload,
  device = null,
  options = {}
) {
  const candidate = captureCandidateSphParticleUploadDispersedMediumOptics(
    upload,
    device,
    options
  );
  if (!candidate) return candidate;
  return sphDispersedMediumGpuBufferParticleSourceFamilyMatches(
    candidate.upload,
    candidate
  )
    ? candidate
    : false;
}

function exactParentDispersedMediumRecordMatches(upload, record, device = null) {
  const coreFamily = captureExactSphParticleUploadCoreFamily(
    upload,
    device ?? record?.device ?? null
  );
  if (
    !coreFamily
    || coreFamily.device !== record?.device
    || coreFamily.stateBuffer !== record.stateBuffer
    || coreFamily.thermoBuffer !== record.thermoBuffer
    || coreFamily.identityBuffer !== record.identityBuffer
    || coreFamily.particleCount !== record.particleCount
    || coreFamily.topologyEpoch !== record.topologyEpoch
    || coreFamily.identityRevision !== record.identityRevision
  ) return false;
  const privateSidecar = record?.dispersedMediumOptics ?? null;
  const advertised = sphGpuParticleUploadAdvertisesDispersedMediumOptics(upload);
  if (!privateSidecar) return advertised === false;
  const current = captureExactSphParticleUploadDispersedMediumOptics(upload, device);
  return Boolean(
    current
    && current.upload === privateSidecar.upload
    && current.authority === privateSidecar.authority
    && current.buffer === privateSidecar.buffer
    && current.rowCount === privateSidecar.rowCount
    && current.rowStrideFloats === privateSidecar.rowStrideFloats
    && current.bufferByteLength === privateSidecar.bufferByteLength
    && current.stateBuffer === privateSidecar.stateBuffer
    && current.thermoBuffer === privateSidecar.thermoBuffer
    && current.identityBuffer === privateSidecar.identityBuffer
    && current.particleCount === privateSidecar.particleCount
    && current.topologyEpoch === privateSidecar.topologyEpoch
    && current.identityRevision === privateSidecar.identityRevision
    && current.ownsBuffer === privateSidecar.ownsBuffer
  );
}

function exactParentDispersedMediumRecordMatchesExceptTopologyEpoch(
  upload,
  record,
  device = null
) {
  const coreFamily = captureExactSphParticleUploadCoreFamily(
    upload,
    device ?? record?.device ?? null
  );
  const privateSidecar = record?.dispersedMediumOptics ?? null;
  if (
    !coreFamily
    || !privateSidecar
    || coreFamily.device !== record?.device
    || coreFamily.stateBuffer !== record.stateBuffer
    || coreFamily.thermoBuffer !== record.thermoBuffer
    || coreFamily.identityBuffer !== record.identityBuffer
    || coreFamily.particleCount !== record.particleCount
    || coreFamily.identityRevision !== record.identityRevision
    || privateSidecar.stateBuffer !== record.stateBuffer
    || privateSidecar.thermoBuffer !== record.thermoBuffer
    || privateSidecar.identityBuffer !== record.identityBuffer
    || privateSidecar.particleCount !== record.particleCount
    || privateSidecar.identityRevision !== record.identityRevision
    || upload.dispersedMediumOptics !== privateSidecar.upload
    || upload.dispersedMediumOpticsAuthority !== privateSidecar.authority
    || upload.dispersedMediumOpticsBuffer !== privateSidecar.buffer
    || upload.dispersedMediumOpticsRowCount !== privateSidecar.rowCount
    || upload.dispersedMediumOpticsRowStrideFloats
      !== privateSidecar.rowStrideFloats
    || upload.dispersedMediumOpticsBufferByteLength
      !== privateSidecar.bufferByteLength
    || upload.ownsDispersedMediumOpticsBuffer !== privateSidecar.ownsBuffer
  ) return false;
  return sphDispersedMediumGpuBufferParticleSourceFamilyMatches(
    privateSidecar.upload,
    privateSidecar
  );
}

/**
 * Prove that an exact parent upload and its privately authenticated optics
 * sidecar are being consumed with the same particle-aligned source buffers
 * captured when that parent entered the lifecycle. Callers must pass the
 * buffers actually bound to their dispatch so public source overrides cannot
 * pair another particle family with this sidecar.
 */
export function sphGpuParticleUploadDispersedMediumOpticsMatchesSourceBuffers(
  upload,
  {
    device = null,
    stateBuffer = null,
    thermoBuffer = null,
    identityBuffer = null
  } = {}
) {
  const record = sphParticleBufferSetLifecycleRecords.get(upload) || null;
  const privateSidecar = record?.dispersedMediumOptics ?? null;
  return Boolean(
    privateSidecar
    && exactParentDispersedMediumRecordMatches(upload, record, device)
    && stateBuffer === privateSidecar.stateBuffer
    && thermoBuffer === privateSidecar.thermoBuffer
    && identityBuffer === privateSidecar.identityBuffer
  );
}

/**
 * Retire only the privately recorded dispersed-medium component of a parent
 * upload. Resident cleanup sometimes preserves other parent buffers, so it
 * cannot always invoke the whole-family destructor. This component-scoped
 * path still ignores mutable public ownership and child aliases.
 */
export function retireSphGpuParticleBufferSetDispersedMediumOptics(
  upload,
  { shouldRetire = null } = {}
) {
  const record = sphParticleBufferSetLifecycleRecords.get(upload) || null;
  if (!record) {
    return Object.freeze({
      handled: false,
      status: 'unregistered-parent',
      buffer: null,
      retirementRequested: false
    });
  }
  const privateSidecar = record.dispersedMediumOptics ?? null;
  if (!privateSidecar) {
    return Object.freeze({
      handled: true,
      status: 'private-sidecar-absent',
      buffer: null,
      retirementRequested: false
    });
  }
  const buffer = privateSidecar.buffer;
  if (privateSidecar.ownsBuffer !== true) {
    return Object.freeze({
      handled: true,
      status: 'private-sidecar-borrowed',
      buffer,
      retirementRequested: false
    });
  }
  if (typeof shouldRetire === 'function' && shouldRetire(buffer) !== true) {
    return Object.freeze({
      handled: true,
      status: 'private-sidecar-preserved',
      buffer,
      retirementRequested: false
    });
  }
  if (!destroySphDispersedMediumGpuBuffers(privateSidecar.upload)) {
    return Object.freeze({
      handled: true,
      status: 'private-sidecar-retirement-rejected',
      buffer,
      retirementRequested: false
    });
  }
  privateSidecar.ownsBuffer = false;
  retireSphDispersedMediumOwnershipState(upload, privateSidecar);
  try {
    upload.ownsDispersedMediumOpticsBuffer = false;
  } catch {
    // The private ownership transition is authoritative; a hostile public
    // diagnostic setter cannot undo an accepted child retirement request.
  }
  return Object.freeze({
    handled: true,
    status: 'private-sidecar-retirement-requested',
    buffer,
    retirementRequested: true
  });
}

function destroySphGpuParticleBuffersNow(buffers, record = null) {
  if (!buffers || (record ? record.destroyed : buffers.destroyed)) return false;
  // Retire the privately owned child before any parent allocation.  A false
  // result means the child module did not accept this retirement request; in
  // that case the parent must preserve both its ownership record and all of
  // its still-live core allocations so the exact owner can retry or quarantine
  // the family without reporting a partial parent destruction as success.
  if (record?.dispersedMediumOptics) {
    if (record.dispersedMediumOptics.ownsBuffer) {
      if (
        destroySphDispersedMediumGpuBuffers(
          record.dispersedMediumOptics.upload
        ) !== true
      ) {
        return false;
      }
      record.dispersedMediumOptics.ownsBuffer = false;
      retireSphDispersedMediumOwnershipState(
        buffers,
        record.dispersedMediumOptics
      );
    }
  } else if (!record && buffers.ownsDispersedMediumOpticsBuffer !== false) {
    if (buffers.dispersedMediumOptics) {
      if (
        destroySphDispersedMediumGpuBuffers(
          buffers.dispersedMediumOptics
        ) !== true
      ) {
        return false;
      }
    } else {
      buffers.dispersedMediumOpticsBuffer?.destroy?.();
    }
  }
  // Once a parent has entered the private lifecycle, retire the exact core
  // allocations recorded at admission. Mutable public aliases remain useful
  // diagnostics but must not redirect destruction to unrelated buffers.
  if (buffers.ownsStateBuffer !== false) {
    (record?.stateBuffer ?? buffers.stateBuffer)?.destroy?.();
  }
  if (buffers.ownsThermoBuffer !== false) {
    (record?.thermoBuffer ?? buffers.thermoBuffer)?.destroy?.();
  }
  if (buffers.ownsIdentityBuffer !== false) {
    (record?.identityBuffer ?? buffers.identityBuffer)?.destroy?.();
  }
  if (buffers.ownsMaterialPropertyBankWarmInputBuffer !== false) {
    buffers.materialPropertyBankWarmInputBuffer?.destroy?.();
  }
  if (buffers.ownsMaterialPropertyBankParticleSizeBuffer !== false) {
    buffers.materialPropertyBankParticleSizeBuffer?.destroy?.();
  }
  buffers.destroyed = true;
  if (record) {
    record.destroyRequested = false;
    record.destroyed = true;
  }
  return true;
}

function installSphGpuParticleBufferSetBorrowLifecycle(
  buffers,
  dispersedMediumOptics
) {
  const existingDescriptor = Object.getOwnPropertyDescriptor(
    buffers,
    '__ulgActiveBorrowCount'
  );
  // An unregistered accessor cannot prove that this module's destruction
  // paths observe the same private borrow counter.
  if (existingDescriptor || !Object.isExtensible(buffers)) return null;
  const coreFamily = captureExactSphParticleUploadCoreFamily(buffers);
  if (
    !coreFamily
    || (
      dispersedMediumOptics
      && (
        dispersedMediumOptics.stateBuffer !== coreFamily.stateBuffer
        || dispersedMediumOptics.thermoBuffer !== coreFamily.thermoBuffer
        || dispersedMediumOptics.identityBuffer !== coreFamily.identityBuffer
        || dispersedMediumOptics.particleCount !== coreFamily.particleCount
        || dispersedMediumOptics.topologyEpoch !== coreFamily.topologyEpoch
        || dispersedMediumOptics.identityRevision !== coreFamily.identityRevision
      )
    )
  ) return null;
  const record = {
    activeBorrowCount: 0,
    destroyRequested: false,
    destroyed: false,
    dispersedMediumOptics,
    ...coreFamily
  };
  Object.defineProperty(buffers, '__ulgActiveBorrowCount', {
    configurable: true,
    enumerable: false,
    get() {
      return record.activeBorrowCount;
    },
    set(value) {
      record.activeBorrowCount = Math.max(
        0,
        Math.floor(Number(value) || 0)
      );
      if (
        record.activeBorrowCount === 0
        && record.destroyRequested
        && !record.destroyed
      ) {
        destroySphGpuParticleBuffersNow(buffers, record);
        record.deferredCleanups?.clear();
      } else if (
        record.activeBorrowCount === 0
        && !record.destroyed
        && record.deferredCleanups?.size > 0
      ) {
        const pending = [...record.deferredCleanups];
        record.deferredCleanups.clear();
        for (const cleanup of pending) {
          try {
            cleanup();
          } catch (error) {
            record.deferredCleanupError = error;
          }
        }
      }
    }
  });
  sphParticleBufferSetLifecycleRecords.set(buffers, record);
  return record;
}

function rollbackSphGpuParticleBufferSetBorrowLifecycleInstall(
  buffers,
  record
) {
  if (!canRollbackSphGpuParticleBufferSetBorrowLifecycleInstall(
    buffers,
    record
  )) return false;
  sphParticleBufferSetLifecycleRecords.delete(buffers);
  try {
    return delete buffers.__ulgActiveBorrowCount;
  } catch {
    return false;
  }
}

function canRollbackSphGpuParticleBufferSetBorrowLifecycleInstall(
  buffers,
  record
) {
  return Boolean(
    record
    && sphParticleBufferSetLifecycleRecords.get(buffers) === record
    && record.activeBorrowCount === 0
    && !record.destroyRequested
    && !record.destroyed
    && !(record.deferredCleanups?.size > 0)
  );
}

/**
 * Create and atomically attach a new privately registered optics child to one
 * exact pre-existing particle source family. This is the only public initial
 * attachment path: the caller receives the child descriptor, never the opaque
 * registrar that authorizes future topology-stable family transitions.
 */
function attachNewSphGpuParticleDispersedMediumOpticsSidecar(
  device,
  packed,
  {
    sourceSphUpload,
    createSidecar,
    registerParentRollback = null,
    destroySidecarOnFailure = true
  } = {}
) {
  const particleLineage = exactSphParticleUploadLineage(sourceSphUpload);
  const initialCoreFamily = captureExactSphParticleUploadCoreFamily(
    sourceSphUpload,
    device
  );
  const existingLifecycleRecord =
    sphParticleBufferSetLifecycleRecords.get(sourceSphUpload) ?? null;
  const exactCoreFamilyStillMatches = () => {
    const current = captureExactSphParticleUploadCoreFamily(
      sourceSphUpload,
      device
    );
    return Boolean(
      initialCoreFamily
      && current
      && current.device === initialCoreFamily.device
      && current.stateBuffer === initialCoreFamily.stateBuffer
      && current.thermoBuffer === initialCoreFamily.thermoBuffer
      && current.identityBuffer === initialCoreFamily.identityBuffer
      && current.particleCount === initialCoreFamily.particleCount
      && current.topologyEpoch === initialCoreFamily.topologyEpoch
      && current.identityRevision === initialCoreFamily.identityRevision
    );
  };
  const attachmentWindowStillOpen = ({ requirePublicAbsence = false } = {}) => {
    const currentLifecycleRecord =
      sphParticleBufferSetLifecycleRecords.get(sourceSphUpload) ?? null;
    return Boolean(
      currentLifecycleRecord === existingLifecycleRecord
      && exactCoreFamilyStillMatches()
      && (
        !currentLifecycleRecord
        || (
          currentLifecycleRecord.destroyed !== true
          && currentLifecycleRecord.destroyRequested !== true
          && currentLifecycleRecord.dispersedMediumOptics == null
        )
      )
      && (
        !requirePublicAbsence
        || !sphGpuParticleUploadAdvertisesDispersedMediumOptics(
          sourceSphUpload
        )
      )
    );
  };
  const existingLifecycleUpgradeable = Boolean(
    existingLifecycleRecord
    && existingLifecycleRecord.destroyed !== true
    && existingLifecycleRecord.destroyRequested !== true
    && existingLifecycleRecord.dispersedMediumOptics == null
    && exactParentDispersedMediumRecordMatches(
      sourceSphUpload,
      existingLifecycleRecord,
      device
    )
  );
  if (
    !particleLineage
    || !initialCoreFamily
    || !sourceSphUpload?.stateBuffer
    || !sourceSphUpload?.thermoBuffer
    || (existingLifecycleRecord && !existingLifecycleUpgradeable)
    || sphGpuParticleUploadAdvertisesDispersedMediumOptics(sourceSphUpload)
  ) {
    throw new TypeError(
      'SPH dispersed-medium initial attachment requires one live exact sidecar-free particle source'
    );
  }
  const priorDescriptors = new Map(
    SPH_GPU_PARTICLE_DISPERSED_MEDIUM_OPTICS_ALIAS_FIELDS.map((field) => [
      field,
      Object.getOwnPropertyDescriptor(sourceSphUpload, field) ?? null
    ])
  );
  let sidecar = null;
  let lifecycleRecord = null;
  let lifecycleInstalled = false;
  let lifecycleUpgraded = false;
  let ownershipStateInitialized = false;
  let parentRollbackComplete = false;
  const rollbackParentPublication = () => {
    if (parentRollbackComplete) return true;
    let complete = true;
    if (ownershipStateInitialized && sidecar) {
      const ownershipState = sphDispersedMediumOwnershipStates.get(sidecar);
      if (ownershipState?.owner === sourceSphUpload) {
        sphDispersedMediumOwnershipStates.delete(sidecar);
      } else {
        complete = false;
      }
    }
    if (lifecycleUpgraded && lifecycleRecord) {
      if (lifecycleRecord.dispersedMediumOptics?.upload === sidecar) {
        lifecycleRecord.dispersedMediumOptics = null;
      } else if (lifecycleRecord.dispersedMediumOptics != null) {
        complete = false;
      }
    } else if (
      lifecycleInstalled
      && lifecycleRecord
      && !rollbackSphGpuParticleBufferSetBorrowLifecycleInstall(
        sourceSphUpload,
        lifecycleRecord
      )
    ) {
      complete = false;
    }
    for (
      const field of SPH_GPU_PARTICLE_DISPERSED_MEDIUM_OPTICS_ALIAS_FIELDS
    ) {
      const prior = priorDescriptors.get(field);
      try {
        if (prior) Object.defineProperty(sourceSphUpload, field, prior);
        else delete sourceSphUpload[field];
      } catch {
        complete = false;
      }
    }
    parentRollbackComplete = complete;
    return complete;
  };
  try {
    sidecar = createSidecar({
      particleLineage,
      stateBuffer: sourceSphUpload.stateBuffer,
      thermoBuffer: sourceSphUpload.thermoBuffer
    });
    if (registerParentRollback != null) {
      if (typeof registerParentRollback !== 'function') {
        throw new TypeError(
          'SPH dispersed-medium parent rollback registrar must be a function'
        );
      }
      registerParentRollback(rollbackParentPublication);
    }
    if (!attachmentWindowStillOpen({ requirePublicAbsence: true })) {
      throw new TypeError(
        'SPH dispersed-medium attachment source changed while its child was being created'
      );
    }
    Object.assign(sourceSphUpload, {
      dispersedMediumOptics: sidecar,
      dispersedMediumOpticsAuthority: sidecar.authority,
      dispersedMediumOpticsBuffer: sidecar.buffer,
      dispersedMediumOpticsRowCount: sidecar.rowCount,
      dispersedMediumOpticsRowStrideFloats: sidecar.rowStrideFloats,
      dispersedMediumOpticsBufferByteLength: sidecar.bufferByteLength,
      ownsDispersedMediumOpticsBuffer: true
    });
    const exactSidecar = captureExactSphParticleUploadDispersedMediumOptics(
      sourceSphUpload,
      device,
      { requireNewOwnerEligible: true }
    );
    if (!exactSidecar) {
      throw new TypeError(
        'SPH dispersed-medium initial attachment did not authenticate its exact source family'
      );
    }
    if (!attachmentWindowStillOpen()) {
      throw new TypeError(
        'SPH dispersed-medium attachment source changed before private publication'
      );
    }
    if (existingLifecycleUpgradeable) {
      lifecycleRecord = existingLifecycleRecord;
      lifecycleRecord.dispersedMediumOptics = exactSidecar;
      lifecycleUpgraded = true;
    } else {
      lifecycleRecord = installSphGpuParticleBufferSetBorrowLifecycle(
        sourceSphUpload,
        exactSidecar
      );
      lifecycleInstalled = Boolean(lifecycleRecord);
    }
    if (!lifecycleRecord) {
      throw new TypeError(
        'SPH dispersed-medium initial attachment could not seed its private parent record'
      );
    }
    const priorOwnershipState =
      sphDispersedMediumOwnershipStates.get(sidecar);
    if (!initializeSphDispersedMediumOwnershipState(
      sourceSphUpload,
      exactSidecar
    )) {
      throw new TypeError(
        'SPH dispersed-medium initial attachment conflicts with its private owner state'
      );
    }
    ownershipStateInitialized = Boolean(
      !priorOwnershipState
      && sphDispersedMediumOwnershipStates.get(sidecar)?.owner
        === sourceSphUpload
    );
    return sidecar;
  } catch (error) {
    try { rollbackParentPublication(); } catch {}
    if (destroySidecarOnFailure) {
      try { destroySphDispersedMediumGpuBuffers(sidecar); } catch {}
    }
    throw error;
  }
}

export function uploadSphGpuParticleDispersedMediumOpticsSidecar(
  device,
  packed,
  {
    sourceSphUpload,
    label = null
  } = {}
) {
  return attachNewSphGpuParticleDispersedMediumOpticsSidecar(
    device,
    packed,
    {
      sourceSphUpload,
      createSidecar: ({ particleLineage, stateBuffer, thermoBuffer }) => (
        uploadSphDispersedMediumOpticsWithPrivateSourceFamilyRegistrar(
          device,
          packed,
          {
            label,
            particleLineage,
            stateBuffer,
            thermoBuffer
          }
        )
      )
    }
  );
}

/**
 * Consume one producer-issued one-shot claim and atomically attach its exact
 * output to an exact successor particle family. Arbitrary same-shape buffers
 * and caller-authored declaration metadata have no path into child authority.
 */
export function adoptSphGpuParticleDispersedMediumOpticsSidecar(
  device,
  producerAdoptionClaim,
  outputBuffer,
  options = null
) {
  const registrar = Object.freeze(Object.create(null));
  let capturedSourceFamily = null;
  let capturedSourceSphUpload = null;
  let sourceFamilyCaptured = false;
  const captureSourceFamily = () => {
    if (sourceFamilyCaptured) return capturedSourceFamily;
    // This helper is first invoked by the lower adoption wrapper only after
    // the producer has locked its one-shot claim. Keeping the public option
    // and particle-upload reads lazy prevents Proxy/getter re-entry from
    // consuming the same claim before its outer invocation owns preflight.
    const sourceSphUpload = options?.sourceSphUpload ?? null;
    const coreFamily = captureExactSphParticleUploadCoreFamily(
      sourceSphUpload,
      device
    );
    capturedSourceSphUpload = sourceSphUpload;
    capturedSourceFamily = coreFamily
      ? Object.freeze({
          particleCount: coreFamily.particleCount,
          topologyEpoch: coreFamily.topologyEpoch,
          identityRevision: coreFamily.identityRevision,
          identityBuffer: coreFamily.identityBuffer,
          stateBuffer: coreFamily.stateBuffer,
          thermoBuffer: coreFamily.thermoBuffer
        })
      : null;
    sourceFamilyCaptured = true;
    return capturedSourceFamily;
  };
  const lowerOptions = Object.create(null);
  Object.defineProperties(lowerOptions, {
    device: { enumerable: true, value: device },
    outputBuffer: { enumerable: true, value: outputBuffer },
    particleLineage: {
      enumerable: true,
      get: captureSourceFamily
    },
    particleSourceFamily: {
      enumerable: true,
      get: captureSourceFamily
    },
    particleSourceFamilyRegistrar: {
      enumerable: true,
      value: registrar
    },
    publish: {
      enumerable: true,
      value({ upload, registerPublicationRollback }) {
        const sourceSphUpload = capturedSourceSphUpload;
        if (!sourceFamilyCaptured || !capturedSourceFamily) {
          throw new TypeError(
            'SPH dispersed-medium producer adoption requires one exact live particle source'
          );
        }
        let registrarPublished = false;
        const rollbackRegistrarPublication = () => {
          if (!registrarPublished) return true;
          if (
            sphDispersedMediumSourceFamilyRegistrars.get(upload)
              !== registrar
          ) return false;
          sphDispersedMediumSourceFamilyRegistrars.delete(upload);
          registrarPublished = false;
          return true;
        };
        registerPublicationRollback(rollbackRegistrarPublication);
        sphDispersedMediumSourceFamilyRegistrars.set(upload, registrar);
        registrarPublished = true;
        return attachNewSphGpuParticleDispersedMediumOpticsSidecar(
          device,
          null,
          {
            sourceSphUpload,
            createSidecar: () => upload,
            registerParentRollback: registerPublicationRollback,
            destroySidecarOnFailure: false
          }
        );
      }
    }
  });
  const transaction =
    consumeSphDispersedMediumOpticsProducerClaimAsGpuBuffer(
      producerAdoptionClaim,
      lowerOptions
    );
  return transaction.adoptedOutput;
}

/**
 * Attach non-enumerable borrow accounting to an exact SPH particle upload.
 * Owners using destroySphGpuParticleBuffers() are held until the last active
 * same-device consumer releases its borrow. A first-seen sidecar parent is
 * admitted only when the child already carries the exact private source-family
 * registration minted by upload or an authenticated continuation transfer.
 */
export function ensureSphGpuParticleBufferSetBorrowLifecycle(buffers) {
  if (!buffers || typeof buffers !== 'object' || buffers.destroyed === true) {
    return false;
  }
  const existingRecord = sphParticleBufferSetLifecycleRecords.get(buffers);
  if (existingRecord) {
    return Boolean(
      existingRecord.destroyed !== true
      && exactParentDispersedMediumRecordMatches(buffers, existingRecord)
    );
  }
  if (sphGpuParticleUploadAdvertisesDispersedMediumOptics(buffers)) {
    return false;
  }
  const dispersedMediumOptics =
    captureExactSphParticleUploadDispersedMediumOptics(
      buffers,
      null,
      { requireNewOwnerEligible: true }
    );
  if (dispersedMediumOptics === false) return false;
  return Boolean(
    installSphGpuParticleBufferSetBorrowLifecycle(
      buffers,
      dispersedMediumOptics
    )
  );
}

/**
 * Extend an existing privately authenticated optics child to one exact
 * topology-stable particle-buffer successor without creating a new parent or
 * moving ownership. The original parent remains the authority root even when
 * `sourceStateBuffer` and `sourceThermoBuffer` name a transient family that a
 * previous invocation registered.
 *
 * The returned object is the lower registry's one-transition rollback
 * authority: `{ inserted, rollback() }`.
 */
export function registerTopologyStableSphDispersedMediumOpticsSourceFamilyContinuation(
  options = null
) {
  // Resolve only the authority-root object before acquiring the child-local
  // preflight lock. All remaining caller-controlled fields stay unread until
  // reentrant continuations for this exact child have been excluded.
  const sourceSphUpload = options?.sourceSphUpload ?? null;
  const sourceRecord =
    sphParticleBufferSetLifecycleRecords.get(sourceSphUpload) ?? null;
  const privateSidecar = sourceRecord?.dispersedMediumOptics ?? null;
  const childUpload = privateSidecar?.upload ?? null;
  const registrar = childUpload
    ? sphDispersedMediumSourceFamilyRegistrars.get(childUpload) ?? null
    : null;
  const ownershipState = childUpload
    ? sphDispersedMediumOwnershipStates.get(childUpload) ?? null
    : null;
  if (
    !sourceRecord
    || sourceRecord.destroyed
    || sourceRecord.destroyRequested
    || !privateSidecar
    || !childUpload
    || !registrar
    || !ownershipState
    || sphDispersedMediumSourceFamilyContinuationsInProgress.has(childUpload)
  ) {
    throw new TypeError(
      'SPH dispersed-medium topology-stable continuation requires one exact live private parent, child, and registrar'
    );
  }

  const priorOwnershipOwner = ownershipState.owner;
  const priorOwnershipGeneration = ownershipState.generation;
  const priorParentOwnsBuffer = privateSidecar.ownsBuffer;
  sphDispersedMediumSourceFamilyContinuationsInProgress.add(childUpload);
  const continuationWindowStillOpen = () => Boolean(
    sphParticleBufferSetLifecycleRecords.get(sourceSphUpload) === sourceRecord
    && sourceRecord.destroyed !== true
    && sourceRecord.destroyRequested !== true
    && sourceRecord.dispersedMediumOptics === privateSidecar
    && sphDispersedMediumSourceFamilyRegistrars.get(childUpload) === registrar
    && sphDispersedMediumOwnershipStates.get(childUpload) === ownershipState
    && ownershipState.owner === priorOwnershipOwner
    && ownershipState.generation === priorOwnershipGeneration
    && privateSidecar.ownsBuffer === priorParentOwnsBuffer
    && exactParentDispersedMediumRecordMatches(
      sourceSphUpload,
      sourceRecord,
      sourceRecord.device
    )
    && sphDispersedMediumGpuBufferNewOwnerEligible(childUpload)
  );

  try {
    if (!continuationWindowStillOpen()) {
      throw new TypeError(
        'SPH dispersed-medium topology-stable continuation authority is no longer live'
      );
    }
    const device = options?.device ?? null;
    const sourceStateBuffer = options?.sourceStateBuffer ?? null;
    const sourceThermoBuffer = options?.sourceThermoBuffer ?? null;
    const targetStateBuffer = options?.targetStateBuffer ?? null;
    const targetThermoBuffer = options?.targetThermoBuffer ?? null;
    if (
      device !== sourceRecord.device
      || !continuationWindowStillOpen()
    ) {
      throw new TypeError(
        'SPH dispersed-medium topology-stable continuation requires the exact live parent device'
      );
    }
    const lineage = Object.freeze({
      particleCount: sourceRecord.particleCount,
      topologyEpoch: sourceRecord.topologyEpoch,
      identityRevision: sourceRecord.identityRevision,
      identityBuffer: sourceRecord.identityBuffer
    });
    const sourceFamily = Object.freeze({
      ...lineage,
      stateBuffer: sourceStateBuffer,
      thermoBuffer: sourceThermoBuffer
    });
    const targetFamily = Object.freeze({
      ...lineage,
      stateBuffer: targetStateBuffer,
      thermoBuffer: targetThermoBuffer
    });
    return registerSphDispersedMediumGpuBufferParticleSourceFamilyContinuation(
      childUpload,
      Object.freeze({ registrar, sourceFamily, targetFamily })
    );
  } finally {
    sphDispersedMediumSourceFamilyContinuationsInProgress.delete(childUpload);
  }
}

/**
 * Atomically advance an adopted optics child and its exact parent through one
 * conservative topology-epoch publication stamp. The parent object and every
 * authority-bearing buffer remain identical. The public parent may still
 * expose the source epoch, or may already expose the exact requested target;
 * no other partial or inferred transition is accepted.
 */
export function advanceExactParentSphDispersedMediumOpticsTopologyEpoch(
  options = null
) {
  const sourceSphUpload = options?.sourceSphUpload ?? null;
  const sourceRecord =
    sphParticleBufferSetLifecycleRecords.get(sourceSphUpload) ?? null;
  const privateSidecar = sourceRecord?.dispersedMediumOptics ?? null;
  const childUpload = privateSidecar?.upload ?? null;
  const registrar = childUpload
    ? sphDispersedMediumSourceFamilyRegistrars.get(childUpload) ?? null
    : null;
  const ownershipState = childUpload
    ? sphDispersedMediumOwnershipStates.get(childUpload) ?? null
    : null;
  if (
    !sourceRecord
    || sourceRecord.destroyed
    || sourceRecord.destroyRequested
    || sourceRecord.activeBorrowCount !== 0
    || !privateSidecar
    || !childUpload
    || !registrar
    || !ownershipState
    || ownershipState.owner !== sourceSphUpload
    || privateSidecar.ownsBuffer !== true
    || sphDispersedMediumSourceFamilyContinuationsInProgress.has(childUpload)
  ) {
    throw new TypeError(
      'SPH dispersed-medium topology-epoch transition requires one exact unborrowed owning parent and child'
    );
  }

  const sourceOwnershipGeneration = ownershipState.generation;
  sphDispersedMediumSourceFamilyContinuationsInProgress.add(childUpload);
  let childTransition = null;
  let parentAdvanced = false;
  let publicationWindowAdmitted = false;
  let topologyDescriptor = null;
  const sourceTopologyEpoch = sourceRecord.topologyEpoch;
  const sourceFamily = Object.freeze({
    particleCount: sourceRecord.particleCount,
    topologyEpoch: sourceTopologyEpoch,
    identityRevision: sourceRecord.identityRevision,
    identityBuffer: sourceRecord.identityBuffer,
    stateBuffer: sourceRecord.stateBuffer,
    thermoBuffer: sourceRecord.thermoBuffer
  });
  try {
    const device = options?.device ?? null;
    const targetTopologyEpoch = options?.targetTopologyEpoch;
    const observedTopologyEpoch = sourceSphUpload?.topologyEpoch;
    topologyDescriptor = Object.getOwnPropertyDescriptor(
      sourceSphUpload,
      'topologyEpoch'
    ) ?? null;
    if (
      device !== sourceRecord.device
      || !Number.isSafeInteger(sourceTopologyEpoch)
      || sourceTopologyEpoch < 0
      || sourceTopologyEpoch >= 0xffff_ffff
      || !Number.isSafeInteger(targetTopologyEpoch)
      || targetTopologyEpoch !== sourceTopologyEpoch + 1
      || (
        observedTopologyEpoch !== sourceTopologyEpoch
        && observedTopologyEpoch !== targetTopologyEpoch
      )
      || !topologyDescriptor
      || !Object.prototype.hasOwnProperty.call(topologyDescriptor, 'value')
      || topologyDescriptor.writable !== true
      || sphParticleBufferSetLifecycleRecords.get(sourceSphUpload)
        !== sourceRecord
      || sourceRecord.activeBorrowCount !== 0
      || sourceRecord.dispersedMediumOptics !== privateSidecar
      || sphDispersedMediumSourceFamilyRegistrars.get(childUpload) !== registrar
      || sphDispersedMediumOwnershipStates.get(childUpload) !== ownershipState
      || ownershipState.owner !== sourceSphUpload
      || ownershipState.generation !== sourceOwnershipGeneration
      || privateSidecar.ownsBuffer !== true
      || !exactParentDispersedMediumRecordMatchesExceptTopologyEpoch(
        sourceSphUpload,
        sourceRecord,
        device
      )
      || !sphDispersedMediumGpuBufferNewOwnerEligible(childUpload)
    ) {
      throw new TypeError(
        'SPH dispersed-medium topology-epoch transition requires exact source or target stamp observation with no other parent drift'
      );
    }
    publicationWindowAdmitted = true;

    childTransition =
      advanceSphDispersedMediumGpuBufferParticleTopologyEpoch(
        childUpload,
        { registrar, sourceFamily, targetTopologyEpoch }
      );
    Object.defineProperty(sourceSphUpload, 'topologyEpoch', {
      ...topologyDescriptor,
      value: targetTopologyEpoch
    });
    sourceRecord.topologyEpoch = targetTopologyEpoch;
    privateSidecar.topologyEpoch = targetTopologyEpoch;
    parentAdvanced = true;

    const targetFamily = Object.freeze({
      ...sourceFamily,
      topologyEpoch: targetTopologyEpoch
    });
    if (
      !exactParentDispersedMediumRecordMatches(
        sourceSphUpload,
        sourceRecord,
        device
      )
      || !sphDispersedMediumGpuBufferParticleTopologyEpochTransitionMatches(
        childTransition.witness,
        { upload: childUpload, sourceFamily, targetFamily }
      )
    ) {
      throw new TypeError(
        'SPH dispersed-medium topology-epoch transition failed exact post-publication authentication'
      );
    }

    const receipt = Object.freeze({
      schema:
        ULG_SPH_GPU_PARTICLE_DISPERSED_MEDIUM_OPTICS_TOPOLOGY_EPOCH_TRANSITION_SCHEMA,
      status:
        'sph-particle-dispersed-medium-optics-topology-epoch-advanced',
      particleCount: sourceRecord.particleCount,
      identityRevision: sourceRecord.identityRevision,
      sourceTopologyEpoch,
      targetTopologyEpoch,
      childTransitionWitness: childTransition.witness,
      rollback: null
    });
    const transitionRecord = {
      active: true,
      receipt,
      sourceSphUpload,
      sourceRecord,
      privateSidecar,
      childUpload,
      device,
      registrar,
      ownershipState,
      sourceOwnershipGeneration,
      sourceFamily,
      targetFamily,
      sourceTopologyEpoch,
      targetTopologyEpoch,
      topologyDescriptor,
      childTransition
    };
    const exactTargetStateStillLive = () => Boolean(
      transitionRecord.active
      && sphParticleBufferSetLifecycleRecords.get(sourceSphUpload)
        === sourceRecord
      && sourceRecord.destroyed !== true
      && sourceRecord.destroyRequested !== true
      && sourceRecord.activeBorrowCount === 0
      && sourceRecord.dispersedMediumOptics === privateSidecar
      && sphDispersedMediumSourceFamilyRegistrars.get(childUpload) === registrar
      && sphDispersedMediumOwnershipStates.get(childUpload) === ownershipState
      && ownershipState.owner === sourceSphUpload
      && ownershipState.generation === sourceOwnershipGeneration
      && privateSidecar.ownsBuffer === true
      && sourceSphUpload.topologyEpoch === targetTopologyEpoch
      && exactParentDispersedMediumRecordMatches(
        sourceSphUpload,
        sourceRecord,
        device
      )
      && sphDispersedMediumGpuBufferParticleTopologyEpochTransitionMatches(
        childTransition.witness,
        { upload: childUpload, sourceFamily, targetFamily }
      )
    );
    transitionRecord.exactTargetStateStillLive = exactTargetStateStillLive;

    let rolledBack = false;
    const rollback = () => {
      if (rolledBack) return true;
      if (!exactTargetStateStillLive()) return false;
      Object.defineProperty(sourceSphUpload, 'topologyEpoch', {
        ...topologyDescriptor,
        value: sourceTopologyEpoch
      });
      sourceRecord.topologyEpoch = sourceTopologyEpoch;
      privateSidecar.topologyEpoch = sourceTopologyEpoch;
      if (childTransition.rollback() !== true) {
        Object.defineProperty(sourceSphUpload, 'topologyEpoch', {
          ...topologyDescriptor,
          value: targetTopologyEpoch
        });
        sourceRecord.topologyEpoch = targetTopologyEpoch;
        privateSidecar.topologyEpoch = targetTopologyEpoch;
        return false;
      }
      transitionRecord.active = false;
      rolledBack = true;
      return exactParentDispersedMediumRecordMatches(
        sourceSphUpload,
        sourceRecord,
        device
      );
    };
    const publishedReceipt = Object.freeze({
      ...receipt,
      rollback
    });
    transitionRecord.receipt = publishedReceipt;
    sphDispersedMediumParentTopologyEpochTransitionRecords.set(
      publishedReceipt,
      transitionRecord
    );
    return publishedReceipt;
  } catch (error) {
    if (parentAdvanced) {
      try {
        Object.defineProperty(sourceSphUpload, 'topologyEpoch', {
          ...topologyDescriptor,
          value: sourceTopologyEpoch
        });
      } catch {}
      sourceRecord.topologyEpoch = sourceTopologyEpoch;
      privateSidecar.topologyEpoch = sourceTopologyEpoch;
    } else if (
      publicationWindowAdmitted
      && sourceSphUpload?.topologyEpoch !== sourceTopologyEpoch
    ) {
      // An exact target observed before entry is still unauthenticated until
      // this transaction succeeds; restore the only privately valid epoch.
      try {
        Object.defineProperty(sourceSphUpload, 'topologyEpoch', {
          ...topologyDescriptor,
          value: sourceTopologyEpoch
        });
      } catch {}
    }
    try { childTransition?.rollback?.(); } catch {}
    throw error;
  } finally {
    sphDispersedMediumSourceFamilyContinuationsInProgress.delete(childUpload);
  }
}

export function exactParentSphDispersedMediumOpticsTopologyEpochTransitionMatches(
  receipt,
  {
    sourceSphUpload = null,
    device = null,
    targetTopologyEpoch = null
  } = {}
) {
  const transition =
    sphDispersedMediumParentTopologyEpochTransitionRecords.get(receipt) ?? null;
  try {
    return Boolean(
      transition
      && transition.receipt === receipt
      && transition.sourceSphUpload === sourceSphUpload
      && transition.device === device
      && transition.targetTopologyEpoch === targetTopologyEpoch
      && Object.isFrozen(receipt)
      && receipt.schema
        === ULG_SPH_GPU_PARTICLE_DISPERSED_MEDIUM_OPTICS_TOPOLOGY_EPOCH_TRANSITION_SCHEMA
      && receipt.status
        === 'sph-particle-dispersed-medium-optics-topology-epoch-advanced'
      && receipt.particleCount === transition.sourceRecord.particleCount
      && receipt.identityRevision === transition.sourceRecord.identityRevision
      && receipt.sourceTopologyEpoch === transition.sourceTopologyEpoch
      && receipt.targetTopologyEpoch === transition.targetTopologyEpoch
      && receipt.childTransitionWitness
        === transition.childTransition.witness
      && receipt.rollback === transition.receipt.rollback
      && transition.exactTargetStateStillLive?.()
    );
  } catch {
    return false;
  }
}

export function transferSphGpuParticleBufferSetDispersedMediumOpticsOwnership({
  sourceSphUpload,
  targetSphUpload
} = {}) {
  const sourceRecord = sphParticleBufferSetLifecycleRecords.get(sourceSphUpload);
  let targetRecord = sphParticleBufferSetLifecycleRecords.get(targetSphUpload);
  const sourceSidecar = sourceRecord?.dispersedMediumOptics ?? null;
  const ownershipState = sourceSidecar
    && sphDispersedMediumOwnershipStates.get(sourceSidecar.upload);
  if (
    !sourceRecord
    || sourceRecord.destroyed
    || sourceRecord.destroyRequested
    || !exactParentDispersedMediumRecordMatches(sourceSphUpload, sourceRecord)
    || !sourceSidecar
    || !ownershipState
    || !sphDispersedMediumGpuBufferNewOwnerEligible(sourceSidecar.upload)
  ) {
    throw new TypeError(
      'SPH dispersed-medium ownership transfer requires an exact live private source parent/child record'
    );
  }
  const sourceOwned = sourceSidecar.ownsBuffer;
  const currentOwnerRecord = ownershipState.owner
    && sphParticleBufferSetLifecycleRecords.get(ownershipState.owner);
  if (
    !currentOwnerRecord
    || currentOwnerRecord.destroyed
    || currentOwnerRecord.destroyRequested
    || currentOwnerRecord.dispersedMediumOptics?.upload
      !== sourceSidecar.upload
    || currentOwnerRecord.dispersedMediumOptics?.ownsBuffer !== true
    || !exactParentDispersedMediumRecordMatches(
      ownershipState.owner,
      currentOwnerRecord
    )
    || (sourceOwned === true) !== (ownershipState.owner === sourceSphUpload)
  ) {
    throw new TypeError(
      'SPH dispersed-medium ownership transfer requires one exact current private owner'
    );
  }
  let sourceFamilyTransition = null;
  let installedTargetRecord = null;
  try {
    if (!targetRecord) {
      const candidate =
        captureCandidateSphParticleUploadDispersedMediumOptics(
          targetSphUpload,
          webGpuBufferDevice(sourceSidecar.buffer),
          { requireNewOwnerEligible: true }
        );
      if (
        !candidate
        || candidate.upload !== sourceSidecar.upload
        || candidate.authority !== sourceSidecar.authority
        || candidate.buffer !== sourceSidecar.buffer
        || candidate.rowCount !== sourceSidecar.rowCount
        || candidate.rowStrideFloats !== sourceSidecar.rowStrideFloats
        || candidate.bufferByteLength !== sourceSidecar.bufferByteLength
        || candidate.identityBuffer !== sourceSidecar.identityBuffer
        || candidate.particleCount !== sourceSidecar.particleCount
        || candidate.topologyEpoch !== sourceSidecar.topologyEpoch
        || candidate.identityRevision !== sourceSidecar.identityRevision
        || candidate.ownsBuffer !== false
      ) {
        throw new TypeError(
          'SPH dispersed-medium ownership transfer requires an exact borrowed topology-stable target family'
        );
      }
      sourceFamilyTransition =
        registerSphDispersedMediumGpuBufferParticleSourceFamilyContinuation(
          sourceSidecar.upload,
          {
            registrar: sphDispersedMediumSourceFamilyRegistrars.get(
              sourceSidecar.upload
            ),
            sourceFamily: sourceSidecar,
            targetFamily: candidate
          }
        );
      const authenticatedTarget =
        captureExactSphParticleUploadDispersedMediumOptics(
          targetSphUpload,
          webGpuBufferDevice(sourceSidecar.buffer),
          { requireNewOwnerEligible: true }
        );
      if (!authenticatedTarget) {
        throw new TypeError(
          'SPH dispersed-medium continuation source-family registration did not authenticate the target parent'
        );
      }
      targetRecord = installSphGpuParticleBufferSetBorrowLifecycle(
        targetSphUpload,
        authenticatedTarget
      );
      if (!targetRecord) {
        throw new TypeError(
          'SPH dispersed-medium continuation could not seed its private target parent record'
        );
      }
      installedTargetRecord = targetRecord;
    }
    if (
      targetRecord.destroyed
      || targetRecord.destroyRequested
      || !exactParentDispersedMediumRecordMatches(targetSphUpload, targetRecord)
      || !targetRecord.dispersedMediumOptics
      || sourceSidecar.upload !== targetRecord.dispersedMediumOptics.upload
      || targetRecord.dispersedMediumOptics.ownsBuffer !== false
      || !sphDispersedMediumGpuBufferNewOwnerEligible(sourceSidecar.upload)
    ) {
      throw new TypeError(
        'SPH dispersed-medium ownership transfer requires exact private parent/child records'
      );
    }
  } catch (error) {
    if (installedTargetRecord) {
      rollbackSphGpuParticleBufferSetBorrowLifecycleInstall(
        targetSphUpload,
        installedTargetRecord
      );
    }
    try { sourceFamilyTransition?.rollback?.(); } catch {}
    throw error;
  }
  const targetSidecar = targetRecord.dispersedMediumOptics;
  const targetOwned = targetSidecar.ownsBuffer;
  const shouldTransfer = sourceOwned === true;
  const priorOwnershipOwner = ownershipState.owner;
  const priorOwnershipGeneration = ownershipState.generation;
  const postOwnershipOwner = shouldTransfer
    ? targetSphUpload
    : priorOwnershipOwner;
  const postOwnershipGeneration =
    nextSphDispersedMediumOwnershipGeneration();
  const postSourceOwned = shouldTransfer ? false : sourceOwned;
  const postTargetOwned = shouldTransfer ? true : targetOwned;
  let rolledBack = false;

  const rollbackFailedPublication = () => {
    let complete = true;
    if (shouldTransfer) {
      sourceSidecar.ownsBuffer = sourceOwned;
      targetSidecar.ownsBuffer = targetOwned;
      try {
        sourceSphUpload.ownsDispersedMediumOpticsBuffer = sourceOwned;
        targetSphUpload.ownsDispersedMediumOpticsBuffer = targetOwned;
      } catch {
        complete = false;
      }
    }
    if (
      installedTargetRecord
      && !rollbackSphGpuParticleBufferSetBorrowLifecycleInstall(
        targetSphUpload,
        installedTargetRecord
      )
    ) {
      complete = false;
    }
    try {
      if (sourceFamilyTransition?.rollback?.() === false) complete = false;
    } catch {
      complete = false;
    }
    return complete;
  };

  const rollback = () => {
    if (rolledBack) return true;
    // A rollback handle is a one-transition capability, not a timeless path
    // back to a former owner. Refuse it before mutating anything once another
    // continuation, teardown, or public/private descriptor change has moved
    // this child beyond the exact state published by this transfer.
    if (
      sphDispersedMediumOwnershipStates.get(sourceSidecar.upload)
        !== ownershipState
      || ownershipState.owner !== postOwnershipOwner
      || ownershipState.generation !== postOwnershipGeneration
      || sphParticleBufferSetLifecycleRecords.get(sourceSphUpload)
        !== sourceRecord
      || sphParticleBufferSetLifecycleRecords.get(targetSphUpload)
        !== targetRecord
      || sourceRecord.destroyed
      || sourceRecord.destroyRequested
      || targetRecord.destroyed
      || targetRecord.destroyRequested
      || sourceSidecar.ownsBuffer !== postSourceOwned
      || targetSidecar.ownsBuffer !== postTargetOwned
      || !exactParentDispersedMediumRecordMatches(
        sourceSphUpload,
        sourceRecord
      )
      || !exactParentDispersedMediumRecordMatches(
        targetSphUpload,
        targetRecord
      )
      || !sphDispersedMediumGpuBufferNewOwnerEligible(sourceSidecar.upload)
      || (
        installedTargetRecord
        && !canRollbackSphGpuParticleBufferSetBorrowLifecycleInstall(
          targetSphUpload,
          installedTargetRecord
        )
      )
    ) return false;

    let complete = true;
    if (shouldTransfer) {
      sourceSidecar.ownsBuffer = sourceOwned;
      targetSidecar.ownsBuffer = targetOwned;
      try {
        sourceSphUpload.ownsDispersedMediumOpticsBuffer = sourceOwned;
        targetSphUpload.ownsDispersedMediumOpticsBuffer = targetOwned;
      } catch {
        complete = false;
      }
    }
    ownershipState.owner = priorOwnershipOwner;
    ownershipState.generation = priorOwnershipGeneration;
    if (
      installedTargetRecord
      && !rollbackSphGpuParticleBufferSetBorrowLifecycleInstall(
        targetSphUpload,
        installedTargetRecord
      )
    ) {
      complete = false;
    }
    try {
      if (sourceFamilyTransition?.rollback?.() === false) complete = false;
    } catch {
      complete = false;
    }
    rolledBack = complete;
    return complete;
  };
  try {
    if (shouldTransfer) {
      sourceSidecar.ownsBuffer = false;
      targetSidecar.ownsBuffer = true;
      sourceSphUpload.ownsDispersedMediumOpticsBuffer = false;
      targetSphUpload.ownsDispersedMediumOpticsBuffer = true;
    }
    if (
      !exactParentDispersedMediumRecordMatches(sourceSphUpload, sourceRecord)
      || !exactParentDispersedMediumRecordMatches(targetSphUpload, targetRecord)
    ) {
      throw new TypeError(
        'SPH dispersed-medium ownership transfer publication drifted from its private records'
      );
    }
    ownershipState.owner = postOwnershipOwner;
    ownershipState.generation = postOwnershipGeneration;
  } catch (error) {
    try { rollbackFailedPublication(); } catch {}
    throw error;
  }
  return Object.freeze({
    transferredOwnedBufferCount: shouldTransfer ? 1 : 0,
    rollback
  });
}

export function runSphGpuParticleBufferSetCleanupAfterBorrows(
  buffers,
  cleanup
) {
  if (typeof cleanup !== 'function') return false;
  const record = buffers
    && sphParticleBufferSetLifecycleRecords.get(buffers);
  if (!record || record.destroyed || buffers.destroyed === true) return false;
  if (record.activeBorrowCount === 0) {
    cleanup();
    return true;
  }
  record.deferredCleanups ??= new Set();
  record.deferredCleanups.add(cleanup);
  return true;
}

export function uploadSphGpuParticleBuffers(device, packed) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('uploadSphGpuParticleBuffers requires a WebGPU-like device with queue.writeBuffer');
  }
  if (packed?.schema !== ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError('uploadSphGpuParticleBuffers requires a packed SPH GPU particle buffer');
  }
  const topologyEpoch = packed.topologyEpoch;
  if (
    !Number.isSafeInteger(topologyEpoch)
    || topologyEpoch < 0
    || topologyEpoch > 0xffff_ffff
  ) {
    throw new TypeError(
      'uploadSphGpuParticleBuffers requires an exact u32 topologyEpoch'
    );
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
  const stateBuffer = writeStorageBuffer(
    device,
    'ulg-sph-particle-state',
    packed.state,
    { copySource: true }
  );
  const thermoBuffer = writeStorageBuffer(
    device,
    'ulg-sph-particle-thermo',
    packed.thermo,
    { copySource: true }
  );
  const identityValues = packed.identity instanceof Uint32Array
    ? packed.identity
    : new Uint32Array(packed.particleCount * SPH_GPU_PARTICLE_IDENTITY_UINTS);
  let identityValueMax = 0;
  for (const value of identityValues) identityValueMax = Math.max(identityValueMax, value);
  const identityBuffer = writeStorageBuffer(
    device,
    'ulg-sph-particle-identity',
    identityValues,
    { copySource: true }
  );
  identityValueMaxByBuffer.set(identityBuffer, identityValueMax);
  let dispersedMediumOptics = null;
  try {
    if (packed.dispersedMediumOptics != null) {
      if (packed.dispersedMediumOptics.particleCount !== packed.particleCount) {
        throw new RangeError(
          'dispersed-medium optics particle count must match the SPH particle buffer'
        );
      }
      dispersedMediumOptics =
        uploadSphDispersedMediumOpticsWithPrivateSourceFamilyRegistrar(
        device,
        packed.dispersedMediumOptics,
        {
          particleLineage: {
            particleCount: packed.particleCount,
            topologyEpoch,
            identityRevision: packed.identityRevision,
            identityBuffer
          },
          stateBuffer,
          thermoBuffer
        }
      );
    }
  } catch (error) {
    stateBuffer.destroy?.();
    thermoBuffer.destroy?.();
    identityBuffer.destroy?.();
    materialPropertyBankWarmInputBuffer?.destroy?.();
    materialPropertyBankParticleSizeBuffer?.destroy?.();
    throw error;
  }
  const upload = {
    schema: ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
    status: 'webgpu-uploaded',
    sourceSchema: packed.schema,
    particleCount: packed.particleCount,
    storageGeneration: Number.isInteger(Number(packed.storageGeneration))
      && Number(packed.storageGeneration) > 0
      ? Number(packed.storageGeneration)
      : null,
    positionEpoch: packed.positionEpoch ?? null,
    topologyEpoch,
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
    stateBuffer,
    thermoBuffer,
    identityBuffer,
    identityValueMax,
    renderDomainKeys: { ...(packed.renderDomainKeys || {}) },
    phaseCarrierPlan: packed.phaseCarrierPlan ? { ...packed.phaseCarrierPlan } : null,
    dispersedMediumOptics,
    dispersedMediumOpticsAuthority: dispersedMediumOptics?.authority ?? null,
    dispersedMediumOpticsBuffer: dispersedMediumOptics?.buffer ?? null,
    dispersedMediumOpticsRowCount: dispersedMediumOptics?.rowCount ?? 0,
    dispersedMediumOpticsRowStrideFloats:
      dispersedMediumOptics?.rowStrideFloats ?? 0,
    dispersedMediumOpticsBufferByteLength:
      dispersedMediumOptics?.bufferByteLength ?? 0,
    materialPropertyBankWarmInputBuffer,
    materialPropertyBankParticleSizeBuffer,
    materialPropertyBankWarmInputRowCount: packed.materialPropertyBankWarmInputTable?.rowCount ?? 0,
    materialPropertyBankParticleSizeRowCount: packed.materialPropertyBankParticleSizeTable?.rowCount ?? 0,
    ownsStateBuffer: true,
    ownsThermoBuffer: true,
    ownsIdentityBuffer: true,
    ownsDispersedMediumOpticsBuffer: Boolean(dispersedMediumOptics),
    ownsMaterialPropertyBankWarmInputBuffer: Boolean(materialPropertyBankWarmInputBuffer),
    ownsMaterialPropertyBankParticleSizeBuffer: Boolean(materialPropertyBankParticleSizeBuffer),
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
  const privateSidecar =
    captureExactSphParticleUploadDispersedMediumOptics(
      upload,
      device,
      { requireNewOwnerEligible: true }
    );
  const lifecycleRecord = privateSidecar === false
    ? null
    : installSphGpuParticleBufferSetBorrowLifecycle(upload, privateSidecar);
  if (!lifecycleRecord) {
    destroySphGpuParticleBuffersNow(upload);
    throw new TypeError(
      'SPH particle upload could not bind its exact dispersed-medium child authority'
    );
  }
  if (!initializeSphDispersedMediumOwnershipState(upload, privateSidecar)) {
    destroySphGpuParticleBuffersNow(upload, lifecycleRecord);
    throw new TypeError(
      'SPH particle upload could not bind its private dispersed-medium owner state'
    );
  }
  return upload;
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
  if (!optionalBuffers.every((buffer) => webGpuBufferDevice(buffer) === device)) {
    return false;
  }
  const lifecycleRecord = sphParticleBufferSetLifecycleRecords.get(upload) || null;
  if (!sphGpuParticleUploadAdvertisesDispersedMediumOptics(upload)) {
    return Boolean(
      lifecycleRecord
      && lifecycleRecord.dispersedMediumOptics == null
      && exactParentDispersedMediumRecordMatches(
        upload,
        lifecycleRecord,
        device
      )
    );
  }
  return Boolean(
    lifecycleRecord
    && exactParentDispersedMediumRecordMatches(upload, lifecycleRecord, device)
  );
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
    const status = statusForParticle(particle, eq, properties);
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
  if (!buffers) return false;
  const record = sphParticleBufferSetLifecycleRecords.get(buffers) || null;
  if (record ? record.destroyed : buffers.destroyed) return false;
  let activeBorrowCount = record?.activeBorrowCount ?? 0;
  if (!record) {
    try {
      activeBorrowCount = Math.max(
        0,
        Math.floor(Number(buffers.__ulgActiveBorrowCount) || 0)
      );
    } catch {
      activeBorrowCount = 0;
    }
  }
  if (activeBorrowCount > 0) {
    if (record) record.destroyRequested = true;
    return false;
  }
  return destroySphGpuParticleBuffersNow(buffers, record);
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

/**
 * Return whether the live packed prefix contains a row that the retained
 * spatial-gas classifier must inspect. This deliberately mirrors the GPU's
 * first, cheap gas-indication gate rather than claiming that the row is
 * already valid gas authority: malformed positive-mass gas-indicated rows
 * must still reach the classifier so it can fail the whole publication
 * closed. Any finite exactly-zero-mass row is safely inert because it owns no
 * physical inventory.
 */
export function sphGpuParticleStateHasGasCandidateIndication(packed) {
  if (packed?.schema !== ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError(
      'sphGpuParticleStateHasGasCandidateIndication requires a packed SPH GPU particle buffer'
    );
  }
  const particleCount = Number(packed.particleCount);
  if (
    !Number.isSafeInteger(particleCount)
    || Object.is(particleCount, -0)
    || particleCount < 0
    || !(packed.state instanceof Float32Array)
    || !(packed.thermo instanceof Float32Array)
    || packed.state.length < particleCount * SPH_GPU_PARTICLE_STATE_FLOATS
    || packed.thermo.length < particleCount * SPH_GPU_PARTICLE_THERMO_FLOATS
  ) {
    throw new RangeError(
      'packed SPH GPU particle rows do not cover an exact live particle prefix'
    );
  }
  const phaseFractionTolerance = Math.fround(1e-5);
  for (let index = 0; index < particleCount; index += 1) {
    const stateOffset = index * SPH_GPU_PARTICLE_STATE_FLOATS;
    const thermoOffset = index * SPH_GPU_PARTICLE_THERMO_FLOATS;
    const massKg = packed.state[stateOffset + 3];
    if (Number.isFinite(massKg) && massKg === 0) continue;
    const phase = packed.thermo[thermoOffset + 1];
    const solidFraction = packed.thermo[thermoOffset + 4];
    const liquidFraction = packed.thermo[thermoOffset + 5];
    const gasFraction = packed.thermo[thermoOffset + 6];
    const plasmaFraction = packed.thermo[thermoOffset + 7];
    const gasPhaseDeclared = Number.isFinite(phase)
      && phase > GPU_PHASE_IDS.gas - 0.5
      && phase < GPU_PHASE_IDS.gas + 0.5;
    const oneHotGasFractionDeclared = Number.isFinite(solidFraction)
      && Math.abs(solidFraction) <= phaseFractionTolerance
      && Number.isFinite(liquidFraction)
      && Math.abs(liquidFraction) <= phaseFractionTolerance
      && Number.isFinite(gasFraction)
      && Math.abs(gasFraction - 1) <= phaseFractionTolerance
      && Number.isFinite(plasmaFraction)
      && Math.abs(plasmaFraction) <= phaseFractionTolerance;
    if (!gasPhaseDeclared && !oneHotGasFractionDeclared) continue;
    return true;
  }
  return false;
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
