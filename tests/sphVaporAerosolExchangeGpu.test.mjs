import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runSphVaporAerosolExchangeCandidateGpu as run } from '../src/runtime/sph/sphVaporAerosolExchangeGpu.js';
import { createSphAerosolParcelFamilyWebGpu, acquireSphAerosolParcelRead,
  releaseSphAerosolParcelRead, releaseSphAerosolParcelFamily,
  sphAerosolParcelFamilyMatchesDevice } from '../src/runtime/sph/sphAerosolParcelGpu.js';
import { tagWebGpuBufferDevice, tagResidentProductMassDevice } from '../src/runtime/sph/sphGpuDeviceIdentity.js';
import { createResidentProductEventCountControlWords, registerResidentProductEventCountAuthority,
  productEventLiveCountCopyDescriptor, validateProductEventLiveCountCopyDescriptor,
  retireResidentProductEventCountAuthority, resolveResidentProductEventCountAuthority } from '../src/runtime/sph/sphResidentProductHistoryGpu.js';
import { SPH_VAPOR_AEROSOL_EXCHANGE_MAGIC as MAGIC,
  SPH_VAPOR_AEROSOL_EXCHANGE_VERSION as VERSION,
  SPH_VAPOR_AEROSOL_EXCHANGE_PARAM_OFFSETS as P } from '../ulg-gpu-abi/src/sphVaporAerosolExchange.js';

const tick = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

