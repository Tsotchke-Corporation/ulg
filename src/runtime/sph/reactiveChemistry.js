// Reactive chemistry for the particle demo: when two materials are in contact and hot enough to
// clear the activation barrier, they react — the reactant particles become the product material and
// the reaction enthalpy (DERIVED from the molecular bonding engine, not hardcoded) is released as
// heat, which raises the temperature, drives phase change, and expands the products. This is the
// bonding engine wired into the dynamics: bonds rearrange, ΔH = ΣE(products) − ΣE(reactants).
//
// General: driven by a reaction network (reactant material keys → product key + derived ΔH +
// activation T), not per-material special cases. Mass is conserved (each reacting particle keeps its
// mass and changes species); stoichiometry is treated at the per-contact level (a reactant-A
// particle meeting a reactant-B particle), a documented simplification.

import { rhf, _uhf as uhf, atomEnergyHa } from '../electronicStructure/molecularHartreeFock.js';

const HARTREE_J = 4.3597447222071e-18;
const AVOGADRO = 6.02214076e23;

/**
 * Derive a reaction's specific enthalpy (J per kg of products, negative = exothermic) from the
 * molecular engine. `reactants`/`products` are lists of { atoms, multiplicity, count } species;
 * each species' electronic energy is computed by RHF (closed shell) or UHF (open shell), and
 * ΔH = ΣE(products) − ΣE(reactants). Divided by the product mass to get J/kg.
 */
export function deriveReactionEnthalpyJPerKg({ reactants, products, productMassKgPerMol }) {
  const speciesEnergyHa = (s) => (s.multiplicity && s.multiplicity > 1 ? uhf(s.atoms, { multiplicity: s.multiplicity }) : rhf(s.atoms)).totalEnergyHa;
  const sum = (list) => list.reduce((acc, s) => acc + (s.count || 1) * speciesEnergyHa(s), 0);
  const totalProductMoles = products.reduce((acc, s) => acc + (s.count || 1), 0);
  const dHHa = sum(products) - sum(reactants);
  const dHJperMolProduct = (dHHa * HARTREE_J * AVOGADRO) / totalProductMoles;
  return dHJperMolProduct / productMassKgPerMol;
}

/**
 * Apply a reaction network to the particle state. For each reaction { a, b, product,
 * activationTemperatureK, specificEnthalpyJPerKg }, a particle of material `a` that is within
 * `contactRadiusM` of a particle of material `b` — both at or above the activation temperature —
 * converts: both particles become `product`, and the released heat (−specificEnthalpyJPerKg, for an
 * exothermic reaction) is added to their specific internal energy. Returns the number of reaction
 * events. Mutates particle material + specificInternalEnergyJPerKg.
 */
export function reactiveStep(state, { reactions, materialProperties, contactRadiusM, temperatureOf }) {
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
        // Gate on the CONTACT temperature (the hotter of the two): a hot reactant clears the
        // activation barrier locally and ignites a cooler partner, which an each-must-be-hot test
        // would wrongly forbid. The released heat then propagates the reaction front.
        if (Math.max(ti, temperatureOf(particles[j])) < rx.activationTemperatureK) continue;
        const dx = particles[i].x[0] - particles[j].x[0];
        const dy = particles[i].x[1] - particles[j].x[1];
        const dz = particles[i].x[2] - particles[j].x[2];
        if (dx * dx + dy * dy + dz * dz > r2) continue;
        // React: both become the product, release the (exothermic) enthalpy as heat.
        const heat = -rx.specificEnthalpyJPerKg; // J/kg released
        for (const p of [particles[i], particles[j]]) {
          p.material = rx.product;
          p.specificInternalEnergyJPerKg += heat;
        }
        reacted[i] = 1; reacted[j] = 1;
        events += 1;
        break;
      }
    }
  }
  return events;
}
