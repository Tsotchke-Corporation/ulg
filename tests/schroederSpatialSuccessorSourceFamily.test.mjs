import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import {
  SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_FINAL_SEAL,
  SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_MAGIC,
  SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_STATUS,
  SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_VERSION
} from '../ulg-gpu-abi/src/schroederSpatialTopologyTransition.js';
import {
  SCHROEDER_SPATIAL_POSITION_TRANSITION_FINAL_SEAL,
  SCHROEDER_SPATIAL_POSITION_TRANSITION_MAGIC,
  SCHROEDER_SPATIAL_POSITION_TRANSITION_STATUS,
  SCHROEDER_SPATIAL_POSITION_TRANSITION_VERSION,
  acquireSchroederSpatialSuccessorSourceFamilyLease,
  abandonPreparedSchroederSpatialSuccessorSourceFamilyPublication,
  allocateSchroederSpatialSuccessorBufferFamilyIdentity,
  applySchroederSpatialPositionTransitionReceipt,
  createSchroederSpatialSuccessorSourceFamily,
  prepareSchroederSpatialSuccessorSourceFamilyPublication,
  publishPreparedSchroederSpatialSuccessorSourceFamily,
  releaseSchroederSpatialSuccessorSourceFamilyLease,
  releaseSchroederSpatialSuccessorSourceFamilyLeaseAfter,
  resolveSchroederSpatialSuccessorSourceFamily,
  retireSchroederSpatialSuccessorSourceFamily,
  retireSchroederSpatialSuccessorSourceFamilyAfterLeases,
  runSchroederSpatialPositionTransitionWebGpu,
  schroederSpatialSuccessorSourceFamilyLiveness,
  validateSchroederSpatialProductHistoryCommitGate,
  validateSchroederSpatialSuccessorPublicationReceipt
} from '../src/runtime/sph/schroederSpatialSuccessorSourceFamily.js';
import {
  registerResidentProductEventCountAuthority,
  revokeResidentProductEventCountAuthority
} from '../src/runtime/sph/sphResidentProductHistoryGpu.js';
import {
  applySchroederSpatialTopologyTransitionReceipt,
  runSchroederSpatialTopologyTransitionWebGpu
} from '../src/runtime/sph/schroederSpatialTopologyTransitionGpu.js';
import {
  tagWebGpuBufferDevice,
  webGpuDeviceId
} from '../src/runtime/sph/sphGpuDeviceIdentity.js';
import {
  SCHROEDER_SPATIAL_EPOCH_READER,
  SCHROEDER_SPATIAL_EPOCH_READER_PHASE,
  admitSchroederSpatialEpochTransactionReader,
  commitSchroederSpatialEpochTransaction,
  createSchroederSpatialEpochTransaction,
  sealSchroederSpatialEpochTransactionProposals,
  sealSchroederSpatialEpochTransactionReaders
} from '../src/runtime/sph/schroederSpatialEpochTransaction.js';

