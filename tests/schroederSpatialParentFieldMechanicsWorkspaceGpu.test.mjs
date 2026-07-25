import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_PHASE_COARSE_PUBLISH_COMPLETE,
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_PHASE_FINE_CORRECTION_COMPLETE,
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_PHASE_PREDICTOR_VELOCITY_READY,
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_INTERNAL_ENERGY_REFLUX_DEPOSIT,
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_REFLUX_MEASURED_CONSERVATIVE,
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_HEADER_LAYOUT,
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_HEADER_WORDS,
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_FINE_IMPULSE_WORDS,
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
  createSchroederSpatialParentFieldMechanicsWorkspaceGpu
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

const RUN_NATIVE_M0 = process.env.ULG_RUN_NATIVE_PARENT_FIELD_MECHANICS_M0 === '1';
const RUN_NATIVE_M1 = process.env.ULG_RUN_NATIVE_PARENT_FIELD_MECHANICS_M1 === '1';
const RUN_NATIVE_M2 = process.env.ULG_RUN_NATIVE_PARENT_FIELD_MECHANICS_M2 === '1';
const RUN_NATIVE = RUN_NATIVE_M0 || RUN_NATIVE_M1 || RUN_NATIVE_M2
  || process.env.ULG_RUN_NATIVE_PARENT_FIELD_MECHANICS === '1';
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

