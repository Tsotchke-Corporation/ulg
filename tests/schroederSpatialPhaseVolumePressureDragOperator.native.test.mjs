import assert from 'node:assert/strict';
import { test } from 'node:test';

// Behavioural coverage for the shared pressure/drag operator. The other
// focused tests in this area only regex the WGSL source, which the Slice 9
// handoff correctly calls out as not being evidence that the GPU path works.
// This drives the real operator on the real device with controlled inputs and
// asserts the invariants it is supposed to guarantee.
const RUN_NATIVE =
  process.env.ULG_RUN_NATIVE_PHASE_VOLUME_OPERATOR === '1';
const NATIVE_BASE_URL =
  process.env.ULG_PHASE_VOLUME_TRANSPORT_NATIVE_BASE_URL
  || 'https://127.0.0.1:5174/';

// One case is a flat block of operator arguments; one result is a flat block
// of the fields the operator returns.
const CASE_FLOATS = 32;
const RESULT_FLOATS = 20;

const buildCase = ({
  condensedMass,
  gasMass,
  condensedVolume,
  gasVolume,
  condensedGradient,
  gasGradient,
  condensedVelocity,
  gasVelocity,
  condensedSoundSpeed = 1500,
  gasSoundSpeed = 340,
  condensedViscosity = 1e-3,
  gasViscosity = 1e-5,
  condensedPressurePa,
  gasPressurePa,
  pressureScale = 1,
  dragScale = 1,
  maxImpulseFraction = 0.5,
  gridSpacingM = 0.25,
  dt = 0.005,
  cflFactor = 0.4
}) => {
  const block = new Array(CASE_FLOATS).fill(0);
  block[0] = condensedMass;
  block[1] = gasMass;
  block[2] = condensedVolume;
  block[3] = gasVolume;
  block[4] = condensedGradient[0];
  block[5] = condensedGradient[1];
  block[6] = condensedGradient[2];
  block[7] = gasGradient[0];
  block[8] = gasGradient[1];
  block[9] = gasGradient[2];
  block[10] = condensedVelocity[0];
  block[11] = condensedVelocity[1];
  block[12] = condensedVelocity[2];
  block[13] = gasVelocity[0];
  block[14] = gasVelocity[1];
  block[15] = gasVelocity[2];
  block[16] = condensedSoundSpeed;
  block[17] = gasSoundSpeed;
  block[18] = condensedViscosity;
  block[19] = gasViscosity;
  block[20] = condensedPressurePa;
  block[21] = gasPressurePa;
  block[22] = pressureScale;
  block[23] = dragScale;
  block[24] = maxImpulseFraction;
  block[25] = gridSpacingM;
  block[26] = dt;
  block[27] = cflFactor;
  return block;
};

const BASE = {
  condensedMass: 0.048,
  gasMass: 3.7e-5,
  condensedVolume: 4.8e-5,
  gasVolume: 3.1e-2,
  condensedGradient: [12, -3, 0.5],
  gasGradient: [-7, 2, -0.25],
  condensedVelocity: [0.2, -0.1, 0.05],
  gasVelocity: [-0.2, 0.15, -0.05],
  condensedPressurePa: 101325,
  gasPressurePa: 120000
};

