import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  COHERENT_SOLID_BODY_INVARIANT_ROW_LAYOUT,
  COHERENT_SOLID_BODY_WRENCH_ROW_LAYOUT,
  COHERENT_SOLID_CONTACT_PROXY_ROW_LAYOUT,
  COHERENT_SOLID_DERIVED_ADMITTED,
  COHERENT_SOLID_FRAME_ROW_LAYOUT,
  COHERENT_SOLID_FRAME_WORDS,
  COHERENT_SOLID_INVARIANT_EVIDENCE_LAYOUT,
  COHERENT_SOLID_MEMBER_ROW_LAYOUT,
  COHERENT_SOLID_MEMBER_WORDS,
  COHERENT_SOLID_PROXY_COMPACTION_EVIDENCE_LAYOUT,
  COHERENT_SOLID_STATE_MANAGER_ADMITTED,
  COHERENT_SOLID_SHAPE_CARRIER_ROW_LAYOUT,
  ULG_COHERENT_SOLID_ABI,
  ULG_COHERENT_SOLID_AUTHORITY_POLICY_SCHEMA,
  ULG_COHERENT_SOLID_BODY_INVARIANT_SCHEMA,
  ULG_COHERENT_SOLID_BODY_WRENCH_SCHEMA,
  ULG_COHERENT_SOLID_CHART_TRANSITION_SCHEMA,
  ULG_COHERENT_SOLID_CONTACT_PROXY_SCHEMA,
  ULG_COHERENT_SOLID_DRAW_ENTRIES_SCHEMA,
  ULG_COHERENT_SOLID_DRAW_ENTRY_SCHEMA,
  ULG_COHERENT_SOLID_FRAME_MUTATION_CANDIDATE_SCHEMA,
  ULG_COHERENT_SOLID_FRAME_SCHEMA,
  ULG_COHERENT_SOLID_FRAME_STEP_EXECUTION_SCHEMA,
  ULG_COHERENT_SOLID_INVARIANT_EVIDENCE_SCHEMA,
  ULG_COHERENT_SOLID_MEMBER_MEMBERSHIP_SCHEMA,
  ULG_COHERENT_SOLID_MEMBER_SCHEMA,
  ULG_COHERENT_SOLID_MEMBER_WRENCH_INPUT_SCHEMA,
  ULG_COHERENT_SOLID_NATIVE_EXECUTOR_SCHEMA,
  ULG_COHERENT_SOLID_PROXY_COMPACTION_EVIDENCE_SCHEMA,
  ULG_COHERENT_SOLID_REST_MESH_SCHEMA,
  ULG_COHERENT_SOLID_SHAPE_CARRIER_SCHEMA,
  ULG_COHERENT_SOLID_STATE_FAMILY_AUTHORITY,
  ULG_COHERENT_SOLID_TRANSFORMED_MEMBER_SCHEMA
} from '../ulg-gpu-abi/src/coherentSolid.js';
import {
  coherentSolidFailCloseFramesWgsl,
  coherentSolidFinalizeEvidenceWgsl,
  coherentSolidIntegrateWgsl,
  coherentSolidInvariantWgsl,
  coherentSolidTransformWgsl,
  coherentSolidWgslForWorkgroupSize,
  coherentSolidWrenchWgsl
} from '../ulg-gpu-abi/src/coherentSolidWgsl.js';
import {
  coherentSolidContactCompactionWgsl,
  coherentSolidIndirectDrawWgsl,
  coherentSolidResidentWgslForWorkgroupSize
} from '../ulg-gpu-abi/src/coherentSolidResidentWgsl.js';
import {
  COHERENT_SOLID_FRAME_GPU_TIMESTAMP_STAGE,
  createCoherentSolidFrameGpu,
  createCoherentSolidFrameGpuParamsArray,
  createCoherentSolidFrameGpuPlan
} from '../src/runtime/solid/coherentSolidFrameGpu.js';

