import {
  CONDENSABLE_UNIVERSAL_GAS_CONSTANT_J_PER_MOL_K as R,
  evaluateCondensableThermodynamics,
  isCondensableThermodynamics
} from './condensableThermodynamics.js';

// Binary64 reference for a STATIONARY, pure-liquid kinetic interface. Incoming
// populations are surface-side half-Maxwellians with negligible drift and
// equilibrated internal modes. They are NOT arbitrary SS cell/far-field means.
// No air, nuclei, transport coefficients, timestep or physical N is inferred.
//
// Hric & Halama (2023), DOI 10.14311/TPFM.2023.008, equations 9–16:
// https://tpfm.it.cas.cz/fm2015/im/admin/showfile/data/my/Papers/2023/08-TPFM2023.pdf
// The zero-drift ideal-gas limit transports u(T)+R_s*T/2 per unit effusing
// mass, NOT continuum enthalpy. Our explicit total-energy accommodation model
// interpolates elastic and fully thermalized reflection of UNRETAINED gas.
// We do not implement that paper's Grad/continuum/wet-bulb closure here.
//
// These are molecular fluxes and fixed-N geometric derivatives only. A moving
// boundary/stress-work closure must precede any bulk-temperature derivative,
// finite cell update or GPU write. In particular, do not append P*dm/rho,
// Fourier heat or a second latent L*dm to these fluxes by analogy.
export const CONDENSABLE_INTERFACE_KINETICS_SCHEMA =
  'peercompute.ulg.condensable-interface-kinetics.v1';

