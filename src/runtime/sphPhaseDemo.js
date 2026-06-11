// SPH phase demo logic (headless; the renderer in visualization/sphPhaseScene.js draws it).
//
// Builds the molten-iron-on-ice scenario as an SPH particle cloud whose specific internal
// energy (and therefore phase + render colour) comes from the material closures, runs the
// energy-feasibility preflight, and steps the conservative CPU-reference carrier. This is a
// reduced-resolution reference: condensed-phase EOS, multi-material contact, wall heat flux,
// and conduction are demo plan P5 — so the stepping is labelled a reference, not validated
// phase physics. Evidence-only throughout.

import { createFirstPrinciplesMaterialClosures, createReferenceMaterialClosures } from './material/materialClosures.js';
import { createDerivedMaterialClosure } from './material/materialDerivation.js';
import { specificInternalEnergyJPerKg } from './material/thermoState.js';
import { equilibriumFromSpecificEnergy } from './material/phaseEquilibrium.js';
import { incandescentColor } from './material/radiationClosure.js';
import { intrinsicColorSrgb } from './material/opticalClosure.js';
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
  const baseClosures = closures ?? (
    allowFixtureMaterialProperties
      ? createReferenceMaterialClosures()
      : createFirstPrinciplesMaterialClosures()
  );
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
  for (const key of [dropMaterial, baseMaterial]) {
    if (resolved[key]) continue;
    const Z = zForSymbol(key);
    const ec = Z != null ? elementMaterialClosure(Z, { allowReducedEstimates: allowFixtureMaterialProperties }) : null;
    if (ec) {
      resolved[key] = ec;
      continue;
    }
    try {
      resolved[key] = createDerivedMaterialClosure(key);
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
    const eq = equilibriumFromSpecificEnergy(props, p.specificInternalEnergyJPerKg);
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
    const eq = equilibriumFromSpecificEnergy(props, p.specificInternalEnergyJPerKg);
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
  return demo.state.particles.map((p) => {
    if (p.material === 'h2o') {
      const phase = equilibriumFromSpecificEnergy(demo.materialProperties.h2o, p.specificInternalEnergyJPerKg).stablePhase;
      if (phase === 'gas') return 'steam'; // optically-thin vapour → condensation cloud
      if (phase === 'solid') return 'ice'; // translucent white (grain scattering), distinct from clear water
    }
    return p.material;
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
    const eq = equilibriumFromSpecificEnergy(props, p.specificInternalEnergyJPerKg);
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
 * Phase mass summary (water mass by phase, iron solid fraction) for the status rows.
 */
export function phaseMassSummary(demo) {
  const byMaterialPhase = {};
  let feSolidMass = 0;
  let feTotalMass = 0;
  demo.state.particles.forEach((p) => {
    const props = demo.materialProperties[p.material];
    const phase = equilibriumFromSpecificEnergy(props, p.specificInternalEnergyJPerKg).stablePhase;
    byMaterialPhase[p.material] = byMaterialPhase[p.material] || {};
    byMaterialPhase[p.material][phase] = (byMaterialPhase[p.material][phase] || 0) + p.massKg;
    if (p.material === 'fe') {
      feTotalMass += p.massKg;
      if (phase === 'solid') feSolidMass += p.massKg;
    }
  });
  return { byMaterialPhase, ironSolidFraction: feTotalMass > 0 ? feSolidMass / feTotalMass : null };
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
  const particleResolution = {
    [demo.baseMaterial]: materialEntities(demo.baseMaterial, baseMassKg, baseProps, scenario.particleResolution.h2o),
    [demo.dropMaterial]: materialEntities(demo.dropMaterial, dropMassKg, dropProps, scenario.particleResolution.fe),
    gas: airProps ? materialEntities('air', airMassKg, airProps, scenario.particleResolution.gas) : null
  };
  return {
    scenarioId: scenario.scenarioId,
    status: feasible ? 'preflight-feasible-derived-closures' : 'preflight-infeasible-derived-closures',
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
  const cflMaxSoundSpeedMPerS = (cflSafety * mechLengthM) / carrierDt;
  const soundSpeedScale = Math.min(1, maxRealSoundSpeed > 0 ? cflMaxSoundSpeedMPerS / maxRealSoundSpeed : 1);
  const modulusScale = soundSpeedScale * soundSpeedScale; // moduli scale as c^2
  const eos = createPhaseAwareEos(demo.materialProperties, { soundSpeedScale, minGasSoundSpeedMPerS: 40 });

  let carrier;
  if (mechanics === 'mlsmpm') {
    // Phase-dependent constitutive model: a particle in its SOLID phase resists shear (corotated
    // elasticity → it holds its block shape); when it melts (phase → liquid/gas, shear modulus 0) it
    // becomes a fluid and flows. The elastic moduli are the phase's real shear μ and Lamé
    // λ = K − ⅔μ (from the closure bulk/shear moduli), scaled by the same global modulusScale as the
    // EOS — derived material properties, not arbitrary constants.
    const constitutiveOf = (p) => {
      const props = demo.materialProperties[p.material];
      const phase = equilibriumFromSpecificEnergy(props, p.specificInternalEnergyJPerKg).stablePhase;
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
      gravity: options.gravity ?? [0, -9.80665, 0],
      eos,
      restDensityOf: (p) => p.restDensityKgPerM3 || demo.materialProperties[p.material].phases[0].densityKgPerM3,
      constitutiveOf
    });
  } else {
    carrier = createSphPhaseCarrier({
      dimension: 3,
      gamma: options.gamma ?? 1.4,
      gravity: options.gravity ?? [0, -9.80665, 0],
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
  // Contact radius for "the two materials are touching". In MLS-MPM two materials transfer momentum
  // through shared grid nodes, so distinct condensed bodies come to rest ~1 grid cell apart (they
  // never interpenetrate to particle-spacing range). The reaction must use that mechanical contact
  // scale — a couple of grid cells — or two blocks resting against each other would sit just outside
  // a tight radius and never react (the bug this fixes). ~2.5 cells spans the contact gap.
  const reactionContactRadiusM = gridSpacingM * 2.5;
  const reactionTemperatureOf = (p) => equilibriumFromSpecificEnergy(demo.materialProperties[p.material], p.specificInternalEnergyJPerKg).temperatureK;

  return {
    demo,
    preflight() {
      return computeDerivedDemoPreflight(demo);
    },
    step() {
      // Advance the mechanics by several CFL-limited carrier substeps so it covers the same
      // sim-time the thermal step uses below (one shared clock).
      for (let s = 0; s < mechanicalSubsteps; s += 1) {
        const result = carrier.step(demo.state);
        demo.state = result.state;
      }

      // P5: evolve energy by conduction + six-wall heat flux over the SAME sim-time as the mechanics.
      const { wallHeatJ, thermal } = thermalStep(demo.state, {
        materialProperties: demo.materialProperties,
        wallTemperaturesK: demo.scenario.walls.faces,
        boxEdgeM: demo.box.edgeM,
        boxDimsM: demo.box.dimensionsM,
        dtS: dtStepS,
        conductionRate: options.conductionRate,
        wallRate: options.wallRate
      });
      for (const face of Object.keys(demo.wallHeatLedgerJ)) demo.wallHeatLedgerJ[face] += wallHeatJ[face];

      // Phase-driven buoyancy: water that has vaporized (gas phase) rises as steam (reuse the
      // phases the thermal step already computed), over the same sim-time.
      const steamBuoyancy = Math.min(buoyancyCap, buoyancyAccelerationMPerS2(gasDensity, liquidDensity));
      demo.state.particles.forEach((p, i) => {
        if (p.material === 'h2o' && thermal[i].phase === 'gas') p.v[1] += steamBuoyancy * dtStepS;
      });

      // Reactive chemistry: reactant particles in contact above the activation temperature react,
      // becoming product and releasing the derived reaction enthalpy as heat.
      if (reactions.length) {
        reactiveStep(demo.state, { reactions, materialProperties: demo.materialProperties, contactRadiusM: reactionContactRadiusM, temperatureOf: reactionTemperatureOf });
      }

      // Display safeguards: reflect at the sealed-box walls and clamp speed so the (reduced,
      // pre-full-EOS) cloud stays bounded and on-screen.
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
