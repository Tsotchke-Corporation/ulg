import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  RESIDENT_NEIGHBORHOOD_CONSUMER,
  RESIDENT_NEIGHBORHOOD_SUPPORT_FLAG,
  SPH_MATERIAL_INTERFACE_ELEMENT_ROW_LAYOUT,
  SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT,
  ULG_SCHROEDER_LAW_NEIGHBOR_CANDIDATE_EXECUTION_SCHEMA,
  ULG_SCHROEDER_LAW_QUEUE_EXECUTION_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import { createResidentNeighborhoodDescriptor } from '../src/runtime/sph/residentNeighborhoodGpu.js';
import { tagWebGpuBufferDevice } from '../src/runtime/sph/sphGpuDeviceIdentity.js';
import {
  SPH_GAS_CELL_EOS_METADATA_BYTES,
  ULG_PRESSURE_INTERFACE_GPU_GAS_CELL_FIELD_SOURCE_SCHEMA
} from '../src/runtime/sph/sphSpatialGasCellEosGpu.js';
import {
  sphPressureInterfaceContactKinematicsWgsl,
  sphPressureInterfaceResidentContactKinematicsWgsl,
  sphPressureInterfaceForceRowsWgsl
} from '../ulg-gpu-abi/src/wgsl.js';
import {
  createPressureInterfaceContactKinematicsParamsArray,
  createPressureInterfaceParticleBinParamsArray,
  createPressureInterfaceParamsArray,
  normalizeAlgorithmContactPairResponsePolicy,
  packAlgorithmContactPolicyRows,
  packGasPressureCellRows,
  packMaterialInterfaceContactKinematicsRows,
  packMaterialInterfaceElementRows,
  packMaterialInterfaceSourceKeyRows,
  resolvePressureInterfaceParticleBinGrid,
  SPH_ALGORITHM_CONTACT_POLICY_FLOATS,
  SPH_GAS_PRESSURE_CELL_FLOATS,
  SPH_INTERFACE_CONTACT_KINEMATICS_FLOATS,
  SPH_PRESSURE_INTERFACE_FORCE_PARAMS_BYTE_LENGTH,
  runSphPressureInterfaceContactKinematicsWebGpu,
  runSphPressureInterfaceForceRowsWebGpu
} from '../src/runtime/sph/sphPressureInterfaceGpuKernel.js';
import { createSphPressureInterfaceWorkspaceGpu } from '../src/runtime/sph/sphPressureInterfaceWorkspaceGpu.js';

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
  const indirectDispatches = [];
  const shaderModules = [];
  const submissions = [];
  const copies = [];
  return {
    limits: {
      maxBufferSize: 1 << 28,
      maxStorageBufferBindingSize: 1 << 28,
      maxStorageBuffersPerShaderStage: 10
    },
    createdBuffers,
    writes,
    bindGroups,
    dispatches,
    indirectDispatches,
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
            dispatchWorkgroupsIndirect(buffer, offset) {
              indirectDispatches.push({ buffer, offset });
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

function residentPressureNeighborhood(device, {
  generation = 41,
  positionEpoch = 9,
  sourceCount = 2,
  sourceFamily = 'sph-particle-state'
} = {}) {
  const descriptor = createResidentNeighborhoodDescriptor({
    generation,
    leaseId: `pressure-neighborhood-${generation}`,
    laneId: 'pressure-lane-0',
    stateKey: `pressure/state/${generation}`,
    sourceFamily,
    leaseTokenLow: 0x1234,
    leaseTokenHigh: 0x5678,
    supportClasses: [{
      supportClassId: 19,
      consumerMask: RESIDENT_NEIGHBORHOOD_CONSUMER.PRESSURE_INTERFACE,
      minLevelDelta: 0,
      maxLevelDelta: 0,
      cellRadius: 1,
      maxCandidatesPerSource: 4,
      flags: RESIDENT_NEIGHBORHOOD_SUPPORT_FLAG.EXACT_NEAR_REQUIRED
        | RESIDENT_NEIGHBORHOOD_SUPPORT_FLAG.EXCLUDE_SELF
    }],
    sourceSupportAssignments: Array.from({ length: sourceCount }, () => ({ pressureInterface: 19 })),
    positionEpoch,
    skinDistanceM: 0.5,
    maxDisplacementM: 0.1,
    sourceCount,
    requiredUniqueCellCount: sourceCount,
    requiredCellMemberCount: sourceCount,
    requiredCandidateCount: sourceCount,
    capacities: {
      uniqueCellCount: sourceCount,
      cellOffsetCount: sourceCount + 1,
      cellMemberCount: sourceCount,
      sourceOffsetCount: sourceCount + 1,
      sourceSupportAssignmentCount: sourceCount,
      candidateCount: sourceCount * 4
    }
  });
  const packedCandidateCsrBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'test-pressure-resident-neighborhood',
    size: Math.max(1024, descriptor.packedCsr.backingBufferByteLength),
    usage: 128
  }), device);
  return {
    residentNeighborhood: {
      schema: 'peercompute.ulg.resident-neighborhood-gpu-builder.v0',
      descriptor,
      hostAdmission: true,
      encoded: true,
      released: false,
      resources: {
        outputs: {
          sourceCandidateCsr: {
            buffer: packedCandidateCsrBuffer,
            byteLength: packedCandidateCsrBuffer.size
          }
        }
      },
      retainedBuffers: { packedCandidateCsrBuffer }
    },
    validation: {
      generation,
      positionEpoch,
      leaseId: descriptor.lease.leaseId,
      laneId: descriptor.lease.laneId,
      stateKey: descriptor.lease.stateKey,
      sourceFamily,
      leaseTokenLow: descriptor.lease.tokenLow,
      leaseTokenHigh: descriptor.lease.tokenHigh
    },
    authority: {
      generation,
      positionEpoch,
      sourceCount,
      sourceFamily,
      leaseTokenLow: descriptor.lease.tokenLow,
      leaseTokenHigh: descriptor.lease.tokenHigh
    },
    packedCandidateCsrBuffer
  };
}

