import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  createSphExactMassFormat, encodeSphExactMass, encodeSphExactMassUnits,
  decodeSphExactMass, projectSphExactMassF32Bits, SPH_EXACT_MASS_ERROR as E
} from '../ulg-gpu-abi/src/sphExactMassInventory.js';

const enabled = process.env.ULG_RUN_NATIVE_EXACT_MASS === '1';
const baseUrl = process.env.ULG_EXACT_MASS_BASE_URL || 'https://fastbox.tail5c077c.ts.net:5173/';
const sha = value => createHash('sha256').update(value).digest('hex');
const sourcePaths = ['ulg-gpu-abi/src/sphExactMassInventory.js',
  'src/runtime/sph/sphExactMassWgsl.js', 'src/runtime/sph/sphExactMassTransferWgsl.js',
  'src/runtime/sph/sphExactMassInventoryGpu.js', 'src/runtime/sph/sphExactMassParticleSeed.js',
  'src/runtime/sph/sphGpuBuffers.js', 'tests/sphExactMassInventory.native.test.mjs'];
sourcePaths.push('tests/fixtures/sphExactMassContinuationNative.js', 'src/runtime/sph/sphG2pGpuKernel.js',
  'src/runtime/sph/schroederHierarchyGpu.js', 'src/runtime/sph/schroederSpatialEpochTransaction.js',
  'src/runtime/sph/schroederSpatialSuccessorSourceFamily.js',
  'src/runtime/sph/sphMlsMpmGpuStep.js', 'src/runtime/sph/sphMlsMpmPostMechanicsClosure.js',
  'src/runtime/sph/sphThermalGpuKernel.js', 'src/runtime/sph/sphMechanicsRefreshGpuKernel.js');

function fixtures(format) {
  const mask = (1n << BigInt(format.wordCount * 32)) - 1n;
  const rows = [];
  const add = (name, a, b, packet, floatBits = 0x3f800000) => rows.push({ name, a, b, packet, floatBits });
  add('zero', 0n, 0n, 0n, 0);
  add('underflow', 0n, 1n, 1n, 0x80000000);
  add('overflow', mask, 1n, 0n, 0x7f800000);
  add('receiver-overflow-rolls-back-both', 1n, mask, 1n, 0x7fc00000);
  add('complete-depletion', 7n, 11n, 7n, 0xbf800000);
  add('smallest-f32-subnormal', 1n, 0n, 1n, 1);
  add('largest-f32-subnormal', mask, 0n, mask, 0x007fffff);
  add('smallest-normal', 3n, 1n, 1n, 0x00800000);
  add('largest-finite-f32', 0n, mask, 0n, 0x7f7fffff);
  for (let bit = 1; bit < format.wordCount * 32; bit++) {
    const value = 1n << BigInt(bit);
    add(`carry-borrow-${bit}`, value - 1n, 1n, 1n);
    add(`rounding-${bit}`, value + (value >> 24n) + 1n, value >> 1n, value >> 2n);
  }
  if (format.quantumExponent === -149 && format.wordCount === 9) {
    const units = number => decodeSphExactMass(encodeSphExactMass(number, format), format).coefficient;
    add('handoff-cross-binade', units(1.5), units(2 ** -10 + 2 ** -33), units(2 ** -10));
    add('sub-ulp-executed-packet', units(1.5), units(2 ** -10), units(2 ** -100));
    add('normal-round-tie-even', units(1 + 2 ** -24), 0n, 0n);
    add('normal-round-tie-odd', units(1 + 3 * 2 ** -24), 0n, 0n);
  }
  let seed = 0x97a8d13;
  const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0; };
  const randomMass = () => {
    let value = 0n;
    for (let i = 0; i < format.wordCount; i++) value = (value << 32n) | BigInt(random());
    return value;
  };
  for (let i = 0; i < 128; i++) add(`arbitrary-limbs-${i}`, randomMass(), randomMass(), randomMass(), random());
  const input = new Uint32Array(rows.length * (3 * format.wordCount + 1));
  for (const [i, row] of rows.entries()) {
    let offset = i * (3 * format.wordCount + 1);
    for (const value of [row.a, row.b, row.packet]) {
      input.set(encodeSphExactMassUnits(value, format), offset); offset += format.wordCount;
    }
    input[offset] = row.floatBits;
  }
  return { rows, input, mask };
}

