import assert from 'node:assert/strict';
import test from 'node:test';
import { writeFile } from 'node:fs/promises';
import { createSphExactMassFormat, SPH_EXACT_MASS_ERROR as E } from '../ulg-gpu-abi/src/sphExactMassInventory.js';
import {
  encodeSphExactSignedUnits, decodeSphExactSignedUnits, sphExactUnitsFromF32Bits, projectSphExactSignedF32Bits
} from '../ulg-gpu-abi/src/sphExactSignedLedger.js';
import {
  createSphExactLedgerProbeFixture, verifySphExactLedgerProbeEvidence
} from './fixtures/sphExactLedgerProbeNative.js';

const enabled = process.env.ULG_RUN_NATIVE_EXACT_LEDGER === '1';
const baseUrl = process.env.ULG_EXACT_LEDGER_BASE_URL || 'https://127.0.0.1:5173/';
const evidencePath = process.env.ULG_EXACT_LEDGER_EVIDENCE || null;
const steps = Number(process.env.ULG_EXACT_LEDGER_STEPS || 1000);

// Signed arithmetic cases, expected with BigInt. The arithmetic is integer,
// so a host reference of the primitives is exact, not a physics mirror.
function arithmeticCases(format) {
  const bits = BigInt(format.wordCount * 32), max = (1n << (bits - 1n)) - 1n, min = -(1n << (bits - 1n));
  let seed = 0x1f83d9ab;
  const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0; };
  const wide = () => {
    let value = 0n;
    for (let i = 0; i < format.wordCount; i++) value = (value << 32n) | BigInt(random());
    return (value & ((1n << bits) - 1n)) - (1n << (bits - 1n));
  };
  const rows = [[0n, 0n], [1n, -1n], [-1n, -1n], [max, 1n], [min, -1n], [max, -max], [min, 1n],
    [-(1n << 200n), (1n << 200n) - 1n], [(1n << 31n) - 1n, 1n], [-(1n << 32n), 1n]];
  for (let i = 0; i < 96; i++) rows.push([wide(), wide()]);
  for (let i = 0; i < 32; i++) rows.push([wide() >> BigInt(random() % 280), wide() >> BigInt(random() % 280)]);
  const floats = [0, 0x80000000, 1, 0x80000001, 0x007fffff, 0x00800000, 0x3f800000, 0xbf800000, 0x7f7fffff,
    0xff7fffff, 0x7f800000, 0xff800000, 0x7fc00000];
  for (let i = 0; i < 96; i++) floats.push(random());
  return { rows, floats, min, max };
}

