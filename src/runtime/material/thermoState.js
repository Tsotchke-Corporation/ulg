// Thermodynamic state conversion for material closures (demo plan P3).
//
// Operates on a material closure's `properties` (ordered phases + transitions). Each phase's
// internal energy uses either a constant heat capacity or, when the phase declares a Debye
// temperature, the first-principles Debye internal energy U(T) (so a monatomic solid like iron
// gets the correct temperature-dependent heat capacity instead of a constant). The inverse
// (energy -> state) lives in phaseEquilibrium.js.

import { debyeHeatCapacityJPerKgK, debyeInternalEnergyJPerKg } from './statisticalMechanics.js';

function phaseEnergyFromZero(seg, temperatureK) {
  if (seg.debyeTemperatureK) {
    return debyeInternalEnergyJPerKg(temperatureK, {
      debyeTemperatureK: seg.debyeTemperatureK,
      molarMassKgPerMol: seg.molarMassKgPerMol,
      atomsPerFormula: seg.atomsPerFormula
    });
  }
  return seg.cpJPerKgK * temperatureK;
}

// Energy added heating a phase segment from its lower bound up to temperature T.
export function segmentEnergyAbove(seg, temperatureK) {
  return phaseEnergyFromZero(seg, temperatureK) - phaseEnergyFromZero(seg, seg.tLo);
}

// Invert: temperature within a phase segment for a given energy above its lower bound.
export function segmentTemperatureFromEnergyAbove(seg, energyAbove) {
  if (!seg.debyeTemperatureK) {
    return seg.tLo + energyAbove / seg.cpJPerKgK;
  }
  let lo = seg.tLo;
  let hi = seg.tHi;
  for (let i = 0; i < 80; i += 1) {
    const mid = 0.5 * (lo + hi);
    if (segmentEnergyAbove(seg, mid) < energyAbove) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}

// orderedSegments is pure in `properties` (which is stable per material), but it evaluates the
// Debye internal energy at phase boundaries — expensive to rebuild on every energy/phase query.
// Memoize per properties object so it is built once per material.
const orderedSegmentsCache = new WeakMap();

export function orderedSegments(properties) {
  const cached = orderedSegmentsCache.get(properties);
  if (cached) return cached;
  const segments = buildOrderedSegments(properties);
  orderedSegmentsCache.set(properties, segments);
  return segments;
}

function buildOrderedSegments(properties) {
  const phases = properties.phases || [];
  const transitions = properties.transitions || [];
  const molarMassKgPerMol = properties.molarMassKgPerMol;
  const atomsPerFormula = properties.atomsPerFormula ?? 1;
  const segments = [];
  let cumulativeEnergy = 0;
  for (let i = 0; i < phases.length; i += 1) {
    const phase = phases[i];
    const tLo = phase.temperatureRange[0];
    const tHi = i < transitions.length ? transitions[i].temperatureK : phase.temperatureRange[1];
    const seg = {
      type: 'phase',
      phase: phase.name,
      tLo,
      tHi,
      cpJPerKgK: phase.cpJPerKgK,
      debyeTemperatureK: phase.debyeTemperatureK || null,
      molarMassKgPerMol,
      atomsPerFormula,
      eStart: cumulativeEnergy
    };
    cumulativeEnergy += segmentEnergyAbove(seg, tHi);
    seg.eEnd = cumulativeEnergy;
    segments.push(seg);
    if (i < transitions.length) {
      const transition = transitions[i];
      const eStartPlateau = cumulativeEnergy;
      cumulativeEnergy += transition.latentHeatJPerKg;
      segments.push({
        type: 'plateau',
        from: transition.from,
        to: transition.to,
        temperatureK: transition.temperatureK,
        latentHeatJPerKg: transition.latentHeatJPerKg,
        eStart: eStartPlateau,
        eEnd: cumulativeEnergy
      });
    }
  }
  return segments;
}

/**
 * Specific internal energy (J/kg) at temperature T, integrated along the phase path from 0 K
 * (constant-cp or Debye per phase) with latent heats. Only differences are physically
 * meaningful. At an exact transition temperature this returns the start-of-plateau energy.
 */
export function specificInternalEnergyJPerKg(properties, temperatureK) {
  const t = Number(temperatureK);
  if (!Number.isFinite(t)) throw new TypeError('temperatureK must be finite');
  const segments = orderedSegments(properties);
  for (const segment of segments) {
    if (segment.type === 'phase' && t <= segment.tHi) {
      const clampedLo = Math.max(t, segment.tLo);
      return segment.eStart + segmentEnergyAbove(segment, clampedLo);
    }
  }
  const last = segments[segments.length - 1];
  if (last.type === 'phase') {
    return last.eStart + segmentEnergyAbove(last, t);
  }
  return last.eEnd;
}

/**
 * Effective heat capacity (J/(kg K)) of the phase that contains T (Debye-derived where the phase
 * declares a Debye temperature, constant otherwise).
 */
export function heatCapacityJPerKgK(properties, temperatureK) {
  const t = Number(temperatureK);
  const segments = orderedSegments(properties);
  for (const segment of segments) {
    if (segment.type === 'phase' && t <= segment.tHi) {
      if (segment.debyeTemperatureK) {
        return debyeHeatCapacityJPerKgK(t, {
          debyeTemperatureK: segment.debyeTemperatureK,
          molarMassKgPerMol: segment.molarMassKgPerMol,
          atomsPerFormula: segment.atomsPerFormula
        });
      }
      return segment.cpJPerKgK;
    }
  }
  const last = segments.filter((s) => s.type === 'phase').at(-1);
  return last ? last.cpJPerKgK : null;
}
