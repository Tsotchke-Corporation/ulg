import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
  SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT,
  MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT,
  SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_ADMITTED,
  SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_READY,
  SCHROEDER_CROSS_LEVEL_REFLUX_PHASE_CONSUMED,
  SCHROEDER_CROSS_LEVEL_REFLUX_TERMINAL_RECEIPT_CONSUMED,
  createSchroederCrossLevelRefluxLedgerHeader
} from '../ulg-gpu-abi/src/index.js';
import {
  ULG_MECHANICS_RESIDENT_STAGE_WORKER_RESULT_SCHEMA,
  ULG_WORKER_RESIDENT_SCHEDULE_MAX_STEP_COUNT,
  ULG_WORKER_RESIDENT_SCHEDULE_QUEUE_DRAIN_INTERVAL_STEPS,
  ULG_WORKER_RESIDENT_SCHEDULE_PROGRESS_SCHEMA,
  ULG_WORKER_RESIDENT_SCHEDULE_RESULT_SCHEMA,
  ULG_WORKER_RESIDENT_SCHEDULE_STEP_SUMMARY_SCHEMA,
  ULG_WORKER_SCHROEDER_EPOCH_SEAL_SCHEMA,
  ULG_WORKER_SCHROEDER_LANE_SEED_LINEAGE_WORD_FIELDS,
  ULG_WORKER_SCHROEDER_LANE_SEED_STAGE_SCHEMA,
  ULG_WORKER_SCHROEDER_SAME_LEVEL_MECHANICS_STAGE_SCHEMA,
  ULG_WORKER_SCHROEDER_SPATIAL_EPOCH_STAGE_SCHEMA,
  cancelUlgMechanicsResidentStageWorkerSchedule,
  exportUlgMechanicsResidentStageWorkerRetainedCompactSnapshot,
  releaseUlgMechanicsResidentStageWorkerLane,
  resolveUlgMechanicsResidentStageWorkerRetainedParticleState,
  resolveUlgMechanicsResidentStageWorkerDeviceResult,
  runUlgMechanicsResidentStageWorkerPayload,
  runUlgMechanicsResidentStageWorkerSchedulePayload
} from '../src/services/ulgMechanicsResidentStage.worker.js';
import {
  createSchroederWorkerHierarchyConfig
} from '../src/runtime/sph/schroederWorkerLaneControlPlane.js';
import {
  releaseSchroederSpatialEpochGenerationAfterQueue,
  runSchroederSpatialEpochGenerationWebGpu,
  validateSchroederSpatialEpochGenerationLevelAssignment
} from '../src/runtime/sph/schroederSpatialEpochGpu.js';
import {
  createSchroederSameLevelMechanicsSpatialEpochTransaction,
  runSchroederSameLevelMechanicsWebGpu
} from '../src/runtime/sph/schroederHierarchyGpu.js';
import {
  ULG_SPH_GAS_PRESSURE_AUTHORITY_TELEMETRY_SCHEMA,
  ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA,
  isExactSphSpatialGasPressureAuthoritySource
} from '../src/runtime/sph/sphSpatialGasLedgerEosGpu.js';
import * as sphSpatialGasLedgerEosGpu from '../src/runtime/sph/sphSpatialGasLedgerEosGpu.js';
import {
  isExactSphPressureInterfaceCompletionReceipt,
  runSphPressureInterfaceForceRowsWebGpu
} from '../src/runtime/sph/sphPressureInterfaceGpuKernel.js';
import {
  tagResidentProductMassDevice,
  tagWebGpuBufferDevice,
  webGpuDeviceId
} from '../src/runtime/sph/sphGpuDeviceIdentity.js';
import {
  diagnoseUploadedMechanicsMaterialPhaseRecordsMatch
} from '../src/runtime/sph/sphMechanicsRefreshGpuKernel.js';
import {
  publishUlgPressureInterfaceGasCellFieldAdmission,
  publishUlgPressureInterfaceGasCellFieldImportSource
} from '../src/runtime/peercomputeBrowserResidentHost.js';
import {
  SCHROEDER_FUSED_TERMINAL_REFLUX_RECEIPT_TARGET_OPTION,
  ULG_SCHROEDER_FUSED_TERMINAL_REFLUX_RECEIPT_COPY_SCHEMA
} from '../src/runtime/sph/schroederFusedFineSubstepGpu.js';
import {
  SPH_GPU_PARTICLE_IDENTITY_UINTS
} from '../src/runtime/sph/sphGpuBuffers.js';

function manualBuffers({
  position = [1.25, 1.25, 1.25],
  velocity = [0, 0, 0],
  massKg = 8,
  smoothingLengthM = 1,
  restDensityKgPerM3 = 8,
  mechanicsDtS = 0.1
} = {}) {
  const state = new Float32Array([
    position[0], position[1], position[2], massKg,
    velocity[0], velocity[1], velocity[2], 123
  ]);
  const thermo = new Float32Array(12);
  thermo[3] = restDensityKgPerM3;
  const mechanics = new Float32Array(MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length);
  mechanics.set([1, 0, 0, 0, 1, 0, 0, 0, 1], 0);
  mechanics[18] = 1;
  mechanics[19] = massKg / restDensityKgPerM3;
  mechanics[20] = 1;
  mechanics[21] = 1;
  return {
    sphParticleState: {
      schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount: 1,
      smoothingLengthM,
      step: 0,
      time: 0,
      state,
      thermo
    },
    mlsMpmParticleState: {
      schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount: 1,
      step: 0,
      time: 0,
      mechanicsDtS,
      gridCflFactor: 10,
      gravityMPerS2: [0, 0, 0],
      mechanics
    }
  };
}

function phaseCarrierBuffers(options = {}) {
  const base = manualBuffers(options);
  const phaseLaneCount = 4;
  const stateStride = base.sphParticleState.state.length;
  const thermoStride = base.sphParticleState.thermo.length;
  const mechanicsStride = base.mlsMpmParticleState.mechanics.length;
  const state = new Float32Array(stateStride * phaseLaneCount);
  const thermo = new Float32Array(thermoStride * phaseLaneCount);
  const mechanics = new Float32Array(mechanicsStride * phaseLaneCount);
  for (let phaseLane = 0; phaseLane < phaseLaneCount; phaseLane += 1) {
    state.set(base.sphParticleState.state, phaseLane * stateStride);
    thermo.set(base.sphParticleState.thermo, phaseLane * thermoStride);
    mechanics.set(base.mlsMpmParticleState.mechanics, phaseLane * mechanicsStride);
    if (phaseLane > 0) {
      state[phaseLane * stateStride + 3] = 0;
      state[phaseLane * stateStride + 4] = 0;
      state[phaseLane * stateStride + 5] = 0;
      state[phaseLane * stateStride + 6] = 0;
      mechanics[phaseLane * mechanicsStride + 19] = 0;
    }
  }
  const phaseCarrierPlan = {
    schema: 'peercompute.ulg.sph-phase-carrier-plan.v2',
    status: 'phase-lane-capacity-ready',
    lineageCapacity: 1,
    primaryCapacity: 1,
    phaseLaneCount,
    phaseLaneStride: 1,
    companionStart: 1,
    companionCapacity: 3,
    particleCapacity: 4,
    stableLaneAddress: 'phaseLane*phaseLaneStride+lineageIndex',
    localOnlyArray: [1, 2, 3],
    localOnlyBuffer: { label: 'must-not-cross-worker-metadata-boundary' }
  };
  return {
    sphParticleState: {
      ...base.sphParticleState,
      particleCount: 4,
      state,
      thermo,
      phaseCarrierPlan
    },
    mlsMpmParticleState: {
      ...base.mlsMpmParticleState,
      particleCount: 4,
      mechanics,
      phaseCarrierPlan: { ...phaseCarrierPlan }
    }
  };
}

function stage(id, reads = [], writes = []) {
  return {
    id,
    lawNodeId: `ulg-mls-mpm-mechanics-${id}-stage`,
    runtimeTarget: 'gpu-hub-resident-stage-worker',
    reads,
    writes
  };
}

function payload(stageRecord, context, input = null, {
  laneId = 'ulg:test:mechanics-worker-lane',
  stateKey = 'ulg:test:mechanics-worker-state'
} = {}) {
  return {
    stage: stageRecord,
    input,
    lease: {
      laneId,
      stateKey,
      queueFencePolicy: 'queue.onSubmittedWorkDone-before-admission'
    },
    context: {
      ulgMechanicsResidentStageWorker: context
    }
  };
}

class FakeGpuBuffer {
  constructor({ label = null, size = 4, usage = 0 } = {}) {
    this.label = label;
    this.size = Math.max(4, Math.round(Number(size) || 4));
    this.usage = usage;
    this.bytes = new Uint8Array(this.size);
    this.destroyed = false;
    this.destroyCount = 0;
    this.mapState = 'unmapped';
  }

  mapAsync() {
    if (this.destroyed) throw new Error(`${this.label || 'buffer'} was destroyed`);
    this.mapState = 'mapped';
    return Promise.resolve();
  }

  getMappedRange(offset = 0, size = this.bytes.byteLength - offset) {
    if (this.destroyed) throw new Error(`${this.label || 'buffer'} was destroyed`);
    const start = Math.max(0, Math.round(Number(offset) || 0));
    const end = Math.min(this.bytes.byteLength, start + Math.max(0, Math.round(Number(size) || 0)));
    return this.bytes.buffer.slice(start, end);
  }

  unmap() { this.mapState = 'unmapped'; }

  destroy() {
    this.destroyCount += 1;
    this.destroyed = true;
    this.mapState = 'unmapped';
  }
}

function createFakeGpuDevice() {
  return {
    lost: new Promise(() => {}),
    limits: {
      maxBufferSize: 256 * 1024 * 1024,
      maxStorageBufferBindingSize: 128 * 1024 * 1024,
      maxUniformBufferBindingSize: 64 * 1024,
      maxStorageBuffersPerShaderStage: 16,
      maxComputeWorkgroupsPerDimension: 65_535,
      maxComputeWorkgroupStorageSize: 32 * 1024,
      minUniformBufferOffsetAlignment: 256
    },
    createBuffer(descriptor = {}) {
      return new FakeGpuBuffer(descriptor);
    },
    createShaderModule(descriptor = {}) {
      return { ...descriptor };
    },
    createComputePipeline(descriptor = {}) {
      return {
        ...descriptor,
        getBindGroupLayout(index) {
          return { index, entryPoint: descriptor.compute?.entryPoint || null };
        }
      };
    },
    createBindGroup(descriptor = {}) {
      return { ...descriptor };
    },
    createCommandEncoder() {
      const ops = [];
      return {
        copyBufferToBuffer(source, sourceOffset, target, targetOffset, size) {
          ops.push({ type: 'copy', source, sourceOffset, target, targetOffset, size });
        },
        clearBuffer(buffer, offset = 0, size = buffer.size - offset) {
          ops.push({ type: 'clear', buffer, offset, size });
        },
        beginComputePass() {
          return {
            setPipeline() {},
            setBindGroup() {},
            dispatchWorkgroups() {},
            dispatchWorkgroupsIndirect() {},
            end() {}
          };
        },
        finish() {
          return ops;
        }
      };
    },
    queue: {
      writeBufferCalls: [],
      submitCalls: [],
      writeBuffer(buffer, offset, data) {
        if (buffer.destroyed) throw new Error(`${buffer.label || 'buffer'} was destroyed`);
        const bytes = data instanceof ArrayBuffer
          ? new Uint8Array(data)
          : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        buffer.bytes.set(bytes, Math.max(0, Math.round(Number(offset) || 0)));
        this.writeBufferCalls.push({ buffer, offset, byteLength: bytes.byteLength });
      },
      submit(commandBuffers) {
        this.submitCalls.push(commandBuffers);
        for (const commandBuffer of commandBuffers || []) {
          for (const op of commandBuffer || []) {
            if (op.type === 'clear') {
              if (op.buffer.destroyed) {
                throw new Error(`${op.buffer.label || 'buffer'} was destroyed`);
              }
              const offset = Math.max(0, Math.round(Number(op.offset) || 0));
              const size = Math.max(0, Math.round(Number(op.size) || 0));
              op.buffer.bytes.fill(0, offset, Math.min(op.buffer.size, offset + size));
              continue;
            }
            if (op.source.destroyed) throw new Error(`${op.source.label || 'source'} was destroyed`);
            if (op.target.destroyed) throw new Error(`${op.target.label || 'target'} was destroyed`);
            const sourceOffset = Math.max(0, Math.round(Number(op.sourceOffset) || 0));
            const targetOffset = Math.max(0, Math.round(Number(op.targetOffset) || 0));
            const size = Math.max(0, Math.round(Number(op.size) || 0));
            op.target.bytes.set(op.source.bytes.subarray(sourceOffset, sourceOffset + size), targetOffset);
          }
        }
      },
      onSubmittedWorkDone() {
        this.submittedWorkDoneCount = (this.submittedWorkDoneCount || 0) + 1;
        return Promise.resolve();
      }
    }
  };
}

function fakeStorageBuffer(device, label, rows) {
  const buffer = device.createBuffer({
    label,
    size: Math.max(4, rows.byteLength),
    usage: 128 | 4 | 8
  });
  device.queue.writeBuffer(buffer, 0, rows);
  return buffer;
}

function workerGasOccupancyGenerationFixture(device, {
  particleCount,
  storageGeneration,
  physicsTick,
  physicsSubstep,
  positionEpoch,
  topologyEpoch,
  chartEpoch,
  levelEpoch,
  supportEpoch
}) {
  const taggedBuffer = (label, size) => tagWebGpuBufferDevice(
    device.createBuffer({ label, size, usage: 128 | 8 }),
    device
  );
  const assignmentBuffer = taggedBuffer(
    'worker-v4-gas-level-assignment',
    particleCount * SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT.length
      * Float32Array.BYTES_PER_ELEMENT
  );
  const sourceStateBuffer = taggedBuffer(
    'worker-v4-gas-state',
    particleCount * 8 * Float32Array.BYTES_PER_ELEMENT
  );
  const sourceMechanicsBuffer = taggedBuffer(
    'worker-v4-gas-mechanics-v0j',
    particleCount * 32 * Float32Array.BYTES_PER_ELEMENT
  );
  const particleIdentityBuffer = taggedBuffer(
    'worker-v4-gas-identity',
    particleCount * Uint32Array.BYTES_PER_ELEMENT
  );
  const levelAssignment = {
    schema: 'peercompute.ulg.schroeder-level-assignment-execution.v0',
    status: 'schroeder-level-assignment-submitted',
    bufferFamilyGenerationStatus:
      'schroeder-particle-buffer-family-generation-ready',
    particleCount,
    assignmentStrideFloats: SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT.length,
    assignmentBuffer,
    assignmentBufferByteLength: assignmentBuffer.size,
    sourceStateBuffer,
    sourceStateBufferBorrowed: true,
    sourceMechanicsBuffer,
    sourceMechanicsBufferBorrowed: true,
    sourceMechanicsBufferByteLength: sourceMechanicsBuffer.size,
    storageGeneration,
    physicsTick,
    physicsSubstep,
    positionEpoch,
    topologyEpoch,
    chartEpoch,
    levelEpoch,
    supportEpoch,
    minLevel: 0,
    maxLevel: 0,
    chartId: 0,
    baseGridSpacingM: 1
  };
  const generation = runSchroederSpatialEpochGenerationWebGpu({
    device,
    levelAssignment,
    particleCount,
    particleIdentityBuffer,
    particleIdentityStrideWords: 1,
    selectedLevel: 0,
    mechanicsGrid: {
      selectedLevel: 0,
      gridDims: [2, 2, 2],
      gridNodeCount: 8,
      gridShift: 1,
      gridSpacingM: 1
    },
    exactNearCellTreeEnabled: false
  });
  assert.equal(generation.ready, true, generation.reason);
  assert.equal(generation.mechanicsLevelViews.length, 1);
  assert.ok(generation.mechanicsLevelViews[0].phaseVolumeMoment);
  return generation;
}

test('ULG mechanics resident stage worker device resolver adopts a supplied worker device result', async () => {
  let requestCount = 0;
  const device = { label: 'presentation-worker-webgpu-device' };
  const supplied = {
    status: 'presentation-worker-device-ready',
    reason: 'offscreen canvas already owns device',
    device
  };

  const result = await resolveUlgMechanicsResidentStageWorkerDeviceResult({
    preferWebGpu: true,
    providedDeviceResult: supplied,
    requestDeviceResult: async () => {
      requestCount += 1;
      return { status: 'unexpected-requested-device', device: { label: 'unexpected' } };
    }
  });

  assert.equal(result.device, device);
  assert.equal(result.status, 'presentation-worker-device-ready');
  assert.equal(result.workerDeviceSource, 'provided-device-result');
  assert.equal(result.workerDeviceProvided, true);
  assert.equal(requestCount, 0);
});

test('ULG mechanics resident stage worker device resolver wraps a supplied worker device', async () => {
  let requestCount = 0;
  const device = {
    createBuffer() {
      return { label: 'supplied-worker-buffer' };
    },
    queue: {
      writeBuffer() {}
    }
  };

  const result = await resolveUlgMechanicsResidentStageWorkerDeviceResult({
    preferWebGpu: true,
    providedDevice: device,
    requestDeviceResult: async () => {
      requestCount += 1;
      return { status: 'unexpected-requested-device', device: { label: 'unexpected' } };
    }
  });

  assert.equal(result.device, device);
  assert.equal(result.status, 'webgpu-ready-supplied-worker-device');
  assert.equal(result.workerDeviceSource, 'provided-device');
  assert.equal(result.workerDeviceProvided, true);
  assert.equal(requestCount, 0);
});

test('ULG mechanics resident stage worker runs P2G, grid update, and G2P through one retained lane store', async () => {
  const buffers = manualBuffers();
  const context = {
    schema: 'peercompute.ulg.mechanics-resident-stage-worker-context.v0',
    taskIdPrefix: 'ulg:test:mechanics-worker',
    preferWebGpu: false,
    readbackMode: 'full-parity-readback',
    common: {
      ...buffers,
      gridSpacingM: buffers.sphParticleState.smoothingLengthM,
      boxDimsM: [5, 5, 5],
      dt: buffers.mlsMpmParticleState.mechanicsDtS,
      gravityMPerS2: [0, 0, 0],
      cflFactor: 10
    }
  };

  const p2g = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage('p2g', ['sph-particle-state', 'mls-mpm-mechanics'], ['mls-mpm-grid']),
    context
  ));
  assert.equal(p2g.summary.schema, ULG_MECHANICS_RESIDENT_STAGE_WORKER_RESULT_SCHEMA);
  assert.equal(p2g.summary.status, 'worker-stage-completed');
  assert.equal(p2g.value.workerResidentStage.stageId, 'p2g');
  assert.equal(p2g.value.workerResidentStage.retainedWithinWorker, true);
  assert.equal(p2g.value.workerResidentStage.workerWebGpuRequested, false);
  assert.equal(p2g.value.workerResidentStage.workerDeviceCached, false);
  assert.equal(p2g.value.computeTaskId, 'ulg:test:mechanics-worker:p2g');

  const gridUpdate = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage('gridUpdate', ['mls-mpm-grid'], ['mls-mpm-grid']),
    context,
    p2g.value
  ));
  assert.equal(gridUpdate.value.workerResidentStage.stageId, 'gridUpdate');
  assert.equal(gridUpdate.value.computeTaskId, 'ulg:test:mechanics-worker:gridUpdate');
  assert.equal(gridUpdate.value.gpuFence.fenceSatisfied, true);

  const g2p = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage('g2p', ['mls-mpm-grid', 'sph-particle-state', 'mls-mpm-mechanics'], ['sph-particle-state', 'mls-mpm-mechanics']),
    context,
    gridUpdate.value
  ));
  assert.equal(g2p.value.workerResidentStage.stageId, 'g2p');
  assert.equal(g2p.value.computeTaskId, 'ulg:test:mechanics-worker:g2p');
  assert.equal(g2p.value.gpuFence.fenceSatisfied, true);
  assert.ok(g2p.retainedBufferRefs.includes('sph-state-buffer'));
  assert.ok(g2p.retainedBufferRefs.includes('mls-mpm-mechanics-buffer'));
});

test('ULG resident stage worker can run pressure interface force-row stage', async () => {
  const context = {
    schema: 'peercompute.ulg.mechanics-resident-stage-worker-context.v0',
    taskIdPrefix: 'ulg:test:pressure-interface-worker',
    preferWebGpu: false,
    readbackMode: 'full-parity-readback',
    common: {
      boxDimsM: [2, 2, 2],
      gasPressureSummary: {
        schema: 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0',
        status: 'synthetic-pressure',
        totalPressurePa: 120000,
        boxVolumeM3: 8,
        boxDimsM: [2, 2, 2],
        bySpecies: {},
        strictReactionGate: { status: 'strict-reaction-gate-pass', blockers: [] }
      },
      materialInterfaceField: {
        schema: 'peercompute.ulg.sph-material-interface-field.v0',
        status: 'material-interface-field-ready',
        surfaceCount: 1,
        readySurfaceCount: 1,
        totalSurfaceAreaM2: 2,
        elementCount: 2,
        interfaceSourceKeySchema: 'peercompute.ulg.sph-interface-source-key.v0',
        interfaceSourceKeyStatus: 'interface-source-key-retained',
        interfaceSourceKeyBuffer: {
          label: 'worker-pressure-interface-source-key-buffer',
          async mapAsync() {},
          getMappedRange() {
            return new ArrayBuffer(0);
          }
        },
        interfaceSourceKeyBufferRetained: true,
        interfaceSourceKeyRowCount: 2,
        interfaceSourceKeyReadyCount: 2,
        interfaceSourceKeyStrideFloats: 4,
        interfaceSourceKeySurfaceIndexFallbackEnabled: false,
        elements: [
          {
            status: 'interface-element-ready',
            surfaceIndex: 0,
            surfaceKey: 'h2o|liquid',
            material: 'h2o',
            phase: 'liquid',
            materialId: 1,
            phaseId: 2,
            axisId: 0,
            centroidM: [0.5, 1, 1],
            areaM2: 1,
            normalAreaVectorM2: [1, 0, 0]
          },
          {
            status: 'interface-element-ready',
            surfaceIndex: 0,
            surfaceKey: 'h2o|liquid',
            material: 'h2o',
            phase: 'liquid',
            materialId: 1,
            phaseId: 2,
            axisId: 0,
            centroidM: [1.5, 1, 1],
            areaM2: 1,
            normalAreaVectorM2: [-1, 0, 0]
          }
        ]
      }
    }
  };

  const pressure = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage('pressureInterface', ['resident-gas-pressure', 'sph-material-interface-field'], ['pressure-interface-force-rows']),
    context,
    null,
    {
      laneId: 'ulg:test:pressure-interface-worker-lane',
      stateKey: 'ulg:test:pressure-interface-worker-state'
    }
  ));

  assert.equal(pressure.value.workerResidentStage.stageId, 'pressureInterface');
  assert.equal(pressure.value.computeTaskId, 'ulg:test:pressure-interface-worker:pressureInterface');
  assert.equal(pressure.value.pressureInterfaceStageTaskEvidence.passed, true);
  assert.equal(pressure.value.pressureInterfaceStageTaskAuthority.authoritativeStateMutation, false);
  assert.equal(pressure.value.pressureInterfaceStageTaskAuthority.gridForceApplicationApproved, false);
  assert.equal(pressure.value.pressureInterfaceForceSolver.forceRowCount, 2);
  assert.ok(pressure.retainedBufferRefs.includes('pressure-interface-force-rows-buffer'));
  assert.ok(pressure.retainedBufferRefs.includes('sph-interface-source-key-buffer'));
  assert.ok(
    pressure.value.workerResidentStage.workerRetainedBufferRefs
      .some((ref) => ref.includes('interfaceSourceKeyBuffer'))
  );
});

test('ULG resident stage worker can run gas-cell EOS producer stage', async () => {
  const spatialGasSpeciesLedger = {
    schema: 'peercompute.ulg.sph-spatial-gas-species-ledger.v0',
    status: 'spatial-gas-species-ledger-ready',
    spatialGasSourceBufferRetained: true,
    retainedSpatialGasSourceBufferRefs: ['resident-product-mass-buffer'],
    cellDims: [2, 1, 1],
    cellCount: 2,
    cells: [
      {
        index: 0,
        gridIndex: [0, 0, 0],
        centerM: [0.5, 1, 1],
        volumeM3: 4,
        bySpecies: {
          h2: { material: 'h2', massKg: 0.04, moles: 200, temperatureK: 300 }
        }
      },
      {
        index: 1,
        gridIndex: [1, 0, 0],
        centerM: [1.5, 1, 1],
        volumeM3: 4,
        bySpecies: {
          h2: { material: 'h2', massKg: 0.06, moles: 300, temperatureK: 300 }
        }
      }
    ]
  };
  const context = {
    schema: 'peercompute.ulg.mechanics-resident-stage-worker-context.v0',
    taskIdPrefix: 'ulg:test:gas-cell-eos-worker',
    preferWebGpu: false,
    readbackMode: 'full-parity-readback',
    common: {
      boxDimsM: [2, 2, 2],
      gasPressureSummary: {
        schema: 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0',
        status: 'gpu-resident-reaction-pressure-summary',
        source: 'gpu-resident-product-mass-gas-species-ledger',
        totalPressurePa: 180000,
        boxVolumeM3: 8,
        boxDimsM: [2, 2, 2],
        bySpecies: {},
        spatialGasSpeciesLedger
      }
    }
  };

  const eos = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage('gasCellEosProducer', ['resident-spatial-gas-species-ledger', 'resident-product-mass'], ['resident-gas-pressure']),
    context,
    null,
    {
      laneId: 'ulg:test:gas-cell-eos-worker-lane',
      stateKey: 'ulg:test:gas-cell-eos-worker-state'
    }
  ));

  assert.equal(eos.value.workerResidentStage.stageId, 'gasCellEosProducer');
  assert.equal(eos.value.computeTaskId, 'ulg:test:gas-cell-eos-worker:gasCellEosProducer');
  assert.equal(eos.value.gasCellEosProducerStageTaskEvidence.passed, true);
  assert.equal(eos.value.gasCellEosProducerStageTaskAuthority.authoritativeStateMutation, false);
  assert.equal(eos.value.gasCellField.localPressureGradientReady, true);
  assert.equal(eos.value.pressureInterfaceGasPressureCellRowCount, 2);
  assert.equal(eos.value.retainedGasCellFieldSourceReady, false);
});

