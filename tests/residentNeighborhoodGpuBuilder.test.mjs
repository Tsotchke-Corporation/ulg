import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RESIDENT_NEIGHBORHOOD_BUILDER_PARAM_U32_LAYOUT,
  RESIDENT_NEIGHBORHOOD_CELL_CSR_HEADER_U32_LAYOUT,
  RESIDENT_NEIGHBORHOOD_CHART_FLAG,
  RESIDENT_NEIGHBORHOOD_CHART_LEVEL_U32_LAYOUT,
  ULG_RESIDENT_NEIGHBORHOOD_DENSE_UNIFORM_CHART_SCHEMA,
  ULG_RESIDENT_NEIGHBORHOOD_GPU_BUILDER_SCHEMA,
  residentNeighborhoodBuilderWgsl
} from '../ulg-gpu-abi/src/index.js';
import {
  RESIDENT_NEIGHBORHOOD_BUILD_STRATEGY,
  RESIDENT_NEIGHBORHOOD_CONSUMER,
  RESIDENT_NEIGHBORHOOD_CANDIDATE_TOPOLOGY_FLAG,
  RESIDENT_NEIGHBORHOOD_SUPPORT_FLAG
} from '../ulg-gpu-abi/src/residentNeighborhood.js';
import { createResidentNeighborhoodDescriptor } from '../src/runtime/sph/residentNeighborhoodGpu.js';
import {
  createResidentNeighborhoodGpuBuilder,
  normalizeResidentNeighborhoodDenseUniformChart,
  planResidentNeighborhoodGpuBuilderStrategy,
  RESIDENT_NEIGHBORHOOD_GPU_TIMESTAMP_STAGE,
  planResidentNeighborhoodGpuBuilderAllocations
} from '../src/runtime/sph/residentNeighborhoodGpuBuilder.js';

const GPU_STORAGE_COPY = 128 | 8 | 4;

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
      maxBufferSize: 1 << 28,
      maxStorageBufferBindingSize: 1 << 28,
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
    copyBufferToBuffer(source, sourceOffset, destination, destinationOffset, size) {
      events.push({
        kind: 'copy',
        source: source.label,
        sourceOffset,
        destination: destination.label,
        destinationOffset,
        size
      });
    },
    beginComputePass(descriptor = {}) {
      const event = {
        kind: 'pass',
        descriptor,
        pipeline: null,
        bindGroup: null,
        dispatch: null,
        commands: []
      };
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
        dispatchWorkgroupsIndirect(buffer, offset) {
          event.dispatchIndirect = { buffer: buffer.label, offset };
          event.commands.push({ pipeline, bindGroup, dispatchIndirect: event.dispatchIndirect });
        },
        end() { event.ended = true; }
      };
    }
  };
}

const supportClasses = [
  {
    supportClassId: 5,
    consumerMask: RESIDENT_NEIGHBORHOOD_CONSUMER.MECHANICS,
    minLevelDelta: 0,
    maxLevelDelta: 0,
    cellRadius: 2,
    maxCandidatesPerSource: 8,
    flags: RESIDENT_NEIGHBORHOOD_SUPPORT_FLAG.EXACT_NEAR_REQUIRED
      | RESIDENT_NEIGHBORHOOD_SUPPORT_FLAG.INCLUDE_SOURCE_CELL
      | RESIDENT_NEIGHBORHOOD_SUPPORT_FLAG.EXCLUDE_SELF
  }
];

const sourceSupportAssignments = Array.from({ length: 4 }, () => ({ mechanics: 5 }));

function readyDescriptor(overrides = {}) {
  return createResidentNeighborhoodDescriptor({
    generation: 17,
    leaseId: 'neighbor-build-lease-17',
    laneId: 'compute-manager-lane-0',
    stateKey: 'simulation/hot-state/17',
    leaseTokenLow: 0x1234_5678,
    leaseTokenHigh: 0x9abc_def0,
    supportClasses,
    sourceSupportAssignments,
    positionEpoch: 31,
    skinDistanceM: 0.2,
    maxDisplacementM: 0.05,
    sourceCount: 4,
    requiredUniqueCellCount: 4,
    requiredCellMemberCount: 4,
    requiredCandidateCount: 16,
    capacities: {
      uniqueCellCount: 4,
      cellOffsetCount: 5,
      cellMemberCount: 4,
      sourceOffsetCount: 5,
      sourceSupportAssignmentCount: 4,
      candidateCount: 32
    },
    ...overrides
  });
}

