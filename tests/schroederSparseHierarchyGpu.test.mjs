import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SCHROEDER_SPARSE_HIERARCHY_EVIDENCE_LAYOUT,
  SCHROEDER_SPARSE_HIERARCHY_KEY_LAYOUT,
  SCHROEDER_SPARSE_HIERARCHY_NODE_LAYOUT,
  SCHROEDER_SPARSE_HIERARCHY_OVERFLOW_RETAINED_BUDGET,
  SCHROEDER_SPARSE_HIERARCHY_OVERFLOW_SCRATCH_BUDGET,
  ULG_SCHROEDER_SPARSE_HIERARCHY_ABI,
  ULG_SCHROEDER_SPARSE_HIERARCHY_EXECUTION_SCHEMA,
  ULG_SCHROEDER_SPARSE_HIERARCHY_SCHEMA,
  ULG_SCHROEDER_ACTIVE_NODE_LIST_EXECUTION_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import {
  createSchroederSparseHierarchyArenaPlan,
  createSchroederSparseHierarchyGpu,
  createSchroederSparseHierarchyParamsArray,
  createSchroederSparseGridViewGpu,
  createSchroederSparseGridViewPlan,
  schroederSparseHierarchyFinalizeWgsl,
  schroederSparseHierarchyMaterializeWgsl,
  schroederSparseHierarchyWgsl,
  schroederSparseGridViewWgsl,
  ULG_SCHROEDER_SPARSE_GRID_VIEW_EXECUTION_SCHEMA
} from '../src/runtime/sph/schroederSparseHierarchyGpu.js';
import { mlsMpmP2gSchroederSparseGridWgsl } from '../src/runtime/sph/sphGridGpuKernel.js';
import { mlsMpmG2pSchroederSparseGridWgsl } from '../src/runtime/sph/sphG2pGpuKernel.js';
import {
  schroederSparseCrossLevelGridRestrictionWgsl,
  schroederSparseCrossLevelGridVelocityDeltaProlongationWgsl
} from '../src/runtime/sph/schroederCrossLevelCouplingGpu.js';

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

test('Schroeder sparse hierarchy ABI fixes exact five-word keys and two-level ownership', () => {
  assert.equal(ULG_SCHROEDER_SPARSE_HIERARCHY_ABI.schema, ULG_SCHROEDER_SPARSE_HIERARCHY_SCHEMA);
  assert.equal(ULG_SCHROEDER_SPARSE_HIERARCHY_ABI.levelLimit, 2);
  assert.equal(ULG_SCHROEDER_SPARSE_HIERARCHY_ABI.submissionOwnership, 'caller');
  assert.deepEqual(SCHROEDER_SPARSE_HIERARCHY_KEY_LAYOUT, [
    'chart_id_sortable:u32',
    'level_id_sortable:u32',
    'tile_x_sortable:u32',
    'tile_y_sortable:u32',
    'tile_z_sortable:u32'
  ]);
  assert.equal(SCHROEDER_SPARSE_HIERARCHY_NODE_LAYOUT.length, 16);
  assert.equal(SCHROEDER_SPARSE_HIERARCHY_EVIDENCE_LAYOUT.length, 16);
});

test('sparse hierarchy arena is byte-bounded rather than candidate-budget proportional', () => {
  const plan = createSchroederSparseHierarchyArenaPlan({
    sourceRowCount: 300_000,
    fineLevel: 0,
    coarseLevel: 1,
    routeCapacity: 300_000,
    maxTilesPerSource: 32,
    retainedArenaByteBudget: 64 * 1024 * 1024,
    scratchArenaByteBudget: 64 * 1024 * 1024
  });
  assert.equal(plan.admitted, true);
  assert.equal(plan.routeCapacity, 300_000);
  assert.ok(plan.retainedArenaBytes <= plan.retainedArenaByteBudget);
  assert.ok(plan.scratchArenaBytes <= plan.scratchArenaByteBudget);
  assert.equal(plan.arenaPolicy, 'explicit-byte-bounded-retained-and-scratch-arenas');
  assert.equal(plan.compaction, 'exact-stable-u32-radix-unique-csr');
  assert.equal(plan.thirdLevelHold, true);
  assert.equal(plan.cpuReferenceRequired, false);
  assert.equal(plan.fullParticleReadbackRequired, false);

  const params = new DataView(createSchroederSparseHierarchyParamsArray(plan, 19));
  assert.equal(params.getUint32(0, true), 300_000);
  assert.equal(params.getUint32(4, true), 300_000);
  assert.equal(params.getInt32(16, true), 0);
  assert.equal(params.getInt32(20, true), 1);
  assert.equal(params.getUint32(32, true), 19);
});

