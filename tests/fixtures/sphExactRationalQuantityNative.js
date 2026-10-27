import { createSphExactRationalQuantityWgsl, sphExactRationalQuantityLayout }
  from '../../src/runtime/sph/sphExactRationalQuantityWgsl.js';
import { SPH_EXACT_MASS_ERROR as E } from '../../ulg-gpu-abi/src/sphExactMassInventory.js';
import { deferConfirmedSubmittedWorkCleanup } from '../../src/runtime/webgpuComputeLayout.js';
import { createSphConservativeTransferPacketWgsl } from '../../src/runtime/sph/sphConservativeTransferPacketWgsl.js';
import { referenceDyadic53Packet } from './sphTransferPacketReference.js';

export const EXACT_RATIONAL_QUANTITY_OPERATIONS = Object.freeze({
  normalize: 0, add: 1, subtract: 2, multiply: 3, divide: 4, scale: 5, fromFloat: 6, project: 7, roundPacket53: 8
});
const abs = n => n < 0n ? -n : n;
const bits = n => n === 0n ? 0 : n.toString(2).length;
const gcd = (a, b) => { while (b !== 0n) { const r = a % b; a = b; b = r; } return a; };
const zero = (error = 0) => ({ negative: 0, error: error >>> 0, exponent: 0, reserved: 0, numerator: 0n, denominator: 1n });
const entry = (input = 0n) => typeof input === 'bigint'
  ? { ...zero(), numerator: abs(input), negative: Number(input < 0n) }
  : { ...zero(), ...input, numerator: abs(input.numerator ?? 0n), negative: input.negative ?? Number((input.numerator ?? 0n) < 0n) };

function checkedInput(layout, input) {
  const v = entry(input), limit = 1n << BigInt(layout.wordCount * 32);
  if (typeof v.numerator !== 'bigint' || typeof v.denominator !== 'bigint'
    || v.denominator < 0n || v.numerator >= limit || v.denominator >= limit
    || !Number.isInteger(v.exponent) || v.exponent < -2147483648 || v.exponent > 2147483647
    || [v.negative, v.error, v.reserved].some(x => !Number.isInteger(x) || x < 0 || x > 0xffffffff)) {
    throw new RangeError('Rational quantity fixture input range');
  }
  return v;
}

function canonical(layout, n, d, exponent, negative, error = 0) {
  if (negative > 1 || (n === 0n && negative !== 0)) error |= E.INVALID_RATIO;
  if (d === 0n) error |= E.DIVISION_BY_ZERO;
  if (error) return zero(error);
  if (n === 0n) return zero();
  const common = gcd(n, d); n /= common; d /= common;
  while ((n & 1n) === 0n) { n >>= 1n; exponent++; }
  while ((d & 1n) === 0n) { d >>= 1n; exponent--; }
  if (exponent < -2147483648 || exponent > 2147483647
    || bits(n) > layout.wordCount * 32 || bits(d) > layout.wordCount * 32) return zero(E.OVERFLOW);
  return { ...zero(), negative, exponent, numerator: n, denominator: d };
}
function normalize(layout, input) {
  const v = checkedInput(layout, input);
  return canonical(layout, v.numerator, v.denominator, v.exponent, v.negative,
    v.error | (v.reserved !== 0 ? E.INVALID_RATIO : 0));
}
function compareDyadic(n, d, e, c, ce) {
  if (c === 0n) return n === 0n ? 0 : 1;
  const right = d * c, difference = bits(n) + e - bits(right) - ce;
  if (difference) return Math.sign(difference);
  const left = e >= ce ? n << BigInt(e - ce) : n;
  const r = ce >= e ? right << BigInt(ce - e) : right;
  return left < r ? -1 : left > r ? 1 : 0;
}
const floatDyadic = encoded => encoded === 0x7f800000 ? { n: 1n, e: 128 }
  : { n: BigInt((encoded & 0x7fffff) | (encoded >>> 23 ? 0x800000 : 0)), e: encoded >>> 23 ? (encoded >>> 23) - 150 : -149 };

