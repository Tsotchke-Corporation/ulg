import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mlsMpmP2gGridProjectionWgsl } from '../ulg-gpu-abi/src/wgsl.js';
import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT,
  SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT,
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
  createMlsMpmP2gGridProjectionParityReport,
  projectMlsMpmP2gGridCpu,
  resolveMlsMpmP2gBackendPolicy,
  runMlsMpmP2gGridProjectionWebGpu,
  SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS,
  runMlsMpmP2gGridProjectionWithOptionalWebGpu
} from '../src/runtime/sph/sphGridGpuKernel.js';

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
  mechanicsDtS = 0
} = {}) {
  const state = new Float32Array([
    position[0], position[1], position[2], massKg,
    velocity[0], velocity[1], velocity[2], 123
  ]);
  const thermo = new Float32Array(12);
  thermo[3] = restDensityKgPerM3;
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
  const device = {
    createdBuffers,
    bindGroups,
    dispatches,
    writes,
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
      submit() {},
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
  assert.match(mlsMpmP2gGridProjectionWgsl, /@group\(0\) @binding\(8\) var<storage, read> schroeder_active_nodes/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /schroeder_filter_enabled: u32/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /schroeder_active_node_filter_enabled: u32/);
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
  assert.equal(
    device.createdBuffers.some((buffer) => buffer.label === 'ulg-mls-mpm-p2g-schroeder-level-assignments-dummy'),
    false
  );
  assert.ok(device.bindGroups[0].entries.some((entry) => (
    entry.binding === 7 && entry.resource.buffer === assignmentBuffer
  )));
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
  const expectedPressurePa = 400;
  const expectedStressScale = -0.1 * 1 * 4;
  const expectedAffineDiagonal = expectedStressScale * -expectedPressurePa;
  const expectedNodeMomentum = centerWeight * expectedAffineDiagonal * -0.25;

  nearlyEqual(projection.gridNodes[centerOffset + 1], expectedNodeMomentum, 1e-5);
  nearlyEqual(projection.gridNodes[centerOffset + 2], expectedNodeMomentum, 1e-5);
  nearlyEqual(projection.gridNodes[centerOffset + 3], expectedNodeMomentum, 1e-5);
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
