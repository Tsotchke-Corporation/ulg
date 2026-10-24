// CPU thermodynamic reference, NOT a live SS producer, a nucleation/growth
// rate, or permission to mutate a particle/aerosol owner. An isolated rigid
// cell with ONE condensable and a planar existing liquid interface is solved
// to equilibrium. All participants begin at one explicit common temperature.
// No legacy thermal table, diagnostic packet or GPU capability is accepted.
//
// Before runtime adoption: phase-specific thermal continuation, authenticated
// mixture endpoints, current SS geometry and residual product-gas accounting
// are required. Real aerosol B->(A)->W occupancy affects multiple cells; this
// isolated-cell m/rho volume change must NOT replace that coupled projection.
import {
  CONDENSABLE_UNIVERSAL_GAS_CONSTANT_J_PER_MOL_K,
  evaluateCondensableThermodynamics,
  isCondensableThermodynamics
} from '../material/condensableThermodynamics.js';

export const CONDENSABLE_CELL_EQUILIBRIUM_SCHEMA =
  'peercompute.ulg.condensable-cell-equilibrium-reference.v1';

function finiteNonnegative(value, name, positive = false) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number`);
  }
  if (positive ? value <= 0 : value < 0) throw new RangeError(`${name} outside domain`);
  return value;
}

function report(status, proposal = null) {
  return Object.freeze({
    schema: CONDENSABLE_CELL_EQUILIBRIUM_SCHEMA,
    status,
    ready: proposal !== null,
    referenceOnly: true,
    runtimeAdmissible: false,
    authoritativeStateMutation: false,
    ...(proposal ? { proposal: Object.freeze(proposal) } : {})
  });
}

export function solveClosedCondensableCellEquilibrium({
  model, temperatureK, vaporMassKg, liquidMassKg, freeGasVolumeM3,
  noncondensables, interfaceModel
} = {}) {
  if (!isCondensableThermodynamics(model)) {
    throw new TypeError('Explicit condensable caloric model required; no legacy energy import');
  }
  finiteNonnegative(temperatureK, 'temperatureK', true);
  finiteNonnegative(vaporMassKg, 'vaporMassKg');
  finiteNonnegative(liquidMassKg, 'liquidMassKg');
  finiteNonnegative(freeGasVolumeM3, 'freeGasVolumeM3', true);
  if (!Array.isArray(noncondensables)) throw new TypeError('Explicit noncondensables array required');
  const gases = noncondensables.map((gas) => ({
    massKg: finiteNonnegative(gas?.massKg, 'noncondensable.massKg'),
    cvJPerKgK: finiteNonnegative(gas?.cvJPerKgK, 'noncondensable.cvJPerKgK', true),
    molarMassKgPerMol: finiteNonnegative(gas?.molarMassKgPerMol, 'noncondensable.molarMassKgPerMol', true)
  }));
  const totalMass = vaporMassKg + liquidMassKg;
  finiteNonnegative(totalMass, 'total condensable mass', true);
  if (temperatureK < model.minTemperatureK || temperatureK > model.maxTemperatureK) {
    return report('outside-temperature-domain');
  }
  if (liquidMassKg > 0 && interfaceModel !== 'planar-existing-liquid') {
    return report('unsupported-interface-model');
  }
  const v = model.liquidSpecificVolumeM3PerKg;
  const r = model.specificGasConstantJPerKgK;
  const gasCv = gases.reduce((sum, gas) => sum + gas.massKg * gas.cvJPerKgK, 0);
  const gasMassR = gases.reduce((sum, gas) => sum + gas.massKg
    * CONDENSABLE_UNIVERSAL_GAS_CONSTANT_J_PER_MOL_K / gas.molarMassKgPerMol, 0);
  const initialCv = liquidMassKg * model.liquidCvJPerKgK
    + vaporMassKg * model.vaporCvJPerKgK + gasCv;
  // A bounded low-density domain in which even full condensation leaves a
  // positive gas volume. Never silently clamp a volume or a mass to fit it.
  if (!Number.isFinite(gasCv) || !Number.isFinite(gasMassR)
    || !Number.isFinite(initialCv) || !(initialCv > 0)
    || !(freeGasVolumeM3 - vaporMassKg * v > 0)) {
    return report('outside-volume-or-caloric-domain');
  }
  const initialPressure = (vaporMassKg * r + gasMassR) * temperatureK / freeGasVolumeM3;
  if (!Number.isFinite(initialPressure) || initialPressure > model.maxPressurePa) {
    return report('outside-pressure-domain');
  }
  const initialThermo = evaluateCondensableThermodynamics(model, {
    temperatureK, totalPressurePa: initialPressure
  });
  const gap = initialThermo.vaporizationInternalEnergyJPerKg;
  const initialLogS = vaporMassKg > 0
    ? Math.log(vaporMassKg * r * temperatureK / freeGasVolumeM3)
      - initialThermo.logEquilibriumPressurePa
    : -Infinity;
  if (liquidMassKg === 0 && initialLogS > 0) return report('activation-required');

  function stateAt(liquid) {
    const vapor = totalMass - liquid;
    const dm = liquid - liquidMassKg;
    const cv = liquid * model.liquidCvJPerKgK + vapor * model.vaporCvJPerKgK + gasCv;
    // Energy balance solved analytically for T at this phase partition. The
    // reference offsets cancel; condensation heats ALL participants, and
    // evaporation cools them. There is no second additive latent-heat credit.
    const temperature = temperatureK + dm * gap / cv;
    const volume = freeGasVolumeM3 - dm * v;
    const partialPressure = vapor * r * temperature / volume;
    const pressure = (vapor * r + gasMassR) * temperature / volume;
    return { liquid, vapor, dm, cv, temperature, volume, partialPressure, pressure };
  }

  // T(m) is monotone. Bisect from the known in-domain initial mass and retain
  // the INSIDE endpoint, so even one-ulp errors cannot extrapolate a closure
  // at a bracket boundary. This moves a search bound, never a physical state.
  let lo = 0;
  let hi = totalMass;
  if (stateAt(lo).temperature < model.minTemperatureK) {
    let outside = lo;
    let inside = liquidMassKg;
    for (let i = 0; i < 96; i += 1) {
      const mid = outside + (inside - outside) / 2;
      if (mid === outside || mid === inside) break;
      if (stateAt(mid).temperature < model.minTemperatureK) outside = mid;
      else inside = mid;
    }
    lo = inside;
  }
  if (stateAt(hi).temperature > model.maxTemperatureK) {
    let inside = liquidMassKg;
    let outside = hi;
    for (let i = 0; i < 96; i += 1) {
      const mid = inside + (outside - inside) / 2;
      if (mid === inside || mid === outside) break;
      if (stateAt(mid).temperature > model.maxTemperatureK) outside = mid;
      else inside = mid;
    }
    hi = inside;
  }
  const upperState = stateAt(hi);
  // Conservative envelope over this temperature-valid bracket. A too-wide
  // pressure envelope rejects this bounded reference solve rather than
  // querying the material model at an unadmitted pressure.
  const pressureBound = ((totalMass - lo) * r + gasMassR)
    * upperState.temperature / upperState.volume;
  if (!Number.isFinite(pressureBound) || pressureBound > model.maxPressurePa) {
    return report('pressure-bracket-outside-model-domain');
  }
  function logSAt(liquid) {
    const state = stateAt(liquid);
    const properties = evaluateCondensableThermodynamics(model, {
      temperatureK: state.temperature, totalPressurePa: state.pressure
    });
    return state.vapor > 0
      ? Math.log(state.partialPressure) - properties.logEquilibriumPressurePa : -Infinity;
  }
  const loLogS = logSAt(lo);
  const hiLogS = logSAt(hi);
  if (Number.isNaN(loLogS) || Number.isNaN(hiLogS)) return report('numeric-domain-rejected');
  let selected;
  let status;
  if (lo === 0 && loLogS <= 0) {
    selected = 0;
    status = 'all-vapor-equilibrium';
  } else if (loLogS < 0 || hiLogS > 0) {
    return report('equilibrium-outside-temperature-domain');
  } else {
    // Along this closed-energy path d(log S)/dm is strictly negative:
    // -(1-m_v*v/V)^2/m_v -(sum(m_i R_i)/R)*v^2/V^2
    // -(u_v-u_l)^2/(R*T^2*C). Hence at most one stable two-phase root.
    for (let i = 0; i < 96; i += 1) {
      const mid = lo + (hi - lo) / 2;
      if (mid === lo || mid === hi) break;
      if (logSAt(mid) > 0) lo = mid;
      else hi = mid;
    }
    selected = Math.abs(logSAt(lo)) <= Math.abs(logSAt(hi)) ? lo : hi;
    status = 'two-phase-equilibrium';
  }
  const result = stateAt(selected);
  if (!Number.isFinite(result.pressure) || result.pressure > model.maxPressurePa) {
    return report('equilibrium-outside-pressure-domain');
  }
  if (!(result.temperature >= model.minTemperatureK && result.temperature <= model.maxTemperatureK)
    || !(result.volume > 0) || !(result.vapor * v < result.volume)) {
    return report('equilibrium-outside-model-domain');
  }
  const deltaT = result.temperature - temperatureK;
  const vaporEnergyDeltaJ = -result.dm * initialThermo.vaporSpecificInternalEnergyJPerKg
    + result.vapor * model.vaporCvJPerKgK * deltaT;
  const liquidEnergyDeltaJ = result.dm * initialThermo.liquidSpecificInternalEnergyJPerKg
    + result.liquid * model.liquidCvJPerKgK * deltaT;
  const noncondensableEnergyDeltasJ = Object.freeze(gases.map((gas) => gas.massKg * gas.cvJPerKgK * deltaT));
  const componentEnergyResidualJ = vaporEnergyDeltaJ + liquidEnergyDeltaJ
    + noncondensableEnergyDeltasJ.reduce((sum, value) => sum + value, 0);
  // Gauge-stable admission: an arbitrary large common enthalpy zero must not
  // enlarge the tolerance or conceal failure. Phase component deltas remain
  // reference-basis dependent and must also be representable at this scale.
  const sensibleEnergyDeltaJ = result.cv * deltaT;
  const latentEnergyExchangeJ = result.dm * gap;
  const energyResidualJ = sensibleEnergyDeltaJ - latentEnergyExchangeJ;
  const logSupersaturationRatio = logSAt(selected);
  const energyScale = Math.max(1, Math.abs(sensibleEnergyDeltaJ), Math.abs(latentEnergyExchangeJ));
  if (!Number.isFinite(energyResidualJ) || Math.abs(energyResidualJ) > 1e-10 * energyScale
    || !Number.isFinite(componentEnergyResidualJ) || Math.abs(componentEnergyResidualJ) > 1e-10 * energyScale
    || !Number.isFinite(logSupersaturationRatio)
    || (status === 'two-phase-equilibrium' && Math.abs(logSupersaturationRatio) > 1e-10)) {
    return report('numeric-residual-rejected');
  }
  return report(status, {
    temperatureK: result.temperature,
    vaporMassKg: result.vapor,
    liquidMassKg: result.liquid,
    freeGasVolumeM3: result.volume,
    vaporPartialPressurePa: result.partialPressure,
    totalPressurePa: result.pressure,
    logSupersaturationRatio,
    condensedMassKg: result.dm, // Signed: negative means evaporation.
    vaporEnergyDeltaJ, liquidEnergyDeltaJ, noncondensableEnergyDeltasJ,
    energyResidualJ, componentEnergyResidualJ,
    massResidualKg: result.vapor + result.liquid - totalMass
  });
}
