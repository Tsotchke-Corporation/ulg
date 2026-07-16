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
import molecularElectronicBandsBank from '../../../data/material-properties/molecular-electronic-bands.json' with { type: 'json' };
import {
  CONDUCTOR_OPTICAL_CONSTANTS_BANK,
  conductorOpticalConstantsRecord
} from './conductorOpticalConstants.js';
import { DEFAULT_MATERIAL_PROPERTY_BANK } from './defaultMaterialPropertyBank.js';
import { referenceConductorColorSrgb } from './opticalClosure.js';
import {
  PROPERTY_DERIVATION_STATUS,
  propertyProvenanceEntry
} from './propertyProvenance.js';

// Cache fingerprints must include the bank payload, not only the anchoring
// function source.  Export the immutable input object so browser closure
// caches are invalidated when a measured molecular spectrum changes.
export const MOLECULAR_ELECTRONIC_BANDS_BANK = molecularElectronicBandsBank;

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

// Spectroscopic gas-phase electronic absorption bands (visible/near-UV continua):
// band centre (absorption maximum), FWHM, and integrated oscillator strength.
// These anchor the ΔSCF-derived band centre because minimal-basis ΔSCF overshoots
// σ* band centres by several eV (F2: 8.4 eV derived vs 4.34 eV observed) and the
// Gaussian tail into the visible is exponentially sensitive to the centre. Same
// admitted-fallback tier as the CRC transition anchors; the pure ΔSCF path stays
// available via options.deriveGasElectronicExcitation in materialDerivation.
const MOLECULAR_ELECTRONIC_BANDS_BY_FORMULA = new Map(
  (molecularElectronicBandsBank?.records || [])
    .filter((record) => record?.formula && record.bandCenterEv > 0)
    .map((record) => [record.formula, record])
);

function anchorGasElectronicBand(properties, materialKey) {
  const formula = properties?.formula;
  const record = formula ? MOLECULAR_ELECTRONIC_BANDS_BY_FORMULA.get(formula) : null;
  const hasGasPhase = (properties?.phases || []).some((phase) => phase?.name === 'gas');
  if (!record || !hasGasPhase) {
    return { properties, anchored: false, residuals: null, anchoredPaths: [] };
  }
  const residuals = {
    gasElectronicBand: {
      derivedExcitationEv: properties.gasElectronicExcitationEv ?? null,
      referenceBandCenterEv: record.bandCenterEv
    }
  };
  const anchoredPaths = [
    'gasElectronicExcitationEv',
    'gasElectronicBandFwhmEv',
    'gasElectronicOscillatorStrength'
  ];
  const absorptionCrossSection = record.absorptionCrossSection
    ? {
        ...record.absorptionCrossSection,
        wavelengthNm: [...(record.absorptionCrossSection.wavelengthNm || [])],
        crossSectionM2: [...(record.absorptionCrossSection.crossSectionM2 || [])]
      }
    : null;
  if (absorptionCrossSection) anchoredPaths.push('gasElectronicAbsorptionCrossSection');
  const anchored = {
    ...properties,
    gasElectronicExcitationEv: record.bandCenterEv,
    gasElectronicBandFwhmEv: record.bandFwhmEv ?? null,
    gasElectronicOscillatorStrength: record.oscillatorStrength ?? null,
    ...(absorptionCrossSection
      ? { gasElectronicAbsorptionCrossSection: absorptionCrossSection }
      : {}),
    referenceBankAnchoring: {
      schema: 'peercompute.ulg.material-reference-bank-anchoring.v0',
      bank: properties.referenceBankAnchoring?.bank ?? 'molecular-electronic-bands',
      recordSchema: properties.referenceBankAnchoring?.recordSchema ?? molecularElectronicBandsBank.schema,
      source: properties.referenceBankAnchoring?.source ?? molecularElectronicBandsBank.source,
      derivationResiduals: {
        ...(properties.referenceBankAnchoring?.derivationResiduals || {}),
        ...residuals
      }
    },
    propertyProvenance: {
      ...(properties.propertyProvenance || {}),
      entries: [
        ...(properties.propertyProvenance?.entries || []),
        propertyProvenanceEntry({
          paths: anchoredPaths,
          status: PROPERTY_DERIVATION_STATUS.REFERENCE_FALLBACK,
          source: 'material-property-reference-bank',
          method: absorptionCrossSection
            ? 'gas-phase band centre plus measured wavelength-resolved absorption cross section; derived ΔSCF/Gaussian values retained as fallbacks and derivationResiduals'
            : 'gas-phase electronic band centre/FWHM/oscillator strength anchored to spectroscopic absorption maxima; derived ΔSCF value retained as derivationResiduals',
          inputs: absorptionCrossSection
            ? [record.formula, absorptionCrossSection.doi]
            : [record.formula]
        })
      ],
      notes: [
        ...(properties.propertyProvenance?.notes || []),
        `Gas electronic band anchored to spectroscopic reference (${record.formula}); derivation residuals recorded.`
      ]
    }
  };
  return { properties: anchored, anchored: true, residuals, anchoredPaths };
}

