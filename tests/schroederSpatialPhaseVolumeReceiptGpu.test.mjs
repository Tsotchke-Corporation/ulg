import assert from 'node:assert/strict';
import test from 'node:test';

import * as publicGpuAbi from '../ulg-gpu-abi/src/index.js';
import {
  SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_HEADER_LAYOUT,
  SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_HEADER_WORDS,
  SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_ADMITTED,
  SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_READY,
  ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_SCHEMA,
  createSchroederSpatialPhaseVolumeReceiptLayout,
  createSchroederSpatialPhaseVolumeReceiptPlan,
  deriveSchroederPhaseVolumeReceiptTolerance,
  validateSchroederSpatialPhaseVolumeReceiptDescriptor
} from '../ulg-gpu-abi/src/schroederSpatialPhaseVolumeReceipt.js';
import {
  createSchroederSpatialPhaseVolumeReceiptWgsl
} from '../ulg-gpu-abi/src/schroederSpatialPhaseVolumeReceiptWgsl.js';
import {
  SCHROEDER_SPATIAL_MECHANICS_FIELD_SOURCE_AUTHORITY_V2,
  createSchroederSpatialMechanicsFieldViewPlan
} from '../ulg-gpu-abi/src/schroederSpatialMechanicsFieldView.js';
import {
  createSchroederSpatialActiveSourceViewLayout
} from '../ulg-gpu-abi/src/schroederSpatialActiveSourceView.js';
import {
  SCHROEDER_SPATIAL_EPOCH_V2_REVERSE_CELL_PLUS_ONE,
  SCHROEDER_SPATIAL_EPOCH_V2_VERSION,
  ULG_SCHROEDER_SPATIAL_EPOCH_V2_SCHEMA
} from '../ulg-gpu-abi/src/schroederSpatialEpoch.js';
import {
  createSchroederSpatialPhaseVolumeMomentGpu
} from '../src/runtime/sph/schroederSpatialPhaseVolumeMomentGpu.js';
import {
  createSchroederSpatialPhaseVolumeReceiptGpu
} from '../src/runtime/sph/schroederSpatialPhaseVolumeReceiptGpu.js';
import {
  tagWebGpuBufferDevice
} from '../src/runtime/sph/sphGpuDeviceIdentity.js';

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => { resolve = resolvePromise; });
  promise.catch(() => {});
  return { promise, resolve };
}

function createFakeDevice({
  limits: limitOverrides = {}
} = {}) {
  const createdBuffers = [];
  const shaderModules = [];
  const pipelines = [];
  const bindGroups = [];
  const writes = [];
  const lost = deferred();
  const device = {
    lost: lost.promise,
    limits: {
      maxStorageBuffersPerShaderStage: 8,
      maxBufferSize: 256 * 1024 * 1024,
      maxStorageBufferBindingSize: 256 * 1024 * 1024,
      maxComputeWorkgroupsPerDimension: 65535,
      ...limitOverrides
    },
    queue: {
      writeBuffer(buffer, offset, data) { writes.push({ buffer, offset, data }); }
    },
    createBuffer(descriptor) {
      const buffer = {
        ...descriptor,
        destroyCount: 0,
        get destroyed() { return this.destroyCount > 0; },
        destroy() { this.destroyCount += 1; }
      };
      createdBuffers.push(buffer);
      return buffer;
    },
    createShaderModule(descriptor) {
      const module = { descriptor };
      shaderModules.push(module);
      return module;
    },
    createComputePipeline(descriptor) {
      const pipeline = {
        descriptor,
        getBindGroupLayout() { return { entryPoint: descriptor.compute.entryPoint }; }
      };
      pipelines.push(pipeline);
      return pipeline;
    },
    createBindGroup(descriptor) {
      const group = { descriptor };
      bindGroups.push(group);
      return group;
    }
  };
  return { device, createdBuffers, shaderModules, pipelines, bindGroups, writes, resolveLost: lost.resolve };
}