test('ULG resident worker carries one exact CPU-seeded gas owner into pressure without a host fence', async () => {
  const device = createFakeGpuDevice();
  const wrongDevice = createFakeGpuDevice();
  let hostFenceCalls = 0;
  device.queue.onSubmittedWorkDone = () => {
    hostFenceCalls += 1;
    return new Promise(() => {});
  };
  const spatialGasSpeciesLedger = {
    schema: 'peercompute.ulg.sph-spatial-gas-species-ledger.v0',
    status: 'spatial-gas-species-ledger-ready',
    cellDims: [2, 1, 1],
    cellCount: 2,
    cells: [
      {
        index: 0,
        gridIndex: [0, 0, 0],
        centerM: [0.5, 1, 1],
        volumeM3: 4,
        bySpecies: {
          h2: { material: 'h2', massKg: 0.04, moles: 200, temperatureK: 300 }
        }
      },
      {
        index: 1,
        gridIndex: [1, 0, 0],
        centerM: [1.5, 1, 1],
        volumeM3: 4,
        bySpecies: {
          h2: { material: 'h2', massKg: 0.06, moles: 300, temperatureK: 300 }
        }
      }
    ]
  };
  const materialInterfaceField = {
    schema: 'peercompute.ulg.sph-material-interface-field.v0',
    status: 'material-interface-field-ready',
    surfaceCount: 1,
    readySurfaceCount: 1,
    totalSurfaceAreaM2: 2,
    elementCount: 2,
    elements: [
      {
        status: 'interface-element-ready',
        surfaceIndex: 0,
        surfaceKey: 'h2o|liquid',
        material: 'h2o',
        phase: 'liquid',
        materialId: 1,
        phaseId: 2,
        axisId: 0,
        centroidM: [0.5, 1, 1],
        areaM2: 1,
        normalAreaVectorM2: [1, 0, 0]
      },
      {
        status: 'interface-element-ready',
        surfaceIndex: 0,
        surfaceKey: 'h2o|liquid',
        material: 'h2o',
        phase: 'liquid',
        materialId: 1,
        phaseId: 2,
        axisId: 0,
        centroidM: [1.5, 1, 1],
        areaM2: 1,
        normalAreaVectorM2: [-1, 0, 0]
      }
    ]
  };
  let exactPressureResult = null;
  let exactPressureReceipt = null;
  let gridUpdateAttemptCount = 0;
  let gridObservedExactForceRowsBuffer = null;
  const mechanicsBuffers = manualBuffers({
    position: [0.5, 0.5, 0.5],
    smoothingLengthM: 1,
    mechanicsDtS: 0.05
  });
  const lane = {
    laneId: 'ulg:test:worker-cpu-seeded-gas-lane',
    stateKey: 'ulg:test:worker-cpu-seeded-gas-state'
  };
  const context = {
    schema: 'peercompute.ulg.mechanics-resident-stage-worker-context.v0',
    taskIdPrefix: 'ulg:test:worker-cpu-seeded-gas',
    preferWebGpu: true,
    readbackMode: 'no-full-readback',
    residentStagePlanStageOrder: [
      'gasCellEosProducer',
      'pressureInterface',
      'gridUpdate'
    ],
    common: {
      device,
      ...mechanicsBuffers,
      gridSpacingM: 1,
      dt: 0.05,
      gravityMPerS2: [0, 0, 0],
      cflFactor: 10,
      boxDimsM: [2, 2, 2],
      gasPressureSummary: {
        schema: 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0',
        status: 'gpu-resident-reaction-pressure-summary',
        source: 'gpu-resident-product-mass-gas-species-ledger',
        totalPressurePa: 180000,
        boxVolumeM3: 8,
        boxDimsM: [2, 2, 2],
        bySpecies: {},
        spatialGasSpeciesLedger
      },
      materialInterfaceField
    },
    stageOptions: {
      pressureInterface: {
        async pressureInterfaceForceRowsWebGpuRunner(args) {
          exactPressureResult =
            await runSphPressureInterfaceForceRowsWebGpu(args);
          exactPressureReceipt =
            exactPressureResult.pressureCompletionReceipt;
          const copiedResult = {
            ...exactPressureResult,
            pressureCompletionReceipt: exactPressureReceipt
          };
          assert.equal(
            isExactSphPressureInterfaceCompletionReceipt(
              exactPressureReceipt,
              wrongDevice,
              exactPressureResult
            ),
            false
          );
          assert.equal(
            isExactSphPressureInterfaceCompletionReceipt(
              exactPressureReceipt,
              device,
              copiedResult
            ),
            false
          );
          return exactPressureResult;
        }
      },
      gridUpdate: {
        async webGpuRunner(args) {
          gridUpdateAttemptCount += 1;
          gridObservedExactForceRowsBuffer =
            args.pressureInterfaceForceRowsBuffer;
          assert.equal(
            args.pressureInterfaceForceRowsBuffer,
            exactPressureResult.forceRowsBuffer
          );
          assert.equal(
            args.pressureInterfaceForceSolver.gridForceApplicationApproved,
            true
          );
          assert.equal(
            args.pressureInterfaceGridForceAdmission
              .pressureInterfacePublication.schema,
            'peercompute.ulg.worker-exact-pressure-interface-grid-handoff.v1'
          );
          if (gridUpdateAttemptCount === 1) {
            throw new Error('synthetic gridUpdate failure before queue submit');
          }
          const updatedGridBuffer = tagWebGpuBufferDevice(
            device.createBuffer({
              label: 'worker-exact-pressure-grid-update-out',
              size: Math.max(
                4,
                args.p2gGridProjection.gridNodeCount
                  * 4
                  * Float32Array.BYTES_PER_ELEMENT
              ),
              usage: 128 | 4
            }),
            device
          );
          device.queue.submit([[]]);
          return {
            backend: 'webgpu',
            status: 'updated',
            particleCount: args.p2gGridProjection.particleCount || 1,
            gridSpacingM: args.p2gGridProjection.gridSpacingM,
            gridDims: [...args.p2gGridProjection.gridDims],
            gridNodeCount: args.p2gGridProjection.gridNodeCount,
            gridNodeStrideFloats: 4,
            gridNodeStrideBytes: 4 * Float32Array.BYTES_PER_ELEMENT,
            updatedGridNodes: new Float32Array(0),
            updatedGridBuffer,
            updatedGridBufferByteLength: updatedGridBuffer.size,
            pressureInterfaceForceSolver:
              args.pressureInterfaceForceSolver,
            pressureInterfaceGridForceAdmissionStatus:
              'pressure-interface-grid-force-consumption-approved',
            pressureInterfaceGridForceAdmissionApproved: true,
            pressureInterfaceForceApplicationStatus:
              'pressure-interface-grid-force-consumer-submitted-unverified',
            pressureInterfaceForceConsumerStatus:
              'grid-momentum-impulse-submitted-unverified-no-full-readback',
            pressureInterfaceForceRowCount:
              args.pressureInterfaceForceSolver.forceRowCount,
            pressureInterfaceForceRowsBufferSubmitted: true,
            pressureInterfaceImpulseProofStatus:
              'submitted-retained-pressure-force-row-buffer-to-gpu-grid-update-no-full-readback',
            pressureInterfaceAppliedImpulseMagnitudeNSeconds: 0,
            readbackMode: 'no-full-readback',
            fullReadbackPerformed: false,
            normalHotLoopReadbackFree: true,
            queueCompletionStatus: 'queue-submitted-cleanup-deferred',
            queueCompletionMethod: 'same-worker-webgpu-queue-in-order'
          };
        }
      }
    }
  };
  const settlesWithoutHostFence = async (promise, label) => {
    let timeout;
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error(`${label} awaited the never-resolving host fence`)),
            250
          );
        })
      ]);
    } finally {
      clearTimeout(timeout);
    }
  };

  const p2gContext = {
    ...context,
    preferWebGpu: false,
    readbackMode: 'full-parity-readback',
    stageOptions: {}
  };
  const p2g = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage(
      'p2g',
      ['sph-particle-state', 'mls-mpm-mechanics'],
      ['mls-mpm-grid']
    ),
    p2gContext,
    null,
    lane
  ));
  assert.equal(p2g.value.mechanicsP2gStageTaskEvidence.passed, true);

  const eos = await settlesWithoutHostFence(
    runUlgMechanicsResidentStageWorkerPayload(payload(
      stage(
        'gasCellEosProducer',
        ['resident-spatial-gas-species-ledger', 'resident-product-mass'],
        ['resident-gas-pressure']
      ),
      context,
      null,
      lane
    )),
    'gasCellEosProducer'
  );
  assert.equal(eos.value.backend, 'webgpu');
  assert.equal(eos.value.queueCompletionStatus, 'queue-submitted-same-worker-final-consumer-fence-deferred');
  assert.equal(eos.value.gpuFence.fenceSatisfied, true);
  assert.equal(eos.value.gasCellEosProducerStageTaskEvidence.passed, true);
  assert.equal(eos.value.gasCellEosProducerStageTaskEvidence.gpuPressureAuthorityReady, true);
  assert.equal(eos.value.gasCellEosProducerStageTaskAuthority.gpuFenceSatisfied, true);
  assert.equal(eos.value.cpuSeededGasPressureAuthority, undefined);
  assert.equal(eos.value.gasCellField, undefined);
  assert.equal(eos.value.gasCellFieldSnapshot, undefined);
  assert.equal(eos.value.gasPressureCellRows, undefined);
  assert.equal(eos.value.gasPressureCellsBuffer, undefined);
  assert.deepEqual(eos.value.retainedGasPressureBufferRefs, []);
  assert.doesNotThrow(() => structuredClone(eos.value));

  const pressure = await settlesWithoutHostFence(
    runUlgMechanicsResidentStageWorkerPayload(payload(
      stage(
        'pressureInterface',
        ['resident-gas-pressure', 'sph-material-interface-field'],
        ['pressure-interface-force-rows']
      ),
      context,
      null,
      lane
    )),
    'pressureInterface'
  );
  assert.equal(pressure.value.backend, 'webgpu');
  assert.equal(
    pressure.value.retainedGasPressureRowsStatus,
    'cpu-seeded-gas-pressure-authority-admitted-exact-source'
  );
  assert.equal(
    pressure.value.workerResidentStage.workerQueueFence
      .pressureCompletionReceiptValidated,
    true
  );
  assert.equal(
    pressure.value.workerResidentStage.workerQueueFence.queueCompletionStatus,
    'queue-submitted-same-worker-grid-update-handoff-no-host-wait'
  );
  assert.equal(
    pressure.value.workerResidentStage.workerRetainedGasCellEosReleaseStatus,
    'gas-cell-eos-final-consumer-retired-queue-ordered-after-pressure-submit'
  );
  assert.equal(
    pressure.value.pressureInterfaceStageTaskAuthority.gpuFenceSatisfied,
    true
  );
  assert.equal(
    pressure.value.pressureInterfaceStageTaskAuthority.gpuFenceStatus,
    'gpu-fence-satisfied'
  );
  assert.equal(
    pressure.value.pressureInterfaceStageTaskAuthority
      .gpuFenceDelegationStatus,
    'satisfied-worker-exact-pressure-completion-receipt'
  );
  assert.equal(Object.hasOwn(pressure.value, 'pressureCompletionReceipt'), false);
  assert.equal(Object.hasOwn(pressure.value, 'cpuSeededGasPressureAuthority'), false);
  assert.doesNotThrow(() => structuredClone(pressure.value));
  assert.equal(hostFenceCalls, 0);
  assert.equal(
    device.queue.writeBufferCalls.filter(({ buffer }) => (
      buffer.label === 'ulg-sph-gas-cell-eos-cpu-seeded-pressure-rows'
    )).length,
    1
  );
  assert.equal(
    device.queue.writeBufferCalls.filter(({ buffer }) => (
      buffer.label === 'ulg-sph-pressure-interface-gas-cells-in'
    )).length,
    0
  );
  assert.equal(device.queue.submitCalls.length, 1);
  assert.equal(
    isExactSphPressureInterfaceCompletionReceipt(
      exactPressureReceipt,
      device,
      exactPressureResult
    ),
    false
  );

  await assert.rejects(
    settlesWithoutHostFence(
      runUlgMechanicsResidentStageWorkerPayload(payload(
        stage('gridUpdate', ['mls-mpm-grid'], ['mls-mpm-grid']),
        context,
        p2g.value,
        lane
      )),
      'failed gridUpdate'
    ),
    /synthetic gridUpdate failure before queue submit/
  );
  assert.equal(gridUpdateAttemptCount, 1);
  assert.equal(gridObservedExactForceRowsBuffer, exactPressureResult.forceRowsBuffer);
  assert.equal(exactPressureResult.forceRowsBuffer.destroyed, false);
  assert.equal(exactPressureResult.forceRowsBuffer.destroyCount, 0);
  assert.equal(hostFenceCalls, 0);

  const gridUpdate = await settlesWithoutHostFence(
    runUlgMechanicsResidentStageWorkerPayload(payload(
      stage('gridUpdate', ['mls-mpm-grid'], ['mls-mpm-grid']),
      context,
      p2g.value,
      lane
    )),
    'gridUpdate'
  );
  assert.equal(gridUpdateAttemptCount, 2);
  assert.equal(gridUpdate.value.backend, 'webgpu');
  assert.equal(
    gridUpdate.value.pressureInterfaceGridForceAdmissionApproved,
    true
  );
  assert.equal(
    gridUpdate.value.pressureInterfaceForceRowsBufferSubmitted,
    undefined
  );
  assert.equal(
    gridUpdate.value.gpuResult.pressureInterfaceForceRowsBufferSubmitted,
    true
  );
  assert.equal(
    gridUpdate.value.mechanicsGridUpdateStageTaskEvidence.passed,
    true
  );
  assert.equal(
    gridUpdate.value.mechanicsGridUpdateStageTaskEvidence.pressureInterface
      .retainedBufferSubmittedAndApproved,
    true
  );
  assert.equal(
    gridUpdate.value.workerResidentStage.workerQueueFence
      .pressureInterfaceForceRowsRetiredAfterGridSubmit,
    true
  );
  assert.equal(
    gridUpdate.value.workerResidentStage.workerQueueFence
      .queueCompletionStatus,
    'queue-submitted-worker-retained-grid-no-host-wait'
  );
  assert.equal(exactPressureResult.forceRowsBuffer.destroyed, true);
  assert.equal(exactPressureResult.forceRowsBuffer.destroyCount, 1);
  assert.equal(hostFenceCalls, 0);
  assert.equal(device.queue.submitCalls.length, 2);

  const replayContext = {
    ...context,
    stageOptions: {
      ...context.stageOptions,
      gridUpdate: {
        async webGpuRunner(args) {
          assert.notEqual(
            args.pressureInterfaceGridForceAdmission
              ?.pressureInterfacePublication?.schema,
            'peercompute.ulg.worker-exact-pressure-interface-grid-handoff.v1'
          );
          throw new Error('replayed worker pressure-grid admission rejected');
        }
      }
    }
  };
  const replayedGridUpdate = await settlesWithoutHostFence(
    runUlgMechanicsResidentStageWorkerPayload(payload(
      stage('gridUpdate', ['mls-mpm-grid'], ['mls-mpm-grid']),
      replayContext,
      p2g.value,
      lane
    )),
    'replayed gridUpdate'
  );
  assert.equal(replayedGridUpdate.value.backend, 'cpu-reference');
  assert.equal(
    replayedGridUpdate.value.pressureInterfaceGridForceAdmissionApproved,
    false
  );
  assert.equal(
    replayedGridUpdate.value.mechanicsGridUpdateStageTaskEvidence
      .pressureInterface.retainedBufferSubmittedAndApproved,
    false
  );
  assert.equal(exactPressureResult.forceRowsBuffer.destroyCount, 1);
  assert.equal(hostFenceCalls, 0);

  const rejectedLane = {
    laneId: 'ulg:test:worker-cpu-seeded-gas-rejected-lane',
    stateKey: 'ulg:test:worker-cpu-seeded-gas-rejected-state'
  };
  const rejectedContext = {
    ...context,
    taskIdPrefix: 'ulg:test:worker-cpu-seeded-gas-rejected',
    stageOptions: {
      pressureInterface: {
        async pressureInterfaceForceRowsWebGpuRunner(args) {
          const exactResult =
            await runSphPressureInterfaceForceRowsWebGpu(args);
          return {
            ...exactResult,
            pressureCompletionReceipt: Object.freeze({
              schema: exactResult.pressureCompletionReceipt.schema,
              status: exactResult.pressureCompletionReceipt.status,
              forged: true
            })
          };
        }
      }
    }
  };
  await settlesWithoutHostFence(
    runUlgMechanicsResidentStageWorkerPayload(payload(
      stage(
        'gasCellEosProducer',
        ['resident-spatial-gas-species-ledger', 'resident-product-mass'],
        ['resident-gas-pressure']
      ),
      rejectedContext,
      null,
      rejectedLane
    )),
    'rejected gasCellEosProducer'
  );
  const rejectedPressure = await settlesWithoutHostFence(
    runUlgMechanicsResidentStageWorkerPayload(payload(
      stage(
        'pressureInterface',
        ['resident-gas-pressure', 'sph-material-interface-field'],
        ['pressure-interface-force-rows']
      ),
      rejectedContext,
      null,
      rejectedLane
    )),
    'rejected pressureInterface'
  );
  assert.equal(
    rejectedPressure.value.workerResidentStage.workerQueueFence
      .pressureCompletionReceiptRejected,
    true
  );
  assert.equal(
    rejectedPressure.value.workerResidentStage.workerQueueFence
      .fenceSatisfied,
    false
  );
  assert.equal(
    rejectedPressure.value.workerResidentStage
      .workerRetainedGasCellEosReleaseStatus,
    'gas-cell-eos-final-consumer-retired-queue-ordered-after-pressure-submit'
  );
  assert.equal(
    rejectedPressure.value.pressureInterfaceStageTaskAuthority
      .gpuFenceSatisfied,
    false
  );
  assert.equal(
    rejectedPressure.value.pressureInterfaceStageTaskAuthority.gpuFenceStatus,
    'gpu-fence-unsatisfied'
  );
  assert.equal(
    Object.hasOwn(rejectedPressure.value, 'pressureCompletionReceipt'),
    false
  );
  assert.equal(
    Object.hasOwn(rejectedPressure.value, 'cpuSeededGasPressureAuthority'),
    false
  );
  assert.equal(
    rejectedPressure.retainedBufferRefs.some((ref) => (
      /gas[-_ ]?pressure|gaspressure/i.test(ref)
    )),
    false
  );
  assert.equal(hostFenceCalls, 0);
});

test('ULG resident worker keeps exact v4 gas authority internal and exports non-bindable telemetry', async () => {
  const device = createFakeGpuDevice();
  const productRows = new Float32Array(2 * 32);
  for (let index = 0; index < 2; index += 1) {
    const offset = index * 32;
    productRows[offset] = 0.5 + index;
    productRows[offset + 1] = 1;
    productRows[offset + 2] = 1;
    productRows[offset + 3] = 0.02;
    productRows[offset + 4] = 7;
    productRows[offset + 5] = 0;
    productRows[offset + 7] = index;
    productRows[offset + 8] = -1;
    productRows[offset + 9] = 10;
    productRows[offset + 10] = 1;
    productRows[offset + 11] = 2;
    productRows[offset + 13] = 0.02;
    productRows[offset + 14] = 1;
    productRows[offset + 15] = 0.002;
    productRows[offset + 16] = 300;
    productRows[offset + 18] = 1;
    productRows[offset + 23] = 1;
  }
  const productEventBuffer = fakeStorageBuffer(
    device,
    'worker-v4-spatial-gas-product-events',
    productRows
  );
  const residentProductMass = tagResidentProductMassDevice({
    schema: 'peercompute.ulg.sph-resident-product-mass.v0',
    status: 'resident-product-mass-buffer-retained',
    productEventBuffer,
    productEventBufferRetained: true,
    productEventBufferByteLength: productRows.byteLength,
    productEventRowCount: 2,
    productEventStrideFloats: 32
  }, device);
  const spatialGasEpochIdentity = {
    storageGeneration: 91,
    physicsTick: 90,
    physicsSubstep: 1,
    positionEpoch: 201,
    topologyEpoch: 202,
    chartEpoch: 203,
    levelEpoch: 204,
    supportEpoch: 205
  };
  const schroederSpatialEpochGeneration =
    workerGasOccupancyGenerationFixture(device, {
      particleCount: 2,
      ...spatialGasEpochIdentity
    });
  const materialInterfaceField = {
    schema: 'peercompute.ulg.sph-material-interface-field.v0',
    status: 'material-interface-field-ready',
    surfaceCount: 1,
    readySurfaceCount: 1,
    totalSurfaceAreaM2: 2,
    elementCount: 2,
    elements: [
      {
        status: 'interface-element-ready',
        surfaceIndex: 0,
        surfaceKey: 'h2o|liquid',
        material: 'h2o',
        phase: 'liquid',
        materialId: 1,
        phaseId: 2,
        axisId: 0,
        centroidM: [0.5, 1, 1],
        areaM2: 1,
        normalAreaVectorM2: [1, 0, 0],
        gapM: 0.1,
        normalVelocityMPerS: 0,
        representativeMassKg: 0
      },
      {
        status: 'interface-element-ready',
        surfaceIndex: 0,
        surfaceKey: 'h2o|liquid',
        material: 'h2o',
        phase: 'liquid',
        materialId: 1,
        phaseId: 2,
        axisId: 0,
        centroidM: [1.5, 1, 1],
        areaM2: 1,
        normalAreaVectorM2: [-1, 0, 0],
        gapM: 0.1,
        normalVelocityMPerS: 0,
        representativeMassKg: 0
      }
    ]
  };
  const lane = {
    laneId: 'ulg:test:worker-v4-gas-authority-lane',
    stateKey: 'ulg:test:worker-v4-gas-authority-state'
  };
  const hotBuffers = new Map();
  const warmDeltas = [];
  const stateManager = {
    setHotBuffer(key, value) {
      hotBuffers.set(key, value);
    },
    getHotBuffer(key) {
      return hotBuffers.get(key) || null;
    },
    commitDelta(delta) {
      warmDeltas.push(delta);
      return delta;
    }
  };
  let exactSourceObserved = null;
  let hostBoundaryVerified = false;
  const context = {
    schema: 'peercompute.ulg.mechanics-resident-stage-worker-context.v0',
    taskIdPrefix: 'ulg:test:worker-v4-gas-authority',
    preferWebGpu: true,
    readbackMode: 'no-full-readback',
    includePressureInterfaceStage: true,
    common: {
      device,
      boxDimsM: [2, 2, 2],
      residentProductMass,
      productEventBuffer,
      productEventRowCount: 2,
      productEventStrideFloats: 32,
      spatialGasCellSizeM: 1,
      spatialGasSupportVolumeFallbackM3: 1,
      spatialGasEpochIdentity,
      schroederSpatialEpochGeneration,
      gasPressureSummary: {
        schema: 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0',
        status: 'gpu-resident-reaction-pressure-summary',
        totalPressurePa: 101325,
        boxVolumeM3: 8,
        boxDimsM: [2, 2, 2],
        bySpecies: {},
        strictReactionGate: { status: 'strict-reaction-gate-pass', blockers: [] }
      },
      materialInterfaceField
    },
    stageOptions: {
      pressureInterface: {
        async pressureInterfaceForceRowsWebGpuRunner(args) {
          const source = args.retainedGasPressureCellImport
            ?.retainedGasCellFieldSource;
          assert.equal(isExactSphSpatialGasPressureAuthoritySource(source), true);
          assert.equal(
            args.retainedGasPressureCellImport
              .pressureInterfaceGasCellFieldAdmission
              .retainedGasCellFieldSource,
            source
          );
          assert.equal(args.retainedGasPressureCellsBuffer ?? null, null);
          assert.equal('gasPressureCellsBuffer' in source, false);
          assert.equal('retainedGasPressureCellsBuffer' in source, false);
          assert.equal('pressureInterfaceGasPressureCellsBuffer' in source, false);
          assert.equal('gasAuthorityControlBuffer' in source, false);
          exactSourceObserved = source;
          if (!hostBoundaryVerified) {
            const admissionPublication =
              publishUlgPressureInterfaceGasCellFieldAdmission({
                stateManager,
                cacheKey: lane.laneId,
                stateKey: lane.stateKey,
                source
              });
            assert.equal(
              admissionPublication.retainedGasCellFieldSource,
              source
            );
            assert.equal(
              admissionPublication.pressureInterfaceGasCellFieldAdmission
                .retainedGasCellFieldSource,
              source
            );
            assert.equal(
              admissionPublication.pressureInterfaceGasPressureCellRowCount,
              0
            );
            assert.ok(
              admissionPublication.pressureInterfaceGasPressureCellRowCapacity > 0
            );
            assert.equal(
              admissionPublication.gasPressureCellLogicalCountGpuAuthored,
              true
            );
            const admissionHot = hotBuffers.get(
              admissionPublication.hotBufferKey
            );
            assert.equal(admissionHot.retainedGasCellFieldSource, source);
            assert.equal(
              admissionHot.pressureInterfaceGasCellFieldAdmission
                .retainedGasCellFieldSource,
              source
            );
            const admissionWarm = warmDeltas.at(-1);
            const admissionTelemetry =
              admissionWarm.payload.retainedGasCellFieldSource;
            assert.equal(
              admissionTelemetry.schema,
              ULG_SPH_GAS_PRESSURE_AUTHORITY_TELEMETRY_SCHEMA
            );
            assert.equal(admissionTelemetry.telemetryOnly, true);
            assert.equal(admissionTelemetry.bindable, false);
            assert.equal(
              isExactSphSpatialGasPressureAuthoritySource(admissionTelemetry),
              false
            );
            assert.doesNotThrow(() => structuredClone(admissionWarm.payload));
            assertTransportHasNoGasCapability(admissionWarm.payload);
            assert.throws(
              () => publishUlgPressureInterfaceGasCellFieldAdmission({
                stateManager,
                cacheKey: `${lane.laneId}:telemetry-replay`,
                stateKey: lane.stateKey,
                source: admissionWarm.payload
              }),
              /requires a ready local snapshot, retained same-device source, or worker-local retained source/
            );
            assert.throws(
              () => publishUlgPressureInterfaceGasCellFieldImportSource({
                stateManager,
                cacheKey: `${lane.laneId}:forged-buffer`,
                stateKey: lane.stateKey,
                source: {
                  retainedGasCellFieldSource: source,
                  gasPressureCellsBuffer: { label: 'forged-gas-pressure-buffer' }
                },
                pressureInterfaceGasCellFieldAdmission:
                  admissionPublication.pressureInterfaceGasCellFieldAdmission
              }),
              /rejects raw gasPressureCellsBuffer/
            );
            assert.throws(
              () => publishUlgPressureInterfaceGasCellFieldImportSource({
                stateManager,
                cacheKey: `${lane.laneId}:legacy-mask`,
                stateKey: lane.stateKey,
                source: {
                  schema: 'peercompute.ulg.sph-retained-gas-cell-eos-source.v1',
                  status: 'retained-gas-cell-eos-source-submitted',
                  ready: true,
                  retainedGasCellFieldSource: source,
                  admission: {
                    retainedGasCellFieldSource: source,
                    gasPressureCellsBuffer: {
                      label: 'legacy-wrapper-forged-gas-pressure-buffer'
                    }
                  }
                },
                pressureInterfaceGasCellFieldAdmission:
                  admissionPublication.pressureInterfaceGasCellFieldAdmission
              }),
              /rejects raw gasPressureCellsBuffer/
            );
            let browserWrapperGetterCount = 0;
            const accessorWrapper = {};
            Object.defineProperty(accessorWrapper, 'retainedGasCellFieldSource', {
              enumerable: true,
              get() {
                browserWrapperGetterCount += 1;
                return source;
              }
            });
            assert.throws(
              () => publishUlgPressureInterfaceGasCellFieldImportSource({
                stateManager,
                cacheKey: `${lane.laneId}:accessor-wrapper`,
                stateKey: lane.stateKey,
                source: accessorWrapper,
                pressureInterfaceGasCellFieldAdmission:
                  admissionPublication.pressureInterfaceGasCellFieldAdmission
              }),
              /must be an own data property/
            );
            assert.equal(browserWrapperGetterCount, 0);

            const exactV1Wrapper = {
              schema: 'peercompute.ulg.sph-retained-gas-cell-eos-source.v1',
              status: 'retained-gas-cell-eos-source-submitted',
              ready: true,
              retainedGasCellFieldSource: source
            };
            const wrappedAdmissionPublication =
              publishUlgPressureInterfaceGasCellFieldAdmission({
                stateManager,
                cacheKey: `${lane.laneId}:exact-v1-wrapper`,
                stateKey: lane.stateKey,
                source: exactV1Wrapper
              });
            assert.equal(
              wrappedAdmissionPublication.retainedGasCellFieldSource,
              source
            );
            assert.equal(
              wrappedAdmissionPublication.pressureInterfaceGasPressureCellRowCount,
              0
            );
            assert.ok(
              wrappedAdmissionPublication
                .pressureInterfaceGasPressureCellRowCapacity > 0
            );
            const wrappedImportPublication =
              publishUlgPressureInterfaceGasCellFieldImportSource({
                stateManager,
                cacheKey: `${lane.laneId}:exact-v1-wrapper`,
                stateKey: lane.stateKey,
                source: exactV1Wrapper,
                pressureInterfaceGasCellFieldAdmission:
                  wrappedAdmissionPublication
                    .pressureInterfaceGasCellFieldAdmission
              });
            assert.equal(
              wrappedImportPublication.retainedGasCellFieldSource,
              source
            );
            assert.equal(
              wrappedImportPublication.pressureInterfaceGasPressureCellRowCount,
              0
            );
            assert.ok(
              wrappedImportPublication
                .pressureInterfaceGasPressureCellRowCapacity > 0
            );

            for (const [schema, message] of [
              [
                ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA,
                /forged current schema/
              ],
              [
                'peercompute.ulg.sph-retained-gas-cell-eos-source.v2',
                /retired v2\/v3 wrappers/
              ],
              [
                'peercompute.ulg.sph-retained-gas-cell-eos-source.v3',
                /retired v2\/v3 wrappers/
              ]
            ]) {
              assert.throws(
                () => publishUlgPressureInterfaceGasCellFieldAdmission({
                  stateManager,
                  cacheKey: `${lane.laneId}:protected-wrapper:${schema}`,
                  stateKey: lane.stateKey,
                  source: {
                    schema,
                    retainedGasCellFieldSource: source
                  }
                }),
                message
              );
            }

            assert.throws(
              () => publishUlgPressureInterfaceGasCellFieldImportSource({
                stateManager,
                cacheKey: `${lane.laneId}:null-raw-alias`,
                stateKey: lane.stateKey,
                source: {
                  schema: 'peercompute.ulg.sph-retained-gas-cell-eos-source.v1',
                  retainedGasCellFieldSource: source,
                  gasPressureCellsBuffer: null
                },
                pressureInterfaceGasCellFieldAdmission:
                  admissionPublication.pressureInterfaceGasCellFieldAdmission
              }),
              /rejects raw gasPressureCellsBuffer/
            );
            let browserControlGetterCount = 0;
            const accessorControlAliasWrapper = {
              schema: 'peercompute.ulg.sph-retained-gas-cell-eos-source.v1',
              retainedGasCellFieldSource: source
            };
            Object.defineProperty(
              accessorControlAliasWrapper,
              'gasAuthorityControlBuffer',
              {
                enumerable: true,
                get() {
                  browserControlGetterCount += 1;
                  return null;
                }
              }
            );
            assert.throws(
              () => publishUlgPressureInterfaceGasCellFieldImportSource({
                stateManager,
                cacheKey: `${lane.laneId}:accessor-control-alias`,
                stateKey: lane.stateKey,
                source: accessorControlAliasWrapper,
                pressureInterfaceGasCellFieldAdmission:
                  admissionPublication.pressureInterfaceGasCellFieldAdmission
              }),
              /must be an own data property/
            );
            assert.equal(browserControlGetterCount, 0);

            let browserSchemaGetterCount = 0;
            const accessorSchemaWrapper = {
              retainedGasCellFieldSource: source
            };
            Object.defineProperty(accessorSchemaWrapper, 'schema', {
              enumerable: true,
              get() {
                browserSchemaGetterCount += 1;
                return ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA;
              }
            });
            assert.throws(
              () => publishUlgPressureInterfaceGasCellFieldAdmission({
                stateManager,
                cacheKey: `${lane.laneId}:accessor-schema`,
                stateKey: lane.stateKey,
                source: accessorSchemaWrapper
              }),
              /must be an own data property/
            );
            assert.equal(browserSchemaGetterCount, 0);
            assert.throws(
              () => publishUlgPressureInterfaceGasCellFieldImportSource({
                stateManager,
                cacheKey: `${lane.laneId}:mismatched-admission`,
                stateKey: lane.stateKey,
                source,
                pressureInterfaceGasCellFieldAdmission: {
                  ...admissionPublication.pressureInterfaceGasCellFieldAdmission,
                  retainedGasCellFieldSource: admissionTelemetry
                }
              }),
              /requires admission for the same producer-issued source identity/
            );

            const importPublication =
              publishUlgPressureInterfaceGasCellFieldImportSource({
                stateManager,
                cacheKey: lane.laneId,
                stateKey: lane.stateKey,
                source,
                pressureInterfaceGasCellFieldAdmission:
                  admissionPublication.pressureInterfaceGasCellFieldAdmission
              });
            assert.equal(importPublication.retainedGasCellFieldSource, source);
            assert.equal(
              importPublication.pressureInterfaceGasCellFieldImport
                .retainedGasCellFieldSource,
              source
            );
            assert.equal('gasPressureCellsBuffer' in importPublication, false);
            assert.equal('retainedGasPressureCellsBuffer' in importPublication, false);
            assert.equal('gasAuthorityControlBuffer' in importPublication, false);
            assert.equal(
              importPublication.pressureInterfaceGasPressureCellRowCount,
              0
            );
            assert.ok(
              importPublication.pressureInterfaceGasPressureCellRowCapacity > 0
            );
            assert.equal(
              importPublication.gasPressureCellLogicalCountGpuAuthored,
              true
            );
            const importHot = hotBuffers.get(importPublication.hotBufferKey);
            assert.equal(importHot.retainedGasCellFieldSource, source);
            assert.equal(
              importHot.pressureInterfaceGasCellFieldImport
                .retainedGasCellFieldSource,
              source
            );
            assert.equal('gasPressureCellsBuffer' in importHot, false);
            assert.equal('retainedGasPressureCellsBuffer' in importHot, false);
            assert.equal('gasAuthorityControlBuffer' in importHot, false);
            const importWarm = warmDeltas.at(-1);
            const importTelemetry =
              importWarm.payload.retainedGasCellFieldSource;
            assert.equal(
              importTelemetry.schema,
              ULG_SPH_GAS_PRESSURE_AUTHORITY_TELEMETRY_SCHEMA
            );
            assert.equal(importTelemetry.telemetryOnly, true);
            assert.equal(importTelemetry.bindable, false);
            assert.equal(
              isExactSphSpatialGasPressureAuthoritySource(importTelemetry),
              false
            );
            assert.equal('gasPressureCellsBuffer' in importWarm.payload, false);
            assert.equal(
              'gasPressureCellsBuffer'
                in importWarm.payload.pressureInterfaceGasCellFieldImport,
              false
            );
            assert.equal(
              'releaseAfterFinalConsumerQueue'
                in importWarm.payload.pressureInterfaceGasCellFieldImport,
              false
            );
            assert.doesNotThrow(() => structuredClone(importWarm.payload));
            assertTransportHasNoGasCapability(importWarm.payload);

            const secondEpochIdentity = Object.fromEntries(
              Object.entries(spatialGasEpochIdentity).map(([key, value]) => (
                [key, value + 100]
              ))
            );
            const secondSpatialGeneration =
              workerGasOccupancyGenerationFixture(device, {
                particleCount: 2,
                ...secondEpochIdentity
              });
            const secondMechanicsField = secondSpatialGeneration
              .mechanicsLevelViews.at(-1).mechanicsFieldView;
            const secondExecution = await sphSpatialGasLedgerEosGpu
              .runSphSpatialGasLedgerEosRetainedWebGpu({
                device,
                residentProductMass,
                epochIdentity: secondEpochIdentity,
                schroederSpatialEpochGeneration: secondSpatialGeneration,
                spatialGasGrid: {
                  selectedLevel: secondMechanicsField.selectedLevel,
                  gridDims: [...secondMechanicsField.gridDims],
                  gridNodeCount: secondMechanicsField.gridNodeCount,
                  gridShift: secondMechanicsField.gridShift,
                  gridSpacingM: secondMechanicsField.gridSpacingM
                },
                boxMinM: [0, 0, 0],
                boxMaxM: [2, 2, 2],
                spatialGasCellSizeM: 1,
                spatialGasSupportVolumeFallbackM3: 0,
                level: 0,
                laneId: `${lane.laneId}:second-exact-authority`
              });
            assert.equal(secondExecution.ready, true, secondExecution.reason);
            const secondExactSource =
              secondExecution.retainedGasCellFieldSource;
            assert.equal(
              isExactSphSpatialGasPressureAuthoritySource(secondExactSource),
              true
            );

            const runAvailableExactWorkerImport = async (
              suffix,
              pressureImport,
              workerDevice = device
            ) => runUlgMechanicsResidentStageWorkerPayload(payload(
              stage(
                'pressureInterface',
                ['resident-gas-pressure', 'sph-material-interface-field'],
                ['pressure-interface-force-rows']
              ),
              {
                schema: 'peercompute.ulg.mechanics-resident-stage-worker-context.v0',
                taskIdPrefix: `ulg:test:worker-v4-available-hostile-${suffix}`,
                preferWebGpu: false,
                readbackMode: 'full-parity-readback',
                common: {
                  device: workerDevice,
                  boxDimsM: [2, 2, 2],
                  gasPressureSummary: context.common.gasPressureSummary,
                  materialInterfaceField,
                  pressureInterfaceGasCellFieldImport: pressureImport
                }
              },
              null,
              {
                laneId: `ulg:test:worker-v4-available-hostile-${suffix}-lane`,
                stateKey: `ulg:test:worker-v4-available-hostile-${suffix}-state`
              }
            ));
            const assertRejectedWithoutPreflightPressureRef = (
              result,
              expectedStatus
            ) => {
              assert.equal(
                result.value.workerResidentStage
                  .workerRetainedGasCellFieldImportInputStatus,
                expectedStatus
              );
              assert.equal(
                result.value.workerResidentStage
                  .workerRetainedGasCellFieldImportApplied,
                false
              );
              assert.equal(
                (result.value.gpuResidentLaneRequirement?.retainedBufferRefs
                  || []).includes('resident-gas-pressure-cells-buffer'),
                false
              );
            };
            const primaryApprovedAdmission =
              admissionPublication.pressureInterfaceGasCellFieldAdmission;
            const secondaryApprovedAdmission = {
              ...primaryApprovedAdmission,
              retainedGasCellFieldSource: secondExactSource
            };
            const multipleExactRejected =
              await runAvailableExactWorkerImport(
                'multiple-exact-identities',
                {
                  schema: 'peercompute.ulg.sph-retained-gas-cell-eos-source.v1',
                  retainedGasCellFieldSource: source,
                  pressureInterfaceGasCellFieldAdmission:
                    primaryApprovedAdmission,
                  admission: secondaryApprovedAdmission
                }
              );
            assertRejectedWithoutPreflightPressureRef(
              multipleExactRejected,
              'blocked-ambiguous-exact-v4-gas-pressure-authority'
            );

            const mismatchedAdmissionRejected =
              await runAvailableExactWorkerImport(
                'mismatched-approved-admission',
                {
                  schema: 'peercompute.ulg.sph-retained-gas-cell-eos-source.v1',
                  retainedGasCellFieldSource: source,
                  pressureInterfaceGasCellFieldAdmission: {
                    ...primaryApprovedAdmission,
                    retainedGasCellFieldSource: admissionTelemetry
                  }
                }
              );
            assertRejectedWithoutPreflightPressureRef(
              mismatchedAdmissionRejected,
              'blocked-exact-v4-gas-pressure-authority-admission-identity-mismatch'
            );

            const ambiguousAdmissionRejected =
              await runAvailableExactWorkerImport(
                'ambiguous-approved-admissions',
                {
                  schema: 'peercompute.ulg.sph-retained-gas-cell-eos-source.v1',
                  retainedGasCellFieldSource: source,
                  pressureInterfaceGasCellFieldAdmission:
                    primaryApprovedAdmission,
                  admission: {
                    ...primaryApprovedAdmission,
                    retainedGasCellFieldSource: source
                  }
                }
              );
            assertRejectedWithoutPreflightPressureRef(
              ambiguousAdmissionRejected,
              'blocked-exact-v4-gas-pressure-authority-admission-ambiguous'
            );

            const forgedCapacityRejected =
              await runAvailableExactWorkerImport(
                'forged-public-capacity',
                {
                  schema: 'peercompute.ulg.sph-retained-gas-cell-eos-source.v1',
                  retainedGasCellFieldSource: source,
                  pressureInterfaceGasPressureCellRowCapacity: 0x7fff_ffff,
                  pressureInterfaceGasPressureCellRowStrideFloats: 1
                }
              );
            assertRejectedWithoutPreflightPressureRef(
              forgedCapacityRejected,
              'blocked-exact-v4-gas-pressure-authority-admission-missing'
            );

            const wrongDevice = createFakeGpuDevice();
            const wrongDeviceRejected =
              await runAvailableExactWorkerImport(
                'wrong-device-forged-capacity',
                {
                  schema: 'peercompute.ulg.sph-retained-gas-cell-eos-source.v1',
                  retainedGasCellFieldSource: source,
                  pressureInterfaceGasCellFieldAdmission:
                    primaryApprovedAdmission,
                  pressureInterfaceGasPressureCellRowCapacity: 0x7fff_ffff,
                  pressureInterfaceGasPressureCellRowStrideFloats: 1
                },
                wrongDevice
              );
            assertRejectedWithoutPreflightPressureRef(
              wrongDeviceRejected,
              'blocked-exact-v4-gas-pressure-authority-device-mismatch'
            );
            assert.equal(
              sphSpatialGasLedgerEosGpu
                .releaseSphSpatialGasLedgerEosAfterQueue(secondExecution),
              true
            );
            assert.equal(await secondExecution.releasePromise, true);
            assert.equal(
              releaseSchroederSpatialEpochGenerationAfterQueue(
                secondSpatialGeneration,
                device
              ),
              true
            );
            assert.equal(
              await secondSpatialGeneration.releasePromise,
              true
            );
            hostBoundaryVerified = true;
          }
          const result = await runSphPressureInterfaceForceRowsWebGpu(args);
          assert.equal(source.gasPressureAuthorityConsumerSubmitted, true);
          assert.throws(
            () => publishUlgPressureInterfaceGasCellFieldAdmission({
              stateManager,
              cacheKey: `${lane.laneId}:submitted-replay`,
              stateKey: lane.stateKey,
              source
            }),
            /rejects unavailable exact v4 authority lifecycle/
          );
          return result;
        }
      }
    }
  };

  const spatial = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage(
      'spatialGasLedgerProducer',
      ['resident-product-mass'],
      ['resident-spatial-gas-species-ledger']
    ),
    context,
    null,
    lane
  ));
  const {
    schroederSpatialEpochGeneration: _occupancyGeneration,
    ...consumerCommon
  } = context.common;
  const consumerContext = {
    ...context,
    common: consumerCommon
  };
  assert.equal(spatial.value.retainedGasCellFieldSourceReady, true);
  assert.equal(
    spatial.value.retainedGasCellFieldSource.schema,
    ULG_SPH_GAS_PRESSURE_AUTHORITY_TELEMETRY_SCHEMA
  );
  assert.equal(spatial.value.retainedSpatialGasLedgerSource ?? null, null);
  assert.equal(spatial.value.spatialGasLedgerEosExecution ?? null, null);

  const eos = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage(
      'gasCellEosProducer',
      ['resident-spatial-gas-species-ledger', 'resident-product-mass'],
      ['resident-gas-pressure']
    ),
    consumerContext,
    null,
    lane
  ));
  const telemetry = eos.value.retainedGasCellFieldSource;
  assert.equal(telemetry.schema, ULG_SPH_GAS_PRESSURE_AUTHORITY_TELEMETRY_SCHEMA);
  assert.equal(telemetry.telemetryOnly, true);
  assert.equal(telemetry.bindable, false);
  assert.equal(isExactSphSpatialGasPressureAuthoritySource(telemetry), false);
  assert.equal(eos.value.gasPressureCellsBuffer, undefined);
  assert.equal(eos.value.retainedGasPressureCellsBuffer, undefined);
  assert.equal(eos.value.gasAuthorityControlBuffer, undefined);
  assert.deepEqual(eos.value.workerRetainedGasPressureBufferRefs || [], []);
  assert.equal(
    eos.retainedBufferRefs.some((ref) => /gas[-_ ]?pressure/i.test(ref)),
    false
  );
  assert.equal(
    'bindSphSpatialGasPressureAuthority' in sphSpatialGasLedgerEosGpu,
    false
  );
  const seen = new WeakSet();
  const forbiddenTransportKeys = new Set([
    'gasPressureCellsBuffer',
    'retainedGasPressureCellsBuffer',
    'pressureInterfaceGasPressureCellsBuffer',
    'gasAuthorityControlBuffer',
    'retainedGasAuthorityControlBuffer',
    'pressureInterfaceGasAuthorityControlBuffer',
    'releaseAfterFinalConsumerQueue',
    'deferredCleanupReadbackTelemetrySnapshot'
  ]);
  const assertTransportHasNoGasCapability = (value) => {
    if (value == null || typeof value !== 'object') {
      assert.notEqual(typeof value, 'function');
      return;
    }
    if (seen.has(value)) return;
    seen.add(value);
    assert.equal(value instanceof FakeGpuBuffer, false);
    assert.equal(isExactSphSpatialGasPressureAuthoritySource(value), false);
    if (value.schema === 'peercompute.ulg.worker-retained-buffer-ref.v0') {
      assert.equal(/gas[-_ ]?pressure|gaspressure/i.test(`${value.ref} ${value.path}`), false);
    }
    for (const [key, nested] of Object.entries(value)) {
      assert.equal(
        forbiddenTransportKeys.has(key),
        false,
        `worker transport leaked forbidden gas authority key ${key}`
      );
      assertTransportHasNoGasCapability(nested);
    }
  };
  assertTransportHasNoGasCapability(eos.value);
  assert.doesNotThrow(() => structuredClone(eos.value));

  const pressure = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage(
      'pressureInterface',
      ['resident-gas-pressure', 'sph-material-interface-field'],
      ['pressure-interface-force-rows']
    ),
    consumerContext,
    null,
    lane
  ));
  assert.ok(exactSourceObserved);
  assert.equal(
    hostBoundaryVerified,
    true,
    JSON.stringify({
      status: pressure.value.status,
      webgpuStatus: pressure.value.webgpuStatus,
      retainedGasPressureRowsStatus: pressure.value.retainedGasPressureRowsStatus
    })
  );
  assert.equal(pressure.value.pressureInterfaceForceSolver.pressureModelId, 2);
  assert.equal(pressure.value.pressureInterfaceGasPressureCellRowCount, 0);
  assert.ok(pressure.value.pressureInterfaceGasPressureCellRowCapacity > 0);
  assert.equal(
    pressure.value.pressureInterfaceGasPressureCellLogicalCountGpuAuthored,
    true
  );
  assert.equal(
    pressure.value
      .pressureInterfaceGasCellFieldImportRetainedLocalPressureGradientReady,
    false
  );
  assert.equal(
    pressure.value.pressureInterfaceGasPressureAuthorityReady,
    true
  );
  assert.equal(
    pressure.value.gpuResidentLaneRequirement.retainedBufferRefs
      .includes('resident-gas-pressure-cells-buffer'),
    false
  );
  assert.equal(pressure.value.gasPressureAuthorityConsumerSubmitted, true);
  assert.equal(
    pressure.value.retainedGasPressureRowsStatus,
    'retained-gas-pressure-authority-v4-admitted-exact-source'
  );
  assert.equal(
    pressure.value.workerResidentStage.workerRetainedGasCellEosReleaseStatus,
    'gas-cell-eos-final-consumer-retired-queue-ordered-after-pressure-submit'
  );
  assert.equal(
    pressure.value.workerResidentStage.workerQueueFence.queueCompletionMethod,
    'worker-device.queue.onSubmittedWorkDone'
  );
  assert.notEqual(
    pressure.value.workerResidentStage.workerQueueFence
      .finalConsumerReleaseFenceUsed,
    true
  );
  assertTransportHasNoGasCapability(pressure.value);
  assert.doesNotThrow(() => structuredClone(pressure.value));

  const runHostileExactWorkerImport = async (suffix, pressureImport) => (
    runUlgMechanicsResidentStageWorkerPayload(payload(
      stage(
        'pressureInterface',
        ['resident-gas-pressure', 'sph-material-interface-field'],
        ['pressure-interface-force-rows']
      ),
      {
        schema: 'peercompute.ulg.mechanics-resident-stage-worker-context.v0',
        taskIdPrefix: `ulg:test:worker-v4-hostile-${suffix}`,
        preferWebGpu: false,
        readbackMode: 'full-parity-readback',
        common: {
          device,
          boxDimsM: [2, 2, 2],
          gasPressureSummary: context.common.gasPressureSummary,
          materialInterfaceField,
          pressureInterfaceGasCellFieldImport: pressureImport
        }
      },
      null,
      {
        laneId: `ulg:test:worker-v4-hostile-${suffix}-lane`,
        stateKey: `ulg:test:worker-v4-hostile-${suffix}-state`
      }
    ))
  );
  const exactAdmission = {
    schema: 'peercompute.ulg.pressure-interface-gas-cell-field-admission.v0',
    status: 'pressure-interface-gas-cell-field-consumption-approved',
    gasCellFieldConsumptionApproved: true,
    retainedGasCellFieldSource: exactSourceObserved
  };
  let workerRawAliasGetterCount = 0;
  const accessorRawAliasImport = {
    schema: 'peercompute.ulg.pressure-interface-gas-cell-field-import.v0',
    status: 'pressure-interface-gas-cell-field-import-ready',
    retainedGasCellFieldSource: exactSourceObserved,
    pressureInterfaceGasCellFieldAdmission: exactAdmission
  };
  Object.defineProperty(accessorRawAliasImport, 'gasPressureCellsBuffer', {
    enumerable: true,
    get() {
      workerRawAliasGetterCount += 1;
      return { label: 'worker-accessor-forged-gas-pressure-buffer' };
    }
  });
  const accessorRejected = await runHostileExactWorkerImport(
    'accessor-raw-alias',
    accessorRawAliasImport
  );
  assert.equal(
    accessorRejected.value.workerResidentStage
      .workerRetainedGasCellFieldImportInputStatus,
    'blocked-exact-v4-gas-pressure-authority-raw-alias-accessor'
  );
  assert.equal(
    accessorRejected.value.workerResidentStage
      .workerRetainedGasCellFieldImportApplied,
    false
  );
  assert.equal(workerRawAliasGetterCount, 0);

  let workerWrapperGetterCount = 0;
  const accessorWrapperImport = {
    schema: 'peercompute.ulg.pressure-interface-gas-cell-field-import.v0',
    status: 'pressure-interface-gas-cell-field-import-ready'
  };
  Object.defineProperty(accessorWrapperImport, 'retainedGasCellFieldSource', {
    enumerable: true,
    get() {
      workerWrapperGetterCount += 1;
      return exactSourceObserved;
    }
  });
  const accessorWrapperRejected = await runHostileExactWorkerImport(
    'accessor-wrapper',
    accessorWrapperImport
  );
  assert.equal(
    accessorWrapperRejected.value.workerResidentStage
      .workerRetainedGasCellFieldImportInputStatus,
    'blocked-gas-pressure-authority-wrapper-accessor'
  );
  assert.equal(workerWrapperGetterCount, 0);

  const nestedAliasRejected = await runHostileExactWorkerImport(
    'nested-legacy-mask',
    {
      schema: 'peercompute.ulg.sph-retained-gas-cell-eos-source.v1',
      status: 'retained-gas-cell-eos-source-submitted',
      ready: true,
      admission: {
        retainedGasCellFieldSource: exactSourceObserved,
        gasPressureCellsBuffer: {
          label: 'worker-nested-forged-gas-pressure-buffer'
        }
      }
    }
  );
  assert.equal(
    nestedAliasRejected.value.workerResidentStage
      .workerRetainedGasCellFieldImportInputStatus,
    'blocked-exact-v4-gas-pressure-authority-raw-alias'
  );
  assert.equal(
    nestedAliasRejected.value.workerResidentStage
      .workerRetainedGasCellFieldImportApplied,
    false
  );

  const nullAliasRejected = await runHostileExactWorkerImport(
    'null-raw-alias',
    {
      schema: 'peercompute.ulg.sph-retained-gas-cell-eos-source.v1',
      status: 'retained-gas-cell-eos-source-submitted',
      ready: true,
      retainedGasCellFieldSource: exactSourceObserved,
      gasAuthorityControlBuffer: null
    }
  );
  assert.equal(
    nullAliasRejected.value.workerResidentStage
      .workerRetainedGasCellFieldImportInputStatus,
    'blocked-exact-v4-gas-pressure-authority-raw-alias'
  );
  assert.equal(
    nullAliasRejected.value.workerResidentStage
      .workerRetainedGasCellFieldImportApplied,
    false
  );

  const legacyRawSource = {
    schema: 'peercompute.ulg.sph-retained-gas-cell-eos-source.v1',
    status: 'retained-gas-cell-eos-source-submitted',
    ready: true,
    localPressureGradientReady: true,
    gasPressureCellsBuffer: {
      label: 'worker-protected-schema-legacy-pressure-buffer'
    },
    pressureInterfaceGasPressureCellRowCount: 1,
    pressureInterfaceGasPressureCellRowStrideFloats: 12
  };
  for (const [suffix, schema, expectedStatus] of [
    [
      'forged-current-v4',
      ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA,
      'blocked-forged-exact-v4-gas-pressure-authority-schema'
    ],
    [
      'retired-v2',
      'peercompute.ulg.sph-retained-gas-cell-eos-source.v2',
      'blocked-retired-gas-pressure-authority-schema'
    ],
    [
      'retired-v3',
      'peercompute.ulg.sph-retained-gas-cell-eos-source.v3',
      'blocked-retired-gas-pressure-authority-schema'
    ]
  ]) {
    const protectedSchemaRejected = await runHostileExactWorkerImport(
      suffix,
      {
        schema,
        retainedGasCellFieldSource: legacyRawSource
      }
    );
    assert.equal(
      protectedSchemaRejected.value.workerResidentStage
        .workerRetainedGasCellFieldImportInputStatus,
      expectedStatus
    );
    assert.equal(
      protectedSchemaRejected.value.workerResidentStage
        .workerRetainedGasCellFieldImportApplied,
      false
    );
  }

  const exactV1MaskRejectedAsUnavailable =
    await runHostileExactWorkerImport(
      'exact-v1-schema-mask',
      {
        schema: 'peercompute.ulg.sph-retained-gas-cell-eos-source.v1',
        retainedGasCellFieldSource: exactSourceObserved
      }
    );
  assert.equal(
    exactV1MaskRejectedAsUnavailable.value.workerResidentStage
      .workerRetainedGasCellFieldImportInputStatus,
    'blocked-exact-v4-gas-pressure-authority-unavailable'
  );

  let workerBorrowedGetterCount = 0;
  const borrowedGetterWrapper = {
    schema: 'peercompute.ulg.sph-retained-gas-cell-eos-source.v1',
    retainedGasCellFieldSource: exactSourceObserved
  };
  Object.defineProperty(
    borrowedGetterWrapper,
    'gasPressureAuthorityConsumerBorrowed',
    {
      enumerable: true,
      get() {
        workerBorrowedGetterCount += 1;
        return false;
      }
    }
  );
  const borrowedGetterRejectedAsUnavailable =
    await runHostileExactWorkerImport(
      'public-borrowed-getter',
      borrowedGetterWrapper
    );
  assert.equal(
    borrowedGetterRejectedAsUnavailable.value.workerResidentStage
      .workerRetainedGasCellFieldImportInputStatus,
    'blocked-exact-v4-gas-pressure-authority-unavailable'
  );
  assert.equal(workerBorrowedGetterCount, 0);

  let workerSchemaGetterCount = 0;
  const schemaGetterWrapper = {
    retainedGasCellFieldSource: exactSourceObserved
  };
  Object.defineProperty(schemaGetterWrapper, 'schema', {
    enumerable: true,
    get() {
      workerSchemaGetterCount += 1;
      return ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA;
    }
  });
  const schemaGetterRejected = await runHostileExactWorkerImport(
    'schema-getter',
    schemaGetterWrapper
  );
  assert.equal(
    schemaGetterRejected.value.workerResidentStage
      .workerRetainedGasCellFieldImportInputStatus,
    'blocked-gas-pressure-authority-schema-accessor'
  );
  assert.equal(workerSchemaGetterCount, 0);

  const descriptorTrapCounts = new Map();
  const descriptorGetCounts = new Map();
  const descriptorTrapAdmission = {
    schema: 'peercompute.ulg.pressure-interface-gas-cell-field-admission.v0',
    status: 'pressure-interface-gas-cell-field-consumption-approved',
    gasCellFieldConsumptionApproved: true,
    retainedGasCellFieldSource: exactSourceObserved
  };
  const descriptorTrapTarget = {
    schema: 'peercompute.ulg.sph-retained-gas-cell-eos-source.v1',
    retainedGasCellFieldSource: exactSourceObserved,
    pressureInterfaceGasCellFieldAdmission: descriptorTrapAdmission,
    pressureInterfaceGasPressureCellRowCapacity:
      exactSourceObserved.pressureInterfaceGasPressureCellRowCapacity,
    pressureInterfaceGasPressureCellRowStrideFloats: 12
  };
  const descriptorTrapImport = new Proxy(descriptorTrapTarget, {
    getOwnPropertyDescriptor(target, key) {
      const count = (descriptorTrapCounts.get(key) || 0) + 1;
      descriptorTrapCounts.set(key, count);
      const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
      if (!descriptor || count === 1) return descriptor;
      if (key === 'schema') {
        return { ...descriptor, value: ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA };
      }
      if (key === 'retainedGasCellFieldSource') {
        return { ...descriptor, value: legacyRawSource };
      }
      if (key === 'pressureInterfaceGasCellFieldAdmission') {
        return {
          ...descriptor,
          value: {
            ...descriptorTrapAdmission,
            gasCellFieldConsumptionApproved: false,
            retainedGasCellFieldSource: legacyRawSource
          }
        };
      }
      if (key === 'pressureInterfaceGasPressureCellRowCapacity') {
        return { ...descriptor, value: 0 };
      }
      return descriptor;
    },
    get(target, key, receiver) {
      descriptorGetCounts.set(key, (descriptorGetCounts.get(key) || 0) + 1);
      return Reflect.get(target, key, receiver);
    }
  });
  const descriptorTrapRejectedAsUnavailable =
    await runHostileExactWorkerImport(
      'descriptor-snapshot-toctou',
      descriptorTrapImport
    );
  assert.equal(
    descriptorTrapRejectedAsUnavailable.value.workerResidentStage
      .workerRetainedGasCellFieldImportInputStatus,
    'blocked-exact-v4-gas-pressure-authority-unavailable'
  );
  for (const key of [
    'schema',
    'retainedGasCellFieldSource',
    'pressureInterfaceGasCellFieldAdmission',
    'pressureInterfaceGasPressureCellRowCapacity',
    'pressureInterfaceGasPressureCellRowStrideFloats'
  ]) {
    assert.equal(
      descriptorTrapCounts.get(key),
      1,
      `worker graph must capture ${key} exactly once across preflight/apply`
    );
    assert.equal(
      descriptorGetCounts.get(key) || 0,
      0,
      `worker graph must not invoke hostile ${key} reads`
    );
  }

  const inheritedCurrentSchemaRejected =
    await runHostileExactWorkerImport(
      'inherited-current-schema',
      Object.create(exactSourceObserved)
    );
  assert.equal(
    inheritedCurrentSchemaRejected.value.workerResidentStage
      .workerRetainedGasCellFieldImportInputStatus,
    'blocked-forged-exact-v4-gas-pressure-authority-schema'
  );
  const retiredSchemaPrototype = {
    schema: 'peercompute.ulg.sph-retained-gas-cell-eos-source.v3'
  };
  const inheritedRetiredSchemaWrapper = Object.create(
    retiredSchemaPrototype
  );
  Object.defineProperty(
    inheritedRetiredSchemaWrapper,
    'retainedGasCellFieldSource',
    {
      enumerable: true,
      configurable: true,
      writable: true,
      value: legacyRawSource
    }
  );
  const inheritedRetiredSchemaRejected =
    await runHostileExactWorkerImport(
      'inherited-retired-schema',
      inheritedRetiredSchemaWrapper
    );
  assert.equal(
    inheritedRetiredSchemaRejected.value.workerResidentStage
      .workerRetainedGasCellFieldImportInputStatus,
    'blocked-retired-gas-pressure-authority-schema'
  );

  let prototypeSchemaGetterCount = 0;
  const accessorSchemaPrototype = {};
  Object.defineProperty(accessorSchemaPrototype, 'schema', {
    get() {
      prototypeSchemaGetterCount += 1;
      return ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA;
    }
  });
  const accessorSchemaPrototypeWrapper = Object.create(
    accessorSchemaPrototype
  );
  Object.defineProperty(
    accessorSchemaPrototypeWrapper,
    'retainedGasCellFieldSource',
    {
      enumerable: true,
      configurable: true,
      writable: true,
      value: exactSourceObserved
    }
  );
  const inheritedSchemaAccessorRejected =
    await runHostileExactWorkerImport(
      'inherited-schema-accessor',
      accessorSchemaPrototypeWrapper
    );
  assert.equal(
    inheritedSchemaAccessorRejected.value.workerResidentStage
      .workerRetainedGasCellFieldImportInputStatus,
    'blocked-gas-pressure-authority-schema-accessor'
  );
  assert.equal(prototypeSchemaGetterCount, 0);

  const submittedReplayRejected = await runHostileExactWorkerImport(
    'submitted-replay',
    {
      schema: 'peercompute.ulg.pressure-interface-gas-cell-field-import.v0',
      status: 'pressure-interface-gas-cell-field-import-ready',
      retainedGasCellFieldSource: exactSourceObserved,
      pressureInterfaceGasCellFieldAdmission: exactAdmission
    }
  );
  assert.equal(
    submittedReplayRejected.value.workerResidentStage
      .workerRetainedGasCellFieldImportInputStatus,
    'blocked-exact-v4-gas-pressure-authority-unavailable'
  );
  assert.equal(Object.isFrozen(exactSourceObserved), true);
  assert.equal(
    Reflect.set(
      exactSourceObserved,
      'schema',
      'peercompute.ulg.sph-retained-gas-cell-eos-source.v1'
    ),
    false
  );
  assert.equal(
    exactSourceObserved.schema,
    ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA
  );

  const echoContext = {
    schema: 'peercompute.ulg.mechanics-resident-stage-worker-context.v0',
    taskIdPrefix: 'ulg:test:worker-v4-gas-authority-echo',
    preferWebGpu: false,
    readbackMode: 'full-parity-readback',
    common: {
      boxDimsM: [2, 2, 2],
      gasPressureSummary: context.common.gasPressureSummary,
      materialInterfaceField,
      pressureInterfaceGasCellFieldImport: {
        schema: 'peercompute.ulg.pressure-interface-gas-cell-field-import.v0',
        status: 'pressure-interface-gas-cell-field-import-ready',
        retainedGasCellFieldSource: telemetry,
        workerRetainedGasPressureBufferRefs: [
          'ulg-worker:forged:gasCellEosProducer:gas-pressure'
        ],
        pressureInterfaceGasPressureCellRowCount: 1,
        pressureInterfaceGasPressureCellRowStrideFloats: 12,
        pressureInterfaceGasPressureCellRowByteLength: 48
      }
    }
  };
  const echoed = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage(
      'pressureInterface',
      ['resident-gas-pressure', 'sph-material-interface-field'],
      ['pressure-interface-force-rows']
    ),
    echoContext,
    null,
    {
      laneId: 'ulg:test:worker-v4-gas-authority-echo-lane',
      stateKey: 'ulg:test:worker-v4-gas-authority-echo-state'
    }
  ));
  assert.equal(
    echoed.value.workerResidentStage
      .workerRetainedGasCellFieldImportInputStatus,
    'blocked-gas-pressure-authority-telemetry-non-bindable'
  );
  assert.equal(
    echoed.value.workerResidentStage
      .workerRetainedGasCellFieldImportApplied,
    false
  );
  assert.equal(
    releaseSchroederSpatialEpochGenerationAfterQueue(
      schroederSpatialEpochGeneration,
      device
    ),
    false
  );
  assert.equal(await schroederSpatialEpochGeneration.releasePromise, true);
});