function residentMaterialInterfaceField(device, authority, {
  rowCapacity = 4,
  denseCandidateCount = 12
} = {}) {
  const candidateRowsBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'test-pressure-resident-interface-candidates',
    size: rowCapacity * SPH_MATERIAL_INTERFACE_ELEMENT_ROW_LAYOUT.length * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  }), device);
  const compactMetadataBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'test-pressure-resident-interface-metadata',
    size: 16,
    usage: 128
  }), device);
  const candidateDispatchIndirectBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'test-pressure-resident-interface-dispatch-indirect',
    size: 12,
    usage: 128 | 256
  }), device);
  return {
    schema: 'peercompute.ulg.sph-material-interface-field.v0',
    status: 'material-interface-compact-candidate-field-encoded-awaiting-caller-submit',
    gpuResidentInterfaceCandidates: true,
    candidateReadback: false,
    candidateCount: denseCandidateCount,
    candidateCompactCapacity: rowCapacity,
    elementCount: rowCapacity,
    elementStrideFloats: SPH_MATERIAL_INTERFACE_ELEMENT_ROW_LAYOUT.length,
    candidateRowsBuffer,
    candidateRowsBufferRetained: true,
    candidateRowsBufferByteLength: candidateRowsBuffer.size,
    compactMetadataBuffer,
    compactMetadataBufferRetained: true,
    compactMetadataBufferByteLength: 16,
    candidateDispatchIndirectBuffer,
    candidateDispatchIndirectBufferRetained: true,
    candidateDispatchIndirectBufferByteLength: 12,
    candidateDispatchIndirectOffsetBytes: 0,
    candidateDispatchAuthority: 'gpu-finalized-active-count-fail-closed-indirect',
    residentAuthority: authority,
    residentAuthorityStatus: 'resident-candidate-authority-bound',
    elements: []
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
  assert.equal(params.byteLength, SPH_PRESSURE_INTERFACE_FORCE_PARAMS_BYTE_LENGTH);
  assert.equal(view.getUint32(0, true), 2);
  assert.equal(view.getFloat32(4, true), 120000);
  assert.equal(view.getUint32(8, true), 1);
  assert.equal(view.getUint32(12, true), 1);
  assert.equal(view.getUint32(16, true), 1);
  assert.ok(Math.abs(view.getFloat32(20, true) - 1e-4) < 1e-8);
  assert.equal(view.getFloat32(24, true), 500000);
  assert.equal(view.getFloat32(28, true), 1);
});

test('pressure/interface params include GPU gas-cell metadata authority without moving legacy offsets', () => {
  const params = createPressureInterfaceParamsArray({
    elementCount: 2,
    pressureModelId: 1,
    retainedGasPressureCellMetadata: {
      ready: true,
      rowCapacity: 9,
      generation: 7,
      laneHashLow: 101,
      laneHashHigh: 202,
      sourceEpoch: 11,
      sourceGeneration: 6,
      gridDims: [2, 2, 2],
      gridCellCount: 8,
      boxDimsM: [4, 2, 1]
    }
  });
  const view = new DataView(params);
  assert.equal(params.byteLength, 144);
  assert.equal(view.getUint32(0, true), 2);
  assert.equal(view.getUint32(12, true), 1);
  assert.equal(view.getUint32(80, true), 1);
  assert.equal(view.getUint32(84, true), 9);
  assert.equal(view.getUint32(88, true), 7);
  assert.equal(view.getUint32(92, true), 101);
  assert.equal(view.getUint32(96, true), 202);
  assert.equal(view.getUint32(100, true), 11);
  assert.equal(view.getUint32(104, true), 6);
  assert.deepEqual([108, 112, 116].map((offset) => view.getUint32(offset, true)), [2, 2, 2]);
  assert.equal(view.getUint32(120, true), 8);
  assert.deepEqual([128, 132, 136].map((offset) => view.getFloat32(offset, true)), [4, 2, 1]);
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
});

