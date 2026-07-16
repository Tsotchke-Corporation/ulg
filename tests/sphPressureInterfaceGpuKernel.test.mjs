import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  createSchroederSpatialEpochLayout,
  SCHROEDER_SPATIAL_EPOCH_KEY_WORDS,
  SCHROEDER_SPATIAL_EPOCH_MAGIC,
  SCHROEDER_SPATIAL_EPOCH_VERSION,
  SCHROEDER_SPATIAL_SORT_LEXICOGRAPHIC_U32X5,
  SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY,
  SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_ACTIVE_NODE_V0,
  SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
  SCHROEDER_SPATIAL_EXACT_NEAR_VIEW_ABI,
  SPH_INTERFACE_CONTACT_KINEMATICS_ROW_LAYOUT,
  SPH_MATERIAL_INTERFACE_ELEMENT_ROW_LAYOUT,
  SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT,
  ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
  ULG_SPH_INTERFACE_CONTACT_KINEMATICS_SCHEMA,
  ULG_SCHROEDER_LAW_NEIGHBOR_CANDIDATE_EXECUTION_SCHEMA,
  ULG_SCHROEDER_LAW_QUEUE_EXECUTION_SCHEMA,
  ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import {
  sphPressureInterfaceSpatialExactNearContactKinematicsWgsl
} from '../ulg-gpu-abi/src/schroederSpatialExactNearWgsl.js';
import {
  schroederSpatialExactNearTraversalV1Wgsl
} from '../ulg-gpu-abi/src/schroederSpatialExactNearTraversalWgsl.js';
import {
  sphPressureInterfaceContactKinematicsWgsl,
  sphPressureInterfaceForceRowsWgsl
} from '../ulg-gpu-abi/src/wgsl.js';
import {
  algorithmContactPairResponseForElement,
  canDeriveInterfaceContactKinematicsOnGpu,
  createPressureInterfaceContactKinematicsParamsArray,
  createPressureInterfaceSpatialExactNearParamsArray,
  createPressureInterfaceParticleBinParamsArray,
  createPressureInterfaceParamsArray,
  gasPressureTractionEligibleForElement,
  normalizeAlgorithmContactPairResponsePolicy,
  packAlgorithmContactPolicyRows,
  packGasPressureCellRows,
  packMaterialInterfaceContactKinematicsRows,
  packMaterialInterfaceElementRows,
  packMaterialInterfaceSourceKeyRows,
  resolvePressureInterfaceParticleBinGrid,
  resolveSchroederPressureInterfaceSpatialEpochProvenance,
  resolveSchroederPressureInterfaceSpatialEpochGeneration,
  resolveSchroederPressureInterfaceSpatialEpochSource,
  SPH_ALGORITHM_CONTACT_POLICY_FLOATS,
  SPH_GAS_PRESSURE_CELL_FLOATS,
  SPH_INTERFACE_CONTACT_KINEMATICS_FLOATS,
  runSphPressureInterfaceForceRowsWebGpu
} from '../src/runtime/sph/sphPressureInterfaceGpuKernel.js';
import {
  tagWebGpuBufferDevice,
  webGpuDeviceId
} from '../src/runtime/sph/sphGpuDeviceIdentity.js';

