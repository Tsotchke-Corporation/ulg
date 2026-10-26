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
// interfaces, nonideal gas interactions and surface energy. An optional solid
// caloric branch shares the liquid energy zero through a declared fusion
// enthalpy; this does not supply a melting/sublimation equilibrium or rate law.

export const CONDENSABLE_THERMODYNAMICS_SCHEMA =
  'peercompute.ulg.condensable-thermodynamics.v1';
export const CONDENSABLE_ENTHALPY_REFERENCE_BASIS =
  'specific-enthalpy-at-reference-pressure';
export const CONDENSABLE_UNIVERSAL_GAS_CONSTANT_J_PER_MOL_K = 8.314462618;
export const IDEAL_GAS_CALORIC_SCHEMA = 'peercompute.ulg.ideal-gas-caloric.v1';
export const IDEAL_GAS_CALORIC_ENERGY_BASIS = 'specific-internal-energy-at-reference-temperature';

const models = new WeakSet();

const commonInputFields = ['schema', 'energyBasis', 'provenance', 'molarMassKgPerMol',
  'referenceTemperatureK', 'referencePressurePa', 'minTemperatureK', 'maxTemperatureK', 'maxPressurePa'];
function caloricInputFields(record, fields) {
  if (!record || typeof record !== 'object' || Array.isArray(record)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(record))) {
    throw new TypeError('Phase caloric input must be a plain data record');
  }
  for (const key of Reflect.ownKeys(record)) {
    if (!fields.includes(key) || !Object.hasOwn(Object.getOwnPropertyDescriptor(record, key), 'value')) {
      throw new TypeError('Unsupported phase caloric input field: ' + String(key));
    }
  }
}

// Cold reconstruction after JSON/structured clone. Only the authored inputs
// cross the worker boundary; derived fields and private model identity do not.
// This is a new local model declaration, never a retained-state capability.
export function createPhaseCaloricThermodynamics(record) {
  caloricInputFields(record, [...commonInputFields, 'liquidReferenceEnthalpyJPerKg',
    'vaporizationReferenceEnthalpyJPerKg', 'liquidCpJPerKgK', 'vaporCpJPerKgK',
    'liquidDensityKgPerM3', 'solidCaloric', 'cvJPerKgK', 'referenceSpecificInternalEnergyJPerKg']);
  if (record?.schema === CONDENSABLE_THERMODYNAMICS_SCHEMA) {
    caloricInputFields(record, [...commonInputFields, 'liquidReferenceEnthalpyJPerKg',
      'vaporizationReferenceEnthalpyJPerKg', 'liquidCpJPerKgK', 'vaporCpJPerKgK',
      'liquidDensityKgPerM3', 'solidCaloric']);
    if (record.solidCaloric !== undefined) caloricInputFields(record.solidCaloric,
      ['referenceTemperatureK', 'referencePressurePa', 'fusionEnthalpyJPerKg', 'cpJPerKgK',
        'densityKgPerM3', 'minTemperatureK', 'maxTemperatureK', 'provenance']);
    return createCondensableThermodynamics(record);
  }
  if (record?.schema === IDEAL_GAS_CALORIC_SCHEMA) {
    caloricInputFields(record, [...commonInputFields, 'cvJPerKgK', 'referenceSpecificInternalEnergyJPerKg']);
    return createIdealGasCaloricThermodynamics(record);
  }
  throw new TypeError('Unsupported phase caloric input schema');
}

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
  if (record.solidCaloric !== undefined) {
    const input = record.solidCaloric;
    if (!input || typeof input !== 'object' || Array.isArray(input)
      || typeof input.provenance !== 'string' || !input.provenance.trim()) {
      throw new TypeError('Explicit solid caloric inputs and provenance required');
    }
    const solid = { phase: 'solid', provenance: input.provenance };
    for (const key of ['referenceTemperatureK', 'referencePressurePa', 'fusionEnthalpyJPerKg',
      'cpJPerKgK', 'densityKgPerM3', 'minTemperatureK', 'maxTemperatureK']) {
      solid[key] = positive(input[key], `solidCaloric.${key}`);
    }
    if (!(solid.minTemperatureK < solid.maxTemperatureK)
      || solid.referenceTemperatureK < solid.minTemperatureK || solid.referenceTemperatureK > solid.maxTemperatureK
      || solid.referenceTemperatureK < model.minTemperatureK || solid.referenceTemperatureK > model.maxTemperatureK
      || solid.referencePressurePa > model.maxPressurePa) {
      throw new RangeError('Fusion reference must be inside both declared phase domains');
    }
    // h_s(Tm,Pm) = h_l(Tm,Pm) - L_f; u_s = h_s - Pm/rho_s.
    // Do not mistake enthalpy of fusion for an internal-energy jump.
    const liquidU = model.liquidReferenceInternalEnergyJPerKg
      + model.liquidCvJPerKgK * (solid.referenceTemperatureK - model.referenceTemperatureK);
    solid.referenceInternalEnergyJPerKg = finite(liquidU
      + solid.referencePressurePa * (model.liquidSpecificVolumeM3PerKg - 1 / solid.densityKgPerM3)
      - solid.fusionEnthalpyJPerKg, 'solid reference internal energy');
    solid.cvJPerKgK = solid.cpJPerKgK;
    solid.energyMinJPerKg = finite(solid.referenceInternalEnergyJPerKg
      + solid.cvJPerKgK * (solid.minTemperatureK - solid.referenceTemperatureK), 'solid minimum U');
    solid.energyMaxJPerKg = finite(solid.referenceInternalEnergyJPerKg
      + solid.cvJPerKgK * (solid.maxTemperatureK - solid.referenceTemperatureK), 'solid maximum U');
    if (!(solid.energyMinJPerKg < solid.energyMaxJPerKg)) throw new RangeError('Collapsed solid caloric domain');
    model.solidCaloric = Object.freeze(solid);
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
  return models.has(model) && model.schema === CONDENSABLE_THERMODYNAMICS_SCHEMA;
}

