import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SPH_SPARSE_RENDER_FIELD_GPU_ATLAS_CELL_FLOATS,
  SPH_SPARSE_RENDER_FIELD_PARTICLE_CAPACITY_BUCKET,
  SPH_SPARSE_RENDER_FIELD_PRODUCT_EVENT_CAPACITY_BUCKET,
  createSphSparseRenderFieldGpu,
  createSphSparseRenderFieldGpuPlan,
  createSphSparseRenderFieldCandidateVoxelSlices,
  deriveSphSparseRenderFieldEligibilityBounds,
  reserveSphSparseRenderFieldParticleCapacity,
  reserveSphSparseRenderFieldProductEventCapacity
} from '../src/runtime/sph/sphSparseRenderFieldGpu.js';
import { createSphSparseRenderFieldPlan } from '../src/runtime/sph/sphSparseRenderFieldPlan.js';
import {
  SPH_GPU_SPARSE_RENDER_FIELD_ACTIVE_VOXEL_UNUSED,
  SPH_GPU_SPARSE_RENDER_FIELD_ELIGIBLE_PAIR_ROW_LAYOUT,
  SPH_GPU_SPARSE_RENDER_FIELD_ROUTE_RANGE_ROW_LAYOUT,
  SPH_GPU_SPARSE_RENDER_FIELD_RUNTIME_EVIDENCE_ROW_LAYOUT,
  sphSparseRenderFieldDirectoryWgsl,
  sphSparseRenderFieldGatherAtlasWgsl,
  sphSparseRenderFieldHomeRouteWgsl,
  sphSparseRenderFieldInitializeWgsl
} from '../ulg-gpu-abi/src/sparseRenderFieldGpuWgsl.js';

function makeSparsePlan({
  brickSize = 8,
  generationId = 17,
  maxTotalByteLength = null,
  capacityOverrides = {}
} = {}) {
  return createSphSparseRenderFieldPlan({
    generationId,
    brickSize,
    surfaces: [
      { surfaceIndex: 0, dimensions: [17, 17, 17] },
      { surfaceIndex: 1, dimensions: [12, 10, 9] }
    ],
    requiredRouteCount: 24,
    capacity: {
      directoryEntryCount: 35,
      routeCount: 64,
      activeBrickCount: 48,
      atlasCellCount: 48 * 512,
      activeVoxelCount: 48 * 512,
      ...capacityOverrides
    },
    maxTotalByteLength
  });
}

function boundedSurfaceMetadata(materialId, renderDomainId = 0, extra = {}) {
  return {
    materialId,
    renderDomainId,
    strength: 0.02,
    subtract: 1,
    ...extra
  };
}

function createFakeDevice() {
  const buffers = [];
  const pipelines = [];
  const bindGroups = [];
  const writes = [];
  return {
    buffers,
    pipelines,
    bindGroups,
    writes,
    limits: {
      maxBufferSize: 1 << 30,
      maxStorageBufferBindingSize: 1 << 30,
      maxStorageBuffersPerShaderStage: 10,
      maxComputeWorkgroupsPerDimension: 65535
    },
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
    createShaderModule(descriptor) { return descriptor; },
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
      const event = { kind: 'pass', descriptor, pipeline: null, dispatch: null, commands: [] };
      events.push(event);
      let pipeline = null;
      let bindGroup = null;
      return {
        setPipeline(value) {
          pipeline = value.label;
          event.pipeline = pipeline;
        },
        setBindGroup(index, value) {
          bindGroup = { index, label: value.label };
          event.bindGroup = bindGroup;
        },
        dispatchWorkgroups(x, y = 1, z = 1) {
          event.dispatch = [x, y, z];
          event.commands.push({ pipeline, bindGroup, dispatch: event.dispatch });
        },
        dispatchWorkgroupsIndirect(buffer, offset = 0) {
          event.dispatchIndirect = { label: buffer.label, offset };
          event.commands.push({ pipeline, bindGroup, dispatchIndirect: event.dispatchIndirect });
        },
        end() { event.ended = true; }
      };
    }
  };
}

