import assert from 'node:assert/strict';
import { test } from 'node:test';
import { discoverReactions } from '../src/runtime/sph/reactionDiscovery.js';
import { materialDerivationSummary } from '../src/runtime/material/propertyProvenance.js';

test('active metal + water is discovered as exothermic, with a derived hydroxide product', () => {
  const r = discoverReactions('Na', 'h2o');
  assert.equal(r.reactions.length, 1);
  const rx = r.reactions[0];
  assert.equal(rx.product, 'naoh');
  assert.ok(rx.specificEnthalpyJPerKg < 0, 'must be exothermic');
  assert.equal(rx.activationTemperatureK, 0);
  assert.equal(rx.activationModel, 'barrier-not-yet-derived-reacts-on-exothermic-contact-with-liquid-water');
  assert.deepEqual(rx.phaseRequirements, { h2o: ['liquid', 'gas'] });
  // Order of magnitude (light-element RHF/STO-3G; sign + scale, not a validated value).
  assert.ok(rx.specificEnthalpyJPerKg < -1e6 && rx.specificEnthalpyJPerKg > -40e6);
  // The product compound closure is supplied for registration, with a derived colour.
  const closure = r.productClosures['naoh'];
  assert.ok(closure, 'product closure provided');
  assert.equal(closure.properties.intrinsicColorSrgb.length, 3);
  assert.ok(closure.properties.phases[0].densityKgPerM3 > 0);
  assert.equal(materialDerivationSummary(closure.properties).fullyLowerLevelDerived, true);
});

test('hydrogen + oxygen combustion is discovered and yields water', () => {
  const r = discoverReactions('h2', 'o2');
  assert.equal(r.reactions.length, 1);
  assert.equal(r.reactions[0].product, 'h2o');
  assert.ok(r.reactions[0].specificEnthalpyJPerKg < 0);
});

test('metal + oxygen is discovered as oxide formation', () => {
  const r = discoverReactions('Mg', 'o2');
  assert.equal(r.reactions.length, 1);
  assert.equal(r.reactions[0].product, 'mgo');
  assert.ok(r.reactions[0].specificEnthalpyJPerKg < 0);
  assert.equal(materialDerivationSummary(r.productClosures.mgo.properties).fullyLowerLevelDerived, true);
});

test('heavy-element reactions switch to the all-element molecular solver instead of a basis blocker', () => {
  const oxide = discoverReactions('fe', 'o2');
  assert.equal(oxide.reactions.length, 1);
  assert.equal(oxide.reactions[0].product, 'feo');
  assert.equal(oxide.reactions[0].energyModel, 'atomic-kohn-sham-tight-binding-v0');
  assert.ok(oxide.reactions[0].specificEnthalpyJPerKg < 0);
  assert.doesNotMatch(oxide.note, /basis|Z/);
  assert.equal(materialDerivationSummary(oxide.productClosures.feo.properties).fullyLowerLevelDerived, true);

  const water = discoverReactions('fe', 'h2o');
  assert.equal(water.reactions.length, 1);
  assert.equal(water.reactions[0].product, 'feoh');
  assert.equal(water.reactions[0].energyModel, 'atomic-kohn-sham-tight-binding-v0');
  assert.doesNotMatch(water.note, /basis|Z/);
});

test('identical materials on both blocks do not react', () => {
  assert.equal(discoverReactions('h2o', 'h2o').reactions.length, 0);
  assert.equal(discoverReactions('Na', 'Na').reactions.length, 0);
});
