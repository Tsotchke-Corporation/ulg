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
const FAMILY_BINARY_COVALENT = 'binary-covalent-synthesis';
const FAMILY_ACID_BASE = 'acid-base-neutralization';
const FAMILY_FUEL_COMBUSTION = 'fuel-and-hydrocarbon-combustion';
const FAMILY_METAL_OXIDE_REDOX = 'metal-oxide-redox-displacement';
const FAMILY_METAL_ACID = 'metal-acid-displacement';

const CARBON_Z = 6;
const NITROGEN_Z = 7;
const SULFUR_Z = 16;
const HALOGEN_ZS = new Set([9, 17, 35, 53]);
// First-principles electrochemical reduction-potential ordering proxy (higher = stronger reducing metal)
// derived from periodic shell ionization energy & hydration trends (used only for general displacement direction).
const METAL_ACTIVITY_RANK = new Map([
  [55, 100], [37, 98], [19, 96], [3, 95], [56, 92], [38, 90], [20, 88], [11, 86],
  [12, 80], [4, 76], [13, 72], [22, 66], [25, 62], [30, 58], [24, 54], [26, 50],
  [27, 45], [28, 43], [50, 40], [82, 38], [1, 35], // H2 reference = 35
  [29, 25], [47, 15], [80, 12], [78, 8], [79, 5]
]);

const PAULING_ELECTRONEGATIVITY_NONMETAL = new Map([
  [1, 2.20], [5, 2.04], [6, 2.55], [7, 3.04], [8, 3.44], [9, 3.98],
  [14, 1.90], [15, 2.19], [16, 2.58], [17, 3.16],
  [33, 2.18], [34, 2.55], [35, 2.96], [52, 2.10], [53, 2.66]
]);
const COVALENT_POSITIVE_VALENCE = new Map([
  [1, 1], [5, 3], [6, 4], [7, 3], [14, 4], [15, 3], [16, 4], [33, 3], [34, 4], [52, 4]
]);
const COVALENT_NEGATIVE_VALENCE = new Map([
  [1, 1], [6, 4], [7, 3], [8, 2], [9, 1], [15, 3], [16, 2], [17, 1], [34, 2], [35, 1], [53, 1]
]);

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
  // Per plan/todo/sedenion-reaction-scoping-plan.md: sedenion scope prioritizes
  // and annotates channels without suppressing stoichiometrically balanced candidates.

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