test('sparse FIELD runtime ABI fixes compact pairs, directory CSR, evidence, and sentinel ids', () => {
  assert.equal(SPH_GPU_SPARSE_RENDER_FIELD_ELIGIBLE_PAIR_ROW_LAYOUT.length, 4);
  assert.equal(SPH_GPU_SPARSE_RENDER_FIELD_ROUTE_RANGE_ROW_LAYOUT.length, 4);
  assert.equal(SPH_GPU_SPARSE_RENDER_FIELD_RUNTIME_EVIDENCE_ROW_LAYOUT.length, 36);
  assert.equal(SPH_GPU_SPARSE_RENDER_FIELD_ACTIVE_VOXEL_UNUSED, 0xffffffff);
  assert.equal(SPH_SPARSE_RENDER_FIELD_GPU_ATLAS_CELL_FLOATS, 8);
});

test('eligibility bounds come from material/domain surface multiplicity', () => {
  const bounds = deriveSphSparseRenderFieldEligibilityBounds([
    { materialId: 1, renderDomainId: 0, phaseId: 1 },
    { materialId: 1, renderDomainId: 0, phaseId: 2 },
    { materialId: 1, renderDomainId: 4, phaseId: 3 },
    { materialId: 2, renderDomainId: 0, phaseId: 2 }
  ]);
  assert.equal(bounds.maxParticleSurfacesPerSource, 3);
  assert.equal(bounds.maxProductSurfacesPerEvent, 3);
  assert.equal(bounds.conservativeFallback, false);

  const wildcardPlusSpecific = deriveSphSparseRenderFieldEligibilityBounds([
    { materialId: 7, renderDomainId: 0 },
    { materialId: 7, renderDomainId: 2 }
  ]);
  assert.equal(wildcardPlusSpecific.maxParticleSurfacesPerSource, 2);

  const conservative = deriveSphSparseRenderFieldEligibilityBounds([], { surfaceCount: 5 });
  assert.equal(conservative.maxParticleSurfacesPerSource, 5);
  assert.equal(conservative.maxProductSurfacesPerEvent, 5);
  assert.equal(conservative.conservativeFallback, true);
});

test('product-event reservations are bucketed, grow-only, and preserve the exact live count', () => {
  assert.equal(SPH_SPARSE_RENDER_FIELD_PRODUCT_EVENT_CAPACITY_BUCKET, 4096);
  const initial = reserveSphSparseRenderFieldProductEventCapacity({
    productEventCount: 17
  });
  assert.equal(initial.productEventCount, 17);
  assert.equal(initial.reservedProductEventCapacity, 4096);
  assert.equal(initial.capacityHeadroom, 4079);
  assert.equal(initial.growthRequired, true);
  assert.equal(initial.exactActiveCountPreserved, true);

  const churn = reserveSphSparseRenderFieldProductEventCapacity({
    productEventCount: 23,
    currentCapacity: initial.reservedProductEventCapacity
  });
  assert.equal(churn.reservedProductEventCapacity, 4096);
  assert.equal(churn.fitsCurrentCapacity, true);
  assert.equal(churn.growthRequired, false);

  const lowerCount = reserveSphSparseRenderFieldProductEventCapacity({
    productEventCount: 2,
    currentCapacity: churn.reservedProductEventCapacity
  });
  assert.equal(lowerCount.reservedProductEventCapacity, 4096);
  assert.equal(lowerCount.growthPolicy, 'grow-only-fixed-bucket');

  const growth = reserveSphSparseRenderFieldProductEventCapacity({
    productEventCount: 4097,
    currentCapacity: lowerCount.reservedProductEventCapacity
  });
  assert.equal(growth.productEventCount, 4097);
  assert.equal(growth.reservedProductEventCapacity, 8192);
  assert.equal(growth.growthRequired, true);
  assert.throws(() => reserveSphSparseRenderFieldProductEventCapacity({
    productEventCount: 0x100000000
  }), /productEventCount must be an integer/);
});

