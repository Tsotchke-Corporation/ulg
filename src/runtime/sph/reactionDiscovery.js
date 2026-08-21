// General reaction discovery for the two-material demo. Given the two block materials, decide
// whether they react and into WHAT. Reaction enthalpy comes from a compatible,
// phase-explicit standard-formation reference when every balanced term is
// covered; otherwise discovery falls back to the molecular bonding engine and
// clearly labels provisional ranking estimates. Replaces the old hardcoded
// H2+O2-only network.
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
import { describeChemicalFormula } from '../chemistry/formula.js';
import {
  PROVISIONAL_ENERGETICS_STATUS,
  commonAnionChargeMagnitude,
  commonCationCharge,
  discoverReactionCandidates,
  waterReactiveMetalClass
} from '../chemistry/reactionCandidates.js';
import { SEDENION_REACTION_SCOPE_FINGERPRINT } from '../chemistry/sedenionReactionScope.js';
import {
  STANDARD_FORMATION_ENTHALPY_FINGERPRINT,
  standardReactionEnthalpyReference
} from '../chemistry/standardFormationEnthalpy.js';
import { deriveElementProperties } from '../material/elementClosures.js';
import { deriveCompoundClosure } from '../material/compoundClosure.js';
import { deriveMaterialProperties, formulaMolarMassKgPerMol, formulaUnitGeometry } from '../material/materialDerivation.js';
import { createFirstPrinciplesMaterialClosures, createReferenceMaterialClosures } from '../material/materialClosures.js';
import {
  MaterialFirstPrinciplesResolutionError,
  materialDerivationSummary,
  requireFirstPrinciplesMaterialProperties
} from '../material/propertyProvenance.js';
import { hashPayload } from '../../../ulg-gpu-abi/src/index.js';

const A = 1.8897259886; // Ångström → Bohr
const BOHR_TO_M = 5.29177210903e-11;
const HARTREE_J = 4.3597447222071e-18;
const AVOGADRO = 6.02214076e23;
const BASIS_MAX_Z = 18;
const ENERGY_MODEL_HF = 'sto-3g-rhf-uhf';
const ENERGY_MODEL_ALL_ELEMENT = 'atomic-kohn-sham-tight-binding-v0';
export const REACTION_DISCOVERY_CACHE_RECORD_SCHEMA = 'peercompute.ulg.reaction-discovery-cache-record.v0';
export const REACTION_DISCOVERY_CACHE_KEY_SCHEMA = 'peercompute.ulg.reaction-discovery-cache-key.v0';

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
const electronCountForAtomCounts = (atomCounts) => Object.entries(atomCounts)
  .reduce((sum, [Z, count]) => sum + Number(Z) * Number(count), 0);

const REFERENCE_SPECIES = {
  h2o: { elements: { 1: 2, 8: 1 }, species: H2O, role: 'water' },
  o2: { elements: { 8: 2 }, species: O2, role: 'oxidizer' },
  h2: { elements: { 1: 2 }, species: H2, role: 'fuel' }
};

let defaultFirstPrinciplesClosureProperties = null;
let defaultFixtureClosureProperties = null;
const derivedMaterialPropertyCache = new Map();

function normalizeMaterialKeyForCache(key) {
  return String(key || '').trim().toLowerCase();
}

function materialPropertyCacheDigest(properties) {
  if (!properties) return null;
  return hashPayload({
    formula: properties.formula || null,
    label: properties.label || null,
    molarMassKgPerMol: properties.molarMassKgPerMol ?? null,
    atomsPerFormula: properties.atomsPerFormula ?? null,
    derivation: properties.derivation || null,
    phases: (properties.phases || []).map((phase) => ({
      name: phase.name,
      densityKgPerM3: phase.densityKgPerM3 ?? null,
      bulkModulusPa: phase.bulkModulusPa ?? phase.eos?.bulkModulusPa ?? null,
      shearModulusPa: phase.shearModulusPa ?? null,
      cpJPerKgK: phase.cpJPerKgK ?? null,
      thermalConductivityWPerMK: phase.thermalConductivityWPerMK ?? null,
      debyeTemperatureK: phase.debyeTemperatureK ?? null,
      temperatureRange: phase.temperatureRange || null
    })),
    transitions: (properties.transitions || []).map((transition) => ({
      from: transition.from,
      to: transition.to,
      temperatureK: transition.temperatureK ?? null,
      latentHeatJPerKg: transition.latentHeatJPerKg ?? null
    })),
    materialDerivation: materialDerivationSummary(properties),
    propertyProvenance: properties.propertyProvenance || null,
    validation: properties.validation || null
  });
}

