import assert from 'node:assert/strict';
import { test } from 'node:test';

const RUN_NATIVE =
  process.env.ULG_RUN_NATIVE_PHASE_VOLUME_SURFACE_STRESS_OPERATOR === '1';
const NATIVE_BASE_URL =
  process.env.ULG_PHASE_VOLUME_TRANSPORT_NATIVE_BASE_URL
  || 'https://127.0.0.1:5174/';

const CASE_FLOATS = 32;
const RESULT_FLOATS = 8;

const buildCase = ({
  leftMass = 0.0078,
  rightMass = 0.011,
  leftInverseMass = 1 / leftMass,
  rightInverseMass = 1 / rightMass,
  leftGradient = [1e-4, 0, 0],
  rightGradient = [7.0710678e-5, 7.0710678e-5, 0],
  leftSigma = 1.9,
  rightSigma = 1.9,
  bond = [1, 0, 0],
  componentAxes = [0, 0],
  componentSign = 1,
  bondLengthCells = 1,
  maxImpulseFraction = 0.5,
  gridSpacingM = 0.01,
  dt = 1e-4,
  cflFactor = 0.4
} = {}) => {
  const block = new Array(CASE_FLOATS).fill(0);
  block[0] = leftMass;
  block[1] = rightMass;
  block[2] = leftInverseMass;
  block[3] = rightInverseMass;
  block.splice(4, 3, ...leftGradient);
  block.splice(7, 3, ...rightGradient);
  block[10] = leftSigma;
  block[11] = rightSigma;
  block.splice(18, 3, ...bond);
  block[21] = componentAxes[0];
  block[22] = componentAxes[1];
  block[23] = componentSign;
  block[24] = bondLengthCells;
  block[25] = maxImpulseFraction;
  block[26] = gridSpacingM;
  block[27] = dt;
  block[28] = cflFactor;
  return block;
};

const RECONSTRUCTION_INPUT = {
  leftMass: 0.0078,
  rightMass: 0.011,
  leftGradient: [1e-4, 7e-5, -3e-5],
  rightGradient: [1e-4, 7e-5, -3e-5],
  leftSigma: 1.9,
  rightSigma: 1.9,
  maxImpulseFraction: 1e6,
  gridSpacingM: 0.01,
  dt: 1e-6,
  cflFactor: 0.4
};

const BONDS = [
  { delta: [1, 0, 0], componentAxes: [0, 0], sign: 1, length: 1 },
  { delta: [0, 1, 0], componentAxes: [1, 1], sign: 1, length: 1 },
  { delta: [0, 0, 1], componentAxes: [2, 2], sign: 1, length: 1 },
  { delta: [1, 1, 0], componentAxes: [0, 1], sign: 1, length: Math.SQRT2 },
  { delta: [1, -1, 0], componentAxes: [0, 1], sign: -1, length: Math.SQRT2 },
  { delta: [1, 0, 1], componentAxes: [0, 2], sign: 1, length: Math.SQRT2 },
  { delta: [1, 0, -1], componentAxes: [0, 2], sign: -1, length: Math.SQRT2 },
  { delta: [0, 1, 1], componentAxes: [1, 2], sign: 1, length: Math.SQRT2 },
  { delta: [0, 1, -1], componentAxes: [1, 2], sign: -1, length: Math.SQRT2 }
];

const RECIPROCAL_BASE = {
  leftMass: 0.0078,
  rightMass: 0.011,
  leftGradient: [1e-4, 0, 0],
  rightGradient: [7.0710678e-5, 7.0710678e-5, 0],
  leftSigma: 1.9,
  rightSigma: 1.7,
  bond: [1, 1, 0],
  componentAxes: [0, 1],
  componentSign: 1,
  bondLengthCells: Math.SQRT2
};