test('particle reservations keep sparse runtime capacity stable across live-count churn', () => {
  assert.equal(SPH_SPARSE_RENDER_FIELD_PARTICLE_CAPACITY_BUCKET, 4096);
  const initial = reserveSphSparseRenderFieldParticleCapacity({ particleCount: 1024 });
  assert.equal(initial.particleCount, 1024);
  assert.equal(initial.reservedParticleCapacity, 4096);
  assert.equal(initial.capacityHeadroom, 3072);
  assert.equal(initial.exactActiveCountPreserved, true);

  const growthWithinBucket = reserveSphSparseRenderFieldParticleCapacity({
    particleCount: 1152,
    currentCapacity: initial.reservedParticleCapacity
  });
  assert.equal(growthWithinBucket.reservedParticleCapacity, 4096);
  assert.equal(growthWithinBucket.fitsCurrentCapacity, true);
  assert.equal(growthWithinBucket.growthRequired, false);

  const shrink = reserveSphSparseRenderFieldParticleCapacity({
    particleCount: 900,
    currentCapacity: growthWithinBucket.reservedParticleCapacity
  });
  assert.equal(shrink.reservedParticleCapacity, 4096);
  assert.equal(shrink.capacityHeadroom, 3196);

  const nextBucket = reserveSphSparseRenderFieldParticleCapacity({
    particleCount: 4097,
    currentCapacity: shrink.reservedParticleCapacity
  });
  assert.equal(nextBucket.reservedParticleCapacity, 8192);
  assert.equal(nextBucket.growthRequired, true);
});

test('GPU plan uses one home route per bounded eligible pair and directory activation scan', () => {
  const plan = createSphSparseRenderFieldGpuPlan({
    sparsePlan: makeSparsePlan(),
    particleCapacity: 10,
    productEventCapacity: 4,
    surfaceMetadata: [
      boundedSurfaceMetadata(1),
      boundedSurfaceMetadata(1)
    ],
    maxSupportRadiusBricks: 1
  });
  assert.equal(plan.admitted, true);
  assert.equal(plan.eligibilityCandidateCapacity, 28);
  assert.equal(plan.routeCapacity, 28);
  assert.equal(plan.keyWordCount, 1);
  assert.equal(plan.routeKey, 'home-directory-index-u32');
  assert.equal(plan.routeMultiplicity, 'one-route-per-eligible-source-surface');
  assert.equal(plan.activeDiscovery, 'dense-directory-atomic-flags-scan-compact');
  assert.equal(plan.atlasGather, 'bounded-neighbor-home-directory-csr');
  assert.equal(plan.runtimeOverflowImpossibleForDeclaredInputBounds, true);
  assert.equal(plan.exactCapacityProof.admitted, true);
  assert.equal(plan.exactCapacityProof.eligibility.requiredFullCartesianCount, 28);
  assert.equal(plan.exactCapacityProof.routes.requiredDeclaredSourceMultiplicity, 28);
  assert.equal(plan.exactCapacityProof.activeBricks.requiredFullDirectoryCount, 35);
  assert.equal(plan.exactCapacityProof.atlas.requiredFullPaddedDirectoryCellCount, 35 * 512);
  assert.ok(plan.exactCapacityProof.candidates.surfaces.every((surface) => surface.admitted));
  assert.equal(plan.exactCapacityProof.supportRadius.admitted, true);
  assert.ok(plan.byteLayout.retainedByteLength > 0);
  assert.ok(plan.byteLayout.directScratchByteLength > 0);
  assert.ok(plan.byteLayout.primitivePersistentByteLength > 0);
  assert.ok(plan.byteLayout.primitiveTransientByteLength > 0);
  assert.equal(plan.byteLayout.retained.candidateDispatchIndirect, 24);
  assert.equal(
    plan.byteLayout.peakAllocatedByteLength,
    plan.byteLayout.directAllocatedByteLength
      + plan.byteLayout.primitivePersistentByteLength
      + plan.byteLayout.primitiveTransientByteLength
  );
  assert.equal('activeCandidateRows' in plan.byteLayout.scratch, false);

  const understatedWildcardBound = createSphSparseRenderFieldGpuPlan({
    sparsePlan: makeSparsePlan(),
    particleCapacity: 10,
    productEventCapacity: 0,
    surfaceMetadata: [
      boundedSurfaceMetadata(1),
      boundedSurfaceMetadata(1, 2)
    ],
    maxParticleSurfacesPerSource: 1,
    maxSupportRadiusBricks: 1
  });
  assert.equal(understatedWildcardBound.admitted, false);
  assert.ok(understatedWildcardBound.reasons.includes(
    'particle-surface-bound-below-wildcard-derived-multiplicity'
  ));
  assert.equal(understatedWildcardBound.exactCapacityProof.routes.admitted, false);
  assert.equal(
    understatedWildcardBound.exactCapacityProof.routes.requiredDeclaredSourceMultiplicity,
    20
  );
});

