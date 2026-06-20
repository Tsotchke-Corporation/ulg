// MaterialRegistry: resolve material properties through ClosureRegistry (demo plan P2/P3).
//
// All material sampling goes through ClosureRegistry, so a sample whose (temperature, pressure)
// leaves a closure's validity domain produces the existing closure-refresh/invalidation
// evidence rather than a silent extrapolation. Property values come from the material closure's
// data via the P3 thermodynamic core. Nothing here is validated physics: strict registries require
// first-principles provenance, while explicit fixture registries may still load reference closures
// for regression baselines.

import { createClosureDomainExitRefreshRequest } from '../fieldClosureSamples.js';
import { idealGasDensityKgPerM3 } from '../materials/referenceMaterials.js';
import { heatCapacityJPerKgK, specificInternalEnergyJPerKg } from './thermoState.js';
import { stablePhaseAt } from './phaseEquilibrium.js';
import { densityAtTemperature } from './gruneisenEos.js';
import {
  materialDerivationSummary,
  provenanceEntriesForPath,
  requireFirstPrinciplesMaterialProperties
} from './propertyProvenance.js';
import {
  materialPropertyBankRecordBySymbol,
  materialPropertyBankWarmInput,
  normalizeMaterialPropertyBank
} from './materialPropertyBank.js';

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

function evaluatedPropertyPath(closure, property, temperatureK) {
  const properties = closure.properties || {};
  const phase = phaseRecordAt(properties, temperatureK);
  switch (property) {
    case 'specificInternalEnergy':
      return 'specificInternalEnergy';
    case 'heatCapacity':
      return phase?.debyeTemperatureK ? `phases.${phase.name}.debyeTemperatureK` : `phases.${phase?.name}.cpJPerKgK`;
    case 'phase':
      return 'phase';
    case 'molarMass':
      return 'molarMassKgPerMol';
    case 'density':
      if (properties.idealGas) return 'idealGas';
      if (phase?.eos) return `phases.${phase.name}.eos.referenceDensityKgPerM3`;
      return `phases.${phase?.name}.densityKgPerM3`;
    default:
      return null;
  }
}

function sampleProvenance(closure, property, temperatureK) {
  const properties = closure.properties || {};
  const directPath = evaluatedPropertyPath(closure, property, temperatureK);
  const direct = directPath ? provenanceEntriesForPath(properties, directPath) : [];
  const supportPaths = [];
  if (property === 'specificInternalEnergy') {
    const phase = phaseRecordAt(properties, temperatureK);
    if (phase) {
      supportPaths.push(
        phase.debyeTemperatureK ? `phases.${phase.name}.debyeTemperatureK` : `phases.${phase.name}.cpJPerKgK`,
        `phases.${phase.name}.temperatureRange`
      );
    }
    for (const transition of properties.transitions || []) {
      if (temperatureK > transition.temperatureK) {
        supportPaths.push(`transitions.${transition.from}->${transition.to}.temperatureK`);
        supportPaths.push(`transitions.${transition.from}->${transition.to}.latentHeatJPerKg`);
      }
    }
  } else if (property === 'phase') {
    for (const phase of properties.phases || []) supportPaths.push(`phases.${phase.name}.temperatureRange`);
    for (const transition of properties.transitions || []) supportPaths.push(`transitions.${transition.from}->${transition.to}.temperatureK`);
  }
  const supporting = supportPaths.flatMap((path) => provenanceEntriesForPath(properties, path));
  const entries = [...direct, ...supporting].filter((entry, index, all) => all.indexOf(entry) === index);
  return {
    path: directPath,
    entries,
    derivationSummary: closure.materialDerivation || materialDerivationSummary(properties)
  };
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
      const record = phaseRecordAt(properties, temperatureK);
      if (record?.eos) {
        // Temperature-dependent density from the Grüneisen thermal EOS (thermal expansion),
        // using the phase's (Debye) heat capacity at T.
        return densityAtTemperature({
          referenceDensityKgPerM3: record.eos.referenceDensityKgPerM3,
          referenceTemperatureK: record.eos.referenceTemperatureK,
          temperatureK,
          gruneisen: record.eos.gruneisen,
          heatCapacityJPerKgK: heatCapacityJPerKgK(properties, temperatureK),
          bulkModulusPa: record.eos.bulkModulusPa
        });
      }
      return record?.densityKgPerM3 ?? null;
    }
    default:
      throw new Error(`Unknown material property: ${property}`);
  }
}

export class MaterialRegistry {
  constructor({ closureRegistry, requireFirstPrinciples = true, materialPropertyBank = null } = {}) {
    if (!closureRegistry) throw new Error('MaterialRegistry requires a closureRegistry');
    this.closureRegistry = closureRegistry;
    this.requireFirstPrinciples = requireFirstPrinciples;
    this.materialPropertyBank = materialPropertyBank ? normalizeMaterialPropertyBank(materialPropertyBank) : null;
    this.entries = new Map();
  }

  #key(material, closureFamily) {
    return `${material}:${closureFamily}`;
  }

  async register(closure) {
    if (!closure?.material || !closure?.closureFamily) {
      throw new Error('material closure must carry material and closureFamily');
    }
    if (this.requireFirstPrinciples) {
      requireFirstPrinciplesMaterialProperties(closure.properties || {}, {
        material: closure.material,
        context: 'MaterialRegistry.register'
      });
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

  getMaterialPropertyBankRecord(material) {
    if (!this.materialPropertyBank) return null;
    return materialPropertyBankRecordBySymbol(this.materialPropertyBank, material);
  }

  getMaterialPropertyBankWarmInput({ material, temperatureK, pressurePa } = {}) {
    const record = this.getMaterialPropertyBankRecord(material);
    if (!record) return null;
    return {
      ...materialPropertyBankWarmInput(record, {
        temperatureK,
        pressurePa,
        bankFamily: this.materialPropertyBank.bankFamily,
        bankSchemaVersion: this.materialPropertyBank.schemaVersion,
        generatorFingerprint: this.materialPropertyBank.generatorFingerprint
      }),
      requestedMaterial: material
    };
  }

  /**
   * Sample a material property, gated by the closure's validity domain. A point outside the
   * domain returns `status: 'out-of-domain'` with a closure-refresh request (the same contract
   * the carrier domain-exit path emits) instead of an extrapolated value.
   */
  async sampleProperty({ material, closureFamily = 'material', property, temperatureK, pressurePa = null, requireFirstPrinciples = this.requireFirstPrinciples }) {
    const entry = this.entries.get(this.#key(material, closureFamily));
    const bankWarmInput = this.getMaterialPropertyBankWarmInput({ material, temperatureK, pressurePa });
    if (!entry) {
      return {
        status: 'miss',
        reason: 'material-closure-not-registered',
        material,
        property,
        value: null,
        ...(bankWarmInput ? { materialPropertyBankWarmInput: bankWarmInput } : {})
      };
    }
    const closure = entry.closure;
    if (requireFirstPrinciples) {
      requireFirstPrinciplesMaterialProperties(closure.properties || {}, {
        material: closure.material,
        context: `MaterialRegistry.sampleProperty:${property}`
      });
    }
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
        ...(bankWarmInput ? { materialPropertyBankWarmInput: bankWarmInput } : {}),
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
      provenance: sampleProvenance(closure, property, temperatureK),
      ...(bankWarmInput ? { materialPropertyBankWarmInput: bankWarmInput } : {}),
      scientificValidation: false,
      materialValidation: false
    };
  }
}