const models = new WeakSet();
const UINT64_MAX = (1n << 64n) - 1n;
const finite = (value, label) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be finite`);
  }
  return value;
};
const positive = (value, label) => {
  if (!(finite(value, label) > 0)) throw new RangeError(`${label} must be positive`);
  return value;
};
const nonnegative = (value, label) => {
  if (finite(value, label) < 0) throw new RangeError(`${label} must be nonnegative`);
  return value;
};
const text = (value, label) => {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${label} is required`);
  return value;
};
const coefficient = (value, label) => {
  if (nonnegative(value, label) > 1) throw new RangeError(`${label} must be in [0,1]`);
  return value;
};
const array = (value, label) => {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an explicit array`);
  return value;
};
function temperature(value, lo, hi, label) {
  if (finite(value, label) < lo || value > hi) throw new RangeError(`${label} outside model domain`);
  return value;
}
function coveringDomain(record, thermo, label) {
  const minTemperatureK = positive(record?.minTemperatureK, `${label}.minTemperatureK`);
  const maxTemperatureK = positive(record?.maxTemperatureK, `${label}.maxTemperatureK`);
  if (minTemperatureK > thermo.minTemperatureK || maxTemperatureK < thermo.maxTemperatureK) {
    throw new RangeError(`${label} must cover the liquid temperature domain`);
  }
  return { minTemperatureK, maxTemperatureK };
}
function classicalCv(cv, rs, label) {
  positive(cv, label);
  if (cv < 1.5 * rs) throw new RangeError(`${label} cannot omit classical translational energy`);
  return cv;
}

export function createCondensableInterfaceKinetics(record) {
  if (record?.schema !== CONDENSABLE_INTERFACE_KINETICS_SCHEMA
    || !isCondensableThermodynamics(record.thermodynamics)) {
    throw new TypeError('Explicit interface schema and original condensable model required');
  }
  const thermodynamics = record.thermodynamics;
  classicalCv(thermodynamics.vaporCvJPerKgK,
    thermodynamics.specificGasConstantJPerKgK, 'vapor Cv');
  const surface = record.surface;
  if (surface?.schema !== 'peercompute.ulg.linear-pure-interface.v1') {
    throw new TypeError('Explicit linear pure-interface model required');
  }
  const surfaceModel = Object.freeze({
    schema: surface.schema,
    provenance: text(surface.provenance, 'surface provenance'),
    ...coveringDomain(surface, thermodynamics, 'surface'),
    interceptNPerM: positive(surface.interceptNPerM, 'surface intercept'),
    slopeNPerMK: finite(surface.slopeNPerMK, 'surface slope')
  });
  for (const t of [surfaceModel.minTemperatureK, surfaceModel.maxTemperatureK]) {
    positive(surfaceModel.interceptNPerM + surfaceModel.slopeNPerMK * t, 'surface tension');
  }
  const ids = new Set();
  const noncondensables = array(record.noncondensables, 'noncondensables').map((gas) => {
    const id = text(gas?.id, 'gas id');
    if (ids.has(id)) throw new TypeError('Duplicate noncondensable id');
    ids.add(id);
    const molarMassKgPerMol = positive(gas.molarMassKgPerMol, 'gas molar mass');
    const specificGasConstantJPerKgK = positive(R / molarMassKgPerMol, 'gas specific R');
    return Object.freeze({
      id, molarMassKgPerMol, specificGasConstantJPerKgK,
      cvJPerKgK: classicalCv(gas.cvJPerKgK, specificGasConstantJPerKgK, 'gas Cv'),
      ...coveringDomain(gas, thermodynamics, 'gas'),
      energyAccommodationCoefficient: coefficient(gas.energyAccommodationCoefficient, 'gas accommodation'),
      provenance: text(gas.provenance, 'gas provenance')
    });
  });
  const model = Object.freeze({
    schema: CONDENSABLE_INTERFACE_KINETICS_SCHEMA,
    thermodynamics, surface: surfaceModel,
    // Independent kinetic-input domain, not the thermodynamic model's LIQUID
    // pressure bound. Checked over all arrivals, invariant to row partition.
    maxIncidentPressurePa: positive(record.maxIncidentPressurePa, 'maximum incident pressure'),
    massAccommodationCoefficient: coefficient(record.massAccommodationCoefficient, 'mass accommodation'),
    vaporEnergyAccommodationCoefficient: coefficient(
      record.vaporEnergyAccommodationCoefficient, 'vapor energy accommodation'),
    noncondensables: Object.freeze(noncondensables),
    provenance: text(record.provenance, 'interface provenance'),
    liveStateEnrollment: false, scientificValidation: false
  });
  models.add(model);
  return model;
}

export function isCondensableInterfaceKinetics(model) {
  return models.has(model);
}

// Compensated accumulation retains small/cancelling heat contributions from
// distinct actual temperatures. This is not a promise of exact mass storage
// on the GPU; a future finite update needs its own inventoried precision model.
function sum(values) {
  let total = 0, correction = 0;
  for (const value of values) {
    finite(value, 'rate contribution');
    const next = finite(total + value, 'rate sum');
    correction += Math.abs(total) >= Math.abs(value) ? (total - next) + value : (value - next) + total;
    total = next;
  }
  return finite(total + correction, 'compensated rate sum');
}
// Keep powers of two separate until the final rounding. Multiplying alpha*A
// first can underflow even when alpha*A*p/v_th is representably nonzero; the
// same issue affects tiny accommodation coefficients before heat capacity.
function product(values, label) {
  for (const value of values) finite(value, label);
  if (values.some((value) => value === 0)) return 0;
  let mantissa = 1, exponent = 0, sign = 1;
  for (const value of values) {
    if (value < 0) sign = -sign;
    const magnitude = Math.abs(value);
    // log2(MAX_VALUE) rounds to 1024; 2^1024 is not representable.
    const power = Math.min(1023, Math.floor(Math.log2(magnitude)));
    mantissa *= magnitude / 2 ** power;
    exponent += power;
    if (mantissa >= 2) { mantissa *= 0.5; exponent += 1; }
    if (mantissa < 1) { mantissa *= 2; exponent -= 1; }
  }
  const result = exponent < -1022
    ? (mantissa * 2 ** (exponent + 1074)) * Number.MIN_VALUE
    : mantissa * 2 ** exponent;
  positive(result, `representable ${label}`);
  return sign * result;
}
const thermalSpeed = (rs, t) => positive(Math.sqrt(2 * Math.PI) * Math.sqrt(rs) * Math.sqrt(t), 'thermal speed');
function incidentRate(area, pressure, rs, t) {
  return product([area, pressure, 1 / thermalSpeed(rs, t)], 'incident mass rate');
}

export function evaluateCondensableInterfaceRates(model, state = {}) {
  if (!models.has(model)) throw new TypeError('Original created interface model required');
  const thermo = model.thermodynamics;
  const ml = positive(state.liquidMassKg, 'liquid mass');
  const count = state.physicalDropletCount;
  if (typeof count !== 'bigint' || count <= 0n || count > UINT64_MAX) {
    throw new TypeError('Physical droplet count must be an explicit positive u64 BigInt');
  }
  const tl = temperature(state.liquidTemperatureK,
    thermo.minTemperatureK, thermo.maxTemperatureK, 'liquid temperature');
  const stress = nonnegative(state.gasNormalStressPa, 'gas normal stress');
  const rho = thermo.liquidDensityKgPerM3, rs = thermo.specificGasConstantJPerKgK;
  const logRadius = (Math.log(ml) - Math.log(rho) - Math.log(Number(count))
    + Math.log(3 / (4 * Math.PI))) / 3;
  const radiusM = positive(Math.exp(logRadius), 'radius');
  const surfaceAreaM2 = positive(Math.exp(Math.log(4 * Math.PI) + Math.log(Number(count))
    + 2 * logRadius), 'surface area');
  const sigma = positive(model.surface.interceptNPerM + model.surface.slopeNPerMK * tl, 'surface tension');
  // Mechanical normal stress is explicit. It need not equal the sum of the
  // parameters describing incoming half-range distributions. Laplace pressure
  // enters the existing liquid chemical potential exactly once (Kelvin/Poynting).
  const liquidPressurePa = finite(stress + 2 * sigma / radiusM, 'liquid pressure');
  const props = evaluateCondensableThermodynamics(thermo,
    { temperatureK: tl, totalPressurePa: liquidPressurePa });
  const equilibriumVaporPressurePa = props.equilibriumPressurePa;
  const alpha = model.massAccommodationCoefficient, beta = model.vaporEnergyAccommodationCoefficient;
  const effusiveCv = finite(thermo.vaporCvJPerKgK + 0.5 * rs, 'effusive heat capacity');
  // Use the directly evaluated phase gap, never subtraction of two huge energy
  // zeros. Flux plus gauge*massRate reconstructs absolute molecular energy.
  const emittedCenteredSpecificEnergy = finite(thermo.vaporizationReferenceInternalEnergyJPerKg
    + thermo.vaporCvJPerKgK * (tl - thermo.referenceTemperatureK) + 0.5 * rs * tl,
  'emitted centered specific energy');
  const ids = new Set();
  const equivalentPressures = [], captureTemperatureHeat = [], incidentPressures = [];
  const incidentPopulations = array(state.vaporPopulations, 'vaporPopulations').map((vapor) => {
    const id = text(vapor?.id, 'vapor population id');
    if (ids.has(id)) throw new TypeError('Duplicate vapor population id');
    ids.add(id);
    const tv = temperature(vapor.temperatureK, thermo.minTemperatureK, thermo.maxTemperatureK, 'vapor temperature');
    const pv = nonnegative(vapor.partialPressurePa, 'vapor partial pressure');
    incidentPressures.push(pv);
    const incoming = incidentRate(surfaceAreaM2, pv, rs, tv);
    const capture = product([alpha, incoming], 'captured mass rate');
    const captureHeat = product([capture, effusiveCv, tv - tl], 'capture temperature heat');
    const reflectedHeatRateIntoLiquidW = product([(1 - alpha), incoming, beta, effusiveCv, tv - tl], 'vapor reflected heat');
    equivalentPressures.push(tl === tv ? pv
      : product([pv, Math.sqrt(tl), 1 / Math.sqrt(tv)], 'equivalent incident pressure'));
    captureTemperatureHeat.push(captureHeat);
    return Object.freeze({ id, incidentMassRateKgPerS: incoming, condensationRateKgPerS: capture,
      centeredMolecularEnergyRateIntoLiquidW: sum([
        product([capture, emittedCenteredSpecificEnergy], 'captured energy'),
        captureHeat, reflectedHeatRateIntoLiquidW]),
      reflectedHeatRateIntoLiquidW });
  });
  const condensationRateKgPerS = sum(incidentPopulations.map((row) => row.condensationRateKgPerS));
  const evaporationRateKgPerS = product([alpha, surfaceAreaM2,
    equilibriumVaporPressurePa, 1 / thermalSpeed(rs, tl)], 'evaporation rate');
  // Subtract pressure-equivalent incoming/emitted fluxes before multiplying by
  // area/coefficient. At common T, detailed balance cancels the same P* exactly.
  // Emission is ONCE per physical surface, independent of source-row count.
  const pressureDifference = sum([sum(equivalentPressures), -equilibriumVaporPressurePa]);
  const massRateIntoLiquidKgPerS = product([alpha, surfaceAreaM2,
    pressureDifference, 1 / thermalSpeed(rs, tl)], 'net mass rate');
  const reflectedHeatRateIntoLiquidW = sum(incidentPopulations.map((row) => row.reflectedHeatRateIntoLiquidW));
  const vaporEnergy = sum([product([massRateIntoLiquidKgPerS, emittedCenteredSpecificEnergy], 'net carried energy'),
    sum(captureTemperatureHeat), reflectedHeatRateIntoLiquidW]);
  const vapor = Object.freeze({
    incidentPopulations: Object.freeze(incidentPopulations),
    condensationRateKgPerS, evaporationRateKgPerS,
    netMassRateIntoLiquidKgPerS: massRateIntoLiquidKgPerS,
    emittedCenteredEnergyRateW: product([evaporationRateKgPerS, emittedCenteredSpecificEnergy], 'emitted energy rate'),
    centeredMolecularEnergyRateIntoLiquidW: vaporEnergy,
    reflectedHeatRateIntoLiquidW,
    gasMassRateKgPerS: -massRateIntoLiquidKgPerS, gasCenteredEnergyRateW: -vaporEnergy
  });
  const inertStates = new Map();
  for (const gas of array(state.noncondensables, 'noncondensable states')) {
    const id = text(gas?.id, 'noncondensable state id');
    if (inertStates.has(id)) throw new TypeError('Duplicate noncondensable state');
    inertStates.set(id, gas);
  }
  if (inertStates.size !== model.noncondensables.length) throw new TypeError('Exactly all declared inert states required');
  const noncondensables = model.noncondensables.map((gas) => {
    const input = inertStates.get(gas.id);
    if (!input) throw new TypeError('Undeclared or missing noncondensable state');
    const tg = temperature(input.temperatureK, gas.minTemperatureK, gas.maxTemperatureK, 'inert temperature');
    const pg = nonnegative(input.partialPressurePa, 'inert partial pressure');
    incidentPressures.push(pg);
    const incoming = incidentRate(surfaceAreaM2, pg, gas.specificGasConstantJPerKgK, tg);
    const heatRateIntoLiquidW = product([incoming, gas.energyAccommodationCoefficient,
      gas.cvJPerKgK + 0.5 * gas.specificGasConstantJPerKgK, tg - tl], 'inert reflected heat');
    return Object.freeze({ id: gas.id, heatRateIntoLiquidW, gasMassRateKgPerS: 0,
      gasEnergyRateW: -heatRateIntoLiquidW });
  });
  if (sum(incidentPressures) > model.maxIncidentPressurePa) throw new RangeError('Total incident pressure outside interface domain');
  const areaRateM2PerS = product([2, massRateIntoLiquidKgPerS, 1 / rho, 1 / radiusM], 'area rate');
  return Object.freeze({
    schema: CONDENSABLE_INTERFACE_KINETICS_SCHEMA,
    frame: 'stationary-interface', energyBasis: 'centered-on-liquid-reference-internal-energy',
    energyGaugeJPerKg: thermo.liquidReferenceInternalEnergyJPerKg,
    radiusM, surfaceAreaM2,
    surfaceEnergyJ: positive(model.surface.interceptNPerM * surfaceAreaM2, 'surface internal energy'),
    liquidPressurePa, equilibriumVaporPressurePa,
    massRateIntoLiquidKgPerS,
    centeredMolecularEnergyRateIntoLiquidW: sum([vaporEnergy,
      ...noncondensables.map((row) => row.heatRateIntoLiquidW)]),
    radiusRateMPerS: product([massRateIntoLiquidKgPerS, 1 / rho, 1 / surfaceAreaM2], 'radius rate'),
    areaRateM2PerS,
    surfaceEnergyRateW: product([model.surface.interceptNPerM, areaRateM2PerS], 'surface internal energy rate'),
    vapor, noncondensables: Object.freeze(noncondensables),
    finiteIntervalAdmitted: false, farFieldTransportAdmitted: false,
    liveStateEnrollment: false, scientificValidation: false
  });
}