test('resident pressure contact kinematics stays within the 10-storage-buffer production limit', () => {
  const storageDeclarations = [
    ...sphPressureInterfaceResidentContactKinematicsWgsl.matchAll(/var<storage/g)
  ].length;
  assert.equal(storageDeclarations, 10);
  assert.doesNotMatch(
    sphPressureInterfaceResidentContactKinematicsWgsl,
    /var<storage,\s*read>\s+schroeder_contact_source_span_rows/
  );
  assert.match(
    sphPressureInterfaceResidentContactKinematicsWgsl,
    /fn\s+ck_schroeder_candidate_span[\s\S]*resident_contact_neighborhood_word\(8u\)/
  );

  const device = fakePressureDevice();
  const neighborhood = residentPressureNeighborhood(device);
  const packedInterfaceElements = packMaterialInterfaceElementRows(interfaceFieldFixture());
  const packedContactPolicy = packAlgorithmContactPolicyRows(
    normalizeAlgorithmContactPairResponsePolicy({
      algorithmMaterialContactRows: algorithmContactRowsFixture()
    })
  );
  const interfaceElementsBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'test-resident-pressure-interface-elements',
    size: packedInterfaceElements.rows.byteLength,
    usage: 128
  }), device);
  const contactPolicyBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'test-resident-pressure-contact-policy',
    size: packedContactPolicy.rows.byteLength,
    usage: 128
  }), device);
  const stateBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'test-resident-pressure-state',
    size: 2 * 8 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  }), device);
  const thermoBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'test-resident-pressure-thermo',
    size: 2 * 12 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  }), device);
  const sourceKeyBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'test-resident-pressure-source-keys',
    size: 2 * 4 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  }), device);
  const result = runSphPressureInterfaceContactKinematicsWebGpu({
    device,
    packedInterfaceElements,
    packedContactPolicy,
    interfaceElementsBuffer,
    contactPolicyBuffer,
    particleSource: {
      ready: true,
      particleCount: 2,
      stateBuffer,
      thermoBuffer
    },
    interfaceSourceKeys: {
      schema: 'peercompute.ulg.sph-interface-source-key.v0',
      status: 'interface-source-key-retained',
      sourceKeyBuffer,
      rowCount: 2,
      readyCount: 2,
      rowStrideFloats: 4
    },
    residentNeighborhood: neighborhood.residentNeighborhood,
    residentNeighborhoodValidation: neighborhood.validation,
    commandEncoder: device.createCommandEncoder()
  });

  assert.equal(result.pipelineVariant, 'resident-neighborhood-source-span-free');
  assert.equal(result.storageBufferBindingCount, 10);
  assert.equal(result.maxStorageBuffersPerShaderStage, 10);
  assert.equal(device.bindGroups.at(-1).entries.some((entry) => entry.binding === 12), false);
  assert.equal(
    device.shaderModules.at(-1).code,
    sphPressureInterfaceResidentContactKinematicsWgsl
  );
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
  assert.equal(device.bindGroups[0].entries.length, 10);
  const emptyContactPolicyBuffer = device.createdBuffers.find(
    (entry) => entry.label === 'ulg-sph-pressure-interface-contact-policy-rows'
  );
  assert.equal(emptyContactPolicyBuffer?.size, 16);
  assert.equal(device.bindGroups[0].entries[1].resource.size >= 16, true);
  assert.equal(device.bindGroups[0].entries[4].resource.size, 16);
  assert.ok(device.createdBuffers.some((entry) => entry.label === 'ulg-sph-pressure-interface-contact-kinematics-rows'));
  assert.equal(result.pressureInterfaceForceSolver.conservationStatus, 'pairwise-equal-opposite-force-conservative');
});

test('pressure/interface encoder stage consumes retained candidate rows and metadata without submit or readback', async () => {
  const device = fakePressureDevice();
  const neighborhood = residentPressureNeighborhood(device);
  const materialInterfaceField = residentMaterialInterfaceField(device, neighborhood.authority);
  const commandEncoder = device.createCommandEncoder();
  const result = await runSphPressureInterfaceForceRowsWebGpu({
    device,
    commandEncoder,
    pressureFeedback: {
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
      status: 'pressure-interface-coupling-ready-for-solver',
      forceCouplingStatus: 'gpu-resident-pressure-force-stage-ready'
    },
    materialInterfaceField,
    particleCount: 2,
    residentNeighborhood: neighborhood.residentNeighborhood,
    residentNeighborhoodValidation: neighborhood.validation,
    retainForceRowsBuffer: true,
    readbackMode: 'no-full-readback'
  });

  assert.equal(result.status, 'pressure-interface-stage-encoded-awaiting-caller-submit');
  assert.equal(result.commandEncoderOwnership, 'caller');
  assert.equal(result.queueSubmitPerformed, false);
  assert.equal(result.mapPerformed, false);
  assert.equal(result.readbackPerformed, false);
  assert.equal(result.materialInterfaceInputMode, 'gpu-resident-compact-candidate-buffer');
  assert.equal(result.materialInterfaceInputAuthoritative, true);
  assert.equal(result.forceRowCapacity, 4);
  assert.equal(result.forceRowStrideFloats, SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT.length);
  assert.equal(result.forceRowActiveCountPending, true);
  assert.equal(
    result.forceRowStatusGate,
    'row3.w-positive-after-gpu-candidate-metadata-and-resident-neighborhood-header-guard'
  );
  assert.equal(result.candidateMetadataBuffer, materialInterfaceField.compactMetadataBuffer);
  assert.equal(result.candidateMetadataBufferBorrowed, true);
  assert.equal(result.candidateMetadataBufferByteLength, 16);
  assert.equal(
    result.gpuFailCloseStatusSource,
    'candidate-metadata-plus-resident-neighborhood-header-written-to-force-row-status'
  );
  assert.deepEqual(result.candidateMetadataLayout, [
    'activeCandidateCount:u32',
    'overflowCount:u32',
    'capacity:u32',
    'denseCandidateCount:u32'
  ]);
  assert.equal(
    result.candidateDispatchIndirectBuffer,
    materialInterfaceField.candidateDispatchIndirectBuffer
  );
  assert.equal(result.candidateDispatchMode, 'dispatchWorkgroupsIndirect');
  assert.equal(
    result.candidateDispatchAuthority,
    'gpu-finalized-active-count-fail-closed-indirect'
  );
  assert.equal(result.pressureInterfaceForceSolver.conservationStatus, 'gpu-resident-pairwise-conservation-evidence-not-read');
  assert.equal(result.pressureInterfaceForceSolver.forceApplicationTarget, 'same-encoder-status-gated-sparse-grid-force-scatter');
  assert.equal(device.submissions.length, 0);
  assert.equal(device.copies.length, 0);
  assert.equal(device.dispatches.length, 0);
  assert.equal(device.indirectDispatches.length, 1);
  assert.equal(
    device.indirectDispatches[0].buffer,
    materialInterfaceField.candidateDispatchIndirectBuffer
  );
  assert.equal(device.indirectDispatches[0].offset, 0);
  assert.equal(device.writes.some((entry) => entry.label === 'ulg-sph-pressure-interface-elements-in'), false);
  assert.equal(device.bindGroups.length, 1);
  assert.equal(device.bindGroups[0].entries.length, 10);
  assert.equal(device.bindGroups[0].entries[0].resource.buffer, materialInterfaceField.candidateRowsBuffer);
  assert.equal(
    device.bindGroups[0].entries[0].resource.size,
    materialInterfaceField.candidateRowsBuffer.size
  );
  assert.ok(device.bindGroups[0].entries[0].resource.size >= 16);
  assert.equal(device.bindGroups[0].entries[6].resource.buffer, materialInterfaceField.compactMetadataBuffer);
  assert.equal(device.bindGroups[0].entries[7].resource.buffer, neighborhood.packedCandidateCsrBuffer);
  const paramsWrite = device.writes.find((entry) => entry.label === 'ulg-sph-pressure-interface-force-params');
  const paramsView = new DataView(paramsWrite.snapshot);
  assert.equal(paramsWrite.byteLength, SPH_PRESSURE_INTERFACE_FORCE_PARAMS_BYTE_LENGTH);
  assert.equal(paramsView.getUint32(0, true), 4);
  assert.equal(paramsView.getUint32(32, true), 1);
  assert.equal(paramsView.getUint32(36, true), 4);
  assert.equal(paramsView.getUint32(40, true), 12);
  assert.equal(paramsView.getUint32(44, true), 1);
  assert.equal(paramsView.getUint32(48, true), 41);
  assert.equal(paramsView.getUint32(52, true), 0x1234);
  assert.equal(paramsView.getUint32(56, true), 0x5678);
  assert.equal(paramsView.getUint32(60, true), 9);
  assert.equal(paramsView.getUint32(64, true), 2);
  assert.equal(paramsView.getUint32(68, true), RESIDENT_NEIGHBORHOOD_CONSUMER.PRESSURE_INTERFACE);
  assert.equal(paramsView.getUint32(72, true), 1);

  result.cleanupSubmittedWork();
  assert.equal(materialInterfaceField.candidateRowsBuffer.destroyed, false);
  assert.equal(materialInterfaceField.compactMetadataBuffer.destroyed, false);
  assert.equal(materialInterfaceField.candidateDispatchIndirectBuffer.destroyed, false);
  assert.equal(neighborhood.packedCandidateCsrBuffer.destroyed, false);
});

