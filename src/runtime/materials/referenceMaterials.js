// Tagged reference material data for the SPH phase demo thermodynamic preflight.
//
// IMPORTANT: these are *reference fixtures*, not validated first-principles closures.
// They exist so the thermodynamic preflight (energy feasibility gate) can be built and
// tested headlessly. Every value is `closureBacked: false` and carries no scientific /
// full-physics / material / EOS / SPH / phase-change validation. P2 of the demo plan
// replaces this module's constants with MoonLab/Eshkol-derived material closures; the
// preflight contract does not change, only the source of the numbers.

export const REFERENCE_MATERIAL_SCHEMA = 'peercompute.ulg.reference-material-fixture.v0';

export const PHYSICAL_CONSTANTS = Object.freeze({
  gasConstantJPerMolK: 8.314462618,
  avogadroPerMol: 6.02214076e23,
  standardAtmospherePa: 101325
});

// All energies in J/kg, temperatures in K. cp values are treated as cv for the condensed
// phases (incompressible, p dV negligible); the gas uses cv directly because the demo box is
// a sealed rigid (constant-volume) container. Latent heats are 1 atm enthalpy values used as
// internal-energy proxies; this approximation is recorded on the preflight artifact.
export const REFERENCE_MATERIALS = Object.freeze({
  h2o: {
    schema: REFERENCE_MATERIAL_SCHEMA,
    key: 'h2o',
    name: 'water',
    formula: 'H2O',
    molarMassKgPerMol: 0.0180153,
    densityKgPerM3: { solid: 917, liquid: 1000, gas: 0.804 },
    meltingPointK: 273.15,
    boilingPointK: 373.15,
    latentHeatFusionJPerKg: 333550,
    latentHeatVaporizationJPerKg: 2256000,
    cpJPerKgK: { solid: 2090, liquid: 4186, gas: 1996 },
    provenance: {
      source: 'reference-fixture',
      closureBacked: false,
      scientificValidation: false,
      notes: [
        'Standard reference constants for H2O ice/liquid/vapor near 1 atm.',
        'Not derived from a validated MoonLab/Eshkol microphysics closure (demo plan P2).'
      ]
    }
  },
  fe: {
    schema: REFERENCE_MATERIAL_SCHEMA,
    key: 'fe',
    name: 'iron',
    formula: 'Fe',
    molarMassKgPerMol: 0.055845,
    densityKgPerM3: { solid: 7874, liquid: 7000 },
    meltingPointK: 1811,
    latentHeatFusionJPerKg: 247000,
    cpJPerKgK: { solid: 449, liquid: 820 },
    provenance: {
      source: 'reference-fixture',
      closureBacked: false,
      scientificValidation: false,
      notes: [
        'Standard reference constants for solid/liquid Fe.',
        'Not derived from a validated MoonLab/Eshkol microphysics closure (demo plan P2).'
      ]
    }
  },
  air: {
    schema: REFERENCE_MATERIAL_SCHEMA,
    key: 'air',
    name: 'air',
    formula: 'N2-O2-Ar mixture',
    molarMassKgPerMol: 0.0289647,
    cpJPerKgK: 1005,
    cvJPerKgK: 718,
    provenance: {
      source: 'reference-fixture',
      closureBacked: false,
      scientificValidation: false,
      notes: [
        'Dry-air mean molar mass and specific heats near standard conditions.',
        'Sealed rigid box uses cv (constant volume); humidity/condensation deferred to demo plan P5.'
      ]
    }
  }
});

function finitePositive(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new TypeError(`${label} must be a positive finite number`);
  }
  return number;
}

/**
 * Ideal-gas density (kg/m^3) for the air mixture at pressure (Pa) and temperature (K).
 */
export function idealGasDensityKgPerM3({ pressurePa, temperatureK, molarMassKgPerMol } = {}) {
  const p = finitePositive(pressurePa, 'pressurePa');
  const t = finitePositive(temperatureK, 'temperatureK');
  const m = finitePositive(molarMassKgPerMol, 'molarMassKgPerMol');
  return (p * m) / (PHYSICAL_CONSTANTS.gasConstantJPerMolK * t);
}

/**
 * Phase of a material at temperature T. For the demo materials this is solid/liquid/gas for
 * H2O and solid/liquid for Fe; air is always 'gas'.
 */
export function phaseOf(materialKey, temperatureK) {
  const t = Number(temperatureK);
  if (materialKey === 'air') return 'gas';
  if (materialKey === 'h2o') {
    if (t < REFERENCE_MATERIALS.h2o.meltingPointK) return 'solid';
    if (t < REFERENCE_MATERIALS.h2o.boilingPointK) return 'liquid';
    return 'gas';
  }
  if (materialKey === 'fe') {
    return t < REFERENCE_MATERIALS.fe.meltingPointK ? 'solid' : 'liquid';
  }
  throw new Error(`Unknown material key: ${materialKey}`);
}

/**
 * Specific internal energy (J/kg) of a material at temperature T, integrated along the phase
 * path from 0 K using constant per-phase heat capacities plus latent heats at each transition.
 * Only *differences* of this function are physically meaningful (the 0 K base cancels), which
 * is exactly how the preflight uses it (initial vs final / equilibrium states).
 */
export function specificEnergyJPerKg(materialKey, temperatureK) {
  const t = Number(temperatureK);
  if (!Number.isFinite(t)) {
    throw new TypeError('temperatureK must be finite');
  }
  if (materialKey === 'air') {
    return REFERENCE_MATERIALS.air.cvJPerKgK * t;
  }
  if (materialKey === 'h2o') {
    const { meltingPointK: tm, boilingPointK: tb, cpJPerKgK, latentHeatFusionJPerKg, latentHeatVaporizationJPerKg } = REFERENCE_MATERIALS.h2o;
    if (t <= tm) return cpJPerKgK.solid * t;
    let energy = cpJPerKgK.solid * tm + latentHeatFusionJPerKg;
    if (t <= tb) return energy + cpJPerKgK.liquid * (t - tm);
    energy += cpJPerKgK.liquid * (tb - tm) + latentHeatVaporizationJPerKg;
    return energy + cpJPerKgK.gas * (t - tb);
  }
  if (materialKey === 'fe') {
    const { meltingPointK: tm, cpJPerKgK, latentHeatFusionJPerKg } = REFERENCE_MATERIALS.fe;
    if (t <= tm) return cpJPerKgK.solid * t;
    return cpJPerKgK.solid * tm + latentHeatFusionJPerKg + cpJPerKgK.liquid * (t - tm);
  }
  throw new Error(`Unknown material key: ${materialKey}`);
}

/**
 * Energy (J/kg) released or absorbed moving a material from one temperature to another along
 * its phase path. Positive means energy must be *added* (absorbed) to reach `toK`.
 */
export function specificEnergyDeltaJPerKg(materialKey, fromK, toK) {
  return specificEnergyJPerKg(materialKey, toK) - specificEnergyJPerKg(materialKey, fromK);
}