function materialPropertiesCacheDigest(materialProperties = {}) {
  const entries = Object.entries(materialProperties || {})
    .map(([material, properties]) => [
      normalizeMaterialKeyForCache(material),
      materialPropertyCacheDigest(properties)
    ])
    .sort(([a], [b]) => a.localeCompare(b));
  return hashPayload({
    schema: 'peercompute.ulg.material-property-provenance-digest.v0',
    entries
  });
}

export function createReactionDiscoveryCacheKey(keyA, keyB, options = {}) {
  const materialPropertiesHash = options.materialProperties
    ? materialPropertiesCacheDigest(options.materialProperties)
    : null;
  const pair = [normalizeMaterialKeyForCache(keyA), normalizeMaterialKeyForCache(keyB)]
    .sort();
  return hashPayload({
    schema: REACTION_DISCOVERY_CACHE_KEY_SCHEMA,
    pair,
    materialPropertiesHash,
    allowFixtureMaterialProperties: options.allowFixtureMaterialProperties === true,
    allowReducedProductProperties: options.allowReducedProductProperties === true,
    deriveCandidateEnergies: options.deriveCandidateEnergies !== false,
    strictEnergetics: options.strictEnergetics === true,
    sedenionReactionScopeFingerprint: SEDENION_REACTION_SCOPE_FINGERPRINT,
    standardFormationEnthalpyFingerprint: STANDARD_FORMATION_ENTHALPY_FINGERPRINT
  });
}

function cloneDiscoveryResult(result) {
  if (!result) return result;
  return {
    ...result,
    reactions: (result.reactions || []).map((reaction) => ({ ...reaction })),
    productClosures: { ...(result.productClosures || {}) },
    cache: result.cache ? { ...result.cache } : null
  };
}

function discoveryRecordHasCurrentStoichiometry(record) {
  return (record?.result?.reactions || []).every((reaction) => (
    !reaction?.stoichiometry
    || (
      Array.isArray(reaction.stoichiometry.reactants)
      && Array.isArray(reaction.stoichiometry.products)
    )
  ));
}

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
    bulkModulusPa: phase?.bulkModulusPa ?? phase?.eos?.bulkModulusPa ?? 0,
    thermalConductivityWPerMK: phase?.thermalConductivityWPerMK ?? 0
  };
}

function reactiveWaterPhases(properties) {
  const phases = properties?.phases?.map((phase) => phase.name) || [];
  return phases.filter((phase) => phase === 'liquid' || phase === 'gas');
}

function roleForElementZ(Z, props) {
  const anionCharge = commonAnionChargeMagnitude(Z);
  const cationCharge = commonCationCharge(Z);
  if (anionCharge && !cationCharge) return 'nonmetal';
  if (cationCharge && !anionCharge) return 'metal';
  return props?.metallicModelApplicable === true ? 'metal' : 'nonmetal';
}

function formulaSpecies(atomCounts) {
  const geometry = formulaUnitGeometry(atomCounts);
  return {
    atoms: geometry,
    multiplicity: multiplicityForElectrons(electronCountForAtomCounts(atomCounts))
  };
}

function parsedFormulaComposition(key, properties) {
  let formula;
  const formulaInput = typeof properties?.formula === 'string' && properties.formula.length > 0
    ? properties.formula
    : key;
  try {
    formula = describeChemicalFormula(formulaInput);
  } catch {
    return null;
  }
  const single = formula.elementCount === 1 ? formula.elements[0] : null;
  if (single && single.count === 1 && formulaInput === key) return null;
  const phaseNames = properties?.phases?.map((phase) => phase.name) || [];
  const role = single ? roleForElementZ(single.Z, deriveElementProperties(single.Z)) : 'compound';
  const mechanical = properties ? closureMechanicalInputs(properties, role) : {
    densityKgPerM3: 0,
    bulkModulusPa: 0
  };
  return {
    formula: formula.formula,
    elements: formula.atomCounts,
    species: formulaSpecies(formula.atomCounts),
    molarMassKgPerMol: properties?.molarMassKgPerMol ?? formula.molarMassKgPerMol,
    meltingPointK: firstTransitionTemperature(properties, 'solid', 'liquid') ?? 0,
    reactivePhases: phaseNames,
    role,
    ...mechanical,
    materialDerivation: properties ? materialDerivationSummary(properties) : null
  };
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
      formula: key,
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

  const parsed = parsedFormulaComposition(key, properties);
  if (parsed) return parsed;

  const symbol = canonicalElementSymbol(key);
  const Z = symbol ? zForSymbol(symbol) : null;
  if (Z == null) return null;
  const props = deriveElementProperties(Z);
  const elementProperties = properties || null;
  const role = roleForElementZ(Z, props);
  const metalLike = role === 'metal';
  const mechanical = properties ? closureMechanicalInputs(properties, role) : {
    densityKgPerM3: props.densityKgPerM3 ?? 0,
    bulkModulusPa: props.bulkModulusPa ?? 0
  };
  return {
    formula: symbol,
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
    context: 'reactionDiscovery.materialComposition',
    allowedFallbackSources: ['material-property-reference-bank']
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
  return comps.map((c) => ({
    material: c.formula ?? null,
    densityKgPerM3: c.densityKgPerM3 ?? 0,
    bulkModulusPa: c.bulkModulusPa ?? 0,
    thermalConductivityWPerMK: c.thermalConductivityWPerMK ?? 0,
    molarMassKgPerMol: c.molarMassKgPerMol
  }));
}

function cachedProductClosureFor(productKey, options = {}) {
  const key = normalizeMaterialKeyForCache(productKey);
  const candidates = [
    options.productClosures?.[productKey],
    options.productClosures?.[key],
    options.cachedProductClosures?.[productKey],
    options.cachedProductClosures?.[key],
    options.closures?.[productKey],
    options.closures?.[key]
  ].filter(Boolean);
  const found = candidates.find((candidate) => candidate?.properties);
  if (!found) return null;
  return {
    ...found,
    cacheReuse: {
      status: 'reused-product-closure',
      productKey,
      source: found.provenance?.source || found.cacheStatus || 'provided-product-closure'
    }
  };
}

function sameAtomCounts(a, b) {
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const key of keys) {
    if (Number(a?.[key] || 0) !== Number(b?.[key] || 0)) return false;
  }
  return true;
}

