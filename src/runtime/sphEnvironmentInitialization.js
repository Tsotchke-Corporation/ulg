import {
  CONDENSABLE_UNIVERSAL_GAS_CONSTANT_J_PER_MOL_K as R,
  evaluateCondensableThermodynamics,
  isCondensableThermodynamics,
  isIdealGasCaloricThermodynamics
} from './material/condensableThermodynamics.js';
import { resolveSphPhaseCaloricModels } from './sph/sphCondensableParticleInitialization.js';

// Cold physical inputs only. This module neither advances a CPU solver nor
// grants admission to a resident GPU writer. In particular, pressure is not
// a substitute for the species inventory that initialization must allocate.
export const SPH_ENVIRONMENT_INITIALIZATION_SCHEMA =
  'peercompute.ulg.sph-environment-initialization.v0';
export const SPH_ENVIRONMENT_HUMIDITY_CONVENTION =
  'vapor-partial-pressure-over-planar-liquid-equilibrium-pressure';

// CIPM-2007 table 1, https://doi.org/10.1088/0026-1394/45/2/004 .
// Retain the four major species and explicitly renormalize their sum.
// This is a composition choice, NOT adoption of the CIPM moist-air EOS.
const majorFractions = [['n2', 0.780848], ['o2', 0.209390],
  ['ar', 0.009332], ['co2', 0.000400]];
const majorFractionSum = majorFractions.reduce((sum, [, x]) => sum + x, 0);
export const SPH_ENVIRONMENT_DRY_AIR = Object.freeze({
  id: 'cipm-2007-four-major-species-normalized',
  source: 'https://www.nist.gov/system/files/documents/calibrations/CIPM-2007.pdf',
  referenceMoleFractionSum: majorFractionSum,
  omittedSpecies: Object.freeze(['ne', 'he', 'ch4', 'kr', 'h2', 'n2o', 'co', 'xe']),
  species: Object.freeze(majorFractions.map(([material, referenceMoleFraction]) => Object.freeze({
    material, referenceMoleFraction, moleFraction: referenceMoleFraction / majorFractionSum
  })))
});

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new TypeError(`${label} must be a plain record`);
  }
  return value;
}
function fields(value, allowed, label) {
  object(value, label);
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new TypeError(`${label}.${key} is not a supported input`);
  }
}
function finite(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number`);
  }
  return value;
}
function positive(value, label) {
  if (!(finite(value, label) > 0)) throw new RangeError(`${label} must be positive`);
  return value;
}
function nonnegative(value, label) {
  if (finite(value, label) < 0) throw new RangeError(`${label} must be nonnegative`);
  return value;
}
function text(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${label} is required`);
  return value;
}
function vector(value, label) {
  if (!Array.isArray(value) || value.length !== 3) throw new TypeError(`${label} needs three components`);
  return Object.freeze(Array.from(value, (v, i) => finite(v, `${label}[${i}]`)));
}

