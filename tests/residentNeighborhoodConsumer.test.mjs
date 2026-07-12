import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RESIDENT_NEIGHBORHOOD_CONSUMER,
  RESIDENT_NEIGHBORHOOD_SUPPORT_FLAG
} from '../ulg-gpu-abi/src/residentNeighborhood.js';
import { createResidentNeighborhoodDescriptor } from
  '../src/runtime/sph/residentNeighborhoodGpu.js';
import { createResidentNeighborhoodGpuBuilder } from
  '../src/runtime/sph/residentNeighborhoodGpuBuilder.js';
import {
  createResidentNeighborhoodConsumerGuardU32,
  resolveResidentNeighborhoodConsumer
} from '../src/runtime/sph/residentNeighborhoodConsumer.js';
import { tagWebGpuBufferDevice } from '../src/runtime/sph/sphGpuDeviceIdentity.js';

function descriptor() {
  return createResidentNeighborhoodDescriptor({
    generation: 41,
    leaseId: 'neigh-41',
    laneId: 'lane-0',
    stateKey: 'state/41',
    sourceFamily: 'sph-particle-state',
    leaseTokenLow: 0x1234,
    leaseTokenHigh: 0x5678,
    supportClasses: [{
      supportClassId: 1,
      consumerMask: RESIDENT_NEIGHBORHOOD_CONSUMER.THERMAL,
      minLevelDelta: 0,
      maxLevelDelta: 0,
      cellRadius: 1,
      maxCandidatesPerSource: 4,
      flags: RESIDENT_NEIGHBORHOOD_SUPPORT_FLAG.EXACT_NEAR_REQUIRED
        | RESIDENT_NEIGHBORHOOD_SUPPORT_FLAG.EXCLUDE_SELF
    }],
    sourceSupportAssignments: [{ thermal: 1 }, { thermal: 1 }],
    positionEpoch: 9,
    skinDistanceM: 0.5,
    maxDisplacementM: 0.1,
    sourceCount: 2,
    requiredUniqueCellCount: 2,
    requiredCellMemberCount: 2,
    requiredCandidateCount: 2,
    capacities: {
      uniqueCellCount: 2,
      cellOffsetCount: 3,
      cellMemberCount: 2,
      sourceOffsetCount: 3,
      sourceSupportAssignmentCount: 2,
      candidateCount: 4
    }
  });
}

function encodedBuild(device, overrides = {}) {
  const value = descriptor();
  const buffer = tagWebGpuBufferDevice({ label: 'packed-neighborhood', size: 1024 }, device);
  return {
    schema: 'peercompute.ulg.resident-neighborhood-gpu-builder.v0',
    descriptor: value,
    hostAdmission: true,
    encoded: true,
    released: false,
    resources: { outputs: { sourceCandidateCsr: { buffer, byteLength: 1024 } } },
    retainedBuffers: { packedCandidateCsrBuffer: buffer },
    ...overrides
  };
}

test('consumer admission retains packed CSR without reading it and encodes identity guard', () => {
  const device = {};
  const result = resolveResidentNeighborhoodConsumer({
    residentNeighborhood: encodedBuild(device),
    device,
    consumer: 'thermal',
    sourceCount: 2,
    generation: 41,
    positionEpoch: 9,
    leaseId: 'neigh-41',
    laneId: 'lane-0',
    stateKey: 'state/41',
    leaseTokenLow: 0x1234,
    leaseTokenHigh: 0x5678
  });
  assert.equal(result.admitted, true);
  assert.equal(result.mode, 'resident-neighborhood-packed-csr');
  assert.equal(result.mapPerformed, false);
  assert.equal(result.readbackPerformed, false);
  assert.equal(result.expectedIdentity.sourceFamily, 'sph-particle-state');
  assert.deepEqual([...createResidentNeighborhoodConsumerGuardU32(result)], [
    2, 41, 0x1234, 0x5678, 9, 2, RESIDENT_NEIGHBORHOOD_CONSUMER.THERMAL, 1
  ]);
});