const CASES = [
  // 0: baseline, a real pressure difference and a real relative velocity
  buildCase(BASE),
  // 1: exactly equal absolute pressures -> the pressure impulse must vanish
  buildCase({ ...BASE, gasPressurePa: BASE.condensedPressurePa }),
  // 2: case 0 with only the two absolute pressures exchanged. The interface
  // area vector is unchanged, so reversing the pressure gradient must exactly
  // negate the pressure impulse. Exchanging the bodies themselves is not a
  // legal call: which side is condensed is decided by phase, not by the
  // caller, and the area vector and pressure difference are each antisymmetric
  // under that relabelling so their product is symmetric by construction.
  buildCase({
    ...BASE,
    condensedPressurePa: BASE.gasPressurePa,
    gasPressurePa: BASE.condensedPressurePa
  }),
  // 3: zero drag scale -> no drag impulse and no drag heat
  buildCase({ ...BASE, dragScale: 0 }),
  // 4: vacuum on both sides is admissible but must do no pressure work
  buildCase({ ...BASE, condensedPressurePa: 0, gasPressurePa: 0 }),
  // 5: non-positive mass must fail closed
  buildCase({ ...BASE, gasMass: 0 }),
  // 6: non-positive volume must fail closed
  buildCase({ ...BASE, gasVolume: 0 }),
  // 7: negative absolute pressure must fail closed
  buildCase({ ...BASE, gasPressurePa: -1 })
];

