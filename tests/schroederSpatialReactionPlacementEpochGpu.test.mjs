import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_BYTES,
  SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX,
  SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_MAGIC,
  SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_STATUS,
  SPH_REACTION_PRODUCT_PLACEMENT_TRANSACTION_STATUS,
  SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_VERSION
} from '../ulg-gpu-abi/src/sphReactionProductPlacementReceipt.js';
import {
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_PRODUCT_PLACEMENT_V1
} from '../ulg-gpu-abi/src/schroederSpatialExactNear.js';
import {
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import {
  ULG_SCHROEDER_SPATIAL_REACTION_PLACEMENT_SOURCE_FAMILY_SCHEMA,
  acquireSphReactionWarmArenaWebGpu,
  acquireSphReactionWarmArenaWithBackpressureWebGpu,
  createSphReactionResolvePositionInvariantCertificate,
  destroySphReactionWarmArenaWebGpu,
  discardSphReactionWarmArenaLease,
  finalizeSchroederSpatialReactionPlacementPositionEpochFloor,
  isSchroederSpatialReactionPlacementEpochArtifact,
  releaseSchroederSpatialReactionPlacementSourceFamilyAfterQueue,
  releaseSchroederSpatialReactionPlacementTransferredDestinationOwnershipAfterQueue,
  releaseSphReactionWarmArenaAfterQueue,
  resolveSphReactionWarmArenaLease,
  resolveSchroederSpatialReactionPlacementSourceFamily,
  schroederSpatialReactionPlacementSourceFamilyLiveness,
  validateSchroederSpatialReactionPlacementPositionEpochFloor,
  runSchroederSpatialReactionPlacementEpochWebGpu,
  sphReactionWarmArenaStats,
  transferSchroederSpatialReactionPlacementDestinationOwnership
} from '../src/runtime/sph/schroederSpatialReactionPlacementEpochGpu.js';
import {
  acquireSphReactionProductPlacementSegmentedArenaWebGpu,
  createSchroederSpatialReactionProductPlacementAuthorityWebGpu,
  encodeSphReactionProductPlacementSegmentedWebGpu,
  finalizeSchroederSpatialReactionProductPlacementAuthority,
  isSubmittedSchroederSpatialReactionProductPlacementArtifact,
  observeSchroederSpatialReactionProductPlacementCompletion,
  resolveSchroederSpatialReactionProductPlacementAuthority,
  sealSchroederSpatialReactionProductPlacementEncoding,
  submitSchroederSpatialReactionProductPlacementWebGpu
} from '../src/runtime/sph/schroederSpatialReactionProductPlacementGpu.js';
import {
  runSchroederSpatialReactionDiscoveryProposalWebGpu
} from '../src/runtime/sph/schroederSpatialReactionDiscoveryProposalGpu.js';
import {
  releaseSchroederSpatialEpochGenerationAfterQueue,
  runSchroederSpatialEpochGenerationWebGpu,
  runSchroederSpatialEpochGenerationWithBackpressureWebGpu
} from '../src/runtime/sph/schroederSpatialEpochGpu.js';
import {
  buildSphReactionTable
} from '../src/runtime/sph/sphReactionGpuKernel.js';
import {
  commitSchroederSpatialEpochTransaction,
  createSchroederSpatialEpochTransaction,
  sealSchroederSpatialEpochTransactionProposals,
  sealSchroederSpatialEpochTransactionReaders
} from '../src/runtime/sph/schroederSpatialEpochTransaction.js';
import {
  prepareSchroederSpatialSuccessorSourceFamilyPublication,
  publishPreparedSchroederSpatialSuccessorSourceFamily
} from '../src/runtime/sph/schroederSpatialSuccessorSourceFamily.js';
import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
  SPH_GPU_PARTICLE_IDENTITY_UINTS,
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_THERMO_FLOATS
} from '../src/runtime/sph/sphGpuBuffers.js';
import {
  tagWebGpuBufferDevice
} from '../src/runtime/sph/sphGpuDeviceIdentity.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function fakeDevice() {
  const lost = deferred();
  const buffers = [];
  const copies = [];
  const submissions = [];
  const encoders = [];
  const operations = [];
  const device = {
    lost: lost.promise,
    limits: {
      maxBufferSize: 256 * 1024 * 1024,
      maxStorageBufferBindingSize: 128 * 1024 * 1024,
      maxUniformBufferBindingSize: 64 * 1024,
      maxStorageBuffersPerShaderStage: 16,
      maxComputeWorkgroupsPerDimension: 65_535,
      minUniformBufferOffsetAlignment: 256
    },
    createBuffer(descriptor) {
      const buffer = {
        ...descriptor,
        destroyCount: 0,
        destroy() { this.destroyCount += 1; },
        async mapAsync() {},
        getMappedRange() {
          return this._mappedData?.buffer ?? new ArrayBuffer(this.size);
        },
        unmap() {}
      };
      buffers.push(buffer);
      return buffer;
    },
    createCommandEncoder() {
      const record = {
        finishCount: 0,
        finished: false,
        commandBuffer: Object.freeze({
          kind: 'command-buffer',
          encoderOrdinal: encoders.length
        })
      };
      const encoder = {
        clearBuffer() {},
        beginComputePass() {
          if (record.finished) throw new Error('command encoder already finished');
          return {
            setPipeline() {},
            setBindGroup() {},
            dispatchWorkgroups() {},
            dispatchWorkgroupsIndirect() {},
            end() {}
          };
        },
        copyBufferToBuffer(source, sourceOffset, destination, destinationOffset, size) {
          if (record.finished) throw new Error('command encoder already finished');
          copies.push({ source, sourceOffset, destination, destinationOffset, size });
          operations.push({ kind: 'copy', source, destination, size });
          if (
            source.label?.includes('reaction-discovery-evidence')
            && source._writtenData
          ) {
            const words = source._writtenData.slice();
            const sourceCount = words[12];
            words[0] = sourceCount;
            words[1] = sourceCount;
            words[3] = sourceCount * 2;
            words[4] = sourceCount;
            words[6] = Math.min(1, sourceCount);
            words[7] = sourceCount;
            destination._mappedData = words;
          } else if (source._gpuWords) {
            destination._mappedData = source._gpuWords.slice();
          }
        },
        finish() {
          if (record.finished) throw new Error('command encoder already finished');
          record.finished = true;
          record.finishCount += 1;
          operations.push({ kind: 'finish', commandBuffer: record.commandBuffer });
          return record.commandBuffer;
        }
      };
      record.encoder = encoder;
      encoders.push(record);
      return encoder;
    },
    createShaderModule(descriptor) { return descriptor; },
    createComputePipeline(descriptor) {
      return {
        ...descriptor,
        getBindGroupLayout(index) { return { index }; }
      };
    },
    createBindGroup(descriptor) { return descriptor; },
    queue: {
      writeBuffer(target, offset, data) {
        target._writtenData = new data.constructor(data);
        operations.push({ kind: 'write', target, offset });
      },
      submit(commandBuffers) {
        submissions.push(commandBuffers);
        operations.push({ kind: 'submit', commandBuffers });
      },
      onSubmittedWorkDone() { return Promise.resolve(); }
    }
  };
  return { device, lost, buffers, copies, submissions, encoders, operations };
}

function buffer(device, label, size) {
  return tagWebGpuBufferDevice(device.createBuffer({ label, size, usage: 0 }), device);
}

function reactionDiscoveryTable() {
  const materialProperties = {
    a: {
      molarMassKgPerMol: 0.01,
      phases: [{
        name: 'solid',
        temperatureRange: [0, 2000],
        cpJPerKgK: 1000,
        densityKgPerM3: 1000,
        bulkModulusPa: 1e6,
        shearModulusPa: 2e5
      }],
      transitions: []
    },
    b: {
      molarMassKgPerMol: 0.02,
      phases: [{
        name: 'liquid',
        temperatureRange: [0, 2000],
        cpJPerKgK: 1200,
        densityKgPerM3: 800,
        bulkModulusPa: 8e5,
        shearModulusPa: 0
      }],
      transitions: []
    },
    ab: {
      molarMassKgPerMol: 0.03,
      phases: [{
        name: 'liquid',
        temperatureRange: [0, 3000],
        cpJPerKgK: 1500,
        densityKgPerM3: 500,
        bulkModulusPa: 5e5,
        shearModulusPa: 0
      }],
      transitions: []
    }
  };
  return buildSphReactionTable([{
    a: 'a',
    b: 'b',
    product: 'ab',
    activationTemperatureK: 0,
    phaseRequirements: { b: ['liquid'] },
    specificEnthalpyJPerKg: -1000
  }], {
    materialProperties,
    contactRadiusM: 0.1
  });
}

function fixture({ positionEpoch = 12 } = {}) {
  const gpu = fakeDevice();
  const particleCount = 2;
  const stateBytes = particleCount
    * SPH_GPU_PARTICLE_STATE_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  const thermoBytes = particleCount
    * SPH_GPU_PARTICLE_THERMO_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  const mechanicsBytes = particleCount
    * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  const identityBytes = particleCount
    * SPH_GPU_PARTICLE_IDENTITY_UINTS
    * Uint32Array.BYTES_PER_ELEMENT;
  const ancestorState = buffer(gpu.device, 'ancestor-state', stateBytes);
  const reactionInputState = ancestorState;
  const frozenState = buffer(gpu.device, 'frozen-resolved-state', stateBytes);
  const frozenThermo = buffer(gpu.device, 'frozen-resolved-thermo', thermoBytes);
  const frozenMechanics = buffer(
    gpu.device,
    'frozen-resolved-mechanics',
    mechanicsBytes
  );
  const identity = buffer(gpu.device, 'stable-identity', identityBytes);
  const ancestorLevelAssignment = {
    schema: 'peercompute.ulg.schroeder-level-assignment-execution.v0',
    status: 'schroeder-level-assignment-submitted',
    bufferFamilyGenerationStatus:
      'schroeder-particle-buffer-family-generation-ready',
    particleCount,
    assignmentStrideFloats: 16,
    assignmentBuffer: buffer(gpu.device, 'ancestor-assignment', particleCount * 64),
    assignmentBufferByteLength: particleCount * 64,
    sourceStateBuffer: ancestorState,
    sourceStateBufferBorrowed: true,
    storageGeneration: 7,
    physicsTick: 19,
    physicsSubstep: 3,
    positionEpoch,
    topologyEpoch: 5,
    chartEpoch: 2,
    levelEpoch: 9,
    supportEpoch: 10,
    minLevel: -1,
    maxLevel: 2,
    chartId: 3,
    baseGridSpacingM: Math.fround(0.1)
  };
  const ancestor = runSchroederSpatialEpochGenerationWebGpu({
    device: gpu.device,
    levelAssignment: ancestorLevelAssignment,
    particleCount,
    particleIdentityBuffer: identity,
    particleIdentityStrideWords: SPH_GPU_PARTICLE_IDENTITY_UINTS,
    laneId: 'placement-test-public-ancestor',
    sourceFamily: 'placement-test-public-ancestor',
    mechanicsLevels: []
  });
  const sphParticleState = {
    schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
    particleCount,
    smoothingLengthM: 0.1,
    state: new Float32Array(particleCount * SPH_GPU_PARTICLE_STATE_FLOATS),
    thermo: new Float32Array(particleCount * SPH_GPU_PARTICLE_THERMO_FLOATS)
  };
  const mlsMpmParticleState = {
    schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
    particleCount,
    mechanics: new Float32Array(
      particleCount * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS
    )
  };
  const sphParticleUpload = {
    status: 'webgpu-uploaded',
    particleCount,
    identityBuffer: identity,
    identityRequired: true
  };
  const positionInvariantCertificate =
    createSphReactionResolvePositionInvariantCertificate({
      device: gpu.device,
      ancestorGeneration: ancestor,
      reactionInputStateBuffer: reactionInputState,
      frozenResolvedStateBuffer: frozenState,
      particleCount
    });
  return {
    ...gpu,
    particleCount,
    stateBytes,
    thermoBytes,
    mechanicsBytes,
    ancestor,
    ancestorLevelAssignment,
    reactionInputState,
    frozenState,
    frozenThermo,
    frozenMechanics,
    identity,
    sphParticleState,
    mlsMpmParticleState,
    sphParticleUpload,
    positionInvariantCertificate
  };
}

