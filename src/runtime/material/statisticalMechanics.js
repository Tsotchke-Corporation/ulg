// First-principles thermal physics for the material closures.
//
// Heat capacities derived from statistical mechanics rather than tabulated constants:
//  - gases: equipartition over molecular degrees of freedom (Cv = (f/2) R per mole), mixed by
//    composition. This is rigorous for a dilute ideal gas at temperatures where vibrational
//    modes are frozen — exactly air near room temperature.
//  - monatomic solids: the Debye model, Cv(T) = 9 N k_B (T/θ_D)^3 ∫ x^4 e^x/(e^x-1)^2 dx, with
//    the Debye temperature θ_D derived from sound speed + atomic number density. This reduces to
//    Dulong–Petit (3R per mole) at high T and the correct T^3 law at low T — rigorous for a
//    simple metal like iron.
//
// These are first-principles derivations (closure-backed), not measured-and-validated closures,
// so callers keep materialValidation false until validated against a measured reference.

const R = 8.314462618; // J/(mol K)
const HBAR = 1.054571817e-34;
const KB = 1.380649e-23;
const AVOGADRO = 6.02214076e23;

// Dry-air composition (mole fractions) with molecular degrees of freedom active near 300 K:
// diatomic N2/O2 -> 3 translational + 2 rotational = 5; monatomic Ar -> 3; linear CO2 -> 5.
export const AIR_COMPOSITION = Object.freeze([
  { species: 'N2', moleFraction: 0.7808, molarMassKgPerMol: 0.0280134, degreesOfFreedom: 5 },
  { species: 'O2', moleFraction: 0.2095, molarMassKgPerMol: 0.0319988, degreesOfFreedom: 5 },
  { species: 'Ar', moleFraction: 0.0093, molarMassKgPerMol: 0.0399480, degreesOfFreedom: 3 },
  { species: 'CO2', moleFraction: 0.0004, molarMassKgPerMol: 0.0440095, degreesOfFreedom: 5 }
]);

/**
 * Equipartition thermal properties of an ideal-gas mixture: mean molar mass, specific heat
 * capacities (cv, cp), and the adiabatic index gamma, derived from molecular degrees of freedom.
 */
export function gasMixtureThermal(composition = AIR_COMPOSITION) {
  let molarMassKgPerMol = 0;
  let cvMolar = 0;
  for (const c of composition) {
    molarMassKgPerMol += c.moleFraction * c.molarMassKgPerMol;
    cvMolar += c.moleFraction * (c.degreesOfFreedom / 2) * R;
  }
  const cpMolar = cvMolar + R; // ideal gas: cp = cv + R per mole
  return {
    derivation: 'equipartition-ideal-gas',
    molarMassKgPerMol,
    cvJPerKgK: cvMolar / molarMassKgPerMol,
    cpJPerKgK: cpMolar / molarMassKgPerMol,
    gamma: cpMolar / cvMolar
  };
}

/**
 * Debye temperature (K) from the sound speed and atomic number density:
 *   θ_D = (ħ v_s / k_B) (6 π^2 n)^(1/3).
 */
export function debyeTemperatureFromSoundSpeed({ soundSpeedMPerS, numberDensityPerM3 }) {
  return (HBAR * soundSpeedMPerS / KB) * Math.cbrt(6 * Math.PI * Math.PI * numberDensityPerM3);
}

/**
 * Atomic number density (atoms/m^3) from mass density and molar mass.
 */
export function atomicNumberDensity({ densityKgPerM3, molarMassKgPerMol, atomsPerFormula = 1 }) {
  return (densityKgPerM3 / molarMassKgPerMol) * AVOGADRO * atomsPerFormula;
}

// Debye function D3(y) = (3/y^3) ∫_0^y x^4 e^x / (e^x - 1)^2 dx, the ratio of Debye Cv to the
// Dulong–Petit limit. Evaluated by midpoint quadrature; D3 -> 1 as y -> 0, ~ (4π^4/5)/y^3 large y.
function debyeRatio(y) {
  if (y <= 0) return 1;
  const steps = 256;
  let integral = 0;
  for (let i = 1; i <= steps; i += 1) {
    const x = (y * (i - 0.5)) / steps;
    const ex = Math.exp(x);
    integral += (x ** 4 * ex) / ((ex - 1) ** 2);
  }
  integral *= y / steps;
  return (3 / y ** 3) * integral;
}

/**
 * Debye specific heat capacity (J/(kg K)) of a monatomic solid at temperature T.
 * High-T limit -> Dulong–Petit 3R/M; low-T limit -> the T^3 law.
 */
export function debyeHeatCapacityJPerKgK(temperatureK, { debyeTemperatureK, molarMassKgPerMol, atomsPerFormula = 1 }) {
  const dulongPetit = (3 * R * atomsPerFormula) / molarMassKgPerMol;
  return dulongPetit * debyeRatio(debyeTemperatureK / temperatureK);
}

// Debye internal-energy integral: ∫_0^y x^3/(e^x - 1) dx (midpoint quadrature).
function debyeEnergyIntegral(y) {
  if (y <= 0) return 0;
  const steps = 256;
  let integral = 0;
  for (let i = 1; i <= steps; i += 1) {
    const x = (y * (i - 0.5)) / steps;
    integral += (x ** 3) / (Math.exp(x) - 1);
  }
  return integral * (y / steps);
}

/**
 * Debye specific internal energy (J/kg) of a monatomic solid at temperature T, measured from
 * 0 K: U(T) = 9 (R a / M) T (T/θ_D)^3 ∫_0^{θ_D/T} x^3/(e^x - 1) dx. Its temperature derivative is
 * the Debye heat capacity, and at high T it reduces to the Dulong–Petit energy 3R/M · T.
 */
export function debyeInternalEnergyJPerKg(temperatureK, { debyeTemperatureK, molarMassKgPerMol, atomsPerFormula = 1 }) {
  if (temperatureK <= 0) return 0;
  const y = debyeTemperatureK / temperatureK;
  const perKg = (R * atomsPerFormula) / molarMassKgPerMol;
  return 9 * perKg * temperatureK * (1 / y ** 3) * debyeEnergyIntegral(y);
}