// Resource/queue double only. COPY really copies bytes, but successful kernel
// headers are fabricated. These tests assert ownership and host admission, NOT
// physical transfers; the separate native fixture executes the actual WGSL.
function fakeDevice() {
  const buffers = [], writes = [], commands = [], fences = [];
  let lose;
  const device = {
    buffers, writes, commands, failAllocate: null, failWrite: false, failSubmit: false,
    failMap: false, badHeader: null, gpuErrorBits: 0, fenceFailure: null,
    deferFences: false, mapGate: null, observeGate: null, failPipeline: false,
    lost: new Promise((resolve) => { lose = resolve; }),
    limits: { maxBufferSize: 2 ** 24, maxStorageBufferBindingSize: 2 ** 24,
      maxComputeWorkgroupsPerDimension: 65535 },
    createBuffer(descriptor) {
      if (descriptor.label === device.failAllocate) throw new Error('injected allocation failure');
      const value = { ...descriptor, bytes: new ArrayBuffer(descriptor.size), destroyed: 0, mapState: 'unmapped',
        destroy() { this.destroyed++; this.mapState = 'unmapped'; },
        async mapAsync() {
          if (this.label.endsWith('-verdict') && device.mapGate) await device.mapGate;
          if (this.label.endsWith('-observation') && device.observeGate) await device.observeGate;
          if (device.failMap) throw new Error('injected map failure');
          this.mapState = 'mapped';
        },
        getMappedRange() { return this.bytes; }, unmap() { this.mapState = 'unmapped'; } };
      buffers.push(value); return value;
    },
    createShaderModule: (value) => value, createBindGroupLayout: (value) => value,
    createPipelineLayout: (value) => value, createBindGroup: (value) => value,
    createComputePipeline(value) {
      if (device.failPipeline) throw new Error('injected pipeline failure');
      return value;
    },
    createCommandEncoder() {
      const list = [];
      return {
        clearBuffer: (...args) => list.push({ clear: args }),
        copyBufferToBuffer: (...args) => list.push({ copy: args }),
        beginComputePass() {
          const item = {}; list.push(item);
          return { setPipeline(pipeline) { item.entry = pipeline.compute.entryPoint; },
            setBindGroup(_slot, group) { item.group = group; },
            dispatchWorkgroups(...args) { item.dispatch = args; }, end() {} };
        }, finish: () => list
      };
    },
    queue: {
      writeBuffer(target, offset, data) {
        if (device.failWrite) throw new Error('injected write failure');
        const bytes = data instanceof ArrayBuffer ? new Uint8Array(data)
          : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        writes.push({ target, offset, bytes: bytes.slice() }); new Uint8Array(target.bytes).set(bytes, offset);
      },
      submit(lists) {
        if (device.failSubmit) throw new Error('injected submit failure');
        for (const list of lists) for (const item of list) {
          commands.push(item);
          if (item.clear) {
            const [target, offset = 0, size = target.size - offset] = item.clear;
            new Uint8Array(target.bytes, offset, size).fill(0);
          } else if (item.copy) {
            const [source, from, target, to, bytes] = item.copy;
            assert.equal(source.destroyed, 0, 'COPY must not consume retired source');
            new Uint8Array(target.bytes).set(new Uint8Array(source.bytes, from, bytes), to);
          } else if (item.entry === 'finalize_vapor_aerosol_exchange') {
            const binding = (index) => item.group.entries.find(({ binding: n }) => n === index).resource.buffer;
            const p = new Uint32Array(binding(0).bytes), src = new Uint32Array(binding(1).bytes);
            const out = new Uint32Array(binding(4).bytes), c = new Uint32Array(binding(6).bytes);
            const count = p[P.PRODUCT_COUNT_PRESENT] ? src[p[P.PRODUCT_COUNT_OFFSET] + 3] : 0;
            c.set([MAGIC, VERSION, device.gpuErrorBits ? 2 : 1, device.gpuErrorBits,
              p[P.EDGE_COUNT], device.gpuErrorBits ? 0 : p[P.EDGE_COUNT], count,
              p[P.AEROSOL_CAPACITY], p[P.OUTPUT_COUNT_GENERATION], p[P.OUTPUT_COUNT_SEAL],
              p[P.EXPECTED_EOS_GENERATION], 0, 0, 0, 0, 0]);
            if (p[P.PRODUCT_COUNT_PRESENT]) {
              out.set(createResidentProductEventCountControlWords({
                status: device.gpuErrorBits ? 0x80000000 : 1, liveRowCount: count,
                rowCapacity: p[P.PRODUCT_CAPACITY], rowStrideVec4: 8,
                generation: p[P.OUTPUT_COUNT_GENERATION], seal: p[P.OUTPUT_COUNT_SEAL],
                error: device.gpuErrorBits }), p[P.PRODUCT_COUNT_OFFSET]);
            }
            device.badHeader?.(c);
          }
        }
      },
      onSubmittedWorkDone() {
        if (device.fenceFailure === 'throw') throw new Error('injected fence throw');
        if (device.fenceFailure === 'reject') return Promise.reject(new Error('injected fence rejection'));
        if (device.fenceFailure === 'missing') return null;
        return device.deferFences ? new Promise((resolve) => fences.push(resolve)) : Promise.resolve();
      }
    },
    async finishQueue() {
      for (let i = 0; i < 12; i++) { fences.splice(0).forEach((resolve) => resolve()); await tick(); }
    },
    async lose() { lose({ reason: 'destroyed' }); await tick(); }
  };
  return device;
}

