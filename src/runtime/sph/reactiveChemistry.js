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
import { equilibriumFromSpecificEnergy } from '../material/phaseEquilibrium.js';

const HARTREE_J = 4.3597447222071e-18;
const AVOGADRO = 6.02214076e23;
const BASIS_MAX_Z = 18;

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
  const eq = equilibriumFromSpecificEnergy(props, particle.specificInternalEnergyJPerKg);
  const phase = props.phases?.find((candidate) => candidate.name === eq.stablePhase)
    || props.phases?.[0];
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

function particlePhase(particle, materialProperties, phaseOf) {
  if (typeof phaseOf === 'function') {
    const phase = phaseOf(particle);
    if (phase) return phase;
  }
  const props = materialProperties?.[particle.material];
  if (!props) return null;
  return equilibriumFromSpecificEnergy(props, particle.specificInternalEnergyJPerKg).stablePhase;
}

function phaseRequirementSatisfied(particle, reaction, materialProperties, phaseOf) {
  const allowed = reaction.phaseRequirements?.[particle.material];
  if (!allowed || allowed.length === 0) return true;
  const phase = particlePhase(particle, materialProperties, phaseOf);
  return allowed.includes(phase);
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
  const r2 = contactRadiusM * contactRadiusM;
  const reacted = new Uint8Array(n);
  let events = 0;
  for (const rx of reactions) {
    for (let i = 0; i < n; i += 1) {
      if (reacted[i] || particles[i].material !== rx.a) continue;
      const ti = temperatureOf(particles[i]);
      for (let j = 0; j < n; j += 1) {
        if (reacted[j] || j === i || particles[j].material !== rx.b) continue;
        if (
          !phaseRequirementSatisfied(particles[i], rx, materialProperties, phaseOf)
          || !phaseRequirementSatisfied(particles[j], rx, materialProperties, phaseOf)
        ) continue;
        // Gate on the CONTACT temperature (the hotter of the two): a hot reactant clears the
        // remaining reduced thermal barrier locally and ignites a cooler partner. Active-metal +
        // water reactions set this to 0 and rely on the water phase requirement instead, so solid
        // sodium can react with liquid water at room temperature.
        const activationTemperatureK = Number.isFinite(rx.activationTemperatureK) ? rx.activationTemperatureK : 0;
        if (Math.max(ti, temperatureOf(particles[j])) < activationTemperatureK) continue;
        const dx = particles[i].x[0] - particles[j].x[0];
        const dy = particles[i].x[1] - particles[j].x[1];
        const dz = particles[i].x[2] - particles[j].x[2];
        if (dx * dx + dy * dy + dz * dz > r2) continue;
        // React: both become the product, release the (exothermic) enthalpy as heat.
        const heat = -rx.specificEnthalpyJPerKg; // J/kg released
        for (const p of [particles[i], particles[j]]) {
          p.material = rx.product;
          p.specificInternalEnergyJPerKg += heat;
          const rho0 = productRestDensityKgPerM3(p, materialProperties, restDensityOf);
          if (rho0) resetMechanicalReferenceState(p, rho0);
        }
        reacted[i] = 1; reacted[j] = 1;
        events += 1;
        break;
      }
    }
  }
  return events;
}
