import assert from 'node:assert/strict';
import test from 'node:test';
import { createSphExactMassFormat, SPH_EXACT_MASS_ERROR as E } from '../ulg-gpu-abi/src/sphExactMassInventory.js';
import { createSphExactProductEnergyWgsl } from '../src/runtime/sph/sphExactProductEnergyWgsl.js';
import { exactProductEnergyCases, exactProductEnergyProjectedPair, referenceExactProductEnergy, runExactProductEnergyNative }
  from './fixtures/sphExactProductEnergyNative.js';

const abs = n => n < 0n ? -n : n;
const canonical = n => ({ value: n, negative: Number(n < 0n), error: 0 });

for (const wordCount of [1, 9, 66]) {
  const format = createSphExactMassFormat({ wordCount, quantumExponent: wordCount === 66 ? -1074 : -149 });
  const maximum = (1n << BigInt(32 * wordCount)) - 1n;
  const scaleMaximum = (1n << BigInt(32 * (wordCount + 4))) - 1n;
  const extensiveMaximum = (1n << BigInt(32 * (wordCount + 18))) - 1n;
  const wideMaximum = (1n << BigInt(32 * (3 * wordCount + 26))) - 1n;

  test(`product energy ${wordCount}-word subnormal COM projection retains both correction signs`, () => {
    const toward = exactProductEnergyProjectedPair(format, 1n, 2n, [1, 0x80000001, 0], [0, 0, 0]);
    assert.deepEqual(toward.projectedBits, [0, 0x80000000, 0]);
    const a = referenceExactProductEnergy(format, toward);
    assert.deepEqual(a.correction, canonical(2n));
    assert.deepEqual(a.total, canonical(2n));
    const away = exactProductEnergyProjectedPair(format, 2n, 1n, [1, 0x80000001, 0], [0, 0, 0]);
    assert.deepEqual(away.projectedBits, [1, 0x80000001, 0]);
    const b = referenceExactProductEnergy(format, away);
    assert.deepEqual(b.correction, canonical(-10n));
    assert.deepEqual(b.total, canonical(8n));
    assert.equal(b.total.value, 2n * (2n ** 2n), 'exact COM energy remains despite rounding velocity outward');
  });

  test(`product energy ${wordCount}-word corrected residual preserves its last bit and canonical cancellation`, () => {
    const base = { total: 3n, px: 2n << 150n, projectedKE: 3n };
    assert.deepEqual(referenceExactProductEnergy(format, { ...base, chosenResidual: 5n }).residual, canonical(0n));
    assert.deepEqual(referenceExactProductEnergy(format, { ...base, chosenResidual: 6n }).residual, canonical(1n));
    assert.deepEqual(referenceExactProductEnergy(format, { ...base, chosenResidual: 4n }).residual, canonical(-1n));
    assert.deepEqual(referenceExactProductEnergy(format, { productInternal: -1n, projectedKE: 3n, px: 1n << 150n }).total, canonical(0n));
    const shifted = referenceExactProductEnergy(format, { ...base, chosenResidual: (5n * scaleMaximum << 104n) + 1n,
      massScale: scaleMaximum, fractionalShift: 104 });
    assert.deepEqual(shifted.residual, canonical(1n));
    assert.equal(shifted.total.value, (9n * scaleMaximum << 104n) + 1n);
  });

  test(`product energy ${wordCount}-word total eliminates projected KE by an independent exact identity`, () => {
    for (const row of exactProductEnergyCases(format).filter(row => row.name.startsWith('independent-projected-pair-'))) {
      const result = referenceExactProductEnergy(format, row);
      assert.equal(result.error, 0, row.name);
      const c = row.total, d = c * row.massScale, t = BigInt(row.fractionalShift);
      const psquared = [row.px, row.py, row.pz].reduce((sum, p) => sum + (p >> 150n) ** 2n, 0n);
      assert.equal(result.correction.value * c,
        ((psquared - c * row.projectedKE) * d) << t, row.name);
      assert.equal(result.total.value - row.chosenResidual,
        (row.productInternal * d + psquared * row.massScale) << t, row.name);
      assert.equal(result.total.value,
        ((row.productInternal + row.projectedKE) * d << t) + result.residual.value, row.name);
      // The total cannot depend on which nonnegative representable Khat was chosen.
      const zeroProjection = referenceExactProductEnergy(format, { ...row, projectedKE: 0n });
      assert.equal(zeroProjection.total.value, result.total.value, row.name);
    }
  });

  test(`product energy ${wordCount}-word maximal represented energies widen before summation`, () => {
    const result = referenceExactProductEnergy(format, { total: maximum, projectedKE: extensiveMaximum,
      productInternal: extensiveMaximum, massScale: scaleMaximum, fractionalShift: 104 });
    assert.equal(result.error, 0);
    const d = maximum * scaleMaximum;
    assert.deepEqual(result.correction, canonical(-(maximum * extensiveMaximum * scaleMaximum << 104n)));
    assert.equal(result.total.value, extensiveMaximum * d << 104n);
    assert.ok(2n * extensiveMaximum > extensiveMaximum, 'the represented U+K sum exceeds EE capacity');
    assert.ok(abs(result.total.value) <= wideMaximum);
    const pair = exactProductEnergyProjectedPair(format, maximum / 3n, maximum - maximum / 3n,
      [0x7f7fffff, 0x80000001, 0x3f800001], [0x7f7fffff, 0x80000001, 0x3f800001]);
    assert.deepEqual(referenceExactProductEnergy(format, pair).correction, canonical(0n));
  });

  test(`product energy ${wordCount}-word rejects malformed denominator, canonical signs and discarded momentum`, () => {
    const bad = [
      [{ total: 0n, denominator: 1n }, E.DIVISION_BY_ZERO],
      [{ massScale: 0n, denominator: 1n }, E.INVALID_RATIO],
      [{ massScale: -1n, denominator: 1n }, E.INVALID_RATIO],
      [{ massScale: scaleMaximum + 1n }, E.INVALID_RATIO],
      [{ denominator: 0n }, E.INVALID_RATIO], [{ denominator: -1n }, E.INVALID_RATIO],
      [{ total: maximum, massScale: scaleMaximum, denominator: maximum * scaleMaximum - 1n }, E.INVALID_RATIO],
      [{ fractionalShift: 105 }, E.INVALID_RATIO], [{ fractionalShift: 0xffffffff }, E.INVALID_RATIO],
      [{ projectedKE: -1n }, E.INVALID_RATIO],
      ...['px', 'projectedKE', 'productInternal', 'chosenResidual'].map(field => [{ [field]: { value: 0n, negative: 1 } }, E.INVALID_RATIO]),
      [{ py: { value: 1n << 150n, negative: 2 } }, E.INVALID_RATIO],
      [{ chosenResidual: { value: 1n, negative: 2 } }, E.INVALID_RATIO],
      [{ px: 1n }, E.INEXACT_INPUT], [{ pz: -(1n << 149n) }, E.INEXACT_INPUT],
      [{ px: { value: 0n, error: E.INVALID_FLOAT } }, E.INVALID_FLOAT],
      [{ productInternal: { value: 0n, error: E.OVERFLOW }, chosenResidual: { value: 0n, error: E.INVALID_FLOAT } }, E.OVERFLOW | E.INVALID_FLOAT]
    ];
    for (const [row, error] of bad) {
      const result = referenceExactProductEnergy(format, row);
      assert.equal(result.error, error);
      for (const key of ['correction', 'residual', 'total']) assert.deepEqual(result[key], { value: 0n, negative: 0, error });
    }
  });

  test(`product energy ${wordCount}-word checks correction, residual and final total overflow`, () => {
    for (const row of [
      { px: extensiveMaximum & ~((1n << 150n) - 1n), massScale: scaleMaximum, fractionalShift: 104 },
      { px: 1n << 150n, chosenResidual: wideMaximum },
      { productInternal: 1n, chosenResidual: wideMaximum },
      { productInternal: -1n, chosenResidual: -wideMaximum }
    ]) {
      const result = referenceExactProductEnergy(format, row);
      assert.equal(result.error, E.OVERFLOW);
      for (const key of ['correction', 'residual', 'total']) assert.deepEqual(result[key], { value: 0n, negative: 0, error: E.OVERFLOW });
    }
    assert.deepEqual(referenceExactProductEnergy(format, { chosenResidual: -wideMaximum }).total, canonical(-wideMaximum));
  });

  test(`product energy ${wordCount}-word native vectors pack all limbs before the GPU boundary`, async () => {
    const rows = exactProductEnergyCases(format);
    assert.equal(rows.length, 64);
    for (const row of rows) {
      const result = referenceExactProductEnergy(format, row);
      for (const key of ['correction', 'residual', 'total']) {
        assert.ok(abs(result[key].value) <= wideMaximum, `${row.name}/${key}`);
        assert.equal(result[key].negative, Number(result[key].value < 0n), `${row.name}/${key} canonical sign`);
      }
    }
    const sentinel = new Error('CPU product-energy fixture packing complete');
    await assert.rejects(runExactProductEnergyNative({ createShaderModule() { throw sentinel; } }, format), error => error === sentinel);
  });
}

test('product energy shader requires an original immutable matching format', () => {
  const format = createSphExactMassFormat();
  assert.equal(typeof createSphExactProductEnergyWgsl(format), 'string');
  assert.throws(() => createSphExactProductEnergyWgsl({ ...format }), /original/i);
});