test('ULG resident stage worker retires gas-cell owners when pressure is omitted or the lane aborts', async () => {
  const spatialGasSpeciesLedger = {
    schema: 'peercompute.ulg.sph-spatial-gas-species-ledger.v0',
    status: 'spatial-gas-species-ledger-ready',
    cellDims: [1, 1, 1],
    cellCount: 1,
    cells: [{
      index: 0,
      gridIndex: [0, 0, 0],
      centerM: [0.5, 0.5, 0.5],
      volumeM3: 1,
      bySpecies: {
        h2: { material: 'h2', massKg: 0.01, moles: 5, temperatureK: 300 }
      }
    }]
  };
  const makeContext = (device, includePressureInterfaceStage) => ({
    schema: 'peercompute.ulg.mechanics-resident-stage-worker-context.v0',
    taskIdPrefix: `ulg:test:worker-gas-finalizer:${includePressureInterfaceStage}`,
    preferWebGpu: true,
    readbackMode: 'no-full-readback',
    includePressureInterfaceStage,
    common: {
      device,
      boxDimsM: [1, 1, 1],
      gasPressureSummary: {
        schema: 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0',
        status: 'gpu-resident-reaction-pressure-summary',
        totalPressurePa: 101325,
        boxVolumeM3: 1,
        boxDimsM: [1, 1, 1],
        bySpecies: {},
        spatialGasSpeciesLedger
      }
    }
  });

  const omittedDevice = createFakeGpuDevice();
  const omittedLane = {
    laneId: 'ulg:test:worker-gas-finalizer-omitted-lane',
    stateKey: 'ulg:test:worker-gas-finalizer-omitted-state'
  };
  const omitted = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage('gasCellEosProducer', ['resident-spatial-gas-species-ledger'], ['resident-gas-pressure']),
    makeContext(omittedDevice, false),
    null,
    omittedLane
  ));
  assert.equal(
    omitted.value.workerResidentStage.workerRetainedGasCellEosReleaseStatus,
    'gas-cell-eos-final-consumer-release-scheduled-after-pressure-omitted'
  );
  assert.equal(
    omitted.value.workerResidentStage.workerRetainedGasCellEosReleaseScheduled,
    true
  );
  assert.equal(
    omitted.value.workerResidentStage.workerQueueFence.cpuQueueFenceBypassed,
    true
  );
  assert.equal(omittedDevice.queue.submittedWorkDoneCount || 0, 0);

  const abortedDevice = createFakeGpuDevice();
  const abortedLane = {
    laneId: 'ulg:test:worker-gas-finalizer-aborted-lane',
    stateKey: 'ulg:test:worker-gas-finalizer-aborted-state'
  };
  const abortedContext = makeContext(abortedDevice, true);
  const retained = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage('gasCellEosProducer', ['resident-spatial-gas-species-ledger'], ['resident-gas-pressure']),
    abortedContext,
    null,
    abortedLane
  ));
  assert.equal(
    retained.value.workerResidentStage.workerRetainedGasCellEosReleaseScheduled,
    false
  );
  assert.equal(
    retained.value.workerResidentStage.workerQueueFence.finalConsumerFenceDeferred,
    true
  );
  const queueFenceCountBeforeAbort = abortedDevice.queue.submittedWorkDoneCount || 0;
  const finalizerContext = {
    ...abortedContext,
    gasCellEosFinalConsumerPressureStageStatus: 'lane-aborted'
  };
  const finalized = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage('gasCellEosFinalizer', ['resident-gas-pressure'], []),
    finalizerContext,
    retained.value,
    abortedLane
  ));
  assert.equal(finalized.value.releaseScheduled, true);
  assert.equal(
    finalized.value.status,
    'gas-cell-eos-final-consumer-release-scheduled-after-lane-abort'
  );
  assert.equal(finalized.value.releaseConfirmed, true);
  assert.equal(
    abortedDevice.queue.submittedWorkDoneCount || 0,
    queueFenceCountBeforeAbort
  );
  const repeated = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage('gasCellEosFinalizer', ['resident-gas-pressure'], []),
    finalizerContext,
    finalized.value,
    abortedLane
  ));
  assert.equal(repeated.value.releaseScheduled, true);
  assert.equal(repeated.value.releaseAlreadyScheduled, true);
  assert.equal(
    abortedDevice.queue.submittedWorkDoneCount || 0,
    queueFenceCountBeforeAbort
  );
});

test('ULG resident stage worker can run spatial gas ledger producer stage', async () => {
  const compactRows = new Float32Array([
    0.5, 1, 1, 7, 0.04, 100, 300, 1, 0, 0, 1, 1,
    1.5, 1, 1, 7, 0.06, 200, 300, 1, 0, 1, 1, 1
  ]);
  const context = {
    schema: 'peercompute.ulg.mechanics-resident-stage-worker-context.v0',
    taskIdPrefix: 'ulg:test:spatial-gas-worker',
    preferWebGpu: false,
    readbackMode: 'full-parity-readback',
    common: {
      boxDimsM: [2, 2, 2],
      productEventCompactRows: compactRows,
      productEventRowCount: 2,
      residentProductMass: {
        schema: 'peercompute.ulg.sph-resident-product-mass.v0',
        status: 'resident-product-mass-buffer-retained',
        productEventBuffer: { label: 'worker-spatial-product-events' },
        productEventBufferRetained: true,
        productEventBufferByteLength: 2 * 32 * 4,
        productEventRowCount: 2,
        productEventStrideFloats: 32
      },
      reactionTable: {
        schema: 'peercompute.ulg.sph-gpu-reaction-table.v1',
        productTermMetadata: [
          { productTermIndex: 0, material: 'h2', routing: 'gas' }
        ]
      }
    }
  };

  const spatial = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage('spatialGasLedgerProducer', ['resident-product-mass'], ['resident-spatial-gas-species-ledger']),
    context,
    null,
    {
      laneId: 'ulg:test:spatial-gas-worker-lane',
      stateKey: 'ulg:test:spatial-gas-worker-state'
    }
  ));

  assert.equal(spatial.value.workerResidentStage.stageId, 'spatialGasLedgerProducer');
  assert.equal(spatial.value.computeTaskId, 'ulg:test:spatial-gas-worker:spatialGasLedgerProducer');
  assert.equal(spatial.value.spatialGasLedgerProducerStageTaskEvidence.passed, true);
  assert.equal(spatial.value.spatialGasLedgerProducerStageTaskAuthority.authoritativeStateMutation, false);
  assert.equal(spatial.value.spatialGasSpeciesLedger.status, 'spatial-gas-species-ledger-ready');
  assert.equal(spatial.value.spatialGasSpeciesLedger.cellCount, 2);
  assert.equal(spatial.value.fullProductEventReadbackPerformed, false);
  assert.equal(spatial.value.retainedSpatialGasLedgerSourceReady, false);
});

test('ULG resident stage worker can run thermal phase stage and adopt retained thermo output', async () => {
  const buffers = manualBuffers();
  const sourceStateBuffer = { label: 'worker-g2p-state' };
  const sourceThermoBuffer = { label: 'worker-source-thermo' };
  const outputStateBuffer = { label: 'worker-thermal-state' };
  const outputThermoBuffer = { label: 'worker-thermal-thermo' };
  const thermalInputs = [];
  const context = {
    schema: 'peercompute.ulg.mechanics-resident-stage-worker-context.v0',
    taskIdPrefix: 'ulg:test:thermal-worker',
    preferWebGpu: false,
    readbackMode: 'full-parity-readback',
    common: {
      ...buffers,
      thermalMaterialTable: { schema: 'peercompute.ulg.sph-gpu-thermal-material-table.v0' },
      sphParticleUpload: {
        status: 'webgpu-uploaded',
        stateBuffer: sourceStateBuffer,
        thermoBuffer: sourceThermoBuffer
      },
      sourceStateBuffer,
      sourceThermoBuffer,
      boxDimsM: [5, 5, 5],
      dtS: buffers.mlsMpmParticleState.mechanicsDtS,
      thermalStepRunner(args) {
        thermalInputs.push(args);
        return {
          schema: 'peercompute.ulg.sph-gpu-thermal-step-execution.v0',
          backend: 'webgpu',
          status: 'webgpu-accepted',
          webgpuStatus: { status: 'webgpu-executed' },
          result: {
            schema: 'peercompute.ulg.sph-gpu-thermal-step.v0',
            backend: 'webgpu',
            status: 'thermal-step-executed',
            particleCount: buffers.sphParticleState.particleCount,
            state: new Float32Array(),
            thermo: new Float32Array(),
            stateBuffer: outputStateBuffer,
            thermoBuffer: outputThermoBuffer,
            stateBufferByteLength: buffers.sphParticleState.state.byteLength,
            thermoBufferByteLength: buffers.sphParticleState.thermo.byteLength,
            retainedOutputParticleBuffers: true,
            readbackMode: 'full-parity-readback',
            fullReadbackPerformed: true
          }
        };
      }
    }
  };

  const thermal = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage('thermalPhase', ['sph-particle-state', 'sph-thermo-phase'], ['sph-thermo-phase']),
    context
  ));

  assert.equal(thermal.value.workerResidentStage.stageId, 'thermalPhase');
  assert.equal(thermal.value.computeTaskId, 'ulg:test:thermal-worker:thermalPhase');
  assert.equal(thermal.value.thermalPhaseStageTaskEvidence.passed, true);
  assert.equal(thermal.value.thermalPhaseStageTaskAuthority.authoritativeStateMutation, false);
  assert.equal(thermal.value.workerResidentStage.workerRetainedThermoOutputStatus, 'adopted-worker-retained-thermo-output');
  assert.ok(thermal.retainedBufferRefs.includes('sph-state-buffer'));
  assert.ok(thermal.retainedBufferRefs.includes('sph-thermo-buffer'));
  assert.equal(thermalInputs.length, 1);
  assert.equal(thermalInputs[0].sourceStateBuffer, sourceStateBuffer);
  assert.equal(thermalInputs[0].sourceThermoBuffer, sourceThermoBuffer);
  assert.equal(thermalInputs[0].retainOutputParticleBuffers, true);
});