test('GPU plan admits exact primitive bytes and blocks before allocation above the total limit', () => {
  const options = {
    particleCapacity: 10,
    productEventCapacity: 4,
    surfaceMetadata: [
      boundedSurfaceMetadata(1),
      boundedSurfaceMetadata(1)
    ],
    maxSupportRadiusBricks: 1
  };
  const unrestricted = createSphSparseRenderFieldGpuPlan({
    sparsePlan: makeSparsePlan(),
    ...options
  });
  const limit = unrestricted.byteLayout.peakAllocatedByteLength - 1;
  const blocked = createSphSparseRenderFieldGpuPlan({
    sparsePlan: makeSparsePlan({ maxTotalByteLength: limit }),
    ...options
  });
  assert.equal(blocked.sparsePlan.admission.admitted, true);
  assert.equal(blocked.admitted, false);
  assert.ok(blocked.reasons.includes('planned-allocation-exceeds-max-total-byte-length'));
  assert.equal(blocked.exactCapacityProof.bytes.admitted, false);
  assert.equal(blocked.runtimeOverflowImpossibleForDeclaredInputBounds, false);
  const device = createFakeDevice();
  const runtime = createSphSparseRenderFieldGpu(device, {
    sparsePlan: makeSparsePlan({ maxTotalByteLength: limit }),
    ...options
  });
  assert.equal(runtime.runtimeStatus, 'sparse-render-field-gpu-runtime-not-created-fail-closed');
  assert.equal(device.buffers.length, 0);

  const defaultLimitDevice = createFakeDevice();
  defaultLimitDevice.limits.maxStorageBuffersPerShaderStage = 8;
  const limitBlocked = createSphSparseRenderFieldGpu(defaultLimitDevice, {
    sparsePlan: makeSparsePlan(),
    ...options
  });
  assert.equal(limitBlocked.admitted, false);
  assert.ok(limitBlocked.reasons.includes(
    'device-storage-buffers-per-stage-below-field-requirement'
  ));
  assert.equal(defaultLimitDevice.buffers.length, 0);
  assert.equal(limitBlocked.exactCapacityProof.resources.admitted, false);
});

