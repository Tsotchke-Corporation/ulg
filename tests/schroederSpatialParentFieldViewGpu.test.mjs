import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SCHROEDER_SPATIAL_PARENT_FIELD_MAX_EDGES_PER_FINE_FIELD,
  SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_COARSE_DISPATCH_OFFSET_WORDS,
  SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_DISPATCH_OFFSET_WORDS,
  SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_FINE_DISPATCH_OFFSET_WORDS,
  SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_HEADER_LAYOUT,
  SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_HEADER_WORDS,
  ULG_SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_SCHEMA,
  buildSchroederSpatialParentFieldTopologyCpuOracle,
  createSchroederSpatialParentFieldViewLayout,
  createSchroederSpatialParentFieldViewPlan,
  validateSchroederSpatialParentFieldViewDescriptor
} from '../ulg-gpu-abi/src/schroederSpatialParentFieldView.js';
import {
  schroederSpatialParentFieldViewWgsl
} from '../ulg-gpu-abi/src/schroederSpatialParentFieldViewWgsl.js';
import {
  ULG_SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_SCHEMA
} from '../ulg-gpu-abi/src/schroederSpatialMechanicsFieldView.js';
import {
  createSchroederSpatialParentFieldViewGpu
} from '../src/runtime/sph/schroederSpatialParentFieldViewGpu.js';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_PARENT_FIELD_VIEW === '1';
const NATIVE_BASE_URL = process.env.ULG_PARENT_FIELD_VIEW_BASE_URL
  || 'https://127.0.0.1:5174/';

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
    finish() { return { label: 'fake-parent-field-command-buffer', events }; }
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
      maxBufferSize: 256 * 1024 * 1024,
      maxStorageBufferBindingSize: 128 * 1024 * 1024,
      maxUniformBufferBindingSize: 64 * 1024,
      maxStorageBuffersPerShaderStage: 8,
      maxComputeWorkgroupsPerDimension: 65535,
      minUniformBufferOffsetAlignment: 256
    },
    queue: {
      writeBuffer(buffer, offset, data) {
        const bytes = data instanceof ArrayBuffer
          ? data.slice(0)
          : data.buffer.slice(
              data.byteOffset,
              data.byteOffset + data.byteLength
            );
        writes.push({ buffer, offset, byteLength: data.byteLength, data: bytes });
      },
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
      const pipeline = {
        ...descriptor,
        getBindGroupLayout(index) {
          return {
            pipeline: descriptor.label,
            entryPoint: descriptor.compute.entryPoint,
            index
          };
        }
      };
      pipelines.push(pipeline);
      return pipeline;
    },
    createBindGroup(descriptor) {
      bindGroups.push(descriptor);
      return descriptor;
    },
    createCommandEncoder() { return createFakeEncoder(); }
  };
}

function identity() {
  return {
    generationId: 7,
    deviceOrdinal: 0,
    laneOrdinal: 0,
    leaseToken: 11,
    sourceFamilyId: 13,
    storageGeneration: 17,
    physicsTick: 19,
    physicsSubstep: 0,
    positionEpoch: 23,
    topologyEpoch: 29,
    chartEpoch: 31,
    levelEpoch: 37,
    supportEpoch: 41,
    completionOrdinal: 43
  };
}

function createOwnedExecution(value, {
  encodedStatus,
  submittedStatus,
  submitted = false
}) {
  const owner = {
    ownsExecution: (candidate) => candidate === value,
    isExecutionSubmitted: (candidate) => candidate === value && value.submitPerformed === true
  };
  Object.defineProperty(value, 'ownerRuntime', { value: owner });
  value.status = submitted ? submittedStatus : encodedStatus;
  value.submitPerformed = submitted;
  value.released = false;
  value.markSubmitted = () => {
    value.status = submittedStatus;
    value.submitPerformed = true;
  };
  return value;
}

