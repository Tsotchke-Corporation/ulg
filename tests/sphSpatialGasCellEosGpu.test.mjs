import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createSphSpatialGasCellEosGpuLaneCapacityPlan,
  createSphSpatialGasCellEosGpuLane,
  createSphSpatialGasCellEosGpuPlan,
  getOrCreateSphSpatialGasCellEosGpuLane,
  resolveSphSpatialGasCellEosGpuSource,
  runSphSpatialGasCellEosGpu,
  sphGasCellEosExactOutputCapacityBound,
  sphGasCellEosGeometricCapacityClass,
  sphSpatialGasCellEosGpuWgsl,
  SPH_GAS_CELL_EOS_DIRECT_SOURCE_LIMIT,
  SPH_GAS_CELL_EOS_EXACT_LINEAR_RADIX_MAX_SOURCE_CAPACITY,
  SPH_GAS_CELL_EOS_METADATA,
  SPH_GAS_CELL_EOS_METADATA_WORDS,
  SPH_GAS_PRESSURE_CELL_ROW_FLOATS,
  SPH_SPATIAL_GAS_CELL_EOS_GPU_TIMESTAMP_STAGE,
  ULG_SPH_SPATIAL_GAS_CELL_EOS_GPU_EVIDENCE_SCHEMA,
  ULG_SPH_SPATIAL_GAS_CELL_EOS_EXACT_PREFIX_AUTHORITY_SCHEMA,
  ULG_SPH_SPATIAL_GAS_CELL_EOS_GPU_SOURCE_SCHEMA
} from '../src/runtime/sph/sphSpatialGasCellEosGpu.js';
import { tagWebGpuBufferDevice } from '../src/runtime/sph/sphGpuDeviceIdentity.js';

function leaseIdentity(overrides = {}) {
  return {
    schema: 'peercompute.compute.gpu-resident-lane-lease-identity.v0',
    authoritative: true,
    leaseId: 'compute-manager-gas-lease-1',
    laneId: 'ulg:sph:resident',
    stateKey: 'ulg:sph:state',
    sourceFamily: 'sph-particle-state',
    domainKey: 'box:0',
    solverId: 'ulg-sph-gas-cell-eos-producer-stage',
    taskId: 'gas-cell-eos-task-1',
    owner: 'compute-manager',
    ...overrides
  };
}

function fakeDevice() {
  const buffers = [];
  const pipelines = [];
  const bindGroups = [];
  const writes = [];
  const submissions = [];
  const encoders = [];
  const device = {
    buffers,
    pipelines,
    bindGroups,
    writes,
    submissions,
    encoders,
    limits: {
      maxBufferSize: 1 << 30,
      maxStorageBufferBindingSize: 1 << 30,
      maxComputeWorkgroupsPerDimension: 65535,
      maxComputeInvocationsPerWorkgroup: 256,
      maxStorageBuffersPerShaderStage: 10
    },
    queue: {
      writeBuffer(buffer, offset, data) {
        const source = data instanceof ArrayBuffer
          ? new Uint8Array(data)
          : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        writes.push({
          buffer,
          offset,
          byteLength: data.byteLength,
          bytes: new Uint8Array(source)
        });
      },
      submit(commands) {
        submissions.push(commands);
      },
      async onSubmittedWorkDone() {}
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
    },
    createCommandEncoder() {
      const events = [];
      const encoder = {
        events,
        clearBuffer(buffer, offset = 0, size = null) {
          events.push({ kind: 'clear', label: buffer.label, offset, size });
        },
        beginComputePass(descriptor = {}) {
          const event = { kind: 'pass', descriptor, pipeline: null, dispatch: null, indirect: null };
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
        },
        finish() {
          events.push({ kind: 'finish' });
          return { events };
        }
      };
      encoders.push(encoder);
      return encoder;
    }
  };
  return device;
}

function retainedProductSource(device, rowCount = 8) {
  const buffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'retained-product-events',
    size: rowCount * 32 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  }), device);
  return resolveSphSpatialGasCellEosGpuSource({
    residentProductMass: {
      productEventBuffer: buffer,
      productEventBufferRetained: true,
      productEventRowCount: rowCount,
      productEventStrideFloats: 32
    },
    sourceEpoch: 17,
    sourceGeneration: 9,
    sourceTaskId: 'reaction-product-task-9'
  });
}

function exactArenaProductSource(device, {
  rowCountUpperBound = 5_270,
  capacityRows = 5_440,
  generationId = 41,
  metadataDevice = device,
  dispatchDevice = device
} = {}) {
  const buffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'retained-exact-arena-product-events',
    size: capacityRows * 32 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  }), device);
  const metadataBuffer = tagWebGpuBufferDevice(metadataDevice.createBuffer({
    label: 'retained-exact-arena-metadata',
    size: 16 * Uint32Array.BYTES_PER_ELEMENT,
    usage: 128
  }), metadataDevice);
  const dispatchIndirectBuffer = tagWebGpuBufferDevice(dispatchDevice.createBuffer({
    label: 'retained-exact-arena-dispatch',
    size: 3 * Uint32Array.BYTES_PER_ELEMENT,
    usage: 128 | 256
  }), dispatchDevice);
  const residentProductMass = {
    productEventBuffer: buffer,
    productEventBufferRetained: true,
    productEventRowCount: rowCountUpperBound,
    productEventStrideFloats: 32,
    productEventMetadataBuffer: metadataBuffer,
    productEventDispatchIndirectBuffer: dispatchIndirectBuffer,
    productEventArena: {
      schema: 'peercompute.ulg.sph-resident-product-event-arena.v0',
      capacityRows,
      generationId,
      strideFloats: 32,
      metadataBuffer,
      dispatchIndirectBuffer
    }
  };
  return resolveSphSpatialGasCellEosGpuSource({
    residentProductMass,
    sourceEpoch: 23,
    sourceGeneration: 47,
    sourceTaskId: 'exact-arena-source-task'
  });
}

function sharedExactArenaProductSource(device, template, rowCountUpperBound, generationId) {
  const authority = template.exactPrefixAuthority;
  return resolveSphSpatialGasCellEosGpuSource({
    residentProductMass: {
      productEventBuffer: template.sourceBuffer,
      productEventBufferRetained: true,
      productEventRowCount: rowCountUpperBound,
      productEventStrideFloats: 32,
      productEventMetadataBuffer: authority.metadataBuffer,
      productEventDispatchIndirectBuffer: authority.dispatchIndirectBuffer,
      productEventArena: {
        schema: 'peercompute.ulg.sph-resident-product-event-arena.v0',
        capacityRows: authority.capacityRows,
        generationId,
        strideFloats: 32,
        metadataBuffer: authority.metadataBuffer,
        dispatchIndirectBuffer: authority.dispatchIndirectBuffer
      }
    },
    sourceEpoch: generationId,
    sourceGeneration: generationId,
    sourceTaskId: `shared-exact-arena-source-${generationId}`
  });
}

