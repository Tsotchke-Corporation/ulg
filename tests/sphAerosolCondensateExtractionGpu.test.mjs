import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createSphAerosolParcelFamilyWebGpu, releaseSphAerosolParcelFamily,
  runSphAerosolCondensateExtractionWebGpu as prepare,
  adoptSphAerosolCondensateExtraction as adopt,
  discardSphAerosolCondensateExtraction as discard,
  releaseSphAerosolCondensatePair as releasePair
} from '../src/runtime/sph/sphAerosolParcelGpu.js';
import { createSchroederSpatialEpochTransaction } from '../src/runtime/sph/schroederSpatialEpochTransaction.js';
import { tagWebGpuBufferDevice, webGpuDeviceId } from '../src/runtime/sph/sphGpuDeviceIdentity.js';
import { ULG_MLS_MPM_MECHANICS_MATERIAL_TABLE_SCHEMA } from '../src/runtime/sph/sphMechanicsMaterialTable.js';

// Lifecycle/identity double ONLY. It fabricates a compact successful kernel
// receipt, not particle physics; the separate desktop-native test proves that.
function fakeDevice() {
  const buffers = [], submissions = [], fences = [];
  let lose;
  const device = {
    buffers, submissions, failAllocate: null, failSubmit: false, failMap: false,
    gpuErrorBits: 0, fenceFailure: null, deferFences: false, mapGate: null,
    lost: new Promise((resolve) => { lose = resolve; }),
    limits: { maxBufferSize: 2 ** 24, maxStorageBufferBindingSize: 2 ** 24,
      maxComputeWorkgroupsPerDimension: 65535 },
    createBuffer(descriptor) {
      if (device.failAllocate === descriptor.label) throw new Error('injected allocation failure');
      const buffer = { ...descriptor, bytes: new ArrayBuffer(descriptor.size), destroyed: 0,
        destroy() { this.destroyed++; },
        async mapAsync() { if (device.mapGate) await device.mapGate; if (device.failMap) throw new Error('injected map failure'); },
        getMappedRange() { return this.bytes; }, unmap() {} };
      buffers.push(buffer); return buffer;
    },
    createShaderModule: (args) => args, createBindGroupLayout: (args) => args,
    createPipelineLayout: (args) => args, createComputePipeline: (args) => args,
    createBindGroup: (args) => args,
    createCommandEncoder() {
      const commands = [];
      return { copyBufferToBuffer: (...args) => commands.push({ copy: args }),
        beginComputePass() {
          const command = {}; commands.push(command);
          return { setPipeline(pipeline) { command.entry = pipeline.compute.entryPoint; },
            setBindGroup(_index, group) { command.group = group; }, dispatchWorkgroups() {}, end() {} };
        }, finish: () => commands };
    },
    queue: {
      writeBuffer(buffer, offset, values) {
        const bytes = values instanceof ArrayBuffer ? new Uint8Array(values)
          : new Uint8Array(values.buffer, values.byteOffset, values.byteLength);
        new Uint8Array(buffer.bytes).set(bytes, offset);
      },
      submit(commandBuffers) {
        if (device.failSubmit) throw new Error('injected submit failure');
        submissions.push(commandBuffers);
        for (const commands of commandBuffers) for (const command of commands) {
          if (command.copy) {
            const [input, from, output, to, length] = command.copy;
            new Uint8Array(output.bytes).set(new Uint8Array(input.bytes, from, length), to);
          } else if (command.entry === 'propose_condensate' || command.entry === 'apply_condensate') {
            const scratchBinding = command.entry === 'propose_condensate' ? 6 : 0;
            const scratch = command.group.entries.find(({ binding }) => binding === scratchBinding).resource.buffer;
            const words = new Uint32Array(scratch.bytes);
            if (command.entry === 'propose_condensate') { words[2] = device.gpuErrorBits; words[3] = words[4]; }
            else if (words[2] === 0) words[11] = words[4];
          }
        }
      },
      onSubmittedWorkDone() {
        if (device.fenceFailure === 'throw') throw new Error('unconfirmed fence throw');
        if (device.fenceFailure === 'reject') return Promise.reject(new Error('unconfirmed fence reject'));
        return device.deferFences ? new Promise((resolve) => fences.push(resolve)) : Promise.resolve();
      }
    },
    async finishQueue() { while (fences.length) { fences.splice(0).forEach((resolve) => resolve()); await Promise.resolve(); } await Promise.resolve(); },
    async lose() { lose({ reason: 'destroyed' }); for (let i = 0; i < 8; i++) await Promise.resolve(); }
  };
  return device;
}

