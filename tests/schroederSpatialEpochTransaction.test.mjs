import test from 'node:test';
import assert from 'node:assert/strict';
import { createSchroederSpatialCompositeMechanicsGpu, acquireSchroederNativePublication } from '../src/runtime/sph/schroederSpatialCompositeMechanicsGpu.js';
import { runMlsMpmP2gGridProjectionWebGpu } from '../src/runtime/sph/sphGridGpuKernel.js';
import { ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA, ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA, ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA
} from '../ulg-gpu-abi/src/index.js';

import {
  SCHROEDER_SPATIAL_EPOCH_CONSUMER_ARTIFACT_FAMILY,
  SCHROEDER_SPATIAL_EPOCH_CONSUMER_RECEIPT_STATUS,
  SCHROEDER_SPATIAL_EPOCH_READER,
  SCHROEDER_SPATIAL_EPOCH_READER_PHASE,
  SCHROEDER_SPATIAL_EPOCH_SUPPORT_PROFILE_ID,
  ULG_SCHROEDER_SPATIAL_EPOCH_CONSUMER_RECEIPT_SCHEMA,
  admitSchroederSpatialEpochTransactionLateConsumer,
  admitSchroederSpatialEpochTransactionReader,
  advanceSchroederSpatialEpochTransactionPrivate,
  abortSchroederSpatialEpochTransaction,
  commitSchroederSpatialEpochTransaction,
  createSchroederSpatialEpochTransaction,
  createSchroederSingleLevelQueueOrderedCleanupCapability,
  resolveSchroederSpatialMechanicsChainAuthority,
  quarantineSchroederSpatialEpochTransactionLawInputs,
  recordSchroederSpatialEpochTransactionLegacyLookup,
  resolveSchroederSpatialPhaseVolumeSurfaceStressAuthority,
  resolveSchroederSpatialPhaseVolumeTransportAuthority,
  scheduleSchroederSpatialEpochTransactionRelease,
  sealSchroederSpatialEpochTransactionProposals,
  sealSchroederSpatialEpochTransactionReaders,
  summarizeSchroederSpatialEpochTransaction,
  validateSchroederSpatialEpochTransactionCommit,
  validateSchroederSpatialEpochTransactionSourceFamily,
  validateSchroederSpatialEpochTransactionPrivateAdvance
} from '../src/runtime/sph/schroederSpatialEpochTransaction.js';
import {
  tagWebGpuBufferDevice,
  webGpuDeviceId
} from '../src/runtime/sph/sphGpuDeviceIdentity.js';
import {
  ULG_SCHROEDER_SPATIAL_EXACT_NEAR_GPU_EVIDENCE_SCHEMA
} from '../ulg-gpu-abi/src/schroederSpatialExactNear.js';
import {
  validateSchroederSpatialPhaseVolumeInterfaceProposalDescriptor
} from '../ulg-gpu-abi/src/schroederSpatialPhaseVolumeInterfaceProposal.js';
import {
  SCHROEDER_SPATIAL_AGGREGATE_CONSUMER_ARTIFACT_FAMILY,
  SCHROEDER_SPATIAL_AGGREGATE_CONSUMER_ID,
  SCHROEDER_SPATIAL_AGGREGATE_CONSUMER_PHASE,
  SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_QUERY_SOURCE_LAYOUT
} from '../ulg-gpu-abi/src/schroederSpatialAggregateView.js';
import {
  finalizeSchroederSpatialExactNearConsumerReceipt,
  resolveSchroederSpatialExactNearConsumerGeneration,
  runSchroederSpatialEpochGenerationWebGpu
} from '../src/runtime/sph/schroederSpatialEpochGpu.js';
import {
  createSchroederSpatialAggregateTraversalGpu,
  finalizeSchroederSpatialAggregateTraversalSubmissionReceipt
} from '../src/runtime/sph/schroederSpatialAggregateTraversalGpu.js';

function createFakeEncoder() {
  return {
    clearBuffer() {},
    copyBufferToBuffer() {},
    beginComputePass() {
      return {
        setPipeline() {},
        setBindGroup() {},
        dispatchWorkgroups() {},
        dispatchWorkgroupsIndirect() {},
        end() {}
      };
    },
    finish() { return {}; }
  };
}

function createLiveFakeDevice() {
  return {
    limits: {
      maxBufferSize: 256 * 1024 * 1024,
      maxStorageBufferBindingSize: 128 * 1024 * 1024,
      maxUniformBufferBindingSize: 64 * 1024,
      maxStorageBuffersPerShaderStage: 8,
      maxComputeWorkgroupsPerDimension: 65535,
      minUniformBufferOffsetAlignment: 256
    },
    queue: {
      writeBuffer() {},
      submit() {},
      onSubmittedWorkDone() { return Promise.resolve(); }
    },
    createBuffer(descriptor) {
      return {
        ...descriptor,
        destroyed: false,
        destroy() { this.destroyed = true; }
      };
    },
    createShaderModule(descriptor) { return descriptor; },
    createComputePipeline(descriptor) {
      return {
        ...descriptor,
        getBindGroupLayout(index) { return { index }; }
      };
    },
    createBindGroup(descriptor) { return descriptor; },
    createCommandEncoder() { return createFakeEncoder(); }
  };
}

function createLiveActiveNodeList(device) {
  const activeNodeBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'transaction-live-source',
    size: 2 * 16 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  }), device);
  return {
    schema: 'peercompute.ulg.schroeder-active-node-list-execution.v0',
    status: 'schroeder-active-node-list-submitted',
    spatialDirectorySourceSchema:
      'peercompute.ulg.schroeder-spatial-directory-active-node-source.v1',
    spatialDirectorySourceStatus: 'schroeder-spatial-directory-source-ready',
    spatialDirectorySourceReady: true,
    spatialEpochSourceSchema: 'peercompute.ulg.schroeder-spatial-active-node-source.v1',
    spatialEpochSourceStatus: 'schroeder-spatial-active-node-source-ready',
    spatialEpochSourceReady: true,
    spatialEpochLevelSpacingMode: 'base-grid-spacing-times-pow2-level',
    spatialEpochPositionAuthority: 'same-epoch-pre-integration-particle-state',
    spatialEpochMinLevel: -1,
    spatialEpochMaxLevel: 1,
    spatialEpochBaseGridSpacingM: 0.25,
    spatialEpochChartId: 0,
    activeCandidateCount: 2,
    activeNodeStrideFloats: 16,
    activeNodeBuffer,
    spatialEpochStorageGeneration: 11,
    spatialEpochPhysicsTick: 13,
    spatialEpochPhysicsSubstep: 0,
    spatialEpochPositionEpoch: 17,
    spatialEpochTopologyEpoch: 19,
    spatialEpochChartEpoch: 23,
    spatialEpochLevelEpoch: 29,
    spatialEpochSupportEpoch: 31,
    phaseVolumeAssignmentOverlayEnabled: false
  };
}

function fixture({ generationId = 7, storageGeneration = 3 } = {}) {
  const device = { queue: {} };
  const buffer = (label) => tagWebGpuBufferDevice({ label, size: 4096 }, device);
  const sourceBuffers = {
    stateBuffer: buffer('state'),
    thermoBuffer: buffer('thermo'),
    identityBuffer: buffer('identity'),
    mechanicsBuffer: buffer('mechanics')
  };
  const activeNodeBuffer = buffer('active-node');
  const directoryBuffer = buffer('directory');
  const epochIdentity = {
    storageGeneration,
    physicsTick: 11,
    physicsSubstep: 2,
    positionEpoch: 13,
    topologyEpoch: 5,
    chartEpoch: 1,
    levelEpoch: 4,
    supportEpoch: 6
  };
  const generation = {
    ready: true,
    selected: true,
    directoryBuildCount: 1,
    privateLookupBuildCount: 0,
    source: {
      ready: true,
      activeNodeBuffer,
      ...epochIdentity
    },
    execution: {
      submitPerformed: true,
      deviceId: webGpuDeviceId(device),
      generationId,
      buildOrdinal: generationId,
      sortUniqueOrdinal: generationId,
      activeNodeBuffer,
      directoryBuffer,
      ...epochIdentity
    }
  };
  const sphParticleUpload = {
    stateBuffer: sourceBuffers.stateBuffer,
    thermoBuffer: sourceBuffers.thermoBuffer,
    identityBuffer: sourceBuffers.identityBuffer
  };
  const mlsMpmParticleUpload = {
    mechanicsBuffer: sourceBuffers.mechanicsBuffer
  };
  return {
    device,
    generation,
    sphParticleUpload,
    mlsMpmParticleUpload,
    sourceBuffers,
    buffer
  };
}

function twoLevelFixture({
  phaseVolume = false,
  phaseVolumeReceiptEnabled = true,
  phaseVolumeInterfaceProposalEnabled = false,
  aggregateViewEnabled = false,
  mechanicsAuthorityEnabled = true,
  mechanicsLevelCount = 2,
  nativeP2g = false
} = {}) {
  const device = createLiveFakeDevice();
  const particleCount = 2;
  const buffer = (label, size = 4096) => tagWebGpuBufferDevice(
    device.createBuffer({ label, size, usage: 128 }),
    device
  );
  const sourceBuffers = {
    stateBuffer: buffer('two-level-state'),
    thermoBuffer: buffer('two-level-thermo'),
    identityBuffer: buffer(
      'two-level-identity',
      particleCount * Uint32Array.BYTES_PER_ELEMENT
    ),
    mechanicsBuffer: buffer('two-level-mechanics')
  };
  const levelAssignment = {
    schema: 'peercompute.ulg.schroeder-level-assignment-execution.v0',
    status: 'schroeder-level-assignment-submitted',
    bufferFamilyGenerationStatus:
      'schroeder-particle-buffer-family-generation-ready',
    particleCount,
    assignmentStrideFloats: 16,
    assignmentBuffer: buffer(
      'two-level-assignment',
      particleCount * 16 * Float32Array.BYTES_PER_ELEMENT
    ),
    assignmentBufferByteLength:
      particleCount * 16 * Float32Array.BYTES_PER_ELEMENT,
    sourceStateBuffer: sourceBuffers.stateBuffer,
    sourceStateBufferBorrowed: true,
    ...(phaseVolume ? {
      sourceMechanicsBuffer: sourceBuffers.mechanicsBuffer,
      sourceMechanicsBufferBorrowed: true,
      sourceMechanicsBufferByteLength:
        particleCount * 32 * Float32Array.BYTES_PER_ELEMENT
    } : {}),
    storageGeneration: 11,
    physicsTick: 13,
    physicsSubstep: 0,
    positionEpoch: 17,
    topologyEpoch: 19,
    chartEpoch: 23,
    levelEpoch: 29,
    supportEpoch: 31,
    minLevel: 0,
    maxLevel: Math.max(0, mechanicsLevelCount - 1),
    chartId: 0,
    baseGridSpacingM: 0.25
  };
  const sphParticleUpload = {
    status: 'webgpu-uploaded',
    particleCount,
    stateStrideBytes: 8 * Float32Array.BYTES_PER_ELEMENT,
    thermoStrideBytes: 12 * Float32Array.BYTES_PER_ELEMENT,
    identityStrideBytes: Uint32Array.BYTES_PER_ELEMENT,
    stateBuffer: sourceBuffers.stateBuffer,
    thermoBuffer: sourceBuffers.thermoBuffer,
    identityBuffer: sourceBuffers.identityBuffer,
    storageGeneration: levelAssignment.storageGeneration,
    physicsTick: levelAssignment.physicsTick,
    physicsSubstep: levelAssignment.physicsSubstep,
    positionEpoch: levelAssignment.positionEpoch,
    topologyEpoch: levelAssignment.topologyEpoch,
    chartEpoch: levelAssignment.chartEpoch,
    levelEpoch: levelAssignment.levelEpoch,
    supportEpoch: levelAssignment.supportEpoch
  };
  const generation = runSchroederSpatialEpochGenerationWebGpu({
    device,
    levelAssignment,
    particleCount,
    particleIdentityBuffer: mechanicsAuthorityEnabled
      ? sourceBuffers.identityBuffer
      : null,
    particleIdentityStrideWords: 1,
    particleBufferSet: aggregateViewEnabled ? sphParticleUpload : null,
    mechanicsLevels: mechanicsAuthorityEnabled ? Array.from({ length: mechanicsLevelCount }, (_, selectedLevel) => {
      const n = nativeP2g ? Math.round(1 / (0.25 * 2**selectedLevel)) + 5
        : selectedLevel === 0 ? 8 : 5;
      return { selectedLevel, mechanicsGrid: {
        gridNodeCount: n**3, gridDims: [n,n,n], gridShift: nativeP2g ? 1 : 2,
        gridSpacingM: 0.25 * 2**selectedLevel
      } };
    }) : [],
    phaseVolumeSidecarsEnabled: mechanicsAuthorityEnabled,
    phaseVolumeReceiptEnabled,
    phaseVolumeInterfaceProposalEnabled
  });
  return {
    device,
    generation,
    levelAssignment,
    sphParticleUpload,
    mlsMpmParticleUpload: {
      mechanicsBuffer: sourceBuffers.mechanicsBuffer
    },
    sourceBuffers,
    buffer
  };
}

function liveConsumerFixture() {
  const device = createLiveFakeDevice();
  const activeNodeList = createLiveActiveNodeList(device);
  const generation = runSchroederSpatialEpochGenerationWebGpu({
    device,
    activeNodeList,
    particleCount: 2
  });
  const buffer = (label) => tagWebGpuBufferDevice(device.createBuffer({
    label,
    size: 4096,
    usage: 128
  }), device);
  const sourceBuffers = {
    stateBuffer: buffer('live-state'),
    thermoBuffer: buffer('live-thermo'),
    identityBuffer: buffer('live-identity'),
    mechanicsBuffer: buffer('live-mechanics')
  };
  return {
    device,
    generation,
    activeNodeList,
    sphParticleUpload: {
      stateBuffer: sourceBuffers.stateBuffer,
      thermoBuffer: sourceBuffers.thermoBuffer,
      identityBuffer: sourceBuffers.identityBuffer
    },
    mlsMpmParticleUpload: {
      mechanicsBuffer: sourceBuffers.mechanicsBuffer
    },
    sourceBuffers,
    buffer
  };
}

function admitMechanicsReaders(transaction, inputs) {
  assert.equal(admitSchroederSpatialEpochTransactionReader(transaction, {
    readerId: SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_P2G,
    phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.PRE_INTEGRATION,
    ...inputs
  }), true);
  assert.equal(admitSchroederSpatialEpochTransactionReader(transaction, {
    readerId: SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_G2P,
    phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.INTEGRATION_COMMIT,
    ...inputs
  }), true);
}

function nextParticleUploads(f, prefix = 'next') {
  return {
    sphParticleUpload: {
      stateBuffer: f.buffer(`${prefix}-state`),
      thermoBuffer: f.buffer(`${prefix}-thermo`),
      identityBuffer: f.buffer(`${prefix}-identity`)
    },
    mlsMpmParticleUpload: {
      mechanicsBuffer: f.buffer(`${prefix}-mechanics`)
    }
  };
}