function createFakeEncoder({ indirectDispatch = true } = {}) {
  const clears = [];
  const passes = [];
  return {
    clears,
    passes,
    clearBuffer(buffer) { clears.push(buffer); },
    beginComputePass(descriptor = {}) {
      const pass = {
        descriptor,
        pipeline: null,
        bindGroup: null,
        dispatch: null,
        indirect: null,
        ended: false,
        setPipeline(value) { this.pipeline = value; },
        setBindGroup(index, value) { this.bindGroup = { index, value }; },
        dispatchWorkgroups(...value) { this.dispatch = value; },
        end() { this.ended = true; }
      };
      if (indirectDispatch) {
        pass.dispatchWorkgroupsIndirect = function dispatchWorkgroupsIndirect(buffer, offset) {
          this.indirect = { buffer, offset };
        };
      }
      passes.push(pass);
      return pass;
    }
  };
}

function taggedBuffer(device, label, size) {
  return tagWebGpuBufferDevice({
    label,
    size,
    destroyCount: 0,
    destroy() { this.destroyCount += 1; }
  }, device);
}

function createAuthority(device, {
  sourceCount = 2,
  sourceCapacity = 4,
  selectedLevel = 0,
  directoryV2 = false
} = {}) {
  const sourceBuffer = taggedBuffer(
    device,
    'phase-volume-receipt-source-assignment',
    sourceCount * 16 * Float32Array.BYTES_PER_ELEMENT
  );
  const sourceMechanicsBuffer = taggedBuffer(
    device,
    'phase-volume-receipt-source-mechanics',
    sourceCount * 32 * Float32Array.BYTES_PER_ELEMENT
  );
  const plan = createSchroederSpatialMechanicsFieldViewPlan({
    sourceCount,
    sourceCapacity,
    sourceAuthorityVersion: directoryV2
      ? SCHROEDER_SPATIAL_MECHANICS_FIELD_SOURCE_AUTHORITY_V2
      : undefined,
    sourceRowLayoutId: 1,
    identityStrideWords: 1,
    selectedLevel,
    gridNodeCount: 8,
    gridDims: [2, 2, 2],
    gridShift: 1,
    gridSpacingM: 0.25,
    generationId: 31,
    deviceOrdinal: 5,
    laneOrdinal: 7,
    leaseToken: 11,
    sourceFamilyId: 13,
    storageGeneration: 17,
    physicsTick: 19,
    physicsSubstep: 0,
    positionEpoch: 23,
    topologyEpoch: 29,
    chartEpoch: 37,
    levelEpoch: 41,
    supportEpoch: 43,
    completionOrdinal: 47
  });
  const fieldViewBuffer = taggedBuffer(
    device,
    'phase-volume-receipt-mechanics-field',
    plan.layout.byteLength
  );
  const stableCandidateOrderBuffer = taggedBuffer(
    device,
    'phase-volume-receipt-stable-candidate-order',
    plan.candidateCapacity * Uint32Array.BYTES_PER_ELEMENT
  );
  const field = {
    ...plan,
    status: 'schroeder-spatial-mechanics-field-view-gpu-encoded',
    submitPerformed: false,
    released: false,
    sourceBuffer,
    fieldViewBuffer,
    indirectDispatchBuffer: fieldViewBuffer,
    indirectDispatchOffsetBytes: 240,
    stableCandidateOrderBuffer,
    stableCandidateOrderCount: plan.candidateCount,
    directorySchema: null,
    directoryAbiVersion: null,
    spatialExecution: null,
    directoryBuffer: null,
    activeSourceView: null,
    activeSourceViewBuffer: null,
    activeSourceCountAuthority: null,
    stableCandidateOrderCountAuthority: null
  };
  if (directoryV2) {
    const activeLayout = createSchroederSpatialActiveSourceViewLayout({
      physicalSourceCapacity: sourceCapacity,
      activeSourceCapacity: sourceCapacity
    });
    const activeSourceViewBuffer = taggedBuffer(
      device,
      'phase-volume-receipt-active-source-view',
      activeLayout.byteLength
    );
    const directoryBuffer = taggedBuffer(
      device,
      'phase-volume-receipt-directory-v2',
      4096
    );
    const activeSourceView = {
      schema: 'peercompute.ulg.schroeder-spatial-active-source-view.v1',
      status: 'schroeder-spatial-active-source-view-gpu-encoded',
      ready: true,
      selected: true,
      released: false,
      ...Object.fromEntries([
        'generationId',
        'deviceOrdinal',
        'laneOrdinal',
        'leaseToken',
        'sourceFamilyId',
        'storageGeneration',
        'physicsTick',
        'physicsSubstep',
        'positionEpoch',
        'topologyEpoch',
        'chartEpoch',
        'levelEpoch',
        'supportEpoch'
      ].map((key) => [key, plan[key]])),
      physicalSourceCount: sourceCount,
      physicalSourceCapacity: sourceCapacity,
      activeSourceCapacity: sourceCapacity,
      sourceRowLayoutId: 1,
      sourceRowStrideFloats: 16,
      buildOrdinal: plan.completionOrdinal,
      sourceBuffer,
      activeSourceViewBuffer,
      activeDispatchOffsetBytes: activeLayout.activeDispatchOffsetBytes,
      candidateDispatchOffsetBytes: activeLayout.candidateDispatchOffsetBytes,
      physicalDispatchOffsetBytes: activeLayout.physicalDispatchOffsetBytes,
      layout: activeLayout
    };
    Object.defineProperty(activeSourceView, 'ownerRuntime', {
      value: {
        ownsExecution: (candidate) => candidate === activeSourceView
      },
      enumerable: false
    });
    const activeSourceCountAuthority = Object.freeze({
      schema: activeSourceView.schema,
      activeSourceView,
      buffer: activeSourceViewBuffer,
      offsetWords: 18,
      offsetBytes: 18 * Uint32Array.BYTES_PER_ELEMENT,
      capacity: sourceCapacity,
      residency: 'gpu-only'
    });
    const candidateCountAuthority = Object.freeze({
      buffer: activeSourceViewBuffer,
      offsetWords: 43,
      sealOffsetWords: 30,
      expectedSeal: plan.completionOrdinal
    });
    const spatialExecution = {
      schema: ULG_SCHROEDER_SPATIAL_EPOCH_V2_SCHEMA,
      abiVersion: SCHROEDER_SPATIAL_EPOCH_V2_VERSION,
      reverseEncoding: SCHROEDER_SPATIAL_EPOCH_V2_REVERSE_CELL_PLUS_ONE,
      physicalSourceCount: sourceCount,
      physicalSourceCapacity: sourceCapacity,
      sourceBuffer,
      directoryBuffer,
      activeSourceView,
      activeSourceViewBuffer,
      activeSourceCountAuthority
    };
    Object.assign(field, {
      directorySchema: ULG_SCHROEDER_SPATIAL_EPOCH_V2_SCHEMA,
      directoryAbiVersion: SCHROEDER_SPATIAL_EPOCH_V2_VERSION,
      spatialExecution,
      directoryBuffer,
      activeSourceView,
      activeSourceViewBuffer,
      activeSourceCountAuthority,
      stableCandidateOrderCountAuthority: candidateCountAuthority
    });
  }
  Object.defineProperty(field, 'ownerRuntime', {
    value: { ownsExecution: (candidate) => candidate === field },
    enumerable: false
  });
  return { sourceBuffer, sourceMechanicsBuffer, field, plan };
}

