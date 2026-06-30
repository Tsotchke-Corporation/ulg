import { symbolForZ } from '../electronicStructure/periodicTable.js';
import {
  atomCountsEqual,
  describeChemicalFormula,
  formulaMolarMassKgPerMol,
  tallyFormulaSide
} from './formula.js';
import { resolveSedenionReactionScope } from './sedenionReactionScope.js';

const HYDROGEN_Z = 1;
const OXYGEN_Z = 8;

export const REACTION_VALIDATION_FLAGS = Object.freeze({
  scientificValidation: false,
  thermochemicalValidation: false,
  kineticsValidation: false
});

export const PROVISIONAL_ENERGETICS_STATUS = 'provisional-heuristic-not-scientifically-validated';

const FAMILY_ACTIVE_METAL_WATER = 'active-metal-water-hydroxide';
const FAMILY_BINARY_IONIC = 'binary-ionic-synthesis';

const ALKALI_METALS = new Set([3, 11, 19, 37, 55, 87]);
const ALKALINE_EARTH_METALS = new Set([4, 12, 20, 38, 56, 88]);
const ROOM_TEMPERATURE_WATER_REACTIVE_METALS = new Set([
  ...ALKALI_METALS,
  20, 38, 56, 88
]);
const COMMON_CATION_CHARGES = new Map([
  [13, 3], // Al
  [21, 3], [22, 4], [23, 5], [24, 3], [25, 2], [26, 2], [27, 2], [28, 2], [29, 1], [30, 2],
  [31, 3], [47, 1], [48, 2], [49, 3], [50, 2], [79, 1], [80, 2], [81, 1], [82, 2]
]);
const COMMON_ANION_CHARGES = new Map([
  [9, 1], [17, 1], [35, 1], [53, 1], [85, 1],
  [8, 2], [16, 2], [34, 2], [52, 2],
  [7, 3], [15, 3], [33, 3],
  [6, 4], [14, 4]
]);

function gcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) [x, y] = [y, x % y];
  return x || 1;
}

function lcm(a, b) {
  return Math.abs(a * b) / gcd(a, b);
}

function singleElement(species) {
  return species.elementCount === 1 ? species.elements[0] : null;
}

function waterLike(species) {
  return atomCountsEqual(species.atomCounts, { [HYDROGEN_Z]: 2, [OXYGEN_Z]: 1 });
}

export function commonCationCharge(Z) {
  if (ALKALI_METALS.has(Z)) return 1;
  if (ALKALINE_EARTH_METALS.has(Z)) return 2;
  if (COMMON_CATION_CHARGES.has(Z)) return COMMON_CATION_CHARGES.get(Z);
  if ((Z >= 39 && Z <= 46) || (Z >= 72 && Z <= 78)) return 3;
  if ((Z >= 57 && Z <= 71) || (Z >= 89 && Z <= 103)) return 3;
  return null;
}

export function commonAnionChargeMagnitude(Z) {
  return COMMON_ANION_CHARGES.get(Z) ?? null;
}

export function waterReactiveMetalClass(Z) {
  if (ALKALI_METALS.has(Z)) return 'alkali-metal-water-reactive';
  if (ROOM_TEMPERATURE_WATER_REACTIVE_METALS.has(Z)) return 'alkaline-earth-water-reactive';
  return null;
}

function term(coefficient, speciesOrFormula, atomCounts = null) {
  const formula = typeof speciesOrFormula === 'string' ? speciesOrFormula : speciesOrFormula.formula;
  return {
    coefficient,
    formula,
    atomCounts: atomCounts || speciesOrFormula.atomCounts
  };
}

function termText({ coefficient, formula }) {
  return coefficient === 1 ? formula : `${coefficient} ${formula}`;
}

function buildEquation(reactants, products) {
  return `${reactants.map(termText).join(' + ')} -> ${products.map(termText).join(' + ')}`;
}

