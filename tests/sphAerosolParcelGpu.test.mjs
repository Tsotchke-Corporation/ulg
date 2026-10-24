import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createSphAerosolParcelFamilyWebGpu,
  releaseSphAerosolParcelFamily,
  createSphAerosolCombinedBudgetStage
} from '../src/runtime/sph/sphAerosolParcelGpu.js';
import {
  SPH_AEROSOL_BUDGET_MAGIC, SPH_AEROSOL_BUDGET_VERSION
} from '../ulg-gpu-abi/src/sphAerosolParcel.js';
import { runMlsMpmResidentSummaryWebGpu } from '../src/runtime/sph/sphMlsMpmGpuSummary.js';
import { ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA, ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA } from '../ulg-gpu-abi/src/index.js';

function fakeDevice({ failAllocation = 0, failSubmit = false } = {}) {
  const buffers = [], writes = [], fences = [], passes = [], copies = [];
  let allocation = 0, lose;
  const device = {
    buffers, writes, passes, copies, fenceFailure: null,
    lost: new Promise((resolve) => { lose = resolve; }),
    limits: { maxBufferSize: 2 ** 24, maxStorageBufferBindingSize: 2 ** 24 },
    createBuffer(descriptor) {
      if (++allocation === failAllocation) throw new Error('injected allocation failure');
      const buffer = { ...descriptor, destroyed: 0, destroy() { this.destroyed++; },
        mapAsync: async () => { throw new Error('injected map failure'); } };
      buffers.push(buffer); return buffer;
    },
    createShaderModule: (descriptor) => descriptor,
    createBindGroupLayout: (descriptor) => descriptor,
    createPipelineLayout: (descriptor) => descriptor,
    createComputePipeline: (descriptor) => descriptor,
    createBindGroup: (descriptor) => descriptor,
    createCommandEncoder() {
      return { beginComputePass() {
        const pass = { setPipeline: () => {}, setBindGroup: () => {},
          dispatchWorkgroups(x, y = 1) { passes.push(x * y); }, end: () => {} };
        return pass;
      }, copyBufferToBuffer: (...args) => copies.push(args), finish: () => ({}) };
    },
    queue: {
      writeBuffer(buffer, offset, data) {
        const bytes = data instanceof ArrayBuffer ? new Uint8Array(data)
          : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        writes.push({ buffer, offset, bytes: bytes.slice() });
      },
      submit() { if (failSubmit) throw new Error('injected submit failure'); },
      onSubmittedWorkDone() {
        if (device.fenceFailure === 'throw') throw new Error('unconfirmed fence throw');
        if (device.fenceFailure === 'reject') return Promise.reject(new Error('unconfirmed fence rejection'));
        return new Promise((resolve) => fences.push(resolve));
      }
    },
    async finishQueue() { while (fences.length) { fences.splice(0).forEach((resolve) => resolve()); await Promise.resolve(); } },
    async lose() { lose({ reason: 'destroyed' }); await Promise.resolve(); }
  };
  return device;
}

const parcel = (overrides = {}) => ({ slot: 2, parcelId: 1n, nucleusPopulationId: 11n,
  physicalMultiplicity: 2n ** 40n + 7n, sourceLineageIndex: 0xffffffff, sourceTopologyEpoch: 0,
  materialId: 9, phaseId: 2, positionM: [1, 2, 3], velocityMPerS: [0, 1, -1],
  massKg: 0.125, specificInternalEnergyJPerKg: -10, temperatureK: 300,
  condensedDensityKgM3: 1000, ...overrides });
const create = (device, overrides = {}) => createSphAerosolParcelFamilyWebGpu({ device,
  capacity: 4, parcels: [parcel()], provenance: { kind: 'initial-conditions', reference: 'manufactured population' },
  ...overrides });

function stageInputs(device, family) {
  const storage = (size) => device.createBuffer({ size, usage: 128 });
  return { device, sourceFamily: family, terminalFamily: family, particleCount: 1,
    sourceStateBuffer: storage(32), sourceThermoBuffer: storage(48),
    terminalStateBuffer: storage(32), terminalThermoBuffer: storage(48) };
}

