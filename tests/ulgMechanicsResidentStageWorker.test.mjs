import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
  SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT,
  MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT
} from '../ulg-gpu-abi/src/index.js';
import {
  ULG_MECHANICS_RESIDENT_STAGE_WORKER_RESULT_SCHEMA,
  ULG_WORKER_SCHROEDER_EPOCH_SEAL_SCHEMA,
  ULG_WORKER_SCHROEDER_SAME_LEVEL_MECHANICS_STAGE_SCHEMA,
  ULG_WORKER_SCHROEDER_SPATIAL_EPOCH_STAGE_SCHEMA,
  ULG_WORKER_SCHROEDER_W1_TWO_LEVEL_REFUSAL_REASON,
  exportUlgMechanicsResidentStageWorkerRetainedCompactSnapshot,
  resolveUlgMechanicsResidentStageWorkerDeviceResult,
  runUlgMechanicsResidentStageWorkerPayload
} from '../src/services/ulgMechanicsResidentStage.worker.js';
import {
  releaseSchroederSpatialEpochGenerationAfterQueue,
  runSchroederSpatialEpochGenerationWebGpu
} from '../src/runtime/sph/schroederSpatialEpochGpu.js';
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
  publishUlgPressureInterfaceGasCellFieldAdmission,
  publishUlgPressureInterfaceGasCellFieldImportSource
} from '../src/runtime/peercomputeBrowserResidentHost.js';

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
  }

  mapAsync() {
    if (this.destroyed) throw new Error(`${this.label || 'buffer'} was destroyed`);
    return Promise.resolve();
  }

  getMappedRange(offset = 0, size = this.bytes.byteLength - offset) {
    if (this.destroyed) throw new Error(`${this.label || 'buffer'} was destroyed`);
    const start = Math.max(0, Math.round(Number(offset) || 0));
    const end = Math.min(this.bytes.byteLength, start + Math.max(0, Math.round(Number(size) || 0)));
    return this.bytes.buffer.slice(start, end);
  }

  unmap() {}

  destroy() {
    this.destroyCount += 1;
    this.destroyed = true;
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
// TODO(native-arm): real-GPU coverage for the full kernel path runs in the
// native WebGPU test arm; do not add GPU-flagged coverage here.

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
  const epoch = await runUlgMechanicsResidentStageWorkerPayload(payload(
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
  ));
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
  assert.equal(stepZeroArgs.enableTwoLevelMechanics, false);
  assert.equal(stepZeroArgs.twoLevelMechanicsAuthority, 'observation');
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

test('ULG resident stage worker SS stages fail closed on missing epoch, identity mismatch, and two-level requests', async () => {
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

  // Two-level requests are out of W1 scope on both stages.
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerPayload(payload(
      epochStage,
      workerSchroederStageContext(device, buffers, {
        schroederSpatialEpoch: {
          enableTwoLevelMechanics: true,
          levelAssignment: workerSchroederLevelAssignmentFixture(device, {
            particleCount,
            label: 'worker-ss-guard-two-level'
          })
        }
      }),
      null,
      {
        laneId: 'ulg:test:schroeder-guard-two-level-lane',
        stateKey: 'ulg:test:schroeder-guard-two-level-state'
      }
    )),
    new RegExp(ULG_WORKER_SCHROEDER_W1_TWO_LEVEL_REFUSAL_REASON)
  );
  await assert.rejects(
    runUlgMechanicsResidentStageWorkerPayload(payload(
      mechanicsStage,
      workerSchroederStageContext(device, buffers, {
        schroederSameLevelMechanics: {
          twoLevelMechanicsAuthority: 'authoritative'
        }
      }),
      null,
      {
        laneId: 'ulg:test:schroeder-guard-two-level-lane',
        stateKey: 'ulg:test:schroeder-guard-two-level-state'
      }
    )),
    new RegExp(ULG_WORKER_SCHROEDER_W1_TWO_LEVEL_REFUSAL_REASON)
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