test('ULG resident stage worker can run reaction product stage with retained particle and product outputs', async () => {
  const buffers = manualBuffers();
  const sourceStateBuffer = { label: 'worker-reaction-state-source' };
  const sourceThermoBuffer = { label: 'worker-reaction-thermo-source' };
  const sourceMechanicsBuffer = { label: 'worker-reaction-mechanics-source' };
  const outputStateBuffer = { label: 'worker-reaction-state-output' };
  const outputThermoBuffer = { label: 'worker-reaction-thermo-output' };
  const outputMechanicsBuffer = { label: 'worker-reaction-mechanics-output' };
  const productEventBuffer = { label: 'worker-reaction-product-events' };
  const reactionInputs = [];
  const context = {
    schema: 'peercompute.ulg.mechanics-resident-stage-worker-context.v0',
    taskIdPrefix: 'ulg:test:reaction-worker',
    preferWebGpu: false,
    readbackMode: 'full-parity-readback',
    common: {
      ...buffers,
      reactionTable: { schema: 'peercompute.ulg.sph-gpu-reaction-table.v1', reactionCount: 1, productTermCount: 1, gasProductCount: 0 },
      thermalMaterialTable: { schema: 'peercompute.ulg.sph-gpu-thermal-material-table.v0' },
      sphParticleUpload: {
        status: 'webgpu-uploaded',
        stateBuffer: sourceStateBuffer,
        thermoBuffer: sourceThermoBuffer
      },
      mlsMpmParticleUpload: {
        status: 'webgpu-uploaded',
        mechanicsBuffer: sourceMechanicsBuffer
      },
      sourceStateBuffer,
      sourceThermoBuffer,
      sourceMechanicsBuffer,
      reactionStepRunner(args) {
        reactionInputs.push(args);
        return {
          schema: 'peercompute.ulg.sph-gpu-reaction-step-execution.v0',
          backend: 'webgpu',
          status: 'webgpu-accepted',
          webgpuStatus: { status: 'webgpu-executed' },
          result: {
            schema: 'peercompute.ulg.sph-gpu-reaction-step.v0',
            backend: 'webgpu',
            status: 'reaction-step-executed',
            particleCount: buffers.sphParticleState.particleCount,
            reactionCount: 1,
            productTermCount: 1,
            gasProductCount: 0,
            state: new Float32Array(),
            thermo: new Float32Array(),
            mechanics: new Float32Array(),
            stateBuffer: outputStateBuffer,
            thermoBuffer: outputThermoBuffer,
            mechanicsBuffer: outputMechanicsBuffer,
            stateBufferByteLength: buffers.sphParticleState.state.byteLength,
            thermoBufferByteLength: buffers.sphParticleState.thermo.byteLength,
            mechanicsBufferByteLength: buffers.mlsMpmParticleState.mechanics.byteLength,
            retainedOutputParticleBuffers: true,
            residentProductMass: {
              schema: 'peercompute.ulg.sph-resident-product-mass.v0',
              status: 'resident-product-mass-buffer-retained',
              productEventBuffer,
              productEventBufferRetained: true,
              productEventBufferByteLength: 64,
              productEventRowCount: 1
            },
            residentProductMassStatus: 'resident-product-mass-buffer-retained',
            residentProductMassBufferRetained: true,
            readbackMode: 'full-parity-readback',
            fullReadbackPerformed: true
          }
        };
      }
    }
  };

  const reaction = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage('reactionProduct', ['sph-particle-state', 'sph-thermo-phase', 'mls-mpm-mechanics'], ['sph-particle-state', 'sph-thermo-phase', 'mls-mpm-mechanics', 'resident-product-mass']),
    context,
    null,
    {
      laneId: 'ulg:test:reaction-worker-lane',
      stateKey: 'ulg:test:reaction-worker-state'
    }
  ));

  assert.equal(reaction.value.workerResidentStage.stageId, 'reactionProduct');
  assert.equal(reaction.value.computeTaskId, 'ulg:test:reaction-worker:reactionProduct');
  assert.equal(reaction.value.reactionProductStageTaskEvidence.passed, true);
  assert.equal(reaction.value.reactionProductStageTaskAuthority.authoritativeStateMutation, false);
  assert.equal(reaction.value.workerResidentStage.workerRetainedThermoOutputStatus, 'adopted-worker-retained-thermo-output');
  assert.ok(reaction.retainedBufferRefs.includes('sph-state-buffer'));
  assert.ok(reaction.retainedBufferRefs.includes('sph-thermo-buffer'));
  assert.ok(reaction.retainedBufferRefs.includes('mls-mpm-mechanics-buffer'));
  assert.ok(reaction.retainedBufferRefs.includes('resident-product-mass-buffer'));
  assert.equal(reactionInputs.length, 1);
  assert.equal(reactionInputs[0].sourceStateBuffer, sourceStateBuffer);
  assert.equal(reactionInputs[0].sourceThermoBuffer, sourceThermoBuffer);
  assert.equal(reactionInputs[0].sourceMechanicsBuffer, sourceMechanicsBuffer);
  assert.equal(reactionInputs[0].retainOutputParticleBuffers, true);
});

test('ULG resident stage worker exports compact snapshots from export-owned G2P source copies', async () => {
  const device = createFakeGpuDevice();
  const buffers = phaseCarrierBuffers({
    position: [1.5, 1.75, 2.25],
    velocity: [0.25, -0.5, 0.75],
    massKg: 4,
    restDensityKgPerM3: 8
  });
  const laneId = 'ulg:test:compact-snapshot-export-lane';
  const stateKey = 'ulg:test:compact-snapshot-export-state';
  const inputStateBuffer = fakeStorageBuffer(device, 'worker-input-sph-state', buffers.sphParticleState.state);
  const inputThermoBuffer = fakeStorageBuffer(device, 'worker-input-sph-thermo', buffers.sphParticleState.thermo);
  const inputMechanicsBuffer = fakeStorageBuffer(device, 'worker-input-mls-mpm-mechanics', buffers.mlsMpmParticleState.mechanics);
  const updatedGridBuffer = fakeStorageBuffer(device, 'worker-g2p-updated-grid', new Float32Array([1, 0, 0, 0]));
  const g2pStateRows = new Float32Array(buffers.sphParticleState.state);
  g2pStateRows[0] = 2.125;
  g2pStateRows[4] = 0.5;
  const g2pMechanicsRows = new Float32Array(buffers.mlsMpmParticleState.mechanics);
  g2pMechanicsRows[18] = 1.125;
  g2pMechanicsRows[19] = 0.5;
  const transientG2pStateBuffer = fakeStorageBuffer(device, 'transient-g2p-state', g2pStateRows);
  const transientG2pMechanicsBuffer = fakeStorageBuffer(device, 'transient-g2p-mechanics', g2pMechanicsRows);
  const g2pInputs = [];
  const context = {
    schema: 'peercompute.ulg.mechanics-resident-stage-worker-context.v0',
    taskIdPrefix: 'ulg:test:compact-snapshot-export-worker',
    preferWebGpu: true,
    readbackMode: 'no-full-readback',
    retainedCompactSnapshotExportRequested: true,
    captureRetainedCompactSnapshotExportSources: true,
    common: {
      ...buffers,
      device,
      sphParticleUpload: {
        status: 'webgpu-uploaded',
        stateBuffer: inputStateBuffer,
        thermoBuffer: inputThermoBuffer
      },
      mlsMpmParticleUpload: {
        status: 'webgpu-uploaded',
        mechanicsBuffer: inputMechanicsBuffer
      },
      boxDimsM: [5, 5, 5],
      dt: buffers.mlsMpmParticleState.mechanicsDtS,
      webGpuRunner(args) {
        g2pInputs.push(args);
        return {
          schema: 'peercompute.ulg.mls-mpm-g2p-webgpu-result.v0',
          backend: 'webgpu',
          status: 'reconstructed',
          particleCount: buffers.sphParticleState.particleCount,
          gridNodeCount: 1,
          stateBuffer: transientG2pStateBuffer,
          mechanicsBuffer: transientG2pMechanicsBuffer,
          stateBufferByteLength: g2pStateRows.byteLength,
          mechanicsBufferByteLength: g2pMechanicsRows.byteLength,
          stateStrideFloats: 8,
          mechanicsStrideFloats: MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length,
          retainedOutputParticleBuffers: true,
          readbackMode: 'no-full-readback',
          fullReadbackPerformed: false,
          normalHotLoopReadbackFree: true,
          internalPressureScale: 0,
          webgpuStatus: { status: 'webgpu-executed-no-full-readback' }
        };
      }
    }
  };

  const g2p = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage('g2p', ['mls-mpm-grid', 'sph-particle-state', 'mls-mpm-mechanics'], ['sph-particle-state', 'mls-mpm-mechanics']),
    context,
    {
      backend: 'webgpu',
      status: 'grid-updated',
      updatedGridBuffer,
      updatedGridBufferByteLength: 16,
      dt: buffers.mlsMpmParticleState.mechanicsDtS
    },
    { laneId, stateKey }
  ));

  assert.equal(g2pInputs.length, 1);
  assert.equal(g2p.value.workerResidentStage.stageId, 'g2p');
  assert.equal(
    g2p.value.workerResidentStage.compactSnapshotExportSourceStatus,
    'worker-retained-compact-snapshot-export-sources-ready'
  );
  assert.equal(g2p.value.workerResidentStage.compactSnapshotExportOwnedSourcesReady, true);
  assert.equal(g2p.summary.compactSnapshotExportOwnedSourcesReady, true);

  transientG2pStateBuffer.destroy();
  transientG2pMechanicsBuffer.destroy();

  const exported = await exportUlgMechanicsResidentStageWorkerRetainedCompactSnapshot({
    device,
    laneId,
    stateKey,
    cacheKey: 'ulg:test:compact-snapshot-export-cache',
    particleCount: buffers.sphParticleState.particleCount,
    step: 1,
    time: 0.1,
    smoothingLengthM: buffers.sphParticleState.smoothingLengthM,
    phaseCarrierPlan: buffers.sphParticleState.phaseCarrierPlan
  });

  assert.equal(exported.status, 'worker-retained-compact-snapshot-exported');
  assert.equal(exported.portableSnapshotAvailable, true);
  assert.equal(exported.crossPeerReplayReady, true);
  assert.equal(exported.compactBufferSnapshot.schema, 'peercompute.ulg.remote-task-graph-compact-buffer-snapshot.v0');
  assert.deepEqual([...exported.compactBufferSnapshot.sphState], [...g2pStateRows]);
  assert.deepEqual([...exported.compactBufferSnapshot.mlsMpmMechanics], [...g2pMechanicsRows]);
  assert.deepEqual([...exported.compactBufferSnapshot.sphThermo], [...buffers.sphParticleState.thermo]);
  assert.deepEqual(exported.compactBufferSnapshot.phaseCarrierPlan, {
    schema: 'peercompute.ulg.sph-phase-carrier-plan.v2',
    status: 'phase-lane-capacity-ready',
    lineageCapacity: 1,
    primaryCapacity: 1,
    phaseLaneCount: 4,
    phaseLaneStride: 1,
    companionStart: 1,
    companionCapacity: 3,
    particleCapacity: 4,
    stableLaneAddress: 'phaseLane*phaseLaneStride+lineageIndex'
  });
  assert.notStrictEqual(
    exported.compactBufferSnapshot.phaseCarrierPlan,
    buffers.sphParticleState.phaseCarrierPlan
  );
  assert.equal(
    Object.hasOwn(exported.compactBufferSnapshot.phaseCarrierPlan, 'localOnlyBuffer'),
    false
  );
  assert.equal(
    Object.hasOwn(exported.compactBufferSnapshot.phaseCarrierPlan, 'localOnlyArray'),
    false
  );

  const rejected = await exportUlgMechanicsResidentStageWorkerRetainedCompactSnapshot({
    device,
    laneId,
    stateKey,
    particleCount: buffers.sphParticleState.particleCount,
    phaseCarrierPlan: {
      ...buffers.sphParticleState.phaseCarrierPlan,
      particleCapacity: 1
    }
  });
  assert.equal(rejected.status, 'worker-retained-compact-snapshot-export-blocked');
  assert.equal(
    rejected.reason,
    'worker-retained-compact-snapshot-phase-carrier-plan-particle-count-mismatch'
  );
  assert.match(rejected.errorMessage, /phaseCarrierPlan does not match particleCount 4/);
});

test('ULG resident stage worker rematerializes adopted storage from a descriptor seed and reuses it across schedules', async () => {
  const buffers = phaseCarrierBuffers();
  const device = createFakeGpuDevice();
  const seed = {
    schema: 'peercompute.ulg.schroeder-adopted-particle-storage-portable-materialization-seed.v0',
    status: 'schroeder-adopted-particle-storage-portable-materialization-seed-ready',
    ready: true,
    hotBufferKey: 'ulg:sph-resident-schroeder-adopted-storage:test-seed',
    authoritativeParticleCount: buffers.sphParticleState.particleCount,
    phaseCarrierPlan: buffers.sphParticleState.phaseCarrierPlan,
    materializationMode: 'peer-local-gpu-rematerialization-from-descriptor-seed'
  };
  const context = {
    schema: 'peercompute.ulg.mechanics-resident-stage-worker-context.v0',
    taskIdPrefix: 'ulg:test:adopted-storage-worker',
    preferWebGpu: false,
    readbackMode: 'full-parity-readback',
    common: {
      ...buffers,
      deviceResult: { device },
      useSchroederAdoptedParticleStorageWorkerRematerialization: true,
      schroederAdoptedParticleStorageWorkerRematerializationSeed: seed,
      gridSpacingM: buffers.sphParticleState.smoothingLengthM,
      boxDimsM: [5, 5, 5],
      dt: buffers.mlsMpmParticleState.mechanicsDtS,
      gravityMPerS2: [0, 0, 0],
      cflFactor: 10
    }
  };
  const laneOptions = {
    laneId: 'ulg:test:adopted-storage-worker-lane',
    stateKey: 'ulg:test:adopted-storage-worker-state'
  };
  const p2gStage = stage('p2g', ['sph-particle-state', 'mls-mpm-mechanics'], ['mls-mpm-grid']);

  const first = await runUlgMechanicsResidentStageWorkerPayload(
    payload(p2gStage, context, null, laneOptions)
  );
  const firstRemat = first.value.workerResidentStage.workerAdoptedStorageRematerialization;
  assert.equal(
    first.value.workerResidentStage.workerAdoptedStorageRematerializationStatus,
    'worker-rematerialized-adopted-storage'
  );
  assert.equal(first.value.workerResidentStage.workerAdoptedStorageRematerializationApplied, true);
  assert.equal(firstRemat.reusedRetainedBuffers, false);
  assert.equal(firstRemat.hotBufferKey, seed.hotBufferKey);
  assert.equal(firstRemat.rawGpuBufferPeerComputeTransfer, false);
  assert.deepEqual(firstRemat.phaseCarrierPlan, {
    schema: 'peercompute.ulg.sph-phase-carrier-plan.v2',
    status: 'phase-lane-capacity-ready',
    lineageCapacity: 1,
    primaryCapacity: 1,
    phaseLaneCount: 4,
    phaseLaneStride: 1,
    companionStart: 1,
    companionCapacity: 3,
    particleCapacity: 4,
    stableLaneAddress: 'phaseLane*phaseLaneStride+lineageIndex'
  });
  assert.equal(firstRemat.phaseCarrierPlanPropagatedToUploads, true);
  assert.equal(Object.hasOwn(firstRemat.phaseCarrierPlan, 'localOnlyBuffer'), false);
  assert.equal(Object.hasOwn(firstRemat.phaseCarrierPlan, 'localOnlyArray'), false);
  assert.equal(firstRemat.stateBufferByteLength, buffers.sphParticleState.state.byteLength);
  assert.equal(
    first.value.workerResidentStage.workerRetainedContinuationInputStatus,
    'skipped-worker-retained-g2p-input-superseded-by-adopted-storage'
  );

  const second = await runUlgMechanicsResidentStageWorkerPayload(
    payload(p2gStage, context, null, laneOptions)
  );
  assert.equal(
    second.value.workerResidentStage.workerAdoptedStorageRematerialization.reusedRetainedBuffers,
    true
  );

  // A seed whose authoritative count does not match the packed rows must
  // fail honest instead of rematerializing a stale particle set.
  const mismatchContext = {
    ...context,
    common: {
      ...context.common,
      schroederAdoptedParticleStorageWorkerRematerializationSeed: {
        ...seed,
        hotBufferKey: 'ulg:sph-resident-schroeder-adopted-storage:test-seed-grown',
        authoritativeParticleCount: buffers.sphParticleState.particleCount + 4
      }
    }
  };
  const blocked = await runUlgMechanicsResidentStageWorkerPayload(
    payload(p2gStage, mismatchContext, null, {
      laneId: 'ulg:test:adopted-storage-worker-lane-mismatch',
      stateKey: 'ulg:test:adopted-storage-worker-state-mismatch'
    })
  );
  assert.equal(
    blocked.value.workerResidentStage.workerAdoptedStorageRematerializationStatus,
    'blocked-worker-adopted-storage-rematerialization-row-count-mismatch'
  );
  assert.equal(blocked.value.workerResidentStage.workerAdoptedStorageRematerializationApplied, false);

  const conflictingPlanContext = {
    ...context,
    common: {
      ...context.common,
      schroederAdoptedParticleStorageWorkerRematerializationSeed: {
        ...seed,
        hotBufferKey: 'ulg:sph-resident-schroeder-adopted-storage:test-seed-conflicting-phase-plan',
        phaseCarrierPlan: {
          ...buffers.sphParticleState.phaseCarrierPlan,
          stableLaneAddress: 'differentPhaseLaneAddress'
        }
      }
    }
  };
  const conflictingPlan = await runUlgMechanicsResidentStageWorkerPayload(
    payload(p2gStage, conflictingPlanContext, null, {
      laneId: 'ulg:test:adopted-storage-worker-lane-conflicting-phase-plan',
      stateKey: 'ulg:test:adopted-storage-worker-state-conflicting-phase-plan'
    })
  );
  assert.equal(
    conflictingPlan.value.workerResidentStage.workerAdoptedStorageRematerializationStatus,
    'blocked-worker-adopted-storage-rematerialization-phase-carrier-plan-mismatch'
  );
  assert.equal(
    conflictingPlan.value.workerResidentStage.workerAdoptedStorageRematerializationApplied,
    false
  );
  assert.match(
    conflictingPlan.value.workerResidentStage.workerAdoptedStorageRematerialization.errorMessage,
    /phaseCarrierPlan metadata conflicts across inputs/
  );
});

test('ULG resident stage worker fails closed until arbitrary-domain rematerialization has four authoritative buffers', async () => {
  const buffers = manualBuffers();
  buffers.sphParticleState.identity = Uint32Array.from([7]);
  buffers.sphParticleState.identityRequired = true;
  buffers.sphParticleState.identitySchema = ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA;
  buffers.sphParticleState.identityStrideBytes = Uint32Array.BYTES_PER_ELEMENT;
  buffers.sphParticleState.cpuStateStale = true;
  buffers.sphParticleState.cpuIdentityStale = true;
  buffers.mlsMpmParticleState.cpuStateStale = true;
  const device = createFakeGpuDevice();
  const seed = {
    schema: 'peercompute.ulg.schroeder-adopted-particle-storage-portable-materialization-seed.v0',
    status: 'schroeder-adopted-particle-storage-portable-materialization-seed-ready',
    ready: true,
    hotBufferKey: 'ulg:sph-resident-schroeder-adopted-storage:identity-seed',
    authoritativeParticleCount: 1,
    outputParticleCapacity: 1,
    identityRequired: true,
    identityRevision: 'identity-revision:7',
    identitySchema: ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
    identityStrideBytes: Uint32Array.BYTES_PER_ELEMENT,
    particleIdentityMutationApproved: true,
    requiresAuthoritativeFourBufferRows: true,
    renderDomainKeys: { 7: 'body-seven' }
  };
  const context = {
    taskIdPrefix: 'ulg:test:adopted-storage-worker-identity',
    preferWebGpu: false,
    readbackMode: 'full-parity-readback',
    common: {
      ...buffers,
      deviceResult: { device },
      useSchroederAdoptedParticleStorageWorkerRematerialization: true,
      schroederAdoptedParticleStorageWorkerRematerializationSeed: seed,
      gridSpacingM: buffers.sphParticleState.smoothingLengthM,
      boxDimsM: [5, 5, 5],
      dt: buffers.mlsMpmParticleState.mechanicsDtS,
      gravityMPerS2: [0, 0, 0],
      cflFactor: 10
    }
  };
  const p2gStage = stage('p2g', ['sph-particle-state'], ['mls-mpm-grid']);
  const blocked = await runUlgMechanicsResidentStageWorkerPayload(payload(p2gStage, context, null, {
    laneId: 'ulg:test:adopted-storage-worker-identity-blocked-lane',
    stateKey: 'ulg:test:adopted-storage-worker-identity-blocked-state'
  }));
  assert.equal(
    blocked.value.workerResidentStage.workerAdoptedStorageRematerializationStatus,
    'blocked-worker-adopted-storage-rematerialization-authoritative-four-buffer-snapshot-required'
  );
  assert.equal(blocked.value.workerResidentStage.workerAdoptedStorageRematerializationApplied, false);

  buffers.sphParticleState.cpuStateStale = false;
  buffers.sphParticleState.cpuIdentityStale = false;
  buffers.mlsMpmParticleState.cpuStateStale = false;
  const accepted = await runUlgMechanicsResidentStageWorkerPayload(payload(p2gStage, context, null, {
    laneId: 'ulg:test:adopted-storage-worker-identity-ready-lane',
    stateKey: 'ulg:test:adopted-storage-worker-identity-ready-state'
  }));
  const rematerialization = accepted.value.workerResidentStage.workerAdoptedStorageRematerialization;
  assert.equal(rematerialization.status, 'worker-rematerialized-adopted-storage');
  assert.equal(rematerialization.identityRequired, true);
  assert.equal(rematerialization.identityRevision, seed.identityRevision);
  assert.equal(rematerialization.identityBufferByteLength, Uint32Array.BYTES_PER_ELEMENT);
});

// --- Schroeder Simulation (SS) worker-lane stages (refactor increment W1) ---
// These tests drive the REAL spatial epoch generation builder on the
// synthetic fake-device fixture (same pattern as
// tests/schroederSpatialEpochGpu.test.mjs) and pin the mechanics-stage
// plumbing through the injectable
// stageOptions.schroederSameLevelMechanics.schroederSameLevelMechanicsRunner
// seam, which defaults to the real runSchroederSameLevelMechanicsWebGpu.
// The browser worker/device route is asserted separately by
// plan/refactor/w4-worker-lane-verify.mjs; this suite keeps the component
// contracts deterministic and independently runnable in Node.

function workerSchroederLevelAssignmentFixture(device, {
  particleCount = 2,
  storageGeneration = 11,
  physicsTick = 13,
  physicsSubstep = 0,
  positionEpoch = 17,
  topologyEpoch = 19,
  chartEpoch = 23,
  levelEpoch = 29,
  supportEpoch = 31,
  sourceStateBuffer = undefined,
  sourceThermoBuffer = undefined,
  sourceMechanicsBuffer = undefined,
  label = 'worker-ss-lane'
} = {}) {
  const taggedBuffer = (bufferLabel, size) => tagWebGpuBufferDevice(
    device.createBuffer({ label: bufferLabel, size, usage: 128 | 8 }),
    device
  );
  const assignmentBuffer = taggedBuffer(
    `${label}-assignment`,
    particleCount * SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT.length
      * Float32Array.BYTES_PER_ELEMENT
  );
  const resolvedSourceStateBuffer = sourceStateBuffer === undefined
    ? taggedBuffer(
        `${label}-state`,
        particleCount * 8 * Float32Array.BYTES_PER_ELEMENT
      )
    : sourceStateBuffer;
  const resolvedSourceMechanicsBuffer = sourceMechanicsBuffer === undefined
    ? null
    : sourceMechanicsBuffer;
  const resolvedSourceThermoBuffer = sourceThermoBuffer === undefined
    ? null
    : sourceThermoBuffer;
  return {
    schema: 'peercompute.ulg.schroeder-level-assignment-execution.v0',
    status: 'schroeder-level-assignment-submitted',
    bufferFamilyGenerationStatus:
      'schroeder-particle-buffer-family-generation-ready',
    particleCount,
    assignmentStrideFloats: SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT.length,
    assignmentBuffer,
    assignmentBufferByteLength: assignmentBuffer.size,
    ...(resolvedSourceStateBuffer
      ? {
          sourceStateBuffer: resolvedSourceStateBuffer,
          sourceStateBufferBorrowed: true
        }
      : {}),
    ...(resolvedSourceMechanicsBuffer
      ? {
          sourceMechanicsBuffer: resolvedSourceMechanicsBuffer,
          sourceMechanicsBufferBorrowed: true,
          sourceMechanicsProvenanceStatus:
            'schroeder-spatial-directory-source-mechanics-v0j-ready'
        }
      : {}),
    ...(resolvedSourceThermoBuffer
      ? {
          sourceThermoBuffer: resolvedSourceThermoBuffer,
          sourceThermoBufferBorrowed: true
        }
      : {}),
    storageGeneration,
    physicsTick,
    physicsSubstep,
    positionEpoch,
    topologyEpoch,
    chartEpoch,
    levelEpoch,
    supportEpoch,
    minLevel: 0,
    maxLevel: 0,
    chartId: 0,
    baseGridSpacingM: 1
  };
}

function workerSchroederStageContext(device, buffers, stageOptions = {}) {
  return {
    schema: 'peercompute.ulg.mechanics-resident-stage-worker-context.v0',
    taskIdPrefix: 'ulg:test:schroeder-worker',
    preferWebGpu: true,
    readbackMode: 'no-full-readback',
    common: {
      ...buffers,
      deviceResult: { device },
      boxDimsM: [5, 5, 5],
      dt: buffers.mlsMpmParticleState.mechanicsDtS,
      gravityMPerS2: [0, 0, 0],
      cflFactor: 10
    },
    stageOptions
  };
}

function assertNoWorkerGpuBuffers(value, path = 'result', seen = new Set()) {
  if (value == null || typeof value !== 'object') return;
  if (seen.has(value)) return;
  seen.add(value);
  const bufferLike = typeof value.mapAsync === 'function'
    || typeof value.getMappedRange === 'function'
    || value.constructor?.name === 'GPUBuffer'
    || value.constructor?.name === 'FakeGpuBuffer';
  assert.equal(bufferLike, false, `GPU buffer leaked into worker result at ${path}`);
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return;
  for (const [key, entry] of Object.entries(value)) {
    assertNoWorkerGpuBuffers(entry, `${path}.${key}`, seen);
  }
}

test('authoritative two-level worker epoch mounts the exact read-only S9-C interface proposal', async () => {
  const device = createFakeGpuDevice();
  const buffers = manualBuffers();
  const particleCount = 1;
  const laneOptions = {
    laneId: 'ulg:test:schroeder-worker-two-level-s9c-lane',
    stateKey: 'ulg:test:schroeder-worker-two-level-s9c-state'
  };
  const taggedBuffer = (label, size) => tagWebGpuBufferDevice(
    device.createBuffer({ label, size, usage: 128 | 8 | 4 }),
    device
  );
  const mechanicsBuffer = taggedBuffer(
    'worker-two-level-s9c-mechanics',
    particleCount * 32 * Float32Array.BYTES_PER_ELEMENT
  );
  const thermoBuffer = taggedBuffer(
    'worker-two-level-s9c-thermo',
    particleCount * 12 * Float32Array.BYTES_PER_ELEMENT
  );
  const levelAssignment = {
    ...workerSchroederLevelAssignmentFixture(device, {
      particleCount,
      sourceThermoBuffer: thermoBuffer,
      sourceMechanicsBuffer: mechanicsBuffer,
      label: 'worker-two-level-s9c'
    }),
    minLevel: 0,
    maxLevel: 1
  };
  const identityBuffer = taggedBuffer(
    'worker-two-level-s9c-identity',
    particleCount * Uint32Array.BYTES_PER_ELEMENT
  );
  const sphParticleUpload = {
    schema: ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
    status: 'webgpu-uploaded',
    particleCount,
    stateBuffer: levelAssignment.sourceStateBuffer,
    thermoBuffer,
    identityBuffer
  };
  const mlsMpmParticleUpload = {
    schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
    status: 'webgpu-uploaded',
    particleCount,
    mechanicsBuffer
  };
  let generationArgs = null;
  let generation = null;

  try {
    const epoch = await runUlgMechanicsResidentStageWorkerPayload(payload(
      stage(
        'schroederSpatialEpoch',
        ['schroeder-level-assignment'],
        ['schroeder-spatial-epoch']
      ),
      workerSchroederStageContext(device, buffers, {
        schroederSpatialEpoch: {
          levelAssignment,
          particleIdentityBuffer: identityBuffer,
          particleIdentityStrideWords: 1,
          selectedLevel: 0,
          // Deliberately differ from the canonical mechanics spacing. The
          // worker must not build the epoch hierarchy from the SPH/common
          // support spacing when the exact Schroeder geometry is supplied.
          gridSpacingM: 5,
          baseGridSpacingM: 1,
          minLevel: 0,
          maxLevel: 1,
          enableTwoLevelMechanics: true,
          twoLevelMechanicsAuthority: 'authoritative',
          enableMechanicsFieldPairV2: true,
          exactNearCellTreeEnabled: false,
          sphParticleUpload,
          mlsMpmParticleUpload,
          async schroederSpatialEpochGenerationRunner(args) {
            generationArgs = args;
            generation = await runSchroederSpatialEpochGenerationWebGpu(args);
            return generation;
          }
        }
      }),
      null,
      laneOptions
    ));

    assert.equal(generationArgs.phaseVolumeInterfaceProposalEnabled, true);
    assert.equal(generationArgs.mechanicsFieldPairV2Enabled, true);
    assert.equal(
      generationArgs.activeSourceCapacity,
      particleCount,
      'the worker initial epoch must share the controller sparse-capacity key'
    );
    assert.equal(
      generationArgs.directArenaCount,
      4,
      'authoritative two-level worker epochs must share the controller arena family'
    );
    assert.equal(generationArgs.mechanicsLevels.length, 2);
    assert.equal(generationArgs.mechanicsLevels[0].mechanicsGrid.gridSpacingM, 1);
    assert.equal(generationArgs.mechanicsLevels[1].mechanicsGrid.gridSpacingM, 2);
    assert.equal(generation.phaseVolumeInterfaceProposalEnabled, true);
    assert.equal(generation.mechanicsLevelCount, 2);
    assert.ok(generation.phaseVolumeInterfaceProposal);
    assert.equal(
      generation.phaseVolumeInterfaceProposalRuntime.ownsExecution(
        generation.phaseVolumeInterfaceProposal
      ),
      true
    );
    assert.equal(generation.phaseVolumeInterfaceProposal.twoLevel, true);
    assert.equal(generation.phaseVolumeInterfaceProposal.submitPerformed, true);
    assert.equal(
      validateSchroederSpatialEpochGenerationLevelAssignment(generation, {
        device,
        levelAssignment,
        sphParticleUpload,
        mlsMpmParticleUpload
      }),
      true
    );
    assert.equal(
      validateSchroederSpatialEpochGenerationLevelAssignment(generation, {
        device,
        levelAssignment: { ...levelAssignment },
        sphParticleUpload,
        mlsMpmParticleUpload
      }),
      false,
      'a copied public assignment cannot borrow the generation lineage'
    );
    assert.equal(epoch.value.epochSeal.mechanicsLevelCount, 2);
    assert.deepEqual(epoch.value.epochSeal.mechanicsLevels, [0, 1]);
    assert.equal(epoch.value.generationSummary.activeSourceCapacity, particleCount);
    assert.equal(epoch.value.generationSummary.directArenaCount, 4);
    assertNoWorkerGpuBuffers(epoch, 'twoLevelS9cEpoch');

    let authoritativeTwoLevelRunnerCallCount = 0;
    const reachedAuthoritativeTwoLevelRunner = new Error(
      'reached exact seeded authoritative two-level runner'
    );
    await assert.rejects(
      runUlgMechanicsResidentStageWorkerPayload(payload(
        stage(
          'schroederSameLevelMechanics',
          ['schroeder-spatial-epoch', 'sph-particle-state', 'mls-mpm-mechanics'],
          ['sph-particle-state', 'mls-mpm-mechanics']
        ),
        workerSchroederStageContext(device, buffers, {
          schroederSameLevelMechanics: {
            expectedSpatialEpochSeal: epoch.value.epochSeal,
            enableTwoLevelMechanics: true,
            twoLevelMechanicsAuthority: 'authoritative',
            enableMechanicsFieldPairV2: true,
            async schroederSameLevelMechanicsRunner(args) {
              const schroederSpatialEpochTransaction =
                createSchroederSameLevelMechanicsSpatialEpochTransaction({
                  device,
                  generation: args.spatialEpochGeneration,
                  sphParticleUpload: args.sphParticleUpload,
                  mlsMpmParticleUpload: args.mlsMpmParticleUpload,
                  residentStepOptions: args.residentStepOptions,
                  twoLevelAuthoritative: true
                });
              await assert.rejects(
                runSchroederSameLevelMechanicsWebGpu({
                  ...args,
                  levelAssignment: { ...args.levelAssignment },
                  schroederSpatialEpochTransaction
                }),
                (error) => {
                  assert.equal(
                    error?.code,
                    'ERR_SCHROEDER_TWO_LEVEL_SPATIAL_TRANSACTION_REQUIRED'
                  );
                  return true;
                }
              );
              return runSchroederSameLevelMechanicsWebGpu({
                ...args,
                schroederSpatialEpochTransaction,
                enableLawQueue: false,
                enableLawNeighborCandidates: false,
                enableCrossLevelCoupling: false,
                enablePressureInterfaceOwnerScope: false,
                async twoLevelMechanicsRunner() {
                  authoritativeTwoLevelRunnerCallCount += 1;
                  throw reachedAuthoritativeTwoLevelRunner;
                }
              });
            }
          }
        }),
        epoch.value,
        laneOptions
      )),
      (error) => {
        assert.match(
          error?.message ?? '',
          /reached exact seeded authoritative two-level runner/
        );
        return true;
      }
    );
    assert.equal(
      authoritativeTwoLevelRunnerCallCount,
      1,
      'the exact seeded assignment/generation transaction must pass hierarchy admission'
    );
  } finally {
    releaseUlgMechanicsResidentStageWorkerLane(laneOptions);
  }
});