test('initial aerosol import keeps exact physical multiplicity, private ownership and canonical sparse holes', async () => {
  const device = fakeDevice(), input = parcel();
  const provenance = { kind: 'initial-conditions', reference: 'specified initial population' };
  const family = create(device, { parcels: [input], provenance });
  const data = device.writes[0].bytes;
  const u = new Uint32Array(data.buffer), f = new Float32Array(data.buffer);
  assert.equal(data.byteLength, 4 * 96);
  assert.ok(u.slice(0, 48).every((value) => value === 0));
  assert.ok(u.slice(72).every((value) => value === 0));
  assert.equal(u[48 + 14], 7); assert.equal(u[48 + 15], 256);
  assert.equal(u[48 + 18], 0xffffffff); assert.equal(u[48 + 19], 0);
  assert.equal(f[48 + 10], 0, 'only the device derives radius');
  assert.equal(f[48 + 7], -10, 'energy reference may be signed');
  input.positionM[0] = 999; provenance.reference = 'mutated';
  assert.equal(f[48], 1); assert.equal(family.provenance.reference, 'specified initial population');
  assert.equal('buffer' in family, false); assert.equal('device' in family, false);
  assert.equal(Object.isFrozen(family), true); assert.equal(Object.isFrozen(family.provenance), true);
  await device.finishQueue();
  assert.equal(device.buffers[0].destroyed, 0); assert.equal(device.buffers[1].destroyed, 1);
  assert.equal(releaseSphAerosolParcelFamily(family), true);
  assert.equal(releaseSphAerosolParcelFamily(family), false);
  await device.finishQueue(); assert.equal(device.buffers[0].destroyed, 1);
});

for (const [name, bad] of [
  ['missing multiplicity', { physicalMultiplicity: undefined }],
  ['zero population', { physicalMultiplicity: 0n }],
  ['approximate host integer', { physicalMultiplicity: 2 ** 54 }],
  ['u64 overflow', { physicalMultiplicity: 2n ** 64n }],
  ['carrier-derived mass label', { sourceLineageIndex: 0 }],
  ['noninitial epoch', { sourceTopologyEpoch: 1 }],
  ['missing nuclei', { nucleusPopulationId: undefined }],
  ['gas is not aerosol', { phaseId: 3 }],
  ['zero material', { materialId: 0 }],
  ['unrepresentable identity', { materialId: 0x1000000 }],
  ['negative mass', { massKg: -1 }],
  ['underflowed mass', { massKg: 1e-100 }],
  ['nonfinite energy', { specificInternalEnergyJPerKg: Infinity }],
  ['zero temperature', { temperatureK: 0 }],
  ['missing density', { condensedDensityKgM3: undefined }],
  ['nonfinite position', { positionM: [0, NaN, 1] }],
  ['wrong velocity arity', { velocityMPerS: [1, 2] }],
  ['out of range slot', { slot: 4 }]
]) test(`aerosol host admission rejects ${name} before allocation`, () => {
  const device = fakeDevice();
  assert.throws(() => create(device, { parcels: [parcel(bad)] }));
  assert.equal(device.buffers.length, 0);
});

test('initial aerosol input rejects ambiguous slots, identities, aggregate population and provenance', () => {
  for (const overrides of [
    { parcels: [parcel(), parcel({ parcelId: 2n })] },
    { parcels: [parcel(), parcel({ slot: 1 })] },
    { parcels: [parcel({ physicalMultiplicity: 2n ** 64n - 1n }), parcel({ slot: 1, parcelId: 2n })] },
    { provenance: { kind: 'carrier-condensation', reference: 'unpaired debit' } },
    { provenance: { kind: 'initial-conditions', reference: ' ' } },
    { capacity: 0 }, { capacity: 1e9 }
  ]) {
    const device = fakeDevice(); assert.throws(() => create(device, overrides));
    assert.equal(device.buffers.length, 0);
  }
});

test('aerosol failed allocation and ambiguous submit retire only owned resources', async () => {
  for (const options of [{ failAllocation: 1 }, { failAllocation: 2 }, { failSubmit: true }]) {
    const device = fakeDevice(options);
    assert.throws(() => create(device), /injected/);
    await device.finishQueue(); assert.ok(device.buffers.every((buffer) => buffer.destroyed === 1));
  }
});

test('aerosol family rejects clones, foreign devices and new borrows after release', async () => {
  const device = fakeDevice(), family = create(device), options = stageInputs(device, family);
  assert.throws(() => releaseSphAerosolParcelFamily({ ...family }), /exact family/);
  assert.throws(() => createSphAerosolCombinedBudgetStage({ ...options, sourceFamily: { ...family } }), /exact live/);
  assert.throws(() => createSphAerosolCombinedBudgetStage({ ...options, device: fakeDevice() }), /same-device/);
  releaseSphAerosolParcelFamily(family);
  assert.throws(() => createSphAerosolCombinedBudgetStage(options), /exact live/);
  await device.finishQueue();
});