/** Projection oracle searches IEEE encoding order and exact adjacent midpoints;
 * it does not reproduce the shader's quotient/divisor algorithm. */
export function referenceRationalQuantityProjection(value) {
  if (value.error) return { bits: 0, error: value.error };
  const { numerator: n, denominator: d, exponent: e, negative } = value;
  if (n === 0n) return { bits: 0, error: 0 };
  const sign = negative ? 0x80000000 : 0;
  if (compareDyadic(n, d, e, 0x1ffffffn, 103) >= 0) return { bits: 0, error: E.PROJECTION_OVERFLOW };
  let lo = 0, hi = 0x7f7fffff;
  while (lo < hi) {
    const mid = lo + Math.ceil((hi - lo) / 2), f = floatDyadic(mid);
    if (compareDyadic(n, d, e, f.n, f.e) >= 0) lo = mid; else hi = mid - 1;
  }
  const a = floatDyadic(lo), b = floatDyadic(lo + 1), e0 = Math.min(a.e, b.e);
  const mid = (a.n << BigInt(a.e - e0)) + (b.n << BigInt(b.e - e0));
  const side = compareDyadic(n, d, e, mid, e0 - 1);
  const rounded = lo + Number(side > 0 || (side === 0 && (lo & 1) !== 0));
  return { bits: (sign | rounded) >>> 0, error: rounded ? 0 : E.PROJECTION_UNDERFLOW };
}

/** Independent mathematical oracle: native BigInt products, Euclidean gcd,
 * direct rational identities. Only the documented finite workspace admission
 * check is shared as a contract; no shader limb operations are simulated. */
export function referenceExactRationalQuantity(options, row) {
  const layout = sphExactRationalQuantityLayout(options), op = row.operation ?? 'normalize';
  if (!(op in EXACT_RATIONAL_QUANTITY_OPERATIONS)) throw new RangeError('Unknown rational quantity operation');
  let result;
  if (op === 'fromFloat') {
    const word = row.argument;
    if (!Number.isInteger(word) || word < 0 || word > 0xffffffff) throw new RangeError('Expected f32 bits');
    const encoded = (word >>> 23) & 255, c = BigInt((word & 0x7fffff) | (encoded ? 0x800000 : 0));
    result = encoded === 255 ? zero(E.INVALID_FLOAT) : c === 0n ? zero()
      : canonical(layout, c, 1n, encoded ? encoded - 150 : -149, word >>> 31);
  } else {
    const a = normalize(layout, row.a);
    if (op === 'normalize' || op === 'project') result = a;
    else if (op === 'roundPacket53') {
      if (a.error) result = a;
      else {
        const rounded = referenceDyadic53Packet({ n: a.negative ? -a.numerator : a.numerator, d: a.denominator, e: a.exponent });
        result = canonical(layout, abs(rounded.n), rounded.d, rounded.e, Number(rounded.n < 0n));
      }
    } else if (op === 'scale') {
      if (!Number.isInteger(row.argument) || row.argument < -2147483648 || row.argument > 2147483647) throw new RangeError('Expected i32 scale');
      result = a.error || a.numerator === 0n ? a
        : canonical(layout, a.numerator, a.denominator, a.exponent + row.argument, a.negative);
    } else {
      const b = normalize(layout, row.b), error = a.error | b.error;
      if (error) result = zero(error);
      else if (op === 'divide' && b.numerator === 0n) result = zero(E.DIVISION_BY_ZERO);
      else if (op === 'multiply' || op === 'divide') {
        const exponent = op === 'multiply' ? a.exponent + b.exponent : a.exponent - b.exponent;
        const numerator = op === 'multiply' ? a.numerator * b.numerator : a.numerator * b.denominator;
        const denominator = op === 'multiply' ? a.denominator * b.denominator : a.denominator * b.numerator;
        result = canonical(layout, numerator, denominator, exponent, numerator === 0n ? 0 : a.negative ^ b.negative);
      } else if (a.numerator === 0n || b.numerator === 0n) {
        result = a.numerator !== 0n ? a : { ...b, negative: b.numerator === 0n ? 0 : b.negative ^ Number(op === 'subtract') };
      } else {
        const exponent = Math.min(a.exponent, b.exponent), da = a.exponent - exponent, db = b.exponent - exponent;
        const left = a.numerator * b.denominator, right = b.numerator * a.denominator;
        const scratchBits = layout.scratchWordCount * 32;
        if (bits(left) + da > scratchBits || bits(right) + db > scratchBits) result = zero(E.OVERFLOW);
        else {
          const ln = left << BigInt(da), rn = right << BigInt(db);
          const signed = (a.negative ? -ln : ln) + ((b.negative ^ Number(op === 'subtract')) ? -rn : rn);
          result = bits(abs(signed)) > scratchBits ? zero(E.OVERFLOW)
            : canonical(layout, abs(signed), a.denominator * b.denominator, exponent, Number(signed < 0n));
        }
      }
    }
  }
  return { ...result, projection: referenceRationalQuantityProjection(result) };
}

