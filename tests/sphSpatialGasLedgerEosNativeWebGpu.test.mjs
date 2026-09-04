import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT,
  SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT,
  SPH_GPU_PARTICLE_STATE_ROW_LAYOUT,
  SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT,
  SPH_GPU_REACTION_PRODUCT_EVENT_ROW_LAYOUT,
  SPH_SPATIAL_GAS_CANDIDATE_AVOGADRO_PER_MOL,
  SPH_SPATIAL_GAS_CANDIDATE_ERROR,
  SPH_SPATIAL_GAS_CANDIDATE_PARTICLE_PRODUCT_TERM_SENTINEL,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  computeSphSpatialGasCandidateUnionCpuOracle
} from '../ulg-gpu-abi/src/index.js';
import {
  releaseSchroederSpatialEpochGenerationAfterQueue,
  runSchroederSpatialEpochGenerationWebGpu
} from '../src/runtime/sph/schroederSpatialEpochGpu.js';
import {
  SPH_SPATIAL_GAS_AUTHORITY_ERROR,
  SPH_SPATIAL_GAS_AUTHORITY_CONTROL_OFFSETS,
  SPH_SPATIAL_GAS_AUTHORITY_CONTROL_VERSION,
  SPH_SPATIAL_GAS_AUTHORITY_CONTROL_MAGIC,
  SPH_SPATIAL_GAS_AUTHORITY_STATUS,
  SPH_SPATIAL_GAS_DIAGNOSTICS_FULL_ORACLE,
  SPH_SPATIAL_GAS_LEDGER_EOS_ARENA_COUNT,
  SPH_SPATIAL_GAS_LEDGER_EOS_DIRECTORY_ABI,
  ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA,
  ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V3,
  ULG_SPH_RETAINED_SPATIAL_GAS_LEDGER_SOURCE_SCHEMA,
  ULG_SPH_RETAINED_SPATIAL_GAS_LEDGER_SOURCE_SCHEMA_V3,
  ULG_SPH_GAS_PRESSURE_MECHANICS_BINDING_SCHEMA,
  ULG_SPH_SPATIAL_GAS_LEDGER_EOS_EXECUTION_SCHEMA,
  ULG_SPH_SPATIAL_GAS_LEDGER_EOS_EXECUTION_SCHEMA_V3,
  abandonSphSpatialGasPressureAuthority,
  bindSphSpatialGasPressureMechanicsAuthority,
  createSphSpatialGasPressureMechanicsAuthorityBinding,
  describeSphSpatialGasPressureAuthority,
  destroySphSpatialGasLedgerEosGpu,
  encodeSphSpatialGasPressureAuthority,
  isExactSphSpatialGasPressureAuthoritySource,
  markSphSpatialGasPressureAuthoritySubmitted,
  observeSphSpatialGasLedgerEosOracle,
  quarantineSphSpatialGasPressureAuthorityAfterSubmitFailure,
  releaseSphSpatialGasLedgerEosAfterQueue,
  retireSphSpatialGasPressureAuthorityQueueOrdered,
  runSphSpatialGasLedgerEosRetainedWebGpu,
  sphSpatialGasPressureAuthorityQueueOrderedClaim,
  sphSpatialGasLedgerEosArenaStats,
  sphSpatialGasLedgerEosWgsl,
  sphSpatialGasLedgerProductEventAdapterWgsl
} from '../src/runtime/sph/sphSpatialGasLedgerEosGpu.js';
import {
  tagResidentProductMassDevice,
  tagWebGpuBufferDevice
} from '../src/runtime/sph/sphGpuDeviceIdentity.js';
import {
  SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_MAGIC,
  SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_PREFIX_BYTES,
  SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_STATUS_FAILED,
  SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_STATUS_READY,
  SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_VERSION,
  createResidentProductEventCountControlWords,
  registerResidentProductEventCountAuthority
} from '../src/runtime/sph/sphResidentProductHistoryGpu.js';
import {
  submitQueueOrderedFinalConsumerWork
} from '../src/runtime/webgpuComputeLayout.js';

const RUN_NATIVE =
  process.env.ULG_RUN_NATIVE_SPATIAL_GAS_LEDGER_EOS === '1';
const BASE_URL = process.env.ULG_SPATIAL_GAS_LEDGER_EOS_BASE_URL
  || 'https://127.0.0.1:5174/';
const CHROME = process.env.ULG_SPATIAL_GAS_LEDGER_EOS_CHROME
  || '/usr/bin/google-chrome';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => {
    resolve = done;
    reject = fail;
  });
  promise.catch(() => {});
  return { promise, resolve, reject };
}

function fakeEncoder(instrumentation) {
  const events = [];
  return {
    events,
    clearBuffer(buffer, offset = 0, size = null) {
      events.push({ kind: 'clear', buffer, offset, size });
    },
    copyBufferToBuffer(source, sourceOffset, destination, destinationOffset, size) {
      const event = {
        kind: 'copy',
        source,
        sourceOffset,
        destination,
        destinationOffset,
        size
      };
      events.push(event);
      const bytes = source._bytes instanceof Uint8Array
        ? source._bytes.slice(sourceOffset, sourceOffset + size)
        : new Uint8Array(size);
      event.bytes = bytes.slice();
      if (!(destination._bytes instanceof Uint8Array)) {
        destination._bytes = new Uint8Array(destination.size);
      }
      destination._bytes.set(bytes, destinationOffset);
    },
    beginComputePass(descriptor = {}) {
      const event = { kind: 'compute-pass', descriptor, commands: [] };
      events.push(event);
      let pipeline = null;
      let bindGroup = null;
      return {
        setPipeline(value) { pipeline = value; },
        setBindGroup(index, value) { bindGroup = { index, value }; },
        dispatchWorkgroups(x, y = 1, z = 1) {
          event.commands.push({ pipeline, bindGroup, dispatch: [x, y, z] });
        },
        dispatchWorkgroupsIndirect(buffer, byteOffset = 0) {
          event.commands.push({
            pipeline,
            bindGroup,
            dispatchIndirect: { buffer, byteOffset }
          });
        },
        end() { event.ended = true; }
      };
    },
    finish() {
      const commandBuffer = { kind: 'fake-command-buffer', events };
      instrumentation.commandBuffers.push(commandBuffer);
      return commandBuffer;
    }
  };
}

function fakeDevice() {
  const lost = deferred();
  const instrumentation = {
    buffers: [],
    bindGroups: [],
    pipelines: [],
    writes: [],
    submissions: [],
    commandBuffers: [],
    mapAsyncCount: 0,
    queueFenceCount: 0
  };
  const device = {
    lost: lost.promise,
    limits: {
      maxBufferSize: 512 * 1024 * 1024,
      maxStorageBufferBindingSize: 256 * 1024 * 1024,
      maxUniformBufferBindingSize: 64 * 1024,
      maxStorageBuffersPerShaderStage: 16,
      maxComputeWorkgroupsPerDimension: 65_535,
      minUniformBufferOffsetAlignment: 256
    },
    createBuffer(descriptor) {
      const buffer = {
        ...descriptor,
        _bytes: new Uint8Array(descriptor.size),
        destroyCount: 0,
        destroyed: false,
        async mapAsync() {
          instrumentation.mapAsyncCount += 1;
        },
        getMappedRange(offset = 0, size = this.size - offset) {
          return this._bytes.buffer.slice(offset, offset + size);
        },
        unmap() {},
        destroy() {
          this.destroyCount += 1;
          this.destroyed = true;
        }
      };
      instrumentation.buffers.push(buffer);
      return buffer;
    },
    createShaderModule(descriptor) { return descriptor; },
    createComputePipeline(descriptor) {
      const pipeline = {
        ...descriptor,
        getBindGroupLayout(index) {
          return { pipelineLabel: descriptor.label, index };
        }
      };
      instrumentation.pipelines.push(pipeline);
      return pipeline;
    },
    createBindGroup(descriptor) {
      instrumentation.bindGroups.push(descriptor);
      return descriptor;
    },
    createCommandEncoder() {
      return fakeEncoder(instrumentation);
    },
    queue: {
      writeBuffer(buffer, offset, data) {
        const bytes = ArrayBuffer.isView(data)
          ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
          : new Uint8Array(data);
        buffer._bytes.set(bytes, offset);
        instrumentation.writes.push({ buffer, offset, bytes: bytes.slice() });
      },
      submit(commandBuffers) {
        instrumentation.submissions.push(commandBuffers);
      },
      onSubmittedWorkDone() {
        instrumentation.queueFenceCount += 1;
        return Promise.resolve();
      }
    }
  };
  return { device, lost, instrumentation };
}

const retainedProductEventSourceBorrowStates = new WeakMap();

function retainedProductEventSource(
  device,
  rowCount = 4,
  { borrowCounterMode = 'accessor' } = {}
) {
  const productEventBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: `test-product-events-${rowCount}`,
    size: rowCount * 32 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128 | 4 | 8
  }), device);
  const source = {
    schema: 'peercompute.ulg.sph-resident-product-mass.v0',
    status: 'resident-product-mass-buffer-retained',
    productEventBuffer,
    productEventBufferRetained: true,
    productEventBufferByteLength: productEventBuffer.size,
    productEventRowCount: rowCount,
    productEventStrideFloats: 32,
    productEventDevice: device
  };
  if (borrowCounterMode === 'data') {
    Object.defineProperty(source, '__ulgActiveBorrowCount', {
      configurable: true,
      enumerable: false,
      writable: true,
      value: 0
    });
  } else {
    const borrowState = { activeBorrowCount: 0 };
    retainedProductEventSourceBorrowStates.set(source, borrowState);
    Object.defineProperty(source, '__ulgActiveBorrowCount', {
      configurable: borrowCounterMode === 'redefinable-accessor',
      enumerable: false,
      get() { return borrowState.activeBorrowCount; },
      set(value) {
        borrowState.activeBorrowCount = Math.max(0, Number(value) | 0);
      }
    });
  }
  return tagResidentProductMassDevice(source, device);
}

function epochIdentity(overrides = {}) {
  return {
    storageGeneration: 11,
    identityRevision: 'spatial-gas-ledger-fixture-identity',
    physicsTick: 13,
    physicsSubstep: 0,
    positionEpoch: 17,
    topologyEpoch: 19,
    chartEpoch: 23,
    levelEpoch: 29,
    supportEpoch: 31,
    ...overrides
  };
}

function retainedGasOccupancyFixture(device, {
  particleCount = 2,
  identity = epochIdentity(),
  gridSpacingM = 1
} = {}) {
  const taggedBuffer = (label, size) => tagWebGpuBufferDevice(
    device.createBuffer({ label, size, usage: 128 | 8 }),
    device
  );
  const assignmentBuffer = taggedBuffer(
    'test-gas-v3-level-assignment',
    particleCount * SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT.length
      * Float32Array.BYTES_PER_ELEMENT
  );
  const sourceStateBuffer = taggedBuffer(
    'test-gas-v3-source-state',
    particleCount * SPH_GPU_PARTICLE_STATE_ROW_LAYOUT.length
      * Float32Array.BYTES_PER_ELEMENT
  );
  const sourceThermoBuffer = taggedBuffer(
    'test-gas-v3-source-thermo',
    particleCount * SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT.length
      * Float32Array.BYTES_PER_ELEMENT
  );
  const sourceMechanicsBuffer = taggedBuffer(
    'test-gas-v3-source-mechanics-v0j',
    particleCount * MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length
      * Float32Array.BYTES_PER_ELEMENT
  );
  const particleIdentityBuffer = taggedBuffer(
    'test-gas-v3-source-identity',
    particleCount * Uint32Array.BYTES_PER_ELEMENT
  );
  const spatialGasGrid = Object.freeze({
    selectedLevel: 0,
    gridDims: Object.freeze([4, 4, 4]),
    gridNodeCount: 64,
    gridShift: 2,
    gridSpacingM: Math.fround(gridSpacingM)
  });
  const sphParticleUpload = {
    schema: ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
    status: 'webgpu-uploaded',
    particleCount,
    stateBuffer: sourceStateBuffer,
    stateBufferByteLength: sourceStateBuffer.size,
    stateStrideBytes: SPH_GPU_PARTICLE_STATE_ROW_LAYOUT.length
      * Float32Array.BYTES_PER_ELEMENT,
    thermoBuffer: sourceThermoBuffer,
    thermoBufferByteLength: sourceThermoBuffer.size,
    thermoStrideBytes: SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT.length
      * Float32Array.BYTES_PER_ELEMENT,
    identityBuffer: particleIdentityBuffer,
    identityBufferByteLength: particleIdentityBuffer.size,
    identityStrideBytes: Uint32Array.BYTES_PER_ELEMENT,
    ...identity
  };
  const mlsMpmParticleUpload = {
    schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
    status: 'webgpu-uploaded',
    particleCount,
    mechanicsBuffer: sourceMechanicsBuffer,
    mechanicsBufferByteLength: sourceMechanicsBuffer.size,
    mechanicsStrideBytes: MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length
      * Float32Array.BYTES_PER_ELEMENT,
    ...identity
  };
  const levelAssignment = {
    schema: 'peercompute.ulg.schroeder-level-assignment-execution.v0',
    status: 'schroeder-level-assignment-submitted',
    bufferFamilyGenerationStatus:
      'schroeder-particle-buffer-family-generation-ready',
    particleCount,
    assignmentStrideFloats: SCHROEDER_LEVEL_ASSIGNMENT_ROW_LAYOUT.length,
    assignmentBuffer,
    assignmentBufferByteLength: assignmentBuffer.size,
    sourceStateBuffer,
    sourceStateBufferBorrowed: true,
    sourceStateBufferByteLength: sourceStateBuffer.size,
    sourceThermoBuffer,
    sourceThermoBufferBorrowed: true,
    sourceThermoBufferByteLength: sourceThermoBuffer.size,
    sourceIdentityBuffer: particleIdentityBuffer,
    sourceIdentityBufferBorrowed: true,
    sourceIdentityBufferByteLength: particleIdentityBuffer.size,
    sourceMechanicsBuffer,
    sourceMechanicsBufferBorrowed: true,
    sourceMechanicsBufferByteLength: sourceMechanicsBuffer.size,
    ...identity,
    minLevel: 0,
    maxLevel: 0,
    chartId: 0,
    baseGridSpacingM: spatialGasGrid.gridSpacingM
  };
  const generation = runSchroederSpatialEpochGenerationWebGpu({
    device,
    levelAssignment,
    particleCount,
    particleIdentityBuffer,
    particleIdentityStrideWords: 1,
    selectedLevel: spatialGasGrid.selectedLevel,
    mechanicsGrid: spatialGasGrid,
    exactNearCellTreeEnabled: false
  });
  assert.equal(generation.ready, true, generation.reason);
  assert.ok(generation.mechanicsLevelViews[0].phaseVolumeMoment);
  return {
    generation,
    identity,
    levelAssignment,
    sphParticleUpload,
    mlsMpmParticleUpload,
    sourceStateBuffer,
    sourceThermoBuffer,
    sourceMechanicsBuffer,
    spatialGasGrid,
    boxMinM: [0, 0, 0],
    boxMaxM: spatialGasGrid.gridDims.map(
      (dimension) => dimension * spatialGasGrid.gridSpacingM
    )
  };
}

let activeNodeFixtureSerial = 0;

function retainedGasActiveNodeGenerationFixture(device, {
  particleCount = 4,
  identity = epochIdentity(),
  gridSpacingM = 1
} = {}) {
  const serial = ++activeNodeFixtureSerial;
  const activeNodeBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: `test-gas-active-node-source-${serial}`,
    size: particleCount * 16 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128 | 8
  }), device);
  const logicalCountBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: `test-gas-active-node-count-${serial}`,
    size: 128,
    usage: 128 | 4 | 8
  }), device);
  const logicalSourceCountAuthority = Object.freeze({
    schema: 'peercompute.ulg.schroeder-spatial-gpu-logical-count-source.v1',
    status: 'schroeder-spatial-gpu-logical-count-source-ready',
    ready: true,
    buffer: logicalCountBuffer,
    byteOffset: 0,
    sourceCapacity: particleCount,
    storageGeneration: identity.storageGeneration,
    executionGeneration: serial
  });
  const activeNodeList = {
    schema: 'peercompute.ulg.sph-spatial-gas-active-node-adapter.v2',
    status: 'sph-spatial-gas-active-node-adapter-submitted',
    spatialDirectorySourceSchema:
      'peercompute.ulg.schroeder-spatial-directory-active-node-source.v1',
    spatialDirectorySourceStatus: 'schroeder-spatial-directory-source-ready',
    spatialDirectorySourceReady: true,
    spatialEpochSourceSchema:
      'peercompute.ulg.sph-product-event-capacity-spatial-source.v1',
    spatialEpochSourceStatus: 'sph-product-event-capacity-spatial-source-ready',
    spatialEpochSourceReady: true,
    spatialEpochPositionAuthority: 'reaction-product-event-birth-position',
    spatialEpochLevelSpacingMode: 'uniform-gas-cell-size',
    spatialEpochBaseGridSpacingM: Math.fround(gridSpacingM),
    spatialEpochMinLevel: 0,
    spatialEpochMaxLevel: 0,
    spatialEpochChartId: 0,
    activeCandidateCount: particleCount,
    activeNodeCount: particleCount,
    activeNodeStrideFloats: 16,
    activeNodeBuffer,
    buffer: activeNodeBuffer,
    logicalSourceCountAuthority,
    logicalSourceCountGpuAuthored: true,
    spatialEpochStorageGeneration: identity.storageGeneration,
    spatialEpochPhysicsTick: identity.physicsTick,
    spatialEpochPhysicsSubstep: identity.physicsSubstep,
    spatialEpochPositionEpoch: identity.positionEpoch,
    spatialEpochTopologyEpoch: identity.topologyEpoch,
    spatialEpochChartEpoch: identity.chartEpoch,
    spatialEpochLevelEpoch: identity.levelEpoch,
    spatialEpochSupportEpoch: identity.supportEpoch,
    phaseVolumeAssignmentOverlayEnabled: false,
    sourceValidityAuthority:
      'stable-gpu-residual-compaction-with-authenticated-logical-prefix-count'
  };
  const generation = runSchroederSpatialEpochGenerationWebGpu({
    device,
    activeNodeList,
    particleCount,
    laneId: `test-gas-active-node-generation-${serial}`,
    sourceFamily: 'sph-reaction-product-event-capacity-gas-ledger',
    allowPhaseVolumeOverlay: false
  });
  assert.equal(generation.ready, true, generation.reason);
  return generation;
}

function retainedGasAuthorityArgs(fixture) {
  return {
    epochIdentity: fixture.identity,
    schroederSpatialEpochGeneration: fixture.generation,
    spatialGasGrid: fixture.spatialGasGrid,
    boxMinM: fixture.boxMinM,
    boxMaxM: fixture.boxMaxM,
    spatialGasCellSizeM: fixture.spatialGasGrid.gridSpacingM,
    spatialGasSupportVolumeFallbackM3: 0
  };
}

async function releaseOccupancyFixture(device, fixture) {
  assert.equal(
    releaseSchroederSpatialEpochGenerationAfterQueue(
      fixture.generation,
      device
    ),
    true
  );
  assert.equal(await fixture.generation.releasePromise, true);
}

function ledgerPrivateBuffers(result, instrumentation) {
  const slotLabel = `ulg-sph-spatial-gas-ledger-eos-${result.arenaCapacity}`
    + `-arena-${result.arenaIndex}`;
  const eosBindGroup = instrumentation.bindGroups
    .filter((descriptor) => (
      String(descriptor.label).startsWith(slotLabel)
      && String(descriptor.label).endsWith('-eos-aggregate-bind-group')
    ))
    .at(-1);
  const adapterBindGroup = instrumentation.bindGroups
    .filter((descriptor) => (
      descriptor.label === `${slotLabel}-adapter-scatter-bind-group`
    ))
    .at(-1);
  assert.ok(eosBindGroup, 'missing private EOS bind-group instrumentation');
  assert.ok(adapterBindGroup, 'missing private adapter bind-group instrumentation');
  const eosBuffer = (binding) => eosBindGroup.entries.find(
    (entry) => entry.binding === binding
  )?.resource?.buffer;
  const adapterBuffer = (binding) => adapterBindGroup.entries.find(
    (entry) => entry.binding === binding
  )?.resource?.buffer;
  return {
    compactRowsBuffer: eosBuffer(0),
    directoryBuffer: eosBuffer(1),
    gasPressureCellsBuffer: eosBuffer(2),
    paramsBuffer: eosBuffer(3),
    controlBuffer: eosBuffer(4),
    gasFreeVolumeBuffer: eosBuffer(5),
    gasFreeVolumeControlBuffer: eosBuffer(6),
    activeNodeBuffer: adapterBuffer(4),
    adapterParamsBuffer: adapterBuffer(6),
    particleStateBuffer: adapterBuffer(7),
    particleThermoBuffer: adapterBuffer(8)
  };
}

function reachableCreatedBuffers(roots, instrumentation) {
  const created = new Set(instrumentation.buffers);
  const seen = new Set();
  const found = new Set();
  const pending = [...roots];
  while (pending.length > 0) {
    const value = pending.pop();
    if (
      value == null
      || (typeof value !== 'object' && typeof value !== 'function')
      || seen.has(value)
    ) continue;
    seen.add(value);
    if (created.has(value)) found.add(value);
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor && Object.hasOwn(descriptor, 'value')) {
        pending.push(descriptor.value);
      }
    }
  }
  return [...found];
}

function reachableAuthorityFunctionPaths(roots) {
  const seen = new Set();
  const found = [];
  const pending = roots.map((value, index) => ({
    value,
    path: `root[${index}]`
  }));
  while (pending.length > 0) {
    const { value, path } = pending.pop();
    if (
      value == null
      || (typeof value !== 'object' && typeof value !== 'function')
      || seen.has(value)
    ) continue;
    seen.add(value);
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) continue;
      const child = descriptor.value;
      const childPath = `${path}.${String(key)}`;
      if (
        typeof child === 'function'
        && /allocation|bind|destroy|owner|release/i.test(String(key))
      ) {
        found.push(childPath);
      } else if (child && typeof child === 'object') {
        pending.push({ value: child, path: childPath });
      }
    }
  }
  return found;
}

function pressureConsumerFixture(device, instrumentation, result) {
  const publicBuffer = device.createBuffer({
    label: 'test-pressure-public-buffer',
    size: 64,
    usage: 128
  });
  const calls = [];
  const passEncoder = {
    setBindGroup(index, bindGroup) {
      calls.push({ index, bindGroup });
    }
  };
  const bindGroupLayout = { label: 'test-pressure-layout' };
  const publicEntries = [
    { binding: 0, resource: { buffer: publicBuffer } }
  ];
  const encode = (overrides = {}) => encodeSphSpatialGasPressureAuthority(
    result.retainedGasCellFieldSource,
    {
      device,
      passEncoder,
      bindGroupLayout,
      publicEntries,
      ...overrides
    }
  );
  return {
    calls,
    passEncoder,
    bindGroupLayout,
    publicBuffer,
    publicEntries,
    encode,
    instrumentation
  };
}

