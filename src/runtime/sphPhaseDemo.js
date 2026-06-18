// SPH phase demo logic (headless; the renderer in visualization/sphPhaseScene.js draws it).
//
// Builds the molten-iron-on-ice scenario as an SPH particle cloud whose specific internal
// energy (and therefore phase + render colour) comes from the material closures, runs the
// energy-feasibility preflight, and steps the conservative CPU-reference carrier. This is a
// reduced-resolution reference: condensed-phase EOS, multi-material contact, wall heat flux,
// and conduction are demo plan P5 — so the stepping is labelled a reference, not validated
// phase physics. Evidence-only throughout.

import { createReferenceMaterialClosures } from './material/materialClosures.js';
import { createDerivedMaterialClosure } from './material/materialDerivation.js';
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

const DEFAULT_RUNTIME_MATERIAL_KEYS = Object.freeze(['h2o', 'fe', 'air', 'h2', 'o2']);
const ULG_SPH_CPU_DRIVER_STEP_TIMING_SCHEMA = 'peercompute.ulg.sph-cpu-driver-step-timing.v0';
const H2O_VAPOR_OPTICAL_STATE_MODEL = 'h2o-vapor-condensation-optical-state-v0';
const H2O_VAPOR_OPTICAL_STATE_GENERATOR = `${WATER_DROPLET_OPTICAL_MICROPHYSICS_MODEL}:sealed-box-gas-summary-v0`;
const REDUCED_H2O_DROPLET_RADIUS_M = 1e-6;
const AVOGADRO_R = 8.314462618;
const TAIT_EXPONENT = 7;
const DEFAULT_INITIAL_TARGET_NEIGHBOR_COUNT = 64;
const DEFAULT_INITIAL_MAX_SMOOTHING_LENGTH_RATIO = 1.8;
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

function particleSizeStateFromVolume({
  material = null,
  role = null,
  temperatureK = null,
  restDensityKgPerM3 = null,
  restVolumeM3,
  volumeRatioJ = 1,
  pressurePa = 0,
  source = 'material-temperature-rest-density'
} = {}) {
  const restVolume = Math.max(Number(restVolumeM3) || 0, 0);
  const volumeRatio = Math.max(Number(volumeRatioJ) || 1, 1e-12);
  const currentVolumeM3 = restVolume * volumeRatio;
  return {
    schema: 'peercompute.ulg.sph-particle-size-state.v0',
    status: pressurePa > 0
      ? 'pressure-adjusted-current-volume'
      : 'rest-volume',
    source,
    material,
    role,
    temperatureK: Number.isFinite(Number(temperatureK)) ? Number(temperatureK) : null,
    restDensityKgPerM3: Number.isFinite(Number(restDensityKgPerM3)) ? Number(restDensityKgPerM3) : null,
    pressurePa: Math.max(Number(pressurePa) || 0, 0),
    restVolumeM3: restVolume,
    currentVolumeM3,
    volumeRatioJ: volumeRatio,
    restParticleRadiusM: volumeEquivalentSphereRadiusM(restVolume),
    particleRadiusM: volumeEquivalentSphereRadiusM(currentVolumeM3),
    currentParticleRadiusM: volumeEquivalentSphereRadiusM(currentVolumeM3)
  };
}

