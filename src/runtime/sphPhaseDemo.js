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
export function buildSphPhaseDemoState({ scenario = createSphPhaseScenario(), closures = createReferenceMaterialClosures(), ironSpacingM, iceSpacingM, ironDropGapM = 0.6 } = {}) {
  const boxEdge = scenario.box.edgeM;
  const ironEdge = scenario.iron.edgeM;
  const iceEdge = scenario.ice.edgeM;
  const cx = boxEdge / 2;
  const cz = boxEdge / 2;
  // Reduced resolution so the O(N^2) CPU reference carrier runs interactively in the browser.
  // (Higher counts and the O(N) / GPU hot loop are the performance-upgrade track.)
  const ironSpacing = ironSpacingM ?? ironEdge / 3;
  const iceSpacing = iceSpacingM ?? iceEdge / 5;

  // The iron block starts a small gap above the ice and falls onto it under gravity.
  const ironParticles = fillCube({
    material: 'fe',
    min: [cx - ironEdge / 2, iceEdge + ironDropGapM, cz - ironEdge / 2],
    size: ironEdge,
    spacing: ironSpacing,
    temperatureK: scenario.iron.initialTemperatureK,
    properties: closures.fe.properties,
    densityKgPerM3: closures.fe.properties.phases.find((p) => p.name === 'liquid').densityKgPerM3
  });
  const iceParticles = fillCube({
    material: 'h2o',
    min: [cx - iceEdge / 2, 0, cz - iceEdge / 2],
    size: iceEdge,
    spacing: iceSpacing,
    temperatureK: scenario.ice.initialTemperatureK,
    properties: closures.h2o.properties,
    densityKgPerM3: closures.h2o.properties.phases.find((p) => p.name === 'solid').densityKgPerM3
  });

  const all = [...iceParticles, ...ironParticles];
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
    counts: { fe: ironParticles.length, h2o: iceParticles.length, total: all.length },
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
      if (phase === 'gas') return 'steam';
    }
    return p.material;
  });
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
  // Thermal-substep rates are accelerated for interactive visualization; the structure
  // (conduction, six-wall flux, latent-heat phase change) is physical (see thermalPhase.js).
  const dtThermalS = options.dtThermalS ?? 0.02;
  const buoyancyCap = options.buoyancyCapMPerS2 ?? 45;
  const carrier = createSphPhaseCarrier({
    dimension: 3,
    gamma: options.gamma ?? 1.4,
    gravity: options.gravity ?? [0, -9.80665, 0],
    alpha: options.alpha ?? 1.0,
    beta: options.beta ?? 2.0,
    dt: options.dt ?? 5e-5
  });
  return {
    demo,
    preflight() {
      return computeThermodynamicPreflight(demo.scenario);
    },
    step() {
      const result = carrier.step(demo.state);
      demo.state = result.state;

      // P5: evolve energy by conduction + six-wall heat flux (closures wired into the dynamics).
      const { wallHeatJ, thermal } = thermalStep(demo.state, {
        materialProperties: demo.materialProperties,
        wallTemperaturesK: demo.scenario.walls.faces,
        boxEdgeM: demo.box.edgeM,
        dtS: dtThermalS,
        conductionRate: options.conductionRate,
        wallRate: options.wallRate
      });
      for (const face of Object.keys(demo.wallHeatLedgerJ)) demo.wallHeatLedgerJ[face] += wallHeatJ[face];

      // Phase-driven buoyancy: water that has vaporized (gas phase) rises as steam (reuse the
      // phases the thermal step already computed).
      const steamBuoyancy = Math.min(buoyancyCap, buoyancyAccelerationMPerS2(gasDensity, liquidDensity));
      demo.state.particles.forEach((p, i) => {
        if (p.material === 'h2o' && thermal[i].phase === 'gas') p.v[1] += steamBuoyancy * dtThermalS;
      });

      // Display safeguards: reflect at the sealed-box walls and clamp speed so the (reduced,
      // pre-full-EOS) cloud stays bounded and on-screen.
      const edge = demo.box.edgeM;
      const maxSpeed = options.maxDisplaySpeedMPerS ?? 8;
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