test('native integer mass arithmetic, exact transfers and projection preserve full stored inventory', {
  skip: !enabled && 'set ULG_RUN_NATIVE_EXACT_MASS=1 for owned desktop WebGPU', timeout: 180_000
}, async () => {
  const formats = [createSphExactMassFormat(),
    createSphExactMassFormat({ wordCount: 12, quantumExponent: -256 }),
    createSphExactMassFormat({ wordCount: 1, quantumExponent: 0 }),
    createSphExactMassFormat({ wordCount: 66, quantumExponent: -1074 })];
  const cases = formats.map(fixtures);
  const sources = await Promise.all(sourcePaths.map(async path => ({ path,
    sha256: sha(await readFile(new URL('../' + path, import.meta.url))) })));
  const evidence = { schema: 'ulg.native-exact-mass-arithmetic.v1', sources, started: new Date().toISOString(),
    headed: true, liveSimulationEnrollment: false, fullG2Acceptance: false, errors: [] };
  let browser, watchdog, failure;
  try {
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch({ executablePath: process.env.ULG_EXACT_MASS_CHROME || '/usr/bin/google-chrome',
      headless: false, args: ['--ozone-platform=wayland', '--use-angle=vulkan',
        '--enable-features=Vulkan,UseSkiaRenderer', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
    watchdog = setTimeout(() => { failure ??= new Error('Owned exact-mass browser timeout'); void browser.close(); }, 150_000);
    const page = await browser.newPage();
    page.on('pageerror', error => evidence.errors.push(String(error)));
    evidence.browserConsole = []; evidence.navigations = [];
    evidence.hotReloadMessages = []; evidence.failedRequests = [];
    page.on('websocket', socket => socket.on('framereceived', frame => evidence.hotReloadMessages.push(String(frame.payload))));
    page.on('response', response => { if (response.status() >= 400) evidence.failedRequests.push({ url: response.url(), status: response.status() }); });
    page.on('console', message => evidence.browserConsole.push({ type: message.type(), text: message.text() }));
    page.on('framenavigated', frame => { if (frame === page.mainFrame()) evidence.navigations.push(frame.url()); });
    await page.goto(new URL('package.json', baseUrl).href, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    // Development-server invalidations may reload the empty harness when a
    // newly imported cyclic module becomes reachable. Warm imports without a
    // GPU device; only the subsequent uninterrupted evaluation is evidence.
    for (let attempt = 0; ; attempt++) {
      try {
        await page.evaluate(async () => {
          const fixture = await import('/tests/fixtures/sphExactMassContinuationNative.js');
          await fixture.preloadExactMassContinuationNative();
        });
        break;
      } catch (error) {
        const observedReload = evidence.hotReloadMessages.some(message => message.includes('"type":"full-reload"'));
        if (attempt >= 1 || (!String(error).includes('Execution context was destroyed')
            && !(observedReload && String(error).includes('Failed to fetch')))) throw error;
        // Start a fresh document after the observed invalidation. Waiting for
        // the old document's load state can return before Vite navigates and
        // leave rejected module imports cached in the retry context.
        await page.goto(new URL('package.json', baseUrl).href, { waitUntil: 'networkidle', timeout: 60_000 });
      }
    }
    evidence.result = await page.evaluate(async ({ formats, inputs }) => {
      const url = '/src/runtime/sph/sphExactMassWgsl.js';
      const transformed = await (await fetch(url)).text();
      const dependency = [...transformed.matchAll(/from\s+['"]([^'"]+)['"]/g)]
        .map(match => match[1]).find(path => path.split('?')[0].endsWith('/sphExactMassInventory.js'));
      if (!dependency) throw new Error('Missing transformed exact-mass ABI dependency');
      const [shader, abi] = await Promise.all([import(url), import(dependency)]);
      const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) throw new Error('Native WebGPU adapter unavailable');
      const limits = await import('/src/runtime/webgpuDeviceLimits.js');
      const device = await adapter.requestDevice(limits.webGpuDeviceDescriptorForResidentSph(adapter) || {});
      const errors = [], results = [], transfers = [];
      let coldOwnership = null;
      let continuation = null;
      let spatialContinuation = null;
      device.addEventListener('uncapturederror', event => errors.push(event.error.message));
      for (const type of ['validation', 'internal', 'out-of-memory']) device.pushErrorScope(type);
      try {
        for (let f = 0; f < formats.length; f++) {
          const format = abi.createSphExactMassFormat(formats[f]), n = format.wordCount;
          const input = new Uint32Array(inputs[f]), count = input.length / (3 * n + 1), stride = 5 * n + 7;
          const code = shader.createSphExactMassWgsl(format) + `
@group(0) @binding(0) var<storage, read> input: array<u32>;
@group(0) @binding(1) var<storage, read_write> output: array<u32>;
@compute @workgroup_size(64)
fn exercise(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= ${count}u) { return; }
  let base = id.x * ${3 * n + 1}u; let out = id.x * ${stride}u;
  var a: ExactMass; var b: ExactMass; var packet: ExactMass;
  for (var i = 0u; i < EM_WORDS; i++) {
    a.words[i] = input[base + i]; b.words[i] = input[base + EM_WORDS + i];
    packet.words[i] = input[base + 2u * EM_WORDS + i];
  }
  let sum = em_add(a, b); let difference = em_subtract(a, b);
  let transfer = em_transfer(a, b, packet); let projection = em_project_f32_bits(a);
  let imported = em_from_f32_bits(input[base + 3u * EM_WORDS]);
  for (var i = 0u; i < EM_WORDS; i++) {
    output[out + i] = sum.value.words[i];
    output[out + ${n + 1}u + i] = difference.value.words[i];
    output[out + ${2 * n + 2}u + i] = transfer.donor.words[i];
    output[out + ${3 * n + 2}u + i] = transfer.receiver.words[i];
    output[out + ${4 * n + 6}u + i] = imported.value.words[i];
  }
  output[out + ${n}u] = sum.error; output[out + ${2 * n + 1}u] = difference.error;
  output[out + ${4 * n + 2}u] = transfer.error;
  output[out + ${4 * n + 3}u] = projection.bits; output[out + ${4 * n + 4}u] = projection.error;
  output[out + ${4 * n + 5}u] = bitcast<u32>(em_compare(a, b));
  output[out + ${5 * n + 6}u] = imported.error;
}`;
          const module = device.createShaderModule({ code });
          const compilation = await module.getCompilationInfo();
          const bad = compilation.messages.filter(message => message.type === 'error');
          if (bad.length) throw new Error(bad.map(message => `${message.lineNum}:${message.message}`).join('\n'));
          const pipeline = await device.createComputePipelineAsync({ layout: 'auto', compute: { module, entryPoint: 'exercise' } });
          const source = device.createBuffer({ size: input.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC });
          const output = device.createBuffer({ size: count * stride * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
          const readback = device.createBuffer({ size: output.size + source.size, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
          try {
            device.queue.writeBuffer(source, 0, input);
            const group = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries:
              [source, output].map((buffer, binding) => ({ binding, resource: { buffer } })) });
            const encoder = device.createCommandEncoder(), pass = encoder.beginComputePass();
            pass.setPipeline(pipeline); pass.setBindGroup(0, group); pass.dispatchWorkgroups(Math.ceil(count / 64)); pass.end();
            encoder.copyBufferToBuffer(output, 0, readback, 0, output.size);
            encoder.copyBufferToBuffer(source, 0, readback, output.size, source.size);
            device.queue.submit([encoder.finish()]);
            await readback.mapAsync(GPUMapMode.READ);
            const mapped = readback.getMappedRange();
            results.push({ words: Array.from(new Uint32Array(mapped, 0, output.size / 4)),
              sourceUnchanged: input.every((word, index) => word === new Uint32Array(mapped, output.size)[index]) });
            readback.unmap();
            await device.queue.onSubmittedWorkDone();
          } finally { source.destroy(); output.destroy(); readback.destroy(); }
        }
        const particleUrl = '/src/runtime/sph/sphGpuBuffers.js';
        const particleSource = await (await fetch(particleUrl)).text();
        const ownerUrl = [...particleSource.matchAll(/from\s+['"]([^'"]+)['"]/g)]
          .map(match => match[1]).find(path => path.split('?')[0].endsWith('/sphExactMassInventoryGpu.js'));
        if (!ownerUrl) throw new Error('Missing transformed particle numeric-owner dependency');
        // Follow Vite's exact URL, including its invalidation query. A bare
        // second import would create another private WeakMap authority.
        const owner = await import(ownerUrl);
        const identity = await import('/src/runtime/sph/sphGpuDeviceIdentity.js');
        const format = abi.createSphExactMassFormat();
        const initial = [1.5, 2 ** -10 + 2 ** -33, 0, 0];
        const families = [], reads = [];
        const create = massesKg => {
          const family = owner.createSphExactMassInventoryWebGpu({ device, format, massesKg,
            provenance: { kind: 'initial-conditions', reference: 'manufactured-native-exact-mass' } });
          families.push(family); return family;
        };
        const borrow = family => {
          const read = owner.acquireSphExactMassRead({ family, device }); reads.push(read); return read;
        };
        async function observe(read) {
          const result = device.createBuffer({ size: read.buffer.size, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
          try {
            const encoder = device.createCommandEncoder();
            encoder.copyBufferToBuffer(read.buffer, 0, result, 0, result.size);
            device.queue.submit([encoder.finish()]); await result.mapAsync(GPUMapMode.READ);
            const words = Array.from(new Uint32Array(result.getMappedRange()));
            result.unmap(); await device.queue.onSubmittedWorkDone(); return words;
          } finally { result.destroy(); }
        }
        async function transfer(name, read, graph, fault = null) {
          const words = new Uint32Array(graph.length * (format.wordCount + 2));
          graph.forEach(([donor, receiver, packet], index) => {
            const offset = index * (format.wordCount + 2);
            words.set([donor, receiver], offset); words.set(abi.encodeSphExactMass(packet, format), offset + 2);
          });
          const edgeBuffer = device.createBuffer({ size: words.byteLength, usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
          identity.tagWebGpuBufferDevice(edgeBuffer, device); device.queue.writeBuffer(edgeBuffer, 0, words);
          const before = await observe(read);
          const createBuffer = device.createBuffer, createEncoder = device.createCommandEncoder;
          let corrupt = null, candidate = null;
          if (fault) {
            corrupt = device.createBuffer({ size: 4, usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
            device.queue.writeBuffer(corrupt, 0, new Uint32Array([0x12345678]));
            device.createBuffer = function (descriptor) {
              const buffer = createBuffer.call(this, descriptor);
              if (descriptor.label === 'ulg-exact-mass-candidate') candidate = buffer;
              return buffer;
            };
            device.createCommandEncoder = function (...args) {
              const encoder = createEncoder.apply(this, args), begin = encoder.beginComputePass;
              let dispatch = 0;
              encoder.beginComputePass = function (...args) {
                dispatch++;
                if (dispatch === 2 && fault === 'stored-low-limb') this.copyBufferToBuffer(corrupt, 0, candidate, 0, 4);
                const pass = begin.apply(this, args);
                if (dispatch === 2 && fault === 'missing-validation') pass.dispatchWorkgroups = () => {};
                return pass;
              };
              return encoder;
            };
          }
          try {
            const result = await owner.runSphExactMassTransferCandidateWebGpu({ device, sourceRead: read, edgeBuffer,
              edgeCount: graph.length, edgeFormat: format });
            let nextRead = null;
            if (result.family) {
              if ('sourceFamily' in result.family.provenance
                  || typeof result.family.provenance.sourceFamilyId !== 'number') throw new Error('Unbounded predecessor lineage');
              families.push(result.family); nextRead = borrow(result.family);
            }
            transfers.push({ name, graph, before, sourceAfter: await observe(read), after: nextRead && await observe(nextRead),
              ready: result.ready, errorBits: result.errorBits, observedBytes: result.observedBytes,
              physicalPublicationAdmitted: result.physicalPublicationAdmitted, generation: result.generation });
            return nextRead;
          } catch (error) {
            if (fault !== 'missing-validation') throw error;
            transfers.push({ name, graph, before, sourceAfter: await observe(read), after: null,
              ready: false, failure: String(error), observedBytes: 64, physicalPublicationAdmitted: false });
            return null;
          } finally {
            device.createBuffer = createBuffer; device.createCommandEncoder = createEncoder;
            await device.queue.onSubmittedWorkDone(); corrupt?.destroy(); edgeBuffer.destroy();
          }
        }
        try {
          const firstFamily = create(initial), first = borrow(firstFamily);
          // A held read remains usable after its original owner requests retirement.
          owner.releaseSphExactMassInventory(firstFamily);
          const second = await transfer('cross-binade', first, [[0, 1, 2 ** -10]]);
          const third = await transfer('successor-spends-preserved-low-bit', second, [[1, 2, 2 ** -33]]);
          const graph = [[0, 1, 2 ** -100], [0, 2, 2 ** -100], [1, 2, 2 ** -110], [2, 1, 2 ** -110]];
          await transfer('shared-cancellation', third, graph);
          await transfer('shared-permuted', third, [...graph].reverse());
          await transfer('overspend', third, [[0, 1, 16]]);
          await transfer('alias', third, [[1, 1, 2 ** -33]]);
          await transfer('bad-endpoint', third, [[0, 4, 2 ** -33]]);
          const depleted = await transfer('complete-depletion-and-birth', third, [[1, 3, 2 ** -9]]);
          await transfer('zero-packet', depleted, [[1, 3, 0]]);
          const empty = borrow(create([0, 1, 0]));
          await transfer('incoming-cannot-finance-outgoing', empty, [[1, 0, 1], [0, 2, 1]]);
          const large = borrow(create([2 ** 138, 2 ** 138, 0, 2 ** 138]));
          await transfer('receiver-overflow', large, [[0, 1, 2 ** 138]]);
          await transfer('aggregate-outgoing-overflow', large, [[0, 2, 2 ** 138], [0, 2, 2 ** 138]]);
          await transfer('aggregate-incoming-overflow', large, [[0, 2, 2 ** 138], [1, 2, 2 ** 138], [3, 2, 2 ** 138]]);
          const ordinary = borrow(create([1, 1]));
          await transfer('reciprocal-overspend', ordinary, [[0, 1, 2], [1, 0, 2]]);
          await transfer('stored-low-limb-corruption', ordinary, [[0, 1, 2 ** -100]], 'stored-low-limb');
          await transfer('missing-validation', ordinary, [[0, 1, 2 ** -100]], 'missing-validation');
          let chain = ordinary;
          for (let i = 0; i < 32; i++) {
            const prior = chain;
            chain = await transfer('continuation-' + i, chain, [[i % 2, 1 - i % 2, 2 ** -110]]);
            await owner.releaseSphExactMassRead(prior); owner.releaseSphExactMassInventory(prior.family);
          }
          // Real cold particle uploader: the binary64 seed is captured before
          // S[3] rounding, and a physical-owner read pins both allocations.
          const particles = await import('/src/runtime/sph/sphGpuBuffers.js');
          const masses = [1 + 2 ** -30, 2 ** -10 + 2 ** -50, 0];
          const packed = particles.buildSphGpuParticleBuffers({ smoothingLengthM: .1, step: 0, time: 0,
            particles: masses.map((massKg, index) => ({ id: `cold-${index}`, material: 'unknown',
              massKg, x: [.1 * index, 0, 0], v: [0, 0, 0], specificInternalEnergyJPerKg: 0 }))
          }, { exactMass: { format, reference: 'native explicit initial particles' } });
          const upload = particles.uploadSphGpuParticleBuffers(device, packed);
          const held = particles.acquireSphParticleExactMassRead(upload, device);
          try {
            const source = await observe(held.read);
            const retirementDeferred = particles.destroySphGpuParticleBuffers(upload) === false;
            let newReadRejected = false;
            try { particles.acquireSphParticleExactMassRead(upload, device); }
            catch { newReadRejected = true; }
            await transfer('cold-uploader-hidden-packet', held.read, [[0, 2, 2 ** -30]]);
            coldOwnership = { masses, source, projections: masses.map((_, i) => packed.state[i * 8 + 3]),
              retirementDeferred, newReadRejected, physicalContinuationAdmitted: false };
          } finally {
            await particles.releaseSphParticleExactMassRead(held);
            await device.queue.onSubmittedWorkDone();
            coldOwnership && (coldOwnership.parentRetired = upload.destroyed === true);
            particles.destroySphGpuParticleBuffers(upload);
          }
          const fixture = await import('/tests/fixtures/sphExactMassContinuationNative.js');
          continuation = await fixture.runExactMassContinuationNative(device, format);
          spatialContinuation = await fixture.runExactMassContinuationNative(device, format, true);
        } finally {
          await Promise.all(reads.map(read => owner.releaseSphExactMassRead(read)));
          families.forEach(family => owner.releaseSphExactMassInventory(family));
          await device.queue.onSubmittedWorkDone();
        }
      } finally {
        await device.queue.onSubmittedWorkDone();
        for (const type of ['out-of-memory', 'internal', 'validation']) {
          const error = await device.popErrorScope(); if (error) errors.push(type + ': ' + error.message);
        }
        device.destroy();
      }
      return { results, transfers, coldOwnership, continuation, spatialContinuation, errors, adapter: { vendor: adapter.info?.vendor, architecture: adapter.info?.architecture,
        device: adapter.info?.device, description: adapter.info?.description } };
    }, { formats: formats.map(({ wordCount, quantumExponent }) => ({ wordCount, quantumExponent })),
      inputs: cases.map(fixture => [...fixture.input]) });
    assert.deepEqual(evidence.result.errors, []);
    assert.deepEqual(evidence.errors, []);
    for (const [index, format] of formats.entries()) {
      const { rows, mask } = cases[index], result = evidence.result.results[index], n = format.wordCount;
      assert.equal(result.sourceUnchanged, true);
      for (const [i, row] of rows.entries()) {
        const words = new Uint32Array(result.words.slice(i * (5 * n + 7), (i + 1) * (5 * n + 7)));
        const value = offset => decodeSphExactMass(words.subarray(offset, offset + n), format).coefficient;
        const sumError = row.a + row.b > mask ? E.OVERFLOW : 0;
        const subError = row.a < row.b ? E.UNDERFLOW : 0;
        const transferError = (row.a < row.packet ? E.UNDERFLOW : 0) | (row.b + row.packet > mask ? E.OVERFLOW : 0);
        assert.equal(words[n], sumError, row.name); assert.equal(value(0), sumError ? row.a : row.a + row.b, row.name);
        assert.equal(words[2 * n + 1], subError, row.name); assert.equal(value(n + 1), subError ? row.a : row.a - row.b, row.name);
        assert.equal(words[4 * n + 2], transferError, row.name);
        const donor = value(2 * n + 2), receiver = value(3 * n + 2);
        assert.equal(donor, transferError ? row.a : row.a - row.packet, row.name);
        assert.equal(receiver, transferError ? row.b : row.b + row.packet, row.name);
        assert.equal(donor + receiver, row.a + row.b, row.name + ' exact conserved total');
        const projection = projectSphExactMassF32Bits(encodeSphExactMassUnits(row.a, format), format);
        assert.equal(words[4 * n + 3], projection.bits, row.name); assert.equal(words[4 * n + 4], projection.error, row.name);
        assert.equal(words[4 * n + 5] | 0, row.a < row.b ? -1 : row.a > row.b ? 1 : 0, row.name);
        const raw = row.floatBits >>> 0;
        if (raw >= 0x7f800000) assert.equal(words[5 * n + 6], E.INVALID_FLOAT, row.name);
        else {
          const number = new Float32Array(new Uint32Array([raw]).buffer)[0];
          try {
            const expected = encodeSphExactMass(number, format);
            assert.equal(words[5 * n + 6], 0, row.name);
            assert.deepEqual(words.subarray(4 * n + 6, 5 * n + 6), expected, row.name);
          } catch (error) {
            if (error instanceof assert.AssertionError) throw error;
            assert.ok([E.INEXACT_INPUT, E.OVERFLOW].includes(words[5 * n + 6]), row.name);
          }
        }
      }
    }
    evidence.passedCases = cases.reduce((sum, fixture) => sum + fixture.rows.length, 0);
    const format = formats[0], n = format.wordCount;
    const units = words => {
      const values = [];
      for (let i = 0; i < words.length; i += n) values.push(decodeSphExactMass(new Uint32Array(words.slice(i, i + n)), format).coefficient);
      return values;
    };
    const successful = new Set(['cross-binade', 'successor-spends-preserved-low-bit', 'shared-cancellation',
      'shared-permuted', 'complete-depletion-and-birth', 'zero-packet', 'cold-uploader-hidden-packet']);
    for (const run of evidence.result.transfers) {
      assert.deepEqual(run.sourceAfter, run.before, run.name + ' source immutable');
      assert.equal(run.ready, successful.has(run.name) || run.name.startsWith('continuation-'), run.name);
      assert.equal(run.observedBytes, 64); assert.equal(run.physicalPublicationAdmitted, false);
      if (!run.ready) {
        assert.equal(run.after, null);
        if (run.name === 'missing-validation') assert.match(run.failure, /Malformed exact-mass transfer verdict/);
        else assert.notEqual(run.errorBits, 0);
        if (run.name === 'stored-low-limb-corruption') assert.equal(run.errorBits & 1024, 1024);
        continue;
      }
      const expected = units(run.before);
      for (const [donor, receiver, packet] of run.graph) {
        const amount = decodeSphExactMass(encodeSphExactMass(packet, format), format).coefficient;
        expected[donor] -= amount; expected[receiver] += amount;
      }
      assert.deepEqual(units(run.after), expected, run.name);
      assert.equal(units(run.after).reduce((a, b) => a + b, 0n), units(run.before).reduce((a, b) => a + b, 0n));
    }
    assert.deepEqual(evidence.result.transfers.find(run => run.name === 'shared-cancellation').after,
      evidence.result.transfers.find(run => run.name === 'shared-permuted').after);
    evidence.passedTransferCases = evidence.result.transfers.length;
    const cold = evidence.result.coldOwnership;
    assert.deepEqual(units(cold.source), cold.masses.map(mass => decodeSphExactMass(encodeSphExactMass(mass, format), format).coefficient));
    assert.deepEqual(cold.projections, cold.masses.map(Math.fround));
    assert.equal(cold.retirementDeferred, true); assert.equal(cold.newReadRejected, true);
    assert.equal(cold.parentRetired, true); assert.equal(cold.physicalContinuationAdmitted, false);
    evidence.coldParticleOwnershipPassed = true;
    const continuation = evidence.result.continuation;
    assert.equal(continuation.runs.length, 2);
    for (const run of continuation.runs) {
      assert.deepEqual(run.exact, Array.from(encodeSphExactMass(continuation.mass, format)));
      assert.equal(run.backend, 'webgpu'); assert.equal(run.inventoryGeneration, 0);
      assert.ok(run.state[0] > continuation.initialState[0], 'genuine G2P motion');
      assert.notEqual(run.thermo[2], continuation.initialThermo[2], 'genuine thermal change');
    }
    assert.equal(continuation.successorUsableAfterOriginalRetirement, true);
    evidence.twoStepPreservingContinuationPassed = true;
    const spatial = evidence.result.spatialContinuation;
    assert.equal(spatial.runs.length, 2);
    for (const run of spatial.runs) {
      assert.deepEqual(run.exact, Array.from(encodeSphExactMass(spatial.mass, format)));
      assert.ok(run.spatialFamilyStatus);
      assert.ok(run.finalEpochs);
      assert.ok(run.state[0] > spatial.initialState[0], 'actual SS G2P motion');
      assert.notEqual(run.thermo[2], spatial.initialThermo[2], 'actual SS thermal change');
    }
    assert.equal(spatial.successorUsableAfterOriginalRetirement, true);
    assert.equal(spatial.finalLeaseRetainedOwner, true);
    assert.equal(spatial.finalOwnerRetired, true);
    assert.deepEqual(spatial.exactAfterRetirementRequested, Array.from(encodeSphExactMass(spatial.mass, format)));
    evidence.twoStepSpatialContinuationPassed = true;
  } catch (error) { failure ??= error; evidence.failure = String(error.stack || error); }
  finally {
    clearTimeout(watchdog);
    if (browser) { await browser.close(); evidence.ownedBrowserClosed = !browser.isConnected(); }
    for (const source of sources) {
      try { assert.equal(sha(await readFile(new URL('../' + source.path, import.meta.url))), source.sha256); }
      catch (error) { failure ??= error; }
    }
    evidence.finished = new Date().toISOString();
    if (process.env.ULG_EXACT_MASS_EVIDENCE) await writeFile(process.env.ULG_EXACT_MASS_EVIDENCE, JSON.stringify(evidence, null, 2) + '\n');
  }
  if (failure) throw failure;
  assert.equal(evidence.ownedBrowserClosed, true);
});