function speciesForReactionTerm(termSpec, ca, cb) {
  if (sameAtomCounts(termSpec.atomCounts, ca.elements)) return ca.species;
  if (sameAtomCounts(termSpec.atomCounts, cb.elements)) return cb.species;
  if (sameAtomCounts(termSpec.atomCounts, { 1: 2 })) return H2;
  if (sameAtomCounts(termSpec.atomCounts, { 8: 2 })) return O2;
  if (sameAtomCounts(termSpec.atomCounts, { 1: 2, 8: 1 })) return H2O;
  return formulaSpecies(termSpec.atomCounts);
}

function termEnergySumHa(terms, ca, cb, model) {
  return terms.reduce((sum, termSpec) => (
    sum + termSpec.coefficient * speciesEnergyHa(speciesForReactionTerm(termSpec, ca, cb), model)
  ), 0);
}

function waterKeyForCandidate(candidate, keyA, ca, keyB, cb) {
  if (sameAtomCounts(ca.elements, { 1: 2, 8: 1 })) return keyA;
  if (sameAtomCounts(cb.elements, { 1: 2, 8: 1 })) return keyB;
  return candidate.reactants.find((reactant) => sameAtomCounts(reactant.atomCounts, { 1: 2, 8: 1 }))?.formula?.toLowerCase() || 'h2o';
}

function waterReactiveClassForCandidate(candidate, ca, cb) {
  if (candidate.familyId !== 'active-metal-water-hydroxide') return null;
  const metalComp = sameAtomCounts(ca.elements, { 1: 2, 8: 1 }) ? cb : ca;
  return waterReactiveMetalClass(metalComp.Z) || null;
}

// Alkali metal + gaseous halogen ignites on exothermic contact: the gas
// reactant supplies the encounter mobility the melting-point proxy stood in
// for, and group-1 metals carry no passivation barrier - the same contact
// rule the active-metal/water family already uses (solid Na + liquid H2O).
// Group membership is periodic-table structure, not a per-material patch.
// Br2/I2 (liquid/solid at ambient) keep the thermal proxy until true
// transition-state barriers are derived (frontier item).
const AMBIENT_GAS_HALOGEN_Z = new Set([9, 17]);
// Sole element of a single-element species (elemental metals {55:1} and
// homonuclear diatomics like F2 {9:2} both qualify).
function soleElementZ(comp) {
  const elements = comp?.elements || comp?.atomCounts || null;
  const keys = elements ? Object.keys(elements) : [];
  if (keys.length === 1) return Number(keys[0]);
  return Number.isFinite(comp?.Z) ? comp.Z : null;
}
function alkaliGasHalogenContactClass(candidate, ca, cb) {
  if (candidate.familyId !== 'binary-ionic-synthesis') return null;
  const caZ = soleElementZ(ca);
  const cbZ = soleElementZ(cb);
  const caClass = waterReactiveMetalClass(caZ);
  const cbClass = waterReactiveMetalClass(cbZ);
  const metalClass = caClass || cbClass;
  if (metalClass !== 'alkali-metal-water-reactive') return null;
  const partnerZ = caClass ? cbZ : caZ;
  if (!AMBIENT_GAS_HALOGEN_Z.has(partnerZ)) return null;
  return 'alkali-gas-halogen-contact';
}