test('ULG resident stage worker chains schroederSpatialEpoch and schroederSameLevelMechanics through one retained SS lane', async () => {
  const device = createFakeGpuDevice();
  const deviceId = webGpuDeviceId(device);
  const buffers = manualBuffers();
  const laneOptions = {
    laneId: 'ulg:test:schroeder-worker-lane',
    stateKey: 'ulg:test:schroeder-worker-state'
  };
  const particleCount = 2;
  const taggedBuffer = (label, size) => tagWebGpuBufferDevice(
    device.createBuffer({ label, size, usage: 128 | 8 }),
    device
  );
  const levelAssignment = workerSchroederLevelAssignmentFixture(device, {
    particleCount,
    label: 'worker-ss-chain-step0'
  });
  const particleIdentityBuffer = taggedBuffer(
    'worker-ss-chain-identity',
    particleCount * Uint32Array.BYTES_PER_ELEMENT
  );
  const initialThermoBuffer = taggedBuffer(
    'worker-ss-chain-thermo',
    particleCount * 12 * Float32Array.BYTES_PER_ELEMENT
  );
  const initialMechanicsBuffer = taggedBuffer(
    'worker-ss-chain-mechanics',
    particleCount * 32 * Float32Array.BYTES_PER_ELEMENT
  );
  const mechanicsGrid = {
    selectedLevel: 0,
    gridDims: [2, 2, 2],
    gridNodeCount: 8,
    gridShift: 1,
    gridSpacingM: 1
  };
  const epochStageOptions = {
    levelAssignment,
    particleIdentityBuffer,
    particleIdentityStrideWords: 1,
    selectedLevel: 0,
    mechanicsGrid,
    exactNearCellTreeEnabled: false,
    sphParticleUpload: {
      particleCount,
      stateBuffer: levelAssignment.sourceStateBuffer,
      thermoBuffer: initialThermoBuffer,
      identityBuffer: particleIdentityBuffer
    },
    mlsMpmParticleUpload: {
      particleCount,
      mechanicsBuffer: initialMechanicsBuffer
    }
  };

  // Step 0 epoch: the REAL generation builder runs in the worker stage.
  const epoch = await runUlgMechanicsResidentStageWorkerPayload(
    payload(
      stage(
        'schroederSpatialEpoch',
        ['schroeder-level-assignment'],
        ['schroeder-spatial-epoch']
      ),
      workerSchroederStageContext(device, buffers, {
        schroederSpatialEpoch: epochStageOptions
      }),
      null,
      laneOptions
    ),
    // A caller-spoofed options object cannot acquire the module-private
    // schedule fence-deferral capability.
    { deferQueueFenceToResidentScheduleTerminal: true }
  );
  assert.equal(epoch.value.schema, ULG_WORKER_SCHROEDER_SPATIAL_EPOCH_STAGE_SCHEMA);
  assert.equal(epoch.value.status, 'worker-schroeder-spatial-epoch-retained');
  assert.equal(epoch.value.epochRetainedInLane, true);
  assert.equal(epoch.value.epochStepOrdinal, 0);
  assert.equal(epoch.value.levelAssignmentSource, 'stage-option-level-assignment');
  const epochSeal = epoch.value.epochSeal;
  assert.equal(epochSeal.schema, ULG_WORKER_SCHROEDER_EPOCH_SEAL_SCHEMA);
  assert.equal(epochSeal.deviceId, deviceId);
  assert.equal(epochSeal.consumerDeviceId, deviceId);
  assert.ok(Number.isInteger(epochSeal.generationId) && epochSeal.generationId > 0);
  assert.equal(epochSeal.storageGeneration, levelAssignment.storageGeneration);
  assert.equal(epochSeal.physicsTick, levelAssignment.physicsTick);
  assert.equal(epochSeal.positionEpoch, levelAssignment.positionEpoch);
  assert.equal(epochSeal.topologyEpoch, levelAssignment.topologyEpoch);
  assert.equal(epochSeal.mechanicsLevelCount, 1);
  assert.match(epoch.value.directoryBufferRef.ref, /^ulg-worker:/);
  assert.match(epoch.value.levelAssignmentBufferRef.ref, /^ulg-worker:/);
  assert.ok(epoch.retainedBufferRefs.includes(epoch.value.directoryBufferRef.ref));
  assert.ok(epoch.retainedBufferRefs.includes(epoch.value.levelAssignmentBufferRef.ref));
  assert.equal(epoch.value.workerResidentStage.stageId, 'schroederSpatialEpoch');
  assert.equal(epoch.value.gpuFence.fenceSatisfied, true);
  assertNoWorkerGpuBuffers(epoch, 'epoch');
  structuredClone(epoch.value);

  // Step 0 mechanics: consumes the lane-retained epoch generation across
  // messages through the injectable kernel-runner seam.
  const nextStateBuffer = taggedBuffer(
    'worker-ss-chain-next-state',
    particleCount * 8 * Float32Array.BYTES_PER_ELEMENT
  );
  const nextThermoBuffer = taggedBuffer(
    'worker-ss-chain-next-thermo',
    particleCount * 12 * Float32Array.BYTES_PER_ELEMENT
  );
  const nextIdentityBuffer = taggedBuffer(
    'worker-ss-chain-next-identity',
    particleCount * Uint32Array.BYTES_PER_ELEMENT
  );
  const nextMechanicsBuffer = taggedBuffer(
    'worker-ss-chain-next-mechanics',
    particleCount * 32 * Float32Array.BYTES_PER_ELEMENT
  );
  const observedStepZero = {};
  const mechanics = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage(
      'schroederSameLevelMechanics',
      ['schroeder-spatial-epoch', 'sph-particle-state', 'mls-mpm-mechanics'],
      ['sph-particle-state', 'mls-mpm-mechanics']
    ),
    workerSchroederStageContext(device, buffers, {
      schroederSameLevelMechanics: {
        expectedSpatialEpochSeal: epochSeal,
        enableTwoLevelMechanics: true,
        twoLevelMechanicsAuthority: 'authoritative',
        twoLevelFineSubstepCount: 3,
        async schroederSameLevelMechanicsRunner(args) {
          observedStepZero.args = args;
          return {
            status: 'schroeder-same-level-mechanics-completed',
            selectedLevel: 0,
            residentStep: {
              backend: 'webgpu',
              status: 'resident-step-completed',
              readbackMode: 'no-full-readback',
              stageStatus: { p2g: 'completed', g2p: 'completed' },
              stageBackends: { p2g: 'webgpu', g2p: 'webgpu' },
              postMechanicsClosure: {
                schema: 'peercompute.ulg.mls-mpm-post-mechanics-closure.v1',
                status: 'post-mechanics-closure-complete',
                backend: 'webgpu',
                executedStageOrder: [
                  'thermal-phase',
                  'reaction-discovery',
                  'reaction-product',
                  'phase-carrier-transfer-v2',
                  'mechanics-constitutive-refresh'
                ],
                thermalStep: {
                  status: 'thermal-step-executed'
                },
                reactionStep: {
                  status: 'reaction-step-executed'
                },
                phaseCarrierTransferStep: {
                  status: 'phase-carrier-transfer-submitted'
                },
                mechanicsRefreshStep: {
                  status: 'mechanics-constitutive-refresh-executed'
                },
                fullParticleReadbackFree: true,
                residentContinuationReady: true
              },
              nextParticleUploads: {
                sphParticleUpload: {
                  particleCount,
                  stateBuffer: nextStateBuffer,
                  thermoBuffer: nextThermoBuffer,
                  identityBuffer: nextIdentityBuffer
                },
                mlsMpmParticleUpload: {
                  particleCount,
                  mechanicsBuffer: nextMechanicsBuffer
                }
              }
            },
            schroederSpatialEpochReleasePromise: Promise.resolve(true),
            currentSchroederSpatialEpochGenerationSummary: () => ({
              status: 'synthetic-generation-summary'
            })
          };
        }
      }
    }),
    epoch.value,
    laneOptions
  ));
  const stepZeroArgs = observedStepZero.args;
  assert.equal(stepZeroArgs.device, device);
  assert.equal(stepZeroArgs.spatialEpochGeneration.ready, true);
  assert.equal(
    stepZeroArgs.spatialEpochGeneration.execution.generationId,
    epochSeal.generationId
  );
  assert.equal(stepZeroArgs.enableSpatialEpochGeneration, false);
  assert.equal(
    stepZeroArgs.enableCanonicalSingleLevelQueueOrderedCleanup,
    false,
    'standalone W1 calls must retain conservative submitted-work cleanup'
  );
  assert.equal(stepZeroArgs.enableTwoLevelMechanics, true);
  assert.equal(stepZeroArgs.twoLevelMechanicsAuthority, 'authoritative');
  assert.equal(stepZeroArgs.twoLevelFineSubstepCount, 3);
  assert.equal(
    stepZeroArgs.residentStepOptions.summaryRunner,
    undefined,
    'standalone W1 calls must retain the resident runner default contract'
  );
  assert.equal(stepZeroArgs.levelAssignment, levelAssignment);
  assert.equal(
    stepZeroArgs.sphParticleUpload.stateBuffer,
    levelAssignment.sourceStateBuffer
  );
  assert.equal(
    stepZeroArgs.mlsMpmParticleUpload.mechanicsBuffer,
    initialMechanicsBuffer
  );
  assert.equal(
    mechanics.value.schema,
    ULG_WORKER_SCHROEDER_SAME_LEVEL_MECHANICS_STAGE_SCHEMA
  );
  assert.equal(
    mechanics.value.status,
    'worker-schroeder-same-level-mechanics-completed'
  );
  assert.equal(mechanics.value.epochConsumed, true);
  assert.equal(mechanics.value.epochReleaseScheduled, true);
  assert.equal(mechanics.value.epochSeal.generationId, epochSeal.generationId);
  assert.equal(
    mechanics.value.hierarchyStageSummary.status,
    'worker-schroeder-hierarchy-stage-summary-ready'
  );
  assert.equal(mechanics.value.hierarchyStageSummary.mechanicsLevelCount, 1);
  assert.equal(mechanics.value.hierarchyStageSummary.twoLevelMechanicsEnabled, true);
  assert.equal(
    mechanics.value.hierarchyStageSummary.twoLevelMechanicsAuthority,
    'authoritative'
  );
  assert.equal(mechanics.value.hierarchyStageSummary.fullParticleReadbackPerformed, false);
  assert.deepEqual(
    mechanics.value.hierarchyStageSummary.postMechanicsClosure,
    {
      schema: 'peercompute.ulg.mls-mpm-post-mechanics-closure.v1',
      status: 'post-mechanics-closure-complete',
      backend: 'webgpu',
      executedStageOrder: [
        'thermal-phase',
        'reaction-discovery',
        'reaction-product',
        'phase-carrier-transfer-v2',
        'mechanics-constitutive-refresh'
      ],
      thermalStatus: 'thermal-step-executed',
      reactionStatus: 'reaction-step-executed',
      mechanicsRefreshStatus: 'mechanics-constitutive-refresh-executed',
      phaseCarrierTransferStatus: 'phase-carrier-transfer-submitted',
      fullParticleReadbackFree: true,
      residentContinuationReady: true
    }
  );
  assert.equal(
    mechanics.value.schroederSummary.spatialEpochGenerationSummary.status,
    'synthetic-generation-summary'
  );
  assert.match(mechanics.value.postStep.stateBufferRef.ref, /^ulg-worker:/);
  assert.match(mechanics.value.postStep.thermoBufferRef.ref, /^ulg-worker:/);
  assert.match(mechanics.value.postStep.identityBufferRef.ref, /^ulg-worker:/);
  assert.match(mechanics.value.postStep.mechanicsBufferRef.ref, /^ulg-worker:/);
  assert.ok(mechanics.retainedBufferRefs.includes(
    mechanics.value.postStep.stateBufferRef.ref
  ));
  assert.equal(mechanics.value.gpuFence.fenceSatisfied, true);
  assertNoWorkerGpuBuffers(mechanics, 'mechanics');
  structuredClone(mechanics.value);
  // The worker owns the injected generation's release; it settles after the
  // step's queue submissions.
  assert.equal(
    await stepZeroArgs.spatialEpochGeneration.releasePromise,
    true
  );

  // Step 1 epoch: the next spatial epoch consumes the post-step particle
  // buffers retained by the mechanics stage in the same lane.
  const levelAssignmentStepOne = workerSchroederLevelAssignmentFixture(device, {
    particleCount,
    storageGeneration: 12,
    physicsTick: 14,
    positionEpoch: 18,
    topologyEpoch: 19,
    sourceStateBuffer: null,
    label: 'worker-ss-chain-step1'
  });
  const epochStepOne = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage(
      'schroederSpatialEpoch',
      ['schroeder-level-assignment'],
      ['schroeder-spatial-epoch']
    ),
    workerSchroederStageContext(device, buffers, {
      schroederSpatialEpoch: {
        levelAssignment: levelAssignmentStepOne,
        useWorkerRetainedParticleBuffers: true,
        particleIdentityStrideWords: 1,
        selectedLevel: 0,
        mechanicsGrid,
        exactNearCellTreeEnabled: false
      }
    }),
    mechanics.value,
    laneOptions
  ));
  assert.equal(
    epochStepOne.value.levelAssignmentSource,
    'stage-option-level-assignment-with-worker-retained-particle-buffers'
  );
  assert.equal(epochStepOne.value.epochStepOrdinal, 1);
  assert.equal(epochStepOne.value.epochSeal.storageGeneration, 12);
  assert.equal(epochStepOne.value.epochSeal.physicsTick, 14);
  assert.notEqual(
    epochStepOne.value.epochSeal.generationId,
    epochSeal.generationId
  );
  assertNoWorkerGpuBuffers(epochStepOne, 'epochStepOne');

  // Step 1 mechanics: proves the alternating pair is one SS step chain —
  // the second epoch was built against the first step's post-step state
  // buffer, and the second mechanics step consumes those same retained
  // buffers.
  const observedStepOne = {};
  const mechanicsStepOne = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage(
      'schroederSameLevelMechanics',
      ['schroeder-spatial-epoch', 'sph-particle-state', 'mls-mpm-mechanics'],
      ['sph-particle-state', 'mls-mpm-mechanics']
    ),
    workerSchroederStageContext(device, buffers, {
      schroederSameLevelMechanics: {
        expectedSpatialEpochSeal: epochStepOne.value.epochSeal,
        async schroederSameLevelMechanicsRunner(args) {
          observedStepOne.args = args;
          return {
            status: 'schroeder-same-level-mechanics-completed',
            selectedLevel: 0,
            residentStep: {
              backend: 'webgpu',
              status: 'resident-step-completed',
              readbackMode: 'no-full-readback',
              stageStatus: {},
              stageBackends: {},
              nextParticleUploads: {
                sphParticleUpload: {
                  particleCount,
                  stateBuffer: taggedBuffer('worker-ss-chain-step1-state', 64),
                  thermoBuffer: taggedBuffer('worker-ss-chain-step1-thermo', 96),
                  identityBuffer: taggedBuffer('worker-ss-chain-step1-identity', 8)
                },
                mlsMpmParticleUpload: {
                  particleCount,
                  mechanicsBuffer:
                    taggedBuffer('worker-ss-chain-step1-mechanics', 256)
                }
              }
            },
            schroederSpatialEpochReleasePromise: Promise.resolve(true)
          };
        }
      }
    }),
    epochStepOne.value,
    laneOptions
  ));
  const stepOneArgs = observedStepOne.args;
  assert.equal(stepOneArgs.sphParticleUpload.stateBuffer, nextStateBuffer);
  assert.equal(stepOneArgs.sphParticleUpload.thermoBuffer, nextThermoBuffer);
  assert.equal(stepOneArgs.sphParticleUpload.identityBuffer, nextIdentityBuffer);
  assert.equal(
    stepOneArgs.mlsMpmParticleUpload.mechanicsBuffer,
    nextMechanicsBuffer
  );
  assert.equal(
    stepOneArgs.spatialEpochGeneration.source.sourceStateBuffer,
    nextStateBuffer
  );
  assert.equal(
    stepOneArgs.spatialEpochGeneration.execution.storageGeneration,
    12
  );
  assert.equal(mechanicsStepOne.value.epochConsumed, true);
  assert.equal(mechanicsStepOne.value.epochReleaseScheduled, true);
  assertNoWorkerGpuBuffers(mechanicsStepOne, 'mechanicsStepOne');
});

test('ULG resident stage worker SS stages fail closed on missing epoch and identity mismatch', async () => {
  const device = createFakeGpuDevice();
  const buffers = manualBuffers();
  const particleCount = 2;
  const mechanicsGrid = {
    selectedLevel: 0,
    gridDims: [2, 2, 2],
    gridNodeCount: 8,
    gridShift: 1,
    gridSpacingM: 1
  };
  const mechanicsStage = stage(
    'schroederSameLevelMechanics',
    ['schroeder-spatial-epoch'],
    ['sph-particle-state']
  );
  const epochStage = stage(
    'schroederSpatialEpoch',
    ['schroeder-level-assignment'],
    ['schroeder-spatial-epoch']
  );

  // A mechanics stage with no retained epoch in the lane fails closed.
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerPayload(payload(
      mechanicsStage,
      workerSchroederStageContext(device, buffers, {}),
      null,
      {
        laneId: 'ulg:test:schroeder-guard-empty-lane',
        stateKey: 'ulg:test:schroeder-guard-empty-state'
      }
    )),
    /lane-epoch-missing/
  );

  // An epoch stage without any level-assignment source fails closed.
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerPayload(payload(
      epochStage,
      workerSchroederStageContext(device, buffers, {
        schroederSpatialEpoch: {}
      }),
      null,
      {
        laneId: 'ulg:test:schroeder-guard-no-source-lane',
        stateKey: 'ulg:test:schroeder-guard-no-source-state'
      }
    )),
    /level-assignment-source-missing/
  );

  // A generation the real builder refuses is a structured stage error, not a
  // silent fallback.
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerPayload(payload(
      epochStage,
      workerSchroederStageContext(device, buffers, {
        schroederSpatialEpoch: {
          levelAssignment: {
            ...workerSchroederLevelAssignmentFixture(device, {
              particleCount,
              label: 'worker-ss-guard-not-ready'
            }),
            bufferFamilyGenerationStatus: 'schroeder-particle-buffer-family-generation-blocked'
          },
          mechanicsGrid,
          exactNearCellTreeEnabled: false
        }
      }),
      null,
      {
        laneId: 'ulg:test:schroeder-guard-not-ready-lane',
        stateKey: 'ulg:test:schroeder-guard-not-ready-state'
      }
    )),
    /generation-not-ready/
  );

  // Retain a real epoch, then pin the guard set that protects it.
  const guardLane = {
    laneId: 'ulg:test:schroeder-guard-retained-lane',
    stateKey: 'ulg:test:schroeder-guard-retained-state'
  };
  const levelAssignment = workerSchroederLevelAssignmentFixture(device, {
    particleCount,
    label: 'worker-ss-guard-retained'
  });
  const epoch = await runUlgMechanicsResidentStageWorkerPayload(payload(
    epochStage,
    workerSchroederStageContext(device, buffers, {
      schroederSpatialEpoch: {
        levelAssignment,
        selectedLevel: 0,
        mechanicsGrid,
        exactNearCellTreeEnabled: false,
        sphParticleUpload: {
          particleCount,
          stateBuffer: levelAssignment.sourceStateBuffer
        }
      }
    }),
    null,
    guardLane
  ));
  assert.equal(epoch.value.epochRetainedInLane, true);

  // A second epoch stage must not silently supersede an unconsumed epoch.
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerPayload(payload(
      epochStage,
      workerSchroederStageContext(device, buffers, {
        schroederSpatialEpoch: {
          levelAssignment: workerSchroederLevelAssignmentFixture(device, {
            particleCount,
            label: 'worker-ss-guard-second-epoch'
          }),
          mechanicsGrid,
          exactNearCellTreeEnabled: false
        }
      }),
      null,
      guardLane
    )),
    /unconsumed-epoch-retained/
  );

  // Generation identity mismatch: the caller-pinned seal must match the
  // retained generation's own identity words.
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerPayload(payload(
      mechanicsStage,
      workerSchroederStageContext(device, buffers, {
        schroederSameLevelMechanics: {
          expectedSpatialEpochSeal: {
            ...epoch.value.epochSeal,
            generationId: epoch.value.epochSeal.generationId + 999
          },
          async schroederSameLevelMechanicsRunner() {
            throw new Error('kernel must not run on identity mismatch');
          }
        }
      }),
      null,
      guardLane
    )),
    /epoch-seal-mismatch/
  );

  // Cross-device consumption of a retained epoch fails closed.
  const foreignDevice = createFakeGpuDevice();
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerPayload(payload(
      mechanicsStage,
      workerSchroederStageContext(foreignDevice, buffers, {
        schroederSameLevelMechanics: {
          async schroederSameLevelMechanicsRunner() {
            throw new Error('kernel must not run on device mismatch');
          }
        }
      }),
      null,
      guardLane
    )),
    /epoch-device-mismatch/
  );

  // The lane epoch is still intact after the rejections; a valid mechanics
  // stage still consumes it, and a consumed epoch cannot be consumed twice.
  const mechanics = await runUlgMechanicsResidentStageWorkerPayload(payload(
    mechanicsStage,
    workerSchroederStageContext(device, buffers, {
      schroederSameLevelMechanics: {
        expectedSpatialEpochSeal: epoch.value.epochSeal,
        async schroederSameLevelMechanicsRunner() {
          return {
            status: 'schroeder-same-level-mechanics-completed',
            residentStep: {
              backend: 'webgpu',
              status: 'resident-step-completed',
              nextParticleUploads: null
            }
          };
        }
      }
    }),
    null,
    guardLane
  ));
  assert.equal(mechanics.value.epochConsumed, true);
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerPayload(payload(
      mechanicsStage,
      workerSchroederStageContext(device, buffers, {
        schroederSameLevelMechanics: {
          async schroederSameLevelMechanicsRunner() {
            throw new Error('kernel must not run on a consumed epoch');
          }
        }
      }),
      null,
      guardLane
    )),
    /lane-epoch-already-consumed/
  );
});

// --- SS worker-side batched schedule driver (refactor increment W2) ---
// The schedule driver loops the W1 stage pair internally; these tests drive
// the REAL spatial epoch generation builder on the synthetic fake-device
// fixture with per-step level assignments whose identity words advance, and
// pin the mechanics side through the injectable
// stageOptions.schroederSameLevelMechanics.schroederSameLevelMechanicsRunner
// seam exactly like the W1 tests above.
// The real browser WebGPU schedule route is asserted separately by
// plan/refactor/w4-worker-lane-verify.mjs.

function writeWorkerTerminalRefluxReceiptTarget(target, {
  rolledBack = false,
  ownerGeneration = 1
} = {}) {
  const words = createSchroederCrossLevelRefluxLedgerHeader({
    rowCapacity: 1,
    completionOrdinal: target.expectedCompletionOrdinal,
    fineSubstepCount: target.expectedFineSubstepCount,
    fineLevel: target.expectedFineLevel,
    coarseLevel: target.expectedCoarseLevel,
    coarseGridSpacingM: 1,
    macroOwnerId: target.expectedCompletionOrdinal,
    macroOwnerGeneration: ownerGeneration
  });
  words[2] = SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_READY
    | SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_ADMITTED;
  words[4] = 1;
  words[8] = target.expectedFineSubstepCount;
  words[9] = 1;
  words[15] = target.expectedFineSubstepCount;
  words[59] = SCHROEDER_CROSS_LEVEL_REFLUX_PHASE_CONSUMED;
  words[80] = SCHROEDER_CROSS_LEVEL_REFLUX_TERMINAL_RECEIPT_CONSUMED;
  words[81] = 0x12340000 + target.stepOrdinal;
  words[95] = words[81];
  words[96] = 1;
  words[97] = words[98];
  words[99] = 1;
  words[100] = 1;
  words[101] = 1;
  words[102] = 1;
  words[103] = 1;
  words[111] = words[98] + 1;
  words[118] = 1;
  words[119] = 1;
  words[120] = target.expectedFineSubstepCount;
  words[121] = 1;
  words[122] = rolledBack ? 1 : 0;
  words[124] = 0xffff_ffff;
  words[125] = 0;
  target.targetBuffer.bytes.set(
    new Uint8Array(words.buffer, words.byteOffset, words.byteLength),
    target.targetOffsetBytes
  );
  return {
    schema: ULG_SCHROEDER_FUSED_TERMINAL_REFLUX_RECEIPT_COPY_SCHEMA,
    status: 'terminal-reflux-header-copy-submitted-unverified',
    scheduleId: target.scheduleId,
    laneId: target.laneId,
    stateKey: target.stateKey,
    stepOrdinal: target.stepOrdinal,
    targetOffsetBytes: target.targetOffsetBytes,
    targetByteLength: target.targetByteLength,
    completionOrdinal: target.expectedCompletionOrdinal,
    macroOwnerId: target.expectedCompletionOrdinal,
    ownerGeneration,
    fineSubstepCount: target.expectedFineSubstepCount,
    fineLevel: target.expectedFineLevel,
    coarseLevel: target.expectedCoarseLevel,
    queueSubmissionStatus: 'copy-submitted-unverified'
  };
}

function workerScheduleFixture({
  laneSuffix = 'a',
  failAtStep = null,
  withHierarchyCleanupClaims = false,
  omitHierarchyFinalConsumerAtStep = null,
  ineligibleHierarchyCleanupAtStep = null,
  withCarriedResidentProductMass = false,
  withSurfaceStressEvidence = false,
  invalidSurfaceStressAtStep = null,
  withTwoLevelEvidence = false,
  invalidTwoLevelCommitAtStep = null,
  invalidTwoLevelCflFactorAtStep = null
} = {}) {
  const device = createFakeGpuDevice();
  const buffers = manualBuffers();
  const particleCount = 2;
  const phaseCarrierPlan = {
    schema: 'peercompute.ulg.sph-phase-carrier-plan.v1',
    status: 'phase-companion-capacity-ready',
    primaryCapacity: 1,
    companionStart: 1,
    companionCapacity: 1,
    particleCapacity: 2
  };
  const taggedBuffer = (label, size) => tagWebGpuBufferDevice(
    device.createBuffer({ label, size, usage: 128 | 8 | 4 }),
    device
  );
  const identityRows = Uint32Array.from([101, 202]);
  const taggedIdentityBuffer = (label) => {
    const buffer = taggedBuffer(label, identityRows.byteLength);
    device.queue.writeBuffer(buffer, 0, identityRows);
    return buffer;
  };
  const mechanicsBuffer = taggedBuffer(
    `worker-ss-schedule-${laneSuffix}-mechanics`,
    particleCount * 32 * Float32Array.BYTES_PER_ELEMENT
  );
  let latestMechanicsBuffer = mechanicsBuffer;
  const mechanicsGrid = {
    selectedLevel: 0,
    gridDims: [2, 2, 2],
    gridNodeCount: 8,
    gridShift: 1,
    gridSpacingM: 1
  };
  // Identity words advance per step: the schedule contract requires every
  // step to build a fresh sealed generation against an advanced epoch.
  const levelAssignmentForStep = (stepOrdinal) => ({
    ...workerSchroederLevelAssignmentFixture(device, {
      particleCount,
      storageGeneration: 11 + (stepOrdinal - 1),
      physicsTick: 13 + (stepOrdinal - 1),
      positionEpoch: 17 + (stepOrdinal - 1),
      topologyEpoch: 19,
      sourceStateBuffer: stepOrdinal === 1 ? undefined : null,
      sourceMechanicsBuffer: withTwoLevelEvidence
        ? latestMechanicsBuffer
        : undefined,
      label: `worker-ss-schedule-${laneSuffix}-step${stepOrdinal}`
    }),
    ...(withTwoLevelEvidence ? { minLevel: 0, maxLevel: 1 } : {})
  });
  const stepOneAssignment = levelAssignmentForStep(1);
  const identityBuffer = taggedIdentityBuffer(
    `worker-ss-schedule-${laneSuffix}-identity`
  );
  const thermoBuffer = taggedBuffer(
    `worker-ss-schedule-${laneSuffix}-thermo`,
    particleCount * 12 * Float32Array.BYTES_PER_ELEMENT
  );
  const runnerCalls = [];
  const hierarchyCleanupClaims = [];
  const hierarchyFinalConsumers = [];
  const hierarchyCleanupObservations = [];
  const residentProductMasses = [];
  const residentProductMassDestroyCountByOrdinal = new Map();
  const mechanicsRunner = async (args) => {
    runnerCalls.push(args);
    const ordinal = runnerCalls.length;
    if (failAtStep != null && ordinal === failAtStep) {
      throw new Error(`injected mechanics failure at schedule step ${failAtStep}`);
    }
    const hierarchyCleanupClaim = {
      schema: 'peercompute.ulg.test-hierarchy-cleanup-claim.v0',
      ordinal
    };
    const hierarchyFinalConsumer = {
      schema: 'peercompute.ulg.test-hierarchy-final-consumer.v0',
      ordinal
    };
    hierarchyCleanupClaims.push(hierarchyCleanupClaim);
    hierarchyFinalConsumers.push(hierarchyFinalConsumer);
    const hierarchyCleanupEligible = Boolean(
      withHierarchyCleanupClaims
      && ordinal !== ineligibleHierarchyCleanupAtStep
    );
    const inputResidentProductMass = withCarriedResidentProductMass
      ? args.residentStepOptions?.residentProductMass ?? null
      : null;
    const residentProductMass = withCarriedResidentProductMass
      ? {
          status: 'resident-product-mass-buffer-retained',
          source: `worker-test-product-mass-${ordinal}`,
          productEventBufferRetained: true,
          productEventBufferByteLength: 16,
          productEventRowCount: 1,
          destroyResidentProductMassBuffers() {
            residentProductMassDestroyCountByOrdinal.set(
              ordinal,
              (residentProductMassDestroyCountByOrdinal.get(ordinal) || 0) + 1
            );
            return true;
          }
        }
      : null;
    if (residentProductMass) residentProductMasses.push(residentProductMass);
    const surfaceStressSubmission = withSurfaceStressEvidence
      ? {
          schema:
            'peercompute.ulg.schroeder-phase-volume-surface-stress-submission.v2',
          status:
            'eighteen-pass-central-bond-surface-stress-submitted-unverified',
          requested: true,
          submitted: true,
          dispatchCount: ordinal === invalidSurfaceStressAtStep ? 17 : 18,
          entryPoints: [
            'stage_surface_stress_x_even',
            'stage_surface_stress_x_odd',
            'stage_surface_stress_y_even',
            'stage_surface_stress_y_odd',
            'stage_surface_stress_z_even',
            'stage_surface_stress_z_odd',
            'stage_surface_stress_xy_positive_even',
            'stage_surface_stress_xy_positive_odd',
            'stage_surface_stress_xy_negative_even',
            'stage_surface_stress_xy_negative_odd',
            'stage_surface_stress_xz_positive_even',
            'stage_surface_stress_xz_positive_odd',
            'stage_surface_stress_xz_negative_even',
            'stage_surface_stress_xz_negative_odd',
            'stage_surface_stress_yz_positive_even',
            'stage_surface_stress_yz_positive_odd',
            'stage_surface_stress_yz_negative_even',
            'stage_surface_stress_yz_negative_odd'
          ],
          lifecycleDispatchCount: 21,
          lifecycleMode:
            'standalone-s9ab-initialize-ambient-eighteen-central-bonds-validate-commit',
          ambientBuoyancyMode:
            'field-local-s9ab-current-volume-ambient-source',
          generationId:
            args.spatialEpochGeneration?.execution?.generationId ?? null,
          selectedLevel: args.selectedLevel ?? 0,
          levelRole: 'single',
          twoLevel: false,
          fieldCompletionOrdinal: ordinal,
          materialTableSchema:
            'peercompute.ulg.mls-mpm-mechanics-material-table.v0',
          phaseRecordCount: 1,
          positiveSurfaceTensionPhaseRecordCount: 1,
          surfaceTensionCoefficientStatus:
            'positive-surface-tension-coefficient-ready',
          authority:
            'exact-s9-phase-volume-moment-and-mechanics-material-records',
          verification: 'queue-submitted-no-full-readback'
        }
      : null;
    const nextMechanicsBuffer = taggedBuffer(
      `worker-ss-schedule-${laneSuffix}-next-mechanics-${ordinal}`,
      particleCount * 32 * Float32Array.BYTES_PER_ELEMENT
    );
    latestMechanicsBuffer = nextMechanicsBuffer;
    const stageMechanicsTrace = args.residentStepOptions
      ?.stageMechanicsTraceEnabled === true
      ? Object.freeze({
          schema: 'peercompute.ulg.test-stage-mechanics-trace.v0',
          status: 'test-stage-mechanics-trace-ready',
          ordinal
        })
      : null;
    const canonicalSpatialAuthorityTrace = args.residentStepOptions
      ?.stageMechanicsTraceEnabled === true
      ? Object.freeze({
          schema: 'peercompute.ulg.test-canonical-authority-trace.v0',
          status: 'test-canonical-authority-trace-admitted',
          ordinal
        })
      : null;
    const terminalRefluxReceiptCopy = withTwoLevelEvidence
      ? writeWorkerTerminalRefluxReceiptTarget(
          args.residentStepOptions?.[
            SCHROEDER_FUSED_TERMINAL_REFLUX_RECEIPT_TARGET_OPTION
          ],
          {
            rolledBack: ordinal === invalidTwoLevelCommitAtStep,
            ownerGeneration: 1000 + ordinal
          }
        )
      : null;
    return {
      status: 'schroeder-same-level-mechanics-completed',
      selectedLevel: 0,
      ...(withTwoLevelEvidence
        ? {
            twoLevelMechanics: {
              cflFactor: ordinal === invalidTwoLevelCflFactorAtStep
                ? 0.6
                : args.cflFactor
            }
          }
        : {}),
      ...(withHierarchyCleanupClaims
        ? {
            canonicalSingleLevelQueueOrderedCleanupEligible:
              hierarchyCleanupEligible,
            ...(ordinal === omitHierarchyFinalConsumerAtStep
              ? {}
              : {
                  queueOrderedFinalConsumerCapability:
                    hierarchyFinalConsumer
                })
          }
        : {}),
      residentStep: {
        backend: 'webgpu',
        status: withTwoLevelEvidence
          ? 'schroeder-two-level-authoritative-step-executed'
          : 'resident-step-completed',
        readbackMode: 'no-full-readback',
        stageStatus: { p2g: 'completed', g2p: 'completed' },
        stageBackends: { p2g: 'webgpu', g2p: 'webgpu' },
        stageMechanicsTrace,
        canonicalSpatialAuthorityTrace,
        stageTiming: {
          schema: 'peercompute.ulg.test-resident-stage-timing.v0',
          totalMs: ordinal + 0.5,
          stageMs: { p2g: ordinal + 0.25, compactSummary: 0 },
          compactSummaryRequested: false,
          queueFenceMs: { compactSummaryMapAsync: null },
          queueFenceStatus: { fusedMechanicsSequence: null },
          queueFenceMethod: { fusedMechanicsSequence: null }
        },
        ...(withSurfaceStressEvidence
          ? {
              phaseVolumeSurfaceStressSubmission: surfaceStressSubmission
            }
          : {}),
        ...(withTwoLevelEvidence
          ? {
              twoLevelMechanicsAuthority: 'authoritative',
              twoLevelMechanicsStatus:
                'schroeder-two-level-mechanics-completed',
              twoLevelFineSubstepCount: 2,
              twoLevelAuthoritativeCommitVerified: true,
              twoLevelTerminalRefluxReceiptCopy:
                terminalRefluxReceiptCopy
            }
          : {}),
        ...(withHierarchyCleanupClaims
          ? {
              canonicalSingleLevelQueueOrderedCleanupEligible:
                hierarchyCleanupEligible,
              schroederHierarchyArtifactTransferCleanupClaims: [
                hierarchyCleanupClaim
              ],
              localRetainedRenderBuffers: {
                buffers: [],
                destroyRetainedBuffers({
                  queueOrderedFinalConsumer = null
                } = {}) {
                  hierarchyCleanupObservations.push({
                    ordinal,
                    queueOrderedFinalConsumer
                  });
                  if (queueOrderedFinalConsumer == null) {
                    device.queue.onSubmittedWorkDone();
                  }
                  return true;
                }
              }
            }
          : {}),
        ...(inputResidentProductMass
          ? { inputResidentProductMass }
          : {}),
        ...(residentProductMass ? { residentProductMass } : {}),
        nextParticleUploads: {
          sphParticleUpload: {
            particleCount,
            step: ordinal,
            time: ordinal * 0.001,
            slot: ordinal % 2,
            sourceSlot: (ordinal + 1) % 2,
            nextSlot: ordinal % 2,
            topologyEpoch: 19,
            identityRevision: 'worker-schedule-fixture-identity',
            identityRequired: true,
            identitySchema: ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
            identityStrideBytes:
              SPH_GPU_PARTICLE_IDENTITY_UINTS * Uint32Array.BYTES_PER_ELEMENT,
            identityBufferByteLength: identityRows.byteLength,
            renderDomainKeys: {
              101: 'worker-schedule-body-one',
              202: 'worker-schedule-body-two'
            },
            phaseCarrierPlan,
            stateBuffer: taggedBuffer(
              `worker-ss-schedule-${laneSuffix}-next-state-${ordinal}`,
              particleCount * 8 * Float32Array.BYTES_PER_ELEMENT
            ),
            thermoBuffer: taggedBuffer(
              `worker-ss-schedule-${laneSuffix}-next-thermo-${ordinal}`,
              particleCount * 12 * Float32Array.BYTES_PER_ELEMENT
            ),
            identityBuffer: taggedIdentityBuffer(
              `worker-ss-schedule-${laneSuffix}-next-identity-${ordinal}`
            )
          },
          mlsMpmParticleUpload: {
            particleCount,
            step: ordinal,
            time: ordinal * 0.001,
            slot: ordinal % 2,
            sourceSlot: (ordinal + 1) % 2,
            nextSlot: ordinal % 2,
            phaseCarrierPlan,
            mechanicsBuffer: nextMechanicsBuffer
          },
          ...(residentProductMass ? { residentProductMass } : {})
        }
      },
      schroederSpatialEpochReleasePromise: Promise.resolve(true),
      currentSchroederSpatialEpochGenerationSummary: () => ({
        status: 'synthetic-generation-summary'
      })
    };
  };
  const stageOptions = {
    schroederSpatialEpoch: {
      levelAssignment: stepOneAssignment,
      particleIdentityBuffer: identityBuffer,
      particleIdentityStrideWords: 1,
      selectedLevel: 0,
      mechanicsGrid,
      exactNearCellTreeEnabled: false,
      sphParticleUpload: {
        particleCount,
        phaseCarrierPlan,
        stateBuffer: stepOneAssignment.sourceStateBuffer,
        thermoBuffer,
        identityBuffer,
        identityRequired: true,
        identitySchema: ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
        identityStrideBytes:
          SPH_GPU_PARTICLE_IDENTITY_UINTS * Uint32Array.BYTES_PER_ELEMENT,
        identityBufferByteLength: identityRows.byteLength,
        identityRevision: 'worker-schedule-fixture-identity',
        renderDomainKeys: {
          101: 'worker-schedule-body-one',
          202: 'worker-schedule-body-two'
        }
      },
      mlsMpmParticleUpload: {
        particleCount,
        phaseCarrierPlan,
        mechanicsBuffer
      },
      // Continuation steps get an advanced assignment; the fake mechanics
      // runner never commits a successor source family, so this is the
      // synthetic stand-in for the kernel-committed continuation.
      scheduleStepOptionsProvider: ({ stepOrdinal }) => ({
        levelAssignment: levelAssignmentForStep(runnerCalls.length + 1),
        particleIdentityStrideWords: 1
      })
    },
    schroederSameLevelMechanics: {
      schroederSameLevelMechanicsRunner: mechanicsRunner
    }
  };
  return {
    device,
    buffers,
    particleCount,
    mechanicsGrid,
    stageOptions,
    runnerCalls,
    hierarchyCleanupClaims,
    hierarchyFinalConsumers,
    hierarchyCleanupObservations,
    residentProductMasses,
    residentProductMassDestroyCountByOrdinal,
    phaseCarrierPlan,
    identityRows,
    levelAssignmentForStep,
    taggedBuffer
  };
}

