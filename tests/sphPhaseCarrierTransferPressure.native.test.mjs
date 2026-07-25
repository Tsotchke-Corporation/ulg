import assert from 'node:assert/strict';
import { test } from 'node:test';

import { sphPhaseCarrierTransferWgsl } from '../src/runtime/sph/sphPhaseCarrierTransferGpu.js';

// The point of the carrier transform is that a particle's plateau depends on
// its pressure. This drives the real transfer shader's plateau resolution and
// proves three things on device:
//   1. at the reference pressure the result is bitwise the old reference ladder;
//   2. below it, a particle whose energy sits under the reference plateau is
//      recognized as boiling, and the endpoints it splits into move down;
//   3. above it, the plateau moves up, so a particle that would boil at one
//      atmosphere no longer does.
const RUN_NATIVE = process.env.ULG_RUN_NATIVE_PHASE_CARRIER_TRANSFER === '1';
const NATIVE_BASE_URL = process.env.ULG_PHASE_CARRIER_TRANSFER_BASE_URL
  || 'https://127.0.0.1:5174/';

// A water-like ladder: liquid branch from the freezing anchor up to the boil,
// then the vaporization plateau.
const MATERIAL_ID = 1;
const ANCHOR_U = 0;
const ANCHOR_T = 273.15;
const PLATEAU_START_U = 418_400;
const PLATEAU_END_U = 418_400 + 2_256_000;
const REFERENCE_T = 373.15;
const REFERENCE_PRESSURE_PA = 101_325;
const MOLAR_MASS = 0.018015;
const LATENT_HEAT = PLATEAU_END_U - PLATEAU_START_U;
const SLOPE = 8.314462618 / (LATENT_HEAT * MOLAR_MASS);

// Segment table: the liquid phase branch (type 1) then the plateau (type 2).
const SEGMENTS = [
  MATERIAL_ID, 1, 2, 2,
  ANCHOR_U, PLATEAU_START_U, ANCHOR_T, REFERENCE_T,
  1000, 1000, 1, 0,

  MATERIAL_ID, 2, 2, 3,
  PLATEAU_START_U, PLATEAU_END_U, REFERENCE_T, REFERENCE_T,
  1000, 0.6, 1, 0
];
// materialId, segmentOffset, segmentCount, status, emissivity, then the
// pressure carrier lanes.
const MATERIAL_RECORDS = [
  MATERIAL_ID, 0, 2, 1, 0.9, 1, REFERENCE_PRESSURE_PA, SLOPE
];

function shiftedPlateau(pressurePa) {
  const shiftedT = 1 / (1 / REFERENCE_T - SLOPE * Math.log(pressurePa / REFERENCE_PRESSURE_PA));
  const meanCp = (PLATEAU_START_U - ANCHOR_U) / (REFERENCE_T - ANCHOR_T);
  const start = ANCHOR_U + meanCp * (shiftedT - ANCHOR_T);
  return { shiftedT, start, end: start + LATENT_HEAT };
}

