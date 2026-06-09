// MaterialRegistry: resolve material properties through ClosureRegistry (demo plan P2/P3).
//
// All material sampling goes through ClosureRegistry, so a sample whose (temperature, pressure)
// leaves a closure's validity domain produces the existing closure-refresh/invalidation
// evidence rather than a silent extrapolation. Property values come from the material closure's
// data via the P3 thermodynamic core. Nothing here is validated physics: closures are
// reference-fixture-backed until MoonLab/Eshkol microphysics references exist.

import { createClosureDomainExitRefreshRequest } from '../fieldClosureSamples.js';
import { idealGasDensityKgPerM3 } from '../materials/referenceMaterials.js';
import { heatCapacityJPerKgK, specificInternalEnergyJPerKg } from './thermoState.js';
import { stablePhaseAt } from './phaseEquilibrium.js';

function phaseRecordAt(properties, temperatureK) {
  const t = Number(temperatureK);
  const phases = properties.phases || [];
  const transitions = properties.transitions || [];
  for (let i = 0; i < phases.length; i += 1) {
    const tHi = i < transitions.length ? transitions[i].temperatureK : phases[i].temperatureRange[1];
    if (t <= tHi) return phases[i];
  }
  return phases[phases.length - 1] || null;
}

function evaluateProperty(closure, property, temperatureK, pressurePa) {
  const properties = closure.properties || {};
  switch (property) {
    case 'specificInternalEnergy':
      return specificInternalEnergyJPerKg(properties, temperatureK);
    case 'heatCapacity':
      return heatCapacityJPerKgK(properties, temperatureK);
    case 'phase':
      return stablePhaseAt(properties, temperatureK);
    case 'molarMass':
      return properties.molarMassKgPerMol ?? null;
    case 'density': {
      if (properties.idealGas) {
        if (!Number.isFinite(Number(pressurePa))) {
          throw new Error(`density of ${closure.material} requires pressurePa (ideal gas)`);
        }
        return idealGasDensityKgPerM3({ pressurePa, temperatureK, molarMassKgPerMol: properties.molarMassKgPerMol });
      }
      return phaseRecordAt(properties, temperatureK)?.densityKgPerM3 ?? null;
    }
    default:
      throw new Error(`Unknown material property: ${property}`);
  }
}

export class MaterialRegistry {
  constructor({ closureRegistry } = {}) {
    if (!closureRegistry) throw new Error('MaterialRegistry requires a closureRegistry');
    this.closureRegistry = closureRegistry;
    this.entries = new Map();
  }

  #key(material, closureFamily) {
    return `${material}:${closureFamily}`;
  }

  async register(closure) {
    if (!closure?.material || !closure?.closureFamily) {
      throw new Error('material closure must carry material and closureFamily');
    }
    const ref = await this.closureRegistry.store(closure);
    this.entries.set(this.#key(closure.material, closure.closureFamily), { ref, closure });
    return ref;
  }

  async registerAll(closures) {
    const refs = {};
    for (const [name, closure] of Object.entries(closures)) {
      refs[name] = await this.register(closure);
    }
    return refs;
  }

  getClosure(material, closureFamily = 'material') {
    return this.entries.get(this.#key(material, closureFamily))?.closure || null;
  }

  /**
   * Sample a material property, gated by the closure's validity domain. A point outside the
   * domain returns `status: 'out-of-domain'` with a closure-refresh request (the same contract
   * the carrier domain-exit path emits) instead of an extrapolated value.
   */
  async sampleProperty({ material, closureFamily = 'material', property, temperatureK, pressurePa = null }) {
    const entry = this.entries.get(this.#key(material, closureFamily));
    if (!entry) {
      return { status: 'miss', reason: 'material-closure-not-registered', material, property, value: null };
    }
    const closure = entry.closure;
    const point = { temperatureK };
    if (pressurePa != null) point.pressurePa = pressurePa;
    const resolved = await this.closureRegistry.resolve({
      closureKind: closure.closureKind,
      inputHash: closure.inputHash,
      methodHash: closure.methodHash,
      point
    });
    if (resolved.validity !== 'in-range') {
      const domain = Array.isArray(closure.validity?.temperatureK) ? closure.validity.temperatureK : null;
      return {
        status: 'out-of-domain',
        material,
        property,
        validity: resolved.validity,
        value: null,
        refreshRequest: createClosureDomainExitRefreshRequest({
          closureId: closure.closureId,
          closureKind: closure.closureKind,
          axisName: 'temperatureK',
          inputValue: temperatureK,
          domain,
          reason: 'material-state-outside-closure-domain'
        })
      };
    }
    return {
      status: 'sampled',
      material,
      property,
      value: evaluateProperty(closure, property, temperatureK, pressurePa),
      phase: stablePhaseAt(closure.properties || {}, temperatureK),
      units: closure.units?.[property] || null,
      closureRef: entry.ref,
      validity: 'in-range',
      scientificValidation: false,
      materialValidation: false
    };
  }
}
