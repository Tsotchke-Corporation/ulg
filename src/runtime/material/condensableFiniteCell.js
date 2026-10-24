import {
  CONDENSABLE_UNIVERSAL_GAS_CONSTANT_J_PER_MOL_K as R,
  evaluateCondensableThermodynamics, isCondensableThermodynamics
} from './condensableThermodynamics.js';
import {
  dyadicFromNumber as exact, dyadicAdd as add, dyadicNegate as neg,
  dyadicMultiply as mul, dyadicToNumber as number, dyadicRatio as ratio,
  dyadicEqual as equal
} from './exactDyadicInventory.js';

// Finite-time NEAR-EQUILIBRIUM phenomenological reference, not the stationary
// half-Maxwellian law, a calibrated all-Kn transport model, or a live SS writer.
// A rigid closed cell has one actual thermodynamic vapor reservoir and any
// number of DISTINCT inert species at their own temperatures. Do NOT merge
// unequal-T vapor carriers or treat their row labels as distinct species.
// Existing pure-liquid spherical parcels retain their physical N. No nuclei,
// vapor seed, ice model, atmosphere or transport coefficient is inferred.
//
// Young (1993), DOI 10.1016/0017-9310(93)90112-J, Appendix 1:
// T_l dS_(liquid+surface) = dE + P_g dV_l - mu_l dm_l,
// with P_l=P_g+2*sigma/r. Gas species: T_j dS_j=dE_j+p_j dV_g-mu_j dm_j.
// Bedeaux & Kjelstrup (2005), sections 7-8, conjugate heat/mass forces:
// https://dergipark.org.tr/en/download/article-file/65659
// Our chosen positive Onsager matrix is L*[1,e]^T*[1,e] plus a heat term.
// G=L*(mu_v/T_v-mu_l/T_l+e*(1/T_l-1/T_v)); F_v=e*G+H_v*(T_v-T_l).
// Each gas contributes F_j-p_j*G/rho_l to the liquid+surface energy; its own
// energy gets the opposite. Summed work is -P_g*dV_l. Surface U=a*A for
// sigma=a+b*T. Phase energies ALREADY contain the latent offset; no +L*dm.
// This proves nonnegative instantaneous entropy production for this reduced
// model, NOT that chosen mobilities reproduce real micron-droplet transport.
export const CONDENSABLE_FINITE_CELL_SCHEMA = 'peercompute.ulg.condensable-finite-cell-reference.v1';
const models = new WeakSet(), states = new WeakMap();
const ZERO = exact(0), UINT64_MAX = (1n << 64n) - 1n;
const subtract = (a, b) => add(a, neg(b));
const sum = (values) => values.reduce(add, ZERO);
const product = (...values) => values.map(exact).reduce(mul, exact(1));

