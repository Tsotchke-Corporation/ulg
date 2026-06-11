// Material closure fixtures for the SPH phase demo (demo plan P2).
//
// These wrap the tagged reference constants as proper `eshkol.ulg.material-closure.v0`
// artifacts that are storable in `ClosureRegistry` (they carry closureId/closureKind/
// inputHash/methodHash/execution/validity) and consumable by the thermodynamic core.
//
// They are NOT validated: provenance cites the pending MoonLab microphysics reference families
// as the inputs that *will* back them, validation.evidenceRefs is empty, and every validation
// flag stays false. P2's job is the pipeline machinery; swapping these reference values for real
// MoonLab/Eshkol-derived closures is a data swap, not a code change.

import { createMaterialClosureArtifact, hashPayload } from '../../../ulg-gpu-abi/src/index.js';
import { PHYSICAL_CONSTANTS, REFERENCE_MATERIALS, idealGasDensityKgPerM3 } from '../materials/referenceMaterials.js';
import { atomicMassKg } from '../electronicStructure/periodicTable.js';
import { createH2OMicrophysicsReference, microphysicsInputRef } from './microphysicsReferences.js';
import {
  atomicNumberDensity,
  debyeTemperatureFromSoundSpeed,
  gasMixtureThermal
} from './statisticalMechanics.js';
import { latentHeatOfFusionJPerKg } from './phaseTransitions.js';
import { createDerivedMaterialClosures } from './materialDerivation.js';
import {
  PROPERTY_DERIVATION_STATUS as DS,
  assertNoUnprovenancedMaterialProperties,
  materialDerivationSummary,
  propertyProvenanceEntry,
  requireFirstPrinciplesMaterialProperties,
  withPropertyProvenance
} from './propertyProvenance.js';

const OPEN_TOP_K = 1e6;
const AVOGADRO = 6.02214076e23;
const STANDARD_TEMPERATURE_K = 273.15;

function formulaMolarMassKgPerMol(atomCounts) {
  return Object.entries(atomCounts)
    .reduce((sum, [Z, count]) => sum + Number(count) * atomicMassKg(Number(Z)) * AVOGADRO, 0);
}

// Air heat capacity + molar mass derived first-principles from equipartition over molecular
// degrees of freedom (no tabulated cp).
const AIR_THERMAL = gasMixtureThermal();
// Iron Debye temperature derived from a Debye-averaged sound speed + atomic number density.
// The sound speed is a reference mechanical input (a mechanical closure is still pending); the
// Debye temperature and the resulting temperature-dependent heat capacity are derived.
const IRON_DEBYE_SOUND_SPEED_M_PER_S = 3600;
const IRON_DEBYE_TEMPERATURE_K = debyeTemperatureFromSoundSpeed({
  soundSpeedMPerS: IRON_DEBYE_SOUND_SPEED_M_PER_S,
  numberDensityPerM3: atomicNumberDensity({
    densityKgPerM3: REFERENCE_MATERIALS.fe.densityKgPerM3.solid,
    molarMassKgPerMol: REFERENCE_MATERIALS.fe.molarMassKgPerMol
  })
});

// H2O now cites a *produced* MoonLab microphysics reference (model-quality, not yet
// quantitative). Fe and air remain pending — no MoonLab microphysics has been produced for them.
function microphysicsRefsFor(materialKey) {
  if (materialKey === 'h2o') {
    return [microphysicsInputRef(createH2OMicrophysicsReference())];
  }
  const pending = {
    fe: 'moonlab.ulg.fe-microphysics-reference.v0',
    air: 'moonlab.ulg.air-mixture-reference.v0'
  }[materialKey] ?? `moonlab.ulg.${materialKey}-microphysics-reference.v0`;
  return [{ schema: pending, status: 'pending-not-yet-produced' }];
}