test('GPU gas-cell plan fixes retained row, metadata, lookup, and capacity contracts', () => {
  const plan = createSphSpatialGasCellEosGpuPlan({
    sourceRowCount: 300_000,
    sourceRowStrideFloats: 32,
    sourceKind: 'product-event',
    sourceCapacity: 300_000,
    gasCellCapacity: 300_001,
    maxGridCellCount: 262_144,
    gridDims: [64, 64, 64],
    boxDimsM: [4, 2, 1]
  });
  assert.equal(plan.sourceRowByteLength, 300_000 * 32 * 4);
  assert.equal(plan.gasPressureCellRowStrideFloats, SPH_GAS_PRESSURE_CELL_ROW_FLOATS);
  assert.equal(plan.gasPressureCellRowsBufferByteLength, 300_001 * 12 * 4);
  assert.equal(plan.gasCellLookupBufferByteLength, 262_144 * 4);
  assert.equal(plan.metadataBufferByteLength, SPH_GAS_CELL_EOS_METADATA_WORDS * 4);
  assert.equal(plan.noReadback, true);
  assert.equal(plan.cpuDecode, false);
  assert.equal(plan.cpuReupload, false);
  assert.throws(
    () => createSphSpatialGasCellEosGpuPlan({
      sourceRowCount: 8,
      sourceKind: 'product-event',
      sourceCapacity: 8,
      gasCellCapacity: 4,
      maxGridCellCount: 8,
      gridDims: [2, 2, 2],
      boxDimsM: [1, 1, 1]
    }),
    /cannot fail-close/
  );
});

test('exact output capacity bound and physical lane plan avoid active-prefix class churn', () => {
  assert.equal(sphGasCellEosExactOutputCapacityBound(4_096, 4_096), 4_096);
  assert.equal(sphGasCellEosExactOutputCapacityBound(4_096, 8_192), 4_096);
  assert.equal(sphGasCellEosExactOutputCapacityBound(8_192, 4_096), 4_097);

  const exactPowerOfTwoPlan = createSphSpatialGasCellEosGpuPlan({
    sourceRowCount: 4_096,
    sourceKind: 'product-event',
    sourceCapacity: 4_096,
    gasCellCapacity: 4_096,
    maxGridCellCount: 4_096,
    gridDims: [16, 16, 16],
    boxDimsM: [1, 1, 1]
  });
  assert.equal(exactPowerOfTwoPlan.requiredGasCellCapacity, 4_096);
  assert.throws(
    () => createSphSpatialGasCellEosGpuPlan({
      sourceRowCount: 4_096,
      sourceKind: 'product-event',
      sourceCapacity: 4_096,
      gasCellCapacity: 4_095,
      maxGridCellCount: 4_096,
      gridDims: [16, 16, 16],
      boxDimsM: [1, 1, 1]
    }),
    /cannot fail-close/
  );

  const mountedUpperBounds = [2_550, 5_270, 7_990, 10_710];
  const plans = mountedUpperBounds.map((sourceCapacity) =>
    createSphSpatialGasCellEosGpuLaneCapacityPlan({
      sourceCapacity,
      maxGridCellCount: 15_625
    }));
  assert.deepEqual(plans.map((plan) => plan.sourceCapacityClass), [65_536, 65_536, 65_536, 65_536]);
  assert.deepEqual(plans.map((plan) => plan.requiredGasCellCapacity), [15_626, 15_626, 15_626, 15_626]);
  assert.deepEqual(plans.map((plan) => plan.gasCellCapacityClass), [16_384, 16_384, 16_384, 16_384]);
  assert.deepEqual(plans.map((plan) => plan.maxGridCellCountClass), [16_384, 16_384, 16_384, 16_384]);

  const configuredMinimum = createSphSpatialGasCellEosGpuLaneCapacityPlan({
    sourceCapacity: 2_550,
    maxGridCellCount: 15_625,
    minimumGasCellCapacity: 20_000
  });
  assert.equal(configuredMinimum.requiredGasCellCapacity, 15_626);
  assert.equal(configuredMinimum.configuredMinimumGasCellCapacity, 20_000);
  assert.equal(configuredMinimum.gasCellCapacity, 20_000);
  assert.equal(configuredMinimum.gasCellCapacityClass, 32_768);
  assert.throws(
    () => createSphSpatialGasCellEosGpuLaneCapacityPlan({
      sourceCapacity: 1,
      maxGridCellCount: 0xffff_ffff
    }),
    /maxGridCellCount/
  );
  assert.throws(
    () => createSphSpatialGasCellEosGpuLaneCapacityPlan({
      sourceCapacity: 1,
      maxGridCellCount: 1,
      minimumGasCellCapacity: -1
    }),
    /minimumGasCellCapacity/
  );
});

test('source resolver admits retained product events and rejects host-shaped or unretained sources', () => {
  const device = fakeDevice();
  const ready = retainedProductSource(device, 4);
  assert.equal(ready.schema, ULG_SPH_SPATIAL_GAS_CELL_EOS_GPU_SOURCE_SCHEMA);
  assert.equal(ready.ready, true);
  assert.equal(ready.sourceKind, 'resident-product-event-rows');
  assert.equal(ready.sourceRowStrideFloats, 32);
  assert.equal(ready.cpuRowsPresent, false);

  const blocked = resolveSphSpatialGasCellEosGpuSource({
    productEventBuffer: ready.sourceBuffer,
    productEventBufferRetained: false,
    productEventRowCount: 4,
    productEventStrideFloats: 32
  });
  assert.equal(blocked.ready, false);
  assert.equal(blocked.blocker, 'retained-spatial-gas-source-buffer-evidence-required');
});

test('source resolver carries complete resident arena metadata and indirect exact-count authority', () => {
  const device = fakeDevice();
  const source = exactArenaProductSource(device);
  assert.equal(source.ready, true);
  assert.equal(source.exactPrefixAuthorityRequested, true);
  assert.equal(source.exactPrefixAuthorityReady, true);
  assert.equal(
    source.exactPrefixAuthority.schema,
    ULG_SPH_SPATIAL_GAS_CELL_EOS_EXACT_PREFIX_AUTHORITY_SCHEMA
  );
  assert.equal(source.exactPrefixAuthority.capacityRows, 5_440);
  assert.equal(source.exactPrefixAuthority.generationId, 41);
  assert.equal(source.exactPrefixAuthority.activeRowCountMetadataWord, 3);
  assert.equal(source.exactSourceRowCount, null);
  assert.equal(source.normalHotLoopReadbackFree, true);

  const partial = resolveSphSpatialGasCellEosGpuSource({
    source: {
      sourceKind: 'product-event',
      productEventBuffer: source.sourceBuffer,
      productEventBufferRetained: true,
      productEventRowCount: 8,
      productEventStrideFloats: 32,
      productEventMetadataBuffer: source.exactPrefixAuthority.metadataBuffer
    }
  });
  assert.equal(partial.ready, false);
  assert.equal(partial.blocker, 'resident-product-event-exact-prefix-authority-incomplete');
});

