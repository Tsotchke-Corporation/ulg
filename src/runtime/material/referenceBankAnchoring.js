// Reference-bank anchoring for derived material properties.
//
// The generic first-principles derivation produces phase boundaries with large
// model error (audited 2026-07-04: h2o boiling -12%, Al melting +211%, Al2O3
// melting -86%). Per plan/todo/algorithm-derived-material-properties-plan.md,
// precomputed JSON bank records may seed derivation as long as every anchored
// row carries `reference-fallback` provenance and strict mode can rerun the
// pure lower-closure path. This module replaces phase-transition boundaries,
// latent heats, and (when the bank provides them) per-phase densities and heat
// capacities with bank reference values, records the derived values as
// residual diagnostics, and stamps the provenance accordingly.
import compoundMaterialPropertyBank from '../../../data/material-properties/compounds.json' with { type: 'json' };
import { DEFAULT_MATERIAL_PROPERTY_BANK } from './defaultMaterialPropertyBank.js';
import {
  PROPERTY_DERIVATION_STATUS,
  propertyProvenanceEntry
} from './propertyProvenance.js';

const REFERENCE_ANCHOR_SOURCE = 'crc-standard-reference-data';

function bankTransitionsUsable(record) {
  return Array.isArray(record?.transitions)
    && record.transitions.length > 0
    && (record.provenance || []).some((entry) => entry?.source === REFERENCE_ANCHOR_SOURCE);
}

function compoundRecordFor(materialKey) {
  const key = String(materialKey || '').toLowerCase();
  return (compoundMaterialPropertyBank.records || []).find((record) => (
    record.key === key || String(record.formula || '').toLowerCase() === key
  )) || null;
}

function elementRecordFor(materialKey) {
  const raw = String(materialKey || '');
  const symbol = raw ? raw[0].toUpperCase() + raw.slice(1).toLowerCase() : '';
  return (DEFAULT_MATERIAL_PROPERTY_BANK.records || []).find((record) => record.symbol === symbol) || null;
}

export function referenceBankRecordForMaterial(materialKey) {
  const compound = compoundRecordFor(materialKey);
  if (compound && bankTransitionsUsable(compound)) return { record: compound, bank: 'compounds' };
  const element = elementRecordFor(materialKey);
  if (element && bankTransitionsUsable(element)) return { record: element, bank: 'elements' };
  return null;
}

function transitionByName(record, name) {
  return (record.transitions || []).find((transition) => transition.name === name) || null;
}

function bankPhase(record, name) {
  return (record.phases || []).find((phase) => phase.name === name) || null;
}

/**
 * Anchor derived properties with bank reference boundaries. Returns
 * { properties, anchored, residuals, anchoredPaths }; when no usable bank
 * record exists the input properties pass through unchanged (anchored: false).
 */
