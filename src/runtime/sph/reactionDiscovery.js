// General reaction discovery for the two-material demo. Given the two block materials, decide
// whether they react and into WHAT — with the reaction enthalpy DERIVED from the molecular bonding
// engine (RHF/UHF energies), never tabulated. Replaces the old hardcoded H2+O2-only network.
//
// Two layers (per the chosen design):
//   1. Universal reaction families (templates) — general redox/acid–base patterns whose
//      stoichiometry comes from the DERIVED valence (electron count) and whose ΔH comes from the
//      engine. Covered families: active-metal + water → hydroxide + H2; fuel/metal + O2 → oxide.
//   2. Combinatorial fallback — for element sets no template matches, enumerate the simplest binary
//      product molecule from the combined elements, derive its energy, and react if it is clearly
//      more stable than the separated reactants. Conservative (a reduced heuristic), and gated so it
//      cannot fire for like-with-like (which would merely be merging, not a reaction).
//
// The all-electron STO-3G solver covers Z = 1–18 (H–Ar). Reactions whose participating species
// include heavier elements switch the whole reaction to the all-element atomic-Kohn-Sham
// tight-binding solver, so the enthalpy baseline is consistent and no element gets a one-off patch.
// Evidence-only throughout: validation flags stay false.

import { rhf, _uhf as uhf } from '../electronicStructure/molecularHartreeFock.js';
import { allElementBondLengthMeters, allElementSpeciesEnergyHa } from '../electronicStructure/allElementMolecularSolver.js';
import { atomicMassKg, zForSymbol, symbolForZ } from '../electronicStructure/periodicTable.js';
import { deriveElementProperties } from '../material/elementClosures.js';
import { deriveCompoundClosure } from '../material/compoundClosure.js';
import { deriveMaterialProperties } from '../material/materialDerivation.js';
import { createFirstPrinciplesMaterialClosures, createReferenceMaterialClosures } from '../material/materialClosures.js';
import {
  MaterialFirstPrinciplesResolutionError,
  materialDerivationSummary,
  requireFirstPrinciplesMaterialProperties
} from '../material/propertyProvenance.js';

const A = 1.8897259886; // Ångström → Bohr
const BOHR_TO_M = 5.29177210903e-11;
const HARTREE_J = 4.3597447222071e-18;
const AVOGADRO = 6.02214076e23;
const BASIS_MAX_Z = 18;
const ENERGY_MODEL_HF = 'sto-3g-rhf-uhf';
const ENERGY_MODEL_ALL_ELEMENT = 'atomic-kohn-sham-tight-binding-v0';

const atom = (Z, x, y, z) => ({ Z, position: [x, y, z] });
const speciesInBasis = (species) => species.atoms.every((a) => a.Z <= BASIS_MAX_Z);

function energyModelForSpecies(...species) {
  return species.every(speciesInBasis) ? ENERGY_MODEL_HF : ENERGY_MODEL_ALL_ELEMENT;
}

function speciesEnergyHa(species, model = energyModelForSpecies(species)) {
  if (model === ENERGY_MODEL_ALL_ELEMENT) return allElementSpeciesEnergyHa(species);
  return (species.multiplicity && species.multiplicity > 1 ? uhf(species.atoms, { multiplicity: species.multiplicity }) : rhf(species.atoms)).totalEnergyHa;
}

function bondLengthBohr(Za, Zb) {
  try {
    return allElementBondLengthMeters(Za, Zb) / BOHR_TO_M;
  } catch {
    return null;
  }
}

// --- reference geometries (Bohr) -----------------------------------------------------------------
const H2 = { atoms: [atom(1, 0, 0, 0), atom(1, 0, 0, 0.741 * A)], multiplicity: 1 };
const O2 = { atoms: [atom(8, 0, 0, 0), atom(8, 0, 0, 1.208 * A)], multiplicity: 3 };
const H2O = { atoms: [atom(8, 0, 0, 0), atom(1, 0.757 * A, 0, 0.587 * A), atom(1, -0.757 * A, 0, 0.587 * A)], multiplicity: 1 };

