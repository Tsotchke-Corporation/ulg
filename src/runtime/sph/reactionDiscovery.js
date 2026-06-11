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
// HARD LIMIT: the STO-3G basis covers Z = 1–18 (H–Ar). A material containing any heavier element
// (e.g. Fe, Z=26) cannot have an engine-derived enthalpy, so no reaction is produced for it and the
// reason is reported. Evidence-only throughout: validation flags stay false.

import { rhf, _uhf as uhf } from '../electronicStructure/molecularHartreeFock.js';
import { atomicMassKg, zForSymbol, symbolForZ } from '../electronicStructure/periodicTable.js';
import { deriveElementProperties } from '../material/elementClosures.js';
import { deriveCompoundClosure } from '../material/compoundClosure.js';

const A = 1.8897259886; // Ångström → Bohr
const HARTREE_J = 4.3597447222071e-18;
const AVOGADRO = 6.02214076e23;
const BASIS_MAX_Z = 18;
const WATER_MELT_K = 273.15;

const atom = (Z, x, y, z) => ({ Z, position: [x, y, z] });
const speciesEnergyHa = (s) => (s.multiplicity && s.multiplicity > 1 ? uhf(s.atoms, { multiplicity: s.multiplicity }) : rhf(s.atoms)).totalEnergyHa;

// --- reference geometries (Bohr) -----------------------------------------------------------------
const H2 = { atoms: [atom(1, 0, 0, 0), atom(1, 0, 0, 0.741 * A)], multiplicity: 1 };
const O2 = { atoms: [atom(8, 0, 0, 0), atom(8, 0, 0, 1.208 * A)], multiplicity: 3 };
const H2O = { atoms: [atom(8, 0, 0, 0), atom(1, 0.757 * A, 0, 0.587 * A), atom(1, -0.757 * A, 0, 0.587 * A)], multiplicity: 1 };

// Spin multiplicity from a simple electron-count parity rule (odd → doublet, even → singlet). O is
// the notable triplet exception handled where it matters (O2 is set explicitly above).
const multiplicityForElectrons = (nElectrons) => (nElectrons % 2 === 1 ? 2 : 1);
const atomMultiplicity = (Z) => multiplicityForElectrons(Z);

/**
 * Describe a demo material as a chemical species: its element formula, the molecular species used for
 * its reactant energy, molar mass, melting point (mobility proxy for the activation gate), and role.
 */
export function materialComposition(key) {
  if (key === 'h2o') {
    return { elements: { 1: 2, 8: 1 }, species: H2O, molarMassKgPerMol: 0.0180153, meltingPointK: WATER_MELT_K, role: 'water' };
  }
  if (key === 'o2') {
    return { elements: { 8: 2 }, species: O2, molarMassKgPerMol: 0.0319988, meltingPointK: 54.36, role: 'oxidizer' };
  }
  if (key === 'h2') {
    return { elements: { 1: 2 }, species: H2, molarMassKgPerMol: 0.00201588, meltingPointK: 13.99, role: 'fuel' };
  }
  if (key === 'fe') {
    return { elements: { 26: 1 }, species: null, molarMassKgPerMol: 0.055845, meltingPointK: 1811, role: 'metal' };
  }
  const Z = zForSymbol(key);
  if (Z == null) return null;
  const props = deriveElementProperties(Z);
  return {
    elements: { [Z]: 1 },
    species: { atoms: [atom(Z, 0, 0, 0)], multiplicity: atomMultiplicity(Z) },
    molarMassKgPerMol: atomicMassKg(Z) * AVOGADRO,
    meltingPointK: props.metallicModelApplicable ? props.meltingPointK : 300,
    valence: props.valenceElectrons,
    metal: props.metallicModelApplicable,
    densityKgPerM3: props.densityKgPerM3 ?? 0,
    bulkModulusPa: props.bulkModulusPa ?? 0,
    Z,
    role: props.metallicModelApplicable ? 'metal' : 'nonmetal'
  };
}

const allInBasis = (comp) => Object.keys(comp.elements).every((Z) => Number(Z) <= BASIS_MAX_Z);