function fixture() {
  const device = fakeDevice();
  const make = (label, size = 4096) => tagWebGpuBufferDevice(device.createBuffer({ label, size, usage: 128 | 4 | 8 }), device);
  const epoch = { storageGeneration: 3, physicsTick: 11, physicsSubstep: 2,
    positionEpoch: 13, topologyEpoch: 5, chartEpoch: 1, levelEpoch: 4, supportEpoch: 6 };
  const activeNodeBuffer = make('active-node'), directoryBuffer = make('directory');
  const phaseCarrierPlan = { schema: 'peercompute.ulg.sph-phase-carrier-plan.v2', status: 'phase-lane-capacity-ready',
    lineageCapacity: 2, primaryCapacity: 2, phaseLaneCount: 4, phaseLaneStride: 2,
    companionStart: 2, companionCapacity: 6, particleCapacity: 8 };
  const generation = { ready: true, selected: true, directoryBuildCount: 1, privateLookupBuildCount: 0,
    source: { ready: true, activeNodeBuffer, ...epoch },
    execution: { submitPerformed: true, deviceId: webGpuDeviceId(device), generationId: 7,
      buildOrdinal: 7, sortUniqueOrdinal: 7, activeNodeBuffer, directoryBuffer, ...epoch } };
  const sphParticleUpload = { stateBuffer: make('prior-state'), thermoBuffer: make('prior-thermo'),
    identityBuffer: make('prior-identity'), particleCount: 8, phaseCarrierPlan, ...epoch };
  const mlsMpmParticleUpload = { mechanicsBuffer: make('prior-mechanics'), particleCount: 8, ...epoch };
  const transaction = createSchroederSpatialEpochTransaction({ device, generation, sphParticleUpload, mlsMpmParticleUpload });
  const sourceFamily = createSphAerosolParcelFamilyWebGpu({ device, capacity: 2,
    provenance: { kind: 'initial-conditions', reference: 'declared empty initial aerosol reservoir' } });
  return { device, sourceFamily, expectedGeneration: 0,
    sourceLineage: { transaction, generation, sphParticleUpload, mlsMpmParticleUpload },
    sourceStateBuffer: make('post-thermal-state'), sourceThermoBuffer: make('post-thermal-thermo'),
    sourceMechanicsBuffer: make('post-thermal-mechanics'),
    thermalMaterialTable: { records: new Float32Array([9, 0, 2, 1, 0, 1, 100, 0.001]),
      segments: new Float32Array([9, 1, 2, 2, -10, 10, 300, 400, 1000, 1000, 1, 0,
        9, 2, 2, 3, 10, 30, 400, 400, 1000, 1, 1, 0]) },
    mechanicsMaterialTable: { schema: ULG_MLS_MPM_MECHANICS_MATERIAL_TABLE_SCHEMA,
      phaseRecordCount: 2,
      records: new Float32Array([9, 2, 1000, 1, 0, 0, 1, 1, 0, 1, 0, 0,
        9, 3, 1, 1, 0, 0, 1, 2, 0, 1, 0, 0]) },
    absolutePressureAuthority: true,
    declarations: [{ lineageIndex: 0, parcelId: 100n, nucleusPopulationId: 200n, physicalMultiplicity: 2n ** 40n + 7n }],
    provenance: { kind: 'already-activated-condensate-population', reference: 'manufactured declared nuclei; no nucleation claim' } };
}

async function cleanup(options) { releaseSphAerosolParcelFamily(options.sourceFamily); await options.device.finishQueue(); }

function nextManufacturedLineage(options) {
  const { generation: previous, sphParticleUpload, mlsMpmParticleUpload } = options.sourceLineage;
  const ordinal = previous.execution.generationId + 1;
  const generation = { ...previous, source: { ...previous.source }, execution: { ...previous.execution,
    generationId: ordinal, buildOrdinal: ordinal, sortUniqueOrdinal: ordinal } };
  const transaction = createSchroederSpatialEpochTransaction({ device: options.device, generation, sphParticleUpload, mlsMpmParticleUpload });
  return { transaction, generation, sphParticleUpload, mlsMpmParticleUpload };
}

