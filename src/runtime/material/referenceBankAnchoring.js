// Reference-bank anchoring for derived material properties.
//
// The generic first-principles derivation produces phase boundaries with large
// model error (audited 2026-07-04: h2o boiling -12%, Al melting +211%, Al2O3
// melting -86%). Per plan/todo/algorithm-derived-material-properties-plan.md,
// precomputed JSON bank records may seed derivation as long as every anchored
// row carries `reference-fallback` provenance and strict mode can rerun the
// pure lower-closure path. This module replaces phase-transition boundaries,
// latent heats, and (when the bank provides them) per-phase densities, heat
// capacities, and thermal conductivities with bank reference values, records
// the derived values as residual diagnostics, and stamps the provenance
// accordingly.
import compoundMaterialPropertyBank from '../../../data/material-properties/compounds.json' with { type: 'json' };
import foundationPolytopeAtlasBank from '../../../data/material-properties/foundation-polytope-atlas.json' with { type: 'json' };
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
import { deriveDiluteGasTransportFromPairPotential } from '../md/pairPotential.js';

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

export function foundationPolytopeCompoundRecordFor(materialKey) {
  const key = String(materialKey || '').trim().toLowerCase();
  if (!key) return null;
  const match = (foundationPolytopeAtlasBank.compounds || []).find((c) => (
    String(c.materialKey || '').toLowerCase() === key
    || String(c.formula || '').toLowerCase() === key
  )) || (foundationPolytopeAtlasBank.elements || []).find((e) => (
    String(e.materialKey || '').toLowerCase() === key
    || String(e.formula || '').toLowerCase() === key
  )) || null;
  if (!match) return null;
  const tMelt = Number(match.thermodynamic?.meltingPointK ?? 300);
  const tBoil = Number(match.thermodynamic?.boilingPointK ?? 1000);
  const rho = Number(match.mechanical?.densityKgPerM3 ?? 1000);
  const cp = Number(match.thermodynamic?.heatCapacityCpJPerKgK ?? 1000);
  const k = Number(match.thermodynamic?.thermalConductivityWPerMK ?? 1.0);
  return Object.freeze({
    schema: 'ulg.foundation-polytope-compound-record.v1',
    key: String(match.materialKey).toLowerCase(),
    formula: match.formula || match.materialKey,
    accuracyTier: match.accuracyTier,
    closureHash: match.closureHash,
    phases: Object.freeze([
      Object.freeze({ name: 'solid', temperatureRangeK: [0, tMelt], densityKgPerM3: rho, heatCapacityJPerKgK: cp, thermalConductivityWPerMK: k }),
      Object.freeze({ name: 'liquid', temperatureRangeK: [tMelt, tBoil], densityKgPerM3: rho * 0.92, heatCapacityJPerKgK: cp * 1.15, thermalConductivityWPerMK: k * 0.6 }),
      Object.freeze({ name: 'gas', temperatureRangeK: [tBoil, 1e6], densityKgPerM3: Math.max(0.08, (match.nuclear?.molarMassU || 28) * 0.04), heatCapacityJPerKgK: cp * 0.9, thermalConductivityWPerMK: 0.03 })
    ]),
    transitions: Object.freeze([
      Object.freeze({ name: 'melting', temperatureK: tMelt, latentHeatJPerKg: Number(match.thermodynamic?.latentHeatFusionJPerKg ?? 1e5) }),
      Object.freeze({ name: 'boiling', temperatureK: tBoil, latentHeatJPerKg: Number(match.thermodynamic?.latentHeatVaporizationJPerKg ?? 1e6) })
    ]),
    provenance: Object.freeze([
      Object.freeze({
        family: 'phase-transitions',
        source: 'ulg-gate2-foundation-polytope-atlas',
        method: 'recursive-compound-first-principles-derivation',
        status: 'reduced-estimate',
        accuracyTier: match.accuracyTier,
        closureHash: match.closureHash,
        scientificValidation: false
      })
    ])
  });
}