function createExactInputs(device, {
  submitted = false,
  fineFieldCapacity = 4,
  coarseFieldCapacity = 3
} = {}) {
  const ids = identity();
  const sourceBuffer = device.createBuffer({
    label: 'parent-field-source',
    size: 4096,
    usage: 128
  });
  const identityBuffer = device.createBuffer({
    label: 'parent-field-identity',
    size: 256,
    usage: 128
  });
  const fineMechanicsView = { id: 'fine-mechanics' };
  const coarseMechanicsView = { id: 'coarse-mechanics' };
  const field = ({ level, grid, capacity, parentMechanicsView, label }) => {
    const fieldView = {
      schema: ULG_SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_SCHEMA,
      sourceBuffer,
      identityBuffer,
      parentMechanicsView,
      selectedLevel: level,
      gridNodeCount: grid.gridNodeCount,
      gridDims: grid.gridDims,
      gridShift: grid.gridShift,
      gridSpacingM: grid.gridSpacingM,
      fieldCapacity: capacity,
      fieldViewBuffer: device.createBuffer({ label, size: 8192, usage: 128 | 256 }),
      indirectDispatchBuffer: null,
      indirectDispatchOffsetBytes: 240,
      ...ids
    };
    fieldView.indirectDispatchBuffer = fieldView.fieldViewBuffer;
    return createOwnedExecution(fieldView, {
      encodedStatus: 'schroeder-spatial-mechanics-field-view-gpu-encoded',
      submittedStatus: 'schroeder-spatial-mechanics-field-view-gpu-build-submitted',
      submitted
    });
  };
  const fineGrid = {
    gridNodeCount: 5 * 5 * 5,
    gridDims: [5, 5, 5],
    gridShift: 0,
    gridSpacingM: 0.25
  };
  const coarseGrid = {
    gridNodeCount: 3 * 3 * 3,
    gridDims: [3, 3, 3],
    gridShift: 0,
    gridSpacingM: 0.5
  };
  const fineFieldView = field({
    level: 0,
    grid: fineGrid,
    capacity: fineFieldCapacity,
    parentMechanicsView: fineMechanicsView,
    label: 'fine-field-view'
  });
  const coarseFieldView = field({
    level: 1,
    grid: coarseGrid,
    capacity: coarseFieldCapacity,
    parentMechanicsView: coarseMechanicsView,
    label: 'coarse-field-view'
  });
  const hierarchyView = createOwnedExecution({
    schema: 'peercompute.ulg.schroeder-spatial-hierarchy-view.v1',
    fineLevel: 0,
    coarseLevel: 1,
    fineGrid,
    coarseGrid,
    fineMechanicsView,
    coarseMechanicsView,
    hierarchyViewBuffer: device.createBuffer({
      label: 'hierarchy-view',
      size: 16384,
      usage: 128 | 256
    }),
    ...ids
  }, {
    encodedStatus: 'schroeder-spatial-hierarchy-view-gpu-encoded',
    submittedStatus: 'schroeder-spatial-hierarchy-view-gpu-build-submitted',
    submitted
  });
  return {
    fineGrid,
    coarseGrid,
    fineFieldView,
    coarseFieldView,
    hierarchyView,
    mechanicsFieldViews: [fineFieldView, coarseFieldView]
  };
}