async function authenticatedPostThermalDiscovery(fx) {
  const currentStateBuffer = buffer(
    fx.device,
    'post-thermal-reaction-current-state',
    fx.stateBytes
  );
  const currentThermoBuffer = buffer(
    fx.device,
    'post-thermal-reaction-current-thermo',
    fx.thermoBytes
  );
  const reactionTable = reactionDiscoveryTable();
  const proposal =
    await runSchroederSpatialReactionDiscoveryProposalWebGpu({
      device: fx.device,
      generation: fx.ancestor,
      sphParticleState: fx.sphParticleState,
      sourceStateBuffer: currentStateBuffer,
      sourceThermoBuffer: currentThermoBuffer,
      reactionTable
    });
  return {
    currentStateBuffer,
    currentThermoBuffer,
    reactionTable,
    proposal
  };
}

function injectedRunners(fx) {
  const calls = [];
  let assignmentBuffer = null;
  const levelAssignmentRunner = async (options) => {
    calls.push(['level', options]);
    assignmentBuffer = buffer(fx.device, 'fresh-level-assignment', 128);
    const epoch = {
      storageGeneration: options.sphParticleUpload.storageGeneration,
      physicsTick: options.sphParticleState.step,
      physicsSubstep: options.sphParticleState.physicsSubstep,
      positionEpoch: options.sphParticleState.positionEpoch,
      topologyEpoch: options.sphParticleState.topologyEpoch,
      chartEpoch: options.sphParticleState.chartEpoch,
      levelEpoch: options.sphParticleState.levelEpoch,
      supportEpoch: options.sphParticleState.supportEpoch
    };
    return {
      schema: 'peercompute.ulg.schroeder-level-assignment-execution.v0',
      status: 'schroeder-level-assignment-submitted',
      bufferFamilyGenerationStatus:
        'schroeder-particle-buffer-family-generation-ready',
      particleCount: fx.particleCount,
      assignmentStrideFloats: 16,
      assignmentBuffer,
      assignmentBufferByteLength: 128,
      sourceStateBuffer: options.sphParticleUpload.stateBuffer,
      sourceStateBufferBorrowed: true,
      minLevel: options.minLevel,
      maxLevel: options.maxLevel,
      chartId: options.chartId,
      baseGridSpacingM: Math.fround(options.baseGridSpacingM),
      ...epoch,
      destroyAssignmentBuffer() { assignmentBuffer.destroy(); }
    };
  };
  const spatialEpochGenerationRunner = async (options) => {
    calls.push(['spatial', options]);
    return runSchroederSpatialEpochGenerationWithBackpressureWebGpu(options);
  };
  const generationReleaseRunner = (generation) => {
    calls.push(['release', generation]);
    generation.releaseScheduled = true;
    generation.releasePromise = Promise.resolve(true);
    return true;
  };
  const generationQuarantineRunner = async (generation) => {
    calls.push(['quarantine', generation]);
    return true;
  };
  return {
    calls,
    get assignmentBuffer() { return assignmentBuffer; },
    levelAssignmentRunner,
    spatialEpochGenerationRunner,
    generationReleaseRunner,
    generationQuarantineRunner
  };
}

function exactPostClosureClassifier(
  fx,
  { lookupEpochIdentity = fx.ancestor.execution } = {}
) {
  const lookupLevelAssignment = {
    ...fx.ancestorLevelAssignment,
    storageGeneration: lookupEpochIdentity.storageGeneration,
    physicsTick: lookupEpochIdentity.physicsTick,
    physicsSubstep: lookupEpochIdentity.physicsSubstep,
    positionEpoch: lookupEpochIdentity.positionEpoch,
    topologyEpoch: lookupEpochIdentity.topologyEpoch,
    chartEpoch: lookupEpochIdentity.chartEpoch,
    levelEpoch: lookupEpochIdentity.levelEpoch,
    supportEpoch: lookupEpochIdentity.supportEpoch
  };
  const results = [];
  const runner = async ({
    nextParticleUploads,
    successorEpochIdentity
  }) => {
    const assignmentBuffer = buffer(
      fx.device,
      'successor-publication-post-closure-assignment',
      fx.particleCount * 16 * Float32Array.BYTES_PER_ELEMENT
    );
    const result = {
      schema: 'peercompute.ulg.schroeder-level-assignment-execution.v0',
      assignmentSchema: 'peercompute.ulg.schroeder-level-assignment.v0',
      status: 'schroeder-level-assignment-submitted',
      bufferFamilyGenerationStatus:
        'schroeder-particle-buffer-family-generation-ready',
      kernelScope: 'schroeder-gpu-level-assignment',
      particleCount: fx.particleCount,
      assignmentStrideFloats: 16,
      assignmentStrideBytes: 16 * Float32Array.BYTES_PER_ELEMENT,
      assignmentBuffer,
      assignmentBufferByteLength: assignmentBuffer.size,
      sourceStateBuffer:
        nextParticleUploads.sphParticleUpload.stateBuffer,
      sourceStateBufferBorrowed: true,
      sourceStateBufferByteLength: fx.stateBytes,
      sourceThermoBuffer:
        nextParticleUploads.sphParticleUpload.thermoBuffer,
      sourceThermoBufferBorrowed: true,
      sourceThermoBufferByteLength: fx.thermoBytes,
      sourceMechanicsBuffer:
        nextParticleUploads.mlsMpmParticleUpload.mechanicsBuffer,
      sourceMechanicsBufferBorrowed: true,
      sourceMechanicsBufferByteLength: fx.mechanicsBytes,
      minLevel: lookupLevelAssignment.minLevel,
      maxLevel: lookupLevelAssignment.maxLevel,
      chartId: lookupLevelAssignment.chartId,
      baseGridSpacingM: lookupLevelAssignment.baseGridSpacingM,
      ...successorEpochIdentity,
      fullParticleReadbackPerformed: false,
      destroyAssignmentBuffer() {
        assignmentBuffer.destroy();
      }
    };
    results.push(result);
    return result;
  };
  return {
    lookupLevelAssignment,
    results,
    runner
  };
}

function completedPlacementReceiptWords(authority, {
  sparePlacementEventCount = 1
} = {}) {
  const words = new Uint32Array(
    SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_BYTES / Uint32Array.BYTES_PER_ELEMENT
  );
  const put = (field, value) => {
    words[SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX[field]] = value;
  };
  const activeEventCount = 1;
  put('magic', SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_MAGIC);
  put('version', SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_VERSION);
  put('generationId', authority.generationId);
  put(
    'supportProfileId',
    SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_PRODUCT_PLACEMENT_V1
  );
  put('eventCapacity', authority.productEventCapacity);
  put('compactCountPassCount', 1);
  put('compactScanPassCount', 1);
  put('compactScatterPassCount', 1);
  put('activeEventCount', activeEventCount);
  put('compactionInputVisitCount', authority.productEventCapacity);
  put('compactionLiveFlagCount', activeEventCount);
  put('envelopePartialPassCount', 1);
  put('envelopeFinalizePassCount', 1);
  put('envelopeInputVisitCount', authority.particleCount);
  put('envelopeAdmitted', 1);
  put('classifierPassCount', 1);
  put('classifierReadyCount', activeEventCount);
  put('ssCellVisitCount', 1);
  put('ssMemberVisitCount', 1);
  put('spareFlagPassCount', 2);
  put('spareScanPassCount', 2);
  put('spareAssignPassCount', 2);
  put('spareCandidateVisitCount', authority.particleCount);
  put('spareAvailableCount', sparePlacementEventCount);
  put('spareAssignedCount', sparePlacementEventCount);
  put('applyPassCount', 1);
  put('applyVisitedCount', activeEventCount);
  put('directOnlyEventCount', sparePlacementEventCount === 0 ? 1 : 0);
  put('sparePlacementEventCount', sparePlacementEventCount);
  put('serialConflictFoldPassCount', 0);
  put('serialConflictFoldEventCount', 0);
  put('maxSerialConflictFoldSize', 0);
  put('status', SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_STATUS.COMPLETE);
  put('applyPreflightPassCount', 1);
  put('intentEmitPassCount', 1);
  put('mutationIntentCapacity', authority.productEventCapacity * 2);
  put('mutationIntentCount', activeEventCount);
  put('destinationRadixPassCount', 24);
  put('destinationSegmentReducePassCount', 2);
  put('destinationApplyPassCount', 2);
  put('destinationIntentVisitedCount', authority.productEventCapacity * 2);
  put('destinationMutationCount', activeEventCount);
  put('maxDestinationSegmentSize', activeEventCount);
  put('summaryRadixPassCount', 8);
  put('summarySegmentReducePassCount', 1);
  put('summaryApplyPassCount', 1);
  put('summaryContributionCount', activeEventCount);
  put('globalSerialEventFoldCount', 0);
  put('hostCompletionReadbackCount', 1);
  put('transactionalPublishPassCount', 1);
  put('transactionalVisitedParticleCount', authority.particleCount);
  put('transactionalCommittedParticleCount', authority.particleCount);
  put('transactionalFallbackParticleCount', 0);
  put('transactionalEventPublishPassCount', 1);
  put('transactionalVisitedEventRowCount', authority.productEventCapacity * 8);
  put('transactionalCommittedEventRowCount', authority.productEventCapacity * 8);
  put('transactionalFallbackEventRowCount', 0);
  put('transactionalSummaryPublishPassCount', 1);
  put('transactionalVisitedSummaryRowCount', 8);
  put('transactionalCommittedSummaryRowCount', 8);
  put('transactionalFallbackSummaryRowCount', 0);
  put('transactionalTerminalSealPassCount', 1);
  put(
    'transactionalTerminalStatus',
    SPH_REACTION_PRODUCT_PLACEMENT_TRANSACTION_STATUS.SAFE_PLACED
  );
  return words;
}

