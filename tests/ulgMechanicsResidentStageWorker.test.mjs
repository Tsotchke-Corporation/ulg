import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
  MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT
} from '../ulg-gpu-abi/src/index.js';
import {
  ULG_MECHANICS_RESIDENT_STAGE_WORKER_RESULT_SCHEMA,
  exportUlgMechanicsResidentStageWorkerRetainedCompactSnapshot,
  resolveUlgMechanicsResidentStageWorkerDeviceResult,
  runUlgMechanicsResidentStageWorkerPayload
} from '../src/services/ulgMechanicsResidentStage.worker.js';
import {
  ULG_SPH_GAS_PRESSURE_AUTHORITY_TELEMETRY_SCHEMA,
  bindSphSpatialGasPressureAuthority,
  isExactSphSpatialGasPressureAuthoritySource
} from '../src/runtime/sph/sphSpatialGasLedgerEosGpu.js';
import {
  runSphPressureInterfaceForceRowsWebGpu
} from '../src/runtime/sph/sphPressureInterfaceGpuKernel.js';
import {
  tagResidentProductMassDevice
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
      writeBuffer(buffer, offset, data) {
        if (buffer.destroyed) throw new Error(`${buffer.label || 'buffer'} was destroyed`);
        const bytes = data instanceof ArrayBuffer
          ? new Uint8Array(data)
          : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        buffer.bytes.set(bytes, Math.max(0, Math.round(Number(offset) || 0)));
      },
      submit(commandBuffers) {
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

test('ULG resident stage worker resolves retained gas-cell import refs inside the same worker lane', async () => {
  const device = createFakeGpuDevice();
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
  const lane = {
    laneId: 'ulg:test:worker-retained-gas-import-lane',
    stateKey: 'ulg:test:worker-retained-gas-import-state'
  };
  const context = {
    schema: 'peercompute.ulg.mechanics-resident-stage-worker-context.v0',
    taskIdPrefix: 'ulg:test:worker-retained-gas-import',
    preferWebGpu: true,
    readbackMode: 'no-full-readback',
    common: {
      device,
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
    lane
  ));
  const workerRefs = eos.value.workerRetainedGasPressureBufferRefs;
  const queueFenceCountAfterEos = device.queue.submittedWorkDoneCount || 0;
  assert.equal(eos.value.backend, 'webgpu');
  assert.equal(eos.value.pressureInterfaceGasPressureCellRowsBufferRetained, true);
  assert.ok(workerRefs.length > 0);
  assert.equal(
    eos.value.workerResidentStage.workerQueueFence.finalConsumerFenceDeferred,
    true
  );

  const retainedGasCellFieldSource = {
    schema: 'peercompute.ulg.pressure-interface-retained-gas-cell-field-source.v0',
    status: 'pressure-interface-retained-gas-cell-field-source-ready',
    sourceStage: 'gasCellEosProducer',
    retainedGasPressureBufferRefs: eos.value.retainedGasPressureBufferRefs,
    workerRetainedGasPressureBufferRefs: workerRefs,
    pressureInterfaceGasPressureCellRowCount: eos.value.pressureInterfaceGasPressureCellRowCount,
    pressureInterfaceGasPressureCellRowStrideFloats: eos.value.pressureInterfaceGasPressureCellRowStrideFloats,
    pressureInterfaceGasPressureCellRowByteLength: eos.value.pressureInterfaceGasPressureCellRowByteLength,
    pressureInterfaceGasPressureCellRowsBufferRetained: true,
    pressureFieldMode: 'local-gas-cell-pressure-gradient',
    pressureFieldResolution: 'structured-gas-cell-grid',
    sourceFamilies: ['resident-gas-pressure']
  };
  const admission = {
    schema: 'peercompute.ulg.pressure-interface-gas-cell-field-admission.v0',
    status: 'pressure-interface-gas-cell-field-consumption-approved',
    gasCellFieldConsumptionApproved: true,
    retainedGasPressureBufferRefs: eos.value.retainedGasPressureBufferRefs,
    workerRetainedGasPressureBufferRefs: workerRefs,
    retainedGasCellFieldSource,
    pressureInterfaceGasPressureCellRowCount: eos.value.pressureInterfaceGasPressureCellRowCount,
    pressureInterfaceGasPressureCellRowStrideFloats: eos.value.pressureInterfaceGasPressureCellRowStrideFloats,
    pressureInterfaceGasPressureCellRowByteLength: eos.value.pressureInterfaceGasPressureCellRowByteLength,
    stateManagerAdmitted: true,
    authoritativeStateMutation: false
  };
  const pressureInterfaceGasCellFieldImport = {
    schema: 'peercompute.ulg.pressure-interface-gas-cell-field-import.v0',
    status: 'pressure-interface-gas-cell-field-import-ready',
    retainedGasPressureBufferRefs: eos.value.retainedGasPressureBufferRefs,
    workerRetainedGasPressureBufferRefs: workerRefs,
    pressureInterfaceGasPressureCellRowCount: eos.value.pressureInterfaceGasPressureCellRowCount,
    pressureInterfaceGasPressureCellRowStrideFloats: eos.value.pressureInterfaceGasPressureCellRowStrideFloats,
    pressureInterfaceGasPressureCellRowByteLength: eos.value.pressureInterfaceGasPressureCellRowByteLength,
    pressureInterfaceGasPressureCellRowsBufferRetained: true,
    gasPressureCellsBuffer: eos.value.gasPressureCellsBuffer,
    pressureInterfaceGasCellFieldAdmission: admission,
    retainedGasCellFieldSource,
    stateManagerAdmissionRequired: true,
    authoritativeStateMutation: false
  };
  context.common.pressureInterfaceGasCellFieldImport = pressureInterfaceGasCellFieldImport;
  context.common.pressureInterfaceGasCellFieldAdmission = admission;
  context.common.materialInterfaceField = {
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

  const pressure = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage('pressureInterface', ['resident-gas-pressure', 'sph-material-interface-field'], ['pressure-interface-force-rows']),
    context,
    null,
    lane
  ));

  assert.equal(
    pressure.value.workerResidentStage.workerRetainedGasCellFieldImportInputStatus,
    'applied-worker-retained-gas-cell-field-import'
  );
  assert.equal(pressure.value.workerResidentStage.workerRetainedGasCellFieldImportApplied, true);
  assert.equal(pressure.value.pressureInterfaceGasCellFieldImportReady, true);
  assert.equal(pressure.value.pressureInterfaceGasCellFieldImportRetainedGasPressureCellsBuffer, true);
  assert.equal(
    pressure.value.pressureInterfaceGasCellFieldImport.pressureInterfaceGasPressureCellRowsBufferRetained,
    true
  );
  assert.deepEqual(
    pressure.value.pressureInterfaceGasCellFieldImportWorkerRetainedGasPressureBufferRefs,
    workerRefs
  );
  assert.equal(
    pressure.value.retainedGasPressureRowsStatus,
    'retained-gas-pressure-rows-admitted-same-device'
  );
  assert.equal(
    pressure.value.workerResidentStage.workerRetainedGasCellEosReleaseScheduled,
    true
  );
  assert.equal(
    pressure.value.workerResidentStage.workerRetainedGasCellEosReleaseStatus,
    'gas-cell-eos-final-consumer-release-scheduled-after-pressure-submit'
  );
  assert.equal(
    pressure.value.workerResidentStage.workerQueueFence.finalConsumerReleaseFenceUsed,
    true
  );
  assert.equal(device.queue.submittedWorkDoneCount, queueFenceCountAfterEos + 2);
});

test('ULG resident worker keeps exact v2 gas authority internal and exports non-bindable telemetry', async () => {
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
    'worker-v2-spatial-gas-product-events',
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
    laneId: 'ulg:test:worker-v2-gas-authority-lane',
    stateKey: 'ulg:test:worker-v2-gas-authority-state'
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
    taskIdPrefix: 'ulg:test:worker-v2-gas-authority',
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
      spatialGasEpochIdentity: {
        storageGeneration: 91,
        physicsTick: 90,
        physicsSubstep: 1,
        positionEpoch: 201,
        topologyEpoch: 202,
        chartEpoch: 203,
        levelEpoch: 204,
        supportEpoch: 205
      },
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
          assert.equal(args.retainedGasPressureCellsBuffer, source.gasPressureCellsBuffer);
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
              /rejects mismatched gasPressureCellsBuffer/
            );
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
            assert.equal(importPublication.gasPressureCellsBuffer, source.gasPressureCellsBuffer);
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
            assert.equal(
              importHot.gasPressureCellsBuffer,
              source.gasPressureCellsBuffer
            );
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
            /rejects unavailable exact v2 authority lifecycle/
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
  assert.equal(spatial.value.retainedSpatialGasLedgerSourceReady, true);
  assert.equal(
    spatial.value.retainedGasCellFieldSource.schema,
    ULG_SPH_GAS_PRESSURE_AUTHORITY_TELEMETRY_SCHEMA
  );

  const eos = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage(
      'gasCellEosProducer',
      ['resident-spatial-gas-species-ledger', 'resident-product-mass'],
      ['resident-gas-pressure']
    ),
    context,
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
  assert.throws(
    () => bindSphSpatialGasPressureAuthority(telemetry, { device }),
    (error) => error?.code === 'ERR_SPH_GAS_PRESSURE_AUTHORITY_UNBRANDED'
  );
  const seen = new WeakSet();
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
    for (const nested of Object.values(value)) {
      assertTransportHasNoGasCapability(nested);
    }
  };
  assertTransportHasNoGasCapability(eos.value);

  const pressure = await runUlgMechanicsResidentStageWorkerPayload(payload(
    stage(
      'pressureInterface',
      ['resident-gas-pressure', 'sph-material-interface-field'],
      ['pressure-interface-force-rows']
    ),
    context,
    null,
    lane
  ));
  assert.ok(exactSourceObserved);
  assert.equal(hostBoundaryVerified, true);
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
  assert.ok(
    pressure.value.gpuResidentLaneRequirement.retainedBufferRefs
      .includes('resident-gas-pressure-cells-buffer')
  );
  assert.equal(pressure.value.gasPressureAuthorityConsumerSubmitted, true);
  assert.equal(
    pressure.value.workerResidentStage.workerRetainedGasCellEosReleaseStatus,
    'gas-cell-eos-final-consumer-release-scheduled-after-pressure-submit'
  );
  assert.equal(
    pressure.value.workerResidentStage.workerQueueFence.finalConsumerReleaseFenceUsed,
    true
  );

  const echoContext = {
    schema: 'peercompute.ulg.mechanics-resident-stage-worker-context.v0',
    taskIdPrefix: 'ulg:test:worker-v2-gas-authority-echo',
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
      laneId: 'ulg:test:worker-v2-gas-authority-echo-lane',
      stateKey: 'ulg:test:worker-v2-gas-authority-echo-state'
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
    omitted.value.workerResidentStage.workerQueueFence.finalConsumerReleaseFenceUsed,
    true
  );

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
    abortedDevice.queue.submittedWorkDoneCount,
    queueFenceCountBeforeAbort + 1
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
    abortedDevice.queue.submittedWorkDoneCount,
    queueFenceCountBeforeAbort + 1
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
