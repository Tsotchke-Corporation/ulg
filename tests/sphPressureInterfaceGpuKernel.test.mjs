import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SPH_MATERIAL_INTERFACE_ELEMENT_ROW_LAYOUT,
  SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT,
  ULG_SCHROEDER_LAW_NEIGHBOR_CANDIDATE_EXECUTION_SCHEMA,
  ULG_SCHROEDER_LAW_QUEUE_EXECUTION_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import { sphPressureInterfaceContactKinematicsWgsl } from '../ulg-gpu-abi/src/wgsl.js';
import {
  createPressureInterfaceContactKinematicsParamsArray,
  createPressureInterfaceParticleBinParamsArray,
  createPressureInterfaceParamsArray,
  normalizeAlgorithmContactPairResponsePolicy,
  packAlgorithmContactPolicyRows,
  packGasPressureCellRows,
  packMaterialInterfaceContactKinematicsRows,
  packMaterialInterfaceElementRows,
  resolvePressureInterfaceParticleBinGrid,
  SPH_ALGORITHM_CONTACT_POLICY_FLOATS,
  SPH_GAS_PRESSURE_CELL_FLOATS,
  SPH_INTERFACE_CONTACT_KINEMATICS_FLOATS,
  runSphPressureInterfaceForceRowsWebGpu
} from '../src/runtime/sph/sphPressureInterfaceGpuKernel.js';

function interfaceFieldFixture() {
  return {
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
        normal: [1, 0, 0],
        normalAreaVectorM2: [1, 0, 0],
        gapM: 0.2,
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
        normal: [-1, 0, 0],
        normalAreaVectorM2: [-1, 0, 0],
        gapM: 0.2,
        normalVelocityMPerS: 0,
        representativeMassKg: 0
      }
    ]
  };
}

function fakePressureDevice() {
  const createdBuffers = [];
  const writes = [];
  const bindGroups = [];
  const dispatches = [];
  const shaderModules = [];
  const submissions = [];
  const copies = [];
  return {
    createdBuffers,
    writes,
    bindGroups,
    dispatches,
    shaderModules,
    submissions,
    copies,
    queue: {
      writeBuffer(buffer, offset, data) {
        const snapshot = data instanceof ArrayBuffer
          ? data.slice(0)
          : (ArrayBuffer.isView(data)
              ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
              : null);
        writes.push({ label: buffer.label, offset, byteLength: data?.byteLength ?? 0, snapshot });
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
        },
        async mapAsync() {},
        getMappedRange() {
          return new ArrayBuffer(size);
        },
        unmap() {
          this.unmapped = true;
        }
      };
      createdBuffers.push(buffer);
      return buffer;
    },
    createShaderModule({ code }) {
      const module = { code };
      shaderModules.push(module);
      return module;
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
      const bindGroup = { layout, entries };
      bindGroups.push(bindGroup);
      return bindGroup;
    },
    createCommandEncoder() {
      return {
        beginComputePass() {
          return {
            setPipeline() {},
            setBindGroup() {},
            dispatchWorkgroups(count) {
              dispatches.push(count);
            },
            end() {}
          };
        },
        copyBufferToBuffer(source, sourceOffset, target, targetOffset, size) {
          copies.push({ source, sourceOffset, target, targetOffset, size });
        },
        finish() {
          return { command: 'finished' };
        }
      };
    }
  };
}

function algorithmContactRowsFixture({
  normalStiffnessPa = 4e9,
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
        materialIds: [2, 1],
        phases: ['solid', 'liquid'],
        phaseIds: [1, 2],
        normalStiffnessPa,
        dampingViscosityPaS: 0.001,
        supportRadiusM: 0.25,
        forceMutationAuthority: 'not-authoritative-contact-policy-row'
      }
    ]
  };
}