// Spin multiplicity from a simple electron-count parity rule (odd → doublet, even → singlet). O is
// the notable triplet exception handled where it matters (O2 is set explicitly above).
const multiplicityForElectrons = (nElectrons) => (nElectrons % 2 === 1 ? 2 : 1);
const atomMultiplicity = (Z) => multiplicityForElectrons(Z);

const REFERENCE_SPECIES = {
  h2o: { elements: { 1: 2, 8: 1 }, species: H2O, role: 'water' },
  o2: { elements: { 8: 2 }, species: O2, role: 'oxidizer' },
  h2: { elements: { 1: 2 }, species: H2, role: 'fuel' }
};

let defaultFirstPrinciplesClosureProperties = null;
let defaultFixtureClosureProperties = null;
const derivedMaterialPropertyCache = new Map();

function canonicalElementSymbol(key) {
  if (typeof key !== 'string' || key.length === 0) return null;
  const symbol = key[0].toUpperCase() + key.slice(1).toLowerCase();
  return zForSymbol(symbol) == null ? null : symbol;
}

function propertiesForMaterial(key, options = {}) {
  if (options.materialProperties?.[key]) return options.materialProperties[key];
  const lower = typeof key === 'string' ? key.toLowerCase() : key;
  if (options.materialProperties?.[lower]) return options.materialProperties[lower];
  const useFixture = options.allowFixtureMaterialProperties === true;
  if (useFixture && !defaultFixtureClosureProperties) {
    defaultFixtureClosureProperties = Object.fromEntries(
      Object.entries(createReferenceMaterialClosures()).map(([name, closure]) => [name, closure.properties])
    );
  }
  if (!useFixture && !defaultFirstPrinciplesClosureProperties) {
    defaultFirstPrinciplesClosureProperties = Object.fromEntries(
      Object.entries(createFirstPrinciplesMaterialClosures()).map(([name, closure]) => [name, closure.properties])
    );
  }
  const defaults = useFixture ? defaultFixtureClosureProperties : defaultFirstPrinciplesClosureProperties;
  if (defaults[key]) return defaults[key];
  if (defaults[lower]) return defaults[lower];
  if (!useFixture) {
    const cacheKey = lower || key;
    if (derivedMaterialPropertyCache.has(cacheKey)) return derivedMaterialPropertyCache.get(cacheKey);
    try {
      const derived = deriveMaterialProperties(key);
      requireFirstPrinciplesMaterialProperties(derived, {
        material: key,
        context: 'reactionDiscovery.deriveMaterialProperties'
      });
      derivedMaterialPropertyCache.set(cacheKey, derived);
      return derived;
    } catch {
      derivedMaterialPropertyCache.set(cacheKey, null);
    }
  }
  return null;
}

function firstTransitionTemperature(properties, from, to) {
  return properties?.transitions?.find((transition) => transition.from === from && transition.to === to)?.temperatureK ?? null;
}

function representativeMechanicalPhase(properties, role) {
  const phases = properties?.phases || [];
  if (role === 'water') {
    return phases.find((phase) => phase.name === 'liquid')
      || phases.find((phase) => phase.densityKgPerM3 > 0 && phase.bulkModulusPa > 0)
      || phases.find((phase) => phase.densityKgPerM3 > 0)
      || null;
  }
  return phases.find((phase) => phase.name === 'solid' && phase.densityKgPerM3 > 0)
    || phases.find((phase) => phase.densityKgPerM3 > 0 && phase.bulkModulusPa > 0)
    || phases.find((phase) => phase.densityKgPerM3 > 0)
    || null;
}

function closureMechanicalInputs(properties, role) {
  const phase = representativeMechanicalPhase(properties, role);
  return {
    densityKgPerM3: phase?.densityKgPerM3 ?? 0,
    bulkModulusPa: phase?.bulkModulusPa ?? phase?.eos?.bulkModulusPa ?? 0
  };
}

function reactiveWaterPhases(properties) {
  const phases = properties?.phases?.map((phase) => phase.name) || [];
  return phases.filter((phase) => phase === 'liquid' || phase === 'gas');
}

/**
 * Describe a demo material as a chemical species: its element formula, the molecular species used for
 * its reactant energy, molar mass, phase boundaries used for reactant availability, and role.
 */
