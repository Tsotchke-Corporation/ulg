// Native gate for honest finite walls (src/runtime/sph/sphFiniteWallStateGpu.js).
// Many invocations add known energies into the six faces through the same
// WGSL helper the thermal kernels use; the update pass must then move each
// face temperature by exactly (its summed energy) / C, record the cumulative
// energy, and clear the pending words. A second step adds more and repeats.
// It also checks the temperature copy into a params buffer, which is how the
// fluid and rigid thermal stages read the live face temperatures.
//
// Run: ULG_RUN_NATIVE_FINITE_WALL=1 node --test tests/sphFiniteWallState.native.test.mjs
// (HTTPS dev server on 5173; override with ULG_FINITE_WALL_BASE_URL.)
import assert from 'node:assert/strict';
import test from 'node:test';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_FINITE_WALL === '1';
const NATIVE_BASE_URL = process.env.ULG_FINITE_WALL_BASE_URL || 'https://127.0.0.1:5173/';

test('finite wall faces move by their summed exchanged energy over C', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_FINITE_WALL=1 to run on native WebGPU'
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: ['--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu', '--ignore-gpu-blocklist']
  });
  let out;
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.route(NATIVE_BASE_URL, route => route.fulfill({contentType:'text/html',body:'<title>Finite wall native gate</title>'}));
    await page.goto(NATIVE_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForFunction(async () => Boolean(await navigator.gpu?.requestAdapter({powerPreference:'high-performance'})),
      null, {timeout:10_000,polling:250});
    out = await page.evaluate(async () => {
      const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) return { status: 'unsupported' };
      const device = await adapter.requestDevice();
      device.pushErrorScope('validation');
      const walls = await import('/src/runtime/sph/sphFiniteWallStateGpu.js');
      const env = await import('/src/runtime/thermalEnvironmentAuthority.js');
      const faces = { xMin: 230, xMax: 240, yMin: 250, yMax: 260, zMin: 270, zMax: 280 };
      const authority = env.resolveSphWallReservoirAuthority({
        wallTemperaturesK: faces,
        wallModel: env.SPH_THERMAL_WALL_MODEL_FINITE,
        wallFaceHeatCapacitiesJPerK: env.sphWallFaceHeatCapacitiesJPerK({
          boxDimsM: [0.14, 0.14, 0.14], densityKgPerM3: 7874, specificHeatJPerKgK: 449, thicknessM: 0.002
        }),
        wallMaterial: 'fe',
        wallThicknessM: 0.002
      });
      const state = walls.sphFiniteWallStateFor(device, authority);
      const again = walls.sphFiniteWallStateFor(device, authority);
      // Invocation i adds (i % 7 - 2) * 0.5 J (both signs) to face i % 6.
      const N = 4096;
      const code = `@group(0) @binding(0) var<storage, read_write> wall: array<atomic<u32>>;
${walls.sphFiniteWallEnergyAddWgsl('wall')}
@compute @workgroup_size(64) fn add(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= ${N}u) { return; }
  finite_wall_energy_add(id.x % 6u, f32(i32(id.x % 7u) - 2) * 0.5);
}`;
      const module = device.createShaderModule({ code });
      const info = await module.getCompilationInfo();
      const errors = info.messages.filter(m => m.type === 'error').map(m => m.message);
      if (errors.length) return { status: 'compile-error', errors };
      const pipeline = device.createComputePipeline({ layout: 'auto', compute: { module, entryPoint: 'add' } });
      const group = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: state.buffer } }] });
      const params = device.createBuffer({ size: 144, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC });
      const read = async (buffer, size) => {
        const copy = device.createBuffer({ size, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
        const e = device.createCommandEncoder(); e.copyBufferToBuffer(buffer, 0, copy, 0, size);
        device.queue.submit([e.finish()]); await copy.mapAsync(GPUMapMode.READ);
        const bytes = copy.getMappedRange().slice(0); copy.unmap(); copy.destroy(); return bytes;
      };
      const snapshots = [];
      for (let step = 0; step < 2; step += 1) {
        const e = device.createCommandEncoder();
        const pass = e.beginComputePass(); pass.setPipeline(pipeline); pass.setBindGroup(0, group);
        pass.dispatchWorkgroups(N / 64); pass.end();
        state.encodeUpdate(e);
        state.encodeTemperatureCopy(e, params, 48);
        device.queue.submit([e.finish()]);
        snapshots.push({ wall: Array.from(new Float32Array(await read(state.buffer, 256))),
          words: Array.from(new Uint32Array(await read(state.buffer, 256))),
          params: Array.from(new Float32Array(await read(params, 144))) });
      }
      // Sub-ulp heating: 2000 steps of 0.04 J into a 63.6 kJ/K face is about
      // 6e-7 K per step, far below one f32 ulp at 293 K; the temperature must
      // still rise by the cumulative 80 J / C.
      const tinyAuthority = env.resolveSphWallReservoirAuthority({
        wallTemperaturesK: { xMin: 293.15, xMax: 293.15, yMin: 293.15, yMax: 293.15, zMin: 293.15, zMax: 293.15 },
        wallModel: env.SPH_THERMAL_WALL_MODEL_FINITE,
        wallFaceHeatCapacitiesJPerK: { xMin: 63637.67, xMax: 63637.67, yMin: 63637.67, yMax: 63637.67, zMin: 63637.67, zMax: 63637.67 }
      });
      const tiny = walls.sphFiniteWallStateFor(device, tinyAuthority);
      const tinyCode = `@group(0) @binding(0) var<storage, read_write> wall: array<atomic<u32>>;
${walls.sphFiniteWallEnergyAddWgsl('wall')}
@compute @workgroup_size(1) fn add() { finite_wall_energy_add(2u, 0.04); }`;
      const tinyModule = device.createShaderModule({ code: tinyCode });
      const tinyPipeline = device.createComputePipeline({ layout: 'auto', compute: { module: tinyModule, entryPoint: 'add' } });
      const tinyGroup = device.createBindGroup({ layout: tinyPipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: tiny.buffer } }] });
      for (let batch = 0; batch < 20; batch += 1) {
        const e = device.createCommandEncoder();
        for (let step = 0; step < 100; step += 1) {
          const pass = e.beginComputePass(); pass.setPipeline(tinyPipeline); pass.setBindGroup(0, tinyGroup);
          pass.dispatchWorkgroups(1); pass.end();
          tiny.encodeUpdate(e);
        }
        device.queue.submit([e.finish()]);
      }
      const tinyBytes = await read(tiny.buffer, 256);
      const tinyWall = Array.from(new Float32Array(tinyBytes));
      const tinyWords = Array.from(new Uint32Array(tinyBytes));
      const validation = await device.popErrorScope();
      const capacities = env.SPH_THERMAL_WALL_FACE_IDS.map(id => authority.faceHeatCapacitiesJPerK[id]);
      device.destroy();
      return { status: 'ran', sameState: state === again, validation: validation?.message ?? null,
        snapshots, capacities, initial: env.SPH_THERMAL_WALL_FACE_IDS.map(id => faces[id]), N, tinyWall, tinyWords };
    });
  } finally {
    await browser.close();
  }
  assert.equal(out.status, 'ran', JSON.stringify(out.errors ?? out.status));
  assert.equal(out.validation, null);
  assert.equal(out.sameState, true, 'one GPU state per wall instance');
  // Expected per-step face energy: sum over i with i % 6 == face of (i % 7 - 2) * 0.5.
  const perFace = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < out.N; i += 1) perFace[i % 6] += ((i % 7) - 2) * 0.5;
  for (let step = 0; step < 2; step += 1) {
    const { wall, words, params } = out.snapshots[step];
    for (let face = 0; face < 6; face += 1) {
      const energy = perFace[face] * (step + 1);
      const expectedT = out.initial[face] + energy / out.capacities[face];
      // f32: one rounding per update of T plus the CAS sums (exact for halves).
      assert.ok(Math.abs(wall[face] - expectedT) <= 4e-5, `step ${step} face ${face} T ${wall[face]} vs ${expectedT}`);
      assert.equal(wall[12 + face], 0, 'pending cleared by the update');
      assert.ok(Math.abs(wall[18 + face] - energy) <= 1e-3, `cumulative ${wall[18 + face]} vs ${energy}`);
      assert.equal(params[12 + face], wall[face], 'params carry the live face temperature');
    }
    assert.equal(words[26], step + 1, 'one update per step');
  }
  // Sub-ulp heating accumulates: 2000 x 0.04 J = 80 J into 63637.67 J/K.
  const tinyRise = 80 / 63637.67;
  // Exact cumulative energy: signed 64-bit microjoule quanta (lo at 48+face,
  // hi at 54+face). Each 0.04 J step is round(0.04 / 1e-6) = 40000 quanta.
  const quanta = out.tinyWords[54 + 2] * 2 ** 32 + out.tinyWords[48 + 2];
  console.log(JSON.stringify({ quanta, displayTotal: out.tinyWall[20], faceT: out.tinyWall[2] }));
  assert.equal(quanta, 2000 * 40000, 'the 64-bit total is exact');
  assert.ok(Math.abs(out.tinyWall[2] - (293.15 + tinyRise)) <= 4e-5,
    `tiny face T ${out.tinyWall[2]} vs ${293.15 + tinyRise}`);
  assert.ok(out.tinyWall[2] > Math.fround(293.15), 'the face warmed despite sub-ulp steps');
});
