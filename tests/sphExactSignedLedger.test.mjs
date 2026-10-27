import assert from 'node:assert/strict';
import test from 'node:test';
import { createSphExactMassFormat, SPH_EXACT_MASS_ERROR as E } from '../ulg-gpu-abi/src/sphExactMassInventory.js';
import {
  encodeSphExactSignedUnits, decodeSphExactSignedUnits, encodeSphExactSigned, sphExactUnitsFromF32Bits,
  projectSphExactSignedF32Bits
} from '../ulg-gpu-abi/src/sphExactSignedLedger.js';
import { createSphExactLedgerWgsl, createSphExactLedgerScatterWgsl } from '../src/runtime/sph/sphExactLedgerWgsl.js';
import {
  createSphExactLedgerProbeFixture, verifySphExactLedgerProbeEvidence, sphExactLedgerProbeSourceBits,
  SPH_EXACT_LEDGER_PROBE_PASSES, SPH_EXACT_LEDGER_PROBE_LEDGER_ONLY_PASSES
} from './fixtures/sphExactLedgerProbeNative.js';

const format = createSphExactMassFormat();
const max = (1n << 287n) - 1n, min = -(1n << 287n);
const f32Bits = value => { const view = new DataView(new ArrayBuffer(4)); view.setFloat32(0, value); return view.getUint32(0); };

test('signed ledger units round-trip through two\'s-complement words', () => {
  for (const value of [0n, 1n, -1n, max, min, 1n << 200n, -(1n << 200n) + 12345n, 0xffffffffn, -0x100000000n]) {
    assert.equal(decodeSphExactSignedUnits(encodeSphExactSignedUnits(value, format), format), value);
  }
  assert.deepEqual([...encodeSphExactSignedUnits(-1n, format)], new Array(9).fill(0xffffffff));
  assert.throws(() => encodeSphExactSignedUnits(max + 1n, format), RangeError);
  assert.throws(() => encodeSphExactSignedUnits(min - 1n, format), RangeError);
  assert.throws(() => encodeSphExactSignedUnits(1, format), RangeError);
});

test('binary64 and f32 packets convert to exact quanta or are rejected', () => {
  assert.equal(decodeSphExactSignedUnits(encodeSphExactSigned(-1.5, format), format), -3n << 148n);
  assert.equal(decodeSphExactSignedUnits(encodeSphExactSigned(2 ** -149, format), format), 1n);
  assert.throws(() => encodeSphExactSigned(2 ** -150, format), RangeError);
  assert.throws(() => encodeSphExactSigned(Number.NaN, format), RangeError);
  assert.equal(sphExactUnitsFromF32Bits(0x80000000, format), 0n);
  assert.equal(sphExactUnitsFromF32Bits(1, format), 1n);
  assert.equal(sphExactUnitsFromF32Bits(0x80000001, format), -1n);
  assert.equal(sphExactUnitsFromF32Bits(0x3f800000, format), 1n << 149n);
  assert.equal(sphExactUnitsFromF32Bits(0x7f7fffff, format), ((1n << 24n) - 1n) << 253n);
  assert.throws(() => sphExactUnitsFromF32Bits(0x7f800000, format), RangeError);
  const coarse = createSphExactMassFormat({ wordCount: 2, quantumExponent: 0 });
  assert.equal(sphExactUnitsFromF32Bits(f32Bits(-6), coarse), -6n);
  assert.throws(() => sphExactUnitsFromF32Bits(f32Bits(0.5), coarse), RangeError);
});

