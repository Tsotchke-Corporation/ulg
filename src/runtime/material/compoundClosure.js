// Derived closure for a reaction PRODUCT compound. When two materials react, the product is usually
// a molecule the demo has no reference closure for (e.g. NaOH, Na2O, MgO). Rather than tabulate it,
// we derive a minimal simulation closure from first principles + the constituent materials:
//   - molar mass:        exact, from the atomic masses of the constituent atoms.
//   - condensed density: volume-additive blend of the reactant condensed densities (the product
//                        forms out of them) — a derived estimate, documented as such.
//   - heat capacity:     Dulong–Petit / equipartition (3R per atom over the molar mass).
//   - bulk modulus:      mass-weighted mean of the reactant bulk moduli (sets the sound speed c=√(K/ρ)).
//   - conductivity:      harmonic mean of positive representative reactant phase conductivities.
//   - optical colour:    from the product molecule's HOMO–LUMO gap (RHF) → absorption edge → sRGB.
// One condensed (liquid-like) phase, shear 0 (a reaction-product puddle/melt). Evidence-only: every
// validation flag stays false (HF/STO-3G + additive estimates are approximations, not validated).

import {
  SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL_LABELS,
  ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_PROPERTY_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import { atomicMassKg } from '../electronicStructure/periodicTable.js';
import {
  CONDENSED_DISPERSED_OPTICAL_REFERENCE_SOURCE,
  createCondensedDispersedMediumOpticalClosure
} from './condensedDispersedOpticalReferences.js';
import { deriveFormulaMaterialProperties } from './materialDerivation.js';
import {
  PROPERTY_DERIVATION_STATUS as DS,
  materialDerivationSummary,
  propertyProvenanceEntry,
  requireFirstPrinciplesMaterialProperties,
  withPropertyProvenance
} from './propertyProvenance.js';

const AVOGADRO = 6.02214076e23;
const R = 8.314462618;
const OPEN_TOP_K = 1e6;
const MIN_CONDENSED_DENSITY_KG_PER_M3 = 500;
const DEFAULT_REDUCED_PRODUCT_DENSITY_KG_PER_M3 = 1500;
const DEFAULT_REDUCED_PRODUCT_BULK_MODULUS_PA = 1e9;

export const REACTION_PRODUCT_DISPERSED_MEDIUM_OPTICAL_BLOCKED_SOURCE =
  'reaction-product-dispersed-optics-blocked-missing-size-and-complex-index';

const REACTION_PRODUCT_DISPERSED_MEDIUM_OPTICAL_BLOCKERS = Object.freeze([
  'reaction-product-condensate-size-distribution-not-produced',
  'reaction-product-visible-complex-refractive-index-not-produced',
  'reaction-product-size-dependent-scattering-efficiency-not-derived'
]);

function blockedReactionProductDispersedMediumOpticalClosure({
  densityKgPerM3
} = {}) {
  const density = Number(densityKgPerM3);
  if (!Number.isFinite(density) || !(density > 0)) {
    throw new RangeError(
      'Reduced reaction-product optics require positive condensed density'
    );
  }
  return Object.freeze({
    schema: ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_PROPERTY_SCHEMA,
    morphologyModel:
      SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL_LABELS
        .blocked,
    condensedDensityKgPerM3: density,
    scatteringEfficiencyQsca: 0,
    absorptionEfficiencyQabs: 0,
    asymmetryFactorG: 0,
    provenance: Object.freeze({
      status: DS.BLOCKED,
      source: REACTION_PRODUCT_DISPERSED_MEDIUM_OPTICAL_BLOCKED_SOURCE,
      accuracy:
        'blocked-no-authoritative-size-distribution-or-visible-complex-refractive-index',
      method:
        'fail closed: conserved condensed mass and reduced density determine condensed volume, but neither a particle-size distribution nor wavelength-dependent complex refractive index is derivable for the reduced reaction product, so no optical efficiency is asserted',
      densitySource: Object.freeze({
        status: DS.REDUCED_ESTIMATE,
        source: 'reactant-packed-product-closure',
        method: 'reuse the reduced reaction-product condensed density without adding optical interpretation'
      }),
      blockers: REACTION_PRODUCT_DISPERSED_MEDIUM_OPTICAL_BLOCKERS
    }),
    scientificValidation: false
  });
}

function reactionProductDispersedMediumOpticalClosure({
  key,
  label,
  atomCounts,
  densityKgPerM3
}) {
  return createCondensedDispersedMediumOpticalClosure({
    material: key,
    formula: label,
    atomCounts,
    condensedPhase: 'liquid'
  }) || blockedReactionProductDispersedMediumOpticalClosure({ densityKgPerM3 });
}

function reactionProductDispersedMediumOpticalProvenanceEntries({
  key,
  closure
}) {
  const ready = closure?.morphologyModel
    === SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL_LABELS
      .singleCompactSphereComplexIndex;
  if (ready) {
    return [
      propertyProvenanceEntry({
        paths: [
          'dispersedMediumOpticalClosure.schema',
          'dispersedMediumOpticalClosure.scientificValidation'
        ],
        status: DS.EXACT_CONSTANT,
        source: 'ulg-gpu-abi-contract',
        method:
          'typed dispersed-medium optical property schema with an explicit false validation claim'
      }),
      propertyProvenanceEntry({
        paths: ['dispersedMediumOpticalClosure.condensedDensityKgPerM3'],
        status: DS.REFERENCE_FALLBACK,
        source: CONDENSED_DISPERSED_OPTICAL_REFERENCE_SOURCE,
        accuracy: closure.provenance.accuracy,
        method:
          'phase- and composition-authenticated condensed density from the optical reference record; this optical density does not replace the reduced mechanical EOS density',
        inputs: [
          `product=${key}`,
          `reference-record=${closure.provenance.referenceRecordId}`,
          `reference-temperature-k=${closure.provenance.referenceTemperatureK}`,
          `reference-temperature-range-k=${closure.provenance.referenceTemperatureRangeK.join(':')}`,
          `runtime-applicability-enforced=${closure.provenance.runtimeApplicabilityEnforced}`
        ],
        blockers: closure.provenance.blockers
      }),
      propertyProvenanceEntry({
        paths: [
          'dispersedMediumOpticalClosure.morphologyModel',
          'dispersedMediumOpticalClosure.relativeRefractiveIndexN',
          'dispersedMediumOpticalClosure.relativeExtinctionCoefficientK',
          'dispersedMediumOpticalClosure.largeSizeRayAsymmetryFactorG',
          'dispersedMediumOpticalClosure.referenceWavelengthM',
          'dispersedMediumOpticalClosure.provenance'
        ],
        status: DS.REFERENCE_FALLBACK,
        source: CONDENSED_DISPERSED_OPTICAL_REFERENCE_SOURCE,
        accuracy: closure.provenance.accuracy,
        method: closure.provenance.method,
        inputs: [
          `product=${key}`,
          `reference-record=${closure.provenance.referenceRecordId}`,
          `reference-bank=${closure.provenance.referenceBankFingerprint}`,
          `extinction-model=${closure.provenance.extinctionModel}`,
          `reference-temperature-range-k=${closure.provenance.referenceTemperatureRangeK.join(':')}`,
          `runtime-applicability-enforced=${closure.provenance.runtimeApplicabilityEnforced}`
        ],
        blockers: closure.provenance.blockers
      })
    ];
  }
  return [
    propertyProvenanceEntry({
      paths: [
        'dispersedMediumOpticalClosure.schema',
        'dispersedMediumOpticalClosure.scientificValidation'
      ],
      status: DS.EXACT_CONSTANT,
      source: 'ulg-gpu-abi-contract',
      method:
        'typed dispersed-medium optical property schema with an explicit false validation claim'
    }),
    propertyProvenanceEntry({
      paths: ['dispersedMediumOpticalClosure.condensedDensityKgPerM3'],
      status: DS.REDUCED_ESTIMATE,
      source: 'reactant-packed-product-closure',
      method:
        'copy the reduced product condensed density into the optical closure without claiming measured aerosol density',
      inputs: [`product=${key}`, 'phases.liquid.densityKgPerM3'],
      blockers: ['reaction-product-condensed-density-not-scientifically-validated']
    }),
    propertyProvenanceEntry({
      paths: [
        'dispersedMediumOpticalClosure.morphologyModel',
        'dispersedMediumOpticalClosure.scatteringEfficiencyQsca',
        'dispersedMediumOpticalClosure.absorptionEfficiencyQabs',
        'dispersedMediumOpticalClosure.asymmetryFactorG',
        'dispersedMediumOpticalClosure.provenance'
      ],
      status: DS.BLOCKED,
      source: REACTION_PRODUCT_DISPERSED_MEDIUM_OPTICAL_BLOCKED_SOURCE,
      accuracy:
        'blocked-no-authoritative-size-distribution-or-visible-complex-refractive-index',
      method:
        'fail closed because conserved reaction-born condensed mass and reduced product density determine volume but not size distribution or wavelength-dependent complex refractive index; zero efficiencies are absence markers, not an opacity model',
      inputs: [
        'reaction-born-conserved-condensed-mass',
        'reduced-product-condensed-density'
      ],
      blockers: REACTION_PRODUCT_DISPERSED_MEDIUM_OPTICAL_BLOCKERS
    })
  ];
}

function formulaMolarMassKgPerMol(atomCounts) {
  return Object.entries(atomCounts)
    .reduce((sum, [Z, count]) => sum + Number(count) * atomicMassKg(Number(Z)) * AVOGADRO, 0);
}

function atomCount(atomCounts) {
  return Object.values(atomCounts).reduce((sum, count) => sum + Number(count), 0);
}

// Map a single absorbed wavelength (nm) to an approximate sRGB of that spectral colour (Bruton's
// piecewise fit). Used to subtract the absorbed band from white → the transmitted body colour.
function wavelengthToSrgb(nm) {
  let r = 0; let g = 0; let b = 0;
  if (nm >= 380 && nm < 440) { r = -(nm - 440) / 60; b = 1; }
  else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
  else if (nm < 510) { g = 1; b = -(nm - 510) / 20; }
  else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
  else if (nm < 645) { r = 1; g = -(nm - 645) / 65; }
  else if (nm <= 780) { r = 1; }
  return [r, g, b];
}

/**
 * Body colour from the electronic absorption edge. The HOMO–LUMO gap sets the lowest-energy
 * absorption; the absorbed wavelength λ = hc/E_gap is removed from white, so a wide-gap insulator
 * (λ in the UV) stays near-white/clear and a narrow-gap species takes on the colour complementary to
 * what it absorbs in the visible. Derived from the molecule's orbital energies — not a fixed colour.
 */
export function compoundColorFromGapEv(gapEv) {
  if (!(gapEv > 0)) return [0.55, 0.55, 0.58]; // metallic / closed gap → neutral grey
  const lambdaNm = 1239.841984 / gapEv;
  if (lambdaNm < 380) return [0.93, 0.95, 0.97]; // absorbs only in the UV → colourless solid/liquid
  if (lambdaNm > 780) return [0.30, 0.28, 0.32]; // absorbs across the visible/IR → dark
  const absorbed = wavelengthToSrgb(lambdaNm);
  // Transmitted = white − absorbed band (complementary colour), kept in [0.05, 1].
  const k = 0.85;
  return absorbed.map((c) => Math.max(0.05, 1 - k * c));
}

function reducedReactantPackedDensityKgPerM3(molarMassKgPerMol, reactants = []) {
  let sourceVolumeM3PerMol = 0;
  for (const reactant of reactants || []) {
    const density = Number(reactant?.densityKgPerM3);
    const mass = Number(reactant?.molarMassKgPerMol);
    if (density > MIN_CONDENSED_DENSITY_KG_PER_M3 && mass > 0) {
      sourceVolumeM3PerMol += mass / density;
    }
  }
  if (sourceVolumeM3PerMol > 0) {
    return Math.max(MIN_CONDENSED_DENSITY_KG_PER_M3, molarMassKgPerMol / sourceVolumeM3PerMol);
  }
  return DEFAULT_REDUCED_PRODUCT_DENSITY_KG_PER_M3;
}

function reducedReactantBulkModulusPa(reactants = []) {
  const finite = (reactants || [])
    .map((reactant) => Number(reactant?.bulkModulusPa))
    .filter((value) => value > 0);
  if (finite.length === 0) return DEFAULT_REDUCED_PRODUCT_BULK_MODULUS_PA;
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

function reducedReactantThermalConductivityWPerMK(reactants = []) {
  const finite = (reactants || [])
    .map((reactant) => Number(reactant?.thermalConductivityWPerMK));
  // Conductivity is a bilateral transport certificate. If any representative
  // reactant phase lacks a finite positive value, keep the reduced product
  // fail-closed instead of silently substituting the better-known reactant.
  if (
    finite.length === 0
    || finite.some((value) => !Number.isFinite(value) || value <= 0)
  ) {
    return 0;
  }
  return finite.length / finite.reduce((sum, value) => sum + 1 / value, 0);
}

function deriveReducedCompoundProperties({ key, label, atomCounts, reactants = [] }) {
  const molarMassKgPerMol = formulaMolarMassKgPerMol(atomCounts);
  const atomsPerFormula = atomCount(atomCounts);
  const densityKgPerM3 = reducedReactantPackedDensityKgPerM3(molarMassKgPerMol, reactants);
  const bulkModulusPa = reducedReactantBulkModulusPa(reactants);
  const thermalConductivityWPerMK = reducedReactantThermalConductivityWPerMK(reactants);
  const cpJPerKgK = (3 * R * Math.max(1, atomsPerFormula)) / molarMassKgPerMol;
  const dispersedMediumOpticalClosure =
    reactionProductDispersedMediumOpticalClosure({
      key,
      label,
      atomCounts,
      densityKgPerM3
    });
  return withPropertyProvenance({
    molarMassKgPerMol,
    atomsPerFormula,
    label,
    compound: true,
    closureBacked: true,
    derivation: 'reduced-reaction-product-closure: exact formula mass; reactant-packed density, bulk, and conductivity estimates',
    intrinsicColorSrgb: [0.78, 0.80, 0.82],
    dispersedMediumOpticalClosure,
    phases: [{
      name: 'liquid',
      cpJPerKgK,
      densityKgPerM3,
      temperatureRange: [0, OPEN_TOP_K],
      bulkModulusPa,
      thermalConductivityWPerMK,
      shearModulusPa: 0
    }],
    transitions: [],
    validation: {
      eosValidation: false,
      thermalValidation: false,
      opticalValidation: false,
      scientificValidation: false
    }
  }, {
    entries: [
      propertyProvenanceEntry({
        paths: ['molarMassKgPerMol', 'atomsPerFormula'],
        status: DS.EXACT_CONSTANT,
        source: 'periodic-table-atomic-masses',
        method: 'formula molar mass and atom count from product atom counts',
        inputs: Object.entries(atomCounts).map(([Z, count]) => `Z=${Z}:count=${count}`)
      }),
      propertyProvenanceEntry({
        paths: [
          'intrinsicColorSrgb',
          'phases.liquid.cpJPerKgK',
          'phases.liquid.densityKgPerM3',
          'phases.liquid.temperatureRange',
          'phases.liquid.bulkModulusPa',
          'phases.liquid.thermalConductivityWPerMK',
          'phases.liquid.shearModulusPa'
        ],
        status: DS.REDUCED_ESTIMATE,
        source: 'reactant-packed-product-closure',
        method: 'mobile-safe reduced product closure from exact formula mass plus reactant condensed packing, Dulong-Petit heat capacity, and harmonic-mean representative conductivity',
        inputs: [
          `product=${key || label}`,
          ...((reactants || []).map((reactant) => `${reactant?.material || reactant?.formula || 'reactant'}:rho=${reactant?.densityKgPerM3 ?? 'unknown'}:K=${reactant?.bulkModulusPa ?? 'unknown'}:k=${reactant?.thermalConductivityWPerMK ?? 'unknown'}`))
        ],
        blockers: ['reaction-product-first-principles-closure-skipped-for-interactive-runtime']
      }),
      ...reactionProductDispersedMediumOpticalProvenanceEntries({
        key: key || label,
        closure: dispersedMediumOpticalClosure
      })
    ],
    notes: [
      `${key || label} uses a reduced reaction-product closure for interactive runtime stability; it is not validated thermochemistry or EOS.`,
      dispersedMediumOpticalClosure.provenance.source
        === CONDENSED_DISPERSED_OPTICAL_REFERENCE_SOURCE
        ? 'Dispersed optics use a phase- and composition-matched reference record; plume hydration, size distribution, and quantitative extinction remain unvalidated.'
        : 'Dispersed optics remain fail-closed because no phase- and composition-matched reference record is available.'
    ]
  });
}

/**
 * Derive a renderable material closure for a product compound.
 * @param atomCounts  { [Z]: count } formula of one product formula unit.
 * @param geometry    [{Z, position:[x,y,z]}] (Bohr) for the electronic-structure colour calc.
 * @param reactants   [{ densityKgPerM3, bulkModulusPa, molarMassKgPerMol }] the source materials, for
 *                    the density/stiffness estimates.
 */
export function deriveCompoundClosure({ key, label, atomCounts, geometry, reactants = [], allowReducedEstimates = false }) {
  const properties = allowReducedEstimates
    ? deriveReducedCompoundProperties({ key, label, atomCounts, reactants })
    : {
      ...deriveFormulaMaterialProperties({
        key,
        atomCounts,
        geometry,
        phaseModel: 'molecular-condensed'
      }),
      label,
      compound: true
    };

  const closure = {
    key,
    properties,
    materialDerivation: materialDerivationSummary(properties)
  };
  if (!allowReducedEstimates) {
    requireFirstPrinciplesMaterialProperties(properties, {
      material: key,
      context: 'deriveCompoundClosure'
    });
  }
  return closure;
}
