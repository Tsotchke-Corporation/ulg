import assert from 'node:assert/strict';
import { test } from 'node:test';
import { discoverReactions } from '../src/runtime/sph/reactionDiscovery.js';

test('active metal + water is discovered as exothermic, with a derived hydroxide product', () => {
  const r = discoverReactions('Na', 'h2o');
  assert.equal(r.reactions.length, 1);
  const rx = r.reactions[0];
  assert.equal(rx.product, 'naoh');
  assert.ok(rx.specificEnthalpyJPerKg < 0, 'must be exothermic');
  // Order of magnitude (HF/STO-3G; sign + scale, not a validated value).
  assert.ok(rx.specificEnthalpyJPerKg < -1e6 && rx.specificEnthalpyJPerKg > -40e6);
  // The product compound closure is supplied for registration, with a derived colour.
  const closure = r.productClosures['naoh'];
  assert.ok(closure, 'product closure provided');
  assert.equal(closure.properties.intrinsicColorSrgb.length, 3);
  assert.ok(closure.properties.phases[0].densityKgPerM3 > 0);
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
});

test('a material outside the STO-3G basis (Z>18, e.g. Fe) produces no reaction and reports why', () => {
  const r = discoverReactions('fe', 'h2o');
  assert.equal(r.reactions.length, 0);
  assert.match(r.note, /basis|Z/);
});

test('identical materials on both blocks do not react', () => {
  assert.equal(discoverReactions('h2o', 'h2o').reactions.length, 0);
  assert.equal(discoverReactions('Na', 'Na').reactions.length, 0);
});
