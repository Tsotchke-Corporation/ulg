import assert from 'node:assert/strict';
import test from 'node:test';
import { createReferenceAnchoredMaterialClosure } from '../src/runtime/material/materialDerivation.js';
import { withRoomAirCaloricReference } from '../src/runtime/material/roomAirCaloricReference.js';
import { createSphEnvironmentAirMixtureClosure } from '../src/runtime/sphEnvironmentParticles.js';
import { discoverReactionNetwork } from '../src/runtime/sph/reactionDiscovery.js';
import { buildSphReactionTable, SPH_REACTION_SPECTATOR_SECTION_SENTINEL } from '../src/runtime/sph/sphReactionGpuKernel.js';
import { assertSphReactionGasLayout } from '../ulg-gpu-abi/src/sphGasConstitutive.js';

// First-class air, slice 3 stage 2 (plan/todo/first-class-air.md; user
// decision 2026-11-17, composition set): species reactions are lifted onto the
// ideal-gas mixture parcels that contain the species, and the residue left
// behind is a spectator product.
function materialProperties() {
  const closures = {};
  for (const material of ['fe', 'h2o', 'n2', 'o2', 'ar', 'co2']) {
    closures[material] = withRoomAirCaloricReference(createReferenceAnchoredMaterialClosure(material, {
      elementOptions: { allowReducedEstimates: false }
    }), material);
  }
  closures.air = createSphEnvironmentAirMixtureClosure(closures);
  return Object.fromEntries(Object.entries(closures).map(([key, closure]) => [key, closure.properties]));
}

const PROPERTIES = materialProperties();
const NETWORK = discoverReactionNetwork(['fe', 'h2o', 'n2', 'o2', 'ar', 'co2'], {
  materialProperties: PROPERTIES,
  liveMaterialKeys: ['fe', 'h2o', 'air']
});

test('species reactions lift onto the mixture and its residues, and the set closes', () => {
  const lifted = NETWORK.reactions.filter((reaction) => reaction.stoichiometry.liftedOntoMixture);
  // Mixture-only species have no rows: their own reactions are pruned.
  assert.equal(NETWORK.reactions.length, lifted.length);
  assert.deepEqual(
    lifted.map((reaction) => `${reaction.stoichiometry.liftedOntoMixture.mixture}>${reaction.stoichiometry.liftedOntoMixture.residue}`).sort(),
    ['air>air~n2', 'air>air~o2', 'air~n2>air~n2~o2', 'air~o2>air~n2~o2']
  );
  assert.deepEqual(Object.keys(NETWORK.productClosures).filter((key) => key.startsWith('air')).sort(),
    ['air~n2', 'air~n2~o2', 'air~o2']);
  for (const reaction of lifted) {
    const { reactants, products, atomBalance } = reaction.stoichiometry;
    assert.equal(atomBalance.balanced, true);
    for (const Z of Object.keys({ ...atomBalance.reactants, ...atomBalance.products })) {
      assert.ok(Math.abs((atomBalance.reactants[Z] ?? 0) - (atomBalance.products[Z] ?? 0))
        <= 1e-9 * Math.max(1, atomBalance.reactants[Z] ?? 0), `atom ${Z} balances`);
    }
    // Mass balances: the residue carries every spectator molecule.
    const mass = (terms) => terms.reduce((sum, t) => sum + t.coefficient * (PROPERTIES[t.material]?.molarMassKgPerMol
      ?? NETWORK.productClosures[t.material]?.properties?.molarMassKgPerMol
      ?? Object.entries(t.atomCounts).reduce((m, [Z, n]) => m + n * ({ 8: 0.015999, 26: 0.055845, 7: 0.014007 }[Z] ?? 0), 0)), 0);
    assert.ok(Math.abs(mass(reactants) - reaction.stoichiometry.balancedReactantMassKgPerEquation) < 1e-9);
    assert.ok(Math.abs(mass(products) - mass(reactants)) < 2e-5 * mass(reactants));
  }
  // Enthalpy per equation is the species reaction's (ideal mixing).
  const oxidation = lifted.find((r) => r.stoichiometry.liftedOntoMixture.mixture === 'air'
    && r.stoichiometry.liftedOntoMixture.component === 'o2');
  const species = discoverReactionNetwork(['fe', 'o2'], { materialProperties: PROPERTIES }).reactions[0];
  const perEquation = (r) => r.specificEnthalpyJPerKg * r.stoichiometry.balancedReactantMassKgPerEquation;
  assert.ok(Math.abs(perEquation(oxidation) - perEquation(species)) <= 1e-9 * Math.abs(perEquation(species)));
  assert.ok(Math.abs(oxidation.stoichiometry.reactants.find((t) => t.material === 'air').coefficient
    - 1 / PROPERTIES.air.idealGasMixture.components.find((c) => c.material === 'o2').moleFraction) < 1e-12);
});

test('the reaction table marks residues as spectators with the exact Cv ratio', () => {
  const properties = { ...PROPERTIES, ...Object.fromEntries(
    Object.entries(NETWORK.productClosures).map(([key, closure]) => [key, closure.properties])) };
  const table = buildSphReactionTable(NETWORK.reactions, { materialProperties: properties });
  assert.equal(table.spectatorTermRecords.length, table.productTermCount * 4);
  assert.equal(table.combinedRecordCount * 4, table.combinedRecords.length);
  assert.equal(assertSphReactionGasLayout(table), table.gasConstitutiveOffsetVec4);
  const base = (table.gasConstitutiveOffsetVec4 - table.productTermCount) * 4;
  for (const term of table.productTermMetadata) {
    const row = table.combinedRecords.subarray(base + term.productTermIndex * 4, base + term.productTermIndex * 4 + 4);
    assert.equal(row[3], Math.fround(SPH_REACTION_SPECTATOR_SECTION_SENTINEL));
    if (term.material.startsWith('air~')) {
      assert.equal(row[0], 1);
      const mixture = term.spectator.mixture;
      assert.equal(row[1], Math.fround(properties[term.material].phaseCaloricModel.cvJPerKgK
        / properties[mixture].phaseCaloricModel.cvJPerKgK));
    } else {
      assert.equal(row[0], 0);
    }
  }
});
