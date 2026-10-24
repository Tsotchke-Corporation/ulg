// Explicit reduced thermodynamics for the condensation reference solver. This
// is NOT an adapter for the legacy cpJPerKgK / latentHeatJPerKg energy ladder:
// those fields have mixed Cp/Cv and H/U conventions. No existing state is
// rebased, and no material is enrolled in live phase evolution by this module.
//
// Model: constant Cp, ideal vapor, incompressible liquid, pure coexistence at
// (T0,P0). h, u and saturation follow the SAME reference Gibbs potentials.
// Ideal-gas relations: https://cantera.org/3.1/cxx/d7/dfa/classCantera_1_1IdealGasPhase.html
// Constant-Cp integration: https://cantera.org/3.1/reference/thermo/species-thermo.html
// Parameters and their validity limits are explicit inputs, not calibrated
// material data or a claim of IAPWS accuracy. This model omits curved/solute
// interfaces, nonideal gas interactions, ice and surface energy.

export const CONDENSABLE_THERMODYNAMICS_SCHEMA =
  'peercompute.ulg.condensable-thermodynamics.v1';
export const CONDENSABLE_ENTHALPY_REFERENCE_BASIS =
  'specific-enthalpy-at-reference-pressure';
export const CONDENSABLE_UNIVERSAL_GAS_CONSTANT_J_PER_MOL_K = 8.314462618;

const models = new WeakSet();