function anchorConductorOpticalConstants(properties, materialKey) {
  const record = conductorOpticalConstantsRecord(materialKey);
  const referenceColor = record ? referenceConductorColorSrgb(record.symbol) : null;
  if (!record || !referenceColor) {
    return { properties, anchored: false, residuals: null, anchoredPaths: [] };
  }
  const energies = CONDUCTOR_OPTICAL_CONSTANTS_BANK.photonEnergyEv || [];
  const marker = {
    schema: CONDUCTOR_OPTICAL_CONSTANTS_BANK.schema,
    bankVersion: CONDUCTOR_OPTICAL_CONSTANTS_BANK.bankVersion,
    symbol: record.symbol,
    source: CONDUCTOR_OPTICAL_CONSTANTS_BANK.source,
    doi: CONDUCTOR_OPTICAL_CONSTANTS_BANK.doi,
    referencePhase: CONDUCTOR_OPTICAL_CONSTANTS_BANK.referenceState?.phase ?? 'solid',
    energyRangeEv: energies.length > 0 ? [energies[0], energies.at(-1)] : null,
    applicationPolicy: 'measured-solid-spectrum-with-labelled-nearest-condensed-phase-extrapolation'
  };
  const anchoredColor = [referenceColor.r, referenceColor.g, referenceColor.b];
  const residuals = {
    conductorOpticalConstants: {
      derivedIntrinsicColorSrgb: properties?.intrinsicColorSrgb ?? null,
      referenceComplexIndexColorSrgb: anchoredColor,
      recordSymbol: record.symbol,
      bankVersion: CONDUCTOR_OPTICAL_CONSTANTS_BANK.bankVersion
    }
  };
  const anchoredPaths = ['conductorOpticalConstants', 'intrinsicColorSrgb'];
  const referenceDataset = {
    bank: 'conductor-optical-constants',
    schema: CONDUCTOR_OPTICAL_CONSTANTS_BANK.schema,
    bankVersion: CONDUCTOR_OPTICAL_CONSTANTS_BANK.bankVersion,
    symbol: record.symbol,
    source: CONDUCTOR_OPTICAL_CONSTANTS_BANK.source,
    doi: CONDUCTOR_OPTICAL_CONSTANTS_BANK.doi
  };
  const anchored = {
    ...properties,
    conductorOpticalConstants: marker,
    intrinsicColorSrgb: anchoredColor,
    referenceBankAnchoring: {
      schema: 'peercompute.ulg.material-reference-bank-anchoring.v0',
      bank: properties.referenceBankAnchoring?.bank ?? 'conductor-optical-constants',
      recordSchema: properties.referenceBankAnchoring?.recordSchema ?? CONDUCTOR_OPTICAL_CONSTANTS_BANK.schema,
      source: properties.referenceBankAnchoring?.source ?? CONDUCTOR_OPTICAL_CONSTANTS_BANK.source,
      referenceDatasets: [
        ...(properties.referenceBankAnchoring?.referenceDatasets || []),
        referenceDataset
      ],
      derivationResiduals: {
        ...(properties.referenceBankAnchoring?.derivationResiduals || {}),
        ...residuals
      }
    },
    propertyProvenance: {
      ...(properties.propertyProvenance || {}),
      entries: [
        ...(properties.propertyProvenance?.entries || []),
        propertyProvenanceEntry({
          paths: anchoredPaths,
          status: PROPERTY_DERIVATION_STATUS.REFERENCE_FALLBACK,
          source: 'material-property-reference-bank',
          method: 'measured complex refractive index n,k anchors conductor optics; lower-level Drude-Lorentz color retained as derivationResiduals',
          inputs: [record.symbol, CONDUCTOR_OPTICAL_CONSTANTS_BANK.bankVersion, CONDUCTOR_OPTICAL_CONSTANTS_BANK.doi]
        })
      ],
      notes: [
        ...(properties.propertyProvenance?.notes || []),
        `Conductor optical constants anchored to ${CONDUCTOR_OPTICAL_CONSTANTS_BANK.doi} (${record.symbol}); derived color retained as a residual.`
      ]
    }
  };
  return { properties: anchored, anchored: true, residuals, anchoredPaths };
}

/**
 * Anchor derived properties with bank reference boundaries and spectroscopic
 * gas electronic bands. Returns { properties, anchored, residuals,
 * anchoredPaths }; when no usable bank record exists the input properties pass
 * through unchanged (anchored: false).
 */
export function anchorDerivedMaterialProperties(properties, materialKey) {
  const phaseAnchoring = anchorDerivedPhaseBoundaries(properties, materialKey);
  const bandAnchoring = anchorGasElectronicBand(phaseAnchoring.properties, materialKey);
  const opticalAnchoring = anchorConductorOpticalConstants(bandAnchoring.properties, materialKey);
  const applied = [phaseAnchoring, bandAnchoring, opticalAnchoring].filter((result) => result.anchored);
  if (applied.length === 0) {
    return { properties, anchored: false, residuals: null, anchoredPaths: [] };
  }
  return {
    properties: opticalAnchoring.properties,
    anchored: true,
    residuals: Object.assign({}, ...applied.map((result) => result.residuals || {})),
    anchoredPaths: applied.flatMap((result) => result.anchoredPaths || [])
  };
}

function anchorDerivedPhaseBoundaries(properties, materialKey) {
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