function stoichiometricCandidateReaction(keyA, ca, keyB, cb, options = {}) {
  const discovery = discoverReactionCandidates(ca?.formula || keyA, cb?.formula || keyB, options);
  const candidate = discovery.candidates.find((item) => item.atomBalance?.balanced === true) || null;
  if (!candidate) return null;
  const species = [
    ...candidate.reactants.map((termSpec) => speciesForReactionTerm(termSpec, ca, cb)),
    ...candidate.products.map((termSpec) => speciesForReactionTerm(termSpec, ca, cb))
  ];
  const model = energyModelForSpecies(...species);
  const largestSpeciesAtomCount = Math.max(...species.map((item) => item.atoms?.length || 0));
  const deriveCandidateEnergy = options.deriveCandidateEnergies !== false
    && !(model === ENERGY_MODEL_HF && largestSpeciesAtomCount > 4);
  let dHHa;
  try {
    if (!deriveCandidateEnergy) throw new Error('candidate energy derivation skipped for large light-element formula');
    dHHa = termEnergySumHa(candidate.products, ca, cb, model)
      - termEnergySumHa(candidate.reactants, ca, cb, model);
  } catch {
    dHHa = null;
  }
  const balancedReactantMassKgPerEquation = candidate.reactants.reduce((sum, term) => (
    sum + Math.max(0, Number(term.coefficient) || 0) * formulaMolarMassKgPerMol(term.atomCounts)
  ), 0);
  const referenceEnergetics = standardReactionEnthalpyReference(candidate);
  const referenceSpecificEnthalpyJPerKg = referenceEnergetics
    ? referenceEnergetics.reactionEnthalpyJPerBalancedEquation
      / balancedReactantMassKgPerEquation
    : null;
  const derivedSpecificEnthalpyJPerKg = Number.isFinite(dHHa)
    ? (dHHa * HARTREE_J * AVOGADRO) / balancedReactantMassKgPerEquation
    : null;
  const candidateSpecificEnthalpyJPerKg = Number.isFinite(candidate.energetics.reactionEnthalpyJPerBalancedEquation)
    ? candidate.energetics.reactionEnthalpyJPerBalancedEquation / balancedReactantMassKgPerEquation
    : candidate.energetics.specificEnthalpyJPerKgProduct;
  const useReferenceEnergy = Number.isFinite(referenceSpecificEnthalpyJPerKg)
    && referenceSpecificEnthalpyJPerKg < 0;
  const useDerivedEnergy = !useReferenceEnergy
    && Number.isFinite(derivedSpecificEnthalpyJPerKg)
    && (derivedSpecificEnthalpyJPerKg < 0 || !(candidateSpecificEnthalpyJPerKg < 0));
  const provisionalEnergeticsStatus = useReferenceEnergy || useDerivedEnergy
    ? null
    : PROVISIONAL_ENERGETICS_STATUS;
  const specificEnthalpyJPerKg = useReferenceEnergy
    ? referenceSpecificEnthalpyJPerKg
    : (useDerivedEnergy ? derivedSpecificEnthalpyJPerKg : candidateSpecificEnthalpyJPerKg);
  const energyModel = useReferenceEnergy
    ? referenceEnergetics.model
    : (useDerivedEnergy ? model : candidate.energetics.model);
  if (options.strictEnergetics === true && provisionalEnergeticsStatus) {
    return {
      dHHa: Number.isFinite(dHHa)
        ? dHHa
        : null,
      productKey: candidate.productKey,
      closure: null,
      energyModel,
      specificEnthalpyJPerKg,
      reactant: keyA,
      partner: keyB,
      blockedEnergeticsStatus: 'needs-refined-thermochemistry',
      blockedReason: 'strict energetics rejects provisional heuristic reaction energy',
      sedenionScope: candidate.sedenionScope ?? null,
      stoichiometry: {
        familyId: candidate.familyId,
        equation: candidate.equation,
        reactants: candidate.reactants,
        products: candidate.products,
        atomBalance: candidate.atomBalance,
        sedenionScope: candidate.sedenionScope ?? null,
        provisionalEnergeticsStatus,
        energeticsStatus: useReferenceEnergy
          ? referenceEnergetics.status
          : (useDerivedEnergy ? 'derived-model-energy-ready' : candidate.energetics.status),
        thermochemicalReference: useReferenceEnergy ? referenceEnergetics : null,
        balancedReactantMassKgPerEquation,
        specificEnthalpyBasis: 'consumed-reactant-mass',
        rejectedDerivedEnergyHa: Number.isFinite(dHHa) && !useDerivedEnergy ? dHHa : null,
        scientificValidation: false
      }
    };
  }
  const geometry = formulaUnitGeometry(candidate.productAtomCounts);
  const closure = cachedProductClosureFor(candidate.productKey, options)
    || deriveCompoundClosure({
      key: candidate.productKey,
      label: candidate.productFormula,
      atomCounts: candidate.productAtomCounts,
      geometry,
      reactants: reactantsFor([ca, cb]),
      allowReducedEstimates: options.allowReducedProductProperties === true
    });
  const waterProperties = sameAtomCounts(ca.elements, { 1: 2, 8: 1 })
    ? propertiesForMaterial(keyA, options)
    : propertiesForMaterial(keyB, options);
  const waterPhases = reactiveWaterPhases(waterProperties);
  const phaseRequirements = candidate.familyId === 'active-metal-water-hydroxide'
    ? { [waterKeyForCandidate(candidate, keyA, ca, keyB, cb)]: waterPhases.length ? waterPhases : ['liquid', 'gas'] }
    : null;
  const waterReactiveClass = waterReactiveClassForCandidate(candidate, ca, cb);
  const alkaliHalogenClass = alkaliGasHalogenContactClass(candidate, ca, cb);
  return {
    dHHa: useReferenceEnergy
      ? referenceEnergetics.reactionEnthalpyJPerBalancedEquation / (HARTREE_J * AVOGADRO)
      : useDerivedEnergy
      ? dHHa
      : specificEnthalpyJPerKg * balancedReactantMassKgPerEquation / (HARTREE_J * AVOGADRO),
    productKey: candidate.productKey,
    closure,
    energyModel,
    specificEnthalpyJPerKg,
    reactant: keyA,
    partner: keyB,
    activationTemperatureK: candidate.familyId === 'active-metal-water-hydroxide' || alkaliHalogenClass
      ? 0
      : undefined,
    activationModel: candidate.familyId === 'active-metal-water-hydroxide'
      ? `barrier-not-yet-derived-${waterReactiveClass || 'water-reactive-metal'}-reacts-on-exothermic-contact-with-liquid-water`
      : alkaliHalogenClass
      ? 'barrier-not-yet-derived-alkali-metal-ignites-on-exothermic-contact-with-gaseous-halogen'
      : 'stoichiometric-reaction-candidate-derived-energy-pending-derived-barrier',
    phaseRequirements,
    sedenionScope: candidate.sedenionScope ?? null,
    stoichiometry: {
      familyId: candidate.familyId,
      equation: candidate.equation,
      reactants: candidate.reactants,
      products: candidate.products,
      atomBalance: candidate.atomBalance,
      sedenionScope: candidate.sedenionScope ?? null,
      provisionalEnergeticsStatus,
      energeticsStatus: useReferenceEnergy
        ? referenceEnergetics.status
        : (useDerivedEnergy ? 'derived-model-energy-ready' : candidate.energetics.status),
      thermochemicalReference: useReferenceEnergy ? referenceEnergetics : null,
      balancedReactantMassKgPerEquation,
      specificEnthalpyBasis: 'consumed-reactant-mass',
      rejectedDerivedEnergyHa: Number.isFinite(dHHa) && !useDerivedEnergy ? dHHa : null,
      scientificValidation: false
    }
  };
}

