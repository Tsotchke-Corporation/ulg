import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_CFL_INTERVAL_WORDS,
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_PHASE_COARSE_PUBLISH_COMPLETE,
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_PHASE_FINE_CORRECTION_COMPLETE,
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_PHASE_PREDICTOR_VELOCITY_READY,
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_INTERNAL_ENERGY_REFLUX_DEPOSIT,
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_REFLUX_MEASURED_CONSERVATIVE,
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_HEADER_LAYOUT,
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_HEADER_WORDS,
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_FINE_IMPULSE_WORDS,
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_PARENT_TO_COARSE_ORDINAL_ENCODING,
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_PARAMS_BYTES,
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_ROUTE_WORDS,
  ULG_SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_SCHEMA,
  buildSchroederSpatialParentFieldMechanicsCpuOracle,
  createSchroederSpatialParentFieldMechanicsWorkspaceLayout
} from '../ulg-gpu-abi/src/schroederSpatialParentFieldMechanicsWorkspace.js';
import {
  schroederSpatialParentFieldMechanicsWorkspaceWgsl
} from '../ulg-gpu-abi/src/schroederSpatialParentFieldMechanicsWorkspaceWgsl.js';
import {
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_PHASE_CONSUMED,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_PHASE_ENERGY_READY,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_STATUS_FAIL_CLOSED,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_STATUS_READY,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT,
  ULG_SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_SCHEMA
} from '../ulg-gpu-abi/src/schroederSpatialMechanicsFieldView.js';
import {
  ULG_SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_SCHEMA,
  createSchroederSpatialParentFieldViewPlan
} from '../ulg-gpu-abi/src/schroederSpatialParentFieldView.js';
import {
  createSchroederCrossLevelRefluxLedgerGpu,
  createSchroederSpatialParentFieldMechanicsWorkspaceGpu,
  directSchroederSpatialParentFieldMechanicsWorkspaceGpu
} from '../src/runtime/sph/schroederSpatialParentFieldMechanicsWorkspaceGpu.js';
import {
  SCHROEDER_CROSS_LEVEL_REFLUX_PHASE_ACCUMULATING,
  SCHROEDER_CROSS_LEVEL_REFLUX_PHASE_CONSUMED,
  SCHROEDER_CROSS_LEVEL_REFLUX_PHASE_ENERGY_READY,
  SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_ADMITTED,
  SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_FAIL_CLOSED,
  SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_PHASE_REJECTED,
  SCHROEDER_CROSS_LEVEL_REFLUX_TERMINAL_RECEIPT_CONSUMED,
  SCHROEDER_CROSS_LEVEL_REFLUX_TERMINAL_RECEIPT_REJECTED,
  SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_READY
} from '../ulg-gpu-abi/src/schroederCrossLevelRefluxLedger.js';

const RUN_NATIVE_DEFAULT =
  process.env.ULG_RUN_NATIVE_PARENT_FIELD_MECHANICS === '1';
const RUN_NATIVE_M0 = process.env.ULG_RUN_NATIVE_PARENT_FIELD_MECHANICS_M0 === '1';
const RUN_NATIVE_M1 = process.env.ULG_RUN_NATIVE_PARENT_FIELD_MECHANICS_M1 === '1';
// The default native gate follows the production fused lifecycle. The old
// unfused fixture necessarily awaited an owned-buffer cleanup fence between
// stages and is therefore no longer a valid resident-hot-loop acceptance path.
const RUN_NATIVE_M2 = RUN_NATIVE_DEFAULT
  || process.env.ULG_RUN_NATIVE_PARENT_FIELD_MECHANICS_M2 === '1';
const RUN_NATIVE = RUN_NATIVE_M0 || RUN_NATIVE_M1 || RUN_NATIVE_M2;
const NATIVE_BASE_URL = process.env.ULG_PARENT_FIELD_MECHANICS_BASE_URL
  || 'https://127.0.0.1:5174/';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  promise.catch(() => {});
  return { promise, resolve, reject };
}

function fakeEncoder() {
  const events = [];
  return {
    events,
    clearBuffer(buffer) { events.push({ kind: 'clear', buffer }); },
    copyBufferToBuffer(source, sourceOffset, target, targetOffset, size) {
      events.push({
        kind: 'copy', source, sourceOffset, target, targetOffset, size
      });
    },
    beginComputePass({ label } = {}) {
      const event = { kind: 'pass', label, commands: [], bindGroups: [] };
      events.push(event);
      let pipeline = null;
      return {
        setPipeline(value) { pipeline = value; },
        setBindGroup(index, value) { event.bindGroups.push({ index, value }); },
        dispatchWorkgroups(x, y, z) {
          event.commands.push({ pipeline, direct: [x, y, z] });
        },
        dispatchWorkgroupsIndirect(buffer, offset) {
          event.commands.push({ pipeline, indirect: { buffer, offset } });
        },
        end() { event.ended = true; }
      };
    },
    finish() { return { events }; }
  };
}

function fakeDevice({ explicitLayouts = false } = {}) {
  const buffers = [];
  const pipelines = [];
  const bindGroupLayouts = [];
  const pipelineLayouts = [];
  const bindGroups = [];
  const submissions = [];
  const writes = [];
  const device = {
    buffers,
    pipelines,
    bindGroupLayouts,
    pipelineLayouts,
    bindGroups,
    submissions,
    writes,
    limits: {
      maxBufferSize: 256 * 1024 * 1024,
      maxStorageBufferBindingSize: 128 * 1024 * 1024,
      maxUniformBufferBindingSize: 64 * 1024,
      maxStorageBuffersPerShaderStage: 12,
      minStorageBufferOffsetAlignment: 256
    },
    createBuffer(descriptor) {
      const buffer = {
        ...descriptor,
        destroyed: false,
        destroyCount: 0,
        destroy() {
          this.destroyCount += 1;
          this.destroyed = true;
        }
      };
      buffers.push(buffer);
      return buffer;
    },
    createShaderModule(descriptor) { return descriptor; },
    createComputePipeline(descriptor) {
      const pipeline = {
        ...descriptor,
        getBindGroupLayout(index) {
          if (descriptor.layout && descriptor.layout !== 'auto') {
            return descriptor.layout.bindGroupLayouts[index];
          }
          return { entryPoint: descriptor.compute.entryPoint, index };
        }
      };
      pipelines.push(pipeline);
      return pipeline;
    },
    createBindGroup(descriptor) {
      bindGroups.push(descriptor);
      return descriptor;
    },
    createCommandEncoder() { return fakeEncoder(); },
    queue: {
      writeBuffer(buffer, offset, data) {
        writes.push({ buffer, offset, data: data.slice?.(0) ?? data });
      },
      submit(commands) { submissions.push(commands); },
      onSubmittedWorkDone() { return Promise.resolve(); }
    }
  };
  if (explicitLayouts) {
    device.createBindGroupLayout = (descriptor) => {
      const layout = { ...descriptor };
      bindGroupLayouts.push(layout);
      return layout;
    };
    device.createPipelineLayout = (descriptor) => {
      const layout = { ...descriptor };
      pipelineLayouts.push(layout);
      return layout;
    };
  }
  return device;
}

function submittedOwner(value) {
  const owner = {
    ownsExecution(candidate) { return candidate === value && value.released !== true; },
    isExecutionSubmitted(candidate) {
      return candidate === value && value.submitPerformed === true;
    }
  };
  Object.defineProperty(value, 'ownerRuntime', { value: owner });
  value.submitPerformed = true;
  value.released = false;
  return value;
}

function submittedFieldOwner(value) {
  const state = {
    ordinal: 0,
    encoding: SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY,
    operation: 'topology-ready',
    pending: null,
    quarantined: false,
    quarantineReason: null
  };
  const owns = (candidate) => candidate === value && value.released !== true;
  const owner = {
    ownsExecution: owns,
    isExecutionSubmitted(candidate) {
      return owns(candidate) && value.submitPerformed === true;
    },
    stateMutationState(candidate) {
      assert.equal(owns(candidate), true);
      return Object.freeze({
        ordinal: state.ordinal,
        encoding: state.encoding,
        operation: state.operation,
        pending: state.pending !== null,
        quarantined: state.quarantined
      });
    },
    reserveStateMutation(candidate, {
      expectedOrdinal,
      expectedEncoding,
      outputEncoding,
      operation,
      mutationCount = 1
    } = {}) {
      if (
        !owns(candidate)
        || state.pending !== null
        || state.quarantined
        || state.ordinal !== expectedOrdinal
        || state.encoding !== expectedEncoding
      ) {
        const error = new Error('mock mechanics field mutation is stale');
        error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_MUTATION_STALE';
        throw error;
      }
      const token = Object.freeze({
        execution: value,
        expectedOrdinal,
        outputOrdinal: expectedOrdinal + mutationCount,
        expectedEncoding,
        outputEncoding,
        mutationCount,
        operation
      });
      state.pending = token;
      return token;
    },
    isStateMutationReservationActive(candidate, token) {
      return owns(candidate)
        && state.pending === token
        && !state.quarantined
        && state.ordinal === token?.expectedOrdinal
        && state.encoding === token?.expectedEncoding;
    },
    markStateMutationSubmitted(token) {
      assert.equal(state.pending, token);
      assert.equal(state.quarantined, false);
      state.ordinal = token.outputOrdinal;
      state.encoding = token.outputEncoding;
      state.operation = token.operation;
      state.pending = null;
      return this.stateMutationState(value);
    },
    discardStateMutation(token, { discardedEncoder = false } = {}) {
      assert.equal(discardedEncoder, true);
      assert.equal(state.pending, token);
      assert.equal(state.quarantined, false);
      state.pending = null;
      return true;
    },
    quarantineStateMutation(token, {
      submissionObserved = false,
      reason = null
    } = {}) {
      assert.equal(submissionObserved, true);
      assert.equal(state.pending, token);
      assert.equal(state.quarantined, false);
      state.quarantined = true;
      state.quarantineReason = reason;
      return true;
    },
    isCurrentStateArtifact(candidate, { mutationOrdinal, stateEncoding } = {}) {
      return owns(candidate)
        && state.pending === null
        && !state.quarantined
        && state.ordinal === mutationOrdinal
        && state.encoding === stateEncoding;
    },
    setState(ordinal, encoding, operation = 'mock-submitted') {
      state.ordinal = ordinal;
      state.encoding = encoding;
      state.operation = operation;
      state.pending = null;
      state.quarantined = false;
      state.quarantineReason = null;
    }
  };
  Object.defineProperty(value, 'ownerRuntime', { value: owner });
  Object.defineProperties(value, {
    stateMutationOrdinal: {
      get() { return state.ordinal; },
      enumerable: true
    },
    stateMutationEncoding: {
      get() { return state.encoding; },
      enumerable: true
    }
  });
  value.submitPerformed = true;
  value.released = false;
  return value;
}

function exactFixture(device) {
  const fineGrid = {
    gridNodeCount: 125,
    gridDims: [5, 5, 5],
    gridShift: 0,
    gridSpacingM: Math.fround(0.25)
  };
  const coarseGrid = {
    gridNodeCount: 27,
    gridDims: [3, 3, 3],
    gridShift: 0,
    gridSpacingM: Math.fround(0.5)
  };
  const identity = {
    generationId: 3,
    deviceOrdinal: 0,
    laneOrdinal: 0,
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
    completionOrdinal: 37
  };
  const field = (selectedLevel, grid, fieldCapacity, label) => submittedFieldOwner({
    schema: ULG_SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_SCHEMA,
    status: 'schroeder-spatial-mechanics-field-view-gpu-build-submitted',
    selectedLevel,
    gridNodeCount: grid.gridNodeCount,
    gridDims: [...grid.gridDims],
    gridShift: grid.gridShift,
    gridSpacingM: grid.gridSpacingM,
    fieldCapacity,
    fieldViewBuffer: device.createBuffer({ label, size: 8192, usage: 388 }),
    ...identity
  });
  const fineFieldView = field(0, fineGrid, 4, 'fine-field');
  const coarseFieldView = field(1, coarseGrid, 3, 'coarse-field');
  const hierarchyView = submittedOwner({
    status: 'schroeder-spatial-hierarchy-view-gpu-build-submitted',
    ...identity
  });
  const plan = createSchroederSpatialParentFieldViewPlan({
    fineLevel: 0,
    coarseLevel: 1,
    fineGrid,
    coarseGrid,
    fineFieldCapacity: fineFieldView.fieldCapacity,
    coarseFieldCapacity: coarseFieldView.fieldCapacity,
    ...identity
  });
  const parentFieldViewBuffer = device.createBuffer({
    label: 'parent-field',
    size: plan.layout.byteLength,
    usage: 388
  });
  const parentFieldView = submittedOwner({
    ...plan,
    schema: ULG_SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_SCHEMA,
    status: 'schroeder-spatial-parent-field-view-gpu-build-submitted',
    mechanicsFieldViews: [fineFieldView, coarseFieldView],
    fineFieldView,
    coarseFieldView,
    hierarchyView,
    parentFieldViewBuffer,
    indirectDispatchBuffer: parentFieldViewBuffer,
    indirectDispatchOffsetBytes: 240,
    fineIndirectDispatchBuffer: parentFieldViewBuffer,
    fineIndirectDispatchOffsetBytes: 256,
    coarseIndirectDispatchBuffer: parentFieldViewBuffer,
    coarseIndirectDispatchOffsetBytes: 272
  });
  const projection = (fieldView, grid, selectedLevel) => ({
    schema: 'peercompute.ulg.mls-mpm-gpu-grid-projection-execution.v0',
    backend: 'webgpu',
    readbackMode: 'no-full-readback',
    fullReadbackPerformed: false,
    normalHotLoopReadbackFree: true,
    mechanicsFieldMode: 'required',
    mechanicsFieldViewEnabled: true,
    mechanicsFieldViewExecution: fieldView,
    mechanicsFieldViewBuffer: fieldView.fieldViewBuffer,
    mechanicsFieldViewByteLength: fieldView.fieldViewBuffer.size,
    gridStateAuthority: 'schroeder-spatial-mechanics-field-view-v1',
    denseGridAuthoritative: false,
    gridNodeCount: grid.gridNodeCount,
    gridDims: [...grid.gridDims],
    gridShift: grid.gridShift,
    gridSpacingM: grid.gridSpacingM,
    schroederLevelFilter: { selectedLevel },
    mechanicsFieldMutationInputOrdinal: 0,
    mechanicsFieldMutationOutputOrdinal: 1,
    mechanicsFieldMutationInputStateEncoding:
      SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY,
    mechanicsFieldMutationOutputStateEncoding:
      SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT
  });
  const fineProjection = projection(fineFieldView, fineGrid, 0);
  const coarseProjection = projection(coarseFieldView, coarseGrid, 1);
  fineFieldView.ownerRuntime.setState(
    1,
    SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT
  );
  coarseFieldView.ownerRuntime.setState(
    1,
    SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT
  );
  const fineGridUpdate = {
    schema: 'peercompute.ulg.mls-mpm-gpu-grid-update.v0',
    backend: 'webgpu',
    readbackMode: 'no-full-readback',
    fullReadbackPerformed: false,
    normalHotLoopReadbackFree: true,
    mechanicsFieldMode: 'required',
    mechanicsFieldViewEnabled: true,
    mechanicsFieldViewExecution: fineFieldView,
    mechanicsFieldViewBuffer: fineFieldView.fieldViewBuffer,
    mechanicsFieldViewByteLength: fineFieldView.fieldViewBuffer.size,
    gridStateAuthority: 'schroeder-spatial-mechanics-field-view-v1',
    denseGridAuthoritative: false,
    fieldStateUpdatedInPlace: true,
    gridNodeCount: fineGrid.gridNodeCount,
    gridDims: [...fineGrid.gridDims],
    gridShift: fineGrid.gridShift,
    gridSpacingM: fineGrid.gridSpacingM,
    dt: 0.005,
    gravityMPerS2: [0, -9.80665, 0],
    boxDimsM: [1, 1, 1],
    cflFactor: 0.4,
    mechanicsFieldEnergyReceipt: Object.freeze({
      schema: 'peercompute.ulg.schroeder-mechanics-field-energy-receipt.v3',
      status: 'heat-building-deferred-to-reflux-owner',
      deferSeal: true,
      fieldMutationOrdinal: 2
    }),
    mechanicsFieldMutationInputOrdinal: 1,
    mechanicsFieldMutationOutputOrdinal: 2,
    mechanicsFieldMutationInputStateEncoding:
      SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT,
    mechanicsFieldMutationOutputStateEncoding:
      SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT
  };
  Object.defineProperty(fineGridUpdate, 'sourceProjection', {
    value: fineProjection,
    enumerable: true
  });
  const coarseGridUpdate = {
    ...fineGridUpdate,
    fieldStateUpdateSubmittedInPlace: true,
    mechanicsFieldViewExecution: coarseFieldView,
    mechanicsFieldViewBuffer: coarseFieldView.fieldViewBuffer,
    mechanicsFieldViewByteLength: coarseFieldView.fieldViewBuffer.size,
    gridNodeCount: coarseGrid.gridNodeCount,
    gridDims: [...coarseGrid.gridDims],
    gridShift: coarseGrid.gridShift,
    gridSpacingM: coarseGrid.gridSpacingM,
    dt: 0.01
  };
  Object.defineProperty(coarseGridUpdate, 'sourceProjection', {
    value: coarseProjection,
    enumerable: true
  });
  const gridUpdateOriginValidator = Symbol.for(
    'peercompute.ulg.mechanics-field-grid-update-origin-validator.v0'
  );
  const registerGridUpdate = (update, sourceProjection, fieldView) => {
    const snapshot = {
      dt: update.dt,
      gravity: [...update.gravityMPerS2],
      box: [...update.boxDimsM],
      cflFactor: update.cflFactor,
      receipt: update.mechanicsFieldEnergyReceipt
    };
    Object.defineProperty(update, gridUpdateOriginValidator, {
      value: (candidateDevice, candidate, options = {}) => (
        candidateDevice === device
        && candidate === update
        && options.sourceProjection === sourceProjection
        && options.fieldExecution === fieldView
        && options.requireDeferred === true
        && update.sourceProjection === sourceProjection
        && update.mechanicsFieldViewExecution === fieldView
        && update.mechanicsFieldEnergyReceipt === snapshot.receipt
        && update.mechanicsFieldEnergyReceipt.deferSeal === true
        && Object.is(update.dt, snapshot.dt)
        && update.gravityMPerS2.every(
          (value, axis) => Object.is(value, snapshot.gravity[axis])
        )
        && update.boxDimsM.every(
          (value, axis) => Object.is(value, snapshot.box[axis])
        )
        && Object.is(update.cflFactor, snapshot.cflFactor)
      ),
      enumerable: false,
      configurable: false,
      writable: false
    });
  };
  registerGridUpdate(fineGridUpdate, fineProjection, fineFieldView);
  registerGridUpdate(coarseGridUpdate, coarseProjection, coarseFieldView);
  return {
    parentFieldView,
    fineProjection,
    coarseProjection,
    fineGridUpdate,
    coarseGridUpdate,
    commitFineGridUpdate() {
      fineFieldView.ownerRuntime.setState(
        2,
        SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT,
        'grid-velocity-update-submitted'
      );
    },
    commitCoarseGridUpdate() {
      coarseFieldView.ownerRuntime.setState(
        2,
        SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT,
        'grid-velocity-update-submitted'
      );
    },
    resetPredictorFields() {
      fineFieldView.ownerRuntime.setState(
        1,
        SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT
      );
      coarseFieldView.ownerRuntime.setState(
        1,
        SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_MOMENTUM_GRADIENT
      );
    }
  };
}

function submittedPredictorWorkspace(device, { arenaCount = 2 } = {}) {
  const fixture = exactFixture(device);
  const runtime = createSchroederSpatialParentFieldMechanicsWorkspaceGpu(device, {
    parentFieldCapacity: fixture.parentFieldView.parentFieldCapacity,
    fineFieldCapacity: fixture.parentFieldView.fineFieldCapacity,
    arenaCount
  });
  const refluxLedger = createSchroederCrossLevelRefluxLedgerGpu(device, {
    parentFieldCapacity: fixture.parentFieldView.parentFieldCapacity,
    coarseFieldCapacity: fixture.parentFieldView.coarseFieldCapacity,
    completionOrdinal: 91,
    fineSubstepCount: 1,
    fineLevel: 0,
    coarseLevel: 1,
    coarseGridSpacingM: fixture.parentFieldView.coarseFieldView.gridSpacingM
  });
  const encodeOne = () => {
    const encoder = fakeEncoder();
    const execution = runtime.encodePredictors(encoder, {
      parentFieldView: fixture.parentFieldView,
      fineP2gProjection: fixture.fineProjection,
      coarseP2gProjection: fixture.coarseProjection,
      refluxLedger,
      fineSubstepCount: 1,
      dt: 0.01,
      gravityMPerS2: [0, -9.80665, 0],
      boxDimsM: [1, 1, 1]
    });
    device.queue.submit([encoder.finish()]);
    runtime.markPredictorsSubmitted(execution);
    return execution;
  };
  return { fixture, runtime, refluxLedger, encodeOne };
}

test('parent-field mechanics ABI reserves predictors plus phase-separated causal-route proposals', () => {
  assert.equal(SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_HEADER_WORDS, 104);
  assert.equal(SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_HEADER_LAYOUT.length, 104);
  assert.equal(SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_PARAMS_BYTES, 304);
  assert.equal(SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_ROUTE_WORDS, 16);
  assert.equal(
    SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_FINE_IMPULSE_WORDS,
    16
  );
  assert.equal(
    SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_CFL_INTERVAL_WORDS,
    1
  );
  const layout = createSchroederSpatialParentFieldMechanicsWorkspaceLayout({
    parentFieldCapacity: 9
  });
  assert.equal(layout.schema, ULG_SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_SCHEMA);
  assert.equal(layout.accumulatorOffsetWords, 104);
  assert.equal(layout.baselineStateOffsetWords, 176);
  assert.equal(layout.combinedStateOffsetWords, 248);
  assert.equal(layout.coarsePredictorStateOffsetWords, 320);
  assert.equal(layout.routeProposalOffsetWords, 392);
  assert.equal(layout.fineImpulseOffsetWords, 536);
  assert.equal(layout.cflIntervalOffsetWords, 680);
  assert.equal(layout.cflIntervalWords, 1);
  assert.equal(layout.parentToCoarseOrdinalOffsetWords, 704);
  assert.equal(layout.parentToCoarseOrdinalPaddingWords, 24);
  assert.equal(
    layout.parentToCoarseOrdinalEncoding,
    SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_PARENT_TO_COARSE_ORDINAL_ENCODING
  );
  assert.equal(
    layout.parentToCoarseOrdinalEncoding,
    'zero-absent-u32-max-minus-ordinal-v1'
  );
  assert.equal(layout.workspaceBindingWordLength, 704);
  assert.equal(layout.workspaceBindingByteLength, 2816);
  assert.equal(layout.parentToCoarseOrdinalByteOffset, 2816);
  for (let parentFieldCapacity = 1; parentFieldCapacity <= 16; parentFieldCapacity += 1) {
    for (let fineFieldCapacity = 1; fineFieldCapacity <= 16; fineFieldCapacity += 1) {
      const residueLayout = createSchroederSpatialParentFieldMechanicsWorkspaceLayout({
        parentFieldCapacity,
        fineFieldCapacity
      });
      assert.ok(
        residueLayout.parentToCoarseOrdinalPaddingWords
          >= SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_CFL_INTERVAL_WORDS
      );
      assert.equal(
        residueLayout.cflIntervalOffsetWords
          + residueLayout.cflIntervalWords
          <= residueLayout.parentToCoarseOrdinalOffsetWords,
        true
      );
    }
  }
  assert.equal(layout.parentToCoarseOrdinalByteLength, 36);
  assert.equal(layout.wordLength, 713);
  assert.throws(
    () => createSchroederSpatialParentFieldMechanicsWorkspaceLayout({
      parentFieldCapacity: 0x4000_0000
    }),
    /exceeds the u32 word range/
  );
});

test('parent-field mechanics CPU oracle restricts and prolongs one transpose delta', () => {
  const oracle = buildSchroederSpatialParentFieldMechanicsCpuOracle({
    parentFieldKeys: [[0, 1, 2, 3], [1, 1, 2, 3]],
    fineEdgeOffsets: [0, 2],
    fineEdgeParentIndices: [0, 1],
    fineEdgeWeights: [0.5, 0.5],
    coarseNativeToParentField: [1],
    fineStateRows: [[2, 4, 0, 0, 0, 0, 0, 1]],
    coarseStateRows: [[2, 0, 4, 0, 0, 0, 0, 1]],
    deltaScale: 0.5
  });
  assert.deepEqual(oracle.baselineMomentum.map((row) => row.slice(0, 4)), [
    [1, 2, 0, 0],
    [1, 2, 0, 0]
  ]);
  assert.deepEqual(oracle.combinedMomentum[1].slice(0, 4), [3, 2, 4, 0]);
  assert.ok(Math.abs(oracle.fineVelocityCorrection[0][0] + 1 / 3) < 1e-12);
  assert.ok(Math.abs(oracle.fineVelocityCorrection[0][1] - 1 / 3) < 1e-12);
  assert.equal(
    oracle.internalEnergyTransferStatus,
    'nonnegative-reflux-kinetic-loss-deposited-by-transpose-g2p'
  );
  for (const residual of oracle.momentumResidual) {
    assert.ok(Math.abs(residual) < 1e-12);
  }
  assert.ok(oracle.internalEnergyDepositJ >= 0);
  assert.ok(Math.abs(oracle.totalEnergyResidualJ) < 1e-12);
});

test('parent-field mechanics rejects devices below the ten-storage-binding floor', () => {
  const device = fakeDevice();
  device.limits.maxStorageBuffersPerShaderStage = 9;
  assert.throws(
    () => createSchroederSpatialParentFieldMechanicsWorkspaceGpu(device, {
      parentFieldCapacity: 1,
      fineFieldCapacity: 1
    }),
    /requires ten storage bindings/
  );
});

test('workspace pipeline families share exact explicit layouts', () => {
  const device = fakeDevice({ explicitLayouts: true });
  const runtime = createSchroederSpatialParentFieldMechanicsWorkspaceGpu(device, {
    parentFieldCapacity: 1,
    fineFieldCapacity: 1,
    arenaCount: 1
  });
  const predictorEntryPoints = new Set([
    'initialize_parent_field_workspace',
    'begin_reflux_coarse_registry',
    'claim_reflux_coarse_registry_rows',
    'register_reflux_coarse_registry_rows',
    'seal_reflux_coarse_registry',
    'restrict_fine_field_state',
    'finalize_fine_parent_baseline',
    'inject_coarse_native_state',
    'validate_reflux_coarse_registry_mass_rows',
    'update_parent_field_predictors',
    'contact_parent_field_predictors',
    'seal_parent_field_predictors'
  ]);
  const predictorPipelines = device.pipelines.filter(({ compute }) => (
    predictorEntryPoints.has(compute.entryPoint)
  ));
  assert.equal(predictorPipelines.length, predictorEntryPoints.size);
  const [predictorPipelineLayout] = new Set(
    predictorPipelines.map(({ layout }) => layout)
  );
  assert.equal(
    predictorPipelines.every(({ layout }) => layout === predictorPipelineLayout),
    true
  );
  assert.notEqual(predictorPipelineLayout, 'auto');
  assert.deepEqual(
    predictorPipelineLayout.bindGroupLayouts[0].entries.map(
      ({ binding }) => binding
    ),
    [0, 1, 2, 3, 4, 5, 11]
  );
  const terminalEntryPoints = new Set([
    'initialize_coarse_terminal_workspace',
    'begin_coarse_terminal_registry',
    'claim_coarse_terminal_registry_rows',
    'register_coarse_terminal_registry_rows',
    'seal_coarse_terminal_registry',
    'seal_coarse_terminal_workspace',
    'begin_coarse_terminal_validation',
    'begin_coarse_velocity_publish',
    'validate_coarse_velocity_publish',
    'seal_coarse_velocity_publish',
    'prepare_coarse_transaction',
    'apply_coarse_reflux_rows',
    'apply_coarse_velocity_publish',
    'commit_coarse_reflux',
    'finalize_coarse_velocity_publish'
  ]);
  const terminalPipelines = device.pipelines.filter(({ compute }) => (
    terminalEntryPoints.has(compute.entryPoint)
  ));
  assert.equal(terminalPipelines.length, terminalEntryPoints.size);
  const [terminalPipelineLayout] = new Set(
    terminalPipelines.map(({ layout }) => layout)
  );
  assert.equal(
    terminalPipelines.every(({ layout }) => layout === terminalPipelineLayout),
    true
  );
  assert.notEqual(terminalPipelineLayout, 'auto');
  assert.deepEqual(
    terminalPipelineLayout.bindGroupLayouts[0].entries.map(
      ({ binding }) => binding
    ),
    [0, 2, 3, 4, 5, 11]
  );
  const fineEntryPoints = new Set([
    'begin_fine_velocity_correction',
    'validate_fine_velocity_correction',
    'validate_routed_coarse_cfl',
    'seal_fine_correction_alpha',
    'begin_prepare_fine_transaction',
    'project_prepare_fine_rows',
    'project_prepare_coarse_rows',
    'prepare_fine_transaction',
    'apply_fine_velocity_correction',
    'apply_fine_route_heat',
    'commit_routed_reflux_rows',
    'commit_routed_reflux',
    'finalize_fine_velocity_correction'
  ]);
  const finePipelines = device.pipelines.filter(({ compute }) => (
    fineEntryPoints.has(compute.entryPoint)
  ));
  assert.equal(finePipelines.length, fineEntryPoints.size);
  const [finePipelineLayout] = new Set(
    finePipelines.map(({ layout }) => layout)
  );
  assert.equal(
    finePipelines.every(({ layout }) => layout === finePipelineLayout),
    true
  );
  assert.notEqual(finePipelineLayout, 'auto');
  assert.deepEqual(
    finePipelineLayout.bindGroupLayouts[0].entries.map(({ binding }) => binding),
    [0, 1, 2, 3, 4, 5, 11]
  );
  const phaseAdmissionEntryPoints = new Set([
    'begin_cross_level_phase_volume_admission',
    'validate_fine_cross_level_phase_volume_admission',
    'validate_coarse_cross_level_phase_volume_admission',
    'seal_cross_level_phase_volume_admission'
  ]);
  const phaseAdmissionPipelines = device.pipelines.filter(({ compute }) => (
    phaseAdmissionEntryPoints.has(compute.entryPoint)
  ));
  assert.equal(
    phaseAdmissionPipelines.length,
    phaseAdmissionEntryPoints.size
  );
  const [phaseAdmissionPipelineLayout] = new Set(
    phaseAdmissionPipelines.map(({ layout }) => layout)
  );
  assert.equal(
    phaseAdmissionPipelines.every(
      ({ layout }) => layout === phaseAdmissionPipelineLayout
    ),
    true
  );
  assert.notEqual(phaseAdmissionPipelineLayout, 'auto');
  assert.deepEqual(
    phaseAdmissionPipelineLayout.bindGroupLayouts[0].entries.map(
      ({ binding }) => binding
    ),
    [0, 1, 2, 3, 5, 6, 7, 8, 9, 11]
  );
  assert.equal(
    device.pipelines.find(({ compute }) => (
      compute.entryPoint === 'propose_cross_level_phase_volume'
    ))?.layout,
    'auto'
  );
  assert.equal(runtime.destroy(), true);
});

test('high-N workspace splits one allocation into portable storage-binding ranges', () => {
  const device = fakeDevice();
  device.limits.maxBufferSize = 4_294_967_292;
  device.limits.maxStorageBufferBindingSize = 2_147_483_644;
  const runtime = createSchroederSpatialParentFieldMechanicsWorkspaceGpu(device, {
    parentFieldCapacity: 10_744_488,
    fineFieldCapacity: 1_193_832,
    arenaCount: 1,
    externalRefluxLedgerRequired: true
  });
  assert.ok(runtime.layout.byteLength
    > device.limits.maxStorageBufferBindingSize);
  assert.ok(runtime.layout.byteLength <= device.limits.maxBufferSize);
  assert.ok(runtime.layout.workspaceBindingByteLength
    <= device.limits.maxStorageBufferBindingSize);
  assert.ok(runtime.layout.parentToCoarseOrdinalByteLength
    <= device.limits.maxStorageBufferBindingSize);
  assert.equal(
    runtime.layout.parentToCoarseOrdinalByteOffset
      % device.limits.minStorageBufferOffsetAlignment,
    0
  );
  const workspaceBuffer = device.buffers.find(
    ({ label }) => label?.endsWith('-workspace')
  );
  assert.equal(workspaceBuffer.size, runtime.layout.byteLength);
  assert.equal(runtime.externalRefluxLedgerRequired, true);
  assert.equal(
    device.buffers.some(({ label }) => label?.endsWith('-reflux-ledger')),
    false
  );
  assert.equal(runtime.destroy(), true);
});

test('external-ledger workspace omits local fallback storage and rejects a missing ledger before encoding', () => {
  const device = fakeDevice();
  const fixture = exactFixture(device);
  const bufferCountBefore = device.buffers.length;
  const runtime = createSchroederSpatialParentFieldMechanicsWorkspaceGpu(device, {
    parentFieldCapacity: fixture.parentFieldView.parentFieldCapacity,
    fineFieldCapacity: fixture.parentFieldView.fineFieldCapacity,
    arenaCount: 1,
    externalRefluxLedgerRequired: true
  });
  const arenaBuffers = device.buffers.slice(bufferCountBefore);
  assert.equal(arenaBuffers.length, 5);
  assert.equal(
    arenaBuffers.some(({ label }) => label?.endsWith('-reflux-ledger')),
    false
  );
  assert.equal(runtime.allocationEntries().length, 5);
  assert.equal(
    runtime.retainedGpuBufferBytes,
    arenaBuffers.reduce((sum, buffer) => sum + buffer.size, 0)
  );
  const encoder = fakeEncoder();
  assert.throws(
    () => runtime.encodePredictors(encoder, {
      parentFieldView: fixture.parentFieldView,
      fineP2gProjection: fixture.fineProjection,
      coarseP2gProjection: fixture.coarseProjection,
      dt: 0.01,
      gravityMPerS2: [0, -9.80665, 0],
      boxDimsM: [1, 1, 1]
    }),
    /external-ledger runtime requires one live reflux ledger/
  );
  assert.deepEqual(encoder.events, []);
  assert.equal(runtime.activeExecutionCount(), 0);
  assert.equal(runtime.destroy(), true);
});

