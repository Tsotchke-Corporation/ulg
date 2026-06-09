// General, material-agnostic property estimators. These read MD samples (from runMd) and a
// system, and derive thermodynamic properties the same way for ANY material/potential — no
// per-material analytic model. This is what replaces the Debye/Drude/Richards/Grüneisen
// patchwork: properties are *measured* from statistical mechanics.

import { runMd } from './mdEngine.js';

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

/**
 * Self-diffusion coefficient (m^2/s) from the mean-squared displacement: D = MSD / (6 t).
 * Near-zero in a solid (particles vibrate in place), finite in a liquid/gas — the order
 * parameter that distinguishes the phases, for any material.
 */
export function diffusionCoefficientM2PerS(samples) {
  const msd = samples.meanSquaredDisplacementM2;
  if (!msd || msd.length < 2 || !(samples.sampleTimeS > 0)) return 0;
  return msd[msd.length - 1] / (6 * samples.sampleTimeS);
}

/**
 * Equation-of-state scan: run NVT at a fixed temperature for a series of box lengths and record
 * the (virial) pressure and density at each. Material-agnostic — the same scan gives the EOS,
 * the density at a target pressure, and the bulk modulus for gas, liquid, or solid.
 */
export function equationOfStateScan({ makeSystem, boxLengthsM, temperatureK, runParams }) {
  return boxLengthsM.map((boxLengthM) => {
    const sys = makeSystem(boxLengthM);
    const samples = runMd(sys, { ...runParams, thermostatTempK: temperatureK });
    const totalMass = sys.masses.reduce((s, m) => s + m, 0);
    return {
      boxLengthM,
      volumeM3: boxLengthM ** 3,
      densityKgPerM3: totalMass / boxLengthM ** 3,
      pressurePa: mean(samples.pressurePa),
      potentialEnergyJ: mean(samples.potentialEnergyJ)
    };
  });
}

/**
 * Density (kg/m^3) at a target pressure, interpolated from an EOS scan (scan ordered by volume).
 */
export function densityAtPressure(scan, targetPressurePa) {
  const sorted = [...scan].sort((a, b) => a.pressurePa - b.pressurePa);
  if (targetPressurePa <= sorted[0].pressurePa) return sorted[0].densityKgPerM3;
  if (targetPressurePa >= sorted[sorted.length - 1].pressurePa) return sorted[sorted.length - 1].densityKgPerM3;
  for (let i = 1; i < sorted.length; i += 1) {
    if (targetPressurePa <= sorted[i].pressurePa) {
      const t = (targetPressurePa - sorted[i - 1].pressurePa) / (sorted[i].pressurePa - sorted[i - 1].pressurePa);
      return sorted[i - 1].densityKgPerM3 + t * (sorted[i].densityKgPerM3 - sorted[i - 1].densityKgPerM3);
    }
  }
  return sorted[sorted.length - 1].densityKgPerM3;
}

/**
 * Isothermal bulk modulus (Pa) B = −V (dP/dV) from two neighbouring EOS-scan points.
 */
export function bulkModulusPa(pointA, pointB) {
  const dP = pointB.pressurePa - pointA.pressurePa;
  const dV = pointB.volumeM3 - pointA.volumeM3;
  const vMid = 0.5 * (pointA.volumeM3 + pointB.volumeM3);
  return -vMid * (dP / dV);
}

/**
 * Phase/melting scan: heat a fixed-density system through a series of temperatures and record
 * potential energy + diffusion at each. The melting transition shows up as a jump in both
 * (the solid branch has near-zero diffusion; the liquid branch diffuses and sits higher in
 * energy). Material-agnostic — `makeSystem(temperatureK)` supplies the (same-density) start state.
 */
export function meltingScan({ makeSystem, temperaturesK, runParams }) {
  return temperaturesK.map((temperatureK) => {
    const sys = makeSystem(temperatureK);
    const samples = runMd(sys, { ...runParams, thermostatTempK: temperatureK });
    return {
      temperatureK,
      potentialEnergyJ: mean(samples.potentialEnergyJ),
      diffusionM2PerS: diffusionCoefficientM2PerS(samples)
    };
  });
}
