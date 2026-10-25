import assert from 'node:assert/strict';
import test from 'node:test';
import { createSphExactMassFormat } from '../ulg-gpu-abi/src/sphExactMassInventory.js';
import { compileSphExactReactionAllocation } from '../src/runtime/sph/sphExactReactionAllocation.js';
import { encodeSphExactReactionKineticScale, selectSphExactReactionKineticCap,
  createSphExactReactionKineticCapWgsl } from '../src/runtime/sph/sphExactReactionKineticCap.js';
import { createExactReactionAllocationFixture } from './fixtures/sphExactReactionAllocationNative.js';
import { exactReactionKineticCapCases } from './fixtures/sphExactReactionKineticCapNative.js';

function compile(options = {}, format = createSphExactMassFormat()) {
  const fixture = createExactReactionAllocationFixture(options);
  return { ...fixture, compiled: compileSphExactReactionAllocation({ ...fixture, format, reactionIndex: 0 }) };
}
const integer = words => [...words].reverse().reduce((a, b) => (a << 32n) | BigInt(b), 0n);
const float32 = bits => { const b = new DataView(new ArrayBuffer(4)); b.setUint32(0, bits); return b.getFloat32(0); };
const bits32 = value => { const b = new DataView(new ArrayBuffer(4)); b.setFloat32(0, value); return b.getUint32(0); };

// Independent rational oracle starts from each ORIGINAL scalar, never from
// compiled normalized weights/scale or the encoded GPU coefficient record.
function rational(value) {
  const view = new DataView(new ArrayBuffer(8)); view.setFloat64(0, value);
  const bits = view.getBigUint64(0), encoded = Number((bits >> 52n) & 2047n);
  const numerator = (bits & ((1n << 52n) - 1n)) | (encoded ? 1n << 52n : 0n);
  const shift = encoded ? encoded - 1075 : -1074;
  return shift >= 0 ? [numerator << BigInt(shift), 1n] : [numerator, 1n << BigInt(-shift)];
}
function reference(compiled, extentBits, available) {
  let numerator = 0n, denominator = 1n;
  for (const term of compiled.reactants) {
    const [cn, cd] = rational(term.coefficient), [mn, md] = rational(term.molarMass);
    numerator = numerator * cd * md + cn * mn * denominator;
    denominator *= cd * md;
  }
  const [en, ed] = rational(float32(extentBits));
  numerator *= en; denominator *= ed;
  const q = compiled.format.quantumExponent;
  if (q < 0) numerator <<= BigInt(-q); else denominator <<= BigInt(q);
  const result = numerator / denominator;
  return result < available ? result : available;
}

test('kinetic encoding preserves original binary64 scale, width and defensive ownership', () => {
  const { compiled } = compile({ identity: true, coefficients: [1 + 2 ** -23, 1],
    molarMasses: { h2: 1 + 2 ** -23, o2: 1 } });
  const words = encodeSphExactReactionKineticScale(compiled), n = compiled.format.wordCount;
  assert.equal(words.length, n + 8);
  assert.equal(words[0] | 0, compiled.reactantWeightScale.exponent - compiled.format.quantumExponent);
  assert.equal(integer(words.subarray(4)), compiled.reactantWeightSum * compiled.reactantWeightScale.coefficient);
  assert.ok(words[1] > 0 && words[1] <= n + 4 && words[words[1] + 3] !== 0);
  assert.ok(words.subarray(words[1] + 4).every(word => word === 0));
  assert.deepEqual([...words.subarray(2, 4)], [0, 0]);
  words.fill(0);
  assert.notEqual(encodeSphExactReactionKineticScale(compiled)[1], 0);
  assert.equal(compiled.physicalPublicationAdmitted, false);
});

test('cap floors after the shared exact sum rather than per-reactant rounding', () => {
  const { compiled } = compile({ identity: true, coefficients: [1, 1],
    molarMasses: { h2: 0.75, o2: 0.75 } }, createSphExactMassFormat({ wordCount: 1, quantumExponent: 0 }));
  assert.equal(selectSphExactReactionKineticCap(compiled, bits32(1), 100n), 1n);
  assert.equal(selectSphExactReactionKineticCap(compiled, bits32(2), 100n), 3n);
  assert.equal(selectSphExactReactionKineticCap(compiled, bits32(2), 2n), 2n);
});