test('parent-field ABI reserves exact topology capacity and three fail-closed dispatches', () => {
  assert.equal(SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_HEADER_LAYOUT.length, 80);
  assert.equal(SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_HEADER_WORDS, 80);
  assert.equal(SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_DISPATCH_OFFSET_WORDS, 60);
  assert.equal(SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_FINE_DISPATCH_OFFSET_WORDS, 64);
  assert.equal(SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_COARSE_DISPATCH_OFFSET_WORDS, 68);
  assert.equal(SCHROEDER_SPATIAL_PARENT_FIELD_MAX_EDGES_PER_FINE_FIELD, 8);
  const layout = createSchroederSpatialParentFieldViewLayout({
    fineFieldCapacity: 4,
    coarseFieldCapacity: 3
  });
  assert.equal(layout.fineCandidateCapacity, 32);
  assert.equal(layout.candidateCapacity, 35);
  assert.equal(layout.parentFieldCapacity, 35);
  assert.equal(layout.edgeCapacity, 32);
  assert.equal(layout.parentKeyOffsetWords, 80);
  assert.equal(layout.fineEdgeOffsetOffsetWords, layout.fineEdgeCountOffsetWords + 4);
  assert.equal(layout.fineEdgeParentOffsetWords, layout.fineEdgeOffsetOffsetWords + 5);
  assert.equal(layout.coarseNativeMapOffsetWords, layout.fineEdgeWeightOffsetWords + 32);
  assert.equal(layout.wordLength, layout.coarseNativeMapOffsetWords + 3);

  const plan = createSchroederSpatialParentFieldViewPlan({
    fineLevel: 0,
    coarseLevel: 1,
    fineGrid: { gridNodeCount: 125, gridDims: [5, 5, 5], gridShift: 0, gridSpacingM: 0.25 },
    coarseGrid: { gridNodeCount: 27, gridDims: [3, 3, 3], gridShift: 0, gridSpacingM: 0.5 },
    fineFieldCapacity: 4,
    coarseFieldCapacity: 3,
    ...identity()
  });
  assert.equal(plan.schema, ULG_SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_SCHEMA);
  assert.equal(plan.exactLevelCount, 2);
  assert.equal(plan.maxEdgesPerFineField, 8);
  assert.throws(
    () => createSchroederSpatialParentFieldViewPlan({ ...plan, levelCount: 3 }),
    /exactly two mechanics levels/
  );
  assert.throws(
    () => createSchroederSpatialParentFieldViewPlan({ ...plan, coarseLevel: 2 }),
    /fineLevel \+ 1/
  );
});

test('CPU parent-field oracle preserves partition and first moment while deduplicating native fields', () => {
  const oracle = buildSchroederSpatialParentFieldTopologyCpuOracle({
    fineFieldKeys: [
      [31, 2, 7, 0],
      [62, 1, 26, 99]
    ],
    coarseFieldKeys: [
      [0, 2, 7, 0],
      [13, 1, 26, 99]
    ],
    hierarchy: {
      fineNodes: [31, 62],
      coarseNodes: [0, 1, 3, 4, 9, 10, 12, 13],
      edgeOffsets: [0, 8, 9],
      edgeParents: [0, 1, 2, 3, 4, 5, 6, 7, 7],
      edgeWeights: [0.125, 0.125, 0.125, 0.125, 0.125, 0.125, 0.125, 0.125, 1]
    },
    fineGrid: {
      gridNodeCount: 125,
      gridDims: [5, 5, 5],
      gridShift: 0,
      gridSpacingM: 1
    },
    coarseGrid: {
      gridNodeCount: 27,
      gridDims: [3, 3, 3],
      gridShift: 0,
      gridSpacingM: 2
    }
  });
  assert.equal(oracle.parentFieldKeys.length, 9);
  assert.deepEqual(oracle.fineEdgeOffsets, [0, 8, 9]);
  assert.equal(oracle.fineEdgeParentIndices.length, 9);
  assert.deepEqual(oracle.fineEdgeWeights, [
    0.125, 0.125, 0.125, 0.125, 0.125, 0.125, 0.125, 0.125, 1
  ]);
  assert.equal(
    oracle.coarseNativeToParentField[0],
    oracle.fineEdgeParentIndices[0]
  );
  assert.equal(
    oracle.coarseNativeToParentField[1],
    oracle.fineEdgeParentIndices[8]
  );
  assert.equal(oracle.maxWeightResidual, 0);
  assert.equal(oracle.maxFirstMomentResidualM, 0);
  for (let index = 1; index < oracle.parentFieldKeys.length; index += 1) {
    const left = oracle.parentFieldKeys[index - 1];
    const right = oracle.parentFieldKeys[index];
    const firstDifference = left.findIndex((word, column) => word !== right[column]);
    assert.notEqual(firstDifference, -1);
    assert.ok(left[firstDifference] < right[firstDifference]);
  }
});