function normalizeNuclei(input, temperatureK, relativeHumidity) {
  fields(input, ['numberConcentrationPerM3', 'seed'], 'nuclei');
  const numberConcentrationPerM3 = nonnegative(input.numberConcentrationPerM3,
    'nuclei.numberConcentrationPerM3');
  if (input.seed == null) {
    if (numberConcentrationPerM3 > 0) throw new TypeError('Positive nuclei concentration requires explicit dry seed inputs');
    return Object.freeze({ numberConcentrationPerM3, seed: null });
  }
  const seed = input.seed;
  fields(seed, ['material', 'densityKgPerM3', 'sizeDistribution', 'initialHydration',
    'activationModel', 'provenance'], 'nuclei.seed');
  const material = text(seed.material, 'nuclei.seed.material');
  const densityKgPerM3 = positive(seed.densityKgPerM3, 'nuclei.seed.densityKgPerM3');
  if (!Array.isArray(seed.sizeDistribution) || seed.sizeDistribution.length === 0) {
    throw new TypeError('nuclei.seed.sizeDistribution requires physical dry-radius bins');
  }
  const sizeDistribution = Array.from(seed.sizeDistribution, (bin) => {
    fields(bin, ['dryRadiusM', 'numberFraction'], 'seed size bin');
    return Object.freeze({ dryRadiusM: positive(bin.dryRadiusM, 'seed dryRadiusM'),
      numberFraction: positive(bin.numberFraction, 'seed numberFraction') });
  });
  const sum = sizeDistribution.reduce((value, bin) => value + bin.numberFraction, 0);
  if (Math.abs(sum - 1) > 1e-12) throw new RangeError('Seed number fractions must sum to one');
  // A declared dry initial population has no pre-existing condensed water.
  // Hydration/activation must subsequently debit actual vapor and energy.
  if (seed.initialHydration !== 'dry') throw new RangeError('Only explicitly dry initial seed populations are defined');
  const activation = seed.activationModel;
  fields(activation, ['id', 'provenance', 'minTemperatureK', 'maxTemperatureK',
    'minRelativeHumidity', 'maxRelativeHumidity'], 'seed activationModel');
  const activationModel = {
    id: text(activation.id, 'seed activation model id'),
    provenance: text(activation.provenance, 'seed activation model provenance'),
    minTemperatureK: positive(activation.minTemperatureK, 'seed minimum temperature'),
    maxTemperatureK: positive(activation.maxTemperatureK, 'seed maximum temperature'),
    minRelativeHumidity: nonnegative(activation.minRelativeHumidity, 'seed minimum RH'),
    maxRelativeHumidity: nonnegative(activation.maxRelativeHumidity, 'seed maximum RH')
  };
  if (activationModel.minTemperatureK > activationModel.maxTemperatureK
    || activationModel.minRelativeHumidity > activationModel.maxRelativeHumidity
    || temperatureK < activationModel.minTemperatureK || temperatureK > activationModel.maxTemperatureK
    || relativeHumidity < activationModel.minRelativeHumidity || relativeHumidity > activationModel.maxRelativeHumidity) {
    throw new RangeError('Environment is outside the declared seed model domain');
  }
  return Object.freeze({ numberConcentrationPerM3, seed: Object.freeze({
    material, densityKgPerM3, sizeDistribution: Object.freeze(sizeDistribution), initialHydration: 'dry',
    activationModel: Object.freeze(activationModel), provenance: text(seed.provenance, 'seed provenance')
  }) });
}

/** Clone-safe physical initialization, shared by future UI/URL and worker consumers. */
export function normalizeSphEnvironmentInitialization(input) {
  fields(input, ['schema', 'mode', 'temperatureK', 'totalPressurePa', 'relativeHumidity',
    'meanVelocityMPerS', 'dryAirComposition', 'humidityConvention', 'nuclei', 'provenance'], 'environment');
  if (input.schema !== SPH_ENVIRONMENT_INITIALIZATION_SCHEMA) throw new TypeError('Explicit environment schema required');
  if (input.mode !== 'air' && input.mode !== 'vacuum') throw new RangeError('Environment mode must be air or vacuum');
  if (input.dryAirComposition !== SPH_ENVIRONMENT_DRY_AIR.id) throw new RangeError('Unsupported dry-air composition');
  if (input.humidityConvention !== SPH_ENVIRONMENT_HUMIDITY_CONVENTION) throw new RangeError('Unsupported humidity convention');
  const temperatureK = positive(input.temperatureK, 'environment.temperatureK');
  const totalPressurePa = nonnegative(input.totalPressurePa, 'environment.totalPressurePa');
  const relativeHumidity = nonnegative(input.relativeHumidity, 'environment.relativeHumidity');
  if (relativeHumidity > 1) throw new RangeError('Initial relativeHumidity must be a fraction from 0 to 1');
  const meanVelocityMPerS = vector(input.meanVelocityMPerS, 'environment.meanVelocityMPerS');
  const nuclei = normalizeNuclei(input.nuclei, temperatureK, relativeHumidity);
  if (input.mode === 'air' && !(totalPressurePa > 0)) throw new RangeError('Air requires positive total pressure; use vacuum for zero');
  if (input.mode === 'vacuum' && (totalPressurePa !== 0 || relativeHumidity !== 0
    || nuclei.numberConcentrationPerM3 !== 0 || meanVelocityMPerS.some((v) => v !== 0))) {
    throw new RangeError('Vacuum requires zero pressure, humidity, nuclei concentration and mean flow');
  }
  return Object.freeze({ schema: SPH_ENVIRONMENT_INITIALIZATION_SCHEMA, mode: input.mode,
    temperatureK, totalPressurePa, relativeHumidity, meanVelocityMPerS,
    dryAirComposition: SPH_ENVIRONMENT_DRY_AIR.id, humidityConvention: SPH_ENVIRONMENT_HUMIDITY_CONVENTION,
    nuclei, provenance: text(input.provenance, 'environment.provenance') });
}

