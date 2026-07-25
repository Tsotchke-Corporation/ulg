import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  carrierFromPhysicalEnergy,
  physicalEnergyFromCarrier,
  resolvePressurePlateau
} from '../src/runtime/material/pressureCarrierTransform.js';

// The host and device carrier transforms must agree, or a particle's phase
// state depends on which one last touched it. This drives the real WGSL on the
// device and compares against the host module across pressures, including the
// reference-pressure case which must be bit-identical to doing nothing.
const RUN_NATIVE = process.env.ULG_RUN_NATIVE_PRESSURE_CARRIER === '1';
const NATIVE_BASE_URL =
  process.env.ULG_PHASE_VOLUME_TRANSPORT_NATIVE_BASE_URL
  || 'https://127.0.0.1:5174/';

const BASE = {
  anchorEnergyJPerKg: 0,
  anchorTemperatureK: 273.15,
  plateauStartJPerKg: 4184 * (373.15 - 273.15),
  plateauEndJPerKg: 4184 * (373.15 - 273.15) + 2.257e6,
  referenceTemperatureK: 373.15,
  referencePressurePa: 101325,
  latentHeatJPerKg: 2.257e6,
  molarMassKgPerMol: 0.018015
};

const PRESSURES = [20000, 50000, 101325, 2 * 101325, 5e5];
const ENERGY_FRACTIONS = [-0.2, 0, 0.25, 0.75, 0.999, 1, 1.5, 2, 3];

const f32 = (() => {
  const floats = new Float32Array(1);
  return (value) => {
    floats[0] = value;
    return floats[0];
  };
})();