function encodeGenuineResidentPlacement(fx, family, {
  sourceStateBuffer,
  sourceThermoBuffer,
  labelPrefix = 'resident-placement',
  productEventCapacity = 2,
  productTermCount = 1,
  diagnosticReadbackRequested = false
} = {}) {
  const authority =
    createSchroederSpatialReactionProductPlacementAuthorityWebGpu({
      device: fx.device,
      placementSourceFamily: family,
      particleCount: fx.particleCount,
      productEventCapacity,
      sourceStateBuffer,
      sourceThermoBuffer
    });
  const productEventBuffer = buffer(
    fx.device,
    `${labelPrefix}-events`,
    productEventCapacity * 8 * 16
  );
  const placementSummaryBuffer = buffer(
    fx.device,
    `${labelPrefix}-summary`,
    productTermCount * 8 * 16
  );
  const arenaLease = acquireSphReactionProductPlacementSegmentedArenaWebGpu({
    device: fx.device,
    authority,
    particleCapacity: fx.particleCount,
    eventCapacity: productEventCapacity,
    productTermCapacity: productTermCount,
    eventStrideVec4: 8,
    diagnosticReadbackRequested
  });
  const encoder = fx.device.createCommandEncoder();
  const segmentedEncoding = encodeSphReactionProductPlacementSegmentedWebGpu({
    device: fx.device,
    encoder,
    authority,
    arenaLease,
    productEventBuffer,
    nextStateBuffer: authority.placedDestinationStateBuffer,
    nextThermoBuffer: authority.placedDestinationThermoBuffer,
    nextMechanicsBuffer: authority.placedDestinationMechanicsBuffer,
    placementSummaryBuffer,
    placementDecisionBuffer: arenaLease.arena.buffers.decisions,
    placementControlBuffer: arenaLease.arena.buffers.control,
    compactCountBuffer: arenaLease.arena.buffers.compactCount,
    productTermCount,
    boxDimsM: [1, 1, 1],
    diagnosticReadbackRequested
  });
  return {
    authority,
    arenaLease,
    encoder,
    segmentedEncoding,
    productEventBuffer,
    candidateProductEventBuffer:
      segmentedEncoding.candidateProductEventBuffer,
    placementSummaryBuffer,
    candidatePlacementSummaryBuffer:
      segmentedEncoding.candidatePlacementSummaryBuffer,
    productEventCapacity,
    productTermCount
  };
}

function submitGenuineResidentPlacement(fx, family, options = {}) {
  const prepared = encodeGenuineResidentPlacement(fx, family, options);
  const {
    authority,
    segmentedEncoding,
    productEventCapacity
  } = prepared;
  const encoding = sealSchroederSpatialReactionProductPlacementEncoding(
    authority,
    {
      segmentedEncoding
    }
  );
  const placementArtifact =
    submitSchroederSpatialReactionProductPlacementWebGpu({
      authority,
      encoding
    });
  return {
    ...prepared,
    authority,
    encoding,
    placementArtifact,
    productEventCapacity
  };
}

async function livePlacementContext() {
  const fx = fixture();
  const discovery = await authenticatedPostThermalDiscovery(fx);
  const positionInvariantCertificate =
    createSphReactionResolvePositionInvariantCertificate({
      device: fx.device,
      ancestorGeneration: fx.ancestor,
      reactionInputStateBuffer: discovery.currentStateBuffer,
      reactionInputThermoBuffer: discovery.currentThermoBuffer,
      frozenResolvedStateBuffer: fx.frozenState,
      particleCount: fx.particleCount,
      reactionDiscoveryProposal: discovery.proposal,
      reactionTable: discovery.reactionTable
    });
  const {
    generationReleaseRunner: _generationReleaseRunner,
    ...runners
  } = injectedRunners(fx);
  const family = await runSchroederSpatialReactionPlacementEpochWebGpu({
    device: fx.device,
    ancestorPublicGeneration: fx.ancestor,
    sphParticleState: fx.sphParticleState,
    mlsMpmParticleState: fx.mlsMpmParticleState,
    sphParticleUpload: fx.sphParticleUpload,
    frozenSourceStateBuffer: fx.frozenState,
    frozenSourceThermoBuffer: fx.frozenThermo,
    frozenSourceMechanicsBuffer: fx.frozenMechanics,
    positionInvariantCertificate,
    ...runners
  });
  return { fx, discovery, family };
}

test('placement seal finishes exactly once and submit consumes only the sealed command buffer', async () => {
  const { fx, discovery, family } = await livePlacementContext();
  const prepared = encodeGenuineResidentPlacement(fx, family, {
    sourceStateBuffer: discovery.currentStateBuffer,
    sourceThermoBuffer: discovery.currentThermoBuffer,
    diagnosticReadbackRequested: true
  });
  const readback = prepared.arenaLease.completionReadbackBuffer;
  const encoderRecord = fx.encoders.find(
    (candidate) => candidate.encoder === prepared.encoder
  );
  assert.ok(encoderRecord);
  assert.equal(encoderRecord.finishCount, 0);
  const sealed = sealSchroederSpatialReactionProductPlacementEncoding(
    prepared.authority,
    {
      segmentedEncoding: prepared.segmentedEncoding,
      completionReadbackBuffer: readback
    }
  );
  assert.equal(encoderRecord.finishCount, 1);
  assert.equal(sealed.commandBuffer, encoderRecord.commandBuffer);
  assert.equal(sealed.completionReadbackBuffer, readback);
  assert.equal(sealed.productEventBuffer, prepared.productEventBuffer);
  assert.equal(
    sealed.candidateProductEventBuffer,
    prepared.candidateProductEventBuffer
  );
  assert.equal(sealed.placementSummaryBuffer, prepared.placementSummaryBuffer);
  assert.equal(
    sealed.candidatePlacementSummaryBuffer,
    prepared.candidatePlacementSummaryBuffer
  );
  assert.equal(sealed.transactionalFailClosedRecoveryEncoded, true);
  assert.equal(sealed.transactionalAuxiliaryMaterializationEncoded, true);
  assert.throws(
    () => prepared.encoder.beginComputePass(),
    /already finished/
  );
  assert.throws(
    () => submitSchroederSpatialReactionProductPlacementWebGpu({
      authority: prepared.authority,
      encoding: sealed,
      completionReadbackBuffer: readback
    }),
    {
      code: 'ERR_SCHROEDER_SPATIAL_REACTION_PRODUCT_PLACEMENT_SUBMISSION'
    }
  );
  const submitted = submitSchroederSpatialReactionProductPlacementWebGpu({
    authority: prepared.authority,
    encoding: sealed
  });
  assert.equal(encoderRecord.finishCount, 1);
  assert.deepEqual(fx.submissions.at(-1), [sealed.commandBuffer]);
  assert.equal(submitted.candidateProductEventBuffer, prepared.candidateProductEventBuffer);
  assert.equal(submitted.placementSummaryBuffer, prepared.placementSummaryBuffer);
  assert.equal(
    submitted.candidatePlacementSummaryBuffer,
    prepared.candidatePlacementSummaryBuffer
  );
  assert.equal(submitted.transactionalFailClosedRecoveryEncoded, true);
  assert.equal(submitted.transactionalAuxiliaryMaterializationEncoded, true);
  assert.throws(
    () => submitSchroederSpatialReactionProductPlacementWebGpu({
      authority: prepared.authority,
      encoding: sealed
    }),
    {
      code: 'ERR_SCHROEDER_SPATIAL_REACTION_PRODUCT_PLACEMENT_SUBMISSION'
    }
  );
});

test('placement diagnostic readback rejects every published and candidate ledger alias', async () => {
  const { fx, discovery, family } = await livePlacementContext();
  const prepared = encodeGenuineResidentPlacement(fx, family, {
    sourceStateBuffer: discovery.currentStateBuffer,
    sourceThermoBuffer: discovery.currentThermoBuffer,
    productEventCapacity: 3,
    productTermCount: 3,
    diagnosticReadbackRequested: true
  });
  const encoderRecord = fx.encoders.find(
    (candidate) => candidate.encoder === prepared.encoder
  );
  for (const readbackAlias of [
    prepared.productEventBuffer,
    prepared.candidateProductEventBuffer,
    prepared.placementSummaryBuffer,
    prepared.candidatePlacementSummaryBuffer
  ]) {
    assert.throws(
      () => sealSchroederSpatialReactionProductPlacementEncoding(
        prepared.authority,
        {
          segmentedEncoding: prepared.segmentedEncoding,
          completionReadbackBuffer: readbackAlias
        }
      ),
      {
        code: 'ERR_SCHROEDER_SPATIAL_REACTION_PRODUCT_PLACEMENT_OBSERVATION'
      }
    );
    assert.equal(encoderRecord.finishCount, 0);
  }
  const sealed = sealSchroederSpatialReactionProductPlacementEncoding(
    prepared.authority,
    {
      segmentedEncoding: prepared.segmentedEncoding,
      completionReadbackBuffer: prepared.arenaLease.completionReadbackBuffer
    }
  );
  assert.equal(sealed.commandBuffer, encoderRecord.commandBuffer);
  assert.equal(encoderRecord.finishCount, 1);
});

test('placement liveness rejects device loss after encode and after seal', async () => {
  {
    const { fx, discovery, family } = await livePlacementContext();
    const prepared = encodeGenuineResidentPlacement(fx, family, {
      sourceStateBuffer: discovery.currentStateBuffer,
      sourceThermoBuffer: discovery.currentThermoBuffer
    });
    const submissionCountBeforeLoss = fx.submissions.length;
    fx.lost.resolve({ message: 'lost after placement encode' });
    await Promise.resolve();
    await Promise.resolve();
    assert.throws(
      () => sealSchroederSpatialReactionProductPlacementEncoding(
        prepared.authority,
        { segmentedEncoding: prepared.segmentedEncoding }
      ),
      {
        code: 'ERR_SCHROEDER_SPATIAL_REACTION_PRODUCT_PLACEMENT_DEVICE_LOSS'
      }
    );
    assert.equal(fx.submissions.length, submissionCountBeforeLoss);
  }
  {
    const { fx, discovery, family } = await livePlacementContext();
    const prepared = encodeGenuineResidentPlacement(fx, family, {
      sourceStateBuffer: discovery.currentStateBuffer,
      sourceThermoBuffer: discovery.currentThermoBuffer
    });
    const sealed = sealSchroederSpatialReactionProductPlacementEncoding(
      prepared.authority,
      { segmentedEncoding: prepared.segmentedEncoding }
    );
    const submissionCountBeforeLoss = fx.submissions.length;
    fx.lost.resolve({ message: 'lost after placement seal' });
    await Promise.resolve();
    await Promise.resolve();
    assert.throws(
      () => submitSchroederSpatialReactionProductPlacementWebGpu({
        authority: prepared.authority,
        encoding: sealed
      }),
      {
        code: 'ERR_SCHROEDER_SPATIAL_REACTION_PRODUCT_PLACEMENT_DEVICE_LOSS'
      }
    );
    assert.equal(fx.submissions.length, submissionCountBeforeLoss);
  }
});