test('exact capacity proof identifies active, atlas, and per-surface candidate shortfalls', () => {
  const common = {
    particleCapacity: 10,
    productEventCapacity: 4,
    surfaceMetadata: [
      boundedSurfaceMetadata(1),
      boundedSurfaceMetadata(1)
    ],
    maxSupportRadiusBricks: 1
  };
  const structuralShortfall = createSphSparseRenderFieldGpuPlan({
    sparsePlan: makeSparsePlan({
      capacityOverrides: {
        activeBrickCount: 34,
        atlasCellCount: 34 * 512
      }
    }),
    ...common
  });
  assert.equal(structuralShortfall.admitted, true);
  assert.equal(structuralShortfall.exactCapacityProof.activeBricks.admitted, false);
  assert.equal(structuralShortfall.exactCapacityProof.atlas.admitted, false);
  assert.equal(structuralShortfall.runtimeOverflowImpossibleForDeclaredInputBounds, false);

  const candidateShortfall = createSphSparseRenderFieldGpuPlan({
    sparsePlan: makeSparsePlan({ capacityOverrides: { activeVoxelCount: 4_888 } }),
    candidateVoxelCapacities: [4_095, 793],
    ...common
  });
  assert.equal(candidateShortfall.admitted, true);
  assert.equal(candidateShortfall.exactCapacityProof.candidates.surfaces[0].admitted, false);
  assert.equal(candidateShortfall.exactCapacityProof.candidates.surfaces[1].admitted, true);
  assert.equal(candidateShortfall.exactCapacityProof.candidates.admitted, false);
  assert.equal(candidateShortfall.runtimeOverflowImpossibleForDeclaredInputBounds, false);

  const supportShortfall = createSphSparseRenderFieldGpuPlan({
    sparsePlan: makeSparsePlan(),
    particleCapacity: 10,
    productEventCapacity: 0,
    surfaceMetadata: [
      boundedSurfaceMetadata(1, 0, { strength: 100 }),
      boundedSurfaceMetadata(1)
    ],
    maxSupportRadiusBricks: 1
  });
  assert.equal(supportShortfall.admitted, false);
  assert.ok(supportShortfall.reasons.includes(
    'surface-support-radius-exceeds-declared-brick-bound'
  ));
  assert.equal(supportShortfall.exactCapacityProof.supportRadius.admitted, false);
  assert.ok(
    supportShortfall.exactCapacityProof.supportRadius.surfaces[0]
      .requiredSupportRadiusBricks > 1
  );
  assert.equal(supportShortfall.runtimeOverflowImpossibleForDeclaredInputBounds, false);
});

test('candidate voxel slices are storage-aligned and surface-local', () => {
  const slices = createSphSparseRenderFieldCandidateVoxelSlices({
    surfaces: makeSparsePlan().surfaceTable.surfaces,
    totalCapacity: 1000,
    capacities: [600, 400],
    minStorageBufferOffsetAlignment: 256
  });
  assert.equal(slices.capacityTotal, 1000);
  assert.equal(slices.slices[0].offsetBytes % 256, 0);
  assert.equal(slices.slices[1].offsetBytes % 256, 0);
  assert.equal(slices.slices[0].countMode, 'gpu-atomic-u32');
  assert.equal(slices.slices[1].surfaceIndex, 1);
  assert.equal(slices.slices[0].candidateDispatchIndirectOffsetBytes, 0);
  assert.equal(slices.slices[1].candidateDispatchIndirectOffsetBytes, 12);
  assert.throws(() => createSphSparseRenderFieldCandidateVoxelSlices({
    surfaces: makeSparsePlan().surfaceTable.surfaces,
    totalCapacity: 0xffffffff,
    capacities: [0xffffffff, 0],
    minStorageBufferOffsetAlignment: 256
  }), /exceeds u32 addressability/);
});

test('GPU plan admits unique-home and candidate-consumer indirect dispatch dimensions', () => {
  const plan = createSphSparseRenderFieldGpuPlan({
    sparsePlan: makeSparsePlan(),
    particleCapacity: 10,
    productEventCapacity: 4,
    surfaceMetadata: [
      boundedSurfaceMetadata(1),
      boundedSurfaceMetadata(1)
    ],
    maxComputeWorkgroupsPerDimension: 4
  });
  assert.equal(plan.admitted, false);
  assert.ok(plan.reasons.includes('unique-home-dispatch-exceeds-2d-dispatch-limit'));
  assert.ok(plan.reasons.includes('candidate-consumer-dispatch-exceeds-1d-dispatch-limit'));
});

test('GPU plan rejects non-8-cell bricks before allocating buffers', () => {
  const plan = createSphSparseRenderFieldGpuPlan({
    sparsePlan: makeSparsePlan({ brickSize: 4 }),
    particleCapacity: 2,
    productEventCapacity: 1
  });
  assert.equal(plan.admitted, false);
  assert.equal(plan.failClosed, true);
  assert.ok(plan.reasons.includes('gpu-sparse-render-field-requires-8-cell-bricks'));
});

