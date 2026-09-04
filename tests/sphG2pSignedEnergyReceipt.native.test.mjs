import assert from 'node:assert/strict';
import test from 'node:test';

import {
  mlsMpmG2pReconstructCanonicalSpatialMechanicsFieldWgsl,
  mlsMpmG2pReconstructCanonicalSpatialSingleLevelMechanicsFieldWgsl
} from '../src/runtime/sph/sphMlsMpmGpuStep.js';
import {
  createSchroederSpatialMechanicsFieldViewLayout,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_MAGIC,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_VERSION,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_MAGIC,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_VERSION,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_RECEIPT_WORDS
} from '../ulg-gpu-abi/src/schroederSpatialMechanicsFieldView.js';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_G2P_SIGNED_ENERGY === '1';
const BASE_URL = process.env.ULG_G2P_SIGNED_ENERGY_BASE_URL
  || 'https://127.0.0.1:5173/';

// These are manufactured receipt-stage states, not a CPU dynamics solver or
// proof of the full G2P authority/deposition route. The device executes the
// unmodified exported measure/consume entry points. A sealed claimed receipt
// represents the upstream pressure-work publication and completed transpose.
// The measured delta remains diagnostic: matching published/consumed sums do
// not independently authenticate a tampered particle output (and tiny work may
// be unresolvable in a large stored f32 energy). The production deposition
// path, not this receipt-only fixture, owns construction of that output.
// Only a fixed 148-byte header/receipt record per case is read back.
const CASES = [
  { name: 'negative pressure work cools positive internal energy',
    mass: 2, prior: 100, next: 75, pressure: -50, expectedDelta: -50 },
  { name: 'positive pressure work heats internal energy',
    mass: 2, prior: 100, next: 125, pressure: 50, expectedDelta: 50 },
  { name: 'negative pressure work may reach exactly zero energy',
    mass: 2, prior: 25, next: 0, pressure: -50, expectedDelta: -50 },
  { name: 'zero energy and zero work are admitted',
    mass: 2, prior: 0, next: 0, pressure: 0, expectedDelta: 0 },
  { name: 'positive heat may be outweighed by negative pressure work',
    mass: 2, prior: 100, next: 75, heat: 10, pressure: -60,
    expectedDelta: -50 },
  { name: 'f32 sub-ulp pressure work preserves conditioned measurement',
    mass: 1, prior: 16777216, next: 16777216, pressure: -0.25,
    expectedDelta: 0 },
  { name: 'zero-mass tombstone preserves irrelevant finite energy lanes',
    mass: 0, prior: -100, next: -100, pressure: 0, expectedDelta: 0 },
  { name: 'negative resulting absolute energy is rejected',
    mass: 2, prior: 25, next: -25, pressure: -100, reject: true },
  { name: 'negative prior absolute energy is rejected',
    mass: 2, prior: -25, next: 25, pressure: 100, reject: true },
  { name: 'negative particle mass is rejected',
    mass: -2, prior: 100, next: 75, pressure: 50, reject: true },
  { name: 'nonfinite mass is rejected',
    mass: Infinity, prior: 100, next: 100, pressure: 0, reject: true },
  { name: 'nonfinite prior energy is rejected',
    mass: 2, prior: Infinity, next: 100, pressure: 0, reject: true },
  { name: 'nonfinite resulting energy is rejected',
    mass: 2, prior: 100, next: Infinity, pressure: 0, reject: true },
  { name: 'NaN resulting energy is rejected',
    mass: 2, prior: 100, next: NaN, pressure: 0, reject: true },
  { name: 'finite input product overflowing energy delta is rejected',
    mass: 3e38, prior: 100, next: 75, pressure: -50, reject: true },
  { name: 'forged consumed negative pressure accounting is rejected',
    mass: 2, prior: 100, next: 75, pressure: -50,
    consumedPressure: -25, reject: true },
  { name: 'forged consumed heat accounting is rejected',
    mass: 2, prior: 100, next: 125, pressure: 0,
    heat: 50, consumedHeat: 25, reject: true },
  { name: 'nonfinite published pressure work is rejected',
    mass: 2, prior: 100, next: 100, pressure: NaN, reject: true },
  { name: 'malformed pressure seal is rejected',
    mass: 2, prior: 100, next: 75, pressure: -50,
    corruptSeal: true, reject: true },
  { name: 'unconsumed pressure authority is rejected',
    mass: 2, prior: 100, next: 75, pressure: -50,
    pressureConsumedMask: 0, reject: true },
  { name: 'replayed consumed receipt is rejected',
    mass: 2, prior: 100, next: 75, pressure: -50,
    phase: 6, reject: true }
];