function schedulePayload(context, schedule, {
  laneId = 'ulg:test:schroeder-schedule-lane',
  stateKey = 'ulg:test:schroeder-schedule-state'
} = {}) {
  return {
    schedule,
    lease: {
      laneId,
      stateKey,
      queueFencePolicy: 'queue.onSubmittedWorkDone-before-admission'
    },
    context: {
      ulgMechanicsResidentStageWorker: context
    }
  };
}

test('worker schedule executes the exact enabled and disabled hierarchy policy', async () => {
  const executableFields = [
    'enablePortableSummary',
    'enableActiveNodeIndex',
    'enableActiveNodeSortedIndex',
    'enableLawQueue',
    'enableLawNeighborCandidates',
    'enableCrossLevelCoupling',
    'enablePhaseVolumeMigration'
  ];

  for (const enabled of [true, false]) {
    const suffix = enabled ? 'policy-enabled' : 'policy-disabled';
    const fixture = workerScheduleFixture({ laneSuffix: suffix });
    const laneOptions = {
      laneId: `ulg:test:${suffix}-lane`,
      stateKey: `ulg:test:${suffix}-state`
    };
    const hierarchyConfig = createSchroederWorkerHierarchyConfig({
      selectedLevel: 0,
      minLevel: 0,
      maxLevel: 0,
      enableTwoLevelMechanics: false,
      enableMechanicsFieldPairV2: false,
      enablePortableSummary: enabled,
      enableActiveNodeIndex: enabled,
      enableActiveNodeSortedIndex: enabled,
      activeNodeSortedIndexPolicyMode: enabled ? 'canonical-radix' : null,
      lawNeighborTraversalPolicyMode: enabled ? 'exact-near-cell-tree' : null,
      lawNeighborCandidateReadbackMode: enabled ? 'compact-terminal' : null,
      enableLawQueue: enabled,
      enableLawNeighborCandidates: enabled,
      enableCrossLevelCoupling: enabled,
      enablePhaseVolumeMigration: enabled
    });
    Object.assign(fixture.stageOptions.schroederSameLevelMechanics, {
      hierarchyConfig,
      ...Object.fromEntries(
        executableFields.map((field) => [field, hierarchyConfig[field]])
      ),
      activeNodeSortedIndexPolicyMode:
        hierarchyConfig.activeNodeSortedIndexPolicyMode,
      lawNeighborTraversalPolicyMode:
        hierarchyConfig.lawNeighborTraversalPolicyMode,
      lawNeighborCandidateReadbackMode:
        hierarchyConfig.lawNeighborCandidateReadbackMode
    });

    try {
      const result = await runUlgMechanicsResidentStageWorkerSchedulePayload(
        schedulePayload(
          workerSchroederStageContext(
            fixture.device,
            fixture.buffers,
            fixture.stageOptions
          ),
          { stepCount: 1, scheduleId: `ulg:test:${suffix}-schedule` },
          laneOptions
        )
      );
      assert.equal(result.status, 'worker-resident-schedule-completed');
      assert.equal(fixture.runnerCalls.length, 1);
      for (const field of executableFields) {
        assert.equal(
          fixture.runnerCalls[0][field],
          enabled,
          `${field} must reach the hierarchy runner as ${enabled}`
        );
      }
      assert.equal(
        fixture.runnerCalls[0].activeNodeSortedIndexPolicyMode ?? null,
        hierarchyConfig.activeNodeSortedIndexPolicyMode
      );
      assert.equal(
        fixture.runnerCalls[0].lawNeighborTraversalPolicyMode ?? null,
        hierarchyConfig.lawNeighborTraversalPolicyMode
      );
      assert.equal(
        fixture.runnerCalls[0].lawNeighborCandidateReadbackMode ?? null,
        hierarchyConfig.lawNeighborCandidateReadbackMode
      );
      assert.deepEqual(
        result.perStepSummaries.lastStep.hierarchyStageSummary.hierarchyConfig,
        {
          schema: hierarchyConfig.schema,
          status: hierarchyConfig.status,
          signature: hierarchyConfig.signature,
          selectedLevel: 0,
          minLevel: 0,
          maxLevel: 0,
          enableTwoLevelMechanics: false,
          twoLevelMechanicsAuthority: 'observation',
          twoLevelFineSubstepCount: 1,
          enableMechanicsFieldPairV2: false,
          enablePortableSummary: enabled,
          enableActiveNodeIndex: enabled,
          enableActiveNodeSortedIndex: enabled,
          enableLawQueue: enabled,
          enableLawNeighborCandidates: enabled,
          enableCrossLevelCoupling: enabled,
          enablePhaseVolumeMigration: enabled
        }
      );
      structuredClone(result);
    } finally {
      releaseUlgMechanicsResidentStageWorkerLane(laneOptions);
    }
  }
});

test('ULG resident stage worker runs a batched resident schedule with a fresh sealed epoch per step', async () => {
  const fixture = workerScheduleFixture({ laneSuffix: 'batch' });
  fixture.stageOptions.schroederSameLevelMechanics.residentStepOptions = {
    mechanicsMaterialTable: {
      schema: 'peercompute.ulg.mls-mpm-mechanics-material-table.v0',
      phaseRecordCount: 1,
      records: new Float32Array([1, 2, 3, 4])
    }
  };
  fixture.stageOptions.schroederSameLevelMechanics
    .stageMechanicsTraceEnabled = true;
  const laneOptions = {
    laneId: 'ulg:test:schroeder-schedule-batch-lane',
    stateKey: 'ulg:test:schroeder-schedule-batch-state'
  };
  const progressEnvelopes = [];
  const result = await runUlgMechanicsResidentStageWorkerSchedulePayload(
    schedulePayload(
      workerSchroederStageContext(fixture.device, fixture.buffers, fixture.stageOptions),
      { stepCount: 3, scheduleId: 'ulg:test:schedule-batch' },
      laneOptions
    ),
    { postProgress: (progress) => progressEnvelopes.push(progress) }
  );
  assert.equal(result.schema, ULG_WORKER_RESIDENT_SCHEDULE_RESULT_SCHEMA);
  assert.equal(result.status, 'worker-resident-schedule-completed');
  assert.equal(result.scheduleId, 'ulg:test:schedule-batch');
  assert.equal(result.cancelled, false);
  assert.equal(result.requestedStepCount, 3);
  assert.equal(result.completedStepCount, 3);
  assert.equal(
    result.queueDrainIntervalSteps,
    ULG_WORKER_RESIDENT_SCHEDULE_QUEUE_DRAIN_INTERVAL_STEPS
  );
  assert.equal(result.queueDrainCheckpointCount, 0);
  assert.deepEqual(result.queueDrainCheckpoints, []);
  assert.equal(fixture.runnerCalls.length, 3);
  const mechanicsStaticUploads = fixture.device.queue.writeBufferCalls.filter(
    (call) => call.buffer?.label
      === 'ulg-mls-mpm-mechanics-material-phase-records'
  );
  assert.equal(
    mechanicsStaticUploads.length,
    1,
    'the worker lane must upload an immutable mechanics phase table only once'
  );
  const retainedMechanicsUpload =
    fixture.runnerCalls[0].residentStepOptions.mechanicsRefreshOptions
      .mechanicsMaterialPhaseUpload;
  assert.ok(retainedMechanicsUpload?.recordsBuffer);
  fixture.runnerCalls.forEach((call, index) => {
    assert.equal(
      call.enableCanonicalSingleLevelQueueOrderedCleanup,
      true,
      'the private schedule must authenticate queue-ordered single-level cleanup'
    );
    assert.equal(
      call.residentStepOptions.summaryRunner,
      null,
      'the private no-readback schedule must suppress the default compact summary map'
    );
    assert.equal(
      call.residentStepOptions.stageMechanicsTraceEnabled,
      index === fixture.runnerCalls.length - 1,
      'schedule-scoped mechanics tracing must run only for the published terminal step'
    );
    assert.equal(
      call.residentStepOptions.mechanicsRefreshOptions
        .mechanicsMaterialPhaseUpload,
      retainedMechanicsUpload,
      'every step must reuse the same lane-local mechanics table upload'
    );
  });

  // One progress envelope per step (progressEverySteps defaults to 1), with
  // monotonically advancing epoch identity words and no GPU buffers.
  assert.equal(progressEnvelopes.length, 3);
  progressEnvelopes.forEach((progress, index) => {
    assert.equal(progress.schema, ULG_WORKER_RESIDENT_SCHEDULE_PROGRESS_SCHEMA);
    assert.equal(progress.scheduleId, 'ulg:test:schedule-batch');
    assert.equal(progress.stepOrdinal, index + 1);
    assert.equal(progress.completedStepCount, index + 1);
    assert.equal(progress.epochIdentity.positionEpoch, 17 + index);
    assert.equal(progress.epochIdentity.physicsTick, 13 + index);
    assert.equal(progress.epochIdentity.storageGeneration, 11 + index);
    if (index > 0) {
      assert.ok(
        progress.epochIdentity.positionEpoch
          > progressEnvelopes[index - 1].epochIdentity.positionEpoch
      );
      assert.ok(
        progress.epochIdentity.physicsTick
          > progressEnvelopes[index - 1].epochIdentity.physicsTick
      );
    }
    assert.equal(
      progress.stepSummary.schema,
      ULG_WORKER_RESIDENT_SCHEDULE_STEP_SUMMARY_SCHEMA
    );
    assert.equal(progress.stepSummary.stepOrdinal, index + 1);
    assert.equal(progress.stepSummary.epochConsumed, true);
    assert.equal(
      progress.stepSummary.epochReleaseMode,
      'queue-ordered-after-final-consumer-no-host-fence'
    );
    assert.equal(progress.stepSummary.gpuFenceSatisfied, false);
    assert.equal(
      progress.stepSummary.gpuFenceStatus,
      'gpu-fence-deferred-to-resident-schedule-terminal'
    );
    assert.equal(progress.stepSummary.sameWorkerQueueOrdered, true);
    assert.equal(progress.stepSummary.terminalScheduleFenceSatisfied, false);
    assert.equal(progress.stepSummary.authorityAdmissionReady, false);
    assert.equal(
      progress.stepSummary.hierarchyStageSummary
        .residentStageTiming.compactSummaryRequested,
      false
    );
    assert.equal(
      progress.stepSummary.hierarchyStageSummary
        .residentStageTiming.stageMs.compactSummary,
      0
    );
    assert.ok(Number.isFinite(progress.stepSummary.epochStageElapsedMs));
    assert.ok(Number.isFinite(progress.stepSummary.mechanicsStageElapsedMs));
    assert.ok(
      progress.stepSummary.stepElapsedMs
        >= progress.stepSummary.epochStageElapsedMs
          + progress.stepSummary.mechanicsStageElapsedMs
    );
    for (const ref of progress.stepSummary.retainedBufferRefs) {
      assert.match(ref, /^ulg-worker:/);
    }
    assertNoWorkerGpuBuffers(progress, `progress[${index}]`);
    structuredClone(progress);
  });

  // Every step consumed its own fresh sealed generation.
  assert.equal(result.perStepSummaries.ring.length, 3);
  assert.equal(result.perStepSummaries.droppedStepCount, 0);
  assert.equal(result.perStepSummaries.totalStepCount, 3);
  const generationIds = result.perStepSummaries.ring.map((entry) => entry.generationId);
  assert.equal(new Set(generationIds).size, 3);
  result.perStepSummaries.ring.forEach((entry, index) => {
    assert.equal(entry.stepOrdinal, index + 1);
    assert.equal(entry.positionEpoch, 17 + index);
    assert.equal(entry.physicsTick, 13 + index);
    assert.equal(entry.mechanicsStatus, 'worker-schroeder-same-level-mechanics-completed');
  });
  assert.equal(result.perStepSummaries.lastStep.stepOrdinal, 3);
  assert.equal(
    result.perStepSummaries.lastStep.hierarchyStageSummary
      .stageMechanicsTraceRequested,
    true
  );
  assert.deepEqual(
    result.perStepSummaries.lastStep.hierarchyStageSummary
      .stageMechanicsTrace,
    {
      schema: 'peercompute.ulg.test-stage-mechanics-trace.v0',
      status: 'test-stage-mechanics-trace-ready',
      ordinal: 3
    }
  );
  assert.deepEqual(
    result.perStepSummaries.lastStep.hierarchyStageSummary
      .canonicalSpatialAuthorityTrace,
    {
      schema: 'peercompute.ulg.test-canonical-authority-trace.v0',
      status: 'test-canonical-authority-trace-admitted',
      ordinal: 3
    }
  );
  assert.equal(
    result.perStepSummaries.lastStep.epochSeal.schema,
    ULG_WORKER_SCHROEDER_EPOCH_SEAL_SCHEMA
  );
  assert.equal(result.finalEpochIdentity.positionEpoch, 19);
  assert.equal(result.finalEpochIdentity.physicsTick, 15);
  assert.equal(result.finalEpochIdentity.storageGeneration, 13);
  assert.ok(result.retainedBufferRefs.length > 0);
  for (const ref of result.retainedBufferRefs) {
    assert.match(ref, /^ulg-worker:/);
  }
  assert.equal(result.gpuFence.fenceSatisfied, true);
  assert.equal(result.gpuFence.terminalScheduleFence, true);
  assert.equal(result.gpuFence.scope, 'resident-schedule-terminal');
  assert.equal(result.gpuFence.authorityAdmissionReady, true);
  assert.equal(result.gpuFence.scheduleId, 'ulg:test:schedule-batch');
  assert.equal(result.gpuFence.completedStepCount, 3);
  assert.equal(
    result.gpuFence.queueCompletionMethod,
    'worker-device.queue.onSubmittedWorkDone'
  );
  assert.equal(
    result.perStepSummaries.lastStep.coveredByScheduleTerminalFence,
    true
  );
  assert.equal(
    result.perStepSummaries.lastStep.terminalScheduleFenceSatisfied,
    true
  );
  assert.equal(result.perStepSummaries.lastStep.stageFenceSatisfied, false);
  assert.equal(result.perStepSummaries.lastStep.gpuFenceSatisfied, true);
  assert.equal(
    result.perStepSummaries.lastStep.gpuFenceStatus,
    'gpu-fence-satisfied-by-resident-schedule-terminal'
  );
  assertNoWorkerGpuBuffers(result, 'scheduleResult');
  structuredClone(result);

  const retainedParticleState =
    resolveUlgMechanicsResidentStageWorkerRetainedParticleState({
      laneId: laneOptions.laneId,
      stateKey: laneOptions.stateKey,
      sourceStageId: 'schroederSameLevelMechanics'
    });
  assert.equal(retainedParticleState.status, 'worker-retained-particle-state-ready');
  assert.equal(
    retainedParticleState.retainedThermoBufferSourceStage,
    'schroederSameLevelMechanics'
  );
  assert.equal(retainedParticleState.retainedThermoBufferSeededFromCpu, false);
  assert.equal(retainedParticleState.retainedThermoBufferCopySrc, true);
  assert.ok(retainedParticleState.mechanicsBufferByteLength > 0);
  const retainedParticleStateWithStaleCallerShape =
    resolveUlgMechanicsResidentStageWorkerRetainedParticleState({
      laneId: laneOptions.laneId,
      stateKey: laneOptions.stateKey,
      sourceStageId: 'schroederSameLevelMechanics',
      particleCount: 1,
      stateStrideFloats: 1,
      thermoStrideFloats: 1,
      stateByteLength: 4,
      thermoByteLength: 4
    });
  assert.equal(
    retainedParticleStateWithStaleCallerShape.particleCount,
    retainedParticleState.particleCount
  );
  assert.equal(
    retainedParticleStateWithStaleCallerShape.stateBufferByteLength,
    retainedParticleState.stateBufferByteLength
  );
  assert.equal(
    retainedParticleStateWithStaleCallerShape.thermoBufferByteLength,
    retainedParticleState.thermoBufferByteLength
  );

  const retainedSnapshot =
    await exportUlgMechanicsResidentStageWorkerRetainedCompactSnapshot({
      device: fixture.device,
      laneId: laneOptions.laneId,
      stateKey: laneOptions.stateKey,
      sourceStageId: 'schroederSameLevelMechanics',
      particleCount: fixture.particleCount,
      step: result.completedStepCount,
      time: result.completedStepCount * 0.001
    });
  assert.equal(retainedSnapshot.status, 'worker-retained-compact-snapshot-exported');
  assert.equal(retainedSnapshot.thermoSource, 'worker-retained-thermo-gpu-readback');
  assert.equal(retainedSnapshot.retainedThermoBufferSeededFromCpu, false);
  assert.equal(retainedSnapshot.retainedThermoBufferCopySrc, true);
  assert.equal(
    retainedSnapshot.compactBufferSnapshot.sharedSlotIdentityVerified,
    true
  );
  assert.deepEqual(retainedSnapshot.compactBufferSnapshot.sphSlotIdentity, {
    slot: 1,
    sourceSlot: 0,
    nextSlot: 1
  });
  assert.deepEqual(
    retainedSnapshot.compactBufferSnapshot.mechanicsSlotIdentity,
    retainedSnapshot.compactBufferSnapshot.sphSlotIdentity
  );
  assert.equal(retainedSnapshot.compactBufferSnapshot.topologyEpoch, 19);
  assert.equal(
    retainedSnapshot.compactBufferSnapshot.identityRevision,
    'worker-schedule-fixture-identity'
  );
  assert.equal(retainedSnapshot.compactBufferSnapshot.identityRequired, true);
  assert.equal(
    retainedSnapshot.compactBufferSnapshot.identitySchema,
    ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA
  );
  assert.equal(
    retainedSnapshot.compactBufferSnapshot.identityStrideUints,
    SPH_GPU_PARTICLE_IDENTITY_UINTS
  );
  assert.equal(
    retainedSnapshot.compactBufferSnapshot.identityStrideBytes,
    SPH_GPU_PARTICLE_IDENTITY_UINTS * Uint32Array.BYTES_PER_ELEMENT
  );
  assert.equal(
    retainedSnapshot.compactBufferSnapshot.sphIdentityByteLength,
    fixture.identityRows.byteLength
  );
  assert.ok(
    retainedSnapshot.compactBufferSnapshot.sphIdentity instanceof Uint32Array
  );
  assert.deepEqual(
    [...retainedSnapshot.compactBufferSnapshot.sphIdentity],
    [...fixture.identityRows]
  );
  assert.deepEqual(retainedSnapshot.compactBufferSnapshot.renderDomainKeys, {
    101: 'worker-schedule-body-one',
    202: 'worker-schedule-body-two'
  });
  assert.equal(
    retainedSnapshot.sphIdentityByteLength,
    fixture.identityRows.byteLength
  );
  assert.equal(
    retainedSnapshot.readbackByteLength,
    retainedSnapshot.sphStateByteLength
      + retainedSnapshot.sphThermoByteLength
      + retainedSnapshot.sphIdentityByteLength
      + retainedSnapshot.mlsMpmMechanicsByteLength
  );
  assert.equal(
    retainedSnapshot.compactBufferSnapshot.workerLineageMetadata.status,
    'worker-retained-compact-snapshot-lineage-metadata-ready'
  );
  assert.deepEqual(
    retainedSnapshot.compactBufferSnapshot.sphPhaseCarrierPlan,
    fixture.phaseCarrierPlan
  );
  assert.deepEqual(
    retainedSnapshot.compactBufferSnapshot.mechanicsPhaseCarrierPlan,
    fixture.phaseCarrierPlan
  );

  // The steps chained: step N's mechanics consumed step N-1's post-step
  // buffers, and each mechanics stage consumed that step's own generation.
  assert.equal(
    fixture.runnerCalls[1].sphParticleUpload.stateBuffer.label,
    'worker-ss-schedule-batch-next-state-1'
  );
  assert.equal(
    fixture.runnerCalls[2].sphParticleUpload.stateBuffer.label,
    'worker-ss-schedule-batch-next-state-2'
  );
  assert.equal(
    fixture.runnerCalls[1].spatialEpochGeneration.execution.positionEpoch,
    18
  );
  assert.equal(
    fixture.runnerCalls[2].spatialEpochGeneration.execution.positionEpoch,
    19
  );
});

test('ULG resident stage worker blocks compact export from a short explicit identity buffer', async () => {
  const fixture = workerScheduleFixture({ laneSuffix: 'short-identity' });
  const laneOptions = {
    laneId: 'ulg:test:schroeder-short-identity-lane',
    stateKey: 'ulg:test:schroeder-short-identity-state'
  };
  const mechanicsRunner = fixture.stageOptions.schroederSameLevelMechanics
    .schroederSameLevelMechanicsRunner;
  fixture.stageOptions.schroederSameLevelMechanics
    .schroederSameLevelMechanicsRunner = async (args) => {
      const result = await mechanicsRunner(args);
      result.residentStep.nextParticleUploads.sphParticleUpload.identityBuffer =
        fixture.taggedBuffer(
          'worker-ss-schedule-short-identity-truncated',
          fixture.identityRows.byteLength - Uint32Array.BYTES_PER_ELEMENT
        );
      return result;
    };

  try {
    const scheduleResult =
      await runUlgMechanicsResidentStageWorkerSchedulePayload(
        schedulePayload(
          workerSchroederStageContext(
            fixture.device,
            fixture.buffers,
            fixture.stageOptions
          ),
          { stepCount: 1, scheduleId: 'ulg:test:schedule-short-identity' },
          laneOptions
        )
      );
    assert.equal(scheduleResult.status, 'worker-resident-schedule-completed');

    const exported =
      await exportUlgMechanicsResidentStageWorkerRetainedCompactSnapshot({
        device: fixture.device,
        laneId: laneOptions.laneId,
        stateKey: laneOptions.stateKey,
        sourceStageId: 'schroederSameLevelMechanics',
        particleCount: fixture.particleCount,
        step: 1,
        time: 0.001
      });

    assert.equal(
      exported.status,
      'worker-retained-compact-snapshot-export-blocked'
    );
    assert.equal(
      exported.reason,
      'worker-retained-compact-snapshot-readback-failed'
    );
    assert.match(
      exported.errorMessage,
      /sph-identity readback requires a retained source buffer/
    );
  } finally {
    releaseUlgMechanicsResidentStageWorkerLane({
      ...laneOptions,
      reason: 'short identity export test complete'
    });
  }
});

test('ULG resident schedules preserve one exact static mechanics table across continuation payloads', async () => {
  const fixture = workerScheduleFixture({
    laneSuffix: 'static-mechanics-table-continuation'
  });
  const mechanicsMaterialTable = {
    schema: 'peercompute.ulg.mls-mpm-mechanics-material-table.v0',
    phaseRecordCount: 1,
    records: new Float32Array([1, 2, 3, 4])
  };
  const laneOptions = {
    laneId: 'ulg:test:static-mechanics-table-continuation-lane',
    stateKey: 'ulg:test:static-mechanics-table-continuation-state'
  };
  fixture.stageOptions.schroederSameLevelMechanics.residentStepOptions = {
    mechanicsMaterialTable
  };

  await runUlgMechanicsResidentStageWorkerSchedulePayload(
    schedulePayload(
      workerSchroederStageContext(
        fixture.device,
        fixture.buffers,
        fixture.stageOptions
      ),
      { stepCount: 1, scheduleId: 'ulg:test:static-table-schedule-1' },
      laneOptions
    )
  );
  const retainedUpload = fixture.runnerCalls[0].residentStepOptions
    .mechanicsRefreshOptions.mechanicsMaterialPhaseUpload;

  fixture.stageOptions.schroederSameLevelMechanics.residentStepOptions = {};
  await runUlgMechanicsResidentStageWorkerSchedulePayload(
    schedulePayload(
      workerSchroederStageContext(
        fixture.device,
        fixture.buffers,
        fixture.stageOptions
      ),
      { stepCount: 1, scheduleId: 'ulg:test:static-table-schedule-2' },
      laneOptions
    )
  );
  assert.strictEqual(
    fixture.runnerCalls[1].residentStepOptions.mechanicsMaterialTable,
    mechanicsMaterialTable
  );
  assert.strictEqual(
    fixture.runnerCalls[1].residentStepOptions.mechanicsRefreshOptions
      .mechanicsMaterialPhaseUpload,
    retainedUpload
  );
  assert.equal(
    diagnoseUploadedMechanicsMaterialPhaseRecordsMatch(
      retainedUpload,
      fixture.runnerCalls[1].residentStepOptions.mechanicsMaterialTable,
      fixture.device
    ).matches,
    true
  );

  fixture.stageOptions.schroederSameLevelMechanics.residentStepOptions = {
    mechanicsMaterialTable: {
      ...mechanicsMaterialTable,
      records: new Float32Array([1, 2, 3, 5])
    }
  };
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerSchedulePayload(
      schedulePayload(
        workerSchroederStageContext(
          fixture.device,
          fixture.buffers,
          fixture.stageOptions
        ),
        { stepCount: 1, scheduleId: 'ulg:test:static-table-schedule-3' },
        laneOptions
      )
    ),
    (error) => {
      assert.equal(
        error?.residentScheduleError?.reason,
        'static-mechanics-material-phase-authority-drift'
      );
      assert.equal(
        error?.residentScheduleError?.scheduleId,
        'ulg:test:static-table-schedule-3'
      );
      assert.equal(error?.residentScheduleError?.stepOrdinal, 1);
      assert.equal(
        error?.residentScheduleError?.authorityDiagnostics
          ?.materialUpload?.fingerprintMatch,
        false
      );
      return true;
    }
  );
  assert.equal(
    fixture.runnerCalls.length,
    2,
    'a drifted static table must fail before the mechanics kernel runs'
  );
  releaseUlgMechanicsResidentStageWorkerLane({
    ...laneOptions,
    reason: 'static mechanics table continuation test complete'
  });
});

test('ULG resident schedule aggregates exact surface-stress evidence without retaining every step receipt', async () => {
  const run = async ({ laneSuffix, invalidSurfaceStressAtStep = null }) => {
    const fixture = workerScheduleFixture({
      laneSuffix,
      withSurfaceStressEvidence: true,
      invalidSurfaceStressAtStep
    });
    fixture.stageOptions.schroederSameLevelMechanics.residentStepOptions = {
      mechanicsMaterialTable: {
        schema: 'peercompute.ulg.mls-mpm-mechanics-material-table.v0',
        phaseRecordCount: 1,
        surfaceTensionEnabled: true,
        positiveSurfaceTensionPhaseRecordCount: 1,
        surfaceTensionCoefficientStatus:
          'positive-surface-tension-coefficient-ready',
        records: new Float32Array([1, 2, 3, 4])
      }
    };
    return runUlgMechanicsResidentStageWorkerSchedulePayload(
      schedulePayload(
        workerSchroederStageContext(
          fixture.device,
          fixture.buffers,
          fixture.stageOptions
        ),
        { stepCount: 3, scheduleId: `ulg:test:${laneSuffix}` },
        {
          laneId: `ulg:test:${laneSuffix}-lane`,
          stateKey: `ulg:test:${laneSuffix}-state`
        }
      )
    );
  };

  const exact = await run({ laneSuffix: 'surface-stress-exact' });
  const exactEvidence =
    exact.perStepSummaries.phaseVolumeSurfaceStress;
  assert.equal(
    exactEvidence.schema,
    'peercompute.ulg.worker-resident-schedule-surface-stress-evidence.v0'
  );
  assert.equal(exactEvidence.required, true);
  assert.equal(exactEvidence.observedStepCount, 3);
  assert.equal(exactEvidence.expectedSubmissionCount, 3);
  assert.equal(exactEvidence.exactSubmissionCount, 3);
  assert.equal(exactEvidence.submissionEvidenceComplete, true);
  assert.equal(exactEvidence.firstIncompleteStepOrdinal, null);
  assert.equal(exactEvidence.finalSubmissionStepOrdinal, 3);
  assert.equal(exactEvidence.finalSubmission.dispatchCount, 18);

  const inexact = await run({
    laneSuffix: 'surface-stress-inexact',
    invalidSurfaceStressAtStep: 2
  });
  const inexactEvidence =
    inexact.perStepSummaries.phaseVolumeSurfaceStress;
  assert.equal(inexactEvidence.exactSubmissionCount, 2);
  assert.equal(inexactEvidence.submissionEvidenceComplete, false);
  assert.equal(inexactEvidence.firstIncompleteStepOrdinal, 2);
  assert.equal(inexactEvidence.finalSubmissionStepOrdinal, 3);
});

