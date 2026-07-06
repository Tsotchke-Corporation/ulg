// SPH phase demo logic (headless; the renderer in visualization/sphPhaseScene.js draws it).
//
// Builds the molten-iron-on-ice scenario as an SPH particle cloud whose specific internal
// energy (and therefore phase + render colour) comes from the material closures, runs the
// energy-feasibility preflight, and steps the conservative CPU-reference carrier. This is a
// reduced-resolution reference: condensed-phase EOS, multi-material contact, wall heat flux,
// and conduction are demo plan P5 — so the stepping is labelled a reference, not validated
// phase physics. Evidence-only throughout.

import { createReferenceMaterialClosures } from './material/materialClosures.js';
import { createDerivedMaterialClosure, createReferenceAnchoredMaterialClosure, resolveMaterialSpec } from './material/materialDerivation.js';
import { specificInternalEnergyJPerKg } from './material/thermoState.js';
import {
  cachedParticleEquilibriumFromSpecificEnergy,
  equilibriumFromSpecificEnergy,
  stablePhaseFromSpecificEnergy
} from './material/phaseEquilibrium.js';
import { incandescentColor } from './material/radiationClosure.js';
import {
  WATER_DROPLET_OPTICAL_MICROPHYSICS_MODEL,
  intrinsicColorSrgb,
  waterDropletOpticalMicrophysics
} from './material/opticalClosure.js';
import {
  SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT,
  ULG_SPH_PRESSURE_INTERFACE_FORCE_SOLVER_SCHEMA,
  ULG_SPH_PRESSURE_INTERFACE_FORCE_PREVIEW_SCHEMA
} from '../../ulg-gpu-abi/src/index.js';
import { createSphState } from './sph/sphState.js';
import { createSphPhaseCarrier } from './sph/sphPhaseCarrier.js';
import { sphTotals } from './sph/sphConservation.js';
import { buoyancyAccelerationMPerS2, phaseMassWithSteam, thermalStep } from './sph/thermalPhase.js';
import { createPhaseAwareEos } from './sph/multiMaterialEos.js';
import { createMlsMpmCarrier } from './sph/mlsMpmCarrier.js';
import { elementMaterialClosure } from './material/elementClosures.js';
import { zForSymbol } from './electronicStructure/periodicTable.js';
import { reactiveStep } from './sph/reactiveChemistry.js';
import { discoverReactions } from './sph/reactionDiscovery.js';
import { createSphPhaseScenario } from './thermoPreflight.js';
import { PHYSICAL_CONSTANTS, idealGasDensityKgPerM3 } from './materials/referenceMaterials.js';
import {
  MaterialFirstPrinciplesResolutionError,
  requireFirstPrinciplesMaterialMap,
  requireFirstPrinciplesMaterialProperties
} from './material/propertyProvenance.js';
import {
  buildMaterialPropertyBankGpuWarmInputTable,
  buildMaterialPropertyBankParticleSizePackingTable,
  materialPropertyCrystalStructuresForSymbol,
  materialPropertyBankRecordBySymbol,
  materialPropertyBankWarmInput,
  normalizeMaterialPropertyBank,
  normalizeMaterialPropertyCrystalStructureBank
} from './material/materialPropertyBank.js';
import {
  DEFAULT_MATERIAL_PROPERTY_BANK,
  DEFAULT_MATERIAL_PROPERTY_CRYSTAL_STRUCTURE_BANK
} from './material/defaultMaterialPropertyBank.js';
import { buildAlgorithmMaterialParticleInitializationRows } from './material/algorithmMaterialRows.js';
import {
  algorithmContactPairResponseForElement,
  interfaceContactKinematicsForElement,
  normalizeAlgorithmContactPairResponsePolicy
} from './sph/sphPressureInterfaceGpuKernel.js';

const DEFAULT_RUNTIME_MATERIAL_KEYS = Object.freeze(['h2o', 'fe', 'air', 'h2', 'o2']);
const ULG_SPH_CPU_DRIVER_STEP_TIMING_SCHEMA = 'peercompute.ulg.sph-cpu-driver-step-timing.v0';
const H2O_VAPOR_OPTICAL_STATE_MODEL = 'h2o-vapor-condensation-optical-state-v0';
const H2O_VAPOR_OPTICAL_STATE_GENERATOR = `${WATER_DROPLET_OPTICAL_MICROPHYSICS_MODEL}:sealed-box-gas-summary-v0`;
const REDUCED_H2O_DROPLET_RADIUS_M = 1e-6;
const AVOGADRO_COUNT = 6.02214076e23;
const AVOGADRO_R = 8.314462618;
const TAIT_EXPONENT = 7;
const DEFAULT_INITIAL_TARGET_NEIGHBOR_COUNT = 64;
// The default base edge that defines one particle "quantum" of matter from
// the scenario's reference base block (spacing = baseSizeM / 5).
const DEFAULT_REFERENCE_BASE_PARTICLES_PER_EDGE = 5;
const DEFAULT_INITIAL_MAX_SMOOTHING_LENGTH_RATIO = 1.8;
const PHASE_VOLUME_EXPANSIVE_PHASE_NAMES = new Set(['gas', 'vapor', 'vapour', 'plasma']);
const DEFAULT_MLS_MPM_LIQUID_FREE_SURFACE_RELAXATION_ALPHA = 2e-3;
const DEFAULT_SPH_PHYSICAL_LAW_GROUPS = Object.freeze({
  mechanics: true,
  gravity: true,
  eos: true,
  pressure: true,
  thermal: true,
  reactions: true,
  viscosity: true,
  surfaceTension: false
});

const PENDING_SPH_PHYSICAL_LAW_GROUPS = Object.freeze({
  surfaceTension: 'surface-tension curvature solver is not implemented yet'
});

const ULG_SPH_LOCAL_PRESSURE_GRADIENT_FIELD_SCHEMA = 'peercompute.ulg.sph-local-pressure-gradient-field.v0';
const UNIFORM_GAS_PRESSURE_FIELD_MODE = 'uniform-single-cell-sealed-gas';
const UNIFORM_GAS_PRESSURE_FIELD_RESOLUTION = 'lumped-sealed-box';
const LOCAL_GAS_CELL_PRESSURE_FIELD_MODE = 'local-gas-cell-pressure-gradient';
const LOCAL_GAS_CELL_PRESSURE_FIELD_RESOLUTION = 'structured-gas-cell-grid';
const RESIDENT_SPATIAL_GAS_SPECIES_LEDGER_SCHEMA = 'peercompute.ulg.sph-spatial-gas-species-ledger.v0';
const LOCAL_PRESSURE_GRADIENT_BLOCKERS = Object.freeze([
  'single-cell-uniform-pressure-field',
  'resident-gas-cell-eos-gradient-not-derived'
]);

function nowMs() {
  return typeof globalThis.performance?.now === 'function'
    ? globalThis.performance.now()
    : Date.now();
}

function bucketFinite(value, quantum) {
  if (value == null || value === '') return null;
  const number = Number(value);
  const q = Number(quantum);
  if (!Number.isFinite(number) || !(q > 0)) return null;
  return Number((Math.round(number / q) * q).toPrecision(10));
}

function positiveOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function lawGroupEnabled(value, fallback = true) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return !/^(0|false|off|no)$/i.test(String(value).trim());
}

export function normalizeSphPhysicalLawGroups(groups = null) {
  return Object.fromEntries(
    Object.entries(DEFAULT_SPH_PHYSICAL_LAW_GROUPS).map(([key, fallback]) => [
      key,
      lawGroupEnabled(groups?.[key], fallback)
    ])
  );
}

export function pendingSphPhysicalLawGroups(groups = null) {
  const normalized = normalizeSphPhysicalLawGroups(groups);
  return Object.entries(PENDING_SPH_PHYSICAL_LAW_GROUPS)
    .filter(([key]) => normalized[key])
    .map(([key, reason]) => ({
      key,
      status: 'pending-unimplemented-physical-law-group',
      reason
    }));
}

function volumeEquivalentSphereRadiusM(volumeM3) {
  const volume = Number(volumeM3);
  if (!(volume > 0)) return 0;
  return Math.cbrt((3 * volume) / (4 * Math.PI));
}

function sphereVolumeFromRadiusM(radiusM) {
  const radius = Number(radiusM);
  if (!(radius > 0)) return 0;
  return (4 * Math.PI * radius ** 3) / 3;
}

function materialEntityVolumeM3({ densityKgPerM3, molarMassKgPerMol } = {}) {
  const density = Number(densityKgPerM3);
  const molarMass = Number(molarMassKgPerMol);
  if (!(density > 0) || !(molarMass > 0)) return 0;
  return molarMass / (density * AVOGADRO_COUNT);
}

function phaseVolumeReferenceDensityRecord(props, phaseName, densityKgPerM3) {
  const currentDensity = Math.max(Number(densityKgPerM3) || 0, 0);
  const normalizedPhase = String(phaseName || '').toLowerCase();
  if (!PHASE_VOLUME_EXPANSIVE_PHASE_NAMES.has(normalizedPhase)) {
    return {
      densityKgPerM3: currentDensity,
      phase: normalizedPhase || null,
      source: 'current-phase-density'
    };
  }
  const condensed = Array.isArray(props?.phases)
    ? props.phases
      .map((phase) => ({
        phase: String(phase?.name || '').toLowerCase(),
        densityKgPerM3: Math.max(Number(phase?.densityKgPerM3) || 0, 0)
      }))
      .filter((phase) => (
        phase.densityKgPerM3 > 0
        && !PHASE_VOLUME_EXPANSIVE_PHASE_NAMES.has(phase.phase)
      ))
    : [];
  const reference = condensed.reduce(
    (best, phase) => phase.densityKgPerM3 > best.densityKgPerM3 ? phase : best,
    { phase: null, densityKgPerM3: 0 }
  );
  if (reference.densityKgPerM3 > 0) {
    return {
      densityKgPerM3: reference.densityKgPerM3,
      phase: reference.phase,
      source: 'condensed-phase-density-for-ss-phase-volume-reference'
    };
  }
  return {
    densityKgPerM3: currentDensity,
    phase: normalizedPhase || null,
    source: 'current-gas-density-no-condensed-reference'
  };
}

function particleSizeStateFromVolume({
  material = null,
  role = null,
  temperatureK = null,
  restDensityKgPerM3 = null,
  restVolumeM3,
  mechanicsRestVolumeM3 = null,
  volumeRatioJ = 1,
  pressurePa = 0,
  source = 'material-temperature-rest-density'
} = {}) {
  const restVolume = Math.max(Number(restVolumeM3) || 0, 0);
  const mechanicsRestVolume = Number(mechanicsRestVolumeM3);
  const volumeRatio = Math.max(Number(volumeRatioJ) || 1, 1e-12);
  const currentVolumeM3 = restVolume * volumeRatio;
  return {
    schema: 'peercompute.ulg.sph-particle-size-state.v0',
    status: Math.abs(volumeRatio - 1) > 1e-12
      ? 'pressure-adjusted-current-volume'
      : 'rest-volume',
    source,
    material,
    role,
    temperatureK: Number.isFinite(Number(temperatureK)) ? Number(temperatureK) : null,
    restDensityKgPerM3: Number.isFinite(Number(restDensityKgPerM3)) ? Number(restDensityKgPerM3) : null,
    pressurePa: Math.max(Number(pressurePa) || 0, 0),
    restVolumeM3: restVolume,
    mechanicsRestVolumeM3: Number.isFinite(mechanicsRestVolume) && mechanicsRestVolume > 0
      ? mechanicsRestVolume
      : null,
    currentVolumeM3,
    volumeRatioJ: volumeRatio,
    restParticleRadiusM: volumeEquivalentSphereRadiusM(restVolume),
    particleRadiusM: volumeEquivalentSphereRadiusM(currentVolumeM3),
    currentParticleRadiusM: volumeEquivalentSphereRadiusM(currentVolumeM3)
  };
}

function fillCube({
  material,
  role = null,
  min,
  size,
  spacing,
  particlesPerEdge,
  temperatureK,
  pressurePa = PHYSICAL_CONSTANTS.standardAtmospherePa,
  properties,
  densityKgPerM3,
  particleSizePlan = null
}) {
  const particles = [];
  // particlesPerEdge sets the resolution directly (N -> N^3 particles); else derive from spacing.
  const n = Math.max(1, particlesPerEdge != null ? Math.round(particlesPerEdge) : Math.round(size / spacing));
  const step = size / n;
  const cellVolume = step * step * step;
  const massKg = densityKgPerM3 * cellVolume;
  const phaseVolumeReferenceDensityKgPerM3 = Math.max(
    Number(particleSizePlan?.phaseVolumeReferenceDensityKgPerM3) || densityKgPerM3,
    0
  );
  const phaseVolumeReferenceMassKg = Number(particleSizePlan?.phaseVolumeReferenceMassKg) > 0
    ? Number(particleSizePlan.phaseVolumeReferenceMassKg)
    : phaseVolumeReferenceDensityKgPerM3 * cellVolume;
  const phaseVolumeReferenceVolumeM3 = densityKgPerM3 > 0
    ? phaseVolumeReferenceMassKg / densityKgPerM3
    : cellVolume;
  const phaseVolumeReferenceMassRatio = massKg > 0
    ? phaseVolumeReferenceMassKg / massKg
    : null;
  const visualRestVolumeM3 = Number(particleSizePlan?.restVolumeM3) > 0
    ? Number(particleSizePlan.restVolumeM3)
    : cellVolume;
  const initialParticleSizeState = particleSizeStateFromVolume({
    material,
    role,
    temperatureK,
    restDensityKgPerM3: densityKgPerM3,
    pressurePa,
    restVolumeM3: visualRestVolumeM3,
    mechanicsRestVolumeM3: cellVolume,
    source: particleSizePlan?.particleSizeSource || 'material-state-temperature-pressure-relative-particle-size'
  });
  const particleRadiusM = initialParticleSizeState.restParticleRadiusM;
  const u = specificInternalEnergyJPerKg(properties, temperatureK);
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      for (let k = 0; k < n; k += 1) {
        const particleSizeState = { ...initialParticleSizeState };
        particles.push({
          material,
          role,
          x: [min[0] + (i + 0.5) * step, min[1] + (j + 0.5) * step, min[2] + (k + 0.5) * step],
          v: [0, 0, 0],
          massKg,
          specificInternalEnergyJPerKg: u,
          temperatureK,
          restDensityKgPerM3: densityKgPerM3, // initial rest density (sets the MLS-MPM particle volume)
          pressurePa,
          phaseVolumeReferenceDensityKgPerM3,
          phaseVolumeReferenceMassKg,
          phaseVolumeReferenceVolumeM3,
          phaseVolumeReferenceMassRatio,
          phaseVolumeReferenceDensitySource:
            particleSizePlan?.phaseVolumeReferenceDensitySource || null,
          phaseVolumeReferencePhase:
            particleSizePlan?.phaseVolumeReferencePhase || null,
          initialParticleSpacingM: step,
          initialCellVolumeM3: cellVolume,
          continuumCellVolumeM3: cellVolume,
          visualRestVolumeM3,
          visualParticleRadiusM: particleRadiusM,
          visualRestParticleRadiusM: particleRadiusM,
          materialReferenceParticleRadiusM: Number(particleSizePlan?.materialReferenceParticleRadiusM) || null,
          materialStateEntityVolumeM3: Number(particleSizePlan?.materialStateEntityVolumeM3) || null,
          materialVisualScale: Number(particleSizePlan?.materialVisualScale) || null,
          particleRadiusM,
          restParticleRadiusM: particleRadiusM,
          currentCellVolumeM3: particleSizeState.currentVolumeM3,
          currentParticleRadiusM: particleSizeState.currentParticleRadiusM,
          particleSizeState
        });
      }
    }
  }
  return particles;
}

function positiveParticleEdge(value, fallback = 1) {
  return Math.max(1, Math.round(Number.isFinite(Number(value)) ? Number(value) : fallback));
}

function smoothingLengthRatioForTargetNeighborCount(targetNeighborCount) {
  const count = Math.max(1, Number(targetNeighborCount) || DEFAULT_INITIAL_TARGET_NEIGHBOR_COUNT);
  // Approximate simple-cubic neighbor count inside the cubic-spline support sphere:
  // N ~= (4 / 3) * pi * (2h / dx)^3.
  return Math.cbrt((3 * count) / (32 * Math.PI));
}

function resolveInitialParticleSpacingPlan({
  dropSizeM,
  baseSizeM,
  dropDensityKgPerM3,
  baseDensityKgPerM3,
  dropMaterialState = null,
  baseMaterialState = null,
  pressurePa = PHYSICAL_CONSTANTS.standardAtmospherePa,
  dropRequestedParticlesPerEdge,
  baseRequestedParticlesPerEdge,
  adaptiveParticleSpacing = true,
  matchingMaterialState = false,
  targetNeighborCount = DEFAULT_INITIAL_TARGET_NEIGHBOR_COUNT,
  maxSmoothingLengthRatio = DEFAULT_INITIAL_MAX_SMOOTHING_LENGTH_RATIO
}) {
  const dropRequested = positiveParticleEdge(dropRequestedParticlesPerEdge, 3);
  const baseRequested = positiveParticleEdge(baseRequestedParticlesPerEdge, 5);
  const neighborTarget = Math.max(1, Number(targetNeighborCount) || DEFAULT_INITIAL_TARGET_NEIGHBOR_COUNT);
  const smoothingLengthRatio = smoothingLengthRatioForTargetNeighborCount(neighborTarget);
  const smoothingLengthRatioCap = Math.max(smoothingLengthRatio, Number(maxSmoothingLengthRatio) || DEFAULT_INITIAL_MAX_SMOOTHING_LENGTH_RATIO);
  const dropVolumeM3 = Math.max(dropSizeM, 0) ** 3;
  const baseVolumeM3 = Math.max(baseSizeM, 0) ** 3;
  const dropDensity = Math.max(Number(dropDensityKgPerM3) || 0, 1e-9);
  const baseDensity = Math.max(Number(baseDensityKgPerM3) || 0, 1e-9);
  const requestedParticleBudget = dropRequested ** 3 + baseRequested ** 3;
  const referenceTotalMassKg = dropDensity * dropVolumeM3 + baseDensity * baseVolumeM3;
  const referenceTargetParticleMassKg = referenceTotalMassKg / Math.max(1, requestedParticleBudget);
  const referenceTargetDensity = referenceTotalMassKg / Math.max(dropVolumeM3 + baseVolumeM3, 1e-9);
  const referenceTargetSpacingM = Math.cbrt(referenceTargetParticleMassKg / Math.max(referenceTargetDensity, 1e-9));
  // A particle is a fixed quantum of matter: the spacing derives from the
  // scenario's reference base block sampled at the DEFAULT base edge and is
  // COUNT-INDEPENDENT. Initial block volume therefore scales with the
  // requested particle counts (blockEdge = N x quantum spacing), instead of
  // squeezing more particles into a fixed reference block - raising an edge
  // count adds matter rather than shrinking particles.
  const referenceQuantumSpacingM = baseSizeM > 0
    ? baseSizeM / DEFAULT_REFERENCE_BASE_PARTICLES_PER_EDGE
    : referenceTargetSpacingM;
  const globalParticleSpacingM = referenceQuantumSpacingM > 0
    ? referenceQuantumSpacingM
    : referenceTargetSpacingM;
  const globalParticleVolumeM3 = globalParticleSpacingM ** 3;
  const globalParticleRadiusM = 0.5 * globalParticleSpacingM;
  const globalVisualParticleVolumeM3 = sphereVolumeFromRadiusM(globalParticleRadiusM);

  const withSupportMetadata = (row) => {
    const spacingM = Number(row.spacingM);
    const targetSmoothingLengthM = spacingM > 0 ? spacingM * smoothingLengthRatio : 0;
    const continuumCellVolumeM3 = spacingM > 0 ? spacingM ** 3 : 0;
    const density = Math.max(Number(row.densityKgPerM3) || 0, 0);
    const particleMassKg = density * continuumCellVolumeM3;
    const phaseVolumeReferenceDensityRecord = {
      densityKgPerM3: Math.max(
        Number(row.materialState?.phaseVolumeReferenceDensityKgPerM3) || density,
        0
      ),
      source: row.materialState?.phaseVolumeReferenceDensitySource || 'current-phase-density',
      phase: row.materialState?.phaseVolumeReferencePhase || row.materialState?.phase || null
    };
    const phaseVolumeReferenceMassKg =
      phaseVolumeReferenceDensityRecord.densityKgPerM3 * continuumCellVolumeM3;
    const phaseVolumeReferenceVolumeM3 = density > 0
      ? phaseVolumeReferenceMassKg / density
      : continuumCellVolumeM3;
    const materialStateEntityVolumeM3 = materialEntityVolumeM3({
      densityKgPerM3: density,
      molarMassKgPerMol: row.materialState?.molarMassKgPerMol
    });
    const materialReferenceParticleRadiusM = volumeEquivalentSphereRadiusM(materialStateEntityVolumeM3);
    return {
      ...row,
      targetSmoothingLengthM,
      targetNeighborCount: neighborTarget,
      continuumCellVolumeM3,
      mechanicsRestVolumeM3: continuumCellVolumeM3,
      restVolumeM3: globalVisualParticleVolumeM3,
      particleMassKg,
      phaseVolumeReferenceDensityKgPerM3: phaseVolumeReferenceDensityRecord.densityKgPerM3,
      phaseVolumeReferenceMassKg,
      phaseVolumeReferenceVolumeM3,
      phaseVolumeReferenceMassRatio: particleMassKg > 0
        ? phaseVolumeReferenceMassKg / particleMassKg
        : null,
      phaseVolumeReferenceDensitySource: phaseVolumeReferenceDensityRecord.source,
      phaseVolumeReferencePhase: phaseVolumeReferenceDensityRecord.phase,
      materialStateRestVolumeM3: continuumCellVolumeM3,
      materialStateEntityVolumeM3,
      materialReferenceParticleRadiusM,
      materialStateParticleRadiusM: globalParticleRadiusM,
      pressurePa: Number.isFinite(Number(row.pressurePa)) ? Number(row.pressurePa) : pressurePa,
      volumeRatioJ: 1,
      volumeEquivalentParticleRadiusM: globalParticleRadiusM,
      pressureAdjustedParticleRadiusM: globalParticleRadiusM,
      materialParticleDiameterM: globalParticleSpacingM,
      blockSizeSource: 'global-particle-spacing-times-particles-per-edge',
      particleSizeSource: 'global-particle-volume-material-density-mass'
    };
  };
  const resolveRole = ({ role, sizeM, densityKgPerM3, materialState, requestedParticlesPerEdge }) => {
    const uniformSpacingM = globalParticleSpacingM;
    const blockEdgeM = uniformSpacingM * requestedParticlesPerEdge;
    const fixedRequestedRow = (status) => withSupportMetadata({
      role,
      referenceBlockEdgeM: sizeM,
      blockEdgeM,
      blockVolumeM3: blockEdgeM ** 3,
      requestedParticlesPerEdge,
      particlesPerEdge: requestedParticlesPerEdge,
      spacingM: uniformSpacingM,
      uniformSpacingM,
      desiredParticlesPerEdge: requestedParticlesPerEdge,
      densityKgPerM3,
      materialState,
      phase: materialState?.phase ?? null,
      densitySource: materialState?.densitySource ?? null,
      pressurePa: materialState?.pressurePa ?? pressurePa,
      effectiveParticleEdgeStatus: status,
      requestedParticleEdgeLowerBoundApplied: false
    });
    if (!adaptiveParticleSpacing) {
      return fixedRequestedRow('fixed-requested-particles-per-edge');
    }
    const desiredSpacingM = globalParticleSpacingM;
    return withSupportMetadata({
      role,
      referenceBlockEdgeM: sizeM,
      blockEdgeM,
      blockVolumeM3: blockEdgeM ** 3,
      requestedParticlesPerEdge,
      particlesPerEdge: requestedParticlesPerEdge,
      spacingM: uniformSpacingM,
      uniformSpacingM,
      desiredSpacingM,
      desiredParticlesPerEdge: requestedParticlesPerEdge,
      referenceBlockParticlesPerEdge: sizeM / Math.max(globalParticleSpacingM, 1e-9),
      adaptiveParticlesPerEdge: requestedParticlesPerEdge,
      adaptiveSuggestedParticlesPerEdge: requestedParticlesPerEdge,
      adaptiveWouldAdjustParticlesPerEdge: false,
      adaptiveParticleSizingDeferred: true,
      densityKgPerM3,
      materialState,
      phase: materialState?.phase ?? null,
      densitySource: materialState?.densitySource ?? null,
      pressurePa: materialState?.pressurePa ?? pressurePa,
      effectiveParticleEdgeStatus: 'requested-particle-edge-preserved',
      requestedParticleEdgeLowerBoundApplied: false
    });
  };

  let drop = resolveRole({
    role: 'drop',
    sizeM: dropSizeM,
    densityKgPerM3: dropDensity,
    materialState: dropMaterialState,
    requestedParticlesPerEdge: dropRequested
  });
  let base = resolveRole({
    role: 'base',
    sizeM: baseSizeM,
    densityKgPerM3: baseDensity,
    materialState: baseMaterialState,
    requestedParticlesPerEdge: baseRequested
  });
  let matchingMaterialStateSpacingUnified = Boolean(
    matchingMaterialState
    && Math.abs(drop.spacingM - base.spacingM) <= 1e-9
  );
  drop.matchingMaterialStateSpacingUnified = matchingMaterialStateSpacingUnified;
  base.matchingMaterialStateSpacingUnified = matchingMaterialStateSpacingUnified;
  const roleSpacingM = [drop.spacingM, base.spacingM].filter((value) => Number.isFinite(value) && value > 0);
  const minSpacingM = roleSpacingM.length ? Math.min(...roleSpacingM) : 0;
  const uncappedSmoothingLengthM = Math.max(
    ...[drop.spacingM, base.spacingM]
      .map((spacingM) => spacingM > 0 ? spacingM * smoothingLengthRatio : 0)
  );
  const smoothingLengthCapM = minSpacingM > 0 ? minSpacingM * smoothingLengthRatioCap : uncappedSmoothingLengthM;
  const smoothingLengthM = Math.min(uncappedSmoothingLengthM, smoothingLengthCapM || uncappedSmoothingLengthM);
  const estimateNeighborCount = (spacingM) => {
    if (!(spacingM > 0) || !(smoothingLengthM > 0)) return 0;
    return (4 / 3) * Math.PI * ((2 * smoothingLengthM) / spacingM) ** 3;
  };
  for (const row of [drop, base]) {
    row.targetSmoothingLengthM = row.spacingM > 0 ? row.spacingM * smoothingLengthRatio : 0;
    row.globalSmoothingLengthM = smoothingLengthM;
    row.globalSmoothingLengthRatio = row.spacingM > 0 ? smoothingLengthM / row.spacingM : 0;
    row.estimatedNeighborCount = estimateNeighborCount(row.spacingM);
  }
  const totalMassKg = (
    drop.particleMassKg * drop.particlesPerEdge ** 3
    + base.particleMassKg * base.particlesPerEdge ** 3
  );
  const totalBlockVolumeM3 = (drop.blockVolumeM3 || 0) + (base.blockVolumeM3 || 0);
  const targetParticleMassKg = totalMassKg / Math.max(1, requestedParticleBudget);
  const targetDensity = totalMassKg / Math.max(totalBlockVolumeM3, 1e-9);
  const targetSpacingM = Math.cbrt(targetParticleMassKg / Math.max(targetDensity, 1e-9));
  const minParticleRadiusM = Math.min(
    ...[drop.volumeEquivalentParticleRadiusM, base.volumeEquivalentParticleRadiusM]
      .filter((value) => Number.isFinite(value) && value > 0)
  );
  const relativeParticleSize = {
    schema: 'peercompute.ulg.sph-relative-particle-size-diagnostics.v0',
    source: 'fixed-global-particle-volume-material-density-derived-mass',
    dropToBaseRadiusRatio: base.volumeEquivalentParticleRadiusM > 0
      ? drop.volumeEquivalentParticleRadiusM / base.volumeEquivalentParticleRadiusM
      : null,
    baseToDropRadiusRatio: drop.volumeEquivalentParticleRadiusM > 0
      ? base.volumeEquivalentParticleRadiusM / drop.volumeEquivalentParticleRadiusM
      : null,
    dropRadiusRelativeToSmallest: minParticleRadiusM > 0
      ? drop.volumeEquivalentParticleRadiusM / minParticleRadiusM
      : null,
    baseRadiusRelativeToSmallest: minParticleRadiusM > 0
      ? base.volumeEquivalentParticleRadiusM / minParticleRadiusM
      : null,
    dropParticleMassKg: drop.particleMassKg,
    baseParticleMassKg: base.particleMassKg,
    dropToBaseMassRatio: base.particleMassKg > 0 ? drop.particleMassKg / base.particleMassKg : null,
    dropMaterialReferenceParticleRadiusM: drop.materialReferenceParticleRadiusM,
    baseMaterialReferenceParticleRadiusM: base.materialReferenceParticleRadiusM,
    dropToBaseMaterialReferenceRadiusRatio: base.materialReferenceParticleRadiusM > 0
      ? drop.materialReferenceParticleRadiusM / base.materialReferenceParticleRadiusM
      : null,
    globalParticleSpacingM,
    globalParticleVolumeM3,
    globalVisualParticleRadiusM: globalParticleRadiusM,
    globalVisualParticleVolumeM3
  };

  return {
    schema: 'peercompute.ulg.sph-initial-particle-spacing-plan.v0',
    status: adaptiveParticleSpacing
      ? 'requested-particle-edges-preserved-global-particle-volume'
      : 'fixed-requested-particles-per-edge-global-particle-volume',
    adaptiveParticleSpacing,
    targetNeighborCount: neighborTarget,
    smoothingLengthRatio,
    maxSmoothingLengthRatio: smoothingLengthRatioCap,
    smoothingLengthM,
    uncappedSmoothingLengthM,
    smoothingLengthCapM,
    smoothingLengthCapped: smoothingLengthM < uncappedSmoothingLengthM - 1e-12,
    matchingMaterialState: Boolean(matchingMaterialState),
    matchingMaterialStateSpacingUnified,
    matchingMaterialStateSpacingPlan: null,
    particleSizePolicy: {
      schema: 'peercompute.ulg.sph-initial-particle-size-policy.v0',
      status: 'global-particle-volume-material-density-derived-mass',
      source: 'initial-particle-spacing-plan',
      roleInputs: [
        'material',
        'temperature',
        'phase-rest-density',
        'requested-particles-per-edge',
        'reference-block-geometry'
      ],
      spacingModel: 'single-global-spacing-from-min-reference-block-edge-per-requested-edge',
      mechanicsRestVolumeModel: 'globalParticleSpacingM^3',
      visualRestVolumeModel: 'sphere(radius=globalParticleSpacingM/2)',
      massModel: 'phase-density-at-temperature-pressure * mechanicsRestVolumeM3',
      hierarchyPhaseVolumeReferenceMassModel: 'condensed-phase-reference-density * mechanicsRestVolumeM3 for expansive phases, current phase density otherwise',
      currentVolumeModel: 'visualRestVolumeM3 * volumeRatioJ',
      phaseChangeVolumeModel: 'fixed-particle-count-no-automatic-gas-expansion',
      gasExpansionHandling: 'gas mass and pressure use species ledgers/fields until an explicit gas-admission or adaptive split policy creates solver particles',
      pressureModel: 'zero-gauge-before-optional-hydrostatic-initialization',
      dynamicPressureSupported: true
    },
    requestedParticleBudget,
    targetParticleMassKg,
    targetSpacingM,
    totalMassKg,
    referenceTotalMassKg,
    referenceTargetParticleMassKg,
    referenceTargetSpacingM,
    pressurePa,
    relativeParticleSize,
    drop,
    base
  };
}

