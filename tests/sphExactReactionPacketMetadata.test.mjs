import assert from 'node:assert/strict';
import test from 'node:test';
import { createSphExactMassFormat } from '../ulg-gpu-abi/src/sphExactMassInventory.js';
import { compileSphExactReactionAllocation, selectSphExactReactionAllocation }
  from '../src/runtime/sph/sphExactReactionAllocation.js';
import { encodeSphExactReactionPacketMetadata, SPH_EXACT_REACTION_AVOGADRO,
  SPH_EXACT_REACTION_PACKET_METADATA_HEADER as H }
  from '../src/runtime/sph/sphExactReactionPacketMetadata.js';
import { sphReactionEnergyEntry } from '../src/runtime/sph/sphReactionEnergyAuthority.js';
import { buildSphReactionTable } from '../src/runtime/sph/sphReactionGpuKernel.js';
import { buildSphThermalMaterialTable } from '../src/runtime/sph/sphThermalGpuKernel.js';
import { createCondensableThermodynamics, CONDENSABLE_THERMODYNAMICS_SCHEMA }
  from '../src/runtime/material/condensableThermodynamics.js';
import { createExactReactionAllocationFixture } from './fixtures/sphExactReactionAllocationNative.js';

const integer = words => [...words].reverse().reduce((value, word) => (value << 32n) | BigInt(word), 0n);
const gcd = (a, b) => { while (b) [a, b] = [b, a % b]; return a; };
const floatBits = value => new Uint32Array(new Float32Array([value]).buffer)[0];
// Independent binary64 decoding of original f32 values, represented exactly
// in JS. This avoids duplicating the compiler's f32 coefficient normalization.
function rational(value) {
  const view = new DataView(new ArrayBuffer(8)); view.setFloat64(0, value);
  const bits = view.getBigUint64(0), encoded = Number((bits >> 52n) & 2047n);
  let numerator = (bits & ((1n << 52n) - 1n)) | (encoded ? 1n << 52n : 0n);
  let denominator = 1n, exponent = encoded ? encoded - 1075 : -1074;
  if (exponent < 0) denominator <<= BigInt(-exponent); else numerator <<= BigInt(exponent);
  const divisor = gcd(numerator, denominator);
  return { numerator: (bits >> 63n ? -numerator : numerator) / divisor, denominator: denominator / divisor };
}
function compile(options = {}, wordCount = 9) {
  const fixture = createExactReactionAllocationFixture(options);
  const format = createSphExactMassFormat({ wordCount, quantumExponent: wordCount === 66 ? -1074 : -149 });
  const token = compileSphExactReactionAllocation({ ...fixture, reactionIndex: (options.reactionCount ?? 1) - 1, format });
  return { ...fixture, token };
}
function weightAt(metadata, words, row, column) {
  const at = metadata.weightsOffset + (row * metadata.termCount + column) * metadata.weightStride;
  assert.equal(words[at + 1], 0);
  const magnitude = integer(words.slice(at + 2, at + 2 + metadata.wideWordCount));
  assert.ok(words[at] <= 1 && (magnitude !== 0n || words[at] === 0));
  return words[at] ? -magnitude : magnitude;
}
function customTable(base, reactants, products) {
  const term = value => ({ material: value.material, coefficient: value.coefficient,
    formula: base.materialProperties[value.material].formula, phase: 'liquid', charge: value.charge ?? 0 });
  const referenceTerms = values => values.map(({ material, coefficient }) => ({ material, coefficient, phaseId: 2 }));
  const reaction = { a: reactants[0].material, b: reactants[1].material, product: products[0].material,
    contactRadiusM: .1, activationTemperatureK: 0,
    phaseRequirements: Object.fromEntries(reactants.map(term => [term.material, ['liquid']])),
    stoichiometry: { reactants: reactants.map(term), products: products.map(term),
      atomBalance: { balanced: true }, chargeBalance: { balanced: true } },
    energyReference: { schema: 'peercompute.ulg.reaction-energy-reference.v1',
      referenceTemperatureK: 300, referencePressurePa: 3000, reactionInternalEnergyChangeJPerMolExtent: 0,
      reactantPhases: referenceTerms(reactants), productPhases: referenceTerms(products),
      source: { kind: 'manufactured-analytic', provenance: 'exact packet metadata arithmetic fixture',
        fingerprint: 'exact-packet-metadata-test-v1', provisional: false, phaseApplicable: true } } };
  return buildSphReactionTable([reaction], base);
}

