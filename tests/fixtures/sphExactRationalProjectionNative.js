import { createSphExactMassWgsl } from '../../src/runtime/sph/sphExactMassWgsl.js';
import { createSphExactExtensiveWgsl } from '../../src/runtime/sph/sphExactExtensiveWgsl.js';
import { createSphExactCaloricWgsl } from '../../src/runtime/sph/sphExactCaloricWgsl.js';
import { createSphExactRationalProjectionWgsl } from '../../src/runtime/sph/sphExactRationalProjectionWgsl.js';
import { validateSphExactMassFormat, SPH_EXACT_MASS_ERROR as E } from '../../ulg-gpu-abi/src/sphExactMassInventory.js';
import { deferConfirmedSubmittedWorkCleanup } from '../../src/runtime/webgpuComputeLayout.js';

export { createSphExactMassFormat } from '../../ulg-gpu-abi/src/sphExactMassInventory.js';

const abs = value => value < 0n ? -value : value;
const entry = (value = 0n) => typeof value === 'bigint'
  ? { value: abs(value), negative: Number(value < 0n), error: 0 }
  : { value: abs(value.value ?? 0n), negative: value.negative ?? Number((value.value ?? 0n) < 0n), error: value.error ?? 0 };
const width = format => 3 * format.wordCount + 26;
const bitLength = value => value === 0n ? 0 : value.toString(2).length;

function checkedRow(format, row) {
  validateSphExactMassFormat(format);
  const numerator = entry(row.numerator), denominator = entry(row.denominator ?? 1n);
  const binaryExponent = row.binaryExponent ?? 0, limit = 1n << BigInt(32 * width(format));
  if (!Number.isInteger(binaryExponent) || binaryExponent < -2147483648 || binaryExponent > 2147483647
    || numerator.value >= limit || denominator.value >= limit
    || [numerator, denominator].some(value => !Number.isInteger(value.negative) || value.negative < 0 || value.negative > 0xffffffff
      || !Number.isInteger(value.error) || value.error < 0 || value.error > 0xffffffff)) {
    throw new RangeError('Exact rational projection fixture input range');
  }
  return { numerator, denominator, binaryExponent };
}

// Compare n/d * 2^e with c * 2^ce. Bit lengths avoid huge shifts for i32
// exponent endpoints; equal-order comparisons remain bounded by input width.
function compareDyadic(n, d, e, c, ce) {
  if (c === 0n) return n === 0n ? 0 : 1;
  const right = d * c, order = bitLength(n) + e - bitLength(right) - ce;
  if (order !== 0) return Math.sign(order);
  const leftScaled = e >= ce ? n << BigInt(e - ce) : n;
  const rightScaled = ce >= e ? right << BigInt(ce - e) : right;
  return leftScaled < rightScaled ? -1 : leftScaled > rightScaled ? 1 : 0;
}
function positiveFloat(bits) {
  if (bits === 0x7f800000) return { coefficient: 1n, exponent: 128 }; // virtual upper neighbor
  const encoded = bits >>> 23;
  return { coefficient: BigInt((bits & 0x007fffff) | (encoded ? 0x00800000 : 0)), exponent: encoded ? encoded - 150 : -149 };
}

/** Independent oracle: binary-search the ordered f32 encoding, then compare
 * against the exact adjacent-value midpoint. It does not use shader quotient
 * normalization, scratch shifts or long division. */