test('pressure/interface indirect contact and force stages cannot consume a poisoned inactive tail', async () => {
  const device = fakePressureDevice();
  const neighborhood = residentPressureNeighborhood(device);
  const materialInterfaceField = residentMaterialInterfaceField(device, neighborhood.authority, {
    rowCapacity: 4,
    denseCandidateCount: 12
  });
  materialInterfaceField.candidateRowsBuffer.poisonedInactiveTail = {
    activeCount: 2,
    tailStatus: Number.POSITIVE_INFINITY
  };
  materialInterfaceField.candidateDispatchIndirectBuffer.gpuAuthoredActiveCount = 2;
  const particleStateBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'test-pressure-indirect-particle-state',
    size: 64,
    usage: 128
  }), device);
  const particleThermoBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'test-pressure-indirect-particle-thermo',
    size: 64,
    usage: 128
  }), device);
  const targetContactKinematicsBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'test-pressure-shared-contact-kinematics',
    size: 4 * SPH_INTERFACE_CONTACT_KINEMATICS_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  }), device);
  const targetForceRowsBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'test-pressure-shared-force-rows',
    size: 4 * SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT.length * Float32Array.BYTES_PER_ELEMENT,
    usage: 128 | 4
  }), device);

  const result = await runSphPressureInterfaceForceRowsWebGpu({
    device,
    commandEncoder: device.createCommandEncoder(),
    pressureFeedback: {
      status: 'wall-pressure-ledger-ready',
      totalPressurePa: 120000,
      gasCellField: {
        status: 'gas-cell-pressure-field-ready',
        uniformPressurePa: 120000,
        pressureFieldMode: 'uniform-single-cell-sealed-gas',
        pressureFieldResolution: 'lumped-sealed-box'
      }
    },
    pressureInterfaceCoupling: {
      status: 'pressure-interface-coupling-ready-for-solver',
      forceCouplingStatus: 'gpu-resident-pressure-force-stage-ready'
    },
    materialInterfaceField,
    algorithmMaterialContactRows: algorithmContactRowsFixture(),
    particleStateBuffer,
    particleThermoBuffer,
    particleCount: 2,
    residentNeighborhood: neighborhood.residentNeighborhood,
    residentNeighborhoodValidation: neighborhood.validation,
    targetContactKinematicsBuffer,
    targetForceRowsBuffer,
    retainForceRowsBuffer: true,
    readbackMode: 'no-full-readback'
  });

  assert.equal(result.interfaceContactKinematicsGpuDerived, true);
  assert.equal(
    result.interfaceContactKinematicsDispatchMode,
    'gpu-authored-candidate-count-indirect'
  );
  assert.equal(
    result.interfaceContactKinematicsCandidateDispatchIndirectConsumed,
    true
  );
  assert.equal(device.dispatches.length, 0);
  assert.equal(device.indirectDispatches.length, 2);
  assert.ok(device.indirectDispatches.every((dispatch) => (
    dispatch.buffer === materialInterfaceField.candidateDispatchIndirectBuffer
    && dispatch.offset === 0
  )));
  assert.equal(result.queueSubmitPerformed, false);
  assert.equal(result.mapPerformed, false);
  assert.equal(result.readbackPerformed, false);
  assert.equal(device.submissions.length, 0);
  assert.equal(device.copies.length, 0);
  assert.equal(result.interfaceContactKinematicsBufferOwned, false);
  assert.equal(result.forceRowsBuffer, targetForceRowsBuffer);
  assert.equal(result.forceRowsBufferOwned, false);
  assert.equal(
    result.gpuAllocationEntries.find(({ role }) => (
      role === 'pressure-interface-contact-kinematics'
    )).lifetime,
    'borrowed'
  );
  assert.equal(
    result.gpuAllocationEntries.find(({ role }) => role === 'pressure-interface-force-rows').lifetime,
    'borrowed'
  );
  assert.equal(device.bindGroups.at(-1).entries[1].resource.buffer, targetForceRowsBuffer);
  assert.equal(device.bindGroups.at(-1).entries[5].resource.buffer, targetContactKinematicsBuffer);
  assert.match(
    sphPressureInterfaceForceRowsWgsl,
    /element_index >= compact_candidate_metadata\[0\]/
  );

  result.cleanupSubmittedWork();
  assert.equal(result.destroyForceRowsBuffer(), false);
  assert.equal(targetContactKinematicsBuffer.destroyed, false);
  assert.equal(targetForceRowsBuffer.destroyed, false);
  assert.equal(materialInterfaceField.candidateRowsBuffer.destroyed, false);
  assert.equal(materialInterfaceField.candidateDispatchIndirectBuffer.destroyed, false);
});

