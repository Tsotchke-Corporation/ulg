// Reactive chemistry for the particle demo: when two materials are in contact and the reactant
// phases required by the discovered reaction family are locally available, they react — the
// reactant particles become the product material and the reaction enthalpy (DERIVED from the
// molecular bonding engine, not hardcoded) is released as heat, which raises the temperature,
// drives phase change, and expands the products. This is the bonding engine wired into the
// dynamics: bonds rearrange, ΔH = ΣE(products) − ΣE(reactants).
//
// General: driven by a reaction network (reactant material keys → product key + derived ΔH +
// reaction-family phase requirements), not per-material special cases. Mass is conserved (each
// reacting particle keeps its mass and changes species); stoichiometry is treated at the per-contact
// level (a reactant-A particle meeting a reactant-B particle), a documented simplification.

import { allElementSpeciesEnergyHa } from '../electronicStructure/allElementMolecularSolver.js';
import { rhf, _uhf as uhf } from '../electronicStructure/molecularHartreeFock.js';
import {
  equilibriumFromSpecificEnergy,
  stablePhaseFromSpecificEnergy
} from '../material/phaseEquilibrium.js';
import { describeChemicalFormula } from '../chemistry/formula.js';

const HARTREE_J = 4.3597447222071e-18;
const AVOGADRO = 6.02214076e23;
const BASIS_MAX_Z = 18;

function canonicalMaterialKey(value) {
  return String(value ?? '').trim().toLowerCase();
}

function sameMaterialKey(left, right) {
  const leftKey = canonicalMaterialKey(left);
  return leftKey.length > 0 && leftKey === canonicalMaterialKey(right);
}

function phaseRequirementsForMaterial(reaction, material) {
  const requirements = reaction?.phaseRequirements;
  if (!requirements || typeof requirements !== 'object') return null;
  if (requirements[material] != null) return requirements[material];
  const materialKey = canonicalMaterialKey(material);
  if (requirements[materialKey] != null) return requirements[materialKey];
  for (const [candidate, allowed] of Object.entries(requirements)) {
    if (canonicalMaterialKey(candidate) === materialKey) return allowed;
  }
  return null;
}

function speciesInBasis(species) {
  return species.atoms.every((atom) => atom.Z <= BASIS_MAX_Z);
}

function speciesEnergyHa(species, forceAllElement = false) {
  if (forceAllElement) return allElementSpeciesEnergyHa(species);
  return (species.multiplicity && species.multiplicity > 1 ? uhf(species.atoms, { multiplicity: species.multiplicity }) : rhf(species.atoms)).totalEnergyHa;
}

/**
 * Derive a reaction's specific enthalpy (J per kg of products, negative = exothermic) from the
 * molecular engine. `reactants`/`products` are lists of { atoms, multiplicity, count } species;
 * each species' electronic energy is computed by RHF (closed shell) or UHF (open shell), and
 * ΔH = ΣE(products) − ΣE(reactants). Divided by the product mass to get J/kg.
 */
export function deriveReactionEnthalpyJPerKg({ reactants, products, productMassKgPerMol }) {
  const forceAllElement = [...reactants, ...products].some((species) => !speciesInBasis(species));
  const sum = (list) => list.reduce((acc, s) => acc + (s.count || 1) * speciesEnergyHa(s, forceAllElement), 0);
  const totalProductMoles = products.reduce((acc, s) => acc + (s.count || 1), 0);
  const dHHa = sum(products) - sum(reactants);
  const dHJperMolProduct = (dHHa * HARTREE_J * AVOGADRO) / totalProductMoles;
  return dHJperMolProduct / productMassKgPerMol;
}

function productRestDensityKgPerM3(particle, materialProperties, restDensityOf) {
  if (typeof restDensityOf === 'function') {
    const rho = restDensityOf(particle);
    if (Number.isFinite(rho) && rho > 0) return rho;
  }
  const props = materialProperties?.[particle.material];
  if (!props) return null;
  let phase = props.phases?.[0] || null;
  try {
    const stablePhase = stablePhaseFromSpecificEnergy(props, particle.specificInternalEnergyJPerKg);
    phase = props.phases?.find((candidate) => candidate.name === stablePhase)
      || phase;
  } catch {
    phase = props.phases?.[0] || null;
  }
  const rho = phase?.densityKgPerM3;
  return Number.isFinite(rho) && rho > 0 ? rho : null;
}