const RECIPROCAL_BASE_INDEX = BONDS.length;
const RECIPROCAL_SWAP_INDEX = RECIPROCAL_BASE_INDEX + 1;
const ZERO_SIGMA_INDEX = RECIPROCAL_SWAP_INDEX + 1;
const INVALID_INDEX = ZERO_SIGMA_INDEX + 1;
const CAPPED_INDEX = INVALID_INDEX + 1;

const CASES = [
  ...BONDS.map(({ delta, componentAxes, sign, length }) => buildCase({
    ...RECONSTRUCTION_INPUT,
    bond: delta,
    componentAxes,
    componentSign: sign,
    bondLengthCells: length
  })),
  buildCase(RECIPROCAL_BASE),
  buildCase({
    ...RECIPROCAL_BASE,
    leftMass: RECIPROCAL_BASE.rightMass,
    rightMass: RECIPROCAL_BASE.leftMass,
    leftInverseMass: 1 / RECIPROCAL_BASE.rightMass,
    rightInverseMass: 1 / RECIPROCAL_BASE.leftMass,
    leftGradient: RECIPROCAL_BASE.rightGradient,
    rightGradient: RECIPROCAL_BASE.leftGradient,
    leftSigma: RECIPROCAL_BASE.rightSigma,
    rightSigma: RECIPROCAL_BASE.leftSigma,
    bond: RECIPROCAL_BASE.bond.map((value) => -value)
  }),
  buildCase({
    ...RECIPROCAL_BASE,
    leftSigma: 0,
    rightSigma: 0
  }),
  buildCase({
    ...RECIPROCAL_BASE,
    leftSigma: -1
  }),
  buildCase({
    ...RECIPROCAL_BASE,
    leftMass: 1e-5,
    rightMass: 0.2,
    leftInverseMass: 1e5,
    rightInverseMass: 5,
    leftGradient: [1e-4, 0, 0],
    rightGradient: [1e-4, 0, 0],
    leftSigma: 1e8,
    rightSigma: 1e8,
    bond: [0, 1, 0],
    componentAxes: [1, 1],
    componentSign: 1,
    bondLengthCells: 1,
    maxImpulseFraction: 0.02
  })
];