test('placement observation rechecks device liveness after map suspension', async () => {
  const { fx, discovery, family } = await livePlacementContext();
  const prepared = encodeGenuineResidentPlacement(fx, family, {
    sourceStateBuffer: discovery.currentStateBuffer,
    sourceThermoBuffer: discovery.currentThermoBuffer,
    diagnosticReadbackRequested: true
  });
  prepared.authority.completionReceiptBuffer._gpuWords =
    completedPlacementReceiptWords(prepared.authority);
  const readback = prepared.arenaLease.completionReadbackBuffer;
  const mapGate = deferred();
  readback.mapAsync = () => mapGate.promise;
  const sealed = sealSchroederSpatialReactionProductPlacementEncoding(
    prepared.authority,
    {
      segmentedEncoding: prepared.segmentedEncoding,
      completionReadbackBuffer: readback
    }
  );
  const submitted = submitSchroederSpatialReactionProductPlacementWebGpu({
    authority: prepared.authority,
    encoding: sealed
  });
  const observationPromise =
    observeSchroederSpatialReactionProductPlacementCompletion(
      prepared.authority,
      { submissionArtifact: submitted }
    );
  fx.lost.resolve({ message: 'lost while placement readback was pending' });
  await Promise.resolve();
  await Promise.resolve();
  mapGate.resolve();
  await assert.rejects(observationPromise, {
    code: 'ERR_SCHROEDER_SPATIAL_REACTION_PRODUCT_PLACEMENT_DEVICE_LOSS'
  });
});

test('placement finalization rejects source retirement after a valid observation', async () => {
  const { fx, discovery, family } = await livePlacementContext();
  const prepared = encodeGenuineResidentPlacement(fx, family, {
    sourceStateBuffer: discovery.currentStateBuffer,
    sourceThermoBuffer: discovery.currentThermoBuffer,
    diagnosticReadbackRequested: true
  });
  prepared.authority.completionReceiptBuffer._gpuWords =
    completedPlacementReceiptWords(prepared.authority);
  const sealed = sealSchroederSpatialReactionProductPlacementEncoding(
    prepared.authority,
    {
      segmentedEncoding: prepared.segmentedEncoding,
      completionReadbackBuffer: prepared.arenaLease.completionReadbackBuffer
    }
  );
  const submitted = submitSchroederSpatialReactionProductPlacementWebGpu({
    authority: prepared.authority,
    encoding: sealed
  });
  const observation =
    await observeSchroederSpatialReactionProductPlacementCompletion(
      prepared.authority,
      { submissionArtifact: submitted }
    );
  assert.equal(
    releaseSchroederSpatialReactionPlacementSourceFamilyAfterQueue(family, {
      abandon: true
    }),
    true
  );
  assert.throws(
    () => finalizeSchroederSpatialReactionProductPlacementAuthority(
      prepared.authority,
      {
        submissionArtifact: submitted,
        placementDecisionBuffer: prepared.segmentedEncoding.placementDecisionBuffer,
        placementControlBuffer: prepared.segmentedEncoding.placementControlBuffer,
        productEventBuffer: prepared.productEventBuffer,
        completionObservation: observation
      }
    ),
    {
      code: 'ERR_SCHROEDER_SPATIAL_REACTION_PRODUCT_PLACEMENT_RETIRED'
    }
  );
});

test('position epoch floor re-resolves source liveness after its async import', async () => {
  const { fx, discovery, family } = await livePlacementContext();
  const { placementArtifact } = submitGenuineResidentPlacement(fx, family, {
    sourceStateBuffer: discovery.currentStateBuffer,
    sourceThermoBuffer: discovery.currentThermoBuffer
  });
  const floorPromise =
    finalizeSchroederSpatialReactionPlacementPositionEpochFloor(family, {
      placementArtifact
    });
  assert.equal(
    releaseSchroederSpatialReactionPlacementSourceFamilyAfterQueue(family, {
      abandon: true
    }),
    true
  );
  await assert.rejects(floorPromise, {
    code: 'ERR_SCHROEDER_SPATIAL_REACTION_PLACEMENT_EPOCH_RETIRED'
  });
});

test('resolve-position certificate reauthenticates the exact branded post-thermal discovery family', async () => {
  const fx = fixture();
  const discovery = await authenticatedPostThermalDiscovery(fx);
  const certificateOptions = {
    device: fx.device,
    ancestorGeneration: fx.ancestor,
    reactionInputStateBuffer: discovery.currentStateBuffer,
    reactionInputThermoBuffer: discovery.currentThermoBuffer,
    frozenResolvedStateBuffer: fx.frozenState,
    particleCount: fx.particleCount,
    reactionDiscoveryProposal: discovery.proposal,
    reactionTable: discovery.reactionTable
  };
  const certificate =
    createSphReactionResolvePositionInvariantCertificate(certificateOptions);
  assert.equal(
    certificate.sourceAuthority,
    'authenticated-displacement-certified-post-g2p-reaction-discovery-current-state'
  );
  assert.equal(certificate.prePlacementPositionChanged, true);
  assert.equal(
    certificate.resolvedPositionEpoch,
    fx.ancestor.execution.positionEpoch + 1
  );

  const swappedCurrentState = buffer(
    fx.device,
    'swapped-post-thermal-state',
    fx.stateBytes
  );
  assert.throws(
    () => createSphReactionResolvePositionInvariantCertificate({
      ...certificateOptions,
      reactionInputStateBuffer: swappedCurrentState
    }),
    {
      code:
        'ERR_SCHROEDER_SPATIAL_REACTION_PLACEMENT_EPOCH_RESOLVE_DISCOVERY_AUTHORITY'
    }
  );

  const swappedCurrentThermo = buffer(
    fx.device,
    'swapped-post-thermal-thermo',
    fx.thermoBytes
  );
  assert.throws(
    () => createSphReactionResolvePositionInvariantCertificate({
      ...certificateOptions,
      reactionInputThermoBuffer: swappedCurrentThermo
    }),
    {
      code:
        'ERR_SCHROEDER_SPATIAL_REACTION_PLACEMENT_EPOCH_RESOLVE_DISCOVERY_AUTHORITY'
    }
  );

  assert.throws(
    () => createSphReactionResolvePositionInvariantCertificate({
      ...certificateOptions,
      reactionDiscoveryProposal: Object.freeze({ ...discovery.proposal })
    }),
    {
      code:
        'ERR_SCHROEDER_SPATIAL_REACTION_PLACEMENT_EPOCH_RESOLVE_DISCOVERY_AUTHORITY'
    }
  );

  const otherAncestor = runSchroederSpatialEpochGenerationWebGpu({
    device: fx.device,
    levelAssignment: fx.ancestorLevelAssignment,
    particleCount: fx.particleCount,
    particleIdentityBuffer: fx.identity,
    particleIdentityStrideWords: SPH_GPU_PARTICLE_IDENTITY_UINTS,
    laneId: 'placement-test-wrong-public-ancestor',
    sourceFamily: 'placement-test-wrong-public-ancestor',
    mechanicsLevels: []
  });
  assert.throws(
    () => createSphReactionResolvePositionInvariantCertificate({
      ...certificateOptions,
      ancestorGeneration: otherAncestor
    }),
    {
      code:
        'ERR_SCHROEDER_SPATIAL_REACTION_PLACEMENT_EPOCH_RESOLVE_DISCOVERY_AUTHORITY'
    }
  );

  const runners = injectedRunners(fx);
  const family = await runSchroederSpatialReactionPlacementEpochWebGpu({
    device: fx.device,
    ancestorPublicGeneration: fx.ancestor,
    sphParticleState: fx.sphParticleState,
    mlsMpmParticleState: fx.mlsMpmParticleState,
    sphParticleUpload: fx.sphParticleUpload,
    frozenSourceStateBuffer: fx.frozenState,
    frozenSourceThermoBuffer: fx.frozenThermo,
    frozenSourceMechanicsBuffer: fx.frozenMechanics,
    positionInvariantCertificate: certificate,
    ...runners
  });
  assert.equal(family.ready, true);
  assert.equal(family.ancestorPublicGeneration, fx.ancestor);
  assert.equal(family.positionInvariantCertificate, certificate);
  assert.equal(
    family.epochIdentity.positionEpoch,
    fx.ancestor.execution.positionEpoch + 1
  );

  discovery.proposal.destroy();
  assert.equal(
    releaseSchroederSpatialReactionPlacementSourceFamilyAfterQueue(family, {
      abandon: true
    }),
    true
  );
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(
    releaseSchroederSpatialEpochGenerationAfterQueue(otherAncestor, fx.device),
    true
  );
  await otherAncestor.releasePromise;

  const zeroFx = fixture({ positionEpoch: 0 });
  const zeroDiscovery = await authenticatedPostThermalDiscovery(zeroFx);
  const zeroCertificate =
    createSphReactionResolvePositionInvariantCertificate({
      device: zeroFx.device,
      ancestorGeneration: zeroFx.ancestor,
      reactionInputStateBuffer: zeroDiscovery.currentStateBuffer,
      reactionInputThermoBuffer: zeroDiscovery.currentThermoBuffer,
      frozenResolvedStateBuffer: zeroFx.frozenState,
      particleCount: zeroFx.particleCount,
      reactionDiscoveryProposal: zeroDiscovery.proposal,
      reactionTable: zeroDiscovery.reactionTable
    });
  assert.equal(zeroCertificate.ancestorPositionEpoch, 0);
  assert.equal(zeroCertificate.resolvedPositionEpoch, 1);
  zeroDiscovery.proposal.destroy();
});

