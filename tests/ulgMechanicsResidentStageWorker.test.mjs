import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
  MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT
} from '../ulg-gpu-abi/src/index.js';
import {
  ULG_MECHANICS_RESIDENT_STAGE_WORKER_RESULT_SCHEMA,
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

function payload(stageRecord, context, input = null) {
  return {
    stage: stageRecord,
    input,
    lease: {
      laneId: 'ulg:test:mechanics-worker-lane',
      stateKey: 'ulg:test:mechanics-worker-state',
      queueFencePolicy: 'queue.onSubmittedWorkDone-before-admission'
    },
    context: {
      ulgMechanicsResidentStageWorker: context
    }
  };
}

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