function pressureMechanicsAuthorityFixture(device, fixture) {
  const levelView = fixture.generation.mechanicsLevelViews.at(-1);
  const mechanicsFieldView = levelView.mechanicsFieldView;
  const phaseVolumeMoment = levelView.phaseVolumeMoment;
  const phaseVolumeReceipt = levelView.phaseVolumeReceipt;
  const scratchBuffer = device.createBuffer({
    label: 'test-pressure-mechanics-scratch',
    size: Math.max(4, mechanicsFieldView.fieldCapacity * 16),
    usage: 128 | 8
  });
  const paramsBuffer = device.createBuffer({
    label: 'test-pressure-mechanics-params',
    size: 256,
    usage: 64 | 8
  });
  const authority = Object.freeze({
    schema:
      'peercompute.ulg.schroeder-spatial-phase-volume-surface-stress-authority.v1',
    status:
      'schroeder-spatial-phase-volume-surface-stress-authority-ready',
    generation: fixture.generation,
    generationId: fixture.generation.execution.generationId,
    epochIdentity: Object.freeze({ ...fixture.identity }),
    selectedLevel: levelView.selectedLevel,
    fieldCapacity: phaseVolumeReceipt.fieldCapacity,
    mechanicsFieldView,
    mechanicsFieldViewBuffer: mechanicsFieldView.fieldViewBuffer,
    phaseVolumeMoment,
    phaseVolumeMomentControlBuffer: phaseVolumeMoment.controlBuffer,
    phaseVolumeMomentBuffer: phaseVolumeMoment.momentBuffer,
    phaseVolumeReceipt,
    phaseVolumeReceiptControlBuffer: phaseVolumeReceipt.controlBuffer,
    twoLevel: false
  });
  return {
    authority,
    publicEntries: [
      { binding: 0, resource: { buffer: mechanicsFieldView.fieldViewBuffer } },
      { binding: 1, resource: { buffer: phaseVolumeReceipt.controlBuffer } },
      { binding: 2, resource: { buffer: phaseVolumeMoment.momentBuffer } },
      { binding: 5, resource: { buffer: scratchBuffer } },
      { binding: 7, resource: { buffer: paramsBuffer } }
    ],
    scratchBuffer,
    paramsBuffer
  };
}

function seedFakeCompletedAuthority(result, instrumentation, {
  liveCount = 0,
  cellCount = 0,
  compactRows = null,
  pressureRows = null
} = {}) {
  const buffers = ledgerPrivateBuffers(result, instrumentation);
  const at = SPH_SPATIAL_GAS_AUTHORITY_CONTROL_OFFSETS;
  const control = new Uint32Array(32);
  control[at.MAGIC] = SPH_SPATIAL_GAS_AUTHORITY_CONTROL_MAGIC;
  control[at.VERSION] = SPH_SPATIAL_GAS_AUTHORITY_CONTROL_VERSION;
  control[at.STATUS_FLAGS] = SPH_SPATIAL_GAS_AUTHORITY_STATUS.INITIALIZED
    | SPH_SPATIAL_GAS_AUTHORITY_STATUS.COMPACT_READY
    | SPH_SPATIAL_GAS_AUTHORITY_STATUS.DIRECTORY_READY
    | SPH_SPATIAL_GAS_AUTHORITY_STATUS.EOS_READY
    | SPH_SPATIAL_GAS_AUTHORITY_STATUS.PRESSURE_READY
    | (liveCount === 0 ? SPH_SPATIAL_GAS_AUTHORITY_STATUS.EMPTY : 0);
  control[at.EXECUTION_GENERATION] = result.executionGeneration;
  control[at.COMPLETION_GENERATION] = result.executionGeneration;
  control[at.SOURCE_STORAGE_GENERATION] = result.storageGeneration;
  control[at.SOURCE_CAPACITY] = result.arenaCapacity;
  control[at.LIVE_RESIDUAL_COUNT] = liveCount;
  control[at.DIRECTORY_GENERATION] = result.spatialGenerationId;
  control[at.DIRECTORY_CELL_COUNT] = cellCount;
  control[at.READY_PRESSURE_COUNT] = cellCount;
  control[at.COMPACT_STRIDE] = 12;
  control[at.ACTIVE_NODE_STRIDE] = 16;
  control[at.PRESSURE_STRIDE] = 12;
  buffers.controlBuffer._bytes.set(new Uint8Array(control.buffer));

  const header = new Uint32Array(
    buffers.directoryBuffer._bytes.buffer,
    buffers.directoryBuffer._bytes.byteOffset,
    48
  );
  header[0] = 0x53534531;
  header[1] = 1;
  header[3] = result.spatialGenerationId;
  header[16] = liveCount;
  header[17] = result.arenaCapacity;
  header[18] = cellCount;
  header[37] = liveCount;
  header[38] = cellCount;
  if (compactRows) {
    buffers.compactRowsBuffer._bytes.set(
      new Uint8Array(compactRows.buffer, compactRows.byteOffset, compactRows.byteLength)
    );
  }
  if (pressureRows) {
    buffers.gasPressureCellsBuffer._bytes.set(
      new Uint8Array(pressureRows.buffer, pressureRows.byteOffset, pressureRows.byteLength)
    );
  }
}

function abiLane(layout, name) {
  const lane = layout.indexOf(`${name}:f32`);
  assert.notEqual(lane, -1, `missing ${name} in ABI layout`);
  return lane;
}

function setGasCandidateProductEvent(rows, rowIndex, {
  positionM = [0, 0, 0],
  massKg,
  placedMassKg = 0,
  unplacedMassKg = massKg,
  materialId = 9,
  productTermIndex = 0,
  moles,
  routingId = 1,
  temperatureK = 293.15,
  restDensityKgPerM3 = 1,
  status = 1
}) {
  const stride = SPH_GPU_REACTION_PRODUCT_EVENT_ROW_LAYOUT.length;
  const at = (name) => rowIndex * stride + abiLane(
    SPH_GPU_REACTION_PRODUCT_EVENT_ROW_LAYOUT,
    name
  );
  rows.set(positionM, at('positionXM'));
  rows[at('massKg')] = massKg;
  rows[at('materialId')] = materialId;
  rows[at('productTermIndex')] = productTermIndex;
  rows[at('moles')] = moles;
  rows[at('routingId')] = routingId;
  rows[at('placedMassKg')] = placedMassKg;
  rows[at('unplacedMassKg')] = unplacedMassKg;
  rows[at('temperatureK')] = temperatureK;
  rows[at('restDensityKgPerM3')] = restDensityKgPerM3;
  rows[at('status')] = status;
}

function setGasCandidateParticle(stateRows, thermoRows, rowIndex, {
  positionM = [0, 0, 0],
  massKg,
  materialId = 9,
  phaseId = 3,
  temperatureK = 293.15,
  restDensityKgPerM3 = 1,
  phaseFractions = [0, 0, 1, 0],
  representedEntityCount,
  status = 1
}) {
  const stateStride = SPH_GPU_PARTICLE_STATE_ROW_LAYOUT.length;
  const thermoStride = SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT.length;
  const stateAt = (name) => rowIndex * stateStride + abiLane(
    SPH_GPU_PARTICLE_STATE_ROW_LAYOUT,
    name
  );
  const thermoAt = (name) => rowIndex * thermoStride + abiLane(
    SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT,
    name
  );
  stateRows.set(positionM, stateAt('positionXM'));
  stateRows[stateAt('massKg')] = massKg;
  thermoRows[thermoAt('materialId')] = materialId;
  thermoRows[thermoAt('phaseId')] = phaseId;
  thermoRows[thermoAt('temperatureK')] = temperatureK;
  thermoRows[thermoAt('restDensityKgPerM3')] = restDensityKgPerM3;
  thermoRows.set(phaseFractions, thermoAt('phaseFractionSolid'));
  thermoRows[thermoAt('representedEntityCount')] = representedEntityCount;
  thermoRows[thermoAt('status')] = status;
}

test('CPU gas-candidate union preserves residual-only mass, source order, and exact provenance', () => {
  const productRows = new Float32Array(
    3 * SPH_GPU_REACTION_PRODUCT_EVENT_ROW_LAYOUT.length
  );
  setGasCandidateProductEvent(productRows, 0, {
    positionM: [0.25, 0.5, 0.75],
    massKg: 1.25,
    placedMassKg: 0.75,
    unplacedMassKg: 0.5,
    materialId: 17,
    productTermIndex: 7,
    moles: 10,
    temperatureK: 425,
    restDensityKgPerM3: 0.25
  });
  setGasCandidateProductEvent(productRows, 1, {
    massKg: 0.4,
    placedMassKg: 0.4,
    unplacedMassKg: 0,
    moles: 2
  });
  setGasCandidateProductEvent(productRows, 2, {
    massKg: 10,
    moles: 20,
    routingId: 2
  });

  const particleRows = 4;
  const stateRows = new Float32Array(
    particleRows * SPH_GPU_PARTICLE_STATE_ROW_LAYOUT.length
  );
  const thermoRows = new Float32Array(
    particleRows * SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT.length
  );
  setGasCandidateParticle(stateRows, thermoRows, 0, {
    positionM: [1.25, 0.5, 0.25],
    massKg: 0.25,
    materialId: 9,
    temperatureK: 350,
    restDensityKgPerM3: 0.5,
    representedEntityCount: Math.fround(
      2 * SPH_SPATIAL_GAS_CANDIDATE_AVOGADRO_PER_MOL
    )
  });
  setGasCandidateParticle(stateRows, thermoRows, 1, {
    massKg: 4,
    phaseId: 2,
    phaseFractions: [0, 1, 0, 0],
    restDensityKgPerM3: 1000,
    representedEntityCount: SPH_SPATIAL_GAS_CANDIDATE_AVOGADRO_PER_MOL
  });
  setGasCandidateParticle(stateRows, thermoRows, 2, {
    massKg: 0,
    status: 1,
    representedEntityCount: SPH_SPATIAL_GAS_CANDIDATE_AVOGADRO_PER_MOL
  });
  setGasCandidateParticle(stateRows, thermoRows, 3, {
    positionM: [2.25, 0.5, 0.25],
    massKg: 0.5,
    materialId: 31,
    temperatureK: 500,
    restDensityKgPerM3: 2,
    representedEntityCount: Math.fround(
      0.5 * SPH_SPATIAL_GAS_CANDIDATE_AVOGADRO_PER_MOL
    )
  });

  const oracle = computeSphSpatialGasCandidateUnionCpuOracle({
    productEventRows: productRows,
    particleStateRows: stateRows,
    particleThermoRows: thermoRows
  });

  assert.equal(oracle.admitted, true);
  assert.equal(oracle.failClosed, false);
  assert.equal(oracle.productEventSourceCount, 3);
  assert.equal(oracle.particleSourceCount, 4);
  assert.equal(oracle.productCandidateCount, 1);
  assert.equal(oracle.particleCandidateCount, 2);
  assert.equal(oracle.liveCount, 3);
  assert.equal(oracle.ignoredProductEventCount, 2);
  assert.equal(oracle.ignoredParticleCount, 2);
  assert.equal(oracle.totalMassKg, Math.fround(0.5 + 0.25 + 0.5));
  assert.deepEqual(
    oracle.rows.map((row) => [
      row.sourceKind,
      row.productTermIndex,
      row.sourceIndex,
      row.massKg
    ]),
    [
      ['product-event', 7, 0, 0.5],
      ['particle', SPH_SPATIAL_GAS_CANDIDATE_PARTICLE_PRODUCT_TERM_SENTINEL,
        0, 0.25],
      ['particle', SPH_SPATIAL_GAS_CANDIDATE_PARTICLE_PRODUCT_TERM_SENTINEL,
        3, 0.5]
    ]
  );
  assert.equal(oracle.rows[0].moles, Math.fround(4));
  assert.equal(oracle.rows[0].referenceVolumeM3, Math.fround(2));
  assert.ok(Math.abs(oracle.rows[1].moles - 2) < 2e-7);
  assert.equal(oracle.rows[1].referenceVolumeM3, Math.fround(0.5));
  assert.ok(Math.abs(oracle.rows[2].moles - 0.5) < 2e-7);
  assert.equal(oracle.rows[2].referenceVolumeM3, Math.fround(0.25));
  assert.equal(oracle.compactRows[8], 7);
  assert.equal(oracle.compactRows[9], 0);
  assert.equal(oracle.compactRows[12 + 8], -1);
  assert.equal(oracle.compactRows[12 + 9], 0);
  assert.equal(oracle.compactRows[24 + 8], -1);
  assert.equal(oracle.compactRows[24 + 9], 3);
});

test('CPU gas-candidate union fails closed on product conservation or impure gas declarations', () => {
  const validParticleState = new Float32Array(
    SPH_GPU_PARTICLE_STATE_ROW_LAYOUT.length
  );
  const validParticleThermo = new Float32Array(
    SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT.length
  );
  setGasCandidateParticle(validParticleState, validParticleThermo, 0, {
    massKg: 0.25,
    representedEntityCount: SPH_SPATIAL_GAS_CANDIDATE_AVOGADRO_PER_MOL
  });
  const invalidProductRows = new Float32Array(
    SPH_GPU_REACTION_PRODUCT_EVENT_ROW_LAYOUT.length
  );
  setGasCandidateProductEvent(invalidProductRows, 0, {
    massKg: 1,
    placedMassKg: 0.75,
    unplacedMassKg: 0.5,
    moles: 2
  });
  const productFailure = computeSphSpatialGasCandidateUnionCpuOracle({
    productEventRows: invalidProductRows,
    particleStateRows: validParticleState,
    particleThermoRows: validParticleThermo
  });
  assert.equal(productFailure.failClosed, true);
  assert.equal(productFailure.liveCount, 0);
  assert.equal(productFailure.totalMassKg, 0);
  assert.equal(productFailure.compactRows.length, 0);
  assert.equal(productFailure.productMassConservationErrorCount, 1);
  assert.equal(
    productFailure.errorFlags
      & SPH_SPATIAL_GAS_CANDIDATE_ERROR.PRODUCT_MASS_CONSERVATION,
    SPH_SPATIAL_GAS_CANDIDATE_ERROR.PRODUCT_MASS_CONSERVATION
  );

  const impureThermo = validParticleThermo.slice();
  impureThermo[abiLane(
    SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT,
    'phaseFractionLiquid'
  )] = 0.25;
  impureThermo[abiLane(
    SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT,
    'phaseFractionGas'
  )] = 0.75;
  const particleFailure = computeSphSpatialGasCandidateUnionCpuOracle({
    particleStateRows: validParticleState,
    particleThermoRows: impureThermo
  });
  assert.equal(particleFailure.failClosed, true);
  assert.equal(particleFailure.liveCount, 0);
  assert.equal(particleFailure.invalidParticleGasCount, 1);
  assert.equal(particleFailure.errors[0].sourceKind, 'particle');
  assert.equal(particleFailure.errors[0].sourceIndex, 0);
  assert.equal(
    particleFailure.errorFlags
      & SPH_SPATIAL_GAS_CANDIDATE_ERROR.INVALID_PARTICLE_GAS,
    SPH_SPATIAL_GAS_CANDIDATE_ERROR.INVALID_PARTICLE_GAS
  );
});

test('liquid-only particle input publishes a ready EMPTY retained gas authority', async () => {
  const particleState = new Float32Array(
    SPH_GPU_PARTICLE_STATE_ROW_LAYOUT.length
  );
  const particleThermo = new Float32Array(
    SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT.length
  );
  setGasCandidateParticle(particleState, particleThermo, 0, {
    positionM: [0.25, 0.25, 0.25],
    massKg: 1,
    materialId: 1,
    phaseId: 2,
    temperatureK: 293.15,
    restDensityKgPerM3: 1000,
    phaseFractions: [0, 1, 0, 0],
    representedEntityCount: 1,
    status: 1
  });
  const cpuOracle = computeSphSpatialGasCandidateUnionCpuOracle({
    particleStateRows: particleState,
    particleThermoRows: particleThermo
  });
  assert.equal(cpuOracle.admitted, true);
  assert.equal(cpuOracle.failClosed, false);
  assert.equal(cpuOracle.status, 'sph-spatial-gas-candidate-union-empty');
  assert.equal(cpuOracle.particleSourceCount, 1);
  assert.equal(cpuOracle.ignoredParticleCount, 1);
  assert.equal(cpuOracle.liveCount, 0);
  assert.equal(cpuOracle.errorCount, 0);
  assert.equal(cpuOracle.compactRows.length, 0);

  const { device, instrumentation } = fakeDevice();
  const occupancy = retainedGasOccupancyFixture(device, {
    particleCount: 1,
    gridSpacingM: 1
  });
  device.queue.writeBuffer(occupancy.sourceStateBuffer, 0, particleState);
  device.queue.writeBuffer(occupancy.sourceThermoBuffer, 0, particleThermo);
  const result = await runSphSpatialGasLedgerEosRetainedWebGpu({
    device,
    sphParticleUpload: occupancy.sphParticleUpload,
    mlsMpmParticleUpload: occupancy.mlsMpmParticleUpload,
    schroederLevelAssignment: occupancy.levelAssignment,
    ...retainedGasAuthorityArgs(occupancy)
  });

  assert.equal(result.ready, true, result.reason);
  assert.equal(result.sourceMode, 'particle-only');
  assert.equal(result.gasCandidateUnionCount, 1);
  assert.equal(result.arenaCapacity, 1);
  seedFakeCompletedAuthority(result, instrumentation, {
    liveCount: 0,
    cellCount: 0
  });
  const retainedOracle = await observeSphSpatialGasLedgerEosOracle(result);
  assert.equal(retainedOracle.empty, true);
  assert.equal(retainedOracle.liveGasCandidateCount, 0);
  assert.equal(retainedOracle.liveResidualCount, 0);
  assert.equal(retainedOracle.directoryCellCount, 0);
  assert.equal(retainedOracle.readyPressureCount, 0);
  assert.equal(retainedOracle.compactRows.length, 0);
  assert.equal(retainedOracle.pressureCells.length, 0);

  assert.equal(releaseSphSpatialGasLedgerEosAfterQueue(result), true);
  assert.equal(await result.releasePromise, true);
  await releaseOccupancyFixture(device, occupancy);
  assert.equal(destroySphSpatialGasLedgerEosGpu(device), true);
});

test('retained gas execution admits the capacity-one particle-only boundary and binds its live state/thermo row', async () => {
  const { device, instrumentation } = fakeDevice();
  const occupancy = retainedGasOccupancyFixture(device, {
    particleCount: 1,
    gridSpacingM: 0.5
  });
  const result = await runSphSpatialGasLedgerEosRetainedWebGpu({
    device,
    sphParticleUpload: occupancy.sphParticleUpload,
    mlsMpmParticleUpload: occupancy.mlsMpmParticleUpload,
    schroederLevelAssignment: occupancy.levelAssignment,
    ...retainedGasAuthorityArgs(occupancy)
  });

  assert.equal(result.ready, true, result.reason);
  assert.equal(result.sourceMode, 'particle-only');
  assert.equal(result.productEventRowCount, 0);
  assert.equal(result.productEventCandidateCapacity, 0);
  assert.equal(result.particleCount, 1);
  assert.equal(result.gasCandidateUnionCount, 1);
  assert.equal(result.arenaCapacity, 1);
  assert.equal(
    result.retainedSpatialGasLedgerSource.sourceFamily,
    'sph-particle-and-reaction-residual-gas-ledger'
  );
  assert.equal(
    result.retainedSpatialGasLedgerSource.positionAuthority,
    'particle-xn-or-reaction-product-event-birth-position'
  );
  const buffers = ledgerPrivateBuffers(result, instrumentation);
  assert.equal(buffers.particleStateBuffer, occupancy.sourceStateBuffer);
  assert.equal(buffers.particleThermoBuffer, occupancy.sourceThermoBuffer);
  const adapterParamsWrite = instrumentation.writes.find(
    (write) => write.buffer === buffers.adapterParamsBuffer
  );
  assert.ok(adapterParamsWrite);
  const words = new Uint32Array(
    adapterParamsWrite.bytes.buffer,
    adapterParamsWrite.bytes.byteOffset,
    32
  );
  assert.equal(words[25], 0, 'product source is disabled');
  assert.equal(words[26], 0, 'particle rows start at candidate zero');
  assert.equal(words[27], 1);
  assert.equal(words[28], SPH_GPU_PARTICLE_STATE_ROW_LAYOUT.length);
  assert.equal(words[29], SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT.length);
  assert.equal(words[30], 1);
  assert.equal(occupancy.sphParticleUpload.__ulgActiveBorrowCount, 1);
  assert.equal(releaseSphSpatialGasLedgerEosAfterQueue(result), true);
  assert.equal(await result.releasePromise, true);
  assert.equal(occupancy.sphParticleUpload.__ulgActiveBorrowCount, 0);
  await releaseOccupancyFixture(device, occupancy);
  assert.equal(destroySphSpatialGasLedgerEosGpu(device), true);
});

test('retained mixed gas union orders product capacity before exact particle rows without double-counting placed mass', async () => {
  const { device, instrumentation } = fakeDevice();
  const source = retainedProductEventSource(device, 2);
  const occupancy = retainedGasOccupancyFixture(device, {
    particleCount: 2,
    gridSpacingM: 0.5
  });
  const result = await runSphSpatialGasLedgerEosRetainedWebGpu({
    device,
    residentProductMass: source,
    sphParticleUpload: occupancy.sphParticleUpload,
    mlsMpmParticleUpload: occupancy.mlsMpmParticleUpload,
    schroederLevelAssignment: occupancy.levelAssignment,
    ...retainedGasAuthorityArgs(occupancy)
  });

  assert.equal(result.ready, true, result.reason);
  assert.equal(result.sourceMode, 'mixed');
  assert.equal(result.productEventRowCount, 2);
  assert.equal(result.productEventCandidateCapacity, 2);
  assert.equal(result.particleCount, 2);
  assert.equal(result.gasCandidateUnionCount, 4);
  assert.equal(
    result.retainedSpatialGasLedgerSource.gasCandidateUnionOrder,
    'unplaced-product-event-prefix-then-phase-pure-particle-prefix'
  );
  const buffers = ledgerPrivateBuffers(result, instrumentation);
  assert.equal(buffers.particleStateBuffer, occupancy.sourceStateBuffer);
  assert.equal(buffers.particleThermoBuffer, occupancy.sourceThermoBuffer);
  const adapterParamsWrite = instrumentation.writes.find(
    (write) => write.buffer === buffers.adapterParamsBuffer
  );
  assert.ok(adapterParamsWrite);
  const words = new Uint32Array(
    adapterParamsWrite.bytes.buffer,
    adapterParamsWrite.bytes.byteOffset,
    32
  );
  assert.equal(words[25], 1);
  assert.equal(words[26], 2);
  assert.equal(words[27], 2);
  assert.equal(words[30], 4);
  assert.equal(source.__ulgActiveBorrowCount, 1);
  assert.equal(occupancy.sphParticleUpload.__ulgActiveBorrowCount, 1);
  assert.equal(releaseSphSpatialGasLedgerEosAfterQueue(result), true);
  assert.equal(await result.releasePromise, true);
  assert.equal(source.__ulgActiveBorrowCount, 0);
  assert.equal(occupancy.sphParticleUpload.__ulgActiveBorrowCount, 0);
  await releaseOccupancyFixture(device, occupancy);
  assert.equal(destroySphSpatialGasLedgerEosGpu(device), true);
});