function createInputBuffers(device, descriptor) {
  const sourceCount = descriptor.capacityEvidence.sourceCount;
  const supportClassCount = descriptor.supportClasses.length;
  return {
    positionBuffer: device.createBuffer({
      label: 'retained-positions',
      size: Math.max(4, sourceCount * 4 * 4),
      usage: GPU_STORAGE_COPY
    }),
    chartLevelBuffer: device.createBuffer({
      label: 'chart-level-rows',
      size: Math.max(4, sourceCount * RESIDENT_NEIGHBORHOOD_CHART_LEVEL_U32_LAYOUT.length * 4),
      usage: GPU_STORAGE_COPY
    }),
    supportClassBuffer: device.createBuffer({
      label: 'support-class-rows',
      size: Math.max(4, supportClassCount * 8 * 4),
      usage: GPU_STORAGE_COPY
    }),
    sourceSupportAssignmentBuffer: device.createBuffer({
      label: 'source-support-assignment-rows',
      size: Math.max(4, sourceCount * 8 * 4),
      usage: GPU_STORAGE_COPY
    })
  };
}

test('builder ABI fixes chart rows, cell CSR, and a dense uniform parameter row', () => {
  assert.equal(ULG_RESIDENT_NEIGHBORHOOD_GPU_BUILDER_SCHEMA.endsWith('.v0'), true);
  assert.equal(RESIDENT_NEIGHBORHOOD_CHART_LEVEL_U32_LAYOUT.length, 8);
  assert.equal(RESIDENT_NEIGHBORHOOD_CELL_CSR_HEADER_U32_LAYOUT.length, 16);
  assert.equal(RESIDENT_NEIGHBORHOOD_BUILDER_PARAM_U32_LAYOUT.length, 64);
  assert.equal(ULG_RESIDENT_NEIGHBORHOOD_DENSE_UNIFORM_CHART_SCHEMA.endsWith('.v0'), true);
  assert.equal(RESIDENT_NEIGHBORHOOD_BUILD_STRATEGY.DENSE_UNIFORM_CHART, 'dense-grid');
  assert.equal(RESIDENT_NEIGHBORHOOD_CHART_FLAG.VALID, 1);
  assert.equal(RESIDENT_NEIGHBORHOOD_CHART_FLAG.DYADIC_LEVELS, 2);
  assert.equal(
    RESIDENT_NEIGHBORHOOD_CANDIDATE_TOPOLOGY_FLAG.FIXED_SOURCE_SEGMENTS
      | RESIDENT_NEIGHBORHOOD_CANDIDATE_TOPOLOGY_FLAG.ZERO_MASK_ROWS_INACTIVE,
    3
  );
});

test('small-source strategy planner selects direct pairs from static command topology only', () => {
  const mounted = planResidentNeighborhoodGpuBuilderStrategy({ sourceCount: 171 });
  const large = planResidentNeighborhoodGpuBuilderStrategy({ sourceCount: 300 });
  const productionLarge = planResidentNeighborhoodGpuBuilderStrategy({ sourceCount: 300_000 });
  assert.equal(mounted.strategy, 'direct');
  assert.equal(mounted.directDispatchCount, 4);
  assert.equal(mounted.radixDispatchCount, 131);
  assert.equal(mounted.directPairEvaluationCount, 58_482);
  assert.ok(mounted.directWorkEstimate < mounted.radixWorkEstimate);
  assert.equal(large.strategy, 'radix');
  assert.ok(large.directWorkEstimate > large.radixWorkEstimate);
  assert.equal(productionLarge.radixSortDispatchCount, 161);
  assert.equal(productionLarge.radixUniqueDispatchCount, 7);
  assert.equal(productionLarge.candidateScanDispatchCount, 4);
  assert.equal(productionLarge.radixDispatchCount, 177);
  assert.equal(mounted.materialPairSpecific, false);
  assert.equal(mounted.scenarioSpecific, false);
  assert.equal(
    planResidentNeighborhoodGpuBuilderStrategy({
      sourceCount: 300,
      requestedStrategy: 'direct'
    }).selectionAuthority,
    'validation-only-forced-strategy'
  );
});