/**
 * Build the demo's initial SPH state: a larger ice cube resting on the box floor with a molten
 * iron cube on top, both filled with particles. Reduced resolution so the CPU reference carrier runs
 * interactively.
 */
// Rest density (kg/m^3) of the stable phase of a material at temperature T, from its closure — so
// each block starts at the correct packing for whatever material/phase it is (molten metal, ice,
// liquid water, ...).
function materialStateAtTemperaturePressure(props, temperatureK, pressurePa = PHYSICAL_CONSTANTS.standardAtmospherePa) {
  const pressure = Number.isFinite(Number(pressurePa)) && Number(pressurePa) > 0
    ? Number(pressurePa)
    : PHYSICAL_CONSTANTS.standardAtmospherePa;
  const molarMassKgPerMol = Number(props?.molarMassKgPerMol);
  if (props.idealGas) {
    const densityKgPerM3 = idealGasDensityKgPerM3({
      pressurePa: pressure,
      temperatureK,
      molarMassKgPerMol: props.molarMassKgPerMol
    });
    const phaseVolumeReference = phaseVolumeReferenceDensityRecord(props, 'gas', densityKgPerM3);
    return {
      phase: 'gas',
      densityKgPerM3,
      molarMassKgPerMol: molarMassKgPerMol > 0 ? molarMassKgPerMol : null,
      pressurePa: pressure,
      densitySource: 'material-ideal-gas-law-at-role-temperature-pressure',
      phaseVolumeReferenceDensityKgPerM3: phaseVolumeReference.densityKgPerM3,
      phaseVolumeReferenceDensitySource: phaseVolumeReference.source,
      phaseVolumeReferencePhase: phaseVolumeReference.phase,
      bulkModulusPa: null,
      pressureDensityAdjustment: null
    };
  }
  const u = specificInternalEnergyJPerKg(props, temperatureK);
  const phase = equilibriumFromSpecificEnergy(props, u).stablePhase;
  const ph = props.phases.find((p) => p.name === phase) || props.phases[0];
  const phaseName = ph?.name || phase || null;
  if (phaseName === 'gas' && props.molarMassKgPerMol > 0) {
    const densityKgPerM3 = idealGasDensityKgPerM3({
      pressurePa: pressure,
      temperatureK,
      molarMassKgPerMol: props.molarMassKgPerMol
    });
    const phaseVolumeReference = phaseVolumeReferenceDensityRecord(props, phaseName, densityKgPerM3);
    return {
      phase: phaseName,
      densityKgPerM3,
      molarMassKgPerMol: molarMassKgPerMol > 0 ? molarMassKgPerMol : null,
      pressurePa: pressure,
      densitySource: 'material-molar-mass-ideal-gas-law-at-role-temperature-pressure',
      phaseVolumeReferenceDensityKgPerM3: phaseVolumeReference.densityKgPerM3,
      phaseVolumeReferenceDensitySource: phaseVolumeReference.source,
      phaseVolumeReferencePhase: phaseVolumeReference.phase,
      bulkModulusPa: null,
      pressureDensityAdjustment: null
    };
  }
  const baseDensity = Number(ph?.densityKgPerM3);
  const bulkModulusPa = Number(ph?.bulkModulusPa ?? ph?.eos?.bulkModulusPa);
  const pressureDeltaPa = pressure - PHYSICAL_CONSTANTS.standardAtmospherePa;
  const pressureDensityFactor = bulkModulusPa > 0
    ? Math.exp(Math.max(-0.25, Math.min(0.25, pressureDeltaPa / bulkModulusPa)))
    : 1;
  const densityKgPerM3 = baseDensity > 0 ? baseDensity * pressureDensityFactor : 0;
  const phaseVolumeReference = phaseVolumeReferenceDensityRecord(props, phaseName, densityKgPerM3);
  return {
    phase: phaseName,
    densityKgPerM3,
    molarMassKgPerMol: molarMassKgPerMol > 0 ? molarMassKgPerMol : null,
    pressurePa: pressure,
    densitySource: bulkModulusPa > 0
      ? 'material-phase-density-temperature-with-bulk-modulus-pressure-correction'
      : 'material-phase-density-temperature',
    phaseVolumeReferenceDensityKgPerM3: phaseVolumeReference.densityKgPerM3,
    phaseVolumeReferenceDensitySource: phaseVolumeReference.source,
    phaseVolumeReferencePhase: phaseVolumeReference.phase,
    bulkModulusPa: bulkModulusPa > 0 ? bulkModulusPa : null,
    pressureDensityAdjustment: bulkModulusPa > 0
      ? {
        referencePressurePa: PHYSICAL_CONSTANTS.standardAtmospherePa,
        pressureDeltaPa,
        factor: pressureDensityFactor
      }
      : null
  };
}

function densityAtTemperatureKgPerM3(props, temperatureK, pressurePa = PHYSICAL_CONSTANTS.standardAtmospherePa) {
  const state = materialStateAtTemperaturePressure(props, temperatureK, pressurePa);
  return typeof state === 'number' ? state : state.densityKgPerM3;
}

function roleParticleEdgeDiagnostic(rolePlan, {
  requestedParticlesPerEdge,
  generatedParticleCount,
  blockEdgeM
} = {}) {
  const requested = positiveParticleEdge(requestedParticlesPerEdge);
  const effective = positiveParticleEdge(rolePlan?.particlesPerEdge, requested);
  const count = Math.max(0, Math.round(Number(generatedParticleCount) || 0));
  const expectedCount = effective ** 3;
  return {
    role: rolePlan?.role || null,
    requestedParticlesPerEdge: requested,
    effectiveParticlesPerEdge: effective,
    generatedParticleCount: count,
    expectedParticleCount: expectedCount,
    particleCountMatchesEffectiveEdge: count === expectedCount,
    blockEdgeM: Number.isFinite(Number(blockEdgeM)) ? Number(blockEdgeM) : null,
    spacingM: Number.isFinite(Number(rolePlan?.spacingM)) ? Number(rolePlan.spacingM) : null,
    uniformSpacingM: Number.isFinite(Number(rolePlan?.uniformSpacingM)) ? Number(rolePlan.uniformSpacingM) : null,
    continuumCellVolumeM3: Number.isFinite(Number(rolePlan?.continuumCellVolumeM3))
      ? Number(rolePlan.continuumCellVolumeM3)
      : null,
    visualRestVolumeM3: Number.isFinite(Number(rolePlan?.restVolumeM3)) ? Number(rolePlan.restVolumeM3) : null,
    particleRadiusM: Number.isFinite(Number(rolePlan?.volumeEquivalentParticleRadiusM))
      ? Number(rolePlan.volumeEquivalentParticleRadiusM)
      : null,
    densityKgPerM3: Number.isFinite(Number(rolePlan?.densityKgPerM3)) ? Number(rolePlan.densityKgPerM3) : null,
    pressurePa: Number.isFinite(Number(rolePlan?.pressurePa)) ? Number(rolePlan.pressurePa) : null,
    phase: rolePlan?.phase || null,
    densitySource: rolePlan?.densitySource || null,
    particleMassKg: Number.isFinite(Number(rolePlan?.particleMassKg)) ? Number(rolePlan.particleMassKg) : null,
    materialStateParticleRadiusM: Number.isFinite(Number(rolePlan?.materialStateParticleRadiusM))
      ? Number(rolePlan.materialStateParticleRadiusM)
      : null,
    materialReferenceParticleRadiusM: Number.isFinite(Number(rolePlan?.materialReferenceParticleRadiusM))
      ? Number(rolePlan.materialReferenceParticleRadiusM)
      : null,
    materialStateEntityVolumeM3: Number.isFinite(Number(rolePlan?.materialStateEntityVolumeM3))
      ? Number(rolePlan.materialStateEntityVolumeM3)
      : null,
    materialVisualScale: Number.isFinite(Number(rolePlan?.materialVisualScale))
      ? Number(rolePlan.materialVisualScale)
      : null,
    particleSizeSource: rolePlan?.particleSizeSource || null,
    effectiveParticleEdgeStatus: rolePlan?.effectiveParticleEdgeStatus || null,
    requestedParticleEdgeLowerBoundApplied: rolePlan?.requestedParticleEdgeLowerBoundApplied === true,
    matchingMaterialStateSpacingUnified: rolePlan?.matchingMaterialStateSpacingUnified === true
  };
}

function initialParticleEdgeDiagnostics({
  initialParticleSpacing,
  dropRequestedParticlesPerEdge,
  baseRequestedParticlesPerEdge,
  dropParticleCount,
  baseParticleCount,
  dropSizeM,
  baseSizeM
} = {}) {
  const drop = roleParticleEdgeDiagnostic(initialParticleSpacing?.drop, {
    requestedParticlesPerEdge: dropRequestedParticlesPerEdge,
    generatedParticleCount: dropParticleCount,
    blockEdgeM: dropSizeM
  });
  const base = roleParticleEdgeDiagnostic(initialParticleSpacing?.base, {
    requestedParticlesPerEdge: baseRequestedParticlesPerEdge,
    generatedParticleCount: baseParticleCount,
    blockEdgeM: baseSizeM
  });
  const matchingPlan = initialParticleSpacing?.matchingMaterialStateSpacingPlan || null;
  return {
    schema: 'peercompute.ulg.sph-initial-particle-edge-diagnostics.v0',
    status: drop.particleCountMatchesEffectiveEdge && base.particleCountMatchesEffectiveEdge
      ? 'initial-particle-edges-effective'
      : 'initial-particle-edge-count-mismatch',
    requestedDropParticlesPerEdge: drop.requestedParticlesPerEdge,
    requestedBaseParticlesPerEdge: base.requestedParticlesPerEdge,
    effectiveDropParticlesPerEdge: drop.effectiveParticlesPerEdge,
    effectiveBaseParticlesPerEdge: base.effectiveParticlesPerEdge,
    drop,
    base,
    totalGeneratedParticleCount: drop.generatedParticleCount + base.generatedParticleCount,
    matchingMaterialState: initialParticleSpacing?.matchingMaterialState === true,
    matchingMaterialStateSpacingUnified: initialParticleSpacing?.matchingMaterialStateSpacingUnified === true,
    matchingMaterialStateStrategy: matchingPlan?.strategy || null,
    preservedRequestedRole: matchingPlan?.preservedRequestedRole || null,
    requestedEdgePreservationStatus: matchingPlan?.requestedEdgePreservationStatus || (
      drop.effectiveParticlesPerEdge === drop.requestedParticlesPerEdge
      && base.effectiveParticlesPerEdge === base.requestedParticlesPerEdge
        ? 'preserved'
        : drop.requestedParticleEdgeLowerBoundApplied || base.requestedParticleEdgeLowerBoundApplied
        ? 'preserved'
        : 'not-requested'
    ),
    rejectedPreservedCandidates: matchingPlan?.rejectedPreservedCandidates || []
  };
}

function phasePropertiesFromParticle(properties, particle) {
  if (!properties?.phases?.length) return null;
  const phase = stablePhaseFromSpecificEnergy(properties, particle.specificInternalEnergyJPerKg);
  return properties.phases.find((candidate) => candidate.name === phase) || properties.phases[0];
}

function representativePhaseTemperatureK(phase) {
  if (Number.isFinite(phase?.temperatureK)) return phase.temperatureK;
  if (Array.isArray(phase?.temperatureRange) && phase.temperatureRange.length >= 2) {
    const lo = Number(phase.temperatureRange[0]);
    const hi = Number(phase.temperatureRange[1]);
    if (Number.isFinite(lo) && Number.isFinite(hi)) return (lo + hi) / 2;
    if (Number.isFinite(lo)) return lo;
    if (Number.isFinite(hi)) return hi;
  }
  return 293.15;
}

function realPhaseSoundSpeedMPerS(properties, phase) {
  const phaseName = String(phase?.name || '').toLowerCase();
  if (phaseName === 'gas') {
    const molarMassKgPerMol = Number(properties?.molarMassKgPerMol);
    if (!(molarMassKgPerMol > 0)) return 0;
    const specificGasConstant = AVOGADRO_R / molarMassKgPerMol;
    const cp = Number(phase?.cpJPerKgK);
    const gamma = Number.isFinite(cp) && cp > specificGasConstant
      ? cp / (cp - specificGasConstant)
      : 1.33;
    return Math.sqrt(Math.max(gamma * specificGasConstant * representativePhaseTemperatureK(phase), 0));
  }
  const bulk = Number(phase?.bulkModulusPa);
  const density = Number(phase?.densityKgPerM3);
  return bulk > 0 && density > 0 ? Math.sqrt(bulk / density) : 0;
}

function isotropicMpmFForJ(volumeRatioJ) {
  const s = Math.cbrt(Math.max(Number(volumeRatioJ) || 1, 1e-12));
  return new Float64Array([s, 0, 0, 0, s, 0, 0, 0, s]);
}

function initializeSupportedHydrostaticMpmState(demo, {
  gravityMPerS2 = [0, -9.80665, 0],
  modulusScale = 1,
  enabled = true
} = {}) {
  if (!enabled || !demo?.state?.particles?.length) {
    return { status: 'hydrostatic-initialization-disabled', initializedParticleCount: 0 };
  }
  const gY = Number(gravityMPerS2?.[1]);
  const gravityMagnitude = Number.isFinite(gY) ? Math.max(0, -gY) : 0;
  if (!(gravityMagnitude > 0)) {
    return { status: 'hydrostatic-initialization-zero-gravity', initializedParticleCount: 0 };
  }
  const groups = new Map();
  for (const particle of demo.state.particles) {
    const role = particle.role || 'unassigned';
    if (!groups.has(role)) groups.set(role, []);
    groups.get(role).push(particle);
  }

  let initializedParticleCount = 0;
  const initializedRoles = [];
  for (const [role, particles] of groups.entries()) {
    let lowerSurfaceY = Number.POSITIVE_INFINITY;
    let upperSurfaceY = Number.NEGATIVE_INFINITY;
    const particleRecords = [];
    for (const particle of particles) {
      const properties = demo.materialProperties[particle.material];
      const phase = phasePropertiesFromParticle(properties, particle);
      if (!phase || phase.name === 'gas') continue;
      const restDensity = Number(phase.densityKgPerM3 ?? particle.restDensityKgPerM3);
      const bulkRaw = Number(phase.bulkModulusPa);
      const massKg = Number(particle.massKg);
      if (!(restDensity > 0) || !(bulkRaw > 0) || !(massKg > 0)) continue;
      const restVolumeM3 = massKg / restDensity;
      const halfCellM = 0.5 * Math.cbrt(restVolumeM3);
      lowerSurfaceY = Math.min(lowerSurfaceY, particle.x[1] - halfCellM);
      upperSurfaceY = Math.max(upperSurfaceY, particle.x[1] + halfCellM);
      particleRecords.push({ particle, restDensity, restVolumeM3, halfCellM, hydrostaticBulkModulusPa: bulkRaw });
    }
    if (!particleRecords.length || !(lowerSurfaceY <= 1e-6)) continue;
    for (const record of particleRecords) {
      const { particle, restDensity, restVolumeM3, hydrostaticBulkModulusPa } = record;
      if (!(hydrostaticBulkModulusPa > 0)) continue;
      const depthM = Math.max(0, upperSurfaceY - particle.x[1]);
      const pressurePa = restDensity * gravityMagnitude * depthM;
      const volumeRatioJ = (pressurePa > 0)
        ? (1 + TAIT_EXPONENT * pressurePa / hydrostaticBulkModulusPa) ** (-1 / TAIT_EXPONENT)
        : 1;
      particle.mpmVolume0 = restVolumeM3;
      particle.mpmJ = volumeRatioJ;
      particle.mpmF = isotropicMpmFForJ(volumeRatioJ);
      particle.mpmC = new Float64Array(9);
      particle.hydrostaticPressurePa = pressurePa;
      const visualRestVolumeM3 = Number(particle.visualRestVolumeM3) > 0
        ? Number(particle.visualRestVolumeM3)
        : restVolumeM3;
      const particleSizeState = particleSizeStateFromVolume({
        material: particle.material,
        role,
        temperatureK: particle.temperatureK,
        restDensityKgPerM3: restDensity,
        restVolumeM3: visualRestVolumeM3,
        mechanicsRestVolumeM3: restVolumeM3,
        volumeRatioJ,
        pressurePa,
        source: 'hydrostatic-material-temperature-pressure-rest-density'
      });
      particle.restParticleRadiusM = particleSizeState.restParticleRadiusM;
      particle.currentCellVolumeM3 = particleSizeState.currentVolumeM3;
      particle.currentParticleRadiusM = particleSizeState.currentParticleRadiusM;
      particle.visualRestVolumeM3 = particleSizeState.restVolumeM3;
      particle.visualRestParticleRadiusM = particleSizeState.restParticleRadiusM;
      particle.visualParticleRadiusM = particleSizeState.currentParticleRadiusM;
      particle.pressureAdjustedParticleRadiusM = particleSizeState.particleRadiusM;
      particle.particleSizeState = particleSizeState;
      particle.hydrostaticInitialization = {
        schema: 'peercompute.ulg.sph-initial-hydrostatic-state.v0',
        status: 'initialized-supported-condensed-block',
        role,
        depthM,
        pressurePa,
        volumeRatioJ,
        restVolumeM3: visualRestVolumeM3,
        mechanicsRestVolumeM3: restVolumeM3,
        currentVolumeM3: particleSizeState.currentVolumeM3,
        restParticleRadiusM: particleSizeState.restParticleRadiusM,
        currentParticleRadiusM: particleSizeState.currentParticleRadiusM,
        volumeRatioModel: 'raw-closure-bulk-modulus'
      };
      initializedParticleCount += 1;
    }
    initializedRoles.push(role);
  }

  return {
    schema: 'peercompute.ulg.sph-initial-hydrostatic-summary.v0',
    status: initializedParticleCount > 0
      ? 'hydrostatic-initialization-applied'
      : 'hydrostatic-initialization-no-supported-condensed-blocks',
    initializedParticleCount,
    initializedRoles
  };
}

function resolveSingleMaterialClosure(key, {
  allowFixtureMaterialProperties = false,
  strictFirstPrinciplesMaterials = false
} = {}) {
  const spec = resolveMaterialSpec(key);
  // Default path: derived properties with phase boundaries anchored to the
  // reference bank (reference-fallback provenance, derivation residuals
  // retained). Strict mode reruns the pure lower-closure path per the
  // algorithm-derived-material-properties plan.
  if (!strictFirstPrinciplesMaterials) {
    return createReferenceAnchoredMaterialClosure(key, {
      elementOptions: { allowReducedEstimates: allowFixtureMaterialProperties }
    });
  }
  if (spec.phaseModel !== 'element') return createDerivedMaterialClosure(key);
  const Z = zForSymbol(key);
  const elementClosure = Z != null
    ? elementMaterialClosure(Z, { allowReducedEstimates: allowFixtureMaterialProperties })
    : null;
  if (elementClosure) return elementClosure;
  return createDerivedMaterialClosure(key);
}

function resolveInitialParticleSpacingMaterialBankWarmInputs({
  materialPropertyBank,
  dropMaterial,
  baseMaterial,
  dropTemperatureK,
  baseTemperatureK
} = {}) {
  if (!materialPropertyBank) return null;
  const bank = normalizeMaterialPropertyBank(materialPropertyBank);
  const missingRoles = [];
  const warmInputForRole = (role, material, temperatureK) => {
    const record = materialPropertyBankRecordBySymbol(bank, material);
    if (!record) {
      missingRoles.push({ role, material, reason: 'material-bank-row-not-found' });
      return null;
    }
    return {
      ...materialPropertyBankWarmInput(record, {
        temperatureK,
        bankFamily: bank.bankFamily,
        bankSchemaVersion: bank.schemaVersion,
        generatorFingerprint: bank.generatorFingerprint
      }),
      role,
      requestedMaterial: material
    };
  };
  const roles = {
    drop: warmInputForRole('drop', dropMaterial, dropTemperatureK),
    base: warmInputForRole('base', baseMaterial, baseTemperatureK)
  };
  const coveredRoleCount = Object.values(roles).filter(Boolean).length;
  return {
    schema: 'peercompute.ulg.sph-initial-particle-spacing-material-bank-warm-inputs.v0',
    status: coveredRoleCount > 0
      ? 'material-bank-warm-inputs-attached'
      : 'material-bank-warm-inputs-no-matching-rows',
    strictSourceOfTruth: false,
    bankFamily: bank.bankFamily,
    bankSchemaVersion: bank.schemaVersion,
    generatorFingerprint: bank.generatorFingerprint,
    coveredRoleCount,
    missingRoles,
    roles
  };
}