function activeMass(value) {
  return Number.isFinite(value) && value > 0;
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

function createFakeDevice() {
  let resolveDeviceLoss;
  const lost = new Promise((resolve) => {
    resolveDeviceLoss = resolve;
  });
  const buffers = [];
  const device = {
    buffers,
    lost,
    lose(info = { reason: 'destroyed', message: 'test device lost' }) {
      resolveDeviceLoss(info);
    },
    limits: { maxComputeWorkgroupsPerDimension: 65_535 },
    createBuffer(descriptor) {
      const buffer = {
        ...descriptor,
        destroyed: false,
        destroyCount: 0,
        destroy() {
          this.destroyed = true;
          this.destroyCount += 1;
        },
        async mapAsync() {},
        getMappedRange() {
          return this._mappedData?.buffer ?? new ArrayBuffer(descriptor.size);
        },
        unmap() {}
      };
      buffers.push(buffer);
      return buffer;
    },
    createShaderModule(descriptor) { return descriptor; },
    createBindGroupLayout(descriptor) { return descriptor; },
    createPipelineLayout(descriptor) { return descriptor; },
    createComputePipeline(descriptor) {
      return {
        descriptor,
        getBindGroupLayout() { return { label: `${descriptor.label}-layout` }; }
      };
    },
    createBindGroup(descriptor) { return descriptor; },
    createCommandEncoder() {
      let boundGroup = null;
      return {
        beginComputePass() {
          return {
            setPipeline() {},
            setBindGroup(index, value) { boundGroup = value; },
            dispatchWorkgroups() {},
            end() {}
          };
        },
        copyBufferToBuffer(source, sourceOffset, destination) {
          const entries = Object.fromEntries(
            boundGroup.entries.map((entry) => [entry.binding, entry.resource.buffer])
          );
          if (
            String(source?.label || '')
              .includes('spatial-position-transition-receipt')
          ) {
            const [
              sourceCount,
              successorCount,
              generationId,
              nonce,
              sourceEpoch
            ] = entries[2]._writtenData;
            const sourceMasses = entries[0]._masses
              ?? new Array(sourceCount).fill(1);
            const successorMasses = entries[1]._masses
              ?? new Array(successorCount).fill(1);
            const sourcePositions = entries[0]._positions
              ?? Array.from({ length: sourceCount }, (_, index) => [
                index, 0, 0
              ]);
            const successorPositions = entries[1]._positions
              ?? Array.from({ length: successorCount }, (_, index) => [
                index, 0, 0
              ]);
            const comparisonCount = Math.max(sourceCount, successorCount);
            let comparedActiveCount = 0;
            let movedParticleCount = 0;
            for (
              let index = 0;
              index < Math.min(sourceCount, successorCount);
              index += 1
            ) {
              if (
                !activeMass(sourceMasses[index])
                || !activeMass(successorMasses[index])
              ) continue;
              comparedActiveCount += 1;
              const sourcePosition = sourcePositions[index] ?? [index, 0, 0];
              const successorPosition =
                successorPositions[index] ?? [index, 0, 0];
              if (sourcePosition.some(
                (value, axis) => value !== successorPosition[axis]
              )) {
                movedParticleCount += 1;
              }
            }
            const changed = movedParticleCount > 0;
            const words = new Uint32Array(20);
            words.set([
              SCHROEDER_SPATIAL_POSITION_TRANSITION_MAGIC,
              SCHROEDER_SPATIAL_POSITION_TRANSITION_VERSION,
              generationId,
              nonce,
              sourceEpoch,
              sourceCount,
              successorCount,
              comparisonCount,
              comparisonCount,
              comparedActiveCount,
              movedParticleCount,
              0,
              0,
              1,
              changed ? 1 : 0,
              changed ? sourceEpoch + 1 : sourceEpoch,
              SCHROEDER_SPATIAL_POSITION_TRANSITION_STATUS.COMPLETE,
              0,
              0,
              SCHROEDER_SPATIAL_POSITION_TRANSITION_FINAL_SEAL
            ]);
            source._observedWords = words;
            destination._mappedData = words;
            return;
          }
          const [
            sourceCount,
            successorCount,
            generationId,
            nonce,
            sourceEpoch,
            forceAdvance
          ] = entries[2]._writtenData;
          const sourceMasses = entries[0]._masses;
          const successorMasses = entries[1]._masses;
          const comparisonCount = Math.max(sourceCount, successorCount);
          let sourceActiveCount = 0;
          let successorActiveCount = 0;
          let activatedCount = 0;
          let deactivatedCount = 0;
          for (let index = 0; index < comparisonCount; index += 1) {
            const sourceActive = index < sourceCount
              && activeMass(sourceMasses[index]);
            const successorActive = index < successorCount
              && activeMass(successorMasses[index]);
            if (sourceActive) sourceActiveCount += 1;
            if (successorActive) successorActiveCount += 1;
            if (sourceActive !== successorActive) {
              if (successorActive) activatedCount += 1;
              else deactivatedCount += 1;
            }
          }
          const xorCount = activatedCount + deactivatedCount;
          const changed = xorCount > 0 || forceAdvance === 1;
          const words = new Uint32Array(24);
          words.set([
            SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_MAGIC,
            SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_VERSION,
            generationId,
            nonce,
            sourceEpoch,
            sourceCount,
            successorCount,
            comparisonCount,
            1,
            comparisonCount,
            sourceActiveCount,
            successorActiveCount,
            activatedCount,
            deactivatedCount,
            xorCount,
            0,
            0,
            forceAdvance,
            1,
            changed ? 1 : 0,
            changed ? sourceEpoch + 1 : sourceEpoch,
            SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_STATUS.COMPLETE,
            0,
            SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_FINAL_SEAL
          ]);
          source._observedWords = words;
          destination._mappedData = words;
        },
        finish() { return { label: 'fake-successor-liveness-commands' }; }
      };
    },
    queue: {
      writeBuffer(buffer, offset, data) {
        buffer._writtenData = new data.constructor(data);
      },
      submit() {}
    }
  };
  return device;
}

function taggedBuffer(device, label, size, masses = null) {
  const buffer = tagWebGpuBufferDevice(device.createBuffer({
    label,
    size,
    usage: 128
  }), device);
  if (masses) buffer._masses = [...masses];
  return buffer;
}

async function successorFixture() {
  const particleCount = 3;
  const masses = [1, 1, 0];
  const device = createFakeDevice();
  const sourceStateBuffer = taggedBuffer(device, 'source-state', particleCount * 32, masses);
  const stateBuffer = taggedBuffer(device, 'successor-state', particleCount * 32, masses);
  const activeNodeBuffer = taggedBuffer(device, 'active-node', 4096);
  const directoryBuffer = taggedBuffer(device, 'directory', 4096);
  const sourceEpoch = {
    storageGeneration: 11,
    physicsTick: 17,
    physicsSubstep: 0,
    positionEpoch: 17,
    topologyEpoch: 7,
    chartEpoch: 2,
    levelEpoch: 17,
    supportEpoch: 17
  };
  const sourceParticleUploads = {
    sphParticleUpload: {
      schema: ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
      status: 'webgpu-uploaded',
      particleCount,
      stateBuffer: sourceStateBuffer,
      thermoBuffer: taggedBuffer(device, 'source-thermo', particleCount * 48),
      identityBuffer: taggedBuffer(device, 'source-identity', particleCount * 16),
      stateStrideBytes: 32,
      thermoStrideBytes: 48,
      identityStrideBytes: 16,
      ...sourceEpoch
    },
    mlsMpmParticleUpload: {
      schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
      status: 'webgpu-uploaded',
      particleCount,
      mechanicsBuffer: taggedBuffer(device, 'source-mechanics', particleCount * 128),
      mechanicsStrideBytes: 128,
      ...sourceEpoch
    }
  };
  const lookupAssignments = new Float32Array(particleCount * 16);
  // The highest physical slot is dormant in E* and will be activated by the
  // post-closure classifier in the prepared-publication tests.
  lookupAssignments[(particleCount - 1) * 16 + 6] = 0;
  const lookupAssignmentBuffer = taggedBuffer(
    device,
    'lookup-level-assignment',
    lookupAssignments.byteLength
  );
  const lookupLevelAssignment = {
    schema: ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA,
    assignmentSchema: 'peercompute.ulg.schroeder-level-assignment.v0',
    status: 'schroeder-level-assignment-submitted',
    bufferFamilyGenerationStatus:
      'schroeder-particle-buffer-family-generation-ready',
    particleCount,
    assignmentStrideFloats: 16,
    assignmentStrideBytes: 64,
    assignmentBuffer: lookupAssignmentBuffer,
    assignmentBufferByteLength: lookupAssignments.byteLength,
    assignments: lookupAssignments,
    sourceStateBuffer,
    sourceStateBufferBorrowed: true,
    sourceStateBufferByteLength: particleCount * 32,
    sourceThermoBuffer: sourceParticleUploads.sphParticleUpload.thermoBuffer,
    sourceThermoBufferBorrowed: true,
    sourceThermoBufferByteLength: particleCount * 48,
    sourceMechanicsBuffer:
      sourceParticleUploads.mlsMpmParticleUpload.mechanicsBuffer,
    sourceMechanicsBufferBorrowed: true,
    sourceMechanicsBufferByteLength: particleCount * 128,
    minLevel: 0,
    maxLevel: 1,
    chartId: 0,
    baseGridSpacingM: 0.25,
    ...sourceEpoch
  };
  const generation = {
    selected: true,
    ready: true,
    releaseScheduled: false,
    directoryBuildCount: 1,
    privateLookupBuildCount: 0,
    source: {
      ready: true,
      sourceCount: particleCount,
      sourceStateBuffer,
      activeNodeBuffer,
      ...sourceEpoch
    },
    execution: {
      generationId: 19,
      buildOrdinal: 19,
      sortUniqueOrdinal: 19,
      submitPerformed: true,
      deviceId: webGpuDeviceId(device),
      sourceCount: particleCount,
      activeNodeBuffer,
      directoryBuffer,
      ...sourceEpoch,
      released: false
    }
  };
  const topologyTransitionReceipt =
    await runSchroederSpatialTopologyTransitionWebGpu({
      device,
      generation,
      sourceStateBuffer,
      successorStateBuffer: stateBuffer,
      successorParticleCount: particleCount
    });
  const positionTransitionReceipt =
    await runSchroederSpatialPositionTransitionWebGpu({
      device,
      generation,
      sourceStateBuffer,
      successorStateBuffer: stateBuffer,
      successorParticleCount: particleCount
    });
  const successorEpoch = {
    storageGeneration: 12,
    physicsTick: 18,
    physicsSubstep: 0,
    positionEpoch: 18,
    topologyEpoch: 999,
    chartEpoch: 2,
    levelEpoch: 18,
    supportEpoch: 18
  };
  const buffers = {
    stateBuffer,
    thermoBuffer: taggedBuffer(device, 'successor-thermo', particleCount * 48),
    identityBuffer: taggedBuffer(device, 'successor-identity', particleCount * 16),
    mechanicsBuffer: taggedBuffer(device, 'successor-mechanics', particleCount * 128)
  };
  const nextParticleUploads = {
    sphParticleUpload: {
      schema: ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
      status: 'webgpu-uploaded',
      stateBuffer: buffers.stateBuffer,
      thermoBuffer: buffers.thermoBuffer,
      identityBuffer: buffers.identityBuffer,
      particleCount,
      ...successorEpoch,
      stateStrideBytes: 32,
      thermoStrideBytes: 48,
      identityStrideBytes: 16
    },
    mlsMpmParticleUpload: {
      schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
      status: 'webgpu-uploaded',
      mechanicsBuffer: buffers.mechanicsBuffer,
      particleCount,
      ...successorEpoch,
      mechanicsStrideBytes: 128
    }
  };
  applySchroederSpatialTopologyTransitionReceipt(
    nextParticleUploads,
    topologyTransitionReceipt,
    { generation }
  );
  applySchroederSpatialPositionTransitionReceipt(
    nextParticleUploads,
    positionTransitionReceipt,
    { generation }
  );
  const transaction = createSchroederSpatialEpochTransaction({
    device,
    generation,
    ...sourceParticleUploads
  });
  const readerInputs = { generation, ...sourceParticleUploads };
  admitSchroederSpatialEpochTransactionReader(transaction, {
    readerId: SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_P2G,
    phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.PRE_INTEGRATION,
    ...readerInputs
  });
  admitSchroederSpatialEpochTransactionReader(transaction, {
    readerId: SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_G2P,
    phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.INTEGRATION_COMMIT,
    ...readerInputs
  });
  sealSchroederSpatialEpochTransactionReaders(transaction);
  sealSchroederSpatialEpochTransactionProposals(transaction);
  const commitReceipt = commitSchroederSpatialEpochTransaction(transaction, {
    nextParticleUploads
  });
  const sourceFamily = createSchroederSpatialSuccessorSourceFamily({
    transaction,
    commitReceipt,
    generation,
    nextParticleUploads,
    topologyTransitionReceipt,
    componentOwnerStages: {
      state: 'successor-liveness-test',
      thermo: 'successor-liveness-test',
      identity: 'successor-liveness-test',
      mechanics: 'successor-liveness-test'
    }
  });
  return {
    device,
    sourceFamily,
    buffers,
    particleCount,
    generation,
    lookupLevelAssignment,
    topologyTransitionReceipt,
    positionTransitionReceipt,
    sourceParticleUploads,
    nextParticleUploads
  };
}

function preparedUploads(f) {
  const source = f.generation.execution;
  const nextParticleUploads = {
    sphParticleUpload: {
      ...f.nextParticleUploads.sphParticleUpload,
      physicsTick: source.physicsTick,
      physicsSubstep: source.physicsSubstep
    },
    mlsMpmParticleUpload: {
      ...f.nextParticleUploads.mlsMpmParticleUpload,
      physicsTick: source.physicsTick,
      physicsSubstep: source.physicsSubstep
    }
  };
  applySchroederSpatialTopologyTransitionReceipt(
    nextParticleUploads,
    f.topologyTransitionReceipt,
    { generation: f.generation }
  );
  applySchroederSpatialPositionTransitionReceipt(
    nextParticleUploads,
    f.positionTransitionReceipt,
    { generation: f.generation }
  );
  return nextParticleUploads;
}

function attachGpuCountProductHistory(f, nextParticleUploads, {
  generation = 71,
  seal = 0x715ea1
} = {}) {
  const rowCapacity = 32768;
  const rowStrideFloats = 32;
  const productEventBuffer = taggedBuffer(
    f.device,
    `successor-product-history-${generation}`,
    rowCapacity * rowStrideFloats * Float32Array.BYTES_PER_ELEMENT
  );
  const controlBuffer = taggedBuffer(
    f.device,
    `successor-product-history-control-${generation}`,
    256
  );
  const residentProductMass = {
    schema: 'peercompute.ulg.sph-resident-product-mass.v0',
    status: 'resident-product-mass-merged-gpu-resident',
    productEventBuffer,
    productEventBufferRetained: true,
    productEventBufferByteLength: productEventBuffer.size,
    productEventRowCount: rowCapacity,
    productEventStrideFloats: rowStrideFloats,
    productEventStrideBytes:
      rowStrideFloats * Float32Array.BYTES_PER_ELEMENT
  };
  const authority = registerResidentProductEventCountAuthority(
    residentProductMass,
    {
      device: f.device,
      controlBuffer,
      controlOffsetBytes: 0,
      rowCapacity,
      rowStrideFloats,
      generation,
      seal
    }
  );
  nextParticleUploads.residentProductMass = residentProductMass;
  return { residentProductMass, authority, productEventBuffer, controlBuffer };
}

async function preparedProductHistoryGateFixture() {
  const f = await successorFixture();
  const nextParticleUploads = preparedUploads(f);
  const productHistory = attachGpuCountProductHistory(
    f,
    nextParticleUploads
  );
  const classifier = createSuccessorClassifier(f, {
    activateHighSlot: false
  });
  const tx = transactionForSuccessor(f, nextParticleUploads);
  const plan = await prepareSchroederSpatialSuccessorSourceFamilyPublication({
    transaction: tx.transaction,
    generation: f.generation,
    lookupLevelAssignment: f.lookupLevelAssignment,
    nextParticleUploads,
    successorLevelAssignmentRunner: classifier.runner,
    topologyTransitionReceipt: f.topologyTransitionReceipt
  });
  return {
    f,
    nextParticleUploads,
    productHistory,
    classifier,
    tx,
    plan
  };
}

function createSuccessorClassifier(f, {
  activateHighSlot = true
} = {}) {
  const calls = [];
  const results = [];
  const runner = async (options) => {
    calls.push(options);
    const sph = options.nextParticleUploads.sphParticleUpload;
    const mls = options.nextParticleUploads.mlsMpmParticleUpload;
    const assignments = f.lookupLevelAssignment.assignments.slice();
    const highSlot = f.particleCount - 1;
    const offset = highSlot * 16;
    if (activateHighSlot) {
      assignments.set([
        1, 0.5, 0.75,
        0.00125, 0.001, 0.00125,
        1.25, 1000,
        3, 11, 1, 0.1,
        4, 5, 6, 0
      ], offset);
    }
    const assignmentBuffer = taggedBuffer(
      f.device,
      `successor-level-assignment-${calls.length}`,
      assignments.byteLength
    );
    const result = {
      ...f.lookupLevelAssignment,
      assignmentBuffer,
      assignmentBufferByteLength: assignments.byteLength,
      assignments,
      sourceStateBuffer: sph.stateBuffer,
      sourceStateBufferBorrowed: true,
      sourceStateBufferByteLength: f.particleCount * 32,
      sourceThermoBuffer: sph.thermoBuffer,
      sourceThermoBufferBorrowed: true,
      sourceThermoBufferByteLength: f.particleCount * 48,
      sourceMechanicsBuffer: mls.mechanicsBuffer,
      sourceMechanicsBufferBorrowed: true,
      sourceMechanicsBufferByteLength: f.particleCount * 128,
      kernelScope: 'schroeder-gpu-level-assignment',
      fullParticleReadbackPerformed: false,
      storageGeneration: sph.storageGeneration,
      physicsTick: sph.physicsTick,
      physicsSubstep: sph.physicsSubstep,
      positionEpoch: sph.positionEpoch,
      topologyEpoch: sph.topologyEpoch,
      chartEpoch: sph.chartEpoch,
      levelEpoch: sph.levelEpoch,
      supportEpoch: sph.supportEpoch,
      destroyAssignmentBuffer() {
        assignmentBuffer.destroy();
      }
    };
    results.push(result);
    return result;
  };
  return { calls, results, runner };
}

function assertBorrowedBuffersSurvive(buffers) {
  for (const buffer of Object.values(buffers)) {
    assert.equal(buffer.destroyed, false);
    assert.equal(buffer.destroyCount, 0);
  }
}

function transactionForSuccessor(f, nextParticleUploads) {
  const transaction = createSchroederSpatialEpochTransaction({
    device: f.device,
    generation: f.generation,
    ...f.sourceParticleUploads
  });
  const readerInputs = { generation: f.generation, ...f.sourceParticleUploads };
  admitSchroederSpatialEpochTransactionReader(transaction, {
    readerId: SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_P2G,
    phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.PRE_INTEGRATION,
    ...readerInputs
  });
  admitSchroederSpatialEpochTransactionReader(transaction, {
    readerId: SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_G2P,
    phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.INTEGRATION_COMMIT,
    ...readerInputs
  });
  sealSchroederSpatialEpochTransactionReaders(transaction);
  sealSchroederSpatialEpochTransactionProposals(transaction);
  return {
    transaction,
    commit() {
      return commitSchroederSpatialEpochTransaction(transaction, {
        nextParticleUploads
      });
    }
  };
}

test('exact successor leases block retirement and release exactly once', async () => {
  const f = await successorFixture();
  assert.equal(Object.isFrozen(f.sourceFamily), true);
  assert.equal(f.sourceFamily.spatialQueryAuthority, false);
  for (const key of Object.keys(f.buffers)) {
    assert.equal(key in f.sourceFamily, false);
  }
  assert.deepEqual(
    schroederSpatialSuccessorSourceFamilyLiveness(f.sourceFamily, {
      device: f.device
    }),
    {
      schema: 'peercompute.ulg.schroeder-committed-successor-source-family-liveness.v1',
      status: 'schroeder-successor-source-family-active',
      active: true,
      retired: false,
      quarantined: false,
      deviceLost: false,
      reason: null,
      leaseCount: 0,
      retirementRequested: false,
      retirementFenceSettled: false,
      retirementBlocked: false,
      ownsBuffers: false,
      ownsSuccessorLevelAssignment: false,
      successorLevelAssignmentDestroyed: false,
      sourceGenerationId: 19,
      deviceId: webGpuDeviceId(f.device)
    }
  );
  assert.equal(
    resolveSchroederSpatialSuccessorSourceFamily(f.sourceFamily, {
      device: f.device,
      particleCount: f.particleCount,
      ...f.buffers
    }).sourceFamily,
    f.sourceFamily
  );

  const lease = acquireSchroederSpatialSuccessorSourceFamilyLease(
    f.sourceFamily,
    { device: f.device, consumerStage: 'exact-render-consumer' }
  );
  assert.equal(Object.isFrozen(lease), true);
  assert.equal(
    schroederSpatialSuccessorSourceFamilyLiveness(f.sourceFamily).leaseCount,
    1
  );
  assert.throws(
    () => retireSchroederSpatialSuccessorSourceFamily(f.sourceFamily, {
      device: f.device
    }),
    {
      code: 'ERR_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_ACTIVE_LEASES'
    }
  );
  assertBorrowedBuffersSurvive(f.buffers);

  const released = releaseSchroederSpatialSuccessorSourceFamilyLease(
    f.sourceFamily,
    lease,
    { device: f.device }
  );
  assert.equal(released.released, true);
  assert.equal(released.remainingLeaseCount, 0);
  assert.throws(
    () => releaseSchroederSpatialSuccessorSourceFamilyLease(
      f.sourceFamily,
      lease,
      { device: f.device }
    ),
    {
      code: 'ERR_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_LEASE_RELEASED'
    }
  );

  const retirement = retireSchroederSpatialSuccessorSourceFamily(
    f.sourceFamily,
    { device: f.device, reason: 'successor superseded' }
  );
  assert.equal(retirement.status, 'schroeder-successor-source-family-retired');
  assert.equal(retirement.active, false);
  assert.equal(retirement.retired, true);
  assert.equal(retirement.reason, 'successor superseded');
  assert.throws(
    () => resolveSchroederSpatialSuccessorSourceFamily(f.sourceFamily, {
      device: f.device,
      ...f.buffers
    }),
    { code: 'ERR_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_RETIRED' }
  );
  assert.throws(
    () => acquireSchroederSpatialSuccessorSourceFamilyLease(f.sourceFamily, {
      device: f.device,
      consumerStage: 'late-consumer'
    }),
    { code: 'ERR_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_RETIRED' }
  );
  assertBorrowedBuffersSurvive(f.buffers);
});

test('device loss quarantines the family without destroying borrowed buffers', async () => {
  const f = await successorFixture();
  const lease = acquireSchroederSpatialSuccessorSourceFamilyLease(
    f.sourceFamily,
    { device: f.device, consumerStage: 'in-flight-consumer' }
  );
  f.device.lose({ reason: 'destroyed', message: 'adapter removed during test' });
  await Promise.resolve();
  await Promise.resolve();

  const liveness = schroederSpatialSuccessorSourceFamilyLiveness(f.sourceFamily);
  assert.equal(
    liveness.status,
    'schroeder-successor-source-family-device-lost-quarantined'
  );
  assert.equal(liveness.active, false);
  assert.equal(liveness.retired, false);
  assert.equal(liveness.deviceLost, true);
  assert.equal(liveness.quarantined, true);
  assert.equal(liveness.reason, 'adapter removed during test');
  assert.equal(liveness.leaseCount, 1);
  assert.throws(
    () => resolveSchroederSpatialSuccessorSourceFamily(f.sourceFamily, {
      device: f.device,
      ...f.buffers
    }),
    { code: 'ERR_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_DEVICE_LOST' }
  );
  assert.throws(
    () => acquireSchroederSpatialSuccessorSourceFamilyLease(f.sourceFamily, {
      device: f.device,
      consumerStage: 'post-loss-consumer'
    }),
    { code: 'ERR_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_DEVICE_LOST' }
  );
  assertBorrowedBuffersSurvive(f.buffers);

  const released = releaseSchroederSpatialSuccessorSourceFamilyLease(
    f.sourceFamily,
    lease,
    { device: f.device }
  );
  assert.equal(released.remainingLeaseCount, 0);
  assert.equal(
    retireSchroederSpatialSuccessorSourceFamily(f.sourceFamily, {
      device: f.device
    }).status,
    'schroeder-successor-source-family-device-lost-quarantined'
  );
  assertBorrowedBuffersSurvive(f.buffers);
});

test('async retirement revokes immediately and settles only after owner and exact lease fences', async () => {
  const f = await successorFixture();
  const ownerFence = deferred();
  const consumerFence = deferred();
  const lease = acquireSchroederSpatialSuccessorSourceFamilyLease(
    f.sourceFamily,
    { device: f.device, consumerStage: 'resident-step-input' }
  );
  const retirement = retireSchroederSpatialSuccessorSourceFamilyAfterLeases(
    f.sourceFamily,
    {
      device: f.device,
      reason: 'ping-pong buffer family superseded',
      after: ownerFence.promise
    }
  );
  const requested = schroederSpatialSuccessorSourceFamilyLiveness(
    f.sourceFamily
  );
  assert.equal(requested.active, false);
  assert.equal(requested.retirementRequested, true);
  assert.equal(requested.retirementBlocked, true);
  assert.throws(
    () => acquireSchroederSpatialSuccessorSourceFamilyLease(f.sourceFamily, {
      device: f.device,
      consumerStage: 'late-resident-step'
    }),
    {
      code:
        'ERR_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_RETIREMENT_REQUESTED'
    }
  );
  assert.throws(
    () => resolveSchroederSpatialSuccessorSourceFamily(f.sourceFamily, {
      device: f.device,
      ...f.buffers
    }),
    {
      code:
        'ERR_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_RETIREMENT_REQUESTED'
    }
  );
  const leaseRelease = releaseSchroederSpatialSuccessorSourceFamilyLeaseAfter(
    f.sourceFamily,
    lease,
    { device: f.device, after: consumerFence.promise }
  );
  let retirementSettled = false;
  retirement.then(() => { retirementSettled = true; });
  ownerFence.resolve();
  await Promise.resolve();
  assert.equal(retirementSettled, false);
  assert.equal(
    schroederSpatialSuccessorSourceFamilyLiveness(f.sourceFamily)
      .retirementFenceSettled,
    true
  );
  consumerFence.resolve();
  const [releaseReceipt, retirementReceipt] = await Promise.all([
    leaseRelease,
    retirement
  ]);
  assert.equal(releaseReceipt.queueFenceSettled, true);
  assert.equal(releaseReceipt.remainingLeaseCount, 0);
  assert.equal(retirementReceipt.settled, true);
  assert.equal(retirementReceipt.retired, true);
  assert.equal(retirementReceipt.quarantined, false);
  assert.equal(
    schroederSpatialSuccessorSourceFamilyLiveness(f.sourceFamily).status,
    'schroeder-successor-source-family-retired'
  );
  assertBorrowedBuffersSurvive(f.buffers);
});

test('queue-fenced lease release and retirement fail closed without an exact fence', async () => {
  const f = await successorFixture();
  const lease = acquireSchroederSpatialSuccessorSourceFamilyLease(
    f.sourceFamily,
    { device: f.device, consumerStage: 'missing-fence-consumer' }
  );
  assert.throws(
    () => releaseSchroederSpatialSuccessorSourceFamilyLeaseAfter(
      f.sourceFamily,
      lease,
      { device: f.device }
    ),
    {
      code: 'ERR_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_LEASE_FENCE'
    }
  );
  assert.equal(
    releaseSchroederSpatialSuccessorSourceFamilyLease(
      f.sourceFamily,
      lease,
      { device: f.device }
    ).released,
    true
  );
  assert.throws(
    () => retireSchroederSpatialSuccessorSourceFamilyAfterLeases(
      f.sourceFamily,
      { device: f.device }
    ),
    {
      code: 'ERR_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_RETIREMENT_FENCE'
    }
  );
  assert.equal(
    schroederSpatialSuccessorSourceFamilyLiveness(f.sourceFamily).active,
    true
  );
  assertBorrowedBuffersSurvive(f.buffers);
});

test('precommit successor preparation allocates final identity and postcommit publication is total', async () => {
  const f = await successorFixture();
  const nextParticleUploads = preparedUploads(f);
  const classifier = createSuccessorClassifier(f, {
    activateHighSlot: false
  });
  applySchroederSpatialTopologyTransitionReceipt(
    nextParticleUploads,
    f.topologyTransitionReceipt,
    { generation: f.generation }
  );
  const tx = transactionForSuccessor(f, nextParticleUploads);
  const plan =
    await prepareSchroederSpatialSuccessorSourceFamilyPublication({
      transaction: tx.transaction,
      generation: f.generation,
      lookupLevelAssignment: f.lookupLevelAssignment,
      nextParticleUploads,
      successorLevelAssignmentRunner: classifier.runner,
      topologyTransitionReceipt: f.topologyTransitionReceipt,
      forcePositionAdvance: false
    });
  assert.equal(classifier.calls.length, 1);
  assert.equal(
    classifier.calls[0].lookupLevelAssignment,
    f.lookupLevelAssignment
  );
  assert.equal(
    classifier.calls[0].nextParticleUploads,
    nextParticleUploads
  );
  assert.ok(
    nextParticleUploads.sphParticleUpload.storageGeneration
      > f.nextParticleUploads.sphParticleUpload.storageGeneration
  );
  assert.equal(
    nextParticleUploads.sphParticleUpload.bufferFamilyGeneration,
    nextParticleUploads.sphParticleUpload.storageGeneration
  );
  assert.equal(
    nextParticleUploads.sphParticleUpload.positionEpoch,
    f.generation.execution.positionEpoch,
    'a descriptor-only advance is replaced by the exact no-motion receipt'
  );
  assert.ok(
    nextParticleUploads.sphParticleUpload.levelEpoch
      > f.lookupLevelAssignment.levelEpoch
  );
  assert.ok(
    nextParticleUploads.sphParticleUpload.supportEpoch
      > f.lookupLevelAssignment.supportEpoch
  );
  assert.equal(
    nextParticleUploads.schroederSpatialSuccessorSourceFamily,
    null
  );
  assert.equal(
    nextParticleUploads.schroederSpatialSuccessorLevelAssignment,
    null
  );
  const commitReceipt = tx.commit();
  const receipt = publishPreparedSchroederSpatialSuccessorSourceFamily(
    plan,
    { commitReceipt }
  );
  assert.equal(receipt.published, true);
  assert.equal(
    validateSchroederSpatialSuccessorPublicationReceipt(receipt, {
      plan,
      commitReceipt,
      nextParticleUploads
    }),
    true
  );
  assert.equal(
    validateSchroederSpatialSuccessorPublicationReceipt(
      Object.freeze({ ...receipt }),
      { plan, commitReceipt, nextParticleUploads }
    ),
    false,
    'a field-identical but foreign receipt must not authenticate publication'
  );
  assert.equal(
    validateSchroederSpatialSuccessorPublicationReceipt(receipt, {
      plan: Object.freeze({ ...plan }),
      commitReceipt,
      nextParticleUploads
    }),
    false,
    'the receipt must remain bound to the exact prepared plan'
  );
  assert.equal(
    validateSchroederSpatialSuccessorPublicationReceipt(receipt, {
      plan,
      commitReceipt: Object.freeze({ ...commitReceipt }),
      nextParticleUploads
    }),
    false,
    'the receipt must remain bound to the exact commit receipt'
  );
  assert.equal(
    validateSchroederSpatialSuccessorPublicationReceipt(receipt, {
      plan,
      commitReceipt,
      nextParticleUploads: { ...nextParticleUploads }
    }),
    false,
    'the receipt must remain bound to the exact reserved upload envelope'
  );
  assert.equal(
    nextParticleUploads.schroederSpatialSuccessorSourceFamily,
    receipt.sourceFamily
  );
  const successorAssignment =
    nextParticleUploads.schroederSpatialSuccessorLevelAssignment;
  assert.ok(successorAssignment);
  assert.equal(
    successorAssignment.sourceLookupAssignmentBuffer,
    f.lookupLevelAssignment.assignmentBuffer
  );
  assert.equal(
    successorAssignment.sourceStateBuffer,
    nextParticleUploads.sphParticleUpload.stateBuffer
  );
  assert.equal(
    successorAssignment.sourceThermoBuffer,
    nextParticleUploads.sphParticleUpload.thermoBuffer
  );
  assert.equal(
    successorAssignment.sourceMechanicsBuffer,
    nextParticleUploads.mlsMpmParticleUpload.mechanicsBuffer
  );
  const highSlotOffset = (f.particleCount - 1) * 16;
  assert.equal(
    f.lookupLevelAssignment.assignments[highSlotOffset + 6],
    0,
    'E* lookup authority remains dormant and immutable'
  );
  assert.equal(successorAssignment.assignments[highSlotOffset + 6], 0);
  const resolved = resolveSchroederSpatialSuccessorSourceFamily(
    receipt.sourceFamily,
    {
      device: f.device,
      particleCount: f.particleCount,
      stateBuffer: nextParticleUploads.sphParticleUpload.stateBuffer,
      thermoBuffer: nextParticleUploads.sphParticleUpload.thermoBuffer,
      identityBuffer: nextParticleUploads.sphParticleUpload.identityBuffer,
      mechanicsBuffer:
        nextParticleUploads.mlsMpmParticleUpload.mechanicsBuffer
    }
  );
  assert.equal(resolved.levelAssignment, successorAssignment);
  assert.equal(
    resolved.levelAssignmentSeal,
    receipt.sourceFamily.successorLevelAssignmentSeal
  );
  assert.throws(
    () => resolveSchroederSpatialSuccessorSourceFamily(
      receipt.sourceFamily,
      {
        device: f.device,
        particleCount: f.particleCount,
        stateBuffer: nextParticleUploads.sphParticleUpload.stateBuffer,
        thermoBuffer: nextParticleUploads.sphParticleUpload.thermoBuffer,
        identityBuffer: nextParticleUploads.sphParticleUpload.identityBuffer,
        mechanicsBuffer:
          nextParticleUploads.mlsMpmParticleUpload.mechanicsBuffer,
        sphParticleUpload: {
          ...nextParticleUploads.sphParticleUpload
        },
        mlsMpmParticleUpload:
          nextParticleUploads.mlsMpmParticleUpload
      }
    ),
    {
      code: 'ERR_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_IDENTITY'
    },
    'a copied upload envelope cannot authenticate exact continuation'
  );
  const originalLevelEpoch =
    nextParticleUploads.sphParticleUpload.levelEpoch;
  nextParticleUploads.sphParticleUpload.levelEpoch =
    originalLevelEpoch + 1;
  assert.throws(
    () => resolveSchroederSpatialSuccessorSourceFamily(
      receipt.sourceFamily,
      {
        device: f.device,
        particleCount: f.particleCount,
        stateBuffer: nextParticleUploads.sphParticleUpload.stateBuffer,
        thermoBuffer: nextParticleUploads.sphParticleUpload.thermoBuffer,
        identityBuffer: nextParticleUploads.sphParticleUpload.identityBuffer,
        mechanicsBuffer:
          nextParticleUploads.mlsMpmParticleUpload.mechanicsBuffer,
        sphParticleUpload: nextParticleUploads.sphParticleUpload,
        mlsMpmParticleUpload:
          nextParticleUploads.mlsMpmParticleUpload
      }
    ),
    {
      code: 'ERR_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_IDENTITY'
    },
    'mutable epoch-envelope drift must revoke exact continuation'
  );
  nextParticleUploads.sphParticleUpload.levelEpoch = originalLevelEpoch;
  assert.equal(
    receipt.sourceFamily.storageGeneration,
    nextParticleUploads.sphParticleUpload.storageGeneration
  );
  assert.equal(f.topologyTransitionReceipt.topologyChanged, false);
  assert.equal(
    receipt.sourceFamily.topologyEpoch,
    f.generation.execution.topologyEpoch,
    'zero-activation closure keeps the exact topology epoch'
  );
  assert.equal(
    receipt.sourceFamily.positionEpoch,
    f.generation.execution.positionEpoch,
    'zero motion and zero topology change preserve position identity'
  );
  const replay = publishPreparedSchroederSpatialSuccessorSourceFamily(
    plan,
    { commitReceipt: Object.freeze({ forged: true }) }
  );
  assert.equal(replay.published, false);
  assert.match(replay.reason, /already consumed|invalid|foreign/);

  const consumerLease = acquireSchroederSpatialSuccessorSourceFamilyLease(
    receipt.sourceFamily,
    {
      device: f.device,
      consumerStage: 'exact-next-tick-mechanics'
    }
  );
  const ownerFence = deferred();
  const retirementPromise =
    retireSchroederSpatialSuccessorSourceFamilyAfterLeases(
      receipt.sourceFamily,
      {
        device: f.device,
        reason: 'exact successor admitted by its outstanding lease',
        after: ownerFence.promise
      }
    );
  assert.throws(
    () => resolveSchroederSpatialSuccessorSourceFamily(
      receipt.sourceFamily,
      {
        device: f.device,
        particleCount: f.particleCount,
        stateBuffer: nextParticleUploads.sphParticleUpload.stateBuffer,
        thermoBuffer: nextParticleUploads.sphParticleUpload.thermoBuffer,
        identityBuffer: nextParticleUploads.sphParticleUpload.identityBuffer,
        mechanicsBuffer:
          nextParticleUploads.mlsMpmParticleUpload.mechanicsBuffer
      }
    ),
    {
      code:
        'ERR_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_RETIREMENT_REQUESTED'
    },
    'retirement revokes all consumers that do not hold the exact prior lease'
  );
  const leasedResolution = resolveSchroederSpatialSuccessorSourceFamily(
    receipt.sourceFamily,
    {
      device: f.device,
      particleCount: f.particleCount,
      stateBuffer: nextParticleUploads.sphParticleUpload.stateBuffer,
      thermoBuffer: nextParticleUploads.sphParticleUpload.thermoBuffer,
      identityBuffer: nextParticleUploads.sphParticleUpload.identityBuffer,
      mechanicsBuffer:
        nextParticleUploads.mlsMpmParticleUpload.mechanicsBuffer,
      consumerLease
    }
  );
  assert.equal(leasedResolution.levelAssignment, successorAssignment);
  assert.throws(
    () => resolveSchroederSpatialSuccessorSourceFamily(
      receipt.sourceFamily,
      {
        device: f.device,
        particleCount: f.particleCount,
        stateBuffer: nextParticleUploads.sphParticleUpload.stateBuffer,
        thermoBuffer: nextParticleUploads.sphParticleUpload.thermoBuffer,
        identityBuffer: nextParticleUploads.sphParticleUpload.identityBuffer,
        mechanicsBuffer:
          nextParticleUploads.mlsMpmParticleUpload.mechanicsBuffer,
        consumerLease: Object.freeze({ ...consumerLease })
      }
    ),
    {
      code:
        'ERR_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_LEASE_IDENTITY'
    }
  );
  const consumerFence = deferred();
  const releasePromise =
    releaseSchroederSpatialSuccessorSourceFamilyLeaseAfter(
      receipt.sourceFamily,
      consumerLease,
      { device: f.device, after: consumerFence.promise }
    );
  assert.throws(
    () => resolveSchroederSpatialSuccessorSourceFamily(
      receipt.sourceFamily,
      {
        device: f.device,
        particleCount: f.particleCount,
        stateBuffer: nextParticleUploads.sphParticleUpload.stateBuffer,
        thermoBuffer: nextParticleUploads.sphParticleUpload.thermoBuffer,
        identityBuffer: nextParticleUploads.sphParticleUpload.identityBuffer,
        mechanicsBuffer:
          nextParticleUploads.mlsMpmParticleUpload.mechanicsBuffer,
        consumerLease
      }
    ),
    {
      code:
        'ERR_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_LEASE_RELEASE_PENDING'
    },
    'a lease already scheduled for release cannot admit additional work'
  );
  ownerFence.resolve();
  consumerFence.resolve();
  await Promise.all([releasePromise, retirementPromise]);
  assert.equal(classifier.results[0].assignmentBuffer.destroyCount, 1);

  const first = allocateSchroederSpatialSuccessorBufferFamilyIdentity({
    device: f.device,
    afterStorageGeneration: receipt.sourceFamily.storageGeneration,
    purpose: 'test-monotonic-identity-a'
  });
  const second = allocateSchroederSpatialSuccessorBufferFamilyIdentity({
    device: f.device,
    afterStorageGeneration: 1,
    purpose: 'test-monotonic-identity-b'
  });
  assert.equal(second.storageGeneration, first.storageGeneration + 1);
  assert.throws(
    () => allocateSchroederSpatialSuccessorBufferFamilyIdentity({
      device: f.device,
      afterStorageGeneration: 0xffff_ffff,
      purpose: 'must-never-wrap'
    }),
    {
      code:
        'ERR_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_IDENTITY_EXHAUSTED'
    }
  );
});

test('successor publication carries the exact pending eight-word product-history gate without host observation', async () => {
  const prepared = await preparedProductHistoryGateFixture();
  const {
    f,
    nextParticleUploads,
    productHistory,
    tx,
    plan
  } = prepared;
  const gate = plan.productHistoryCommitGate;
  assert.ok(gate);
  assert.equal(nextParticleUploads.productHistoryCommitGate, gate);
  assert.equal(gate.status, 'gpu-conditioned-publication-commit-pending');
  assert.equal(gate.ready, false);
  assert.equal(gate.hostObserved, false);
  assert.equal(gate.residentProductMass, productHistory.residentProductMass);
  assert.equal(gate.productEventBuffer, productHistory.productEventBuffer);
  assert.equal(gate.controlBuffer, productHistory.controlBuffer);
  assert.equal(gate.controlOffsetBytes, 0);
  assert.equal(gate.controlPrefixByteLength, 32);
  assert.equal(gate.expectedMagic, 0x50484731);
  assert.equal(gate.expectedVersion, 1);
  assert.equal(gate.expectedReadyStatus, 1);
  assert.equal(gate.expectedFailedStatus, 0x80000000);
  assert.equal(gate.expectedGeneration, 71);
  assert.equal(gate.expectedSeal, 0x715ea1);
  assert.equal(gate.expectedRowCapacity, 32768);
  assert.equal(gate.expectedRowStrideVec4, 8);
  assert.equal(
    gate.failurePolicy,
    'fail-closed-gpu-consumers-no-host-observation-no-full-rollback'
  );
  assert.equal(
    validateSchroederSpatialProductHistoryCommitGate(gate, {
      device: f.device,
      nextParticleUploads,
      residentProductMass: productHistory.residentProductMass
    }),
    true
  );
  assert.equal(
    validateSchroederSpatialProductHistoryCommitGate(
      Object.freeze({ ...gate }),
      {
        device: f.device,
        nextParticleUploads,
        residentProductMass: productHistory.residentProductMass
      }
    ),
    false,
    'a field-identical copied gate is not branded'
  );
  const commitReceipt = tx.commit();
  const receipt = publishPreparedSchroederSpatialSuccessorSourceFamily(
    plan,
    { commitReceipt }
  );
  assert.equal(receipt.published, true);
  assert.equal(receipt.productHistoryCommitGate, gate);
  assert.equal(receipt.sourceFamily.productHistoryCommitGate, gate);
  assert.equal(receipt.sourceFamily.productHistoryCommitPending, true);
  assert.equal(
    receipt.sourceFamily.productHistoryCommitStatus,
    'gpu-conditioned-publication-commit-pending'
  );
  assert.equal(
    validateSchroederSpatialSuccessorPublicationReceipt(receipt, {
      plan,
      commitReceipt,
      nextParticleUploads
    }),
    true
  );
});

test('successor product-history publication rejects revoked, copied, and mismatched pending identities', async () => {
  const revoked = await preparedProductHistoryGateFixture();
  const revokedCommit = revoked.tx.commit();
  assert.equal(
    revokeResidentProductEventCountAuthority(
      revoked.productHistory.residentProductMass
    ),
    true
  );
  const revokedReceipt =
    publishPreparedSchroederSpatialSuccessorSourceFamily(
      revoked.plan,
      { commitReceipt: revokedCommit }
    );
  assert.equal(revokedReceipt.published, false);
  assert.equal(revoked.nextParticleUploads.productHistoryCommitGate, null);
  assert.equal(revoked.classifier.results[0].assignmentBuffer.destroyCount, 1);

  const copiedHandle = await preparedProductHistoryGateFixture();
  const copiedHandleCommit = copiedHandle.tx.commit();
  copiedHandle.nextParticleUploads.residentProductMass = {
    ...copiedHandle.productHistory.residentProductMass
  };
  const copiedHandleReceipt =
    publishPreparedSchroederSpatialSuccessorSourceFamily(
      copiedHandle.plan,
      { commitReceipt: copiedHandleCommit }
    );
  assert.equal(copiedHandleReceipt.published, false);
  assert.equal(copiedHandle.nextParticleUploads.productHistoryCommitGate, null);

  const copiedGate = await preparedProductHistoryGateFixture();
  const copiedGateCommit = copiedGate.tx.commit();
  copiedGate.nextParticleUploads.productHistoryCommitGate = Object.freeze({
    ...copiedGate.plan.productHistoryCommitGate
  });
  const copiedGateReceipt =
    publishPreparedSchroederSpatialSuccessorSourceFamily(
      copiedGate.plan,
      { commitReceipt: copiedGateCommit }
    );
  assert.equal(copiedGateReceipt.published, false);
  assert.notEqual(
    copiedGate.nextParticleUploads.productHistoryCommitGate,
    copiedGate.plan.productHistoryCommitGate
  );

  const mismatchedBuffer = await preparedProductHistoryGateFixture();
  const mismatchedBufferCommit = mismatchedBuffer.tx.commit();
  mismatchedBuffer.productHistory.residentProductMass.productEventBuffer =
    taggedBuffer(
      mismatchedBuffer.f.device,
      'foreign-replacement-product-history',
      mismatchedBuffer.productHistory.productEventBuffer.size
    );
  const mismatchedBufferReceipt =
    publishPreparedSchroederSpatialSuccessorSourceFamily(
      mismatchedBuffer.plan,
      { commitReceipt: mismatchedBufferCommit }
    );
  assert.equal(mismatchedBufferReceipt.published, false);
  assert.equal(
    mismatchedBuffer.nextParticleUploads.productHistoryCommitGate,
    null
  );
});

test('observed dormant-slot activation publishes exact successor descriptors and retires once', async () => {
  const f = await successorFixture();
  const nextParticleUploads = preparedUploads(f);
  const activatedStateBuffer = taggedBuffer(
    f.device,
    'activated-successor-state',
    f.particleCount * 32,
    [1, 1, 1]
  );
  nextParticleUploads.sphParticleUpload.stateBuffer = activatedStateBuffer;
  const topologyTransitionReceipt =
    await runSchroederSpatialTopologyTransitionWebGpu({
      device: f.device,
      generation: f.generation,
      sourceStateBuffer: f.generation.source.sourceStateBuffer,
      successorStateBuffer: activatedStateBuffer,
      successorParticleCount: f.particleCount
    });
  applySchroederSpatialTopologyTransitionReceipt(
    nextParticleUploads,
    topologyTransitionReceipt,
    { generation: f.generation }
  );
  const positionTransitionReceipt =
    await runSchroederSpatialPositionTransitionWebGpu({
      device: f.device,
      generation: f.generation,
      sourceStateBuffer: f.generation.source.sourceStateBuffer,
      successorStateBuffer: activatedStateBuffer,
      successorParticleCount: f.particleCount
    });
  applySchroederSpatialPositionTransitionReceipt(
    nextParticleUploads,
    positionTransitionReceipt,
    { generation: f.generation }
  );
  const classifier = createSuccessorClassifier(f);
  const tx = transactionForSuccessor(f, nextParticleUploads);
  const plan =
    await prepareSchroederSpatialSuccessorSourceFamilyPublication({
      transaction: tx.transaction,
      generation: f.generation,
      lookupLevelAssignment: f.lookupLevelAssignment,
      nextParticleUploads,
      successorLevelAssignmentRunner: classifier.runner,
      topologyTransitionReceipt
    });
  const receipt = publishPreparedSchroederSpatialSuccessorSourceFamily(
    plan,
    { commitReceipt: tx.commit() }
  );
  assert.equal(receipt.published, true);
  assert.equal(topologyTransitionReceipt.topologyChanged, true);
  assert.equal(topologyTransitionReceipt.activatedCount, 1);
  assert.equal(topologyTransitionReceipt.deactivatedCount, 0);
  assert.equal(classifier.calls.length, 1);
  const successorAssignment =
    nextParticleUploads.schroederSpatialSuccessorLevelAssignment;
  const highSlotOffset = (f.particleCount - 1) * 16;
  assert.equal(
    f.lookupLevelAssignment.assignments[highSlotOffset + 6],
    0
  );
  assert.equal(successorAssignment.assignments[highSlotOffset + 6], 1.25);
  assert.equal(successorAssignment.assignments[highSlotOffset + 8], 3);
  assert.equal(successorAssignment.assignments[highSlotOffset + 9], 11);
  assert.equal(successorAssignment.assignments[highSlotOffset + 10], 1);
  assert.equal(successorAssignment.sourceStateBuffer, activatedStateBuffer);
  assert.equal(
    receipt.sourceFamily.topologyEpoch,
    f.generation.execution.topologyEpoch + 1
  );
  assert.equal(classifier.results[0].assignmentBuffer.destroyCount, 0);
  const retirement = retireSchroederSpatialSuccessorSourceFamily(
    receipt.sourceFamily,
    { device: f.device, reason: 'activation generation superseded' }
  );
  assert.equal(retirement.retired, true);
  assert.equal(classifier.results[0].assignmentBuffer.destroyCount, 1);
  retireSchroederSpatialSuccessorSourceFamily(
    receipt.sourceFamily,
    { device: f.device }
  );
  assert.equal(
    classifier.results[0].assignmentBuffer.destroyCount,
    1,
    'normal retirement destroys the owned successor assignment exactly once'
  );
});

test('prepared successor abandon and rejected publication retire assignment ownership exactly once', async () => {
  const abandonedFixture = await successorFixture();
  const abandonedUploads = preparedUploads(abandonedFixture);
  applySchroederSpatialTopologyTransitionReceipt(
    abandonedUploads,
    abandonedFixture.topologyTransitionReceipt,
    { generation: abandonedFixture.generation }
  );
  const abandonedClassifier = createSuccessorClassifier(abandonedFixture, {
    activateHighSlot: false
  });
  const abandonedTx =
    transactionForSuccessor(abandonedFixture, abandonedUploads);
  const abandonedPlan =
    await prepareSchroederSpatialSuccessorSourceFamilyPublication({
      transaction: abandonedTx.transaction,
      generation: abandonedFixture.generation,
      lookupLevelAssignment: abandonedFixture.lookupLevelAssignment,
      nextParticleUploads: abandonedUploads,
      successorLevelAssignmentRunner: abandonedClassifier.runner,
      topologyTransitionReceipt:
        abandonedFixture.topologyTransitionReceipt
    });
  const abandonedBuffer =
    abandonedClassifier.results[0].assignmentBuffer;
  assert.equal(
    abandonPreparedSchroederSpatialSuccessorSourceFamilyPublication(
      abandonedPlan,
      { reason: 'injected precommit failure' }
    ),
    true
  );
  assert.equal(
    abandonPreparedSchroederSpatialSuccessorSourceFamilyPublication(
      abandonedPlan,
      { reason: 'replayed abandonment' }
    ),
    false
  );
  assert.equal(abandonedBuffer.destroyCount, 1);

  const rejectedFixture = await successorFixture();
  const rejectedUploads = preparedUploads(rejectedFixture);
  applySchroederSpatialTopologyTransitionReceipt(
    rejectedUploads,
    rejectedFixture.topologyTransitionReceipt,
    { generation: rejectedFixture.generation }
  );
  const rejectedClassifier = createSuccessorClassifier(rejectedFixture, {
    activateHighSlot: false
  });
  const rejectedTx = transactionForSuccessor(
    rejectedFixture,
    rejectedUploads
  );
  const rejectedPlan =
    await prepareSchroederSpatialSuccessorSourceFamilyPublication({
      transaction: rejectedTx.transaction,
      generation: rejectedFixture.generation,
      lookupLevelAssignment: rejectedFixture.lookupLevelAssignment,
      nextParticleUploads: rejectedUploads,
      successorLevelAssignmentRunner: rejectedClassifier.runner,
      topologyTransitionReceipt: rejectedFixture.topologyTransitionReceipt
    });
  const rejectedCommit = rejectedTx.commit();
  rejectedUploads.schroederSpatialSuccessorLevelAssignment =
    Object.freeze({ foreign: true });
  const rejectedReceipt =
    publishPreparedSchroederSpatialSuccessorSourceFamily(
      rejectedPlan,
      { commitReceipt: rejectedCommit }
    );
  assert.equal(rejectedReceipt.published, false);
  assert.equal(rejectedClassifier.results[0].assignmentBuffer.destroyCount, 1);
  publishPreparedSchroederSpatialSuccessorSourceFamily(
    rejectedPlan,
    { commitReceipt: rejectedCommit }
  );
  assert.equal(
    rejectedClassifier.results[0].assignmentBuffer.destroyCount,
    1,
    'boolean rejection plus replay cannot double-destroy'
  );
});

test('throwing publication and classifier-admission failure retire assignment ownership exactly once', async () => {
  const throwingFixture = await successorFixture();
  const throwingUploads = preparedUploads(throwingFixture);
  applySchroederSpatialTopologyTransitionReceipt(
    throwingUploads,
    throwingFixture.topologyTransitionReceipt,
    { generation: throwingFixture.generation }
  );
  const throwingClassifier = createSuccessorClassifier(throwingFixture, {
    activateHighSlot: false
  });
  const throwingTx = transactionForSuccessor(
    throwingFixture,
    throwingUploads
  );
  const throwingPlan =
    await prepareSchroederSpatialSuccessorSourceFamilyPublication({
      transaction: throwingTx.transaction,
      generation: throwingFixture.generation,
      lookupLevelAssignment: throwingFixture.lookupLevelAssignment,
      nextParticleUploads: throwingUploads,
      successorLevelAssignmentRunner: throwingClassifier.runner,
      topologyTransitionReceipt: throwingFixture.topologyTransitionReceipt
    });
  const throwingCommit = throwingTx.commit();
  Object.defineProperty(
    throwingUploads,
    'schroederSpatialSuccessorSourceFamily',
    {
      configurable: true,
      enumerable: true,
      get() {
        throw new Error('injected adversarial publication getter');
      }
    }
  );
  const throwingReceipt =
    publishPreparedSchroederSpatialSuccessorSourceFamily(
      throwingPlan,
      { commitReceipt: throwingCommit }
    );
  assert.equal(throwingReceipt.published, false);
  assert.match(
    throwingReceipt.reason,
    /injected adversarial publication getter/
  );
  assert.equal(throwingClassifier.results[0].assignmentBuffer.destroyCount, 1);
  publishPreparedSchroederSpatialSuccessorSourceFamily(
    throwingPlan,
    { commitReceipt: throwingCommit }
  );
  assert.equal(
    throwingClassifier.results[0].assignmentBuffer.destroyCount,
    1,
    'throwing publication plus replay cannot leak or double-destroy'
  );

  const invalidFixture = await successorFixture();
  const invalidUploads = preparedUploads(invalidFixture);
  applySchroederSpatialTopologyTransitionReceipt(
    invalidUploads,
    invalidFixture.topologyTransitionReceipt,
    { generation: invalidFixture.generation }
  );
  const invalidClassifier = createSuccessorClassifier(invalidFixture, {
    activateHighSlot: false
  });
  const invalidTx = transactionForSuccessor(invalidFixture, invalidUploads);
  await assert.rejects(
    prepareSchroederSpatialSuccessorSourceFamilyPublication({
      transaction: invalidTx.transaction,
      generation: invalidFixture.generation,
      lookupLevelAssignment: invalidFixture.lookupLevelAssignment,
      nextParticleUploads: invalidUploads,
      successorLevelAssignmentRunner: async (options) => {
        const result = await invalidClassifier.runner(options);
        result.sourceThermoBuffer = invalidFixture.lookupLevelAssignment
          .sourceThermoBuffer;
        return result;
      },
      topologyTransitionReceipt: invalidFixture.topologyTransitionReceipt
    }),
    {
      code: 'ERR_SCHROEDER_POST_CLOSURE_ASSIGNMENT_PROVENANCE'
    }
  );
  assert.equal(invalidClassifier.results[0].assignmentBuffer.destroyCount, 1);
});

test('device loss quarantines and destroys an owned successor assignment exactly once', async () => {
  const f = await successorFixture();
  const nextParticleUploads = preparedUploads(f);
  applySchroederSpatialTopologyTransitionReceipt(
    nextParticleUploads,
    f.topologyTransitionReceipt,
    { generation: f.generation }
  );
  const classifier = createSuccessorClassifier(f, {
    activateHighSlot: false
  });
  const tx = transactionForSuccessor(f, nextParticleUploads);
  const plan =
    await prepareSchroederSpatialSuccessorSourceFamilyPublication({
      transaction: tx.transaction,
      generation: f.generation,
      lookupLevelAssignment: f.lookupLevelAssignment,
      nextParticleUploads,
      successorLevelAssignmentRunner: classifier.runner,
      topologyTransitionReceipt: f.topologyTransitionReceipt
    });
  const receipt = publishPreparedSchroederSpatialSuccessorSourceFamily(
    plan,
    { commitReceipt: tx.commit() }
  );
  assert.equal(receipt.published, true);
  const ownedBuffer = classifier.results[0].assignmentBuffer;
  f.device.lose({ message: 'owned assignment device loss' });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(ownedBuffer.destroyCount, 1);
  assert.equal(
    schroederSpatialSuccessorSourceFamilyLiveness(
      receipt.sourceFamily
    ).deviceLost,
    true
  );
  retireSchroederSpatialSuccessorSourceFamily(
    receipt.sourceFamily,
    { device: f.device }
  );
  assert.equal(ownedBuffer.destroyCount, 1);
});

test('device loss terminally settles an async retirement request with outstanding leases', async () => {
  const f = await successorFixture();
  const never = deferred();
  acquireSchroederSpatialSuccessorSourceFamilyLease(
    f.sourceFamily,
    { device: f.device, consumerStage: 'lost-device-consumer' }
  );
  const retirement = retireSchroederSpatialSuccessorSourceFamilyAfterLeases(
    f.sourceFamily,
    { device: f.device, after: never.promise }
  );
  f.device.lose({ message: 'device removed before consumer fence' });
  const receipt = await retirement;
  assert.equal(receipt.settled, true);
  assert.equal(receipt.retired, false);
  assert.equal(receipt.quarantined, true);
  assert.equal(receipt.remainingLeaseCount, 1);
  assertBorrowedBuffersSurvive(f.buffers);
});

test('resident successor preflight conservatively advances topology and position without host observation', async () => {
  const f = await successorFixture();
  const nextParticleUploads = preparedUploads(f);
  const classifier = createSuccessorClassifier(f, {
    activateHighSlot: false
  });
  const tx = transactionForSuccessor(f, nextParticleUploads);
  const plan =
    await prepareSchroederSpatialSuccessorSourceFamilyPublication({
      transaction: tx.transaction,
      generation: f.generation,
      lookupLevelAssignment: f.lookupLevelAssignment,
      nextParticleUploads,
      successorLevelAssignmentRunner: classifier.runner,
      conservativeTopologyAdvance: true
    });
  assert.equal(classifier.calls.length, 1);
  assert.equal(
    nextParticleUploads.sphParticleUpload.topologyEpoch,
    f.generation.execution.topologyEpoch + 1
  );
  assert.equal(
    nextParticleUploads.sphParticleUpload.positionEpoch,
    f.generation.execution.positionEpoch + 1
  );
  const published = publishPreparedSchroederSpatialSuccessorSourceFamily(
    plan,
    { commitReceipt: tx.commit() }
  );
  assert.equal(published.published, true);
  assert.equal(
    published.sourceFamily.topologyTransitionMode,
    'gpu-resident-conservative-topology-advance'
  );
  assert.equal(published.sourceFamily.fullParticleReadbackPerformed, false);
});

test('successor preflight rejects every cross-component buffer alias before commit', async () => {
  const f = await successorFixture();
  const nextParticleUploads = {
    sphParticleUpload: {
      ...f.nextParticleUploads.sphParticleUpload,
      identityBuffer: f.nextParticleUploads.sphParticleUpload.stateBuffer
    },
    mlsMpmParticleUpload: { ...f.nextParticleUploads.mlsMpmParticleUpload }
  };
  const tx = transactionForSuccessor(f, nextParticleUploads);
  await assert.rejects(
    prepareSchroederSpatialSuccessorSourceFamilyPublication({
      transaction: tx.transaction,
      generation: f.generation,
      nextParticleUploads,
      conservativeTopologyAdvance: true
    }),
    {
      code: 'ERR_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_BUFFER_ALIAS'
    }
  );
  assert.equal(tx.transaction.state, 'proposals-sealed');
});

test('rejected owner retirement fence keeps authority revoked and accepts a replacement fence', async () => {
  const f = await successorFixture();
  const rejectedFence = deferred();
  const firstAttempt = retireSchroederSpatialSuccessorSourceFamilyAfterLeases(
    f.sourceFamily,
    { device: f.device, after: rejectedFence.promise }
  );
  rejectedFence.reject(new Error('transient queue acknowledgement failure'));
  const rejected = await firstAttempt;
  assert.equal(rejected.settled, false);
  assert.equal(rejected.retired, false);
  assert.match(rejected.reason, /transient queue acknowledgement failure/);
  assert.equal(
    schroederSpatialSuccessorSourceFamilyLiveness(f.sourceFamily).active,
    false
  );
  assert.throws(
    () => acquireSchroederSpatialSuccessorSourceFamilyLease(f.sourceFamily, {
      device: f.device,
      consumerStage: 'must-remain-revoked-between-retries'
    }),
    {
      code:
        'ERR_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_RETIREMENT_REQUESTED'
    }
  );
  const replacementFence = deferred();
  const retry = retireSchroederSpatialSuccessorSourceFamilyAfterLeases(
    f.sourceFamily,
    { device: f.device, after: replacementFence.promise }
  );
  assert.notEqual(retry, firstAttempt);
  replacementFence.resolve();
  const retired = await retry;
  assert.equal(retired.settled, true);
  assert.equal(retired.retired, true);
  assertBorrowedBuffersSurvive(f.buffers);
});

test('lease and liveness operations reject foreign devices and forged tokens', async () => {
  const f = await successorFixture();
  const foreignDevice = createFakeDevice();
  assert.throws(
    () => schroederSpatialSuccessorSourceFamilyLiveness(f.sourceFamily, {
      device: foreignDevice
    }),
    { code: 'ERR_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_IDENTITY' }
  );
  assert.throws(
    () => acquireSchroederSpatialSuccessorSourceFamilyLease(f.sourceFamily, {
      device: foreignDevice,
      consumerStage: 'foreign-consumer'
    }),
    { code: 'ERR_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_IDENTITY' }
  );

  const lease = acquireSchroederSpatialSuccessorSourceFamilyLease(
    f.sourceFamily,
    { device: f.device, consumerStage: 'exact-consumer' }
  );
  assert.throws(
    () => releaseSchroederSpatialSuccessorSourceFamilyLease(
      f.sourceFamily,
      lease,
      { device: foreignDevice }
    ),
    { code: 'ERR_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_IDENTITY' }
  );
  assert.throws(
    () => releaseSchroederSpatialSuccessorSourceFamilyLease(
      f.sourceFamily,
      Object.freeze({ ...lease }),
      { device: f.device }
    ),
    { code: 'ERR_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_LEASE_IDENTITY' }
  );
  assert.equal(
    schroederSpatialSuccessorSourceFamilyLiveness(f.sourceFamily).leaseCount,
    1
  );
  releaseSchroederSpatialSuccessorSourceFamilyLease(
    f.sourceFamily,
    lease,
    { device: f.device }
  );
  assert.equal(
    schroederSpatialSuccessorSourceFamilyLiveness(f.sourceFamily).leaseCount,
    0
  );
});