test('native pressure carrier transform matches the host implementation', {
  skip: RUN_NATIVE
    ? false
    : 'set ULG_RUN_NATIVE_PRESSURE_CARRIER=1 for native WebGPU',
  timeout: 180_000
}, async () => {
  // Build the case list host-side so both sides see identical f32 inputs.
  const cases = [];
  for (const pressurePa of PRESSURES) {
    const plateau = resolvePressurePlateau({ ...BASE, absolutePressurePa: pressurePa });
    assert.ok(plateau, `host plateau must resolve at ${pressurePa} Pa`);
    const span = BASE.plateauEndJPerKg - BASE.plateauStartJPerKg;
    for (const fraction of ENERGY_FRACTIONS) {
      cases.push({
        pressurePa,
        energyJPerKg: f32(plateau.shiftedPlateauStartJPerKg + fraction * span)
      });
    }
  }

  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: process.env.ULG_PHASE_VOLUME_TRANSPORT_CHROME
      || '/usr/bin/google-chrome',
    headless: true,
    args: [
      '--use-angle=vulkan',
      '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu',
      '--ignore-gpu-blocklist'
    ]
  });

  let native;
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(NATIVE_BASE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000
    });
    native = await page.evaluate(async ({ flatCases, constants }) => {
      const adapter = await navigator.gpu?.requestAdapter({
        powerPreference: 'high-performance'
      });
      if (!adapter) return { status: 'unsupported' };
      const device = await adapter.requestDevice();
      device.pushErrorScope('validation');

      const { pressureCarrierTransformWgsl } = await import(
        '/ulg-gpu-abi/src/pressureCarrierTransformWgsl.js'
      );
      const caseCount = flatCases.length / 2;
      const code = `${pressureCarrierTransformWgsl}
@group(0) @binding(0) var<storage, read> cases: array<f32>;
@group(0) @binding(1) var<storage, read_write> results: array<f32>;

@compute @workgroup_size(1)
fn run(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= ${caseCount}u) { return; }
  let c = id.x * 2u;
  let o = id.x * 4u;
  let plateau = ulg_resolve_pressure_plateau(
    ${constants.anchorEnergyJPerKg}, ${constants.anchorTemperatureK},
    ${constants.plateauStartJPerKg}, ${constants.plateauEndJPerKg},
    ${constants.referenceTemperatureK},
    cases[c + 0u], ${constants.referencePressurePa},
    ${constants.latentHeatJPerKg}, ${constants.molarMassKgPerMol}
  );
  let carrier = ulg_carrier_from_physical_energy(plateau, cases[c + 1u]);
  results[o + 0u] = f32(plateau.valid);
  results[o + 1u] = f32(plateau.identity);
  results[o + 2u] = carrier;
  results[o + 3u] = ulg_physical_energy_from_carrier(plateau, carrier);
}
`;
      const module = device.createShaderModule({ code });
      const info = await module.getCompilationInfo();
      const errors = info.messages
        .filter((m) => m.type === 'error')
        .map((m) => `${m.lineNum}: ${m.message}`);
      if (errors.length) return { status: 'compile-failed', errors };

      const caseData = new Float32Array(flatCases);
      const caseBuffer = device.createBuffer({
        size: caseData.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });
      device.queue.writeBuffer(caseBuffer, 0, caseData);
      const resultBytes = caseCount * 4 * 4;
      const resultBuffer = device.createBuffer({
        size: resultBytes,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
      });
      const readback = device.createBuffer({
        size: resultBytes,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
      });
      const pipeline = await device.createComputePipelineAsync({
        layout: 'auto',
        compute: { module, entryPoint: 'run' }
      });
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginComputePass();
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: caseBuffer } },
          { binding: 1, resource: { buffer: resultBuffer } }
        ]
      }));
      pass.dispatchWorkgroups(caseCount);
      pass.end();
      encoder.copyBufferToBuffer(resultBuffer, 0, readback, 0, resultBytes);
      device.queue.submit([encoder.finish()]);
      await readback.mapAsync(GPUMapMode.READ);
      const results = [...new Float32Array(readback.getMappedRange().slice(0))];
      readback.unmap();
      return {
        status: 'ok',
        results,
        validationError: (await device.popErrorScope())?.message || null
      };
    }, {
      flatCases: cases.flatMap(({ pressurePa, energyJPerKg }) => [
        pressurePa,
        energyJPerKg
      ]),
      constants: BASE
    });
  } finally {
    await browser.close();
  }

  assert.equal(native.status, 'ok', JSON.stringify(native));
  assert.equal(native.validationError, null, JSON.stringify(native));

  cases.forEach((testCase, index) => {
    const [valid, identity, carrier, roundTrip] = native.results.slice(
      index * 4,
      index * 4 + 4
    );
    const label = `${testCase.pressurePa} Pa / ${testCase.energyJPerKg} J/kg`;
    assert.equal(valid, 1, `device plateau must resolve at ${label}`);

    const plateau = resolvePressurePlateau({
      ...BASE,
      absolutePressurePa: testCase.pressurePa
    });
    const hostCarrier = carrierFromPhysicalEnergy(plateau, testCase.energyJPerKg);
    const isReference = testCase.pressurePa === BASE.referencePressurePa;
    assert.equal(
      identity === 1,
      isReference,
      `identity branch must follow the f32 bit comparison at ${label}`
    );

    if (isReference) {
      // Bitwise, not close: the reference case must be a true no-op on both
      // sides, so the device carrier is exactly the input energy.
      assert.equal(
        carrier,
        testCase.energyJPerKg,
        `reference pressure must be a bitwise identity at ${label}`
      );
      assert.equal(roundTrip, testCase.energyJPerKg, label);
      return;
    }

    // Away from the reference the two implementations are the same branch
    // structure in f32 versus f64, so compare at single-precision resolution.
    const scale = Math.max(1, Math.abs(hostCarrier));
    assert.ok(
      Math.abs(carrier - hostCarrier) <= 1e-4 * scale,
      `CPU/GPU carrier parity failed at ${label}: ${carrier} vs ${hostCarrier}`
    );
    const hostRoundTrip = physicalEnergyFromCarrier(plateau, hostCarrier);
    assert.ok(
      Math.abs(roundTrip - hostRoundTrip)
        <= 1e-4 * Math.max(1, Math.abs(hostRoundTrip)),
      `CPU/GPU inverse parity failed at ${label}: ${roundTrip} vs ${hostRoundTrip}`
    );
  });
});