test('pressure/interface contact and force controls reuse exact aligned workspace bind groups', async () => {
  const device = fakePressureDevice();
  const neighborhood = residentPressureNeighborhood(device);
  const materialInterfaceField = residentMaterialInterfaceField(device, neighborhood.authority);
  materialInterfaceField.interfaceSourceKeyBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'test-pressure-workspace-source-keys',
    size: 4 * 4 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  }), device);
  materialInterfaceField.interfaceSourceKeyRowCount = 4;
  materialInterfaceField.interfaceSourceKeyReadyCount = 4;
  materialInterfaceField.interfaceSourceKeyStrideFloats = 4;
  const particleStateBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'test-pressure-workspace-particle-state',
    size: 64,
    usage: 128
  }), device);
  const particleThermoBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'test-pressure-workspace-particle-thermo',
    size: 64,
    usage: 128
  }), device);
  const workspace = createSphPressureInterfaceWorkspaceGpu({
    device,
    candidateCapacity: 4,
    sequenceStepCapacity: 2,
    labelPrefix: 'test-pressure-interface-control-workspace'
  });
  const gasPressureCellsBuffer = device.createBuffer({
    label: 'test-pressure-workspace-gas-cells',
    size: 5 * 12 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const gasPressureCellMetadataBuffer = device.createBuffer({
    label: 'test-pressure-workspace-gas-metadata',
    size: SPH_GAS_CELL_EOS_METADATA_BYTES,
    usage: 128
  });
  const gasPressureCellLookupBuffer = device.createBuffer({
    label: 'test-pressure-workspace-gas-lookup',
    size: 4 * Uint32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const gpuResidentLaneLeaseIdentity = {
    schema: 'peercompute.compute.gpu-resident-lane-lease-identity.v0',
    authoritative: true,
    leaseId: 'pressure-workspace-gas-lease',
    laneId: 'ulg:sph:resident',
    stateKey: 'ulg:sph:state',
    sourceFamily: 'sph-particle-state'
  };
  const retainedGasPressureCellImport = {
    schema: 'peercompute.ulg.sph-spatial-gas-cell-eos-gpu-result.v0',
    status: 'sph-spatial-gas-cell-eos-gpu-encoded',
    generation: 7,
    laneIdentityHashLow: 101,
    laneIdentityHashHigh: 202,
    sourceEpoch: 11,
    sourceGeneration: 6,
    gpuResidentLaneLeaseIdentity,
    gridDims: [2, 2, 1],
    gridCellCount: 4,
    boxDimsM: [2, 2, 1],
    pressureInterfaceGasPressureCellRowCapacity: 5,
    pressureInterfaceGasPressureCellRowStrideFloats: 12,
    gasPressureCellsBuffer,
    gasPressureCellMetadataBuffer,
    gasPressureCellLookupBuffer,
    gpuEvidence: {
      schema: 'peercompute.ulg.sph-spatial-gas-cell-eos-gpu-evidence.v0',
      expectedLaneHashLow: 101,
      expectedLaneHashHigh: 202
    },
    retainedGasCellFieldSource: {
      schema: ULG_PRESSURE_INTERFACE_GPU_GAS_CELL_FIELD_SOURCE_SCHEMA,
      status: 'pressure-interface-gpu-gas-cell-field-source-encoded',
      generation: 7,
      sourceEpoch: 11,
      sourceGeneration: 6,
      gasPressureCellRowCapacity: 5,
      gasPressureCellRowStrideFloats: 12,
      gasPressureCellsBuffer,
      gasPressureCellMetadataBuffer,
      gasPressureCellLookupBuffer,
      gridDims: [2, 2, 1],
      gridCellCount: 4,
      boxDimsM: [2, 2, 1]
    },
    addConsumerLease() {
      return { leaseId: 'pressure-workspace-gas-consumer' };
    },
    releaseConsumerLease() {
      return true;
    }
  };
  const run = () => runSphPressureInterfaceForceRowsWebGpu({
    device,
    commandEncoder: device.createCommandEncoder(),
    pressureFeedback: {
      status: 'wall-pressure-ledger-ready',
      totalPressurePa: 0
    },
    pressureInterfaceCoupling: {
      status: 'pressure-interface-coupling-ready-for-solver',
      forceCouplingStatus: 'gpu-resident-pressure-force-stage-ready'
    },
    materialInterfaceField,
    algorithmMaterialContactRows: algorithmContactRowsFixture(),
    particleStateBuffer,
    particleThermoBuffer,
    particleCount: 2,
    residentNeighborhood: neighborhood.residentNeighborhood,
    residentNeighborhoodValidation: neighborhood.validation,
    targetContactKinematicsBuffer: workspace.targetBuffers.targetContactKinematicsBuffer,
    targetForceRowsBuffer: workspace.targetBuffers.targetForceRowsBuffer,
    pressureInterfaceWorkspace: workspace,
    pressureInterfaceWorkspaceSubstepIndex: 1,
    gpuResidentLaneLeaseIdentity,
    expectedGasPressureCellSourceEpoch: 11,
    expectedGasPressureCellSourceGeneration: 6,
    retainedGasPressureCellImport,
    retainForceRowsBuffer: true,
    readbackMode: 'no-full-readback'
  });

  const first = await run();
  const bufferCountAfterFirst = device.createdBuffers.length;
  const bindGroupCountAfterFirst = device.bindGroups.length;
  const second = await run();
  assert.equal(bindGroupCountAfterFirst, 2);
  assert.equal(device.bindGroups.length, bindGroupCountAfterFirst);
  assert.equal(device.createdBuffers.length, bufferCountAfterFirst);
  assert.equal(first.controlWorkspaceBound, true);
  assert.equal(first.controlSlotIndex, 1);
  assert.equal(first.contactBindGroupCacheHit, false);
  assert.equal(first.forceBindGroupCacheHit, false);
  assert.equal(second.contactBindGroupCacheHit, true);
  assert.equal(second.forceBindGroupCacheHit, true);
  const slot = workspace.substepResources(1, { contactPolicyByteLength: 64 });
  const contactBindGroup = device.bindGroups.find(({ entries }) => entries.length === 15);
  const forceBindGroup = device.bindGroups.find(({ entries }) => entries.length === 10);
  assert.deepEqual(
    [
      contactBindGroup.entries[5].resource.buffer,
      contactBindGroup.entries[5].resource.offset,
      contactBindGroup.entries[5].resource.size
    ],
    [workspace.controlBuffer, slot.contactKinematicsParamsByteOffset, slot.contactKinematicsParamsByteLength]
  );
  assert.deepEqual(
    [
      forceBindGroup.entries[2].resource.buffer,
      forceBindGroup.entries[2].resource.offset,
      forceBindGroup.entries[2].resource.size
    ],
    [workspace.controlBuffer, slot.forceParamsByteOffset, slot.forceParamsByteLength]
  );
  assert.deepEqual(
    [
      forceBindGroup.entries[4].resource.buffer,
      forceBindGroup.entries[4].resource.offset,
      forceBindGroup.entries[4].resource.size
    ],
    [slot.contactPolicyBuffer, slot.contactPolicyByteOffset, slot.contactPolicyByteLength]
  );
  assert.equal(workspace.bindGroupCacheEvidence().contactKinematicsHitCount, 1);
  assert.equal(workspace.bindGroupCacheEvidence().forceHitCount, 1);

  first.cleanupSubmittedWork();
  second.cleanupSubmittedWork();
  workspace.destroy();
});

test('pressure/interface retained candidate admission fails closed across devices and source families', async () => {
  const device = fakePressureDevice();
  const otherDevice = fakePressureDevice();
  const neighborhood = residentPressureNeighborhood(device);
  const crossDeviceField = residentMaterialInterfaceField(otherDevice, neighborhood.authority);
  await assert.rejects(
    runSphPressureInterfaceForceRowsWebGpu({
      device,
      commandEncoder: device.createCommandEncoder(),
      pressureFeedback: { totalPressurePa: 120000 },
      pressureInterfaceCoupling: { status: 'pressure-interface-coupling-ready-for-solver' },
      materialInterfaceField: crossDeviceField,
      particleCount: 2,
      residentNeighborhood: neighborhood.residentNeighborhood,
      residentNeighborhoodValidation: neighborhood.validation
    }),
    /candidate-buffer-device-mismatch/
  );

  const wrongFamilyField = residentMaterialInterfaceField(device, {
    ...neighborhood.authority,
    sourceFamily: 'wrong-family'
  });
  await assert.rejects(
    runSphPressureInterfaceForceRowsWebGpu({
      device,
      commandEncoder: device.createCommandEncoder(),
      pressureFeedback: { totalPressurePa: 120000 },
      pressureInterfaceCoupling: { status: 'pressure-interface-coupling-ready-for-solver' },
      materialInterfaceField: wrongFamilyField,
      particleCount: 2,
      residentNeighborhood: neighborhood.residentNeighborhood,
      residentNeighborhoodValidation: neighborhood.validation
    }),
    /candidate-sourceFamily-mismatch/
  );
  assert.equal(device.dispatches.length, 0);
});

test('pressure/interface target validation rejects before allocating transient stage buffers', async () => {
  const device = fakePressureDevice();
  const neighborhood = residentPressureNeighborhood(device);
  const materialInterfaceField = residentMaterialInterfaceField(device, neighborhood.authority);
  const undersizedForceRowsBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'test-undersized-pressure-force-target',
    size: 4,
    usage: 128 | 4
  }), device);
  const allocationCountBeforeCall = device.createdBuffers.length;

  await assert.rejects(
    runSphPressureInterfaceForceRowsWebGpu({
      device,
      commandEncoder: device.createCommandEncoder(),
      pressureFeedback: { totalPressurePa: 120000 },
      pressureInterfaceCoupling: { status: 'pressure-interface-coupling-ready-for-solver' },
      materialInterfaceField,
      particleCount: 2,
      residentNeighborhood: neighborhood.residentNeighborhood,
      residentNeighborhoodValidation: neighborhood.validation,
      targetForceRowsBuffer: undersizedForceRowsBuffer
    }),
    /targetForceRowsBuffer must provide at least/
  );
  assert.equal(device.createdBuffers.length, allocationCountBeforeCall);
});

