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

function fillCube({ material, min, size, spacing, particlesPerEdge, temperatureK, properties, densityKgPerM3 }) {
  const particles = [];
  // particlesPerEdge sets the resolution directly (N -> N^3 particles); else derive from spacing.
  const n = Math.max(1, particlesPerEdge != null ? Math.round(particlesPerEdge) : Math.round(size / spacing));
  const step = size / n;
  const cellVolume = step * step * step;
  const massKg = densityKgPerM3 * cellVolume;
  const u = specificInternalEnergyJPerKg(properties, temperatureK);
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      for (let k = 0; k < n; k += 1) {
        particles.push({
          material,
          x: [min[0] + (i + 0.5) * step, min[1] + (j + 0.5) * step, min[2] + (k + 0.5) * step],
          v: [0, 0, 0],
          massKg,
          specificInternalEnergyJPerKg: u,
          temperatureK,
          restDensityKgPerM3: densityKgPerM3 // initial rest density (sets the MLS-MPM particle volume)
        });
      }
    }
  }
  return particles;
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
  const ironSpacing = ironEdge / dropParticleEdge;
  const iceSpacing = iceEdge / baseParticleEdge;

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

  const dropParticles = fillCube({
    material: dropMaterial,
    min: [cx - ironEdge / 2, ironBase, cz - ironEdge / 2],
    size: ironEdge,
    particlesPerEdge: dropParticleEdge,
    temperatureK: dropTempK,
    properties: dropProps,
    densityKgPerM3: densityAtTemperatureKgPerM3(dropProps, dropTempK)
  });
  const baseParticles = fillCube({
    material: baseMaterial,
    min: [cx - iceEdge / 2, iceBase, cz - iceEdge / 2],
    size: iceEdge,
    particlesPerEdge: baseParticleEdge,
    temperatureK: baseTempK,
    properties: baseProps,
    densityKgPerM3: densityAtTemperatureKgPerM3(baseProps, baseTempK)
  });

  const all = [...baseParticles, ...dropParticles];
  const smoothingLengthM = 1.6 * Math.min(ironSpacing, iceSpacing);
  const state = createSphState({ particles: all, smoothingLengthM, dimension: 3 });
  // Carry per-particle temperature + material alongside the SPH state for rendering.
  state.particles.forEach((p, index) => {
    p.material = all[index].material;
    p.temperatureK = all[index].temperatureK;
    p.restDensityKgPerM3 = all[index].restDensityKgPerM3;
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

export function gasPressureCellFieldSummary({
  pressureSummary = null,
  boxDimsM = null,
  externalPressurePa = PHYSICAL_CONSTANTS.standardAtmospherePa,
  source = null
} = {}) {
  const totalPressurePa = Number(pressureSummary?.totalPressurePa);
  const dims = pressureBoxDimensionsM(boxDimsM || pressureSummary?.boxDimsM, pressureSummary?.boxVolumeM3);
  const usable = Number.isFinite(totalPressurePa) && dims.every((value) => value > 0);
  const pressureGaugePa = usable ? totalPressurePa - finitePositive(externalPressurePa, PHYSICAL_CONSTANTS.standardAtmospherePa) : 0;
  return {
    schema: 'peercompute.ulg.sph-sealed-gas-pressure-cell-field.v0',
    status: usable ? 'gas-cell-pressure-field-ready' : 'gas-cell-pressure-field-unavailable',
    source: source || pressureSummary?.source || 'gas-pressure-summary',
    totalPressurePa: Number.isFinite(totalPressurePa) ? totalPressurePa : null,
    pressureGaugePa,
    boxDimsM: dims,
    cellDims: usable ? [1, 1, 1] : [0, 0, 0],
    cellCount: usable ? 1 : 0,
    uniformPressurePa: Number.isFinite(totalPressurePa) ? totalPressurePa : null,
    uniformPressureGaugePa: pressureGaugePa,
    pressureGradientPaPerM: [0, 0, 0],
    gradientStatus: usable ? 'uniform-sealed-gas-pressure-zero-gradient' : 'pressure-field-unavailable',
    materialSurfaceCouplingStatus: usable
      ? 'blocked-material-surface-normals-not-resolved'
      : 'blocked-gas-pressure-field-unavailable',
    pressureFieldValidation: false,
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
  const pressurePa = Number(pressureFeedback?.gasCellField?.uniformPressurePa ?? pressureFeedback?.totalPressurePa);
  const canPreview = coupling.status === 'pressure-interface-coupling-ready-for-solver'
    && Number.isFinite(pressurePa)
    && pressurePa >= 0
    && Array.isArray(materialInterfaceField?.elements)
    && materialInterfaceField.elements.length > 0;
  const forceBySurface = new Map();
  let netForceN = [0, 0, 0];
  let totalAbsInterfaceForceN = 0;
  let previewedElementCount = 0;
  if (canPreview) {
    for (const element of materialInterfaceField.elements) {
      if (element?.status !== 'interface-element-ready' || !(element.areaM2 > 0)) continue;
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
    gasInterfacePressurePa: Number.isFinite(pressurePa) ? pressurePa : null,
    sourceInterfaceElementCount: materialInterfaceField?.elementCount ?? materialInterfaceField?.elements?.length ?? 0,
    previewedElementCount,
    surfaceForceCount: forceBySurface.size,
    totalInterfaceAreaM2: materialInterfaceField?.totalSurfaceAreaM2 ?? 0,
    totalAbsInterfaceForceN,
    netForceN,
    surfaceForces: [...forceBySurface.values()],
    forceDerivation: 'uniform-gas-pressure-times-interface-normal-area-vector',
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
  const pressurePa = Number(pressureFeedback?.gasCellField?.uniformPressurePa ?? pressureFeedback?.totalPressurePa);
  const canSolve = coupling.status === 'pressure-interface-coupling-ready-for-solver'
    && Number.isFinite(pressurePa)
    && pressurePa >= 0
    && Array.isArray(materialInterfaceField?.elements)
    && materialInterfaceField.elements.length > 0;
  const forceRows = [];
  const forceRowValues = [];
  const forceBySurface = new Map();
  let netMaterialForceN = [0, 0, 0];
  let netGasReactionForceN = [0, 0, 0];
  let totalAbsMaterialForceN = 0;
  let maxPairResidualN = 0;
  if (canSolve) {
    for (const element of materialInterfaceField.elements) {
      if (element?.status !== 'interface-element-ready' || !(element.areaM2 > 0)) continue;
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
        centroidM: Array.isArray(element.centroidM) ? [...element.centroidM] : [0, 0, 0],
        areaM2: element.areaM2,
        pressurePa,
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
    gasInterfacePressurePa: Number.isFinite(pressurePa) ? pressurePa : null,
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
    forceDerivation: 'uniform-gas-pressure-interface-normal-area-with-equal-opposite-gas-reaction',
    forceApplicationTarget: 'pending-mls-mpm-grid-force-consumer',
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
        residentLedger: reactionSummary || residentProductMass
      }),
      residentGasSpeciesCount: residentGasSpecies.length || residentGasRows.length,
      residentGasSpeciesLedgerSource: pressureGasLedgerSource,
      residentProductMassStatus: residentProductMass?.status ?? null,
      residentProductMassGasSpeciesLedgerCount: residentProductMass?.gasSpeciesLedgerCount ?? null,
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
        residentLedger: reactionSummary
      }),
      residentProductGasSource: source,
      residentProductGasRowCount: productGasRows.length,
      residentProductGasRows: productGasRows.map((row) => ({
        material: row.material,
        materialId: row.materialId,
        massKg: row.massKg,
        moles: row.moles,
        visibleMassKg: row.visibleMassKg,
        unplacedMassKg: row.unplacedMassKg,
        productTermIndex: row.productTermIndex,
        source: row.source
      })),
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
  const feasible = finalBasePhase === 'solid' && finalDropPhase === 'solid';
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
    status: feasible ? 'preflight-feasible-derived-closures' : 'preflight-infeasible-derived-closures',
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
    feasibility: {
      feasible,
      bindingInteriorTempK,
      finalH2oPhase: demo.baseMaterial === 'h2o' ? finalBasePhase : null,
      finalFePhase: demo.dropMaterial === 'fe' ? finalDropPhase : null,
      finalBasePhase,
      finalDropPhase,
      reason: feasible
        ? 'closure-derived wall equilibrium leaves both demo materials in their solid phase'
        : 'closure-derived wall equilibrium does not leave both demo materials solid'
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
    blockers: ['derived-material-models-unvalidated']
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
  const realSoundSpeed = (ph) => (ph.bulkModulusPa && ph.densityKgPerM3 ? Math.sqrt(ph.bulkModulusPa / ph.densityKgPerM3) : 0);
  let maxRealSoundSpeed = 0;
  for (const props of Object.values(demo.materialProperties)) {
    for (const ph of props.phases || []) maxRealSoundSpeed = Math.max(maxRealSoundSpeed, realSoundSpeed(ph));
  }
  const cflSafety = options.cflSafety ?? 0.4;
  const gridCflFactor = options.gridCflFactor ?? 0.6;
  const gravityMPerS2 = options.gravity ?? [0, -9.80665, 0];
  const cflMaxSoundSpeedMPerS = (cflSafety * mechLengthM) / carrierDt;
  const soundSpeedScale = Math.min(1, maxRealSoundSpeed > 0 ? cflMaxSoundSpeedMPerS / maxRealSoundSpeed : 1);
  const modulusScale = soundSpeedScale * soundSpeedScale; // moduli scale as c^2
  const minGasSoundSpeedMPerS = options.minGasSoundSpeedMPerS ?? 40;
  const gpuMechanics = {
    integrator: mechanics,
    gridSpacingM,
    dt: carrierDt,
    mechanicalSubsteps,
    soundSpeedScale,
    modulusScale,
    minGasSoundSpeedMPerS,
    cflSafety,
    gridCflFactor,
    gravityMPerS2
  };
  demo.gpuMechanics = gpuMechanics;
  demo.state.gpuMechanics = gpuMechanics;
  const eos = createPhaseAwareEos(demo.materialProperties, { soundSpeedScale, minGasSoundSpeedMPerS });

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
      if (phase !== 'solid' || !ph || !(ph.shearModulusPa > 0)) return { solid: false };
      const mu = ph.shearModulusPa * modulusScale;
      const lambda = Math.max((ph.bulkModulusPa - (2 / 3) * ph.shearModulusPa) * modulusScale, 0);
      return { solid: true, shearModulusPa: mu, lambdaPa: lambda };
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
      cflFactor: gridCflFactor
    });
  } else {
    carrier = createSphPhaseCarrier({
      dimension: 3,
      gamma: options.gamma ?? 1.4,
      gravity: gravityMPerS2,
      alpha: options.alpha ?? 1.0,
      beta: options.beta ?? 2.0,
      dt: carrierDt,
      eos
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
  const reactions = discovery.reactions;
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
      for (let s = 0; s < mechanicalSubsteps; s += 1) {
        const result = carrier.step(demo.state);
        demo.state = result.state;
        demo.state.gpuMechanics = gpuMechanics;
        if (Number.isFinite(result.activeGridNodes)) {
          mechanicsActiveGridNodeSteps += 1;
          mechanicsActiveGridNodesSum += result.activeGridNodes;
          mechanicsActiveGridNodesMax = Math.max(mechanicsActiveGridNodesMax, result.activeGridNodes);
        }
      }
      stageMs.mechanics = Math.max(0, nowMs() - stageStartMs);

      // P5: evolve energy by conduction + six-wall heat flux over the SAME sim-time as the mechanics.
      stageStartMs = nowMs();
      const { wallHeatJ, thermal } = thermalStep(demo.state, {
        materialProperties: demo.materialProperties,
        wallTemperaturesK: demo.scenario.walls.faces,
        boxEdgeM: demo.box.edgeM,
        boxDimsM: demo.box.dimensionsM,
        dtS: dtStepS,
        conductionRate: options.conductionRate,
        wallRate: options.wallRate
      });
      stageMs.thermal = Math.max(0, nowMs() - stageStartMs);
      stageStartMs = nowMs();
      for (const face of Object.keys(demo.wallHeatLedgerJ)) demo.wallHeatLedgerJ[face] += wallHeatJ[face];
      stageMs.wallLedger = Math.max(0, nowMs() - stageStartMs);

      // Phase-driven buoyancy: water that has vaporized (gas phase) rises as steam (reuse the
      // phases the thermal step already computed), over the same sim-time.
      stageStartMs = nowMs();
      const steamBuoyancy = Math.min(buoyancyCap, buoyancyAccelerationMPerS2(gasDensity, liquidDensity));
      demo.state.particles.forEach((p, i) => {
        if (p.material === 'h2o' && thermal[i].phase === 'gas') p.v[1] += steamBuoyancy * dtStepS;
      });
      stageMs.buoyancy = Math.max(0, nowMs() - stageStartMs);

      // Reactive chemistry: reactant particles in contact above the activation temperature react,
      // becoming product and releasing the derived reaction enthalpy as heat.
      let reactionEvents = 0;
      stageStartMs = nowMs();
      if (reactions.length) {
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
