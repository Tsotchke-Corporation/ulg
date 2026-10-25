import { createSphExactMassWgsl } from '../../src/runtime/sph/sphExactMassWgsl.js';
import { createSphExactExtensiveWgsl } from '../../src/runtime/sph/sphExactExtensiveWgsl.js';
import { createSphExactCaloricWgsl } from '../../src/runtime/sph/sphExactCaloricWgsl.js';
import { validateSphExactMassFormat, SPH_EXACT_MASS_ERROR as E }
  from '../../ulg-gpu-abi/src/sphExactMassInventory.js';
import { deferConfirmedSubmittedWorkCleanup } from '../../src/runtime/webgpuComputeLayout.js';
import { referenceExactExtensiveProduct } from './sphExactExtensiveNative.js';

const abs = n => n < 0n ? -n : n;
const entry = (n = 0n) => typeof n === 'bigint' ? { value: n, negative: Number(n < 0n), error: 0 }
  : { value: n.value ?? 0n, negative: n.negative ?? Number((n.value ?? 0n) < 0n), error: n.error ?? 0 };
const failure = error => ({ value: 0n, negative: 0, error });
const errorOf = n => n.error | (n.negative > 1 ? E.INVALID_RATIO : 0);
const signedValue = n => n.negative ? -abs(n.value) : abs(n.value);
const wordCount = format => 3 * format.wordCount + 26;
const checked = (format, value, error = 0) => error ? failure(error)
  : abs(value) >= (1n << BigInt(32 * wordCount(format))) ? failure(E.OVERFLOW) : entry(value);
const add = (format, a, b, subtract = false) => checked(format,
  signedValue(a) + (subtract ? -signedValue(b) : signedValue(b)), errorOf(a) | errorOf(b));
const multiply = (format, a, b) => checked(format, signedValue(a) * signedValue(b), errorOf(a) | errorOf(b));
const shift = (format, a, bits) => errorOf(a) ? failure(errorOf(a)) : abs(a.value) === 0n ? entry(0n)
  : bits >= 32 * wordCount(format) ? failure(E.OVERFLOW) : checked(format, signedValue(a) << BigInt(bits));
const compare = (a, b) => signedValue(a) < signedValue(b) ? -1 : signedValue(a) > signedValue(b) ? 1 : 0;

function decodedDelta(bits) {
  if (!Number.isInteger(bits) || bits < 0 || bits > 0xffffffff) throw new RangeError('Fixture delta bits');
  const exponent = (bits >>> 23) & 255;
  if (exponent === 255) return null;
  const magnitude = BigInt((bits & 0x7fffff) | (exponent ? 0x800000 : 0));
  return { coefficient: bits >>> 31 ? -magnitude : magnitude, exponent: exponent ? exponent - 150 : -149 };
}
const targetFailure = error => ({ numerator: failure(error), denominator: failure(error), fractionalShift: 0, error });

/** Independent direct BigInt rational target. All physical source energies and
 * momenta are already signed extensive integers; no binary float division. */
export function referenceExactCaloricTarget(format, row) {
  validateSphExactMassFormat(format);
  const total = row.total ?? 1n, sensible = entry(row.sensible), kinetic = entry(row.kinetic);
  const momenta = [entry(row.px), entry(row.py), entry(row.pz)], scale = entry(row.massScale ?? 1n);
  const scaleExponent = row.scaleExponent ?? 0, delta = decodedDelta(row.deltaBits ?? 0);
  let error = [sensible, kinetic, scale, ...momenta].reduce((bits, value) => bits | errorOf(value), 0);
  if (total === 0n) error |= E.DIVISION_BY_ZERO;
  if (scale.negative !== 0 || scale.value <= 0n || abs(scale.value) >= (1n << BigInt(32 * (format.wordCount + 4)))
      || scaleExponent < -298 || scaleExponent > 254 || (kinetic.negative !== 0 && abs(kinetic.value) !== 0n)) error |= E.INVALID_RATIO;
  if (!delta) error |= E.INVALID_FLOAT;
  if (momenta.some(p => (abs(p.value) & ((1n << 150n) - 1n)) !== 0n)) error |= E.INEXACT_INPUT;
  if (error) return targetFailure(error);
  const mass = entry(total), ps = momenta.map(p => signedValue(p) / (1n << 150n));
  const relative = add(format, multiply(format, kinetic, mass), checked(format, ps.reduce((sum, p) => sum + p * p, 0n)), true);
  if (relative.error || relative.value < 0n) return targetFailure(relative.error | (relative.value < 0n ? E.INVALID_RATIO : 0));
  const s = 299 + delta.exponent - scaleExponent;
  const fractionalShift = delta.coefficient === 0n ? 0 : Math.max(-s, 0);
  const base = multiply(format, add(format, multiply(format, sensible, mass), relative), scale);
  const formation = shift(format, multiply(format, multiply(format, mass, mass), entry(delta.coefficient)), Math.max(s, 0));
  const numerator = add(format, shift(format, base, fractionalShift), formation, true);
  const denominator = multiply(format, mass, scale);
  error = numerator.error | denominator.error;
  return error ? targetFailure(error) : { numerator, denominator, fractionalShift, error: 0 };
}

