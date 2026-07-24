import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SCHROEDER_SPATIAL_EXACT_NEAR_EXPECTATION_V1_LAYOUT,
  SCHROEDER_SPATIAL_EXACT_NEAR_EXPECTATION_V1_PAYLOAD_WORDS,
  SCHROEDER_SPATIAL_EXACT_NEAR_EXPECTATION_V1_UNIFORM_BYTES,
  SCHROEDER_SPATIAL_EXACT_NEAR_EXPECTATION_V1_UNIFORM_WORDS,
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_IDS,
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_PRESSURE_CONTACT_V1,
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_DISCOVERY_V1,
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_PRODUCT_PLACEMENT_V1,
  ULG_SCHROEDER_SPATIAL_EPOCH_CONSUMER_RECEIPT_SCHEMA,
  ULG_SCHROEDER_SPATIAL_EXACT_NEAR_GPU_EVIDENCE_SCHEMA,
  ULG_SCHROEDER_SPATIAL_SUPPORT_PROFILE_SCHEMA,
  createSchroederSpatialExactNearExpectationV1Data,
  createSchroederSpatialSupportProfileDescriptor,
  resolveSchroederSpatialSupportProfileContract,
  validateSchroederSpatialSupportProfileDescriptor
} from '../ulg-gpu-abi/src/schroederSpatialExactNear.js';
import {
  SCHROEDER_SPATIAL_EXACT_NEAR_TRAVERSAL_WGSL_ABI,
  createSchroederSpatialExactNearTraversalV1Wgsl,
  schroederSpatialExactNearTraversalV1Wgsl
} from '../ulg-gpu-abi/src/schroederSpatialExactNearTraversalWgsl.js';
import {
  sphPressureInterfaceSpatialExactNearContactKinematicsWgsl
} from '../ulg-gpu-abi/src/schroederSpatialExactNearWgsl.js';
import {
  finalizeSchroederSpatialExactNearConsumerReceipt,
  isFinalizedSchroederSpatialExactNearConsumerReceipt,
  releaseSchroederSpatialEpochGenerationAfterQueue,
  resolveSchroederSpatialExactNearConsumerGeneration,
  runSchroederSpatialEpochGenerationWebGpu
} from '../src/runtime/sph/schroederSpatialEpochGpu.js';

function createFakeEncoder() {
  const events = [];
  return {
    events,
    clearBuffer(buffer, offset = 0, size = null) {
      events.push({ kind: 'clear', label: buffer.label, offset, size });
    },
    beginComputePass(descriptor = {}) {
      const event = { kind: 'pass', descriptor, commands: [] };
      events.push(event);
      let pipeline = null;
      let bindGroup = null;
      return {
        setPipeline(value) { pipeline = value.label; },
        setBindGroup(index, value) { bindGroup = { index, label: value.label }; },
        dispatchWorkgroups(x, y = 1, z = 1) {
          event.commands.push({ pipeline, bindGroup, dispatch: [x, y, z] });
        },
        dispatchWorkgroupsIndirect(buffer, byteOffset = 0) {
          event.commands.push({
            pipeline,
            bindGroup,
            dispatchIndirect: { label: buffer.label, byteOffset }
          });
        },
        end() { event.ended = true; }
      };
    },
    finish() { return { label: 'fake-command-buffer', events }; }
  };
}

function createFakeDevice() {
  const buffers = [];
  const device = {
    buffers,
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
      const buffer = {
        ...descriptor,
        destroyed: false,
        destroy() { this.destroyed = true; }
      };
      buffers.push(buffer);
      return buffer;
    },
    createShaderModule(descriptor) { return descriptor; },
    createComputePipeline(descriptor) {
      return {
        ...descriptor,
        getBindGroupLayout(index) {
          return { pipeline: descriptor.label, entryPoint: descriptor.compute.entryPoint, index };
        }
      };
    },
    createBindGroup(descriptor) { return descriptor; },
    createCommandEncoder() { return createFakeEncoder(); }
  };
  return device;
}

