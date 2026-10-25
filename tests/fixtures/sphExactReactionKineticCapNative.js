import { createSphExactMassWgsl } from '../../src/runtime/sph/sphExactMassWgsl.js';
import { compileSphExactReactionAllocation, resolveSphExactReactionAllocation }
  from '../../src/runtime/sph/sphExactReactionAllocation.js';
import { encodeSphExactReactionKineticScale, createSphExactReactionKineticCapWgsl,
  selectSphExactReactionKineticCap } from '../../src/runtime/sph/sphExactReactionKineticCap.js';
import { encodeSphExactMassUnits, SPH_EXACT_MASS_ERROR as ERROR }
  from '../../ulg-gpu-abi/src/sphExactMassInventory.js';
import { deferConfirmedSubmittedWorkCleanup } from '../../src/runtime/webgpuComputeLayout.js';
import { createExactReactionAllocationFixture } from './sphExactReactionAllocationNative.js';

const units = words => [...words].reverse().reduce((value, word) => (value << 32n) | BigInt(word), 0n);

// Manufactured arithmetic coverage, not physical source or reaction authority.
export function exactReactionKineticCapCases(format, compiled) {
  resolveSphExactReactionAllocation(compiled, { format });
  const maximum = (1n << BigInt(32 * format.wordCount)) - 1n;
  const rows = [
    { name: 'zero-extent', extentBits: 0, available: maximum },
    { name: 'zero-inventory', extentBits: 0x3f800000, available: 0n },
    { name: 'minimum-subnormal', extentBits: 1, available: maximum },
    { name: 'largest-subnormal', extentBits: 0x7fffff, available: maximum },
    { name: 'minimum-normal', extentBits: 0x800000, available: maximum },
    { name: 'one-minus-ulp', extentBits: 0x3f7fffff, available: maximum },
    { name: 'one', extentBits: 0x3f800000, available: maximum },
    { name: 'one-plus-ulp', extentBits: 0x3f800001, available: maximum },
    { name: 'maximum-finite', extentBits: 0x7f7fffff, available: maximum },
    { name: 'clamp-to-one-unit', extentBits: 0x7f7fffff, available: 1n },
    { name: 'hidden-low-available', extentBits: 0x7f7fffff, available: (maximum >> 1n) | 1n },
    ...[0x80000000, 0xbf800000, 0x7f800000, 0xff800000, 0x7fc00000, 0x7fffffff]
      .map(extentBits => ({ name: `invalid-f32-${extentBits.toString(16)}`, extentBits, available: maximum }))
  ];
  let seed = 0x1367dfee;
  const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0; };
  for (let i = 0; i < 32; i++) {
    let available = 0n;
    for (let j = 0; j < format.wordCount; j++) available = (available << 32n) | BigInt(random());
    rows.push({ name: `original-scale-random-${i}`, extentBits: (random() & 0x7fffffff) % 0x7f800000, available });
  }
  // Additional raw numeric scale records exercise the entire intermediate
  // width independently of which authored coefficients the table admits.
  // They never pass through a physical producer or metadata authority seal.
  const raw = (coefficient, exponent) => {
    const words = new Uint32Array(format.wordCount + 8); words[0] = exponent;
    for (let i = 4; coefficient; i++) { words[i] = Number(coefficient & 0xffffffffn); coefficient >>= 32n; words[1]++; }
    return words;
  };
  const wide = (1n << BigInt((format.wordCount + 4) * 32)) - 1n;
  rows.push(
    { name: 'wide-product-clamp', extentBits: 0x3f800000, available: maximum, scaleWords: raw(wide, 0) },
    { name: 'wide-product-carry-floor', extentBits: 0x3f800001, available: maximum, scaleWords: raw(wide, -160) },
    { name: 'wide-product-halfway-floor', extentBits: 0x3fffffff, available: maximum, scaleWords: raw(wide, -161) },
    { name: 'exact-subquantum-zero', extentBits: 0x3f800000, available: maximum, scaleWords: raw(1n, -1) },
    { name: 'exact-one-unit', extentBits: 0x3f800000, available: maximum, scaleWords: raw(1n, 0) },
    { name: 'retained-low-coefficient', extentBits: 0x3f800000, available: maximum, scaleWords: raw((1n << 24n) + 1n, 0) }
  );
  const badReserved = encodeSphExactReactionKineticScale(compiled); badReserved[2] = 1;
  const badCount = encodeSphExactReactionKineticScale(compiled); badCount[1] = 0;
  const badPadding = raw(1n, 0); badPadding[5] = 1;
  for (const [name, scaleWords] of [['bad-reserved', badReserved], ['bad-count', badCount], ['bad-padding', badPadding]]) {
    rows.push({ name, extentBits: 0x3f800000, available: maximum, scaleWords, expectedError: ERROR.INVALID_RATIO });
  }
  return rows;
}