export function referenceExactRationalProjection(format, row) {
  const { numerator: n, denominator: d, binaryExponent: exponent } = checkedRow(format, row);
  let error = (n.error | d.error) >>> 0;
  if (n.negative > 1 || (n.negative !== 0 && n.value === 0n) || d.negative !== 0) error |= E.INVALID_RATIO;
  if (d.value === 0n) error |= E.DIVISION_BY_ZERO;
  if (error) return { bits: 0, error: error >>> 0 };
  if (n.value === 0n) return { bits: 0, error: 0 };
  const sign = n.negative ? 0x80000000 : 0;
  // At the overflow midpoint the even successor is infinity, which this
  // checked projection represents only through its error flag.
  if (compareDyadic(n.value, d.value, exponent, 0x1ffffffn, 103) >= 0) {
    return { bits: 0, error: E.PROJECTION_OVERFLOW };
  }
  let low = 0, high = 0x7f7fffff;
  while (low < high) {
    const middle = low + Math.ceil((high - low) / 2), value = positiveFloat(middle);
    if (compareDyadic(n.value, d.value, exponent, value.coefficient, value.exponent) >= 0) low = middle;
    else high = middle - 1;
  }
  const lower = positiveFloat(low), upper = positiveFloat(low + 1);
  const commonExponent = Math.min(lower.exponent, upper.exponent);
  const midpointCoefficient = (lower.coefficient << BigInt(lower.exponent - commonExponent))
    + (upper.coefficient << BigInt(upper.exponent - commonExponent));
  const side = compareDyadic(n.value, d.value, exponent, midpointCoefficient, commonExponent - 1);
  const bits = low + Number(side > 0 || (side === 0 && (low & 1) !== 0));
  return { bits: (sign | bits) >>> 0, error: bits === 0 ? E.PROJECTION_UNDERFLOW : 0 };
}

export function exactRationalProjectionCases(format) {
  validateSphExactMassFormat(format);
  const bits = 32 * width(format), maximum = (1n << BigInt(bits)) - 1n;
  const factor = 1n << BigInt(bits - 26), halfway = 0x1000001n * factor;
  const rows = [
    { name: 'canonical-zero' },
    { name: 'positive-one', numerator: 1n },
    { name: 'negative-one', numerator: -1n },
    { name: 'positive-third', numerator: 1n, denominator: 3n },
    { name: 'negative-third', numerator: -1n, denominator: 3n },
    { name: 'tie-even-down', numerator: 0x1000001n, binaryExponent: -24 },
    { name: 'tie-even-up', numerator: 0x1000003n, binaryExponent: -24 },
    { name: 'negative-tie-even-up', numerator: -0x1000003n, binaryExponent: -24 },
    { name: 'carry-next-binade', numerator: 0x1ffffffn, binaryExponent: -24 },
    { name: 'minimum-subnormal', numerator: 1n, binaryExponent: -149 },
    { name: 'negative-minimum-subnormal', numerator: -1n, binaryExponent: -149 },
    { name: 'half-minimum-subnormal', numerator: 1n, binaryExponent: -150 },
    { name: 'negative-half-minimum-subnormal', numerator: -1n, binaryExponent: -150 },
    { name: 'subnormal-tie-odd', numerator: 3n, binaryExponent: -150 },
    { name: 'subnormal-tie-even', numerator: 5n, binaryExponent: -150 },
    { name: 'subnormal-to-normal-tie', numerator: 0xffffffn, binaryExponent: -150 },
    { name: 'maximum-finite', numerator: 0xffffffn, binaryExponent: 104 },
    { name: 'overflow-midpoint', numerator: 0x1ffffffn, binaryExponent: 103 },
    { name: 'negative-overflow-midpoint', numerator: -0x1ffffffn, binaryExponent: 103 },
    { name: 'below-overflow-midpoint', numerator: 0x3fffffdn, binaryExponent: 102 },
    { name: 'full-width-equal', numerator: maximum, denominator: maximum },
    { name: 'full-width-low-bit-denominator', numerator: maximum - 1n, denominator: maximum },
    { name: 'full-width-half-subnormal', numerator: maximum, denominator: maximum, binaryExponent: -150 },
    { name: 'full-width-above-half-subnormal', numerator: maximum, denominator: maximum - 1n, binaryExponent: -150 },
    { name: 'full-width-below-half-subnormal', numerator: maximum - 1n, denominator: maximum, binaryExponent: -150 },
    { name: 'full-width-normalization-left', numerator: 1n, denominator: maximum, binaryExponent: bits - 1 },
    { name: 'full-width-normalization-right', numerator: maximum, denominator: 1n, binaryExponent: 1 - bits },
    { name: 'full-width-exact-tie', numerator: halfway, denominator: factor, binaryExponent: -24 },
    { name: 'full-width-one-bit-above-tie', numerator: halfway + 1n, denominator: factor, binaryExponent: -24 },
    { name: 'full-width-one-bit-below-tie', numerator: halfway - 1n, denominator: factor, binaryExponent: -24 },
    { name: 'minimum-i32-exponent', numerator: 1n, binaryExponent: -2147483648 },
    { name: 'maximum-i32-exponent', numerator: 1n, binaryExponent: 2147483647 },
    { name: 'zero-ignores-extreme-exponent', binaryExponent: 2147483647 },
    { name: 'zero-denominator', numerator: 1n, denominator: 0n },
    { name: 'zero-over-zero', denominator: 0n },
    { name: 'negative-denominator', numerator: 1n, denominator: -1n },
    { name: 'negative-zero-denominator', denominator: { value: 0n, negative: 1 } },
    { name: 'negative-zero-numerator', numerator: { value: 0n, negative: 1 } },
    { name: 'malformed-numerator-sign', numerator: { value: 1n, negative: 2 } },
    { name: 'malformed-denominator-sign', numerator: 1n, denominator: { value: 1n, negative: 2 } },
    { name: 'propagated-error-union', numerator: { value: 1n, error: E.OVERFLOW }, denominator: { value: 1n, error: E.INVALID_FLOAT } },
    { name: 'zero-propagates-error', numerator: { value: 0n, error: E.INEXACT_INPUT } }
  ];
  let seed = 0x72617431;
  const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0; };
  const randomInteger = count => { let value = 0n; for (let i = 0; i < count; i++) value = (value << 32n) | BigInt(random()); return value || 1n; };
  const orders = [-151, -150, -149, -128, -127, -126, -1, 0, 1, 126, 127, 128];
  for (let i = 0; i < 96; i++) {
    const numerator = randomInteger(i % 3 === 0 ? width(format) : 1 + random() % width(format));
    const denominator = randomInteger(i % 3 === 1 ? width(format) : 1 + random() % width(format));
    rows.push({ name: `independent-rational-${i}`, numerator: i % 2 ? -numerator : numerator, denominator,
      binaryExponent: orders[i % orders.length] - bitLength(numerator) + bitLength(denominator) });
  }
  return rows;
}