export function exactRationalQuantityCases(options) {
  const { wordCount: r } = sphExactRationalQuantityLayout(options), max = (1n << BigInt(32 * r)) - 1n;
  const rows = [
    ...exactTransferPacketCases(options),
    { name: 'zero' }, { name: 'normalize-common-factor', a: { numerator: 6n, denominator: 10n, exponent: 3 } },
    { name: 'normalize-binary-factors', a: { numerator: 12n, denominator: 40n } },
    { name: 'normalize-full-width-equal', a: { numerator: max, denominator: max } },
    { name: 'normalize-full-width-adjacent', a: { numerator: max, denominator: max - 1n } },
    { name: 'negative-zero-invalid', a: { negative: 1 } },
    { name: 'malformed-sign', a: { numerator: 1n, negative: 2 } },
    { name: 'reserved-header-invalid', a: { numerator: 1n, reserved: 1 } },
    { name: 'zero-denominator', a: { numerator: 1n, denominator: 0n } },
    { name: 'error-propagation', operation: 'add', a: { error: E.INVALID_FLOAT }, b: { error: E.INEXACT_INPUT } },
    { name: 'normalize-exponent-overflow', a: { numerator: 2n, exponent: 2147483647 } },
    { name: 'normalize-exponent-underflow', a: { numerator: 1n, denominator: 2n, exponent: -2147483648 } },
    { name: 'add-coprime', operation: 'add', a: { numerator: 1n, denominator: 3n }, b: { numerator: 1n, denominator: 5n } },
    { name: 'subtract-exact-cancellation', operation: 'subtract', a: { numerator: max, denominator: max - 2n, exponent: 101 }, b: { numerator: max, denominator: max - 2n, exponent: 101 } },
    { name: 'add-opposite-cancellation', operation: 'add', a: max, b: -max },
    { name: 'add-different-exponents', operation: 'add', a: { numerator: 3n, denominator: 5n, exponent: -31 }, b: { numerator: -7n, denominator: 3n, exponent: 13 } },
    { name: 'add-carry-normalizes', operation: 'add', a: max, b: max },
    { name: 'add-final-capacity', operation: 'add', a: max, b: 2n },
    { name: 'add-denominator-capacity', operation: 'add', a: { numerator: 1n, denominator: max }, b: { numerator: 1n, denominator: max - 2n } },
    { name: 'subtract-negative', operation: 'subtract', a: 1n, b: 3n },
    { name: 'subtract-zero-minus-negative', operation: 'subtract', b: -3n },
    { name: 'multiply-cross-cancellation', operation: 'multiply', a: { numerator: max, denominator: max - 2n }, b: { numerator: max - 2n, denominator: max } },
    { name: 'multiply-final-capacity', operation: 'multiply', a: max, b: max },
    { name: 'divide-cancellation', operation: 'divide', a: { numerator: max, denominator: max - 2n }, b: { numerator: max, denominator: max - 2n } },
    { name: 'divide-negative', operation: 'divide', a: -3n, b: { numerator: 5n, denominator: 7n } },
    { name: 'divide-by-zero', operation: 'divide', a: 1n },
    { name: 'zero-divided-by-zero', operation: 'divide' },
    { name: 'zero-times-extreme', operation: 'multiply', b: { numerator: 1n, exponent: 2147483647 } },
    { name: 'scale-zero-extreme', operation: 'scale', argument: -2147483648 },
    { name: 'scale-overflow', operation: 'scale', a: { numerator: 1n, exponent: 2147483647 }, argument: 1 },
    { name: 'scale-underflow', operation: 'scale', a: { numerator: 1n, exponent: -2147483648 }, argument: -1 },
    { name: 'multiply-exponent-overflow', operation: 'multiply', a: { numerator: 1n, exponent: 2147483647 }, b: { numerator: 1n, exponent: 1 } },
    { name: 'divide-exponent-minimum', operation: 'divide', a: { numerator: 1n, exponent: -2147483648 }, b: { numerator: 1n, exponent: -2147483648 } },
    { name: 'divide-exponent-overflow', operation: 'divide', a: 1n, b: { numerator: 1n, exponent: -2147483648 } },
    { name: 'addition-alignment-capacity', operation: 'add', a: { numerator: 1n, exponent: -2147483648 }, b: { numerator: 1n, exponent: 2147483647 } },
    { name: 'extreme-exponent-cancellation', operation: 'subtract', a: { numerator: 1n, exponent: -2147483648 }, b: { numerator: 1n, exponent: -2147483648 } }
  ];
  for (const [name, word] of [['zero', 0], ['negative-zero', 0x80000000], ['one', 0x3f800000], ['negative-third', 0xbeaaaaab],
    ['subnormal', 1], ['negative-subnormal', 0x80000001], ['maximum', 0x7f7fffff], ['infinity', 0x7f800000], ['nan', 0xffc12345]]) {
    rows.push({ name: `float-${name}`, operation: 'fromFloat', argument: word });
  }
  const factor = 1n << BigInt(32 * r - 26), halfway = 0x1000001n * factor;
  for (const [name, a] of [
    ['third', { numerator: 1n, denominator: 3n }], ['half-min-subnormal', { numerator: 1n, exponent: -150 }],
    ['negative-half-min-subnormal', { numerator: -1n, exponent: -150 }], ['tie-even-up', { numerator: 0x1000003n, exponent: -24 }],
    ['subnormal-normal-boundary', { numerator: 0xffffffn, exponent: -150 }], ['overflow-midpoint', { numerator: 0x1ffffffn, exponent: 103 }],
    ['full-width-near-one', { numerator: max - 2n, denominator: max }],
    ['full-width-normalized-left', { numerator: 1n, denominator: max, exponent: 32 * r - 1 }],
    ['full-width-normalized-right', { numerator: max, exponent: 1 - 32 * r }],
    ['full-width-tie', { numerator: halfway, denominator: factor, exponent: -24 }],
    ['full-width-above-tie', { numerator: halfway + 1n, denominator: factor, exponent: -24 }],
    ['full-width-below-tie', { numerator: halfway - 1n, denominator: factor, exponent: -24 }]
  ]) rows.push({ name: `projection-${name}`, operation: 'project', a });
  let seed = 0x72617432;
  const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0; };
  for (let i = 0; i < 16; i++) rows.push({ name: `small-independent-${i}`, operation: ['add', 'subtract', 'multiply', 'divide'][i % 4],
    a: { numerator: BigInt((random() | 1) >>> 0), denominator: BigInt((random() | 1) >>> 0), exponent: i - 8 },
    b: { numerator: BigInt((random() | 1) >>> 0), denominator: BigInt((random() | 1) >>> 0), exponent: 8 - i } });
  return rows;
}