function resetMechanicalReferenceState(particle, restDensityKgPerM3) {
  particle.restDensityKgPerM3 = restDensityKgPerM3;
  if (particle.mpmVolume0 !== undefined) {
    particle.mpmVolume0 = particle.massKg / restDensityKgPerM3;
  }
  if (particle.mpmF !== undefined) {
    particle.mpmF = new Float64Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    particle.mpmJ = 1;
  }
  if (particle.mpmC !== undefined) {
    particle.mpmC = new Float64Array(9);
  }
  if (particle.mpmSolid !== undefined) {
    particle.mpmSolid = false;
  }
}

function materialKeyForProductTerm(term, materialProperties = {}) {
  const candidates = [
    term?.material,
    term?.product,
    term?.key,
    typeof term?.formula === 'string' ? term.formula.toLowerCase().replace(/[^a-z0-9]/g, '') : null,
    typeof term?.formula === 'string' ? term.formula.toLowerCase() : null,
    term?.formula
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (materialProperties[candidate]) return candidate;
    const lower = String(candidate).toLowerCase();
    if (materialProperties[lower]) return lower;
  }
  return candidates[0] || null;
}

function termCoefficient(term) {
  const coefficient = Number(term?.coefficient);
  return Number.isFinite(coefficient) && coefficient > 0 ? coefficient : 1;
}

function materialMolarMassKgPerMol(material, materialProperties = {}) {
  const props = materialProperties?.[material] || materialProperties?.[String(material || '').toLowerCase()];
  const molarMass = Number(props?.molarMassKgPerMol);
  return Number.isFinite(molarMass) && molarMass > 0 ? molarMass : 0;
}

function materialKeyForReactantTerm(term, materialProperties = {}, fallback = null) {
  const candidates = [
    term?.material,
    term?.reactant,
    term?.key,
    typeof term?.formula === 'string' ? term.formula.toLowerCase().replace(/[^a-z0-9]/g, '') : null,
    typeof term?.formula === 'string' ? term.formula.toLowerCase() : null,
    term?.formula,
    fallback
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (materialProperties[candidate]) return candidate;
    const lower = String(candidate).toLowerCase();
    if (materialProperties[lower]) return lower;
  }
  return candidates[0] || null;
}

function reactantTermsForReaction(reaction, materialProperties = {}) {
  const sourceTerms = reaction?.stoichiometry?.reactants?.length
    ? reaction.stoichiometry.reactants
    : null;
  if (!sourceTerms) return null;
  return sourceTerms
    .map((term, index) => {
      const fallback = index === 0 ? reaction?.a : index === 1 ? reaction?.b : null;
      const material = materialKeyForReactantTerm(term, materialProperties, fallback);
      return {
        ...term,
        material,
        coefficient: termCoefficient(term),
        molarMassKgPerMol: materialMolarMassKgPerMol(material, materialProperties)
      };
    })
    .filter((term) => term.material);
}

function productTermsForReaction(reaction, materialProperties = {}) {
  const terms = reaction?.stoichiometry?.products?.length
    ? reaction.stoichiometry.products
    : [{ coefficient: 1, formula: reaction.product, material: reaction.product }];
  return terms
    .map((term) => ({
      ...term,
      coefficient: termCoefficient(term),
      material: materialKeyForProductTerm(term, materialProperties)
    }))
    .filter((term) => term.material);
}

function productMassWeights(productTerms, materialProperties = {}) {
  const weighted = productTerms.map((term) => {
    const props = materialProperties[term.material] || materialProperties[String(term.material).toLowerCase()];
    const molarMass = Number(props?.molarMassKgPerMol);
    const coefficient = termCoefficient(term);
    return {
      ...term,
      molarMassKgPerMol: molarMass,
      massWeight: Number.isFinite(molarMass) && molarMass > 0 ? coefficient * molarMass : 0
    };
  });
  const totalWeight = weighted.reduce((sum, term) => sum + term.massWeight, 0);
  if (!(totalWeight > 0)) return null;
  return weighted.map((term) => ({
    ...term,
    massFraction: term.massWeight / totalWeight
  }));
}