test('native S9 central-bond surface stress is reciprocal, torque-free, and reconstructs symmetric CSS', {
  skip: RUN_NATIVE
    ? false
    : 'set ULG_RUN_NATIVE_PHASE_VOLUME_SURFACE_STRESS_OPERATOR=1 for native WebGPU',
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
        '/ulg-gpu-abi/src/schroederSpatialPhaseVolumeSurfaceStressOperatorWgsl.js'
      )).schroederSpatialPhaseVolumeSurfaceStressOperatorWgsl;
      const caseCount = cases.length / caseFloats;
      const harness = `${operator}
@group(0) @binding(0) var<storage, read> cases: array<f32>;
@group(0) @binding(1) var<storage, read_write> results: array<f32>;

@compute @workgroup_size(1)
fn run(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= ${caseCount}u) { return; }
  let input = id.x * ${caseFloats}u;
  let output = id.x * ${resultFloats}u;
  let result = schroeder_phase_volume_surface_stress_bond(
    cases[input + 0u],
    cases[input + 1u],
    cases[input + 2u],
    cases[input + 3u],
    vec3<f32>(
      cases[input + 4u],
      cases[input + 5u],
      cases[input + 6u]
    ),
    vec3<f32>(
      cases[input + 7u],
      cases[input + 8u],
      cases[input + 9u]
    ),
    cases[input + 10u],
    cases[input + 11u],
    vec3<f32>(
      cases[input + 18u],
      cases[input + 19u],
      cases[input + 20u]
    ),
    u32(cases[input + 21u]),
    u32(cases[input + 22u]),
    cases[input + 23u],
    cases[input + 24u],
    cases[input + 25u],
    cases[input + 26u],
    cases[input + 27u],
    cases[input + 28u]
  );
  results[output + 0u] = f32(result.valid);
  results[output + 1u] = result.bond_impulse_ns.x;
  results[output + 2u] = result.bond_impulse_ns.y;
  results[output + 3u] = result.bond_impulse_ns.z;
}
`;
      const module = device.createShaderModule({
        label: 'surface-stress-operator-harness',
        code: harness
      });
      const compilation = await module.getCompilationInfo();
      const compilationErrors = compilation.messages
        .filter((message) => message.type === 'error')
        .map((message) => `${message.lineNum}: ${message.message}`);
      if (compilationErrors.length > 0) {
        return { status: 'compile-failed', compilationErrors };
      }

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
      device.destroy();
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
    const offset = index * RESULT_FLOATS;
    return {
      valid: native.results[offset],
      impulse: native.results.slice(offset + 1, offset + 4)
    };
  };
  const magnitude = (vector) => Math.hypot(...vector);
  const cross = (left, right) => [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0]
  ];

  const commonImpulseScale =
    RECONSTRUCTION_INPUT.dt
    * RECONSTRUCTION_INPUT.gridSpacingM
    * RECONSTRUCTION_INPUT.gridSpacingM;
  const reconstructedStressPa = Array.from(
    { length: 3 },
    () => new Array(3).fill(0)
  );
  for (const [index, bond] of BONDS.entries()) {
    const result = read(index);
    assert.equal(result.valid, 1, JSON.stringify({ index, result }));
    const pairTorque = cross(bond.delta, result.impulse);
    assert.ok(
      magnitude(pairTorque) <= Math.max(1e-15, magnitude(result.impulse) * 1e-6),
      JSON.stringify({ index, bond, result, pairTorque })
    );
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        reconstructedStressPa[row][column] +=
          result.impulse[row]
          / commonImpulseScale
          * bond.delta[column];
      }
    }
  }

  const gradientLength = Math.hypot(...RECONSTRUCTION_INPUT.leftGradient);
  const normal = RECONSTRUCTION_INPUT.leftGradient.map(
    (value) => value / gradientLength
  );
  const stressScale =
    RECONSTRUCTION_INPUT.leftSigma
    * gradientLength
    / RECONSTRUCTION_INPUT.gridSpacingM ** 3;
  const expectedStressPa = Array.from({ length: 3 }, (_, row) => (
    Array.from({ length: 3 }, (_, column) => (
      stressScale * ((row === column ? 1 : 0) - normal[row] * normal[column])
    ))
  ));
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      const expected = expectedStressPa[row][column];
      const actual = reconstructedStressPa[row][column];
      assert.ok(
        Math.abs(actual - expected) <= Math.max(2e-3, Math.abs(expected) * 5e-5),
        JSON.stringify({ reconstructedStressPa, expectedStressPa, row, column })
      );
    }
  }

  const baseline = read(RECIPROCAL_BASE_INDEX);
  const swapped = read(RECIPROCAL_SWAP_INDEX);
  assert.equal(baseline.valid, 1);
  assert.equal(swapped.valid, 1);
  for (let axis = 0; axis < 3; axis += 1) {
    assert.ok(
      swapped.impulse[axis] === -baseline.impulse[axis]
        || (
          swapped.impulse[axis] === 0
          && baseline.impulse[axis] === 0
        )
    );
  }

  const zeroSigma = read(ZERO_SIGMA_INDEX);
  assert.equal(zeroSigma.valid, 1);
  assert.deepEqual(zeroSigma.impulse, [0, 0, 0]);

  assert.equal(read(INVALID_INDEX).valid, 0);

  const capped = read(CAPPED_INDEX);
  assert.equal(capped.valid, 1);
  const reducedMass = 1 / (1e5 + 5);
  const impulseLimit =
    0.02 * reducedMass * (0.4 * 0.01 / 1e-4);
  assert.ok(magnitude(capped.impulse) <= impulseLimit * (1 + 2e-6));
  assert.ok(magnitude(capped.impulse) >= impulseLimit * (1 - 2e-6));
});