test('aerosol summary borrows survive release until the exact submitted read retires', async () => {
  const device = fakeDevice(), family = create(device), options = stageInputs(device, family);
  await device.finishQueue();
  const stage = createSphAerosolCombinedBudgetStage(options);
  const target = device.createBuffer({ size: 320, usage: 8 });
  releaseSphAerosolParcelFamily(family);
  await device.finishQueue(); assert.equal(device.buffers[0].destroyed, 0);
  assert.throws(() => stage.markSubmissionStarted(), /order/);
  stage.encode(device.createCommandEncoder(), { copyTargetBuffer: target });
  assert.throws(() => stage.encode(device.createCommandEncoder(), { copyTargetBuffer: target }), /already/);
  assert.equal(stage.dispatchCount, 4); assert.equal(device.copies.length, 2);
  stage.markSubmissionStarted();
  assert.throws(() => stage.markSubmissionStarted(), /order/);
  stage.dispose(); assert.equal(stage.dispose(), false);
  assert.equal(device.buffers[0].destroyed, 0);
  await device.finishQueue(); assert.equal(device.buffers[0].destroyed, 1);
  for (const buffer of [options.sourceStateBuffer, options.sourceThermoBuffer,
    options.terminalStateBuffer, options.terminalThermoBuffer, target]) assert.equal(buffer.destroyed, 0);
  assert.ok(device.buffers.filter((buffer) => buffer.label?.startsWith('ulg-aerosol-budget')).every((buffer) => buffer.destroyed === 1));
});

test('abandoned aerosol budget releases its borrow and invalid targets cannot encode', async () => {
  const device = fakeDevice(), family = create(device);
  const stage = createSphAerosolCombinedBudgetStage(stageInputs(device, family));
  const target = device.createBuffer({ size: 320, usage: 8 });
  assert.throws(() => stage.encode(device.createCommandEncoder(), { copyTargetBuffer: target, copyTargetOffsetBytes: 1 }), /target/);
  stage.dispose(); releaseSphAerosolParcelFamily(family);
  await device.finishQueue(); assert.equal(device.buffers[0].destroyed, 1);
});

test('aerosol observation checks exact endpoint metadata, error bits and lifetime', async () => {
  const device = fakeDevice(), family = create(device);
  const stage = createSphAerosolCombinedBudgetStage(stageInputs(device, family));
  const target = device.createBuffer({ size: 320, usage: 8 });
  const values = new Float32Array(80), words = new Uint32Array(values.buffer);
  for (const base of [0, 40]) {
    words.set([0, SPH_AEROSOL_BUDGET_MAGIC, SPH_AEROSOL_BUDGET_VERSION, 4, 1, 0], base + 34);
    words[base + 32] = 7; words[base + 33] = 256;
  }
  assert.throws(() => stage.decode(values), /not live/);
  stage.encode(device.createCommandEncoder(), { copyTargetBuffer: target }); stage.markSubmissionStarted();
  const decoded = stage.decode(values);
  assert.equal(decoded.source.physicalMultiplicity, String(2n ** 40n + 7n));
  assert.equal(decoded.energyScope, 'stored-internal-plus-translational-kinetic-only');
  assert.equal(decoded.fullPhysicsValidation, false);
  for (const offset of [34, 35, 36, 37, 38, 39, 74, 75, 76, 77, 78, 79]) {
    const old = words[offset]; words[offset] ^= 1;
    assert.throws(() => stage.decode(values), /authority/); words[offset] = old;
  }
  values[5] = NaN; assert.throws(() => stage.decode(values), /Nonfinite/); values[5] = 0;
  await device.lose(); assert.throws(() => stage.decode(values), /not live/);
  assert.throws(() => createSphAerosolCombinedBudgetStage(stageInputs(device, family)), /exact live/);
  stage.dispose(); await device.finishQueue(); assert.equal(device.buffers[0].destroyed, 1);
});

test('all partial budget allocation failures release borrows without destroying carriers', async () => {
  for (let failAllocation = 7; failAllocation <= 12; failAllocation++) {
    const device = fakeDevice({ failAllocation }), family = create(device);
    const options = stageInputs(device, family);
    assert.throws(() => createSphAerosolCombinedBudgetStage(options), /allocation failure/);
    releaseSphAerosolParcelFamily(family); await device.finishQueue();
    assert.equal(device.buffers[0].destroyed, 1);
    for (const buffer of device.buffers.slice(2, 6)) assert.equal(buffer.destroyed, 0);
    for (const buffer of device.buffers.slice(6)) assert.equal(buffer.destroyed, 1);
  }
});