function expectedCap(compiled, row) {
  if ((row.extentBits & 0x80000000) !== 0 || row.extentBits >= 0x7f800000) {
    return { value: 0n, error: ERROR.INVALID_FLOAT };
  }
  if (row.expectedError) return { value: 0n, error: row.expectedError };
  if (!row.scaleWords) return { value: selectSphExactReactionKineticCap(compiled, row.extentBits, row.available), error: 0 };
  // Direct BigInt multiplication/division is independent of the GPU digit
  // product and bit-by-bit extraction. Raw scales are test numeric vectors.
  const encoded = (row.extentBits >>> 23) & 255;
  const mantissa = BigInt((row.extentBits & 0x7fffff) | (encoded ? 0x800000 : 0));
  const product = units(row.scaleWords.subarray(4)) * mantissa;
  const shift = (row.scaleWords[0] | 0) + (encoded ? encoded - 150 : -149);
  const value = shift >= 0 ? product * (1n << BigInt(shift)) : product / (1n << BigInt(-shift));
  return { value: value < row.available ? value : row.available, error: 0 };
}

/** Called only by the root's owned native harness. Run once for each format
 * width 1/9/66; optional original compiled token and vectors are supported. */
export async function runExactReactionKineticCapNative(device, format,
  { compiled = null, fixture = null, reactionIndex = 0, cases: suppliedCases = null } = {}) {
  if (!compiled) {
    fixture ??= createExactReactionAllocationFixture();
    compiled = compileSphExactReactionAllocation({ ...fixture, format, reactionIndex });
  }
  resolveSphExactReactionAllocation(compiled, { format });
  const cases = suppliedCases ?? exactReactionKineticCapCases(format, compiled);
  if (!Array.isArray(cases) || cases.length < 1) throw new TypeError('Nonempty kinetic-cap vectors required');
  const n = format.wordCount, inputStride = n + 2, outputStride = n + 1, scaleStride = n + 8;
  const input = new Uint32Array(cases.length * inputStride);
  // Nonzero word offset also exercises callers embedding scale records.
  const metadata = new Uint32Array(3 + cases.length * scaleStride), originalScale = encodeSphExactReactionKineticScale(compiled);
  const expected = cases.map(row => {
    if (!Number.isInteger(row.extentBits) || row.extentBits < 0 || row.extentBits > 0xffffffff) throw new RangeError('Invalid extent bits');
    encodeSphExactMassUnits(row.available, format);
    if (row.scaleWords && (!(row.scaleWords instanceof Uint32Array) || row.scaleWords.length !== scaleStride)) {
      throw new TypeError('Complete test scale record required');
    }
    return expectedCap(compiled, row);
  });
  cases.forEach((row, i) => {
    input.set([row.extentBits, 3 + i * scaleStride], i * inputStride);
    input.set(encodeSphExactMassUnits(row.available, format), i * inputStride + 2);
    metadata.set(row.scaleWords ?? originalScale, 3 + i * scaleStride);
  });
  const code = createSphExactMassWgsl(format) + createSphExactReactionKineticCapWgsl(format) + `
@group(0) @binding(0) var<storage, read> ek_inputs: array<u32>;
@group(0) @binding(1) var<storage, read> ek_scales: array<u32>;
@group(0) @binding(2) var<storage, read_write> ek_outputs: array<u32>;
fn ek_scale_word(index: u32) -> u32 { return ek_scales[index]; }
@compute @workgroup_size(1)
fn exercise_kinetic_cap(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= ${cases.length}u) { return; }
  let input = id.x * ${inputStride}u; let output = id.x * ${outputStride}u;
  var available: ExactMass;
  for (var i = 0u; i < EM_WORDS; i++) { available.words[i] = ek_inputs[input + 2u + i]; }
  let cap = ek_cap_from_extent(ek_inputs[input], ek_inputs[input + 1u], available);
  ek_outputs[output] = cap.error;
  for (var i = 0u; i < EM_WORDS; i++) { ek_outputs[output + 1u + i] = cap.value.words[i]; }
}`;
  const owned = []; let mapped = null, submitted = false;
  const allocate = (label, size, usage) => { const buffer = device.createBuffer({ label, size, usage }); owned.push(buffer); return buffer; };
  try {
    const module = device.createShaderModule({ code });
    const errors = (await module.getCompilationInfo()).messages.filter(message => message.type === 'error');
    if (errors.length) throw new Error(errors.map(message => `${message.lineNum}: ${message.message}`).join('\n'));
    const pipeline = await device.createComputePipelineAsync({ layout: 'auto', compute: { module, entryPoint: 'exercise_kinetic_cap' } });
    const source = allocate('exact-kinetic-native-source', input.byteLength, 128 | 4 | 8);
    const scales = allocate('exact-kinetic-native-scale', metadata.byteLength, 128 | 4 | 8);
    const output = allocate('exact-kinetic-native-output', cases.length * outputStride * 4, 128 | 4);
    const readback = allocate('exact-kinetic-native-readback', output.size + source.size + scales.size, 1 | 8);
    device.queue.writeBuffer(source, 0, input); device.queue.writeBuffer(scales, 0, metadata);
    const group = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries:
      [source, scales, output].map((buffer, binding) => ({ binding, resource: { buffer } })) });
    const encoder = device.createCommandEncoder(), pass = encoder.beginComputePass();
    pass.setPipeline(pipeline); pass.setBindGroup(0, group); pass.dispatchWorkgroups(cases.length); pass.end();
    encoder.copyBufferToBuffer(output, 0, readback, 0, output.size);
    encoder.copyBufferToBuffer(source, 0, readback, output.size, source.size);
    encoder.copyBufferToBuffer(scales, 0, readback, output.size + source.size, scales.size);
    submitted = true; device.queue.submit([encoder.finish()]);
    await readback.mapAsync(1); mapped = readback;
    const words = new Uint32Array(readback.getMappedRange()).slice(); readback.unmap(); mapped = null;
    const results = cases.map((row, i) => {
      const actualWords = words.subarray(i * outputStride + 1, (i + 1) * outputStride);
      const error = words[i * outputStride], value = units(actualWords);
      return { name: row.name, extentBits: row.extentBits, available: String(row.available),
        manufacturedScale: Boolean(row.scaleWords), error, value: String(value), words: Array.from(actualWords),
        expected: { value: String(expected[i].value), error: expected[i].error },
        matches: value === expected[i].value && error === expected[i].error };
    });
    return { wordCount: n, quantumExponent: format.quantumExponent, outputStride,
      physicalPublicationAdmitted: false,
      sourceUnchanged: input.every((word, index) => words[output.size / 4 + index] === word),
      metadataUnchanged: metadata.every((word, index) => words[(output.size + source.size) / 4 + index] === word),
      pass: results.every(row => row.matches), cases: results };
  } finally {
    if (mapped) mapped.unmap();
    const cleanup = () => { for (const buffer of owned) buffer.destroy(); };
    if (submitted) await deferConfirmedSubmittedWorkCleanup(device, cleanup); else cleanup();
  }
}