test('native shared pressure/drag operator holds its stated invariants', {
  skip: RUN_NATIVE
    ? false
    : 'set ULG_RUN_NATIVE_PHASE_VOLUME_OPERATOR=1 for native WebGPU',
  timeout: 180_000
}, async () => {
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
    native = await page.evaluate(async ({ cases, caseFloats, resultFloats }) => {
      const adapter = await navigator.gpu?.requestAdapter({
        powerPreference: 'high-performance'
      });
      if (!adapter) {
        return { status: 'unsupported', reason: 'WebGPU adapter unavailable' };
      }
      const device = await adapter.requestDevice();
      const uncapturedErrors = [];
      device.addEventListener('uncapturederror', (event) => {
        uncapturedErrors.push(event.error?.message || String(event.error));
      });
      device.pushErrorScope('validation');

      const operator = (await import(
        '/ulg-gpu-abi/src/schroederSpatialPhaseVolumePressureDragOperatorWgsl.js'
      )).schroederSpatialPhaseVolumePressureDragOperatorWgsl;

      const caseCount = cases.length / caseFloats;
      const harness = `${operator}
@group(0) @binding(0) var<storage, read> cases: array<f32>;
@group(0) @binding(1) var<storage, read_write> results: array<f32>;

@compute @workgroup_size(1)
fn run(@builtin(global_invocation_id) id: vec3<u32>) {
  let c = id.x * ${caseFloats}u;
  let o = id.x * ${resultFloats}u;
  if (id.x >= ${caseCount}u) { return; }
  let initial_condensed = vec3<f32>(cases[c + 10u], cases[c + 11u], cases[c + 12u]);
  let initial_gas = vec3<f32>(cases[c + 13u], cases[c + 14u], cases[c + 15u]);
  let r = schroeder_phase_volume_pressure_drag_pair(
    cases[c + 0u], cases[c + 1u],
    1.0 / cases[c + 0u], 1.0 / cases[c + 1u],
    cases[c + 2u], cases[c + 3u],
    vec3<f32>(cases[c + 4u], cases[c + 5u], cases[c + 6u]),
    vec3<f32>(cases[c + 7u], cases[c + 8u], cases[c + 9u]),
    initial_condensed, initial_gas,
    cases[c + 16u], cases[c + 17u],
    cases[c + 18u], cases[c + 19u],
    cases[c + 20u], cases[c + 21u],
    cases[c + 22u], cases[c + 23u], cases[c + 24u],
    cases[c + 25u], cases[c + 26u], cases[c + 27u]
  );
  results[o + 0u] = f32(r.valid);
  results[o + 1u] = r.condensed_velocity.x;
  results[o + 2u] = r.condensed_velocity.y;
  results[o + 3u] = r.condensed_velocity.z;
  results[o + 4u] = r.gas_velocity.x;
  results[o + 5u] = r.gas_velocity.y;
  results[o + 6u] = r.gas_velocity.z;
  results[o + 7u] = r.pressure_impulse.x;
  results[o + 8u] = r.pressure_impulse.y;
  results[o + 9u] = r.pressure_impulse.z;
  results[o + 10u] = r.drag_impulse.x;
  results[o + 11u] = r.drag_impulse.y;
  results[o + 12u] = r.drag_impulse.z;
  results[o + 13u] = r.pressure_internal_compensation_j;
  results[o + 14u] = r.drag_heat_j;
  results[o + 15u] = r.interface_area_m2;
}
`;
      const module = device.createShaderModule({ label: 'operator-harness', code: harness });
      const info = await module.getCompilationInfo();
      const compileErrors = info.messages
        .filter((m) => m.type === 'error')
        .map((m) => `${m.lineNum}: ${m.message}`);
      if (compileErrors.length) return { status: 'compile-failed', compileErrors };

      const caseData = new Float32Array(cases);
      const caseBuffer = device.createBuffer({
        size: caseData.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });
      device.queue.writeBuffer(caseBuffer, 0, caseData);
      const resultBytes = caseCount * resultFloats * 4;
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
      const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: caseBuffer } },
          { binding: 1, resource: { buffer: resultBuffer } }
        ]
      });
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginComputePass();
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.dispatchWorkgroups(caseCount);
      pass.end();
      encoder.copyBufferToBuffer(resultBuffer, 0, readback, 0, resultBytes);
      device.queue.submit([encoder.finish()]);
      await readback.mapAsync(GPUMapMode.READ);
      const results = [...new Float32Array(readback.getMappedRange().slice(0))];
      readback.unmap();
      const validationError = await device.popErrorScope();
      return {
        status: 'ok',
        results,
        validationError: validationError?.message || null,
        uncapturedErrors
      };
    }, {
      cases: CASES.flat(),
      caseFloats: CASE_FLOATS,
      resultFloats: RESULT_FLOATS
    });
  } finally {
    await browser.close();
  }

  assert.equal(native.status, 'ok', JSON.stringify(native));
  assert.equal(native.validationError, null, JSON.stringify(native));
  assert.deepEqual(native.uncapturedErrors, [], JSON.stringify(native));

  const read = (index) => {
    const base = index * RESULT_FLOATS;
    const slice = native.results.slice(base, base + RESULT_FLOATS);
    return {
      valid: slice[0],
      condensedVelocity: slice.slice(1, 4),
      gasVelocity: slice.slice(4, 7),
      pressureImpulse: slice.slice(7, 10),
      dragImpulse: slice.slice(10, 13),
      pressureCompensationJ: slice[13],
      dragHeatJ: slice[14],
      interfaceAreaM2: slice[15]
    };
  };

  const F32_EPS = 2 ** -24;
  const gamma = (n) => {
    const nEps = Math.min(0.25, Math.max(1, n) * F32_EPS);
    return nEps / (1 - nEps);
  };

  const assertZeroVector = (vector, message) => {
    // -0 is a legitimate f32 result here; compare numerically rather than with
    // deepEqual, which distinguishes -0 from 0 under node:assert/strict.
    for (const [axis, value] of vector.entries()) {
      assert.ok(value === 0, `${message} (axis ${axis} was ${value})`);
    }
  };

  const baseCase = read(0);
  assert.equal(baseCase.valid, 1, JSON.stringify(baseCase));
  assert.ok(
    baseCase.pressureImpulse.some((v) => v !== 0),
    `baseline must produce a pressure impulse; ${JSON.stringify(baseCase)}`
  );
  assert.ok(baseCase.interfaceAreaM2 > 0, JSON.stringify(baseCase));
  assert.ok(baseCase.dragHeatJ >= 0, JSON.stringify(baseCase));

  // Momentum and energy close against the representation floor of the stored
  // velocity state, which is what the transport shader admits.
  const conserves = (result, input) => {
    const mC = input[0];
    const mG = input[1];
    const v0C = input.slice(10, 13);
    const v0G = input.slice(13, 16);
    let stateL1 = 0;
    let momentumResidual = 0;
    for (let axis = 0; axis < 3; axis += 1) {
      momentumResidual += Math.abs(
        mC * (result.condensedVelocity[axis] - v0C[axis])
          + mG * (result.gasVelocity[axis] - v0G[axis])
      );
      stateL1 += mC * (Math.abs(v0C[axis]) + Math.abs(result.condensedVelocity[axis]))
        + mG * (Math.abs(v0G[axis]) + Math.abs(result.gasVelocity[axis]));
    }
    const dot = (a) => a[0] * a[0] + a[1] * a[1] + a[2] * a[2];
    const kineticDelta = 0.5 * (
      mC * (dot(result.condensedVelocity) - dot(v0C))
        + mG * (dot(result.gasVelocity) - dot(v0G))
    );
    const kineticL1 = 0.5 * (
      mC * (dot(v0C) + dot(result.condensedVelocity))
        + mG * (dot(v0G) + dot(result.gasVelocity))
    );
    return {
      momentumResidual,
      momentumFloor: gamma(4) * stateL1,
      energyResidual: Math.abs(
        kineticDelta + result.pressureCompensationJ + result.dragHeatJ
      ),
      energyFloor: gamma(6) * kineticL1
    };
  };

  for (const index of [0, 1, 3, 4]) {
    const balance = conserves(read(index), CASES[index]);
    assert.ok(
      balance.momentumResidual <= balance.momentumFloor,
      `case ${index} momentum: ${JSON.stringify(balance)}`
    );
    assert.ok(
      balance.energyResidual <= balance.energyFloor,
      `case ${index} energy: ${JSON.stringify(balance)}`
    );
  }

  // Equal absolute pressures must produce exactly no pressure impulse. Drag is
  // still free to act on the relative velocity.
  const equalPressure = read(1);
  assert.equal(equalPressure.valid, 1, JSON.stringify(equalPressure));
  assertZeroVector(
    equalPressure.pressureImpulse,
    `equal pressure must not move the pair; ${JSON.stringify(equalPressure)}`
  );
  assert.ok(
    equalPressure.pressureCompensationJ === 0,
    JSON.stringify(equalPressure)
  );

  // Reversing the pressure gradient negates the pressure impulse exactly.
  const swapped = read(2);
  assert.equal(swapped.valid, 1, JSON.stringify(swapped));
  for (let axis = 0; axis < 3; axis += 1) {
    const forward = baseCase.pressureImpulse[axis];
    const reverse = swapped.pressureImpulse[axis];
    const floor = gamma(8) * (Math.abs(forward) + Math.abs(reverse));
    assert.ok(
      Math.abs(forward + reverse) <= Math.max(floor, 8 * 1.175494351e-38),
      `pressure impulse must be antisymmetric on axis ${axis}: `
        + `${forward} vs ${reverse}`
    );
  }

  // A vacuum pair is admissible and does no pressure work.
  const vacuum = read(4);
  assert.equal(vacuum.valid, 1, JSON.stringify(vacuum));
  assertZeroVector(vacuum.pressureImpulse, JSON.stringify(vacuum));

  // Zero drag scale removes drag entirely.
  const noDrag = read(3);
  assert.equal(noDrag.valid, 1, JSON.stringify(noDrag));
  assertZeroVector(noDrag.dragImpulse, JSON.stringify(noDrag));
  assert.ok(noDrag.dragHeatJ === 0, JSON.stringify(noDrag));

  // Malformed pairs fail closed and leave the velocities untouched.
  for (const index of [5, 6, 7]) {
    const rejected = read(index);
    assert.equal(
      rejected.valid,
      0,
      `case ${index} must fail closed; ${JSON.stringify(rejected)}`
    );
    assertZeroVector(rejected.pressureImpulse, JSON.stringify(rejected));
    assertZeroVector(rejected.dragImpulse, JSON.stringify(rejected));
    assert.ok(rejected.pressureCompensationJ === 0, JSON.stringify(rejected));
    assert.ok(rejected.dragHeatJ === 0, JSON.stringify(rejected));
  }
});