function fixture(probe) {
  const layout = createSchroederSpatialMechanicsFieldViewLayout({
    sourceCapacity: 1, fieldCapacity: 1
  });
  const field = new Uint32Array(layout.wordLength);
  const floats = new Float32Array(field.buffer);
  const receipt = layout.receiptControlOffsetWords;
  field[2] = 3;
  field[3] = 7;
  field[8] = 11;
  field[9] = 13;
  field[10] = 0;
  field[28] = layout.accumulatorOffsetWords;
  field[30] = layout.stateOffsetWords;
  field[32] = 1;
  field[34] = 1;
  field[38] = 17;
  field[63] = 2;
  field[receipt] = SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_MAGIC;
  field[receipt + 1] = SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_VERSION;
  field[receipt + 2] = 3;
  field[receipt + 3] = probe.phase ?? 5;
  field[receipt + 5] = field[63];
  field[receipt + 6] = field[34];
  floats[receipt + 9] = probe.heat ?? 0;
  floats[receipt + 10] = probe.consumedHeat ?? probe.heat ?? 0;
  floats[receipt + 17] = probe.pressure;
  floats[receipt + 18] = probe.consumedPressure ?? probe.pressure;
  field[receipt + 24] = SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_MAGIC;
  field[receipt + 25] = SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_VERSION;
  field[receipt + 26] = 3;
  field[receipt + 27] = 1;
  floats[receipt + 28] = 101325;
  floats[receipt + 29] = 1;
  field[receipt + 30] = field[34];
  field[receipt + 31] = field[63];
  field[receipt + 32] = 1;
  field[receipt + 33] = 1;
  field[receipt + 34] = probe.pressureConsumedMask ?? 1;
  field[receipt + 35] = (
    SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_MAGIC
    ^ SCHROEDER_SPATIAL_MECHANICS_FIELD_PRESSURE_VERSION ^ 3 ^ 1
    ^ field[receipt + 28] ^ field[receipt + 29] ^ field[receipt + 30]
    ^ field[receipt + 31] ^ field[receipt + 32]
    ^ field[3] ^ field[8] ^ field[9] ^ field[10] ^ field[38]
  ) >>> 0;
  if (probe.corruptSeal) field[receipt + 35] ^= 1;
  const before = new Float32Array([0, 0, 0, probe.mass, 0, 0, 0, probe.prior]);
  const after = new Float32Array([0, 0, 0, probe.mass, 0, 0, 0, probe.next]);
  return {
    name: probe.name,
    // Preserve exact f32 NaN/infinity bits across Playwright serialization.
    before: Array.from(new Uint32Array(before.buffer)),
    after: Array.from(new Uint32Array(after.buffer)),
    field: Array.from(field),
    receiptOffsetWords: receipt
  };
}