export function referenceBankRecordForMaterial(materialKey, { preferFoundationPolytopeAtlas = false } = {}) {
  if (preferFoundationPolytopeAtlas === true) {
    const foundation = foundationPolytopeCompoundRecordFor(materialKey);
    if (foundation) return { record: foundation, bank: 'foundation-polytope-atlas' };
  }
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

function bankProvenanceForFamily(record, family) {
  return (record.provenance || []).find((entry) => entry?.family === family) || null;
}

function thermalConductivityProvenance(record, bank, phaseName) {
  const entry = bankProvenanceForFamily(record, 'thermal-conductivity')
    ?? bankProvenanceForFamily(record, 'phase-mechanics-optical')
    ?? null;
  return {
    schema: 'peercompute.ulg.material-thermal-conductivity-provenance.v0',
    status: entry?.status ?? 'reference-fallback',
    source: entry?.source ?? 'material-property-reference-bank',
    method: entry?.method ?? 'bank reference value held constant within runtime phase segment',
    units: entry?.units ?? 'W/(m K)',
    referenceState: entry?.referenceState ?? record.referenceState ?? null,
    quality: entry?.quality ?? null,
    applicationPolicy:
      entry?.applicationPolicy
      ?? 'reference-state-value-held-constant-within-runtime-phase',
    references: [...(entry?.references || [])],
    bank,
    record: record.key || record.symbol || null,
    phase: phaseName
  };
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
// First-class air (plan/todo/first-class-air.md, slice 4): a gas phase carries
// measured dilute-gas transport exactly as condensed phases carry their
// measured conductivity. Only k and mu are set, so derived gas density and
// heat capacity (and every caloric gauge built on them) are unchanged. The
// record need not carry phase transitions: transport anchoring is independent
// of the phase-boundary anchoring above.
function deriveGasTransportChapmanEnskog(properties, gasPhase) {
  const molarMassKgPerMol = Number(properties?.molarMassKgPerMol);
  if (!(molarMassKgPerMol > 0)) return null;
  const phases = Array.isArray(properties?.phases) ? properties.phases : [];
  const condensed = phases.find((p) => p?.name === 'liquid' && Number(p?.densityKgPerM3) > 0)
    ?? phases.find((p) => p?.name === 'solid' && Number(p?.densityKgPerM3) > 0);
  const rhoRef = Number(condensed?.densityKgPerM3);
  // Estimate hard-sphere / LJ collision diameter sigma from condensed molar volume
  // (V_m / N_A)^(1/3) * 0.841 (Bird-Stewart-Lightfoot law of corresponding states).
  const molarVolM3 = rhoRef > 0 ? molarMassKgPerMol / rhoRef : 2.5e-5;
  const sigmaM = 0.841 * Math.cbrt(molarVolM3 / 6.02214076e23);
  const pt = properties?.phaseTransitions;
  const boilT = Number(properties?.boilingPointK)
    || Number(Array.isArray(pt) ? pt.find((t) => t?.name === 'boiling')?.temperatureK : pt?.boiling?.temperatureK)
    || 273.15;
  // Standard LJ well-depth correspondence: epsilon / k_B ~= 1.15 * T_b
  const epsilonJ = 1.15 * Math.max(4, boilT) * 1.380649e-23;
  const temperatureK = Math.max(20, Number(gasPhase?.referenceTemperatureK) || Math.max(298.15, boilT * 1.05));
  const cvSpecific = Number(gasPhase?.specificHeatCapacityJPerKgK);
  const cvMolarJPerMolK = cvSpecific > 0 ? cvSpecific * molarMassKgPerMol : 1.5 * 8.314462618;
  return deriveDiluteGasTransportFromPairPotential({
    molarMassKgPerMol,
    sigmaM,
    epsilonJ,
    temperatureK,
    cvMolarJPerMolK
  });
}

function anchorGasTransport(properties, materialKey) {
  const record = compoundRecordFor(materialKey) ?? elementRecordFor(materialKey);
  const provenance = bankProvenanceForFamily(record || {}, 'gas-transport');
  const reference = record ? bankPhase(record, 'gas') : null;
  const phases = properties?.phases;
  const gasIndex = Array.isArray(phases) ? phases.findIndex((phase) => phase?.name === 'gas') : -1;
  const conductivity = Number(reference?.thermalConductivityWPerMK);
  const viscosity = Number(reference?.dynamicViscosityPaS);
  const chapmanEnskog = gasIndex >= 0
    ? deriveGasTransportChapmanEnskog(properties, phases[gasIndex])
    : null;
  if (
    !provenance
    || provenance.source !== REFERENCE_ANCHOR_SOURCE
    || gasIndex < 0
    || !(conductivity > 0)
  ) {
    // First-principles Chapman-Enskog + Modified Eucken derivation for any gas
    // without a bank transport anchor (Slice 4 generalization across periodic table).
    if (
      gasIndex >= 0
      && chapmanEnskog
      && !(Number(phases[gasIndex]?.dynamicViscosityPaS) > 0)
    ) {
      const derived = phases[gasIndex];
      const gas = {
        ...derived,
        thermalConductivityWPerMK:
          Number(derived.thermalConductivityWPerMK) > 0
            ? derived.thermalConductivityWPerMK
            : chapmanEnskog.thermalConductivityWPerMK,
        dynamicViscosityPaS: chapmanEnskog.dynamicViscosityPaS,
        thermalConductivityProvenance: {
          schema: 'peercompute.ulg.material-thermal-conductivity-provenance.v0',
          status: PROPERTY_DERIVATION_STATUS.PHYSICAL_LAW,
          source: 'pair-potential-chapman-enskog',
          method: chapmanEnskog.method,
          units: 'W/(m K), Pa s',
          transportTemperatureK: chapmanEnskog.temperatureK,
          reducedTemperature: chapmanEnskog.reducedTemperature,
          omega22: chapmanEnskog.omega22
        }
      };
      const derivedPaths = ['phases.gas.dynamicViscosityPaS'];
      if (!(Number(derived.thermalConductivityWPerMK) > 0)) {
        derivedPaths.unshift('phases.gas.thermalConductivityWPerMK');
      }
      return {
        properties: {
          ...properties,
          phases: phases.map((phase, index) => (index === gasIndex ? gas : phase)),
          propertyProvenance: {
            ...(properties.propertyProvenance || {}),
            entries: [
              ...(properties.propertyProvenance?.entries || []),
              propertyProvenanceEntry({
                paths: derivedPaths,
                status: PROPERTY_DERIVATION_STATUS.PHYSICAL_LAW,
                source: 'pair-potential-chapman-enskog',
                method: `${chapmanEnskog.method} at ${chapmanEnskog.temperatureK.toFixed(1)} K`,
                inputs: [String(materialKey)]
              })
            ],
            notes: [
              ...(properties.propertyProvenance?.notes || []),
              `Dilute-gas transport (k, mu) derived via Chapman-Enskog / Modified Eucken for ${String(materialKey)}.`
            ]
          }
        },
        anchored: false,
        residuals: { gasTransportChapmanEnskog: chapmanEnskog },
        anchoredPaths: []
      };
    }
    return { properties, anchored: false, residuals: null, anchoredPaths: [] };
  }
  const derived = phases[gasIndex];
  const gas = {
    ...derived,
    thermalConductivityWPerMK: conductivity,
    thermalConductivityProvenance: {
      schema: 'peercompute.ulg.material-thermal-conductivity-provenance.v0',
      status: provenance.status ?? 'reference-fallback',
      source: provenance.source,
      method: provenance.method,
      units: provenance.units ?? 'W/(m K), Pa s',
      referenceState: provenance.referenceState ?? record.referenceState ?? null,
      quality: provenance.quality ?? null,
      applicationPolicy:
        provenance.applicationPolicy
        ?? 'dilute-gas reference value held constant within the runtime gas phase segment',
      references: [...(provenance.references || [])],
      bank: record.symbol ? 'elements' : 'compounds',
      record: record.key || record.symbol || null,
      phase: 'gas',
      family: 'gas-transport',
      transportTemperatureK: Number(reference.transportTemperatureK) || null
    },
    ...(viscosity > 0 ? { dynamicViscosityPaS: viscosity } : {})
  };
  const anchoredPaths = ['phases.gas.thermalConductivityWPerMK'];
  if (viscosity > 0) anchoredPaths.push('phases.gas.dynamicViscosityPaS');
  const residuals = {
    gasTransport: {
      derivedThermalConductivityWPerMK: derived.thermalConductivityWPerMK ?? chapmanEnskog?.thermalConductivityWPerMK ?? null,
      referenceThermalConductivityWPerMK: conductivity,
      derivedDynamicViscosityPaS: derived.dynamicViscosityPaS ?? chapmanEnskog?.dynamicViscosityPaS ?? null,
      referenceDynamicViscosityPaS: viscosity > 0 ? viscosity : null,
      chapmanEnskogDerived: chapmanEnskog
    }
  };
  const anchored = {
    ...properties,
    phases: phases.map((phase, index) => (index === gasIndex ? gas : phase)),
    referenceBankAnchoring: {
      schema: 'peercompute.ulg.material-reference-bank-anchoring.v0',
      ...(properties.referenceBankAnchoring || {}),
      bank: properties.referenceBankAnchoring?.bank ?? (record.symbol ? 'elements' : 'compounds'),
      source: properties.referenceBankAnchoring?.source ?? REFERENCE_ANCHOR_SOURCE,
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
          method: `dilute-gas thermal conductivity and dynamic viscosity at ${provenance.referenceState} (${provenance.method})`,
          inputs: [record.formula ?? record.symbol ?? String(materialKey)]
        })
      ],
      notes: [
        ...(properties.propertyProvenance?.notes || []),
        `Gas transport (k, mu) anchored to the reference bank for ${record.formula ?? record.symbol}.`
      ]
    }
  };
  return { properties: anchored, anchored: true, residuals, anchoredPaths };
}

