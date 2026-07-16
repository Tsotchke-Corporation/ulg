import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mlsMpmP2gGridProjectionWgsl } from '../ulg-gpu-abi/src/wgsl.js';
import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT,
  SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT,
  SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import {
  MLS_MPM_P2G_BACKEND_OCEAN_TILED_EXPERIMENTAL,
  MLS_MPM_P2G_BACKEND_RESIDENT_SCATTER,
  MLS_MPM_GPU_GRID_NODE_FLOATS,
  ULG_MLS_MPM_P2G_BACKEND_POLICY_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_PROJECTION_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_PROJECTION_PARITY_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
  createMlsMpmGridSpec,
  createProjectionParamsArray,
  createMlsMpmP2gGridProjectionParityReport,
  projectMlsMpmP2gGridCpu,
  resolveMlsMpmP2gBackendPolicy,
  runMlsMpmP2gGridProjectionWebGpu,
  SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS,
  runMlsMpmP2gGridProjectionWithOptionalWebGpu
} from '../src/runtime/sph/sphGridGpuKernel.js';
import { tagWebGpuBufferDevice } from '../src/runtime/sph/sphGpuDeviceIdentity.js';

function nearlyEqual(actual, expected, tolerance = 1e-5) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

function manualBuffers({
  position = [1.25, 1.25, 1.25],
  velocity = [2, 3, 4],
  massKg = 8,
  affineC = [0, 0, 0, 0, 0, 0, 0, 0, 0],
  smoothingLengthM = 1,
  restDensityKgPerM3 = 8,
  volumeRatioJ = 1,
  restVolumeM3 = massKg / restDensityKgPerM3,
  solidFlag = 1,
  effectiveBulkModulusPa = 0,
  shearModulusPa = 0,
  lameLambdaPa = 0,
  soundSpeedMPerS = 0,
  eosModelId = 0,
  hydrostaticPressurePa = 0,
  phaseFractions = [0, 0, 0, 0],
  mechanicsDtS = 0
} = {}) {
  const state = new Float32Array([
    position[0], position[1], position[2], massKg,
    velocity[0], velocity[1], velocity[2], 123
  ]);
  const thermo = new Float32Array(12);
  thermo[3] = restDensityKgPerM3;
  thermo.set(phaseFractions, 4);
  const mechanics = new Float32Array(MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length);
  mechanics.set([1, 0, 0, 0, 1, 0, 0, 0, 1], 0);
  mechanics.set(affineC, 9);
  mechanics[18] = volumeRatioJ;
  mechanics[19] = restVolumeM3;
  mechanics[20] = solidFlag;
  mechanics[21] = 1;
  mechanics[22] = effectiveBulkModulusPa;
  mechanics[23] = shearModulusPa;
  mechanics[24] = lameLambdaPa;
  mechanics[25] = soundSpeedMPerS;
  mechanics[26] = eosModelId;
  mechanics[27] = 1;
  mechanics[28] = hydrostaticPressurePa;
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
      mechanics
    }
  };
}

function nodeOffset(gridSpec, nodeI, nodeJ, nodeK) {
  const [, gny, gnz] = gridSpec.gridDims;
  return (((nodeI + gridSpec.shift) * gny + (nodeJ + gridSpec.shift)) * gnz + (nodeK + gridSpec.shift))
    * MLS_MPM_GPU_GRID_NODE_FLOATS;
}

function summarizeGrid(gridNodes) {
  let mass = 0;
  const momentum = [0, 0, 0];
  let activeNodes = 0;
  for (let offset = 0; offset < gridNodes.length; offset += MLS_MPM_GPU_GRID_NODE_FLOATS) {
    mass += gridNodes[offset];
    momentum[0] += gridNodes[offset + 1];
    momentum[1] += gridNodes[offset + 2];
    momentum[2] += gridNodes[offset + 3];
    if (gridNodes[offset + 7] === 1) activeNodes += 1;
  }
  return { mass, momentum, activeNodes };
}

function maxNodeMomentumAbs(gridNodes) {
  let maxMomentum = 0;
  for (let offset = 0; offset < gridNodes.length; offset += MLS_MPM_GPU_GRID_NODE_FLOATS) {
    maxMomentum = Math.max(
      maxMomentum,
      Math.abs(gridNodes[offset + 1]),
      Math.abs(gridNodes[offset + 2]),
      Math.abs(gridNodes[offset + 3])
    );
  }
  return maxMomentum;
}

function residentProductMassFromRows(rows, overrides = {}) {
  return {
    schema: 'peercompute.ulg.sph-resident-product-mass.v0',
    status: 'resident-product-mass-buffer-retained',
    productEventRows: rows,
    productEventRowCount: rows.length / SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS,
    productEventActiveEventCount: 1,
    unplacedProductMassKg: 3,
    consumeMassPolicy: 'unplaced-product-mass-only',
    eosCouplingStatus: 'resident-product-mass-p2g-eos-sidecar-ready',
    ...overrides
  };
}

