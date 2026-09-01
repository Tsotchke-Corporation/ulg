import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SCHROEDER_CROSS_LEVEL_GRID_CONSERVATION_SUMMARY_ROW_LAYOUT,
  SCHROEDER_CROSS_LEVEL_INVARIANT_EVIDENCE_MAGIC,
  SCHROEDER_CROSS_LEVEL_INVARIANT_EVIDENCE_VERSION,
  SCHROEDER_CROSS_LEVEL_INVARIANT_STATUS_ADMITTED,
  SCHROEDER_CROSS_LEVEL_INVARIANT_STATUS_READY,
  MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_INVARIANT_EVIDENCE_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  createSchroederCrossLevelRefluxLedgerLayout,
  decodeSchroederCrossLevelInvariantEvidence
} from '../ulg-gpu-abi/src/index.js';
import {
  schroederCrossLevelInvariantEvidenceWgsl
} from '../ulg-gpu-abi/src/schroederCrossLevelInvariantEvidenceWgsl.js';
import {
  schroederCrossLevelGridConservationSummaryWgsl,
  schroederCrossLevelGridProlongationCompactWgsl,
  schroederCrossLevelGridProlongationWgsl,
  schroederCrossLevelGridRestrictionCompactWgsl,
  schroederCrossLevelGridRestrictionWgsl
} from '../ulg-gpu-abi/src/wgsl.js';
import {
  MLS_MPM_GPU_GRID_NODE_FLOATS,
  SCHROEDER_CROSS_LEVEL_GRID_CONSERVATION_SUMMARY_FLOATS,
  ULG_SCHROEDER_CROSS_LEVEL_GRID_CONSERVATION_SUMMARY_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_GRID_PROLONGATION_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_GRID_RESTRICTION_SCHEMA,
  createSchroederCrossLevelGridCouplingParamsArray,
  createSchroederCrossLevelGridCouplingPlan,
  decodeSchroederCrossLevelGridConservationSummaryRow,
  prolongGridRowsCpuOracle,
  resolveSchroederParentFieldMechanicsWorkspaceArenaCount,
  restrictGridRowsCpuOracle,
  runSchroederTwoLevelMechanicsStepWebGpu,
  summarizeGridConservationCpuOracle,
  summarizeGridMomentsCpuOracle
} from '../src/runtime/sph/schroederCrossLevelCouplingGpu.js';
import {
  createMlsMpmGridSpec,
  runMlsMpmP2gGridProjectionWebGpu
} from '../src/runtime/sph/sphGridGpuKernel.js';
import {
  SCHROEDER_PHASE_VOLUME_SURFACE_STRESS_ENTRY_POINTS,
  ULG_SCHROEDER_PHASE_VOLUME_SURFACE_STRESS_SUBMISSION_SCHEMA,
  ULG_SCHROEDER_PHASE_VOLUME_SURFACE_STRESS_SUBMISSION_STATUS,
  runMlsMpmGridUpdateWebGpu
} from '../src/runtime/sph/sphGridUpdateGpuKernel.js';
import {
  buildMlsMpmMechanicsMaterialTable
} from '../src/runtime/sph/sphMechanicsMaterialTable.js';
import {
  destroyMlsMpmMechanicsMaterialPhaseUpload,
  uploadMlsMpmMechanicsMaterialPhaseRecords
} from '../src/runtime/sph/sphMechanicsRefreshGpuKernel.js';
import {
  runMlsMpmG2pWebGpu,
  validateLocallySubmittedMlsMpmFusedG2p
} from '../src/runtime/sph/sphG2pGpuKernel.js';
import {
  createSchroederSpatialParentFieldMechanicsWorkspaceGpu
} from '../src/runtime/sph/schroederSpatialParentFieldMechanicsWorkspaceGpu.js';
import {
  runSchroederSpatialEpochGenerationWebGpu
} from '../src/runtime/sph/schroederSpatialEpochGpu.js';
import {
  createSchroederSpatialEpochTransaction
} from '../src/runtime/sph/schroederSpatialEpochTransaction.js';
import {
  SCHROEDER_TWO_LEVEL_CANONICAL_EPOCH_MODE_FUSED_PRIVATE,
  createSchroederTwoLevelCanonicalEpochController
} from '../src/runtime/sph/schroederHierarchyGpu.js';
import {
  tagWebGpuBufferDevice
} from '../src/runtime/sph/sphGpuDeviceIdentity.js';
import {
  abandonSchroederFusedMechanicsPendingClosureAfter,
  completeSchroederFusedMechanicsPendingClosureAfter,
  publishSchroederFusedMechanicsPendingClosure,
  validateSchroederFusedMechanicsPendingClosure,
  validateSchroederFusedMechanicsPublicationReceipt
} from '../src/runtime/sph/schroederFusedFineSubstepGpu.js';

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function randomFineGridRows(plan, seed = 42, { emptyFraction = 0.3 } = {}) {
  const random = seededRandom(seed);
  const rows = new Float64Array(plan.fineNodeCount * plan.gridStrideFloats);
  for (let index = 0; index < plan.fineNodeCount; index += 1) {
    const offset = index * plan.gridStrideFloats;
    const empty = random() < emptyFraction;
    const mass = empty ? 0 : 0.05 + random() * 2;
    rows[offset] = mass;
    rows[offset + 1] = mass * (random() * 4 - 2);
    rows[offset + 2] = mass * (random() * 4 - 2);
    rows[offset + 3] = mass * (random() * 4 - 2);
    rows[offset + 7] = mass > 0 ? 1 : 0;
  }
  return rows;
}

function orchestrationBuffer(label, size = 4096) {
  const bytes = new ArrayBuffer(size);
  return {
    label,
    size,
    bytes,
    async mapAsync() {},
    getMappedRange() { return bytes; },
    unmap() {},
    destroyed: false,
    destroyCount: 0,
    destroy() {
      this.destroyed = true;
      this.destroyCount += 1;
    }
  };
}

function deferredPromise() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function settleBefore(promise, timeoutMs, timeoutMessage) {
  let timeout = null;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error(
          typeof timeoutMessage === 'function'
            ? timeoutMessage()
            : timeoutMessage
        )), timeoutMs);
      })
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

function productionM3Device({
  fenceFactory = () => Promise.resolve(),
  lost = new Promise(() => {})
} = {}) {
  const device = {
    createdBuffers: [],
    createdPipelines: [],
    submissions: [],
    dispatches: [],
    passTrace: [],
    fenceRequestCount: 0,
    limits: {
      maxBufferSize: 256 * 1024 * 1024,
      maxStorageBufferBindingSize: 128 * 1024 * 1024,
      maxUniformBufferBindingSize: 64 * 1024,
      maxStorageBuffersPerShaderStage: 16,
      maxComputeWorkgroupsPerDimension: 65535,
      minUniformBufferOffsetAlignment: 256
    },
    lost,
    createBuffer({ label, size, usage }) {
      const buffer = {
        label,
        size,
        usage,
        destroyed: false,
        destroyCount: 0,
        destroy() {
          this.destroyCount += 1;
          this.destroyed = true;
        }
      };
      this.createdBuffers.push(buffer);
      return buffer;
    },
    createShaderModule(descriptor) { return descriptor; },
    createBindGroupLayout(descriptor) { return descriptor; },
    createPipelineLayout(descriptor) { return descriptor; },
    createComputePipeline(descriptor) {
      this.createdPipelines.push(descriptor);
      return {
        descriptor,
        getBindGroupLayout() { return { entries: [] }; }
      };
    },
    createBindGroup(descriptor) { return descriptor; },
    createCommandEncoder() {
      return {
        clearBuffer() {},
        copyBufferToBuffer() {},
        beginComputePass() {
          let pipeline = null;
          return {
            setPipeline(value) { pipeline = value; },
            setBindGroup() {},
            dispatchWorkgroups: (...dims) => {
              device.dispatches.push(dims);
              device.passTrace.push({
                kind: 'direct',
                label: pipeline?.descriptor?.label ?? null,
                entryPoint:
                  pipeline?.descriptor?.compute?.entryPoint ?? null
              });
            },
            dispatchWorkgroupsIndirect: (buffer, offset = 0) => {
              device.dispatches.push(['indirect', buffer, offset]);
              device.passTrace.push({
                kind: 'indirect',
                label: pipeline?.descriptor?.label ?? null,
                entryPoint:
                  pipeline?.descriptor?.compute?.entryPoint ?? null
              });
            },
            end() {}
          };
        },
        finish() { return {}; }
      };
    }
  };
  device.queue = {
    writeBuffer() {},
    submit(commands) { device.submissions.push(commands); },
    onSubmittedWorkDone() {
      device.fenceRequestCount += 1;
      return fenceFactory(device.fenceRequestCount);
    }
  };
  return device;
}

