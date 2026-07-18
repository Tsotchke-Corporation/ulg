import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_UNIQUE_STATUS_READY,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_ADMITTED,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_READY
} from '../ulg-gpu-abi/src/schroederSpatialMechanicsFieldView.js';
import {
  schroederSpatialMechanicsFieldViewWgsl
} from '../ulg-gpu-abi/src/schroederSpatialMechanicsFieldViewWgsl.js';
import {
  releaseSchroederSpatialEpochGenerationAfterQueue,
  runSchroederSpatialEpochGenerationWebGpu
} from '../src/runtime/sph/schroederSpatialEpochGpu.js';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_MECHANICS_FIELD_VIEW === '1';
const NATIVE_BASE_URL = process.env.ULG_MECHANICS_FIELD_VIEW_BASE_URL
  || 'https://127.0.0.1:5174/';

function duplicateGroupFromExclusiveHeadPrefix({
  exclusiveHeadPrefix,
  sortedPosition,
  elementCount,
  uniqueCount
}) {
  const inclusiveHeadCount = sortedPosition + 1 < elementCount
    ? exclusiveHeadPrefix[sortedPosition + 1]
    : uniqueCount;
  if (inclusiveHeadCount === 0) return null;
  return inclusiveHeadCount - 1;
}

function createFakeEncoder() {
  const events = [];
  return {
    events,
    clearBuffer(buffer, offset = 0, size = null) {
      events.push({ kind: 'clear', buffer, offset, size });
    },
    beginComputePass(descriptor = {}) {
      const event = { kind: 'pass', descriptor, commands: [] };
      events.push(event);
      let pipeline = null;
      let bindGroup = null;
      return {
        setPipeline(value) { pipeline = value; },
        setBindGroup(index, value) { bindGroup = { index, value }; },
        dispatchWorkgroups(x, y = 1, z = 1) {
          event.commands.push({ pipeline, bindGroup, dispatch: [x, y, z] });
        },
        dispatchWorkgroupsIndirect(buffer, byteOffset = 0) {
          event.commands.push({ pipeline, bindGroup, dispatchIndirect: { buffer, byteOffset } });
        },
        end() { event.ended = true; }
      };
    },
    finish() { return { label: 'mechanics-field-test-command-buffer', events }; }
  };
}

