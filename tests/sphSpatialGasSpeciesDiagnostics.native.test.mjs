import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SPH_SPATIAL_GAS_SPECIES_DIAGNOSTIC_MAGIC as MAGIC,
  SPH_SPATIAL_GAS_SPECIES_DIAGNOSTIC_OFFSETS as O,
  SPH_SPATIAL_GAS_SPECIES_DIAGNOSTIC_STATUS as S
} from '../src/runtime/sph/sphSpatialGasSpeciesDiagnosticsWgsl.js';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_SPATIAL_GAS_SPECIES === '1';
const BASE_URL = process.env.ULG_SPATIAL_GAS_SPECIES_BASE_URL
  || 'https://fastbox.tail5c077c.ts.net:5173/';

// These are manufactured packets for the production shader, not a CPU EOS or
// phase solver. Malformed authority cases deliberately bypass the host owner so
// the actual device gates are exercised. The EOS owner's native suite separately
// binds this shader to actual retained execution and observation/retirement.
test('native GPU species diagnostics preserve source authority and distinguish thermodynamic evidence', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_SPATIAL_GAS_SPECIES=1 for native WebGPU',
  timeout: 180_000
}, async (t) => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: process.env.ULG_SPATIAL_GAS_SPECIES_CHROME || '/usr/bin/google-chrome',
    headless: process.env.ULG_SPATIAL_GAS_SPECIES_HEADLESS === '1',
    args: [...(process.env.ULG_SPATIAL_GAS_SPECIES_HEADLESS === '1'
      ? [] : ['--ozone-platform=wayland']),
      '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu', '--ignore-gpu-blocklist']
  });
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: false });
    // Keep the test origin and real Vite modules, without launching a second
    // simulation on the same device alongside the manufactured GPU workload.
    await page.route(new URL(BASE_URL).href, (route) => route.fulfill({
      contentType: 'text/html', body: '<!doctype html><title>ULG species GPU diagnostics</title>'
    }));
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const result = await page.evaluate(async () => {
      const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) throw new Error('Native WebGPU adapter unavailable');
      const device = await adapter.requestDevice({ requiredLimits: { maxStorageBuffersPerShaderStage: 8 } });
      const uncaptured = [];
      device.addEventListener('uncapturederror', (event) => uncaptured.push(event.error.message));
      device.pushErrorScope('validation');
      device.pushErrorScope('internal');
      device.pushErrorScope('out-of-memory');
      const eos = await import('/src/runtime/sph/sphSpatialGasLedgerEosGpu.js');
      const diagnostic = await import('/src/runtime/sph/sphSpatialGasSpeciesDiagnosticsWgsl.js');
      const abi = await import('/ulg-gpu-abi/src/index.js');
      const shader = device.createShaderModule({
        label: 'species-diagnostic-production-shader-manufactured-test',
        code: eos.sphSpatialGasLedgerEosWgsl + diagnostic.sphSpatialGasSpeciesDiagnosticsWgsl
      });
      const compilation = await shader.getCompilationInfo();
      const errors = compilation.messages.filter((message) => message.type === 'error');
      if (errors.length) throw new Error(errors.map((error) => `${error.lineNum}:${error.message}`).join('\n'));
      const pipeline = await device.createComputePipelineAsync({
        layout: 'auto', compute: { module: shader, entryPoint: 'diagnose_species_cells' }
      });
      const geometry = abi.createSchroederQuadraticControlVolumeDescriptor({
        grid: { gridDims: [9, 9, 9], gridNodeCount: 729, gridShift: 2,
          gridSpacingM: 1, chartId: 0, selectedLevel: 0 },
        boxMinM: [0, 0, 0], boxMaxM: [2, 2, 2]
      });
      const particle = (material = 9, moles = 1, temperature = 300) => ({
        material, moles, temperature, provenance: -1
      });
      const product = (material = 9, moles = 1, temperature = 300) => ({
        material, moles, temperature, provenance: 17
      });
      const samples = [];
      async function run(name, options = {}) {
        const rows = options.rows ?? [particle(), particle(17, 3)];
        const capacity = options.capacity ?? 4;
        const cellCount = rows.length ? 1 : 0;
        const keys = 48;
        const offsets = keys + capacity * 5;
        const members = offsets + capacity + 1;
        const lookup = members + capacity;
        const directory = new Uint32Array(lookup + capacity);
        const d = directory;
        d.set([0x53534531, 1, 3, 23]);
        d[8] = 7;
        d[16] = rows.length; d[17] = capacity; d[18] = cellCount; d[19] = capacity;
        d[22] = d.length; d[25] = 5; d[26] = 5; d[27] = 2; d[28] = 48;
        d[29] = keys; d[30] = offsets; d[31] = members; d[32] = lookup;
        d[33] = 123; d[35] = 123; d[36] = 23; d[37] = rows.length;
        d[38] = cellCount; d[39] = 1; d[41] = 1;
        d[42] = 1; d[43] = 1; d[44] = 1; d[46] = 1;
        d.set([0, 0x80000000, 0x80000000, 0x80000000, 0x80000000], keys);
        d[offsets + 1] = rows.length;
        const compactStride = abi.SPH_SPATIAL_GAS_CANDIDATE_COMPACT_ROW_FLOATS;
        const compact = new Float32Array(capacity * compactStride);
        const products = new Float32Array(capacity * 32);
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          compact.set([0.25, 0.25, 0.25, row.material, 0.1, row.moles,
            row.temperature, row.supportVolume ?? 1e-8, row.provenance, i, 1, 1], i * compactStride);
          d[members + i] = options.permute ? rows.length - i - 1 : i;
          products[i * 32 + 4] = row.material;
          products[i * 32 + 5] = row.provenance;
          products[i * 32 + 10] = 1;
          products[i * 32 + 16] = Object.hasOwn(row, 'sourceTemperature')
            ? row.sourceTemperature : row.temperature;
          products[i * 32 + 18] = 1;
        }
        const authority = new Uint32Array(36);
        authority.set([0x53474133, eos.SPH_SPATIAL_GAS_AUTHORITY_CONTROL_VERSION,
          31 | (rows.length ? 0 : 32), 0, 19, 19, 7, capacity,
          rows.length, 23, cellCount, cellCount]);
        authority.set([1, 1, 1, 1, 1, 1, compactStride, 16, 12, cellCount,
          geometry.version, geometry.seal], 22);
        const pressure = new Float32Array(capacity * 12);
        pressure.set([0, 0, 0, 1, 0.5, 0.5, 0.5,
          options.totalPressure ?? 4800, 0, 0, 0, options.freeVolume ?? 0.5]);
        const paramsBytes = new ArrayBuffer(256);
        const p = new Uint32Array(paramsBytes);
        const pf = new Float32Array(paramsBytes);
        p.set([capacity, compactStride, 12, 23, d.length, capacity, keys, offsets,
          members, lookup, 0, 0x80000000]);
        pf[12] = 2; pf[13] = 1; pf[14] = 300;
        p.set([19, 31, 29, 23, 7, capacity, 4], 15);
        p.set(geometry.boundsWords, 22);
        p[34] = geometry.version; p[35] = geometry.seal; p[36] = 2;
        p.set([9, 9, 9, 729], 37);
        const records = options.records ?? [[9, 0, 1, 1, 0.5, 1, 100, 0.001]];
        const segments = options.segments ?? [[9, 2, 2, 3, 10, 100, 300, 300, 1000, 1, 1, 0]];
        const thermal = Float32Array.from([...records.flat(), ...segments.flat()]);
        const diagnosticBytes = new ArrayBuffer(32);
        const dp = new Uint32Array(diagnosticBytes);
        const df = new Float32Array(diagnosticBytes);
        df[0] = options.material ?? 9;
        dp.set([records.length, segments.length, records.length * 8, capacity, 32, capacity, 0], 1);
        options.mutate?.({ d, authority, pressure, compact, products, p, pf, dp, df, thermal,
          keys, offsets, members, lookup });
        const inputs = [
          [0, compact], [1, directory], [2, pressure], [3, new Uint8Array(paramsBytes)],
          [4, authority], [7, new Uint8Array(diagnosticBytes)], [8, thermal], [9, products]
        ];
        const buffers = [];
        const entries = inputs.map(([binding, values]) => {
          const bytes = new Uint8Array(values.buffer, values.byteOffset, values.byteLength);
          const buffer = device.createBuffer({ label: `${name}-input-${binding}`,
            size: Math.max(4, bytes.length),
            usage: (binding === 3 || binding === 7 ? GPUBufferUsage.UNIFORM : GPUBufferUsage.STORAGE)
              | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC });
          if (bytes.length) device.queue.writeBuffer(buffer, 0, bytes);
          buffers.push({ buffer, expected: bytes.slice() });
          return { binding, resource: { buffer } };
        });
        const output = device.createBuffer({ label: `${name}-diagnostic`, size: capacity * 128,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
        device.queue.writeBuffer(output, 0, new Uint32Array(capacity * 32).fill(0xa5a5a5a5));
        const readback = device.createBuffer({
          size: buffers.reduce((sum, { buffer }) => sum + buffer.size, output.size),
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginComputePass();
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, device.createBindGroup({ layout: pipeline.getBindGroupLayout(0),
          entries: [...entries, { binding: 10, resource: { buffer: output } }] }));
        pass.dispatchWorkgroups(...(options.dispatch ?? [Math.ceil(capacity / 64), 1, 1]));
        pass.end();
        encoder.copyBufferToBuffer(output, 0, readback, 0, output.size);
        let offset = output.size;
        for (const { buffer } of buffers) {
          encoder.copyBufferToBuffer(buffer, 0, readback, offset, buffer.size);
          offset += buffer.size;
        }
        device.queue.submit([encoder.finish()]);
        await readback.mapAsync(GPUMapMode.READ);
        const mapped = readback.getMappedRange();
        const packet = Array.from(new Uint32Array(mapped, 0, capacity * 32));
        offset = output.size;
        let unchanged = true;
        for (const { buffer, expected } of buffers) {
          const bytes = new Uint8Array(mapped, offset, expected.length);
          unchanged &&= expected.every((value, index) => value === bytes[index]);
          offset += buffer.size;
        }
        readback.unmap();
        readback.destroy(); output.destroy();
        buffers.forEach(({ buffer }) => buffer.destroy());
        samples.push({ name, packet, unchanged });
      }
      try {
        await run('reference');
        await run('other-species', { material: 17 });
        await run('split', { rows: [particle(9, 0.25), particle(17, 3), particle(9, 0.75)] });
        await run('permutation', { permute: true });
        await run('support-volume', { rows: [{ ...particle(), supportVolume: 500 }, particle(17, 3)] });
        await run('volume-double', { freeVolume: 1, totalPressure: 2400 });
        await run('mixed-cell', { rows: [particle(), particle(17, 3, 600)], totalPressure: 8400 });
        await run('mixed-species', { rows: [particle(), particle(9, 1, 600)], totalPressure: 3600 });
        await run('product', { rows: [product(), particle(17, 3)] });
        for (const [name, sourceTemperature] of [['nan', NaN], ['zero', 0], ['negative', -1], ['infinite', Infinity]]) {
          await run(`fallback-${name}`, { rows: [{ ...product(), sourceTemperature }, particle(17, 3)] });
        }
        await run('other-species-fallback', { rows: [particle(), { ...product(17, 3), sourceTemperature: 0 }] });
        await run('absent-species', { material: 23 });
        await run('empty', { rows: [] });
        await run('two-dimensional-dispatch', { capacity: 128, dispatch: [1, 2, 1] });
        await run('warmer', { rows: [particle(9, 1, 330)], totalPressure: 1320 });
        await run('cooler', { rows: [particle(9, 1, 270)], totalPressure: 1080 });
        const stale = {
          completion: ({ authority }) => { authority[5]--; },
          storage: ({ authority }) => { authority[6]++; },
          directory: ({ d }) => { d[3]++; },
          'geometry-seal': ({ p }) => { p[35]++; },
          'physical-error': ({ authority }) => { authority[3] = 1; },
          'missing-pressure-status': ({ authority }) => { authority[2] &= ~16; },
          'logical-count': ({ d }) => { d[18] = 5; },
          'directory-range': ({ p }) => { p[8] = 0xffffffff; },
          'volume-generation': ({ p }) => { p[18]++; },
          'invalid-free-volume': ({ pressure }) => { pressure[11] = 0; },
          'unready-pressure-row': ({ pressure }) => { pressure[3] = 0; }
        };
        for (const [name, mutate] of Object.entries(stale)) await run(`source-${name}`, { mutate });
        const invalid = {
          'member-range': ({ d, offsets }) => { d[offsets + 1] = 5; },
          'member-index': ({ d, members }) => { d[members] = 3; },
          'member-cell': ({ d, lookup }) => { d[lookup] = 1; },
          'negative-mass': ({ compact }) => { compact[4] = -1; },
          'fractional-material': ({ compact }) => { compact[3] = 9.5; },
          'invalid-temperature': ({ compact }) => { compact[6] = NaN; },
          'fractional-source-index': ({ compact }) => { compact[9] = 0.5; }
        };
        for (const [name, mutate] of Object.entries(invalid)) await run(name, { mutate });
        await run('particle-index', { mutate: ({ dp }) => { dp[6] = 0; } });
        const provenance = {
          temperature: ({ products }) => { products[16] = 400; },
          material: ({ products }) => { products[4] = 17; },
          term: ({ products }) => { products[5] = 9; },
          capacity: ({ dp }) => { dp[4] = 0; }
        };
        for (const [name, mutate] of Object.entries(provenance)) {
          await run(`product-${name}`, { rows: [product()], mutate });
        }
        await run('law-missing', { records: [], segments: [] });
        await run('law-duplicate', { records: [[9, 0, 1, 1, 0.5, 1, 100, 0.001], [9, 0, 1, 1, 0.5, 1, 100, 0.001]] });
        await run('law-ambiguous', { records: [[9, 0, 2, 1, 0.5, 1, 100, 0.001]],
          segments: [[9, 2, 2, 3, 10, 100, 300, 300, 1, 1, 1, 0], [9, 2, 2, 3, 100, 200, 400, 400, 1, 1, 1, 0]] });
        const invalidLaws = {
          reference: ({ thermal }) => { thermal[5] = 0; },
          beta: ({ thermal }) => { thermal[7] = 0; },
          pressure: ({ thermal }) => { thermal[6] = 0; },
          offset: ({ thermal }) => { thermal[1] = 1; },
          'fractional-offset': ({ thermal }) => { thermal[1] = 0.5; },
          'segment-material': ({ thermal }) => { thermal[8] = 17; },
          'segment-status': ({ thermal }) => { thermal[18] = 0; },
          'latent-span': ({ thermal }) => { thermal[13] = thermal[12]; },
          temperature: ({ thermal }) => { thermal[14] = 0; },
          'non-plateau-temperature': ({ thermal }) => { thermal[15] = 301; },
          packing: ({ dp }) => { dp[3]++; }
        };
        for (const [name, mutate] of Object.entries(invalidLaws)) await run(`law-${name}`, { mutate });
        await run('saturation-underflow', { rows: [particle(9, 1, 150)], totalPressure: 600,
          mutate: ({ thermal }) => { thermal[7] = 1e-7; } });
        await run('saturation-overflow', { rows: [particle(9, 1, 600)], totalPressure: 2400,
          mutate: ({ thermal }) => { thermal[7] = 1e-7; } });
        await run('ratio-overflow', { mutate: ({ thermal }) => { thermal[6] = 2e-38; } });
        await run('invalid-selection', { material: NaN });
        await run('zero-selection', { material: 0 });
        await run('fractional-selection', { material: 9.5 });
        const oom = await device.popErrorScope();
        const internal = await device.popErrorScope();
        const validation = await device.popErrorScope();
        return { samples, errors: [oom?.message, internal?.message, validation?.message, ...uncaptured].filter(Boolean) };
      } finally { device.destroy(); }
    });
    assert.deepEqual(result.errors, []);
    const cases = new Map(result.samples.map((sample) => [sample.name, sample]));
    const value = (name, offset) => new Float32Array(Uint32Array.from(cases.get(name).packet).buffer)[offset];
    const flags = (name) => cases.get(name).packet[O.STATUS_FLAGS];
    const has = (name, flag) => assert.equal(flags(name) & flag, flag, `${name}: flags ${flags(name)}`);
    const lacks = (name, flag) => assert.equal(flags(name) & flag, 0, `${name}: flags ${flags(name)}`);
    const near = (actual, expected, tolerance = 2e-5) => assert.ok(
      Math.abs(actual - expected) <= Math.max(1e-6, Math.abs(expected) * tolerance), `${actual} != ${expected}`);

    await t.test('all diagnostic dispatches leave every input byte unchanged and clear recycled tails', () => {
      for (const sample of result.samples) {
        assert.equal(sample.unchanged, true, sample.name);
        for (let row = 0; row < sample.packet.length / 32; row++) {
          assert.equal(sample.packet[row * 32 + O.MAGIC], MAGIC, sample.name);
          assert.equal(sample.packet[row * 32 + O.CELL_INDEX], row, sample.name);
          assert.deepEqual(sample.packet.slice(row * 32 + 23, row * 32 + 32), new Array(9).fill(0));
        }
      }
      assert.equal(cases.get('two-dimensional-dispatch').packet[64 * 32 + O.CELL_INDEX], 64);
    });
    await t.test('species pressure is R sum(nT) / true free volume, with exact material isolation', () => {
      has('reference', S.SATURATION_READY | S.CELL_ISOTHERMAL | S.SPECIES_PRESENT);
      assert.equal(value('reference', O.SPECIES_MOLES), 1);
      assert.equal(value('reference', O.SPECIES_MOLE_TEMPERATURE_K), 300);
      assert.equal(value('reference', O.SPECIES_PARTIAL_PRESSURE_PA), 1200);
      assert.equal(value('other-species', O.SPECIES_PARTIAL_PRESSURE_PA), 3600);
      assert.equal(value('reference', O.TOTAL_CELL_PRESSURE_PA), 4800);
      assert.equal(value('reference', O.FREE_VOLUME_M3), 0.5);
      assert.equal(value('reference', O.SATURATION_PRESSURE_PA), 100);
      assert.equal(value('reference', O.SUPERSATURATION_RATIO), 12);
      for (const name of ['split', 'permutation', 'support-volume', 'product']) {
        assert.equal(value(name, O.SPECIES_PARTIAL_PRESSURE_PA), 1200, name);
        assert.equal(value(name, O.SPECIES_MOLES), 1, name);
      }
      assert.equal(cases.get('product').packet[O.SPECIES_PRODUCT_ROW_COUNT], 1);
      assert.equal(cases.get('product').packet[O.SPECIES_PARTICLE_ROW_COUNT], 0);
      assert.equal(cases.get('split').packet[O.SPECIES_PARTICLE_ROW_COUNT], 2);
      assert.equal(value('volume-double', O.SPECIES_PARTIAL_PRESSURE_PA), 600);
    });
    await t.test('non-isothermal mixtures retain pressure contributions without asserting scalar equilibrium', () => {
      has('mixed-cell', S.PARTIAL_PRESSURE_READY | S.MIXED_CELL_TEMPERATURE | S.SPECIES_ISOTHERMAL);
      lacks('mixed-cell', S.SATURATION_READY | S.CELL_ISOTHERMAL);
      assert.equal(value('mixed-cell', O.SPECIES_PARTIAL_PRESSURE_PA), 1200);
      assert.notEqual(value('mixed-cell', O.SPECIES_PARTIAL_PRESSURE_PA), 8400 / 4);
      assert.equal(value('mixed-cell', O.CELL_MIN_TEMPERATURE_K), 300);
      assert.equal(value('mixed-cell', O.CELL_MAX_TEMPERATURE_K), 600);
      has('mixed-species', S.PARTIAL_PRESSURE_READY | S.MIXED_SPECIES_TEMPERATURE);
      lacks('mixed-species', S.SATURATION_READY | S.SPECIES_ISOTHERMAL);
      assert.equal(value('mixed-species', O.SPECIES_PARTIAL_PRESSURE_PA), 3600);
    });
    await t.test('original product temperature provenance distinguishes fallback from measured common temperature', () => {
      for (const name of ['fallback-nan', 'fallback-zero', 'fallback-negative', 'fallback-infinite', 'other-species-fallback']) {
        has(name, S.TEMPERATURE_FALLBACK | S.PARTIAL_PRESSURE_READY);
        lacks(name, S.SATURATION_READY | S.CELL_ISOTHERMAL);
        assert.equal(value(name, O.SPECIES_PARTIAL_PRESSURE_PA), 1200, name);
      }
    });
    await t.test('absent species and empty live prefixes retain explicit identities and no stale quantities', () => {
      has('absent-species', S.SPECIES_ABSENT | S.PARTIAL_PRESSURE_READY);
      lacks('absent-species', S.SPECIES_PRESENT);
      assert.equal(value('absent-species', O.SPECIES_MOLES), 0);
      assert.equal(value('absent-species', O.SPECIES_PARTIAL_PRESSURE_PA), 0);
      has('empty', S.SOURCE_READY | S.SOURCE_EMPTY | S.CELL_ABSENT);
      lacks('empty', S.PARTIAL_PRESSURE_READY | S.SATURATION_READY);
      assert.deepEqual(cases.get('empty').packet.slice(9, 32), new Array(23).fill(0));
    });
    for (const name of cases.keys()) {
      if (name.startsWith('source-')) await t.test(name, () => {
        has(name, S.SOURCE_UNAVAILABLE);
        lacks(name, S.PARTIAL_PRESSURE_READY | S.SATURATION_READY);
      });
      if (['member-range', 'member-index', 'member-cell', 'negative-mass', 'fractional-material', 'invalid-temperature', 'fractional-source-index'].includes(name)) {
        await t.test(name, () => {
          has(name, S.INVALID_MEMBER);
          lacks(name, S.PARTIAL_PRESSURE_READY | S.SATURATION_READY);
        });
      }
      if (['particle-index', 'product-temperature', 'product-material', 'product-term', 'product-capacity'].includes(name)) {
        await t.test(name, () => {
          has(name, S.PROVENANCE_INVALID);
          lacks(name, S.PARTIAL_PRESSURE_READY | S.SATURATION_READY);
        });
      }
      if (name.startsWith('law-')) await t.test(name, () => {
        has(name, S.LAW_UNAVAILABLE | S.PARTIAL_PRESSURE_READY);
        lacks(name, S.REDUCED_LAW_READY | S.SATURATION_READY);
        if (['law-duplicate', 'law-ambiguous'].includes(name)) has(name, S.LAW_AMBIGUOUS);
      });
    }
    await t.test('reduced plateau inverse follows its packed reference and explicit floating-point range', () => {
      near(value('warmer', O.LOG_SATURATION_OVER_REFERENCE), 10 / 33, 1e-5);
      near(value('warmer', O.SATURATION_PRESSURE_PA), 100 * Math.exp(10 / 33));
      near(value('cooler', O.SATURATION_PRESSURE_PA), 100 * Math.exp(-10 / 27));
      has('saturation-underflow', S.NUMERIC_UNDERFLOW | S.PARTIAL_PRESSURE_READY);
      has('saturation-overflow', S.NUMERIC_OVERFLOW | S.PARTIAL_PRESSURE_READY);
      has('ratio-overflow', S.NUMERIC_OVERFLOW | S.PARTIAL_PRESSURE_READY);
      for (const name of ['saturation-underflow', 'saturation-overflow', 'ratio-overflow']) lacks(name, S.SATURATION_READY);
      for (const name of ['invalid-selection', 'zero-selection', 'fractional-selection']) {
        has(name, S.PARAMETERS_INVALID);
        lacks(name, S.PARTIAL_PRESSURE_READY | S.SATURATION_READY);
      }
    });
  } finally { await browser.close(); }
});