test('signed projection returns every finite f32 exactly and rounds once otherwise', () => {
  for (const bits of [1, 0x80000001, 0x007fffff, 0x00800000, 0x3f800000, 0xbf800000, 0x7f7fffff, 0xff7fffff, 0x4b3c614e]) {
    const words = encodeSphExactSignedUnits(sphExactUnitsFromF32Bits(bits, format), format);
    assert.deepEqual(projectSphExactSignedF32Bits(words, format), { bits, error: 0 });
  }
  // 1 + 2^-24 is a tie between 1 and 1 + 2^-23: nearest even keeps 1.
  const tie = encodeSphExactSignedUnits(-((1n << 149n) + (1n << 125n)), format);
  assert.deepEqual(projectSphExactSignedF32Bits(tie, format), { bits: 0xbf800000, error: 0 });
  assert.deepEqual(projectSphExactSignedF32Bits(encodeSphExactSignedUnits(min, format), format),
    { bits: 0, error: E.PROJECTION_OVERFLOW });
  assert.deepEqual(projectSphExactSignedF32Bits(encodeSphExactSignedUnits(0n, format), format), { bits: 0, error: 0 });
});

test('ledger WGSL generators emit bounded integer operations and validate their names', () => {
  const ledger = createSphExactLedgerWgsl(format);
  for (const name of ['el_add', 'el_subtract', 'el_compare', 'el_from_f32_bits', 'el_project_f32_bits', 'el_magnitude']) {
    assert.match(ledger, new RegExp(`fn ${name}\\(`));
  }
  assert.doesNotMatch(ledger, /gcd|array<u32, \d{3}/i);
  const scatter = createSphExactLedgerScatterWgsl(format, { prefix: 'acc', counters: 'counters', stride: 72, offset: 36 });
  assert.match(scatter, /return row \* 72u \+ 36u \+ select\(0u, 18u, negative\);/);
  for (const name of ['acc_scatter_f32', 'acc_scatter_value', 'acc_drain', 'acc_add_counter']) {
    assert.match(scatter, new RegExp(`fn ${name}\\(`));
  }
  assert.throws(() => createSphExactLedgerScatterWgsl(format, { prefix: 'bad-name', counters: 'counters' }), TypeError);
  assert.throws(() => createSphExactLedgerScatterWgsl(format, { prefix: 'acc', counters: 'c', offset: -1 }), RangeError);
});

test('Phase 0 probe fixture is deterministic and its verifier rejects a one-quantum error', () => {
  const fixture = createSphExactLedgerProbeFixture();
  assert.equal(fixture.rows, 6784);
  assert.equal(fixture.massTotal, createSphExactLedgerProbeFixture().massTotal);
  assert.deepEqual(SPH_EXACT_LEDGER_PROBE_LEDGER_ONLY_PASSES, ['carry', 'budget']);
  assert.ok(SPH_EXACT_LEDGER_PROBE_LEDGER_ONLY_PASSES.every(name => SPH_EXACT_LEDGER_PROBE_PASSES.includes(name)));
  let sparse = 0;
  for (let row = 0; row < 4096; row++) {
    const bits = sphExactLedgerProbeSourceBits(3, row);
    assert.notEqual((bits >>> 23) & 255, 255);
    if (bits) sparse++;
  }
  assert.ok(sparse > 300 && sparse < 700);
  // A zero-step record: totals equal the host's initial ledgers.
  const words = value => Array.from(encodeSphExactSignedUnits(value, format));
  const evidence = { steps: 0, gpuErrors: [], control: [0, 0, 0, 0, 0, 0, 0, 1, 0],
    ledgerWords: { LAST_M: words(fixture.massTotal), AUDIT_M: words(fixture.massTotal),
      LAST_U: words(fixture.energyTotal), AUDIT_U: words(fixture.energyTotal), SOURCE: words(0n) } };
  const clean = verifySphExactLedgerProbeEvidence(evidence, fixture);
  assert.equal(clean.checks.massEqualsHostInitial, true);
  assert.equal(clean.checks.energyEqualsHostInitialPlusSources, true);
  assert.equal(clean.checks.atLeast1000RandomTransfers, false);
  evidence.ledgerWords.LAST_U = words(fixture.energyTotal + 1n);
  assert.equal(verifySphExactLedgerProbeEvidence(evidence, fixture).checks.energyEqualsHostInitialPlusSources, false);
});