// --- product geometry builders -------------------------------------------------------------------
// Products are kept to a single small formula unit (≤3 atoms) so the per-reaction HF solve stays
// fast enough to run synchronously at demo build (the engine is O(nBasis⁴); a 4-atom period-3 cluster
// is tens of seconds). This is a reduced-stoichiometry representation: the metal hydroxide is modelled
// by its MOH unit and the oxide by its MO unit regardless of valence — exact for monovalent metals
// (NaOH) and a documented approximation for multivalent ones. The per-kg enthalpy stays engine-derived.
// Metal monohydroxide MOH (linear-ish M–O–H).
function hydroxideGeometry(Z) {
  const mO = 1.95 * A; const oH = 0.96 * A;
  return [atom(Z, 0, 0, 0), atom(8, 0, 0, mO), atom(1, 0.9 * oH, 0, mO + 0.4 * oH)];
}
// Metal monoxide MO (diatomic).
function oxideGeometry(Z) {
  return [atom(Z, 0, 0, 0), atom(8, 0, 0, 1.8 * A)];
}

function reactantsFor(comps) {
  return comps.map((c) => ({ densityKgPerM3: c.densityKgPerM3 ?? 0, bulkModulusPa: c.bulkModulusPa ?? 0, molarMassKgPerMol: c.molarMassKgPerMol }));
}

// --- families ------------------------------------------------------------------------------------
// Active metal + water → metal hydroxide + hydrogen:  M + H2O → MOH + ½ H2 (monohydroxide unit).
function metalWaterReaction(metalKey, metalComp, waterComp) {
  const Z = metalComp.Z;
  const geometry = hydroxideGeometry(Z);
  const eHydroxide = speciesEnergyHa({ atoms: geometry, multiplicity: multiplicityForElectrons(Z + 8 + 1) });
  const eMetal = speciesEnergyHa(metalComp.species);
  const eWater = speciesEnergyHa(waterComp.species);
  const eH2 = speciesEnergyHa(H2);
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
    reactants: reactantsFor([metalComp, waterComp])
  });
  return { dHHa, productKey, closure, specificEnthalpyJPerKg, reactant: metalKey, partner: 'h2o' };
}

// Metal + oxygen → metal monoxide:  M + ½ O2 → MO.
function metalOxygenReaction(metalKey, metalComp, oxComp) {
  const Z = metalComp.Z;
  const geometry = oxideGeometry(Z);
  const eOxide = speciesEnergyHa({ atoms: geometry, multiplicity: multiplicityForElectrons(Z + 8) });
  const eMetal = speciesEnergyHa(metalComp.species);
  const eO2 = speciesEnergyHa(O2);
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
    reactants: reactantsFor([metalComp, oxComp])
  });
  return { dHHa, productKey, closure, specificEnthalpyJPerKg, reactant: metalKey, partner: 'o2' };
}

// Hydrogen + oxygen → water (the original combustion case, now derived through the same path).
function hydrogenOxygenReaction() {
  const eH2 = speciesEnergyHa(H2); const eO2 = speciesEnergyHa(O2); const eH2O = speciesEnergyHa(H2O);
  const dHHa = eH2O - eH2 - 0.5 * eO2; // H2 + ½O2 → H2O
  const specificEnthalpyJPerKg = (dHHa * HARTREE_J * AVOGADRO) / 0.0180153;
  return { dHHa, productKey: 'h2o', closure: null, specificEnthalpyJPerKg };
}

/**
 * Discover the reaction network for the two block materials. Returns
 *   { reactions: [{ a, b, product, activationTemperatureK, specificEnthalpyJPerKg }],
 *     productClosures: { key: closure }, note }
 * `reactions` is empty when the pair does not react (or cannot be evaluated). `productClosures`
 * carries any derived compound closures the demo must register so the products render.
 */
const discoveryCache = new Map();

export function discoverReactions(keyA, keyB) {
  // Cache per unordered pair: the HF solves are the demo's most expensive synchronous step, and the
  // network only depends on the two material keys (run once per pair, ever).
  const cacheKey = [keyA, keyB].sort().join('+');
  if (discoveryCache.has(cacheKey)) return discoveryCache.get(cacheKey);
  const result = discoverReactionsUncached(keyA, keyB);
  discoveryCache.set(cacheKey, result);
  return result;
}

