import { createSphExactMassWgsl } from '../../src/runtime/sph/sphExactMassWgsl.js';
import { createSphExactExtensiveWgsl } from '../../src/runtime/sph/sphExactExtensiveWgsl.js';
import { createSphExactCaloricWgsl } from '../../src/runtime/sph/sphExactCaloricWgsl.js';
import { createSphExactProductEnergyWgsl } from '../../src/runtime/sph/sphExactProductEnergyWgsl.js';
import { validateSphExactMassFormat, SPH_EXACT_MASS_ERROR as E } from '../../ulg-gpu-abi/src/sphExactMassInventory.js';
import { deferConfirmedSubmittedWorkCleanup } from '../../src/runtime/webgpuComputeLayout.js';
import { referenceExactExtensiveProduct, referenceExactExtensiveRatio } from './sphExactExtensiveNative.js';

const abs = n => n < 0n ? -n : n;
const entry = (n = 0n) => typeof n === 'bigint' ? { value: n, negative: Number(n < 0n), error: 0 }
  : { value: n.value ?? 0n, negative: n.negative ?? Number((n.value ?? 0n) < 0n), error: n.error ?? 0 };
const signed = n => n.negative ? -abs(n.value) : abs(n.value);
const inputError = n => n.error | (n.negative > 1 || (n.negative !== 0 && n.value === 0n) ? E.INVALID_RATIO : 0);
const failure = error => ({ value: 0n, negative: 0, error });
const failed = error => ({ correction: failure(error), residual: failure(error), total: failure(error), error });
const defaultDenominator = row => (row.total ?? 1n) * signed(entry(row.massScale ?? 1n));
const width = format => 3 * format.wordCount + 26;

/** Direct BigInt oracle. The final total independently eliminates Khat:
 * U*D + |P/2^150|^2*Dk, in the shifted quantum, plus chosen residual. */
export function referenceExactProductEnergy(format, row) {
  validateSphExactMassFormat(format);
  const c = row.total ?? 1n, ps = ['px', 'py', 'pz'].map(key => entry(row[key]));
  const k = entry(row.projectedKE), u = entry(row.productInternal), scale = entry(row.massScale ?? 1n);
  const den = entry(row.denominator ?? defaultDenominator(row)), chosen = entry(row.chosenResidual);
  const t = row.fractionalShift ?? 0, limit = 1n << BigInt(32 * width(format));
  let error = [...ps, k, u, scale, den, chosen].reduce((bits, value) => bits | inputError(value), 0);
  if (c === 0n) error |= E.DIVISION_BY_ZERO;
  if (scale.negative || scale.value === 0n || abs(scale.value) >= (1n << BigInt(32 * (format.wordCount + 4)))
    || den.negative || den.value === 0n || t > 104 || k.negative) error |= E.INVALID_RATIO;
  if (ps.some(p => (abs(p.value) & ((1n << 150n) - 1n)) !== 0n)) error |= E.INEXACT_INPUT;
  if (error) return failed(error);
  if (signed(den) !== c * signed(scale)) return failed(E.INVALID_RATIO);
  const squares = ps.reduce((sum, p) => sum + (signed(p) / (1n << 150n)) ** 2n, 0n);
  const difference = squares - c * signed(k);
  const correction = (difference * signed(scale)) << BigInt(t);
  const residual = signed(chosen) + correction;
  const represented = ((signed(u) + signed(k)) * signed(den)) << BigInt(t);
  const total = ((signed(u) * signed(den) + squares * signed(scale)) << BigInt(t)) + signed(chosen);
  if ([squares, difference, correction, residual, represented, total].some(v => abs(v) >= limit)) return failed(E.OVERFLOW);
  return { correction: entry(correction), residual: entry(residual), total: entry(total), error: 0 };
}

export function exactProductEnergyProjectedPair(format, massA, massB, velocityA, velocityB) {
  const total = massA + massB, momentum = [], projectedBits = [];
  let projectedKE = 0n;
  for (let axis = 0; axis < 3; axis++) {
    const p = referenceExactExtensiveProduct(format, massA, velocityA[axis]).value
      + referenceExactExtensiveProduct(format, massB, velocityB[axis]).value;
    const projected = referenceExactExtensiveRatio(entry(p), total);
    if (projected.error & ~E.PROJECTION_UNDERFLOW) throw new RangeError('Invalid manufactured COM projection');
    momentum.push(p); projectedBits.push(projected.bits);
    projectedKE += referenceExactExtensiveProduct(format, total, projected.bits, projected.bits, true).value;
  }
  return { total, px: momentum[0], py: momentum[1], pz: momentum[2], projectedKE, projectedBits };
}