function fixture({ historyPresent = true } = {}) {
  const device = fakeDevice();
  const make = (label, size) => tagWebGpuBufferDevice(device.createBuffer({ label, size, usage: 128 | 4 | 8 }), device);
  const family = createSphAerosolParcelFamilyWebGpu({ device, capacity: 1,
    parcels: [{ slot: 0, parcelId: 5n, nucleusPopulationId: 7n, physicalMultiplicity: 19n,
      sourceLineageIndex: 0xffffffff, sourceTopologyEpoch: 0,
      materialId: 9, phaseId: 2, positionM: [0, 0, 0], velocityMPerS: [1, 2, 3],
      massKg: 0.1, specificInternalEnergyJPerKg: -25, temperatureK: 300, condensedDensityKgM3: 1000 }],
    provenance: { kind: 'initial-conditions', reference: 'owner-test declared nuclei, no kernel physics claim' } });
  const aerosolRead = acquireSphAerosolParcelRead({ family, device, expectedGeneration: family.generation });
  let history = null, countDescriptor = null;
  if (historyPresent) {
    const productEventBuffer = make('source-product', 2 * 128), count = make('source-count', 512);
    history = tagResidentProductMassDevice({ productEventBuffer, productEventRowCount: 2,
      productEventStrideFloats: 32, productEventStrideBytes: 128, productEventBufferByteLength: 256 }, device);
    device.queue.writeBuffer(count, 256, createResidentProductEventCountControlWords({
      liveRowCount: 1, rowCapacity: 2, rowStrideVec4: 8, generation: 4, seal: 6 }));
    registerResidentProductEventCountAuthority(history, { device, controlBuffer: count,
      controlOffsetBytes: 256, rowCapacity: 2, rowStrideFloats: 32, generation: 4, seal: 6 });
    countDescriptor = productEventLiveCountCopyDescriptor(history, device);
    new Float32Array(productEventBuffer.bytes).set([2, 3, 4, 0.125]);
  }
  const options = { device, particleCount: 2, compactCapacity: 4, cellCapacity: 2, executionGeneration: 17,
    sourceStateBuffer: make('source-state', 64), sourceThermoBuffer: make('source-thermo', 96),
    sourceMechanicsBuffer: make('source-mechanics', 256), eosControlBuffer: make('source-eos', 144),
    compactRowsBuffer: make('source-compact', 256), caloricRowsBuffer: make('source-caloric', 64),
    residentProductMass: history, productEventLiveCountDescriptor: countDescriptor, aerosolRead,
    materialRows: new Float32Array([9, 0.018, -10, 1000, -20, 900, 200, 400, 1000, 0.1, -0.0001, 1, 5, 1.4, 1e6, 0]),
    edges: [{ gasKind: 0, gasIndex: 0, parcelIndex: 0, materialRow: 0, deltaMassKg: 0.01,
      transportEnthalpyCorrectionJ: 0, conductiveHeatJ: 1, pressureWorkIntoLiquidJ: 0 }] };
  new Float32Array(options.sourceStateBuffer.bytes).set([2, 3, 4, 0.125, 1, 2, 3, -8]);
  const sourceBuffers = [...device.buffers];
  return { options, device, family, sourceBuffers,
    async close() { releaseSphAerosolParcelRead(aerosolRead); releaseSphAerosolParcelFamily(family); await device.finishQueue(); } };
}

function owned(device) { return device.buffers.filter(({ label }) => label?.startsWith('ulg-vapor-aerosol-exchange-')); }

test('GPU source copies produce a separate candidate-only owner and actual typed output observations', async () => {
  const f = fixture(); await f.device.finishQueue();
  const source = f.options.sourceStateBuffer.bytes.slice(0), beforeWrites = f.device.writes.length;
  const result = await run(f.options);
  assert.equal(result.ready, true); assert.equal(result.readbackByteLength, 64); assert.equal(result.dispatchCount, 3);
  for (const flag of ['sourceAuthority', 'kineticsAdmitted', 'exchangeIntervalAdmitted', 'published',
    'residentAdopted', 'mechanicsContinuationAdmitted', 'outerPublicationAdmitted']) assert.equal(result[flag], false);
  assert.equal(result.pressureRequiresRefresh, true);
  assert.equal(sphAerosolParcelFamilyMatchesDevice(result, f.device), false);
  assert.notEqual(result.stateBuffer, f.options.sourceStateBuffer);
  assert.notEqual(result.productEventBuffer, f.options.residentProductMass.productEventBuffer);
  assert.notEqual(result.parcelBuffer, f.options.aerosolRead.buffer);
  assert.deepEqual(f.options.sourceStateBuffer.bytes, source);
  assert.deepEqual(f.device.writes.slice(beforeWrites).map(({ target }) => target.label.split('-').at(-1)), ['params', 'edges', 'materials']);
  const observations = await result.observe();
  assert.deepEqual(observations.stateValues, new Float32Array(source));
  assert.ok(observations.parcelWords instanceof Uint32Array);
  assert.equal(observations.surfaceValues.length, 4);
  assert.equal(observations.productCountWords[6], result.receipt.outputCountGeneration);
  assert.ok(result.receipt.outputCountGeneration > 4);
  assert.equal(result.residentProductMass.historicalProductionTotals, false);
  assert.equal('unplacedProductMassKg' in result.residentProductMass, false);
  assert.ok(validateProductEventLiveCountCopyDescriptor(result.productEventLiveCountDescriptor,
    { handle: result.residentProductMass, device: f.device }));
  assert.notEqual(result.productEventLiveCountDescriptor.authority, f.options.productEventLiveCountDescriptor.authority);
  assert.equal(result.productEventLiveCountDescriptor.hostObserved, false);
  const release = result.release(); assert.equal(result.release(), release); await release;
  assert.ok(owned(f.device).every(({ destroyed }) => destroyed === 1));
  assert.equal(f.options.sourceStateBuffer.destroyed, 0);
  assert.equal(f.options.residentProductMass.productEventBuffer.destroyed, 0);
  await assert.rejects(result.observe(), /released/); await f.close();
});