export function materialComposition(key, options = {}) {
  const lower = typeof key === 'string' ? key.toLowerCase() : key;
  const properties = propertiesForMaterial(key, options);
  const ref = REFERENCE_SPECIES[lower];
  if (ref) {
    const mechanical = closureMechanicalInputs(properties, ref.role);
    return {
      elements: ref.elements,
      species: ref.species,
      molarMassKgPerMol: properties?.molarMassKgPerMol ?? Object.entries(ref.elements).reduce((sum, [Z, count]) => sum + Number(count) * atomicMassKg(Number(Z)) * AVOGADRO, 0),
      meltingPointK: firstTransitionTemperature(properties, 'solid', 'liquid') ?? 0,
      reactivePhases: ref.role === 'water' ? reactiveWaterPhases(properties) : (properties?.phases?.map((phase) => phase.name) || []),
      role: ref.role,
      ...mechanical,
      materialDerivation: properties ? materialDerivationSummary(properties) : null
    };
  }

  const symbol = canonicalElementSymbol(key);
  const Z = symbol ? zForSymbol(symbol) : null;
  if (Z == null) return null;
  const props = deriveElementProperties(Z);
  const elementProperties = properties || null;
  const metalLike = props.condensedModelApplicable === true && (props.conductionElectronDensityPerM3 ?? 0) > 0;
  const role = metalLike ? 'metal' : 'nonmetal';
  const mechanical = properties ? closureMechanicalInputs(properties, role) : {
    densityKgPerM3: props.densityKgPerM3 ?? 0,
    bulkModulusPa: props.bulkModulusPa ?? 0
  };
  return {
    elements: { [Z]: 1 },
    species: { atoms: [atom(Z, 0, 0, 0)], multiplicity: atomMultiplicity(Z) },
    molarMassKgPerMol: elementProperties?.molarMassKgPerMol ?? atomicMassKg(Z) * AVOGADRO,
    meltingPointK: firstTransitionTemperature(elementProperties, 'solid', 'liquid') ?? (metalLike ? props.meltingPointK : 0),
    valence: props.valenceElectrons,
    metal: metalLike,
    ...mechanical,
    Z,
    role,
    materialDerivation: elementProperties ? materialDerivationSummary(elementProperties) : null
  };
}

function requireCompositionFirstPrinciples(key, comp, options = {}) {
  if (options.allowFixtureMaterialProperties === true) return;
  if (!comp) {
    throw new MaterialFirstPrinciplesResolutionError(
      `${key} has no first-principles material closure`,
      {
        material: key,
        context: 'reactionDiscovery.materialComposition',
        blockers: ['first-principles-material-closure-not-produced']
      }
    );
  }
  const properties = propertiesForMaterial(key, options);
  if (!properties || !comp.materialDerivation) {
    throw new MaterialFirstPrinciplesResolutionError(
      `${key} material composition is not backed by a first-principles closure`,
      {
        material: key,
        context: 'reactionDiscovery.materialComposition',
        blockers: ['first-principles-material-closure-not-produced']
      }
    );
  }
  requireFirstPrinciplesMaterialProperties(properties, {
    material: key,
    context: 'reactionDiscovery.materialComposition'
  });
}

// --- product geometry builders -------------------------------------------------------------------
// Products are kept to a single small formula unit (≤3 atoms) so the per-reaction HF solve stays
// fast enough to run synchronously at demo build (the engine is O(nBasis⁴); a 4-atom period-3 cluster
// is tens of seconds). This is a reduced-stoichiometry representation: the metal hydroxide is modelled
// by its MOH unit and the oxide by its MO unit regardless of valence — exact for monovalent metals
// (NaOH) and a documented approximation for multivalent ones. The per-kg enthalpy stays engine-derived.
// Metal monohydroxide MOH (linear-ish M–O–H).
function hydroxideGeometry(Z) {
  const mO = bondLengthBohr(Z, 8) ?? 1.95 * A;
  const oH = bondLengthBohr(8, 1) ?? 0.96 * A;
  return [atom(Z, 0, 0, 0), atom(8, 0, 0, mO), atom(1, 0.9 * oH, 0, mO + 0.4 * oH)];
}
// Metal monoxide MO (diatomic).
function oxideGeometry(Z) {
  return [atom(Z, 0, 0, 0), atom(8, 0, 0, bondLengthBohr(Z, 8) ?? 1.8 * A)];
}