test('extraction has a private one-shot paired adoption, copied declarations, and only a64-byte observation', async () => {
  const options = fixture();
  const pending = prepare(options);
  options.declarations[0].physicalMultiplicity = 1n; options.provenance.reference = 'mutated';
  const candidate = await pending;
  assert.equal(candidate.readbackBytes, 64); assert.equal(candidate.dispatchCount, 2);
  assert.equal('aerosolFamily' in candidate, false); assert.equal('stateBuffer' in candidate, false);
  assert.throws(() => adopt({ ...candidate }), /exact unconsumed/);
  assert.throws(() => discard({ ...candidate }), /exact candidate/);
  const request = options.device.buffers.find(({ label }) => label === 'ulg-aerosol-extraction-declarations');
  assert.deepEqual([...new Uint32Array(request.bytes).slice(2, 4)], [7, 256]);
  const pair = adopt(candidate);
  assert.equal(pair.particleCount, 8); assert.equal(pair.sourceTopologyEpoch, 5);
  assert.equal(pair.aerosolFamily.generation, 1); assert.equal(pair.aerosolFamily.capacity, 3);
  assert.equal(pair.aerosolFamily.provenance.reference, 'manufactured declared nuclei; no nucleation claim');
  assert.equal(pair.gasVolumeAuthority, false); assert.equal(pair.opticalAuthority, false);
  assert.throws(() => adopt(candidate), /unconsumed/); assert.equal(discard(candidate), false);
  await assert.rejects(prepare(options), /already adopted/);
  await assert.rejects(prepare({ ...options, sourceFamily: pair.aerosolFamily, expectedGeneration: 1,
    sourceLineage: nextManufacturedLineage(options) }), /Replayed/);
  assert.throws(() => releasePair({ ...pair }), /exact owner/);
  assert.equal(releasePair(pair), true); assert.equal(releasePair(pair), false);
  await cleanup(options);
  assert.ok([pair.stateBuffer, pair.thermoBuffer, pair.mechanicsBuffer].every(({ destroyed }) => destroyed === 1));
  assert.equal(options.sourceStateBuffer.destroyed, 0, 'never retires caller input');
});

test('carrier debit cannot replay through a child, fresh aerosol owner, or second genuine transaction', async () => {
  const options = fixture(), pair = adopt(await prepare(options));
  const declarations = [{ lineageIndex: 0, parcelId: 999n, nucleusPopulationId: 998n, physicalMultiplicity: 100n }];
  await assert.rejects(prepare({ ...options, declarations, sourceFamily: pair.aerosolFamily, expectedGeneration: 1 }), /carrier source generation/);
  const fresh = createSphAerosolParcelFamilyWebGpu({ device: options.device, capacity: 2,
    provenance: { kind: 'initial-conditions', reference: 'another independent empty owner' } });
  await assert.rejects(prepare({ ...options, declarations, sourceFamily: fresh }), /carrier source generation/);
  const alternateTransaction = createSchroederSpatialEpochTransaction({ device: options.device, ...options.sourceLineage });
  assert.notEqual(alternateTransaction, options.sourceLineage.transaction);
  await assert.rejects(prepare({ ...options, declarations, sourceFamily: fresh,
    sourceLineage: { ...options.sourceLineage, transaction: alternateTransaction } }), /carrier source generation/);
  releasePair(pair); releaseSphAerosolParcelFamily(fresh); await cleanup(options);
});

for (const [name, mutate, pattern] of [
  ['cloned aerosol source', (o) => { o.sourceFamily = { ...o.sourceFamily }; }, /exact live/],
  ['stale generation', (o) => { o.expectedGeneration = 1; }, /stale/],
  ['cloned transaction', (o) => { o.sourceLineage.transaction = { ...o.sourceLineage.transaction }; }, /exact live SS/],
  ['changed prior thermo', (o) => { o.sourceLineage.sphParticleUpload.thermoBuffer = o.sourceThermoBuffer; }, /exact live SS/],
  ['wrong source epoch', (o) => { o.sourceLineage.sphParticleUpload.topologyEpoch++; }, /epochs/],
  ['retiring source generation', (o) => { o.sourceLineage.generation.releaseScheduled = true; }, /exact live SS/],
  ['invalid fixed lanes', (o) => { o.sourceLineage.sphParticleUpload.phaseCarrierPlan.phaseLaneCount = 1; }, /four-lane/],
  ['missing population', (o) => { delete o.declarations[0].physicalMultiplicity; }, /multiplicity/],
  ['approximate population', (o) => { o.declarations[0].physicalMultiplicity = 2 ** 60; }, /multiplicity/],
  ['overflowed population', (o) => { o.declarations[0].physicalMultiplicity = 2n ** 64n; }, /u64/],
  ['missing provenance', (o) => { o.provenance = null; }, /explicit/],
  ['repeated donor', (o) => { o.declarations.push({ ...o.declarations[0], parcelId: 101n, nucleusPopulationId: 201n }); }, /Duplicate/],
  ['out of range donor', (o) => { o.declarations[0].lineageIndex = 2; }, /lineage/],
  ['full capacity', (o) => { o.targetCapacity = 2; }, /capacity/],
  ['malformed table', (o) => { o.thermalMaterialTable.records = new Float32Array(7); }, /complete packed/]
]) test(`extraction rejects ${name} before GPU allocation`, async () => {
  const options = fixture(), original = options.sourceFamily;
  mutate(options);
  const before = options.device.buffers.length;
  await assert.rejects(prepare(options), pattern);
  assert.equal(options.device.buffers.length, before);
  releaseSphAerosolParcelFamily(original); await options.device.finishQueue();
});