// The first enrollment is the same-air, zero-nuclei control. A positive seed
// benchmark still needs a documented material/size/model choice; do not invent
// one or silently turn it into an already visible water-droplet population.
export function createSphRoomAirInitialization(overrides = {}) {
  object(overrides, 'room-air overrides');
  return normalizeSphEnvironmentInitialization({
    schema: SPH_ENVIRONMENT_INITIALIZATION_SCHEMA, mode: 'air', temperatureK: 293.15,
    totalPressurePa: 101325, relativeHumidity: 0.5, meanVelocityMPerS: [0, 0, 0],
    dryAirComposition: SPH_ENVIRONMENT_DRY_AIR.id,
    humidityConvention: SPH_ENVIRONMENT_HUMIDITY_CONVENTION,
    nuclei: { numberConcentrationPerM3: 0, seed: null },
    provenance: 'Chosen room-air benchmark; not a measurement. Zero-nuclei comparison.', ...overrides
  });
}

function dryGasCaloricState(record, material, temperatureK, totalPressurePa) {
  if (isIdealGasCaloricThermodynamics(record)) {
    if (temperatureK < record.minTemperatureK || temperatureK > record.maxTemperatureK
      || totalPressurePa > record.maxPressurePa) {
      throw new RangeError(`${material} initialization is outside its declared ideal-gas caloric domain`);
    }
    return { molarMassKgPerMol: record.molarMassKgPerMol,
      specificInternalEnergyJPerKg: finite(record.vaporReferenceInternalEnergyJPerKg
        + record.vaporCvJPerKgK * (temperatureK - record.referenceTemperatureK), `${material} U`),
      caloricProvenance: record.provenance };
  }
  fields(record, ['molarMassKgPerMol', 'cvJPerKgK', 'referenceTemperatureK',
    'referenceSpecificInternalEnergyJPerKg', 'minTemperatureK', 'maxTemperatureK',
    'maxPressurePa', 'provenance'], `dry gas ${material}`);
  const molarMassKgPerMol = positive(record.molarMassKgPerMol, `${material} molar mass`);
  const cv = positive(record.cvJPerKgK, `${material} Cv`);
  const t0 = positive(record.referenceTemperatureK, `${material} reference temperature`);
  const u0 = finite(record.referenceSpecificInternalEnergyJPerKg, `${material} reference U`);
  const min = positive(record.minTemperatureK, `${material} minimum temperature`);
  const max = positive(record.maxTemperatureK, `${material} maximum temperature`);
  const pMax = positive(record.maxPressurePa, `${material} maximum pressure`);
  if (min >= max || t0 < min || t0 > max || temperatureK < min || temperatureK > max || totalPressurePa > pMax) {
    throw new RangeError(`${material} initialization is outside its declared ideal-gas caloric domain`);
  }
  return { molarMassKgPerMol,
    specificInternalEnergyJPerKg: finite(u0 + cv * (temperatureK - t0), `${material} U`),
    caloricProvenance: text(record.provenance, `${material} caloric provenance`) };
}

/**
 * Compile cold species inputs from ACTUAL physical free volume. No particles,
 * rounded GPU inventory, kinetic law, ventilation or infinite reservoir is
 * created here. The caller must enroll these species in the shared conserved
 * gas path; oxygen is a separate material, with no inert-species exemption.
 * RH uses the SAME Gibbs/caloric model as subsequent water exchange.
 */
