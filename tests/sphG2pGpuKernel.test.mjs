import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  mlsMpmG2pReconstructWgsl,
  mlsMpmParticleSeparationApplyWgsl,
  mlsMpmParticleSeparationBinFillWgsl,
  mlsMpmParticleSeparationComputeWgsl
} from '../ulg-gpu-abi/src/wgsl.js';
import {
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_SEPARATION_V1
} from '../ulg-gpu-abi/src/schroederSpatialExactNear.js';
import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT,
  SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY,
  ULG_MLS_MPM_GPU_GRID_UPDATE_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import {
  ULG_SCHROEDER_SPATIAL_EPOCH_GENERATION_SCHEMA
} from '../src/runtime/sph/schroederSpatialEpochGpu.js';
import {
  MLS_MPM_CONDENSED_VOLUME_STRAIN_TOLERANCE,
  MLS_MPM_G2P_MAX_RADIUS_GROWTH_RATIO,
  MLS_MPM_G2P_MAX_VOLUME_RATIO_J,
  ULG_MLS_MPM_G2P_PARTICLE_SCALE_STABILITY_SCHEMA,
  ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_PARITY_SCHEMA,
  ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_SCHEMA,
  applyMlsMpmParticleSeparationCpu,
  createMlsMpmG2pParityReport,
  encodeMlsMpmParticleSeparationPasses,
  reconstructMlsMpmG2pCpu,
  runMlsMpmG2pWebGpu,
  runMlsMpmG2pWithOptionalWebGpu
} from '../src/runtime/sph/sphG2pGpuKernel.js';
import { MLS_MPM_GPU_GRID_VELOCITY_FLOATS } from '../src/runtime/sph/sphGridUpdateGpuKernel.js';
import { tagWebGpuBufferDevice } from '../src/runtime/sph/sphGpuDeviceIdentity.js';

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

function twoParticleFixture() {
  const args = fixture({ position: [1.25, 1.25, 1.25], restVolumeM3: 1 });
  const state = new Float32Array(args.sphParticleState.state.length * 2);
  state.set(args.sphParticleState.state, 0);
  state.set(args.sphParticleState.state, args.sphParticleState.state.length);
  state[8] = 1.5;
  state[15] = 124;
  const thermo = new Float32Array(args.sphParticleState.thermo.length * 2);
  thermo.set(args.sphParticleState.thermo, 0);
  thermo.set(args.sphParticleState.thermo, args.sphParticleState.thermo.length);
  const mechanics = new Float32Array(args.mlsMpmParticleState.mechanics.length * 2);
  mechanics.set(args.mlsMpmParticleState.mechanics, 0);
  mechanics.set(
    args.mlsMpmParticleState.mechanics,
    args.mlsMpmParticleState.mechanics.length
  );
  return {
    sphParticleState: {
      ...args.sphParticleState,
      particleCount: 2,
      state,
      thermo
    },
    mlsMpmParticleState: {
      ...args.mlsMpmParticleState,
      particleCount: 2,
      mechanics
    },
    gridUpdate: {
      ...args.gridUpdate,
      particleCount: 2
    }
  };
}

function canonicalSpatialGenerationFixture(device, { evidenceBufferSize = 80 } = {}) {
  const exactNearQueryProfile = Object.freeze({
    status: 'schroeder-spatial-exact-near-query-profile-ready',
    ready: true,
    sourceAdapterId: SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY,
    chartId: 0,
    minLevel: 0,
    maxLevel: 3,
    levelCount: 4,
    baseGridSpacingM: 0.25,
    positionEpoch: 29,
    supportEpoch: 71
  });
  const directoryBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'retained-schroeder-spatial-directory',
    size: 512,
    usage: 128
  }), device);
  const evidenceBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'retained-schroeder-spatial-evidence',
    size: evidenceBufferSize,
    usage: 128
  }), device);
  const execution = {
    schema: ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA,
    submitPerformed: true,
    released: false,
    directoryBuffer,
    evidenceBuffer,
    evidenceBufferByteLength: evidenceBufferSize,
    sourceAdapterId: SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY,
    exactNearQueryProfile,
    queryGeometryEvidence: exactNearQueryProfile,
    generationId: 17,
    storageGeneration: 23,
    positionEpoch: 29,
    topologyEpoch: 31,
    deviceOrdinal: 37,
    laneOrdinal: 41,
    leaseToken: 43,
    sourceFamilyId: 47,
    physicsTick: 53,
    physicsSubstep: 59,
    chartEpoch: 61,
    levelEpoch: 67,
    supportEpoch: 71,
    layout: { byteLength: 512 }
  };
  return {
    directoryBuffer,
    evidenceBuffer,
    exactNearQueryProfile,
    generation: {
      schema: ULG_SCHROEDER_SPATIAL_EPOCH_GENERATION_SCHEMA,
      selected: true,
      ready: true,
      source: { phaseVolumeAssignmentOverlayEnabled: false },
      execution
    }
  };
}