test('pressure/interface WebGPU producer packs material interface element rows', () => {
  const packed = packMaterialInterfaceElementRows(interfaceFieldFixture());

  assert.equal(packed.rowCount, 2);
  assert.equal(packed.rowStrideFloats, SPH_MATERIAL_INTERFACE_ELEMENT_ROW_LAYOUT.length);
  assert.equal(packed.rows.length, 2 * SPH_MATERIAL_INTERFACE_ELEMENT_ROW_LAYOUT.length);
  assert.deepEqual([...packed.rows.slice(0, 16)], [
    0, 1, 2, 0,
    0.5, 1, 1, 1,
    1, 0, 0, 1,
    0, 0, 0, 1
  ]);

  const gasCells = packGasPressureCellRows({
    localPressureGradientReady: true,
    cells: [
      {
        gridIndex: [0, 0, 0],
        centerM: [0.5, 1, 1],
        pressurePa: 120000,
        pressureGradientPaPerM: [1000, 0, 0],
        volumeM3: 1
      }
    ]
  });
  assert.equal(gasCells.rowCount, 1);
  assert.equal(gasCells.rowStrideFloats, SPH_GAS_PRESSURE_CELL_FLOATS);
  assert.deepEqual([...gasCells.rows], [
    0, 0, 0, 1,
    0.5, 1, 1, 120000,
    1000, 0, 0, 1
  ]);

  const contactKinematics = packMaterialInterfaceContactKinematicsRows(interfaceFieldFixture());
  assert.equal(contactKinematics.rowCount, 2);
  assert.equal(contactKinematics.readyCount, 2);
  assert.equal(contactKinematics.rowStrideFloats, SPH_INTERFACE_CONTACT_KINEMATICS_FLOATS);
  assert.deepEqual([...contactKinematics.rows.slice(0, 4)], [0.20000000298023224, 0, 0, 1]);

  const kinematicsParams = createPressureInterfaceContactKinematicsParamsArray({
    elementCount: 2,
    particleCount: 8,
    contactPolicyRowCount: 1,
    derivationEnabled: true,
    maxSearchRadiusM: 0.5,
    gapFloorM: 0.001,
    particleBinGrid: {
      enabled: true,
      cellCount: 8,
      binCapacity: 64,
      gridDims: [2, 2, 2],
      originM: [0, 0, 0],
      cellSizeM: 0.25
    }
  });
  const kinematicsView = new DataView(kinematicsParams);
  assert.equal(kinematicsParams.byteLength, 64);
  assert.equal(kinematicsView.getUint32(0, true), 2);
  assert.equal(kinematicsView.getUint32(4, true), 8);
  assert.equal(kinematicsView.getUint32(8, true), 1);
  assert.equal(kinematicsView.getUint32(12, true), 1);
  assert.equal(kinematicsView.getUint32(16, true), 1);
  assert.equal(kinematicsView.getUint32(20, true), 8);
  assert.equal(kinematicsView.getUint32(24, true), 64);
  assert.equal(kinematicsView.getUint32(28, true), 2);
  assert.equal(kinematicsView.getUint32(32, true), 2);
  assert.equal(kinematicsView.getUint32(36, true), 2);
  assert.ok(Math.abs(kinematicsView.getFloat32(40, true) - 0.5) < 1e-9);
  assert.ok(Math.abs(kinematicsView.getFloat32(44, true) - 0.001) < 1e-9);
  assert.ok(Math.abs(kinematicsView.getFloat32(60, true) - 0.25) < 1e-9);

  const particleBinGrid = resolvePressureInterfaceParticleBinGrid({
    boxDimsM: [4, 4, 4],
    packedContactPolicy: packAlgorithmContactPolicyRows(normalizeAlgorithmContactPairResponsePolicy({
      algorithmMaterialContactRows: algorithmContactRowsFixture()
    })),
    maxSearchRadiusM: 0.5
  });
  assert.equal(particleBinGrid.status, 'interface-contact-particle-bin-grid-ready');
  assert.equal(particleBinGrid.enabled, true);
  assert.equal(particleBinGrid.binCapacity, 64);
  assert.equal(particleBinGrid.estimatedOverflowRisk, false);
  assert.ok(particleBinGrid.cellCount > 0);
  const binParams = createPressureInterfaceParticleBinParamsArray({
    particleCount: 8,
    particleBinGrid
  });
  const binView = new DataView(binParams);
  assert.equal(binParams.byteLength, 64);
  assert.equal(binView.getUint32(0, true), 8);
  assert.equal(binView.getUint32(24, true), 1);
  assert.ok(binView.getFloat32(44, true) > 0);
  assert.ok(binView.getFloat32(48, true) > 0);
  const denseParticleBinGrid = resolvePressureInterfaceParticleBinGrid({
    boxDimsM: [4, 4, 4],
    packedContactPolicy: packAlgorithmContactPolicyRows(normalizeAlgorithmContactPairResponsePolicy({
      algorithmMaterialContactRows: algorithmContactRowsFixture()
    })),
    maxSearchRadiusM: 0.5,
    particleCount: 10000
  });
  assert.equal(denseParticleBinGrid.status, 'interface-contact-particle-bin-grid-ready');
  assert.ok(denseParticleBinGrid.averageOccupancy > 19);
  assert.ok(denseParticleBinGrid.binCapacity > 64);
  assert.equal(denseParticleBinGrid.estimatedOverflowRisk, false);
  assert.equal(
    denseParticleBinGrid.indexBufferByteLength,
    denseParticleBinGrid.cellCount * denseParticleBinGrid.binCapacity * Uint32Array.BYTES_PER_ELEMENT
  );

  const params = createPressureInterfaceParamsArray({
    elementCount: 2,
    pressurePa: 120000,
    gasPressureCellCount: 1,
    pressureModelId: 1,
    contactPolicyRowCount: 1,
    algorithmContactPairResponseScale: 1e-4,
    algorithmContactMaxPressurePa: 500000,
    algorithmContactPairResponseEnabled: true
  });
  const view = new DataView(params);
  assert.equal(params.byteLength, 32);
  assert.equal(view.getUint32(0, true), 2);
  assert.equal(view.getFloat32(4, true), 120000);
  assert.equal(view.getUint32(8, true), 1);
  assert.equal(view.getUint32(12, true), 1);
  assert.equal(view.getUint32(16, true), 1);
  assert.ok(Math.abs(view.getFloat32(20, true) - 1e-4) < 1e-8);
  assert.equal(view.getFloat32(24, true), 500000);
  assert.equal(view.getFloat32(28, true), 1);
});

