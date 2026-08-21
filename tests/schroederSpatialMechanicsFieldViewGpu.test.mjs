import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SCHROEDER_SPATIAL_MECHANICS_FIELD_SOURCE_AUTHORITY_V2,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_MAGIC,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_VERSION,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_UNIQUE_STATUS_READY,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_ADMITTED,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_READY,
  ULG_SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_SCHEMA,
  validateSchroederSpatialMechanicsFieldViewDescriptor
} from '../ulg-gpu-abi/src/schroederSpatialMechanicsFieldView.js';
import {
  schroederSpatialMechanicsFieldViewV2Wgsl,
  schroederSpatialMechanicsFieldViewWgsl
} from '../ulg-gpu-abi/src/schroederSpatialMechanicsFieldViewWgsl.js';
import {
  ULG_SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_SCHEMA,
  createSchroederSpatialActiveSourceViewLayout
} from '../ulg-gpu-abi/src/schroederSpatialActiveSourceView.js';
import {
  SCHROEDER_SPATIAL_EPOCH_V2_REVERSE_CELL_PLUS_ONE,
  SCHROEDER_SPATIAL_EPOCH_V2_VERSION,
  ULG_SCHROEDER_SPATIAL_EPOCH_V2_SCHEMA,
  createSchroederSpatialEpochV2Layout
} from '../ulg-gpu-abi/src/schroederSpatialEpoch.js';
import {
  SCHROEDER_SPATIAL_MECHANICS_VIEW_ACTIVE_WORK_IDENTITY,
  SCHROEDER_SPATIAL_MECHANICS_VIEW_DIRECTORY_VERSION_V2,
  SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
  ULG_SCHROEDER_SPATIAL_MECHANICS_VIEW_SCHEMA,
  createSchroederSpatialMechanicsViewPlan
} from '../ulg-gpu-abi/src/schroederSpatialMechanicsView.js';
import {
  createSchroederSpatialMechanicsFieldViewGpu
} from '../src/runtime/sph/schroederSpatialMechanicsFieldViewGpu.js';
import {
  releaseSchroederSpatialEpochGenerationAfterQueue,
  runSchroederSpatialEpochGenerationWebGpu
} from '../src/runtime/sph/schroederSpatialEpochGpu.js';
import {
  tagWebGpuBufferDevice
} from '../src/runtime/sph/sphGpuDeviceIdentity.js';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_MECHANICS_FIELD_VIEW === '1';
const RUN_NATIVE_V2_COMPILE =
  process.env.ULG_RUN_NATIVE_MECHANICS_FIELD_V2_COMPILE === '1';
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
    copyBufferToBuffer(source, sourceOffset, destination, destinationOffset, size) {
      events.push({
        kind: 'copy',
        source,
        sourceOffset,
        destination,
        destinationOffset,
        size
      });
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

function createFakeDevice({
  limits: limitOverrides = {}
} = {}) {
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
      minUniformBufferOffsetAlignment: 256,
      ...limitOverrides
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

function createOwnedTestBuffer(device, descriptor) {
  return tagWebGpuBufferDevice(device.createBuffer(descriptor), device);
}

function createDirectoryV2MechanicsParent(device, {
  physicalSourceCount = 4,
  physicalSourceCapacity = physicalSourceCount,
  buildOrdinal = 17,
  suppliedSourceBuffer = null,
  suppliedIdentityBuffer = null,
  identityOverrides = {}
} = {}) {
  const sourceBuffer = suppliedSourceBuffer || createOwnedTestBuffer(device, {
    label: 'mechanics-field-v2-source',
    size: physicalSourceCount * 16 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const identityBuffer = suppliedIdentityBuffer || createOwnedTestBuffer(device, {
    label: 'mechanics-field-v2-identity',
    size: physicalSourceCount * Uint32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const identity = Object.freeze({
    generationId: 41,
    deviceOrdinal: 2,
    laneOrdinal: 3,
    leaseToken: 5,
    sourceFamilyId: 7,
    storageGeneration: 11,
    physicsTick: 13,
    physicsSubstep: 0,
    positionEpoch: 17,
    topologyEpoch: 19,
    chartEpoch: 23,
    levelEpoch: 29,
    supportEpoch: 31,
    ...identityOverrides
  });
  const activeLayout = createSchroederSpatialActiveSourceViewLayout({
    physicalSourceCapacity,
    activeSourceCapacity: physicalSourceCapacity
  });
  const activeSourceViewBuffer = createOwnedTestBuffer(device, {
    label: 'mechanics-field-v2-active-source-view',
    size: activeLayout.byteLength,
    usage: 128 | 256
  });
  let activeSourceView;
  const activeOwner = {
    ownsExecution(execution) {
      return execution === activeSourceView;
    }
  };
  activeSourceView = {
    schema: ULG_SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_SCHEMA,
    status: 'schroeder-spatial-active-source-view-gpu-encoded',
    ready: true,
    selected: true,
    submitPerformed: false,
    sourceBuffer,
    activeSourceViewBuffer,
    layout: activeLayout,
    physicalSourceCount,
    physicalSourceCapacity,
    activeSourceCapacity: physicalSourceCapacity,
    sourceRowLayoutId:
      SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
    sourceRowStrideFloats: 16,
    ...identity,
    buildOrdinal,
    sourceFingerprint: 0x1234_5678,
    activeDispatchOffsetBytes: activeLayout.activeDispatchOffsetBytes,
    candidateDispatchOffsetBytes: activeLayout.candidateDispatchOffsetBytes,
    physicalDispatchOffsetBytes: activeLayout.physicalDispatchOffsetBytes,
    ownerRuntime: activeOwner
  };
  const activeSourceCountAuthority = Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_SCHEMA,
    activeSourceView,
    buffer: activeSourceViewBuffer,
    offsetWords: 18,
    offsetBytes: 18 * Uint32Array.BYTES_PER_ELEMENT,
    capacity: activeSourceView.activeSourceCapacity,
    residency: 'gpu-only'
  });
  const directoryLayout = createSchroederSpatialEpochV2Layout({
    physicalSourceCapacity,
    activeSourceCapacity: physicalSourceCapacity,
    cellCapacity: physicalSourceCapacity
  });
  const directoryBuffer = createOwnedTestBuffer(device, {
    label: 'mechanics-field-v2-directory',
    size: directoryLayout.byteLength,
    usage: 128
  });
  let spatialExecution;
  const spatialOwner = {
    ownsExecution(execution) {
      return execution === spatialExecution;
    }
  };
  spatialExecution = {
    schema: ULG_SCHROEDER_SPATIAL_EPOCH_V2_SCHEMA,
    status: 'schroeder-spatial-epoch-v2-gpu-encoded',
    abiVersion: SCHROEDER_SPATIAL_EPOCH_V2_VERSION,
    reverseEncoding: SCHROEDER_SPATIAL_EPOCH_V2_REVERSE_CELL_PLUS_ONE,
    submitPerformed: false,
    sourceBuffer,
    sourceRowLayoutId:
      SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
    sourceRowStrideFloats: 16,
    physicalSourceCount,
    physicalSourceCapacity,
    activeSourceCapacity: physicalSourceCapacity,
    ...identity,
    buildOrdinal,
    layout: directoryLayout,
    directoryBuffer,
    activeSourceView,
    activeSourceViewBuffer,
    activeSourceCountAuthority,
    ownerRuntime: spatialOwner
  };
  const parentPlan = createSchroederSpatialMechanicsViewPlan({
    sourceCount: physicalSourceCount,
    sourceRowLayoutId:
      SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
    directoryAbiVersion:
      SCHROEDER_SPATIAL_MECHANICS_VIEW_DIRECTORY_VERSION_V2,
    selectedLevel: 0,
    gridNodeCount: 8,
    gridDims: [2, 2, 2],
    gridShift: 1,
    gridSpacingM: 0.25,
    ...identity,
    completionOrdinal: buildOrdinal
  });
  const mechanicsViewBuffer = createOwnedTestBuffer(device, {
    label: 'mechanics-field-v2-parent-mechanics-view',
    size: parentPlan.layout.byteLength,
    usage: 128 | 256
  });
  let parentMechanicsView;
  let parentSubmitted = false;
  const parentOwner = {
    ownsExecution(execution) {
      return execution === parentMechanicsView;
    },
    isExecutionSubmitted(execution) {
      return execution === parentMechanicsView && parentSubmitted;
    }
  };
  parentMechanicsView = {
    ...parentPlan,
    schema: ULG_SCHROEDER_SPATIAL_MECHANICS_VIEW_SCHEMA,
    status: 'schroeder-spatial-mechanics-view-gpu-encoded',
    submitPerformed: false,
    released: false,
    sourceBuffer,
    sourceAuthorityVersion:
      SCHROEDER_SPATIAL_MECHANICS_FIELD_SOURCE_AUTHORITY_V2,
    directorySchema: ULG_SCHROEDER_SPATIAL_EPOCH_V2_SCHEMA,
    directoryAbiVersion:
      SCHROEDER_SPATIAL_MECHANICS_VIEW_DIRECTORY_VERSION_V2,
    sourceWorkIdentity:
      SCHROEDER_SPATIAL_MECHANICS_VIEW_ACTIVE_WORK_IDENTITY,
    physicalSourceCount,
    spatialExecution,
    directoryBuffer,
    activeSourceView,
    activeSourceViewBuffer,
    activeSourceCountAuthority,
    activeSourceDispatchOffsetBytes: activeLayout.activeDispatchOffsetBytes,
    mechanicsViewBuffer,
    indirectDispatchBuffer: mechanicsViewBuffer,
    indirectDispatchOffsetBytes: parentPlan.layout.dispatchOffsetWords
      * Uint32Array.BYTES_PER_ELEMENT,
    ownerRuntime: parentOwner
  };
  return {
    sourceBuffer,
    identityBuffer,
    activeSourceView,
    activeSourceCountAuthority,
    spatialExecution,
    parentMechanicsView,
    markParentSubmitted() {
      parentSubmitted = true;
      parentMechanicsView.status =
        'schroeder-spatial-mechanics-view-gpu-build-submitted';
      parentMechanicsView.submitPerformed = true;
    }
  };
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

test('mechanics-field direct kernels flatten authenticated two-dimensional dispatches', () => {
  assert.equal(
    ULG_SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_SCHEMA,
    'peercompute.ulg.schroeder-spatial-mechanics-field-view.v5'
  );
  assert.equal(SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_MAGIC, 0x53464635);
  assert.equal(SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_VERSION, 5);
  assert.match(
    schroederSpatialMechanicsFieldViewWgsl,
    /let linear_group = workgroup_id\.x \+ workgroup_id\.y \* dispatch_x/
  );
  assert.match(
    schroederSpatialMechanicsFieldViewWgsl,
    /fn emit_field_candidates\([\s\S]*params\.source_dispatch_x/
  );
  assert.match(
    schroederSpatialMechanicsFieldViewWgsl,
    /fn materialize_stencil_field_indices\([\s\S]*params\.candidate_dispatch_x/
  );
  assert.match(
    schroederSpatialMechanicsFieldViewWgsl,
    /fn assemble_field_keys\([\s\S]*params\.candidate_dispatch_x/
  );
  assert.doesNotMatch(
    schroederSpatialMechanicsFieldViewWgsl,
    /fn (?:emit_field_candidates|materialize_stencil_field_indices|assemble_field_keys)\([^)]*global_invocation_id/
  );
  assert.match(
    schroederSpatialMechanicsFieldViewWgsl,
    /let consumer_group_count = field_group_count\(field_count\);[\s\S]*let dispatch_x = field_dispatch_x\(consumer_group_count\);[\s\S]*let dispatch_y = field_dispatch_y\(consumer_group_count, dispatch_x\);/
  );
  assert.match(
    schroederSpatialMechanicsFieldViewWgsl,
    /field_store\(44u, dispatch_x\);[\s\S]*field_store\(45u, dispatch_y\);[\s\S]*field_store\(46u, dispatch_z\);[\s\S]*field_store\(FIELD_DISPATCH_OFFSET_WORDS, dispatch_x\);[\s\S]*field_store\(FIELD_DISPATCH_OFFSET_WORDS \+ 1u, dispatch_y\);[\s\S]*field_store\(FIELD_DISPATCH_OFFSET_WORDS \+ 2u, dispatch_z\);/
  );
});

test('directory-v2 mechanics-field WGSL maps active work to stable physical identity and authenticates exact CSR lineage', () => {
  assert.match(
    schroederSpatialMechanicsFieldViewV2Wgsl,
    /@group\(0\) @binding\(10\) var<storage, read> spatial_directory/
  );
  assert.match(
    schroederSpatialMechanicsFieldViewV2Wgsl,
    /@group\(0\) @binding\(11\) var<storage, read> active_source_view/
  );
  assert.match(
    schroederSpatialMechanicsFieldViewV2Wgsl,
    /ACTIVE_SOURCE_COUNT_WORD: u32 = 18u[\s\S]*ACTIVE_SOURCE_CANDIDATE_COUNT_WORD: u32 = 43u[\s\S]*ACTIVE_SOURCE_COMPLETION_WORD: u32 = 30u[\s\S]*ACTIVE_SOURCE_SEAL_WORD: u32 = 47u/
  );
  assert.match(
    schroederSpatialMechanicsFieldViewV2Wgsl,
    /active_source_view\[29u\] == params\.completion_ordinal[\s\S]*active_source_view\[ACTIVE_SOURCE_COMPLETION_WORD\][\s\S]*== params\.completion_ordinal[\s\S]*active_source_view\[ACTIVE_SOURCE_SEAL_WORD\] != 0u/
  );
  assert.match(
    schroederSpatialMechanicsFieldViewV2Wgsl,
    /let physical_source = active_source_view\[active_to_physical \+ active_ordinal\][\s\S]*active_source_view\[physical_to_active \+ physical_source\][\s\S]*!= active_ordinal/
  );
  assert.match(
    schroederSpatialMechanicsFieldViewV2Wgsl,
    /let cell_plus_one = spatial_directory\[reverse \+ physical_source\][\s\S]*let begin = spatial_directory\[cell_offsets \+ cell_index\][\s\S]*let end = spatial_directory\[cell_offsets \+ cell_index \+ 1u\][\s\S]*begin >= end \|\| end > active_count/
  );
  assert.match(
    schroederSpatialMechanicsFieldViewV2Wgsl,
    /let cell_i32_min = -2147483520\.0[\s\S]*let cell_i32_max = 2147483520\.0[\s\S]*spatial_directory\[key \+ 4u\][\s\S]*field_signed_order_key\(i32\(cell_f\.z\)\)/
  );
  assert.match(
    schroederSpatialMechanicsFieldViewV2Wgsl,
    /fn emit_field_candidates_v2[\s\S]*let source_index = field_physical_source_for_active\(active_ordinal\)[\s\S]*active_ordinal \* 27u \+ candidate_ordinal/
  );
  assert.match(
    schroederSpatialMechanicsFieldViewV2Wgsl,
    /fn materialize_stencil_field_indices_v2[\s\S]*let active_ordinal = candidate_index \/ 27u[\s\S]*let source_index = field_physical_source_for_active\(active_ordinal\)[\s\S]*source_index \* FIELD_DESCRIPTOR_WORDS/
  );
  assert.doesNotMatch(
    schroederSpatialMechanicsFieldViewV2Wgsl,
    /spatial_directory\[\s*cell_members\s*\+\s*active_ordinal\s*\]/
  );
  assert.match(
    schroederSpatialMechanicsFieldViewV2Wgsl,
    /source_dispatch_y[\s\S]*== select\([\s\S]*1u,[\s\S]*field_dispatch_y\([\s\S]*field_active_source_count\(\) > 0u[\s\S]*source_dispatch_z == 1u[\s\S]*candidate_dispatch_y[\s\S]*== select\([\s\S]*1u,[\s\S]*field_dispatch_y\([\s\S]*field_active_candidate_count\(\) > 0u[\s\S]*candidate_dispatch_z == 1u/
  );
  assert.match(
    schroederSpatialMechanicsFieldViewV2Wgsl,
    /params\.candidate_count == active_source_view\[44u\]/
  );
  assert.doesNotMatch(
    schroederSpatialMechanicsFieldViewV2Wgsl,
    /params\.candidate_count == params\.source_count \* 27u/
  );
  assert.match(
    schroederSpatialMechanicsFieldViewV2Wgsl,
    /let consumer_group_count = \(cell_count \+ 63u\) \/ 64u[\s\S]*let consumer_dispatch_x = spatial_directory\[42u\][\s\S]*consumer_dispatch_x <= consumer_group_count[\s\S]*field_dispatch_y\(consumer_group_count, consumer_dispatch_x\)/
  );
  assert.doesNotMatch(
    schroederSpatialMechanicsFieldViewV2Wgsl,
    /spatial_directory\[42u\] == active_dispatch_x/
  );
  assert.match(
    schroederSpatialMechanicsFieldViewV2Wgsl,
    /unique_evidence\[7u\] == 3u/
  );
});

test('directory-v2 mechanics field treats valid inactive and other-level rows as non-selected work', () => {
  const classifyActiveRow = ({
    mass,
    level,
    spacing
  }, {
    selectedLevel,
    gridSpacing
  }) => {
    if (!(mass > 0) || level !== selectedLevel) {
      return 'non-selected';
    }
    if (
      Math.fround(spacing) !== Math.fround(gridSpacing)
    ) {
      return 'invalid';
    }
    return 'selected';
  };
  const generationGlobalActiveRows = [
    { physicalSource: 1, mass: 1, level: 0, spacing: 0.25 },
    { physicalSource: 2, mass: 0, level: 0, spacing: 0.25 },
    { physicalSource: 3, mass: 1, level: 1, spacing: 0.5 }
  ];
  assert.deepEqual(
    generationGlobalActiveRows.map((row) => classifyActiveRow(row, {
      selectedLevel: 0,
      gridSpacing: 0.25
    })),
    ['selected', 'non-selected', 'non-selected']
  );
  assert.deepEqual(
    generationGlobalActiveRows.map((row) => classifyActiveRow(row, {
      selectedLevel: 1,
      gridSpacing: 0.5
    })),
    ['non-selected', 'non-selected', 'selected']
  );
  assert.equal(
    classifyActiveRow({
      physicalSource: 1,
      mass: 1,
      level: 0,
      spacing: 0.5
    }, {
      selectedLevel: 0,
      gridSpacing: 0.25
    }),
    'invalid'
  );

  const emitStart =
    schroederSpatialMechanicsFieldViewV2Wgsl.indexOf(
      'fn emit_field_candidates_v2('
    );
  const emitEnd =
    schroederSpatialMechanicsFieldViewV2Wgsl.indexOf(
      'fn materialize_stencil_field_indices_v2(',
      emitStart
    );
  assert.notEqual(emitStart, -1);
  assert.notEqual(emitEnd, -1);
  const emitKernel = schroederSpatialMechanicsFieldViewV2Wgsl.slice(
    emitStart,
    emitEnd
  );
  const nonSelectedStart = emitKernel.indexOf(
    '// ActiveSource is generation-global'
  );
  const spacingMismatchStart = emitKernel.indexOf(
    'bitcast<u32>(source_rows[row + 1u])',
    nonSelectedStart
  );
  const selectedStart = emitKernel.indexOf(
    'let mechanical_family_id',
    spacingMismatchStart
  );
  assert.notEqual(nonSelectedStart, -1);
  assert.notEqual(spacingMismatchStart, -1);
  assert.notEqual(selectedStart, -1);

  const malformedInputBlock = emitKernel.slice(0, nonSelectedStart);
  const nonSelectedBlock = emitKernel.slice(
    nonSelectedStart,
    spacingMismatchStart
  );
  const spacingMismatchBlock = emitKernel.slice(
    spacingMismatchStart,
    selectedStart
  );
  assert.match(
    nonSelectedBlock,
    /!\(source_rows\[row \+ 6u\] > 0\.0\)[\s\S]*level != params\.selected_level/
  );
  assert.match(
    nonSelectedBlock,
    /field_store\(descriptor \+ 3u, 0u\)[\s\S]*active_ordinal \* 27u \+ candidate_ordinal/
  );
  assert.doesNotMatch(nonSelectedBlock, /field_record_invalid_source\(\)/);
  assert.match(
    spacingMismatchBlock,
    /field_record_invalid_source\(\)[\s\S]*active_ordinal \* 27u \+ candidate_ordinal/
  );
  assert.ok(
    (malformedInputBlock.match(/field_record_invalid_source\(\)/g) ?? [])
      .length >= 2
  );
});

test('directory-v2 mechanics-field encode uses GPU-only A authority with zero hot-path allocations', async () => {
  const device = createFakeDevice();
  const fixture = createDirectoryV2MechanicsParent(device, {
    physicalSourceCount: 4,
    physicalSourceCapacity: 8,
    buildOrdinal: 37
  });
  const runtime = createSchroederSpatialMechanicsFieldViewGpu(device, {
    maxSourceCount: 8,
    gridNodeCount: 8,
    gridDims: [2, 2, 2],
    gridShift: 1,
    gridSpacingM: 0.25,
    arenaCount: 1,
    enableDirectoryV2: true
  });
  assert.equal(runtime.directoryV2Prepared, true);
  assert.ok(runtime.sourceAuthorityVersions.includes(
    SCHROEDER_SPATIAL_MECHANICS_FIELD_SOURCE_AUTHORITY_V2
  ));
  assert.ok(runtime.allocationEntries().some(({ role }) => (
    role.endsWith('radix-gpu-count-control')
  )));
  const exactAuthority = fixture.parentMechanicsView.activeSourceCountAuthority;
  fixture.parentMechanicsView.activeSourceCountAuthority = {
    ...exactAuthority
  };
  assert.throws(
    () => runtime.encode(device.createCommandEncoder(), {
      sourceBuffer: fixture.sourceBuffer,
      identityBuffer: fixture.identityBuffer,
      sourceCount: 4,
      sourceRowLayoutId:
        SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
      identityStrideWords: 1,
      selectedLevel: 0,
      parentMechanicsView: fixture.parentMechanicsView
    }),
    /exact active-source and spatial lineage/
  );
  fixture.parentMechanicsView.activeSourceCountAuthority = exactAuthority;

  const bufferCountBeforeEncode = device.buffers.length;
  const encoder = device.createCommandEncoder();
  const field = runtime.encode(encoder, {
    sourceBuffer: fixture.sourceBuffer,
    identityBuffer: fixture.identityBuffer,
    sourceCount: 4,
    sourceRowLayoutId:
      SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
    identityStrideWords: 1,
    selectedLevel: 0,
    parentMechanicsView: fixture.parentMechanicsView
  });
  assert.equal(device.buffers.length, bufferCountBeforeEncode);
  assert.equal(field.gpuBufferCreationCountDuringEncode, 0);
  const candidateKeyEntry = runtime.allocationEntries().find(({ role }) => (
    role === 'mechanics-field-candidate-keys'
  ));
  assert.ok(candidateKeyEntry?.buffer);
  assert.equal(
    candidateKeyEntry.buffer.size,
    field.layout.candidateCapacity
      * 12
      * Float32Array.BYTES_PER_ELEMENT
  );
  assert.equal(field.candidateKeyBuffer, candidateKeyEntry.buffer);
  assert.equal(runtime.ownsExecution(field), true);
  assert.equal(field.bufferAllocationCountDuringEncode, 0);
  assert.equal(
    field.sourceAuthorityVersion,
    SCHROEDER_SPATIAL_MECHANICS_FIELD_SOURCE_AUTHORITY_V2
  );
  assert.equal(field.sourceCount, 4);
  assert.equal(field.physicalSourceCount, 4);
  assert.equal(field.activeSourceCapacity, 8);
  assert.equal(field.candidateCount, null);
  assert.equal(field.candidateCapacity, 216);
  assert.equal(field.layout.candidateCapacity, 216);
  assert.equal(Object.hasOwn(field, 'activeSourceCount'), false);
  assert.equal(
    field.constructionRoutePolicy,
    'gpu-authenticated-directory-v2-indirect-gpu-count-radix'
  );
  assert.equal(field.retainedMemoryScaling, 'physical-source-capacity');
  assert.equal(
    field.computeDispatchScaling,
    'gpu-active-source-count-and-occupied-field-count'
  );
  assert.equal(field.readbackPerformed, false);
  assert.equal(
    field.sourceDispatchIndirectBuffer,
    fixture.activeSourceView.activeSourceViewBuffer
  );
  assert.equal(
    field.sourceDispatchIndirectOffsetBytes,
    fixture.activeSourceView.activeDispatchOffsetBytes
  );
  assert.equal(
    field.candidateDispatchIndirectOffsetBytes,
    fixture.activeSourceView.candidateDispatchOffsetBytes
  );
  assert.deepEqual(field.constructionDispatchEvidence, {
    workgroupSize: 64,
    linearization: 'linearGroup=workgroup.x+workgroup.y*dispatchX',
    sourceWorkIdentity: 'gpu-active-ordinal',
    sourceInvocationCountAuthority: {
      buffer: fixture.activeSourceView.activeSourceViewBuffer,
      offsetWords: 18
    },
    candidateInvocationCountAuthority: {
      buffer: fixture.activeSourceView.activeSourceViewBuffer,
      offsetWords: 43
    },
    generationSealAuthority: {
      buffer: fixture.activeSourceView.activeSourceViewBuffer,
      offsetWords: 30,
      expected: 37
    },
    maxComputeWorkgroupsPerDimension: 65535,
    authenticatedByGpuFinalizer: true,
    hostActiveCountReadbackRequired: false
  });

  const fieldPasses = encoder.events.filter(({ kind }) => kind === 'pass');
  const sourcePass = fieldPasses.find(({ descriptor }) => (
    descriptor.label?.endsWith('EmitCandidatesV2')
  ));
  const stencilPass = fieldPasses.find(({ descriptor }) => (
    descriptor.label?.endsWith('MaterializeStencilMapV2')
  ));
  const assemblePass = fieldPasses.find(({ descriptor }) => (
    descriptor.label?.endsWith('AssembleKeysV2')
  ));
  assert.deepEqual(sourcePass.commands.at(-1).dispatchIndirect, {
    buffer: fixture.activeSourceView.activeSourceViewBuffer,
    byteOffset: fixture.activeSourceView.activeDispatchOffsetBytes
  });
  for (const pass of [stencilPass, assemblePass]) {
    assert.deepEqual(pass.commands.at(-1).dispatchIndirect, {
      buffer: fixture.activeSourceView.activeSourceViewBuffer,
      byteOffset: fixture.activeSourceView.candidateDispatchOffsetBytes
    });
  }
  const gpuCountBinding = device.bindGroups.find(({ label }) => (
    label?.endsWith('gpu-count-prepare-bind-group')
  ));
  assert.equal(
    gpuCountBinding.entries.find(({ binding }) => binding === 0).resource.buffer,
    fixture.activeSourceView.activeSourceViewBuffer
  );
  const gpuCountConfig = gpuCountBinding.entries.find(
    ({ binding }) => binding === 2
  ).resource.buffer;
  const gpuCountConfigWrite = device.writes.find(({ buffer }) => (
    buffer === gpuCountConfig
  ));
  assert.ok(gpuCountConfigWrite);
  const gpuCountWords = new Uint32Array(
    gpuCountConfigWrite.data.buffer,
    gpuCountConfigWrite.data.byteOffset,
    gpuCountConfigWrite.data.byteLength / Uint32Array.BYTES_PER_ELEMENT
  );
  assert.deepEqual(Array.from(gpuCountWords.slice(0, 8)), [
    43,
    30,
    37,
    216,
    3,
    3,
    64,
    41
  ]);

  fixture.markParentSubmitted();
  runtime.markExecutionSubmitted(field);
  assert.equal(
    validateSchroederSpatialMechanicsFieldViewDescriptor(field).admitted,
    true
  );
  const originalFieldAuthority = field.activeSourceCountAuthority;
  field.activeSourceCountAuthority = { ...originalFieldAuthority };
  assert.equal(
    validateSchroederSpatialMechanicsFieldViewDescriptor(field).status,
    'schroeder-spatial-mechanics-field-view-rejected-v2-source-authority'
  );
  field.activeSourceCountAuthority = originalFieldAuthority;

  assert.equal(await runtime.releaseExecutionAfter(field), true);
  assert.equal(runtime.destroy(), true);
});

test('mechanics-field arenas reuse exact immutable bind groups', () => {
  const device = createFakeDevice();
  const fixture = createDirectoryV2MechanicsParent(device, {
    physicalSourceCount: 4,
    physicalSourceCapacity: 8,
    buildOrdinal: 37
  });
  const runtime = createSchroederSpatialMechanicsFieldViewGpu(device, {
    maxSourceCount: 8,
    gridNodeCount: 8,
    gridDims: [2, 2, 2],
    gridShift: 1,
    gridSpacingM: 0.25,
    arenaCount: 1,
    enableDirectoryV2: true
  });
  const args = {
    sourceBuffer: fixture.sourceBuffer,
    identityBuffer: fixture.identityBuffer,
    sourceCount: 4,
    sourceRowLayoutId:
      SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
    identityStrideWords: 1,
    selectedLevel: 0,
    parentMechanicsView: fixture.parentMechanicsView
  };
  const first = runtime.encode(device.createCommandEncoder(), args);
  const firstP2gWorkspace = runtime.p2gWorkspaceForExecution(first);
  const p2gLayout = {};
  const p2gEntries = [
    { binding: 0, resource: { buffer: firstP2gWorkspace.paramsBuffer } }
  ];
  const consumerBindGroupCount = device.bindGroups.length;
  const firstConsumerBindGroup = runtime.createExactConsumerBindGroup(first, {
    cacheKey: 'test-p2g-main',
    layout: p2gLayout,
    entries: p2gEntries,
    label: 'test-p2g-main-bindings'
  });
  assert.equal(
    runtime.createExactConsumerBindGroup(first, {
      cacheKey: 'test-p2g-main',
      layout: p2gLayout,
      entries: p2gEntries,
      label: 'test-p2g-main-bindings'
    }),
    firstConsumerBindGroup
  );
  assert.equal(device.bindGroups.length, consumerBindGroupCount + 1);
  const explicitBindGroupCount = device.bindGroups.filter(
    (group) => group.label?.endsWith('-bindings')
  ).length;
  assert.equal(runtime.releaseExecution(first, { discardedEncoder: true }), true);
  const second = runtime.encode(device.createCommandEncoder(), args);
  assert.equal(
    device.bindGroups.filter((group) => group.label?.endsWith('-bindings')).length,
    explicitBindGroupCount
  );
  assert.equal(runtime.p2gWorkspaceForExecution(second), firstP2gWorkspace);
  assert.equal(
    runtime.createExactConsumerBindGroup(second, {
      cacheKey: 'test-p2g-main',
      layout: p2gLayout,
      entries: p2gEntries,
      label: 'test-p2g-main-bindings'
    }),
    firstConsumerBindGroup
  );
  assert.equal(device.bindGroups.length, consumerBindGroupCount + 1);
  assert.equal(runtime.releaseExecution(second, { discardedEncoder: true }), true);
  assert.equal(runtime.destroy(), true);
});

test('directory-v2 topology successor copies immutable topology into fresh mutable state', async () => {
  const device = createFakeDevice();
  const predecessorFixture = createDirectoryV2MechanicsParent(device, {
    physicalSourceCount: 4,
    physicalSourceCapacity: 8,
    buildOrdinal: 37
  });
  const runtime = createSchroederSpatialMechanicsFieldViewGpu(device, {
    maxSourceCount: 8,
    activeSourceCapacity: 8,
    gridNodeCount: 8,
    gridDims: [2, 2, 2],
    gridShift: 1,
    gridSpacingM: 0.25,
    arenaCount: 2,
    enableDirectoryV2: true
  });
  const predecessorEncoder = device.createCommandEncoder();
  const predecessor = runtime.encode(predecessorEncoder, {
    sourceBuffer: predecessorFixture.sourceBuffer,
    identityBuffer: predecessorFixture.identityBuffer,
    sourceCount: 4,
    sourceRowLayoutId:
      SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
    identityStrideWords: 1,
    selectedLevel: 0,
    parentMechanicsView: predecessorFixture.parentMechanicsView
  });
  predecessorFixture.markParentSubmitted();
  runtime.markExecutionSubmitted(predecessor);

  const successorSourceBuffer = createOwnedTestBuffer(device, {
    label: 'mechanics-field-v2-successor-source',
    size: 4 * 16 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const successorFixture = createDirectoryV2MechanicsParent(device, {
    physicalSourceCount: 4,
    physicalSourceCapacity: 8,
    buildOrdinal: 38,
    suppliedSourceBuffer: successorSourceBuffer,
    suppliedIdentityBuffer: predecessorFixture.identityBuffer,
    identityOverrides: {
      generationId: 42,
      storageGeneration: 12,
      physicsSubstep: 1,
      positionEpoch: 18
    }
  });
  const successorEncoder = device.createCommandEncoder();
  const successor = runtime.encodeTopologySuccessor(successorEncoder, {
    topologyPredecessor: predecessor,
    sourceBuffer: successorFixture.sourceBuffer,
    identityBuffer: successorFixture.identityBuffer,
    sourceCount: 4,
    sourceRowLayoutId:
      SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
    identityStrideWords: 1,
    selectedLevel: 0,
    parentMechanicsView: successorFixture.parentMechanicsView
  });

  assert.equal(successor.topologyConstructionMode, 'conservative-successor-copy');
  assert.equal(successor.topologyPredecessorGenerationId, predecessor.generationId);
  assert.notEqual(successor.fieldViewBuffer, predecessor.fieldViewBuffer);
  assert.notEqual(
    successor.stableCandidateOrderBuffer,
    predecessor.stableCandidateOrderBuffer
  );
  assert.equal(successor.encodedComputePassCount, 1);
  assert.equal(successor.encodedDispatchCount, 1);
  assert.deepEqual(runtime.stateMutationState(successor), {
    ordinal: 0,
    encoding: SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY,
    operation: 'topology-successor-ready',
    pending: false,
    publicationLocked: false,
    quarantined: false
  });
  const copies = successorEncoder.events.filter(({ kind }) => kind === 'copy');
  assert.equal(copies.length, 2);
  assert.deepEqual(copies[0], {
    kind: 'copy',
    source: predecessor.fieldViewBuffer,
    sourceOffset: 0,
    destination: successor.fieldViewBuffer,
    destinationOffset: 0,
    size: successor.layout.accumulatorOffsetWords * Uint32Array.BYTES_PER_ELEMENT
  });
  assert.equal(copies[1].source, predecessor.stableCandidateOrderBuffer);
  assert.equal(copies[1].destination, successor.stableCandidateOrderBuffer);
  const mutableClear = successorEncoder.events.find(({ kind, buffer }) => (
    kind === 'clear' && buffer === successor.fieldViewBuffer
  ));
  assert.equal(
    mutableClear.offset,
    successor.layout.accumulatorOffsetWords * Uint32Array.BYTES_PER_ELEMENT
  );
  assert.equal(
    mutableClear.size,
    successor.layout.byteLength - mutableClear.offset
  );
  const successorPass = successorEncoder.events.find(({ kind, descriptor }) => (
    kind === 'pass' && descriptor.label?.endsWith('FinalizeTopologySuccessor')
  ));
  assert.deepEqual(successorPass.commands.at(-1).dispatch, [1, 1, 1]);

  successorFixture.markParentSubmitted();
  runtime.markExecutionSubmitted(successor);
  const successorAdmission =
    validateSchroederSpatialMechanicsFieldViewDescriptor(successor);
  assert.equal(
    successorAdmission.admitted,
    true,
    successorAdmission.status
  );
  assert.equal(runtime.releaseExecutionQueueOrdered(successor), true);
  assert.equal(await runtime.releaseExecutionAfter(predecessor), true);
  assert.equal(runtime.destroy(), true);
});

test('mechanics-field runtime publishes GPU-authored sparse work evidence under a small device limit', async () => {
  const device = createFakeDevice({
    limits: { maxComputeWorkgroupsPerDimension: 4 }
  });
  const particleCount = 10;
  const levelAssignment = createLevelAssignment(device, particleCount);
  const identityBuffer = device.createBuffer({
    label: 'mechanics-field-2d-identity-source',
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
      gridNodeCount: 2 * 2 * 2,
      gridDims: [2, 2, 2],
      gridShift: 1,
      gridSpacingM: 0.25
    }
  });

  assert.equal(generation.ready, true, generation.reason);
  const field = generation.mechanicsFieldView;
  assert.equal(field.sourceDispatchWorkgroups, null);
  assert.equal(field.candidateDispatchWorkgroups, null);
  assert.equal(
    field.sourceDispatchIndirectBuffer,
    generation.activeSourceView.activeSourceViewBuffer
  );
  assert.equal(
    field.candidateDispatchIndirectBuffer,
    generation.activeSourceView.activeSourceViewBuffer
  );
  assert.equal(
    field.sourceDispatchIndirectOffsetBytes,
    generation.activeSourceView.activeDispatchOffsetBytes
  );
  assert.equal(
    field.candidateDispatchIndirectOffsetBytes,
    generation.activeSourceView.candidateDispatchOffsetBytes
  );
  assert.equal(field.maxComputeWorkgroupsPerDimension, 4);
  assert.equal(
    field.directDispatchLinearization,
    'linearGroup=workgroup.x+workgroup.y*dispatchX'
  );
  assert.equal(field.consumerDispatchDimensions, 2);
  assert.equal(field.consumerDispatchWorkgroupSize, 64);
  assert.equal(
    field.consumerDispatchLinearization,
    'linearGroup=workgroup.x+workgroup.y*dispatchX'
  );
  assert.equal(field.constructionDispatchEvidence.workgroupSize, 64);
  assert.equal(
    field.constructionDispatchEvidence.linearization,
    'linearGroup=workgroup.x+workgroup.y*dispatchX'
  );
  assert.equal(
    field.constructionDispatchEvidence.sourceWorkIdentity,
    'gpu-active-ordinal'
  );
  assert.equal(
    field.constructionDispatchEvidence.sourceInvocationCountAuthority.buffer,
    generation.activeSourceView.activeSourceViewBuffer
  );
  assert.equal(
    field.constructionDispatchEvidence.sourceInvocationCountAuthority.offsetWords,
    18
  );
  assert.equal(
    field.constructionDispatchEvidence.candidateInvocationCountAuthority.offsetWords,
    43
  );
  assert.equal(
    field.constructionDispatchEvidence.generationSealAuthority.expected,
    generation.activeSourceView.buildOrdinal
  );
  assert.equal(
    field.constructionDispatchEvidence.maxComputeWorkgroupsPerDimension,
    4
  );
  assert.equal(
    field.constructionDispatchEvidence.authenticatedByGpuFinalizer,
    true
  );
  assert.equal(
    field.constructionDispatchEvidence.hostActiveCountReadbackRequired,
    false
  );
  assert.equal(
    validateSchroederSpatialMechanicsFieldViewDescriptor(field).admitted,
    true
  );
  for (const malformed of [
    {
      ...field,
      sourceDispatchWorkgroups: [2, 1, 1]
    },
    {
      ...field,
      candidateDispatchWorkgroups: [4, 1, 1]
    },
    {
      ...field,
      consumerDispatchDimensions: 1
    },
    {
      ...field,
      constructionDispatchEvidence: {
        ...field.constructionDispatchEvidence,
        authenticatedByGpuFinalizer: false
      }
    }
  ]) {
    assert.equal(
      validateSchroederSpatialMechanicsFieldViewDescriptor(malformed).status,
      'schroeder-spatial-mechanics-field-view-rejected-layout'
    );
  }

  const fieldPasses = device.encoders.flatMap(({ events }) => (
    events.filter(({ kind, descriptor }) => (
      kind === 'pass' && descriptor.label?.includes('mechanics-field-view')
    ))
  ));
  const indirectDispatchBySuffix = Object.fromEntries(
    fieldPasses
      .filter(({ descriptor }) => (
        /(?:EmitCandidatesV2|MaterializeStencilMapV2|AssembleKeysV2)$/.test(
          descriptor.label
        )
      ))
      .map(({ descriptor, commands }) => [
        ['EmitCandidatesV2', 'MaterializeStencilMapV2', 'AssembleKeysV2'].find(
          (suffix) => descriptor.label.endsWith(suffix)
        ),
        commands.at(-1)?.dispatchIndirect?.byteOffset
      ])
  );
  assert.deepEqual(indirectDispatchBySuffix, {
    EmitCandidatesV2: generation.activeSourceView.activeDispatchOffsetBytes,
    MaterializeStencilMapV2:
      generation.activeSourceView.candidateDispatchOffsetBytes,
    AssembleKeysV2:
      generation.activeSourceView.candidateDispatchOffsetBytes
  });

  const paramsBuffer = field.ownerRuntime.allocationEntries().find(
    ({ role, arenaIndex }) => (
      role === 'mechanics-field-params' && arenaIndex === field.arenaIndex
    )
  ).buffer;
  const paramsWrite = device.writes.find(({ buffer }) => buffer === paramsBuffer);
  const paramsWords = new Uint32Array(
    paramsWrite.data.buffer,
    paramsWrite.data.byteOffset,
    paramsWrite.data.byteLength / 4
  );
  assert.deepEqual(
    Array.from(paramsWords.slice(42, 48)),
    [0, 0, 4, 0, 0, 2]
  );

  assert.equal(
    releaseSchroederSpatialEpochGenerationAfterQueue(generation, device),
    true
  );
  assert.equal(await generation.releasePromise, true);
});

test('mechanics-field runtime rejects only work beyond two-dimensional dispatch capacity', () => {
  const device = createFakeDevice({
    limits: { maxComputeWorkgroupsPerDimension: 2 }
  });
  assert.throws(
    () => createSchroederSpatialMechanicsFieldViewGpu(device, {
      maxSourceCount: 16,
      gridNodeCount: 8,
      gridDims: [2, 2, 2],
      gridShift: 1,
      gridSpacingM: 0.25,
      arenaCount: 1
    }),
    /mechanics field candidate dispatch requires 7 workgroups beyond 2x2/
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
  assert.deepEqual(
    stencilMap.entries.map(({ binding }) => binding),
    [2, 3, 5, 7, 8, 9, 11]
  );
  const uniqueEvidence = stencilMap.entries.find(({ binding }) => binding === 5);
  const exclusivePrefix = stencilMap.entries.find(({ binding }) => binding === 9);
  assert.match(uniqueEvidence.resource.buffer.label, /radix-evidence$/);
  assert.match(exclusivePrefix.resource.buffer.label, /radix-head-offsets$/);
  assert.notEqual(uniqueEvidence.resource.buffer, exclusivePrefix.resource.buffer);
  assert.equal(
    stencilMap.entries.find(({ binding }) => binding === 11).resource.buffer,
    generation.activeSourceView.activeSourceViewBuffer
  );

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

test('mechanics-field construction is one exact GPU-count packed-radix topology', async () => {
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
  assert.equal(
    field.radixHistogramScanMode,
    'gpu-count-fixed-hierarchical-fused-top'
  );
  assert.equal(field.candidateCount, null);
  assert.equal(field.stableCandidateOrderCount, null);
  assert.equal(
    field.stableCandidateOrderCountAuthority.buffer,
    generation.activeSourceView.activeSourceViewBuffer
  );
  assert.equal(field.stableCandidateOrderCountAuthority.offsetWords, 43);
  assert.equal(field.stableCandidateOrderCountAuthority.sealOffsetWords, 30);
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
  assert.equal(
    field.constructionRoutePolicy,
    'gpu-authenticated-directory-v2-indirect-gpu-count-radix'
  );
  assert.ok(field.encodedDispatchCount > 0);
  assert.equal(field.encodedComputePassCount, 6);
  assert.equal(
    field.ownerRuntime.pipelineCount,
    9 + field.ownerRuntime.arenaCount * 23
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
  assert.equal(fieldCommands.some(({ dispatchIndirect }) => (
    dispatchIndirect !== undefined
  )), true);
  assert.deepEqual(
    fieldPasses.map(({ descriptor }) => (
      [
        'EmitCandidatesV2',
        'GpuCountPrepare',
        'GroupedGpuCountRadixUnique',
        'MaterializeStencilMapV2',
        'AssembleKeysV2',
        'Finalize'
      ].find((suffix) => descriptor.label.endsWith(suffix))
    )),
    [
      'EmitCandidatesV2',
      'GpuCountPrepare',
      'GroupedGpuCountRadixUnique',
      'MaterializeStencilMapV2',
      'AssembleKeysV2',
      'Finalize'
    ]
  );
  assert.equal(fieldCommands.filter(({ pipeline }) => (
    pipeline.label.endsWith('-serial-histogram-scan')
  )).length, 0);
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
  assert.deepEqual(
    Array.from(paramsWords.slice(42, 48)),
    [0, 0, 65535, 0, 0, 2]
  );

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
      'schroeder-spatial-generation-command-encoder',
      'schroeder-spatial-active-source-view-build',
      'schroeder-spatial-directory-prepare',
      'schroeder-spatial-key-emission',
      'schroeder-spatial-directory-gpu-count-radix-sort-unique',
      'schroeder-spatial-directory-assemble-finalize',
      'schroeder-spatial-exact-near-cell-tree-build',
      'schroeder-spatial-derived-view-build',
      'schroeder-spatial-mechanics-view-build',
      'schroeder-spatial-mechanics-field-view-build',
      'schroeder-spatial-mechanics-field-candidate-emission',
      'schroeder-spatial-mechanics-field-radix-sort-unique-gpu-count',
      'schroeder-spatial-mechanics-field-stencil-map',
      'schroeder-spatial-mechanics-field-key-assembly',
      'schroeder-spatial-mechanics-field-finalize'
    ]
  );
  assert.equal(ends.length, begins.length);
  assert.ok(ends.every(({ encoder, token }) => (
    encoder === token.encoder && begins.includes(token)
  )));
  const fieldSubstages = begins
    .map(({ descriptor }) => descriptor)
    .filter(({ producerId }) => (
      producerId.startsWith('schroeder-spatial-mechanics-field-')
      && producerId !== 'schroeder-spatial-mechanics-field-view-build'
    ));
  assert.deepEqual(
    fieldSubstages.map(({ producerId }) => producerId),
    [
      'schroeder-spatial-mechanics-field-candidate-emission',
      'schroeder-spatial-mechanics-field-radix-sort-unique-gpu-count',
      'schroeder-spatial-mechanics-field-stencil-map',
      'schroeder-spatial-mechanics-field-key-assembly',
      'schroeder-spatial-mechanics-field-finalize'
    ]
  );
  assert.ok(fieldSubstages.every(({ generationId }) => (
    generationId === generation.execution.generationId
  )));
  assert.ok(fieldSubstages.every(({ sourceCount }) => (
    sourceCount === levelAssignment.particleCount
  )));
  assert.ok(fieldSubstages.every(({ candidateCount }) => (
    candidateCount === null
  )));
  assert.ok(fieldSubstages.every(({ candidateCountSource }) => (
    candidateCountSource === 'active-source-view-word-43'
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

test('mechanics-field publication locks retire queue-ordered without a host fence', async () => {
  const device = createFakeDevice();
  const { generation } = createSubmittedMechanicsFieldGeneration(device);
  const field = generation.mechanicsFieldView;
  const runtime = field.ownerRuntime;
  const publicationLock = runtime.acquireStatePublicationLock(field, {
    owner: Object.freeze({ kind: 'exact-successor-retirement-test' })
  });
  const mutation = runtime.reserveStateMutation(field, {
    expectedOrdinal: 0,
    expectedEncoding: SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY,
    outputEncoding:
      SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT,
    operation: 'private-state-consumed-by-exact-queued-successor',
    publicationLock
  });
  runtime.markStateMutationSubmitted(mutation);

  let hostQueueFenceCount = 0;
  device.queue.onSubmittedWorkDone = () => {
    hostQueueFenceCount += 1;
    return new Promise(() => {});
  };
  assert.equal(
    await runtime.retireStatePublicationLockQueueOrdered(
      field,
      publicationLock
    ),
    true
  );
  assert.equal(hostQueueFenceCount, 0);
  assert.equal(field.released, true);
  assert.equal(runtime.ownsExecution(field), false);
  assert.equal(
    await runtime.executionRetirementCompletionPromise(field),
    true
  );
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

test('native WebGPU compiles the retained directory-v2 mechanics-field pipeline family', {
  skip: RUN_NATIVE_V2_COMPILE
    ? false
    : 'set ULG_RUN_NATIVE_MECHANICS_FIELD_V2_COMPILE=1 for native compilation',
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
  let result;
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(NATIVE_BASE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000
    });
    result = await page.evaluate(async () => {
      const adapter = await navigator.gpu?.requestAdapter({
        powerPreference: 'high-performance'
      });
      if (!adapter) {
        return {
          status: 'unsupported',
          reason: 'WebGPU adapter unavailable'
        };
      }
      const device = await adapter.requestDevice();
      const uncapturedErrors = [];
      device.addEventListener('uncapturederror', (event) => {
        uncapturedErrors.push(event.error?.message || String(event.error));
      });
      device.pushErrorScope('validation');
      const nonce = Date.now();
      const module = await import(
        `/src/runtime/sph/schroederSpatialMechanicsFieldViewGpu.js`
          + `?nativeDirectoryV2Compile=${nonce}`
      );
      let runtime = null;
      let creationError = null;
      try {
        runtime = module.createSchroederSpatialMechanicsFieldViewGpu(device, {
          maxSourceCount: 4,
          gridNodeCount: 8,
          gridDims: [2, 2, 2],
          gridShift: 1,
          gridSpacingM: 0.25,
          arenaCount: 1,
          enableDirectoryV2: true
        });
        await device.queue.onSubmittedWorkDone();
      } catch (error) {
        creationError = error?.message || String(error);
      }
      const validationError = await device.popErrorScope();
      try {
        runtime?.destroy();
      } catch (error) {
        creationError ??= error?.message || String(error);
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
      device.destroy?.();
      return {
        status: 'complete',
        creationError,
        validationError: validationError?.message || null,
        uncapturedErrors
      };
    });
  } finally {
    await browser.close();
  }
  assert.equal(result.status, 'complete', result.reason);
  assert.equal(result.creationError, null);
  assert.equal(result.validationError, null);
  assert.deepEqual(result.uncapturedErrors, []);
});

test('native directory-v2 mechanics field admits all-dormant A=0 and preserves sparse physical descriptors', {
  skip: RUN_NATIVE_V2_COMPILE
    ? false
    : 'set ULG_RUN_NATIVE_MECHANICS_FIELD_V2_COMPILE=1 for native execution',
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
  let result;
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(NATIVE_BASE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000
    });
    result = await page.evaluate(async () => {
      const adapter = await navigator.gpu?.requestAdapter({
        powerPreference: 'high-performance'
      });
      if (!adapter) {
        return {
          status: 'unsupported',
          reason: 'WebGPU adapter unavailable'
        };
      }
      const device = await adapter.requestDevice();
      const uncapturedErrors = [];
      device.addEventListener('uncapturederror', (event) => {
        uncapturedErrors.push(event.error?.message || String(event.error));
      });
      device.pushErrorScope('validation');
      const nonce = Date.now();
      const [
        runtimeModule,
        fieldAbi,
        activeAbi,
        epochAbi,
        mechanicsAbi
      ] = await Promise.all([
        import(
          `/src/runtime/sph/schroederSpatialMechanicsFieldViewGpu.js`
            + `?nativeDirectoryV2Execute=${nonce}`
        ),
        import(
          `/ulg-gpu-abi/src/schroederSpatialMechanicsFieldView.js`
            + `?nativeDirectoryV2Execute=${nonce}`
        ),
        import(
          `/ulg-gpu-abi/src/schroederSpatialActiveSourceView.js`
            + `?nativeDirectoryV2Execute=${nonce}`
        ),
        import(
          `/ulg-gpu-abi/src/schroederSpatialEpoch.js`
            + `?nativeDirectoryV2Execute=${nonce}`
        ),
        import(
          `/ulg-gpu-abi/src/schroederSpatialMechanicsView.js`
            + `?nativeDirectoryV2Execute=${nonce}`
        )
      ]);
      const physicalSourceCount = 4;
      const physicalSourceCapacity = 8;
      const buildOrdinal = 37;
      const gridNodeCount = 125;
      const identity = {
        generationId: 41,
        deviceOrdinal: 2,
        laneOrdinal: 3,
        leaseToken: 5,
        sourceFamilyId: 7,
        storageGeneration: 11,
        physicsTick: 13,
        physicsSubstep: 0,
        positionEpoch: 17,
        topologyEpoch: 19,
        chartEpoch: 23,
        levelEpoch: 29,
        supportEpoch: 31
      };
      const runtimes = new Map();
      const runtimeFor = (gridSpacingM) => {
        const key = Math.fround(gridSpacingM);
        let runtime = runtimes.get(key);
        if (!runtime) {
          runtime =
            runtimeModule.createSchroederSpatialMechanicsFieldViewGpu(
              device,
              {
                maxSourceCount: physicalSourceCapacity,
                gridNodeCount,
                gridDims: [5, 5, 5],
                gridShift: 1,
                gridSpacingM,
                arenaCount: 1,
                enableDirectoryV2: true
              }
            );
          runtimes.set(key, runtime);
        }
        return runtime;
      };
      const makeBuffer = (label, size, usage) => device.createBuffer({
        label,
        size,
        usage
      });
      const f32Bits = (value) => {
        const words = new Uint32Array(1);
        new Float32Array(words.buffer)[0] = Math.fround(value);
        return words[0];
      };
      const signedOrderKey = (value) => (
        ((value | 0) ^ 0x8000_0000) >>> 0
      );
      const readWords = async (buffer, byteLength, label) => {
        const readback = makeBuffer(
          label,
          byteLength,
          GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        );
        const encoder = device.createCommandEncoder();
        encoder.copyBufferToBuffer(buffer, 0, readback, 0, byteLength);
        device.queue.submit([encoder.finish()]);
        await readback.mapAsync(GPUMapMode.READ);
        const words = new Uint32Array(readback.getMappedRange()).slice();
        readback.unmap();
        readback.destroy();
        return words;
      };

      const runCase = async ({
        label,
        activePhysicalSources,
        tamperCompletion = false,
        selectedLevel = 0,
        gridSpacingM = 0.25,
        sourceLevels = [0, 0, 0, 0],
        sourceSpacings = [0.25, 0.25, 0.25, 0.25],
        sourceMasses = null
      }) => {
        const activeCount = activePhysicalSources.length;
        const candidateCount = activeCount * 27;
        const activePhysicalSet = new Set(activePhysicalSources);
        const sourceRows = new Float32Array(physicalSourceCount * 16);
        for (let physical = 0; physical < physicalSourceCount; physical += 1) {
          const row = physical * 16;
          sourceRows[row] = sourceLevels[physical];
          sourceRows[row + 1] = sourceSpacings[physical];
          sourceRows[row + 6] = sourceMasses
            ? sourceMasses[physical]
            : (activePhysicalSet.has(physical) ? 1 : 0);
          sourceRows[row + 8] = 2;
          sourceRows[row + 9] = 1;
          sourceRows[row + 10] = 1;
          sourceRows[row + 12] = 0.5;
          sourceRows[row + 13] = 0.5;
          sourceRows[row + 14] = 0.5;
          sourceRows[row + 15] = 0;
        }
        const sourceBuffer = makeBuffer(
          `${label}-source`,
          sourceRows.byteLength,
          GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        );
        const identityWords = new Uint32Array([101, 103, 107, 109]);
        const identityBuffer = makeBuffer(
          `${label}-identity`,
          identityWords.byteLength,
          GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        );
        device.queue.writeBuffer(sourceBuffer, 0, sourceRows);
        device.queue.writeBuffer(identityBuffer, 0, identityWords);

        const activeLayout =
          activeAbi.createSchroederSpatialActiveSourceViewLayout({
            physicalSourceCapacity,
            activeSourceCapacity: physicalSourceCapacity
          });
        const activeWords = new Uint32Array(activeLayout.wordLength);
        activeWords.fill(0xffff_ffff, activeLayout.activeToPhysicalOffsetWords);
        activeWords[0] = activeAbi.SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_MAGIC;
        activeWords[1] = activeAbi.SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_VERSION;
        activeWords[2] =
          activeAbi.SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_READY
          | activeAbi.SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_ADMITTED;
        [
          identity.generationId,
          identity.deviceOrdinal,
          identity.laneOrdinal,
          identity.leaseToken,
          identity.sourceFamilyId,
          identity.storageGeneration,
          identity.physicsTick,
          identity.physicsSubstep,
          identity.positionEpoch,
          identity.topologyEpoch,
          identity.chartEpoch,
          identity.levelEpoch,
          identity.supportEpoch
        ].forEach((word, index) => {
          activeWords[3 + index] = word;
        });
        activeWords[16] = physicalSourceCount;
        activeWords[17] = physicalSourceCapacity;
        activeWords[18] = activeCount;
        activeWords[19] = physicalSourceCapacity;
        activeWords[20] = physicalSourceCount - activeCount;
        activeWords[23] =
          mechanicsAbi.SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0;
        activeWords[24] = 16;
        activeWords[25] = activeLayout.activeToPhysicalOffsetWords;
        activeWords[26] = activeLayout.physicalToActiveOffsetWords;
        activeWords[27] = activeLayout.wordLength;
        activeWords[28] = activeLayout.wordLength;
        activeWords[29] = buildOrdinal;
        activeWords[30] = tamperCompletion
          ? buildOrdinal + 1
          : buildOrdinal;
        activeWords[31] = 0x1234_5678;
        activeWords[32] = physicalSourceCount;
        activeWords[33] = activeCount;
        activeWords[34] = activeCount;
        activeWords[35] = activeCount;
        activeWords[36] = activeCount === 0
          ? 0
          : Math.max(...activePhysicalSources) + 1;
        activeWords[37] = 64;
        activeWords[38] = device.limits.maxComputeWorkgroupsPerDimension;
        activeWords[39] = activeLayout.wordLength;
        activeWords[40] = activeLayout.activeDispatchOffsetWords;
        activeWords[41] = activeLayout.candidateDispatchOffsetWords;
        activeWords[42] = activeLayout.physicalDispatchOffsetWords;
        activeWords[43] = candidateCount;
        activeWords[44] = activeLayout.activeCandidateCapacity;
        activeWords[47] = 0x51ea_1ed1;
        const activeGroupCount = Math.ceil(activeCount / 64);
        const candidateGroupCount = Math.ceil(candidateCount / 64);
        activeWords[48] = activeGroupCount;
        activeWords[49] = 1;
        activeWords[50] = 1;
        activeWords[51] = candidateGroupCount;
        activeWords[52] = 1;
        activeWords[53] = 1;
        activeWords[54] = 1;
        activeWords[55] = 1;
        activeWords[56] = 1;
        activePhysicalSources.forEach((physical, activeOrdinal) => {
          activeWords[
            activeLayout.activeToPhysicalOffsetWords + activeOrdinal
          ] = physical;
          activeWords[
            activeLayout.physicalToActiveOffsetWords + physical
          ] = activeOrdinal;
        });
        const activeSourceViewBuffer = makeBuffer(
          `${label}-active-source`,
          activeWords.byteLength,
          GPUBufferUsage.STORAGE
            | GPUBufferUsage.INDIRECT
            | GPUBufferUsage.COPY_DST
        );
        device.queue.writeBuffer(activeSourceViewBuffer, 0, activeWords);
        let activeSourceView;
        const activeOwner = {
          ownsExecution(execution) {
            return execution === activeSourceView;
          }
        };
        activeSourceView = {
          schema: activeAbi.ULG_SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_SCHEMA,
          status: 'schroeder-spatial-active-source-view-gpu-encoded',
          ready: true,
          selected: true,
          submitPerformed: false,
          sourceBuffer,
          activeSourceViewBuffer,
          layout: activeLayout,
          physicalSourceCount,
          physicalSourceCapacity,
          activeSourceCapacity: physicalSourceCapacity,
          sourceRowLayoutId:
            mechanicsAbi.SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
          sourceRowStrideFloats: 16,
          ...identity,
          buildOrdinal,
          sourceFingerprint: 0x1234_5678,
          activeDispatchOffsetBytes: activeLayout.activeDispatchOffsetBytes,
          candidateDispatchOffsetBytes:
            activeLayout.candidateDispatchOffsetBytes,
          physicalDispatchOffsetBytes:
            activeLayout.physicalDispatchOffsetBytes,
          ownerRuntime: activeOwner
        };
        const activeSourceCountAuthority = Object.freeze({
          schema: activeAbi.ULG_SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_SCHEMA,
          activeSourceView,
          buffer: activeSourceViewBuffer,
          offsetWords: 18,
          offsetBytes: 18 * Uint32Array.BYTES_PER_ELEMENT,
          capacity: physicalSourceCapacity,
          residency: 'gpu-only'
        });

        const directoryLayout = epochAbi.createSchroederSpatialEpochV2Layout({
          physicalSourceCapacity,
          activeSourceCapacity: physicalSourceCapacity,
          cellCapacity: physicalSourceCapacity
        });
        const cellsByKey = new Map();
        for (const physical of activePhysicalSources) {
          const level = Math.round(sourceLevels[physical]);
          const spacing = sourceSpacings[physical];
          const cellCoordinate = Math.floor(0.5 / spacing);
          const key = [
            0,
            signedOrderKey(level),
            signedOrderKey(cellCoordinate),
            signedOrderKey(cellCoordinate),
            signedOrderKey(cellCoordinate)
          ];
          const signature = key.join(':');
          let cell = cellsByKey.get(signature);
          if (!cell) {
            cell = { key, physicalSources: [] };
            cellsByKey.set(signature, cell);
          }
          cell.physicalSources.push(physical);
        }
        const cells = Array.from(cellsByKey.values()).sort((left, right) => {
          for (let index = 0; index < left.key.length; index += 1) {
            const difference = left.key[index] - right.key[index];
            if (difference !== 0) return difference;
          }
          return 0;
        });
        const directoryWords = new Uint32Array(directoryLayout.wordLength);
        directoryWords[0] = epochAbi.SCHROEDER_SPATIAL_EPOCH_MAGIC;
        directoryWords[1] = epochAbi.SCHROEDER_SPATIAL_EPOCH_V2_VERSION;
        directoryWords[2] =
          epochAbi.SCHROEDER_SPATIAL_EPOCH_STATUS_READY
          | epochAbi.SCHROEDER_SPATIAL_EPOCH_STATUS_ADMITTED;
        [
          identity.generationId,
          identity.deviceOrdinal,
          identity.laneOrdinal,
          identity.leaseToken,
          identity.sourceFamilyId,
          identity.storageGeneration,
          identity.physicsTick,
          identity.physicsSubstep,
          identity.positionEpoch,
          identity.topologyEpoch,
          identity.chartEpoch,
          identity.levelEpoch,
          identity.supportEpoch
        ].forEach((word, index) => {
          directoryWords[3 + index] = word;
        });
        const cellCount = cells.length;
        directoryWords[16] = physicalSourceCount;
        directoryWords[17] = physicalSourceCapacity;
        directoryWords[18] = cellCount;
        directoryWords[19] = physicalSourceCapacity;
        directoryWords[20] = directoryLayout.wordLength;
        directoryWords[21] = directoryLayout.wordLength;
        directoryWords[22] = directoryLayout.wordLength;
        directoryWords[25] = 5;
        directoryWords[26] = 5;
        directoryWords[27] =
          epochAbi.SCHROEDER_SPATIAL_SORT_LEXICOGRAPHIC_U32X5;
        directoryWords[28] = 48;
        directoryWords[29] = directoryLayout.cellKeysOffsetWords;
        directoryWords[30] = directoryLayout.cellOffsetsOffsetWords;
        directoryWords[31] = directoryLayout.cellMembersOffsetWords;
        directoryWords[32] =
          directoryLayout.physicalToCellPlusOneOffsetWords;
        directoryWords[33] = buildOrdinal;
        directoryWords[34] = buildOrdinal;
        directoryWords[35] = buildOrdinal;
        directoryWords[36] = identity.generationId;
        directoryWords[37] = activeCount;
        directoryWords[38] = cellCount;
        directoryWords[39] = 1;
        directoryWords[41] = 1;
        directoryWords[42] = Math.ceil(cellCount / 64);
        directoryWords[43] = cellCount === 0 ? 0 : 1;
        directoryWords[44] = cellCount === 0 ? 0 : 1;
        directoryWords[46] = 2;
        directoryWords[47] = directoryLayout.wordLength;
        let memberOrdinal = 0;
        cells.forEach((cell, cellIndex) => {
          const keyOffset =
            directoryLayout.cellKeysOffsetWords + cellIndex * 5;
          cell.key.forEach((word, keyWord) => {
            directoryWords[keyOffset + keyWord] = word;
          });
          directoryWords[
            directoryLayout.cellOffsetsOffsetWords + cellIndex
          ] = memberOrdinal;
          cell.physicalSources.forEach((physical) => {
            directoryWords[
              directoryLayout.cellMembersOffsetWords + memberOrdinal
            ] = physical;
            directoryWords[
              directoryLayout.physicalToCellPlusOneOffsetWords + physical
            ] = cellIndex + 1;
            memberOrdinal += 1;
          });
          directoryWords[
            directoryLayout.cellOffsetsOffsetWords + cellIndex + 1
          ] = memberOrdinal;
        });
        const directoryBuffer = makeBuffer(
          `${label}-directory`,
          directoryWords.byteLength,
          GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        );
        device.queue.writeBuffer(directoryBuffer, 0, directoryWords);
        let spatialExecution;
        const spatialOwner = {
          ownsExecution(execution) {
            return execution === spatialExecution;
          }
        };
        spatialExecution = {
          schema: epochAbi.ULG_SCHROEDER_SPATIAL_EPOCH_V2_SCHEMA,
          status: 'schroeder-spatial-epoch-v2-gpu-encoded',
          abiVersion: epochAbi.SCHROEDER_SPATIAL_EPOCH_V2_VERSION,
          reverseEncoding:
            epochAbi.SCHROEDER_SPATIAL_EPOCH_V2_REVERSE_CELL_PLUS_ONE,
          submitPerformed: false,
          sourceBuffer,
          sourceRowLayoutId:
            mechanicsAbi.SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
          sourceRowStrideFloats: 16,
          physicalSourceCount,
          physicalSourceCapacity,
          activeSourceCapacity: physicalSourceCapacity,
          ...identity,
          buildOrdinal,
          layout: directoryLayout,
          directoryBuffer,
          activeSourceView,
          activeSourceViewBuffer,
          activeSourceCountAuthority,
          ownerRuntime: spatialOwner
        };

        const parentPlan = mechanicsAbi.createSchroederSpatialMechanicsViewPlan({
          sourceCount: physicalSourceCount,
          sourceRowLayoutId:
            mechanicsAbi.SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
          directoryAbiVersion:
            mechanicsAbi.SCHROEDER_SPATIAL_MECHANICS_VIEW_DIRECTORY_VERSION_V2,
          selectedLevel,
          gridNodeCount,
          gridDims: [5, 5, 5],
          gridShift: 1,
          gridSpacingM,
          ...identity,
          completionOrdinal: buildOrdinal
        });
        const nodeCount = activeCount === 0 ? 0 : gridNodeCount;
        const parentWords = new Uint32Array(parentPlan.layout.wordLength);
        parentWords[20] = mechanicsAbi.SCHROEDER_SPATIAL_MECHANICS_VIEW_MAGIC;
        parentWords[21] = mechanicsAbi.SCHROEDER_SPATIAL_MECHANICS_VIEW_VERSION;
        parentWords[22] =
          mechanicsAbi.SCHROEDER_SPATIAL_MECHANICS_VIEW_STATUS_READY
          | mechanicsAbi.SCHROEDER_SPATIAL_MECHANICS_VIEW_STATUS_ADMITTED;
        [
          identity.generationId,
          identity.deviceOrdinal,
          identity.laneOrdinal,
          identity.leaseToken,
          identity.sourceFamilyId,
          identity.storageGeneration,
          identity.physicsTick,
          identity.physicsSubstep,
          identity.positionEpoch,
          identity.topologyEpoch,
          identity.chartEpoch,
          identity.levelEpoch,
          identity.supportEpoch
        ].forEach((word, index) => {
          parentWords[23 + index] = word;
        });
        parentWords[36] = physicalSourceCount;
        parentWords[37] = selectedLevel >>> 0;
        parentWords[38] = gridNodeCount;
        parentWords[39] = 5;
        parentWords[40] = 5;
        parentWords[41] = 5;
        parentWords[42] = 1;
        parentWords[43] = f32Bits(gridSpacingM);
        parentWords[44] = parentPlan.occupancyWordCount;
        parentWords[45] = gridNodeCount;
        parentWords[46] = nodeCount;
        parentWords[49] = activeCount;
        parentWords[50] = activeCount;
        parentWords[51] = candidateCount;
        parentWords[52] = buildOrdinal;
        parentWords[53] = parentPlan.layout.nodeOffsetWords;
        parentWords[54] = parentPlan.layout.nodeOffsetWords + nodeCount;
        parentWords[55] = parentPlan.layout.wordLength;
        parentWords[56] =
          mechanicsAbi.SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0;
        parentWords[57] = Math.ceil(nodeCount / 64);
        parentWords[58] = parentPlan.layout.wordLength;
        parentWords[59] = identity.generationId;
        parentWords[60] = parentWords[57];
        parentWords[61] = nodeCount === 0 ? 0 : 1;
        parentWords[62] = parentWords[61];
        for (let node = 0; node < nodeCount; node += 1) {
          parentWords[parentPlan.layout.nodeOffsetWords + node] = node;
        }
        const mechanicsViewBuffer = makeBuffer(
          `${label}-parent`,
          parentWords.byteLength,
          GPUBufferUsage.STORAGE
            | GPUBufferUsage.INDIRECT
            | GPUBufferUsage.COPY_DST
        );
        device.queue.writeBuffer(mechanicsViewBuffer, 0, parentWords);
        let parentMechanicsView;
        let parentSubmitted = false;
        const parentOwner = {
          ownsExecution(execution) {
            return execution === parentMechanicsView;
          },
          isExecutionSubmitted(execution) {
            return execution === parentMechanicsView && parentSubmitted;
          }
        };
        parentMechanicsView = {
          ...parentPlan,
          schema: mechanicsAbi.ULG_SCHROEDER_SPATIAL_MECHANICS_VIEW_SCHEMA,
          status: 'schroeder-spatial-mechanics-view-gpu-encoded',
          submitPerformed: false,
          released: false,
          sourceBuffer,
          sourceAuthorityVersion:
            fieldAbi.SCHROEDER_SPATIAL_MECHANICS_FIELD_SOURCE_AUTHORITY_V2,
          directorySchema: epochAbi.ULG_SCHROEDER_SPATIAL_EPOCH_V2_SCHEMA,
          directoryAbiVersion:
            mechanicsAbi.SCHROEDER_SPATIAL_MECHANICS_VIEW_DIRECTORY_VERSION_V2,
          sourceWorkIdentity:
            mechanicsAbi.SCHROEDER_SPATIAL_MECHANICS_VIEW_ACTIVE_WORK_IDENTITY,
          physicalSourceCount,
          spatialExecution,
          directoryBuffer,
          activeSourceView,
          activeSourceViewBuffer,
          activeSourceCountAuthority,
          activeSourceDispatchOffsetBytes:
            activeLayout.activeDispatchOffsetBytes,
          mechanicsViewBuffer,
          indirectDispatchBuffer: mechanicsViewBuffer,
          indirectDispatchOffsetBytes:
            parentPlan.layout.dispatchOffsetWords
              * Uint32Array.BYTES_PER_ELEMENT,
          ownerRuntime: parentOwner
        };

        const runtime = runtimeFor(gridSpacingM);
        const encoder = device.createCommandEncoder();
        const field = runtime.encode(encoder, {
          sourceBuffer,
          identityBuffer,
          sourceCount: physicalSourceCount,
          sourceRowLayoutId:
            mechanicsAbi.SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
          identityStrideWords: 1,
          selectedLevel,
          parentMechanicsView
        });
        device.queue.submit([encoder.finish()]);
        runtime.markExecutionSubmitted(field);
        parentSubmitted = true;
        parentMechanicsView.status =
          'schroeder-spatial-mechanics-view-gpu-build-submitted';
        parentMechanicsView.submitPerformed = true;
        await device.queue.onSubmittedWorkDone();
        const words = await readWords(
          field.fieldViewBuffer,
          field.layout.byteLength,
          `${label}-readback`
        );
        const hostAdmission =
          fieldAbi.validateSchroederSpatialMechanicsFieldViewDescriptor(field);
        const descriptorStatuses = Array.from(
          { length: physicalSourceCount },
          (_, physical) => (
            words[
              field.layout.descriptorOffsetWords
                + physical * field.layout.descriptorWords
                + 3
            ]
          )
        );
        const stencilRowsMatch = activePhysicalSources.length < 2
          ? null
          : Array.from({ length: 27 }, (_, stencil) => (
              words[
                field.layout.descriptorOffsetWords
                  + activePhysicalSources[0] * field.layout.descriptorWords
                  + 4
                  + stencil
              ] === words[
                field.layout.descriptorOffsetWords
                  + activePhysicalSources[1] * field.layout.descriptorWords
                  + 4
                  + stencil
              ]
            )).every(Boolean);
        const summary = {
          label,
          activeCount,
          tamperCompletion,
          hostAdmitted: hostAdmission.admitted,
          flags: words[2],
          sourceCount: words[16],
          candidateCount: words[33],
          fieldCount: words[34],
          invalidSourceCount: words[35],
          uniqueElementCount: words[51],
          dispatch: Array.from(words.slice(60, 63)),
          descriptorStatuses,
          stencilRowsMatch
        };
        await runtime.releaseExecutionAfter(field);
        for (const buffer of [
          sourceBuffer,
          identityBuffer,
          activeSourceViewBuffer,
          directoryBuffer,
          mechanicsViewBuffer
        ]) {
          buffer.destroy();
        }
        return summary;
      };

      let cases;
      let executionError = null;
      try {
        cases = [];
        cases.push(await runCase({
          label: 'directory-v2-a0',
          activePhysicalSources: []
        }));
        cases.push(await runCase({
          label: 'directory-v2-sparse-active',
          activePhysicalSources: [1, 3]
        }));
        cases.push(await runCase({
          label: 'directory-v2-two-level-selected-0',
          activePhysicalSources: [1, 2, 3],
          selectedLevel: 0,
          gridSpacingM: 0.25,
          sourceLevels: [0, 0, 0, 1],
          sourceSpacings: [0.25, 0.25, 0.25, 0.5],
          sourceMasses: [0, 1, 0, 1]
        }));
        cases.push(await runCase({
          label: 'directory-v2-two-level-selected-1',
          activePhysicalSources: [1, 2, 3],
          selectedLevel: 1,
          gridSpacingM: 0.5,
          sourceLevels: [0, 0, 0, 1],
          sourceSpacings: [0.25, 0.25, 0.25, 0.5],
          sourceMasses: [0, 1, 0, 1]
        }));
        cases.push(await runCase({
          label: 'directory-v2-stale-completion',
          activePhysicalSources: [1, 3],
          tamperCompletion: true
        }));
      } catch (error) {
        executionError = error?.message || String(error);
      }
      for (const runtime of runtimes.values()) {
        try {
          runtime.destroy();
        } catch (error) {
          executionError ??= error?.message || String(error);
        }
      }
      const validationError = await device.popErrorScope();
      await new Promise((resolve) => setTimeout(resolve, 50));
      device.destroy?.();
      return {
        status: 'complete',
        executionError,
        validationError: validationError?.message || null,
        uncapturedErrors,
        cases
      };
    });
  } finally {
    await browser.close();
  }
  assert.equal(result.status, 'complete', result.reason);
  assert.equal(result.executionError, null);
  assert.equal(result.validationError, null);
  assert.deepEqual(result.uncapturedErrors, []);
  assert.deepEqual(result.cases, [
    {
      label: 'directory-v2-a0',
      activeCount: 0,
      tamperCompletion: false,
      hostAdmitted: true,
      flags:
        SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_READY
        | SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_ADMITTED,
      sourceCount: 4,
      candidateCount: 0,
      fieldCount: 0,
      invalidSourceCount: 0,
      uniqueElementCount: 0,
      dispatch: [0, 0, 0],
      descriptorStatuses: [0, 0, 0, 0],
      stencilRowsMatch: null
    },
    {
      label: 'directory-v2-sparse-active',
      activeCount: 2,
      tamperCompletion: false,
      hostAdmitted: true,
      flags:
        SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_READY
        | SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_ADMITTED,
      sourceCount: 4,
      candidateCount: 54,
      fieldCount: 27,
      invalidSourceCount: 0,
      uniqueElementCount: 54,
      dispatch: [1, 1, 1],
      descriptorStatuses: [0, 1, 0, 1],
      stencilRowsMatch: true
    },
    {
      label: 'directory-v2-two-level-selected-0',
      activeCount: 3,
      tamperCompletion: false,
      hostAdmitted: true,
      flags:
        SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_READY
        | SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_ADMITTED,
      sourceCount: 4,
      candidateCount: 81,
      fieldCount: 27,
      invalidSourceCount: 0,
      uniqueElementCount: 81,
      dispatch: [1, 1, 1],
      descriptorStatuses: [0, 1, 0, 0],
      stencilRowsMatch: false
    },
    {
      label: 'directory-v2-two-level-selected-1',
      activeCount: 3,
      tamperCompletion: false,
      hostAdmitted: true,
      flags:
        SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_READY
        | SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_ADMITTED,
      sourceCount: 4,
      candidateCount: 81,
      fieldCount: 27,
      invalidSourceCount: 0,
      uniqueElementCount: 81,
      dispatch: [1, 1, 1],
      descriptorStatuses: [0, 0, 0, 1],
      stencilRowsMatch: true
    },
    {
      label: 'directory-v2-stale-completion',
      activeCount: 2,
      tamperCompletion: true,
      hostAdmitted: true,
      flags: 4,
      sourceCount: 0,
      candidateCount: 0,
      fieldCount: 0,
      invalidSourceCount: 0,
      uniqueElementCount: 0,
      dispatch: [0, 0, 0],
      descriptorStatuses: [0, 0, 0, 0],
      stencilRowsMatch: true
    }
  ]);
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
      const deviceLimits = await import('/src/runtime/webgpuDeviceLimits.js');
      const device = await adapter.requestDevice(
        deviceLimits.webGpuDeviceDescriptorForResidentSph(adapter)
      );
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
      const gridUpdateModule = await import(
        `/src/runtime/sph/sphGridUpdateGpuKernel.js?nativeMechanicsField=${nonce}`
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
      const step = await stepModule.runMlsMpmResidentStepWithOptionalWebGpu({
        sphParticleState,
        mlsMpmParticleState,
        sphParticleUpload,
        mlsMpmParticleUpload,
        schroederLevelAssignment: levelAssignment,
        schroederSelectedLevel: 0,
        schroederSpatialEpochGeneration: generation,
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
      const runContactCase = async ({
        label,
        leftPhase,
        rightPhase,
        leftMaterial,
        rightMaterial,
        leftDomain,
        rightDomain
      }) => {
        const caseParticleCount = 2;
        const caseState = new Float32Array(caseParticleCount * 8);
        const caseThermo = new Float32Array(caseParticleCount * 12);
        const caseIdentity = new Uint32Array([leftDomain, rightDomain]);
        const caseMechanics = new Float32Array(caseParticleCount * 32);
        const phases = [leftPhase, rightPhase];
        const materials = [leftMaterial, rightMaterial];
        const domains = [leftDomain, rightDomain];
        for (let index = 0; index < caseParticleCount; index += 1) {
          const phase = phases[index];
          const fractions = [0, 0, 0, 0];
          fractions[phase - 1] = 1;
          caseState.set([
            index === 0 ? 0.95 : 1.05,
            1,
            1,
            1,
            index === 0 ? 1 : -1,
            0,
            0,
            100
          ], index * 8);
          caseThermo.set([
            materials[index],
            phase,
            300,
            phase === 1 ? 1000 : (phase === 2 ? 900 : 1),
            ...fractions,
            0.25,
            1,
            1,
            0.1
          ], index * 12);
          const offset = index * 32;
          caseMechanics.set([1, 0, 0, 0, 1, 0, 0, 0, 1], offset);
          caseMechanics[offset + 18] = 1;
          caseMechanics[offset + 19] = 0.001;
          caseMechanics[offset + 20] = phase === 1 ? 1 : 0;
          caseMechanics[offset + 21] = 1;
          caseMechanics[offset + 26] = phase >= 3 ? 2 : 1;
          caseMechanics[offset + 27] = 1;
          caseMechanics[offset + 31] = 1;
        }
        const caseSphState = {
          ...sphParticleState,
          particleCount: caseParticleCount,
          identityRevision: `native-contact-${label}`,
          renderDomainKeys: Object.fromEntries(domains.map((domain) => [
            domain,
            `native-contact-${label}-${domain}`
          ])),
          state: caseState,
          thermo: caseThermo,
          identity: caseIdentity
        };
        const caseMechanicsState = {
          ...mlsMpmParticleState,
          particleCount: caseParticleCount,
          gravityMPerS2: [0, 0, 0],
          mechanics: caseMechanics
        };
        const caseSphUpload = buffersModule.uploadSphGpuParticleBuffers(
          device,
          caseSphState
        );
        const caseMechanicsUpload = buffersModule.uploadMlsMpmGpuParticleBuffers(
          device,
          caseMechanicsState
        );
        caseSphUpload.slot = 0;
        caseMechanicsUpload.slot = 0;
        const caseLevelAssignment = await hierarchyModule.runSchroederLevelAssignmentWebGpu({
          device,
          sphParticleState: caseSphState,
          mlsMpmParticleState: caseMechanicsState,
          sphParticleUpload: caseSphUpload,
          mlsMpmParticleUpload: caseMechanicsUpload,
          baseGridSpacingM: 0.25,
          minLevel: 0,
          maxLevel: 0,
          targetSupportCells: 1,
          supportRadiusScale: 1,
          chartId: 0,
          retainAssignmentBuffer: true
        });
        const caseGeneration = spatialModule.runSchroederSpatialEpochGenerationWebGpu({
          device,
          levelAssignment: caseLevelAssignment,
          particleCount: caseParticleCount,
          particleIdentityBuffer: caseSphUpload.identityBuffer,
          particleIdentityStrideWords: 1,
          selectedLevel: 0,
          mechanicsGrid: {
            gridNodeCount: gridSpec.gridNodeCount,
            gridDims: gridSpec.gridDims,
            gridShift: gridSpec.shift,
            gridSpacingM: gridSpec.gridSpacingM
          }
        });
        const caseProjection = await gridModule.runMlsMpmP2gGridProjectionWebGpu({
          device,
          sphParticleState: caseSphState,
          mlsMpmParticleState: caseMechanicsState,
          sphParticleUpload: caseSphUpload,
          mlsMpmParticleUpload: caseMechanicsUpload,
          schroederSelectedLevel: 0,
          schroederSpatialEpochGeneration: caseGeneration,
          canonicalSpatialRequired: true,
          mechanicsFieldMode: 'required',
          gridSpacingM: 0.25,
          boxDimsM: [2, 2, 2],
          dt: 0.01,
          internalPressureScale: 0,
          readbackMode: 'no-full-readback'
        });
        await gridUpdateModule.runMlsMpmGridUpdateWebGpu({
          device,
          p2gGridProjection: caseProjection,
          mechanicsFieldMode: 'required',
          dt: 0.01,
          gravityMPerS2: [0, 0, 0],
          boxDimsM: [2, 2, 2],
          cflFactor: 0.4,
          readbackMode: 'no-full-readback'
        });
        const caseWords = await read(
          caseGeneration.mechanicsFieldView.fieldViewBuffer,
          caseGeneration.mechanicsFieldView.layout.byteLength,
          `native-mechanics-field-contact-${label}`
        );
        const caseField = caseGeneration.mechanicsFieldView;
        const output = new Float32Array(caseWords.buffer);
        const fieldCount = caseWords[34];
        let maximumVelocityChange = 0;
        let totalMomentumX = 0;
        let kineticBeforeJ = 0;
        let kineticAfterJ = 0;
        let contactHeatJ = 0;
        for (let fieldIndex = 0; fieldIndex < fieldCount; fieldIndex += 1) {
          const key = caseField.layout.keyOffsetWords
            + fieldIndex * caseField.layout.keyWords;
          const stateOffset = caseField.layout.stateOffsetWords
            + fieldIndex * caseField.layout.stateWords;
          const accumulator = caseField.layout.accumulatorOffsetWords
            + fieldIndex * caseField.layout.accumulatorWords;
          const fieldPhase = caseWords[key + 1];
          const fieldMaterial = caseWords[key + 2];
          const fieldDomain = caseWords[key + 3];
          const leftFieldDomain = leftPhase === 1 ? leftDomain : 0;
          const sourceVelocity = fieldPhase === leftPhase
              && fieldMaterial === leftMaterial
              && fieldDomain === leftFieldDomain
            ? 1
            : -1;
          const mass = output[stateOffset];
          const velocityX = output[stateOffset + 1];
          maximumVelocityChange = Math.max(
            maximumVelocityChange,
            Math.abs(velocityX - sourceVelocity)
          );
          totalMomentumX += mass * velocityX;
          kineticBeforeJ += 0.5 * mass * sourceVelocity * sourceVelocity;
          kineticAfterJ += 0.5 * mass * velocityX * velocityX;
          contactHeatJ += output[accumulator];
        }
        const result = {
          label,
          fieldCount,
          maximumVelocityChange,
          totalMomentumX,
          kineticLossJ: kineticBeforeJ - kineticAfterJ,
          contactHeatJ
        };
        spatialModule.releaseSchroederSpatialEpochGenerationAfterQueue(
          caseGeneration,
          device
        );
        await caseGeneration.releasePromise;
        caseLevelAssignment.destroyAssignmentBuffer?.();
        buffersModule.destroySphGpuParticleBuffers(caseSphUpload);
        buffersModule.destroyMlsMpmGpuParticleBuffers(caseMechanicsUpload);
        return result;
      };
      const contactCases = [];
      for (const specification of [
        {
          label: 'liquid-gas',
          leftPhase: 2,
          rightPhase: 3,
          leftMaterial: 7,
          rightMaterial: 8,
          leftDomain: 21,
          rightDomain: 22
        },
        {
          label: 'solid-plasma',
          leftPhase: 1,
          rightPhase: 4,
          leftMaterial: 7,
          rightMaterial: 8,
          leftDomain: 11,
          rightDomain: 22
        },
        {
          label: 'same-material-solid-liquid',
          leftPhase: 1,
          rightPhase: 2,
          leftMaterial: 7,
          rightMaterial: 7,
          leftDomain: 11,
          rightDomain: 22
        },
        {
          label: 'different-material-liquids',
          leftPhase: 2,
          rightPhase: 2,
          leftMaterial: 7,
          rightMaterial: 8,
          leftDomain: 21,
          rightDomain: 22
        },
        {
          label: 'same-material-solid-domains',
          leftPhase: 1,
          rightPhase: 1,
          leftMaterial: 7,
          rightMaterial: 7,
          leftDomain: 11,
          rightDomain: 12
        }
      ]) {
        contactCases.push(await runContactCase(specification));
      }
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
        contactCases,
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
    108,
    27,
    SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_UNIQUE_STATUS_READY
  ]);
  assert.deepEqual(native.dispatch, [1, 1, 1]);
  assert.equal(native.radixSortKeyWordCount, 3);
  assert.equal(
    native.radixHistogramScanMode,
    'gpu-count-fixed-hierarchical'
  );
  assert.equal(
    native.constructionRoutePolicy,
    'gpu-authenticated-directory-v2-indirect-gpu-count-radix'
  );
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
  assert.deepEqual(native.inactiveDescriptor.slice(4, 31), new Array(27).fill(0));
  assert.equal(native.validationError, null);
  assert.deepEqual(native.uncapturedErrors, []);
  const contactCases = Object.fromEntries(
    native.contactCases.map((entry) => [entry.label, entry])
  );
  for (const label of [
    'liquid-gas',
    'solid-plasma'
  ]) {
    const entry = contactCases[label];
    assert.ok(entry.fieldCount > 0, label);
    assert.ok(entry.maximumVelocityChange <= 2e-5, label);
    assert.ok(Math.abs(entry.totalMomentumX) <= 2e-5, label);
    assert.ok(Math.abs(entry.kineticLossJ) <= 2e-5, label);
    assert.ok(Math.abs(entry.contactHeatJ) <= 2e-5, label);
  }
  for (const label of [
    'same-material-solid-liquid',
    'different-material-liquids',
    'same-material-solid-domains'
  ]) {
    const entry = contactCases[label];
    assert.ok(entry.fieldCount > 0, label);
    assert.ok(entry.maximumVelocityChange > 1e-3, label);
    assert.ok(Math.abs(entry.totalMomentumX) <= 2e-4, label);
    assert.ok(entry.kineticLossJ > 0, label);
    assert.ok(entry.contactHeatJ > 0, label);
    assert.ok(Math.abs(entry.kineticLossJ - entry.contactHeatJ) <= 2e-4, label);
  }
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
  assert.equal(
    native.radixHistogramScanMode,
    'gpu-count-fixed-hierarchical-fused-top'
  );
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