test('large host upper bound uses fixed-command GPU exact prefix without radix topology', () => {
  const device = fakeDevice();
  const source = exactArenaProductSource(device);
  const lane = createSphSpatialGasCellEosGpuLane(device, {
    sourceCapacity: 5_270,
    gasCellCapacity: 513,
    maxGridCellCount: 512,
    requireLaneIdentity: false
  });
  const encoder = device.createCommandEncoder();
  const result = lane.encode(encoder, {
    source,
    gridDims: [8, 8, 8],
    boxDimsM: [2, 2, 2]
  });
  assert.equal(result.ready, true);
  assert.equal(result.aggregationStrategy, 'gpu-exact-stable-counting-radix');
  assert.equal(result.exactPrefix, true);
  assert.equal(result.radixBypassed, true);
  assert.equal(result.encodedDispatchCount, 6);
  assert.equal(result.encodedComputePassCount, 3);
  assert.equal(result.gpuGatedIndirectDispatchCount, 3);
  assert.equal(result.exactSourceRowCount, null);
  assert.equal(result.exactSourceRowCountMetadataWord, 3);
  assert.equal(result.exactPrefixStaticSourceCapacityBound, 5_270);
  assert.equal(result.exactPrefixStaticOperationBound, 54_748);
  assert.equal(result.totalEncodedBindGroupCreationCount, 6);
  assert.equal(result.mapAsyncCalled, false);
  const pipelineLabels = encoder.events
    .filter((event) => event.kind === 'pass')
    .map((event) => event.pipeline);
  assert.ok(pipelineLabels.includes('ulg-sph-spatial-gas-cell-eos-prepare-exact-prefix'));
  assert.ok(device.bindGroups.some((entry) => entry.label.includes('exact-group-bind')));
  assert.ok(!pipelineLabels.some((label) => label?.includes('-radix-')));
  const exactGroup = encoder.events.find(
    (event) => event.descriptor?.label
      === 'ulg-sph-spatial-gas-cell-eos-exact-prefix-and-dispatch-prepare'
  );
  assert.deepEqual(exactGroup.indirect, {
    label: 'ulg-sph-spatial-gas-cell-eos-exact-gated-dispatch',
    offset: 0
  });
  result.cancelBeforeSubmit({ reason: 'exact-prefix-unit-complete' });
  lane.destroy();

  const radixSource = retainedProductSource(device, 5_270);
  const radixLane = createSphSpatialGasCellEosGpuLane(device, {
    sourceCapacity: 5_270,
    gasCellCapacity: 513,
    maxGridCellCount: 512,
    requireLaneIdentity: false
  });
  const radixResult = radixLane.encode(device.createCommandEncoder(), {
    source: radixSource,
    gridDims: [8, 8, 8],
    boxDimsM: [2, 2, 2]
  });
  assert.equal(radixResult.encodedDispatchCount, 35);
  assert.equal(radixResult.encodedComputePassCount, 5);
  assert.equal(radixResult.bindGroupCreationCount, 5);
  assert.equal(radixResult.primitiveBindGroupCreationCount, 23);
  assert.equal(radixResult.totalEncodedBindGroupCreationCount, 28);
  assert.equal(radixResult.encodedDispatchCount - result.encodedDispatchCount, 29);
  assert.equal(
    radixResult.totalEncodedBindGroupCreationCount
      - result.totalEncodedBindGroupCreationCount,
    22
  );
  radixResult.cancelBeforeSubmit({ reason: 'radix-comparison-unit-complete' });
  radixLane.destroy();
});

test('exact authority falls back to stable radix above the fixed-command capacity bound', () => {
  const device = fakeDevice();
  const rowCount = SPH_GAS_CELL_EOS_EXACT_LINEAR_RADIX_MAX_SOURCE_CAPACITY + 1;
  const source = exactArenaProductSource(device, {
    rowCountUpperBound: rowCount,
    capacityRows: rowCount + 255
  });
  const lane = createSphSpatialGasCellEosGpuLane(device, {
    sourceCapacity: rowCount,
    gasCellCapacity: 513,
    maxGridCellCount: 512,
    requireLaneIdentity: false
  });
  const encoder = device.createCommandEncoder();
  const result = lane.encode(encoder, {
    source,
    gridDims: [8, 8, 8],
    boxDimsM: [1, 1, 1]
  });
  assert.equal(result.ready, true);
  assert.equal(result.exactPrefix, false);
  assert.equal(result.radixBypassed, false);
  assert.equal(
    result.exactPrefixAuthorityFallbackReason,
    'geometric-source-capacity-class-exceeds-fixed-command-bound'
  );
  assert.equal(result.aggregationStrategy, 'stable-radix-sort-unique');
  assert.ok(encoder.events.some((event) => event.pipeline?.includes('radix')));
  const keyBind = device.bindGroups.find((entry) => entry.label.includes('build-keys-bind'));
  assert.equal(
    keyBind.entries.find((entry) => entry.binding === 4).resource.buffer,
    source.exactPrefixAuthority.metadataBuffer
  );
  result.cancelBeforeSubmit({ reason: 'exact-prefix-fallback-unit-complete' });
  lane.destroy();
});

test('lane uses deterministic direct grouping for a small prefix without map or CPU rows', () => {
  const device = fakeDevice();
  const source = retainedProductSource(device, 8);
  const lane = createSphSpatialGasCellEosGpuLane(device, {
    sourceCapacity: 8,
    gasCellCapacity: 9,
    maxGridCellCount: 8,
    laneId: 'ulg:sph:resident',
    stateKey: 'ulg:sph:state',
    sourceFamily: 'sph-particle-state'
  });
  const encoder = device.createCommandEncoder();
  const result = lane.encode(encoder, {
    source,
    gpuResidentLaneLeaseIdentity: leaseIdentity(),
    gridDims: [2, 2, 2],
    boxDimsM: [2, 2, 2]
  });
  assert.equal(result.ready, true);
  assert.equal(result.backend, 'webgpu');
  assert.equal(result.mapAsyncCalled, false);
  assert.equal(result.cpuDecodePerformed, false);
  assert.equal(result.cpuGasCellRowsUploaded, false);
  assert.equal(result.pressureInterfaceGasPressureCellRowCount, 0);
  assert.equal(result.pressureInterfaceGasPressureCellRowCapacity, 9);
  assert.equal(result.gpuEvidence.schema, ULG_SPH_SPATIAL_GAS_CELL_EOS_GPU_EVIDENCE_SCHEMA);
  assert.equal(result.gpuEvidence.expectedSourceEpoch, 17);
  assert.equal(result.gpuEvidence.expectedSourceGeneration, 9);
  assert.deepEqual(result.gridDims, [2, 2, 2]);
  assert.deepEqual(result.retainedGasPressureBufferRefs, [
    'resident-gas-pressure-cells-buffer',
    'resident-gas-pressure-cell-metadata-buffer',
    'resident-gas-pressure-cell-lookup-buffer'
  ]);
  assert.equal(result.aggregationStrategy, 'deterministic-direct-key-sort-unique');
  assert.equal(result.directPrefix, true);
  assert.equal(result.radixBypassed, true);
  assert.equal(result.encodedDispatchCount, 5);
  assert.equal(result.encodedComputePassCount, 2);
  const labels = encoder.events.filter((event) => event.kind === 'pass').map((event) => event.pipeline);
  assert.ok(device.pipelines.some(
    (pipeline) => pipeline.label === 'ulg-sph-spatial-gas-cell-eos-group-direct-prefix'
  ));
  assert.ok(encoder.events.some(
    (event) => event.descriptor?.label === 'ulg-sph-spatial-gas-cell-eos-direct-prefix-and-dispatch-prepare'
  ));
  assert.ok(!labels.includes('ulg-sph-spatial-gas-cell-eos-build-keys'));
  for (const label of [
    'ulg-sph-spatial-gas-cell-eos-reduce-cells',
    'ulg-sph-spatial-gas-cell-eos-finalize-evidence',
    'ulg-sph-spatial-gas-cell-eos-compute-gradients'
  ]) {
    assert.ok(device.pipelines.some((pipeline) => pipeline.label === label));
  }
  assert.ok(encoder.events.some(
    (event) => event.descriptor?.label === 'ulg-sph-spatial-gas-cell-eos-grouped-reduce-finalize-gradient'
  ));
  assert.equal(device.writes.some((write) => write.buffer === source.sourceBuffer), false);
  assert.equal(Object.values(SPH_GAS_CELL_EOS_METADATA).every(Number.isInteger), true);
  assert.equal(SPH_GAS_CELL_EOS_METADATA.admittedActiveCellCount, 9);
});