test('pressure/interface contact-kinematics WGSL can gate candidates from a Schroeder law queue', () => {
  assert.match(sphPressureInterfaceContactKinematicsWgsl, /struct\s+SchroederContactLawQueueParams/);
  assert.match(sphPressureInterfaceContactKinematicsWgsl, /@binding\(8\)\s+var<storage,\s*read>\s+schroeder_contact_law_queue_rows/);
  assert.match(sphPressureInterfaceContactKinematicsWgsl, /@binding\(9\)\s+var<uniform>\s+schroeder_contact_law_queue_params/);
  assert.match(sphPressureInterfaceContactKinematicsWgsl, /fn\s+ck_schroeder_law_queue_allows_particle/);
  assert.match(sphPressureInterfaceContactKinematicsWgsl, /SCHROEDER_CONTACT_LAW_QUEUE_CONTACT_ELIGIBLE_OFFSET/);
  assert.match(sphPressureInterfaceContactKinematicsWgsl, /SCHROEDER_CONTACT_LAW_QUEUE_INTERFACE_ELIGIBLE_OFFSET/);
  assert.match(sphPressureInterfaceContactKinematicsWgsl, /if\s*\(\s*!ck_schroeder_law_queue_allows_particle\(particle_index\)\s*\)/);
});

test('pressure/interface packs algorithm contact policy rows for GPU matching', () => {
  const policy = normalizeAlgorithmContactPairResponsePolicy({
    algorithmMaterialContactRows: algorithmContactRowsFixture(),
    algorithmContactPairResponseScale: 1e-4,
    algorithmContactMaxPressurePa: 500000
  });
  const packed = packAlgorithmContactPolicyRows(policy);

  assert.equal(policy.status, 'algorithm-contact-pair-response-policy-ready');
  assert.equal(policy.rowCount, 1);
  assert.equal(policy.rows[0].contactPressurePa, 400000);
  assert.equal(packed.rowCount, 1);
  assert.equal(packed.rowStrideFloats, SPH_ALGORITHM_CONTACT_POLICY_FLOATS);
  assert.equal(packed.rowByteLength, SPH_ALGORITHM_CONTACT_POLICY_FLOATS * Float32Array.BYTES_PER_ELEMENT);
  assert.deepEqual([...packed.rows.slice(0, 12)], [
    2, 1, 1, 2,
    4e9, 0.0010000000474974513, 0.25, 0.00009999999747378752,
    500000, 1, 0, 400000
  ]);
});