test('retained radix controls move aligned params arenas out of generation-local accounting', () => {
  const retained = planResidentNeighborhoodGpuBuilderAllocations({
    sourceCount: 300_000,
    supportClassCount: 1,
    candidateCapacity: 300_000,
    generationCount: 2,
    retainConstantScanParamsBuffers: true,
    retainedParamsSlotCount: 8,
    retainedGenerationSlotCount: 8,
    minUniformBufferOffsetAlignment: 512,
    minStorageBufferOffsetAlignment: 256
  });
  const transient = planResidentNeighborhoodGpuBuilderAllocations({
    sourceCount: 300_000,
    supportClassCount: 1,
    candidateCapacity: 300_000,
    generationCount: 2,
    retainConstantScanParamsBuffers: false,
    minUniformBufferOffsetAlignment: 512
  });
  assert.equal(retained.paramsOffsetAlignment, 512);
  assert.equal(retained.retainedParamsSlotCount, 8);
  assert.equal(retained.retainedRadixParamsArenaByteLength, 8 * 40 * 512);
  assert.equal(retained.retainedUniqueParamsArenaByteLength, 8 * 512);
  assert.equal(retained.retainedGenerationSlotCount, 8);
  assert.equal(retained.generationControlSlotStrideByteLength, 1024);
  assert.equal(retained.retainedGenerationControlArenaByteLength, 8 * 1024);
  assert.equal(retained.transientGenerationControlByteLength, 0);
  assert.equal(retained.primitiveTransientPerGenerationByteLength, 0);
  assert.equal(transient.retainedRadixParamsArenaByteLength, 0);
  assert.equal(transient.retainedUniqueParamsArenaByteLength, 0);
  assert.ok(transient.primitiveTransientPerGenerationByteLength > 40 * 256);
});

test('bounded uniform chart selects one-word stable radix after the small direct regime', () => {
  const denseUniformChart = normalizeResidentNeighborhoodDenseUniformChart({
    chartId: 7,
    level: 0,
    cellSizeM: 0.5,
    originM: [-8, -8, -8],
    minCell: [0, 0, 0],
    dimensions: [100, 100, 30]
  }, {
    sourceCount: 300_000,
    maxCellRadius: 2,
    supportClasses
  });
  const plan = planResidentNeighborhoodGpuBuilderStrategy({
    sourceCount: 300_000,
    denseUniformChart
  });
  assert.equal(denseUniformChart.admitted, true);
  assert.equal(denseUniformChart.gridCellCount, 300_000);
  assert.equal(plan.strategy, 'dense-grid');
  assert.equal(plan.denseGridRadixSortDispatchCount, 33);
  assert.equal(plan.denseGridUniqueDispatchCount, 7);
  assert.equal(plan.denseGridDispatchCount, 49);
  assert.ok(plan.denseGridDispatchCount < plan.radixDispatchCount / 3);
  assert.equal(plan.selectionAuthority, 'bounded-uniform-chart-and-static-command-topology');

  const unbounded = normalizeResidentNeighborhoodDenseUniformChart({
    chartId: 0,
    level: 0,
    cellSizeM: 1,
    originM: [0, 0, 0],
    minCell: [0, 0, 0],
    dimensions: [301, 1, 1]
  }, { sourceCount: 300, supportClasses });
  assert.equal(unbounded.admitted, false);
  assert.equal(unbounded.admissionReason, 'grid-cell-count-exceeds-source-count');
  assert.equal(planResidentNeighborhoodGpuBuilderStrategy({
    sourceCount: 300,
    denseUniformChart: unbounded
  }).strategy, 'radix');
});