test('retained gas union rejects same- and cross-family source buffer aliases before borrowing', async () => {
  const { device } = fakeDevice();
  const occupancy = retainedGasOccupancyFixture(device, {
    particleCount: 4,
    gridSpacingM: 0.5
  });
  occupancy.sphParticleUpload.thermoBuffer = occupancy.sourceStateBuffer;
  const sameFamilyAlias = await runSphSpatialGasLedgerEosRetainedWebGpu({
    device,
    sphParticleUpload: occupancy.sphParticleUpload,
    mlsMpmParticleUpload: occupancy.mlsMpmParticleUpload,
    schroederLevelAssignment: occupancy.levelAssignment,
    ...retainedGasAuthorityArgs(occupancy)
  });
  assert.equal(
    sameFamilyAlias.status,
    'spatial-gas-ledger-eos-rejected-particle-buffer-alias'
  );

  occupancy.sphParticleUpload.thermoBuffer = occupancy.sourceThermoBuffer;
  const productSource = retainedProductEventSource(device, 1);
  productSource.productEventBuffer = occupancy.sourceStateBuffer;
  productSource.productEventBufferByteLength = occupancy.sourceStateBuffer.size;
  const crossFamilyAlias = await runSphSpatialGasLedgerEosRetainedWebGpu({
    device,
    residentProductMass: productSource,
    sphParticleUpload: occupancy.sphParticleUpload,
    mlsMpmParticleUpload: occupancy.mlsMpmParticleUpload,
    schroederLevelAssignment: occupancy.levelAssignment,
    ...retainedGasAuthorityArgs(occupancy)
  });
  assert.equal(
    crossFamilyAlias.status,
    'spatial-gas-ledger-eos-rejected-cross-family-buffer-alias'
  );
  assert.equal(productSource.__ulgActiveBorrowCount, 0);
  assert.equal(
    occupancy.sphParticleUpload.__ulgActiveBorrowCount ?? 0,
    0
  );
  await releaseOccupancyFixture(device, occupancy);
  assert.equal(
    destroySphSpatialGasLedgerEosGpu(device),
    false,
    'alias rejection occurs before a retained gas arena is allocated'
  );
});

test('opaque retained gas ownership supports non-extensible GPUBuffers without public destroy patching', async () => {
  const { device, instrumentation } = fakeDevice();
  const createBuffer = device.createBuffer.bind(device);
  device.createBuffer = (descriptor) => {
    const buffer = createBuffer(descriptor);
    Object.preventExtensions(buffer);
    return buffer;
  };
  const source = retainedProductEventSource(device, 2);
  const occupancy = retainedGasOccupancyFixture(device, {
    particleCount: 2,
    gridSpacingM: 1
  });
  const result = await runSphSpatialGasLedgerEosRetainedWebGpu({
    device,
    residentProductMass: source,
    ...retainedGasAuthorityArgs(occupancy)
  });

  assert.equal(result.ready, true, result.reason);
  const privatePressureBuffer = instrumentation.buffers.find(
    (buffer) => String(buffer.label).endsWith('-gas-pressure-cells')
  );
  assert.ok(privatePressureBuffer);
  assert.equal(Object.isExtensible(privatePressureBuffer), false);
  assert.equal(
    Object.hasOwn(privatePressureBuffer, 'destroy'),
    true,
    'the fake host method remains its original own method'
  );
  assert.equal(
    privatePressureBuffer.destroyCount,
    0,
    'the owner never patches or invokes the live private buffer destroy target'
  );
  assert.deepEqual(
    reachableCreatedBuffers([
      result,
      result.retainedSpatialGasLedgerSource,
      result.retainedGasCellFieldSource
    ], instrumentation),
    []
  );
  assert.equal(releaseSphSpatialGasLedgerEosAfterQueue(result), true);
  assert.equal(await result.releasePromise, true);
  await releaseOccupancyFixture(device, occupancy);
  assert.equal(destroySphSpatialGasLedgerEosGpu(device), true);
});

test('exact v4 mechanics binding privately installs pressure, gas directory, and control for repeated transactional passes', async () => {
  const { device, instrumentation } = fakeDevice();
  const source = retainedProductEventSource(device, 2);
  const occupancy = retainedGasOccupancyFixture(device, {
    particleCount: 2,
    gridSpacingM: 1
  });
  const result = await runSphSpatialGasLedgerEosRetainedWebGpu({
    device,
    residentProductMass: source,
    ...retainedGasAuthorityArgs(occupancy)
  });
  assert.equal(result.ready, true, result.reason);
  const privateBuffers = ledgerPrivateBuffers(result, instrumentation);
  const mechanics = pressureMechanicsAuthorityFixture(device, occupancy);
  const bindGroupLayout = { label: 'test-pressure-mechanics-layout' };

  assert.throws(
    () => createSphSpatialGasPressureMechanicsAuthorityBinding(
      result.retainedGasCellFieldSource,
      {
        device,
        bindGroupLayout,
        publicEntries: mechanics.publicEntries,
        phaseVolumeAuthority: mechanics.authority,
        chartId: 1
      }
    ),
    { code: 'ERR_SPH_GAS_PRESSURE_MECHANICS_AUTHORITY_ADMISSION' }
  );
  assert.equal(result.gasPressureAuthorityConsumerBorrowed, false);

  for (const resourceSlice of [
    { binding: 0, property: 'offset', value: 0 },
    {
      binding: 5,
      property: 'size',
      value: mechanics.scratchBuffer.size
    }
  ]) {
    const slicedEntries = mechanics.publicEntries.map((entry) => (
      entry.binding === resourceSlice.binding
        ? {
            binding: entry.binding,
            resource: {
              ...entry.resource,
              [resourceSlice.property]: resourceSlice.value
            }
          }
        : entry
    ));
    assert.throws(
      () => createSphSpatialGasPressureMechanicsAuthorityBinding(
        result.retainedGasCellFieldSource,
        {
          device,
          bindGroupLayout,
          publicEntries: slicedEntries,
          phaseVolumeAuthority: mechanics.authority,
          chartId: 0
        }
      ),
      { code: 'ERR_SPH_GAS_PRESSURE_MECHANICS_AUTHORITY_ADMISSION' }
    );
    assert.equal(result.gasPressureAuthorityConsumerBorrowed, false);
  }

  const binding = createSphSpatialGasPressureMechanicsAuthorityBinding(
    result.retainedGasCellFieldSource,
    {
      device,
      bindGroupLayout,
      publicEntries: mechanics.publicEntries,
      phaseVolumeAuthority: mechanics.authority,
      chartId: 0
    }
  );
  assert.equal(binding.schema, ULG_SPH_GAS_PRESSURE_MECHANICS_BINDING_SCHEMA);
  assert.equal(binding.receipt.consumerKind,
    'schroeder-spatial-gas-pressure-boundary');
  assert.equal(binding.executionGeneration, result.executionGeneration);
  assert.equal(binding.storageGeneration, occupancy.identity.storageGeneration);
  assert.equal(binding.fieldCapacity, mechanics.authority.fieldCapacity);
  assert.deepEqual(binding.gasGridDims, occupancy.spatialGasGrid.gridDims);
  assert.equal(binding.gasGridSpacingM, occupancy.spatialGasGrid.gridSpacingM);
  assert.equal(binding.gasDirectory.generationId, result.spatialGenerationId);
  assert.equal(binding.gasDirectory.cellCapacity, result.arenaCapacity);
  assert.deepEqual(reachableCreatedBuffers([binding], instrumentation), []);

  const privateBindGroupDescriptor = instrumentation.bindGroups.find(
    (descriptor) => descriptor.label
      === `ulg-sph-gas-pressure-mechanics-${result.executionGeneration}`
  );
  assert.ok(privateBindGroupDescriptor);
  const privateEntry = (index) => privateBindGroupDescriptor.entries.find(
    ({ binding: entryBinding }) => entryBinding === index
  )?.resource?.buffer;
  assert.equal(privateEntry(3), privateBuffers.gasPressureCellsBuffer);
  assert.equal(privateEntry(4), privateBuffers.directoryBuffer);
  assert.equal(privateEntry(6), privateBuffers.controlBuffer);

  const passCalls = [];
  for (const stage of ['initialize', 'commit']) {
    assert.equal(bindSphSpatialGasPressureMechanicsAuthority(binding, {
      device,
      passEncoder: {
        setBindGroup(index, bindGroup) {
          passCalls.push({ stage, index, bindGroup });
        }
      }
    }), true);
  }
  assert.equal(passCalls.length, 2);
  assert.equal(passCalls[0].bindGroup, passCalls[1].bindGroup);
  assert.throws(
    () => pressureConsumerFixture(device, instrumentation, result).encode(),
    { code: 'ERR_SPH_GAS_PRESSURE_AUTHORITY_BORROWED' }
  );

  const producerClaim = sphSpatialGasPressureAuthorityQueueOrderedClaim(
    binding.receipt,
    device
  );
  const finalConsumerOwner = Object.freeze({
    status: 'test-pressure-mechanics-useful-submit-owner'
  });
  const capability = submitQueueOrderedFinalConsumerWork(
    device,
    [device.createCommandEncoder().finish()],
    {
      finalConsumerOwner,
      producerClaims: [producerClaim]
    }
  );
  assert.equal(retireSphSpatialGasPressureAuthorityQueueOrdered(
    binding.receipt,
    device,
    capability
  ), true);
  assert.throws(
    () => bindSphSpatialGasPressureMechanicsAuthority(binding, {
      device,
      passEncoder: { setBindGroup() {} }
    }),
    { code: 'ERR_SPH_GAS_PRESSURE_MECHANICS_AUTHORITY_BINDING_INVALID' }
  );
  assert.equal(result.released, true);
  assert.equal(
    occupancy.generation.execution.released,
    false,
    'mechanics is an intermediate source-generation consumer; G2P still owns the live generation'
  );
  assert.equal(instrumentation.mapAsyncCount, 0);
  assert.equal(instrumentation.queueFenceCount, 0);
  await releaseOccupancyFixture(device, occupancy);
  assert.equal(destroySphSpatialGasLedgerEosGpu(device), true);
});

test('exact v4 mechanics submit failure quarantines instead of reopening the single-consumer slot', async () => {
  const { device, lost, instrumentation } = fakeDevice();
  const source = retainedProductEventSource(device, 2);
  const occupancy = retainedGasOccupancyFixture(device, {
    particleCount: 2,
    gridSpacingM: 1
  });
  const result = await runSphSpatialGasLedgerEosRetainedWebGpu({
    device,
    residentProductMass: source,
    ...retainedGasAuthorityArgs(occupancy)
  });
  assert.equal(result.ready, true, result.reason);
  const mechanics = pressureMechanicsAuthorityFixture(device, occupancy);
  const binding = createSphSpatialGasPressureMechanicsAuthorityBinding(
    result.retainedGasCellFieldSource,
    {
      device,
      bindGroupLayout: { label: 'test-pressure-mechanics-failure-layout' },
      publicEntries: mechanics.publicEntries,
      phaseVolumeAuthority: mechanics.authority,
      chartId: 0
    }
  );
  assert.equal(bindSphSpatialGasPressureMechanicsAuthority(binding, {
    device,
    passEncoder: { setBindGroup() {} }
  }), true);
  assert.equal(quarantineSphSpatialGasPressureAuthorityAfterSubmitFailure(
    binding.receipt,
    device,
    'synthetic queue.submit failure'
  ), true);
  assert.equal(quarantineSphSpatialGasPressureAuthorityAfterSubmitFailure(
    binding.receipt,
    device
  ), false);
  const observation = describeSphSpatialGasPressureAuthority(
    result.retainedGasCellFieldSource,
    { device }
  );
  assert.equal(observation.terminalObserved, true);
  assert.equal(observation.releasedObserved, false);
  assert.equal(observation.consumerBorrowedObserved, false);
  assert.equal(observation.consumerSubmittedObserved, true);
  assert.equal(releaseSphSpatialGasLedgerEosAfterQueue(result), false);
  assert.throws(
    () => pressureConsumerFixture(device, instrumentation, result).encode(),
    { code: 'ERR_SPH_GAS_PRESSURE_AUTHORITY_TERMINAL' }
  );
  lost.resolve({ reason: 'synthetic device loss after submit failure' });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(source.__ulgActiveBorrowCount, 0);
});

test('exact v4 pressure claim retires the complete owned graph on its useful queue submit without a host fence', async () => {
  const { device, instrumentation } = fakeDevice();
  const originalQueueFence = device.queue.onSubmittedWorkDone;
  device.queue.onSubmittedWorkDone = () => {
    instrumentation.queueFenceCount += 1;
    return new Promise(() => {});
  };
  const source = retainedProductEventSource(device, 2, {
    borrowCounterMode: 'redefinable-accessor'
  });
  const occupancy = retainedGasOccupancyFixture(device, {
    particleCount: 2,
    gridSpacingM: 1
  });
  const result = await runSphSpatialGasLedgerEosRetainedWebGpu({
    device,
    residentProductMass: source,
    ...retainedGasAuthorityArgs(occupancy)
  });
  assert.equal(result.ready, true, result.reason);
  assert.equal(source.__ulgActiveBorrowCount, 1);
  Object.defineProperty(source, '__ulgActiveBorrowCount', {
    configurable: false,
    enumerable: false,
    writable: false,
    value: 1
  });
  Object.freeze(source);
  const binding = pressureConsumerFixture(
    device,
    instrumentation,
    result
  ).encode();
  assert.throws(
    () => sphSpatialGasPressureAuthorityQueueOrderedClaim(
      { ...binding.receipt },
      device
    ),
    { code: 'ERR_SPH_GAS_PRESSURE_AUTHORITY_RECEIPT_INVALID' }
  );
  assert.throws(
    () => sphSpatialGasPressureAuthorityQueueOrderedClaim(
      binding.receipt,
      fakeDevice().device
    ),
    { code: 'ERR_SPH_GAS_PRESSURE_AUTHORITY_RECEIPT_INVALID' }
  );
  const producerClaim = sphSpatialGasPressureAuthorityQueueOrderedClaim(
    binding.receipt,
    device
  );
  const finalConsumerOwner = Object.freeze({
    status: 'test-pressure-useful-submit-owner'
  });
  const capability = submitQueueOrderedFinalConsumerWork(
    device,
    [device.createCommandEncoder().finish()],
    {
      finalConsumerOwner,
      producerClaims: [producerClaim]
    }
  );

  assert.equal(
    retireSphSpatialGasPressureAuthorityQueueOrdered(
      binding.receipt,
      device,
      capability
    ),
    true
  );
  assert.equal(instrumentation.queueFenceCount, 0);
  assert.equal(releaseSphSpatialGasLedgerEosAfterQueue(result), false);
  const retiredObservation = describeSphSpatialGasPressureAuthority(
    result.retainedGasCellFieldSource,
    { device }
  );
  assert.equal(retiredObservation.releasedObserved, true);
  assert.equal(retiredObservation.sourceBorrowReleasedObserved, true);
  assert.equal(retiredObservation.sourceBorrowPrivateActiveCountObserved, 0);
  assert.equal(
    retiredObservation.queueOrderedRetirementOperationResults.every(
      ({ confirmed }) => confirmed === true
    ),
    true
  );
  assert.equal(
    source.__ulgActiveBorrowCount,
    1,
    'the frozen public data counter is stale telemetry, not private ownership'
  );
  assert.equal(
    retainedProductEventSourceBorrowStates.get(source).activeBorrowCount,
    0,
    'the captured accessor still reaches the source owner after redefinition'
  );
  assert.equal(occupancy.generation.execution.released, true);
  assert.equal(
    retireSphSpatialGasPressureAuthorityQueueOrdered(
      binding.receipt,
      device,
      capability
    ),
    false
  );

  device.queue.onSubmittedWorkDone = originalQueueFence;
  const successorSource = retainedProductEventSource(device, 2);
  const successorOccupancy = retainedGasOccupancyFixture(device, {
    particleCount: 2,
    identity: epochIdentity({
      physicsSubstep: occupancy.identity.physicsSubstep + 1,
      positionEpoch: occupancy.identity.positionEpoch + 1
    }),
    gridSpacingM: 1
  });
  const fenceCountBeforeSuccessor = instrumentation.queueFenceCount;
  const successor = await runSphSpatialGasLedgerEosRetainedWebGpu({
    device,
    residentProductMass: successorSource,
    ...retainedGasAuthorityArgs(successorOccupancy)
  });
  assert.equal(successor.ready, true, successor.reason);
  assert.equal(successor.arenaIndex, result.arenaIndex);
  assert.ok(successor.arenaBufferReuseCount >= 1);
  assert.equal(successor.arenaBackpressureWaitCount, 0);
  assert.equal(
    instrumentation.queueFenceCount,
    fenceCountBeforeSuccessor,
    'queue-ordered retirement must make every child arena immediately reusable'
  );
  assert.equal(releaseSphSpatialGasLedgerEosAfterQueue(successor), true);
  assert.equal(await successor.releasePromise, true);
  await releaseOccupancyFixture(device, successorOccupancy);
  assert.equal(destroySphSpatialGasLedgerEosGpu(device), true);
});

test('retained gas arena construction rolls back tag, buffer, scan, and prior-slot allocations exactly once', async () => {
  {
    const { device, instrumentation } = fakeDevice();
    const source = retainedProductEventSource(device, 2);
    const occupancy = retainedGasOccupancyFixture(device, {
      particleCount: 2,
      gridSpacingM: 1
    });
    const createBuffer = device.createBuffer.bind(device);
    const targetLabel =
      'ulg-sph-spatial-gas-ledger-eos-2-arena-0-candidate-flags';
    let rawTarget = null;
    device.createBuffer = (descriptor) => {
      const rawBuffer = createBuffer(descriptor);
      if (descriptor?.label !== targetLabel) return rawBuffer;
      rawTarget = rawBuffer;
      return new Proxy(rawBuffer, {
        get(target, key, receiver) {
          if (key === Symbol.for('peercompute.ulg.webgpu.device')) {
            throw new Error('synthetic provenance tag inspection failure');
          }
          return Reflect.get(target, key, receiver);
        }
      });
    };
    const result = await runSphSpatialGasLedgerEosRetainedWebGpu({
      device,
      residentProductMass: source,
      ...retainedGasAuthorityArgs(occupancy)
    });
    assert.equal(result.ready, false);
    assert.equal(result.status, 'spatial-gas-ledger-eos-rejected-arena');
    assert.match(result.reason, /synthetic provenance tag inspection failure/);
    assert.ok(rawTarget);
    assert.equal(rawTarget.destroyCount, 1);
    assert.equal(source.__ulgActiveBorrowCount, 0);
    assert.equal(sphSpatialGasLedgerEosArenaStats(device).runtimeCount, 0);
    await releaseOccupancyFixture(device, occupancy);
  }

  {
    const { device, instrumentation } = fakeDevice();
    const source = retainedProductEventSource(device, 2);
    const occupancy = retainedGasOccupancyFixture(device, {
      particleCount: 2,
      gridSpacingM: 1
    });
    const baselineBufferCount = instrumentation.buffers.length;
    const createBuffer = device.createBuffer.bind(device);
    const prefix = 'ulg-sph-spatial-gas-ledger-eos-2-arena-';
    const targetLabel = `${prefix}2-gas-pressure-cells`;
    device.createBuffer = (descriptor) => {
      if (descriptor?.label === targetLabel) {
        throw new Error('synthetic third-slot createBuffer failure');
      }
      const buffer = createBuffer(descriptor);
      if (String(descriptor?.label).startsWith(prefix)) {
        const destroy = buffer.destroy.bind(buffer);
        buffer.destroy = () => {
          destroy();
          throw new Error(`synthetic destroy failure: ${descriptor.label}`);
        };
      }
      return buffer;
    };
    const result = await runSphSpatialGasLedgerEosRetainedWebGpu({
      device,
      residentProductMass: source,
      ...retainedGasAuthorityArgs(occupancy)
    });
    assert.equal(result.ready, false);
    assert.equal(result.status, 'spatial-gas-ledger-eos-rejected-arena');
    assert.match(result.reason, /synthetic third-slot createBuffer failure/);
    const arenaBuffers = instrumentation.buffers
      .slice(baselineBufferCount)
      .filter((buffer) => String(buffer.label).startsWith(prefix));
    assert.ok(arenaBuffers.length > 14, 'prior slots and scans were allocated');
    for (const buffer of arenaBuffers) {
      assert.equal(
        buffer.destroyCount,
        1,
        `${buffer.label} must receive one rollback destroy attempt`
      );
    }
    assert.equal(source.__ulgActiveBorrowCount, 0);
    assert.equal(sphSpatialGasLedgerEosArenaStats(device).runtimeCount, 0);
    await releaseOccupancyFixture(device, occupancy);
  }
});

test('a synchronously lost device cannot publish a terminal retained gas runtime', async () => {
  const { device, instrumentation } = fakeDevice();
  const source = retainedProductEventSource(device, 2);
  const occupancy = retainedGasOccupancyFixture(device, {
    particleCount: 2,
    gridSpacingM: 1
  });
  const baselineBufferCount = instrumentation.buffers.length;
  const originalLost = device.lost;
  device.lost = {
    then(onFulfilled) {
      onFulfilled({ reason: 'destroyed', message: 'synthetic synchronous loss' });
      return Promise.resolve();
    }
  };
  const result = await runSphSpatialGasLedgerEosRetainedWebGpu({
    device,
    residentProductMass: source,
    ...retainedGasAuthorityArgs(occupancy)
  });
  assert.equal(result.ready, false);
  assert.equal(result.status, 'spatial-gas-ledger-eos-rejected-arena');
  assert.equal(result.errorCode, 'ERR_SPH_SPATIAL_GAS_LEDGER_EOS_DEVICE_LOST');
  assert.equal(sphSpatialGasLedgerEosArenaStats(device).runtimeCount, 0);
  assert.equal(sphSpatialGasLedgerEosArenaStats(device).terminal, true);
  const arenaBuffers = instrumentation.buffers
    .slice(baselineBufferCount)
    .filter((buffer) => String(buffer.label).startsWith(
      'ulg-sph-spatial-gas-ledger-eos-2-arena-'
    ));
  assert.ok(arenaBuffers.length > 0);
  for (const buffer of arenaBuffers) assert.equal(buffer.destroyCount, 1);
  assert.equal(source.__ulgActiveBorrowCount, 0);
  device.lost = originalLost;
  await releaseOccupancyFixture(device, occupancy);
});

