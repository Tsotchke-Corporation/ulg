// Phase-aware, multi-material weakly-compressible EOS for the SPH carrier.
//
// This is the piece that makes volume change emerge from the thermodynamics instead of being
// scripted. Every particle's pressure references the REST DENSITY of its *current phase*, read
// from the material closures:
//
//   - condensed phases (solid / liquid): a Tait/Cole law
//         p = (rho0 c^2 / n) ((rho/rho0)^n - 1)
//     pins the material near its physical density (iron ~7000, water ~1000). With a single
//     ideal-gas law instead, molten iron's huge specific internal energy produced ~GPa pressure
//     and the iron puffed apart like a gas; here it stays incompressible.
//
//   - gas phase (steam / air): p = c^2 (rho - rho0_gas). A water particle that has just flashed to
//     steam is still liquid-packed (rho >> rho0_gas ~ 0.8 kg/m^3), so it carries a large positive
//     pressure that drives it to expand toward the gas density — the ~1200x volume jump of boiling
//     emerges automatically, rather than the steam staying liquid-sized.
//
// The reference sound speeds are weakly-compressible values chosen for a stable interactive
// timestep (true GPa stiffness would force a far smaller dt); the *qualitative* behaviour — who
// stays incompressible and who expands — comes from the rest-density reference, which is physical.
// Evidence-only: this is still a reduced reference, so the demo's sphValidation stays false.

import { equilibriumFromSpecificEnergy } from '../material/phaseEquilibrium.js';

const TAIT_EXPONENT = 7;

/**
 * Build a per-particle EOS closure for computeAccelerationsAndEnergyRates. It maps each particle's
 * specific internal energy to a phase (via the closures), looks up that phase's rest density, and
 * returns { pressurePa, soundSpeedMPerS } from the weakly-compressible law above.
 */
export function createPhaseAwareEos(materialProperties, {
  condensedSoundSpeedMPerS = 220,
  gasSoundSpeedMPerS = 60
} = {}) {
  const restDensityCache = new Map();
  function restDensityOf(material, phase) {
    const cacheKey = `${material}:${phase}`;
    if (restDensityCache.has(cacheKey)) return restDensityCache.get(cacheKey);
    const props = materialProperties[material];
    const ph = props?.phases?.find((p) => p.name === phase);
    const value = ph && Number.isFinite(ph.densityKgPerM3) ? ph.densityKgPerM3 : null;
    restDensityCache.set(cacheKey, value);
    return value;
  }

  return function phaseAwareEos({ density, specificInternalEnergyJPerKg, particle }) {
    const props = materialProperties[particle?.material];
    let phase = 'liquid';
    if (props) {
      phase = equilibriumFromSpecificEnergy(props, specificInternalEnergyJPerKg).stablePhase || 'liquid';
    }
    const rho0 = restDensityOf(particle?.material, phase) ?? density;
    if (phase === 'gas') {
      const c = gasSoundSpeedMPerS;
      const p = c * c * (density - rho0); // drives liquid-packed steam to expand toward rho0_gas
      return { pressurePa: Math.max(0, p), soundSpeedMPerS: c };
    }
    const c = condensedSoundSpeedMPerS;
    const ratio = density / Math.max(rho0, 1e-9);
    const bulk = (rho0 * c * c) / TAIT_EXPONENT;
    const p = bulk * (ratio ** TAIT_EXPONENT - 1);
    return { pressurePa: p, soundSpeedMPerS: c };
  };
}