test('uniforms carry exact original count generation and seal with the full aligned source record', async () => {
  const f = fixture(), result = await run(f.options);
  const params = new Uint32Array(f.device.writes.find(({ target }) => target.label === 'ulg-vapor-aerosol-exchange-params').bytes.buffer);
  assert.equal(params[P.SOURCE_COUNT_GENERATION], f.options.productEventLiveCountDescriptor.expectedGeneration);
  assert.equal(params[P.SOURCE_COUNT_SEAL], f.options.productEventLiveCountDescriptor.expectedSeal);
  assert.ok(params.subarray(23).every((lane) => lane === 0));
  assert.equal(params[P.PRODUCT_COUNT_OFFSET] % 64, 0);
  const countCopy = f.device.commands.find(({ copy }) => copy?.[0] === f.options.productEventLiveCountDescriptor.controlBuffer).copy;
  assert.equal(countCopy[1], 256); assert.equal(countCopy[3], params[P.PRODUCT_COUNT_OFFSET] * 4);
  assert.equal(countCopy[4], 256);
  await result.release(); await f.close();
});

test('absent history stays exactly absent without a manufactured product-count authority', async () => {
  const f = fixture({ historyPresent: false }), result = await run(f.options);
  assert.equal(result.residentProductMass, null); assert.equal(result.productEventLiveCountDescriptor, null);
  assert.equal(result.productCapacity, 0);
  const params = new Uint32Array(f.device.writes.find(({ target }) => target.label === 'ulg-vapor-aerosol-exchange-params').bytes.buffer);
  assert.equal(params[P.SOURCE_COUNT_GENERATION], 0); assert.equal(params[P.SOURCE_COUNT_SEAL], 0);
  const observed = await result.observe(); assert.equal(observed.productEventValues, null);
  assert.equal(observed.productCountWords, null); await result.release(); await f.close();
});

test('prescribed edges and material rows are snapshotted before asynchronous receipt observation', async () => {
  const f = fixture(); let releaseMap;
  f.device.mapGate = new Promise((resolve) => { releaseMap = resolve; });
  const operation = run(f.options);
  f.options.edges[0].deltaMassKg = 100; f.options.materialRows[0] = 99;
  releaseMap(); const result = await operation;
  const edges = f.device.writes.find(({ target }) => target.label.endsWith('-edges'));
  const materials = f.device.writes.find(({ target }) => target.label.endsWith('-materials'));
  assert.equal(new Float32Array(edges.bytes.buffer)[4], Math.fround(0.01));
  assert.equal(new Float32Array(materials.bytes.buffer)[0], 9);
  await result.release(); await f.close();
});