test('positive, zero, normal and subnormal extents agree with independent scalar-rational oracle', () => {
  let count = 0;
  for (const wordCount of [1, 9, 66]) for (const quantumExponent of [-1074, -149, 0, 1023]) {
    const { compiled } = compile({}, createSphExactMassFormat({ wordCount, quantumExponent }));
    const maximum = (1n << BigInt(32 * wordCount)) - 1n;
    for (const bits of [0, 1, 2, 0x7fffff, 0x800000, 0x800001, 0x3f000000,
      0x3f7fffff, 0x3f800000, 0x3f800001, 0x5f7fffff, 0x7f7fffff]) {
      for (const available of [0n, 1n, maximum / 2n, maximum]) {
        assert.equal(selectSphExactReactionKineticCap(compiled, bits, available), reference(compiled, bits, available));
        count++;
      }
    }
  }
  assert.equal(count, 576);
});

test('admitted term products retain low bits lost by f32 multiplication', () => {
  for (const quantumExponent of [-149, -300]) {
    const { compiled } = compile({ identity: true, coefficients: [1 + 2 ** -23, 3 + 2 ** -21],
      molarMasses: { h2: 1 + 2 ** -22, o2: 1 + 2 ** -23 } },
    createSphExactMassFormat({ wordCount: 66, quantumExponent }));
    const available = (1n << 2112n) - 1n;
    for (const bits of [1, 0x3eaaaaab, 0x3f800000, 0x3f800001, 0x7f7fffff]) {
      assert.equal(selectSphExactReactionKineticCap(compiled, bits, available), reference(compiled, bits, available));
    }
    const exact = selectSphExactReactionKineticCap(compiled, bits32(1), available);
    const roundedSum = compiled.reactants.reduce((sum, term) => sum + Math.fround(term.coefficient * term.molarMass), 0);
    const [roundedNumerator, roundedDenominator] = rational(roundedSum);
    assert.notEqual(exact, (roundedNumerator << BigInt(-quantumExponent)) / roundedDenominator);
  }
});

test('copied/stale compiler tokens, invalid f32 patterns and out-of-width availability reject', () => {
  const { compiled, reactionTable } = compile();
  assert.throws(() => encodeSphExactReactionKineticScale({ ...compiled }), /original compiler token/);
  for (const invalid of [-1, 1.5, 2 ** 32, NaN, Infinity, 0x80000000, 0xbf800000, 0x7f800000, 0x7fc00000, 0xff800000]) {
    assert.throws(() => selectSphExactReactionKineticCap(compiled, invalid, 1n), /finite nonnegative f32/);
  }
  for (const invalid of [-1n, 0, 1n << BigInt(compiled.format.wordCount * 32)]) {
    assert.throws(() => selectSphExactReactionKineticCap(compiled, 0, invalid), /outside inventory width/);
  }
  reactionTable.productTermRecords[2] += 1;
  assert.throws(() => encodeSphExactReactionKineticScale(compiled), /snapshot changed/);
  assert.throws(() => selectSphExactReactionKineticCap(compiled, 0, 1n), /snapshot changed/);
});