function binaryCovalentCandidate(lessEnSpecies, moreEnSpecies) {
  const left = singleElement(lessEnSpecies);
  const right = singleElement(moreEnSpecies);
  if (!left || !right || left.Z === right.Z) return null;
  // H + O is owned by the exact balanced hydrogenOxygenReaction (2 H2 + O2 -> 2 H2O).
  if (
    (left.Z === HYDROGEN_Z && right.Z === OXYGEN_Z)
    || (left.Z === OXYGEN_Z && right.Z === HYDROGEN_Z)
  ) return null;
  // Metals are already handled by binaryIonicCandidate.
  if (commonCationCharge(left.Z) != null || commonCationCharge(right.Z) != null) return null;
  const chiLeft = PAULING_ELECTRONEGATIVITY_NONMETAL.get(left.Z);
  const chiRight = PAULING_ELECTRONEGATIVITY_NONMETAL.get(right.Z);
  if (!(chiLeft > 0) || !(chiRight > 0)) return null;
  const deltaChi = chiRight - chiLeft;
  if (!(deltaChi >= 0.35)) return null;
  // Breaking the N≡N triple bond (945 kJ/mol) makes low-polarity nitrogen
  // oxides, halides, sulfides, and cyanides endothermic; require sufficient
  // electronegativity contrast (e.g. NH3, BN, Si3N4, P3N5, NF3).
  if (left.Z === 7 && deltaChi < 0.85) return null;
  if (right.Z === 7 && deltaChi < 0.65) return null;
  const posValence = COVALENT_POSITIVE_VALENCE.get(left.Z);
  const negValence = COVALENT_NEGATIVE_VALENCE.get(right.Z);
  if (!posValence || !negValence) return null;
  // Prefer standard chemical formula ordering (e.g. NH3 rather than H3N, CH4 rather than H4C).
  const hydrogenAsLigand = left.Z === HYDROGEN_Z && (right.Z === 6 || right.Z === 7 || right.Z === 14 || right.Z === 15 || right.Z === 16);
  const div = gcd(posValence, negValence);
  const leftAtoms = negValence / div;
  const rightAtoms = posValence / div;
  const productCoefficient = lcm(
    left.count / gcd(leftAtoms, left.count),
    right.count / gcd(rightAtoms, right.count)
  );
  const leftCoefficient = (leftAtoms * productCoefficient) / left.count;
  const rightCoefficient = (rightAtoms * productCoefficient) / right.count;
  const productFormula = hydrogenAsLigand
    ? ionicFormula(right.Z, rightAtoms, left.Z, leftAtoms)
    : ionicFormula(left.Z, leftAtoms, right.Z, rightAtoms);
  const productAtomCounts = {
    [left.Z]: leftAtoms,
    [right.Z]: rightAtoms
  };
  const reactants = [
    term(leftCoefficient, lessEnSpecies),
    term(rightCoefficient, moreEnSpecies)
  ];
  const products = [term(productCoefficient, productFormula, productAtomCounts)];
  const sedenionScope = resolveSedenionReactionScope(lessEnSpecies, moreEnSpecies, {
    familyId: FAMILY_BINARY_COVALENT,
    leftRole: 'donor',
    rightRole: 'acceptor',
    preferredBondType: 'covalent'
  });
  // Per plan/todo/sedenion-reaction-scoping-plan.md: sedenion scope prioritizes
  // and annotates channels without suppressing stoichiometrically balanced candidates.

  return candidate({
    familyId: FAMILY_BINARY_COVALENT,
    familyLabel: 'nonmetal + nonmetal -> valence-balanced covalent binary compound',
    reactants,
    products,
    productFormula,
    productAtomCounts,
    energetics: heuristicEnergetics({
      model: 'heuristic-binary-covalent-electronegativity-v0',
      // Pauling polar-bond stabilization scale (approx -96 kJ/mol * deltaChi^2 per bond).
      perProductFormulaJPerMol: -96_000 * (deltaChi * deltaChi) * Math.max(1, posValence * leftAtoms),
      productCoefficient,
      productAtomCounts,
      notes: [
        'Stoichiometry is valence-balanced from periodic-table covalent octet counts and exact atom conservation.',
        'Energetics are provisional Pauling polar-bond heuristics until superseded by electronic-structure or reference thermochemistry.'
      ]
    }),
    sedenionScope,
    limitations: [
      'Selects the primary covalent oxidation state; multi-oxide/kinetics competition is not yet solved from electronic structure.'
    ]
  });
}

function parseHydrohalicAcid(species) {
  // Matches HX (HF, HCl, HBr, HI)
  if (species.elementCount !== 2) return null;
  const hCount = species.atomCounts[HYDROGEN_Z] || 0;
  if (hCount !== 1) return null;
  const other = species.elements.find((e) => e.Z !== HYDROGEN_Z);
  if (!other || other.count !== 1 || !HALOGEN_ZS.has(other.Z)) return null;
  return { halogenZ: other.Z, halogenSymbol: other.symbol, protons: 1 };
}

function parseSulfuricAcid(species) {
  // Matches H2SO4
  if (species.elementCount !== 3) return null;
  if (
    species.atomCounts[HYDROGEN_Z] === 2
    && species.atomCounts[SULFUR_Z] === 1
    && species.atomCounts[OXYGEN_Z] === 4
  ) {
    return { anionFormula: 'SO4', anionCharge: 2, anionCounts: { [SULFUR_Z]: 1, [OXYGEN_Z]: 4 }, protons: 2 };
  }
  return null;
}

function parseMetalHydroxide(species) {
  // Matches M(OH)_q where q = commonCationCharge(M)
  if (species.elementCount !== 3) return null;
  const hCount = species.atomCounts[HYDROGEN_Z] || 0;
  const oCount = species.atomCounts[OXYGEN_Z] || 0;
  if (!(hCount >= 1) || hCount !== oCount) return null;
  const metal = species.elements.find((e) => e.Z !== HYDROGEN_Z && e.Z !== OXYGEN_Z);
  if (!metal || metal.count !== 1) return null;
  const q = commonCationCharge(metal.Z);
  if (!q || q !== hCount) return null;
  return { metalZ: metal.Z, metalSymbol: metal.symbol, charge: q };
}