for (const [name, mutate, pattern] of [
  ['copied parcel read', (o) => { o.aerosolRead = { ...o.aerosolRead }; }, /exact retained aerosol/i],
  ['released parcel read', (o) => { releaseSphAerosolParcelRead(o.aerosolRead); }, /exact retained aerosol/i],
  ['copied product count', (o) => { o.productEventLiveCountDescriptor = { ...o.productEventLiveCountDescriptor }; }, /exact full retained product/i],
  ['truncated product capacity', (o) => { o.residentProductMass.productEventRowCount = 1; }, /exact full retained product/i],
  ['foreign state device', (o) => { const d = fakeDevice(); o.sourceStateBuffer = tagWebGpuBufferDevice(d.createBuffer({ label: 'foreign', size: 64, usage: 132 }), d); }, /same-device/],
  ['missing COPY_SRC', (o) => { o.sourceStateBuffer.usage = 128; }, /usage/],
  ['short mechanics', (o) => { o.sourceMechanicsBuffer.size = 128; }, /capacity/],
  ['malformed material rows', (o) => { o.materialRows = new Float32Array(15); }, /material rows/],
  ['unknown packet mode', o => { o.transportPacketMode = 'rounded'; }, /packet mode/],
  ['rounded packets without exact inventory', o => { o.transportPacketMode = 'rounded-dyadic-53'; }, /exact inventory/],
  ['non-dyadic substeps', (o) => { o.rateSubsteps = 3; }, /power of two/],
  ['substeps without midpoint rates', (o) => { o.rateSubsteps = 2; }, /midpoint/],
  ['nonfinite edge', (o) => { o.edges[0].conductiveHeatJ = Infinity; }, /finite f32/],
  ['underflow edge', (o) => { o.edges[0].deltaMassKg = 1e-100; }, /finite f32/],
  ['overlapping gas and parcel', (o) => { o.edges.push({ ...o.edges[0] }); }, /disjoint/],
  ['out of range source', (o) => { o.edges[0].gasIndex = 2; }, /in-range/],
  ['edge accessor', (o) => { Object.defineProperty(o.edges[0], 'deltaMassKg', { get() { return 0.1; } }); }, /own data/],
  ['sparse edge list', (o) => { o.edges.length = 2; }, /required/]
]) test(`rejects ${name} before candidate allocations`, async () => {
  const f = fixture(); mutate(f.options);
  await assert.rejects(run(f.options), pattern); assert.equal(owned(f.device).length, 0); await f.close();
});

test('an already-issued product descriptor remains readable while its source count retires', async () => {
  const f = fixture(); retireResidentProductEventCountAuthority(f.options.residentProductMass);
  assert.equal(resolveResidentProductEventCountAuthority(f.options.residentProductMass, f.device), null);
  const result = await run(f.options); assert.equal(result.ready, true); await result.release(); await f.close();
});

test('heat-only edges share actual gas and parcel indices without changing the source-copy contract', async () => {
  const f = fixture();
  const heat = { ...f.options.edges[0], deltaMassKg: 0 };
  f.options.edges = [heat, { ...heat, gasIndex: 1 }, { ...heat, gasKind: 1 }];
  const result = await run(f.options);
  assert.equal(result.receipt.edgeCount, 3);
  const packed = f.device.writes.find(({ target }) => target.label.endsWith('-edges'));
  assert.equal(new Float32Array(packed.bytes.buffer)[4], 0);
  assert.equal(f.device.commands.filter((c) => c.entry === 'apply_vapor_aerosol_exchange').length, 1);
  await result.release(); await f.close();
});

for (const order of ['mass-first', 'heat-first']) test(`mixed mass/heat endpoint sharing rejects ${order}`, async () => {
  const f = fixture(), mass = f.options.edges[0], heat = { ...mass, deltaMassKg: 0 };
  f.options.edges = order === 'mass-first' ? [mass, heat] : [heat, mass];
  await assert.rejects(run(f.options), /disjoint/);
  assert.equal(owned(f.device).length, 0); await f.close();
});

for (const field of ['transportEnthalpyCorrectionJ', 'pressureWorkIntoLiquidJ']) {
  test(`heat-only ${field} is not an external energy lane`, async () => {
    const f = fixture(); Object.assign(f.options.edges[0], { deltaMassKg: 0, [field]: 1 });
    await assert.rejects(run(f.options), /Heat-only/); await f.close();
  });
}