test('parent-field shader consumes hierarchy edges and has no arbitrary candidate budget', () => {
  assert.match(schroederSpatialParentFieldViewWgsl, /fn prepare_candidate_count/);
  assert.match(schroederSpatialParentFieldViewWgsl, /fn hierarchy_fine_compact_index/);
  assert.match(schroederSpatialParentFieldViewWgsl, /fn hierarchy_edge_range/);
  assert.match(schroederSpatialParentFieldViewWgsl, /fn emit_fine_parent_candidates/);
  assert.match(schroederSpatialParentFieldViewWgsl, /fn emit_coarse_native_candidates/);
  assert.match(schroederSpatialParentFieldViewWgsl, /fn materialize_candidate_union_indices/);
  assert.match(schroederSpatialParentFieldViewWgsl, /fn scatter_fine_field_edges/);
  assert.match(schroederSpatialParentFieldViewWgsl, /weight_sum - 1\.0/);
  assert.match(schroederSpatialParentFieldViewWgsl, /length\(reproduced - fine_position\)/);
  assert.match(schroederSpatialParentFieldViewWgsl, /@builtin\(num_workgroups\)/);
  assert.match(schroederSpatialParentFieldViewWgsl, /fn flattened_invocation_index/);
  assert.match(schroederSpatialParentFieldViewWgsl, /fn bounded_dispatch_shape/);
  assert.doesNotMatch(schroederSpatialParentFieldViewWgsl, /candidate_budget/i);
  assert.doesNotMatch(schroederSpatialParentFieldViewWgsl, /readback/i);
});

test('parent-field runtime shapes direct and published work over two dimensions', () => {
  const device = createFakeDevice();
  device.limits.maxComputeWorkgroupsPerDimension = 2;
  const inputs = createExactInputs(device, {
    fineFieldCapacity: 17,
    coarseFieldCapacity: 1
  });
  const runtime = createSchroederSpatialParentFieldViewGpu(device, {
    fineGrid: inputs.fineGrid,
    coarseGrid: inputs.coarseGrid,
    fineFieldCapacity: 17,
    coarseFieldCapacity: 1
  });
  const encoder = createFakeEncoder();
  const execution = runtime.encode(encoder, inputs);
  assert.equal(execution.maxComputeWorkgroupsPerDimension, 2);
  const dispatchByPipeline = new Map(
    encoder.events
      .filter((event) => event.kind === 'pass')
      .flatMap((event) => event.commands)
      .filter(({ dispatch }) => dispatch)
      .map(({ pipeline, dispatch }) => [pipeline, dispatch])
  );
  const indirectByPipeline = new Map(
    encoder.events
      .filter((event) => event.kind === 'pass')
      .flatMap((event) => event.commands)
      .filter(({ dispatchIndirect }) => dispatchIndirect)
      .map(({ pipeline, dispatchIndirect }) => [pipeline, dispatchIndirect])
  );
  assert.deepEqual(
    indirectByPipeline.get(
      'ulg-schroeder-spatial-parent-field-view-materialize-candidate-union-indices-pipeline'
    ),
    {
      label: 'ulg-schroeder-spatial-parent-field-view-arena-0-candidate-dispatch',
      byteOffset: 0
    }
  );
  assert.match(
    indirectByPipeline.get(
      'ulg-schroeder-spatial-parent-field-view-assemble-parent-field-keys-pipeline'
    )?.label ?? '',
    /radix-dispatch-indirect/
  );
  for (const dispatch of dispatchByPipeline.values()) {
    assert.ok(dispatch[0] <= 2);
    assert.ok(dispatch[1] <= 2);
  }
  const paramsWrite = device.writes.find(
    ({ buffer }) => buffer.label.endsWith('-params')
  );
  assert.equal(new DataView(paramsWrite.data).getUint32(204, true), 2);
  assert.equal(runtime.releaseExecution(execution, { discardedEncoder: true }), true);
  assert.equal(runtime.destroy(), true);

  const rejectedInputs = createExactInputs(device, {
    fineFieldCapacity: 33,
    coarseFieldCapacity: 1
  });
  assert.throws(
    () => createSchroederSpatialParentFieldViewGpu(device, {
      fineGrid: rejectedInputs.fineGrid,
      coarseGrid: rejectedInputs.coarseGrid,
      fineFieldCapacity: 33,
      coarseFieldCapacity: 1
    }),
    /maxComputeWorkgroupsPerDimension squared/
  );
});