function isAmmonia(species) {
  return atomCountsEqual(species.atomCounts, { [NITROGEN_Z]: 1, [HYDROGEN_Z]: 3 });
}

function isMolecularOxygen(species) {
  const el = singleElement(species);
  return Boolean(el && el.Z === OXYGEN_Z && el.count === 2);
}

function isMolecularHydrogen(species) {
  const el = singleElement(species);
  return Boolean(el && el.Z === HYDROGEN_Z && el.count === 2);
}

function parseMetalOxide(species) {
  if (species.elementCount !== 2) return null;
  const oCount = species.atomCounts[OXYGEN_Z] || 0;
  if (!(oCount >= 1)) return null;
  const metal = species.elements.find((e) => e.Z !== OXYGEN_Z);
  if (!metal || commonCationCharge(metal.Z) == null) return null;
  return { metalZ: metal.Z, metalSymbol: metal.symbol, metalCount: metal.count, oxygenCount: oCount };
}

function acidBaseCandidate(acidSpecies, baseSpecies) {
  const hx = parseHydrohalicAcid(acidSpecies);
  const h2so4 = !hx ? parseSulfuricAcid(acidSpecies) : null;
  if (!hx && !h2so4) return null;

  // Case 1: HX + NH3 -> NH4X (Lewis/Brønsted proton-transfer salt synthesis)
  if (hx && isAmmonia(baseSpecies)) {
    const saltFormula = `NH4${hx.halogenSymbol}`;
    const saltCounts = { [NITROGEN_Z]: 1, [HYDROGEN_Z]: 4, [hx.halogenZ]: 1 };
    const reactants = [term(1, acidSpecies), term(1, baseSpecies)];
    const products = [term(1, saltFormula, saltCounts)];
    return candidate({
      familyId: FAMILY_ACID_BASE,
      familyLabel: 'Brønsted acid + ammonia -> ammonium halide salt',
      reactants,
      products,
      productFormula: saltFormula,
      productAtomCounts: saltCounts,
      energetics: heuristicEnergetics({
        model: 'heuristic-acid-base-neutralization-v0',
        perProductFormulaJPerMol: -176_000,
        productCoefficient: 1,
        productAtomCounts: saltCounts,
        notes: [
          'Stoichiometry conserves protons and heavy atoms for Brønsted proton transfer.',
          'Heat release is a provisional heuristic estimate; not validated thermochemistry.'
        ]
      }),
      sedenionScope: resolveSedenionReactionScope(acidSpecies, baseSpecies, {
        familyId: FAMILY_ACID_BASE,
        leftRole: 'donor',
        rightRole: 'acceptor',
        preferredBondType: 'ionic'
      }),
      limitations: [
        'Provisional acid-base proton transfer energetics; solvation and gas-solid sublimation equilibria are not validated.'
      ]
    });
  }

  // Case 2: q HX + M(OH)_q -> M X_q + q H2O  OR  H2SO4 + M(OH)_q -> M_a(SO4)_b + c H2O
  const moh = parseMetalHydroxide(baseSpecies);
  if (!moh) return null;
  if (hx) {
    const q = moh.charge;
    const saltFormula = ionicFormula(moh.metalZ, 1, hx.halogenZ, q);
    const saltCounts = { [moh.metalZ]: 1, [hx.halogenZ]: q };
    const reactants = [term(q, acidSpecies), term(1, baseSpecies)];
    const products = [
      term(1, saltFormula, saltCounts),
      term(q, 'H2O', { [HYDROGEN_Z]: 2, [OXYGEN_Z]: 1 })
    ];
    return candidate({
      familyId: FAMILY_ACID_BASE,
      familyLabel: 'acid + metal hydroxide -> ionic salt + water neutralization',
      reactants,
      products,
      productFormula: saltFormula,
      productAtomCounts: saltCounts,
      energetics: heuristicEnergetics({
        model: 'heuristic-acid-base-neutralization-v0',
        perProductFormulaJPerMol: -57_300 * q,
        productCoefficient: 1,
        productAtomCounts: saltCounts,
        notes: [
          'Exact charge and proton-hydroxide stoichiometric neutralization.',
          'Neutralization enthalpy is a provisional heuristic (-57.3 kJ/mol per H2O); not validated thermochemistry.'
        ]
      }),
      sedenionScope: resolveSedenionReactionScope(acidSpecies, baseSpecies, {
        familyId: FAMILY_ACID_BASE,
        leftRole: 'donor',
        rightRole: 'acceptor',
        preferredBondType: 'ionic'
      }),
      limitations: [
        'Provisional neutralization energetics; aqueous ionic strength and precipitation kinetics are not validated.'
      ]
    });
  }

  // Sulfuric acid + M(OH)_q -> M_a(SO4)_b + (q*a) H2O
  const d = gcd(moh.charge, 2);
  const mAtoms = 2 / d;
  const so4Groups = moh.charge / d;
  const waterCoeff = moh.charge * mAtoms;
  const acidCoeff = so4Groups;
  const baseCoeff = mAtoms;
  const mPart = mAtoms === 1 ? moh.metalSymbol : `${moh.metalSymbol}${mAtoms}`;
  const aPart = so4Groups === 1 ? 'SO4' : `(SO4)${so4Groups}`;
  const saltFormula = `${mPart}${aPart}`;
  const saltCounts = {
    [moh.metalZ]: mAtoms,
    [SULFUR_Z]: so4Groups,
    [OXYGEN_Z]: 4 * so4Groups
  };
  const reactants = [term(acidCoeff, acidSpecies), term(baseCoeff, baseSpecies)];
  const products = [
    term(1, saltFormula, saltCounts),
    term(waterCoeff, 'H2O', { [HYDROGEN_Z]: 2, [OXYGEN_Z]: 1 })
  ];
  return candidate({
    familyId: FAMILY_ACID_BASE,
    familyLabel: 'sulfuric acid + metal hydroxide -> sulfate salt + water neutralization',
    reactants,
    products,
    productFormula: saltFormula,
    productAtomCounts: saltCounts,
    energetics: heuristicEnergetics({
      model: 'heuristic-acid-base-neutralization-v0',
      perProductFormulaJPerMol: -57_300 * waterCoeff,
      productCoefficient: 1,
      productAtomCounts: saltCounts,
      notes: [
        'Exact stoichiometric proton-hydroxide neutralization.',
        'Neutralization enthalpy is a provisional heuristic; not validated thermochemistry.'
      ]
    }),
    sedenionScope: resolveSedenionReactionScope(acidSpecies, baseSpecies, {
      familyId: FAMILY_ACID_BASE,
      leftRole: 'donor',
      rightRole: 'acceptor',
      preferredBondType: 'ionic'
    }),
    limitations: [
      'Provisional neutralization energetics; bisulfate intermediate equilibria are not modeled.'
    ]
  });
}