function wordsOf(value, count) {
  const words = new Uint32Array(count);
  for (let i = 0; i < count; i++) { words[i] = Number(value & 0xffffffffn); value >>= 32n; }
  if (value !== 0n) throw new RangeError('Exact rational projection fixture truncation');
  return words;
}

/** Arithmetic fixture only. The caller owns scheduling native GPU execution. */
export async function runExactRationalProjectionNative(device, format,
  { onProgress = null, batchSize = 8, cases: supplied = null } = {}) {
  const rows = supplied ?? exactRationalProjectionCases(format), cw = width(format), stride = 4 + 2 * (cw + 2);
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 64 || !rows.length) throw new RangeError('Rational projection native batch');
  const inputs = new Uint32Array(rows.length * stride), expected = rows.map(row => referenceExactRationalProjection(format, row));
  rows.forEach((row, index) => {
    const checked = checkedRow(format, row); let at = index * stride;
    inputs[at] = checked.binaryExponent >>> 0; at += 4;
    for (const value of [checked.numerator, checked.denominator]) {
      inputs.set(wordsOf(value.value, cw), at); inputs.set([value.negative, value.error], at + cw); at += cw + 2;
    }
  });
  const code = createSphExactMassWgsl(format) + createSphExactExtensiveWgsl(format) + createSphExactCaloricWgsl(format)
    + createSphExactRationalProjectionWgsl(format) + `
@group(0) @binding(0) var<storage, read> ern_input: array<u32>;
@group(0) @binding(1) var<storage, read_write> ern_output: array<u32>;
@group(0) @binding(2) var<uniform> ern_parameters: vec4<u32>;
fn ern_caloric(at: u32) -> ExactCaloric {
  var value = ExactCaloric();
  for (var i = 0u; i < EC_WORDS; i++) { value.words[i] = ern_input[at + i]; }
  value.negative = ern_input[at + EC_WORDS]; value.error = ern_input[at + EC_WORDS + 1u]; return value;
}
@compute @workgroup_size(1)
fn exercise_rational_projection(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= ern_parameters.y) { return; }
  let row = ern_parameters.x + id.x; let at = row * ${stride}u;
  let result = er_project_f32_bits(ern_caloric(at + 4u), ern_caloric(at + 4u + EC_WORDS + 2u), bitcast<i32>(ern_input[at]));
  ern_output[2u * row] = result.bits; ern_output[2u * row + 1u] = result.error;
}`;
  const owned = []; let submitted = false, mapped = null;
  const progress = (phase, extra = {}) => { try { const pending = onProgress?.({ phase, wordCount: format.wordCount, caseCount: rows.length, ...extra });
    if (pending?.then) void Promise.resolve(pending).catch(() => {}); } catch {} };
  const allocate = (label, size, usage) => { const buffer = device.createBuffer({ label, size, usage }); owned.push(buffer); return buffer; };
  try {
    progress('compiling'); const module = device.createShaderModule({ code });
    const errors = (await module.getCompilationInfo()).messages.filter(item => item.type === 'error');
    if (errors.length) throw new Error(errors.map(item => `${item.lineNum}: ${item.message}`).join('\n'));
    const pipeline = await device.createComputePipelineAsync({ layout: 'auto', compute: { module, entryPoint: 'exercise_rational_projection' } });
    progress('pipeline-ready');
    const source = allocate('rational-projection-native-source', inputs.byteLength, 128 | 4 | 8);
    const output = allocate('rational-projection-native-output', rows.length * 8, 128 | 4);
    const readback = allocate('rational-projection-native-readback', source.size + output.size, 1 | 8);
    const batches = Math.ceil(rows.length / batchSize), parameterStride = Math.max(256, device.limits?.minUniformBufferOffsetAlignment ?? 256);
    const parameters = allocate('rational-projection-native-batches', batches * parameterStride, 64 | 8);
    const parameterWords = new Uint32Array(batches * parameterStride / 4);
    for (let batch = 0; batch < batches; batch++) parameterWords.set([batch * batchSize, Math.min(batchSize, rows.length - batch * batchSize)], batch * parameterStride / 4);
    device.queue.writeBuffer(source, 0, inputs); device.queue.writeBuffer(parameters, 0, parameterWords);
    for (let batch = 0; batch < batches; batch++) {
      const group = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [
        { binding: 0, resource: { buffer: source } }, { binding: 1, resource: { buffer: output } },
        { binding: 2, resource: { buffer: parameters, offset: batch * parameterStride, size: 16 } }
      ] });
      const encoder = device.createCommandEncoder(), pass = encoder.beginComputePass();
      pass.setPipeline(pipeline); pass.setBindGroup(0, group); pass.dispatchWorkgroups(Math.min(batchSize, rows.length - batch * batchSize)); pass.end();
      const command = encoder.finish(); submitted = true; device.queue.submit([command]); progress('batch-submitted', { batch, batches });
      await device.queue.onSubmittedWorkDone(); progress('batch-complete', { batch, batches });
    }
    const encoder = device.createCommandEncoder();
    encoder.copyBufferToBuffer(output, 0, readback, 0, output.size); encoder.copyBufferToBuffer(source, 0, readback, output.size, source.size);
    device.queue.submit([encoder.finish()]); await readback.mapAsync(1); mapped = readback;
    const words = new Uint32Array(readback.getMappedRange()).slice(); readback.unmap(); mapped = null;
    const results = rows.map((row, index) => {
      const checked = checkedRow(format, row), actual = { bits: words[2 * index], error: words[2 * index + 1] };
      const encode = value => ({ magnitude: String(value.value), negative: value.negative, error: value.error });
      return { name: row.name, numerator: encode(checked.numerator), denominator: encode(checked.denominator),
        binaryExponent: checked.binaryExponent, ...actual, expected: expected[index],
        matches: actual.bits === expected[index].bits && actual.error === expected[index].error };
    });
    const sourceUnchanged = inputs.every((word, index) => words[output.size / 4 + index] === word); progress('checked');
    return { wordCount: format.wordCount, quantumExponent: format.quantumExponent, caloricWords: cw, batchSize, caseCount: rows.length,
      sourceUnchanged, physicalPublicationAdmitted: false, pass: sourceUnchanged && results.every(row => row.matches), cases: results };
  } finally {
    if (mapped) mapped.unmap();
    const cleanup = () => { const errors = []; for (const buffer of owned) try { buffer.destroy(); } catch (error) { errors.push(error); }
      if (errors.length) throw new AggregateError(errors, 'Rational projection native cleanup failed'); };
    if (submitted) await deferConfirmedSubmittedWorkCleanup(device, cleanup); else cleanup();
  }
}