/** A gas-only caloric model has no fictitious liquid branch or latent heat. */
export function createIdealGasCaloricThermodynamics(record) {
  if (record?.schema !== IDEAL_GAS_CALORIC_SCHEMA || record.energyBasis !== IDEAL_GAS_CALORIC_ENERGY_BASIS
    || typeof record.provenance !== 'string' || !record.provenance.trim()) {
    throw new TypeError('Explicit ideal-gas caloric schema, energy basis and provenance required');
  }
  const model = { schema: IDEAL_GAS_CALORIC_SCHEMA, energyBasis: record.energyBasis,
    model: 'constant-cv-ideal-gas-only', provenance: record.provenance,
    scientificValidation: false, liveStateEnrollment: false };
  for (const key of ['molarMassKgPerMol', 'referenceTemperatureK', 'referencePressurePa',
    'minTemperatureK', 'maxTemperatureK', 'maxPressurePa']) model[key] = positive(record[key], key);
  model.vaporCvJPerKgK = positive(record.cvJPerKgK, 'cvJPerKgK');
  model.vaporReferenceInternalEnergyJPerKg = finite(record.referenceSpecificInternalEnergyJPerKg,
    'referenceSpecificInternalEnergyJPerKg');
  if (!(model.minTemperatureK < model.maxTemperatureK)
    || model.referenceTemperatureK < model.minTemperatureK || model.referenceTemperatureK > model.maxTemperatureK
    || model.referencePressurePa > model.maxPressurePa) throw new RangeError('Gas reference must be inside its declared domain');
  model.specificGasConstantJPerKgK = positive(CONDENSABLE_UNIVERSAL_GAS_CONSTANT_J_PER_MOL_K
    / model.molarMassKgPerMol, 'gas specific R');
  model.vaporCpJPerKgK = positive(model.vaporCvJPerKgK + model.specificGasConstantJPerKgK, 'gas Cp');
  for (const [bound, temperatureK] of [['Min', model.minTemperatureK], ['Max', model.maxTemperatureK]]) {
    model[`vaporEnergy${bound}JPerKg`] = finite(model.vaporReferenceInternalEnergyJPerKg
      + model.vaporCvJPerKgK * (temperatureK - model.referenceTemperatureK), `gas ${bound} U`);
  }
  if (!(model.vaporEnergyMinJPerKg < model.vaporEnergyMaxJPerKg)) throw new RangeError('Collapsed gas caloric domain');
  positive(model.referencePressurePa / (model.specificGasConstantJPerKgK * model.referenceTemperatureK), 'gas reference density');
  models.add(model);
  return Object.freeze(model);
}

