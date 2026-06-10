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
const R_GAS = 8.314462618; // J/(mol K)

/**
 * Build a per-particle EOS closure for computeAccelerationsAndEnergyRates. The sound speed of each
 * phase is DERIVED from material properties, not set by hand:
 *  - condensed (solid/liquid): c = √(K/ρ₀) from the phase's bulk modulus K (closure property).
 *  - gas: the ideal-gas sound speed c = √(γ R T / M), with γ = cp/cv (cv = cp − R/M) from the
 *    closure's heat capacity and molar mass.
 * `soundSpeedScale` is the single demo-stability concession — one global dimensionless factor that
 * scales every real sound speed down so the timestep is interactive (real GPa/ideal-gas speeds
 * would force a tiny dt). It scales all materials equally, so the RELATIVE stiffnesses stay
 * physical (iron stiffer than ice stiffer than water). Returns { pressurePa, soundSpeedMPerS }.
 */
export function createPhaseAwareEos(materialProperties, { soundSpeedScale = 1, minGasSoundSpeedMPerS = 0 } = {}) {
  return function phaseAwareEos({ density, specificInternalEnergyJPerKg, particle }) {
    const props = materialProperties[particle?.material];
    if (!props) return { pressurePa: 0, soundSpeedMPerS: 0 };
    const eq = equilibriumFromSpecificEnergy(props, specificInternalEnergyJPerKg);
    const phase = eq.stablePhase || 'liquid';
    const ph = props.phases.find((p) => p.name === phase) || props.phases[0];
    const rho0 = Number.isFinite(ph.densityKgPerM3) ? ph.densityKgPerM3 : density;
    if (phase === 'gas') {
      const Rspecific = R_GAS / props.molarMassKgPerMol;
      const cp = ph.cpJPerKgK;
      const gamma = cp > Rspecific ? cp / (cp - Rspecific) : 1.33; // cp/cv, cv = cp - R/M
      const cReal = Math.sqrt(Math.max(gamma * Rspecific * eq.temperatureK, 0));
      const c = Math.max(cReal * soundSpeedScale, minGasSoundSpeedMPerS);
      // Drives liquid-packed steam to expand toward the gas rest density.
      return { pressurePa: Math.max(0, c * c * (density - rho0)), soundSpeedMPerS: c };
    }
    // Condensed: sound speed from the bulk modulus.
    const cReal = ph.bulkModulusPa ? Math.sqrt(ph.bulkModulusPa / rho0) : 0;
    const c = cReal * soundSpeedScale;
    const ratio = density / Math.max(rho0, 1e-9);
    const bulk = (rho0 * c * c) / TAIT_EXPONENT;
    return { pressurePa: bulk * (ratio ** TAIT_EXPONENT - 1), soundSpeedMPerS: c };
  };
}
