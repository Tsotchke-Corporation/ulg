import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  SPH_SPATIAL_GAS_AUTHORITY_CONTROL_OFFSETS,
  SPH_SPATIAL_GAS_AUTHORITY_CONTROL_VERSION,
  SPH_SPATIAL_GAS_AUTHORITY_CONTROL_MAGIC,
  SPH_SPATIAL_GAS_AUTHORITY_STATUS,
  SPH_SPATIAL_GAS_DIAGNOSTICS_FULL_ORACLE,
  SPH_SPATIAL_GAS_LEDGER_EOS_DIRECTORY_ABI,
  ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA,
  ULG_SPH_RETAINED_SPATIAL_GAS_LEDGER_SOURCE_SCHEMA,
  abandonSphSpatialGasPressureAuthority,
  bindSphSpatialGasPressureAuthority,
  describeSphSpatialGasPressureAuthority,
  destroySphSpatialGasLedgerEosGpu,
  isExactSphSpatialGasPressureAuthoritySource,
  markSphSpatialGasPressureAuthoritySubmitted,
  observeSphSpatialGasLedgerEosOracle,
  releaseSphSpatialGasLedgerEosAfterQueue,
  runSphSpatialGasLedgerEosRetainedWebGpu,
  sphSpatialGasLedgerEosArenaStats,
  sphSpatialGasLedgerEosWgsl,
  sphSpatialGasLedgerProductEventAdapterWgsl
} from '../src/runtime/sph/sphSpatialGasLedgerEosGpu.js';
import {
  tagResidentProductMassDevice,
  tagWebGpuBufferDevice
} from '../src/runtime/sph/sphGpuDeviceIdentity.js';

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
      events.push({
        kind: 'copy',
        source,
        sourceOffset,
        destination,
        destinationOffset,
        size
      });
      const bytes = source._bytes instanceof Uint8Array
        ? source._bytes.slice(sourceOffset, sourceOffset + size)
        : new Uint8Array(size);
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

function retainedProductEventSource(device, rowCount = 4) {
  const productEventBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: `test-product-events-${rowCount}`,
    size: rowCount * 32 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128 | 4 | 8
  }), device);
  let activeBorrowCount = 0;
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
  Object.defineProperty(source, '__ulgActiveBorrowCount', {
    configurable: false,
    enumerable: false,
    get() { return activeBorrowCount; },
    set(value) { activeBorrowCount = Math.max(0, Number(value) | 0); }
  });
  return tagResidentProductMassDevice(source, device);
}