function cloneProductParticle(template, {
  material,
  massKg,
  x,
  v,
  specificInternalEnergyJPerKg,
  materialProperties,
  restDensityOf
}) {
  const particle = {
    ...template,
    x: [...x],
    v: [...v],
    material,
    massKg,
    specificInternalEnergyJPerKg
  };
  const rho0 = productRestDensityKgPerM3(particle, materialProperties, restDensityOf);
  if (rho0) resetMechanicalReferenceState(particle, rho0);
  return particle;
}

function productTermHasGasPhase(term, materialProperties = {}) {
  const props = materialProperties?.[term.material] || materialProperties?.[String(term.material || '').toLowerCase()];
  const phases = props?.phases || [];
  const gasOnlyMaterial = phases.length > 0 && phases.every((phase) => phase?.name === 'gas');
  return gasOnlyMaterial
    || String(term?.phase || '').toLowerCase() === 'gas'
    || String(term?.targetPhase || '').toLowerCase() === 'gas'
    || String(term?.routing || '').toLowerCase() === 'gas';
}

function termAtomCounts(term) {
  if (term?.atomCounts && typeof term.atomCounts === 'object') return term.atomCounts;
  const formula = term?.formula || term?.material;
  if (typeof formula !== 'string' || formula.length === 0) return null;
  try {
    return describeChemicalFormula(formula).atomCounts;
  } catch {
    return null;
  }
}

function addAtomMoles(target, atomCounts, moles, sign = 1) {
  if (!atomCounts || !(moles > 0)) return target;
  for (const [Z, count] of Object.entries(atomCounts)) {
    const key = String(Number(Z));
    target[key] = (target[key] || 0) + sign * Number(count || 0) * moles;
    if (Math.abs(target[key]) < 1e-12) target[key] = 0;
  }
  return target;
}

function chargeMolesFor(term, moles) {
  const charge = Number(term?.charge);
  return Number.isFinite(charge) && Number.isFinite(moles) ? charge * moles : 0;
}

function maxAbsRecordValue(record) {
  return Object.values(record || {}).reduce((max, value) => Math.max(max, Math.abs(Number(value) || 0)), 0);
}

function stoichiometricResiduals(consumed, productRecords) {
  const atomResidualMolByZ = {};
  let chargeResidualMol = 0;
  for (const record of consumed) {
    addAtomMoles(atomResidualMolByZ, termAtomCounts(record.term), record.consumedMoles, -1);
    chargeResidualMol -= chargeMolesFor(record.term, record.consumedMoles);
  }
  for (const record of productRecords) {
    addAtomMoles(atomResidualMolByZ, termAtomCounts(record.term), record.moles, 1);
    chargeResidualMol += chargeMolesFor(record.term, record.moles);
  }
  return {
    atomResidualMolByZ,
    maxAbsAtomResidualMol: maxAbsRecordValue(atomResidualMolByZ),
    chargeResidualMol: Math.abs(chargeResidualMol) < 1e-12 ? 0 : chargeResidualMol
  };
}

function sourceTermForParticle(particle, reactantTerms = []) {
  return reactantTerms.find((term) => term.material === particle.material)
    || reactantTerms.find((term) => String(term.material).toLowerCase() === String(particle.material).toLowerCase())
    || null;
}

