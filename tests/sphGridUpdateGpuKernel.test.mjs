import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mlsMpmGridUpdateWgsl } from '../ulg-gpu-abi/src/wgsl.js';
import {
  SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT,
  ULG_MLS_MPM_GPU_GRID_PROJECTION_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
  ULG_SPH_PRESSURE_INTERFACE_FORCE_SOLVER_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import {
  MLS_MPM_GPU_GRID_VELOCITY_FLOATS,
  SPH_PRESSURE_INTERFACE_FORCE_FLOATS,
  ULG_MLS_MPM_GPU_GRID_UPDATE_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_UPDATE_PARITY_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
  ULG_DIRECT_RESIDENT_PRESSURE_INTERFACE_AUTHORITY,
  ULG_DIRECT_RESIDENT_PRESSURE_INTERFACE_PUBLICATION_SCHEMA,
  ULG_DIRECT_RESIDENT_PRESSURE_INTERFACE_PUBLICATION_STATUS,
  createDirectResidentPressureInterfaceGridForceAdmission,
  createMlsMpmGridUpdateParityReport,
  estimateMlsMpmWallBarrierElasticStiffness,
  mlsMpmWallBarrierContactResponse,
  pressureInterfaceGridForceAdmissionAllowsApplication,
  resolveWallBarrierContactMaterialPolicy,
  runMlsMpmGridUpdateWebGpu,
  runMlsMpmGridUpdateWithOptionalWebGpu,
  updateMlsMpmGridCpu
} from '../src/runtime/sph/sphGridUpdateGpuKernel.js';
import {
  tagWebGpuBufferDevice,
  webGpuDeviceId
} from '../src/runtime/sph/sphGpuDeviceIdentity.js';
import {
  mlsMpmMechanicsFieldGridUpdateWgsl
} from '../src/runtime/sph/sphMlsMpmGpuStep.js';
import {
  schroederSpatialPhaseVolumeTransportWgsl
} from '../ulg-gpu-abi/src/schroederSpatialPhaseVolumeTransportWgsl.js';

test('mechanics-field grid and transport kernels consume authenticated 2D indirect rows', () => {
  for (const wgsl of [
    mlsMpmMechanicsFieldGridUpdateWgsl,
    schroederSpatialPhaseVolumeTransportWgsl
  ]) {
    assert.match(
      wgsl,
      /let expected_y = [\s\S]*dispatch_y == expected_y[\s\S]*field_(?:word|load)\(44u\) == dispatch_x[\s\S]*field_(?:word|load)\(45u\) == dispatch_y[\s\S]*field_(?:word|load)\(46u\) == dispatch_z/
    );
    assert.match(
      wgsl,
      /workgroup_id\.x \+ workgroup_id\.y \* field_(?:word|load)\(60u\)/
    );
  }
  for (const entryPoint of [
    'clear_heat_rows',
    'main',
    'contact_fields',
    'summarize_heat_rows'
  ]) {
    assert.match(
      mlsMpmMechanicsFieldGridUpdateWgsl,
      new RegExp(
        `fn ${entryPoint}\\([\\s\\S]*field_linear_invocation\\(local_id, workgroup_id\\)`
      )
    );
  }
  for (const entryPoint of [
    'stage_transport',
    'validate_staged_transport',
    'commit_transport'
  ]) {
    assert.match(
      schroederSpatialPhaseVolumeTransportWgsl,
      new RegExp(
        `fn ${entryPoint}\\([\\s\\S]*field_linear_invocation\\(local_id, workgroup_id\\)`
      )
    );
  }
});

test('direct resident pressure admission requires exact same-device queue authority', () => {
  const solver = pressureInterfaceForceSolverFixture({
    forceApplicationStatus: 'apply-to-mls-mpm-grid',
    gridForceApplicationApproved: true
  });
  const admission = createDirectResidentPressureInterfaceGridForceAdmission({
    pressureInterfaceForceSolver: solver,
    strictReactionGate: strictReactionGatePassFixture(),
    producerDeviceId: 'ulg-webgpu-device:test-direct',
    residentComputeManagerMode: 'direct'
  });
  assert.equal(admission.pressureInterfacePublication.schema, ULG_DIRECT_RESIDENT_PRESSURE_INTERFACE_PUBLICATION_SCHEMA);
  assert.equal(admission.pressureInterfacePublication.status, ULG_DIRECT_RESIDENT_PRESSURE_INTERFACE_PUBLICATION_STATUS);
  assert.equal(admission.pressureInterfacePublication.authority, ULG_DIRECT_RESIDENT_PRESSURE_INTERFACE_AUTHORITY);
  assert.equal(admission.committed, false);
  assert.equal(pressureInterfaceGridForceAdmissionAllowsApplication({
    pressureInterfaceGridForceAdmission: admission,
    pressureInterfaceForceSolver: solver,
    forceRowCount: 1,
    consumerDeviceId: 'ulg-webgpu-device:test-direct'
  }).approved, true);

  for (const mutate of [
    (value) => { value.schema = 'forged'; },
    (value) => { value.authority = 'forged'; },
    (value) => { value.residentComputeManagerMode = 'compute-manager'; },
    (value) => { value.pressureInterfacePublication.authority = 'forged'; },
    (value) => { value.pressureInterfacePublication.sameDeviceQueueOrdered = false; },
    (value) => { value.pressureInterfacePublication.pressureInterfaceForceRowCount = 0; },
    (value) => { value.pressureInterfacePublication.producerDeviceId = 'ulg-webgpu-device:other'; },
    (value) => { value.strictReactionGate.strictForceCouplingAllowed = false; }
  ]) {
    const forged = structuredClone(admission);
    mutate(forged);
    assert.equal(pressureInterfaceGridForceAdmissionAllowsApplication({
      pressureInterfaceGridForceAdmission: forged,
      pressureInterfaceForceSolver: solver,
      forceRowCount: 1,
      consumerDeviceId: 'ulg-webgpu-device:test-direct'
    }).approved, false);
  }

  const differentSolver = pressureInterfaceForceSolverFixture({
    force: [16, 0, 0],
    reactionForce: [-16, 0, 0],
    forceApplicationStatus: 'apply-to-mls-mpm-grid',
    gridForceApplicationApproved: true
  });
  assert.equal(pressureInterfaceGridForceAdmissionAllowsApplication({
    pressureInterfaceGridForceAdmission: admission,
    pressureInterfaceForceSolver: differentSolver,
    forceRowCount: 1,
    consumerDeviceId: 'ulg-webgpu-device:test-direct'
  }).approved, false, 'direct admission must be bound to the exact solver rows');
});

test('self-declared pressure admission status is not publication evidence', () => {
  const solver = pressureInterfaceForceSolverFixture({
    forceApplicationStatus: 'apply-to-mls-mpm-grid',
    gridForceApplicationApproved: true
  });
  const forged = pressureInterfaceGridForceAdmissionFixture();
  forged.committed = false;
  assert.equal(pressureInterfaceGridForceAdmissionAllowsApplication({
    pressureInterfaceGridForceAdmission: forged,
    pressureInterfaceForceSolver: solver,
    forceRowCount: 1
  }).approved, false);
});

function nearlyEqual(actual, expected, tolerance = 1e-6) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

function strictReactionGatePassFixture() {
  return {
    schema: 'peercompute.ulg.sph-reaction-strict-gate.v0',
    status: 'strict-reaction-gate-pass',
    strictForceCouplingAllowed: true,
    blockers: [],
    warnings: [],
    provisionalEnergetics: []
  };
}

function manualP2gProjection({ mass = 2, momentum = [4, 0, 0], nodePosition = [1, 1, 1] } = {}) {
  return {
    schema: ULG_MLS_MPM_GPU_GRID_PROJECTION_EXECUTION_SCHEMA,
    projectionSchema: ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
    backend: 'cpu-reference',
    particleCount: 1,
    gridSpacingM: 1,
    gridDims: [4, 4, 4],
    gridNodeCount: 1,
    gridShift: 1,
    dt: 0.1,
    gridNodeStrideFloats: 8,
    gridNodes: new Float32Array([
      mass, momentum[0], momentum[1], momentum[2],
      nodePosition[0], nodePosition[1], nodePosition[2], mass > 0 ? 1 : 0
    ])
  };
}

function pressureInterfaceForceSolverFixture({
  centroid = [1, 1, 1],
  force = [8, 0, 0],
  reactionForce = [-8, 0, 0],
  pressurePa = 100000,
  status = 1,
  forceApplicationStatus = 'solver-ready-not-applied',
  gridForceApplicationApproved = false,
  forceRowValues: forceRowValuesOverride = null
} = {}) {
  const forceRowValues = new Float32Array(SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT.length);
  forceRowValues.set([
    0, 1, 2, 0,
    centroid[0], centroid[1], centroid[2], 1,
    force[0], force[1], force[2],
    reactionForce[0], reactionForce[1], reactionForce[2],
    pressurePa, status
  ]);
  return {
    schema: ULG_SPH_PRESSURE_INTERFACE_FORCE_SOLVER_SCHEMA,
    status: 'pressure-interface-force-solver-ready',
    forceCouplingStatus: 'pressure-force-solver-ready-not-applied',
    forceApplicationStatus,
    gridForceApplicationApproved,
    forceApplicationTarget: 'pending-mls-mpm-grid-force-consumer',
    forceRowCount: 1,
    forceRowValues: forceRowValuesOverride || forceRowValues
  };
}

function algorithmContactRowsFixture({
  normalStiffnessPa = 3.5e6,
  pairKey = 'drop:Na|base:h2o'
} = {}) {
  return {
    schema: 'peercompute.ulg.algorithm-material-contact-rows.v0',
    status: 'algorithm-derived-contact-rows-ready',
    rowCount: 1,
    rows: [
      {
        schema: 'peercompute.ulg.algorithm-material-contact-row.v0',
        status: 'algorithm-derived-contact-row-ready',
        pairKey,
        roles: ['drop', 'base'],
        materials: ['Na', 'h2o'],
        phases: ['solid', 'liquid'],
        normalStiffnessPa,
        supportRadiusM: 0.25,
        forceMutationAuthority: 'not-authoritative-contact-policy-row'
      }
    ]
  };
}

function pressureInterfaceGridForceAdmissionFixture({
  forceRowCount = 1,
  hotBufferKey = 'ulg:test:pressure-interface-grid-force-hot-buffer'
} = {}) {
  return {
    schema: 'peercompute.ulg.pressure-interface-grid-force-consumption-admission.v0',
    status: 'pressure-interface-grid-force-consumption-approved',
    gridForceApplicationApproved: true,
    committed: true,
    hotBufferKey,
    sourceHotBufferKey: hotBufferKey,
    pressureInterfaceForceRowCount: forceRowCount,
    outputFamilies: ['pressure-interface-force-rows']
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

function fakeGridUpdateDevice() {
  const createdBuffers = [];
  const dispatches = [];
  const device = {
    createdBuffers,
    dispatches,
    queue: {
      writeBuffer() {},
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

test('MLS-MPM grid update WGSL declares grid update bindings', () => {
  assert.match(mlsMpmGridUpdateWgsl, /struct GridUpdateParams/);
  assert.match(mlsMpmGridUpdateWgsl, /var<storage, read> p2g_grid_nodes/);
  assert.match(mlsMpmGridUpdateWgsl, /var<storage, read_write> updated_grid_nodes/);
  assert.match(mlsMpmGridUpdateWgsl, /params.cfl_factor/);
  assert.match(mlsMpmGridUpdateWgsl, /wall_barrier_elastic_stiffness_n_per_m: f32/);
  assert.match(mlsMpmGridUpdateWgsl, /fn wall_barrier_response_alpha/);
  assert.match(mlsMpmGridUpdateWgsl, /fn wall_barrier_corrected_normal_velocity/);
  assert.match(mlsMpmGridUpdateWgsl, /@compute @workgroup_size\(64\)/);
});

test('MLS-MPM wall barrier response applies cubic-barrier dynamic stiffness', () => {
  const loose = mlsMpmWallBarrierContactResponse({
    gapM: 0.5,
    normalVelocityMPerS: -2,
    nodeMassKg: 2,
    dtSeconds: 0.01
  });
  const tight = mlsMpmWallBarrierContactResponse({
    gapM: 0.001,
    normalVelocityMPerS: -2,
    nodeMassKg: 2,
    dtSeconds: 0.01
  });
  const elastic = mlsMpmWallBarrierContactResponse({
    gapM: 0.5,
    normalVelocityMPerS: -2,
    nodeMassKg: 2,
    dtSeconds: 0.01,
    elasticNormalStiffnessNPerM: 100000
  });
  const estimatedElasticity = estimateMlsMpmWallBarrierElasticStiffness({
    bulkModulusPa: 2.2e9,
    shearModulusPa: 1.1e9,
    supportLengthM: 0.02
  });

  assert.equal(loose.schema, 'peercompute.ulg.mls-mpm-wall-barrier-contact.v0');
  assert.equal(loose.mode, 'cubic-barrier-dynamic-grid-wall-response');
  assert.ok(loose.normalStiffness > 0);
  assert.ok(tight.normalStiffness > loose.normalStiffness);
  assert.ok(tight.responseAlpha > loose.responseAlpha);
  assert.ok(elastic.responseAlpha > loose.responseAlpha);
  assert.ok(tight.correctedNormalVelocityMPerS > loose.correctedNormalVelocityMPerS);
  assert.equal(estimatedElasticity.status, 'wall-barrier-elastic-stiffness-estimated');
  assert.equal(estimatedElasticity.mode, 'elasticity-inclusive-dynamic-stiffness-estimate');
  assert.ok(estimatedElasticity.elasticNormalStiffnessNPerM > 0);
});

test('MLS-MPM wall barrier policy derives stiffness from algorithm contact rows', () => {
  const rows = algorithmContactRowsFixture({ normalStiffnessPa: 7e6 });
  const policy = resolveWallBarrierContactMaterialPolicy({
    algorithmMaterialContactRows: rows,
    supportLengthM: 0.25
  });
  assert.equal(policy.status, 'wall-barrier-contact-material-policy-algorithm-contact-row');
  assert.equal(policy.source, 'algorithm-contact-row-normal-stiffness-support');
  assert.equal(policy.algorithmContactRowsSchema, rows.schema);
  assert.equal(policy.algorithmContactRowStatus, 'algorithm-derived-contact-row-ready');
  assert.equal(policy.algorithmContactPairKey, 'drop:Na|base:h2o');
  assert.deepEqual(policy.algorithmContactMaterials, ['Na', 'h2o']);
  assert.equal(policy.algorithmContactNormalStiffnessPa, 7e6);
  assert.equal(policy.wallBarrierElasticStiffnessNPerM, 7e6 * 0.25);

  const explicit = resolveWallBarrierContactMaterialPolicy({
    algorithmMaterialContactRows: rows,
    supportLengthM: 0.25,
    wallBarrierElasticStiffnessNPerM: 123
  });
  assert.equal(explicit.status, 'wall-barrier-contact-material-policy-explicit-stiffness');
  assert.equal(explicit.source, 'explicit-normal-stiffness');
  assert.equal(explicit.wallBarrierElasticStiffnessNPerM, 123);
});

test('CPU MLS-MPM grid update converts momentum to velocity and applies gravity', () => {
  const p2gGridProjection = manualP2gProjection({ nodePosition: [2, 2, 2] });
  const update = updateMlsMpmGridCpu({
    p2gGridProjection,
    dt: 0.1,
    gravityMPerS2: [0, -10, 0],
    boxDimsM: [5, 5, 5],
    cflFactor: 10
  });

  assert.equal(update.schema, ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA);
  assert.equal(update.backend, 'cpu-reference');
  assert.equal(update.kernelScope, 'mls-mpm-grid-velocity-update-gravity-cfl-walls');
  assert.equal(update.gridNodeStrideFloats, MLS_MPM_GPU_GRID_VELOCITY_FLOATS);
  nearlyEqual(update.updatedGridNodes[0], 2);
  nearlyEqual(update.updatedGridNodes[1], 2);
  nearlyEqual(update.updatedGridNodes[2], -1);
  nearlyEqual(update.updatedGridNodes[3], 0);
  nearlyEqual(update.updatedGridNodes[7], 1);
  assert.equal(update.gridUpdateValidation, false);
  assert.equal(update.g2pValidation, false);
  assert.equal(update.fullPhysicsValidation, false);
});

test('CPU MLS-MPM grid update applies CFL clamp and floor no-slip clamp', () => {
  const cfl = updateMlsMpmGridCpu({
    p2gGridProjection: manualP2gProjection({ momentum: [100, 0, 0], nodePosition: [2, 2, 2] }),
    dt: 0.1,
    gravityMPerS2: [0, 0, 0],
    boxDimsM: [5, 5, 5],
    cflFactor: 0.2
  });
  nearlyEqual(cfl.updatedGridNodes[1], 2);

  const wall = updateMlsMpmGridCpu({
    p2gGridProjection: manualP2gProjection({ momentum: [3, -4, 5], nodePosition: [2, 0, 2] }),
    dt: 0.1,
    gravityMPerS2: [0, 0, 0],
    boxDimsM: [5, 5, 5],
    cflFactor: 10,
    wallBarrierMaterialBulkModulusPa: 2.2e9,
    wallBarrierMaterialShearModulusPa: 1.1e9
  });
  nearlyEqual(wall.updatedGridNodes[1], 0);
  nearlyEqual(wall.updatedGridNodes[2], 0);
  nearlyEqual(wall.updatedGridNodes[3], 0);
  assert.equal(wall.wallBarrierContactStatus, 'wall-barrier-contact-applied-cpu-reference');
  assert.equal(wall.wallBarrierElasticStiffnessSource, 'bulk-shear-modulus-grid-support');
  assert.equal(wall.wallBarrierBulkModulusPa, 2.2e9);
  assert.equal(wall.wallBarrierShearModulusPa, 1.1e9);
  assert.equal(wall.wallBarrierSupportLengthM, 1);
  assert.ok(wall.wallBarrierElasticStiffnessNPerM > 0);
  assert.equal(wall.wallBarrierContactNodeCount, 1);
  assert.ok(wall.wallBarrierContactMaxResponseAlpha > 0.999);
  assert.ok(wall.wallBarrierContactMaxNormalStiffness > 0);

  const rowDrivenWall = updateMlsMpmGridCpu({
    p2gGridProjection: manualP2gProjection({ momentum: [3, -4, 5], nodePosition: [2, 0, 2] }),
    dt: 0.1,
    gravityMPerS2: [0, 0, 0],
    boxDimsM: [5, 5, 5],
    cflFactor: 10,
    algorithmMaterialContactRows: algorithmContactRowsFixture({ normalStiffnessPa: 4.4e6 })
  });
  assert.equal(rowDrivenWall.wallBarrierElasticStiffnessSource, 'algorithm-contact-row-normal-stiffness-support');
  assert.equal(rowDrivenWall.wallBarrierContactMaterialPolicyStatus, 'wall-barrier-contact-material-policy-algorithm-contact-row');
  assert.equal(rowDrivenWall.wallBarrierContactAlgorithmPairKey, 'drop:Na|base:h2o');
  assert.deepEqual(rowDrivenWall.wallBarrierContactAlgorithmMaterials, ['Na', 'h2o']);
  assert.equal(rowDrivenWall.wallBarrierContactAlgorithmNormalStiffnessPa, 4.4e6);
  assert.equal(rowDrivenWall.wallBarrierBulkModulusPa, 4.4e6);
  assert.equal(rowDrivenWall.wallBarrierShearModulusPa, 0);
  assert.equal(rowDrivenWall.wallBarrierSupportLengthM, 1);
  assert.ok(rowDrivenWall.wallBarrierElasticStiffnessNPerM > 0);
});

test('CPU MLS-MPM grid update leaves the first interior floor row free for liquid spreading', () => {
  const floorInterior = updateMlsMpmGridCpu({
    p2gGridProjection: manualP2gProjection({ momentum: [4, -4, 0], nodePosition: [2, 1, 2] }),
    dt: 0.1,
    gravityMPerS2: [0, 0, 0],
    boxDimsM: [5, 5, 5],
    cflFactor: 10
  });
  const floorGuard = updateMlsMpmGridCpu({
    p2gGridProjection: manualP2gProjection({ momentum: [4, -4, 0], nodePosition: [2, 0, 2] }),
    dt: 0.1,
    gravityMPerS2: [0, 0, 0],
    boxDimsM: [5, 5, 5],
    cflFactor: 10
  });
  const upperInterior = updateMlsMpmGridCpu({
    p2gGridProjection: manualP2gProjection({ momentum: [0, 4, 0], nodePosition: [2, 4, 2] }),
    dt: 0.1,
    gravityMPerS2: [0, 0, 0],
    boxDimsM: [5, 5, 5],
    cflFactor: 10
  });

  nearlyEqual(floorInterior.updatedGridNodes[1], 2);
  nearlyEqual(floorInterior.updatedGridNodes[2], -2);
  nearlyEqual(floorGuard.updatedGridNodes[1], 0);
  nearlyEqual(floorGuard.updatedGridNodes[2], 0);
  nearlyEqual(floorGuard.updatedGridNodes[3], 0);
  nearlyEqual(upperInterior.updatedGridNodes[2], 0);
});

test('optional MLS-MPM grid update returns CPU reference when WebGPU is not requested', async () => {
  const execution = await runMlsMpmGridUpdateWithOptionalWebGpu({
    p2gGridProjection: manualP2gProjection(),
    preferWebGpu: false,
    navigatorRef: {
      gpu: {
        async requestAdapter() {
          throw new Error('should not request WebGPU');
        }
      }
    }
  });

  assert.equal(execution.schema, ULG_MLS_MPM_GPU_GRID_UPDATE_EXECUTION_SCHEMA);
  assert.equal(execution.backend, 'cpu-reference');
  assert.equal(execution.gridShift, 1);
  assert.equal(execution.webgpuStatus.status, 'not-requested');
  assert.equal(execution.fullPhysicsValidation, false);
});

test('optional MLS-MPM grid update carries algorithm contact row wall policy', async () => {
  const execution = await runMlsMpmGridUpdateWithOptionalWebGpu({
    p2gGridProjection: manualP2gProjection({ momentum: [0, -8, 0], nodePosition: [1, 0, 1] }),
    preferWebGpu: false,
    dt: 0.1,
    gravityMPerS2: [0, 0, 0],
    cflFactor: 10,
    algorithmMaterialContactRows: algorithmContactRowsFixture({ normalStiffnessPa: 2.25e6 }),
    navigatorRef: {
      gpu: {
        async requestAdapter() {
          throw new Error('should not request WebGPU');
        }
      }
    }
  });

  assert.equal(execution.backend, 'cpu-reference');
  assert.equal(execution.wallBarrierElasticStiffnessSource, 'algorithm-contact-row-normal-stiffness-support');
  assert.equal(
    execution.wallBarrierContactMaterialPolicyStatus,
    'wall-barrier-contact-material-policy-algorithm-contact-row'
  );
  assert.equal(execution.wallBarrierContactAlgorithmRowsSchema, 'peercompute.ulg.algorithm-material-contact-rows.v0');
  assert.equal(execution.wallBarrierContactAlgorithmPairKey, 'drop:Na|base:h2o');
  assert.equal(execution.wallBarrierContactAlgorithmNormalStiffnessPa, 2.25e6);
});

test('optional MLS-MPM grid update falls back when WebGPU is unavailable', async () => {
  const execution = await runMlsMpmGridUpdateWithOptionalWebGpu({
    p2gGridProjection: manualP2gProjection(),
    preferWebGpu: true,
    navigatorRef: {}
  });

  assert.equal(execution.backend, 'cpu-reference');
  assert.equal(execution.webgpuStatus.status, 'blocked-webgpu-unavailable');
  assert.equal(execution.webgpuStatus.fallback, 'cpu-reference');
});

test('WebGPU MLS-MPM grid update binds a full pressure-force row for zero-force runs', async () => {
  const device = fakeGridUpdateDevice();
  const update = await runMlsMpmGridUpdateWebGpu({
    device,
    p2gGridProjection: manualP2gProjection(),
    readbackMode: 'no-full-readback'
  });
  const pressureForceBuffer = device.createdBuffers.find(
    (buffer) => buffer.label === 'ulg-mls-mpm-grid-update-pressure-force-rows'
  );

  assert.equal(update.backend, 'webgpu');
  assert.equal(update.readbackMode, 'no-full-readback');
  assert.equal(update.queueCompletionStatus, 'queue-submitted-cleanup-deferred');
  assert.equal(update.queueCompletionMethod, 'deferred queue.onSubmittedWorkDone cleanup');
  assert.equal(update.pressureInterfaceForceRowCount, 0);
  assert.ok(pressureForceBuffer);
  assert.equal(
    pressureForceBuffer.size,
    SPH_PRESSURE_INTERFACE_FORCE_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
});

test('WebGPU MLS-MPM grid update blocks ready-but-not-applied pressure rows by default', async () => {
  const device = fakeGridUpdateDevice();
  const update = await runMlsMpmGridUpdateWebGpu({
    device,
    p2gGridProjection: manualP2gProjection(),
    pressureInterfaceForceSolver: pressureInterfaceForceSolverFixture(),
    dt: 0.25,
    readbackMode: 'no-full-readback'
  });

  assert.equal(update.backend, 'webgpu');
  assert.equal(update.readbackMode, 'no-full-readback');
  assert.equal(update.queueCompletionStatus, 'queue-submitted-cleanup-deferred');
  assert.equal(update.queueCompletionMethod, 'deferred queue.onSubmittedWorkDone cleanup');
  assert.equal(update.pressureInterfaceForceSolverSchema, ULG_SPH_PRESSURE_INTERFACE_FORCE_SOLVER_SCHEMA);
  assert.equal(update.pressureInterfaceForceApplicationStatus, 'pressure-interface-grid-force-consumer-blocked-not-approved');
  assert.equal(update.pressureInterfaceForceConsumerStatus, 'blocked-pressure-force-solver-not-approved-for-grid-application');
  assert.equal(update.pressureInterfaceAppliedImpulseSource, 'not-applied-solver-ready-not-approved');
  assert.equal(update.pressureInterfaceImpulseProofStatus, 'solver-force-application-status-not-approved');
  assert.equal(update.pressureInterfaceForceRowCount, 0);
  nearlyEqual(update.pressureInterfaceAppliedImpulseMagnitudeNSeconds, 0, 1e-9);
});

test('WebGPU MLS-MPM grid update marks approved no-readback pressure impulse as submitted but unverified', async () => {
  const device = fakeGridUpdateDevice();
  const update = await runMlsMpmGridUpdateWebGpu({
    device,
    p2gGridProjection: manualP2gProjection(),
    pressureInterfaceForceSolver: pressureInterfaceForceSolverFixture({
      forceApplicationStatus: 'apply-to-mls-mpm-grid',
      gridForceApplicationApproved: true
    }),
    pressureInterfaceGridForceAdmission: pressureInterfaceGridForceAdmissionFixture(),
    dt: 0.25,
    readbackMode: 'no-full-readback'
  });

  assert.equal(update.backend, 'webgpu');
  assert.equal(update.readbackMode, 'no-full-readback');
  assert.equal(update.queueCompletionStatus, 'queue-submitted-cleanup-deferred');
  assert.equal(update.queueCompletionMethod, 'deferred queue.onSubmittedWorkDone cleanup');
  assert.equal(update.pressureInterfaceForceSolverSchema, ULG_SPH_PRESSURE_INTERFACE_FORCE_SOLVER_SCHEMA);
  assert.equal(update.pressureInterfaceForceApplicationStatus, 'pressure-interface-grid-force-consumer-submitted-unverified');
  assert.equal(update.pressureInterfaceGridForceAdmissionApproved, true);
  assert.equal(update.pressureInterfaceGridForceAdmissionStatus, 'pressure-interface-grid-force-consumption-approved');
  assert.equal(update.pressureInterfaceForceConsumerStatus, 'grid-momentum-impulse-submitted-unverified-no-full-readback');
  assert.equal(update.pressureInterfaceAppliedImpulseSource, 'pressure-force-row-sum-unverified-no-full-readback');
  assert.equal(update.pressureInterfaceImpulseProofStatus, 'submitted-to-gpu-grid-update-no-full-readback');
  assert.equal(update.pressureInterfaceForceRowsSource, 'solver-force-row-values');
  assert.equal(update.pressureInterfaceForceRowsBufferSubmitted, false);
  assert.equal(update.pressureInterfaceForceRowCount, 1);
  nearlyEqual(update.pressureInterfaceAppliedImpulseNSeconds[0], 2, 1e-5);
  nearlyEqual(update.pressureInterfaceAppliedImpulseMagnitudeNSeconds, 2, 1e-5);
});

test('WebGPU direct resident pressure admission remains approved at the exact device consumer', async () => {
  const device = fakeGridUpdateDevice();
  const solver = pressureInterfaceForceSolverFixture({
    forceApplicationStatus: 'apply-to-mls-mpm-grid',
    gridForceApplicationApproved: true
  });
  const pressureRowsBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'ulg-scene:test:direct-pressure-force-rows',
    size: solver.forceRowValues.byteLength,
    usage: 128
  }), device);
  const admission = createDirectResidentPressureInterfaceGridForceAdmission({
    pressureInterfaceForceSolver: solver,
    strictReactionGate: strictReactionGatePassFixture(),
    producerDeviceId: webGpuDeviceId(device),
    residentComputeManagerMode: 'direct'
  });
  const update = await runMlsMpmGridUpdateWebGpu({
    device,
    p2gGridProjection: manualP2gProjection(),
    pressureInterfaceForceRowsBuffer: pressureRowsBuffer,
    pressureInterfaceForceSolver: solver,
    pressureInterfaceGridForceAdmission: admission,
    dt: 0.25,
    readbackMode: 'no-full-readback'
  });

  assert.equal(update.pressureInterfaceGridForceAdmissionApproved, true);
  assert.equal(update.pressureInterfaceForceApplicationStatus, 'pressure-interface-grid-force-consumer-submitted-unverified');
  assert.equal(update.pressureInterfaceForceConsumerStatus, 'grid-momentum-impulse-submitted-unverified-no-full-readback');
  assert.equal(update.pressureInterfaceForceRowsBufferSubmitted, true);
  assert.equal(update.pressureInterfaceForceRowCount, 1);
});

test('WebGPU MLS-MPM grid update blocks approved pressure rows without StateManager admission', async () => {
  const device = fakeGridUpdateDevice();
  const update = await runMlsMpmGridUpdateWebGpu({
    device,
    p2gGridProjection: manualP2gProjection(),
    pressureInterfaceForceSolver: pressureInterfaceForceSolverFixture({
      forceApplicationStatus: 'apply-to-mls-mpm-grid',
      gridForceApplicationApproved: true
    }),
    dt: 0.25,
    readbackMode: 'no-full-readback'
  });

  assert.equal(update.backend, 'webgpu');
  assert.equal(update.pressureInterfaceForceApplicationStatus, 'pressure-interface-grid-force-consumer-blocked-not-approved');
  assert.equal(update.pressureInterfaceGridForceAdmissionApproved, false);
  assert.equal(update.pressureInterfaceGridForceAdmissionStatus, 'pressure-interface-grid-force-consumption-blocked');
  assert.equal(update.pressureInterfaceForceConsumerStatus, 'blocked-pressure-force-solver-not-approved-for-grid-application');
  assert.equal(update.pressureInterfaceAppliedImpulseSource, 'not-applied-solver-ready-not-approved');
  assert.equal(update.pressureInterfaceForceRowCount, 0);
  nearlyEqual(update.pressureInterfaceAppliedImpulseMagnitudeNSeconds, 0, 1e-9);
});

test('WebGPU MLS-MPM grid update records retained pressure force-row buffer submission without row readback', async () => {
  const device = fakeGridUpdateDevice();
  const pressureRowsBuffer = { label: 'ulg-worker:test:pressureInterface:forceRows' };
  const update = await runMlsMpmGridUpdateWebGpu({
    device,
    p2gGridProjection: manualP2gProjection(),
    pressureInterfaceForceRowsBuffer: pressureRowsBuffer,
    pressureInterfaceForceSolver: pressureInterfaceForceSolverFixture({
      forceApplicationStatus: 'apply-to-mls-mpm-grid',
      gridForceApplicationApproved: true,
      forceRowValues: new Float32Array(0)
    }),
    pressureInterfaceGridForceAdmission: pressureInterfaceGridForceAdmissionFixture(),
    dt: 0.25,
    readbackMode: 'no-full-readback'
  });
  const uploadedPressureForceBuffer = device.createdBuffers.find(
    (buffer) => buffer.label === 'ulg-mls-mpm-grid-update-pressure-force-rows'
  );

  assert.equal(uploadedPressureForceBuffer, undefined);
  assert.equal(update.pressureInterfaceForceApplicationStatus, 'pressure-interface-grid-force-consumer-submitted-unverified');
  assert.equal(update.pressureInterfaceForceConsumerStatus, 'grid-momentum-impulse-submitted-unverified-no-full-readback');
  assert.equal(update.pressureInterfaceForceRowCount, 1);
  assert.equal(update.pressureInterfaceForceRowsSource, 'retained-gpu-pressure-force-row-buffer');
  assert.equal(update.pressureInterfaceForceRowsBufferSubmitted, true);
  assert.equal(update.pressureInterfaceAppliedImpulseKnown, false);
  assert.equal(update.pressureInterfaceAppliedImpulseSource, 'pressure-force-row-buffer-submitted-no-full-readback');
  assert.equal(update.pressureInterfaceImpulseProofStatus, 'submitted-retained-pressure-force-row-buffer-to-gpu-grid-update-no-full-readback');
  nearlyEqual(update.pressureInterfaceAppliedImpulseMagnitudeNSeconds, 0, 1e-9);
});

test('optional MLS-MPM grid update accepts a parity-passing WebGPU result', async () => {
  const execution = await runMlsMpmGridUpdateWithOptionalWebGpu({
    p2gGridProjection: manualP2gProjection(),
    preferWebGpu: true,
    navigatorRef: webGpuNavigator(),
    async webGpuRunner(args) {
      const result = updateMlsMpmGridCpu(args);
      return { ...result, backend: 'webgpu' };
    }
  });

  assert.equal(execution.backend, 'webgpu');
  assert.equal(execution.webgpuStatus.status, 'webgpu-executed');
  assert.equal(execution.webgpuParity.schema, ULG_MLS_MPM_GPU_GRID_UPDATE_PARITY_SCHEMA);
  assert.equal(execution.webgpuParity.status, 'pass');
});

test('optional MLS-MPM grid update rejects parity drift and keeps CPU output', async () => {
  const execution = await runMlsMpmGridUpdateWithOptionalWebGpu({
    p2gGridProjection: manualP2gProjection(),
    preferWebGpu: true,
    navigatorRef: webGpuNavigator(),
    async webGpuRunner(args) {
      const result = updateMlsMpmGridCpu(args);
      result.backend = 'webgpu';
      result.updatedGridNodes = result.updatedGridNodes.slice();
      result.updatedGridNodes[1] += 1;
      return result;
    },
    parityTolerance: 1e-8
  });

  assert.equal(execution.backend, 'cpu-reference');
  assert.equal(execution.webgpuStatus.status, 'webgpu-parity-failed');
  assert.equal(execution.webgpuParity.status, 'fail');
  assert.ok(execution.webgpuParity.maxGridAbs > 0.5);
});

test('MLS-MPM grid update parity report is explicit and non-scientific', () => {
  const cpuReference = updateMlsMpmGridCpu({ p2gGridProjection: manualP2gProjection() });
  const parity = createMlsMpmGridUpdateParityReport({
    cpuReference,
    gpuResult: { ...cpuReference, backend: 'webgpu' }
  });

  assert.equal(parity.schema, ULG_MLS_MPM_GPU_GRID_UPDATE_PARITY_SCHEMA);
  assert.equal(parity.status, 'pass');
  assert.equal(parity.scientificValidation, false);
  assert.equal(parity.sphValidation, false);
  assert.equal(parity.phaseChangeValidation, false);
  assert.equal(parity.fullPhysicsValidation, false);
});