function epochIdentity(overrides = {}) {
  return {
    storageGeneration: 11,
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

function seedFakeCompletedAuthority(result, {
  liveCount = 0,
  cellCount = 0,
  compactRows = null,
  pressureRows = null
} = {}) {
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
  result.gasAuthorityControlBuffer._bytes.set(new Uint8Array(control.buffer));

  const header = new Uint32Array(
    result.spatialGeneration.execution.directoryBuffer._bytes.buffer,
    result.spatialGeneration.execution.directoryBuffer._bytes.byteOffset,
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
    result.compactSpatialGasRowsBuffer._bytes.set(
      new Uint8Array(compactRows.buffer, compactRows.byteOffset, compactRows.byteLength)
    );
  }
  if (pressureRows) {
    result.gasPressureCellsBuffer._bytes.set(
      new Uint8Array(pressureRows.buffer, pressureRows.byteOffset, pressureRows.byteLength)
    );
  }
}

test('normal retained spatial gas/EOS execution binds one generic SS directory and performs no map or queue wait', async () => {
  const { device, instrumentation } = fakeDevice();
  const source = retainedProductEventSource(device, 4);
  const result = await runSphSpatialGasLedgerEosRetainedWebGpu({
    device,
    residentProductMass: source,
    epochIdentity: epochIdentity(),
    spatialGasCellSizeM: 0.25,
    spatialGasSupportVolumeFallbackM3: 0.015625
  });

  assert.equal(result.ready, true, result.reason);
  assert.equal(result.status, 'spatial-gas-ledger-eos-gpu-submitted');
  assert.equal(result.normalHotLoopReadbackFree, true);
  assert.equal(result.mapAsyncCount, 0);
  assert.equal(result.hostMaterializedRowCount, 0);
  assert.equal(result.queueCompletionFenceWaited, false);
  assert.equal(instrumentation.mapAsyncCount, 0);
  assert.equal(instrumentation.queueFenceCount, 0);
  assert.equal(source.__ulgActiveBorrowCount, 1);
  assert.equal(result.spatialGeneration.directoryBuildCount, 1);
  assert.equal(result.privateSpatialLookupBuildCount, 0);
  assert.equal(result.exhaustiveSpatialScanCount, 0);
  assert.equal(
    result.spatialGeneration.execution.sourceBuffer,
    result.retainedSpatialGasLedgerSource.activeNodeBuffer
  );
  assert.equal(
    result.retainedSpatialGasLedgerSource.spatialEpochDirectoryBuffer,
    result.spatialGeneration.execution.directoryBuffer
  );
  assert.equal(
    result.retainedGasCellFieldSource.schema,
    ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA
  );
  assert.equal(
    result.retainedSpatialGasLedgerSource.schema,
    ULG_SPH_RETAINED_SPATIAL_GAS_LEDGER_SOURCE_SCHEMA
  );
  assert.equal(
    result.retainedGasCellFieldSource.gasPressureCellsBuffer,
    result.gasPressureCellsBuffer
  );
  assert.equal(result.retainedGasCellFieldSource.hostMaterialized, false);
  assert.equal(result.retainedGasCellFieldSource.gasCellFieldSnapshot, null);
  assert.equal(result.gasCellFieldSnapshot, null);
  assert.equal(result.spatialGasSpeciesLedger, null);
  assert.equal(
    result.gasAuthorityControlBuffer,
    result.retainedSpatialGasLedgerSource.gasAuthorityControlBuffer
  );
  assert.equal(
    result.gasAuthorityControlBuffer,
    result.retainedGasCellFieldSource.gasAuthorityControlBuffer
  );
  assert.equal(
    result.gasAuthorityControlBuffer,
    result.spatialGeneration.execution.logicalSourceCountAuthority.buffer
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

  const eosBindGroups = instrumentation.bindGroups.filter((bindGroup) => (
    String(bindGroup.label).includes('-eos-aggregate-bind-group')
      || String(bindGroup.label).includes('-eos-gradient-bind-group')
      || String(bindGroup.label).includes('-eos-finalizer-bind-group')
  ));
  assert.equal(eosBindGroups.length, 3);
  for (const bindGroup of eosBindGroups) {
    assert.equal(
      bindGroup.entries.find((entry) => entry.binding === 0).resource.buffer,
      result.compactSpatialGasRowsBuffer
    );
    assert.equal(
      bindGroup.entries.find((entry) => entry.binding === 1).resource.buffer,
      result.spatialGeneration.execution.directoryBuffer
    );
    assert.equal(
      bindGroup.entries.find((entry) => entry.binding === 2).resource.buffer,
      result.gasPressureCellsBuffer
    );
    assert.equal(
      bindGroup.entries.find((entry) => entry.binding === 4).resource.buffer,
      result.gasAuthorityControlBuffer
    );
  }

  const firstBinding = bindSphSpatialGasPressureAuthority(
    result.retainedGasCellFieldSource,
    { device }
  );
  assert.equal(firstBinding.authenticated, true);
  assert.equal(firstBinding.gasPressureCellsBuffer, result.gasPressureCellsBuffer);
  assert.equal(firstBinding.gasAuthorityControlBuffer, result.gasAuthorityControlBuffer);
  assert.equal(releaseSphSpatialGasLedgerEosAfterQueue(result), false);
  assert.equal(
    result.releaseStatus,
    'spatial-gas-ledger-eos-release-blocked-active-pressure-consumer'
  );
  assert.equal(abandonSphSpatialGasPressureAuthority(firstBinding.receipt), true);
  assert.equal(abandonSphSpatialGasPressureAuthority(firstBinding.receipt), false);
  const submittedBinding = bindSphSpatialGasPressureAuthority(
    result.retainedGasCellFieldSource,
    { device }
  );
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
  assert.equal(await result.releasePromise, true);
  assert.equal(result.released, true);
  assert.equal(source.__ulgActiveBorrowCount, 0);
  assert.equal(instrumentation.queueFenceCount, 1);
  assert.equal(instrumentation.mapAsyncCount, 0);
  assert.equal(destroySphSpatialGasLedgerEosGpu(device), true);
});

test('explicit full oracle is the only focused path that maps and materializes rows', async () => {
  const { device, instrumentation } = fakeDevice();
  const source = retainedProductEventSource(device, 2);
  const result = await runSphSpatialGasLedgerEosRetainedWebGpu({
    device,
    residentProductMass: source,
    epochIdentity: epochIdentity(),
    spatialGasCellSizeM: 1,
    spatialGasSupportVolumeFallbackM3: 1
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
  seedFakeCompletedAuthority(result, {
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

  assert.equal(result.releaseAfterFinalConsumerQueue(), true);
  assert.equal(await result.releasePromise, true);
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
  const rejected = await runSphSpatialGasLedgerEosRetainedWebGpu({
    device: rejectedDevice.device,
    residentProductMass: oversizedSource,
    epochIdentity: epochIdentity(),
    spatialGasCellSizeM: 1,
    spatialGasSupportVolumeFallbackM3: 1
  });
  assert.equal(rejected.ready, false);
  assert.equal(rejected.status, 'spatial-gas-ledger-eos-rejected-dispatch-limit');
  assert.equal(rejected.requiredWorkgroups, 4);
  assert.equal(rejected.maxComputeWorkgroupsPerDimension, 2);
  assert.equal(oversizedSource.__ulgActiveBorrowCount, 0);
  assert.equal(rejectedDevice.instrumentation.submissions.length, 0);
  assert.equal(sphSpatialGasLedgerEosArenaStats(rejectedDevice.device).runtimeCount, 0);

  const boundaryDevice = fakeDevice();
  boundaryDevice.device.limits.maxComputeWorkgroupsPerDimension = 2;
  const boundarySource = retainedProductEventSource(boundaryDevice.device, 64);
  const boundary = await runSphSpatialGasLedgerEosRetainedWebGpu({
    device: boundaryDevice.device,
    residentProductMass: boundarySource,
    epochIdentity: epochIdentity(),
    spatialGasCellSizeM: 1,
    spatialGasSupportVolumeFallbackM3: 1
  });
  assert.equal(boundary.ready, true, boundary.reason);
  assert.equal(boundary.releaseAfterFinalConsumerQueue(), true);
  assert.equal(await boundary.releasePromise, true);
  assert.equal(boundarySource.__ulgActiveBorrowCount, 0);
  assert.equal(destroySphSpatialGasLedgerEosGpu(boundaryDevice.device), true);
});

test('pre-submit gas/EOS setup failure immediately releases its borrow and slot', async () => {
  const { device, instrumentation } = fakeDevice();
  const source = retainedProductEventSource(device, 4);
  device.createBindGroup = () => {
    throw new Error('synthetic adapter bind-group setup failure');
  };
  const result = await runSphSpatialGasLedgerEosRetainedWebGpu({
    device,
    residentProductMass: source,
    epochIdentity: epochIdentity(),
    spatialGasCellSizeM: 0.5,
    spatialGasSupportVolumeFallbackM3: 0.125
  });
  assert.equal(result.ready, false);
  assert.equal(result.adapterSubmitted, false);
  assert.equal(await result.cleanupPromise, true);
  assert.equal(source.__ulgActiveBorrowCount, 0);
  assert.equal(instrumentation.submissions.length, 0);
  assert.equal(sphSpatialGasLedgerEosArenaStats(device).inUseSlotCount, 0);
  assert.equal(destroySphSpatialGasLedgerEosGpu(device), true);
});

test('post-submit gas/EOS setup failure retains a loss-recoverable borrow record', async () => {
  const { device, lost, instrumentation } = fakeDevice();
  const source = retainedProductEventSource(device, 4);
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
    epochIdentity: epochIdentity(),
    spatialGasCellSizeM: 0.5,
    spatialGasSupportVolumeFallbackM3: 0.125
  });
  assert.equal(result.ready, false);
  assert.equal(result.adapterSubmitted, true);
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
  assert.equal(source.__ulgActiveBorrowCount, 0);
  assert.equal(sphSpatialGasLedgerEosArenaStats(device).terminal, true);
  for (const buffer of arenaBuffers) assert.equal(buffer.destroyCount, 1);
});

test('warm retained arena reuses exact buffers only after final-consumer release', async () => {
  const { device, instrumentation } = fakeDevice();
  const source = retainedProductEventSource(device, 8);
  const first = await runSphSpatialGasLedgerEosRetainedWebGpu({
    device,
    residentProductMass: source,
    epochIdentity: epochIdentity(),
    spatialGasCellSizeM: 0.5,
    spatialGasSupportVolumeFallbackM3: 0.125
  });
  assert.equal(first.ready, true, first.reason);
  const ownedBuffers = [
    first.compactSpatialGasRowsBuffer,
    first.retainedSpatialGasLedgerSource.activeNodeBuffer,
    first.gasPressureCellsBuffer
  ];
  const bufferCountAfterWarmup = instrumentation.buffers.length;
  assert.equal(first.releaseAfterFinalConsumerQueue(), true);
  assert.equal(await first.releasePromise, true);

  const second = await runSphSpatialGasLedgerEosRetainedWebGpu({
    device,
    residentProductMass: source,
    epochIdentity: epochIdentity({ physicsTick: 14, positionEpoch: 18 }),
    spatialGasCellSizeM: 0.5,
    spatialGasSupportVolumeFallbackM3: 0.125
  });
  assert.equal(second.ready, true, second.reason);
  assert.deepEqual([
    second.compactSpatialGasRowsBuffer,
    second.retainedSpatialGasLedgerSource.activeNodeBuffer,
    second.gasPressureCellsBuffer
  ], ownedBuffers);
  assert.equal(instrumentation.buffers.length, bufferCountAfterWarmup);
  assert.equal(second.arenaBufferReuseCount, 1);
  assert.equal(second.releaseAfterFinalConsumerQueue(), true);
  assert.equal(await second.releasePromise, true);

  const stats = sphSpatialGasLedgerEosArenaStats(device);
  assert.equal(stats.runtimeCount, 1);
  assert.equal(stats.inUseSlotCount, 0);
  assert.equal(stats.reuseCount, 1);
  assert.equal(destroySphSpatialGasLedgerEosGpu(device), true);
  for (const buffer of ownedBuffers) assert.equal(buffer.destroyCount, 1);
});

test('an unconfirmed final-consumer fence quarantines ownership until device loss', async () => {
  const { device, lost, instrumentation } = fakeDevice();
  device.queue.onSubmittedWorkDone = () => {
    instrumentation.queueFenceCount += 1;
    return Promise.reject(new Error('synthetic unconfirmed fence'));
  };
  const source = retainedProductEventSource(device, 4);
  const result = await runSphSpatialGasLedgerEosRetainedWebGpu({
    device,
    residentProductMass: source,
    epochIdentity: epochIdentity(),
    spatialGasCellSizeM: 0.5,
    spatialGasSupportVolumeFallbackM3: 0.125
  });
  assert.equal(result.ready, true, result.reason);
  const ownedBuffers = [
    result.compactSpatialGasRowsBuffer,
    result.retainedSpatialGasLedgerSource.activeNodeBuffer,
    result.gasPressureCellsBuffer
  ];

  assert.equal(result.releaseAfterFinalConsumerQueue(), true);
  assert.equal(await result.releasePromise, false);
  assert.equal(result.released, false);
  assert.equal(
    result.releaseStatus,
    'spatial-gas-ledger-eos-release-unconfirmed'
  );
  assert.equal(source.__ulgActiveBorrowCount, 1);
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

test('shader contract reduces SS CSR spans and finds gradients by directory binary search', () => {
  assert.equal(SPH_SPATIAL_GAS_LEDGER_EOS_DIRECTORY_ABI.directoryAuthority,
    'generic-schroeder-spatial-epoch-v1');
  assert.match(
    sphSpatialGasLedgerProductEventAdapterWgsl,
    /candidate_offsets\[last\] \+ candidate_flags\[last\]/
  );
  assert.match(sphSpatialGasLedgerProductEventAdapterWgsl, /fn classify_product_events/);
  assert.match(sphSpatialGasLedgerProductEventAdapterWgsl, /fn finalize_compaction/);
  assert.match(sphSpatialGasLedgerProductEventAdapterWgsl, /fn scatter_compact_rows/);
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
      const identity = await import(
        '/src/runtime/sph/sphGpuDeviceIdentity.js'
      );

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
      const setEvent = (values, row, {
        position,
        massKg,
        materialId,
        productTermIndex,
        moles,
        temperatureK,
        supportVolumeM3,
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
        values[offset + 12] = 0;
        values[offset + 13] = massKg;
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
      const execution = await module.runSphSpatialGasLedgerEosRetainedWebGpu({
        device,
        residentProductMass: source,
        epochIdentity: epochs,
        spatialGasCellSizeM: 1,
        spatialGasSupportVolumeFallbackM3: 0.5
      });
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
      const oracle = await module.observeSphSpatialGasLedgerEosOracle(execution);
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
                surfaceKey: 'native-v2-pressure-left',
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
                surfaceKey: 'native-v2-pressure-right',
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
      const releaseScheduled = execution.releaseAfterFinalConsumerQueue();
      const releaseConfirmed = releaseScheduled
        ? await execution.releasePromise
        : false;
      source.productEventBuffer.destroy();

      const runSparseOracleCase = async ({
        values,
        label,
        storageGeneration,
        physicsTick,
        positionEpoch
      }) => {
        const sparseSource = makeSource(values, label);
        const sparseExecution =
          await module.runSphSpatialGasLedgerEosRetainedWebGpu({
            device,
            residentProductMass: sparseSource,
            epochIdentity: {
              ...epochs,
              storageGeneration,
              physicsTick,
              positionEpoch
            },
            spatialGasCellSizeM: 1,
            spatialGasSupportVolumeFallbackM3: 0.5
          });
        const sparseOracle =
          await module.observeSphSpatialGasLedgerEosOracle(sparseExecution);
        const sparseReleaseScheduled =
          sparseExecution.releaseAfterFinalConsumerQueue();
        const sparseReleaseConfirmed = sparseReleaseScheduled
          ? await sparseExecution.releasePromise
          : false;
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
          releaseConfirmed: sparseReleaseConfirmed
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
        position: [2.25, 0.25, 0.25],
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
          releaseConfirmed
        }
      ];

      const largeRows = new Float32Array(65_536 * 32);
      setEvent(largeRows, 65_535, {
        position: [2.25, 0.25, 0.25],
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
      const largeStartedAt = performance.now();
      const largeExecution =
        await module.runSphSpatialGasLedgerEosRetainedWebGpu({
          device,
          residentProductMass: largeSource,
          epochIdentity: {
            ...epochs,
            storageGeneration: 10,
            physicsTick: 12,
            positionEpoch: 14
          },
          spatialGasCellSizeM: 1,
          spatialGasSupportVolumeFallbackM3: 1
        });
      const largeSubmitMs = performance.now() - largeStartedAt;
      const largeReleaseScheduled =
        largeExecution.releaseAfterFinalConsumerQueue();
      const largeReleaseConfirmed = largeReleaseScheduled
        ? await largeExecution.releasePromise
        : false;
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
        sparseLiveMatrix,
        releaseScheduled,
        releaseConfirmed,
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
          releaseConfirmed: largeReleaseConfirmed
        },
        arenaStats,
        arenaDestroyed,
        validationError: validationError?.message || null,
        internalError: internalError?.message || null,
        outOfMemoryError: outOfMemoryError?.message || null,
        uncapturedErrors
      };
    });

    assert.equal(native.status, 'complete', native.reason);
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
    assert.equal(native.compactRowCount, 3);
    assert.equal(native.directoryCellCount, 2);
    assert.equal(native.cells.length, 2);
    const cells = [...native.cells].sort(
      (left, right) => left.gridIndex[0] - right.gridIndex[0]
    );
    const gasConstant = Math.fround(8.31446261815324);
    const expectedFirstPressure = Math.fround(
      Math.fround(1100) * gasConstant / Math.fround(1)
    );
    const expectedSecondPressure = Math.fround(
      Math.fround(600) * gasConstant / Math.fround(0.5)
    );
    const expectedGradient = Math.fround(
      expectedSecondPressure - expectedFirstPressure
    );
    assert.ok(Math.abs(cells[0].pressurePa - expectedFirstPressure) < 0.05);
    assert.ok(Math.abs(cells[1].pressurePa - expectedSecondPressure) < 0.05);
    assert.ok(Math.abs(cells[0].gradient[0] - expectedGradient) < 0.1);
    assert.ok(Math.abs(cells[1].gradient[0] - expectedGradient) < 0.1);
    assert.ok(Math.abs(cells[0].gradient[1]) < 1e-5);
    assert.ok(Math.abs(cells[0].gradient[2]) < 1e-5);
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
        'retained-gas-pressure-authority-v2-admitted-exact-source',
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
        releaseConfirmed: true
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
        releaseConfirmed: true
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
        releaseScheduled: true,
        releaseConfirmed: true
      }
    ]);
    assert.equal(native.releaseScheduled, true);
    assert.equal(native.releaseConfirmed, true);
    assert.deepEqual(native.large, {
      ready: true,
      status: 'spatial-gas-ledger-eos-gpu-submitted',
      rowCount: 65_536,
      mapAsyncCount: 0,
      hostMaterializedRowCount: 0,
      queueCompletionFenceWaited: false,
      submitMs: native.large.submitMs,
      releaseScheduled: true,
      releaseConfirmed: true
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