test('direct external-ledger cache evicts inactive capacity variants by retained bytes', () => {
  const device = fakeDevice();
  device.limits.maxBufferSize = 5_000;
  const first = directSchroederSpatialParentFieldMechanicsWorkspaceGpu(device, {
    parentFieldCapacity: 9,
    fineFieldCapacity: 9,
    arenaCount: 1,
    externalRefluxLedgerRequired: true
  });
  assert.equal(
    first.status,
    'schroeder-spatial-parent-field-mechanics-workspace-gpu-runtime-ready'
  );
  const second = directSchroederSpatialParentFieldMechanicsWorkspaceGpu(device, {
    parentFieldCapacity: 10,
    fineFieldCapacity: 10,
    arenaCount: 1,
    externalRefluxLedgerRequired: true
  });
  assert.equal(
    first.status,
    'schroeder-spatial-parent-field-mechanics-workspace-gpu-runtime-destroyed'
  );
  assert.equal(
    second.status,
    'schroeder-spatial-parent-field-mechanics-workspace-gpu-runtime-ready'
  );
  assert.ok(second.retainedGpuBufferBytes <= device.limits.maxBufferSize);
  assert.equal(second.destroy(), true);
});

test('timestamp-capable direct runtimes are cached by exact recorder identity', () => {
  const device = fakeDevice();
  const recorderA = {
    active: true,
    encoderSpansSupported: true,
    beginEncoderSpan() {},
    endEncoderSpan() {}
  };
  const recorderB = {
    active: true,
    encoderSpansSupported: true,
    beginEncoderSpan() {},
    endEncoderSpan() {}
  };
  const options = {
    parentFieldCapacity: 8,
    fineFieldCapacity: 8,
    arenaCount: 1,
    externalRefluxLedgerRequired: true
  };
  const first = directSchroederSpatialParentFieldMechanicsWorkspaceGpu(device, {
    ...options,
    gpuTimestampRecorder: recorderA
  });
  const sameRecorder =
    directSchroederSpatialParentFieldMechanicsWorkspaceGpu(device, {
      ...options,
      gpuTimestampRecorder: recorderA
    });
  const second = directSchroederSpatialParentFieldMechanicsWorkspaceGpu(device, {
    ...options,
    gpuTimestampRecorder: recorderB
  });

  assert.equal(sameRecorder, first);
  assert.notEqual(second, first);
  assert.equal(first.destroy(), true);
  assert.equal(second.destroy(), true);
});

test('queue-only timing preserves grouped workspace topology while encoder spans split it', async () => {
  const encodePredictorsWithRecorder = async (gpuTimestampRecorder) => {
    const device = fakeDevice();
    const fixture = exactFixture(device);
    const runtime = createSchroederSpatialParentFieldMechanicsWorkspaceGpu(device, {
      parentFieldCapacity: fixture.parentFieldView.parentFieldCapacity,
      fineFieldCapacity: fixture.parentFieldView.fineFieldCapacity,
      arenaCount: 1,
      gpuTimestampRecorder
    });
    const encoder = fakeEncoder();
    const execution = runtime.encodePredictors(encoder, {
      parentFieldView: fixture.parentFieldView,
      fineP2gProjection: fixture.fineProjection,
      coarseP2gProjection: fixture.coarseProjection,
      fineSubstepCount: 1,
      dt: 0.01,
      gravityMPerS2: [0, -9.80665, 0],
      boxDimsM: [1, 1, 1]
    });
    device.queue.submit([encoder.finish()]);
    runtime.markPredictorsSubmitted(execution);
    await runtime.releaseExecutionAfter(execution, Promise.resolve());
    runtime.destroy();
    return { encoder, execution };
  };

  const queueSpanCalls = [];
  const queueOnly = await encodePredictorsWithRecorder({
    active: true,
    encoderSpansSupported: false,
    beginEncoderSpan(...args) {
      queueSpanCalls.push(['begin', ...args]);
      return null;
    },
    endEncoderSpan(...args) {
      queueSpanCalls.push(['end', ...args]);
    }
  });
  assert.equal(
    queueOnly.encoder.events.filter((event) => event.kind === 'pass').length,
    1
  );
  assert.equal(queueOnly.execution.encodedComputePassCount, 1);
  assert.deepEqual(queueSpanCalls, []);

  const encoderSpanCalls = [];
  const encoderSpans = await encodePredictorsWithRecorder({
    active: true,
    encoderSpansSupported: true,
    beginEncoderSpan(_encoder, descriptor) {
      encoderSpanCalls.push(['begin', descriptor.stage]);
      return descriptor.stage;
    },
    endEncoderSpan(_encoder, span) {
      encoderSpanCalls.push(['end', span]);
    }
  });
  assert.equal(
    encoderSpans.encoder.events.filter((event) => event.kind === 'pass').length,
    12
  );
  assert.equal(encoderSpans.execution.encodedComputePassCount, 12);
  assert.equal(
    encoderSpanCalls.filter(([kind]) => kind === 'begin').length,
    12
  );
  assert.equal(
    encoderSpanCalls.filter(([kind]) => kind === 'end').length,
    12
  );
});