function productionM3Fixture({
  fineSubstepCount,
  device = productionM3Device(),
  baseGridSpacingM = 0.25,
  phaseVolumeInterfaceTransportEnabled = false,
  surfaceTensionEnabled = false,
  mechanicsFieldPairV2Enabled = true
}) {
  const particleCount = 1;
  const state = new Float32Array([
    0.5, 0.5, 0.5, 1,
    0, 0, 0, 0
  ]);
  const thermo = new Float32Array(12);
  thermo[3] = 1000;
  thermo[8] = 0.25;
  thermo[11] = 0.05;
  const mechanics = new Float32Array(
    MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length
  );
  mechanics.set([1, 0, 0, 0, 1, 0, 0, 0, 1], 0);
  mechanics[18] = 1;
  mechanics[19] = 0.001;
  mechanics[20] = 1;
  mechanics[21] = 1;
  mechanics[27] = 1;
  const sphParticleState = {
    schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
    particleCount,
    smoothingLengthM: baseGridSpacingM,
    stateStrideBytes: 8 * Float32Array.BYTES_PER_ELEMENT,
    thermoStrideBytes: 12 * Float32Array.BYTES_PER_ELEMENT,
    step: 0,
    time: 0,
    state,
    thermo
  };
  const mlsMpmParticleState = {
    schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
    particleCount,
    mechanicsStrideBytes:
      MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length
      * Float32Array.BYTES_PER_ELEMENT,
    mechanicsDtS: Math.fround(0.005 * fineSubstepCount),
    step: 0,
    time: 0,
    mechanics
  };
  const ownedBuffer = (label, size) => tagWebGpuBufferDevice(
    device.createBuffer({ label, size, usage: 128 }),
    device
  );
  const stateBuffer = ownedBuffer('m3-source-state', state.byteLength);
  const thermoBuffer = ownedBuffer('m3-source-thermo', thermo.byteLength);
  const identityBuffer = ownedBuffer(
    'm3-source-identity',
    Uint32Array.BYTES_PER_ELEMENT
  );
  const mechanicsBuffer = ownedBuffer(
    'm3-source-mechanics',
    mechanics.byteLength
  );
  const assignmentBuffer = ownedBuffer(
    'm3-source-assignment',
    16 * Float32Array.BYTES_PER_ELEMENT
  );
  const epochIdentity = {
    storageGeneration: 11,
    bufferFamilyGeneration: 11,
    physicsTick: 13,
    physicsSubstep: 0,
    positionEpoch: 17,
    topologyEpoch: 19,
    chartEpoch: 23,
    levelEpoch: 29,
    supportEpoch: 31
  };
  const levelAssignment = {
    schema: 'peercompute.ulg.schroeder-level-assignment-execution.v0',
    status: 'schroeder-level-assignment-submitted',
    bufferFamilyGenerationStatus:
      'schroeder-particle-buffer-family-generation-ready',
    particleCount,
    assignmentStrideFloats: 16,
    assignmentBuffer,
    assignmentBufferByteLength: assignmentBuffer.size,
    sourceStateBuffer: stateBuffer,
    sourceStateBufferBorrowed: true,
    sourceStateBufferByteLength: stateBuffer.size,
    sourceThermoBuffer: thermoBuffer,
    sourceThermoBufferBorrowed: true,
    sourceThermoBufferByteLength: thermoBuffer.size,
    sourceMechanicsBuffer: mechanicsBuffer,
    sourceMechanicsBufferBorrowed: true,
    sourceMechanicsBufferByteLength: mechanicsBuffer.size,
    ...epochIdentity,
    minLevel: 0,
    maxLevel: 1,
    chartId: 0,
    baseGridSpacingM
  };
  const sphParticleUpload = {
    schema: ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
    status: 'webgpu-uploaded',
    particleCount,
    ...epochIdentity,
    bufferFamilyGenerationStatus:
      'schroeder-particle-buffer-family-generation-ready',
    stateStrideBytes: sphParticleState.stateStrideBytes,
    thermoStrideBytes: sphParticleState.thermoStrideBytes,
    identityStrideBytes: Uint32Array.BYTES_PER_ELEMENT,
    stateBufferByteLength: stateBuffer.size,
    thermoBufferByteLength: thermoBuffer.size,
    identityBufferByteLength: identityBuffer.size,
    identitySchema: ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
    identityRequired: true,
    stateBuffer,
    thermoBuffer,
    identityBuffer,
    ownsStateBuffer: false,
    ownsThermoBuffer: false,
    ownsIdentityBuffer: false,
    slot: 0,
    sourceSlot: 0,
    nextSlot: 1,
    step: 0,
    time: 0
  };
  const mlsMpmParticleUpload = {
    schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
    status: 'webgpu-uploaded',
    particleCount,
    ...epochIdentity,
    bufferFamilyGenerationStatus:
      'schroeder-particle-buffer-family-generation-ready',
    mechanicsStrideBytes: mlsMpmParticleState.mechanicsStrideBytes,
    mechanicsBufferByteLength: mechanicsBuffer.size,
    mechanicsBuffer,
    ownsMechanicsBuffer: false,
    slot: 0,
    sourceSlot: 0,
    nextSlot: 1,
    step: 0,
    time: 0
  };
  const fineGrid = createMlsMpmGridSpec({
    boxDimsM: [1, 1, 1],
    gridSpacingM: baseGridSpacingM
  });
  const coarseGrid = createMlsMpmGridSpec({
    boxDimsM: [1, 1, 1],
    gridSpacingM: baseGridSpacingM * 2
  });
  fineGrid.gridShift = fineGrid.shift;
  coarseGrid.gridShift = coarseGrid.shift;
  const generation = runSchroederSpatialEpochGenerationWebGpu({
    device,
    levelAssignment,
    particleCount,
    particleIdentityBuffer: identityBuffer,
    particleIdentityStrideWords: 1,
    particleBufferSet: null,
    exactNearCellTreeEnabled: false,
    mechanicsFieldPairV2Enabled,
    mechanicsLevels: [
      { selectedLevel: 0, mechanicsGrid: fineGrid },
      { selectedLevel: 1, mechanicsGrid: coarseGrid }
    ],
    phaseVolumeInterfaceProposalEnabled:
      phaseVolumeInterfaceTransportEnabled
  });
  assert.equal(
    generation.selected,
    true,
    `${generation.status}: ${generation.reason ?? 'no reason'}`
  );
  const transaction = createSchroederSpatialEpochTransaction({
    device,
    generation,
    sphParticleUpload,
    mlsMpmParticleUpload,
    twoLevelAuthoritative: true,
    phaseVolumeInterfaceProposalAuthoritative:
      phaseVolumeInterfaceTransportEnabled,
    enabledConsumerReaderIds: [],
    consumerSupportProfileIds: {}
  });
  const mechanicsMaterialTable = phaseVolumeInterfaceTransportEnabled
    ? buildMlsMpmMechanicsMaterialTable({
        h2o: {
          molarMassKgPerMol: 0.018015,
          phases: [{
            name: 'liquid',
            densityKgPerM3: 997,
            bulkModulusPa: 2.2e9,
            shearModulusPa: 0,
            cpJPerKgK: 4184,
            dynamicViscosityPaS: 0.001,
            surfaceTensionNPerM: 0.072,
            temperatureRange: [273.15, 373.15]
          }, {
            name: 'gas',
            densityKgPerM3: 0.6,
            bulkModulusPa: null,
            shearModulusPa: 0,
            cpJPerKgK: 2010,
            dynamicViscosityPaS: 1.3e-5,
            temperatureRange: [373.15, 1000]
          }]
        }
      }, { viscosityEnabled: true, surfaceTensionEnabled })
    : null;
  const mechanicsMaterialPhaseUpload = mechanicsMaterialTable
    ? uploadMlsMpmMechanicsMaterialPhaseRecords(device, mechanicsMaterialTable)
    : null;
  const controller = createSchroederTwoLevelCanonicalEpochController({
    device,
    initialGeneration: generation,
    initialLevelAssignment: levelAssignment,
    initialTransaction: transaction,
    sphParticleState,
    mlsMpmParticleState,
    initialSphParticleUpload: sphParticleUpload,
    initialMlsMpmParticleUpload: mlsMpmParticleUpload,
    fineLevel: 0,
    fineMechanicsGrid: fineGrid,
    coarseMechanicsGrid: coarseGrid,
    boxDimsM: [1, 1, 1],
    mechanicsFieldPairV2Enabled,
    phaseVolumeInterfaceTransportEnabled,
    mechanicsEpochMode:
      SCHROEDER_TWO_LEVEL_CANONICAL_EPOCH_MODE_FUSED_PRIVATE
  });
  return {
    device,
    sphParticleState,
    mlsMpmParticleState,
    sphParticleUpload,
    mlsMpmParticleUpload,
    levelAssignment,
    generation,
    fineGrid,
    coarseGrid,
    controller,
    fineSubstepCount,
    baseGridSpacingM,
    phaseVolumeInterfaceTransportEnabled,
    surfaceTensionEnabled,
    mechanicsMaterialTable,
    mechanicsMaterialPhaseUpload
  };
}

async function runProductionM3Fixture(fixture, {
  counts = { p2g: 0, gridUpdate: 0, g2p: 0 },
  p2gOptions = null,
  g2pOptions = null,
  progress = null,
  overrides = {}
} = {}) {
  const gridUpdates = [];
  const gridUpdateBufferLabels = [];
  const result = await runSchroederTwoLevelMechanicsStepWebGpu({
    ...fixture,
    hierarchyView: fixture.generation.hierarchyView,
    fineLevel: 0,
    baseGridSpacingM: fixture.baseGridSpacingM,
    boxDimsM: [1, 1, 1],
    dt: Math.fround(0.005 * fixture.fineSubstepCount),
    gridSpecFactory: createMlsMpmGridSpec,
    p2gRunner: async (options) => {
      counts.p2g += 1;
      p2gOptions?.push(options);
      progress?.('p2g-start', counts);
      const projection = await runMlsMpmP2gGridProjectionWebGpu(options);
      progress?.('p2g-complete', counts);
      return projection;
    },
    gridUpdateRunner: async (options) => {
      counts.gridUpdate += 1;
      progress?.('grid-update-start', counts);
      const bufferCountBefore = fixture.device.createdBuffers.length;
      const update = await runMlsMpmGridUpdateWebGpu(options);
      gridUpdates.push(update);
      gridUpdateBufferLabels.push(
        fixture.device.createdBuffers
          .slice(bufferCountBefore)
          .map(({ label }) => label)
      );
      progress?.('grid-update-complete', counts);
      return update;
    },
    g2pRunner: async (options) => {
      counts.g2p += 1;
      g2pOptions?.push(options);
      progress?.('g2p-start', counts);
      const reconstruction = await runMlsMpmG2pWebGpu(options);
      assert.equal(validateLocallySubmittedMlsMpmFusedG2p(
        fixture.device,
        reconstruction,
        options.fusedFineSubstepTransaction ? {
          transaction: options.fusedFineSubstepTransaction,
          macroAuthority: options.fusedFineSubstepTransaction.macroAuthority,
          microepochAuthority:
            options.fusedFineSubstepTransaction.microepochAuthority,
          particleContinuation:
            options.fusedFineSubstepTransaction.particleContinuation,
          fieldExecution: options.fusedFineSubstepTransaction.fineFieldView,
          priorArtifact: options.gridUpdate,
          proposalMode: 'proposal-deferred-to-post-mechanics'
        } : {
          terminalTransaction: options.fusedCoarseTerminalTransaction,
          macroAuthority:
            options.fusedCoarseTerminalTransaction.macroAuthority,
          microepochAuthority:
            options.fusedCoarseTerminalTransaction.microepochAuthority,
          particleContinuation:
            options.fusedCoarseTerminalTransaction.particleContinuation,
          fieldExecution:
            options.fusedCoarseTerminalTransaction.coarseFieldView,
          priorArtifact: options.gridUpdate,
          proposalMode: 'proposal-deferred-to-post-mechanics'
        }
      ), true);
      progress?.('g2p-complete', counts);
      return reconstruction;
    },
    invariantEvidenceRunner: async () => {
      throw new Error('M3 sparse production must not run dense evidence');
    },
    momentumAccumulationRunner: async () => {
      throw new Error('M3 sparse production must not run dense accumulation');
    },
    deltaProlongationRunner: async () => {
      throw new Error('M3 sparse production must not run dense prolongation');
    },
    conservationSummaryRunner: async () => {
      throw new Error('M3 sparse production must not run dense conservation');
    },
    compactSummaryRunner: async () => null,
    parentFieldMechanicsWorkspaceRuntimeFactory:
      createSchroederSpatialParentFieldMechanicsWorkspaceGpu,
    canonicalEpochController: fixture.controller,
    phaseVolumeInterfaceTransportEnabled:
      fixture.phaseVolumeInterfaceTransportEnabled,
    mechanicsMaterialTable: fixture.mechanicsMaterialTable,
    mechanicsMaterialPhaseUpload: fixture.mechanicsMaterialPhaseUpload,
    ambientPressurePa:
      fixture.phaseVolumeInterfaceTransportEnabled ? 101325 : 0,
    postMechanicsConsumerReaderIds: [],
    postMechanicsConsumerSupportProfileIds: {},
    retainOutputParticleBuffers: true,
    conservationSummaryReadback: false,
    invariantEvidenceReadback: false,
    compactSummaryReadback: false,
    ...overrides
  });
  return { result, counts, gridUpdates, gridUpdateBufferLabels };
}

test('Schroeder cross-level grid coupling schemas and row layout are stable', () => {
  assert.equal(
    ULG_SCHROEDER_CROSS_LEVEL_GRID_RESTRICTION_SCHEMA,
    'peercompute.ulg.schroeder-cross-level-grid-restriction.v0'
  );
  assert.equal(
    ULG_SCHROEDER_CROSS_LEVEL_GRID_PROLONGATION_SCHEMA,
    'peercompute.ulg.schroeder-cross-level-grid-prolongation.v0'
  );
  assert.equal(
    ULG_SCHROEDER_CROSS_LEVEL_GRID_CONSERVATION_SUMMARY_SCHEMA,
    'peercompute.ulg.schroeder-cross-level-grid-conservation-summary.v0'
  );
  assert.equal(SCHROEDER_CROSS_LEVEL_GRID_CONSERVATION_SUMMARY_FLOATS, 16);
  assert.equal(
    SCHROEDER_CROSS_LEVEL_GRID_CONSERVATION_SUMMARY_ROW_LAYOUT[0],
    'fineMassKg:f32'
  );
  assert.equal(
    SCHROEDER_CROSS_LEVEL_GRID_CONSERVATION_SUMMARY_ROW_LAYOUT[8],
    'massResidualKg:f32'
  );
});