function appendReactionLedger(state, event) {
  if (!state.reactionLedger) {
    state.reactionLedger = {
      schema: 'peercompute.ulg.sph-reaction-ledger.v0',
      events: [],
      eventCount: 0,
      productMassKgByMaterial: {},
      gasMassKgByMaterial: {},
      atomResidualMolByZ: {},
      maxAbsAtomResidualMol: 0,
      chargeResidualMol: 0,
      heatJ: 0,
      massResidualKg: 0,
      chemistryValidation: false,
      fullPhysicsValidation: false
    };
  }
  state.reactionLedger.events.push(event);
  state.reactionLedger.eventCount += 1;
  state.reactionLedger.heatJ += event.heatJ || 0;
  state.reactionLedger.massResidualKg += event.massResidualKg || 0;
  state.reactionLedger.chargeResidualMol += event.chargeResidualMol || 0;
  for (const [Z, value] of Object.entries(event.atomResidualMolByZ || {})) {
    state.reactionLedger.atomResidualMolByZ[Z] = (state.reactionLedger.atomResidualMolByZ[Z] || 0) + value;
    if (Math.abs(state.reactionLedger.atomResidualMolByZ[Z]) < 1e-12) {
      state.reactionLedger.atomResidualMolByZ[Z] = 0;
    }
  }
  state.reactionLedger.maxAbsAtomResidualMol = maxAbsRecordValue(state.reactionLedger.atomResidualMolByZ);
  for (const product of event.products || []) {
    state.reactionLedger.productMassKgByMaterial[product.material] = (
      state.reactionLedger.productMassKgByMaterial[product.material] || 0
    ) + product.massKg;
    if (product.routing === 'gas') {
      state.reactionLedger.gasMassKgByMaterial[product.material] = (
        state.reactionLedger.gasMassKgByMaterial[product.material] || 0
      ) + product.massKg;
    }
  }
}