test('combined inventory safely tiles workgroups beyond the device one-dimensional limit', async () => {
  const device = fakeDevice(); device.limits.maxComputeWorkgroupsPerDimension = 4;
  const family = create(device, { capacity: 300 });
  assert.equal(device.passes[0], 8, 'five initializer groups tile4x2');
  const stage = createSphAerosolCombinedBudgetStage(stageInputs(device, family));
  const target = device.createBuffer({ size: 320, usage: 8 });
  stage.encode(device.createCommandEncoder(), { copyTargetBuffer: target });
  assert.deepEqual(device.passes.slice(1), [12, 1, 12, 1]);
  assert.equal(stage.workgroupCount, 26);
  stage.dispose(); releaseSphAerosolParcelFamily(family); await device.finishQueue();
});

for (const failure of [null, 'throw', 'reject']) test(`actual resident-summary map failure with ${failure ?? 'successful'} fence retires safely`, async () => {
  const device = fakeDevice(), family = create(device), options = stageInputs(device, family);
  await device.finishQueue();
  const mechanicsBuffer = device.createBuffer({ size: 128, usage: 128 });
  const gridBuffer = device.createBuffer({ size: 32, usage: 128 });
  const external = [options.sourceStateBuffer, options.sourceThermoBuffer,
    options.terminalStateBuffer, options.terminalThermoBuffer, mechanicsBuffer, gridBuffer];
  const args = {
    device, sourceAerosolFamily: family, terminalAerosolFamily: family,
    sphParticleState: { schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA, particleCount: 1,
      state: new Float32Array(8), thermo: new Float32Array(12) },
    mlsMpmParticleState: { schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA, particleCount: 1, mechanics: new Float32Array(32) },
    sphParticleUpload: { status: 'webgpu-uploaded', stateBuffer: options.sourceStateBuffer, thermoBuffer: options.sourceThermoBuffer },
    mlsMpmParticleUpload: { status: 'webgpu-uploaded', mechanicsBuffer },
    gridUpdate: { gridNodeCount: 1, gpuResult: { updatedGridBuffer: gridBuffer } },
    g2pReconstruction: { stateBuffer: options.terminalStateBuffer, mechanicsBuffer }
  };
  const pending = runMlsMpmResidentSummaryWebGpu(args);
  device.fenceFailure = failure;
  await assert.rejects(pending, /injected map failure/);
  releaseSphAerosolParcelFamily(family);
  if (failure) {
    await Promise.resolve();
    assert.equal(device.buffers[0].destroyed, 0);
    assert.ok(device.buffers.filter((buffer) => buffer.label?.includes('summary')).every((buffer) => buffer.destroyed === 0));
    await device.lose(); await Promise.resolve();
  }
  await device.finishQueue();
  assert.ok(external.every((buffer) => buffer.destroyed === 0));
  assert.ok(device.buffers.filter((buffer) => !external.includes(buffer)).every((buffer) => buffer.destroyed === 1));
});

for (const failure of ['throw', 'reject']) {
  test(`initial aerosol ${failure}ing fence quarantines until confirmed device loss`, async () => {
    const device = fakeDevice(); device.fenceFailure = failure;
    const family = create(device);
    await Promise.resolve();
    assert.throws(() => createSphAerosolCombinedBudgetStage(stageInputs(device, family)), /exact live/);
    releaseSphAerosolParcelFamily(family); await Promise.resolve();
    assert.equal(device.buffers[0].destroyed, 0); assert.equal(device.buffers[1].destroyed, 0);
    await device.lose(); await Promise.resolve();
    assert.equal(device.buffers[0].destroyed, 1); assert.equal(device.buffers[1].destroyed, 1);
  });
  test(`submitted aerosol ${failure}ing fence jointly quarantines caller resources until device loss`, async () => {
    const device = fakeDevice(), family = create(device), options = stageInputs(device, family);
    await device.finishQueue();
    const stage = createSphAerosolCombinedBudgetStage(options);
    const target = device.createBuffer({ size: 320, usage: 8 });
    stage.encode(device.createCommandEncoder(), { copyTargetBuffer: target }); stage.markSubmissionStarted();
    device.fenceFailure = failure;
    stage.dispose(() => target.destroy()); await Promise.resolve();
    releaseSphAerosolParcelFamily(family);
    assert.equal(target.destroyed, 0); assert.equal(device.buffers[0].destroyed, 0);
    assert.ok(device.buffers.filter((buffer) => buffer.label?.startsWith('ulg-aerosol-budget')).every((buffer) => buffer.destroyed === 0));
    await device.lose(); await Promise.resolve();
    assert.equal(target.destroyed, 1); assert.equal(device.buffers[0].destroyed, 1);
    assert.ok(device.buffers.filter((buffer) => buffer.label?.startsWith('ulg-aerosol-budget')).every((buffer) => buffer.destroyed === 1));
    assert.equal(options.sourceStateBuffer.destroyed, 0);
  });
}