test('pressure/interface caller-owned stages reject implicit CPU-packed interface rows', async () => {
  const device = fakePressureDevice();
  await assert.rejects(
    runSphPressureInterfaceForceRowsWebGpu({
      device,
      commandEncoder: device.createCommandEncoder(),
      pressureFeedback: { totalPressurePa: 120000 },
      pressureInterfaceCoupling: { status: 'pressure-interface-coupling-ready-for-solver' },
      materialInterfaceField: interfaceFieldFixture()
    }),
    /CPU-packed interface rows are available only with diagnosticCpuMaterialInterfaceInput=true/
  );
  assert.equal(device.dispatches.length, 0);
});

test('pressure/interface force WGSL zeroes capacity rows and fail-closes metadata and neighborhood guards', () => {
  assert.equal([...sphPressureInterfaceForceRowsWgsl.matchAll(/var<storage/g)].length, 9);
  assert.match(sphPressureInterfaceForceRowsWgsl, /@binding\(6\)\s+var<storage,\s*read>\s+compact_candidate_metadata/);
  assert.match(sphPressureInterfaceForceRowsWgsl, /@binding\(7\)\s+var<storage,\s*read>\s+resident_neighborhood/);
  assert.match(sphPressureInterfaceForceRowsWgsl, /@binding\(8\)\s+var<storage,\s*read_write>\s+gas_pressure_cell_metadata/);
  assert.match(sphPressureInterfaceForceRowsWgsl, /@binding\(9\)\s+var<storage,\s*read>\s+gas_pressure_cell_lookup/);
  assert.match(sphPressureInterfaceForceRowsWgsl, /atomicLoad\(&gas_pressure_cell_metadata\[9\]\)/);
  assert.match(sphPressureInterfaceForceRowsWgsl, /fn\s+pressure_zero_force_row/);
  assert.match(sphPressureInterfaceForceRowsWgsl, /overflow_count\s*==\s*0u/);
  assert.match(sphPressureInterfaceForceRowsWgsl, /active_count\s*<=\s*capacity/);
  assert.match(sphPressureInterfaceForceRowsWgsl, /resident_neighborhood\[1\]\s*==\s*params\.resident_generation/);
  assert.match(sphPressureInterfaceForceRowsWgsl, /resident_neighborhood\[33\]\s*==\s*0u/);
  assert.match(sphPressureInterfaceForceRowsWgsl, /element_index\s*>=\s*compact_candidate_metadata\[0\]/);
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
  assert.equal(device.bindGroups[1].entries.length, 16);
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

test('pressure/interface cross-device source keys fail closed onto a local disabled buffer', async () => {
  const device = fakePressureDevice();
  const otherDevice = fakePressureDevice();
  const field = interfaceFieldFixture();
  for (const element of field.elements) {
    delete element.gapM;
    delete element.normalVelocityMPerS;
    delete element.representativeMassKg;
  }
  const crossDeviceSourceKeys = tagWebGpuBufferDevice(otherDevice.createBuffer({
    label: 'test-cross-device-interface-source-keys',
    size: 2 * 4 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  }), otherDevice);
  field.interfaceSourceKeyBuffer = crossDeviceSourceKeys;
  field.interfaceSourceKeyStatus = 'interface-source-key-retained';
  field.interfaceSourceKeyRowCount = 2;
  field.interfaceSourceKeyReadyCount = 2;
  field.interfaceSourceKeyStrideFloats = 4;
  const stateBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'test-source-key-local-state',
    size: 2 * 8 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  }), device);
  const thermoBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'test-source-key-local-thermo',
    size: 2 * 12 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  }), device);

  const result = await runSphPressureInterfaceForceRowsWebGpu({
    device,
    pressureFeedback: { totalPressurePa: 120000 },
    pressureInterfaceCoupling: {
      status: 'pressure-interface-coupling-ready-for-solver',
      forceCouplingStatus: 'pressure-interface-coupling-ready'
    },
    materialInterfaceField: field,
    algorithmMaterialContactRows: algorithmContactRowsFixture(),
    particleStateBuffer: stateBuffer,
    particleThermoBuffer: thermoBuffer,
    particleCount: 2,
    boxDimsM: [4, 4, 4],
    retainForceRowsBuffer: true,
    readbackMode: 'no-full-readback'
  });

  assert.equal(result.interfaceSourceKeyStatus, 'interface-source-key-rejected');
  assert.equal(result.interfaceSourceKeyBufferConsumed, false);
  const contactBindGroup = device.bindGroups.find((entry) => entry.entries.length === 16);
  assert.ok(contactBindGroup);
  assert.notEqual(contactBindGroup.entries[14].resource.buffer, crossDeviceSourceKeys);
  assert.equal(
    contactBindGroup.entries[14].resource.buffer.label,
    'ulg-sph-pressure-interface-source-key-disabled'
  );
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