function applyStoichiometricExtentProducts({ state, particles, indices, reaction, materialProperties, restDensityOf }) {
  const reactantTerms = reactantTermsForReaction(reaction, materialProperties);
  const productTerms = productMassWeights(productTermsForReaction(reaction, materialProperties), materialProperties);
  if (!reactantTerms?.length || !productTerms?.length) return false;
  if (reactantTerms.some((term) => !(term.molarMassKgPerMol > 0))) return false;
  if (productTerms.some((term) => !(term.molarMassKgPerMol > 0))) return false;

  const sourceParticles = indices.map((index) => particles[index]);
  const sourceRecords = sourceParticles.map((particle, slotIndex) => {
    const term = sourceTermForParticle(particle, reactantTerms);
    if (!term) return null;
    const availableMoles = particle.massKg / term.molarMassKgPerMol;
    return {
      particle,
      index: indices[slotIndex],
      term,
      availableMoles,
      limitingExtentMol: availableMoles / term.coefficient
    };
  });
  if (sourceRecords.some((record) => !record || !(record.limitingExtentMol > 0))) return false;

  const extentMol = Math.min(...sourceRecords.map((record) => record.limitingExtentMol));
  if (!(extentMol > 0)) return false;
  const consumed = sourceRecords.map((record) => {
    const consumedMoles = extentMol * record.term.coefficient;
    const consumedMassKg = Math.min(record.particle.massKg, consumedMoles * record.term.molarMassKgPerMol);
    return {
      ...record,
      consumedMoles,
      consumedMassKg,
      remainingMassKg: Math.max(0, record.particle.massKg - consumedMassKg)
    };
  });
  const consumedMassKg = consumed.reduce((sum, record) => sum + record.consumedMassKg, 0);
  if (!(consumedMassKg > 0)) return false;

  const productRecords = productTerms.map((term) => {
    const moles = extentMol * term.coefficient;
    const massKg = moles * term.molarMassKgPerMol;
    return {
      term,
      moles,
      massKg,
      routing: productTermHasGasPhase(term, materialProperties) ? 'gas' : 'condensed'
    };
  });
  const productMassKg = productRecords.reduce((sum, record) => sum + record.massKg, 0);
  if (!(productMassKg > 0)) return false;
  const residuals = stoichiometricResiduals(consumed, productRecords);

  const consumedMomentum = [0, 0, 0];
  const consumedCenter = [0, 0, 0];
  const consumedTotalEnergyJ = consumed.reduce((sum, record) => {
    let speedSquared = 0;
    for (let axis = 0; axis < 3; axis += 1) {
      const velocity = record.particle.v?.[axis] ?? 0;
      consumedMomentum[axis] += record.consumedMassKg * velocity;
      consumedCenter[axis] += record.consumedMassKg * (record.particle.x?.[axis] ?? 0);
      speedSquared += velocity * velocity;
    }
    return sum + record.consumedMassKg
      * (record.particle.specificInternalEnergyJPerKg + 0.5 * speedSquared);
  }, 0);
  for (let axis = 0; axis < 3; axis += 1) consumedCenter[axis] /= consumedMassKg;
  const productVelocity = consumedMomentum.map((momentum) => momentum / consumedMassKg);
  const productSpeedSquared = productVelocity.reduce(
    (sum, velocity) => sum + velocity * velocity,
    0
  );
  const heatJ = -reaction.specificEnthalpyJPerKg * productMassKg;
  // Products share the consumed center-of-mass velocity. Relative reactant
  // kinetic energy is therefore thermalized instead of disappearing.
  const productSpecificEnergy = (
    consumedTotalEnergyJ
    + heatJ
    - 0.5 * productMassKg * productSpeedSquared
  ) / productMassKg;

  const reusableProductSlots = [];
  for (const record of consumed) {
    if (record.remainingMassKg > Math.max(record.particle.massKg, 1) * 1e-9) {
      record.particle.massKg = record.remainingMassKg;
      record.particle.reactionRemainingReactant = {
        equation: reaction.stoichiometry?.equation || null,
        consumedMassKg: record.consumedMassKg,
        consumedMoles: record.consumedMoles,
        extentMol
      };
      const rho0 = productRestDensityKgPerM3(record.particle, materialProperties, restDensityOf);
      if (rho0) resetMechanicalReferenceState(record.particle, rho0);
    } else {
      reusableProductSlots.push(record.index);
    }
  }

  const assignedReusableProductSlots = new Set();
  for (let productIndex = 0; productIndex < productRecords.length; productIndex += 1) {
    const product = productRecords[productIndex];
    const slot = reusableProductSlots[productIndex] ?? null;
    const target = slot == null
      ? cloneProductParticle(sourceParticles[0], {
        material: product.term.material,
        massKg: product.massKg,
        x: consumedCenter,
        v: productVelocity,
        specificInternalEnergyJPerKg: productSpecificEnergy,
        materialProperties,
        restDensityOf
      })
      : particles[slot];
    target.material = product.term.material;
    target.massKg = product.massKg;
    target.x = [...consumedCenter];
    target.v = [...productVelocity];
    target.specificInternalEnergyJPerKg = productSpecificEnergy;
    target.reactionProductTerm = {
      formula: product.term.formula,
      coefficient: product.term.coefficient,
      massFraction: product.massKg / productMassKg,
      moles: product.moles,
      routing: product.routing,
      sourceEquation: reaction.stoichiometry?.equation || null
    };
    const rho0 = productRestDensityKgPerM3(target, materialProperties, restDensityOf);
    if (rho0) resetMechanicalReferenceState(target, rho0);
    if (slot == null) {
      particles.push(target);
    } else {
      assignedReusableProductSlots.add(slot);
    }
  }

  // A balanced two-reactant synthesis can collapse into one product term
  // (for example 2 Na + F2 -> 2 NaF). Both fully consumed parent slots are
  // reusable, but only one is needed for the aggregate product particle.
  // Retire every surplus parent in place so the current spatial-index walk
  // keeps stable indices without leaving a zero-extent reactant ghost whose
  // original mass would be counted again or participate in a later reaction.
  for (const slot of reusableProductSlots) {
    if (assignedReusableProductSlots.has(slot)) continue;
    const target = particles[slot];
    const product = productRecords[0];
    target.material = product.term.material;
    target.massKg = 0;
    target.x = [...consumedCenter];
    target.v = [...productVelocity];
    target.specificInternalEnergyJPerKg = productSpecificEnergy;
    target.reactionProductTerm = {
      formula: product.term.formula,
      coefficient: 0,
      massFraction: 0,
      moles: 0,
      routing: product.routing,
      sourceEquation: reaction.stoichiometry?.equation || null,
      retiredSurplusConsumedSlot: true
    };
    const rho0 = productRestDensityKgPerM3(
      target,
      materialProperties,
      restDensityOf
    );
    if (rho0) resetMechanicalReferenceState(target, rho0);
  }

  appendReactionLedger(state, {
    schema: 'peercompute.ulg.sph-reaction-ledger-event.v0',
    equation: reaction.stoichiometry?.equation || null,
    extentMol,
    consumedMassKg,
    productMassKg,
    massResidualKg: productMassKg - consumedMassKg,
    ...residuals,
    heatJ,
    reactants: consumed.map((record) => ({
      material: record.term.material,
      formula: record.term.formula || record.term.material,
      coefficient: record.term.coefficient,
      consumedMoles: record.consumedMoles,
      consumedMassKg: record.consumedMassKg,
      remainingMassKg: record.remainingMassKg
    })),
    products: productRecords.map((record) => ({
      material: record.term.material,
      formula: record.term.formula || record.term.material,
      coefficient: record.term.coefficient,
      moles: record.moles,
      massKg: record.massKg,
      routing: record.routing
    })),
    chemistryValidation: false,
    fullPhysicsValidation: false
  });
  return true;
}