test('normal retained spatial gas/EOS execution binds one generic SS directory and performs no map or queue wait', async () => {
  const { device, instrumentation } = fakeDevice();
  const source = retainedProductEventSource(device, 4);
  const productCountControlBuffer = device.createBuffer({
    label: 'test-product-history-count-control',
    size: 2 * 256,
    usage: 128 | 256 | 4 | 8
  });
  const productCountControlOffset = 256;
  const productCountControlWords = createResidentProductEventCountControlWords({
    liveRowCount: 2,
    rowCapacity: 4,
    rowStrideVec4: 8,
    generation: 17,
    seal: 0x5a17c0de
  });
  device.queue.writeBuffer(
    productCountControlBuffer,
    productCountControlOffset,
    productCountControlWords
  );
  registerResidentProductEventCountAuthority(source, {
    device,
    controlBuffer: productCountControlBuffer,
    controlOffsetBytes: productCountControlOffset,
    rowCapacity: 4,
    rowStrideFloats: 32,
    generation: 17,
    seal: 0x5a17c0de
  });
  const occupancy = retainedGasOccupancyFixture(device, {
    particleCount: 4,
    gridSpacingM: 0.25
  });
  const callerOnlyGenerationBuffer = device.createBuffer({
    label: 'test-caller-only-generation-extra-buffer',
    size: 64,
    usage: 128
  });
  Object.defineProperty(occupancy.generation, Symbol('caller-extra-buffer'), {
    configurable: true,
    enumerable: false,
    value: callerOnlyGenerationBuffer
  });
  const result = await runSphSpatialGasLedgerEosRetainedWebGpu({
    device,
    residentProductMass: source,
    ...retainedGasAuthorityArgs(occupancy)
  });

  assert.equal(result.ready, true, result.reason);
  assert.equal(result.status, 'spatial-gas-ledger-eos-gpu-submitted');
  assert.equal(result.normalHotLoopReadbackFree, true);
  assert.equal(
    result.readbackTelemetrySchema,
    'peercompute.ulg.gpu-readback-telemetry.v1'
  );
  assert.equal(result.readbackTelemetryComplete, true);
  assert.deepEqual(result.readbackTelemetryUnknownSources, []);
  assert.equal(result.observedMapAsyncCount, 0);
  assert.equal(result.observedReadbackBytes, 0);
  assert.equal(result.observedHostQueueFenceCount, 0);
  assert.equal(result.deferredCleanupHostQueueFenceCount, 0);
  assert.equal(result.awaitedBackpressureHostQueueFenceCount, 0);
  assert.equal(result.productionHotLoopHostDependencyFree, true);
  assert.equal(result.arenaBackpressureWaitCount, 0);
  assert.equal(result.mapAsyncCount, 0);
  assert.equal(result.hostMaterializedRowCount, 0);
  assert.equal(result.queueCompletionFenceWaited, false);
  assert.equal(instrumentation.mapAsyncCount, 0);
  assert.equal(instrumentation.queueFenceCount, 0);
  assert.equal(source.__ulgActiveBorrowCount, 1);
  const productCountCopies = instrumentation.commandBuffers
    .flatMap((commandBuffer) => commandBuffer.events)
    .filter(
      (event) =>
        event.kind === 'copy'
        && event.source === productCountControlBuffer
    );
  assert.equal(productCountCopies.length, 1);
  assert.equal(
    productCountCopies[0].sourceOffset,
    productCountControlOffset
  );
  assert.equal(productCountCopies[0].destinationOffset, 0);
  assert.equal(
    productCountCopies[0].size,
    SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_PREFIX_BYTES
  );
  assert.deepEqual(
    Array.from(new Uint32Array(
      productCountCopies[0].bytes.buffer,
      productCountCopies[0].bytes.byteOffset,
      SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_PREFIX_BYTES
        / Uint32Array.BYTES_PER_ELEMENT
    )),
    Array.from(productCountControlWords.subarray(0, 8))
  );
  const adapterParamsWrite = instrumentation.writes.find(
    (write) => write.buffer === productCountCopies[0].destination
      && write.offset === 0
      && write.bytes.byteLength === 256
  );
  assert.ok(adapterParamsWrite);
  const adapterExpected = new DataView(
    adapterParamsWrite.bytes.buffer,
    adapterParamsWrite.bytes.byteOffset,
    adapterParamsWrite.bytes.byteLength
  );
  assert.equal(adapterExpected.getUint32(32, true),
    SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_MAGIC);
  assert.equal(adapterExpected.getUint32(36, true),
    SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_VERSION);
  assert.equal(adapterExpected.getUint32(40, true),
    SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_STATUS_READY);
  assert.equal(adapterExpected.getUint32(44, true),
    SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_STATUS_FAILED);
  assert.equal(adapterExpected.getUint32(48, true), 17);
  assert.equal(adapterExpected.getUint32(52, true), 0x5a17c0de);
  assert.equal(adapterExpected.getUint32(56, true), 4);
  assert.equal(adapterExpected.getUint32(60, true), 8);
  assert.equal(result.spatialDirectoryBuildCount, 1);
  assert.equal(result.privateSpatialLookupBuildCount, 0);
  assert.equal(result.exhaustiveSpatialScanCount, 0);
  const privateBuffers = ledgerPrivateBuffers(result, instrumentation);
  assert.ok(privateBuffers.activeNodeBuffer);
  assert.ok(privateBuffers.directoryBuffer);
  assert.equal(
    result.retainedGasCellFieldSource.schema,
    ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA
  );
  assert.equal(
    result.retainedSpatialGasLedgerSource.schema,
    ULG_SPH_RETAINED_SPATIAL_GAS_LEDGER_SOURCE_SCHEMA
  );
  assert.equal(result.schema, ULG_SPH_SPATIAL_GAS_LEDGER_EOS_EXECUTION_SCHEMA);
  assert.equal(ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V3,
    'peercompute.ulg.sph-retained-gas-cell-eos-source.v3');
  assert.equal(ULG_SPH_RETAINED_SPATIAL_GAS_LEDGER_SOURCE_SCHEMA_V3,
    'peercompute.ulg.sph-retained-spatial-gas-ledger-source.v3');
  assert.equal(ULG_SPH_SPATIAL_GAS_LEDGER_EOS_EXECUTION_SCHEMA_V3,
    'peercompute.ulg.sph-spatial-gas-ledger-eos-execution.v3');
  assert.equal(result.retainedGasCellFieldSource.hostMaterialized, false);
  assert.equal(result.retainedGasCellFieldSource.gasCellFieldSnapshot, null);
  assert.equal(result.gasCellFieldSnapshot, null);
  assert.equal(result.spatialGasSpeciesLedger, null);
  for (const target of [
    result,
    result.retainedSpatialGasLedgerSource,
    result.retainedGasCellFieldSource
  ]) {
    for (const forbidden of [
      'sourceProductEventBuffer',
      'compactSpatialGasRowsBuffer',
      'compactSpatialGasLogicalCountAuthority',
      'activeNodeBuffer',
      'gasAuthorityControlBuffer',
      'spatialEpochGeneration',
      'spatialEpochDirectoryBuffer',
      'spatialGeneration',
      'schroederSpatialEpochGeneration',
      'schroederSpatialEpochGenerationConsumerLease',
      'gasFreeVolumeRuntime',
      'gasFreeVolumeExecution',
      'gasFreeVolumeBuffer',
      'gasFreeVolumeControlBuffer',
      'gasPressureCellsBuffer',
      'retainedGasPressureCellsBuffer',
      'pressureInterfaceGasPressureCellsBuffer',
      'sourceSpatialGasLedger',
      'releaseAfterFinalConsumerQueue',
      'destroySpatialGasLedgerEosBuffers',
      'destroySpatialGasLedgerRowsBuffer',
      'destroyGasPressureCellsBuffer'
    ]) {
      assert.equal(
        Object.hasOwn(target, forbidden),
        false,
        `${target.schema}.${forbidden} must remain private`
      );
    }
  }
  assert.deepEqual(
    reachableCreatedBuffers([
      result,
      result.retainedSpatialGasLedgerSource,
      result.retainedGasCellFieldSource
    ], instrumentation),
    [],
    'all own data values, including symbols and non-enumerables, are buffer-free'
  );
  assert.deepEqual(
    reachableAuthorityFunctionPaths([
      result,
      result.retainedSpatialGasLedgerSource,
      result.retainedGasCellFieldSource
    ]),
    [],
    'public EOS authority graph must not publish owner/release/destroy/bind functions'
  );
  assert.equal(
    reachableCreatedBuffers([result], instrumentation)
      .includes(callerOnlyGenerationBuffer),
    false,
    'caller-added generation buffers are never reflected by the owner graph'
  );
  assert.equal(result.compactSpatialGasRowCount, undefined);
  assert.equal(result.pressureInterfaceGasPressureCellRowCount, undefined);
  assert.equal(result.compactSpatialGasRowCapacity, 4);
  assert.equal(result.pressureInterfaceGasPressureCellRowCapacity, 4);
  assert.equal(result.adapterDirectDispatchCount, 3);
  assert.ok(result.adapterScanDispatchCount > 0);
  assert.equal(result.adapterDispatchCount, 3 + result.adapterScanDispatchCount);
  assert.equal(result.eosDispatchCount, 3);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.retainedGasCellFieldSource), true);
  assert.equal(
    isExactSphSpatialGasPressureAuthoritySource(
      result.retainedGasCellFieldSource
    ),
    true
  );
  assert.equal(
    isExactSphSpatialGasPressureAuthoritySource({
      ...result.retainedGasCellFieldSource
    }),
    false
  );
  const telemetry = describeSphSpatialGasPressureAuthority(
    result.retainedGasCellFieldSource
  );
  assert.equal(telemetry.telemetryOnly, true);
  assert.equal(telemetry.bindable, false);
  assert.equal('gasPressureCellsBuffer' in telemetry, false);
  assert.equal(telemetry.deviceAuthenticated, false);
  assert.equal(telemetry.consumerBorrowedObserved, false);
  assert.equal('executionGeneration' in telemetry, false);
  const authenticatedTelemetry = describeSphSpatialGasPressureAuthority(
    result.retainedGasCellFieldSource,
    { device }
  );
  assert.equal(authenticatedTelemetry.deviceAuthenticated, true);
  assert.equal(
    authenticatedTelemetry.executionGeneration,
    result.executionGeneration
  );

  const eosBindGroups = instrumentation.bindGroups.filter((bindGroup) => (
    String(bindGroup.label).includes('-eos-aggregate-bind-group')
      || String(bindGroup.label).includes('-eos-gradient-bind-group')
      || String(bindGroup.label).includes('-eos-finalizer-bind-group')
  ));
  assert.equal(eosBindGroups.length, 3);
  for (const bindGroup of eosBindGroups) {
    assert.equal(
      bindGroup.entries.find((entry) => entry.binding === 0).resource.buffer,
      privateBuffers.compactRowsBuffer
    );
    assert.equal(
      bindGroup.entries.find((entry) => entry.binding === 1).resource.buffer,
      privateBuffers.directoryBuffer
    );
    assert.equal(
      bindGroup.entries.find((entry) => entry.binding === 2).resource.buffer,
      privateBuffers.gasPressureCellsBuffer
    );
    assert.equal(
      bindGroup.entries.find((entry) => entry.binding === 4).resource.buffer,
      privateBuffers.controlBuffer
    );
    assert.equal(
      bindGroup.entries.find((entry) => entry.binding === 5).resource.buffer,
      privateBuffers.gasFreeVolumeBuffer
    );
    assert.equal(
      bindGroup.entries.find((entry) => entry.binding === 6).resource.buffer,
      privateBuffers.gasFreeVolumeControlBuffer
    );
  }
  assert.equal(
    result.retainedGasCellFieldSource
      .gasFreeVolumePressureDenominatorAuthority,
    'same-generation-condensed-occupancy-free-volume-sidecar'
  );

  const consumer = pressureConsumerFixture(device, instrumentation, result);
  const firstBinding = consumer.encode();
  assert.equal(
    describeSphSpatialGasPressureAuthority(
      result.retainedGasCellFieldSource
    ).consumerBorrowedObserved,
    true
  );
  assert.deepEqual(Reflect.ownKeys(firstBinding), [
    'receipt',
    'executionGeneration',
    'storageGeneration',
    'gasPressureCellRowCapacity',
    'pressureInterfaceGasPressureCellRowStrideFloats'
  ]);
  assert.equal(Object.isFrozen(firstBinding), true);
  assert.equal(Object.isFrozen(firstBinding.receipt), true);
  assert.deepEqual(
    reachableCreatedBuffers([firstBinding], instrumentation),
    []
  );
  assert.equal(consumer.calls.length, 1);
  assert.equal(consumer.calls[0].index, 0);
  const privateAuthorityEntries = consumer.calls[0].bindGroup.entries;
  assert.equal(
    privateAuthorityEntries.find((entry) => entry.binding === 3)
      .resource.buffer,
    privateBuffers.gasPressureCellsBuffer
  );
  assert.equal(
    privateAuthorityEntries.find((entry) => entry.binding === 6)
      .resource.buffer,
    privateBuffers.controlBuffer
  );
  assert.equal(releaseSphSpatialGasLedgerEosAfterQueue(result), false);
  assert.equal(
    result.releaseStatus,
    'spatial-gas-ledger-eos-release-blocked-active-pressure-consumer'
  );
  assert.equal(
    result.deferredCleanupReadbackTelemetrySnapshot()
      .observedHostQueueFenceCount,
    0
  );
  assert.equal(abandonSphSpatialGasPressureAuthority(firstBinding.receipt), true);
  assert.equal(abandonSphSpatialGasPressureAuthority(firstBinding.receipt), false);
  assert.equal(
    describeSphSpatialGasPressureAuthority(
      result.retainedGasCellFieldSource
    ).consumerBorrowedObserved,
    false
  );
  const submittedBinding = consumer.encode();
  device.queue.submit([]);
  assert.equal(
    markSphSpatialGasPressureAuthoritySubmitted(submittedBinding.receipt),
    true
  );
  assert.equal(
    markSphSpatialGasPressureAuthoritySubmitted(submittedBinding.receipt),
    false
  );
  assert.equal(releaseSphSpatialGasLedgerEosAfterQueue(result), true);
  assert.equal(result.releaseScheduled, true);
  const cleanupTelemetry =
    result.deferredCleanupReadbackTelemetrySnapshot();
  assert.equal(cleanupTelemetry.readbackTelemetryComplete, true);
  assert.equal(cleanupTelemetry.observedHostQueueFenceCount, 1);
  assert.equal(cleanupTelemetry.deferredCleanupHostQueueFenceCount, 1);
  assert.equal(cleanupTelemetry.awaitedBackpressureHostQueueFenceCount, 0);
  assert.equal(cleanupTelemetry.normalHotLoopReadbackFree, false);
  assert.equal(cleanupTelemetry.productionHotLoopHostDependencyFree, true);
  assert.equal(
    result.retainedSpatialGasLedgerSource
      .deferredCleanupReadbackTelemetrySnapshot()
      .observedHostQueueFenceCount,
    1
  );
  assert.equal(
    result.retainedGasCellFieldSource
      .deferredCleanupReadbackTelemetrySnapshot()
      .observedHostQueueFenceCount,
    1
  );
  assert.equal(releaseSphSpatialGasLedgerEosAfterQueue(result), false);
  assert.equal(
    result.deferredCleanupReadbackTelemetrySnapshot()
      .observedHostQueueFenceCount,
    1
  );
  assert.equal(await result.releasePromise, true);
  assert.equal(result.released, true);
  assert.equal(source.__ulgActiveBorrowCount, 0);
  assert.equal(instrumentation.queueFenceCount, 1);
  assert.equal(instrumentation.mapAsyncCount, 0);
  await releaseOccupancyFixture(device, occupancy);
  assert.equal(destroySphSpatialGasLedgerEosGpu(device), true);
});

test('opaque pressure encoding rejects hostile entries and rolls back every pre-submit reservation', async () => {
  const { device, instrumentation } = fakeDevice();
  const source = retainedProductEventSource(device, 2);
  const occupancy = retainedGasOccupancyFixture(device, {
    particleCount: 2,
    gridSpacingM: 1
  });
  const execution = await runSphSpatialGasLedgerEosRetainedWebGpu({
    device,
    residentProductMass: source,
    ...retainedGasAuthorityArgs(occupancy)
  });
  assert.equal(execution.ready, true, execution.reason);
  const consumer = pressureConsumerFixture(
    device,
    instrumentation,
    execution
  );
  const assertRejectedAndUnborrowed = (callback, matcher) => {
    assert.throws(callback, matcher);
    assert.equal(execution.gasPressureAuthorityConsumerBorrowed, false);
    assert.equal(
      execution.retainedGasCellFieldSource
        .gasPressureAuthorityConsumerBorrowed,
      false
    );
  };

  for (const binding of [3, 6]) {
    assertRejectedAndUnborrowed(
      () => consumer.encode({
        publicEntries: [
          { binding, resource: { buffer: consumer.publicBuffer } }
        ]
      }),
      (error) => error?.code
        === 'ERR_SPH_GAS_PRESSURE_AUTHORITY_RESERVED_BINDING'
    );
  }
  assertRejectedAndUnborrowed(
    () => consumer.encode({
      publicEntries: [
        { binding: 0, resource: { buffer: consumer.publicBuffer } },
        { binding: 0, resource: { buffer: consumer.publicBuffer } }
      ]
    }),
    (error) => error?.code
      === 'ERR_SPH_GAS_PRESSURE_AUTHORITY_ENTRIES_INVALID'
  );
  const sparse = new Array(1);
  assertRejectedAndUnborrowed(
    () => consumer.encode({ publicEntries: sparse }),
    (error) => error?.code
      === 'ERR_SPH_GAS_PRESSURE_AUTHORITY_ENTRIES_INVALID'
  );
  const accessorEntry = [];
  Object.defineProperty(accessorEntry, '0', {
    enumerable: true,
    get() { return consumer.publicEntries[0]; }
  });
  accessorEntry.length = 1;
  assertRejectedAndUnborrowed(
    () => consumer.encode({ publicEntries: accessorEntry }),
    (error) => error?.code
      === 'ERR_SPH_GAS_PRESSURE_AUTHORITY_ENTRIES_INVALID'
  );
  const accessorResource = {};
  Object.defineProperty(accessorResource, 'buffer', {
    enumerable: true,
    get() { return consumer.publicBuffer; }
  });
  assertRejectedAndUnborrowed(
    () => consumer.encode({
      publicEntries: [{ binding: 0, resource: accessorResource }]
    }),
    (error) => error?.code
      === 'ERR_SPH_GAS_PRESSURE_AUTHORITY_ENTRIES_INVALID'
  );
  assertRejectedAndUnborrowed(
    () => consumer.encode({
      publicEntries: [{ binding: 0, resource: {} }]
    }),
    (error) => error?.code
      === 'ERR_SPH_GAS_PRESSURE_AUTHORITY_ENTRIES_INVALID'
  );

  const forged = { ...execution.retainedGasCellFieldSource };
  assertRejectedAndUnborrowed(
    () => encodeSphSpatialGasPressureAuthority(forged, {
      device,
      passEncoder: consumer.passEncoder,
      bindGroupLayout: consumer.bindGroupLayout,
      publicEntries: consumer.publicEntries
    }),
    (error) => error?.code === 'ERR_SPH_GAS_PRESSURE_AUTHORITY_UNBRANDED'
  );
  const other = fakeDevice();
  assertRejectedAndUnborrowed(
    () => encodeSphSpatialGasPressureAuthority(
      execution.retainedGasCellFieldSource,
      {
        device: other.device,
        passEncoder: consumer.passEncoder,
        bindGroupLayout: consumer.bindGroupLayout,
        publicEntries: consumer.publicEntries
      }
    ),
    (error) => error?.code
      === 'ERR_SPH_GAS_PRESSURE_AUTHORITY_DEVICE_MISMATCH'
  );

  const createBindGroup = device.createBindGroup;
  device.createBindGroup = () => {
    throw new Error('synthetic createBindGroup failure');
  };
  assertRejectedAndUnborrowed(
    () => consumer.encode(),
    /synthetic createBindGroup failure/
  );
  device.createBindGroup = createBindGroup;
  assertRejectedAndUnborrowed(
    () => consumer.encode({
      passEncoder: {
        setBindGroup() {
          throw new Error('synthetic setBindGroup failure');
        }
      }
    }),
    /synthetic setBindGroup failure/
  );

  let reentrantReleaseResult = null;
  let trapped = false;
  const reentrantEntries = new Proxy(consumer.publicEntries, {
    getOwnPropertyDescriptor(target, key) {
      if (!trapped) {
        trapped = true;
      reentrantReleaseResult = releaseSphSpatialGasLedgerEosAfterQueue(
        execution
      );
        throw new Error('synthetic reentrant descriptor trap');
      }
      return Reflect.getOwnPropertyDescriptor(target, key);
    }
  });
  assertRejectedAndUnborrowed(
    () => consumer.encode({ publicEntries: reentrantEntries }),
    (error) => error?.code
      === 'ERR_SPH_GAS_PRESSURE_AUTHORITY_ENTRIES_INVALID'
  );
  assert.equal(reentrantReleaseResult, false);
  assert.equal(execution.releaseAttempted, false);

  let optionsReentrantReleaseResult = null;
  const reentrantOptions = new Proxy({
    device,
    passEncoder: consumer.passEncoder,
    bindGroupLayout: consumer.bindGroupLayout,
    publicEntries: consumer.publicEntries
  }, {
    ownKeys() {
      optionsReentrantReleaseResult =
        releaseSphSpatialGasLedgerEosAfterQueue(execution);
      throw new Error('synthetic reentrant options trap');
    }
  });
  assertRejectedAndUnborrowed(
    () => encodeSphSpatialGasPressureAuthority(
      execution.retainedGasCellFieldSource,
      reentrantOptions
    ),
    (error) => error?.code
      === 'ERR_SPH_GAS_PRESSURE_AUTHORITY_OPTIONS_INVALID'
  );
  assert.equal(optionsReentrantReleaseResult, false);
  assert.equal(execution.releaseAttempted, false);

  const valid = consumer.encode();
  assert.equal(consumer.calls.length, 1);
  assert.equal(abandonSphSpatialGasPressureAuthority(valid.receipt), true);
  assert.equal(releaseSphSpatialGasLedgerEosAfterQueue(execution), true);
  assert.equal(await execution.releasePromise, true);
  assertRejectedAndUnborrowed(
    () => consumer.encode(),
    (error) => error?.code === 'ERR_SPH_GAS_PRESSURE_AUTHORITY_TERMINAL'
  );
  await releaseOccupancyFixture(device, occupancy);
  assert.equal(destroySphSpatialGasLedgerEosGpu(device), true);
});