const consumerContract = Object.freeze({
  [SCHROEDER_SPATIAL_EPOCH_READER.PRESSURE_CONTACT_INTERFACE]: Object.freeze({
    phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.PRESSURE_CONTACT_PROPOSAL,
    supportProfileId:
      SCHROEDER_SPATIAL_EPOCH_SUPPORT_PROFILE_ID.PRESSURE_CONTACT_INTERFACE,
    artifactFamily:
      SCHROEDER_SPATIAL_EPOCH_CONSUMER_ARTIFACT_FAMILY.PRESSURE_CONTACT_INTERFACE
  }),
  [SCHROEDER_SPATIAL_EPOCH_READER.REACTION_DISCOVERY]: Object.freeze({
    phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.REACTION_DISCOVERY_PROPOSAL,
    supportProfileId: SCHROEDER_SPATIAL_EPOCH_SUPPORT_PROFILE_ID.REACTION_DISCOVERY,
    artifactFamily: SCHROEDER_SPATIAL_EPOCH_CONSUMER_ARTIFACT_FAMILY.REACTION_DISCOVERY
  }),
  [SCHROEDER_SPATIAL_EPOCH_READER.REACTION_PRODUCT_PLACEMENT]: Object.freeze({
    phase:
      SCHROEDER_SPATIAL_EPOCH_READER_PHASE
        .REACTION_PRODUCT_PLACEMENT_PROPOSAL,
    supportProfileId:
      SCHROEDER_SPATIAL_EPOCH_SUPPORT_PROFILE_ID.REACTION_PRODUCT_PLACEMENT,
    artifactFamily:
      SCHROEDER_SPATIAL_EPOCH_CONSUMER_ARTIFACT_FAMILY
        .REACTION_PRODUCT_PLACEMENT
  }),
  [SCHROEDER_SPATIAL_EPOCH_READER.SEPARATION]: Object.freeze({
    phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.SEPARATION_PROPOSAL,
    supportProfileId: SCHROEDER_SPATIAL_EPOCH_SUPPORT_PROFILE_ID.SEPARATION,
    artifactFamily: SCHROEDER_SPATIAL_EPOCH_CONSUMER_ARTIFACT_FAMILY.SEPARATION
  }),
  [SCHROEDER_SPATIAL_EPOCH_READER.THERMAL_CONDUCTION]: Object.freeze({
    phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.THERMAL_CONDUCTION_PROPOSAL,
    supportProfileId: SCHROEDER_SPATIAL_EPOCH_SUPPORT_PROFILE_ID.THERMAL_CONDUCTION,
    artifactFamily: SCHROEDER_SPATIAL_EPOCH_CONSUMER_ARTIFACT_FAMILY.THERMAL_CONDUCTION
  }),
  [SCHROEDER_SPATIAL_EPOCH_READER.THERMAL_RADIATION]: Object.freeze({
    phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.THERMAL_RADIATION_PROPOSAL,
    supportProfileId: SCHROEDER_SPATIAL_EPOCH_SUPPORT_PROFILE_ID.THERMAL_RADIATION,
    artifactFamily: SCHROEDER_SPATIAL_EPOCH_CONSUMER_ARTIFACT_FAMILY.THERMAL_RADIATION
  }),
  [SCHROEDER_SPATIAL_EPOCH_READER.LOCAL_MATERIAL_INTERFACE]: Object.freeze({
    phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.LOCAL_MATERIAL_INTERFACE_PROPOSAL,
    supportProfileId:
      SCHROEDER_SPATIAL_EPOCH_SUPPORT_PROFILE_ID.LOCAL_MATERIAL_INTERFACE,
    artifactFamily:
      SCHROEDER_SPATIAL_EPOCH_CONSUMER_ARTIFACT_FAMILY.LOCAL_MATERIAL_INTERFACE
  })
});

function consumerReceipt(f, readerId, overrides = {}) {
  const contract = consumerContract[readerId];
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_EPOCH_CONSUMER_RECEIPT_SCHEMA,
    status: SCHROEDER_SPATIAL_EPOCH_CONSUMER_RECEIPT_STATUS,
    authenticated: true,
    gpuAuthenticated: true,
    submitPerformed: true,
    generationBound: true,
    consumerId: readerId,
    phase: contract.phase,
    supportProfileId: contract.supportProfileId,
    artifactFamily: contract.artifactFamily,
    deviceId: webGpuDeviceId(f.device),
    generationId: f.generation.execution.generationId,
    expectedTraversalCount: 1,
    traversalCount: 1,
    candidateVisitCount: 0,
    consumerMaskHitCount: 0,
    migratedProposalCount: 0,
    candidateBytesRequired: 0,
    candidateBytesAdmitted: 0,
    candidateBytesCapacity: 0,
    candidateOverflowBytes: 0,
    privateLookupBuildCount: 0,
    fixedCandidateBuildCount: 0,
    exhaustiveTraversalCount: 0,
    overflowed: false,
    partialPublication: false,
    fallbackObserved: false,
    fullReadbackPerformed: false,
    ...overrides,
    epochIdentity: Object.freeze({
      storageGeneration: f.generation.execution.storageGeneration,
      physicsTick: f.generation.execution.physicsTick,
      physicsSubstep: f.generation.execution.physicsSubstep,
      positionEpoch: f.generation.execution.positionEpoch,
      topologyEpoch: f.generation.execution.topologyEpoch,
      chartEpoch: f.generation.execution.chartEpoch,
      levelEpoch: f.generation.execution.levelEpoch,
      supportEpoch: f.generation.execution.supportEpoch,
      ...(overrides.epochIdentity || {})
    })
  });
}

function finalizedConsumerReceipt(f, readerId, overrides = {}) {
  const contract = consumerContract[readerId];
  const {
    expectedTraversalCount = 1,
    ...evidenceOverrides
  } = overrides;
  const authentication = resolveSchroederSpatialExactNearConsumerGeneration(
    f.generation,
    {
      device: f.device,
      consumerId: readerId,
      supportProfileId: contract.supportProfileId,
      expectedTraversalCount,
      sourceBuffer: f.activeNodeList.activeNodeBuffer
    }
  );
  assert.equal(authentication.authenticated, true);
  return finalizeSchroederSpatialExactNearConsumerReceipt(authentication, {
    schema: ULG_SCHROEDER_SPATIAL_EXACT_NEAR_GPU_EVIDENCE_SCHEMA,
    status: 'schroeder-spatial-exact-near-gpu-authenticated',
    gpuAuthenticated: true,
    consumerId: readerId,
    supportProfileId: contract.supportProfileId,
    generationId: f.generation.execution.generationId,
    epochIdentity: authentication.epochIdentity,
    traversalCount: expectedTraversalCount,
    candidateVisitCount: 0,
    consumerMaskHitCount: 0,
    migratedProposalCount: 0,
    candidateBytesRequired: 0,
    candidateBytesAdmitted: 0,
    candidateBytesCapacity: 0,
    candidateOverflowBytes: 0,
    privateLookupBuildCount: 0,
    fixedCandidateBuildCount: 0,
    exhaustiveTraversalCount: 0,
    overflowed: false,
    partialPublication: false,
    fallbackObserved: false,
    fullReadbackPerformed: false,
    ...evidenceOverrides,
    epochIdentity: authentication.epochIdentity
  });
}

function supportProfiles(readerIds) {
  return Object.fromEntries(readerIds.map((readerId) => [
    readerId,
    consumerContract[readerId].supportProfileId
  ]));
}

test('spatial epoch transaction enforces one immutable source family through commit and release', async () => {
  const f = fixture();
  const transaction = createSchroederSpatialEpochTransaction(f);
  const readerInputs = {
    generation: f.generation,
    sphParticleUpload: f.sphParticleUpload,
    mlsMpmParticleUpload: f.mlsMpmParticleUpload
  };

  assert.equal(admitSchroederSpatialEpochTransactionReader(transaction, {
    readerId: SCHROEDER_SPATIAL_EPOCH_READER.PRESSURE_INTERFACE,
    phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.PRE_INTEGRATION,
    ...readerInputs
  }), true);
  admitMechanicsReaders(transaction, readerInputs);
  assert.equal(sealSchroederSpatialEpochTransactionReaders(transaction), true);

  const quarantined = quarantineSchroederSpatialEpochTransactionLawInputs(transaction, {
    consumerId: 'reaction-post-g2p',
    schroederLawQueue: { buffer: {} },
    schroederLawNeighborCandidates: { buffer: {} }
  });
  assert.equal(quarantined.schroederLawQueue, null);
  assert.equal(quarantined.schroederLawNeighborCandidates, null);
  recordSchroederSpatialEpochTransactionLegacyLookup(transaction, {
    consumerId: 'thermal-post-g2p',
    mode: 'exhaustive-particle-scan',
    exhaustiveTraversalCount: 1
  });
  recordSchroederSpatialEpochTransactionLegacyLookup(transaction, {
    consumerId: 'reaction-post-g2p',
    mode: 'fixed-capacity-particle-bin-grid',
    privateBuildCount: 1
  });
  sealSchroederSpatialEpochTransactionProposals(transaction, {
    migratedProposalCount: 0,
    legacyConsumerCount: 2
  });
  commitSchroederSpatialEpochTransaction(transaction, {
    nextParticleUploads: nextParticleUploads(f)
  });

  let release;
  const releaseFence = new Promise((resolve) => { release = resolve; });
  const releasePromise = scheduleSchroederSpatialEpochTransactionRelease(transaction, {
    after: releaseFence
  });
  let summary = summarizeSchroederSpatialEpochTransaction(transaction);
  assert.equal(summary.state, 'release-scheduled');
  assert.deepEqual(summary.counters, {
    epochCount: 1,
    directoryBuildCount: 1,
    sortUniqueCount: 1,
    privateCanonicalLookupBuildCount: 0,
    readerAdmissionCount: 3,
    readerRejectCount: 0,
    staleReaderRejectCount: 0,
    postCommitReaderRejectCount: 0,
    duplicateReaderRejectCount: 0,
    readerOrderRejectCount: 0,
    consumerDisabledRejectCount: 0,
    consumerReceiptAdmissionCount: 0,
    consumerReceiptRejectCount: 0,
    consumerReceiptIdentityRejectCount: 0,
    consumerReceiptOverflowRejectCount: 0,
    consumerReceiptFallbackRejectCount: 0,
    submittedAggregateConsumerCount: 0,
    submittedAggregateTraversalCount: 0,
    resultAuthenticatedAggregateTraversalCount: 0,
    residentDeferredConsumerCount: 0,
    residentDeferredSharedExecutionCount: 0,
    authenticatedConsumerTraversalCount: 0,
    authenticatedCandidateVisitCount: 0,
    authenticatedConsumerMaskHitCount: 0,
    authenticatedMigratedProposalCount: 0,
    authenticatedCandidateBytesRequired: 0,
    authenticatedCandidateBytesAdmitted: 0,
    authenticatedCandidateBytesCapacity: 0,
    proposalSealCount: 1,
    privateAdvanceCount: 0,
    commitCount: 1,
    releaseScheduleCount: 1,
    releaseRetryCount: 0,
    releaseCount: 0,
    quarantinedLawQueueCount: 1,
    quarantinedCandidateViewCount: 1,
    staleLawInputForwardCount: 0,
    legacyPrivateLookupBuildCount: 1,
    legacyExhaustiveTraversalCount: 1
  });
  release(true);
  await releasePromise;
  summary = summarizeSchroederSpatialEpochTransaction(transaction);
  assert.equal(summary.state, 'released');
  assert.equal(summary.counters.releaseCount, 1);
});

test('transaction exposes one exact positive publication receipt and source-family validator', () => {
  const f = fixture();
  const transaction = createSchroederSpatialEpochTransaction(f);
  const sourceParticleUploads = {
    sphParticleUpload: f.sphParticleUpload,
    mlsMpmParticleUpload: f.mlsMpmParticleUpload
  };
  assert.equal(validateSchroederSpatialEpochTransactionSourceFamily(
    transaction,
    { generation: f.generation, ...sourceParticleUploads }
  ), true);
  assert.equal(validateSchroederSpatialEpochTransactionSourceFamily(
    transaction,
    {
      generation: f.generation,
      ...sourceParticleUploads,
      sphParticleUpload: {
        ...f.sphParticleUpload,
        stateBuffer: f.buffer('foreign-source-state')
      }
    }
  ), false);
  admitMechanicsReaders(transaction, {
    generation: f.generation,
    ...sourceParticleUploads
  });
  sealSchroederSpatialEpochTransactionReaders(transaction);
  sealSchroederSpatialEpochTransactionProposals(transaction);
  const next = nextParticleUploads(f, 'published-next');
  const receipt = commitSchroederSpatialEpochTransaction(transaction, {
    nextParticleUploads: next,
    status: 'test-positive-publication'
  });

  assert.equal(validateSchroederSpatialEpochTransactionCommit(
    transaction,
    receipt,
    {
      nextParticleUploads: next,
      expectedGeneration: f.generation,
      sourceParticleUploads
    }
  ), true);
  assert.equal(validateSchroederSpatialEpochTransactionCommit(
    transaction,
    { ...receipt },
    { nextParticleUploads: next }
  ), false);
  assert.equal(validateSchroederSpatialEpochTransactionCommit(
    transaction,
    receipt,
    { nextParticleUploads: nextParticleUploads(f, 'foreign-next') }
  ), false);
  assert.equal(validateSchroederSpatialEpochTransactionCommit(
    transaction,
    receipt,
    { nextParticleUploads: next, expectedGeneration: {} }
  ), false);
  const summary = summarizeSchroederSpatialEpochTransaction(transaction);
  assert.equal(summary.commitPublished, true);
  assert.equal(summary.commitPublicationOrdinal, 1);
  assert.equal(summary.counters.commitCount, 1);
});

