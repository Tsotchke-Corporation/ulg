import assert from 'node:assert/strict';
import test from 'node:test';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_SPLIT_SPARE_SCAN === '1';
const BASE_URL = process.env.ULG_SPLIT_SPARE_SCAN_BASE_URL || 'https://127.0.0.1:5173/';

test('split-spare lineage scan returns the ascending free lineages and a matching free-list row', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_SPLIT_SPARE_SCAN=1 to run on native WebGPU',
  timeout: 300_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true,
    args: ['--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
  let out;
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    out = await page.evaluate(async () => {
      const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) return { status: 'unsupported' };
      const device = await adapter.requestDevice();
      device.pushErrorScope('validation');
      const m = await import('/src/runtime/sph/schroederSplitSpareLineageScanGpu.js');
      const results = [];
      // Several shapes: one partial group, several groups, all free, none free.
      for (const { lineageCapacity, firstSpareLineage, spareCount, occupied } of [
        { lineageCapacity: 40, firstSpareLineage: 30, spareCount: 10, occupied: [1, 4, 9] },
        { lineageCapacity: 300, firstSpareLineage: 100, spareCount: 200, occupied: [0, 63, 64, 65, 127, 199] },
        { lineageCapacity: 70, firstSpareLineage: 0, spareCount: 70, occupied: [] },
        { lineageCapacity: 20, firstSpareLineage: 10, spareCount: 10, occupied: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] }
      ]) {
        const lanes = 4;
        const rows = lanes * lineageCapacity;
        const state = new Float32Array(rows * 8);
        const masses = new Array(rows).fill(0);
        // Live rows below the spare range carry mass in some lane.
        for (let lineage = 0; lineage < firstSpareLineage; lineage += 1) {
          masses[(lineage % lanes) * lineageCapacity + lineage] = 1e-3;
        }
        occupied.forEach((spare, k) => {
          const lane = k % lanes; // occupy different lanes, incl. companions
          masses[lane * lineageCapacity + firstSpareLineage + spare] = k === 2 ? Number.NaN : 2e-6;
        });
        masses.forEach((mass, row) => { state[row * 8 + 3] = mass; });
        const stateBuffer = device.createBuffer({ size: state.byteLength,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
        device.queue.writeBuffer(stateBuffer, 0, state);
        const scan = m.createSchroederSplitSpareLineageScan(device, { spareCount });
        const encoder = device.createCommandEncoder();
        m.encodeSchroederSplitSpareLineageScan(device, encoder, {
          scan, stateBuffer, lineageCapacity, laneCount: lanes, firstSpareLineage, epoch: 7
        });
        const readLineages = device.createBuffer({ size: scan.spareLineagesBuffer.size,
          usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
        const readFree = device.createBuffer({ size: scan.freeListBuffer.size,
          usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
        encoder.copyBufferToBuffer(scan.spareLineagesBuffer, 0, readLineages, 0, scan.spareLineagesBuffer.size);
        encoder.copyBufferToBuffer(scan.freeListBuffer, 0, readFree, 0, scan.freeListBuffer.size);
        device.queue.submit([encoder.finish()]);
        await readLineages.mapAsync(GPUMapMode.READ);
        await readFree.mapAsync(GPUMapMode.READ);
        const lineages = Array.from(new Uint32Array(readLineages.getMappedRange()).slice(0, spareCount));
        const freeList = Array.from(new Float32Array(readFree.getMappedRange()).slice(0, 8));
        // Manufactured state: the free spares are, by construction, every
        // spare the test did not occupy (a NaN-mass row counts as occupied).
        const taken = new Set(occupied);
        const expected = Array.from({ length: spareCount }, (_, spare) => spare)
          .filter((spare) => !taken.has(spare))
          .map((spare) => firstSpareLineage + spare);
        results.push({ lineages, freeList, expected, spareCount });
      }
      const error = await device.popErrorScope();
      return { status: 'ok', results, error: error ? String(error.message) : null };
    });
  } finally {
    await browser.close();
  }
  if (out.status === 'unsupported') return;
  assert.equal(out.error, null);
  for (const { lineages, freeList, expected, spareCount } of out.results) {
    assert.deepEqual(lineages.slice(0, expected.length), expected);
    assert.ok(lineages.slice(expected.length).every((value) => value === 0xffffffff));
    assert.deepEqual(freeList, [0, expected.length, expected.length, 8, 7, 0, 1, 0]);
    assert.ok(expected.length <= spareCount);
  }
});
