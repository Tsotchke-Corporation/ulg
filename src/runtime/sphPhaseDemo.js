// SPH phase demo logic (headless; the renderer in visualization/sphPhaseScene.js draws it).
//
// Builds the molten-iron-on-ice scenario as an SPH particle cloud whose specific internal
// energy (and therefore phase + render colour) comes from the material closures, runs the
// energy-feasibility preflight, and steps the conservative CPU-reference carrier. This is a
// reduced-resolution reference: condensed-phase EOS, multi-material contact, wall heat flux,
// and conduction are demo plan P5 — so the stepping is labelled a reference, not validated
// phase physics. Evidence-only throughout.

import { createReferenceMaterialClosures } from './material/materialClosures.js';
import { specificInternalEnergyJPerKg } from './material/thermoState.js';
import { equilibriumFromSpecificEnergy } from './material/phaseEquilibrium.js';
import { incandescentColor } from './material/radiationClosure.js';
import { intrinsicColorSrgb } from './material/opticalClosure.js';
import { createSphState } from './sph/sphState.js';
import { createSphPhaseCarrier } from './sph/sphPhaseCarrier.js';
import { sphTotals } from './sph/sphConservation.js';
import { buoyancyAccelerationMPerS2, phaseMassWithSteam, thermalStep } from './sph/thermalPhase.js';
import { createPhaseAwareEos } from './sph/multiMaterialEos.js';
import { createSphPhaseScenario, computeThermodynamicPreflight } from './thermoPreflight.js';

function fillCube({ material, min, size, spacing, temperatureK, properties, densityKgPerM3 }) {
  const particles = [];
  const n = Math.max(2, Math.round(size / spacing));
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
          temperatureK
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
  closures = createReferenceMaterialClosures(),
  dropMaterial = 'fe',
  baseMaterial = 'h2o',
  ironSpacingM,
  iceSpacingM,
  iceBaseHeightM,
  ironBaseHeightM
} = {}) {
  const boxEdge = scenario.box.edgeM;
  const ironEdge = scenario.iron.edgeM;
  const iceEdge = scenario.ice.edgeM;
  const cx = boxEdge / 2;
  const cz = boxEdge / 2;
  // Reduced resolution so the O(N^2) CPU reference carrier runs interactively in the browser.
  // (Higher counts and the O(N) / GPU hot loop are the performance-upgrade track.)
  const ironSpacing = ironSpacingM ?? ironEdge / 3;
  const iceSpacing = iceSpacingM ?? iceEdge / 5;

  // Configurable starting elevation (bottom face) of each block. The base block defaults to resting
  // on the floor; the drop block defaults to a clear gap above it so it visibly falls.
  const iceBase = iceBaseHeightM ?? 0;
  const ironBase = ironBaseHeightM ?? (iceBase + iceEdge + Math.max(iceEdge, 1.0));

  const dropProps = closures[dropMaterial].properties;
  const baseProps = closures[baseMaterial].properties;
  const dropTempK = scenario.iron.initialTemperatureK; // hot role temperature
  const baseTempK = scenario.ice.initialTemperatureK; // cold role temperature

  const dropParticles = fillCube({
    material: dropMaterial,
    min: [cx - ironEdge / 2, ironBase, cz - ironEdge / 2],
    size: ironEdge,
    spacing: ironSpacing,
    temperatureK: dropTempK,
    properties: dropProps,
    densityKgPerM3: densityAtTemperatureKgPerM3(dropProps, dropTempK)
  });
  const baseParticles = fillCube({
    material: baseMaterial,
    min: [cx - iceEdge / 2, iceBase, cz - iceEdge / 2],
    size: iceEdge,
    spacing: iceSpacing,
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
  });
  return {
    scenario,
    closures,
    state,
    box: { edgeM: boxEdge },
    dropMaterial,
    baseMaterial,
    counts: { drop: dropParticles.length, base: baseParticles.length, total: all.length },
    materialProperties: { fe: closures.fe.properties, h2o: closures.h2o.properties, air: closures.air.properties }
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
    const c = intrinsicColorSrgb({ material: p.material, phase: eq.stablePhase });
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

/**
 * Create the demo driver: preflight + a reduced-resolution CPU reference carrier stepper.
 */
export function createSphPhaseDemo(options = {}) {
  const demo = buildSphPhaseDemoState(options);
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
  const carrierDt = options.dt ?? 3e-4;
  const mechanicalSubsteps = options.mechanicalSubsteps ?? 24;
  const dtStepS = mechanicalSubsteps * carrierDt; // sim-time advanced per driver.step
  const buoyancyCap = options.buoyancyCapMPerS2 ?? 45;
  // Phase-aware multi-material EOS: each particle's pressure references its current phase's rest
  // density (from the closures), so condensed iron/water stay ~incompressible while vaporized water
  // expands toward the gas density. This is what makes the steam grow in volume and stops the
  // molten iron from puffing up like a gas.
  const eos = createPhaseAwareEos(demo.materialProperties, {
    condensedSoundSpeedMPerS: options.condensedSoundSpeedMPerS ?? 180,
    gasSoundSpeedMPerS: options.gasSoundSpeedMPerS ?? 70
  });
  // The weakly-compressible sound speeds (~180 m/s) cap the acoustic CFL, so the timestep can be
  // ~6x the old ideal-gas-stiffness value — more mechanical sim-time per (equally expensive) step,
  // which is what lets the steam expansion and the falling iron actually develop on screen.
  const carrier = createSphPhaseCarrier({
    dimension: 3,
    gamma: options.gamma ?? 1.4,
    gravity: options.gravity ?? [0, -9.80665, 0],
    alpha: options.alpha ?? 1.0,
    beta: options.beta ?? 2.0,
    dt: options.dt ?? 3e-4,
    eos
  });
  return {
    demo,
    preflight() {
      return computeThermodynamicPreflight(demo.scenario);
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

      // Display safeguards: reflect at the sealed-box walls and clamp speed so the (reduced,
      // pre-full-EOS) cloud stays bounded and on-screen.
      const edge = demo.box.edgeM;
      const maxSpeed = options.maxDisplaySpeedMPerS ?? 25;
      for (const p of demo.state.particles) {
        for (let d = 0; d < 3; d += 1) {
          if (p.x[d] < 0) { p.x[d] = 0; p.v[d] = Math.abs(p.v[d]) * 0.4; }
          else if (p.x[d] > edge) { p.x[d] = edge; p.v[d] = -Math.abs(p.v[d]) * 0.4; }
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