function derivedStoichiometryFromStrictBlocker(blocker) {
  if (!blocker?.stoichiometry) return null;
  return {
    ...blocker.stoichiometry,
    provisionalEnergeticsStatus: null,
    replacedProvisionalEnergeticsStatus: blocker.stoichiometry.provisionalEnergeticsStatus || null,
    energeticsStatus: 'derived-family-energy-replaced-provisional-candidate',
    rejectedDerivedEnergyHa: blocker.stoichiometry.rejectedDerivedEnergyHa ?? null,
    scientificValidation: false
  };
}

// --- families ------------------------------------------------------------------------------------
// Active metal + water → metal hydroxide + hydrogen:  M + H2O → MOH + ½ H2 (monohydroxide unit).
function metalWaterReaction(metalKey, metalComp, waterComp, options = {}) {
  const Z = metalComp.Z;
  const waterReactiveClass = waterReactiveMetalClass(Z);
  if (!waterReactiveClass) return null;
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
  const closure = cachedProductClosureFor(productKey, options)
    || deriveCompoundClosure({
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
    activationModel: `barrier-not-yet-derived-${waterReactiveClass}-reacts-on-exothermic-contact-with-liquid-water`,
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
  const closure = cachedProductClosureFor(productKey, options)
    || deriveCompoundClosure({
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

export function clearReactionDiscoveryCache() {
  discoveryCache.clear();
}

export function reactionDiscoveryCacheInfo() {
  return {
    schema: 'peercompute.ulg.reaction-discovery-cache-info.v0',
    size: discoveryCache.size
  };
}

export const REACTION_NETWORK_DISCOVERY_SCHEMA = 'peercompute.ulg.reaction-network-discovery.v0';

function compareCanonicalText(a, b) {
  return a < b ? -1 : (a > b ? 1 : 0);
}

function canonicalMaterialList(materialKeys) {
  if (!Array.isArray(materialKeys)) {
    throw new TypeError('discoverReactionNetwork materialKeys must be an array');
  }
  return [...new Set(materialKeys
    .map((key) => normalizeMaterialKeyForCache(key))
    .filter((key) => key.length > 0))]
    .sort(compareCanonicalText);
}

function materialPropertiesWithCanonicalAliases(materialProperties) {
  if (!materialProperties || typeof materialProperties !== 'object') return materialProperties;
  const aliased = { ...materialProperties };
  const entries = Object.entries(materialProperties)
    .sort(([a], [b]) => compareCanonicalText(a, b));
  for (const [key, properties] of entries) {
    const canonicalKey = normalizeMaterialKeyForCache(key);
    if (!canonicalKey || Object.hasOwn(aliased, canonicalKey)) continue;
    aliased[canonicalKey] = properties;
  }
  return aliased;
}

function canonicalReactionSpecies(term = {}) {
  const atomCounts = Object.entries(term.atomCounts || {})
    .map(([atomicNumber, count]) => [Number(atomicNumber), Number(count)])
    .filter(([atomicNumber, count]) => Number.isFinite(atomicNumber) && Number.isFinite(count) && count !== 0)
    .sort(([a], [b]) => a - b);
  if (atomCounts.length > 0) {
    return `atoms:${atomCounts.map(([atomicNumber, count]) => `${atomicNumber}:${count}`).join(',')}`;
  }
  return `formula:${normalizeMaterialKeyForCache(term.formula)}`;
}

function greatestCommonDivisor(a, b) {
  let left = Math.abs(a);
  let right = Math.abs(b);
  while (right > 0) [left, right] = [right, left % right];
  return left;
}

function canonicalStoichiometrySide(terms, coefficientDivisor) {
  const coefficientBySpecies = new Map();
  for (const term of terms || []) {
    const species = canonicalReactionSpecies(term);
    const coefficient = Number(term.coefficient);
    const finiteCoefficient = Number.isFinite(coefficient) ? coefficient : 1;
    coefficientBySpecies.set(species, (coefficientBySpecies.get(species) || 0) + finiteCoefficient);
  }
  return [...coefficientBySpecies.entries()]
    .sort(([a], [b]) => compareCanonicalText(a, b))
    .map(([species, coefficient]) => `${coefficient / coefficientDivisor}:${species}`)
    .join('+');
}

function canonicalReactionIdentity(reaction) {
  const reactants = reaction?.stoichiometry?.reactants;
  const products = reaction?.stoichiometry?.products;
  if (Array.isArray(reactants) && Array.isArray(products)) {
    const coefficients = [...reactants, ...products].map((term) => Number(term.coefficient));
    const integralCoefficients = coefficients.length > 0
      && coefficients.every((coefficient) => Number.isSafeInteger(coefficient) && coefficient > 0);
    const coefficientDivisor = integralCoefficients
      ? coefficients.reduce(greatestCommonDivisor)
      : 1;
    return `stoichiometry:${canonicalStoichiometrySide(reactants, coefficientDivisor)}->${canonicalStoichiometrySide(products, coefficientDivisor)}`;
  }
  const pair = [
    normalizeMaterialKeyForCache(reaction?.a),
    normalizeMaterialKeyForCache(reaction?.b)
  ].sort(compareCanonicalText);
  return `reaction:${pair.join('+')}->${normalizeMaterialKeyForCache(reaction?.product)}`;
}

/**
 * Discover the complete reaction network for an arbitrary material set. Material keys and pairs
 * are canonicalized before pair discovery, so results do not depend on block or input ordering.
 * Equivalent pair results are merged by atom-count stoichiometry while retaining every source pair.
 * Options are passed through to `discoverReactions`; in particular, `options.materialProperties`
 * supplies the same property/provenance inputs as pair discovery.
 */
export function discoverReactionNetwork(materialKeys, options = {}) {
  const materials = canonicalMaterialList(materialKeys);
  const pairOptions = options.materialProperties
    ? {
        ...options,
        materialProperties: materialPropertiesWithCanonicalAliases(options.materialProperties)
      }
    : options;
  const reactionByIdentity = new Map();
  const productClosureByKey = new Map();
  const pairDiagnostics = [];

  for (let leftIndex = 0; leftIndex < materials.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < materials.length; rightIndex += 1) {
      const pair = [materials[leftIndex], materials[rightIndex]];
      const discovery = discoverReactions(pair[0], pair[1], pairOptions);
      const reactionIdentities = [];
      for (const reaction of discovery.reactions || []) {
        const identity = canonicalReactionIdentity(reaction);
        reactionIdentities.push(identity);
        const existing = reactionByIdentity.get(identity);
        const sourcePairs = existing?.reactionDiscovery?.sourcePairs || [];
        reactionByIdentity.set(identity, {
          ...(existing || reaction),
          reactionDiscovery: {
            schema: REACTION_NETWORK_DISCOVERY_SCHEMA,
            canonicalStoichiometryIdentity: identity,
            sourcePairs: [...sourcePairs, pair]
          }
        });
      }
      for (const [productKey, closure] of Object.entries(discovery.productClosures || {})) {
        if (!productClosureByKey.has(productKey)) productClosureByKey.set(productKey, closure);
      }
      pairDiagnostics.push({
        pair,
        cacheKey: discovery.cache?.cacheKey || null,
        reactionCount: discovery.reactions?.length || 0,
        reactionIdentities: reactionIdentities.sort(compareCanonicalText),
        blockers: [...(discovery.blockers || [])].sort(compareCanonicalText),
        blockedProduct: discovery.blockedReactionCandidate?.product || null,
        note: discovery.note || null
      });
    }
  }

  const reactions = [...reactionByIdentity.entries()]
    .sort(([a], [b]) => compareCanonicalText(a, b))
    .map(([, reaction]) => reaction);
  const productClosures = Object.fromEntries(
    [...productClosureByKey.entries()].sort(([a], [b]) => compareCanonicalText(a, b))
  );
  return {
    schema: REACTION_NETWORK_DISCOVERY_SCHEMA,
    materials,
    pairCount: pairDiagnostics.length,
    reactions,
    productClosures,
    pairDiagnostics,
    note: `${reactions.length} unique reaction${reactions.length === 1 ? '' : 's'} discovered across ${pairDiagnostics.length} material pair${pairDiagnostics.length === 1 ? '' : 's'}`
  };
}

export function discoverReactions(keyA, keyB, options = {}) {
  // Cache per unordered pair plus material/provenance digest. The HF/all-element solves are the
  // demo's most expensive synchronous step, and the normal demo path always supplies material
  // properties. Supplying those properties must strengthen the cache key, not disable caching.
  const cacheKey = createReactionDiscoveryCacheKey(keyA, keyB, options);
  const providedRecord = options.reactionDiscoveryCacheRecord || options.cachedReactionDiscoveryRecord || null;
  if (
    providedRecord?.schema === REACTION_DISCOVERY_CACHE_RECORD_SCHEMA
    && providedRecord.cacheKey === cacheKey
    && discoveryRecordHasCurrentStoichiometry(providedRecord)
    && providedRecord.result
  ) {
    const fromRecord = cloneDiscoveryResult(providedRecord.result);
    fromRecord.cache = {
      ...(fromRecord.cache || {}),
      schema: REACTION_DISCOVERY_CACHE_RECORD_SCHEMA,
      cacheKey,
      cacheStatus: 'persistent-cache-hit',
      source: providedRecord.provenance?.source || 'provided-reaction-discovery-cache-record',
      updatedAt: providedRecord.updatedAt || null
    };
    discoveryCache.set(cacheKey, cloneDiscoveryResult(fromRecord));
    return fromRecord;
  }
  if (discoveryCache.has(cacheKey)) {
    const cached = cloneDiscoveryResult(discoveryCache.get(cacheKey));
    cached.cache = {
      ...(cached.cache || {}),
      cacheKey,
      cacheStatus: 'memory-cache-hit'
    };
    return cached;
  }
  const result = discoverReactionsUncached(keyA, keyB, options);
  result.cache = {
    schema: REACTION_DISCOVERY_CACHE_RECORD_SCHEMA,
    cacheKey,
    cacheStatus: 'derived-cache-miss',
    materialPropertiesHash: options.materialProperties
      ? materialPropertiesCacheDigest(options.materialProperties)
      : null,
    pair: [normalizeMaterialKeyForCache(keyA), normalizeMaterialKeyForCache(keyB)].sort(),
    allowFixtureMaterialProperties: options.allowFixtureMaterialProperties === true,
    allowReducedProductProperties: options.allowReducedProductProperties === true,
    deriveCandidateEnergies: options.deriveCandidateEnergies !== false,
    strictEnergetics: options.strictEnergetics === true,
    sedenionReactionScopeFingerprint: SEDENION_REACTION_SCOPE_FINGERPRINT,
    standardFormationEnthalpyFingerprint: STANDARD_FORMATION_ENTHALPY_FINGERPRINT
  };
  discoveryCache.set(cacheKey, cloneDiscoveryResult(result));
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

  // General candidate layer: formula parsing + atom-balanced stoichiometric families. This handles
  // arbitrary element/formula pairs such as Li/H2O, Cs/H2O, Na/Cl2, and Al/O2 without relying on the
  // old three-compound recognizer or monoxides-only fallback. Product properties remain derived
  // through the same material closure path; validation flags stay false until benchmarked.
  const stoichiometricRx = stoichiometricCandidateReaction(keyA, ca, keyB, cb, options);
  const strictEnergeticsBlocker = stoichiometricRx?.blockedEnergeticsStatus ? stoichiometricRx : null;
  rx = strictEnergeticsBlocker ? null : stoichiometricRx;

  // Family 1: active metal + water.
  if (!rx) {
    for (const [kx, cx, ky, cy] of pairs) {
      if (cx.role === 'metal' && cy.role === 'water') { rx = metalWaterReaction(kx, cx, cy, options); break; }
    }
  }
  // Family 2: fuel/metal + oxygen.
  if (!rx) {
    for (const [kx, cx, ky, cy] of pairs) {
      if (cy.role === 'oxidizer' && cx.role === 'metal') { rx = metalOxygenReaction(kx, cx, cy, options); break; }
      if ((cx.role === 'fuel' && cy.role === 'oxidizer')) { rx = hydrogenOxygenReaction(); rx.reactant = kx; rx.partner = ky; break; }
    }
  }
  // Fallback: simplest combined binary molecule from the two element sets (conservative).
  if (!rx && !strictEnergeticsBlocker) rx = combinatorialReaction(keyA, ca, keyB, cb, options);

  if (
    rx
    && strictEnergeticsBlocker
    && !rx.stoichiometry
    && rx.productKey === strictEnergeticsBlocker.productKey
  ) {
    rx.stoichiometry = derivedStoichiometryFromStrictBlocker(strictEnergeticsBlocker);
  }

  if (!rx) {
    result.note = strictEnergeticsBlocker
      ? `${keyA}+${keyB} blocked: ${strictEnergeticsBlocker.blockedReason}; ${strictEnergeticsBlocker.blockedEnergeticsStatus}`
      : `no reaction family or candidate found for ${keyA}+${keyB}`;
    result.blockers = strictEnergeticsBlocker ? [strictEnergeticsBlocker.blockedEnergeticsStatus] : [];
    result.blockedReactionCandidate = strictEnergeticsBlocker ? {
      product: strictEnergeticsBlocker.productKey,
      energyModel: strictEnergeticsBlocker.energyModel,
      stoichiometry: strictEnergeticsBlocker.stoichiometry,
      sedenionScope: strictEnergeticsBlocker.sedenionScope ?? strictEnergeticsBlocker.stoichiometry?.sedenionScope ?? null,
      reason: strictEnergeticsBlocker.blockedReason
    } : null;
    return result;
  }
  if (options.strictEnergetics === true && rx.stoichiometry?.provisionalEnergeticsStatus) {
    result.note = `${keyA}+${keyB} blocked: strict energetics rejects provisional heuristic reaction energy; needs-refined-thermochemistry`;
    result.blockers = ['needs-refined-thermochemistry'];
    result.blockedReactionCandidate = {
      product: rx.productKey,
      energyModel: rx.energyModel,
      stoichiometry: rx.stoichiometry,
      sedenionScope: rx.sedenionScope ?? rx.stoichiometry?.sedenionScope ?? null,
      reason: 'strict energetics rejects provisional heuristic reaction energy'
    };
    return result;
  }
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
    specificEnthalpyJPerKg: rx.specificEnthalpyJPerKg,
    sedenionScope: rx.sedenionScope ?? rx.stoichiometry?.sedenionScope ?? null,
    stoichiometry: rx.stoichiometry ?? null
  });
  const energySource = rx.stoichiometry?.thermochemicalReference
    ? 'reference thermochemistry'
    : (rx.stoichiometry?.provisionalEnergeticsStatus
        ? 'provisional candidate energy'
        : 'derived');
  result.note = `${keyA}+${keyB} → ${rx.productKey} (ΔH=${(rx.specificEnthalpyJPerKg / 1e6).toFixed(2)} MJ/kg, ${energySource})`;
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
  const closure = cachedProductClosureFor(productKey, options)
    || deriveCompoundClosure({
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
