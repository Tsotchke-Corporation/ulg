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

import {
  cachedParticleEquilibriumFromSpecificEnergy,
  stablePhaseFromSpecificEnergy
} from '../material/phaseEquilibrium.js';

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
export function createPhaseAwareEos(materialProperties, { soundSpeedScale = 1, cflMaxSoundSpeedMPerS = 0, minGasSoundSpeedMPerS = 0 } = {}) {
  const phaseScale = (cReal) => (cflMaxSoundSpeedMPerS > 0
    ? (cReal > 0 ? Math.min(1, cflMaxSoundSpeedMPerS / cReal) : 1)
    : soundSpeedScale);
  return function phaseAwareEos({ density, specificInternalEnergyJPerKg, particle }) {
    const props = materialProperties[particle?.material];
    if (!props) return { pressurePa: 0, soundSpeedMPerS: 0 };
    const phase = stablePhaseFromSpecificEnergy(props, specificInternalEnergyJPerKg) || 'liquid';
    const ph = props.phases.find((p) => p.name === phase) || props.phases[0];
    const rho0 = Number.isFinite(ph.densityKgPerM3) ? ph.densityKgPerM3 : density;
    if (phase === 'gas') {
      const eq = cachedParticleEquilibriumFromSpecificEnergy(props, particle, specificInternalEnergyJPerKg);
      const Rspecific = R_GAS / props.molarMassKgPerMol;
      const cp = ph.cpJPerKgK;
      const gamma = cp > Rspecific ? cp / (cp - Rspecific) : 1.33; // cp/cv, cv = cp - R/M
      const cReal = Math.sqrt(Math.max(gamma * Rspecific * eq.temperatureK, 0));
      const c = Math.max(cReal * phaseScale(cReal), minGasSoundSpeedMPerS);
      // Drives liquid-packed steam to expand toward the gas rest density.
      // Capped near the rest density so condensed-packed vapor pushes at a
      // bounded, saturation-like pressure instead of c^2*(rho_liquid - rho0).
      const effectiveDensity = Math.min(density, rho0 * 3);
      return { pressurePa: Math.max(0, c * c * (effectiveDensity - rho0)), soundSpeedMPerS: c };
    }
    // Condensed: sound speed from the bulk modulus.
    const cReal = ph.bulkModulusPa ? Math.sqrt(ph.bulkModulusPa / rho0) : 0;
    const c = cReal * phaseScale(cReal);
    const ratio = density / Math.max(rho0, 1e-9);
    const bulk = (rho0 * c * c) / TAIT_EXPONENT;
    // Vaporization-plateau partial pressure: the gas fraction pushes at
    // saturation scale so the mixture inflates gradually (GPU P2G parity).
    const eqForFractions = cachedParticleEquilibriumFromSpecificEnergy(props, particle, specificInternalEnergyJPerKg);
    const gasFraction = Math.min(Math.max(eqForFractions?.phaseFractions?.gas ?? 0, 0), 1);
    const pressurePa = bulk * (ratio ** TAIT_EXPONENT - 1) + gasFraction * 101325;
    // Condensed phases need the signed side of the Tait law so the reduced carrier has a restoring
    // stress on both sides of the rest density. Cavitation/surface tension are still separate laws,
    // but clamping this to zero removes the liquid's basic volume correction and lets blobs drift
    // through expanded, underconstrained states.
    return { pressurePa, soundSpeedMPerS: c };
  };
}
