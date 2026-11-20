import { IDEAL_GAS_CALORIC_SCHEMA, CONDENSABLE_UNIVERSAL_GAS_CONSTANT_J_PER_MOL_K as R,
  createPhaseCaloricThermodynamics, isIdealGasCaloricThermodynamics } from './condensableThermodynamics.js';
import { describeChemicalFormula } from '../chemistry/formula.js';

// First-class air, slice 3 (plan/todo/first-class-air.md; user decision
// 2026-11-17, full composition): one carrier per air parcel instead of one
// row per species. This module derives the parcel material from its component
// closures. Constant-Cv ideal gases that share the reference temperature and
// the u = Cv*T convention mix exactly into another constant-Cv ideal gas:
//   M = sum x_i M_i,   y_i = x_i M_i / M,   Cv = sum y_i Cv_i,   R_s = R / M.
// Transport uses the standard dilute-gas mixing rules: Wilke for viscosity and
// Wassiljewa with the Mason-Saxena coefficient for conductivity (Poling,
// Prausnitz and O'Connell, The Properties of Gases and Liquids, 5th ed.,
// sections 9-5 and 10-6). Electronic absorption keeps the component band of
// lowest excitation energy with its oscillator strength scaled by that
// component's mole fraction: the mixture's absorbance in that band is then
// exact, and the other components' bands, all deeper in the ultraviolet, are
// dropped.
export const IDEAL_GAS_MIXTURE_CLOSURE_SCHEMA = 'peercompute.ulg.ideal-gas-mixture-closure.v1';

function finitePositive(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || !(value > 0)) {
    throw new TypeError(`${label} must be a finite positive number`);
  }
  return value;
}

function gasPhase(properties, material) {
  const phase = properties?.phases?.find((row) => row.name === 'gas');
  if (!phase) throw new TypeError(`Ideal-gas mixture component ${material} has no gas phase`);
  return phase;
}

// Wilke / Mason-Saxena interaction coefficient phi_ij.
function interaction(propertyI, propertyJ, molarMassI, molarMassJ) {
  const numerator = (1 + Math.sqrt(propertyI / propertyJ) * Math.pow(molarMassJ / molarMassI, 0.25)) ** 2;
  return numerator / Math.sqrt(8 * (1 + molarMassI / molarMassJ));
}

function mixedTransport(components, key) {
  return components.reduce((sum, ci) => {
    const denominator = components.reduce((acc, cj) => (
      acc + cj.moleFraction * interaction(ci.viscosity, cj.viscosity, ci.molarMass, cj.molarMass)
    ), 0);
    return sum + ci.moleFraction * ci[key] / denominator;
  }, 0);
}

/**
 * @param {object} input
 * @param {string} input.material Mixture material key (for example 'air').
 * @param {string} input.compositionId Composition identity (for example the CIPM-2007 id).
 * @param {{ material: string, moleFraction: number, closure: object }[]} input.components
 */