export function exactTransferPacketCases(options) {
  const { wordCount } = sphExactRationalQuantityLayout(options), max = (1n << BigInt(wordCount * 32)) - 1n;
  const cases = [
    ['zero', 0n], ['third', { numerator: 1n, denominator: 3n }],
    ['negative-third', { numerator: -1n, denominator: 3n }],
    ['tiny-third', { numerator: 1n, denominator: 3n, exponent: -2000 }],
    ['huge-third', { numerator: 1n, denominator: 3n, exponent: 2000 }],
    ['minimum-exponent-exact', { numerator: 1n, exponent: -2147483648 }],
    ['maximum-exponent-exact', { numerator: 1n, exponent: 2147483647 }],
    ['minimum-exponent-inexact', { numerator: 1n, denominator: 3n, exponent: -2147483648 }],
    ['full-width-tiny', { numerator: 1n, denominator: max }],
    ['full-width-large', { numerator: max }],
    ['full-width-near-one', { numerator: max - 2n, denominator: max }],
    ['invalid-denominator', { numerator: 1n, denominator: 0n }],
    ['propagated-error', { numerator: 1n, error: E.INEXACT_INPUT }]
  ];
  if (wordCount > 1) cases.push(
    ['tie-even-down', { numerator: (1n << 53n) + 1n, exponent: -53 }],
    ['tie-even-up', { numerator: (1n << 53n) + 3n, exponent: -53 }],
    ['carry-new-exponent', { numerator: (1n << 54n) - 1n, exponent: -53 }],
    ['just-below-tie', { numerator: (1n << 54n) + 1n, exponent: -54 }],
    ['just-above-tie', { numerator: (1n << 54n) + 3n, exponent: -54 }]);
  return cases.map(([name, a]) => ({ name: `packet53-${name}`, operation: 'roundPacket53', a }));
}