test('packet metadata is block-relative and preserves donor order and global repeated-product IDs', () => {
  const fixture = compile({ reactionCount: 2 });
  const m = encodeSphExactReactionPacketMetadata(fixture.token, fixture), words = m.words;
  assert.deepEqual(Array.from(words.slice(0, 16)), [0x4552504d, 1, 9, 53, 5, 3,
    m.termsOffset, m.termStride, m.elementsOffset, 4, m.weightsOffset, m.weightStride,
    m.denominatorOffset, m.avogadroOffset, m.moleExponent >>> 0, m.residualExponent >>> 0]);
  assert.equal(words[H.TERM_COUNT], 5); assert.equal(words[H.ELEMENT_COUNT], 3);
  assert.deepEqual(m.elementNumbers, [0, 1, 8]);
  assert.deepEqual(m.termIdentifiers.map(term => [term.kind, term.termIndex]), [[1, 2], [1, 3], [2, 3], [2, 4], [2, 5]]);
  assert.equal(m.termIdentifiers[3].materialId, m.termIdentifiers[4].materialId);
  assert.equal(words.length, m.totalWords);
  for (let row = 0; row < m.elementCount; row++) assert.deepEqual(Array.from(words.slice(
    m.elementsOffset + row * 4, m.elementsOffset + row * 4 + 4)),
  [m.elementNumbers[row], m.weightsOffset + row * m.termCount * m.weightStride, 0, 0]);
  assert.equal(m.physicalPublicationAdmitted, false);
});

test('original molar ratios and exact SI entity numerators hold for every supported proof width', () => {
  for (const wordCount of [1, 9, 66]) {
    const fixture = compile({}, wordCount), m = encodeSphExactReactionPacketMetadata(fixture.token, fixture), words = m.words;
    const entry = sphReactionEnergyEntry(fixture.reactionTable, 0), terms = [...entry.reactants, ...entry.products];
    const L = integer(words.slice(m.denominatorOffset, m.denominatorOffset + m.wideWordCount));
    assert.equal(L, m.commonDenominator); assert.equal(L & 1n, 1n);
    assert.equal(integer(words.slice(m.avogadroOffset, m.avogadroOffset + m.wideWordCount)), 602214076000000000000000n);
    assert.equal(SPH_EXACT_REACTION_AVOGADRO, 602214076000000000000000n);
    let expectedL = 1n;
    terms.forEach((term, index) => {
      const ratio = rational(term.molarMass), at = m.termsOffset + index * m.termStride;
      let odd = ratio.numerator; while ((odd & 1n) === 0n) odd >>= 1n;
      expectedL = expectedL / gcd(expectedL, odd) * odd;
      const weight = integer(words.slice(at + 4, at + 4 + m.wideWordCount));
      assert.equal(words[at + 3], floatBits(term.molarMass));
      // weight * molarMass = L * 2^eMax, without floating multiplication.
      const left = weight * ratio.numerator, right = L * ratio.denominator;
      if (m.maximumMolarExponent < 0) assert.equal(left << BigInt(-m.maximumMolarExponent), right);
      else assert.equal(left, right << BigInt(m.maximumMolarExponent));
      const maximum = (1n << BigInt(wordCount * 32)) - 1n;
      assert.ok(maximum * weight * SPH_EXACT_REACTION_AVOGADRO < 1n << BigInt(m.wideWordCount * 32));
    });
    assert.equal(expectedL, L);
    assert.equal(m.moleExponent, fixture.token.format.quantumExponent - m.maximumMolarExponent);
    assert.equal(m.residualExponent, m.moleExponent - 149);
    assert.equal(m.capacityBounds.maximumEntityNumerator,
      m.capacityBounds.maximumMoleNumerator * SPH_EXACT_REACTION_AVOGADRO);
  }
});

test('element weights use actual formula counts and exact residuals are not tolerance-admitted', () => {
  const fixture = compile(), m = encodeSphExactReactionPacketMetadata(fixture.token, fixture), words = m.words;
  const atoms = [[0, 0, 0, 0, 0], [2, 0, 2, 2, 2], [0, 2, 1, 2, 2]];
  for (let row = 0; row < m.elementCount; row++) for (let column = 0; column < m.termCount; column++) {
    const at = m.termsOffset + column * m.termStride + 4;
    const weight = integer(words.slice(at, at + m.wideWordCount));
    assert.equal(weightAt(m, words, row, column), weight * BigInt(atoms[row][column]) << 149n);
  }
  const allocation = selectSphExactReactionAllocation(fixture.token, { availableA: 101n, availableB: 1003n, kineticCap: 101n });
  const masses = [-allocation.debitA, -allocation.debitB, ...allocation.products.map(product => product.mass)];
  const residuals = m.elementNumbers.map((_, row) => masses.reduce((sum, mass, column) => sum + mass * weightAt(m, words, row, column), 0n));
  assert.equal(residuals[0], 0n);
  assert.ok(residuals.slice(1).some(value => value !== 0n), 'integer partition has a real retained species residual');
  assert.equal(m.physicalPublicationAdmitted, false);
  assert.equal(Object.keys(m).some(key => /tolerance|budget|accepted/i.test(key)), false);
});