class StateDomainError extends RangeError {}
function finite(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
}
function positive(value, name) {
  if (!(finite(value, name) > 0)) throw new RangeError(`${name} must be positive`);
  return value;
}
function nonnegative(value, name) {
  if (finite(value, name) < 0) throw new RangeError(`${name} must be nonnegative`);
  return value;
}
function text(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} is required`);
  return value;
}
function array(value, name) {
  if (!Array.isArray(value)) throw new TypeError(`${name} must be an explicit array`);
  return value;
}
function inDomain(condition, message) {
  if (!condition) throw new StateDomainError(message);
}
function temperature(t, model) {
  inDomain(Number.isFinite(t) && t >= model.minTemperatureK && t <= model.maxTemperatureK,
    'Temperature leaves the declared material domain');
  return t;
}
const freezeRows = (rows) => Object.freeze(rows.map(Object.freeze));
function rateNumber(value) {
  const projected = number(value);
  inDomain(projected !== 0 || value.coefficient === 0n,
    'Nonzero exchange rate is below the binary64 constitutive range');
  return projected;
}

export function createCondensableFiniteCellModel(record = {}) {
  if (record.schema !== CONDENSABLE_FINITE_CELL_SCHEMA || !isCondensableThermodynamics(record.thermodynamics)) {
    throw new TypeError('Explicit finite-cell schema and original thermodynamics required');
  }
  const thermo = record.thermodynamics;
  const surface = Object.freeze({
    interceptNPerM: positive(record.surface?.interceptNPerM, 'surface intercept'),
    slopeNPerMK: finite(record.surface?.slopeNPerMK, 'surface slope'),
    provenance: text(record.surface?.provenance, 'surface provenance')
  });
  for (const t of [thermo.minTemperatureK, thermo.maxTemperatureK]) {
    positive(surface.interceptNPerM + surface.slopeNPerMK * t, 'surface tension throughout model domain');
  }
  const ids = new Set(['vapor']); // Reserved name of the single condensable reservoir.
  const noncondensables = array(record.noncondensables, 'noncondensables').map((gas) => {
    const id = text(gas?.id, 'inert id');
    if (ids.has(id)) throw new TypeError('Duplicate inert species');
    ids.add(id);
    const minTemperatureK = positive(gas.minTemperatureK, 'inert minimum T');
    const maxTemperatureK = positive(gas.maxTemperatureK, 'inert maximum T');
    if (minTemperatureK > thermo.minTemperatureK || maxTemperatureK < thermo.maxTemperatureK) {
      throw new RangeError('Inert model must cover the condensable domain');
    }
    const molarMassKgPerMol = positive(gas.molarMassKgPerMol, 'inert molar mass');
    const specificGasConstantJPerKgK = positive(R / molarMassKgPerMol, 'inert R');
    return Object.freeze({ id, minTemperatureK, maxTemperatureK, molarMassKgPerMol, specificGasConstantJPerKgK,
      cvJPerKgK: positive(gas.cvJPerKgK, 'inert Cv'),
      heatTransferCoefficientWPerM2K: nonnegative(gas.heatTransferCoefficientWPerM2K, 'inert heat coefficient'),
      provenance: text(gas.provenance, 'inert provenance') });
  });
  const model = Object.freeze({
    schema: CONDENSABLE_FINITE_CELL_SCHEMA, thermodynamics: thermo, surface,
    massMobilityPerAreaKg2KPerJsM2: nonnegative(record.massMobilityPerAreaKg2KPerJsM2, 'mass mobility'),
    vaporHeatTransferCoefficientWPerM2K: nonnegative(record.vaporHeatTransferCoefficientWPerM2K, 'vapor heat coefficient'),
    maxAbsAffinityJPerKgK: positive(record.maxAbsAffinityJPerKgK, 'maximum affinity'),
    maxTemperatureDifferenceK: positive(record.maxTemperatureDifferenceK, 'maximum temperature difference'),
    noncondensables: Object.freeze(noncondensables), provenance: text(record.provenance, 'model provenance'),
    referenceOnly: true, liveStateEnrollment: false, scientificValidation: false
  });
  models.add(model);
  return model;
}

function geometry(model, mass, count) {
  inDomain(mass.coefficient > 0n, 'Parcel depletion requires a separate physical event');
  const density = model.thermodynamics.liquidDensityKgPerM3;
  const logRadius = (Math.log(number(mass)) - Math.log(density) - Math.log(Number(count))
    + Math.log(3 / (4 * Math.PI))) / 3;
  const radiusM = Math.exp(logRadius);
  const surfaceAreaM2 = Math.exp(Math.log(4 * Math.PI) + Math.log(Number(count)) + 2 * logRadius);
  inDomain(Number.isFinite(radiusM) && radiusM > 0 && Number.isFinite(surfaceAreaM2) && surfaceAreaM2 > 0,
    'Unrepresentable parcel geometry');
  return { radiusM, surfaceAreaM2,
    surfaceInventory: product(model.surface.interceptNPerM, surfaceAreaM2) };
}

function freezeState(data) {
  // The private record prevents a rounded snapshot being re-imported as exact
  // continuing inventory. This is object integrity, not PeerCompute authority.
  const state = Object.freeze({ schema: CONDENSABLE_FINITE_CELL_SCHEMA,
    referenceOnly: true, runtimeAdmissible: false });
  states.set(state, { ...data, gas: freezeRows(data.gas), droplets: freezeRows(data.droplets) });
  return state;
}
function recordOf(state) {
  const data = states.get(state);
  if (!data) throw new TypeError('Original finite-cell reference state required');
  return data;
}

export function initializeCondensableFiniteCell(model, input = {}) {
  if (!models.has(model)) throw new TypeError('Original finite-cell model required');
  const thermo = model.thermodynamics;
  const makeGas = (row, caloric, vapor, id) => {
    const massInventory = exact(positive(row?.massKg, 'gas mass (zero-vapor creation is outside this model)'));
    const t = temperature(finite(row.temperatureK, 'gas temperature'), caloric);
    const cv = vapor ? thermo.vaporCvJPerKgK : caloric.cvJPerKgK;
    const gap = vapor ? thermo.vaporizationReferenceInternalEnergyJPerKg : 0;
    return { id, massInventory, energyInventory: mul(massInventory,
      add(exact(gap), mul(exact(cv), subtract(exact(t), exact(thermo.referenceTemperatureK))))) };
  };
  const gas = [makeGas(input.vapor, thermo, true, 'vapor')];
  const inertInputs = new Map();
  for (const row of array(input.noncondensables, 'inert states')) {
    const id = text(row?.id, 'inert state id');
    if (inertInputs.has(id)) throw new TypeError('Duplicate inert state');
    inertInputs.set(id, row);
  }
  if (inertInputs.size !== model.noncondensables.length) throw new TypeError('Exactly all declared inert species required');
  for (const inert of model.noncondensables) gas.push(makeGas(inertInputs.get(inert.id), inert, false, inert.id));
  const ids = new Set();
  const droplets = array(input.droplets, 'droplets').map((row) => {
    const id = text(row?.id, 'parcel id');
    if (ids.has(id)) throw new TypeError('Duplicate parcel id');
    ids.add(id);
    const count = row.physicalDropletCount;
    if (typeof count !== 'bigint' || count <= 0n || count > UINT64_MAX) throw new TypeError('Explicit positive physical u64 N required');
    const massInventory = exact(positive(row.massKg, 'parcel mass'));
    const t = temperature(finite(row.temperatureK, 'parcel temperature'), thermo);
    const { surfaceInventory } = geometry(model, massInventory, count);
    return { id, physicalDropletCount: count, massInventory,
      energyInventory: add(mul(massInventory, mul(exact(thermo.liquidCvJPerKgK),
        subtract(exact(t), exact(thermo.referenceTemperatureK)))), surfaceInventory) };
  });
  if (droplets.length === 0) throw new TypeError('At least one existing parcel required; no nucleation inference');
  const freeVolume = exact(positive(input.freeGasVolumeM3, 'free gas volume'));
  const vesselVolume = add(freeVolume, mul(sum(droplets.map((row) => row.massInventory)),
    exact(thermo.liquidSpecificVolumeM3PerKg)));
  const state = freezeState({ model, gas, droplets, vesselVolume, time: ZERO });
  evaluateCondensableFiniteCellRates(state);
  return state;
}

export function inspectCondensableFiniteCell(state) {
  const data = recordOf(state), { model } = data, thermo = model.thermodynamics;
  const volume = subtract(data.vesselVolume, mul(sum(data.droplets.map((row) => row.massInventory)),
    exact(thermo.liquidSpecificVolumeM3PerKg)));
  inDomain(volume.coefficient > 0n, 'Liquid growth exhausts gas volume');
  const gas = data.gas.map((row, i) => {
    inDomain(row.massInventory.coefficient > 0n, 'Gas depletion leaves the near-equilibrium domain');
    const caloric = i === 0 ? thermo : model.noncondensables[i - 1];
    const cv = i === 0 ? thermo.vaporCvJPerKgK : caloric.cvJPerKgK;
    const gap = i === 0 ? thermo.vaporizationReferenceInternalEnergyJPerKg : 0;
    const sensible = subtract(row.energyInventory, mul(row.massInventory, exact(gap)));
    const capacity = mul(row.massInventory, exact(cv));
    const t = temperature(ratio(add(sensible, mul(capacity, exact(thermo.referenceTemperatureK))), capacity), caloric);
    const partialPressurePa = ratio(mul(row.massInventory, product(caloric.specificGasConstantJPerKgK, t)), volume);
    inDomain(Number.isFinite(partialPressurePa) && partialPressurePa > 0, 'Unrepresentable positive gas pressure');
    return Object.freeze({ ...row, massKg: number(row.massInventory), temperatureK: t, partialPressurePa });
  });
  const pressurePa = number(sum(gas.map((row) => exact(row.partialPressurePa))));
  inDomain(pressurePa <= thermo.maxPressurePa, 'Gas pressure exceeds material domain');
  const droplets = data.droplets.map((row) => {
    const geo = geometry(model, row.massInventory, row.physicalDropletCount);
    const capacity = mul(row.massInventory, exact(thermo.liquidCvJPerKgK));
    const t = temperature(ratio(add(subtract(row.energyInventory, geo.surfaceInventory),
      mul(capacity, exact(thermo.referenceTemperatureK))), capacity), thermo);
    const sigma = model.surface.interceptNPerM + model.surface.slopeNPerMK * t;
    const liquidPressurePa = pressurePa + 2 * sigma / geo.radiusM;
    inDomain(liquidPressurePa <= thermo.maxPressurePa, 'Laplace pressure exceeds material domain');
    return Object.freeze({ ...row, ...geo, massKg: number(row.massInventory), temperatureK: t,
      surfaceEnergyJ: number(geo.surfaceInventory), liquidPressurePa });
  });
  return Object.freeze({ schema: CONDENSABLE_FINITE_CELL_SCHEMA, referenceOnly: true,
    timeS: number(data.time), timeInventory: data.time,
    vapor: gas[0], noncondensables: Object.freeze(gas.slice(1)), droplets: Object.freeze(droplets),
    volumeM3: number(volume), volumeInventory: volume, pressurePa,
    totalMassInventory: sum([...gas, ...droplets].map((row) => row.massInventory)),
    totalEnergyInventory: sum([...gas, ...droplets].map((row) => row.energyInventory)) });
}

function thermalAffinity(x) {
  if (Math.abs(x) >= 0.001) return 0.5 * x * (2 + x) / (1 + x) - Math.log1p(x);
  // The first two powers cancel exactly; avoid manufacturing a linear force
  // out of cancellation error in this cubic temperature correction.
  let value = 0, power = x * x * x;
  for (let k = 3; k <= 9; k++) { value += (k % 2 ? 1 : -1) * (0.5 - 1 / k) * power; power *= x; }
  return value;
}

export function evaluateCondensableFiniteCellRates(state) {
  const { model } = recordOf(state), thermo = model.thermodynamics;
  const snapshot = inspectCondensableFiniteCell(state), gas = [snapshot.vapor, ...snapshot.noncondensables];
  const tv = snapshot.vapor.temperatureK, pv = snapshot.vapor.partialPressurePa;
  const entropy = [];
  const droplets = snapshot.droplets.map((row) => {
    const tl = row.temperatureK, area = row.surfaceAreaM2;
    const props = evaluateCondensableThermodynamics(thermo,
      { temperatureK: tl, totalPressurePa: row.liquidPressurePa });
    const pstar = props.equilibriumPressurePa;
    const deltaP = (pv - pstar) / pstar;
    const logS = Math.abs(deltaP) < 0.5 ? Math.log1p(deltaP) : Math.log(pv) - props.logEquilibriumPressurePa;
    const affinityJPerKgK = thermo.specificGasConstantJPerKgK * logS
      + thermo.vaporCpJPerKgK * thermalAffinity((tv - tl) / tl);
    inDomain(Number.isFinite(affinityJPerKgK) && Math.abs(affinityJPerKgK) <= model.maxAbsAffinityJPerKgK,
      'Chemical affinity leaves explicit near-equilibrium domain');
    const mobility = product(area, model.massMobilityPerAreaKg2KPerJsM2);
    const massRateKgPerS = rateNumber(mul(mobility, exact(affinityJPerKgK)));
    const meanT = tl + (tv - tl) / 2;
    const enthalpy = thermo.vaporizationReferenceInternalEnergyJPerKg
      + thermo.vaporCvJPerKgK * (meanT - thermo.referenceTemperatureK)
      + thermo.specificGasConstantJPerKgK * meanT;
    const energyRatesIntoDropletW = gas.map((member, j) => {
      const deltaT = member.temperatureK - tl;
      inDomain(Math.abs(deltaT) <= model.maxTemperatureDifferenceK, 'Temperature jump leaves explicit exchange domain');
      const coefficient = j === 0 ? model.vaporHeatTransferCoefficientWPerM2K
        : model.noncondensables[j - 1].heatTransferCoefficientWPerM2K;
      const heat = product(area, coefficient, deltaT);
      entropy.push(product(area, coefficient, deltaT, deltaT, 1 / tl, 1 / member.temperatureK));
      // Species-specific compression work: even a heat-insulating inert
      // reservoir participates when liquid growth changes its available volume.
      const pressureWork = product(member.partialPressurePa, massRateKgPerS, thermo.liquidSpecificVolumeM3PerKg);
      return rateNumber(subtract(add(heat, j === 0 ? product(enthalpy, massRateKgPerS) : ZERO), pressureWork));
    });
    entropy.push(mul(mobility, product(affinityJPerKgK, affinityJPerKgK)));
    return Object.freeze({ id: row.id, massRateKgPerS, affinityJPerKgK,
      energyRatesIntoDropletW: Object.freeze(energyRatesIntoDropletW) });
  });
  return Object.freeze({ droplets: Object.freeze(droplets), entropyProductionWPerK: number(sum(entropy)),
    referenceOnly: true, scientificValidation: false });
}

// Assemble ALL edge packets before exposing a state. Each paired energy packet
// includes its own gas pressure work. Shared vapor demand is accumulated once;
// a parcel-by-parcel donor clip would be order-dependent and nonphysical.
function applyRates(state, rates, dt) {
  const data = recordOf(state);
  const gas = data.gas.map((row) => ({ ...row }));
  const droplets = data.droplets.map((row, i) => {
    const rate = rates.droplets[i], dm = mul(exact(rate.massRateKgPerS), dt);
    gas[0].massInventory = subtract(gas[0].massInventory, dm);
    let energy = row.energyInventory;
    rate.energyRatesIntoDropletW.forEach((power, j) => {
      const packet = mul(exact(power), dt);
      gas[j].energyInventory = subtract(gas[j].energyInventory, packet);
      energy = add(energy, packet);
    });
    return { ...row, massInventory: add(row.massInventory, dm), energyInventory: energy };
  });
  const next = freezeState({ ...data, gas, droplets, time: add(data.time, dt) });
  evaluateCondensableFiniteCellRates(next); // Validate every coupled endpoint, not only proposals.
  return next;
}

function midpoint(state, dt) {
  const half = mul(dt, exact(0.5));
  const stage = applyRates(state, evaluateCondensableFiniteCellRates(state), half);
  return applyRates(state, evaluateCondensableFiniteCellRates(stage), dt);
}

function errorRatio(before, coarse, fine, rtol, atolT) {
  const a = inspectCondensableFiniteCell(before), b = inspectCondensableFiniteCell(coarse), c = inspectCondensableFiniteCell(fine);
  const rows = (s) => [s.vapor, ...s.noncondensables, ...s.droplets];
  const ar = rows(a), br = rows(b), cr = rows(c);
  let error = 0;
  for (let i = 0; i < ar.length; i++) {
    // Error relative to the exchanged amount, NOT the large reservoir total.
    // This preserves the accuracy test when every visible donor Number is 1.
    for (const field of ['massInventory', 'energyInventory']) {
      const coarseDelta = subtract(br[i][field], ar[i][field]);
      const fineDelta = subtract(cr[i][field], ar[i][field]);
      const difference = subtract(coarseDelta, fineDelta);
      if (difference.coefficient === 0n) continue;
      const abs = (v) => v.coefficient < 0n ? neg(v) : v;
      const scale = sum([abs(coarseDelta), abs(fineDelta)]);
      error = Math.max(error, Math.abs(ratio(difference, scale)) / rtol);
    }
    error = Math.max(error, Math.abs(br[i].temperatureK - cr[i].temperatureK) / atolT);
  }
  return error;
}

export function advanceCondensableFiniteCell(state, {
  durationS, relativeTolerance = 1e-5, absoluteTemperatureToleranceK = 1e-6,
  maxSteps = 10000, minimumStepS = 1e-18, initialStepS = durationS
} = {}) {
  const original = recordOf(state);
  positive(durationS, 'duration'); positive(relativeTolerance, 'relative tolerance');
  positive(absoluteTemperatureToleranceK, 'temperature tolerance');
  positive(minimumStepS, 'minimum step'); positive(initialStepS, 'initial step');
  if (!Number.isSafeInteger(maxSteps) || maxSteps < 1) throw new TypeError('Positive integer maxSteps required');
  evaluateCondensableFiniteCellRates(state);
  const duration = exact(durationS), target = add(original.time, duration);
  let current = state, step = Math.min(durationS, initialStepS), acceptedSteps = 0, rejectedSteps = 0;
  let status = 'step-limit', lastRejection = null;
  for (let attempt = 0; attempt < maxSteps; attempt++) {
    const remaining = subtract(target, recordOf(current).time);
    if (remaining.coefficient === 0n) { status = 'completed'; break; }
    const dt = subtract(exact(step), remaining).coefficient > 0n ? remaining : exact(step);
    if (subtract(dt, exact(minimumStepS)).coefficient < 0n) { status = 'step-underflow'; break; }
    let error = Infinity, fine;
    try {
      const coarse = midpoint(current, dt);
      const half = mul(dt, exact(0.5));
      fine = midpoint(midpoint(current, half), half);
      error = errorRatio(current, coarse, fine, relativeTolerance, absoluteTemperatureToleranceK);
    } catch (cause) {
      // Arithmetic projection overflow is also an inadmissible numerical
      // stage. Preserve accepted progress and retry a smaller whole step.
      // Type errors/programming failures are not disguised as physical events.
      if (!(cause instanceof RangeError)) throw cause;
      lastRejection = cause.message;
    }
    if (Number.isFinite(error) && error <= 1) {
      current = fine; acceptedSteps += 1;
      if (equal(recordOf(current).time, target)) { status = 'completed'; break; }
      step = Math.min(durationS, number(dt) * (error < 0.0625 ? 2 : 1));
    } else {
      rejectedSteps += 1;
      if (Number.isFinite(error)) lastRejection = 'Timestep accuracy';
      step = number(dt) / 2;
    }
  }
  const before = inspectCondensableFiniteCell(state), after = inspectCondensableFiniteCell(current);
  if (!equal(before.totalMassInventory, after.totalMassInventory)
      || !equal(before.totalEnergyInventory, after.totalEnergyInventory)) {
    throw new Error('Internal finite-cell conservation error');
  }
  return Object.freeze({ status, state: current,
    elapsedS: number(subtract(recordOf(current).time, original.time)),
    remainingS: number(subtract(target, recordOf(current).time)),
    elapsedInventory: subtract(recordOf(current).time, original.time),
    remainingInventory: subtract(target, recordOf(current).time),
    acceptedSteps, rejectedSteps, lastRejection, referenceOnly: true,
    runtimeAdmissible: false, scientificValidation: false });
}
