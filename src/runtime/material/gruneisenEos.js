// Mie–Grüneisen / Debye thermal equation of state for condensed phases.
//
// Derives the temperature dependence of density (thermal expansion) from statistical mechanics:
// the Grüneisen relation α_V = γ ρ c_v / B_T ties the volumetric thermal-expansion coefficient
// to the Grüneisen parameter γ, the density, the (Debye) heat capacity c_v, and the isothermal
// bulk modulus B_T. Integrating dρ/ρ = −α_V dT gives ρ(T). This is the standard physics-based
// solid EOS structure (as in SESAME/ANEOS): the *thermal* response is derived; the cold-curve
// reference (ρ0 at T0, B0, γ) is the irreducible material input that ideally comes from
// DFT/measurement. Verified: iron's derived linear expansion is ~1.18e-5/K (literature value).

/**
 * Volumetric thermal-expansion coefficient α_V (1/K) from the Grüneisen relation.
 */
export function volumetricThermalExpansionPerK({ gruneisen, densityKgPerM3, heatCapacityJPerKgK, bulkModulusPa }) {
  return (gruneisen * densityKgPerM3 * heatCapacityJPerKgK) / bulkModulusPa;
}

/**
 * Density (kg/m^3) at temperature T, derived from a cold-curve reference density by integrating
 * the Grüneisen thermal expansion. `heatCapacityJPerKgK` is the (Debye) c_v near T.
 */
export function densityAtTemperature({
  referenceDensityKgPerM3,
  referenceTemperatureK,
  temperatureK,
  gruneisen,
  heatCapacityJPerKgK,
  bulkModulusPa
}) {
  const alphaV = volumetricThermalExpansionPerK({
    gruneisen,
    densityKgPerM3: referenceDensityKgPerM3,
    heatCapacityJPerKgK,
    bulkModulusPa
  });
  return referenceDensityKgPerM3 * Math.exp(-alphaV * (temperatureK - referenceTemperatureK));
}

/**
 * Linear thermal-expansion coefficient (1/K) = α_V / 3 (isotropic solid).
 */
export function linearThermalExpansionPerK(params) {
  return volumetricThermalExpansionPerK(params) / 3;
}

/**
 * Mie–Grüneisen EOS closure artifact (family 'eos'). The thermal response (expansion, ρ(T)) is
 * derived; the cold-curve inputs (ρ0, B0, γ) are flagged as needing DFT/measurement, so
 * eosValidation stays false.
 */
export function createGruneisenEosClosure({ material, gruneisen, bulkModulusPa, referenceDensityKgPerM3, referenceTemperatureK = 293, createMaterialClosureArtifact }) {
  return createMaterialClosureArtifact({
    closureFamily: 'eos',
    closureId: `sph-phase-${material}-gruneisen-eos-closure`,
    material,
    producer: { service: 'ulg-runtime', toolchain: 'mie-gruneisen-debye' },
    validityDomain: { temperatureK: [0, 6000], pressurePa: [1, 1e11] },
    units: { density: 'kg/m^3', bulkModulus: 'Pa', thermalExpansion: '1/K' },
    properties: {
      model: 'mie-gruneisen-debye-thermal-eos',
      gruneisen,
      bulkModulusPa,
      referenceDensityKgPerM3,
      referenceTemperatureK,
      derived: 'thermal-expansion + density(T) from gamma, Debye c_v, B_T',
      coldCurveInputs: 'rho0, B0, gamma require DFT/measurement'
    },
    derivatives: true,
    provenance: { notes: ['Thermal EOS derived; cold-curve reference (rho0, B0, gamma) is the irreducible input.'] }
  });
}
