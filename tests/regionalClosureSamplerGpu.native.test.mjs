import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

// A3 on the GPU: representative homogeneous-region samples, conservative
// envelope expansion and bounded regional lookup; heterogeneity and envelope
// exits take scoped direct work; strict never extrapolates; identical inputs
// give bit-identical evidence. Every check is GPU-side (the sampler's own
// verify pass and fixed-size counters); the host only manufactures member
// states and reads evidence.
const RUN_NATIVE = process.env.ULG_RUN_NATIVE_A3_GPU === '1';
const BASE_URL = process.env.ULG_A3_GPU_BASE_URL || 'https://127.0.0.1:5173/';
const elements = JSON.parse(readFileSync(new URL('../data/material-properties/elements.json', import.meta.url), 'utf8'));
const M = 2 * elements.records.find((r) => r.symbol === 'N').atomicMassU * 1e-3;

test('A3 GPU sampler: bounded lookups, envelope exits, boundary adoption, strict replay', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_A3_GPU=1 to run on native WebGPU',
  timeout: 300_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true,
    args: ['--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
  let out;
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    out = await page.evaluate(async (molarMass) => {
      const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) return { status: 'unsupported' };
      const device = await adapter.requestDevice();
      device.pushErrorScope('validation');
      const m = await import('/src/runtime/material/regionalClosureSamplerGpu.js');
      // Ideal-gas N2 density rho(T, P) = P M / (R T): the "expensive" law.
      const generatorWgsl = `
const A3_M: f32 = ${molarMass};
const A3_R: f32 = 8.314462618;
fn a3_generator(x: vec3<f32>) -> f32 { return x.y * A3_M / (A3_R * x.x); }
fn a3_regime(x: vec3<f32>) -> u32 { return 0u; }`;
      const lcg = (seed) => () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
      const memberCapacity = 1024, regionCapacity = 4;
      const membersBuffer = device.createBuffer({ size: memberCapacity * 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
      const regionsOf = (specs, rand) => {
        const rows = [];
        specs.forEach(([T0, P0, spreadT, spreadP, n], region) => {
          for (let i = 0; i < n; i += 1) rows.push([T0 + spreadT * rand(), P0 + spreadP * rand(), 0, region]);
        });
        return rows;
      };
      const read = async (buffer, bytes) => {
        const staging = device.createBuffer({ size: bytes, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
        const encoder = device.createCommandEncoder();
        encoder.copyBufferToBuffer(buffer, 0, staging, 0, bytes);
        device.queue.submit([encoder.finish()]);
        await staging.mapAsync(GPUMapMode.READ);
        const words = new Uint32Array(staging.getMappedRange().slice(0));
        staging.unmap(); staging.destroy();
        return Array.from(words);
      };
      const make = (policy) => m.createRegionalClosureSamplerGpu(device, { generatorWgsl, axes: 2, regionCapacity, memberCapacity,
        degrees: [4, 1], tolerances: [2, 500], policy, relativeTolerance: 1e-5 });
      const evaluate = async (sampler, rows, regionCount) => {
        const data = new Float32Array(rows.length * 4);
        const ids = new Uint32Array(data.buffer);
        rows.forEach(([T, P, z, region], i) => { data[i * 4] = T; data[i * 4 + 1] = P; data[i * 4 + 2] = z; ids[i * 4 + 3] = region; });
        device.queue.writeBuffer(membersBuffer, 0, data);
        sampler.writeParams({ regionCount, memberCount: rows.length });
        const encoder = device.createCommandEncoder();
        m.encodeRegionalClosureEvaluate(encoder, sampler, { membersBuffer, regionCount, memberCount: rows.length });
        m.encodeRegionalClosureVerify(encoder, sampler, { membersBuffer, memberCount: rows.length });
        device.queue.submit([encoder.finish()]);
        return evidence(sampler, regionCount);
      };
      const boundary = async (sampler, regionCount) => {
        const encoder = device.createCommandEncoder();
        m.encodeRegionalClosureScheduleBoundary(encoder, sampler, { membersBuffer, regionCount });
        device.queue.submit([encoder.finish()]);
        return evidence(sampler, regionCount);
      };
      const evidence = async (sampler, regionCount) => {
        const control = await read(sampler.buffers.control, sampler.controlLayout.words * 4);
        const counters = Object.fromEntries(Object.entries(m.A3_GPU_COUNTER).map(([k, i]) => [k, control[i]]));
        const state = await read(sampler.buffers.regionState, regionCount * m.A3_GPU_STATE_WORDS * 4);
        const debt = control.slice(sampler.controlLayout.debtWord, sampler.controlLayout.debtWord + regionCount);
        const records = await read(sampler.buffers.table, (4 + regionCount * 16) * 4);
        const f32 = (u) => new Float32Array(new Uint32Array([u]).buffer)[0];
        const regions = Array.from({ length: regionCount }, (_, r) => ({
          accepted: state[r * 8], pending: state[r * 8 + 1], action: state[r * 8 + 2], debt: debt[r],
          bound: f32(records[4 + r * 16 + 11]) }));
        return { counters, regions, maxRelError: f32(counters.verifyMaxRelErrorBits), recordBits: records };
      };

      // 1. Homogeneous regions use bounded lookups; heterogeneous direct work.
      const s1 = make('async');
      const r1 = await evaluate(s1, regionsOf([[300, 1e5, 0.5, 100, 400], [320, 1.2e5, 1, 200, 400],
        [300, 1e5, 200, 5e4, 50]], lcg(11)), 3);

      // 2. Envelope exit: direct work and async debt; adoption only at the boundary.
      const s2 = make('async');
      const e0 = await evaluate(s2, regionsOf([[300, 1e5, 0.5, 100, 100]], lcg(5)), 1);
      const warmer = regionsOf([[301.6, 1e5, 0.5, 100, 100]], lcg(6));
      const e1 = await evaluate(s2, warmer, 1);
      const e2 = await evaluate(s2, warmer, 1);
      const e3 = await boundary(s2, 1);
      const e4 = await evaluate(s2, warmer, 1);

      // 3. Strict queues nothing; identical inputs replay bit-identically.
      const strictRun = async () => {
        const s = make('strict');
        await evaluate(s, regionsOf([[300, 1e5, 0.5, 100, 50]], lcg(9)), 1);
        await evaluate(s, regionsOf([[305, 1e5, 0.5, 100, 50]], lcg(10)), 1);
        await boundary(s, 1);
        return evaluate(s, regionsOf([[305, 1e5, 0.5, 100, 50]], lcg(10)), 1);
      };
      const strictA = await strictRun();
      const strictB = await strictRun();
      const error = await device.popErrorScope();
      return { status: 'ok', r1, e0, e1, e2, e3, e4, strictA, strictB, error: error ? String(error.message) : null };
    }, M);
  } finally {
    await browser.close();
  }
  if (out.status === 'unsupported') return;
  assert.equal(out.error, null);
  const { A3_GPU_ACTION: ACTION } = await import('../src/runtime/material/regionalClosureSamplerGpu.js');

  // 1. Two lookups, one direct region; every member within its bound.
  const { r1 } = out;
  assert.deepEqual(r1.regions.map((r) => r.action), [ACTION.LOOKUP, ACTION.LOOKUP, ACTION.DIRECT_HETEROGENEOUS]);
  assert.equal(r1.counters.lookups, 800);
  assert.equal(r1.counters.fits, 2);
  assert.equal(r1.counters.verifyMembers, 850);
  assert.equal(r1.counters.verifyViolations, 0, `max relative error ${r1.maxRelError}`);
  r1.regions.slice(0, 2).forEach((r) => assert.ok(r.bound > 0 && r.bound <= 1e-5, `bound ${r.bound}`));
  // Cost: two fits of 10 nodes + 45 held-out points, plus 50 direct members,
  // replace 850 exact evaluations.
  assert.equal(r1.counters.exactEvaluations, 2 * (10 + 45) + 50);
  console.log(JSON.stringify({ counters: r1.counters, bounds: r1.regions.map((r) => r.bound), maxRel: r1.maxRelError }));

  // 2. Exit -> debt and one pending fit; same schedule still debts; boundary adopts.
  const { e0, e1, e2, e3, e4 } = out;
  assert.equal(e0.regions[0].debt, 0);
  assert.equal(e1.regions[0].debt, 100);
  assert.equal(e1.regions[0].pending, 1);
  assert.equal(e1.counters.verifyViolations, 0);
  assert.equal(e2.regions[0].debt, 100, 'the expanded envelope is not live before the boundary');
  assert.equal(e2.counters.fits, e1.counters.fits, 'no second pending fit while one is queued');
  assert.equal(e3.counters.adoptions, 1);
  assert.equal(e3.regions[0].pending, 0);
  assert.equal(e4.regions[0].debt, 0);
  assert.equal(e4.regions[0].action, ACTION.LOOKUP);
  assert.equal(e4.counters.lookups - e2.counters.lookups, 100);
  assert.equal(e4.counters.verifyViolations, 0);

  // 3. Strict: no adoption, debt stays; bit-identical replay.
  const { strictA, strictB } = out;
  assert.equal(strictA.counters.adoptions, 0);
  assert.ok(strictA.counters.debt > 0);
  assert.equal(strictA.regions[0].debt, 50);
  assert.equal(strictA.counters.verifyViolations, 0);
  assert.deepEqual(strictA.counters, strictB.counters);
  assert.deepEqual(strictA.regions, strictB.regions);
  assert.deepEqual(strictA.recordBits, strictB.recordBits);
});