// Diatomic gas closure (H2, O2): heat capacity from equipartition over molecular degrees of freedom
// (cv = (5/2)R/M for a diatomic near room T — derived, not tabulated); STP density from the ideal
// gas law. Single gas phase. These are the combustion reactants.
const DIATOMIC_GASES = {
  h2: { atomCounts: { 1: 2 } },
  o2: { atomCounts: { 8: 2 } }
};
function diatomicGasProperties(key) {
  const d = DIATOMIC_GASES[key];
  const molarMassKgPerMol = formulaMolarMassKgPerMol(d.atomCounts);
  const densityKgPerM3 = idealGasDensityKgPerM3({
    pressurePa: PHYSICAL_CONSTANTS.standardAtmospherePa,
    temperatureK: STANDARD_TEMPERATURE_K,
    molarMassKgPerMol
  });
  const cv = (5 / 2) * (8.314462618 / molarMassKgPerMol);
  return withPropertyProvenance({
    molarMassKgPerMol,
    idealGas: true,
    heatCapacityModel: { gas: 'equipartition' },
    phases: [{ name: 'gas', cpJPerKgK: cv, densityKgPerM3, temperatureRange: [0, OPEN_TOP_K], bulkModulusPa: null, shearModulusPa: 0 }],
    transitions: []
  }, {
    entries: [
      propertyProvenanceEntry({
        paths: ['molarMassKgPerMol'],
        status: DS.EXACT_CONSTANT,
        source: 'periodic-table-atomic-masses',
        method: 'formula molar mass from atomic masses',
        inputs: Object.keys(d.atomCounts).map((Z) => `Z=${Z}`)
      }),
      propertyProvenanceEntry({
        paths: ['idealGas', 'phases.gas.cpJPerKgK', 'phases.gas.densityKgPerM3', 'phases.gas.temperatureRange', 'phases.gas.shearModulusPa'],
        status: DS.PHYSICAL_LAW,
        source: 'statistical-mechanics+ideal-gas-law',
        method: 'diatomic equipartition plus rho=pM/RT at the declared standard state',
        inputs: [`P=${PHYSICAL_CONSTANTS.standardAtmospherePa}Pa`, `T=${STANDARD_TEMPERATURE_K}K`]
      })
    ],
    notes: [`${key} gas properties derive from formula mass, equipartition, and ideal-gas density.`]
  });
}