function applyStoichiometricProducts({ particles, indices, reaction, materialProperties, restDensityOf }) {
  const productTerms = productMassWeights(productTermsForReaction(reaction, materialProperties), materialProperties);
  if (!productTerms?.length) return false;
  const sourceParticles = indices.map((index) => particles[index]);
  const totalMassKg = sourceParticles.reduce((sum, particle) => sum + particle.massKg, 0);
  if (!(totalMassKg > 0)) return false;
  const heat = -reaction.specificEnthalpyJPerKg;
  const sourceTotalEnergyJ = sourceParticles.reduce((sum, particle) => {
    const speedSquared = (particle.v || []).reduce(
      (speed2, velocity) => speed2 + velocity * velocity,
      0
    );
    return sum + particle.massKg
      * (particle.specificInternalEnergyJPerKg + 0.5 * speedSquared);
  }, 0);
  if (productTerms.length === 1) {
    for (const particle of sourceParticles) {
      particle.material = productTerms[0].material;
      particle.specificInternalEnergyJPerKg += heat;
      particle.reactionProductTerm = {
        formula: productTerms[0].formula,
        coefficient: productTerms[0].coefficient ?? 1,
        massFraction: 1,
        sourceEquation: reaction.stoichiometry?.equation || null
      };
      const rho0 = productRestDensityKgPerM3(particle, materialProperties, restDensityOf);
      if (rho0) resetMechanicalReferenceState(particle, rho0);
    }
    return true;
  }
  const sourceMomentum = [0, 0, 0];
  const center = [0, 0, 0];
  for (const particle of sourceParticles) {
    for (let axis = 0; axis < 3; axis += 1) {
      sourceMomentum[axis] += particle.massKg * (particle.v?.[axis] ?? 0);
      center[axis] += particle.massKg * (particle.x?.[axis] ?? 0);
    }
  }
  for (let axis = 0; axis < 3; axis += 1) center[axis] /= totalMassKg;
  const velocity = sourceMomentum.map((momentum) => momentum / totalMassKg);
  const productSpeedSquared = velocity.reduce(
    (sum, component) => sum + component * component,
    0
  );
  const productSpecificEnergy = sourceTotalEnergyJ / totalMassKg
    + heat
    - 0.5 * productSpeedSquared;
  const reusable = [...indices];
  for (let termIndex = 0; termIndex < productTerms.length; termIndex += 1) {
    const term = productTerms[termIndex];
    const massKg = totalMassKg * term.massFraction;
    const slot = reusable[termIndex] ?? null;
    const target = slot == null
      ? cloneProductParticle(sourceParticles[0], {
        material: term.material,
        massKg,
        x: center,
        v: velocity,
        specificInternalEnergyJPerKg: productSpecificEnergy,
        materialProperties,
        restDensityOf
      })
      : particles[slot];
    target.material = term.material;
    target.massKg = massKg;
    target.x = [...center];
    target.v = velocity;
    target.specificInternalEnergyJPerKg = productSpecificEnergy;
    target.reactionProductTerm = {
      formula: term.formula,
      coefficient: term.coefficient ?? 1,
      massFraction: term.massFraction,
      sourceEquation: reaction.stoichiometry?.equation || null
    };
    const rho0 = productRestDensityKgPerM3(target, materialProperties, restDensityOf);
    if (rho0) resetMechanicalReferenceState(target, rho0);
    if (slot == null) particles.push(target);
  }
  return true;
}

function particlePhase(particle, materialProperties, phaseOf) {
  if (typeof phaseOf === 'function') {
    const phase = phaseOf(particle);
    if (phase) return phase;
  }
  const props = materialProperties?.[particle.material];
  if (!props) return null;
  return stablePhaseFromSpecificEnergy(props, particle.specificInternalEnergyJPerKg);
}