function fuelCombustionCandidate(fuelSpecies, oxSpecies) {
  // General C_a H_b O_c + O2 -> a CO2 + (b/2) H2O (e.g. CH4, CO, C2H6, C2H5OH, C3H8).
  // Leaves elemental H2 + O2 owned by hydrogenOxygenReaction / maybeBalancedHydrogenOxygenCandidate.
  if (!isMolecularOxygen(oxSpecies)) return null;
  if (fuelSpecies.elementCount < 2) return null;
  const cCount = fuelSpecies.atomCounts[CARBON_Z] || 0;
  const hCount = fuelSpecies.atomCounts[HYDROGEN_Z] || 0;
  const oCount = fuelSpecies.atomCounts[OXYGEN_Z] || 0;
  if (!(cCount >= 1)) return null;
  // Require only C, H, O atoms in organic/carbonaceous fuel and not already fully oxidized CO2
  const allowedKeys = Object.keys(fuelSpecies.atomCounts).every((zStr) => {
    const z = Number(zStr);
    return z === CARBON_Z || z === HYDROGEN_Z || z === OXYGEN_Z;
  });
  if (!allowedKeys) return null;
  // Required O atoms per fuel molecule = 2*c + h/2 - o; multiply by 2 to eliminate half-integers!
  const twoNeededO2 = 2 * cCount + 0.5 * hCount - oCount;
  if (!(twoNeededO2 > 1e-6)) return null;
  // Integer coefficients: scale = 2 if (4*c + h - 2*o) not divisible by 4, else 1
  const numO2 = Math.round(4 * cCount + hCount - 2 * oCount); // = 4 * O2_coeff_per_fuel
  if (numO2 <= 0) return null;
  const mult = 4 / gcd(numO2, 4);
  const fuelCoeff = mult;
  const o2Coeff = (numO2 * mult) / 4;
  const co2Coeff = cCount * mult;
  const h2oCoeff = (hCount * mult) / 2;
  if (!Number.isInteger(o2Coeff) || !Number.isInteger(h2oCoeff)) return null;
  const divAll = gcd(gcd(fuelCoeff, o2Coeff), h2oCoeff > 0 ? gcd(co2Coeff, h2oCoeff) : co2Coeff);
  const fC = fuelCoeff / divAll;
  const oC = o2Coeff / divAll;
  const cC = co2Coeff / divAll;
  const wC = h2oCoeff / divAll;
  const co2Counts = { [CARBON_Z]: 1, [OXYGEN_Z]: 2 };
  const h2oCounts = { [HYDROGEN_Z]: 2, [OXYGEN_Z]: 1 };
  const reactants = [term(fC, fuelSpecies), term(oC, oxSpecies)];
  const products = [term(cC, 'CO2', co2Counts)];
  if (wC > 0) products.push(term(wC, 'H2O', h2oCounts));
  return candidate({
    familyId: FAMILY_FUEL_COMBUSTION,
    familyLabel: 'carbonaceous fuel + O2 -> CO2 (+ H2O) complete combustion',
    reactants,
    products,
    productFormula: 'CO2',
    productAtomCounts: co2Counts,
    energetics: heuristicEnergetics({
      model: 'heuristic-oxy-combustion-bond-stoichiometry-v0',
      // Approximate -418 kJ per mol O2 consumed (Thornton's combustion rule)
      perProductFormulaJPerMol: (-418_000 * oC) / Math.max(1, cC),
      productCoefficient: cC,
      productAtomCounts: co2Counts,
      notes: [
        'Complete combustion stoichiometry strictly conserves C, H, and O.',
        'Heat release follows provisional Thornton O2-consumption heuristic; not validated thermochemistry.'
      ]
    }),
    sedenionScope: resolveSedenionReactionScope(fuelSpecies, oxSpecies, {
      familyId: FAMILY_FUEL_COMBUSTION,
      leftRole: 'donor',
      rightRole: 'acceptor',
      preferredBondType: 'covalent'
    }),
    limitations: [
      'Complete oxidation product limit; radical chain kinetics and partial oxidation (CO/soot) are not resolved here.'
    ]
  });
}