export function buildSphEnvironmentGasInputs({ environment, freeVolumeM3,
  waterThermodynamics = null, dryGasCaloricModels = null, materialProperties = null } = {}) {
  const init = normalizeSphEnvironmentInitialization(environment);
  nonnegative(freeVolumeM3, 'physical freeVolumeM3');
  if (init.mode === 'vacuum') return Object.freeze({ environment: init, freeVolumeM3,
    gasSpecies: Object.freeze([]), totalGasMassKg: 0, totalGasInternalEnergyJ: 0 });
  positive(freeVolumeM3, 'air physical freeVolumeM3');
  if (materialProperties !== null) {
    if (waterThermodynamics !== null || dryGasCaloricModels !== null) {
      throw new TypeError('Environment calorics require one source: material inputs or explicit models');
    }
    const models = resolveSphPhaseCaloricModels(materialProperties);
    waterThermodynamics = models.h2o ?? null;
    dryGasCaloricModels = Object.fromEntries(SPH_ENVIRONMENT_DRY_AIR.species.map(({ material }) => {
      if (!isIdealGasCaloricThermodynamics(models[material])) {
        throw new TypeError(`Environment ${material} requires its declared gas-only material model`);
      }
      return [material, models[material]];
    }));
  }
  const { temperatureK, totalPressurePa, relativeHumidity } = init;
  // RH=0 is exact dry air and requires no condensable model or zero-mass
  // water row. Humid initialization cannot borrow an optical saturation fit.
  let vaporPressurePa = 0;
  let waterState = null;
  if (relativeHumidity > 0) {
    if (!isCondensableThermodynamics(waterThermodynamics)) {
      throw new TypeError('Humidity requires the declared water thermodynamics used for exchange');
    }
    waterState = evaluateCondensableThermodynamics(waterThermodynamics, { temperatureK, totalPressurePa });
    vaporPressurePa = positive(relativeHumidity * waterState.equilibriumPressurePa, 'initial vapor partial pressure');
  }
  const dryPressurePa = totalPressurePa - vaporPressurePa;
  if (!(dryPressurePa > 0)) throw new RangeError('Humidity leaves no positive dry-air pressure; change T, P or RH');
  fields(dryGasCaloricModels, SPH_ENVIRONMENT_DRY_AIR.species.map((s) => s.material), 'dryGasCaloricModels');
  const makeRow = (material, partialPressurePa, caloric) => {
    const moles = positive((partialPressurePa / R / temperatureK) * freeVolumeM3, `${material} initial moles`);
    const massKg = positive(moles * caloric.molarMassKgPerMol, `${material} initial mass`);
    const internalEnergyJ = finite(massKg * caloric.specificInternalEnergyJPerKg, `${material} initial energy`);
    if (internalEnergyJ === 0 && caloric.specificInternalEnergyJPerKg !== 0) {
      throw new RangeError(`${material} nonzero initial energy underflows binary64`);
    }
    return Object.freeze({ material, phase: 'gas', temperatureK, partialPressurePa, moles, massKg,
      specificInternalEnergyJPerKg: caloric.specificInternalEnergyJPerKg,
      internalEnergyJ,
      meanVelocityMPerS: init.meanVelocityMPerS, caloricProvenance: caloric.caloricProvenance });
  };
  const gasSpecies = SPH_ENVIRONMENT_DRY_AIR.species.map(({ material, moleFraction }) => makeRow(
    material, dryPressurePa * moleFraction,
    dryGasCaloricState(dryGasCaloricModels[material], material, temperatureK, totalPressurePa)
  ));
  if (waterState) gasSpecies.push(makeRow('h2o', vaporPressurePa, {
    molarMassKgPerMol: waterThermodynamics.molarMassKgPerMol,
    specificInternalEnergyJPerKg: waterState.vaporSpecificInternalEnergyJPerKg,
    caloricProvenance: waterThermodynamics.provenance
  }));
  return Object.freeze({ environment: init, freeVolumeM3, gasSpecies: Object.freeze(gasSpecies),
    totalGasMassKg: positive(gasSpecies.reduce((sum, row) => sum + row.massKg, 0), 'initial total gas mass'),
    totalGasInternalEnergyJ: finite(gasSpecies.reduce((sum, row) => sum + row.internalEnergyJ, 0), 'initial total gas energy') });
}