test('parent-field runtime encodes persistent union topology and retires after a fence', async () => {
  const device = createFakeDevice();
  const inputs = createExactInputs(device);
  const runtime = createSchroederSpatialParentFieldViewGpu(device, {
    fineGrid: inputs.fineGrid,
    coarseGrid: inputs.coarseGrid,
    fineFieldCapacity: 4,
    coarseFieldCapacity: 3,
    arenaCount: 2
  });
  const retainedBufferCount = device.buffers.length;
  const encoder = createFakeEncoder();
  const execution = runtime.encode(encoder, inputs);
  assert.equal(device.buffers.length, retainedBufferCount);
  assert.equal(execution.status, 'schroeder-spatial-parent-field-view-gpu-encoded');
  assert.equal(execution.submitPerformed, false);
  assert.equal(execution.parentSubmissionState, 'encoded');
  assert.equal(execution.topology, 'field-aware-two-level-parent-union-weighted-csr');
  assert.equal(execution.transferStateStatus, 'topology-only-no-mechanics-state-transfer');
  assert.equal(execution.readbackPerformed, false);
  assert.equal(execution.bufferAllocationCountDuringEncode, 0);
  assert.equal(execution.gpuBufferCreationCountDuringEncode, 0);
  assert.equal(execution.indirectDispatchBuffer, execution.parentFieldViewBuffer);
  assert.equal(execution.indirectDispatchOffsetBytes, 240);
  assert.equal(execution.fineIndirectDispatchOffsetBytes, 256);
  assert.equal(execution.coarseIndirectDispatchOffsetBytes, 272);
  assert.deepEqual(execution.mechanicsFieldViews, [
    inputs.fineFieldView,
    inputs.coarseFieldView
  ]);
  const commands = encoder.events
    .filter((event) => event.kind === 'pass')
    .flatMap((event) => event.commands);
  for (const fragment of [
    'prepare-candidate-count',
    'emit-fine-parent-candidates',
    'emit-coarse-native-candidates',
    'materialize-candidate-union-indices',
    'assemble-parent-field-keys',
    'scatter-fine-field-edges',
    'finalize-parent-field-view'
  ]) {
    assert.ok(commands.some(({ pipeline }) => pipeline.includes(fragment)), fragment);
  }
  assert.equal(execution.radixElementCountSource, 'authenticated-gpu-authority');
  assert.throws(
    () => runtime.markExecutionSubmitted(execution),
    /parents must be marked submitted/
  );
  inputs.fineFieldView.markSubmitted();
  inputs.coarseFieldView.markSubmitted();
  inputs.hierarchyView.markSubmitted();
  assert.equal(runtime.markExecutionSubmitted(execution), true);
  assert.equal(validateSchroederSpatialParentFieldViewDescriptor(execution, {
    generationId: inputs.hierarchyView.generationId,
    fineLevel: 0,
    coarseLevel: 1,
    exactLevelCount: 2
  }).admitted, true);
  assert.equal(validateSchroederSpatialParentFieldViewDescriptor({
    ...execution
  }).status, 'schroeder-spatial-parent-field-view-rejected-owner');
  assert.equal(await runtime.releaseExecutionAfter(execution, Promise.resolve()), true);
  assert.equal(execution.released, true);
  assert.equal(runtime.activeExecutionCount(), 0);
  const explicitBindGroupCount = device.bindGroups.filter(
    (group) => group.label?.endsWith('-bindings')
  ).length;
  const cachedExecution = runtime.encode(createFakeEncoder(), inputs);
  assert.equal(
    device.bindGroups.filter((group) => group.label?.endsWith('-bindings')).length,
    explicitBindGroupCount
  );
  assert.equal(
    runtime.releaseExecution(cachedExecution, { discardedEncoder: true }),
    true
  );
  assert.equal(runtime.destroy(), true);
});

test('parent-field runtime accepts submitted parents and rejects third or foreign levels', () => {
  const device = createFakeDevice();
  const inputs = createExactInputs(device, { submitted: true });
  const runtime = createSchroederSpatialParentFieldViewGpu(device, {
    fineGrid: inputs.fineGrid,
    coarseGrid: inputs.coarseGrid,
    fineFieldCapacity: 4,
    coarseFieldCapacity: 3
  });
  const execution = runtime.encode(createFakeEncoder(), inputs);
  assert.equal(execution.parentSubmissionState, 'submitted');
  assert.throws(
    () => runtime.encode(createFakeEncoder(), {
      ...inputs,
      mechanicsFieldViews: [
        inputs.fineFieldView,
        inputs.coarseFieldView,
        inputs.coarseFieldView
      ]
    }),
    /exactly two mechanics field views/
  );
  assert.throws(
    () => runtime.encode(createFakeEncoder(), {
      ...inputs,
      mechanicsFieldViews: [
        inputs.fineFieldView,
        { ...inputs.coarseFieldView }
      ]
    }),
    /exact live two-level fields/
  );
  assert.equal(runtime.releaseExecution(execution, { discardedEncoder: true }), true);
  assert.equal(runtime.destroy(), true);
});