function fillCube({ material, role = null, min, size, spacing, particlesPerEdge, temperatureK, properties, densityKgPerM3 }) {
  const particles = [];
  // particlesPerEdge sets the resolution directly (N -> N^3 particles); else derive from spacing.
  const n = Math.max(1, particlesPerEdge != null ? Math.round(particlesPerEdge) : Math.round(size / spacing));
  const step = size / n;
  const cellVolume = step * step * step;
  const massKg = densityKgPerM3 * cellVolume;
  const initialParticleSizeState = particleSizeStateFromVolume({
    material,
    role,
    temperatureK,
    restDensityKgPerM3: densityKgPerM3,
    restVolumeM3: cellVolume,
    source: 'initial-lattice-material-temperature-rest-density'
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
          initialParticleSpacingM: step,
          initialCellVolumeM3: cellVolume,
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

function clampInteger(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function adaptiveParticleEdgeBounds(requestedEdge) {
  const requested = positiveParticleEdge(requestedEdge);
  const minEdge = requested <= 1 ? 1 : Math.max(2, Math.floor(requested * 0.67));
  const maxEdge = Math.max(minEdge, Math.ceil(requested * 1.5));
  return { requested, minEdge, maxEdge };
}

function cappedAdaptiveParticleEdge({ desiredEdge, requestedEdge }) {
  const { minEdge, maxEdge } = adaptiveParticleEdgeBounds(requestedEdge);
  return clampInteger(desiredEdge, minEdge, maxEdge);
}

function smoothingLengthRatioForTargetNeighborCount(targetNeighborCount) {
  const count = Math.max(1, Number(targetNeighborCount) || DEFAULT_INITIAL_TARGET_NEIGHBOR_COUNT);
  // Approximate simple-cubic neighbor count inside the cubic-spline support sphere:
  // N ~= (4 / 3) * pi * (2h / dx)^3.
  return Math.cbrt((3 * count) / (32 * Math.PI));
}

function logSpacingError(a, b) {
  if (!(a > 0) || !(b > 0)) return Number.POSITIVE_INFINITY;
  return Math.abs(Math.log(a / b));
}

function relativeEdgeDeviation(edge, requestedEdge) {
  const requested = positiveParticleEdge(requestedEdge);
  return Math.abs(edge - requested) / Math.max(1, requested);
}

function chooseMatchingMaterialStateEdges({
  dropSizeM,
  baseSizeM,
  dropRequestedParticlesPerEdge,
  baseRequestedParticlesPerEdge,
  targetSpacingM,
  requestedParticleBudget
}) {
  if (!(dropSizeM > 0) || !(baseSizeM > 0) || !(targetSpacingM > 0)) return null;
  const dropBounds = adaptiveParticleEdgeBounds(dropRequestedParticlesPerEdge);
  const baseBounds = adaptiveParticleEdgeBounds(baseRequestedParticlesPerEdge);
  let best = null;
  for (let dropEdge = dropBounds.minEdge; dropEdge <= dropBounds.maxEdge; dropEdge += 1) {
    const dropSpacingM = dropSizeM / dropEdge;
    for (let baseEdge = baseBounds.minEdge; baseEdge <= baseBounds.maxEdge; baseEdge += 1) {
      const baseSpacingM = baseSizeM / baseEdge;
      const particleBudget = dropEdge ** 3 + baseEdge ** 3;
      const spacingMismatch = logSpacingError(dropSpacingM, baseSpacingM);
      const targetSpacingError = 0.5 * (
        logSpacingError(dropSpacingM, targetSpacingM)
        + logSpacingError(baseSpacingM, targetSpacingM)
      );
      const budgetDeviation = Math.abs(particleBudget - requestedParticleBudget) / Math.max(1, requestedParticleBudget);
      const requestedDeviation = (
        relativeEdgeDeviation(dropEdge, dropBounds.requested)
        + relativeEdgeDeviation(baseEdge, baseBounds.requested)
      );
      const score = spacingMismatch * 100 + targetSpacingError * 10 + budgetDeviation + requestedDeviation * 0.25;
      if (
        !best
        || score < best.score - 1e-12
        || (Math.abs(score - best.score) <= 1e-12 && targetSpacingError < best.targetSpacingError)
      ) {
        best = {
          dropEdge,
          baseEdge,
          dropSpacingM,
          baseSpacingM,
          particleBudget,
          spacingMismatch,
          targetSpacingError,
          budgetDeviation,
          requestedDeviation,
          score
        };
      }
    }
  }
  return best;
}

function resolveInitialParticleSpacingPlan({
  dropSizeM,
  baseSizeM,
  dropDensityKgPerM3,
  baseDensityKgPerM3,
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
  const totalMassKg = dropDensity * dropVolumeM3 + baseDensity * baseVolumeM3;
  const targetParticleMassKg = totalMassKg / Math.max(1, requestedParticleBudget);
  const targetDensity = totalMassKg / Math.max(dropVolumeM3 + baseVolumeM3, 1e-9);
  const targetSpacingM = Math.cbrt(targetParticleMassKg / Math.max(targetDensity, 1e-9));

  const withSupportMetadata = (row) => {
    const spacingM = Number(row.spacingM);
    const targetSmoothingLengthM = spacingM > 0 ? spacingM * smoothingLengthRatio : 0;
    const restVolumeM3 = spacingM > 0 ? spacingM ** 3 : 0;
    return {
      ...row,
      targetSmoothingLengthM,
      targetNeighborCount: neighborTarget,
      restVolumeM3,
      pressurePa: 0,
      volumeRatioJ: 1,
      volumeEquivalentParticleRadiusM: volumeEquivalentSphereRadiusM(restVolumeM3),
      pressureAdjustedParticleRadiusM: volumeEquivalentSphereRadiusM(restVolumeM3)
    };
  };
  const resolveRole = ({ role, sizeM, densityKgPerM3, requestedParticlesPerEdge }) => {
    const uniformSpacingM = sizeM / requestedParticlesPerEdge;
    if (!adaptiveParticleSpacing) {
      return withSupportMetadata({
        role,
        requestedParticlesPerEdge,
        particlesPerEdge: requestedParticlesPerEdge,
        spacingM: uniformSpacingM,
        uniformSpacingM,
        desiredParticlesPerEdge: requestedParticlesPerEdge,
        densityKgPerM3
      });
    }
    const desiredSpacingM = Math.cbrt(targetParticleMassKg / Math.max(densityKgPerM3, 1e-9));
    const desiredParticlesPerEdge = Math.max(1, sizeM / Math.max(desiredSpacingM, 1e-9));
    const particlesPerEdge = cappedAdaptiveParticleEdge({
      desiredEdge: desiredParticlesPerEdge,
      requestedEdge: requestedParticlesPerEdge
    });
    return withSupportMetadata({
      role,
      requestedParticlesPerEdge,
      particlesPerEdge,
      spacingM: sizeM / particlesPerEdge,
      uniformSpacingM,
      desiredSpacingM,
      desiredParticlesPerEdge,
      densityKgPerM3
    });
  };

  let drop = resolveRole({
    role: 'drop',
    sizeM: dropSizeM,
    densityKgPerM3: dropDensity,
    requestedParticlesPerEdge: dropRequested
  });
  let base = resolveRole({
    role: 'base',
    sizeM: baseSizeM,
    densityKgPerM3: baseDensity,
    requestedParticlesPerEdge: baseRequested
  });
  const matchingMaterialStateEdges = adaptiveParticleSpacing && matchingMaterialState
    ? chooseMatchingMaterialStateEdges({
      dropSizeM,
      baseSizeM,
      dropRequestedParticlesPerEdge: dropRequested,
      baseRequestedParticlesPerEdge: baseRequested,
      targetSpacingM,
      requestedParticleBudget
    })
    : null;
  if (matchingMaterialStateEdges) {
    drop = withSupportMetadata({
      ...drop,
      particlesPerEdge: matchingMaterialStateEdges.dropEdge,
      spacingM: matchingMaterialStateEdges.dropSpacingM,
      matchingMaterialStateSpacingUnified: true
    });
    base = withSupportMetadata({
      ...base,
      particlesPerEdge: matchingMaterialStateEdges.baseEdge,
      spacingM: matchingMaterialStateEdges.baseSpacingM,
      matchingMaterialStateSpacingUnified: true
    });
  }
  const roleSpacingM = [drop.spacingM, base.spacingM].filter((value) => Number.isFinite(value) && value > 0);
  const minSpacingM = roleSpacingM.length ? Math.min(...roleSpacingM) : 0;
  const uncappedSmoothingLengthM = Math.max(drop.targetSmoothingLengthM, base.targetSmoothingLengthM);
  const smoothingLengthCapM = minSpacingM > 0 ? minSpacingM * smoothingLengthRatioCap : uncappedSmoothingLengthM;
  const smoothingLengthM = Math.min(uncappedSmoothingLengthM, smoothingLengthCapM || uncappedSmoothingLengthM);
  const estimateNeighborCount = (spacingM) => {
    if (!(spacingM > 0) || !(smoothingLengthM > 0)) return 0;
    return (4 / 3) * Math.PI * ((2 * smoothingLengthM) / spacingM) ** 3;
  };
  for (const row of [drop, base]) {
    row.globalSmoothingLengthM = smoothingLengthM;
    row.globalSmoothingLengthRatio = row.spacingM > 0 ? smoothingLengthM / row.spacingM : 0;
    row.estimatedNeighborCount = estimateNeighborCount(row.spacingM);
  }

  return {
    schema: 'peercompute.ulg.sph-initial-particle-spacing-plan.v0',
    status: adaptiveParticleSpacing
      ? 'material-temperature-target-neighbor-capped'
      : 'fixed-requested-particles-per-edge',
    adaptiveParticleSpacing,
    targetNeighborCount: neighborTarget,
    smoothingLengthRatio,
    maxSmoothingLengthRatio: smoothingLengthRatioCap,
    smoothingLengthM,
    uncappedSmoothingLengthM,
    smoothingLengthCapM,
    smoothingLengthCapped: smoothingLengthM < uncappedSmoothingLengthM - 1e-12,
    matchingMaterialState: Boolean(matchingMaterialState),
    matchingMaterialStateSpacingUnified: Boolean(matchingMaterialStateEdges),
    matchingMaterialStateSpacingPlan: matchingMaterialStateEdges
      ? {
        dropParticlesPerEdge: matchingMaterialStateEdges.dropEdge,
        baseParticlesPerEdge: matchingMaterialStateEdges.baseEdge,
        dropSpacingM: matchingMaterialStateEdges.dropSpacingM,
        baseSpacingM: matchingMaterialStateEdges.baseSpacingM,
        spacingMismatch: matchingMaterialStateEdges.spacingMismatch,
        targetSpacingError: matchingMaterialStateEdges.targetSpacingError,
        particleBudget: matchingMaterialStateEdges.particleBudget,
        requestedParticleBudget,
        budgetDeviation: matchingMaterialStateEdges.budgetDeviation
      }
      : null,
    particleSizePolicy: {
      schema: 'peercompute.ulg.sph-initial-particle-size-policy.v0',
      status: 'material-temperature-pressure-rest-density-derived',
      source: 'initial-particle-spacing-plan',
      roleInputs: [
        'material',
        'temperature',
        'phase-rest-density',
        'target-neighbor-count',
        'box-support-constraints'
      ],
      restVolumeModel: 'particle-mass / phase-rest-density',
      currentVolumeModel: 'restVolumeM3 * volumeRatioJ',
      pressureModel: 'zero-gauge-before-optional-hydrostatic-initialization',
      dynamicPressureSupported: true
    },
    requestedParticleBudget,
    targetParticleMassKg,
    targetSpacingM,
    totalMassKg,
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
function densityAtTemperatureKgPerM3(props, temperatureK) {
  if (props.idealGas) {
    return idealGasDensityKgPerM3({
      pressurePa: PHYSICAL_CONSTANTS.standardAtmospherePa,
      temperatureK,
      molarMassKgPerMol: props.molarMassKgPerMol
    });
  }
  const u = specificInternalEnergyJPerKg(props, temperatureK);
  const phase = equilibriumFromSpecificEnergy(props, u).stablePhase;
  const ph = props.phases.find((p) => p.name === phase) || props.phases[0];
  return ph.densityKgPerM3;
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
      const particleSizeState = particleSizeStateFromVolume({
        material: particle.material,
        role,
        temperatureK: particle.temperatureK,
        restDensityKgPerM3: restDensity,
        restVolumeM3,
        volumeRatioJ,
        pressurePa,
        source: 'hydrostatic-material-temperature-pressure-rest-density'
      });
      particle.restParticleRadiusM = particleSizeState.restParticleRadiusM;
      particle.currentCellVolumeM3 = particleSizeState.currentVolumeM3;
      particle.currentParticleRadiusM = particleSizeState.currentParticleRadiusM;
      particle.pressureAdjustedParticleRadiusM = particleSizeState.particleRadiusM;
      particle.particleSizeState = particleSizeState;
      particle.hydrostaticInitialization = {
        schema: 'peercompute.ulg.sph-initial-hydrostatic-state.v0',
        status: 'initialized-supported-condensed-block',
        role,
        depthM,
        pressurePa,
        volumeRatioJ,
        restVolumeM3,
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

function resolveSingleMaterialClosure(key, { allowFixtureMaterialProperties = false } = {}) {
  const Z = zForSymbol(key);
  const elementClosure = Z != null
    ? elementMaterialClosure(Z, { allowReducedEstimates: allowFixtureMaterialProperties })
    : null;
  if (elementClosure) return elementClosure;
  return createDerivedMaterialClosure(key);
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
  iceBaseHeightM,
  ironBaseHeightM
} = {}) {
  const baseClosures = {
    ...(allowFixtureMaterialProperties ? createReferenceMaterialClosures() : {}),
    ...(closures || {})
  };
  // Box is a rectangular cuboid [Lx, Ly, Lz] (configurable per axis); a scalar edge stays cubic.
  const boxDims = scenario.box.dimensionsM ?? [scenario.box.edgeM, scenario.box.edgeM, scenario.box.edgeM];
  const ironEdge = scenario.iron.edgeM;
  const iceEdge = scenario.ice.edgeM;
  const cx = boxDims[0] / 2;
  const cz = boxDims[2] / 2;

  // Configurable starting elevation (bottom face) of each block. The base block defaults to resting
  // on the floor; the drop block defaults to a clear gap above it so it visibly falls.
  const iceBase = iceBaseHeightM ?? 0;
  const ironBase = ironBaseHeightM ?? (iceBase + iceEdge + Math.max(iceEdge, 1.0));

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
        context: 'buildSphPhaseDemoState'
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
  const dropDensityKgPerM3 = densityAtTemperatureKgPerM3(dropProps, dropTempK);
  const baseDensityKgPerM3 = densityAtTemperatureKgPerM3(baseProps, baseTempK);
  const matchingMaterialState = String(dropMaterial).toLowerCase() === String(baseMaterial).toLowerCase()
    && Math.abs(dropTempK - baseTempK) <= 1e-6
    && Math.abs(dropDensityKgPerM3 - baseDensityKgPerM3) <= Math.max(1e-6, Math.abs(baseDensityKgPerM3) * 1e-6);
  const initialParticleSpacing = resolveInitialParticleSpacingPlan({
    dropSizeM: ironEdge,
    baseSizeM: iceEdge,
    dropDensityKgPerM3,
    baseDensityKgPerM3,
    dropRequestedParticlesPerEdge: dropParticleEdge,
    baseRequestedParticlesPerEdge: baseParticleEdge,
    adaptiveParticleSpacing,
    matchingMaterialState,
    targetNeighborCount: initialTargetNeighborCount,
    maxSmoothingLengthRatio: initialMaxSmoothingLengthRatio
  });

  const dropParticles = fillCube({
    material: dropMaterial,
    role: 'drop',
    min: [cx - ironEdge / 2, ironBase, cz - ironEdge / 2],
    size: ironEdge,
    particlesPerEdge: initialParticleSpacing.drop.particlesPerEdge,
    temperatureK: dropTempK,
    properties: dropProps,
    densityKgPerM3: dropDensityKgPerM3
  });
  const baseParticles = fillCube({
    material: baseMaterial,
    role: 'base',
    min: [cx - iceEdge / 2, iceBase, cz - iceEdge / 2],
    size: iceEdge,
    particlesPerEdge: initialParticleSpacing.base.particlesPerEdge,
    temperatureK: baseTempK,
    properties: baseProps,
    densityKgPerM3: baseDensityKgPerM3
  });

  const all = [...baseParticles, ...dropParticles];
  const smoothingLengthM = initialParticleSpacing.smoothingLengthM;
  const state = createSphState({ particles: all, smoothingLengthM, dimension: 3 });
  // Carry per-particle temperature + material alongside the SPH state for rendering.
  state.particles.forEach((p, index) => {
    p.material = all[index].material;
    p.role = all[index].role;
    p.temperatureK = all[index].temperatureK;
    p.restDensityKgPerM3 = all[index].restDensityKgPerM3;
    p.initialParticleSpacingM = all[index].initialParticleSpacingM;
    p.initialCellVolumeM3 = all[index].initialCellVolumeM3;
    p.particleRadiusM = all[index].particleRadiusM;
    p.restParticleRadiusM = all[index].restParticleRadiusM;
    p.currentCellVolumeM3 = all[index].currentCellVolumeM3;
    p.currentParticleRadiusM = all[index].currentParticleRadiusM;
    p.particleSizeState = all[index].particleSizeState ? { ...all[index].particleSizeState } : null;
  });
  return {
    scenario,
    closures: baseClosures,
    allowFixtureMaterialProperties,
    state,
    box: { dimensionsM: boxDims, edgeM: Math.max(...boxDims) },
    dropMaterial,
    baseMaterial,
    initialTemperaturesK: { drop: dropTempK, base: baseTempK, gas: scenario.gas.initialTemperatureK },
    initialParticleSpacing,
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
  const dims = pressureBoxDimensionsM(boxDimsM || pressureSummary?.boxDimsM, pressureSummary?.boxVolumeM3);
  const usable = Number.isFinite(totalPressurePa) && dims.every((value) => value > 0);
  const localGradientReady = usable
    && localCells.length > 0
    && effectiveField?.localPressureGradientReady === true;
  const retainedSpatialGasSourceBufferRefs = localGradientReady
    ? uniqueStringsFrom(effectiveField?.retainedSpatialGasSourceBufferRefs)
    : [];
  const workerRetainedSpatialGasSourceBufferRefs = localGradientReady
    ? uniqueStringsFrom(effectiveField?.workerRetainedSpatialGasSourceBufferRefs)
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
    cellCount: localGradientReady ? localCells.length : (usable ? 1 : 0),
    cells: localGradientReady ? localCells : [],
    pressureFieldMode: localGradientReady
      ? LOCAL_GAS_CELL_PRESSURE_FIELD_MODE
      : (usable ? UNIFORM_GAS_PRESSURE_FIELD_MODE : 'pressure-field-unavailable'),
    pressureFieldResolution: localGradientReady
      ? LOCAL_GAS_CELL_PRESSURE_FIELD_RESOLUTION
      : (usable ? UNIFORM_GAS_PRESSURE_FIELD_RESOLUTION : 'pressure-field-unavailable'),
    pressureFieldCellFamily: 'resident-gas-pressure',
    uniformPressurePa: Number.isFinite(totalPressurePa) ? totalPressurePa : null,
    uniformPressureGaugePa: pressureGaugePa,
    pressureGradientPaPerM: localGradientReady
      ? vector3From(effectiveField?.pressureGradientPaPerM)
      : [0, 0, 0],
    gradientStatus: localGradientReady
      ? 'local-pressure-gradient-field-ready'
      : (usable ? 'uniform-sealed-gas-pressure-zero-gradient' : 'pressure-field-unavailable'),
    localPressureGradientSchema: ULG_SPH_LOCAL_PRESSURE_GRADIENT_FIELD_SCHEMA,
    localPressureGradientReady: localGradientReady,
    localPressureGradientStatus: localGradientReady
      ? 'local-pressure-gradient-field-ready'
      : (usable
          ? 'blocked-uniform-single-cell-field-has-no-local-gradient'
          : 'blocked-pressure-field-unavailable'),
    localPressureGradientBlockers: localGradientReady
      ? []
      : (usable ? [...LOCAL_PRESSURE_GRADIENT_BLOCKERS] : ['pressure-field-unavailable']),
    localPressureGradientForceCouplingStatus: localGradientReady
      ? 'local-pressure-gradient-force-coupling-ready'
      : 'blocked-local-pressure-gradient-field-required',
    gasCellForceCouplingPolicy: localGradientReady
      ? 'local-pressure-gradient-interface-traction'
      : (usable ? 'uniform-interface-traction-only' : 'blocked-pressure-field-unavailable'),
    materialSurfaceCouplingStatus: usable
      ? 'blocked-material-surface-normals-not-resolved'
      : 'blocked-gas-pressure-field-unavailable',
    localPressureGradientValidation: localGradientReady,
    spatialGasSpeciesLedgerSchema: spatialLedger?.schema ?? null,
    spatialGasSpeciesLedgerStatus: spatialLedger?.status ?? null,
    residentSpatialGasSpeciesLedgerStatus: localGradientReady && spatialField?.residentSpatialGasSpeciesLedgerStatus
      ? spatialField.residentSpatialGasSpeciesLedgerStatus
      : (spatialLedger
          ? (spatialField?.residentSpatialGasSpeciesLedgerStatus || 'blocked-spatial-gas-species-ledger-empty-or-invalid')
          : 'blocked-resident-spatial-gas-species-ledger-required'),
    eosPressureClosure: localGradientReady && spatialField?.eosPressureClosure
      ? spatialField.eosPressureClosure
      : null,
    retainedSpatialGasSourceBufferRefs,
    workerRetainedSpatialGasSourceBufferRefs,
    spatialGasSourceBufferRetained: localGradientReady
      && (effectiveField?.spatialGasSourceBufferRetained === true
        || retainedSpatialGasSourceBufferRefs.length > 0
        || workerRetainedSpatialGasSourceBufferRefs.length > 0),
    residentGasCellGradientCouplingValidation: false,
    pressureFieldValidation: localGradientReady,
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
  pressureInterfaceCoupling = null
} = {}) {
  const coupling = pressureInterfaceCoupling || gasPressureInterfaceCouplingSummary({
    pressureFeedback,
    materialInterfaceField
  });
  const pressureFieldResolution = gasPressureFieldResolutionDiagnostics(pressureFeedback?.gasCellField);
  const fallbackPressurePa = Number(pressureFeedback?.gasCellField?.uniformPressurePa ?? pressureFeedback?.totalPressurePa);
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
  if (canPreview) {
    for (const element of materialInterfaceField.elements) {
      if (element?.status !== 'interface-element-ready' || !(element.areaM2 > 0)) continue;
      const centroidM = Array.isArray(element.centroidM) ? element.centroidM : [0, 0, 0];
      const pressureSample = pressureAtInterfaceCentroid({
        pressureFeedback,
        centroidM,
        fallbackPressurePa
      });
      const pressurePa = pressureSample.pressurePa;
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
    surfaceForceCount: forceBySurface.size,
    totalInterfaceAreaM2: materialInterfaceField?.totalSurfaceAreaM2 ?? 0,
    totalAbsInterfaceForceN,
    netForceN,
    surfaceForces: [...forceBySurface.values()],
    forceDerivation: pressureFieldResolution.localPressureGradientReady
      ? 'local-gas-cell-pressure-gradient-times-interface-normal-area-vector'
      : 'uniform-gas-pressure-times-interface-normal-area-vector',
    forceResolution: pressureFieldResolution.localPressureGradientReady
      ? 'local-gradient-interface-traction'
      : 'uniform-interface-traction',
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
  pressureInterfaceCoupling = null
} = {}) {
  const coupling = pressureInterfaceCoupling || gasPressureInterfaceCouplingSummary({
    pressureFeedback,
    materialInterfaceField
  });
  const pressureFieldResolution = gasPressureFieldResolutionDiagnostics(pressureFeedback?.gasCellField);
  const fallbackPressurePa = Number(pressureFeedback?.gasCellField?.uniformPressurePa ?? pressureFeedback?.totalPressurePa);
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
  if (canSolve) {
    for (const element of materialInterfaceField.elements) {
      if (element?.status !== 'interface-element-ready' || !(element.areaM2 > 0)) continue;
      const centroidM = Array.isArray(element.centroidM) ? element.centroidM : [0, 0, 0];
      const pressureSample = pressureAtInterfaceCentroid({
        pressureFeedback,
        centroidM,
        fallbackPressurePa
      });
      const pressurePa = pressureSample.pressurePa;
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
      ? 'local-gas-cell-pressure-gradient-interface-normal-area-with-equal-opposite-gas-reaction'
      : 'uniform-gas-pressure-interface-normal-area-with-equal-opposite-gas-reaction',
    forceResolution: pressureFieldResolution.localPressureGradientReady
      ? 'local-gradient-interface-traction'
      : 'uniform-interface-traction',
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

export function gasPressureSummaryFromResidentReaction({
  baselineSummary = null,
  reactionSummary = null,
  residentProductMass = null,
  reactionTable = null,
  materialProperties = {},
  fallbackTemperatureK = 293.15
} = {}) {
  const residentProductMassGasLedger = residentProductMass?.gasSpeciesLedger?.schema
    ? residentProductMass.gasSpeciesLedger
    : null;
  const compactLedgerAvailable = Boolean(reactionSummary?.compactLedgerAvailable || residentProductMassGasLedger);
  if (!compactLedgerAvailable) {
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

  const dropDensity = densityAtTemperatureKgPerM3(dropProps, dropTemp);
  const baseDensity = densityAtTemperatureKgPerM3(baseProps, baseTemp);
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
    requireFirstPrinciplesMaterialMap(demo.materialProperties, { context: 'createSphPhaseDemo.initial-materials' });
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
  const mlsMpmLiquidVelocityDiffusionAlpha = options.mlsMpmLiquidVelocityDiffusionAlpha ?? 0;
  const mlsMpmLiquidVelocityDiffusionRadiusM = options.mlsMpmLiquidVelocityDiffusionRadiusM ?? (2 * gridSpacingM);
  const mlsMpmLiquidWallDampingAlpha = options.mlsMpmLiquidWallDampingAlpha ?? 0.2;
  const mlsMpmLiquidWallDampingDistanceM = options.mlsMpmLiquidWallDampingDistanceM ?? (1.5 * gridSpacingM);
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
    mlsMpmLiquidWallDampingAlpha,
    mlsMpmLiquidWallDampingDistanceM,
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
  const phaseAwareEos = createPhaseAwareEos(demo.materialProperties, { soundSpeedScale, minGasSoundSpeedMPerS });
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
      liquidWallDampingAlpha: physicalLawGroups.viscosity ? mlsMpmLiquidWallDampingAlpha : 0,
      liquidWallDampingDistanceM: mlsMpmLiquidWallDampingDistanceM,
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
    allowReducedProductProperties: demo.allowFixtureMaterialProperties
  });
  const discoveredReactions = discovery.reactions;
  for (const [key, closure] of Object.entries(discovery.productClosures)) {
    if (!demo.allowFixtureMaterialProperties) {
      requireFirstPrinciplesMaterialProperties(closure.properties, {
        material: key,
        context: 'createSphPhaseDemo.product-material'
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
