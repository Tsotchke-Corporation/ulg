import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import {
  ULG_MLS_MPM_GPU_RESIDENT_STEP_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_RESIDENT_STEP_SCHEMA,
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
  const step = await runMlsMpmResidentStepWithOptionalWebGpu({
    ...buffers,
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
      return { ...reconstructMlsMpmG2pCpu(args), backend: 'webgpu' };
    }
  });

  assert.equal(step.backend, 'webgpu');
  assert.equal(step.status, 'resident-step-webgpu-executed');
  assert.equal(step.stageStatus.p2g, 'webgpu-executed');
  assert.equal(step.stageStatus.gridUpdate, 'webgpu-executed');
  assert.equal(step.stageStatus.g2p, 'webgpu-executed');
  assert.equal(step.residentBuffersRetained, true);
  assert.equal(step.residentBufferMode, 'retained-stage-buffers');
  assert.equal(step.diagnostics.activeGridNodeCount > 0, true);
  assert.equal(step.diagnostics.sourceMomentumKgMPerS[0], 16);
  assert.equal(Number.isFinite(step.diagnostics.maxSpeedMPerS), true);
  assert.equal(tracker.destroyed, 0);
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