test('ULG resident schedule two-level evidence remains complete beyond the summary ring', async () => {
  const run = async ({
    laneSuffix,
    stepCount,
    invalidCommitAt = null,
    invalidCflAt = null,
    requestedCflFactor = 0.8
  }) => {
    const fixture = workerScheduleFixture({
      laneSuffix,
      withTwoLevelEvidence: true,
      invalidTwoLevelCommitAtStep: invalidCommitAt,
      invalidTwoLevelCflFactorAtStep: invalidCflAt
    });
    for (const stageId of [
      'schroederSpatialEpoch',
      'schroederSameLevelMechanics'
    ]) {
      fixture.stageOptions[stageId].enableTwoLevelMechanics = true;
      fixture.stageOptions[stageId].twoLevelMechanicsAuthority =
        'authoritative';
      fixture.stageOptions[stageId].twoLevelFineSubstepCount = 2;
    }
    fixture.stageOptions.schroederSameLevelMechanics.cflFactor =
      requestedCflFactor;
    const result = await runUlgMechanicsResidentStageWorkerSchedulePayload(
      schedulePayload(
        workerSchroederStageContext(
          fixture.device,
          fixture.buffers,
          fixture.stageOptions
        ),
        { stepCount, scheduleId: `ulg:test:${laneSuffix}` },
        {
          laneId: `ulg:test:${laneSuffix}-lane`,
          stateKey: `ulg:test:${laneSuffix}-state`
        }
      )
    );
    return { fixture, result };
  };

  const { result: exact } = await run({
    laneSuffix: 'two-level-evidence-exact',
    stepCount: 33
  });
  assert.equal(exact.perStepSummaries.ring.length, 32);
  assert.equal(exact.perStepSummaries.droppedStepCount, 1);
  const exactEvidence = exact.perStepSummaries.twoLevelMechanics;
  assert.equal(
    exactEvidence.schema,
    'peercompute.ulg.worker-resident-schedule-two-level-mechanics-evidence.v0'
  );
  assert.equal(exactEvidence.observedStepCount, 33);
  assert.equal(exactEvidence.exactAuthoritativeStepCount, 33);
  assert.equal(exactEvidence.cflFactorEvidenceRequired, true);
  assert.equal(exactEvidence.cflFactorRequested, 0.8);
  assert.equal(exactEvidence.cflFactorObservedStepCount, 33);
  assert.equal(exactEvidence.exactCflFactorCount, 33);
  assert.equal(exactEvidence.firstCflFactorMismatchStepOrdinal, null);
  assert.equal(exactEvidence.lastCflFactor, 0.8);
  assert.equal(exactEvidence.lastStep.twoLevelCflFactor, 0.8);
  assert.equal(exactEvidence.coverageComplete, true);
  assert.equal(exactEvidence.firstIncompleteStepOrdinal, null);
  assert.equal(exactEvidence.terminalRefluxReceiptRequired, true);
  assert.equal(exactEvidence.terminalRefluxAdmittedStepCount, 33);
  assert.equal(
    exactEvidence.terminalRefluxReceipt.status,
    'terminal-reflux-schedule-receipt-admitted'
  );

  await assert.rejects(
    run({
      laneSuffix: 'two-level-evidence-inexact',
      stepCount: 3,
      invalidCommitAt: 2
    }),
    (error) => {
      assert.equal(
        error?.residentScheduleError?.reason,
        'schedule-terminal-reflux-receipt-rejected'
      );
      const receipt = error?.residentScheduleError?.terminalGpuFence
        ?.terminalRefluxReceipt;
      assert.equal(receipt?.status, 'terminal-reflux-receipt-rejected');
      assert.equal(receipt?.expectedStepCount, 3);
      assert.equal(receipt?.observedStepCount, 3);
      assert.equal(receipt?.admittedStepCount, 2);
      assert.equal(receipt?.firstRejectedStepOrdinal, 2);
      assert.equal(
        receipt?.firstRejectedDiagnostic?.mutationRollbackCount,
        1
      );
      return true;
    }
  );

  await assert.rejects(
    run({
      laneSuffix: 'two-level-cfl-inexact',
      stepCount: 3,
      invalidCflAt: 2
    }),
    (error) => {
      assert.equal(
        error?.residentScheduleError?.reason,
        'schedule-two-level-mechanics-evidence-incomplete'
      );
      const evidence = error?.residentScheduleError
        ?.twoLevelMechanicsEvidence;
      assert.equal(evidence?.cflFactorRequested, 0.8);
      assert.equal(evidence?.cflFactorObservedStepCount, 3);
      assert.equal(evidence?.exactCflFactorCount, 2);
      assert.equal(evidence?.firstCflFactorMismatchStepOrdinal, 2);
      assert.equal(evidence?.coverageComplete, false);
      return true;
    }
  );

  const invalidFixture = workerScheduleFixture({
    laneSuffix: 'two-level-cfl-invalid-input',
    withTwoLevelEvidence: true
  });
  for (const stageId of [
    'schroederSpatialEpoch',
    'schroederSameLevelMechanics'
  ]) {
    invalidFixture.stageOptions[stageId].enableTwoLevelMechanics = true;
    invalidFixture.stageOptions[stageId].twoLevelMechanicsAuthority =
      'authoritative';
  }
  invalidFixture.stageOptions.schroederSameLevelMechanics.cflFactor = 0;
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerSchedulePayload(
      schedulePayload(
        workerSchroederStageContext(
          invalidFixture.device,
          invalidFixture.buffers,
          invalidFixture.stageOptions
        ),
        {
          stepCount: 1,
          scheduleId: 'ulg:test:two-level-cfl-invalid-input'
        },
        {
          laneId: 'ulg:test:two-level-cfl-invalid-input-lane',
          stateKey: 'ulg:test:two-level-cfl-invalid-input-state'
        }
      )
    ),
    (error) => {
      assert.equal(
        error?.residentScheduleError?.reason,
        'schedule-two-level-cfl-factor-invalid'
      );
      return true;
    }
  );
  assert.equal(invalidFixture.runnerCalls.length, 0);
});

test('ULG resident schedule preserves dynamic product history while reapplying seed-time static options', async () => {
  const fixture = workerScheduleFixture({
    laneSuffix: 'static-options-product-history',
    withCarriedResidentProductMass: true
  });
  fixture.stageOptions.schroederSameLevelMechanics.residentStepOptions = {
    internalPressureScale: 0.75,
    reactionStepOptions: {
      enableReactions: true
    }
  };

  const result = await runUlgMechanicsResidentStageWorkerSchedulePayload(
    schedulePayload(
      workerSchroederStageContext(
        fixture.device,
        fixture.buffers,
        fixture.stageOptions
      ),
      {
        stepCount: 3,
        scheduleId: 'ulg:test:static-options-product-history'
      },
      {
        laneId: 'ulg:test:static-options-product-history-lane',
        stateKey: 'ulg:test:static-options-product-history-state'
      }
    )
  );

  assert.equal(result.completedStepCount, 3);
  assert.equal(fixture.runnerCalls.length, 3);
  assert.equal(
    fixture.runnerCalls[0].residentStepOptions.residentProductMass,
    undefined,
    'the fresh seed has no prior product-history owner'
  );
  assert.strictEqual(
    fixture.runnerCalls[1].residentStepOptions.residentProductMass,
    fixture.residentProductMasses[0],
    'step 2 consumes the exact product-history owner committed by step 1'
  );
  assert.strictEqual(
    fixture.runnerCalls[2].residentStepOptions.residentProductMass,
    fixture.residentProductMasses[1],
    'step 3 consumes the exact product-history owner committed by step 2'
  );
  for (const call of fixture.runnerCalls) {
    assert.equal(call.residentStepOptions.internalPressureScale, 0.75);
    assert.equal(call.residentStepOptions.reactionStepOptions.enableReactions, true);
  }
});

test('ULG short resident schedule crosses epoch arena capacity behind one terminal host fence', async () => {
  const fixture = workerScheduleFixture({ laneSuffix: 'one-terminal-fence' });
  fixture.stageOptions.schroederSpatialEpoch.spatialEpochArenaCount = 2;
  const progressEnvelopes = [];
  let resolveTerminalFence;
  const terminalFencePromise = new Promise((resolve) => {
    resolveTerminalFence = resolve;
  });
  let submittedWorkDoneCount = 0;
  fixture.device.queue.onSubmittedWorkDone = () => {
    submittedWorkDoneCount += 1;
    return terminalFencePromise;
  };
  const laneOptions = {
    laneId: 'ulg:test:one-terminal-fence-lane',
    stateKey: 'ulg:test:one-terminal-fence-state'
  };
  let scheduleSettled = false;
  const schedulePromise = runUlgMechanicsResidentStageWorkerSchedulePayload(
    schedulePayload(
      workerSchroederStageContext(
        fixture.device,
        fixture.buffers,
        fixture.stageOptions
      ),
      { stepCount: 5, scheduleId: 'ulg:test:one-terminal-fence' },
      laneOptions
    ),
    { postProgress: (progress) => progressEnvelopes.push(progress) }
  ).finally(() => {
    scheduleSettled = true;
  });

  for (let attempt = 0; attempt < 100 && progressEnvelopes.length < 5; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  assert.equal(fixture.runnerCalls.length, 5);
  assert.equal(progressEnvelopes.length, 5);
  assert.equal(scheduleSettled, false);
  assert.equal(submittedWorkDoneCount, 1);
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerSchedulePayload(
      schedulePayload(
        workerSchroederStageContext(
          fixture.device,
          fixture.buffers,
          fixture.stageOptions
        ),
        { stepCount: 1, scheduleId: 'ulg:test:one-terminal-fence-overlap' },
        laneOptions
      )
    ),
    /lane-schedule-already-active/
  );
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerPayload(payload(
      stage(
        'schroederSpatialEpoch',
        ['schroeder-level-assignment'],
        ['schroeder-spatial-epoch']
      ),
      workerSchroederStageContext(
        fixture.device,
        fixture.buffers,
        fixture.stageOptions
      ),
      null,
      laneOptions
    )),
    (error) => error?.code === 'ERR_ULG_WORKER_RESIDENT_SCHEDULE_LANE_BUSY'
  );

  resolveTerminalFence();
  const result = await schedulePromise;
  assert.equal(result.completedStepCount, 5);
  assert.equal(result.gpuFence.terminalScheduleFence, true);
  assert.equal(result.gpuFence.fenceSatisfied, true);
  assert.equal(submittedWorkDoneCount, 1);
});

test('ULG resident schedule bounds queued work with non-authoritative 16-step drain checkpoints', async () => {
  const fixture = workerScheduleFixture({ laneSuffix: 'bounded-queue-drain' });
  const stepCount = ULG_WORKER_RESIDENT_SCHEDULE_QUEUE_DRAIN_INTERVAL_STEPS + 1;
  const result = await runUlgMechanicsResidentStageWorkerSchedulePayload(
    schedulePayload(
      workerSchroederStageContext(
        fixture.device,
        fixture.buffers,
        fixture.stageOptions
      ),
      { stepCount, scheduleId: 'ulg:test:bounded-queue-drain' },
      {
        laneId: 'ulg:test:bounded-queue-drain-lane',
        stateKey: 'ulg:test:bounded-queue-drain-state'
      }
    )
  );

  assert.equal(result.completedStepCount, stepCount);
  assert.equal(result.queueDrainCheckpointCount, 1);
  assert.equal(result.queueDrainCheckpoints.length, 1);
  const [checkpoint] = result.queueDrainCheckpoints;
  assert.equal(
    checkpoint.completedStepCount,
    ULG_WORKER_RESIDENT_SCHEDULE_QUEUE_DRAIN_INTERVAL_STEPS
  );
  assert.equal(checkpoint.scope, 'resident-schedule-queue-drain-checkpoint');
  assert.equal(checkpoint.terminalScheduleFence, false);
  assert.equal(checkpoint.fenceSatisfied, true);
  assert.equal(checkpoint.authorityAdmissionReady, false);
  assert.equal(checkpoint.stateManagerCommitReady, false);
  assert.equal(
    checkpoint.queueCompletionMethod,
    'worker-device.queue.onSubmittedWorkDone'
  );
  assert.equal(result.gpuFence.terminalScheduleFence, true);
  assert.equal(result.gpuFence.fenceSatisfied, true);
  assert.equal(result.gpuFence.authorityAdmissionReady, true);
  assert.equal(
    fixture.device.queue.submittedWorkDoneCount,
    3,
    'the lagged drain starts a fence at the loop seed and after each '
      + 'satisfied checkpoint (awaited at the NEXT boundary), plus the '
      + 'terminal authority fence'
  );
  assertNoWorkerGpuBuffers(result, 'boundedQueueDrainScheduleResult');
  structuredClone(result);
});

test('ULG resident schedule fails closed and poisons the lane when a queue-drain checkpoint rejects', async () => {
  const fixture = workerScheduleFixture({ laneSuffix: 'queue-drain-fail' });
  let submittedWorkDoneCount = 0;
  fixture.device.queue.onSubmittedWorkDone = () => {
    submittedWorkDoneCount += 1;
    return Promise.reject(new Error('injected queue-drain checkpoint rejection'));
  };
  const laneOptions = {
    laneId: 'ulg:test:queue-drain-fail-lane',
    stateKey: 'ulg:test:queue-drain-fail-state'
  };
  const stepCount = ULG_WORKER_RESIDENT_SCHEDULE_QUEUE_DRAIN_INTERVAL_STEPS + 1;
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerSchedulePayload(
      schedulePayload(
        workerSchroederStageContext(
          fixture.device,
          fixture.buffers,
          fixture.stageOptions
        ),
        { stepCount, scheduleId: 'ulg:test:queue-drain-fail' },
        laneOptions
      )
    ),
    (error) => {
      const detail = error.residentScheduleError;
      assert.equal(
        detail?.reason,
        'schedule-queue-drain-checkpoint-unsatisfied'
      );
      assert.equal(
        detail?.stepOrdinal,
        ULG_WORKER_RESIDENT_SCHEDULE_QUEUE_DRAIN_INTERVAL_STEPS
      );
      assert.equal(detail?.queueDrainCheckpoint?.terminalScheduleFence, false);
      assert.equal(detail?.queueDrainCheckpoint?.fenceSatisfied, false);
      assert.match(
        detail?.queueDrainCheckpoint?.queueCompletionErrorMessage,
        /injected queue-drain checkpoint rejection/
      );
      assert.equal(detail?.terminalGpuFence?.terminalScheduleFence, true);
      assert.equal(
        detail?.terminalGpuFence?.terminalDerivedFromQueueDrainCheckpoint,
        true
      );
      assert.equal(detail?.terminalGpuFence?.fenceSatisfied, false);
      assert.equal(detail?.terminalGpuFence?.authorityAdmissionReady, false);
      return true;
    }
  );
  assert.equal(
    fixture.runnerCalls.length,
    ULG_WORKER_RESIDENT_SCHEDULE_QUEUE_DRAIN_INTERVAL_STEPS,
    'step 17 must never start after a failed step-16 drain'
  );
  assert.equal(
    submittedWorkDoneCount,
    1,
    'a failed checkpoint must not trigger a second blind terminal queue call'
  );
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerSchedulePayload(
      schedulePayload(
        workerSchroederStageContext(
          fixture.device,
          fixture.buffers,
          fixture.stageOptions
        ),
        { stepCount: 1, scheduleId: 'ulg:test:queue-drain-fail-reuse' },
        laneOptions
      )
    ),
    /lane-terminal-fence-poisoned/
  );
});

test('ULG resident schedule bridges hierarchy cleanup claims to the next submitted step', async () => {
  const fixture = workerScheduleFixture({
    laneSuffix: 'hierarchy-cleanup-bridge',
    withHierarchyCleanupClaims: true
  });
  const result = await runUlgMechanicsResidentStageWorkerSchedulePayload(
    schedulePayload(
      workerSchroederStageContext(
        fixture.device,
        fixture.buffers,
        fixture.stageOptions
      ),
      { stepCount: 5, scheduleId: 'ulg:test:hierarchy-cleanup-bridge' },
      {
        laneId: 'ulg:test:hierarchy-cleanup-bridge-lane',
        stateKey: 'ulg:test:hierarchy-cleanup-bridge-state'
      }
    )
  );

  assert.equal(result.completedStepCount, 5);
  assert.deepEqual(fixture.runnerCalls[0].queueOrderedProducerClaims, []);
  for (let index = 1; index < fixture.runnerCalls.length; index += 1) {
    assert.deepEqual(
      fixture.runnerCalls[index].queueOrderedProducerClaims,
      [fixture.hierarchyCleanupClaims[index - 1]]
    );
  }
  assert.equal(fixture.hierarchyCleanupObservations.length, 4);
  fixture.hierarchyCleanupObservations.forEach((observation, index) => {
    assert.strictEqual(
      observation.queueOrderedFinalConsumer,
      fixture.hierarchyFinalConsumers[index + 1]
    );
  });
  assert.equal(
    fixture.device.queue.submittedWorkDoneCount,
    1,
    'the terminal schedule fence is the only host queue fence'
  );

  const continuationResult =
    await runUlgMechanicsResidentStageWorkerSchedulePayload(
      schedulePayload(
        workerSchroederStageContext(
          fixture.device,
          fixture.buffers,
          fixture.stageOptions
        ),
        {
          stepCount: 2,
          scheduleId: 'ulg:test:hierarchy-cleanup-bridge-continuation'
        },
        {
          laneId: 'ulg:test:hierarchy-cleanup-bridge-lane',
          stateKey: 'ulg:test:hierarchy-cleanup-bridge-state'
        }
      )
    );
  assert.equal(continuationResult.completedStepCount, 2);
  assert.deepEqual(
    fixture.runnerCalls[5].queueOrderedProducerClaims,
    [fixture.hierarchyCleanupClaims[4]],
    'the first step of a later schedule consumes the prior batch terminal claim'
  );
  assert.strictEqual(
    fixture.hierarchyCleanupObservations[4].queueOrderedFinalConsumer,
    fixture.hierarchyFinalConsumers[5]
  );
  assert.equal(
    fixture.device.queue.submittedWorkDoneCount,
    2,
    'each schedule adds exactly its terminal host queue fence'
  );
});

test('ULG resident schedule preserves prior product mass when hierarchy final-consumer authority is missing', async () => {
  const fixture = workerScheduleFixture({
    laneSuffix: 'hierarchy-final-consumer-missing',
    withHierarchyCleanupClaims: true,
    omitHierarchyFinalConsumerAtStep: 2,
    withCarriedResidentProductMass: true
  });
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerSchedulePayload(
      schedulePayload(
        workerSchroederStageContext(
          fixture.device,
          fixture.buffers,
          fixture.stageOptions
        ),
        {
          stepCount: 2,
          scheduleId: 'ulg:test:hierarchy-final-consumer-missing'
        },
        {
          laneId: 'ulg:test:hierarchy-final-consumer-missing-lane',
          stateKey: 'ulg:test:hierarchy-final-consumer-missing-state'
        }
      )
    ),
    (error) => {
      assert.equal(
        error.residentScheduleError?.reason,
        'schedule-hierarchy-final-consumer-capability-missing'
      );
      assert.equal(error.residentScheduleError?.stepOrdinal, 2);
      assert.equal(
        error.residentScheduleError?.terminalGpuFence?.terminalScheduleFence,
        true
      );
      assert.equal(
        error.residentScheduleError?.terminalGpuFence?.fenceSatisfied,
        true
      );
      return true;
    }
  );

  assert.equal(fixture.runnerCalls.length, 2);
  assert.strictEqual(
    fixture.runnerCalls[1].residentStepOptions.residentProductMass,
    fixture.residentProductMasses[0],
    'step 2 consumes the exact product-mass handle committed by step 1'
  );
  assert.equal(
    fixture.residentProductMassDestroyCountByOrdinal.get(1) || 0,
    0,
    'the unadopted step cleanup preserves the prior committed handle'
  );
  assert.equal(
    fixture.residentProductMassDestroyCountByOrdinal.get(2),
    1,
    'the unadopted step may retire only its newly produced handle'
  );
});

test('ULG resident schedule rejects hierarchy claims whose cleanup authority did not seal', async () => {
  const fixture = workerScheduleFixture({
    laneSuffix: 'hierarchy-cleanup-ineligible',
    withHierarchyCleanupClaims: true,
    ineligibleHierarchyCleanupAtStep: 1
  });
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerSchedulePayload(
      schedulePayload(
        workerSchroederStageContext(
          fixture.device,
          fixture.buffers,
          fixture.stageOptions
        ),
        {
          stepCount: 2,
          scheduleId: 'ulg:test:hierarchy-cleanup-ineligible'
        },
        {
          laneId: 'ulg:test:hierarchy-cleanup-ineligible-lane',
          stateKey: 'ulg:test:hierarchy-cleanup-ineligible-state'
        }
      )
    ),
    (error) => {
      assert.equal(
        error.residentScheduleError?.reason,
        'schedule-hierarchy-cleanup-authority-missing'
      );
      assert.equal(error.residentScheduleError?.stepOrdinal, 1);
      assert.equal(
        error.residentScheduleError?.terminalGpuFence?.fenceSatisfied,
        true
      );
      return true;
    }
  );
  assert.equal(fixture.runnerCalls.length, 1);
});

test('ULG resident schedule keeps SS transport refs bounded across 256 persistent-lane steps', async () => {
  const fixture = workerScheduleFixture({ laneSuffix: 'bounded-transport-refs' });
  const laneOptions = {
    laneId: 'ulg:test:bounded-transport-refs-lane',
    stateKey: 'ulg:test:bounded-transport-refs-state'
  };
  const registryCounts = [];
  const progressRetainedRefs = [];
  const runSchedule = (scheduleId) =>
    runUlgMechanicsResidentStageWorkerSchedulePayload(
      schedulePayload(
        workerSchroederStageContext(
          fixture.device,
          fixture.buffers,
          fixture.stageOptions
        ),
        { stepCount: 128, scheduleId },
        laneOptions
      ),
      {
        postProgress: (progress) => {
          registryCounts.push(
            progress.stepSummary.retainedBufferRegistryEntryCount
          );
          progressRetainedRefs.push([
            ...progress.stepSummary.retainedBufferRefs
          ]);
        }
      }
    );

  const first = await runSchedule('ulg:test:bounded-transport-refs:first');
  const countAfterFirst = registryCounts.at(-1);
  const second = await runSchedule('ulg:test:bounded-transport-refs:second');
  const countAfterSecond = registryCounts.at(-1);

  assert.equal(first.completedStepCount, 128);
  assert.equal(second.completedStepCount, 128);
  assert.equal(registryCounts.length, 256);
  assert.ok(Number.isSafeInteger(countAfterFirst) && countAfterFirst > 0);
  assert.equal(countAfterSecond, countAfterFirst);
  assert.ok(
    registryCounts.every((count) => count === registryCounts[0]),
    'the registry reaches its fixed path-shaped bound on step 1'
  );
  assert.ok(
    registryCounts[0] <= 16,
    `the SS transport registry stays at a small explicit bound (got ${
      registryCounts[0]
    })`
  );
  assert.deepEqual(
    second.retainedBufferRefs,
    progressRetainedRefs.at(-1),
    'the terminal result exports only the final step transport refs'
  );
  assert.equal(
    progressRetainedRefs[0].some((ref) => second.retainedBufferRefs.includes(ref)),
    false,
    'superseded first-step refs are absent from the final result'
  );
  assert.equal(
    fixture.device.queue.submittedWorkDoneCount,
    18,
    'each 128-step schedule seeds one lagged-drain fence, starts one after '
      + 'each of its seven satisfied checkpoints, and closes with its '
      + 'terminal fence'
  );
});

test('ULG resident schedule rejects a non-WebGPU stage before terminal authority admission', async () => {
  const fixture = workerScheduleFixture({ laneSuffix: 'cpu-fallback' });
  const webGpuRunner =
    fixture.stageOptions.schroederSameLevelMechanics
      .schroederSameLevelMechanicsRunner;
  fixture.stageOptions.schroederSameLevelMechanics
    .schroederSameLevelMechanicsRunner = async (args) => {
      const result = await webGpuRunner(args);
      return {
        ...result,
        residentStep: { ...result.residentStep, backend: 'cpu' }
      };
    };
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerSchedulePayload(
      schedulePayload(
        workerSchroederStageContext(
          fixture.device,
          fixture.buffers,
          fixture.stageOptions
        ),
        { stepCount: 1, scheduleId: 'ulg:test:schedule-cpu-fallback' },
        {
          laneId: 'ulg:test:schedule-cpu-fallback-lane',
          stateKey: 'ulg:test:schedule-cpu-fallback-state'
        }
      )
    ),
    (error) => {
      assert.equal(
        error.residentScheduleError?.reason,
        'schedule-stage-terminal-fence-deferral-missing'
      );
      assert.equal(
        error.residentScheduleError?.terminalGpuFence?.fenceSatisfied,
        true
      );
      return true;
    }
  );
});

test('ULG resident stage worker schedule cancellation finishes the in-flight step and leaves the lane usable', async () => {
  const fixture = workerScheduleFixture({ laneSuffix: 'cancel' });
  const laneOptions = {
    laneId: 'ulg:test:schroeder-schedule-cancel-lane',
    stateKey: 'ulg:test:schroeder-schedule-cancel-state'
  };
  const scheduleId = 'ulg:test:schedule-cancel';
  // Cancelling an id with no active schedule is a truthful no-op.
  assert.equal(
    cancelUlgMechanicsResidentStageWorkerSchedule(scheduleId).cancelRequested,
    false
  );
  const progressEnvelopes = [];
  const result = await runUlgMechanicsResidentStageWorkerSchedulePayload(
    schedulePayload(
      workerSchroederStageContext(fixture.device, fixture.buffers, fixture.stageOptions),
      { stepCount: 3, scheduleId },
      laneOptions
    ),
    {
      postProgress: (progress) => {
        progressEnvelopes.push(progress);
        if (progress.stepOrdinal === 1) {
          setTimeout(() => {
            const ack = cancelUlgMechanicsResidentStageWorkerSchedule(scheduleId);
            assert.equal(ack.cancelRequested, true);
            assert.equal(ack.scheduleId, scheduleId);
          }, 0);
        }
      }
    }
  );
  assert.equal(result.status, 'worker-resident-schedule-cancelled');
  assert.equal(result.cancelled, true);
  // The in-flight step completes, then a real task yield admits the queued
  // cancel message before step 2 begins.
  assert.equal(result.completedStepCount, 1);
  assert.equal(result.completedStepCount, fixture.runnerCalls.length);
  assert.equal(result.completedStepCount, progressEnvelopes.length);
  assert.equal(result.perStepSummaries.ring.length, result.completedStepCount);
  assert.equal(
    result.finalEpochIdentity.positionEpoch,
    17 + (result.completedStepCount - 1)
  );
  assert.equal(result.gpuFence.terminalScheduleFence, true);
  assert.equal(result.gpuFence.fenceSatisfied, true);
  assert.equal(result.gpuFence.completedStepCount, 1);
  assert.equal(fixture.device.queue.submittedWorkDoneCount, 1);
  assertNoWorkerGpuBuffers(result, 'cancelledScheduleResult');
  structuredClone(result);

  // The lane is still usable by a follow-up single-stage message: the last
  // completed step consumed its epoch and retained its post-step buffers.
  const followUp = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage(
      'schroederSpatialEpoch',
      ['schroeder-level-assignment'],
      ['schroeder-spatial-epoch']
    ),
    workerSchroederStageContext(fixture.device, fixture.buffers, {
      schroederSpatialEpoch: {
        levelAssignment: fixture.levelAssignmentForStep(result.completedStepCount + 1),
        useWorkerRetainedParticleBuffers: true,
        particleIdentityStrideWords: 1,
        selectedLevel: 0,
        mechanicsGrid: fixture.mechanicsGrid,
        exactNearCellTreeEnabled: false
      }
    }),
    null,
    laneOptions
  ));
  assert.equal(followUp.value.status, 'worker-schroeder-spatial-epoch-retained');
  assert.equal(
    followUp.value.levelAssignmentSource,
    'stage-option-level-assignment-with-worker-retained-particle-buffers'
  );
});

test('ULG resident stage worker schedule aborts fail-closed on a mid-batch stage error and stays consistent', async () => {
  const fixture = workerScheduleFixture({ laneSuffix: 'fail', failAtStep: 2 });
  const laneOptions = {
    laneId: 'ulg:test:schroeder-schedule-fail-lane',
    stateKey: 'ulg:test:schroeder-schedule-fail-state'
  };
  const progressEnvelopes = [];
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerSchedulePayload(
      schedulePayload(
        workerSchroederStageContext(fixture.device, fixture.buffers, fixture.stageOptions),
        { stepCount: 3, scheduleId: 'ulg:test:schedule-fail' },
        laneOptions
      ),
      { postProgress: (progress) => progressEnvelopes.push(progress) }
    ),
    (error) => {
      const detail = error.residentScheduleError;
      assert.ok(detail, 'schedule errors carry a cloneable residentScheduleError');
      assert.equal(detail.scheduleId, 'ulg:test:schedule-fail');
      assert.equal(detail.stepOrdinal, 2);
      assert.match(detail.message, /injected mechanics failure at schedule step 2/);
      // The W1 finally-block released leases and the driver released the
      // step's unconsumed epoch: the lane snapshot is consistent.
      assert.equal(detail.laneState.epochConsumed, true);
      assert.equal(detail.laneState.epochReleasedWithoutMechanicsStep, true);
      assert.equal(detail.laneState.postStepUploadsRetained, true);
      assert.equal(detail.terminalGpuFence.terminalScheduleFence, true);
      assert.equal(detail.terminalGpuFence.fenceSatisfied, true);
      assert.equal(detail.terminalGpuFence.completedStepCount, 1);
      assert.equal(detail.terminalGpuFenceSatisfied, true);
      assertNoWorkerGpuBuffers(detail, 'residentScheduleError');
      structuredClone(detail);
      return true;
    }
  );
  assert.equal(progressEnvelopes.length, 1);
  assert.equal(fixture.runnerCalls.length, 2);
  assert.equal(fixture.device.queue.submittedWorkDoneCount, 1);

  // A follow-up single 'run-resident-stage' epoch message on the same lane
  // still works: the aborted schedule left no pinned unconsumed epoch.
  const followUp = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage(
      'schroederSpatialEpoch',
      ['schroeder-level-assignment'],
      ['schroeder-spatial-epoch']
    ),
    workerSchroederStageContext(fixture.device, fixture.buffers, {
      schroederSpatialEpoch: {
        levelAssignment: fixture.levelAssignmentForStep(2),
        useWorkerRetainedParticleBuffers: true,
        particleIdentityStrideWords: 1,
        selectedLevel: 0,
        mechanicsGrid: fixture.mechanicsGrid,
        exactNearCellTreeEnabled: false
      }
    }),
    null,
    laneOptions
  ));
  assert.equal(followUp.value.status, 'worker-schroeder-spatial-epoch-retained');
  assert.equal(
    followUp.value.levelAssignmentSource,
    'stage-option-level-assignment-with-worker-retained-particle-buffers'
  );
});

test('ULG resident stage worker schedule fails closed when a step does not advance the epoch identity', async () => {
  const fixture = workerScheduleFixture({ laneSuffix: 'stale' });
  // A provider that hands step 2 the SAME identity words as step 1 models a
  // scheduler trying to amortize by reusing a stale position epoch.
  fixture.stageOptions.schroederSpatialEpoch.scheduleStepOptionsProvider = () => ({
    levelAssignment: fixture.levelAssignmentForStep(1),
    particleIdentityStrideWords: 1
  });
  const laneOptions = {
    laneId: 'ulg:test:schroeder-schedule-stale-lane',
    stateKey: 'ulg:test:schroeder-schedule-stale-state'
  };
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerSchedulePayload(
      schedulePayload(
        workerSchroederStageContext(fixture.device, fixture.buffers, fixture.stageOptions),
        { stepCount: 2, scheduleId: 'ulg:test:schedule-stale' },
        laneOptions
      )
    ),
    (error) => {
      assert.match(error.message, /epoch-identity-regressed/);
      assert.equal(error.residentScheduleError.stepOrdinal, 2);
      assert.equal(error.residentScheduleError.reason, 'epoch-identity-regressed');
      assert.equal(error.residentScheduleError.laneState.epochConsumed, true);
      assert.equal(
        error.residentScheduleError.terminalGpuFence.terminalScheduleFence,
        true
      );
      assert.equal(
        error.residentScheduleError.terminalGpuFence.fenceSatisfied,
        true
      );
      return true;
    }
  );
  // Only step 1's mechanics ran; the stale step-2 generation was released
  // before it could feed a mechanics step, and the lane stays usable.
  assert.equal(fixture.runnerCalls.length, 1);
  assert.equal(fixture.device.queue.submittedWorkDoneCount, 1);
  const followUp = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage(
      'schroederSpatialEpoch',
      ['schroeder-level-assignment'],
      ['schroeder-spatial-epoch']
    ),
    workerSchroederStageContext(fixture.device, fixture.buffers, {
      schroederSpatialEpoch: {
        levelAssignment: fixture.levelAssignmentForStep(2),
        useWorkerRetainedParticleBuffers: true,
        particleIdentityStrideWords: 1,
        selectedLevel: 0,
        mechanicsGrid: fixture.mechanicsGrid,
        exactNearCellTreeEnabled: false
      }
    }),
    null,
    laneOptions
  ));
  assert.equal(followUp.value.status, 'worker-schroeder-spatial-epoch-retained');
});

test('ULG resident stage worker schedule rejects a failed terminal queue fence', async () => {
  const fixture = workerScheduleFixture({ laneSuffix: 'terminal-fence-fail' });
  fixture.device.queue.onSubmittedWorkDone = () => Promise.reject(
    new Error('injected terminal queue fence rejection')
  );
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerSchedulePayload(
      schedulePayload(
        workerSchroederStageContext(
          fixture.device,
          fixture.buffers,
          fixture.stageOptions
        ),
        { stepCount: 1, scheduleId: 'ulg:test:schedule-terminal-fence-fail' },
        {
          laneId: 'ulg:test:schedule-terminal-fence-fail-lane',
          stateKey: 'ulg:test:schedule-terminal-fence-fail-state'
        }
      )
    ),
    (error) => {
      assert.equal(
        error.residentScheduleError?.reason,
        'schedule-terminal-gpu-fence-unsatisfied'
      );
      assert.equal(
        error.residentScheduleError?.terminalGpuFence?.terminalScheduleFence,
        true
      );
      assert.equal(
        error.residentScheduleError?.terminalGpuFence?.fenceSatisfied,
        false
      );
      assert.match(
        error.residentScheduleError?.terminalGpuFence?.queueCompletionErrorMessage,
        /injected terminal queue fence rejection/
      );
      return true;
    }
  );
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerSchedulePayload(
      schedulePayload(
        workerSchroederStageContext(
          fixture.device,
          fixture.buffers,
          fixture.stageOptions
        ),
        {
          stepCount: 1,
          scheduleId: 'ulg:test:schedule-terminal-fence-fail-reuse'
        },
        {
          laneId: 'ulg:test:schedule-terminal-fence-fail-lane',
          stateKey: 'ulg:test:schedule-terminal-fence-fail-state'
        }
      )
    ),
    /lane-terminal-fence-poisoned/
  );
});

test('ULG resident stage worker refuses a concurrent schedule on one lane fail-closed', async () => {
  const fixture = workerScheduleFixture({ laneSuffix: 'concurrent' });
  const laneOptions = {
    laneId: 'ulg:test:schroeder-schedule-concurrent-lane',
    stateKey: 'ulg:test:schroeder-schedule-concurrent-state'
  };
  const context = workerSchroederStageContext(
    fixture.device,
    fixture.buffers,
    fixture.stageOptions
  );
  const first = runUlgMechanicsResidentStageWorkerSchedulePayload(
    schedulePayload(
      context,
      { stepCount: 2, scheduleId: 'ulg:test:schedule-concurrent-a' },
      laneOptions
    )
  );
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerSchedulePayload(
      schedulePayload(
        context,
        { stepCount: 1, scheduleId: 'ulg:test:schedule-concurrent-b' },
        laneOptions
      )
    ),
    /lane-schedule-already-active/
  );
  const firstResult = await first;
  assert.equal(firstResult.status, 'worker-resident-schedule-completed');
  assert.equal(firstResult.completedStepCount, 2);
  // The refusal was per-active-schedule, not permanent: the lane admits a
  // new schedule once the first completes.
  const second = await runUlgMechanicsResidentStageWorkerSchedulePayload(
    schedulePayload(
      context,
      { stepCount: 1, scheduleId: 'ulg:test:schedule-concurrent-c' },
      laneOptions
    )
  );
  assert.equal(second.status, 'worker-resident-schedule-completed');
  assert.equal(second.completedStepCount, 1);
});