test('a genuine retained parcel read can fork after family retirement and survive parent release during GPU work', async () => {
  const f = fixture(); let releaseMap;
  releaseSphAerosolParcelFamily(f.family);
  f.device.mapGate = new Promise((resolve) => { releaseMap = resolve; });
  const operation = run(f.options);
  releaseSphAerosolParcelRead(f.options.aerosolRead);
  await f.device.finishQueue();
  assert.equal(f.options.aerosolRead.buffer.destroyed, 0, 'independent source fork retains the retiring family');
  releaseMap(); const result = await operation;
  await f.device.finishQueue(); assert.equal(f.options.aerosolRead.buffer.destroyed, 1);
  assert.equal(result.parcelBuffer.destroyed, 0);
  await result.release(); await f.close();
});

test('history mutation while the header maps fails closed and cleans every candidate allocation', async () => {
  const f = fixture(); let releaseMap;
  f.device.mapGate = new Promise((resolve) => { releaseMap = resolve; });
  const operation = run(f.options);
  f.options.residentProductMass.productEventBuffer = f.options.sourceMechanicsBuffer;
  releaseMap(); await assert.rejects(operation, /source read changed/);
  assert.ok(owned(f.device).every(({ destroyed }) => destroyed === 1)); await f.close();
});

for (const field of ['productEventRowCount', 'productEventStrideFloats']) test(`history ${field} mutation after source copies is rejected`, async () => {
  const f = fixture(); let releaseMap;
  f.device.mapGate = new Promise((resolve) => { releaseMap = resolve; });
  const operation = run(f.options);
  f.options.residentProductMass[field]++;
  releaseMap(); await assert.rejects(operation, /source read changed/);
  assert.ok(owned(f.device).every(({ destroyed }) => destroyed === 1)); await f.close();
});

for (const name of ['source-arena', 'output-arena', 'params', 'edges', 'materials', 'control', 'surface',
  'verdict', 'candidate-state', 'candidate-thermo', 'candidate-mechanics', 'candidate-products', 'candidate-parcels', 'candidate-product-count']) {
  test(`allocation failure at ${name} retires every prior owned buffer`, async () => {
    const f = fixture(); f.device.failAllocate = `ulg-vapor-aerosol-exchange-${name}`;
    await assert.rejects(run(f.options), /allocation failure/);
    assert.ok(owned(f.device).every(({ destroyed }) => destroyed === 1));
    assert.equal(f.options.sourceStateBuffer.destroyed, 0); await f.close();
  });
}

for (const mode of ['pipeline', 'write', 'submit', 'map']) test(`${mode} failure cleans only owned candidate resources after confirmed completion`, async () => {
  const f = fixture(); await f.device.finishQueue();
  f.device[`fail${mode[0].toUpperCase()}${mode.slice(1)}`] = true;
  await assert.rejects(run(f.options), /injected/);
  assert.ok(owned(f.device).every(({ destroyed }) => destroyed === 1));
  assert.equal(f.options.sourceStateBuffer.destroyed, 0);
  f.device.failMap = false; f.device.failSubmit = false; f.device.failWrite = false;
  await f.close();
});

test('GPU failure rejects the whole candidate, retains diagnostics but publishes no output history authority', async () => {
  const f = fixture(); f.device.gpuErrorBits = 512;
  const result = await run(f.options); assert.equal(result.ready, false); assert.equal(result.receipt.errorBits, 512);
  assert.equal(result.residentProductMass, null); assert.equal(result.productEventLiveCountDescriptor, null);
  assert.equal((await result.observe()).controlWords[3], 512);
  await result.release(); await f.close();
});

for (const [name, mutate] of [
  ['magic', (h) => { h[0]++; }], ['generation', (h) => { h[8]++; }],
  ['EOS identity', (h) => { h[10]++; }], ['reserved tail', (h) => { h[15] = 1; }],
  ['accepted prefix', (h) => { h[5]--; }], ['product overflow', (h) => { h[6] = 3; }]
]) test(`a malformed ${name} header cannot become an owned admitted candidate`, async () => {
  const f = fixture(); f.device.badHeader = mutate;
  await assert.rejects(run(f.options), /Malformed/);
  assert.ok(owned(f.device).every(({ destroyed }) => destroyed === 1)); await f.close();
});

