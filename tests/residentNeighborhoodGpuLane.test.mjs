import test from 'node:test';
import assert from 'node:assert/strict';

import {
  acquireResidentNeighborhoodGpuLane,
  createResidentNeighborhoodGpuLane,
  destroyResidentNeighborhoodGpuLanePool,
  residentNeighborhoodMutationCertificateProofWgsl,
  residentNeighborhoodSkinReuseProofWgsl,
  residentNeighborhoodGenerationReuseAdmission,
  residentNeighborhoodMutationEpochsForStep,
  resolveResidentNeighborhoodGpuLaneCapacity,
  ULG_RESIDENT_NEIGHBORHOOD_GPU_LANE_SCHEMA
} from '../src/runtime/sph/residentNeighborhoodGpuLane.js';
import {
  RESIDENT_NEIGHBORHOOD_MUTATION_CONTROL_FLAG,
  RESIDENT_NEIGHBORHOOD_MUTATION_FLAG,
  RESIDENT_NEIGHBORHOOD_MUTATION_STAGE,
  residentNeighborhoodMutationPositionEvidence
} from '../ulg-gpu-abi/src/residentNeighborhoodMutationCertificate.js';
import {
  RESIDENT_NEIGHBORHOOD_CONSUMER,
  RESIDENT_NEIGHBORHOOD_SUPPORT_FLAG
} from '../ulg-gpu-abi/src/residentNeighborhood.js';
import { resolveResidentNeighborhoodConsumer } from
  '../src/runtime/sph/residentNeighborhoodConsumer.js';

function createFakeDevice({ storageLimit = 1 << 28 } = {}) {
  const buffers = [];
  const bindGroups = [];
  const bindGroupLayouts = [];
  const writes = [];
  return {
    buffers,
    bindGroups,
    bindGroupLayouts,
    writes,
    limits: {
      maxBufferSize: storageLimit,
      maxStorageBufferBindingSize: storageLimit,
      maxComputeWorkgroupsPerDimension: 65535
    },
    queue: {
      writeBuffer(buffer, offset, data) {
        writes.push({
          buffer,
          offset,
          byteLength: data.byteLength,
          data: typeof data?.slice === 'function' ? data.slice() : data
        });
      }
    },
    createBuffer(descriptor) {
      const buffer = {
        ...descriptor,
        destroyed: false,
        destroy() { this.destroyed = true; }
      };
      buffers.push(buffer);
      return buffer;
    },
    createShaderModule(descriptor) {
      return descriptor;
    },
    createComputePipeline(descriptor) {
      return {
        ...descriptor,
        getBindGroupLayout(index) { return { pipeline: descriptor.label, index }; }
      };
    },
    createBindGroupLayout(descriptor) {
      bindGroupLayouts.push(descriptor);
      return descriptor;
    },
    createPipelineLayout(descriptor) {
      return descriptor;
    },
    createBindGroup(descriptor) {
      bindGroups.push(descriptor);
      return descriptor;
    }
  };
}

function createFakeEncoder() {
  const events = [];
  return {
    events,
    clearBuffer(buffer, offset = 0, size = null) {
      events.push({ kind: 'clear', label: buffer.label, offset, size });
    },
    copyBufferToBuffer(source, sourceOffset, destination, destinationOffset, size) {
      events.push({
        kind: 'copy',
        source: source.label,
        sourceOffset,
        destination: destination.label,
        destinationOffset,
        size
      });
    },
    beginComputePass(descriptor = {}) {
      const event = { kind: 'pass', descriptor, pipeline: null, dispatch: null, commands: [] };
      events.push(event);
      let pipeline = null;
      let bindGroup = null;
      return {
        setPipeline(value) {
          pipeline = value.label;
          event.pipeline = pipeline;
        },
        setBindGroup(index, value, dynamicOffsets = []) {
          bindGroup = { index, label: value.label, dynamicOffsets: [...dynamicOffsets] };
          event.bindGroup = bindGroup;
        },
        dispatchWorkgroups(x, y = 1, z = 1) {
          event.dispatch = [x, y, z];
          event.commands.push({ pipeline, bindGroup, dispatch: event.dispatch });
        },
        dispatchWorkgroupsIndirect(buffer, offset) {
          event.dispatchIndirect = { buffer: buffer.label, offset };
          event.commands.push({ pipeline, bindGroup, dispatchIndirect: event.dispatchIndirect });
        },
        end() { event.ended = true; }
      };
    }
  };
}

function leaseIdentity(overrides = {}) {
  return {
    schema: 'peercompute.compute.gpu-resident-lane-lease-identity.v0',
    authoritative: true,
    leaseId: 'compute-manager-lease-1',
    laneId: 'compute-manager-lane-test',
    stateKey: 'test/hot-state',
    sourceFamily: 'sph-particle-state',
    domainKey: 'test-domain',
    solverId: 'ulg-sph',
    taskId: 'test-task',
    owner: 'compute-manager',
    ...overrides
  };
}

function createMutationLane(device, overrides = {}) {
  return createResidentNeighborhoodGpuLane(device, {
    sourceCount: 4,
    supportDistanceM: 0.4,
    cellSizeM: 0.4,
    consumers: ['mechanics'],
    maxCandidatesPerSource: 4,
    candidateCapacity: 16,
    skinDistanceM: 0.2,
    mutationCertificateCapability: true,
    builderStrategy: 'direct',
    directSegmentedMasked: true,
    laneId: 'compute-manager-lane-test',
    stateKey: 'test/hot-state',
    ...overrides
  });
}

function createPositionBuffer(device, label = 'mutation-particle-state') {
  return device.createBuffer({ label, size: 4 * 8 * 4, usage: 128 });
}

test('lane capacity resolves an explicit per-source budget within storage binding limits', () => {
  const plan = resolveResidentNeighborhoodGpuLaneCapacity({
    device: createFakeDevice({ storageLimit: 4096 }),
    sourceCount: 16,
    requestedMaxCandidatesPerSource: 32
  });
  assert.equal(plan.admitted, true);
  assert.ok(plan.maxCandidatesPerSource < 32);
  assert.equal(plan.candidateCapacity, plan.sourceCount * plan.maxCandidatesPerSource);
  assert.ok(plan.stagingByteLength <= plan.storageBufferBindingLimitBytes);
  assert.ok(
    plan.fixedPackedByteLength + plan.packedCandidateByteLength
      <= plan.storageBufferBindingLimitBytes
  );
});