// CPU translation of the shader's bounded base-2^16 arithmetic. This verifies
// carry/shift reasoning against direct BigInt multiplication, NOT native WGSL
// execution. The root native fixture separately executes the generated shader.
function limbCap(coefficient, extentBits, scaleExponent, available, n) {
  const words = new Uint32Array(n + 4);
  for (let i = 0; i < words.length; i++) { words[i] = Number(coefficient & 0xffffffffn); coefficient >>= 32n; }
  assert.equal(coefficient, 0n);
  const encoded = (extentBits >>> 23) & 255;
  const significand = (extentBits & 0x7fffff) | (encoded ? 0x800000 : 0);
  if (!significand || !available) return 0n;
  const product = new Uint32Array((n + 5) * 2);
  for (let i = 0; i < words.length * 2; i++) {
    const digit = (words[i >>> 1] >>> ((i % 2) * 16)) & 65535;
    let carry = 0;
    for (let j = 0; j < 2; j++) {
      const term = (significand >>> (j * 16)) & 65535;
      const sum = product[i + j] + digit * term + carry;
      assert.ok(sum <= 0xffffffff, 'partial accumulation fits u32');
      product[i + j] = sum & 65535; carry = sum >>> 16;
    }
    assert.equal(product[i + 2], 0, 'final carry slot has not been written');
    product[i + 2] = carry;
  }
  let top = -1;
  for (let i = product.length - 1; i >= 0; i--) if (product[i]) { top = i * 16 + 31 - Math.clz32(product[i]); break; }
  const shift = scaleExponent + (encoded ? encoded - 150 : -149), shiftedTop = top + shift;
  if (shiftedTop < 0) return 0n;
  if (shiftedTop > available.toString(2).length - 1) return available;
  let result = 0n;
  for (let bit = 0; bit <= shiftedTop; bit++) {
    const sourceBit = bit - shift;
    if (sourceBit >= 0 && sourceBit < product.length * 16) {
      result |= BigInt((product[sourceBit >>> 4] >>> (sourceBit % 16)) & 1) << BigInt(bit);
    }
  }
  return result > available ? available : result;
}

test('full-width carry/shift model matches BigInt with 6600 deterministic varied inputs', () => {
  let seed = 0x9e3779b9, count = 0;
  const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0; };
  const randomInteger = n => { let value = 0n; for (let i = 0; i < n; i++) value = (value << 32n) | BigInt(random()); return value; };
  for (const n of [1, 9, 66]) {
    const maximum = (1n << BigInt(n * 32)) - 1n;
    for (let i = 0; i < 2200; i++) {
      const coefficient = i % 11 === 0 ? (1n << BigInt((n + 4) * 32)) - 1n : randomInteger(n + 4) | 1n;
      const extentBits = i % 13 === 0 ? 0x7f7fffff : (random() & 0x7fffffff) % 0x7f800000;
      const available = i % 7 === 0 ? maximum : randomInteger(n);
      const encoded = (extentBits >>> 23) & 255;
      const significand = BigInt((extentBits & 0x7fffff) | (encoded ? 0x800000 : 0));
      const shift = i % 17 === 0 ? 4000 : i % 19 === 0 ? -4000 : -(random() % 192);
      const scaleExponent = shift - (encoded ? encoded - 150 : -149);
      const product = coefficient * significand;
      const cap = shift >= 0 ? product << BigInt(shift) : product >> BigInt(-shift);
      assert.equal(limbCap(coefficient, extentBits, scaleExponent, available, n), cap < available ? cap : available);
      count++;
    }
  }
  assert.equal(count, 6600);
});

test('WGSL remains binding-free and requires original issued format', () => {
  const format = createSphExactMassFormat({ wordCount: 66 });
  const code = createSphExactReactionKineticCapWgsl(format);
  assert.ok(code.includes('fn ek_cap_from_extent') && code.includes('ek_scale_word(scale_offset'));
  assert.ok(code.includes('array<u32, 142>'));
  assert.equal(code.includes('@binding'), false);
  assert.equal(code.includes('fn em_'), false);
  assert.throws(() => createSphExactReactionKineticCapWgsl({ ...format }), /Original immutable/);
});

test('native vectors retain hidden units and exercise wide saturation and subquantum floor at every width', () => {
  for (const wordCount of [1, 9, 66]) {
    const format = createSphExactMassFormat({ wordCount }), { compiled } = compile({}, format);
    const rows = exactReactionKineticCapCases(format, compiled);
    assert.equal(rows.length, 58);
    const evaluate = name => {
      const row = rows.find(item => item.name === name);
      return limbCap(integer(row.scaleWords.subarray(4)), row.extentBits,
        row.scaleWords[0] | 0, row.available, wordCount);
    };
    assert.equal(evaluate('retained-low-coefficient'), (1n << 24n) + 1n);
    assert.equal(evaluate('exact-subquantum-zero'), 0n);
    assert.equal(evaluate('exact-one-unit'), 1n);
    assert.equal(evaluate('wide-product-clamp'), (1n << BigInt(32 * wordCount)) - 1n);
    assert.equal(rows.filter(row => row.name.startsWith('invalid-f32-')).length, 6);
    assert.ok(evaluate('wide-product-carry-floor') > 0n);
  }
});