test('charge row preserves subnormal and negative fractional charge without multiplying it per atom', () => {
  const base = createExactReactionAllocationFixture();
  const reactants = [{ material: 'h2o', coefficient: 1, charge: 2 ** -149 },
    { material: 'h2o2', coefficient: 1, charge: -.125 }];
  const reactionTable = customTable(base, reactants, reactants);
  const token = compileSphExactReactionAllocation({ ...base, reactionTable, reactionIndex: 0, format: createSphExactMassFormat() });
  const m = encodeSphExactReactionPacketMetadata(token, { reactionTable, thermalMaterialTable: base.thermalMaterialTable });
  const words = m.words;
  const expectedCharges = [1n, -(1n << 146n), 1n, -(1n << 146n)];
  for (let column = 0; column < m.termCount; column++) {
    const at = m.termsOffset + column * m.termStride + 4;
    assert.equal(weightAt(m, words, 0, column), integer(words.slice(at, at + m.wideWordCount)) * expectedCharges[column]);
  }
  assert.equal(reactionTable.atomTermCount, 8, 'each charged formula has two original atom rows');
});

test('returned encodings are defensive numeric copies and original authorities are required on every call', () => {
  const fixture = compile(), m = encodeSphExactReactionPacketMetadata(fixture.token, fixture), original = m.words;
  m.words.fill(0);
  assert.deepEqual(m.words, original);
  assert.deepEqual(encodeSphExactReactionPacketMetadata(fixture.token, fixture).words, original);
  assert.ok(Object.isFrozen(m) && Object.isFrozen(m.termIdentifiers) && Object.isFrozen(m.termIdentifiers[0]));
  assert.throws(() => encodeSphExactReactionPacketMetadata({ ...fixture.token }, fixture), /original compiler token/);
  assert.throws(() => encodeSphExactReactionPacketMetadata(fixture.token, { ...fixture, reactionTable: { ...fixture.reactionTable } }), /original reactionTable/);
  assert.throws(() => encodeSphExactReactionPacketMetadata(fixture.token, { ...fixture, thermalMaterialTable: { ...fixture.thermalMaterialTable } }), /original thermalMaterialTable/);
  fixture.reactionTable.atomTermRecords[6] = .25;
  assert.throws(() => encodeSphExactReactionPacketMetadata(fixture.token, fixture), /snapshot changed/);
});

test('replaced original data accessors reject without invoking getters', () => {
  const fixture = compile(); let calls = 0;
  Object.defineProperty(fixture.reactionTable, 'atomTermRecords', { get() { calls++; throw new Error('getter called'); } });
  assert.throws(() => encodeSphExactReactionPacketMetadata(fixture.token, fixture), /snapshot changed/);
  assert.equal(calls, 0);
});

test('authority is revalidated after encoding, including reentrant array-write hooks', () => {
  const fixture = compile(), set = Uint32Array.prototype.set; let mutated = false;
  try {
    Uint32Array.prototype.set = function (...args) {
      if (!mutated) { mutated = true; fixture.reactionTable.atomTermRecords[6] = .25; }
      return Reflect.apply(set, this, args);
    };
    assert.throws(() => encodeSphExactReactionPacketMetadata(fixture.token, fixture), /snapshot changed/);
    assert.equal(mutated, true);
  } finally { Uint32Array.prototype.set = set; }
});

test('genuine many-material metadata rejects insufficient residual headroom without limb truncation', () => {
  const seed = createExactReactionAllocationFixture(), materialProperties = {}, models = {};
  const primes = [];
  for (let value = 2 ** 23 + 1; primes.length < 33; value += 2) {
    let prime = true;
    for (let divisor = 3; divisor * divisor <= value; divisor += 2) if (value % divisor === 0) { prime = false; break; }
    if (prime) primes.push(value);
  }
  for (const [material, molarMass] of [['donorA', 1], ['donorB', 1], ...primes.map((prime, i) => [`product${i}`, prime / 2 ** 23])]) {
    materialProperties[material] = { ...seed.materialProperties.h2, formula: 'H', molarMassKgPerMol: molarMass };
    models[material] = createCondensableThermodynamics({ ...seed.models.h2, schema: CONDENSABLE_THERMODYNAMICS_SCHEMA,
      molarMassKgPerMol: molarMass, vaporCpJPerKgK: 3000 + 8.314462618 / molarMass });
  }
  const thermalMaterialTable = buildSphThermalMaterialTable(materialProperties, { condensableThermodynamicsByMaterial: models });
  const base = { materialProperties, thermalMaterialTable };
  const reactants = [{ material: 'donorA', coefficient: 16.5 }, { material: 'donorB', coefficient: 16.5 }];
  const products = primes.map((_, i) => ({ material: `product${i}`, coefficient: 1 }));
  const reactionTable = customTable(base, reactants, products);
  const args = { reactionTable, thermalMaterialTable, reactionIndex: 0 };
  const narrow = compileSphExactReactionAllocation({ ...args, format: createSphExactMassFormat({ wordCount: 1 }) });
  assert.throws(() => encodeSphExactReactionPacketMetadata(narrow, args), /residual sum exceeds checked arithmetic capacity/);
  const wide = compileSphExactReactionAllocation({ ...args, format: createSphExactMassFormat({ wordCount: 9 }) });
  const metadata = encodeSphExactReactionPacketMetadata(wide, args);
  assert.equal(metadata.termCount, 35);
  assert.ok(metadata.commonDenominator > 1n << 750n);
  assert.ok(metadata.capacityBounds.maximumResidualNumerators.every(value => value < 1n << BigInt(metadata.wideWordCount * 32)));
});