test('retained combined owner quarantines every invalid queue-fence provider without counting or retrying', async () => {
  const providerCases = [
    {
      name: 'missing',
      expectedCalls: 0,
      install(queue) { delete queue.onSubmittedWorkDone; }
    },
    {
      name: 'sync-throw',
      expectedCalls: 1,
      install(queue, count) {
        queue.onSubmittedWorkDone = () => {
          count();
          throw new Error('synthetic retained fence provider throw');
        };
      }
    },
    {
      name: 'undefined',
      expectedCalls: 1,
      install(queue, count) {
        queue.onSubmittedWorkDone = () => {
          count();
          return undefined;
        };
      }
    },
    {
      name: 'true',
      expectedCalls: 1,
      install(queue, count) {
        queue.onSubmittedWorkDone = () => {
          count();
          return true;
        };
      }
    },
    {
      name: 'plain-object',
      expectedCalls: 1,
      install(queue, count) {
        queue.onSubmittedWorkDone = () => {
          count();
          return { status: 'not-a-thenable' };
        };
      }
    }
  ];

  for (const providerCase of providerCases) {
    const { device, lost, instrumentation } = fakeDevice();
    const source = retainedProductEventSource(device, 2);
    const occupancy = retainedGasOccupancyFixture(device, {
      particleCount: 2,
      gridSpacingM: 1
    });
    const execution = await runSphSpatialGasLedgerEosRetainedWebGpu({
      device,
      residentProductMass: source,
      ...retainedGasAuthorityArgs(occupancy)
    });
    assert.equal(execution.ready, true, `${providerCase.name}: ${execution.reason}`);
    const originalFenceProvider = device.queue.onSubmittedWorkDone;
    let providerCalls = 0;
    providerCase.install(device.queue, () => { providerCalls += 1; });
    const privateBuffers = ledgerPrivateBuffers(execution, instrumentation);
    const ownedBuffers = [
      privateBuffers.compactRowsBuffer,
      privateBuffers.activeNodeBuffer,
      privateBuffers.gasPressureCellsBuffer
    ];

    assert.equal(
      releaseSphSpatialGasLedgerEosAfterQueue(execution),
      false,
      providerCase.name
    );
    assert.equal(
      releaseSphSpatialGasLedgerEosAfterQueue(execution),
      false,
      providerCase.name
    );
    assert.equal(
      releaseSphSpatialGasLedgerEosAfterQueue(execution),
      false,
      providerCase.name
    );
    assert.equal(providerCalls, providerCase.expectedCalls, providerCase.name);
    for (const owner of [
      execution,
      execution.retainedSpatialGasLedgerSource,
      execution.retainedGasCellFieldSource
    ]) {
      assert.equal(owner.releaseAttempted, true, providerCase.name);
      assert.equal(owner.releaseScheduled, false, providerCase.name);
      assert.equal(owner.releaseQuarantined, true, providerCase.name);
      assert.equal(owner.released, false, providerCase.name);
      assert.equal(owner.terminal, true, providerCase.name);
      assert.equal(owner.releaseStatus, execution.releaseStatus, providerCase.name);
    }
    const cleanup = execution.deferredCleanupReadbackTelemetrySnapshot();
    assert.equal(cleanup.readbackTelemetryComplete, false, providerCase.name);
    assert.equal(cleanup.observedHostQueueFenceCount, 0, providerCase.name);
    assert.equal(cleanup.deferredCleanupHostQueueFenceCount, 0, providerCase.name);
    for (const buffer of ownedBuffers) {
      assert.equal(buffer.destroyCount, 0, providerCase.name);
    }

    device.queue.onSubmittedWorkDone = originalFenceProvider;
    lost.resolve({
      reason: 'destroyed',
      message: `synthetic ${providerCase.name} quarantine cleanup`
    });
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(source.__ulgActiveBorrowCount, 0, providerCase.name);
    for (const buffer of ownedBuffers) {
      assert.equal(buffer.destroyCount, 1, providerCase.name);
    }
  }
});

test('explicit full oracle is the only focused path that maps and materializes rows', async () => {
  const { device, instrumentation } = fakeDevice();
  const source = retainedProductEventSource(device, 2);
  const occupancy = retainedGasOccupancyFixture(device, {
    particleCount: 2,
    gridSpacingM: 1
  });
  const result = await runSphSpatialGasLedgerEosRetainedWebGpu({
    device,
    residentProductMass: source,
    ...retainedGasAuthorityArgs(occupancy)
  });
  assert.equal(result.ready, true, result.reason);
  assert.equal(instrumentation.mapAsyncCount, 0);
  const compactRows = new Float32Array(12);
  compactRows.set([1, 2, 3], 0);
  compactRows[3] = 9;
  compactRows[4] = 0.1;
  compactRows[5] = 1;
  compactRows[6] = 300;
  compactRows[7] = 0.5;
  compactRows[10] = 1;
  const pressureRows = new Float32Array(12);
  pressureRows[3] = 1;
  pressureRows.set([1.5, 2.5, 3.5], 4);
  pressureRows[7] = 1000;
  pressureRows[11] = 0.5;
  seedFakeCompletedAuthority(result, instrumentation, {
    liveCount: 1,
    cellCount: 1,
    compactRows,
    pressureRows
  });

  const oracle = await observeSphSpatialGasLedgerEosOracle(result);
  assert.equal(oracle.diagnosticsMode, SPH_SPATIAL_GAS_DIAGNOSTICS_FULL_ORACLE);
  assert.equal(oracle.explicitDiagnostic, true);
  assert.equal(oracle.mapAsyncCount, 4);
  assert.equal(instrumentation.mapAsyncCount, 4);
  assert.ok(oracle.compactValues instanceof Float32Array);
  assert.ok(oracle.pressureValues instanceof Float32Array);
  assert.ok(oracle.controlWords instanceof Uint32Array);
  assert.ok(oracle.directoryHeader instanceof Uint32Array);
  assert.equal(oracle.compactValues.length, 12);
  assert.equal(oracle.pressureValues.length, 12);
  assert.equal(oracle.liveResidualCount, 1);
  assert.equal(oracle.readyPressureCount, 1);

  assert.equal(releaseSphSpatialGasLedgerEosAfterQueue(result), true);
  assert.equal(await result.releasePromise, true);
  await releaseOccupancyFixture(device, occupancy);
  assert.equal(destroySphSpatialGasLedgerEosGpu(device), true);
});

test('retained spatial gas/EOS merges exact nested Schroeder backpressure telemetry', async () => {
  const { device, instrumentation } = fakeDevice();
  const source = retainedProductEventSource(device, 4);
  const occupancy = retainedGasOccupancyFixture(device, {
    particleCount: 4,
    gridSpacingM: 1
  });
  const blockers = Array.from(
    { length: 3 },
    () => retainedGasActiveNodeGenerationFixture(device, {
      particleCount: 4,
      gridSpacingM: 1
    })
  );
  const releaseGate = deferred();
  const originalFence = device.queue.onSubmittedWorkDone;
  device.queue.onSubmittedWorkDone = () => {
    instrumentation.queueFenceCount += 1;
    return releaseGate.promise;
  };
  assert.equal(
    releaseSchroederSpatialEpochGenerationAfterQueue(blockers[0], device),
    true
  );

  const pending = runSphSpatialGasLedgerEosRetainedWebGpu({
    device,
    residentProductMass: source,
    ...retainedGasAuthorityArgs(occupancy)
  });
  await Promise.resolve();
  await Promise.resolve();
  releaseGate.resolve();
  const result = await pending;

  assert.equal(result.ready, true, result.reason);
  assert.equal(result.arenaBackpressureWaitCount, 0);
  assert.equal(result.readbackTelemetryComplete, true);
  assert.equal(result.observedHostQueueFenceCount, 1);
  assert.equal(result.awaitedBackpressureHostQueueFenceCount, 1);
  assert.equal(result.deferredCleanupHostQueueFenceCount, 0);
  assert.equal(result.normalHotLoopReadbackFree, false);
  assert.equal(result.productionHotLoopHostDependencyFree, false);
  assert.ok(result.readbackTelemetrySourceBreakdown.some((entry) => (
    entry.source.includes('schroeder-spatial-generation')
    && entry.awaitedBackpressureHostQueueFenceCount === 1
  )));
  assert.equal(instrumentation.queueFenceCount, 1);
  assert.equal(await blockers[0].releasePromise, true);

  device.queue.onSubmittedWorkDone = originalFence;
  assert.equal(releaseSphSpatialGasLedgerEosAfterQueue(result), true);
  assert.equal(await result.releasePromise, true);
  for (const blocker of blockers.slice(1)) {
    assert.equal(
      releaseSchroederSpatialEpochGenerationAfterQueue(blocker, device),
      true
    );
    assert.equal(await blocker.releasePromise, true);
  }
  await releaseOccupancyFixture(device, occupancy);
  assert.equal(source.__ulgActiveBorrowCount, 0);
  assert.equal(destroySphSpatialGasLedgerEosGpu(device), true);
});

test('same-device provenance, exact epochs, retained ownership, and diagnostics modes fail closed before submit', async () => {
  const first = fakeDevice();
  const second = fakeDevice();
  const source = retainedProductEventSource(first.device, 2);
  const crossDevice = await runSphSpatialGasLedgerEosRetainedWebGpu({
    device: second.device,
    residentProductMass: source,
    epochIdentity: epochIdentity(),
    spatialGasCellSizeM: 1,
    spatialGasSupportVolumeFallbackM3: 1
  });
  assert.equal(crossDevice.ready, false);
  assert.equal(crossDevice.failClosed, true);
  assert.equal(
    crossDevice.status,
    'spatial-gas-ledger-eos-rejected-cross-device-source'
  );
  assert.equal(second.instrumentation.submissions.length, 0);
  assert.equal(source.__ulgActiveBorrowCount, 0);

  const tornEpoch = await runSphSpatialGasLedgerEosRetainedWebGpu({
    device: first.device,
    residentProductMass: source,
    epochIdentity: { ...epochIdentity(), supportEpoch: null },
    spatialGasCellSizeM: 1,
    spatialGasSupportVolumeFallbackM3: 1
  });
  assert.equal(tornEpoch.ready, false);
  assert.equal(tornEpoch.status, 'spatial-gas-ledger-eos-rejected-epoch-identity');

  const implicitDiagnostic = await runSphSpatialGasLedgerEosRetainedWebGpu({
    device: first.device,
    residentProductMass: source,
    epochIdentity: epochIdentity(),
    spatialGasCellSizeM: 1,
    spatialGasSupportVolumeFallbackM3: 1,
    diagnosticsMode: 'sometimes-read-if-helpful'
  });
  assert.equal(implicitDiagnostic.ready, false);
  assert.equal(
    implicitDiagnostic.status,
    'spatial-gas-ledger-eos-rejected-diagnostics-mode'
  );
  assert.equal(first.instrumentation.submissions.length, 0);
  assert.equal(first.instrumentation.mapAsyncCount, 0);
});

test('explicit gas/EOS dispatch limits reject before source borrow or arena acquisition', async () => {
  const rejectedDevice = fakeDevice();
  rejectedDevice.device.limits.maxComputeWorkgroupsPerDimension = 2;
  const oversizedSource = retainedProductEventSource(rejectedDevice.device, 129);
  const rejectedOccupancy = retainedGasOccupancyFixture(
    rejectedDevice.device,
    { gridSpacingM: 1 }
  );
  const rejectedSubmissionsBeforeGas =
    rejectedDevice.instrumentation.submissions.length;
  const rejected = await runSphSpatialGasLedgerEosRetainedWebGpu({
    device: rejectedDevice.device,
    residentProductMass: oversizedSource,
    ...retainedGasAuthorityArgs(rejectedOccupancy)
  });
  assert.equal(rejected.ready, false);
  assert.equal(rejected.status, 'spatial-gas-ledger-eos-rejected-dispatch-limit');
  assert.equal(rejected.requiredWorkgroups, 4);
  assert.equal(rejected.maxComputeWorkgroupsPerDimension, 2);
  assert.equal(oversizedSource.__ulgActiveBorrowCount, 0);
  assert.equal(
    rejectedDevice.instrumentation.submissions.length,
    rejectedSubmissionsBeforeGas
  );
  assert.equal(sphSpatialGasLedgerEosArenaStats(rejectedDevice.device).runtimeCount, 0);
  await releaseOccupancyFixture(rejectedDevice.device, rejectedOccupancy);

  const boundaryDevice = fakeDevice();
  boundaryDevice.device.limits.maxComputeWorkgroupsPerDimension = 2;
  const boundarySource = retainedProductEventSource(boundaryDevice.device, 64);
  const boundaryOccupancy = retainedGasOccupancyFixture(
    boundaryDevice.device,
    { gridSpacingM: 1 }
  );
  const boundary = await runSphSpatialGasLedgerEosRetainedWebGpu({
    device: boundaryDevice.device,
    residentProductMass: boundarySource,
    ...retainedGasAuthorityArgs(boundaryOccupancy)
  });
  assert.equal(boundary.ready, true, boundary.reason);
  assert.equal(releaseSphSpatialGasLedgerEosAfterQueue(boundary), true);
  assert.equal(await boundary.releasePromise, true);
  assert.equal(boundarySource.__ulgActiveBorrowCount, 0);
  await releaseOccupancyFixture(boundaryDevice.device, boundaryOccupancy);
  assert.equal(destroySphSpatialGasLedgerEosGpu(boundaryDevice.device), true);
});

test('pre-submit gas/EOS setup failure immediately releases its borrow and slot', async () => {
  const { device, instrumentation } = fakeDevice();
  const source = retainedProductEventSource(device, 4);
  const occupancy = retainedGasOccupancyFixture(device, {
    particleCount: 4,
    gridSpacingM: 0.5
  });
  const submissionsBeforeGas = instrumentation.submissions.length;
  device.createBindGroup = () => {
    throw new Error('synthetic adapter bind-group setup failure');
  };
  const result = await runSphSpatialGasLedgerEosRetainedWebGpu({
    device,
    residentProductMass: source,
    ...retainedGasAuthorityArgs(occupancy)
  });
  assert.equal(result.ready, false);
  assert.equal(result.adapterSubmitted, false);
  assert.equal(await result.cleanupPromise, true);
  assert.equal(source.__ulgActiveBorrowCount, 0);
  assert.equal(instrumentation.submissions.length, submissionsBeforeGas);
  assert.equal(sphSpatialGasLedgerEosArenaStats(device).inUseSlotCount, 0);
  await releaseOccupancyFixture(device, occupancy);
  assert.equal(destroySphSpatialGasLedgerEosGpu(device), true);
});

test('gas-adapter encoder finalization failure remains exact pre-submit cleanup', async () => {
  const { device, instrumentation } = fakeDevice();
  const source = retainedProductEventSource(device, 4);
  const occupancy = retainedGasOccupancyFixture(device, {
    particleCount: 4,
    gridSpacingM: 0.5
  });
  const originalCreateCommandEncoder = device.createCommandEncoder;
  device.createCommandEncoder = (descriptor) => {
    const encoder = originalCreateCommandEncoder(descriptor);
    if (String(descriptor?.label).endsWith('-adapter-encoder')) {
      encoder.finish = () => {
        throw new Error('synthetic gas-adapter encoder finish failure');
      };
    }
    return encoder;
  };
  const submissionsBeforeGas = instrumentation.submissions.length;

  const result = await runSphSpatialGasLedgerEosRetainedWebGpu({
    device,
    residentProductMass: source,
    ...retainedGasAuthorityArgs(occupancy)
  });
  assert.equal(result.ready, false);
  assert.equal(result.adapterSubmissionAttempted, false);
  assert.equal(result.adapterSubmitted, false);
  assert.match(result.reason, /gas-adapter encoder finish failure/);
  assert.equal(await result.cleanupPromise, true);
  assert.equal(source.__ulgActiveBorrowCount, 0);
  assert.equal(instrumentation.submissions.length, submissionsBeforeGas);
  assert.equal(sphSpatialGasLedgerEosArenaStats(device).inUseSlotCount, 0);
  await releaseOccupancyFixture(device, occupancy);
  assert.equal(destroySphSpatialGasLedgerEosGpu(device), true);
});

test('initial gas-adapter submit uncertainty quarantines its arena until exact device loss', async () => {
  const { device, lost, instrumentation } = fakeDevice();
  const source = retainedProductEventSource(device, 4);
  const occupancy = retainedGasOccupancyFixture(device, {
    particleCount: 4,
    gridSpacingM: 0.5
  });
  const originalSubmit = device.queue.submit;
  device.queue.submit = (commandBuffers) => {
    originalSubmit.call(device.queue, commandBuffers);
    throw new Error('synthetic accepted-but-threw adapter submit');
  };
  device.queue.onSubmittedWorkDone = () => Promise.reject(
    new Error('synthetic uncertain-submit cleanup fence rejection')
  );
  const arenaBuffersBefore = instrumentation.buffers.length;

  const result = await runSphSpatialGasLedgerEosRetainedWebGpu({
    device,
    residentProductMass: source,
    ...retainedGasAuthorityArgs(occupancy)
  });
  assert.equal(result.ready, false);
  assert.equal(result.status, 'spatial-gas-ledger-eos-rejected-submit');
  assert.equal(result.adapterSubmissionAttempted, true);
  assert.equal(result.adapterSubmitted, false);
  assert.match(result.reason, /synthetic accepted-but-threw adapter submit/);
  assert.equal(await result.cleanupPromise, false);
  assert.equal(source.__ulgActiveBorrowCount, 1);
  assert.equal(sphSpatialGasLedgerEosArenaStats(device).inUseSlotCount, 1);
  assert.equal(sphSpatialGasLedgerEosArenaStats(device).terminal, false);
  assert.equal(destroySphSpatialGasLedgerEosGpu(device), false);

  const arenaBuffers = instrumentation.buffers
    .slice(arenaBuffersBefore)
    .filter(({ label }) => String(label).startsWith(
      'ulg-sph-spatial-gas-ledger-eos-4-arena-0-'
    ));
  assert.ok(arenaBuffers.length > 0);
  assert.equal(arenaBuffers.every(({ destroyCount }) => destroyCount === 0), true);

  lost.resolve({
    reason: 'destroyed',
    message: 'synthetic exact device loss after adapter submit uncertainty'
  });
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(source.__ulgActiveBorrowCount, 0);
  assert.equal(sphSpatialGasLedgerEosArenaStats(device).terminal, true);
  for (const buffer of arenaBuffers) {
    assert.equal(buffer.destroyCount, 1, buffer.label);
  }
});

test('post-submit gas/EOS setup failure retains a loss-recoverable borrow record', async () => {
  const { device, lost, instrumentation } = fakeDevice();
  const source = retainedProductEventSource(device, 4);
  const occupancy = retainedGasOccupancyFixture(device, {
    particleCount: 4,
    gridSpacingM: 0.5
  });
  const createBindGroup = device.createBindGroup;
  device.createBindGroup = (descriptor) => {
    if (String(descriptor?.label).includes('-eos-aggregate-bind-group')) {
      throw new Error('synthetic post-adapter EOS setup failure');
    }
    return createBindGroup(descriptor);
  };
  device.queue.onSubmittedWorkDone = () => {
    instrumentation.queueFenceCount += 1;
    return Promise.reject(new Error('synthetic failure-cleanup fence rejection'));
  };
  const result = await runSphSpatialGasLedgerEosRetainedWebGpu({
    device,
    residentProductMass: source,
    ...retainedGasAuthorityArgs(occupancy)
  });
  assert.equal(result.ready, false);
  assert.equal(result.adapterSubmitted, true);
  assert.equal(result.readbackTelemetryComplete, true);
  assert.deepEqual(result.readbackTelemetryUnknownSources, []);
  assert.equal(result.observedHostQueueFenceCount, 1);
  assert.equal(result.deferredCleanupHostQueueFenceCount, 1);
  assert.equal(result.awaitedBackpressureHostQueueFenceCount, 0);
  assert.equal(result.normalHotLoopReadbackFree, false);
  assert.equal(result.productionHotLoopHostDependencyFree, true);
  assert.equal(instrumentation.queueFenceCount, 1);
  assert.equal(await result.cleanupPromise, false);
  assert.equal(source.__ulgActiveBorrowCount, 1);
  assert.equal(sphSpatialGasLedgerEosArenaStats(device).inUseSlotCount, 1);
  assert.equal(destroySphSpatialGasLedgerEosGpu(device), false);

  const arenaBuffers = instrumentation.buffers.filter((buffer) => (
    String(buffer.label).startsWith('ulg-sph-spatial-gas-ledger-eos-4-arena-0-')
  ));
  lost.resolve({ reason: 'destroyed', message: 'synthetic setup-failure loss' });
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(source.__ulgActiveBorrowCount, 0);
  assert.equal(sphSpatialGasLedgerEosArenaStats(device).terminal, true);
  for (const buffer of arenaBuffers) {
    assert.equal(buffer.destroyCount, 1, buffer.label);
  }
});