test('reaction placement borrows the canonical directory and binds a distinct displaced frozen family', async () => {
  const fx = fixture();
  const runners = injectedRunners(fx);
  const family = await runSchroederSpatialReactionPlacementEpochWebGpu({
    device: fx.device,
    ancestorPublicGeneration: fx.ancestor,
    sphParticleState: fx.sphParticleState,
    mlsMpmParticleState: fx.mlsMpmParticleState,
    sphParticleUpload: fx.sphParticleUpload,
    frozenSourceStateBuffer: fx.frozenState,
    frozenSourceThermoBuffer: fx.frozenThermo,
    frozenSourceMechanicsBuffer: fx.frozenMechanics,
    positionInvariantCertificate: fx.positionInvariantCertificate,
    ...runners
  });

  assert.equal(
    family.schema,
    ULG_SCHROEDER_SPATIAL_REACTION_PLACEMENT_SOURCE_FAMILY_SCHEMA
  );
  assert.equal(isSchroederSpatialReactionPlacementEpochArtifact(family), true);
  assert.equal(
    resolveSchroederSpatialReactionPlacementSourceFamily(family, {
      device: fx.device
    }),
    family
  );
  assert.equal(family.stageIdentity, 'post-reaction-pre-placement');
  assert.equal(family.ancestorPublicGeneration, fx.ancestor);
  assert.equal(
    family.ancestorPublicGenerationId,
    fx.ancestor.execution.generationId
  );
  assert.equal(family.generationId, fx.ancestor.execution.generationId);
  assert.equal(family.generation, fx.ancestor);
  assert.equal(family.private, false);
  assert.equal(family.sharedSpatialAuthorityBorrowed, true);
  assert.equal(family.epochIdentity.storageGeneration, 8);
  assert.equal(family.epochIdentity.physicsTick, 19);
  assert.equal(family.epochIdentity.physicsSubstep, 4);
  assert.equal(family.epochIdentity.positionEpoch, 12);
  assert.equal(family.epochIdentity.topologyEpoch, 5);
  assert.equal(family.epochIdentity.levelEpoch, 9);
  assert.equal(family.epochIdentity.supportEpoch, 10);
  assert.equal(family.placedDestinationStorageGeneration, 9);
  assert.equal(family.positionInvariantCertificate, fx.positionInvariantCertificate);
  assert.equal(family.identityBuffer, fx.identity);
  assert.equal(family.frozenSourceStateBuffer, fx.frozenState);
  assert.equal(
    family.directoryPositionAuthorityStateBuffer,
    fx.ancestor.source.sourceStateBuffer
  );
  assert.notEqual(family.placedDestinationStateBuffer, fx.frozenState);
  assert.notEqual(family.placedDestinationThermoBuffer, fx.frozenThermo);
  assert.notEqual(family.placedDestinationMechanicsBuffer, fx.frozenMechanics);
  assert.equal(family.directoryBuildCount, 0);
  assert.equal(family.privateLookupBuildCount, 0);
  assert.equal(family.privateLawSpatialBuildCount, 0);
  assert.equal(family.levelAssignmentBuildCount, 0);
  assert.equal(fx.copies.length, 3);
  assert.ok(fx.submissions.length >= 2);
  assert.deepEqual(runners.calls, []);

  assert.equal(
    releaseSchroederSpatialReactionPlacementSourceFamilyAfterQueue(family, {
      abandon: true
    }),
    true
  );
  assert.throws(
    () => transferSchroederSpatialReactionPlacementDestinationOwnership(
      family
    ),
    {
      code:
        'ERR_SCHROEDER_SPATIAL_REACTION_PLACEMENT_EPOCH_OWNERSHIP_TRANSFER'
    }
  );
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(fx.frozenState.destroyCount, 1);
  assert.equal(fx.frozenThermo.destroyCount, 1);
  assert.equal(fx.frozenMechanics.destroyCount, 1);
  assert.equal(runners.assignmentBuffer, null);
  assert.equal(family.placedDestinationStateBuffer.destroyCount, 1);
  assert.equal(family.placedDestinationThermoBuffer.destroyCount, 1);
  assert.equal(family.placedDestinationMechanicsBuffer.destroyCount, 1);
  assert.equal(
    schroederSpatialReactionPlacementSourceFamilyLiveness(family).releaseStatus,
    'released-after-final-consumer'
  );
  assert.equal('lifecycle' in family, false);
  assert.equal('completion' in family, false);
});

test('shared-directory reaction placement rejects every frozen source/destination alias before submission', async () => {
  const fx = fixture();
  const runners = injectedRunners(fx);

  await assert.rejects(
    runSchroederSpatialReactionPlacementEpochWebGpu({
      device: fx.device,
      ancestorPublicGeneration: fx.ancestor,
      sphParticleState: fx.sphParticleState,
      mlsMpmParticleState: fx.mlsMpmParticleState,
      sphParticleUpload: fx.sphParticleUpload,
      frozenSourceStateBuffer: fx.frozenState,
      frozenSourceThermoBuffer: fx.frozenThermo,
      frozenSourceMechanicsBuffer: fx.frozenMechanics,
      placedDestinationStateBuffer: fx.frozenState,
      positionInvariantCertificate: fx.positionInvariantCertificate,
      ...runners
    }),
    (error) => (
      error?.code
        === 'ERR_SCHROEDER_SPATIAL_REACTION_PLACEMENT_EPOCH_SOURCE_DESTINATION_ALIAS'
    )
  );
  assert.equal(fx.copies.length, 0);
  assert.equal(runners.calls.length, 0);
});

test('placement destination allocation failure destroys every already-allocated destination buffer', async () => {
  const fx = fixture();
  const runners = injectedRunners(fx);
  const originalCreateBuffer = fx.device.createBuffer;
  fx.device.createBuffer = function createBufferWithThermoFailure(descriptor) {
    if (descriptor.label
      === 'ulg-schroeder-reaction-placement-thermo-destination') {
      throw new Error('synthetic thermo allocation failure');
    }
    return originalCreateBuffer.call(this, descriptor);
  };
  await assert.rejects(
    runSchroederSpatialReactionPlacementEpochWebGpu({
      device: fx.device,
      ancestorPublicGeneration: fx.ancestor,
      sphParticleState: fx.sphParticleState,
      mlsMpmParticleState: fx.mlsMpmParticleState,
      sphParticleUpload: fx.sphParticleUpload,
      frozenSourceStateBuffer: fx.frozenState,
      frozenSourceThermoBuffer: fx.frozenThermo,
      frozenSourceMechanicsBuffer: fx.frozenMechanics,
      positionInvariantCertificate: fx.positionInvariantCertificate,
      ...runners
    }),
    /synthetic thermo allocation failure/
  );
  const partiallyAllocatedState = fx.buffers.find((candidate) => (
    candidate.label === 'ulg-schroeder-reaction-placement-state-destination'
  ));
  assert.ok(partiallyAllocatedState);
  assert.equal(partiallyAllocatedState.destroyCount, 1);
  assert.equal(runners.calls.length, 0);
  assert.equal(fx.copies.length, 0);
});

test('placement rejects source-source aliases even when capacities and resolve identity are valid', async () => {
  const fx = fixture();
  const runners = injectedRunners(fx);
  const aliasCertificate = createSphReactionResolvePositionInvariantCertificate({
    device: fx.device,
    ancestorGeneration: fx.ancestor,
    reactionInputStateBuffer: fx.reactionInputState,
    frozenResolvedStateBuffer: fx.frozenThermo,
    particleCount: fx.particleCount
  });
  await assert.rejects(
    runSchroederSpatialReactionPlacementEpochWebGpu({
      device: fx.device,
      ancestorPublicGeneration: fx.ancestor,
      sphParticleState: fx.sphParticleState,
      mlsMpmParticleState: fx.mlsMpmParticleState,
      sphParticleUpload: fx.sphParticleUpload,
      frozenSourceStateBuffer: fx.frozenThermo,
      frozenSourceThermoBuffer: fx.frozenThermo,
      frozenSourceMechanicsBuffer: fx.frozenMechanics,
      positionInvariantCertificate: aliasCertificate,
      ...runners
    }),
    {
      code: 'ERR_SCHROEDER_SPATIAL_REACTION_PLACEMENT_EPOCH_SOURCE_ALIAS'
    }
  );
  assert.equal(runners.calls.length, 0);
});

