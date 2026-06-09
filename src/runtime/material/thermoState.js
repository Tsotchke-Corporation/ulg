// Thermodynamic state conversion for material closures (demo plan P3).
//
// Operates on a material closure's `properties` (ordered phases + transitions). Forward:
// specific internal energy and heat capacity at a temperature. The inverse (energy -> state)
// lives in phaseEquilibrium.js because energy maps to a temperature *and* phase fractions on the
// latent plateaus.

function orderedSegments(properties) {
  const phases = properties.phases || [];
  const transitions = properties.transitions || [];
  const segments = [];
  let cumulativeEnergy = 0;
  for (let i = 0; i < phases.length; i += 1) {
    const phase = phases[i];
    const tLo = phase.temperatureRange[0];
    const tHi = i < transitions.length ? transitions[i].temperatureK : phase.temperatureRange[1];
    const eStart = cumulativeEnergy;
    cumulativeEnergy += phase.cpJPerKgK * (tHi - tLo);
    segments.push({ type: 'phase', phase: phase.name, tLo, tHi, cpJPerKgK: phase.cpJPerKgK, eStart, eEnd: cumulativeEnergy });
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
 * with latent heats. Only differences are physically meaningful. At an exact transition
 * temperature this returns the start-of-plateau energy (phase not yet converted).
 */
export function specificInternalEnergyJPerKg(properties, temperatureK) {
  const t = Number(temperatureK);
  if (!Number.isFinite(t)) throw new TypeError('temperatureK must be finite');
  const segments = orderedSegments(properties);
  for (const segment of segments) {
    if (segment.type === 'phase' && t <= segment.tHi) {
      const clampedLo = Math.max(t, segment.tLo);
      return segment.eStart + segment.cpJPerKgK * (clampedLo - segment.tLo);
    }
  }
  const last = segments[segments.length - 1];
  if (last.type === 'phase') {
    return last.eStart + last.cpJPerKgK * (t - last.tLo);
  }
  return last.eEnd;
}

/**
 * Effective heat capacity (J/(kg*K)) of the phase that contains T.
 */
export function heatCapacityJPerKgK(properties, temperatureK) {
  const t = Number(temperatureK);
  const segments = orderedSegments(properties);
  for (const segment of segments) {
    if (segment.type === 'phase' && t <= segment.tHi) return segment.cpJPerKgK;
  }
  const last = segments.filter((s) => s.type === 'phase').at(-1);
  return last ? last.cpJPerKgK : null;
}

export { orderedSegments };