function discoverReactionsUncached(keyA, keyB) {
  const result = { reactions: [], productClosures: {}, note: null };
  if (keyA === keyB) { result.note = 'same material on both blocks: no reaction'; return result; }
  const ca = materialComposition(keyA);
  const cb = materialComposition(keyB);
  if (!ca || !cb) { result.note = 'unknown material'; return result; }
  if (!allInBasis(ca) || !allInBasis(cb)) {
    result.note = `reaction enthalpy needs the molecular engine, whose STO-3G basis covers Z≤18 (H–Ar); ${[keyA, keyB].join('+')} contains a heavier element`;
    return result;
  }

  const pairs = [[keyA, ca, keyB, cb], [keyB, cb, keyA, ca]];
  let rx = null;

  // Family 1: active metal + water.
  for (const [kx, cx, ky, cy] of pairs) {
    if (cx.role === 'metal' && cy.role === 'water') { rx = metalWaterReaction(kx, cx, cy); break; }
  }
  // Family 2: fuel/metal + oxygen.
  if (!rx) {
    for (const [kx, cx, ky, cy] of pairs) {
      if (cy.role === 'oxidizer' && cx.role === 'metal') { rx = metalOxygenReaction(kx, cx, cy); break; }
      if ((cx.role === 'fuel' && cy.role === 'oxidizer')) { rx = hydrogenOxygenReaction(); rx.reactant = kx; rx.partner = ky; break; }
    }
  }
  // Fallback: simplest combined binary molecule from the two element sets (conservative).
  if (!rx) rx = combinatorialReaction(keyA, ca, keyB, cb);

  if (!rx) { result.note = `no reaction family or candidate found for ${keyA}+${keyB}`; return result; }
  if (!(rx.specificEnthalpyJPerKg < 0)) {
    result.note = `${keyA}+${keyB} is endothermic (ΔH=${rx.dHHa.toFixed(3)} Ha): no spontaneous reaction`;
    return result;
  }

  // Activation gate = the higher melting point of the two reactants (a mobility proxy for the kinetic
  // barrier; the materials must be mobile/in contact to react). Documented simplification.
  const activationTemperatureK = Math.max(ca.meltingPointK, cb.meltingPointK);
  if (rx.closure) result.productClosures[rx.productKey] = rx.closure;
  result.reactions.push({ a: keyA, b: keyB, product: rx.productKey, activationTemperatureK, specificEnthalpyJPerKg: rx.specificEnthalpyJPerKg });
  result.note = `${keyA}+${keyB} → ${rx.productKey} (ΔH=${(rx.specificEnthalpyJPerKg / 1e6).toFixed(2)} MJ/kg, derived)`;
  return result;
}

// --- combinatorial fallback ----------------------------------------------------------------------
// Form one combined molecule from a single formula unit of each reactant and react if it is clearly
// more stable than the separated reactant molecules. Gated to metal+nonmetal compound formation so
// it can't fire for like-with-like (atoms→cluster always looks exothermic against isolated atoms).
function combinatorialReaction(keyA, ca, keyB, cb) {
  const hasMetal = ca.role === 'metal' || cb.role === 'metal';
  const hasNonmetal = ca.role === 'nonmetal' || cb.role === 'nonmetal' || ca.role === 'water' || cb.role === 'water';
  if (!hasMetal || !hasNonmetal) return null;
  // Combined formula = union of one formula unit each.
  const counts = {};
  for (const c of [ca, cb]) for (const [Z, n] of Object.entries(c.elements)) counts[Z] = (counts[Z] || 0) + n;
  const geometry = clusterGeometry(counts);
  let eProduct;
  try { eProduct = speciesEnergyHa({ atoms: geometry, multiplicity: 1 }); } catch { return null; }
  let eReact;
  try { eReact = speciesEnergyHa(ca.species) + speciesEnergyHa(cb.species); } catch { return null; }
  const dHHa = eProduct - eReact;
  if (!(dHHa < -0.02)) return null; // require a clearly exothermic compound
  const productMolarMass = Object.entries(counts).reduce((a, [Z, n]) => a + n * atomicMassKg(Number(Z)) * AVOGADRO, 0);
  const specificEnthalpyJPerKg = (dHHa * HARTREE_J * AVOGADRO) / productMolarMass;
  const label = Object.entries(counts).map(([Z, n]) => `${symbolForZ(Number(Z))}${n > 1 ? n : ''}`).join('');
  const productKey = `cmpd-${label.toLowerCase()}`;
  const closure = deriveCompoundClosure({ key: productKey, label, atomCounts: counts, geometry, reactants: reactantsFor([ca, cb]) });
  return { dHHa, productKey, closure, specificEnthalpyJPerKg, reactant: keyA, partner: keyB };
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
