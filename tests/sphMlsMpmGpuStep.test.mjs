import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
  MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import {
  ULG_MLS_MPM_GPU_RESIDENT_STEP_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_RESIDENT_STEP_SCHEMA,
  ULG_MLS_MPM_GPU_RESIDENT_STEPS_EXECUTION_SCHEMA,
  destroyMlsMpmResidentStepBuffers,
  destroyMlsMpmResidentStepsBuffers,
  runMlsMpmResidentStepsWithOptionalWebGpu,
  runMlsMpmResidentStepWithOptionalWebGpu
} from '../src/runtime/sph/sphMlsMpmGpuStep.js';
import { projectMlsMpmP2gGridCpu } from '../src/runtime/sph/sphGridGpuKernel.js';
import { updateMlsMpmGridCpu } from '../src/runtime/sph/sphGridUpdateGpuKernel.js';
import { reconstructMlsMpmG2pCpu } from '../src/runtime/sph/sphG2pGpuKernel.js';

function manualBuffers({
  position = [1.25, 1.25, 1.25],
  velocity = [2, 0, 0],
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

function webGpuNavigator() {
  return {
    gpu: {
      async requestAdapter() {
        return {
          async requestDevice() {
            return { lost: new Promise(() => {}) };
          }
        };
      }
    }
  };
}

function fakeBufferTracker() {
  return {
    destroyed: 0,
    buffer(label) {
      return {
        label,
        destroy: () => {
          this.destroyed += 1;
        }
      };
    }
  };
}

test('MLS-MPM resident step runs the full CPU reference chain when WebGPU is not requested', async () => {
  const buffers = manualBuffers();
  const step = await runMlsMpmResidentStepWithOptionalWebGpu({
    ...buffers,
    preferWebGpu: false,
    boxDimsM: [3, 3, 3]
  });

  assert.equal(step.schema, ULG_MLS_MPM_GPU_RESIDENT_STEP_EXECUTION_SCHEMA);
  assert.equal(step.stepSchema, ULG_MLS_MPM_GPU_RESIDENT_STEP_SCHEMA);
  assert.equal(step.backend, 'cpu-reference');
  assert.equal(step.status, 'resident-step-cpu-or-fallback');
  assert.equal(step.stageBackends.p2g, 'cpu-reference');
  assert.equal(step.stageBackends.gridUpdate, 'cpu-reference');
  assert.equal(step.stageBackends.g2p, 'cpu-reference');
  assert.equal(step.readbackMode, 'full-parity-readback');
  assert.equal(step.normalHotLoopReadbackFree, false);
  assert.equal(step.gpuAuthoritativeState, false);
  assert.equal(step.residentBuffersRetained, false);
  assert.equal(step.diagnostics.particleCount, 1);
  assert.equal(step.diagnostics.sourceMassKg, 8);
  assert.equal(step.diagnostics.massDeltaKg, 0);
  assert.ok(step.state instanceof Float32Array);
  assert.ok(step.mechanics instanceof Float32Array);
  assert.equal(step.fullPhysicsValidation, false);
});

test('MLS-MPM resident step shares retained stage buffers across WebGPU stages', async () => {
  const buffers = manualBuffers();
  const tracker = fakeBufferTracker();
  const sourceStateBuffer = tracker.buffer('source-state');
  const sourceThermoBuffer = tracker.buffer('source-thermo');
  const sourceMechanicsBuffer = tracker.buffer('source-mechanics');
  const step = await runMlsMpmResidentStepWithOptionalWebGpu({
    ...buffers,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: sourceStateBuffer,
      thermoBuffer: sourceThermoBuffer,
      slot: 0
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: sourceMechanicsBuffer,
      slot: 0
    },
    preferWebGpu: true,
    navigatorRef: webGpuNavigator(),
    boxDimsM: [3, 3, 3],
    p2gRunner(args) {
      const result = projectMlsMpmP2gGridCpu(args);
      return {
        ...result,
        backend: 'webgpu',
        gridBuffer: tracker.buffer('p2g-grid'),
        gridBufferByteLength: result.gridNodes.byteLength,
        destroyGridBuffer() {
          this.gridBuffer.destroy();
        }
      };
    },
    gridUpdateRunner(args) {
      assert.equal(args.p2gGridBuffer?.label, 'p2g-grid');
      const result = updateMlsMpmGridCpu(args);
      return {
        ...result,
        backend: 'webgpu',
        updatedGridBuffer: tracker.buffer('updated-grid'),
        updatedGridBufferByteLength: result.updatedGridNodes.byteLength,
        destroyUpdatedGridBuffer() {
          this.updatedGridBuffer.destroy();
        }
      };
    },
    g2pRunner(args) {
      assert.equal(args.updatedGridBuffer?.label, 'updated-grid');
      assert.equal(args.retainOutputParticleBuffers, true);
      const result = reconstructMlsMpmG2pCpu(args);
      return {
        ...result,
        backend: 'webgpu',
        stateBuffer: tracker.buffer('g2p-state'),
        mechanicsBuffer: tracker.buffer('g2p-mechanics'),
        stateBufferByteLength: result.state.byteLength,
        mechanicsBufferByteLength: result.mechanics.byteLength,
        retainedOutputParticleBuffers: true,
        destroyOutputParticleBuffers() {
          this.stateBuffer.destroy();
          this.mechanicsBuffer.destroy();
        }
      };
    }
  });

  assert.equal(step.backend, 'webgpu');
  assert.equal(step.status, 'resident-step-webgpu-executed');
  assert.equal(step.stageStatus.p2g, 'webgpu-executed');
  assert.equal(step.stageStatus.gridUpdate, 'webgpu-executed');
  assert.equal(step.stageStatus.g2p, 'webgpu-executed');
  assert.equal(step.residentBuffersRetained, true);
  assert.equal(step.stageBuffersRetained, true);
  assert.equal(step.g2pOutputBuffersRetained, true);
  assert.equal(step.residentBufferMode, 'retained-stage-and-output-buffers');
  assert.equal(step.nextParticleStateBufferByteLength, step.state.byteLength);
  assert.equal(step.nextParticleMechanicsBufferByteLength, step.mechanics.byteLength);
  assert.equal(step.nextParticleBufferMode, 'retained-g2p-output-buffers');
  assert.deepEqual(step.particlePingPong, {
    sourceSlot: 0,
    nextSlot: 1,
    step: 0,
    nextStep: 1,
    time: 0,
    nextTime: 0.1
  });
  assert.equal(step.nextParticleUploads.sphParticleUpload.slot, 1);
  assert.equal(step.nextParticleUploads.sphParticleUpload.ownsStateBuffer, true);
  assert.equal(step.nextParticleUploads.sphParticleUpload.ownsThermoBuffer, false);
  assert.equal(step.nextParticleUploads.sphParticleUpload.thermoBuffer, sourceThermoBuffer);
  assert.equal(step.nextParticleUploads.mlsMpmParticleUpload.slot, 1);
  assert.equal(step.nextParticleUploads.mlsMpmParticleUpload.ownsMechanicsBuffer, true);
  assert.equal(step.diagnostics.activeGridNodeCount > 0, true);
  assert.equal(step.diagnostics.sourceMomentumKgMPerS[0], 16);
  assert.equal(Number.isFinite(step.diagnostics.maxSpeedMPerS), true);
  assert.equal(tracker.destroyed, 0);
  destroyMlsMpmResidentStepBuffers(step);
  assert.equal(tracker.destroyed, 4);
});

test('MLS-MPM resident step falls forward through CPU stages after a WebGPU parity failure', async () => {
  const buffers = manualBuffers();
  const step = await runMlsMpmResidentStepWithOptionalWebGpu({
    ...buffers,
    preferWebGpu: true,
    navigatorRef: webGpuNavigator(),
    boxDimsM: [3, 3, 3],
    p2gRunner(args) {
      const result = projectMlsMpmP2gGridCpu(args);
      result.gridNodes = result.gridNodes.slice();
      result.gridNodes[0] += 100;
      return { ...result, backend: 'webgpu' };
    },
    parityTolerances: { p2g: 1e-9 }
  });

  assert.equal(step.backend, 'cpu-reference');
  assert.equal(step.stageStatus.p2g, 'webgpu-parity-failed');
  assert.equal(step.stageBackends.p2g, 'cpu-reference');
  assert.equal(step.stageBackends.gridUpdate, 'cpu-reference');
  assert.equal(step.stageBackends.g2p, 'cpu-reference');
  assert.equal(step.residentBuffersRetained, false);
  assert.equal(step.fullPhysicsValidation, false);
});

test('MLS-MPM resident step can retain buffers without full readback', async () => {
  const buffers = manualBuffers();
  const tracker = fakeBufferTracker();
  const sourceThermoBuffer = tracker.buffer('source-thermo');
  const p2gInputs = [];
  const step = await runMlsMpmResidentStepWithOptionalWebGpu({
    ...buffers,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state'),
      thermoBuffer: sourceThermoBuffer,
      slot: 0
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: tracker.buffer('source-mechanics'),
      slot: 0
    },
    preferWebGpu: true,
    navigatorRef: webGpuNavigator(),
    boxDimsM: [3, 3, 3],
    readbackMode: 'no-full-readback',
    p2gRunner(args) {
      p2gInputs.push({
        readbackMode: args.readbackMode,
        stateBufferLabel: args.sphParticleUpload?.stateBuffer?.label ?? null
      });
      return {
        schema: ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
        backend: 'webgpu',
        status: 'projected',
        particleCount: buffers.sphParticleState.particleCount,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridNodeCount: 512,
        gridShift: 1,
        gridNodeStrideFloats: 8,
        gridNodes: new Float32Array(),
        gridBuffer: tracker.buffer('p2g-grid-unread'),
        gridBufferByteLength: 512 * 8 * Float32Array.BYTES_PER_ELEMENT,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyGridBuffer() {
          this.gridBuffer.destroy();
        }
      };
    },
    gridUpdateRunner(args) {
      assert.equal(args.readbackMode, 'no-full-readback');
      assert.equal(args.p2gGridBuffer?.label, 'p2g-grid-unread');
      return {
        schema: ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
        backend: 'webgpu',
        status: 'updated',
        sourceSchema: args.p2gGridProjection.schema,
        particleCount: buffers.sphParticleState.particleCount,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridNodeCount: 512,
        gridShift: 1,
        gridNodeStrideFloats: 8,
        updatedGridNodes: new Float32Array(),
        updatedGridBuffer: tracker.buffer('updated-grid-unread'),
        updatedGridBufferByteLength: 512 * 8 * Float32Array.BYTES_PER_ELEMENT,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyUpdatedGridBuffer() {
          this.updatedGridBuffer.destroy();
        }
      };
    },
    g2pRunner(args) {
      assert.equal(args.readbackMode, 'no-full-readback');
      assert.equal(args.updatedGridBuffer?.label, 'updated-grid-unread');
      assert.equal(args.retainOutputParticleBuffers, true);
      return {
        schema: ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_SCHEMA,
        backend: 'webgpu',
        status: 'reconstructed',
        particleCount: buffers.sphParticleState.particleCount,
        gridNodeCount: 512,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridShift: 1,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        stateStrideFloats: 8,
        thermoStrideFloats: 12,
        mechanicsStrideFloats: 32,
        state: new Float32Array(),
        mechanics: new Float32Array(),
        stateBuffer: tracker.buffer('g2p-state-unread'),
        mechanicsBuffer: tracker.buffer('g2p-mechanics-unread'),
        stateBufferByteLength: buffers.sphParticleState.state.byteLength,
        mechanicsBufferByteLength: buffers.mlsMpmParticleState.mechanics.byteLength,
        retainedOutputParticleBuffers: true,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyOutputParticleBuffers() {
          this.stateBuffer.destroy();
          this.mechanicsBuffer.destroy();
        }
      };
    }
  });

  assert.equal(p2gInputs[0].readbackMode, 'no-full-readback');
  assert.equal(p2gInputs[0].stateBufferLabel, 'source-state');
  assert.equal(step.backend, 'webgpu');
  assert.equal(step.status, 'resident-step-webgpu-executed');
  assert.equal(step.stageStatus.p2g, 'webgpu-executed-no-full-readback');
  assert.equal(step.stageStatus.gridUpdate, 'webgpu-executed-no-full-readback');
  assert.equal(step.stageStatus.g2p, 'webgpu-executed-no-full-readback');
  assert.equal(step.readbackMode, 'no-full-readback');
  assert.equal(step.normalHotLoopReadbackFree, true);
  assert.equal(step.renderStateReadbackAvailable, false);
  assert.equal(step.gpuAuthoritativeState, false);
  assert.equal(step.residentBuffersRetained, true);
  assert.equal(step.nextParticleBufferMode, 'retained-g2p-output-buffers');
  assert.equal(step.nextParticleStateBufferByteLength, buffers.sphParticleState.state.byteLength);
  assert.equal(step.nextParticleMechanicsBufferByteLength, buffers.mlsMpmParticleState.mechanics.byteLength);
  assert.equal(step.state.length, 0);
  assert.equal(step.mechanics.length, 0);
  assert.equal(step.p2gGridProjection.webgpuParity.status, 'not-run-no-full-readback');
  assert.equal(step.gridUpdate.webgpuParity.status, 'not-run-no-full-readback');
  assert.equal(step.g2pReconstruction.webgpuParity.status, 'not-run-no-full-readback');
  assert.equal(step.diagnostics.activeGridNodeCount, null);
  assert.equal(step.diagnostics.massDeltaKg, null);
  assert.equal(step.diagnostics.compactGpuSummaryAvailable, false);
  assert.equal(step.nextParticleUploads.sphParticleUpload.thermoBuffer, sourceThermoBuffer);
  assert.equal(tracker.destroyed, 0);
  destroyMlsMpmResidentStepBuffers(step);
  assert.equal(tracker.destroyed, 4);
});