test('ULG resident stage worker refuses schedules with invalid or over-cap step counts', async () => {
  assert.equal(ULG_WORKER_RESIDENT_SCHEDULE_MAX_STEP_COUNT, 128);
  const fixture = workerScheduleFixture({ laneSuffix: 'cap' });
  const laneOptions = {
    laneId: 'ulg:test:schroeder-schedule-cap-lane',
    stateKey: 'ulg:test:schroeder-schedule-cap-state'
  };
  const context = workerSchroederStageContext(
    fixture.device,
    fixture.buffers,
    fixture.stageOptions
  );
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerSchedulePayload(schedulePayload(
      context,
      {
        stepCount: ULG_WORKER_RESIDENT_SCHEDULE_MAX_STEP_COUNT + 1,
        scheduleId: 'ulg:test:schedule-over-cap'
      },
      laneOptions
    )),
    /schedule-step-count-over-cap/
  );
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerSchedulePayload(schedulePayload(
      context,
      { stepCount: 0, scheduleId: 'ulg:test:schedule-zero' },
      laneOptions
    )),
    /schedule-step-count-invalid/
  );
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerSchedulePayload(schedulePayload(
      context,
      { scheduleId: 'ulg:test:schedule-missing-count' },
      laneOptions
    )),
    /schedule-step-count-invalid/
  );
  // The refusals left no active-schedule registration behind: a valid
  // schedule on the same lane runs to completion.
  const result = await runUlgMechanicsResidentStageWorkerSchedulePayload(
    schedulePayload(
      context,
      { stepCount: 1, scheduleId: 'ulg:test:schedule-cap-valid' },
      laneOptions
    )
  );
  assert.equal(result.status, 'worker-resident-schedule-completed');
  assert.equal(result.completedStepCount, 1);
});

// --- SS worker-lane seed stage (refactor increment W4a) ---
// A fresh worker lane starts an SS schedule from a structured-cloneable seed
// descriptor: the W1 adopted-storage rematerialization rebuilds the four
// particle-storage buffers on the worker device, the caller-supplied lineage
// words are stamped onto those uploads, the REAL
// resolveSchroederParticleBufferFamilyGeneration verdict gates the seed, and
// the REAL runSchroederLevelAssignmentWebGpu runs on the fake device (the
// injectable stageOptions.schroederLaneSeed.levelAssignmentRunner seam is
// exercised only by the device-mismatch refusal below).

const WORKER_LANE_SEED_DEFAULT_LINEAGE = Object.freeze({
  storageGeneration: 11,
  physicsTick: 13,
  physicsSubstep: 0,
  positionEpoch: 17,
  topologyEpoch: 19,
  chartEpoch: 23,
  levelEpoch: 29,
  supportEpoch: 31
});

function workerLaneSeedStage() {
  return stage(
    'schroederLaneSeed',
    ['sph-particle-state', 'mls-mpm-mechanics'],
    ['schroeder-level-assignment']
  );
}

function workerLaneSeedStageOptions({
  hotBufferKey = 'ulg:sph-resident-schroeder-adopted-storage:lane-seed',
  particleCount = 1,
  lineage = WORKER_LANE_SEED_DEFAULT_LINEAGE,
  seedOptionOverrides = {}
} = {}) {
  return {
    useSchroederAdoptedParticleStorageWorkerRematerialization: true,
    schroederAdoptedParticleStorageWorkerRematerializationSeed: {
      schema: 'peercompute.ulg.schroeder-adopted-particle-storage-portable-materialization-seed.v0',
      status: 'schroeder-adopted-particle-storage-portable-materialization-seed-ready',
      ready: true,
      hotBufferKey,
      authoritativeParticleCount: particleCount,
      materializationMode: 'peer-local-gpu-rematerialization-from-descriptor-seed'
    },
    schroederLaneSeed: {
      ...(lineage ? { lineage: { ...lineage } } : {}),
      minLevel: 0,
      maxLevel: 0,
      chartId: 0,
      baseGridSpacingM: 1,
      ...seedOptionOverrides
    }
  };
}

function workerSeededMechanicsRunnerFixture(device, { labelPrefix, particleCount = 1 }) {
  const taggedBuffer = (label, size) => tagWebGpuBufferDevice(
    device.createBuffer({ label, size, usage: 128 | 8 }),
    device
  );
  const runnerCalls = [];
  const residentProductMasses = [];
  const runner = async (args) => {
    runnerCalls.push(args);
    const ordinal = runnerCalls.length;
    const residentProductMass = {
      schema: 'peercompute.ulg.test-worker-resident-product-mass.v0',
      ordinal
    };
    residentProductMasses.push(residentProductMass);
    return {
      status: 'schroeder-same-level-mechanics-completed',
      selectedLevel: 0,
      residentStep: {
        backend: 'webgpu',
        status: 'resident-step-completed',
        readbackMode: 'no-full-readback',
        stageStatus: { p2g: 'completed', g2p: 'completed' },
        stageBackends: { p2g: 'webgpu', g2p: 'webgpu' },
        residentProductMass,
        nextParticleUploads: {
          sphParticleUpload: {
            particleCount,
            stateBuffer: taggedBuffer(
              `${labelPrefix}-next-state-${ordinal}`,
              particleCount * 8 * Float32Array.BYTES_PER_ELEMENT
            ),
            thermoBuffer: taggedBuffer(
              `${labelPrefix}-next-thermo-${ordinal}`,
              particleCount * 12 * Float32Array.BYTES_PER_ELEMENT
            ),
            identityBuffer: taggedBuffer(
              `${labelPrefix}-next-identity-${ordinal}`,
              particleCount * Uint32Array.BYTES_PER_ELEMENT
            )
          },
          mlsMpmParticleUpload: {
            particleCount,
            mechanicsBuffer: taggedBuffer(
              `${labelPrefix}-next-mechanics-${ordinal}`,
              particleCount * 32 * Float32Array.BYTES_PER_ELEMENT
            )
          }
        }
      },
      schroederSpatialEpochReleasePromise: Promise.resolve(true),
      currentSchroederSpatialEpochGenerationSummary: () => ({
        status: 'synthetic-generation-summary'
      })
    };
  };
  return { runner, runnerCalls, residentProductMasses };
}

const WORKER_SEED_MECHANICS_GRID = Object.freeze({
  selectedLevel: 0,
  gridDims: [2, 2, 2],
  gridNodeCount: 8,
  gridShift: 1,
  gridSpacingM: 1
});

test('ULG resident stage worker seeds a fresh SS lane from a cloneable descriptor and a 2-step schedule advances beyond the seeded lineage', async () => {
  // The W4b scene hand-off contract: exactly these words, every one REQUIRED.
  assert.deepEqual([...ULG_WORKER_SCHROEDER_LANE_SEED_LINEAGE_WORD_FIELDS], [
    'storageGeneration',
    'physicsTick',
    'physicsSubstep',
    'positionEpoch',
    'topologyEpoch',
    'chartEpoch',
    'levelEpoch',
    'supportEpoch'
  ]);
  const device = createFakeGpuDevice();
  const buffers = manualBuffers();
  const particleCount = 1;
  const laneOptions = {
    laneId: 'ulg:test:schroeder-seed-schedule-lane',
    stateKey: 'ulg:test:schroeder-seed-schedule-state'
  };
  const seedLineage = WORKER_LANE_SEED_DEFAULT_LINEAGE;

  const seeded = await runUlgMechanicsResidentStageWorkerPayload(payload(
    workerLaneSeedStage(),
    workerSchroederStageContext(device, buffers, {
      schroederLaneSeed: workerLaneSeedStageOptions({
        hotBufferKey: 'ulg:sph-resident-schroeder-adopted-storage:seed-schedule',
        particleCount
      })
    }),
    null,
    laneOptions
  ));
  assert.equal(seeded.value.schema, ULG_WORKER_SCHROEDER_LANE_SEED_STAGE_SCHEMA);
  assert.equal(seeded.value.status, 'worker-schroeder-lane-seeded');
  assert.equal(seeded.value.laneSeeded, true);
  assert.equal(seeded.value.seedRetainedInLane, true);
  // The REAL family resolver's verdict, published truthfully.
  assert.equal(
    seeded.value.bufferFamilyGenerationStatus,
    'schroeder-particle-buffer-family-generation-ready'
  );
  assert.equal(seeded.value.bufferFamilyGeneration.ready, true);
  assert.equal(
    seeded.value.bufferFamilyGeneration.storageGeneration,
    seedLineage.storageGeneration
  );
  // The REAL level-assignment runner executed on the fake device (no seam).
  assert.equal(
    seeded.value.levelAssignmentRunnerSource,
    'real-runSchroederLevelAssignmentWebGpu'
  );
  assert.equal(
    seeded.value.levelAssignmentSummary.status,
    'schroeder-level-assignment-submitted'
  );
  assert.equal(
    seeded.value.levelAssignmentSummary.bufferFamilyGenerationStatus,
    'schroeder-particle-buffer-family-generation-ready'
  );
  assert.equal(seeded.value.levelAssignmentSummary.assignmentStrideFloats, 16);
  for (const field of ULG_WORKER_SCHROEDER_LANE_SEED_LINEAGE_WORD_FIELDS) {
    assert.equal(
      seeded.value.levelAssignmentSummary[field],
      seedLineage[field],
      `seeded assignment lineage word ${field}`
    );
  }
  assert.deepEqual(seeded.value.seedLineage, { ...seedLineage });
  assert.equal(
    seeded.value.workerResidentStage.workerAdoptedStorageRematerializationApplied,
    true
  );
  assert.match(seeded.value.seedLevelAssignmentBufferRef.ref, /^ulg-worker:/);
  assert.ok(seeded.retainedBufferRefs.includes(
    seeded.value.seedLevelAssignmentBufferRef.ref
  ));
  assert.equal(seeded.value.gpuFence.fenceSatisfied, true);
  assertNoWorkerGpuBuffers(seeded, 'seeded');
  structuredClone(seeded.value);

  // 2-step schedule: step 1 consumes the seeded assignment; step 2 continues
  // from the kernel-committed stand-in with advanced identity words.
  const continuationAssignment = workerSchroederLevelAssignmentFixture(device, {
    particleCount,
    storageGeneration: seedLineage.storageGeneration + 1,
    physicsTick: seedLineage.physicsTick + 1,
    positionEpoch: seedLineage.positionEpoch + 1,
    sourceStateBuffer: null,
    label: 'worker-ss-seeded-step2'
  });
  const mechanicsFixture = workerSeededMechanicsRunnerFixture(device, {
    labelPrefix: 'worker-ss-seeded-schedule',
    particleCount
  });
  const progressEnvelopes = [];
  const scheduleResult = await runUlgMechanicsResidentStageWorkerSchedulePayload(
    schedulePayload(
      workerSchroederStageContext(device, buffers, {
        schroederSpatialEpoch: {
          selectedLevel: 0,
          mechanicsGrid: WORKER_SEED_MECHANICS_GRID,
          exactNearCellTreeEnabled: false,
          scheduleStepOptionsProvider: () => ({
            levelAssignment: continuationAssignment
          })
        },
        schroederSameLevelMechanics: {
          schroederSameLevelMechanicsRunner: mechanicsFixture.runner
        }
      }),
      { stepCount: 2, scheduleId: 'ulg:test:seeded-schedule' },
      laneOptions
    ),
    { postProgress: (progress) => progressEnvelopes.push(progress) }
  );
  assert.equal(scheduleResult.status, 'worker-resident-schedule-completed');
  assert.equal(scheduleResult.completedStepCount, 2);
  assert.equal(mechanicsFixture.runnerCalls.length, 2);
  assert.equal(
    mechanicsFixture.runnerCalls[0].sphParticleState,
    buffers.sphParticleState,
    'the first mechanics step reuses the packed state cloned once by the seed'
  );
  assert.equal(
    mechanicsFixture.runnerCalls[0].mlsMpmParticleState,
    buffers.mlsMpmParticleState,
    'the first mechanics step reuses the mechanics state cloned once by the seed'
  );
  assert.equal(
    mechanicsFixture.runnerCalls[1].residentStepOptions.residentProductMass,
    mechanicsFixture.residentProductMasses[0],
    'the next step consumes the exact worker-local product-mass owner'
  );
  // Step 1 consumed the retained seeded assignment and carries EXACTLY the
  // seeded identity words.
  assert.equal(
    progressEnvelopes[0].stepSummary.levelAssignmentSource,
    'worker-lane-seeded-level-assignment'
  );
  assert.equal(
    progressEnvelopes[0].epochIdentity.physicsTick,
    seedLineage.physicsTick
  );
  assert.equal(
    progressEnvelopes[0].epochIdentity.positionEpoch,
    seedLineage.positionEpoch
  );
  assert.equal(
    progressEnvelopes[0].epochIdentity.storageGeneration,
    seedLineage.storageGeneration
  );
  // Step 2 (and the schedule's final identity) advanced beyond the seeded
  // lineage baseline.
  assert.equal(
    progressEnvelopes[1].stepSummary.levelAssignmentSource,
    'stage-option-level-assignment-with-worker-retained-particle-buffers'
  );
  assert.ok(
    scheduleResult.finalEpochIdentity.physicsTick > seedLineage.physicsTick
  );
  assert.ok(
    scheduleResult.finalEpochIdentity.positionEpoch > seedLineage.positionEpoch
  );
  assert.equal(
    scheduleResult.finalEpochIdentity.storageGeneration,
    seedLineage.storageGeneration + 1
  );
  const ring = scheduleResult.perStepSummaries.ring;
  assert.equal(ring.length, 2);
  assert.equal(ring[0].physicsTick, seedLineage.physicsTick);
  assert.equal(ring[0].positionEpoch, seedLineage.positionEpoch);
  assert.equal(ring[1].physicsTick, seedLineage.physicsTick + 1);
  assert.equal(ring[1].positionEpoch, seedLineage.positionEpoch + 1);
  // Step 1's mechanics consumed the seed-stamped rematerialized uploads and
  // the seeded execution itself; step 2 consumed step 1's post-step buffers.
  const stepOneArgs = mechanicsFixture.runnerCalls[0];
  assert.equal(
    stepOneArgs.sphParticleUpload.stateBuffer.label,
    'ulg-worker-adopted-storage-state'
  );
  assert.equal(
    stepOneArgs.sphParticleUpload.storageGeneration,
    seedLineage.storageGeneration
  );
  assert.equal(
    stepOneArgs.levelAssignment.bufferFamilyGenerationStatus,
    'schroeder-particle-buffer-family-generation-ready'
  );
  assert.equal(
    stepOneArgs.levelAssignment.storageGeneration,
    seedLineage.storageGeneration
  );
  assert.equal(
    stepOneArgs.spatialEpochGeneration.execution.storageGeneration,
    seedLineage.storageGeneration
  );
  const stepTwoArgs = mechanicsFixture.runnerCalls[1];
  assert.equal(
    stepTwoArgs.sphParticleUpload.stateBuffer.label,
    'worker-ss-seeded-schedule-next-state-1'
  );
  assert.equal(
    stepTwoArgs.spatialEpochGeneration.execution.positionEpoch,
    seedLineage.positionEpoch + 1
  );
  for (const ref of scheduleResult.retainedBufferRefs) {
    assert.match(ref, /^ulg-worker:/);
  }
  assertNoWorkerGpuBuffers(scheduleResult, 'seededScheduleResult');
  structuredClone(scheduleResult);
  progressEnvelopes.forEach((progress, index) => {
    assertNoWorkerGpuBuffers(progress, `seededProgress[${index}]`);
    structuredClone(progress);
  });
});

test('ULG resident stage worker retires superseded lanes and their GPU buffers before a fresh seed', async () => {
  const device = createFakeGpuDevice();
  const buffers = manualBuffers();
  const retiredLane = {
    laneId: 'ulg:test:schroeder-retired-lane',
    stateKey: 'ulg:test:schroeder-retired-state'
  };
  const replacementLane = {
    laneId: 'ulg:test:schroeder-replacement-lane',
    stateKey: 'ulg:test:schroeder-replacement-state'
  };
  const seed = (laneOptions, seedOptionOverrides = {}) =>
    runUlgMechanicsResidentStageWorkerPayload(payload(
      workerLaneSeedStage(),
      workerSchroederStageContext(device, buffers, {
        schroederLaneSeed: workerLaneSeedStageOptions({
          hotBufferKey: `ulg:sph-resident:${laneOptions.laneId}`,
          seedOptionOverrides
        })
      }),
      null,
      laneOptions
    ));

  const first = await seed(retiredLane);
  assert.equal(first.value.status, 'worker-schroeder-lane-seeded');
  const replacement = await seed(replacementLane, { retireLane: retiredLane });
  assert.equal(replacement.value.status, 'worker-schroeder-lane-seeded');
  assert.equal(
    replacement.value.retiredLaneReceipt?.status,
    'worker-resident-lane-released'
  );
  assert.equal(replacement.value.retiredLaneReceipt?.released, true);
  assert.ok(replacement.value.retiredLaneReceipt?.destroyedBufferCount > 0);
  assert.equal(
    releaseUlgMechanicsResidentStageWorkerLane(retiredLane).status,
    'worker-resident-lane-release-noop-missing'
  );
  assert.equal(
    releaseUlgMechanicsResidentStageWorkerLane(replacementLane).status,
    'worker-resident-lane-released'
  );
});

test('ULG resident stage worker lane seed fails closed on missing lineage words and never invents them', async () => {
  const device = createFakeGpuDevice();
  const buffers = manualBuffers();
  const laneOptions = {
    laneId: 'ulg:test:schroeder-seed-lineage-lane',
    stateKey: 'ulg:test:schroeder-seed-lineage-state'
  };
  const seedPayload = (lineage) => payload(
    workerLaneSeedStage(),
    workerSchroederStageContext(device, buffers, {
      schroederLaneSeed: workerLaneSeedStageOptions({
        hotBufferKey: 'ulg:sph-resident-schroeder-adopted-storage:seed-lineage',
        lineage
      })
    }),
    null,
    laneOptions
  );

  // A missing word is refused by name.
  const { positionEpoch: omitted, ...missingPositionEpoch } =
    WORKER_LANE_SEED_DEFAULT_LINEAGE;
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerPayload(seedPayload(missingPositionEpoch)),
    (error) => {
      assert.equal(error.reason, 'seed-lineage-missing');
      assert.equal(error.code, 'ERR_ULG_WORKER_SCHROEDER_SEED_LINEAGE_MISSING');
      assert.match(error.message, /positionEpoch/);
      return true;
    }
  );
  // A non-finite word is refused the same way.
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerPayload(seedPayload({
      ...WORKER_LANE_SEED_DEFAULT_LINEAGE,
      physicsTick: Number.NaN
    })),
    (error) => {
      assert.equal(error.reason, 'seed-lineage-missing');
      assert.match(error.message, /physicsTick/);
      return true;
    }
  );
  // A lineage object missing entirely is refused with the full word list.
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerPayload(seedPayload(null)),
    (error) => {
      assert.equal(error.reason, 'seed-lineage-missing');
      assert.match(error.message, /storageGeneration.*supportEpoch/);
      return true;
    }
  );
  // A malformed particle-storage descriptor is refused with the exact W1
  // machinery verdict (the seed reuses that machinery, never duplicates it).
  const notReadyOptions = workerLaneSeedStageOptions({
    hotBufferKey: 'ulg:sph-resident-schroeder-adopted-storage:seed-lineage'
  });
  notReadyOptions.schroederAdoptedParticleStorageWorkerRematerializationSeed = {
    ...notReadyOptions.schroederAdoptedParticleStorageWorkerRematerializationSeed,
    ready: false
  };
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerPayload(payload(
      workerLaneSeedStage(),
      workerSchroederStageContext(device, buffers, {
        schroederLaneSeed: notReadyOptions
      }),
      null,
      laneOptions
    )),
    (error) => {
      assert.equal(error.reason, 'seed-particle-storage-rematerialization-blocked');
      assert.match(
        error.message,
        /blocked-worker-adopted-storage-rematerialization-seed-not-ready/
      );
      return true;
    }
  );
  // A seed that never requested the W1 rematerialization is refused too.
  const noRematOptions = workerLaneSeedStageOptions({
    hotBufferKey: 'ulg:sph-resident-schroeder-adopted-storage:seed-lineage'
  });
  delete noRematOptions.useSchroederAdoptedParticleStorageWorkerRematerialization;
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerPayload(payload(
      workerLaneSeedStage(),
      workerSchroederStageContext(device, buffers, {
        schroederLaneSeed: noRematOptions
      }),
      null,
      laneOptions
    )),
    (error) => {
      assert.equal(error.reason, 'seed-particle-storage-rematerialization-blocked');
      return true;
    }
  );

  // The refusals did not poison the lane: a complete lineage still seeds it.
  const seeded = await runUlgMechanicsResidentStageWorkerPayload(
    seedPayload(WORKER_LANE_SEED_DEFAULT_LINEAGE)
  );
  assert.equal(seeded.value.status, 'worker-schroeder-lane-seeded');
  assertNoWorkerGpuBuffers(seeded, 'seededAfterRefusals');
  structuredClone(seeded.value);
});

test('ULG resident stage worker lane seed surfaces the real family-resolver rejection truthfully', async () => {
  const device = createFakeGpuDevice();
  const buffers = manualBuffers();
  const laneOptions = {
    laneId: 'ulg:test:schroeder-seed-family-lane',
    stateKey: 'ulg:test:schroeder-seed-family-state'
  };
  // storageGeneration 0 is a finite lineage word, but the REAL
  // resolveSchroederParticleBufferFamilyGeneration requires one matching
  // POSITIVE generation on both uploads — its verdict is surfaced verbatim.
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerPayload(payload(
      workerLaneSeedStage(),
      workerSchroederStageContext(device, buffers, {
        schroederLaneSeed: workerLaneSeedStageOptions({
          hotBufferKey: 'ulg:sph-resident-schroeder-adopted-storage:seed-family',
          lineage: { ...WORKER_LANE_SEED_DEFAULT_LINEAGE, storageGeneration: 0 }
        })
      }),
      null,
      laneOptions
    )),
    (error) => {
      assert.equal(error.reason, 'seed-family-generation-rejected');
      assert.equal(
        error.code,
        'ERR_ULG_WORKER_SCHROEDER_SEED_FAMILY_GENERATION_REJECTED'
      );
      assert.equal(
        error.bufferFamilyGeneration.schema,
        'peercompute.ulg.schroeder-particle-buffer-family-generation.v1'
      );
      assert.equal(
        error.bufferFamilyGeneration.status,
        'schroeder-particle-buffer-family-generation-rejected'
      );
      assert.equal(error.bufferFamilyGeneration.ready, false);
      assert.equal(error.bufferFamilyGeneration.sphStorageGeneration, null);
      assert.match(error.message, /one matching positive generation/);
      return true;
    }
  );
});

test('ULG resident stage worker lane seed refuses double-seeding, stepped lanes, and cross-device seam executions', async () => {
  const device = createFakeGpuDevice();
  const buffers = manualBuffers();
  const laneOptions = {
    laneId: 'ulg:test:schroeder-seed-double-lane',
    stateKey: 'ulg:test:schroeder-seed-double-state'
  };
  const seedPayload = () => payload(
    workerLaneSeedStage(),
    workerSchroederStageContext(device, buffers, {
      schroederLaneSeed: workerLaneSeedStageOptions({
        hotBufferKey: 'ulg:sph-resident-schroeder-adopted-storage:seed-double'
      })
    }),
    null,
    laneOptions
  );
  const seeded = await runUlgMechanicsResidentStageWorkerPayload(seedPayload());
  assert.equal(seeded.value.status, 'worker-schroeder-lane-seeded');

  // No reseed flag in this increment: an already-seeded lane refuses.
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerPayload(seedPayload()),
    (error) => {
      assert.equal(error.reason, 'lane-already-seeded');
      assert.equal(error.code, 'ERR_ULG_WORKER_SCHROEDER_LANE_ALREADY_SEEDED');
      return true;
    }
  );

  // Consume the seed with a step-1 epoch; the lane is now stepped and still
  // refuses a new seed, with the stepped reason.
  const epoch = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage(
      'schroederSpatialEpoch',
      ['schroeder-level-assignment'],
      ['schroeder-spatial-epoch']
    ),
    workerSchroederStageContext(device, buffers, {
      schroederSpatialEpoch: {
        selectedLevel: 0,
        mechanicsGrid: WORKER_SEED_MECHANICS_GRID,
        exactNearCellTreeEnabled: false
      }
    }),
    null,
    laneOptions
  ));
  assert.equal(
    epoch.value.levelAssignmentSource,
    'worker-lane-seeded-level-assignment'
  );
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerPayload(seedPayload()),
    (error) => {
      assert.equal(error.reason, 'lane-already-stepped');
      assert.equal(error.code, 'ERR_ULG_WORKER_SCHROEDER_LANE_ALREADY_STEPPED');
      return true;
    }
  );

  // The injectable seam exists for environments where the real runner cannot
  // execute — but a seam execution from another device fails closed.
  const foreignDevice = createFakeGpuDevice();
  const foreignAssignmentBuffer = tagWebGpuBufferDevice(
    foreignDevice.createBuffer({
      label: 'worker-ss-seed-foreign-assignment',
      size: 64,
      usage: 128 | 4
    }),
    foreignDevice
  );
  const seamObserved = {};
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerPayload(payload(
      workerLaneSeedStage(),
      workerSchroederStageContext(device, buffers, {
        schroederLaneSeed: workerLaneSeedStageOptions({
          hotBufferKey: 'ulg:sph-resident-schroeder-adopted-storage:seed-foreign',
          seedOptionOverrides: {
            async levelAssignmentRunner(args) {
              seamObserved.args = args;
              return {
                schema: 'peercompute.ulg.schroeder-level-assignment-execution.v0',
                status: 'schroeder-level-assignment-submitted',
                bufferFamilyGenerationStatus:
                  'schroeder-particle-buffer-family-generation-ready',
                particleCount: 1,
                assignmentStrideFloats: 16,
                assignmentBuffer: foreignAssignmentBuffer
              };
            }
          }
        })
      }),
      null,
      {
        laneId: 'ulg:test:schroeder-seed-foreign-lane',
        stateKey: 'ulg:test:schroeder-seed-foreign-state'
      }
    )),
    (error) => {
      assert.equal(error.reason, 'seed-device-mismatch');
      assert.equal(error.code, 'ERR_ULG_WORKER_SCHROEDER_SEED_DEVICE_MISMATCH');
      return true;
    }
  );
  // The seam received the lineage-stamped worker-device uploads.
  assert.equal(seamObserved.args.device, device);
  assert.equal(
    seamObserved.args.sphParticleUpload.storageGeneration,
    WORKER_LANE_SEED_DEFAULT_LINEAGE.storageGeneration
  );
  assert.equal(
    seamObserved.args.sphParticleUpload.stateBuffer.label,
    'ulg-worker-adopted-storage-state'
  );
  assert.equal(
    seamObserved.args.mlsMpmParticleUpload.storageGeneration,
    WORKER_LANE_SEED_DEFAULT_LINEAGE.storageGeneration
  );
});

test('ULG resident stage worker seeded lane works through single-stage messages and pins the seed lineage as the schedule baseline', async () => {
  const device = createFakeGpuDevice();
  const deviceId = webGpuDeviceId(device);
  const buffers = manualBuffers();
  const particleCount = 1;
  const seedLineage = WORKER_LANE_SEED_DEFAULT_LINEAGE;
  const laneOptions = {
    laneId: 'ulg:test:schroeder-seed-single-lane',
    stateKey: 'ulg:test:schroeder-seed-single-state'
  };
  const seeded = await runUlgMechanicsResidentStageWorkerPayload(payload(
    workerLaneSeedStage(),
    workerSchroederStageContext(device, buffers, {
      schroederLaneSeed: workerLaneSeedStageOptions({
        hotBufferKey: 'ulg:sph-resident-schroeder-adopted-storage:seed-single',
        particleCount
      })
    }),
    null,
    laneOptions
  ));
  assert.equal(seeded.value.status, 'worker-schroeder-lane-seeded');

  // While the seed is unconsumed the lane admits no competing payload source.
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerPayload(payload(
      stage(
        'schroederSpatialEpoch',
        ['schroeder-level-assignment'],
        ['schroeder-spatial-epoch']
      ),
      workerSchroederStageContext(device, buffers, {
        schroederSpatialEpoch: {
          levelAssignment: workerSchroederLevelAssignmentFixture(device, {
            particleCount,
            label: 'worker-ss-seed-single-conflict'
          }),
          selectedLevel: 0,
          mechanicsGrid: WORKER_SEED_MECHANICS_GRID,
          exactNearCellTreeEnabled: false
        }
      }),
      null,
      laneOptions
    )),
    (error) => {
      assert.equal(
        error.reason,
        'seeded-lane-conflicting-level-assignment-source'
      );
      return true;
    }
  );

  // A plain single-stage epoch message consumes the seeded assignment; the
  // sealed identity IS the seed lineage.
  const epoch = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage(
      'schroederSpatialEpoch',
      ['schroeder-level-assignment'],
      ['schroeder-spatial-epoch']
    ),
    workerSchroederStageContext(device, buffers, {
      schroederSpatialEpoch: {
        selectedLevel: 0,
        mechanicsGrid: WORKER_SEED_MECHANICS_GRID,
        exactNearCellTreeEnabled: false
      }
    }),
    null,
    laneOptions
  ));
  assert.equal(epoch.value.schema, ULG_WORKER_SCHROEDER_SPATIAL_EPOCH_STAGE_SCHEMA);
  assert.equal(
    epoch.value.levelAssignmentSource,
    'worker-lane-seeded-level-assignment'
  );
  assert.equal(epoch.value.epochStepOrdinal, 0);
  const epochSeal = epoch.value.epochSeal;
  assert.equal(epochSeal.deviceId, deviceId);
  for (const field of ULG_WORKER_SCHROEDER_LANE_SEED_LINEAGE_WORD_FIELDS) {
    assert.equal(epochSeal[field], seedLineage[field], `epoch seal word ${field}`);
  }
  assertNoWorkerGpuBuffers(epoch, 'seededSingleEpoch');
  structuredClone(epoch.value);

  const mechanicsFixture = workerSeededMechanicsRunnerFixture(device, {
    labelPrefix: 'worker-ss-seed-single',
    particleCount
  });
  const mechanics = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage(
      'schroederSameLevelMechanics',
      ['schroeder-spatial-epoch', 'sph-particle-state', 'mls-mpm-mechanics'],
      ['sph-particle-state', 'mls-mpm-mechanics']
    ),
    workerSchroederStageContext(device, buffers, {
      schroederSameLevelMechanics: {
        expectedSpatialEpochSeal: epochSeal,
        schroederSameLevelMechanicsRunner: mechanicsFixture.runner
      }
    }),
    epoch.value,
    laneOptions
  ));
  assert.equal(mechanics.value.epochConsumed, true);
  assert.equal(
    mechanicsFixture.runnerCalls[0].sphParticleUpload.stateBuffer.label,
    'ulg-worker-adopted-storage-state'
  );
  assert.equal(
    mechanicsFixture.runnerCalls[0].levelAssignment.storageGeneration,
    seedLineage.storageGeneration
  );
  assertNoWorkerGpuBuffers(mechanics, 'seededSingleMechanics');
  structuredClone(mechanics.value);

  // The seed lineage stays the lane's monotonicity baseline: a schedule step
  // that does NOT advance beyond the seeded words fails closed.
  const staleScheduleContext = workerSchroederStageContext(device, buffers, {
    schroederSpatialEpoch: {
      levelAssignment: workerSchroederLevelAssignmentFixture(device, {
        particleCount,
        sourceStateBuffer: null,
        label: 'worker-ss-seed-single-stale'
      }),
      useWorkerRetainedParticleBuffers: true,
      selectedLevel: 0,
      mechanicsGrid: WORKER_SEED_MECHANICS_GRID,
      exactNearCellTreeEnabled: false
    },
    schroederSameLevelMechanics: {
      schroederSameLevelMechanicsRunner: mechanicsFixture.runner
    }
  });
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerSchedulePayload(schedulePayload(
      staleScheduleContext,
      { stepCount: 1, scheduleId: 'ulg:test:seed-single-stale-schedule' },
      laneOptions
    )),
    (error) => {
      assert.equal(error.reason, 'epoch-identity-regressed');
      assert.match(error.message, /seeded lineage baseline/);
      assert.equal(error.residentScheduleError.stepOrdinal, 1);
      assert.equal(
        error.residentScheduleError.laneState.laneSeedRetained,
        true
      );
      assert.equal(
        error.residentScheduleError.laneState.laneSeedConsumed,
        true
      );
      return true;
    }
  );

  // A step that advances beyond the seeded words completes.
  const advancedScheduleContext = workerSchroederStageContext(device, buffers, {
    schroederSpatialEpoch: {
      levelAssignment: workerSchroederLevelAssignmentFixture(device, {
        particleCount,
        storageGeneration: seedLineage.storageGeneration + 1,
        physicsTick: seedLineage.physicsTick + 1,
        positionEpoch: seedLineage.positionEpoch + 1,
        sourceStateBuffer: null,
        label: 'worker-ss-seed-single-advanced'
      }),
      useWorkerRetainedParticleBuffers: true,
      selectedLevel: 0,
      mechanicsGrid: WORKER_SEED_MECHANICS_GRID,
      exactNearCellTreeEnabled: false
    },
    schroederSameLevelMechanics: {
      schroederSameLevelMechanicsRunner: mechanicsFixture.runner
    }
  });
  const advanced = await runUlgMechanicsResidentStageWorkerSchedulePayload(
    schedulePayload(
      advancedScheduleContext,
      { stepCount: 1, scheduleId: 'ulg:test:seed-single-advanced-schedule' },
      laneOptions
    )
  );
  assert.equal(advanced.status, 'worker-resident-schedule-completed');
  assert.equal(advanced.completedStepCount, 1);
  assert.equal(
    advanced.finalEpochIdentity.physicsTick,
    seedLineage.physicsTick + 1
  );
  assert.equal(
    advanced.finalEpochIdentity.positionEpoch,
    seedLineage.positionEpoch + 1
  );
  assertNoWorkerGpuBuffers(advanced, 'seededAdvancedSchedule');
  structuredClone(advanced);
});