test('shared profiler attributes direct grouping, reduce, finalize, and gradient without local submit', () => {
  const device = fakeDevice();
  const source = retainedProductSource(device, 4);
  const lane = createSphSpatialGasCellEosGpuLane(device, {
    sourceCapacity: 4,
    gasCellCapacity: 5,
    maxGridCellCount: 4,
    requireLaneIdentity: false
  });
  const encoder = device.createCommandEncoder();
  const spans = [];
  const timestampProfiler = {
    active: true,
    capability: { requested: true },
    beginComputePassDescriptor(label, metadata) {
      spans.push({ label, metadata });
      return { label };
    }
  };
  const result = lane.encode(encoder, {
    source,
    gridDims: [1, 2, 2],
    boxDimsM: [1, 1, 1],
    timestampProfiler,
    timestampMetadata: { taskId: 'gas-profile-task' }
  });
  const labels = new Set(spans.map((span) => span.label));
  for (const label of [
    SPH_SPATIAL_GAS_CELL_EOS_GPU_TIMESTAMP_STAGE.directGroup,
    SPH_SPATIAL_GAS_CELL_EOS_GPU_TIMESTAMP_STAGE.dispatchPrepare,
    SPH_SPATIAL_GAS_CELL_EOS_GPU_TIMESTAMP_STAGE.cellReduce,
    SPH_SPATIAL_GAS_CELL_EOS_GPU_TIMESTAMP_STAGE.finalize,
    SPH_SPATIAL_GAS_CELL_EOS_GPU_TIMESTAMP_STAGE.gradient
  ]) {
    assert.equal(labels.has(label), true, `missing timestamp span ${label}`);
  }
  assert.equal(labels.has(SPH_SPATIAL_GAS_CELL_EOS_GPU_TIMESTAMP_STAGE.keyBuild), false);
  assert.equal(spans.some((span) => span.metadata?.sphGasCellEosStage === 'radix'), false);
  assert.equal(result.gpuTimestampRequested, true);
  assert.equal(result.gpuTimestampStatus, 'shared-profiler-deferred');
  assert.equal(result.callerOwnedEncoder, true);
  assert.equal(device.submissions.length, 0);
  assert.equal(result.mapAsyncCalled, false);
  result.cancelBeforeSubmit({ reason: 'profile-test-no-submit' });
  lane.destroy();
});

test('prefix above the direct threshold retains stable radix fallback', () => {
  const device = fakeDevice();
  const rowCount = SPH_GAS_CELL_EOS_DIRECT_SOURCE_LIMIT + 1;
  const source = retainedProductSource(device, rowCount);
  const lane = createSphSpatialGasCellEosGpuLane(device, {
    sourceCapacity: rowCount,
    gasCellCapacity: rowCount + 1,
    maxGridCellCount: 512,
    requireLaneIdentity: false
  });
  const encoder = device.createCommandEncoder();
  const result = lane.encode(encoder, {
    source,
    gridDims: [8, 8, 8],
    boxDimsM: [1, 1, 1]
  });
  assert.equal(result.ready, true);
  assert.equal(result.aggregationStrategy, 'stable-radix-sort-unique');
  assert.equal(result.directPrefix, false);
  assert.equal(result.radixBypassed, false);
  const labels = encoder.events.filter((event) => event.kind === 'pass').map((event) => event.pipeline);
  assert.ok(labels.includes('ulg-sph-spatial-gas-cell-eos-build-keys'));
  assert.ok(labels.some((label) => label?.includes('radix')));
  result.cancelBeforeSubmit({ reason: 'radix-fallback-test-no-submit' });
  lane.destroy();
});

test('caller-owned profiling fails closed without an authority-owned shared profiler', async () => {
  const device = fakeDevice();
  const result = await runSphSpatialGasCellEosGpu({
    device,
    commandEncoder: device.createCommandEncoder(),
    source: retainedProductSource(device, 4),
    sourceCapacity: 4,
    gasCellCapacity: 5,
    maxGridCellCount: 4,
    gridDims: [1, 2, 2],
    boxDimsM: [1, 1, 1],
    requireLaneIdentity: false,
    measureGpuTimestamps: true
  });
  assert.equal(result.ready, false);
  assert.equal(result.blocker, 'caller-owned-encoder-requires-shared-timestamp-profiler');
  assert.equal(device.submissions.length, 0);
});

test('lane fails closed for missing or forged ComputeManager identity and cross-device sources', () => {
  const device = fakeDevice();
  const otherDevice = fakeDevice();
  const source = retainedProductSource(device, 4);
  const lane = createSphSpatialGasCellEosGpuLane(device, {
    sourceCapacity: 4,
    gasCellCapacity: 5,
    maxGridCellCount: 4,
    laneId: 'ulg:sph:resident'
  });
  const args = { source, gridDims: [1, 2, 2], boxDimsM: [1, 1, 1] };
  assert.equal(lane.encode(device.createCommandEncoder(), args).blocker,
    'authoritative-gpu-resident-lane-lease-identity-required');
  assert.equal(lane.encode(device.createCommandEncoder(), {
    ...args,
    gpuResidentLaneLeaseIdentity: leaseIdentity({ authoritative: false })
  }).blocker, 'authoritative-gpu-resident-lane-lease-identity-invalid');
  assert.equal(lane.encode(device.createCommandEncoder(), {
    ...args,
    gpuResidentLaneLeaseIdentity: leaseIdentity({ laneId: 'wrong' })
  }).blocker, 'gpu-resident-lane-id-mismatch');

  const crossDeviceLane = createSphSpatialGasCellEosGpuLane(otherDevice, {
    sourceCapacity: 4,
    gasCellCapacity: 5,
    maxGridCellCount: 4,
    requireLaneIdentity: false
  });
  assert.equal(crossDeviceLane.encode(otherDevice.createCommandEncoder(), args).blocker,
    'spatial-gas-source-device-mismatch');

  const untaggedBuffer = device.createBuffer({ label: 'untagged-source', size: 4 * 32 * 4, usage: 128 });
  const untaggedSource = resolveSphSpatialGasCellEosGpuSource({
    productEventBuffer: untaggedBuffer,
    productEventBufferRetained: true,
    productEventRowCount: 4,
    productEventStrideFloats: 32
  });
  assert.equal(lane.encode(device.createCommandEncoder(), {
    ...args,
    source: untaggedSource,
    gpuResidentLaneLeaseIdentity: leaseIdentity()
  }).blocker, 'spatial-gas-source-device-provenance-required');

  const crossDeviceAuthoritySource = exactArenaProductSource(device, {
    metadataDevice: otherDevice,
    dispatchDevice: otherDevice
  });
  assert.equal(lane.encode(device.createCommandEncoder(), {
    ...args,
    source: crossDeviceAuthoritySource,
    gpuResidentLaneLeaseIdentity: leaseIdentity()
  }).blocker, 'resident-product-event-exact-prefix-authority-device-mismatch');
});