function canonicalMechanicalProposalFixture(device, generation) {
  const proposalBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'retained-schroeder-spatial-mechanical-proposals',
    size: 128,
    usage: 128
  }), device);
  const evidenceBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'retained-schroeder-spatial-mechanical-evidence',
    size: 80,
    usage: 128
  }), device);
  const separationReceipt = Object.freeze({
    status: 'schroeder-spatial-epoch-consumer-receipt-finalized',
    gpuAuthenticated: true,
    consumerId: 'separation',
    supportProfileId: SCHROEDER_SPATIAL_SUPPORT_PROFILE_SEPARATION_V1,
    generationId: generation.execution.generationId,
    traversalCount: 1,
    privateLookupBuildCount: 0,
    fixedCandidateBuildCount: 0,
    exhaustiveTraversalCount: 0
  });
  return Object.freeze({
    schema: 'peercompute.ulg.schroeder-spatial-mechanical-proposal.v1',
    status: 'schroeder-spatial-mechanical-proposal-submitted',
    ready: true,
    generation,
    generationId: generation.execution.generationId,
    supportEpoch: generation.execution.supportEpoch,
    traversalCount: 1,
    privateBuildCount: 0,
    fixedCandidateBuildCount: 0,
    exhaustiveTraversalCount: 0,
    fullParticleReadbackPerformed: false,
    releaseScheduled: false,
    released: false,
    proposalBuffer,
    evidence: Object.freeze({ buffer: evidenceBuffer }),
    consumerReceipt(consumerId) {
      return consumerId === 'separation' ? separationReceipt : null;
    },
    encodeApply(encoder) {
      const pass = encoder.beginComputePass({
        label: 'ulg-schroeder-spatial-mechanical-proposal-apply'
      });
      pass.setPipeline({
        label: 'ulg-schroeder-spatial-mechanical-proposal-apply'
      });
      pass.dispatchWorkgroups(1);
      pass.end();
      return true;
    }
  });
}

function liquidSeparationPair() {
  const state = new Float32Array(2 * 8);
  state.set([2, 2, 2, 1, 1, 0, 0, 0], 0);
  state.set([2.5, 2, 2, 1, -1, 0, 0, 0], 8);
  const mechanics = new Float32Array(2 * MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length);
  for (let index = 0; index < 2; index += 1) {
    const offset = index * MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length;
    mechanics.set([1, 0, 0, 0, 1, 0, 0, 0, 1], offset);
    mechanics[offset + 18] = 1;
    mechanics[offset + 19] = 1;
    mechanics[offset + 20] = 0;
    mechanics[offset + 26] = 1;
  }
  return { state, mechanics };
}

