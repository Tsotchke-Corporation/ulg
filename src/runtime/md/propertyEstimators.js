// General, material-agnostic property estimators. These read MD samples (from runMd) and a
// system, and derive thermodynamic properties the same way for ANY material/potential — no
// per-material analytic model. This is what replaces the Debye/Drude/Richards/Grüneisen
// patchwork: properties are *measured* from statistical mechanics.

export function mean(values) {
  return values.reduce((s, x) => s + x, 0) / values.length;
}

export function variance(values) {
  const m = mean(values);
  return mean(values.map((x) => (x - m) ** 2));
}

/**
 * Average temperature / pressure / energies from a sampled run.
 */
export function equilibriumAverages(samples) {
  return {
    temperatureK: mean(samples.temperatureK),
    pressurePa: mean(samples.pressurePa),
    totalEnergyJ: mean(samples.totalEnergyJ),
    potentialEnergyJ: mean(samples.potentialEnergyJ)
  };
}

/**
 * Mass density (kg/m^3) of the simulated system: total mass / box volume.
 */
export function densityKgPerM3(sys) {
  const totalMass = sys.masses.reduce((s, m) => s + m, 0);
  return totalMass / sys.boxLengthM ** 3;
}

/**
 * Heat capacity (J/K) from a temperature scan: c = dE/dT measured between two equilibrium runs.
 * Material-agnostic — the same finite difference works for gas, liquid, or solid.
 */
export function heatCapacityFromScan({ temperatureK: t1, totalEnergyJ: e1 }, { temperatureK: t2, totalEnergyJ: e2 }) {
  return (e2 - e1) / (t2 - t1);
}

/**
 * Specific heat capacity (J/(kg K)) from a temperature scan.
 */
export function specificHeatFromScan(runLow, runHigh, totalMassKg) {
  return heatCapacityFromScan(runLow, runHigh) / totalMassKg;
}