test('parent-field workspace arena policy preserves low-N overlap and bounds split high-N storage', () => {
  const device = {
    limits: {
      maxBufferSize: 4_294_967_292,
      maxStorageBufferBindingSize: 2_147_483_644
    }
  };
  assert.equal(
    resolveSchroederParentFieldMechanicsWorkspaceArenaCount({
      device,
      parentFieldCapacity: 1_119_744,
      fineFieldCapacity: 124_416,
      externalRefluxLedgerByteLength:
        createSchroederCrossLevelRefluxLedgerLayout({
          parentFieldCapacity: 1_119_744,
          coarseFieldCapacity: 124_416
        }).byteLength
    }),
    3
  );
  assert.equal(
    resolveSchroederParentFieldMechanicsWorkspaceArenaCount({
      device,
      parentFieldCapacity: 10_744_488,
      fineFieldCapacity: 1_193_832,
      externalRefluxLedgerByteLength:
        createSchroederCrossLevelRefluxLedgerLayout({
          parentFieldCapacity: 10_744_488,
          coarseFieldCapacity: 1_193_832
        }).byteLength
    }),
    2
  );
  const memoryBoundDevice = {
    limits: {
      maxBufferSize: 600_000_000,
      maxStorageBufferBindingSize: 600_000_000
    }
  };
  assert.equal(
    resolveSchroederParentFieldMechanicsWorkspaceArenaCount({
      device: memoryBoundDevice,
      parentFieldCapacity: 1_119_744,
      fineFieldCapacity: 124_416,
      externalRefluxLedgerByteLength:
        createSchroederCrossLevelRefluxLedgerLayout({
          parentFieldCapacity: 1_119_744,
          coarseFieldCapacity: 124_416
        }).byteLength
    }),
    2
  );
});

test('Schroeder cross-level plan reserves both affine endpoints and doubles spacing', () => {
  const plan = createSchroederCrossLevelGridCouplingPlan({
    fineGridDims: [5, 8, 3],
    fineGridSpacingM: 0.25,
    gridOriginM: [1, -2, 0.5]
  });
  assert.deepEqual(plan.fineGridDims, [5, 8, 3]);
  assert.deepEqual(plan.coarseGridDims, [3, 5, 2]);
  assert.equal(plan.fineNodeCount, 120);
  assert.equal(plan.coarseNodeCount, 30);
  assert.equal(plan.coarseGridSpacingM, 0.5);
  assert.equal(plan.gridStrideFloats, MLS_MPM_GPU_GRID_NODE_FLOATS);
  assert.equal(plan.fineGridByteLength, 120 * 8 * 4);
  assert.equal(plan.coarseGridByteLength, 30 * 8 * 4);
  assert.deepEqual(plan.conservedQuantities, [
    'mass',
    'first-mass-moment',
    'linear-momentum',
    'grid-orbital-angular-momentum'
  ]);
  assert.equal(plan.partitionOfUnity, 'exact-dyadic-interior-fail-closed-incomplete-support');
  assert.equal(plan.affineReproduction, 'coarse-affine-field-exact-dyadic-interpolation');
  assert.equal(plan.gpuFirst, true);
  assert.equal(plan.fullParticleReadbackRequired, false);
});

test('Schroeder cross-level grid coupling params array encodes dims, stride, and spacing', () => {
  const plan = createSchroederCrossLevelGridCouplingPlan({
    fineGridDims: [6, 4, 2],
    fineGridSpacingM: 0.1,
    gridOriginM: [0.5, 0, -1],
    flags: 3
  });
  const params = createSchroederCrossLevelGridCouplingParamsArray(plan);
  // 96 bytes: the tail adds the subcycling delta scale, shared-acceleration
  // dt, and the coarse CFL velocity ceiling (+pad to a 16-byte multiple).
  assert.equal(params.byteLength, 96);
  const view = new DataView(params);
  assert.equal(view.getUint32(0, true), 6);
  assert.equal(view.getUint32(4, true), 4);
  assert.equal(view.getUint32(8, true), 2);
  assert.equal(view.getUint32(12, true), 4);
  assert.equal(view.getUint32(16, true), 3);
  assert.equal(view.getUint32(20, true), 2);
  assert.equal(view.getUint32(24, true), 8);
  assert.equal(view.getUint32(28, true), 3);
  assert.ok(Math.abs(view.getFloat32(32, true) - 0.1) < 1e-7);
  assert.ok(Math.abs(view.getFloat32(36, true) - 0.5) < 1e-7);
  assert.equal(view.getFloat32(44, true), -1);
  assert.equal(view.getInt32(48, true), 0);
});

test('coupling plan encodes MLS-MPM z-fastest index order, shift, and accumulate flags', () => {
  const plan = createSchroederCrossLevelGridCouplingPlan({
    fineGridDims: [9, 9, 9],
    fineGridSpacingM: 0.25,
    indexOrder: 'z-fastest',
    gridShift: 1,
    accumulate: true
  });
  assert.equal(plan.indexOrder, 'z-fastest');
  assert.equal(plan.gridShift, 1);
  assert.equal(plan.accumulate, true);
  // accumulate=1 | z-fastest=2
  assert.equal(plan.flags, 3);
  // ceil((n - 1 + shift) / 2) + 1 retains both endpoints around odd nodes.
  assert.deepEqual(plan.coarseGridDims, [6, 6, 6]);
  const view = new DataView(createSchroederCrossLevelGridCouplingParamsArray(plan));
  assert.equal(view.getUint32(28, true), 3);
  assert.equal(view.getInt32(48, true), 1);
});

test('restriction oracle conserves mass and momentum under z-fastest indexing with shift', () => {
  const plan = createSchroederCrossLevelGridCouplingPlan({
    fineGridDims: [9, 7, 6],
    fineGridSpacingM: 0.25,
    indexOrder: 'z-fastest',
    gridShift: 1
  });
  const fineRows = randomFineGridRows(plan, 5150);
  const coarseRows = restrictGridRowsCpuOracle(plan, fineRows);
  const fine = summarizeGridConservationCpuOracle(plan, fineRows);
  const coarse = summarizeGridConservationCpuOracle(plan, coarseRows);
  assert.ok(Math.abs(fine.massKg - coarse.massKg) < 1e-12 * Math.max(1, fine.massKg));
  for (let axis = 0; axis < 3; axis += 1) {
    assert.ok(
      Math.abs(fine.momentumKgMPerS[axis] - coarse.momentumKgMPerS[axis])
        < 1e-12 * Math.max(1, Math.abs(fine.momentumKgMPerS[axis]))
    );
  }
  // Constant-field recovery must also hold with shifted parent mapping.
  const velocity = [0.5, -1.25, 0.75];
  const constantRows = new Float64Array(plan.fineNodeCount * plan.gridStrideFloats);
  for (let index = 0; index < plan.fineNodeCount; index += 1) {
    const offset = index * plan.gridStrideFloats;
    const mass = index % 3 === 0 ? 0 : 0.25;
    constantRows[offset] = mass;
    constantRows[offset + 1] = mass * velocity[0];
    constantRows[offset + 2] = mass * velocity[1];
    constantRows[offset + 3] = mass * velocity[2];
  }
  const constantCoarse = restrictGridRowsCpuOracle(plan, constantRows);
  const prolonged = prolongGridRowsCpuOracle(plan, constantCoarse, constantRows);
  for (let index = 0; index < plan.fineNodeCount; index += 1) {
    const offset = index * plan.gridStrideFloats;
    const mass = prolonged[offset];
    if (!(mass > 0)) continue;
    for (let axis = 0; axis < 3; axis += 1) {
      assert.ok(Math.abs(prolonged[offset + 1 + axis] / mass - velocity[axis]) < 1e-12);
    }
  }
});

test('accumulate-mode restriction adds fine totals into existing coarse totals', () => {
  const basePlan = createSchroederCrossLevelGridCouplingPlan({
    fineGridDims: [6, 6, 6],
    fineGridSpacingM: 0.5
  });
  const fineRows = randomFineGridRows(basePlan, 31337);
  const seededCoarse = restrictGridRowsCpuOracle(basePlan, fineRows);
  const accumulatePlan = createSchroederCrossLevelGridCouplingPlan({
    fineGridDims: [6, 6, 6],
    fineGridSpacingM: 0.5,
    accumulate: true
  });
  const doubled = restrictGridRowsCpuOracle(accumulatePlan, fineRows, seededCoarse);
  const single = summarizeGridConservationCpuOracle(basePlan, seededCoarse);
  const combined = summarizeGridConservationCpuOracle(accumulatePlan, doubled);
  assert.ok(Math.abs(combined.massKg - 2 * single.massKg) < 1e-12 * Math.max(1, single.massKg));
  for (let axis = 0; axis < 3; axis += 1) {
    assert.ok(
      Math.abs(combined.momentumKgMPerS[axis] - 2 * single.momentumKgMPerS[axis])
        < 1e-12 * Math.max(1, Math.abs(single.momentumKgMPerS[axis]))
    );
  }
});

test('restriction oracle conserves total mass and momentum exactly', () => {
  const plan = createSchroederCrossLevelGridCouplingPlan({
    fineGridDims: [7, 6, 5],
    fineGridSpacingM: 0.2
  });
  const fineRows = randomFineGridRows(plan, 1234);
  const coarseRows = restrictGridRowsCpuOracle(plan, fineRows);
  const fine = summarizeGridConservationCpuOracle(plan, fineRows);
  const coarse = summarizeGridConservationCpuOracle(plan, coarseRows);
  // float64 agglomeration: residuals at machine-precision scale only.
  assert.ok(Math.abs(fine.massKg - coarse.massKg) < 1e-12 * Math.max(1, fine.massKg));
  for (let axis = 0; axis < 3; axis += 1) {
    assert.ok(
      Math.abs(fine.momentumKgMPerS[axis] - coarse.momentumKgMPerS[axis])
        < 1e-12 * Math.max(1, Math.abs(fine.momentumKgMPerS[axis]))
    );
  }
  assert.ok(fine.massKg > 0);
  assert.ok(coarse.activeNodeCount > 0);
  assert.ok(coarse.activeNodeCount <= fine.activeNodeCount);
});

test('full-weighting restriction preserves first moment and orbital angular momentum', () => {
  const plan = createSchroederCrossLevelGridCouplingPlan({
    fineGridDims: [9, 8, 7],
    fineGridSpacingM: 0.2,
    gridOriginM: [-3.5, 1.25, -0.75],
    indexOrder: 'z-fastest',
    gridShift: 1
  });
  const fineRows = randomFineGridRows(plan, 0x51ce7, { emptyFraction: 0.1 });
  const coarseRows = restrictGridRowsCpuOracle(plan, fineRows);
  const fine = summarizeGridMomentsCpuOracle(plan, fineRows, { level: 'fine' });
  const coarse = summarizeGridMomentsCpuOracle(plan, coarseRows, { level: 'coarse' });
  const close = (actual, expected, scale = expected) => {
    assert.ok(Math.abs(actual - expected) < 2e-12 * Math.max(1, Math.abs(scale)));
  };
  close(coarse.massKg, fine.massKg);
  for (let axis = 0; axis < 3; axis += 1) {
    close(coarse.firstMassMomentKgM[axis], fine.firstMassMomentKgM[axis]);
    close(coarse.linearMomentumKgMPerS[axis], fine.linearMomentumKgMPerS[axis]);
    close(
      coarse.orbitalAngularMomentumKgM2PerS[axis],
      fine.orbitalAngularMomentumKgM2PerS[axis]
    );
  }
});