test('absolute simulation steps reserve canonical pre-step and three mutation epochs', () => {
  const firstBatch = [0, 1, 2].flatMap((step) => {
    const epochs = residentNeighborhoodMutationEpochsForStep(step);
    return [epochs.postG2p, epochs.postSeparation, epochs.postReaction];
  });
  const secondBatch = [3, 4].flatMap((step) => {
    const epochs = residentNeighborhoodMutationEpochsForStep(step);
    return [epochs.postG2p, epochs.postSeparation, epochs.postReaction];
  });
  assert.deepEqual(firstBatch, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(secondBatch, [10, 11, 12, 13, 14, 15]);
  assert.equal(secondBatch[0], firstBatch.at(-1) + 1);

  const canonicalPreSteps = [0, 1, 2, 3].map(
    (step) => residentNeighborhoodMutationEpochsForStep(step).preStep
  );
  assert.deepEqual(canonicalPreSteps, [0, 3, 6, 9]);
  for (const step of [0, 1, 2, 3]) {
    const current = residentNeighborhoodMutationEpochsForStep(step);
    const next = residentNeighborhoodMutationEpochsForStep(step + 1);
    assert.equal(current.postReaction, next.preStep);
  }
  assert.equal(new Set([...firstBatch, ...secondBatch]).size, 15);
  assert.equal(
    residentNeighborhoodMutationEpochsForStep(0x5555_5554).postReaction,
    0xffff_ffff
  );
  assert.throws(
    () => residentNeighborhoodMutationEpochsForStep(0x5555_5555),
    /exceeds uint32 range/
  );
});

test('mutation lifecycle builds a real initial checkpoint in one direct pass', () => {
  const device = createFakeDevice();
  const lane = createMutationLane(device);
  const encoder = createFakeEncoder();
  const prepared = lane.prepareGeneration(encoder, {
    positionBuffer: createPositionBuffer(device),
    leaseAuthorityIdentity: leaseIdentity(),
    mutationAuthorityEpoch: 7
  });

  assert.equal(lane.mutationCertificateCapabilityEnabled, true);
  assert.equal(lane.mutationCertificate.fullParticleReferenceBufferAllocated, false);
  assert.equal(prepared.decisionRequired, false);
  assert.equal(
    prepared.mutationCertificate.stageKind,
    RESIDENT_NEIGHBORHOOD_MUTATION_STAGE.REFERENCE_CHECKPOINT
  );
  assert.equal(prepared.mutationCertificate.writerSeen, false);
  assert.equal(prepared.writerBindingResource, null);
  assert.throws(
    () => lane.acquireMutationCertificate({
      stageKind: 'reference-checkpoint',
      targetGeneration: 2,
      leaseTokenLow: 2,
      leaseTokenHigh: 2,
      targetPositionEpoch: 2
    }),
    /reserved for a lane-authored rebuild checkpoint/
  );
  assert.throws(
    () => lane.acquireMutationCertificate({
      stageKind: 'g2p',
      targetGeneration: 2,
      leaseTokenLow: 2,
      leaseTokenHigh: 2,
      targetPositionEpoch: 2,
      writerSeen: true
    }),
    /must be authored by the GPU writer stage/
  );

  const build = lane.finishGeneration(prepared);
  assert.equal(build.productionLane.encodingTelemetry.encodedDispatchCount, 3);
  assert.equal(build.productionLane.encodingTelemetry.encodedComputePassCount, 1);
  assert.equal(
    build.productionLane.encodingTelemetry.conditionalPassGrouping,
    'initial-source-metadata-direct-builder-checkpoint-one-pass'
  );
  assert.equal(encoder.events.filter((event) => event.kind === 'pass').length, 1);
  assert.throws(() => lane.finishGeneration(prepared), /already finished/);
  assert.equal(lane.cancelPreparedGeneration(prepared), false);
  assert.equal(lane.releaseGeneration(build), true);
  assert.equal(lane.releaseGeneration(build), false);
  lane.destroy();
});

test('certified mutation generation finalizes in the writer pass then finishes 4/1', () => {
  const device = createFakeDevice();
  const lane = createMutationLane(device);
  const positionBuffer = createPositionBuffer(device);
  const initial = lane.encodeGeneration(createFakeEncoder(), {
    positionBuffer,
    leaseAuthorityIdentity: leaseIdentity(),
    mutationAuthorityEpoch: 7
  });
  lane.releaseGeneration(initial);
  const certificate = lane.acquireMutationCertificate({
    stageKind: 'g2p',
    targetGeneration: 2,
    leaseTokenLow: 2,
    leaseTokenHigh: 2,
    targetPositionEpoch: 2,
    authorityEpoch: 7
  });
  const encoder = createFakeEncoder();
  const prepared = lane.prepareGeneration(encoder, {
    positionBuffer,
    leaseAuthorityIdentity: leaseIdentity(),
    mutationCertificate: certificate,
    mutationAuthorityEpoch: 7,
    generation: 2,
    positionEpoch: 2,
    generationLeaseTokenLow: 2,
    generationLeaseTokenHigh: 2
  });

  assert.equal(prepared.decisionRequired, true);
  assert.equal(prepared.writerBindingResource.offset, 0);
  assert.equal(prepared.writerBindingResource.size, 64);
  assert.equal(prepared.writerBindingDynamicOffset % 256, 0);
  assert.deepEqual(
    prepared.writerBindingDynamicOffsets,
    [prepared.writerBindingDynamicOffset]
  );
  assert.throws(() => lane.finishGeneration(prepared), /requires a finalized decision/);

  const writerPass = encoder.beginComputePass({ label: 'caller-owned-g2p-writer-pass' });
  const decision = lane.recordMutationDecision(prepared, writerPass);
  writerPass.end();
  assert.equal(decision.encodedComputePassCount, 0);
  assert.deepEqual(
    encoder.events.find((event) => event.descriptor?.label === 'caller-owned-g2p-writer-pass')
      .bindGroup.dynamicOffsets,
    [prepared.writerBindingDynamicOffset]
  );
  assert.throws(
    () => lane.recordMutationDecision(prepared, writerPass),
    /already finalized/
  );

  const build = lane.finishGeneration(prepared);
  assert.equal(build.productionLane.encodingTelemetry.encodedDispatchCount, 4);
  assert.equal(build.productionLane.encodingTelemetry.encodedComputePassCount, 1);
  assert.equal(build.productionLane.skinReuse.encodedProofPassCount, 0);
  assert.equal(encoder.events.filter((event) => event.kind === 'pass').length, 2);
  assert.throws(() => lane.finishGeneration(prepared), /already finished/);
  assert.equal(lane.releaseGeneration(build), true);
  assert.equal(lane.releaseMutationCertificate(certificate), false);
  assert.ok(device.bindGroupLayouts.some((layout) => layout.entries.some(
    (entry) => entry.binding === 1
      && entry.buffer.hasDynamicOffset === true
      && entry.buffer.minBindingSize === 64
  )));
  lane.destroy();
});

test('mutation reservations reject wrong identity and fail-close evidence states', () => {
  const device = createFakeDevice();
  const lane = createMutationLane(device);
  const positionBuffer = createPositionBuffer(device);
  const initial = lane.encodeGeneration(createFakeEncoder(), {
    positionBuffer,
    leaseAuthorityIdentity: leaseIdentity(),
    mutationAuthorityEpoch: 11
  });
  lane.releaseGeneration(initial);
  const certificate = lane.acquireMutationCertificate({
    stageKind: 'separation',
    targetGeneration: 2,
    leaseTokenLow: 2,
    leaseTokenHigh: 3,
    targetPositionEpoch: 4,
    authorityEpoch: 11
  });
  const base = {
    positionBuffer,
    leaseAuthorityIdentity: leaseIdentity(),
    mutationCertificate: certificate,
    mutationAuthorityEpoch: 11,
    generation: 2,
    positionEpoch: 4,
    generationLeaseTokenLow: 2,
    generationLeaseTokenHigh: 3
  };
  for (const override of [
    { generation: 3 },
    { positionEpoch: 5 },
    { generationLeaseTokenLow: 4 },
    { generationLeaseTokenHigh: 4 },
    { mutationAuthorityEpoch: 12 }
  ]) {
    assert.throws(
      () => lane.prepareGeneration(createFakeEncoder(), { ...base, ...override }),
      /target identity does not match generation/
    );
  }
  assert.throws(
    () => lane.acquireMutationCertificate({
      stageKind: 'g2p',
      targetGeneration: 2,
      leaseTokenLow: 2,
      leaseTokenHigh: 2,
      targetPositionEpoch: 2,
      sourceCount: 3
    }),
    /does not match lane/
  );
  assert.equal(certificate.writerSeen, false);
  assert.match(residentNeighborhoodMutationCertificateProofWgsl,
    /nonce == prior_nonce \+ 1u/);
  assert.match(residentNeighborhoodMutationCertificateProofWgsl,
    /writer_seen\s*&& mutation_flags == 0u/);
  const invalid = residentNeighborhoodMutationPositionEvidence({
    sourceIndex: 0,
    previousPosition: [Number.NaN, 0, 0],
    nextPosition: [0, 0, 0],
    previousMass: 1,
    nextMass: 1
  });
  const activated = residentNeighborhoodMutationPositionEvidence({
    sourceIndex: 0,
    previousPosition: [0, 0, 0],
    nextPosition: [0, 0, 0],
    previousMass: 0,
    nextMass: 1
  });
  assert.equal(invalid.mutationFlags,
    RESIDENT_NEIGHBORHOOD_MUTATION_FLAG.INVALID_OLD_POSITION);
  assert.equal(activated.mutationFlags,
    RESIDENT_NEIGHBORHOOD_MUTATION_FLAG.NEWLY_ACTIVATED_SOURCE);
  assert.equal(lane.releaseMutationCertificate(certificate), true);
  assert.equal(lane.releaseMutationCertificate(certificate), false);
  lane.destroy();
});

test('mutation arena, authority rebase, and pool capability ordering fail closed', () => {
  const arenaDevice = createFakeDevice();
  const arenaLane = createMutationLane(arenaDevice);
  const certificates = Array.from({ length: 128 }, (_, index) => (
    arenaLane.acquireMutationCertificate({
      stageKind: 'g2p',
      targetGeneration: index + 1,
      leaseTokenLow: index + 1,
      leaseTokenHigh: index + 1,
      targetPositionEpoch: index + 1
    })
  ));
  assert.deepEqual(certificates.map((entry) => entry.nonce),
    Array.from({ length: 128 }, (_, index) => index + 1));
  assert.throws(
    () => arenaLane.acquireMutationCertificate({
      stageKind: 'g2p',
      targetGeneration: 129,
      leaseTokenLow: 129,
      leaseTokenHigh: 129,
      targetPositionEpoch: 129
    }),
    (error) => error.code === 'ERR_RESIDENT_NEIGHBORHOOD_MUTATION_ARENA_FULL'
  );
  for (const certificate of certificates) {
    assert.equal(arenaLane.releaseMutationCertificate(certificate), true);
  }
  const rebase = arenaLane.acquireMutationCertificate({
    stageKind: 'g2p',
    targetGeneration: 130,
    leaseTokenLow: 130,
    leaseTokenHigh: 130,
    targetPositionEpoch: 130,
    authorityRebase: true
  });
  assert.equal(
    rebase.controlFlags,
    RESIDENT_NEIGHBORHOOD_MUTATION_CONTROL_FLAG.AUTHORITY_REBASE
      | RESIDENT_NEIGHBORHOOD_MUTATION_CONTROL_FLAG.FORCE_REBUILD
  );
  arenaLane.releaseMutationCertificate(rebase);
  arenaLane.destroy();

  const poolDevice = createFakeDevice();
  const options = {
    sourceCount: 4,
    supportDistanceM: 0.4,
    cellSizeM: 0.4,
    consumers: ['mechanics'],
    maxCandidatesPerSource: 4,
    candidateCapacity: 16,
    skinDistanceM: 0.2,
    directSegmentedMasked: true,
    laneId: 'compute-manager-lane-test',
    stateKey: 'test/hot-state'
  };
  const legacy = acquireResidentNeighborhoodGpuLane(poolDevice, {
    ...options,
    leaseAuthorityIdentity: leaseIdentity({ leaseId: 'legacy-capability' })
  });
  const first = acquireResidentNeighborhoodGpuLane(poolDevice, {
    ...options,
    mutationCertificateCapability: true,
    leaseAuthorityIdentity: leaseIdentity({ leaseId: 'mutation-first' })
  });
  const second = acquireResidentNeighborhoodGpuLane(poolDevice, {
    ...options,
    mutationCertificateCapability: true,
    generationBase: 10,
    positionEpochBase: 10,
    leaseAuthorityIdentity: leaseIdentity({ leaseId: 'mutation-second' })
  });
  assert.notEqual(legacy.lane, first.lane);
  assert.equal(first.lane, second.lane);
  assert.equal(first.inFlightSubmissionCountAtAcquire, 1);
  assert.equal(second.inFlightSubmissionCountAtAcquire, 2);
  const positionBuffer = createPositionBuffer(poolDevice, 'pooled-mutation-state');
  first.encodeGeneration(createFakeEncoder(), { positionBuffer, mutationAuthorityEpoch: 0 });
  const firstCertificate = first.acquireMutationCertificate({
    stageKind: 'g2p',
    targetGeneration: 2,
    targetPositionEpoch: 2,
    leaseTokenLow: 2,
    leaseTokenHigh: 2
  });
  const secondCertificate = second.acquireMutationCertificate({
    stageKind: 'g2p',
    targetGeneration: 10,
    targetPositionEpoch: 10,
    leaseTokenLow: 10,
    leaseTokenHigh: 10
  });
  assert.equal(secondCertificate.nonce, firstCertificate.nonce + 1);
  assert.notEqual(secondCertificate.slotIndex, firstCertificate.slotIndex);
  const firstEncoder = createFakeEncoder();
  const secondEncoder = createFakeEncoder();
  const firstPrepared = first.prepareGeneration(firstEncoder, {
    positionBuffer,
    mutationCertificate: firstCertificate,
    generation: 2,
    positionEpoch: 2,
    generationLeaseTokenLow: 2,
    generationLeaseTokenHigh: 2
  });
  const secondPrepared = second.prepareGeneration(secondEncoder, {
    positionBuffer,
    mutationCertificate: secondCertificate,
    generation: 10,
    positionEpoch: 10,
    generationLeaseTokenLow: 10,
    generationLeaseTokenHigh: 10
  });
  const firstWriterPass = firstEncoder.beginComputePass({ label: 'first-ordered-writer' });
  first.recordMutationDecision(firstPrepared, firstWriterPass);
  firstWriterPass.end();
  const secondWriterPass = secondEncoder.beginComputePass({ label: 'second-ordered-writer' });
  second.recordMutationDecision(secondPrepared, secondWriterPass);
  secondWriterPass.end();
  assert.equal(first.finishGeneration(firstPrepared)
    .productionLane.encodingTelemetry.encodedComputePassCount, 1);
  assert.equal(second.finishGeneration(secondPrepared)
    .productionLane.encodingTelemetry.encodedComputePassCount, 1);
  legacy.release();
  first.release();
  second.release();
  assert.equal(destroyResidentNeighborhoodGpuLanePool(poolDevice), 2);
});

test('production lane GPU-expands uniform metadata and rebuilds one generation per position epoch', () => {
  const device = createFakeDevice();
  const encoder = createFakeEncoder();
  const timestampSpans = [];
  const timestampProfiler = {
    active: true,
    beginComputePassDescriptor(label, metadata) {
      timestampSpans.push({ label, metadata });
      return { label, metadata };
    }
  };
  const positionBuffer = device.createBuffer({
    label: 'retained-particle-state',
    size: 4 * 8 * 4,
    usage: 128
  });
  const lane = createResidentNeighborhoodGpuLane(device, {
    sourceCount: 4,
    supportDistanceM: 0.4,
    cellSizeM: 0.4,
    originM: [-1, -1, -1],
    consumers: ['mechanics', 'thermal', 'radiation'],
    maxCandidatesPerSource: 8,
    candidateCapacity: 32,
    builderStrategy: 'radix',
    generationBase: 21,
    positionEpochBase: 41,
    leaseIdPrefix: 'test-neighborhood',
    laneId: 'compute-manager-lane-test',
    stateKey: 'test/hot-state'
  });

  const first = lane.encodeGeneration(encoder, {
    positionBuffer,
    positionStrideU32: 8,
    leaseAuthorityIdentity: leaseIdentity(),
    timestampProfiler,
    timestampMetadata: { batch: 'focused-neighborhood' },
    substepIndex: 0
  });
  const second = lane.encodeGeneration(encoder, {
    positionBuffer,
    positionStrideU32: 8,
    leaseAuthorityIdentity: leaseIdentity(),
    substepIndex: 1
  });

  assert.equal(lane.schema, ULG_RESIDENT_NEIGHBORHOOD_GPU_LANE_SCHEMA);
  assert.equal(first.hostAdmission, true);
  assert.equal(second.hostAdmission, true);
  assert.equal(first.descriptor.generation, 21);
  assert.equal(second.descriptor.generation, 22);
  assert.equal(first.descriptor.positionValidity.positionEpoch, 41);
  assert.equal(second.descriptor.positionValidity.positionEpoch, 42);
  assert.equal(first.descriptor.sourceSupportAssignments.rowCount, 4);
  assert.equal(first.descriptor.sourceSupportAssignments.packedRowCount, 1);
  assert.equal(first.descriptor.sourceSupportAssignments.storageMode, 'uniform-gpu-expanded');
  assert.equal(first.descriptor.sourceSupportAssignments.rows.length, 8);
  assert.equal(first.productionLane.sourceMetadataInitialization, 'uniform-gpu-expanded-same-encoder');
  assert.equal(
    first.productionLane.sourceMetadataWriteTarget,
    'builder-resident-metadata-and-packed-assignment-output-direct'
  );
  assert.equal(first.sourceMetadataDirectGpuWrite, true);
  assert.equal(first.descriptor.lease.authoritative, true);
  assert.equal(first.descriptor.lease.sourceFamily, 'sph-particle-state');
  assert.equal(first.descriptor.lease.leaseId, 'compute-manager-lease-1');
  assert.equal(first.productionLane.queueSubmitPerformed, false);
  assert.equal(first.productionLane.mapPerformed, false);
  assert.equal(first.productionLane.readbackPerformed, false);
  assert.equal(first.productionLane.gpuTimestampRequested, true);
  assert.equal(first.productionLane.schedulerCreated, false);
  assert.ok(timestampSpans.some(({ label, metadata }) => (
    label.endsWith('SourceMetadata')
      && metadata.batch === 'focused-neighborhood'
      && metadata.generation === 21
      && metadata.positionEpoch === 41
  )));
  assert.ok(timestampSpans.some(({ metadata }) => (
    metadata.residentNeighborhoodStage === 'cell-sort-unique'
  )));
  const uniqueLaneAllocations = new Map();
  for (const entry of lane.allocationEntries()) {
    uniqueLaneAllocations.set(entry.buffer, entry.buffer.size);
  }
  const actualLanePeak = [...uniqueLaneAllocations.values()]
    .reduce((sum, byteLength) => sum + byteLength, 0);
  const allocationPlan = lane.allocationPlan(2);
  assert.equal(allocationPlan.exact, true);
  assert.equal(
    allocationPlan.peakAllocatedByteLength,
    actualLanePeak,
    JSON.stringify(lane.allocationEntries().map((entry) => [entry.role, entry.buffer.size]))
  );

  const passes = encoder.events.filter((event) => event.kind === 'pass');
  const initIndices = passes
    .map((event, index) => event.pipeline?.endsWith('source-metadata-initializer') ? index : -1)
    .filter((index) => index >= 0);
  const emitIndices = passes
    .map((event, index) => event.pipeline?.endsWith('builder-emit-occupancy') ? index : -1)
    .filter((index) => index >= 0);
  assert.equal(initIndices.length, 2);
  assert.equal(emitIndices.length, 2);
  assert.ok(initIndices[0] < emitIndices[0]);
  assert.ok(initIndices[1] < emitIndices[1]);
  assert.equal(encoder.events.some((event) => event.kind === 'copy'
    && (event.source.endsWith('-chart-level-rows')
      || event.source.endsWith('-source-support-assignment-rows'))), false);
  const firstMetadataBindGroup = device.bindGroups.find(
    (entry) => entry.label?.endsWith('-source-metadata')
  );
  assert.equal(
    firstMetadataBindGroup.entries.find((entry) => entry.binding === 0).resource.buffer,
    first.resources.scratch.metadata.buffer
  );
  assert.equal(
    firstMetadataBindGroup.entries.find((entry) => entry.binding === 1).resource.buffer,
    first.resources.outputs.sourceCandidateCsr.buffer
  );

  const admission = resolveResidentNeighborhoodConsumer({
    residentNeighborhood: second,
    device,
    consumer: 'thermal',
    sourceCount: 4,
    ...second.productionLaneValidation
  });
  assert.equal(admission.admitted, true);
  assert.equal(admission.expectedIdentity.generation, 22);
  assert.equal(admission.expectedIdentity.positionEpoch, 42);

  const unchangedAdmission = residentNeighborhoodGenerationReuseAdmission({
    lane,
    generation: second,
    positionMutationApplied: false
  });
  assert.equal(unchangedAdmission.reusable, true);
  assert.equal(unchangedAdmission.currentGenerationAdmitted, true);
  assert.equal(unchangedAdmission.consumerRequirementsUnchanged, true);
  assert.deepEqual(unchangedAdmission.reasonCodes, []);

  const mutatedAdmission = residentNeighborhoodGenerationReuseAdmission({
    lane,
    generation: second,
    positionMutationApplied: true
  });
  assert.equal(mutatedAdmission.reusable, false);
  assert.deepEqual(mutatedAdmission.reasonCodes, ['position-mutation-applied']);

  const otherLaneAdmission = residentNeighborhoodGenerationReuseAdmission({
    lane: {},
    generation: second,
    positionMutationApplied: false
  });
  assert.equal(otherLaneAdmission.reusable, false);
  assert.equal(otherLaneAdmission.consumerRequirementsUnchanged, false);
  assert.deepEqual(otherLaneAdmission.reasonCodes, ['consumer-requirements-changed']);

  assert.equal(first.releaseProductionLaneGeneration(), true);
  assert.equal(first.released, true);
  lane.destroy();
  assert.equal(second.released, true);
  assert.equal(positionBuffer.destroyed, false);
});

test('bounded uniform-chart lane selects dense-grid while external metadata falls back to radix', () => {
  const device = createFakeDevice();
  const denseLane = createResidentNeighborhoodGpuLane(device, {
    sourceCount: 300,
    supportDistanceM: 0.25,
    cellSizeM: 1,
    originM: [-10, -10, -10],
    denseUniformChart: {
      minCell: [0, 0, 0],
      dimensions: [300, 1, 1]
    },
    consumers: ['mechanics'],
    maxCandidatesPerSource: 1,
    candidateCapacity: 300,
    builderStrategy: 'auto',
    laneId: 'compute-manager-dense-grid-lane',
    stateKey: 'test/dense-grid-state'
  });
  assert.equal(denseLane.builderStrategy, 'dense-grid');
  assert.equal(denseLane.denseUniformChart.admitted, true);
  assert.equal(denseLane.denseUniformChart.gridCellCount, 300);
  assert.ok(
    denseLane.builderStrategyPlan.denseGridDispatchCount
      < denseLane.builderStrategyPlan.radixDispatchCount
  );

  const externalLane = createResidentNeighborhoodGpuLane(device, {
    sourceCount: 300,
    supportDistanceM: 0.25,
    cellSizeM: 1,
    originM: [-10, -10, -10],
    denseUniformChart: {
      minCell: [0, 0, 0],
      dimensions: [300, 1, 1]
    },
    consumers: ['mechanics'],
    maxCandidatesPerSource: 1,
    candidateCapacity: 300,
    builderStrategy: 'auto',
    sourceMetadataMode: 'external-gpu-per-source',
    laneId: 'compute-manager-external-grid-lane',
    stateKey: 'test/external-grid-state'
  });
  assert.equal(externalLane.builderStrategy, 'radix');
  assert.equal(externalLane.denseUniformChart.admitted, false);
  assert.equal(
    externalLane.denseUniformChart.admissionReason,
    'source-metadata-is-not-uniform-single-chart'
  );
  const multichartLane = createResidentNeighborhoodGpuLane(device, {
    sourceCount: 300,
    supportDistanceM: 0.25,
    cellSizeM: 1,
    denseUniformChart: { minCell: [0, 0, 0], dimensions: [300, 1, 1] },
    consumers: ['mechanics'],
    supportClasses: [{
      supportClassId: 0,
      consumerMask: RESIDENT_NEIGHBORHOOD_CONSUMER.MECHANICS,
      minLevelDelta: 0,
      maxLevelDelta: 0,
      cellRadius: 1,
      maxCandidatesPerSource: 1,
      flags: RESIDENT_NEIGHBORHOOD_SUPPORT_FLAG.EXACT_NEAR_REQUIRED
        | RESIDENT_NEIGHBORHOOD_SUPPORT_FLAG.INCLUDE_SOURCE_CELL
        | RESIDENT_NEIGHBORHOOD_SUPPORT_FLAG.CROSS_CHART
    }],
    maxCandidatesPerSource: 1,
    candidateCapacity: 300,
    builderStrategy: 'auto',
    laneId: 'compute-manager-multichart-grid-lane',
    stateKey: 'test/multichart-grid-state'
  });
  assert.equal(multichartLane.builderStrategy, 'radix');
  assert.equal(
    multichartLane.denseUniformChart.admissionReason,
    'support-classes-require-multichart-or-multilevel-search'
  );
  assert.throws(() => createResidentNeighborhoodGpuLane(device, {
    sourceCount: 300,
    supportDistanceM: 0.25,
    cellSizeM: 1,
    denseUniformChart: { minCell: [0, 0, 0], dimensions: [300, 1, 1] },
    consumers: ['mechanics'],
    maxCandidatesPerSource: 1,
    candidateCapacity: 300,
    builderStrategy: 'dense-grid',
    sourceMetadataMode: 'external-gpu-per-source'
  }), /requires an admitted dense uniform chart/);
  denseLane.destroy();
  externalLane.destroy();
  multichartLane.destroy();
});

test('GPU skin proof preserves admitted CSR and gates all conditional rebuild work indirectly', () => {
  const device = createFakeDevice();
  const positionBuffer = device.createBuffer({
    label: 'skin-proof-particle-state',
    size: 64 * 8 * 4,
    usage: 128
  });
  const lane = createResidentNeighborhoodGpuLane(device, {
    sourceCount: 64,
    supportDistanceM: 0.4,
    cellSizeM: 0.4,
    skinDistanceM: 0.2,
    consumers: ['mechanics', 'thermal', 'reaction'],
    maxCandidatesPerSource: 8,
    candidateCapacity: 512,
    builderStrategy: 'radix',
    generationBase: 3,
    positionEpochBase: 7,
    laneId: 'compute-manager-lane-test',
    stateKey: 'test/hot-state'
  });
  const firstEncoder = createFakeEncoder();
  const first = lane.encodeGeneration(firstEncoder, {
    positionBuffer,
    leaseAuthorityIdentity: leaseIdentity(),
    generation: 3,
    positionEpoch: 7
  });
  assert.equal(first.productionLane.skinReuse.gpuProofEncoded, false);
  assert.equal(
    first.productionLane.skinReuse.referenceCapture,
    'skin-reference-capture-initial-build'
  );

  const secondEncoder = createFakeEncoder();
  const second = lane.encodeGeneration(secondEncoder, {
    positionBuffer,
    leaseAuthorityIdentity: leaseIdentity(),
    generation: 4,
    positionEpoch: 8
  });
  assert.equal(second.productionLane.skinReuse.gpuProofEncoded, true);
  assert.equal(second.productionLane.skinReuse.conditionalRebuildEncoded, true);
  assert.equal(second.productionLane.skinReuse.shaderWorkSkippedWhenReuseAdmitted, true);
  assert.equal(second.productionLane.skinReuse.encodedDispatchCommandsStillPresent, true);
  assert.equal(second.productionLane.mapPerformed, false);
  assert.equal(second.productionLane.readbackPerformed, false);
  assert.ok(second.productionLaneValidation.gpuSkinReuseProof.evidenceBuffer);
  assert.ok(second.productionLaneValidation.gpuSkinReuseProof.referencePositionBuffer);
  assert.match(residentNeighborhoodSkinReuseProofWgsl, /atomicMax\(&proof_evidence\[0u\]/);
  assert.match(
    residentNeighborhoodSkinReuseProofWgsl,
    /4\.0 \* max_distance_squared <= skin_distance \* skin_distance/
  );
  assert.match(residentNeighborhoodSkinReuseProofWgsl, /packed_candidate_csr\[4u\] = p\(4u\)/);
  const conditionalPasses = secondEncoder.events.filter((event) => event.kind === 'pass');
  const conditionalCommands = conditionalPasses.flatMap((event) => event.commands || []);
  assert.ok(conditionalCommands.some(
    (command) => command.pipeline?.endsWith('skin-measure-displacement')
  ));
  assert.ok(conditionalCommands.some(
    (command) => command.pipeline?.endsWith('skin-finalize-reuse')
  ));
  const commandIndex = (suffix) => conditionalCommands.findIndex(
    (command) => command.pipeline?.endsWith(suffix)
  );
  assert.equal(second.productionLane.encodingTelemetry.encodedComputePassCount, 5);
  assert.equal(conditionalPasses.length, 5);
  assert.ok(commandIndex('skin-finalize-reuse') < commandIndex('source-metadata-initializer'));
  assert.ok(commandIndex('source-metadata-initializer')
    < commandIndex('builder-initialize-conditional-generation'));
  assert.ok(commandIndex('builder-initialize-conditional-generation')
    < commandIndex('builder-emit-occupancy'));
  assert.ok(commandIndex('builder-fill-candidates') < commandIndex('skin-capture-reference'));
  assert.ok(conditionalPasses.some((event) => (
    event.pipeline?.endsWith('skin-capture-reference') && event.dispatchIndirect
  )));
  const conditionalBuilderPasses = conditionalPasses.filter((event) => (
    event.pipeline?.includes('-builder-')
      && !event.pipeline.endsWith('source-metadata-initializer')
  ));
  assert.ok(conditionalBuilderPasses.length > 0);
  assert.equal(
    conditionalBuilderPasses.every((event) => event.dispatchIndirect !== undefined),
    true
  );
  const authoritativeCopies = secondEncoder.events.filter((event) => (
    event.kind === 'copy'
      && (event.destination.includes('packed-source-candidate-csr')
        || event.destination.includes('cell-csr'))
  ));
  assert.deepEqual(authoritativeCopies, []);
  const allocationRoles = lane.allocationEntries().map((entry) => entry.role);
  assert.ok(allocationRoles.includes('resident-neighborhood-skin-reference-positions'));
  assert.ok(allocationRoles.includes('resident-neighborhood-skin-proof-evidence'));
  assert.ok(allocationRoles.includes('resident-neighborhood-skin-dispatch-bank'));
  lane.destroy();
});

test('direct builder uses the same GPU skin proof instead of rebuilding every small-source generation', () => {
  const device = createFakeDevice();
  const positionBuffer = device.createBuffer({
    label: 'direct-skin-proof-particle-state',
    size: 64 * 8 * 4,
    usage: 128
  });
  const lane = createResidentNeighborhoodGpuLane(device, {
    sourceCount: 64,
    supportDistanceM: 0.4,
    cellSizeM: 0.4,
    skinDistanceM: 0.2,
    consumers: ['mechanics', 'thermal', 'reaction'],
    maxCandidatesPerSource: 8,
    candidateCapacity: 512,
    builderStrategy: 'direct',
    generationBase: 3,
    positionEpochBase: 7,
    laneId: 'compute-manager-lane-test',
    stateKey: 'test/hot-state'
  });
  assert.equal(lane.builderStrategy, 'direct');
  assert.equal(lane.skinReuseEnabled, true);
  assert.equal(lane.skinDistanceM, 0.2);

  const firstEncoder = createFakeEncoder();
  const first = lane.encodeGeneration(firstEncoder, {
    positionBuffer,
    leaseAuthorityIdentity: leaseIdentity(),
    generation: 3,
    positionEpoch: 7
  });
  assert.equal(first.productionLane.skinReuse.gpuProofEncoded, false);
  assert.equal(
    first.productionLane.skinReuse.referenceCapture,
    'skin-reference-capture-initial-build'
  );

  const secondEncoder = createFakeEncoder();
  const second = lane.encodeGeneration(secondEncoder, {
    positionBuffer,
    leaseAuthorityIdentity: leaseIdentity(),
    generation: 4,
    positionEpoch: 8
  });
  assert.equal(second.productionLane.builderStrategy, 'direct');
  assert.equal(second.productionLane.skinReuse.gpuProofEncoded, true);
  assert.equal(second.productionLane.skinReuse.shaderWorkSkippedWhenReuseAdmitted, true);
  assert.equal(second.productionLane.skinReuse.encodedConditionalIndirectDispatchCount, 8);
  assert.equal(second.productionLane.encodingTelemetry.conditionalGeneration, true);
  assert.equal(second.productionLane.skinReuse.groupedConditionalAuxiliaryPasses, true);
  assert.equal(second.productionLane.encodingTelemetry.encodedComputePassCount, 2);
  const directConditionalPasses = secondEncoder.events.filter((event) => event.kind === 'pass');
  assert.equal(directConditionalPasses.length, 2);
  const directConditionalCommands = directConditionalPasses.flatMap(
    (event) => event.commands || []
  );
  const directCommandIndex = (suffix) => directConditionalCommands.findIndex(
    (command) => command.pipeline?.endsWith(suffix)
  );
  assert.ok(directCommandIndex('skin-finalize-reuse')
    < directCommandIndex('source-metadata-initializer'));
  assert.ok(directCommandIndex('builder-fill-candidates-direct')
    < directCommandIndex('skin-capture-reference'));
  const conditionalBuilderCommands = secondEncoder.events
    .flatMap((event) => event.commands || [])
    .filter((command) => (
      command.pipeline?.includes('-builder-')
        && !command.pipeline.endsWith('source-metadata-initializer')
    ));
  assert.ok(conditionalBuilderCommands.length > 0);
  assert.equal(
    conditionalBuilderCommands.every((command) => command.dispatchIndirect !== undefined),
    true
  );
  assert.equal(
    secondEncoder.events.some((event) => (
      event.kind === 'copy'
        && (event.destination.includes('packed-source-candidate-csr')
          || event.destination.includes('cell-csr'))
    )),
    false
  );
  first.releaseProductionLaneGeneration();
  second.releaseProductionLaneGeneration();
  lane.destroy();
});

test('49-generation repeat benchmark reuses host templates and conditional bind groups', (t) => {
  const device = createFakeDevice();
  const positionBuffer = device.createBuffer({
    label: 'repeat-generation-particle-state',
    size: 4 * 8 * 4,
    usage: 128
  });
  const lane = createResidentNeighborhoodGpuLane(device, {
    sourceCount: 4,
    supportDistanceM: 0.4,
    cellSizeM: 0.4,
    consumers: ['mechanics'],
    maxCandidatesPerSource: 8,
    candidateCapacity: 32,
    builderStrategy: 'radix',
    skinDistanceM: 0.2,
    retainedGenerationSlotCount: 49,
    generationBase: 1,
    positionEpochBase: 1,
    laneId: 'compute-manager-lane-test',
    stateKey: 'test/hot-state'
  });

  const encodeBatch = (generationBase) => {
    const encoder = createFakeEncoder();
    const bindGroupCountBefore = device.bindGroups.length;
    const startedAt = performance.now();
    const builds = Array.from({ length: 49 }, (_, index) => lane.encodeGeneration(encoder, {
      positionBuffer,
      positionStrideU32: 8,
      leaseAuthorityIdentity: leaseIdentity(),
      generation: generationBase + index,
      positionEpoch: generationBase + index
    }));
    const encodeWallMs = performance.now() - startedAt;
    const telemetry = builds.map((build) => build.productionLane.encodingTelemetry);
    return {
      encoder,
      builds,
      telemetry,
      encodeWallMs,
      actualBindGroupCreationCount: device.bindGroups.length - bindGroupCountBefore,
      telemetryBindGroupCreationCount: telemetry.reduce(
        (sum, entry) => sum + entry.bindGroupCreationCount,
        0
      ),
      telemetryBindGroupReuseCount: telemetry.reduce(
        (sum, entry) => sum + entry.bindGroupReuseCount,
        0
      ),
      hostEncodingAllocationProxyCount: telemetry.reduce(
        (sum, entry) => sum + entry.hostEncodingAllocationProxyCount,
        0
      ),
      encodedComputePassCount: telemetry.reduce(
        (sum, entry) => sum + entry.encodedComputePassCount,
        0
      )
    };
  };

  const cold = encodeBatch(1);
  for (const build of cold.builds) build.releaseProductionLaneGeneration();
  const warm = encodeBatch(50);
  for (const build of warm.builds) build.releaseProductionLaneGeneration();
  const steady = encodeBatch(99);

  assert.equal(cold.builds.length, 49);
  assert.equal(warm.builds.length, 49);
  assert.equal(steady.builds.length, 49);
  assert.equal(cold.telemetry[0].conditionalGeneration, false);
  assert.ok(cold.telemetry.slice(1).every((entry) => entry.conditionalGeneration));
  assert.ok(warm.telemetry.every((entry) => entry.conditionalGeneration));
  assert.ok(steady.telemetry.every((entry) => entry.conditionalGeneration));
  assert.equal(cold.encodedComputePassCount, 7 + 48 * 5);
  assert.equal(warm.encodedComputePassCount, 49 * 5);
  assert.equal(steady.encodedComputePassCount, 49 * 5);
  assert.equal(
    warm.encoder.events.filter((event) => event.kind === 'pass').length,
    warm.encodedComputePassCount
  );
  assert.equal(new Set(warm.telemetry.map((entry) => entry.encodedDispatchCount)).size, 1);
  assert.equal(
    warm.telemetry[0].encodedDispatchCount,
    cold.telemetry[1].encodedDispatchCount
  );
  assert.equal(warm.telemetry[0].perGenerationControlArrayAllocationCount, 0);
  assert.equal(warm.telemetry[0].perGenerationMetadataControlArrayAllocationCount, 0);
  assert.equal(warm.telemetry[0].retainedHostTemplateWriteCount, 6);
  assert.equal(
    warm.telemetry[0].conditionalPassGrouping,
    'skin-proof-prefix-radix-postfix-legal-pass-groups'
  );
  assert.equal(warm.telemetry[0].skinGateStorageToIndirectPassBoundaryPreserved, true);
  assert.ok(
    warm.telemetryBindGroupCreationCount < cold.telemetryBindGroupCreationCount / 10
  );
  assert.ok(warm.telemetryBindGroupReuseCount > cold.telemetryBindGroupReuseCount);
  assert.ok(
    warm.hostEncodingAllocationProxyCount < cold.hostEncodingAllocationProxyCount / 10
  );
  assert.equal(steady.telemetryBindGroupCreationCount, 0);
  assert.equal(steady.hostEncodingAllocationProxyCount, 0);
  assert.equal(
    warm.actualBindGroupCreationCount,
    warm.telemetryBindGroupCreationCount
  );
  assert.ok(Number.isFinite(cold.encodeWallMs) && cold.encodeWallMs >= 0);
  assert.ok(Number.isFinite(warm.encodeWallMs) && warm.encodeWallMs >= 0);
  t.diagnostic(JSON.stringify({
    generationCount: 49,
    coldEncodeWallMs: cold.encodeWallMs,
    warmEncodeWallMs: warm.encodeWallMs,
    steadyEncodeWallMs: steady.encodeWallMs,
    coldPassCount: cold.encodedComputePassCount,
    warmPassCount: warm.encodedComputePassCount,
    previousConditionalPassCount: 49 * 7,
    coldBindGroupCreationCount: cold.telemetryBindGroupCreationCount,
    warmBindGroupCreationCount: warm.telemetryBindGroupCreationCount,
    steadyBindGroupCreationCount: steady.telemetryBindGroupCreationCount,
    coldHostEncodingAllocationProxyCount: cold.hostEncodingAllocationProxyCount,
    warmHostEncodingAllocationProxyCount: warm.hostEncodingAllocationProxyCount,
    steadyHostEncodingAllocationProxyCount: steady.hostEncodingAllocationProxyCount
  }));

  for (const build of steady.builds) build.releaseProductionLaneGeneration();
  lane.destroy();
});

test('auto-direct exact-capacity lane exposes the masked fixed-segment topology', () => {
  const device = createFakeDevice();
  const positionBuffer = device.createBuffer({
    label: 'auto-direct-segmented-particle-state',
    size: 4 * 8 * 4,
    usage: 128
  });
  const lane = createResidentNeighborhoodGpuLane(device, {
    sourceCount: 4,
    supportDistanceM: 0.4,
    cellSizeM: 0.4,
    consumers: ['mechanics', 'thermal'],
    maxCandidatesPerSource: 4,
    candidateCapacity: 16,
    builderStrategy: 'auto',
    directSegmentedMasked: true,
    skinDistanceM: 0.2,
    generationBase: 3,
    positionEpochBase: 7,
    laneId: 'compute-manager-lane-test',
    stateKey: 'test/hot-state'
  });
  const encoder = createFakeEncoder();
  const generation = lane.encodeGeneration(encoder, {
    positionBuffer,
    leaseAuthorityIdentity: leaseIdentity(),
    generation: 3,
    positionEpoch: 7
  });

  assert.equal(lane.builderStrategy, 'direct');
  assert.equal(lane.directSegmentedMasked, true);
  assert.equal(generation.directSegmentedMasked, true);
  assert.equal(generation.productionLane.directSegmentedMasked, true);
  assert.equal(generation.productionLane.encodingTelemetry.encodedDispatchCount, 3);
  assert.ok(encoder.events.some((event) => (
    event.commands?.some((command) => (
      command.pipeline?.endsWith('build-candidates-direct-segmented-masked')
    ))
  )));
  const continuationEncoder = createFakeEncoder();
  const continuation = lane.encodeGeneration(continuationEncoder, {
    positionBuffer,
    leaseAuthorityIdentity: leaseIdentity(),
    generation: 4,
    positionEpoch: 8
  });
  const continuationBuilderCommands = continuationEncoder.events
    .flatMap((event) => event.commands || [])
    .filter((command) => command.pipeline?.includes('-builder-'));
  assert.equal(continuation.directSegmentedMasked, true);
  assert.equal(continuation.productionLane.skinReuse.gpuProofEncoded, true);
  assert.equal(
    continuation.productionLane.skinReuse.encodedConditionalIndirectDispatchCount,
    3
  );
  assert.equal(continuation.productionLane.encodingTelemetry.encodedDispatchCount, 5);
  assert.equal(continuation.productionLane.encodingTelemetry.encodedComputePassCount, 2);
  assert.equal(continuation.productionLane.encodingTelemetry.bindGroupCreationCount, 5);
  assert.equal(continuationBuilderCommands.length, 1);
  assert.ok(continuationBuilderCommands[0].dispatchIndirect);
  assert.equal(
    continuationEncoder.events.flatMap((event) => event.commands || [])
      .some((command) => command.pipeline?.includes('initialize-conditional-generation')),
    false
  );
  generation.releaseProductionLaneGeneration();
  continuation.releaseProductionLaneGeneration();
  lane.destroy();
});

test('external per-source metadata supports multiple charts, levels, and support classes', () => {
  const device = createFakeDevice();
  const encoder = createFakeEncoder();
  const positionBuffer = device.createBuffer({ label: 'positions', size: 4 * 8 * 4, usage: 128 });
  const chartLevelBuffer = device.createBuffer({ label: 'external-chart-levels', size: 4 * 8 * 4, usage: 128 });
  const sourceSupportAssignmentBuffer = device.createBuffer({
    label: 'external-support-assignments',
    size: 4 * 8 * 4,
    usage: 128
  });
  const supportClassBuffer = device.createBuffer({
    label: 'external-support-classes',
    size: 2 * 8 * 4,
    usage: 128
  });
  const supportClasses = [
    {
      supportClassId: 3,
      consumerMask: RESIDENT_NEIGHBORHOOD_CONSUMER.MECHANICS,
      minLevelDelta: -1,
      maxLevelDelta: 1,
      cellRadius: 2,
      maxCandidatesPerSource: 8,
      flags: RESIDENT_NEIGHBORHOOD_SUPPORT_FLAG.CROSS_LEVEL
    },
    {
      supportClassId: 7,
      consumerMask: RESIDENT_NEIGHBORHOOD_CONSUMER.THERMAL
        | RESIDENT_NEIGHBORHOOD_CONSUMER.RADIATION,
      minLevelDelta: -2,
      maxLevelDelta: 2,
      cellRadius: 4,
      maxCandidatesPerSource: 8,
      flags: RESIDENT_NEIGHBORHOOD_SUPPORT_FLAG.CROSS_LEVEL
    }
  ];
  const assignments = Array.from({ length: 4 }, () => ({
    mechanics: 3,
    thermal: 7,
    radiation: 7
  }));
  const lane = createResidentNeighborhoodGpuLane(device, {
    sourceCount: 4,
    supportDistanceM: 0.4,
    cellSizeM: 0.2,
    consumers: ['mechanics', 'thermal', 'radiation'],
    supportClasses,
    sourceSupportAssignments: assignments,
    sourceMetadataMode: 'external-gpu-per-source',
    maxCandidatesPerSource: 8,
    candidateCapacity: 32,
    laneId: 'compute-manager-lane-test',
    stateKey: 'test/hot-state'
  });
  const build = lane.encodeGeneration(encoder, {
    positionBuffer,
    chartLevelBuffer,
    supportClassBuffer,
    sourceSupportAssignmentBuffer,
    leaseAuthorityIdentity: leaseIdentity()
  });

  assert.equal(build.hostAdmission, true);
  assert.equal(build.descriptor.supportClasses.length, 2);
  assert.equal(build.descriptor.sourceSupportAssignments.rowCount, 4);
  assert.equal(build.productionLane.sourceMetadataInitialization, 'external-gpu-per-source-same-device');
  assert.equal(
    encoder.events.some((event) => event.pipeline?.endsWith('source-metadata-initializer')),
    false
  );
  assert.ok(encoder.events.some((event) => event.kind === 'copy'
    && event.source === 'external-chart-levels'));
  assert.ok(encoder.events.some((event) => event.kind === 'copy'
    && event.source === 'external-support-assignments'));
  lane.destroy();
  assert.equal(chartLevelBuffer.destroyed, false);
  assert.equal(supportClassBuffer.destroyed, false);
});

test('pooled lane reuses one command-ordered arena across a bounded two-submission window', async () => {
  const device = createFakeDevice();
  const options = {
    sourceCount: 4,
    supportDistanceM: 0.4,
    cellSizeM: 0.4,
    consumers: ['mechanics'],
    maxCandidatesPerSource: 8,
    candidateCapacity: 32,
    laneId: 'compute-manager-lane-test',
    stateKey: 'test/hot-state',
    leaseAuthorityIdentity: leaseIdentity()
  };
  const positionBuffer = device.createBuffer({
    label: 'ordered-window-particle-state',
    size: 4 * 8 * 4,
    usage: 128
  });
  const first = acquireResidentNeighborhoodGpuLane(device, options);
  assert.equal(first.reused, false);
  assert.equal(first.inFlightSubmissionCountAtAcquire, 1);
  assert.equal(first.maxInFlightSubmissions, 2);
  const second = acquireResidentNeighborhoodGpuLane(device, {
    ...options,
    generationBase: 10,
    positionEpochBase: 10,
    leaseAuthorityIdentity: leaseIdentity({ leaseId: 'compute-manager-lease-2' })
  });
  assert.equal(second.reused, true);
  assert.equal(second.lane, first.lane);
  assert.equal(second.acquisitionOrdinal, 2);
  assert.equal(second.inFlightSubmissionCountAtAcquire, 2);
  const firstBuild = first.encodeGeneration(createFakeEncoder(), { positionBuffer });
  const secondBuild = second.encodeGeneration(createFakeEncoder(), { positionBuffer });
  assert.equal(firstBuild.descriptor.generation, 1);
  assert.equal(secondBuild.descriptor.generation, 10);
  assert.equal(firstBuild.encoded, true);
  assert.equal(secondBuild.encoded, true);
  assert.throws(
    () => acquireResidentNeighborhoodGpuLane(device, options),
    (error) => error.code === 'ERR_RESIDENT_NEIGHBORHOOD_LANE_IN_FLIGHT'
      && error.inFlightCount === 2
      && error.maxInFlightSubmissions === 2
  );
  let settleFirstSubmission;
  const firstSubmissionCompleted = new Promise((resolve) => {
    settleFirstSubmission = resolve;
  });
  const fencedRelease = first.releaseAfterSubmittedWork(firstSubmissionCompleted);
  assert.notEqual(firstBuild.released, true);
  settleFirstSubmission();
  assert.equal(await fencedRelease, true);
  assert.equal(firstBuild.released, true);
  assert.notEqual(secondBuild.released, true);

  const third = acquireResidentNeighborhoodGpuLane(device, {
    ...options,
    generationBase: 20,
    positionEpochBase: 20,
    leaseAuthorityIdentity: leaseIdentity({ leaseId: 'compute-manager-lease-3' })
  });
  assert.equal(third.reused, true);
  assert.equal(third.lane, first.lane);
  assert.equal(third.acquisitionOrdinal, 3);
  assert.equal(third.inFlightSubmissionCountAtAcquire, 2);
  const generationMetadataBufferCount = device.buffers.filter(
    (buffer) => buffer.label.endsWith('-generation-metadata-control-arena')
  ).length;
  assert.equal(generationMetadataBufferCount, 1);
  assert.equal(
    device.buffers.filter((buffer) => buffer.label.endsWith('-generation-params-arena')
      || buffer.label.endsWith('-generation-data-arena')).length,
    2
  );
  assert.equal(first.lane.retainedGenerationSlotCount, 128);
  assert.ok(first.lane.retainedGenerationSlotCount >= 2 * 49);
  assert.equal(
    firstBuild.resources.scratch.params.buffer,
    secondBuild.resources.scratch.params.buffer
  );
  assert.notEqual(
    firstBuild.resources.scratch.params.byteOffset,
    secondBuild.resources.scratch.params.byteOffset
  );
  const thirdBuild = third.encodeGeneration(createFakeEncoder(), { positionBuffer });
  assert.equal(thirdBuild.encoded, true);
  assert.equal(
    device.buffers.filter(
      (buffer) => buffer.label.includes('-generation-metadata-arena-')
        || buffer.label.endsWith('-generation-metadata-control-arena')
    ).length,
    generationMetadataBufferCount,
    'a completed acquisition recycles its metadata buffers without warm-path allocation'
  );
  second.release();
  third.release();
  assert.equal(destroyResidentNeighborhoodGpuLanePool(device), 1);
});

test('pooled lane keeps segmented and compact direct pipeline contracts separate', () => {
  const device = createFakeDevice();
  const options = {
    sourceCount: 4,
    supportDistanceM: 0.4,
    cellSizeM: 0.4,
    consumers: ['mechanics'],
    maxCandidatesPerSource: 4,
    candidateCapacity: 16,
    builderStrategy: 'auto',
    laneId: 'compute-manager-lane-test',
    stateKey: 'test/hot-state'
  };
  const compact = acquireResidentNeighborhoodGpuLane(device, {
    ...options,
    directSegmentedMasked: false,
    leaseAuthorityIdentity: leaseIdentity({ leaseId: 'compact-direct-lease' })
  });
  const segmented = acquireResidentNeighborhoodGpuLane(device, {
    ...options,
    directSegmentedMasked: true,
    leaseAuthorityIdentity: leaseIdentity({ leaseId: 'segmented-direct-lease' })
  });

  assert.equal(compact.reused, false);
  assert.equal(segmented.reused, false);
  assert.notEqual(compact.lane, segmented.lane);
  compact.release();
  segmented.release();
  assert.equal(destroyResidentNeighborhoodGpuLanePool(device), 2);
});

test('pooled acquisitions keep generation and position epochs acquisition-local and monotonic', () => {
  const device = createFakeDevice();
  const encoder = createFakeEncoder();
  const positionBuffer = device.createBuffer({
    label: 'retained-particle-state',
    size: 4 * 8 * 4,
    usage: 128
  });
  const options = {
    sourceCount: 4,
    supportDistanceM: 0.4,
    cellSizeM: 0.4,
    consumers: ['mechanics'],
    maxCandidatesPerSource: 8,
    candidateCapacity: 32,
    laneId: 'compute-manager-lane-test',
    stateKey: 'test/hot-state'
  };

  const first = acquireResidentNeighborhoodGpuLane(device, {
    ...options,
    generationBase: 1,
    positionEpochBase: 1,
    leaseAuthorityIdentity: leaseIdentity()
  });
  const firstA = first.encodeGeneration(encoder, { positionBuffer, substepIndex: 0 });
  const firstB = first.encodeGeneration(encoder, { positionBuffer, substepIndex: 1 });
  assert.deepEqual(
    [firstA.descriptor.generation, firstB.descriptor.generation],
    [1, 2]
  );
  assert.deepEqual(
    [
      firstA.descriptor.positionValidity.positionEpoch,
      firstB.descriptor.positionValidity.positionEpoch
    ],
    [1, 2]
  );
  first.release();

  const second = acquireResidentNeighborhoodGpuLane(device, {
    ...options,
    generationBase: 3,
    positionEpochBase: 3,
    leaseAuthorityIdentity: leaseIdentity({ leaseId: 'compute-manager-lease-2' })
  });
  const secondA = second.encodeGeneration(encoder, { positionBuffer, substepIndex: 0 });
  const secondB = second.encodeGeneration(encoder, { positionBuffer, substepIndex: 1 });
  assert.equal(second.reused, true);
  assert.equal(second.lane, first.lane);
  assert.equal(second.generationBase, 3);
  assert.equal(second.positionEpochBase, 3);
  assert.deepEqual(
    [secondA.descriptor.generation, secondB.descriptor.generation],
    [3, 4]
  );
  assert.deepEqual(
    [
      secondA.descriptor.positionValidity.positionEpoch,
      secondB.descriptor.positionValidity.positionEpoch
    ],
    [3, 4]
  );

  const stale = resolveResidentNeighborhoodConsumer({
    residentNeighborhood: firstB,
    device,
    consumer: 'mechanics',
    sourceCount: 4,
    ...secondA.productionLaneValidation
  });
  assert.equal(stale.admitted, false);
  assert.ok(stale.reasonCodes.includes('generation-mismatch'));
  assert.ok(stale.reasonCodes.includes('positionEpoch-mismatch'));
  assert.ok(stale.reasonCodes.includes('leaseId-mismatch'));
  assert.ok(stale.reasonCodes.includes('leaseTokenLow-mismatch'));
  assert.ok(stale.reasonCodes.includes('leaseTokenHigh-mismatch'));

  second.release();
  assert.equal(destroyResidentNeighborhoodGpuLanePool(device), 1);
});

test('pooled acquisition fails before uint32 generation or position-epoch wrap', () => {
  const device = createFakeDevice();
  const positionBuffer = device.createBuffer({
    label: 'retained-particle-state',
    size: 4 * 8 * 4,
    usage: 128
  });
  const acquisition = acquireResidentNeighborhoodGpuLane(device, {
    sourceCount: 4,
    supportDistanceM: 0.4,
    cellSizeM: 0.4,
    consumers: ['mechanics'],
    maxCandidatesPerSource: 8,
    candidateCapacity: 32,
    generationBase: 0xffff_ffff,
    positionEpochBase: 0xffff_ffff,
    laneId: 'compute-manager-lane-test',
    stateKey: 'test/hot-state',
    leaseAuthorityIdentity: leaseIdentity()
  });
  assert.throws(
    () => acquisition.encodeGeneration(createFakeEncoder(), {
      positionBuffer,
      substepIndex: 1
    }),
    /exceeds uint32 range/
  );
  acquisition.release();
  assert.equal(destroyResidentNeighborhoodGpuLanePool(device), 1);
});