function materialProperties(materialKey) {
  if (DIATOMIC_GASES[materialKey]) return diatomicGasProperties(materialKey);
  const m = REFERENCE_MATERIALS[materialKey];
  if (materialKey === 'h2o') {
    return withPropertyProvenance({
      molarMassKgPerMol: formulaMolarMassKgPerMol({ 1: 2, 8: 1 }),
      // Elastic moduli (Pa): bulk modulus K sets the sound speed c=√(K/ρ) and the EOS stiffness;
      // shear modulus μ sets a solid's rigidity (a liquid has μ=0 → no shear → flows). Measured
      // reference values (closureBacked, not yet ab-initio — the elastic-tensor-from-DFT track), so
      // the dynamics' stiffness is a real material property rather than an arbitrary constant.
      phases: [
        { name: 'solid', cpJPerKgK: m.cpJPerKgK.solid, densityKgPerM3: m.densityKgPerM3.solid, temperatureRange: [0, m.meltingPointK], bulkModulusPa: 8.8e9, shearModulusPa: 3.5e9 },
        { name: 'liquid', cpJPerKgK: m.cpJPerKgK.liquid, densityKgPerM3: m.densityKgPerM3.liquid, temperatureRange: [m.meltingPointK, m.boilingPointK], bulkModulusPa: 2.2e9, shearModulusPa: 0 },
        { name: 'gas', cpJPerKgK: m.cpJPerKgK.gas, densityKgPerM3: m.densityKgPerM3.gas, temperatureRange: [m.boilingPointK, OPEN_TOP_K], bulkModulusPa: null, shearModulusPa: 0 }
      ],
      transitions: [
        { from: 'solid', to: 'liquid', temperatureK: m.meltingPointK, latentHeatJPerKg: m.latentHeatFusionJPerKg },
        { from: 'liquid', to: 'gas', temperatureK: m.boilingPointK, latentHeatJPerKg: m.latentHeatVaporizationJPerKg }
      ]
    }, {
      entries: [
        propertyProvenanceEntry({
          paths: ['molarMassKgPerMol'],
          status: DS.EXACT_CONSTANT,
          source: 'periodic-table-atomic-masses',
          method: 'H2O formula molar mass from atomic masses',
          inputs: ['H:2', 'O:1']
        }),
        propertyProvenanceEntry({
          paths: ['phases.*.cpJPerKgK', 'phases.*.densityKgPerM3', 'phases.solid.bulkModulusPa', 'phases.liquid.bulkModulusPa', 'phases.solid.shearModulusPa', 'phases.*.temperatureRange', 'transitions.*.temperatureK', 'transitions.*.latentHeatJPerKg'],
          status: DS.REFERENCE_FALLBACK,
          source: 'reference-material-fixture',
          method: 'tabulated water phase constants pending molecular/condensed-phase closure',
          blockers: ['h2o-condensed-phase-md-or-dft-eos-not-produced', 'h2o-phase-boundary-free-energy-closure-not-produced']
        }),
        propertyProvenanceEntry({
          paths: ['phases.liquid.shearModulusPa', 'phases.gas.shearModulusPa'],
          status: DS.PHYSICAL_LAW,
          source: 'continuum-mechanics',
          method: 'fluids have no static shear modulus'
        })
      ],
      notes: ['H2O still uses reference phase/EOS constants; the ledger marks these as fallback instead of lower-level-derived.']
    });
  }
  if (materialKey === 'fe') {
    // Solid iron heat capacity is the first-principles Debye model (θ_D derived from sound speed
    // + atomic density); the constant cpJPerKgK is kept as the Dulong–Petit high-T fallback.
    return withPropertyProvenance({
      molarMassKgPerMol: formulaMolarMassKgPerMol({ 26: 1 }),
      atomsPerFormula: 1,
      heatCapacityModel: { solid: 'debye', liquid: 'constant-reference' },
      densityModel: { solid: 'gruneisen-debye-thermal-expansion', liquid: 'constant-reference' },
      // Conduction-electron density (iron's 2 free 4s electrons per atom × number density) → the
      // Drude plasma frequency → its optical colour. Derived, not a fitted plasma frequency.
      conductionElectronDensityPerM3: 2 * (m.densityKgPerM3.solid / m.molarMassKgPerMol) * 6.02214076e23,
      latentModel: { fusion: 'richards-rule' },
      phases: [
        {
          name: 'solid',
          cpJPerKgK: m.cpJPerKgK.solid,
          densityKgPerM3: m.densityKgPerM3.solid,
          temperatureRange: [0, m.meltingPointK],
          debyeTemperatureK: IRON_DEBYE_TEMPERATURE_K,
          // Grüneisen thermal EOS: thermal expansion / ρ(T) derived from these cold-curve inputs
          // (reference density, bulk modulus, Grüneisen γ) — the inputs ideally come from DFT.
          eos: { gruneisen: 1.7, bulkModulusPa: 170e9, referenceDensityKgPerM3: m.densityKgPerM3.solid, referenceTemperatureK: 293 },
          // Elastic moduli (Pa) for the mechanical stiffness: bulk K (= the EOS bulk modulus above)
          // and shear μ (rigidity). Reference values, closureBacked.
          bulkModulusPa: 170e9,
          shearModulusPa: 82e9
        },
        { name: 'liquid', cpJPerKgK: m.cpJPerKgK.liquid, densityKgPerM3: m.densityKgPerM3.liquid, temperatureRange: [m.meltingPointK, OPEN_TOP_K], bulkModulusPa: 110e9, shearModulusPa: 0 }
      ],
      transitions: [
        // Latent heat of fusion derived from the melting point via Richards' rule (ΔS_fus ≈ R for
        // a close-packed metal); ~9% of the measured value for iron.
        { from: 'solid', to: 'liquid', temperatureK: m.meltingPointK, latentHeatJPerKg: latentHeatOfFusionJPerKg({ meltingPointK: m.meltingPointK, molarMassKgPerMol: m.molarMassKgPerMol }) }
      ]
    }, {
      entries: [
        propertyProvenanceEntry({
          paths: ['molarMassKgPerMol', 'atomsPerFormula'],
          status: DS.EXACT_CONSTANT,
          source: 'periodic-table-atomic-mass',
          method: 'Fe formula mass from atomic mass'
        }),
        propertyProvenanceEntry({
          paths: ['conductionElectronDensityPerM3'],
          status: DS.REFERENCE_FALLBACK,
          source: 'reference-density-with-electron-count',
          method: '2 conduction electrons per atom times reference solid number density',
          blockers: ['fe-band-structure-or-validated-conduction-electron-closure-not-produced']
        }),
        propertyProvenanceEntry({
          paths: ['phases.solid.debyeTemperatureK', 'phases.solid.cpJPerKgK'],
          status: DS.REFERENCE_FALLBACK,
          source: 'debye-model-over-reference-sound-speed',
          method: 'Debye heat capacity from sound speed and reference atomic density',
          blockers: ['fe-elastic-tensor-from-dft-not-produced']
        }),
        propertyProvenanceEntry({
          paths: ['phases.solid.densityKgPerM3', 'phases.liquid.densityKgPerM3', 'phases.solid.eos.*', 'phases.solid.bulkModulusPa', 'phases.solid.shearModulusPa', 'phases.liquid.cpJPerKgK', 'phases.liquid.bulkModulusPa', 'phases.*.temperatureRange', 'transitions.solid->liquid.temperatureK'],
          status: DS.REFERENCE_FALLBACK,
          source: 'reference-material-fixture',
          method: 'tabulated Fe condensed-phase constants pending DFT/MD closure',
          blockers: ['fe-condensed-phase-dft-eos-not-produced', 'fe-liquid-md-closure-not-produced']
        }),
        propertyProvenanceEntry({
          paths: ['transitions.solid->liquid.latentHeatJPerKg'],
          status: DS.REFERENCE_FALLBACK,
          source: 'richards-rule-over-reference-melting-point',
          method: 'universal fusion entropy law with reference melting point',
          blockers: ['fe-free-energy-melting-closure-not-produced']
        }),
        propertyProvenanceEntry({
          paths: ['phases.liquid.shearModulusPa'],
          status: DS.PHYSICAL_LAW,
          source: 'continuum-mechanics',
          method: 'liquid phase has no static shear modulus'
        })
      ],
      notes: ['Fe is explicitly not lower-level-derived yet; the transition-metal jellium path is not accurate enough for iron.']
    });
  }
  if (materialKey === 'air') {
    // Sealed rigid (constant-volume) box: the gas uses cv (equipartition-derived) as its
    // effective heat capacity; density follows the ideal-gas law (computed from P,T at sample
    // time), not a constant. Heat capacity + molar mass are first-principles, not tabulated.
    return withPropertyProvenance({
      molarMassKgPerMol: AIR_THERMAL.molarMassKgPerMol,
      idealGas: true,
      heatCapacityModel: { gas: 'equipartition' },
      phases: [
        { name: 'gas', cpJPerKgK: AIR_THERMAL.cvJPerKgK, densityKgPerM3: null, temperatureRange: [0, OPEN_TOP_K] }
      ],
      transitions: []
    }, {
      entries: [
        propertyProvenanceEntry({
          paths: ['molarMassKgPerMol', 'phases.gas.cpJPerKgK'],
          status: DS.REFERENCE_FALLBACK,
          source: 'standard-dry-air-composition',
          method: 'equipartition over a reference atmospheric mixture',
          blockers: ['air-composition-transport-closure-not-produced']
        }),
        propertyProvenanceEntry({
          paths: ['idealGas', 'phases.gas.temperatureRange'],
          status: DS.PHYSICAL_LAW,
          source: 'ideal-gas-law',
          method: 'dilute-gas EOS with density sampled from pM/RT'
        })
      ],
      notes: ['Air cp is law-derived for a reference dry-air composition; composition itself is a fallback input.']
    });
  }
  throw new Error(`Unknown material key: ${materialKey}`);
}

