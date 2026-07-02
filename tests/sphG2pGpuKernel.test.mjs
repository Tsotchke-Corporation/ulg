import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mlsMpmG2pReconstructWgsl } from '../ulg-gpu-abi/src/wgsl.js';
import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT,
  ULG_MLS_MPM_GPU_GRID_UPDATE_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import {
  MLS_MPM_CONDENSED_VOLUME_STRAIN_TOLERANCE,
  MLS_MPM_G2P_MAX_RADIUS_GROWTH_RATIO,
  MLS_MPM_G2P_MAX_VOLUME_RATIO_J,
  ULG_MLS_MPM_G2P_PARTICLE_SCALE_STABILITY_SCHEMA,
  ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_PARITY_SCHEMA,
  ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_SCHEMA,
  createMlsMpmG2pParityReport,
  reconstructMlsMpmG2pCpu,
  runMlsMpmG2pWebGpu,
  runMlsMpmG2pWithOptionalWebGpu
} from '../src/runtime/sph/sphG2pGpuKernel.js';
import { MLS_MPM_GPU_GRID_VELOCITY_FLOATS } from '../src/runtime/sph/sphGridUpdateGpuKernel.js';

function nearlyEqual(actual, expected, tolerance = 1e-5) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

function nodeIndex({ gridDims, gridShift }, i, j, k) {
  const [, gny, gnz] = gridDims;
  return ((i + gridShift) * gny + (j + gridShift)) * gnz + (k + gridShift);
}

