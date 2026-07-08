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

const R_GAS = 8.314462618;
const CM1_TO_K = 1.4387768766;
// Piecewise-linearization cap for vibrational gas segments: past this the
// Einstein terms are essentially classical and a single constant-cp tail
// segment is exact to well under 1%.
const GAS_VIBRATION_SUBDIVISION_CAP_K = 4000;
const GAS_VIBRATION_SUBDIVISION_COUNT = 12;

// Exact vibrational-gas specific internal energy (J/kg) at temperature T:
// rigid-rotor (translation + rotation + R) linear term plus the Einstein
// enthalpy of each banked harmonic mode. Derived, not tabulated.
function vibrationalGasEnergyFromZero(rigidRotorCpJPerKgK, thetaK, molarMassKgPerMol, temperatureK) {
  let vibrational = 0;
  for (const theta of thetaK) {
    const ratio = theta / Math.max(temperatureK, 1e-9);
    if (ratio < 60) vibrational += theta / (Math.exp(ratio) - 1);
  }
  return rigidRotorCpJPerKgK * temperatureK + (R_GAS * vibrational) / molarMassKgPerMol;
}

// Subdivide a vibrational gas phase into constant-cp sub-segments whose
// breakpoints sit EXACTLY on the Einstein enthalpy curve. Both the CPU
// inversion here and the GPU thermal segment table (which uploads
// eStart/eEnd/tLo/tHi verbatim and inverts linearly) get temperature-
// dependent gas heat capacity with no new segment semantics.
function vibrationalGasSubSegments(phase, tLo, tHi, molarMassKgPerMol, eStartBase) {
  const thetaK = phase.gasVibrationsCm1.map((nu) => nu * CM1_TO_K);
  const rigidRotor = phase.gasRigidRotorCpJPerKgK;
  const energyAt = (t) => vibrationalGasEnergyFromZero(rigidRotor, thetaK, molarMassKgPerMol, t);
  const capT = Math.min(tHi, Math.max(tLo + 1, GAS_VIBRATION_SUBDIVISION_CAP_K));
  const breakpoints = [tLo];
  for (let i = 1; i <= GAS_VIBRATION_SUBDIVISION_COUNT; i += 1) {
    breakpoints.push(tLo + ((capT - tLo) * i) / GAS_VIBRATION_SUBDIVISION_COUNT);
  }
  if (tHi > capT) breakpoints.push(tHi);
  const segments = [];
  let cumulative = eStartBase;
  for (let i = 0; i < breakpoints.length - 1; i += 1) {
    const a = breakpoints[i];
    const b = breakpoints[i + 1];
    const du = energyAt(b) - energyAt(a);
    const seg = {
      type: 'phase',
      phase: phase.name,
      tLo: a,
      tHi: b,
      cpJPerKgK: du / (b - a),
      debyeTemperatureK: null,
      molarMassKgPerMol,
      atomsPerFormula: 1,
      gasVibrationalSubSegment: true,
      eStart: cumulative
    };
    cumulative += du;
    seg.eEnd = cumulative;
    segments.push(seg);
  }
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
    const vibrationalGas = phase.name === 'gas'
      && Array.isArray(phase.gasVibrationsCm1)
      && phase.gasVibrationsCm1.length > 0
      && Number.isFinite(phase.gasRigidRotorCpJPerKgK)
      && phase.gasRigidRotorCpJPerKgK > 0
      && Number.isFinite(molarMassKgPerMol)
      && molarMassKgPerMol > 0;
    if (vibrationalGas) {
      const subSegments = vibrationalGasSubSegments(phase, tLo, tHi, molarMassKgPerMol, cumulativeEnergy);
      segments.push(...subSegments);
      cumulativeEnergy = subSegments[subSegments.length - 1].eEnd;
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
      continue;
    }
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