export function referenceExactCaloricTrial(format, sensible, denominator, fractionalShift) {
  const b = entry(sensible), d = entry(denominator);
  let error = errorOf(b) | errorOf(d);
  if (d.negative !== 0 || d.value === 0n || fractionalShift > 104) error |= E.INVALID_RATIO;
  return error ? failure(error) : shift(format, multiply(format, b, d), fractionalShift);
}

export function referenceExactCaloric(format, row) {
  const op = row.op ?? 0, zero = entry(0n);
  if (op === 0) {
    const result = referenceExactCaloricTarget(format, row);
    const trial = result.error ? failure(result.error)
      : referenceExactCaloricTrial(format, row.trial ?? 0n, result.denominator, result.fractionalShift);
    const residual = result.error ? failure(result.error) : add(format, result.numerator, trial, true);
    return { ...result, trial, residual, error: result.error | trial.error | residual.error,
      comparison: result.error | trial.error ? 0 : compare(result.numerator, trial) };
  }
  const a = entry(row.rawA), b = entry(row.rawB);
  let numerator = zero, comparison = 0;
  if (op === 1) numerator = add(format, a, b);
  if (op === 2) numerator = add(format, a, b, true);
  if (op === 3) numerator = multiply(format, a, b);
  if (op === 4) numerator = shift(format, a, row.shift ?? 0);
  if (op === 5) numerator = referenceExactCaloricTrial(format, row.trial ?? 0n, a, row.shift ?? 0);
  if (op === 6) numerator = checked(format, signedValue(entry(row.sensible)), errorOf(entry(row.sensible)));
  if (op === 7) numerator = entry(row.total ?? 1n);
  if (op === 8) { numerator = failure(errorOf(a) | errorOf(b)); if (!numerator.error) comparison = compare(a, b); }
  return { numerator, denominator: zero, trial: zero, residual: zero,
    fractionalShift: 0, error: numerator.error, comparison };
}

// Exact extensive source vectors from two original finite-f32 velocities.
// This helper constructs test inputs, never a physical producer or authority.
export function exactCaloricPairSource(format, massA, massB, velocityA, velocityB) {
  let kinetic = 0n; const momentum = [];
  for (let axis = 0; axis < 3; axis++) {
    const a = velocityA[axis], b = velocityB[axis];
    momentum.push(referenceExactExtensiveProduct(format, massA, a).value
      + referenceExactExtensiveProduct(format, massB, b).value);
    kinetic += referenceExactExtensiveProduct(format, massA, a, a, true).value
      + referenceExactExtensiveProduct(format, massB, b, b, true).value;
  }
  return { total: massA + massB, kinetic, px: momentum[0], py: momentum[1], pz: momentum[2] };
}