test('trilinear prolongation exactly reproduces a nonsymmetric affine coarse field', () => {
  const plan = createSchroederCrossLevelGridCouplingPlan({
    fineGridDims: [9, 8, 7],
    fineGridSpacingM: 0.25,
    gridOriginM: [-2, 0.5, 1.25],
    indexOrder: 'z-fastest',
    gridShift: 1
  });
  const stride = plan.gridStrideFloats;
  const coarseRows = new Float64Array(plan.coarseNodeCount * stride);
  const fineRows = new Float64Array(plan.fineNodeCount * stride);
  const bias = [0.35, -0.2, 0.6];
  const gradient = [
    [0.2, -0.3, 0.1],
    [0.4, 0.05, -0.25],
    [-0.15, 0.35, 0.12]
  ];
  const velocityAt = (position) => bias.map((value, row) => (
    value + gradient[row].reduce((sum, coefficient, axis) => (
      sum + coefficient * position[axis]
    ), 0)
  ));
  for (let z = 0; z < plan.coarseGridDims[2]; z += 1) {
    for (let y = 0; y < plan.coarseGridDims[1]; y += 1) {
      for (let x = 0; x < plan.coarseGridDims[0]; x += 1) {
        const index = x * plan.coarseGridDims[1] * plan.coarseGridDims[2]
          + y * plan.coarseGridDims[2] + z;
        const offset = index * stride;
        const position = [x, y, z].map((value, axis) => (
          plan.gridOriginM[axis]
            + (value - plan.gridShift) * plan.coarseGridSpacingM
        ));
        const velocity = velocityAt(position);
        coarseRows[offset] = 0.5 + (index % 7) * 0.125;
        for (let axis = 0; axis < 3; axis += 1) {
          coarseRows[offset + 1 + axis] = coarseRows[offset] * velocity[axis];
        }
      }
    }
  }
  for (let index = 0; index < plan.fineNodeCount; index += 1) {
    fineRows[index * stride] = 0.25 + (index % 5) * 0.1;
  }
  const prolonged = prolongGridRowsCpuOracle(plan, coarseRows, fineRows);
  for (let z = 0; z < plan.fineGridDims[2]; z += 1) {
    for (let y = 0; y < plan.fineGridDims[1]; y += 1) {
      for (let x = 0; x < plan.fineGridDims[0]; x += 1) {
        const index = x * plan.fineGridDims[1] * plan.fineGridDims[2]
          + y * plan.fineGridDims[2] + z;
        const offset = index * stride;
        const position = [x, y, z].map((value, axis) => (
          plan.gridOriginM[axis]
            + (value - plan.gridShift) * plan.fineGridSpacingM
        ));
        const expected = velocityAt(position);
        for (let axis = 0; axis < 3; axis += 1) {
          assert.ok(
            Math.abs(prolonged[offset + 1 + axis] / prolonged[offset] - expected[axis])
              < 2e-12
          );
        }
      }
    }
  }
});

test('cross-level plan rejects incomplete affine endpoint padding', () => {
  assert.throws(
    () => createSchroederCrossLevelGridCouplingPlan({
      fineGridDims: [9, 9, 9],
      coarseGridDims: [5, 5, 5],
      fineGridSpacingM: 0.25,
      gridShift: 1
    }),
    /complete affine support/
  );
});

test('restrict-then-prolong preserves a constant velocity field and conserves momentum', () => {
  const plan = createSchroederCrossLevelGridCouplingPlan({
    fineGridDims: [6, 6, 6],
    fineGridSpacingM: 0.5
  });
  const velocity = [1.5, -0.75, 2.25];
  const random = seededRandom(77);
  const fineRows = new Float64Array(plan.fineNodeCount * plan.gridStrideFloats);
  for (let index = 0; index < plan.fineNodeCount; index += 1) {
    const offset = index * plan.gridStrideFloats;
    const mass = random() < 0.25 ? 0 : 0.1 + random();
    fineRows[offset] = mass;
    fineRows[offset + 1] = mass * velocity[0];
    fineRows[offset + 2] = mass * velocity[1];
    fineRows[offset + 3] = mass * velocity[2];
  }
  const coarseRows = restrictGridRowsCpuOracle(plan, fineRows);

  // Coarse level sees the same constant velocity on every massive node.
  for (let index = 0; index < plan.coarseNodeCount; index += 1) {
    const offset = index * plan.gridStrideFloats;
    const mass = coarseRows[offset];
    if (!(mass > 0)) continue;
    assert.ok(Math.abs(coarseRows[offset + 1] / mass - velocity[0]) < 1e-12);
    assert.ok(Math.abs(coarseRows[offset + 2] / mass - velocity[1]) < 1e-12);
    assert.ok(Math.abs(coarseRows[offset + 3] / mass - velocity[2]) < 1e-12);
  }

  // Zero the fine momentum, then prolong the coarse velocity back down: every
  // massive fine node must recover exactly the constant field.
  const zeroedFine = Float64Array.from(fineRows);
  for (let index = 0; index < plan.fineNodeCount; index += 1) {
    const offset = index * plan.gridStrideFloats;
    zeroedFine[offset + 1] = 0;
    zeroedFine[offset + 2] = 0;
    zeroedFine[offset + 3] = 0;
  }
  const prolonged = prolongGridRowsCpuOracle(plan, coarseRows, zeroedFine);
  for (let index = 0; index < plan.fineNodeCount; index += 1) {
    const offset = index * plan.gridStrideFloats;
    const mass = prolonged[offset];
    if (!(mass > 0)) continue;
    assert.ok(Math.abs(prolonged[offset + 1] / mass - velocity[0]) < 1e-12);
    assert.ok(Math.abs(prolonged[offset + 2] / mass - velocity[1]) < 1e-12);
    assert.ok(Math.abs(prolonged[offset + 3] / mass - velocity[2]) < 1e-12);
  }

  // Prolongation of a restriction conserves total momentum.
  const fineTotals = summarizeGridConservationCpuOracle(plan, fineRows);
  const prolongedTotals = summarizeGridConservationCpuOracle(plan, prolonged);
  for (let axis = 0; axis < 3; axis += 1) {
    assert.ok(
      Math.abs(fineTotals.momentumKgMPerS[axis] - prolongedTotals.momentumKgMPerS[axis])
        < 1e-9 * Math.max(1, Math.abs(fineTotals.momentumKgMPerS[axis]))
    );
  }
  assert.ok(Math.abs(fineTotals.massKg - prolongedTotals.massKg) < 1e-12);
});

test('prolongation oracle conserves momentum for non-constant fields too', () => {
  const plan = createSchroederCrossLevelGridCouplingPlan({
    fineGridDims: [8, 4, 4],
    fineGridSpacingM: 0.5
  });
  const fineRows = randomFineGridRows(plan, 999, { emptyFraction: 0.2 });
  const coarseRows = restrictGridRowsCpuOracle(plan, fineRows);
  const prolonged = prolongGridRowsCpuOracle(plan, coarseRows, fineRows);
  const coarseTotals = summarizeGridConservationCpuOracle(plan, coarseRows);
  const prolongedTotals = summarizeGridConservationCpuOracle(plan, prolonged);
  // Per parent cell: sum(child mass * parent velocity) == parent momentum,
  // so global totals match after prolongation.
  for (let axis = 0; axis < 3; axis += 1) {
    assert.ok(
      Math.abs(coarseTotals.momentumKgMPerS[axis] - prolongedTotals.momentumKgMPerS[axis])
        < 1e-9 * Math.max(1, Math.abs(coarseTotals.momentumKgMPerS[axis]))
    );
  }
});

test('conservation summary decoder maps the 16-float row', () => {
  const row = new Float32Array(16);
  row[0] = 10;
  row[4] = 10;
  row[8] = 0;
  row[9] = 0.5;
  row[12] = 42;
  row[13] = 7;
  row[14] = 1;
  const decoded = decodeSchroederCrossLevelGridConservationSummaryRow(row);
  assert.equal(decoded.schema, ULG_SCHROEDER_CROSS_LEVEL_GRID_CONSERVATION_SUMMARY_SCHEMA);
  assert.equal(decoded.fineMassKg, 10);
  assert.equal(decoded.coarseMassKg, 10);
  assert.equal(decoded.massResidualKg, 0);
  assert.equal(decoded.momentumResidualKgMPerS[0], 0.5);
  assert.equal(decoded.fineActiveNodeCount, 42);
  assert.equal(decoded.coarseActiveNodeCount, 7);
  assert.equal(decoded.status, 1);
  assert.equal(decodeSchroederCrossLevelGridConservationSummaryRow(new Float32Array(4)), null);
});

test('v1 compact invariant evidence decodes mass, moments, residuals, and tolerance', () => {
  const words = new Uint32Array(48);
  const floats = new Float32Array(words.buffer);
  words[0] = SCHROEDER_CROSS_LEVEL_INVARIANT_EVIDENCE_MAGIC;
  words[1] = SCHROEDER_CROSS_LEVEL_INVARIANT_EVIDENCE_VERSION;
  words[2] = SCHROEDER_CROSS_LEVEL_INVARIANT_STATUS_READY
    | SCHROEDER_CROSS_LEVEL_INVARIANT_STATUS_ADMITTED;
  words[3] = 17;
  words[4] = 12;
  words[5] = 8;
  floats[8] = 4;
  floats[9] = 2;
  floats[12] = 3;
  floats[15] = 5;
  words[18] = 6;
  floats[20] = 4;
  floats[32] = 1e-6;
  floats[42] = 1e-5;
  words[46] = 9;
  const decoded = decodeSchroederCrossLevelInvariantEvidence(words);
  assert.equal(decoded.schema, ULG_SCHROEDER_CROSS_LEVEL_INVARIANT_EVIDENCE_SCHEMA);
  assert.equal(decoded.admitted, true);
  assert.equal(decoded.generationId, 17);
  assert.equal(decoded.fine.massKg, 4);
  assert.deepEqual(decoded.fine.firstMassMomentKgM, [2, 0, 0]);
  assert.deepEqual(decoded.fine.linearMomentumKgMPerS, [3, 0, 0]);
  assert.deepEqual(decoded.fine.orbitalAngularMomentumKgM2PerS, [5, 0, 0]);
  assert.equal(decoded.fine.activeNodeCount, 6);
  assert.ok(decoded.residual.massKg > 0);
  assert.ok(decoded.tolerance.massKg > decoded.residual.massKg);
  assert.equal(decoded.completionOrdinal, 9);
  assert.equal(decodeSchroederCrossLevelInvariantEvidence(new Uint32Array(8)), null);
});

