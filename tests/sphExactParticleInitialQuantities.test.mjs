import test from 'node:test';
import assert from 'node:assert/strict';
import { createSphExactMassFormat, decodeSphExactMass, encodeSphExactMass }
  from '../ulg-gpu-abi/src/sphExactMassInventory.js';
import { buildSphGpuParticleBuffers, buildMlsMpmGpuParticleBuffers }
  from '../src/runtime/sph/sphGpuBuffers.js';
import { resolveSphExactParticleMassSeed, exportSphExactParticleMassColdInput, importSphExactParticleMassColdInput }
  from '../src/runtime/sph/sphExactMassParticleSeed.js';
import { encodeSphExactParticleInitialQuantities } from '../src/runtime/sph/sphExactParticleInitialQuantities.js';
import { createReferenceMaterialClosures } from '../src/runtime/material/materialClosures.js';
import { specificInternalEnergyJPerKg } from '../src/runtime/material/thermoState.js';
import { referenceExactRationalQuantity } from './fixtures/sphExactRationalQuantityNative.js';

function fixture(wordCount) {
  const format = createSphExactMassFormat({ wordCount, quantumExponent: wordCount === 1 ? -20 : wordCount === 9 ? -149 : -1074 });
  const materialProperties = { fe: createReferenceMaterialClosures().fe.properties };
  const state = { step: 0, time: 0, smoothingLengthM: .1, particles: [{ id: 'cold', material: 'fe',
    massKg: 1 + 2 ** -(wordCount === 1 ? 20 : wordCount === 9 ? 30 : 52),
    x: [0, 0, 0], v: [.1, -.2, .3], specificInternalEnergyJPerKg: specificInternalEnergyJPerKg(materialProperties.fe, 300) }] };
  const packed = buildSphGpuParticleBuffers(state, { materialProperties,
    exactMass: { format, reference: 'initial conserved particle quantities', initialQuantities: true } });
  const mechanics = buildMlsMpmGpuParticleBuffers(state, { materialProperties }).mechanics;
  return { state, packed, mechanics, seed: resolveSphExactParticleMassSeed(packed) };
}

for (const width of [1, 9, 66]) test(`cold W${width} quantities preserve exact mass, signed momentum, total energy and volume`, () => {
  const f = fixture(width), result = encodeSphExactParticleInitialQuantities(f.seed, f.mechanics);
  assert.ok(result);
  const { words, layout } = result, r = { wordCount: layout.scalar.wordCount };
  const ref = (operation, a, b) => referenceExactRationalQuantity(r, { operation, a, b });
  const fromFloat = value => referenceExactRationalQuantity(r, { operation: 'fromFloat',
    argument: new Uint32Array(new Float32Array([value]).buffer)[0] });
  const m = decodeSphExactMass(encodeSphExactMass(f.state.particles[0].massKg, f.seed.format), f.seed.format);
  const mass = ref('normalize', { numerator: m.coefficient, exponent: m.exponent });
  const velocity = Array.from(f.packed.state.slice(4, 7), fromFloat);
  const specific = velocity.reduce((u, v) => ref('add', u, ref('multiply', ref('multiply', v, v), fromFloat(.5))),
    fromFloat(f.packed.state[7]));
  const expected = [...velocity.map(v => ref('multiply', mass, v)), ref('multiply', mass, specific),
    fromFloat(f.mechanics[19]), fromFloat(f.mechanics[19]), mass];
  const integer = values => Array.from(values).reduceRight((n, word) => (n << 32n) | BigInt(word), 0n);
  expected.forEach((v, field) => {
    const at = layout.scalarOffsetWords + field * layout.scalar.recordWords, n = layout.scalar.wordCount;
    assert.deepEqual({ negative: words[at], error: words[at + 1], exponent: words[at + 2] | 0,
      reserved: words[at + 3], numerator: integer(words.slice(at + 4, at + 4 + n)),
      denominator: integer(words.slice(at + 4 + n, at + 4 + 2 * n)) },
    Object.fromEntries(['negative', 'error', 'exponent', 'reserved', 'numerator', 'denominator'].map(key => [key, v[key]])));
  });
  assert.deepEqual(words.slice(layout.massOffsetWords, layout.massOffsetWords + width),
    encodeSphExactMass(f.state.particles[0].massKg, f.seed.format));
});

test('cold quantities retain deformed initial mechanics and reject invalid volume or material identities', () => {
  const f = fixture(9);
  const deformed = f.mechanics.slice(); deformed[0] = 1.1; deformed[9] = .01; deformed[18] = 1.01;
  const before = deformed.slice(), initial = encodeSphExactParticleInitialQuantities(f.seed, deformed);
  assert.ok(initial);
  assert.deepEqual(deformed, before, 'initialization must not reset F, C or J');
  const at = initial.layout.scalarOffsetWords + 5 * initial.layout.scalar.recordWords;
  const scalar = initial.words.slice(at, at + initial.layout.scalar.recordWords);
  const options = { wordCount: initial.layout.scalar.wordCount };
  const fromFloat = value => referenceExactRationalQuantity(options, { operation: 'fromFloat',
    argument: new Uint32Array(new Float32Array([value]).buffer)[0] });
  const rational = referenceExactRationalQuantity(options, {
    operation: 'multiply', a: fromFloat(deformed[19]), b: fromFloat(deformed[18]) });
  const integer = values => Array.from(values).reduceRight((n, word) => (n << 32n) | BigInt(word), 0n);
  assert.equal(integer(scalar.slice(4, 4 + initial.layout.scalar.wordCount)), rational.numerator);
  assert.equal(scalar[2] | 0, rational.exponent);
  for (const [index, value] of [[0, Infinity], [18, 0], [18, -1], [19, 0], [31, 2]]) {
    const changed = f.mechanics.slice(); changed[index] = value;
    assert.equal(encodeSphExactParticleInitialQuantities(f.seed, changed), null);
  }
  f.packed.metadata[0].molarMassBits++;
  assert.throws(() => resolveSphExactParticleMassSeed(f.packed), /initial family changed/);
});

test('cold worker transfer preserves the quantity seed identities and independent packed bytes', () => {
  const f = fixture(9), input = exportSphExactParticleMassColdInput(f.packed);
  const copied = structuredClone(f.packed);
  importSphExactParticleMassColdInput(copied, structuredClone(input));
  const original = encodeSphExactParticleInitialQuantities(f.seed, f.mechanics);
  const transferred = encodeSphExactParticleInitialQuantities(resolveSphExactParticleMassSeed(copied), f.mechanics);
  assert.deepEqual(transferred.words, original.words);
  assert.throws(() => importSphExactParticleMassColdInput(structuredClone(f.packed),
    { ...structuredClone(input), initialQuantities: false }), /packed exact mass declaration/);
});