export function exactCaloricCases(format) {
  validateSphExactMassFormat(format);
  const maximum = (1n << BigInt(format.wordCount * 32)) - 1n;
  const wideMaximum = (1n << BigInt(wordCount(format) * 32)) - 1n;
  const scaleMaximum = (1n << BigInt((format.wordCount + 4) * 32)) - 1n;
  const extensiveMaximum = (1n << BigInt((format.wordCount + 18) * 32)) - 1n;
  const splitA = maximum / 3n, splitB = maximum - splitA;
  const sameVelocity = [0x3f800001, 0xbf800003, 0x00000001];
  const pair = exactCaloricPairSource(format, splitA, splitB, sameVelocity, sameVelocity);
  const rows = [
    { name: 'minimum-sensible-low-part', sensible: 1n, trial: 1n },
    { name: 'negative-sensible-low-part', sensible: -1n, trial: -1n },
    { name: 'minimum-residual-low-part', sensible: 2n, trial: 1n },
    { name: 'minimum-kinetic-low-part', kinetic: 1n },
    { name: 'uniform-COM-cancellation', ...pair, sensible: maximum << 299n, trial: maximum << 299n },
    { name: 'large-near-COM-cancellation', ...exactCaloricPairSource(format, splitA, splitB,
      [0x7f7fffff, 0xff7ffffe, 0x00800000], [0x7f7ffffe, 0xff7fffff, 0x007fffff]) },
    { name: 'counterflow-COM', ...exactCaloricPairSource(format, 3n, 5n,
      [0x3f800000, 0xbf800000, 0x40000000], [0xbf800000, 0x40000000, 0xc0000000]), sensible: 1n << 299n },
    { name: 'fractional-shift-104', deltaBits: 1, scaleExponent: 254, sensible: 1n, massScale: scaleMaximum },
    { name: 'negative-fractional-formation', deltaBits: 0x80000001, scaleExponent: 254 },
    { name: 'zero-delta-no-fractional-shift', deltaBits: 0, scaleExponent: 254, sensible: 1n },
    { name: 'negative-zero-delta', deltaBits: 0x80000000, scaleExponent: 254, sensible: -1n },
    { name: 'largest-positive-formation', total: maximum, deltaBits: 0x7f7fffff, scaleExponent: -298 },
    { name: 'largest-negative-formation', total: maximum, deltaBits: 0xff7fffff, scaleExponent: -298 },
    { name: 'maximum-source-and-scale', total: maximum, sensible: extensiveMaximum,
      kinetic: extensiveMaximum, massScale: scaleMaximum, scaleExponent: 254, deltaBits: 1 },
    { name: 'zero-total', total: 0n },
    { name: 'zero-scale', massScale: 0n },
    { name: 'negative-scale', massScale: -1n },
    { name: 'too-wide-scale', massScale: 1n << BigInt((format.wordCount + 4) * 32) },
    { name: 'scale-exponent-too-small', scaleExponent: -299 },
    { name: 'scale-exponent-too-large', scaleExponent: 255 },
    { name: 'negative-source-kinetic', kinetic: -1n },
    { name: 'inconsistent-momentum', px: 1n << 150n },
    { name: 'discarded-momentum-bit', px: 1n },
    { name: 'discarded-momentum-bit149', py: 1n << 149n },
    { name: 'negative-discarded-momentum', pz: -(1n << 149n) },
    { name: 'invalid-extensive-sign', sensible: { value: 1n, negative: 2 } },
    { name: 'invalid-scale-sign', massScale: { value: 1n, negative: 2 } },
    { name: 'input-error-union', kinetic: { value: 0n, error: E.OVERFLOW },
      massScale: { value: 1n, error: E.INVALID_FLOAT } },
    { name: 'raw-add-full-carry', op: 1, rawA: wideMaximum - 1n, rawB: 1n },
    { name: 'raw-add-overflow', op: 1, rawA: wideMaximum, rawB: 1n },
    { name: 'raw-cancellation', op: 1, rawA: wideMaximum, rawB: -wideMaximum },
    { name: 'raw-borrow-fullwidth', op: 2, rawA: wideMaximum, rawB: wideMaximum - 1n },
    { name: 'raw-negative-difference', op: 2, rawA: 1n, rawB: wideMaximum },
    { name: 'raw-fullwidth-multiply-one', op: 3, rawA: wideMaximum, rawB: 1n },
    { name: 'raw-fullwidth-multiply-overflow', op: 3, rawA: wideMaximum, rawB: 2n },
    { name: 'raw-fullwidth-multiply-zero', op: 3, rawA: wideMaximum, rawB: 0n },
    { name: 'raw-product-last-carry-fits', op: 3, rawA: (1n << BigInt(16 * wordCount(format))) - 1n,
      rawB: (1n << BigInt(16 * wordCount(format))) + 1n },
    { name: 'raw-product-last-carry-overflows', op: 3, rawA: (1n << BigInt(16 * wordCount(format))) + 1n,
      rawB: (1n << BigInt(16 * wordCount(format))) + 1n },
    { name: 'raw-shift-word-boundary', op: 4, rawA: -0xffffffffn, shift: 33 },
    { name: 'raw-shift-last-bit', op: 4, rawA: -1n, shift: 32 * wordCount(format) - 1 },
    { name: 'raw-shift-overflow', op: 4, rawA: 1n, shift: 32 * wordCount(format) },
    { name: 'raw-zero-huge-shift', op: 4, rawA: 0n, shift: 0xffffffff },
    { name: 'trial-last-lowbit', op: 5, trial: 1n, rawA: 1n, shift: 104 },
    { name: 'trial-overflow', op: 5, trial: extensiveMaximum, rawA: wideMaximum, shift: 0 },
    { name: 'trial-negative-denominator', op: 5, trial: 1n, rawA: -1n },
    { name: 'trial-zero-denominator', op: 5, trial: 1n, rawA: 0n },
    { name: 'trial-malformed-shift', op: 5, trial: 1n, rawA: 1n, shift: 105 },
    { name: 'from-extensive-full-width', op: 6, sensible: -extensiveMaximum },
    { name: 'from-mass-full-width', op: 7, total: maximum },
    { name: 'compare-negative-and-zero', op: 8, rawA: -1n, rawB: 0n },
    { name: 'compare-negative-magnitudes', op: 8, rawA: -wideMaximum, rawB: -1n },
    { name: 'compare-signed-zero', op: 8, rawA: { value: 0n, negative: 1 }, rawB: 0n }
  ];
  for (const bits of [0x7f800000, 0xff800000, 0x7fc00000, 0xffffffff]) rows.push({ name: `invalid-delta-${bits}`, deltaBits: bits });
  let seed = 0x7a1234cb;
  const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0; };
  for (let i = 0; i < 24; i++) {
    const ma = BigInt(random() % 1000 + 1), mb = BigInt(random() % 1000 + 1);
    const velocities = () => Array.from({ length: 3 }, () => {
      const value = random(); return ((value & 0x80000000) | ((value & 0x7fffffff) % 0x7f800000)) >>> 0;
    });
    rows.push({ name: `independent-pair-${i}`, ...exactCaloricPairSource(format, ma, mb, velocities(), velocities()),
      sensible: BigInt(random()) << 250n, trial: BigInt(random()) << 245n,
      massScale: BigInt(random() || 1), scaleExponent: i % 2 ? -298 : 254,
      deltaBits: i % 3 ? 0x3f800001 : 0xbf800001 });
  }
  return rows;
}