function finite(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number`);
  }
  return value;
}

function positive(value, name) {
  if (!(finite(value, name) > 0)) throw new RangeError(`${name} must be positive`);
  return value;
}

export function createCondensableThermodynamics(record) {
  if (record?.schema !== CONDENSABLE_THERMODYNAMICS_SCHEMA
    || record.energyBasis !== CONDENSABLE_ENTHALPY_REFERENCE_BASIS) {
    throw new TypeError('Explicit condensable schema and enthalpy reference basis required');
  }
  if (typeof record.provenance !== 'string' || !record.provenance.trim()) {
    throw new TypeError('Condensable reference provenance required');
  }
  const model = {
    schema: CONDENSABLE_THERMODYNAMICS_SCHEMA,
    energyBasis: CONDENSABLE_ENTHALPY_REFERENCE_BASIS,
    model: 'constant-cp-ideal-vapor-incompressible-liquid',
    provenance: record.provenance,
    scientificValidation: false,
    liveStateEnrollment: false
  };
  for (const key of [
    'referenceTemperatureK', 'referencePressurePa',
    'vaporizationReferenceEnthalpyJPerKg', 'liquidCpJPerKgK',
    'vaporCpJPerKgK', 'liquidDensityKgPerM3', 'molarMassKgPerMol',
    'minTemperatureK', 'maxTemperatureK', 'maxPressurePa'
  ]) model[key] = positive(record[key], key);
  model.liquidReferenceEnthalpyJPerKg = finite(
    record.liquidReferenceEnthalpyJPerKg, 'liquidReferenceEnthalpyJPerKg'
  );
  if (!(model.minTemperatureK < model.maxTemperatureK)
    || model.referenceTemperatureK < model.minTemperatureK
    || model.referenceTemperatureK > model.maxTemperatureK
    || model.maxPressurePa < model.referencePressurePa) {
    throw new RangeError('Reference state must be inside the declared validity domain');
  }
  model.specificGasConstantJPerKgK =
    CONDENSABLE_UNIVERSAL_GAS_CONSTANT_J_PER_MOL_K / model.molarMassKgPerMol;
  model.liquidCvJPerKgK = model.liquidCpJPerKgK;
  model.vaporCvJPerKgK = model.vaporCpJPerKgK - model.specificGasConstantJPerKgK;
  positive(model.specificGasConstantJPerKgK, 'specificGasConstantJPerKgK');
  positive(model.vaporCvJPerKgK, 'vaporCvJPerKgK');
  model.liquidSpecificVolumeM3PerKg = 1 / model.liquidDensityKgPerM3;
  model.liquidReferenceInternalEnergyJPerKg = model.liquidReferenceEnthalpyJPerKg
    - model.referencePressurePa * model.liquidSpecificVolumeM3PerKg;
  model.vaporReferenceInternalEnergyJPerKg = model.liquidReferenceEnthalpyJPerKg
    + model.vaporizationReferenceEnthalpyJPerKg
    - model.specificGasConstantJPerKgK * model.referenceTemperatureK;
  // Compute the gap directly: a large arbitrary common energy zero must not
  // contaminate the latent heat through cancellation of two absolute energies.
  model.vaporizationReferenceInternalEnergyJPerKg =
    model.vaporizationReferenceEnthalpyJPerKg
    - model.specificGasConstantJPerKgK * model.referenceTemperatureK
    + model.referencePressurePa * model.liquidSpecificVolumeM3PerKg;
  for (const key of [
    'liquidSpecificVolumeM3PerKg', 'liquidReferenceInternalEnergyJPerKg',
    'vaporReferenceInternalEnergyJPerKg', 'vaporizationReferenceInternalEnergyJPerKg'
  ]) finite(model[key], key);
  if (!(model.referencePressurePa * model.liquidSpecificVolumeM3PerKg
    < model.specificGasConstantJPerKgK * model.referenceTemperatureK)) {
    throw new RangeError('Reference vapor must be less dense than liquid');
  }
  for (const temperatureK of [model.minTemperatureK, model.maxTemperatureK]) {
    const gap = model.vaporizationReferenceInternalEnergyJPerKg
      + (model.vaporCvJPerKgK - model.liquidCvJPerKgK)
        * (temperatureK - model.referenceTemperatureK);
    positive(gap, 'vaporization internal-energy gap throughout validity domain');
    positive(model.vaporizationReferenceEnthalpyJPerKg
      + (model.vaporCpJPerKgK - model.liquidCpJPerKgK)
        * (temperatureK - model.referenceTemperatureK)
      - model.liquidSpecificVolumeM3PerKg * (model.maxPressurePa - model.referencePressurePa),
    'vaporization enthalpy throughout validity domain');
  }
  for (const phase of ['liquid', 'vapor']) {
    const referenceEnergy = model[`${phase}ReferenceInternalEnergyJPerKg`];
    const cv = model[`${phase}CvJPerKgK`];
    const lo = referenceEnergy + cv * (model.minTemperatureK - model.referenceTemperatureK);
    const hi = referenceEnergy + cv * (model.maxTemperatureK - model.referenceTemperatureK);
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || !(lo < hi)) {
      throw new RangeError('Unrepresentable phase caloric basis or collapsed energy domain');
    }
    model[`${phase}EnergyMinJPerKg`] = lo;
    model[`${phase}EnergyMaxJPerKg`] = hi;
  }
  models.add(model);
  // Positive latent H makes log(Peq) monotone in T and P in this domain.
  // Preflight its corners, and both caloric endpoints, before publishing the
  // model. A finite-looking record is not permission to overflow/underflow.
  try {
    for (const temperatureK of [model.minTemperatureK, model.maxTemperatureK]) {
      for (const totalPressurePa of [0, model.maxPressurePa]) {
        evaluateCondensableThermodynamics(model, { temperatureK, totalPressurePa });
      }
    }
  } catch (cause) {
    models.delete(model);
    throw new RangeError('Unrepresentable thermodynamics in declared validity domain', { cause });
  }
  return Object.freeze(model);
}

export function isCondensableThermodynamics(model) {
  return models.has(model);
}

// Sensible-energy continuation on an explicitly selected phase branch. Energy
// alone must not select the phase in a mixed gas: phase exchange belongs to a
// separate equilibrium/kinetic authority. This is not yet installed into the
// legacy thermal or reaction writers.
export function resolveCondensableCaloricState(model, {
  phase, specificInternalEnergyJPerKg, totalPressurePa
} = {}) {
  if (!models.has(model)) throw new TypeError('Created condensable thermodynamic model required');
  if (phase !== 'liquid' && phase !== 'gas') {
    throw new TypeError('Explicit liquid or gas phase required; no phase inference from energy');
  }
  finite(specificInternalEnergyJPerKg, 'specificInternalEnergyJPerKg');
  const liquid = phase === 'liquid';
  const referenceEnergy = liquid
    ? model.liquidReferenceInternalEnergyJPerKg : model.vaporReferenceInternalEnergyJPerKg;
  const cv = liquid ? model.liquidCvJPerKgK : model.vaporCvJPerKgK;
  const energyMinJPerKg = liquid ? model.liquidEnergyMinJPerKg : model.vaporEnergyMinJPerKg;
  const energyMaxJPerKg = liquid ? model.liquidEnergyMaxJPerKg : model.vaporEnergyMaxJPerKg;
  if (specificInternalEnergyJPerKg < energyMinJPerKg || specificInternalEnergyJPerKg > energyMaxJPerKg) {
    throw new RangeError('Phase-specific energy outside declared caloric domain');
  }
  const temperatureK = specificInternalEnergyJPerKg === energyMinJPerKg ? model.minTemperatureK
    : specificInternalEnergyJPerKg === energyMaxJPerKg ? model.maxTemperatureK
      : model.referenceTemperatureK + (specificInternalEnergyJPerKg - referenceEnergy) / cv;
  const properties = evaluateCondensableThermodynamics(model, { temperatureK, totalPressurePa });
  return Object.freeze({
    phase, temperatureK, specificInternalEnergyJPerKg,
    cvJPerKgK: cv,
    energyMinJPerKg, energyMaxJPerKg,
    specificEnthalpyJPerKg: liquid
      ? properties.liquidSpecificEnthalpyJPerKg : properties.vaporSpecificEnthalpyJPerKg
  });
}

export function evaluateCondensableThermodynamics(model, {
  temperatureK, totalPressurePa
} = {}) {
  if (!models.has(model)) throw new TypeError('Created condensable thermodynamic model required');
  finite(temperatureK, 'temperatureK');
  finite(totalPressurePa, 'totalPressurePa');
  if (temperatureK < model.minTemperatureK || temperatureK > model.maxTemperatureK
    || totalPressurePa < 0 || totalPressurePa > model.maxPressurePa) {
    throw new RangeError('Condensable state outside declared temperature/pressure domain');
  }
  const deltaT = temperatureK - model.referenceTemperatureK;
  const r = model.specificGasConstantJPerKgK;
  const v = model.liquidSpecificVolumeM3PerKg;
  const deltaCp = model.vaporCpJPerKgK - model.liquidCpJPerKgK;
  const liquidSpecificInternalEnergyJPerKg = model.liquidReferenceInternalEnergyJPerKg
    + model.liquidCvJPerKgK * deltaT;
  const vaporSpecificInternalEnergyJPerKg = model.vaporReferenceInternalEnergyJPerKg
    + model.vaporCvJPerKgK * deltaT;
  const vaporizationInternalEnergyJPerKg = model.vaporizationReferenceInternalEnergyJPerKg
    + (model.vaporCvJPerKgK - model.liquidCvJPerKgK) * deltaT;
  const vaporizationEnthalpyJPerKg = model.vaporizationReferenceEnthalpyJPerKg
    + deltaCp * deltaT - v * (totalPressurePa - model.referencePressurePa);
  // Equality of vapor g(T,p_v) and liquid g(T,P_total), including the finite
  // liquid-volume (Poynting) correction. Never substitute total P for p_v.
  const logEquilibriumPressurePa = Math.log(model.referencePressurePa)
    + model.vaporizationReferenceEnthalpyJPerKg / r
      * (deltaT / model.referenceTemperatureK) / temperatureK
    + deltaCp / r * (Math.log1p(deltaT / model.referenceTemperatureK) - deltaT / temperatureK)
    + v * (totalPressurePa - model.referencePressurePa) / (r * temperatureK);
  const equilibriumPressurePa = Math.exp(logEquilibriumPressurePa);
  positive(equilibriumPressurePa, 'equilibriumPressurePa');
  const result = {
    temperatureK, totalPressurePa,
    liquidSpecificInternalEnergyJPerKg, vaporSpecificInternalEnergyJPerKg,
    liquidSpecificEnthalpyJPerKg: liquidSpecificInternalEnergyJPerKg + totalPressurePa * v,
    vaporSpecificEnthalpyJPerKg: vaporSpecificInternalEnergyJPerKg + r * temperatureK,
    vaporizationInternalEnergyJPerKg, vaporizationEnthalpyJPerKg,
    liquidCvJPerKgK: model.liquidCvJPerKgK,
    vaporCvJPerKgK: model.vaporCvJPerKgK,
    logEquilibriumPressurePa, equilibriumPressurePa
  };
  for (const [key, value] of Object.entries(result)) finite(value, key);
  return Object.freeze(result);
}