function createFakeDevice() {
  const buffers = [];
  const bindGroups = [];
  const submissions = [];
  const encoders = [];
  const writes = [];
  const device = {
    buffers,
    bindGroups,
    submissions,
    encoders,
    writes,
    limits: {
      maxBufferSize: 256 * 1024 * 1024,
      maxStorageBufferBindingSize: 128 * 1024 * 1024,
      maxUniformBufferBindingSize: 64 * 1024,
      maxStorageBuffersPerShaderStage: 10,
      maxComputeWorkgroupsPerDimension: 65535,
      minUniformBufferOffsetAlignment: 256
    },
    queue: {
      writeBuffer(buffer, offset, data) {
        const bytes = ArrayBuffer.isView(data)
          ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
          : new Uint8Array(data);
        writes.push({
          buffer,
          offset,
          data: bytes.slice()
        });
      },
      submit(commandBuffers) { submissions.push(commandBuffers); },
      onSubmittedWorkDone() { return Promise.resolve(); }
    },
    createBuffer(descriptor) {
      const buffer = {
        ...descriptor,
        destroyed: false,
        destroyCount: 0,
        destroy() {
          this.destroyed = true;
          this.destroyCount += 1;
        }
      };
      buffers.push(buffer);
      return buffer;
    },
    createShaderModule(descriptor) { return descriptor; },
    createComputePipeline(descriptor) {
      return {
        ...descriptor,
        getBindGroupLayout(index) {
          return {
            pipeline: descriptor.label,
            entryPoint: descriptor.compute.entryPoint,
            index
          };
        }
      };
    },
    createBindGroup(descriptor) {
      bindGroups.push(descriptor);
      return descriptor;
    },
    createCommandEncoder() {
      const encoder = createFakeEncoder();
      encoders.push(encoder);
      return encoder;
    }
  };
  return device;
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createLevelAssignment(device, particleCount = 4) {
  const assignmentBuffer = device.createBuffer({
    label: 'mechanics-field-level-assignment-source',
    size: particleCount * 16 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const sourceStateBuffer = device.createBuffer({
    label: 'mechanics-field-state-source',
    size: particleCount * 8 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  return {
    schema: 'peercompute.ulg.schroeder-level-assignment-execution.v0',
    status: 'schroeder-level-assignment-submitted',
    bufferFamilyGenerationStatus:
      'schroeder-particle-buffer-family-generation-ready',
    particleCount,
    assignmentStrideFloats: 16,
    assignmentBuffer,
    assignmentBufferByteLength: assignmentBuffer.size,
    sourceStateBuffer,
    sourceStateBufferBorrowed: true,
    storageGeneration: 11,
    physicsTick: 13,
    physicsSubstep: 0,
    positionEpoch: 17,
    topologyEpoch: 19,
    chartEpoch: 23,
    levelEpoch: 29,
    supportEpoch: 31,
    minLevel: 0,
    maxLevel: 0,
    chartId: 0,
    baseGridSpacingM: 0.25
  };
}

function createSubmittedMechanicsFieldGeneration(device, particleCount = 4) {
  const levelAssignment = createLevelAssignment(device, particleCount);
  const identityBuffer = device.createBuffer({
    label: 'mechanics-field-identity-source',
    size: particleCount * Uint32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const generation = runSchroederSpatialEpochGenerationWebGpu({
    device,
    levelAssignment,
    particleCount,
    particleIdentityBuffer: identityBuffer,
    particleIdentityStrideWords: 1,
    selectedLevel: 0,
    mechanicsGrid: {
      gridNodeCount: 13 * 13 * 13,
      gridDims: [13, 13, 13],
      gridShift: 1,
      gridSpacingM: 0.25
    }
  });
  return { generation, levelAssignment, identityBuffer };
}

test('mechanics-field duplicate candidates use the inclusive head count from an exclusive scan', () => {
  // Head flags [1, 0, 0, 1, 0, 1] produce this exclusive prefix. Every
  // member of a duplicate run must resolve to the same zero-based group.
  const exclusiveHeadPrefix = [0, 1, 1, 1, 2, 2];
  const groups = exclusiveHeadPrefix.map((_, sortedPosition) => (
    duplicateGroupFromExclusiveHeadPrefix({
      exclusiveHeadPrefix,
      sortedPosition,
      elementCount: exclusiveHeadPrefix.length,
      uniqueCount: 3
    })
  ));
  assert.deepEqual(groups, [0, 0, 0, 1, 1, 2]);

  assert.match(
    schroederSpatialMechanicsFieldViewWgsl,
    /var inclusive_head_count = unique_evidence\[2u\]/
  );
  assert.match(
    schroederSpatialMechanicsFieldViewWgsl,
    /sorted_position \+ 1u < params\.candidate_count[\s\S]*?unique_group_by_sorted_position\[sorted_position \+ 1u\]/
  );
  assert.match(
    schroederSpatialMechanicsFieldViewWgsl,
    /if \(inclusive_head_count == 0u\)[\s\S]*?let field_index = inclusive_head_count - 1u/
  );
  assert.doesNotMatch(
    schroederSpatialMechanicsFieldViewWgsl,
    /let field_index = unique_group_by_sorted_position\[sorted_position\]/
  );
});

test('packed mechanics-field scratch keys preserve public x4 order and fail closed at identity boundaries', () => {
  const materialMask = 0x00ff_ffff;
  const packIdentity = (family, material) => (
    (((family << 24) >>> 0) | material) >>> 0
  );
  const pack = ([node, family, material, domain]) => (
    [node, packIdentity(family, material), domain]
  );
  const compare = (left, right) => {
    for (let index = 0; index < left.length; index += 1) {
      if (left[index] !== right[index]) return left[index] - right[index];
    }
    return 0;
  };
  const publicKeys = [
    [9, 4, materialMask, 0],
    [9, 2, 1, 0],
    [8, 4, materialMask, 0],
    [9, 1, materialMask, 0xffff_ffff],
    [9, 3, 1, 0],
    [9, 2, materialMask, 0]
  ];
  const publicOrder = [...publicKeys].sort(compare);
  const packedOrder = [...publicKeys].sort((left, right) => compare(pack(left), pack(right)));

  assert.deepEqual(packedOrder, publicOrder);
  assert.ok(packIdentity(1, materialMask) < packIdentity(2, 1));
  assert.ok(packIdentity(2, materialMask) < packIdentity(3, 1));
  for (const [, family, material] of publicKeys) {
    const packed = packIdentity(family, material);
    assert.equal(packed >>> 24, family);
    assert.equal(packed & materialMask, material);
  }
  assert.ok(compare(pack(publicOrder.at(-1)), [0xffff_ffff, 0xffff_ffff, 0xffff_ffff]) < 0);

  const identityAdmitted = (family, material, domain) => (
    family >= 1 && family <= 4
      && material >= 1 && material <= materialMask
      && (family === 1 ? domain !== 0 : domain === 0)
  );
  assert.equal(identityAdmitted(1, materialMask, 0xffff_ffff), true);
  assert.equal(identityAdmitted(1, 1, 0), false);
  assert.equal(identityAdmitted(2, 1, 1), false);
  assert.equal(identityAdmitted(0, 1, 0), false);
  assert.equal(identityAdmitted(5, 1, 0), false);
  assert.equal(identityAdmitted(2, 0, 0), false);

  assert.match(schroederSpatialMechanicsFieldViewWgsl, /FIELD_RADIX_KEY_WORDS: u32 = 3u/);
  assert.match(
    schroederSpatialMechanicsFieldViewWgsl,
    /candidate_keys\[key \+ 1u\] = \(mechanical_family_id << 24u\) \| material_id/
  );
  assert.match(
    schroederSpatialMechanicsFieldViewWgsl,
    /mechanical_family_id >= 1u[\s\S]*mechanical_family_id <= 4u[\s\S]*material_id >= 1u[\s\S]*material_id <= FIELD_RADIX_MATERIAL_MASK/
  );
  assert.match(
    schroederSpatialMechanicsFieldViewWgsl,
    /select\([\s\S]*continuity_domain_id == 0u,[\s\S]*continuity_domain_id != 0u,[\s\S]*mechanical_family_id == 1u[\s\S]*\)/
  );
  assert.match(
    schroederSpatialMechanicsFieldViewWgsl,
    /if \(!identity_admitted\) \{[\s\S]*atomicAdd\(&field_view\[58u\], 1u\);[\s\S]*return;/
  );
  assert.match(
    schroederSpatialMechanicsFieldViewWgsl,
    /field_store\(destination_key, node_index\);[\s\S]*field_store\(destination_key \+ 3u, continuity_domain_id\);/
  );
});

test('mechanics-field stencil-map runtime binds unique evidence with the exclusive prefix', async () => {
  const device = createFakeDevice();
  const levelAssignment = createLevelAssignment(device);
  const identityBuffer = device.createBuffer({
    label: 'mechanics-field-identity-source',
    size: levelAssignment.particleCount * Uint32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const generation = runSchroederSpatialEpochGenerationWebGpu({
    device,
    levelAssignment,
    particleCount: levelAssignment.particleCount,
    particleIdentityBuffer: identityBuffer,
    particleIdentityStrideWords: 1,
    selectedLevel: 0,
    mechanicsGrid: {
      gridNodeCount: 13 * 13 * 13,
      gridDims: [13, 13, 13],
      gridShift: 1,
      gridSpacingM: 0.25
    }
  });

  assert.equal(generation.ready, true);
  assert.ok(generation.mechanicsFieldView);
  const stencilMap = device.bindGroups.find(({ label }) => (
    /mechanics-field-view.*stencil-map-bindings/.test(label)
      && !label.includes('-uniform-stencil-map-bindings')
  ));
  assert.ok(stencilMap, 'expected a mechanics-field stencil-map bind group');
  assert.deepEqual(stencilMap.entries.map(({ binding }) => binding), [2, 3, 5, 7, 8, 9]);
  const uniqueEvidence = stencilMap.entries.find(({ binding }) => binding === 5);
  const exclusivePrefix = stencilMap.entries.find(({ binding }) => binding === 9);
  assert.match(uniqueEvidence.resource.buffer.label, /radix-evidence$/);
  assert.match(exclusivePrefix.resource.buffer.label, /radix-head-offsets$/);
  assert.notEqual(uniqueEvidence.resource.buffer, exclusivePrefix.resource.buffer);

  const field = generation.mechanicsFieldView;
  const fieldRuntime = field.ownerRuntime;
  assert.deepEqual(fieldRuntime.stateMutationState(field), {
    ordinal: 0,
    encoding: SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY,
    operation: 'topology-ready',
    pending: false,
    publicationLocked: false,
    quarantined: false
  });
  const discarded = fieldRuntime.reserveStateMutation(field, {
    expectedOrdinal: 0,
    expectedEncoding: SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY,
    outputEncoding:
      SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT,
    operation: 'test-discarded-p2g'
  });
  assert.equal(fieldRuntime.stateMutationState(field).pending, true);
  assert.equal(
    fieldRuntime.isStateMutationReservationActive(field, discarded),
    true
  );
  assert.equal(
    fieldRuntime.isStateMutationReservationActive(field, { ...discarded }),
    false
  );
  assert.equal(fieldRuntime.discardStateMutation(discarded, {
    discardedEncoder: true
  }), true);
  assert.equal(
    fieldRuntime.isStateMutationReservationActive(field, discarded),
    false
  );
  assert.equal(field.stateMutationOrdinal, 0);
  const p2gMutation = fieldRuntime.reserveStateMutation(field, {
    expectedOrdinal: 0,
    expectedEncoding: SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY,
    outputEncoding:
      SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT,
    operation: 'test-p2g-submitted'
  });
  fieldRuntime.markStateMutationSubmitted(p2gMutation);
  assert.equal(fieldRuntime.isCurrentStateArtifact(field, {
    mutationOrdinal: 1,
    stateEncoding:
      SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT
  }), true);
  const gridMutation = fieldRuntime.reserveStateMutation(field, {
    expectedOrdinal: 1,
    expectedEncoding:
      SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT,
    outputEncoding:
      SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT,
    operation: 'test-grid-update-submitted'
  });
  fieldRuntime.markStateMutationSubmitted(gridMutation);
  assert.equal(fieldRuntime.isCurrentStateArtifact(field, {
    mutationOrdinal: 1,
    stateEncoding:
      SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT
  }), false);
  assert.equal(fieldRuntime.isCurrentStateArtifact(field, {
    mutationOrdinal: 2,
    stateEncoding:
      SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT
  }), true);

  const fused = fieldRuntime.reserveStateMutationSequence(field, {
    expectedOrdinal: 2,
    expectedEncoding:
      SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT,
    operation: 'test-fused-fine-substep',
    stages: [
      {
        outputEncoding:
          SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT,
        operation: 'test-fused-p2g'
      },
      {
        outputEncoding:
          SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT,
        operation: 'test-fused-grid-update'
      },
      {
        outputEncoding:
          SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT,
        operation: 'test-fused-fine-correction'
      }
    ]
  });
  assert.deepEqual(
    fused.stages.map((stage) => [
      stage.expectedOrdinal,
      stage.outputOrdinal,
      stage.expectedEncoding,
      stage.outputEncoding
    ]),
    [
      [2, 3,
        SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT,
        SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT],
      [3, 4,
        SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT,
        SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT],
      [4, 5,
        SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT,
        SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT]
    ]
  );
  assert.equal(fieldRuntime.stateMutationState(field).pending, true);
  assert.equal(fieldRuntime.isStateMutationSequenceSegmentReady(
    field,
    fused,
    fused.stages[0]
  ), true);
  assert.equal(fieldRuntime.isStateMutationSequenceSegmentReady(
    field,
    fused,
    { ...fused.stages[0] }
  ), false);
  assert.throws(
    () => fieldRuntime.completeStateMutationSequence(fused),
    (error) => error?.code
      === 'ERR_SCHROEDER_MECHANICS_FIELD_MUTATION_SEQUENCE_INCOMPLETE'
  );
  for (let stageIndex = 0; stageIndex < fused.stages.length; stageIndex += 1) {
    const stage = fused.stages[stageIndex];
    assert.equal(fieldRuntime.isStateMutationSequenceSegmentReady(
      field,
      fused,
      stage
    ), true);
    fieldRuntime.markStateMutationSequenceStageSubmissionObserved(fused, stage);
    assert.equal(fieldRuntime.isStateMutationSequenceSegmentReady(
      field,
      fused,
      stage
    ), false);
    assert.equal(fieldRuntime.isStateMutationSequenceStageSubmissionObserved(
      field,
      fused,
      stage
    ), true);
    fieldRuntime.markStateMutationSequenceStageSubmitted(fused, stage);
    assert.equal(fieldRuntime.isStateMutationSequenceSegmentSubmitted(
      field,
      fused,
      stage
    ), true);
    assert.throws(
      () => fieldRuntime.markStateMutationSequenceStageSubmitted(fused, stage),
      (error) => error?.code
        === 'ERR_SCHROEDER_MECHANICS_FIELD_MUTATION_SEQUENCE_ORDER'
    );
  }
  // The host stays unpublished while G2P consumes the exact receipt. Only
  // the controller's post-G2P completion acknowledges the composite +3.
  assert.equal(field.stateMutationOrdinal, 2);
  fieldRuntime.completeStateMutationSequence(fused);
  assert.equal(fieldRuntime.isCurrentStateArtifact(field, {
    mutationOrdinal: 5,
    stateEncoding:
      SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT
  }), true);

  const abandoned = fieldRuntime.reserveStateMutationSequence(field, {
    expectedOrdinal: 5,
    expectedEncoding:
      SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT,
    stages: [{
      outputEncoding:
        SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT,
      operation: 'test-abandoned-fused-p2g'
    }]
  });
  assert.equal(fieldRuntime.discardStateMutationSequence(abandoned, {
    discardedEncoder: true
  }), true);
  assert.equal(field.stateMutationOrdinal, 5);

  assert.equal(releaseSchroederSpatialEpochGenerationAfterQueue(generation, device), true);
  assert.equal(await generation.releasePromise, true);
});

test('submitted single-stage mechanics-field mutations quarantine until exact retirement evidence', async () => {
  const device = createFakeDevice();
  const { generation } = createSubmittedMechanicsFieldGeneration(device);
  const field = generation.mechanicsFieldView;
  const runtime = field.ownerRuntime;
  const initialUsable = runtime.usableArenaCount();
  const mutation = runtime.reserveStateMutation(field, {
    expectedOrdinal: 0,
    expectedEncoding: SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY,
    outputEncoding:
      SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT,
    operation: 'submitted-before-single-stage-artifact-publication'
  });

  assert.throws(
    () => runtime.quarantineStateMutation(mutation),
    /requires \{ submissionObserved: true \}/
  );
  assert.equal(runtime.isStateMutationReservationActive(field, mutation), true);

  const originalError = new Error('single-stage artifact publication failed');
  assert.equal(runtime.quarantineStateMutation(mutation, {
    submissionObserved: true,
    reason: originalError
  }), true);
  assert.deepEqual(runtime.stateMutationState(field), {
    ordinal: 0,
    encoding: SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY,
    operation: 'topology-ready',
    pending: true,
    publicationLocked: false,
    quarantined: true
  });
  assert.equal(runtime.isStateMutationReservationActive(field, mutation), false);
  assert.equal(runtime.isCurrentStateArtifact(field, {
    mutationOrdinal: 0,
    stateEncoding: SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY
  }), false);
  assert.throws(
    () => runtime.markStateMutationSubmitted(mutation),
    /mechanics field mutation token is not pending|publication lock changed/
  );
  assert.throws(
    () => runtime.discardStateMutation(mutation, { discardedEncoder: true }),
    (error) => error?.code === 'ERR_SCHROEDER_MECHANICS_FIELD_MUTATION_STALE'
  );
  assert.deepEqual(runtime.stateMutationState(field), {
    ordinal: 0,
    encoding: SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY,
    operation: 'topology-ready',
    pending: true,
    publicationLocked: false,
    quarantined: true
  });
  assert.throws(() => runtime.reserveStateMutation(field, {
    expectedOrdinal: 0,
    expectedEncoding: SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY,
    outputEncoding:
      SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT,
    operation: 'must-not-reuse-quarantined-field'
  }), /stale or malformed/);
  assert.equal(runtime.quarantinedArenaCount(), 1);

  assert.equal(await runtime.retireQuarantinedExecutionAfter(field), true);
  assert.equal(field.quarantineReason, originalError);
  assert.equal(runtime.ownsExecution(field), false);
  assert.equal(runtime.quarantinedArenaCount(), 0);
  assert.equal(runtime.retiredArenaCount(), 1);
  assert.equal(runtime.usableArenaCount(), initialUsable - 1);
});

test('mechanics-field construction is one exact direct packed-radix topology', async () => {
  const device = createFakeDevice();
  const levelAssignment = createLevelAssignment(device, 4_608);
  const identityBuffer = device.createBuffer({
    label: 'mechanics-field-direct-identity-source',
    size: levelAssignment.particleCount * Uint32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const generation = runSchroederSpatialEpochGenerationWebGpu({
    device,
    levelAssignment,
    particleCount: levelAssignment.particleCount,
    particleIdentityBuffer: identityBuffer,
    particleIdentityStrideWords: 1,
    selectedLevel: 0,
    mechanicsGrid: {
      gridNodeCount: 13 * 13 * 13,
      gridDims: [13, 13, 13],
      gridShift: 1,
      gridSpacingM: 0.25
    }
  });

  assert.equal(generation.ready, true, generation.reason);
  const field = generation.mechanicsFieldView;
  assert.equal(field.routeControlBuffer, null);
  assert.equal(field.routeControlWordLength, 0);
  assert.equal(field.radixGateCount, 0);
  assert.equal(field.radixSortKeyWordCount, 3);
  assert.equal(field.radixHistogramScanMode, 'serial-small');
  assert.equal(field.stableCandidateOrderCount, field.candidateCount);
  assert.equal(
    field.stableCandidateOrderPolicy,
    'stable-radix-equal-key-preserves-particle-stencil-candidate-order'
  );
  assert.equal(field.ownsStableCandidateOrderBuffer, false);
  const stableOrderBuffer = field.stableCandidateOrderBuffer;
  assert.ok(stableOrderBuffer);
  assert.ok(field.ownerRuntime.allocationEntries().some(({ buffer }) => (
    buffer === stableOrderBuffer
  )));
  const substitutedStableOrderBuffer = device.createBuffer({
    label: 'same-device-substituted-stable-candidate-order',
    size: stableOrderBuffer.size,
    usage: stableOrderBuffer.usage
  });
  field.stableCandidateOrderBuffer = substitutedStableOrderBuffer;
  assert.equal(field.ownerRuntime.ownsExecution(field), false);
  assert.throws(
    () => field.ownerRuntime.stateMutationState(field),
    /not owned by this runtime/
  );
  field.stableCandidateOrderBuffer = stableOrderBuffer;
  assert.equal(field.ownerRuntime.ownsExecution(field), true);
  substitutedStableOrderBuffer.destroy();
  assert.equal(field.constructionRoutePolicy, 'gpu-authenticated-direct-exact-radix');
  assert.equal(field.encodedDispatchCount, 83);
  assert.equal(field.encodedComputePassCount, 6);
  assert.equal(
    field.ownerRuntime.pipelineCount,
    4 + field.ownerRuntime.arenaCount * 13
  );
  assert.equal(field.ownerRuntime.allocationEntries().some(({ role }) => (
    role === 'mechanics-field-route-control'
  )), false);

  const passes = device.encoders.flatMap(({ events }) => (
    events.filter(({ kind }) => kind === 'pass')
  ));
  const fieldPasses = passes.filter(({ descriptor }) => (
    descriptor.label?.includes('mechanics-field-view')
  ));
  const fieldCommands = fieldPasses.flatMap(({ commands }) => commands);
  assert.equal(fieldPasses.length, 6);
  assert.equal(fieldCommands.length, field.encodedDispatchCount);
  assert.equal(fieldCommands.every(({ dispatch, dispatchIndirect }) => (
    Array.isArray(dispatch) && dispatchIndirect === undefined
  )), true);
  assert.deepEqual(
    fieldPasses.map(({ descriptor }) => (
      [
        'EmitCandidates',
        'GroupedRadixSort',
        'GroupedUnique',
        'MaterializeStencilMap',
        'AssembleKeys',
        'Finalize'
      ].find((suffix) => descriptor.label.endsWith(suffix))
    )),
    [
      'EmitCandidates',
      'GroupedRadixSort',
      'GroupedUnique',
      'MaterializeStencilMap',
      'AssembleKeys',
      'Finalize'
    ]
  );
  assert.equal(fieldCommands.filter(({ pipeline }) => (
    pipeline.label.endsWith('-serial-histogram-scan')
  )).length, 24);
  assert.equal(fieldCommands.some(({ pipeline }) => (
    /uniform|route|classify/i.test(pipeline.label)
  )), false);

  const paramsBuffer = field.ownerRuntime.allocationEntries().find(({ role, arenaIndex }) => (
    role === 'mechanics-field-params' && arenaIndex === field.arenaIndex
  )).buffer;
  const paramsWrite = device.writes.find(({ buffer }) => buffer === paramsBuffer);
  const paramsWords = new Uint32Array(
    paramsWrite.data.buffer,
    paramsWrite.data.byteOffset,
    paramsWrite.data.byteLength / 4
  );
  assert.deepEqual(Array.from(paramsWords.slice(42, 48)), [0, 0, 0, 0, 0, 0]);

  assert.equal(releaseSchroederSpatialEpochGenerationAfterQueue(generation, device), true);
  assert.equal(await generation.releasePromise, true);
  assert.equal(
    stableOrderBuffer.destroyCount,
    0,
    'generation release returns the radix arena without destroying its retained order buffer'
  );
  assert.equal(substitutedStableOrderBuffer.destroyCount, 1);
});

test('mechanics-field build publishes complete nested GPU timestamp substage spans', async () => {
  const device = createFakeDevice();
  const levelAssignment = createLevelAssignment(device);
  const identityBuffer = device.createBuffer({
    label: 'mechanics-field-timestamp-identity-source',
    size: levelAssignment.particleCount * Uint32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const begins = [];
  const ends = [];
  const gpuTimestampRecorder = {
    active: true,
    beginEncoderSpan(encoder, descriptor) {
      const token = { encoder, descriptor };
      begins.push(token);
      return token;
    },
    endEncoderSpan(encoder, token) {
      ends.push({ encoder, token });
      return true;
    }
  };
  const generation = runSchroederSpatialEpochGenerationWebGpu({
    device,
    levelAssignment,
    particleCount: levelAssignment.particleCount,
    particleIdentityBuffer: identityBuffer,
    particleIdentityStrideWords: 1,
    selectedLevel: 0,
    mechanicsGrid: {
      gridNodeCount: 13 * 13 * 13,
      gridDims: [13, 13, 13],
      gridShift: 1,
      gridSpacingM: 0.25
    },
    gpuTimestampRecorder
  });

  assert.equal(generation.ready, true, generation.reason);
  assert.deepEqual(
    begins.map(({ descriptor }) => descriptor.producerId),
    [
      'schroeder-spatial-key-emission',
      'webgpu-stable-radix-sort',
      'webgpu-sorted-unique',
      'schroeder-spatial-derived-view-build',
      'schroeder-spatial-mechanics-view-build',
      'schroeder-spatial-mechanics-field-view-build',
      'schroeder-spatial-mechanics-field-candidate-emission',
      'schroeder-spatial-mechanics-field-radix-sort',
      'schroeder-spatial-mechanics-field-radix-unique',
      'schroeder-spatial-mechanics-field-stencil-map',
      'schroeder-spatial-mechanics-field-key-assembly',
      'schroeder-spatial-mechanics-field-finalize'
    ]
  );
  assert.equal(ends.length, begins.length);
  assert.ok(ends.every(({ encoder, token }) => (
    encoder === token.encoder && begins.includes(token)
  )));
  const fieldSubstages = begins.slice(6).map(({ descriptor }) => descriptor);
  assert.ok(fieldSubstages.every(({ generationId }) => (
    generationId === generation.execution.generationId
  )));
  assert.ok(fieldSubstages.every(({ sourceCount }) => (
    sourceCount === levelAssignment.particleCount
  )));
  assert.ok(fieldSubstages.every(({ candidateCount }) => (
    candidateCount === levelAssignment.particleCount * 27
  )));

  assert.equal(releaseSchroederSpatialEpochGenerationAfterQueue(generation, device), true);
  assert.equal(await generation.releasePromise, true);
});

test('mechanics-field publication locks gate mutation/current state and require one exact terminal capability', async () => {
  const device = createFakeDevice();
  const { generation } = createSubmittedMechanicsFieldGeneration(device);
  const field = generation.mechanicsFieldView;
  const runtime = field.ownerRuntime;
  let terminalReceipt = null;
  const publicationLock = runtime.acquireStatePublicationLock(field, {
    owner: Object.freeze({ kind: 'test-private-macro' }),
    publicationReceiptValidator: (candidateDevice, candidateReceipt, options) => (
      candidateDevice === device
      && candidateReceipt === terminalReceipt
      && options.execution === field
      && options.publicationLock === publicationLock
      && options.mutationOrdinal === 1
      && options.stateEncoding
        === SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT
      && options.closureOrdinal === 9
    )
  });

  assert.deepEqual(runtime.stateMutationState(field), {
    ordinal: 0,
    encoding: SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY,
    operation: 'topology-ready',
    pending: false,
    publicationLocked: true,
    quarantined: false
  });
  assert.equal(runtime.isStatePublicationLockActive(field, publicationLock), true);
  assert.equal(runtime.isStatePublicationLockActive(field, { ...publicationLock }), false);
  assert.equal(runtime.isCurrentStateArtifact(field, {
    mutationOrdinal: 0,
    stateEncoding: SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY
  }), false);
  assert.equal(runtime.isCurrentStateArtifact(field, {
    mutationOrdinal: 0,
    stateEncoding: SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY,
    publicationLock
  }), true);
  assert.throws(() => runtime.reserveStateMutation(field, {
    expectedOrdinal: 0,
    expectedEncoding: SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY,
    outputEncoding:
      SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT,
    operation: 'ordinary-lock-bypass'
  }), /stale or malformed/);
  assert.throws(() => runtime.reserveStateMutation(field, {
    expectedOrdinal: 0,
    expectedEncoding: SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY,
    outputEncoding:
      SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT,
    operation: 'cloned-lock-bypass',
    publicationLock: { ...publicationLock }
  }), /stale or malformed/);

  const mutation = runtime.reserveStateMutation(field, {
    expectedOrdinal: 0,
    expectedEncoding: SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY,
    outputEncoding:
      SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT,
    operation: 'private-terminal-state',
    publicationLock
  });
  runtime.markStateMutationSubmitted(mutation);
  assert.equal(runtime.isCurrentStateArtifact(field, {
    mutationOrdinal: 1,
    stateEncoding:
      SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT
  }), false);

  const intermediateReceipt = {
    schema: 'peercompute.ulg.schroeder-mechanics-field-publication-receipt.v0',
    status: 'mechanics-ledger-ready-private',
    particlePublicationAllowed: false
  };
  assert.throws(() => runtime.mintStatePublicationCapability(
    field,
    publicationLock,
    { terminalClosureReceipt: intermediateReceipt, closureOrdinal: 9 }
  ), /capability is stale/);

  terminalReceipt = Object.freeze({
    schema: 'peercompute.ulg.schroeder-mechanics-field-publication-receipt.v0',
    status: 'macro-closure-gpu-verified-private',
    particlePublicationAllowed: true
  });
  const capability = runtime.mintStatePublicationCapability(
    field,
    publicationLock,
    { terminalClosureReceipt: terminalReceipt, closureOrdinal: 9 }
  );
  assert.throws(() => runtime.promoteStatePublicationLock(
    field,
    publicationLock,
    { ...capability }
  ), /promotion is stale/);
  assert.equal(runtime.promoteStatePublicationLock(
    field,
    publicationLock,
    capability
  ), true);
  assert.throws(() => runtime.promoteStatePublicationLock(
    field,
    publicationLock,
    capability
  ), /promotion is stale/);
  assert.equal(runtime.isCurrentStateArtifact(field, {
    mutationOrdinal: 1,
    stateEncoding:
      SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT
  }), true);

  assert.equal(releaseSchroederSpatialEpochGenerationAfterQueue(generation, device), true);
  assert.equal(await generation.releasePromise, true);
});

test('unmodified mechanics-field publication locks discard without retiring the execution', async () => {
  const device = createFakeDevice();
  const { generation } = createSubmittedMechanicsFieldGeneration(device);
  const field = generation.mechanicsFieldView;
  const runtime = field.ownerRuntime;
  const publicationLock = runtime.acquireStatePublicationLock(field, {
    owner: Object.freeze({ kind: 'test-retryable-reservation' })
  });

  assert.equal(runtime.discardStatePublicationLock(field, publicationLock), true);
  assert.equal(runtime.isStatePublicationLockActive(field, publicationLock), false);
  assert.equal(runtime.ownsExecution(field), true);
  assert.equal(runtime.isExecutionSubmitted(field), true);
  assert.deepEqual(runtime.stateMutationState(field), {
    ordinal: 0,
    encoding: SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY,
    operation: 'topology-ready',
    pending: false,
    publicationLocked: false,
    quarantined: false
  });
  assert.throws(
    () => runtime.discardStatePublicationLock(field, publicationLock),
    /only an unmodified mechanics field publication lock can be discarded/
  );

  const replacementLock = runtime.acquireStatePublicationLock(field, {
    owner: Object.freeze({ kind: 'test-retry' })
  });
  const mutation = runtime.reserveStateMutation(field, {
    expectedOrdinal: 0,
    expectedEncoding: SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY,
    outputEncoding:
      SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT,
    operation: 'submitted-lock-is-not-discardable',
    publicationLock: replacementLock
  });
  runtime.markStateMutationSubmitted(mutation);
  assert.throws(
    () => runtime.discardStatePublicationLock(field, replacementLock),
    /only an unmodified mechanics field publication lock can be discarded/
  );

  assert.equal(await runtime.retireStatePublicationLockAfter(
    field,
    replacementLock
  ), true);
});

test('mechanics-field quarantine retirement uses runtime evidence and never reuses a retired arena', async () => {
  const device = createFakeDevice();
  device.lost = Promise.resolve({ reason: 'destroyed', message: 'test device loss' });
  const first = createSubmittedMechanicsFieldGeneration(device).generation;
  const field = first.mechanicsFieldView;
  const runtime = field.ownerRuntime;
  const initialUsable = runtime.usableArenaCount();
  const publicationLock = runtime.acquireStatePublicationLock(field, {
    owner: Object.freeze({ kind: 'quarantine-test' })
  });
  const sequence = runtime.reserveStateMutationSequence(field, {
    expectedOrdinal: 0,
    expectedEncoding: SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY,
    publicationLock,
    stages: [{
      outputEncoding:
        SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT,
      operation: 'submitted-before-unknown-outcome'
    }]
  });
  runtime.markStateMutationSequenceStageSubmissionObserved(
    sequence,
    sequence.stages[0]
  );
  runtime.markStateMutationSequenceStageSubmitted(sequence, sequence.stages[0]);
  const originalError = new Error('submission outcome unknown');
  runtime.quarantineStateMutationSequence(sequence, originalError);
  assert.equal(runtime.isStatePublicationLockActive(field, publicationLock), false);
  assert.equal(runtime.quarantinedArenaCount(), 1);

  device.queue.onSubmittedWorkDone = () => Promise.reject(
    new Error('queue completion unavailable')
  );
  await assert.rejects(
    runtime.retireQuarantinedExecutionAfter(field),
    /queue completion unavailable/
  );
  assert.equal(runtime.ownsExecution(field), true);
  assert.equal(runtime.retiredArenaCount(), 0);
  assert.equal(await runtime.retireQuarantinedExecutionAfter(field, {
    deviceLost: true
  }), true);
  assert.equal(field.quarantineReason, originalError);
  assert.equal(runtime.ownsExecution(field), false);
  assert.equal(runtime.quarantinedArenaCount(), 0);
  assert.equal(runtime.retiredArenaCount(), 1);
  assert.equal(runtime.usableArenaCount(), initialUsable - 1);
  for (const buffer of device.buffers.filter(({ label }) => (
    String(label).includes(`mechanics-field-view-arena-${field.arenaIndex}`)
  ))) {
    assert.equal(buffer.destroyCount, 1, `${buffer.label} retired exactly once`);
  }

  device.queue.onSubmittedWorkDone = () => Promise.resolve();
  const second = createSubmittedMechanicsFieldGeneration(device).generation;
  assert.equal(second.ready, false);
  assert.equal(
    second.errorCode,
    'ERR_SCHROEDER_MECHANICS_FIELD_VIEW_DEVICE_LOST'
  );
  assert.equal(releaseSchroederSpatialEpochGenerationAfterQueue(first, device), true);
  assert.equal(await first.releasePromise, true);
});

test('device loss supersedes an unresolved mechanics-field publication-lock fence exactly once', async () => {
  const device = createFakeDevice();
  const deviceLoss = deferred();
  device.lost = deviceLoss.promise;
  const { generation } = createSubmittedMechanicsFieldGeneration(device);
  const field = generation.mechanicsFieldView;
  const runtime = field.ownerRuntime;
  const publicationLock = runtime.acquireStatePublicationLock(field, {
    owner: Object.freeze({ kind: 'device-loss-supersession-test' })
  });
  const mutation = runtime.reserveStateMutation(field, {
    expectedOrdinal: 0,
    expectedEncoding: SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY,
    outputEncoding:
      SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT,
    operation: 'submitted-before-device-loss',
    publicationLock
  });
  runtime.markStateMutationSubmitted(mutation);

  const staleQueueFence = deferred();
  device.queue.onSubmittedWorkDone = () => staleQueueFence.promise;
  const normalRetirement = runtime.retireStatePublicationLockAfter(
    field,
    publicationLock
  );
  assert.equal(
    runtime.retireStatePublicationLockAfter(field, publicationLock),
    normalRetirement,
    'normal retirement exposes one stable in-flight promise'
  );
  const completion = runtime.executionRetirementCompletionPromise(field);
  const originalReason = new Error('device loss interrupted private publication');
  const lossRetirement = runtime.quarantineExecutionAfterDeviceLoss(field, {
    reason: originalReason
  });
  assert.equal(
    runtime.quarantineExecutionAfterDeviceLoss(field, {
      reason: new Error('later reason must not replace the first')
    }),
    lossRetirement,
    'device-loss retirement exposes one stable in-flight promise'
  );

  let settled = false;
  lossRetirement.finally(() => { settled = true; }).catch(() => {});
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(settled, false, 'loss retirement awaits the exact GPUDevice.lost');
  assert.equal(field.quarantineReason, originalReason);

  const ownedBuffers = runtime.allocationEntries()
    .filter(({ arenaIndex }) => arenaIndex === field.arenaIndex)
    .map(({ buffer }) => buffer);
  const borrowedBuffers = [
    field.sourceBuffer,
    field.identityBuffer,
    ...field.parentMechanicsView.ownerRuntime.allocationEntries()
      .filter(({ arenaIndex }) => arenaIndex === field.parentMechanicsView.arenaIndex)
      .map(({ buffer }) => buffer)
  ];
  deviceLoss.resolve({ reason: 'destroyed', message: 'supersession test' });
  assert.equal(await lossRetirement, true);
  assert.equal(await normalRetirement, true);
  assert.equal(await completion, true);
  assert.equal(runtime.ownsExecution(field), false);
  assert.equal(runtime.activeExecutionCount(), 0);
  assert.equal(runtime.retiredArenaCount(), 1);
  for (const buffer of ownedBuffers) {
    assert.equal(buffer.destroyCount, 1, `${buffer.label} destroyed exactly once`);
  }
  for (const buffer of borrowedBuffers) {
    assert.equal(buffer.destroyCount, 0, `${buffer.label} remains borrowed`);
  }

  const terminalCounts = ownedBuffers.map((buffer) => buffer.destroyCount);
  staleQueueFence.reject(new Error('stale queue fence rejected after device loss'));
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(
    ownedBuffers.map((buffer) => buffer.destroyCount),
    terminalCounts,
    'stale normal completion cannot mutate terminal retirement state'
  );
  assert.equal(runtime.retiredArenaCount(), 1);
});

test('device-loss retirement retries only the owned mechanics-field buffer whose destroy failed', async () => {
  const device = createFakeDevice();
  device.lost = Promise.resolve({ reason: 'destroyed', message: 'retry test' });
  const { generation } = createSubmittedMechanicsFieldGeneration(device);
  const field = generation.mechanicsFieldView;
  const runtime = field.ownerRuntime;
  const originalReason = new Error('operational failure before device loss');
  const ownedBuffers = runtime.allocationEntries()
    .filter(({ arenaIndex }) => arenaIndex === field.arenaIndex)
    .map(({ buffer }) => buffer);
  const failingBuffer = ownedBuffers[0];
  let failOnce = true;
  failingBuffer.destroyed = false;
  failingBuffer.destroyCount = 0;
  failingBuffer.destroy = function destroyWithOneFailure() {
    this.destroyCount += 1;
    if (failOnce) {
      failOnce = false;
      throw new Error('injected owned-buffer destroy failure');
    }
    this.destroyed = true;
  };

  const completion = runtime.executionRetirementCompletionPromise(field);
  await assert.rejects(
    runtime.quarantineExecutionAfterDeviceLoss(field, { reason: originalReason }),
    /injected owned-buffer destroy failure/
  );
  assert.equal(field.quarantineReason, originalReason);
  assert.equal(runtime.ownsExecution(field), true);
  assert.equal(failingBuffer.destroyCount, 1);
  for (const buffer of ownedBuffers.slice(1)) {
    assert.equal(buffer.destroyCount, 1, `${buffer.label} completed on first attempt`);
  }

  assert.equal(await runtime.quarantineExecutionAfterDeviceLoss(field, {
    reason: new Error('retry reason')
  }), true);
  assert.equal(await completion, true);
  assert.equal(field.quarantineReason, originalReason);
  assert.equal(failingBuffer.destroyCount, 2, 'only failed role is retried');
  for (const buffer of ownedBuffers.slice(1)) {
    assert.equal(buffer.destroyCount, 1, `${buffer.label} is not destroyed twice`);
  }
  assert.equal(runtime.retiredArenaCount(), 1);
  assert.equal(runtime.activeExecutionCount(), 0);
});

test('native mechanics field applies gravity across duplicate stencils and copies an inactive carrier', {
  skip: RUN_NATIVE
    ? false
    : 'set ULG_RUN_NATIVE_MECHANICS_FIELD_VIEW=1 for native WebGPU readback',
  timeout: 120_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: process.env.ULG_MECHANICS_FIELD_VIEW_CHROME
      || '/usr/bin/google-chrome',
    headless: true,
    args: [
      '--use-angle=vulkan',
      '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu',
      '--ignore-gpu-blocklist'
    ]
  });

  let native;
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(NATIVE_BASE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000
    });
    native = await page.evaluate(async () => {
      const adapter = await navigator.gpu?.requestAdapter({
        powerPreference: 'high-performance'
      });
      if (!adapter) return { status: 'unsupported', reason: 'WebGPU adapter unavailable' };
      const device = await adapter.requestDevice();
      const uncapturedErrors = [];
      device.addEventListener('uncapturederror', (event) => {
        uncapturedErrors.push(event.error?.message || String(event.error));
      });
      device.pushErrorScope('validation');

      const nonce = Date.now();
      const abi = await import(
        `/ulg-gpu-abi/src/index.js?nativeMechanicsField=${nonce}`
      );
      const buffersModule = await import(
        `/src/runtime/sph/sphGpuBuffers.js?nativeMechanicsField=${nonce}`
      );
      const hierarchyModule = await import(
        `/src/runtime/sph/schroederHierarchyGpu.js?nativeMechanicsField=${nonce}`
      );
      const spatialModule = await import(
        `/src/runtime/sph/schroederSpatialEpochGpu.js?nativeMechanicsField=${nonce}`
      );
      const gridModule = await import(
        `/src/runtime/sph/sphGridGpuKernel.js?nativeMechanicsField=${nonce}`
      );
      const stepModule = await import(
        `/src/runtime/sph/sphMlsMpmGpuStep.js?nativeMechanicsField=${nonce}`
      );

      const liveParticleCount = 4;
      const particleCount = liveParticleCount + 1;
      const state = new Float32Array(particleCount * 8);
      const thermo = new Float32Array(particleCount * 12);
      const identity = new Uint32Array(particleCount);
      const mechanics = new Float32Array(particleCount * 32);
      for (let index = 0; index < particleCount; index += 1) {
        const inactive = index >= liveParticleCount;
        const x = 1 + (index % 2) * 0.1;
        const y = 1 + Math.floor(index / 2) * 0.1;
        state.set([x, y, 1, inactive ? 0 : 1, 0, inactive ? 0.25 : 0, 0, 0], index * 8);
        thermo.set([
          7, 1, 273.15, 1000,
          1, 0, 0, 0,
          0.25, inactive ? 0 : 1, inactive ? 254 : 1, inactive ? 0 : 0.1
        ], index * 12);
        identity[index] = 1;
        const offset = index * 32;
        mechanics.set([1, 0, 0, 0, 1, 0, 0, 0, 1], offset);
        mechanics[offset + 18] = 1;
        mechanics[offset + 19] = inactive ? 0 : 0.001;
        mechanics[offset + 20] = 1;
        mechanics[offset + 21] = inactive ? 254 : 1;
        mechanics[offset + 27] = inactive ? 254 : 1;
        mechanics[offset + 31] = inactive ? 0 : 1;
      }
      const sphParticleState = {
        schema: abi.ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
        status: 'cpu-derived-gpu-buffer-ready',
        particleCount,
        dimension: 3,
        step: 0,
        time: 0,
        positionEpoch: 0,
        topologyEpoch: 0,
        chartEpoch: 0,
        levelEpoch: 0,
        supportEpoch: 0,
        smoothingLengthM: 0.25,
        storageGeneration: 1,
        stateStrideFloats: 8,
        thermoStrideFloats: 12,
        identityStrideUints: 1,
        stateStrideBytes: 32,
        thermoStrideBytes: 48,
        identityStrideBytes: 4,
        identityRequired: true,
        identityRevision: 'native-mechanics-field-test',
        renderDomainKeys: { 1: 'native-test-body' },
        state,
        thermo,
        identity,
        metadata: []
      };
      const mlsMpmParticleState = {
        schema: abi.ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
        status: 'cpu-derived-gpu-buffer-ready',
        particleCount,
        step: 0,
        time: 0,
        storageGeneration: 1,
        mechanicsStrideFloats: 32,
        mechanicsStrideBytes: 128,
        mechanicsDtS: 0.01,
        mechanicalSubsteps: 1,
        gridCflFactor: 0.4,
        gravityMPerS2: [0, -9.80665, 0],
        particleSeparationRelaxation: 0,
        particleSeparationVelocityDamping: 0,
        mechanics,
        metadata: [],
        algorithmMaterialContactRows: null
      };
      const sphParticleUpload = buffersModule.uploadSphGpuParticleBuffers(
        device,
        sphParticleState
      );
      const mlsMpmParticleUpload = buffersModule.uploadMlsMpmGpuParticleBuffers(
        device,
        mlsMpmParticleState
      );
      sphParticleUpload.slot = 0;
      mlsMpmParticleUpload.slot = 0;

      const levelAssignment = await hierarchyModule.runSchroederLevelAssignmentWebGpu({
        device,
        sphParticleState,
        mlsMpmParticleState,
        sphParticleUpload,
        mlsMpmParticleUpload,
        baseGridSpacingM: 0.25,
        minLevel: 0,
        maxLevel: 0,
        targetSupportCells: 1,
        supportRadiusScale: 1,
        chartId: 0,
        retainAssignmentBuffer: true
      });
      const gridSpec = gridModule.createMlsMpmGridSpec({
        boxDimsM: [2, 2, 2],
        gridSpacingM: 0.25
      });
      const generation = spatialModule.runSchroederSpatialEpochGenerationWebGpu({
        device,
        levelAssignment,
        particleCount,
        particleIdentityBuffer: sphParticleUpload.identityBuffer,
        particleIdentityStrideWords: 1,
        selectedLevel: 0,
        mechanicsGrid: {
          gridNodeCount: gridSpec.gridNodeCount,
          gridDims: gridSpec.gridDims,
          gridShift: gridSpec.shift,
          gridSpacingM: gridSpec.gridSpacingM
        }
      });
      const mixedSolidIdentityBuffer = device.createBuffer({
        label: 'native-mechanics-field-mixed-solid-identities',
        size: identity.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });
      device.queue.writeBuffer(
        mixedSolidIdentityBuffer,
        0,
        new Uint32Array([1, 0xffff_ffff, 1, 0xffff_ffff, 1])
      );
      const mixedSolidGeneration = spatialModule.runSchroederSpatialEpochGenerationWebGpu({
        device,
        levelAssignment,
        particleCount,
        particleIdentityBuffer: mixedSolidIdentityBuffer,
        particleIdentityStrideWords: 1,
        selectedLevel: 0,
        mechanicsGrid: {
          gridNodeCount: gridSpec.gridNodeCount,
          gridDims: gridSpec.gridDims,
          gridShift: gridSpec.shift,
          gridSpacingM: gridSpec.gridSpacingM
        }
      });
      const spatialMechanicalProposalRunner = async ({
        generation: proposalGeneration
      }) => ({
        ready: true,
        generation: proposalGeneration,
        traversalCount: 0,
        proposalBuffer: null,
        evidence: null,
        consumerReceipts: {},
        encodeApply() {},
        releaseAfterSubmittedWork() { return true; }
      });
      const step = await stepModule.runMlsMpmResidentStepWithOptionalWebGpu({
        sphParticleState,
        mlsMpmParticleState,
        sphParticleUpload,
        mlsMpmParticleUpload,
        schroederLevelAssignment: levelAssignment,
        schroederSelectedLevel: 0,
        schroederSpatialEpochGeneration: generation,
        spatialMechanicalProposalRunner,
        canonicalSpatialRequired: true,
        gridSpacingM: 0.25,
        boxDimsM: [2, 2, 2],
        dt: 0.01,
        gravityMPerS2: [0, -9.80665, 0],
        cflFactor: 0.4,
        internalPressureScale: 0,
        preferWebGpu: true,
        device,
        readbackMode: 'no-full-readback',
        fuseNoFullResidentMechanics: true,
        summaryRunner: null,
        measureFusedSequenceQueueFence: true
      });

      const fieldView = generation.mechanicsFieldView;
      const read = async (buffer, byteLength, label) => {
        const readback = device.createBuffer({
          label,
          size: byteLength,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        const encoder = device.createCommandEncoder();
        encoder.copyBufferToBuffer(buffer, 0, readback, 0, byteLength);
        device.queue.submit([encoder.finish()]);
        await readback.mapAsync(GPUMapMode.READ);
        const values = new Uint32Array(readback.getMappedRange()).slice();
        readback.unmap();
        readback.destroy();
        return values;
      };
      const fieldWords = await read(
        fieldView.fieldViewBuffer,
        fieldView.layout.byteLength,
        'native-mechanics-field-header-readback'
      );
      const mixedSolidFieldView = mixedSolidGeneration.mechanicsFieldView;
      const mixedSolidFieldWords = await read(
        mixedSolidFieldView.fieldViewBuffer,
        mixedSolidFieldView.layout.byteLength,
        'native-mechanics-field-mixed-solid-readback'
      );
      const stateWords = await read(
        step.g2pReconstruction.stateBuffer,
        state.byteLength,
        'native-mechanics-field-state-readback'
      );
      const outputState = new Float32Array(stateWords.buffer);
      const validationError = await device.popErrorScope();
      await new Promise((resolve) => setTimeout(resolve, 50));
      const result = {
        status: 'complete',
        mechanicsFieldViewEnabled:
          step.p2gGridProjection.schroederSpatialDirectory.mechanicsFieldViewEnabled,
        flags: fieldWords[2],
        fieldCount: fieldWords[34],
        uniqueEvidence: Array.from(fieldWords.slice(50, 54)),
        dispatch: Array.from(fieldWords.slice(60, 63)),
        radixSortKeyWordCount: fieldView.radixSortKeyWordCount,
        radixHistogramScanMode: fieldView.radixHistogramScanMode,
        constructionRoutePolicy: fieldView.constructionRoutePolicy,
        routeControlAbsent: fieldView.routeControlBuffer === null
          && fieldView.radixGateCount === 0,
        topology: Array.from(fieldWords.slice(
          fieldView.layout.descriptorOffsetWords,
          fieldView.layout.keyOffsetWords + fieldWords[34] * fieldView.layout.keyWords
        )),
        mixedSolid: {
          flags: mixedSolidFieldWords[2],
          fieldCount: mixedSolidFieldWords[34],
          keys: Array.from(mixedSolidFieldWords.slice(
            mixedSolidFieldView.layout.keyOffsetWords,
            mixedSolidFieldView.layout.keyOffsetWords
              + mixedSolidFieldWords[34] * mixedSolidFieldView.layout.keyWords
          ))
        },
        inactiveDescriptor: Array.from(fieldWords.slice(
          fieldView.layout.descriptorOffsetWords
            + liveParticleCount * fieldView.layout.descriptorWords,
          fieldView.layout.descriptorOffsetWords
            + (liveParticleCount + 1) * fieldView.layout.descriptorWords
        )),
        y: Array.from({ length: particleCount }, (_, index) => outputState[index * 8 + 1]),
        vy: Array.from({ length: particleCount }, (_, index) => outputState[index * 8 + 5]),
        validationError: validationError?.message || null,
        uncapturedErrors
      };

      stepModule.destroyMlsMpmResidentStepBuffers(step);
      spatialModule.releaseSchroederSpatialEpochGenerationAfterQueue(generation, device);
      await generation.releasePromise;
      spatialModule.releaseSchroederSpatialEpochGenerationAfterQueue(
        mixedSolidGeneration,
        device
      );
      await mixedSolidGeneration.releasePromise;
      mixedSolidIdentityBuffer.destroy();
      levelAssignment.destroyAssignmentBuffer?.();
      buffersModule.destroySphGpuParticleBuffers(sphParticleUpload);
      buffersModule.destroyMlsMpmGpuParticleBuffers(mlsMpmParticleUpload);
      return result;
    });
  } finally {
    await browser.close();
  }

  assert.equal(native.status, 'complete', native.reason || 'native WebGPU did not run');
  assert.equal(native.mechanicsFieldViewEnabled, true);
  assert.equal(
    native.flags,
    SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_READY
      | SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_ADMITTED
  );
  assert.equal(native.fieldCount, 27);
  assert.deepEqual(native.uniqueEvidence, [
    1,
    135,
    28,
    SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_UNIQUE_STATUS_READY
  ]);
  assert.deepEqual(native.dispatch, [1, 1, 1]);
  assert.equal(native.radixSortKeyWordCount, 3);
  assert.equal(native.radixHistogramScanMode, 'parallel-scan');
  assert.equal(native.constructionRoutePolicy, 'gpu-authenticated-direct-exact-radix');
  assert.equal(native.routeControlAbsent, true);
  assert.equal(native.mixedSolid.flags, native.flags);
  assert.equal(native.mixedSolid.fieldCount, 54);
  const mixedSolidKeys = Array.from(
    { length: native.mixedSolid.fieldCount },
    (_, fieldIndex) => native.mixedSolid.keys.slice(fieldIndex * 4, fieldIndex * 4 + 4)
  );
  assert.ok(mixedSolidKeys.every((key) => key[1] === 1 && key[2] === 7));
  assert.deepEqual(
    [...new Set(mixedSolidKeys.map((key) => key[3]))],
    [1, 0xffff_ffff]
  );
  assert.equal(mixedSolidKeys.some((key) => key[3] === 0), false);
  for (let fieldIndex = 0; fieldIndex < mixedSolidKeys.length; fieldIndex += 2) {
    assert.equal(mixedSolidKeys[fieldIndex][0], mixedSolidKeys[fieldIndex + 1][0]);
    assert.deepEqual(
      mixedSolidKeys.slice(fieldIndex, fieldIndex + 2).map((key) => key[3]),
      [1, 0xffff_ffff]
    );
  }
  assert.deepEqual(native.inactiveDescriptor.slice(0, 4), [0, 0, 0, 0]);
  assert.deepEqual(native.inactiveDescriptor.slice(4, 31), new Array(27).fill(0xffff_ffff));
  assert.equal(native.validationError, null);
  assert.deepEqual(native.uncapturedErrors, []);
  for (const velocity of native.vy.slice(0, 4)) {
    assert.ok(Math.abs(velocity - (-9.80665 * 0.01)) <= 2e-7);
  }
  assert.equal(native.vy[4], 0.25);
  assert.ok(Math.abs(native.y[0] - (1 - 9.80665 * 0.01 * 0.01)) <= 2e-7);
  assert.ok(Math.abs(native.y[1] - (1 - 9.80665 * 0.01 * 0.01)) <= 2e-7);
  assert.ok(Math.abs(native.y[2] - (1.1 - 9.80665 * 0.01 * 0.01)) <= 2e-7);
  assert.ok(Math.abs(native.y[3] - (1.1 - 9.80665 * 0.01 * 0.01)) <= 2e-7);
  assert.equal(native.y[4], 1.2000000476837158);
});

test('native staged mechanics-field P2G is bitwise deterministic across fresh executions', {
  skip: RUN_NATIVE
    ? false
    : 'set ULG_RUN_NATIVE_MECHANICS_FIELD_VIEW=1 for native WebGPU readback',
  timeout: 180_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: process.env.ULG_MECHANICS_FIELD_VIEW_CHROME
      || '/usr/bin/google-chrome',
    headless: true,
    args: [
      '--use-angle=vulkan',
      '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu',
      '--ignore-gpu-blocklist'
    ]
  });

  let native;
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(NATIVE_BASE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000
    });
    native = await page.evaluate(async () => {
      const adapter = await navigator.gpu?.requestAdapter({
        powerPreference: 'high-performance'
      });
      if (!adapter) return { status: 'unsupported', reason: 'WebGPU adapter unavailable' };
      const device = await adapter.requestDevice();
      const uncapturedErrors = [];
      device.addEventListener('uncapturederror', (event) => {
        uncapturedErrors.push(event.error?.message || String(event.error));
      });
      device.pushErrorScope('validation');

      const nonce = Date.now();
      const abi = await import(
        `/ulg-gpu-abi/src/index.js?nativeDeterministicP2g=${nonce}`
      );
      const buffersModule = await import(
        `/src/runtime/sph/sphGpuBuffers.js?nativeDeterministicP2g=${nonce}`
      );
      const hierarchyModule = await import(
        `/src/runtime/sph/schroederHierarchyGpu.js?nativeDeterministicP2g=${nonce}`
      );
      const spatialModule = await import(
        `/src/runtime/sph/schroederSpatialEpochGpu.js?nativeDeterministicP2g=${nonce}`
      );
      const gridModule = await import(
        `/src/runtime/sph/sphGridGpuKernel.js?nativeDeterministicP2g=${nonce}`
      );

      // 320 equal-key candidates per field cross multiple radix workgroups.
      // The f32 inputs deliberately mix tiny/large masses and cancelling
      // signed momenta so an atomic reduction would expose order variance.
      const particleCount = 320;
      const repetitionCount = 8;
      const state = new Float32Array(particleCount * 8);
      const thermo = new Float32Array(particleCount * 12);
      const identity = new Uint32Array(particleCount);
      const mechanics = new Float32Array(particleCount * 32);
      const massPattern = [1e-5, 1e5, 0.03125, 8192, 1.5];
      const momentumXPattern = [1e5, -99999.5, 0.125, -0.0625, 0.03125];
      const momentumYPattern = [-25000, 24999.75, -0.5, 0.25, 0.125];
      const momentumZPattern = [4096, -4095.875, 0.0625, -0.03125, 0.015625];
      for (let index = 0; index < particleCount; index += 1) {
        const patternIndex = index % massPattern.length;
        const mass = Math.fround(massPattern[patternIndex]);
        const s = index * 8;
        state.set([
          1, 1, 1, mass,
          Math.fround(momentumXPattern[patternIndex] / mass),
          Math.fround(momentumYPattern[patternIndex] / mass),
          Math.fround(momentumZPattern[patternIndex] / mass),
          0
        ], s);
        thermo.set([
          7, 1, 273.15, 1000,
          1, 0, 0, 0,
          0.25, 1, 1, 0.1
        ], index * 12);
        identity[index] = 1;
        const m = index * 32;
        mechanics.set([1, 0, 0, 0, 1, 0, 0, 0, 1], m);
        mechanics[m + 18] = 1;
        mechanics[m + 19] = mass / 1000;
        mechanics[m + 20] = 0;
        mechanics[m + 21] = 1;
        mechanics[m + 27] = 1;
        mechanics[m + 31] = mass;
      }
      const sphParticleState = {
        schema: abi.ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
        status: 'cpu-derived-gpu-buffer-ready',
        particleCount,
        dimension: 3,
        step: 0,
        time: 0,
        positionEpoch: 0,
        topologyEpoch: 0,
        chartEpoch: 0,
        levelEpoch: 0,
        supportEpoch: 0,
        smoothingLengthM: 0.25,
        storageGeneration: 1,
        stateStrideFloats: 8,
        thermoStrideFloats: 12,
        identityStrideUints: 1,
        stateStrideBytes: 32,
        thermoStrideBytes: 48,
        identityStrideBytes: 4,
        identityRequired: true,
        identityRevision: 'native-deterministic-p2g-test',
        renderDomainKeys: { 1: 'native-deterministic-p2g-body' },
        state,
        thermo,
        identity,
        metadata: []
      };
      const mlsMpmParticleState = {
        schema: abi.ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
        status: 'cpu-derived-gpu-buffer-ready',
        particleCount,
        step: 0,
        time: 0,
        storageGeneration: 1,
        mechanicsStrideFloats: 32,
        mechanicsStrideBytes: 128,
        mechanicsDtS: 0,
        mechanicalSubsteps: 1,
        gridCflFactor: 0.4,
        gravityMPerS2: [0, 0, 0],
        particleSeparationRelaxation: 0,
        particleSeparationVelocityDamping: 0,
        mechanics,
        metadata: [],
        algorithmMaterialContactRows: null
      };
      const gridSpec = gridModule.createMlsMpmGridSpec({
        boxDimsM: [2, 2, 2],
        gridSpacingM: 0.25
      });

      const readWords = async (buffer, byteLength, label) => {
        const readback = device.createBuffer({
          label,
          size: byteLength,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        const encoder = device.createCommandEncoder();
        encoder.copyBufferToBuffer(buffer, 0, readback, 0, byteLength);
        device.queue.submit([encoder.finish()]);
        await readback.mapAsync(GPUMapMode.READ);
        const words = new Uint32Array(readback.getMappedRange()).slice();
        readback.unmap();
        readback.destroy();
        return words;
      };
      const hashWords = async (words) => {
        const digest = new Uint8Array(await crypto.subtle.digest(
          'SHA-256',
          words.buffer
        ));
        return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
      };

      const hashes = [];
      let baselineStateWords = null;
      let fieldCount = 0;
      let flags = 0;
      let stateEncoding = 0;
      let radixHistogramScanMode = null;
      for (let repetition = 0; repetition < repetitionCount; repetition += 1) {
        const sphParticleUpload = buffersModule.uploadSphGpuParticleBuffers(
          device,
          sphParticleState
        );
        const mlsMpmParticleUpload = buffersModule.uploadMlsMpmGpuParticleBuffers(
          device,
          mlsMpmParticleState
        );
        sphParticleUpload.slot = 0;
        mlsMpmParticleUpload.slot = 0;
        const levelAssignment = await hierarchyModule.runSchroederLevelAssignmentWebGpu({
          device,
          sphParticleState,
          mlsMpmParticleState,
          sphParticleUpload,
          mlsMpmParticleUpload,
          baseGridSpacingM: 0.25,
          minLevel: 0,
          maxLevel: 0,
          targetSupportCells: 1,
          supportRadiusScale: 1,
          chartId: 0,
          retainAssignmentBuffer: true
        });
        const generation = spatialModule.runSchroederSpatialEpochGenerationWebGpu({
          device,
          levelAssignment,
          particleCount,
          particleIdentityBuffer: sphParticleUpload.identityBuffer,
          particleIdentityStrideWords: 1,
          selectedLevel: 0,
          mechanicsGrid: {
            gridNodeCount: gridSpec.gridNodeCount,
            gridDims: gridSpec.gridDims,
            gridShift: gridSpec.shift,
            gridSpacingM: gridSpec.gridSpacingM
          }
        });
        if (!generation.ready) {
          throw new Error(`deterministic P2G generation rejected: ${generation.reason}`);
        }
        const projection = await gridModule.runMlsMpmP2gGridProjectionWebGpu({
          device,
          sphParticleState,
          mlsMpmParticleState,
          sphParticleUpload,
          mlsMpmParticleUpload,
          schroederSelectedLevel: 0,
          schroederSpatialEpochGeneration: generation,
          canonicalSpatialRequired: true,
          mechanicsFieldMode: 'required',
          gridSpacingM: 0.25,
          boxDimsM: [2, 2, 2],
          dt: 0,
          internalPressureScale: 0,
          readbackMode: 'no-full-readback'
        });
        const field = generation.mechanicsFieldView;
        const fieldWords = await readWords(
          field.fieldViewBuffer,
          field.layout.byteLength,
          `native-deterministic-p2g-readback-${repetition}`
        );
        fieldCount = fieldWords[34];
        flags = fieldWords[2];
        stateEncoding = fieldWords[59];
        radixHistogramScanMode = field.radixHistogramScanMode;
        const stateWords = fieldWords.slice(
          field.layout.stateOffsetWords,
          field.layout.stateOffsetWords + fieldCount * field.layout.stateWords
        );
        hashes.push(await hashWords(stateWords));
        if (baselineStateWords === null) {
          baselineStateWords = stateWords;
        } else if (
          stateWords.length !== baselineStateWords.length
          || stateWords.some((word, index) => word !== baselineStateWords[index])
        ) {
          throw new Error(`deterministic P2G state mismatch at repetition ${repetition}`);
        }
        if (projection.mechanicsFieldP2gReductionMode
            !== 'stable-radix-ordered-field-reduction') {
          throw new Error('staged P2G did not select deterministic field reduction');
        }

        spatialModule.releaseSchroederSpatialEpochGenerationAfterQueue(
          generation,
          device
        );
        await generation.releasePromise;
        levelAssignment.destroyAssignmentBuffer?.();
        buffersModule.destroySphGpuParticleBuffers(sphParticleUpload);
        buffersModule.destroyMlsMpmGpuParticleBuffers(mlsMpmParticleUpload);
      }

      const stateFloats = new Float32Array(baselineStateWords.buffer);
      const contributionCounts = Array.from(
        { length: fieldCount },
        (_, index) => baselineStateWords[index * 8 + 7]
      );
      const masses = Array.from(
        { length: fieldCount },
        (_, index) => stateFloats[index * 8]
      );
      const momenta = Array.from(
        { length: fieldCount * 3 },
        (_, index) => {
          const fieldIndex = Math.floor(index / 3);
          return stateFloats[fieldIndex * 8 + 1 + (index % 3)];
        }
      );
      const gradients = Array.from(
        { length: fieldCount * 3 },
        (_, index) => {
          const fieldIndex = Math.floor(index / 3);
          return stateFloats[fieldIndex * 8 + 4 + (index % 3)];
        }
      );
      const validationError = await device.popErrorScope();
      await new Promise((resolve) => setTimeout(resolve, 100));
      device.destroy?.();
      return {
        status: 'complete',
        particleCount,
        repetitionCount,
        candidateCount: particleCount * 27,
        fieldCount,
        flags,
        stateEncoding,
        radixHistogramScanMode,
        hashes,
        contributionCounts,
        massMin: Math.min(...masses),
        massMax: Math.max(...masses),
        momentumMaxAbs: Math.max(...momenta.map(Math.abs)),
        gradientMaxAbs: Math.max(...gradients.map(Math.abs)),
        allFinite: [...masses, ...momenta, ...gradients].every(Number.isFinite),
        validationError: validationError?.message || null,
        uncapturedErrors
      };
    });
  } finally {
    await browser.close();
  }

  assert.equal(native.status, 'complete', native.reason || 'native WebGPU did not run');
  assert.equal(native.particleCount, 320);
  assert.equal(native.repetitionCount, 8);
  assert.equal(native.candidateCount, 8_640);
  assert.equal(native.fieldCount, 27);
  assert.equal(
    native.flags,
    SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_READY
      | SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_ADMITTED
  );
  assert.equal(
    native.stateEncoding,
    SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT
  );
  assert.equal(native.radixHistogramScanMode, 'serial-small');
  assert.equal(new Set(native.hashes).size, 1);
  assert.deepEqual(native.contributionCounts, new Array(27).fill(320));
  assert.ok(native.massMin > 0);
  assert.ok(native.massMax > native.massMin);
  assert.ok(native.momentumMaxAbs > 0);
  assert.ok(native.gradientMaxAbs > 0);
  assert.equal(native.allFinite, true);
  assert.equal(native.validationError, null);
  assert.deepEqual(native.uncapturedErrors, []);
});