function fakeDevice() {
  const buffers = [];
  const pipelines = [];
  const submissions = [];
  const writes = [];
  return {
    buffers,
    pipelines,
    submissions,
    writes,
    limits: {
      maxBufferSize: 256 * 1024 * 1024,
      maxStorageBufferBindingSize: 128 * 1024 * 1024,
      maxUniformBufferBindingSize: 64 * 1024,
      maxStorageBuffersPerShaderStage: 8
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
          return { entryPoint: descriptor.compute.entryPoint, index };
        }
      };
      pipelines.push(pipeline);
      return pipeline;
    },
    createBindGroup(descriptor) { return descriptor; },
    createCommandEncoder() { return fakeEncoder(); },
    queue: {
      writeBuffer(buffer, offset, data) {
        writes.push({ buffer, offset, data: data.slice?.(0) ?? data });
      },
      submit(commands) { submissions.push(commands); },
      onSubmittedWorkDone() { return Promise.resolve(); }
    }
  };
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
  assert.equal(SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_PARAMS_BYTES, 288);
  assert.equal(SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_ROUTE_WORDS, 16);
  assert.equal(
    SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_FINE_IMPULSE_WORDS,
    16
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
  assert.equal(layout.parentToCoarseOrdinalOffsetWords, 680);
  assert.equal(layout.wordLength, 689);
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

test('parent-field mechanics rejects devices below the eight-storage-binding floor', () => {
  const device = fakeDevice();
  device.limits.maxStorageBuffersPerShaderStage = 7;
  assert.throws(
    () => createSchroederSpatialParentFieldMechanicsWorkspaceGpu(device, {
      parentFieldCapacity: 1,
      fineFieldCapacity: 1
    }),
    /requires eight storage bindings/
  );
});

test('workspace WGSL has frozen coarse registry, causal affine routes, and sealed energy evidence', () => {
  assert.match(schroederSpatialParentFieldMechanicsWorkspaceWgsl, /fn begin_fine_velocity_correction/);
  assert.match(schroederSpatialParentFieldMechanicsWorkspaceWgsl, /fine_store\(59u, FIELD_EMPTY\)/);
  assert.match(schroederSpatialParentFieldMechanicsWorkspaceWgsl, /fine_store\(59u, FIELD_VELOCITY\)/);
  assert.match(schroederSpatialParentFieldMechanicsWorkspaceWgsl, /range_fits/);
  assert.match(schroederSpatialParentFieldMechanicsWorkspaceWgsl, /fn register_reflux_coarse_registry/);
  assert.doesNotMatch(
    schroederSpatialParentFieldMechanicsWorkspaceWgsl,
    /reflux_load\(60u\) != params\.generation_id/
  );
  assert.equal(
    [...schroederSpatialParentFieldMechanicsWorkspaceWgsl.matchAll(
      /reflux_store\(60u, params\.generation_id\)/g
    )].length,
    2
  );
  assert.match(schroederSpatialParentFieldMechanicsWorkspaceWgsl, /fn evaluate_causal_route/);
  assert.match(schroederSpatialParentFieldMechanicsWorkspaceWgsl, /fn scatter_causal_route_proposal/);
  assert.match(schroederSpatialParentFieldMechanicsWorkspaceWgsl, /fn seal_fine_correction_alpha/);
  assert.match(schroederSpatialParentFieldMechanicsWorkspaceWgsl, /fn prepare_fine_transaction/);
  assert.match(
    schroederSpatialParentFieldMechanicsWorkspaceWgsl,
    /fn admit_cross_level_phase_volume/
  );
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
    /fn commit_routed_reflux\(\)[\s\S]*reflux_store\(8u, ordinal \+ 1u\)/
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
  assert.deepEqual(
    predictorEncoder.events.filter((event) => event.kind === 'copy')
      .map((event) => event.sourceOffset),
    [240, 256, 272]
  );
  assert.equal(
    predictorEncoder.events.filter((event) => event.kind === 'pass').length,
    9
  );
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
      const workspaceSource = await fetch(workspaceUrl).then(
        (response) => response.text()
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
        proposalModule
      ] = await Promise.all([
        import('/ulg-gpu-abi/src/index.js'),
        import(versioned(
          '/src/runtime/sph/sphGpuBuffers.js',
          g2pSource
        )),
        import(versioned(
          '/src/runtime/sph/schroederSpatialEpochGpu.js',
          proposalSource
        )),
        import(versioned(
          '/src/runtime/sph/sphGridGpuKernel.js',
          workspaceSource,
          g2pSource
        )),
        import(versioned(
          '/src/runtime/sph/sphGridUpdateGpuKernel.js',
          workspaceSource,
          g2pSource
        )),
        import(workspaceUrl),
        import('/src/runtime/sph/sphG2pGpuKernel.js'),
        import('/src/runtime/sph/schroederSpatialMechanicalProposalsGpu.js')
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
      const p2g = async (selectedLevel, spacing) => {
        const projection = await gridModule.runMlsMpmP2gGridProjectionWebGpu({
          device,
          sphParticleState,
          mlsMpmParticleState,
          sphParticleUpload: sphUpload,
          mlsMpmParticleUpload: mlsUpload,
          schroederLevelAssignment: levelAssignment,
          schroederSelectedLevel: selectedLevel,
          schroederSpatialEpochGeneration: generation,
          canonicalSpatialRequired: true,
          mechanicsFieldMode: 'required',
          gridSpacingM: spacing,
          boxDimsM: [2, 2, 2],
          dt: 0.01,
          internalPressureScale: 0,
          retainGridBuffer: false,
          readbackMode: 'no-full-readback'
        });
        p2gAllocationEvidence.push([
          projection.denseGridBufferAllocatedBytes,
          projection.denseAccumulatorBufferAllocatedBytes
        ]);
        return projection;
      };
      const buildPredictors = async (fineProjection, coarseProjection) => {
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
          gravityMPerS2: [0, -9.80665, 0],
          boxDimsM: [2, 2, 2],
          cflFactor: 0.4,
          maxCorrectionMPerS: 10,
          refluxLedger: macroRefluxLedger
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

      let fineProjection = await p2g(0, 0.25);
      let coarseProjection = await p2g(1, 0.5);
      const fineWorkspace = await buildPredictors(fineProjection, coarseProjection);
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
      const malformed = {
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
      };
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
        readbackMode: 'no-full-readback'
      });
      const fineEncoder = device.createCommandEncoder();
      const correctedFineUpdate = fineWorkspace.runtime.encodeFineCorrection(
        fineEncoder,
        fineWorkspace.execution,
        { fineGridUpdate: fineUpdate, deltaScale: 1, maxCorrectionMPerS: 10 }
      );
      device.queue.submit([fineEncoder.finish()]);
      fineWorkspace.runtime.markTerminalSubmitted(fineWorkspace.execution);
      const fineWorkspaceRead = await readWords(
        fineWorkspace.execution.workspaceBuffer,
        fineWorkspace.execution.layout.byteLength,
        'native-parent-mechanics-fine-workspace-readback'
      );
      const fineFieldRead = await readWords(
        generation.parentFieldView.fineFieldView.fieldViewBuffer,
        generation.parentFieldView.fineFieldView.layout.byteLength,
        'native-parent-mechanics-fine-field-readback'
      );
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
        const g2pOptions = (gridUpdate, selectedLevel, proposal) => ({
          device,
          sphParticleState,
          mlsMpmParticleState,
          gridUpdate,
          sphParticleUpload: sphUpload,
          mlsMpmParticleUpload: mlsUpload,
          dt: 0.01,
          boxDimsM: [2, 2, 2],
          internalPressureScale: 0,
          liquidWallDampingAlpha: 0,
          liquidWallDampingDistanceM: 0,
          particleSeparationRelaxation: 0,
          particleSeparationVelocityDamping: 0,
          schroederSelectedLevel: selectedLevel,
          schroederSpatialEpochGeneration: generation,
          schroederSpatialMechanicalProposal: proposal,
          canonicalSpatialRequired: true,
          observeCanonicalSpatialAuthority: false,
          mechanicsFieldMode: 'required',
          retainOutputParticleBuffers: true,
          readbackMode: 'no-full-readback'
        });

        const fineProposal = proposalFor(0.25, 0);
        const fineG2p = await g2pModule.runMlsMpmG2pWebGpu(
          g2pOptions(correctedFineUpdate, 0, fineProposal)
        );
        const postFineReflux = await readWords(
          macroRefluxLedger.buffer,
          macroRefluxLedger.byteLength,
          'native-parent-mechanics-m2-post-fine-reflux-readback'
        );
        fineProposal.releaseAfterSubmittedWork();
        await fineProposal.releasePromise;
        const coarseImpulse = Array.from(postFineReflux.floats.slice(19, 22));
        const coarseImpulseNorm = Math.hypot(...coarseImpulse);
        if (!(coarseImpulseNorm > 0) || !Number.isFinite(coarseImpulseNorm)) {
          throw new Error('M2 fixture requires a nonzero authenticated coarse impulse');
        }
        // Deliberately make the actual retained-projection coarse update lose
        // a little more kinetic energy than the theta predictor. This is a
        // controlled body-force mismatch, anti-parallel to the authenticated
        // reflux impulse, and proves nonzero causal terminal allocation rather
        // than only the all-zero ledger plumbing route.
        const manufacturedVelocityDeltaMPerS = 0.05;
        const manufacturedAcceleration = manufacturedVelocityDeltaMPerS / 0.01;
        const baselineGravity = [0, -9.80665, 0];
        const manufacturedGravity = baselineGravity.map(
          (value, axis) => value
            - manufacturedAcceleration * coarseImpulse[axis] / coarseImpulseNorm
        );
        const coarseGridUpdate = await updateModule.runMlsMpmGridUpdateWebGpu({
          device,
          p2gGridProjection: coarseProjection,
          mechanicsFieldMode: 'required',
          dt: 0.01,
          gravityMPerS2: manufacturedGravity,
          boxDimsM: [2, 2, 2],
          mechanicsFieldEnergyReceipt: { deferSeal: true },
          retainUpdatedGridBuffer: false,
          readbackMode: 'no-full-readback'
        });
        const coarseLayout = generation.parentFieldView.coarseFieldView.layout;
        const preTerminalCoarseField = await readWords(
          generation.parentFieldView.coarseFieldView.fieldViewBuffer,
          coarseLayout.byteLength,
          'native-parent-mechanics-m2-pre-terminal-coarse-field-readback'
        );
        const preTerminalReflux = await readWords(
          macroRefluxLedger.buffer,
          macroRefluxLedger.byteLength,
          'native-parent-mechanics-m2-pre-terminal-reflux-readback'
        );

        const terminalEncoder = device.createCommandEncoder();
        let terminalGridUpdate;
        try {
          terminalGridUpdate = fineWorkspace.runtime.encodeCoarseTerminal(
            terminalEncoder,
            {
              parentFieldView: generation.parentFieldView,
              coarseGridUpdate,
              refluxLedger: macroRefluxLedger,
              fineSubstepCount: 1,
              fineDt: 0.01
            }
          );
        } catch (error) {
          const fieldView = generation.parentFieldView.coarseFieldView;
          throw new Error(`${error?.message || error}; diagnostic=${JSON.stringify({
            receipt: coarseGridUpdate?.mechanicsFieldEnergyReceipt,
            submittedValidation:
              updateModule.validateSubmittedMlsMpmMechanicsFieldGridUpdate(
                device,
                coarseGridUpdate,
                {
                  sourceProjection: coarseProjection,
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
              coarseGridUpdate?.sourceProjection === coarseProjection
          })}`);
        }
        device.queue.submit([terminalEncoder.finish()]);
        const terminalExecution =
          terminalGridUpdate.parentFieldMechanicsWorkspaceExecution;
        fineWorkspace.runtime.markTerminalSubmitted(terminalExecution);
        const terminalWorkspace = await readWords(
          terminalExecution.workspaceBuffer,
          terminalExecution.layout.byteLength,
          'native-parent-mechanics-m2-terminal-workspace-readback'
        );
        const terminalCoarseField = await readWords(
          generation.parentFieldView.coarseFieldView.fieldViewBuffer,
          coarseLayout.byteLength,
          'native-parent-mechanics-m2-terminal-coarse-field-readback'
        );
        const terminalReflux = await readWords(
          macroRefluxLedger.buffer,
          macroRefluxLedger.byteLength,
          'native-parent-mechanics-m2-terminal-reflux-readback'
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

        const coarseProposal = proposalFor(0.5, 1);
        const coarseG2pRunOptions = g2pOptions(
          terminalGridUpdate,
          1,
          coarseProposal
        );
        let clonedTerminalArtifactRejection = null;
        try {
          await g2pModule.runMlsMpmG2pWebGpu(g2pOptions(
            { ...terminalGridUpdate },
            1,
            coarseProposal
          ));
        } catch (error) {
          clonedTerminalArtifactRejection = {
            code: error?.code ?? null,
            status: error?.status ?? null
          };
        }
        const coarseG2p = await g2pModule.runMlsMpmG2pWebGpu(
          coarseG2pRunOptions
        );
        coarseProposal.releaseAfterSubmittedWork();
        await coarseProposal.releasePromise;
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
          generation.parentFieldView.coarseFieldView.fieldViewBuffer,
          coarseLayout.byteLength,
          'native-parent-mechanics-m2-post-coarse-field-readback'
        );
        const postCoarseReflux = await readWords(
          macroRefluxLedger.buffer,
          macroRefluxLedger.byteLength,
          'native-parent-mechanics-m2-post-coarse-reflux-readback'
        );
        const terminalEvidence = abi.decodeSchroederCrossLevelRefluxEvidence(
          postCoarseReflux.words
        );
        const publicationToken = postCoarseReflux.words[95];
        const replayProposal = proposalFor(0.5, 1);
        const replayG2p = await g2pModule.runMlsMpmG2pWebGpu({
          ...coarseG2pRunOptions,
          schroederSpatialMechanicalProposal: replayProposal
        });
        const replayState = await readWords(
          replayG2p.stateBuffer,
          replayG2p.stateBufferByteLength,
          'native-parent-mechanics-m2-replay-state-readback'
        );
        const replayMechanics = await readWords(
          replayG2p.mechanicsBuffer,
          replayG2p.mechanicsBufferByteLength,
          'native-parent-mechanics-m2-replay-mechanics-readback'
        );
        const replayField = await readWords(
          generation.parentFieldView.coarseFieldView.fieldViewBuffer,
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
          generation.parentFieldView.generationId,
          generation.parentFieldView.deviceOrdinal,
          generation.parentFieldView.laneOrdinal,
          generation.parentFieldView.leaseToken,
          generation.parentFieldView.sourceFamilyId,
          generation.parentFieldView.storageGeneration,
          generation.parentFieldView.physicsTick,
          generation.parentFieldView.physicsSubstep,
          generation.parentFieldView.positionEpoch,
          generation.parentFieldView.topologyEpoch,
          generation.parentFieldView.chartEpoch,
          generation.parentFieldView.levelEpoch,
          generation.parentFieldView.supportEpoch
        ];
        const terminalLineageExact = expectedTerminalLineage.every(
          (value, index) => terminalReflux.words[64 + index] === value
        );
        const validationError = await device.popErrorScope();
        await new Promise((resolve) => setTimeout(resolve, 50));
        const coarseParticle = 1;
        const coarseStateBase = coarseParticle * 8;
        const coarseMass = state[coarseStateBase + 3];
        const coarseParticleDeltaJ = coarseMass * (
          coarseCandidateState.floats[coarseStateBase + 7]
            - state[coarseStateBase + 7]
        );
        const coarseIntendedParticleHeat = postCoarseReflux.floats[115]
          + (postCoarseReflux.floats[117] - terminalReflux.floats[117]);
        const coarseMeasuredParticleHeat = postCoarseReflux.floats[84]
          - terminalReflux.floats[84];
        const result = {
          status: 'm2-complete',
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
          inputStateWords: Array.from(inputStateWords),
          inputMechanicsWords: Array.from(inputMechanicsWords),
          replayStateWords: Array.from(replayState.words),
          replayMechanicsWords: Array.from(replayMechanics.words),
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
          replayG2pBackend: replayG2p.backend,
          manufacturedGravity,
          validationError: validationError?.message || null,
          errors
        };
        fineG2p.destroyOutputParticleBuffers();
        coarseG2p.destroyOutputParticleBuffers();
        replayG2p.destroyOutputParticleBuffers();
        replayProposal.releaseAfterSubmittedWork();
        await replayProposal.releasePromise;
        const fence = device.queue.onSubmittedWorkDone();
        await Promise.all([
          fineWorkspace.runtime.releaseExecutionAfter(
            fineWorkspace.execution,
            fence
          ),
          fineWorkspace.runtime.releaseExecutionAfter(terminalExecution, fence)
        ]);
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
      if (m1Only) {
        const preConsumeReflux = await readWords(
          macroRefluxLedger.buffer,
          macroRefluxLedger.byteLength,
          'native-parent-mechanics-m1-pre-consume-reflux-readback'
        );
        const proposal = proposalModule.runSchroederSpatialMechanicalProposalWebGpu({
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
          readbackMode: 'no-full-readback'
        };
        const g2p = await g2pModule.runMlsMpmG2pWebGpu(g2pOptions);
        proposal.releaseAfterSubmittedWork();
        await proposal.releasePromise;
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
        const replayProposal =
          proposalModule.runSchroederSpatialMechanicalProposalWebGpu({
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
        const replayG2p = await g2pModule.runMlsMpmG2pWebGpu({
          ...g2pOptions,
          schroederSpatialMechanicalProposal: replayProposal
        });
        const replayState = await readWords(
          replayG2p.stateBuffer,
          replayG2p.stateBufferByteLength,
          'native-parent-mechanics-m1-replay-state-readback'
        );
        const replayMechanics = await readWords(
          replayG2p.mechanicsBuffer,
          replayG2p.mechanicsBufferByteLength,
          'native-parent-mechanics-m1-replay-mechanics-readback'
        );
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
          replayStateWords: Array.from(replayState.words),
          replayMechanicsWords: Array.from(replayMechanics.words),
          replayReceiptFlags: replayField.words[receipt + 2],
          replayReceiptPhase: replayField.words[receipt + 3],
          replayPublishedHeat: replayField.floats[receipt + 9],
          replayConsumedHeat: replayField.floats[receipt + 10],
          replayRefluxFlags: replayReflux.words[2],
          replayCommitted: replayReflux.words[8],
          replayConsumed: replayReflux.words[15],
          replayRefluxPhase: replayReflux.words[59],
          replayTerminalReceipt: replayReflux.words[80],
          replayMeasuredParticleHeat: replayReflux.floats[84],
          replayOperationCount: replayReflux.words[97],
          replayRejectCount: replayReflux.words[108],
          replaySkipRejectCount: replayReflux.words[109],
          replayFineReceiptConsumeCount: replayReflux.words[120],
          replayIntendedFineRouteHeat: replayReflux.floats[112],
          replayConsumedFineRouteHeat: replayReflux.floats[114],
          replayIntendedLocalHeat: replayReflux.floats[116],
          replayConsumedLocalHeat: replayReflux.floats[117],
          g2pStatus: g2p.status,
          g2pBackend: g2p.backend,
          replayG2pStatus: replayG2p.status,
          replayG2pBackend: replayG2p.backend,
          correctedTerminalSubmitted:
            correctedFineUpdate.parentFieldMechanicsTerminalSubmitted,
          validationError: validationError?.message || null,
          errors
        };
        g2p.destroyOutputParticleBuffers();
        replayG2p.destroyOutputParticleBuffers();
        replayProposal.releaseAfterSubmittedWork();
        await replayProposal.releasePromise;
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
      coarseCapacityEnd: { fineMask: 0, coarseMask: 1 << 13 },
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
      code: 'ERR_CANONICAL_SPATIAL_AUTHORITY_REJECTED',
      status: 'parent-field-mechanics-terminal-provenance-rejected'
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
      native.inputStateWords.slice(0, 8)
    );
    assert.deepEqual(
      native.coarseCandidateMechanicsWords.slice(0, 32),
      native.inputMechanicsWords.slice(0, 32)
    );
    assert.equal(
      native.coarseCandidateStateWords.slice(8, 16).some(
        (word, index) => word !== native.inputStateWords[index + 8]
      ),
      true,
      JSON.stringify(native)
    );
    assert.equal(
      native.replayReceiptFlags,
      SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_STATUS_READY
        | SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_STATUS_FAIL_CLOSED
    );
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
    assert.notEqual(
      native.replayRefluxFlags & SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_FAIL_CLOSED,
      0
    );
    assert.notEqual(
      native.replayRefluxFlags & SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_PHASE_REJECTED,
      0
    );
    assert.equal(native.replayRefluxPhase, SCHROEDER_CROSS_LEVEL_REFLUX_PHASE_CONSUMED);
    assert.equal(
      native.replayTerminalReceipt,
      SCHROEDER_CROSS_LEVEL_REFLUX_TERMINAL_RECEIPT_REJECTED
    );
    assert.equal(native.replayPublicationToken, native.postPublicationToken);
    assert.equal(native.replayOperationCount, native.postOperationCount);
    assert.equal(native.replayCoarseApplyCount, native.postCoarseApplyCount);
    assert.equal(native.replayTerminalConsumeCount, native.postTerminalConsumeCount);
    assert.equal(
      native.replayCoarseReceiptConsumeCount,
      native.postCoarseReceiptConsumeCount
    );
    assert.equal(native.replayRejectCount, 1);
    assert.equal(native.replayMutationRollbackCount, 1);
    assert.equal(native.replayTerminalAdmitted, false);
    assert.equal(native.replayFailClosed, true);
    assert.equal(native.replayRowsUnchanged, true, JSON.stringify(native));
    assert.equal(native.replayCoarseDataUnchanged, true, JSON.stringify(native));
    assert.deepEqual(native.replayStateWords, native.inputStateWords);
    assert.deepEqual(native.replayMechanicsWords, native.inputMechanicsWords);
    assert.equal(native.fineG2pBackend, 'webgpu');
    assert.equal(native.coarseG2pBackend, 'webgpu');
    assert.equal(native.replayG2pBackend, 'webgpu');
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
    assert.equal(
      native.replayReceiptFlags,
      SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_STATUS_READY
        | SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_STATUS_FAIL_CLOSED,
      JSON.stringify(native)
    );
    assert.equal(
      native.replayReceiptPhase,
      SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_PHASE_CONSUMED,
      JSON.stringify(native)
    );
    assert.equal(
      native.replayRefluxFlags
        & (SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_READY
          | SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_ADMITTED),
      SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_READY
        | SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_ADMITTED,
      JSON.stringify(native)
    );
    assert.notEqual(
      native.replayRefluxFlags & SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_FAIL_CLOSED,
      0,
      JSON.stringify(native)
    );
    assert.notEqual(
      native.replayRefluxFlags & SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_PHASE_REJECTED,
      0,
      JSON.stringify(native)
    );
    assert.equal(native.replayCommitted, 1, JSON.stringify(native));
    assert.equal(native.replayConsumed, 1, JSON.stringify(native));
    assert.equal(native.replayFineReceiptConsumeCount, 1, JSON.stringify(native));
    assert.equal(native.replayRejectCount, 1, JSON.stringify(native));
    assert.equal(native.replayOperationCount, 1, JSON.stringify(native));
    assert.equal(
      native.replayRefluxPhase,
      SCHROEDER_CROSS_LEVEL_REFLUX_PHASE_ACCUMULATING,
      JSON.stringify(native)
    );
    assert.equal(
      native.replayTerminalReceipt,
      SCHROEDER_CROSS_LEVEL_REFLUX_TERMINAL_RECEIPT_REJECTED,
      JSON.stringify(native)
    );
    assert.ok(
      close(native.replayPublishedHeat, native.postPublishedHeat),
      JSON.stringify(native)
    );
    assert.ok(
      close(native.replayConsumedHeat, native.postConsumedHeat),
      JSON.stringify(native)
    );
    assert.ok(
      close(native.replayMeasuredParticleHeat, native.measuredParticleHeat),
      JSON.stringify(native)
    );
    assert.ok(
      close(native.replayIntendedFineRouteHeat, native.intendedFineRouteHeat),
      JSON.stringify(native)
    );
    assert.ok(
      close(native.replayConsumedFineRouteHeat, native.consumedFineRouteHeat),
      JSON.stringify(native)
    );
    assert.ok(
      close(native.replayIntendedLocalHeat, native.intendedLocalHeat),
      JSON.stringify(native)
    );
    assert.ok(
      close(native.replayConsumedLocalHeat, native.consumedLocalHeat),
      JSON.stringify(native)
    );
    assert.deepEqual(native.replayStateWords, native.inputStateWords);
    assert.deepEqual(native.replayMechanicsWords, native.inputMechanicsWords);
    assert.equal(native.g2pBackend, 'webgpu');
    assert.equal(native.replayG2pBackend, 'webgpu');
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