function metalOxideRedoxCandidate(reductantSpecies, oxideSpecies) {
  const ox = parseMetalOxide(oxideSpecies);
  if (!ox) return null;

  // Case A: Hydrogen reduction of less-active metal oxide (e.g., CuO + H2 -> Cu + H2O, Fe2O3 + 3 H2 -> 2 Fe + 3 H2O)
  if (isMolecularHydrogen(reductantSpecies)) {
    const rankOx = METAL_ACTIVITY_RANK.get(ox.metalZ) ?? 50;
    if (rankOx > 55) return null; // Active metals (Mg, Al, Na, Ca) are not reduced by H2!
    const h2Coeff = ox.oxygenCount;
    const metalCoeff = ox.metalCount;
    const h2oCoeff = ox.oxygenCount;
    const div = gcd(gcd(1, h2Coeff), gcd(metalCoeff, h2oCoeff));
    const reactants = [term(h2Coeff / div, reductantSpecies), term(1 / div, oxideSpecies)];
    const products = [
      term(metalCoeff / div, ox.metalSymbol, { [ox.metalZ]: 1 }),
      term(h2oCoeff / div, 'H2O', { [HYDROGEN_Z]: 2, [OXYGEN_Z]: 1 })
    ];
    return candidate({
      familyId: FAMILY_METAL_OXIDE_REDOX,
      familyLabel: 'hydrogen reduction of metal oxide -> metal + water',
      reactants,
      products,
      productFormula: ox.metalSymbol,
      productAtomCounts: { [ox.metalZ]: 1 },
      energetics: heuristicEnergetics({
        model: 'heuristic-redox-displacement-v0',
        perProductFormulaJPerMol: -85_000 * (ox.oxygenCount / Math.max(1, ox.metalCount)),
        productCoefficient: metalCoeff / div,
        productAtomCounts: { [ox.metalZ]: 1 },
        notes: [
          'Exact oxygen-transfer redox stoichiometry.',
          'Energetics are provisional activity-series heuristics; not validated thermochemistry.'
        ]
      }),
      sedenionScope: resolveSedenionReactionScope(reductantSpecies, oxideSpecies, {
        familyId: FAMILY_METAL_OXIDE_REDOX,
        leftRole: 'donor',
        rightRole: 'acceptor',
        preferredBondType: 'ionic'
      }),
      limitations: [
        'Provisional redox displacement ranking; high-temperature Ellingham equilibria are not validated.'
      ]
    });
  }

  // Case B: Thermite / aluminothermic / active-metal oxide displacement (e.g., 2 Al + Fe2O3 -> Al2O3 + 2 Fe, Mg + CuO -> MgO + Cu)
  const metal = singleElement(reductantSpecies);
  if (!metal || metal.Z === ox.metalZ) return null;
  const qRed = commonCationCharge(metal.Z);
  if (!qRed) return null;
  const rankRed = METAL_ACTIVITY_RANK.get(metal.Z);
  const rankOx = METAL_ACTIVITY_RANK.get(ox.metalZ);
  if (rankRed == null || rankOx == null || rankRed <= rankOx + 8) return null;

  // New oxide formula M_p O_q from charge balance with O^{2-}
  const dOx = gcd(qRed, 2);
  const pNew = 2 / dOx;
  const qNew = qRed / dOx;
  const newOxFormula = ionicFormula(metal.Z, pNew, OXYGEN_Z, qNew);
  const newOxCounts = { [metal.Z]: pNew, [OXYGEN_Z]: qNew };

  // Balance oxygen: nOldOx * ox.oxygenCount = nNewOx * qNew
  const oTotal = lcm(ox.oxygenCount, qNew);
  const oldOxCoeff = oTotal / ox.oxygenCount;
  const newOxCoeff = oTotal / qNew;
  const redAtomsNeeded = newOxCoeff * pNew;
  const redMult = metal.count / gcd(redAtomsNeeded, metal.count);
  const redCoeff = (redAtomsNeeded * redMult) / metal.count;
  const oldOxC = oldOxCoeff * redMult;
  const newOxC = newOxCoeff * redMult;
  const displacedMetalC = oldOxC * ox.metalCount;
  const divAll = gcd(gcd(redCoeff, oldOxC), gcd(newOxC, displacedMetalC));

  const reactants = [term(redCoeff / divAll, reductantSpecies), term(oldOxC / divAll, oxideSpecies)];
  const products = [
    term(newOxC / divAll, newOxFormula, newOxCounts),
    term(displacedMetalC / divAll, ox.metalSymbol, { [ox.metalZ]: 1 })
  ];
  return candidate({
    familyId: FAMILY_METAL_OXIDE_REDOX,
    familyLabel: 'active metal + metal oxide -> oxide redox displacement (thermite)',
    reactants,
    products,
    productFormula: newOxFormula,
    productAtomCounts: newOxCounts,
    energetics: heuristicEnergetics({
      model: 'heuristic-redox-displacement-v0',
      perProductFormulaJPerMol: -22_000 * (rankRed - rankOx) * qNew,
      productCoefficient: newOxC / divAll,
      productAtomCounts: newOxCounts,
      notes: [
        'Exact charge-balanced thermite/redox displacement stoichiometry.',
        'Energetics are provisional electrochemical activity heuristics; not validated thermochemistry.'
      ]
    }),
    sedenionScope: resolveSedenionReactionScope(reductantSpecies, oxideSpecies, {
      familyId: FAMILY_METAL_OXIDE_REDOX,
      leftRole: 'cation',
      rightRole: 'compound',
      preferredBondType: 'ionic'
    }),
    limitations: [
      'Provisional redox ranking; ignition activation temperature and molten phase dynamics require kinetic modeling.'
    ]
  });
}