test('spatial epoch transaction rejects stale, duplicate, and post-commit readers', () => {
  const f = fixture();
  const transaction = createSchroederSpatialEpochTransaction(f);
  const readerInputs = {
    generation: f.generation,
    sphParticleUpload: f.sphParticleUpload,
    mlsMpmParticleUpload: f.mlsMpmParticleUpload
  };
  assert.throws(() => admitSchroederSpatialEpochTransactionReader(transaction, {
    readerId: SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_P2G,
    phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.PRE_INTEGRATION,
    ...readerInputs,
    sphParticleUpload: {
      ...f.sphParticleUpload,
      stateBuffer: f.buffer('stale-state')
    }
  }), { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_STALE_READER' });

  admitMechanicsReaders(transaction, readerInputs);
  assert.throws(() => admitSchroederSpatialEpochTransactionReader(transaction, {
    readerId: SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_P2G,
    phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.PRE_INTEGRATION,
    ...readerInputs
  }), { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_DUPLICATE_READER' });
  sealSchroederSpatialEpochTransactionReaders(transaction);
  sealSchroederSpatialEpochTransactionProposals(transaction);
  commitSchroederSpatialEpochTransaction(transaction, {
    nextParticleUploads: nextParticleUploads(f)
  });
  assert.throws(() => admitSchroederSpatialEpochTransactionReader(transaction, {
    readerId: SCHROEDER_SPATIAL_EPOCH_READER.PRESSURE_INTERFACE,
    phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.PRE_INTEGRATION,
    ...readerInputs
  }), { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_POST_COMMIT_READ' });

  const summary = summarizeSchroederSpatialEpochTransaction(transaction);
  assert.equal(summary.counters.staleReaderRejectCount, 1);
  assert.equal(summary.counters.duplicateReaderRejectCount, 1);
  assert.equal(summary.counters.postCommitReaderRejectCount, 1);
});

test('spatial epoch transaction admits one exact two-level generation only by explicit authority opt-in', () => {
  const f = twoLevelFixture();
  const defaultTransaction = createSchroederSpatialEpochTransaction(f);
  assert.equal(defaultTransaction.twoLevelAuthoritative, false);
  assert.equal(defaultTransaction.hierarchyView, null);
  assert.equal(
    summarizeSchroederSpatialEpochTransaction(defaultTransaction)
      .twoLevelAuthoritative,
    false
  );

  const transaction = createSchroederSpatialEpochTransaction({
    ...f,
    twoLevelAuthoritative: true
  });
  assert.equal(transaction.twoLevelAuthoritative, true);
  assert.equal(transaction.aggregateViewRequired, false);
  assert.equal(transaction.aggregateView, null);
  assert.equal(f.generation.aggregateView, null);
  assert.equal(transaction.mechanicsLevelCount, 2);
  assert.deepEqual(transaction.mechanicsLevels, [0, 1]);
  assert.equal(transaction.hierarchyView, f.generation.hierarchyView);
  assert.equal(transaction.activeSourceView, f.generation.activeSourceView);
  assert.equal(
    transaction.activeSourceView.activeSourceViewBuffer,
    f.generation.execution.activeSourceViewBuffer
  );
  assert.equal(transaction.activeRankView, null);
  assert.equal(f.generation.execution.activeRankViewBuffer, null);
  const summary = summarizeSchroederSpatialEpochTransaction(transaction);
  assert.equal(summary.twoLevelAuthoritative, true);
  assert.equal(summary.aggregateViewRequired, false);
  assert.equal(summary.aggregateViewStatus, null);
  assert.equal(summary.mechanicsLevelCount, 2);
  assert.deepEqual(summary.mechanicsLevels, [0, 1]);
  assert.equal(
    summary.hierarchyViewStatus,
    'schroeder-spatial-hierarchy-view-gpu-build-submitted'
  );
  assert.equal(summary.hierarchyTopology, 'two-level-compact-parent-child-csr');
  admitMechanicsReaders(transaction, {
    generation: f.generation,
    sphParticleUpload: f.sphParticleUpload,
    mlsMpmParticleUpload: f.mlsMpmParticleUpload
  });
});

test('explicit chain authority captures all pairs and is valid only between P2G and G2P', () => {
  for (const mechanicsLevelCount of [2, 3, 6]) {
    const f = twoLevelFixture({ mechanicsLevelCount, phaseVolume: true });
    assert.equal(f.generation.ready, true, f.generation.reason);
    const transaction = createSchroederSpatialEpochTransaction({ ...f, mechanicsChainAuthoritative: true });
    const options = { device: f.device, generation: f.generation };
    assert.equal(transaction.twoLevelAuthoritative, false);
    assert.equal(transaction.mechanicsChainAuthoritative, true);
    assert.equal(transaction.mechanicsLevelCount, mechanicsLevelCount);
    assert.equal(summarizeSchroederSpatialEpochTransaction(transaction).mechanicsLevelCount, mechanicsLevelCount);
    assert.throws(() => resolveSchroederSpatialMechanicsChainAuthority(transaction, options),
      { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_CHAIN_LIFECYCLE' });
    admitSchroederSpatialEpochTransactionReader(transaction, { ...f,
      readerId: SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_P2G,
      phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.PRE_INTEGRATION });
    const chain = resolveSchroederSpatialMechanicsChainAuthority(transaction, options);
    assert.equal(Object.isFrozen(chain), true);
    assert.equal(chain.pairAuthorities.length, mechanicsLevelCount - 1);
    for (const [index, pair] of chain.pairAuthorities.entries()) {
      assert.equal(pair.parentFieldView, f.generation.mechanicsAdjacentLevelPairs[index].parentFieldView);
      assert.equal(pair.fineFieldView, f.generation.mechanicsLevelViews[index].mechanicsFieldView);
      assert.equal(pair.coarseFieldView, f.generation.mechanicsLevelViews[index+1].mechanicsFieldView);
      assert.equal(chain.phaseVolumeReceipts[index].mechanicsFieldView, pair.fineFieldView);
    }
    assert.throws(() => createSchroederSingleLevelQueueOrderedCleanupCapability(transaction,
      { ...f, readbackMode: 'no-full-readback' }),
      { code: 'ERR_SCHROEDER_SINGLE_LEVEL_QUEUE_ORDERED_CLEANUP_AUTHORITY' });
    admitSchroederSpatialEpochTransactionReader(transaction, { ...f,
      readerId: SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_G2P,
      phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.INTEGRATION_COMMIT });
    assert.throws(() => resolveSchroederSpatialMechanicsChainAuthority(transaction, options),
      { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_CHAIN_LIFECYCLE' });
    abortSchroederSpatialEpochTransaction(transaction);
  }
});

test('cross-level transport binds original sources and keeps its buffers until confirmed consumer retirement', async () => {
  const { prepareSchroederChainCrossTransport, resolveSchroederChainCrossTransport } =
    await import('../src/runtime/sph/schroederSpatialChainCrossTransportGpu.js');
  const { buildMlsMpmMechanicsMaterialTable } = await import('../src/runtime/sph/sphMechanicsMaterialTable.js');
  const { uploadMlsMpmMechanicsMaterialPhaseRecords } = await import('../src/runtime/sph/sphMechanicsRefreshGpuKernel.js');
  const f = twoLevelFixture({ mechanicsLevelCount: 3, phaseVolume: true });
  f.device.createBindGroupLayout = d => d;
  f.device.createPipelineLayout = d => d;
  const transaction = createSchroederSpatialEpochTransaction({ ...f, mechanicsChainAuthoritative: true });
  admitSchroederSpatialEpochTransactionReader(transaction, { ...f,
    readerId: SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_P2G,
    phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.PRE_INTEGRATION });
  const table = buildMlsMpmMechanicsMaterialTable({ gas: { molarMassKgPerMol: 0.028,
    phases: [{ name: 'gas', densityKgPerM3: 1, cpJPerKgK: 1000,
      dynamicViscosityPaS: 0.00001, temperatureRange: [100, 1000] }] } });
  const upload = uploadMlsMpmMechanicsMaterialPhaseRecords(f.device, table);
  const laws = f.generation.mechanicsLevelViews.map(() => ({ mechanicsMaterialTable: table,
    mechanicsMaterialPhaseUpload: upload, phaseVolumeInterfaceTransportRequired: true, phaseVolumePressureScale: 0 }));
  const prepare = localLawInputs => prepareSchroederChainCrossTransport({ device: f.device, transaction, localLawInputs });
  const allocated = [], createBuffer = f.device.createBuffer.bind(f.device);
  f.device.createBuffer = descriptor => { const buffer = createBuffer(descriptor); allocated.push(buffer); return buffer; };
  assert.throws(() => prepare(laws), /ten storage bindings/);
  f.device.limits.maxStorageBuffersPerShaderStage = 10;
  for (const change of [{ phaseVolumePressureScale: 1 }, { phaseVolumeInterfaceTransportRequired: false },
    { phaseVolumeDragScale: 2 }, { mechanicsMaterialTable: { ...table } }]) {
    assert.throws(() => prepare(laws.map((law, i) => i === 1 ? { ...law, ...change } : law)), /common explicit phase laws/);
  }
  assert.equal(allocated.length, 0, 'unsupported laws refuse before allocating or acquiring a lease');
  const handle = prepare(laws), owner = resolveSchroederChainCrossTransport(handle, f.device, transaction);
  assert.throws(() => resolveSchroederChainCrossTransport({ ...handle }, f.device, transaction), /original phase\/source owner/);
  assert.throws(() => resolveSchroederChainCrossTransport(handle, {}, transaction), /original phase\/source owner/);
  assert.throws(() => resolveSchroederChainCrossTransport(handle, f.device, { ...transaction }), /original phase\/source owner/);
  assert.throws(() => resolveSchroederChainCrossTransport(handle, f.device, transaction,
    owner.laws.map((law, i) => i === 1 ? { ...law, phaseVolumeDragScale: 2 } : law)), /original phase\/source owner/);
  const records = upload.recordsBuffer;
  upload.recordsBuffer = f.buffer('foreign-material-records');
  assert.throws(() => owner.validate(), /material or source authority changed/);
  upload.recordsBuffer.destroy(); upload.recordsBuffer = records;
  const original = table.records[0]; table.records[0] = original + 1;
  assert.throws(() => owner.validate(), /material or source authority changed/);
  table.records[0] = original;
  owner.validate();
  owner.encodeMoments(createFakeEncoder());
  assert.throws(() => owner.encodeMoments(createFakeEncoder()), /already encoded/);
  owner.submitted();
  assert.throws(() => owner.submitted(), /stale/);
  await assert.rejects(handle.retire(), /existing consumer fence/);
  await assert.rejects(handle.retire(Promise.reject(new Error('cross consumer fence failed'))), /cross consumer fence failed/);
  assert.equal(owner.closed, false);
  const liveBuffers = allocated.filter(buffer => !buffer.destroyed);
  assert.ok(liveBuffers.length > 0);
  let finish;
  const retirement = handle.retire(new Promise(resolve => { finish = resolve; }));
  assert.ok(liveBuffers.every(buffer => !buffer.destroyed));
  finish(); await retirement;
  assert.ok(liveBuffers.every(buffer => buffer.destroyed));
  assert.throws(() => resolveSchroederChainCrossTransport(handle, f.device, transaction), /original phase\/source owner/);
  upload.destroyMechanicsMaterialPhaseUpload();
  abortSchroederSpatialEpochTransaction(transaction);
});

test('cross-level transport meets the Section 3 dispatch budget with zero indirect dispatches per level pair', async () => {
  const {
    prepareSchroederChainCrossTransport,
    resolveSchroederChainCrossTransport,
    SCHROEDER_SPATIAL_CHAIN_CROSS_TRANSPORT_INDIRECT_DISPATCHES_PER_PAIR,
    SCHROEDER_SPATIAL_CHAIN_CROSS_TRANSPORT_DIRECT_DISPATCHES_PER_PAIR
  } = await import('../src/runtime/sph/schroederSpatialChainCrossTransportGpu.js');
  const { buildMlsMpmMechanicsMaterialTable } = await import('../src/runtime/sph/sphMechanicsMaterialTable.js');
  const { uploadMlsMpmMechanicsMaterialPhaseRecords } = await import('../src/runtime/sph/sphMechanicsRefreshGpuKernel.js');
  assert.equal(SCHROEDER_SPATIAL_CHAIN_CROSS_TRANSPORT_INDIRECT_DISPATCHES_PER_PAIR, 0);
  assert.ok(SCHROEDER_SPATIAL_CHAIN_CROSS_TRANSPORT_INDIRECT_DISPATCHES_PER_PAIR <= 16);
  assert.equal(SCHROEDER_SPATIAL_CHAIN_CROSS_TRANSPORT_DIRECT_DISPATCHES_PER_PAIR, 6);
  const f = twoLevelFixture({ mechanicsLevelCount: 3, phaseVolume: true });
  f.device.limits.maxStorageBuffersPerShaderStage = 10;
  f.device.createBindGroupLayout = (d) => d;
  f.device.createPipelineLayout = (d) => d;
  const transaction = createSchroederSpatialEpochTransaction({ ...f, mechanicsChainAuthoritative: true });
  admitSchroederSpatialEpochTransactionReader(transaction, {
    ...f,
    readerId: SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_P2G,
    phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.PRE_INTEGRATION
  });
  const table = buildMlsMpmMechanicsMaterialTable({
    gas: {
      molarMassKgPerMol: 0.028,
      phases: [{
        name: 'gas',
        densityKgPerM3: 1,
        cpJPerKgK: 1000,
        dynamicViscosityPaS: 0.00001,
        temperatureRange: [100, 1000]
      }]
    }
  });
  const upload = uploadMlsMpmMechanicsMaterialPhaseRecords(f.device, table);
  const laws = f.generation.mechanicsLevelViews.map(() => ({
    mechanicsMaterialTable: table,
    mechanicsMaterialPhaseUpload: upload,
    phaseVolumeInterfaceTransportRequired: true,
    phaseVolumePressureScale: 0
  }));
  const handle = prepareSchroederChainCrossTransport({ device: f.device, transaction, localLawInputs: laws });
  const owner = resolveSchroederChainCrossTransport(handle, f.device, transaction);
  owner.encodeMoments(createFakeEncoder());
  let directDispatches = 0;
  let indirectDispatches = 0;
  let computePasses = 0;
  const countedEncoder = {
    clearBuffer() {},
    copyBufferToBuffer() {},
    beginComputePass() {
      computePasses += 1;
      return {
        setPipeline() {},
        setBindGroup() {},
        dispatchWorkgroups() { directDispatches += 1; },
        dispatchWorkgroupsIndirect() { indirectDispatches += 1; },
        end() {}
      };
    },
    finish() { return {}; }
  };
  const pairField = f.buffer('pair-field-scratch');
  const pairOriginal = f.buffer('pair-original-scratch');
  owner.encodePair(countedEncoder, 0, pairField, pairField, pairOriginal, pairField, 1, { dt: 0.001, cflFactor: 0.4 });
  assert.equal(indirectDispatches, 0, 'cross-transport exchange must use 0 indirect dispatches per level pair');
  assert.equal(computePasses, 2, 'cross-transport exchange must stay within 2 compute passes per level pair');
  assert.equal(directDispatches, 7, '1 prolong dispatch + 6 simultaneous cross-transport dispatches');
  owner.submitted();
  await handle.retire(Promise.resolve());
  pairField.destroy();
  pairOriginal.destroy();
  upload.destroyMechanicsMaterialPhaseUpload();
  abortSchroederSpatialEpochTransaction(transaction);
});

test('composite mechanics binds every current level and retains its arena until queue retirement', async () => {
  const f = twoLevelFixture({ mechanicsLevelCount: 6, phaseVolume: true, nativeP2g: true });
  f.device.createBindGroupLayout = d => d;
  f.device.createPipelineLayout = d => d;
  Object.assign(f.sphParticleUpload, {schema: ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
    stateBufferByteLength:64, thermoBufferByteLength:96, identityBufferByteLength:8});
  Object.assign(f.mlsMpmParticleUpload, {schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
    status:'webgpu-uploaded', particleCount:2, mechanicsStrideBytes:128, mechanicsBufferByteLength:256});
  const transaction = createSchroederSpatialEpochTransaction({ ...f, mechanicsChainAuthoritative: true });
  admitSchroederSpatialEpochTransactionReader(transaction, { ...f,
    readerId: SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_P2G,
    phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.PRE_INTEGRATION });
  const runtime = createSchroederSpatialCompositeMechanicsGpu(f.device, {
    parentFieldCapacities: f.generation.mechanicsAdjacentLevelPairs.map(p => p.parentFieldView.parentFieldCapacity),
    nativeFieldCapacities: f.generation.mechanicsLevelViews.map(v=>v.mechanicsFieldView.fieldCapacity),
    arenaCount: 1
  });
  const encode = () => runtime.encode(createFakeEncoder(), { transaction });
  assert.throws(encode, /P2G momentum/);
  const fields=f.generation.mechanicsLevelViews.map(v => v.mechanicsFieldView);
  // Exercise the real producer registration against a protocol-only device.
  // Physics assertions remain in the native GPU matrix.
  const p2gProjections=[];
  const project = spec => runMlsMpmP2gGridProjectionWebGpu({device:f.device,
      sphParticleState:{schema:ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,particleCount:2},
      mlsMpmParticleState:{schema:ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,particleCount:2},
      sphParticleUpload:f.sphParticleUpload,mlsMpmParticleUpload:f.mlsMpmParticleUpload,
      schroederSpatialEpochGeneration:f.generation,canonicalSpatialRequired:true,
      schroederSelectedLevel:spec.selectedLevel,mechanicsFieldMode:'required',
      gridSpacingM:0.25 * 2**spec.selectedLevel,boxDimsM:[1,1,1],
      dt:0.001,internalPressureScale:0,readbackMode:'no-full-readback'});
  for (const spec of fields) p2gProjections.push(await project(spec));
  const first=encode();
  assert.equal(first.pairs.length,5);
  assert.equal(first.gpuBufferCreationCountDuringEncode,0);
  for (let i=1; i<5; i++) assert.equal(first.pairs[i].sourceStateBuffer,first.pairs[i-1].stateBuffer);
  assert.equal(runtime.ownsExecution({...first}),false);
  const pending=fields[3].ownerRuntime.reserveStateMutation(fields[3], {
    expectedOrdinal: 1, expectedEncoding: 1, outputEncoding: 2, operation: 'test-host-protocol'
  });
  assert.equal(runtime.ownsExecution(first),false);
  assert.throws(() => runtime.markExecutionSubmitted(first),/stale/);
  fields[3].ownerRuntime.discardStateMutation(pending,{discardedEncoder:true});
  assert.equal(runtime.ownsExecution(first),true);
  assert.throws(() => runtime.discardExecution(first),/discarded encoder/);
  runtime.discardExecution(first,{discardedEncoder:true});
  const forceInputs={dt:0.001,gravityMPerS2:[0,-9.81,0],boxDimsM:[32,32,32],
    wallsEnabled:false,contactEnabled:false,cflFactor:0.4,
    wallBarrierElasticStiffnessNPerM:0,wallBarrierContactScale:1,wallBarrierMinGapM:0.0001};
  for (const bad of [{...forceInputs,gravityMPerS2:null},{...forceInputs,dt:0},
    {...forceInputs,wallsEnabled:undefined},{...forceInputs,cflFactor:Infinity}]) {
    assert.throws(()=>runtime.encode(createFakeEncoder(),{transaction,forceInputs:bad}),/Chain force/);
  }
  assert.throws(()=>runtime.encode(createFakeEncoder(),{transaction,forceInputs}),/exact submitted native P2G/);
  const second=runtime.encode(createFakeEncoder(),{transaction,forceInputs,p2gProjections});
  const exactFirstProjection=p2gProjections[0];
  p2gProjections[0]={...exactFirstProjection};
  assert.equal(runtime.ownsExecution(second),true,'caller array cannot replace retained producers');
  p2gProjections[0]=exactFirstProjection;
  const productDispatch=exactFirstProjection.residentProductMassProductEventDispatchMode;
  exactFirstProjection.residentProductMassProductEventDispatchMode='forged-isolation';
  assert.equal(runtime.ownsExecution(second),false,'product-source isolation belongs to the original P2G');
  exactFirstProjection.residentProductMassProductEventDispatchMode=productDispatch;
  assert.equal(runtime.ownsExecution(second),true);
  assert.equal(second.correction.nativeStates.length,6);
  assert.equal(second.correction.updatedPairs.length,5);
  assert.equal(Object.isFrozen(second.correction.forceInputs.gravityMPerS2),true);
  forceInputs.gravityMPerS2[1]=0;
  assert.equal(second.correction.forceInputs.gravityMPerS2[1],Math.fround(-9.81));
  second.correction.nativeStates[3].stateBuffer.destroyed=true;
  assert.equal(runtime.ownsExecution(second),false);
  second.correction.nativeStates[3].stateBuffer.destroyed=false;
  assert.equal(second.pairs[0].stateBuffer,first.pairs[0].stateBuffer);
  assert.ok(second.completionOrdinal>first.completionOrdinal);
  runtime.markExecutionSubmitted(second);
  assert.throws(() => runtime.markExecutionSubmitted(second),/stale/);
  assert.throws(encode,/backpressure/);
  assert.throws(() => runtime.destroy(),/live executions/);
  f.device.queue.onSubmittedWorkDone=()=>undefined;
  await assert.rejects(runtime.releaseExecutionAfter(second),/completion evidence/);
  assert.throws(encode,/backpressure/);
  f.device.queue.onSubmittedWorkDone=()=>Promise.reject(new Error('test fence failed'));
  await assert.rejects(runtime.releaseExecutionAfter(second),/test fence failed/);
  assert.equal(runtime.isExecutionSubmitted(second),true);
  assert.throws(encode,/backpressure/);
  let finish;
  f.device.queue.onSubmittedWorkDone=()=>new Promise(resolve=>{finish=resolve;});
  const release=runtime.releaseExecutionAfter(second);
  assert.equal(runtime.releaseExecutionAfter(second),release);
  assert.equal(second.released,false);
  finish();
  assert.equal(await release,true);
  assert.equal(second.released,true);
  assert.equal(runtime.ownsExecution(second),false);
  // A real replacement P2G on the same field invalidates the old producer,
  // even though its public buffer, timestep and grid still match.
  const replacement=await project(fields[0]);
  assert.throws(()=>runtime.encode(createFakeEncoder(),{transaction,forceInputs,p2gProjections}),
    /exact submitted native P2G/);
  p2gProjections[0]=replacement;
  const third=runtime.encode(createFakeEncoder(),{transaction,forceInputs,p2gProjections});
  runtime.markExecutionSubmitted(third);
  await assert.rejects(runtime.publishNativeState(third,{localLawInputs:[{}]}),/one local law declaration/);
  await assert.rejects(runtime.publishNativeState(third,{localLawInputs:fields.map(()=>({
    phaseVolumeInterfaceTransportRequired:true
  }))}),/original pre-P2G topology family/);
  await assert.rejects(runtime.publishNativeState(third,{localLawInputs:fields.map(()=>({
    gasPressureMechanicsScale:NaN
  }))}),/finite and nonnegative/);
  assert.equal(fields.every(field=>!field.ownerRuntime.stateMutationState(field).pending),true,
    'invalid local laws do not acquire any native mutation');
  f.device.queue.onSubmittedWorkDone=()=>Promise.resolve();
  let publicationSubmits=0,retirementRefused;
  f.device.queue.submit=()=>{
    if(publicationSubmits++===0) {
      assert.equal(fields.every(field=>field.ownerRuntime.stateMutationState(field).pending),true,
        'every level reserved before the first native publication');
      retirementRefused=runtime.releaseExecutionAfter(third).then(()=>false,()=>true);
    }
  };
  const publicationPending=runtime.publishNativeState(third);
  await assert.rejects(runtime.publishNativeState(third),/unconsumed submitted chain/);
  const publication=await publicationPending;
  assert.equal(publication.updates.length,6);
  for(const update of publication.updates) {
    assert.equal(update.mechanicsFieldGridUpdateHotPathAllocationCount,0);
    assert.equal(update.mapAsyncCount,0);
    assert.equal(update.hostQueueFenceCount,0);
  }
  assert.equal(publicationSubmits,6);
  assert.equal(await retirementRefused,true);
  assert.equal(fields.every(field=>field.ownerRuntime.stateMutationState(field).encoding===2),true);
  await assert.rejects(runtime.publishNativeState(third),/unconsumed submitted chain/);
  const consumerOptions={...f,transaction};
  assert.throws(()=>acquireSchroederNativePublication({...publication},consumerOptions),/genuine live/);
  const oldDt=publication.updates[0].dt;
  publication.updates[0].dt=oldDt*2;
  assert.throws(()=>acquireSchroederNativePublication(publication,consumerOptions),/genuine live/);
  publication.updates[0].dt=oldDt;
  const consumer=acquireSchroederNativePublication(publication,consumerOptions);
  assert.equal(consumer.validate(),true);
  assert.throws(()=>acquireSchroederNativePublication(publication,consumerOptions),/already has/);
  await assert.rejects(runtime.releaseExecutionAfter(third),/G2P still owns/);
  assert.equal(consumer.finish({submitted:true}),true);
  assert.throws(()=>consumer.validate(),/closed/);
  assert.throws(()=>acquireSchroederNativePublication(publication,consumerOptions),/already has/);
  await runtime.releaseExecutionAfter(third);
  assert.throws(()=>acquireSchroederNativePublication(publication,consumerOptions),/genuine live/);
  // A submit exception is not proof that no command reached the queue. Keep
  // that field quarantined, discard only untouched reservations, and deny retry.
  f.device.queue.submit=()=>{};
  for(let i=0;i<fields.length;i++) p2gProjections[i]=await project(fields[i]);
  const fourth=runtime.encode(createFakeEncoder(),{transaction,forceInputs,p2gProjections});
  runtime.markExecutionSubmitted(fourth);
  f.device.queue.submit=()=>{throw new Error('injected native submit uncertainty');};
  await assert.rejects(runtime.publishNativeState(fourth),/injected native submit uncertainty/);
  assert.equal(fields[0].ownerRuntime.stateMutationState(fields[0]).quarantined,true);
  assert.equal(fields.slice(1).every(field=>!field.ownerRuntime.stateMutationState(field).pending),true);
  await assert.rejects(runtime.publishNativeState(fourth),/unconsumed submitted chain/);
  await runtime.releaseExecutionAfter(fourth);
  runtime.destroy();
  abortSchroederSpatialEpochTransaction(transaction);
});

test('chain creation rejects missing reordered foreign and disconnected middle pairs', () => {
  const f = twoLevelFixture({ mechanicsLevelCount: 4, phaseVolume: true });
  const foreign = twoLevelFixture({ mechanicsLevelCount: 4, phaseVolume: true });
  const pairs = f.generation.mechanicsAdjacentLevelPairs;
  const variants = [null, pairs.slice(), Object.freeze(pairs.slice(0, 2)),
    Object.freeze([pairs[1], pairs[0], pairs[2]]),
    Object.freeze([pairs[0], foreign.generation.mechanicsAdjacentLevelPairs[1], pairs[2]]),
    Object.freeze([pairs[0], Object.freeze({ ...pairs[1], parentFieldView: pairs[0].parentFieldView }), pairs[2]])];
  for (const mechanicsAdjacentLevelPairs of variants) {
    assert.throws(() => createSchroederSpatialEpochTransaction({ ...f,
      generation: { ...f.generation, mechanicsAdjacentLevelPairs }, mechanicsChainAuthoritative: true }),
      /chain|two-level|topology/i);
  }
  for (const options of [{ mechanicsChainAuthoritative: 'yes' },
    { mechanicsChainAuthoritative: true, twoLevelAuthoritative: true },
    { mechanicsChainAuthoritative: true, phaseVolumeInterfaceProposalAuthoritative: true }]) {
    assert.throws(() => createSchroederSpatialEpochTransaction({ ...f, ...options }));
  }
});

test('chain local pressure/surface authority binds every native level and the whole hierarchy', () => {
  const f=twoLevelFixture({mechanicsLevelCount:6,phaseVolume:true});
  const transaction=createSchroederSpatialEpochTransaction({...f,mechanicsChainAuthoritative:true});
  const resolve=(view,generation=f.generation)=>resolveSchroederSpatialPhaseVolumeSurfaceStressAuthority(transaction,{
    generation,selectedLevel:view.selectedLevel,mechanicsFieldView:view.mechanicsFieldView
  });
  const views=f.generation.mechanicsLevelViews;
  assert.throws(()=>resolve(views[0]),{code:'ERR_SCHROEDER_SURFACE_STRESS_LIFECYCLE'});
  admitSchroederSpatialEpochTransactionReader(transaction,{...f,readerId:SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_P2G,
    phase:SCHROEDER_SPATIAL_EPOCH_READER_PHASE.PRE_INTEGRATION});
  for(const view of views){
    const authority=resolve(view);
    assert.equal(authority.levelRole,'native-chain');
    assert.equal(authority.phaseVolumeMoment,view.phaseVolumeMoment);
    assert.equal(authority.phaseVolumeReceipt,view.phaseVolumeReceipt);
    assert.throws(()=>resolve({...view,mechanicsFieldView:{...view.mechanicsFieldView}}),
      {code:'ERR_SCHROEDER_SURFACE_STRESS_IDENTITY'});
  }
  assert.throws(()=>resolve(views[0],{...f.generation}),{code:'ERR_SCHROEDER_SURFACE_STRESS_IDENTITY'});
  const middle=views[3].phaseVolumeMoment,original=middle.momentBuffer;
  middle.momentBuffer={...original};
  assert.throws(()=>resolve(views[0]),{code:'ERR_SCHROEDER_SURFACE_STRESS_IDENTITY'});
  middle.momentBuffer=original;
  admitSchroederSpatialEpochTransactionReader(transaction,{...f,readerId:SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_G2P,
    phase:SCHROEDER_SPATIAL_EPOCH_READER_PHASE.INTEGRATION_COMMIT});
  assert.throws(()=>resolve(views[0]),{code:'ERR_SCHROEDER_SURFACE_STRESS_LIFECYCLE'});
  abortSchroederSpatialEpochTransaction(transaction);
});

test('chain snapshots reject intermediate descriptor and buffer mutation after admission', () => {
  const f = twoLevelFixture({ mechanicsLevelCount: 6, phaseVolume: true });
  assert.equal(f.generation.ready, true, f.generation.reason);
  const transaction = createSchroederSpatialEpochTransaction({ ...f, mechanicsChainAuthoritative: true });
  admitSchroederSpatialEpochTransactionReader(transaction, { ...f,
    readerId: SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_P2G,
    phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.PRE_INTEGRATION });
  const options = { device: f.device, generation: f.generation };
  const view = f.generation.mechanicsLevelViews[3];
  const pair = f.generation.mechanicsAdjacentLevelPairs[3];
  const changes = [
    [f.generation, 'mechanicsAdjacentLevelPairs', Object.freeze([...f.generation.mechanicsAdjacentLevelPairs])],
    [view.mechanicsFieldView, 'fieldViewBuffer', f.buffer('foreign field')],
    [view.phaseVolumeMoment, 'momentBuffer', f.buffer('foreign moment')],
    [view.phaseVolumeReceipt, 'controlBuffer', f.buffer('foreign receipt')],
    [pair.hierarchyView, 'hierarchyViewBuffer', f.buffer('foreign hierarchy')],
    [pair.parentFieldView, 'parentFieldViewBuffer', f.buffer('foreign parent')],
    [pair.parentFieldView, 'inheritedFineParentView', null],
    [pair.parentFieldView, 'generationId', pair.parentFieldView.generationId + 1]
  ];
  for (const [object, key, replacement] of changes) {
    const original = object[key];
    try {
      object[key] = replacement;
      assert.equal(validateSchroederSpatialEpochTransactionSourceFamily(transaction, f), false, key);
      assert.throws(() => resolveSchroederSpatialMechanicsChainAuthority(transaction, options),
        { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_CHAIN_IDENTITY' }, key);
    } finally { object[key] = original; }
    assert.equal(resolveSchroederSpatialMechanicsChainAuthority(transaction, options).pairAuthorities.length, 5);
  }
  assert.throws(() => resolveSchroederSpatialMechanicsChainAuthority(transaction, { ...options, device: {} }),
    { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_CHAIN_IDENTITY' });
  abortSchroederSpatialEpochTransaction(transaction);
});

test('two-level aggregate construction matches the immutable FAR reader contract', () => {
  const privateGeneration = twoLevelFixture();
  assert.equal(privateGeneration.generation.aggregateView, null);
  assert.throws(
    () => createSchroederSpatialEpochTransaction({
      ...privateGeneration,
      twoLevelAuthoritative: true,
      enabledConsumerReaderIds: [
        SCHROEDER_SPATIAL_EPOCH_READER.FAR_AGGREGATE
      ],
      consumerSupportProfileIds: {}
    }),
    { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_TWO_LEVEL_AGGREGATE_IDENTITY' }
  );

  const surplusGeneration = twoLevelFixture({
    aggregateViewEnabled: true
  });
  assert.ok(surplusGeneration.generation.aggregateView);
  assert.throws(
    () => createSchroederSpatialEpochTransaction({
      ...surplusGeneration,
      twoLevelAuthoritative: true,
      enabledConsumerReaderIds: [],
      consumerSupportProfileIds: {}
    }),
    { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_TWO_LEVEL_AGGREGATE_IDENTITY' }
  );
});

test('two-level transaction exposes and freezes the submitted read-only phase-volume receipt', () => {
  const f = twoLevelFixture({ phaseVolume: true });
  assert.equal(f.generation.selected, true, f.generation.reason);
  assert.ok(f.generation.phaseVolumeMoment);
  assert.ok(f.generation.phaseVolumeReceipt);
  assert.equal(f.generation.phaseVolumeInterfaceProposalEnabled, false);
  assert.equal(f.generation.phaseVolumeInterfaceProposal, null);
  const transaction = createSchroederSpatialEpochTransaction({
    ...f,
    twoLevelAuthoritative: true
  });
  assert.equal(transaction.phaseVolumeReceipt, f.generation.phaseVolumeReceipt);
  assert.equal(
    transaction.phaseVolumeReceiptRuntime,
    f.generation.phaseVolumeReceiptRuntime
  );
  assert.equal(
    transaction.phaseVolumeReceiptPolicy,
    'read-only-law-and-transport-eligibility'
  );
  let summary = summarizeSchroederSpatialEpochTransaction(transaction);
  assert.equal(
    summary.phaseVolumeReceiptStatus,
    'schroeder-spatial-phase-volume-receipt-gpu-build-submitted'
  );
  assert.equal(summary.phaseVolumeReceiptReadOnly, true);

  const originalMutationPolicy = f.generation.phaseVolumeReceipt.stateMutationAllowed;
  f.generation.phaseVolumeReceipt.stateMutationAllowed = true;
  assert.equal(validateSchroederSpatialEpochTransactionSourceFamily(
    transaction,
    {
      generation: f.generation,
      sphParticleUpload: f.sphParticleUpload,
      mlsMpmParticleUpload: f.mlsMpmParticleUpload
    }
  ), false);
  f.generation.phaseVolumeReceipt.stateMutationAllowed = originalMutationPolicy;

  assert.equal(validateSchroederSpatialEpochTransactionSourceFamily(
    transaction,
    {
      generation: f.generation,
      sphParticleUpload: f.sphParticleUpload,
      mlsMpmParticleUpload: f.mlsMpmParticleUpload
    }
  ), true);
  summary = summarizeSchroederSpatialEpochTransaction(transaction);
  assert.equal(summary.phaseVolumeReceiptReadOnly, true);
});

test('two-level transaction exposes and freezes an explicitly authorized read-only S9-C interface proposal', () => {
  const f = twoLevelFixture({
    phaseVolume: true,
    phaseVolumeInterfaceProposalEnabled: true
  });
  assert.equal(f.generation.ready, true, f.generation.reason);
  const proposal = f.generation.phaseVolumeInterfaceProposal;
  assert.ok(proposal);
  assert.equal(
    validateSchroederSpatialPhaseVolumeInterfaceProposalDescriptor(proposal, {
      generationId: f.generation.execution.generationId,
      fineLevel: 0,
      coarseLevel: 1
    }).admitted,
    true
  );

  const hiddenTransaction = createSchroederSpatialEpochTransaction({
    ...f,
    twoLevelAuthoritative: true
  });
  assert.equal(hiddenTransaction.phaseVolumeInterfaceProposal, null);

  const transaction = createSchroederSpatialEpochTransaction({
    ...f,
    twoLevelAuthoritative: true,
    phaseVolumeInterfaceProposalAuthoritative: true
  });
  assert.equal(transaction.phaseVolumeInterfaceProposal, proposal);
  assert.equal(
    transaction.phaseVolumeInterfaceProposalRuntime,
    f.generation.phaseVolumeInterfaceProposalRuntime
  );
  assert.equal(
    transaction.phaseVolumeInterfaceProposalPolicy,
    'read-only-interface-topology-transport-authority'
  );
  let summary = summarizeSchroederSpatialEpochTransaction(transaction);
  assert.equal(summary.phaseVolumeInterfaceProposalAuthoritative, true);
  assert.equal(
    summary.phaseVolumeInterfaceProposalStatus,
    'schroeder-spatial-phase-volume-interface-proposal-gpu-build-submitted'
  );
  assert.equal(summary.phaseVolumeInterfaceProposalReadOnly, true);
  assert.equal(summary.phaseVolumeInterfaceProposalTwoLevel, true);
  assert.equal(summary.phaseVolumeInterfaceProposalDispatchCount, 3);
  assert.ok(summary.phaseVolumeInterfaceProposalRetainedGpuBufferBytes > 0);

  const originalParentFieldView = proposal.parentFieldView;
  proposal.parentFieldView = { ...originalParentFieldView };
  assert.equal(validateSchroederSpatialEpochTransactionSourceFamily(
    transaction,
    {
      generation: f.generation,
      sphParticleUpload: f.sphParticleUpload,
      mlsMpmParticleUpload: f.mlsMpmParticleUpload
    }
  ), false);
  proposal.parentFieldView = originalParentFieldView;
  assert.equal(validateSchroederSpatialEpochTransactionSourceFamily(
    transaction,
    {
      generation: f.generation,
      sphParticleUpload: f.sphParticleUpload,
      mlsMpmParticleUpload: f.mlsMpmParticleUpload
    }
  ), true);
  summary = summarizeSchroederSpatialEpochTransaction(transaction);
  assert.equal(summary.phaseVolumeInterfaceProposalReadOnly, true);
});

test('single-level S9-A/B surface-stress authority is exact between P2G and G2P', () => {
  const f = twoLevelFixture({
    phaseVolume: true,
    mechanicsLevelCount: 1
  });
  assert.equal(f.generation.ready, true, f.generation.reason);
  assert.equal(f.generation.mechanicsLevelViews.length, 1);
  assert.equal(f.generation.phaseVolumeInterfaceProposal, null);
  const transaction = createSchroederSpatialEpochTransaction(f);
  const readerInputs = {
    generation: f.generation,
    sphParticleUpload: f.sphParticleUpload,
    mlsMpmParticleUpload: f.mlsMpmParticleUpload
  };
  const fieldView = f.generation.mechanicsFieldView;

  assert.throws(
    () => resolveSchroederSpatialPhaseVolumeSurfaceStressAuthority(
      transaction,
      {
        generation: f.generation,
        selectedLevel: 0,
        mechanicsFieldView: fieldView
      }
    ),
    { code: 'ERR_SCHROEDER_SURFACE_STRESS_LIFECYCLE' }
  );
  assert.equal(admitSchroederSpatialEpochTransactionReader(transaction, {
    readerId: SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_P2G,
    phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.PRE_INTEGRATION,
    ...readerInputs
  }), true);

  const surface = resolveSchroederSpatialPhaseVolumeSurfaceStressAuthority(
    transaction,
    {
      generation: f.generation,
      selectedLevel: 0,
      mechanicsFieldView: fieldView
    }
  );
  assert.equal(
    surface.schema,
    'peercompute.ulg.schroeder-spatial-phase-volume-surface-stress-authority.v1'
  );
  assert.equal(surface.levelRole, 'single');
  assert.equal(surface.twoLevel, false);
  assert.equal(surface.mechanicsFieldView, fieldView);
  assert.equal(surface.phaseVolumeMoment, f.generation.phaseVolumeMoment);
  assert.equal(surface.phaseVolumeReceipt, f.generation.phaseVolumeReceipt);
  assert.equal(surface.fieldCapacity, f.generation.phaseVolumeReceipt.fieldCapacity);

  assert.throws(
    () => resolveSchroederSpatialPhaseVolumeSurfaceStressAuthority(
      transaction,
      {
        generation: f.generation,
        selectedLevel: 1,
        mechanicsFieldView: fieldView
      }
    ),
    { code: 'ERR_SCHROEDER_SURFACE_STRESS_LEVEL' }
  );
  assert.throws(
    () => resolveSchroederSpatialPhaseVolumeSurfaceStressAuthority(
      transaction,
      {
        generation: f.generation,
        selectedLevel: 0,
        mechanicsFieldView: { ...fieldView }
      }
    ),
    { code: 'ERR_SCHROEDER_SURFACE_STRESS_IDENTITY' }
  );
  assert.throws(
    () => resolveSchroederSpatialPhaseVolumeSurfaceStressAuthority(
      transaction,
      {
        generation: { ...f.generation },
        selectedLevel: 0,
        mechanicsFieldView: fieldView
      }
    ),
    { code: 'ERR_SCHROEDER_SURFACE_STRESS_IDENTITY' }
  );

  assert.equal(admitSchroederSpatialEpochTransactionReader(transaction, {
    readerId: SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_G2P,
    phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.INTEGRATION_COMMIT,
    ...readerInputs
  }), true);
  assert.throws(
    () => resolveSchroederSpatialPhaseVolumeSurfaceStressAuthority(
      transaction,
      {
        generation: f.generation,
        selectedLevel: 0,
        mechanicsFieldView: fieldView
      }
    ),
    { code: 'ERR_SCHROEDER_SURFACE_STRESS_LIFECYCLE' }
  );
});

test('S9-C transport authority is exact and exists only between P2G and G2P', () => {
  const f = twoLevelFixture({
    phaseVolume: true,
    phaseVolumeInterfaceProposalEnabled: true
  });
  const transaction = createSchroederSpatialEpochTransaction({
    ...f,
    twoLevelAuthoritative: true,
    phaseVolumeInterfaceProposalAuthoritative: true
  });
  const readerInputs = {
    generation: f.generation,
    sphParticleUpload: f.sphParticleUpload,
    mlsMpmParticleUpload: f.mlsMpmParticleUpload
  };
  const fineFieldView = f.generation.mechanicsLevelViews[0].mechanicsFieldView;
  const coarseFieldView = f.generation.mechanicsLevelViews[1].mechanicsFieldView;

  assert.throws(
    () => resolveSchroederSpatialPhaseVolumeTransportAuthority(transaction, {
      generation: f.generation,
      selectedLevel: 0,
      mechanicsFieldView: fineFieldView
    }),
    { code: 'ERR_SCHROEDER_PHASE_VOLUME_TRANSPORT_LIFECYCLE' }
  );
  assert.equal(admitSchroederSpatialEpochTransactionReader(transaction, {
    readerId: SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_P2G,
    phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.PRE_INTEGRATION,
    ...readerInputs
  }), true);

  const fine = resolveSchroederSpatialPhaseVolumeTransportAuthority(
    transaction,
    {
      generation: f.generation,
      selectedLevel: 0,
      mechanicsFieldView: fineFieldView
    }
  );
  const coarse = resolveSchroederSpatialPhaseVolumeTransportAuthority(
    transaction,
    {
      generation: f.generation,
      selectedLevel: 1,
      mechanicsFieldView: coarseFieldView
    }
  );
  assert.equal(fine.levelRole, 'fine');
  assert.equal(fine.levelIndex, 0);
  assert.equal(fine.mechanicsFieldView, fineFieldView);
  assert.equal(fine.phaseVolumeMoment, f.generation.mechanicsLevelViews[0].phaseVolumeMoment);
  assert.equal(fine.phaseVolumeReceipt, f.generation.mechanicsLevelViews[0].phaseVolumeReceipt);
  assert.equal(coarse.levelRole, 'coarse');
  assert.equal(coarse.levelIndex, 1);
  assert.equal(coarse.mechanicsFieldView, coarseFieldView);
  assert.equal(
    fine.phaseVolumeInterfaceRefluxRouteRowWords,
    f.generation.phaseVolumeInterfaceProposal.layout.refluxRouteRowWords
  );

  assert.throws(
    () => resolveSchroederSpatialPhaseVolumeTransportAuthority(transaction, {
      generation: f.generation,
      selectedLevel: 2,
      mechanicsFieldView: fineFieldView
    }),
    { code: 'ERR_SCHROEDER_PHASE_VOLUME_TRANSPORT_LEVEL' }
  );
  assert.throws(
    () => resolveSchroederSpatialPhaseVolumeTransportAuthority(transaction, {
      generation: f.generation,
      selectedLevel: 0,
      mechanicsFieldView: { ...fineFieldView }
    }),
    { code: 'ERR_SCHROEDER_PHASE_VOLUME_TRANSPORT_IDENTITY' }
  );
  assert.throws(
    () => resolveSchroederSpatialPhaseVolumeTransportAuthority(transaction, {
      generation: { ...f.generation },
      selectedLevel: 0,
      mechanicsFieldView: fineFieldView
    }),
    { code: 'ERR_SCHROEDER_PHASE_VOLUME_TRANSPORT_IDENTITY' }
  );

  assert.equal(admitSchroederSpatialEpochTransactionReader(transaction, {
    readerId: SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_G2P,
    phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.INTEGRATION_COMMIT,
    ...readerInputs
  }), true);
  assert.throws(
    () => resolveSchroederSpatialPhaseVolumeTransportAuthority(transaction, {
      generation: f.generation,
      selectedLevel: 1,
      mechanicsFieldView: coarseFieldView
    }),
    { code: 'ERR_SCHROEDER_PHASE_VOLUME_TRANSPORT_LIFECYCLE' }
  );
});

test('single-level transaction admits a one-level S9-C proposal and exact transport authority', () => {
  const f = twoLevelFixture({
    phaseVolume: true,
    phaseVolumeInterfaceProposalEnabled: true,
    mechanicsLevelCount: 1
  });
  assert.equal(f.generation.ready, true, f.generation.reason);
  assert.equal(f.generation.mechanicsLevelViews.length, 1);
  const proposal = f.generation.phaseVolumeInterfaceProposal;
  assert.ok(proposal, 'one-level S9-C proposal is built');
  assert.equal(proposal.twoLevel, false);
  assert.equal(proposal.hasParentFieldView, false);
  assert.equal(proposal.coarseLevel, -0x8000_0000);
  assert.equal(proposal.coarseFieldCapacity, 0);
  assert.equal(proposal.coarseReceipt, null);
  assert.equal(proposal.parentFieldView, null);
  assert.equal(proposal.encodedDispatchCount, 2);
  assert.equal(proposal.fineReceipt, f.generation.phaseVolumeReceipt);

  const transaction = createSchroederSpatialEpochTransaction({
    ...f,
    phaseVolumeInterfaceProposalAuthoritative: true
  });
  assert.equal(transaction.twoLevelAuthoritative, false);
  assert.equal(transaction.phaseVolumeInterfaceProposalAuthoritative, true);
  assert.equal(transaction.phaseVolumeInterfaceProposal, proposal);
  const readerInputs = {
    generation: f.generation,
    sphParticleUpload: f.sphParticleUpload,
    mlsMpmParticleUpload: f.mlsMpmParticleUpload
  };
  const fieldView = f.generation.mechanicsFieldView;
  assert.throws(
    () => resolveSchroederSpatialPhaseVolumeTransportAuthority(transaction, {
      generation: f.generation,
      selectedLevel: 0,
      mechanicsFieldView: fieldView
    }),
    { code: 'ERR_SCHROEDER_PHASE_VOLUME_TRANSPORT_LIFECYCLE' }
  );
  assert.equal(admitSchroederSpatialEpochTransactionReader(transaction, {
    readerId: SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_P2G,
    phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.PRE_INTEGRATION,
    ...readerInputs
  }), true);

  const single = resolveSchroederSpatialPhaseVolumeTransportAuthority(
    transaction,
    {
      generation: f.generation,
      selectedLevel: 0,
      mechanicsFieldView: fieldView
    }
  );
  assert.equal(single.levelRole, 'single');
  assert.equal(single.levelIndex, 0);
  assert.equal(single.twoLevel, false);
  assert.equal(single.fineLevel, 0);
  assert.equal(single.coarseLevel, -0x8000_0000);
  assert.equal(single.mechanicsFieldView, fieldView);
  assert.equal(single.phaseVolumeMoment, f.generation.phaseVolumeMoment);
  assert.equal(single.phaseVolumeReceipt, f.generation.phaseVolumeReceipt);
  assert.equal(single.fieldCapacity, proposal.fineFieldCapacity);
  assert.equal(single.parentFieldView, null);
  assert.equal(single.coarseMechanicsFieldView, null);
  assert.equal(single.phaseVolumeInterfaceProposal, proposal);
  assert.equal(
    single.localHeadOffsetWords,
    proposal.layout.fineLocalHeadOffsetWords
  );

  assert.throws(
    () => resolveSchroederSpatialPhaseVolumeTransportAuthority(transaction, {
      generation: f.generation,
      selectedLevel: 1,
      mechanicsFieldView: fieldView
    }),
    { code: 'ERR_SCHROEDER_PHASE_VOLUME_TRANSPORT_IDENTITY' }
  );
  assert.throws(
    () => resolveSchroederSpatialPhaseVolumeTransportAuthority(transaction, {
      generation: f.generation,
      selectedLevel: 0,
      mechanicsFieldView: { ...fieldView }
    }),
    { code: 'ERR_SCHROEDER_PHASE_VOLUME_TRANSPORT_IDENTITY' }
  );
  assert.equal(admitSchroederSpatialEpochTransactionReader(transaction, {
    readerId: SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_G2P,
    phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.INTEGRATION_COMMIT,
    ...readerInputs
  }), true);
  assert.throws(
    () => resolveSchroederSpatialPhaseVolumeTransportAuthority(transaction, {
      generation: f.generation,
      selectedLevel: 0,
      mechanicsFieldView: fieldView
    }),
    { code: 'ERR_SCHROEDER_PHASE_VOLUME_TRANSPORT_LIFECYCLE' }
  );
});

test('single-level transaction without S9-C authority refuses transport', () => {
  const f = twoLevelFixture({
    phaseVolume: true,
    phaseVolumeInterfaceProposalEnabled: true,
    mechanicsLevelCount: 1
  });
  const transaction = createSchroederSpatialEpochTransaction(f);
  assert.equal(transaction.phaseVolumeInterfaceProposalAuthoritative, false);
  assert.equal(admitSchroederSpatialEpochTransactionReader(transaction, {
    readerId: SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_P2G,
    phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.PRE_INTEGRATION,
    generation: f.generation,
    sphParticleUpload: f.sphParticleUpload,
    mlsMpmParticleUpload: f.mlsMpmParticleUpload
  }), true);
  assert.throws(
    () => resolveSchroederSpatialPhaseVolumeTransportAuthority(transaction, {
      generation: f.generation,
      selectedLevel: 0,
      mechanicsFieldView: f.generation.mechanicsFieldView
    }),
    { code: 'ERR_SCHROEDER_PHASE_VOLUME_TRANSPORT_AUTHORITY' }
  );
});

test('single-level transaction refuses authoritative S9-C without a built proposal', () => {
  const f = twoLevelFixture({ phaseVolume: true, mechanicsLevelCount: 1 });
  assert.equal(f.generation.phaseVolumeInterfaceProposal, null);
  assert.throws(() => createSchroederSpatialEpochTransaction({
    ...f,
    phaseVolumeInterfaceProposalAuthoritative: true
  }), { code: 'ERR_SCHROEDER_PHASE_VOLUME_INTERFACE_PROPOSAL_IDENTITY' });
});

test('two-level transaction refuses opt-in S9-C authority without its exact proposal', () => {
  const f = twoLevelFixture({ phaseVolume: true });
  assert.throws(() => createSchroederSpatialEpochTransaction({
    ...f,
    twoLevelAuthoritative: true,
    phaseVolumeInterfaceProposalAuthoritative: true
  }), { code: 'ERR_SCHROEDER_PHASE_VOLUME_INTERFACE_PROPOSAL_IDENTITY' });
});

test('two-level transaction refuses an A/B-only S9-A sidecar without its receipt', () => {
  const f = twoLevelFixture({
    phaseVolume: true,
    phaseVolumeReceiptEnabled: false
  });
  assert.equal(f.generation.ready, true, f.generation.reason);
  assert.ok(f.generation.phaseVolumeMoment);
  assert.equal(f.generation.phaseVolumeReceipt, null);
  assert.throws(() => createSchroederSpatialEpochTransaction({
    ...f,
    twoLevelAuthoritative: true
  }), { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_PHASE_VOLUME_RECEIPT_IDENTITY' });
});

test('two-level transaction freezes the directory-v2 ActiveSource identity', () => {
  const f = twoLevelFixture();
  const transaction = createSchroederSpatialEpochTransaction({
    ...f,
    twoLevelAuthoritative: true
  });
  const readerInputs = {
    generation: f.generation,
    sphParticleUpload: f.sphParticleUpload,
    mlsMpmParticleUpload: f.mlsMpmParticleUpload
  };
  assert.equal(
    validateSchroederSpatialEpochTransactionSourceFamily(
      transaction,
      readerInputs
    ),
    true
  );
  const activeSourceViewBuffer = f.generation.execution.activeSourceViewBuffer;
  f.generation.execution.activeSourceViewBuffer =
    f.buffer('foreign-active-source-sidecar');
  assert.equal(
    validateSchroederSpatialEpochTransactionSourceFamily(
      transaction,
      readerInputs
    ),
    false
  );
  f.generation.execution.activeSourceViewBuffer = activeSourceViewBuffer;
  assert.equal(
    validateSchroederSpatialEpochTransactionSourceFamily(
      transaction,
      readerInputs
    ),
    true
  );
  const activeSourceCountAuthority =
    f.generation.execution.activeSourceCountAuthority;
  f.generation.execution.activeSourceCountAuthority = Object.freeze({
    ...activeSourceCountAuthority
  });
  assert.equal(
    validateSchroederSpatialEpochTransactionSourceFamily(
      transaction,
      readerInputs
    ),
    false
  );
  f.generation.execution.activeSourceCountAuthority =
    activeSourceCountAuthority;
  assert.equal(
    validateSchroederSpatialEpochTransactionSourceFamily(
      transaction,
      readerInputs
    ),
    true
  );
  const sourceCount = f.generation.execution.sourceCount;
  f.generation.execution.sourceCount = sourceCount + 1;
  assert.equal(
    validateSchroederSpatialEpochTransactionSourceFamily(
      transaction,
      readerInputs
    ),
    false
  );
  f.generation.execution.sourceCount = sourceCount;
  assert.equal(
    validateSchroederSpatialEpochTransactionSourceFamily(
      transaction,
      readerInputs
    ),
    true
  );
  const sourceFingerprint = f.generation.activeSourceView.sourceFingerprint;
  f.generation.activeSourceView.sourceFingerprint =
    (sourceFingerprint + 1) >>> 0;
  assert.equal(
    validateSchroederSpatialEpochTransactionSourceFamily(
      transaction,
      readerInputs
    ),
    false
  );
  f.generation.activeSourceView.sourceFingerprint = sourceFingerprint;
  assert.equal(
    validateSchroederSpatialEpochTransactionSourceFamily(
      transaction,
      readerInputs
    ),
    true
  );
  const activeSourceView = f.generation.activeSourceView;
  f.generation.activeSourceView = Object.freeze({
    ...activeSourceView
  });
  assert.equal(
    validateSchroederSpatialEpochTransactionSourceFamily(
      transaction,
      readerInputs
    ),
    false
  );
});

test('two-level transaction rejects a mutable ActiveSource layout', () => {
  const f = twoLevelFixture();
  f.generation.activeSourceView.layout = {
    ...f.generation.activeSourceView.layout
  };
  assert.equal(Object.isFrozen(f.generation.activeSourceView.layout), false);
  assert.throws(() => createSchroederSpatialEpochTransaction({
    ...f,
    twoLevelAuthoritative: true
  }), { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_ACTIVE_SOURCE_IDENTITY' });
});

test('two-level transaction admits one exact post-mechanics far-aggregate receipt after G2P', async () => {
  const f = twoLevelFixture({ aggregateViewEnabled: true });
  const transaction = createSchroederSpatialEpochTransaction({
    ...f,
    twoLevelAuthoritative: true,
    enabledConsumerReaderIds: [SCHROEDER_SPATIAL_EPOCH_READER.FAR_AGGREGATE],
    consumerSupportProfileIds: {}
  });
  assert.equal(transaction.aggregateViewRequired, true);
  assert.equal(transaction.aggregateView, f.generation.aggregateView);
  const readerInputs = {
    generation: f.generation,
    sphParticleUpload: f.sphParticleUpload,
    mlsMpmParticleUpload: f.mlsMpmParticleUpload
  };
  admitMechanicsReaders(transaction, readerInputs);

  const traversalRuntime = createSchroederSpatialAggregateTraversalGpu(
    f.device,
    { maxQueryCount: 2 }
  );
  const encoder = f.device.createCommandEncoder();
  const traversal = traversalRuntime.encode(encoder, {
    aggregateView: f.generation.aggregateView,
    queryBuffer: f.generation.source.sourceBuffer,
    queryCount: 2,
    queryStrideFloats: 16,
    querySourceLayoutId:
      SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_QUERY_SOURCE_LAYOUT
        .LEVEL_ASSIGNMENT_V0,
    nearFieldSupportScale: 1.5,
    openingTheta: 0.5,
    publicEpochIdentity: transaction.epochIdentity
  });
  f.device.queue.submit([encoder.finish()]);
  assert.equal(traversalRuntime.markExecutionSubmitted(traversal), true);
  const receipt = finalizeSchroederSpatialAggregateTraversalSubmissionReceipt(
    traversal,
    traversal.submissionEvidence
  );

  assert.equal(receipt.consumerId, SCHROEDER_SPATIAL_AGGREGATE_CONSUMER_ID);
  assert.equal(receipt.phase, SCHROEDER_SPATIAL_AGGREGATE_CONSUMER_PHASE);
  assert.equal(
    receipt.artifactFamily,
    SCHROEDER_SPATIAL_AGGREGATE_CONSUMER_ARTIFACT_FAMILY
  );
  assert.throws(() => admitSchroederSpatialEpochTransactionReader(transaction, {
    readerId: SCHROEDER_SPATIAL_EPOCH_READER.FAR_AGGREGATE,
    phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.POST_MECHANICS_FAR_AGGREGATE,
    consumerReceipt: { ...receipt },
    ...readerInputs
  }), { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_CONSUMER_RECEIPT' });
  assert.equal(admitSchroederSpatialEpochTransactionReader(transaction, {
    readerId: SCHROEDER_SPATIAL_EPOCH_READER.FAR_AGGREGATE,
    phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.POST_MECHANICS_FAR_AGGREGATE,
    consumerReceipt: receipt,
    ...readerInputs
  }), true);
  assert.equal(sealSchroederSpatialEpochTransactionReaders(transaction), true);
  const proposalSeal = sealSchroederSpatialEpochTransactionProposals(transaction);
  assert.equal(proposalSeal.status, 'spatial-consumer-submissions-sealed');
  assert.equal(proposalSeal.authenticatedConsumerCount, 0);
  assert.equal(proposalSeal.authenticatedTraversalCount, 0);
  assert.equal(proposalSeal.submittedAggregateConsumerCount, 1);
  assert.equal(proposalSeal.submittedAggregateTraversalCount, 1);
  assert.equal(proposalSeal.resultAuthenticatedAggregateTraversalCount, 0);
  assert.equal(proposalSeal.migratedProposalCount, 0);
  const summary = summarizeSchroederSpatialEpochTransaction(transaction);
  assert.deepEqual(summary.enabledConsumerReaderIds, [
    SCHROEDER_SPATIAL_EPOCH_READER.FAR_AGGREGATE
  ]);
  assert.equal(summary.consumerReceipts[0], receipt);
  assert.equal(summary.counters.consumerReceiptRejectCount, 1);
  assert.equal(summary.counters.consumerReceiptAdmissionCount, 1);
  assert.equal(summary.counters.authenticatedConsumerTraversalCount, 0);
  assert.equal(summary.counters.submittedAggregateConsumerCount, 1);
  assert.equal(summary.counters.submittedAggregateTraversalCount, 1);
  assert.equal(summary.counters.resultAuthenticatedAggregateTraversalCount, 0);
  assert.equal(summary.counters.authenticatedCandidateVisitCount, 0);

  assert.equal(await traversalRuntime.releaseExecutionAfter(
    traversal,
    f.device.queue.onSubmittedWorkDone()
  ), true);
  assert.equal(traversalRuntime.destroy(), true);
});

test('terminal public transaction authenticates FAR without mechanics authority', async () => {
  const f = twoLevelFixture({
    aggregateViewEnabled: true,
    mechanicsAuthorityEnabled: false
  });
  assert.equal(f.generation.mechanicsLevelCount, 0);
  assert.deepEqual(f.generation.mechanicsLevelViews, []);
  assert.equal(f.generation.hierarchyView, null);
  assert.equal(f.generation.parentFieldView, null);
  assert.ok(f.generation.aggregateView);

  const transaction = createSchroederSpatialEpochTransaction({
    ...f,
    twoLevelAuthoritative: false,
    requiredReaderIds: [SCHROEDER_SPATIAL_EPOCH_READER.FAR_AGGREGATE],
    enabledConsumerReaderIds: [SCHROEDER_SPATIAL_EPOCH_READER.FAR_AGGREGATE],
    consumerSupportProfileIds: {}
  });
  assert.equal(transaction.twoLevelAuthoritative, false);
  assert.equal(transaction.mechanicsLevelCount, 0);
  assert.equal(transaction.hierarchyView, null);
  assert.equal(transaction.aggregateViewRequired, true);
  assert.equal(transaction.aggregateView, f.generation.aggregateView);

  const traversalRuntime = createSchroederSpatialAggregateTraversalGpu(
    f.device,
    { maxQueryCount: 2 }
  );
  const encoder = f.device.createCommandEncoder();
  const traversal = traversalRuntime.encode(encoder, {
    aggregateView: f.generation.aggregateView,
    queryBuffer: f.generation.source.sourceBuffer,
    queryCount: 2,
    queryStrideFloats: 16,
    querySourceLayoutId:
      SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_QUERY_SOURCE_LAYOUT
        .LEVEL_ASSIGNMENT_V0,
    nearFieldSupportScale: 1.5,
    openingTheta: 0.5,
    publicEpochIdentity: transaction.epochIdentity
  });
  f.device.queue.submit([encoder.finish()]);
  assert.equal(traversalRuntime.markExecutionSubmitted(traversal), true);
  const receipt = finalizeSchroederSpatialAggregateTraversalSubmissionReceipt(
    traversal,
    traversal.submissionEvidence
  );
  assert.equal(admitSchroederSpatialEpochTransactionReader(transaction, {
    readerId: SCHROEDER_SPATIAL_EPOCH_READER.FAR_AGGREGATE,
    phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.POST_MECHANICS_FAR_AGGREGATE,
    consumerReceipt: receipt,
    generation: f.generation,
    sphParticleUpload: f.sphParticleUpload,
    mlsMpmParticleUpload: f.mlsMpmParticleUpload
  }), true);

  const summary = summarizeSchroederSpatialEpochTransaction(transaction);
  assert.equal(summary.twoLevelAuthoritative, false);
  assert.equal(summary.mechanicsLevelCount, 0);
  assert.equal(summary.hierarchyViewStatus, null);
  assert.equal(summary.aggregateViewRequired, true);
  assert.equal(
    summary.aggregateViewStatus,
    'schroeder-spatial-aggregate-view-gpu-build-submitted'
  );
  assert.equal(await traversalRuntime.releaseExecutionAfter(
    traversal,
    f.device.queue.onSubmittedWorkDone()
  ), true);
  assert.equal(traversalRuntime.destroy(), true);
});

test('spatial epoch transaction fails closed on incomplete, third-level, nonadjacent, and foreign two-level views', () => {
  const f = twoLevelFixture();
  const [fine, coarse] = f.generation.mechanicsLevelViews;
  const variants = [
    {
      generation: {
        ...f.generation,
        hierarchyView: null,
        hierarchyViewRuntime: null
      },
      code: 'ERR_SCHROEDER_SPATIAL_EPOCH_TWO_LEVEL_IDENTITY'
    },
    {
      generation: {
        ...f.generation,
        mechanicsLevelCount: 3,
        mechanicsLevelViews: Object.freeze([fine, coarse, coarse]),
        mechanicsLevels: Object.freeze([0, 1, 2])
      },
      code: 'ERR_SCHROEDER_SPATIAL_EPOCH_TWO_LEVEL_CONTRACT'
    },
    {
      generation: {
        ...f.generation,
        mechanicsLevelViews: Object.freeze([
          fine,
          Object.freeze({ ...coarse, selectedLevel: 2 })
        ]),
        mechanicsLevels: Object.freeze([0, 2])
      },
      code: 'ERR_SCHROEDER_SPATIAL_EPOCH_TWO_LEVEL_CONTRACT'
    },
    {
      generation: {
        ...f.generation,
        mechanicsLevelViews: Object.freeze([
          fine,
          Object.freeze({
            ...coarse,
            mechanicsGrid: {
              ...coarse.mechanicsGrid,
              gridSpacingM: 0.75
            }
          })
        ])
      },
      code: 'ERR_SCHROEDER_SPATIAL_EPOCH_TWO_LEVEL_CONTRACT'
    },
    {
      generation: {
        ...f.generation,
        hierarchyView: { ...f.generation.hierarchyView }
      },
      code: 'ERR_SCHROEDER_SPATIAL_EPOCH_TWO_LEVEL_IDENTITY'
    }
  ];
  for (const variant of variants) {
    assert.throws(
      () => createSchroederSpatialEpochTransaction({
        ...f,
        generation: variant.generation,
        twoLevelAuthoritative: true
      }),
      { code: variant.code }
    );
  }
  const oneLevel = fixture();
  assert.throws(
    () => createSchroederSpatialEpochTransaction({
      ...oneLevel,
      twoLevelAuthoritative: true
    }),
    { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_TWO_LEVEL_CONTRACT' }
  );
});

test('two-level transaction rejects hierarchy mutation after creation', () => {
  const f = twoLevelFixture();
  const transaction = createSchroederSpatialEpochTransaction({
    ...f,
    twoLevelAuthoritative: true
  });
  f.generation.hierarchyView = { ...f.generation.hierarchyView };
  assert.throws(
    () => admitSchroederSpatialEpochTransactionReader(transaction, {
      readerId: SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_P2G,
      phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.PRE_INTEGRATION,
      generation: f.generation,
      sphParticleUpload: f.sphParticleUpload,
      mlsMpmParticleUpload: f.mlsMpmParticleUpload
    }),
    { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_STALE_READER' }
  );
});

test('authoritative zero-consumer two-level transaction privately advances one exact successor and releases once', async () => {
  const f = twoLevelFixture();
  const transaction = createSchroederSpatialEpochTransaction({
    ...f,
    twoLevelAuthoritative: true,
    enabledConsumerReaderIds: [],
    consumerSupportProfileIds: {}
  });
  const readerInputs = {
    generation: f.generation,
    sphParticleUpload: f.sphParticleUpload,
    mlsMpmParticleUpload: f.mlsMpmParticleUpload
  };
  admitMechanicsReaders(transaction, readerInputs);
  assert.equal(sealSchroederSpatialEpochTransactionReaders(transaction), true);
  sealSchroederSpatialEpochTransactionProposals(transaction, {
    legacyConsumerCount: 0,
    status: 'fused-mechanics-proposals-deferred-to-final-post-mechanics'
  });
  const successor = nextParticleUploads(f, 'private-successor');
  const receipt = advanceSchroederSpatialEpochTransactionPrivate(transaction, {
    nextParticleUploads: successor,
    status: 'test-private-successor'
  });

  assert.equal(validateSchroederSpatialEpochTransactionPrivateAdvance(
    transaction,
    receipt,
    {
      nextParticleUploads: successor,
      expectedGeneration: f.generation,
      sourceParticleUploads: {
        sphParticleUpload: f.sphParticleUpload,
        mlsMpmParticleUpload: f.mlsMpmParticleUpload
      }
    }
  ), true);
  assert.equal(validateSchroederSpatialEpochTransactionPrivateAdvance(
    transaction,
    { ...receipt },
    { nextParticleUploads: successor }
  ), false);
  assert.equal(validateSchroederSpatialEpochTransactionPrivateAdvance(
    transaction,
    receipt,
    { nextParticleUploads: nextParticleUploads(f, 'foreign-successor') }
  ), false);
  assert.throws(
    () => advanceSchroederSpatialEpochTransactionPrivate(transaction, {
      nextParticleUploads: successor
    }),
    { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE' }
  );
  assert.throws(
    () => commitSchroederSpatialEpochTransaction(transaction, {
      nextParticleUploads: successor
    }),
    { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE' }
  );

  assert.equal(await scheduleSchroederSpatialEpochTransactionRelease(transaction, {
    after: Promise.resolve(true)
  }), true);
  const summary = summarizeSchroederSpatialEpochTransaction(transaction);
  assert.equal(summary.state, 'released');
  assert.equal(summary.privateAdvanceStatus, 'test-private-successor');
  assert.equal(summary.counters.privateAdvanceCount, 1);
  assert.equal(summary.counters.commitCount, 0);
  assert.throws(
    () => scheduleSchroederSpatialEpochTransactionRelease(transaction, {
      after: Promise.resolve(true)
    }),
    { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE' }
  );
});

test('private-advance receipts bind generation and source even when two transactions name the same S* family', () => {
  const a = twoLevelFixture();
  const buffer = (label, size = 4096) => tagWebGpuBufferDevice(
    a.device.createBuffer({ label, size, usage: 128 }),
    a.device
  );
  const bState = buffer('foreign-same-s-star-source-state');
  const bThermo = buffer('foreign-same-s-star-source-thermo');
  const bIdentity = buffer(
    'foreign-same-s-star-source-identity',
    2 * Uint32Array.BYTES_PER_ELEMENT
  );
  const bMechanics = buffer('foreign-same-s-star-source-mechanics');
  const bAssignment = {
    ...a.levelAssignment,
    assignmentBuffer: buffer(
      'foreign-same-s-star-assignment',
      a.levelAssignment.assignmentBufferByteLength
    ),
    sourceStateBuffer: bState,
    storageGeneration: a.levelAssignment.storageGeneration + 1,
    positionEpoch: a.levelAssignment.positionEpoch + 1
  };
  const bSph = {
    ...a.sphParticleUpload,
    stateBuffer: bState,
    thermoBuffer: bThermo,
    identityBuffer: bIdentity,
    storageGeneration: bAssignment.storageGeneration,
    positionEpoch: bAssignment.positionEpoch
  };
  const bMls = { mechanicsBuffer: bMechanics };
  const bGeneration = runSchroederSpatialEpochGenerationWebGpu({
    device: a.device,
    levelAssignment: bAssignment,
    particleCount: 2,
    particleIdentityBuffer: bIdentity,
    particleIdentityStrideWords: 1,
    particleBufferSet: null,
    mechanicsLevels: [
      {
        selectedLevel: 0,
        mechanicsGrid: {
          gridNodeCount: 512,
          gridDims: [8, 8, 8],
          gridShift: 2,
          gridSpacingM: 0.25
        }
      },
      {
        selectedLevel: 1,
        mechanicsGrid: {
          gridNodeCount: 125,
          gridDims: [5, 5, 5],
          gridShift: 2,
          gridSpacingM: 0.5
        }
      }
    ]
  });
  assert.equal(bGeneration.selected, true, bGeneration.reason);

  const transactionA = createSchroederSpatialEpochTransaction({
    ...a,
    twoLevelAuthoritative: true,
    enabledConsumerReaderIds: [],
    consumerSupportProfileIds: {}
  });
  const transactionB = createSchroederSpatialEpochTransaction({
    device: a.device,
    generation: bGeneration,
    sphParticleUpload: bSph,
    mlsMpmParticleUpload: bMls,
    twoLevelAuthoritative: true,
    enabledConsumerReaderIds: [],
    consumerSupportProfileIds: {}
  });
  const inputsA = {
    generation: a.generation,
    sphParticleUpload: a.sphParticleUpload,
    mlsMpmParticleUpload: a.mlsMpmParticleUpload
  };
  const inputsB = {
    generation: bGeneration,
    sphParticleUpload: bSph,
    mlsMpmParticleUpload: bMls
  };
  for (const [transaction, inputs] of [
    [transactionA, inputsA],
    [transactionB, inputsB]
  ]) {
    admitMechanicsReaders(transaction, inputs);
    sealSchroederSpatialEpochTransactionReaders(transaction);
    sealSchroederSpatialEpochTransactionProposals(transaction, {
      legacyConsumerCount: 0,
      status: 'fused-mechanics-proposals-deferred-to-final-post-mechanics'
    });
  }
  const sharedSuccessor = nextParticleUploads(a, 'shared-s-star');
  const receiptA = advanceSchroederSpatialEpochTransactionPrivate(
    transactionA,
    { nextParticleUploads: sharedSuccessor }
  );
  const receiptB = advanceSchroederSpatialEpochTransactionPrivate(
    transactionB,
    { nextParticleUploads: sharedSuccessor }
  );

  assert.equal(validateSchroederSpatialEpochTransactionPrivateAdvance(
    transactionA,
    receiptA,
    {
      nextParticleUploads: sharedSuccessor,
      expectedGeneration: a.generation,
      sourceParticleUploads: {
        sphParticleUpload: a.sphParticleUpload,
        mlsMpmParticleUpload: a.mlsMpmParticleUpload
      }
    }
  ), true);
  assert.equal(validateSchroederSpatialEpochTransactionPrivateAdvance(
    transactionB,
    receiptB,
    {
      nextParticleUploads: sharedSuccessor,
      expectedGeneration: bGeneration,
      sourceParticleUploads: {
        sphParticleUpload: bSph,
        mlsMpmParticleUpload: bMls
      }
    }
  ), true);
  assert.equal(validateSchroederSpatialEpochTransactionPrivateAdvance(
    transactionA,
    receiptB,
    { nextParticleUploads: sharedSuccessor }
  ), false);
  assert.equal(validateSchroederSpatialEpochTransactionPrivateAdvance(
    transactionB,
    receiptA,
    { nextParticleUploads: sharedSuccessor }
  ), false);
});

test('spatial epoch transaction rejects invalid build cardinality', () => {
  const f = fixture();
  assert.throws(() => createSchroederSpatialEpochTransaction({
    ...f,
    generation: { ...f.generation, directoryBuildCount: 2 }
  }), { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_BUILD_CARDINALITY' });
});

test('spatial epoch transaction rejects non-numeric epoch and build identities', () => {
  const epochFixture = fixture();
  epochFixture.generation.source.positionEpoch = '13';
  epochFixture.generation.execution.positionEpoch = '13';
  assert.throws(
    () => createSchroederSpatialEpochTransaction(epochFixture),
    { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_IDENTITY' }
  );

  const ordinalFixture = fixture();
  ordinalFixture.generation.execution.generationId = '7';
  ordinalFixture.generation.execution.buildOrdinal = '7';
  ordinalFixture.generation.execution.sortUniqueOrdinal = '7';
  assert.throws(
    () => createSchroederSpatialEpochTransaction(ordinalFixture),
    { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_IDENTITY' }
  );
});

test('spatial epoch transaction enforces pressure-before-P2G-before-G2P order', () => {
  const beforeP2g = fixture();
  const beforeP2gTransaction = createSchroederSpatialEpochTransaction(beforeP2g);
  const beforeP2gInputs = {
    generation: beforeP2g.generation,
    sphParticleUpload: beforeP2g.sphParticleUpload,
    mlsMpmParticleUpload: beforeP2g.mlsMpmParticleUpload
  };
  assert.throws(() => admitSchroederSpatialEpochTransactionReader(
    beforeP2gTransaction,
    {
      readerId: SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_G2P,
      phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.INTEGRATION_COMMIT,
      ...beforeP2gInputs
    }
  ), { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_READER_ORDER' });
  assert.equal(
    summarizeSchroederSpatialEpochTransaction(beforeP2gTransaction)
      .counters.readerOrderRejectCount,
    1
  );

  const afterG2p = fixture();
  const afterG2pTransaction = createSchroederSpatialEpochTransaction(afterG2p);
  const afterG2pInputs = {
    generation: afterG2p.generation,
    sphParticleUpload: afterG2p.sphParticleUpload,
    mlsMpmParticleUpload: afterG2p.mlsMpmParticleUpload
  };
  admitMechanicsReaders(afterG2pTransaction, afterG2pInputs);
  assert.throws(() => admitSchroederSpatialEpochTransactionReader(
    afterG2pTransaction,
    {
      readerId: SCHROEDER_SPATIAL_EPOCH_READER.PRESSURE_INTERFACE,
      phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.PRE_INTEGRATION,
      ...afterG2pInputs
    }
  ), { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_READER_ORDER' });
});

test('spatial epoch transaction admits every enabled exact-near consumer once in declared order', () => {
  const f = liveConsumerFixture();
  const consumerReaderIds = [
    SCHROEDER_SPATIAL_EPOCH_READER.PRESSURE_CONTACT_INTERFACE,
    SCHROEDER_SPATIAL_EPOCH_READER.REACTION_DISCOVERY,
    SCHROEDER_SPATIAL_EPOCH_READER.SEPARATION,
    SCHROEDER_SPATIAL_EPOCH_READER.THERMAL_CONDUCTION,
    SCHROEDER_SPATIAL_EPOCH_READER.THERMAL_RADIATION,
    SCHROEDER_SPATIAL_EPOCH_READER.LOCAL_MATERIAL_INTERFACE
  ];
  const transaction = createSchroederSpatialEpochTransaction({
    ...f,
    enabledConsumerReaderIds: consumerReaderIds,
    consumerSupportProfileIds: supportProfiles(consumerReaderIds)
  });
  const readerInputs = {
    generation: f.generation,
    sphParticleUpload: f.sphParticleUpload,
    mlsMpmParticleUpload: f.mlsMpmParticleUpload
  };

  let expectedCandidateVisits = 0;
  let expectedMaskHits = 0;
  let expectedProposals = 0;
  consumerReaderIds.forEach((readerId, index) => {
    const candidateVisitCount = 20 + index;
    const consumerMaskHitCount = 10 + index;
    const migratedProposalCount = index;
    expectedCandidateVisits += candidateVisitCount;
    expectedMaskHits += consumerMaskHitCount;
    expectedProposals += migratedProposalCount;
    if (readerId === SCHROEDER_SPATIAL_EPOCH_READER.REACTION_DISCOVERY) {
      return;
    }
    assert.equal(admitSchroederSpatialEpochTransactionReader(transaction, {
      readerId,
      phase: consumerContract[readerId].phase,
      consumerReceipt: finalizedConsumerReceipt(f, readerId, {
        candidateVisitCount,
        consumerMaskHitCount,
        migratedProposalCount,
        candidateBytesRequired: 64,
        candidateBytesAdmitted: 64,
        candidateBytesCapacity: 128
      }),
      ...readerInputs
    }), true);
  });
  admitMechanicsReaders(transaction, readerInputs);
  assert.equal(sealSchroederSpatialEpochTransactionReaders(transaction), true);
  assert.equal(admitSchroederSpatialEpochTransactionLateConsumer(transaction, {
    readerId: SCHROEDER_SPATIAL_EPOCH_READER.REACTION_DISCOVERY,
    phase: consumerContract[
      SCHROEDER_SPATIAL_EPOCH_READER.REACTION_DISCOVERY
    ].phase,
    consumerReceipt: finalizedConsumerReceipt(
      f,
      SCHROEDER_SPATIAL_EPOCH_READER.REACTION_DISCOVERY,
      {
        candidateVisitCount: 21,
        consumerMaskHitCount: 11,
        migratedProposalCount: 1,
        candidateBytesRequired: 64,
        candidateBytesAdmitted: 64,
        candidateBytesCapacity: 128
      }
    ),
    ...readerInputs
  }), true);
  const proposalSeal = sealSchroederSpatialEpochTransactionProposals(transaction);
  assert.equal(proposalSeal.status, 'authenticated-spatial-consumer-proposals-sealed');
  assert.equal(proposalSeal.authenticatedConsumerCount, consumerReaderIds.length);
  assert.equal(proposalSeal.authenticatedTraversalCount, consumerReaderIds.length);
  assert.equal(proposalSeal.candidateVisitCount, expectedCandidateVisits);
  assert.equal(proposalSeal.consumerMaskHitCount, expectedMaskHits);
  assert.equal(proposalSeal.migratedProposalCount, expectedProposals);

  const summary = summarizeSchroederSpatialEpochTransaction(transaction);
  assert.deepEqual(summary.enabledConsumerReaderIds, consumerReaderIds);
  assert.equal(summary.consumerReceipts.length, consumerReaderIds.length);
  assert.ok(summary.consumerReceipts.every((receipt) => (
    Object.isFrozen(receipt)
    && Object.isFrozen(receipt.epochIdentity)
    && receipt.generationId === transaction.generationId
    && receipt.traversalCount === 1
  )));
  const reactionReader = summary.admittedReaders.find((reader) => (
    reader.readerId === SCHROEDER_SPATIAL_EPOCH_READER.REACTION_DISCOVERY
  ));
  const reactionReceipt = summary.consumerReceipts.find((receipt) => (
    receipt.consumerId === SCHROEDER_SPATIAL_EPOCH_READER.REACTION_DISCOVERY
  ));
  assert.ok(Object.isFrozen(reactionReader.receiptTelemetry));
  assert.equal(
    reactionReader.receiptTelemetry.schema,
    'peercompute.ulg.schroeder-spatial-consumer-receipt-telemetry.v1'
  );
  assert.equal(reactionReader.receiptTelemetry.backend, 'webgpu');
  assert.equal(
    reactionReader.receiptTelemetry.backendSelection,
    'same-device-submitted-webgpu-generation'
  );
  assert.equal(reactionReader.receiptTelemetry.fallbackIntent, 'forbidden');
  assert.equal(reactionReader.receiptTelemetry.consumerId, reactionReceipt.consumerId);
  assert.equal(reactionReader.receiptTelemetry.deviceId, reactionReceipt.deviceId);
  assert.equal(reactionReader.receiptTelemetry.generationId, reactionReceipt.generationId);
  assert.deepEqual(reactionReader.receiptTelemetry.epochIdentity, reactionReceipt.epochIdentity);
  assert.equal(reactionReader.receiptTelemetry.gpuAuthenticated, true);
  assert.equal(reactionReader.receiptTelemetry.submitPerformed, true);
  assert.equal(reactionReader.receiptTelemetry.generationBound, true);
  assert.equal(
    reactionReader.receiptTelemetry.expectedTraversalCount,
    reactionReceipt.expectedTraversalCount
  );
  assert.equal(reactionReader.receiptTelemetry.traversalCount, reactionReceipt.traversalCount);
  assert.equal(reactionReader.receiptTelemetry.fallbackObserved, false);
  assert.equal(reactionReader.receiptTelemetry.fullReadbackPerformed, false);
  assert.equal(reactionReader.receiptTelemetry.privateLookupBuildCount, 0);
  assert.equal(reactionReader.receiptTelemetry.fixedCandidateBuildCount, 0);
  assert.equal(reactionReader.receiptTelemetry.exhaustiveTraversalCount, 0);
  assert.equal(summary.counters.consumerReceiptAdmissionCount, consumerReaderIds.length);
  assert.equal(
    summary.counters.authenticatedConsumerTraversalCount,
    consumerReaderIds.length
  );
  assert.equal(summary.counters.authenticatedCandidateVisitCount, expectedCandidateVisits);
  assert.equal(summary.counters.authenticatedMigratedProposalCount, expectedProposals);
  assert.equal(summary.counters.authenticatedCandidateBytesRequired, 64 * 6);
  assert.equal(summary.counters.authenticatedCandidateBytesAdmitted, 64 * 6);
  assert.equal(summary.counters.authenticatedCandidateBytesCapacity, 128 * 6);
});

test('reaction product placement is required only through explicit late admission', () => {
  const f = liveConsumerFixture();
  const readerId =
    SCHROEDER_SPATIAL_EPOCH_READER.REACTION_PRODUCT_PLACEMENT;
  const transaction = createSchroederSpatialEpochTransaction({
    ...f,
    enabledConsumerReaderIds: [readerId],
    consumerSupportProfileIds: supportProfiles([readerId])
  });
  const readerInputs = {
    generation: f.generation,
    sphParticleUpload: f.sphParticleUpload,
    mlsMpmParticleUpload: f.mlsMpmParticleUpload
  };
  admitMechanicsReaders(transaction, readerInputs);
  assert.equal(sealSchroederSpatialEpochTransactionReaders(transaction), true);
  assert.throws(
    () => sealSchroederSpatialEpochTransactionProposals(transaction),
    { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_MISSING_READER' }
  );
  assert.throws(() => admitSchroederSpatialEpochTransactionReader(
    transaction,
    {
      readerId,
      phase: consumerContract[readerId].phase,
      consumerReceipt: finalizedConsumerReceipt(f, readerId),
      ...readerInputs
    }
  ), { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_READER_CONTRACT' });
  assert.equal(admitSchroederSpatialEpochTransactionLateConsumer(
    transaction,
    {
      readerId,
      phase: consumerContract[readerId].phase,
      consumerReceipt: finalizedConsumerReceipt(f, readerId, {
        migratedProposalCount: 8,
        candidateBytesRequired: 128,
        candidateBytesAdmitted: 128,
        candidateBytesCapacity: 128
      }),
      ...readerInputs
    }
  ), true);
  const seal = sealSchroederSpatialEpochTransactionProposals(transaction);
  assert.equal(seal.authenticatedConsumerCount, 1);
  assert.equal(seal.migratedProposalCount, 8);
  assert.deepEqual(
    summarizeSchroederSpatialEpochTransaction(transaction)
      .admittedReaders.map(({ readerId: admittedReaderId }) => admittedReaderId),
    [
      SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_P2G,
      SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_G2P,
      readerId
    ]
  );
});

test('transaction preserves and aggregates an authenticated two-traversal receipt truthfully', () => {
  const f = liveConsumerFixture();
  const readerId = SCHROEDER_SPATIAL_EPOCH_READER.THERMAL_CONDUCTION;
  const transaction = createSchroederSpatialEpochTransaction({
    ...f,
    enabledConsumerReaderIds: [readerId],
    consumerSupportProfileIds: supportProfiles([readerId])
  });
  const readerInputs = {
    generation: f.generation,
    sphParticleUpload: f.sphParticleUpload,
    mlsMpmParticleUpload: f.mlsMpmParticleUpload
  };
  assert.equal(admitSchroederSpatialEpochTransactionReader(transaction, {
    readerId,
    phase: consumerContract[readerId].phase,
    consumerReceipt: finalizedConsumerReceipt(f, readerId, {
      expectedTraversalCount: 2,
      candidateVisitCount: 17
    }),
    ...readerInputs
  }), true);
  admitMechanicsReaders(transaction, readerInputs);
  assert.equal(sealSchroederSpatialEpochTransactionReaders(transaction), true);
  const proposalSeal = sealSchroederSpatialEpochTransactionProposals(transaction);
  assert.equal(proposalSeal.authenticatedConsumerCount, 1);
  assert.equal(proposalSeal.authenticatedTraversalCount, 2);
  const summary = summarizeSchroederSpatialEpochTransaction(transaction);
  assert.equal(summary.consumerReceipts.length, 1);
  assert.equal(summary.consumerReceipts[0].expectedTraversalCount, 2);
  assert.equal(summary.consumerReceipts[0].traversalCount, 2);
  assert.equal(summary.counters.authenticatedConsumerTraversalCount, 2);
  assert.equal(summary.counters.authenticatedCandidateVisitCount, 17);
});

test('spatial epoch exact-near consumers fail closed on disabled, stale, fallback, overflow, and out-of-order receipts', () => {
  const readerId = SCHROEDER_SPATIAL_EPOCH_READER.REACTION_DISCOVERY;
  const phase = consumerContract[readerId].phase;
  const readerInputs = (f) => ({
    generation: f.generation,
    sphParticleUpload: f.sphParticleUpload,
    mlsMpmParticleUpload: f.mlsMpmParticleUpload
  });
  const createEnabled = () => {
    const f = liveConsumerFixture();
    const transaction = createSchroederSpatialEpochTransaction({
      ...f,
      enabledConsumerReaderIds: [readerId],
      consumerSupportProfileIds: supportProfiles([readerId])
    });
    admitMechanicsReaders(transaction, readerInputs(f));
    sealSchroederSpatialEpochTransactionReaders(transaction);
    return {
      f,
      transaction
    };
  };

  const disabled = liveConsumerFixture();
  const disabledTransaction = createSchroederSpatialEpochTransaction(disabled);
  admitMechanicsReaders(disabledTransaction, readerInputs(disabled));
  sealSchroederSpatialEpochTransactionReaders(disabledTransaction);
  assert.throws(() => admitSchroederSpatialEpochTransactionLateConsumer(
    disabledTransaction,
    {
      readerId,
      phase,
      consumerReceipt: finalizedConsumerReceipt(disabled, readerId),
      ...readerInputs(disabled)
    }
  ), { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_CONSUMER_DISABLED' });
  assert.equal(
    summarizeSchroederSpatialEpochTransaction(disabledTransaction)
      .counters.consumerDisabledRejectCount,
    1
  );

  assert.throws(() => createSchroederSpatialEpochTransaction({
    ...fixture(),
    enabledConsumerReaderIds: [readerId]
  }), { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_READER_CONTRACT' });

  const stale = createEnabled();
  assert.throws(() => admitSchroederSpatialEpochTransactionLateConsumer(
    stale.transaction,
    {
      readerId,
      phase,
      consumerReceipt: consumerReceipt(stale.f, readerId, { generationId: 999 }),
      ...readerInputs(stale.f)
    }
  ), { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_CONSUMER_RECEIPT_IDENTITY' });
  assert.equal(
    summarizeSchroederSpatialEpochTransaction(stale.transaction)
      .counters.consumerReceiptIdentityRejectCount,
    1
  );

  const fallback = createEnabled();
  assert.throws(() => admitSchroederSpatialEpochTransactionLateConsumer(
    fallback.transaction,
    {
      readerId,
      phase,
      consumerReceipt: consumerReceipt(fallback.f, readerId, {
        privateLookupBuildCount: 1
      }),
      ...readerInputs(fallback.f)
    }
  ), { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_CONSUMER_FALLBACK' });
  assert.equal(
    summarizeSchroederSpatialEpochTransaction(fallback.transaction)
      .counters.consumerReceiptFallbackRejectCount,
    1
  );

  const overflow = createEnabled();
  assert.throws(() => admitSchroederSpatialEpochTransactionLateConsumer(
    overflow.transaction,
    {
      readerId,
      phase,
      consumerReceipt: consumerReceipt(overflow.f, readerId, {
        candidateBytesRequired: 128,
        candidateBytesAdmitted: 64,
        candidateBytesCapacity: 64,
        candidateOverflowBytes: 64,
        overflowed: true,
        partialPublication: true
      }),
      ...readerInputs(overflow.f)
    }
  ), { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_CONSUMER_OVERFLOW' });
  assert.equal(
    summarizeSchroederSpatialEpochTransaction(overflow.transaction)
      .counters.consumerReceiptOverflowRejectCount,
    1
  );

  const outOfOrder = liveConsumerFixture();
  const placementId =
    SCHROEDER_SPATIAL_EPOCH_READER.REACTION_PRODUCT_PLACEMENT;
  const outOfOrderTransaction = createSchroederSpatialEpochTransaction({
    ...outOfOrder,
    enabledConsumerReaderIds: [readerId, placementId],
    consumerSupportProfileIds: supportProfiles([readerId, placementId])
  });
  admitMechanicsReaders(outOfOrderTransaction, readerInputs(outOfOrder));
  sealSchroederSpatialEpochTransactionReaders(outOfOrderTransaction);
  assert.throws(() => admitSchroederSpatialEpochTransactionLateConsumer(
    outOfOrderTransaction,
    {
      readerId: placementId,
      phase: consumerContract[placementId].phase,
      consumerReceipt: finalizedConsumerReceipt(outOfOrder, placementId),
      ...readerInputs(outOfOrder)
    }
  ), { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_READER_ORDER' });
});

test('spatial epoch proposal accounting rejects mismatches and migrated legacy lookup work', () => {
  const f = liveConsumerFixture();
  const readerId = SCHROEDER_SPATIAL_EPOCH_READER.THERMAL_CONDUCTION;
  const transaction = createSchroederSpatialEpochTransaction({
    ...f,
    enabledConsumerReaderIds: [readerId],
    consumerSupportProfileIds: supportProfiles([readerId])
  });
  const readerInputs = {
    generation: f.generation,
    sphParticleUpload: f.sphParticleUpload,
    mlsMpmParticleUpload: f.mlsMpmParticleUpload
  };
  assert.equal(admitSchroederSpatialEpochTransactionReader(transaction, {
    readerId,
    phase: consumerContract[readerId].phase,
    consumerReceipt: finalizedConsumerReceipt(f, readerId, {
      migratedProposalCount: 3
    }),
    ...readerInputs
  }), true);
  admitMechanicsReaders(transaction, readerInputs);
  sealSchroederSpatialEpochTransactionReaders(transaction);
  assert.throws(() => recordSchroederSpatialEpochTransactionLegacyLookup(transaction, {
    consumerId: readerId,
    mode: 'exhaustive-particle-scan',
    exhaustiveTraversalCount: 1
  }), { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_CONSUMER_FALLBACK' });
  assert.throws(() => sealSchroederSpatialEpochTransactionProposals(transaction, {
    migratedProposalCount: 2
  }), { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_PROPOSAL_RECEIPT_MISMATCH' });
  assert.equal(
    summarizeSchroederSpatialEpochTransaction(transaction).state,
    'readers-complete'
  );
  assert.equal(
    sealSchroederSpatialEpochTransactionProposals(transaction).migratedProposalCount,
    3
  );
});

test('spatial epoch transaction rejects generation mutation after creation', () => {
  const f = fixture();
  const transaction = createSchroederSpatialEpochTransaction(f);
  f.generation.execution.positionEpoch = 999;
  assert.throws(() => admitSchroederSpatialEpochTransactionReader(transaction, {
    readerId: SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_P2G,
    phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.PRE_INTEGRATION,
    generation: f.generation,
    sphParticleUpload: f.sphParticleUpload,
    mlsMpmParticleUpload: f.mlsMpmParticleUpload
  }), { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_STALE_READER' });
  const summary = summarizeSchroederSpatialEpochTransaction(transaction);
  assert.equal(summary.epochIdentity.positionEpoch, 13);
  assert.equal(summary.counters.staleReaderRejectCount, 1);
});

test('spatial epoch transaction commit and release scheduling are one-shot', async () => {
  const f = fixture();
  const transaction = createSchroederSpatialEpochTransaction(f);
  const readerInputs = {
    generation: f.generation,
    sphParticleUpload: f.sphParticleUpload,
    mlsMpmParticleUpload: f.mlsMpmParticleUpload
  };
  admitMechanicsReaders(transaction, readerInputs);
  sealSchroederSpatialEpochTransactionReaders(transaction);
  sealSchroederSpatialEpochTransactionProposals(transaction);
  commitSchroederSpatialEpochTransaction(transaction, {
    nextParticleUploads: nextParticleUploads(f)
  });
  assert.throws(
    () => commitSchroederSpatialEpochTransaction(transaction, {
      nextParticleUploads: nextParticleUploads(f, 'duplicate-next')
    }),
    { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE' }
  );
  let release;
  const releaseFence = new Promise((resolve) => { release = resolve; });
  const releasePromise = scheduleSchroederSpatialEpochTransactionRelease(
    transaction,
    { after: releaseFence }
  );
  assert.throws(
    () => scheduleSchroederSpatialEpochTransactionRelease(transaction),
    { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE' }
  );
  let summary = summarizeSchroederSpatialEpochTransaction(transaction);
  assert.equal(summary.counters.commitCount, 1);
  assert.equal(summary.counters.releaseScheduleCount, 1);
  release(true);
  await releasePromise;
  summary = summarizeSchroederSpatialEpochTransaction(transaction);
  assert.equal(summary.counters.releaseCount, 1);
});

test('spatial epoch transaction commit rejects missing, partial, and foreign next buffer families before transition', () => {
  const prepare = () => {
    const f = fixture();
    const transaction = createSchroederSpatialEpochTransaction(f);
    admitMechanicsReaders(transaction, {
      generation: f.generation,
      sphParticleUpload: f.sphParticleUpload,
      mlsMpmParticleUpload: f.mlsMpmParticleUpload
    });
    sealSchroederSpatialEpochTransactionReaders(transaction);
    sealSchroederSpatialEpochTransactionProposals(transaction);
    return { f, transaction };
  };

  const missing = prepare();
  assert.throws(
    () => commitSchroederSpatialEpochTransaction(missing.transaction),
    { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_COMMIT_BUFFER_FAMILY' }
  );
  assert.equal(
    summarizeSchroederSpatialEpochTransaction(missing.transaction).state,
    'proposals-sealed'
  );

  const partial = prepare();
  const partialUploads = nextParticleUploads(partial.f);
  partialUploads.sphParticleUpload.identityBuffer = null;
  assert.throws(
    () => commitSchroederSpatialEpochTransaction(partial.transaction, {
      nextParticleUploads: partialUploads
    }),
    { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_COMMIT_BUFFER_FAMILY' }
  );
  assert.equal(
    summarizeSchroederSpatialEpochTransaction(partial.transaction).state,
    'proposals-sealed'
  );

  const foreign = prepare();
  const foreignUploads = nextParticleUploads(foreign.f);
  foreignUploads.sphParticleUpload.stateBuffer = tagWebGpuBufferDevice(
    { label: 'foreign-next-state', size: 4096 },
    { queue: {} }
  );
  assert.throws(
    () => commitSchroederSpatialEpochTransaction(foreign.transaction, {
      nextParticleUploads: foreignUploads
    }),
    { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_DEVICE_MISMATCH' }
  );
  assert.equal(
    summarizeSchroederSpatialEpochTransaction(foreign.transaction).state,
    'proposals-sealed'
  );
});

test('spatial epoch transaction does not claim release from a false fence or overwrite abort', async () => {
  const prepare = () => {
    const f = fixture();
    const transaction = createSchroederSpatialEpochTransaction(f);
    admitMechanicsReaders(transaction, {
      generation: f.generation,
      sphParticleUpload: f.sphParticleUpload,
      mlsMpmParticleUpload: f.mlsMpmParticleUpload
    });
    sealSchroederSpatialEpochTransactionReaders(transaction);
    sealSchroederSpatialEpochTransactionProposals(transaction);
    commitSchroederSpatialEpochTransaction(transaction, {
      nextParticleUploads: nextParticleUploads(f)
    });
    return transaction;
  };

  const missingFence = prepare();
  assert.throws(
    () => scheduleSchroederSpatialEpochTransactionRelease(missingFence),
    { code: 'ERR_SCHROEDER_SPATIAL_EPOCH_RELEASE_FENCE' }
  );
  assert.equal(
    summarizeSchroederSpatialEpochTransaction(missingFence).state,
    'committed'
  );

  const unconfirmed = prepare();
  assert.equal(await scheduleSchroederSpatialEpochTransactionRelease(unconfirmed, {
    after: Promise.resolve()
  }), false);
  let summary = summarizeSchroederSpatialEpochTransaction(unconfirmed);
  assert.equal(summary.state, 'release-blocked');
  assert.equal(summary.counters.releaseCount, 0);

  const blocked = prepare();
  assert.equal(await scheduleSchroederSpatialEpochTransactionRelease(blocked, {
    after: Promise.resolve(false)
  }), false);
  summary = summarizeSchroederSpatialEpochTransaction(blocked);
  assert.equal(summary.state, 'release-blocked');
  assert.equal(summary.counters.releaseCount, 0);
  assert.match(summary.releaseFailureReason, /did not confirm/);
  assert.equal(await scheduleSchroederSpatialEpochTransactionRelease(blocked, {
    after: Promise.resolve(true)
  }), true);
  summary = summarizeSchroederSpatialEpochTransaction(blocked);
  assert.equal(summary.state, 'released');
  assert.equal(summary.counters.releaseScheduleCount, 2);
  assert.equal(summary.counters.releaseRetryCount, 1);
  assert.equal(summary.counters.releaseCount, 1);
  assert.equal(summary.releaseFailureReason, null);

  const aborted = prepare();
  let release;
  const releaseFence = new Promise((resolve) => { release = resolve; });
  const releasePromise = scheduleSchroederSpatialEpochTransactionRelease(aborted, {
    after: releaseFence
  });
  assert.equal(abortSchroederSpatialEpochTransaction(aborted, 'test abort'), true);
  release(true);
  assert.equal(await releasePromise, true);
  summary = summarizeSchroederSpatialEpochTransaction(aborted);
  assert.equal(summary.state, 'aborted');
  assert.equal(summary.abortReason, 'test abort');
  assert.equal(summary.counters.releaseCount, 1);
});

test('two chained transactions preserve distinct generations and exactly one build each', () => {
  const first = fixture({ generationId: 19, storageGeneration: 8 });
  const second = fixture({ generationId: 20, storageGeneration: 9 });
  const transactions = [
    createSchroederSpatialEpochTransaction(first),
    createSchroederSpatialEpochTransaction(second)
  ];
  const summaries = transactions.map(summarizeSchroederSpatialEpochTransaction);
  assert.deepEqual(summaries.map((summary) => summary.generationId), [19, 20]);
  assert.deepEqual(summaries.map((summary) => summary.epochIdentity.storageGeneration), [8, 9]);
  assert.equal(
    summaries.reduce((sum, summary) => sum + summary.counters.directoryBuildCount, 0),
    2
  );
  assert.equal(
    summaries.reduce((sum, summary) => sum + summary.counters.privateCanonicalLookupBuildCount, 0),
    0
  );
});