export function createIdealGasMixtureClosure({ material, compositionId, components }) {
  if (typeof material !== 'string' || !material) throw new TypeError('Mixture material key required');
  if (typeof compositionId !== 'string' || !compositionId) throw new TypeError('Mixture composition id required');
  if (!Array.isArray(components) || components.length < 2) throw new TypeError('A mixture needs at least two components');
  const fractionSum = components.reduce((sum, c) => sum + finitePositive(c.moleFraction, `${c.material} mole fraction`), 0);
  if (Math.abs(fractionSum - 1) > 1e-12) throw new RangeError('Mixture mole fractions must sum to one');
  const rows = components.map(({ material: key, moleFraction, closure }) => {
    const properties = closure?.properties;
    const model = properties?.phaseCaloricModel;
    if (!model || model.schema !== IDEAL_GAS_CALORIC_SCHEMA) {
      throw new TypeError(`Mixture component ${key} requires an ideal-gas caloric model`);
    }
    const phase = gasPhase(properties, key);
    const formula = typeof properties.formula === 'string' && properties.formula ? properties.formula : null;
    if (!formula) throw new TypeError(`Mixture component ${key} requires a chemical formula`);
    return {
      material: key, moleFraction, closure, model, phase, formula,
      atomCounts: describeChemicalFormula(formula).atomCounts,
      molarMass: finitePositive(model.molarMassKgPerMol, `${key} molar mass`),
      cv: finitePositive(model.cvJPerKgK, `${key} Cv`),
      conductivity: finitePositive(phase.thermalConductivityWPerMK, `${key} conductivity`),
      viscosity: finitePositive(phase.dynamicViscosityPaS, `${key} viscosity`),
      atomsPerFormula: finitePositive(properties.atomsPerFormula, `${key} atoms per formula`)
    };
  });
  const reference = rows[0].model;
  for (const row of rows) {
    if (row.model.referenceTemperatureK !== reference.referenceTemperatureK
      || row.model.referencePressurePa !== reference.referencePressurePa
      || Math.abs(row.model.referenceSpecificInternalEnergyJPerKg
        - row.cv * row.model.referenceTemperatureK) > 1e-9 * row.model.referenceSpecificInternalEnergyJPerKg) {
      throw new RangeError(`Mixture component ${row.material} does not share the u = Cv*T reference convention`);
    }
  }
  const molarMass = rows.reduce((sum, row) => sum + row.moleFraction * row.molarMass, 0);
  for (const row of rows) row.massFraction = row.moleFraction * row.molarMass / molarMass;
  const cv = rows.reduce((sum, row) => sum + row.massFraction * row.cv, 0);
  const cp = cv + R / molarMass;
  const referenceTemperatureK = reference.referenceTemperatureK;
  const referencePressurePa = reference.referencePressurePa;
  const minTemperatureK = Math.max(...rows.map((row) => row.model.minTemperatureK));
  const maxTemperatureK = Math.min(...rows.map((row) => row.model.maxTemperatureK));
  const maxPressurePa = Math.min(...rows.map((row) => row.model.maxPressurePa));
  const density = referencePressurePa * molarMass / (R * referenceTemperatureK);
  const conductivity = mixedTransport(rows, 'conductivity');
  const viscosity = mixedTransport(rows, 'viscosity');
  const absorbers = rows.filter((row) => Number.isFinite(row.closure.properties.gasElectronicExcitationEv));
  const absorber = absorbers.sort((a, b) => (
    a.closure.properties.gasElectronicExcitationEv - b.closure.properties.gasElectronicExcitationEv
  ))[0] ?? null;
  const componentSummary = rows.map((row) => Object.freeze({
    material: row.material, formula: row.formula, moleFraction: row.moleFraction,
    massFraction: row.massFraction, molarMassKgPerMol: row.molarMass, cvJPerKgK: row.cv
  }));
  // Atoms per mole of mixture: mole-fraction-weighted component atom counts
  // (fractional; packed as f32 like any other atom count).
  const atomCounts = {};
  for (const row of rows) {
    for (const [Z, count] of Object.entries(row.atomCounts)) {
      atomCounts[Z] = (atomCounts[Z] ?? 0) + row.moleFraction * Number(count);
    }
  }
  const componentList = rows.map((row) => `${row.material} x=${row.moleFraction.toPrecision(6)}`).join(', ');
  const caloric = {
    schema: IDEAL_GAS_CALORIC_SCHEMA,
    energyBasis: 'specific-internal-energy-at-reference-temperature',
    referenceTemperatureK, referencePressurePa, molarMassKgPerMol: molarMass,
    cvJPerKgK: cv, referenceSpecificInternalEnergyJPerKg: cv * referenceTemperatureK,
    minTemperatureK, maxTemperatureK, maxPressurePa,
    provenance: `${material}: exact ideal-gas mixture of constant-Cv components (${componentList}); Cv = sum y_i Cv_i, M = sum x_i M_i, u = Cv*T.`
  };
  // Validate through the canonical constructor; it throws on an invalid model.
  if (!isIdealGasCaloricThermodynamics(createPhaseCaloricThermodynamics(caloric))) {
    throw new TypeError('Mixture caloric model did not validate as an ideal gas');
  }
  const method = (what) => `${what} of the ${compositionId} components (${componentList}) from their closures`;
  const properties = {
    molarMassKgPerMol: molarMass,
    atomsPerFormula: rows.reduce((sum, row) => sum + row.moleFraction * row.atomsPerFormula, 0),
    formula: null,
    idealGas: true,
    heatCapacityModel: { gas: 'ideal-gas-mixture' },
    gasVibrationsCm1: null,
    gasElectronicExcitationEv: absorber ? absorber.closure.properties.gasElectronicExcitationEv : null,
    gasElectronicBandFwhmEv: absorber ? absorber.closure.properties.gasElectronicBandFwhmEv : null,
    gasElectronicOscillatorStrength: absorber
      ? absorber.closure.properties.gasElectronicOscillatorStrength * absorber.moleFraction
      : null,
    phases: [{
      name: 'gas', cpJPerKgK: cp, gasVibrationsCm1: null, gasRigidRotorCpJPerKgK: null,
      densityKgPerM3: density, temperatureRange: [0, 1000000], bulkModulusPa: null, shearModulusPa: 0,
      thermalConductivityWPerMK: conductivity,
      thermalConductivityProvenance: { method: 'wassiljewa-mason-saxena', components: componentSummary },
      dynamicViscosityPaS: viscosity
    }],
    transitions: [],
    phaseCaloricModel: caloric,
    atomCounts: Object.freeze(atomCounts),
    idealGasMixture: Object.freeze({
      schema: IDEAL_GAS_MIXTURE_CLOSURE_SCHEMA, compositionId,
      components: Object.freeze(componentSummary),
      electronicAbsorber: absorber?.material ?? null
    }),
    propertyProvenance: {
      schema: 'ulg.material-property-provenance.v0',
      entries: [
        { paths: ['molarMassKgPerMol', 'atomsPerFormula'], status: 'reference-fallback',
          source: 'material-property-reference-bank', method: method('mole-fraction-weighted molar mass and atom count'),
          inputs: rows.map((row) => row.material), accuracy: 'exact-for-declared-composition', blockers: [] },
        { paths: ['idealGas', 'phases.gas.temperatureRange', 'phases.gas.shearModulusPa'], status: 'physical-law',
          source: 'molecular-statistical-mechanics+ideal-gas-law', method: 'ideal-gas mixture (Dalton/Amagat)',
          inputs: rows.map((row) => row.material), accuracy: 'ideal-gas', blockers: [] },
        { paths: ['gasElectronicExcitationEv', 'gasElectronicBandFwhmEv', 'gasElectronicOscillatorStrength'],
          status: 'reference-fallback', source: 'material-property-reference-bank',
          method: method('lowest-excitation component band, oscillator strength scaled by its mole fraction'),
          inputs: absorber ? [absorber.material] : [], accuracy: 'exact-absorbance-in-retained-band', blockers: [] },
        { paths: ['phases.gas.thermalConductivityWPerMK', 'phases.gas.dynamicViscosityPaS'],
          status: 'reference-fallback', source: 'material-property-reference-bank',
          method: method('Wilke viscosity and Wassiljewa/Mason-Saxena conductivity mixing'),
          inputs: rows.map((row) => row.material), accuracy: 'dilute-gas-mixing-rule', blockers: [] },
        { paths: ['phases.gas.cpJPerKgK', 'phases.gas.densityKgPerM3', 'phaseCaloricModel'],
          status: 'reference-fallback', source: 'material-property-reference-bank',
          method: caloric.provenance, inputs: rows.map((row) => row.material),
          accuracy: 'exact-mixture-of-reduced-constant-cp-components', blockers: [] }
      ]
    }
  };
  const template = rows.reduce((best, row) => (row.moleFraction > best.moleFraction ? row : best), rows[0]).closure;
  return Object.freeze({
    ...template,
    closureId: `ulg-ideal-gas-mixture-${material}-material-closure`,
    material,
    inputRefs: rows.map((row) => row.closure.closureId),
    validityDomain: { temperatureK: [minTemperatureK, maxTemperatureK], pressurePa: [1, maxPressurePa], composition: compositionId },
    validity: { temperatureK: [minTemperatureK, maxTemperatureK] },
    execution: { mode: 'ideal-gas-mixture-of-component-closures' },
    referenceBankAnchoring: null,
    properties
  });
}