function metalAcidDisplacementCandidate(metalSpecies, acidSpecies) {
  // M + q HX -> M X_q + (q/2) H2  (e.g. Zn + 2 HCl -> ZnCl2 + H2, Mg + 2 HCl -> MgCl2 + H2)
  const metal = singleElement(metalSpecies);
  const hx = parseHydrohalicAcid(acidSpecies);
  if (!metal || !hx) return null;
  const q = commonCationCharge(metal.Z);
  if (!q) return null;
  const rank = METAL_ACTIVITY_RANK.get(metal.Z);
  const hRank = METAL_ACTIVITY_RANK.get(HYDROGEN_Z) ?? 35;
  if (rank == null || rank <= hRank) return null; // Noble metals (Cu, Ag, Au, Pt) do not displace H2 from HX!

  const productCoeff = lcm(metal.count, q % 2 === 0 ? 1 : 2);
  const metalCoeff = productCoeff / metal.count;
  const acidCoeff = q * productCoeff;
  const h2Coeff = (q * productCoeff) / 2;
  const saltFormula = ionicFormula(metal.Z, 1, hx.halogenZ, q);
  const saltCounts = { [metal.Z]: 1, [hx.halogenZ]: q };
  const reactants = [term(metalCoeff, metalSpecies), term(acidCoeff, acidSpecies)];
  const products = [
    term(productCoeff, saltFormula, saltCounts),
    term(h2Coeff, 'H2', { [HYDROGEN_Z]: 2 })
  ];
  return candidate({
    familyId: FAMILY_METAL_ACID,
    familyLabel: 'active metal + hydrohalic acid -> metal halide + hydrogen',
    reactants,
    products,
    productFormula: saltFormula,
    productAtomCounts: saltCounts,
    energetics: heuristicEnergetics({
      model: 'heuristic-metal-acid-displacement-v0',
      perProductFormulaJPerMol: -155_000 * q,
      productCoefficient: productCoeff,
      productAtomCounts: saltCounts,
      notes: [
        'Exact charge-balanced single-displacement stoichiometry.',
        'Heat release is a provisional heuristic; not validated thermochemistry.'
      ]
    }),
    sedenionScope: resolveSedenionReactionScope(metalSpecies, acidSpecies, {
      familyId: FAMILY_METAL_ACID,
      leftRole: 'cation',
      rightRole: 'compound',
      preferredBondType: 'ionic'
    }),
    limitations: [
      'Provisional metal-acid displacement energetics; passivation oxide films and aqueous pH kinetics are not modeled.'
    ]
  });
}

function sedenionPriorityRank(item) {
  const cls = item?.sedenionScope?.reactiveClass;
  if (cls === 'reactive') return 0;
  if (cls === 'inert') return 2;
  return 1;
}

function dedupeCandidates(candidates) {
  const seen = new Set();
  const deduped = candidates.filter((item) => {
    const key = `${item.familyId}:${item.equation}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return deduped
    .map((item, idx) => ({ item, idx, rank: sedenionPriorityRank(item) }))
    .sort((a, b) => (a.rank - b.rank) || (a.idx - b.idx))
    .map((entry) => entry.item);
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
    const covalent = binaryCovalentCandidate(a, b, options);
    if (covalent) candidates.push(covalent);
    const acidBase = acidBaseCandidate(a, b, options);
    if (acidBase) candidates.push(acidBase);
    const comb = fuelCombustionCandidate(a, b, options);
    if (comb) candidates.push(comb);
    const redox = metalOxideRedoxCandidate(a, b, options);
    if (redox) candidates.push(redox);
    const mAcid = metalAcidDisplacementCandidate(a, b, options);
    if (mAcid) candidates.push(mAcid);
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