test('genuine post-G2P discovery and one-shot placement establish a strict position-epoch floor without readback', async () => {
  const fx = fixture();
  const discovery = await authenticatedPostThermalDiscovery(fx);
  const positionInvariantCertificate =
    createSphReactionResolvePositionInvariantCertificate({
      device: fx.device,
      ancestorGeneration: fx.ancestor,
      reactionInputStateBuffer: discovery.currentStateBuffer,
      reactionInputThermoBuffer: discovery.currentThermoBuffer,
      frozenResolvedStateBuffer: fx.frozenState,
      particleCount: fx.particleCount,
      reactionDiscoveryProposal: discovery.proposal,
      reactionTable: discovery.reactionTable
    });
  const runners = injectedRunners(fx);
  const {
    generationReleaseRunner: _injectedGenerationReleaseRunner,
    ...liveRunners
  } = runners;
  const family = await runSchroederSpatialReactionPlacementEpochWebGpu({
    device: fx.device,
    ancestorPublicGeneration: fx.ancestor,
    sphParticleState: fx.sphParticleState,
    mlsMpmParticleState: fx.mlsMpmParticleState,
    sphParticleUpload: fx.sphParticleUpload,
    frozenSourceStateBuffer: fx.frozenState,
    frozenSourceThermoBuffer: fx.frozenThermo,
    frozenSourceMechanicsBuffer: fx.frozenMechanics,
    positionInvariantCertificate,
    ...liveRunners
  });
  assert.equal(
    family.epochIdentity.positionEpoch,
    fx.ancestor.execution.positionEpoch + 1
  );
  const { authority, encoding, placementArtifact } =
    submitGenuineResidentPlacement(fx, family, {
      sourceStateBuffer: discovery.currentStateBuffer,
      sourceThermoBuffer: discovery.currentThermoBuffer
    });
  assert.equal(
    isSubmittedSchroederSpatialReactionProductPlacementArtifact(
      placementArtifact
    ),
    true
  );
  assert.equal(placementArtifact.diagnosticReadbackRequested, false);
  assert.equal(placementArtifact.completionReadbackBuffer, null);
  assert.equal(placementArtifact.authenticated, false);
  assert.equal(placementArtifact.gpuAuthenticated, false);
  assert.equal(placementArtifact.submissionAuthenticated, true);
  assert.equal(placementArtifact.destinationSafetyAuthenticated, true);
  assert.equal(placementArtifact.placementOutcomeObserved, false);
  assert.equal(placementArtifact.transactionalPublicationGateEncoded, true);
  const copiedSubmissionArtifact = Object.freeze({ ...placementArtifact });
  assert.equal(
    isSubmittedSchroederSpatialReactionProductPlacementArtifact(
      copiedSubmissionArtifact
    ),
    false
  );
  await assert.rejects(
    finalizeSchroederSpatialReactionPlacementPositionEpochFloor(
      family,
      { placementArtifact: copiedSubmissionArtifact }
    ),
    {
      code: 'ERR_SCHROEDER_SPATIAL_REACTION_PLACEMENT_EPOCH_FINALIZATION'
    }
  );
  assert.throws(
    () => submitSchroederSpatialReactionProductPlacementWebGpu({
      authority,
      encoding
    }),
    {
      code: 'ERR_SCHROEDER_SPATIAL_REACTION_PRODUCT_PLACEMENT_SUBMISSION'
    }
  );

  const [positionReceipt, concurrentReceipt] = await Promise.all([
    finalizeSchroederSpatialReactionPlacementPositionEpochFloor(
      family,
      { placementArtifact }
    ),
    finalizeSchroederSpatialReactionPlacementPositionEpochFloor(
      family,
      { placementArtifact }
    )
  ]);
  assert.equal(concurrentReceipt, positionReceipt);
  assert.equal(positionReceipt.positionEpochFloorAuthenticated, true);
  assert.equal(positionReceipt.positionMutationObserved, false);
  assert.equal(positionReceipt.positionMayHaveChanged, true);
  assert.equal(positionReceipt.positionEpochAdvanceRequired, true);
  assert.equal(positionReceipt.topologyMayChange, true);
  assert.equal(positionReceipt.conservativeTopologyAdvanceRequired, true);
  assert.equal(positionReceipt.gpuCompletionObserved, false);
  assert.equal(positionReceipt.destinationSafetyAuthenticated, true);
  assert.equal(positionReceipt.placementOutcomeAuthenticated, false);
  assert.equal(positionReceipt.placementOutcomeObserved, false);
  assert.equal(positionReceipt.transactionalPublicationGateEncoded, true);
  assert.equal(positionReceipt.sparePlacementEventCount, null);
  assert.equal(
    positionReceipt.positionEpochFloor,
    fx.ancestor.execution.positionEpoch + 2
  );
  assert.equal(
    validateSchroederSpatialReactionPlacementPositionEpochFloor(
      positionReceipt,
      {
        device: fx.device,
        ancestorPublicGeneration: fx.ancestor
      }
    ),
    true
  );
  assert.equal(
    validateSchroederSpatialReactionPlacementPositionEpochFloor(
      Object.freeze({ ...positionReceipt }),
      {
        device: fx.device,
        ancestorPublicGeneration: fx.ancestor
      }
    ),
    false
  );
  assert.throws(
    () => transferSchroederSpatialReactionPlacementDestinationOwnership(
      family
    ),
    {
      code:
        'ERR_SCHROEDER_SPATIAL_REACTION_PLACEMENT_EPOCH_OWNERSHIP_TRANSFER'
    }
  );

  const sourceSphUpload = {
    stateBuffer: fx.reactionInputState,
    thermoBuffer: buffer(
      fx.device,
      'successor-publication-source-thermo',
      fx.thermoBytes
    ),
    identityBuffer: fx.identity
  };
  const sourceMlsMpmUpload = {
    mechanicsBuffer: buffer(
      fx.device,
      'successor-publication-source-mechanics',
      fx.mechanicsBytes
    )
  };
  const transaction = createSchroederSpatialEpochTransaction({
    device: fx.device,
    generation: fx.ancestor,
    sphParticleUpload: sourceSphUpload,
    mlsMpmParticleUpload: sourceMlsMpmUpload,
    requiredReaderIds: []
  });
  sealSchroederSpatialEpochTransactionReaders(transaction);
  sealSchroederSpatialEpochTransactionProposals(transaction);
  const nextParticleUploads = {
    sphParticleUpload: {
      schema: ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
      status: 'webgpu-uploaded',
      particleCount: fx.particleCount,
      stateBuffer: family.placedDestinationStateBuffer,
      thermoBuffer: family.placedDestinationThermoBuffer,
      identityBuffer: fx.identity,
      stateStrideBytes:
        SPH_GPU_PARTICLE_STATE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
      thermoStrideBytes:
        SPH_GPU_PARTICLE_THERMO_FLOATS * Float32Array.BYTES_PER_ELEMENT,
      identityStrideBytes:
        SPH_GPU_PARTICLE_IDENTITY_UINTS * Uint32Array.BYTES_PER_ELEMENT,
      ...family.epochIdentity
    },
    mlsMpmParticleUpload: {
      schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
      status: 'webgpu-uploaded',
      particleCount: fx.particleCount,
      mechanicsBuffer: family.placedDestinationMechanicsBuffer,
      mechanicsStrideBytes:
        MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS * Float32Array.BYTES_PER_ELEMENT,
      ...family.epochIdentity
    },
    schroederSpatialReactionPlacementPositionEpochFloorReceipt: positionReceipt
  };
  const classifier = exactPostClosureClassifier(fx, {
    lookupEpochIdentity: family.epochIdentity
  });
  const publicationPlan =
    await prepareSchroederSpatialSuccessorSourceFamilyPublication({
      transaction,
      generation: fx.ancestor,
      lookupLevelAssignment: classifier.lookupLevelAssignment,
      nextParticleUploads,
      successorLevelAssignmentRunner: classifier.runner,
      conservativeTopologyAdvance: true
    });
  const commitReceipt = commitSchroederSpatialEpochTransaction(transaction, {
    nextParticleUploads
  });
  const publicationReceipt =
    publishPreparedSchroederSpatialSuccessorSourceFamily(
      publicationPlan,
      { commitReceipt }
    );
  assert.equal(publicationReceipt.published, true);
  assert.equal(
    publicationReceipt.sourceFamily.positionTransitionAuthenticated,
    false
  );
  assert.equal(
    publicationReceipt.sourceFamily.positionEpochFloorAuthenticated,
    true
  );
  assert.equal(
    publicationReceipt.sourceFamily.positionEpoch,
    positionReceipt.positionEpochFloor
  );
  assert.equal(
    publicationReceipt.sourceFamily.positionAuthority,
    'authenticated-transactional-placement-epoch-floor-with-conservative-final-family'
  );
  assert.equal(
    releaseSchroederSpatialReactionPlacementSourceFamilyAfterQueue(family, {
      placementArtifact
    }),
    true
  );
  transferSchroederSpatialReactionPlacementDestinationOwnership(family);
  await placementArtifact.queueFence;
  await Promise.resolve();
  assert.equal(
    schroederSpatialReactionPlacementSourceFamilyLiveness(family).releaseStatus,
    'released-after-final-consumer'
  );
  assert.equal(family.generation.execution.released, false);
  assert.equal(family.placedDestinationStateBuffer.destroyCount, 0);
  assert.equal(family.placedDestinationThermoBuffer.destroyCount, 0);
  assert.equal(family.placedDestinationMechanicsBuffer.destroyCount, 0);
  discovery.proposal.destroy();
});

test('mixed final component family preserves the authenticated placement position-epoch floor', async () => {
  const fx = fixture();
  const discovery = await authenticatedPostThermalDiscovery(fx);
  const certificate = createSphReactionResolvePositionInvariantCertificate({
    device: fx.device,
    ancestorGeneration: fx.ancestor,
    reactionInputStateBuffer: discovery.currentStateBuffer,
    reactionInputThermoBuffer: discovery.currentThermoBuffer,
    frozenResolvedStateBuffer: fx.frozenState,
    particleCount: fx.particleCount,
    reactionDiscoveryProposal: discovery.proposal,
    reactionTable: discovery.reactionTable
  });
  const runners = injectedRunners(fx);
  const {
    generationReleaseRunner: _injectedGenerationReleaseRunner,
    ...liveRunners
  } = runners;
  const family = await runSchroederSpatialReactionPlacementEpochWebGpu({
    device: fx.device,
    ancestorPublicGeneration: fx.ancestor,
    sphParticleState: fx.sphParticleState,
    mlsMpmParticleState: fx.mlsMpmParticleState,
    sphParticleUpload: fx.sphParticleUpload,
    frozenSourceStateBuffer: fx.frozenState,
    frozenSourceThermoBuffer: fx.frozenThermo,
    frozenSourceMechanicsBuffer: fx.frozenMechanics,
    positionInvariantCertificate: certificate,
    ...liveRunners
  });
  const { placementArtifact } = submitGenuineResidentPlacement(fx, family, {
    sourceStateBuffer: discovery.currentStateBuffer,
    sourceThermoBuffer: discovery.currentThermoBuffer,
    labelPrefix: 'mixed-family-placement'
  });
  const positionReceipt =
    await finalizeSchroederSpatialReactionPlacementPositionEpochFloor(
      family,
      { placementArtifact }
    );
  const transaction = createSchroederSpatialEpochTransaction({
    device: fx.device,
    generation: fx.ancestor,
    sphParticleUpload: {
      stateBuffer: fx.reactionInputState,
      thermoBuffer: buffer(
        fx.device,
        'mixed-family-public-source-thermo',
        fx.thermoBytes
      ),
      identityBuffer: fx.identity
    },
    mlsMpmParticleUpload: {
      mechanicsBuffer: buffer(
        fx.device,
        'mixed-family-public-source-mechanics',
        fx.mechanicsBytes
      )
    },
    requiredReaderIds: []
  });
  sealSchroederSpatialEpochTransactionReaders(transaction);
  sealSchroederSpatialEpochTransactionProposals(transaction);
  const nextParticleUploads = {
    sphParticleUpload: {
      schema: ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
      status: 'webgpu-uploaded',
      particleCount: fx.particleCount,
      stateBuffer: family.placedDestinationStateBuffer,
      thermoBuffer: family.placedDestinationThermoBuffer,
      identityBuffer: fx.identity,
      stateStrideBytes:
        SPH_GPU_PARTICLE_STATE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
      thermoStrideBytes:
        SPH_GPU_PARTICLE_THERMO_FLOATS * Float32Array.BYTES_PER_ELEMENT,
      identityStrideBytes:
        SPH_GPU_PARTICLE_IDENTITY_UINTS * Uint32Array.BYTES_PER_ELEMENT,
      ...family.epochIdentity
    },
    mlsMpmParticleUpload: {
      schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
      status: 'webgpu-uploaded',
      particleCount: fx.particleCount,
      mechanicsBuffer: buffer(
        fx.device,
        'mixed-family-refreshed-mechanics',
        fx.mechanicsBytes
      ),
      mechanicsStrideBytes:
        MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS * Float32Array.BYTES_PER_ELEMENT,
      ...family.epochIdentity
    }
  };
  const classifier = exactPostClosureClassifier(fx, {
    lookupEpochIdentity: family.epochIdentity
  });
  await assert.rejects(
    prepareSchroederSpatialSuccessorSourceFamilyPublication({
      transaction,
      generation: fx.ancestor,
      lookupLevelAssignment: classifier.lookupLevelAssignment,
      nextParticleUploads,
      successorLevelAssignmentRunner: classifier.runner,
      conservativeTopologyAdvance: true,
      placementPositionEpochFloorReceipt:
        Object.freeze({ ...positionReceipt })
    }),
    {
      code:
        'ERR_SCHROEDER_SPATIAL_SUCCESSOR_SOURCE_FAMILY_POSITION_TRANSITION_FLOOR'
    }
  );
  const plan = await prepareSchroederSpatialSuccessorSourceFamilyPublication({
    transaction,
    generation: fx.ancestor,
    lookupLevelAssignment: classifier.lookupLevelAssignment,
    nextParticleUploads,
    successorLevelAssignmentRunner: classifier.runner,
    conservativeTopologyAdvance: true,
    placementPositionEpochFloorReceipt: positionReceipt
  });
  const published = publishPreparedSchroederSpatialSuccessorSourceFamily(
    plan,
    {
      commitReceipt: commitSchroederSpatialEpochTransaction(transaction, {
        nextParticleUploads
      })
    }
  );
  assert.equal(published.published, true);
  assert.equal(published.sourceFamily.positionTransitionAuthenticated, false);
  assert.equal(published.sourceFamily.positionEpochFloorAuthenticated, true);
  assert.equal(
    published.sourceFamily.positionEpoch,
    fx.ancestor.execution.positionEpoch + 2
  );
  assert.equal(
    published.sourceFamily.positionAuthority,
    'authenticated-transactional-placement-epoch-floor-with-conservative-final-family'
  );

  assert.equal(
    releaseSchroederSpatialReactionPlacementSourceFamilyAfterQueue(family, {
      placementArtifact
    }),
    true
  );
  transferSchroederSpatialReactionPlacementDestinationOwnership(family);
  await placementArtifact.queueFence;
  discovery.proposal.destroy();
});

