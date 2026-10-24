import { createSphAerosolParcelFamilyWebGpu } from '../src/runtime/sph/sphAerosolParcelGpu.js';
import { tagWebGpuBufferDevice, webGpuDeviceId } from '../src/runtime/sph/sphGpuDeviceIdentity.js';
import { createSchroederSpatialEpochTransaction } from '../src/runtime/sph/schroederSpatialEpochTransaction.js';

// Ownership/lifetime double only; it does not execute particle physics.
export function fakeAerosolDevice() {
  const buffers = [], fences = [];
  let lose;
  const device = {
    buffers, fenceFailure: null, dispatches: 0,
    lost: new Promise((resolve) => { lose = resolve; }),
    limits: { maxBufferSize: 2 ** 24, maxStorageBufferBindingSize: 2 ** 24 },
    createBuffer(descriptor) {
      const buffer = { ...descriptor, destroyed: 0, destroy() { this.destroyed++; } };
      buffers.push(buffer); return tagWebGpuBufferDevice(buffer, device);
    },
    createShaderModule: (d) => d, createBindGroupLayout: (d) => d,
    createPipelineLayout: (d) => d, createComputePipeline: (d) => d,
    createBindGroup: (d) => d,
    createCommandEncoder() {
      return { beginComputePass() { return { setPipeline() {}, setBindGroup() {},
        dispatchWorkgroups() { device.dispatches++; }, end() {} }; }, finish: () => ({}) };
    },
    queue: { writeBuffer() {}, submit() {}, onSubmittedWorkDone() {
      if (device.fenceFailure === 'throw') throw new Error('unconfirmed fence');
      if (device.fenceFailure === 'reject') return Promise.reject(new Error('unconfirmed fence'));
      return new Promise((resolve) => fences.push(resolve));
    } },
    async finishQueue() {
      for (let i = 0; i < 8; i++) { fences.splice(0).forEach((resolve) => resolve()); await Promise.resolve(); }
    },
    async lose() { lose({ reason: 'destroyed' }); for (let i = 0; i < 8; i++) await Promise.resolve(); }
  };
  return device;
}

export function initialFamily(device) {
  return createSphAerosolParcelFamilyWebGpu({ device, capacity: 2, parcels: [],
    provenance: { kind: 'initial-conditions', reference: 'declared empty test reservoir' } });
}

export function spatialFixture({ withFamily = true, device = fakeAerosolDevice(), create = true } = {}) {
  const make = (label) => device.createBuffer({ label, size: 4096, usage: 128 | 4 | 8 });
  const epoch = { storageGeneration: 3, physicsTick: 11, physicsSubstep: 2,
    positionEpoch: 13, topologyEpoch: 5, chartEpoch: 1, levelEpoch: 4, supportEpoch: 6 };
  const activeNodeBuffer = make('active-node'), directoryBuffer = make('directory');
  const generation = { ready: true, selected: true, directoryBuildCount: 1, privateLookupBuildCount: 0,
    source: { ready: true, activeNodeBuffer, ...epoch },
    execution: { submitPerformed: true, deviceId: webGpuDeviceId(device), generationId: 7,
      buildOrdinal: 7, sortUniqueOrdinal: 7, activeNodeBuffer, directoryBuffer, ...epoch } };
  const family = withFamily ? initialFamily(device) : null;
  const sphParticleUpload = { stateBuffer: make('prior-state'), thermoBuffer: make('prior-thermo'),
    identityBuffer: make('prior-identity'), particleCount: 8, ...epoch,
    ...(family ? { aerosolFamily: family } : {}) };
  const mlsMpmParticleUpload = { mechanicsBuffer: make('prior-mechanics'), particleCount: 8, ...epoch };
  const fixture = { device, family, generation, sphParticleUpload, mlsMpmParticleUpload };
  if (create) fixture.transaction = createSchroederSpatialEpochTransaction(fixture);
  return fixture;
}