function wordsOf(value, count) {
  if (value < 0n || value >= (1n << BigInt(count * 32))) throw new RangeError('Caloric fixture word range');
  const words = new Uint32Array(count);
  for (let i = 0; i < count; i++) { words[i] = Number(value & 0xffffffffn); value >>= 32n; }
  return words;
}
const units = words => [...words].reverse().reduce((value, word) => (value << 32n) | BigInt(word), 0n);

export async function runExactCaloricNative(device, format, { onProgress = null, cases: supplied = null, batchSize = 8 } = {}) {
  const rows = supplied ?? exactCaloricCases(format), n = format.wordCount, ew = n + 18, cw = wordCount(format);
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 64 || rows.length === 0) {
    throw new RangeError('Caloric native execution requires rows and a batch size in [1, 64]');
  }
  const es = ew + 2, cs = cw + 2, inputStride = 4 + n + 6 * es + 3 * cs, outputStride = 4 * cs + 3;
  const inputs = new Uint32Array(rows.length * inputStride), expected = rows.map(row => referenceExactCaloric(format, row));
  rows.forEach((row, i) => {
    let offset = i * inputStride;
    inputs.set([row.op ?? 0, row.deltaBits ?? 0, row.scaleExponent ?? 0, row.shift ?? 0], offset); offset += 4;
    inputs.set(wordsOf(row.total ?? 1n, n), offset); offset += n;
    const write = (raw, count) => {
      const value = entry(raw); inputs.set(wordsOf(abs(value.value), count), offset);
      inputs.set([value.negative, value.error], offset + count); offset += count + 2;
    };
    for (const field of ['sensible', 'kinetic', 'px', 'py', 'pz', 'trial']) write(row[field], ew);
    write(row.massScale ?? 1n, cw); write(row.rawA, cw); write(row.rawB, cw);
  });
  const code = createSphExactMassWgsl(format) + createSphExactExtensiveWgsl(format) + createSphExactCaloricWgsl(format) + `
@group(0) @binding(0) var<storage, read> cn_input: array<u32>;
@group(0) @binding(1) var<storage, read_write> cn_output: array<u32>;
@group(0) @binding(2) var<uniform> cn_parameters: vec4<u32>;
fn cn_read_extensive(offset: u32) -> ExactExtensive {
  var value: ExactExtensive;
  for (var i = 0u; i < EE_WORDS; i++) { value.words[i] = cn_input[offset + i]; }
  value.negative = cn_input[offset + EE_WORDS]; value.error = cn_input[offset + EE_WORDS + 1u]; return value;
}
fn cn_read_caloric(offset: u32) -> ExactCaloric {
  var value: ExactCaloric;
  for (var i = 0u; i < EC_WORDS; i++) { value.words[i] = cn_input[offset + i]; }
  value.negative = cn_input[offset + EC_WORDS]; value.error = cn_input[offset + EC_WORDS + 1u]; return value;
}
fn cn_store(offset: u32, value: ExactCaloric) {
  for (var i = 0u; i < EC_WORDS; i++) { cn_output[offset + i] = value.words[i]; }
  cn_output[offset + EC_WORDS] = value.negative; cn_output[offset + EC_WORDS + 1u] = value.error;
}
@compute @workgroup_size(1)
fn exercise_caloric(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= cn_parameters.y) { return; }
  let row = cn_parameters.x + id.x;
  let base = row * ${inputStride}u; let out = row * ${outputStride}u;
  let op = cn_input[base]; let ext = base + 4u + EM_WORDS; let wide = ext + 6u * (EE_WORDS + 2u);
  var mass: ExactMass;
  for (var i = 0u; i < EM_WORDS; i++) { mass.words[i] = cn_input[base + 4u + i]; }
  let sensible = cn_read_extensive(ext); let trial_sensible = cn_read_extensive(ext + 5u * (EE_WORDS + 2u));
  let a = cn_read_caloric(wide + EC_WORDS + 2u); let b = cn_read_caloric(wide + 2u * (EC_WORDS + 2u));
  var caloric: ExactCaloricTarget; var trial: ExactCaloric; var residual: ExactCaloric; var comparison = 0i;
  if (op == 0u) {
    caloric = ec_target(mass, sensible, cn_read_extensive(ext + EE_WORDS + 2u),
      cn_read_extensive(ext + 2u * (EE_WORDS + 2u)), cn_read_extensive(ext + 3u * (EE_WORDS + 2u)),
      cn_read_extensive(ext + 4u * (EE_WORDS + 2u)), cn_read_caloric(wide), bitcast<i32>(cn_input[base + 2u]), cn_input[base + 1u]);
    if (caloric.error != 0u) { trial = ec_failure(caloric.error); residual = ec_failure(caloric.error); }
    else {
      trial = ec_scaled_trial(trial_sensible, caloric.denominator, caloric.fractional_shift);
      residual = ec_subtract(caloric.numerator, trial);
      if (trial.error == 0u) { comparison = ec_compare(caloric.numerator, trial); }
    }
  } else {
    if (op == 1u) { caloric.numerator = ec_add(a, b); }
    if (op == 2u) { caloric.numerator = ec_subtract(a, b); }
    if (op == 3u) { caloric.numerator = ec_multiply(a, b); }
    if (op == 4u) { caloric.numerator = ec_shift_left(a, cn_input[base + 3u]); }
    if (op == 5u) { caloric.numerator = ec_scaled_trial(trial_sensible, a, cn_input[base + 3u]); }
    if (op == 6u) { caloric.numerator = ec_from_extensive(sensible); }
    if (op == 7u) { caloric.numerator = ec_from_mass(mass); }
    if (op == 8u) {
      caloric.numerator = ec_failure(ec_input_error(a) | ec_input_error(b));
      if (caloric.numerator.error == 0u) { comparison = ec_compare(a, b); }
    }
  }
  cn_store(out, caloric.numerator); cn_store(out + EC_WORDS + 2u, caloric.denominator);
  cn_store(out + 2u * (EC_WORDS + 2u), trial); cn_store(out + 3u * (EC_WORDS + 2u), residual);
  cn_output[out + 4u * (EC_WORDS + 2u)] = caloric.fractional_shift;
  cn_output[out + 4u * (EC_WORDS + 2u) + 1u] = caloric.error | caloric.numerator.error | trial.error | residual.error;
  cn_output[out + 4u * (EC_WORDS + 2u) + 2u] = bitcast<u32>(comparison);
}`;
  const owned = []; let submitted = false, mapped = null;
  const progress = (phase, extra = {}) => { try { const observed = onProgress?.({ phase, wordCount: n, caseCount: rows.length, ...extra });
    if (observed?.then) void Promise.resolve(observed).catch(() => {}); } catch {} };
  const allocate = (label, size, usage) => { const buffer = device.createBuffer({ label, size, usage }); owned.push(buffer); return buffer; };
  try {
    progress('compiling'); const module = device.createShaderModule({ code });
    const errors = (await module.getCompilationInfo()).messages.filter(item => item.type === 'error');
    if (errors.length) throw new Error(errors.map(item => `${item.lineNum}: ${item.message}`).join('\n'));
    const pipeline = await device.createComputePipelineAsync({ layout: 'auto', compute: { module, entryPoint: 'exercise_caloric' } });
    progress('pipeline-ready');
    const source = allocate('caloric-native-source', inputs.byteLength, 128 | 4 | 8);
    const output = allocate('caloric-native-output', rows.length * outputStride * 4, 128 | 4);
    const readback = allocate('caloric-native-readback', source.size + output.size, 1 | 8);
    const batchCount = Math.ceil(rows.length / batchSize);
    const parameterStride = Math.max(256, device.limits?.minUniformBufferOffsetAlignment ?? 256);
    const parameters = allocate('caloric-native-batches', batchCount * parameterStride, 64 | 8);
    const parameterWords = new Uint32Array(batchCount * parameterStride / 4);
    for (let batch = 0; batch < batchCount; batch++) {
      parameterWords.set([batch * batchSize, Math.min(batchSize, rows.length - batch * batchSize)], batch * parameterStride / 4);
    }
    device.queue.writeBuffer(source, 0, inputs);
    device.queue.writeBuffer(parameters, 0, parameterWords);
    for (let batch = 0; batch < batchCount; batch++) {
      const group = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [
        ...[source, output].map((buffer, binding) => ({ binding, resource: { buffer } })),
        { binding: 2, resource: { buffer: parameters, offset: batch * parameterStride, size: 16 } }
      ] });
      const encoder = device.createCommandEncoder(), pass = encoder.beginComputePass();
      pass.setPipeline(pipeline); pass.setBindGroup(0, group);
      pass.dispatchWorkgroups(Math.min(batchSize, rows.length - batch * batchSize)); pass.end();
      const command = encoder.finish(); submitted = true; device.queue.submit([command]);
      progress('batch-submitted', { batch, batchCount });
      await device.queue.onSubmittedWorkDone();
      progress('batch-complete', { batch, batchCount });
    }
    const encoder = device.createCommandEncoder();
    encoder.copyBufferToBuffer(output, 0, readback, 0, output.size); encoder.copyBufferToBuffer(source, 0, readback, output.size, source.size);
    const command = encoder.finish(); submitted = true; device.queue.submit([command]); progress('submitted');
    await readback.mapAsync(1); mapped = readback; progress('mapped');
    const words = new Uint32Array(readback.getMappedRange()).slice(); readback.unmap(); mapped = null;
    const results = rows.map((row, index) => {
      const base = index * outputStride;
      const decode = field => {
        const offset = base + field * cs;
        return { magnitude: String(units(words.subarray(offset, offset + cw))), negative: words[offset + cw], error: words[offset + cw + 1] };
      };
      const actual = { numerator: decode(0), denominator: decode(1), trial: decode(2), residual: decode(3),
        fractionalShift: words[base + 4 * cs], error: words[base + 4 * cs + 1], comparison: words[base + 4 * cs + 2] | 0 };
      const reference = expected[index];
      const encode = field => ({ magnitude: String(abs(reference[field].value)), negative: reference[field].negative, error: reference[field].error });
      const wanted = { numerator: encode('numerator'), denominator: encode('denominator'), trial: encode('trial'), residual: encode('residual'),
        fractionalShift: reference.fractionalShift, error: reference.error, comparison: reference.comparison };
      return { name: row.name, ...actual, expected: wanted, matches: JSON.stringify(actual) === JSON.stringify(wanted) };
    });
    const sourceUnchanged = inputs.every((word, index) => words[output.size / 4 + index] === word); progress('checked');
    return { wordCount: n, quantumExponent: format.quantumExponent, caloricWords: cw, caseCount: rows.length, batchSize,
      sourceUnchanged, physicalPublicationAdmitted: false, pass: sourceUnchanged && results.every(row => row.matches), cases: results };
  } finally {
    if (mapped) mapped.unmap();
    const cleanup = () => { const errors = []; for (const buffer of owned) try { buffer.destroy(); } catch (error) { errors.push(error); }
      if (errors.length) throw new AggregateError(errors, 'Caloric native cleanup failed'); };
    if (submitted) await deferConfirmedSubmittedWorkCleanup(device, cleanup); else cleanup();
  }
}
