// Phase equilibrium for material closures (demo plan P3).
//
// Two solvers over a closure's `properties` (ordered phases + transitions):
//  - stablePhaseAt(properties, T): which phase is stable at a temperature.
//  - equilibriumFromSpecificEnergy(properties, e): the temperature + phase fractions for a given
//    specific internal energy, using the lever rule across latent plateaus. This is the map the
//    SPH carrier (P4) needs to turn a particle's energy into its phase state.

import { orderedSegments } from './thermoState.js';

/**
 * The phase stable at temperature T. At an exact transition temperature the lower (not-yet-
 * converted) phase is reported, matching the forward energy convention.
 */
export function stablePhaseAt(properties, temperatureK) {
  const t = Number(temperatureK);
  const phases = properties.phases || [];
  const transitions = properties.transitions || [];
  for (let i = 0; i < phases.length; i += 1) {
    const tHi = i < transitions.length ? transitions[i].temperatureK : phases[i].temperatureRange[1];
    if (t <= tHi) return phases[i].name;
  }
  return phases[phases.length - 1]?.name ?? null;
}

/**
 * Invert specific internal energy to a thermodynamic state: temperature, the stable (dominant)
 * phase, and phase fractions. On a latent plateau the temperature is the transition temperature
 * and the fractions follow the lever rule; within a phase the state is pure.
 */
export function equilibriumFromSpecificEnergy(properties, specificEnergyJPerKg) {
  const e = Number(specificEnergyJPerKg);
  if (!Number.isFinite(e)) throw new TypeError('specificEnergyJPerKg must be finite');
  const segments = orderedSegments(properties);
  const minEnergy = segments[0].eStart;
  const maxEnergy = segments[segments.length - 1].eEnd;
  if (e <= minEnergy) {
    const first = segments[0];
    return { temperatureK: first.tLo, stablePhase: first.phase, phaseFractions: { [first.phase]: 1 }, clamped: e < minEnergy ? 'low' : null };
  }
  if (e >= maxEnergy) {
    const last = segments[segments.length - 1];
    if (last.type === 'phase') {
      const temperatureK = last.tLo + (e - last.eStart) / last.cpJPerKgK;
      return { temperatureK, stablePhase: last.phase, phaseFractions: { [last.phase]: 1 }, clamped: e > maxEnergy ? 'high' : null };
    }
    return { temperatureK: last.temperatureK, stablePhase: last.to, phaseFractions: { [last.to]: 1 }, clamped: e > maxEnergy ? 'high' : null };
  }
  for (const segment of segments) {
    if (e < segment.eStart || e > segment.eEnd) continue;
    if (segment.type === 'phase') {
      const temperatureK = segment.tLo + (e - segment.eStart) / segment.cpJPerKgK;
      return { temperatureK, stablePhase: segment.phase, phaseFractions: { [segment.phase]: 1 }, clamped: null };
    }
    const toFraction = segment.latentHeatJPerKg > 0
      ? (e - segment.eStart) / segment.latentHeatJPerKg
      : 0;
    const fromFraction = 1 - toFraction;
    return {
      temperatureK: segment.temperatureK,
      stablePhase: toFraction >= 0.5 ? segment.to : segment.from,
      phaseFractions: { [segment.from]: fromFraction, [segment.to]: toFraction },
      clamped: null
    };
  }
  // Unreachable for monotonic segments, but stay defensive.
  const last = segments[segments.length - 1];
  return { temperatureK: last.type === 'phase' ? last.tHi : last.temperatureK, stablePhase: null, phaseFractions: {}, clamped: null };
}