test('WGSL emits exact five-word structural keys and evaluates pair distance only while counting', () => {
  assert.match(residentNeighborhoodBuilderWgsl, /fn emit_occupancy_keys/);
  assert.match(residentNeighborhoodBuilderWgsl, /occupancy_keys\[key_base \+ 0u\] = chart_id/);
  assert.match(residentNeighborhoodBuilderWgsl, /occupancy_keys\[key_base \+ 4u\] = signed_order_key\(cell\.z\)/);
  assert.match(residentNeighborhoodBuilderWgsl, /unique_evidence\[5\] == 5u/);
  assert.match(residentNeighborhoodBuilderWgsl, /fn emit_dense_uniform_chart_keys/);
  assert.match(residentNeighborhoodBuilderWgsl, /occupancy_keys\[key_base\] = linear_cell/);
  assert.match(residentNeighborhoodBuilderWgsl, /fn assemble_dense_uniform_chart_cell_csr/);
  assert.match(residentNeighborhoodBuilderWgsl, /unique_evidence\[5\] == 1u/);
  assert.match(residentNeighborhoodBuilderWgsl, /fn count_candidates/);
  assert.match(residentNeighborhoodBuilderWgsl, /fn finalize_admission/);
  assert.match(residentNeighborhoodBuilderWgsl, /fn fill_candidates/);
  assert.equal(
    [...residentNeighborhoodBuilderWgsl.matchAll(/dot\(displacement, displacement\)/g)].length,
    1
  );
  const fillSource = residentNeighborhoodBuilderWgsl.slice(
    residentNeighborhoodBuilderWgsl.indexOf('fn fill_candidates(\n')
  );
  assert.doesNotMatch(fillSource, /distance|position_for|matched_consumer_mask/);
  assert.match(fillSource, /candidate_scratch\[scratch_row \+ 2u\]/);
  assert.match(fillSource, /candidate_scratch\[scratch_row \+ 3u\]/);
  assert.doesNotMatch(residentNeighborhoodBuilderWgsl, /atomicAdd\([^\n]*candidate/i);
});

test('dense uniform chart records one-word stable sort and canonical cell CSR assembly', () => {
  const device = createFakeDevice();
  const encoder = createFakeEncoder();
  const descriptor = readyDescriptor();
  const denseUniformChart = normalizeResidentNeighborhoodDenseUniformChart({
    chartId: 0,
    level: 0,
    cellSizeM: 1,
    originM: [0, 0, 0],
    minCell: [0, 0, 0],
    dimensions: [4, 1, 1]
  }, { sourceCount: 4, supportClasses });
  const builder = createResidentNeighborhoodGpuBuilder(device, {
    maxSourceCount: 4,
    maxSupportClassCount: 8,
    buildStrategy: 'dense-grid',
    label: 'neighbor-dense-grid'
  });
  const result = builder.encode(encoder, {
    descriptor,
    ...createInputBuffers(device, descriptor),
    denseUniformChart
  });
  const commands = encoder.events
    .filter((event) => event.kind === 'pass')
    .flatMap((event) => event.commands);
  assert.equal(result.strategyPlan.strategy, 'dense-grid');
  assert.equal(result.denseUniformChart.schema, ULG_RESIDENT_NEIGHBORHOOD_DENSE_UNIFORM_CHART_SCHEMA);
  assert.equal(result.radixEncoding.structuralKeyWordCount, 1);
  assert.equal(result.radixEncoding.canonicalCellStructuralKeyWordCount, 5);
  assert.equal(result.radixEncoding.deterministicMemberOrder, 'stable-source-index');
  assert.equal(result.encodingTelemetry.strategy, 'dense-grid');
  assert.equal(
    result.encodingTelemetry.encodedDispatchCount,
    result.strategyPlan.denseGridDispatchCount
  );
  assert.ok(commands.some(
    (command) => command.pipeline === 'neighbor-dense-grid-emit-dense-uniform-chart-keys'
  ));
  assert.ok(commands.some(
    (command) => command.pipeline
      === 'neighbor-dense-grid-assemble-dense-uniform-chart-cell-csr'
  ));
  assert.equal(commands.filter(
    (command) => command.pipeline.includes('-cell-radix-unique-histogram-')
  ).length, 8);
  assert.equal(result.queueSubmitPerformed, false);
  assert.equal(result.mapPerformed, false);
  assert.equal(result.readbackPerformed, false);
  builder.release(result);
  builder.destroy();
});

test('caller-owned orchestration records occupancy, radix/unique, count/scan, admission, then fill', () => {
  const device = createFakeDevice();
  const encoder = createFakeEncoder();
  const descriptor = readyDescriptor();
  const inputs = createInputBuffers(device, descriptor);
  const builder = createResidentNeighborhoodGpuBuilder(device, {
    maxSourceCount: 32,
    maxSupportClassCount: 8,
    label: 'neighbor-test'
  });
  const result = builder.encode(encoder, { descriptor, ...inputs });

  assert.equal(result.status, 'resident-neighborhood-gpu-build-encoded-pending-gpu-admission');
  assert.equal(result.hostAdmission, true);
  assert.equal(result.encoded, true);
  assert.equal(result.queueSubmitPerformed, false);
  assert.equal(result.mapPerformed, false);
  assert.equal(result.readbackPerformed, false);
  assert.equal(result.schedulerCreated, false);
  assert.equal(result.resources.outputs.sourceCandidateCsr.singleStorageBinding, true);
  assert.equal(result.resources.outputs.sourceCandidateCsr.shaderStorageType, 'array<u32>');
  assert.equal(result.resources.outputs.capacityEvidence.fixedSize, true);
  assert.equal(
    result.resources.outputs.candidateDispatchIndirect.dispatchMode,
    'dispatchWorkgroupsIndirect'
  );
  assert.equal(result.resources.scratch.candidateStaging.distanceEvaluatedDuringCountOnly, true);
  assert.equal(result.resources.scratch.candidateStaging.rowCapacity, 32);
  assert.equal(result.resources.scratch.candidateStaging.rowStrideU32, 4);
  assert.equal(result.resources.outputs.cellCsr.regions.uniqueCellKeys.strideU32, 8);
  assert.equal(result.radixEncoding.structuralKeyWordCount, 5);
  assert.equal(result.radixEncoding.stable, true);
  assert.equal(result.encodingTelemetry.encodedComputePassCount, 5);

  const computePasses = encoder.events.filter((event) => event.kind === 'pass');
  assert.equal(computePasses.length, 5);
  const commands = computePasses
    .flatMap((event) => event.commands);
  const pipelineIndex = (label) => commands.findIndex((command) => command.pipeline === label);
  assert.ok(pipelineIndex('neighbor-test-emit-occupancy') >= 0);
  assert.ok(pipelineIndex('neighbor-test-cell-radix-unique-initialize')
    > pipelineIndex('neighbor-test-emit-occupancy'));
  assert.ok(pipelineIndex('neighbor-test-assemble-cell-csr')
    > pipelineIndex('neighbor-test-cell-radix-unique-finalize-unique'));
  assert.ok(pipelineIndex('neighbor-test-count-candidates')
    > pipelineIndex('neighbor-test-assemble-cell-csr'));
  assert.ok(pipelineIndex('neighbor-test-candidate-scan-blocks')
    > pipelineIndex('neighbor-test-count-candidates'));
  assert.ok(pipelineIndex('neighbor-test-finalize-admission')
    > pipelineIndex('neighbor-test-candidate-scan-blocks'));
  assert.ok(pipelineIndex('neighbor-test-fill-candidates')
    > pipelineIndex('neighbor-test-finalize-admission'));
  assert.deepEqual(
    commands.find((command) => command.pipeline === 'neighbor-test-fill-candidates').dispatchIndirect,
    { buffer: 'neighbor-test-candidate-dispatch-indirect', offset: 0 }
  );
  assert.ok(encoder.events.some((event) => event.kind === 'copy'
    && event.source === 'source-support-assignment-rows'
    && event.destination === 'neighbor-test-packed-source-candidate-csr'));
  assert.ok(encoder.events.some((event) => event.kind === 'copy'
    && event.destination === 'neighbor-test-cell-csr'));
  assert.ok(device.writes.length >= 5);

  const outputBuffer = result.retainedBuffers.packedCandidateCsrBuffer;
  builder.releaseTransientBuffers(result);
  assert.equal(inputs.positionBuffer.destroyed, false);
  assert.equal(builder.release(result), true);
  assert.equal(outputBuffer.destroyed, true);
  assert.equal(inputs.positionBuffer.destroyed, false);
  builder.destroy();
});

test('direct small-source builder groups four deterministic dispatches into two passes', () => {
  const device = createFakeDevice();
  const encoder = createFakeEncoder();
  const descriptor = readyDescriptor();
  const builder = createResidentNeighborhoodGpuBuilder(device, {
    maxSourceCount: 32,
    maxSupportClassCount: 8,
    buildStrategy: 'direct',
    label: 'neighbor-direct'
  });
  const result = builder.encode(encoder, {
    descriptor,
    ...createInputBuffers(device, descriptor)
  });
  const passes = encoder.events.filter((event) => event.kind === 'pass');
  const commands = passes.flatMap((event) => event.commands);
  assert.equal(result.strategyPlan.strategy, 'direct');
  assert.equal(result.encodingTelemetry.strategy, 'direct');
  assert.equal(result.encodingTelemetry.encodedDispatchCount, 4);
  assert.equal(result.encodingTelemetry.encodedComputePassCount, 2);
  assert.equal(result.encodingTelemetry.bindGroupCreationCount, 4);
  assert.equal(passes.length, 2);
  assert.deepEqual(commands.map((command) => command.pipeline), [
    'neighbor-direct-count-candidates-direct',
    'neighbor-direct-candidate-scan-blocks',
    'neighbor-direct-finalize-admission',
    'neighbor-direct-fill-candidates-direct'
  ]);
  assert.equal(commands.some((command) => command.pipeline.includes('radix')), false);
  assert.equal(result.resources.outputs.sourceCandidateCsr.singleStorageBinding, true);
  assert.equal(result.queueSubmitPerformed, false);
  assert.equal(result.mapPerformed, false);
  assert.equal(result.readbackPerformed, false);
  builder.release(result);
  builder.destroy();
});

test('exact small-source direct builder uses one masked fixed-segment dispatch', () => {
  const device = createFakeDevice();
  const encoder = createFakeEncoder();
  const descriptor = readyDescriptor();
  const builder = createResidentNeighborhoodGpuBuilder(device, {
    maxSourceCount: 32,
    maxSupportClassCount: 8,
    buildStrategy: 'direct',
    directSegmentedMasked: true,
    label: 'neighbor-segmented'
  });
  const result = builder.encode(encoder, {
    descriptor,
    ...createInputBuffers(device, descriptor)
  });
  const passes = encoder.events.filter((event) => event.kind === 'pass');
  const commands = passes.flatMap((event) => event.commands);

  assert.equal(result.directSegmentedMasked, true);
  assert.equal(result.encodingTelemetry.strategy, 'direct');
  assert.equal(
    result.encodingTelemetry.directTopology,
    'fixed-source-segments-zero-mask-inactive-rows'
  );
  assert.equal(result.encodingTelemetry.encodedDispatchCount, 1);
  assert.equal(result.encodingTelemetry.encodedComputePassCount, 1);
  assert.equal(result.encodingTelemetry.bindGroupCreationCount, 1);
  assert.equal(device.bindGroups.length, 1);
  assert.equal(result.scanEncoding.encoded, false);
  assert.equal(result.resources.scratch.candidateStaging.distanceEvaluatedDuringCountOnly, false);
  assert.equal(result.resources.scratch.candidateStaging.usedBySelectedTopology, false);
  assert.equal(result.resources.scratch.candidateStaging.rowCapacity, 0);
  assert.match(residentNeighborhoodBuilderWgsl, /packed_candidate_csr\[38u\] = 3u/);
  assert.match(residentNeighborhoodBuilderWgsl, /capacity_evidence\[42u\] = 3u/);
  assert.equal(passes.length, 1);
  assert.deepEqual(commands.map((command) => command.pipeline), [
    'neighbor-segmented-build-candidates-direct-segmented-masked'
  ]);
  assert.equal(commands[0].dispatch[0], 1);
  assert.equal(commands.some((command) => command.pipeline.includes('scan')), false);
  assert.equal(commands.some((command) => command.pipeline.includes('radix')), false);
  builder.release(result);
  builder.destroy();
});

test('optional profiler names every neighborhood build stage without taking submission ownership', () => {
  const device = createFakeDevice();
  const encoder = createFakeEncoder();
  const descriptor = readyDescriptor();
  const spans = [];
  const timestampProfiler = {
    active: true,
    beginComputePassDescriptor(label, metadata) {
      spans.push({ label, metadata });
      return { label };
    }
  };
  const builder = createResidentNeighborhoodGpuBuilder(device, {
    maxSourceCount: 32,
    maxSupportClassCount: 8,
    label: 'neighbor-profiled'
  });
  const result = builder.encode(
    encoder,
    { descriptor, ...createInputBuffers(device, descriptor) },
    { timestampProfiler, timestampMetadata: { taskId: 'neighbor-profile-task' } }
  );
  const labels = new Set(spans.map((span) => span.label));
  for (const label of Object.values(RESIDENT_NEIGHBORHOOD_GPU_TIMESTAMP_STAGE)) {
    assert.equal(labels.has(label), true, `missing timestamp span ${label}`);
  }
  assert.ok(spans.some((span) => span.metadata?.residentNeighborhoodStage === 'cell-sort-unique'));
  assert.ok(spans.some((span) => span.metadata?.residentNeighborhoodStage === 'candidate-count-scan'));
  assert.equal(result.queueSubmitPerformed, false);
  assert.equal(result.mapPerformed, false);
  assert.equal(result.readbackPerformed, false);
  assert.equal(Object.hasOwn(device.queue, 'submit'), false);
  builder.release(result);
  builder.destroy();
});

test('capacity or lease failure stays fail closed and records no GPU work', () => {
  for (const mode of ['capacity', 'lease']) {
    const device = createFakeDevice();
    const encoder = createFakeEncoder();
    const descriptor = mode === 'capacity'
      ? readyDescriptor({ capacities: { candidateCount: 1 } })
      : readyDescriptor();
    const inputs = createInputBuffers(device, descriptor);
    const builder = createResidentNeighborhoodGpuBuilder(device, {
      maxSourceCount: 8,
      maxSupportClassCount: 8,
      label: `neighbor-fail-${mode}`
    });
    const result = builder.encode(encoder, {
      descriptor,
      ...inputs,
      ...(mode === 'lease' ? { generation: descriptor.generation + 1 } : {})
    });
    assert.equal(result.hostAdmission, false);
    assert.equal(result.encoded, false);
    assert.equal(result.consumerDispatchAllowed, false);
    assert.equal(encoder.events.length, 0);
    assert.ok(result.hostReasonCodes.length > 0);
    assert.equal(result.resources.scratch.candidateStaging.rowCapacity, 0);
    builder.release(result);
    builder.destroy();
  }
});

test('single arena reuses structural buffers and reports the exact two-generation peak', () => {
  const device = createFakeDevice();
  device.limits.minUniformBufferOffsetAlignment = 512;
  device.limits.minStorageBufferOffsetAlignment = 256;
  const encoder = createFakeEncoder();
  const builder = createResidentNeighborhoodGpuBuilder(device, {
    maxSourceCount: 4,
    maxSupportClassCount: 1,
    reuseSingleArena: true,
    label: 'neighbor-reused'
  });
  const firstDescriptor = readyDescriptor();
  const firstInputs = createInputBuffers(device, firstDescriptor);
  const first = builder.encode(encoder, { descriptor: firstDescriptor, ...firstInputs });
  const secondDescriptor = readyDescriptor({
    generation: firstDescriptor.generation + 1,
    positionEpoch: firstDescriptor.positionValidity.positionEpoch + 1
  });
  const secondInputs = createInputBuffers(device, secondDescriptor);
  const second = builder.encode(encoder, { descriptor: secondDescriptor, ...secondInputs });

  assert.equal(first.arenaPolicy, 'single-shared-arena-command-ordered-reuse');
  assert.equal(
    first.retainedBuffers.packedCandidateCsrBuffer,
    second.retainedBuffers.packedCandidateCsrBuffer
  );
  assert.equal(first.retainedBuffers.cellCsrBuffer, second.retainedBuffers.cellCsrBuffer);
  assert.equal(first.retainedBuffers.paramsBuffer, second.retainedBuffers.paramsBuffer);
  assert.notEqual(first.retainedBuffers.paramsByteOffset, second.retainedBuffers.paramsByteOffset);
  assert.equal(
    first._headerUploads.packedHeaderUploadBuffer,
    second._headerUploads.packedHeaderUploadBuffer
  );
  assert.notEqual(
    first._headerUploads.packedHeaderByteOffset,
    second._headerUploads.packedHeaderByteOffset
  );
  assert.equal(
    device.buffers.filter((buffer) => (
      buffer.label.endsWith('-generation-params-arena')
        || buffer.label.endsWith('-generation-data-arena')
    )).length,
    2
  );
  assert.equal(builder.retainedGenerationSlotCount, 128);
  assert.ok(builder.retainedGenerationSlotCount >= 2 * 49);
  assert.equal(first.retainedBuffers.capacityEvidenceByteOffset, 0);
  assert.equal(second.retainedBuffers.capacityEvidenceByteOffset, 512);
  assert.equal(first.retainedBuffers.paramsByteOffset, 0);
  assert.equal(second.retainedBuffers.paramsByteOffset, 512);
  assert.equal(
    encoder.events.filter((event) => event.kind === 'copy'
      && event.destination === 'neighbor-reused-packed-source-candidate-csr'
      && event.source.endsWith('-generation-data-arena')).length,
    2
  );

  const allocationEntries = builder.allocationEntries();
  const uniqueAllocations = new Map();
  for (const entry of allocationEntries) uniqueAllocations.set(entry.buffer, entry.buffer.size);
  const actualPeak = [...uniqueAllocations.values()].reduce((sum, byteLength) => sum + byteLength, 0);
  const plan = planResidentNeighborhoodGpuBuilderAllocations({
    sourceCount: 4,
    supportClassCount: 1,
    candidateCapacity: 32,
    generationCount: 2,
    minUniformBufferOffsetAlignment: 512,
    minStorageBufferOffsetAlignment: 256
  });
  assert.equal(plan.peakAllocatedByteLength, actualPeak);
  assert.equal(plan.exact, true);
  assert.equal(
    plan.liveGenerationPolicy,
    'two-submission-window-with-bounded-retained-control-slots'
  );
  assert.equal(plan.retainedGenerationControlArenaByteLength, 128 * 1024);

  const sharedOutput = first.retainedBuffers.packedCandidateCsrBuffer;
  assert.equal(builder.release(first), true);
  assert.equal(sharedOutput.destroyed, false);
  assert.equal(builder.release(second), true);
  assert.equal(sharedOutput.destroyed, false);

  const generationArenaBufferCount = device.buffers.filter(
    (buffer) => buffer.label.endsWith('-generation-params-arena')
      || buffer.label.endsWith('-generation-data-arena')
  ).length;
  const thirdDescriptor = readyDescriptor({
    generation: secondDescriptor.generation + 1,
    positionEpoch: secondDescriptor.positionValidity.positionEpoch + 1
  });
  const third = builder.encode(createFakeEncoder(), {
    descriptor: thirdDescriptor,
    ...createInputBuffers(device, thirdDescriptor)
  });
  assert.equal(
    device.buffers.filter((buffer) => buffer.label.endsWith('-generation-params-arena')
      || buffer.label.endsWith('-generation-data-arena')).length,
    generationArenaBufferCount,
    'released command-ordered generation slots are reused without new GPUBuffer allocation'
  );
  assert.equal(builder.release(third), true);
  builder.destroy();
  assert.equal(sharedOutput.destroyed, true);
});

test('retained generation control planning admits two unresolved 49-generation submissions', () => {
  const twoSubmissionPlan = planResidentNeighborhoodGpuBuilderAllocations({
    sourceCount: 4,
    supportClassCount: 1,
    candidateCapacity: 32,
    generationCount: 98
  });
  assert.equal(twoSubmissionPlan.liveGenerationCount, 98);
  assert.equal(twoSubmissionPlan.retainedGenerationSlotCount, 128);
  assert.equal(twoSubmissionPlan.transientGenerationControlByteLength, 0);
  assert.throws(
    () => planResidentNeighborhoodGpuBuilderAllocations({
      sourceCount: 4,
      supportClassCount: 1,
      candidateCapacity: 32,
      generationCount: 129
    }),
    /exceeds retained generation slot capacity 128/
  );
});