function packValue(words, at, layout, input) {
  const value = checkedInput(layout, input);
  words.set([value.negative, value.error, value.exponent >>> 0, value.reserved], at);
  for (const [offset, original] of [[layout.numeratorOffsetWords, value.numerator], [layout.denominatorOffsetWords, value.denominator]]) {
    let n = original; for (let i = 0; i < layout.wordCount; i++) { words[at + offset + i] = Number(n & 0xffffffffn); n >>= 32n; }
    if (n) throw new RangeError('Rational fixture refuses truncation');
  }
}
function unpackValue(words, at, layout) {
  const magnitude = offset => { let value = 0n; for (let i = layout.wordCount - 1; i >= 0; i--) value = (value << 32n) | BigInt(words[at + offset + i]); return value; };
  return { negative: words[at], error: words[at + 1], exponent: words[at + 2] | 0, reserved: words[at + 3],
    numerator: magnitude(layout.numeratorOffsetWords), denominator: magnitude(layout.denominatorOffsetWords) };
}

/** Arithmetic runner only. The parent owns native scheduling and device lifetime. */
export async function runExactRationalQuantityNative(device, options, { cases: supplied = null, batchSize = 2, onProgress = null } = {}) {
  const layout = sphExactRationalQuantityLayout(options), rows = supplied ?? exactRationalQuantityCases(options);
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 64 || !rows.length) throw new RangeError('Rational quantity native batch');
  const stride = 4 + 2 * layout.recordWords, outputStride = layout.recordWords + 2;
  const inputWords = new Uint32Array(stride * rows.length), expected = rows.map(row => referenceExactRationalQuantity(options, row));
  rows.forEach((row, index) => {
    const at = stride * index; inputWords[at] = EXACT_RATIONAL_QUANTITY_OPERATIONS[row.operation ?? 'normalize'];
    inputWords[at + 1] = (row.argument ?? 0) >>> 0;
    packValue(inputWords, at + 4, layout, row.a); packValue(inputWords, at + 4 + layout.recordWords, layout, row.b);
  });
  const rounding = rows.some(row => row.operation === 'roundPacket53');
  const code = createSphExactRationalQuantityWgsl(options) + (rounding ? createSphConservativeTransferPacketWgsl() : '') + `
@group(0) @binding(0) var<storage, read> xrn_input: array<u32>;
@group(0) @binding(1) var<storage, read_write> xrn_output: array<u32>;
@group(0) @binding(2) var<uniform> xrn_params: vec4<u32>;
fn xrn_read(at: u32) -> ExactRational {
  var v = xr_zero(); v.negative = xrn_input[at]; v.error = xrn_input[at + 1u];
  v.exponent = bitcast<i32>(xrn_input[at + 2u]); v.reserved = xrn_input[at + 3u];
  for (var i = 0u; i < XR_WORDS; i++) { v.numerator[i] = xrn_input[at + 4u + i]; v.denominator[i] = xrn_input[at + 4u + XR_WORDS + i]; }
  return ${options.canonicalOperands ? 'xr_normalize(v)' : 'v'};
}
@compute @workgroup_size(1)
fn exercise_rational_quantity(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= xrn_params.y) { return; }
  let row = xrn_params.x + id.x; let at = row * ${stride}u;
  let a = xrn_read(at + 4u); let b = xrn_read(at + 4u + ${layout.recordWords}u);
  var value = xr_zero();
  switch xrn_input[at] {
    case 0u, 7u: { value = xr_normalize(a); }
    case 1u: { value = xr_add(a, b); }
    case 2u: { value = xr_subtract(a, b); }
    case 3u: { value = xr_multiply(a, b); }
    case 4u: { value = xr_divide(a, b); }
    case 5u: { value = xr_scale_pow2(a, bitcast<i32>(xrn_input[at + 1u])); }
    case 6u: { value = xr_from_f32_bits(xrn_input[at + 1u]); }
    ${rounding ? 'case 8u: { var source = a; xrp_round_transfer53(&value, &source); }' : ''}
    default: { value = xr_failure(8192u); }
  }
  let dest = row * ${outputStride}u;
  xrn_output[dest] = value.negative; xrn_output[dest + 1u] = value.error;
  xrn_output[dest + 2u] = bitcast<u32>(value.exponent); xrn_output[dest + 3u] = value.reserved;
  for (var i = 0u; i < XR_WORDS; i++) { xrn_output[dest + 4u + i] = value.numerator[i]; xrn_output[dest + 4u + XR_WORDS + i] = value.denominator[i]; }
  let projection = xr_project_f32_bits(value);
  xrn_output[dest + ${layout.recordWords}u] = projection.bits; xrn_output[dest + ${layout.recordWords + 1}u] = projection.error;
}`;
  const owned = []; let submitted = false, mapped = null;
  const allocate = (label, size, usage) => { const buffer = device.createBuffer({ label, size, usage }); owned.push(buffer); return buffer; };
  const started = performance.now(), timings = [];
  const progress = (phase, extra = {}) => {
    const event = { phase, elapsedMs: performance.now() - started,
      wordCount: layout.wordCount, caseCount: rows.length, ...extra };
    timings.push(event);
    try { const pending = onProgress?.(event); if (pending?.then) void Promise.resolve(pending).catch(() => {}); } catch {}
  };
  try {
    progress('compiling'); const module = device.createShaderModule({ code });
    progress('module-created');
    const errors = (await module.getCompilationInfo()).messages.filter(x => x.type === 'error');
    progress('compilation-info-complete', { errorCount: errors.length });
    if (errors.length) throw new Error(errors.map(x => `${x.lineNum}: ${x.message}`).join('\n'));
    progress('pipeline-requested');
    const pipeline = await device.createComputePipelineAsync({ layout: 'auto', compute: { module, entryPoint: 'exercise_rational_quantity' } });
    progress('pipeline-complete');
    progress('pipeline-ready');
    const input = allocate('rational-quantity-native-source', inputWords.byteLength, 128 | 4 | 8);
    const output = allocate('rational-quantity-native-output', rows.length * outputStride * 4, 128 | 4);
    const readback = allocate('rational-quantity-native-readback', input.size + output.size, 1 | 8);
    const batches = Math.ceil(rows.length / batchSize), parameterStride = Math.max(256, device.limits?.minUniformBufferOffsetAlignment ?? 256);
    const params = allocate('rational-quantity-native-params', batches * parameterStride, 64 | 8);
    const parameterWords = new Uint32Array(batches * parameterStride / 4);
    for (let batch = 0; batch < batches; batch++) parameterWords.set([batch * batchSize, Math.min(batchSize, rows.length - batch * batchSize)], batch * parameterStride / 4);
    device.queue.writeBuffer(input, 0, inputWords); device.queue.writeBuffer(params, 0, parameterWords);
    for (let batch = 0; batch < batches; batch++) {
      const group = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [
        { binding: 0, resource: { buffer: input } }, { binding: 1, resource: { buffer: output } },
        { binding: 2, resource: { buffer: params, offset: batch * parameterStride, size: 16 } }
      ] });
      const encoder = device.createCommandEncoder(), pass = encoder.beginComputePass(); pass.setPipeline(pipeline); pass.setBindGroup(0, group);
      pass.dispatchWorkgroups(Math.min(batchSize, rows.length - batch * batchSize)); pass.end();
      const command = encoder.finish(); submitted = true; device.queue.submit([command]); progress('batch-submitted', { batch, batches });
      await device.queue.onSubmittedWorkDone(); progress('batch-complete', { batch, batches });
    }
    const encoder = device.createCommandEncoder(); encoder.copyBufferToBuffer(output, 0, readback, 0, output.size);
    encoder.copyBufferToBuffer(input, 0, readback, output.size, input.size); device.queue.submit([encoder.finish()]);
    await readback.mapAsync(1); mapped = readback; const words = new Uint32Array(readback.getMappedRange()).slice(); readback.unmap(); mapped = null;
    const encode = v => ({ ...v, numerator: String(v.numerator), denominator: String(v.denominator) });
    const results = rows.map((row, index) => {
      const at = index * outputStride, actual = { ...unpackValue(words, at, layout), projection: { bits: words[at + layout.recordWords], error: words[at + layout.recordWords + 1] } };
      const want = expected[index];
      const matches = ['negative', 'error', 'exponent', 'reserved', 'numerator', 'denominator'].every(key => actual[key] === want[key])
        && actual.projection.bits === want.projection.bits && actual.projection.error === want.projection.error;
      return { name: row.name, operation: row.operation ?? 'normalize', actual: encode(actual), expected: encode(want), matches };
    });
    const sourceUnchanged = inputWords.every((word, index) => words[output.size / 4 + index] === word); progress('checked');
    return { wordCount: layout.wordCount, recordWords: layout.recordWords, scratchWordCount: layout.scratchWordCount,
      caseCount: rows.length, batchSize, sourceUnchanged, timings, physicalPublicationAdmitted: false,
      pass: sourceUnchanged && results.every(x => x.matches), cases: results };
  } finally {
    if (mapped) mapped.unmap();
    const cleanup = () => { const failures = []; for (const buffer of owned) try { buffer.destroy(); } catch (error) { failures.push(error); }
      if (failures.length) throw new AggregateError(failures, 'Rational quantity native cleanup failed'); };
    if (submitted) await deferConfirmedSubmittedWorkCleanup(device, cleanup); else cleanup();
  }
}