test('observed v2 placement artifact remains diagnostic and cannot advance successor identity', async () => {
  const fx = fixture();
  const runners = injectedRunners(fx);
  const family = await runSchroederSpatialReactionPlacementEpochWebGpu({
    device: fx.device,
    ancestorPublicGeneration: fx.ancestor,
    sphParticleState: fx.sphParticleState,
    mlsMpmParticleState: fx.mlsMpmParticleState,
    sphParticleUpload: fx.sphParticleUpload,
    frozenSourceStateBuffer: fx.frozenState,
    frozenSourceThermoBuffer: fx.frozenThermo,
    frozenSourceMechanicsBuffer: fx.frozenMechanics,
    positionInvariantCertificate: fx.positionInvariantCertificate,
    ...runners
  });
  const sourceThermoBuffer = buffer(
    fx.device,
    'v2-authority-source-thermo',
    fx.thermoBytes
  );
  const productEventCapacity = 2;
  const authority =
    createSchroederSpatialReactionProductPlacementAuthorityWebGpu({
      device: fx.device,
      placementSourceFamily: family,
      particleCount: fx.particleCount,
      productEventCapacity,
      sourceStateBuffer: fx.reactionInputState,
      sourceThermoBuffer
    });
  assert.equal(
    resolveSchroederSpatialReactionProductPlacementAuthority(authority, {
      device: fx.device,
      generation: family.generation,
      particleCount: fx.particleCount,
      productEventCapacity,
      sourceStateBuffer: fx.reactionInputState,
      sourceThermoBuffer,
      placedDestinationStateBuffer: family.placedDestinationStateBuffer,
      placedDestinationThermoBuffer: family.placedDestinationThermoBuffer,
      placedDestinationMechanicsBuffer: family.placedDestinationMechanicsBuffer
    }).authority,
    authority
  );
  const forgedSegmentedEncoding = Object.freeze({
    schema:
      'peercompute.ulg.sph-reaction-product-placement-segmented-encoding.v3',
    authority,
    encoder: fx.device.createCommandEncoder(),
    transactionalPublicationGateEncoded: true,
    transactionalTerminalSealEncoded: true
  });
  assert.throws(
    () => sealSchroederSpatialReactionProductPlacementEncoding(authority, {
      segmentedEncoding: forgedSegmentedEncoding
    }),
    {
      code: 'ERR_SCHROEDER_SPATIAL_REACTION_PRODUCT_PLACEMENT_SUBMISSION'
    }
  );

  // Simulate the canonical GPU seal in the authority-owned resident receipt,
  // then copy that exact buffer into the observed readback buffer.
  authority.completionReceiptBuffer._gpuWords =
    completedPlacementReceiptWords(authority);
  const readbackBuffer = buffer(
    fx.device,
    'v2-authority-completion-readback',
    SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_BYTES
  );
  const productEventBuffer = buffer(
    fx.device,
    'v2-placement-events',
    productEventCapacity * 8 * 16
  );
  const placementSummaryBuffer = buffer(
    fx.device,
    'v2-placement-summary',
    8 * 16
  );
  const arenaLease = acquireSphReactionProductPlacementSegmentedArenaWebGpu({
    device: fx.device,
    authority,
    particleCapacity: fx.particleCount,
    eventCapacity: productEventCapacity,
    productTermCapacity: 1,
    eventStrideVec4: 8,
    diagnosticReadbackRequested: true
  });
  const encoder = fx.device.createCommandEncoder();
  const segmentedEncoding = encodeSphReactionProductPlacementSegmentedWebGpu({
    device: fx.device,
    encoder,
    authority,
    arenaLease,
    productEventBuffer,
    nextStateBuffer: authority.placedDestinationStateBuffer,
    nextThermoBuffer: authority.placedDestinationThermoBuffer,
    nextMechanicsBuffer: authority.placedDestinationMechanicsBuffer,
    placementSummaryBuffer,
    productTermCount: 1,
    boxDimsM: [1, 1, 1],
    diagnosticReadbackRequested: true
  });
  const placementDecisionBuffer = segmentedEncoding.placementDecisionBuffer;
  const placementControlBuffer = segmentedEncoding.placementControlBuffer;
  const encoding = sealSchroederSpatialReactionProductPlacementEncoding(
    authority,
    {
      segmentedEncoding,
      completionReadbackBuffer: readbackBuffer
    }
  );
  const submissionArtifact =
    submitSchroederSpatialReactionProductPlacementWebGpu({
      authority,
      encoding
    });
  const completionObservation =
    await observeSchroederSpatialReactionProductPlacementCompletion(
      authority,
      { submissionArtifact }
    );
  const placementArtifact =
    finalizeSchroederSpatialReactionProductPlacementAuthority(authority, {
      submissionArtifact,
      placementDecisionBuffer,
      placementControlBuffer,
      productEventBuffer,
      completionObservation
    });
  const duckTypedResidentSubmission = Object.freeze({
    ...placementArtifact,
    submitPerformed: true,
    gpuResident: true,
    positionMayChange: true,
    topologyMayChange: true
  });
  await assert.rejects(
    finalizeSchroederSpatialReactionPlacementPositionEpochFloor(
      family,
      { placementArtifact: duckTypedResidentSubmission }
    ),
    {
      code: 'ERR_SCHROEDER_SPATIAL_REACTION_PLACEMENT_EPOCH_FINALIZATION'
    }
  );
  await assert.rejects(
    finalizeSchroederSpatialReactionPlacementPositionEpochFloor(
      family,
      { placementArtifact }
    ),
    {
      code: 'ERR_SCHROEDER_SPATIAL_REACTION_PLACEMENT_EPOCH_FINALIZATION'
    }
  );
  assert.throws(
    () => releaseSchroederSpatialReactionPlacementSourceFamilyAfterQueue(
      family,
      { placementArtifact }
    ),
    {
      code: 'ERR_SCHROEDER_SPATIAL_REACTION_PLACEMENT_EPOCH_FINALIZATION'
    }
  );
  assert.equal(
    releaseSchroederSpatialReactionPlacementSourceFamilyAfterQueue(family, {
      abandon: true
    }),
    true
  );
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(
    schroederSpatialReactionPlacementSourceFamilyLiveness(family).releaseStatus,
    'released-after-final-consumer'
  );
  assert.equal(family.placedDestinationStateBuffer.destroyCount, 1);
  assert.equal(family.placedDestinationThermoBuffer.destroyCount, 1);
  assert.equal(family.placedDestinationMechanicsBuffer.destroyCount, 1);
});

test('device loss cleans up placement resources without quarantining the borrowed generation', async () => {
  const fx = fixture();
  const runners = injectedRunners(fx);
  const family = await runSchroederSpatialReactionPlacementEpochWebGpu({
    device: fx.device,
    ancestorPublicGeneration: fx.ancestor,
    sphParticleState: fx.sphParticleState,
    mlsMpmParticleState: fx.mlsMpmParticleState,
    sphParticleUpload: fx.sphParticleUpload,
    frozenSourceStateBuffer: fx.frozenState,
    frozenSourceThermoBuffer: fx.frozenThermo,
    frozenSourceMechanicsBuffer: fx.frozenMechanics,
    positionInvariantCertificate: fx.positionInvariantCertificate,
    ...runners
  });

  fx.lost.resolve({ message: 'test device loss' });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(
    schroederSpatialReactionPlacementSourceFamilyLiveness(family)
      .deviceLossStatus,
    'device-loss-cleanup-completed'
  );
  assert.equal(family.placedDestinationStateBuffer.destroyCount, 1);
  assert.equal(family.placedDestinationThermoBuffer.destroyCount, 1);
  assert.equal(family.placedDestinationMechanicsBuffer.destroyCount, 1);
  assert.equal(
    runners.calls.filter(([kind]) => kind === 'quarantine').length,
    0
  );
});

function acquireReactionWarmArena(device, overrides = {}) {
  return acquireSphReactionWarmArenaWebGpu({
    device,
    particleCapacity: 2,
    productEventCapacity: 2,
    productTermCapacity: 1,
    packedParticleStrideFloats: 52,
    productEventStrideFloats: 32,
    productPlacementSummaryStrideFloats: 32,
    ...overrides
  });
}

test('reaction warm arena cold allocation becomes zero-create warm reuse and destroys exactly once', async () => {
  const fx = fakeDevice();
  const cold = acquireReactionWarmArena(fx.device);
  const arena = resolveSphReactionWarmArenaLease(cold, {
    device: fx.device,
    particleCapacity: 2,
    productEventCapacity: 2,
    productTermCapacity: 1
  });
  assert.ok(cold.bufferCreationCount > 0);
  assert.equal(cold.warmReuse, false);
  assert.deepEqual(
    Object.keys(arena.buffers).sort(),
    [
      'fallbackMechanics',
      'fallbackState',
      'fallbackThermo',
      'packedOutput',
      'packedSource',
      'placedMechanics',
      'placedState',
      'placedThermo',
      'productEvent',
      'productPlacementSummary',
      'reactionParams',
      'resolvedMechanics',
      'resolvedState',
      'resolvedThermo',
      'summaryParams'
    ]
  );
  assert.equal(
    Object.values(arena.buffers).some((resource) => (resource.usage & 1) !== 0),
    false,
    'normal warm arena must not allocate MAP_READ buffers'
  );
  const coldCreateCount = fx.buffers.length;
  assert.equal(
    await releaseSphReactionWarmArenaAfterQueue(cold, {
      device: fx.device,
      completionFence: Promise.resolve()
    }),
    true
  );
  const warm = acquireReactionWarmArena(fx.device);
  assert.equal(warm.arena, arena);
  assert.equal(warm.bufferCreationCount, 0);
  assert.equal(warm.warmReuse, true);
  assert.equal(fx.buffers.length, coldCreateCount);
  assert.equal(discardSphReactionWarmArenaLease(warm, { device: fx.device }), true);
  assert.equal(destroySphReactionWarmArenaWebGpu(arena), true);
  assert.equal(destroySphReactionWarmArenaWebGpu(arena), false);
  for (const resource of Object.values(arena.buffers)) {
    assert.equal(resource.destroyCount, 1);
  }
});

