// Manufactured inputs only. The caller supplies its original model module so
// browser checks use the same module instance as the actual thermal consumers.
export function createExtendedPhaseCaloricFixture(thermodynamics) {
  const waterInput = {
    schema: thermodynamics.CONDENSABLE_THERMODYNAMICS_SCHEMA,
    energyBasis: 'specific-enthalpy-at-reference-pressure',
    referenceTemperatureK: 300, referencePressurePa: 3000,
    liquidReferenceEnthalpyJPerKg: -50000, vaporizationReferenceEnthalpyJPerKg: 200000,
    liquidCpJPerKgK: 4000, vaporCpJPerKgK: 4000, liquidDensityKgPerM3: 1000,
    molarMassKgPerMol: 8.314462618 / 100, minTemperatureK: 200, maxTemperatureK: 450,
    maxPressurePa: 2000000, provenance: 'Manufactured three-phase caloric fixture',
    solidCaloric: { referenceTemperatureK: 300, referencePressurePa: 3000,
      fusionEnthalpyJPerKg: 20000, cpJPerKgK: 2000, densityKgPerM3: 1250,
      minTemperatureK: 200, maxTemperatureK: 350, provenance: 'Manufactured solid branch' }
  };
  const gasInput = {
    schema: thermodynamics.IDEAL_GAS_CALORIC_SCHEMA,
    energyBasis: thermodynamics.IDEAL_GAS_CALORIC_ENERGY_BASIS,
    referenceTemperatureK: 300, referencePressurePa: 6000,
    referenceSpecificInternalEnergyJPerKg: 100000, cvJPerKgK: 800,
    molarMassKgPerMol: 8.314462618 / 200, minTemperatureK: 200, maxTemperatureK: 450,
    maxPressurePa: 2000000, provenance: 'Manufactured gas-only caloric fixture'
  };
  const phase = (name, cpJPerKgK, densityKgPerM3, temperatureRange) => ({
    name, cpJPerKgK, densityKgPerM3, temperatureRange,
    bulkModulusPa: name === 'gas' ? null : 2e9,
    shearModulusPa: name === 'solid' ? 1e9 : 0,
    thermalConductivityWPerMK: 0,
    thermalConductivityProvenance: { source: 'Manufactured isolated wall-heating experiment' },
    dynamicViscosityPaS: 0, surfaceTensionNPerM: 0
  });
  const materialProperties = {
    'three-phase': { molarMassKgPerMol: 8.314462618 / 100,
      phases: [phase('solid', 2000, 1250, [0, 300]), phase('liquid', 4000, 1000, [300, 373]),
        phase('gas', 4000, 0.1, [373, 1e6])],
      transitions: [{ from: 'solid', to: 'liquid', temperatureK: 300, latentHeatJPerKg: 20000 },
        { from: 'liquid', to: 'gas', temperatureK: 373, latentHeatJPerKg: 200000 }] },
    'gas-only': { molarMassKgPerMol: 8.314462618 / 200,
      phases: [phase('gas', 1000, 0.1, [0, 1e6])], transitions: [] }
  };
  const particle = (material, phaseId, u, x) => ({ material, massKg: 1, x, v: [0.5, -0.25, 0.125],
    specificInternalEnergyJPerKg: u,
    phaseCaloric: { phaseId, phaseFractions: [1, 2, 3, 4].map((id) => Number(id === phaseId)) } });
  return { waterInput, gasInput, materialProperties,
    condensableThermodynamicsByMaterial: {
      'three-phase': thermodynamics.createCondensableThermodynamics(waterInput),
      'gas-only': thermodynamics.createIdealGasCaloricThermodynamics(gasInput)
    }, particles: [
      particle('three-phase', 1, -50000, [0.25, 1.5, 2]),
      particle('three-phase', 2, -50000, [2, 2, 2]),
      particle('three-phase', 3, -50000, [2, 2.5, 2]),
      particle('gas-only', 3, 50000, [0.25, 3, 2])
    ] };
}