test('workspace WGSL has frozen coarse registry, causal affine routes, and sealed energy evidence', () => {
  assert.match(schroederSpatialParentFieldMechanicsWorkspaceWgsl, /fn begin_fine_velocity_correction/);
  assert.match(
    schroederSpatialParentFieldMechanicsWorkspaceWgsl,
    /@compute @workgroup_size\(64\)\s+fn commit_routed_reflux_rows/
  );
  assert.match(
    schroederSpatialParentFieldMechanicsWorkspaceWgsl,
    /fn commit_routed_reflux\(\)[\s\S]*fine_commit_scalar_load\(0u\)[\s\S]*fine_commit_scalar_load\(2u\)/
  );
  const commitSource = schroederSpatialParentFieldMechanicsWorkspaceWgsl.slice(
    schroederSpatialParentFieldMechanicsWorkspaceWgsl.indexOf(
      'fn commit_routed_reflux()'
    ),
    schroederSpatialParentFieldMechanicsWorkspaceWgsl.indexOf(
      'fn finalize_fine_velocity_correction()'
    )
  );
  assert.match(
    commitSource,
    /reflux_store\(128u, fine_commit_scalar_load\(0u\)\)/
  );
  assert.match(
    commitSource,
    /reflux_store\(130u, fine_commit_scalar_load\(1u\)\)/
  );
  assert.match(
    commitSource,
    /reflux_store\(131u, fine_commit_scalar_load\(2u\)\)/
  );
  assert.doesNotMatch(
    commitSource,
    /bitcast<f32>\(reflux_load\((?:128|130|131)u\)\)/
  );
  assert.match(
    schroederSpatialParentFieldMechanicsWorkspaceWgsl,
    /fn finalize_fine_velocity_correction\(\)[\s\S]*fine_commit_scalar_load\(3u\)/
  );
  assert.match(schroederSpatialParentFieldMechanicsWorkspaceWgsl, /fine_store\(59u, FIELD_EMPTY\)/);
  assert.match(schroederSpatialParentFieldMechanicsWorkspaceWgsl, /fine_store\(59u, FIELD_VELOCITY\)/);
  assert.match(schroederSpatialParentFieldMechanicsWorkspaceWgsl, /range_fits/);
  assert.match(
    schroederSpatialParentFieldMechanicsWorkspaceWgsl,
    /fn register_reflux_coarse_registry_rows/
  );
  assert.doesNotMatch(
    schroederSpatialParentFieldMechanicsWorkspaceWgsl,
    /reflux_load\(60u\) != params\.generation_id/
  );
  assert.equal(
    [...schroederSpatialParentFieldMechanicsWorkspaceWgsl.matchAll(
      /reflux_store\(60u, params\.generation_id\)/g
    )].length,
    1
  );
  assert.match(schroederSpatialParentFieldMechanicsWorkspaceWgsl, /fn evaluate_causal_route/);
  assert.match(schroederSpatialParentFieldMechanicsWorkspaceWgsl, /fn scatter_causal_route_proposal/);
  assert.match(schroederSpatialParentFieldMechanicsWorkspaceWgsl, /fn seal_fine_correction_alpha/);
  assert.match(
    schroederSpatialParentFieldMechanicsWorkspaceWgsl,
    /let sealed_causal_impulse = impulse - phase_impulse[\s\S]*ws_atomic_add_f32\(\s*80u, dot\(prior, sealed_causal_impulse\)[\s\S]*ws_atomic_add_f32\(\s*84u, dot\(phase_impulse \/ mass, sealed_causal_impulse\)/
  );
  assert.match(
    schroederSpatialParentFieldMechanicsWorkspaceWgsl,
    /let causal_impulse = proposal - phase_impulse[\s\S]*ws_atomic_add_f32\(\s*82u, dot\(prior, causal_impulse\)[\s\S]*ws_atomic_add_f32\(\s*84u, dot\(phase_impulse \/ mass, causal_impulse\)/
  );
  const fineCorrectionSealSource =
    schroederSpatialParentFieldMechanicsWorkspaceWgsl
      .split('fn seal_fine_correction_alpha() {')[1]
      .split('@compute')[0];
  assert.doesNotMatch(fineCorrectionSealSource, /\bfor\s*\(/);
  assert.match(
    fineCorrectionSealSource,
    /bitcast<f32>\(ws_load\(80u\)\) \+ bitcast<f32>\(ws_load\(82u\)\)/
  );
  assert.match(
    schroederSpatialParentFieldMechanicsWorkspaceWgsl,
    /causal_alpha = clamp\(\s*-causal_linear \/ causal_quadratic/
  );
  assert.match(
    fineCorrectionSealSource,
    /let causal_linear = cfl_alpha_limit \* \(\s*raw_causal_linear \+ cfl_alpha_limit \* phase_causal_cross\s*\)/
  );
  assert.match(
    fineCorrectionSealSource,
    /let causal_quadratic = route_alpha_squared \* raw_causal_quadratic/
  );
  assert.match(
    schroederSpatialParentFieldMechanicsWorkspaceWgsl,
    /let pressure_impulse = route_cfl_alpha \* raw_pressure_impulse;\s*let drag_impulse = route_cfl_alpha \* raw_drag_impulse;\s*let causal_impulse = route_cfl_alpha \* causal_alpha \* \(\s*impulse - raw_pressure_impulse - raw_drag_impulse\s*\);\s*let applied = pressure_impulse \+ drag_impulse \+ causal_impulse/
  );
  assert.match(
    schroederSpatialParentFieldMechanicsWorkspaceWgsl,
    /let pressure_impulse = route_cfl_alpha \* raw_pressure_impulse;\s*let drag_impulse = route_cfl_alpha \* raw_drag_impulse;\s*let causal_impulse = route_cfl_alpha \* causal_alpha \* \(\s*proposal - raw_pressure_impulse - raw_drag_impulse\s*\);\s*let applied = pressure_impulse \+ drag_impulse \+ causal_impulse/
  );
  assert.match(
    schroederSpatialParentFieldMechanicsWorkspaceWgsl,
    /ws_store\(84u, bitcast<u32>\(cfl_alpha_limit\)\);\s*ws_store\(85u, bitcast<u32>\(causal_alpha\)\)/
  );
  assert.doesNotMatch(
    schroederSpatialParentFieldMechanicsWorkspaceWgsl,
    /dot\((?:impulse|proposal), (?:impulse|proposal)\) > 1\.0e-24 && alpha_limit <= 0\.0/
  );
  assert.match(
    schroederSpatialParentFieldMechanicsWorkspaceWgsl,
    /let applied_velocity_delta = applied \/ mass;[\s\S]*velocity_delta_within_ceiling\([\s\S]*params\.max_correction_m_per_s[\s\S]*STATUS_CFL_REJECTED/
  );
  const predictorStateSource =
    schroederSpatialParentFieldMechanicsWorkspaceWgsl
      .split(
        'fn update_predictor_state(base: u32, node: vec3<f32>, predictor_dt: f32) {'
      )[1]
      .split('\n}')[0];
  assert.match(
    predictorStateSource,
    /params\.cfl_factor \* params\.coarse_spacing_m\s*\/ max\(params\.macro_dt, 1\.0e-12\)/
  );
  assert.doesNotMatch(
    predictorStateSource,
    /params\.coarse_spacing_m\s*\/ max\(params\.dt, 1\.0e-12\)/
  );
  assert.match(
    predictorStateSource,
    /vec3<f32>\(params\.gravity_x, params\.gravity_y, params\.gravity_z\)\s*\* predictor_dt/
  );
  assert.doesNotMatch(
    predictorStateSource,
    /vec3<f32>\(params\.gravity_x, params\.gravity_y, params\.gravity_z\)\s*\* params\.macro_dt/
  );
  assert.match(schroederSpatialParentFieldMechanicsWorkspaceWgsl, /fn prepare_fine_transaction/);
  for (const entryPoint of [
    'begin_cross_level_phase_volume_admission',
    'validate_fine_cross_level_phase_volume_admission',
    'validate_coarse_cross_level_phase_volume_admission',
    'seal_cross_level_phase_volume_admission'
  ]) {
    assert.match(
      schroederSpatialParentFieldMechanicsWorkspaceWgsl,
      new RegExp(`fn ${entryPoint}`)
    );
  }
  assert.match(
    schroederSpatialParentFieldMechanicsWorkspaceWgsl,
    /fn propose_cross_level_phase_volume/
  );
  assert.match(
    schroederSpatialParentFieldMechanicsWorkspaceWgsl,
    /fine_impulse_row \+ 8u/
  );
  assert.match(
    schroederSpatialParentFieldMechanicsWorkspaceWgsl,
    /proposal_base \+ 14u/
  );
  assert.match(
    schroederSpatialParentFieldMechanicsWorkspaceWgsl,
    /fn commit_routed_reflux\(\)[\s\S]*reflux_store\(10u, reflux_load\(10u\) \+ 1u\)[\s\S]*reflux_store\(8u, ordinal \+ 1u\)/
  );
  assert.match(schroederSpatialParentFieldMechanicsWorkspaceWgsl, /fn seal_coarse_velocity_publish/);
  assert.match(
    schroederSpatialParentFieldMechanicsWorkspaceWgsl,
    /let synchronization_work = actual_coarse_energy - virtual_coarse_energy/
  );
  assert.match(
    schroederSpatialParentFieldMechanicsWorkspaceWgsl,
    /let causal_route_heat = max\(0\.0, -causal_kinetic_residual\)/
  );
  assert.match(
    schroederSpatialParentFieldMechanicsWorkspaceWgsl,
    /fine_cross_level_pressure_compensation\s+\+ coarse_cross_level_pressure_compensation/
  );
  assert.match(
    schroederSpatialParentFieldMechanicsWorkspaceWgsl,
    /let total_energy_residual = actual_kinetic_residual \+ total_route_heat\s+- synchronization_work/
  );
  assert.match(
    schroederSpatialParentFieldMechanicsWorkspaceWgsl,
    /reflux_store\(126u, fine_stage_load\(24u\)\)/
  );
  assert.match(
    schroederSpatialParentFieldMechanicsWorkspaceWgsl,
    /reflux_store\(127u, fine_stage_load\(25u\)\)/
  );
  for (const word of [128, 129, 130, 131, 132, 133, 134, 135]) {
    assert.match(
      schroederSpatialParentFieldMechanicsWorkspaceWgsl,
      new RegExp(`reflux_store\\(\\s*${word}u,`)
    );
  }
  assert.match(
    schroederSpatialParentFieldMechanicsWorkspaceWgsl,
    /let share = drag_share \+ causal_share/
  );
  assert.match(
    schroederSpatialParentFieldMechanicsWorkspaceWgsl,
    /share < drag_share/
  );
  const fineCommitSource =
    schroederSpatialParentFieldMechanicsWorkspaceWgsl.slice(
      schroederSpatialParentFieldMechanicsWorkspaceWgsl.indexOf(
        'fn commit_routed_reflux()'
      ),
      schroederSpatialParentFieldMechanicsWorkspaceWgsl.indexOf(
        'fn finalize_fine_velocity_correction()'
      )
    );
  const coarseCommitSource =
    schroederSpatialParentFieldMechanicsWorkspaceWgsl.slice(
      schroederSpatialParentFieldMechanicsWorkspaceWgsl.indexOf(
        'fn commit_coarse_reflux()'
      ),
      schroederSpatialParentFieldMechanicsWorkspaceWgsl.indexOf(
        'fn apply_coarse_reflux_rows'
      )
    );
  for (const [offset, word] of [
    [8, 132],
    [9, 133],
    [10, 134],
    [11, 135]
  ]) {
    assert.match(
      fineCommitSource,
      new RegExp(
        `reflux_store\\(${word}u, ws_load\\(params\\.route_proposal_offset \\+ ${offset}u\\)\\)`
      )
    );
    assert.match(
      coarseCommitSource,
      new RegExp(
        `reflux_store\\(${word}u, ws_load\\(params\\.route_proposal_offset \\+ ${offset}u\\)\\)`
      )
    );
  }
  assert.doesNotMatch(fineCommitSource, /reflux_load\(13[2-5]u\)\s*\+/);
  assert.doesNotMatch(coarseCommitSource, /reflux_load\(13[2-5]u\)\s*\+/);
  assert.match(
    schroederSpatialParentFieldMechanicsWorkspaceWgsl,
    /reflux_store\(row \+ 16u, ws_load\(proposal \+ 14u\)\)/
  );
  assert.match(
    schroederSpatialParentFieldMechanicsWorkspaceWgsl,
    /reflux_store\(row \+ 17u, ws_load\(proposal \+ 15u\)\)/
  );
  assert.match(
    schroederSpatialParentFieldMechanicsWorkspaceWgsl,
    /coarse_store\(accumulator \+ 3u, ws_load\(proposal \+ 14u\)\)/
  );
  assert.doesNotMatch(
    schroederSpatialParentFieldMechanicsWorkspaceWgsl,
    /physical_route_heat = max\(0\.0, -kinetic_residual\)/
  );
  assert.doesNotMatch(schroederSpatialParentFieldMechanicsWorkspaceWgsl, /reflux_find|reflux_hash/);
  assert.match(schroederSpatialParentFieldMechanicsWorkspaceWgsl, /coarse_state_offset/);
  assert.ok(
    [...schroederSpatialParentFieldMechanicsWorkspaceWgsl.matchAll(
      /loop \{[\s\S]*?atomicCompareExchangeWeak[\s\S]*?claimed\.old_value[\s\S]*?\n  \}/g
    )].length >= 2
  );
  assert.equal(SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_INTERNAL_ENERGY_REFLUX_DEPOSIT, 2);
  assert.equal(SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_REFLUX_MEASURED_CONSERVATIVE, 2);
});

test('workspace temporal coarse sidecar is authenticated, recycled, and predictor-only', () => {
  const source = schroederSpatialParentFieldMechanicsWorkspaceWgsl;
  const between = (start, end) => {
    const startIndex = source.indexOf(start);
    const endIndex = source.indexOf(end, startIndex + start.length);
    assert.notEqual(startIndex, -1);
    assert.notEqual(endIndex, -1);
    return source.slice(startIndex, endIndex);
  };
  const receiptSource = between(
    'fn temporal_coarse_receipts_admitted()',
    'fn workspace_admitted('
  );
  assert.match(
    receiptSource,
    /fine_load\(fine_receipt \+ 13u\) != 0u[\s\S]*fine_load\(fine_receipt \+ 14u\) != 0u[\s\S]*fine_load\(fine_receipt \+ 15u\) != 0u/
  );
  assert.match(
    receiptSource,
    /coarse_load\(coarse_receipt \+ 13u\) == FIELD_TEMPORAL_COARSE_MAGIC[\s\S]*coarse_load\(coarse_receipt \+ 14u\)[\s\S]*bitcast<u32>\(params\.temporal_coarse_successor_dt\)[\s\S]*coarse_load\(coarse_receipt \+ 15u\)[\s\S]*coarse_temporal_receipt_seal\(\)/
  );
  const finalizeSource = between(
    'fn finalize_fine_parent_baseline(',
    'fn inject_coarse_native_state('
  );
  assert.ok(
    finalizeSource.indexOf('state_store(baseline, word, value)')
      < finalizeSource.indexOf('ws_store(accumulator + word, 0u)'),
    'the fixed-point restriction bank must be materialized before recycling'
  );
  assert.match(
    finalizeSource,
    /for \(var word = 0u; word < ROW_WORDS; word = word \+ 1u\) \{\s*ws_store\(accumulator \+ word, 0u\)/
  );
  const injectSource = between(
    'fn inject_coarse_native_state(',
    'fn parent_node_position('
  );
  assert.match(
    injectSource,
    /let temporal_source = coarse_load\(28u\)\s*\+ coarse_field \* FIELD_ACCUMULATOR_WORDS/
  );
  assert.match(
    injectSource,
    /for \(var word = 0u; word < ROW_WORDS; word = word \+ 1u\) \{\s*if \(ws_load\(temporal_state \+ word\) != 0u\)/
  );
  assert.match(
    injectSource,
    /state_store\(temporal_state, 0u, source_values\[0\]\)[\s\S]*state_store\(temporal_state, 1u, temporal_momentum\.x\)[\s\S]*state_store\(temporal_state, 4u, source_values\[4\]\)/
  );
  const updateSource = between(
    'fn update_predictor_state(',
    'fn velocity('
  );
  assert.match(updateSource, /\* predictor_dt/);
  assert.match(
    updateSource,
    /params\.cfl_factor \* params\.coarse_spacing_m\s*\/ max\(params\.macro_dt, 1\.0e-12\)/
  );
  assert.match(updateSource, /wall_correct\([\s\S]*predictor_dt/);
  assert.match(
    updateSource,
    /params\.accumulator_offset \+ parent \* ROW_WORDS,[\s\S]*params\.temporal_coarse_successor_dt/
  );
  const contactSource = between(
    'fn contact_parent_field_predictors(',
    'fn seal_parent_field_predictors()'
  );
  assert.match(
    contactSource,
    /contact_pair\(params\.accumulator_offset, left, right, false\)/
  );
  const sealSource = between(
    'fn seal_parent_field_predictors()',
    'fn seal_coarse_terminal_workspace()'
  );
  assert.match(
    sealSource,
    /if \(!temporal_coarse_receipts_admitted\(\)\) \{\s*ws_reject\(STATUS_INVALID_SOURCE, 37u\)/
  );
  const fineValidatorSource = between(
    'fn validate_fine_velocity_correction(',
    '@compute @workgroup_size(64)\nfn validate_routed_coarse_cfl('
  );
  assert.doesNotMatch(fineValidatorSource, /temporal_coarse|successor_state/);
});

test('reflux registries use deterministic parallel claims and fail-closed coverage', () => {
  const source = schroederSpatialParentFieldMechanicsWorkspaceWgsl;
  const between = (start, end) => {
    const startIndex = source.indexOf(start);
    const endIndex = source.indexOf(end, startIndex + start.length);
    assert.notEqual(startIndex, -1, `missing ${start}`);
    assert.notEqual(endIndex, -1, `missing ${end}`);
    return source.slice(startIndex, endIndex);
  };
  const entrySource = (entryPoint) => {
    const functionBegin = source.indexOf(`fn ${entryPoint}(`);
    assert.notEqual(functionBegin, -1, `missing ${entryPoint}`);
    const begin = source.lastIndexOf('@compute', functionBegin);
    const end = source.indexOf('@compute', functionBegin + entryPoint.length);
    return source.slice(begin, end === -1 ? source.length : end);
  };

  const reverseMapSource = between(
    'fn parent_to_coarse_load(',
    'fn finite_f32('
  );
  assert.match(
    reverseMapSource,
    /select\(INVALID_INDEX, INVALID_INDEX - encoded, encoded != 0u\)/
  );
  assert.match(
    reverseMapSource,
    /select\(0u, INVALID_INDEX - value, value != INVALID_INDEX\)/
  );
  assert.doesNotMatch(
    source,
    /parent_to_coarse_store\(parent, INVALID_INDEX\)/
  );

  const beginSource = between('fn begin_registry(', 'fn record_registry_workgroup_coverage(');
  assert.match(beginSource, /registry_scratch_fits\(\)/);
  assert.match(
    beginSource,
    /params\.fine_substep_ordinal <= params\.fine_substep_count[\s\S]*params\.fine_substep_ordinal == params\.fine_substep_count[\s\S]*terminal/
  );
  assert.match(
    beginSource,
    /ws_load\(66u\) == parent_view\[68u\][\s\S]*ws_load\(68u\) == parent_view\[70u\]/
  );
  assert.match(
    beginSource,
    /REGISTRY_CLAIM_COVERAGE_WORD, 0u[\s\S]*REGISTRY_ROW_COVERAGE_WORD, 0u/
  );
  assert.ok(
    beginSource.lastIndexOf('REGISTRY_TOKEN_WORD')
      > beginSource.lastIndexOf('REGISTRY_ROW_COVERAGE_WORD'),
    'registry token must publish after both coverage counters initialize'
  );

  const claimSource = between('fn claim_registry_rows(', 'fn register_registry_rows(');
  assert.match(claimSource, /registry_coarse_dispatch_matches\(workgroup_count\)/);
  assert.match(claimSource, /REGISTRY_CLAIM_COVERAGE_WORD/);
  assert.match(
    claimSource,
    /atomicMax\(\s*&parent_to_coarse_ordinals\[parent\],\s*INVALID_INDEX - coarse_field/
  );
  assert.doesNotMatch(claimSource, /ws_reject\(|reflux_reject\(/);
  const coverageSource = between(
    'fn record_registry_workgroup_coverage(',
    'fn claim_registry_rows('
  );
  assert.match(coverageSource, /local_id\.x != 0u/);
  assert.match(
    coverageSource,
    /min\(64u, ws_load\(22u\) - coarse_field\)/
  );

  const rowSource = between('fn register_registry_rows(', 'fn seal_registry(');
  assert.match(rowSource, /REGISTRY_ROW_COVERAGE_WORD/);
  assert.match(
    rowSource,
    /parent_to_coarse_load\(parent\) != coarse_field[\s\S]*terminal && reflux_load\(row \+ 14u\) != 1u/
  );
  assert.match(
    rowSource,
    /REGISTRY_FROZEN_KEY_FAILURE_WORD[\s\S]*for \(var word = 4u; word < REFLUX_ROW_WORDS/
  );
  assert.doesNotMatch(rowSource, /ws_reject\(|reflux_reject\(/);

  const sealSource = between('fn seal_registry(', '@compute @workgroup_size(1)\nfn begin_reflux_coarse_registry');
  assert.match(
    sealSource,
    /REGISTRY_CLAIM_COVERAGE_WORD\) != coarse_count[\s\S]*REGISTRY_ROW_COVERAGE_WORD\) != coarse_count/
  );
  assert.match(sealSource, /if \(!terminal && frozen_key < structural\)/);
  assert.match(sealSource, /atomicAdd\(&reflux_ledger\[13u\], 1u\)/);
  assert.ok(
    sealSource.indexOf('first_failure')
      < sealSource.indexOf('reflux_store(60u, params.generation_id)'),
    'registry generation may publish only after deterministic failure sealing'
  );
  assert.doesNotMatch(sealSource, /\bfor\s*\(|\bloop\s*\{/);

  for (const entryPoint of [
    'claim_reflux_coarse_registry_rows',
    'register_reflux_coarse_registry_rows',
    'claim_coarse_terminal_registry_rows',
    'register_coarse_terminal_registry_rows',
    'validate_reflux_coarse_registry_mass_rows'
  ]) {
    const rowEntrySource = entrySource(entryPoint);
    assert.match(rowEntrySource, /@compute @workgroup_size\(64\)/);
    assert.match(
      rowEntrySource,
      /@builtin\(num_workgroups\) workgroup_count: vec3<u32>/
    );
  }
  for (const entryPoint of [
    'begin_reflux_coarse_registry',
    'seal_reflux_coarse_registry',
    'begin_coarse_terminal_registry',
    'seal_coarse_terminal_registry'
  ]) {
    assert.match(entrySource(entryPoint), /@compute @workgroup_size\(1\)/);
  }

  const massRejectSource = between(
    'fn reject_reflux_registry_mass_once()',
    '@compute @workgroup_size(64)\nfn validate_reflux_coarse_registry_mass_rows'
  );
  assert.match(massRejectSource, /atomicExchange\(&workspace\[87u\], 1u\)/);
  assert.doesNotMatch(massRejectSource, /ws_reject\(/);
  const massSource = entrySource('validate_reflux_coarse_registry_mass_rows');
  assert.match(massSource, /reject_reflux_registry_mass_once\(\)/);
  assert.doesNotMatch(massSource, /\bfor\s*\(|\bloop\s*\{|ws_reject\(/);
});

test('workspace indirect parent-field kernels flatten two-dimensional dispatch rows', () => {
  assert.match(
    schroederSpatialParentFieldMechanicsWorkspaceWgsl,
    /fn indirect_row_index\(\s*id: vec3<u32>,\s*workgroup_count: vec3<u32>\s*\) -> u32 \{\s*return id\.x \+ id\.y \* workgroup_count\.x \* 64u;\s*\}/
  );
  const indirectEntryPoints = [
    'claim_reflux_coarse_registry_rows',
    'register_reflux_coarse_registry_rows',
    'claim_coarse_terminal_registry_rows',
    'register_coarse_terminal_registry_rows',
    'validate_reflux_coarse_registry_mass_rows',
    'restrict_fine_field_state',
    'finalize_fine_parent_baseline',
    'inject_coarse_native_state',
    'update_parent_field_predictors',
    'contact_parent_field_predictors',
    'validate_fine_cross_level_phase_volume_admission',
    'validate_coarse_cross_level_phase_volume_admission',
    'propose_cross_level_phase_volume',
    'validate_fine_velocity_correction',
    'validate_routed_coarse_cfl',
    'project_prepare_fine_rows',
    'project_prepare_coarse_rows',
    'commit_routed_reflux_rows',
    'apply_fine_route_heat',
    'apply_fine_velocity_correction',
    'validate_coarse_velocity_publish',
    'apply_coarse_reflux_rows',
    'apply_coarse_velocity_publish'
  ];
  for (const entryPoint of indirectEntryPoints) {
    const begin = schroederSpatialParentFieldMechanicsWorkspaceWgsl.indexOf(
      `fn ${entryPoint}(`
    );
    assert.notEqual(begin, -1, `missing ${entryPoint}`);
    const nextEntryPoint = schroederSpatialParentFieldMechanicsWorkspaceWgsl.indexOf(
      '@compute',
      begin + entryPoint.length + 3
    );
    const source = schroederSpatialParentFieldMechanicsWorkspaceWgsl.slice(
      begin,
      nextEntryPoint === -1
        ? schroederSpatialParentFieldMechanicsWorkspaceWgsl.length
        : nextEntryPoint
    );
    assert.match(
      source,
      /@builtin\(num_workgroups\)\s+workgroup_count: vec3<u32>/,
      `${entryPoint} must observe the encoded indirect dispatch shape`
    );
    assert.match(
      source,
      /let \w+ = indirect_row_index\(id, workgroup_count\);/,
      `${entryPoint} must flatten x/y invocation coordinates`
    );
    assert.doesNotMatch(
      source,
      /let \w+ = id\.x;/,
      `${entryPoint} must not alias rows from later y workgroups`
    );
  }
  assert.equal(
    [...schroederSpatialParentFieldMechanicsWorkspaceWgsl.matchAll(
      /indirect_row_index\(id, workgroup_count\)/g
    )].length,
    indirectEntryPoints.length
  );
});

test('phase-volume admission validates rows in parallel and seals deterministic precedence', () => {
  const source = schroederSpatialParentFieldMechanicsWorkspaceWgsl;
  const entrySource = (entryPoint) => {
    const functionBegin = source.indexOf(`fn ${entryPoint}(`);
    assert.notEqual(functionBegin, -1, `missing ${entryPoint}`);
    const begin = source.lastIndexOf('@compute', functionBegin);
    const end = source.indexOf('@compute', functionBegin + entryPoint.length);
    return source.slice(begin, end === -1 ? source.length : end);
  };
  const beginSource = entrySource(
    'begin_cross_level_phase_volume_admission'
  );
  const fineSource = entrySource(
    'validate_fine_cross_level_phase_volume_admission'
  );
  const coarseSource = entrySource(
    'validate_coarse_cross_level_phase_volume_admission'
  );
  const sealSource = entrySource(
    'seal_cross_level_phase_volume_admission'
  );

  assert.match(beginSource, /@compute @workgroup_size\(1\)/);
  assert.equal([...beginSource.matchAll(/INVALID_INDEX/g)].length, 6);
  assert.ok(
    beginSource.indexOf('PHASE_ADMISSION_TOKEN_WORD')
      > beginSource.lastIndexOf('INVALID_INDEX'),
    'the admission token must publish after all six minima initialize'
  );
  for (const validatorSource of [fineSource, coarseSource]) {
    assert.match(validatorSource, /@compute @workgroup_size\(64\)/);
    assert.equal([...validatorSource.matchAll(/atomicMin\(/g)].length, 3);
    assert.doesNotMatch(
      validatorSource,
      /ws_reject\(|reflux_reject\(|reject_pressure_authority\(|atomicAdd\(|atomicOr\(|ws_store\(|phase_admission_store\(/
    );
  }
  assert.match(
    fineSource,
    /phase_route_admitted\(fine_field\)[\s\S]*fine_phase_moment_valid\(fine_field\)[\s\S]*fine_pressure_row_valid\(fine_field\)/
  );
  assert.match(
    coarseSource,
    /parent_to_coarse_load\(parent\)[\s\S]*coarse_phase_moment_valid\(coarse_field, parent\)[\s\S]*coarse_pressure_row_valid\(coarse_field, parent\)/
  );
  assert.match(sealSource, /@compute @workgroup_size\(1\)/);
  assert.doesNotMatch(sealSource, /\bfor\s*\(|\bloop\s*\{/);
  assert.ok(
    sealSource.indexOf('first_fine_failure')
      < sealSource.indexOf('first_coarse_failure'),
    'every fine failure must retain precedence over every coarse failure'
  );
  assert.match(
    sealSource,
    /fine_route == first_fine_failure[\s\S]*fine_moment == first_fine_failure[\s\S]*reject_pressure_authority\(\)/
  );
  assert.match(
    sealSource,
    /coarse_registry == first_coarse_failure[\s\S]*coarse_moment == first_coarse_failure[\s\S]*reject_pressure_authority\(\)/
  );
  assert.match(
    sealSource,
    /atomicOr\([\s\S]*FIELD_PRESSURE_CONSUMER_CROSS_LEVEL/
  );
  assert.match(
    source,
    /fn phase_admission_scratch_fits\(\)[\s\S]*params\.baseline_offset[\s\S]*PHASE_ADMISSION_SCRATCH_WORDS/
  );
});

test('fine transaction projects rows in parallel before one canonical seal', () => {
  const source = schroederSpatialParentFieldMechanicsWorkspaceWgsl;
  const entrySource = (entryPoint) => {
    const functionBegin = source.indexOf(`fn ${entryPoint}(`);
    assert.notEqual(functionBegin, -1, `missing ${entryPoint}`);
    const begin = source.lastIndexOf('@compute', functionBegin);
    const end = source.indexOf('@compute', functionBegin + entryPoint.length);
    return source.slice(begin, end === -1 ? source.length : end);
  };
  const beginSource = entrySource('begin_prepare_fine_transaction');
  const fineSource = entrySource('project_prepare_fine_rows');
  const coarseSource = entrySource('project_prepare_coarse_rows');
  const sealSource = entrySource('prepare_fine_transaction');
  const helperSource = (beginName, endName) => source.slice(
    source.indexOf(`fn ${beginName}(`),
    source.indexOf(`fn ${endName}(`)
  );
  const preflightSource = helperSource(
    'prepare_fine_transaction_preflight',
    'prepare_fine_validation_and_local_fold'
  );
  const fineFoldSource = helperSource(
    'prepare_fine_validation_and_local_fold',
    'prepare_fine_projection_channel'
  );
  const fineProjectionFoldSource = helperSource(
    'prepare_fine_projection_channel',
    'prepare_coarse_validation'
  );
  const coarseValidationSource = helperSource(
    'prepare_coarse_validation',
    'prepare_coarse_projection_channel'
  );
  const coarseFoldSource = helperSource(
    'prepare_coarse_projection_channel',
    'publish_prepare_channel_failure'
  );
  const failureSource = helperSource(
    'publish_prepare_channel_failure',
    'prepare_fine_transaction'
  );

  assert.match(beginSource, /@compute @workgroup_size\(1\)/);
  assert.match(
    beginSource,
    /let dispatch_mirrors_admitted =[\s\S]*ws_load\(63u\) == parent_view\[64u\][\s\S]*ws_load\(68u\) == parent_view\[70u\]/
  );
  assert.ok(
    beginSource.indexOf('let dispatch_mirrors_admitted')
      < beginSource.indexOf('ws_store(66u, 0u)'),
    'begin must authenticate untouched dispatch mirrors before clearing them'
  );
  assert.match(
    beginSource,
    /if \(!dispatch_mirrors_admitted[\s\S]*!fine_transaction_dispatch_shape_admitted\(ws_load\(22u\), 68u\)/
  );
  assert.match(
    beginSource,
    /fine_stage_store\(0u, ws_load\(evidence_row \+ 4u\)\)[\s\S]*fine_stage_store\(3u, ws_load\(evidence_row \+ 7u\)\)/
  );
  assert.match(
    beginSource,
    /fine_stage_store\(4u, ws_load\(102u\)\)[\s\S]*fine_stage_store\(5u, ws_load\(103u\)\)[\s\S]*fine_stage_store\(6u, ws_load\(47u\)\)/
  );
  assert.match(
    beginSource,
    /fine_stage_store\(7u, params\.completion_ordinal\)[\s\S]*fine_stage_store\(8u, params\.generation_id\)[\s\S]*fine_stage_store\(9u, params\.storage_generation\)[\s\S]*fine_stage_store\(10u, params\.physics_tick\)[\s\S]*fine_stage_store\(11u, params\.fine_substep_ordinal\)/
  );
  assert.doesNotMatch(
    beginSource,
    /fine_stage_store\((?:1[2-9]|[2-9]\d)u/,
    'begin identity must not overwrite live alpha words 84 and 85'
  );
  assert.ok(
    beginSource.lastIndexOf('ws_store(66u, fine_transaction_begin_token())')
      > beginSource.lastIndexOf('fine_stage_store(11u'),
    'begin token must publish after evidence and exact transaction identity'
  );

  const tokenSource = source.slice(
    source.indexOf('fn fine_transaction_identity_hash()'),
    source.indexOf('// Fine-impulse row zero')
  );
  assert.match(
    tokenSource,
    /return 0x80000000u \| \(fine_transaction_identity_hash\(\) & 0x7fffffffu\)/
  );
  assert.match(
    tokenSource,
    /select\(0x7fc00000u, 0xffc00000u, kind != 0u\) \| payload/
  );
  assert.match(
    tokenSource,
    /fine_stage_load\(7u\) == params\.completion_ordinal[\s\S]*fine_stage_load\(11u\) == params\.fine_substep_ordinal/
  );
  assert.match(
    tokenSource,
    /params\.lease_token[\s\S]*params\.physics_substep[\s\S]*params\.fine_substep_count[\s\S]*params\.fine_correction_expected_mutation_ordinal/
  );
  assert.match(
    tokenSource,
    /fn fine_transaction_dispatch_shape_admitted\([\s\S]*dispatch_z != 1u[\s\S]*\(group_count - 1u\) \/ dispatch_x \+ 1u/
  );
  assert.match(
    beginSource,
    /fine_transaction_dispatch_shape_admitted\(ws_load\(21u\), 64u\)[\s\S]*fine_transaction_dispatch_shape_admitted\(ws_load\(22u\), 68u\)/
  );

  for (const [projectSource, kind, row] of [
    [fineSource, '0u', 'fine_field'],
    [coarseSource, '1u', 'coarse_field']
  ]) {
    assert.match(projectSource, /@compute @workgroup_size\(64\)/);
    assert.match(projectSource, /indirect_row_index\(id, workgroup_count\)/);
    assert.match(projectSource, /!fine_transaction_started\(\)/);
    assert.match(
      projectSource,
      new RegExp(`!fine_transaction_dispatch_matches\\(${kind}, workgroup_count\\)`)
    );
    assert.match(
      projectSource,
      new RegExp(`fine_transaction_row_token\\(${kind}, ${row}\\)`)
    );
    assert.doesNotMatch(
      projectSource,
      /ws_reject\(|reflux_reject\(|prepare_reject\(|fine_store\(|coarse_store\(|reflux_store\(/
    );
    assert.ok(
      projectSource.lastIndexOf('TRANSACTION_PROJECTION_STATUS_READY')
        < projectSource.lastIndexOf(
          `fine_transaction_row_token(${kind}, ${row})`
        ),
      'descriptor token must publish after row status'
    );
  }
  assert.match(
    fineSource,
    /ws_store\(impulse_row, bitcast<u32>\(next_velocity\.x\)\)[\s\S]*ws_store\(impulse_row \+ 13u, bitcast<u32>\(cfl_ratio\)\)/
  );
  assert.match(
    coarseSource,
    /ws_store\(proposal_base, bitcast<u32>\(applied\.x\)\)[\s\S]*ws_store\(proposal_base \+ 11u, proposal_count\)/
  );

  assert.match(sealSource, /@compute @workgroup_size\(64\)/);
  assert.match(
    sealSource,
    /@builtin\(local_invocation_index\) lane: u32[\s\S]*@builtin\(num_workgroups\) workgroup_count: vec3<u32>/
  );
  assert.equal([...sealSource.matchAll(/workgroupUniformLoad\(/g)].length, 2);
  assert.match(
    sealSource,
    /lane <= 14u[\s\S]*prepare_fine_projection_channel\(channel\)[\s\S]*lane == 32u[\s\S]*prepare_coarse_validation\(\)[\s\S]*lane >= 33u && lane <= 45u[\s\S]*prepare_coarse_projection_channel\(channel\)/
  );
  assert.match(
    fineFoldSource,
    /for \(var fine_field = 0u; fine_field < fine_count; fine_field = fine_field \+ 1u\)/
  );
  assert.match(
    fineProjectionFoldSource,
    /for \(var fine_field = 0u; fine_field < fine_count; fine_field = fine_field \+ 1u\)/
  );
  assert.match(
    coarseValidationSource,
    /for \(var coarse_field = 0u; coarse_field < coarse_count; coarse_field = coarse_field \+ 1u\)/
  );
  assert.match(
    coarseFoldSource,
    /for \(var coarse_field = 0u; coarse_field < coarse_count; coarse_field = coarse_field \+ 1u\)/
  );
  assert.doesNotMatch(
    fineFoldSource + fineProjectionFoldSource + coarseValidationSource
      + coarseFoldSource,
    /atomic(?:Add|Min|Max|Exchange|CompareExchangeWeak)\(/
  );
  const evidenceGate = sealSource.indexOf(
    'let measured_mass_residual = bitcast<f32>(fine_stage_load(4u))'
  );
  assert.ok(evidenceGate >= 0);
  assert.match(
    preflightSource,
    /if \(!fine_transaction_started\(\)\) \{[\s\S]*ws_reject\(STATUS_INVALID_SOURCE \| STATUS_INVALID_ROUTE, 37u\)/
  );
  assert.match(
    fineFoldSource,
    /fine_transaction_row_token\(0u, fine_field\)[\s\S]*return 1u/
  );
  assert.match(
    coarseValidationSource,
    /fine_transaction_row_token\(1u, coarse_field\)[\s\S]*return 1u/
  );
  assert.ok(
    failureSource.indexOf('if (fine_failure != 0u)')
      < failureSource.indexOf('if (coarse_failure != 0u)'),
    'every fine failure must retain precedence over every coarse failure'
  );
  const fineAggregateGate = sealSource.indexOf(
    'if (local_contribution_sum != fine_load(receipt + 7u)'
  );
  const delayedCoarsePublish = sealSource.lastIndexOf(
    'prepare_channel_u32[2u]'
  );
  assert.ok(
    fineAggregateGate >= 0 && delayedCoarsePublish > fineAggregateGate,
    'staged coarse failure must publish after every fine aggregate gate'
  );
  assert.match(
    sealSource,
    /committed_fine_pressure_compensation\s*\+ sealed_next_field_pressure - prior_pressure/
  );
  assert.match(
    sealSource,
    /committed_coarse_drag_heat\s*\+ sealed_future_coarse_drag_heat - prior_coarse_drag_heat/
  );
  assert.match(sealSource, /existing\.x \+ applied\.x/);
  assert.ok(
    sealSource.lastIndexOf('ws_store(67u, ordinal + 1u)')
      > sealSource.lastIndexOf('ws_store(68u'),
    'external preparation authority must publish last'
  );
});

test('workspace predictor admits canonical multi-contribution field rows', () => {
  const fineBegin =
    schroederSpatialParentFieldMechanicsWorkspaceWgsl.indexOf(
      'fn restrict_fine_field_state('
    );
  const coarseBegin =
    schroederSpatialParentFieldMechanicsWorkspaceWgsl.indexOf(
      'fn inject_coarse_native_state('
    );
  const fineSource =
    schroederSpatialParentFieldMechanicsWorkspaceWgsl.slice(
      fineBegin,
      coarseBegin
    );
  const coarseSource =
    schroederSpatialParentFieldMechanicsWorkspaceWgsl.slice(
      coarseBegin,
      schroederSpatialParentFieldMechanicsWorkspaceWgsl.indexOf(
        'fn parent_node_position(',
        coarseBegin
      )
    );
  for (const source of [fineSource, coarseSource]) {
    assert.match(
      source,
      /let source_contribution_count = (?:fine|coarse)_load\(source \+ 7u\)/
    );
    assert.match(
      source,
      /\(source_contribution_count > 0u\) != source_massive/
    );
    assert.match(
      source,
      /source_contribution_count == 0xffffffffu/
    );
    assert.doesNotMatch(source, /source_active > 1u/);
  }
  assert.match(
    coarseSource,
    /select\(0u, 1u, source_contribution_count > 0u\)/
  );
});

test('cross-level phase routes omit sparse incomplete cohorts without fabricating affine support', () => {
  const evaluateBegin =
    schroederSpatialParentFieldMechanicsWorkspaceWgsl.indexOf(
      'fn evaluate_cross_level_phase_route('
    );
  const scatterBegin =
    schroederSpatialParentFieldMechanicsWorkspaceWgsl.indexOf(
      'fn scatter_cross_level_phase_route(',
      evaluateBegin
    );
  const evaluateSource =
    schroederSpatialParentFieldMechanicsWorkspaceWgsl.slice(
      evaluateBegin,
      scatterBegin
    );
  assert.match(
    evaluateSource,
    /if \(recipient == INVALID_INDEX\) \{ return none; \}/
  );
  assert.match(
    evaluateSource,
    /if \(coarse_ordinal == INVALID_INDEX\) \{ return none; \}/
  );
  assert.match(
    evaluateSource,
    /if \(!\(weight > 0\.0\) \|\| !finite_f32\(weight\)\) \{\s*return invalid_cross_level_phase_route\(\);/
  );
  assert.doesNotMatch(
    evaluateSource,
    /recipient == INVALID_INDEX\s*\|\|/
  );
  const causalBegin =
    schroederSpatialParentFieldMechanicsWorkspaceWgsl.indexOf(
      'fn evaluate_causal_route('
    );
  const causalEnd =
    schroederSpatialParentFieldMechanicsWorkspaceWgsl.indexOf(
      'fn scatter_causal_route_proposal(',
      causalBegin
    );
  const causalSource =
    schroederSpatialParentFieldMechanicsWorkspaceWgsl.slice(
      causalBegin,
      causalEnd
    );
  assert.match(
    causalSource,
    /if \(recipient == INVALID_INDEX\) \{ return none; \}/
  );
  assert.match(
    causalSource,
    /if \(coarse_ordinal == INVALID_INDEX\) \{ return none; \}/
  );
  assert.doesNotMatch(causalSource, /var incomplete/);
});

test('workspace channel-energy closure uses pre-cancellation operation conditioning', () => {
  const source = schroederSpatialParentFieldMechanicsWorkspaceWgsl;
  const helperSource = source
    .split('fn dot_product_conditioning(')[1]
    .split('fn range_fits(')[0];
  assert.match(
    helperSource,
    /abs\(left\.x \* right\.x\)[\s\S]*abs\(left\.y \* right\.y\)[\s\S]*abs\(left\.z \* right\.z\)/
  );
  assert.match(
    helperSource,
    /let conditioning = max\(result_conditioning, operation_conditioning\)/
  );
  assert.match(
    helperSource,
    /finite_f32\(operation_conditioning\)[\s\S]*operation_conditioning >= 0\.0/
  );
  assert.equal(
    [...source.matchAll(/let channel_operation_conditioning =/g)].length,
    2
  );
  assert.equal(
    [
      ...source.matchAll(
        /dot_product_conditioning\(pressure_velocity_delta, drag_impulse\)/g
      )
    ].length,
    2
  );
  assert.equal(
    [...source.matchAll(/if \(!measured_channel_energy_close\(/g)].length,
    2
  );
  for (const entryPoint of [
    'project_prepare_fine_rows',
    'project_prepare_coarse_rows'
  ]) {
    const projectSource = source
      .split(`fn ${entryPoint}(`)[1]
      .split('@compute')[0];
    assert.match(
      projectSource,
      /TRANSACTION_PROJECTION_STATUS_ENERGY_MISMATCH/
    );
    assert.doesNotMatch(
      projectSource,
      /ws_reject\(|reflux_reject\(|prepare_reject\(|fine_store\(|reflux_store\(/
    );
  }
  const prepareSource = source
    .split('fn prepare_fine_transaction(')[1]
    .split('@compute')[0];
  const prepareValidationSource = source.slice(
    source.indexOf('fn prepare_fine_validation_and_local_fold('),
    source.indexOf('@compute', source.indexOf('fn prepare_fine_transaction('))
  );
  assert.match(
    prepareValidationSource,
    /TRANSACTION_PROJECTION_STATUS_ENERGY_MISMATCH\) \{\s*return 9u;[\s\S]*TRANSACTION_PROJECTION_STATUS_ENERGY_MISMATCH\) \{\s*return 6u;/
  );
  assert.match(
    prepareValidationSource,
    /case 9u: \{ reflux_reject\(REFLUX_ENERGY_REJECTED\); \}[\s\S]*case 6u: \{ reflux_reject\(REFLUX_ENERGY_REJECTED\); \}/
  );
  assert.doesNotMatch(prepareSource, /TRANSACTION_PROJECTION_STATUS_ENERGY_MISMATCH/);
  assert.doesNotMatch(source, /0xf00[1-5]000[1-6]u/);

  const f32 = Math.fround;
  const add = (left, right) => left.map(
    (value, index) => f32(value + right[index])
  );
  const divide = (value, scalar) => value.map(
    (component) => f32(component / scalar)
  );
  const dot = (left, right) => f32(
    f32(f32(left[0] * right[0]) + f32(left[1] * right[1]))
      + f32(left[2] * right[2])
  );
  const dotConditioning = (left, right) => f32(
    f32(
      Math.abs(f32(left[0] * right[0]))
        + Math.abs(f32(left[1] * right[1]))
    ) + Math.abs(f32(left[2] * right[2]))
  );
  const mass = f32(1e-8);
  const prior = [10, -8, 20].map(f32);
  const pressure = [
    -2.000000023e-7,
    1.599999990e-7,
    -4.000000047e-7
  ].map(f32);
  const drag = [
    2.000000165e-7,
    -1.600000132e-7,
    4.000000331e-7
  ].map(f32);
  const causal = [
    9.99999996e-12,
    -3.999999984e-12,
    6.999999972e-12
  ].map(f32);
  const applied = add(add(pressure, drag), causal);
  const pressureVelocityDelta = divide(pressure, mass);
  const dragVelocityDelta = divide(drag, mass);
  const afterPressure = add(prior, pressureVelocityDelta);
  const afterDrag = add(afterPressure, dragVelocityDelta);
  const quadratic = (impulse) => f32(
    f32(0.5 * dot(impulse, impulse)) / mass
  );
  const totalQuadratic = quadratic(applied);
  const pressureQuadratic = quadratic(pressure);
  const dragQuadratic = quadratic(drag);
  const causalQuadratic = quadratic(causal);
  const total = f32(dot(prior, applied) + totalQuadratic);
  const pressureDelta = f32(dot(prior, pressure) + pressureQuadratic);
  const dragDelta = f32(dot(afterPressure, drag) + dragQuadratic);
  const causalDelta = f32(dot(afterDrag, causal) + causalQuadratic);
  const recomposed = f32(f32(pressureDelta + dragDelta) + causalDelta);
  const resultConditioning = f32(
    f32(f32(Math.abs(total) + Math.abs(pressureDelta)) + Math.abs(dragDelta))
      + Math.abs(causalDelta)
  );
  const operationTerms = [
    dotConditioning(prior, applied),
    Math.abs(totalQuadratic),
    dotConditioning(prior, pressure),
    Math.abs(pressureQuadratic),
    dotConditioning(prior, drag),
    dotConditioning(pressureVelocityDelta, drag),
    Math.abs(dragQuadratic),
    dotConditioning(prior, causal),
    dotConditioning(pressureVelocityDelta, causal),
    dotConditioning(dragVelocityDelta, causal),
    Math.abs(causalQuadratic)
  ];
  const operationConditioning = operationTerms.reduce(
    (sum, value) => f32(sum + value),
    f32(0)
  );
  const gamma64 = f32(
    f32(64 * (2 ** -24)) / f32(1 - 64 * (2 ** -24))
  );
  const tolerance = (conditioning) => Math.max(
    8 * 1.175494351e-38,
    f32(gamma64 * Math.abs(conditioning))
  );
  const residual = Math.abs(total - recomposed);
  assert.ok(residual > tolerance(resultConditioning));
  assert.ok(
    residual <= tolerance(Math.max(resultConditioning, operationConditioning))
  );
  assert.ok(
    residual + 1e-8
      > tolerance(Math.max(resultConditioning, operationConditioning))
  );
});

test('workspace signed receipt closure uses operation-conditioned reductions', () => {
  const source = schroederSpatialParentFieldMechanicsWorkspaceWgsl;
  const conditionedHelperSource = source
    .split('fn measured_conditioned_close(')[1]
    .split('fn independent_reduction_operation_count(')[0];
  const countHelperSource = source
    .split('fn independent_reduction_operation_count(')[1]
    .split('fn dot_product_conditioning(')[0];
  const fineSource = source
    .split('fn prepare_fine_transaction(')[1]
    .split('@compute')[0];
  const fineFoldSource = source
    .split('fn prepare_fine_validation_and_local_fold(')[1]
    .split('fn prepare_fine_projection_channel(')[0];
  const commitSource = source
    .split('fn commit_routed_reflux() {')[1]
    .split('@compute')[0];
  const terminalSource = source
    .split('fn seal_coarse_velocity_publish() {')[1]
    .split('@compute')[0];
  const coarsePrepareSource = source
    .split('fn prepare_coarse_transaction() {')[1]
    .split('@compute')[0];

  assert.match(
    conditionedHelperSource,
    /let conditioning = max\(\s*abs\(left\) \+ abs\(right\),\s*operation_conditioning\s*\)/
  );
  assert.match(
    conditionedHelperSource,
    /finite_f32\(operation_conditioning\)[\s\S]*operation_conditioning >= 0\.0[\s\S]*measured_scale_tolerance\(conditioning, count\)/
  );
  assert.match(
    countHelperSource,
    /return min\(count, 0x55555555u\) \* 3u;/
  );
  assert.equal(
    [...source.matchAll(/measured_conditioned_close\(/g)].length - 1,
    11
  );
  assert.match(
    fineSource,
    /let fine_signed_reduction_count = independent_reduction_operation_count\(\s*ws_load\(21u\)\s*\)/
  );
  assert.match(
    terminalSource,
    /let coarse_signed_reduction_count = independent_reduction_operation_count\(\s*ws_load\(22u\)\s*\)/
  );

  const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const conditionedCall = (...terms) => new RegExp(
    `measured_conditioned_close\\(\\s*${terms
      .map(escapeRegex)
      .join('\\s*,\\s*')}\\s*\\)`
  );
  const assertConditioned = (section, left, right, conditioning, count) => {
    assert.match(
      section,
      conditionedCall(left, right, conditioning, count)
    );
  };
  const signedReceiptChannels = [
    [
      'local_pressure_internal_compensation_sum',
      'local_pressure_internal_compensation',
      'local_pressure_internal_compensation_sum_abs'
    ],
    [
      'local_ambient_impulse_sum.x',
      'receipt_ambient_impulse.x',
      'local_ambient_impulse_sum_abs.x'
    ],
    [
      'local_ambient_impulse_sum.y',
      'receipt_ambient_impulse.y',
      'local_ambient_impulse_sum_abs.y'
    ],
    [
      'local_ambient_impulse_sum.z',
      'receipt_ambient_impulse.z',
      'local_ambient_impulse_sum_abs.z'
    ],
    [
      'local_ambient_external_work_sum',
      'receipt_ambient_external_work',
      'local_ambient_external_work_sum_abs'
    ]
  ];
  for (const [left, right, conditioning] of signedReceiptChannels) {
    assertConditioned(
      fineSource,
      left,
      right,
      conditioning,
      'fine_signed_reduction_count'
    );
  }
  assert.match(
    fineFoldSource,
    /local_pressure_internal_compensation_sum_abs\s*=\s*next_local_pressure_internal_compensation_sum_abs/
  );
  assert.match(
    fineFoldSource,
    /local_ambient_impulse_sum_abs\s*=\s*next_local_ambient_impulse_sum_abs/
  );
  assert.match(
    fineFoldSource,
    /local_ambient_external_work_sum_abs\s*=\s*next_local_ambient_external_work_sum_abs/
  );
  assertConditioned(
    terminalSource,
    'local_pressure_internal_compensation_sum',
    'receipt_pressure_internal_compensation',
    'local_pressure_internal_compensation_sum_abs',
    'coarse_signed_reduction_count'
  );
  for (const [left, right, conditioning] of signedReceiptChannels.slice(1)) {
    assertConditioned(
      terminalSource,
      left,
      right,
      conditioning,
      'coarse_signed_reduction_count'
    );
  }
  assert.match(
    terminalSource,
    /local_pressure_internal_compensation_sum_abs\s*=\s*next_local_pressure_internal_compensation_sum_abs/
  );
  assert.match(
    terminalSource,
    /local_ambient_impulse_sum_abs\s*=\s*next_local_ambient_impulse_sum_abs/
  );
  assert.match(
    terminalSource,
    /local_ambient_external_work_sum_abs\s*=\s*next_local_ambient_external_work_sum_abs/
  );

  // Cross-level row 16 and header 129 now share one canonical row-order sum;
  // they do not need a tolerance that could hide header corruption.
  assert.match(
    fineSource,
    /var future_coarse_pressure_compensation_sum = 0\.0;[\s\S]*ws_store\(\s*params\.route_proposal_offset \+ 12u,\s*bitcast<u32>\(future_coarse_pressure_compensation_sum\)\s*\)/
  );
  assert.match(
    commitSource,
    /reflux_store\(\s*129u,\s*ws_load\(params\.route_proposal_offset \+ 12u\)\s*\)/
  );
  assert.doesNotMatch(
    commitSource,
    /reflux_load\(129u\)[\s\S]{0,120}coarse_pressure_compensation/
  );
  assert.match(
    terminalSource,
    /bitcast<u32>\(coarse_pressure_compensation_sum\)\s*!= bitcast<u32>\(coarse_cross_level_pressure_compensation\)/
  );
  assertConditioned(
    coarsePrepareSource,
    'future_pressure_compensation_sum',
    'expected_future_pressure_compensation',
    'future_pressure_compensation_sum_abs',
    'future_pressure_reassociation_count'
  );
  assert.match(
    coarsePrepareSource,
    /future_pressure_compensation_sum_abs\s*\+ abs\(local_pressure_compensation\)\s*\+ abs\(pressure_compensation\)/
  );
  assert.doesNotMatch(source, /0xf00[1-5]000[1-6]u/);

  const f32 = Math.fround;
  const f32Sum = (values) => values.reduce(
    (sum, value) => f32(sum + f32(value)),
    f32(0)
  );
  const tolerance = (scale, count) => {
    const epsilon = f32(2 ** -24);
    const nEpsilon = f32(Math.min(
      0.25,
      f32(f32(Math.max(1, count)) * epsilon)
    ));
    const gamma = f32(
      nEpsilon / f32(Math.max(1e-20, f32(1 - nEpsilon)))
    );
    return Math.max(
      f32(8 * 1.175494351e-38),
      f32(gamma * Math.abs(f32(scale)))
    );
  };
  const terms = [f32(1), f32(2 ** -24), f32(-1)];
  const local = f32Sum(terms);
  const independentlyReduced = f32Sum([terms[0], terms[2], terms[1]]);
  const sumAbs = f32Sum(terms.map(Math.abs));
  const operationCount = terms.length * 3;
  const residual = Math.abs(f32(local - independentlyReduced));
  const resultScale = f32(
    Math.abs(local) + Math.abs(independentlyReduced)
  );
  assert.equal(local, 0);
  assert.equal(independentlyReduced, f32(2 ** -24));
  assert.equal(sumAbs, 2);
  assert.ok(residual > tolerance(resultScale, operationCount));
  assert.ok(
    residual <= tolerance(
      Math.max(resultScale, sumAbs),
      operationCount
    )
  );
  const corruptedPeer = f32(2 ** -18);
  const corruptedResidual = Math.abs(f32(local - corruptedPeer));
  const corruptedScale = Math.max(
    f32(Math.abs(local) + Math.abs(corruptedPeer)),
    sumAbs
  );
  assert.ok(corruptedResidual > tolerance(corruptedScale, operationCount));

  // Updating an already rounded aggregate by the sum of row deltas does not
  // generally equal summing the exact future rows in their canonical order.
  const priorRows = [f32(1), f32(2 ** -24), f32(-1)];
  const pressureShares = [f32(0), f32(2 ** -24), f32(0)];
  const futureRows = priorRows.map(
    (value, index) => f32(value + pressureShares[index])
  );
  const oldHeader = f32Sum(priorRows);
  const incrementalHeader = f32(oldHeader + f32Sum(pressureShares));
  const canonicalFutureHeader = f32Sum(futureRows);
  assert.equal(oldHeader, 0);
  assert.equal(incrementalHeader, f32(2 ** -24));
  assert.equal(canonicalFutureHeader, f32(2 ** -23));
  assert.notEqual(incrementalHeader, canonicalFutureHeader);
});

test('workspace route CFL solver intersects cumulative feasible alpha intervals', () => {
  const source = schroederSpatialParentFieldMechanicsWorkspaceWgsl;
  assert.match(source, /const CFL_INTERVAL_WORDS: u32 = 1u;/);
  assert.match(source, /fn velocity_alpha_interval\(/);
  assert.match(source, /fn cfl_interval_offset\(\) -> u32/);
  assert.match(
    source,
    /ws_atomic_max_nonnegative_f32\(\s*cfl_interval_offset\(\), alpha_lower/
  );
  assert.match(
    source,
    /let cfl_alpha_lower = bitcast<f32>\(ws_load\(cfl_interval_offset\(\)\)\)/
  );
  assert.match(
    source,
    /params\.fine_impulse_offset\s*\+ params\.fine_capacity \* FINE_IMPULSE_WORDS/
  );
  assert.match(
    source,
    /if \(cfl_alpha_lower > cfl_alpha_limit\) \{\s*ws_reject\(STATUS_CFL_REJECTED/
  );
  assert.match(
    source,
    /const ROUTE_CFL_NUMERIC_GUARD_FACTOR: f32 = 0\.9999847412109375;/
  );
  assert.match(
    source,
    /const ROUTE_CFL_PHYSICAL_AUDIT_FACTOR: f32 = 1\.000003814697265625;/
  );
  const intervalSource = source
    .split('fn velocity_alpha_interval(')[1]
    .split('fn velocity_endpoint_within_physical_audit')[0];
  assert.match(
    intervalSource,
    /let numeric_scale = max\(vmax, max\(prior_largest, delta_largest\)\);/
  );
  assert.match(
    intervalSource,
    /let target_vmax2 = max\(\s*guarded_vmax2, min\(prior2, audit_vmax2\)\s*\);/
  );
  assert.match(
    intervalSource,
    /let q = -b - select\(-root_term, root_term, b >= 0\.0\);/
  );
  assert.match(
    intervalSource,
    /root_a = q \/ a;\s*root_b = c \/ q;/
  );
  assert.doesNotMatch(intervalSource, /max\(prior2, guarded_vmax2\)/);
  const endpointAuditSource = source
    .split('fn velocity_endpoint_within_physical_audit(')[1]
    .split('fn velocity_delta_within_ceiling(')[0];
  assert.match(
    endpointAuditSource,
    /scaled_vmax \* ROUTE_CFL_PHYSICAL_AUDIT_FACTOR/
  );
  assert.doesNotMatch(
    endpointAuditSource,
    /ROUTE_CFL_NUMERIC_GUARD_FACTOR/
  );
  assert.equal(
    [...source.matchAll(
      /let phase_alpha_interval = velocity_alpha_interval\(/g
    )].length,
    2
  );
  assert.equal(
    [...source.matchAll(
      /let full_alpha_interval = velocity_alpha_interval\(/g
    )].length,
    2
  );
  assert.equal(
    [...source.matchAll(
      /let alpha_lower = max\(\s*phase_alpha_interval\.x, full_alpha_interval\.x\s*\);/g
    )].length,
    1
  );
  assert.match(
    source,
    /let alpha_lower = max\(\s*max\(phase_alpha_interval\.x, full_alpha_interval\.x\),\s*max\(\s*successor_phase_alpha_interval\.x,\s*successor_full_alpha_interval\.x\s*\)\s*\);/
  );
  const fineValidatorSource = source
    .split('fn validate_fine_velocity_correction(')[1]
    .split('@compute')[0];
  const coarseValidatorSource = source
    .split('fn validate_routed_coarse_cfl(')[1]
    .split('@compute')[0];
  for (const validatorSource of [fineValidatorSource, coarseValidatorSource]) {
    assert.match(
      validatorSource,
      /let phase_alpha_interval = velocity_alpha_interval\(/
    );
    assert.match(
      validatorSource,
      /let full_alpha_interval = velocity_alpha_interval\(/
    );
    assert.match(
      validatorSource,
      /let alpha_lower = max\(/
    );
  }
  assert.match(
    fineValidatorSource,
    /prior, phase_delta, vmax, correction_ceiling[\s\S]*prior, full_delta, vmax, correction_ceiling/
  );
  assert.equal(
    [...coarseValidatorSource.matchAll(/\+ existing \/ mass/g)].length,
    2
  );
  assert.match(
    coarseValidatorSource,
    /successor_prior = velocity\(successor_state\) \+ existing \/ mass/
  );
  assert.doesNotMatch(
    coarseValidatorSource,
    /successor_prior\s*=\s*[^;]*(?:proposal|phase_impulse)/
  );
  const prepareSource = source
    .split('fn prepare_fine_transaction(')[1]
    .split('@compute')[0];
  const prepareValidationSource = source.slice(
    source.indexOf('fn prepare_fine_validation_and_local_fold('),
    source.indexOf('@compute', source.indexOf('fn prepare_fine_transaction('))
  );
  const prepareFamilySource = source.slice(
    source.indexOf('fn prepare_fine_transaction_preflight('),
    source.indexOf('@compute', source.indexOf('fn prepare_fine_transaction('))
  );
  const fineProjectionSource = source
    .split('fn project_prepare_fine_rows(')[1]
    .split('@compute')[0];
  const coarseProjectionSource = source
    .split('fn project_prepare_coarse_rows(')[1]
    .split('@compute')[0];
  for (const projectionSource of [
    fineProjectionSource,
    coarseProjectionSource
  ]) {
    assert.equal(
      [...projectionSource.matchAll(
        /velocity_endpoint_within_physical_audit\(/g
      )].length,
      1
    );
    assert.equal(
      [...projectionSource.matchAll(/velocity_magnitude_ratio\(/g)].length,
      1
    );
  }
  assert.doesNotMatch(
    prepareSource,
    /velocity_endpoint_within_physical_audit\(|velocity_magnitude_ratio\(/
  );
  assert.equal(
    [...prepareValidationSource.matchAll(
      /projection_status == TRANSACTION_PROJECTION_STATUS_CFL_ENDPOINT/g
    )].length,
    2
  );
  assert.doesNotMatch(prepareSource, /length\(next_velocity\)/);
  const coarsePublishValidatorSource = source
    .split('fn validate_coarse_velocity_publish(')[1]
    .split('fn seal_coarse_velocity_publish()')[0];
  assert.match(
    coarsePublishValidatorSource,
    /let cfl_ratio = velocity_magnitude_ratio\(future, vmax\);/
  );
  assert.match(
    coarsePublishValidatorSource,
    /velocity_endpoint_within_physical_audit\(future, vmax\)/
  );
  assert.doesNotMatch(coarsePublishValidatorSource, /length\(future\)/);
  const coarsePublishSealSource = source
    .split('fn seal_coarse_velocity_publish()')[1]
    .split('@compute')[0];
  assert.match(
    coarsePublishSealSource,
    /max_coarse_cfl > ROUTE_CFL_PHYSICAL_AUDIT_FACTOR/
  );
  assert.doesNotMatch(
    coarsePublishSealSource,
    /max_coarse_cfl > 1\.0 \+ measured_tolerance/
  );
  assert.match(source, /fn prepare_reject\(flags: u32, reason: u32\)/);
  assert.match(source, /reflux_store\(124u, 0x50520000u \| \(reason & 0xffffu\)\)/);
  assert.match(source, /fn publish_cfl_interval_reject_trace\(/);
  assert.match(source, /fn publish_cfl_interval_seal_reject_trace\(/);
  const cflRejectTraceSource = source
    .split('fn publish_cfl_interval_reject_trace(')[1]
    .split('fn publish_cfl_interval_seal_reject_trace(')[0];
  assert.ok(
    cflRejectTraceSource.indexOf(
      '&reflux_ledger[124u], 0xffffffffu, 0xfffffffeu'
    ) < cflRejectTraceSource.indexOf(
      'reflux_store(125u, bitcast<u32>(prior.x))'
    )
  );
  assert.ok(
    cflRejectTraceSource.indexOf(
      'reflux_store(135u, bitcast<u32>(ceiling))'
    ) < cflRejectTraceSource.lastIndexOf('reflux_store(124u, tag)')
  );
  assert.doesNotMatch(cflRejectTraceSource, /storageBarrier\(/);
  assert.match(
    source,
    /ws_reject\(STATUS_CFL_REJECTED, 86u\);\s*reflux_reject\(REFLUX_CFL_REJECTED\);\s*publish_cfl_interval_reject_trace\(\s*0u, fine_field/
  );
  assert.match(
    coarseValidatorSource,
    /ws_reject\(STATUS_CFL_REJECTED, 86u\);\s*reflux_reject\(REFLUX_CFL_REJECTED\)/
  );
  assert.match(
    coarseValidatorSource,
    /publish_cfl_interval_reject_trace\(\s*3u, coarse_field, successor_prior/
  );
  assert.match(
    coarseValidatorSource,
    /else \{\s*publish_cfl_interval_reject_trace\(\s*1u, coarse_field, prior/
  );
  assert.match(
    coarseValidatorSource,
    /let temporal_joint_interval_rejected =\s*!current_interval_rejected\s*&& !successor_interval_rejected\s*&& max\(current_alpha_lower, successor_alpha_lower\)\s*> min\(current_alpha_upper, successor_alpha_upper\)/
  );
  assert.match(
    coarseValidatorSource,
    /successor_interval_rejected\s*\|\| temporal_joint_interval_rejected\s*\|\| successor_alpha_upper < current_alpha_upper/
  );
  assert.match(
    source,
    /ws_reject\(STATUS_CFL_REJECTED, 86u\);\s*reflux_reject\(REFLUX_CFL_REJECTED\);\s*publish_cfl_interval_seal_reject_trace\(/
  );
  assert.equal(
    [...prepareFamilySource.matchAll(/prepare_reject\(REFLUX_NONFINITE, [1-6]u\)/g)]
      .length,
    6
  );
  assert.equal(
    [...prepareFamilySource.matchAll(
      /prepare_reject\(REFLUX_CFL_REJECTED, (?:10[12]|201)u\)/g
    )].length,
    3
  );
  assert.doesNotMatch(
    prepareFamilySource,
    /prepare_reject\(REFLUX_CFL_REJECTED, (?:103|203)u\)/
  );
  assert.doesNotMatch(source, /0xf00[1-5]000[1-6]u/);

  const f32 = Math.fround;
  const add = (left, right) => left.map(
    (value, index) => f32(value + right[index])
  );
  const scale = (value, scalar) => value.map(
    (component) => f32(component * scalar)
  );
  const dot = (left, right) => f32(
    f32(f32(left[0] * right[0]) + f32(left[1] * right[1]))
      + f32(left[2] * right[2])
  );
  const alphaInterval = (prior, delta, maximum, ceiling = 0) => {
    const vmax = f32(maximum);
    const priorLargest = Math.max(...prior.map((value) => Math.abs(value)));
    const deltaLargest = Math.max(...delta.map((value) => Math.abs(value)));
    const numericScale = Math.max(vmax, priorLargest, deltaLargest);
    if (!(numericScale > 0) || !Number.isFinite(numericScale)) {
      return { valid: false, lower: 0, upper: -1 };
    }
    let ceilingUpper = f32(1);
    if (ceiling > 0 && deltaLargest > 0) {
      const normalizedDelta = delta.map(
        (value) => f32(value / deltaLargest)
      );
      const normalizedLength = f32(Math.sqrt(dot(
        normalizedDelta,
        normalizedDelta
      )));
      const ceilingToLargest = f32(ceiling / deltaLargest);
      if (ceilingToLargest < normalizedLength) {
        ceilingUpper = f32(ceilingToLargest / normalizedLength);
      }
    }
    const scaledPrior = prior.map((value) => f32(value / numericScale));
    const scaledDelta = delta.map((value) => f32(value / numericScale));
    const scaledVmax = f32(vmax / numericScale);
    const scaledGuardedVmax = f32(
      scaledVmax * f32(0.9999847412109375)
    );
    const scaledAuditVmax = f32(
      scaledVmax * f32(1.000003814697265625)
    );
    const a = dot(scaledDelta, scaledDelta);
    const b = dot(scaledPrior, scaledDelta);
    const prior2 = dot(scaledPrior, scaledPrior);
    const guardedVmax2 = f32(scaledGuardedVmax * scaledGuardedVmax);
    const auditVmax2 = f32(scaledAuditVmax * scaledAuditVmax);
    const targetVmax2 = Math.max(
      guardedVmax2,
      Math.min(prior2, auditVmax2)
    );
    const c = f32(prior2 - targetVmax2);
    if (!(a > 0)) {
      return c <= 0
        ? { valid: true, lower: 0, upper: ceilingUpper }
        : { valid: false, lower: 0, upper: -1 };
    }
    const bb = f32(b * b);
    const ac = f32(a * c);
    const rawDiscriminant = f32(bb - ac);
    const discriminantTolerance = Math.max(
      f32(8 * 1.175494351e-38),
      f32(f32(32 * 5.960464477539063e-8) * f32(
        Math.abs(bb) + Math.abs(ac)
      ))
    );
    if (!Number.isFinite(rawDiscriminant)
        || rawDiscriminant < -discriminantTolerance) {
      return { valid: false, lower: 0, upper: -1 };
    }
    const rootTerm = f32(Math.sqrt(Math.max(rawDiscriminant, 0)));
    const q = f32(-b - (b >= 0 ? rootTerm : -rootTerm));
    const rootA = q === 0 ? f32(-b / a) : f32(q / a);
    const rootB = q === 0 ? rootA : f32(c / q);
    const lower = f32(Math.max(0, Math.min(rootA, rootB)));
    const upper = f32(Math.min(
      ceilingUpper,
      1,
      Math.max(rootA, rootB)
    ));
    const valid = Number.isFinite(lower)
      && Number.isFinite(upper)
      && lower <= upper;
    return {
      valid,
      lower: valid && lower === 0 ? 0 : lower,
      upper: valid && upper === 0 ? 0 : upper
    };
  };
  const alphaLimit = (prior, delta, maximum, ceiling = 0) => {
    const interval = alphaInterval(prior, delta, maximum, ceiling);
    return interval.valid ? interval.upper : f32(-1);
  };

  const vmax = f32(100);
  const guardedVmax = f32(vmax * f32(0.9999847412109375));
  const auditVmax = f32(vmax * f32(1.000003814697265625));
  const insideAlpha = alphaLimit(
    [f32(90), f32(0), f32(0)],
    [f32(20), f32(0), f32(0)],
    vmax
  );
  const insideEndpoint = add(
    [f32(90), f32(0), f32(0)],
    scale([f32(20), f32(0), f32(0)], insideAlpha)
  );
  assert.ok(insideAlpha > 0 && insideAlpha < 1);
  assert.ok(Math.abs(insideEndpoint[0] - guardedVmax) <= 2e-5);

  const bandPrior = [f32(99.9995), f32(0), f32(0)];
  assert.equal(
    alphaLimit(bandPrior, [f32(1), f32(0), f32(0)], vmax),
    0
  );
  assert.ok(bandPrior[0] > guardedVmax && bandPrior[0] <= auditVmax);
  assert.equal(
    alphaLimit(
      [f32(100.01), f32(0), f32(0)],
      [f32(1), f32(0), f32(0)],
      vmax
    ),
    -1
  );
  const inwardCrossingInterval = alphaInterval(
    [f32(100.01), f32(0), f32(0)],
    [f32(-300.02), f32(0), f32(0)],
    vmax
  );
  const inwardCrossingAlpha = inwardCrossingInterval.upper;
  assert.equal(inwardCrossingInterval.valid, true);
  assert.ok(inwardCrossingInterval.lower > 0);
  assert.ok(inwardCrossingAlpha > 0.66 && inwardCrossingAlpha < 0.67);
  assert.ok(
    alphaLimit(
      [f32(101), f32(0), f32(0)],
      [f32(-1), f32(0), f32(0)],
      vmax
    ) > 0.99
  );
  for (const magnitude of [f32(1e-30), f32(1e30)]) {
    const scaledInterval = alphaInterval(
      [f32(0.9 * magnitude), f32(0), f32(0)],
      [f32(0.2 * magnitude), f32(0), f32(0)],
      magnitude
    );
    assert.equal(scaledInterval.valid, true);
    assert.ok(scaledInterval.upper > 0.49 && scaledInterval.upper < 0.51);
  }

  // A reduced causal component can remove cancellation from the full route.
  // Constraining both endpoint rays makes every intermediate causal blend a
  // convex combination of two admitted velocities.
  const envelopeVmax = f32(10);
  const envelopePrior = [f32(0), f32(9), f32(0)];
  const phaseDelta = [f32(8), f32(0), f32(0)];
  const causalDelta = [f32(-8), f32(0), f32(0)];
  const fullDelta = add(phaseDelta, causalDelta);
  const phaseAlpha = alphaLimit(
    envelopePrior,
    phaseDelta,
    envelopeVmax
  );
  const fullAlpha = alphaLimit(
    envelopePrior,
    fullDelta,
    envelopeVmax
  );
  const dualRayAlpha = Math.min(phaseAlpha, fullAlpha);
  assert.equal(fullAlpha, 1);
  assert.ok(phaseAlpha > 0 && phaseAlpha < 1);
  assert.ok(
    Math.sqrt(dot(
      add(envelopePrior, scale(phaseDelta, fullAlpha)),
      add(envelopePrior, scale(phaseDelta, fullAlpha))
    )) > envelopeVmax
  );
  const envelopeGuard = f32(
    envelopeVmax * f32(0.9999847412109375)
  );
  const phaseEndpoint = add(
    envelopePrior,
    scale(phaseDelta, dualRayAlpha)
  );
  const fullEndpoint = add(
    envelopePrior,
    scale(fullDelta, dualRayAlpha)
  );
  const endpointDifference = add(
    fullEndpoint,
    scale(phaseEndpoint, f32(-1))
  );
  const convexCurvature = f32(2 * dot(
    endpointDifference,
    endpointDifference
  ));
  assert.ok(convexCurvature >= 0);
  assert.ok(Math.sqrt(dot(phaseEndpoint, phaseEndpoint)) <= envelopeGuard + 2e-5);
  assert.ok(Math.sqrt(dot(fullEndpoint, fullEndpoint)) <= envelopeGuard + 2e-5);
  for (let index = 0; index <= 1024; index += 1) {
    const causalAlpha = f32(index / 1024);
    const blendedDelta = add(
      phaseDelta,
      scale(causalDelta, causalAlpha)
    );
    const endpoint = add(
      envelopePrior,
      scale(blendedDelta, dualRayAlpha)
    );
    assert.ok(Math.sqrt(dot(endpoint, endpoint)) <= envelopeGuard + 2e-5);
  }

  // The current predictor can admit the entire route while the immediate
  // successor predictor constrains it. Intersecting the same two route rays
  // at both temporal endpoints protects every causal blend without adding
  // the already committed reflux more than once.
  const temporalCurrentPrior = [f32(99), f32(0), f32(0)];
  const temporalSuccessorPrior = [f32(99.9), f32(0), f32(0)];
  const temporalPhaseDelta = [f32(0.25), f32(0), f32(0)];
  const temporalFullDelta = [f32(0.5), f32(0), f32(0)];
  const currentTemporalUpper = Math.min(
    alphaLimit(temporalCurrentPrior, temporalPhaseDelta, vmax),
    alphaLimit(temporalCurrentPrior, temporalFullDelta, vmax)
  );
  const successorTemporalUpper = Math.min(
    alphaLimit(temporalSuccessorPrior, temporalPhaseDelta, vmax),
    alphaLimit(temporalSuccessorPrior, temporalFullDelta, vmax)
  );
  assert.equal(currentTemporalUpper, 1);
  assert.ok(successorTemporalUpper > 0.19 && successorTemporalUpper < 0.21);
  const temporalJointUpper = Math.min(
    currentTemporalUpper,
    successorTemporalUpper
  );
  for (let index = 0; index <= 1024; index += 1) {
    const causalBlend = f32(index / 1024);
    const blendedDelta = add(
      temporalPhaseDelta,
      scale(
        add(
          temporalFullDelta,
          scale(temporalPhaseDelta, f32(-1))
        ),
        causalBlend
      )
    );
    for (const prior of [temporalCurrentPrior, temporalSuccessorPrior]) {
      const endpoint = add(prior, scale(blendedDelta, temporalJointUpper));
      assert.ok(
        Math.sqrt(dot(endpoint, endpoint)) <= guardedVmax + 2e-5
      );
    }
  }

  // Schedule 405's captured fine0 endpoint spent effectively the entire
  // physical sphere. Its theta=.5 -> 1 predictor refresh then crossed the
  // unchanged physical audit, while the 2^-16 route debit remains inside it.
  const capturedVmax = f32(Math.sqrt(25220.5234375));
  const capturedFine0Endpoint = f32(Math.sqrt(25220.51953125));
  const capturedFine1Prior = f32(Math.sqrt(25221.375));
  const predictorRefresh = f32(capturedFine1Prior - capturedFine0Endpoint);
  const physicalAuditRatio = f32(1 + 3.8146973e-6);
  assert.ok(
    f32(capturedFine0Endpoint + predictorRefresh)
      > f32(capturedVmax * physicalAuditRatio)
  );
  assert.ok(
    f32(
      f32(capturedVmax * f32(0.9999847412109375)) + predictorRefresh
    ) <= f32(capturedVmax * physicalAuditRatio)
  );
});

test('workspace causal-energy seal evaluates coefficients at sealed route alpha', () => {
  const source = schroederSpatialParentFieldMechanicsWorkspaceWgsl;
  const predictorSealSource = source
    .split('fn seal_parent_field_predictors() {')[1]
    .split('@compute')[0];
  const causalSealSource = source
    .split('fn seal_fine_correction_alpha() {')[1]
    .split('@compute')[0];
  assert.match(
    predictorSealSource,
    /ws_store\(84u, bitcast<u32>\(0\.0\)\)/
  );
  assert.match(
    causalSealSource,
    /let raw_causal_linear =[\s\S]*let phase_causal_cross = bitcast<f32>\(ws_load\(84u\)\)[\s\S]*let raw_causal_quadratic =/
  );
  assert.match(
    causalSealSource,
    /let causal_linear = cfl_alpha_limit \* \(\s*raw_causal_linear \+ cfl_alpha_limit \* phase_causal_cross\s*\)/
  );
  assert.match(
    causalSealSource,
    /let causal_quadratic = route_alpha_squared \* raw_causal_quadratic/
  );

  const scaledCoefficients = ({ routeAlpha, priorLinear, phaseCross, quadratic }) => ({
    linear: routeAlpha * (priorLinear + routeAlpha * phaseCross),
    quadratic: routeAlpha * routeAlpha * quadratic
  });
  const scaledEnergy = (coefficients, causalAlpha) => (
    causalAlpha * coefficients.linear
      + causalAlpha * causalAlpha * coefficients.quadratic
  );

  // The old alpha=1 coefficients see cancellation that disappears after the
  // shared route is reduced. Its accepted causal alpha would create energy.
  const unsafeAtUnitRoute = {
    routeAlpha: 0.25,
    priorLinear: 1,
    phaseCross: -2,
    quadratic: 2
  };
  const oldLinear = unsafeAtUnitRoute.priorLinear
    + unsafeAtUnitRoute.phaseCross;
  const oldCausalAlpha = -oldLinear / unsafeAtUnitRoute.quadratic;
  const unsafeScaled = scaledCoefficients(unsafeAtUnitRoute);
  assert.equal(oldCausalAlpha, 0.5);
  assert.ok(scaledEnergy(unsafeScaled, oldCausalAlpha) > 0);
  assert.ok(unsafeScaled.linear >= 0);

  // Route scaling can also turn a unit-route rejection into a safe full
  // causal step; the sealed coefficients must retain that admissible case.
  const safeAfterRouteReduction = scaledCoefficients({
    routeAlpha: 0.25,
    priorLinear: -1,
    phaseCross: 2,
    quadratic: 0.2
  });
  assert.ok(scaledEnergy(safeAfterRouteReduction, 1) < 0);

  const rootCase = scaledCoefficients({
    routeAlpha: 0.5,
    priorLinear: -2,
    phaseCross: 1,
    quadratic: 4
  });
  const rootAlpha = -rootCase.linear / rootCase.quadratic;
  assert.equal(rootAlpha, 0.75);
  assert.ok(Math.abs(scaledEnergy(rootCase, rootAlpha)) <= Number.EPSILON);
});

test('workspace floating-point CAS reductions scale retries to admitted fields', () => {
  assert.match(
    schroederSpatialParentFieldMechanicsWorkspaceWgsl,
    /fn atomic_retry_limit\(\) -> u32 \{[\s\S]*participants \* 2u \+ 64u/
  );
  assert.equal(
    [
      ...schroederSpatialParentFieldMechanicsWorkspaceWgsl.matchAll(
        /attempts >= atomic_retry_limit\(\)/g
      )
    ].length,
    8
  );
  assert.doesNotMatch(
    schroederSpatialParentFieldMechanicsWorkspaceWgsl,
    /attempts >= 256u/
  );
});

test('fine scan fusion restores persisted operands and the legacy f32 fold form', () => {
  const f32Add = (left, right) => Math.fround(Math.fround(left) + Math.fround(right));
  const f32Sub = (left, right) => Math.fround(Math.fround(left) - Math.fround(right));
  const pressure = Object.freeze({
    sum: 0.22196125984191895,
    future: 4.70844841003418,
    prior: 27.733375549316406
  });
  const oldPressure = f32Sub(
    f32Add(pressure.sum, pressure.future),
    pressure.prior
  );
  const regroupedPressure = f32Add(
    pressure.sum,
    f32Sub(pressure.future, pressure.prior)
  );
  assert.notEqual(oldPressure, regroupedPressure);

  const prepareSource = schroederSpatialParentFieldMechanicsWorkspaceWgsl.slice(
    schroederSpatialParentFieldMechanicsWorkspaceWgsl.indexOf(
      'fn prepare_fine_transaction('
    ),
    schroederSpatialParentFieldMechanicsWorkspaceWgsl.indexOf(
      'fn commit_routed_reflux_rows('
    )
  );
  assert.match(
    prepareSource,
    /committed_fine_pressure_compensation\s*\+ sealed_next_field_pressure - prior_pressure/
  );
  assert.match(
    prepareSource,
    /committed_coarse_drag_heat\s*\+ sealed_future_coarse_drag_heat - prior_coarse_drag_heat/
  );
  assert.match(
    prepareSource,
    /ws_store\(impulse_row \+ 14u, bitcast<u32>\(next_field_pressure\)\)[\s\S]*let sealed_next_field_pressure = bitcast<f32>\(\s*ws_load\(impulse_row \+ 14u\)\s*\)/
  );
  assert.match(
    prepareSource,
    /ws_store\(\s*proposal_base \+ 15u,[\s\S]*bitcast<u32>\(future_coarse_drag_heat\)[\s\S]*let sealed_future_coarse_drag_heat = bitcast<f32>\(\s*ws_load\(proposal_base \+ 15u\)\s*\)/
  );
  assert.doesNotMatch(
    prepareSource,
    /committed_fine_pressure_compensation\s*\+ \(sealed_next_field_pressure - prior_pressure\)/
  );
  assert.doesNotMatch(
    prepareSource,
    /committed_coarse_drag_heat\s*\+ \(sealed_future_coarse_drag_heat - prior_coarse_drag_heat\)/
  );
});

test('workspace runtime stages predictors and terminal branches without encode-time buffers', async () => {
  const device = fakeDevice();
  const fixture = exactFixture(device);
  const runtime = createSchroederSpatialParentFieldMechanicsWorkspaceGpu(device, {
    parentFieldCapacity: fixture.parentFieldView.parentFieldCapacity,
    fineFieldCapacity: fixture.parentFieldView.fineFieldCapacity,
    arenaCount: 2
  });
  const refluxLedger = createSchroederCrossLevelRefluxLedgerGpu(device, {
    parentFieldCapacity: fixture.parentFieldView.parentFieldCapacity,
    coarseFieldCapacity: fixture.parentFieldView.coarseFieldCapacity,
    completionOrdinal: 17,
    fineSubstepCount: 1,
    fineLevel: 0,
    coarseLevel: 1,
    coarseGridSpacingM: fixture.parentFieldView.coarseFieldView.gridSpacingM
  });
  const retainedBufferCount = device.buffers.length;
  const predictorEncoder = fakeEncoder();
  const fineExecution = runtime.encodePredictors(predictorEncoder, {
    parentFieldView: fixture.parentFieldView,
    fineP2gProjection: fixture.fineProjection,
    coarseP2gProjection: fixture.coarseProjection,
    refluxLedger,
    fineSubstepCount: 1,
    dt: 0.01,
    gravityMPerS2: [0, -9.80665, 0],
    boxDimsM: [1, 1, 1]
  });
  assert.equal(device.buffers.length, retainedBufferCount);
  assert.equal(fineExecution.encodedDispatchCount, 12);
  assert.deepEqual(
    predictorEncoder.events.filter((event) => event.kind === 'copy')
      .map((event) => event.sourceOffset),
    [240, 256, 272]
  );
  assert.equal(
    predictorEncoder.events.filter((event) => event.kind === 'pass').length,
    1
  );
  assert.equal(fineExecution.encodedComputePassCount, 1);
  const predictorPasses = predictorEncoder.events.filter(
    (event) => event.kind === 'pass'
  );
  assert.deepEqual(
    predictorPasses[0].commands.map(({ pipeline }) => pipeline.compute.entryPoint),
    [
      'initialize_parent_field_workspace',
      'begin_reflux_coarse_registry',
      'claim_reflux_coarse_registry_rows',
      'register_reflux_coarse_registry_rows',
      'seal_reflux_coarse_registry',
      'restrict_fine_field_state',
      'finalize_fine_parent_baseline',
      'inject_coarse_native_state',
      'validate_reflux_coarse_registry_mass_rows',
      'update_parent_field_predictors',
      'contact_parent_field_predictors',
      'seal_parent_field_predictors'
    ]
  );
  assert.deepEqual(
    predictorPasses[0].commands.map((command) => 'indirect' in command),
    [false, false, true, true, false, true, true, true, true, true, true, false]
  );
  for (const commandIndex of [2, 3, 8]) {
    assert.equal(
      predictorPasses[0].commands[commandIndex].indirect.buffer,
      fineExecution.coarseIndirectBuffer
    );
  }
  const initializeEntries = predictorPasses[0].bindGroups[0].value.entries;
  assert.equal(initializeEntries.some(({ binding }) => binding === 11), false);
  assert.equal(
    initializeEntries.find(({ binding }) => binding === 3).resource.size,
    fineExecution.layout.workspaceBindingByteLength
  );
  const splitEntries = predictorPasses
    .flatMap((event) => event.bindGroups.map(({ value }) => value.entries))
    .find((entries) => entries.some(({ binding }) => binding === 11));
  const workspaceBinding = splitEntries.find(({ binding }) => binding === 3);
  const reverseMapBinding = splitEntries.find(({ binding }) => binding === 11);
  assert.equal(workspaceBinding.resource.buffer, fineExecution.workspaceBuffer);
  assert.equal(reverseMapBinding.resource.buffer, fineExecution.workspaceBuffer);
  assert.equal(workspaceBinding.resource.offset, 0);
  assert.equal(workspaceBinding.resource.size,
    fineExecution.layout.workspaceBindingByteLength);
  assert.equal(reverseMapBinding.resource.offset,
    fineExecution.layout.parentToCoarseOrdinalByteOffset);
  assert.equal(reverseMapBinding.resource.size,
    fineExecution.layout.parentToCoarseOrdinalByteLength);
  device.queue.submit([predictorEncoder.finish()]);
  runtime.markPredictorsSubmitted(fineExecution);
  fixture.commitFineGridUpdate();
  const fineEncoder = fakeEncoder();
  assert.throws(
    () => runtime.encodeFineCorrection(fineEncoder, fineExecution, {
      fineGridUpdate: fixture.fineGridUpdate,
      deltaScale: 1,
      maxCorrectionMPerS: 2
    }),
    /exact deferred-receipt fine field update/
  );
  assert.equal(fineEncoder.events.length, 0);
  assert.equal(runtime.isTerminalSubmitted(fineExecution), false);
  assert.equal(await runtime.releaseExecutionAfter(fineExecution, Promise.resolve()), true);

  fixture.commitCoarseGridUpdate();
  const terminalArgs = {
    parentFieldView: fixture.parentFieldView,
    coarseGridUpdate: fixture.coarseGridUpdate,
    refluxLedger,
    fineSubstepCount: 1,
    fineDt: 0.01
  };
  const cloneCoarseGridUpdate = (
    overrides = {},
    sourceProjection = fixture.coarseProjection
  ) => {
    const clone = { ...fixture.coarseGridUpdate, ...overrides };
    Object.defineProperty(clone, 'sourceProjection', {
      value: sourceProjection,
      enumerable: true
    });
    return clone;
  };
  assert.throws(
    () => runtime.encodeCoarseTerminal(fakeEncoder(), {
      ...terminalArgs,
      coarseGridUpdate: fixture.coarseProjection
    }),
    /coarse terminal requires exact submitted topology/
  );
  assert.throws(
    () => runtime.encodeCoarseTerminal(fakeEncoder(), {
      ...terminalArgs,
      coarseGridUpdate: cloneCoarseGridUpdate()
    }),
    /coarse terminal requires exact submitted topology/
  );
  assert.throws(
    () => runtime.encodeCoarseTerminal(fakeEncoder(), {
      ...terminalArgs,
      coarseGridUpdate: cloneCoarseGridUpdate({ dt: 0.02 })
    }),
    /coarse terminal requires exact submitted topology/
  );
  assert.throws(
    () => runtime.encodeCoarseTerminal(fakeEncoder(), {
      ...terminalArgs,
      coarseGridUpdate: cloneCoarseGridUpdate({
        mechanicsFieldEnergyReceipt: {
          ...fixture.coarseGridUpdate.mechanicsFieldEnergyReceipt,
          deferSeal: false
        }
      })
    }),
    /coarse terminal requires exact submitted topology/
  );
  assert.throws(
    () => runtime.encodeCoarseTerminal(fakeEncoder(), {
      ...terminalArgs,
      coarseGridUpdate: cloneCoarseGridUpdate({}, fixture.fineProjection)
    }),
    /coarse terminal requires exact submitted topology/
  );
  const forgedEncoder = fakeEncoder();
  assert.throws(
    () => runtime.encodeCoarseTerminal(forgedEncoder, terminalArgs),
    /coarse terminal requires exact submitted topology/
  );
  assert.equal(forgedEncoder.events.length, 0);
  assert.equal(runtime.activeExecutionCount(), 0);
  assert.equal(runtime.destroy(), true);
  assert.equal(refluxLedger.destroy(), true);
  assert.equal(device.buffers.slice(-10).every((buffer) => buffer.destroyed), true);
});

test('parent workspace device loss supersedes an in-flight fence and retires only its arena', async () => {
  const device = fakeDevice();
  const { fixture, runtime, refluxLedger, encodeOne } =
    submittedPredictorWorkspace(device, { arenaCount: 2 });
  const execution = encodeOne();
  const arenaBuffers = runtime.allocationEntries()
    .filter((entry) => entry.arenaIndex === execution.arenaIndex)
    .map((entry) => entry.buffer);
  const borrowedBuffers = [
    fixture.parentFieldView.parentFieldViewBuffer,
    fixture.parentFieldView.fineFieldView.fieldViewBuffer,
    fixture.parentFieldView.coarseFieldView.fieldViewBuffer,
    refluxLedger.buffer
  ];
  const queueFence = deferred();
  const deviceLoss = deferred();
  device.lost = deviceLoss.promise;
  const normalRelease = runtime.releaseExecutionAfter(
    execution,
    queueFence.promise
  );
  const lossRelease = runtime.quarantineExecutionAfterDeviceLoss(execution);
  assert.equal(
    runtime.quarantineExecutionAfterDeviceLoss(execution),
    lossRelease
  );
  const completion = runtime.executionRetirementCompletionPromise(execution);
  assert.equal(runtime.ownsExecution(execution), false);
  assert.equal(arenaBuffers.every((buffer) => !buffer.destroyed), true);
  assert.equal(borrowedBuffers.every((buffer) => !buffer.destroyed), true);

  deviceLoss.resolve({ reason: 'destroyed', message: 'injected workspace loss' });
  assert.equal(await lossRelease, true);
  assert.equal(execution.released, true);
  assert.equal(arenaBuffers.every((buffer) => buffer.destroyed), true);
  assert.equal(arenaBuffers.every((buffer) => buffer.destroyCount === 1), true);
  assert.equal(borrowedBuffers.every((buffer) => !buffer.destroyed), true);
  queueFence.reject(new Error('stale workspace fence rejected after loss'));
  assert.equal(await normalRelease, true);
  assert.equal(
    execution.status,
    'schroeder-spatial-parent-field-mechanics-device-loss-retired'
  );
  assert.equal(runtime.quarantineExecutionAfterDeviceLoss(execution), completion);
  assert.equal(await completion, true);
  assert.throws(
    () => runtime.quarantineExecutionAfterDeviceLoss({ ...execution }),
    (error) => error.code
      === 'ERR_SCHROEDER_PARENT_FIELD_MECHANICS_FOREIGN_EXECUTION'
  );
  assert.throws(
    () => encodeOne(),
    (error) => error.code === 'ERR_SCHROEDER_PARENT_FIELD_MECHANICS_DEVICE_LOST'
  );
  assert.equal(runtime.destroy(), true);
  assert.equal(arenaBuffers.every((buffer) => buffer.destroyCount === 1), true);
  assert.equal(refluxLedger.destroy(), true);
});

test('parent workspace loss retirement retries only an incompletely destroyed owned buffer', async () => {
  const device = fakeDevice();
  const { fixture, runtime, refluxLedger, encodeOne } =
    submittedPredictorWorkspace(device, { arenaCount: 1 });
  const execution = encodeOne();
  const owned = runtime.allocationEntries().map((entry) => entry.buffer);
  const flaky = owned[0];
  const originalDestroy = flaky.destroy;
  let injected = true;
  flaky.destroy = function destroyWithOneFailure() {
    if (injected) {
      injected = false;
      this.destroyCount += 1;
      throw new Error('injected workspace arena destroy failure');
    }
    return originalDestroy.call(this);
  };
  device.lost = Promise.resolve({ reason: 'destroyed' });
  const completion = runtime.executionRetirementCompletionPromise(execution);
  await assert.rejects(
    runtime.quarantineExecutionAfterDeviceLoss(execution),
    /injected workspace arena destroy failure/
  );
  assert.equal(execution.released, false);
  assert.equal(runtime.ownsExecution(execution), true);
  assert.equal(owned.slice(1).every((buffer) => buffer.destroyCount === 1), true);
  assert.equal(await runtime.quarantineExecutionAfterDeviceLoss(execution), true);
  assert.equal(await completion, true);
  assert.equal(flaky.destroyCount, 2);
  assert.equal(owned.slice(1).every((buffer) => buffer.destroyCount === 1), true);
  assert.equal(fixture.parentFieldView.parentFieldViewBuffer.destroyed, false);
  assert.equal(refluxLedger.buffer.destroyed, false);
  assert.equal(refluxLedger.destroy(), true);
});

test('one observed device loss redirects every live parent workspace without a normal fence', async () => {
  const device = fakeDevice();
  const { runtime, encodeOne } = submittedPredictorWorkspace(
    device,
    { arenaCount: 2 }
  );
  const first = encodeOne();
  const second = encodeOne();
  const deviceLoss = deferred();
  device.lost = deviceLoss.promise;
  const firstLoss = runtime.quarantineExecutionAfterDeviceLoss(first);
  let fakeFenceObserved = 0;
  const fakeFence = {
    then() {
      fakeFenceObserved += 1;
      throw new Error('normal fence must not be observed after device loss');
    }
  };
  const secondLoss = runtime.releaseExecutionAfter(second, fakeFence);
  assert.equal(fakeFenceObserved, 0);
  deviceLoss.resolve({ reason: 'destroyed' });
  assert.deepEqual(await Promise.all([firstLoss, secondLoss]), [true, true]);
  assert.equal(fakeFenceObserved, 0);
});

test('native parent-field mechanics admits sparse v2 fields before coupling', {
  skip: RUN_NATIVE
    ? false
    : 'set ULG_RUN_NATIVE_PARENT_FIELD_MECHANICS=1 for native WebGPU',
  timeout: 120_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: process.env.ULG_PARENT_FIELD_MECHANICS_CHROME
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
    native = await page.evaluate(async ({ m0Only, m1Only, m2Only }) => {
      const adapter = await navigator.gpu?.requestAdapter({
        powerPreference: 'high-performance'
      });
      if (!adapter) return { status: 'unsupported', reason: 'WebGPU adapter unavailable' };
      const deviceLimits = await import('/src/runtime/webgpuDeviceLimits.js');
      const device = await adapter.requestDevice(
        deviceLimits.webGpuDeviceDescriptorForResidentSph(adapter)
      );
      const errors = [];
      device.addEventListener('uncapturederror', (event) => {
        errors.push(event.error?.message || String(event.error));
      });
      device.pushErrorScope('validation');
      // Vite versions dirty dependencies with ?t=... URLs. These runtimes use
      // private WeakMap brands, so every producer and consumer must come from
      // the exact transformed module graph instead of cache-busted twins.
      const [g2pSource, proposalSource] = await Promise.all([
        fetch('/src/runtime/sph/sphG2pGpuKernel.js').then(
          (response) => response.text()
        ),
        fetch('/src/runtime/sph/schroederSpatialMechanicalProposalsGpu.js').then(
          (response) => response.text()
        )
      ]);
      const dependencyUrl = (sources, path) => {
        const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        for (const source of sources) {
          const match = source.match(new RegExp(
            `["']([^"']*${escaped}(?:\\?[^"']*)?)["']`
          ));
          if (match) return match[1];
        }
        throw new Error(`Vite dependency URL not found for ${path}`);
      };
      const workspaceUrl = dependencyUrl(
        [g2pSource],
        '/src/runtime/sph/schroederSpatialParentFieldMechanicsWorkspaceGpu.js'
      );
      const fusedUrl = dependencyUrl(
        [g2pSource],
        '/src/runtime/sph/schroederFusedFineSubstepGpu.js'
      );
      const spatialUrl = dependencyUrl(
        [proposalSource],
        '/src/runtime/sph/schroederSpatialEpochGpu.js'
      );
      const [workspaceSource, fusedSource, spatialSource] = await Promise.all([
        fetch(workspaceUrl).then((response) => response.text()),
        fetch(fusedUrl).then((response) => response.text()),
        fetch(spatialUrl).then((response) => response.text())
      ]);
      const gridUpdateUrl = dependencyUrl(
        [workspaceSource],
        '/src/runtime/sph/sphGridUpdateGpuKernel.js'
      );
      const gridUpdateSource = await fetch(gridUpdateUrl).then(
        (response) => response.text()
      );
      const gridUrl = dependencyUrl(
        [gridUpdateSource],
        '/src/runtime/sph/sphGridGpuKernel.js'
      );
      const g2pUrl = dependencyUrl(
        [fusedSource],
        '/src/runtime/sph/sphG2pGpuKernel.js'
      );
      const frozenAssignmentRefreshUrl = dependencyUrl(
        [spatialSource],
        '/src/runtime/sph/schroederFrozenLevelAssignmentRefreshGpu.js'
      );
      const versioned = (path, ...sources) => dependencyUrl(sources, path);
      const [
        abi,
        buffersModule,
        spatialModule,
        gridModule,
        updateModule,
        workspaceModule,
        g2pModule,
        proposalModule,
        fusedModule,
        frozenAssignmentRefreshModule
      ] = await Promise.all([
        import('/ulg-gpu-abi/src/index.js'),
        import(versioned(
          '/src/runtime/sph/sphGpuBuffers.js',
          g2pSource
        )),
        import(spatialUrl),
        import(gridUrl),
        import(gridUpdateUrl),
        import(workspaceUrl),
        import(g2pUrl),
        import('/src/runtime/sph/schroederSpatialMechanicalProposalsGpu.js'),
        import(fusedUrl),
        import(frozenAssignmentRefreshUrl)
      ]);

      const particleCount = 2;
      const state = new Float32Array([
        0.9, 1, 1, 1, 0.4, 0, 0, 0,
        1.1, 1, 1, 1, 0, 0.4, 0, 0
      ]);
      const thermo = new Float32Array(particleCount * 12);
      const identity = new Uint32Array([101, 202]);
      const mechanics = new Float32Array(particleCount * 32);
      for (let index = 0; index < particleCount; index += 1) {
        thermo.set([7, 1, 300, 1000, 1, 0, 0, 0, 0.25, 1, 7, 0.001], index * 12);
        const offset = index * 32;
        mechanics.set([1, 0, 0, 0, 1, 0, 0, 0, 1], offset);
        mechanics[offset + 18] = 1;
        mechanics[offset + 19] = 0.001;
        mechanics[offset + 20] = 0;
        mechanics[offset + 21] = 1;
        mechanics[offset + 27] = 7;
        mechanics[offset + 31] = 1;
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
        identityRevision: 'native-parent-field-mechanics',
        renderDomainKeys: { 101: 'fine', 202: 'coarse' },
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
        metadata: []
      };
      const sphUpload = buffersModule.uploadSphGpuParticleBuffers(
        device,
        sphParticleState
      );
      const mlsUpload = buffersModule.uploadMlsMpmGpuParticleBuffers(
        device,
        mlsMpmParticleState
      );
      sphUpload.slot = 0;
      mlsUpload.slot = 0;

      const assignmentRows = new Float32Array(particleCount * 16);
      for (let index = 0; index < particleCount; index += 1) {
        const level = index;
        const offset = index * 16;
        assignmentRows.set([
          level, 0.25 * (2 ** level), 1, 0.001,
          0.001, 0.001, 1, 1000,
          1, 7, 1, 0.15,
          state[index * 8], state[index * 8 + 1], state[index * 8 + 2], 0
        ], offset);
      }
      const assignmentBuffer = device.createBuffer({
        label: 'native-parent-mechanics-assignment',
        size: assignmentRows.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
      });
      device.queue.writeBuffer(assignmentBuffer, 0, assignmentRows);
      const levelAssignment = {
        schema: 'peercompute.ulg.schroeder-level-assignment-execution.v0',
        status: 'schroeder-level-assignment-submitted',
        bufferFamilyGenerationStatus: 'schroeder-particle-buffer-family-generation-ready',
        particleCount,
        assignmentStrideFloats: 16,
        assignments: assignmentRows,
        assignmentBuffer,
        assignmentBufferByteLength: assignmentRows.byteLength,
        sourceStateBuffer: sphUpload.stateBuffer,
        sourceStateBufferBorrowed: true,
        sourceThermoBuffer: sphUpload.thermoBuffer,
        sourceThermoBufferBorrowed: true,
        sourceThermoBufferByteLength: sphUpload.thermoBufferByteLength,
        sourceMechanicsBuffer: mlsUpload.mechanicsBuffer,
        sourceMechanicsBufferBorrowed: true,
        sourceMechanicsBufferByteLength: mlsUpload.mechanicsBuffer.size,
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
        baseGridSpacingM: 0.25
      };
      const fineSpec = gridModule.createMlsMpmGridSpec({
        boxDimsM: [2, 2, 2],
        gridSpacingM: 0.25
      });
      const coarseSpec = gridModule.createMlsMpmGridSpec({
        boxDimsM: [2, 2, 2],
        gridSpacingM: 0.5
      });
      const generation = spatialModule.runSchroederSpatialEpochGenerationWebGpu({
        device,
        levelAssignment,
        particleCount,
        particleIdentityBuffer: sphUpload.identityBuffer,
        particleIdentityStrideWords: 1,
        phaseVolumeInterfaceProposalEnabled: true,
        mechanicsLevels: [
          {
            selectedLevel: 0,
            mechanicsGrid: {
              gridNodeCount: fineSpec.gridNodeCount,
              gridDims: fineSpec.gridDims,
              gridShift: fineSpec.shift,
              gridSpacingM: fineSpec.gridSpacingM
            }
          },
          {
            selectedLevel: 1,
            mechanicsGrid: {
              gridNodeCount: coarseSpec.gridNodeCount,
              gridDims: coarseSpec.gridDims,
              gridShift: coarseSpec.shift,
              gridSpacingM: coarseSpec.gridSpacingM
            }
          }
        ]
      });
      if (
        !generation.ready
        || !generation.parentFieldView
        || !generation.phaseVolumeInterfaceProposal
      ) {
        return {
          status: 'generation-rejected',
          reason: generation.reason || 'parent field or S9-C interface proposal missing'
        };
      }
      const phaseVolumeInterfaceProposal = generation.phaseVolumeInterfaceProposal;
      const phaseVolumeInterfaceProposalRuntime =
        generation.phaseVolumeInterfaceProposalRuntime;
      if (
        phaseVolumeInterfaceProposalRuntime?.ownsExecution?.(
          phaseVolumeInterfaceProposal
        ) !== true
        || phaseVolumeInterfaceProposalRuntime?.isExecutionSubmitted?.(
          phaseVolumeInterfaceProposal
        ) !== true
      ) {
        return {
          status: 'generation-rejected',
          reason: 'mounted S9-C interface proposal was not owned and submitted'
        };
      }
      const macroRefluxLedger = workspaceModule.createSchroederCrossLevelRefluxLedgerGpu(
        device,
        {
          parentFieldCapacity: generation.parentFieldView.parentFieldCapacity,
          coarseFieldCapacity: generation.parentFieldView.coarseFieldCapacity,
          completionOrdinal: generation.execution.generationId,
          fineSubstepCount: 1,
          fineLevel: 0,
          coarseLevel: 1,
          coarseGridSpacingM: 0.5,
          label: 'native-parent-mechanics-shared-reflux'
        }
      );

      const p2gAllocationEvidence = [];
      const p2g = async (
        selectedLevel,
        spacing,
        {
          canonicalParticleContinuation = null,
          fusedFineSubstepTransaction = null,
          fusedCoarseTerminalTransaction = null,
          sphParticleUpload = sphUpload,
          mlsMpmParticleUpload = mlsUpload,
          schroederLevelAssignment = levelAssignment,
          schroederSpatialEpochGeneration = generation
        } = {}
      ) => {
        const projection = await gridModule.runMlsMpmP2gGridProjectionWebGpu({
          device,
          sphParticleState,
          mlsMpmParticleState,
          sphParticleUpload,
          mlsMpmParticleUpload,
          schroederLevelAssignment,
          schroederSelectedLevel: selectedLevel,
          schroederSpatialEpochGeneration,
          canonicalSpatialRequired: true,
          mechanicsFieldMode: 'required',
          gridSpacingM: spacing,
          boxDimsM: [2, 2, 2],
          dt: 0.01,
          internalPressureScale: 0,
          retainGridBuffer: false,
          readbackMode: 'no-full-readback',
          ...(canonicalParticleContinuation == null
            ? {}
            : { canonicalParticleContinuation }),
          ...(fusedFineSubstepTransaction == null
            ? {}
            : { fusedFineSubstepTransaction }),
          ...(fusedCoarseTerminalTransaction == null
            ? {}
            : { fusedCoarseTerminalTransaction })
        });
        p2gAllocationEvidence.push([
          projection.denseGridBufferAllocatedBytes,
          projection.denseAccumulatorBufferAllocatedBytes
        ]);
        return projection;
      };
      const buildPredictors = async (
        fineProjection,
        coarseProjection,
        fusedFineSubstepTransaction = null
      ) => {
        const runtime = workspaceModule.createSchroederSpatialParentFieldMechanicsWorkspaceGpu(
          device,
          {
            parentFieldCapacity: generation.parentFieldView.parentFieldCapacity,
            fineFieldCapacity: generation.parentFieldView.fineFieldCapacity,
            arenaCount: 2
          }
        );
        const encoder = device.createCommandEncoder();
        const execution = runtime.encodePredictors(encoder, {
          parentFieldView: generation.parentFieldView,
          fineP2gProjection: fineProjection,
          coarseP2gProjection: coarseProjection,
          dt: 0.01,
          fineDt: 0.01,
          macroDt: 0.01,
          fineSubstepOrdinal: 0,
          fineSubstepCount: 1,
          gravityMPerS2: [0, -9.80665, 0],
          boxDimsM: [2, 2, 2],
          cflFactor: 0.4,
          maxCorrectionMPerS: 10,
          refluxLedger: macroRefluxLedger,
          ...(fusedFineSubstepTransaction == null
            ? {}
            : { fusedFineSubstepTransaction })
        });
        device.queue.submit([encoder.finish()]);
        runtime.markPredictorsSubmitted(execution);
        return { runtime, execution };
      };
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
        const bytes = readback.getMappedRange().slice(0);
        readback.unmap();
        readback.destroy();
        return {
          words: new Uint32Array(bytes),
          floats: new Float32Array(bytes)
        };
      };
      const runAtomicFoldBarrierProbe = async () => {
        const rowCount = 2048;
        const legacyFutureOffset = 4;
        const fusedFutureOffset = legacyFutureOffset + rowCount;
        const words = new Uint32Array(fusedFutureOffset + rowCount);
        const floatWord = new Float32Array(1);
        const uintWord = new Uint32Array(floatWord.buffer);
        const bitsOf = (value) => {
          floatWord[0] = Math.fround(value);
          return uintWord[0];
        };
        const prior = Math.fround(5.128190876364458e34);
        const share = Math.fround(2.5062171511525255e27);
        const future = Math.fround(prior + share);
        words[1] = bitsOf(prior);
        words[2] = bitsOf(share);
        const byteLength = words.byteLength;
        const buffer = device.createBuffer({
          label: 'native-parent-mechanics-atomic-fold-barrier',
          size: byteLength,
          usage: GPUBufferUsage.STORAGE
            | GPUBufferUsage.COPY_DST
            | GPUBufferUsage.COPY_SRC
        });
        device.queue.writeBuffer(buffer, 0, words);
        const module = device.createShaderModule({
          label: 'native-parent-mechanics-atomic-fold-barrier-wgsl',
          code: `
            @group(0) @binding(0)
            var<storage, read_write> values: array<atomic<u32>>;

            @compute @workgroup_size(1)
            fn produce_legacy_futures() {
              let prior = bitcast<f32>(atomicLoad(&values[1]));
              let share = bitcast<f32>(atomicLoad(&values[2]));
              for (var row = 0u; row < 2048u; row = row + 1u) {
                atomicStore(&values[4u + row], bitcast<u32>(prior + share));
              }
            }

            @compute @workgroup_size(1)
            fn fold_legacy_scan() {
              let prior = bitcast<f32>(atomicLoad(&values[1]));
              var folded = 0.0;
              for (var row = 0u; row < 2048u; row = row + 1u) {
                let sealed = bitcast<f32>(atomicLoad(&values[4u + row]));
                folded = folded + sealed - prior;
              }
              atomicStore(&values[0], bitcast<u32>(folded));
            }

            @compute @workgroup_size(1)
            fn fold_fused_scan() {
              let prior = bitcast<f32>(atomicLoad(&values[1]));
              let share = bitcast<f32>(atomicLoad(&values[2]));
              var folded = 0.0;
              for (var row = 0u; row < 2048u; row = row + 1u) {
                let future = prior + share;
                atomicStore(&values[2052u + row], bitcast<u32>(future));
                let sealed = bitcast<f32>(
                  atomicLoad(&values[2052u + row])
                );
                folded = folded + sealed - prior;
              }
              atomicStore(&values[1], bitcast<u32>(folded));
            }
          `
        });
        const entryPoints = [
          'produce_legacy_futures',
          'fold_legacy_scan',
          'fold_fused_scan'
        ];
        const pipelines = [];
        for (const entryPoint of entryPoints) {
          pipelines.push(await device.createComputePipelineAsync({
            label: `native-parent-mechanics-${entryPoint}-pipeline`,
            layout: 'auto',
            compute: { module, entryPoint }
          }));
        }
        const bindGroups = pipelines.map((pipeline, index) => (
          device.createBindGroup({
            label: `native-parent-mechanics-atomic-fold-barrier-bind-group-${index}`,
            layout: pipeline.getBindGroupLayout(0),
            entries: [{ binding: 0, resource: { buffer } }]
          })
        ));
        const encoder = device.createCommandEncoder();
        for (let index = 0; index < pipelines.length; index += 1) {
          const pass = encoder.beginComputePass();
          pass.setPipeline(pipelines[index]);
          pass.setBindGroup(0, bindGroups[index]);
          pass.dispatchWorkgroups(1);
          pass.end();
        }
        device.queue.submit([encoder.finish()]);
        const read = await readWords(
          buffer,
          byteLength,
          'native-parent-mechanics-atomic-fold-barrier-readback'
        );
        buffer.destroy();
        return {
          legacyBits: read.words[0],
          fusedBits: read.words[1],
          legacyFirstFutureBits: read.words[legacyFutureOffset],
          legacyLastFutureBits:
            read.words[legacyFutureOffset + rowCount - 1],
          fusedFirstFutureBits: read.words[fusedFutureOffset],
          fusedLastFutureBits:
            read.words[fusedFutureOffset + rowCount - 1],
          expectedFutureBits: bitsOf(future)
        };
      };
      const runProjectionCoverageProbe = async () => {
        const rowCount = 128;
        const fineOffset = 16;
        const coarseOffset = fineOffset + rowCount;
        const wordLength = coarseOffset + rowCount;
        const fieldSentinel = 0x13579bdf;
        const refluxSentinel = 0x2468ace0;
        const committedField = 0x10203040;
        const committedReflux = 0x50607080;
        const module = device.createShaderModule({
          label: 'native-parent-mechanics-projection-coverage-wgsl',
          code: `
            @group(0) @binding(0)
            var<storage, read_write> values: array<atomic<u32>>;

            fn identity_hash() -> u32 {
              var hash: u32 = 0x42504654u;
              hash = (hash ^ 11u) * 0x85ebca6bu;
              hash = (hash ^ 17u) * 0xc2b2ae35u;
              hash = (hash ^ 23u) * 0x27d4eb2fu;
              hash = (hash ^ 29u) * 0x165667b1u;
              hash = (hash ^ 31u) * 0x9e3779b9u;
              return hash ^ (hash >> 16u);
            }

            fn begin_token() -> u32 {
              return 0x80000000u | (identity_hash() & 0x7fffffffu);
            }

            fn row_token(kind: u32, row: u32) -> u32 {
              let payload = (
                identity_hash() ^ (row * 0x9e3779b9u)
              ) & 0x003fffffu;
              return select(
                0x7fc00000u,
                0xffc00000u,
                kind != 0u
              ) | payload;
            }

            @compute @workgroup_size(1)
            fn begin_projection() {
              atomicStore(&values[0], begin_token());
              atomicStore(&values[3], 0u);
              atomicStore(&values[6], 0u);
            }

            @compute @workgroup_size(64)
            fn project_fine(
              @builtin(global_invocation_id) id: vec3<u32>,
              @builtin(num_workgroups) groups: vec3<u32>
            ) {
              if (!all(groups == vec3<u32>(2u, 1u, 1u))
                  || id.x >= 128u) {
                return;
              }
              atomicStore(&values[16u + id.x], row_token(0u, id.x));
            }

            @compute @workgroup_size(64)
            fn project_coarse(
              @builtin(global_invocation_id) id: vec3<u32>,
              @builtin(num_workgroups) groups: vec3<u32>
            ) {
              if (!all(groups == vec3<u32>(2u, 1u, 1u))
                  || id.x >= 128u) {
                return;
              }
              atomicStore(&values[144u + id.x], row_token(1u, id.x));
            }

            @compute @workgroup_size(1)
            fn seal_projection() {
              if (atomicLoad(&values[0]) != begin_token()) {
                atomicStore(&values[6], 1u);
                return;
              }
              for (var row = 0u; row < 128u; row = row + 1u) {
                if (atomicLoad(&values[16u + row])
                    != row_token(0u, row)) {
                  atomicStore(&values[6], 1u);
                  return;
                }
              }
              for (var row = 0u; row < 128u; row = row + 1u) {
                if (atomicLoad(&values[144u + row])
                    != row_token(1u, row)) {
                  atomicStore(&values[6], 1u);
                  return;
                }
              }
              atomicStore(&values[4], 0x10203040u);
              atomicStore(&values[5], 0x50607080u);
              atomicStore(&values[3], 1u);
            }
          `
        });
        const entryPoints = [
          'begin_projection',
          'project_fine',
          'project_coarse',
          'seal_projection'
        ];
        const pipelines = [];
        for (const entryPoint of entryPoints) {
          pipelines.push(await device.createComputePipelineAsync({
            label: `native-parent-mechanics-projection-coverage-${entryPoint}`,
            layout: 'auto',
            compute: { module, entryPoint }
          }));
        }
        const indirect = (label, x) => {
          const buffer = device.createBuffer({
            label,
            size: 3 * Uint32Array.BYTES_PER_ELEMENT,
            usage: GPUBufferUsage.INDIRECT | GPUBufferUsage.COPY_DST
          });
          device.queue.writeBuffer(buffer, 0, new Uint32Array([x, 1, 1]));
          return buffer;
        };
        const fullIndirect = indirect(
          'native-parent-mechanics-projection-coverage-full-indirect',
          2
        );
        const truncatedIndirect = indirect(
          'native-parent-mechanics-projection-coverage-truncated-indirect',
          1
        );
        const runCase = async (label, fineIndirect, coarseIndirect) => {
          const initial = new Uint32Array(wordLength);
          initial[4] = fieldSentinel;
          initial[5] = refluxSentinel;
          initial.fill(0x3e800000, fineOffset, coarseOffset);
          initial.fill(0xbe800000, coarseOffset);
          const buffer = device.createBuffer({
            label: `native-parent-mechanics-projection-coverage-${label}`,
            size: initial.byteLength,
            usage: GPUBufferUsage.STORAGE
              | GPUBufferUsage.COPY_DST
              | GPUBufferUsage.COPY_SRC
          });
          device.queue.writeBuffer(buffer, 0, initial);
          const bindGroups = pipelines.map((pipeline, index) => (
            device.createBindGroup({
              label:
                `native-parent-mechanics-projection-coverage-${label}-bind-${index}`,
              layout: pipeline.getBindGroupLayout(0),
              entries: [{ binding: 0, resource: { buffer } }]
            })
          ));
          const encoder = device.createCommandEncoder();
          const pass = encoder.beginComputePass({
            label: `native-parent-mechanics-projection-coverage-${label}-pass`
          });
          pass.setPipeline(pipelines[0]);
          pass.setBindGroup(0, bindGroups[0]);
          pass.dispatchWorkgroups(1);
          pass.setPipeline(pipelines[1]);
          pass.setBindGroup(0, bindGroups[1]);
          pass.dispatchWorkgroupsIndirect(fineIndirect, 0);
          pass.setPipeline(pipelines[2]);
          pass.setBindGroup(0, bindGroups[2]);
          pass.dispatchWorkgroupsIndirect(coarseIndirect, 0);
          pass.setPipeline(pipelines[3]);
          pass.setBindGroup(0, bindGroups[3]);
          pass.dispatchWorkgroups(1);
          pass.end();
          device.queue.submit([encoder.finish()]);
          const read = await readWords(
            buffer,
            initial.byteLength,
            `native-parent-mechanics-projection-coverage-${label}-readback`
          );
          buffer.destroy();
          return {
            authority: read.words[3],
            field: read.words[4],
            reflux: read.words[5],
            rejected: read.words[6]
          };
        };
        const fineTruncated = await runCase(
          'fine-truncated',
          truncatedIndirect,
          fullIndirect
        );
        const coarseTruncated = await runCase(
          'coarse-truncated',
          fullIndirect,
          truncatedIndirect
        );
        const complete = await runCase(
          'complete',
          fullIndirect,
          fullIndirect
        );
        fullIndirect.destroy();
        truncatedIndirect.destroy();
        return {
          fieldSentinel,
          refluxSentinel,
          committedField,
          committedReflux,
          fineTruncated,
          coarseTruncated,
          complete
        };
      };
      const runRegistryCoverageProbe = async () => {
        const rowCount = 130;
        const mapOffset = 16;
        const wordLength = mapOffset + rowCount;
        const generationSentinel = 0x13579bdf;
        const committedGeneration = 0x2468ace0;
        const module = device.createShaderModule({
          label: 'native-parent-mechanics-registry-coverage-wgsl',
          code: `
            @group(0) @binding(0)
            var<storage, read_write> values: array<atomic<u32>>;

            const INVALID: u32 = 0xffffffffu;
            const ROW_COUNT: u32 = 130u;
            const MAP_OFFSET: u32 = 16u;

            fn row_index(
              id: vec3<u32>,
              groups: vec3<u32>
            ) -> u32 {
              return id.x + id.y * groups.x * 64u;
            }

            fn token() -> u32 {
              return 0x52470001u
                | select(0u, 0x00008000u, atomicLoad(&values[1]) != 0u);
            }

            fn started() -> bool {
              return atomicLoad(&values[2]) == token();
            }

            fn decoded_parent(parent: u32) -> u32 {
              let encoded = atomicLoad(&values[MAP_OFFSET + parent]);
              return select(INVALID, INVALID - encoded, encoded != 0u);
            }

            fn record_coverage(
              address: u32,
              row: u32,
              local_id: vec3<u32>
            ) {
              if (local_id.x == 0u && row < ROW_COUNT) {
                atomicAdd(&values[address], min(64u, ROW_COUNT - row));
              }
            }

            @compute @workgroup_size(1)
            fn begin_registry_probe() {
              atomicStore(&values[2], 0u);
              atomicStore(&values[3], INVALID);
              atomicStore(&values[4], INVALID);
              atomicStore(&values[5], 0u);
              atomicStore(&values[6], 0u);
              atomicStore(&values[8], 0u);
              atomicStore(&values[9], 0u);
              atomicStore(&values[10], 0u);
              atomicStore(&values[2], token());
            }

            @compute @workgroup_size(64)
            fn claim_registry_probe(
              @builtin(global_invocation_id) id: vec3<u32>,
              @builtin(local_invocation_id) local_id: vec3<u32>,
              @builtin(num_workgroups) groups: vec3<u32>
            ) {
              if (!started() || !all(groups == vec3<u32>(2u, 2u, 1u))) {
                return;
              }
              let row = row_index(id, groups);
              record_coverage(5u, row, local_id);
              if (row >= ROW_COUNT) { return; }
              var parent = row;
              if (atomicLoad(&values[0]) == 1u && row == 1u) {
                parent = 0u;
              }
              atomicMax(&values[MAP_OFFSET + parent], INVALID - row);
            }

            @compute @workgroup_size(64)
            fn register_registry_probe(
              @builtin(global_invocation_id) id: vec3<u32>,
              @builtin(local_invocation_id) local_id: vec3<u32>,
              @builtin(num_workgroups) groups: vec3<u32>
            ) {
              if (!started() || !all(groups == vec3<u32>(2u, 2u, 1u))) {
                return;
              }
              let row = row_index(id, groups);
              record_coverage(6u, row, local_id);
              if (row >= ROW_COUNT) { return; }
              let mode = atomicLoad(&values[0]);
              var parent = row;
              if (mode == 1u && row == 1u) { parent = 0u; }
              if (decoded_parent(parent) != row
                  || (mode == 3u && row == 17u)) {
                atomicMin(&values[3], row);
                return;
              }
              if (mode == 2u && row == 17u) {
                atomicMin(&values[4], row);
              }
            }

            @compute @workgroup_size(1)
            fn seal_registry_probe() {
              if (!started() || atomicLoad(&values[5]) != ROW_COUNT
                  || atomicLoad(&values[6]) != ROW_COUNT) {
                atomicAdd(&values[8], 1u);
                return;
              }
              let structural = atomicLoad(&values[3]);
              let frozen = atomicLoad(&values[4]);
              if (min(structural, frozen) != INVALID) {
                if (atomicLoad(&values[1]) == 0u && frozen < structural) {
                  atomicAdd(&values[9], 1u);
                }
                atomicAdd(&values[8], 1u);
                return;
              }
              atomicStore(&values[7], 0x2468ace0u);
            }

            @compute @workgroup_size(64)
            fn validate_registry_mass_probe(
              @builtin(global_invocation_id) id: vec3<u32>,
              @builtin(num_workgroups) groups: vec3<u32>
            ) {
              let row = row_index(id, groups);
              if (!all(groups == vec3<u32>(2u, 2u, 1u))
                  || row >= ROW_COUNT || atomicLoad(&values[0]) != 4u
                  || (row != 17u && row != 18u)) {
                return;
              }
              let prior = atomicExchange(&values[10], 1u);
              if (prior == 0u) { atomicAdd(&values[8], 1u); }
            }
          `
        });
        const entryPoints = [
          'begin_registry_probe',
          'claim_registry_probe',
          'register_registry_probe',
          'seal_registry_probe',
          'validate_registry_mass_probe'
        ];
        const pipelines = [];
        for (const entryPoint of entryPoints) {
          pipelines.push(await device.createComputePipelineAsync({
            label: `native-parent-mechanics-registry-coverage-${entryPoint}`,
            layout: 'auto',
            compute: { module, entryPoint }
          }));
        }
        const indirect = (label, dimensions) => {
          const buffer = device.createBuffer({
            label,
            size: 3 * Uint32Array.BYTES_PER_ELEMENT,
            usage: GPUBufferUsage.INDIRECT | GPUBufferUsage.COPY_DST
          });
          device.queue.writeBuffer(buffer, 0, new Uint32Array(dimensions));
          return buffer;
        };
        const fullIndirect = indirect(
          'native-parent-mechanics-registry-coverage-full-indirect',
          [2, 2, 1]
        );
        const truncatedIndirect = indirect(
          'native-parent-mechanics-registry-coverage-truncated-indirect',
          [1, 1, 1]
        );
        const runCase = async ({
          label,
          mode = 0,
          terminal = false,
          claimIndirect = fullIndirect,
          rowIndirect = fullIndirect,
          validateMass = false
        }) => {
          const initial = new Uint32Array(wordLength);
          initial[0] = mode;
          initial[1] = terminal ? 1 : 0;
          initial[7] = generationSentinel;
          const buffer = device.createBuffer({
            label: `native-parent-mechanics-registry-coverage-${label}`,
            size: initial.byteLength,
            usage: GPUBufferUsage.STORAGE
              | GPUBufferUsage.COPY_DST
              | GPUBufferUsage.COPY_SRC
          });
          device.queue.writeBuffer(buffer, 0, initial);
          const bindGroups = pipelines.map((pipeline, index) => (
            device.createBindGroup({
              label:
                `native-parent-mechanics-registry-coverage-${label}-bind-${index}`,
              layout: pipeline.getBindGroupLayout(0),
              entries: [{ binding: 0, resource: { buffer } }]
            })
          ));
          const encoder = device.createCommandEncoder();
          const pass = encoder.beginComputePass({
            label: `native-parent-mechanics-registry-coverage-${label}-pass`
          });
          pass.setPipeline(pipelines[0]);
          pass.setBindGroup(0, bindGroups[0]);
          pass.dispatchWorkgroups(1);
          pass.setPipeline(pipelines[1]);
          pass.setBindGroup(0, bindGroups[1]);
          pass.dispatchWorkgroupsIndirect(claimIndirect, 0);
          pass.setPipeline(pipelines[2]);
          pass.setBindGroup(0, bindGroups[2]);
          pass.dispatchWorkgroupsIndirect(rowIndirect, 0);
          pass.setPipeline(pipelines[3]);
          pass.setBindGroup(0, bindGroups[3]);
          pass.dispatchWorkgroups(1);
          if (validateMass) {
            pass.setPipeline(pipelines[4]);
            pass.setBindGroup(0, bindGroups[4]);
            pass.dispatchWorkgroupsIndirect(fullIndirect, 0);
          }
          pass.end();
          device.queue.submit([encoder.finish()]);
          const read = await readWords(
            buffer,
            initial.byteLength,
            `native-parent-mechanics-registry-coverage-${label}-readback`
          );
          buffer.destroy();
          return {
            structuralFailure: read.words[3],
            frozenKeyFailure: read.words[4],
            claimCoverage: read.words[5],
            rowCoverage: read.words[6],
            generation: read.words[7],
            rejectionCount: read.words[8],
            keyMismatchCount: read.words[9],
            massRejectLatch: read.words[10],
            parentZeroRaw: read.words[mapOffset],
            parentOneRaw: read.words[mapOffset + 1]
          };
        };
        const complete = await runCase({ label: 'complete' });
        const claimTruncated = await runCase({
          label: 'claim-truncated',
          claimIndirect: truncatedIndirect
        });
        const rowTruncated = await runCase({
          label: 'row-truncated',
          rowIndirect: truncatedIndirect
        });
        const duplicate = await runCase({ label: 'duplicate', mode: 1 });
        const frozenPredictor = await runCase({
          label: 'frozen-predictor',
          mode: 2
        });
        const frozenTerminal = await runCase({
          label: 'frozen-terminal',
          mode: 2,
          terminal: true
        });
        const terminalMassMissing = await runCase({
          label: 'terminal-mass-missing',
          mode: 3,
          terminal: true
        });
        const massOnce = await runCase({
          label: 'mass-once',
          mode: 4,
          validateMass: true
        });
        fullIndirect.destroy();
        truncatedIndirect.destroy();
        return {
          rowCount,
          generationSentinel,
          committedGeneration,
          complete,
          claimTruncated,
          rowTruncated,
          duplicate,
          frozenPredictor,
          frozenTerminal,
          terminalMassMissing,
          massOnce
        };
      };
      // A capture is deliberately a GPU-only copy.  M2 queues these while the
      // fused lifecycle is still running and maps them only after terminal
      // G2P has completed, so fixture diagnostics never become a host
      // readback/decision/re-enqueue seam in the authoritative hot chain.
      const captureWordsOnGpu = (buffer, byteLength, label) => {
        const capture = device.createBuffer({
          label,
          size: byteLength,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        const encoder = device.createCommandEncoder();
        encoder.copyBufferToBuffer(buffer, 0, capture, 0, byteLength);
        device.queue.submit([encoder.finish()]);
        return Object.freeze({ buffer: capture, byteLength });
      };
      const readCapturedWords = async ({ buffer, byteLength }) => {
        await buffer.mapAsync(GPUMapMode.READ);
        const bytes = buffer.getMappedRange().slice(0, byteLength);
        buffer.unmap();
        buffer.destroy();
        return {
          words: new Uint32Array(bytes),
          floats: new Float32Array(bytes)
        };
      };
      const preP2gDirectoryRead = await readWords(
        generation.execution.directoryBuffer,
        Math.min(
          generation.execution.directoryBuffer.size,
          96 * Uint32Array.BYTES_PER_ELEMENT
        ),
        'native-parent-mechanics-pre-p2g-directory-readback'
      );
      const preP2gActiveSourceRead = await readWords(
        generation.execution.activeSourceView.activeSourceViewBuffer,
        Math.min(
          generation.execution.activeSourceView.activeSourceViewBuffer.size,
          96 * Uint32Array.BYTES_PER_ELEMENT
        ),
        'native-parent-mechanics-pre-p2g-active-source-readback'
      );
      const preP2gFineMechanicsRead = await readWords(
        generation.mechanicsLevelViews[0].mechanicsView.mechanicsViewBuffer,
        Math.min(
          generation.mechanicsLevelViews[0].mechanicsView.mechanicsViewBuffer.size,
          96 * Uint32Array.BYTES_PER_ELEMENT
        ),
        'native-parent-mechanics-pre-p2g-fine-mechanics-readback'
      );
      const preP2gCoarseMechanicsRead = await readWords(
        generation.mechanicsLevelViews[1].mechanicsView.mechanicsViewBuffer,
        Math.min(
          generation.mechanicsLevelViews[1].mechanicsView.mechanicsViewBuffer.size,
          96 * Uint32Array.BYTES_PER_ELEMENT
        ),
        'native-parent-mechanics-pre-p2g-coarse-mechanics-readback'
      );
      const preP2gFineFieldRead = await readWords(
        generation.parentFieldView.fineFieldView.fieldViewBuffer,
        Math.min(
          generation.parentFieldView.fineFieldView.fieldViewBuffer.size,
          80 * Uint32Array.BYTES_PER_ELEMENT
        ),
        'native-parent-mechanics-pre-p2g-fine-field-readback'
      );
      const preP2gCoarseFieldRead = await readWords(
        generation.parentFieldView.coarseFieldView.fieldViewBuffer,
        Math.min(
          generation.parentFieldView.coarseFieldView.fieldViewBuffer.size,
          80 * Uint32Array.BYTES_PER_ELEMENT
        ),
        'native-parent-mechanics-pre-p2g-coarse-field-readback'
      );
      const phaseVolumeInterfaceProposalRead = m0Only
        ? await readWords(
            phaseVolumeInterfaceProposal.controlBuffer,
            phaseVolumeInterfaceProposal.layout.controlByteLength,
            'native-parent-mechanics-m0-phase-volume-interface-readback'
          )
        : null;
      const finePhaseVolumeMomentRead = m0Only
        ? await readWords(
            generation.mechanicsLevelViews[0].phaseVolumeMoment.controlBuffer,
            generation.mechanicsLevelViews[0].phaseVolumeMoment.layout.controlByteLength,
            'native-parent-mechanics-m0-fine-phase-volume-moment-readback'
          )
        : null;
      const coarsePhaseVolumeMomentRead = m0Only
        ? await readWords(
            generation.mechanicsLevelViews[1].phaseVolumeMoment.controlBuffer,
            generation.mechanicsLevelViews[1].phaseVolumeMoment.layout.controlByteLength,
            'native-parent-mechanics-m0-coarse-phase-volume-moment-readback'
          )
        : null;
      const finePhaseVolumeReceiptRead = m0Only
        ? await readWords(
            generation.mechanicsLevelViews[0].phaseVolumeReceipt.controlBuffer,
            generation.mechanicsLevelViews[0].phaseVolumeReceipt.layout.controlByteLength,
            'native-parent-mechanics-m0-fine-phase-volume-receipt-readback'
          )
        : null;
      const coarsePhaseVolumeReceiptRead = m0Only
        ? await readWords(
            generation.mechanicsLevelViews[1].phaseVolumeReceipt.controlBuffer,
            generation.mechanicsLevelViews[1].phaseVolumeReceipt.layout.controlByteLength,
            'native-parent-mechanics-m0-coarse-phase-volume-receipt-readback'
          )
        : null;

      const m1Fused = (m1Only || m2Only)
        ? (() => {
            const canonicalEpoch = Object.freeze({
              generation,
              sphParticleUpload: sphUpload,
              mlsMpmParticleUpload: mlsUpload
            });
            const macroAuthority = fusedModule.createSchroederTwoLevelMacroAuthority({
              device,
              canonicalEpoch,
              refluxLedger: macroRefluxLedger,
              fineSubstepCount: 1,
              fineLevel: 0,
              coarseLevel: 1,
              fineDt: 0.01,
              macroDt: 0.01
            });
            const particleContinuation =
              fusedModule.createSchroederCanonicalParticleContinuation({
                device,
                macroAuthority,
                sphParticleUpload: sphUpload,
                mlsMpmParticleUpload: mlsUpload,
                ordinal: 0
              });
            const microepochAuthority =
              fusedModule.createSchroederFineMicroepochAuthority({
                device,
                macroAuthority,
                canonicalEpoch,
                particleContinuation,
                substepOrdinal: 0
              });
            return Object.freeze({
              transaction: fusedModule.createSchroederFusedFineSubstepTransaction({
                device,
                macroAuthority,
                microepochAuthority,
                particleContinuation,
                substepOrdinal: 0
              }),
              particleContinuation
            });
          })()
        : null;
      let fineProjection = await p2g(0, 0.25, {
        canonicalParticleContinuation: m1Fused?.particleContinuation ?? null,
        fusedFineSubstepTransaction: m1Fused?.transaction ?? null
      });
      let coarseProjection = await p2g(1, 0.5);
      const fineWorkspace = await buildPredictors(
        fineProjection,
        coarseProjection,
        m1Fused?.transaction ?? null
      );
      const baselineWorkspaceRead = await readWords(
        fineWorkspace.execution.workspaceBuffer,
        fineWorkspace.execution.layout.byteLength,
        'native-parent-mechanics-m0-workspace-readback'
      );
      const parentHeaderRead = await readWords(
        generation.parentFieldView.parentFieldViewBuffer,
        80 * Uint32Array.BYTES_PER_ELEMENT,
        'native-parent-mechanics-m0-parent-header-readback'
      );
      const fineHeaderRead = await readWords(
        generation.parentFieldView.fineFieldView.fieldViewBuffer,
        64 * Uint32Array.BYTES_PER_ELEMENT,
        'native-parent-mechanics-m0-fine-header-readback'
      );
      const coarseHeaderRead = await readWords(
        generation.parentFieldView.coarseFieldView.fieldViewBuffer,
        64 * Uint32Array.BYTES_PER_ELEMENT,
        'native-parent-mechanics-m0-coarse-header-readback'
      );
      const runMalformedHeader = async ({ fieldView, word, value, label }) => {
        const original = fieldView === generation.parentFieldView.fineFieldView
          ? fineHeaderRead.words[word]
          : coarseHeaderRead.words[word];
        device.queue.writeBuffer(
          fieldView.fieldViewBuffer,
          word * Uint32Array.BYTES_PER_ELEMENT,
          new Uint32Array([value])
        );
        const attempt = await buildPredictors(fineProjection, coarseProjection);
        const attemptRead = await readWords(
          attempt.execution.workspaceBuffer,
          attempt.execution.layout.byteLength,
          `native-parent-mechanics-m0-${label}-readback`
        );
        device.queue.writeBuffer(
          fieldView.fieldViewBuffer,
          word * Uint32Array.BYTES_PER_ELEMENT,
          new Uint32Array([original])
        );
        const fence = device.queue.onSubmittedWorkDone();
        await attempt.runtime.releaseExecutionAfter(attempt.execution, fence);
        attempt.runtime.destroy();
        return {
          flags: attemptRead.words[2],
          invalidSourceCount: attemptRead.words[37],
          parentMask: attemptRead.words[60],
          fineMask: attemptRead.words[61],
          coarseMask: attemptRead.words[62]
        };
      };
      const malformed = m0Only ? {
        fineActiveEnd: await runMalformedHeader({
          fieldView: generation.parentFieldView.fineFieldView,
          word: 41,
          value: fineHeaderRead.words[41] + 1,
          label: 'bad-fine-active-end'
        }),
        coarseCapacityEnd: await runMalformedHeader({
          fieldView: generation.parentFieldView.coarseFieldView,
          word: 42,
          value: coarseHeaderRead.words[42] - 1,
          label: 'bad-coarse-capacity-end'
        }),
        fineKeyOffset: await runMalformedHeader({
          fieldView: generation.parentFieldView.fineFieldView,
          word: 26,
          value: fineHeaderRead.words[26] + 1,
          label: 'bad-fine-key-offset'
        }),
        coarseStateStride: await runMalformedHeader({
          fieldView: generation.parentFieldView.coarseFieldView,
          word: 31,
          value: 7,
          label: 'bad-coarse-state-stride'
        })
      } : null;
      if (m0Only) {
        const refluxRead = await readWords(
          macroRefluxLedger.buffer,
          macroRefluxLedger.byteLength,
          'native-parent-mechanics-m0-reflux-readback'
        );
        const validationError = await device.popErrorScope();
        await new Promise((resolve) => setTimeout(resolve, 50));
        const result = {
          status: 'm0-complete',
          workspaceFlags: baselineWorkspaceRead.words[2],
          workspacePhase: baselineWorkspaceRead.words[36],
          workspaceInvalidSourceCount: baselineWorkspaceRead.words[37],
          restrictedEdgeCount: baselineWorkspaceRead.words[42],
          parentFlags: parentHeaderRead.words[2],
          parentFineAdmissionMask: parentHeaderRead.words[78],
          parentCoarseAdmissionMask: parentHeaderRead.words[79],
          fineFlags: fineHeaderRead.words[2],
          fineFieldCount: fineHeaderRead.words[34],
          fineFieldCapacity: fineHeaderRead.words[32],
          fineActiveRequiredWords: fineHeaderRead.words[41],
          fineCapacityWords: fineHeaderRead.words[42],
          coarseFlags: coarseHeaderRead.words[2],
          coarseFieldCount: coarseHeaderRead.words[34],
          coarseFieldCapacity: coarseHeaderRead.words[32],
          coarseActiveRequiredWords: coarseHeaderRead.words[41],
          coarseCapacityWords: coarseHeaderRead.words[42],
          refluxFlags: refluxRead.words[2],
          refluxRowCount: refluxRead.words[4],
          refluxPhase: refluxRead.words[59],
          phaseVolumeInterfaceProposal: {
            enabled: generation.phaseVolumeInterfaceProposalEnabled === true,
            submitted: phaseVolumeInterfaceProposal.submitPerformed === true,
            owned: phaseVolumeInterfaceProposalRuntime.ownsExecution(
              phaseVolumeInterfaceProposal
            ) === true,
            twoLevel: phaseVolumeInterfaceProposal.twoLevel === true,
            fineReceiptMatches:
              phaseVolumeInterfaceProposal.fineReceipt
                === generation.mechanicsLevelViews[0].phaseVolumeReceipt,
            coarseReceiptMatches:
              phaseVolumeInterfaceProposal.coarseReceipt
                === generation.mechanicsLevelViews[1].phaseVolumeReceipt,
            parentFieldMatches:
              phaseVolumeInterfaceProposal.parentFieldView
                === generation.parentFieldView,
            dispatchCount: phaseVolumeInterfaceProposal.encodedDispatchCount,
            diagnosticOnly: phaseVolumeInterfaceProposal.diagnosticOnly === true,
            stateMutationAllowed:
              phaseVolumeInterfaceProposal.stateMutationAllowed === true,
            readbackPerformed: phaseVolumeInterfaceProposal.readbackPerformed === true,
            fullParticleReadbackPerformed:
              phaseVolumeInterfaceProposal.fullParticleReadbackPerformed === true,
            header: Array.from(phaseVolumeInterfaceProposalRead.words)
          },
          phaseVolumeMoments: {
            fineHeader: Array.from(finePhaseVolumeMomentRead.words),
            coarseHeader: Array.from(coarsePhaseVolumeMomentRead.words)
          },
          phaseVolumeReceipts: {
            fineHeader: Array.from(finePhaseVolumeReceiptRead.words),
            coarseHeader: Array.from(coarsePhaseVolumeReceiptRead.words)
          },
          preP2g: {
            directory: Array.from(preP2gDirectoryRead.words),
            activeSource: Array.from(preP2gActiveSourceRead.words),
            fineMechanics: Array.from(preP2gFineMechanicsRead.words),
            coarseMechanics: Array.from(preP2gCoarseMechanicsRead.words),
            fineField: Array.from(preP2gFineFieldRead.words),
            coarseField: Array.from(preP2gCoarseFieldRead.words)
          },
          malformed,
          validationError: validationError?.message || null,
          errors
        };
        const fence = device.queue.onSubmittedWorkDone();
        await fineWorkspace.runtime.releaseExecutionAfter(
          fineWorkspace.execution,
          fence
        );
        fineWorkspace.runtime.destroy();
        macroRefluxLedger.destroy();
        spatialModule.releaseSchroederSpatialEpochGenerationAfterQueue(
          generation,
          device
        );
        await generation.releasePromise;
        assignmentBuffer.destroy();
        buffersModule.destroySphGpuParticleBuffers(sphUpload);
        buffersModule.destroyMlsMpmGpuParticleBuffers(mlsUpload);
        return result;
      }
      const fineUpdate = await updateModule.runMlsMpmGridUpdateWebGpu({
        device,
        p2gGridProjection: fineProjection,
        mechanicsFieldMode: 'required',
        dt: 0.01,
        gravityMPerS2: [0, -9.80665, 0],
        boxDimsM: [2, 2, 2],
        mechanicsFieldEnergyReceipt: { deferSeal: true },
        retainUpdatedGridBuffer: false,
        readbackMode: 'no-full-readback',
        ...(m1Fused == null
          ? {}
          : { fusedFineSubstepTransaction: m1Fused.transaction })
      });
      const fineEncoder = device.createCommandEncoder();
      let correctedFineUpdate;
      try {
        correctedFineUpdate = fineWorkspace.runtime.encodeFineCorrection(
          fineEncoder,
          fineWorkspace.execution,
          {
            fineGridUpdate: fineUpdate,
            deltaScale: 1,
            maxCorrectionMPerS: 10,
            ...(m1Fused == null
              ? {}
              : { fusedFineSubstepTransaction: m1Fused.transaction })
          }
        );
      } catch (error) {
        const fieldView = generation.parentFieldView.fineFieldView;
        throw new Error(`${error?.message || error}; diagnostic=${JSON.stringify({
          predictorSubmitted: fineWorkspace.execution.predictorSubmitted,
          receipt: fineUpdate?.mechanicsFieldEnergyReceipt,
          submittedValidation:
            updateModule.validateSubmittedMlsMpmMechanicsFieldGridUpdate(
              device,
              fineUpdate,
              {
                sourceProjection: fineProjection,
                fieldExecution: fieldView,
                requireDeferred: true
              }
            ),
          currentState: fieldView.ownerRuntime?.isCurrentStateArtifact?.(
            fieldView,
            {
              mutationOrdinal:
                fineUpdate?.mechanicsFieldMutationOutputOrdinal,
              stateEncoding:
                fineUpdate?.mechanicsFieldMutationOutputStateEncoding
            }
          ),
          updateBackend: fineUpdate?.backend,
          updateStatus: fineUpdate?.status,
          updateSourceExact: fineUpdate?.sourceProjection === fineProjection,
          updateFieldExact: fineUpdate?.mechanicsFieldViewExecution === fieldView,
          updateBufferExact:
            fineUpdate?.mechanicsFieldViewBuffer === fieldView.fieldViewBuffer,
          updateInputOrdinal: fineUpdate?.mechanicsFieldMutationInputOrdinal,
          projectionOutputOrdinal:
            fineProjection?.mechanicsFieldMutationOutputOrdinal,
          updateOutputOrdinal: fineUpdate?.mechanicsFieldMutationOutputOrdinal,
          updateOutputEncoding:
            fineUpdate?.mechanicsFieldMutationOutputStateEncoding,
          updateByteLength: fineUpdate?.mechanicsFieldViewByteLength,
          fieldByteLength: fieldView.fieldViewBuffer?.size,
          fieldStateSubmittedInPlace:
            fineUpdate?.fieldStateUpdateSubmittedInPlace,
          fieldStateUpdatedInPlace: fineUpdate?.fieldStateUpdatedInPlace,
          normalHotLoopReadbackFree: fineUpdate?.normalHotLoopReadbackFree,
          readbackTelemetryComplete: fineUpdate?.readbackTelemetryComplete,
          readbackTelemetryUnknownSources:
            fineUpdate?.readbackTelemetryUnknownSources,
          observedMapAsyncCount: fineUpdate?.observedMapAsyncCount,
          observedReadbackBytes: fineUpdate?.observedReadbackBytes,
          observedHostQueueFenceCount:
            fineUpdate?.observedHostQueueFenceCount,
          readbackTelemetrySourceBreakdown:
            fineUpdate?.readbackTelemetrySourceBreakdown
        })}`);
      }
      device.queue.submit([fineEncoder.finish()]);
      if (m1Fused != null) {
        fineWorkspace.runtime.markTerminalSubmissionObserved?.(
          fineWorkspace.execution
        );
      }
      fineWorkspace.runtime.markTerminalSubmitted(fineWorkspace.execution);
      let fineWorkspaceRead = null;
      let fineFieldRead = null;
      if (!m2Only) {
        fineWorkspaceRead = await readWords(
          fineWorkspace.execution.workspaceBuffer,
          fineWorkspace.execution.layout.byteLength,
          'native-parent-mechanics-fine-workspace-readback'
        );
        fineFieldRead = await readWords(
          generation.parentFieldView.fineFieldView.fieldViewBuffer,
          generation.parentFieldView.fineFieldView.layout.byteLength,
          'native-parent-mechanics-fine-field-readback'
        );
      }
      if (m2Only) {
        const inputStateWords = new Uint32Array(
          state.buffer,
          state.byteOffset,
          state.length
        );
        const inputMechanicsWords = new Uint32Array(
          mechanics.buffer,
          mechanics.byteOffset,
          mechanics.length
        );
        const proposalFor = (gridSpacingM, selectedLevel) =>
          proposalModule.runSchroederSpatialMechanicalProposalWebGpu({
            cleanupPassBudget: 1024,
            device,
            generation,
            sphParticleState,
            mlsMpmParticleState,
            sphParticleUpload: sphUpload,
            mlsMpmParticleUpload: mlsUpload,
            boxDimsM: [2, 2, 2],
            gridSpacingM,
            selectedLevel,
            relaxation: 0,
            normalVelocityDamping: 0
          });
        const g2pOptions = (
          gridUpdate,
          selectedLevel,
          proposal,
          {
            sphParticleUpload = sphUpload,
            mlsMpmParticleUpload = mlsUpload,
            schroederSpatialEpochGeneration = generation,
            fusedFineSubstepTransaction = null,
            fusedCoarseTerminalTransaction = null
          } = {}
        ) => ({
          device,
          sphParticleState,
          mlsMpmParticleState,
          gridUpdate,
          sphParticleUpload,
          mlsMpmParticleUpload,
          dt: 0.01,
          boxDimsM: [2, 2, 2],
          internalPressureScale: 0,
          liquidWallDampingAlpha: 0,
          liquidWallDampingDistanceM: 0,
          particleSeparationRelaxation: 0,
          particleSeparationVelocityDamping: 0,
          schroederSelectedLevel: selectedLevel,
          schroederSpatialEpochGeneration,
          schroederSpatialMechanicalProposal: proposal,
          canonicalSpatialRequired: true,
          observeCanonicalSpatialAuthority: false,
          mechanicsFieldMode: 'required',
          retainOutputParticleBuffers: true,
          readbackMode: 'no-full-readback',
          ...(fusedFineSubstepTransaction == null
            ? {}
            : { fusedFineSubstepTransaction }),
          ...(fusedCoarseTerminalTransaction == null
            ? {}
            : { fusedCoarseTerminalTransaction })
        });

        const fineG2p = await g2pModule.runMlsMpmG2pWebGpu(
          g2pOptions(correctedFineUpdate, 0, null, {
            fusedFineSubstepTransaction: m1Fused.transaction
          })
        );
        const postFineRefluxCapture = captureWordsOnGpu(
          macroRefluxLedger.buffer,
          macroRefluxLedger.byteLength,
          'native-parent-mechanics-m2-post-fine-reflux-capture'
        );
        if (mlsUpload.storageGeneration !== sphUpload.storageGeneration) {
          throw new Error('M2 fixture requires one source particle buffer-family generation');
        }
        const terminalStorageGeneration = sphUpload.storageGeneration + 1;
        const terminalEpochIdentity = Object.freeze({
          physicsTick: levelAssignment.physicsTick,
          physicsSubstep: levelAssignment.physicsSubstep + 1,
          positionEpoch: levelAssignment.positionEpoch + 1,
          topologyEpoch: levelAssignment.topologyEpoch,
          chartEpoch: levelAssignment.chartEpoch,
          levelEpoch: levelAssignment.levelEpoch,
          supportEpoch: levelAssignment.supportEpoch
        });
        const terminalSphUpload = {
          ...sphUpload,
          status: 'webgpu-uploaded',
          stateBuffer: fineG2p.stateBuffer,
          stateBufferByteLength: fineG2p.stateBufferByteLength,
          storageGeneration: terminalStorageGeneration,
          bufferFamilyGeneration: terminalStorageGeneration,
          bufferFamilyGenerationStatus:
            'schroeder-particle-buffer-family-generation-ready',
          ...terminalEpochIdentity,
          ownsStateBuffer: true,
          slot: 1,
          sourceSlot: 0,
          nextSlot: 1
        };
        const terminalMlsUpload = {
          ...mlsUpload,
          status: 'webgpu-uploaded',
          mechanicsBuffer: fineG2p.mechanicsBuffer,
          mechanicsBufferByteLength: fineG2p.mechanicsBufferByteLength,
          storageGeneration: terminalStorageGeneration,
          bufferFamilyGeneration: terminalStorageGeneration,
          bufferFamilyGenerationStatus:
            'schroeder-particle-buffer-family-generation-ready',
          ...terminalEpochIdentity,
          ownsMechanicsBuffer: true,
          slot: 1,
          sourceSlot: 0,
          nextSlot: 1
        };
        const terminalAssignmentRefreshRuntime =
          frozenAssignmentRefreshModule.createSchroederFrozenLevelAssignmentRefreshGpu(
            device,
            { maxParticleCount: particleCount, arenaCount: 1 }
          );
        const terminalFineSubstepAuthority =
          terminalAssignmentRefreshRuntime.proveFineSubstepAuthority({
            priorLevelAssignment: levelAssignment,
            currentSphParticleUpload: terminalSphUpload,
            currentMlsMpmParticleUpload: terminalMlsUpload,
            physicsTick: terminalSphUpload.physicsTick,
            physicsSubstep: terminalSphUpload.physicsSubstep
          });
        const terminalRefreshEncoder = device.createCommandEncoder();
        const terminalLevelAssignment = terminalAssignmentRefreshRuntime.encode(
          terminalRefreshEncoder,
          {
            priorLevelAssignment: levelAssignment,
            currentSphParticleUpload: terminalSphUpload,
            currentMlsMpmParticleUpload: terminalMlsUpload,
            frozenFineSubstepAuthorityProof: terminalFineSubstepAuthority,
            physicsTick: terminalSphUpload.physicsTick,
            physicsSubstep: terminalSphUpload.physicsSubstep
          }
        );
        device.queue.submit([terminalRefreshEncoder.finish()]);
        if (!terminalAssignmentRefreshRuntime.markExecutionSubmitted(
          terminalLevelAssignment
        )) {
          throw new Error('M2 fused terminal frozen assignment refresh was not submitted');
        }
        const terminalGeneration = spatialModule.runSchroederSpatialEpochGenerationWebGpu({
          device,
          levelAssignment: terminalLevelAssignment,
          particleCount,
          particleIdentityBuffer: terminalSphUpload.identityBuffer,
          particleIdentityStrideWords: 1,
          phaseVolumeInterfaceProposalEnabled: true,
          mechanicsLevels: [
            {
              selectedLevel: 0,
              mechanicsGrid: {
                gridNodeCount: fineSpec.gridNodeCount,
                gridDims: fineSpec.gridDims,
                gridShift: fineSpec.shift,
                gridSpacingM: fineSpec.gridSpacingM
              }
            },
            {
              selectedLevel: 1,
              mechanicsGrid: {
                gridNodeCount: coarseSpec.gridNodeCount,
                gridDims: coarseSpec.gridDims,
                gridShift: coarseSpec.shift,
                gridSpacingM: coarseSpec.gridSpacingM
              }
            }
          ]
        });
        if (!terminalGeneration.ready || !terminalGeneration.parentFieldView) {
          throw new Error('M2 fused terminal requires a refreshed sparse generation');
        }
        const terminalCanonicalEpoch = Object.freeze({
          generation: terminalGeneration,
          sphParticleUpload: terminalSphUpload,
          mlsMpmParticleUpload: terminalMlsUpload
        });
        const terminalContinuation =
          fusedModule.createSchroederCanonicalParticleContinuation({
            device,
            macroAuthority: m1Fused.transaction.macroAuthority,
            sphParticleUpload: terminalSphUpload,
            mlsMpmParticleUpload: terminalMlsUpload,
            ordinal: 1,
            priorContinuation: m1Fused.particleContinuation,
            sourceTransaction: m1Fused.transaction,
            g2pReconstruction: fineG2p
          });
        const terminalMicroepochAuthority =
          fusedModule.createSchroederFineMicroepochAuthority({
            device,
            macroAuthority: m1Fused.transaction.macroAuthority,
            canonicalEpoch: terminalCanonicalEpoch,
            particleContinuation: terminalContinuation,
            priorMicroepochAuthority: m1Fused.transaction.microepochAuthority,
            substepOrdinal: 1
          });
        const terminalTransaction =
          fusedModule.createSchroederFusedCoarseTerminalTransaction({
            device,
            macroAuthority: m1Fused.transaction.macroAuthority,
            microepochAuthority: terminalMicroepochAuthority,
            particleContinuation: terminalContinuation
          });
        const terminalCoarseProjection = await p2g(1, 0.5, {
          canonicalParticleContinuation: terminalContinuation,
          fusedCoarseTerminalTransaction: terminalTransaction,
          sphParticleUpload: terminalSphUpload,
          mlsMpmParticleUpload: terminalMlsUpload,
          schroederLevelAssignment: terminalLevelAssignment,
          schroederSpatialEpochGeneration: terminalGeneration
        });
        // Deliberately make the actual retained-projection coarse update lose
        // a little more kinetic energy than the theta predictor.  The mismatch
        // is fixed from fixture inputs rather than derived from a fine-phase
        // readback, keeping the whole fused fine-to-terminal sequence GPU
        // resident while still proving nonzero causal terminal allocation.
        const manufacturedVelocityDeltaMPerS = 0.05;
        const manufacturedAcceleration = manufacturedVelocityDeltaMPerS / 0.01;
        const baselineGravity = [0, -9.80665, 0];
        const manufacturedGravity = [
          baselineGravity[0],
          baselineGravity[1] - manufacturedAcceleration,
          baselineGravity[2]
        ];
        const coarseGridUpdate = await updateModule.runMlsMpmGridUpdateWebGpu({
          device,
          p2gGridProjection: terminalCoarseProjection,
          mechanicsFieldMode: 'required',
          fusedCoarseTerminalTransaction: terminalTransaction,
          dt: 0.01,
          gravityMPerS2: manufacturedGravity,
          boxDimsM: [2, 2, 2],
          mechanicsFieldEnergyReceipt: { deferSeal: true },
          retainUpdatedGridBuffer: false,
          readbackMode: 'no-full-readback'
        });
        const coarseLayout = terminalGeneration.parentFieldView.coarseFieldView.layout;
        const preTerminalCoarseFieldCapture = captureWordsOnGpu(
          terminalGeneration.parentFieldView.coarseFieldView.fieldViewBuffer,
          coarseLayout.byteLength,
          'native-parent-mechanics-m2-pre-terminal-coarse-field-capture'
        );
        const preTerminalRefluxCapture = captureWordsOnGpu(
          macroRefluxLedger.buffer,
          macroRefluxLedger.byteLength,
          'native-parent-mechanics-m2-pre-terminal-reflux-capture'
        );

        const terminalEncoder = device.createCommandEncoder();
        let terminalGridUpdate;
        try {
          terminalGridUpdate = fineWorkspace.runtime.encodeCoarseTerminal(
            terminalEncoder,
            {
              parentFieldView: terminalGeneration.parentFieldView,
              coarseGridUpdate,
              refluxLedger: macroRefluxLedger,
              fineSubstepCount: 1,
              fineDt: 0.01,
              fusedCoarseTerminalTransaction: terminalTransaction
            }
          );
        } catch (error) {
          const fieldView = terminalGeneration.parentFieldView.coarseFieldView;
          throw new Error(`${error?.message || error}; diagnostic=${JSON.stringify({
            receipt: coarseGridUpdate?.mechanicsFieldEnergyReceipt,
            submittedValidation:
              updateModule.validateSubmittedMlsMpmMechanicsFieldGridUpdate(
                device,
                coarseGridUpdate,
                {
                  sourceProjection: terminalCoarseProjection,
                  fieldExecution: fieldView,
                  requireDeferred: true
                }
              ),
            currentState: fieldView.ownerRuntime?.isCurrentStateArtifact?.(
              fieldView,
              {
                mutationOrdinal:
                  coarseGridUpdate?.mechanicsFieldMutationOutputOrdinal,
                stateEncoding:
                  coarseGridUpdate?.mechanicsFieldMutationOutputStateEncoding
              }
            ),
            updateByteLength: coarseGridUpdate?.mechanicsFieldViewByteLength,
            fieldByteLength: fieldView.fieldViewBuffer?.size,
            updateSourceExact:
              coarseGridUpdate?.sourceProjection === terminalCoarseProjection
          })}`);
        }
        device.queue.submit([terminalEncoder.finish()]);
        const terminalExecution =
          terminalGridUpdate.parentFieldMechanicsWorkspaceExecution;
        fineWorkspace.runtime.markTerminalSubmissionObserved(terminalExecution);
        fineWorkspace.runtime.markTerminalSubmitted(terminalExecution);
        const terminalWorkspaceCapture = captureWordsOnGpu(
          terminalExecution.workspaceBuffer,
          terminalExecution.layout.byteLength,
          'native-parent-mechanics-m2-terminal-workspace-capture'
        );
        const terminalCoarseFieldCapture = captureWordsOnGpu(
          terminalGeneration.parentFieldView.coarseFieldView.fieldViewBuffer,
          coarseLayout.byteLength,
          'native-parent-mechanics-m2-terminal-coarse-field-capture'
        );
        const terminalRefluxCapture = captureWordsOnGpu(
          macroRefluxLedger.buffer,
          macroRefluxLedger.byteLength,
          'native-parent-mechanics-m2-terminal-reflux-capture'
        );

        const f32 = (value) => Math.fround(value);
        const f32Bits = (value) => {
          const one = new Float32Array([f32(value)]);
          return new Uint32Array(one.buffer)[0];
        };
        const f32Sum = (values) => values.reduce(
          (sum, value) => f32(sum + value),
          f32(0)
        );
        const coarseG2pRunOptions = g2pOptions(
          terminalGridUpdate,
          1,
          null,
          {
            sphParticleUpload: terminalSphUpload,
            mlsMpmParticleUpload: terminalMlsUpload,
            schroederSpatialEpochGeneration: terminalGeneration,
            fusedCoarseTerminalTransaction: terminalTransaction
          }
        );
        const clonedTerminalGridUpdate = Object.defineProperties(
          {},
          Object.getOwnPropertyDescriptors(terminalGridUpdate)
        );
        let clonedTerminalArtifactRejection = null;
        try {
          await g2pModule.runMlsMpmG2pWebGpu(g2pOptions(
            clonedTerminalGridUpdate,
            1,
            null,
            {
              sphParticleUpload: terminalSphUpload,
              mlsMpmParticleUpload: terminalMlsUpload,
              schroederSpatialEpochGeneration: terminalGeneration,
              fusedCoarseTerminalTransaction: terminalTransaction
            }
          ));
        } catch (error) {
          clonedTerminalArtifactRejection = {
            name: error?.name ?? null,
            code: error?.code ?? null,
            status: error?.status ?? null,
            message: error instanceof Error ? error.message : String(error)
          };
        }
        if (clonedTerminalArtifactRejection == null) {
          throw new Error(
            'descriptor-preserving cloned terminal artifact unexpectedly reached G2P'
          );
        }
        const coarseG2p = await g2pModule.runMlsMpmG2pWebGpu(
          coarseG2pRunOptions
        );
        let replayError = null;
        try {
          await g2pModule.runMlsMpmG2pWebGpu(coarseG2pRunOptions);
        } catch (error) {
          replayError = error;
        }
        if (replayError == null) {
          throw new Error('fused M2 replay unexpectedly encoded a second G2P');
        }
        const fineSuccessorState = await readWords(
          fineG2p.stateBuffer,
          fineG2p.stateBufferByteLength,
          'native-parent-mechanics-m2-fine-successor-state-readback'
        );
        const fineSuccessorMechanics = await readWords(
          fineG2p.mechanicsBuffer,
          fineG2p.mechanicsBufferByteLength,
          'native-parent-mechanics-m2-fine-successor-mechanics-readback'
        );
        const postFineReflux = await readCapturedWords(postFineRefluxCapture);
        const coarseImpulse = Array.from(postFineReflux.floats.slice(19, 22));
        const coarseImpulseNorm = Math.hypot(...coarseImpulse);
        if (!(coarseImpulseNorm > 0) || !Number.isFinite(coarseImpulseNorm)) {
          throw new Error('M2 fixture requires a nonzero authenticated coarse impulse');
        }
        const preTerminalCoarseField = await readCapturedWords(
          preTerminalCoarseFieldCapture
        );
        const preTerminalReflux = await readCapturedWords(preTerminalRefluxCapture);
        const terminalWorkspace = await readCapturedWords(terminalWorkspaceCapture);
        const terminalCoarseField = await readCapturedWords(terminalCoarseFieldCapture);
        const terminalReflux = await readCapturedWords(terminalRefluxCapture);
        const coarseCandidateState = await readWords(
          coarseG2p.stateBuffer,
          coarseG2p.stateBufferByteLength,
          'native-parent-mechanics-m2-coarse-candidate-state-readback'
        );
        const coarseCandidateMechanics = await readWords(
          coarseG2p.mechanicsBuffer,
          coarseG2p.mechanicsBufferByteLength,
          'native-parent-mechanics-m2-coarse-candidate-mechanics-readback'
        );
        const postCoarseField = await readWords(
          terminalGeneration.parentFieldView.coarseFieldView.fieldViewBuffer,
          coarseLayout.byteLength,
          'native-parent-mechanics-m2-post-coarse-field-readback'
        );
        const postCoarseReflux = await readWords(
          macroRefluxLedger.buffer,
          macroRefluxLedger.byteLength,
          'native-parent-mechanics-m2-post-coarse-reflux-readback'
        );
        const rowCount = terminalReflux.words[4];
        const rowHeat = [];
        const rowDeltaK = [];
        const rowVirtualDeltaK = [];
        const rowVelocityResidual = [];
        const rowAppliedMomentumExact = [];
        const rowPersistentEvidenceExact = [];
        const rowCausalAssociation = [];
        for (let field = 0; field < rowCount; field += 1) {
          const row = abi.SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_HEADER_WORDS
            + field * abi.SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_ROW_WORDS;
          const stateRow = coarseLayout.stateOffsetWords
            + field * coarseLayout.stateWords;
          const mass = terminalCoarseField.floats[stateRow];
          const prior = Array.from(
            preTerminalCoarseField.floats.slice(stateRow + 1, stateRow + 4)
          );
          const future = Array.from(
            terminalCoarseField.floats.slice(stateRow + 1, stateRow + 4)
          );
          const impulse = Array.from(terminalReflux.floats.slice(row + 5, row + 8));
          const expectedDeltaK = f32(
            prior[0] * impulse[0]
              + prior[1] * impulse[1]
              + prior[2] * impulse[2]
              + 0.5 * (
                impulse[0] * impulse[0]
                  + impulse[1] * impulse[1]
                  + impulse[2] * impulse[2]
              ) / mass
          );
          rowHeat.push(terminalReflux.floats[row + 8]);
          rowDeltaK.push(terminalReflux.floats[row + 9]);
          rowVirtualDeltaK.push(preTerminalReflux.floats[row + 9]);
          rowVelocityResidual.push([
            future[0] - (prior[0] + impulse[0] / mass),
            future[1] - (prior[1] + impulse[1] / mass),
            future[2] - (prior[2] + impulse[2] / mass),
            terminalReflux.floats[row + 9] - expectedDeltaK
          ]);
          rowAppliedMomentumExact.push(
            terminalReflux.words[row + 10] === terminalReflux.words[row + 5]
              && terminalReflux.words[row + 11] === terminalReflux.words[row + 6]
              && terminalReflux.words[row + 12] === terminalReflux.words[row + 7]
          );
          rowPersistentEvidenceExact.push(
            terminalReflux.words[row + 13] === preTerminalReflux.words[row + 13]
              && terminalReflux.words[row + 15] === preTerminalReflux.words[row + 15]
          );
          const causalWeight = terminalReflux.floats[row + 15];
          const allocatedHeat = terminalReflux.floats[row + 8];
          rowCausalAssociation.push(
            (!(allocatedHeat > 0) || causalWeight > 0)
              && (causalWeight !== 0 || allocatedHeat === 0)
          );
        }
        const fieldCount = terminalCoarseField.words[34];
        const coarseAccumulatorHeat = [];
        let coarseAccumulatorContributionCount = 0;
        let accumulatorUnusedWordsZero = true;
        let accumulatorsBitwiseUnchanged = true;
        let coarseStateInvariantWordsExact = true;
        for (let field = 0; field < fieldCount; field += 1) {
          const accumulator = coarseLayout.accumulatorOffsetWords
            + field * coarseLayout.accumulatorWords;
          coarseAccumulatorHeat.push(terminalCoarseField.floats[accumulator]);
          coarseAccumulatorContributionCount +=
            terminalCoarseField.words[accumulator + 1];
          for (let word = 0; word < coarseLayout.accumulatorWords; word += 1) {
            accumulatorsBitwiseUnchanged = accumulatorsBitwiseUnchanged
              && terminalCoarseField.words[accumulator + word]
                === preTerminalCoarseField.words[accumulator + word];
            if (word >= 2) {
              accumulatorUnusedWordsZero = accumulatorUnusedWordsZero
                && terminalCoarseField.words[accumulator + word] === 0;
            }
          }
          const stateRow = coarseLayout.stateOffsetWords
            + field * coarseLayout.stateWords;
          for (const word of [0, 4, 5, 6, 7]) {
            coarseStateInvariantWordsExact = coarseStateInvariantWordsExact
              && terminalCoarseField.words[stateRow + word]
                === preTerminalCoarseField.words[stateRow + word];
          }
        }
        const coarseReceipt = coarseLayout.receiptControlOffsetWords;
        const rowHeatSum = f32Sum(rowHeat);
        const rowDeltaKSum = f32Sum(rowDeltaK);
        const rowVirtualDeltaKSum = f32Sum(rowVirtualDeltaK);
        const actualDeltaKConditioningSumAbs = f32Sum(
          rowDeltaK.map(Math.abs)
        );
        const virtualDeltaKConditioningSumAbs = f32Sum(
          rowVirtualDeltaK.map(Math.abs)
        );
        const expectedSynchronizationWork = f32(
          rowDeltaKSum - rowVirtualDeltaKSum
        );
        const expectedSynchronizationConditioningSumAbs = f32(
          actualDeltaKConditioningSumAbs
            + virtualDeltaKConditioningSumAbs
        );
        const coarseAccumulatorHeatSum = f32Sum(coarseAccumulatorHeat);
        const expectedTotalRouteHeat = f32(
          terminalReflux.floats[112] + terminalReflux.floats[113]
        );
        const terminalEvidence = abi.decodeSchroederCrossLevelRefluxEvidence(
          postCoarseReflux.words
        );
        const publicationToken = postCoarseReflux.words[95];
        const replayField = await readWords(
          terminalGeneration.parentFieldView.coarseFieldView.fieldViewBuffer,
          coarseLayout.byteLength,
          'native-parent-mechanics-m2-replay-field-readback'
        );
        const replayReflux = await readWords(
          macroRefluxLedger.buffer,
          macroRefluxLedger.byteLength,
          'native-parent-mechanics-m2-replay-reflux-readback'
        );
        const replayEvidence = abi.decodeSchroederCrossLevelRefluxEvidence(
          replayReflux.words
        );
        let replayRowsUnchanged = true;
        for (let word = abi.SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_HEADER_WORDS;
          word < replayReflux.words.length;
          word += 1) {
          replayRowsUnchanged = replayRowsUnchanged
            && replayReflux.words[word] === postCoarseReflux.words[word];
        }
        let replayCoarseDataUnchanged = true;
        for (let field = 0; field < fieldCount; field += 1) {
          const accumulator = coarseLayout.accumulatorOffsetWords
            + field * coarseLayout.accumulatorWords;
          const stateRow = coarseLayout.stateOffsetWords
            + field * coarseLayout.stateWords;
          for (let word = 0; word < coarseLayout.accumulatorWords; word += 1) {
            replayCoarseDataUnchanged = replayCoarseDataUnchanged
              && replayField.words[accumulator + word]
                === postCoarseField.words[accumulator + word];
          }
          for (let word = 0; word < coarseLayout.stateWords; word += 1) {
            replayCoarseDataUnchanged = replayCoarseDataUnchanged
              && replayField.words[stateRow + word]
                === postCoarseField.words[stateRow + word];
          }
        }
        const expectedTerminalLineage = [
          terminalGeneration.parentFieldView.generationId,
          terminalGeneration.parentFieldView.deviceOrdinal,
          terminalGeneration.parentFieldView.laneOrdinal,
          terminalGeneration.parentFieldView.leaseToken,
          terminalGeneration.parentFieldView.sourceFamilyId,
          terminalGeneration.parentFieldView.storageGeneration,
          terminalGeneration.parentFieldView.physicsTick,
          terminalGeneration.parentFieldView.physicsSubstep,
          terminalGeneration.parentFieldView.positionEpoch,
          terminalGeneration.parentFieldView.topologyEpoch,
          terminalGeneration.parentFieldView.chartEpoch,
          terminalGeneration.parentFieldView.levelEpoch,
          terminalGeneration.parentFieldView.supportEpoch
        ];
        const terminalLineageExact = expectedTerminalLineage.every(
          (value, index) => terminalReflux.words[64 + index] === value
        );
        const validationError = await device.popErrorScope();
        await new Promise((resolve) => setTimeout(resolve, 50));
        const coarseParticle = 1;
        const coarseStateBase = coarseParticle * 8;
        const coarseMass = fineSuccessorState.floats[coarseStateBase + 3];
        const coarseParticleDeltaJ = coarseMass * (
          coarseCandidateState.floats[coarseStateBase + 7]
            - fineSuccessorState.floats[coarseStateBase + 7]
        );
        const coarseIntendedParticleHeat = postCoarseReflux.floats[115]
          + (postCoarseReflux.floats[117] - terminalReflux.floats[117]);
        const coarseMeasuredParticleHeat = postCoarseReflux.floats[84]
          - terminalReflux.floats[84];
        const atomicFoldBarrierProbe = await runAtomicFoldBarrierProbe();
        const projectionCoverageProbe = await runProjectionCoverageProbe();
        const registryCoverageProbe = await runRegistryCoverageProbe();
        const result = {
          status: 'm2-complete',
          atomicFoldBarrierProbe,
          projectionCoverageProbe,
          registryCoverageProbe,
          fineEncodedDispatchCount: fineWorkspace.execution.encodedDispatchCount,
          fineEncodedComputePassCount:
            fineWorkspace.execution.encodedComputePassCount,
          terminalEncodedDispatchCount: terminalExecution.encodedDispatchCount,
          workspaceFlags: terminalWorkspace.words[2],
          workspacePhase: terminalWorkspace.words[36],
          workspaceInvalidCounts: Array.from(terminalWorkspace.words.slice(37, 42)),
          terminalArenaDistinct:
            terminalExecution.arenaIndex !== fineWorkspace.execution.arenaIndex,
          terminalExecutionKind: terminalExecution.terminalKind,
          terminalFieldEncoding: terminalCoarseField.words[59],
          terminalFieldMutationOrdinal: terminalCoarseField.words[63],
          terminalReceiptFlags: terminalCoarseField.words[coarseReceipt + 2],
          terminalReceiptPhase: terminalCoarseField.words[coarseReceipt + 3],
          terminalReceiptHeat: terminalCoarseField.floats[coarseReceipt + 8],
          terminalReceiptPublishedHeat:
            terminalCoarseField.floats[coarseReceipt + 9],
          terminalReceiptConsumedHeat:
            terminalCoarseField.floats[coarseReceipt + 10],
          terminalReceiptMacroSubstepOrdinal:
            terminalCoarseField.words[coarseReceipt + 4],
          terminalReceiptMutationOrdinal:
            terminalCoarseField.words[coarseReceipt + 5],
          terminalReceiptFieldCount:
            terminalCoarseField.words[coarseReceipt + 6],
          terminalReceiptContributionCount:
            terminalCoarseField.words[coarseReceipt + 7],
          terminalReceiptOwnerGeneration:
            terminalCoarseField.words[coarseReceipt + 12],
          terminalLedgerOwnerGeneration: terminalReflux.words[83],
          terminalReceiptScaleWords: [
            terminalCoarseField.words[coarseReceipt + 14],
            terminalCoarseField.words[coarseReceipt + 15]
          ],
          terminalLedgerScaleWords: [
            terminalReflux.words[90],
            terminalReflux.words[92]
          ],
          terminalLineageExact,
          terminalFinalMutationWords:
            Array.from(terminalReflux.words.slice(61, 64)),
          terminalConservationStatus:
            Array.from(terminalReflux.words.slice(48, 54)),
          terminalEnergyResidualMagnitude: terminalReflux.floats[31],
          terminalEnergyTolerance: terminalReflux.floats[47],
          terminalMomentumResidualMagnitude:
            Array.from(terminalReflux.floats.slice(36, 39)),
          terminalMomentumTolerance: terminalReflux.floats[45],
          terminalAngularResidualMagnitude:
            Array.from(terminalReflux.floats.slice(39, 42)),
          terminalAngularTolerance: terminalReflux.floats[46],
          refluxFlags: terminalReflux.words[2],
          rowCount,
          committed: terminalReflux.words[8],
          coarseApplyCount: terminalReflux.words[9],
          consumed: terminalReflux.words[15],
          refluxPhase: terminalReflux.words[59],
          operationCount: terminalReflux.words[97],
          expectedOperationCount: terminalReflux.words[98],
          transactionMutationToken: terminalReflux.words[111],
          preTerminalConsumed: preTerminalReflux.words[15],
          deferredHeat: terminalReflux.floats[113],
          deferredHeatBits: terminalReflux.words[113],
          rowHeat,
          rowHeatSum,
          rowHeatSumBits: f32Bits(rowHeatSum),
          positiveRowHeatCount: rowHeat.filter((value) => value > 0).length,
          totalRouteHeat: terminalReflux.floats[30],
          totalRouteHeatBits: terminalReflux.words[30],
          expectedTotalRouteHeat,
          expectedTotalRouteHeatBits: f32Bits(expectedTotalRouteHeat),
          actualCoarseDeltaK: terminalReflux.floats[29],
          actualCoarseDeltaKBits: terminalReflux.words[29],
          preTerminalVirtualCoarseDeltaK: preTerminalReflux.floats[29],
          rowDeltaK,
          rowDeltaKSum,
          rowDeltaKSumBits: f32Bits(rowDeltaKSum),
          rowVirtualDeltaK,
          rowVirtualDeltaKSum,
          synchronizationWork: terminalReflux.floats[126],
          synchronizationWorkBits: terminalReflux.words[126],
          expectedSynchronizationWork,
          expectedSynchronizationWorkBits:
            f32Bits(expectedSynchronizationWork),
          synchronizationConditioningSumAbs: terminalReflux.floats[127],
          synchronizationConditioningSumAbsBits: terminalReflux.words[127],
          expectedSynchronizationConditioningSumAbs,
          expectedSynchronizationConditioningSumAbsBits:
            f32Bits(expectedSynchronizationConditioningSumAbs),
          terminalOperatorSplitValid:
            terminalEvidence?.operatorSplit?.valid === true,
          rowVelocityResidual,
          rowAppliedMomentumExact,
          rowPersistentEvidenceExact,
          rowCausalAssociation,
          accumulatorsBitwiseUnchanged,
          accumulatorUnusedWordsZero,
          coarseStateInvariantWordsExact,
          coarseAccumulatorHeatSum,
          coarseAccumulatorContributionCount,
          coarseTerminalAddedLocalHeat:
            terminalReflux.floats[116] - preTerminalReflux.floats[116],
          postFieldReceiptFlags: postCoarseField.words[coarseReceipt + 2],
          postFieldReceiptPhase: postCoarseField.words[coarseReceipt + 3],
          postFieldReceiptPublishedHeat:
            postCoarseField.floats[coarseReceipt + 9],
          postFieldReceiptConsumedHeat:
            postCoarseField.floats[coarseReceipt + 10],
          postRefluxFlags: postCoarseReflux.words[2],
          postRefluxPhase: postCoarseReflux.words[59],
          postTerminalReceipt: postCoarseReflux.words[80],
          postTerminalConsumeCount: postCoarseReflux.words[96],
          postOperationCount: postCoarseReflux.words[97],
          postCoarseApplyCount: postCoarseReflux.words[9],
          postCoarseReceiptConsumeCount: postCoarseReflux.words[121],
          postStatusWords: Array.from(postCoarseReflux.words.slice(100, 104)),
          postLocalHeatStatus: postCoarseReflux.words[118],
          postRouteHeatStatus: postCoarseReflux.words[119],
          postFineReceiptConsumeCount: postCoarseReflux.words[120],
          postStatusCaptureSentinel: postCoarseReflux.words[124],
          postStatusCaptureMissingCount: postCoarseReflux.words[125],
          postTerminalToken: postCoarseReflux.words[81],
          postPublicationToken: publicationToken,
          terminalAdmitted: terminalEvidence?.terminalAdmitted === true,
          clonedTerminalArtifactRejection,
          coarseParticleDeltaJ,
          coarseIntendedParticleHeat,
          coarseMeasuredParticleHeat,
          postDeferredRouteHeat: postCoarseReflux.floats[113],
          postConsumedCoarseRouteHeat: postCoarseReflux.floats[115],
          postIntendedLocalHeat: postCoarseReflux.floats[116],
          postConsumedLocalHeat: postCoarseReflux.floats[117],
          postMeasuredParticleHeat: postCoarseReflux.floats[84],
          postTotalRouteHeat: postCoarseReflux.floats[30],
          coarseCandidateStateWords: Array.from(coarseCandidateState.words),
          coarseCandidateMechanicsWords: Array.from(coarseCandidateMechanics.words),
          fineSuccessorStateWords: Array.from(fineSuccessorState.words),
          fineSuccessorMechanicsWords: Array.from(fineSuccessorMechanics.words),
          inputStateWords: Array.from(inputStateWords),
          inputMechanicsWords: Array.from(inputMechanicsWords),
          replayRejection: {
            code: replayError?.code ?? null,
            status: replayError?.status ?? null
          },
          replayReceiptFlags: replayField.words[coarseReceipt + 2],
          replayReceiptPhase: replayField.words[coarseReceipt + 3],
          replayRefluxFlags: replayReflux.words[2],
          replayRefluxPhase: replayReflux.words[59],
          replayTerminalReceipt: replayReflux.words[80],
          replayPublicationToken: replayReflux.words[95],
          replayOperationCount: replayReflux.words[97],
          replayCoarseApplyCount: replayReflux.words[9],
          replayTerminalConsumeCount: replayReflux.words[96],
          replayCoarseReceiptConsumeCount: replayReflux.words[121],
          replayRejectCount: replayReflux.words[108],
          replayMutationRollbackCount: replayReflux.words[122],
          replayTerminalAdmitted: replayEvidence?.terminalAdmitted === true,
          replayFailClosed: replayEvidence?.failClosed === true,
          replayRowsUnchanged,
          replayCoarseDataUnchanged,
          fineG2pBackend: fineG2p.backend,
          coarseG2pBackend: coarseG2p.backend,
          replayG2pBackend: null,
          manufacturedGravity,
          validationError: validationError?.message || null,
          errors
        };
        await fusedModule.abortSchroederTwoLevelMacroAuthorityAfter(
          device,
          m1Fused.transaction.macroAuthority,
          {
            microepochAuthority: terminalMicroepochAuthority,
            reason: 'native-parent-mechanics-m2-fixture-complete'
          }
        );
        const fence = device.queue.onSubmittedWorkDone();
        await Promise.all([
          fineWorkspace.runtime.releaseExecutionAfter(
            fineWorkspace.execution,
            fence
          ),
          fineWorkspace.runtime.releaseExecutionAfter(terminalExecution, fence)
        ]);
        fineWorkspace.runtime.destroy();
        spatialModule.releaseSchroederSpatialEpochGenerationAfterQueue(
          generation,
          device
        );
        await generation.releasePromise;
        spatialModule.releaseSchroederSpatialEpochGenerationAfterQueue(
          terminalGeneration,
          device
        );
        await terminalGeneration.releasePromise;
        await terminalAssignmentRefreshRuntime.releaseAfterQueue(
          terminalLevelAssignment
        );
        terminalAssignmentRefreshRuntime.destroy();
        assignmentBuffer.destroy();
        buffersModule.destroySphGpuParticleBuffers(sphUpload);
        buffersModule.destroyMlsMpmGpuParticleBuffers(mlsUpload);
        return result;
      }
      if (m1Only) {
        const preConsumeReflux = await readWords(
          macroRefluxLedger.buffer,
          macroRefluxLedger.byteLength,
          'native-parent-mechanics-m1-pre-consume-reflux-readback'
        );
        const proposal = m1Fused == null
          ? proposalModule.runSchroederSpatialMechanicalProposalWebGpu({
              cleanupPassBudget: 1024,
              device,
              generation,
              sphParticleState,
              mlsMpmParticleState,
              sphParticleUpload: sphUpload,
              mlsMpmParticleUpload: mlsUpload,
              boxDimsM: [2, 2, 2],
              gridSpacingM: 0.25,
              selectedLevel: 0,
              relaxation: 0,
              normalVelocityDamping: 0
            })
          : null;
        const refluxOwnershipValid =
          workspaceModule.validateSchroederCrossLevelRefluxLedgerGpuOwnership(
            device,
            fineWorkspace.execution.refluxLedger,
            {
              minimumCoarseFieldCapacity:
                fineWorkspace.execution.refluxLedger.rowCapacity,
              fineLevel: fineWorkspace.execution.parentFieldView?.fineLevel,
              coarseLevel: fineWorkspace.execution.parentFieldView?.coarseLevel,
              coarseGridSpacingM:
                fineWorkspace.execution.parentFieldView?.coarseFieldView
                  ?.gridSpacingM
            }
          );
        if (!refluxOwnershipValid) {
          throw new Error(`M1 fixture reflux ownership rejected: ${JSON.stringify({
            status: fineWorkspace.execution.refluxLedger.status,
            rowCapacity: fineWorkspace.execution.refluxLedger.rowCapacity,
            fineLevel: fineWorkspace.execution.refluxLedger.fineLevel,
            coarseLevel: fineWorkspace.execution.refluxLedger.coarseLevel,
            coarseGridSpacingM:
              fineWorkspace.execution.refluxLedger.coarseGridSpacingM,
            parentFineLevel: fineWorkspace.execution.parentFieldView?.fineLevel,
            parentCoarseLevel: fineWorkspace.execution.parentFieldView?.coarseLevel,
            parentCoarseGridSpacingM:
              fineWorkspace.execution.parentFieldView?.coarseFieldView?.gridSpacingM
          })}`);
        }
        const g2pOptions = {
          device,
          sphParticleState,
          mlsMpmParticleState,
          gridUpdate: correctedFineUpdate,
          sphParticleUpload: sphUpload,
          mlsMpmParticleUpload: mlsUpload,
          dt: 0.01,
          boxDimsM: [2, 2, 2],
          internalPressureScale: 0,
          liquidWallDampingAlpha: 0,
          liquidWallDampingDistanceM: 0,
          particleSeparationRelaxation: 0,
          particleSeparationVelocityDamping: 0,
          schroederSelectedLevel: 0,
          schroederSpatialEpochGeneration: generation,
          schroederSpatialMechanicalProposal: proposal,
          canonicalSpatialRequired: true,
          observeCanonicalSpatialAuthority: false,
          mechanicsFieldMode: 'required',
          retainOutputParticleBuffers: true,
          readbackMode: 'no-full-readback',
          fusedFineSubstepTransaction: m1Fused.transaction
        };
        const g2p = await g2pModule.runMlsMpmG2pWebGpu(g2pOptions);
        proposal?.releaseAfterSubmittedWork();
        await proposal?.releasePromise;
        const candidateState = await readWords(
          g2p.stateBuffer,
          g2p.stateBufferByteLength,
          'native-parent-mechanics-m1-candidate-state-readback'
        );
        const candidateMechanics = await readWords(
          g2p.mechanicsBuffer,
          g2p.mechanicsBufferByteLength,
          'native-parent-mechanics-m1-candidate-mechanics-readback'
        );
        const postConsumeField = await readWords(
          generation.parentFieldView.fineFieldView.fieldViewBuffer,
          generation.parentFieldView.fineFieldView.layout.byteLength,
          'native-parent-mechanics-m1-post-consume-field-readback'
        );
        const postConsumeReflux = await readWords(
          macroRefluxLedger.buffer,
          macroRefluxLedger.byteLength,
          'native-parent-mechanics-m1-post-consume-reflux-readback'
        );
        const fineLayout = generation.parentFieldView.fineFieldView.layout;
        const receipt = fineLayout.receiptControlOffsetWords;
        const fieldCount = postConsumeField.words[34];
        let fieldTotalHeat = 0;
        let fieldRouteHeat = 0;
        let fieldLocalHeat = 0;
        let fieldContributionCount = 0;
        const fieldHeatRows = [];
        for (let field = 0; field < fieldCount; field += 1) {
          const accumulator = fineLayout.accumulatorOffsetWords
            + field * fineLayout.accumulatorWords;
          const totalHeat = postConsumeField.floats[accumulator];
          const routeHeat = postConsumeField.floats[accumulator + 2];
          const localHeat = Math.max(0, totalHeat - routeHeat);
          const contributionCount = postConsumeField.words[accumulator + 1];
          fieldTotalHeat += totalHeat;
          fieldRouteHeat += routeHeat;
          fieldLocalHeat += localHeat;
          fieldContributionCount += contributionCount;
          fieldHeatRows.push([
            field,
            totalHeat,
            routeHeat,
            localHeat,
            contributionCount
          ]);
        }
        const fineDescriptorBase = fineLayout.descriptorOffsetWords;
        const fineDescriptorFields = [];
        for (let stencil = 0; stencil < 27; stencil += 1) {
          const field = postConsumeField.words[fineDescriptorBase + 4 + stencil];
          if (field < fieldCount) fineDescriptorFields.push(field);
        }
        let particleDeltaHeat = 0;
        for (let particle = 0; particle < particleCount; particle += 1) {
          if (Math.round(assignmentRows[particle * 16]) !== 0) continue;
          const row = particle * 8;
          particleDeltaHeat += state[row + 3]
            * (candidateState.floats[row + 7] - state[row + 7]);
        }
        const replayProposal = m1Fused == null
          ? proposalModule.runSchroederSpatialMechanicalProposalWebGpu({
              cleanupPassBudget: 1024,
              device,
              generation,
              sphParticleState,
              mlsMpmParticleState,
              sphParticleUpload: sphUpload,
              mlsMpmParticleUpload: mlsUpload,
              boxDimsM: [2, 2, 2],
              gridSpacingM: 0.25,
              selectedLevel: 0,
              relaxation: 0,
              normalVelocityDamping: 0
            })
          : null;
        let replayError = null;
        try {
          await g2pModule.runMlsMpmG2pWebGpu({
            ...g2pOptions,
            schroederSpatialMechanicalProposal: replayProposal
          });
        } catch (error) {
          replayError = error;
        }
        if (replayError == null) {
          throw new Error('fused M1 replay unexpectedly encoded a second G2P');
        }
        const replayField = await readWords(
          generation.parentFieldView.fineFieldView.fieldViewBuffer,
          fineLayout.byteLength,
          'native-parent-mechanics-m1-replay-field-readback'
        );
        const replayReflux = await readWords(
          macroRefluxLedger.buffer,
          macroRefluxLedger.byteLength,
          'native-parent-mechanics-m1-replay-reflux-readback'
        );
        const validationError = await device.popErrorScope();
        await new Promise((resolve) => setTimeout(resolve, 50));
        const inputStateWords = new Uint32Array(
          state.buffer,
          state.byteOffset,
          state.length
        );
        const inputMechanicsWords = new Uint32Array(
          mechanics.buffer,
          mechanics.byteOffset,
          mechanics.length
        );
        const result = {
          status: 'm1-complete',
          workspaceFlags: fineWorkspaceRead.words[2],
          workspacePhase: fineWorkspaceRead.words[36],
          workspaceInvalidCounts: Array.from(fineWorkspaceRead.words.slice(37, 42)),
          correctionCount: fineWorkspaceRead.words[46],
          fieldEncoding: fineFieldRead.words[59],
          fieldMutationOrdinal: fineFieldRead.words[63],
          preReceiptPhase: fineFieldRead.words[receipt + 3],
          preReceiptOrdinal: fineFieldRead.words[receipt + 4],
          preReceiptMutationOrdinal: fineFieldRead.words[receipt + 5],
          prePublishedHeat: fineFieldRead.floats[receipt + 9],
          preConsumedHeat: fineFieldRead.floats[receipt + 10],
          preCommitted: preConsumeReflux.words[8],
          preConsumed: preConsumeReflux.words[15],
          preOperationCount: preConsumeReflux.words[97],
          preRefluxPhase: preConsumeReflux.words[59],
          postReceiptFlags: postConsumeField.words[receipt + 2],
          postReceiptPhase: postConsumeField.words[receipt + 3],
          postReceiptContributionCount: postConsumeField.words[receipt + 7],
          postPublishedHeat: postConsumeField.floats[receipt + 9],
          postConsumedHeat: postConsumeField.floats[receipt + 10],
          postRefluxFlags: postConsumeReflux.words[2],
          postCommitted: postConsumeReflux.words[8],
          postConsumed: postConsumeReflux.words[15],
          postRefluxPhase: postConsumeReflux.words[59],
          postFineReceiptConsumeCount: postConsumeReflux.words[120],
          intendedFineRouteHeat: postConsumeReflux.floats[112],
          consumedFineRouteHeat: postConsumeReflux.floats[114],
          intendedLocalHeat: postConsumeReflux.floats[116],
          consumedLocalHeat: postConsumeReflux.floats[117],
          measuredParticleHeat: postConsumeReflux.floats[84],
          postReplayRejectCount: postConsumeReflux.words[108],
          postFineImpulse: Array.from(postConsumeReflux.floats.slice(16, 19)),
          fieldTotalHeat,
          fieldRouteHeat,
          fieldLocalHeat,
          fieldContributionCount,
          fieldHeatRows,
          fineDescriptorStatus: postConsumeField.words[fineDescriptorBase + 3],
          fineDescriptorFields,
          particleDeltaHeat,
          inputStateWords: Array.from(inputStateWords),
          inputMechanicsWords: Array.from(inputMechanicsWords),
          candidateStateWords: Array.from(candidateState.words),
          candidateState: Array.from(candidateState.floats),
          candidateMechanicsWords: Array.from(candidateMechanics.words),
          replayRejection: {
            code: replayError.code ?? null,
            status: replayError.status ?? null
          },
          replayFieldUnchanged: replayField.words.length === postConsumeField.words.length
            && replayField.words.every(
              (word, index) => word === postConsumeField.words[index]
            ),
          replayRefluxUnchanged: replayReflux.words.length === postConsumeReflux.words.length
            && replayReflux.words.every(
              (word, index) => word === postConsumeReflux.words[index]
            ),
          g2pStatus: g2p.status,
          g2pBackend: g2p.backend,
          correctedTerminalSubmitted:
            correctedFineUpdate.parentFieldMechanicsTerminalSubmitted,
          validationError: validationError?.message || null,
          errors
        };
        g2p.destroyOutputParticleBuffers();
        replayProposal?.releaseAfterSubmittedWork();
        await replayProposal?.releasePromise;
        const fence = device.queue.onSubmittedWorkDone();
        await fineWorkspace.runtime.releaseExecutionAfter(
          fineWorkspace.execution,
          fence
        );
        fineWorkspace.runtime.destroy();
        macroRefluxLedger.destroy();
        spatialModule.releaseSchroederSpatialEpochGenerationAfterQueue(
          generation,
          device
        );
        await generation.releasePromise;
        assignmentBuffer.destroy();
        buffersModule.destroySphGpuParticleBuffers(sphUpload);
        buffersModule.destroyMlsMpmGpuParticleBuffers(mlsUpload);
        return result;
      }

      const fineProposal =
        proposalModule.runSchroederSpatialMechanicalProposalWebGpu({
          cleanupPassBudget: 1024,
          device,
          generation,
          sphParticleState,
          mlsMpmParticleState,
          sphParticleUpload: sphUpload,
          mlsMpmParticleUpload: mlsUpload,
          boxDimsM: [2, 2, 2],
          gridSpacingM: 0.25,
          selectedLevel: 0,
          relaxation: 0,
          normalVelocityDamping: 0
        });
      const fineG2p = await g2pModule.runMlsMpmG2pWebGpu({
        device,
        sphParticleState,
        mlsMpmParticleState,
        gridUpdate: correctedFineUpdate,
        sphParticleUpload: sphUpload,
        mlsMpmParticleUpload: mlsUpload,
        dt: 0.01,
        boxDimsM: [2, 2, 2],
        internalPressureScale: 0,
        liquidWallDampingAlpha: 0,
        liquidWallDampingDistanceM: 0,
        particleSeparationRelaxation: 0,
        particleSeparationVelocityDamping: 0,
        schroederSelectedLevel: 0,
        schroederSpatialEpochGeneration: generation,
        schroederSpatialMechanicalProposal: fineProposal,
        canonicalSpatialRequired: true,
        observeCanonicalSpatialAuthority: false,
        mechanicsFieldMode: 'required',
        retainOutputParticleBuffers: true,
        readbackMode: 'no-full-readback'
      });
      fineProposal.releaseAfterSubmittedWork();
      await fineProposal.releasePromise;

      const coarseGridUpdate =
        await updateModule.runMlsMpmGridUpdateWebGpu({
          device,
          p2gGridProjection: coarseProjection,
          mechanicsFieldMode: 'required',
          dt: 0.01,
          gravityMPerS2: [0, -9.80665, 0],
          boxDimsM: [2, 2, 2],
          mechanicsFieldEnergyReceipt: { deferSeal: true },
          retainUpdatedGridBuffer: false,
          readbackMode: 'no-full-readback'
        });
      const coarseEncoder = device.createCommandEncoder();
      const coarseUpdate = fineWorkspace.runtime.encodeCoarseTerminal(
        coarseEncoder,
        {
          parentFieldView: generation.parentFieldView,
          coarseGridUpdate,
          refluxLedger: macroRefluxLedger,
          fineSubstepCount: 1,
          fineDt: 0.01
        }
      );
      device.queue.submit([coarseEncoder.finish()]);
      const terminalExecution =
        coarseUpdate.parentFieldMechanicsWorkspaceExecution;
      fineWorkspace.runtime.markTerminalSubmitted(terminalExecution);
      const coarseWorkspaceRead = await readWords(
        terminalExecution.workspaceBuffer,
        terminalExecution.layout.byteLength,
        'native-parent-mechanics-coarse-workspace-readback'
      );
      const coarseFieldRead = await readWords(
        generation.parentFieldView.coarseFieldView.fieldViewBuffer,
        generation.parentFieldView.coarseFieldView.layout.byteLength,
        'native-parent-mechanics-coarse-field-readback'
      );
      const refluxRead = await readWords(
        macroRefluxLedger.buffer,
        macroRefluxLedger.byteLength,
        'native-parent-mechanics-reflux-readback'
      );
      const validationError = await device.popErrorScope();
      await new Promise((resolve) => setTimeout(resolve, 50));
      const result = {
        status: 'complete',
        fineWorkspaceFlags: fineWorkspaceRead.words[2],
        fineWorkspacePhase: fineWorkspaceRead.words[36],
        fineInvalidCounts: Array.from(fineWorkspaceRead.words.slice(37, 42)),
        fineRestrictedEdges: fineWorkspaceRead.words[42],
        fineCorrectionCount: fineWorkspaceRead.words[46],
        fineFieldEncoding: fineFieldRead.words[59],
        fineFieldMutationOrdinal: fineFieldRead.words[63],
        fineMassResidual: fineWorkspaceRead.floats[50],
        coarseWorkspaceFlags: coarseWorkspaceRead.words[2],
        coarseWorkspacePhase: coarseWorkspaceRead.words[36],
        coarseInvalidCounts: Array.from(coarseWorkspaceRead.words.slice(37, 42)),
        coarsePublishedCount: coarseWorkspaceRead.words[47],
        coarseFieldEncoding: coarseFieldRead.words[59],
        coarseFieldMutationOrdinal: coarseFieldRead.words[63],
        refluxFlags: refluxRead.words[2],
        refluxRowCount: refluxRead.words[4],
        refluxFineCorrectionCount: refluxRead.words[8],
        refluxCoarseApplyCount: refluxRead.words[9],
        refluxFineImpulse: Array.from(refluxRead.floats.slice(16, 19)),
        refluxCoarseImpulse: Array.from(refluxRead.floats.slice(19, 22)),
        refluxFineAngularImpulse: Array.from(refluxRead.floats.slice(22, 25)),
        refluxCoarseAngularImpulse: Array.from(refluxRead.floats.slice(25, 28)),
        refluxFineEnergyDelta: refluxRead.floats[28],
        refluxCoarseEnergyDelta: refluxRead.floats[29],
        refluxInternalEnergyDeposit: refluxRead.floats[30],
        refluxEnergyResidual: refluxRead.floats[31],
        refluxMomentumResidual: Array.from(refluxRead.floats.slice(36, 39)),
        refluxAngularResidual: Array.from(refluxRead.floats.slice(39, 42)),
        refluxMomentumTolerance: refluxRead.floats[45],
        refluxAngularTolerance: refluxRead.floats[46],
        refluxEnergyTolerance: refluxRead.floats[47],
        refluxPositivityStatus: refluxRead.words[48],
        refluxCflStatus: refluxRead.words[49],
        refluxMomentumStatus: refluxRead.words[51],
        refluxAngularStatus: refluxRead.words[52],
        refluxEnergyStatus: refluxRead.words[53],
        refluxPhase: refluxRead.words[59],
        refluxFinalMutationInputOrdinal: refluxRead.words[61],
        refluxFinalMutationOutputOrdinal: refluxRead.words[62],
        refluxFinalStateEncoding: refluxRead.words[63],
        coarseUpdateStatus: coarseUpdate.status,
        coarseUpdateInPlace: coarseUpdate.fieldStateUpdatedInPlace,
        coarseUpdateSubmittedInPlace:
          coarseUpdate.fieldStateUpdateSubmittedInPlace,
        preP2g: {
          directory: Array.from(preP2gDirectoryRead.words),
          activeSource: Array.from(preP2gActiveSourceRead.words),
          fineMechanics: Array.from(preP2gFineMechanicsRead.words),
          coarseMechanics: Array.from(preP2gCoarseMechanicsRead.words),
          fineField: Array.from(preP2gFineFieldRead.words),
          coarseField: Array.from(preP2gCoarseFieldRead.words)
        },
        p2gAllocationEvidence,
        validationError: validationError?.message || null,
        errors
      };
      const fence = device.queue.onSubmittedWorkDone();
      await Promise.all([
        fineWorkspace.runtime.releaseExecutionAfter(
          fineWorkspace.execution,
          fence
        ),
        fineWorkspace.runtime.releaseExecutionAfter(
          terminalExecution,
          fence
        )
      ]);
      fineWorkspace.runtime.destroy();
      fineG2p.destroyOutputParticleBuffers();
      macroRefluxLedger.destroy();
      spatialModule.releaseSchroederSpatialEpochGenerationAfterQueue(
        generation,
        device
      );
      await generation.releasePromise;
      assignmentBuffer.destroy();
      buffersModule.destroySphGpuParticleBuffers(sphUpload);
      buffersModule.destroyMlsMpmGpuParticleBuffers(mlsUpload);
      return result;
    }, {
      m0Only: RUN_NATIVE_M0,
      m1Only: RUN_NATIVE_M1,
      m2Only: RUN_NATIVE_M2
    });
  } finally {
    await browser.close();
  }
  if (RUN_NATIVE_M0) {
    assert.equal(native.status, 'm0-complete', native.reason || JSON.stringify(native));
    assert.equal(native.parentFlags, 3, JSON.stringify(native));
    assert.equal(native.parentFineAdmissionMask, 0, JSON.stringify(native));
    assert.equal(native.parentCoarseAdmissionMask, 0, JSON.stringify(native));
    assert.equal(native.fineFlags, 3, JSON.stringify(native));
    assert.equal(native.coarseFlags, 3, JSON.stringify(native));
    assert.ok(native.fineFieldCount < native.fineFieldCapacity, JSON.stringify(native));
    assert.ok(
      native.coarseFieldCount < native.coarseFieldCapacity,
      JSON.stringify(native)
    );
    assert.ok(
      native.fineActiveRequiredWords < native.fineCapacityWords,
      JSON.stringify(native)
    );
    assert.ok(
      native.coarseActiveRequiredWords < native.coarseCapacityWords,
      JSON.stringify(native)
    );
    assert.equal(native.workspaceFlags, 3, JSON.stringify(native));
    assert.equal(
      native.workspacePhase,
      SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_PHASE_PREDICTOR_VELOCITY_READY,
      JSON.stringify(native)
    );
    assert.equal(native.workspaceInvalidSourceCount, 0, JSON.stringify(native));
    assert.ok(native.restrictedEdgeCount > 0, JSON.stringify(native));
    assert.equal(native.refluxFlags, 3, JSON.stringify(native));
    assert.ok(native.refluxRowCount > 0, JSON.stringify(native));
    assert.equal(
      native.refluxPhase,
      SCHROEDER_CROSS_LEVEL_REFLUX_PHASE_ACCUMULATING,
      JSON.stringify(native)
    );
    const momentHeaders = [
      native.phaseVolumeMoments.fineHeader,
      native.phaseVolumeMoments.coarseHeader
    ];
    for (const header of momentHeaders) {
      assert.equal(header[2], 3, JSON.stringify(native));
      assert.equal(header[16], 2, JSON.stringify(native));
      assert.equal(header[32], 54, JSON.stringify(native));
      assert.deepEqual(header.slice(37, 40), [0, 0, 0], JSON.stringify(native));
      assert.equal(header[40], 27, JSON.stringify(native));
    }
    const receiptHeaders = [
      native.phaseVolumeReceipts.fineHeader,
      native.phaseVolumeReceipts.coarseHeader
    ];
    const f32 = (bits) => new Float32Array(new Uint32Array([bits]).buffer)[0];
    for (const header of receiptHeaders) {
      assert.equal(header[1], 2, JSON.stringify(native));
      assert.equal(header[2], 3, JSON.stringify(native));
      assert.equal(header[16], 2, JSON.stringify(native));
      assert.equal(header[20], 54, JSON.stringify(native));
      assert.deepEqual(header.slice(41, 47), [0, 0, 0, 0, 0, 0], JSON.stringify(native));
      assert.equal(header[47], 1, JSON.stringify(native));
      assert.equal(header[48], 27, JSON.stringify(native));
      assert.ok(Math.abs(f32(header[30]) - 0.001) < 2e-6, JSON.stringify(native));
      assert.ok(Math.abs(f32(header[31]) - 0.001) < 2e-6, JSON.stringify(native));
      assert.ok(Math.abs(f32(header[32])) < 2e-6, JSON.stringify(native));
    }
    const interfaceProposal = native.phaseVolumeInterfaceProposal;
    assert.deepEqual(
      {
        enabled: interfaceProposal.enabled,
        submitted: interfaceProposal.submitted,
        owned: interfaceProposal.owned,
        twoLevel: interfaceProposal.twoLevel,
        fineReceiptMatches: interfaceProposal.fineReceiptMatches,
        coarseReceiptMatches: interfaceProposal.coarseReceiptMatches,
        parentFieldMatches: interfaceProposal.parentFieldMatches,
        dispatchCount: interfaceProposal.dispatchCount,
        diagnosticOnly: interfaceProposal.diagnosticOnly,
        stateMutationAllowed: interfaceProposal.stateMutationAllowed,
        readbackPerformed: interfaceProposal.readbackPerformed,
        fullParticleReadbackPerformed:
          interfaceProposal.fullParticleReadbackPerformed
      },
      {
        enabled: true,
        submitted: true,
        owned: true,
        twoLevel: true,
        fineReceiptMatches: true,
        coarseReceiptMatches: true,
        parentFieldMatches: true,
        dispatchCount: 3,
        diagnosticOnly: true,
        stateMutationAllowed: false,
        readbackPerformed: false,
        fullParticleReadbackPerformed: false
      },
      JSON.stringify(native)
    );
    assert.equal(interfaceProposal.header[2], 3, JSON.stringify(native));
    assert.ok(interfaceProposal.header[16] > 0, JSON.stringify(native));
    assert.ok(interfaceProposal.header[18] > 0, JSON.stringify(native));
    assert.equal(
      interfaceProposal.header[22],
      interfaceProposal.header[16],
      JSON.stringify(native)
    );
    assert.equal(interfaceProposal.header[25], 1, JSON.stringify(native));
    assert.equal(interfaceProposal.header[26], 1, JSON.stringify(native));
    assert.deepEqual(interfaceProposal.header.slice(40, 45), [0, 0, 0, 0, 0]);
    assert.equal(interfaceProposal.header[47], 1, JSON.stringify(native));
    assert.equal(interfaceProposal.header[48], 0, JSON.stringify(native));
    assert.equal(interfaceProposal.header[55], 64, JSON.stringify(native));
    const expectedMasks = {
      fineActiveEnd: { fineMask: 1 << 12, coarseMask: 0 },
      coarseCapacityEnd: {
        fineMask: 0,
        coarseMask: (1 << 13) | (1 << 14)
      },
      fineKeyOffset: {
        fineMask: (1 << 9) | (1 << 10),
        coarseMask: 0
      },
      coarseStateStride: { fineMask: 0, coarseMask: 1 << 7 }
    };
    for (const [name, expected] of Object.entries(expectedMasks)) {
      const evidence = native.malformed[name];
      assert.equal(evidence.flags, 12, `${name}: ${JSON.stringify(native)}`);
      assert.equal(evidence.invalidSourceCount, 1, `${name}: ${JSON.stringify(native)}`);
      assert.equal(evidence.parentMask, 0, `${name}: ${JSON.stringify(native)}`);
      assert.equal(evidence.fineMask, expected.fineMask, `${name}: ${JSON.stringify(native)}`);
      assert.equal(
        evidence.coarseMask,
        expected.coarseMask,
        `${name}: ${JSON.stringify(native)}`
      );
    }
    assert.equal(native.validationError, null, JSON.stringify(native));
    assert.deepEqual(native.errors, []);
    return;
  }
  if (RUN_NATIVE_M2) {
    const close = (left, right) => Math.abs(left - right) <= Math.max(
      8 * 1.175494351e-38,
      1024 * 2 ** -24 * (Math.abs(left) + Math.abs(right))
    );
    assert.equal(native.status, 'm2-complete', native.reason || JSON.stringify(native));
    assert.equal(
      native.atomicFoldBarrierProbe.fusedBits,
      native.atomicFoldBarrierProbe.legacyBits,
      JSON.stringify(native.atomicFoldBarrierProbe)
    );
    assert.equal(
      native.atomicFoldBarrierProbe.legacyFirstFutureBits,
      native.atomicFoldBarrierProbe.expectedFutureBits,
      JSON.stringify(native.atomicFoldBarrierProbe)
    );
    assert.equal(
      native.atomicFoldBarrierProbe.legacyLastFutureBits,
      native.atomicFoldBarrierProbe.expectedFutureBits,
      JSON.stringify(native.atomicFoldBarrierProbe)
    );
    assert.equal(
      native.atomicFoldBarrierProbe.fusedFirstFutureBits,
      native.atomicFoldBarrierProbe.expectedFutureBits,
      JSON.stringify(native.atomicFoldBarrierProbe)
    );
    assert.equal(
      native.atomicFoldBarrierProbe.fusedLastFutureBits,
      native.atomicFoldBarrierProbe.expectedFutureBits,
      JSON.stringify(native.atomicFoldBarrierProbe)
    );
    for (const truncated of [
      native.projectionCoverageProbe.fineTruncated,
      native.projectionCoverageProbe.coarseTruncated
    ]) {
      assert.deepEqual(truncated, {
        authority: 0,
        field: native.projectionCoverageProbe.fieldSentinel,
        reflux: native.projectionCoverageProbe.refluxSentinel,
        rejected: 1
      }, JSON.stringify(native.projectionCoverageProbe));
    }
    assert.deepEqual(native.projectionCoverageProbe.complete, {
      authority: 1,
      field: native.projectionCoverageProbe.committedField,
      reflux: native.projectionCoverageProbe.committedReflux,
      rejected: 0
    }, JSON.stringify(native.projectionCoverageProbe));
    const registryProbe = native.registryCoverageProbe;
    assert.deepEqual(
      [registryProbe.complete.claimCoverage, registryProbe.complete.rowCoverage],
      [registryProbe.rowCount, registryProbe.rowCount],
      JSON.stringify(registryProbe)
    );
    assert.equal(
      registryProbe.complete.generation,
      registryProbe.committedGeneration,
      JSON.stringify(registryProbe)
    );
    assert.equal(registryProbe.complete.rejectionCount, 0);
    assert.equal(registryProbe.complete.parentZeroRaw, 0xffffffff);
    assert.equal(registryProbe.complete.parentOneRaw, 0xfffffffe);
    assert.deepEqual(
      [
        registryProbe.claimTruncated.claimCoverage,
        registryProbe.claimTruncated.rowCoverage,
        registryProbe.claimTruncated.generation,
        registryProbe.claimTruncated.rejectionCount
      ],
      [0, registryProbe.rowCount, registryProbe.generationSentinel, 1],
      JSON.stringify(registryProbe)
    );
    assert.deepEqual(
      [
        registryProbe.rowTruncated.claimCoverage,
        registryProbe.rowTruncated.rowCoverage,
        registryProbe.rowTruncated.generation,
        registryProbe.rowTruncated.rejectionCount
      ],
      [registryProbe.rowCount, 0, registryProbe.generationSentinel, 1],
      JSON.stringify(registryProbe)
    );
    assert.equal(registryProbe.duplicate.structuralFailure, 1);
    assert.equal(registryProbe.duplicate.parentZeroRaw, 0xffffffff);
    assert.equal(registryProbe.duplicate.parentOneRaw, 0);
    assert.equal(registryProbe.duplicate.rejectionCount, 1);
    assert.equal(registryProbe.duplicate.keyMismatchCount, 0);
    assert.equal(registryProbe.frozenPredictor.frozenKeyFailure, 17);
    assert.equal(registryProbe.frozenPredictor.rejectionCount, 1);
    assert.equal(registryProbe.frozenPredictor.keyMismatchCount, 1);
    assert.equal(registryProbe.frozenTerminal.frozenKeyFailure, 17);
    assert.equal(registryProbe.frozenTerminal.rejectionCount, 1);
    assert.equal(registryProbe.frozenTerminal.keyMismatchCount, 0);
    assert.equal(registryProbe.terminalMassMissing.structuralFailure, 17);
    assert.equal(registryProbe.terminalMassMissing.rejectionCount, 1);
    assert.equal(registryProbe.terminalMassMissing.keyMismatchCount, 0);
    assert.equal(
      registryProbe.massOnce.generation,
      registryProbe.committedGeneration
    );
    assert.equal(registryProbe.massOnce.massRejectLatch, 1);
    assert.equal(registryProbe.massOnce.rejectionCount, 1);
    assert.equal(native.fineEncodedDispatchCount, 25, JSON.stringify(native));
    assert.equal(native.terminalEncodedDispatchCount, 15, JSON.stringify(native));
    assert.equal(native.fineEncodedComputePassCount, 2, JSON.stringify(native));
    assert.equal(native.workspaceFlags, 3, JSON.stringify(native));
    assert.equal(
      native.workspacePhase,
      SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_PHASE_COARSE_PUBLISH_COMPLETE,
      JSON.stringify(native)
    );
    assert.deepEqual(native.workspaceInvalidCounts, [0, 0, 0, 0, 0]);
    assert.equal(native.terminalArenaDistinct, true, JSON.stringify(native));
    assert.equal(native.terminalExecutionKind, 'coarse-terminal');
    assert.equal(
      native.terminalFieldEncoding,
      SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT
    );
    assert.equal(native.terminalFieldMutationOrdinal, 3);
    assert.equal(native.terminalReceiptFlags, 3, JSON.stringify(native));
    assert.equal(
      native.terminalReceiptPhase,
      SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_PHASE_ENERGY_READY
    );
    assert.equal(native.terminalReceiptMacroSubstepOrdinal, 1);
    assert.equal(native.terminalReceiptMutationOrdinal, 3);
    assert.equal(native.terminalReceiptFieldCount, native.rowCount);
    assert.equal(
      native.terminalReceiptContributionCount,
      native.coarseAccumulatorContributionCount
    );
    assert.equal(
      native.terminalReceiptOwnerGeneration,
      native.terminalLedgerOwnerGeneration
    );
    assert.deepEqual(native.terminalReceiptScaleWords, native.terminalLedgerScaleWords);
    assert.equal(native.terminalLineageExact, true, JSON.stringify(native));
    assert.deepEqual(native.terminalFinalMutationWords, [2, 3, 2]);
    assert.deepEqual(native.terminalConservationStatus, [1, 1, 1, 1, 1, 1]);
    assert.ok(
      native.terminalEnergyResidualMagnitude <= native.terminalEnergyTolerance,
      JSON.stringify(native)
    );
    assert.equal(
      native.terminalMomentumResidualMagnitude.every(
        (value) => value <= native.terminalMomentumTolerance
      ),
      true,
      JSON.stringify(native)
    );
    assert.equal(
      native.terminalAngularResidualMagnitude.every(
        (value) => value <= native.terminalAngularTolerance
      ),
      true,
      JSON.stringify(native)
    );
    assert.equal(native.terminalReceiptConsumedHeat, 0);
    assert.equal(native.refluxFlags, 3, JSON.stringify(native));
    assert.ok(native.rowCount > 0, JSON.stringify(native));
    assert.equal(native.committed, 1);
    assert.equal(native.coarseApplyCount, native.rowCount);
    assert.equal(native.consumed, 1);
    assert.equal(native.preTerminalConsumed, 1);
    assert.equal(native.refluxPhase, SCHROEDER_CROSS_LEVEL_REFLUX_PHASE_ENERGY_READY);
    assert.equal(native.operationCount, 2);
    assert.equal(native.expectedOperationCount, 2);
    assert.equal(native.transactionMutationToken, 3);
    assert.ok(native.deferredHeat > 0, JSON.stringify(native));
    assert.ok(native.positiveRowHeatCount > 0, JSON.stringify(native));
    assert.equal(native.rowHeatSumBits, native.deferredHeatBits, JSON.stringify(native));
    assert.equal(
      native.totalRouteHeatBits,
      native.expectedTotalRouteHeatBits,
      JSON.stringify(native)
    );
    assert.equal(
      native.actualCoarseDeltaKBits,
      native.rowDeltaKSumBits,
      JSON.stringify(native)
    );
    assert.equal(
      native.synchronizationWorkBits,
      native.expectedSynchronizationWorkBits,
      JSON.stringify(native)
    );
    assert.equal(
      native.synchronizationConditioningSumAbsBits,
      native.expectedSynchronizationConditioningSumAbsBits,
      JSON.stringify(native)
    );
    assert.ok(
      Math.abs(native.synchronizationWork)
        <= native.synchronizationConditioningSumAbs
          + native.terminalEnergyTolerance,
      JSON.stringify(native)
    );
    assert.equal(native.terminalOperatorSplitValid, true, JSON.stringify(native));
    assert.ok(
      !close(native.preTerminalVirtualCoarseDeltaK, native.actualCoarseDeltaK),
      JSON.stringify(native)
    );
    assert.equal(native.rowAppliedMomentumExact.every(Boolean), true);
    assert.equal(native.rowPersistentEvidenceExact.every(Boolean), true);
    assert.equal(native.rowCausalAssociation.every(Boolean), true);
    for (const residual of native.rowVelocityResidual.flat()) {
      assert.ok(Math.abs(residual) <= 2e-7, JSON.stringify(native));
    }
    assert.equal(native.accumulatorsBitwiseUnchanged, true, JSON.stringify(native));
    assert.equal(native.accumulatorUnusedWordsZero, true, JSON.stringify(native));
    assert.equal(native.coarseStateInvariantWordsExact, true, JSON.stringify(native));
    assert.ok(
      close(native.coarseAccumulatorHeatSum, native.terminalReceiptHeat),
      JSON.stringify(native)
    );
    assert.ok(
      close(native.coarseAccumulatorHeatSum, native.terminalReceiptPublishedHeat),
      JSON.stringify(native)
    );
    assert.ok(
      close(native.coarseAccumulatorHeatSum, native.coarseTerminalAddedLocalHeat),
      JSON.stringify(native)
    );
    assert.equal(native.postFieldReceiptFlags, 3, JSON.stringify(native));
    assert.equal(
      native.postFieldReceiptPhase,
      SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_PHASE_CONSUMED
    );
    assert.ok(
      close(native.postFieldReceiptConsumedHeat, native.postFieldReceiptPublishedHeat),
      JSON.stringify(native)
    );
    assert.equal(native.postRefluxFlags, 3, JSON.stringify(native));
    assert.equal(native.postRefluxPhase, SCHROEDER_CROSS_LEVEL_REFLUX_PHASE_CONSUMED);
    assert.equal(
      native.postTerminalReceipt,
      SCHROEDER_CROSS_LEVEL_REFLUX_TERMINAL_RECEIPT_CONSUMED
    );
    assert.equal(native.postTerminalConsumeCount, 1);
    assert.equal(native.postOperationCount, 2);
    assert.equal(native.postCoarseApplyCount, native.rowCount);
    assert.equal(native.postCoarseReceiptConsumeCount, 1);
    assert.deepEqual(native.postStatusWords, [1, 1, 1, 1]);
    assert.equal(native.postLocalHeatStatus, 1);
    assert.equal(native.postRouteHeatStatus, 1);
    assert.equal(native.postFineReceiptConsumeCount, 1);
    assert.equal(native.postStatusCaptureSentinel, 0xffff_ffff);
    assert.equal(native.postStatusCaptureMissingCount, 0);
    assert.notEqual(native.postTerminalToken, 0);
    assert.equal(native.postPublicationToken, native.postTerminalToken);
    assert.equal(native.terminalAdmitted, true, JSON.stringify(native));
    assert.deepEqual(native.clonedTerminalArtifactRejection, {
      name: 'Error',
      code: 'ERR_CANONICAL_SPATIAL_AUTHORITY_REJECTED',
      status: 'fused-g2p-provenance-rejected',
      message: 'Canonical MLS-MPM G2P execution rejected: Fused G2P requires the exact correction or terminal field artifact, continuation, timing, and deferred-proposal transaction'
    });
    assert.ok(
      close(native.coarseParticleDeltaJ, native.coarseIntendedParticleHeat),
      JSON.stringify(native)
    );
    assert.ok(
      close(native.coarseParticleDeltaJ, native.coarseMeasuredParticleHeat),
      JSON.stringify(native)
    );
    assert.ok(native.coarseParticleDeltaJ > 0, JSON.stringify(native));
    assert.ok(
      close(native.postDeferredRouteHeat, native.postConsumedCoarseRouteHeat),
      JSON.stringify(native)
    );
    assert.ok(
      close(native.postIntendedLocalHeat, native.postConsumedLocalHeat),
      JSON.stringify(native)
    );
    assert.ok(
      close(
        native.postMeasuredParticleHeat,
        native.postTotalRouteHeat + native.postIntendedLocalHeat
      ),
      JSON.stringify(native)
    );
    assert.deepEqual(
      native.coarseCandidateStateWords.slice(0, 8),
      native.fineSuccessorStateWords.slice(0, 8)
    );
    assert.deepEqual(
      native.coarseCandidateMechanicsWords.slice(0, 32),
      native.fineSuccessorMechanicsWords.slice(0, 32)
    );
    assert.equal(
      native.fineSuccessorStateWords.slice(0, 8).some(
        (word, index) => word !== native.inputStateWords[index]
      ) || native.fineSuccessorMechanicsWords.slice(0, 32).some(
        (word, index) => word !== native.inputMechanicsWords[index]
      ),
      true,
      JSON.stringify(native)
    );
    assert.equal(
      native.coarseCandidateStateWords.slice(8, 16).some(
        (word, index) => word !== native.fineSuccessorStateWords[index + 8]
      ),
      true,
      JSON.stringify(native)
    );
    assert.deepEqual(native.replayRejection, {
      code: 'ERR_CANONICAL_SPATIAL_AUTHORITY_REJECTED',
      status: 'fused-g2p-provenance-rejected'
    });
    assert.equal(native.replayReceiptFlags, native.postFieldReceiptFlags);
    assert.equal(
      native.replayReceiptPhase,
      SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_PHASE_CONSUMED
    );
    assert.equal(
      native.replayRefluxFlags
        & (SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_READY
          | SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_ADMITTED),
      SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_READY
        | SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_ADMITTED
    );
    assert.equal(native.replayRefluxFlags, native.postRefluxFlags);
    assert.equal(native.replayRefluxPhase, SCHROEDER_CROSS_LEVEL_REFLUX_PHASE_CONSUMED);
    assert.equal(
      native.replayTerminalReceipt,
      native.postTerminalReceipt
    );
    assert.equal(native.replayPublicationToken, native.postPublicationToken);
    assert.equal(native.replayOperationCount, native.postOperationCount);
    assert.equal(native.replayCoarseApplyCount, native.postCoarseApplyCount);
    assert.equal(native.replayTerminalConsumeCount, native.postTerminalConsumeCount);
    assert.equal(
      native.replayCoarseReceiptConsumeCount,
      native.postCoarseReceiptConsumeCount
    );
    assert.equal(native.replayRejectCount, 0);
    assert.equal(native.replayMutationRollbackCount, 0);
    assert.equal(native.replayTerminalAdmitted, true);
    assert.equal(native.replayFailClosed, false);
    assert.equal(native.replayRowsUnchanged, true, JSON.stringify(native));
    assert.equal(native.replayCoarseDataUnchanged, true, JSON.stringify(native));
    assert.equal(native.fineG2pBackend, 'webgpu');
    assert.equal(native.coarseG2pBackend, 'webgpu');
    assert.equal(native.replayG2pBackend, null);
    assert.equal(native.manufacturedGravity.every(Number.isFinite), true);
    assert.equal(native.validationError, null, JSON.stringify(native));
    assert.deepEqual(native.errors, []);
    return;
  }
  if (RUN_NATIVE_M1) {
    const close = (left, right) => Math.abs(left - right) <= Math.max(
      8 * 1.175494351e-38,
      1024 * 2 ** -24 * (Math.abs(left) + Math.abs(right))
    );
    assert.equal(native.status, 'm1-complete', native.reason || JSON.stringify(native));
    assert.equal(native.workspaceFlags, 3, JSON.stringify(native));
    assert.equal(
      native.workspacePhase,
      SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_PHASE_FINE_CORRECTION_COMPLETE,
      JSON.stringify(native)
    );
    assert.deepEqual(native.workspaceInvalidCounts, [0, 0, 0, 0, 0]);
    assert.ok(native.correctionCount > 0, JSON.stringify(native));
    assert.equal(
      native.fieldEncoding,
      SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT
    );
    assert.equal(native.fieldMutationOrdinal, 3);
    assert.equal(
      native.preReceiptPhase,
      SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_PHASE_ENERGY_READY
    );
    assert.equal(native.preReceiptOrdinal, 0);
    assert.equal(native.preReceiptMutationOrdinal, 3);
    assert.equal(native.preConsumedHeat, 0);
    assert.equal(native.preCommitted, 1);
    assert.equal(native.preConsumed, 0);
    assert.equal(native.preOperationCount, 1);
    assert.equal(
      native.preRefluxPhase,
      SCHROEDER_CROSS_LEVEL_REFLUX_PHASE_ACCUMULATING
    );
    assert.equal(native.postReceiptFlags, 3, JSON.stringify(native));
    assert.equal(
      native.postReceiptPhase,
      SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_PHASE_CONSUMED,
      JSON.stringify(native)
    );
    assert.ok(close(native.postPublishedHeat, native.postConsumedHeat), JSON.stringify(native));
    assert.equal(native.postRefluxFlags, 3, JSON.stringify(native));
    assert.equal(native.postCommitted, 1);
    assert.equal(native.postConsumed, 1);
    assert.equal(
      native.postRefluxPhase,
      SCHROEDER_CROSS_LEVEL_REFLUX_PHASE_ACCUMULATING
    );
    assert.equal(native.postFineReceiptConsumeCount, 1);
    assert.equal(native.postReplayRejectCount, 0);
    assert.ok(
      close(native.intendedFineRouteHeat, native.consumedFineRouteHeat),
      JSON.stringify(native)
    );
    assert.ok(
      close(native.intendedLocalHeat, native.consumedLocalHeat),
      JSON.stringify(native)
    );
    assert.ok(close(
      native.measuredParticleHeat,
      native.consumedFineRouteHeat + native.consumedLocalHeat
    ), JSON.stringify(native));
    assert.ok(native.intendedFineRouteHeat > 0, JSON.stringify(native));
    assert.ok(
      !close(Math.hypot(...native.postFineImpulse), 0),
      JSON.stringify(native)
    );
    assert.equal(
      native.fieldContributionCount,
      native.postReceiptContributionCount,
      JSON.stringify(native)
    );
    assert.ok(native.fieldTotalHeat > 0, JSON.stringify(native));
    assert.ok(native.particleDeltaHeat > 0, JSON.stringify(native));
    assert.ok(
      close(native.fieldTotalHeat, native.postPublishedHeat),
      JSON.stringify(native)
    );
    assert.ok(
      close(native.fieldTotalHeat, native.postConsumedHeat),
      JSON.stringify(native)
    );
    assert.ok(
      close(native.fieldRouteHeat, native.intendedFineRouteHeat),
      JSON.stringify(native)
    );
    assert.ok(
      close(native.fieldRouteHeat, native.consumedFineRouteHeat),
      JSON.stringify(native)
    );
    assert.ok(
      close(native.fieldLocalHeat, native.intendedLocalHeat),
      JSON.stringify(native)
    );
    assert.ok(
      close(native.fieldLocalHeat, native.consumedLocalHeat),
      JSON.stringify(native)
    );
    assert.ok(
      close(native.measuredParticleHeat, native.particleDeltaHeat),
      JSON.stringify(native)
    );
    assert.equal(native.fineDescriptorStatus, 1, JSON.stringify(native));
    const fineDescriptorFields = new Set(native.fineDescriptorFields);
    for (const [field, totalHeat, routeHeat, localHeat] of native.fieldHeatRows) {
      if (
        !close(totalHeat, 0)
        || !close(routeHeat, 0)
        || !close(localHeat, 0)
      ) {
        assert.equal(
          fineDescriptorFields.has(field),
          true,
          `heated field ${field} escaped fine descriptor: ${JSON.stringify(native)}`
        );
      }
    }
    assert.ok(
      native.candidateStateWords.slice(0, 8).some(
        (word, index) => word !== native.inputStateWords[index]
      ),
      JSON.stringify(native)
    );
    assert.ok(native.candidateState[7] > 0, JSON.stringify(native));
    assert.deepEqual(
      native.candidateStateWords.slice(8, 16),
      native.inputStateWords.slice(8, 16)
    );
    assert.deepEqual(
      native.candidateMechanicsWords.slice(32, 64),
      native.inputMechanicsWords.slice(32, 64)
    );
    assert.deepEqual(native.replayRejection, {
      code: 'ERR_CANONICAL_SPATIAL_AUTHORITY_REJECTED',
      status: 'fused-g2p-provenance-rejected'
    }, JSON.stringify(native));
    assert.equal(native.replayFieldUnchanged, true, JSON.stringify(native));
    assert.equal(native.replayRefluxUnchanged, true, JSON.stringify(native));
    assert.equal(native.g2pBackend, 'webgpu');
    assert.equal(native.correctedTerminalSubmitted, true);
    assert.equal(native.validationError, null, JSON.stringify(native));
    assert.deepEqual(native.errors, []);
    return;
  }
  assert.equal(native.status, 'complete', native.reason || 'native WebGPU did not run');
  assert.equal(native.fineWorkspaceFlags, 3, JSON.stringify(native));
  assert.equal(
    native.fineWorkspacePhase,
    SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_PHASE_FINE_CORRECTION_COMPLETE,
    JSON.stringify(native)
  );
  assert.deepEqual(native.fineInvalidCounts, [0, 0, 0, 0, 0]);
  assert.ok(native.fineRestrictedEdges > 0);
  assert.ok(native.fineCorrectionCount > 0);
  assert.equal(native.fineFieldEncoding, 2);
  assert.equal(native.fineFieldMutationOrdinal, 3);
  assert.equal(Number.isFinite(native.fineMassResidual), true);
  assert.ok(native.fineMassResidual >= 0);
  assert.equal(native.coarseWorkspaceFlags, 3, JSON.stringify(native));
  assert.equal(
    native.coarseWorkspacePhase,
    SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_PHASE_COARSE_PUBLISH_COMPLETE,
    JSON.stringify(native)
  );
  assert.deepEqual(native.coarseInvalidCounts, [0, 0, 0, 0, 0]);
  assert.ok(native.coarsePublishedCount > 0);
  assert.equal(native.coarseFieldEncoding, 2);
  assert.equal(native.coarseFieldMutationOrdinal, 3);
  assert.equal(native.coarseUpdateStatus, 'submitted-unverified');
  assert.equal(native.coarseUpdateSubmittedInPlace, true);
  assert.equal(native.coarseUpdateInPlace, false);
  assert.equal(
    native.refluxFlags,
    SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_READY
      | SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_ADMITTED,
    JSON.stringify(native)
  );
  assert.ok(native.refluxRowCount > 0, JSON.stringify(native));
  assert.ok(native.refluxFineCorrectionCount > 0, JSON.stringify(native));
  assert.ok(native.refluxCoarseApplyCount > 0, JSON.stringify(native));
  assert.equal(
    native.refluxPhase,
    SCHROEDER_CROSS_LEVEL_REFLUX_PHASE_ENERGY_READY,
    JSON.stringify(native)
  );
  assert.equal(native.refluxFinalMutationInputOrdinal, 2);
  assert.equal(native.refluxFinalMutationOutputOrdinal, 3);
  assert.equal(native.refluxFinalStateEncoding, 2);
  assert.equal(native.refluxPositivityStatus, 1, JSON.stringify(native));
  assert.equal(native.refluxCflStatus, 1, JSON.stringify(native));
  assert.equal(native.refluxMomentumStatus, 1, JSON.stringify(native));
  assert.equal(native.refluxAngularStatus, 1, JSON.stringify(native));
  assert.equal(native.refluxEnergyStatus, 1, JSON.stringify(native));
  for (const residual of native.refluxMomentumResidual) {
    assert.ok(
      residual <= native.refluxMomentumTolerance,
      JSON.stringify(native)
    );
  }
  for (const residual of native.refluxAngularResidual) {
    assert.ok(
      residual <= native.refluxAngularTolerance,
      JSON.stringify(native)
    );
  }
  assert.ok(
    native.refluxEnergyResidual <= native.refluxEnergyTolerance,
    JSON.stringify(native)
  );
  assert.ok(native.refluxInternalEnergyDeposit >= 0, JSON.stringify(native));
  assert.deepEqual(native.p2gAllocationEvidence, [
    [0, 0],
    [0, 0]
  ]);
  assert.equal(native.validationError, null);
  assert.deepEqual(native.errors, []);
});