function fixture({
  position = [1.25, 1.25, 1.25],
  gridVelocity = [2, 0, 0],
  dt = 0.1,
  restVolumeM3 = 1
} = {}) {
  const state = new Float32Array([
    position[0], position[1], position[2], 8,
    0, 0, 0, 123
  ]);
  const thermo = new Float32Array(12);
  const mechanics = new Float32Array(MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length);
  mechanics.set([1, 0, 0, 0, 1, 0, 0, 0, 1], 0);
  mechanics[18] = 1;
  mechanics[19] = restVolumeM3;
  mechanics[20] = 1;
  mechanics[21] = 1;
  const gridDims = [7, 7, 7];
  const gridShift = 1;
  const gridNodeCount = gridDims[0] * gridDims[1] * gridDims[2];
  const updatedGridNodes = new Float32Array(gridNodeCount * MLS_MPM_GPU_GRID_VELOCITY_FLOATS);
  for (let i = 0; i <= 2; i += 1) for (let j = 0; j <= 2; j += 1) for (let k = 0; k <= 2; k += 1) {
    const offset = nodeIndex({ gridDims, gridShift }, i, j, k) * MLS_MPM_GPU_GRID_VELOCITY_FLOATS;
    updatedGridNodes.set([
      1,
      gridVelocity[0],
      gridVelocity[1],
      gridVelocity[2],
      i,
      j,
      k,
      1
    ], offset);
  }
  return {
    sphParticleState: {
      schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount: 1,
      state,
      thermo,
      smoothingLengthM: 1
    },
    mlsMpmParticleState: {
      schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount: 1,
      mechanics,
      mechanicsDtS: dt
    },
    gridUpdate: {
      schema: ULG_MLS_MPM_GPU_GRID_UPDATE_EXECUTION_SCHEMA,
      updateSchema: ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
      backend: 'cpu-reference',
      particleCount: 1,
      gridSpacingM: 1,
      gridDims,
      gridNodeCount,
      gridShift,
      dt,
      updatedGridNodes
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

function fakeG2pDevice() {
  const createdBuffers = [];
  const writes = [];
  const submissions = [];
  const dispatches = [];
  return {
    createdBuffers,
    writes,
    submissions,
    dispatches,
    queue: {
      writeBuffer(buffer, offset, data) {
        const byteLength = data?.byteLength ?? 0;
        if (offset + byteLength > buffer.size) {
          throw new RangeError(`writeBuffer overflow for ${buffer.label}: ${offset + byteLength} > ${buffer.size}`);
        }
        writes.push({ label: buffer.label, offset, byteLength });
      },
      submit(commands) {
        submissions.push(commands);
      },
      async onSubmittedWorkDone() {}
    },
    createBuffer({ label, size, usage }) {
      const buffer = {
        label,
        size,
        usage,
        destroyed: false,
        destroy() {
          this.destroyed = true;
        }
      };
      createdBuffers.push(buffer);
      return buffer;
    },
    createShaderModule({ code }) {
      return { code };
    },
    createComputePipeline({ compute }) {
      return {
        compute,
        getBindGroupLayout(index) {
          return { index, entryPoint: compute.entryPoint };
        }
      };
    },
    createBindGroup({ layout, entries }) {
      return { layout, entries };
    },
    createCommandEncoder() {
      return {
        beginComputePass() {
          return {
            setPipeline(pipeline) {
              this.pipeline = pipeline;
            },
            setBindGroup(index, bindGroup) {
              this.bindGroup = { index, bindGroup };
            },
            dispatchWorkgroups(count) {
              dispatches.push({ count, pipeline: this.pipeline, bindGroup: this.bindGroup?.bindGroup });
            },
            end() {
              this.ended = true;
            }
          };
        },
        copyBufferToBuffer(source, sourceOffset, destination, destinationOffset, size) {
          this.copy = { source, sourceOffset, destination, destinationOffset, size };
        },
        finish() {
          return { dispatches: [...dispatches], copy: this.copy || null };
        }
      };
    }
  };
}

test('MLS-MPM G2P WGSL declares particle and grid bindings', () => {
  assert.match(mlsMpmG2pReconstructWgsl, /struct G2pParams/);
  assert.match(mlsMpmG2pReconstructWgsl, /var<storage, read> updated_grid_nodes/);
  assert.match(mlsMpmG2pReconstructWgsl, /var<storage, read_write> out_sph_state/);
  assert.match(mlsMpmG2pReconstructWgsl, /var<storage, read_write> out_mls_mechanics/);
  assert.match(mlsMpmG2pReconstructWgsl, /@group\(0\) @binding\(7\) var<storage, read> schroeder_active_nodes/);
  assert.match(mlsMpmG2pReconstructWgsl, /fn g2p_particle_enabled/);
  assert.match(mlsMpmG2pReconstructWgsl, /fn g2p_copy_input_particle/);
  assert.match(mlsMpmG2pReconstructWgsl, /g2p_cubic_root_positive/);
  assert.match(mlsMpmG2pReconstructWgsl, /g2p_particle_wall_clearance/);
  assert.match(mlsMpmG2pReconstructWgsl, /wall_clearance = g2p_particle_wall_clearance\(row4\.w\)/);
  assert.match(mlsMpmG2pReconstructWgsl, /internal_pressure_scale: f32/);
  assert.match(mlsMpmG2pReconstructWgsl, /g2p_condensed_target_j/);
  assert.match(mlsMpmG2pReconstructWgsl, /row6\.z > 0\.5 && row6\.z < 1\.5/);
  assert.match(mlsMpmG2pReconstructWgsl, /params\.internal_pressure_scale == 0\.0/);
  assert.match(mlsMpmG2pReconstructWgsl, /if \(condensed\)/);
  assert.match(mlsMpmG2pReconstructWgsl, /g2p_clamp\(previous_j, 0\.995, 1\.005\)/);
  assert.match(mlsMpmG2pReconstructWgsl, /liquid_wall_damping_alpha: f32/);
  assert.match(mlsMpmG2pReconstructWgsl, /velocity = velocity \* keep/);
  assert.match(mlsMpmG2pReconstructWgsl, /if \(!solid\)/);
  assert.match(mlsMpmG2pReconstructWgsl, /G2P_MAX_RADIUS_GROWTH_RATIO:\s*f32\s*=\s*4\.0/);
  assert.match(mlsMpmG2pReconstructWgsl, /G2P_MAX_VOLUME_RATIO_J:\s*f32\s*=\s*64\.0/);
  assert.match(mlsMpmG2pReconstructWgsl, /next_j > G2P_MAX_VOLUME_RATIO_J/);
  assert.match(mlsMpmG2pReconstructWgsl, /next_j = G2P_MAX_VOLUME_RATIO_J/);
  assert.doesNotMatch(mlsMpmG2pReconstructWgsl, /c00 = c00 \* 0\.25/);
  assert.match(mlsMpmG2pReconstructWgsl, /@compute @workgroup_size\(64\)/);
});

test('CPU MLS-MPM G2P reconstructs velocity and advects without affine strain in constant grid flow', () => {
  const { sphParticleState, mlsMpmParticleState, gridUpdate } = fixture();
  const result = reconstructMlsMpmG2pCpu({
    sphParticleState,
    mlsMpmParticleState,
    gridUpdate,
    boxDimsM: [3, 3, 3]
  });

  assert.equal(result.schema, ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_SCHEMA);
  assert.equal(result.backend, 'cpu-reference');
  assert.equal(result.kernelScope, 'mls-mpm-g2p-velocity-affine-deformation-reconstruction');
  nearlyEqual(result.state[0], 1.45);
  nearlyEqual(result.state[4], 2);
  nearlyEqual(result.state[5], 0);
  nearlyEqual(result.mechanics[0], 1);
  nearlyEqual(result.mechanics[4], 1);
  nearlyEqual(result.mechanics[8], 1);
  nearlyEqual(result.mechanics[18], 1);
  nearlyEqual(result.mechanics[9], 0, 1e-4);
  assert.equal(result.g2pValidation, false);
  assert.equal(result.fullPhysicsValidation, false);
});

test('WebGPU MLS-MPM G2P params buffer fits the full uniform payload', async () => {
  const device = fakeG2pDevice();
  const result = await runMlsMpmG2pWebGpu({
    ...fixture(),
    device,
    boxDimsM: [3, 3, 3],
    readbackMode: 'no-full-readback'
  });
  const paramsBuffer = device.createdBuffers.find((buffer) => buffer.label === 'ulg-mls-mpm-g2p-params');
  const paramsWrite = device.writes.find((write) => write.label === 'ulg-mls-mpm-g2p-params');

  assert.equal(result.backend, 'webgpu');
  assert.equal(paramsBuffer.size, 80);
  assert.equal(paramsWrite.byteLength, 80);
  assert.equal(device.submissions.length, 1);
});

test('CPU MLS-MPM G2P renormalizes clipped active grid support for constant flow', () => {
  const { sphParticleState, mlsMpmParticleState, gridUpdate } = fixture({
    position: [0.1, 1.25, 1.25],
    gridVelocity: [3, 0, 0],
    dt: 0.1,
    restVolumeM3: 0
  });
  const result = reconstructMlsMpmG2pCpu({
    sphParticleState,
    mlsMpmParticleState,
    gridUpdate,
    dt: 0.1,
    boxDimsM: [5, 5, 5]
  });

  nearlyEqual(result.state[4], 3, 1e-5);
  nearlyEqual(result.state[0], 0.4, 1e-5);
});

test('CPU MLS-MPM G2P clamps finite-volume particle walls and inward velocity', () => {
  const { sphParticleState, mlsMpmParticleState, gridUpdate } = fixture({
    position: [0.05, 1.25, 1.25],
    gridVelocity: [-2, 0, 0],
    dt: 0.1,
    restVolumeM3: 1
  });
  const result = reconstructMlsMpmG2pCpu({
    sphParticleState,
    mlsMpmParticleState,
    gridUpdate,
    boxDimsM: [3, 3, 3]
  });

  assert.equal(result.state[0], 0.5);
  assert.equal(result.state[4], 0);
});

test('CPU MLS-MPM G2P damps condensed liquid support-wall slosh without damping solids', () => {
  const liquid = fixture({
    position: [1.25, 0.15, 1.25],
    gridVelocity: [2, 0, 0],
    dt: 0.1,
    restVolumeM3: 0.008
  });
  liquid.mlsMpmParticleState.mechanics[20] = 0;
  liquid.mlsMpmParticleState.mechanics[26] = 1;
  const solid = fixture({
    position: [1.25, 0.15, 1.25],
    gridVelocity: [2, 0, 0],
    dt: 0.1,
    restVolumeM3: 0.008
  });
  solid.mlsMpmParticleState.mechanics[20] = 1;
  solid.mlsMpmParticleState.mechanics[26] = 1;

  const liquidResult = reconstructMlsMpmG2pCpu({
    ...liquid,
    boxDimsM: [3, 3, 3],
    liquidWallDampingAlpha: 0.2,
    liquidWallDampingDistanceM: 0.2
  });
  const solidResult = reconstructMlsMpmG2pCpu({
    ...solid,
    boxDimsM: [3, 3, 3],
    liquidWallDampingAlpha: 0.2,
    liquidWallDampingDistanceM: 0.2
  });

  assert.ok(liquidResult.state[4] < 2, `expected liquid wall damping to reduce tangential speed, got ${liquidResult.state[4]}`);
  nearlyEqual(liquidResult.state[4], 1.775, 1e-5);
  nearlyEqual(solidResult.state[4], 2, 1e-5);
});

test('CPU MLS-MPM G2P bounds condensed liquid volume jumps', () => {
  const args = fixture({ gridVelocity: [0, 0, 0], dt: 0.1 });
  args.mlsMpmParticleState.mechanics[20] = 0;
  args.mlsMpmParticleState.mechanics[26] = 1;
  for (let i = 0; i <= 2; i += 1) for (let j = 0; j <= 2; j += 1) for (let k = 0; k <= 2; k += 1) {
    const offset = nodeIndex(args.gridUpdate, i, j, k) * MLS_MPM_GPU_GRID_VELOCITY_FLOATS;
    args.gridUpdate.updatedGridNodes[offset + 1] = 100 * i;
    args.gridUpdate.updatedGridNodes[offset + 2] = 100 * j;
    args.gridUpdate.updatedGridNodes[offset + 3] = 100 * k;
  }

  const result = reconstructMlsMpmG2pCpu({
    ...args,
    boxDimsM: [3, 3, 3]
  });

  const maxCondensedJ = 1 + MLS_MPM_CONDENSED_VOLUME_STRAIN_TOLERANCE;
  nearlyEqual(result.mechanics[18], maxCondensedJ, 1e-5);
  nearlyEqual(result.mechanics[0], Math.cbrt(maxCondensedJ), 1e-5);
  nearlyEqual(result.mechanics[4], Math.cbrt(maxCondensedJ), 1e-5);
  nearlyEqual(result.mechanics[8], Math.cbrt(maxCondensedJ), 1e-5);
});

test('CPU MLS-MPM G2P freezes non-solid deformation when EOS pressure is disabled', () => {
  const args = fixture({ gridVelocity: [0, 0, 0], dt: 0.1 });
  args.mlsMpmParticleState.mechanics[20] = 0;
  args.mlsMpmParticleState.mechanics[26] = 1;
  for (let i = 0; i <= 2; i += 1) for (let j = 0; j <= 2; j += 1) for (let k = 0; k <= 2; k += 1) {
    const offset = nodeIndex(args.gridUpdate, i, j, k) * MLS_MPM_GPU_GRID_VELOCITY_FLOATS;
    args.gridUpdate.updatedGridNodes[offset + 1] = 100 * i;
    args.gridUpdate.updatedGridNodes[offset + 2] = 100 * j;
    args.gridUpdate.updatedGridNodes[offset + 3] = 100 * k;
  }

  const result = reconstructMlsMpmG2pCpu({
    ...args,
    boxDimsM: [3, 3, 3],
    internalPressureScale: 0
  });

  nearlyEqual(result.mechanics[18], 1, 1e-6);
  nearlyEqual(result.mechanics[0], 1, 1e-6);
  nearlyEqual(result.mechanics[4], 1, 1e-6);
  nearlyEqual(result.mechanics[8], 1, 1e-6);
  nearlyEqual(result.mechanics[9], 0, 1e-6);
  nearlyEqual(result.mechanics[13], 0, 1e-6);
  nearlyEqual(result.mechanics[17], 0, 1e-6);
});

test('CPU MLS-MPM G2P carries condensed liquid affine strain without hidden damping', () => {
  const liquid = fixture({ gridVelocity: [0, 0, 0], dt: 0.1 });
  liquid.mlsMpmParticleState.mechanics[20] = 0;
  liquid.mlsMpmParticleState.mechanics[26] = 1;
  const gas = fixture({ gridVelocity: [0, 0, 0], dt: 0.1 });
  gas.mlsMpmParticleState.mechanics[20] = 0;
  gas.mlsMpmParticleState.mechanics[26] = 2;
  for (const args of [liquid, gas]) {
    for (let i = 0; i <= 2; i += 1) for (let j = 0; j <= 2; j += 1) for (let k = 0; k <= 2; k += 1) {
      const offset = nodeIndex(args.gridUpdate, i, j, k) * MLS_MPM_GPU_GRID_VELOCITY_FLOATS;
      args.gridUpdate.updatedGridNodes[offset + 1] = 10 * i;
      args.gridUpdate.updatedGridNodes[offset + 2] = 10 * j;
      args.gridUpdate.updatedGridNodes[offset + 3] = 10 * k;
    }
  }

  const liquidResult = reconstructMlsMpmG2pCpu({
    ...liquid,
    boxDimsM: [3, 3, 3]
  });
  const gasResult = reconstructMlsMpmG2pCpu({
    ...gas,
    boxDimsM: [3, 3, 3]
  });

  assert.ok(Math.abs(gasResult.mechanics[9]) > 1e-3, 'fixture should generate affine strain');
  nearlyEqual(liquidResult.mechanics[9], gasResult.mechanics[9], 1e-5);
  nearlyEqual(liquidResult.mechanics[13], gasResult.mechanics[13], 1e-5);
  nearlyEqual(liquidResult.mechanics[17], gasResult.mechanics[17], 1e-5);
});

test('CPU MLS-MPM G2P bounds solid volume jumps without accepting blink-scale deformation', () => {
  const args = fixture({ gridVelocity: [0, 0, 0], dt: 0.1 });
  args.mlsMpmParticleState.mechanics[20] = 1;
  for (let i = 0; i <= 2; i += 1) for (let j = 0; j <= 2; j += 1) for (let k = 0; k <= 2; k += 1) {
    const offset = nodeIndex(args.gridUpdate, i, j, k) * MLS_MPM_GPU_GRID_VELOCITY_FLOATS;
    args.gridUpdate.updatedGridNodes[offset + 1] = 100 * i;
    args.gridUpdate.updatedGridNodes[offset + 2] = 100 * j;
    args.gridUpdate.updatedGridNodes[offset + 3] = 100 * k;
  }

  const result = reconstructMlsMpmG2pCpu({
    ...args,
    boxDimsM: [3, 3, 3]
  });

  const maxCondensedJ = 1 + MLS_MPM_CONDENSED_VOLUME_STRAIN_TOLERANCE;
  nearlyEqual(result.mechanics[18], maxCondensedJ, 1e-5);
  assert.ok(result.mechanics[18] <= maxCondensedJ + 1e-5, `solid volume ratio should remain bounded, got ${result.mechanics[18]}`);
});

test('CPU MLS-MPM G2P caps non-condensed particle scale before render extraction', () => {
  const args = fixture({ gridVelocity: [0, 0, 0], dt: 0.1 });
  args.mlsMpmParticleState.mechanics[20] = 0;
  args.mlsMpmParticleState.mechanics[26] = 2;
  for (let i = 0; i <= 2; i += 1) for (let j = 0; j <= 2; j += 1) for (let k = 0; k <= 2; k += 1) {
    const offset = nodeIndex(args.gridUpdate, i, j, k) * MLS_MPM_GPU_GRID_VELOCITY_FLOATS;
    args.gridUpdate.updatedGridNodes[offset + 1] = 1000 * i;
    args.gridUpdate.updatedGridNodes[offset + 2] = 1000 * j;
    args.gridUpdate.updatedGridNodes[offset + 3] = 1000 * k;
  }

  const result = reconstructMlsMpmG2pCpu({
    ...args,
    boxDimsM: [3, 3, 3]
  });

  assert.equal(result.particleScaleStability.schema, ULG_MLS_MPM_G2P_PARTICLE_SCALE_STABILITY_SCHEMA);
  assert.equal(result.particleScaleStability.status, 'particle-scale-cap-applied');
  assert.equal(result.particleScaleStability.capCount, 1);
  assert.equal(result.particleScaleStability.maxRadiusGrowthRatioAllowed, MLS_MPM_G2P_MAX_RADIUS_GROWTH_RATIO);
  assert.equal(result.particleScaleStability.maxVolumeRatioJAllowed, MLS_MPM_G2P_MAX_VOLUME_RATIO_J);
  assert.ok(result.particleScaleStability.maxRawVolumeRatioJ > MLS_MPM_G2P_MAX_VOLUME_RATIO_J);
  assert.equal(result.mechanics[18], MLS_MPM_G2P_MAX_VOLUME_RATIO_J);
  nearlyEqual(result.mechanics[0], MLS_MPM_G2P_MAX_RADIUS_GROWTH_RATIO, 1e-5);
  nearlyEqual(result.mechanics[4], MLS_MPM_G2P_MAX_RADIUS_GROWTH_RATIO, 1e-5);
  nearlyEqual(result.mechanics[8], MLS_MPM_G2P_MAX_RADIUS_GROWTH_RATIO, 1e-5);
});

test('optional MLS-MPM G2P returns CPU reference when WebGPU is not requested', async () => {
  const args = fixture();
  const execution = await runMlsMpmG2pWithOptionalWebGpu({
    ...args,
    preferWebGpu: false,
    navigatorRef: {
      gpu: {
        async requestAdapter() {
          throw new Error('should not request WebGPU');
        }
      }
    }
  });

  assert.equal(execution.schema, ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_EXECUTION_SCHEMA);
  assert.equal(execution.backend, 'cpu-reference');
  assert.equal(execution.webgpuStatus.status, 'not-requested');
});

test('optional MLS-MPM G2P falls back when WebGPU is unavailable', async () => {
  const execution = await runMlsMpmG2pWithOptionalWebGpu({
    ...fixture(),
    preferWebGpu: true,
    navigatorRef: {}
  });

  assert.equal(execution.backend, 'cpu-reference');
  assert.equal(execution.webgpuStatus.status, 'blocked-webgpu-unavailable');
  assert.equal(execution.webgpuStatus.fallback, 'cpu-reference');
});

test('optional MLS-MPM G2P accepts a parity-passing WebGPU result', async () => {
  const execution = await runMlsMpmG2pWithOptionalWebGpu({
    ...fixture(),
    preferWebGpu: true,
    navigatorRef: webGpuNavigator(),
    async webGpuRunner(args) {
      const result = reconstructMlsMpmG2pCpu(args);
      return { ...result, backend: 'webgpu' };
    }
  });

  assert.equal(execution.backend, 'webgpu');
  assert.equal(execution.webgpuStatus.status, 'webgpu-executed');
  assert.equal(execution.webgpuParity.schema, ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_PARITY_SCHEMA);
  assert.equal(execution.webgpuParity.status, 'pass');
});

test('optional MLS-MPM G2P exposes retained output buffers after parity passes', async () => {
  const stateBuffer = { label: 'g2p-state', destroyed: false, destroy() { this.destroyed = true; } };
  const mechanicsBuffer = { label: 'g2p-mechanics', destroyed: false, destroy() { this.destroyed = true; } };
  const execution = await runMlsMpmG2pWithOptionalWebGpu({
    ...fixture(),
    preferWebGpu: true,
    retainOutputParticleBuffers: true,
    navigatorRef: webGpuNavigator(),
    async webGpuRunner(args) {
      assert.equal(args.retainOutputParticleBuffers, true);
      const result = reconstructMlsMpmG2pCpu(args);
      return {
        ...result,
        backend: 'webgpu',
        stateBuffer,
        mechanicsBuffer,
        stateBufferByteLength: result.state.byteLength,
        mechanicsBufferByteLength: result.mechanics.byteLength,
        retainedOutputParticleBuffers: true,
        destroyOutputParticleBuffers() {
          stateBuffer.destroy();
          mechanicsBuffer.destroy();
        }
      };
    }
  });

  assert.equal(execution.backend, 'webgpu');
  assert.equal(execution.retainedOutputParticleBuffers, true);
  assert.equal(execution.stateBuffer, stateBuffer);
  assert.equal(execution.mechanicsBuffer, mechanicsBuffer);
  assert.equal(execution.stateBufferByteLength, execution.state.byteLength);
  assert.equal(execution.mechanicsBufferByteLength, execution.mechanics.byteLength);
  assert.equal(stateBuffer.destroyed, false);
  assert.equal(mechanicsBuffer.destroyed, false);
  execution.destroyOutputParticleBuffers();
  assert.equal(stateBuffer.destroyed, true);
  assert.equal(mechanicsBuffer.destroyed, true);
});

test('optional MLS-MPM G2P rejects parity drift and keeps CPU output', async () => {
  let destroyed = 0;
  const execution = await runMlsMpmG2pWithOptionalWebGpu({
    ...fixture(),
    preferWebGpu: true,
    retainOutputParticleBuffers: true,
    navigatorRef: webGpuNavigator(),
    async webGpuRunner(args) {
      const result = reconstructMlsMpmG2pCpu(args);
      result.backend = 'webgpu';
      result.state = result.state.slice();
      result.state[0] += 1;
      result.stateBuffer = { destroy: () => { destroyed += 1; } };
      result.mechanicsBuffer = { destroy: () => { destroyed += 1; } };
      result.retainedOutputParticleBuffers = true;
      result.destroyOutputParticleBuffers = () => {
        result.stateBuffer.destroy();
        result.mechanicsBuffer.destroy();
      };
      return result;
    },
    parityTolerance: 1e-8
  });

  assert.equal(execution.backend, 'cpu-reference');
  assert.equal(execution.webgpuStatus.status, 'webgpu-parity-failed');
  assert.equal(execution.webgpuParity.status, 'fail');
  assert.ok(execution.webgpuParity.maxStateAbs > 0.5);
  assert.equal(destroyed, 2);
});

test('MLS-MPM G2P parity report is explicit and non-scientific', () => {
  const cpuReference = reconstructMlsMpmG2pCpu(fixture());
  const parity = createMlsMpmG2pParityReport({
    cpuReference,
    gpuResult: { ...cpuReference, backend: 'webgpu' }
  });

  assert.equal(parity.schema, ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_PARITY_SCHEMA);
  assert.equal(parity.status, 'pass');
  assert.equal(parity.scientificValidation, false);
  assert.equal(parity.sphValidation, false);
  assert.equal(parity.phaseChangeValidation, false);
  assert.equal(parity.fullPhysicsValidation, false);
});