function buildS9aMoment(device, authority) {
  const runtime = createSchroederSpatialPhaseVolumeMomentGpu(device, {
    maxSourceCount: authority.plan.sourceCapacity,
    fieldCapacity: authority.plan.fieldCapacity
  });
  const encoder = createFakeEncoder();
  const moment = runtime.encode(encoder, {
    sourceBuffer: authority.sourceBuffer,
    sourceMechanicsBuffer: authority.sourceMechanicsBuffer,
    sourceMechanicsBufferBorrowed: true,
    mechanicsFieldView: authority.field
  });
  return { runtime, encoder, moment };
}

test('S9-B receipt ABI v2 fixes a separate seven-storage-binding selected-source conservation contract', () => {
  assert.equal(SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_HEADER_LAYOUT.length, 64);
  assert.equal(SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_HEADER_WORDS, 64);
  const layout = createSchroederSpatialPhaseVolumeReceiptLayout({
    sourceCapacity: 4,
    fieldCapacity: 12
  });
  assert.equal(layout.sourceGroupCapacity, 1);
  assert.equal(layout.fieldGroupCapacity, 1);
  assert.equal(layout.sourcePartialOffsetVec4, 0);
  assert.equal(layout.fieldPartialOffsetVec4, 1);
  assert.equal(layout.fieldConditioningOffsetVec4, 2);
  assert.equal(layout.partialVec4Capacity, 3);
  const plan = createSchroederSpatialPhaseVolumeReceiptPlan({
    sourceCount: 2,
    sourceCapacity: 4,
    fieldCapacity: 12,
    selectedLevel: -1,
    gridNodeCount: 8,
    gridSpacingM: 0.25,
    generationId: 1,
    deviceOrdinal: 2,
    laneOrdinal: 3,
    leaseToken: 4,
    sourceFamilyId: 5,
    storageGeneration: 6,
    physicsTick: 7,
    physicsSubstep: 8,
    positionEpoch: 9,
    topologyEpoch: 10,
    chartEpoch: 11,
    levelEpoch: 12,
    supportEpoch: 13,
    completionOrdinal: 14
  });
  assert.equal(plan.schema, ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_SCHEMA);
  assert.equal(plan.candidateCount, 54);
  assert.equal(plan.diagnosticOnly, true);
  assert.equal(plan.stateMutationAllowed, false);
  const tolerance = deriveSchroederPhaseVolumeReceiptTolerance({
    selectedSourceVolumeM3: 0.006,
    fieldVolumeM3: 0.006,
    gridSpacingM: 0.25,
    gradientConditioningSumAbsM2: 0.12
  });
  assert.ok(tolerance.volumeToleranceM3 > 0);
  assert.ok(tolerance.gradientToleranceM2 > 0);
  assert.match(
    createSchroederSpatialPhaseVolumeReceiptWgsl(layout),
    /@group\(0\) @binding\(5\) var<storage, read_write> receipt_control/
  );
  assert.match(
    createSchroederSpatialPhaseVolumeReceiptWgsl(layout),
    /@group\(0\) @binding\(3\) var<storage, read> mechanics_field/
  );
  assert.match(
    createSchroederSpatialPhaseVolumeReceiptWgsl(layout),
    /@group\(0\) @binding\(7\) var<storage, read> source_assignments/
  );
  const wgsl = createSchroederSpatialPhaseVolumeReceiptWgsl(layout);
  assert.match(
    wgsl,
    /fn mechanics_field_dispatch_shape_admitted\(field_count: u32\)[\s\S]*dispatch_y == expected_y[\s\S]*mechanics_field\[44u\] == dispatch_x[\s\S]*mechanics_field\[45u\] == dispatch_y[\s\S]*mechanics_field\[46u\] == dispatch_z/
  );
  assert.match(
    wgsl,
    /workgroup_id\.x \+ workgroup_id\.y \* mechanics_field\[60u\]/
  );
  assert.match(
    wgsl,
    /fn reduce_phase_volume_receipt_fields\([\s\S]*mechanics_field_linear_invocation\(local_id, workgroup_id\)[\s\S]*linear_group < group_count\(field_count\)/
  );
  assert.doesNotMatch(
    wgsl,
    /fn reduce_phase_volume_receipt_fields\([^)]*global_invocation_id/
  );
  assert.equal(
    publicGpuAbi.ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_SCHEMA,
    ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_SCHEMA
  );
});

test('S9-B receipt admits only field work that fits the public 2D dispatch envelope', () => {
  const accepted = createFakeDevice({
    limits: { maxComputeWorkgroupsPerDimension: 2 }
  });
  const acceptedRuntime = createSchroederSpatialPhaseVolumeReceiptGpu(
    accepted.device,
    {
      maxSourceCount: 5,
      fieldCapacity: 5 * 27,
      arenaCount: 1
    }
  );
  assert.equal(acceptedRuntime.layout.fieldGroupCapacity, 3);
  assert.equal(acceptedRuntime.maxComputeWorkgroupsPerDimension, 2);
  assert.equal(acceptedRuntime.destroy(), true);

  const rejected = createFakeDevice({
    limits: { maxComputeWorkgroupsPerDimension: 2 }
  });
  assert.throws(
    () => createSchroederSpatialPhaseVolumeReceiptGpu(rejected.device, {
      maxSourceCount: 10,
      fieldCapacity: 10 * 27,
      arenaCount: 1
    }),
    /field dispatch exceeds the WebGPU two-dimensional limit/
  );
});

test('S9-B receipt binds only exact live S9-A evidence and never writes borrowed inputs', async () => {
  const fixture = createFakeDevice();
  const authority = createAuthority(fixture.device);
  const phase = buildS9aMoment(fixture.device, authority);
  const runtime = createSchroederSpatialPhaseVolumeReceiptGpu(fixture.device, {
    maxSourceCount: authority.plan.sourceCapacity,
    fieldCapacity: authority.plan.fieldCapacity
  });
  const encoder = createFakeEncoder();
  const before = {
    momentControl: phase.moment.controlBuffer,
    momentRows: phase.moment.momentBuffer,
    sourceAssignments: authority.sourceBuffer,
    sourceMechanics: authority.sourceMechanicsBuffer,
    mechanicsField: authority.field.fieldViewBuffer
  };
  const execution = runtime.encode(encoder, { phaseVolumeMoment: phase.moment });

  assert.equal(execution.schema, ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_SCHEMA);
  assert.equal(execution.phaseVolumeMoment, phase.moment);
  assert.equal(execution.parentPhaseVolumeMoment, phase.moment);
  assert.equal(execution.sourceBuffer, before.sourceAssignments);
  assert.equal(execution.sourceBufferBorrowed, true);
  assert.equal(execution.sourceMechanicsBuffer, before.sourceMechanics);
  assert.equal(execution.mechanicsFieldView, authority.field);
  assert.equal(execution.encodedComputePassCount, 3);
  assert.equal(execution.storageBindingCount, 7);
  assert.equal(execution.readbackPerformed, false);
  assert.equal(execution.fullParticleReadbackPerformed, false);
  assert.equal(execution.mechanicsFieldDispatchDimensions, 2);
  assert.equal(execution.mechanicsFieldDispatchWorkgroupSize, 64);
  assert.equal(
    execution.mechanicsFieldDispatchLinearization,
    'linearGroup=workgroup.x+workgroup.y*dispatchX'
  );
  assert.equal(
    execution.mechanicsFieldDispatchCapacityWorkgroups,
    execution.layout.fieldGroupCapacity
  );
  assert.equal(execution.maxComputeWorkgroupsPerDimension, 65535);
  assert.equal(execution.diagnosticOnly, true);
  assert.equal(execution.stateMutationAllowed, false);
  assert.equal(execution.gpuBufferCreationCountDuringEncode, 0);
  assert.equal(encoder.clears.length, 2);
  assert.equal(encoder.clears[0], execution.controlBuffer);
  assert.equal(encoder.clears[1], execution.partialBuffer);
  assert.equal(encoder.passes.length, 3);
  assert.deepEqual(encoder.passes[0].dispatch, [1, 1, 1]);
  assert.deepEqual(encoder.passes[1].indirect, {
    buffer: authority.field.fieldViewBuffer,
    offset: 240
  });
  assert.deepEqual(encoder.passes[2].dispatch, [1, 1, 1]);
  for (const [index, pass] of encoder.passes.entries()) {
    assert.equal(pass.ended, true);
    assert.equal(pass.bindGroup.value.descriptor.entries.length, [8, 6, 6][index]);
  }
  const owned = runtime.allocationEntries().map((entry) => entry.buffer);
  for (const borrowed of Object.values(before)) assert.equal(owned.includes(borrowed), false);
  assert.equal(
    validateSchroederSpatialPhaseVolumeReceiptDescriptor(execution).admitted,
    true
  );
  assert.equal(runtime.markExecutionSubmitted(execution), true);
  assert.equal(runtime.isExecutionSubmitted(execution), true);
  const fence = deferred();
  const released = runtime.releaseExecutionAfter(execution, fence.promise);
  fence.resolve();
  assert.equal(await released, true);
  assert.equal(execution.released, true);
  assert.equal(phase.moment.released, false);
  assert.equal(authority.sourceMechanicsBuffer.destroyCount, 0);
  assert.equal(phase.moment.controlBuffer.destroyCount, 0);
});

test('S9-B v2 scans ActiveSource indirectly, retains physical rows, and never invents A', () => {
  const fixture = createFakeDevice();
  const authority = createAuthority(fixture.device, {
    sourceCount: 64,
    sourceCapacity: 64,
    directoryV2: true
  });
  const phase = buildS9aMoment(fixture.device, authority);
  const runtime = createSchroederSpatialPhaseVolumeReceiptGpu(fixture.device, {
    maxSourceCount: 64,
    fieldCapacity: authority.plan.fieldCapacity,
    arenaCount: 1
  });
  const encoder = createFakeEncoder();
  const receipt = runtime.encode(encoder, {
    phaseVolumeMoment: phase.moment
  });

  assert.equal(receipt.sourceAuthorityVersion, 2);
  assert.equal(receipt.sourceWorkIdentity, 'gpu-active-ordinal');
  assert.equal(receipt.sourceCount, 64);
  assert.equal(receipt.physicalSourceCount, 64);
  assert.equal(receipt.globalScanSourceCount, null);
  assert.equal(receipt.sourceGroupCount, null);
  assert.equal(receipt.candidateCount, null);
  assert.equal(receipt.globalScanCandidateCount, null);
  assert.equal(
    receipt.activeSourceCountAuthority,
    phase.moment.activeSourceCountAuthority
  );
  assert.equal(receipt.candidateCountAuthority, phase.moment.candidateCountAuthority);
  assert.deepEqual(encoder.passes[0].indirect, {
    buffer: authority.field.activeSourceViewBuffer,
    offset: 48 * Uint32Array.BYTES_PER_ELEMENT
  });
  assert.deepEqual(encoder.passes[1].indirect, {
    buffer: authority.field.fieldViewBuffer,
    offset: 60 * Uint32Array.BYTES_PER_ELEMENT
  });
  assert.deepEqual(encoder.passes[2].dispatch, [1, 1, 1]);
  assert.ok(
    fixture.bindGroups.slice(-3).every(({ descriptor }) => (
      descriptor.entries.some(({ binding }) => binding === 8)
    ))
  );
  assert.equal(receipt.gpuBufferCreationCountDuringEncode, 0);
  assert.equal(receipt.readbackPerformed, false);
  assert.equal(
    validateSchroederSpatialPhaseVolumeReceiptDescriptor(receipt).admitted,
    true
  );

  const v2Plan = createSchroederSpatialPhaseVolumeReceiptPlan({
    sourceCount: 64,
    sourceCapacity: 64,
    fieldCapacity: authority.plan.fieldCapacity,
    selectedLevel: authority.plan.selectedLevel,
    gridNodeCount: authority.plan.gridNodeCount,
    gridSpacingM: authority.plan.gridSpacingM,
    generationId: authority.plan.generationId,
    deviceOrdinal: authority.plan.deviceOrdinal,
    laneOrdinal: authority.plan.laneOrdinal,
    leaseToken: authority.plan.leaseToken,
    sourceFamilyId: authority.plan.sourceFamilyId,
    storageGeneration: authority.plan.storageGeneration,
    physicsTick: authority.plan.physicsTick,
    physicsSubstep: authority.plan.physicsSubstep,
    positionEpoch: authority.plan.positionEpoch,
    topologyEpoch: authority.plan.topologyEpoch,
    chartEpoch: authority.plan.chartEpoch,
    levelEpoch: authority.plan.levelEpoch,
    supportEpoch: authority.plan.supportEpoch,
    completionOrdinal: authority.plan.completionOrdinal,
    sourceAuthorityVersion: 2
  });
  assert.equal(v2Plan.globalScanSourceCount, null);
  assert.equal(v2Plan.globalScanCandidateCount, null);
  const v2Wgsl = createSchroederSpatialPhaseVolumeReceiptWgsl(
    v2Plan.layout,
    { sourceAuthorityVersion: 2 }
  );
  assert.match(v2Wgsl, /fn physical_source_for_active/);
  assert.match(v2Wgsl, /active_source_linear_invocation/);
  assert.match(v2Wgsl, /i32\(round\(level\)\) != params\.selected_level/);
  assert.match(v2Wgsl, /selected_source_count >= 0u/);
  assert.match(v2Wgsl, /volume >= 0\.0/);
  assert.match(
    v2Wgsl,
    /if \(count == 0u\) \{[\s\S]*dispatch_x == 0u && dispatch_y == 1u && dispatch_z == 1u/
  );

  runtime.releaseExecution(receipt, { discardedEncoder: true });
  phase.runtime.releaseExecution(phase.moment, { discardedEncoder: true });
  assert.equal(runtime.destroy(), true);
  assert.equal(phase.runtime.destroy(), true);
});

test('S9-B receipt treats a partial active timestamp recorder as unavailable', () => {
  const { device } = createFakeDevice();
  const authority = createAuthority(device);
  const { moment } = buildS9aMoment(device, authority);
  const runtime = createSchroederSpatialPhaseVolumeReceiptGpu(device, {
    maxSourceCount: authority.plan.sourceCapacity,
    fieldCapacity: authority.plan.fieldCapacity
  });

  const receipt = runtime.encode(createFakeEncoder(), {
    phaseVolumeMoment: moment,
    // Some existing hierarchy fixtures use an active recorder as a coarse
    // capability signal without the optional encoder-span interface.
    gpuTimestampRecorder: { active: true }
  });

  assert.equal(
    receipt.status,
    'schroeder-spatial-phase-volume-receipt-gpu-encoded'
  );
  runtime.releaseExecution(receipt, { discardedEncoder: true });
  runtime.destroy();
});

test('S9-B rejects submitted, released, foreign, or shape-mismatched S9-A parents before encoding', () => {
  const fixture = createFakeDevice();
  const authority = createAuthority(fixture.device);
  const phase = buildS9aMoment(fixture.device, authority);
  const runtime = createSchroederSpatialPhaseVolumeReceiptGpu(fixture.device, {
    maxSourceCount: authority.plan.sourceCapacity,
    fieldCapacity: authority.plan.fieldCapacity
  });
  assert.equal(phase.runtime.markExecutionSubmitted(phase.moment), true);
  assert.throws(
    () => runtime.encode(createFakeEncoder(), { phaseVolumeMoment: phase.moment }),
    /exact live encoded S9-A moment sidecar/
  );

  const freshAuthority = createAuthority(fixture.device);
  const freshPhase = buildS9aMoment(fixture.device, freshAuthority);
  const malformed = { ...freshPhase.moment, sourceMechanicsBufferBorrowed: false };
  assert.throws(
    () => runtime.encode(createFakeEncoder(), { phaseVolumeMoment: malformed }),
    /exact live encoded S9-A moment sidecar/
  );
  assert.equal(runtime.activeExecutionCount(), 0);
});

test('S9-B quarantines an arena after a partial encoder failure until discarded-encoder release', () => {
  const fixture = createFakeDevice();
  const authority = createAuthority(fixture.device);
  const phase = buildS9aMoment(fixture.device, authority);
  const runtime = createSchroederSpatialPhaseVolumeReceiptGpu(fixture.device, {
    maxSourceCount: authority.plan.sourceCapacity,
    fieldCapacity: authority.plan.fieldCapacity,
    arenaCount: 1
  });
  let failedExecution = null;
  assert.throws(
    () => runtime.encode(createFakeEncoder({ indirectDispatch: false }), {
      phaseVolumeMoment: phase.moment
    }),
    (error) => {
      assert.match(error.message, /indirect WebGPU dispatch/);
      failedExecution = error.phaseVolumeReceiptExecution;
      return true;
    }
  );
  assert.ok(failedExecution);
  assert.equal(
    failedExecution.status,
    'schroeder-spatial-phase-volume-receipt-encode-failed-awaiting-discard'
  );
  assert.equal(failedExecution.failureRequiresDiscardedEncoder, true);
  assert.equal(runtime.ownsExecution(failedExecution), true);
  assert.equal(runtime.activeExecutionCount(), 1);
  assert.throws(
    () => runtime.markExecutionSubmitted(failedExecution),
    /failed phase-volume receipt encoding requires discarded-encoder release/
  );
  assert.throws(
    () => runtime.encode(createFakeEncoder(), { phaseVolumeMoment: phase.moment }),
    /arenas are under backpressure/
  );
  assert.equal(runtime.releaseExecution(failedExecution, { discardedEncoder: true }), true);
  assert.equal(failedExecution.released, true);
  assert.equal(runtime.activeExecutionCount(), 0);

  const retry = runtime.encode(createFakeEncoder(), { phaseVolumeMoment: phase.moment });
  assert.equal(retry.ready, true);
  assert.equal(runtime.releaseExecution(retry, { discardedEncoder: true }), true);
});

test('S9-B runtime retires only receipt-owned buffers after device loss', async () => {
  const fixture = createFakeDevice();
  const authority = createAuthority(fixture.device);
  const phase = buildS9aMoment(fixture.device, authority);
  const runtime = createSchroederSpatialPhaseVolumeReceiptGpu(fixture.device, {
    maxSourceCount: authority.plan.sourceCapacity,
    fieldCapacity: authority.plan.fieldCapacity,
    arenaCount: 1
  });
  const execution = runtime.encode(createFakeEncoder(), { phaseVolumeMoment: phase.moment });
  assert.equal(runtime.markExecutionSubmitted(execution), true);
  const quarantined = runtime.quarantineExecutionAfterDeviceLoss(execution);
  fixture.resolveLost({ reason: 'destroyed' });
  assert.equal(await quarantined, true);
  assert.equal(execution.released, true);
  assert.ok(execution.controlBuffer.destroyed);
  assert.ok(execution.partialBuffer.destroyed);
  assert.equal(phase.moment.controlBuffer.destroyed, false);
  assert.equal(phase.moment.momentBuffer.destroyed, false);
  assert.equal(authority.sourceMechanicsBuffer.destroyCount, 0);
});

test('receipt descriptor rejects identity drift and cannot overclaim ready/admitted control state', () => {
  const fixture = createFakeDevice();
  const authority = createAuthority(fixture.device);
  const phase = buildS9aMoment(fixture.device, authority);
  const runtime = createSchroederSpatialPhaseVolumeReceiptGpu(fixture.device, {
    maxSourceCount: authority.plan.sourceCapacity,
    fieldCapacity: authority.plan.fieldCapacity
  });
  const execution = runtime.encode(createFakeEncoder(), { phaseVolumeMoment: phase.moment });
  assert.equal(
    validateSchroederSpatialPhaseVolumeReceiptDescriptor(execution, {
      generationId: execution.generationId,
      selectedLevel: execution.selectedLevel
    }).admitted,
    true
  );
  assert.equal(
    validateSchroederSpatialPhaseVolumeReceiptDescriptor({
      ...execution,
      generationId: execution.generationId + 1
    }).admitted,
    false
  );
  assert.equal(
    SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_READY
      | SCHROEDER_SPATIAL_PHASE_VOLUME_RECEIPT_STATUS_ADMITTED,
    3
  );
});