test('WGSL keeps field evaluation local to CSR routes and retains dense field semantics', () => {
  assert.match(sphSparseRenderFieldHomeRouteWgsl, /fn mark_home_route_eligibility/);
  assert.match(sphSparseRenderFieldHomeRouteWgsl, /fn scatter_home_routes/);
  assert.match(sphSparseRenderFieldHomeRouteWgsl, /route_keys\[destination\] = directory_index/);
  assert.match(sphSparseRenderFieldDirectoryWgsl, /fn finalize_unique_home_dispatch/);
  assert.match(sphSparseRenderFieldDirectoryWgsl, /evidence_complete/);
  assert.match(sphSparseRenderFieldDirectoryWgsl, /fn build_unique_ranges_and_activation/);
  assert.match(sphSparseRenderFieldDirectoryWgsl, /unique_route_offsets\[unique_index \+ 1u\]/);
  assert.match(sphSparseRenderFieldDirectoryWgsl, /position = start \+ local_id\.x/);
  assert.doesNotMatch(sphSparseRenderFieldDirectoryWgsl, /for \(var end =/);
  assert.match(sphSparseRenderFieldDirectoryWgsl, /atomicOr\(&activation_flags/);
  assert.match(sphSparseRenderFieldDirectoryWgsl, /fn mark_active_presence/);
  assert.match(sphSparseRenderFieldDirectoryWgsl, /fn scatter_active_directory/);
  assert.match(sphSparseRenderFieldDirectoryWgsl, /SPARSE_ACTIVE_PREDECESSOR_X/);
  assert.match(sphSparseRenderFieldInitializeWgsl, /active_voxel_ids\[index\] = SPARSE_SENTINEL/);
  assert.match(sphSparseRenderFieldGatherAtlasWgsl, /route_range_for_neighbor/);
  assert.match(sphSparseRenderFieldGatherAtlasWgsl, /phase_weight/);
  assert.match(sphSparseRenderFieldGatherAtlasWgsl, /temperature_weighted/);
  assert.match(sphSparseRenderFieldGatherAtlasWgsl, /velocity_sq_weighted/);
  assert.match(sphSparseRenderFieldGatherAtlasWgsl, /neighboring home-directory CSR ranges/);
  assert.match(sphSparseRenderFieldGatherAtlasWgsl, /atomicAdd\(&candidate_counters/);
  assert.match(sphSparseRenderFieldGatherAtlasWgsl, /candidate_dispatch_indirect\[dispatch\]/);
  assert.match(sphSparseRenderFieldGatherAtlasWgsl, /\+ 31u\) \/ 32u/);
  assert.match(sphSparseRenderFieldGatherAtlasWgsl, /let logical_id = sample\.x/);
  assert.doesNotMatch(sphSparseRenderFieldGatherAtlasWgsl, /particle_index < params\.particle_count/);
  assert.doesNotMatch(sphSparseRenderFieldHomeRouteWgsl, /row0\.w\s*[<>]=?\s*0\.0/);
  assert.doesNotMatch(sphSparseRenderFieldHomeRouteWgsl, /row1\.w\s*[<>]=?\s*0\.0/);
});

test('mocked runtime encodes the complete no-submit sparse generation and exact bytes', () => {
  const device = createFakeDevice();
  const encoder = createFakeEncoder();
  const sparsePlan = makeSparsePlan();
  const runtime = createSphSparseRenderFieldGpu(device, {
    sparsePlan,
    particleCapacity: 4,
    productEventCapacity: 2,
    surfaceMetadata: [
      boundedSurfaceMetadata(1),
      boundedSurfaceMetadata(2)
    ],
    maxSupportRadiusBricks: 1,
    label: 'test-sparse-field'
  });
  const renderRowsBuffer = device.createBuffer({ label: 'render-rows', size: 4 * 80, usage: 128 });
  const surfaceBuffer = device.createBuffer({ label: 'render-surfaces', size: 2 * 64, usage: 128 });
  const productEventBuffer = device.createBuffer({ label: 'product-events', size: 2 * 128, usage: 128 });
  const result = runtime.encode(encoder, {
    renderRowsBuffer,
    surfaceBuffer,
    productEventBuffer,
    particleCount: 3,
    productEventCount: 1,
    generationId: 17,
    fieldPadding: 0.08,
    refEdgeM: 0.2,
    renderSmearDtS: 1 / 60
  });

  assert.equal(result.status, 'sparse-render-field-gpu-artifact-encoded');
  assert.equal(result.execution.status, 'sparse-render-field-gpu-generation-encoded');
  assert.equal(result.readbackPerformed, false);
  assert.equal(result.submitted, false);
  assert.equal(result.execution.submissionOwnership, 'caller');
  assert.equal(result.productEventCount, 1);
  assert.equal(result.productEventCapacity, 2);
  assert.equal(result.productEventCapacityHeadroom, 1);
  assert.equal(result.exactProductEventCountPreserved, true);
  assert.equal(result.execution.productEventCount, 1);
  assert.equal(result.generationPublicationEvidenceRequired, true);
  assert.equal(result.atlasCellStrideBytes, 32);
  assert.equal(result.candidateVoxelUnusedSentinel, 0xffffffff);
  assert.equal(result.candidateVoxelSlices.length, 2);
  assert.equal(result.candidateVoxelSlices[1].offsetBytes % 256, 0);
  assert.equal(result.candidateVoxelSlices[1].candidateDispatchIndirectOffsetBytes, 12);
  assert.equal(
    result.candidateVoxelSlices[0].candidateDispatchIndirectBuffer,
    result.candidateDispatchIndirectBuffer
  );
  assert.equal(result.candidateDispatchIndirectBufferByteLength, 24);
  assert.equal(result.candidateDispatchWorkgroupSize, 32);
  assert.equal(result.runtimeOverflowImpossibleForDeclaredInputBounds, true);
  assert.equal(result.exactCapacityProof.admitted, true);
  assert.ok((result.candidateDispatchIndirectBuffer.usage & 256) !== 0);
  assert.ok(result.byteEvidence.retainedByteLength > 0);
  assert.ok(result.byteEvidence.allocatedByteLength > result.byteEvidence.retainedByteLength);
  assert.equal(
    result.byteEvidence.allocatedByteLength,
    result.byteEvidence.retainedByteLength + result.byteEvidence.scratchByteLength
  );
  assert.equal(
    result.byteEvidence.allocatedByteLength,
    result.gpuPlan.byteLayout.peakAllocatedByteLength
  );
  const commands = encoder.events
    .filter((event) => event.kind === 'pass')
    .flatMap((event) => event.commands);
  const pipelineNames = commands.map((command) => command.pipeline);
  for (const expected of [
    'test-sparse-field-initialize',
    'test-sparse-field-mark-eligibility',
    'test-sparse-field-scatter-home-routes',
    'test-sparse-field-route-radix-initialize',
    'test-sparse-field-route-radix-mark-heads',
    'test-sparse-field-route-radix-scatter-unique',
    'test-sparse-field-route-radix-finalize-unique',
    'test-sparse-field-finalize-unique-home-dispatch',
    'test-sparse-field-activate-unique-homes',
    'test-sparse-field-mark-active-directory',
    'test-sparse-field-scatter-active-directory',
    'test-sparse-field-gather-atlas',
    'test-sparse-field-compact-surface-voxels',
    'test-sparse-field-finalize-surface-candidates'
  ]) assert.ok(pipelineNames.includes(expected), `missing ${expected}`);
  assert.equal(
    pipelineNames.filter((name) => name === 'test-sparse-field-route-radix-histogram').length,
    8
  );
  assert.ok(device.writes.some((write) => write.buffer.label === 'test-sparse-field-params-17'));
  assert.ok(result.transientBuffers.length > 1);
  assert.ok(commands.some((command) =>
    command.pipeline === 'test-sparse-field-gather-atlas' && command.dispatchIndirect));
  assert.ok(commands.some((command) =>
    command.pipeline === 'test-sparse-field-activate-unique-homes' && command.dispatchIndirect));
  const finalizeCandidatesGroup = device.bindGroups.find((group) =>
    group.label === 'test-sparse-field-finalize-candidates-group');
  assert.equal(
    finalizeCandidatesGroup.entries.find((entry) => entry.binding === 15).resource.buffer,
    result.candidateDispatchIndirectBuffer
  );
  assert.throws(() => runtime.encode(createFakeEncoder(), {
    renderRowsBuffer,
    surfaceBuffer,
    productEventBuffer,
    particleCount: 3,
    productEventCount: 1,
    generationId: 17,
    backgroundValue: 1
  }), /backgroundValue must be 0/);
  assert.throws(() => runtime.encode(createFakeEncoder(), {
    renderRowsBuffer,
    surfaceBuffer,
    productEventBuffer,
    particleCount: 3,
    productEventCount: 1,
    generationId: 17
  }), (error) => error?.status === 'sparse-render-field-encode-blocked-generation-in-flight');

  runtime.releaseTransientBuffers(result);
  assert.ok(result.transientBuffers.every((buffer) => buffer.destroyed));
  const next = runtime.encode(createFakeEncoder(), {
    renderRowsBuffer,
    surfaceBuffer,
    productEventBuffer,
    particleCount: 3,
    productEventCount: 1,
    generationId: 17
  });
  assert.equal(next.status, 'sparse-render-field-gpu-artifact-encoded');
  runtime.releaseTransientBuffers(next);
  assert.throws(() => runtime.encode(createFakeEncoder(), {
    renderRowsBuffer,
    surfaceBuffer,
    productEventBuffer,
    particleCount: 3,
    productEventCount: 3,
    generationId: 17
  }), /productEventCount must be an integer/);
  runtime.destroy();
  assert.ok(runtime.buffers.atlasBuffer.destroyed);
});

test('product route growth reuses the structural atlas until the last runtime releases it', () => {
  const device = createFakeDevice();
  const common = {
    sparsePlan: makeSparsePlan(),
    particleCapacity: 4,
    surfaceMetadata: [
      boundedSurfaceMetadata(1),
      boundedSurfaceMetadata(2)
    ],
    maxSupportRadiusBricks: 1
  };
  const first = createSphSparseRenderFieldGpu(device, {
    ...common,
    productEventCapacity: 2,
    label: 'test-sparse-field-generation-1'
  });
  const firstBufferCount = device.buffers.length;
  const second = createSphSparseRenderFieldGpu(device, {
    ...common,
    sparsePlan: makeSparsePlan({ generationId: 18 }),
    productEventCapacity: 8,
    structuralArena: first.structuralArena,
    label: 'test-sparse-field-generation-2'
  });

  assert.equal(first.structuralArenaReused, false);
  assert.equal(second.structuralArenaReused, true);
  assert.equal(second.structuralArena, first.structuralArena);
  assert.equal(second.buffers.directoryBuffer, first.buffers.directoryBuffer);
  assert.equal(second.buffers.atlasBuffer, first.buffers.atlasBuffer);
  assert.equal(second.buffers.candidateVoxelIdsBuffer, first.buffers.candidateVoxelIdsBuffer);
  assert.notEqual(second.buffers.routeRowsBuffer, first.buffers.routeRowsBuffer);
  assert.equal(first.structuralArena.referenceCount, 2);
  assert.equal(
    device.buffers.filter((buffer) => buffer.label.endsWith('-atlas')).length,
    1
  );
  assert.ok(device.buffers.length > firstBufferCount);

  first.destroy();
  assert.equal(second.structuralArena.referenceCount, 1);
  assert.equal(second.buffers.atlasBuffer.destroyed, false);
  second.destroy();
  assert.equal(second.structuralArena.referenceCount, 0);
  assert.equal(second.buffers.atlasBuffer.destroyed, true);
});