function createFakeDevice() {
  const buffers = [];
  const pipelines = [];
  const bindGroups = [];
  const writes = [];
  return {
    limits: {
      maxBufferSize: 1 << 30,
      maxStorageBufferBindingSize: 1 << 28,
      maxComputeWorkgroupsPerDimension: 65535
    },
    buffers,
    pipelines,
    bindGroups,
    writes,
    queue: {
      writeBuffer(buffer, offset, data) {
        writes.push({ buffer, offset, byteLength: data.byteLength });
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
      const pipeline = {
        ...descriptor,
        getBindGroupLayout(index) { return { pipeline: descriptor.label, index }; }
      };
      pipelines.push(pipeline);
      return pipeline;
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
    clearBuffer(buffer) {
      events.push({ kind: 'clear', label: buffer.label });
    },
    beginComputePass(descriptor = {}) {
      const event = { kind: 'pass', descriptor, pipeline: null, dispatch: null };
      events.push(event);
      return {
        setPipeline(pipeline) { event.pipeline = pipeline.label; },
        setBindGroup(index, bindGroup) { event.bindGroup = { index, label: bindGroup.label }; },
        dispatchWorkgroups(x, y = 1, z = 1) { event.dispatch = [x, y, z]; },
        end() { event.ended = true; }
      };
    }
  };
}

function createSourceArtifacts(device, {
  bodyCount = 2,
  memberCount = 4,
  generationId = 9,
  leaseId = 41,
  leaseEpoch = 3
} = {}) {
  const buffer = (label, size) => device.createBuffer({ label, size, usage: 128 });
  return {
    frameSource: {
      schema: ULG_COHERENT_SOLID_FRAME_SCHEMA,
      device,
      buffer: buffer('source-frames', bodyCount * COHERENT_SOLID_FRAME_WORDS * 4),
      bodyCount,
      strideWords: COHERENT_SOLID_FRAME_WORDS,
      generationId,
      leaseId,
      leaseEpoch,
      authorityStatus: COHERENT_SOLID_STATE_MANAGER_ADMITTED
    },
    memberSource: {
      schema: ULG_COHERENT_SOLID_MEMBER_SCHEMA,
      device,
      buffer: buffer('source-members', memberCount * COHERENT_SOLID_MEMBER_WORDS * 4),
      memberCount,
      strideWords: COHERENT_SOLID_MEMBER_WORDS,
      generationId,
      leaseId,
      leaseEpoch,
      authorityStatus: COHERENT_SOLID_STATE_MANAGER_ADMITTED
    },
    membershipSource: {
      schema: ULG_COHERENT_SOLID_MEMBER_MEMBERSHIP_SCHEMA,
      device,
      offsetBuffer: buffer('member-offsets', (bodyCount + 1) * 4),
      indexBuffer: buffer('member-indices', memberCount * 4),
      bodyCount,
      indexCount: memberCount,
      generationId,
      leaseId,
      leaseEpoch,
      authorityStatus: COHERENT_SOLID_DERIVED_ADMITTED,
      exactPartition: true
    },
    memberWrenchSource: {
      schema: ULG_COHERENT_SOLID_MEMBER_WRENCH_INPUT_SCHEMA,
      device,
      buffer: buffer('member-wrenches', memberCount * 12 * 4),
      memberCount,
      strideWords: 12,
      generationId,
      leaseId,
      leaseEpoch,
      authorityStatus: COHERENT_SOLID_DERIVED_ADMITTED
    }
  };
}

test('coherent-solid ABI separates frame, member, contact, and visible shape identity', () => {
  assert.equal(ULG_COHERENT_SOLID_ABI.frameSchema, ULG_COHERENT_SOLID_FRAME_SCHEMA);
  assert.equal(ULG_COHERENT_SOLID_ABI.memberSchema, ULG_COHERENT_SOLID_MEMBER_SCHEMA);
  assert.equal(ULG_COHERENT_SOLID_ABI.contactProxySchema, ULG_COHERENT_SOLID_CONTACT_PROXY_SCHEMA);
  assert.equal(ULG_COHERENT_SOLID_ABI.shapeCarrierSchema, ULG_COHERENT_SOLID_SHAPE_CARRIER_SCHEMA);
  assert.equal(ULG_COHERENT_SOLID_ABI.restMeshSchema, ULG_COHERENT_SOLID_REST_MESH_SCHEMA);
  assert.equal(ULG_COHERENT_SOLID_ABI.drawEntrySchema, ULG_COHERENT_SOLID_DRAW_ENTRY_SCHEMA);
  assert.equal(ULG_COHERENT_SOLID_ABI.drawEntriesSchema, ULG_COHERENT_SOLID_DRAW_ENTRIES_SCHEMA);
  assert.equal(ULG_COHERENT_SOLID_ABI.nativeExecutorSchema, ULG_COHERENT_SOLID_NATIVE_EXECUTOR_SCHEMA);
  assert.equal(
    ULG_COHERENT_SOLID_ABI.proxyCompactionEvidenceSchema,
    ULG_COHERENT_SOLID_PROXY_COMPACTION_EVIDENCE_SCHEMA
  );
  assert.equal(
    ULG_COHERENT_SOLID_ABI.chartTransitionSchema,
    ULG_COHERENT_SOLID_CHART_TRANSITION_SCHEMA
  );
  assert.equal(COHERENT_SOLID_FRAME_ROW_LAYOUT.length, 80);
  assert.equal(COHERENT_SOLID_MEMBER_ROW_LAYOUT.length, 40);
  assert.equal(COHERENT_SOLID_CONTACT_PROXY_ROW_LAYOUT.length, 32);
  assert.equal(COHERENT_SOLID_SHAPE_CARRIER_ROW_LAYOUT.length, 32);
  assert.equal(COHERENT_SOLID_BODY_WRENCH_ROW_LAYOUT.length, 16);
  assert.equal(COHERENT_SOLID_BODY_INVARIANT_ROW_LAYOUT.length, 40);
  assert.equal(COHERENT_SOLID_INVARIANT_EVIDENCE_LAYOUT.length, 32);
  assert.equal(COHERENT_SOLID_PROXY_COMPACTION_EVIDENCE_LAYOUT.length, 16);
  assert.ok(COHERENT_SOLID_FRAME_ROW_LAYOUT.includes('orientation_w:f32'));
  assert.ok(COHERENT_SOLID_FRAME_ROW_LAYOUT.includes('world_angular_momentum_z_kg_m2_s:f32'));
  assert.ok(COHERENT_SOLID_FRAME_ROW_LAYOUT.includes('body_inverse_inertia_zz_per_kg_m2:f32'));
  assert.ok(COHERENT_SOLID_MEMBER_ROW_LAYOUT.includes('local_position_x_m:f32'));
  assert.ok(COHERENT_SOLID_SHAPE_CARRIER_ROW_LAYOUT.includes('geometry_key:u32'));
});

test('coherent-solid authority keeps scheduling, buffers, laws, and admission in their owners', () => {
  assert.equal(ULG_COHERENT_SOLID_STATE_FAMILY_AUTHORITY.schema, ULG_COHERENT_SOLID_AUTHORITY_POLICY_SCHEMA);
  assert.equal(
    ULG_COHERENT_SOLID_STATE_FAMILY_AUTHORITY.schedulerOwner,
    'peercompute-node-kernel-compute-manager'
  );
  assert.equal(
    ULG_COHERENT_SOLID_STATE_FAMILY_AUTHORITY.residentBufferOwner,
    'peercompute-gpu-hub'
  );
  assert.equal(
    ULG_COHERENT_SOLID_STATE_FAMILY_AUTHORITY.authoritativeMutationOwner,
    'peercompute-state-manager'
  );
  assert.equal(ULG_COHERENT_SOLID_STATE_FAMILY_AUTHORITY.lawContentOwner, 'ulg');
  assert.equal(ULG_COHERENT_SOLID_STATE_FAMILY_AUTHORITY.cpuMirrorRequired, false);
  assert.equal(ULG_COHERENT_SOLID_STATE_FAMILY_AUTHORITY.sceneSchedulerAllowed, false);
  assert.equal(
    ULG_COHERENT_SOLID_STATE_FAMILY_AUTHORITY.stateFamilies.drawEntries.authority,
    'state-manager-admitted-presentation-view'
  );
  assert.match(
    ULG_COHERENT_SOLID_STATE_FAMILY_AUTHORITY.stateFamilies.frameMutationCandidate.authority,
    /not-authoritative/
  );
});

test('coherent-solid JSON contract fixes exact PeerCompute authority boundaries', async () => {
  const schema = JSON.parse(await readFile(
    new URL('../ulg-gpu-abi/src/schemas/coherent_solid_contracts.schema.json', import.meta.url),
    'utf8'
  ));
  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(
    schema.properties.authority.properties.schedulerOwner.const,
    'peercompute-node-kernel-compute-manager'
  );
  assert.equal(
    schema.properties.authority.properties.authoritativeMutationOwner.const,
    'peercompute-state-manager'
  );
  assert.equal(
    schema.$defs.drawEntriesContract.properties.schedulerOwner.const,
    'peercompute-node-kernel-compute-manager'
  );
  assert.equal(schema.$defs.drawEntriesContract.properties.sameDeviceRequired.const, true);
  assert.equal(schema.$defs.drawEntriesContract.properties.cpuTransformRequired.const, false);
  assert.equal(
    schema.$defs.proxyCompactionEvidenceContract.properties.ordering.const,
    'stable-gpu-radix-unique-body-id-proxy-id'
  );
  assert.equal(
    schema.$defs.proxyCompactionEvidenceContract.properties.readbackRequiredForAdmission.const,
    false
  );
  assert.equal(schema.$defs.chartTransitionContract.properties.thirdLevelHold.const, true);
  assert.equal(schema.$defs.chartTransitionContract.properties.preserveRestShape.const, true);
});

test('coherent-solid plan is byte-bounded and parameterizes two-dimensional dispatch', () => {
  const plan = createCoherentSolidFrameGpuPlan({
    bodyCapacity: 70_000,
    memberCapacity: 300_000,
    membershipIndexCapacity: 300_000,
    arenaByteBudget: 128 * 1024 * 1024,
    maxComputeWorkgroupsPerDimension: 65535,
    maxBufferSize: 1 << 30,
    maxStorageBufferBindingSize: 1 << 28
  });
  assert.equal(plan.admitted, true);
  assert.equal(plan.bodyReductionDispatchCapacity[0], 65535);
  assert.equal(plan.bodyReductionDispatchCapacity[1], 2);
  assert.ok(plan.retainedArenaBytes <= plan.arenaByteBudget);
  assert.equal(plan.cpuMirrorRequired, false);
  assert.equal(plan.hotStateReadbackRequired, false);
  const params = createCoherentSolidFrameGpuParamsArray(plan, {
    bodyCount: 70_000,
    memberCount: 300_000,
    membershipIndexCount: 300_000,
    sourceGenerationId: 7,
    targetGenerationId: 8,
    memberGenerationId: 7,
    leaseId: 21,
    leaseEpoch: 2,
    dtS: 1 / 240,
    externalAcceleration: [0, -9.81, 0]
  });
  const view = new DataView(params.arrayBuffer);
  assert.equal(view.getUint32(0, true), 70_000);
  assert.equal(view.getUint32(16, true), 7);
  assert.equal(view.getUint32(20, true), 8);
  assert.equal(view.getUint32(24, true), 21);
  assert.ok(Math.abs(view.getFloat32(56, true) + 9.81) < 1e-5);
  assert.equal(view.getUint32(104, true), params.bodyLinearDispatch[0]);
});

test('coherent-solid runtime encodes one caller-owned fail-closed resident DAG', () => {
  const device = createFakeDevice();
  const encoder = createFakeEncoder();
  const plan = createCoherentSolidFrameGpuPlan({
    bodyCapacity: 2,
    memberCapacity: 4,
    arenaByteBudget: 1 << 20,
    maxBufferSize: device.limits.maxBufferSize,
    maxStorageBufferBindingSize: device.limits.maxStorageBufferBindingSize,
    maxComputeWorkgroupsPerDimension: device.limits.maxComputeWorkgroupsPerDimension
  });
  const runtime = createCoherentSolidFrameGpu(device, { plan, label: 'test-solid-frame' });
  const sources = createSourceArtifacts(device);
  const timestampSpans = [];
  const execution = runtime.encode(encoder, {
    ...sources,
    targetGenerationId: 10,
    dtS: 1 / 120,
    externalAcceleration: [0, -9.81, 0],
    timestampProfiler: {
      beginComputePassDescriptor(label, metadata) {
        timestampSpans.push({ label, metadata });
        return { label };
      }
    },
    timestampMetadata: { taskId: 'solid-frame-profile-test' }
  });

  assert.equal(execution.schema, ULG_COHERENT_SOLID_FRAME_STEP_EXECUTION_SCHEMA);
  assert.equal(
    execution.frameMutationCandidate.schema,
    ULG_COHERENT_SOLID_FRAME_MUTATION_CANDIDATE_SCHEMA
  );
  assert.equal(execution.transformedMembers.schema, ULG_COHERENT_SOLID_TRANSFORMED_MEMBER_SCHEMA);
  assert.equal(execution.bodyWrenches.schema, ULG_COHERENT_SOLID_BODY_WRENCH_SCHEMA);
  assert.equal(execution.bodyInvariants.schema, ULG_COHERENT_SOLID_BODY_INVARIANT_SCHEMA);
  assert.equal(execution.invariantEvidence.schema, ULG_COHERENT_SOLID_INVARIANT_EVIDENCE_SCHEMA);
  assert.equal(execution.targetGenerationId, 10);
  assert.equal(execution.leaseId, 41);
  assert.equal(execution.queueSubmissionPerformed, false);
  assert.equal(execution.fullStateReadbackPerformed, false);
  assert.equal(execution.submissionOwnership, 'caller');
  assert.match(execution.stateMutationStatus, /awaiting-peercompute-state-manager/);
  assert.deepEqual(
    encoder.events.filter(({ kind }) => kind === 'pass').map(({ pipeline }) => pipeline),
    [
      'test-solid-frame-reduce-wrench',
      'test-solid-frame-integrate-frames',
      'test-solid-frame-transform-members',
      'test-solid-frame-reduce-invariants',
      'test-solid-frame-finalize-evidence',
      'test-solid-frame-fail-close-frames'
    ]
  );
  assert.equal(Object.hasOwn(device.queue, 'submit'), false);
  assert.deepEqual(
    timestampSpans.map(({ label }) => label),
    Object.values(COHERENT_SOLID_FRAME_GPU_TIMESTAMP_STAGE)
  );
  assert.ok(timestampSpans.every(({ metadata }) => (
    metadata.taskId === 'solid-frame-profile-test'
      && metadata.targetGenerationId === 10
  )));
  assert.equal(device.buffers.some(({ label }) => String(label).includes('readback')), false);

  execution.releaseTransientBuffers();
  assert.equal(execution.transientBuffers[0].destroyed, true);
  runtime.destroy();
  assert.ok(runtime.allocationEntries().every(({ buffer }) => buffer.destroyed));
});

test('coherent-solid runtime rejects stale, cross-device, and mismatched lease inputs', () => {
  const device = createFakeDevice();
  const plan = createCoherentSolidFrameGpuPlan({
    bodyCapacity: 2,
    memberCapacity: 4,
    arenaByteBudget: 1 << 20
  });
  const runtime = createCoherentSolidFrameGpu(device, { plan, label: 'test-solid-admission' });
  const sources = createSourceArtifacts(device);
  assert.throws(() => runtime.encode(createFakeEncoder(), {
    ...sources,
    memberSource: { ...sources.memberSource, generationId: 8 },
    targetGenerationId: 10,
    dtS: 0.01
  }), /generationId must match/);
  assert.throws(() => runtime.encode(createFakeEncoder(), {
    ...sources,
    membershipSource: { ...sources.membershipSource, leaseEpoch: 4 },
    targetGenerationId: 10,
    dtS: 0.01
  }), /lease must match/);
  assert.throws(() => runtime.encode(createFakeEncoder(), {
    ...sources,
    memberWrenchSource: { ...sources.memberWrenchSource, device: createFakeDevice() },
    targetGenerationId: 10,
    dtS: 0.01
  }), /runtime WebGPU device/);
  runtime.destroy();
});

test('coherent-solid WGSL uses parallel body reductions and objective SE(3) transforms', () => {
  const combined = `${coherentSolidWrenchWgsl}\n${coherentSolidIntegrateWgsl}\n${coherentSolidTransformWgsl}\n${coherentSolidInvariantWgsl}\n${coherentSolidFinalizeEvidenceWgsl}\n${coherentSolidFailCloseFramesWgsl}`;
  assert.match(coherentSolidWrenchWgsl, /@compute @workgroup_size\(64\)[\s\S]*reduce_body_wrench/);
  assert.match(coherentSolidWrenchWgsl, /cross\(world_offset, force\)/);
  assert.match(coherentSolidWrenchWgsl, /if \(lane == 0u\) \{\s*invalid_count = 1u;/);
  assert.match(coherentSolidIntegrateWgsl, /target_linear_momentum = source_linear_momentum/);
  assert.match(coherentSolidIntegrateWgsl, /quaternion_step_world/);
  assert.match(coherentSolidTransformWgsl, /center_of_mass \+ world_offset/);
  assert.match(coherentSolidTransformWgsl, /cross\(omega_world, world_offset\)/);
  assert.match(coherentSolidInvariantWgsl, /member_inertia_residual/);
  assert.match(coherentSolidInvariantWgsl, /if \(lane == 0u\) \{\s*partial\.invalid_count = 1u;/);
  assert.match(coherentSolidFinalizeEvidenceWgsl, /INVARIANT_AWAITING_STATE_MANAGER/);
  assert.match(coherentSolidFailCloseFramesWgsl, /target_frames\[frame_base \+ 79u\] = ROW_FAIL_CLOSED/);
  assert.match(coherentSolidFailCloseFramesWgsl, /global_status & INVARIANT_ADMISSIBLE/);
  assert.doesNotMatch(combined, /water|steam|iron|sodium|cesium|fluorine/i);
  assert.doesNotMatch(combined, /cpu|mapAsync|queue\.submit/i);
});

test('coherent-solid WGSL keeps equivalent 2D partitions workgroup-parameterized', () => {
  const plan32 = createCoherentSolidFrameGpuPlan({
    bodyCapacity: 2050,
    memberCapacity: 2050,
    membershipIndexCapacity: 2050,
    arenaByteBudget: 8 << 20,
    maxComputeWorkgroupsPerDimension: 64,
    workgroupSize: 32
  });
  assert.deepEqual(plan32.bodyLinearDispatchCapacity, [64, 2, 1]);
  assert.deepEqual(plan32.memberLinearDispatchCapacity, [64, 2, 1]);
  const frame32 = coherentSolidWgslForWorkgroupSize(coherentSolidFailCloseFramesWgsl, 32);
  const wrench32 = coherentSolidWgslForWorkgroupSize(coherentSolidWrenchWgsl, 32);
  const resident32 = coherentSolidResidentWgslForWorkgroupSize(
    coherentSolidContactCompactionWgsl,
    32
  );
  assert.match(frame32, /@workgroup_size\(32\)/);
  assert.match(frame32, /id\.y \* params\.body_linear_dispatch_x \* params\.workgroup_size/);
  assert.match(wrench32, /array<f32, 32>/);
  assert.match(wrench32, /var reduction_stride = 16u;/);
  assert.match(resident32, /@workgroup_size\(32\)/);
  assert.match(resident32, /proxy_dispatch_read\[0\]/);
  assert.match(
    coherentSolidContactCompactionWgsl,
    /atomicLoad\(&proxy_evidence\[3\]\) == params\.proxy_count/
  );
  assert.match(coherentSolidIndirectDrawWgsl, /instance_body_indices\[body_index\] = body_index/);
  assert.doesNotMatch(
    coherentSolidIndirectDrawWgsl,
    /let\s+instance_index\s*=\s*atomicAdd/
  );
  assert.throws(
    () => coherentSolidWgslForWorkgroupSize(coherentSolidWrenchWgsl, 48),
    /power of two/
  );
});
