import { createSphExactMassWgsl } from '../../src/runtime/sph/sphExactMassWgsl.js';
import { createSphExactExtensiveWgsl } from '../../src/runtime/sph/sphExactExtensiveWgsl.js';
import { validateSphExactMassFormat, SPH_EXACT_MASS_ERROR as ERROR }
  from '../../ulg-gpu-abi/src/sphExactMassInventory.js';
import { deferConfirmedSubmittedWorkCleanup } from '../../src/runtime/webgpuComputeLayout.js';

const abs = value => value < 0n ? -value : value;
const units = words => [...words].reverse().reduce((sum, word) => (sum << 32n) | BigInt(word), 0n);
const wordsOf = (value, count) => {
  if (typeof value !== 'bigint' || value < 0n || value >= 1n << BigInt(count * 32)) throw new RangeError('Fixture word range');
  const words = new Uint32Array(count);
  for (let i = 0; i < count; i++) { words[i] = Number(value & 0xffffffffn); value >>= 32n; }
  return words;
};
const decoded = bits => {
  if (!Number.isInteger(bits) || bits < 0 || bits > 0xffffffff) throw new RangeError('Fixture f32 bits');
  const exponent = (bits >>> 23) & 255;
  if (exponent === 255) return null;
  const coefficient = BigInt((bits & 0x7fffff) | (exponent ? 0x800000 : 0));
  return { coefficient: bits >>> 31 ? -coefficient : coefficient,
    exponent: exponent ? exponent - 150 : -149 };
};
const success = value => ({ value, negative: Number(value < 0n), error: 0 });
const failure = error => ({ value: 0n, negative: 0, error });

/** Independent BigInt reference uses direct signed multiplication and rational
 * division; it does not reproduce the GPU digit/carry or normalized divider. */
export function referenceExactExtensiveProduct(format, mass, aBits, bBits = 0x3f800000, half = false) {
  validateSphExactMassFormat(format); wordsOf(mass, format.wordCount);
  const a = decoded(aBits), b = decoded(bBits);
  if (!a || !b) return failure(ERROR.INVALID_FLOAT);
  const value = mass * a.coefficient * b.coefficient
    * (1n << BigInt(a.exponent + b.exponent + 299 - Number(half)));
  return abs(value) >= 1n << BigInt((format.wordCount + 18) * 32) ? failure(ERROR.OVERFLOW) : success(value);
}

export function referenceExactExtensiveRatio(numerator, denominator) {
  let error = numerator.error;
  if (numerator.negative > 1) error |= ERROR.INVALID_RATIO;
  if (denominator === 0n) error |= ERROR.DIVISION_BY_ZERO;
  if (error) return { bits: 0, error };
  const magnitude = abs(numerator.value);
  if (!magnitude) return { bits: 0, error: 0 };
  const sign = numerator.negative ? 0x80000000 : 0;
  const d = denominator << 299n;
  let order = magnitude.toString(2).length - d.toString(2).length;
  if (order >= 0 ? magnitude < (d << BigInt(order)) : (magnitude << BigInt(-order)) < d) order--;
  if (order > 127) return { bits: 0, error: ERROR.PROJECTION_OVERFLOW };
  const normal = order >= -126;
  const shift = normal ? order - 23 : -149;
  const scaledN = shift < 0 ? magnitude << BigInt(-shift) : magnitude;
  const scaledD = shift > 0 ? d << BigInt(shift) : d;
  let quotient = scaledN / scaledD;
  const remainder = scaledN % scaledD;
  if (remainder * 2n > scaledD || (remainder * 2n === scaledD && (quotient & 1n))) quotient++;
  if (!normal) return { bits: (sign | Number(quotient)) >>> 0,
    error: quotient === 0n ? ERROR.PROJECTION_UNDERFLOW : 0 };
  if (quotient === 1n << 24n) { quotient >>= 1n; order++; }
  if (order > 127) return { bits: 0, error: ERROR.PROJECTION_OVERFLOW };
  return { bits: (sign | ((order + 127) << 23) | (Number(quotient) - 0x800000)) >>> 0, error: 0 };
}