test('length-prefixed lane identity hashing rejects pipe-delimiter aliases', () => {
  const device = fakeDevice();
  const source = retainedProductSource(device, 4);
  const lane = createSphSpatialGasCellEosGpuLane(device, {
    sourceCapacity: 4,
    gasCellCapacity: 5,
    maxGridCellCount: 4,
    requireLaneIdentity: false
  });
  const firstIdentity = leaseIdentity({
    leaseId: 'lease|lane',
    laneId: 'state',
    stateKey: 'key',
    sourceFamily: 'family'
  });
  const secondIdentity = leaseIdentity({
    leaseId: 'lease',
    laneId: 'lane|state',
    stateKey: 'key',
    sourceFamily: 'family'
  });
  assert.equal(
    [firstIdentity.leaseId, firstIdentity.laneId, firstIdentity.stateKey, firstIdentity.sourceFamily].join('|'),
    [secondIdentity.leaseId, secondIdentity.laneId, secondIdentity.stateKey, secondIdentity.sourceFamily].join('|')
  );
  const encode = (identity) => lane.encode(device.createCommandEncoder(), {
    source,
    gpuResidentLaneLeaseIdentity: identity,
    gridDims: [1, 2, 2],
    boxDimsM: [1, 1, 1]
  });
  const first = encode(firstIdentity);
  assert.equal(first.ready, true);
  first.cancelBeforeSubmit({ reason: 'delimiter-alias-first-complete' });
  const second = encode(secondIdentity);
  assert.equal(second.ready, true);
  assert.notDeepEqual(
    [first.laneIdentityHashLow, first.laneIdentityHashHigh],
    [second.laneIdentityHashLow, second.laneIdentityHashHigh]
  );
  second.cancelBeforeSubmit({ reason: 'delimiter-alias-test-complete' });
});

test('strict real-authority leases occupy both slots with distinct parameter hash words', async () => {
  const device = fakeDevice();
  const source = retainedProductSource(device, 4);
  const fixedIdentity = {
    laneId: 'ulg:sph:strict-concurrency-lane',
    stateKey: 'ulg:sph:strict-concurrency-state',
    sourceFamily: 'sph-particle-state'
  };
  const lane = createSphSpatialGasCellEosGpuLane(device, {
    sourceCapacity: 4,
    gasCellCapacity: 5,
    maxGridCellCount: 4,
    ...fixedIdentity
  });
  const encode = (leaseId) => lane.encode(device.createCommandEncoder(), {
    source,
    gpuResidentLaneLeaseIdentity: leaseIdentity({ leaseId, ...fixedIdentity }),
    gridDims: [1, 2, 2],
    boxDimsM: [1, 1, 1]
  });
  const first = encode('compute-manager-strict-concurrency-lease-a');
  const second = encode('compute-manager-strict-concurrency-lease-b');
  assert.equal(first.ready, true);
  assert.equal(second.ready, true);
  assert.notEqual(first.batchSlotIndex, second.batchSlotIndex);
  const firstConsumer = first.addConsumerLease({ consumerStage: 'pressureInterface-a' });
  const secondConsumer = second.addConsumerLease({ consumerStage: 'pressureInterface-b' });
  assert.equal(typeof firstConsumer, 'string');
  assert.equal(typeof secondConsumer, 'string');

  const paramsBufferFor = (result) => lane.allocationEntries().find(
    (entry) => entry.role === `gas-pressure-params-${result.batchSlotIndex}`
  )?.buffer;
  const paramsHashWords = (result) => {
    const paramsBuffer = paramsBufferFor(result);
    const write = device.writes.find((entry) =>
      entry.buffer === paramsBuffer && entry.offset === result.paramsByteOffset);
    assert.ok(write, `missing params write for batch slot ${result.batchSlotIndex}`);
    const view = new DataView(write.bytes.buffer, write.bytes.byteOffset, write.bytes.byteLength);
    return [view.getUint32(9 * 4, true), view.getUint32(10 * 4, true)];
  };
  const firstHashWords = paramsHashWords(first);
  const secondHashWords = paramsHashWords(second);
  assert.deepEqual(firstHashWords, [first.laneIdentityHashLow, first.laneIdentityHashHigh]);
  assert.deepEqual(secondHashWords, [second.laneIdentityHashLow, second.laneIdentityHashHigh]);
  assert.notDeepEqual(secondHashWords, firstHashWords);

  const blocked = encode('compute-manager-strict-concurrency-lease-c');
  assert.equal(blocked.ready, false);
  assert.equal(blocked.blocker, 'sph-spatial-gas-cell-eos-batch-slot-capacity-exhausted');
  first.markSubmitted();
  first.retire({ reason: 'strict-concurrency-first-retire' });
  first.releaseConsumerLease(firstConsumer);
  await new Promise((resolve) => setImmediate(resolve));

  const admitted = encode('compute-manager-strict-concurrency-lease-c');
  assert.equal(admitted.ready, true);
  assert.equal(admitted.batchSlotIndex, first.batchSlotIndex);
  second.releaseConsumerLease(secondConsumer);
  second.cancelBeforeSubmit({ reason: 'strict-concurrency-second-complete' });
  admitted.cancelBeforeSubmit({ reason: 'strict-concurrency-admitted-complete' });
});

test('two batch slots are leased and a third encoder fails closed until fence-deferred retirement', async () => {
  const device = fakeDevice();
  const source = retainedProductSource(device, 4);
  const lane = createSphSpatialGasCellEosGpuLane(device, {
    sourceCapacity: 4,
    gasCellCapacity: 5,
    maxGridCellCount: 4,
    requireLaneIdentity: false
  });
  const encode = () => lane.encode(device.createCommandEncoder(), {
    source,
    gridDims: [1, 2, 2],
    boxDimsM: [1, 1, 1]
  });
  const first = encode();
  const second = encode();
  assert.equal(first.ready, true);
  assert.equal(second.ready, true);
  assert.notEqual(first.gasPressureCellsBuffer, second.gasPressureCellsBuffer);
  assert.equal(lane.liveGenerationCount(), 2);
  assert.equal(lane.liveBatchCount(), 2);
  assert.equal(encode().blocker, 'sph-spatial-gas-cell-eos-batch-slot-capacity-exhausted');

  const consumer = first.addConsumerLease({ consumerStage: 'pressureInterface' });
  first.markSubmitted();
  first.retire();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(lane.liveGenerationCount(), 2);
  first.releaseConsumerLease(consumer);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(lane.liveGenerationCount(), 1);
  assert.equal(lane.liveBatchCount(), 1);
  assert.equal(encode().ready, true);
});