function createActiveNodeList(device) {
  const activeNodeBuffer = device.createBuffer({
    label: 'exact-near-foundation-source',
    size: 2 * 16 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
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

test('exact-near support profiles have stable versioned IDs and a 112-byte expectation ABI', () => {
  assert.deepEqual(SCHROEDER_SPATIAL_SUPPORT_PROFILE_IDS, [
    0x0001_0001,
    0x0001_0002,
    0x0001_0003,
    0x0001_0004,
    0x0001_0005,
    0x0001_0006,
    0x0001_0007
  ]);
  const pressure = resolveSchroederSpatialSupportProfileContract(
    SCHROEDER_SPATIAL_SUPPORT_PROFILE_PRESSURE_CONTACT_V1
  );
  assert.equal(pressure.schema, ULG_SCHROEDER_SPATIAL_SUPPORT_PROFILE_SCHEMA);
  assert.equal(pressure.version, 1);
  assert.equal(pressure.artifactFamily, 'spatial-exact-near-pressure-contact-interface');
  assert.equal(pressure.phase, 'pressure-contact-proposal');
  assert.equal(Object.isFrozen(pressure), true);
  const placement = resolveSchroederSpatialSupportProfileContract(
    SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_PRODUCT_PLACEMENT_V1
  );
  assert.equal(placement.consumerFamily, 'reaction-product-placement');
  assert.equal(
    placement.artifactFamily,
    'spatial-exact-near-reaction-product-placement'
  );
  assert.equal(placement.phase, 'reaction-product-placement-proposal');

  const descriptor = createSchroederSpatialSupportProfileDescriptor({
    supportProfileId: pressure.id,
    supportEpoch: 31,
    sourceCount: 2
  });
  assert.equal(validateSchroederSpatialSupportProfileDescriptor(descriptor, {
    supportProfileId: pressure.id,
    supportEpoch: 31
  }).admitted, true);
  assert.equal(validateSchroederSpatialSupportProfileDescriptor(descriptor, {
    supportProfileId: SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_DISCOVERY_V1
  }).admitted, false);

  assert.equal(SCHROEDER_SPATIAL_EXACT_NEAR_EXPECTATION_V1_LAYOUT.length, 27);
  assert.equal(SCHROEDER_SPATIAL_EXACT_NEAR_EXPECTATION_V1_PAYLOAD_WORDS, 27);
  assert.equal(SCHROEDER_SPATIAL_EXACT_NEAR_EXPECTATION_V1_UNIFORM_WORDS, 28);
  assert.equal(SCHROEDER_SPATIAL_EXACT_NEAR_EXPECTATION_V1_UNIFORM_BYTES, 112);
  const data = createSchroederSpatialExactNearExpectationV1Data({
    sourceCount: 2,
    supportProfileId: pressure.id,
    chartId: 7,
    levelCount: 3,
    generationId: 5,
    deviceOrdinal: 6,
    laneOrdinal: 7,
    leaseToken: 8,
    sourceFamilyId: 9,
    storageGeneration: 10,
    physicsTick: 11,
    physicsSubstep: 12,
    positionEpoch: 13,
    topologyEpoch: 14,
    chartEpoch: 15,
    levelEpoch: 16,
    supportEpoch: 17,
    minLevel: -2,
    baseGridSpacingM: 0.125,
    cellKeysOffsetWords: 48,
    cellOffsetsOffsetWords: 88,
    cellMembersOffsetWords: 97,
    particleToCellOffsetWords: 105,
    directoryCapacityWords: 119,
    sourceCapacity: 8,
    cellCapacity: 8
  });
  assert.equal(data.byteLength, 112);
  assert.deepEqual(Array.from(data.slice(0, 5)), [2, 1, pressure.id, 7, 3]);
  assert.equal(new Int32Array(data.buffer)[18], -2);
  assert.equal(new Float32Array(data.buffer)[19], 0.125);
  assert.equal(data[27], 0);
  assert.throws(
    () => createSchroederSpatialExactNearExpectationV1Data({
      ...Object.fromEntries(
        SCHROEDER_SPATIAL_EXACT_NEAR_EXPECTATION_V1_LAYOUT.map((field) => [
          field.split(':')[0],
          0
        ])
      ),
      sourceCount: 2,
      supportProfileId: 99
    }),
    /unsupported/
  );
});

test('law-neutral WGSL owns v1 admission, signed traversal, and fail-closed CSR lookup', () => {
  assert.equal(SCHROEDER_SPATIAL_EXACT_NEAR_TRAVERSAL_WGSL_ABI.version, 1);
  assert.match(schroederSpatialExactNearTraversalV1Wgsl, /struct SchroederSpatialExactNearExpectationV1/);
  assert.match(schroederSpatialExactNearTraversalV1Wgsl, /fn ss_exact_near_directory_admitted/);
  assert.match(schroederSpatialExactNearTraversalV1Wgsl, /fn ss_exact_near_signed_order_key/);
  assert.match(schroederSpatialExactNearTraversalV1Wgsl, /fn ss_exact_near_cell_range/);
  assert.match(schroederSpatialExactNearTraversalV1Wgsl,
    /fn ss_exact_near_lower_bound_cell_key_range/);
  assert.match(schroederSpatialExactNearTraversalV1Wgsl,
    /fn ss_exact_near_upper_bound_cell_key_range/);
  assert.match(schroederSpatialExactNearTraversalV1Wgsl, /fn ss_exact_near_source_at_member/);
  assert.match(schroederSpatialExactNearTraversalV1Wgsl, /fn ss_exact_near_level_occupied/);
  assert.match(schroederSpatialExactNearTraversalV1Wgsl, /occupied_level_mask_low/);
  assert.match(schroederSpatialExactNearTraversalV1Wgsl, /return SchroederSpatialExactNearSourceLookupV1\(0u, 0u\)/);
  const renamed = createSchroederSpatialExactNearTraversalV1Wgsl({
    directoryBindingName: 'law_directory'
  });
  assert.match(renamed, /arrayLength\(&law_directory\)/);
  assert.doesNotMatch(renamed, /arrayLength\(&spatial_directory\)/);
  assert.throws(
    () => createSchroederSpatialExactNearTraversalV1Wgsl({
      directoryBindingName: 'invalid-name'
    }),
    /WGSL identifier/
  );
  assert.match(
    sphPressureInterfaceSpatialExactNearContactKinematicsWgsl,
    /ss_exact_near_directory_admitted\(ss_exact_near_expectation\(\)\)/
  );
  assert.match(
    sphPressureInterfaceSpatialExactNearContactKinematicsWgsl,
    /ss_exact_near_cell_member_range/
  );
  assert.doesNotMatch(
    sphPressureInterfaceSpatialExactNearContactKinematicsWgsl,
    /const SPATIAL_MAGIC/
  );
});

test('runtime defaults to one traversal and admits an authenticated two-traversal receipt', async () => {
  const device = createFakeDevice();
  const activeNodeList = createActiveNodeList(device);
  const generation = runSchroederSpatialEpochGenerationWebGpu({
    device,
    activeNodeList,
    particleCount: 2
  });
  assert.equal(generation.selected, true);

  const authentication = resolveSchroederSpatialExactNearConsumerGeneration(
    generation,
    {
      device,
      consumerId: 'pressure-contact',
      supportProfileId: SCHROEDER_SPATIAL_SUPPORT_PROFILE_PRESSURE_CONTACT_V1,
      sourceBuffer: activeNodeList.activeNodeBuffer,
      expected: {
        generationId: generation.execution.generationId,
        positionEpoch: 17,
        topologyEpoch: 19,
        supportEpoch: 31
      }
    }
  );
  assert.equal(authentication.authenticated, true);
  assert.equal(authentication.gpuAuthenticated, false);
  assert.equal(authentication.expectedTraversalCount, 1);
  assert.equal(authentication.expectationData.byteLength, 112);
  assert.equal(authentication.expectationData[0], 2);
  assert.equal(
    authentication.expectationData[2],
    SCHROEDER_SPATIAL_SUPPORT_PROFILE_PRESSURE_CONTACT_V1
  );
  assert.equal(authentication.sourceBuffer, activeNodeList.activeNodeBuffer);
  assert.equal(authentication.directoryBuffer, generation.execution.directoryBuffer);
  assert.equal(authentication.receipt.schema, ULG_SCHROEDER_SPATIAL_EPOCH_CONSUMER_RECEIPT_SCHEMA);
  assert.equal(authentication.receipt.expectedTraversalCount, 1);
  assert.equal(authentication.receipt.traversalCount, 0);

  const foreignDevice = createFakeDevice();
  assert.equal(resolveSchroederSpatialExactNearConsumerGeneration(generation, {
    device: foreignDevice,
    consumerId: 'pressure-contact',
    supportProfileId: SCHROEDER_SPATIAL_SUPPORT_PROFILE_PRESSURE_CONTACT_V1
  }).status, 'schroeder-spatial-consumer-authentication-rejected-device');
  assert.equal(resolveSchroederSpatialExactNearConsumerGeneration(generation, {
    device,
    consumerId: 'pressure-contact',
    supportProfileId: SCHROEDER_SPATIAL_SUPPORT_PROFILE_PRESSURE_CONTACT_V1,
    expected: { positionEpoch: 18 }
  }).field, 'positionEpoch');
  assert.equal(resolveSchroederSpatialExactNearConsumerGeneration(generation, {
    device,
    consumerId: 'pressure-contact',
    supportProfileId: 99
  }).admitted, false);

  const gpuEvidence = {
    schema: ULG_SCHROEDER_SPATIAL_EXACT_NEAR_GPU_EVIDENCE_SCHEMA,
    status: 'schroeder-spatial-exact-near-gpu-authenticated',
    gpuAuthenticated: true,
    consumerId: authentication.consumerId,
    supportProfileId: authentication.supportProfileId,
    generationId: authentication.generationId,
    epochIdentity: authentication.epochIdentity,
    traversalCount: 1,
    candidateVisitCount: 12,
    consumerMaskHitCount: 4,
    migratedProposalCount: 2,
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
    fullReadbackPerformed: false
  };
  assert.throws(
    () => finalizeSchroederSpatialExactNearConsumerReceipt(
      authentication,
      { ...gpuEvidence, traversalCount: 2 }
    ),
    /expected traversal count of 1/
  );
  assert.throws(
    () => finalizeSchroederSpatialExactNearConsumerReceipt(
      authentication,
      {
        ...gpuEvidence,
        candidateBytesRequired: 32,
        candidateBytesCapacity: 16,
        candidateBytesAdmitted: 16,
        candidateOverflowBytes: 16
      }
    ),
    /fail-closed residency invariants/
  );
  const finalized = finalizeSchroederSpatialExactNearConsumerReceipt(
    authentication,
    gpuEvidence
  );
  assert.equal(finalized.gpuAuthenticated, true);
  assert.equal(finalized.expectedTraversalCount, 1);
  assert.equal(finalized.traversalCount, 1);
  assert.equal(finalized.candidateVisitCount, 12);
  assert.equal(finalized.privateLookupBuildCount, 0);
  assert.equal(Object.isFrozen(finalized), true);
  assert.equal(isFinalizedSchroederSpatialExactNearConsumerReceipt(finalized), true);
  assert.equal(isFinalizedSchroederSpatialExactNearConsumerReceipt({ ...finalized }), false);
  assert.equal(
    finalizeSchroederSpatialExactNearConsumerReceipt(authentication, gpuEvidence),
    finalized
  );
  assert.throws(
    () => finalizeSchroederSpatialExactNearConsumerReceipt(
      { ...authentication },
      gpuEvidence
    ),
    /not issued/
  );

  const twoTraversalAuthentication =
    resolveSchroederSpatialExactNearConsumerGeneration(generation, {
      device,
      consumerId: 'reaction-discovery-two-pass',
      supportProfileId: SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_DISCOVERY_V1,
      sourceBuffer: activeNodeList.activeNodeBuffer,
      expectedTraversalCount: 2
    });
  assert.equal(twoTraversalAuthentication.authenticated, true);
  assert.equal(twoTraversalAuthentication.expectedTraversalCount, 2);
  assert.equal(twoTraversalAuthentication.receipt.expectedTraversalCount, 2);
  const twoTraversalEvidence = {
    ...gpuEvidence,
    consumerId: twoTraversalAuthentication.consumerId,
    supportProfileId: twoTraversalAuthentication.supportProfileId,
    epochIdentity: twoTraversalAuthentication.epochIdentity,
    traversalCount: 2
  };
  assert.throws(
    () => finalizeSchroederSpatialExactNearConsumerReceipt(
      twoTraversalAuthentication,
      { ...twoTraversalEvidence, traversalCount: 1 }
    ),
    /expected traversal count of 2/
  );
  const twoTraversalReceipt = finalizeSchroederSpatialExactNearConsumerReceipt(
    twoTraversalAuthentication,
    twoTraversalEvidence
  );
  assert.equal(twoTraversalReceipt.expectedTraversalCount, 2);
  assert.equal(twoTraversalReceipt.traversalCount, 2);
  assert.equal(
    isFinalizedSchroederSpatialExactNearConsumerReceipt(twoTraversalReceipt),
    true
  );

  assert.equal(resolveSchroederSpatialExactNearConsumerGeneration(generation, {
    device,
    consumerId: 'invalid-traversal-contract',
    supportProfileId: SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_DISCOVERY_V1,
    expectedTraversalCount: 0
  }).status, 'schroeder-spatial-consumer-authentication-rejected-traversal-contract');

  assert.equal(releaseSchroederSpatialEpochGenerationAfterQueue(generation, device), true);
  assert.equal(await generation.releasePromise, true);
  assert.equal(resolveSchroederSpatialExactNearConsumerGeneration(generation, {
    device,
    consumerId: 'late-consumer',
    supportProfileId: SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_DISCOVERY_V1
  }).admitted, false);
});