test('native plateau resolution follows the particle pressure', {
  skip: RUN_NATIVE
    ? false
    : 'set ULG_RUN_NATIVE_PHASE_CARRIER_TRANSFER=1 for native WebGPU',
  timeout: 180_000
}, async () => {
  const halfAtmosphere = shiftedPlateau(REFERENCE_PRESSURE_PA / 2);
  const doubleAtmosphere = shiftedPlateau(REFERENCE_PRESSURE_PA * 2);

  // Halfway between the lowered plateau start and the reference plateau start.
  // The plateau is far wider than that gap, so this is inside the lowered
  // plateau while still below the reference one: at half an atmosphere it is
  // boiling, at one atmosphere it is plain hot liquid.
  assert.ok(
    halfAtmosphere.start < PLATEAU_START_U,
    'half an atmosphere must lower the plateau'
  );
  const lowPressureBoilingU =
    halfAtmosphere.start + (PLATEAU_START_U - halfAtmosphere.start) * 0.5;
  assert.ok(lowPressureBoilingU < PLATEAU_START_U);
  assert.ok(lowPressureBoilingU > halfAtmosphere.start);
  assert.ok(lowPressureBoilingU < halfAtmosphere.end);

  // Halfway between the reference plateau start and the raised one: boiling at
  // one atmosphere, not boiling at two.
  assert.ok(
    doubleAtmosphere.start > PLATEAU_START_U,
    'two atmospheres must raise the plateau'
  );
  const referenceBoilingU =
    PLATEAU_START_U + (doubleAtmosphere.start - PLATEAU_START_U) * 0.5;
  assert.ok(referenceBoilingU > PLATEAU_START_U);
  assert.ok(referenceBoilingU < PLATEAU_END_U);
  assert.ok(referenceBoilingU < doubleAtmosphere.start);

  const cases = [
    // pressure, energy, expect a plateau to be found
    { pressurePa: REFERENCE_PRESSURE_PA, energy: referenceBoilingU, found: true },
    { pressurePa: REFERENCE_PRESSURE_PA, energy: lowPressureBoilingU, found: false },
    { pressurePa: REFERENCE_PRESSURE_PA / 2, energy: lowPressureBoilingU, found: true },
    { pressurePa: REFERENCE_PRESSURE_PA * 2, energy: referenceBoilingU, found: false },
    // Fail-closed inputs must not fall back to one atmosphere.
    { pressurePa: 0, energy: referenceBoilingU, found: true },
    { pressurePa: -1, energy: referenceBoilingU, found: true }
  ];

  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: process.env.ULG_PHASE_CARRIER_TRANSFER_CHROME
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
    native = await page.evaluate(async ({ transferWgsl, segments, records, probes, materialId }) => {
      const adapter = await navigator.gpu?.requestAdapter({
        powerPreference: 'high-performance'
      });
      if (!adapter) return { status: 'unsupported' };
      const device = await adapter.requestDevice();
      device.pushErrorScope('validation');

      const segmentCount = segments.length / 12;
      const recordCount = records.length / 8;
      const probeCount = probes.length / 2;
      // closure_rows layout: segments, then (empty) mechanics records, then the
      // thermal material records, exactly as the host packs them.
      const closure = new Float32Array([...segments, ...records]);
      const materialOffsetVec4 = segments.length / 4;

      // Reuse the shader's own declarations, then probe plateau_endpoint
      // directly. Strip the shader's entry points so only the helpers remain.
      const helpers = transferWgsl.split('@compute')[0];
      const code = `${helpers}
@group(0) @binding(9) var<storage, read> probe_in: array<f32>;
@group(0) @binding(10) var<storage, read_write> probe_out: array<f32>;

@compute @workgroup_size(1)
fn probe(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= ${probeCount}u) { return; }
  let i = id.x * 2u;
  let o = id.x * 4u;
  let pressure = probe_in[i];
  let energy = probe_in[i + 1u];
  let liquid = plateau_endpoint(f32(${materialId}), 2u, 3u, energy, 2u, pressure);
  let gas = plateau_endpoint(f32(${materialId}), 2u, 3u, energy, 3u, pressure);
  probe_out[o + 0u] = liquid.y;
  probe_out[o + 1u] = liquid.x;
  probe_out[o + 2u] = gas.y;
  probe_out[o + 3u] = gas.x;
}
`;
      const module = device.createShaderModule({ code });
      const info = await module.getCompilationInfo();
      const errors = info.messages
        .filter((m) => m.type === 'error')
        .map((m) => `${m.lineNum}: ${m.message}`);
      if (errors.length) return { status: 'compile-failed', errors };

      const storage = (data, usage) => {
        const buffer = device.createBuffer({
          size: Math.max(4, data.byteLength),
          usage: usage | GPUBufferUsage.COPY_DST
        });
        if (data.byteLength) device.queue.writeBuffer(buffer, 0, data);
        return buffer;
      };
      const zero = (bytes, usage) => device.createBuffer({
        size: Math.max(4, bytes),
        usage
      });

      // params: matches PhaseTransferParams field order.
      const params = new ArrayBuffer(64);
      const view = new DataView(params);
      view.setUint32(0, 4, true);      // particle_count
      view.setUint32(4, 1, true);      // lineage_capacity
      view.setUint32(8, 4, true);      // phase_lane_count
      view.setUint32(12, 1, true);     // phase_lane_stride
      view.setUint32(16, segmentCount, true);
      view.setUint32(20, 0, true);     // mechanics_record_count
      view.setUint32(24, 0, true);     // thermal_offset_vec4
      view.setUint32(28, 0, true);     // mechanics_offset_vec4
      view.setUint32(32, 254, true);   // reserved_status
      view.setFloat32(36, 1e-7, true);
      view.setFloat32(40, 2e-4, true); // relative_tolerance
      view.setFloat32(44, 1e-20, true);
      view.setUint32(48, recordCount, true);
      view.setUint32(52, materialOffsetVec4, true);
      // This fixture supplies genuine absolute pressures, so it declares the
      // authority the shader requires before it will shift any plateau.
      view.setUint32(56, 1, true);
      view.setFloat32(60, 0, true);

      const probeData = new Float32Array(probes);
      const outBytes = probeCount * 4 * 4;
      const outBuffer = zero(
        outBytes,
        GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
      );
      const readback = zero(
        outBytes,
        GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
      );

      const pipeline = await device.createComputePipelineAsync({
        layout: 'auto',
        compute: { module, entryPoint: 'probe' }
      });
      const S = GPUBufferUsage.STORAGE;
      const entries = [
        { binding: 3, resource: { buffer: storage(closure, S) } },
        { binding: 8, resource: { buffer: storage(new Uint8Array(params), GPUBufferUsage.UNIFORM) } },
        { binding: 9, resource: { buffer: storage(probeData, S) } },
        { binding: 10, resource: { buffer: outBuffer } }
      ];
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginComputePass();
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries
      }));
      pass.dispatchWorkgroups(probeCount);
      pass.end();
      encoder.copyBufferToBuffer(outBuffer, 0, readback, 0, outBytes);
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
      transferWgsl: sphPhaseCarrierTransferWgsl,
      segments: SEGMENTS,
      records: MATERIAL_RECORDS,
      probes: cases.flatMap((c) => [c.pressurePa, c.energy]),
      materialId: MATERIAL_ID
    });
  } finally {
    await browser.close();
  }

  assert.equal(native.status, 'ok', JSON.stringify(native).slice(0, 4000));
  assert.equal(native.validationError, null, JSON.stringify(native).slice(0, 4000));

  const read = (index) => {
    const [liquidFound, liquidU, gasFound, gasU] = native.results.slice(
      index * 4,
      index * 4 + 4
    );
    return { liquidFound, liquidU, gasFound, gasU };
  };

  // 0: reference pressure, energy on the reference plateau -> found, and the
  // endpoints are bitwise the packed reference values.
  const reference = read(0);
  assert.equal(reference.liquidFound, 1);
  assert.equal(reference.gasFound, 1);
  assert.equal(
    reference.liquidU,
    new Float32Array([PLATEAU_START_U])[0],
    'reference pressure must return the packed plateau start unchanged'
  );
  assert.equal(
    reference.gasU,
    new Float32Array([PLATEAU_END_U])[0],
    'reference pressure must return the packed plateau end unchanged'
  );

  // 1: reference pressure, energy below the reference plateau -> not boiling.
  assert.equal(read(1).liquidFound, 0);

  // 2: half an atmosphere, same energy -> now boiling, and the endpoints have
  // moved down to the shifted plateau.
  const low = read(2);
  assert.equal(
    low.liquidFound,
    1,
    'half an atmosphere must recognize the lowered plateau'
  );
  assert.equal(low.gasFound, 1);
  const lowTolerance = 1e-3 * LATENT_HEAT;
  assert.ok(
    Math.abs(low.liquidU - halfAtmosphere.start) <= lowTolerance,
    `lowered plateau start ${low.liquidU} vs ${halfAtmosphere.start}`
  );
  assert.ok(
    Math.abs(low.gasU - halfAtmosphere.end) <= lowTolerance,
    `lowered plateau end ${low.gasU} vs ${halfAtmosphere.end}`
  );
  assert.ok(
    low.liquidU < PLATEAU_START_U,
    'the lowered plateau must sit below the reference plateau'
  );
  // The latent span is a material property and must survive the shift.
  assert.ok(
    Math.abs((low.gasU - low.liquidU) - LATENT_HEAT) <= lowTolerance,
    `latent span must be preserved, got ${low.gasU - low.liquidU}`
  );

  // 3: two atmospheres, energy that boils at one -> no longer boiling.
  assert.equal(
    read(3).liquidFound,
    0,
    'raising the pressure must stop a marginally boiling particle from boiling'
  );

  // 4, 5: nonpositive pressure must fail the plateau closed, which here means
  // the transform does not apply and the untransformed reference ladder stands.
  // It must NOT silently behave as though the pressure were one atmosphere in
  // the shifted sense, and it must not produce a nonfinite endpoint.
  for (const index of [4, 5]) {
    const bad = read(index);
    assert.equal(bad.liquidFound, 1, `case ${index} must resolve on the reference ladder`);
    assert.equal(
      bad.liquidU,
      new Float32Array([PLATEAU_START_U])[0],
      `case ${index} must not shift the plateau on an invalid pressure`
    );
    assert.ok(Number.isFinite(bad.gasU), `case ${index} must stay finite`);
  }
});