test('reactive caller-owned batch reuses one output slot with distinct aligned params slices', async () => {
  const device = fakeDevice();
  const source = retainedProductSource(device, 8);
  const lane = createSphSpatialGasCellEosGpuLane(device, {
    sourceCapacity: 8,
    gasCellCapacity: 9,
    maxGridCellCount: 8,
    outputSlotCount: 4,
    requireLaneIdentity: false
  });
  assert.equal(lane.outputSlotCount, 2);
  assert.equal(lane.batchSlotCount, 2);
  assert.equal(lane.paramsSlotCount, 4);
  assert.equal(lane.paramsByteStride, 256);
  const encoder = device.createCommandEncoder();
  const results = [];
  const consumerLeases = [];
  for (let substepIndex = 0; substepIndex < 4; substepIndex += 1) {
    const result = lane.encode(encoder, {
      source: {
        ...source,
        sourceEpoch: 100 + substepIndex,
        sourceGeneration: 200 + substepIndex
      },
      gridDims: [2, 2, 2],
      boxDimsM: [1, 1, 1],
      timestampMetadata: { substepIndex }
    });
    results.push(result);
    consumerLeases.push(result.addConsumerLease({ consumerStage: 'pressureInterface' }));
  }
  assert.ok(results.every((result) => result.ready));
  assert.deepEqual(results.map((result) => result.sourceEpoch), [100, 101, 102, 103]);
  assert.deepEqual(results.map((result) => result.sourceGeneration), [200, 201, 202, 203]);
  assert.deepEqual(results.map((result) => result.batchSlotReused), [false, true, true, true]);
  assert.deepEqual(results.map((result) => result.paramsSlotIndex), [0, 1, 2, 3]);
  assert.deepEqual(results.map((result) => result.paramsByteOffset), [0, 256, 512, 768]);
  assert.equal(new Set(results.map((result) => result.gasPressureCellsBuffer)).size, 1);
  assert.equal(new Set(results.map((result) => result.gasPressureCellMetadataBuffer)).size, 1);
  assert.deepEqual(
    device.bindGroups
      .filter((entry) => entry.label.includes('direct-group-bind'))
      .map((entry) => entry.entries.find((binding) => binding.binding === 7).resource)
      .map(({ offset, size }) => [offset, size]),
    [[0, 128], [256, 128], [512, 128], [768, 128]]
  );
  assert.equal(lane.liveGenerationCount(), 4);
  assert.equal(lane.liveBatchCount(), 1);
  const blocked = lane.encode(encoder, {
    source,
    gridDims: [2, 2, 2],
    boxDimsM: [1, 1, 1]
  });
  assert.equal(blocked.ready, false);
  assert.equal(blocked.blocker, 'sph-spatial-gas-cell-eos-params-slot-capacity-exhausted');

  for (const result of results) {
    result.markSubmitted();
    result.retire({ reason: 'manufactured-sequence-end' });
  }
  for (let index = 0; index < consumerLeases.length - 1; index += 1) {
    results[index].releaseConsumerLease(consumerLeases[index]);
  }
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(lane.liveBatchCount(), 1);
  assert.equal(results.at(-1).publicationStatus, 'active-batch-final-generation');
  results.at(-1).releaseConsumerLease(consumerLeases.at(-1));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(lane.liveGenerationCount(), 0);
  assert.equal(lane.liveBatchCount(), 0);
  assert.equal(results.at(-1).publicationStatus, 'retired-after-submit-fence');
});

test('two multi-substep batches remain bounded and a third batch is admitted only after one retires', async () => {
  const device = fakeDevice();
  const source = retainedProductSource(device, 8);
  const lane = createSphSpatialGasCellEosGpuLane(device, {
    sourceCapacity: 8,
    gasCellCapacity: 9,
    maxGridCellCount: 8,
    paramsSlotCount: 2,
    requireLaneIdentity: false
  });
  const encodeBatch = (encoder, epochBase) => {
    const results = [];
    const leases = [];
    for (let substepIndex = 0; substepIndex < 2; substepIndex += 1) {
      const result = lane.encode(encoder, {
        source: {
          ...source,
          sourceEpoch: epochBase + substepIndex,
          sourceGeneration: epochBase + 100 + substepIndex
        },
        gridDims: [2, 2, 2],
        boxDimsM: [1, 1, 1]
      });
      results.push(result);
      leases.push(result.addConsumerLease({ consumerStage: 'pressureInterface' }));
    }
    return { results, leases };
  };
  const first = encodeBatch(device.createCommandEncoder(), 10);
  const second = encodeBatch(device.createCommandEncoder(), 20);
  assert.deepEqual(first.results.map((result) => result.bindGroupCreationCount), [5, 5]);
  assert.deepEqual(first.results.map((result) => result.bindGroupReuseCount), [0, 0]);
  assert.equal(lane.liveBatchCount(), 2);
  assert.equal(new Set(first.results.map((result) => result.gasPressureCellsBuffer)).size, 1);
  assert.equal(new Set(second.results.map((result) => result.gasPressureCellsBuffer)).size, 1);
  assert.notEqual(first.results[0].gasPressureCellsBuffer, second.results[0].gasPressureCellsBuffer);
  const blocked = lane.encode(device.createCommandEncoder(), {
    source,
    gridDims: [2, 2, 2],
    boxDimsM: [1, 1, 1]
  });
  assert.equal(blocked.blocker, 'sph-spatial-gas-cell-eos-batch-slot-capacity-exhausted');

  for (const batch of [first, second]) {
    for (const result of batch.results) {
      result.markSubmitted();
      result.retire({ reason: 'multi-batch-test-submit' });
    }
  }
  for (let index = 0; index < first.results.length; index += 1) {
    first.results[index].releaseConsumerLease(first.leases[index]);
  }
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(lane.liveBatchCount(), 1);
  const third = lane.encode(device.createCommandEncoder(), {
    source,
    gridDims: [2, 2, 2],
    boxDimsM: [1, 1, 1]
  });
  assert.equal(third.ready, true);
  assert.equal(third.batchSlotIndex, first.results[0].batchSlotIndex);
  assert.equal(third.bindGroupCreationCount, 0);
  assert.equal(third.bindGroupReuseCount, 5);
  assert.equal(third.bindGroupCacheEntryCount, 10);
  third.cancelBeforeSubmit({ reason: 'third-batch-test-complete' });
  for (let index = 0; index < second.results.length; index += 1) {
    second.results[index].releaseConsumerLease(second.leases[index]);
  }
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(lane.liveBatchCount(), 0);
});