function reactantsFor(comps) {
  return comps.map((c) => ({ densityKgPerM3: c.densityKgPerM3 ?? 0, bulkModulusPa: c.bulkModulusPa ?? 0, molarMassKgPerMol: c.molarMassKgPerMol }));
}

// --- families ------------------------------------------------------------------------------------
// Active metal + water → metal hydroxide + hydrogen:  M + H2O → MOH + ½ H2 (monohydroxide unit).
function metalWaterReaction(metalKey, metalComp, waterComp, options = {}) {
  const Z = metalComp.Z;
  const geometry = hydroxideGeometry(Z);
  const hydroxide = { atoms: geometry, multiplicity: multiplicityForElectrons(Z + 8 + 1) };
  const model = energyModelForSpecies(hydroxide, metalComp.species, waterComp.species, H2);
  const eHydroxide = speciesEnergyHa(hydroxide, model);
  const eMetal = speciesEnergyHa(metalComp.species, model);
  const eWater = speciesEnergyHa(waterComp.species, model);
  const eH2 = speciesEnergyHa(H2, model);
  const dHHa = eHydroxide + 0.5 * eH2 - eMetal - eWater;
  const productMolarMass = (atomicMassKg(Z) + atomicMassKg(8) + atomicMassKg(1)) * AVOGADRO;
  const specificEnthalpyJPerKg = (dHHa * HARTREE_J * AVOGADRO) / productMolarMass;
  const sym = symbolForZ(Z);
  const productKey = `${sym.toLowerCase()}oh`;
  const closure = deriveCompoundClosure({
    key: productKey,
    label: `${sym}OH`,
    atomCounts: { [Z]: 1, 8: 1, 1: 1 },
    geometry,
    reactants: reactantsFor([metalComp, waterComp]),
    allowReducedEstimates: options.allowReducedProductProperties === true
  });
  return {
    dHHa,
    productKey,
    closure,
    energyModel: model,
    specificEnthalpyJPerKg,
    reactant: metalKey,
    partner: 'h2o',
    activationTemperatureK: 0,
    activationModel: 'barrier-not-yet-derived-reacts-on-exothermic-contact-with-liquid-water',
    phaseRequirements: { h2o: waterComp.reactivePhases?.length ? waterComp.reactivePhases : ['liquid', 'gas'] }
  };
}

// Metal + oxygen → metal monoxide:  M + ½ O2 → MO.
function metalOxygenReaction(metalKey, metalComp, oxComp, options = {}) {
  const Z = metalComp.Z;
  const geometry = oxideGeometry(Z);
  const oxide = { atoms: geometry, multiplicity: multiplicityForElectrons(Z + 8) };
  const model = energyModelForSpecies(oxide, metalComp.species, O2);
  const eOxide = speciesEnergyHa(oxide, model);
  const eMetal = speciesEnergyHa(metalComp.species, model);
  const eO2 = speciesEnergyHa(O2, model);
  const dHHa = eOxide - eMetal - 0.5 * eO2; // M + ½O2 → MO
  const productMolarMass = (atomicMassKg(Z) + atomicMassKg(8)) * AVOGADRO;
  const specificEnthalpyJPerKg = (dHHa * HARTREE_J * AVOGADRO) / productMolarMass;
  const sym = symbolForZ(Z);
  const productKey = `${sym.toLowerCase()}o`;
  const closure = deriveCompoundClosure({
    key: productKey,
    label: `${sym}O`,
    atomCounts: { [Z]: 1, 8: 1 },
    geometry,
    reactants: reactantsFor([metalComp, oxComp]),
    allowReducedEstimates: options.allowReducedProductProperties === true
  });
  return {
    dHHa,
    productKey,
    closure,
    energyModel: model,
    specificEnthalpyJPerKg,
    reactant: metalKey,
    partner: 'o2',
    phaseRequirements: { o2: ['gas'] }
  };
}