export function isPhaseCaloricThermodynamics(model) { return models.has(model); }
export function isIdealGasCaloricThermodynamics(model) {
  return models.has(model) && model.schema === IDEAL_GAS_CALORIC_SCHEMA;
}

// One phase roster drives cold packing, thermal graphs, and gas admission.
// Phase is selected explicitly even when two energy intervals overlap.
export function phaseCaloricBranches(model) {
  if (!models.has(model)) throw new TypeError('Original created phase caloric model required');
  const phases = isCondensableThermodynamics(model) ? ['liquid', 'gas'] : ['gas'];
  const rows = phases.map((phase) => {
    const prefix = phase === 'gas' ? 'vapor' : 'liquid';
    return Object.freeze({ phase, referenceTemperatureK: model.referenceTemperatureK,
      referenceInternalEnergyJPerKg: model[`${prefix}ReferenceInternalEnergyJPerKg`],
      cpJPerKgK: model[`${prefix}CpJPerKgK`], cvJPerKgK: model[`${prefix}CvJPerKgK`],
      energyMinJPerKg: model[`${prefix}EnergyMinJPerKg`], energyMaxJPerKg: model[`${prefix}EnergyMaxJPerKg`],
      minTemperatureK: model.minTemperatureK, maxTemperatureK: model.maxTemperatureK,
      densityKgPerM3: phase === 'gas'
        ? model.referencePressurePa / (model.specificGasConstantJPerKgK * model.referenceTemperatureK)
        : model.liquidDensityKgPerM3 });
  });
  if (model.solidCaloric) rows.unshift(model.solidCaloric);
  return Object.freeze(rows);
}

// Sensible-energy continuation on an explicitly selected phase branch. Energy
// alone must not select the phase in a mixed gas: phase exchange belongs to a
// separate equilibrium/kinetic authority. This is not yet installed into the
// legacy thermal or reaction writers.
export function resolveCondensableCaloricState(model, {
  phase, specificInternalEnergyJPerKg, totalPressurePa
} = {}) {
  if (!models.has(model)) throw new TypeError('Created condensable thermodynamic model required');
  if (isIdealGasCaloricThermodynamics(model) || phase === 'solid') {
    const branch = phaseCaloricBranches(model).find((row) => row.phase === phase);
    if (!branch) throw new TypeError('Explicit enrolled caloric phase required');
    finite(specificInternalEnergyJPerKg, 'specificInternalEnergyJPerKg');
    finite(totalPressurePa, 'totalPressurePa');
    if (specificInternalEnergyJPerKg < branch.energyMinJPerKg || specificInternalEnergyJPerKg > branch.energyMaxJPerKg
      || totalPressurePa < 0 || totalPressurePa > model.maxPressurePa) throw new RangeError('State outside declared caloric domain');
    const temperatureK = specificInternalEnergyJPerKg === branch.energyMinJPerKg ? branch.minTemperatureK
      : specificInternalEnergyJPerKg === branch.energyMaxJPerKg ? branch.maxTemperatureK
        : branch.referenceTemperatureK + (specificInternalEnergyJPerKg - branch.referenceInternalEnergyJPerKg) / branch.cvJPerKgK;
    return Object.freeze({ phase, temperatureK, specificInternalEnergyJPerKg, cvJPerKgK: branch.cvJPerKgK,
      energyMinJPerKg: branch.energyMinJPerKg, energyMaxJPerKg: branch.energyMaxJPerKg,
      specificEnthalpyJPerKg: finite(specificInternalEnergyJPerKg + (phase === 'gas'
        ? model.specificGasConstantJPerKgK * temperatureK : totalPressurePa / branch.densityKgPerM3), 'specific enthalpy') });
  }
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
  if (!isCondensableThermodynamics(model)) throw new TypeError('Created condensable thermodynamic model required');
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