test('excluded-volume projection separates position without implicitly erasing liquid velocity', () => {
  const undamped = liquidSeparationPair();
  const legacy = liquidSeparationPair();
  const partial = liquidSeparationPair();
  const velocityOnly = liquidSeparationPair();

  applyMlsMpmParticleSeparationCpu({
    ...undamped,
    particleCount: 2,
    relaxation: 0.5,
    normalVelocityDamping: 0
  });
  applyMlsMpmParticleSeparationCpu({
    ...legacy,
    particleCount: 2,
    relaxation: 0.5,
    normalVelocityDamping: 1
  });
  applyMlsMpmParticleSeparationCpu({
    ...partial,
    particleCount: 2,
    relaxation: 0.5,
    normalVelocityDamping: 0.25
  });
  applyMlsMpmParticleSeparationCpu({
    ...velocityOnly,
    particleCount: 2,
    relaxation: 0,
    normalVelocityDamping: 1
  });

  assert.deepEqual(
    [undamped.state[0], undamped.state[8]],
    [legacy.state[0], legacy.state[8]],
    'position projection is independent of velocity damping'
  );
  assert.deepEqual([undamped.state[4], undamped.state[12]], [1, -1]);
  assert.deepEqual([legacy.state[4], legacy.state[12]], [0, 0]);
  assert.deepEqual([partial.state[4], partial.state[12]], [0.75, -0.75]);
  assert.deepEqual([velocityOnly.state[0], velocityOnly.state[8]], [2, 2.5]);
  assert.deepEqual([velocityOnly.state[4], velocityOnly.state[12]], [0, 0]);
  assert.equal(undamped.state[4] + undamped.state[12], 0);
  assert.equal(partial.state[4] + partial.state[12], 0);
});