const VALIDITY_TEMPERATURE_K = {
  h2o: [150, 1500],
  fe: [200, 4000],
  air: [100, 2000]
};

function buildMaterialClosure(materialKey) {
  const properties = materialProperties(materialKey);
  assertNoUnprovenancedMaterialProperties(properties);
  const materialDerivation = materialDerivationSummary(properties);
  const validityDomain = {
    temperatureK: VALIDITY_TEMPERATURE_K[materialKey] ?? [100, 6000],
    pressurePa: [1, 1e8],
    composition: 'pure'
  };
  const base = createMaterialClosureArtifact({
    closureFamily: 'material',
    closureId: `sph-phase-${materialKey}-material-closure`,
    material: materialKey,
    inputRefs: microphysicsRefsFor(materialKey),
    producer: { service: 'eshkol', commit: null, toolchain: 'reference-fixture' },
    validityDomain,
    units: {
      density: 'kg/m^3',
      heatCapacity: 'J/(kg*K)',
      specificInternalEnergy: 'J/kg',
      latentHeat: 'J/kg',
      temperature: 'K'
    },
    properties,
    derivatives: true,
    materialDerivation,
    provenance: {
      source: 'reference-fixture',
      notes: [
        `Material closure for ${materialKey}; microphysics refs: ${microphysicsRefsFor(materialKey).map((r) => `${r.schema}:${r.status}`).join(', ')}.`,
        `fullyLowerLevelDerived=${materialDerivation.fullyLowerLevelDerived}; blockers=${materialDerivation.blockers.join(',') || 'none'}.`
      ]
    }
  });
  // Augment with the fields ClosureRegistry needs (identity + validity envelope + execution).
  const inputHash = hashPayload({ material: materialKey, family: 'material', source: 'reference-fixture' });
  const methodHash = hashPayload({ properties });
  return {
    ...base,
    materialDerivation,
    inputHash,
    methodHash,
    execution: { mode: 'material-property-closure' },
    // Registry validity envelope gates on temperature only; pressure is carried in
    // validityDomain (P1 metadata) and used for ideal-gas density, not for domain gating.
    validity: {
      temperatureK: validityDomain.temperatureK
    },
    provenance: { ...base.provenance, inputHash, methodHash }
  };
}

/**
 * Build the reference-fixture material closures for H2O, Fe, and air.
 */
export function createReferenceMaterialClosures() {
  return {
    h2o: buildMaterialClosure('h2o'),
    fe: buildMaterialClosure('fe'),
    air: buildMaterialClosure('air'),
    h2: buildMaterialClosure('h2'),
    o2: buildMaterialClosure('o2')
  };
}

/**
 * Build only material closures whose full property set currently resolves from first principles.
 * Reference fixtures remain available through `createReferenceMaterialClosures()` for explicit
 * fixture tests, but production/runtime material resolution must use this stricter set.
 */
export function createFirstPrinciplesMaterialClosures() {
  const candidates = createDerivedMaterialClosures(['h2o', 'fe', 'air', 'h2', 'o2']);
  for (const [material, closure] of Object.entries(candidates)) {
    requireFirstPrinciplesMaterialProperties(closure.properties, {
      material,
      context: 'createFirstPrinciplesMaterialClosures'
    });
  }
  return candidates;
}