test('cached runner submits and fences on the same device without per-step lane allocation', async () => {
  const device = fakeDevice();
  const source = retainedProductSource(device, 4);
  const cachedLane = getOrCreateSphSpatialGasCellEosGpuLane(device, {
    sourceCapacity: 4,
    gasCellCapacity: 5,
    maxGridCellCount: 4,
    laneId: 'ulg:sph:resident',
    stateKey: 'ulg:sph:state',
    sourceFamily: 'sph-particle-state'
  });
  assert.equal(getOrCreateSphSpatialGasCellEosGpuLane(device, {
    sourceCapacity: 4,
    gasCellCapacity: 5,
    maxGridCellCount: 4,
    laneId: 'ulg:sph:resident',
    stateKey: 'ulg:sph:state',
    sourceFamily: 'sph-particle-state'
  }), cachedLane);
  const result = await runSphSpatialGasCellEosGpu({
    device,
    source,
    sourceCapacity: 4,
    gasCellCapacity: 5,
    maxGridCellCount: 4,
    gridDims: [1, 2, 2],
    boxDimsM: [1, 1, 1],
    gpuResidentLaneLeaseIdentity: leaseIdentity(),
    awaitQueueFence: true
  });
  assert.equal(result.ready, true);
  assert.equal(result.queueCompletionStatus, 'queue-work-completed');
  assert.equal(result.queueCompletionMethod, 'queue.onSubmittedWorkDone');
  assert.equal(device.submissions.length, 1);
  assert.equal(result.fullReadbackPerformed, false);
  assert.equal(result.mapAsyncCalled, false);
  assert.equal(result.residentGasCellEosLane, cachedLane);
  assert.equal(result.residentGasCellEosLaneCacheStatus, 'gpu-gas-cell-eos-lane-cache-hit');
  assert.equal(result.residentGasCellEosLaneCapacityClass.requestedSourceCapacity, 4);
  const laterCompatibleRequest = getOrCreateSphSpatialGasCellEosGpuLane(device, {
    sourceCapacity: 8,
    gasCellCapacity: 5,
    maxGridCellCount: 4,
    laneId: 'ulg:sph:resident',
    stateKey: 'ulg:sph:state',
    sourceFamily: 'sph-particle-state'
  });
  assert.equal(laterCompatibleRequest, cachedLane);
  assert.equal(laterCompatibleRequest.cacheRequest.requestedSourceCapacity, 8);
  assert.equal(result.residentGasCellEosLaneCapacityClass.requestedSourceCapacity, 4);
});

test('cached lane and pipelines are reused when active source row counts change within one capacity', async () => {
  const device = fakeDevice();
  const firstSource = retainedProductSource(device, 4);
  const secondSource = retainedProductSource(device, 2);
  const options = {
    device,
    sourceCapacity: 8,
    gasCellCapacity: 9,
    maxGridCellCount: 8,
    gridDims: [2, 2, 2],
    boxDimsM: [1, 1, 1],
    requireLaneIdentity: false,
    awaitQueueFence: true
  };
  const first = await runSphSpatialGasCellEosGpu({ ...options, source: firstSource });
  const lane = first.residentGasCellEosLane;
  const pipelineCount = device.pipelines.length;
  assert.equal(first.sourceRowCount, 4);
  first.retire({ reason: 'advance-to-next-active-count' });
  await new Promise((resolve) => setImmediate(resolve));

  const second = await runSphSpatialGasCellEosGpu({ ...options, source: secondSource });
  assert.equal(second.sourceRowCount, 2);
  assert.equal(second.residentGasCellEosLane, lane);
  assert.equal(second.residentGasCellEosLaneCacheStatus, 'gpu-gas-cell-eos-lane-cache-hit');
  assert.equal(device.pipelines.length, pipelineCount);
});

test('cached lanes reuse compatible geometric source, output, and grid capacity classes', () => {
  const device = fakeDevice();
  const first = getOrCreateSphSpatialGasCellEosGpuLane(device, {
    sourceCapacity: 5_270,
    gasCellCapacity: 513,
    maxGridCellCount: 512,
    requireLaneIdentity: false
  });
  const second = getOrCreateSphSpatialGasCellEosGpuLane(device, {
    sourceCapacity: 10_710,
    gasCellCapacity: 513,
    maxGridCellCount: 512,
    requireLaneIdentity: false
  });
  const third = getOrCreateSphSpatialGasCellEosGpuLane(device, {
    sourceCapacity: 32_640,
    gasCellCapacity: 513,
    maxGridCellCount: 512,
    requireLaneIdentity: false
  });
  assert.equal(second, first);
  assert.equal(third, first);
  assert.equal(first.sourceCapacityClass, 65_536);
  assert.equal(first.gasCellCapacityClass, 1_024);
  assert.equal(first.maxGridCellCountClass, 512);
  assert.equal(third.cacheStatus, 'gpu-gas-cell-eos-lane-cache-hit');
  assert.equal(third.cacheRequest.compatibleCapacityClassReused, true);
  assert.equal(sphGasCellEosGeometricCapacityClass(10_710), 16_384);
});

test('cached lanes key resolved maxComputeWorkgroupsPerDimension without aliasing', () => {
  const device = fakeDevice();
  const common = {
    sourceCapacity: 4,
    gasCellCapacity: 5,
    maxGridCellCount: 4,
    requireLaneIdentity: false
  };
  const limit1024 = getOrCreateSphSpatialGasCellEosGpuLane(device, {
    ...common,
    maxComputeWorkgroupsPerDimension: 1_024
  });
  const limit2048 = getOrCreateSphSpatialGasCellEosGpuLane(device, {
    ...common,
    maxComputeWorkgroupsPerDimension: 2_048
  });
  const limit1024Again = getOrCreateSphSpatialGasCellEosGpuLane(device, {
    ...common,
    maxComputeWorkgroupsPerDimension: 1_024
  });
  const implicitDeviceLimit = getOrCreateSphSpatialGasCellEosGpuLane(device, common);
  const explicitDeviceLimit = getOrCreateSphSpatialGasCellEosGpuLane(device, {
    ...common,
    maxComputeWorkgroupsPerDimension: device.limits.maxComputeWorkgroupsPerDimension
  });

  assert.notEqual(limit2048, limit1024);
  assert.equal(limit1024Again, limit1024);
  assert.equal(explicitDeviceLimit, implicitDeviceLimit);
  assert.equal(limit1024.maxComputeWorkgroupsPerDimension, 1_024);
  assert.equal(limit2048.maxComputeWorkgroupsPerDimension, 2_048);
  assert.equal(
    implicitDeviceLimit.maxComputeWorkgroupsPerDimension,
    device.limits.maxComputeWorkgroupsPerDimension
  );
});