test('native G2P receipts admit signed work and reject invalid absolute energy/accounting', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_G2P_SIGNED_ENERGY=1 for native WebGPU',
  timeout: 180_000
}, async (t) => {
  const { chromium } = await import('@playwright/test');
  const headless = process.env.ULG_G2P_SIGNED_ENERGY_HEADLESS !== '0';
  const browser = await chromium.launch({
    executablePath: process.env.ULG_G2P_SIGNED_ENERGY_CHROME
      || '/usr/bin/google-chrome',
    headless,
    args: [
      '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu', '--ignore-gpu-blocklist',
      ...(headless ? [] : ['--ozone-platform=wayland'])
    ]
  });
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    // Establish the real secure origin without starting the demo's GPU loop.
    await page.goto(new URL('/package.json', BASE_URL).href, {
      waitUntil: 'domcontentloaded'
    });
    const native = await page.evaluate(async ({ variants, probes, receiptWords }) => {
      const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) return {
        status: 'unsupported', secureContext: isSecureContext,
        webGpuExposed: Boolean(navigator.gpu)
      };
      const device = await adapter.requestDevice();
      const adapterInfo = {
        vendor: adapter.info?.vendor ?? null,
        architecture: adapter.info?.architecture ?? null,
        device: adapter.info?.device ?? null,
        description: adapter.info?.description ?? null,
        isFallbackAdapter: adapter.info?.isFallbackAdapter
          ?? adapter.isFallbackAdapter ?? null
      };
      const uncapturedErrors = [];
      device.addEventListener('uncapturederror', (event) => {
        uncapturedErrors.push(event.error.message);
      });
      device.pushErrorScope('validation');
      const rows = [];
      try {
        for (const variant of variants) {
          const module = device.createShaderModule({ label: variant.name, code: variant.code });
          const info = await module.getCompilationInfo();
          const errors = info.messages.filter((message) => message.type === 'error');
          if (errors.length) throw new Error(JSON.stringify(errors.map((error) => error.message)));
          // An explicit layout binds the same resources for both real entry
          // points, including the dummy absent cross-level ledger.
          const bindGroupLayout = device.createBindGroupLayout({ entries: [
            { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
            { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
            { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
            { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
            { binding: 6, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } }
          ] });
          const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });
          const pipelines = await Promise.all([
            'measure_g2p_energy_receipt', 'consume_g2p_energy_receipt'
          ].map((entryPoint) => device.createComputePipelineAsync({
            layout: pipelineLayout, compute: { module, entryPoint }
          })));
          for (const probe of probes) {
            const owned = [];
            const make = (data, usage) => {
              const buffer = device.createBuffer({
                size: data.byteLength, usage: usage | GPUBufferUsage.COPY_DST
              });
              owned.push(buffer);
              device.queue.writeBuffer(buffer, 0, data);
              return buffer;
            };
            let staging;
            try {
              const S = GPUBufferUsage.STORAGE;
              const prior = make(new Uint32Array(probe.before), S);
              const next = make(new Uint32Array(probe.after), S);
              const field = make(new Uint32Array(probe.field), S | GPUBufferUsage.COPY_SRC);
              const reflux = make(new Uint32Array(4), S);
              const params = new Uint32Array(36);
              params[0] = 1;
              const uniform = make(params, GPUBufferUsage.UNIFORM);
              const bindGroup = device.createBindGroup({ layout: bindGroupLayout, entries: [
                { binding: 0, resource: { buffer: prior } },
                { binding: 1, resource: { buffer: reflux } },
                { binding: 3, resource: { buffer: field } },
                { binding: 4, resource: { buffer: next } },
                { binding: 6, resource: { buffer: uniform } }
              ] });
              const evidenceBytes = (1 + receiptWords) * 4;
              staging = device.createBuffer({
                size: evidenceBytes, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
              });
              owned.push(staging);
              const encoder = device.createCommandEncoder();
              for (const pipeline of pipelines) {
                const pass = encoder.beginComputePass();
                pass.setPipeline(pipeline);
                pass.setBindGroup(0, bindGroup);
                pass.dispatchWorkgroups(1);
                pass.end();
              }
              encoder.copyBufferToBuffer(field, 2 * 4, staging, 0, 4);
              encoder.copyBufferToBuffer(
                field, probe.receiptOffsetWords * 4, staging, 4, receiptWords * 4
              );
              device.queue.submit([encoder.finish()]);
              await staging.mapAsync(GPUMapMode.READ);
              rows.push({
                variant: variant.name, name: probe.name,
                evidence: Array.from(new Uint32Array(staging.getMappedRange()))
              });
            } finally {
              if (staging?.mapState === 'mapped') staging.unmap();
              for (const buffer of owned) buffer.destroy();
            }
          }
        }
        await device.queue.onSubmittedWorkDone();
        const validationError = await device.popErrorScope();
        return {
          status: 'ok', adapterInfo, rows,
          validationError: validationError?.message ?? null, uncapturedErrors
        };
      } finally {
        device.destroy();
      }
    }, {
      variants: [
        { name: 'cross-level-capable', code: mlsMpmG2pReconstructCanonicalSpatialMechanicsFieldWgsl },
        { name: 'single-level', code: mlsMpmG2pReconstructCanonicalSpatialSingleLevelMechanicsFieldWgsl }
      ],
      probes: CASES.map(fixture),
      receiptWords: SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_RECEIPT_WORDS
    });
    assert.equal(native.status, 'ok', JSON.stringify(native));
    assert.equal(native.validationError, null);
    assert.deepEqual(native.uncapturedErrors, []);
    assert.notEqual(native.adapterInfo.isFallbackAdapter, true);
    assert.doesNotMatch(JSON.stringify(native.adapterInfo), /swiftshader|llvmpipe/i);
    assert.equal(native.rows.length, CASES.length * 2);
    t.diagnostic(JSON.stringify({
      adapterInfo: native.adapterInfo,
      receiptStageOnly: true,
      independentlyMeasuredKineticEnergy: false,
      cases: native.rows.map((row) => {
        const words = Uint32Array.from(row.evidence);
        const values = new Float32Array(words.buffer);
        return {
          variant: row.variant, name: row.name, fieldStatus: words[0],
          receiptStatus: words[3], receiptPhase: words[4],
          publishedPressureWorkJ: values[18],
          consumedPressureWorkJ: values[19], measuredInternalDeltaJ: values[20]
        };
      })
    }));
    const failures = [];
    for (const row of native.rows) {
      const probe = CASES.find((candidate) => candidate.name === row.name);
      const words = Uint32Array.from(row.evidence);
      const values = new Float32Array(words.buffer);
      const label = `${row.variant}: ${row.name}`;
      try {
        if (probe.reject) {
          assert.ok((words[0] & 4) !== 0, `${label}: field must fail closed`);
          assert.equal(words[1 + 2], 5, `${label}: energy receipt rejected`);
          assert.equal(words[1 + 26], 5, `${label}: pressure receipt rejected`);
        } else {
          assert.equal(words[0], 3, `${label}: field remains admitted`);
          assert.equal(words[1 + 2], 3, `${label}: energy receipt admitted`);
          assert.equal(words[1 + 3], 6, `${label}: receipt consumed`);
          assert.equal(words[1 + 26], 3, `${label}: pressure receipt admitted`);
          assert.equal(values[1 + 17], probe.pressure, `${label}: published work`);
          assert.equal(values[1 + 18], probe.pressure, `${label}: consumed work`);
          assert.equal(values[1 + 19], probe.expectedDelta, `${label}: measured signed work`);
          // Exact integer manufactured cases check the prescribed energy
          // identity, not an independently GPU-measured kinetic-energy change.
          // The sub-ulp case intentionally tests the documented f32
          // state-difference conditioning limit.
          if (probe.mass > 0 && probe.pressure !== -0.25) {
            const kineticGain = -probe.pressure;
            assert.equal(
              probe.mass * probe.prior + (probe.heat ?? 0),
              probe.mass * probe.next + kineticGain,
              `${label}: conserved total energy`
            );
          }
        }
      } catch (error) {
        failures.push(error.message);
      }
    }
    assert.deepEqual(failures, [], failures.join('\n'));
  } finally {
    await browser.close();
  }
});