function phaseRequirementSatisfied(particle, reaction, materialProperties, phaseOf) {
  const allowed = phaseRequirementsForMaterial(reaction, particle.material);
  if (!allowed || allowed.length === 0) return true;
  const phase = particlePhase(particle, materialProperties, phaseOf);
  return allowed.includes(phase);
}

function reactionContactRadiusM(reaction, fallback) {
  const radius = Number(reaction?.contactRadiusM);
  if (Number.isFinite(radius) && radius > 0) return radius;
  return fallback;
}

function cellCoordsForParticle(particle, cellSizeM) {
  const x = particle?.x || [];
  return [
    Math.floor((Number(x[0]) || 0) / cellSizeM),
    Math.floor((Number(x[1]) || 0) / cellSizeM),
    Math.floor((Number(x[2]) || 0) / cellSizeM)
  ];
}

function reactionCellKey(coords) {
  return `${coords[0]}:${coords[1]}:${coords[2]}`;
}

function buildReactionSpatialIndex(particles, count, cellSizeM) {
  const cellsByMaterial = new Map();
  const indicesByMaterial = new Map();
  const coordsByIndex = new Array(count);
  for (let index = 0; index < count; index += 1) {
    const particle = particles[index];
    const material = canonicalMaterialKey(particle?.material);
    if (!material) continue;
    const coords = cellCoordsForParticle(particle, cellSizeM);
    const cellKey = reactionCellKey(coords);
    coordsByIndex[index] = coords;
    if (!indicesByMaterial.has(material)) indicesByMaterial.set(material, []);
    indicesByMaterial.get(material).push(index);
    if (!cellsByMaterial.has(material)) cellsByMaterial.set(material, new Map());
    const materialCells = cellsByMaterial.get(material);
    if (!materialCells.has(cellKey)) materialCells.set(cellKey, []);
    materialCells.get(cellKey).push(index);
  }
  return { cellSizeM, cellsByMaterial, indicesByMaterial, coordsByIndex };
}

function neighborOffsets(radiusCells) {
  const offsets = [];
  for (let dx = -radiusCells; dx <= radiusCells; dx += 1) {
    for (let dy = -radiusCells; dy <= radiusCells; dy += 1) {
      for (let dz = -radiusCells; dz <= radiusCells; dz += 1) {
        offsets.push([dx, dy, dz]);
      }
    }
  }
  return offsets;
}

function candidateNeighborIndices(index, material, radiusM, spatialIndex, offsetCache) {
  const materialCells = spatialIndex.cellsByMaterial.get(canonicalMaterialKey(material));
  const center = spatialIndex.coordsByIndex[index];
  if (!materialCells || !center) return [];
  const radiusCells = Math.max(1, Math.ceil(radiusM / spatialIndex.cellSizeM));
  if (!offsetCache.has(radiusCells)) offsetCache.set(radiusCells, neighborOffsets(radiusCells));
  const candidates = [];
  const seen = new Set();
  for (const offset of offsetCache.get(radiusCells)) {
    const key = reactionCellKey([
      center[0] + offset[0],
      center[1] + offset[1],
      center[2] + offset[2]
    ]);
    const cell = materialCells.get(key);
    if (!cell) continue;
    for (const candidate of cell) {
      if (candidate === index || seen.has(candidate)) continue;
      seen.add(candidate);
      candidates.push(candidate);
    }
  }
  candidates.sort((left, right) => left - right);
  return candidates;
}

function createReactiveGateCache(particles, count, { temperatureOf, phaseOf, materialProperties }) {
  const temperatures = new Float64Array(count);
  temperatures.fill(Number.NaN);
  const phases = new Array(count);
  const phaseComputed = new Uint8Array(count);
  return {
    temperature(index) {
      if (!Number.isNaN(temperatures[index])) return temperatures[index];
      const temperature = Number(temperatureOf(particles[index]));
      temperatures[index] = Number.isFinite(temperature) ? temperature : 0;
      return temperatures[index];
    },
    phase(index) {
      if (phaseComputed[index]) return phases[index];
      phaseComputed[index] = 1;
      phases[index] = particlePhase(particles[index], materialProperties, phaseOf);
      return phases[index];
    }
  };
}