// Hydrogen + oxygen → water (the original combustion case, now derived through the same path).
function hydrogenOxygenReaction() {
  const model = energyModelForSpecies(H2, O2, H2O);
  const eH2 = speciesEnergyHa(H2, model); const eO2 = speciesEnergyHa(O2, model); const eH2O = speciesEnergyHa(H2O, model);
  const dHHa = eH2O - eH2 - 0.5 * eO2; // H2 + ½O2 → H2O
  const specificEnthalpyJPerKg = (dHHa * HARTREE_J * AVOGADRO) / 0.0180153;
  return {
    dHHa,
    productKey: 'h2o',
    closure: null,
    energyModel: model,
    specificEnthalpyJPerKg,
    phaseRequirements: { h2: ['gas'], o2: ['gas'] }
  };
}

/**
 * Discover the reaction network for the two block materials. Returns
 *   { reactions: [{ a, b, product, activationTemperatureK, phaseRequirements, specificEnthalpyJPerKg }],
 *     productClosures: { key: closure }, note }
 * `reactions` is empty when the pair does not react (or cannot be evaluated). `productClosures`
 * carries any derived compound closures the demo must register so the products render.
 */
const discoveryCache = new Map();

export function discoverReactions(keyA, keyB, options = {}) {
  // Cache per unordered pair: the HF solves are the demo's most expensive synchronous step, and the
  // network only depends on the two material keys (run once per pair, ever).
  const cacheKey = (options.materialProperties || options.allowFixtureMaterialProperties || options.allowReducedProductProperties)
    ? null
    : [keyA, keyB].sort().join('+');
  if (discoveryCache.has(cacheKey)) return discoveryCache.get(cacheKey);
  const result = discoverReactionsUncached(keyA, keyB, options);
  if (cacheKey) discoveryCache.set(cacheKey, result);
  return result;
}

function discoverReactionsUncached(keyA, keyB, options = {}) {
  const result = { reactions: [], productClosures: {}, note: null };
  if (keyA === keyB) { result.note = 'same material on both blocks: no reaction'; return result; }
  const ca = materialComposition(keyA, options);
  const cb = materialComposition(keyB, options);
  if (!ca || !cb) { result.note = 'unknown material'; return result; }
  requireCompositionFirstPrinciples(keyA, ca, options);
  requireCompositionFirstPrinciples(keyB, cb, options);

  const pairs = [[keyA, ca, keyB, cb], [keyB, cb, keyA, ca]];
  let rx = null;

  // Family 1: active metal + water.
  for (const [kx, cx, ky, cy] of pairs) {
    if (cx.role === 'metal' && cy.role === 'water') { rx = metalWaterReaction(kx, cx, cy, options); break; }
  }
  // Family 2: fuel/metal + oxygen.
  if (!rx) {
    for (const [kx, cx, ky, cy] of pairs) {
      if (cy.role === 'oxidizer' && cx.role === 'metal') { rx = metalOxygenReaction(kx, cx, cy, options); break; }
      if ((cx.role === 'fuel' && cy.role === 'oxidizer')) { rx = hydrogenOxygenReaction(); rx.reactant = kx; rx.partner = ky; break; }
    }
  }
  // Fallback: simplest combined binary molecule from the two element sets (conservative).
  if (!rx) rx = combinatorialReaction(keyA, ca, keyB, cb, options);

  if (!rx) { result.note = `no reaction family or candidate found for ${keyA}+${keyB}`; return result; }
  if (!(rx.specificEnthalpyJPerKg < 0)) {
    result.note = `${keyA}+${keyB} is endothermic (ΔH=${rx.dHHa.toFixed(3)} Ha): no spontaneous reaction`;
    return result;
  }

  // Activation is reaction-family-specific. Active metal + water no longer uses the metal melting
  // point as a fake barrier: solid sodium reacts with liquid water. Its gate is reactant
  // availability (`h2o` must be liquid/gas), while a true transition-state barrier is still a
  // frontier item. Other reduced families keep the older thermal proxy until their barriers are
  // derived.
  const activationTemperatureK = rx.activationTemperatureK ?? Math.max(ca.meltingPointK, cb.meltingPointK);
  if (rx.closure) result.productClosures[rx.productKey] = rx.closure;
  if (!rx.closure && options.allowFixtureMaterialProperties !== true) {
    const productProperties = propertiesForMaterial(rx.productKey, options);
    if (!productProperties) {
      throw new MaterialFirstPrinciplesResolutionError(
        `${rx.productKey} product material closure is not first-principles-derived`,
        {
          material: rx.productKey,
          context: 'reactionDiscovery.product',
          blockers: ['first-principles-product-material-closure-not-produced']
        }
      );
    }
    requireFirstPrinciplesMaterialProperties(productProperties, {
      material: rx.productKey,
      context: 'reactionDiscovery.product'
    });
  }
  result.reactions.push({
    a: keyA,
    b: keyB,
    product: rx.productKey,
    activationTemperatureK,
    activationModel: rx.activationModel ?? 'reduced-thermal-mobility-proxy-pending-derived-barrier',
    phaseRequirements: rx.phaseRequirements ?? null,
    energyModel: rx.energyModel ?? ENERGY_MODEL_HF,
    specificEnthalpyJPerKg: rx.specificEnthalpyJPerKg
  });
  result.note = `${keyA}+${keyB} → ${rx.productKey} (ΔH=${(rx.specificEnthalpyJPerKg / 1e6).toFixed(2)} MJ/kg, derived)`;
  return result;
}