test('non-ready nested post-submit cleanup counts its fence and the outer failure fence exactly', async () => {
  const { device, instrumentation } = fakeDevice();
  const source = retainedProductEventSource(device, 4);
  const occupancy = retainedGasOccupancyFixture(device, {
    particleCount: 4,
    gridSpacingM: 0.5
  });
  const seedGeneration = retainedGasActiveNodeGenerationFixture(device, {
    particleCount: 4,
    gridSpacingM: 0.5
  });
  assert.equal(
    releaseSchroederSpatialEpochGenerationAfterQueue(seedGeneration, device),
    true
  );
  assert.equal(await seedGeneration.releasePromise, true);
  const entry = seedGeneration.directRuntimeEntry;
  const originalPush = entry.liveGenerations.push;
  let rejectFirstPublication = true;
  entry.liveGenerations.push = function (...values) {
    if (rejectFirstPublication) {
      rejectFirstPublication = false;
      throw new Error('synthetic post-submit generation publication failure');
    }
    return originalPush.apply(this, values);
  };
  const queueFencesBeforeFailure = instrumentation.queueFenceCount;

  const result = await runSphSpatialGasLedgerEosRetainedWebGpu({
    device,
    residentProductMass: source,
    ...retainedGasAuthorityArgs(occupancy)
  });
  entry.liveGenerations.push = originalPush;

  assert.equal(result.ready, false);
  assert.equal(
    result.status,
    'spatial-gas-ledger-eos-rejected-spatial-generation'
  );
  assert.equal(result.spatialGenerationStatus, 'schroeder-spatial-epoch-generation-rejected');
  assert.equal(result.readbackTelemetryComplete, true);
  assert.deepEqual(result.readbackTelemetryUnknownSources, []);
  assert.equal(result.observedHostQueueFenceCount, 2);
  assert.equal(result.deferredCleanupHostQueueFenceCount, 2);
  assert.equal(result.awaitedBackpressureHostQueueFenceCount, 0);
  assert.equal(result.normalHotLoopReadbackFree, false);
  assert.equal(result.productionHotLoopHostDependencyFree, true);
  assert.equal(
    instrumentation.queueFenceCount - queueFencesBeforeFailure,
    2
  );
  assert.equal(await result.cleanupPromise, true);
  assert.equal(source.__ulgActiveBorrowCount, 0);
  assert.equal(sphSpatialGasLedgerEosArenaStats(device).inUseSlotCount, 0);
  await releaseOccupancyFixture(device, occupancy);
  assert.equal(destroySphSpatialGasLedgerEosGpu(device), true);
});

test('warm retained arena reuses exact buffers only after final-consumer release', async () => {
  const { device, instrumentation } = fakeDevice();
  const source = retainedProductEventSource(device, 8);
  const occupancy = retainedGasOccupancyFixture(device, {
    particleCount: 8,
    gridSpacingM: 0.5
  });
  const first = await runSphSpatialGasLedgerEosRetainedWebGpu({
    device,
    residentProductMass: source,
    ...retainedGasAuthorityArgs(occupancy)
  });
  assert.equal(first.ready, true, first.reason);
  const firstPrivate = ledgerPrivateBuffers(first, instrumentation);
  const ownedBuffers = [
    firstPrivate.compactRowsBuffer,
    firstPrivate.activeNodeBuffer,
    firstPrivate.gasPressureCellsBuffer
  ];
  const consumer = pressureConsumerFixture(device, instrumentation, first);
  const authorityBinding = consumer.encode();
  assert.deepEqual(
    reachableCreatedBuffers([
      first,
      first.retainedSpatialGasLedgerSource,
      first.retainedGasCellFieldSource,
      authorityBinding
    ], instrumentation),
    []
  );
  assert.equal(firstPrivate.gasPressureCellsBuffer.destroyCount, 0);
  assert.equal(abandonSphSpatialGasPressureAuthority(
    authorityBinding.receipt
  ), true);
  const bufferCountAfterWarmup = instrumentation.buffers.length;
  const releaseGate = deferred();
  const originalFenceProvider = device.queue.onSubmittedWorkDone;
  let releaseFenceCount = 0;
  device.queue.onSubmittedWorkDone = () => {
    releaseFenceCount += 1;
    return releaseGate.promise;
  };
  assert.equal(releaseSphSpatialGasLedgerEosAfterQueue(first), true);
  assert.equal(first.releaseScheduled, true);
  assert.equal(firstPrivate.gasPressureCellsBuffer.destroyCount, 0);
  assert.equal(releaseFenceCount, 1);
  releaseGate.resolve();
  assert.equal(await first.releasePromise, true);
  assert.equal(firstPrivate.gasPressureCellsBuffer.destroyCount, 0);
  device.queue.onSubmittedWorkDone = originalFenceProvider;

  const second = await runSphSpatialGasLedgerEosRetainedWebGpu({
    device,
    residentProductMass: source,
    ...retainedGasAuthorityArgs(occupancy)
  });
  assert.equal(second.ready, true, second.reason);
  const secondPrivate = ledgerPrivateBuffers(second, instrumentation);
  assert.deepEqual([
    secondPrivate.compactRowsBuffer,
    secondPrivate.activeNodeBuffer,
    secondPrivate.gasPressureCellsBuffer
  ], ownedBuffers);
  assert.equal(secondPrivate.gasPressureCellsBuffer.destroyed, false);
  assert.equal(secondPrivate.gasPressureCellsBuffer.destroyCount, 0);
  assert.equal(instrumentation.buffers.length, bufferCountAfterWarmup);
  assert.equal(second.arenaBufferReuseCount, 1);
  assert.equal(releaseSphSpatialGasLedgerEosAfterQueue(second), true);
  assert.equal(await second.releasePromise, true);

  const stats = sphSpatialGasLedgerEosArenaStats(device);
  assert.equal(Object.isFrozen(stats), true);
  assert.deepEqual(reachableCreatedBuffers([stats], instrumentation), []);
  assert.deepEqual(reachableAuthorityFunctionPaths([stats]), []);
  assert.equal(stats.runtimeCount, 1);
  assert.equal(stats.inUseSlotCount, 0);
  assert.equal(stats.reuseCount, 1);
  const retainedArenaPrefix =
    `ulg-sph-spatial-gas-ledger-eos-${first.arenaCapacity}-arena-`;
  const retainedArenaBuffers = instrumentation.buffers.filter(
    (buffer) => String(buffer.label).startsWith(retainedArenaPrefix)
  );
  const freeVolumeArenaBuffers = retainedArenaBuffers.filter(
    (buffer) => String(buffer.label).includes('-gas-free-volume-arena-')
  );
  const ledgerArenaBuffers = retainedArenaBuffers.filter(
    (buffer) => !freeVolumeArenaBuffers.includes(buffer)
  );
  const retainedByteLength = (buffers) => buffers.reduce(
    (sum, buffer) => sum + buffer.size,
    0
  );
  assert.equal(
    freeVolumeArenaBuffers.length,
    SPH_SPATIAL_GAS_LEDGER_EOS_ARENA_COUNT * 3
  );
  assert.equal(stats.retainedBufferCount, retainedArenaBuffers.length);
  assert.equal(
    stats.retainedBufferCount - ledgerArenaBuffers.length,
    freeVolumeArenaBuffers.length
  );
  assert.equal(
    stats.retainedBufferByteLength,
    retainedByteLength(retainedArenaBuffers)
  );
  assert.equal(
    stats.retainedBufferByteLength - retainedByteLength(ledgerArenaBuffers),
    retainedByteLength(freeVolumeArenaBuffers)
  );
  await releaseOccupancyFixture(device, occupancy);
  assert.equal(destroySphSpatialGasLedgerEosGpu(device), true);
  for (const buffer of ownedBuffers) assert.equal(buffer.destroyCount, 1);
  assert.equal(firstPrivate.gasPressureCellsBuffer.destroyCount, 1);
});

test('retained arena backpressure counts every Promise.any loop await exactly once', async () => {
  const { device, instrumentation } = fakeDevice();
  const source = retainedProductEventSource(device, 4);
  const occupancy = retainedGasOccupancyFixture(device, {
    particleCount: 4,
    gridSpacingM: 0.5
  });
  const argumentsForRun = {
    device,
    residentProductMass: source,
    ...retainedGasAuthorityArgs(occupancy)
  };
  const retained = [];
  for (let index = 0; index < 3; index += 1) {
    const execution = await runSphSpatialGasLedgerEosRetainedWebGpu(
      argumentsForRun
    );
    assert.equal(execution.ready, true, execution.reason);
    retained.push(execution);
  }

  const releaseGates = [deferred(), deferred()];
  const originalFence = device.queue.onSubmittedWorkDone;
  let releaseGateIndex = 0;
  device.queue.onSubmittedWorkDone = () => {
    instrumentation.queueFenceCount += 1;
    const gate = releaseGates[releaseGateIndex];
    releaseGateIndex += 1;
    assert.ok(gate, 'only the two controlled owner releases may fence');
    return gate.promise;
  };
  assert.equal(releaseSphSpatialGasLedgerEosAfterQueue(retained[0]), true);
  assert.equal(releaseSphSpatialGasLedgerEosAfterQueue(retained[1]), true);

  const pending = [
    runSphSpatialGasLedgerEosRetainedWebGpu(argumentsForRun),
    runSphSpatialGasLedgerEosRetainedWebGpu(argumentsForRun)
  ];
  await Promise.resolve();
  await Promise.resolve();
  releaseGates[0].resolve();
  await new Promise((resolve) => setImmediate(resolve));
  releaseGates[1].resolve();
  const resumed = await Promise.all(pending);
  device.queue.onSubmittedWorkDone = originalFence;

  assert.deepEqual(
    resumed.map((execution) => execution.arenaBackpressureWaitCount).sort(),
    [1, 2]
  );
  for (const execution of resumed) {
    assert.equal(execution.ready, true, execution.reason);
    assert.equal(execution.arenaBackpressureWaited, true);
    assert.equal(
      execution.observedHostQueueFenceCount,
      execution.arenaBackpressureWaitCount
    );
    assert.equal(
      execution.awaitedBackpressureHostQueueFenceCount,
      execution.arenaBackpressureWaitCount
    );
    assert.equal(execution.deferredCleanupHostQueueFenceCount, 0);
    const localBackpressure = execution.readbackTelemetrySourceBreakdown.find(
      (entry) => entry.source.includes(
        'retained-spatial-gas-eos:spatial-gas-arena-release-backpressure'
      )
    );
    assert.equal(
      localBackpressure?.awaitedBackpressureHostQueueFenceCount,
      execution.arenaBackpressureWaitCount
    );
  }
  assert.equal(instrumentation.queueFenceCount, 2);

  for (const execution of [retained[2], ...resumed]) {
    assert.equal(releaseSphSpatialGasLedgerEosAfterQueue(execution), true);
    const cleanup = execution.deferredCleanupReadbackTelemetrySnapshot();
    assert.equal(cleanup.observedHostQueueFenceCount, 1);
    assert.equal(cleanup.deferredCleanupHostQueueFenceCount, 1);
    assert.equal(await execution.releasePromise, true);
  }
  await releaseOccupancyFixture(device, occupancy);
  assert.equal(source.__ulgActiveBorrowCount, 0);
  assert.equal(destroySphSpatialGasLedgerEosGpu(device), true);
});

test('an unconfirmed final-consumer fence quarantines ownership until device loss', async () => {
  const { device, lost, instrumentation } = fakeDevice();
  device.queue.onSubmittedWorkDone = () => {
    instrumentation.queueFenceCount += 1;
    return Promise.reject(new Error('synthetic unconfirmed fence'));
  };
  const source = retainedProductEventSource(device, 4);
  const occupancy = retainedGasOccupancyFixture(device, {
    particleCount: 4,
    gridSpacingM: 0.5
  });
  const result = await runSphSpatialGasLedgerEosRetainedWebGpu({
    device,
    residentProductMass: source,
    ...retainedGasAuthorityArgs(occupancy)
  });
  assert.equal(result.ready, true, result.reason);
  const privateBuffers = ledgerPrivateBuffers(result, instrumentation);
  const ownedBuffers = [
    privateBuffers.compactRowsBuffer,
    privateBuffers.activeNodeBuffer,
    privateBuffers.gasPressureCellsBuffer
  ];

  assert.equal(releaseSphSpatialGasLedgerEosAfterQueue(result), true);
  assert.equal(await result.releasePromise, false);
  assert.equal(releaseSphSpatialGasLedgerEosAfterQueue(result), false);
  assert.equal(
    releaseSphSpatialGasLedgerEosAfterQueue(result),
    false
  );
  assert.equal(instrumentation.queueFenceCount, 1);
  assert.equal(result.releaseAttempted, true);
  assert.equal(result.releaseScheduled, true);
  assert.equal(result.releaseQuarantined, true);
  assert.equal(result.released, false);
  assert.equal(
    result.releaseStatus,
    'spatial-gas-ledger-eos-release-unconfirmed'
  );
  assert.equal(source.__ulgActiveBorrowCount, 1);
  const rejectedCleanupTelemetry =
    result.deferredCleanupReadbackTelemetrySnapshot();
  assert.equal(rejectedCleanupTelemetry.readbackTelemetryComplete, false);
  assert.equal(rejectedCleanupTelemetry.observedHostQueueFenceCount, 1);
  assert.equal(rejectedCleanupTelemetry.deferredCleanupHostQueueFenceCount, 1);
  assert.ok(
    rejectedCleanupTelemetry.readbackTelemetryUnknownSources.includes(
      'spatial-gas-final-consumer-cleanup-fence-unconfirmed'
    )
  );
  assert.equal(sphSpatialGasLedgerEosArenaStats(device).inUseSlotCount, 1);
  assert.equal(destroySphSpatialGasLedgerEosGpu(device), false);
  for (const buffer of ownedBuffers) assert.equal(buffer.destroyCount, 0);

  lost.resolve({ reason: 'destroyed', message: 'synthetic test loss' });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(source.__ulgActiveBorrowCount, 0);
  assert.equal(sphSpatialGasLedgerEosArenaStats(device).terminal, true);
  for (const buffer of ownedBuffers) assert.equal(buffer.destroyCount, 1);
});