function stateInCrystalStructureValidity(record, { temperatureK, pressurePa }) {
  const inRange = (range, value) => {
    if (!Array.isArray(range) || range.length !== 2) return false;
    const min = Number(range[0]);
    const max = Number(range[1]);
    const candidate = Number(value);
    return Number.isFinite(min)
      && Number.isFinite(max)
      && Number.isFinite(candidate)
      && candidate >= min
      && candidate <= max;
  };
  return inRange(record?.validity?.temperatureRangeK, temperatureK)
    && inRange(record?.validity?.pressureRangePa, pressurePa);
}

function resolveInitialParticleSpacingMaterialCrystalStructureWarmInputs({
  materialPropertyCrystalStructureBank,
  dropMaterial,
  baseMaterial,
  dropTemperatureK,
  baseTemperatureK,
  pressurePa = PHYSICAL_CONSTANTS.standardAtmospherePa
} = {}) {
  if (!materialPropertyCrystalStructureBank) return null;
  const bank = normalizeMaterialPropertyCrystalStructureBank(materialPropertyCrystalStructureBank);
  const missingRoles = [];
  const warmInputForRole = (role, material, temperatureK) => {
    const records = materialPropertyCrystalStructuresForSymbol(bank, material, { phase: 'solid' });
    if (records.length === 0) {
      missingRoles.push({ role, material, reason: 'material-crystal-structure-row-not-found' });
      return null;
    }
    const record = records.find((candidate) => stateInCrystalStructureValidity(candidate, {
      temperatureK,
      pressurePa
    }));
    if (!record) {
      missingRoles.push({
        role,
        material,
        reason: 'material-crystal-structure-row-not-valid-for-state',
        temperatureK,
        pressurePa,
        structureKeys: records.map((candidate) => candidate.structureKey)
      });
      return null;
    }
    return {
      schema: 'peercompute.ulg.sph-initial-particle-spacing-material-crystal-structure-warm-input.v0',
      status: 'material-crystal-structure-warm-input-ready',
      strictSourceOfTruth: false,
      role,
      requestedMaterial: material,
      material: record.symbol,
      phase: record.phase,
      structureKey: record.structureKey,
      structureName: record.structureName,
      strukturbericht: record.strukturbericht ?? null,
      crystalSystem: record.crystalSystem,
      spaceGroup: cloneJson(record.spaceGroup),
      latticeConstants: cloneJson(record.latticeConstants),
      unitCell: cloneJson(record.unitCell),
      validity: cloneJson(record.validity),
      fallbackPolicy: cloneJson(record.fallbackPolicy),
      temperatureK,
      pressurePa,
      bankFamily: bank.bankFamily,
      bankSchemaVersion: bank.schemaVersion,
      generatorFingerprint: bank.generatorFingerprint,
      provenance: {
        source: 'precomputed-json-bank-crystal-structure',
        generatorFingerprint: bank.generatorFingerprint,
        entries: cloneJson(record.provenance)
      }
    };
  };
  const roles = {
    drop: warmInputForRole('drop', dropMaterial, dropTemperatureK),
    base: warmInputForRole('base', baseMaterial, baseTemperatureK)
  };
  const coveredRoleCount = Object.values(roles).filter(Boolean).length;
  return {
    schema: 'peercompute.ulg.sph-initial-particle-spacing-material-crystal-structure-warm-inputs.v0',
    status: coveredRoleCount > 0
      ? 'material-crystal-structure-warm-inputs-attached'
      : 'material-crystal-structure-warm-inputs-no-valid-rows',
    strictSourceOfTruth: false,
    bankFamily: bank.bankFamily,
    bankSchemaVersion: bank.schemaVersion,
    generatorFingerprint: bank.generatorFingerprint,
    coveredRoleCount,
    missingRoles,
    roles
  };
}

/**
 * Build the demo's initial SPH state: a `baseMaterial` block resting on the box floor (cold) and a
 * `dropMaterial` block above it (hot, so it starts molten/liquid) that falls onto it. The two
 * block materials are selectable (default iron-on-water); each block's particle mass uses the rest
 * density of its material's stable phase at its role temperature. Reduced resolution so the CPU
 * reference carrier runs interactively.
 */
export function buildSphPhaseDemoState({
  scenario = createSphPhaseScenario(),
  closures = null,
  allowFixtureMaterialProperties = false,
  dropMaterial = 'fe',
  baseMaterial = 'h2o',
  dropTemperatureK,
  baseTemperatureK,
  dropParticleEdge = 3, // N -> N^3 particles in the drop block
  baseParticleEdge = 5, // N -> N^3 particles in the base block
  adaptiveParticleSpacing = true,
  initialTargetNeighborCount = DEFAULT_INITIAL_TARGET_NEIGHBOR_COUNT,
  initialMaxSmoothingLengthRatio = DEFAULT_INITIAL_MAX_SMOOTHING_LENGTH_RATIO,
  materialPropertyBank = DEFAULT_MATERIAL_PROPERTY_BANK,
  materialPropertyCrystalStructureBank = DEFAULT_MATERIAL_PROPERTY_CRYSTAL_STRUCTURE_BANK,
  iceBaseHeightM,
  ironBaseHeightM
} = {}) {
  const baseClosures = {
    ...(allowFixtureMaterialProperties ? createReferenceMaterialClosures() : {}),
    ...(closures || {})
  };
  // Box is a rectangular cuboid [Lx, Ly, Lz] (configurable per axis); a scalar edge stays cubic.
  const boxDims = scenario.box.dimensionsM ?? [scenario.box.edgeM, scenario.box.edgeM, scenario.box.edgeM];
  const referenceIronEdge = scenario.iron.edgeM;
  const referenceIceEdge = scenario.ice.edgeM;
  const cx = boxDims[0] / 2;
  const cz = boxDims[2] / 2;

  // Configurable starting elevation (bottom face) of each block. The base block defaults to resting
  // on the floor; the drop block default is resolved after material particle sizes are known.
  const iceBase = iceBaseHeightM ?? 0;

  // Resolve each block's material to a closure: the reference closures (fe/h2o/air) or, for any
  // other element symbol, a closure DERIVED on the fly from the simulation (elementMaterialClosure:
  // jellium + atomic DFT + universal rules). No per-material reference tables.
  const resolved = { ...baseClosures };
  const requiredMaterialKeys = [...new Set([
    ...DEFAULT_RUNTIME_MATERIAL_KEYS,
    dropMaterial,
    baseMaterial
  ].filter(Boolean))];
  for (const key of requiredMaterialKeys) {
    if (resolved[key]) continue;
    try {
      resolved[key] = resolveSingleMaterialClosure(key, { allowFixtureMaterialProperties });
      continue;
    } catch {
      throw new MaterialFirstPrinciplesResolutionError(
        `No first-principles material closure for '${key}'`,
        {
          material: key,
          context: 'buildSphPhaseDemoState',
          blockers: ['first-principles-material-closure-not-produced']
        }
      );
    }
  }
  if (!allowFixtureMaterialProperties) {
    for (const [key, closure] of Object.entries(resolved)) {
      requireFirstPrinciplesMaterialProperties(closure.properties, {
        material: key,
        context: 'buildSphPhaseDemoState',
        allowedFallbackSources: ['material-property-reference-bank']
      });
    }
  }
  const dropProps = resolved[dropMaterial].properties;
  const baseProps = resolved[baseMaterial].properties;
  // Initial temperatures: explicit overrides, else the scenario's hot drop / cold base roles. A
  // molten-drop role resolves against the material's own derived liquidus, not a reference Fe
  // constant, so any selected material starts in its closure-derived liquid phase by default.
  const liquidus = dropProps.transitions?.find((t) => t.from === 'solid' && t.to === 'liquid')?.temperatureK ?? null;
  const requestedDropTempK = dropTemperatureK ?? scenario.iron.initialTemperatureK;
  const dropTempK = dropTemperatureK == null && liquidus != null
    ? Math.max(requestedDropTempK, liquidus + 39)
    : requestedDropTempK;
  const baseTempK = baseTemperatureK ?? scenario.ice.initialTemperatureK;
  const initialPressurePa = scenario.gas.pressurePa ?? PHYSICAL_CONSTANTS.standardAtmospherePa;
  const dropMaterialState = materialStateAtTemperaturePressure(dropProps, dropTempK, initialPressurePa);
  const baseMaterialState = materialStateAtTemperaturePressure(baseProps, baseTempK, initialPressurePa);
  const dropDensityKgPerM3 = dropMaterialState.densityKgPerM3;
  const baseDensityKgPerM3 = baseMaterialState.densityKgPerM3;
  const matchingMaterialState = String(dropMaterial).toLowerCase() === String(baseMaterial).toLowerCase()
    && Math.abs(dropTempK - baseTempK) <= 1e-6
    && Math.abs(dropDensityKgPerM3 - baseDensityKgPerM3) <= Math.max(1e-6, Math.abs(baseDensityKgPerM3) * 1e-6);
  const initialParticleSpacing = resolveInitialParticleSpacingPlan({
    dropSizeM: referenceIronEdge,
    baseSizeM: referenceIceEdge,
    dropDensityKgPerM3,
    baseDensityKgPerM3,
    dropMaterialState,
    baseMaterialState,
    pressurePa: initialPressurePa,
    dropRequestedParticlesPerEdge: dropParticleEdge,
    baseRequestedParticlesPerEdge: baseParticleEdge,
    adaptiveParticleSpacing,
    matchingMaterialState,
    targetNeighborCount: initialTargetNeighborCount,
    maxSmoothingLengthRatio: initialMaxSmoothingLengthRatio
  });
  const materialBankWarmInputs = resolveInitialParticleSpacingMaterialBankWarmInputs({
    materialPropertyBank,
    dropMaterial,
    baseMaterial,
    dropTemperatureK: dropTempK,
    baseTemperatureK: baseTempK
  });
  const materialCrystalStructureWarmInputs = resolveInitialParticleSpacingMaterialCrystalStructureWarmInputs({
    materialPropertyCrystalStructureBank,
    dropMaterial,
    baseMaterial,
    dropTemperatureK: dropTempK,
    baseTemperatureK: baseTempK
  });
  if (materialCrystalStructureWarmInputs) {
    initialParticleSpacing.materialPropertyCrystalStructureWarmInputs = materialCrystalStructureWarmInputs;
    initialParticleSpacing.particleSizePolicy.materialCrystalStructureWarmInputStatus =
      materialCrystalStructureWarmInputs.status;
    initialParticleSpacing.particleSizePolicy.materialCrystalStructureCoveredRoleCount =
      materialCrystalStructureWarmInputs.coveredRoleCount;
  }
  if (materialBankWarmInputs) {
    initialParticleSpacing.materialPropertyBankWarmInputs = materialBankWarmInputs;
    initialParticleSpacing.materialPropertyBankGpuWarmInputTable =
      buildMaterialPropertyBankGpuWarmInputTable(materialBankWarmInputs);
    initialParticleSpacing.materialPropertyBankParticleSizePackingTable =
      buildMaterialPropertyBankParticleSizePackingTable(initialParticleSpacing);
    initialParticleSpacing.particleSizePolicy.materialPropertyBankWarmInputStatus = materialBankWarmInputs.status;
    initialParticleSpacing.particleSizePolicy.materialPropertyBankCoveredRoleCount =
      materialBankWarmInputs.coveredRoleCount;
    initialParticleSpacing.particleSizePolicy.materialPropertyBankGpuWarmInputRowCount =
      initialParticleSpacing.materialPropertyBankGpuWarmInputTable.rowCount;
    initialParticleSpacing.particleSizePolicy.materialPropertyBankParticleSizePackingRowCount =
      initialParticleSpacing.materialPropertyBankParticleSizePackingTable.rowCount;
  }
  initialParticleSpacing.algorithmMaterialParticleInitializationRows =
    buildAlgorithmMaterialParticleInitializationRows({
      initialParticleSpacing,
      dropMaterial,
      baseMaterial,
      dropTemperatureK: dropTempK,
      baseTemperatureK: baseTempK
    });
  initialParticleSpacing.particleSizePolicy.algorithmMaterialParticleInitializationRowCount =
    initialParticleSpacing.algorithmMaterialParticleInitializationRows.rowCount;
  initialParticleSpacing.particleSizePolicy.algorithmMaterialParticleInitializationStatus =
    initialParticleSpacing.algorithmMaterialParticleInitializationRows.status;

  const dropBlockEdgeM = Number(initialParticleSpacing.drop.blockEdgeM) > 0
    ? Number(initialParticleSpacing.drop.blockEdgeM)
    : referenceIronEdge;
  const baseBlockEdgeM = Number(initialParticleSpacing.base.blockEdgeM) > 0
    ? Number(initialParticleSpacing.base.blockEdgeM)
    : referenceIceEdge;
  const ironBase = ironBaseHeightM ?? (
    iceBase + baseBlockEdgeM + Math.max(baseBlockEdgeM, dropBlockEdgeM, 1.0)
  );
  const dropBlockVolumeM3 = dropBlockEdgeM ** 3;
  const baseBlockVolumeM3 = baseBlockEdgeM ** 3;
  const scenarioWithDerivedBlockGeometry = {
    ...scenario,
    box: { ...scenario.box },
    ice: {
      ...scenario.ice,
      edgeM: baseBlockEdgeM,
      volumeM3: baseBlockVolumeM3,
      referenceEdgeM: referenceIceEdge,
      referenceVolumeM3: scenario.ice.volumeM3
    },
    iron: {
      ...scenario.iron,
      edgeM: dropBlockEdgeM,
      volumeM3: dropBlockVolumeM3,
      volumeFractionOfIce: baseBlockVolumeM3 > 0 ? dropBlockVolumeM3 / baseBlockVolumeM3 : null,
      referenceEdgeM: referenceIronEdge,
      referenceVolumeM3: scenario.iron.volumeM3,
      referenceVolumeFractionOfIce: scenario.iron.volumeFractionOfIce
    }
  };

  const dropParticles = fillCube({
    material: dropMaterial,
    role: 'drop',
    min: [cx - dropBlockEdgeM / 2, ironBase, cz - dropBlockEdgeM / 2],
    size: dropBlockEdgeM,
    particlesPerEdge: initialParticleSpacing.drop.particlesPerEdge,
    temperatureK: dropTempK,
    pressurePa: initialPressurePa,
    properties: dropProps,
    densityKgPerM3: dropDensityKgPerM3,
    particleSizePlan: initialParticleSpacing.drop
  });
  const baseParticles = fillCube({
    material: baseMaterial,
    role: 'base',
    min: [cx - baseBlockEdgeM / 2, iceBase, cz - baseBlockEdgeM / 2],
    size: baseBlockEdgeM,
    particlesPerEdge: initialParticleSpacing.base.particlesPerEdge,
    temperatureK: baseTempK,
    pressurePa: initialPressurePa,
    properties: baseProps,
    densityKgPerM3: baseDensityKgPerM3,
    particleSizePlan: initialParticleSpacing.base
  });

  const all = [...baseParticles, ...dropParticles];
  const smoothingLengthM = initialParticleSpacing.smoothingLengthM;
  const state = createSphState({ particles: all, smoothingLengthM, dimension: 3 });
  // Carry per-particle temperature + material alongside the SPH state for rendering.
  state.particles.forEach((p, index) => {
    p.material = all[index].material;
    p.role = all[index].role;
    p.temperatureK = all[index].temperatureK;
    p.pressurePa = all[index].pressurePa;
    p.restDensityKgPerM3 = all[index].restDensityKgPerM3;
    p.phaseVolumeReferenceDensityKgPerM3 = all[index].phaseVolumeReferenceDensityKgPerM3;
    p.phaseVolumeReferenceMassKg = all[index].phaseVolumeReferenceMassKg;
    p.phaseVolumeReferenceVolumeM3 = all[index].phaseVolumeReferenceVolumeM3;
    p.phaseVolumeReferenceMassRatio = all[index].phaseVolumeReferenceMassRatio;
    p.phaseVolumeReferenceDensitySource = all[index].phaseVolumeReferenceDensitySource;
    p.phaseVolumeReferencePhase = all[index].phaseVolumeReferencePhase;
    p.initialParticleSpacingM = all[index].initialParticleSpacingM;
    p.initialCellVolumeM3 = all[index].initialCellVolumeM3;
    p.continuumCellVolumeM3 = all[index].continuumCellVolumeM3;
    p.visualRestVolumeM3 = all[index].visualRestVolumeM3;
    p.visualParticleRadiusM = all[index].visualParticleRadiusM;
    p.visualRestParticleRadiusM = all[index].visualRestParticleRadiusM;
    p.materialReferenceParticleRadiusM = all[index].materialReferenceParticleRadiusM;
    p.materialStateEntityVolumeM3 = all[index].materialStateEntityVolumeM3;
    p.materialVisualScale = all[index].materialVisualScale;
    p.particleRadiusM = all[index].particleRadiusM;
    p.restParticleRadiusM = all[index].restParticleRadiusM;
    p.currentCellVolumeM3 = all[index].currentCellVolumeM3;
    p.currentParticleRadiusM = all[index].currentParticleRadiusM;
    p.particleSizeState = all[index].particleSizeState ? { ...all[index].particleSizeState } : null;
  });
  return {
    scenario: scenarioWithDerivedBlockGeometry,
    closures: baseClosures,
    allowFixtureMaterialProperties,
    state,
    box: { dimensionsM: boxDims, edgeM: Math.max(...boxDims) },
    dropMaterial,
    baseMaterial,
    initialTemperaturesK: { drop: dropTempK, base: baseTempK, gas: scenario.gas.initialTemperatureK },
    initialParticleSpacing,
    initialParticleEdgeDiagnostics: initialParticleEdgeDiagnostics({
      initialParticleSpacing,
      dropRequestedParticlesPerEdge: dropParticleEdge,
      baseRequestedParticlesPerEdge: baseParticleEdge,
      dropParticleCount: dropParticles.length,
      baseParticleCount: baseParticles.length,
      dropSizeM: dropBlockEdgeM,
      baseSizeM: baseBlockEdgeM
    }),
    counts: { drop: dropParticles.length, base: baseParticles.length, total: all.length },
    materialProperties: Object.fromEntries(Object.entries(resolved).map(([k, c]) => [k, c.properties]))
  };
}

/**
 * Per-particle temperature + phase derived from current specific internal energy via the
 * closure (the same map the carrier uses). Drives the cold->hot render colour.
 */
export function particleThermalState(demo) {
  return demo.state.particles.map((p) => {
    const props = demo.materialProperties[p.material];
    const eq = cachedParticleEquilibriumFromSpecificEnergy(props, p, p.specificInternalEnergyJPerKg);
    return { material: p.material, temperatureK: eq.temperatureK, phase: eq.stablePhase };
  });
}

/**
 * Per-particle render colour, fully closure-backed: the Planck radiation closure gives the
 * incandescent glow of hot matter, and the optical closure gives the intrinsic
 * (Drude-reflectance / Beer–Lambert / Rayleigh) colour of non-incandescent matter. No demo-tuned
 * colours remain.
 */
export function particleColors(demo) {
  return demo.state.particles.map((p) => {
    const props = demo.materialProperties[p.material];
    const eq = cachedParticleEquilibriumFromSpecificEnergy(props, p, p.specificInternalEnergyJPerKg);
    const inc = incandescentColor(eq.temperatureK);
    if (inc.visible) {
      return { rgb: [...inc.srgb], closureBacked: true, source: 'radiation-closure' };
    }
    // Material closures can carry an intrinsic optical colour directly: elements use the
    // scalar-relativistic Drude-Lorentz optical response, compounds use the molecular gap path.
    if (props.intrinsicColorSrgb) {
      return { rgb: [...props.intrinsicColorSrgb], closureBacked: true, source: 'material-closure' };
    }
    // Metals: colour derived from the conduction-electron density (Drude plasma frequency). Water/
    // air: Beer–Lambert / Rayleigh. The electron density comes from the material closure.
    const c = intrinsicColorSrgb({ material: p.material, phase: eq.stablePhase, conductionElectronDensityPerM3: props.conductionElectronDensityPerM3 });
    return { rgb: [c.r, c.g, c.b], closureBacked: true, source: 'optical-closure' };
  });
}

/**
 * Per-particle render-material key. Identical to the simulation material except that vaporized
 * water (gas phase) is tagged `steam`, so the renderer can draw it as a distinct whispy surface
 * rather than merging it into the bulk-water blob — that is what makes the rising steam visible.
 */
export function particleRenderMaterials(demo) {
  return particleRenderDescriptors(demo).map((descriptor) => descriptor.renderKey);
}

