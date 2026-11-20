import { CONDENSABLE_THERMODYNAMICS_SCHEMA, IDEAL_GAS_CALORIC_SCHEMA,
  CONDENSABLE_UNIVERSAL_GAS_CONSTANT_J_PER_MOL_K as R,
  createPhaseCaloricThermodynamics, phaseCaloricBranches } from './condensableThermodynamics.js';

const WATER_REFERENCE = 'https://tsapps.nist.gov/publication/get_pdf.cfm?pub_id=906704';

/** Cold, opt-in reference model for the room-air experiment. Existing authored
 * models win. No continuing state or legacy energy is rebased by this helper.
 * Constant heat capacities and incompressible liquid are reduced approximations;
 * the domain is an execution limit, not a claim of IAPWS accuracy throughout it.
 */
export function withRoomAirCaloricReference(closure, material) {
  const properties = closure.properties;
  if (properties.phaseCaloricModel || !['h2o', 'n2', 'o2', 'ar', 'co2', 'h2'].includes(material)) return closure;
  const gas = properties.phases.find(p => p.name === 'gas');
  const molarMassKgPerMol = properties.molarMassKgPerMol;
  const gasCp = material === 'ar' ? 2.5 * R / molarMassKgPerMol : gas.cpJPerKgK;
  let input;
  if (material === 'h2o') {
    const liquid = properties.phases.find(p => p.name === 'liquid');
    const solid = properties.phases.find(p => p.name === 'solid');
    const fusion = properties.transitions.find(t => t.from === 'solid' && t.to === 'liquid');
    input = {
      schema: CONDENSABLE_THERMODYNAMICS_SCHEMA, energyBasis: 'specific-enthalpy-at-reference-pressure',
      referenceTemperatureK: 293.15, referencePressurePa: 2339,
      liquidReferenceEnthalpyJPerKg: 83910, vaporizationReferenceEnthalpyJPerKg: 2453500,
      liquidCpJPerKgK: liquid.cpJPerKgK, vaporCpJPerKgK: gasCp,
      liquidDensityKgPerM3: liquid.densityKgPerM3, molarMassKgPerMol,
      // Execution domain, shared by the liquid and vapor branches. Vapor next
      // to molten iron and hot oxide exceeds 600 K (it absorbs their
      // radiation); past the domain a row resolves to missing properties
      // (status 255), the ActiveSource classifier rejects it and the spatial
      // directory and contact fail closed for the rest of the run. With the
      // bank's constant Cps the vaporization internal-energy gap reaches zero
      // near 1198 K, so the reduced model is self-consistent only below that;
      // 1100 K keeps ~250 kJ/kg of gap. Liquid is bounded physically by the
      // boiling plateau (~485 K at maxPressurePa).
      // The lower bound admits transient supercooling: meltwater touching
      // colder ice drops below T_f within a step before the phase-carrier
      // transfer's bulk fusion freezes it back at T_f (fusion stays at 273.15 K,
      // inside both branches).
      minTemperatureK: 233.15, maxTemperatureK: 1100, maxPressurePa: 2e6,
      provenance: `NIST steam tables at 20 C: p=0.002339 MPa, h_l=83.91 kJ/kg, h_fg=2453.5 kJ/kg (${WATER_REFERENCE}). Constant Cp and liquid density from material-property-reference-bank; reduced ideal vapor/incompressible liquid model.`,
      solidCaloric: { referenceTemperatureK: fusion.temperatureK, referencePressurePa: 101325,
        fusionEnthalpyJPerKg: fusion.latentHeatJPerKg, cpJPerKgK: solid.cpJPerKgK,
        densityKgPerM3: solid.densityKgPerM3, minTemperatureK: 200, maxTemperatureK: 600,
        provenance: 'material-property-reference-bank ice/fusion reference; sensible solid branch sharing the liquid enthalpy zero, without a melting-rate claim' }
    };
  } else {
    const cv = gasCp - R / molarMassKgPerMol;
    input = { schema: IDEAL_GAS_CALORIC_SCHEMA,
      energyBasis: 'specific-internal-energy-at-reference-temperature',
      referenceTemperatureK: 293.15, referencePressurePa: 101325, molarMassKgPerMol,
      cvJPerKgK: cv, referenceSpecificInternalEnergyJPerKg: cv * 293.15,
      minTemperatureK: 200, maxTemperatureK: 1200, maxPressurePa: 2e6,
      provenance: `${material}: constant ideal-gas Cv; ${material === 'ar' ? 'monatomic equipartition Cp=5R/2' : 'Cp from the existing material closure'}; explicit sensible energy convention u=Cv*T (not chemical formation enthalpy).` };
  }
  const model = createPhaseCaloricThermodynamics(input);
  const branches = phaseCaloricBranches(model);
  const overridePaths = branches.flatMap(b => [`phases.${b.phase}.cpJPerKgK`, `phases.${b.phase}.densityKgPerM3`]);
  return { ...closure, properties: { ...properties, phaseCaloricModel: input,
    phases: properties.phases.map(p => {
      const b = branches.find(row => row.phase === p.name);
      return b ? { ...p, cpJPerKgK: b.cpJPerKgK, densityKgPerM3: b.densityKgPerM3 } : p;
    }),
    propertyProvenance: { ...properties.propertyProvenance,
      entries: [...(properties.propertyProvenance?.entries ?? []).map(entry => ({ ...entry,
        paths: entry.paths.filter(path => !overridePaths.includes(path)) })).filter(entry => entry.paths.length),
      { paths: [...overridePaths, 'phaseCaloricModel'], status: 'reference-fallback',
        source: 'material-property-reference-bank', method: input.provenance,
        inputs: [material, ...(material === 'h2o' ? [WATER_REFERENCE] : [])],
        accuracy: 'reduced-constant-cp-reference-model', blockers: [] }] },
    roomAirCaloricReference: { version: 1, scientificValidation: false, reference: input.provenance }
  } };
}