test('sparse hierarchy rejects a third level and fails closed on byte-budget overflow', () => {
  assert.throws(
    () => createSchroederSparseHierarchyArenaPlan({
      sourceRowCount: 8,
      fineLevel: 0,
      coarseLevel: 2
    }),
    /exactly two adjacent levels/
  );
  const blocked = createSchroederSparseHierarchyArenaPlan({
    sourceRowCount: 1024,
    fineLevel: -1,
    coarseLevel: 0,
    routeCapacity: 4096,
    maxTilesPerSource: 4,
    retainedArenaByteBudget: 4096,
    scratchArenaByteBudget: 4096
  });
  assert.equal(blocked.admitted, false);
  assert.ok(blocked.overflowFlags & (
    SCHROEDER_SPARSE_HIERARCHY_OVERFLOW_RETAINED_BUDGET
    | SCHROEDER_SPARSE_HIERARCHY_OVERFLOW_SCRATCH_BUDGET
  ));
  assert.match(blocked.status, /fail-closed/);
});

test('sparse hierarchy expands, scans, radix-compacts, and materializes on a caller encoder', () => {
  const device = createFakeDevice();
  const encoder = createFakeEncoder();
  const plan = createSchroederSparseHierarchyArenaPlan({
    sourceRowCount: 6,
    routeCapacity: 64,
    maxTilesPerSource: 16,
    retainedArenaByteBudget: 1 << 20,
    scratchArenaByteBudget: 1 << 20
  });
  const runtime = createSchroederSparseHierarchyGpu(device, { plan, label: 'test-ss-sparse' });
  const activeNodeBuffer = device.createBuffer({ label: 'active-nodes', size: 6 * 64, usage: 128 });
  const execution = runtime.encode(encoder, {
    activeNodeList: {
      schema: ULG_SCHROEDER_ACTIVE_NODE_LIST_EXECUTION_SCHEMA,
      status: 'schroeder-active-node-list-submitted',
      activeCandidateCount: 6,
      activeNodeStrideFloats: 16,
      activeNodeBuffer
    },
    generationId: 7
  });

  assert.equal(execution.schema, ULG_SCHROEDER_SPARSE_HIERARCHY_EXECUTION_SCHEMA);
  assert.equal(execution.sparseHierarchySchema, ULG_SCHROEDER_SPARSE_HIERARCHY_SCHEMA);
  assert.equal(execution.generationId, 7);
  assert.equal(execution.readbackMode, 'no-full-readback');
  assert.equal(execution.fullParticleReadbackPerformed, false);
  assert.equal(execution.normalHotLoopReadbackFree, true);
  assert.ok(execution.compactNodeBuffer);
  assert.ok(execution.routeSourceIndexBuffer);
  assert.ok(execution.sortedRouteIndexBuffer);
  assert.ok(execution.sourceMembershipOffsetBuffer);
  assert.ok(execution.evidenceBuffer);
  assert.equal(execution.radixPassCount, 40);
  assert.ok(encoder.events.some(({ pipeline }) => pipeline === 'test-ss-sparse-count-routes'));
  assert.ok(encoder.events.some(({ pipeline }) => pipeline === 'test-ss-sparse-emit-routes'));
  assert.ok(device.pipelines.some(({ label }) => (
    label === 'test-ss-sparse-route-radix-unique-histogram'
  )));
  assert.ok(encoder.events.some(({ pipeline }) => pipeline === 'test-ss-sparse-finalize-admission'));
  assert.ok(encoder.events.some(({ indirect }) => indirect?.label === 'test-ss-sparse-compact-dispatch'));
  assert.equal(Object.hasOwn(device.queue, 'submit'), false);
  assert.equal(device.buffers.some(({ label }) => String(label).includes('readback')), false);

  execution.releaseTransientBuffers();
  assert.ok(execution.transientBuffers.every(({ destroyed }) => destroyed));
  runtime.destroy();
  assert.equal(execution.compactNodeBuffer.destroyed, true);
});