test('native Vulkan parent-field union admits exact keys, CSR, maps, and residuals', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_PARENT_FIELD_VIEW=1 for native WebGPU',
  timeout: 120_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: process.env.ULG_PARENT_FIELD_VIEW_CHROME
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
      const errors = [];
      device.addEventListener('uncapturederror', (event) => {
        errors.push(event.error?.message || String(event.error));
      });
      device.pushErrorScope('validation');
      const nonce = Date.now();
      const spatial = await import(
        `/src/runtime/sph/schroederSpatialEpochGpu.js?parentFieldNative=${nonce}`
      );
      const parentModule = await import(
        `/src/runtime/sph/schroederSpatialParentFieldViewGpu.js?parentFieldNative=${nonce}`
      );
      const parentAbi = await import(
        `/ulg-gpu-abi/src/schroederSpatialParentFieldView.js?parentFieldNative=${nonce}`
      );

      const particleCount = 2;
      const rows = new Float32Array(particleCount * 16);
      const positions = [[2, 2, 2], [2, 2, 2]];
      for (let index = 0; index < particleCount; index += 1) {
        const level = index;
        const offset = index * 16;
        rows[offset] = level;
        rows[offset + 1] = 0.5 * (2 ** level);
        rows[offset + 2] = 1;
        rows[offset + 3] = 0.001;
        rows[offset + 4] = 0.001;
        rows[offset + 5] = 0.001;
        rows[offset + 6] = 1;
        rows[offset + 7] = 1000;
        rows[offset + 8] = 1;
        rows[offset + 9] = 26;
        rows[offset + 10] = 1;
        rows[offset + 11] = 0.15;
        rows[offset + 12] = positions[index][0];
        rows[offset + 13] = positions[index][1];
        rows[offset + 14] = positions[index][2];
        rows[offset + 15] = 0;
      }
      const state = new Float32Array([
        2, 2, 2, 1, 0, 0, 0, 1,
        2, 2, 2, 1, 0, 0, 0, 1
      ]);
      const identities = new Uint32Array([101, 202]);
      const assignmentBuffer = device.createBuffer({
        label: 'native-parent-field-assignment',
        size: rows.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
      });
      const stateBuffer = device.createBuffer({
        label: 'native-parent-field-state',
        size: state.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
      });
      const identityBuffer = device.createBuffer({
        label: 'native-parent-field-identity',
        size: identities.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });
      device.queue.writeBuffer(assignmentBuffer, 0, rows);
      device.queue.writeBuffer(stateBuffer, 0, state);
      device.queue.writeBuffer(identityBuffer, 0, identities);
      const levelAssignment = {
        schema: 'peercompute.ulg.schroeder-level-assignment-execution.v0',
        status: 'schroeder-level-assignment-submitted',
        bufferFamilyGenerationStatus: 'schroeder-particle-buffer-family-generation-ready',
        particleCount,
        assignmentStrideFloats: 16,
        assignments: rows,
        assignmentBuffer,
        assignmentBufferByteLength: rows.byteLength,
        sourceStateBuffer: stateBuffer,
        sourceStateBufferBorrowed: true,
        storageGeneration: 1,
        physicsTick: 0,
        physicsSubstep: 0,
        positionEpoch: 0,
        topologyEpoch: 0,
        chartEpoch: 0,
        levelEpoch: 0,
        supportEpoch: 0,
        minLevel: 0,
        maxLevel: 1,
        chartId: 0,
        baseGridSpacingM: 0.5
      };
      const fineGrid = {
        gridNodeCount: 8 * 8 * 8,
        gridDims: [8, 8, 8],
        gridShift: 1,
        gridSpacingM: 0.5
      };
      const coarseGrid = {
        gridNodeCount: 5 * 5 * 5,
        gridDims: [5, 5, 5],
        gridShift: 1,
        gridSpacingM: 1
      };
      const generation = spatial.runSchroederSpatialEpochGenerationWebGpu({
        device,
        levelAssignment,
        particleCount,
        particleIdentityBuffer: identityBuffer,
        particleIdentityStrideWords: 1,
        mechanicsLevels: [
          { selectedLevel: 0, mechanicsGrid: fineGrid },
          { selectedLevel: 1, mechanicsGrid: coarseGrid }
        ]
      });
      if (!generation.ready) {
        return { status: 'generation-rejected', reason: generation.reason };
      }
      const fieldViews = generation.mechanicsLevelViews.map(
        (levelView) => levelView.mechanicsFieldView
      );
      const runtime = parentModule.createSchroederSpatialParentFieldViewGpu(device, {
        fineGrid,
        coarseGrid,
        fineFieldCapacity: fieldViews[0].fieldCapacity,
        coarseFieldCapacity: fieldViews[1].fieldCapacity,
        arenaCount: 1
      });
      const encoder = device.createCommandEncoder({
        label: 'native-parent-field-build'
      });
      const execution = runtime.encode(encoder, {
        mechanicsFieldViews: fieldViews,
        hierarchyView: generation.hierarchyView
      });
      const readback = device.createBuffer({
        label: 'native-parent-field-readback',
        size: execution.layout.byteLength,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
      });
      const fineFieldHeaderReadback = device.createBuffer({
        label: 'native-parent-field-fine-input-header-readback',
        size: 64 * Uint32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
      });
      const coarseFieldHeaderReadback = device.createBuffer({
        label: 'native-parent-field-coarse-input-header-readback',
        size: 64 * Uint32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
      });
      encoder.copyBufferToBuffer(
        execution.parentFieldViewBuffer,
        0,
        readback,
        0,
        execution.layout.byteLength
      );
      encoder.copyBufferToBuffer(
        fieldViews[0].fieldViewBuffer,
        0,
        fineFieldHeaderReadback,
        0,
        64 * Uint32Array.BYTES_PER_ELEMENT
      );
      encoder.copyBufferToBuffer(
        fieldViews[1].fieldViewBuffer,
        0,
        coarseFieldHeaderReadback,
        0,
        64 * Uint32Array.BYTES_PER_ELEMENT
      );
      device.queue.submit([encoder.finish()]);
      runtime.markExecutionSubmitted(execution);
      await Promise.all([
        readback.mapAsync(GPUMapMode.READ),
        fineFieldHeaderReadback.mapAsync(GPUMapMode.READ),
        coarseFieldHeaderReadback.mapAsync(GPUMapMode.READ)
      ]);
      const bytes = readback.getMappedRange().slice(0);
      const words = new Uint32Array(bytes);
      const floats = new Float32Array(bytes);
      const fineFieldHeader = new Uint32Array(
        fineFieldHeaderReadback.getMappedRange().slice(0)
      );
      const coarseFieldHeader = new Uint32Array(
        coarseFieldHeaderReadback.getMappedRange().slice(0)
      );
      readback.unmap();
      readback.destroy();
      fineFieldHeaderReadback.unmap();
      fineFieldHeaderReadback.destroy();
      coarseFieldHeaderReadback.unmap();
      coarseFieldHeaderReadback.destroy();
      const parentCount = words[37];
      const fineCount = words[35];
      const coarseCount = words[36];
      const edgeCount = words[38];
      const coarseMap = Array.from(words.slice(
        execution.layout.coarseNativeMapOffsetWords,
        execution.layout.coarseNativeMapOffsetWords + coarseCount
      ));
      const fineOffsets = Array.from(words.slice(
        execution.layout.fineEdgeOffsetOffsetWords,
        execution.layout.fineEdgeOffsetOffsetWords + fineCount + 1
      ));
      const edgeWeights = Array.from(floats.slice(
        execution.layout.fineEdgeWeightOffsetWords,
        execution.layout.fineEdgeWeightOffsetWords + edgeCount
      ));
      let maxFineWeightResidual = 0;
      for (let field = 0; field < fineCount; field += 1) {
        let sum = 0;
        for (let edge = fineOffsets[field]; edge < fineOffsets[field + 1]; edge += 1) {
          sum += edgeWeights[edge];
        }
        maxFineWeightResidual = Math.max(maxFineWeightResidual, Math.abs(sum - 1));
      }
      const validationError = await device.popErrorScope();
      await new Promise((resolve) => setTimeout(resolve, 50));
      const result = {
        status: 'complete',
        schema: execution.schema,
        flags: words[2],
        generationId: words[3],
        fineCount,
        coarseCount,
        parentCount,
        edgeCount,
        dispatch: Array.from(words.slice(60, 63)),
        fineDispatch: Array.from(words.slice(64, 67)),
        levelCount: words[67],
        coarseDispatch: Array.from(words.slice(68, 71)),
        invalidSource: words[39],
        overflow: words[40],
        clipped: words[41],
        invalidKey: words[71],
        fineAdmissionMask: words[78],
        coarseAdmissionMask: words[79],
        fineInputFlags: fineFieldHeader[2],
        fineInputFieldCount: fineFieldHeader[34],
        fineInputFieldCapacity: fineFieldHeader[32],
        fineInputActiveRequiredWords: fineFieldHeader[41],
        fineInputCapacityWords: fineFieldHeader[42],
        coarseInputFlags: coarseFieldHeader[2],
        coarseInputFieldCount: coarseFieldHeader[34],
        coarseInputFieldCapacity: coarseFieldHeader[32],
        coarseInputActiveRequiredWords: coarseFieldHeader[41],
        coarseInputCapacityWords: coarseFieldHeader[42],
        weightResidual: floats[42],
        momentResidual: floats[43],
        maxFineWeightResidual,
        coarseMapValid: coarseMap.every((index) => index < parentCount),
        terminalEdgeOffset: fineOffsets.at(-1),
        validationError: validationError?.message || null,
        errors
      };
      const fence = device.queue.onSubmittedWorkDone();
      await runtime.releaseExecutionAfter(execution, fence);
      runtime.destroy();
      spatial.releaseSchroederSpatialEpochGenerationAfterQueue(generation, device);
      await generation.releasePromise;
      assignmentBuffer.destroy();
      stateBuffer.destroy();
      identityBuffer.destroy();
      return result;
    });
  } finally {
    await browser.close();
  }
  assert.equal(native.status, 'complete', native.reason || 'native WebGPU did not run');
  assert.equal(native.schema, ULG_SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_SCHEMA);
  assert.equal(native.flags, 3, JSON.stringify(native));
  assert.ok(native.fineCount > 0);
  assert.ok(native.coarseCount > 0);
  assert.ok(native.parentCount > 0);
  assert.ok(native.edgeCount >= native.fineCount);
  assert.equal(native.levelCount, 2);
  assert.equal(native.invalidSource, 0);
  assert.equal(native.overflow, 0);
  assert.equal(native.clipped, 0);
  assert.equal(native.invalidKey, 0);
  assert.equal(native.fineAdmissionMask, 0);
  assert.equal(native.coarseAdmissionMask, 0);
  assert.equal(native.fineInputFlags, 3);
  assert.equal(native.coarseInputFlags, 3);
  assert.ok(native.fineInputFieldCount < native.fineInputFieldCapacity);
  assert.ok(native.coarseInputFieldCount < native.coarseInputFieldCapacity);
  assert.ok(
    native.fineInputActiveRequiredWords < native.fineInputCapacityWords
  );
  assert.ok(
    native.coarseInputActiveRequiredWords < native.coarseInputCapacityWords
  );
  assert.ok(native.weightResidual <= 2 ** -20);
  assert.ok(native.momentResidual <= 1e-6);
  assert.ok(native.maxFineWeightResidual <= 2 ** -20);
  assert.equal(native.coarseMapValid, true);
  assert.equal(native.terminalEdgeOffset, native.edgeCount);
  assert.ok(native.dispatch[0] > 0);
  assert.ok(native.fineDispatch[0] > 0);
  assert.ok(native.coarseDispatch[0] > 0);
  assert.equal(native.validationError, null);
  assert.deepEqual(native.errors, []);
});