function productEventRows({
  position = [1.25, 1.25, 1.25],
  massKg = 4,
  materialId = 300,
  productTermIndex = 0,
  reactionIndex = 0,
  sourceParticleIndex = 0,
  partnerParticleIndex = 1,
  moles = 1,
  routingId = 1,
  phaseId = 3,
  visibleMassKg = 1,
  unplacedMassKg = 3,
  temperatureK = 400,
  restDensityKgPerM3 = 1,
  velocityMPerS = [0, 0, 0],
  supportVolumeM3 = 0,
  effectiveBulkModulusPa = 0,
  shearModulusPa = 0,
  lameLambdaPa = 0,
  soundSpeedMPerS = 0,
  eosModelId = 0,
  solidFlag = 0,
  mechanicsStatus = 1,
  status = 1
} = {}) {
  const rows = new Float32Array(SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS);
  rows[0] = position[0];
  rows[1] = position[1];
  rows[2] = position[2];
  rows[3] = massKg;
  rows[4] = materialId;
  rows[5] = productTermIndex;
  rows[6] = reactionIndex;
  rows[7] = sourceParticleIndex;
  rows[8] = partnerParticleIndex;
  rows[9] = moles;
  rows[10] = routingId;
  rows[11] = phaseId;
  rows[12] = visibleMassKg;
  rows[13] = unplacedMassKg;
  rows[14] = 1;
  rows[15] = massKg / Math.max(moles, 1e-9);
  rows[16] = temperatureK;
  rows[17] = restDensityKgPerM3;
  rows[18] = status;
  rows[20] = velocityMPerS[0];
  rows[21] = velocityMPerS[1];
  rows[22] = velocityMPerS[2];
  rows[23] = supportVolumeM3;
  rows[24] = effectiveBulkModulusPa;
  rows[25] = shearModulusPa;
  rows[26] = lameLambdaPa;
  rows[27] = soundSpeedMPerS;
  rows[28] = eosModelId;
  rows[29] = solidFlag;
  rows[30] = mechanicsStatus;
  return rows;
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

function fakeP2gDevice() {
  const createdBuffers = [];
  const bindGroups = [];
  const dispatches = [];
  const writes = [];
  const clears = [];
  const submissions = [];
  const shaderModules = [];
  const device = {
    createdBuffers,
    bindGroups,
    dispatches,
    writes,
    clears,
    submissions,
    shaderModules,
    queue: {
      writeBuffer(buffer, offset, data) {
        const copy = data instanceof ArrayBuffer
          ? data.slice(0)
          : data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
        writes.push({
          label: buffer.label,
          offset,
          byteLength: data.byteLength,
          data: copy
        });
      },
      submit(commandBuffers) {
        submissions.push(commandBuffers);
      },
      async onSubmittedWorkDone() {}
    },
    createBuffer(desc) {
      const buffer = {
        label: desc.label,
        size: desc.size,
        usage: desc.usage,
        destroyed: false,
        destroy() {
          this.destroyed = true;
        }
      };
      createdBuffers.push(buffer);
      return buffer;
    },
    createShaderModule(desc) {
      shaderModules.push(desc);
      return { code: desc.code };
    },
    createBindGroupLayout(desc) {
      return { entries: desc.entries };
    },
    createPipelineLayout(desc) {
      return { bindGroupLayouts: desc.bindGroupLayouts };
    },
    createComputePipeline(desc) {
      return {
        desc,
        getBindGroupLayout() {
          return { entries: [] };
        }
      };
    },
    createBindGroup(desc) {
      bindGroups.push(desc);
      return { entries: desc.entries };
    },
    createCommandEncoder() {
      return {
        clearBuffer(buffer, offset = 0, size = null) {
          clears.push({ buffer, offset, size });
        },
        beginComputePass() {
          return {
            setPipeline() {},
            setBindGroup() {},
            dispatchWorkgroups(x, y = 1, z = 1) {
              dispatches.push([x, y, z]);
            },
            end() {}
          };
        },
        copyBufferToBuffer() {},
        finish() {
          return {};
        }
      };
    }
  };
  return device;
}

function canonicalSpatialEpochGenerationFixture(device, {
  directoryBuffer = {
    label: 'retained-schroeder-spatial-directory',
    size: 256
  },
  evidenceBuffer = {
    label: 'retained-schroeder-spatial-evidence',
    size: 80,
    destroyed: false,
    destroy() {
      this.destroyed = true;
    }
  }
} = {}) {
  const exactNearQueryProfile = Object.freeze({
    schema: 'peercompute.ulg.schroeder-spatial-exact-near-query-profile.v1',
    status: 'schroeder-spatial-exact-near-query-profile-ready',
    ready: true,
    sourceAdapterId: SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY,
    sourceCount: 1,
    chartId: 0,
    minLevel: -2,
    maxLevel: 2,
    levelCount: 5,
    baseGridSpacingM: 0.25,
    levelSpacingMode: 'base-grid-spacing-times-pow2-level',
    positionAuthority: 'same-epoch-pre-integration-particle-state',
    storageGeneration: 23,
    physicsTick: 53,
    physicsSubstep: 59,
    positionEpoch: 29,
    topologyEpoch: 31,
    chartEpoch: 61,
    levelEpoch: 67,
    supportEpoch: 71
  });
  tagWebGpuBufferDevice(directoryBuffer, device);
  tagWebGpuBufferDevice(evidenceBuffer, device);
  return {
    schema: 'peercompute.ulg.schroeder-spatial-epoch-generation.v1',
    selected: true,
    ready: true,
    source: { phaseVolumeAssignmentOverlayEnabled: false },
    execution: {
      schema: 'peercompute.ulg.schroeder-spatial-epoch.v1',
      submitPerformed: true,
      directoryBuffer,
      evidenceBuffer,
      evidenceBufferByteLength: 80,
      mechanicsEvidenceOffsetBytes: 16,
      mechanicsEvidenceByteLength: 64,
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
      layout: { byteLength: 256 }
    }
  };
}

test('MLS-MPM P2G grid projection WGSL declares particle-parallel scatter bindings', () => {
  assert.match(mlsMpmP2gGridProjectionWgsl, /struct P2gProjectionParams/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /var<storage, read> sph_state/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /var<storage, read> sph_thermo/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /var<storage, read> mls_mechanics/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /var<storage, read_write> grid_accumulators: array<atomic<i32>>/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /@group\(0\) @binding\(6\) var<storage, read_write> grid_nodes/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /resident_product_event_count: u32/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /internal_pressure_scale: f32/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /var<storage, read> product_events/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /@group\(0\) @binding\(7\) var<storage, read> schroeder_level_assignments/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /@group\(0\) @binding\(8\) var<storage, read> schroeder_spatial_directory/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /schroeder_filter_enabled: u32/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /schroeder_spatial_directory_enabled: u32/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /fn p2g_spatial_directory_admitted/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /particle_to_cell_offset_words/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /fn p2g_particle_enabled/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /fn packed_pressure/);
  // The depth-frozen hydrostatic prestress (row7.x) must NOT feed the stress:
  // pressure comes from the EOS via tracked J only.
  assert.doesNotMatch(mlsMpmP2gGridProjectionWgsl, /max\(row7\.x, 0\.0\)/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /return max\(0\.0, sound_speed_m_per_s \* sound_speed_m_per_s/);
  // Cavitation clamp: condensed tension is floored at a small fraction of the
  // Tait stiffness instead of the unbounded signed law (tensile pairing fix).
  assert.match(mlsMpmP2gGridProjectionWgsl, /pow\(ratio, 7\.0\) - 1\.0\);/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /return max\(pressure, -0\.05 \* stiffness\);/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /fn corotated_stress/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /fn scatter_product_events/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /fn finalize_grid/);
  assert.doesNotMatch(mlsMpmP2gGridProjectionWgsl, /for \(var particle_index = 0u; particle_index < params\.particle_count/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /@compute @workgroup_size\(64\)/);
});

test('MLS-MPM P2G backend policy keeps Ocean-tiled replacement explicit and fail-closed', () => {
  const current = resolveMlsMpmP2gBackendPolicy({
    requestedBackend: 'particle-parallel-scatter'
  });
  assert.equal(current.schema, ULG_MLS_MPM_P2G_BACKEND_POLICY_SCHEMA);
  assert.equal(current.status, 'resident-scatter-backend-selected');
  assert.equal(current.effectiveBackend, MLS_MPM_P2G_BACKEND_RESIDENT_SCATTER);
  assert.equal(current.particleLoopInHotPath, false);

  const experimental = resolveMlsMpmP2gBackendPolicy({
    requestedBackend: MLS_MPM_P2G_BACKEND_OCEAN_TILED_EXPERIMENTAL
  });
  assert.equal(experimental.schema, ULG_MLS_MPM_P2G_BACKEND_POLICY_SCHEMA);
  assert.equal(experimental.status, 'ocean-tiled-backend-fallback-resident-scatter');
  assert.equal(experimental.requestedBackend, MLS_MPM_P2G_BACKEND_OCEAN_TILED_EXPERIMENTAL);
  assert.equal(experimental.effectiveBackend, MLS_MPM_P2G_BACKEND_RESIDENT_SCATTER);
  assert.equal(experimental.fallbackReason, 'ocean-tiled-p2g-kernel-not-available');
  assert.equal(experimental.experimentalBackendRequested, true);
  assert.equal(experimental.oceanTiledKernelAvailable, false);
  assert.equal(experimental.particleLoopInHotPath, false);
});

test('CPU MLS-MPM P2G grid projection conserves mass and linear momentum without affine C', () => {
  const { sphParticleState, mlsMpmParticleState } = manualBuffers();
  const projection = projectMlsMpmP2gGridCpu({
    sphParticleState,
    mlsMpmParticleState,
    gridSpacingM: 1,
    boxDimsM: [2, 2, 2]
  });
  const summary = summarizeGrid(projection.gridNodes);
  const gridSpec = createMlsMpmGridSpec({ gridSpacingM: 1, boxDimsM: [2, 2, 2] });
  const centerOffset = nodeOffset(gridSpec, 1, 1, 1);
  const centerWeight = 0.6875 ** 3;

  assert.equal(projection.schema, ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA);
  assert.equal(projection.backend, 'cpu-reference');
  assert.equal(projection.kernelScope, 'particle-parallel-scatter-p2g-stress-momentum-projection');
  assert.equal(projection.gridNodeStrideFloats, 8);
  nearlyEqual(summary.mass, 8, 1e-5);
  nearlyEqual(summary.momentum[0], 16, 1e-5);
  nearlyEqual(summary.momentum[1], 24, 1e-5);
  nearlyEqual(summary.momentum[2], 32, 1e-5);
  assert.equal(summary.activeNodes, 27);
  nearlyEqual(projection.gridNodes[centerOffset], 8 * centerWeight);
  nearlyEqual(projection.gridNodes[centerOffset + 1], 8 * centerWeight * 2);
  nearlyEqual(projection.gridNodes[centerOffset + 2], 8 * centerWeight * 3);
  nearlyEqual(projection.gridNodes[centerOffset + 3], 8 * centerWeight * 4);
  assert.equal(projection.p2gProjectionValidation, false);
  assert.equal(projection.stressProjectionValidation, false);
  assert.equal(projection.gridValidation, false);
  assert.equal(projection.g2pValidation, false);
  assert.equal(projection.fullPhysicsValidation, false);
});

test('CPU MLS-MPM P2G keeps cavitation-clamped condensed tensile pressure', () => {
  const { sphParticleState, mlsMpmParticleState } = manualBuffers({
    velocity: [0, 0, 0],
    massKg: 4,
    restDensityKgPerM3: 4,
    restVolumeM3: 1,
    volumeRatioJ: 2,
    solidFlag: 0,
    soundSpeedMPerS: 10,
    eosModelId: 1,
    mechanicsDtS: 0.1
  });
  const projection = projectMlsMpmP2gGridCpu({
    sphParticleState,
    mlsMpmParticleState,
    gridSpacingM: 1,
    boxDimsM: [2, 2, 2]
  });
  const summary = summarizeGrid(projection.gridNodes);
  const gridSpec = createMlsMpmGridSpec({ gridSpacingM: 1, boxDimsM: [2, 2, 2] });
  const centerOffset = nodeOffset(gridSpec, 1, 1, 1);
  const centerWeight = 0.6875 ** 3;
  // Signed tension survives below rest density but is floored at the
  // cavitation-scale fraction of the Tait stiffness (-0.05 * B): a liquid
  // cavitates rather than sustaining bulk-scale tension, and the unbounded
  // branch drove the MLS-MPM tensile pairing instability.
  const taitStiffnessPa = 4 * 10 * 10 / 7;
  const expectedPressurePa = Math.max(
    taitStiffnessPa * ((0.5 ** 7) - 1),
    -0.05 * taitStiffnessPa
  );
  const expectedStressScale = -0.1 * 2 * 4;
  const expectedAffineDiagonal = expectedStressScale * -expectedPressurePa;
  const expectedNodeMomentum = centerWeight * expectedAffineDiagonal * -0.25;

  nearlyEqual(summary.mass, 4, 1e-5);
  nearlyEqual(summary.momentum[0], 0, 1e-5);
  nearlyEqual(summary.momentum[1], 0, 1e-5);
  nearlyEqual(summary.momentum[2], 0, 1e-5);
  assert.ok(maxNodeMomentumAbs(projection.gridNodes) > 0);
  nearlyEqual(projection.gridNodes[centerOffset + 1], expectedNodeMomentum, 1e-5);
  nearlyEqual(projection.gridNodes[centerOffset + 2], expectedNodeMomentum, 1e-5);
  nearlyEqual(projection.gridNodes[centerOffset + 3], expectedNodeMomentum, 1e-5);
});

test('WebGPU MLS-MPM P2G binds a full product-event row for zero-event runs', async () => {
  const { sphParticleState, mlsMpmParticleState } = manualBuffers();
  const device = fakeP2gDevice();
  const projection = await runMlsMpmP2gGridProjectionWebGpu({
    device,
    sphParticleState,
    mlsMpmParticleState,
    gridSpacingM: 1,
    boxDimsM: [2, 2, 2],
    ambientPressurePa: 101325,
    readbackMode: 'no-full-readback'
  });
  const productEventBuffer = device.createdBuffers.find(
    (buffer) => buffer.label === 'ulg-mls-mpm-p2g-resident-product-events-in'
  );

  assert.equal(projection.backend, 'webgpu');
  assert.equal(projection.readbackMode, 'no-full-readback');
  assert.equal(projection.ambientPressureAppliedInStressProjection, true);
  assert.equal(projection.p2gBackendPolicyStatus, 'resident-scatter-backend-selected');
  assert.equal(projection.p2gBackendEffective, MLS_MPM_P2G_BACKEND_RESIDENT_SCATTER);
  assert.equal(projection.residentProductMassInputProductEventCount, 0);
  assert.ok(productEventBuffer);
  const paramsWrite = device.writes.find((write) => write.label === 'ulg-mls-mpm-p2g-params');
  assert.ok(paramsWrite);
  assert.equal(new DataView(paramsWrite.data).getFloat32(68, true), 101325);
  assert.equal(
    productEventBuffer.size,
    SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
});

test('CPU MLS-MPM P2G uses the ambient-referenced ideal-gas closure for admitted gas', () => {
  const { sphParticleState, mlsMpmParticleState } = manualBuffers({
    velocity: [0, 0, 0],
    massKg: 1,
    restDensityKgPerM3: 1,
    restVolumeM3: 1,
    solidFlag: 0,
    soundSpeedMPerS: 340,
    eosModelId: 2,
    phaseFractions: [0, 0, 1, 0],
    mechanicsDtS: 0.01
  });
  const atmosphere = projectMlsMpmP2gGridCpu({
    sphParticleState,
    mlsMpmParticleState,
    gridSpacingM: 1,
    boxDimsM: [2, 2, 2],
    ambientPressurePa: 101325
  });
  const vacuum = projectMlsMpmP2gGridCpu({
    sphParticleState,
    mlsMpmParticleState,
    gridSpacingM: 1,
    boxDimsM: [2, 2, 2],
    ambientPressurePa: 0
  });

  assert.equal(atmosphere.ambientPressureAppliedInStressProjection, true);
  nearlyEqual(maxNodeMomentumAbs(atmosphere.gridNodes), 0, 1e-6);
  assert.ok(maxNodeMomentumAbs(vacuum.gridNodes) > 0);
});

test('WebGPU MLS-MPM P2G can filter particles by retained Schroeder level assignment', async () => {
  const { sphParticleState, mlsMpmParticleState } = manualBuffers();
  const device = fakeP2gDevice();
  const assignmentBuffer = { label: 'retained-schroeder-assignment-buffer' };
  const projection = await runMlsMpmP2gGridProjectionWebGpu({
    device,
    sphParticleState,
    mlsMpmParticleState,
    gridSpacingM: 1,
    boxDimsM: [2, 2, 2],
    readbackMode: 'no-full-readback',
    schroederLevelAssignment: {
      particleCount: 1,
      assignmentStrideFloats: SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT.length,
      assignmentBuffer
    },
    schroederSelectedLevel: 2
  });

  assert.equal(projection.backend, 'webgpu');
  assert.equal(projection.schroederLevelFilterEnabled, true);
  assert.equal(projection.schroederSelectedLevel, 2);
  assert.equal(projection.schroederLevelFilter.assignmentStrideFloats, SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT.length);
  assert.equal(projection.schroederLevelFilter.authorityBindingMode, 'precanonical-level-assignment');
  assert.equal(projection.schroederLevelFilter.oldLevelAssignmentLookupRemoved, false);
  assert.equal(
    device.createdBuffers.some((buffer) => buffer.label === 'ulg-mls-mpm-p2g-schroeder-level-assignments-dummy'),
    false
  );
  assert.ok(device.bindGroups[0].entries.some((entry) => (
    entry.binding === 7 && entry.resource.buffer === assignmentBuffer
  )));
  assert.equal(
    device.bindGroups[0].layout.entries.find((entry) => entry.binding === 7)?.buffer?.type,
    'read-only-storage'
  );
  assert.equal(projection.schroederSpatialDirectoryEnabled, false);
  assert.equal(projection.schroederSpatialDirectoryFallback, true);
  assert.equal(projection.schroederSpatialDirectoryFallbackScope, 'host-binding-only');
  assert.equal(projection.schroederSpatialHostBindingAdmitted, false);
  assert.equal(projection.schroederSpatialHostBindingFallback, true);
  assert.equal(projection.schroederSpatialGpuAdmissionObserved, false);
  assert.equal(projection.schroederSpatialGpuAdmissionStatus, 'not-applicable-host-binding-fallback');
  assert.equal(projection.schroederSpatialGpuFallbackObserved, null);
});

test('WebGPU MLS-MPM P2G binds canonical evidence and ignores legacy assignment payloads', async () => {
  const { sphParticleState, mlsMpmParticleState } = manualBuffers();
  const device = fakeP2gDevice();
  const generation = canonicalSpatialEpochGenerationFixture(device);
  const { directoryBuffer, evidenceBuffer } = generation.execution;
  const legacyAssignment = new Proxy({}, {
    get() {
      throw new Error('canonical P2G inspected obsolete level-assignment authority');
    }
  });
  const projection = await runMlsMpmP2gGridProjectionWebGpu({
    device,
    sphParticleState,
    mlsMpmParticleState,
    gridSpacingM: 1,
    boxDimsM: [2, 2, 2],
    readbackMode: 'no-full-readback',
    schroederLevelAssignment: legacyAssignment,
    schroederSelectedLevel: 2,
    schroederSpatialEpochGeneration: generation,
    canonicalSpatialRequired: true,
    observeCanonicalSpatialAuthority: true
  });

  assert.equal(device.submissions.length, 1);
  assert.equal(projection.schroederSpatialDirectoryEnabled, true);
  assert.equal(projection.schroederSpatialDirectoryFallback, false);
  assert.equal(projection.schroederSpatialDirectoryFallbackScope, 'host-binding-only');
  assert.equal(projection.schroederSpatialHostBindingAdmitted, true);
  assert.equal(projection.schroederSpatialHostBindingFallback, false);
  assert.equal(projection.schroederSpatialGpuAdmissionObserved, false);
  assert.equal(projection.schroederSpatialGpuAdmissionStatus, 'shader-validates-at-dispatch-no-host-readback');
  assert.equal(projection.schroederSpatialGpuFallbackObserved, null);
  assert.equal(projection.schroederSpatialDirectory.generationId, 17);
  assert.equal(projection.schroederSpatialDirectory.storageGeneration, 23);
  assert.equal(projection.schroederSpatialDirectory.positionEpoch, 29);
  assert.equal(projection.schroederSpatialDirectory.topologyEpoch, 31);
  assert.equal(projection.schroederSpatialDirectory.evidenceBufferByteLength, 80);
  assert.equal(projection.schroederLevelFilter.authorityBindingMode, 'canonical-spatial-epoch');
  assert.equal(projection.schroederLevelFilter.oldLevelAssignmentLookupRemoved, true);
  assert.equal(projection.schroederLevelFilter.retainedAssignmentBuffer, false);
  assert.equal(projection.schroederLevelFilter.assignmentBufferByteLength, 0);
  assert.equal(projection.schroederLevelFilter.spatialEvidenceEnabled, true);
  for (const group of device.bindGroups) {
    assert.equal(
      group.entries.find((entry) => entry.binding === 7)?.resource?.buffer,
      evidenceBuffer
    );
    assert.equal(
      group.entries.find((entry) => entry.binding === 8)?.resource?.buffer,
      directoryBuffer
    );
    assert.equal(
      group.layout.entries.find((entry) => entry.binding === 7)?.buffer?.type,
      'storage'
    );
  }
  assert.ok(device.shaderModules.length > 0);
  for (const shader of device.shaderModules) {
    assert.doesNotMatch(shader.code, /schroeder_level_assignments/);
    assert.match(shader.code, /schroeder_spatial_authority_evidence/);
  }
  assert.deepEqual(
    device.clears
      .filter((clear) => clear.buffer === evidenceBuffer)
      .map(({ offset, size }) => [offset, size]),
    [[16, 64]]
  );
  assert.equal(evidenceBuffer.destroyed, false);
  const paramsWrite = device.writes.find((write) => write.label === 'ulg-mls-mpm-p2g-params');
  assert.ok(paramsWrite);
  assert.equal(paramsWrite.byteLength, 144);
  const params = new DataView(paramsWrite.data);
  assert.equal(params.getUint32(44, true), 1);
  assert.equal(params.getInt32(48, true), 2);
  assert.equal(params.getUint32(52, true), SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT.length);
  const canonicalIdentityWords = new Map([
    [56, 1],
    [60, 23],
    [80, 29],
    [84, 31],
    [88, 1],
    [92, 17],
    [96, 37],
    [100, 41],
    [104, 43],
    [108, 47],
    [112, 53],
    [116, 59],
    [120, 61],
    [124, 67],
    [128, 71],
    [132, 1],
    [136, 0],
    [140, 0]
  ]);
  for (const [offset, expected] of canonicalIdentityWords) {
    assert.equal(params.getUint32(offset, true), expected, `identity word at byte ${offset}`);
  }
});

test('WebGPU MLS-MPM P2G rejects host-invalid canonical generations without submission or fallback', async (t) => {
  const cases = [
    {
      name: 'released execution',
      status: 'canonical-spatial-directory-rejected-released-generation',
      invalidate(generation) {
        generation.execution.released = true;
      }
    },
    {
      name: 'wrong generation schema',
      status: 'canonical-spatial-directory-rejected-schema',
      invalidate(generation) {
        generation.schema = 'peercompute.ulg.schroeder-spatial-epoch-generation.invalid';
      }
    },
    {
      name: 'wrong execution schema',
      status: 'canonical-spatial-directory-rejected-schema',
      invalidate(generation) {
        generation.execution.schema = 'peercompute.ulg.schroeder-spatial-epoch.invalid';
      }
    },
    {
      name: 'cross-device directory buffer',
      status: 'canonical-spatial-directory-rejected-device',
      invalidate(generation) {
        const foreignDirectoryBuffer = {
          label: 'foreign-schroeder-spatial-directory',
          size: 256
        };
        tagWebGpuBufferDevice(foreignDirectoryBuffer, {});
        generation.execution.directoryBuffer = foreignDirectoryBuffer;
      }
    },
    {
      name: 'cross-device evidence buffer',
      status: 'canonical-spatial-directory-rejected-device',
      invalidate(generation) {
        const foreignEvidenceBuffer = {
          label: 'foreign-schroeder-spatial-evidence',
          size: 80
        };
        tagWebGpuBufferDevice(foreignEvidenceBuffer, {});
        generation.execution.evidenceBuffer = foreignEvidenceBuffer;
      }
    },
    {
      name: 'undersized evidence buffer',
      status: 'canonical-spatial-directory-rejected-evidence-capacity',
      invalidate(generation) {
        generation.execution.evidenceBuffer.size = 16;
      }
    },
    {
      name: 'torn exact-near query profile',
      status: 'canonical-spatial-directory-rejected-query-geometry',
      invalidate(generation) {
        generation.execution.queryGeometryEvidence = {
          ...generation.execution.exactNearQueryProfile
        };
      }
    },
    {
      name: 'phase-volume overlay authority',
      status: 'canonical-spatial-directory-rejected-overlay-authority',
      invalidate(generation) {
        generation.source.phaseVolumeAssignmentOverlayEnabled = true;
      }
    },
    {
      name: 'overlay authority takes precedence over a wrong schema',
      status: 'canonical-spatial-directory-rejected-overlay-authority',
      invalidate(generation) {
        generation.source.phaseVolumeAssignmentOverlayEnabled = true;
        generation.schema = 'peercompute.ulg.schroeder-spatial-epoch-generation.invalid';
      }
    },
    {
      name: 'selected level is not an exact i32',
      status: 'canonical-spatial-selected-level-rejected',
      selectedLevel: Number.NaN,
      invalidate() {}
    },
    {
      name: 'required generation is not selected',
      status: 'canonical-spatial-directory-requested-but-unavailable',
      invalidate(generation) {
        generation.selected = false;
      }
    }
  ];

  for (const testCase of cases) {
    await t.test(testCase.name, async () => {
      const { sphParticleState, mlsMpmParticleState } = manualBuffers();
      const device = fakeP2gDevice();
      const generation = canonicalSpatialEpochGenerationFixture(device);
      testCase.invalidate(generation);

      await assert.rejects(
        runMlsMpmP2gGridProjectionWebGpu({
          device,
          sphParticleState,
          mlsMpmParticleState,
          gridSpacingM: 1,
          boxDimsM: [2, 2, 2],
          readbackMode: 'no-full-readback',
          schroederLevelAssignment: {
            particleCount: 999,
            assignmentStrideFloats: 0,
            assignments: 'malformed-obsolete-authority'
          },
          schroederSelectedLevel: testCase.selectedLevel ?? 2,
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
      assert.equal(device.bindGroups.length, 0);
      assert.equal(device.dispatches.length, 0);
      assert.equal(device.writes.length, 0);
    });
  }
});

test('WebGPU MLS-MPM P2G reports Ocean-tiled fallback before the replacement kernel exists', async () => {
  const { sphParticleState, mlsMpmParticleState } = manualBuffers();
  const device = fakeP2gDevice();
  const projection = await runMlsMpmP2gGridProjectionWebGpu({
    device,
    sphParticleState,
    mlsMpmParticleState,
    gridSpacingM: 1,
    boxDimsM: [2, 2, 2],
    readbackMode: 'no-full-readback',
    p2gBackend: MLS_MPM_P2G_BACKEND_OCEAN_TILED_EXPERIMENTAL
  });

  assert.equal(projection.backend, 'webgpu');
  assert.equal(projection.readbackMode, 'no-full-readback');
  assert.equal(projection.p2gBackendPolicy.schema, ULG_MLS_MPM_P2G_BACKEND_POLICY_SCHEMA);
  assert.equal(projection.p2gBackendPolicyStatus, 'ocean-tiled-backend-fallback-resident-scatter');
  assert.equal(projection.p2gBackendRequested, MLS_MPM_P2G_BACKEND_OCEAN_TILED_EXPERIMENTAL);
  assert.equal(projection.p2gBackendEffective, MLS_MPM_P2G_BACKEND_RESIDENT_SCATTER);
  assert.equal(projection.p2gBackendFallbackReason, 'ocean-tiled-p2g-kernel-not-available');
  assert.equal(projection.p2gBackendPolicy.particleLoopInHotPath, false);
  assert.deepEqual(device.dispatches, [[1, 1, 1], [6, 1, 1]]);
});

test('CPU MLS-MPM P2G grid projection deposits unplaced resident product mass generically', () => {
  const { sphParticleState, mlsMpmParticleState } = manualBuffers();
  const rows = productEventRows({
    position: [1.25, 1.25, 1.25],
    visibleMassKg: 1,
    unplacedMassKg: 3,
    status: 1
  });
  const projection = projectMlsMpmP2gGridCpu({
    sphParticleState,
    mlsMpmParticleState,
    gridSpacingM: 1,
    boxDimsM: [2, 2, 2],
    residentProductMass: residentProductMassFromRows(rows)
  });
  const summary = summarizeGrid(projection.gridNodes);
  const gridSpec = createMlsMpmGridSpec({ gridSpacingM: 1, boxDimsM: [2, 2, 2] });
  const centerOffset = nodeOffset(gridSpec, 1, 1, 1);
  const centerWeight = 0.6875 ** 3;

  nearlyEqual(summary.mass, 11, 1e-5);
  nearlyEqual(summary.momentum[0], 16, 1e-5);
  nearlyEqual(summary.momentum[1], 24, 1e-5);
  nearlyEqual(summary.momentum[2], 32, 1e-5);
  nearlyEqual(projection.gridNodes[centerOffset], 11 * centerWeight, 1e-5);
  nearlyEqual(projection.gridNodes[centerOffset + 1], 8 * centerWeight * 2, 1e-5);
  assert.equal(projection.residentProductMassInputProductEventCount, 1);
  assert.equal(projection.residentProductMassCoupledEventCount, 1);
  nearlyEqual(projection.residentProductMassCoupledUnplacedMassKg, 3);
  assert.equal(projection.residentProductMassGridCouplingStatus, 'resident-product-mass-coupled-to-cpu-p2g-grid');
  assert.equal(projection.residentProductMassEosCouplingStatus, 'resident-product-mass-p2g-eos-sidecar-ready');
});

test('CPU MLS-MPM P2G grid projection ignores visible or inactive resident product event mass', () => {
  const { sphParticleState, mlsMpmParticleState } = manualBuffers();
  const rows = productEventRows({
    visibleMassKg: 4,
    unplacedMassKg: 0,
    status: 1
  });
  const projection = projectMlsMpmP2gGridCpu({
    sphParticleState,
    mlsMpmParticleState,
    gridSpacingM: 1,
    boxDimsM: [2, 2, 2],
    residentProductMass: residentProductMassFromRows(rows, { unplacedProductMassKg: 0 })
  });
  const summary = summarizeGrid(projection.gridNodes);

  nearlyEqual(summary.mass, 8, 1e-5);
  assert.equal(projection.residentProductMassInputProductEventCount, 1);
  assert.equal(projection.residentProductMassCoupledEventCount, 0);
  assert.equal(projection.residentProductMassGridCouplingStatus, 'resident-product-mass-coupled-to-cpu-p2g-grid');
});

test('CPU MLS-MPM P2G grid projection consumes resident product event velocity and EOS mechanics', () => {
  const { sphParticleState, mlsMpmParticleState } = manualBuffers({
    velocity: [0, 0, 0],
    massKg: 0,
    restDensityKgPerM3: 1,
    restVolumeM3: 0,
    mechanicsDtS: 0.1
  });
  const rows = productEventRows({
    position: [1.25, 1.25, 1.25],
    massKg: 8,
    visibleMassKg: 0,
    unplacedMassKg: 8,
    velocityMPerS: [1, 2, 3],
    supportVolumeM3: 1,
    restDensityKgPerM3: 4,
    soundSpeedMPerS: 10,
    eosModelId: 2
  });
  const projection = projectMlsMpmP2gGridCpu({
    sphParticleState,
    mlsMpmParticleState,
    gridSpacingM: 1,
    boxDimsM: [2, 2, 2],
    dt: 0.1,
    residentProductMass: residentProductMassFromRows(rows, { unplacedProductMassKg: 8 })
  });
  const gridSpec = createMlsMpmGridSpec({ gridSpacingM: 1, boxDimsM: [2, 2, 2] });
  const centerOffset = nodeOffset(gridSpec, 1, 1, 1);
  const centerWeight = 0.6875 ** 3;
  const expectedPressurePa = 400;
  const expectedDiagonalAffine = (-0.1 * 1 * 4) * -expectedPressurePa;
  const pressureMomentum = expectedDiagonalAffine * -0.25;

  nearlyEqual(projection.gridNodes[centerOffset], 8 * centerWeight, 1e-5);
  nearlyEqual(projection.gridNodes[centerOffset + 1], centerWeight * (8 * 1 + pressureMomentum), 1e-5);
  nearlyEqual(projection.gridNodes[centerOffset + 2], centerWeight * (8 * 2 + pressureMomentum), 1e-5);
  nearlyEqual(projection.gridNodes[centerOffset + 3], centerWeight * (8 * 3 + pressureMomentum), 1e-5);
});

test('CPU MLS-MPM P2G law isolation disables resident product event EOS pressure', () => {
  const { sphParticleState, mlsMpmParticleState } = manualBuffers({
    velocity: [0, 0, 0],
    massKg: 0,
    restDensityKgPerM3: 1,
    restVolumeM3: 0,
    mechanicsDtS: 0.1
  });
  const rows = productEventRows({
    position: [1.25, 1.25, 1.25],
    massKg: 8,
    visibleMassKg: 0,
    unplacedMassKg: 8,
    velocityMPerS: [1, 2, 3],
    supportVolumeM3: 1,
    restDensityKgPerM3: 4,
    soundSpeedMPerS: 10,
    eosModelId: 2
  });
  const projection = projectMlsMpmP2gGridCpu({
    sphParticleState,
    mlsMpmParticleState,
    gridSpacingM: 1,
    boxDimsM: [2, 2, 2],
    dt: 0.1,
    internalPressureScale: 0,
    residentProductMass: residentProductMassFromRows(rows, { unplacedProductMassKg: 8 })
  });
  const gridSpec = createMlsMpmGridSpec({ gridSpacingM: 1, boxDimsM: [2, 2, 2] });
  const centerOffset = nodeOffset(gridSpec, 1, 1, 1);
  const centerWeight = 0.6875 ** 3;

  nearlyEqual(projection.gridNodes[centerOffset], 8 * centerWeight, 1e-5);
  nearlyEqual(projection.gridNodes[centerOffset + 1], centerWeight * 8 * 1, 1e-5);
  nearlyEqual(projection.gridNodes[centerOffset + 2], centerWeight * 8 * 2, 1e-5);
  nearlyEqual(projection.gridNodes[centerOffset + 3], centerWeight * 8 * 3, 1e-5);
  assert.equal(projection.internalPressureScale, 0);
});

test('CPU MLS-MPM P2G grid projection includes APIC affine velocity contribution per node', () => {
  const { sphParticleState, mlsMpmParticleState } = manualBuffers({
    affineC: [1, 0, 0, 0, 0, 0, 0, 0, 0]
  });
  const projection = projectMlsMpmP2gGridCpu({
    sphParticleState,
    mlsMpmParticleState,
    gridSpacingM: 1,
    boxDimsM: [2, 2, 2]
  });
  const gridSpec = createMlsMpmGridSpec({ gridSpacingM: 1, boxDimsM: [2, 2, 2] });
  const centerOffset = nodeOffset(gridSpec, 1, 1, 1);
  const centerWeight = 0.6875 ** 3;
  const nodeMinusParticleX = -0.25;

  nearlyEqual(projection.gridNodes[centerOffset + 1], 8 * centerWeight * (2 + nodeMinusParticleX), 1e-5);
  nearlyEqual(projection.gridNodes[centerOffset + 2], 8 * centerWeight * 3, 1e-5);
  nearlyEqual(projection.gridNodes[centerOffset + 3], 8 * centerWeight * 4, 1e-5);
});

test('CPU MLS-MPM P2G grid projection includes derived pressure stress contribution per node', () => {
  const { sphParticleState, mlsMpmParticleState } = manualBuffers({
    velocity: [0, 0, 0],
    massKg: 8,
    restDensityKgPerM3: 4,
    restVolumeM3: 1,
    volumeRatioJ: 1,
    solidFlag: 0,
    soundSpeedMPerS: 10,
    eosModelId: 2,
    phaseFractions: [0, 0, 1, 0],
    mechanicsDtS: 0.1
  });
  const projection = projectMlsMpmP2gGridCpu({
    sphParticleState,
    mlsMpmParticleState,
    gridSpacingM: 1,
    boxDimsM: [2, 2, 2]
  });
  const gridSpec = createMlsMpmGridSpec({ gridSpacingM: 1, boxDimsM: [2, 2, 2] });
  const centerOffset = nodeOffset(gridSpec, 1, 1, 1);
  const centerWeight = 0.6875 ** 3;
  const expectedPressurePa = 101325 * 2;
  const expectedStressScale = -0.1 * 1 * 4;
  const expectedAffineDiagonal = expectedStressScale * -expectedPressurePa;
  const expectedNodeMomentum = centerWeight * expectedAffineDiagonal * -0.25;

  nearlyEqual(projection.gridNodes[centerOffset + 1], expectedNodeMomentum, 1e-3);
  nearlyEqual(projection.gridNodes[centerOffset + 2], expectedNodeMomentum, 1e-3);
  nearlyEqual(projection.gridNodes[centerOffset + 3], expectedNodeMomentum, 1e-3);
});

test('CPU MLS-MPM P2G applies admitted gauge pressure as inward condensed-particle stress', () => {
  const { sphParticleState, mlsMpmParticleState } = manualBuffers({
    velocity: [0, 0, 0],
    massKg: 8,
    restDensityKgPerM3: 8,
    restVolumeM3: 1,
    volumeRatioJ: 1,
    solidFlag: 1,
    shearModulusPa: 10,
    lameLambdaPa: 10,
    mechanicsDtS: 0.1
  });
  sphParticleState.thermo[4] = 1;
  const positive = projectMlsMpmP2gGridCpu({
    sphParticleState,
    mlsMpmParticleState,
    gridSpacingM: 1,
    boxDimsM: [2, 2, 2],
    externalGaugePressurePa: 100,
    externalGaugePressureEnabled: true
  });
  const negative = projectMlsMpmP2gGridCpu({
    sphParticleState,
    mlsMpmParticleState,
    gridSpacingM: 1,
    boxDimsM: [2, 2, 2],
    externalGaugePressurePa: -100,
    externalGaugePressureEnabled: true
  });
  const gridSpec = createMlsMpmGridSpec({ gridSpacingM: 1, boxDimsM: [2, 2, 2] });
  const lowerNodeOffset = nodeOffset(gridSpec, 1, 1, 1);
  const centerWeight = 0.6875 ** 3;
  const expectedInwardMomentum = centerWeight * 10;

  nearlyEqual(positive.gridNodes[lowerNodeOffset + 1], expectedInwardMomentum, 1e-5);
  nearlyEqual(positive.gridNodes[lowerNodeOffset + 2], expectedInwardMomentum, 1e-5);
  nearlyEqual(positive.gridNodes[lowerNodeOffset + 3], expectedInwardMomentum, 1e-5);
  nearlyEqual(negative.gridNodes[lowerNodeOffset + 1], -expectedInwardMomentum, 1e-5);
  nearlyEqual(summarizeGrid(positive.gridNodes).momentum[0], 0, 1e-5);
  assert.equal(positive.externalGaugePressureAppliedInStressProjection, true);
  assert.equal(positive.externalGaugePressureTarget, 'condensed-particle-solid-plus-liquid-fraction');
});

test('CPU MLS-MPM P2G external gauge pressure excludes gas and plasma carriers', () => {
  const buffers = manualBuffers({
    velocity: [0, 0, 0],
    massKg: 8,
    restDensityKgPerM3: 8,
    restVolumeM3: 1,
    volumeRatioJ: 1,
    solidFlag: 0,
    mechanicsDtS: 0.1
  });
  const baseline = projectMlsMpmP2gGridCpu({
    ...buffers,
    gridSpacingM: 1,
    boxDimsM: [2, 2, 2]
  });
  for (const phaseOffset of [6, 7]) {
    buffers.sphParticleState.thermo.fill(0, 4, 8);
    buffers.sphParticleState.thermo[phaseOffset] = 1;
    const projection = projectMlsMpmP2gGridCpu({
      ...buffers,
      gridSpacingM: 1,
      boxDimsM: [2, 2, 2],
      externalGaugePressurePa: 100,
      externalGaugePressureEnabled: true
    });
    assert.deepEqual(projection.gridNodes, baseline.gridNodes);
  }
});

test('MLS-MPM P2G packs external gauge pressure into the existing uniform padding lanes', () => {
  const gridSpec = createMlsMpmGridSpec({ gridSpacingM: 1, boxDimsM: [2, 2, 2] });
  const params = createProjectionParamsArray(
    gridSpec,
    7,
    0.001,
    0,
    1,
    null,
    101325,
    -3787.5,
    true
  );
  const view = new DataView(params);
  assert.equal(params.byteLength, 144);
  nearlyEqual(view.getFloat32(72, true), -3787.5, 1e-6);
  assert.equal(view.getUint32(76, true), 1);
  assert.match(mlsMpmP2gGridProjectionWgsl, /external_gauge_pressure_pa: f32/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /thermo1\.x \+ thermo1\.y/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /sigma\.x \+ vec3<f32>\(external_pressure/);
  assert.doesNotMatch(
    mlsMpmP2gGridProjectionWgsl,
    /schroeder_spatial_required != 0u\) \{\s*return false/
  );
});

test('CPU MLS-MPM P2G includes explicit hydrostatic pressure lane', () => {
  const { sphParticleState, mlsMpmParticleState } = manualBuffers({
    velocity: [0, 0, 0],
    massKg: 4,
    restDensityKgPerM3: 4,
    restVolumeM3: 1,
    volumeRatioJ: 1,
    solidFlag: 0,
    soundSpeedMPerS: 0,
    eosModelId: 1,
    hydrostaticPressurePa: 25,
    mechanicsDtS: 0.1
  });
  const projection = projectMlsMpmP2gGridCpu({
    sphParticleState,
    mlsMpmParticleState,
    gridSpacingM: 1,
    boxDimsM: [2, 2, 2]
  });
  const gridSpec = createMlsMpmGridSpec({ gridSpacingM: 1, boxDimsM: [2, 2, 2] });
  const centerOffset = nodeOffset(gridSpec, 1, 1, 1);
  const centerWeight = 0.6875 ** 3;
  const expectedStressScale = -0.1 * 1 * 4;
  const expectedAffineDiagonal = expectedStressScale * -25;
  const expectedNodeMomentum = centerWeight * expectedAffineDiagonal * -0.25;

  nearlyEqual(projection.gridNodes[centerOffset + 1], expectedNodeMomentum, 1e-5);
  nearlyEqual(projection.gridNodes[centerOffset + 2], expectedNodeMomentum, 1e-5);
  nearlyEqual(projection.gridNodes[centerOffset + 3], expectedNodeMomentum, 1e-5);
});

test('CPU MLS-MPM P2G can disable internal material EOS pressure for law isolation', () => {
  const { sphParticleState, mlsMpmParticleState } = manualBuffers({
    velocity: [0, 0, 0],
    massKg: 8,
    restDensityKgPerM3: 4,
    restVolumeM3: 1,
    volumeRatioJ: 1,
    solidFlag: 0,
    soundSpeedMPerS: 10,
    eosModelId: 2,
    hydrostaticPressurePa: 25,
    mechanicsDtS: 0.1
  });
  const projection = projectMlsMpmP2gGridCpu({
    sphParticleState,
    mlsMpmParticleState,
    gridSpacingM: 1,
    boxDimsM: [2, 2, 2],
    internalPressureScale: 0
  });
  const summary = summarizeGrid(projection.gridNodes);

  nearlyEqual(summary.mass, 8, 1e-5);
  nearlyEqual(summary.momentum[0], 0, 1e-5);
  nearlyEqual(summary.momentum[1], 0, 1e-5);
  nearlyEqual(summary.momentum[2], 0, 1e-5);
  assert.equal(projection.internalPressureScale, 0);
});

test('optional MLS-MPM P2G grid projection returns CPU reference when WebGPU is not requested', async () => {
  const { sphParticleState, mlsMpmParticleState } = manualBuffers();
  const execution = await runMlsMpmP2gGridProjectionWithOptionalWebGpu({
    sphParticleState,
    mlsMpmParticleState,
    gridSpacingM: 1,
    boxDimsM: [2, 2, 2],
    preferWebGpu: false,
    navigatorRef: {
      gpu: {
        async requestAdapter() {
          throw new Error('should not request WebGPU');
        }
      }
    }
  });

  assert.equal(execution.schema, ULG_MLS_MPM_GPU_GRID_PROJECTION_EXECUTION_SCHEMA);
  assert.equal(execution.backend, 'cpu-reference');
  assert.equal(execution.gridShift, 1);
  assert.equal(execution.webgpuStatus.status, 'not-requested');
  assert.equal(execution.p2gProjectionValidation, false);
  assert.equal(execution.fullPhysicsValidation, false);
});

test('optional MLS-MPM P2G grid projection falls back when WebGPU is unavailable', async () => {
  const { sphParticleState, mlsMpmParticleState } = manualBuffers();
  const execution = await runMlsMpmP2gGridProjectionWithOptionalWebGpu({
    sphParticleState,
    mlsMpmParticleState,
    gridSpacingM: 1,
    boxDimsM: [2, 2, 2],
    preferWebGpu: true,
    navigatorRef: {}
  });

  assert.equal(execution.backend, 'cpu-reference');
  assert.equal(execution.webgpuStatus.status, 'blocked-webgpu-unavailable');
  assert.equal(execution.webgpuStatus.fallback, 'cpu-reference');
});

test('optional MLS-MPM P2G grid projection never CPU-fallbacks selected canonical intent', async () => {
  const { sphParticleState, mlsMpmParticleState } = manualBuffers();
  const generation = canonicalSpatialEpochGenerationFixture(fakeP2gDevice());

  await assert.rejects(
    runMlsMpmP2gGridProjectionWithOptionalWebGpu({
      sphParticleState,
      mlsMpmParticleState,
      gridSpacingM: 1,
      boxDimsM: [2, 2, 2],
      preferWebGpu: true,
      navigatorRef: {},
      schroederLevelAssignment: {
        particleCount: 999,
        assignmentStrideFloats: 0,
        assignments: 'malformed-obsolete-authority'
      },
      schroederSelectedLevel: 2,
      schroederSpatialEpochGeneration: generation
    }),
    (error) => {
      assert.equal(error.code, 'ERR_CANONICAL_SPATIAL_AUTHORITY_REJECTED');
      assert.equal(error.status, 'canonical-spatial-webgpu-device-unavailable');
      return true;
    }
  );
});

test('optional MLS-MPM P2G grid projection accepts a parity-passing WebGPU result', async () => {
  const { sphParticleState, mlsMpmParticleState } = manualBuffers();
  const execution = await runMlsMpmP2gGridProjectionWithOptionalWebGpu({
    sphParticleState,
    mlsMpmParticleState,
    gridSpacingM: 1,
    boxDimsM: [2, 2, 2],
    preferWebGpu: true,
    navigatorRef: webGpuNavigator(),
    async webGpuRunner(args) {
      const result = projectMlsMpmP2gGridCpu(args);
      return { ...result, backend: 'webgpu' };
    }
  });

  assert.equal(execution.backend, 'webgpu');
  assert.equal(execution.webgpuStatus.status, 'webgpu-executed');
  assert.equal(execution.webgpuParity.schema, ULG_MLS_MPM_GPU_GRID_PROJECTION_PARITY_SCHEMA);
  assert.equal(execution.webgpuParity.status, 'pass');
});

test('optional MLS-MPM P2G grid projection forwards resident product mass into WebGPU runner metadata', async () => {
  const { sphParticleState, mlsMpmParticleState } = manualBuffers();
  const residentProductMass = residentProductMassFromRows(productEventRows());
  let seenResidentProductMass = null;
  let seenAmbientPressurePa = null;
  const execution = await runMlsMpmP2gGridProjectionWithOptionalWebGpu({
    sphParticleState,
    mlsMpmParticleState,
    gridSpacingM: 1,
    boxDimsM: [2, 2, 2],
    residentProductMass,
    ambientPressurePa: 101325,
    preferWebGpu: true,
    navigatorRef: webGpuNavigator(),
    async webGpuRunner(args) {
      seenResidentProductMass = args.residentProductMass;
      seenAmbientPressurePa = args.ambientPressurePa;
      const result = projectMlsMpmP2gGridCpu(args);
      return {
        ...result,
        backend: 'webgpu',
        residentProductMassGridCouplingStatus: 'resident-product-mass-bound-to-p2g-grid'
      };
    }
  });

  assert.equal(seenResidentProductMass, residentProductMass);
  assert.equal(seenAmbientPressurePa, 101325);
  assert.equal(execution.backend, 'webgpu');
  assert.equal(execution.residentProductMassStatus, 'resident-product-mass-buffer-retained');
  assert.equal(execution.residentProductMassInputProductEventCount, 1);
  assert.equal(execution.residentProductMassCoupledEventCount, 1);
  assert.equal(execution.residentProductMassGridCouplingStatus, 'resident-product-mass-bound-to-p2g-grid');
  assert.equal(execution.residentProductMassEosCouplingStatus, 'resident-product-mass-p2g-eos-sidecar-ready');
});

test('optional MLS-MPM P2G grid projection rejects parity drift and keeps CPU output', async () => {
  const { sphParticleState, mlsMpmParticleState } = manualBuffers();
  const execution = await runMlsMpmP2gGridProjectionWithOptionalWebGpu({
    sphParticleState,
    mlsMpmParticleState,
    gridSpacingM: 1,
    boxDimsM: [2, 2, 2],
    preferWebGpu: true,
    navigatorRef: webGpuNavigator(),
    async webGpuRunner(args) {
      const result = projectMlsMpmP2gGridCpu(args);
      result.backend = 'webgpu';
      result.gridNodes = result.gridNodes.slice();
      result.gridNodes[0] += 1;
      return result;
    },
    parityTolerance: 1e-8
  });

  assert.equal(execution.backend, 'cpu-reference');
  assert.equal(execution.webgpuStatus.status, 'webgpu-parity-failed');
  assert.equal(execution.webgpuParity.status, 'fail');
  assert.ok(execution.webgpuParity.maxGridAbs > 0.5);
});

test('MLS-MPM P2G grid projection parity report is explicit and non-scientific', () => {
  const { sphParticleState, mlsMpmParticleState } = manualBuffers();
  const cpuReference = projectMlsMpmP2gGridCpu({
    sphParticleState,
    mlsMpmParticleState,
    gridSpacingM: 1,
    boxDimsM: [2, 2, 2]
  });
  const parity = createMlsMpmP2gGridProjectionParityReport({
    cpuReference,
    gpuResult: { ...cpuReference, backend: 'webgpu' }
  });

  assert.equal(parity.schema, ULG_MLS_MPM_GPU_GRID_PROJECTION_PARITY_SCHEMA);
  assert.equal(parity.status, 'pass');
  assert.equal(parity.scientificValidation, false);
  assert.equal(parity.sphValidation, false);
  assert.equal(parity.phaseChangeValidation, false);
  assert.equal(parity.fullPhysicsValidation, false);
});

test('MLS-MPM P2G parity ignores inactive node position metadata only', () => {
  const { sphParticleState, mlsMpmParticleState } = manualBuffers();
  const cpuReference = projectMlsMpmP2gGridCpu({
    sphParticleState,
    mlsMpmParticleState,
    gridSpacingM: 1,
    boxDimsM: [2, 2, 2]
  });
  const gpuGrid = cpuReference.gridNodes.slice();
  gpuGrid[4] = 123;
  gpuGrid[5] = -456;
  gpuGrid[6] = 789;
  const parity = createMlsMpmP2gGridProjectionParityReport({
    cpuReference,
    gpuResult: { ...cpuReference, backend: 'webgpu', gridNodes: gpuGrid },
    tolerance: 1e-8
  });

  assert.equal(cpuReference.gridNodes[0], 0);
  assert.equal(cpuReference.gridNodes[7], 0);
  assert.equal(parity.status, 'pass');
  assert.equal(parity.maxGridAbs, 0);
  assert.equal(parity.ignoredInactivePositionMaxAbs, 789);
  assert.equal(parity.ignoredInactivePositionCount, 3);
});