test('sparse hierarchy shaders use exact range fanout, stable CSR, and GPU admission evidence', () => {
  assert.match(schroederSparseHierarchyWgsl, /source_route_offsets\[source_index\]/);
  assert.match(schroederSparseHierarchyWgsl, /for \(var local_route = 0u; local_route < route_count;/);
  assert.match(schroederSparseHierarchyWgsl, /sortable_i32/);
  assert.match(schroederSparseHierarchyWgsl, /atomicOr\(&evidence\[7\], OVERFLOW_ROUTE_ARENA\)/);
  assert.match(schroederSparseHierarchyFinalizeWgsl, /primitive_evidence\[2\]/);
  assert.match(schroederSparseHierarchyFinalizeWgsl, /valid_unique_count/);
  assert.match(schroederSparseHierarchyMaterializeWgsl, /unique_offsets\[node_index \+ 1u\]/);
  assert.match(schroederSparseHierarchyMaterializeWgsl, /dispatch_x/);
  assert.doesNotMatch(
    `${schroederSparseHierarchyWgsl}${schroederSparseHierarchyFinalizeWgsl}${schroederSparseHierarchyMaterializeWgsl}`,
    /water|steam|iron|sodium|cesium|fluorine/i
  );
});

test('sparse grid view bounds lookup and mechanics peak bytes before allocation', () => {
  const plan = createSchroederSparseGridViewPlan({
    gridDims: [128, 96, 64],
    gridShift: 1,
    selectedLevel: 0,
    tileCellCount: 8,
    activeTileCapacity: 128,
    arenaByteBudget: 16 * 1024 * 1024,
    maxBufferSize: 1 << 30,
    maxStorageBufferBindingSize: 1 << 28
  });
  assert.equal(plan.admitted, true);
  assert.ok(plan.gridNodeCapacity > 0);
  assert.ok(plan.gridNodeCapacity < plan.fullGridNodeCount);
  assert.ok(plan.peakAllocatedByteLength <= plan.arenaByteBudget);
  assert.equal(plan.storageMode, 'byte-bounded-actual-p2g-node-radix-compact-grid-arena');
  assert.ok(plan.hashCapacity >= plan.gridNodeCapacity * 2);
  assert.equal(plan.hashCapacity & (plan.hashCapacity - 1), 0);
  assert.equal(
    plan.lookupInitializationScope,
    'gpu-byte-bounded-hash-and-candidate-arena-no-full-grid-clear'
  );
  const planetaryAddressSpacePlan = createSchroederSparseGridViewPlan({
    gridDims: [4096, 4096, 16],
    gridShift: 1,
    selectedLevel: 0,
    tileCellCount: 8,
    activeTileCapacity: 128,
    arenaByteBudget: 16 * 1024 * 1024,
    maxBufferSize: 1 << 30,
    maxStorageBufferBindingSize: 1 << 28
  });
  assert.equal(planetaryAddressSpacePlan.gridNodeCapacity, plan.gridNodeCapacity);
  assert.equal(planetaryAddressSpacePlan.viewBufferByteLength, plan.viewBufferByteLength);

  const blocked = createSchroederSparseGridViewPlan({
    gridDims: [128, 96, 64],
    activeTileCapacity: 128,
    arenaByteBudget: 1024
  });
  assert.equal(blocked.admitted, false);
  assert.equal(blocked.declaredActivityCapacityFullyAdmitted, null);
  assert.equal(blocked.gridNodeCapacity, 0);
  assert.ok(blocked.peakAllocatedByteLength > blocked.arenaByteBudget);
});

test('sparse grid view encodes GPU lookup construction and fail-closed indirect work', () => {
  const device = createFakeDevice();
  const hierarchy = {
    schema: ULG_SCHROEDER_SPARSE_HIERARCHY_EXECUTION_SCHEMA,
    generationId: 9,
    compactNodeBuffer: device.createBuffer({ label: 'compact-nodes', size: 4096, usage: 128 }),
    evidenceBuffer: device.createBuffer({ label: 'hierarchy-evidence', size: 64, usage: 128 }),
    compactDispatchIndirectBuffer: device.createBuffer({
      label: 'hierarchy-indirect',
      size: 12,
      usage: 384
    })
  };
  const plan = createSchroederSparseGridViewPlan({
    gridDims: [16, 16, 16],
    selectedLevel: 0,
    tileCellCount: 4,
    activeTileCapacity: 16,
    arenaByteBudget: 1 << 20
  });
  const runtime = createSchroederSparseGridViewGpu(device, { hierarchy, plan, label: 'test-ss-grid' });
  const encoder = createFakeEncoder();
  const execution = runtime.encode(encoder, { generationId: 9 });
  assert.equal(execution.schema, ULG_SCHROEDER_SPARSE_GRID_VIEW_EXECUTION_SCHEMA);
  assert.equal(execution.gridNodeCapacity, plan.gridNodeCapacity);
  assert.equal(execution.normalHotLoopReadbackFree, true);
  assert.ok(encoder.events.some(({ pipeline }) => pipeline === 'test-ss-grid-initialize_view'));
  assert.ok(encoder.events.some(({ pipeline }) => pipeline === 'test-ss-grid-prepare_build_dispatch'));
  assert.ok(encoder.events.some(({ pipeline }) => pipeline === 'test-ss-grid-initialize_hash_slots'));
  assert.ok(encoder.events.some(({ pipeline }) => pipeline === 'test-ss-grid-build_view'));
  assert.ok(encoder.events.some(({ pipeline }) => pipeline === 'test-ss-grid-finalize_view'));
  assert.ok(encoder.events.some(({ indirect }) => (
    indirect?.label === 'test-ss-grid-dispatch-indirect'
    && indirect.offset === plan.buildDispatchIndirectByteOffset
  )));
  execution.releaseTransientBuffers();
  runtime.destroy();
  assert.equal(execution.viewBuffer.destroyed, true);
});

test('P2G, grid coupling, and G2P sparse variants consume the same compact lookup', () => {
  assert.match(schroederSparseGridViewWgsl, /hash_key_word_offset/);
  assert.match(schroederSparseGridViewWgsl, /atomicCompareExchangeWeak/);
  assert.match(schroederSparseGridViewWgsl, /current authoritative particle position/);
  assert.match(schroederSparseGridViewWgsl, /primitive_unique_keys\[node_index\]/);
  assert.doesNotMatch(schroederSparseGridViewWgsl, /unique_node_count \* cell_count/);
  assert.match(schroederSparseGridViewWgsl, /grid_dispatch\[0\]/);
  assert.match(mlsMpmP2gSchroederSparseGridWgsl, /p2g_sparse_grid_admitted/);
  assert.match(mlsMpmP2gSchroederSparseGridWgsl, /p2g_sparse_lookup/);
  assert.match(mlsMpmG2pSchroederSparseGridWgsl, /g2p_sparse_lookup/);
  assert.match(schroederSparseCrossLevelGridRestrictionWgsl, /fine_sparse_lookup/);
  assert.match(
    schroederSparseCrossLevelGridVelocityDeltaProlongationWgsl,
    /coarse_sparse_lookup/
  );
});