test('consumer admission fails closed for generation, lease, consumer, and device mismatches', () => {
  const sourceDevice = {};
  const otherDevice = {};
  const build = encodedBuild(sourceDevice);
  const generation = resolveResidentNeighborhoodConsumer({
    residentNeighborhood: build,
    device: sourceDevice,
    consumer: 'thermal',
    generation: 42
  });
  assert.equal(generation.admitted, false);
  assert.ok(generation.reasonCodes.includes('generation-mismatch'));

  const lease = resolveResidentNeighborhoodConsumer({
    residentNeighborhood: build,
    device: sourceDevice,
    consumer: 'thermal',
    leaseTokenLow: 99
  });
  assert.equal(lease.admitted, false);
  assert.ok(lease.reasonCodes.includes('leaseTokenLow-mismatch'));

  const sourceFamily = resolveResidentNeighborhoodConsumer({
    residentNeighborhood: build,
    device: sourceDevice,
    consumer: 'thermal',
    sourceFamily: 'wrong-family'
  });
  assert.equal(sourceFamily.admitted, false);
  assert.ok(sourceFamily.reasonCodes.includes('sourceFamily-mismatch'));

  const family = resolveResidentNeighborhoodConsumer({
    residentNeighborhood: build,
    device: sourceDevice,
    consumer: 'reaction'
  });
  assert.equal(family.admitted, false);
  assert.ok(family.reasonCodes.includes('consumer-family-not-enabled'));

  const crossDevice = resolveResidentNeighborhoodConsumer({
    residentNeighborhood: build,
    device: otherDevice,
    consumer: 'thermal'
  });
  assert.equal(crossDevice.admitted, false);
  assert.ok(crossDevice.reasonCodes.includes('gpu-device-mismatch'));

  const untagged = encodedBuild(sourceDevice);
  untagged.resources.outputs.sourceCandidateCsr.buffer = { size: 1024 };
  untagged.retainedBuffers.packedCandidateCsrBuffer =
    untagged.resources.outputs.sourceCandidateCsr.buffer;
  const unknownDevice = resolveResidentNeighborhoodConsumer({
    residentNeighborhood: untagged,
    device: sourceDevice,
    consumer: 'thermal'
  });
  assert.equal(unknownDevice.admitted, false);
  assert.ok(unknownDevice.reasonCodes.includes('gpu-device-identity-unavailable'));
});

test('builder-created packed output is tagged to its creating device', () => {
  const buffers = [];
  const device = {
    limits: {
      maxBufferSize: 1 << 24,
      maxStorageBufferBindingSize: 1 << 24,
      maxComputeWorkgroupsPerDimension: 65535
    },
    queue: { writeBuffer() {} },
    createBuffer(options) {
      const buffer = { ...options, destroy() {} };
      buffers.push(buffer);
      return buffer;
    },
    createShaderModule(options) { return options; },
    createComputePipeline(options) {
      return { ...options, getBindGroupLayout() { return {}; } };
    },
    createBindGroup(options) { return options; }
  };
  const value = descriptor();
  const input = (size) => device.createBuffer({ size, usage: 128 });
  const builder = createResidentNeighborhoodGpuBuilder(device, {
    maxSourceCount: 4,
    maxSupportClassCount: 2,
    maxCandidateScratchCount: 8
  });
  const prepared = builder.prepare({
    descriptor: value,
    positionBuffer: input(32),
    chartLevelBuffer: input(64),
    supportClassBuffer: input(32),
    sourceSupportAssignmentBuffer: input(64)
  });
  const result = resolveResidentNeighborhoodConsumer({
    residentNeighborhood: { ...prepared, encoded: true },
    device,
    consumer: 'thermal'
  });
  assert.equal(result.admitted, true);
  assert.equal(result.packedCandidateCsrBuffer, prepared.retainedBuffers.packedCandidateCsrBuffer);
  builder.release(prepared);
});