test('reaction warm arena enforces bounded overlap and queue-fenced reuse', async () => {
  const fx = fakeDevice();
  const leases = [
    acquireReactionWarmArena(fx.device),
    acquireReactionWarmArena(fx.device),
    acquireReactionWarmArena(fx.device)
  ];
  assert.equal(new Set(leases.map((lease) => lease.arena)).size, 3);
  assert.throws(
    () => acquireReactionWarmArena(fx.device),
    {
      code:
        'ERR_SCHROEDER_SPATIAL_REACTION_PLACEMENT_EPOCH_WARM_ARENA_BACKPRESSURE'
    }
  );
  const fence = deferred();
  const releasePromise = releaseSphReactionWarmArenaAfterQueue(leases[0], {
    device: fx.device,
    completionFence: fence.promise
  });
  assert.throws(
    () => acquireReactionWarmArena(fx.device),
    {
      code:
        'ERR_SCHROEDER_SPATIAL_REACTION_PLACEMENT_EPOCH_WARM_ARENA_BACKPRESSURE'
    }
  );
  fence.resolve();
  assert.equal(await releasePromise, true);
  const recovered = acquireReactionWarmArena(fx.device);
  assert.equal(recovered.arena, leases[0].arena);
  assert.equal(recovered.bufferCreationCount, 0);
  for (const lease of [leases[1], leases[2], recovered]) {
    assert.equal(discardSphReactionWarmArenaLease(lease, { device: fx.device }), true);
  }
  for (const arena of new Set(leases.map((lease) => lease.arena))) {
    assert.equal(destroySphReactionWarmArenaWebGpu(arena), true);
  }
});

test('reaction warm arena carries 128 sequential resident substeps through bounded queue backpressure without post-warmup allocation', async () => {
  const fx = fakeDevice();
  const pending = [];
  const arenas = new Set();
  const releasePromises = [];
  let warmupCreateCount = null;

  for (let substep = 0; substep < 128; substep += 1) {
    const acquisition = acquireSphReactionWarmArenaWithBackpressureWebGpu({
      device: fx.device,
      particleCapacity: 684,
      productEventCapacity: 1368,
      productTermCapacity: 2,
      packedParticleStrideFloats: 52,
      productEventStrideFloats: 32,
      productPlacementSummaryStrideFloats: 32
    });
    if (pending.length === 3) {
      // This matches the production resident loop: each completed JS substep
      // has already scheduled its exact queue release, while GPU completion
      // may trail the fourth and later sequential acquisitions.
      pending.shift().resolve();
    }
    const lease = await acquisition;
    arenas.add(lease.arena);
    if (substep === 2) warmupCreateCount = fx.buffers.length;
    if (substep >= 3) {
      assert.equal(lease.bufferCreationCount, 0, `substep ${substep}`);
      assert.equal(fx.buffers.length, warmupCreateCount, `substep ${substep}`);
    }
    const completion = deferred();
    pending.push(completion);
    releasePromises.push(releaseSphReactionWarmArenaAfterQueue(lease, {
      device: fx.device,
      completionFence: completion.promise
    }));
  }

  assert.equal(arenas.size, 3);
  assert.equal(warmupCreateCount, 3 * 15);
  for (const completion of pending) completion.resolve();
  assert.deepEqual(
    await Promise.all(releasePromises),
    new Array(128).fill(true)
  );
  for (const arena of arenas) {
    assert.equal(sphReactionWarmArenaStats(arena).status, 'idle');
    assert.equal(destroySphReactionWarmArenaWebGpu(arena), true);
  }
});

test('reaction warm arena capacity growth is isolated and warms independently', () => {
  const fx = fakeDevice();
  const small = acquireReactionWarmArena(fx.device);
  assert.equal(discardSphReactionWarmArenaLease(small, { device: fx.device }), true);
  const grown = acquireReactionWarmArena(fx.device, {
    particleCapacity: 4,
    productEventCapacity: 8,
    productTermCapacity: 2
  });
  assert.notEqual(grown.arena, small.arena);
  assert.ok(grown.bufferCreationCount > 0);
  assert.equal(discardSphReactionWarmArenaLease(grown, { device: fx.device }), true);
  const grownWarm = acquireReactionWarmArena(fx.device, {
    particleCapacity: 4,
    productEventCapacity: 8,
    productTermCapacity: 2
  });
  assert.equal(grownWarm.arena, grown.arena);
  assert.equal(grownWarm.bufferCreationCount, 0);
  assert.equal(discardSphReactionWarmArenaLease(grownWarm, { device: fx.device }), true);
  assert.equal(destroySphReactionWarmArenaWebGpu(small.arena), true);
  assert.equal(destroySphReactionWarmArenaWebGpu(grown.arena), true);
});

test('reaction warm arena allocation exception rolls back every partial buffer', () => {
  const fx = fakeDevice();
  const createBuffer = fx.device.createBuffer.bind(fx.device);
  let createCount = 0;
  fx.device.createBuffer = (descriptor) => {
    createCount += 1;
    if (createCount === 5) throw new Error('intentional warm arena allocation failure');
    return createBuffer(descriptor);
  };
  assert.throws(
    () => acquireReactionWarmArena(fx.device),
    /intentional warm arena allocation failure/
  );
  assert.equal(fx.buffers.length, 4);
  assert.deepEqual(fx.buffers.map((resource) => resource.destroyCount), [1, 1, 1, 1]);
});

test('reaction warm arena fence rejection quarantines and destroys the slot', async () => {
  const fx = fakeDevice();
  const lease = acquireReactionWarmArena(fx.device);
  const fence = deferred();
  const releasePromise = releaseSphReactionWarmArenaAfterQueue(lease, {
    device: fx.device,
    completionFence: fence.promise
  });
  fence.reject(new Error('intentional reaction warm fence rejection'));
  assert.equal(await releasePromise, false);
  const stats = sphReactionWarmArenaStats(lease.arena);
  assert.equal(stats.status, 'destroyed');
  assert.equal(stats.terminal, true);
  for (const resource of Object.values(lease.arena.buffers)) {
    assert.equal(resource.destroyCount, 1);
  }
});

test('reaction warm arena device loss quarantines in-flight buffers exactly once', async () => {
  const fx = fakeDevice();
  const lease = acquireReactionWarmArena(fx.device);
  fx.lost.resolve({ message: 'intentional reaction warm device loss' });
  await Promise.resolve();
  await Promise.resolve();
  const stats = sphReactionWarmArenaStats(lease.arena);
  assert.equal(stats.status, 'destroyed');
  assert.equal(stats.deviceLost, true);
  assert.equal(destroySphReactionWarmArenaWebGpu(lease.arena), false);
  for (const resource of Object.values(lease.arena.buffers)) {
    assert.equal(resource.destroyCount, 1);
  }
});

test('shared-directory placement transfers warm destinations and returns them only after both owner fences', async () => {
  const fx = fixture();
  const lease = acquireReactionWarmArena(fx.device);
  const arena = resolveSphReactionWarmArenaLease(lease, {
    device: fx.device,
    particleCapacity: fx.particleCount,
    productEventCapacity: 2,
    productTermCapacity: 1
  });
  const certificate = createSphReactionResolvePositionInvariantCertificate({
    device: fx.device,
    ancestorGeneration: fx.ancestor,
    reactionInputStateBuffer: fx.reactionInputState,
    frozenResolvedStateBuffer: arena.buffers.resolvedState,
    particleCount: fx.particleCount
  });
  const runners = injectedRunners(fx);
  const family = await runSchroederSpatialReactionPlacementEpochWebGpu({
    device: fx.device,
    ancestorPublicGeneration: fx.ancestor,
    sphParticleState: fx.sphParticleState,
    mlsMpmParticleState: fx.mlsMpmParticleState,
    sphParticleUpload: fx.sphParticleUpload,
    frozenSourceStateBuffer: arena.buffers.resolvedState,
    frozenSourceThermoBuffer: arena.buffers.resolvedThermo,
    frozenSourceMechanicsBuffer: arena.buffers.resolvedMechanics,
    positionInvariantCertificate: certificate,
    reactionWarmArenaLease: lease,
    ...runners
  });
  assert.equal(family.placedDestinationStateBuffer, arena.buffers.placedState);
  assert.equal(family.placedDestinationThermoBuffer, arena.buffers.placedThermo);
  assert.equal(family.placedDestinationMechanicsBuffer, arena.buffers.placedMechanics);
  const sourceThermoBuffer = buffer(
    fx.device,
    'warm-transfer-source-thermo',
    fx.thermoBytes
  );
  const { placementArtifact } = submitGenuineResidentPlacement(fx, family, {
    sourceStateBuffer: fx.reactionInputState,
    sourceThermoBuffer,
    labelPrefix: 'warm-transfer-placement'
  });
  await finalizeSchroederSpatialReactionPlacementPositionEpochFloor(family, {
    placementArtifact
  });
  assert.equal(
    releaseSchroederSpatialReactionPlacementSourceFamilyAfterQueue(family, {
      placementArtifact
    }),
    true
  );
  assert.equal(
    transferSchroederSpatialReactionPlacementDestinationOwnership(family),
    true
  );
  assert.equal(sphReactionWarmArenaStats(arena).inFlight, true);
  assert.throws(
    () => releaseSphReactionWarmArenaAfterQueue(lease, {
      device: fx.device,
      completionFence: Promise.resolve()
    }),
    {
      code:
        'ERR_SCHROEDER_SPATIAL_REACTION_PLACEMENT_EPOCH_WARM_ARENA_OWNERSHIP'
    },
    'only the exact transferred placement destination owner may return the arena'
  );
  assert.equal(
    await releaseSchroederSpatialReactionPlacementTransferredDestinationOwnershipAfterQueue(
      family,
      { completionFence: Promise.resolve() }
    ),
    true
  );
  assert.equal(sphReactionWarmArenaStats(arena).status, 'idle');
  assert.equal(arena.buffers.placedState.destroyCount, 0);
  assert.equal(arena.buffers.placedThermo.destroyCount, 0);
  assert.equal(arena.buffers.placedMechanics.destroyCount, 0);
  const warm = acquireReactionWarmArena(fx.device);
  assert.equal(warm.arena, arena);
  assert.equal(warm.bufferCreationCount, 0);
  assert.equal(discardSphReactionWarmArenaLease(warm, { device: fx.device }), true);
  assert.equal(destroySphReactionWarmArenaWebGpu(arena), true);
});