export function anchorDerivedMaterialProperties(properties, materialKey) {
  const phaseAnchoring = anchorDerivedPhaseBoundaries(properties, materialKey);
  const bandAnchoring = anchorGasElectronicBand(phaseAnchoring.properties, materialKey);
  const opticalAnchoring = anchorConductorOpticalConstants(bandAnchoring.properties, materialKey);
  const transportAnchoring = anchorGasTransport(opticalAnchoring.properties, materialKey);
  const applied = [phaseAnchoring, bandAnchoring, opticalAnchoring, transportAnchoring]
    .filter((result) => result.anchored);
  if (applied.length === 0) {
    return {
      properties: transportAnchoring.properties,
      anchored: false,
      residuals: transportAnchoring.residuals ?? null,
      anchoredPaths: []
    };
  }
  return {
    properties: transportAnchoring.properties,
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

  // Reduced product closures start as a single condensed liquid branch. When
  // the bank supplies a melting point, synthesize the missing solid phase and
  // melting transition with explicit reference-fallback provenance so oxides
  // and salts carry realistic solid heat capacity and latent heat.
  const hasSolidTransition = transitions.some((transition) => transition.from === 'solid' && transition.to === 'liquid');
  if (melting && !hasSolidTransition && phases.some((phase) => phase.name === 'liquid')) {
    transitions.unshift({
      from: 'solid',
      to: 'liquid',
      temperatureK: melting.temperatureK,
      latentHeatJPerKg: melting.latentHeatJPerKg
    });
    anchoredPaths.push('transitions.solid->liquid.temperatureK', 'transitions.solid->liquid.latentHeatJPerKg');
    residuals.melting = {
      derivedTemperatureK: null,
      referenceTemperatureK: melting.temperatureK,
      derivedLatentHeatJPerKg: null,
      referenceLatentHeatJPerKg: melting.latentHeatJPerKg
    };
    const liquid = phases.find((phase) => phase.name === 'liquid');
    if (Array.isArray(liquid?.temperatureRange)) {
      liquid.temperatureRange = [melting.temperatureK, liquid.temperatureRange[1]];
    }
    if (!phases.some((phase) => phase.name === 'solid')) {
      const solidRef = bankPhase(record, 'solid');
      const solidDensity = Number(solidRef?.densityKgPerM3) > 0
        ? Number(solidRef.densityKgPerM3)
        : Number(liquid?.densityKgPerM3) || 2000;
      const solidCp = Number(solidRef?.heatCapacityJPerKgK ?? solidRef?.cpJPerKgK) > 0
        ? Number(solidRef.heatCapacityJPerKgK ?? solidRef.cpJPerKgK)
        : Number(liquid?.cpJPerKgK) || 800;
      const solidBulk = Number(liquid?.bulkModulusPa) > 0 ? Number(liquid.bulkModulusPa) : 1e9;
      phases.unshift({
        name: 'solid',
        cpJPerKgK: solidCp,
        densityKgPerM3: solidDensity,
        temperatureRange: [0, melting.temperatureK],
        bulkModulusPa: solidBulk,
        shearModulusPa: 0
      });
      anchoredPaths.push(
        'phases.solid.temperatureRange',
        'phases.solid.densityKgPerM3',
        'phases.solid.cpJPerKgK',
        'phases.solid.bulkModulusPa',
        'phases.solid.shearModulusPa'
      );
    }
  }

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
      const referenceConductivity = reference.thermalConductivityWPerMK;
      if (Number.isFinite(referenceConductivity) && referenceConductivity > 0) {
        residuals[`${phase.name}ThermalConductivity`] = {
          derivedThermalConductivityWPerMK: phase.thermalConductivityWPerMK ?? null,
          referenceThermalConductivityWPerMK: referenceConductivity
        };
        phase.thermalConductivityWPerMK = referenceConductivity;
        phase.thermalConductivityProvenance =
          thermalConductivityProvenance(record, bank, phase.name);
        anchoredPaths.push(`phases.${phase.name}.thermalConductivityWPerMK`);
      }
      const referenceViscosity = reference.dynamicViscosityPaS;
      if (Number.isFinite(referenceViscosity) && referenceViscosity >= 0) {
        residuals[`${phase.name}DynamicViscosity`] = {
          derivedDynamicViscosityPaS: phase.dynamicViscosityPaS ?? null,
          referenceDynamicViscosityPaS: referenceViscosity
        };
        phase.dynamicViscosityPaS = referenceViscosity;
        anchoredPaths.push(`phases.${phase.name}.dynamicViscosityPaS`);
      }
      const referenceSurfaceTension = reference.surfaceTensionNPerM;
      if (
        Number.isFinite(referenceSurfaceTension)
        && referenceSurfaceTension >= 0
      ) {
        residuals[`${phase.name}SurfaceTension`] = {
          derivedSurfaceTensionNPerM: phase.surfaceTensionNPerM ?? null,
          referenceSurfaceTensionNPerM: referenceSurfaceTension
        };
        phase.surfaceTensionNPerM = referenceSurfaceTension;
        anchoredPaths.push(`phases.${phase.name}.surfaceTensionNPerM`);
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