test('mounted active-prefix thresholds reuse one strict physical lane and both bind-group slots', () => {
  const device = fakeDevice();
  const upperBounds = [2_550, 5_270, 7_990, 10_710];
  const template = exactArenaProductSource(device, {
    rowCountUpperBound: upperBounds.at(-1),
    capacityRows: 10_880,
    generationId: 70
  });
  const sources = upperBounds.map((rowCount, index) =>
    sharedExactArenaProductSource(device, template, rowCount, 70 + index));
  const laneIdentity = leaseIdentity({
    leaseId: 'compute-manager-mounted-threshold-lease',
    laneId: 'ulg:sph:mounted-threshold-lane',
    stateKey: 'ulg:sph:mounted-threshold-state',
    sourceFamily: 'sph-particle-state'
  });
  const lanes = upperBounds.map((sourceCapacity) => {
    const capacityPlan = createSphSpatialGasCellEosGpuLaneCapacityPlan({
      sourceCapacity,
      maxGridCellCount: 15_625
    });
    return getOrCreateSphSpatialGasCellEosGpuLane(device, {
      sourceCapacity: capacityPlan.sourceCapacityClass,
      gasCellCapacity: capacityPlan.gasCellCapacity,
      maxGridCellCount: capacityPlan.rawMaxGridCellCount,
      paramsSlotCount: 16,
      laneId: laneIdentity.laneId,
      stateKey: laneIdentity.stateKey,
      sourceFamily: laneIdentity.sourceFamily
    });
  });
  assert.ok(lanes.every((lane) => lane === lanes[0]));
  const lane = lanes[0];
  assert.equal(lane.stateKey, laneIdentity.stateKey);
  assert.equal(lane.sourceCapacity, 65_536);
  assert.equal(lane.gasCellCapacity, 16_384);
  assert.equal(lane.maxGridCellCount, 16_384);
  assert.equal(lane.paramsSlotCount, 16);

  const encode = (index) => lane.encode(device.createCommandEncoder(), {
    source: sources[index],
    gpuResidentLaneLeaseIdentity: laneIdentity,
    gridDims: [25, 25, 25],
    boxDimsM: [1, 1, 1]
  });
  const first = encode(0);
  const second = encode(1);
  assert.equal(first.ready, true);
  assert.equal(second.ready, true);
  assert.notEqual(first.batchSlotIndex, second.batchSlotIndex);
  assert.equal(first.bindGroupCreationCount, 6);
  assert.equal(second.bindGroupCreationCount, 6);
  second.cancelBeforeSubmit({ reason: 'release-mounted-threshold-slot-one' });

  const third = encode(2);
  assert.equal(third.ready, true);
  assert.equal(third.batchSlotIndex, second.batchSlotIndex);
  assert.equal(third.bindGroupCreationCount, 0);
  assert.equal(third.bindGroupReuseCount, 6);
  first.cancelBeforeSubmit({ reason: 'release-mounted-threshold-slot-zero' });

  const fourth = encode(3);
  assert.equal(fourth.ready, true);
  assert.equal(fourth.batchSlotIndex, first.batchSlotIndex);
  assert.equal(fourth.bindGroupCreationCount, 0);
  assert.equal(fourth.bindGroupReuseCount, 6);
  assert.deepEqual(
    [first, second, third, fourth].map((result) => result.sourceRowCount),
    upperBounds
  );
  assert.ok([first, second, third, fourth].every((result) => result.exactPrefix === true));
  assert.ok([first, second, third, fourth].every((result) => result.sourceCapacity === 65_536));
  assert.ok([first, second, third, fourth].every(
    (result) => result.pressureInterfaceGasPressureCellRowCapacity === 16_384
  ));
  assert.equal(third.laneBindGroupCreationCount, 6);
  assert.equal(third.laneBindGroupReuseCount, 6);
  assert.equal(fourth.laneBindGroupCreationCount, 6);
  assert.equal(fourth.laneBindGroupReuseCount, 6);
  third.cancelBeforeSubmit({ reason: 'mounted-threshold-test-complete' });
  fourth.cancelBeforeSubmit({ reason: 'mounted-threshold-test-complete' });
});

test('advertised source lease rejection fails closed without falling back to a borrow counter', async () => {
  const device = fakeDevice();
  const source = retainedProductSource(device, 4);
  let releaseCount = 0;
  source.sourceHandle = {
    addConsumerLease() {
      return { accepted: false, leaseId: null, reason: 'source-generation-retiring' };
    },
    releaseConsumerLease() {
      releaseCount += 1;
    }
  };
  const lane = createSphSpatialGasCellEosGpuLane(device, {
    sourceCapacity: 4,
    gasCellCapacity: 5,
    maxGridCellCount: 4,
    requireLaneIdentity: false
  });
  const result = await runSphSpatialGasCellEosGpu({
    device,
    lane,
    source,
    gridDims: [1, 2, 2],
    boxDimsM: [1, 1, 1],
    requireLaneIdentity: false
  });
  assert.equal(result.ready, false);
  assert.equal(result.blocker, 'source-generation-retiring');
  assert.equal(result.sourceBorrowProtocol, 'explicit-consumer-lease');
  assert.equal(releaseCount, 0);
  assert.equal(lane.liveGenerationCount(), 0);
});

test('caller-owned pre-submit abort releases source and output generation exactly once', async () => {
  const device = fakeDevice();
  const source = retainedProductSource(device, 4);
  let releaseCount = 0;
  source.sourceHandle = {
    addConsumerLease() {
      return { accepted: true, leaseId: 'source-consumer-1' };
    },
    releaseConsumerLease(leaseId) {
      assert.equal(leaseId, 'source-consumer-1');
      releaseCount += 1;
      return true;
    }
  };
  const lane = createSphSpatialGasCellEosGpuLane(device, {
    sourceCapacity: 4,
    gasCellCapacity: 5,
    maxGridCellCount: 4,
    requireLaneIdentity: false
  });
  const result = await runSphSpatialGasCellEosGpu({
    device,
    lane,
    commandEncoder: device.createCommandEncoder(),
    source,
    gridDims: [1, 2, 2],
    boxDimsM: [1, 1, 1],
    requireLaneIdentity: false
  });
  assert.equal(result.ready, true);
  assert.equal(lane.liveGenerationCount(), 1);
  const outputConsumerLease = result.addConsumerLease({ consumerStage: 'pressureInterface' });
  assert.equal(result.cancelBeforeSubmit({ reason: 'downstream-pressure-stage-failed' }), true);
  assert.equal(result.abort({ reason: 'duplicate-abort' }), false);
  assert.equal(result.markSubmitted(), false);
  assert.equal(releaseCount, 1);
  assert.equal(lane.liveGenerationCount(), 1);
  const rejectedLease = result.addConsumerLease({ consumerStage: 'stale-pressure-consumer' });
  assert.equal(rejectedLease.accepted, false);
  assert.equal(rejectedLease.leaseId, null);
  assert.equal(result.releaseConsumerLease(outputConsumerLease), true);
  assert.equal(lane.liveGenerationCount(), 0);
  assert.equal(result.queueCompletionStatus, 'cancelled-before-submit');
});

test('WGSL keeps EOS aggregation parallel and GPU metadata guarded', () => {
  assert.match(sphSpatialGasCellEosGpuWgsl, /@compute @workgroup_size\(64\)[\s\S]*fn reduce_cells/);
  assert.match(sphSpatialGasCellEosGpuWgsl, /sorted_position = sorted_position \+ 64u/);
  assert.match(sphSpatialGasCellEosGpuWgsl, /sum_temperature_moles\[0\] \* reduce_params\.gas_constant_j_per_mol_k/);
  assert.match(sphSpatialGasCellEosGpuWgsl, /gas_cell_lookup\[cell_key\] = unique_index \+ 1u/);
  assert.match(sphSpatialGasCellEosGpuWgsl, /META_ADMITTED_ACTIVE_COUNT/);
  assert.match(sphSpatialGasCellEosGpuWgsl, /META_OVERFLOW_COUNT/);
  assert.match(sphSpatialGasCellEosGpuWgsl, /occupied == live_count/);
  assert.match(sphSpatialGasCellEosGpuWgsl, /exact_authority_capacity/);
  assert.match(sphSpatialGasCellEosGpuWgsl, /exact_authority_generation/);
  assert.match(sphSpatialGasCellEosGpuWgsl, /exact_authority_stride/);
  assert.match(sphSpatialGasCellEosGpuWgsl, /\(\*authority\)\[6u\] == 0u/);
  assert.match(sphSpatialGasCellEosGpuWgsl, /exact_gated_dispatch\[0\] = select\(0u, 1u/);
  assert.match(sphSpatialGasCellEosGpuWgsl, /fn exact_stable_digit_a_to_b/);
  assert.match(sphSpatialGasCellEosGpuWgsl, /position = position \+ 1u/);
  assert.doesNotMatch(sphSpatialGasCellEosGpuWgsl, /mapAsync|queue\.writeBuffer|cpu/i);
});