test('shader contract unions phase-pure particles with residual products before SS EOS reduction', () => {
  assert.equal(SPH_SPATIAL_GAS_LEDGER_EOS_DIRECTORY_ABI.directoryAuthority,
    'generic-schroeder-spatial-epoch-v1');
  assert.equal(
    SPH_SPATIAL_GAS_LEDGER_EOS_DIRECTORY_ABI.sourceFamily,
    'sph-particle-and-reaction-residual-gas-ledger'
  );
  assert.equal(
    SPH_SPATIAL_GAS_LEDGER_EOS_DIRECTORY_ABI.candidateUnionOrder,
    'unplaced-product-event-prefix-then-phase-pure-particle-prefix'
  );
  assert.equal(
    SPH_SPATIAL_GAS_LEDGER_EOS_DIRECTORY_ABI.compactRowLayout[8],
    'sourceDiscriminant:f32(-1=particle,nonnegative=productTermIndex)'
  );
  assert.equal(
    SPH_SPATIAL_GAS_LEDGER_EOS_DIRECTORY_ABI.compactRowLayout[9],
    'sourceRowOrParticleIndex:f32'
  );
  assert.equal(
    SPH_SPATIAL_GAS_LEDGER_EOS_DIRECTORY_ABI.pressureCellLayout[11],
    'freeVolumeM3:f32'
  );
  assert.match(
    sphSpatialGasLedgerProductEventAdapterWgsl,
    /candidate_offsets\[last\] \+ candidate_flags\[last\]/
  );
  assert.match(sphSpatialGasLedgerProductEventAdapterWgsl, /fn classify_gas_candidates/);
  assert.doesNotMatch(
    sphSpatialGasLedgerProductEventAdapterWgsl,
    /fn classify_product_events/
  );
  assert.match(
    sphSpatialGasLedgerProductEventAdapterWgsl,
    /@binding\(7\) var<storage, read> particle_state/
  );
  assert.match(
    sphSpatialGasLedgerProductEventAdapterWgsl,
    /@binding\(8\) var<storage, read> particle_thermo/
  );
  assert.match(
    sphSpatialGasLedgerProductEventAdapterWgsl,
    /let pure_gas = gas_phase_declared[\s\S]*?gas_fraction - 1\.0[\s\S]*?particle_valid = pure_gas/
  );
  assert.match(
    sphSpatialGasLedgerProductEventAdapterWgsl,
    /represented_entities[\s\S]*?AVOGADRO_ENTITIES_PER_MOL[\s\S]*?source_discriminant = -1\.0[\s\S]*?source_row_index = f32\(particle_index\)/
  );
  assert.match(
    sphSpatialGasLedgerProductEventAdapterWgsl,
    /mass_kg = unplaced_mass[\s\S]*?source_discriminant = product_events\[source \+ 5u\][\s\S]*?source_row_index = f32\(source_index\)/
  );
  assert.match(sphSpatialGasLedgerProductEventAdapterWgsl, /fn finalize_compaction/);
  assert.match(sphSpatialGasLedgerProductEventAdapterWgsl, /fn scatter_compact_rows/);
  assert.equal(
    SPH_SPATIAL_GAS_AUTHORITY_ERROR.PRODUCT_HISTORY_AUTHORITY_INVALID,
    1 << 9
  );
  assert.match(
    sphSpatialGasLedgerProductEventAdapterWgsl,
    /fn product_history_authority_ready\(\)[\s\S]*?expected_product_history_magic[\s\S]*?expected_product_history_version[\s\S]*?expected_product_history_ready_status[\s\S]*?expected_product_history_failed_status[\s\S]*?expected_product_history_row_capacity[\s\S]*?expected_product_history_row_stride_vec4[\s\S]*?expected_product_history_generation[\s\S]*?expected_product_history_seal/
  );
  assert.match(
    sphSpatialGasLedgerProductEventAdapterWgsl,
    /ERROR_PRODUCT_HISTORY_AUTHORITY_INVALID: u32 = 512u/
  );
  assert.match(
    sphSpatialGasLedgerProductEventAdapterWgsl,
    /fn zero_publication_outputs\(\)[\s\S]*?authority\[8u\][\s\S]*?authority\[11u\][\s\S]*?word < 28u/
  );
  assert.match(
    runSphSpatialGasLedgerEosRetainedWebGpu.toString(),
    /controlOffsetBytes[\s\S]*?controlPrefixByteLength/
  );
  assert.match(
    runSphSpatialGasLedgerEosRetainedWebGpu.toString(),
    /compactionScan\.prepare[\s\S]*?finalizePass[\s\S]*?scatterPass/
  );
  assert.match(
    sphSpatialGasLedgerEosWgsl,
    /member_begin[\s\S]*?member_end[\s\S]*?cell_members_offset_words/
  );
  assert.match(sphSpatialGasLedgerEosWgsl, /fn find_cell\([\s\S]*?high - low/);
  assert.match(sphSpatialGasLedgerEosWgsl, /fn derive_gradients/);
  assert.match(sphSpatialGasLedgerEosWgsl, /fn finalize_eos/);
  assert.match(
    sphSpatialGasLedgerEosWgsl,
    /@group\(0\) @binding\(5\) var<storage, read> gas_free_volume/
  );
  assert.match(
    sphSpatialGasLedgerEosWgsl,
    /@group\(0\) @binding\(6\) var<storage, read> gas_free_volume_control/
  );
  assert.match(sphSpatialGasLedgerEosWgsl, /fn free_volume_contract_ready/);
  assert.match(sphSpatialGasLedgerEosWgsl, /FREE_VOLUME_VERSION: u32 = 2u/);
  assert.match(
    sphSpatialGasLedgerEosWgsl,
    /gas_constant_j_per_mol_k \/ free_volume_m3/
  );
  assert.doesNotMatch(
    sphSpatialGasLedgerEosWgsl,
    /gas_constant_j_per_mol_k \/ (?:total_volume|represented_volume)/
  );
  assert.match(sphSpatialGasLedgerEosWgsl, /READY_PRESSURE_COUNT|authority\[11u\]/);
  assert.equal(
    SPH_SPATIAL_GAS_LEDGER_EOS_DIRECTORY_ABI.sparseSourcePolicy,
    'stable-gpu-compacted-logical-prefix-with-capacity-sized-allocation'
  );
  assert.doesNotMatch(
    sphSpatialGasLedgerEosWgsl,
    /for\s*\([^)]*source_row_count[^)]*\)[\s\S]*?find_cell/
  );
  assert.doesNotMatch(
    runSphSpatialGasLedgerEosRetainedWebGpu.toString(),
    /\.mapAsync\(|\.getMappedRange\(|\.onSubmittedWorkDone\(|\.clearBuffer\(/
  );
});

test('native Vulkan WebGPU computes multi-species EOS/gradients and remains validation-clean at 65,536 sparse rows', {
  skip: RUN_NATIVE
    ? false
    : 'set ULG_RUN_NATIVE_SPATIAL_GAS_LEDGER_EOS=1 for native Vulkan WebGPU',
  timeout: 900_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: [
      '--use-angle=vulkan',
      '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu',
      '--ignore-gpu-blocklist'
    ]
  });
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(BASE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000
    });
    const native = await page.evaluate(async () => {
      const adapter = await navigator.gpu?.requestAdapter({
        powerPreference: 'high-performance'
      });
      if (!adapter) {
        return { status: 'unsupported', reason: 'WebGPU adapter unavailable' };
      }
      const device = await adapter.requestDevice({
        requiredLimits: { maxStorageBuffersPerShaderStage: 8 }
      });
      const uncapturedErrors = [];
      device.addEventListener('uncapturederror', (event) => {
        uncapturedErrors.push(event.error?.message || String(event.error));
      });
      device.pushErrorScope('validation');
      device.pushErrorScope('internal');
      device.pushErrorScope('out-of-memory');
      const pressureModulePath =
        '/src/runtime/sph/sphPressureInterfaceGpuKernel.js';
      const pressureModuleSource = await fetch(pressureModulePath).then(
        (response) => response.text()
      );
      const pressureGasDependency = pressureModuleSource.match(
        /from "([^"]*\/sphSpatialGasLedgerEosGpu\.js[^"]*)"/
      )?.[1];
      if (!pressureGasDependency) {
        throw new Error('Unable to resolve the pressure module gas-authority dependency');
      }
      const pressureModule = await import(pressureModulePath);
      const module = await import(pressureGasDependency);
      const gasModuleSource = await fetch(pressureGasDependency).then(
        (response) => response.text()
      );
      const spatialDependency = gasModuleSource.match(
        /from "([^"]*\/schroederSpatialEpochGpu\.js[^"]*)"/
      )?.[1];
      const productHistoryDependency = gasModuleSource.match(
        /from "([^"]*\/sphResidentProductHistoryGpu\.js[^"]*)"/
      )?.[1];
      if (!spatialDependency) {
        throw new Error(
          'Unable to resolve the gas module spatial-generation dependency'
        );
      }
      if (!productHistoryDependency) {
        throw new Error(
          'Unable to resolve the gas module product-history dependency'
        );
      }
      const identity = await import(
        '/src/runtime/sph/sphGpuDeviceIdentity.js'
      );
      const spatialModule = await import(spatialDependency);
      const productHistoryModule = await import(productHistoryDependency);

      const makeSource = (values, label) => {
        const productEventBuffer = identity.tagWebGpuBufferDevice(
          device.createBuffer({
            label,
            size: values.byteLength,
            usage: GPUBufferUsage.STORAGE
              | GPUBufferUsage.COPY_SRC
              | GPUBufferUsage.COPY_DST
          }),
          device
        );
        device.queue.writeBuffer(productEventBuffer, 0, values);
        let activeBorrowCount = 0;
        const source = {
          schema: 'peercompute.ulg.sph-resident-product-mass.v0',
          status: 'resident-product-mass-buffer-retained',
          productEventBuffer,
          productEventBufferRetained: true,
          productEventBufferByteLength: values.byteLength,
          productEventRowCount: values.length / 32,
          productEventStrideFloats: 32,
          productEventDevice: device
        };
        Object.defineProperty(source, '__ulgActiveBorrowCount', {
          get() { return activeBorrowCount; },
          set(value) { activeBorrowCount = Math.max(0, Number(value) | 0); }
        });
        identity.tagResidentProductMassDevice(source, device);
        return source;
      };
      const attachProductHistoryAuthority = (source, {
        liveRowCount,
        generation,
        seal,
        status = productHistoryModule
          .SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_STATUS_READY
      }) => {
        const controlBuffer = device.createBuffer({
          label: `${source.productEventBuffer.label}-count-authority`,
          size: productHistoryModule
            .SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_RECORD_BYTES,
          usage: GPUBufferUsage.STORAGE
            | GPUBufferUsage.COPY_SRC
            | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(
          controlBuffer,
          0,
          productHistoryModule.createResidentProductEventCountControlWords({
            status,
            liveRowCount,
            rowCapacity: source.productEventRowCount,
            rowStrideVec4: source.productEventStrideFloats / 4,
            generation,
            seal
          })
        );
        productHistoryModule.registerResidentProductEventCountAuthority(
          source,
          {
            device,
            controlBuffer,
            controlOffsetBytes: 0,
            rowCapacity: source.productEventRowCount,
            rowStrideFloats: source.productEventStrideFloats,
            generation,
            seal
          }
        );
        return controlBuffer;
      };
      const setEvent = (values, row, {
        position,
        massKg,
        materialId,
        productTermIndex,
        moles,
        temperatureK,
        supportVolumeM3,
        placedMassKg = 0,
        unplacedMassKg = massKg,
        routingId = 1,
        status = 1
      }) => {
        const offset = row * 32;
        values.set(position, offset);
        values[offset + 3] = massKg;
        values[offset + 4] = materialId;
        values[offset + 5] = productTermIndex;
        values[offset + 9] = moles;
        values[offset + 10] = routingId;
        values[offset + 12] = placedMassKg;
        values[offset + 13] = unplacedMassKg;
        values[offset + 16] = temperatureK;
        values[offset + 17] = massKg / supportVolumeM3;
        values[offset + 18] = status;
        values[offset + 23] = supportVolumeM3;
      };
      const epochs = {
        storageGeneration: 7,
        physicsTick: 9,
        physicsSubstep: 0,
        positionEpoch: 11,
        topologyEpoch: 13,
        chartEpoch: 15,
        levelEpoch: 17,
        supportEpoch: 19
      };
      const makeOccupancyGeneration = (
        generationEpochs,
        label,
        { particle = null } = {}
      ) => {
        const makeBuffer = (suffix, values) => {
          const buffer = identity.tagWebGpuBufferDevice(
            device.createBuffer({
              label: `${label}-${suffix}`,
              size: values.byteLength,
              usage: GPUBufferUsage.STORAGE
                | GPUBufferUsage.COPY_SRC
                | GPUBufferUsage.COPY_DST
            }),
            device
          );
          device.queue.writeBuffer(buffer, 0, values);
          return buffer;
        };
        const defaultParticle = {
          position: [0.25, 0.25, 0.25],
          massKg: 125,
          materialId: 1,
          phaseId: 2,
          temperatureK: 293.15,
          restDensityKgPerM3: 1000,
          phaseFractions: [0, 1, 0, 0],
          representedEntityCount: 1,
          status: 1,
          solidFlag: 1
        };
        const particleSpecs = Array.isArray(particle)
          ? particle
          : [particle || defaultParticle];
        const particleCount = particleSpecs.length;
        const assignment = new Float32Array(particleCount * 16);
        const state = new Float32Array(particleCount * 8);
        const thermo = new Float32Array(particleCount * 12);
        const mechanics = new Float32Array(particleCount * 32);
        for (let index = 0; index < particleCount; index += 1) {
          const particleSpec = particleSpecs[index];
          const representedVolumeM3 =
            particleSpec.massKg / particleSpec.restDensityKgPerM3;
          assignment.set([
            0, 1, 1, representedVolumeM3,
            representedVolumeM3, representedVolumeM3,
            particleSpec.massKg, particleSpec.restDensityKgPerM3,
            particleSpec.phaseId, particleSpec.materialId,
            particleSpec.status, 0,
            ...particleSpec.position, 0
          ], index * 16);
          state.set([
            ...particleSpec.position, particleSpec.massKg,
            0, 0, 0, 1
          ], index * 8);
          thermo.set([
            particleSpec.materialId,
            particleSpec.phaseId,
            particleSpec.temperatureK,
            particleSpec.restDensityKgPerM3,
            ...particleSpec.phaseFractions,
            1,
            particleSpec.representedEntityCount,
            particleSpec.status,
            0.1
          ], index * 12);
          const mechanicsOffset = index * 32;
          mechanics[mechanicsOffset + 18] = 1;
          mechanics[mechanicsOffset + 19] = representedVolumeM3;
          mechanics[mechanicsOffset + 20] = particleSpec.solidFlag || 0;
          mechanics[mechanicsOffset + 21] = 1;
          mechanics[mechanicsOffset + 31] = particleSpec.massKg;
        }
        const assignmentBuffer = makeBuffer('assignment', assignment);
        const sourceStateBuffer = makeBuffer('state', state);
        const sourceThermoBuffer = makeBuffer('thermo', thermo);
        const sourceMechanicsBuffer = makeBuffer('mechanics-v0j', mechanics);
        const particleIdentityBuffer = makeBuffer(
          'identity',
          Uint32Array.from(
            { length: particleCount },
            (_, index) => index + 1
          )
        );
        const spatialGasGrid = {
          selectedLevel: 0,
          gridDims: [9, 9, 9],
          gridNodeCount: 729,
          gridShift: 2,
          gridSpacingM: 1
        };
        const sphParticleUpload = {
          schema: 'peercompute.ulg.sph-gpu-particle-buffer-set.v0',
          status: 'webgpu-uploaded',
          particleCount,
          stateBuffer: sourceStateBuffer,
          stateBufferByteLength: sourceStateBuffer.size,
          stateStrideBytes: 32,
          thermoBuffer: sourceThermoBuffer,
          thermoBufferByteLength: sourceThermoBuffer.size,
          thermoStrideBytes: 48,
          identityBuffer: particleIdentityBuffer,
          identityBufferByteLength: particleIdentityBuffer.size,
          identityStrideBytes: 4,
          ...generationEpochs
        };
        const mlsMpmParticleUpload = {
          schema: 'peercompute.ulg.mls-mpm-gpu-particle-buffer-set.v0',
          status: 'webgpu-uploaded',
          particleCount,
          mechanicsBuffer: sourceMechanicsBuffer,
          mechanicsBufferByteLength: sourceMechanicsBuffer.size,
          mechanicsStrideBytes: 128,
          ...generationEpochs
        };
        const levelAssignment = {
          schema:
            'peercompute.ulg.schroeder-level-assignment-execution.v0',
          status: 'schroeder-level-assignment-submitted',
          bufferFamilyGenerationStatus:
            'schroeder-particle-buffer-family-generation-ready',
          particleCount,
          assignmentStrideFloats: 16,
          assignmentBuffer,
          assignmentBufferByteLength: assignmentBuffer.size,
          sourceStateBuffer,
          sourceStateBufferBorrowed: true,
          sourceStateBufferByteLength: sourceStateBuffer.size,
          sourceThermoBuffer,
          sourceThermoBufferBorrowed: true,
          sourceThermoBufferByteLength: sourceThermoBuffer.size,
          sourceIdentityBuffer: particleIdentityBuffer,
          sourceIdentityBufferBorrowed: true,
          sourceIdentityBufferByteLength: particleIdentityBuffer.size,
          sourceMechanicsBuffer,
          sourceMechanicsBufferBorrowed: true,
          sourceMechanicsBufferByteLength: sourceMechanicsBuffer.size,
          ...generationEpochs,
          minLevel: 0,
          maxLevel: 0,
          chartId: 0,
          baseGridSpacingM: 1
        };
        const generation =
          spatialModule.runSchroederSpatialEpochGenerationWebGpu({
            device,
            levelAssignment,
            particleCount,
            particleIdentityBuffer,
            particleIdentityStrideWords: 1,
            selectedLevel: 0,
            mechanicsGrid: spatialGasGrid,
            exactNearCellTreeEnabled: false
          });
        if (
          generation.ready !== true
          || !generation.mechanicsLevelViews?.[0]?.phaseVolumeMoment
        ) {
          throw new Error(
            `Native gas occupancy generation rejected: ${
              generation.reason || generation.status
            }`
          );
        }
        return {
          generation,
          spatialGasGrid,
          levelAssignment,
          sphParticleUpload,
          mlsMpmParticleUpload
        };
      };
      const authorityArgs = (occupancy, generationEpochs) => ({
        epochIdentity: generationEpochs,
        schroederSpatialEpochGeneration: occupancy.generation,
        spatialGasGrid: occupancy.spatialGasGrid,
        boxMinM: [0, 0, 0],
        boxMaxM: [4, 4, 4],
        spatialGasCellSizeM: 1,
        spatialGasSupportVolumeFallbackM3: 0
      });
      const releaseOccupancyGeneration = async (occupancy) => {
        const scheduled =
          spatialModule.releaseSchroederSpatialEpochGenerationAfterQueue(
            occupancy.generation,
            device
          );
        return scheduled
          ? await occupancy.generation.releasePromise
          : occupancy.generation.execution.released === true;
      };

      const rows = new Float32Array(4 * 32);
      setEvent(rows, 0, {
        position: [0.25, 0.25, 0.25],
        massKg: 0.1,
        materialId: 9,
        productTermIndex: 0,
        moles: 1,
        temperatureK: 300,
        supportVolumeM3: 0.5
      });
      setEvent(rows, 1, {
        position: [0.3, 0.25, 0.25],
        massKg: 0.2,
        materialId: 17,
        productTermIndex: 1,
        moles: 2,
        temperatureK: 400,
        supportVolumeM3: 0.5
      });
      setEvent(rows, 2, {
        position: [1.25, 0.25, 0.25],
        massKg: 0.1,
        materialId: 9,
        productTermIndex: 0,
        moles: 1,
        temperatureK: 600,
        supportVolumeM3: 0.5
      });
      // Row 3 remains an inactive sparse storage slot at the dummy SS cell.
      const source = makeSource(rows, 'native-spatial-gas-correctness-source');
      const sourceAuthorityControlBuffer = attachProductHistoryAuthority(
        source,
        {
          liveRowCount: 3,
          generation: 37,
          seal: 0x5a17c0de
        }
      );
      const occupancy = makeOccupancyGeneration(
        epochs,
        'native-spatial-gas-correctness-occupancy'
      );
      const execution = await module.runSphSpatialGasLedgerEosRetainedWebGpu({
        device,
        residentProductMass: source,
        ...authorityArgs(occupancy, epochs)
      });
      if (execution.ready !== true) {
        return {
          status: 'blocked',
          reason: execution.reason || execution.status,
          errorCode: execution.errorCode || null
        };
      }
      const normalTelemetry = {
        ready: execution.ready,
        status: execution.status,
        normalHotLoopReadbackFree: execution.normalHotLoopReadbackFree,
        mapAsyncCount: execution.mapAsyncCount,
        hostMaterializedRowCount: execution.hostMaterializedRowCount,
        queueCompletionFenceWaited: execution.queueCompletionFenceWaited,
        directoryBuildCount: execution.spatialDirectoryBuildCount,
        privateSpatialLookupBuildCount: execution.privateSpatialLookupBuildCount
      };
      let oracle;
      try {
        oracle = await module.observeSphSpatialGasLedgerEosOracle(execution);
      } catch (error) {
        const outOfMemoryError = await device.popErrorScope();
        const internalError = await device.popErrorScope();
        const validationError = await device.popErrorScope();
        return {
          status: 'blocked',
          reason: error instanceof Error ? error.message : String(error),
          gasAuthorityControl: Array.from(error?.controlWords || []),
          validationError: validationError?.message || null,
          internalError: internalError?.message || null,
          outOfMemoryError: outOfMemoryError?.message || null,
          uncapturedErrors
        };
      }
      const cells = oracle.pressureCells.map((cell) => ({
        gridIndex: cell.gridIndex,
        centerM: cell.centerM,
        pressurePa: cell.pressurePa,
        gradient: cell.pressureGradientPaPerM,
        volumeM3: cell.volumeM3
      }));
      const pressureResult =
        await pressureModule.runSphPressureInterfaceForceRowsWebGpu({
          device,
          pressureFeedback: {
            schema: 'peercompute.ulg.sph-sealed-gas-pressure-feedback.v0',
            status: 'wall-pressure-ledger-ready',
            totalPressurePa: 0
          },
          pressureInterfaceCoupling: {
            schema: 'peercompute.ulg.sph-pressure-interface-coupling.v0',
            status: 'pressure-interface-coupling-ready-for-solver',
            forceCouplingStatus: 'pressure-interface-coupling-ready'
          },
          materialInterfaceField: {
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
                surfaceKey: 'native-v3-pressure-left',
                material: 'h2o',
                phase: 'liquid',
                materialId: 1,
                phaseId: 2,
                axisId: 0,
                centroidM: [0.5, 0.5, 0.5],
                areaM2: 1,
                normal: [1, 0, 0],
                normalAreaVectorM2: [1, 0, 0],
                gapM: 0.1,
                normalVelocityMPerS: 0,
                representativeMassKg: 1
              },
              {
                status: 'interface-element-ready',
                surfaceIndex: 0,
                surfaceKey: 'native-v3-pressure-right',
                material: 'h2o',
                phase: 'liquid',
                materialId: 1,
                phaseId: 2,
                axisId: 0,
                centroidM: [1.5, 0.5, 0.5],
                areaM2: 1,
                normal: [-1, 0, 0],
                normalAreaVectorM2: [-1, 0, 0],
                gapM: 0.1,
                normalVelocityMPerS: 0,
                representativeMassKg: 1
              }
            ]
          },
          retainedGasPressureCellImport:
            execution.retainedGasCellFieldSource,
          retainForceRowsBuffer: false,
          readbackMode: 'full-parity-readback'
        });
      const pressureValues = Array.from(pressureResult.forceRowValues);
      const pressureConsumer = {
        status: pressureResult.status,
        modelId: pressureResult.pressureInterfaceForceSolver.pressureModelId,
        authoritySubmitted:
          pressureResult.gasPressureAuthorityConsumerSubmitted,
        authorityAuthenticationEnforced:
          pressureResult.gasPressureAuthorityGpuAuthenticationEnforced,
        authorityAuthenticationObserved:
          pressureResult.gasPressureAuthorityGpuAuthenticationObserved,
        uniformPressurePa:
          pressureResult.pressureInterfaceForceSolver.gasInterfacePressurePa,
        forceAggregateObserved:
          pressureResult.pressureInterfaceForceSolver.forceAggregateSummaryObserved,
        rowPressuresPa: [pressureValues[14], pressureValues[30]],
        rowReady: [pressureValues[15], pressureValues[31]],
        rowCount: pressureResult.gasPressureCellRowCount,
        rowCapacity: pressureResult.gasPressureCellRowCapacity,
        logicalCountGpuAuthored:
          pressureResult.gasPressureCellLogicalCountGpuAuthored,
        sourceConsumerSubmitted:
          execution.retainedGasCellFieldSource
            .gasPressureAuthorityConsumerSubmitted,
        sourceExact: module.isExactSphSpatialGasPressureAuthoritySource(
          execution.retainedGasCellFieldSource
        ),
        retainedStatus: pressureResult.retainedGasPressureRowsStatus,
        retainedReason: pressureResult.retainedGasPressureRowsReason
      };
      const releaseScheduled =
        module.releaseSphSpatialGasLedgerEosAfterQueue(execution);
      const releaseConfirmed = releaseScheduled
        ? await execution.releasePromise
        : execution.released === true;
      const occupancyReleaseConfirmed =
        await releaseOccupancyGeneration(occupancy);
      source.productEventBuffer.destroy();
      sourceAuthorityControlBuffer.destroy();

      const runParticleUnionOracleCase = async ({
        label,
        generationEpochs,
        particle,
        productValues = null
      }) => {
        const unionOccupancy = makeOccupancyGeneration(
          generationEpochs,
          `${label}-occupancy`,
          { particle }
        );
        const unionProductSource = productValues
          ? makeSource(productValues, `${label}-products`)
          : null;
        const unionProductControl = unionProductSource
          ? attachProductHistoryAuthority(unionProductSource, {
              liveRowCount: 1,
              generation: generationEpochs.storageGeneration + 100,
              seal: 0x5a170000 + generationEpochs.storageGeneration
            })
          : null;
        const unionExecution =
          await module.runSphSpatialGasLedgerEosRetainedWebGpu({
            device,
            ...(unionProductSource
              ? { residentProductMass: unionProductSource }
              : {}),
            sphParticleUpload: unionOccupancy.sphParticleUpload,
            mlsMpmParticleUpload: unionOccupancy.mlsMpmParticleUpload,
            schroederLevelAssignment: unionOccupancy.levelAssignment,
            ...authorityArgs(unionOccupancy, generationEpochs)
          });
        if (unionExecution.ready !== true) {
          throw new Error(JSON.stringify({
            label,
            status: unionExecution.status,
            reason: unionExecution.reason,
            errorCode: unionExecution.errorCode || null
          }));
        }
        let unionOracle;
        try {
          unionOracle =
            await module.observeSphSpatialGasLedgerEosOracle(unionExecution);
        } catch (error) {
          throw new Error(JSON.stringify({
            label,
            reason: error instanceof Error ? error.message : String(error),
            control: Array.from(error?.controlWords || [])
          }));
        }
        const unionReleaseScheduled =
          module.releaseSphSpatialGasLedgerEosAfterQueue(unionExecution);
        const unionReleaseConfirmed = unionReleaseScheduled
          ? await unionExecution.releasePromise
          : unionExecution.released === true;
        const unionOccupancyReleaseConfirmed =
          await releaseOccupancyGeneration(unionOccupancy);
        unionProductSource?.productEventBuffer.destroy();
        unionProductControl?.destroy();
        return {
          sourceMode: unionExecution.sourceMode,
          gasCandidateUnionCount: unionExecution.gasCandidateUnionCount,
          productEventCandidateCapacity:
            unionExecution.productEventCandidateCapacity,
          particleCount: unionExecution.particleCount,
          liveCount: unionOracle.liveResidualCount,
          empty: unionOracle.empty,
          directoryCellCount: unionOracle.directoryCellCount,
          readyPressureCount: unionOracle.readyPressureCount,
          compactRows: unionOracle.compactRows.map((row) => ({
            sourceKind: row.sourceKind,
            sourceDiscriminant: row.sourceDiscriminant,
            sourceRowIndex: row.sourceRowIndex,
            massKg: row.massKg,
            moles: row.moles,
            supportVolumeM3: row.supportVolumeM3
          })),
          pressureCells: unionOracle.pressureCells.map((cell) => ({
            pressurePa: cell.pressurePa,
            freeVolumeM3: cell.volumeM3,
            status: cell.status
          })),
          releaseScheduled: unionReleaseScheduled,
          releaseConfirmed: unionReleaseConfirmed,
          occupancyReleaseConfirmed: unionOccupancyReleaseConfirmed
        };
      };
      const particleOnlyEpochs = {
        ...epochs,
        storageGeneration: 20,
        physicsTick: 22,
        positionEpoch: 24
      };
      const particleOnlyCase = await runParticleUnionOracleCase({
        label: 'native-spatial-gas-particle-only',
        generationEpochs: particleOnlyEpochs,
        particle: {
          position: [2.25, 0.25, 0.25],
          massKg: 0.25,
          materialId: 9,
          phaseId: 3,
          temperatureK: 350,
          restDensityKgPerM3: 0.5,
          phaseFractions: [0, 0, 1, 0],
          representedEntityCount: Math.fround(2 * 6.02214076e23),
          status: 1,
          solidFlag: 0
        }
      });
      const mixedProductRows = new Float32Array(2 * 32);
      setEvent(mixedProductRows, 0, {
        position: [0.25, 0.25, 0.25],
        massKg: 1,
        placedMassKg: 0.75,
        unplacedMassKg: 0.25,
        materialId: 17,
        productTermIndex: 5,
        moles: 4,
        temperatureK: 425,
        supportVolumeM3: 2
      });
      const mixedEpochs = {
        ...epochs,
        storageGeneration: 21,
        physicsTick: 23,
        positionEpoch: 25
      };
      const mixedUnionCase = await runParticleUnionOracleCase({
        label: 'native-spatial-gas-mixed-union',
        generationEpochs: mixedEpochs,
        productValues: mixedProductRows,
        particle: {
          position: [1.25, 0.25, 0.25],
          massKg: 0.5,
          materialId: 31,
          phaseId: 3,
          temperatureK: 500,
          restDensityKgPerM3: 2,
          phaseFractions: [0, 0, 1, 0],
          representedEntityCount: Math.fround(0.5 * 6.02214076e23),
          status: 1,
          solidFlag: 0
        }
      });
      const emptyEpochs = {
        ...epochs,
        storageGeneration: 22,
        physicsTick: 24,
        positionEpoch: 26
      };
      const emptyUnionCase = await runParticleUnionOracleCase({
        label: 'native-spatial-gas-liquid-only-empty',
        generationEpochs: emptyEpochs,
        particle: {
          position: [0.75, 0.75, 0.75],
          massKg: 1,
          materialId: 1,
          phaseId: 2,
          temperatureK: 293.15,
          restDensityKgPerM3: 1000,
          phaseFractions: [0, 1, 0, 0],
          representedEntityCount: 1,
          status: 1,
          solidFlag: 1
        }
      });
      const particleUnionCases = {
        particleOnly: particleOnlyCase,
        mixed: mixedUnionCase,
        empty: emptyUnionCase
      };

      const runSparseOracleCase = async ({
        values,
        label,
        storageGeneration,
        physicsTick,
        positionEpoch
      }) => {
        const sparseSource = makeSource(values, label);
        const sparseEpochs = {
          ...epochs,
          storageGeneration,
          physicsTick,
          positionEpoch
        };
        const sparseOccupancy = makeOccupancyGeneration(
          sparseEpochs,
          `${label}-occupancy`
        );
        const sparseExecution =
          await module.runSphSpatialGasLedgerEosRetainedWebGpu({
            device,
            residentProductMass: sparseSource,
            ...authorityArgs(sparseOccupancy, sparseEpochs)
          });
        let sparseOracle;
        try {
          sparseOracle =
            await module.observeSphSpatialGasLedgerEosOracle(sparseExecution);
        } catch (error) {
          throw new Error(JSON.stringify({
            label,
            reason: error instanceof Error ? error.message : String(error),
            control: Array.from(error?.controlWords || [])
          }));
        }
        const sparseReleaseScheduled =
          module.releaseSphSpatialGasLedgerEosAfterQueue(sparseExecution);
        const sparseReleaseConfirmed = sparseReleaseScheduled
          ? await sparseExecution.releasePromise
          : false;
        const sparseOccupancyReleaseConfirmed =
          await releaseOccupancyGeneration(sparseOccupancy);
        sparseSource.productEventBuffer.destroy();
        return {
          ready: sparseExecution.ready,
          status: sparseExecution.status,
          inputRowCount: values.length / 32,
          liveCount: sparseOracle.liveResidualCount,
          compactRowCount: sparseOracle.compactRows.length,
          directoryCellCount: sparseOracle.directoryCellCount,
          readyPressureCount: sparseOracle.readyPressureCount,
          empty: sparseOracle.empty,
          releaseScheduled: sparseReleaseScheduled,
          releaseConfirmed: sparseReleaseConfirmed,
          occupancyReleaseConfirmed: sparseOccupancyReleaseConfirmed
        };
      };
      const emptyCase = await runSparseOracleCase({
        values: new Float32Array(4 * 32),
        label: 'native-spatial-gas-empty-source',
        storageGeneration: 8,
        physicsTick: 10,
        positionEpoch: 12
      });
      const oneRows = new Float32Array(4 * 32);
      setEvent(oneRows, 3, {
        position: [1.25, 0.25, 0.25],
        massKg: 0.1,
        materialId: 9,
        productTermIndex: 0,
        moles: 1,
        temperatureK: 500,
        supportVolumeM3: 0.5
      });
      const oneCase = await runSparseOracleCase({
        values: oneRows,
        label: 'native-spatial-gas-one-live-suffix-source',
        storageGeneration: 9,
        physicsTick: 11,
        positionEpoch: 13
      });
      const sparseLiveMatrix = [
        emptyCase,
        oneCase,
        {
          ready: execution.ready,
          status: execution.status,
          inputRowCount: rows.length / 32,
          liveCount: oracle.liveResidualCount,
          compactRowCount: oracle.compactRows.length,
          directoryCellCount: oracle.directoryCellCount,
          readyPressureCount: oracle.readyPressureCount,
          empty: oracle.empty,
          releaseScheduled,
          releaseConfirmed,
          occupancyReleaseConfirmed
        }
      ];

      const failedAuthorityRows = new Float32Array(32);
      setEvent(failedAuthorityRows, 0, {
        position: [0.25, 0.25, 0.25],
        massKg: 0.1,
        materialId: 9,
        productTermIndex: 0,
        moles: 1,
        temperatureK: 300,
        supportVolumeM3: 0.5
      });
      const failedAuthoritySource = makeSource(
        failedAuthorityRows,
        'native-spatial-gas-failed-product-history-authority'
      );
      const failedAuthorityControlBuffer = attachProductHistoryAuthority(
        failedAuthoritySource,
        {
          liveRowCount: 1,
          generation: 41,
          seal: 0x5a17c041,
          status: productHistoryModule
            .SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_STATUS_FAILED
        }
      );
      const failedAuthorityEpochs = {
        ...epochs,
        storageGeneration: 12,
        physicsTick: 14,
        positionEpoch: 16
      };
      const failedAuthorityOccupancy = makeOccupancyGeneration(
        failedAuthorityEpochs,
        'native-spatial-gas-failed-authority-occupancy'
      );
      const failedAuthorityExecution =
        await module.runSphSpatialGasLedgerEosRetainedWebGpu({
          device,
          residentProductMass: failedAuthoritySource,
          ...authorityArgs(
            failedAuthorityOccupancy,
            failedAuthorityEpochs
          )
        });
      let failedAuthorityControl = [];
      try {
        await module.observeSphSpatialGasLedgerEosOracle(
          failedAuthorityExecution
        );
      } catch (error) {
        failedAuthorityControl = Array.from(error?.controlWords || []);
      }
      const failedAuthorityReleaseScheduled =
        module.releaseSphSpatialGasLedgerEosAfterQueue(
          failedAuthorityExecution
        );
      const failedAuthorityReleaseConfirmed = failedAuthorityReleaseScheduled
        ? await failedAuthorityExecution.releasePromise
        : false;
      const failedAuthorityOccupancyReleaseConfirmed =
        await releaseOccupancyGeneration(failedAuthorityOccupancy);
      failedAuthoritySource.productEventBuffer.destroy();
      failedAuthorityControlBuffer.destroy();
      const failedAuthorityCase = {
        submissionReady: failedAuthorityExecution.ready,
        status: failedAuthorityExecution.status,
        normalHotLoopReadbackFree:
          failedAuthorityExecution.normalHotLoopReadbackFree,
        mapAsyncCount: failedAuthorityExecution.mapAsyncCount,
        control: failedAuthorityControl,
        releaseScheduled: failedAuthorityReleaseScheduled,
        releaseConfirmed: failedAuthorityReleaseConfirmed,
        occupancyReleaseConfirmed:
          failedAuthorityOccupancyReleaseConfirmed
      };

      const largeRows = new Float32Array(65_536 * 32);
      setEvent(largeRows, 65_535, {
        position: [1.25, 0.25, 0.25],
        massKg: 0.1,
        materialId: 9,
        productTermIndex: 0,
        moles: 1,
        temperatureK: 500,
        supportVolumeM3: 1
      });
      const largeSource = makeSource(
        largeRows,
        'native-spatial-gas-65536-source'
      );
      const largeEpochs = {
        ...epochs,
        storageGeneration: 10,
        physicsTick: 12,
        positionEpoch: 14
      };
      const largeOccupancy = makeOccupancyGeneration(
        largeEpochs,
        'native-spatial-gas-65536-occupancy'
      );
      const largeStartedAt = performance.now();
      const largeExecution =
        await module.runSphSpatialGasLedgerEosRetainedWebGpu({
          device,
          residentProductMass: largeSource,
          ...authorityArgs(largeOccupancy, largeEpochs)
        });
      const largeSubmitMs = performance.now() - largeStartedAt;
      const largeReleaseScheduled =
        module.releaseSphSpatialGasLedgerEosAfterQueue(largeExecution);
      const largeReleaseConfirmed = largeReleaseScheduled
        ? await largeExecution.releasePromise
        : false;
      const largeOccupancyReleaseConfirmed =
        await releaseOccupancyGeneration(largeOccupancy);
      largeSource.productEventBuffer.destroy();
      const arenaStats = module.sphSpatialGasLedgerEosArenaStats(device);
      const arenaDestroyed = module.destroySphSpatialGasLedgerEosGpu(device);

      const outOfMemoryError = await device.popErrorScope();
      const internalError = await device.popErrorScope();
      const validationError = await device.popErrorScope();
      await new Promise((resolve) => setTimeout(resolve, 0));
      device.destroy();
      return {
        status: 'complete',
        normalTelemetry,
        compactRowCount: oracle.compactRows.length,
        directoryCellCount: oracle.directoryCellCount,
        cells,
        pressureConsumer,
        particleUnionCases,
        sparseLiveMatrix,
        failedAuthorityCase,
        releaseScheduled,
        releaseConfirmed,
        occupancyReleaseConfirmed,
        large: {
          ready: largeExecution.ready,
          status: largeExecution.status,
          rowCount: largeExecution.productEventRowCount,
          mapAsyncCount: largeExecution.mapAsyncCount,
          hostMaterializedRowCount: largeExecution.hostMaterializedRowCount,
          queueCompletionFenceWaited:
            largeExecution.queueCompletionFenceWaited,
          submitMs: largeSubmitMs,
          releaseScheduled: largeReleaseScheduled,
          releaseConfirmed: largeReleaseConfirmed,
          occupancyReleaseConfirmed: largeOccupancyReleaseConfirmed
        },
        arenaStats,
        arenaDestroyed,
        validationError: validationError?.message || null,
        internalError: internalError?.message || null,
        outOfMemoryError: outOfMemoryError?.message || null,
        uncapturedErrors
      };
    });

  assert.equal(native.status, 'complete', JSON.stringify(native));
    assert.deepEqual(native.normalTelemetry, {
      ready: true,
      status: 'spatial-gas-ledger-eos-gpu-submitted',
      normalHotLoopReadbackFree: true,
      mapAsyncCount: 0,
      hostMaterializedRowCount: 0,
      queueCompletionFenceWaited: false,
      directoryBuildCount: 1,
      privateSpatialLookupBuildCount: 0
    });
    const particleOnly = native.particleUnionCases.particleOnly;
    assert.deepEqual({
      sourceMode: particleOnly.sourceMode,
      gasCandidateUnionCount: particleOnly.gasCandidateUnionCount,
      productEventCandidateCapacity:
        particleOnly.productEventCandidateCapacity,
      particleCount: particleOnly.particleCount,
      liveCount: particleOnly.liveCount,
      empty: particleOnly.empty,
      directoryCellCount: particleOnly.directoryCellCount,
      readyPressureCount: particleOnly.readyPressureCount,
      releaseScheduled: particleOnly.releaseScheduled,
      releaseConfirmed: particleOnly.releaseConfirmed,
      occupancyReleaseConfirmed: particleOnly.occupancyReleaseConfirmed
    }, {
      sourceMode: 'particle-only',
      gasCandidateUnionCount: 1,
      productEventCandidateCapacity: 0,
      particleCount: 1,
      liveCount: 1,
      empty: false,
      directoryCellCount: 1,
      readyPressureCount: 1,
      releaseScheduled: true,
      releaseConfirmed: true,
      occupancyReleaseConfirmed: true
    });
    assert.equal(particleOnly.compactRows.length, 1);
    assert.equal(particleOnly.compactRows[0].sourceKind, 'particle');
    assert.equal(particleOnly.compactRows[0].sourceDiscriminant, -1);
    assert.equal(particleOnly.compactRows[0].sourceRowIndex, 0);
    assert.equal(particleOnly.compactRows[0].massKg, 0.25);
    assert.ok(Math.abs(particleOnly.compactRows[0].moles - 2) < 2e-6);
    assert.equal(particleOnly.compactRows[0].supportVolumeM3, 0.5);
    assert.equal(particleOnly.pressureCells.length, 1);
    assert.equal(particleOnly.pressureCells[0].status,
      'local-gas-pressure-cell-ready');
    assert.ok(Number.isFinite(particleOnly.pressureCells[0].pressurePa));
    assert.ok(particleOnly.pressureCells[0].pressurePa > 0);
    assert.ok(Number.isFinite(particleOnly.pressureCells[0].freeVolumeM3));
    assert.ok(particleOnly.pressureCells[0].freeVolumeM3 > 0);

    const mixedUnion = native.particleUnionCases.mixed;
    assert.deepEqual({
      sourceMode: mixedUnion.sourceMode,
      gasCandidateUnionCount: mixedUnion.gasCandidateUnionCount,
      productEventCandidateCapacity:
        mixedUnion.productEventCandidateCapacity,
      particleCount: mixedUnion.particleCount,
      liveCount: mixedUnion.liveCount,
      empty: mixedUnion.empty,
      directoryCellCount: mixedUnion.directoryCellCount,
      readyPressureCount: mixedUnion.readyPressureCount,
      releaseScheduled: mixedUnion.releaseScheduled,
      releaseConfirmed: mixedUnion.releaseConfirmed,
      occupancyReleaseConfirmed: mixedUnion.occupancyReleaseConfirmed
    }, {
      sourceMode: 'mixed',
      gasCandidateUnionCount: 3,
      productEventCandidateCapacity: 2,
      particleCount: 1,
      liveCount: 2,
      empty: false,
      directoryCellCount: 2,
      readyPressureCount: 2,
      releaseScheduled: true,
      releaseConfirmed: true,
      occupancyReleaseConfirmed: true
    });
    assert.equal(mixedUnion.compactRows.length, 2);
    assert.deepEqual(
      mixedUnion.compactRows.map((row) => [
        row.sourceKind,
        row.sourceDiscriminant,
        row.sourceRowIndex,
        row.massKg
      ]),
      [
        ['product-event', 5, 0, 0.25],
        ['particle', -1, 0, 0.5]
      ]
    );
    assert.equal(
      mixedUnion.compactRows.reduce((sum, row) => sum + row.massKg, 0),
      0.75,
      'the mixed inventory is particle mass plus only the unplaced residual'
    );
    assert.ok(Math.abs(mixedUnion.compactRows[0].moles - 1) < 2e-6);
    assert.ok(Math.abs(mixedUnion.compactRows[1].moles - 0.5) < 2e-6);
    assert.equal(mixedUnion.pressureCells.length, 2);
    assert.ok(mixedUnion.pressureCells.every((cell) => (
      cell.status === 'local-gas-pressure-cell-ready'
      && Number.isFinite(cell.pressurePa)
      && cell.pressurePa > 0
      && Number.isFinite(cell.freeVolumeM3)
      && cell.freeVolumeM3 > 0
    )));

    const emptyUnion = native.particleUnionCases.empty;
    assert.deepEqual({
      sourceMode: emptyUnion.sourceMode,
      gasCandidateUnionCount: emptyUnion.gasCandidateUnionCount,
      productEventCandidateCapacity:
        emptyUnion.productEventCandidateCapacity,
      particleCount: emptyUnion.particleCount,
      liveCount: emptyUnion.liveCount,
      empty: emptyUnion.empty,
      directoryCellCount: emptyUnion.directoryCellCount,
      readyPressureCount: emptyUnion.readyPressureCount,
      releaseScheduled: emptyUnion.releaseScheduled,
      releaseConfirmed: emptyUnion.releaseConfirmed,
      occupancyReleaseConfirmed: emptyUnion.occupancyReleaseConfirmed
    }, {
      sourceMode: 'particle-only',
      gasCandidateUnionCount: 1,
      productEventCandidateCapacity: 0,
      particleCount: 1,
      liveCount: 0,
      empty: true,
      directoryCellCount: 0,
      readyPressureCount: 0,
      releaseScheduled: true,
      releaseConfirmed: true,
      occupancyReleaseConfirmed: true
    });
    assert.deepEqual(emptyUnion.compactRows, []);
    assert.deepEqual(emptyUnion.pressureCells, []);
    assert.equal(native.compactRowCount, 3);
    assert.equal(native.directoryCellCount, 2);
    assert.equal(native.cells.length, 2);
    const cells = [...native.cells].sort(
      (left, right) => left.gridIndex[0] - right.gridIndex[0]
    );
    const gasConstant = Math.fround(8.31446261815324);
    const centerWeight = Math.fround(0.6875);
    const rightWeight = Math.fround(0.28125);
    const sourceVolume = Math.fround(0.125);
    const firstCondensedVolume = Math.fround(
      Math.fround(
        Math.fround(centerWeight * centerWeight) * centerWeight
      ) * sourceVolume
    );
    const secondCondensedVolume = Math.fround(
      Math.fround(
        Math.fround(rightWeight * centerWeight) * centerWeight
      ) * sourceVolume
    );
    const firstFreeVolume = Math.fround(1 - firstCondensedVolume);
    const secondFreeVolume = Math.fround(1 - secondCondensedVolume);
    const expectedFirstPressure = Math.fround(
      Math.fround(1100) * gasConstant / firstFreeVolume
    );
    const expectedSecondPressure = Math.fround(
      Math.fround(600) * gasConstant / secondFreeVolume
    );
    const expectedGradient = Math.fround(
      expectedSecondPressure - expectedFirstPressure
    );
    assert.ok(
      Math.abs(cells[0].pressurePa - expectedFirstPressure) < 0.05,
      JSON.stringify({ cells, expectedFirstPressure, expectedSecondPressure })
    );
    assert.ok(Math.abs(cells[1].pressurePa - expectedSecondPressure) < 0.05);
    assert.ok(Math.abs(cells[0].gradient[0] - expectedGradient) < 0.1);
    assert.ok(Math.abs(cells[1].gradient[0] - expectedGradient) < 0.1);
    assert.ok(Math.abs(cells[0].gradient[1]) < 1e-5);
    assert.ok(Math.abs(cells[0].gradient[2]) < 1e-5);
    assert.ok(Math.abs(cells[0].volumeM3 - firstFreeVolume) < 1e-6);
    assert.ok(Math.abs(cells[1].volumeM3 - secondFreeVolume) < 1e-6);
    assert.deepEqual(native.pressureConsumer, {
      status: 'pressure-interface-stage-solver-ready',
      modelId: 2,
      authoritySubmitted: true,
      authorityAuthenticationEnforced: true,
      authorityAuthenticationObserved: false,
      uniformPressurePa: null,
      forceAggregateObserved: true,
      rowPressuresPa: native.pressureConsumer.rowPressuresPa,
      rowReady: [1, 1],
      rowCount: 0,
      rowCapacity: 4,
      logicalCountGpuAuthored: true,
      sourceConsumerSubmitted: true,
      sourceExact: true,
      retainedStatus:
        'retained-gas-pressure-authority-v4-admitted-exact-source',
      retainedReason: null
    });
    const expectedPressureAt = (centroid) => {
      let selected = null;
      let bestDistance2 = Number.POSITIVE_INFINITY;
      for (const cell of cells) {
        const delta = centroid.map((value, axis) => (
          value - cell.centerM[axis]
        ));
        const distance2 = delta.reduce(
          (sum, value) => sum + value * value,
          0
        );
        if (distance2 < bestDistance2) {
          bestDistance2 = distance2;
          selected = { cell, delta };
        }
      }
      return Math.max(
        0,
        selected.cell.pressurePa
          + selected.delta.reduce((sum, value, axis) => (
            sum + value * selected.cell.gradient[axis]
          ), 0)
      );
    };
    const expectedPressureSamples = [
      expectedPressureAt([0.5, 0.5, 0.5]),
      expectedPressureAt([1.5, 0.5, 0.5])
    ];
    for (let index = 0; index < expectedPressureSamples.length; index += 1) {
      assert.ok(
        Math.abs(
          native.pressureConsumer.rowPressuresPa[index]
            - expectedPressureSamples[index]
        ) < 0.1,
        JSON.stringify({
          actual: native.pressureConsumer.rowPressuresPa,
          expected: expectedPressureSamples
        })
      );
    }
    assert.deepEqual(native.sparseLiveMatrix, [
      {
        ready: true,
        status: 'spatial-gas-ledger-eos-gpu-submitted',
        inputRowCount: 4,
        liveCount: 0,
        compactRowCount: 0,
        directoryCellCount: 0,
        readyPressureCount: 0,
        empty: true,
        releaseScheduled: true,
        releaseConfirmed: true,
        occupancyReleaseConfirmed: true
      },
      {
        ready: true,
        status: 'spatial-gas-ledger-eos-gpu-submitted',
        inputRowCount: 4,
        liveCount: 1,
        compactRowCount: 1,
        directoryCellCount: 1,
        readyPressureCount: 1,
        empty: false,
        releaseScheduled: true,
        releaseConfirmed: true,
        occupancyReleaseConfirmed: true
      },
      {
        ready: true,
        status: 'spatial-gas-ledger-eos-gpu-submitted',
        inputRowCount: 4,
        liveCount: 3,
        compactRowCount: 3,
        directoryCellCount: 2,
        readyPressureCount: 2,
        empty: false,
        releaseScheduled: false,
        releaseConfirmed: true,
        occupancyReleaseConfirmed: true
      }
    ]);
    const failedControl = native.failedAuthorityCase.control;
    assert.equal(native.failedAuthorityCase.submissionReady, true);
    assert.equal(
      native.failedAuthorityCase.status,
      'spatial-gas-ledger-eos-gpu-submitted'
    );
    assert.equal(native.failedAuthorityCase.normalHotLoopReadbackFree, true);
    assert.equal(native.failedAuthorityCase.mapAsyncCount, 0);
    assert.equal(
      (
        failedControl[SPH_SPATIAL_GAS_AUTHORITY_CONTROL_OFFSETS.STATUS_FLAGS]
          & SPH_SPATIAL_GAS_AUTHORITY_STATUS.FAILED
      ) >>> 0,
      SPH_SPATIAL_GAS_AUTHORITY_STATUS.FAILED
    );
    assert.equal(
      failedControl[SPH_SPATIAL_GAS_AUTHORITY_CONTROL_OFFSETS.STATUS_FLAGS]
        & (
          SPH_SPATIAL_GAS_AUTHORITY_STATUS.COMPACT_READY
          | SPH_SPATIAL_GAS_AUTHORITY_STATUS.DIRECTORY_READY
          | SPH_SPATIAL_GAS_AUTHORITY_STATUS.EOS_READY
          | SPH_SPATIAL_GAS_AUTHORITY_STATUS.PRESSURE_READY
        ),
      0
    );
    assert.equal(
      failedControl[SPH_SPATIAL_GAS_AUTHORITY_CONTROL_OFFSETS.ERROR_FLAGS]
        & SPH_SPATIAL_GAS_AUTHORITY_ERROR
          .PRODUCT_HISTORY_AUTHORITY_INVALID,
      SPH_SPATIAL_GAS_AUTHORITY_ERROR.PRODUCT_HISTORY_AUTHORITY_INVALID
    );
    assert.equal(
      failedControl[
        SPH_SPATIAL_GAS_AUTHORITY_CONTROL_OFFSETS.LIVE_RESIDUAL_COUNT
      ],
      0
    );
    assert.equal(
      failedControl[
        SPH_SPATIAL_GAS_AUTHORITY_CONTROL_OFFSETS.READY_PRESSURE_COUNT
      ],
      0
    );
    assert.deepEqual(failedControl.slice(16, 28), Array(12).fill(0));
    assert.equal(native.failedAuthorityCase.releaseScheduled, true);
    assert.equal(native.failedAuthorityCase.releaseConfirmed, true);
    assert.equal(
      native.failedAuthorityCase.occupancyReleaseConfirmed,
      true
    );
    assert.equal(native.releaseScheduled, false);
    assert.equal(native.releaseConfirmed, true);
    assert.equal(native.occupancyReleaseConfirmed, true);
    assert.deepEqual(native.large, {
      ready: true,
      status: 'spatial-gas-ledger-eos-gpu-submitted',
      rowCount: 65_536,
      mapAsyncCount: 0,
      hostMaterializedRowCount: 0,
      queueCompletionFenceWaited: false,
      submitMs: native.large.submitMs,
      releaseScheduled: true,
      releaseConfirmed: true,
      occupancyReleaseConfirmed: true
    });
    assert.ok(Number.isFinite(native.large.submitMs));
    assert.equal(native.arenaStats.inUseSlotCount, 0);
    assert.equal(native.arenaDestroyed, true);
    assert.equal(native.validationError, null);
    assert.equal(native.internalError, null);
    assert.equal(native.outOfMemoryError, null);
    assert.deepEqual(native.uncapturedErrors, []);
  } finally {
    await browser.close();
  }
});