test('cross-level grid coupling WGSL kernels declare the shared params and entry points', () => {
  for (const source of [
    schroederCrossLevelGridRestrictionWgsl,
    schroederCrossLevelGridProlongationWgsl,
    schroederCrossLevelGridConservationSummaryWgsl
  ]) {
    assert.match(source, /struct SchroederCrossLevelGridCouplingParams/);
    assert.match(source, /@compute @workgroup_size\(64\)/);
    assert.match(source, /fn main\(/);
  }
  assert.match(schroederCrossLevelGridRestrictionWgsl, /var<storage, read> fine_grid/);
  assert.match(schroederCrossLevelGridRestrictionWgsl, /var<storage, read_write> coarse_grid/);
  assert.match(schroederCrossLevelGridProlongationWgsl, /var<storage, read> coarse_grid/);
  assert.match(schroederCrossLevelGridProlongationWgsl, /var<storage, read_write> fine_grid/);
  assert.match(schroederCrossLevelGridConservationSummaryWgsl, /var<storage, read_write> summary_row/);
  for (const source of [
    schroederCrossLevelGridRestrictionCompactWgsl,
    schroederCrossLevelGridProlongationCompactWgsl
  ]) {
    assert.match(source, /var<storage, read> hierarchy_view/);
    assert.match(source, /compact_(fine|coarse)_index/);
    assert.match(source, /hierarchy_admitted/);
  }
  assert.match(schroederCrossLevelInvariantEvidenceWgsl, /struct MomentPartial/);
  assert.match(schroederCrossLevelInvariantEvidenceWgsl, /hierarchy_admitted/);
  assert.match(schroederCrossLevelInvariantEvidenceWgsl, /first_residual/);
  assert.doesNotMatch(schroederCrossLevelInvariantEvidenceWgsl, /isFinite/);
});

test('two-level continuation fails closed when arbitrary domains lack resident identity', async () => {
  await assert.rejects(
    runSchroederTwoLevelMechanicsStepWebGpu({
      device: {
        createBuffer() {},
        queue: { writeBuffer() {} }
      },
      sphParticleState: { particleCount: 1, identityRequired: true },
      mlsMpmParticleState: { particleCount: 1 },
      levelAssignment: {},
      gridSpecFactory() {},
      p2gRunner() {},
      gridUpdateRunner() {},
      g2pRunner() {}
    }),
    /requires resident identity for arbitrary render domains/
  );
});

test('M3 production controller executes authenticated r=1..4 fused chains without public S*', async () => {
  for (let ratio = 1; ratio <= 4; ratio += 1) {
    const fixture = productionM3Fixture({ fineSubstepCount: ratio });
    const counts = { p2g: 0, gridUpdate: 0, g2p: 0 };
    const executionCflFactor = 0.75 + (ratio * 0.01);
    const predictorCflFactors = [];
    const p2gOptions = [];
    const { result, gridUpdates } = await runProductionM3Fixture(fixture, {
      counts,
      p2gOptions,
      overrides: {
        cflFactor: executionCflFactor,
        parentFieldMechanicsWorkspaceRuntimeFactory: (...args) => {
          const runtime = createSchroederSpatialParentFieldMechanicsWorkspaceGpu(
            ...args
          );
          return {
            ...runtime,
            encodePredictors(encoder, options) {
              predictorCflFactors.push(options.cflFactor);
              return runtime.encodePredictors(encoder, options);
            }
          };
        }
      }
    });

    assert.deepEqual(counts, {
      p2g: 2 * ratio + 1,
      gridUpdate: ratio + 1,
      g2p: ratio + 1
    });
    const macroDt = Math.fround(0.005 * ratio);
    for (let substep = 0; substep < ratio; substep += 1) {
      const fineOptions = p2gOptions[2 * substep];
      const coarseOptions = p2gOptions[2 * substep + 1];
      const expectedCurrentTheta = Math.fround(
        ((substep + 1) / ratio) * macroDt
      );
      const expectedSuccessorTheta = substep + 1 < ratio
        ? Math.fround(((substep + 2) / ratio) * macroDt)
        : null;
      assert.equal(fineOptions.schroederSelectedLevel, 0);
      assert.equal(fineOptions.dt, Math.fround(0.005));
      assert.equal(fineOptions.mechanicsFieldTemporalCoarsePredictor, null);
      assert.ok(fineOptions.fusedFineSubstepTransaction);
      assert.equal(coarseOptions.schroederSelectedLevel, 1);
      assert.equal(coarseOptions.dt, expectedCurrentTheta);
      assert.equal(coarseOptions.fusedFineSubstepTransaction, undefined);
      assert.equal(coarseOptions.fusedCoarseTerminalTransaction, undefined);
      assert.equal(
        coarseOptions.mechanicsFieldTemporalCoarsePredictor?.enabled ?? false,
        expectedSuccessorTheta != null
      );
      assert.equal(
        coarseOptions.mechanicsFieldTemporalCoarsePredictor?.role ?? null,
        expectedSuccessorTheta == null
          ? null
          : 'immediate-successor-coarse-predictor'
      );
      assert.equal(
        coarseOptions.mechanicsFieldTemporalCoarsePredictor
          ?.successorThetaDt ?? null,
        expectedSuccessorTheta
      );
      assert.equal(
        fineOptions.queueOrderedSubmissionBatch,
        coarseOptions.queueOrderedSubmissionBatch
      );
      assert.equal(
        fineOptions.queueOrderedSubmissionBatch?.schema,
        'peercompute.ulg.queue-ordered-submission-batch.v0'
      );
    }
    const terminalOptions = p2gOptions[2 * ratio];
    assert.equal(terminalOptions.schroederSelectedLevel, 1);
    assert.equal(terminalOptions.dt, macroDt);
    assert.equal(
      terminalOptions.mechanicsFieldTemporalCoarsePredictor,
      null
    );
    assert.ok(terminalOptions.fusedCoarseTerminalTransaction);
    assert.equal(terminalOptions.queueOrderedSubmissionBatch, null);
    assert.equal(result.parentFieldMechanicsWorkspaceBuildCount, ratio + 1);
    assert.equal(result.parentFieldMechanicsFineCorrectionCount, ratio);
    assert.equal(result.parentFieldMechanicsCoarseTerminalCount, 1);
    assert.equal(result.parentFieldMechanicsCoarsePublishCount, 0);
    assert.equal(result.cflFactor, executionCflFactor);
    assert.equal(gridUpdates.length, ratio + 1);
    for (const update of gridUpdates) {
      assert.equal(update.cflFactor, executionCflFactor);
    }
    assert.deepEqual(
      predictorCflFactors,
      Array.from({ length: ratio }, () => executionCflFactor)
    );
    assert.equal(result.fullParticleReadbackPerformed, false);
    assert.equal(result.fullParticleReadbackFree, true);
    assert.equal(result.readbackTelemetryComplete, true);
    assert.deepEqual(result.readbackTelemetryUnknownSources, []);
    assert.equal(result.mapAsyncCount, 0);
    assert.equal(result.readbackBytes, 0);
    assert.equal(result.hostQueueFenceCount, 0);
    assert.equal(result.normalHotLoopReadbackFree, true);
    assert.equal(result.canonicalMacroStatus.operationCount, ratio + 1);
    assert.equal(result.canonicalMacroStatus.producerChainAuthenticated, true);
    assert.equal(result.canonicalEpochControllerSummary.epochCount, ratio + 1);
    assert.equal(
      result.canonicalEpochControllerSummary.committedEpochCount,
      ratio + 1
    );
    assert.equal(
      result.canonicalEpochControllerSummary.privateAdvancedEpochCount,
      ratio + 1
    );
    assert.equal(result.canonicalEpochControllerSummary.publishedEpochCount, 0);
    assert.equal(result.canonicalEpochControllerSummary.proposalBuildCount, 0);
    assert.equal(
      result.canonicalEpochControllerSummary.mechanicsFieldPairV2Enabled,
      true
    );
    assert.deepEqual(
      result.canonicalEpochControllerSummary.mechanicsFieldConstructionModes,
      Array.from(
        { length: ratio + 1 },
        () => 'paired-v2-shared-radix'
      )
    );
    assert.equal(
      result.canonicalEpochControllerSummary
        .mechanicsFieldTopologySuccessorCount,
      0
    );
    assert.deepEqual(
      result.canonicalEpochControllerSummary
        .mechanicsFieldTopologySuccessorCountByEpoch,
      Array.from({ length: ratio + 1 }, () => 0)
    );
    assert.equal(
      result.internalEnergyTransferStatus,
      'nonnegative-reflux-kinetic-loss-deposited-by-transpose-g2p'
    );
    assert.equal(
      result.refluxEvidenceStatus,
      'gpu-measured-equal-opposite-linear-angular-energy-ledger'
    );
    assert.deepEqual(result.phaseVolumeInterfaceTransport, {
      enabled: false,
      pressureScale: 1,
      dragScale: 1,
      maxImpulseFraction: 0.5,
      ambientBoundaryEvidence: 'disabled-phase-volume-interface-transport'
    });
    assert.equal(result.postMechanicsEpoch, null);
    assert.equal('stateBuffer' in result, false);
    assert.equal('mechanicsBuffer' in result, false);
    assert.equal('nextParticleUploads' in result, false);
    assert.equal('nextSphParticleState' in result, false);
    assert.equal('nextMlsMpmParticleState' in result, false);
    assert.equal(result.destroyOutputParticleBuffers(), false);
    assert.equal(validateSchroederFusedMechanicsPendingClosure(
      fixture.device,
      result.pendingPostMechanicsClosure
    ), true);
    assert.equal(
      result.pendingPostMechanicsClosure.terminalSpatialEpochTransaction.state,
      'private-advanced'
    );
    assert.ok(result.pendingPostMechanicsClosure.terminalPrivateAdvanceReceipt);
    assert.equal(await abandonSchroederFusedMechanicsPendingClosureAfter(
      fixture.device,
      result.pendingPostMechanicsClosure,
      { reason: new Error(`M3 r=${ratio} matrix cleanup`) }
    ), true);
    assert.equal(
      await result.pendingPostMechanicsClosure.completionPromise,
      false
    );
    assert.equal(await fixture.controller.completionPromise(), true);
  }
});

test('two-level mechanics rejects invalid CFL profiles before GPU work', async () => {
  for (const cflFactor of [0, -0.1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    const fixture = productionM3Fixture({ fineSubstepCount: 2 });
    const counts = { p2g: 0, gridUpdate: 0, g2p: 0 };
    const submissionCount = fixture.device.submissions.length;
    await assert.rejects(
      runProductionM3Fixture(fixture, {
        counts,
        overrides: { cflFactor }
      }),
      /cflFactor must be finite and positive/
    );
    assert.deepEqual(counts, { p2g: 0, gridUpdate: 0, g2p: 0 });
    assert.equal(fixture.device.submissions.length, submissionCount);
    await fixture.controller.abortAllAfter(
      new Error('invalid CFL profile fixture cleanup'),
      { mechanicsRetirement: Promise.resolve(true) }
    );
    assert.equal(await fixture.controller.completionPromise(), true);
  }
});

test('independent-v2 frozen refresh reuses both level topologies with fresh state', async () => {
  const fixture = productionM3Fixture({
    fineSubstepCount: 2,
    mechanicsFieldPairV2Enabled: false
  });
  const { result } = await runProductionM3Fixture(fixture);
  assert.equal(
    result.canonicalEpochControllerSummary.mechanicsFieldPairV2Enabled,
    false
  );
  assert.deepEqual(
    result.canonicalEpochControllerSummary.mechanicsFieldConstructionModes,
    ['independent-v2', 'independent-v2', 'independent-v2']
  );
  assert.equal(
    result.canonicalEpochControllerSummary.mechanicsFieldTopologySuccessorCount,
    4
  );
  assert.deepEqual(
    result.canonicalEpochControllerSummary
      .mechanicsFieldTopologySuccessorCountByEpoch,
    [0, 2, 2]
  );
  assert.equal(result.hostQueueFenceCount, 0);
  assert.equal(result.mapAsyncCount, 0);
  assert.equal(result.readbackBytes, 0);
  assert.equal(await abandonSchroederFusedMechanicsPendingClosureAfter(
    fixture.device,
    result.pendingPostMechanicsClosure,
    { reason: new Error('independent-v2 topology successor cleanup') }
  ), true);
  assert.equal(await fixture.controller.completionPromise(), true);
});

test('M3 production profiling brackets every fine and terminal mechanics queue stage', async () => {
  const fixture = productionM3Fixture({ fineSubstepCount: 2 });
  const producerIds = [];
  const g2pOptions = [];
  const gpuTimestampRecorder = {
    active: true,
    async measureQueueStage(descriptor, runStage) {
      producerIds.push(descriptor?.producerId ?? null);
      return runStage();
    }
  };
  const { result } = await runProductionM3Fixture(fixture, {
    g2pOptions,
    overrides: { gpuTimestampRecorder }
  });
  assert.equal(g2pOptions.length, 3);
  assert.ok(g2pOptions.every((options) => (
    options.gpuTimestampRecorder === gpuTimestampRecorder
  )));
  assert.deepEqual(producerIds, [
    'schroeder-two-level-mechanics:fine-0-p2g',
    'schroeder-two-level-mechanics:fine-0-coarse-predictor-p2g',
    'schroeder-two-level-mechanics:fine-0-parent-predictor',
    'schroeder-two-level-mechanics:fine-0-grid-update',
    'schroeder-two-level-mechanics:fine-0-correction',
    'schroeder-two-level-mechanics:fine-0-g2p',
    'schroeder-two-level-mechanics:fine-0-epoch-refresh',
    'schroeder-two-level-mechanics:fine-1-p2g',
    'schroeder-two-level-mechanics:fine-1-coarse-predictor-p2g',
    'schroeder-two-level-mechanics:fine-1-parent-predictor',
    'schroeder-two-level-mechanics:fine-1-grid-update',
    'schroeder-two-level-mechanics:fine-1-correction',
    'schroeder-two-level-mechanics:fine-1-g2p',
    'schroeder-two-level-mechanics:fine-1-epoch-refresh',
    'schroeder-two-level-mechanics:terminal-coarse-p2g',
    'schroeder-two-level-mechanics:terminal-coarse-grid-update',
    'schroeder-two-level-mechanics:terminal-coarse-correction',
    'schroeder-two-level-mechanics:terminal-coarse-g2p'
  ]);
  assert.equal(await abandonSchroederFusedMechanicsPendingClosureAfter(
    fixture.device,
    result.pendingPostMechanicsClosure,
    { reason: new Error('M3 profiling fixture cleanup') }
  ), true);
  assert.equal(await fixture.controller.completionPromise(), true);
});

test('Slice 9 mounts S9-C transport on every fine and terminal coarse grid update', async () => {
  const fixture = productionM3Fixture({
    fineSubstepCount: 1,
    phaseVolumeInterfaceTransportEnabled: true
  });
  const { result, counts } = await runProductionM3Fixture(fixture);

  assert.deepEqual(counts, { p2g: 3, gridUpdate: 2, g2p: 2 });
  assert.equal(
    fixture.generation.phaseVolumeInterfaceProposalEnabled,
    true
  );
  assert.equal(
    fixture.generation.phaseVolumeInterfaceProposal?.twoLevel,
    true
  );
  assert.equal(
    result.canonicalEpochControllerSummary
      .phaseVolumeInterfaceTransportEnabled,
    true
  );
  assert.equal(
    result.canonicalEpochControllerSummary
      .mechanicsFieldTopologySuccessorCount,
    0
  );
  assert.deepEqual(
    result.canonicalEpochControllerSummary
      .mechanicsFieldTopologySuccessorCountByEpoch,
    [0, 0]
  );
  assert.deepEqual(result.phaseVolumeInterfaceTransport, {
    enabled: true,
    pressureScale: 1,
    dragScale: 1,
    maxImpulseFraction: 0.5,
    ambientBoundaryEvidence: 'sealed-external-impulse-and-work'
  });
  assert.equal(
    result.internalEnergyTransferStatus,
    'signed-pressure-compensation-plus-nonnegative-drag-causal-heat-deposited-by-transpose-g2p'
  );
  assert.equal(
    result.refluxEvidenceStatus,
    'gpu-measured-equal-opposite-linear-angular-pressure-drag-energy-ledger'
  );
  assert.equal(
    fixture.device.createdBuffers.filter(
      ({ label }) =>
        label === 'ulg-schroeder-phase-volume-transport-scratch'
    ).length,
    2
  );

  assert.equal(await abandonSchroederFusedMechanicsPendingClosureAfter(
    fixture.device,
    result.pendingPostMechanicsClosure,
    { reason: new Error('Slice 9 mounted-transport fixture cleanup') }
  ), true);
  assert.equal(await fixture.controller.completionPromise(), true);
  destroyMlsMpmMechanicsMaterialPhaseUpload(
    fixture.mechanicsMaterialPhaseUpload
  );
});

test('Slice 9 declares cross-level pressure only for operator-readable projections', async () => {
  const fixture = productionM3Fixture({
    fineSubstepCount: 1,
    phaseVolumeInterfaceTransportEnabled: true
  });
  const projectionPolicies = [];
  const { result } = await runProductionM3Fixture(fixture, {
    overrides: {
      p2gRunner: async (options) => {
        projectionPolicies.push({
          role: options.fusedCoarseTerminalTransaction
            ? 'terminal'
            : (options.fusedFineSubstepTransaction
                ? 'fine'
                : 'coarse-predictor'),
          crossLevelPressureConsumerRequired:
            options.pressureCrossLevelConsumerRequired
        });
        return runMlsMpmP2gGridProjectionWebGpu(options);
      }
    }
  });

  assert.deepEqual(projectionPolicies, [
    {
      role: 'fine',
      crossLevelPressureConsumerRequired: true
    },
    {
      role: 'coarse-predictor',
      crossLevelPressureConsumerRequired: true
    },
    {
      role: 'terminal',
      crossLevelPressureConsumerRequired: false
    }
  ]);
  assert.equal(await abandonSchroederFusedMechanicsPendingClosureAfter(
    fixture.device,
    result.pendingPostMechanicsClosure,
    { reason: new Error('Slice 9 pressure-consumer policy fixture cleanup') }
  ), true);
  assert.equal(await fixture.controller.completionPromise(), true);
  destroyMlsMpmMechanicsMaterialPhaseUpload(
    fixture.mechanicsMaterialPhaseUpload
  );
});

test('Slice 9 surface stress submits six colored face passes transactionally', async () => {
  const fixture = productionM3Fixture({
    fineSubstepCount: 1,
    phaseVolumeInterfaceTransportEnabled: true,
    surfaceTensionEnabled: true
  });
  const {
    result,
    counts,
    gridUpdates,
    gridUpdateBufferLabels
  } = await runProductionM3Fixture(fixture);
  const expectedWindow = [
    'stage_transport',
    ...SCHROEDER_PHASE_VOLUME_SURFACE_STRESS_ENTRY_POINTS,
    'validate_staged_transport',
    'commit_transport'
  ];
  const expectedEntryPoints = new Set(expectedWindow);
  const transportTrace = fixture.device.passTrace.filter(
    ({ entryPoint }) => expectedEntryPoints.has(entryPoint)
  );
  const surfacePipelines = fixture.device.createdPipelines.filter(
    ({ compute }) =>
      SCHROEDER_PHASE_VOLUME_SURFACE_STRESS_ENTRY_POINTS.includes(
        compute?.entryPoint
      )
  );

  assert.deepEqual(counts, { p2g: 3, gridUpdate: 2, g2p: 2 });
  assert.deepEqual(
    surfacePipelines.map(({ compute }) => compute.entryPoint),
    SCHROEDER_PHASE_VOLUME_SURFACE_STRESS_ENTRY_POINTS
  );
  assert.deepEqual(
    transportTrace.map(({ entryPoint }) => entryPoint),
    [...expectedWindow, ...expectedWindow]
  );
  assert.equal(
    transportTrace
      .filter(({ entryPoint }) =>
        SCHROEDER_PHASE_VOLUME_SURFACE_STRESS_ENTRY_POINTS.includes(
          entryPoint
        )
      )
      .every(({ kind }) => kind === 'indirect'),
    true
  );
  assert.deepEqual(gridUpdateBufferLabels, [
    [
      'ulg-mls-mpm-mechanics-field-grid-update-params',
      'ulg-mls-mpm-mechanics-field-grid-update-indirect',
      'ulg-schroeder-phase-volume-transport-scratch'
    ],
    [
      'ulg-mls-mpm-mechanics-field-grid-update-params',
      'ulg-mls-mpm-mechanics-field-grid-update-indirect',
      'ulg-schroeder-phase-volume-transport-scratch'
    ]
  ]);
  assert.equal(
    fixture.device.createdBuffers.some(
      ({ label }) => label.includes('surface-stress')
    ),
    false
  );
  assert.equal(gridUpdates.length, 2);
  for (const update of gridUpdates) {
    assert.equal(update.phaseVolumeSurfaceStressRequested, true);
    assert.equal(update.phaseVolumeSurfaceStressSubmitted, true);
    assert.equal(
      update.phaseVolumeSurfaceStressSubmission?.schema,
      ULG_SCHROEDER_PHASE_VOLUME_SURFACE_STRESS_SUBMISSION_SCHEMA
    );
    assert.equal(
      update.phaseVolumeSurfaceStressSubmission?.status,
      ULG_SCHROEDER_PHASE_VOLUME_SURFACE_STRESS_SUBMISSION_STATUS
    );
    assert.equal(
      update.phaseVolumeSurfaceStressSubmission?.dispatchCount,
      SCHROEDER_PHASE_VOLUME_SURFACE_STRESS_ENTRY_POINTS.length
    );
    assert.deepEqual(
      update.phaseVolumeSurfaceStressSubmission?.entryPoints,
      SCHROEDER_PHASE_VOLUME_SURFACE_STRESS_ENTRY_POINTS
    );
  }

  assert.equal(await abandonSchroederFusedMechanicsPendingClosureAfter(
    fixture.device,
    result.pendingPostMechanicsClosure,
    { reason: new Error('Slice 9 surface-stress fixture cleanup') }
  ), true);
  assert.equal(await fixture.controller.completionPromise(), true);
  destroyMlsMpmMechanicsMaterialPhaseUpload(
    fixture.mechanicsMaterialPhaseUpload
  );
});

test('Slice 9 surface stress rejects missing authority before host submission', async () => {
  const fixture = productionM3Fixture({
    fineSubstepCount: 1,
    phaseVolumeInterfaceTransportEnabled: true,
    surfaceTensionEnabled: true
  });
  let probed = false;
  const { result } = await runProductionM3Fixture(fixture, {
    overrides: {
      gridUpdateRunner: async (options) => {
        if (!probed) {
          probed = true;
          for (const missingAuthority of [
            { mechanicsMaterialPhaseUpload: null },
            { schroederSpatialEpochTransaction: null }
          ]) {
            const before = {
              buffers: fixture.device.createdBuffers.length,
              submissions: fixture.device.submissions.length,
              passes: fixture.device.passTrace.length
            };
            await assert.rejects(
              runMlsMpmGridUpdateWebGpu({
                ...options,
                ...missingAuthority
              }),
              /Required (?:surface stress|phase-volume transport) lacks exact S9 authority or mechanics material records/
            );
            assert.deepEqual({
              buffers: fixture.device.createdBuffers.length,
              submissions: fixture.device.submissions.length,
              passes: fixture.device.passTrace.length
            }, before);
          }
        }
        return runMlsMpmGridUpdateWebGpu(options);
      }
    }
  });

  assert.equal(probed, true);
  assert.equal(await abandonSchroederFusedMechanicsPendingClosureAfter(
    fixture.device,
    result.pendingPostMechanicsClosure,
    { reason: new Error('Slice 9 surface-stress fail-fast fixture cleanup') }
  ), true);
  assert.equal(await fixture.controller.completionPromise(), true);
  destroyMlsMpmMechanicsMaterialPhaseUpload(
    fixture.mechanicsMaterialPhaseUpload
  );
});

test('Slice 9 transport fails before GPU work without its exact material upload', async () => {
  const fixture = productionM3Fixture({
    fineSubstepCount: 1,
    phaseVolumeInterfaceTransportEnabled: true
  });
  const counts = { p2g: 0, gridUpdate: 0, g2p: 0 };
  const submissionCount = fixture.device.submissions.length;
  await assert.rejects(
    runProductionM3Fixture(fixture, {
      counts,
      overrides: { mechanicsMaterialPhaseUpload: null }
    }),
    (error) => {
      assert.equal(
        error?.code,
        'ERR_SCHROEDER_PHASE_VOLUME_INTERFACE_TRANSPORT_AUTHORITY'
      );
      assert.deepEqual(
        error?.failedRequirements,
        ['mechanics-material-phase-upload-mismatch']
      );
      assert.equal(
        error?.authorityDiagnostics?.materialUpload?.matches,
        false
      );
      assert.equal(
        error?.authorityDiagnostics?.materialUpload?.bufferPresent,
        false
      );
      structuredClone(error.authorityDiagnostics);
      return true;
    }
  );
  assert.deepEqual(counts, { p2g: 0, gridUpdate: 0, g2p: 0 });
  assert.equal(fixture.device.submissions.length, submissionCount);
  await fixture.controller.abortAllAfter(
    new Error('Slice 9 fail-fast fixture cleanup'),
    { mechanicsRetirement: Promise.resolve(true) }
  );
  assert.equal(await fixture.controller.completionPromise(), true);
  destroyMlsMpmMechanicsMaterialPhaseUpload(
    fixture.mechanicsMaterialPhaseUpload
  );
});

test('M3 production controller preserves exact field identity for non-binary grid spacing', async () => {
  const baseGridSpacingM = 1.6 / 8;
  assert.notEqual(baseGridSpacingM, Math.fround(baseGridSpacingM));
  const fixture = productionM3Fixture({
    fineSubstepCount: 2,
    baseGridSpacingM
  });
  const { result, counts } = await runProductionM3Fixture(fixture);

  assert.deepEqual(counts, { p2g: 5, gridUpdate: 3, g2p: 3 });
  assert.equal(result.fineGridSpacingM, Math.fround(baseGridSpacingM));
  assert.equal(
    result.coarseGridSpacingM,
    Math.fround(Math.fround(baseGridSpacingM) * 2)
  );
  assert.equal(await abandonSchroederFusedMechanicsPendingClosureAfter(
    fixture.device,
    result.pendingPostMechanicsClosure,
    { reason: new Error('non-binary grid-spacing fixture cleanup') }
  ), true);
  assert.equal(await fixture.controller.completionPromise(), true);
});

test('M4 production controller publishes terminal S* exactly once through a fresh public E*', async () => {
  const fixture = productionM3Fixture({ fineSubstepCount: 1 });
  const { result } = await runProductionM3Fixture(fixture);
  const closure = result.pendingPostMechanicsClosure;
  const terminalContinuationStateBuffer =
    closure.terminalParticleContinuation.stateBuffer;
  const terminalContinuationMechanicsBuffer =
    closure.terminalParticleContinuation.mechanicsBuffer;
  assert.equal(validateSchroederFusedMechanicsPendingClosure(
    fixture.device,
    closure
  ), true);
  assert.equal(terminalContinuationStateBuffer.destroyed, false);
  assert.equal(terminalContinuationMechanicsBuffer.destroyed, false);

  const publicEpoch = await fixture.controller.refreshForPostMechanics({
    priorEpoch: closure.canonicalEpoch,
    currentSphParticleUpload: closure.finalSphParticleUpload,
    currentMlsMpmParticleUpload: closure.finalMlsMpmParticleUpload,
    enabledConsumerReaderIds: [],
    consumerSupportProfileIds: {}
  });
  assert.equal(publicEpoch.kind, 'post-mechanics');
  assert.equal(
    publicEpoch.sphParticleUpload.physicsTick,
    closure.finalSphParticleUpload.physicsTick + 1
  );
  assert.equal(publicEpoch.sphParticleUpload.physicsSubstep, 0);
  assert.equal(
    publicEpoch.levelAssignment.levelReclassificationPerformed,
    true
  );
  assert.equal(
    publicEpoch.levelAssignment.levelClassificationMode,
    'macro-boundary-full-reclassification'
  );
  assert.notEqual(
    publicEpoch.levelAssignment.assignmentBuffer,
    closure.canonicalEpoch.levelAssignment.assignmentBuffer
  );

  const publishedStateBuffer = tagWebGpuBufferDevice(
    fixture.device.createBuffer({
      label: 'm4-public-state',
      size: publicEpoch.sphParticleUpload.stateBufferByteLength,
      usage: 128
    }),
    fixture.device
  );
  const publishedMechanicsBuffer = tagWebGpuBufferDevice(
    fixture.device.createBuffer({
      label: 'm4-public-mechanics',
      size: publicEpoch.mlsMpmParticleUpload.mechanicsBufferByteLength,
      usage: 128
    }),
    fixture.device
  );
  const publishedUploads = Object.freeze({
    sphParticleUpload: Object.freeze({
      ...publicEpoch.sphParticleUpload,
      sourceStage: 'test-public-e-star-continuation',
      stateBuffer: publishedStateBuffer,
      ownsStateBuffer: true,
      ownsThermoBuffer:
        closure.finalSphParticleUpload.ownsThermoBuffer === true,
      ownsIdentityBuffer: false
    }),
    mlsMpmParticleUpload: Object.freeze({
      ...publicEpoch.mlsMpmParticleUpload,
      sourceStage: 'test-public-e-star-continuation',
      mechanicsBuffer: publishedMechanicsBuffer,
      ownsMechanicsBuffer: true
    })
  });
  const publicCommit = fixture.controller.commitPostMechanics(publicEpoch, {
    nextParticleUploads: publishedUploads,
    status: 'test-public-e-star-committed'
  });
  const publicationReceipt = publishSchroederFusedMechanicsPendingClosure(
    fixture.device,
    closure,
    {
      publicSpatialEpochTransaction: publicCommit.spatialEpochTransaction,
      publicCommitReceipt: publicCommit.commitReceipt,
      publicSphParticleUpload: publicEpoch.sphParticleUpload,
      publicMlsMpmParticleUpload: publicEpoch.mlsMpmParticleUpload,
      publishedSphParticleUpload: publishedUploads.sphParticleUpload,
      publishedMlsMpmParticleUpload: publishedUploads.mlsMpmParticleUpload
    }
  );
  assert.equal(validateSchroederFusedMechanicsPublicationReceipt(
    fixture.device,
    publicationReceipt,
    {
      closure,
      publicSpatialEpochTransaction: publicCommit.spatialEpochTransaction,
      publicCommitReceipt: publicCommit.commitReceipt
    }
  ), true);
  assert.equal(validateSchroederFusedMechanicsPublicationReceipt(
    fixture.device,
    { ...publicationReceipt }
  ), false);
  await assert.rejects(
    fixture.controller.refreshForPostMechanics({
      priorEpoch: closure.canonicalEpoch,
      currentSphParticleUpload: closure.finalSphParticleUpload,
      currentMlsMpmParticleUpload: closure.finalMlsMpmParticleUpload,
      enabledConsumerReaderIds: [],
      consumerSupportProfileIds: {}
    }),
    /single-use|replay/i
  );

  const controllerClose = fixture.controller.closeAfter({
    terminalPrivateEpoch: closure.canonicalEpoch,
    publicPostMechanicsEpoch: publicEpoch,
    publicationReceipt
  });
  const positiveCompletion =
    completeSchroederFusedMechanicsPendingClosureAfter(
      fixture.device,
      closure,
      { publicationReceipt, after: controllerClose }
    );
  assert.equal(await positiveCompletion, true);
  assert.equal(await closure.completionPromise, true);
  assert.equal(await fixture.controller.completionPromise(), true);
  assert.equal(closure.finalSphParticleUpload.stateBuffer.destroyed, true);
  assert.equal(
    closure.finalMlsMpmParticleUpload.mechanicsBuffer.destroyed,
    true
  );
  assert.equal(terminalContinuationStateBuffer.destroyed, true);
  assert.equal(terminalContinuationMechanicsBuffer.destroyed, true);
  assert.equal(publishedStateBuffer.destroyed, false);
  assert.equal(publishedMechanicsBuffer.destroyed, false);
  assert.equal(fixture.controller.summary().postMechanicsEpochCount, 1);
  assert.equal(fixture.controller.summary().publishedEpochCount, 1);
  assert.equal(fixture.generation.directRuntimeEntry.liveGenerations.length, 0);
});

test('M3 warmed shared-device r=1..4 matrix rotates depleted mechanics-field caches', async () => {
  const device = productionM3Device();
  const observedFieldPairRuntimes = new Set();
  let directEntry = null;
  for (let ratio = 1; ratio <= 4; ratio += 1) {
    const fixture = productionM3Fixture({
      fineSubstepCount: ratio,
      device
    });
    directEntry ??= fixture.generation.directRuntimeEntry;
    assert.equal(fixture.generation.directRuntimeEntry, directEntry);
    for (const runtime of directEntry.mechanicsFieldPairRuntimes.values()) {
      observedFieldPairRuntimes.add(runtime);
    }
    const { result } = await runProductionM3Fixture(fixture);
    assert.equal(validateSchroederFusedMechanicsPendingClosure(
      device,
      result.pendingPostMechanicsClosure
    ), true);
    for (const runtime of directEntry.mechanicsFieldPairRuntimes.values()) {
      observedFieldPairRuntimes.add(runtime);
    }
    assert.equal(await abandonSchroederFusedMechanicsPendingClosureAfter(
      device,
      result.pendingPostMechanicsClosure,
      { reason: new Error(`warmed shared-device M3 r=${ratio} cleanup`) }
    ), true);
    assert.equal(await fixture.controller.completionPromise(), true);
    assert.equal(directEntry.liveGenerations.length, 0);
    assert.equal(directEntry.mechanicsFieldPairDrainingRuntimes.size, 0);
    for (const runtime of directEntry.mechanicsFieldPairRuntimes.values()) {
      assert.equal(runtime.activeExecutionCount(), 0);
    }
  }
  assert.ok(
    observedFieldPairRuntimes.size
      > directEntry.mechanicsFieldPairRuntimes.size,
    'the warmed matrix must prove at least one depleted same-key rollover'
  );
  assert.equal(directEntry.mechanicsFieldPairRuntimes.size, 1);
});

test('M3 r=1 returns its pending closure with no normal host queue fence', async () => {
  const sharedFence = deferredPromise();
  const device = productionM3Device({
    fenceFactory: () => sharedFence.promise
  });
  const fixture = productionM3Fixture({ fineSubstepCount: 1, device });
  const counts = { p2g: 0, gridUpdate: 0, g2p: 0 };
  let lastProgress = 'not-started';
  const { result } = await settleBefore(
    runProductionM3Fixture(fixture, {
      counts,
      progress: (stage) => { lastProgress = stage; }
    }),
    750,
    () => 'M3 r=1 awaited a host queue fence before returning S*: '
      + JSON.stringify({ counts, lastProgress, fenceRequestCount: device.fenceRequestCount })
  );

  assert.equal(validateSchroederFusedMechanicsPendingClosure(
    device,
    result.pendingPostMechanicsClosure
  ), true);
  assert.equal(result.canonicalEpochControllerSummary.epochCount, 2);
  assert.equal(device.fenceRequestCount, 0);
  assert.equal(result.readbackTelemetryComplete, true);
  assert.equal(result.mapAsyncCount, 0);
  assert.equal(result.readbackBytes, 0);
  assert.equal(result.hostQueueFenceCount, 0);
  assert.equal(result.normalHotLoopReadbackFree, true);

  const abandonment = abandonSchroederFusedMechanicsPendingClosureAfter(
    device,
    result.pendingPostMechanicsClosure,
    { reason: new Error('M3 r=1 deferred-fence cleanup') }
  );
  sharedFence.resolve(true);
  assert.equal(await abandonment, true);
  assert.equal(await fixture.controller.completionPromise(), true);
});

test('M3 r=4 reuses terminal workspaces in same-device queue order without awaiting retirement fences', async () => {
  const sharedFence = deferredPromise();
  const device = productionM3Device({
    fenceFactory: () => sharedFence.promise
  });
  const fixture = productionM3Fixture({ fineSubstepCount: 4, device });
  const counts = { p2g: 0, gridUpdate: 0, g2p: 0 };
  let lastProgress = 'not-started';
  const { result } = await settleBefore(
    runProductionM3Fixture(fixture, {
      counts,
      progress: (stage) => { lastProgress = stage; }
    }),
    750,
    () => 'M3 r=4 awaited a retirement fence despite same-device queue ordering: '
      + JSON.stringify({
        counts,
        lastProgress,
        fenceRequestCount: device.fenceRequestCount
      })
  );
  assert.deepEqual(counts, { p2g: 9, gridUpdate: 5, g2p: 5 });
  assert.equal(validateSchroederFusedMechanicsPendingClosure(
    device,
    result.pendingPostMechanicsClosure
  ), true);
  assert.equal(result.readbackTelemetryComplete, true);
  assert.equal(result.mapAsyncCount, 0);
  assert.equal(result.readbackBytes, 0);
  assert.equal(result.hostQueueFenceCount, 0);
  assert.equal(result.normalHotLoopReadbackFree, true);
  sharedFence.resolve(true);
  assert.equal(await abandonSchroederFusedMechanicsPendingClosureAfter(
    device,
    result.pendingPostMechanicsClosure,
    { reason: new Error('M3 r=4 queue-ordered reuse cleanup') }
  ), true);
  assert.equal(await fixture.controller.completionPromise(), true);
});

test('M3 loss abandonment waits exact device evidence and terminalizes every owner without another queue fence', async () => {
  const deviceLoss = deferredPromise();
  const device = productionM3Device({
    fenceFactory: () => {
      throw new Error('M3 loss cleanup must not request a normal host queue fence');
    },
    lost: deviceLoss.promise
  });
  const fixture = productionM3Fixture({ fineSubstepCount: 1, device });
  const { result } = await settleBefore(
    runProductionM3Fixture(fixture),
    750,
    'M3 loss fixture did not return its pending S* before diagnostic fences'
  );
  const closure = result.pendingPostMechanicsClosure;
  assert.equal(validateSchroederFusedMechanicsPendingClosure(
    device,
    closure
  ), true);

  const fenceCountBeforeLoss = device.fenceRequestCount;
  assert.equal(fenceCountBeforeLoss, 0);
  assert.equal(result.hostQueueFenceCount, 0);
  let abandonmentSettled = false;
  const abandonment = abandonSchroederFusedMechanicsPendingClosureAfter(
    device,
    closure,
    {
      reason: new Error('simulated exact M3 device loss'),
      deviceLost: true
    }
  ).then((retired) => {
    abandonmentSettled = true;
    return retired;
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(abandonmentSettled, false);
  assert.equal(device.fenceRequestCount, fenceCountBeforeLoss);

  deviceLoss.resolve({ reason: 'destroyed', message: 'simulated GPU loss' });
  assert.equal(await settleBefore(
    abandonment,
    750,
    'M3 loss abandonment did not complete after exact device evidence'
  ), true);
  assert.equal(await closure.completionPromise, false);
  assert.equal(await closure.retirementPrerequisitePromise, true);
  assert.equal(await fixture.controller.completionPromise(), true);
  assert.match(fixture.controller.summary().status, /cleanup-complete$/);
  assert.equal(
    fixture.generation.runtime.ownsExecution(fixture.generation.execution),
    false
  );
  assert.equal(
    closure.canonicalEpoch.generation.runtime.ownsExecution(
      closure.canonicalEpoch.generation.execution
    ),
    false
  );
  assert.equal(device.fenceRequestCount, fenceCountBeforeLoss);
  assert.equal(
    closure.terminalSpatialEpochTransaction.state,
    'aborted'
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(
    closure.terminalSpatialEpochTransaction.state,
    'aborted'
  );
  assert.equal(await fixture.controller.completionPromise(), true);
  assert.ok(device.createdBuffers.some((buffer) => buffer.destroyCount === 1));
  assert.equal(
    device.createdBuffers.every((buffer) => buffer.destroyCount <= 1),
    true
  );
  for (const label of [
    'm3-source-state',
    'm3-source-thermo',
    'm3-source-identity',
    'm3-source-mechanics',
    'm3-source-assignment'
  ]) {
    assert.equal(
      device.createdBuffers.find((buffer) => buffer.label === label)
        ?.destroyCount,
      0,
      `${label} is borrowed and must survive loss quarantine`
    );
  }
});

test('M3 pre-S* failure recovery can supersede failed queue cleanup with exact device loss', async () => {
  const deviceLoss = deferredPromise();
  const staleNormalFence = deferredPromise();
  let useDeferredNormalFence = false;
  const device = productionM3Device({
    fenceFactory: () => useDeferredNormalFence
      ? staleNormalFence.promise
      : Promise.reject(new Error('simulated pre-S* queue retirement failure')),
    lost: deviceLoss.promise
  });
  const fixture = productionM3Fixture({ fineSubstepCount: 1, device });
  const originatingFailure = new Error('intentional M3 failure before S*');
  let capturedError = null;
  await assert.rejects(
    runProductionM3Fixture(fixture, {
      overrides: {
        gridUpdateRunner: async () => { throw originatingFailure; }
      }
    }),
    (error) => {
      capturedError = error;
      assert.equal(error, originatingFailure);
      assert.equal(typeof error.schroederCleanupRecovery, 'function');
      assert.ok(error.schroederCleanupCompletionPromise?.then);
      return true;
    }
  );

  useDeferredNormalFence = true;
  const fenceCountBeforeNormalRecovery = device.fenceRequestCount;
  const staleNormalRecovery = capturedError.schroederCleanupRecovery();
  staleNormalRecovery.catch(() => {});
  await settleBefore(
    (async () => {
      while (device.fenceRequestCount === fenceCountBeforeNormalRecovery) {
        await new Promise((resolve) => setImmediate(resolve));
      }
      return true;
    })(),
    750,
    'pre-S* normal cleanup retry did not install its queue fence'
  );
  const fenceCountBeforeLoss = device.fenceRequestCount;
  let recoverySettled = false;
  const recovery = capturedError.schroederCleanupRecovery({
    deviceLost: true
  }).then((retired) => {
    recoverySettled = true;
    return retired;
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(recoverySettled, false);
  assert.equal(device.fenceRequestCount, fenceCountBeforeLoss);

  deviceLoss.resolve({ reason: 'destroyed', message: 'pre-S* simulated loss' });
  assert.equal(await settleBefore(
    recovery,
    750,
    'pre-S* M3 loss recovery did not terminalize after device evidence'
  ), true);
  assert.equal(await capturedError.schroederCleanupCompletionPromise, true);
  assert.equal(await fixture.controller.completionPromise(), true);
  assert.equal(
    fixture.generation.runtime.ownsExecution(fixture.generation.execution),
    false
  );
  assert.equal(device.fenceRequestCount, fenceCountBeforeLoss);
  assert.equal(
    device.createdBuffers.every((buffer) => buffer.destroyCount <= 1),
    true
  );
  staleNormalFence.reject(
    new Error('stale pre-S* normal cleanup rejected after loss won')
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(await capturedError.schroederCleanupCompletionPromise, true);
  assert.equal(await fixture.controller.completionPromise(), true);
  assert.match(fixture.controller.summary().status, /cleanup-complete$/);
  for (const label of [
    'm3-source-state',
    'm3-source-thermo',
    'm3-source-identity',
    'm3-source-mechanics',
    'm3-source-assignment'
  ]) {
    assert.equal(
      device.createdBuffers.find((buffer) => buffer.label === label)
        ?.destroyCount,
      0
    );
  }
});

test('two-level cleanup retries after a synchronous queue-fence installation failure', async () => {
  const borrowed = {
    state: orchestrationBuffer('borrowed-state', 64),
    thermo: orchestrationBuffer('borrowed-thermo', 96),
    mechanics: orchestrationBuffer('borrowed-mechanics', 256)
  };
  const tracked = [];
  let fenceAttemptCount = 0;
  const device = {
    createBuffer({ label, size }) {
      return orchestrationBuffer(label, size);
    },
    queue: {
      writeBuffer() {},
      submit() {},
      onSubmittedWorkDone() {
        fenceAttemptCount += 1;
        if (fenceAttemptCount === 1) {
          throw new Error('synchronous-cleanup-fence-failure');
        }
        return Promise.resolve();
      }
    }
  };
  let ordinal = 0;
  const makeTracked = (prefix) => {
    const buffer = orchestrationBuffer(`${prefix}-${ordinal++}`);
    tracked.push(buffer);
    return buffer;
  };
  await assert.rejects(
    runSchroederTwoLevelMechanicsStepWebGpu({
      device,
      sphParticleState: {
        particleCount: 2,
        smoothingLengthM: 0.25,
        stateStrideBytes: 32,
        thermoStrideBytes: 48,
        step: 0,
        time: 0
      },
      mlsMpmParticleState: {
        particleCount: 2,
        mechanicsStrideBytes: 128,
        step: 0,
        time: 0
      },
      sphParticleUpload: {
        status: 'webgpu-uploaded',
        stateBuffer: borrowed.state,
        thermoBuffer: borrowed.thermo,
        identityRequired: false,
        slot: 0
      },
      mlsMpmParticleUpload: {
        status: 'webgpu-uploaded',
        mechanicsBuffer: borrowed.mechanics,
        slot: 0
      },
      levelAssignment: {},
      fineLevel: 0,
      baseGridSpacingM: 0.25,
      dt: 0.001,
      fineSubstepCount: 1,
      gridSpecFactory({ gridSpacingM }) {
        return gridSpacingM === 0.25
          ? { gridDims: [4, 4, 4], gridNodeCount: 64, shift: 1 }
          : { gridDims: [3, 3, 3], gridNodeCount: 27, shift: 1 };
      },
      async p2gRunner() {
        const gridBuffer = makeTracked('projection');
        return {
          gridBuffer,
          destroyGridBuffer() { gridBuffer.destroy(); }
        };
      },
      async gridUpdateRunner() {
        const updatedGridBuffer = makeTracked('update');
        return {
          updatedGridBuffer,
          destroyUpdatedGridBuffer() { updatedGridBuffer.destroy(); }
        };
      },
      async g2pRunner() {
        return {
          stateBuffer: makeTracked('state'),
          mechanicsBuffer: makeTracked('mechanics')
        };
      },
      momentumAccumulationRunner: async () => ({ status: 'accumulated' }),
      deltaProlongationRunner: async () => ({ status: 'prolonged' }),
      retainOutputParticleBuffers: false
    }),
    /synchronous-cleanup-fence-failure/
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(fenceAttemptCount, 2);
  assert.ok(tracked.length > 0);
  assert.deepEqual(tracked.map((buffer) => buffer.destroyCount),
    tracked.map(() => 1));
  assert.equal(borrowed.state.destroyCount, 0);
  assert.equal(borrowed.thermo.destroyCount, 0);
  assert.equal(borrowed.mechanics.destroyCount, 0);
});