export function exactProductEnergyCases(format) {
  validateSphExactMassFormat(format);
  const maximum = (1n << BigInt(format.wordCount * 32)) - 1n;
  const wideMaximum = (1n << BigInt(width(format) * 32)) - 1n;
  const extensiveMaximum = (1n << BigInt((format.wordCount + 18) * 32)) - 1n;
  const scaleMaximum = (1n << BigInt((format.wordCount + 4) * 32)) - 1n;
  const halfA = maximum / 3n, halfB = maximum - halfA;
  const rows = [
    { name: 'canonical-zero' },
    { name: 'minimum-positive-correction', total: 3n, px: 1n << 150n },
    { name: 'minimum-negative-correction', total: 3n, px: 2n << 150n, projectedKE: 3n },
    { name: 'correction-cancels-chosen-residual', total: 3n, px: 2n << 150n, projectedKE: 3n, chosenResidual: 5n },
    { name: 'positive-last-bit-after-cancellation', total: 3n, px: 2n << 150n, projectedKE: 3n, chosenResidual: 6n },
    { name: 'negative-last-bit-after-cancellation', total: 3n, px: 2n << 150n, projectedKE: 3n, chosenResidual: 4n },
    { name: 'negative-internal-total-cancellation', productInternal: -1n, chosenResidual: 1n },
    { name: 'fractional-shift-104', total: 3n, px: 1n << 150n, massScale: scaleMaximum, fractionalShift: 104 },
    { name: 'three-axis-signed-momentum', total: 7n, px: 1n << 150n, py: -(2n << 150n), pz: 3n << 150n,
      projectedKE: 4n, productInternal: -9n, massScale: 11n, chosenResidual: 3n, fractionalShift: 7 },
    { name: 'full-mass-unchanged-COM', ...exactProductEnergyProjectedPair(format, halfA, halfB,
      [0x7f7fffff, 0x80000001, 0x3f800001], [0x7f7fffff, 0x80000001, 0x3f800001]), productInternal: -maximum },
    { name: 'full-mass-near-COM', ...exactProductEnergyProjectedPair(format, halfA, halfB,
      [0x7f7fffff, 0xff7ffffe, 0x007fffff], [0x7f7ffffe, 0xff7fffff, 0x00800000]), massScale: scaleMaximum, fractionalShift: 104 },
    { name: 'subnormal-COM-rounds-zero', ...exactProductEnergyProjectedPair(format, 1n, 2n, [1, 0x80000001, 0], [0, 0, 0]) },
    { name: 'subnormal-COM-rounds-away', ...exactProductEnergyProjectedPair(format, 2n, 1n, [1, 0x80000001, 0], [0, 0, 0]) },
    { name: 'wide-U-plus-K-exceeds-EE', total: maximum, projectedKE: extensiveMaximum, productInternal: extensiveMaximum,
      massScale: scaleMaximum, fractionalShift: 104 },
    { name: 'zero-C', total: 0n, denominator: 1n },
    { name: 'zero-scale', massScale: 0n, denominator: 1n },
    { name: 'negative-scale', massScale: -1n, denominator: 1n },
    { name: 'overwide-scale', massScale: scaleMaximum + 1n },
    { name: 'zero-denominator', denominator: 0n },
    { name: 'negative-denominator', denominator: -1n },
    { name: 'wrong-denominator-low-bit', total: maximum, massScale: scaleMaximum,
      denominator: maximum * scaleMaximum - 1n },
    { name: 'shift-105', fractionalShift: 105 },
    { name: 'shift-u32-max', fractionalShift: 0xffffffff },
    { name: 'negative-projected-KE', projectedKE: -1n },
    { name: 'negative-zero-projected-KE', projectedKE: { value: 0n, negative: 1 } },
    { name: 'negative-zero-momentum', px: { value: 0n, negative: 1 } },
    { name: 'negative-zero-internal', productInternal: { value: 0n, negative: 1 } },
    { name: 'negative-zero-residual', chosenResidual: { value: 0n, negative: 1 } },
    { name: 'malformed-extensive-sign', py: { value: 1n << 150n, negative: 2 } },
    { name: 'malformed-caloric-sign', chosenResidual: { value: 1n, negative: 2 } },
    { name: 'inexact-positive-momentum', px: 1n },
    { name: 'inexact-negative-momentum', pz: -(1n << 149n) },
    { name: 'propagated-finite-input-error', px: { value: 0n, error: E.INVALID_FLOAT } },
    { name: 'propagated-error-union', productInternal: { value: 0n, error: E.OVERFLOW },
      chosenResidual: { value: 0n, error: E.INVALID_FLOAT } },
    { name: 'correction-overflow', px: extensiveMaximum & ~((1n << 150n) - 1n),
      massScale: scaleMaximum, fractionalShift: 104 },
    { name: 'residual-overflow', px: 1n << 150n, chosenResidual: wideMaximum },
    { name: 'total-overflow', productInternal: 1n, chosenResidual: wideMaximum },
    { name: 'negative-total-overflow', productInternal: -1n, chosenResidual: -wideMaximum },
    { name: 'full-residual-retained', chosenResidual: -wideMaximum },
    { name: 'total-cancels-exactly', productInternal: -1n, projectedKE: 3n, px: 1n << 150n }
  ];
  let seed = 0x65b381e9;
  const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0; };
  for (let i = 0; i < 24; i++) {
    const velocities = () => Array.from({ length: 3 }, () => { const value = random();
      return ((value & 0x80000000) | ((value & 0x7fffffff) % 0x7f800000)) >>> 0; });
    rows.push({ name: `independent-projected-pair-${i}`,
      ...exactProductEnergyProjectedPair(format, BigInt(random() % 1000 + 1), BigInt(random() % 1000 + 1), velocities(), velocities()),
      massScale: BigInt(random() || 1), fractionalShift: i % 2 ? 104 : 0,
      productInternal: BigInt(random()) * (i % 2 ? -1n : 1n), chosenResidual: BigInt(random()) - (1n << 31n) });
  }
  return rows;
}