function phaseRequirementSatisfiedCached(particle, index, reaction, gateCache) {
  const allowed = phaseRequirementsForMaterial(reaction, particle.material);
  if (!allowed || allowed.length === 0) return true;
  return allowed.includes(gateCache.phase(index));
}

/**
 * Apply a reaction network to the particle state. For each reaction { a, b, product,
 * phaseRequirements, activationTemperatureK, specificEnthalpyJPerKg }, a particle of material `a`
 * that is within `contactRadiusM` of a particle of material `b` converts when the reaction-family
 * phase requirements and any remaining reduced thermal gate are satisfied. The released heat
 * (−specificEnthalpyJPerKg, for an exothermic reaction) is added to their specific internal energy.
 * Returns the number of reaction events. Mutates particle material + specificInternalEnergyJPerKg.
 */
export function reactiveStep(state, { reactions, materialProperties, contactRadiusM, temperatureOf, phaseOf = null, restDensityOf = null }) {
  if (!reactions || reactions.length === 0) return 0;
  const particles = state.particles;
  const n = particles.length;
  const baseRadius = Number(contactRadiusM);
  if (!(baseRadius > 0)) return 0;
  const reacted = new Uint8Array(n);
  const maxRadius = reactions.reduce((max, reaction) => Math.max(max, reactionContactRadiusM(reaction, baseRadius)), baseRadius);
  const spatialIndex = buildReactionSpatialIndex(particles, n, maxRadius);
  const offsetCache = new Map();
  const gateCache = createReactiveGateCache(particles, n, { temperatureOf, phaseOf, materialProperties });
  let events = 0;
  for (const rx of reactions) {
    const radius = reactionContactRadiusM(rx, baseRadius);
    const r2 = radius * radius;
    const reactantAIndices = spatialIndex.indicesByMaterial.get(canonicalMaterialKey(rx.a)) || [];
    for (const i of reactantAIndices) {
      if (reacted[i] || !sameMaterialKey(particles[i].material, rx.a)) continue;
      if (!phaseRequirementSatisfiedCached(particles[i], i, rx, gateCache)) continue;
      const candidates = candidateNeighborIndices(i, rx.b, radius, spatialIndex, offsetCache);
      for (const j of candidates) {
        if (reacted[j] || j === i || !sameMaterialKey(particles[j].material, rx.b)) continue;
        if (
          !phaseRequirementSatisfiedCached(particles[j], j, rx, gateCache)
        ) continue;
        // Gate on the CONTACT temperature (the hotter of the two): a hot reactant clears the
        // remaining reduced thermal barrier locally and ignites a cooler partner. Active-metal +
        // water reactions set this to 0 and rely on the water phase requirement instead, so solid
        // sodium can react with liquid water at room temperature.
        const activationTemperatureK = Number.isFinite(rx.activationTemperatureK) ? rx.activationTemperatureK : 0;
        if (Math.max(gateCache.temperature(i), gateCache.temperature(j)) < activationTemperatureK) continue;
        const dx = particles[i].x[0] - particles[j].x[0];
        const dy = particles[i].x[1] - particles[j].x[1];
        const dz = particles[i].x[2] - particles[j].x[2];
        if (dx * dx + dy * dy + dz * dz > r2) continue;
        if (!applyStoichiometricExtentProducts({
          state,
          particles,
          indices: [i, j],
          reaction: rx,
          materialProperties,
          restDensityOf
        }) && !applyStoichiometricProducts({
          particles,
          indices: [i, j],
          reaction: rx,
          materialProperties,
          restDensityOf
        })) {
          // Fallback for legacy single-product reactions with incomplete material tables.
          const heat = -rx.specificEnthalpyJPerKg; // J/kg released
          for (const p of [particles[i], particles[j]]) {
            p.material = rx.product;
            p.specificInternalEnergyJPerKg += heat;
            const rho0 = productRestDensityKgPerM3(p, materialProperties, restDensityOf);
            if (rho0) resetMechanicalReferenceState(p, rho0);
          }
        }
        reacted[i] = 1; reacted[j] = 1;
        events += 1;
        break;
      }
    }
  }
  return events;
}