export function anchorDerivedMaterialProperties(properties, materialKey) {
  const found = referenceBankRecordForMaterial(materialKey);
  if (!found || !properties?.phases?.length) {
    return { properties, anchored: false, residuals: null, anchoredPaths: [] };
  }
  const { record, bank } = found;
  const melting = transitionByName(record, 'melting');
  const boiling = transitionByName(record, 'boiling');
  if (!melting && !boiling) {
    return { properties, anchored: false, residuals: null, anchoredPaths: [] };
  }

  const residuals = {};
  const anchoredPaths = [];
  const phases = properties.phases.map((phase) => ({ ...phase }));
  const transitions = (properties.transitions || []).map((transition) => ({ ...transition }));

  const anchorTransition = (fromPhase, toPhase, bankTransition, label) => {
    if (!bankTransition) return;
    const target = transitions.find((transition) => transition.from === fromPhase && transition.to === toPhase);
    if (!target) return;
    residuals[label] = {
      derivedTemperatureK: target.temperatureK,
      referenceTemperatureK: bankTransition.temperatureK,
      derivedLatentHeatJPerKg: target.latentHeatJPerKg,
      referenceLatentHeatJPerKg: bankTransition.latentHeatJPerKg
    };
    target.temperatureK = bankTransition.temperatureK;
    target.latentHeatJPerKg = bankTransition.latentHeatJPerKg;
    anchoredPaths.push(
      `transitions.${fromPhase}->${toPhase}.temperatureK`,
      `transitions.${fromPhase}->${toPhase}.latentHeatJPerKg`
    );
  };
  anchorTransition('solid', 'liquid', melting, 'melting');
  anchorTransition('liquid', 'gas', boiling, 'boiling');

  // Element derivations often stop at the liquid phase; when the bank knows a
  // boiling point, synthesize the missing gas transition and an ideal-gas
  // phase row so those materials can vaporize instead of superheating forever.
  const hasGasTransition = transitions.some((transition) => transition.from === 'liquid' && transition.to === 'gas');
  if (boiling && !hasGasTransition && phases.some((phase) => phase.name === 'liquid')) {
    transitions.push({
      from: 'liquid',
      to: 'gas',
      temperatureK: boiling.temperatureK,
      latentHeatJPerKg: boiling.latentHeatJPerKg
    });
    anchoredPaths.push('transitions.liquid->gas.temperatureK', 'transitions.liquid->gas.latentHeatJPerKg');
    residuals.boiling = {
      derivedTemperatureK: null,
      referenceTemperatureK: boiling.temperatureK,
      derivedLatentHeatJPerKg: null,
      referenceLatentHeatJPerKg: boiling.latentHeatJPerKg
    };
    const liquid = phases.find((phase) => phase.name === 'liquid');
    if (Array.isArray(liquid?.temperatureRange)) liquid.temperatureRange = [liquid.temperatureRange[0], boiling.temperatureK];
    if (!phases.some((phase) => phase.name === 'gas')) {
      const molarMassKgPerMol = Number(properties.molarMassKgPerMol) || 0;
      const gasDensity = molarMassKgPerMol > 0
        ? (101325 * molarMassKgPerMol) / (8.314462618 * boiling.temperatureK)
        : 0.5;
      const gasCp = molarMassKgPerMol > 0
        ? (2.5 * 8.314462618 + 8.314462618) / molarMassKgPerMol
        : 1000;
      phases.push({
        name: 'gas',
        cpJPerKgK: gasCp,
        densityKgPerM3: gasDensity,
        temperatureRange: [boiling.temperatureK, 1000000],
        bulkModulusPa: null,
        shearModulusPa: 0
      });
      anchoredPaths.push('phases.gas.temperatureRange', 'phases.gas.densityKgPerM3', 'phases.gas.cpJPerKgK', 'phases.gas.bulkModulusPa', 'phases.gas.shearModulusPa');
    }
  }

  for (const phase of phases) {
    const range = Array.isArray(phase.temperatureRange) ? [...phase.temperatureRange] : null;
    if (range) {
      if (phase.name === 'solid' && melting) range[1] = melting.temperatureK;
      if (phase.name === 'liquid') {
        if (melting) range[0] = melting.temperatureK;
        if (boiling) range[1] = boiling.temperatureK;
      }
      if (phase.name === 'gas' && boiling) range[0] = boiling.temperatureK;
      phase.temperatureRange = range;
      anchoredPaths.push(`phases.${phase.name}.temperatureRange`);
    }
    const reference = bankPhase(record, phase.name);
    if (reference) {
      if (Number.isFinite(reference.densityKgPerM3) && reference.densityKgPerM3 > 0) {
        residuals[`${phase.name}Density`] = {
          derivedDensityKgPerM3: phase.densityKgPerM3,
          referenceDensityKgPerM3: reference.densityKgPerM3
        };
        phase.densityKgPerM3 = reference.densityKgPerM3;
        anchoredPaths.push(`phases.${phase.name}.densityKgPerM3`);
      }
      const referenceCp = reference.heatCapacityJPerKgK ?? reference.cpJPerKgK;
      if (Number.isFinite(referenceCp) && referenceCp > 0) {
        residuals[`${phase.name}Cp`] = {
          derivedCpJPerKgK: phase.cpJPerKgK,
          referenceCpJPerKgK: referenceCp
        };
        phase.cpJPerKgK = referenceCp;
        anchoredPaths.push(`phases.${phase.name}.cpJPerKgK`);
      }
    }
  }

  const anchored = {
    ...properties,
    phases,
    transitions,
    referenceBankAnchoring: {
      schema: 'peercompute.ulg.material-reference-bank-anchoring.v0',
      bank,
      recordSchema: record.schema,
      source: REFERENCE_ANCHOR_SOURCE,
      derivationResiduals: residuals
    },
    propertyProvenance: {
      ...(properties.propertyProvenance || {}),
      entries: [
        ...(properties.propertyProvenance?.entries || []),
        propertyProvenanceEntry({
          paths: anchoredPaths,
          status: PROPERTY_DERIVATION_STATUS.REFERENCE_FALLBACK,
          source: 'material-property-reference-bank',
          method: `bank reference anchoring (${bank}); derived values retained as derivationResiduals`,
          inputs: [record.key || record.symbol || String(materialKey)]
        })
      ],
      notes: [
        ...(properties.propertyProvenance?.notes || []),
        `Phase boundaries anchored to ${bank} reference bank; derivation residuals recorded.`
      ]
    }
  };
  return { properties: anchored, anchored: true, residuals, anchoredPaths };
}