test('pressure/interface production source contains no private canonical SS producer', () => {
  const source = readFileSync(new URL(
    '../src/runtime/sph/sphPressureInterfaceGpuKernel.js',
    import.meta.url
  ), 'utf8');
  for (const forbidden of [
    'schroederPressureSpatialRuntimeCache',
    'SCHROEDER_SPATIAL_PRESSURE_ARENA_COUNT',
    'getSchroederPressureSpatialRuntime',
    'encodeSchroederPressureSpatialEpoch',
    'releaseSchroederPressureSpatialBuildAfterQueue',
    'ulg-sph-pressure-spatial-epoch',
    'pressure-private-runtime',
    'pressure-private-staged-generation'
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});

test('gas pressure traction targets condensed interfaces and never the source gas itself', () => {
  assert.equal(gasPressureTractionEligibleForElement({ phase: 'liquid', phaseId: 2 }), true);
  assert.equal(gasPressureTractionEligibleForElement({ phase: 'gas', phaseId: 3 }), false);
  assert.equal(gasPressureTractionEligibleForElement({ phase: 'plasma', phaseId: 4 }), false);
  assert.match(sphPressureInterfaceForceRowsWgsl, /row0\.z == 3\.0 \|\| row0\.z == 4\.0/);
});

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
    limits: {
      maxBufferSize: 256 * 1024 * 1024,
      maxStorageBufferBindingSize: 128 * 1024 * 1024,
      maxUniformBufferBindingSize: 64 * 1024,
      maxStorageBuffersPerShaderStage: 8,
      maxComputeWorkgroupsPerDimension: 65535,
      minUniformBufferOffsetAlignment: 256
    },
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
        clearBuffer() {},
        beginComputePass() {
          return {
            setPipeline() {},
            setBindGroup() {},
            dispatchWorkgroups(count) {
              dispatches.push(count);
            },
            dispatchWorkgroupsIndirect(buffer, byteOffset = 0) {
              dispatches.push({ indirect: true, buffer, byteOffset });
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
  pairKey = 'drop:Na|base:h2o',
  bodyIds = null,
  domainIds = null
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
        ...(Array.isArray(bodyIds) ? { bodyIds: [...bodyIds] } : {}),
        ...(Array.isArray(domainIds) ? { domainIds: [...domainIds] } : {}),
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

function spatialActiveNodeSourceFixture(device, {
  particleCount = 2,
  positionEpoch = 3,
  topologyEpoch = 1,
  overlayEnabled = false
} = {}) {
  const activeNodeBuffer = device.createBuffer({
    label: 'test-schroeder-spatial-active-node-source',
    size: particleCount * 16 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  return {
    schema: 'peercompute.ulg.schroeder-active-node-list-execution.v0',
    status: 'schroeder-active-node-list-submitted',
    particleCount,
    activeCandidateCount: particleCount,
    activeNodeStrideFloats: 16,
    activeNodeBuffer,
    phaseVolumeAssignmentOverlayEnabled: overlayEnabled,
    spatialDirectorySourceSchema:
      'peercompute.ulg.schroeder-spatial-directory-active-node-source.v1',
    spatialDirectorySourceStatus: 'schroeder-spatial-directory-source-ready',
    spatialDirectorySourceReady: true,
    spatialEpochSourceSchema: 'peercompute.ulg.schroeder-spatial-active-node-source.v1',
    spatialEpochSourceStatus: overlayEnabled
      ? 'schroeder-spatial-active-node-source-rejected-phase-volume-overlay'
      : 'schroeder-spatial-active-node-source-ready',
    spatialEpochSourceReady: !overlayEnabled,
    spatialEpochLevelSpacingMode: 'base-grid-spacing-times-pow2-level',
    spatialEpochPositionAuthority: 'same-epoch-pre-integration-particle-state',
    spatialEpochMinLevel: -1,
    spatialEpochMaxLevel: 1,
    spatialEpochBaseGridSpacingM: 0.25,
    spatialEpochChartId: 0,
    spatialEpochPhysicsTick: positionEpoch,
    spatialEpochPhysicsSubstep: 0,
    spatialEpochPositionEpoch: positionEpoch,
    spatialEpochTopologyEpoch: topologyEpoch,
    spatialEpochChartEpoch: 0,
    spatialEpochLevelEpoch: positionEpoch,
    spatialEpochSupportEpoch: positionEpoch,
    spatialEpochStorageGeneration: 1
  };
}

function attachSpatialInterfaceProvenance(field, {
  particleCount = 2,
  positionEpoch = 3,
  topologyEpoch = 1
} = {}) {
  return Object.assign(field, {
    spatialEpochInterfaceProvenanceStatus:
      'material-interface-current-particle-epoch-ready',
    spatialEpochPositionAuthority: 'same-epoch-pre-integration-particle-state',
    spatialEpochPositionEpoch: positionEpoch,
    spatialEpochTopologyEpoch: topologyEpoch,
    spatialEpochSourceCount: particleCount,
    spatialEpochStorageGeneration: 1
  });
}

function canonicalPressureRunFixture(device, {
  sourcePositionEpoch = 3,
  interfacePositionEpoch = sourcePositionEpoch,
  overlayEnabled = false
} = {}) {
  const materialInterfaceField = attachSpatialInterfaceProvenance(
    interfaceFieldFixture(),
    { positionEpoch: interfacePositionEpoch }
  );
  for (const element of materialInterfaceField.elements) {
    delete element.gapM;
    delete element.normalVelocityMPerS;
    delete element.representativeMassKg;
  }
  const stateBuffer = device.createBuffer({
    label: 'test-canonical-fixture-state-source',
    size: 2 * 8 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const thermoBuffer = device.createBuffer({
    label: 'test-canonical-fixture-thermo-source',
    size: 2 * 12 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const identityBuffer = device.createBuffer({
    label: 'test-canonical-fixture-identity-source',
    size: 2 * Uint32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const schroederActiveNodeList = spatialActiveNodeSourceFixture(device, {
    positionEpoch: sourcePositionEpoch,
    overlayEnabled
  });
  Object.assign(materialInterfaceField, {
    spatialEpochPhysicsTick: interfacePositionEpoch,
    spatialEpochPhysicsSubstep: 0,
    spatialEpochChartEpoch: 0,
    spatialEpochLevelEpoch: interfacePositionEpoch,
    spatialEpochSupportEpoch: interfacePositionEpoch,
    spatialEpochSourceStateBuffer: stateBuffer,
    spatialEpochSourceThermoBuffer: thermoBuffer,
    spatialEpochSourceIdentityBuffer: identityBuffer
  });
  return {
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
    materialInterfaceField,
    algorithmMaterialContactRows: algorithmContactRowsFixture({
      bodyIds: ['sodium-block', 'water-block'],
      domainIds: [11, 37]
    }),
    sphParticleUpload: {
      schema: 'peercompute.ulg.test-sph-particle-upload.v0',
      status: 'webgpu-uploaded',
      particleCount: 2,
      storageGeneration: 1,
      physicsTick: interfacePositionEpoch,
      physicsSubstep: 0,
      positionEpoch: interfacePositionEpoch,
      topologyEpoch: 1,
      chartEpoch: 0,
      levelEpoch: interfacePositionEpoch,
      supportEpoch: interfacePositionEpoch,
      stateBuffer,
      thermoBuffer,
      identityBuffer,
      identityRequired: true,
      identitySchema: ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
      identityStrideBytes: Uint32Array.BYTES_PER_ELEMENT,
      identityBufferByteLength: 2 * Uint32Array.BYTES_PER_ELEMENT
    },
    schroederActiveNodeList,
    boxDimsM: [4, 4, 4],
    retainForceRowsBuffer: true,
    readbackMode: 'no-full-readback'
  };
}

function sharedSpatialGenerationFixture(device, activeNodeList, {
  generationOverrides = {},
  sourceOverrides = {},
  executionOverrides = {},
  queryProfileOverrides = {},
  sourceRowLayoutId = SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_ACTIVE_NODE_V0,
  sourceFamily = sourceRowLayoutId
    === SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0
    ? 'schroeder-level-assignment-particles'
    : 'schroeder-active-node-particles'
} = {}) {
  const sourceCount = activeNodeList.activeCandidateCount;
  const layout = createSchroederSpatialEpochLayout({
    sourceCapacity: sourceCount,
    cellCapacity: sourceCount
  });
  const directoryBuffer = device.createBuffer({
    label: 'test-caller-owned-shared-spatial-directory',
    size: layout.byteLength,
    usage: 128
  });
  const epochs = {
    storageGeneration: activeNodeList.spatialEpochStorageGeneration,
    physicsTick: activeNodeList.spatialEpochPhysicsTick,
    physicsSubstep: activeNodeList.spatialEpochPhysicsSubstep,
    positionEpoch: activeNodeList.spatialEpochPositionEpoch,
    topologyEpoch: activeNodeList.spatialEpochTopologyEpoch,
    chartEpoch: activeNodeList.spatialEpochChartEpoch,
    levelEpoch: activeNodeList.spatialEpochLevelEpoch,
    supportEpoch: activeNodeList.spatialEpochSupportEpoch
  };
  const exactNearQueryProfile = {
    schema: 'peercompute.ulg.schroeder-spatial-exact-near-query-profile.v1',
    status: 'schroeder-spatial-exact-near-query-profile-ready',
    ready: true,
    mode: 1,
    sourceAdapterId: SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY,
    sourceBuffer: activeNodeList.activeNodeBuffer,
    activeNodeBuffer: activeNodeList.activeNodeBuffer,
    sourceCount,
    chartId: activeNodeList.spatialEpochChartId,
    minLevel: activeNodeList.spatialEpochMinLevel,
    maxLevel: activeNodeList.spatialEpochMaxLevel,
    levelCount:
      activeNodeList.spatialEpochMaxLevel - activeNodeList.spatialEpochMinLevel + 1,
    baseGridSpacingM: activeNodeList.spatialEpochBaseGridSpacingM,
    levelSpacingMode: activeNodeList.spatialEpochLevelSpacingMode,
    positionAuthority: activeNodeList.spatialEpochPositionAuthority,
    ...epochs,
    ...queryProfileOverrides
  };
  const source = {
    schema: 'peercompute.ulg.schroeder-spatial-directory-active-node-source.v1',
    status: 'schroeder-spatial-directory-source-ready',
    ready: true,
    sourceBuffer: activeNodeList.activeNodeBuffer,
    activeNodeBuffer: activeNodeList.activeNodeBuffer,
    sourceCount,
    sourceRowLayoutId,
    sourceRowStrideFloats: 16,
    activeNodeStrideFloats: 16,
    phaseVolumeAssignmentOverlayEnabled: false,
    exactNearQueryProfile,
    ...epochs,
    ...sourceOverrides
  };
  const releaseCalls = [];
  const execution = {
    schema: ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA,
    status: 'schroeder-spatial-epoch-gpu-build-submitted',
    magic: SCHROEDER_SPATIAL_EPOCH_MAGIC,
    abiVersion: SCHROEDER_SPATIAL_EPOCH_VERSION,
    exactKeyWordCount: SCHROEDER_SPATIAL_EPOCH_KEY_WORDS,
    sortKeyWordCount: SCHROEDER_SPATIAL_EPOCH_KEY_WORDS,
    sortMode: SCHROEDER_SPATIAL_SORT_LEXICOGRAPHIC_U32X5,
    sourceCount,
    sourceCapacity: sourceCount,
    cellCapacity: sourceCount,
    generationId: 41,
    deviceOrdinal: 17,
    laneOrdinal: 19,
    leaseToken: 41,
    sourceFamilyId: 23,
    sourceFamily,
    sourceRowLayoutId,
    sourceAdapterId: SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY,
    exactNearQueryProfile,
    queryGeometryEvidence: exactNearQueryProfile,
    buildOrdinal: 41,
    sortUniqueOrdinal: 41,
    layout,
    directoryBuffer,
    sourceBuffer: activeNodeList.activeNodeBuffer,
    activeNodeBuffer: activeNodeList.activeNodeBuffer,
    arenaIndex: 1,
    arenaGeneration: 1,
    deviceId: webGpuDeviceId(device),
    submitPerformed: true,
    released: false,
    ...epochs,
    ...executionOverrides
  };
  const runtime = {
    schema: ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA,
    status: 'schroeder-spatial-epoch-gpu-runtime-ready',
    deviceId: webGpuDeviceId(device),
    ownsExecution(candidate) {
      return candidate === execution && candidate.released !== true;
    },
    isExecutionSubmitted(candidate) {
      return candidate === execution
        && candidate.submitPerformed === true
        && candidate.status === 'schroeder-spatial-epoch-gpu-build-submitted';
    },
    releaseExecutionAfter(...args) {
      releaseCalls.push(args);
      return Promise.resolve(true);
    }
  };
  Object.defineProperty(execution, 'ownerRuntime', {
    value: runtime,
    enumerable: false,
    writable: false,
    configurable: false
  });
  const generation = {
    schema: 'peercompute.ulg.schroeder-spatial-epoch-generation.v1',
    status: 'schroeder-spatial-epoch-generation-submitted',
    ready: true,
    selected: true,
    source,
    execution,
    runtime,
    runtimeCapacity: sourceCount,
    runtimeCacheHit: false,
    directoryBuildCount: 1,
    releaseScheduled: false,
    releaseStatus: 'spatial-epoch-generation-retained-for-consumers',
    ...generationOverrides
  };
  return { generation, source, execution, exactNearQueryProfile, releaseCalls };
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
  assert.equal(contactKinematics.domainPairReadyCount, 0);
  assert.equal(contactKinematics.rowStrideFloats, SPH_INTERFACE_CONTACT_KINEMATICS_FLOATS);
  assert.equal(
    SPH_INTERFACE_CONTACT_KINEMATICS_FLOATS,
    SPH_INTERFACE_CONTACT_KINEMATICS_ROW_LAYOUT.length
  );
  assert.equal(contactKinematics.schema, ULG_SPH_INTERFACE_CONTACT_KINEMATICS_SCHEMA);
  assert.deepEqual([...contactKinematics.rows.slice(0, 8)], [
    0.20000000298023224, 0, 0, 1,
    0, 0, 0, 0
  ]);
  const domainContactField = interfaceFieldFixture();
  domainContactField.elements[0].domainIds = [37, 11];
  const domainContactKinematics = packMaterialInterfaceContactKinematicsRows(domainContactField);
  assert.equal(domainContactKinematics.domainPairReadyCount, 1);
  assert.equal(domainContactKinematics.domainIdentityObservedCount, 1);
  assert.deepEqual([...domainContactKinematics.rows.slice(4, 8)], [37, 11, 1, 0]);
  const sourceKeyField = interfaceFieldFixture();
  sourceKeyField.elements[0].sourceParticleIndex = 4;
  sourceKeyField.elements[1].sourceParticleIndex = 5;
  const sourceKeys = packMaterialInterfaceSourceKeyRows(sourceKeyField);
  assert.equal(sourceKeys.status, 'interface-source-key-rows-packed');
  assert.equal(sourceKeys.rowCount, 2);
  assert.equal(sourceKeys.readyCount, 2);
  assert.deepEqual([...sourceKeys.rows], [
    0, 4, 1, 0,
    1, 5, 1, 0
  ]);

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
  assert.match(sphPressureInterfaceContactKinematicsWgsl, /struct\s+SchroederContactLawNeighborParams/);
  assert.match(sphPressureInterfaceContactKinematicsWgsl, /@binding\(8\)\s+var<storage,\s*read>\s+schroeder_contact_law_queue_rows/);
  assert.match(sphPressureInterfaceContactKinematicsWgsl, /@binding\(9\)\s+var<uniform>\s+schroeder_contact_law_queue_params/);
  assert.match(sphPressureInterfaceContactKinematicsWgsl, /@binding\(10\)\s+var<storage,\s*read>\s+schroeder_contact_neighbor_candidate_rows/);
  assert.match(sphPressureInterfaceContactKinematicsWgsl, /@binding\(11\)\s+var<uniform>\s+schroeder_contact_neighbor_candidate_params/);
  assert.match(sphPressureInterfaceContactKinematicsWgsl, /@binding\(12\)\s+var<storage,\s*read>\s+schroeder_contact_source_span_rows/);
  assert.match(sphPressureInterfaceContactKinematicsWgsl, /@binding\(13\)\s+var<uniform>\s+schroeder_contact_source_span_params/);
  assert.match(sphPressureInterfaceContactKinematicsWgsl, /@binding\(14\)\s+var<storage,\s*read>\s+interface_source_key_rows/);
  assert.match(sphPressureInterfaceContactKinematicsWgsl, /@binding\(15\)\s+var<uniform>\s+interface_source_key_params/);
  assert.match(sphPressureInterfaceContactKinematicsWgsl, /@binding\(16\)\s+var<storage,\s*read>\s+particle_identity/);
  assert.match(sphPressureInterfaceContactKinematicsWgsl, /fn\s+ck_schroeder_law_queue_allows_particle/);
  assert.match(sphPressureInterfaceContactKinematicsWgsl, /fn\s+ck_schroeder_neighbor_candidates_enabled/);
  assert.match(sphPressureInterfaceContactKinematicsWgsl, /fn\s+ck_schroeder_source_spans_enabled/);
  assert.match(sphPressureInterfaceContactKinematicsWgsl, /fn\s+ck_schroeder_candidate_span/);
  assert.match(sphPressureInterfaceContactKinematicsWgsl, /fn\s+ck_schroeder_candidate_particle/);
  assert.match(sphPressureInterfaceContactKinematicsWgsl, /fn\s+ck_interface_source_particle_index/);
  assert.match(sphPressureInterfaceContactKinematicsWgsl, /SCHROEDER_CONTACT_LAW_QUEUE_CONTACT_ELIGIBLE_OFFSET/);
  assert.match(sphPressureInterfaceContactKinematicsWgsl, /SCHROEDER_CONTACT_LAW_QUEUE_INTERFACE_ELIGIBLE_OFFSET/);
  assert.match(sphPressureInterfaceContactKinematicsWgsl, /let\s+schroeder_span\s*=\s*ck_schroeder_candidate_span/);
  assert.match(sphPressureInterfaceContactKinematicsWgsl, /ck_interface_source_particle_index\(element_index,\s*element_row0\.x\)/);
  assert.match(sphPressureInterfaceContactKinematicsWgsl, /ck_schroeder_neighbor_candidates_enabled\(\)\s*&&\s*\(schroeder_span_ready\s*\|\|\s*schroeder_broad_candidate_fallback\)/);
  assert.match(sphPressureInterfaceContactKinematicsWgsl, /else\s+if\s*\(\s*ck_particle_bin_ready\(\)\s*\)/);
  assert.match(sphPressureInterfaceContactKinematicsWgsl, /law_queue_gate_required:\s*bool/);
  assert.match(sphPressureInterfaceContactKinematicsWgsl, /if\s*\(\s*law_queue_gate_required\s*&&\s*!ck_schroeder_law_queue_allows_particle\(particle_index\)\s*\)/);
  assert.match(sphPressureInterfaceContactKinematicsWgsl, /target_phase_id,\s*false/);
  assert.match(sphPressureInterfaceContactKinematicsWgsl, /particle_identity\[source_index\]/);
  assert.match(sphPressureInterfaceContactKinematicsWgsl, /particle_identity\[target_index\]/);
  assert.match(sphPressureInterfaceContactKinematicsWgsl, /contact_kinematics_rows\[element_index\s*\*\s*2u\s*\+\s*1u\]/);
  assert.match(
    sphPressureInterfaceContactKinematicsWgsl,
    /select\(0\.0,\s*1\.0,\s*domain_pair_ready\),\s*0\.0/
  );
});

test('pressure/interface canonical exact-near view has no candidate budget or private-bin binding', () => {
  assert.equal(
    SCHROEDER_SPATIAL_EXACT_NEAR_VIEW_ABI.lookup,
    'exact-cell-key-binary-search-sparse-prefix-csr-range'
  );
  assert.equal(SCHROEDER_SPATIAL_EXACT_NEAR_VIEW_ABI.emptyCellEnumeration, false);
  assert.equal(
    SCHROEDER_SPATIAL_EXACT_NEAR_VIEW_ABI.mountedInteractiveStatus,
    'mounted-same-device-pre-integration-generation-owner-scope-diagnostic-only-no-mechanics-authority'
  );
  assert.equal(SCHROEDER_SPATIAL_EXACT_NEAR_VIEW_ABI.candidateBudget, null);
  assert.equal(
    SCHROEDER_SPATIAL_EXACT_NEAR_VIEW_ABI.fallbackPolicy,
    'legacy-lookup-only-before-canonical-generation-selection'
  );

  const bindings = [...sphPressureInterfaceSpatialExactNearContactKinematicsWgsl.matchAll(
    /@group\(0\)\s+@binding\((\d+)\)/g
  )].map((match) => Number(match[1]));
  assert.deepEqual(bindings, [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.match(
    schroederSpatialExactNearTraversalV1Wgsl,
    /let expected_max_level = bitcast<i32>\(expected_max_level_order \^ 0x80000000u\)/
  );
  assert.match(
    schroederSpatialExactNearTraversalV1Wgsl,
    /\(evidence_max_level_bits \^ 0x80000000u\) == expected_max_level_order/
  );
  assert.match(
    schroederSpatialExactNearTraversalV1Wgsl,
    /fn\s+ss_exact_near_lower_bound_cell_key[\s\S]*iteration\s*<\s*32u\s*&&\s*lower\s*<\s*upper/
  );
  assert.match(
    schroederSpatialExactNearTraversalV1Wgsl,
    /fn\s+ss_exact_near_upper_bound_cell_key[\s\S]*iteration\s*<\s*32u\s*&&\s*lower\s*<\s*upper/
  );
  assert.match(
    sphPressureInterfaceSpatialExactNearContactKinematicsWgsl,
    /representative_mass_kg,\s*2\.0[\s\S]*f32\(best_pair\.policy_index\s*\+\s*1u\)/
  );
  assert.match(sphPressureInterfaceForceRowsWgsl, /fn\s+contact_policy_element_side/);
  assert.match(sphPressureInterfaceForceRowsWgsl, /fn\s+contact_selected_domain_pair_matches/);
  assert.match(
    sphPressureInterfaceForceRowsWgsl,
    /kinematics\.w\s*==\s*2\.0[\s\S]*selected_policy_token\s*!=\s*trunc\(selected_policy_token\)[\s\S]*selected_policy_row[\s\S]*contact_pressure_for_policy_row/
  );
  assert.match(
    sphPressureInterfaceForceRowsWgsl,
    /kinematics\.w\s*!=\s*1\.0[\s\S]*selected_policy_token\s*!=\s*0\.0/
  );
  assert.match(
    sphPressureInterfaceSpatialExactNearContactKinematicsWgsl,
    /level_begin\s*=\s*ss_lower_bound_cell_key[\s\S]*x_cursor[\s\S]*y_cursor[\s\S]*z_begin/
  );
  assert.match(
    sphPressureInterfaceSpatialExactNearContactKinematicsWgsl,
    /x_end\s*<=\s*x_cursor[\s\S]*return\s+ss_invalid_directory_pair\(\)/
  );
  assert.match(
    sphPressureInterfaceSpatialExactNearContactKinematicsWgsl,
    /y_end\s*<=\s*y_cursor[\s\S]*return\s+ss_invalid_directory_pair\(\)/
  );
  assert.match(
    sphPressureInterfaceSpatialExactNearContactKinematicsWgsl,
    /x_iteration\s*<\s*params\.particle_count\s*&&\s*x_cursor\s*<\s*level_end/
  );
  assert.match(
    sphPressureInterfaceSpatialExactNearContactKinematicsWgsl,
    /y_iteration\s*<\s*params\.particle_count\s*&&\s*y_cursor\s*<\s*x_end/
  );
  assert.doesNotMatch(
    sphPressureInterfaceSpatialExactNearContactKinematicsWgsl,
    /\bwhile\s*\(/
  );
  assert.match(
    schroederSpatialExactNearTraversalV1Wgsl,
    /expected_cell_offsets_offset_words\s*\+\s*cell_index\s*\+\s*1u/
  );
  assert.match(
    sphPressureInterfaceSpatialExactNearContactKinematicsWgsl,
    /directory_query_radius_m\s*=\s*search_radius_m\s*\*\s*1\.4142135623730951/
  );
  assert.match(
    schroederSpatialExactNearTraversalV1Wgsl,
    /arrayLength\(&spatial_directory\)/
  );
  assert.match(
    schroederSpatialExactNearTraversalV1Wgsl,
    /SS_EXACT_NEAR_STATUS_INVALID_SOURCE[\s\S]*SS_EXACT_NEAR_STATUS_CAPACITY_OVERFLOW/
  );
  assert.match(
    schroederSpatialExactNearTraversalV1Wgsl,
    /SS_EXACT_NEAR_HEADER_COMPLETION_ORDINAL[\s\S]*==\s*build_ordinal/
  );
  assert.match(
    schroederSpatialExactNearTraversalV1Wgsl,
    /SS_EXACT_NEAR_HEADER_SOURCE_ADAPTER[\s\S]*SS_EXACT_NEAR_SOURCE_ADAPTER_QUERY_V1/
  );
  assert.match(
    schroederSpatialExactNearTraversalV1Wgsl,
    /query_evidence_offset[\s\S]*SS_EXACT_NEAR_QUERY_EVIDENCE_WORDS[\s\S]*physical_upper/
  );
  assert.match(
    schroederSpatialExactNearTraversalV1Wgsl,
    /evidence_min_level_bits\s*==\s*bitcast<u32>\(expected\.min_level\)/
  );
  assert.match(
    schroederSpatialExactNearTraversalV1Wgsl,
    /evidence_base_spacing_bits\s*==\s*bitcast<u32>\(expected\.base_grid_spacing_m\)/
  );
  assert.match(
    schroederSpatialExactNearTraversalV1Wgsl,
    /expected_cell_offsets_offset_words\]\s*==\s*0u[\s\S]*expected_cell_offsets_offset_words\s*\+\s*cell_count[\s\S]*==\s*source_count/
  );
  assert.match(
    schroederSpatialExactNearTraversalV1Wgsl,
    /member_begin\s*>\s*member_end\s*\|\|\s*member_end\s*>\s*expected\.source_count[\s\S]*return\s+ss_exact_near_invalid_range\(\)/
  );
  assert.match(
    schroederSpatialExactNearTraversalV1Wgsl,
    /source_index\s*>=\s*expected\.source_count[\s\S]*return\s+SchroederSpatialExactNearSourceLookupV1\(0u, 0u\)/
  );
  assert.match(
    sphPressureInterfaceSpatialExactNearContactKinematicsWgsl,
    /pair\.directory_valid\s*==\s*0u[\s\S]*return/
  );
  assert.doesNotMatch(
    sphPressureInterfaceSpatialExactNearContactKinematicsWgsl,
    /particle_bin_(counts|indices|metadata)/
  );
  assert.doesNotMatch(
    sphPressureInterfaceSpatialExactNearContactKinematicsWgsl,
    /neighbor_candidate_(rows|params)|candidate_budget/
  );
  assert.doesNotMatch(
    sphPressureInterfaceSpatialExactNearContactKinematicsWgsl,
    /for\s*\(var\s+d[xyz]\s*=|center_cell\s*\+\s*vec3<i32>/
  );
});

test('pressure/interface canonical source and interface provenance admit only one matching epoch', () => {
  const device = fakePressureDevice();
  const sourceExecution = spatialActiveNodeSourceFixture(device);
  const source = resolveSchroederPressureInterfaceSpatialEpochSource(sourceExecution, {
    device,
    particleCount: 2
  });
  assert.equal(source.ready, true);
  assert.equal(source.status, 'schroeder-spatial-exact-near-source-ready');
  assert.equal(source.levelCount, 3);
  assert.equal(source.levelSpacingMode, 'base-grid-spacing-times-pow2-level');

  const current = resolveSchroederPressureInterfaceSpatialEpochProvenance({
    spatialSource: source,
    materialInterfaceField: attachSpatialInterfaceProvenance(interfaceFieldFixture()),
    particleCount: 2
  });
  assert.equal(current.ready, true);
  assert.equal(
    current.status,
    'schroeder-spatial-exact-near-interface-provenance-ready'
  );

  const stale = resolveSchroederPressureInterfaceSpatialEpochProvenance({
    spatialSource: source,
    materialInterfaceField: attachSpatialInterfaceProvenance(interfaceFieldFixture(), {
      positionEpoch: 2
    }),
    particleCount: 2
  });
  assert.equal(stale.ready, false);
  assert.equal(
    stale.status,
    'schroeder-spatial-exact-near-interface-provenance-rejected'
  );

  const overlay = resolveSchroederPressureInterfaceSpatialEpochSource(
    spatialActiveNodeSourceFixture(device, { overlayEnabled: true }),
    { device, particleCount: 2 }
  );
  assert.equal(overlay.ready, false);
  assert.equal(overlay.status, 'schroeder-spatial-exact-near-source-rejected-overlay');

  const wrongCount = resolveSchroederPressureInterfaceSpatialEpochSource(sourceExecution, {
    device,
    particleCount: 3
  });
  assert.equal(wrongCount.ready, false);
  assert.equal(wrongCount.status, 'schroeder-spatial-exact-near-source-rejected-count');
});

test('pressure/interface canonical source rejects coercible immutable query fields', () => {
  const device = fakePressureDevice();
  const cases = [
    ['spatialEpochChartId', null],
    ['spatialEpochChartId', false],
    ['spatialEpochChartId', ''],
    ['spatialEpochChartId', '0'],
    ['spatialEpochChartId', 0n],
    ['spatialEpochChartId', {}],
    ['spatialEpochMinLevel', '-1'],
    ['spatialEpochMaxLevel', '1'],
    ['spatialEpochPhysicsSubstep', '0'],
    ['spatialEpochChartEpoch', false],
    ['spatialEpochBaseGridSpacingM', '0.5'],
    ['activeCandidateCount', '2'],
    ['activeNodeStrideFloats', '16']
  ];
  for (const [field, value] of cases) {
    const sourceExecution = spatialActiveNodeSourceFixture(device);
    sourceExecution[field] = value;
    const source = resolveSchroederPressureInterfaceSpatialEpochSource(sourceExecution, {
      device,
      particleCount: 2
    });
    assert.equal(source.ready, false, `${field}=${String(value)}`);
  }
  const numericZero = spatialActiveNodeSourceFixture(device);
  numericZero.spatialEpochChartId = 0;
  numericZero.spatialEpochPhysicsSubstep = 0;
  numericZero.spatialEpochChartEpoch = 0;
  assert.equal(resolveSchroederPressureInterfaceSpatialEpochSource(numericZero, {
    device,
    particleCount: 2
  }).ready, true);
});

test('pressure/interface canonical exact-near params carry the selected directory identity', () => {
  const spatialBuild = {
    source: {
      chartId: 7,
      levelCount: 4,
      minLevel: -2,
      baseGridSpacingM: 0.125
    },
    execution: {
      generationId: 13,
      deviceOrdinal: 17,
      laneOrdinal: 19,
      leaseToken: 23,
      sourceFamilyId: 29,
      storageGeneration: 31,
      physicsTick: 37,
      physicsSubstep: 2,
      positionEpoch: 41,
      topologyEpoch: 43,
      chartEpoch: 47,
      levelEpoch: 53,
      supportEpoch: 59,
      sourceCapacity: 64,
      cellCapacity: 64,
      layout: {
        cellKeysOffsetWords: 48,
        cellOffsetsOffsetWords: 368,
        cellMembersOffsetWords: 433,
        particleToCellOffsetWords: 497,
        wordLength: 565
      }
    }
  };
  const params = createPressureInterfaceSpatialExactNearParamsArray({
    elementCount: 5,
    particleCount: 61,
    contactPolicyRowCount: 3,
    derivationEnabled: true,
    maxSearchRadiusM: 0.75,
    gapFloorM: 0.01,
    spatialBuild
  });
  const view = new DataView(params);
  assert.equal(params.byteLength, 128);
  assert.deepEqual([
    view.getUint32(0, true),
    view.getUint32(4, true),
    view.getUint32(8, true),
    view.getUint32(12, true),
    view.getUint32(16, true),
    view.getUint32(20, true),
    view.getUint32(24, true)
  ], [5, 61, 3, 1, 7, 4, 13]);
  assert.equal(view.getInt32(76, true), -2);
  assert.equal(view.getFloat32(80, true), 0.125);
  assert.equal(view.getFloat32(84, true), 0.75);
  assert.ok(Math.abs(view.getFloat32(88, true) - 0.01) < 1e-8);
  // Word 31 remains reserved. The shader authenticates maxLevel by deriving
  // minLevel + levelCount - 1 and comparing it with the GPU evidence tail.
  assert.equal(view.getUint32(124, true), 0);
  assert.deepEqual([
    view.getUint32(96, true),
    view.getUint32(100, true),
    view.getUint32(104, true),
    view.getUint32(108, true),
    view.getUint32(112, true),
    view.getUint32(116, true),
    view.getUint32(120, true)
  ], [48, 368, 433, 497, 565, 64, 64]);
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

test('pressure/interface contact policy retains optional initial-body domain identity', () => {
  const policy = normalizeAlgorithmContactPairResponsePolicy({
    algorithmMaterialContactRows: algorithmContactRowsFixture({
      bodyIds: ['sodium-block', 'water-tank'],
      domainIds: [11, 37]
    })
  });
  const packed = packAlgorithmContactPolicyRows(policy);

  assert.deepEqual(policy.rows[0].bodyIds, ['sodium-block', 'water-tank']);
  assert.deepEqual(policy.rows[0].domainIds, [11, 37]);
  assert.equal(policy.rows[0].domainPairReady, true);
  assert.equal(policy.rows[0].bodySpecific, true);
  assert.equal(policy.genericMaterialPhaseRowCount, 0);
  assert.equal(policy.bodySpecificRowCount, 1);
  assert.equal(policy.bodyPairRowCount, 1);
  assert.equal(policy.domainPairRowCount, 1);
  assert.equal(packed.domainPairRowCount, 1);
  assert.equal(packed.bodySpecificWithoutDomainPairRowCount, 0);
  assert.equal(packed.domainPairGpuSelectionReady, true);
  assert.equal(
    packed.domainPairGpuSelectionStatus,
    'algorithm-contact-exact-domain-pairs-encoded-in-gpu-rows'
  );
  assert.deepEqual([...packed.rows.slice(12, 16)], [11, 37, 1, 1]);
});

test('pressure/interface GPU rows select exact unordered domains for same-material bodies', () => {
  const rowFor = (pairKey, domainIds) => ({
    ...algorithmContactRowsFixture({ pairKey, domainIds }).rows[0],
    materials: ['h2o', 'h2o'],
    materialIds: [1, 1],
    phases: ['liquid', 'liquid'],
    phaseIds: [2, 2]
  });
  const wrongPair = rowFor('left-water|third-water', [7, 23]);
  const exactPair = rowFor('left-water|right-water', [7, 19]);
  const policy = normalizeAlgorithmContactPairResponsePolicy({
    algorithmMaterialContactRows: {
      schema: 'peercompute.ulg.algorithm-material-contact-rows.v0',
      status: 'algorithm-derived-contact-rows-ready',
      rows: [wrongPair, exactPair]
    }
  });
  const response = algorithmContactPairResponseForElement({
    ...interfaceFieldFixture().elements[0],
    domainIds: [19, 7]
  }, policy);
  const packed = packAlgorithmContactPolicyRows(policy);

  assert.equal(response.row?.pairKey, 'left-water|right-water');
  assert.equal(response.selectionStatus, 'algorithm-contact-exact-unordered-domain-pair-selected');
  assert.deepEqual([...packed.rows.slice(12, 16)], [7, 23, 1, 1]);
  assert.deepEqual([...packed.rows.slice(28, 32)], [7, 19, 1, 1]);
  assert.match(sphPressureInterfaceForceRowsWgsl, /fn\s+contact_domain_pair_matches/);
  assert.match(sphPressureInterfaceForceRowsWgsl, /exact_domain_count\s*==\s*1u/);
  assert.match(sphPressureInterfaceForceRowsWgsl, /else\s+if\s*\(generic_count\s*>\s*0u\)/);
});

test('pressure/interface exact-domain ambiguity never silently selects a body-specific GPU row', () => {
  const first = algorithmContactRowsFixture({
    pairKey: 'first-body-specific',
    domainIds: [11, 37]
  }).rows[0];
  const second = algorithmContactRowsFixture({
    pairKey: 'second-body-specific',
    domainIds: [37, 11]
  }).rows[0];
  const policy = normalizeAlgorithmContactPairResponsePolicy({
    algorithmMaterialContactRows: {
      schema: 'peercompute.ulg.algorithm-material-contact-rows.v0',
      status: 'algorithm-derived-contact-rows-ready',
      rows: [first, second]
    }
  });
  const response = algorithmContactPairResponseForElement({
    ...interfaceFieldFixture().elements[0],
    domainIds: [11, 37]
  }, policy);

  assert.equal(response.status, 'algorithm-contact-pair-response-body-specific-ambiguous');
  assert.equal(response.contactPressurePa, 0);
  assert.equal(response.row, null);
  assert.match(sphPressureInterfaceForceRowsWgsl, /selected_row\s*==\s*4294967295u/);
  assert.doesNotMatch(sphPressureInterfaceForceRowsWgsl, /selected_pressure\s*=\s*max/);
});

test('pressure/interface domain-specific GPU derivation fails closed without resident identity', () => {
  const policy = normalizeAlgorithmContactPairResponsePolicy({
    algorithmMaterialContactRows: algorithmContactRowsFixture({ domainIds: [11, 37] })
  });
  const packedPolicy = packAlgorithmContactPolicyRows(policy);
  const request = {
    packedInterfaceElements: { rowCount: 1 },
    packedContactPolicy: packedPolicy,
    packedContactKinematics: { readyCount: 0 },
    particleSource: { ready: true, identityReady: false }
  };

  assert.equal(canDeriveInterfaceContactKinematicsOnGpu(request), false);
  assert.equal(canDeriveInterfaceContactKinematicsOnGpu({
    ...request,
    particleSource: { ready: true, identityReady: true }
  }), true);
});

test('pressure/interface contact selection prefers an exact unordered domain pair', () => {
  const genericRow = algorithmContactRowsFixture({ pairKey: 'generic:Na|h2o' }).rows[0];
  const wrongDomainRow = algorithmContactRowsFixture({
    pairKey: 'sodium:Na|other-water:h2o',
    bodyIds: ['sodium-block', 'other-water'],
    domainIds: [11, 22]
  }).rows[0];
  const exactDomainRow = algorithmContactRowsFixture({
    pairKey: 'sodium:Na|water:h2o',
    bodyIds: ['sodium-block', 'water-tank'],
    domainIds: [11, 37]
  }).rows[0];
  const policy = normalizeAlgorithmContactPairResponsePolicy({
    algorithmMaterialContactRows: {
      schema: 'peercompute.ulg.algorithm-material-contact-rows.v0',
      status: 'algorithm-derived-contact-rows-ready',
      rows: [genericRow, wrongDomainRow, exactDomainRow]
    }
  });
  const element = {
    ...interfaceFieldFixture().elements[0],
    domainIds: [37, 11]
  };
  const response = algorithmContactPairResponseForElement(element, policy);

  assert.equal(response.row?.pairKey, 'sodium:Na|water:h2o');
  assert.equal(response.selectionStatus, 'algorithm-contact-exact-unordered-domain-pair-selected');
  assert.deepEqual(response.bodyDomainIdentity.domainIds, [37, 11]);
  assert.ok(response.contactPressurePa > 0);
});

test('pressure/interface contact selection falls back to a generic material/phase row', () => {
  const genericRow = algorithmContactRowsFixture({ pairKey: 'generic:Na|h2o' }).rows[0];
  const bodySpecificRow = algorithmContactRowsFixture({
    pairKey: 'sodium:Na|water:h2o',
    bodyIds: ['sodium-block', 'water-tank'],
    domainIds: [11, 37]
  }).rows[0];
  const policy = normalizeAlgorithmContactPairResponsePolicy({
    algorithmMaterialContactRows: {
      schema: 'peercompute.ulg.algorithm-material-contact-rows.v0',
      status: 'algorithm-derived-contact-rows-ready',
      rows: [bodySpecificRow, genericRow]
    }
  });
  const element = {
    ...interfaceFieldFixture().elements[0],
    domainIds: [91, 92]
  };
  const response = algorithmContactPairResponseForElement(element, policy);

  assert.equal(response.row?.pairKey, 'generic:Na|h2o');
  assert.equal(response.selectionStatus, 'algorithm-contact-generic-material-phase-fallback-selected');
  assert.ok(response.contactPressurePa > 0);
});

test('pressure/interface contact selection diagnoses only ambiguous body-specific overrides', () => {
  const leftWaterRow = algorithmContactRowsFixture({
    pairKey: 'sodium:Na|left-water:h2o',
    bodyIds: ['sodium-block', 'left-water'],
    domainIds: [11, 22]
  }).rows[0];
  const rightWaterRow = algorithmContactRowsFixture({
    pairKey: 'sodium:Na|right-water:h2o',
    bodyIds: ['sodium-block', 'right-water'],
    domainIds: [11, 37]
  }).rows[0];
  const rowsSource = {
    schema: 'peercompute.ulg.algorithm-material-contact-rows.v0',
    status: 'algorithm-derived-contact-rows-ready',
    rows: [leftWaterRow, rightWaterRow]
  };
  const policy = normalizeAlgorithmContactPairResponsePolicy({
    algorithmMaterialContactRows: rowsSource
  });
  const sodiumElement = {
    ...interfaceFieldFixture().elements[0],
    material: 'Na',
    phase: 'solid',
    materialId: 2,
    phaseId: 1,
    renderDomainId: 11
  };
  const ambiguous = algorithmContactPairResponseForElement(sodiumElement, policy);

  assert.equal(ambiguous.status, 'algorithm-contact-pair-response-body-specific-ambiguous');
  assert.equal(ambiguous.contactPressurePa, 0);
  assert.equal(ambiguous.ambiguousRowCount, 2);
  assert.deepEqual(ambiguous.ambiguousPairKeys, [
    'sodium:Na|left-water:h2o',
    'sodium:Na|right-water:h2o'
  ]);

  const binaryPolicy = normalizeAlgorithmContactPairResponsePolicy({
    algorithmMaterialContactRows: {
      ...rowsSource,
      rows: [leftWaterRow]
    }
  });
  const binaryResponse = algorithmContactPairResponseForElement(
    { ...sodiumElement, renderDomainId: undefined },
    binaryPolicy
  );
  assert.equal(binaryResponse.row?.pairKey, 'sodium:Na|left-water:h2o');
  assert.equal(
    binaryResponse.selectionStatus,
    'algorithm-contact-single-body-specific-material-phase-row-selected'
  );

  const genericRow = algorithmContactRowsFixture({ pairKey: 'generic:Na|h2o' }).rows[0];
  const genericFallbackPolicy = normalizeAlgorithmContactPairResponsePolicy({
    algorithmMaterialContactRows: {
      ...rowsSource,
      rows: [leftWaterRow, rightWaterRow, genericRow]
    }
  });
  const genericFallback = algorithmContactPairResponseForElement(sodiumElement, genericFallbackPolicy);
  assert.equal(genericFallback.row?.pairKey, 'generic:Na|h2o');
  assert.equal(
    genericFallback.selectionStatus,
    'algorithm-contact-generic-material-phase-fallback-selected'
  );
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
  const identityBuffer = device.createBuffer({
    label: 'test-sph-identity-source',
    size: 2 * Uint32Array.BYTES_PER_ELEMENT,
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
  const schroederSourceCandidateSpanBuffer = device.createBuffer({
    label: 'test-schroeder-source-candidate-spans',
    size: 2 * 4 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const interfaceSourceKeyBuffer = device.createBuffer({
    label: 'test-interface-source-key-rows',
    size: 2 * 4 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  fieldWithoutKinematics.interfaceSourceKeyBuffer = interfaceSourceKeyBuffer;
  fieldWithoutKinematics.interfaceSourceKeyStatus = 'interface-source-key-retained';
  fieldWithoutKinematics.interfaceSourceKeyRowCount = 2;
  fieldWithoutKinematics.interfaceSourceKeyReadyCount = 2;
  fieldWithoutKinematics.interfaceSourceKeyStrideFloats = 4;

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
    algorithmMaterialContactRows: algorithmContactRowsFixture({
      bodyIds: ['sodium-block', 'water-block'],
      domainIds: [11, 37]
    }),
    sphParticleUpload: {
      schema: 'peercompute.ulg.test-sph-particle-upload.v0',
      status: 'webgpu-uploaded',
      particleCount: 2,
      stateBuffer,
      thermoBuffer,
      identityBuffer,
      identityRequired: true,
      identitySchema: ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
      identityStrideBytes: Uint32Array.BYTES_PER_ELEMENT,
      identityBufferByteLength: 2 * Uint32Array.BYTES_PER_ELEMENT
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
      sourceCandidateSpanBuffer: schroederSourceCandidateSpanBuffer,
      sourceCandidateSpanCount: 2,
      sourceCandidateSpanStrideFloats: 4,
      candidateBudget: 4,
      lawQueueCount: 2,
      enabledLawMask: 6,
      enumerationMode: 'schroeder-active-node-tile-traversal-neighbor-enumeration',
      treeTraversalStatus: 'active-node-tile-traversal-before-sorted-schroeder-tree-index'
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
  assert.equal(result.pressureInterfaceForceSolver.interfaceContactKinematicsParticleIdentityReady, true);
  assert.equal(result.pressureInterfaceForceSolver.interfaceContactKinematicsParticleIdentityRequired, true);
  assert.equal(result.pressureInterfaceForceSolver.interfaceContactKinematicsParticleIdentityBufferConsumed, true);
  assert.equal(result.pressureInterfaceForceSolver.algorithmContactDomainPairRowCount, 1);
  assert.equal(result.pressureInterfaceForceSolver.algorithmContactDomainPairGpuSelectionReady, true);
  assert.equal(
    result.pressureInterfaceForceSolver.algorithmContactDomainPairGpuSelectionStatus,
    'algorithm-contact-exact-domain-pairs-encoded-in-gpu-rows'
  );
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
    'schroeder-pressure-interface-law-neighbor-candidates-consumed-authoritative'
  );
  assert.equal(result.pressureInterfaceForceSolver.schroederLawNeighborCandidateAvailable, true);
  assert.equal(result.pressureInterfaceForceSolver.schroederLawNeighborCandidateAuthoritative, true);
  assert.equal(result.pressureInterfaceForceSolver.schroederLawNeighborCandidateCount, 8);
  assert.equal(result.pressureInterfaceForceSolver.schroederLawNeighborCandidateBufferObserved, true);
  assert.equal(result.pressureInterfaceForceSolver.schroederLawNeighborCandidateBufferConsumed, true);
  assert.equal(result.pressureInterfaceForceSolver.schroederLawNeighborSourceSpanBufferObserved, true);
  assert.equal(result.pressureInterfaceForceSolver.schroederLawNeighborSourceSpanBufferConsumed, true);
  assert.equal(result.pressureInterfaceForceSolver.schroederLawNeighborSourceSpanCount, 2);
  assert.equal(
    result.pressureInterfaceForceSolver.schroederLawNeighborSourceSpanConsumerStatus,
    'schroeder-pressure-interface-source-spans-consumed'
  );
  assert.equal(
    result.pressureInterfaceForceSolver.pressureInterfaceSpatialIndexStatus,
    'pressure-interface-source-span-spatial-index-ready'
  );
  assert.equal(
    result.pressureInterfaceForceSolver.pressureInterfaceSpatialIndexMode,
    'source-particle-candidate-span-table'
  );
  assert.equal(result.pressureInterfaceForceSolver.interfaceSourceKeyStatus, 'interface-source-key-ready');
  assert.equal(
    result.pressureInterfaceForceSolver.interfaceSourceKeyConsumerStatus,
    'retained-interface-source-key-buffer-consumed'
  );
  assert.equal(result.pressureInterfaceForceSolver.interfaceSourceKeyReadyCount, 2);
  assert.equal(result.pressureInterfaceForceSolver.interfaceSourceKeyBufferConsumed, true);
  assert.equal(
    result.pressureInterfaceForceSolver.interfaceContactKinematicsDerivation,
    'schroeder-law-neighbor-candidates-authoritative-gpu-interface-element-candidate-contact-kinematics'
  );
  assert.equal(result.schroederLawQueueStatus, 'schroeder-pressure-interface-law-queue-ready');
  assert.equal(result.schroederLawQueueConsumerStatus, 'schroeder-pressure-interface-law-queue-consumed');
  assert.equal(result.schroederLawQueueBufferConsumed, true);
  assert.equal(
    result.schroederLawNeighborCandidateStatus,
    'schroeder-pressure-interface-law-neighbor-candidates-ready'
  );
  assert.equal(
    result.schroederLawNeighborCandidateConsumerStatus,
    'schroeder-pressure-interface-law-neighbor-candidates-consumed-authoritative'
  );
  assert.equal(result.schroederLawNeighborCandidateBufferObserved, true);
  assert.equal(result.schroederLawNeighborCandidateBufferConsumed, true);
  assert.equal(result.schroederLawNeighborSourceSpanBufferObserved, true);
  assert.equal(result.schroederLawNeighborSourceSpanBufferConsumed, true);
  assert.equal(result.pressureInterfaceSpatialIndexStatus, 'pressure-interface-source-span-spatial-index-ready');
  assert.equal(result.interfaceContactKinematicsGpuDerived, true);
  assert.equal(device.bindGroups.length, 3);
  assert.equal(device.bindGroups[0].entries.length, 5);
  assert.equal(device.bindGroups[0].entries[0].resource.buffer, stateBuffer);
  assert.equal(device.bindGroups[1].entries.length, 17);
  assert.equal(device.bindGroups[1].entries[1].resource.buffer, stateBuffer);
  assert.equal(device.bindGroups[1].entries[2].resource.buffer, thermoBuffer);
  assert.equal(device.bindGroups[1].entries[6].resource.buffer.label, 'ulg-sph-pressure-interface-particle-bin-counts');
  assert.equal(device.bindGroups[1].entries[7].resource.buffer.label, 'ulg-sph-pressure-interface-particle-bin-indices');
  assert.equal(device.bindGroups[1].entries[8].resource.buffer, schroederLawQueueBuffer);
  assert.equal(device.bindGroups[1].entries[9].resource.buffer.label, 'ulg-sph-pressure-interface-schroeder-law-queue-params');
  assert.equal(device.bindGroups[1].entries[10].resource.buffer, schroederLawNeighborCandidateBuffer);
  assert.equal(device.bindGroups[1].entries[11].resource.buffer.label, 'ulg-sph-pressure-interface-schroeder-law-neighbor-candidates-params');
  assert.equal(device.bindGroups[1].entries[12].resource.buffer, schroederSourceCandidateSpanBuffer);
  assert.equal(device.bindGroups[1].entries[13].resource.buffer.label, 'ulg-sph-pressure-interface-schroeder-source-spans-params');
  assert.equal(device.bindGroups[1].entries[14].resource.buffer, interfaceSourceKeyBuffer);
  assert.equal(device.bindGroups[1].entries[15].resource.buffer.label, 'ulg-sph-pressure-interface-source-key-params');
  assert.equal(device.bindGroups[1].entries[16].resource.buffer, identityBuffer);
  assert.equal(device.bindGroups[2].entries[5].resource.buffer.label, 'ulg-sph-pressure-interface-contact-kinematics-derived');
  const lawQueueParamsWrite = device.writes.find((entry) => entry.label === 'ulg-sph-pressure-interface-schroeder-law-queue-params');
  const lawQueueParamsView = new DataView(lawQueueParamsWrite.snapshot);
  assert.equal(lawQueueParamsView.getUint32(0, true), 1);
  assert.equal(lawQueueParamsView.getUint32(4, true), 2);
  assert.equal(lawQueueParamsView.getUint32(8, true), 32);
  assert.equal(lawQueueParamsView.getUint32(12, true), 6);
  const lawNeighborParamsWrite = device.writes.find((entry) => entry.label === 'ulg-sph-pressure-interface-schroeder-law-neighbor-candidates-params');
  const lawNeighborParamsView = new DataView(lawNeighborParamsWrite.snapshot);
  assert.equal(lawNeighborParamsView.getUint32(0, true), 1);
  assert.equal(lawNeighborParamsView.getUint32(4, true), 8);
  assert.equal(lawNeighborParamsView.getUint32(8, true), 16);
  assert.equal(lawNeighborParamsView.getUint32(12, true), 6);
  const sourceSpanParamsWrite = device.writes.find((entry) => entry.label === 'ulg-sph-pressure-interface-schroeder-source-spans-params');
  const sourceSpanParamsView = new DataView(sourceSpanParamsWrite.snapshot);
  assert.equal(sourceSpanParamsView.getUint32(0, true), 1);
  assert.equal(sourceSpanParamsView.getUint32(4, true), 2);
  assert.equal(sourceSpanParamsView.getUint32(8, true), 4);
  assert.equal(sourceSpanParamsView.getUint32(12, true), 0);
  const sourceKeyParamsWrite = device.writes.find((entry) => entry.label === 'ulg-sph-pressure-interface-source-key-params');
  const sourceKeyParamsView = new DataView(sourceKeyParamsWrite.snapshot);
  assert.equal(sourceKeyParamsView.getUint32(0, true), 1);
  assert.equal(sourceKeyParamsView.getUint32(4, true), 2);
  assert.equal(sourceKeyParamsView.getUint32(8, true), 4);
  assert.equal(sourceKeyParamsView.getUint32(12, true), 1);
  assert.deepEqual(device.dispatches, [1, 1, 1]);
  assert.equal(device.copies.length, 1);
  assert.equal(device.copies[0].source.label, 'ulg-sph-pressure-interface-particle-bin-metadata');
  assert.equal(device.copies[0].target.label, 'ulg-sph-pressure-interface-particle-bin-metadata-readback');
  assert.equal(device.copies[0].size, 16);
  assert.equal(device.submissions.length, 3);
});

test('pressure/interface canonical-ready source without a supplied generation stays on the legacy lookup path', async () => {
  const device = fakePressureDevice();
  const fieldWithoutKinematics = attachSpatialInterfaceProvenance(interfaceFieldFixture());
  for (const element of fieldWithoutKinematics.elements) {
    delete element.gapM;
    delete element.normalVelocityMPerS;
    delete element.representativeMassKg;
  }
  const stateBuffer = device.createBuffer({
    label: 'test-canonical-sph-state-source',
    size: 2 * 8 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const thermoBuffer = device.createBuffer({
    label: 'test-canonical-sph-thermo-source',
    size: 2 * 12 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const identityBuffer = device.createBuffer({
    label: 'test-canonical-sph-identity-source',
    size: 2 * Uint32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const schroederActiveNodeList = spatialActiveNodeSourceFixture(device);

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
    algorithmMaterialContactRows: algorithmContactRowsFixture({
      bodyIds: ['sodium-block', 'water-block'],
      domainIds: [11, 37]
    }),
    sphParticleUpload: {
      schema: 'peercompute.ulg.test-sph-particle-upload.v0',
      status: 'webgpu-uploaded',
      particleCount: 2,
      stateBuffer,
      thermoBuffer,
      identityBuffer,
      identityRequired: true,
      identitySchema: ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
      identityStrideBytes: Uint32Array.BYTES_PER_ELEMENT,
      identityBufferByteLength: 2 * Uint32Array.BYTES_PER_ELEMENT
    },
    schroederActiveNodeList,
    boxDimsM: [4, 4, 4],
    retainForceRowsBuffer: true,
    readbackMode: 'no-full-readback'
  });

  const solver = result.pressureInterfaceForceSolver;
  assert.equal(result.interfaceContactKinematicsGpuDerived, true);
  assert.equal(
    result.interfaceContactKinematicsDerivationStatus,
    'interface-contact-kinematics-gpu-derivation-submitted'
  );
  assert.equal(solver.schroederSpatialExactNearSourceReady, true);
  assert.equal(solver.schroederSpatialExactNearInterfaceProvenanceReady, true);
  assert.equal(solver.schroederSpatialExactNearSelected, false);
  assert.equal(
    solver.schroederSpatialExactNearSelectionStatus,
    'schroeder-spatial-exact-near-interface-provenance-ready'
  );
  assert.equal(solver.schroederSpatialExactNearDirectoryBuildCount, 0);
  assert.equal(solver.schroederSpatialExactNearLookupMode, null);
  assert.equal(solver.schroederSpatialExactNearCandidateBudget, null);
  assert.equal(solver.schroederSpatialExactNearPrivateParticleBinBuildSuppressed, false);
  assert.equal(solver.schroederSpatialExactNearPrivateParticleBinBuildCount, 1);
  assert.equal(solver.schroederSpatialExactNearFixedCandidateBuildCount, 0);
  assert.equal(solver.schroederSpatialExactNearExhaustiveParticleScanCount, 0);
  assert.equal(solver.schroederSpatialExactNearGpuHeaderAdmission, null);
  assert.equal(
    solver.interfaceContactKinematicsParticleBinGridStatus,
    'interface-contact-particle-bin-grid-submitted'
  );
  assert.equal(solver.interfaceContactKinematicsParticleBinGridEnabled, true);
  assert.ok(solver.interfaceContactKinematicsParticleBinGridCellCount > 0);
  assert.ok(solver.interfaceContactKinematicsParticleBinGridBinCapacity > 0);
  assert.ok(solver.interfaceContactKinematicsParticleBinGridIndexBufferByteLength > 0);

  const labels = device.createdBuffers.map((buffer) => buffer.label);
  assert.equal(labels.includes('ulg-sph-pressure-interface-particle-bin-counts'), true);
  assert.equal(labels.includes('ulg-sph-pressure-interface-particle-bin-indices'), true);
  assert.equal(labels.includes('ulg-sph-pressure-interface-particle-bin-metadata'), true);
  assert.equal(labels.includes('ulg-sph-pressure-interface-particle-bin-params'), true);
  assert.equal(labels.some((label) => /pressure-spatial-epoch/.test(label)), false);
  assert.equal(device.shaderModules.some(
    (module) => module.code === sphPressureInterfaceSpatialExactNearContactKinematicsWgsl
  ), false);
  assert.ok(device.shaderModules.some(
    (module) => module.code === sphPressureInterfaceContactKinematicsWgsl
  ));
  const legacyBindGroup = device.bindGroups.find((group) => (
    group.entries.length === 17
    && group.entries[0]?.resource?.buffer?.label
      === 'ulg-sph-pressure-interface-elements-in'
  ));
  assert.ok(legacyBindGroup);
  assert.equal(legacyBindGroup.entries[1].resource.buffer, stateBuffer);
  assert.equal(legacyBindGroup.entries[2].resource.buffer, thermoBuffer);
  assert.equal(legacyBindGroup.entries[16].resource.buffer, identityBuffer);
  assert.equal(device.submissions.length, 3);
});

test('pressure/interface borrows one caller-owned spatial generation without rebuilding or releasing it', async () => {
  const device = fakePressureDevice();
  const args = canonicalPressureRunFixture(device);
  for (const element of args.materialInterfaceField.elements) {
    Object.assign(element, {
      gapM: 0.01,
      normalVelocityMPerS: -10,
      representativeMassKg: 10
    });
  }
  const shared = sharedSpatialGenerationFixture(
    device,
    args.schroederActiveNodeList
  );
  args.schroederSpatialEpochGeneration = shared.generation;
  args.sharedSpatialFenceAuthority = 'generation-owner';

  const result = await runSphPressureInterfaceForceRowsWebGpu(args);
  const solver = result.pressureInterfaceForceSolver;

  assert.equal(solver.schroederSpatialExactNearGenerationSupplied, true);
  assert.equal(
    solver.schroederSpatialExactNearHostAdmissionStatus,
    'schroeder-spatial-exact-near-shared-generation-selected'
  );
  assert.equal(solver.schroederSpatialExactNearSelected, true);
  assert.equal(solver.schroederSpatialExactNearBorrowedGeneration, true);
  assert.equal(
    solver.schroederSpatialExactNearDirectoryOwnership,
    'borrowed-caller-owned-canonical-generation'
  );
  assert.equal(solver.schroederSpatialExactNearDirectoryBuildCount, 0);
  assert.equal(
    solver.schroederSpatialExactNearSharedGenerationDirectoryBuildCount,
    1
  );
  assert.equal(solver.schroederSpatialExactNearPrivateParticleBinBuildCount, 0);
  assert.equal(solver.schroederSpatialExactNearGpuAdmissionObserved, false);
  assert.equal(
    solver.schroederSpatialExactNearGpuAdmissionStatus,
    'shader-validates-at-dispatch-no-host-readback'
  );
  assert.equal(solver.schroederSpatialExactNearGpuFallbackObserved, null);
  assert.equal(
    solver.algorithmContactPairResponseStatus,
    'algorithm-contact-pair-response-gpu-summary-unavailable-no-readback'
  );
  assert.equal(solver.algorithmContactSummarySource, 'retained-gpu-force-rows-no-readback');
  assert.equal(solver.algorithmContactSummaryObserved, false);
  assert.equal(solver.algorithmContactForceRowCount, null);
  assert.equal(solver.interfaceContactKinematicsReadyCount, null);
  assert.equal(solver.interfaceContactKinematicsDomainPairReadyCount, null);
  assert.equal(result.interfaceContactKinematicsReadyCount, null);
  assert.equal(result.interfaceContactKinematicsDomainPairReadyCount, null);
  assert.equal(solver.forceAggregateSummaryObserved, false);
  assert.equal(solver.totalAbsMaterialForceN, null);
  assert.equal(solver.conservationStatus, 'not-observed-gpu-force-rows-not-read-back');
  assert.equal(
    solver.forceResolution,
    'uniform-interface-traction+algorithm-contact-component-unresolved'
  );
  assert.equal(
    solver.schroederSpatialExactNearArenaReleaseStatus,
    'borrowed-generation-release-owned-by-caller'
  );
  const labels = device.createdBuffers.map((buffer) => buffer.label);
  assert.equal(labels.some((label) => /pressure-spatial-epoch/.test(label)), false);
  assert.equal(labels.includes('ulg-sph-pressure-interface-particle-bin-counts'), false);
  const exactBindGroup = device.bindGroups.find((group) => (
    group.entries.length === 8
    && group.entries[6]?.resource?.buffer === shared.execution.directoryBuffer
  ));
  assert.ok(exactBindGroup);
  assert.equal(device.submissions.length, 2);
  assert.equal(shared.releaseCalls.length, 0);
  assert.equal(shared.generation.releaseScheduled, false);
  assert.equal(shared.execution.released, false);
  assert.equal(result.pressureInterfaceOwnerScopeTemporaryCleanupDelegated, true);
  assert.equal(
    result.pressureInterfaceOwnerScopeTemporaryCleanupStatus,
    'pending-generation-owner-final-consumer-fence'
  );
  const temporaryInputBuffer = device.createdBuffers.find(
    (buffer) => buffer.label === 'ulg-sph-pressure-interface-elements-in'
  );
  assert.equal(temporaryInputBuffer.destroyed, false);
  assert.equal(result.destroyOwnerScopeTemporaryBuffers(), true);
  assert.equal(temporaryInputBuffer.destroyed, true);
  assert.equal(result.destroyOwnerScopeTemporaryBuffers(), false);
});

test('pressure/interface admits a caller-owned level-assignment spatial generation', async () => {
  const device = fakePressureDevice();
  const args = canonicalPressureRunFixture(device);
  const shared = sharedSpatialGenerationFixture(
    device,
    args.schroederActiveNodeList,
    {
      sourceRowLayoutId:
        SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0
    }
  );
  args.schroederSpatialEpochGeneration = shared.generation;
  args.sharedSpatialFenceAuthority = 'generation-owner';

  const result = await runSphPressureInterfaceForceRowsWebGpu(args);
  const solver = result.pressureInterfaceForceSolver;

  assert.equal(shared.source.sourceRowLayoutId,
    SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0);
  assert.equal(shared.execution.sourceRowLayoutId,
    SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0);
  assert.equal(
    shared.execution.sourceFamily,
    'schroeder-level-assignment-particles'
  );
  assert.equal(
    solver.schroederSpatialExactNearHostAdmissionStatus,
    'schroeder-spatial-exact-near-shared-generation-selected'
  );
  assert.equal(solver.schroederSpatialExactNearSelected, true);
  assert.equal(solver.schroederSpatialExactNearDirectoryBuildCount, 0);
  assert.equal(solver.schroederSpatialExactNearPrivateParticleBinBuildCount, 0);
  assert.equal(
    solver.interfaceContactKinematicsDerivationStatus,
    'interface-contact-kinematics-spatial-exact-near-submitted'
  );
  assert.equal(shared.releaseCalls.length, 0);
});

test('pressure/interface full-readback shared generation summarizes authoritative GPU force rows', async () => {
  const device = fakePressureDevice();
  const authoritativeForceRows = new Float32Array([
    0, 1, 2, 0,
    0.5, 1, 1, 1,
    -120000, 0, 0, 120000,
    0, 0, 120000, 1,
    0, 1, 2, 0,
    1.5, 1, 1, 1,
    245000, 0, 0, -245000,
    0, 0, 245000, 1
  ]);
  const createBuffer = device.createBuffer.bind(device);
  device.createBuffer = (descriptor) => {
    const buffer = createBuffer(descriptor);
    if (descriptor.label === 'ulg-sph-pressure-interface-force-rows-readback') {
      buffer.getMappedRange = () => authoritativeForceRows.buffer.slice(0);
    }
    return buffer;
  };
  const args = canonicalPressureRunFixture(device);
  for (const element of args.materialInterfaceField.elements) {
    Object.assign(element, {
      gapM: 0.01,
      normalVelocityMPerS: -10,
      representativeMassKg: 10
    });
  }
  const shared = sharedSpatialGenerationFixture(
    device,
    args.schroederActiveNodeList
  );
  args.schroederSpatialEpochGeneration = shared.generation;
  args.readbackMode = 'full-parity-readback';
  args.materialInterfaceField.totalSurfaceAreaM2 = 999;

  const result = await runSphPressureInterfaceForceRowsWebGpu(args);
  const solver = result.pressureInterfaceForceSolver;

  assert.equal(result.fullReadbackPerformed, true);
  assert.deepEqual([...result.forceRowValues], [...authoritativeForceRows]);
  assert.equal(
    solver.algorithmContactSummarySource,
    'authoritative-gpu-force-row-full-readback-total-pressure-only-contact-component-unavailable'
  );
  assert.equal(solver.algorithmContactSummaryObserved, false);
  assert.equal(
    solver.algorithmContactPairResponseStatus,
    'algorithm-contact-pair-response-component-unavailable-total-pressure-only-force-row-abi'
  );
  assert.equal(solver.algorithmContactForceRowCount, null);
  assert.equal(solver.interfaceContactKinematicsReadyCount, null);
  assert.equal(solver.interfaceContactKinematicsDomainPairReadyCount, null);
  assert.equal(result.interfaceContactKinematicsReadyCount, null);
  assert.equal(result.interfaceContactKinematicsDomainPairReadyCount, null);
  assert.equal(solver.algorithmContactPressureRangePa, null);
  assert.equal(solver.gasInterfacePressureRangePa, null);
  assert.deepEqual(solver.totalInterfacePressureRangePa, [120000, 245000]);
  assert.equal(
    solver.forceResolution,
    'uniform-interface-traction+algorithm-contact-component-unresolved'
  );
  assert.equal(solver.forceRows[0].pressurePa, 120000);
  assert.equal(solver.forceRows[0].algorithmContactPressurePa, null);
  assert.equal(solver.forceRows[1].pressurePa, 245000);
  assert.equal(solver.forceRows[1].algorithmContactPressurePa, null);
  assert.equal(solver.algorithmContactPairKeys.length, 0);
  assert.equal(solver.totalAbsMaterialForceN, 365000);
  assert.equal(solver.totalInterfaceAreaM2, 2);
  assert.equal(shared.releaseCalls.length, 0);
});

test('pressure/interface full-readback shared generation does not invent contact from retained gas rows', async () => {
  const device = fakePressureDevice();
  const authoritativeForceRows = new Float32Array([
    0, 1, 2, 0,
    0.5, 1, 1, 1,
    -300000, 0, 0, 300000,
    0, 0, 300000, 1,
    0, 1, 2, 0,
    1.5, 1, 1, 1,
    400000, 0, 0, -400000,
    0, 0, 400000, 1
  ]);
  const createBuffer = device.createBuffer.bind(device);
  device.createBuffer = (descriptor) => {
    const buffer = createBuffer(descriptor);
    if (descriptor.label === 'ulg-sph-pressure-interface-force-rows-readback') {
      buffer.getMappedRange = () => authoritativeForceRows.buffer.slice(0);
    }
    return buffer;
  };
  const args = canonicalPressureRunFixture(device);
  const retainedGasPressureCellsBuffer = device.createBuffer({
    label: 'test-retained-device-only-gas-pressure-rows',
    size: SPH_GAS_PRESSURE_CELL_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const shared = sharedSpatialGenerationFixture(
    device,
    args.schroederActiveNodeList
  );
  args.schroederSpatialEpochGeneration = shared.generation;
  args.readbackMode = 'full-parity-readback';
  args.retainedGasPressureCellsBuffer = retainedGasPressureCellsBuffer;
  args.retainedGasPressureCellRowCount = 1;
  args.retainedGasPressureCellRowStrideFloats = SPH_GAS_PRESSURE_CELL_FLOATS;
  args.retainedGasPressureCellRowByteLength =
    SPH_GAS_PRESSURE_CELL_FLOATS * Float32Array.BYTES_PER_ELEMENT;

  const result = await runSphPressureInterfaceForceRowsWebGpu(args);
  const solver = result.pressureInterfaceForceSolver;

  assert.equal(result.fullReadbackPerformed, true);
  assert.equal(result.gasPressureCellRowsBufferBorrowed, true);
  assert.deepEqual([...result.forceRowValues], [...authoritativeForceRows]);
  assert.equal(
    solver.algorithmContactSummarySource,
    'authoritative-gpu-force-row-full-readback-total-pressure-only-contact-component-unavailable'
  );
  assert.equal(solver.algorithmContactSummaryObserved, false);
  assert.equal(
    solver.algorithmContactPairResponseStatus,
    'algorithm-contact-pair-response-component-unavailable-total-pressure-only-force-row-abi'
  );
  assert.equal(solver.algorithmContactForceRowCount, null);
  assert.equal(solver.algorithmContactPressureRangePa, null);
  assert.equal(solver.forceRows[0].pressurePa, 300000);
  assert.equal(solver.forceRows[0].gasInterfacePressurePa, null);
  assert.equal(solver.forceRows[0].algorithmContactPressurePa, null);
  assert.equal(solver.forceRows[1].pressurePa, 400000);
  assert.equal(solver.totalAbsMaterialForceN, 700000);
  assert.equal(solver.gasInterfacePressureRangePa, null);
  assert.deepEqual(solver.totalInterfacePressureRangePa, [300000, 400000]);
  assert.equal(
    solver.forceResolution,
    'local-gradient-interface-traction+algorithm-contact-component-unresolved'
  );
  assert.equal(shared.releaseCalls.length, 0);
});

test('pressure/interface full-readback fail-closed shared generation preserves zero-contact provenance', async () => {
  const device = fakePressureDevice();
  const authoritativeForceRows = new Float32Array([
    0, 1, 2, 0,
    0.5, 1, 1, 1,
    -120000, 0, 0, 120000,
    0, 0, 120000, 1,
    0, 1, 2, 0,
    1.5, 1, 1, 1,
    120000, 0, 0, -120000,
    0, 0, 120000, 1
  ]);
  const createBuffer = device.createBuffer.bind(device);
  device.createBuffer = (descriptor) => {
    const buffer = createBuffer(descriptor);
    if (descriptor.label === 'ulg-sph-pressure-interface-force-rows-readback') {
      buffer.getMappedRange = () => authoritativeForceRows.buffer.slice(0);
    }
    return buffer;
  };
  const args = canonicalPressureRunFixture(device);
  for (const element of args.materialInterfaceField.elements) {
    Object.assign(element, {
      gapM: 0.01,
      normalVelocityMPerS: -10,
      representativeMassKg: 10
    });
  }
  const shared = sharedSpatialGenerationFixture(
    device,
    args.schroederActiveNodeList,
    { generationOverrides: { releaseScheduled: true } }
  );
  args.schroederSpatialEpochGeneration = shared.generation;
  args.readbackMode = 'full-parity-readback';

  const result = await runSphPressureInterfaceForceRowsWebGpu(args);
  const solver = result.pressureInterfaceForceSolver;

  assert.equal(
    solver.algorithmContactSummarySource,
    'authoritative-gpu-force-row-full-readback-shared-exact-near-fail-closed-zero-contact'
  );
  assert.equal(solver.algorithmContactSummaryObserved, true);
  assert.equal(
    solver.algorithmContactPairResponseStatus,
    'algorithm-contact-pair-response-fail-closed-zero'
  );
  assert.equal(solver.algorithmContactForceRowCount, 0);
  assert.equal(solver.interfaceContactKinematicsReadyCount, 0);
  assert.equal(solver.interfaceContactKinematicsDomainPairReadyCount, 0);
  assert.equal(result.interfaceContactKinematicsReadyCount, 0);
  assert.equal(result.interfaceContactKinematicsDomainPairReadyCount, 0);
  assert.deepEqual(solver.gasInterfacePressureRangePa, [120000, 120000]);
  assert.deepEqual(solver.totalInterfacePressureRangePa, [120000, 120000]);
  assert.equal(solver.forceRows[0].gasInterfacePressurePa, 120000);
  assert.equal(solver.forceRows[0].algorithmContactPressurePa, 0);
  assert.equal(solver.forceRows[1].algorithmContactPressurePa, 0);
  assert.equal(solver.forceResolution, 'uniform-interface-traction');
  assert.equal(solver.forceAggregateSummaryObserved, true);
  assert.equal(shared.releaseCalls.length, 0);
});

test('pressure/interface full-readback shared generation rejects malformed authoritative GPU rows', async () => {
  const cases = [
    ['non-finite force', /contains non-finite values/, (rows) => { rows[8] = Number.NaN; }],
    ['blocked status', /is not exactly ready/, (rows) => { rows[15] = 0; }],
    ['torn identity', /identity\/geometry copy is torn/, (rows) => { rows[0] = 99; }]
  ];
  for (const [name, expectedError, mutate] of cases) {
    const device = fakePressureDevice();
    const authoritativeForceRows = new Float32Array([
      0, 1, 2, 0,
      0.5, 1, 1, 1,
      -120000, 0, 0, 120000,
      0, 0, 120000, 1,
      0, 1, 2, 0,
      1.5, 1, 1, 1,
      120000, 0, 0, -120000,
      0, 0, 120000, 1
    ]);
    mutate(authoritativeForceRows);
    const createBuffer = device.createBuffer.bind(device);
    device.createBuffer = (descriptor) => {
      const buffer = createBuffer(descriptor);
      if (descriptor.label === 'ulg-sph-pressure-interface-force-rows-readback') {
        buffer.getMappedRange = () => authoritativeForceRows.buffer.slice(0);
      }
      return buffer;
    };
    const args = canonicalPressureRunFixture(device);
    const shared = sharedSpatialGenerationFixture(
      device,
      args.schroederActiveNodeList
    );
    args.schroederSpatialEpochGeneration = shared.generation;
    args.readbackMode = 'full-parity-readback';
    await assert.rejects(
      runSphPressureInterfaceForceRowsWebGpu(args),
      expectedError,
      name
    );
    assert.equal(shared.releaseCalls.length, 0, name);
  }
});

test('pressure/interface borrowed generation admission rejects torn identity families', () => {
  const cases = [
    {
      name: 'generation state',
      expected: 'schroeder-spatial-exact-near-shared-generation-rejected-state',
      mutate({ generation }) {
        generation.status = 'schroeder-spatial-epoch-generation-encoded-only';
      }
    },
    {
      name: 'released execution',
      expected: 'schroeder-spatial-exact-near-shared-generation-rejected-execution',
      mutate({ execution }) {
        execution.released = true;
      }
    },
    {
      name: 'missing owner runtime',
      expected: 'schroeder-spatial-exact-near-shared-generation-rejected-owner-runtime',
      mutate({ generation }) {
        generation.runtime = null;
      }
    },
    {
      name: 'wrong-device owner runtime',
      expected: 'schroeder-spatial-exact-near-shared-generation-rejected-owner-runtime',
      mutate({ generation }) {
        generation.runtime = {
          ...generation.runtime,
          deviceId: 'ulg-webgpu-device:torn-owner'
        };
      }
    },
    {
      name: 'shallow-cloned same-device owner runtime',
      expected: 'schroeder-spatial-exact-near-shared-generation-rejected-owner-runtime',
      mutate({ generation }) {
        generation.runtime = { ...generation.runtime };
      }
    },
    {
      name: 'runtime does not own execution',
      expected: 'schroeder-spatial-exact-near-shared-generation-rejected-owner-runtime',
      mutate({ generation }) {
        generation.runtime = {
          ...generation.runtime,
          ownsExecution() { return false; }
        };
      }
    },
    {
      name: 'generic source schema',
      expected: 'schroeder-spatial-exact-near-shared-generation-rejected-source',
      mutate({ source }) {
        source.schema = 'peercompute.ulg.schroeder-spatial-directory-source.invalid';
      }
    },
    {
      name: 'active-node identity',
      expected: 'schroeder-spatial-exact-near-shared-generation-rejected-source',
      mutate({ source, device }) {
        const tornBuffer = device.createBuffer({
          label: 'test-torn-active-node-source',
          size: 2 * 16 * Float32Array.BYTES_PER_ELEMENT,
          usage: 128
        });
        source.sourceBuffer = tornBuffer;
        source.activeNodeBuffer = tornBuffer;
      }
    },
    {
      name: 'torn execution build source hidden by coherent mutable views',
      expected:
        'schroeder-spatial-exact-near-shared-generation-rejected-execution-source',
      mutate({ source, exactNearQueryProfile, spatialSource, device }) {
        const tornBuffer = tagWebGpuBufferDevice(device.createBuffer({
          label: 'test-torn-coherent-active-node-source',
          size: 2 * 16 * Float32Array.BYTES_PER_ELEMENT,
          usage: 128
        }), device);
        source.sourceBuffer = tornBuffer;
        source.activeNodeBuffer = tornBuffer;
        exactNearQueryProfile.sourceBuffer = tornBuffer;
        exactNearQueryProfile.activeNodeBuffer = tornBuffer;
        spatialSource.sourceBuffer = tornBuffer;
        spatialSource.activeNodeBuffer = tornBuffer;
      }
    },
    {
      name: 'query profile status',
      expected: 'schroeder-spatial-exact-near-shared-generation-rejected-query-profile',
      mutate({ exactNearQueryProfile }) {
        exactNearQueryProfile.status = 'schroeder-spatial-exact-near-query-profile-stale';
      }
    },
    {
      name: 'query epoch',
      expected: 'schroeder-spatial-exact-near-shared-generation-rejected-supportEpoch',
      mutate({ exactNearQueryProfile }) {
        exactNearQueryProfile.supportEpoch += 1;
      }
    },
    {
      name: 'source family identity',
      expected: 'schroeder-spatial-exact-near-shared-generation-rejected-identity',
      mutate({ execution }) {
        execution.sourceFamily = 'pressure-private-spatial-source';
      }
    },
    {
      name: 'device identity',
      expected: 'schroeder-spatial-exact-near-shared-generation-rejected-identity',
      mutate({ execution }) {
        execution.deviceId = 'ulg-webgpu-device:torn';
      }
    },
    ...[
      'generationId',
      'deviceOrdinal',
      'laneOrdinal',
      'leaseToken',
      'sourceFamilyId',
      'buildOrdinal',
      'sortUniqueOrdinal',
      'arenaIndex',
      'arenaGeneration'
    ].map((field) => ({
      name: `${field} exceeds u32`,
      expected: 'schroeder-spatial-exact-near-shared-generation-rejected-identity',
      mutate({ execution }) {
        execution[field] = 0x1_0000_0000;
      }
    })),
    {
      name: 'layout offsets',
      expected: 'schroeder-spatial-exact-near-shared-generation-rejected-layout',
      mutate({ execution }) {
        execution.layout = {
          ...execution.layout,
          cellMembersOffsetWords: execution.layout.cellMembersOffsetWords + 1
        };
      }
    },
    {
      name: 'cross-device directory',
      expected: 'schroeder-spatial-exact-near-shared-generation-rejected-device',
      mutate({ execution }) {
        const otherDevice = fakePressureDevice();
        execution.directoryBuffer = tagWebGpuBufferDevice(otherDevice.createBuffer({
          label: 'test-cross-device-spatial-directory',
          size: execution.layout.byteLength,
          usage: 128
        }), otherDevice);
      }
    }
  ];

  for (const fixtureCase of cases) {
    const device = fakePressureDevice();
    const args = canonicalPressureRunFixture(device);
    const shared = sharedSpatialGenerationFixture(
      device,
      args.schroederActiveNodeList
    );
    const spatialSource = resolveSchroederPressureInterfaceSpatialEpochSource(
      args.schroederActiveNodeList,
      { device, particleCount: args.sphParticleUpload.particleCount }
    );
    const particleSource = {
      ...args.sphParticleUpload,
      ready: true,
      identityReady: true
    };
    const spatialProvenance = resolveSchroederPressureInterfaceSpatialEpochProvenance({
      spatialSource,
      materialInterfaceField: args.materialInterfaceField,
      particleSource,
      particleCount: particleSource.particleCount,
      requireCompleteBufferFamily: true
    });
    assert.equal(spatialProvenance.ready, true, fixtureCase.name);
    fixtureCase.mutate({
      ...shared,
      device,
      spatialSource,
      spatialProvenance
    });
    const admission = resolveSchroederPressureInterfaceSpatialEpochGeneration(
      shared.generation,
      {
        device,
        spatialSource,
        spatialProvenance,
        particleSource,
        particleCount: particleSource.particleCount
      }
    );
    assert.equal(admission.selected, false, fixtureCase.name);
    assert.equal(admission.status, fixtureCase.expected, fixtureCase.name);
    assert.equal(admission.directoryBuildCount, 0, fixtureCase.name);
    assert.equal(admission.releaseScheduled, false, fixtureCase.name);
  }
});

test('pressure/interface borrowed generation rejects coercible particle and identity metadata', async () => {
  const cases = [
    ['particleCount', '2'],
    ['particleCount', 2.5],
    ['identityStrideBytes', '4'],
    ['identityStrideBytes', 4.25],
    ['identityBufferByteLength', '8'],
    ['identityBufferByteLength', 8.25]
  ];
  for (const [field, value] of cases) {
    const device = fakePressureDevice();
    const args = canonicalPressureRunFixture(device);
    const shared = sharedSpatialGenerationFixture(
      device,
      args.schroederActiveNodeList
    );
    args.schroederSpatialEpochGeneration = shared.generation;
    args.sphParticleUpload[field] = value;

    const result = await runSphPressureInterfaceForceRowsWebGpu(args);
    const solver = result.pressureInterfaceForceSolver;
    assert.equal(solver.schroederSpatialExactNearSelected, false, field);
    assert.equal(
      solver.interfaceContactKinematicsDerivationStatus,
      'interface-contact-kinematics-spatial-exact-near-fail-closed',
      field
    );
    assert.equal(solver.schroederSpatialExactNearDirectoryBuildCount, 0, field);
    assert.equal(solver.schroederSpatialExactNearPrivateParticleBinBuildCount, 0, field);
    const labels = device.createdBuffers.map((buffer) => buffer.label);
    assert.ok(labels.includes(
      'ulg-sph-pressure-interface-spatial-exact-near-fail-closed-zero-rows'
    ), field);
    assert.equal(labels.includes('ulg-sph-pressure-interface-particle-bin-counts'), false, field);
    assert.equal(labels.includes('ulg-sph-pressure-interface-contact-kinematics-rows'), false, field);
    assert.equal(device.shaderModules.some(
      (module) => module.code === sphPressureInterfaceSpatialExactNearContactKinematicsWgsl
    ), false, field);
    assert.equal(device.shaderModules.some(
      (module) => module.code === sphPressureInterfaceContactKinematicsWgsl
    ), false, field);
  }
});

test('pressure/interface selected shared generation ignores ready legacy rows when exact-near prerequisites are unavailable', async () => {
  const device = fakePressureDevice();
  const args = canonicalPressureRunFixture(device);
  for (const element of args.materialInterfaceField.elements) {
    Object.assign(element, {
      gapM: 0.01,
      normalVelocityMPerS: -10,
      representativeMassKg: 10
    });
  }
  args.sphParticleUpload.identityBuffer = null;
  args.sphParticleUpload.identityRequired = false;
  delete args.sphParticleUpload.identitySchema;
  delete args.sphParticleUpload.identityStrideBytes;
  delete args.sphParticleUpload.identityBufferByteLength;
  args.materialInterfaceField.spatialEpochSourceIdentityBuffer = null;
  const shared = sharedSpatialGenerationFixture(
    device,
    args.schroederActiveNodeList
  );
  args.schroederSpatialEpochGeneration = shared.generation;

  const result = await runSphPressureInterfaceForceRowsWebGpu(args);
  const solver = result.pressureInterfaceForceSolver;
  assert.equal(solver.schroederSpatialExactNearSelected, true);
  assert.equal(
    solver.schroederSpatialExactNearHostAdmissionStatus,
    'schroeder-spatial-exact-near-shared-generation-selected'
  );
  assert.equal(solver.interfaceContactKinematicsGpuDerivationEligible, false);
  assert.equal(
    solver.interfaceContactKinematicsDerivationStatus,
    'interface-contact-kinematics-spatial-exact-near-fail-closed'
  );
  assert.equal(solver.schroederSpatialExactNearDirectoryBuildCount, 0);
  assert.equal(solver.schroederSpatialExactNearPrivateParticleBinBuildCount, 0);
  assert.equal(solver.interfaceContactKinematicsParticleBinGridEnabled, false);
  assert.equal(
    solver.algorithmContactPairResponseStatus,
    'algorithm-contact-pair-response-fail-closed-zero'
  );
  assert.equal(
    solver.algorithmContactSummarySource,
    'shared-spatial-exact-near-fail-closed-zero-kinematics-no-force-readback'
  );
  assert.equal(solver.algorithmContactSummaryObserved, true);
  assert.equal(solver.algorithmContactForceRowCount, 0);
  assert.equal(solver.forceResolution, 'uniform-interface-traction');
  const zeroWrite = device.writes.find((entry) => (
    entry.label
      === 'ulg-sph-pressure-interface-spatial-exact-near-fail-closed-zero-rows'
  ));
  assert.ok(zeroWrite);
  assert.ok([...new Float32Array(zeroWrite.snapshot)].every((value) => value === 0));
  const labels = device.createdBuffers.map((buffer) => buffer.label);
  assert.equal(labels.includes('ulg-sph-pressure-interface-contact-kinematics-rows'), false);
  assert.equal(labels.includes('ulg-sph-pressure-interface-particle-bin-counts'), false);
  assert.equal(device.shaderModules.some(
    (module) => module.code === sphPressureInterfaceSpatialExactNearContactKinematicsWgsl
  ), false);
  assert.equal(device.shaderModules.some(
    (module) => module.code === sphPressureInterfaceContactKinematicsWgsl
  ), false);
});

test('pressure/interface fails closed without private lookup after a supplied generation is rejected', async () => {
  const device = fakePressureDevice();
  const args = canonicalPressureRunFixture(device);
  for (const element of args.materialInterfaceField.elements) {
    Object.assign(element, {
      gapM: 0.01,
      normalVelocityMPerS: -10,
      representativeMassKg: 10
    });
  }
  const shared = sharedSpatialGenerationFixture(
    device,
    args.schroederActiveNodeList,
    { generationOverrides: { releaseScheduled: true } }
  );
  args.schroederSpatialEpochGeneration = shared.generation;

  const result = await runSphPressureInterfaceForceRowsWebGpu(args);
  const solver = result.pressureInterfaceForceSolver;

  assert.equal(solver.schroederSpatialExactNearSelected, false);
  assert.equal(
    solver.schroederSpatialExactNearHostAdmissionStatus,
    'schroeder-spatial-exact-near-shared-generation-rejected-release-scheduled'
  );
  assert.equal(
    solver.interfaceContactKinematicsDerivationStatus,
    'interface-contact-kinematics-spatial-exact-near-fail-closed'
  );
  assert.equal(solver.schroederSpatialExactNearDirectoryBuildCount, 0);
  assert.equal(solver.schroederSpatialExactNearPrivateParticleBinBuildCount, 0);
  assert.equal(solver.interfaceContactKinematicsParticleBinGridEnabled, false);
  assert.equal(
    solver.algorithmContactPairResponseStatus,
    'algorithm-contact-pair-response-fail-closed-zero'
  );
  assert.equal(
    solver.algorithmContactSummarySource,
    'shared-spatial-exact-near-fail-closed-zero-kinematics-no-force-readback'
  );
  assert.equal(solver.algorithmContactSummaryObserved, true);
  assert.equal(solver.algorithmContactForceRowCount, 0);
  assert.equal(solver.forceResolution, 'uniform-interface-traction');
  assert.equal(
    solver.pressureInterfaceSpatialIndexStatus,
    'pressure-interface-shared-spatial-generation-rejected-fail-closed'
  );
  const labels = device.createdBuffers.map((buffer) => buffer.label);
  assert.ok(labels.includes(
    'ulg-sph-pressure-interface-spatial-exact-near-fail-closed-zero-rows'
  ));
  assert.equal(
    labels.includes('ulg-sph-pressure-interface-contact-kinematics-rows'),
    false
  );
  assert.equal(labels.some((label) => /pressure-spatial-epoch/.test(label)), false);
  assert.equal(labels.includes('ulg-sph-pressure-interface-particle-bin-counts'), false);
  assert.equal(device.shaderModules.some(
    (module) => module.code === sphPressureInterfaceSpatialExactNearContactKinematicsWgsl
  ), false);
  assert.equal(device.shaderModules.some(
    (module) => module.code === sphPressureInterfaceContactKinematicsWgsl
  ), false);
  assert.equal(device.submissions.length, 1);
  assert.equal(shared.releaseCalls.length, 0);
});

test('pressure/interface uses legacy bins only before a stale canonical epoch is selected', async () => {
  const device = fakePressureDevice();
  const result = await runSphPressureInterfaceForceRowsWebGpu(
    canonicalPressureRunFixture(device, {
      sourcePositionEpoch: 3,
      interfacePositionEpoch: 2
    })
  );
  const solver = result.pressureInterfaceForceSolver;
  assert.equal(solver.schroederSpatialExactNearSourceReady, true);
  assert.equal(solver.schroederSpatialExactNearInterfaceProvenanceReady, false);
  assert.equal(
    solver.schroederSpatialExactNearInterfaceProvenanceStatus,
    'schroeder-spatial-exact-near-interface-provenance-rejected'
  );
  assert.equal(solver.schroederSpatialExactNearSelected, false);
  assert.equal(solver.schroederSpatialExactNearDirectoryBuildCount, 0);
  assert.equal(solver.schroederSpatialExactNearPrivateParticleBinBuildSuppressed, false);
  assert.equal(solver.schroederSpatialExactNearPrivateParticleBinBuildCount, 1);
  assert.equal(solver.interfaceContactKinematicsParticleBinGridEnabled, true);
  const labels = device.createdBuffers.map((buffer) => buffer.label);
  assert.ok(labels.includes('ulg-sph-pressure-interface-particle-bin-counts'));
  assert.ok(labels.includes('ulg-sph-pressure-interface-particle-bin-indices'));
  assert.equal(labels.some((label) => /pressure-spatial-epoch-2.*directory/.test(label)), false);
  assert.ok(device.shaderModules.some(
    (module) => module.code === sphPressureInterfaceContactKinematicsWgsl
  ));
  assert.equal(device.shaderModules.some(
    (module) => module.code === sphPressureInterfaceSpatialExactNearContactKinematicsWgsl
  ), false);
});

test('pressure/interface propagates borrowed exact-near pipeline failure without rebuilding, falling back, or releasing', async () => {
  const device = fakePressureDevice();
  const createComputePipeline = device.createComputePipeline.bind(device);
  device.createComputePipeline = (descriptor) => {
    if (
      descriptor?.compute?.module?.code
      === sphPressureInterfaceSpatialExactNearContactKinematicsWgsl
    ) {
      throw new Error('synthetic canonical pressure/contact pipeline failure');
    }
    return createComputePipeline(descriptor);
  };

  const args = canonicalPressureRunFixture(device);
  const shared = sharedSpatialGenerationFixture(
    device,
    args.schroederActiveNodeList
  );
  args.schroederSpatialEpochGeneration = shared.generation;

  await assert.rejects(
    runSphPressureInterfaceForceRowsWebGpu(args),
    /synthetic canonical pressure\/contact pipeline failure/
  );
  const labels = device.createdBuffers.map((buffer) => buffer.label);
  assert.equal(labels.some((label) => /pressure-spatial-epoch/.test(label)), false);
  assert.equal(labels.includes('ulg-sph-pressure-interface-particle-bin-counts'), false);
  assert.equal(labels.includes('ulg-sph-pressure-interface-particle-bin-indices'), false);
  assert.equal(labels.includes('ulg-sph-pressure-interface-particle-bin-metadata'), false);
  assert.equal(device.shaderModules.some(
    (module) => module.code === sphPressureInterfaceContactKinematicsWgsl
  ), false);
  assert.equal(device.submissions.length, 0);
  assert.equal(shared.releaseCalls.length, 0);
  assert.equal(shared.generation.releaseScheduled, false);
  assert.equal(shared.execution.released, false);
});

test('pressure/interface does not consume Schroeder candidates without retained source spans', async () => {
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
  const schroederLawNeighborCandidateBuffer = device.createBuffer({
    label: 'test-schroeder-law-neighbor-candidates-no-spans',
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
    schroederLawNeighborCandidates: {
      schema: ULG_SCHROEDER_LAW_NEIGHBOR_CANDIDATE_EXECUTION_SCHEMA,
      status: 'schroeder-law-neighbor-candidates-submitted',
      neighborCandidateBuffer: schroederLawNeighborCandidateBuffer,
      neighborCandidateCount: 8,
      neighborCandidateStrideFloats: 16,
      candidateBudget: 4,
      lawQueueCount: 2,
      enabledLawMask: 6,
      enumerationMode: 'schroeder-active-node-tile-traversal-neighbor-enumeration',
      treeTraversalStatus: 'active-node-tile-traversal-before-sorted-schroeder-tree-index'
    },
    boxDimsM: [4, 4, 4],
    retainForceRowsBuffer: true,
    readbackMode: 'no-full-readback'
  });

  assert.equal(
    result.pressureInterfaceForceSolver.schroederLawNeighborCandidateConsumerStatus,
    'schroeder-pressure-interface-law-neighbor-candidates-observed-not-authoritative'
  );
  assert.equal(result.pressureInterfaceForceSolver.schroederLawNeighborCandidateBufferObserved, true);
  assert.equal(result.pressureInterfaceForceSolver.schroederLawNeighborCandidateBufferConsumed, false);
  assert.equal(result.pressureInterfaceForceSolver.schroederLawNeighborSourceSpanBufferObserved, false);
  assert.equal(result.pressureInterfaceForceSolver.schroederLawNeighborSourceSpanBufferConsumed, false);
  assert.equal(
    result.pressureInterfaceForceSolver.pressureInterfaceSpatialIndexStatus,
    'pressure-interface-source-span-spatial-index-unavailable-using-particle-bins'
  );
  assert.equal(result.pressureInterfaceForceSolver.pressureInterfaceSpatialIndexMode, null);
  assert.equal(
    result.pressureInterfaceForceSolver.interfaceContactKinematicsDerivation,
    'gpu-interface-element-neighbor-bin-contact-kinematics'
  );
  const lawNeighborParamsWrite = device.writes.find((entry) => entry.label === 'ulg-sph-pressure-interface-schroeder-law-neighbor-candidates-params');
  const lawNeighborParamsView = new DataView(lawNeighborParamsWrite.snapshot);
  assert.equal(lawNeighborParamsView.getUint32(0, true), 0);
  const sourceSpanParamsWrite = device.writes.find((entry) => entry.label === 'ulg-sph-pressure-interface-schroeder-source-spans-params');
  const sourceSpanParamsView = new DataView(sourceSpanParamsWrite.snapshot);
  assert.equal(sourceSpanParamsView.getUint32(0, true), 0);
  assert.equal(device.bindGroups[1].entries[10].resource.buffer.label, 'ulg-sph-pressure-interface-schroeder-law-neighbor-candidates-disabled');
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