test('pending candidate prevents forks; discard leaves source reusable without marking IDs consumed', async () => {
  const options = fixture();
  const candidate = await prepare(options);
  await assert.rejects(prepare(options), /pending/);
  assert.equal(discard(candidate), true); assert.equal(discard(candidate), false);
  await options.device.finishQueue();
  const retry = await prepare(options); const pair = adopt(retry); releasePair(pair); await cleanup(options);
});

test('source epoch changed while receipt maps cannot expose a paired candidate', async () => {
  const options = fixture(); let release;
  options.device.mapGate = new Promise((resolve) => { release = resolve; });
  const pending = prepare(options);
  options.sourceLineage.sphParticleUpload.topologyEpoch++;
  release(); await assert.rejects(pending, /epochs/); await cleanup(options);
  assert.ok(options.device.buffers.filter(({ label }) => label.startsWith('ulg-aerosol-extraction')).every(({ destroyed }) => destroyed === 1));
});

for (const mode of ['allocation', 'submit', 'map', 'gpu-rejection']) test(`extraction ${mode} failure retains original source and no consumed population`, async () => {
  const options = fixture(), device = options.device;
  if (mode === 'allocation') device.failAllocate = 'ulg-aerosol-extraction-proposals';
  if (mode === 'submit') device.failSubmit = true;
  if (mode === 'map') device.failMap = true;
  if (mode === 'gpu-rejection') device.gpuErrorBits = 64;
  await assert.rejects(prepare(options), /injected|rejected GPU/); await device.finishQueue();
  assert.equal(options.sourceStateBuffer.destroyed, 0);
  assert.ok(device.buffers.filter(({ label }) => label.startsWith('ulg-aerosol-extraction')).every(({ destroyed }) => destroyed === 1));
  device.failAllocate = null; device.failSubmit = false; device.failMap = false; device.gpuErrorBits = 0;
  const retry = await prepare(options); discard(retry); await cleanup(options);
});

for (const fenceFailure of ['throw', 'reject']) test(`failed map plus ${fenceFailure} fence quarantines until confirmed device loss`, async () => {
  const options = fixture(), device = options.device;
  await device.finishQueue(); device.failMap = true; device.fenceFailure = fenceFailure;
  await assert.rejects(prepare(options), /map failure/);
  await Promise.resolve();
  const outputs = device.buffers.filter(({ label }) => label.startsWith('ulg-aerosol-extraction'));
  assert.ok(outputs.every(({ destroyed }) => destroyed === 0));
  releaseSphAerosolParcelFamily(options.sourceFamily);
  assert.equal(device.buffers.find(({ label }) => label === 'ulg-aerosol-initial-population').destroyed, 0);
  await device.lose();
  assert.ok(outputs.every(({ destroyed }) => destroyed === 1));
  assert.equal(device.buffers.find(({ label }) => label === 'ulg-aerosol-initial-population').destroyed, 1);
});

test('device loss abandons a prepared candidate without exposing its aerosol half', async () => {
  const options = fixture(), candidate = await prepare(options);
  await options.device.lose(); await options.device.finishQueue();
  assert.throws(() => adopt(candidate), /unconsumed/);
  assert.ok(options.device.buffers.filter(({ label }) => label.startsWith('ulg-aerosol-extraction')).every(({ destroyed }) => destroyed === 1));
});

for (const scheduled of [false, true]) test(`confirmed loss retires an adopted pair${scheduled ? ' with an unconfirmed release fence' : ''}`, async () => {
  const options = fixture(), pair = adopt(await prepare(options));
  await options.device.finishQueue();
  if (scheduled) { options.device.fenceFailure = 'reject'; releasePair(pair); await Promise.resolve(); }
  const buffers = [pair.stateBuffer, pair.thermoBuffer, pair.mechanicsBuffer,
    options.device.buffers.find(({ label }) => label === 'ulg-aerosol-extraction-successor-parcels')];
  assert.ok(buffers.every(({ destroyed }) => destroyed === 0));
  await options.device.lose(); await options.device.finishQueue();
  assert.ok(buffers.every(({ destroyed }) => destroyed === 1));
  assert.equal(releasePair(pair), false);
});