function rawValue(format, value = 0n, negative = Number(value < 0n), error = 0) {
  wordsOf(abs(value), format.wordCount + 18);
  return { value: negative === 1 ? -abs(value) : abs(value), negative, error };
}
function addReference(format, a, b, subtract) {
  const error = a.error | b.error | (a.negative > 1 || b.negative > 1 ? ERROR.INVALID_RATIO : 0);
  if (error) return failure(error);
  const value = a.value + (subtract ? -b.value : b.value);
  return abs(value) >= 1n << BigInt((format.wordCount + 18) * 32) ? failure(ERROR.OVERFLOW) : success(value);
}
export function referenceExactExtensive(format, row) {
  const op = row.op ?? 0;
  let value;
  if (op >= 5) {
    value = rawValue(format, row.rawA, row.negativeA, row.errorA);
    if (op !== 7) value = addReference(format, value,
      rawValue(format, row.rawB, row.negativeB, row.errorB), op === 6);
  } else {
    value = referenceExactExtensiveProduct(format, row.mass ?? 1n,
      row.a ?? 0x3f800000, op === 1 ? 0x3f800000 : row.b ?? 0x3f800000, op === 1 ? false : row.half ?? false);
    if (op >= 2) value = addReference(format, value,
      referenceExactExtensiveProduct(format, row.massB ?? 1n,
        row.c ?? 0x3f800000, row.d ?? 0x3f800000, row.halfB ?? false), op === 3);
  }
  return { ...value, projection: referenceExactExtensiveRatio(value, row.denominator ?? 1n) };
}

export function exactExtensiveCases(format) {
  validateSphExactMassFormat(format);
  const maximum = (1n << BigInt(32 * format.wordCount)) - 1n;
  const extensiveMaximum = (1n << BigInt(32 * (format.wordCount + 18))) - 1n;
  const rows = [
    { name: 'one-scaled', op: 1 },
    { name: 'negative-scaled', op: 1, a: 0xbf800000 },
    { name: 'negative-zero-factor', a: 0x80000000 },
    { name: 'negative-zero-second-factor', b: 0x80000000 },
    { name: 'zero-mass-negative', mass: 0n, a: 0xbf800000 },
    { name: 'minimum-product-quantum', a: 1, b: 1, half: true },
    { name: 'negative-minimum-quantum', a: 0x80000001, b: 1, half: true },
    { name: 'subnormal-product', a: 0x7fffff, b: 0x800000 },
    { name: 'maximal-finite-product', mass: maximum, a: 0x7f7fffff, b: 0x7f7fffff },
    { name: 'full-mass-low-product-bits', mass: maximum, a: 0x3f800001, b: 0x3f800003, half: true },
    { name: 'two-negative-factors', mass: maximum, a: 0xbf800001, b: 0xbf800003 },
    { name: 'exact-cancellation', op: 2, mass: maximum, massB: maximum,
      a: 0x7f7fffff, b: 0x3f800001, c: 0xff7fffff, d: 0x3f800001 },
    { name: 'cancel-to-minimum-quantum', op: 3, mass: maximum, massB: maximum - 1n,
      a: 1, b: 1, c: 1, d: 1, half: true, halfB: true },
    { name: 'same-mass-rational-COM', op: 4, mass: maximum, massB: maximum,
      a: 0x3f800000, c: 0xbf7fffff, denominator: maximum },
    { name: 'third-rational-COM', op: 7, rawA: 1n << 299n, denominator: 3n },
    { name: 'negative-third-rational-COM', op: 7, rawA: -(1n << 299n), denominator: 3n },
    { name: 'full-width-raw-cancellation', op: 5, rawA: extensiveMaximum, rawB: -extensiveMaximum },
    { name: 'full-width-raw-add-overflow', op: 5, rawA: extensiveMaximum, rawB: 1n },
    { name: 'negative-add-overflow', op: 5, rawA: -extensiveMaximum, rawB: -1n },
    { name: 'full-width-subtract-low-bit', op: 6, rawA: extensiveMaximum, rawB: extensiveMaximum - 1n },
    { name: 'retained-numerator-low-bit', op: 7, rawA: (maximum << 299n) + 1n, denominator: maximum },
    { name: 'signed-raw-zero-canonical', op: 5, rawA: 0n, negativeA: 1, rawB: 0n },
    { name: 'negative-zero-projection-canonical', op: 7, rawA: 0n, negativeA: 1 },
    { name: 'zero-denominator', op: 7, rawA: 1n, denominator: 0n },
    { name: 'error-union', op: 5, errorA: ERROR.INVALID_FLOAT, errorB: ERROR.OVERFLOW },
    { name: 'invalid-sign', op: 7, rawA: 1n, negativeA: 2 },
    { name: 'error-with-zero-denominator', op: 7, rawA: 1n, errorA: ERROR.INVALID_FLOAT, denominator: 0n }
  ];
  // Exact halfway cases and adjacent integer low bits cover every binary
  // rounding boundary without manufacturing floats on the GPU.
  const boundaries = [
    ['zero-tie', 1n << 149n],
    ['subnormal-odd-tie', 3n << 149n],
    ['subnormal-even-tie', 5n << 149n],
    ['normal-boundary-tie', ((1n << 24n) - 1n) << 149n],
    ['one-even-tie', ((1n << 24n) + 1n) << 275n],
    ['one-odd-tie', ((1n << 24n) + 3n) << 275n],
    ['binade-carry-tie', ((1n << 25n) - 1n) << 275n],
    ['overflow-tie', ((1n << 25n) - 1n) << 402n]
  ];
  for (const [name, value] of boundaries) for (const delta of [-1n, 0n, 1n]) for (const sign of [1n, -1n]) {
    rows.push({ name: `${name}/${delta}/${sign}`, op: 7, rawA: sign * (value + delta) });
  }
  for (const bits of [0x7f800000, 0xff800000, 0x7fc00000, 0xffffffff]) {
    rows.push({ name: `invalid-first-${bits}`, a: bits, mass: 0n });
    rows.push({ name: `invalid-second-${bits}`, b: bits });
  }
  let seed = 0x2a7b6d13;
  const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0; };
  const mass = () => { let value = 0n; for (let i = 0; i < format.wordCount; i++) value = (value << 32n) | BigInt(random()); return value; };
  const bits = () => { const value = random(); return ((value & 0x80000000) | ((value & 0x7fffffff) % 0x7f800000)) >>> 0; };
  for (let i = 0; i < 48; i++) rows.push({ name: `mixed-signed-products-${i}`, op: i % 5,
    mass: mass(), massB: mass(), a: bits(), b: bits(), c: bits(), d: bits(),
    half: Boolean(i & 1), halfB: Boolean(i & 2), denominator: mass() || 1n });
  return rows;
}

