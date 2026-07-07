import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
  MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT
} from '../ulg-gpu-abi/src/index.js';
import {
  ULG_MECHANICS_RESIDENT_STAGE_WORKER_RESULT_SCHEMA,
  exportUlgMechanicsResidentStageWorkerRetainedCompactSnapshot,
  resolveUlgMechanicsResidentStageWorkerDeviceResult,
  runUlgMechanicsResidentStageWorkerPayload
} from '../src/services/ulgMechanicsResidentStage.worker.js';

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
    createBuffer(descriptor = {}) {
      return new FakeGpuBuffer(descriptor);
    },
    createCommandEncoder() {
      const ops = [];
      return {
        copyBufferToBuffer(source, sourceOffset, target, targetOffset, size) {
          ops.push({ source, sourceOffset, target, targetOffset, size });
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
  assert.equal(eos.value.backend, 'webgpu');
  assert.equal(eos.value.pressureInterfaceGasPressureCellRowsBufferRetained, true);
  assert.ok(workerRefs.length > 0);

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
        schema: 'peercompute.ulg.sph-gpu-reaction-table.v0',
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
      reactionTable: { schema: 'peercompute.ulg.sph-gpu-reaction-table.v0', reactionCount: 1, productTermCount: 1, gasProductCount: 0 },
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
  const buffers = manualBuffers({
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
          mechanicsStrideFloats: g2pMechanicsRows.length,
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
    smoothingLengthM: buffers.sphParticleState.smoothingLengthM
  });

  assert.equal(exported.status, 'worker-retained-compact-snapshot-exported');
  assert.equal(exported.portableSnapshotAvailable, true);
  assert.equal(exported.crossPeerReplayReady, true);
  assert.equal(exported.compactBufferSnapshot.schema, 'peercompute.ulg.remote-task-graph-compact-buffer-snapshot.v0');
  assert.deepEqual([...exported.compactBufferSnapshot.sphState], [...g2pStateRows]);
  assert.deepEqual([...exported.compactBufferSnapshot.mlsMpmMechanics], [...g2pMechanicsRows]);
  assert.deepEqual([...exported.compactBufferSnapshot.sphThermo], [...buffers.sphParticleState.thermo]);
});

test('ULG resident stage worker rematerializes adopted storage from a descriptor seed and reuses it across schedules', async () => {
  const buffers = manualBuffers();
  const device = createFakeGpuDevice();
  const seed = {
    schema: 'peercompute.ulg.schroeder-adopted-particle-storage-portable-materialization-seed.v0',
    status: 'schroeder-adopted-particle-storage-portable-materialization-seed-ready',
    ready: true,
    hotBufferKey: 'ulg:sph-resident-schroeder-adopted-storage:test-seed',
    authoritativeParticleCount: buffers.sphParticleState.particleCount,
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
});