function productKey(formula) {
  return formula.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function balanceFor(reactants, products) {
  const reactantCounts = tallyFormulaSide(reactants);
  const productCounts = tallyFormulaSide(products);
  return {
    balanced: atomCountsEqual(reactantCounts, productCounts),
    reactants: reactantCounts,
    products: productCounts
  };
}

function heuristicEnergetics({
  model,
  perProductFormulaJPerMol,
  productCoefficient,
  productAtomCounts,
  notes
}) {
  const productMolarMassKgPerMol = formulaMolarMassKgPerMol(productAtomCounts);
  const reactionEnthalpyJPerBalancedEquation = perProductFormulaJPerMol * productCoefficient;
  return {
    model,
    status: PROVISIONAL_ENERGETICS_STATUS,
    provisional: true,
    reactionEnthalpyJPerBalancedEquation,
    specificEnthalpyJPerKgProduct: reactionEnthalpyJPerBalancedEquation / (productCoefficient * productMolarMassKgPerMol),
    validation: REACTION_VALIDATION_FLAGS,
    notes
  };
}

function candidate({
  familyId,
  familyLabel,
  reactants,
  products,
  productFormula,
  productAtomCounts,
  energetics,
  limitations,
  sedenionScope = null
}) {
  const atomBalance = balanceFor(reactants, products);
  return {
    familyId,
    familyLabel,
    reactants,
    products,
    equation: buildEquation(reactants, products),
    productFormula,
    productKey: productKey(productFormula),
    productAtomCounts,
    atomBalance,
    energetics,
    sedenionScope,
    validation: REACTION_VALIDATION_FLAGS,
    scientificValidation: false,
    limitations
  };
}

function hydroxideFormula(metalSymbol, charge) {
  return charge === 1 ? `${metalSymbol}OH` : `${metalSymbol}(OH)${charge}`;
}

function hydroxideAtomCounts(metalZ, charge) {
  return {
    [metalZ]: 1,
    [OXYGEN_Z]: charge,
    [HYDROGEN_Z]: charge
  };
}

function metalWaterCandidate(metalSpecies, waterSpecies) {
  const metal = singleElement(metalSpecies);
  if (!metal) return null;
  const waterReactiveClass = waterReactiveMetalClass(metal.Z);
  if (!waterReactiveClass) return null;
  const charge = commonCationCharge(metal.Z);
  if (!charge) return null;

  // M + q H2O -> M(OH)q + q/2 H2. Use the smallest integer equation.
  const productCoefficient = lcm(metal.count, charge % 2 === 0 ? 1 : 2);
  const metalCoefficient = productCoefficient / metal.count;
  const waterCoefficient = charge * productCoefficient;
  const hydrogenCoefficient = (charge * productCoefficient) / 2;
  const productFormula = hydroxideFormula(metal.symbol, charge);
  const productAtomCounts = hydroxideAtomCounts(metal.Z, charge);
  const reactants = [
    term(metalCoefficient, metalSpecies),
    term(waterCoefficient, waterSpecies)
  ];
  const products = [
    term(productCoefficient, productFormula, productAtomCounts),
    term(hydrogenCoefficient, 'H2', { [HYDROGEN_Z]: 2 })
  ];

  return candidate({
    familyId: FAMILY_ACTIVE_METAL_WATER,
    familyLabel: 'active metal + water -> metal hydroxide + hydrogen',
    reactants,
    products,
    productFormula,
    productAtomCounts,
    energetics: heuristicEnergetics({
      model: 'heuristic-active-metal-water-stoichiometry-v0',
      perProductFormulaJPerMol: -160_000 * Math.max(1, charge),
      productCoefficient,
      productAtomCounts,
      notes: [
        'Stoichiometry is charge-balanced by common cation charge and exact atom conservation.',
        'Heat release is a provisional heuristic for ranking/contact gating only; it is not validated thermochemistry.',
        `Room-temperature water reactivity class: ${waterReactiveClass}.`
      ]
    }),
    sedenionScope: resolveSedenionReactionScope(metalSpecies, waterSpecies, {
      familyId: FAMILY_ACTIVE_METAL_WATER,
      leftRole: 'cation',
      rightRole: 'compound',
      preferredBondType: 'ionic'
    }),
    limitations: [
      'Common ion charge is a first-pass heuristic; oxidation state selection is not yet solved from electronic structure.',
      'Activation barriers and aqueous solvation are not derived in this layer.',
      'The zero-barrier water family is restricted to metals with a conservative room-temperature water-reactivity class.'
    ]
  });
}

function ionicFormula(metalZ, metalCount, anionZ, anionCount) {
  const metal = symbolForZ(metalZ);
  const anion = symbolForZ(anionZ);
  const suffix = (count) => (count === 1 ? '' : String(count));
  return `${metal}${suffix(metalCount)}${anion}${suffix(anionCount)}`;
}

function binaryIonicCandidate(metalSpecies, anionSpecies) {
  const metal = singleElement(metalSpecies);
  const anion = singleElement(anionSpecies);
  if (!metal || !anion || metal.Z === anion.Z) return null;
  const cationCharge = commonCationCharge(metal.Z);
  const anionCharge = commonAnionChargeMagnitude(anion.Z);
  if (!cationCharge || !anionCharge) return null;

  const chargeDivisor = gcd(cationCharge, anionCharge);
  const productMetalAtoms = anionCharge / chargeDivisor;
  const productAnionAtoms = cationCharge / chargeDivisor;
  const productCoefficient = lcm(
    metal.count / gcd(productMetalAtoms, metal.count),
    anion.count / gcd(productAnionAtoms, anion.count)
  );
  const metalCoefficient = (productMetalAtoms * productCoefficient) / metal.count;
  const anionCoefficient = (productAnionAtoms * productCoefficient) / anion.count;
  const productFormula = ionicFormula(metal.Z, productMetalAtoms, anion.Z, productAnionAtoms);
  const productAtomCounts = {
    [metal.Z]: productMetalAtoms,
    [anion.Z]: productAnionAtoms
  };
  const reactants = [
    term(metalCoefficient, metalSpecies),
    term(anionCoefficient, anionSpecies)
  ];
  const products = [term(productCoefficient, productFormula, productAtomCounts)];
  const sedenionScope = resolveSedenionReactionScope(metalSpecies, anionSpecies, {
    familyId: FAMILY_BINARY_IONIC,
    leftRole: 'cation',
    rightRole: 'anion',
    preferredBondType: 'ionic'
  });
  if (sedenionScope.reactiveClass === 'inert') return null;

  return candidate({
    familyId: FAMILY_BINARY_IONIC,
    familyLabel: 'metal + elemental nonmetal -> charge-balanced binary compound',
    reactants,
    products,
    productFormula,
    productAtomCounts,
    energetics: heuristicEnergetics({
      model: 'heuristic-binary-ionic-lattice-stoichiometry-v0',
      perProductFormulaJPerMol: -180_000 * Math.sqrt(cationCharge * anionCharge),
      productCoefficient,
      productAtomCounts,
      notes: [
        'Candidate formula is generated from common ion charges and exact atom conservation.',
        'Energetics are provisional ionic-strength heuristics; lattice, molecular, and phase effects are not validated.'
      ]
    }),
    sedenionScope,
    limitations: [
      'Only elemental nonmetal reactants are handled in this first binary-ionic pass.',
      'Multiple oxidation states, kinetics, and competing products are not ranked by validated chemistry.'
    ]
  });
}

function dedupeCandidates(candidates) {
  const seen = new Set();
  return candidates.filter((item) => {
    const key = `${item.familyId}:${item.equation}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Discover balanced reaction candidates from parsed formulas.
 *
 * The returned candidates are deliberately "reaction candidates", not scientific claims: this
 * layer proves formula recognition, atom balance, family matching, and provisional energetic signs.
 * Validated thermochemistry remains a later electronic-structure/experiment-backed layer.
 */
export function discoverReactionCandidates(leftInput, rightInput, options = {}) {
  const left = describeChemicalFormula(leftInput);
  const right = describeChemicalFormula(rightInput);
  const candidates = [];
  const sedenionScope = resolveSedenionReactionScope(left, right, {
    familyId: 'formula-pair-symbolic-prefilter'
  });
  if (atomCountsEqual(left.atomCounts, right.atomCounts)) {
    return {
      inputs: { left, right },
      candidates,
      note: 'same formula on both sides: no reaction candidate emitted',
      sedenionScope,
      validation: REACTION_VALIDATION_FLAGS,
      scientificValidation: false
    };
  }

  for (const [a, b] of [[left, right], [right, left]]) {
    if (waterLike(b)) {
      const rx = metalWaterCandidate(a, b, options);
      if (rx) candidates.push(rx);
    }
    const ionic = binaryIonicCandidate(a, b, options);
    if (ionic) candidates.push(ionic);
  }

  return {
    inputs: { left, right },
    candidates: dedupeCandidates(candidates),
    note: candidates.length > 0
      ? 'reaction candidates discovered from formula parsing and stoichiometric family rules'
      : 'no supported reaction family matched these formulas',
    sedenionScope,
    validation: REACTION_VALIDATION_FLAGS,
    scientificValidation: false
  };
}