// Key of the mixture left when `removed` components are taken out of `base`
// (the composition set of slice 3, stage 2): 'air' without o2 is 'air~o2';
// removed keys are sorted so every removal order names one material.
export function idealGasMixtureResidueKey(baseKey, removed) {
  const parts = String(baseKey).split('~');
  const removedSet = new Set([...parts.slice(1), ...removed]);
  return [parts[0], ...[...removedSet].sort()].join('~');
}

/**
 * The exact mixture left after a reaction removes one component: the other
 * components renormalized. With one component left it is that pure species.
 * @returns {{ material: string, closure: object|null, pure: boolean }}
 */
export function createIdealGasMixtureResidue({ mixtureKey, mixtureProperties, removedMaterial, componentClosures }) {
  const mixture = mixtureProperties?.idealGasMixture;
  if (!mixture) throw new TypeError(`${mixtureKey} is not an ideal-gas mixture`);
  const remaining = mixture.components.filter((c) => c.material !== removedMaterial);
  if (remaining.length === mixture.components.length) {
    throw new RangeError(`${removedMaterial} is not a component of ${mixtureKey}`);
  }
  if (remaining.length === 0) throw new RangeError(`Removing ${removedMaterial} leaves no gas`);
  if (remaining.length === 1) return { material: remaining[0].material, closure: null, pure: true };
  const sum = remaining.reduce((acc, c) => acc + c.moleFraction, 0);
  const material = idealGasMixtureResidueKey(mixtureKey, [removedMaterial]);
  const closure = createIdealGasMixtureClosure({
    material,
    compositionId: `${mixture.compositionId} without ${removedMaterial}`,
    components: remaining.map((c) => {
      const closure = componentClosures[c.material];
      if (!closure) throw new TypeError(`Mixture residue requires the ${c.material} closure`);
      return { material: c.material, moleFraction: c.moleFraction / sum, closure };
    })
  });
  return { material, closure, pure: false };
}