// --- combinatorial fallback ----------------------------------------------------------------------
// Form one combined molecule from a single formula unit of each reactant and react if it is clearly
// more stable than the separated reactant molecules. Gated to metal+nonmetal compound formation so
// it can't fire for like-with-like (atoms→cluster always looks exothermic against isolated atoms).
function combinatorialReaction(keyA, ca, keyB, cb, options = {}) {
  const hasMetal = ca.role === 'metal' || cb.role === 'metal';
  const hasNonmetal = ca.role === 'nonmetal' || cb.role === 'nonmetal' || ca.role === 'water' || cb.role === 'water';
  if (!hasMetal || !hasNonmetal) return null;
  // Combined formula = union of one formula unit each.
  const counts = {};
  for (const c of [ca, cb]) for (const [Z, n] of Object.entries(c.elements)) counts[Z] = (counts[Z] || 0) + n;
  const geometry = clusterGeometry(counts);
  const product = { atoms: geometry, multiplicity: multiplicityForElectrons(geometry.reduce((sum, a) => sum + a.Z, 0)) };
  const model = energyModelForSpecies(product, ca.species, cb.species);
  let eProduct;
  try { eProduct = speciesEnergyHa(product, model); } catch { return null; }
  let eReact;
  try { eReact = speciesEnergyHa(ca.species, model) + speciesEnergyHa(cb.species, model); } catch { return null; }
  const dHHa = eProduct - eReact;
  if (!(dHHa < -0.02)) return null; // require a clearly exothermic compound
  const productMolarMass = Object.entries(counts).reduce((a, [Z, n]) => a + n * atomicMassKg(Number(Z)) * AVOGADRO, 0);
  const specificEnthalpyJPerKg = (dHHa * HARTREE_J * AVOGADRO) / productMolarMass;
  const label = Object.entries(counts).map(([Z, n]) => `${symbolForZ(Number(Z))}${n > 1 ? n : ''}`).join('');
  const productKey = `cmpd-${label.toLowerCase()}`;
  const closure = deriveCompoundClosure({
    key: productKey,
    label,
    atomCounts: counts,
    geometry,
    reactants: reactantsFor([ca, cb]),
    allowReducedEstimates: options.allowReducedProductProperties === true
  });
  return { dHHa, productKey, closure, energyModel: model, specificEnthalpyJPerKg, reactant: keyA, partner: keyB };
}

// A rough cluster geometry: place atoms on a small spherical shell around the origin.
function clusterGeometry(counts) {
  const atoms = [];
  const flat = [];
  for (const [Z, n] of Object.entries(counts)) for (let i = 0; i < n; i += 1) flat.push(Number(Z));
  const r = 1.6 * A;
  const N = flat.length;
  flat.forEach((Z, i) => {
    if (N === 1) { atoms.push(atom(Z, 0, 0, 0)); return; }
    const phi = Math.acos(1 - (2 * (i + 0.5)) / N);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    atoms.push(atom(Z, r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi)));
  });
  return atoms;
}
