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
import { REFERENCE_MATERIALS } from '../materials/referenceMaterials.js';
import { createH2OMicrophysicsReference, microphysicsInputRef } from './microphysicsReferences.js';
import {
  atomicNumberDensity,
  debyeTemperatureFromSoundSpeed,
  gasMixtureThermal
} from './statisticalMechanics.js';
import { latentHeatOfFusionJPerKg } from './phaseTransitions.js';

const OPEN_TOP_K = 1e6;

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
  }[materialKey];
  return [{ schema: pending, status: 'pending-not-yet-produced' }];
}

function materialProperties(materialKey) {
  const m = REFERENCE_MATERIALS[materialKey];
  if (materialKey === 'h2o') {
    return {
      molarMassKgPerMol: m.molarMassKgPerMol,
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
    };
  }
  if (materialKey === 'fe') {
    // Solid iron heat capacity is the first-principles Debye model (θ_D derived from sound speed
    // + atomic density); the constant cpJPerKgK is kept as the Dulong–Petit high-T fallback.
    return {
      molarMassKgPerMol: m.molarMassKgPerMol,
      atomsPerFormula: 1,
      heatCapacityModel: { solid: 'debye', liquid: 'constant-reference' },
      densityModel: { solid: 'gruneisen-debye-thermal-expansion', liquid: 'constant-reference' },
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
    };
  }
  if (materialKey === 'air') {
    // Sealed rigid (constant-volume) box: the gas uses cv (equipartition-derived) as its
    // effective heat capacity; density follows the ideal-gas law (computed from P,T at sample
    // time), not a constant. Heat capacity + molar mass are first-principles, not tabulated.
    return {
      molarMassKgPerMol: AIR_THERMAL.molarMassKgPerMol,
      idealGas: true,
      heatCapacityModel: { gas: 'equipartition' },
      phases: [
        { name: 'gas', cpJPerKgK: AIR_THERMAL.cvJPerKgK, densityKgPerM3: null, temperatureRange: [0, OPEN_TOP_K] }
      ],
      transitions: []
    };
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
  const validityDomain = {
    temperatureK: VALIDITY_TEMPERATURE_K[materialKey],
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
    provenance: {
      source: 'reference-fixture',
      notes: [`Reference-fixture material closure for ${materialKey}; microphysics refs: ${microphysicsRefsFor(materialKey).map((r) => `${r.schema}:${r.status}`).join(', ')}.`]
    }
  });
  // Augment with the fields ClosureRegistry needs (identity + validity envelope + execution).
  const inputHash = hashPayload({ material: materialKey, family: 'material', source: 'reference-fixture' });
  const methodHash = hashPayload({ properties });
  return {
    ...base,
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
    air: buildMaterialClosure('air')
  };
}
