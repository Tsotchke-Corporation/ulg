import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SCHROEDER_SPARSE_GRID_VIEW_OVERFLOW_SOURCE_IDENTITY,
  SCHROEDER_SPARSE_GRID_VIEW_OVERFLOW_UNSUPPORTED_SOURCE,
  ULG_SCHROEDER_SPARSE_GRID_VIEW_ABI,
  ULG_SCHROEDER_SPARSE_GRID_VIEW_EXECUTION_SCHEMA,
  ULG_SCHROEDER_SPARSE_GRID_VIEW_SCHEMA
} from '../ulg-gpu-abi/src/schroederSparseGridView.js';
import {
  createSchroederSparseGridViewGpu,
  createSchroederSparseGridViewParamsArray,
  createSchroederSparseGridViewPlan,
  schroederSparseGridViewWgsl,
  ULG_SCHROEDER_SPARSE_HIERARCHY_EXECUTION_SCHEMA
} from '../src/runtime/sph/schroederSparseHierarchyGpu.js';

function createFakeDevice() {
  const buffers = [];
  const pipelines = [];
  const writes = [];
  return {
    limits: {
      maxBufferSize: 1 << 30,
      maxStorageBufferBindingSize: 1 << 28,
      maxComputeWorkgroupsPerDimension: 65535
    },
    buffers,
    pipelines,
    writes,
    queue: {
      writeBuffer(buffer, offset, data) {
        writes.push({ buffer, offset, data, byteLength: data.byteLength });
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
    beginComputePass(descriptor = {}) {
      const event = { kind: 'pass', descriptor, pipeline: null, dispatch: null };
      events.push(event);
      return {
        setPipeline(pipeline) { event.pipeline = pipeline.label; },
        setBindGroup(index, bindGroup) { event.bindGroup = { index, label: bindGroup.label }; },
        dispatchWorkgroups(x, y = 1, z = 1) { event.dispatch = [x, y, z]; },
        dispatchWorkgroupsIndirect(buffer, offset) {
          event.indirect = { label: buffer.label, offset };
        },
        end() { event.ended = true; }
      };
    }
  };
}

function plan300k(overrides = {}) {
  return createSchroederSparseGridViewPlan({
    gridDims: [256, 256, 256],
    gridShift: 1,
    gridSpacingM: 0.02,
    selectedLevel: 0,
    particleCapacity: 300_000,
    activeTileCapacity: 200_000,
    arenaByteBudget: 64 * 1024 * 1024,
    maxBufferSize: 1 << 30,
    maxStorageBufferBindingSize: 1 << 28,
    ...overrides
  });
}

test('actual-node ABI and 300k plan are bounded by unique-node bytes, not tile expansion', () => {
  const plan = plan300k();
  assert.equal(ULG_SCHROEDER_SPARSE_GRID_VIEW_ABI.schema, ULG_SCHROEDER_SPARSE_GRID_VIEW_SCHEMA);
  assert.equal(ULG_SCHROEDER_SPARSE_GRID_VIEW_ABI.cpuReferenceRequired, false);
  assert.equal(plan.admitted, true);
  assert.equal(plan.sourceParticleCapacity, 300_000);
  assert.equal(plan.declaredBuildInvocationCapacity, 300_000);
  assert.equal(plan.gridSpacingM, 0.02);
  assert.equal(plan.gridSpacingAuthority, 'production-p2g-grid-spacing');
  assert.ok(plan.gridNodeCapacity > plan.sourceParticleCapacity);
  assert.ok(plan.gridNodeCapacity < plan.fullGridNodeCount);
  assert.ok(plan.peakAllocatedByteLength <= plan.arenaByteBudget);
  assert.equal(plan.tileExpansionMode, 'disabled-actual-current-particle-quadratic-stencil-keys');
  assert.equal(plan.candidateGenerationMode, 'source-family-parallel-exact-touched-grid-node-keys');
  assert.deepEqual(plan.supportedSourceFamilies, [
    'particle-state',
    'reaction-product-events',
    'pressure-force-rows'
  ]);
  assert.equal(plan.radixPassCount, 8);
  assert.equal(plan.memoryAuthority, 'unique-node-capacity-not-route-or-tile-cell-capacity');
  assert.equal(plan.fullParticleReadbackRequired, false);
  assert.equal(plan.cpuReferenceRequired, false);

  const differentTileCount = plan300k({ activeTileCapacity: 12, tileCellCount: 64 });
  assert.equal(differentTileCount.gridNodeCapacity, plan.gridNodeCapacity);
  assert.equal(differentTileCount.peakAllocatedByteLength, plan.peakAllocatedByteLength);
  assert.equal(differentTileCount.declaredBuildInvocationCapacity, 300_000);

  const params = new DataView(createSchroederSparseGridViewParamsArray(plan, 17));
  assert.equal(params.getUint32(32, true), 300_000);
  assert.equal(params.getFloat32(76, true), Math.fround(0.02));
  assert.equal(params.getUint32(92, true), 3);
});

test('actual-node runtime encodes source build, shared radix unique, materialization, and no readback', () => {
  const device = createFakeDevice();
  const plan = plan300k();
  const hierarchy = {
    schema: ULG_SCHROEDER_SPARSE_HIERARCHY_EXECUTION_SCHEMA,
    generationId: 41,
    evidenceBuffer: device.createBuffer({ label: 'hierarchy-evidence', size: 64, usage: 128 })
  };
  const runtime = createSchroederSparseGridViewGpu(device, {
    hierarchy,
    plan,
    label: 'test-actual-grid'
  });
  const retainedBytes = [...new Set(runtime.allocationEntries().map(({ buffer }) => buffer))]
    .reduce((sum, buffer) => sum + buffer.size, 0);
  assert.equal(retainedBytes, plan.retainedCompactionByteLength);

  const particleStateBuffer = device.createBuffer({
    label: 'particle-state',
    size: plan.sourceParticleCapacity * plan.particleStateStrideVec4 * 16,
    usage: 128
  });
  const particleLevelAssignmentBuffer = device.createBuffer({
    label: 'particle-level-assignments',
    size: plan.sourceParticleCapacity * plan.levelAssignmentStrideFloats * 4,
    usage: 128
  });
  const encoder = createFakeEncoder();
  const execution = runtime.encode(encoder, {
    generationId: 41,
    particleStateBuffer,
    particleLevelAssignmentBuffer
  });

  assert.equal(execution.schema, ULG_SCHROEDER_SPARSE_GRID_VIEW_EXECUTION_SCHEMA);
  assert.equal(execution.status, 'schroeder-sparse-grid-actual-node-view-encoded');
  assert.equal(execution.actualNodeKeyCapacity, plan.gridNodeCapacity);
  assert.equal(execution.actualNodeKeyOrdering, 'ascending-full-grid-node-index');
  assert.equal(execution.actualNodeRadixPassCount, 8);
  assert.equal(execution.normalHotLoopReadbackFree, true);
  assert.equal(execution.particleSourceStatus, 'current-retained-particle-source-encoded');
  assert.ok(encoder.events.some(({ pipeline }) => pipeline === 'test-actual-grid-build_view'));
  assert.ok(encoder.events.some(({ pipeline }) => pipeline === 'test-actual-grid-prepare_build_dispatch'));
  assert.ok(encoder.events.some(({ pipeline }) => pipeline === 'test-actual-grid-materialize_sorted_nodes'));
  assert.ok(encoder.events.some(({ pipeline }) => pipeline === 'test-actual-grid-finalize_view'));
  assert.ok(encoder.events.some(({ indirect }) => (
    indirect?.label === 'test-actual-grid-dispatch-indirect'
      && indirect.offset === plan.materializeDispatchIndirectByteOffset
  )));
  assert.equal(Object.hasOwn(device.queue, 'submit'), false);
  assert.equal(device.buffers.some(({ label }) => String(label).includes('readback')), false);

  execution.releaseTransientBuffers();
  execution.releaseTransientBuffers();
  assert.ok(execution.transientBuffers.every(({ destroyed }) => destroyed));
  runtime.destroy();
  assert.ok(runtime.allocationEntries().every(({ buffer }) => buffer.destroyed));
});

test('mixed product and pressure sources preserve identity and stale inputs fail closed', () => {
  const device = createFakeDevice();
  const plan = plan300k({ particleCapacity: 64, activeTileCapacity: 64, gridDims: [16, 16, 16] });
  const hierarchy = {
    schema: ULG_SCHROEDER_SPARSE_HIERARCHY_EXECUTION_SCHEMA,
    generationId: 5,
    evidenceBuffer: device.createBuffer({ label: 'hierarchy-evidence', size: 64, usage: 128 })
  };
  const runtime = createSchroederSparseGridViewGpu(device, { hierarchy, plan, label: 'test-grid-fail' });
  const state = device.createBuffer({ label: 'state', size: 64 * 32, usage: 128 });
  const assignments = device.createBuffer({ label: 'assignments', size: 64 * 64, usage: 128 });
  const identity = {
    generation: 5,
    positionEpoch: 9,
    leaseTokenLow: 101,
    leaseTokenHigh: 202,
    sourceCount: 64,
    consumerBit: 1 << 7
  };
  const leaseIdentity = {
    schema: 'peercompute.compute.gpu-resident-lane-lease-identity.v0',
    authoritative: true,
    leaseId: 'mixed-source-lease',
    laneId: 'mixed-source-lane',
    stateKey: 'mixed-source-state',
    sourceFamily: 'sph-particle-state'
  };
  const identityEvidenceBuffer = device.createBuffer({
    label: 'mixed-source-identity', size: 40 * 4, usage: 128
  });
  const productEventBuffer = device.createBuffer({
    label: 'mixed-product-events', size: 2 * 32 * 4, usage: 128
  });
  const productEventMetadataBuffer = device.createBuffer({
    label: 'mixed-product-metadata', size: 16 * 4, usage: 128
  });
  const productEventDispatchIndirectBuffer = device.createBuffer({
    label: 'mixed-product-dispatch', size: 12, usage: 128 | 256
  });
  const forceRowsBuffer = device.createBuffer({
    label: 'mixed-pressure-rows', size: 2 * 16 * 4, usage: 128
  });
  const candidateMetadataBuffer = device.createBuffer({
    label: 'mixed-pressure-metadata', size: 16, usage: 128
  });
  const candidateDispatchIndirectBuffer = device.createBuffer({
    label: 'mixed-pressure-dispatch', size: 12, usage: 128 | 256
  });
  const sourceEncoder = createFakeEncoder();
  const mixed = runtime.encode(sourceEncoder, {
    generationId: 5,
    particleStateBuffer: state,
    particleLevelAssignmentBuffer: assignments,
    productEventSource: {
      productEventBuffer,
      productEventMetadataBuffer,
      productEventDispatchIndirectBuffer,
      productEventCapacity: 2,
      generationId: 17,
      identity,
      expectedIdentity: { ...identity },
      leaseIdentity,
      expectedLeaseIdentity: { ...leaseIdentity },
      identityEvidenceBuffer
    },
    pressureForceSource: {
      forceRowsBuffer,
      candidateMetadataBuffer,
      candidateDispatchIndirectBuffer,
      forceRowCapacity: 2,
      generationId: 5,
      identity,
      expectedIdentity: { ...identity },
      leaseIdentity,
      expectedLeaseIdentity: { ...leaseIdentity },
      identityEvidenceBuffer
    }
  });
  assert.equal(mixed.unsupportedSourceFamilyMask, 0);
  assert.equal(mixed.sourceIntegrationAdmission, 'mixed-source-family-gpu-admission-encoded');
  assert.equal(mixed.reactionProductEventSourceStatus, 'current-product-event-source-encoded');
  assert.equal(mixed.pressureForceSourceStatus, 'current-pressure-force-source-encoded');
  assert.equal(mixed.productEventSourceGenerationId, 17);
  assert.equal(mixed.pressureForceSourceGenerationId, 5);
  assert.equal(mixed.productEventSourceLeaseId, leaseIdentity.leaseId);
  assert.deepEqual(mixed.productEventSourceIdentity, identity);
  assert.ok(sourceEncoder.events.some((event) => (
    event.pipeline?.endsWith('-build_product_event_view')
    && event.indirect?.label === productEventDispatchIndirectBuffer.label
  )));
  assert.ok(sourceEncoder.events.some((event) => (
    event.pipeline?.endsWith('-build_pressure_force_view')
    && event.indirect?.label === candidateDispatchIndirectBuffer.label
  )));

  const stale = runtime.encode(createFakeEncoder(), {
    generationId: 5,
    particleStateBuffer: state,
    particleLevelAssignmentBuffer: assignments,
    productEventSource: {
      productEventBuffer,
      productEventMetadataBuffer,
      productEventDispatchIndirectBuffer,
      productEventCapacity: 2,
      generationId: 17,
      identity: { ...identity, positionEpoch: identity.positionEpoch - 1 },
      expectedIdentity: identity,
      leaseIdentity,
      expectedLeaseIdentity: leaseIdentity,
      identityEvidenceBuffer
    }
  });
  assert.equal(stale.sourceIntegrationAdmission, 'fail-closed-source-identity-zero-consumer-indirect');
  assert.equal(stale.reactionProductEventSourceStatus, 'fail-closed-product-event-source-identity');
  assert.match(stale.status, /fail-closed/);

  const mismatched = runtime.encode(createFakeEncoder(), {
    generationId: 6,
    particleStateBuffer: state,
    particleLevelAssignmentBuffer: assignments
  });
  assert.equal(mismatched.particleSourceStatus, 'particle-source-identity-fail-closed');
  assert.match(mismatched.status, /fail-closed/);
  assert.match(schroederSparseGridViewWgsl, new RegExp(`OVERFLOW_SOURCE_IDENTITY: u32 = ${SCHROEDER_SPARSE_GRID_VIEW_OVERFLOW_SOURCE_IDENTITY}u`));
  assert.match(schroederSparseGridViewWgsl, new RegExp(`OVERFLOW_UNSUPPORTED_SOURCE: u32 = ${SCHROEDER_SPARSE_GRID_VIEW_OVERFLOW_UNSUPPORTED_SOURCE}u`));
  assert.match(schroederSparseGridViewWgsl, /if \(!admitted\) \{\s*grid_dispatch\[0\] = 0u;/);
  runtime.destroy();
});

test('actual-node shader follows the production quadratic stencil without tile-cell expansion', () => {
  assert.match(schroederSparseGridViewWgsl, /fn emit_position_stencil/);
  assert.match(schroederSparseGridViewWgsl, /position_m \/ max\(grid_spacing, 1\.0e-12\)/);
  assert.match(schroederSparseGridViewWgsl, /floor\(source_grid\.x - 0\.5\)/);
  assert.match(schroederSparseGridViewWgsl, /fn build_product_event_view/);
  assert.match(schroederSparseGridViewWgsl, /fn build_pressure_force_view/);
  assert.match(schroederSparseGridViewWgsl, /product_event_metadata_valid/);
  assert.match(schroederSparseGridViewWgsl, /pressure_force_metadata_valid/);
  assert.match(schroederSparseGridViewWgsl, /for \(var ox = 0i; ox < 3i;/);
  assert.match(schroederSparseGridViewWgsl, /insert_actual_node\(full_index\)/);
  assert.match(schroederSparseGridViewWgsl, /primitive_unique_keys\[node_index\]/);
  assert.doesNotMatch(schroederSparseGridViewWgsl, /unique_node_count \* cell_count/);
  assert.doesNotMatch(schroederSparseGridViewWgsl, /tile_cell_count|cell_count|tile expansion/i);
  assert.doesNotMatch(schroederSparseGridViewWgsl, /mapAsync|readback|cpu-reference/i);
});