function bucketRelative(value, { fraction = 1e-3, minQuantum = 1e-12 } = {}) {
  if (value == null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const quantum = Math.max(minQuantum, Math.abs(number) * fraction);
  return bucketFinite(number, quantum);
}

function normalizedH2oVaporMicrophysicsState({
  temperatureK,
  h2oPartialPressurePa,
  pressurePa,
  dropletRadiusM = REDUCED_H2O_DROPLET_RADIUS_M
} = {}) {
  const temperatureBucketK = bucketFinite(temperatureK, 0.25);
  const h2oPartialPressureBucketPa = bucketRelative(h2oPartialPressurePa, { fraction: 1e-3, minQuantum: 1 });
  const pressureBucketPa = bucketRelative(pressurePa, { fraction: 1e-3, minQuantum: 1 });
  const dropletRadiusBucketM = bucketRelative(dropletRadiusM, { fraction: 1e-3, minQuantum: 1e-9 });
  const microphysics = waterDropletOpticalMicrophysics({
    temperatureK: temperatureBucketK,
    h2oPartialPressurePa: h2oPartialPressureBucketPa,
    pressurePa: pressureBucketPa,
    dropletRadiusM: dropletRadiusBucketM,
    pathLengthM: 1
  });
  return {
    model: H2O_VAPOR_OPTICAL_STATE_MODEL,
    generator: H2O_VAPOR_OPTICAL_STATE_GENERATOR,
    formula: 'h2o',
    phase: 'gas',
    temperatureK: temperatureBucketK,
    h2oPartialPressurePa: h2oPartialPressureBucketPa,
    pressurePa: pressureBucketPa,
    dropletRadiusM: dropletRadiusBucketM,
    saturationPressurePa: bucketRelative(microphysics.saturationPressurePa, { fraction: 1e-3, minQuantum: 1 }),
    supersaturationRatio: bucketRelative(microphysics.supersaturationRatio, { fraction: 1e-3, minQuantum: 1e-6 }),
    condensedMassFraction: bucketRelative(microphysics.condensedMassFraction, { fraction: 1e-3, minQuantum: 1e-9 }),
    vaporDensityKgPerM3: bucketRelative(microphysics.vaporDensityKgPerM3, { fraction: 1e-3, minQuantum: 1e-12 }),
    condensedMassDensityKgPerM3: bucketRelative(microphysics.condensedMassDensityKgPerM3, { fraction: 1e-3, minQuantum: 1e-12 }),
    dropletNumberDensityPerM3: bucketRelative(microphysics.dropletNumberDensityPerM3, { fraction: 1e-3, minQuantum: 1e-12 }),
    scatteringCoefficientPerM: bucketRelative(microphysics.scatteringCoefficientPerM, { fraction: 1e-3, minQuantum: 1e-12 }),
    microphysicsStatus: microphysics.status
  };
}

export function waterVaporOpticalStateFromGasSummary(summary) {
  const h2o = summary?.bySpecies?.h2o;
  if (!h2o) return null;
  return normalizedH2oVaporMicrophysicsState({
    temperatureK: positiveOrNull(h2o.temperatureK),
    h2oPartialPressurePa: positiveOrNull(h2o.partialPressurePa),
    pressurePa: positiveOrNull(summary.totalPressurePa),
    dropletRadiusM: REDUCED_H2O_DROPLET_RADIUS_M
  });
}

/**
 * Per-particle render descriptor. The simulation material remains the real material identity; the
 * render key is only a surface-batching hint. Phase is carried explicitly so non-H2O materials do
 * not get forced through a renderer-side liquid default.
 */
export function particleRenderDescriptors(demo, { gasPressure = null } = {}) {
  const waterVaporOpticalState = waterVaporOpticalStateFromGasSummary(gasPressure);
  return demo.state.particles.map((p) => {
    const props = demo.materialProperties[p.material];
    const phase = stablePhaseFromSpecificEnergy(props, p.specificInternalEnergyJPerKg);
    let renderKey = p.material;
    let opticalState = null;
    if (p.material === 'h2o') {
      if (phase === 'gas') {
        renderKey = 'steam'; // optically-thin vapour -> condensation cloud
        opticalState = waterVaporOpticalState;
      }
      if (phase === 'solid') renderKey = 'ice'; // translucent solid phase, distinct from clear water
    }
    return opticalState
      ? { material: p.material, phase, renderKey, opticalState }
      : { material: p.material, phase, renderKey };
  });
}

/**
 * Per-material emissive colour for incandescent surfaces, from the Planck radiation closure. Hot
 * matter glows (emits), so the renderer should drive the material's emissive channel from this —
 * a metal surface lit only by ambient light would otherwise render dark. Returns the luminance-
 * weighted mean incandescent colour over the material's glowing particles, or null when none of
 * them are above the incandescence threshold (so a cold surface does not falsely glow).
 */
export function surfaceEmissive(demo) {
  const acc = {};
  for (const p of demo.state.particles) {
    const props = demo.materialProperties[p.material];
    const eq = cachedParticleEquilibriumFromSpecificEnergy(props, p, p.specificInternalEnergyJPerKg);
    const inc = incandescentColor(eq.temperatureK);
    if (!inc.visible) continue;
    const lum = 0.2126 * inc.srgb[0] + 0.7152 * inc.srgb[1] + 0.0722 * inc.srgb[2];
    const a = acc[p.material] || (acc[p.material] = { r: 0, g: 0, b: 0, w: 0 });
    a.r += inc.srgb[0] * lum;
    a.g += inc.srgb[1] * lum;
    a.b += inc.srgb[2] * lum;
    a.w += lum;
  }
  const out = {};
  for (const [material, a] of Object.entries(acc)) {
    out[material] = a.w > 0 ? [a.r / a.w, a.g / a.w, a.b / a.w] : null;
  }
  return out;
}

/**
 * Phase mass summary for the status rows.
 */
export function phaseMassSummary(demo) {
  const byMaterialPhase = {};
  let feSolidMass = 0;
  let feTotalMass = 0;
  const totalMassByMaterial = {};
  const solidMassByMaterial = {};
  demo.state.particles.forEach((p) => {
    const props = demo.materialProperties[p.material];
    const phase = stablePhaseFromSpecificEnergy(props, p.specificInternalEnergyJPerKg);
    byMaterialPhase[p.material] = byMaterialPhase[p.material] || {};
    byMaterialPhase[p.material][phase] = (byMaterialPhase[p.material][phase] || 0) + p.massKg;
    totalMassByMaterial[p.material] = (totalMassByMaterial[p.material] || 0) + p.massKg;
    if (phase === 'solid') {
      solidMassByMaterial[p.material] = (solidMassByMaterial[p.material] || 0) + p.massKg;
    }
    if (p.material === 'fe') {
      feTotalMass += p.massKg;
      if (phase === 'solid') feSolidMass += p.massKg;
    }
  });
  const solidFractionByMaterial = {};
  for (const [material, totalMass] of Object.entries(totalMassByMaterial)) {
    solidFractionByMaterial[material] = totalMass > 0 ? (solidMassByMaterial[material] || 0) / totalMass : null;
  }
  return {
    byMaterialPhase,
    solidFractionByMaterial,
    ironSolidFraction: feTotalMass > 0 ? feSolidMass / feTotalMass : null
  };
}

function gasSpeciesKey(material) {
  return String(material || '').toLowerCase();
}

function phaseDensityKgPerM3(properties, phaseName) {
  const phase = properties?.phases?.find((candidate) => candidate.name === phaseName)
    || properties?.phases?.find((candidate) => candidate.densityKgPerM3 > 0);
  return Number.isFinite(phase?.densityKgPerM3) && phase.densityKgPerM3 > 0
    ? phase.densityKgPerM3
    : null;
}

function addGasSpecies(acc, material, { massKg, moles, temperatureK }) {
  const key = gasSpeciesKey(material);
  if (!key || !(moles > 0)) return;
  const item = acc[key] || (acc[key] = {
    material: key,
    massKg: 0,
    moles: 0,
    temperatureMoleK: 0,
    partialPressurePa: 0
  });
  item.massKg += massKg;
  item.moles += moles;
  item.temperatureMoleK += moles * temperatureK;
}

const PRESSURE_WALL_FACES = Object.freeze([
  { faceId: 'xMin', axis: 0, sign: -1, normal: [-1, 0, 0], areaAxes: [1, 2] },
  { faceId: 'xMax', axis: 0, sign: 1, normal: [1, 0, 0], areaAxes: [1, 2] },
  { faceId: 'yMin', axis: 1, sign: -1, normal: [0, -1, 0], areaAxes: [0, 2] },
  { faceId: 'yMax', axis: 1, sign: 1, normal: [0, 1, 0], areaAxes: [0, 2] },
  { faceId: 'zMin', axis: 2, sign: -1, normal: [0, 0, -1], areaAxes: [0, 1] },
  { faceId: 'zMax', axis: 2, sign: 1, normal: [0, 0, 1], areaAxes: [0, 1] }
]);

function finitePositive(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function pressureBoxDimensionsM(boxDimsM, boxVolumeM3) {
  if (Array.isArray(boxDimsM) && boxDimsM.length === 3) {
    return boxDimsM.map((value) => finitePositive(value, 0));
  }
  const edge = Math.cbrt(Math.max(Number(boxVolumeM3) || 0, 0));
  return [edge, edge, edge];
}

function vector3From(value, fallback = [0, 0, 0]) {
  return [0, 1, 2].map((index) => {
    const number = Number(Array.isArray(value) ? value[index] : undefined);
    return Number.isFinite(number) ? number : fallback[index];
  });
}

function uniqueStringsFrom(...values) {
  return [...new Set(values.flatMap((value) => (
    Array.isArray(value) ? value : [value]
  ))
    .map((value) => String(value ?? '').trim())
    .filter(Boolean))];
}

function hasRetainedProductEventBuffer(handle) {
  return Boolean(handle?.productEventBufferRetained && handle?.productEventBuffer);
}

function cellDimsFrom(value, fallback = [0, 0, 0]) {
  if (!Array.isArray(value)) return [...fallback];
  return [0, 1, 2].map((index) => {
    const number = Math.round(Number(value[index]) || 0);
    return number > 0 ? number : fallback[index];
  });
}

function gridIndexFrom(value, fallback = [0, 0, 0]) {
  if (!Array.isArray(value)) return [...fallback];
  return [0, 1, 2].map((index) => {
    const number = Math.round(Number(value[index]));
    return Number.isFinite(number) && number >= 0 ? number : fallback[index];
  });
}

function normalizeLocalGasPressureCells(field = null) {
  if (!Array.isArray(field?.cells)) return [];
  const cells = [];
  for (const [index, cell] of field.cells.entries()) {
    const pressurePa = Number(cell?.pressurePa ?? cell?.totalPressurePa);
    if (!Number.isFinite(pressurePa) || pressurePa < 0) continue;
    cells.push({
      index: Number.isFinite(Number(cell?.index)) ? Number(cell.index) : index,
      gridIndex: Array.isArray(cell?.gridIndex)
        ? cell.gridIndex.map((value) => Math.max(0, Math.round(Number(value) || 0))).slice(0, 3)
        : [index, 0, 0],
      centerM: vector3From(cell?.centerM ?? cell?.centroidM),
      pressurePa,
      pressureGradientPaPerM: vector3From(cell?.pressureGradientPaPerM ?? cell?.gradientPaPerM),
      volumeM3: finitePositive(cell?.volumeM3, 0),
      status: cell?.status || 'local-gas-pressure-cell-ready'
    });
  }
  return cells;
}

function gasCellSpeciesRows(cell = null) {
  if (Array.isArray(cell?.species)) return cell.species;
  if (Array.isArray(cell?.records)) return cell.records;
  if (Array.isArray(cell?.gasSpecies)) return cell.gasSpecies;
  if (cell?.bySpecies && typeof cell.bySpecies === 'object') return Object.values(cell.bySpecies);
  return [];
}

function spatialGasSpeciesLedgerFromPressureSummary(pressureSummary = null) {
  return pressureSummary?.spatialGasSpeciesLedger
    || pressureSummary?.residentSpatialGasSpeciesLedger
    || pressureSummary?.gasSpeciesCellLedger
    || pressureSummary?.residentGasSpeciesCellLedger
    || null;
}

function spatialGasSpeciesLedgerReady(ledger = null) {
  return ledger?.schema === RESIDENT_SPATIAL_GAS_SPECIES_LEDGER_SCHEMA
    && Array.isArray(ledger.cells)
    && ledger.cells.length > 0;
}

function spatialGasSpeciesLedgerFromPressureInterfaceState(pressureInterfaceState = null) {
  if (spatialGasSpeciesLedgerReady(pressureInterfaceState)) return pressureInterfaceState;
  return pressureInterfaceState?.spatialGasSpeciesLedger
    || pressureInterfaceState?.residentSpatialGasSpeciesLedger
    || pressureInterfaceState?.gasPressureSummary?.spatialGasSpeciesLedger
    || pressureInterfaceState?.sourceGasPressureSummary?.spatialGasSpeciesLedger
    || pressureInterfaceState?.spatialGasLedgerProducerStageRequest?.spatialGasSpeciesLedger
    || pressureInterfaceState?.gasCellEosProducerStageRequest?.spatialGasSpeciesLedger
    || pressureInterfaceState?.gasCellEosProducerStageRequest?.gasCellEosProducerStageResult?.spatialGasSpeciesLedger
    || pressureInterfaceState?.pressureInterfaceGasCellFieldImport?.spatialGasSpeciesLedger
    || pressureInterfaceState?.pressureInterfaceGasCellFieldImport?.gasCellField?.spatialGasSpeciesLedger
    || pressureInterfaceState?.pressureInterfaceGasCellFieldImport?.gasCellFieldSnapshot?.spatialGasSpeciesLedger
    || null;
}

function gasCellFieldFromPressureInterfaceState(pressureInterfaceState = null) {
  if (pressureInterfaceState?.schema === 'peercompute.ulg.sph-sealed-gas-pressure-cell-field.v0') {
    return pressureInterfaceState;
  }
  return pressureInterfaceState?.gasCellField
    || pressureInterfaceState?.localGasCellField
    || pressureInterfaceState?.pressureFeedback?.gasCellField
    || pressureInterfaceState?.gasCellEosProducerStageRequest?.gasCellEosProducerStageResult?.gasCellFieldSnapshot
    || pressureInterfaceState?.gasCellEosProducerStageRequest?.gasCellEosProducerStageResult?.gasCellField
    || pressureInterfaceState?.pressureInterfaceGasCellFieldImport?.gasCellFieldSnapshot
    || pressureInterfaceState?.pressureInterfaceGasCellFieldImport?.gasCellField
    || null;
}

function inferSpatialGasCellDims(ledger = null) {
  const supplied = cellDimsFrom(ledger?.cellDims || ledger?.gridDims || ledger?.dimensions, [0, 0, 0]);
  if (supplied.every((value) => value > 0)) return supplied;
  const cells = Array.isArray(ledger?.cells) ? ledger.cells : [];
  const inferred = [0, 0, 0];
  for (const cell of cells) {
    const gridIndex = Array.isArray(cell?.gridIndex) ? cell.gridIndex : null;
    if (!gridIndex) continue;
    for (let axis = 0; axis < 3; axis += 1) {
      inferred[axis] = Math.max(inferred[axis], Math.round(Number(gridIndex[axis]) || 0) + 1);
    }
  }
  return inferred.map((value) => Math.max(value, 1));
}

function deriveSpatialGasCellCenterM(cell, gridIndex, cellDims, boxDimsM) {
  if (Array.isArray(cell?.centerM) || Array.isArray(cell?.centroidM)) {
    return vector3From(cell.centerM || cell.centroidM);
  }
  return [0, 1, 2].map((axis) => {
    const dim = Math.max(cellDims[axis], 1);
    return ((gridIndex[axis] + 0.5) / dim) * boxDimsM[axis];
  });
}

function deriveSpatialGasCellVolumeM3(cell, cellDims, boxDimsM) {
  const explicit = finitePositive(cell?.volumeM3, 0);
  if (explicit > 0) return explicit;
  return [0, 1, 2].reduce((volume, axis) => {
    const dim = Math.max(cellDims[axis], 1);
    return volume * (boxDimsM[axis] / dim);
  }, 1);
}

function pressureFromSpatialGasCellSpecies(cell, fallbackTemperatureK = 293.15) {
  const rows = gasCellSpeciesRows(cell);
  let moleTemperatureK = 0;
  let moles = 0;
  let massKg = 0;
  for (const row of rows) {
    const rowMoles = Number(row?.moles) || 0;
    if (!(rowMoles > 0)) continue;
    const temperatureK = Number.isFinite(Number(row?.temperatureK))
      ? Number(row.temperatureK)
      : (Number.isFinite(Number(cell?.temperatureK)) ? Number(cell.temperatureK) : fallbackTemperatureK);
    moles += rowMoles;
    massKg += Number(row?.massKg) || 0;
    moleTemperatureK += rowMoles * temperatureK;
  }
  return { moles, massKg, moleTemperatureK, speciesCount: rows.length };
}

function gridKey(gridIndex) {
  return gridIndex.map((value) => Math.round(Number(value) || 0)).join(',');
}

function spatialNeighborKey(gridIndex, axis, delta) {
  const next = [...gridIndex];
  next[axis] += delta;
  return gridKey(next);
}

export function deriveLocalGasCellPressureFieldFromSpatialGasLedger({
  pressureSummary = null,
  spatialGasSpeciesLedger = null,
  boxDimsM = null,
  fallbackTemperatureK = 293.15,
  source = null
} = {}) {
  const ledger = spatialGasSpeciesLedger || spatialGasSpeciesLedgerFromPressureSummary(pressureSummary);
  const rawCells = Array.isArray(ledger?.cells) ? ledger.cells : [];
  const dims = pressureBoxDimensionsM(boxDimsM || pressureSummary?.boxDimsM, pressureSummary?.boxVolumeM3);
  if (!ledger || rawCells.length === 0 || !dims.every((value) => value > 0)) {
    return {
      schema: 'peercompute.ulg.sph-sealed-gas-pressure-cell-field.v0',
      status: 'gas-cell-pressure-field-unavailable',
      source: source || pressureSummary?.source || 'resident-spatial-gas-species-ledger-eos',
      spatialGasSpeciesLedgerSchema: ledger?.schema ?? null,
      spatialGasSpeciesLedgerStatus: ledger?.status ?? null,
      residentSpatialGasSpeciesLedgerStatus: ledger
        ? 'blocked-spatial-gas-species-ledger-empty-or-invalid'
        : 'blocked-resident-spatial-gas-species-ledger-required',
      localPressureGradientReady: false,
      localPressureGradientStatus: 'blocked-resident-spatial-gas-species-ledger-required',
      localPressureGradientBlockers: ['resident-spatial-gas-species-ledger-required'],
      cells: []
    };
  }
  const cellDims = inferSpatialGasCellDims(ledger);
  const cells = [];
  for (const [index, cell] of rawCells.entries()) {
    const gridIndex = Array.isArray(cell?.gridIndex)
      ? gridIndexFrom(cell.gridIndex, [index, 0, 0])
      : [index, 0, 0];
    const volumeM3 = deriveSpatialGasCellVolumeM3(cell, cellDims, dims);
    const species = pressureFromSpatialGasCellSpecies(cell, fallbackTemperatureK);
    if (!(species.moles > 0) || !(volumeM3 > 0)) continue;
    const pressurePa = species.moleTemperatureK * PHYSICAL_CONSTANTS.gasConstantJPerMolK / volumeM3;
    if (!Number.isFinite(pressurePa) || pressurePa < 0) continue;
    cells.push({
      index: Number.isFinite(Number(cell?.index)) ? Number(cell.index) : index,
      gridIndex,
      centerM: deriveSpatialGasCellCenterM(cell, gridIndex, cellDims, dims),
      pressurePa,
      pressureGradientPaPerM: [0, 0, 0],
      volumeM3,
      moles: species.moles,
      massKg: species.massKg,
      speciesCount: species.speciesCount,
      status: 'local-gas-pressure-cell-ready'
    });
  }
  if (cells.length === 0) {
    return {
      schema: 'peercompute.ulg.sph-sealed-gas-pressure-cell-field.v0',
      status: 'gas-cell-pressure-field-unavailable',
      source: source || pressureSummary?.source || 'resident-spatial-gas-species-ledger-eos',
      spatialGasSpeciesLedgerSchema: ledger?.schema ?? RESIDENT_SPATIAL_GAS_SPECIES_LEDGER_SCHEMA,
      spatialGasSpeciesLedgerStatus: ledger?.status ?? null,
      residentSpatialGasSpeciesLedgerStatus: 'blocked-spatial-gas-species-ledger-has-no-eos-ready-cells',
      localPressureGradientReady: false,
      localPressureGradientStatus: 'blocked-spatial-gas-species-ledger-has-no-eos-ready-cells',
      localPressureGradientBlockers: ['spatial-gas-species-ledger-has-no-eos-ready-cells'],
      cells: []
    };
  }
  const byGrid = new Map(cells.map((cell) => [gridKey(cell.gridIndex), cell]));
  for (const cell of cells) {
    const gradient = [0, 0, 0];
    for (let axis = 0; axis < 3; axis += 1) {
      const plus = byGrid.get(spatialNeighborKey(cell.gridIndex, axis, 1));
      const minus = byGrid.get(spatialNeighborKey(cell.gridIndex, axis, -1));
      if (plus && minus) {
        const distanceM = plus.centerM[axis] - minus.centerM[axis];
        gradient[axis] = distanceM !== 0 ? (plus.pressurePa - minus.pressurePa) / distanceM : 0;
      } else if (plus) {
        const distanceM = plus.centerM[axis] - cell.centerM[axis];
        gradient[axis] = distanceM !== 0 ? (plus.pressurePa - cell.pressurePa) / distanceM : 0;
      } else if (minus) {
        const distanceM = cell.centerM[axis] - minus.centerM[axis];
        gradient[axis] = distanceM !== 0 ? (cell.pressurePa - minus.pressurePa) / distanceM : 0;
      }
    }
    cell.pressureGradientPaPerM = gradient;
  }
  const fieldGradient = cells.reduce((sum, cell) => [
    sum[0] + cell.pressureGradientPaPerM[0],
    sum[1] + cell.pressureGradientPaPerM[1],
    sum[2] + cell.pressureGradientPaPerM[2]
  ], [0, 0, 0]).map((value) => value / cells.length);
  return {
    schema: 'peercompute.ulg.sph-sealed-gas-pressure-cell-field.v0',
    status: 'gas-cell-pressure-field-ready',
    source: source || 'resident-spatial-gas-species-ledger-eos',
    spatialGasSpeciesLedgerSchema: ledger.schema || RESIDENT_SPATIAL_GAS_SPECIES_LEDGER_SCHEMA,
    spatialGasSpeciesLedgerStatus: ledger.status || 'spatial-gas-species-ledger-ready',
    residentSpatialGasSpeciesLedgerStatus: 'resident-spatial-gas-species-ledger-eos-ready',
    retainedSpatialGasSourceBufferRefs: uniqueStringsFrom(ledger.retainedSpatialGasSourceBufferRefs),
    workerRetainedSpatialGasSourceBufferRefs: uniqueStringsFrom(ledger.workerRetainedSpatialGasSourceBufferRefs),
    spatialGasSourceBufferRetained: ledger.spatialGasSourceBufferRetained === true
      || uniqueStringsFrom(ledger.retainedSpatialGasSourceBufferRefs, ledger.workerRetainedSpatialGasSourceBufferRefs).length > 0,
    eosPressureClosure: 'ideal-gas-law-per-cell',
    pressureFieldMode: LOCAL_GAS_CELL_PRESSURE_FIELD_MODE,
    pressureFieldResolution: LOCAL_GAS_CELL_PRESSURE_FIELD_RESOLUTION,
    cellDims,
    cellCount: cells.length,
    cells,
    pressureGradientPaPerM: fieldGradient,
    gradientStatus: 'local-pressure-gradient-field-ready',
    localPressureGradientSchema: ULG_SPH_LOCAL_PRESSURE_GRADIENT_FIELD_SCHEMA,
    localPressureGradientReady: true,
    localPressureGradientStatus: 'local-pressure-gradient-field-ready',
    localPressureGradientBlockers: [],
    localPressureGradientForceCouplingStatus: 'local-pressure-gradient-force-coupling-ready',
    localPressureGradientValidation: true,
    pressureFieldValidation: true,
    gasValidation: ledger.gasValidation === true,
    scientificValidation: false,
    fullPhysicsValidation: false
  };
}

function pressureAtInterfaceCentroid({
  pressureFeedback = null,
  centroidM = [0, 0, 0],
  fallbackPressurePa = Number.NaN
} = {}) {
  const gasCellField = pressureFeedback?.gasCellField || null;
  const localCells = Array.isArray(gasCellField?.cells) ? gasCellField.cells : [];
  if (gasCellField?.localPressureGradientReady === true && localCells.length > 0) {
    let selected = null;
    let selectedDistance2 = Number.POSITIVE_INFINITY;
    for (const cell of localCells) {
      if (cell?.status && cell.status !== 'local-gas-pressure-cell-ready') continue;
      const centerM = vector3From(cell?.centerM);
      const dx = centroidM[0] - centerM[0];
      const dy = centroidM[1] - centerM[1];
      const dz = centroidM[2] - centerM[2];
      const distance2 = dx * dx + dy * dy + dz * dz;
      if (distance2 < selectedDistance2) {
        selected = { cell, centerM, deltaM: [dx, dy, dz] };
        selectedDistance2 = distance2;
      }
    }
    if (selected) {
      const gradient = vector3From(selected.cell.pressureGradientPaPerM);
      const reconstructed = Number(selected.cell.pressurePa)
        + gradient[0] * selected.deltaM[0]
        + gradient[1] * selected.deltaM[1]
        + gradient[2] * selected.deltaM[2];
      return {
        pressurePa: Math.max(0, reconstructed),
        pressureSource: 'local-gas-cell-nearest-gradient-reconstruction',
        pressureCellIndex: selected.cell.index ?? null,
        pressureCellCenterM: selected.centerM,
        pressureGradientPaPerM: gradient
      };
    }
  }
  return {
    pressurePa: fallbackPressurePa,
    pressureSource: 'uniform-sealed-gas-pressure',
    pressureCellIndex: null,
    pressureCellCenterM: null,
    pressureGradientPaPerM: [0, 0, 0]
  };
}

function gasPressureFieldResolutionDiagnostics(gasCellField = null) {
  const unavailable = !gasCellField || gasCellField.status !== 'gas-cell-pressure-field-ready';
  const localPressureGradientReady = gasCellField?.localPressureGradientReady === true;
  const blockers = Array.isArray(gasCellField?.localPressureGradientBlockers)
    ? [...gasCellField.localPressureGradientBlockers]
    : (localPressureGradientReady ? [] : [...LOCAL_PRESSURE_GRADIENT_BLOCKERS]);
  return {
    pressureFieldMode: gasCellField?.pressureFieldMode || (unavailable ? 'pressure-field-unavailable' : UNIFORM_GAS_PRESSURE_FIELD_MODE),
    pressureFieldResolution: gasCellField?.pressureFieldResolution || (unavailable ? 'pressure-field-unavailable' : UNIFORM_GAS_PRESSURE_FIELD_RESOLUTION),
    pressureGradientStatus: gasCellField?.gradientStatus || (unavailable ? 'pressure-field-unavailable' : 'uniform-sealed-gas-pressure-zero-gradient'),
    localPressureGradientSchema: gasCellField?.localPressureGradientSchema || ULG_SPH_LOCAL_PRESSURE_GRADIENT_FIELD_SCHEMA,
    localPressureGradientReady,
    localPressureGradientStatus: gasCellField?.localPressureGradientStatus || (
      localPressureGradientReady
        ? 'local-pressure-gradient-field-ready'
        : (unavailable
            ? 'blocked-pressure-field-unavailable'
            : 'blocked-uniform-single-cell-field-has-no-local-gradient')
    ),
    localPressureGradientBlockers: blockers,
    localPressureGradientForceCouplingStatus: localPressureGradientReady
      ? 'local-pressure-gradient-force-coupling-ready'
      : 'blocked-local-pressure-gradient-field-required',
    localPressureGradientValidation: gasCellField?.localPressureGradientValidation === true
  };
}

export function gasPressureCellFieldSummary({
  pressureSummary = null,
  boxDimsM = null,
  externalPressurePa = PHYSICAL_CONSTANTS.standardAtmospherePa,
  source = null
} = {}) {
  const totalPressurePa = Number(pressureSummary?.totalPressurePa);
  const suppliedField = pressureSummary?.gasCellField || pressureSummary?.localGasCellField || null;
  const suppliedLocalReady = suppliedField?.localPressureGradientReady === true;
  const spatialField = suppliedLocalReady
    ? null
    : deriveLocalGasCellPressureFieldFromSpatialGasLedger({
        pressureSummary,
        boxDimsM: boxDimsM || pressureSummary?.boxDimsM,
        source: 'resident-spatial-gas-species-ledger-eos'
      });
  const effectiveField = suppliedLocalReady ? suppliedField : (
    spatialField?.localPressureGradientReady === true ? spatialField : suppliedField
  );
  const localCells = normalizeLocalGasPressureCells(effectiveField);
  const retainedGasPressureRowCount = Math.max(0, Math.trunc(Number(
    effectiveField?.pressureInterfaceGasPressureCellRowCount
      ?? effectiveField?.gasPressureCellRowCount
      ?? 0
  ) || 0));
  const retainedGasPressureRowsReady = effectiveField?.localPressureGradientReady === true
    && retainedGasPressureRowCount > 0
    && (
      effectiveField?.retainedGasPressureCellsBufferAvailable === true
      || effectiveField?.pressureInterfaceGasPressureCellRowsBufferRetained === true
      || effectiveField?.gasPressureCellRowsBufferRetained === true
    );
  const dims = pressureBoxDimensionsM(boxDimsM || pressureSummary?.boxDimsM, pressureSummary?.boxVolumeM3);
  const usable = Number.isFinite(totalPressurePa) && dims.every((value) => value > 0);
  const localGradientReady = usable
    && effectiveField?.localPressureGradientReady === true
    && (localCells.length > 0 || retainedGasPressureRowsReady);
  const retainedSpatialGasSourceBufferRefs = localGradientReady
    ? uniqueStringsFrom(effectiveField?.retainedSpatialGasSourceBufferRefs)
    : [];
  const workerRetainedSpatialGasSourceBufferRefs = localGradientReady
    ? uniqueStringsFrom(effectiveField?.workerRetainedSpatialGasSourceBufferRefs)
    : [];
  const retainedGasPressureBufferRefs = localGradientReady
    ? uniqueStringsFrom(effectiveField?.retainedGasPressureBufferRefs)
    : [];
  const workerRetainedGasPressureBufferRefs = localGradientReady
    ? uniqueStringsFrom(effectiveField?.workerRetainedGasPressureBufferRefs)
    : [];
  const pressureGaugePa = usable ? totalPressurePa - finitePositive(externalPressurePa, PHYSICAL_CONSTANTS.standardAtmospherePa) : 0;
  const spatialLedger = spatialGasSpeciesLedgerFromPressureSummary(pressureSummary);
  return {
    schema: 'peercompute.ulg.sph-sealed-gas-pressure-cell-field.v0',
    status: usable ? 'gas-cell-pressure-field-ready' : 'gas-cell-pressure-field-unavailable',
    source: source || (localGradientReady && spatialField?.source) || pressureSummary?.source || 'gas-pressure-summary',
    totalPressurePa: Number.isFinite(totalPressurePa) ? totalPressurePa : null,
    pressureGaugePa,
    boxDimsM: dims,
    cellDims: localGradientReady && Array.isArray(effectiveField?.cellDims)
      ? effectiveField.cellDims.map((value) => Math.max(0, Math.round(Number(value) || 0))).slice(0, 3)
      : (usable ? [1, 1, 1] : [0, 0, 0]),
    cellCount: localGradientReady ? (localCells.length || retainedGasPressureRowCount) : (usable ? 1 : 0),
    cells: localGradientReady ? localCells : [],
    pressureFieldMode: localGradientReady
      ? (effectiveField?.pressureFieldMode || LOCAL_GAS_CELL_PRESSURE_FIELD_MODE)
      : (usable ? UNIFORM_GAS_PRESSURE_FIELD_MODE : 'pressure-field-unavailable'),
    pressureFieldResolution: localGradientReady
      ? (effectiveField?.pressureFieldResolution || LOCAL_GAS_CELL_PRESSURE_FIELD_RESOLUTION)
      : (usable ? UNIFORM_GAS_PRESSURE_FIELD_RESOLUTION : 'pressure-field-unavailable'),
    pressureFieldCellFamily: 'resident-gas-pressure',
    uniformPressurePa: Number.isFinite(totalPressurePa) ? totalPressurePa : null,
    uniformPressureGaugePa: pressureGaugePa,
    pressureGradientPaPerM: localGradientReady
      ? vector3From(effectiveField?.pressureGradientPaPerM)
      : [0, 0, 0],
    gradientStatus: localGradientReady
      ? (effectiveField?.gradientStatus || 'local-pressure-gradient-field-ready')
      : (usable ? 'uniform-sealed-gas-pressure-zero-gradient' : 'pressure-field-unavailable'),
    localPressureGradientSchema: ULG_SPH_LOCAL_PRESSURE_GRADIENT_FIELD_SCHEMA,
    localPressureGradientReady: localGradientReady,
    localPressureGradientStatus: localGradientReady
      ? (effectiveField?.localPressureGradientStatus || 'local-pressure-gradient-field-ready')
      : (usable
          ? 'blocked-uniform-single-cell-field-has-no-local-gradient'
          : 'blocked-pressure-field-unavailable'),
    localPressureGradientBlockers: localGradientReady
      ? []
      : (usable ? [...LOCAL_PRESSURE_GRADIENT_BLOCKERS] : ['pressure-field-unavailable']),
    localPressureGradientForceCouplingStatus: localGradientReady
      ? (effectiveField?.localPressureGradientForceCouplingStatus || 'local-pressure-gradient-force-coupling-ready')
      : 'blocked-local-pressure-gradient-field-required',
    gasCellForceCouplingPolicy: localGradientReady
      ? 'local-pressure-gradient-interface-traction'
      : (usable ? 'uniform-interface-traction-only' : 'blocked-pressure-field-unavailable'),
    materialSurfaceCouplingStatus: usable
      ? 'blocked-material-surface-normals-not-resolved'
      : 'blocked-gas-pressure-field-unavailable',
    localPressureGradientValidation: localGradientReady
      && effectiveField?.localPressureGradientValidation === true,
    spatialGasSpeciesLedgerSchema: spatialLedger?.schema ?? null,
    spatialGasSpeciesLedgerStatus: spatialLedger?.status ?? null,
    residentSpatialGasSpeciesLedgerStatus: localGradientReady
      ? (
          effectiveField?.residentSpatialGasSpeciesLedgerStatus
          || spatialField?.residentSpatialGasSpeciesLedgerStatus
          || (spatialLedger
            ? 'resident-spatial-gas-species-ledger-eos-ready'
            : 'blocked-resident-spatial-gas-species-ledger-required')
        )
      : (spatialLedger
          ? (spatialField?.residentSpatialGasSpeciesLedgerStatus || 'blocked-spatial-gas-species-ledger-empty-or-invalid')
          : 'blocked-resident-spatial-gas-species-ledger-required'),
    eosPressureClosure: localGradientReady && (effectiveField?.eosPressureClosure || spatialField?.eosPressureClosure)
      ? (effectiveField?.eosPressureClosure || spatialField.eosPressureClosure)
      : null,
    retainedSpatialGasSourceBufferRefs,
    workerRetainedSpatialGasSourceBufferRefs,
    retainedGasPressureBufferRefs,
    workerRetainedGasPressureBufferRefs,
    retainedGasPressureCellsBufferAvailable: localGradientReady
      && effectiveField?.retainedGasPressureCellsBufferAvailable === true,
    pressureInterfaceGasPressureCellRowCount: localGradientReady ? retainedGasPressureRowCount : 0,
    pressureInterfaceGasPressureCellRowStrideFloats: localGradientReady
      ? Math.max(0, Math.trunc(Number(effectiveField?.pressureInterfaceGasPressureCellRowStrideFloats) || 0))
      : 0,
    pressureInterfaceGasPressureCellRowByteLength: localGradientReady
      ? Math.max(0, Math.trunc(Number(effectiveField?.pressureInterfaceGasPressureCellRowByteLength) || 0))
      : 0,
    pressureInterfaceGasPressureCellRowsBufferRetained: localGradientReady
      && effectiveField?.pressureInterfaceGasPressureCellRowsBufferRetained === true,
    spatialGasSourceBufferRetained: localGradientReady
      && (effectiveField?.spatialGasSourceBufferRetained === true
        || retainedSpatialGasSourceBufferRefs.length > 0
        || workerRetainedSpatialGasSourceBufferRefs.length > 0),
    residentGasCellGradientCouplingValidation: false,
    pressureFieldValidation: localGradientReady
      && effectiveField?.pressureFieldValidation === true,
    forceCouplingValidation: false,
    scientificValidation: false,
    gasValidation: false,
    sphValidation: false,
    fullPhysicsValidation: false
  };
}

export function gasPressureInterfaceCouplingSummary({
  pressureFeedback = null,
  materialInterfaceField = null
} = {}) {
  const gasReady = pressureFeedback?.status === 'wall-pressure-ledger-ready'
    && pressureFeedback?.gasCellField?.status === 'gas-cell-pressure-field-ready';
  const strictGateBlocked = pressureFeedback?.forceCouplingStatus === 'blocked-strict-reaction-gate'
    || (pressureFeedback?.strictReactionGateStatus && pressureFeedback.strictReactionGateStatus !== 'strict-reaction-gate-pass');
  const interfaceReady = materialInterfaceField?.schema === 'peercompute.ulg.sph-material-interface-field.v0'
    && (materialInterfaceField.readySurfaceCount || 0) > 0
    && (materialInterfaceField.totalSurfaceAreaM2 || 0) > 0;
  const pressureFieldResolution = gasPressureFieldResolutionDiagnostics(pressureFeedback?.gasCellField);
  const forceCouplingStatus = strictGateBlocked
    ? 'blocked-strict-reaction-gate'
    : (!gasReady
        ? 'blocked-gas-pressure-field-unavailable'
        : (interfaceReady
            ? 'blocked-pressure-force-solver-not-implemented'
            : 'blocked-material-surface-normals-not-resolved'));
  return {
    schema: 'peercompute.ulg.sph-pressure-interface-coupling.v0',
    status: gasReady && interfaceReady && !strictGateBlocked
      ? 'pressure-interface-coupling-ready-for-solver'
      : 'pressure-interface-coupling-blocked',
    pressureFeedbackSchema: pressureFeedback?.schema ?? null,
    gasCellFieldSchema: pressureFeedback?.gasCellField?.schema ?? null,
    gasCellFieldStatus: pressureFeedback?.gasCellField?.status ?? null,
    pressureFieldMode: pressureFieldResolution.pressureFieldMode,
    pressureFieldResolution: pressureFieldResolution.pressureFieldResolution,
    pressureGradientStatus: pressureFieldResolution.pressureGradientStatus,
    localPressureGradientSchema: pressureFieldResolution.localPressureGradientSchema,
    localPressureGradientReady: pressureFieldResolution.localPressureGradientReady,
    localPressureGradientStatus: pressureFieldResolution.localPressureGradientStatus,
    localPressureGradientBlockers: pressureFieldResolution.localPressureGradientBlockers,
    localPressureGradientForceCouplingStatus: gasReady && interfaceReady && !strictGateBlocked
      ? pressureFieldResolution.localPressureGradientForceCouplingStatus
      : forceCouplingStatus,
    pressureGaugePa: Number.isFinite(pressureFeedback?.pressureGaugePa) ? pressureFeedback.pressureGaugePa : null,
    materialInterfaceFieldSchema: materialInterfaceField?.schema ?? null,
    materialInterfaceFieldStatus: materialInterfaceField?.status ?? null,
    materialInterfaceReadySurfaceCount: materialInterfaceField?.readySurfaceCount ?? 0,
    materialInterfaceTotalSurfaceAreaM2: materialInterfaceField?.totalSurfaceAreaM2 ?? 0,
    materialInterfaceSurfaceCount: materialInterfaceField?.surfaceCount ?? 0,
    strictReactionGateStatus: pressureFeedback?.strictReactionGateStatus ?? null,
    strictReactionGateBlockers: [...(pressureFeedback?.strictReactionGateBlockers || [])],
    forceCouplingStatus,
    forceCouplingPrerequisites: [
      'strict-reaction-gate-pass',
      'gas-cell-pressure-field-ready',
      'material-interface-field-ready',
      'pressure-force-solver'
    ],
    uniformPressureForceCouplingStatus: forceCouplingStatus,
    forceResolution: gasReady && interfaceReady && !strictGateBlocked
      ? (pressureFieldResolution.localPressureGradientReady
          ? 'local-gradient-interface-traction'
          : 'uniform-interface-traction')
      : 'blocked',
    localPressureGradientValidation: pressureFieldResolution.localPressureGradientReady,
    forceCouplingValidation: false,
    scientificValidation: false,
    gasValidation: false,
    sphValidation: false,
    fullPhysicsValidation: false
  };
}

function addVector3(left, right) {
  return [
    left[0] + right[0],
    left[1] + right[1],
    left[2] + right[2]
  ];
}

function vectorMagnitude3(value) {
  return Math.hypot(value[0], value[1], value[2]);
}

function cleanVector3(value, epsilon = 1e-12) {
  return value.map((component) => (Math.abs(component) <= epsilon ? 0 : component));
}

export function gasPressureInterfaceForcePreview({
  pressureFeedback = null,
  materialInterfaceField = null,
  pressureInterfaceCoupling = null,
  algorithmMaterialContactRows = null,
  algorithmContactPairResponseScale = undefined,
  algorithmContactMaxPressurePa = undefined
} = {}) {
  const coupling = pressureInterfaceCoupling || gasPressureInterfaceCouplingSummary({
    pressureFeedback,
    materialInterfaceField
  });
  const pressureFieldResolution = gasPressureFieldResolutionDiagnostics(pressureFeedback?.gasCellField);
  const fallbackPressurePa = Number(pressureFeedback?.gasCellField?.uniformPressurePa ?? pressureFeedback?.totalPressurePa);
  const algorithmContactPolicy = normalizeAlgorithmContactPairResponsePolicy({
    algorithmMaterialContactRows,
    algorithmContactPairResponseScale,
    algorithmContactMaxPressurePa
  });
  const canPreview = coupling.status === 'pressure-interface-coupling-ready-for-solver'
    && Number.isFinite(fallbackPressurePa)
    && fallbackPressurePa >= 0
    && Array.isArray(materialInterfaceField?.elements)
    && materialInterfaceField.elements.length > 0;
  const forceBySurface = new Map();
  let netForceN = [0, 0, 0];
  let totalAbsInterfaceForceN = 0;
  let previewedElementCount = 0;
  let minInterfacePressurePa = Number.POSITIVE_INFINITY;
  let maxInterfacePressurePa = Number.NEGATIVE_INFINITY;
  let algorithmContactForceRowCount = 0;
  let maxAlgorithmContactPressurePa = 0;
  let interfaceContactKinematicsReadyCount = 0;
  const algorithmContactPairKeys = new Set();
  if (canPreview) {
    for (const element of materialInterfaceField.elements) {
      if (element?.status !== 'interface-element-ready' || !(element.areaM2 > 0)) continue;
      const centroidM = Array.isArray(element.centroidM) ? element.centroidM : [0, 0, 0];
      const pressureSample = pressureAtInterfaceCentroid({
        pressureFeedback,
        centroidM,
        fallbackPressurePa
      });
      const elementKinematics = interfaceContactKinematicsForElement(element);
      if (elementKinematics.status === 'interface-contact-kinematics-ready') {
        interfaceContactKinematicsReadyCount += 1;
      }
      const contactResponse = algorithmContactPairResponseForElement(element, algorithmContactPolicy);
      const algorithmContactPressurePa = Math.max(0, Number(contactResponse.contactPressurePa) || 0);
      const pressurePa = pressureSample.pressurePa + algorithmContactPressurePa;
      if (algorithmContactPressurePa > 0) {
        algorithmContactForceRowCount += 1;
        maxAlgorithmContactPressurePa = Math.max(maxAlgorithmContactPressurePa, algorithmContactPressurePa);
        if (contactResponse.row?.pairKey) algorithmContactPairKeys.add(contactResponse.row.pairKey);
      }
      minInterfacePressurePa = Math.min(minInterfacePressurePa, pressurePa);
      maxInterfacePressurePa = Math.max(maxInterfacePressurePa, pressurePa);
      const normalArea = Array.isArray(element.normalAreaVectorM2)
        ? element.normalAreaVectorM2
        : (Array.isArray(element.normal)
            ? element.normal.map((component) => component * element.areaM2)
            : [0, 0, 0]);
      const forceVectorN = normalArea.map((component) => -pressurePa * component);
      const forceMagnitudeN = vectorMagnitude3(forceVectorN);
      netForceN = addVector3(netForceN, forceVectorN);
      totalAbsInterfaceForceN += forceMagnitudeN;
      previewedElementCount += 1;
      const key = element.surfaceKey || `${element.materialId}|${element.phaseId}`;
      const row = forceBySurface.get(key) || {
        surfaceKey: key,
        material: element.material ?? null,
        phase: element.phase ?? null,
        elementCount: 0,
        areaM2: 0,
        netForceN: [0, 0, 0],
        totalAbsForceN: 0
      };
      row.elementCount += 1;
      row.areaM2 += element.areaM2;
      row.netForceN = addVector3(row.netForceN, forceVectorN);
      row.totalAbsForceN += forceMagnitudeN;
      forceBySurface.set(key, row);
    }
  }
  return {
    schema: ULG_SPH_PRESSURE_INTERFACE_FORCE_PREVIEW_SCHEMA,
    status: canPreview ? 'pressure-interface-force-preview-ready' : 'pressure-interface-force-preview-blocked',
    forceApplicationStatus: 'not-applied-diagnostic-preview',
    pressureInterfaceCouplingStatus: coupling.status,
    forceCouplingStatus: coupling.forceCouplingStatus,
    gasInterfacePressurePa: Number.isFinite(fallbackPressurePa) ? fallbackPressurePa : null,
    gasInterfacePressureRangePa: previewedElementCount > 0
      ? [minInterfacePressurePa, maxInterfacePressurePa]
      : null,
    pressureFieldMode: pressureFieldResolution.pressureFieldMode,
    pressureFieldResolution: pressureFieldResolution.pressureFieldResolution,
    pressureGradientStatus: pressureFieldResolution.pressureGradientStatus,
    localPressureGradientSchema: pressureFieldResolution.localPressureGradientSchema,
    localPressureGradientReady: pressureFieldResolution.localPressureGradientReady,
    localPressureGradientStatus: pressureFieldResolution.localPressureGradientStatus,
    localPressureGradientBlockers: pressureFieldResolution.localPressureGradientBlockers,
    localPressureGradientForceCouplingStatus: pressureFieldResolution.localPressureGradientForceCouplingStatus,
    sourceInterfaceElementCount: materialInterfaceField?.elementCount ?? materialInterfaceField?.elements?.length ?? 0,
    previewedElementCount,
    algorithmContactPairResponseSchema: algorithmContactPolicy.schema,
    algorithmContactPairResponseStatus: algorithmContactForceRowCount > 0
      ? 'algorithm-contact-pair-response-applied'
      : algorithmContactPolicy.status,
    algorithmContactPolicyRowsSchema: algorithmMaterialContactRows?.schema ?? null,
    algorithmContactPolicyRowsStatus: algorithmMaterialContactRows?.status ?? null,
    algorithmContactPolicyRowCount: algorithmContactPolicy.rowCount,
    algorithmContactForceRowCount,
    algorithmContactPairKeys: [...algorithmContactPairKeys],
    maxAlgorithmContactPressurePa,
    interfaceContactKinematicsStatus: interfaceContactKinematicsReadyCount > 0
      ? 'interface-contact-kinematics-ready'
      : 'interface-contact-kinematics-unavailable',
    interfaceContactKinematicsReadyCount,
    interfaceContactKinematicsRowCount: previewedElementCount,
    surfaceForceCount: forceBySurface.size,
    totalInterfaceAreaM2: materialInterfaceField?.totalSurfaceAreaM2 ?? 0,
    totalAbsInterfaceForceN,
    netForceN,
    surfaceForces: [...forceBySurface.values()],
    forceDerivation: pressureFieldResolution.localPressureGradientReady
      ? `local-gas-cell-pressure-gradient-times-interface-normal-area-vector${algorithmContactForceRowCount > 0 ? '-plus-algorithm-contact-pair-response' : ''}`
      : `uniform-gas-pressure-times-interface-normal-area-vector${algorithmContactForceRowCount > 0 ? '-plus-algorithm-contact-pair-response' : ''}`,
    forceResolution: pressureFieldResolution.localPressureGradientReady
      ? `local-gradient-interface-traction${algorithmContactForceRowCount > 0 ? '+algorithm-contact-pair-response' : ''}`
      : `uniform-interface-traction${algorithmContactForceRowCount > 0 ? '+algorithm-contact-pair-response' : ''}`,
    localPressureGradientValidation: pressureFieldResolution.localPressureGradientReady,
    forceCouplingValidation: false,
    scientificValidation: false,
    gasValidation: false,
    sphValidation: false,
    fullPhysicsValidation: false
  };
}

export function gasPressureInterfaceForceSolver({
  pressureFeedback = null,
  materialInterfaceField = null,
  pressureInterfaceCoupling = null,
  algorithmMaterialContactRows = null,
  algorithmContactPairResponseScale = undefined,
  algorithmContactMaxPressurePa = undefined
} = {}) {
  const coupling = pressureInterfaceCoupling || gasPressureInterfaceCouplingSummary({
    pressureFeedback,
    materialInterfaceField
  });
  const pressureFieldResolution = gasPressureFieldResolutionDiagnostics(pressureFeedback?.gasCellField);
  const fallbackPressurePa = Number(pressureFeedback?.gasCellField?.uniformPressurePa ?? pressureFeedback?.totalPressurePa);
  const algorithmContactPolicy = normalizeAlgorithmContactPairResponsePolicy({
    algorithmMaterialContactRows,
    algorithmContactPairResponseScale,
    algorithmContactMaxPressurePa
  });
  const canSolve = coupling.status === 'pressure-interface-coupling-ready-for-solver'
    && Number.isFinite(fallbackPressurePa)
    && fallbackPressurePa >= 0
    && Array.isArray(materialInterfaceField?.elements)
    && materialInterfaceField.elements.length > 0;
  const forceRows = [];
  const forceRowValues = [];
  const forceBySurface = new Map();
  let netMaterialForceN = [0, 0, 0];
  let netGasReactionForceN = [0, 0, 0];
  let totalAbsMaterialForceN = 0;
  let maxPairResidualN = 0;
  let minInterfacePressurePa = Number.POSITIVE_INFINITY;
  let maxInterfacePressurePa = Number.NEGATIVE_INFINITY;
  let algorithmContactForceRowCount = 0;
  let maxAlgorithmContactPressurePa = 0;
  let interfaceContactKinematicsReadyCount = 0;
  const algorithmContactPairKeys = new Set();
  if (canSolve) {
    for (const element of materialInterfaceField.elements) {
      if (element?.status !== 'interface-element-ready' || !(element.areaM2 > 0)) continue;
      const centroidM = Array.isArray(element.centroidM) ? element.centroidM : [0, 0, 0];
      const pressureSample = pressureAtInterfaceCentroid({
        pressureFeedback,
        centroidM,
        fallbackPressurePa
      });
      const elementKinematics = interfaceContactKinematicsForElement(element);
      if (elementKinematics.status === 'interface-contact-kinematics-ready') {
        interfaceContactKinematicsReadyCount += 1;
      }
      const contactResponse = algorithmContactPairResponseForElement(element, algorithmContactPolicy);
      const algorithmContactPressurePa = Math.max(0, Number(contactResponse.contactPressurePa) || 0);
      const pressurePa = pressureSample.pressurePa + algorithmContactPressurePa;
      if (algorithmContactPressurePa > 0) {
        algorithmContactForceRowCount += 1;
        maxAlgorithmContactPressurePa = Math.max(maxAlgorithmContactPressurePa, algorithmContactPressurePa);
        if (contactResponse.row?.pairKey) algorithmContactPairKeys.add(contactResponse.row.pairKey);
      }
      minInterfacePressurePa = Math.min(minInterfacePressurePa, pressurePa);
      maxInterfacePressurePa = Math.max(maxInterfacePressurePa, pressurePa);
      const normalArea = Array.isArray(element.normalAreaVectorM2)
        ? element.normalAreaVectorM2
        : (Array.isArray(element.normal)
            ? element.normal.map((component) => component * element.areaM2)
            : [0, 0, 0]);
      const materialForceN = cleanVector3(normalArea.map((component) => -pressurePa * component));
      const gasReactionForceN = cleanVector3(materialForceN.map((component) => -component));
      const pairResidualN = cleanVector3(addVector3(materialForceN, gasReactionForceN));
      maxPairResidualN = Math.max(maxPairResidualN, vectorMagnitude3(pairResidualN));
      netMaterialForceN = addVector3(netMaterialForceN, materialForceN);
      netGasReactionForceN = addVector3(netGasReactionForceN, gasReactionForceN);
      totalAbsMaterialForceN += vectorMagnitude3(materialForceN);
      const row = {
        index: forceRows.length,
        surfaceIndex: Number.isFinite(element.surfaceIndex) ? element.surfaceIndex : 0,
        surfaceKey: element.surfaceKey || `${element.materialId}|${element.phaseId}`,
        material: element.material ?? null,
        phase: element.phase ?? null,
        materialId: Number.isFinite(element.materialId) ? element.materialId : 0,
        phaseId: Number.isFinite(element.phaseId) ? element.phaseId : 0,
        axisId: Number.isFinite(element.axisId) ? element.axisId : 0,
        centroidM: [...centroidM],
        areaM2: element.areaM2,
        pressurePa,
        gasInterfacePressurePa: pressureSample.pressurePa,
        algorithmContactPressurePa,
        algorithmContactPairKey: contactResponse.row?.pairKey ?? null,
        algorithmContactPairResponseStatus: contactResponse.status,
        interfaceContactKinematicsStatus: elementKinematics.status,
        interfaceContactGapM: contactResponse.dynamicPressure?.gapM ?? null,
        interfaceContactNormalVelocityMPerS: contactResponse.dynamicPressure?.normalVelocityMPerS ?? null,
        pressureFieldMode: pressureFieldResolution.pressureFieldMode,
        pressureSource: pressureSample.pressureSource,
        pressureCellIndex: pressureSample.pressureCellIndex,
        pressureGradientPaPerM: pressureSample.pressureGradientPaPerM,
        materialForceN,
        gasReactionForceN,
        pairResidualN,
        status: 'pressure-interface-force-row-ready'
      };
      forceRows.push(row);
      forceRowValues.push(
        row.surfaceIndex,
        row.materialId,
        row.phaseId,
        row.axisId,
        row.centroidM[0],
        row.centroidM[1],
        row.centroidM[2],
        row.areaM2,
        row.materialForceN[0],
        row.materialForceN[1],
        row.materialForceN[2],
        row.gasReactionForceN[0],
        row.gasReactionForceN[1],
        row.gasReactionForceN[2],
        row.pressurePa,
        1
      );
      const surface = forceBySurface.get(row.surfaceKey) || {
        surfaceKey: row.surfaceKey,
        material: row.material,
        phase: row.phase,
        forceRowCount: 0,
        areaM2: 0,
        netMaterialForceN: [0, 0, 0],
        netGasReactionForceN: [0, 0, 0],
        totalAbsMaterialForceN: 0
      };
      surface.forceRowCount += 1;
      surface.areaM2 += row.areaM2;
      surface.netMaterialForceN = addVector3(surface.netMaterialForceN, materialForceN);
      surface.netGasReactionForceN = addVector3(surface.netGasReactionForceN, gasReactionForceN);
      surface.totalAbsMaterialForceN += vectorMagnitude3(materialForceN);
      forceBySurface.set(row.surfaceKey, surface);
    }
  }
  netMaterialForceN = cleanVector3(netMaterialForceN);
  netGasReactionForceN = cleanVector3(netGasReactionForceN);
  const conservationResidualN = cleanVector3(addVector3(netMaterialForceN, netGasReactionForceN));
  const conservationResidualMagnitudeN = vectorMagnitude3(conservationResidualN);
  const ready = canSolve && forceRows.length > 0;
  return {
    schema: ULG_SPH_PRESSURE_INTERFACE_FORCE_SOLVER_SCHEMA,
    status: ready ? 'pressure-interface-force-solver-ready' : 'pressure-interface-force-solver-blocked',
    forceApplicationStatus: ready ? 'solver-ready-not-applied' : 'not-applied-solver-blocked',
    pressureInterfaceCouplingStatus: coupling.status,
    forceCouplingStatus: ready
      ? 'pressure-force-solver-ready-not-applied'
      : coupling.forceCouplingStatus,
    gasInterfacePressurePa: Number.isFinite(fallbackPressurePa) ? fallbackPressurePa : null,
    gasInterfacePressureRangePa: ready
      ? [minInterfacePressurePa, maxInterfacePressurePa]
      : null,
    pressureFieldMode: pressureFieldResolution.pressureFieldMode,
    pressureFieldResolution: pressureFieldResolution.pressureFieldResolution,
    pressureGradientStatus: pressureFieldResolution.pressureGradientStatus,
    localPressureGradientSchema: pressureFieldResolution.localPressureGradientSchema,
    localPressureGradientReady: pressureFieldResolution.localPressureGradientReady,
    localPressureGradientStatus: pressureFieldResolution.localPressureGradientStatus,
    localPressureGradientBlockers: pressureFieldResolution.localPressureGradientBlockers,
    localPressureGradientForceCouplingStatus: pressureFieldResolution.localPressureGradientForceCouplingStatus,
    sourceInterfaceElementCount: materialInterfaceField?.elementCount ?? materialInterfaceField?.elements?.length ?? 0,
    algorithmContactPairResponseSchema: algorithmContactPolicy.schema,
    algorithmContactPairResponseStatus: algorithmContactForceRowCount > 0
      ? 'algorithm-contact-pair-response-applied'
      : algorithmContactPolicy.status,
    algorithmContactPolicyRowsSchema: algorithmMaterialContactRows?.schema ?? null,
    algorithmContactPolicyRowsStatus: algorithmMaterialContactRows?.status ?? null,
    algorithmContactPolicyRowCount: algorithmContactPolicy.rowCount,
    algorithmContactForceRowCount,
    algorithmContactPairKeys: [...algorithmContactPairKeys],
    maxAlgorithmContactPressurePa,
    interfaceContactKinematicsStatus: interfaceContactKinematicsReadyCount > 0
      ? 'interface-contact-kinematics-ready'
      : 'interface-contact-kinematics-unavailable',
    interfaceContactKinematicsReadyCount,
    interfaceContactKinematicsRowCount: forceRows.length,
    forceRowCount: forceRows.length,
    forceRowLayout: [...SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT],
    forceRowStrideFloats: SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT.length,
    forceRows,
    forceRowValues: Float32Array.from(forceRowValues),
    surfaceForceCount: forceBySurface.size,
    surfaceForces: [...forceBySurface.values()],
    totalInterfaceAreaM2: materialInterfaceField?.totalSurfaceAreaM2 ?? 0,
    totalAbsMaterialForceN,
    netMaterialForceN,
    netGasReactionForceN,
    conservationResidualN,
    conservationResidualMagnitudeN,
    maxPairResidualN,
    conservationStatus: ready && maxPairResidualN <= 1e-9
      ? 'pairwise-equal-opposite-force-conservative'
      : (ready ? 'pairwise-force-residual-nonzero' : 'not-evaluated'),
    forceDerivation: pressureFieldResolution.localPressureGradientReady
      ? `local-gas-cell-pressure-gradient-interface-normal-area-with-equal-opposite-gas-reaction${algorithmContactForceRowCount > 0 ? '-plus-algorithm-contact-pair-response' : ''}`
      : `uniform-gas-pressure-interface-normal-area-with-equal-opposite-gas-reaction${algorithmContactForceRowCount > 0 ? '-plus-algorithm-contact-pair-response' : ''}`,
    forceResolution: pressureFieldResolution.localPressureGradientReady
      ? `local-gradient-interface-traction${algorithmContactForceRowCount > 0 ? '+algorithm-contact-pair-response' : ''}`
      : `uniform-interface-traction${algorithmContactForceRowCount > 0 ? '+algorithm-contact-pair-response' : ''}`,
    forceApplicationTarget: 'pending-mls-mpm-grid-force-consumer',
    localPressureGradientValidation: pressureFieldResolution.localPressureGradientReady,
    forceCouplingValidation: false,
    scientificValidation: false,
    gasValidation: false,
    sphValidation: false,
    fullPhysicsValidation: false
  };
}

export function gasPressureFeedbackSummary({
  pressureSummary = null,
  boxDimsM = null,
  externalPressurePa = PHYSICAL_CONSTANTS.standardAtmospherePa,
  source = null,
  materialInterfaceField = null
} = {}) {
  const totalPressurePa = Number(pressureSummary?.totalPressurePa);
  const strictReactionGate = pressureSummary?.strictReactionGate || null;
  const strictGateBlocked = strictReactionGate?.status && strictReactionGate.status !== 'strict-reaction-gate-pass';
  const dims = pressureBoxDimensionsM(boxDimsM || pressureSummary?.boxDimsM, pressureSummary?.boxVolumeM3);
  const usable = Number.isFinite(totalPressurePa) && dims.every((value) => value > 0);
  const pressureGaugePa = usable ? totalPressurePa - finitePositive(externalPressurePa, PHYSICAL_CONSTANTS.standardAtmospherePa) : 0;
  const gasCellField = gasPressureCellFieldSummary({
    pressureSummary,
    boxDimsM: dims,
    externalPressurePa,
    source
  });
  let netForce = [0, 0, 0];
  let totalAbsWallForceN = 0;
  const wallLedger = PRESSURE_WALL_FACES.map((face) => {
    const areaM2 = dims[face.areaAxes[0]] * dims[face.areaAxes[1]];
    const forceN = pressureGaugePa * areaM2;
    const forceVectorN = face.normal.map((component) => component * forceN);
    netForce = netForce.map((component, index) => component + forceVectorN[index]);
    totalAbsWallForceN += Math.abs(forceN);
    return {
      faceId: face.faceId,
      normal: [...face.normal],
      areaM2,
      pressureGaugePa,
      forceN,
      forceVectorN,
      role: pressureGaugePa > 0 ? 'outward-load' : (pressureGaugePa < 0 ? 'inward-load' : 'balanced')
    };
  });
  const feedback = {
    schema: 'peercompute.ulg.sph-sealed-gas-pressure-feedback.v0',
    status: usable ? 'wall-pressure-ledger-ready' : 'wall-pressure-ledger-unavailable',
    source: source || pressureSummary?.source || 'gas-pressure-summary',
    totalPressurePa: Number.isFinite(totalPressurePa) ? totalPressurePa : null,
    externalPressurePa: finitePositive(externalPressurePa, PHYSICAL_CONSTANTS.standardAtmospherePa),
    pressureGaugePa,
    boxDimsM: dims,
    wallLedger,
    totalAbsWallForceN,
    netForceN: netForce,
    gasCellField,
    pressureGradientStatus: gasCellField.gradientStatus,
    pressureFieldMode: gasCellField.pressureFieldMode,
    pressureFieldResolution: gasCellField.pressureFieldResolution,
    localPressureGradientSchema: gasCellField.localPressureGradientSchema,
    localPressureGradientReady: gasCellField.localPressureGradientReady,
    localPressureGradientStatus: gasCellField.localPressureGradientStatus,
    localPressureGradientBlockers: [...(gasCellField.localPressureGradientBlockers || [])],
    localPressureGradientForceCouplingStatus: gasCellField.localPressureGradientForceCouplingStatus,
    forceCouplingPrerequisites: [
      'strict-reaction-gate-pass',
      'gas-cell-pressure-field-ready',
      'material-surface-normals-and-areas'
    ],
    strictReactionGateStatus: strictReactionGate?.status ?? null,
    strictReactionGateBlockers: [...(strictReactionGate?.blockers || [])],
    forceCouplingStatus: strictGateBlocked
      ? 'blocked-strict-reaction-gate'
      : gasCellField.materialSurfaceCouplingStatus,
    wallLedgerValidation: false,
    localPressureGradientValidation: false,
    forceCouplingValidation: false,
    scientificValidation: false,
    gasValidation: false,
    sphValidation: false,
    fullPhysicsValidation: false
  };
  feedback.pressureInterfaceCoupling = gasPressureInterfaceCouplingSummary({
    pressureFeedback: feedback,
    materialInterfaceField
  });
  feedback.forceCouplingStatus = feedback.pressureInterfaceCoupling.forceCouplingStatus;
  return feedback;
}

function finalizeGasPressureSummary({
  species,
  gasVolumeM3,
  condensedVolumeM3,
  boxVolumeM3,
  boxDimsM = null,
  status = 'closure-derived-gas-pressure-diagnostic',
  source = 'cpu-particle-state',
  fullParticleReadbackPerformed = true,
  baselineSummary = null,
  residentLedger = null,
  spatialGasSpeciesLedger = null,
  gasCellField = null,
  externalPressurePa = PHYSICAL_CONSTANTS.standardAtmospherePa
}) {
  let totalPressurePa = 0;
  const bySpecies = {};
  for (const [material, item] of Object.entries(species || {})) {
    const temperatureK = item.moles > 0 ? item.temperatureMoleK / item.moles : 0;
    const partialPressurePa = item.moles * PHYSICAL_CONSTANTS.gasConstantJPerMolK * temperatureK / Math.max(gasVolumeM3, 1e-9);
    totalPressurePa += partialPressurePa;
    bySpecies[material] = {
      material,
      massKg: item.massKg,
      moles: item.moles,
      temperatureK,
      partialPressurePa
    };
  }
  const summary = {
    schema: 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0',
    status,
    source,
    fullParticleReadbackPerformed,
    totalPressurePa,
    totalPressureAtm: totalPressurePa / PHYSICAL_CONSTANTS.standardAtmospherePa,
    gasVolumeM3,
    condensedVolumeM3,
    boxVolumeM3,
    boxDimsM: pressureBoxDimensionsM(boxDimsM, boxVolumeM3),
    bySpecies,
    spatialGasSpeciesLedger: spatialGasSpeciesLedger || null,
    gasCellField: gasCellField || null,
    spatialGasSpeciesLedgerSchema: spatialGasSpeciesLedger?.schema ?? null,
    spatialGasSpeciesLedgerStatus: spatialGasSpeciesLedger?.status ?? null,
    residentSpatialGasSpeciesLedgerStatus: spatialGasSpeciesLedger?.status
      ? 'resident-spatial-gas-species-ledger-available'
      : 'blocked-resident-spatial-gas-species-ledger-required',
    baselineSummaryStatus: baselineSummary?.status ?? null,
    residentLedgerStatus: residentLedger?.status ?? null,
    strictReactionGate: residentLedger?.strictReactionGate ?? null,
    scientificValidation: false,
    gasValidation: false,
    sphValidation: false,
    fullPhysicsValidation: false
  };
  summary.pressureFeedback = gasPressureFeedbackSummary({
    pressureSummary: summary,
    boxDimsM: summary.boxDimsM,
    externalPressurePa,
    source
  });
  return summary;
}

function gasTemperatureForMaterial(material, materialProperties, fallbackTemperatureK) {
  const props = materialProperties?.[material] || materialProperties?.[String(material).toLowerCase()] || null;
  const phase = props?.phases?.find((candidate) => candidate.name === 'gas') || null;
  return Number.isFinite(phase?.temperatureK)
    ? phase.temperatureK
    : Number.isFinite(fallbackTemperatureK)
      ? fallbackTemperatureK
      : 293.15;
}

function productTermMetadataByIndex(reactionTable) {
  const terms = Array.isArray(reactionTable?.productTermMetadata)
    ? reactionTable.productTermMetadata
    : [];
  return new Map(terms.map((term) => [term.productTermIndex, term]));
}

function isGasProductRecord(record, term = null) {
  return record?.routing === 'gas' || record?.routingId === 1 || term?.routing === 'gas';
}

function residentGasRowsFromProductEvents(reactionSummary, reactionTable) {
  const records = Array.isArray(reactionSummary?.productEvents?.records)
    ? reactionSummary.productEvents.records
    : [];
  if (!records.length) return [];
  const terms = productTermMetadataByIndex(reactionTable);
  return records
    .filter((record) => {
      const term = terms.get(record.productTermIndex) || null;
      return record?.status === 'ready'
        && isGasProductRecord(record, term)
        && ((Number(record.moles) || 0) > 0 || (Number(record.massKg) || 0) > 0);
    })
    .map((record) => ({
      material: record.material,
      materialId: record.materialId,
      massKg: Number(record.massKg) || 0,
      moles: Number(record.moles) || 0,
      visibleMassKg: Number(record.visibleMassKg) || 0,
      unplacedMassKg: Number(record.unplacedMassKg) || 0,
      temperatureK: Number(record.temperatureK) || null,
      positionM: Array.isArray(record.positionM) ? vector3From(record.positionM) : null,
      supportVolumeM3: finitePositive(record.supportVolumeM3, 0),
      productTermIndex: record.productTermIndex,
      source: 'product-events'
    }));
}

function residentGasRowsFromProductInventory(reactionSummary, reactionTable) {
  const records = Array.isArray(reactionSummary?.productInventory?.records)
    ? reactionSummary.productInventory.records
    : [];
  if (!records.length) return [];
  const terms = productTermMetadataByIndex(reactionTable);
  return records
    .filter((record) => {
      const term = terms.get(record.productTermIndex) || null;
      return record?.status === 'ready'
        && isGasProductRecord(record, term)
        && ((Number(record.moles) || 0) > 0 || (Number(record.massKg) || 0) > 0);
    })
    .map((record) => ({
      material: record.material,
      materialId: record.materialId,
      massKg: Number(record.massKg) || 0,
      moles: Number(record.moles) || 0,
      visibleMassKg: Number(record.visibleMassKg) || 0,
      unplacedMassKg: Number(record.unplacedMassKg) || 0,
      temperatureK: null,
      productTermIndex: record.productTermIndex,
      source: 'product-inventory'
    }));
}

function spatialGasSpeciesLedgerFromProductEventRows(productEventGasRows = [], {
  boxDimsM = null,
  source = 'gpu-resident-reaction-product-events',
  retainedSpatialGasSourceBufferRefs = [],
  workerRetainedSpatialGasSourceBufferRefs = []
} = {}) {
  const dims = pressureBoxDimensionsM(boxDimsM, null);
  if (!dims.every((value) => value > 0)) return null;
  const rows = productEventGasRows.filter((row) => (
    Array.isArray(row.positionM)
    && row.positionM.length === 3
    && row.positionM.every((value) => Number.isFinite(Number(value)))
    && finitePositive(row.supportVolumeM3, 0) > 0
    && (Number(row.moles) || 0) > 0
  ));
  if (!rows.length) return null;
  const meanSupportVolumeM3 = rows.reduce((sum, row) => sum + finitePositive(row.supportVolumeM3, 0), 0) / rows.length;
  const supportEdgeM = Math.cbrt(Math.max(meanSupportVolumeM3, 1e-12));
  const cellDims = dims.map((dim) => Math.max(1, Math.ceil(dim / supportEdgeM)));
  const buckets = new Map();
  for (const row of rows) {
    const position = vector3From(row.positionM);
    const gridIndex = [0, 1, 2].map((axis) => {
      const normalized = dims[axis] > 0 ? position[axis] / dims[axis] : 0;
      return Math.max(0, Math.min(cellDims[axis] - 1, Math.floor(normalized * cellDims[axis])));
    });
    const key = gridKey(gridIndex);
    const bucket = buckets.get(key) || {
      index: buckets.size,
      gridIndex,
      weightedPositionM: [0, 0, 0],
      weightMoles: 0,
      volumeM3: 0,
      bySpecies: {},
      sourceEventCount: 0
    };
    const moles = Number(row.moles) || 0;
    bucket.weightMoles += moles;
    bucket.volumeM3 += finitePositive(row.supportVolumeM3, 0);
    bucket.weightedPositionM = bucket.weightedPositionM.map((value, axis) => value + position[axis] * moles);
    const material = String(row.material || Math.round(row.materialId || 0)).toLowerCase();
    const species = bucket.bySpecies[material] || (bucket.bySpecies[material] = {
      material,
      materialId: row.materialId ?? null,
      massKg: 0,
      moles: 0,
      temperatureMoleK: 0,
      eventCount: 0
    });
    species.massKg += Number(row.massKg) || 0;
    species.moles += moles;
    species.temperatureMoleK += moles * (Number(row.temperatureK) || 293.15);
    species.eventCount += 1;
    bucket.sourceEventCount += 1;
    buckets.set(key, bucket);
  }
  const cells = [...buckets.values()].map((bucket) => ({
    index: bucket.index,
    gridIndex: bucket.gridIndex,
    centerM: bucket.weightMoles > 0
      ? bucket.weightedPositionM.map((value) => value / bucket.weightMoles)
      : deriveSpatialGasCellCenterM({}, bucket.gridIndex, cellDims, dims),
    volumeM3: bucket.volumeM3,
    sourceEventCount: bucket.sourceEventCount,
    bySpecies: Object.fromEntries(Object.entries(bucket.bySpecies).map(([material, row]) => [
      material,
      {
        material,
        materialId: row.materialId,
        massKg: row.massKg,
        moles: row.moles,
        temperatureK: row.moles > 0 ? row.temperatureMoleK / row.moles : 293.15,
        eventCount: row.eventCount
      }
    ]))
  }));
  if (!cells.length) return null;
  return {
    schema: RESIDENT_SPATIAL_GAS_SPECIES_LEDGER_SCHEMA,
    status: 'spatial-gas-species-ledger-ready',
    source,
    retainedSpatialGasSourceBufferRefs: uniqueStringsFrom(retainedSpatialGasSourceBufferRefs),
    workerRetainedSpatialGasSourceBufferRefs: uniqueStringsFrom(workerRetainedSpatialGasSourceBufferRefs),
    spatialGasSourceBufferRetained: uniqueStringsFrom(
      retainedSpatialGasSourceBufferRefs,
      workerRetainedSpatialGasSourceBufferRefs
    ).length > 0,
    cellDims,
    cellCount: cells.length,
    cells,
    sourceEventRowCount: rows.length,
    pressureClosure: 'ideal-gas-law-per-cell',
    spatialGasSpeciesLedgerValidation: false,
    scientificValidation: false,
    gasValidation: false,
    fullPhysicsValidation: false
  };
}

function addBaselineGasSpecies(species, baselineSummary = null, fallbackTemperatureK = 293.15) {
  for (const [baselineMaterial, item] of Object.entries(baselineSummary?.bySpecies || {})) {
    addGasSpecies(species, baselineMaterial, {
      massKg: Number(item.massKg) || 0,
      moles: Number(item.moles) || 0,
      temperatureK: Number(item.temperatureK) || fallbackTemperatureK
    });
  }
}

function addSpatialGasSpeciesLedgerSpecies(species, spatialGasSpeciesLedger, fallbackTemperatureK = 293.15) {
  const materialKeys = new Set();
  let rowCount = 0;
  let moles = 0;
  let massKg = 0;
  for (const cell of spatialGasSpeciesLedger?.cells || []) {
    for (const row of gasCellSpeciesRows(cell)) {
      const rowMoles = Number(row?.moles) || 0;
      if (!(rowMoles > 0)) continue;
      const material = String(row?.material || Math.round(Number(row?.materialId) || 0)).toLowerCase();
      const temperatureK = Number.isFinite(Number(row?.temperatureK))
        ? Number(row.temperatureK)
        : (Number.isFinite(Number(cell?.temperatureK)) ? Number(cell.temperatureK) : fallbackTemperatureK);
      const rowMassKg = Number(row?.massKg) || 0;
      addGasSpecies(species, material, {
        massKg: rowMassKg,
        moles: rowMoles,
        temperatureK
      });
      materialKeys.add(material);
      rowCount += 1;
      moles += rowMoles;
      massKg += rowMassKg;
    }
  }
  return {
    rowCount,
    materialCount: materialKeys.size,
    materials: [...materialKeys],
    moles,
    massKg
  };
}

function gasPressureSummaryFromSpatialGasSpeciesLedger({
  baselineSummary = null,
  residentLedger = null,
  spatialGasSpeciesLedger = null,
  gasCellField = null,
  fallbackTemperatureK = 293.15,
  status = 'gpu-resident-pressure-interface-spatial-gas-summary',
  source = 'gpu-resident-pressure-interface-spatial-gas-ledger'
} = {}) {
  if (!spatialGasSpeciesLedgerReady(spatialGasSpeciesLedger)) return null;
  const species = {};
  addBaselineGasSpecies(species, baselineSummary, fallbackTemperatureK);
  const aggregate = addSpatialGasSpeciesLedgerSpecies(species, spatialGasSpeciesLedger, fallbackTemperatureK);
  if (!(aggregate.moles > 0)) return null;
  const baselineGasVolumeM3 = Number(baselineSummary?.gasVolumeM3) || 0;
  const gasVolumeM3 = Math.max(baselineGasVolumeM3, 1e-9);
  const pressure = finalizeGasPressureSummary({
    species,
    gasVolumeM3,
    condensedVolumeM3: Number(baselineSummary?.condensedVolumeM3) || 0,
    boxVolumeM3: Number(baselineSummary?.boxVolumeM3) || gasVolumeM3,
    boxDimsM: baselineSummary?.boxDimsM || spatialGasSpeciesLedger?.boxDimsM || null,
    status,
    source,
    fullParticleReadbackPerformed: false,
    baselineSummary,
    residentLedger,
    spatialGasSpeciesLedger,
    gasCellField
  });
  return {
    ...pressure,
    pressureInterfaceSpatialGasLedgerPromoted: true,
    pressureInterfaceSpatialGasLedgerSource: spatialGasSpeciesLedger.source || null,
    pressureInterfaceSpatialGasLedgerCellCount: Array.isArray(spatialGasSpeciesLedger.cells)
      ? spatialGasSpeciesLedger.cells.length
      : 0,
    pressureInterfaceSpatialGasSpeciesRowCount: aggregate.rowCount,
    residentGasSpeciesCount: aggregate.materialCount,
    residentGasSpeciesLedgerSource: source,
    residentProductMassStatus: residentLedger?.status ?? null,
    retainedSpatialGasSourceBufferRefs: spatialGasSpeciesLedger?.retainedSpatialGasSourceBufferRefs ?? [],
    workerRetainedSpatialGasSourceBufferRefs: spatialGasSpeciesLedger?.workerRetainedSpatialGasSourceBufferRefs ?? [],
    spatialGasSourceBufferRetained: spatialGasSpeciesLedger?.spatialGasSourceBufferRetained === true,
    pressureInterfaceGasCellFieldStatus: gasCellField?.status ?? pressure.pressureFeedback?.gasCellField?.status ?? null,
    pressureInterfaceGasCellFieldLocalPressureGradientReady: gasCellField?.localPressureGradientReady === true
      || pressure.pressureFeedback?.gasCellField?.localPressureGradientReady === true,
    residentSpatialGasSpeciesLedgerStatus: spatialGasSpeciesLedger?.status ?? 'blocked-resident-spatial-gas-species-ledger-required',
    residentGasSpecies: aggregate.materials.map((material) => ({
      material,
      massKg: species[material]?.massKg ?? 0,
      moles: species[material]?.moles ?? 0
    }))
  };
}

export function gasPressureSummaryFromResidentReaction({
  baselineSummary = null,
  reactionSummary = null,
  residentProductMass = null,
  pressureInterfaceState = null,
  spatialGasSpeciesLedger = null,
  gasCellField = null,
  reactionTable = null,
  materialProperties = {},
  fallbackTemperatureK = 293.15
} = {}) {
  const residentProductMassGasLedger = residentProductMass?.gasSpeciesLedger?.schema
    ? residentProductMass.gasSpeciesLedger
    : null;
  const compactLedgerAvailable = Boolean(reactionSummary?.compactLedgerAvailable || residentProductMassGasLedger);
  if (!compactLedgerAvailable) {
    const pressureInterfaceLedger = spatialGasSpeciesLedger
      || spatialGasSpeciesLedgerFromPressureInterfaceState(pressureInterfaceState);
    const pressureInterfaceGasCellField = gasCellField
      || gasCellFieldFromPressureInterfaceState(pressureInterfaceState);
    const promotedPressure = gasPressureSummaryFromSpatialGasSpeciesLedger({
      baselineSummary,
      residentLedger: residentProductMass || reactionSummary,
      spatialGasSpeciesLedger: pressureInterfaceLedger,
      gasCellField: pressureInterfaceGasCellField,
      fallbackTemperatureK
    });
    if (promotedPressure) return promotedPressure;
    return {
      ...(baselineSummary || {}),
      schema: baselineSummary?.schema || 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0',
      status: 'gpu-resident-reaction-pressure-unavailable',
      source: 'baseline-no-resident-reaction-ledger',
      fullParticleReadbackPerformed: Boolean(baselineSummary?.fullParticleReadbackPerformed)
    };
  }
  const pressureGasLedger = residentProductMassGasLedger || reactionSummary?.gasSpeciesLedger || null;
  const pressureGasLedgerSource = residentProductMassGasLedger
    ? 'gpu-resident-product-mass-gas-species-ledger'
    : 'gpu-resident-reaction-gas-species-summary';
  const residentGasRows = Array.isArray(pressureGasLedger?.records)
    ? pressureGasLedger.records.filter((row) => row?.status === 'ready' && ((row.moles ?? 0) > 0 || (row.massKg ?? 0) > 0))
    : (Array.isArray(pressureGasLedger)
        ? pressureGasLedger.filter((row) => row?.status === 'ready' && ((row.moles ?? 0) > 0 || (row.massKg ?? 0) > 0))
        : []);
  const residentGasSpecies = Object.values(pressureGasLedger?.bySpecies || {});
  if (residentGasRows.length > 0 || residentGasSpecies.length > 0) {
    const residentProductMassEventGasRows = residentGasRowsFromProductEvents(residentProductMass, reactionTable);
    const reactionSummaryEventGasRows = residentGasRowsFromProductEvents(reactionSummary, reactionTable);
    const spatialProductEventGasRows = residentProductMassEventGasRows.length > 0
      ? residentProductMassEventGasRows
      : reactionSummaryEventGasRows;
    const spatialGasSpeciesLedger = spatialProductEventGasRows.length > 0
      ? spatialGasSpeciesLedgerFromProductEventRows(spatialProductEventGasRows, {
          boxDimsM: baselineSummary?.boxDimsM || null,
          source: residentProductMassGasLedger
            ? 'gpu-resident-product-mass-product-event-spatial-ledger'
            : 'gpu-resident-reaction-product-event-spatial-ledger',
          retainedSpatialGasSourceBufferRefs: uniqueStringsFrom(
            reactionSummary?.retainedProductBufferRefs,
            residentProductMass?.retainedProductBufferRefs,
            hasRetainedProductEventBuffer(reactionSummary) || hasRetainedProductEventBuffer(residentProductMass)
              ? 'resident-product-mass-buffer'
              : null
          ),
          workerRetainedSpatialGasSourceBufferRefs: uniqueStringsFrom(
            reactionSummary?.workerRetainedProductBufferRefs,
            residentProductMass?.workerRetainedProductBufferRefs
          )
        })
      : null;
    const species = {};
    for (const [baselineMaterial, item] of Object.entries(baselineSummary?.bySpecies || {})) {
      addGasSpecies(species, baselineMaterial, {
        massKg: Number(item.massKg) || 0,
        moles: Number(item.moles) || 0,
        temperatureK: Number(item.temperatureK) || fallbackTemperatureK
      });
    }
    for (const row of (residentGasSpecies.length > 0 ? residentGasSpecies : residentGasRows)) {
      const material = String(row.material || Math.round(row.materialId || 0)).toLowerCase();
      const props = materialProperties?.[material] || materialProperties?.[row.material] || null;
      const phase = props?.phases?.find((candidate) => candidate.name === 'gas') || null;
      const gasTemperatureK = Number.isFinite(phase?.temperatureK)
        ? phase.temperatureK
        : Number.isFinite(fallbackTemperatureK)
          ? fallbackTemperatureK
          : 293.15;
      addGasSpecies(species, material, {
        massKg: Number(row.massKg) || 0,
        moles: Number(row.moles) || 0,
        temperatureK: gasTemperatureK
      });
    }
    const baselineGasVolumeM3 = Number(baselineSummary?.gasVolumeM3) || 0;
    const gasVolumeM3 = Math.max(baselineGasVolumeM3, 1e-9);
    return {
      ...finalizeGasPressureSummary({
        species,
        gasVolumeM3,
        condensedVolumeM3: Number(baselineSummary?.condensedVolumeM3) || 0,
        boxVolumeM3: Number(baselineSummary?.boxVolumeM3) || gasVolumeM3,
        boxDimsM: baselineSummary?.boxDimsM || null,
        status: 'gpu-resident-reaction-pressure-summary',
        source: pressureGasLedgerSource,
        fullParticleReadbackPerformed: false,
        baselineSummary,
        residentLedger: reactionSummary || residentProductMass,
        spatialGasSpeciesLedger
      }),
      residentGasSpeciesCount: residentGasSpecies.length || residentGasRows.length,
      residentGasSpeciesLedgerSource: pressureGasLedgerSource,
      residentProductMassStatus: residentProductMass?.status ?? null,
      residentProductMassGasSpeciesLedgerCount: residentProductMass?.gasSpeciesLedgerCount ?? null,
      retainedSpatialGasSourceBufferRefs: spatialGasSpeciesLedger?.retainedSpatialGasSourceBufferRefs ?? [],
      workerRetainedSpatialGasSourceBufferRefs: spatialGasSpeciesLedger?.workerRetainedSpatialGasSourceBufferRefs ?? [],
      spatialGasSourceBufferRetained: spatialGasSpeciesLedger?.spatialGasSourceBufferRetained === true,
      residentProductGasRows: spatialProductEventGasRows.map((row) => ({
        material: row.material,
        materialId: row.materialId,
        massKg: row.massKg,
        moles: row.moles,
        visibleMassKg: row.visibleMassKg,
        unplacedMassKg: row.unplacedMassKg,
        positionM: row.positionM,
        supportVolumeM3: row.supportVolumeM3,
        productTermIndex: row.productTermIndex,
        source: row.source
      })),
      residentSpatialGasSpeciesLedgerStatus: spatialGasSpeciesLedger?.status ?? 'blocked-resident-spatial-gas-species-ledger-required',
      residentGasSpecies: (residentGasSpecies.length > 0 ? residentGasSpecies : residentGasRows).map((row) => ({
        material: row.material,
        materialId: row.materialId,
        massKg: row.massKg,
        moles: row.moles,
        visibleMassKg: row.visibleMassKg,
        unplacedMassKg: row.unplacedMassKg
      })),
      residentLedgerStatus: reactionSummary?.status ?? residentProductMass?.status ?? null,
      residentLedgerGasProductMassKg: reactionSummary?.ledgerGasProductMassKg ?? residentProductMass?.unplacedGasProductMassKg ?? null,
      residentLedgerUnplacedGasProductMassKg: reactionSummary?.ledgerUnplacedGasProductMassKg ?? residentProductMass?.unplacedGasProductMassKg ?? null
    };
  }
  const productEventGasRows = residentGasRowsFromProductEvents(reactionSummary, reactionTable);
  const productInventoryGasRows = residentGasRowsFromProductInventory(reactionSummary, reactionTable);
  const productGasRows = productEventGasRows.length > 0 ? productEventGasRows : productInventoryGasRows;
  if (productGasRows.length > 0) {
    const species = {};
    for (const [baselineMaterial, item] of Object.entries(baselineSummary?.bySpecies || {})) {
      addGasSpecies(species, baselineMaterial, {
        massKg: Number(item.massKg) || 0,
        moles: Number(item.moles) || 0,
        temperatureK: Number(item.temperatureK) || fallbackTemperatureK
      });
    }
    for (const row of productGasRows) {
      const material = String(row.material || Math.round(row.materialId || 0)).toLowerCase();
      addGasSpecies(species, material, {
        massKg: row.massKg,
        moles: row.moles,
        temperatureK: Number.isFinite(row.temperatureK)
          ? row.temperatureK
          : gasTemperatureForMaterial(material, materialProperties, fallbackTemperatureK)
      });
    }
    const baselineGasVolumeM3 = Number(baselineSummary?.gasVolumeM3) || 0;
    const gasVolumeM3 = Math.max(baselineGasVolumeM3, 1e-9);
    const source = productEventGasRows.length > 0
      ? 'gpu-resident-reaction-product-events'
      : 'gpu-resident-reaction-product-inventory';
    const spatialGasSpeciesLedger = productEventGasRows.length > 0
      ? spatialGasSpeciesLedgerFromProductEventRows(productEventGasRows, {
          boxDimsM: baselineSummary?.boxDimsM || null,
          source: 'gpu-resident-reaction-product-event-spatial-ledger',
          retainedSpatialGasSourceBufferRefs: uniqueStringsFrom(
            reactionSummary?.retainedProductBufferRefs,
            residentProductMass?.retainedProductBufferRefs,
            hasRetainedProductEventBuffer(reactionSummary) || hasRetainedProductEventBuffer(residentProductMass)
              ? 'resident-product-mass-buffer'
              : null
          ),
          workerRetainedSpatialGasSourceBufferRefs: uniqueStringsFrom(
            reactionSummary?.workerRetainedProductBufferRefs,
            residentProductMass?.workerRetainedProductBufferRefs
          )
        })
      : null;
    return {
      ...finalizeGasPressureSummary({
        species,
        gasVolumeM3,
        condensedVolumeM3: Number(baselineSummary?.condensedVolumeM3) || 0,
        boxVolumeM3: Number(baselineSummary?.boxVolumeM3) || gasVolumeM3,
        boxDimsM: baselineSummary?.boxDimsM || null,
        status: 'gpu-resident-reaction-pressure-summary',
        source,
        fullParticleReadbackPerformed: false,
        baselineSummary,
        residentLedger: reactionSummary,
        spatialGasSpeciesLedger
      }),
      residentProductGasSource: source,
      residentProductGasRowCount: productGasRows.length,
      retainedSpatialGasSourceBufferRefs: spatialGasSpeciesLedger?.retainedSpatialGasSourceBufferRefs ?? [],
      workerRetainedSpatialGasSourceBufferRefs: spatialGasSpeciesLedger?.workerRetainedSpatialGasSourceBufferRefs ?? [],
      spatialGasSourceBufferRetained: spatialGasSpeciesLedger?.spatialGasSourceBufferRetained === true,
      residentProductGasRows: productGasRows.map((row) => ({
        material: row.material,
        materialId: row.materialId,
        massKg: row.massKg,
        moles: row.moles,
        visibleMassKg: row.visibleMassKg,
        unplacedMassKg: row.unplacedMassKg,
        positionM: row.positionM,
        supportVolumeM3: row.supportVolumeM3,
        productTermIndex: row.productTermIndex,
        source: row.source
      })),
      residentSpatialGasSpeciesLedgerStatus: spatialGasSpeciesLedger?.status ?? 'blocked-resident-spatial-gas-species-ledger-required',
      residentLedgerStatus: reactionSummary.status,
      residentLedgerGasProductMassKg: reactionSummary.ledgerGasProductMassKg ?? null,
      residentLedgerUnplacedGasProductMassKg: reactionSummary.ledgerUnplacedGasProductMassKg ?? null
    };
  }
  const gasMetadata = Array.isArray(reactionTable?.gasProductMetadata)
    ? reactionTable.gasProductMetadata.filter((item) => item?.status === 1)
    : [];
  if (gasMetadata.length !== 1) {
    return {
      ...(baselineSummary || {}),
      schema: baselineSummary?.schema || 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0',
      status: 'gpu-resident-reaction-pressure-insufficient-species-resolution',
      source: 'gpu-resident-reaction-summary-aggregate-only',
      fullParticleReadbackPerformed: false,
      residentGasProductMassKg: reactionSummary.ledgerGasProductMassKg ?? null,
      residentGasProductMoles: reactionSummary.sealedBoxGasProductMoles ?? null,
      residentGasSpeciesCount: gasMetadata.length,
      residentLedgerStatus: reactionSummary.status ?? null,
      scientificValidation: false,
      gasValidation: false,
      sphValidation: false,
      fullPhysicsValidation: false
    };
  }
  const gas = gasMetadata[0];
  const material = String(gas.material || Math.round(gas.materialId || 0)).toLowerCase();
  const props = materialProperties?.[material] || materialProperties?.[gas.material] || null;
  const phase = props?.phases?.find((candidate) => candidate.name === 'gas') || null;
  const gasTemperatureK = Number.isFinite(phase?.temperatureK)
    ? phase.temperatureK
    : Number.isFinite(reactionSummary.temperatureMassWeightedMeanK)
      ? reactionSummary.temperatureMassWeightedMeanK
      : Number.isFinite(fallbackTemperatureK)
        ? fallbackTemperatureK
        : 293.15;
  const species = {};
  for (const [baselineMaterial, item] of Object.entries(baselineSummary?.bySpecies || {})) {
    addGasSpecies(species, baselineMaterial, {
      massKg: Number(item.massKg) || 0,
      moles: Number(item.moles) || 0,
      temperatureK: Number(item.temperatureK) || fallbackTemperatureK
    });
  }
  const moles = Number(reactionSummary.sealedBoxGasProductMoles) || 0;
  const massKg = Number(reactionSummary.ledgerGasProductMassKg) || 0;
  addGasSpecies(species, material, {
    massKg,
    moles,
    temperatureK: gasTemperatureK
  });
  const baselineGasVolumeM3 = Number(baselineSummary?.gasVolumeM3) || 0;
  const gasVolumeM3 = Math.max(baselineGasVolumeM3, 1e-9);
  return {
    ...finalizeGasPressureSummary({
      species,
      gasVolumeM3,
      condensedVolumeM3: Number(baselineSummary?.condensedVolumeM3) || 0,
      boxVolumeM3: Number(baselineSummary?.boxVolumeM3) || gasVolumeM3,
      boxDimsM: baselineSummary?.boxDimsM || null,
      status: 'gpu-resident-reaction-pressure-summary',
      source: 'gpu-resident-reaction-summary',
      fullParticleReadbackPerformed: false,
      baselineSummary,
      residentLedger: reactionSummary
    }),
    residentGasSpeciesMaterial: material,
    residentGasProductMassKg: massKg,
    residentGasProductMoles: moles,
    residentLedgerStatus: reactionSummary.status,
    residentLedgerGasProductMassKg: reactionSummary.ledgerGasProductMassKg ?? null,
    residentLedgerUnplacedGasProductMassKg: reactionSummary.ledgerUnplacedGasProductMassKg ?? null
  };
}

/**
 * Sealed-box ideal-gas pressure diagnostic from closure-derived gas masses and temperatures.
 * Ambient air is represented as a scenario reservoir; reaction/vapor products are SPH particles.
 * This is a diagnostic ledger only until the resident gas EOS consumes the same species inventory.
 */
export function gasPressureSummary(demo) {
  const boxVolumeM3 = demo.scenario?.box?.volumeM3
    ?? ((demo.box?.dimensionsM?.[0] ?? demo.box?.edgeM ?? 0)
      * (demo.box?.dimensionsM?.[1] ?? demo.box?.edgeM ?? 0)
      * (demo.box?.dimensionsM?.[2] ?? demo.box?.edgeM ?? 0));
  const species = {};
  let condensedVolumeM3 = 0;
  for (const particle of demo.state.particles) {
    const props = demo.materialProperties[particle.material];
    if (!props) continue;
    const stablePhase = stablePhaseFromSpecificEnergy(props, particle.specificInternalEnergyJPerKg);
    if (stablePhase === 'gas') {
      const eq = cachedParticleEquilibriumFromSpecificEnergy(props, particle, particle.specificInternalEnergyJPerKg);
      const moles = props.molarMassKgPerMol > 0 ? particle.massKg / props.molarMassKgPerMol : 0;
      addGasSpecies(species, particle.material, {
        massKg: particle.massKg,
        moles,
        temperatureK: eq.temperatureK
      });
    } else {
      const density = phaseDensityKgPerM3(props, stablePhase);
      if (density) condensedVolumeM3 += particle.massKg / density;
    }
  }
  const airProps = demo.materialProperties.air;
  const airVolumeM3 = Math.max(boxVolumeM3 - demo.scenario.iron.volumeM3 - demo.scenario.ice.volumeM3, 0);
  if (airProps?.molarMassKgPerMol > 0 && airVolumeM3 > 0) {
    const airTemperatureK = demo.initialTemperaturesK?.gas ?? demo.scenario.gas.initialTemperatureK;
    const airDensity = idealGasDensityKgPerM3({
      pressurePa: demo.scenario.gas.pressurePa,
      temperatureK: airTemperatureK,
      molarMassKgPerMol: airProps.molarMassKgPerMol
    });
    const airMassKg = airVolumeM3 * airDensity;
    addGasSpecies(species, 'air', {
      massKg: airMassKg,
      moles: airMassKg / airProps.molarMassKgPerMol,
      temperatureK: airTemperatureK
    });
  }
  const gasVolumeM3 = Math.max(boxVolumeM3 - condensedVolumeM3, 1e-9);
  return finalizeGasPressureSummary({
    species,
    gasVolumeM3,
    condensedVolumeM3,
    boxVolumeM3,
    boxDimsM: demo.box?.dimensionsM || null,
    status: 'closure-derived-gas-pressure-diagnostic',
    source: 'cpu-particle-state',
    fullParticleReadbackPerformed: true
  });
}

function materialEntities(material, massKg, properties, macroParticleCount) {
  const totalEntities = properties.molarMassKgPerMol > 0
    ? (massKg / properties.molarMassKgPerMol) * 6.02214076e23
    : null;
  return {
    material,
    macroParticleCount,
    totalEntities,
    entitiesPerMacroParticle: macroParticleCount > 0 && totalEntities != null ? totalEntities / macroParticleCount : null
  };
}

function particleSupportRadiusM(particle) {
  const massKg = Number(particle.massKg);
  const restDensityKgPerM3 = Number(particle.restDensityKgPerM3);
  if (!(massKg > 0) || !(restDensityKgPerM3 > 0)) return 0;
  return 0.5 * Math.cbrt(massKg / restDensityKgPerM3);
}

function initialBlockGeometrySummary(demo) {
  const roles = {};
  for (const particle of demo.state.particles) {
    const role = particle.role || 'unassigned';
    const radius = particleSupportRadiusM(particle);
    const entry = roles[role] || {
      role,
      material: particle.material,
      count: 0,
      centerBoundsM: {
        min: [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY],
        max: [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY]
      },
      supportBoundsM: {
        min: [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY],
        max: [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY]
      }
    };
    entry.count += 1;
    entry.material = entry.material || particle.material;
    for (let axis = 0; axis < 3; axis += 1) {
      const value = Number(particle.x?.[axis]);
      if (!Number.isFinite(value)) continue;
      entry.centerBoundsM.min[axis] = Math.min(entry.centerBoundsM.min[axis], value);
      entry.centerBoundsM.max[axis] = Math.max(entry.centerBoundsM.max[axis], value);
      entry.supportBoundsM.min[axis] = Math.min(entry.supportBoundsM.min[axis], value - radius);
      entry.supportBoundsM.max[axis] = Math.max(entry.supportBoundsM.max[axis], value + radius);
    }
    roles[role] = entry;
  }

  const roleList = Object.values(roles);
  const pairs = [];
  const blockers = [];
  for (let i = 0; i < roleList.length; i += 1) {
    for (let j = i + 1; j < roleList.length; j += 1) {
      const a = roleList[i];
      const b = roleList[j];
      const supportA = a.supportBoundsM;
      const supportB = b.supportBoundsM;
      const xzOverlap = [0, 2].every((axis) => (
        Math.min(supportA.max[axis], supportB.max[axis]) - Math.max(supportA.min[axis], supportB.min[axis])
      ) > 0);
      const yOverlapM = Math.max(0, Math.min(supportA.max[1], supportB.max[1]) - Math.max(supportA.min[1], supportB.min[1]));
      const yGapM = yOverlapM > 0
        ? -yOverlapM
        : Math.max(0, Math.max(supportA.min[1], supportB.min[1]) - Math.min(supportA.max[1], supportB.max[1]));
      const pair = {
        roles: [a.role, b.role],
        materials: [a.material, b.material],
        xzOverlap,
        supportGapYM: yGapM,
        supportOverlapYM: yOverlapM,
        centerGapYM: Math.max(0, Math.max(a.centerBoundsM.min[1], b.centerBoundsM.min[1]) - Math.min(a.centerBoundsM.max[1], b.centerBoundsM.max[1])),
        status: xzOverlap && yOverlapM > 1e-9
          ? 'initial-blocks-overlap'
          : (xzOverlap && yGapM <= 1e-9 ? 'initial-blocks-touching' : 'initial-blocks-separated')
      };
      if (pair.status === 'initial-blocks-overlap') blockers.push('initial-block-geometry-overlap');
      pairs.push(pair);
    }
  }

  return {
    schema: 'peercompute.ulg.initial-block-geometry-summary.v0',
    status: blockers.length > 0 ? 'blocked-initial-block-geometry-overlap' : 'initial-block-geometry-ok',
    roles,
    pairs,
    blockers: [...new Set(blockers)]
  };
}

function solveClosureEquilibriumK(parts) {
  const total = (t) => parts.reduce((sum, p) => sum + p.massKg * specificInternalEnergyJPerKg(p.properties, t), 0);
  const target = parts.reduce((sum, p) => sum + p.massKg * specificInternalEnergyJPerKg(p.properties, p.initialTemperatureK), 0);
  let lo = Math.min(...parts.map((p) => p.initialTemperatureK));
  let hi = Math.max(...parts.map((p) => p.initialTemperatureK));
  for (let i = 0; i < 200; i += 1) {
    const mid = 0.5 * (lo + hi);
    if (total(mid) < target) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}

function computeDerivedDemoPreflight(demo) {
  const scenario = demo.scenario;
  const dropProps = demo.materialProperties[demo.dropMaterial];
  const baseProps = demo.materialProperties[demo.baseMaterial];
  const airProps = demo.materialProperties.air;
  const dropTemp = demo.initialTemperaturesK?.drop ?? scenario.iron.initialTemperatureK;
  const baseTemp = demo.initialTemperaturesK?.base ?? scenario.ice.initialTemperatureK;
  const airTemp = demo.initialTemperaturesK?.gas ?? scenario.gas.initialTemperatureK;
  const wallTemps = Object.values(scenario.walls.faces);
  const maxWallTempK = Math.max(...wallTemps);
  const meanWallTempK = wallTemps.reduce((sum, t) => sum + t, 0) / wallTemps.length;
  const adiabatic = scenario.walls.model === 'adiabatic';

  const dropDensity = densityAtTemperatureKgPerM3(dropProps, dropTemp, scenario.gas.pressurePa);
  const baseDensity = densityAtTemperatureKgPerM3(baseProps, baseTemp, scenario.gas.pressurePa);
  const airVolumeM3 = scenario.box.volumeM3 - scenario.iron.volumeM3 - scenario.ice.volumeM3;
  const airDensity = airProps
    ? idealGasDensityKgPerM3({
      pressurePa: scenario.gas.pressurePa,
      temperatureK: airTemp,
      molarMassKgPerMol: airProps.molarMassKgPerMol
    })
    : 0;
  const dropMassKg = scenario.iron.volumeM3 * dropDensity;
  const baseMassKg = scenario.ice.volumeM3 * baseDensity;
  const airMassKg = airVolumeM3 * airDensity;
  const parts = [
    { massKg: dropMassKg, properties: dropProps, initialTemperatureK: dropTemp },
    { massKg: baseMassKg, properties: baseProps, initialTemperatureK: baseTemp }
  ];
  if (airProps) parts.push({ massKg: airMassKg, properties: airProps, initialTemperatureK: airTemp });
  const adiabaticEquilibriumK = solveClosureEquilibriumK(parts);
  const asymptoticInteriorTempK = adiabatic ? adiabaticEquilibriumK : meanWallTempK;
  const bindingInteriorTempK = adiabatic ? adiabaticEquilibriumK : maxWallTempK;
  const initialEnergyJ = parts.reduce((sum, p) => sum + p.massKg * specificInternalEnergyJPerKg(p.properties, p.initialTemperatureK), 0);
  const finalEnergyJ = parts.reduce((sum, p) => sum + p.massKg * specificInternalEnergyJPerKg(p.properties, asymptoticInteriorTempK), 0);
  const heatExportedToWallsJ = adiabatic ? 0 : initialEnergyJ - finalEnergyJ;
  const finalBasePhase = equilibriumFromSpecificEnergy(baseProps, specificInternalEnergyJPerKg(baseProps, bindingInteriorTempK)).stablePhase;
  const finalDropPhase = equilibriumFromSpecificEnergy(dropProps, specificInternalEnergyJPerKg(dropProps, bindingInteriorTempK)).stablePhase;
  const thermodynamicFeasible = Boolean(finalBasePhase && finalDropPhase);
  const initialGeometry = initialBlockGeometrySummary(demo);
  const geometryBlocked = initialGeometry.blockers.length > 0;
  const feasible = thermodynamicFeasible && !geometryBlocked;
  const sinkFaceCount = heatExportedToWallsJ > 0 ? wallTemps.length : 0;
  const wallLedger = Object.entries(scenario.walls.faces).map(([faceId, temperatureK]) => ({
    faceId,
    temperatureK,
    role: heatExportedToWallsJ > 0 ? 'sink' : 'balanced',
    areaM2: scenario.box.edgeM * scenario.box.edgeM,
    areaFraction: 1 / 6,
    heatJ: sinkFaceCount > 0 ? heatExportedToWallsJ / sinkFaceCount : 0
  }));
  const baseParticleResolution = materialEntities(
    demo.baseMaterial,
    baseMassKg,
    baseProps,
    scenario.particleResolution.h2o
  );
  const dropParticleResolution = materialEntities(
    demo.dropMaterial,
    dropMassKg,
    dropProps,
    scenario.particleResolution.fe
  );
  const particleResolution = {
    [demo.baseMaterial]: baseParticleResolution,
    [demo.dropMaterial]: dropParticleResolution,
    base: baseParticleResolution,
    drop: dropParticleResolution,
    gas: airProps ? materialEntities('air', airMassKg, airProps, scenario.particleResolution.gas) : null
  };
  return {
    scenarioId: scenario.scenarioId,
    status: geometryBlocked
      ? 'preflight-blocked-initial-geometry'
      : (thermodynamicFeasible ? 'preflight-feasible-derived-closures' : 'preflight-infeasible-derived-closures'),
    materials: {
      drop: demo.dropMaterial,
      base: demo.baseMaterial,
      gas: 'air'
    },
    masses: {
      ironMassKg: dropMassKg,
      iceMassKg: baseMassKg,
      airMassKg,
      airDensityKgPerM3: airDensity,
      dropMassKg,
      baseMassKg
    },
    energyBudget: {
      initialInternalEnergyJ: initialEnergyJ,
      finalInternalEnergyJ: finalEnergyJ,
      heatExportedToWallsJ,
      wallLedger
    },
    boundary: {
      model: scenario.walls.model,
      wallTemperaturesK: { ...scenario.walls.faces },
      maxWallTempK,
      meanWallTempK,
      asymptoticInteriorTempK,
      adiabaticEquilibriumK
    },
    initialGeometry,
    feasibility: {
      feasible,
      thermodynamicFeasible,
      geometryBlocked,
      bindingInteriorTempK,
      finalH2oPhase: demo.baseMaterial === 'h2o' ? finalBasePhase : null,
      finalFePhase: demo.dropMaterial === 'fe' ? finalDropPhase : null,
      finalBasePhase,
      finalDropPhase,
      reason: feasible
        ? `closure-derived wall equilibrium resolves stable phases: base=${finalBasePhase}, drop=${finalDropPhase}`
        : (geometryBlocked
            ? 'initial block support extents overlap; lower or raise a block before interpreting contact physics'
            : 'closure-derived wall equilibrium did not resolve stable phases for both demo materials')
    },
    particleResolution: {
      h2o: particleResolution.h2o || particleResolution[demo.baseMaterial],
      fe: particleResolution.fe || particleResolution[demo.dropMaterial],
      gas: particleResolution.gas,
      ...particleResolution
    },
    closureBacked: true,
    scientificValidation: false,
    fullPhysicsValidation: false,
    materialValidation: false,
    eosValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    blockers: [...new Set(['derived-material-models-unvalidated', ...initialGeometry.blockers])]
  };
}

/**
 * Create the demo driver: preflight + a reduced-resolution CPU reference carrier stepper.
 */
export function createSphPhaseDemo(options = {}) {
  const demo = buildSphPhaseDemoState(options);
  if (!demo.allowFixtureMaterialProperties) {
    requireFirstPrinciplesMaterialMap(demo.materialProperties, { context: 'createSphPhaseDemo.initial-materials', allowedFallbackSources: ['material-property-reference-bank'] });
  }
  const physicalLawGroups = normalizeSphPhysicalLawGroups(options.physicalLawGroups);
  const pendingPhysicalLawGroups = pendingSphPhysicalLawGroups(physicalLawGroups);
  demo.physicalLawGroups = physicalLawGroups;
  demo.pendingPhysicalLawGroups = pendingPhysicalLawGroups;
  demo.state.physicalLawGroups = physicalLawGroups;
  demo.state.pendingPhysicalLawGroups = pendingPhysicalLawGroups;
  // Per-face cumulative heat ledger (J exchanged with each fixed-temperature wall reservoir).
  demo.wallHeatLedgerJ = { xMin: 0, xMax: 0, yMin: 0, yMax: 0, zMin: 0, zMax: 0 };
  const gasDensity = demo.materialProperties.h2o.phases.find((p) => p.name === 'gas').densityKgPerM3;
  const liquidDensity = demo.materialProperties.h2o.phases.find((p) => p.name === 'liquid').densityKgPerM3;
  // Single simulation clock: each driver.step advances the mechanics by `mechanicalSubsteps`
  // carrier substeps of `dt` each, and the thermal step by the SAME sim-time (subs * dt). This
  // keeps the thermodynamics and the motion on one clock — heat flow / melting / steam no longer
  // outrun the falling and flowing (the old code stepped thermal at a fixed 0.02 s while mechanics
  // crept at 3e-4 s, ~67x faster). The conduction/wall coefficients are still elevated (fast heat
  // transfer for a watchable demo, labelled in thermalPhase.js), but applied over the consistent dt.
  const buoyancyCap = options.buoyancyCapMPerS2 ?? 45;
  // Phase-aware multi-material EOS: each particle's pressure references its current phase's rest
  // density (from the closures), so condensed iron/water stay ~incompressible while vaporized water
  // expands toward the gas density. This is what makes the steam grow in volume and stops the
  // molten iron from puffing up like a gas. Shared by both mechanical backends.
  // Mechanical backend + timestep, decided up front (the sound-speed scaling depends on dt).
  const mechanics = options.mechanics ?? 'mlsmpm';
  const carrierDt = options.dt ?? (mechanics === 'mlsmpm' ? 5e-4 : 3e-4);
  const mechanicalSubsteps = options.mechanicalSubsteps ?? (mechanics === 'mlsmpm' ? 16 : 24);
  const gridSpacingM = options.gridSpacingM ?? Math.max(0.15, demo.state.smoothingLengthM);
  const mechLengthM = mechanics === 'mlsmpm' ? gridSpacingM : demo.state.smoothingLengthM;

  // Mechanical stiffness is derived from each phase's real bulk/shear moduli (closure properties).
  // The one concession is a global `soundSpeedScale` < 1 (real km/s condensed speeds would force a
  // microscopic dt). Rather than a fixed cap, we set the artificial sound speed as HIGH as the CFL
  // allows at the chosen dt:  c_max = cflSafety · Δx / dt.  So a smaller dt automatically uses a
  // stiffer, less weakly-compressible (more accurate) material, converging to the real moduli as
  // dt → 0 (soundSpeedScale → 1). One global factor → relative stiffnesses (iron > ice > water) stay
  // physical; only the absolute compressibility is the (dt-controlled) approximation.
  let maxRealSoundSpeed = 0;
  for (const props of Object.values(demo.materialProperties)) {
    for (const ph of props.phases || []) {
      maxRealSoundSpeed = Math.max(maxRealSoundSpeed, realPhaseSoundSpeedMPerS(props, ph));
    }
  }
  const cflSafety = options.cflSafety ?? 0.4;
  const gridCflFactor = options.gridCflFactor ?? 0.6;
  const mlsMpmArtificialViscosityAlpha = options.mlsMpmArtificialViscosityAlpha ?? 0.04;
  const mlsMpmLiquidVelocityDiffusionAlpha = options.mlsMpmLiquidVelocityDiffusionAlpha ?? 0.1;
  const mlsMpmLiquidVelocityDiffusionRadiusM = options.mlsMpmLiquidVelocityDiffusionRadiusM ?? (2 * gridSpacingM);
  const mlsMpmLiquidVelocityDiffusionStartS = options.mlsMpmLiquidVelocityDiffusionStartS ?? (20 * mechanicalSubsteps * carrierDt);
  const mlsMpmLiquidWallDampingAlpha = options.mlsMpmLiquidWallDampingAlpha ?? 0.2;
  const mlsMpmLiquidWallDampingDistanceM = options.mlsMpmLiquidWallDampingDistanceM ?? (1.5 * gridSpacingM);
  // Excluded-volume pair separation relaxation; undefined defers to the GPU
  // buffer default (sphGpuBuffers). Explicit 0 disables for A/B isolation.
  const mlsMpmParticleSeparationRelaxation = options.mlsMpmParticleSeparationRelaxation;
  const mlsMpmLiquidFreeSurfaceRelaxationAlpha = mechanics === 'mlsmpm'
    && physicalLawGroups.gravity
    && physicalLawGroups.pressure
    && physicalLawGroups.eos
    ? Math.min(Math.max(
      Number(options.mlsMpmLiquidFreeSurfaceRelaxationAlpha ?? DEFAULT_MLS_MPM_LIQUID_FREE_SURFACE_RELAXATION_ALPHA) || 0,
      0
    ), 1)
    : 0;
  const mlsMpmLiquidFreeSurfaceTargetDepthM = options.mlsMpmLiquidFreeSurfaceTargetDepthM ?? null;
  const mlsMpmLiquidFreeSurfaceContactDepthM = options.mlsMpmLiquidFreeSurfaceContactDepthM ?? null;
  const sphLiquidVelocityDiffusionAlpha = options.sphLiquidVelocityDiffusionAlpha ?? 0.04;
  const sphLiquidVelocityDiffusionRadiusM = options.sphLiquidVelocityDiffusionRadiusM ?? (2 * demo.state.smoothingLengthM);
  const sphLiquidWallDampingAlpha = options.sphLiquidWallDampingAlpha ?? 0.3;
  const sphLiquidWallDampingDistanceM = options.sphLiquidWallDampingDistanceM ?? (1.5 * demo.state.smoothingLengthM);
  const requestedGravityMPerS2 = options.gravity ?? [0, -9.80665, 0];
  const gravityMPerS2 = physicalLawGroups.gravity ? requestedGravityMPerS2 : [0, 0, 0];
  const cflMaxSoundSpeedMPerS = (cflSafety * mechLengthM) / carrierDt;
  const soundSpeedScale = Math.min(1, maxRealSoundSpeed > 0 ? cflMaxSoundSpeedMPerS / maxRealSoundSpeed : 1);
  const modulusScale = soundSpeedScale * soundSpeedScale; // moduli scale as c^2
  const requestedMinGasSoundSpeedMPerS = options.minGasSoundSpeedMPerS ?? 40;
  const minGasSoundSpeedMPerS = Math.min(
    Math.max(Number(requestedMinGasSoundSpeedMPerS) || 0, 0),
    cflMaxSoundSpeedMPerS
  );
  const hydrostaticInitializationEnabled = options.hydrostaticInitialization !== false
    && physicalLawGroups.mechanics
    && physicalLawGroups.gravity
    && physicalLawGroups.eos;
  const sphCavitationPressureFloorPa = mechanics === 'sph'
    ? (options.sphCavitationPressureFloorPa ?? 0)
    : null;
  const sphDensityProjectionIterations = mechanics === 'sph' && physicalLawGroups.eos
    ? Math.max(0, Math.round(Number(options.sphDensityProjectionIterations ?? 3) || 0))
    : 0;
  const sphDensityProjectionRelaxation = mechanics === 'sph'
    ? Math.min(Math.max(Number(options.sphDensityProjectionRelaxation ?? 0.5) || 0, 0), 1)
    : 0;
  const sphFluidHydrostaticPressure = mechanics === 'sph'
    && physicalLawGroups.gravity
    && physicalLawGroups.pressure
    && physicalLawGroups.eos
    && options.sphFluidHydrostaticPressure === true;
  const sphFluidHydrostaticPressureScale = options.sphFluidHydrostaticPressureScale ?? 1;
  const sphFluidHydrostaticPressureDensityFloorRatio = options.sphFluidHydrostaticPressureDensityFloorRatio ?? 0.85;
  const sphFluidHydrostaticPressureDensityFullRatio = options.sphFluidHydrostaticPressureDensityFullRatio ?? 1;
  const sphLiquidFreeSurfaceRelaxationAlpha = mechanics === 'sph'
    && physicalLawGroups.gravity
    && physicalLawGroups.pressure
    && physicalLawGroups.eos
    ? Math.min(Math.max(Number(options.sphLiquidFreeSurfaceRelaxationAlpha ?? 5e-5) || 0, 0), 1)
    : 0;
  const sphLiquidFreeSurfaceTargetDepthM = options.sphLiquidFreeSurfaceTargetDepthM ?? null;
  const sphLiquidFreeSurfaceContactDepthM = options.sphLiquidFreeSurfaceContactDepthM ?? null;
  const gpuMechanics = {
    integrator: mechanics,
    gridSpacingM,
    dt: carrierDt,
    mechanicalSubsteps,
    soundSpeedScale,
    modulusScale,
    minGasSoundSpeedMPerS,
    requestedMinGasSoundSpeedMPerS,
    maxRealSoundSpeedMPerS: maxRealSoundSpeed,
    cflMaxSoundSpeedMPerS,
    cflSafety,
    gridCflFactor,
    mlsMpmArtificialViscosityAlpha,
    mlsMpmLiquidVelocityDiffusionAlpha,
    mlsMpmLiquidVelocityDiffusionRadiusM,
    mlsMpmLiquidVelocityDiffusionStartS,
    mlsMpmLiquidWallDampingAlpha,
    mlsMpmLiquidWallDampingDistanceM,
    mlsMpmParticleSeparationRelaxation,
    mlsMpmLiquidFreeSurfaceRelaxationAlpha,
    mlsMpmLiquidFreeSurfaceTargetDepthM,
    mlsMpmLiquidFreeSurfaceContactDepthM,
    gravityMPerS2,
    hydrostaticInitialization: hydrostaticInitializationEnabled,
    sphCavitationPressureFloorPa,
    sphDensityProjectionIterations,
    sphDensityProjectionRelaxation,
    sphFluidHydrostaticPressure,
    sphFluidHydrostaticPressureScale,
    sphFluidHydrostaticPressureDensityFloorRatio,
    sphFluidHydrostaticPressureDensityFullRatio,
    sphLiquidFreeSurfaceRelaxationAlpha,
    sphLiquidFreeSurfaceTargetDepthM,
    sphLiquidFreeSurfaceContactDepthM,
    sphLiquidVelocityDiffusionAlpha,
    sphLiquidVelocityDiffusionRadiusM,
    sphLiquidWallDampingAlpha,
    sphLiquidWallDampingDistanceM,
    physicalLawGroups,
    pendingPhysicalLawGroups
  };
  demo.gpuMechanics = gpuMechanics;
  demo.state.gpuMechanics = gpuMechanics;
  const phaseAwareEos = createPhaseAwareEos(demo.materialProperties, { soundSpeedScale, cflMaxSoundSpeedMPerS, minGasSoundSpeedMPerS });
  const eos = (args) => {
    const result = phaseAwareEos(args);
    if (physicalLawGroups.eos) return result;
    return {
      ...result,
      pressurePa: 0,
      soundSpeedMPerS: 0,
      disabledByPhysicalLawGroup: 'eos'
    };
  };
  demo.initialHydrostaticState = initializeSupportedHydrostaticMpmState(demo, {
    gravityMPerS2,
    modulusScale,
    enabled: hydrostaticInitializationEnabled
  });

  let carrier;
  if (mechanics === 'mlsmpm') {
    // Phase-dependent constitutive model: a particle in its SOLID phase resists shear (corotated
    // elasticity → it holds its block shape); when it melts (phase → liquid/gas, shear modulus 0) it
    // becomes a fluid and flows. The elastic moduli are the phase's real shear μ and Lamé
    // λ = K − ⅔μ (from the closure bulk/shear moduli), scaled by the same global modulusScale as the
    // EOS — derived material properties, not arbitrary constants.
    const constitutiveOf = (p) => {
      const props = demo.materialProperties[p.material];
      const phase = stablePhaseFromSpecificEnergy(props, p.specificInternalEnergyJPerKg);
      const ph = props.phases.find((q) => q.name === phase);
      const condensed = phase !== 'gas';
      const restDensity = Number(ph?.densityKgPerM3) || Number(p.restDensityKgPerM3) || 0;
      const effectiveBulkModulusPa = Math.max((Number(ph?.bulkModulusPa) || 0) * modulusScale, 0);
      const soundSpeedMPerS = restDensity > 0 && effectiveBulkModulusPa > 0
        ? Math.sqrt(effectiveBulkModulusPa / restDensity)
        : 0;
      const closureViscosityPaS = Math.max(Number(ph?.dynamicViscosityPaS) || 0, 0);
      const artificialViscosityPaS = physicalLawGroups.viscosity && phase === 'liquid'
        ? Math.max(restDensity * soundSpeedMPerS * gridSpacingM * mlsMpmArtificialViscosityAlpha, 0)
        : 0;
      const dynamicViscosityPaS = physicalLawGroups.viscosity
        ? closureViscosityPaS + artificialViscosityPaS
        : 0;
      if (phase !== 'solid' || !ph || !(ph.shearModulusPa > 0)) {
        return { solid: false, condensed, dynamicViscosityPaS };
      }
      const mu = ph.shearModulusPa * modulusScale;
      const lambda = Math.max((ph.bulkModulusPa - (2 / 3) * ph.shearModulusPa) * modulusScale, 0);
      return { solid: true, condensed, shearModulusPa: mu, lambdaPa: lambda, dynamicViscosityPaS: 0 };
    };
    carrier = createMlsMpmCarrier({
      gridSpacingM,
      boxEdgeM: demo.box.edgeM,
      boxDimsM: demo.box.dimensionsM,
      dt: carrierDt,
      gravity: gravityMPerS2,
      eos,
      restDensityOf: (p) => p.restDensityKgPerM3 || demo.materialProperties[p.material].phases[0].densityKgPerM3,
      constitutiveOf,
      trackFluidVolume: physicalLawGroups.eos,
      liquidVelocityDiffusionAlpha: physicalLawGroups.viscosity ? mlsMpmLiquidVelocityDiffusionAlpha : 0,
      liquidVelocityDiffusionRadiusM: mlsMpmLiquidVelocityDiffusionRadiusM,
      liquidVelocityDiffusionStartS: mlsMpmLiquidVelocityDiffusionStartS,
      liquidWallDampingAlpha: physicalLawGroups.viscosity ? mlsMpmLiquidWallDampingAlpha : 0,
      liquidWallDampingDistanceM: mlsMpmLiquidWallDampingDistanceM,
      liquidFreeSurfaceRelaxationAlpha: mlsMpmLiquidFreeSurfaceRelaxationAlpha,
      liquidFreeSurfaceTargetDepthM: mlsMpmLiquidFreeSurfaceTargetDepthM,
      liquidFreeSurfaceContactDepthM: mlsMpmLiquidFreeSurfaceContactDepthM,
      cflFactor: gridCflFactor
    });
  } else {
    const sphReferenceEos = (args) => {
      const result = eos(args);
      const particle = args?.particle;
      const props = demo.materialProperties[particle?.material];
      const phase = props && particle
        ? stablePhaseFromSpecificEnergy(props, particle.specificInternalEnergyJPerKg)
        : null;
      if (phase && phase !== 'gas' && Number.isFinite(sphCavitationPressureFloorPa)) {
        const hydrostaticPressurePa = sphFluidHydrostaticPressure
          ? Math.max(Number(particle?.sphHydrostaticPressurePa ?? particle?.hydrostaticPressurePa) || 0, 0)
          : 0;
        return {
          ...result,
          pressurePa: Math.max(result.pressurePa, sphCavitationPressureFloorPa) + hydrostaticPressurePa,
          cavitationPressureFloorPa: sphCavitationPressureFloorPa
        };
      }
      return result;
    };
    carrier = createSphPhaseCarrier({
      dimension: 3,
      gamma: options.gamma ?? 1.4,
      gravity: gravityMPerS2,
      alpha: options.alpha ?? 1.0,
      beta: options.beta ?? 2.0,
      dt: carrierDt,
      eos: sphReferenceEos,
      boxDimsM: demo.box.dimensionsM,
      densityProjectionIterations: sphDensityProjectionIterations,
      densityProjectionRelaxation: sphDensityProjectionRelaxation,
      densityProjectionEpsilon: options.sphDensityProjectionEpsilon ?? 1e-5,
      fluidHydrostaticPressure: sphFluidHydrostaticPressure,
      fluidHydrostaticPressureScale: sphFluidHydrostaticPressureScale,
      fluidHydrostaticPressureDensityFloorRatio: sphFluidHydrostaticPressureDensityFloorRatio,
      fluidHydrostaticPressureDensityFullRatio: sphFluidHydrostaticPressureDensityFullRatio,
      liquidFreeSurfaceRelaxationAlpha: sphLiquidFreeSurfaceRelaxationAlpha,
      liquidFreeSurfaceTargetDepthM: sphLiquidFreeSurfaceTargetDepthM,
      liquidFreeSurfaceContactDepthM: sphLiquidFreeSurfaceContactDepthM,
      liquidVelocityDiffusionAlpha: physicalLawGroups.viscosity ? sphLiquidVelocityDiffusionAlpha : 0,
      liquidVelocityDiffusionRadiusM: sphLiquidVelocityDiffusionRadiusM,
      liquidWallDampingAlpha: physicalLawGroups.viscosity ? sphLiquidWallDampingAlpha : 0,
      liquidWallDampingDistanceM: sphLiquidWallDampingDistanceM,
      solidPredicate: (particle) => {
        const props = demo.materialProperties[particle?.material];
        return Boolean(
          props
            && particle
            && stablePhaseFromSpecificEnergy(props, particle.specificInternalEnergyJPerKg) === 'solid'
        );
      },
      fluidPredicate: (particle) => {
        const props = demo.materialProperties[particle?.material];
        return Boolean(
          props
            && particle
            && stablePhaseFromSpecificEnergy(props, particle.specificInternalEnergyJPerKg) === 'liquid'
        );
      }
    });
  }
  const dtStepS = mechanicalSubsteps * carrierDt; // sim-time advanced per driver.step

  // Reactive chemistry: the reaction network is DISCOVERED from the two block materials — whether
  // they react, into what, and with what enthalpy is derived from the molecular bonding engine
  // (universal redox/acid–base families + a combinatorial fallback), not hardcoded. On contact above
  // the activation temperature the reactant particles become the product and release the derived heat
  // (→ temperature → phase change / steam → expansion). Any derived product-compound closure is
  // registered into materialProperties so the product renders and carries thermodynamics.
  const discovery = discoverReactions(demo.dropMaterial, demo.baseMaterial, {
    materialProperties: demo.materialProperties,
    reactionDiscoveryCacheRecord: options.reactionDiscoveryCacheRecord,
    cachedReactionDiscoveryRecord: options.cachedReactionDiscoveryRecord,
    productClosures: options.productClosures,
    cachedProductClosures: options.cachedProductClosures,
    allowFixtureMaterialProperties: demo.allowFixtureMaterialProperties,
    allowReducedProductProperties: options.allowReducedProductProperties === true
      || demo.allowFixtureMaterialProperties
  });
  const discoveredReactions = discovery.reactions;
  for (const [key, closure] of Object.entries(discovery.productClosures)) {
    if (!demo.allowFixtureMaterialProperties && options.allowReducedProductProperties !== true) {
      requireFirstPrinciplesMaterialProperties(closure.properties, {
        material: key,
        context: 'createSphPhaseDemo.product-material',
        allowedFallbackSources: ['material-property-reference-bank']
      });
    }
    demo.materialProperties[key] = closure.properties;
  }
  demo.reactionNote = discovery.note;
  demo.reactionDiscovery = discovery;
  // Contact radius for "the two materials are touching". In MLS-MPM two materials transfer momentum
  // through shared grid nodes, so distinct condensed bodies come to rest ~1 grid cell apart (they
  // never interpenetrate to particle-spacing range). The reaction must use that mechanical contact
  // scale — a couple of grid cells — or two blocks resting against each other would sit just outside
  // a tight radius and never react (the bug this fixes). ~2.5 cells spans the contact gap.
  const reactionContactRadiusM = gridSpacingM * 2.5;
  const reactionTemperatureOf = (p) => cachedParticleEquilibriumFromSpecificEnergy(
    demo.materialProperties[p.material],
    p,
    p.specificInternalEnergyJPerKg
  ).temperatureK;
  const reactions = physicalLawGroups.reactions ? discoveredReactions : [];
  demo.reactions = reactions;
  demo.reactionContactRadiusM = reactionContactRadiusM;

  return {
    demo,
    preflight() {
      return computeDerivedDemoPreflight(demo);
    },
    step() {
      const startedAtMs = nowMs();
      const stageMs = {
        mechanics: 0,
        thermal: 0,
        wallLedger: 0,
        buoyancy: 0,
        reaction: 0,
        wallClamp: 0
      };
      // Advance the mechanics by several CFL-limited carrier substeps so it covers the same
      // sim-time the thermal step uses below (one shared clock).
      let stageStartMs = nowMs();
      let mechanicsActiveGridNodeSteps = 0;
      let mechanicsActiveGridNodesSum = 0;
      let mechanicsActiveGridNodesMax = 0;
      if (physicalLawGroups.mechanics) {
        for (let s = 0; s < mechanicalSubsteps; s += 1) {
          const result = carrier.step(demo.state);
          demo.state = result.state;
          demo.state.gpuMechanics = gpuMechanics;
          demo.state.physicalLawGroups = physicalLawGroups;
          demo.state.pendingPhysicalLawGroups = pendingPhysicalLawGroups;
          if (Number.isFinite(result.activeGridNodes)) {
            mechanicsActiveGridNodeSteps += 1;
            mechanicsActiveGridNodesSum += result.activeGridNodes;
            mechanicsActiveGridNodesMax = Math.max(mechanicsActiveGridNodesMax, result.activeGridNodes);
          }
        }
      }
      stageMs.mechanics = Math.max(0, nowMs() - stageStartMs);

      // P5: evolve energy by conduction + six-wall heat flux over the SAME sim-time as the mechanics.
      stageStartMs = nowMs();
      const { wallHeatJ, thermal } = physicalLawGroups.thermal
        ? thermalStep(demo.state, {
            materialProperties: demo.materialProperties,
            wallTemperaturesK: demo.scenario.walls.faces,
            boxEdgeM: demo.box.edgeM,
            boxDimsM: demo.box.dimensionsM,
            dtS: dtStepS,
            conductionRate: options.conductionRate,
            wallRate: options.wallRate
          })
        : {
            wallHeatJ: { xMin: 0, xMax: 0, yMin: 0, yMax: 0, zMin: 0, zMax: 0 },
            thermal: particleThermalState(demo)
          };
      stageMs.thermal = Math.max(0, nowMs() - stageStartMs);
      stageStartMs = nowMs();
      for (const face of Object.keys(demo.wallHeatLedgerJ)) demo.wallHeatLedgerJ[face] += wallHeatJ[face];
      stageMs.wallLedger = Math.max(0, nowMs() - stageStartMs);

      // Phase-driven buoyancy: water that has vaporized (gas phase) rises as steam (reuse the
      // phases the thermal step already computed), over the same sim-time.
      stageStartMs = nowMs();
      const steamBuoyancy = Math.min(buoyancyCap, buoyancyAccelerationMPerS2(gasDensity, liquidDensity));
      if (physicalLawGroups.thermal && physicalLawGroups.gravity) {
        demo.state.particles.forEach((p, i) => {
          if (p.material === 'h2o' && thermal[i].phase === 'gas') p.v[1] += steamBuoyancy * dtStepS;
        });
      }
      stageMs.buoyancy = Math.max(0, nowMs() - stageStartMs);

      // Reactive chemistry: reactant particles in contact above the activation temperature react,
      // becoming product and releasing the derived reaction enthalpy as heat.
      let reactionEvents = 0;
      stageStartMs = nowMs();
      if (physicalLawGroups.reactions && reactions.length) {
        reactionEvents = reactiveStep(demo.state, { reactions, materialProperties: demo.materialProperties, contactRadiusM: reactionContactRadiusM, temperatureOf: reactionTemperatureOf });
      }
      stageMs.reaction = Math.max(0, nowMs() - stageStartMs);

      // Display safeguards: reflect at the sealed-box walls and clamp speed so the (reduced,
      // pre-full-EOS) cloud stays bounded and on-screen.
      stageStartMs = nowMs();
      const dims = demo.box.dimensionsM;
      const maxSpeed = options.maxDisplaySpeedMPerS ?? 25;
      for (const p of demo.state.particles) {
        for (let d = 0; d < 3; d += 1) {
          if (p.x[d] < 0) { p.x[d] = 0; p.v[d] = Math.abs(p.v[d]) * 0.4; }
          else if (p.x[d] > dims[d]) { p.x[d] = dims[d]; p.v[d] = -Math.abs(p.v[d]) * 0.4; }
        }
        const speed = Math.hypot(p.v[0], p.v[1], p.v[2]);
        if (speed > maxSpeed) {
          const s = maxSpeed / speed;
          p.v[0] *= s; p.v[1] *= s; p.v[2] *= s;
        }
      }
      stageMs.wallClamp = Math.max(0, nowMs() - stageStartMs);
      demo.state.gpuMechanics = gpuMechanics;
      demo.state.physicalLawGroups = physicalLawGroups;
      demo.state.pendingPhysicalLawGroups = pendingPhysicalLawGroups;
      demo.lastStepTiming = {
        schema: ULG_SPH_CPU_DRIVER_STEP_TIMING_SCHEMA,
        totalMs: Math.max(0, nowMs() - startedAtMs),
        stageMs,
        particleCount: demo.state.particles.length,
        mechanicalSubsteps,
        mechanicsActiveGridNodes: mechanicsActiveGridNodeSteps > 0
          ? {
              mean: mechanicsActiveGridNodesSum / mechanicsActiveGridNodeSteps,
              max: mechanicsActiveGridNodesMax,
              sampledSubsteps: mechanicsActiveGridNodeSteps
            }
          : null,
        dtStepS,
        reactionCount: reactions.length,
        reactionEvents,
        physicalLawGroups,
        pendingPhysicalLawGroups,
        unsupportedPhysicalLawGroups: pendingPhysicalLawGroups,
        backend: 'cpu-reference',
        scientificValidation: false,
        sphValidation: false,
        phaseChangeValidation: false,
        fullPhysicsValidation: false
      };
      return demo.state;
    },
    totals() {
      return sphTotals(demo.state);
    },
    thermalState() {
      return particleThermalState(demo);
    },
    phaseMassSummary() {
      return phaseMassSummary(demo);
    },
    steamSummary() {
      return phaseMassWithSteam(demo.state, demo.materialProperties);
    },
    wallHeatLedgerJ() {
      return { ...demo.wallHeatLedgerJ };
    }
  };
}