test('MLS-MPM resident steps ping-pong retained particle buffers across repeated steps', async () => {
  const buffers = manualBuffers();
  const tracker = fakeBufferTracker();
  const sourceThermoBuffer = tracker.buffer('source-thermo');
  const p2gInputs = [];
  const execution = await runMlsMpmResidentStepsWithOptionalWebGpu({
    ...buffers,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state'),
      thermoBuffer: sourceThermoBuffer,
      slot: 0
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: tracker.buffer('source-mechanics'),
      slot: 0
    },
    stepCount: 2,
    preferWebGpu: true,
    navigatorRef: webGpuNavigator(),
    boxDimsM: [3, 3, 3],
    p2gRunner(args) {
      p2gInputs.push({
        stateBufferLabel: args.sphParticleUpload?.stateBuffer?.label ?? null,
        mechanicsBufferLabel: args.mlsMpmParticleUpload?.mechanicsBuffer?.label ?? null
      });
      const result = projectMlsMpmP2gGridCpu(args);
      return {
        ...result,
        backend: 'webgpu',
        gridBuffer: tracker.buffer(`p2g-grid-${p2gInputs.length}`),
        destroyGridBuffer() {
          this.gridBuffer.destroy();
        }
      };
    },
    gridUpdateRunner(args) {
      const result = updateMlsMpmGridCpu(args);
      return {
        ...result,
        backend: 'webgpu',
        updatedGridBuffer: tracker.buffer(`updated-grid-${p2gInputs.length}`),
        destroyUpdatedGridBuffer() {
          this.updatedGridBuffer.destroy();
        }
      };
    },
    g2pRunner(args) {
      const result = reconstructMlsMpmG2pCpu(args);
      return {
        ...result,
        backend: 'webgpu',
        stateBuffer: tracker.buffer(`g2p-state-${p2gInputs.length}`),
        mechanicsBuffer: tracker.buffer(`g2p-mechanics-${p2gInputs.length}`),
        stateBufferByteLength: result.state.byteLength,
        mechanicsBufferByteLength: result.mechanics.byteLength,
        retainedOutputParticleBuffers: true,
        destroyOutputParticleBuffers() {
          this.stateBuffer.destroy();
          this.mechanicsBuffer.destroy();
        }
      };
    }
  });

  assert.equal(execution.schema, ULG_MLS_MPM_GPU_RESIDENT_STEPS_EXECUTION_SCHEMA);
  assert.equal(execution.stepCount, 2);
  assert.equal(execution.completedStepCount, 2);
  assert.equal(execution.retainedIntermediateStepCount, 0);
  assert.equal(execution.finalStep.particlePingPong.sourceSlot, 1);
  assert.equal(execution.finalStep.particlePingPong.nextSlot, 0);
  assert.equal(execution.finalStep.particlePingPong.step, 1);
  assert.equal(execution.finalStep.particlePingPong.nextStep, 2);
  assert.equal(execution.stepSummaries[0].particlePingPong.sourceSlot, 0);
  assert.equal(execution.stepSummaries[0].particlePingPong.nextSlot, 1);
  assert.equal(execution.stepSummaries[1].particlePingPong.sourceSlot, 1);
  assert.equal(execution.stepSummaries[1].particlePingPong.nextSlot, 0);
  assert.equal(p2gInputs[0].stateBufferLabel, 'source-state');
  assert.equal(p2gInputs[1].stateBufferLabel, 'g2p-state-1');
  assert.equal(p2gInputs[1].mechanicsBufferLabel, 'g2p-mechanics-1');
  assert.equal(execution.finalStep.nextParticleUploads.sphParticleUpload.thermoBuffer, sourceThermoBuffer);
  assert.equal(tracker.destroyed, 4);
  destroyMlsMpmResidentStepsBuffers(execution);
  assert.equal(tracker.destroyed, 8);
});