test('native signed ledger arithmetic and the Phase 0 probe conserve exactly', {
  skip: !enabled && 'set ULG_RUN_NATIVE_EXACT_LEDGER=1 for owned desktop WebGPU', timeout: 600_000
}, async () => {
  const format = createSphExactMassFormat();
  const cases = arithmeticCases(format);
  const W = format.wordCount;
  const encodedRows = new Uint32Array(cases.rows.length * 2 * W);
  cases.rows.forEach(([a, b], i) => {
    encodedRows.set(encodeSphExactSignedUnits(a, format), 2 * i * W);
    encodedRows.set(encodeSphExactSignedUnits(b, format), (2 * i + 1) * W);
  });
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ executablePath: process.env.ULG_EXACT_LEDGER_CHROME || '/usr/bin/google-chrome',
    headless: false, args: ['--ozone-platform=wayland', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-webgpu-developer-features'] });
  let result;
  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(String(error)));
    await page.goto(new URL('package.json', baseUrl).href, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    result = await page.evaluate(async ({ rows, floats, steps }) => {
      const probe = await import('/tests/fixtures/sphExactLedgerProbeNative.js');
      const mass = probe, ledger = probe, abi = probe;
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
      const features = adapter.features.has('timestamp-query') ? ['timestamp-query'] : [];
      const device = await adapter.requestDevice({ requiredFeatures: features });
      const format = abi.createSphExactMassFormat();
      const W = format.wordCount, count = rows.length / (2 * W), stride = 4 * W + 8;
      const code = mass.createSphExactMassWgsl(format) + ledger.createSphExactLedgerWgsl(format)
        + ledger.createSphExactLedgerScatterWgsl(format, { prefix: 'acc', counters: 'counters' }) + `
@group(0) @binding(0) var<storage, read> input: array<u32>;
@group(0) @binding(1) var<storage, read> floats: array<u32>;
@group(0) @binding(2) var<storage, read_write> output: array<u32>;
@group(0) @binding(3) var<storage, read_write> counters: array<atomic<u32>>;
fn load(index: u32) -> ExactMass {
  var v: ExactMass;
  for (var i = 0u; i < EM_WORDS; i++) { v.words[i] = input[index * EM_WORDS + i]; }
  return v;
}
@compute @workgroup_size(64)
fn arithmetic(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= ${count}u) { return; }
  let a = load(2u * id.x); let b = load(2u * id.x + 1u); let out = id.x * ${stride}u;
  let sum = el_add(a, b); let difference = el_subtract(a, b);
  let projection = el_project_f32_bits(a);
  for (var i = 0u; i < EM_WORDS; i++) {
    output[out + i] = sum.value.words[i]; output[out + EM_WORDS + i] = difference.value.words[i];
  }
  output[out + 4u * EM_WORDS] = sum.error; output[out + 4u * EM_WORDS + 1u] = difference.error;
  output[out + 4u * EM_WORDS + 2u] = bitcast<u32>(el_compare(a, b));
  output[out + 4u * EM_WORDS + 3u] = projection.bits; output[out + 4u * EM_WORDS + 4u] = projection.error;
  // Scatter a, -b and every probe float into this row's counters, in two
  // orders across rows, then drain in the next pass.
  output[out + 4u * EM_WORDS + 5u] = acc_scatter_value(id.x, a) | acc_scatter_value(id.x, el_negate(b));
}
@compute @workgroup_size(64)
fn floats_in(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= ${floats.length}u) { return; }
  let converted = el_from_f32_bits(floats[id.x]);
  let out = ${count * stride}u + id.x * (EM_WORDS + 1u);
  for (var i = 0u; i < EM_WORDS; i++) { output[out + i] = converted.value.words[i]; }
  output[out + EM_WORDS] = converted.error;
  // Every finite float also lands in row 0's counters by the fast path.
  if (converted.error == 0u) { acc_scatter_f32(${count}u, floats[id.x]); }
}
@compute @workgroup_size(64)
fn drain(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x > ${count}u) { return; }
  let total = acc_drain(id.x);
  let out = ${count * stride + floats.length * (W + 1)}u + id.x * (EM_WORDS + 1u);
  for (var i = 0u; i < EM_WORDS; i++) { output[out + i] = total.value.words[i]; }
  output[out + EM_WORDS] = total.error;
}`;
      const module = device.createShaderModule({ code });
      const info = await module.getCompilationInfo();
      const bad = info.messages.filter(m => m.type === 'error');
      if (bad.length) throw new Error(bad.map(m => `${m.lineNum}:${m.linePos} ${m.message}`).join('\n'));
      const make = entryPoint => device.createComputePipeline({ layout: 'auto', compute: { module, entryPoint } });
      const outputWords = count * stride + floats.length * (W + 1) + (count + 1) * (W + 1);
      const buffer = (data, usage) => {
        const value = device.createBuffer({ size: Math.max(16, data.byteLength), usage, mappedAtCreation: true });
        new Uint32Array(value.getMappedRange()).set(data); value.unmap(); return value;
      };
      const input = buffer(new Uint32Array(rows), GPUBufferUsage.STORAGE);
      const floatBuffer = buffer(new Uint32Array(floats), GPUBufferUsage.STORAGE);
      const output = device.createBuffer({ size: outputWords * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
      const counters = device.createBuffer({ size: (count + 1) * 4 * W * 4, usage: GPUBufferUsage.STORAGE });
      const read = device.createBuffer({ size: outputWords * 4, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
      const encoder = device.createCommandEncoder();
      for (const [entry, groups, bindings] of [['arithmetic', Math.ceil(count / 64), [0, 2, 3]],
        ['floats_in', Math.ceil(floats.length / 64), [1, 2, 3]], ['drain', Math.ceil((count + 1) / 64), [2, 3]]]) {
        const pipeline = make(entry);
        const resources = [input, floatBuffer, output, counters];
        const pass = encoder.beginComputePass();
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, device.createBindGroup({ layout: pipeline.getBindGroupLayout(0),
          entries: bindings.map(binding => ({ binding, resource: { buffer: resources[binding] } })) }));
        pass.dispatchWorkgroups(groups); pass.end();
      }
      encoder.copyBufferToBuffer(output, 0, read, 0, outputWords * 4);
      device.queue.submit([encoder.finish()]);
      await read.mapAsync(GPUMapMode.READ);
      const arithmetic = Array.from(new Uint32Array(read.getMappedRange()));
      read.unmap();
      const evidence = await probe.runSphExactLedgerProbe(device, { steps });
      device.destroy();
      return { arithmetic, evidence, count, stride };
    }, { rows: Array.from(encodedRows), floats: cases.floats, steps });
    assert.deepEqual(pageErrors, []);
  } finally {
    await browser.close();
  }

  // Arithmetic: every result against BigInt.
  const { arithmetic, count, stride } = result;
  const words = (offset) => Uint32Array.from(arithmetic.slice(offset, offset + W));
  const inRange = value => value >= cases.min && value <= cases.max;
  let drainedFast = 0n;
  cases.rows.forEach(([a, b], i) => {
    const out = i * stride;
    const sum = a + b, difference = a - b;
    assert.equal(arithmetic[out + 4 * W], inRange(sum) ? 0 : E.OVERFLOW, `add error ${i}`);
    if (inRange(sum)) assert.equal(decodeSphExactSignedUnits(words(out), format), sum, `add ${i}`);
    assert.equal(arithmetic[out + 4 * W + 1], inRange(difference) ? 0 : E.OVERFLOW, `subtract error ${i}`);
    if (inRange(difference)) assert.equal(decodeSphExactSignedUnits(words(out + W), format), difference, `subtract ${i}`);
    assert.equal(arithmetic[out + 4 * W + 2] | 0, a < b ? -1 : a > b ? 1 : 0, `compare ${i}`);
    const projection = projectSphExactSignedF32Bits(encodeSphExactSignedUnits(a, format), format);
    assert.equal(arithmetic[out + 4 * W + 3], projection.bits, `projection bits ${i}`);
    assert.equal(arithmetic[out + 4 * W + 4], projection.error, `projection error ${i}`);
  });
  const floatsBase = count * stride;
  cases.floats.forEach((bits, i) => {
    const out = floatsBase + i * (W + 1);
    const exponent = (bits >>> 23) & 255;
    if (exponent === 255) { assert.equal(arithmetic[out + W], E.INVALID_FLOAT, `float error ${i}`); return; }
    const units = sphExactUnitsFromF32Bits(bits, format);
    assert.equal(arithmetic[out + W], 0, `float error ${i}`);
    assert.equal(decodeSphExactSignedUnits(words(out), format), units, `float ${i} ${bits.toString(16)}`);
    drainedFast += units;
  });
  const drainBase = floatsBase + cases.floats.length * (W + 1);
  cases.rows.forEach(([a, b], i) => {
    const out = drainBase + i * (W + 1);
    // a and -b were scattered as magnitudes into positive and negative halves.
    // The minimum value has no magnitude, so its scatter must report it. A
    // half needing the sign bit, or a result outside the range, must flag.
    const scatterError = arithmetic[i * stride + 4 * W + 5];
    if (a === cases.min || b === cases.min) { assert.notEqual(scatterError, 0, `scatter must flag ${i}`); return; }
    assert.equal(scatterError, 0, `scatter error ${i}`);
    const values = [a, -b];
    const positive = values.filter(v => v > 0n).reduce((x, y) => x + y, 0n);
    const negative = values.filter(v => v < 0n).reduce((x, y) => x - y, 0n);
    const expected = a - b;
    if (positive <= cases.max && negative <= cases.max && inRange(expected)) {
      assert.equal(arithmetic[out + W], 0, `drain error ${i}`);
      assert.equal(decodeSphExactSignedUnits(words(out), format), expected, `drain ${i}`);
    } else assert.notEqual(arithmetic[out + W], 0, `drain must flag ${i}`);
  });
  const fastOut = drainBase + count * (W + 1);
  assert.equal(arithmetic[fastOut + W], 0, 'fast-path drain error');
  assert.equal(decodeSphExactSignedUnits(words(fastOut), format), drainedFast, 'fast-path drain');

  if (evidencePath) await writeFile(evidencePath, JSON.stringify({ evidence: result.evidence }, null, 2));
  const verification = verifySphExactLedgerProbeEvidence(result.evidence, createSphExactLedgerProbeFixture());
  if (evidencePath) await writeFile(evidencePath, JSON.stringify({ evidence: result.evidence, verification }, null, 2));
  assert.equal(verification.passed, true, JSON.stringify({ checks: verification.checks, exception: result.evidence.exception,
    gpuErrors: result.evidence.gpuErrors, control: result.evidence.control }));
});
