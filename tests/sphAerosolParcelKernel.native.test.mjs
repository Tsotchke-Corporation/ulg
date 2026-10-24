import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SPH_AEROSOL_BUDGET_ERROR as ERROR,
  SPH_AEROSOL_BUDGET_MAGIC,
  SPH_AEROSOL_BUDGET_OFFSETS as B,
  SPH_AEROSOL_PARCEL_OFFSETS as P
} from '../ulg-gpu-abi/src/sphAerosolParcel.js';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_AEROSOL_KERNEL === '1';
const BASE_URL = process.env.ULG_AEROSOL_BASE_URL || 'https://fastbox.tail5c077c.ts.net:5173/';

test('native explicit aerosol inventory preserves physical u64 population and budgets actual carrier plus sparse parcel rows', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_AEROSOL_KERNEL=1 for native WebGPU',
  timeout: 180_000
}, async (t) => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: process.env.ULG_AEROSOL_CHROME || '/usr/bin/google-chrome',
    headless: process.env.ULG_AEROSOL_HEADLESS === '1',
    args: ['--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu', '--ignore-gpu-blocklist']
  });
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: false });
    await page.route(new URL(BASE_URL).href, (route) => route.fulfill({
      contentType: 'text/html', body: '<!doctype html><title>ULG aerosol inventory GPU proof</title>'
    }));
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const result = await page.evaluate(async () => {
      const started = performance.now();
      const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) throw new Error('Native WebGPU adapter unavailable');
      const device = await adapter.requestDevice();
      const uncaptured = [];
      device.addEventListener('uncapturederror', (event) => uncaptured.push(event.error.message));
      device.pushErrorScope('validation');
      device.pushErrorScope('internal');
      device.pushErrorScope('out-of-memory');
      const shaders = await import('/src/runtime/sph/sphAerosolParcelWgsl.js');
      const pipelines = {};
      for (const [key, code, entryPoint] of [
        ['init', shaders.sphAerosolParcelInitializeWgsl, 'initialize_aerosol'],
        ['partial', shaders.sphAerosolInventoryPartialsWgsl, 'inventory_partials'],
        ['final', shaders.sphAerosolInventoryFinalizeWgsl, 'inventory_finalize']
      ]) {
        const module = device.createShaderModule({ label: `aerosol-${key}-production`, code });
        const info = await module.getCompilationInfo();
        const errors = info.messages.filter((message) => message.type === 'error');
        if (errors.length) throw new Error(errors.map((error) => `${key}:${error.lineNum}: ${error.message}`).join('\n'));
        pipelines[key] = await device.createComputePipelineAsync({ layout: 'auto', compute: { module, entryPoint } });
      }
      const population = (1n << 40n) + 17n;
      const baseCarrier = () => [
        { mass: 2, position: [-1, 0, 1], velocity: [1, 0, 0], u: 100, temperature: 300, material: 9, phase: 2, density: 1000 },
        { mass: 3, position: [1, 2, -1], velocity: [0, -2, 1], u: 200, temperature: 400, material: 17, phase: 3, density: 1 }
      ];
      const parcel = (changes = {}) => ({ slot: 1, mass: 0.25, position: [2, 3, 4], velocity: [2, 1, -1],
        u: 50, temperature: 310, density: 1000, material: 9, phase: 2, n: population, id: 7n,
        nucleus: (1n << 40n) + 5n, ...changes });
      const samples = [];
      async function run(name, options = {}) {
        const resources = [];
        const carriers = options.carriers ?? baseCarrier();
        const inputs = options.parcels ?? [parcel()];
        const capacity = options.capacity ?? 5;
        const state = new Float32Array(Math.max(8, carriers.length * 8));
        let thermo = new Float32Array(Math.max(12, carriers.length * 12));
        carriers.forEach((row, index) => {
          state.set([...row.position, row.mass, ...row.velocity, row.u], index * 8);
          const fractions = row.fractions ?? [1, 2, 3, 4].map((phase) => Number(phase === row.phase));
          thermo.set([row.material, row.phase, row.temperature, row.density,
            ...fractions, 0.1, 100, 1, 0.05], index * 12);
        });
        const bytes = new ArrayBuffer(Math.max(1, capacity) * 96);
        const words = new Uint32Array(bytes), floats = new Float32Array(bytes);
        const set64 = (offset, number) => {
          words[offset] = Number(number & 0xffffffffn);
          words[offset + 1] = Number(number >> 32n);
        };
        for (const row of inputs) {
          const base = row.slot * 24;
          floats.set([...row.position, row.mass, ...row.velocity, row.u,
            row.temperature, row.density, 0, 0], base);
          words[base + 12] = row.material; words[base + 13] = row.phase;
          set64(base + 14, row.n); set64(base + 16, row.id);
          words[base + 18] = 0xffffffff; set64(base + 20, row.nucleus);
          words[base + 22] = 1; words[base + 23] = 1;
        }
        options.mutate?.({ state, thermo, words, floats });
        if (options.truncateThermo) thermo = thermo.subarray(0, thermo.length - 1);
        const particleCount = options.particleCount ?? carriers.length;
        const declaredCapacity = options.declaredCapacity ?? capacity;
        const partialCount = options.partialCount ?? Math.max(1, Math.ceil(Math.max(particleCount, declaredCapacity) / 32));
        const generation = options.generation ?? 0;
        const params = new Uint32Array([particleCount, declaredCapacity, partialCount, generation]);
        const initParams = new Uint32Array([0, declaredCapacity, 1, generation]);
        function buffer(label, values, usage) {
          const size = typeof values === 'number' ? values : values.byteLength;
          const created = device.createBuffer({ label: `${name}-${label}`, size: Math.max(4, size),
            usage: usage | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
          resources.push(created);
          if (typeof values !== 'number') device.queue.writeBuffer(created, 0, values);
          return created;
        }
        const stateBuffer = buffer('state', state, GPUBufferUsage.STORAGE);
        const thermoBuffer = buffer('thermo', thermo, GPUBufferUsage.STORAGE);
        const parcelBuffer = buffer('parcels', words, GPUBufferUsage.STORAGE);
        const paramsBuffer = buffer('params', params, GPUBufferUsage.UNIFORM);
        const initParamsBuffer = buffer('init-params', initParams, GPUBufferUsage.UNIFORM);
        const finalParams = params.slice();
        if (options.staleFinalGeneration) finalParams[3]++;
        const finalParamsBuffer = buffer('final-params', finalParams, GPUBufferUsage.UNIFORM);
        const partialBuffer = buffer('partials', Math.max(1, partialCount) * 160, GPUBufferUsage.STORAGE);
        const finalBuffer = buffer('final', new Uint32Array(40).fill(0xa5a5a5a5), GPUBufferUsage.STORAGE);
        const readback = device.createBuffer({
          size: 160 + parcelBuffer.size * 2 + stateBuffer.size + thermoBuffer.size,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        resources.push(readback);
        const encoder = device.createCommandEncoder();
        function dispatch(key, bound, counts) {
          const pipeline = pipelines[key];
          const group = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0),
            entries: bound.map((value, binding) => ({ binding, resource: { buffer: value } })) });
          const pass = encoder.beginComputePass();
          pass.setPipeline(pipeline); pass.setBindGroup(0, group);
          pass.dispatchWorkgroups(...counts); pass.end();
        }
        try {
          dispatch('init', [parcelBuffer, initParamsBuffer], options.initDispatch ?? [Math.max(1, Math.ceil(declaredCapacity / 64))]);
          if (options.staleRadius) {
            const stale = buffer('stale-radius', new Float32Array([10]), GPUBufferUsage.STORAGE);
            encoder.copyBufferToBuffer(stale, 0, parcelBuffer, 24 * 4 + 10 * 4, 4);
          }
          // Snapshot the exact initialized (or deliberately corrupted) input
          // immediately before reduction, not an earlier version of the row.
          encoder.copyBufferToBuffer(parcelBuffer, 0, readback, 160, parcelBuffer.size);
          dispatch('partial', [stateBuffer, thermoBuffer, parcelBuffer, partialBuffer, paramsBuffer],
            options.partialDispatch ?? [Math.max(1, partialCount)]);
          dispatch('final', [partialBuffer, finalBuffer, finalParamsBuffer], [1]);
          encoder.copyBufferToBuffer(finalBuffer, 0, readback, 0, 160);
          let offset = 160 + parcelBuffer.size;
          for (const source of [parcelBuffer, stateBuffer, thermoBuffer]) {
            encoder.copyBufferToBuffer(source, 0, readback, offset, source.size);
            offset += source.size;
          }
          device.queue.submit([encoder.finish()]);
          await readback.mapAsync(GPUMapMode.READ);
          const mapped = readback.getMappedRange();
          const packet = Array.from(new Uint32Array(mapped, 0, 40));
          const initialized = Array.from(new Uint32Array(mapped, 160, parcelBuffer.size / 4));
          const after = Array.from(new Uint32Array(mapped, 160 + parcelBuffer.size, parcelBuffer.size / 4));
          const sameBytes = (expected, byteOffset) => {
            const bytes = new Uint8Array(expected.buffer, expected.byteOffset, expected.byteLength);
            const actual = new Uint8Array(mapped, byteOffset, bytes.length);
            return bytes.every((value, index) => value === actual[index]);
          };
          const unchanged = sameBytes(state, 160 + parcelBuffer.size * 2)
            && sameBytes(thermo, 160 + parcelBuffer.size * 2 + stateBuffer.size)
            && initialized.every((value, index) => value === after[index]);
          readback.unmap();
          samples.push({ name, packet, initialized, unchanged });
        } finally {
          resources.forEach((value) => value.destroy());
        }
      }
      try {
        await run('reference');
        await run('empty', { carriers: [], parcels: [], capacity: 0 });
        await run('carrier-only', { parcels: [] });
        await run('parcel-only', { carriers: [] });
        await run('material-general', { parcels: [parcel({ material: 1234567 })] });
        await run('solid-parcel', { parcels: [parcel({ phase: 1 })] });
        const split = Array.from({ length: 4 }, (_, index) => {
          const n = population / 4n + (index === 3 ? population % 4n : 0n);
          return parcel({ slot: index * 17, id: BigInt(index + 10), n,
            mass: 0.25 * Number(n) / Number(population) });
        });
        await run('split', { parcels: split, capacity: 64 });
        await run('repartition', { parcels: split.map((row, index) => ({ ...row, slot: 95 - index * 19 })), capacity: 96 });
        await run('two-dimensional', { capacity: 128, parcels: [parcel({ slot: 97 })],
          initDispatch: [1, 2, 1], partialDispatch: [2, 2, 1] });
        await run('many-partials', { capacity: 1056, parcels: [parcel({ slot: 1055 })] });
        await run('signed-energy', { carriers: baseCarrier().map((row) => ({ ...row, u: -row.u })),
          parcels: [parcel({ u: -10 })] });
        await run('population-carry', { parcels: [parcel({ n: 0xfffffffen }), parcel({ slot: 34, id: 8n, n: 9n })], capacity: 64 });
        await run('population-overflow', { parcels: [parcel({ n: (1n << 64n) - 1n }), parcel({ slot: 34, id: 8n, n: 1n })], capacity: 64 });
        await run('small-mass-large-population', { carriers: [], parcels: [parcel({ mass: 1e-30, n: 10000000000000000000n })] });
        await run('numeric-overflow', { parcels: [parcel({ mass: 4, u: 3e38 })] });
        await run('signed-energy-shift', { carriers: baseCarrier().map((row) => ({ ...row, u: row.u - 1000 })),
          parcels: [parcel({ u: -950 })] });
        await run('mixed-carrier', { carriers: [{ ...baseCarrier()[0], fractions: [0, 0.25, 0.75, 0] }], parcels: [] });
        const parcelInvalid = {
          'zero-mass': ({ floats }) => { floats[24 + 3] = 0; },
          'negative-mass': ({ floats }) => { floats[24 + 3] = -1; },
          'nan-position': ({ floats }) => { floats[24] = NaN; },
          'infinite-energy': ({ floats }) => { floats[24 + 7] = Infinity; },
          'zero-temperature': ({ floats }) => { floats[24 + 8] = 0; },
          'zero-density': ({ floats }) => { floats[24 + 9] = 0; },
          'reserved': ({ words }) => { words[24 + 11] = 1; },
          'zero-material': ({ words }) => { words[24 + 12] = 0; },
          'gas-phase': ({ words }) => { words[24 + 13] = 3; },
          'zero-population': ({ words }) => { words[24 + 14] = words[24 + 15] = 0; },
          'zero-id': ({ words }) => { words[24 + 16] = words[24 + 17] = 0; },
          'carrier-origin': ({ words }) => { words[24 + 18] = 0; },
          'nonzero-epoch': ({ words }) => { words[24 + 19] = 1; },
          'zero-nucleus': ({ words }) => { words[24 + 20] = words[24 + 21] = 0; },
          'inactive-payload': ({ words }) => { words[24 + 22] = 0; },
          'unadmitted-source': ({ words }) => { words[24 + 23] = 2; }
        };
        for (const [name, mutate] of Object.entries(parcelInvalid)) await run(`parcel-invalid-${name}`, { mutate });
        const carrierInvalid = {
          'negative-mass': ({ state }) => { state[3] = -1; },
          'nan-mass': ({ state }) => { state[3] = NaN; },
          'infinite-energy': ({ state }) => { state[7] = Infinity; },
          'negative-fraction': ({ thermo }) => { thermo[4] = -1e-6; },
          'fraction-over-one': ({ thermo }) => { thermo[5] = 1.000001; },
          'fraction-sum': ({ thermo }) => { thermo[5] = 0.5; },
          'zero-temperature': ({ thermo }) => { thermo[2] = 0; },
          'fractional-material': ({ thermo }) => { thermo[0] = 9.5; },
          'unready': ({ thermo }) => { thermo[10] = 254; }
        };
        for (const [name, mutate] of Object.entries(carrierInvalid)) await run(`carrier-invalid-${name}`, { mutate });
        await run('stale-radius', { staleRadius: true });
        await run('short-thermo', { truncateThermo: true });
        await run('capacity-overrun', { declaredCapacity: 6 });
        await run('carrier-overrun', { particleCount: 3 });
        await run('partial-count-mismatch', { partialCount: 0 });
        await run('missing-partial-dispatch', { capacity: 64, partialDispatch: [1] });
        await run('stale-partial-generation', { staleFinalGeneration: true });
        const scoped = [];
        for (let index = 0; index < 3; index++) {
          const error = await device.popErrorScope();
          if (error) scoped.push(error.message);
        }
        return { samples, scoped, uncaptured, elapsedMs: performance.now() - started,
          adapter: { vendor: adapter.info.vendor, architecture: adapter.info.architecture,
            device: adapter.info.device, description: adapter.info.description } };
      } finally {
        device.destroy();
      }
    });
    t.diagnostic(JSON.stringify({ adapter: result.adapter, sampleCount: result.samples.length, elapsedMs: result.elapsedMs }));
    assert.deepEqual(result.scoped, []);
    assert.deepEqual(result.uncaptured, []);
    const byName = new Map(result.samples.map((sample) => [sample.name, sample]));
    const f = (sample, offset) => new Float32Array(Uint32Array.from(sample.packet).buffer)[offset];
    const population = (sample) => (BigInt(sample.packet[B.MULTIPLICITY_HI]) << 32n) | BigInt(sample.packet[B.MULTIPLICITY_LO]);
    const near = (actual, expected, relative = 3e-5, absolute = 1e-10) => {
      assert.ok(Math.abs(actual - expected) <= Math.max(absolute, Math.abs(expected) * relative), `${actual} != ${expected}`);
    };
    for (const sample of result.samples) {
      await t.test(`${sample.name}: production GPU packet and immutable reduction inputs`, () => {
        assert.equal(sample.unchanged, true);
        assert.equal(sample.packet[B.MAGIC], SPH_AEROSOL_BUDGET_MAGIC);
        assert.equal(sample.packet[B.VERSION], 0);
        assert.equal(sample.packet[B.RESERVED], 0);
        if (sample.name.startsWith('parcel-invalid-')) {
          assert.ok(sample.packet[B.ERROR_BITS] & ERROR.PARCEL_INVALID);
          assert.equal(sample.initialized[24 + P.STATUS], 255);
          assert.equal(sample.initialized[24 + P.RADIUS], 0);
        } else if (sample.name.startsWith('carrier-invalid-')) {
          assert.ok(sample.packet[B.ERROR_BITS] & ERROR.CARRIER_INVALID);
        } else if (sample.name === 'population-overflow') {
          assert.ok(sample.packet[B.ERROR_BITS] & ERROR.POPULATION_OVERFLOW);
        } else if (sample.name === 'numeric-overflow') {
          assert.ok(sample.packet[B.ERROR_BITS] & ERROR.NUMERIC_OVERFLOW);
        } else if (sample.name === 'stale-radius') {
          assert.ok(sample.packet[B.ERROR_BITS] & ERROR.PARCEL_INVALID);
        } else if (['short-thermo', 'capacity-overrun', 'carrier-overrun', 'partial-count-mismatch'].includes(sample.name)) {
          assert.ok(sample.packet[B.ERROR_BITS] & ERROR.LAYOUT);
        } else if (['missing-partial-dispatch', 'stale-partial-generation'].includes(sample.name)) {
          assert.ok(sample.packet[B.ERROR_BITS] & ERROR.PARTIAL_INVALID);
        } else {
          assert.equal(sample.packet[B.ERROR_BITS], 0);
        }
      });
    }
    await t.test('manufactured bulk plus independent parcel has the analytic combined extensive budget', () => {
      const reference = byName.get('reference');
      const expected = [5.25, 0, 2.25, 3, 0, 2.5, -5.75, 2.75, 812.5, 9.25, 821.75,
        0.25, 1.5, 6.75, 0, 1877.5, -1, 0, -1, 2, 3, 4, 300, 400, Math.sqrt(6), 0.00025];
      expected.forEach((value, index) => near(f(reference, index), value));
      assert.equal(reference.packet[B.LIVE_CARRIER_COUNT], 2);
      assert.equal(reference.packet[B.LIVE_PARCEL_COUNT], 1);
      const n = (1n << 40n) + 17n;
      assert.equal(population(reference), n);
      const radius = Math.cbrt(3 * 0.25 / (4 * Math.PI * 1000 * Number(n)));
      near(f(reference, B.MIN_RADIUS), radius, 3e-5, 1e-15);
      near(f(reference, B.MAX_RADIUS), radius, 3e-5, 1e-15);
      near(f(reference, B.AEROSOL_GEOMETRIC_CROSS_SECTION), Number(n) * Math.PI * radius * radius);
      for (let slot = 0; slot < 5; slot++) {
        if (slot !== 1) assert.deepEqual(reference.initialized.slice(slot * 24, (slot + 1) * 24), Array(24).fill(0));
      }
    });
    await t.test('physical population, radius, optical area and extensive budgets are invariant under parcel partition and sparse capacity', () => {
      const reference = byName.get('reference');
      for (const name of ['split', 'repartition', 'material-general', 'two-dimensional', 'many-partials']) {
        const sample = byName.get(name);
        assert.equal(population(sample), population(reference));
        for (let index = 0; index < 30; index++) near(f(sample, index), f(reference, index), 5e-5, 1e-12);
      }
      assert.equal(byName.get('split').packet[B.LIVE_PARCEL_COUNT], 4);
      assert.equal(byName.get('many-partials').packet[B.LIVE_PARCEL_COUNT], 1);
      assert.equal(population(byName.get('population-carry')), (1n << 32n) + 7n);
    });
    await t.test('signed energy references and condensed phase identity are preserved', () => {
      const signed = byName.get('signed-energy');
      near(f(signed, B.INTERNAL_ENERGY), -802.5);
      near(f(signed, B.TRANSLATIONAL_KINETIC_ENERGY), 9.25);
      near(f(signed, B.TRACKED_ENERGY), -793.25);
      near(f(byName.get('signed-energy-shift'), B.INTERNAL_ENERGY), 812.5 - 1000 * 5.25);
      near(f(byName.get('solid-parcel'), B.SOLID_MASS), 0.25);
      near(f(byName.get('solid-parcel'), B.LIQUID_MASS), 2);
      near(f(byName.get('mixed-carrier'), B.LIQUID_MASS), 0.5);
      near(f(byName.get('mixed-carrier'), B.GAS_MASS), 1.5);
    });
    await t.test('empty reservoirs have zero bounds and extreme valid multiplicity still derives a positive representable radius', () => {
      const empty = byName.get('empty');
      for (let index = 0; index < 35; index++) assert.equal(empty.packet[index], 0);
      const small = byName.get('small-mass-large-population');
      assert.equal(population(small), 10000000000000000000n);
      const expected = Math.cbrt(3 * Math.fround(1e-30) / (4 * Math.PI * 1000 * 1e19));
      near(f(small, B.MIN_RADIUS), expected, 5e-5, 1e-25);
      assert.ok(f(small, B.MIN_RADIUS) > 0);
    });
  } finally {
    await browser.close();
  }
});