test('pressure/interface WebGPU producer dispatches no-full retained force-row buffer', async () => {
  const device = fakePressureDevice();
  const result = await runSphPressureInterfaceForceRowsWebGpu({
    device,
    pressureFeedback: {
      schema: 'peercompute.ulg.sph-sealed-gas-pressure-feedback.v0',
      status: 'wall-pressure-ledger-ready',
      totalPressurePa: 120000,
      gasCellField: {
        status: 'gas-cell-pressure-field-ready',
        uniformPressurePa: 120000,
        pressureFieldMode: 'uniform-single-cell-sealed-gas',
        pressureFieldResolution: 'lumped-sealed-box',
        gradientStatus: 'uniform-sealed-gas-pressure-zero-gradient'
      }
    },
    pressureInterfaceCoupling: {
      schema: 'peercompute.ulg.sph-pressure-interface-coupling.v0',
      status: 'pressure-interface-coupling-ready-for-solver',
      forceCouplingStatus: 'pressure-interface-coupling-ready'
    },
    materialInterfaceField: interfaceFieldFixture(),
    retainForceRowsBuffer: true,
    readbackMode: 'no-full-readback'
  });

  assert.equal(result.backend, 'webgpu');
  assert.equal(result.status, 'pressure-interface-stage-solver-ready');
  assert.equal(result.readbackMode, 'no-full-readback');
  assert.equal(result.fullReadbackPerformed, false);
  assert.equal(result.queueCompletionStatus, 'queue-submitted-cleanup-deferred');
  assert.equal(result.pressureInterfaceForceSolver.forceRowCount, 2);
  assert.equal(result.pressureInterfaceForceSolver.forceRowValues.length, 0);
  assert.equal(result.pressureInterfaceForceSolver.pressureFieldMode, 'uniform-single-cell-sealed-gas');
  assert.equal(result.pressureInterfaceForceSolver.pressureFieldResolution, 'lumped-sealed-box');
  assert.equal(result.pressureInterfaceForceSolver.pressureGradientStatus, 'uniform-sealed-gas-pressure-zero-gradient');
  assert.equal(result.pressureInterfaceForceSolver.localPressureGradientReady, false);
  assert.equal(result.pressureInterfaceForceSolver.localPressureGradientStatus, 'blocked-uniform-single-cell-field-has-no-local-gradient');
  assert.equal(result.pressureInterfaceForceSolver.localPressureGradientForceCouplingStatus, 'blocked-local-pressure-gradient-field-required');
  assert.equal(result.pressureInterfaceForceSolver.forceResolution, 'uniform-interface-traction');
  assert.equal(result.forceRowByteLength, 2 * SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT.length * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(result.forceRowsBuffer?.label, 'ulg-sph-pressure-interface-force-rows-out');
  assert.equal(device.dispatches[0], 1);
  assert.equal(device.submissions.length, 1);
  assert.equal(device.copies.length, 0);
  assert.ok(device.writes.some((entry) => entry.label === 'ulg-sph-pressure-interface-elements-in'));
  const emptyGasCellsBuffer = device.createdBuffers.find((entry) => entry.label === 'ulg-sph-pressure-interface-gas-cells-in');
  assert.equal(emptyGasCellsBuffer?.size, 16);
  assert.ok(device.writes.some((entry) => entry.label === 'ulg-sph-pressure-interface-force-params'));
  assert.equal(device.bindGroups[0].entries.length, 6);
  assert.ok(device.createdBuffers.some((entry) => entry.label === 'ulg-sph-pressure-interface-contact-policy-rows'));
  assert.ok(device.createdBuffers.some((entry) => entry.label === 'ulg-sph-pressure-interface-contact-kinematics-rows'));
  assert.equal(result.pressureInterfaceForceSolver.conservationStatus, 'pairwise-equal-opposite-force-conservative');
});

test('pressure/interface WebGPU producer applies algorithm contact-pair pressure policy', async () => {
  const device = fakePressureDevice();
  const result = await runSphPressureInterfaceForceRowsWebGpu({
    device,
    pressureFeedback: {
      schema: 'peercompute.ulg.sph-sealed-gas-pressure-feedback.v0',
      status: 'wall-pressure-ledger-ready',
      totalPressurePa: 120000,
      gasCellField: {
        status: 'gas-cell-pressure-field-ready',
        uniformPressurePa: 120000,
        pressureFieldMode: 'uniform-single-cell-sealed-gas',
        pressureFieldResolution: 'lumped-sealed-box',
        gradientStatus: 'uniform-sealed-gas-pressure-zero-gradient'
      }
    },
    pressureInterfaceCoupling: {
      schema: 'peercompute.ulg.sph-pressure-interface-coupling.v0',
      status: 'pressure-interface-coupling-ready-for-solver',
      forceCouplingStatus: 'pressure-interface-coupling-ready'
    },
    materialInterfaceField: interfaceFieldFixture(),
    algorithmMaterialContactRows: algorithmContactRowsFixture(),
    algorithmContactPairResponseScale: 1e-4,
    algorithmContactMaxPressurePa: 500000,
    retainForceRowsBuffer: true,
    readbackMode: 'no-full-readback'
  });

  const paramsWrite = device.writes.find((entry) => entry.label === 'ulg-sph-pressure-interface-force-params');
  const paramsView = new DataView(paramsWrite.snapshot);
  assert.equal(paramsView.getUint32(16, true), 1);
  assert.equal(paramsView.getFloat32(28, true), 1);
  assert.ok(device.writes.some((entry) => entry.label === 'ulg-sph-pressure-interface-contact-policy-rows'));
  assert.equal(result.algorithmContactPolicyRowCount, 1);
  assert.equal(result.pressureInterfaceForceSolver.algorithmContactPairResponseStatus, 'algorithm-contact-pair-response-applied');
  assert.equal(result.pressureInterfaceForceSolver.algorithmContactPolicyRowCount, 1);
  assert.equal(result.pressureInterfaceForceSolver.algorithmContactForceRowCount, 2);
  assert.equal(result.pressureInterfaceForceSolver.interfaceContactKinematicsReadyCount, 2);
  assert.deepEqual(result.pressureInterfaceForceSolver.algorithmContactPairKeys, ['drop:Na|base:h2o']);
  assert.ok(Math.abs(result.pressureInterfaceForceSolver.algorithmContactPressureRangePa[0] - 125000) < 1e-6);
  assert.ok(Math.abs(result.pressureInterfaceForceSolver.algorithmContactPressureRangePa[1] - 125000) < 1e-6);
  assert.equal(result.pressureInterfaceForceSolver.forceResolution, 'uniform-interface-traction+algorithm-contact-pair-response');
  assert.ok(Math.abs(result.pressureInterfaceForceSolver.gasInterfacePressureRangePa[0] - 245000) < 1e-6);
  assert.ok(Math.abs(result.pressureInterfaceForceSolver.gasInterfacePressureRangePa[1] - 245000) < 1e-6);
  assert.ok(Math.abs(result.pressureInterfaceForceSolver.totalAbsMaterialForceN - 490000) < 1e-6);
});

test('pressure/interface WebGPU producer derives contact kinematics from resident particle buffers', async () => {
  const device = fakePressureDevice();
  const fieldWithoutKinematics = interfaceFieldFixture();
  for (const element of fieldWithoutKinematics.elements) {
    delete element.gapM;
    delete element.normalVelocityMPerS;
    delete element.representativeMassKg;
  }
  const stateBuffer = device.createBuffer({
    label: 'test-sph-state-source',
    size: 2 * 8 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const thermoBuffer = device.createBuffer({
    label: 'test-sph-thermo-source',
    size: 2 * 12 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const schroederLawQueueBuffer = device.createBuffer({
    label: 'test-schroeder-law-queue',
    size: 2 * 32 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const schroederLawNeighborCandidateBuffer = device.createBuffer({
    label: 'test-schroeder-law-neighbor-candidates',
    size: 8 * 16 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });

  const result = await runSphPressureInterfaceForceRowsWebGpu({
    device,
    pressureFeedback: {
      schema: 'peercompute.ulg.sph-sealed-gas-pressure-feedback.v0',
      status: 'wall-pressure-ledger-ready',
      totalPressurePa: 120000,
      gasCellField: {
        status: 'gas-cell-pressure-field-ready',
        uniformPressurePa: 120000,
        pressureFieldMode: 'uniform-single-cell-sealed-gas',
        pressureFieldResolution: 'lumped-sealed-box',
        gradientStatus: 'uniform-sealed-gas-pressure-zero-gradient'
      }
    },
    pressureInterfaceCoupling: {
      schema: 'peercompute.ulg.sph-pressure-interface-coupling.v0',
      status: 'pressure-interface-coupling-ready-for-solver',
      forceCouplingStatus: 'pressure-interface-coupling-ready'
    },
    materialInterfaceField: fieldWithoutKinematics,
    algorithmMaterialContactRows: algorithmContactRowsFixture(),
    sphParticleUpload: {
      schema: 'peercompute.ulg.test-sph-particle-upload.v0',
      status: 'webgpu-uploaded',
      particleCount: 2,
      stateBuffer,
      thermoBuffer
    },
    schroederLawQueue: {
      schema: ULG_SCHROEDER_LAW_QUEUE_EXECUTION_SCHEMA,
      status: 'schroeder-law-queue-submitted',
      lawQueueBuffer: schroederLawQueueBuffer,
      activeNodeCount: 2,
      lawQueueStrideFloats: 32,
      enabledLawMask: 6
    },
    schroederLawNeighborCandidates: {
      schema: ULG_SCHROEDER_LAW_NEIGHBOR_CANDIDATE_EXECUTION_SCHEMA,
      status: 'schroeder-law-neighbor-candidates-submitted',
      neighborCandidateBuffer: schroederLawNeighborCandidateBuffer,
      neighborCandidateCount: 8,
      neighborCandidateStrideFloats: 16,
      candidateBudget: 4,
      lawQueueCount: 2,
      enabledLawMask: 6,
      enumerationMode: 'schroeder-law-queue-bounded-window-neighbor-enumeration',
      treeTraversalStatus: 'placeholder-window-traversal-before-sorted-schroeder-tree-neighbor-walk'
    },
    boxDimsM: [4, 4, 4],
    contactKinematicsParticleBinMetadataReadback: true,
    retainForceRowsBuffer: true,
    readbackMode: 'no-full-readback'
  });

  assert.equal(result.pressureInterfaceForceSolver.interfaceContactKinematicsGpuDerivationEligible, true);
  assert.equal(result.pressureInterfaceForceSolver.interfaceContactKinematicsGpuDerived, true);
  assert.equal(
    result.pressureInterfaceForceSolver.interfaceContactKinematicsDerivationStatus,
    'interface-contact-kinematics-gpu-derivation-submitted'
  );
  assert.equal(result.pressureInterfaceForceSolver.interfaceContactKinematicsParticleSourceStatus, 'interface-contact-kinematics-particle-source-ready');
  assert.equal(result.pressureInterfaceForceSolver.interfaceContactKinematicsParticleCount, 2);
  assert.equal(result.pressureInterfaceForceSolver.interfaceContactKinematicsParticleBinGridStatus, 'interface-contact-particle-bin-grid-submitted');
  assert.equal(result.pressureInterfaceForceSolver.interfaceContactKinematicsParticleBinGridEnabled, true);
  assert.ok(result.pressureInterfaceForceSolver.interfaceContactKinematicsParticleBinGridCellCount > 0);
  assert.equal(result.pressureInterfaceForceSolver.interfaceContactKinematicsParticleBinGridBinCapacity, 64);
  assert.ok(result.pressureInterfaceForceSolver.interfaceContactKinematicsParticleBinGridAverageOccupancy > 0);
  assert.equal(result.pressureInterfaceForceSolver.interfaceContactKinematicsParticleBinGridEstimatedOverflowRisk, false);
  assert.ok(result.pressureInterfaceForceSolver.interfaceContactKinematicsParticleBinGridIndexBufferByteLength > 0);
  assert.equal(result.pressureInterfaceForceSolver.interfaceContactKinematicsParticleBinOverflowStatus, 'particle-bin-overflow-readback-completed');
  assert.equal(result.pressureInterfaceForceSolver.interfaceContactKinematicsParticleBinOverflowCount, 0);
  assert.equal(result.pressureInterfaceForceSolver.schroederLawQueueStatus, 'schroeder-pressure-interface-law-queue-ready');
  assert.equal(result.pressureInterfaceForceSolver.schroederLawQueueConsumerStatus, 'schroeder-pressure-interface-law-queue-consumed');
  assert.equal(result.pressureInterfaceForceSolver.schroederLawQueueBufferConsumed, true);
  assert.equal(result.pressureInterfaceForceSolver.schroederLawQueueEnabledLawMask, 6);
  assert.equal(
    result.pressureInterfaceForceSolver.schroederLawNeighborCandidateStatus,
    'schroeder-pressure-interface-law-neighbor-candidates-ready'
  );
  assert.equal(
    result.pressureInterfaceForceSolver.schroederLawNeighborCandidateConsumerStatus,
    'schroeder-pressure-interface-law-neighbor-candidates-observed-not-authoritative'
  );
  assert.equal(result.pressureInterfaceForceSolver.schroederLawNeighborCandidateAvailable, true);
  assert.equal(result.pressureInterfaceForceSolver.schroederLawNeighborCandidateAuthoritative, false);
  assert.equal(result.pressureInterfaceForceSolver.schroederLawNeighborCandidateCount, 8);
  assert.equal(result.pressureInterfaceForceSolver.schroederLawNeighborCandidateBufferObserved, true);
  assert.equal(result.pressureInterfaceForceSolver.schroederLawNeighborCandidateBufferConsumed, false);
  assert.equal(result.schroederLawQueueStatus, 'schroeder-pressure-interface-law-queue-ready');
  assert.equal(result.schroederLawQueueConsumerStatus, 'schroeder-pressure-interface-law-queue-consumed');
  assert.equal(result.schroederLawQueueBufferConsumed, true);
  assert.equal(
    result.schroederLawNeighborCandidateStatus,
    'schroeder-pressure-interface-law-neighbor-candidates-ready'
  );
  assert.equal(
    result.schroederLawNeighborCandidateConsumerStatus,
    'schroeder-pressure-interface-law-neighbor-candidates-observed-not-authoritative'
  );
  assert.equal(result.schroederLawNeighborCandidateBufferObserved, true);
  assert.equal(result.schroederLawNeighborCandidateBufferConsumed, false);
  assert.equal(result.interfaceContactKinematicsGpuDerived, true);
  assert.equal(device.bindGroups.length, 3);
  assert.equal(device.bindGroups[0].entries.length, 5);
  assert.equal(device.bindGroups[0].entries[0].resource.buffer, stateBuffer);
  assert.equal(device.bindGroups[1].entries.length, 10);
  assert.equal(device.bindGroups[1].entries[1].resource.buffer, stateBuffer);
  assert.equal(device.bindGroups[1].entries[2].resource.buffer, thermoBuffer);
  assert.equal(device.bindGroups[1].entries[6].resource.buffer.label, 'ulg-sph-pressure-interface-particle-bin-counts');
  assert.equal(device.bindGroups[1].entries[7].resource.buffer.label, 'ulg-sph-pressure-interface-particle-bin-indices');
  assert.equal(device.bindGroups[1].entries[8].resource.buffer, schroederLawQueueBuffer);
  assert.equal(device.bindGroups[1].entries[9].resource.buffer.label, 'ulg-sph-pressure-interface-schroeder-law-queue-params');
  assert.equal(device.bindGroups[2].entries[5].resource.buffer.label, 'ulg-sph-pressure-interface-contact-kinematics-derived');
  const lawQueueParamsWrite = device.writes.find((entry) => entry.label === 'ulg-sph-pressure-interface-schroeder-law-queue-params');
  const lawQueueParamsView = new DataView(lawQueueParamsWrite.snapshot);
  assert.equal(lawQueueParamsView.getUint32(0, true), 1);
  assert.equal(lawQueueParamsView.getUint32(4, true), 2);
  assert.equal(lawQueueParamsView.getUint32(8, true), 32);
  assert.equal(lawQueueParamsView.getUint32(12, true), 6);
  assert.deepEqual(device.dispatches, [1, 1, 1]);
  assert.equal(device.copies.length, 1);
  assert.equal(device.copies[0].source.label, 'ulg-sph-pressure-interface-particle-bin-metadata');
  assert.equal(device.copies[0].target.label, 'ulg-sph-pressure-interface-particle-bin-metadata-readback');
  assert.equal(device.copies[0].size, 16);
  assert.equal(device.submissions.length, 3);
});

test('pressure/interface contact policy waits for interface kinematics', async () => {
  const device = fakePressureDevice();
  const fieldWithoutKinematics = interfaceFieldFixture();
  for (const element of fieldWithoutKinematics.elements) {
    delete element.gapM;
    delete element.normalVelocityMPerS;
    delete element.representativeMassKg;
  }
  const result = await runSphPressureInterfaceForceRowsWebGpu({
    device,
    pressureFeedback: {
      schema: 'peercompute.ulg.sph-sealed-gas-pressure-feedback.v0',
      status: 'wall-pressure-ledger-ready',
      totalPressurePa: 120000,
      gasCellField: {
        status: 'gas-cell-pressure-field-ready',
        uniformPressurePa: 120000,
        pressureFieldMode: 'uniform-single-cell-sealed-gas',
        pressureFieldResolution: 'lumped-sealed-box',
        gradientStatus: 'uniform-sealed-gas-pressure-zero-gradient'
      }
    },
    pressureInterfaceCoupling: {
      schema: 'peercompute.ulg.sph-pressure-interface-coupling.v0',
      status: 'pressure-interface-coupling-ready-for-solver',
      forceCouplingStatus: 'pressure-interface-coupling-ready'
    },
    materialInterfaceField: fieldWithoutKinematics,
    algorithmMaterialContactRows: algorithmContactRowsFixture(),
    algorithmContactPairResponseScale: 1e-4,
    algorithmContactMaxPressurePa: 500000,
    retainForceRowsBuffer: true,
    readbackMode: 'no-full-readback'
  });

  assert.equal(result.pressureInterfaceForceSolver.algorithmContactPolicyRowCount, 1);
  assert.equal(result.pressureInterfaceForceSolver.interfaceContactKinematicsReadyCount, 0);
  assert.equal(result.pressureInterfaceForceSolver.algorithmContactForceRowCount, 0);
  assert.equal(result.pressureInterfaceForceSolver.algorithmContactPairResponseStatus, 'algorithm-contact-pair-response-policy-ready');
  assert.equal(result.pressureInterfaceForceSolver.forceResolution, 'uniform-interface-traction');
  assert.deepEqual(result.pressureInterfaceForceSolver.gasInterfacePressureRangePa, [120000, 120000]);
});

test('pressure/interface WebGPU producer accepts local gas-cell pressure rows', async () => {
  const device = fakePressureDevice();
  const result = await runSphPressureInterfaceForceRowsWebGpu({
    device,
    pressureFeedback: {
      schema: 'peercompute.ulg.sph-sealed-gas-pressure-feedback.v0',
      status: 'wall-pressure-ledger-ready',
      totalPressurePa: 120000,
      gasCellField: {
        status: 'gas-cell-pressure-field-ready',
        uniformPressurePa: 120000,
        pressureFieldMode: 'local-gas-cell-pressure-gradient',
        pressureFieldResolution: 'structured-gas-cell-grid',
        gradientStatus: 'local-pressure-gradient-field-ready',
        localPressureGradientReady: true,
        localPressureGradientStatus: 'local-pressure-gradient-field-ready',
        cells: [
          {
            gridIndex: [0, 0, 0],
            centerM: [0.5, 1, 1],
            pressurePa: 120000,
            pressureGradientPaPerM: [0, 0, 0],
            volumeM3: 1
          },
          {
            gridIndex: [1, 0, 0],
            centerM: [1.5, 1, 1],
            pressurePa: 180000,
            pressureGradientPaPerM: [0, 0, 0],
            volumeM3: 1
          }
        ]
      }
    },
    pressureInterfaceCoupling: {
      schema: 'peercompute.ulg.sph-pressure-interface-coupling.v0',
      status: 'pressure-interface-coupling-ready-for-solver',
      forceCouplingStatus: 'pressure-interface-coupling-ready'
    },
    materialInterfaceField: interfaceFieldFixture(),
    retainForceRowsBuffer: true,
    readbackMode: 'no-full-readback'
  });

  const paramsWrite = device.writes.find((entry) => entry.label === 'ulg-sph-pressure-interface-force-params');
  const paramsView = new DataView(paramsWrite.snapshot);
  assert.equal(paramsView.getUint32(8, true), 2);
  assert.equal(paramsView.getUint32(12, true), 1);
  assert.equal(result.pressureInterfaceForceSolver.pressureFieldMode, 'local-gas-cell-pressure-gradient');
  assert.equal(result.pressureInterfaceForceSolver.pressureFieldResolution, 'structured-gas-cell-grid');
  assert.equal(result.pressureInterfaceForceSolver.localPressureGradientReady, true);
  assert.equal(result.pressureInterfaceForceSolver.localPressureGradientValidation, true);
  assert.equal(result.pressureInterfaceForceSolver.forceResolution, 'local-gradient-interface-traction');
  assert.equal(result.pressureInterfaceForceSolver.gasPressureCellRowCount, 2);
  assert.equal(result.pressureInterfaceForceSolver.gasPressureCellRowsBufferRetained, true);
  assert.equal(result.gasPressureCellRowsBufferRetained, true);
  assert.equal(result.gasPressureCellsBuffer?.label, 'ulg-sph-pressure-interface-gas-cells-in');
  assert.equal(result.gasPressureCellRowsBufferByteLength, 2 * SPH_GAS_PRESSURE_CELL_FLOATS * Float32Array.BYTES_PER_ELEMENT);
  assert.deepEqual(result.pressureInterfaceForceSolver.gasInterfacePressureRangePa, [120000, 180000]);
});