test('excluded-volume WGSL packs independent pair-normal velocity damping in the fixed uniform', () => {
  for (const source of [
    mlsMpmParticleSeparationBinFillWgsl,
    mlsMpmParticleSeparationComputeWgsl,
    mlsMpmParticleSeparationApplyWgsl
  ]) {
    assert.match(source, /normal_velocity_damping: f32/);
    assert.match(
      source,
      /params\.relaxation <= 0\.0 && params\.normal_velocity_damping <= 0\.0/
    );
    assert.doesNotMatch(source, /params\.enabled/);
  }
  assert.match(
    mlsMpmParticleSeparationComputeWgsl,
    /dv = dv - params\.normal_velocity_damping \* share \* approach \* normal/
  );
});

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
  const clears = [];
  const bindGroups = [];
  const bindGroupLayouts = [];
  const pipelineLayouts = [];
  const pipelines = [];
  return {
    createdBuffers,
    writes,
    submissions,
    dispatches,
    clears,
    bindGroups,
    bindGroupLayouts,
    pipelineLayouts,
    pipelines,
    queue: {
      writeBuffer(buffer, offset, data) {
        const byteLength = data?.byteLength ?? 0;
        if (offset + byteLength > buffer.size) {
          throw new RangeError(`writeBuffer overflow for ${buffer.label}: ${offset + byteLength} > ${buffer.size}`);
        }
        const sourceBytes = data instanceof ArrayBuffer
          ? new Uint8Array(data)
          : (ArrayBuffer.isView(data)
              ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
              : new Uint8Array());
        writes.push({
          buffer,
          label: buffer.label,
          offset,
          byteLength,
          data: sourceBytes.slice().buffer
        });
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
    createShaderModule({ label, code }) {
      return { label, code };
    },
    createBindGroupLayout({ label, entries }) {
      const layout = { label, entries };
      bindGroupLayouts.push(layout);
      return layout;
    },
    createPipelineLayout({ label, bindGroupLayouts: layouts }) {
      const layout = { label, bindGroupLayouts: layouts };
      pipelineLayouts.push(layout);
      return layout;
    },
    createComputePipeline({ label, layout, compute }) {
      const pipeline = {
        label,
        layout,
        compute,
        getBindGroupLayout(index) {
          return { index, entryPoint: compute.entryPoint };
        }
      };
      pipelines.push(pipeline);
      return pipeline;
    },
    createBindGroup({ layout, entries }) {
      const bindGroup = { layout, entries };
      bindGroups.push(bindGroup);
      return bindGroup;
    },
    createCommandEncoder() {
      return {
        clearBuffer(buffer, offset, size) {
          clears.push({ buffer, offset, size });
        },
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
  assert.match(mlsMpmG2pReconstructWgsl, /@group\(0\) @binding\(7\) var<storage, read> schroeder_level_assignments/);
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
  assert.match(mlsMpmG2pReconstructWgsl, /g2p_clamp\(previous_j, 0\.95, 1\.05\)/);
  assert.match(mlsMpmG2pReconstructWgsl, /liquid_wall_damping_alpha: f32/);
  assert.match(mlsMpmG2pReconstructWgsl, /velocity = velocity \* keep/);
  assert.match(mlsMpmG2pReconstructWgsl, /if \(!solid\)/);
  assert.match(mlsMpmG2pReconstructWgsl, /G2P_MAX_RADIUS_GROWTH_RATIO:\s*f32\s*=\s*4\.0/);
  assert.match(mlsMpmG2pReconstructWgsl, /G2P_MAX_VOLUME_RATIO_J:\s*f32\s*=\s*64\.0/);
  // Gas expands to the vacuum density floor (J_max 1000) while condensed
  // phases keep the 64x cap; the bound is selected per-particle from the EOS id.
  assert.match(mlsMpmG2pReconstructWgsl, /next_j > g2p_max_volume_ratio_j\(row6\.z\)/);
  assert.match(mlsMpmG2pReconstructWgsl, /G2P_MAX_VOLUME_RATIO_J_GAS: f32 = 1000\.0/);
  assert.match(mlsMpmG2pReconstructWgsl, /next_j = max_volume_ratio_j/);
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

test('WebGPU MLS-MPM G2P applies one authenticated resident proposal under the selected epoch', async () => {
  const device = fakeG2pDevice();
  const {
    generation,
    directoryBuffer,
    evidenceBuffer,
    exactNearQueryProfile
  } = canonicalSpatialGenerationFixture(device);
  let legacyAssignmentPropertyReads = 0;
  const contradictoryMalformedAssignment = new Proxy({
    particleCount: -99,
    assignmentStrideFloats: 'not-a-stride',
    assignmentBuffer: { label: 'wrong-device-legacy-assignment' },
    assignments: new Uint8Array([255]),
    selectedLevel: -17
  }, {
    get(target, property, receiver) {
      legacyAssignmentPropertyReads += 1;
      return Reflect.get(target, property, receiver);
    }
  });
  const mechanicalProposal = canonicalMechanicalProposalFixture(device, generation);

  const result = await runMlsMpmG2pWebGpu({
    ...twoParticleFixture(),
    device,
    boxDimsM: [3, 3, 3],
    readbackMode: 'no-full-readback',
    schroederLevelAssignment: contradictoryMalformedAssignment,
    schroederSelectedLevel: 2,
    schroederSpatialEpochGeneration: generation,
    schroederSpatialMechanicalProposal: mechanicalProposal,
    canonicalSpatialRequired: true,
    observeCanonicalSpatialAuthority: true
  });

  assert.equal(legacyAssignmentPropertyReads, 0);
  assert.equal(evidenceBuffer.size, 80);
  assert.equal(generation.execution.sourceAdapterId, SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY);
  assert.equal(generation.execution.exactNearQueryProfile, exactNearQueryProfile);
  assert.equal(generation.execution.queryGeometryEvidence, exactNearQueryProfile);
  assert.equal(result.backend, 'webgpu');
  assert.equal(result.schroederSpatialAuthorityEnabled, true);
  assert.equal(
    result.schroederSpatialAuthorityStatus,
    'canonical-spatial-directory-bound-for-g2p-level-admission'
  );
  assert.equal(result.schroederAuthorityBindingMode, 'canonical-spatial-epoch');
  assert.equal(result.oldLevelAssignmentLookupRemoved, true);
  assert.equal(result.schroederLevelFilter.authorityBindingMode, 'canonical-spatial-epoch');
  assert.equal(result.schroederLevelFilter.oldLevelAssignmentLookupRemoved, true);
  assert.equal(result.schroederLevelFilter.assignmentBufferSource, null);
  assert.equal(result.schroederLevelFilter.retainedAssignmentBuffer, false);
  assert.equal(result.separationCanonicalSpatialAuthorityGate, true);
  assert.equal(device.submissions.length, 1);
  assert.equal(device.dispatches.length, 3);
  assert.equal(
    device.createdBuffers.some((buffer) => String(buffer.label).includes('level-assignments')),
    false
  );

  const g2pDispatch = device.dispatches.find(
    (dispatch) => dispatch.pipeline?.label === 'ulg-mls-mpm-g2p-reconstruct'
  );
  assert.ok(g2pDispatch);
  const g2pShader = g2pDispatch.pipeline.compute.module.code;
  assert.match(
    g2pShader,
    /@group\(0\) @binding\(7\) var<storage, read_write> schroeder_spatial_authority_evidence/
  );
  assert.match(
    g2pShader,
    /@group\(0\) @binding\(8\) var<storage, read> schroeder_spatial_directory/
  );
  assert.doesNotMatch(g2pShader, /schroeder_level_assignments/);
  const g2pLayoutEntries = g2pDispatch.pipeline.layout.bindGroupLayouts[0].entries;
  assert.equal(
    g2pLayoutEntries.find((entry) => entry.binding === 7)?.buffer?.type,
    'storage'
  );
  assert.equal(
    g2pLayoutEntries.find((entry) => entry.binding === 8)?.buffer?.type,
    'read-only-storage'
  );
  assert.equal(
    g2pDispatch.bindGroup.entries.find((entry) => entry.binding === 7)?.resource?.buffer,
    evidenceBuffer
  );
  assert.equal(
    g2pDispatch.bindGroup.entries.find((entry) => entry.binding === 8)?.resource?.buffer,
    directoryBuffer
  );
  const g2pFinalizeDispatch = device.dispatches.find(
    (dispatch) => dispatch.pipeline?.label === 'ulg-mls-mpm-g2p-finalize-spatial-authority'
  );
  assert.ok(g2pFinalizeDispatch);
  assert.match(
    g2pShader,
    /g2p_spatial_authority_rejected\(\)[\s\S]*finalize_canonical_spatial_authority/
  );

  const privateSeparationDispatches = device.dispatches.filter(
    (dispatch) => String(dispatch.pipeline?.label).startsWith('ulg-mls-mpm-particle-separation-')
  );
  assert.equal(privateSeparationDispatches.length, 0);
  const proposalApply = device.dispatches.find(
    (dispatch) => dispatch.pipeline?.label
      === 'ulg-schroeder-spatial-mechanical-proposal-apply'
  );
  assert.ok(proposalApply);
  assert.ok(device.dispatches.indexOf(proposalApply) > device.dispatches.indexOf(g2pDispatch));
  assert.ok(device.dispatches.indexOf(proposalApply)
    < device.dispatches.indexOf(g2pFinalizeDispatch));
  assert.equal(
    device.createdBuffers.some(({ label }) => /separation-(bins|params|corrections)/.test(label)),
    false
  );

  const paramsWrite = device.writes.find(
    (write) => write.label === 'ulg-mls-mpm-g2p-params'
  );
  assert.ok(paramsWrite);
  assert.equal(paramsWrite.byteLength, 144);
  const params = new DataView(paramsWrite.data);
  assert.equal(params.getInt32(28, true), 2);
  assert.equal(params.getUint32(76, true), 1);
  assert.equal(params.getUint32(80, true), 23);
  assert.equal(params.getUint32(84, true), 29);
  assert.equal(params.getUint32(88, true), 31);
  assert.equal(params.getUint32(92, true), 1);
  assert.equal(params.getUint32(96, true), 17);
  assert.equal(params.getUint32(100, true), 37);
  assert.equal(params.getUint32(104, true), 41);
  assert.equal(params.getUint32(108, true), 43);
  assert.equal(params.getUint32(112, true), 47);
  assert.equal(params.getUint32(116, true), 53);
  assert.equal(params.getUint32(120, true), 59);
  assert.equal(params.getUint32(124, true), 61);
  assert.equal(params.getUint32(128, true), 67);
  assert.equal(params.getUint32(132, true), 71);
  assert.equal(params.getUint32(136, true), 1);
});

test('WebGPU MLS-MPM G2P rejects a host-invalid selected epoch before submission', async () => {
  const device = fakeG2pDevice();
  const { generation } = canonicalSpatialGenerationFixture(device, {
    evidenceBufferSize: 76
  });

  await assert.rejects(
    runMlsMpmG2pWebGpu({
      ...fixture(),
      device,
      boxDimsM: [3, 3, 3],
      readbackMode: 'no-full-readback',
      schroederSelectedLevel: 2,
      schroederSpatialEpochGeneration: generation,
      canonicalSpatialRequired: true
    }),
    (error) => {
      assert.equal(error.code, 'ERR_CANONICAL_SPATIAL_AUTHORITY_REJECTED');
      assert.equal(error.status, 'canonical-spatial-directory-rejected-evidence-capacity');
      return true;
    }
  );

  assert.equal(device.submissions.length, 0);
  assert.equal(device.dispatches.length, 0);
  assert.equal(
    device.createdBuffers.some((buffer) => buffer.label === 'ulg-mls-mpm-g2p-state-out'),
    false
  );
  assert.equal(
    device.createdBuffers.some((buffer) => buffer.label === 'ulg-mls-mpm-g2p-params'),
    false
  );
});

test('WebGPU canonical G2P retains global restore after an authenticated zero-row proposal', async () => {
  const device = fakeG2pDevice();
  const { generation } = canonicalSpatialGenerationFixture(device);
  const mechanicalProposal = canonicalMechanicalProposalFixture(device, generation);

  await runMlsMpmG2pWebGpu({
    ...twoParticleFixture(),
    device,
    boxDimsM: [3, 3, 3],
    particleSeparationRelaxation: 0,
    particleSeparationVelocityDamping: 0,
    readbackMode: 'no-full-readback',
    schroederSelectedLevel: 2,
    schroederSpatialEpochGeneration: generation,
    schroederSpatialMechanicalProposal: mechanicalProposal,
    canonicalSpatialRequired: true
  });

  assert.equal(device.dispatches.length, 3);
  assert.equal(
    device.dispatches[0].pipeline?.label,
    'ulg-mls-mpm-g2p-reconstruct'
  );
  assert.equal(
    device.dispatches[1].pipeline?.label,
    'ulg-schroeder-spatial-mechanical-proposal-apply'
  );
  assert.equal(
    device.dispatches[2].pipeline?.label,
    'ulg-mls-mpm-g2p-finalize-spatial-authority'
  );
  const productionShader = device.dispatches[0].pipeline.compute.module.code;
  assert.match(
    productionShader,
    /fn g2p_spatial_evidence_add\(word: u32, value: u32\) \{\s*\}/
  );
  assert.match(
    productionShader,
    /fn g2p_spatial_reject\(word: u32\)[\s\S]*atomicStore\(&schroeder_spatial_authority_evidence\[14u\], 1u\)/
  );
});

test('canonical particle separation rejects aliased immutable restore buffers', () => {
  const device = fakeG2pDevice();
  const stateBuffer = { label: 'writable-state' };
  const mechanicsBuffer = { label: 'writable-mechanics' };
  const immutableMechanicsBuffer = { label: 'immutable-mechanics' };

  assert.throws(
    () => encodeMlsMpmParticleSeparationPasses(device, device.createCommandEncoder(), {
      stateBuffer,
      mechanicsBuffer,
      authorityRestoreStateBuffer: stateBuffer,
      authorityRestoreMechanicsBuffer: immutableMechanicsBuffer,
      particleCount: 2,
      maxPairRestDistanceM: 1,
      spatialAuthorityEvidenceBuffer: { label: 'canonical-authority-evidence' }
    }),
    /restore buffers must be distinct immutable inputs/
  );
  assert.equal(device.createdBuffers.length, 0);
  assert.equal(device.dispatches.length, 0);
});

test('WebGPU MLS-MPM G2P reports canonical level and rejection precedence consistently', async (t) => {
  const cases = [
    {
      name: 'selected level is not an exact i32',
      status: 'canonical-spatial-selected-level-rejected',
      selectedLevel: Number.NaN,
      invalidate() {}
    },
    {
      name: 'overlay authority takes precedence over a wrong schema',
      status: 'canonical-spatial-directory-rejected-overlay-authority',
      selectedLevel: 2,
      invalidate(generation) {
        generation.source.phaseVolumeAssignmentOverlayEnabled = true;
        generation.schema = 'peercompute.ulg.schroeder-spatial-epoch-generation.invalid';
      }
    }
  ];

  for (const testCase of cases) {
    await t.test(testCase.name, async () => {
      const device = fakeG2pDevice();
      const { generation } = canonicalSpatialGenerationFixture(device);
      testCase.invalidate(generation);

      await assert.rejects(
        runMlsMpmG2pWebGpu({
          ...fixture(),
          device,
          boxDimsM: [3, 3, 3],
          readbackMode: 'no-full-readback',
          schroederSelectedLevel: testCase.selectedLevel,
          schroederSpatialEpochGeneration: generation,
          canonicalSpatialRequired: true
        }),
        (error) => {
          assert.equal(error.code, 'ERR_CANONICAL_SPATIAL_AUTHORITY_REJECTED');
          assert.equal(error.status, testCase.status);
          return true;
        }
      );

      assert.equal(device.submissions.length, 0);
      assert.equal(device.dispatches.length, 0);
    });
  }
});

test('optional MLS-MPM G2P never falls back to the unfiltered CPU oracle for canonical intent', async () => {
  const device = fakeG2pDevice();
  const { generation } = canonicalSpatialGenerationFixture(device);

  await assert.rejects(
    runMlsMpmG2pWithOptionalWebGpu({
      ...fixture(),
      schroederSelectedLevel: 2,
      schroederSpatialEpochGeneration: generation,
      canonicalSpatialRequired: true,
      preferWebGpu: true,
      navigatorRef: {}
    }),
    (error) => {
      assert.equal(error.code, 'ERR_CANONICAL_SPATIAL_AUTHORITY_REJECTED');
      assert.equal(error.status, 'canonical-spatial-webgpu-device-unavailable');
      return true;
    }
  );
});

test('WebGPU MLS-MPM G2P binds a retained Schroeder level-assignment buffer for level filtering', async () => {
  const device = fakeG2pDevice();
  const retainedAssignmentBuffer = { label: 'retained-schroeder-level-assignments', size: 4096 };
  const result = await runMlsMpmG2pWebGpu({
    ...fixture(),
    device,
    boxDimsM: [3, 3, 3],
    readbackMode: 'no-full-readback',
    schroederLevelAssignment: { assignmentBuffer: retainedAssignmentBuffer },
    schroederSelectedLevel: 2
  });
  assert.equal(result.backend, 'webgpu');
  // No dummy assignment buffer is created when a retained buffer is borrowed.
  assert.equal(
    device.createdBuffers.some((buffer) => String(buffer.label).includes('level-assignments-dummy')),
    false
  );
  const bindGroup = device.dispatches[0].bindGroup;
  const assignmentEntry = bindGroup.entries.find((entry) => entry.binding === 7);
  assert.equal(assignmentEntry.resource.buffer, retainedAssignmentBuffer);
});

test('WebGPU MLS-MPM G2P uploads explicit level-assignment rows for level filtering', async () => {
  const device = fakeG2pDevice();
  const rows = new Float32Array(16 * 2);
  rows[0] = 1;
  rows[16] = 0;
  await runMlsMpmG2pWebGpu({
    ...fixture(),
    device,
    boxDimsM: [3, 3, 3],
    readbackMode: 'no-full-readback',
    schroederLevelAssignment: { assignments: rows },
    schroederSelectedLevel: 1
  });
  const uploaded = device.createdBuffers.find(
    (buffer) => buffer.label === 'ulg-mls-mpm-g2p-schroeder-level-assignments-in'
  );
  assert.ok(uploaded);
  const write = device.writes.find(
    (entry) => entry.label === 'ulg-mls-mpm-g2p-schroeder-level-assignments-in'
  );
  assert.equal(write.byteLength, rows.byteLength);
});

test('WebGPU MLS-MPM G2P rejects the compacted active-node list as a particle filter', async () => {
  const device = fakeG2pDevice();
  await assert.rejects(
    runMlsMpmG2pWebGpu({
      ...fixture(),
      device,
      boxDimsM: [3, 3, 3],
      readbackMode: 'no-full-readback',
      schroederActiveNodeList: { activeNodes: new Float32Array(16) },
      schroederSelectedLevel: 1
    }),
    /no longer accepts schroederActiveNodeList/
  );
});