test('MLS-MPM resident steps ping-pong unread retained buffers across repeated steps', async () => {
  const buffers = manualBuffers();
  const tracker = fakeBufferTracker();
  const sourceThermoBuffer = tracker.buffer('source-thermo');
  const p2gInputs = [];
  const execution = await runMlsMpmResidentStepsWithOptionalWebGpu({
    ...buffers,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: tracker.buffer('source-state'),
      thermoBuffer: sourceThermoBuffer,
      slot: 0
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: tracker.buffer('source-mechanics'),
      slot: 0
    },
    stepCount: 2,
    preferWebGpu: true,
    navigatorRef: webGpuNavigator(),
    boxDimsM: [3, 3, 3],
    readbackMode: 'no-full-readback',
    p2gRunner(args) {
      p2gInputs.push({
        readbackMode: args.readbackMode,
        stateBufferLabel: args.sphParticleUpload?.stateBuffer?.label ?? null,
        mechanicsBufferLabel: args.mlsMpmParticleUpload?.mechanicsBuffer?.label ?? null,
        cpuStateStale: args.sphParticleState?.cpuStateStale ?? false
      });
      const index = p2gInputs.length;
      return {
        schema: ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
        backend: 'webgpu',
        status: 'projected',
        particleCount: buffers.sphParticleState.particleCount,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridNodeCount: 512,
        gridShift: 1,
        gridNodeStrideFloats: 8,
        gridNodes: new Float32Array(),
        gridBuffer: tracker.buffer(`p2g-grid-unread-${index}`),
        gridBufferByteLength: 512 * 8 * Float32Array.BYTES_PER_ELEMENT,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyGridBuffer() {
          this.gridBuffer.destroy();
        }
      };
    },
    gridUpdateRunner(args) {
      const index = p2gInputs.length;
      return {
        schema: ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
        backend: 'webgpu',
        status: 'updated',
        sourceSchema: args.p2gGridProjection.schema,
        particleCount: buffers.sphParticleState.particleCount,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridNodeCount: 512,
        gridShift: 1,
        gridNodeStrideFloats: 8,
        updatedGridNodes: new Float32Array(),
        updatedGridBuffer: tracker.buffer(`updated-grid-unread-${index}`),
        updatedGridBufferByteLength: 512 * 8 * Float32Array.BYTES_PER_ELEMENT,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyUpdatedGridBuffer() {
          this.updatedGridBuffer.destroy();
        }
      };
    },
    g2pRunner(args) {
      const index = p2gInputs.length;
      return {
        schema: ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_SCHEMA,
        backend: 'webgpu',
        status: 'reconstructed',
        particleCount: buffers.sphParticleState.particleCount,
        gridNodeCount: 512,
        gridSpacingM: buffers.sphParticleState.smoothingLengthM,
        gridDims: [8, 8, 8],
        gridShift: 1,
        dt: buffers.mlsMpmParticleState.mechanicsDtS,
        stateStrideFloats: 8,
        thermoStrideFloats: 12,
        mechanicsStrideFloats: 32,
        state: new Float32Array(),
        mechanics: new Float32Array(),
        stateBuffer: tracker.buffer(`g2p-state-unread-${index}`),
        mechanicsBuffer: tracker.buffer(`g2p-mechanics-unread-${index}`),
        stateBufferByteLength: buffers.sphParticleState.state.byteLength,
        mechanicsBufferByteLength: buffers.mlsMpmParticleState.mechanics.byteLength,
        retainedOutputParticleBuffers: true,
        readbackMode: 'no-full-readback',
        normalHotLoopReadbackFree: true,
        destroyOutputParticleBuffers() {
          this.stateBuffer.destroy();
          this.mechanicsBuffer.destroy();
        }
      };
    }
  });

  assert.equal(execution.readbackMode, 'no-full-readback');
  assert.equal(execution.normalHotLoopReadbackFree, true);
  assert.equal(execution.renderStateReadbackAvailable, false);
  assert.equal(execution.gpuAuthoritativeState, false);
  assert.equal(execution.finalStep.particlePingPong.sourceSlot, 1);
  assert.equal(execution.finalStep.particlePingPong.nextSlot, 0);
  assert.equal(execution.stepSummaries[0].readbackMode, 'no-full-readback');
  assert.equal(execution.stepSummaries[1].readbackMode, 'no-full-readback');
  assert.equal(execution.stepSummaries[0].normalHotLoopReadbackFree, true);
  assert.equal(execution.stepSummaries[1].normalHotLoopReadbackFree, true);
  assert.equal(p2gInputs[0].stateBufferLabel, 'source-state');
  assert.equal(p2gInputs[1].stateBufferLabel, 'g2p-state-unread-1');
  assert.equal(p2gInputs[1].mechanicsBufferLabel, 'g2p-mechanics-unread-1');
  assert.equal(p2gInputs[1].cpuStateStale, true);
  assert.equal(execution.finalStep.state.length, 0);
  assert.equal(execution.finalStep.diagnostics.massDeltaKg, null);
  assert.equal(execution.finalStep.nextParticleUploads.sphParticleUpload.thermoBuffer, sourceThermoBuffer);
  assert.equal(tracker.destroyed, 4);
  destroyMlsMpmResidentStepsBuffers(execution);
  assert.equal(tracker.destroyed, 8);
});