for (const mode of ['throw', 'reject', 'missing']) test(`unconfirmed ${mode} fence keeps the run and source hold pending until genuine device loss`, async () => {
  const f = fixture(); await f.device.finishQueue(); f.device.fenceFailure = mode;
  let settled = false;
  const operation = run(f.options).finally(() => { settled = true; });
  const rejection = assert.rejects(operation, /device lost/);
  await tick(); assert.equal(settled, false); assert.ok(owned(f.device).every(({ destroyed }) => destroyed === 0));
  await f.device.lose(); await rejection;
  assert.ok(owned(f.device).every(({ destroyed }) => destroyed === 1));
  assert.equal(f.options.sourceStateBuffer.destroyed, 0); await f.close();
});

test('device loss terminates a hung header map without returning unconfirmed source reads early', async () => {
  const f = fixture(); f.device.mapGate = new Promise(() => {});
  const operation = run(f.options), rejection = assert.rejects(operation, /device lost/);
  await tick(); await f.device.lose(); await rejection;
  assert.ok(owned(f.device).every(({ destroyed }) => destroyed === 1)); await f.close();
});

test('release waits for an active observation and cannot race another observation', async () => {
  const f = fixture(), result = await run(f.options); let releaseMap;
  f.device.observeGate = new Promise((resolve) => { releaseMap = resolve; });
  const observation = result.observe();
  await assert.rejects(result.observe(), /active observation/);
  let released = false; const release = result.release().then(() => { released = true; });
  await tick(); assert.equal(released, false); assert.equal(result.stateBuffer.destroyed, 0);
  releaseMap(); await observation; await release; assert.equal(result.stateBuffer.destroyed, 1); await f.close();
});

test('candidate history borrowing holds all paired outputs until its final drain', async () => {
  const f = fixture(), result = await run(f.options), history = result.residentProductMass;
  history.__ulgActiveBorrowCount = 1;
  let released = false; const release = result.release().then(() => { released = true; });
  await tick(); assert.equal(released, false); assert.equal(result.stateBuffer.destroyed, 0);
  history.__ulgActiveBorrowCount = 2; assert.equal(history.__ulgActiveBorrowCount, 1, 'no new borrow after release');
  assert.ok(validateProductEventLiveCountCopyDescriptor(result.productEventLiveCountDescriptor, { handle: history, device: f.device }));
  history.__ulgActiveBorrowCount = 0; await release;
  assert.equal(resolveResidentProductEventCountAuthority(history, f.device), null);
  assert.equal(result.productEventBuffer.destroyed, 1); await f.close();
});

test('a rejected observation fence quarantines observation and release until confirmed device loss', async () => {
  const f = fixture(), result = await run(f.options);
  f.device.fenceFailure = 'reject';
  let observed = false, released = false;
  const observation = result.observe().finally(() => { observed = true; });
  const rejection = assert.rejects(observation, /lost its device/);
  const release = result.release().then(() => { released = true; });
  await tick(); assert.equal(observed, false); assert.equal(released, false);
  assert.equal(result.stateBuffer.destroyed, 0);
  await f.device.lose(); await rejection; await release;
  assert.ok(owned(f.device).every(({ destroyed }) => destroyed === 1)); await f.close();
});

test('a missing final release fence cannot destroy candidate buffers before actual device loss', async () => {
  const f = fixture(), result = await run(f.options); f.device.fenceFailure = 'missing';
  let released = false; const release = result.release().then(() => { released = true; });
  await tick(); assert.equal(released, false); assert.equal(result.stateBuffer.destroyed, 0);
  await f.device.lose(); await release;
  assert.ok(owned(f.device).every(({ destroyed }) => destroyed === 1)); await f.close();
});

test('copied low-level owner cannot invoke lifecycle methods and retained observations are independent copies', async () => {
  const f = fixture(), result = await run(f.options);
  assert.throws(() => ({ ...result }).release(), /Exact/);
  await assert.rejects(({ ...result }).observe(), /Exact/);
  const first = await result.observe(); first.stateValues[0] = 999;
  assert.notEqual((await result.observe()).stateValues[0], 999);
  await result.release(); await f.close();
});