test('pressure/interface consumes GPU EOS metadata and lookup with fail-closed same-device authority', async () => {
  const device = fakePressureDevice();
  const gasPressureCellsBuffer = device.createBuffer({
    label: 'retained-gpu-gas-pressure-cells',
    size: 5 * 12 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const gasPressureCellMetadataBuffer = device.createBuffer({
    label: 'retained-gpu-gas-pressure-metadata',
    size: SPH_GAS_CELL_EOS_METADATA_BYTES,
    usage: 128
  });
  const gasPressureCellLookupBuffer = device.createBuffer({
    label: 'retained-gpu-gas-pressure-lookup',
    size: 4 * Uint32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const releases = [];
  const gpuResidentLaneLeaseIdentity = {
    schema: 'peercompute.compute.gpu-resident-lane-lease-identity.v0',
    authoritative: true,
    leaseId: 'gas-pressure-lease-7',
    laneId: 'ulg:sph:resident',
    stateKey: 'ulg:sph:state',
    sourceFamily: 'sph-particle-state'
  };
  const retainedGasPressureCellImport = {
    schema: 'peercompute.ulg.sph-spatial-gas-cell-eos-gpu-result.v0',
    status: 'sph-spatial-gas-cell-eos-gpu-encoded',
    generation: 7,
    laneIdentityHashLow: 101,
    laneIdentityHashHigh: 202,
    sourceEpoch: 11,
    sourceGeneration: 6,
    gpuResidentLaneLeaseIdentity,
    gridDims: [2, 2, 1],
    gridCellCount: 4,
    boxDimsM: [2, 2, 1],
    pressureInterfaceGasPressureCellRowCapacity: 5,
    pressureInterfaceGasPressureCellRowStrideFloats: 12,
    gasPressureCellsBuffer,
    gasPressureCellMetadataBuffer,
    gasPressureCellLookupBuffer,
    gpuEvidence: {
      schema: 'peercompute.ulg.sph-spatial-gas-cell-eos-gpu-evidence.v0',
      expectedLaneHashLow: 101,
      expectedLaneHashHigh: 202
    },
    retainedGasCellFieldSource: {
      schema: ULG_PRESSURE_INTERFACE_GPU_GAS_CELL_FIELD_SOURCE_SCHEMA,
      status: 'pressure-interface-gpu-gas-cell-field-source-encoded',
      generation: 7,
      sourceEpoch: 11,
      sourceGeneration: 6,
      gasPressureCellRowCapacity: 5,
      gasPressureCellRowStrideFloats: 12,
      gasPressureCellsBuffer,
      gasPressureCellMetadataBuffer,
      gasPressureCellLookupBuffer,
      gridDims: [2, 2, 1],
      gridCellCount: 4,
      boxDimsM: [2, 2, 1]
    },
    addConsumerLease() {
      return { leaseId: 'gas-cell-consumer-1' };
    },
    releaseConsumerLease(leaseId) {
      releases.push(leaseId);
      return releases.length >= 3;
    }
  };
  const result = await runSphPressureInterfaceForceRowsWebGpu({
    device,
    pressureFeedback: { totalPressurePa: 0 },
    pressureInterfaceCoupling: {
      schema: 'peercompute.ulg.sph-pressure-interface-coupling.v0',
      status: 'pressure-interface-coupling-ready-for-solver',
      forceCouplingStatus: 'pressure-interface-coupling-ready'
    },
    materialInterfaceField: interfaceFieldFixture(),
    gpuResidentLaneLeaseIdentity,
    expectedGasPressureCellSourceEpoch: 11,
    expectedGasPressureCellSourceGeneration: 6,
    retainedGasPressureCellImport,
    retainForceRowsBuffer: true,
    readbackMode: 'no-full-readback'
  });
  assert.equal(result.pressureInterfaceForceSolver.pressureModelId, 1);
  assert.equal(result.pressureInterfaceForceSolver.gasPressureCellGpuMetadataGuarded, true);
  assert.equal(result.pressureInterfaceForceSolver.gasPressureCellRowCount, 0);
  assert.equal(result.pressureInterfaceForceSolver.gasPressureCellRowCapacity, 5);
  assert.equal(result.gasPressureCellMetadataBuffer, gasPressureCellMetadataBuffer);
  assert.equal(result.gasPressureCellLookupBuffer, gasPressureCellLookupBuffer);
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(releases, [
    'gas-cell-consumer-1',
    'gas-cell-consumer-1',
    'gas-cell-consumer-1'
  ]);
  assert.equal(
    result.gasPressureCellConsumerLeaseReleaseStatus,
    'consumer-lease-release-acknowledged'
  );
  assert.equal(result.gasPressureCellConsumerLeaseReleaseAcknowledged, true);
  assert.equal(result.gasPressureCellConsumerLeaseReleaseAttempts, 3);
  const forceBindGroup = device.bindGroups.find((entry) => entry.entries.length === 10);
  assert.ok(forceBindGroup);
  assert.equal(forceBindGroup.entries[8].resource.buffer, gasPressureCellMetadataBuffer);
  assert.equal(forceBindGroup.entries[9].resource.buffer, gasPressureCellLookupBuffer);
  const paramsWrite = device.writes.find((entry) => entry.label === 'ulg-sph-pressure-interface-force-params');
  const paramsView = new DataView(paramsWrite.snapshot);
  assert.equal(paramsView.getUint32(80, true), 1);
  assert.equal(paramsView.getUint32(84, true), 5);
  assert.equal(paramsView.getUint32(88, true), 7);

  await assert.rejects(
    () => runSphPressureInterfaceForceRowsWebGpu({
      device,
      pressureFeedback: { totalPressurePa: 0 },
      pressureInterfaceCoupling: { status: 'pressure-interface-coupling-ready-for-solver' },
      materialInterfaceField: interfaceFieldFixture(),
      gpuResidentLaneLeaseIdentity,
      expectedGasPressureCellSourceEpoch: 12,
      expectedGasPressureCellSourceGeneration: 6,
      retainedGasPressureCellImport,
      readbackMode: 'no-full-readback'
    }),
    /gas-pressure-cell-source-epoch-mismatch/
  );
  await assert.rejects(
    () => runSphPressureInterfaceForceRowsWebGpu({
      device,
      pressureFeedback: { totalPressurePa: 0 },
      pressureInterfaceCoupling: { status: 'pressure-interface-coupling-ready-for-solver' },
      materialInterfaceField: interfaceFieldFixture(),
      gpuResidentLaneLeaseIdentity: { ...gpuResidentLaneLeaseIdentity, leaseId: 'forged-lease' },
      expectedGasPressureCellSourceEpoch: 11,
      expectedGasPressureCellSourceGeneration: 6,
      retainedGasPressureCellImport,
      readbackMode: 'no-full-readback'
    }),
    /gas-pressure-cell-leaseId-mismatch/
  );

  const blockedImport = {
    ...retainedGasPressureCellImport,
    gasPressureCellLookupBuffer: null,
    retainedGasCellFieldSource: {
      ...retainedGasPressureCellImport.retainedGasCellFieldSource,
      gasPressureCellLookupBuffer: null
    }
  };
  await assert.rejects(
    () => runSphPressureInterfaceForceRowsWebGpu({
      device,
      pressureFeedback: { totalPressurePa: 0 },
      pressureInterfaceCoupling: { status: 'pressure-interface-coupling-ready-for-solver' },
      materialInterfaceField: interfaceFieldFixture(),
      gpuResidentLaneLeaseIdentity,
      expectedGasPressureCellSourceEpoch: 11,
      expectedGasPressureCellSourceGeneration: 6,
      retainedGasPressureCellImport: blockedImport,
      readbackMode: 'no-full-readback'
    }),
    /gas-pressure-cell-lookup-buffer-required/
  );
});