/** Root-owned native harness calls this for formats1/9/66. Results are numeric
 * evidence only; source buffers are read-only and checked unchanged. */
export async function runExactExtensiveNative(device, format, { cases: supplied = null, onProgress = null } = {}) {
  const cases = supplied ?? exactExtensiveCases(format), n = format.wordCount, w = n + 18;
  const inputStride = 12 + 3 * n + 2 * w, outputStride = w + 4;
  const sourceWords = new Uint32Array(cases.length * inputStride);
  const expected = cases.map(row => referenceExactExtensive(format, row));
  cases.forEach((row, i) => {
    const offset = i * inputStride;
    sourceWords.set([row.op ?? 0, row.a ?? 0x3f800000, row.b ?? 0x3f800000,
      row.c ?? 0x3f800000, row.d ?? 0x3f800000, Number(row.half ?? false), Number(row.halfB ?? false),
      row.negativeA ?? Number((row.rawA ?? 0n) < 0n), row.negativeB ?? Number((row.rawB ?? 0n) < 0n),
      row.errorA ?? 0, row.errorB ?? 0, 0], offset);
    sourceWords.set(wordsOf(row.mass ?? 1n, n), offset + 12);
    sourceWords.set(wordsOf(row.massB ?? 1n, n), offset + 12 + n);
    sourceWords.set(wordsOf(row.denominator ?? 1n, n), offset + 12 + 2 * n);
    sourceWords.set(wordsOf(abs(row.rawA ?? 0n), w), offset + 12 + 3 * n);
    sourceWords.set(wordsOf(abs(row.rawB ?? 0n), w), offset + 12 + 3 * n + w);
  });
  const code = createSphExactMassWgsl(format) + createSphExactExtensiveWgsl(format) + `
@group(0) @binding(0) var<storage, read> en_inputs: array<u32>;
@group(0) @binding(1) var<storage, read_write> en_outputs: array<u32>;
@compute @workgroup_size(1)
fn exercise_extensive(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= ${cases.length}u) { return; }
  let input = id.x * ${inputStride}u; let output = id.x * ${outputStride}u;
  var mass: ExactMass; var mass_b: ExactMass; var denominator: ExactMass;
  for (var i = 0u; i < EM_WORDS; i++) {
    mass.words[i] = en_inputs[input + 12u + i]; mass_b.words[i] = en_inputs[input + 12u + EM_WORDS + i];
    denominator.words[i] = en_inputs[input + 12u + 2u * EM_WORDS + i];
  }
  let op = en_inputs[input]; var value: ExactExtensive;
  if (op >= 5u) {
    var other: ExactExtensive;
    for (var i = 0u; i < EE_WORDS; i++) {
      value.words[i] = en_inputs[input + 12u + 3u * EM_WORDS + i];
      other.words[i] = en_inputs[input + 12u + 3u * EM_WORDS + EE_WORDS + i];
    }
    value.negative = en_inputs[input + 7u]; other.negative = en_inputs[input + 8u];
    value.error = en_inputs[input + 9u]; other.error = en_inputs[input + 10u];
    if (op == 5u) { value = ee_add(value, other); }
    if (op == 6u) { value = ee_subtract(value, other); }
  } else {
    if (op == 1u) { value = ee_mass_scaled(mass, en_inputs[input + 1u]); }
    else { value = ee_mass_product(mass, en_inputs[input + 1u], en_inputs[input + 2u], en_inputs[input + 5u] != 0u); }
    if (op >= 2u) {
      let other = ee_mass_product(mass_b, en_inputs[input + 3u], en_inputs[input + 4u], en_inputs[input + 6u] != 0u);
      if (op == 3u) { value = ee_subtract(value, other); } else { value = ee_add(value, other); }
    }
  }
  let projection = ee_ratio_f32_bits(value, denominator);
  for (var i = 0u; i < EE_WORDS; i++) { en_outputs[output + i] = value.words[i]; }
  en_outputs[output + EE_WORDS] = value.negative; en_outputs[output + EE_WORDS + 1u] = value.error;
  en_outputs[output + EE_WORDS + 2u] = projection.bits; en_outputs[output + EE_WORDS + 3u] = projection.error;
}`;
  const owned = []; let submitted = false, mapped = null;
  const progress = phase => {
    try {
      const observed = onProgress?.({ phase, wordCount: n, caseCount: cases.length });
      if (observed?.then) void Promise.resolve(observed).catch(() => {});
    } catch { /* Diagnostic observers never control arithmetic or cleanup. */ }
  };
  const allocate = (label, size, usage) => { const buffer = device.createBuffer({ label, size, usage }); owned.push(buffer); return buffer; };
  try {
    progress('compiling');
    const module = device.createShaderModule({ code });
    const errors = (await module.getCompilationInfo()).messages.filter(item => item.type === 'error');
    if (errors.length) throw new Error(errors.map(item => `${item.lineNum}: ${item.message}`).join('\n'));
    const pipeline = await device.createComputePipelineAsync({ layout: 'auto', compute: { module, entryPoint: 'exercise_extensive' } });
    progress('pipeline-ready');
    const source = allocate('extensive-native-source', sourceWords.byteLength, 128 | 4 | 8);
    const output = allocate('extensive-native-output', cases.length * outputStride * 4, 128 | 4);
    const readback = allocate('extensive-native-readback', source.size + output.size, 1 | 8);
    device.queue.writeBuffer(source, 0, sourceWords);
    const group = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [source, output]
      .map((buffer, binding) => ({ binding, resource: { buffer } })) });
    const encoder = device.createCommandEncoder(), pass = encoder.beginComputePass();
    pass.setPipeline(pipeline); pass.setBindGroup(0, group); pass.dispatchWorkgroups(cases.length); pass.end();
    encoder.copyBufferToBuffer(output, 0, readback, 0, output.size);
    encoder.copyBufferToBuffer(source, 0, readback, output.size, source.size);
    const command = encoder.finish(); submitted = true; device.queue.submit([command]);
    progress('submitted');
    await readback.mapAsync(1); mapped = readback;
    progress('mapped');
    const outputWords = new Uint32Array(readback.getMappedRange()).slice(); readback.unmap(); mapped = null;
    const results = cases.map((row, index) => {
      const offset = index * outputStride, magnitude = units(outputWords.subarray(offset, offset + w));
      const negative = outputWords[offset + w], error = outputWords[offset + w + 1];
      const projection = { bits: outputWords[offset + w + 2], error: outputWords[offset + w + 3] };
      const reference = expected[index];
      return { name: row.name, magnitude: String(magnitude), negative, error, projection,
        expected: { magnitude: String(abs(reference.value)), negative: reference.negative, error: reference.error,
          projection: reference.projection },
        matches: magnitude === abs(reference.value) && negative === reference.negative && error === reference.error
          && projection.bits === reference.projection.bits && projection.error === reference.projection.error };
    });
    const sourceUnchanged = sourceWords.every((word, index) => outputWords[output.size / 4 + index] === word);
    progress('checked');
    return { wordCount: n, quantumExponent: format.quantumExponent, extensiveWords: w,
      extensiveQuantum: format.quantumExponent - 299, caseCount: cases.length, sourceUnchanged,
      physicalPublicationAdmitted: false, pass: sourceUnchanged && results.every(row => row.matches), cases: results };
  } finally {
    if (mapped) mapped.unmap();
    const cleanup = () => {
      const errors = []; for (const buffer of owned) try { buffer.destroy(); } catch (error) { errors.push(error); }
      if (errors.length) throw new AggregateError(errors, 'Extensive native cleanup failed');
    };
    if (submitted) await deferConfirmedSubmittedWorkCleanup(device, cleanup); else cleanup();
  }
}