function wordsOf(value, count) {
  if (value < 0n || value >= (1n << BigInt(32 * count))) throw new RangeError('Product-energy fixture range');
  const words = new Uint32Array(count);
  for (let i = 0; i < count; i++) { words[i] = Number(value & 0xffffffffn); value >>= 32n; }
  return words;
}
const units = words => [...words].reverse().reduce((n, word) => (n << 32n) | BigInt(word), 0n);

export async function runExactProductEnergyNative(device, format, { onProgress = null, batchSize = 8, cases: supplied = null } = {}) {
  const rows = supplied ?? exactProductEnergyCases(format), n = format.wordCount, ew = n + 18, cw = width(format);
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 64 || !rows.length) throw new RangeError('Product-energy native batch');
  const es = ew + 2, cs = cw + 2, inputStride = 4 + n + 5 * es + 3 * cs, outputStride = 3 * cs + 1;
  const inputs = new Uint32Array(rows.length * inputStride), expected = rows.map(row => referenceExactProductEnergy(format, row));
  rows.forEach((row, index) => {
    let at = index * inputStride; inputs[at] = row.fractionalShift ?? 0; at += 4;
    inputs.set(wordsOf(row.total ?? 1n, n), at); at += n;
    const write = (raw, count) => { const v = entry(raw); inputs.set(wordsOf(abs(v.value), count), at);
      inputs.set([v.negative, v.error], at + count); at += count + 2; };
    for (const field of ['px', 'py', 'pz', 'projectedKE', 'productInternal']) write(row[field], ew);
    write(row.massScale ?? 1n, cw); write(row.denominator ?? defaultDenominator(row), cw); write(row.chosenResidual, cw);
  });
  const code = createSphExactMassWgsl(format) + createSphExactExtensiveWgsl(format) + createSphExactCaloricWgsl(format)
    + createSphExactProductEnergyWgsl(format) + `
@group(0) @binding(0) var<storage, read> epn_input: array<u32>;
@group(0) @binding(1) var<storage, read_write> epn_output: array<u32>;
@group(0) @binding(2) var<uniform> epn_parameters: vec4<u32>;
fn epn_extensive(at: u32) -> ExactExtensive {
  var value: ExactExtensive;
  for (var i = 0u; i < EE_WORDS; i++) { value.words[i] = epn_input[at + i]; }
  value.negative = epn_input[at + EE_WORDS]; value.error = epn_input[at + EE_WORDS + 1u]; return value;
}
fn epn_caloric(at: u32) -> ExactCaloric {
  var value: ExactCaloric;
  for (var i = 0u; i < EC_WORDS; i++) { value.words[i] = epn_input[at + i]; }
  value.negative = epn_input[at + EC_WORDS]; value.error = epn_input[at + EC_WORDS + 1u]; return value;
}
fn epn_store(at: u32, value: ExactCaloric) {
  for (var i = 0u; i < EC_WORDS; i++) { epn_output[at + i] = value.words[i]; }
  epn_output[at + EC_WORDS] = value.negative; epn_output[at + EC_WORDS + 1u] = value.error;
}
@compute @workgroup_size(1)
fn exercise_product_energy(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= epn_parameters.y) { return; }
  let row = epn_parameters.x + id.x; let at = row * ${inputStride}u;
  let ee_at = at + 4u + EM_WORDS; let ec_at = ee_at + 5u * (EE_WORDS + 2u);
  var mass: ExactMass;
  for (var i = 0u; i < EM_WORDS; i++) { mass.words[i] = epn_input[at + 4u + i]; }
  let result = ep_energy(mass, epn_extensive(ee_at), epn_extensive(ee_at + EE_WORDS + 2u),
    epn_extensive(ee_at + 2u * (EE_WORDS + 2u)), epn_extensive(ee_at + 3u * (EE_WORDS + 2u)),
    epn_extensive(ee_at + 4u * (EE_WORDS + 2u)), epn_caloric(ec_at), epn_caloric(ec_at + EC_WORDS + 2u),
    epn_input[at], epn_caloric(ec_at + 2u * (EC_WORDS + 2u)));
  let out = row * ${outputStride}u;
  epn_store(out, result.correction); epn_store(out + EC_WORDS + 2u, result.residual);
  epn_store(out + 2u * (EC_WORDS + 2u), result.total); epn_output[out + 3u * (EC_WORDS + 2u)] = result.error;
}`;
  const owned = []; let submitted = false, mapped = null;
  const progress = (phase, extra = {}) => { try { const pending = onProgress?.({ phase, wordCount: n, caseCount: rows.length, ...extra });
    if (pending?.then) void Promise.resolve(pending).catch(() => {}); } catch {} };
  const allocate = (label, size, usage) => { const buffer = device.createBuffer({ label, size, usage }); owned.push(buffer); return buffer; };
  try {
    progress('compiling'); const module = device.createShaderModule({ code });
    const errors = (await module.getCompilationInfo()).messages.filter(item => item.type === 'error');
    if (errors.length) throw new Error(errors.map(item => `${item.lineNum}: ${item.message}`).join('\n'));
    const pipeline = await device.createComputePipelineAsync({ layout: 'auto', compute: { module, entryPoint: 'exercise_product_energy' } });
    progress('pipeline-ready');
    const source = allocate('product-energy-native-source', inputs.byteLength, 128 | 4 | 8);
    const output = allocate('product-energy-native-output', rows.length * outputStride * 4, 128 | 4);
    const readback = allocate('product-energy-native-readback', source.size + output.size, 1 | 8);
    const batches = Math.ceil(rows.length / batchSize), parameterStride = Math.max(256, device.limits?.minUniformBufferOffsetAlignment ?? 256);
    const parameters = allocate('product-energy-native-batches', batches * parameterStride, 64 | 8);
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
      const decode = field => { const at = index * outputStride + field * cs;
        return { magnitude: String(units(words.subarray(at, at + cw))), negative: words[at + cw], error: words[at + cw + 1] }; };
      const actual = { correction: decode(0), residual: decode(1), total: decode(2), error: words[index * outputStride + 3 * cs] };
      const reference = expected[index], encode = field => ({ magnitude: String(abs(reference[field].value)), negative: reference[field].negative, error: reference[field].error });
      const wanted = { correction: encode('correction'), residual: encode('residual'), total: encode('total'), error: reference.error };
      return { name: row.name, projectedBits: row.projectedBits ?? null, ...actual, expected: wanted, matches: JSON.stringify(actual) === JSON.stringify(wanted) };
    });
    const sourceUnchanged = inputs.every((word, index) => words[output.size / 4 + index] === word); progress('checked');
    return { wordCount: n, quantumExponent: format.quantumExponent, caloricWords: cw, batchSize, caseCount: rows.length,
      sourceUnchanged, physicalPublicationAdmitted: false, pass: sourceUnchanged && results.every(row => row.matches), cases: results };
  } finally {
    if (mapped) mapped.unmap();
    const cleanup = () => { const errors = []; for (const buffer of owned) try { buffer.destroy(); } catch (error) { errors.push(error); }
      if (errors.length) throw new AggregateError(errors, 'Product energy native cleanup failed'); };
    if (submitted) await deferConfirmedSubmittedWorkCleanup(device, cleanup); else cleanup();
  }
}
