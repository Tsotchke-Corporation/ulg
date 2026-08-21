import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_FINAL_SEAL,
  SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_MAGIC,
  SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_STATUS,
  SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_VERSION
} from '../ulg-gpu-abi/src/schroederSpatialTopologyTransition.js';
import {
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import {
  createSchroederSpatialSuccessorSourceFamily,
  schroederSpatialSuccessorSourceFamilyLiveness
} from '../src/runtime/sph/schroederSpatialSuccessorSourceFamily.js';
import {
  applySchroederSpatialTopologyTransitionReceipt,
  runSchroederSpatialTopologyTransitionWebGpu
} from '../src/runtime/sph/schroederSpatialTopologyTransitionGpu.js';
import {
  tagWebGpuBufferDevice,
  webGpuDeviceId
} from '../src/runtime/sph/sphGpuDeviceIdentity.js';
import {
  SCHROEDER_SPATIAL_EPOCH_READER,
  SCHROEDER_SPATIAL_EPOCH_READER_PHASE,
  admitSchroederSpatialEpochTransactionReader,
  commitSchroederSpatialEpochTransaction,
  createSchroederSpatialEpochTransaction,
  sealSchroederSpatialEpochTransactionProposals,
  sealSchroederSpatialEpochTransactionReaders
} from '../src/runtime/sph/schroederSpatialEpochTransaction.js';
import {
  SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS,
  SPH_GPU_RENDER_FIELD_CELL_FLOATS,
  buildSphRenderFieldSurfaceTable,
  buildSphRenderFieldWebGpu,
  extractSphRenderRowsWebGpu,
  validateSphRenderFieldSuccessorSourceLineage,
  validateSphRenderRowsSuccessorSourceLineage
} from '../src/runtime/sph/sphRenderGpuKernel.js';
import {
  buildSphMaterialInterfaceSourceFieldLocalWebGpu,
  validateSphMaterialInterfaceSourceFieldSuccessorLineage
} from '../src/runtime/sph/sphMaterialInterfaceSourceFieldLocalGpu.js';
import {
  ULG_MARCHING_CUBES_EXTENSION_POSITION_VERTEX_FORMAT,
  WEBGPU_MARCHING_CUBES_PREFLIGHT_SCHEMA,
  WEBGPU_MARCHING_CUBES_SURFACE_EXECUTION_SCHEMA,
  WEBGPU_MARCHING_CUBES_SURFACE_SCHEMA,
  bindUlgWebGpuMarchingCubesVolumeSuccessorLineage,
  buildWebGpuMarchingCubesExtensionSurfaceRowsWebGpu,
  createUlgRenderFieldBufferVolumeDescriptor,
  createUlgWebGpuMarchingCubesExtensionAdapter,
  hasSchroederSpatialLineageClaim,
  translateWebGpuMarchingCubesSurfaceToUlgRows,
  validateUlgRenderFieldBufferVolumeSuccessorLineage,
  validateUlgWebGpuMarchingCubesExtensionExecutionSuccessorLineage,
  validateUlgWebGpuMarchingCubesSurfaceSuccessorLineage
} from '../src/runtime/sph/sphMarchingCubesSurfaceAdapter.js';
import {
  beginSchroederSpatialSuccessorSourceFamilyConsumption,
  schroederSpatialSuccessorSourceFamiliesFromResidentExecution
} from '../src/visualization/sphPhaseScene.js';

test('partial Schroeder lineage claim detection is fail-closed', () => {
  assert.equal(hasSchroederSpatialLineageClaim({}), false);
  assert.equal(hasSchroederSpatialLineageClaim({
    schroederSpatialSourceFamilyStatus: 'claimed'
  }), true);
  assert.equal(hasSchroederSpatialLineageClaim({
    schroederSpatialSourceGenerationId: 0
  }), true);
  assert.equal(hasSchroederSpatialLineageClaim({
    schroederSpatialSourceQueryAuthority: false
  }), true);
});

function activeMass(value) {
  return Number.isFinite(value) && value > 0;
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function dataBytes(data) {
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  throw new TypeError('fake GPU writes require an ArrayBuffer or view');
}

function createFakeDevice() {
  const submissions = [];
  const dispatches = [];
  const buffers = [];
  const device = {
    submissions,
    dispatches,
    buffers,
    limits: {
      maxComputeWorkgroupsPerDimension: 65_535,
      maxBufferSize: 1 << 30,
      maxStorageBufferBindingSize: 1 << 30
    },
    createBuffer(descriptor) {
      const storage = new Uint8Array(descriptor.size);
      const buffer = {
        ...descriptor,
        device,
        _storage: storage,
        _mappedData: null,
        destroyed: false,
        destroy() { this.destroyed = true; },
        async mapAsync() {},
        getMappedRange() {
          if (ArrayBuffer.isView(this._mappedData)) {
            return this._mappedData.buffer;
          }
          if (this._mappedData instanceof ArrayBuffer) return this._mappedData;
          return this._storage.buffer;
        },
        unmap() { this.unmapped = true; }
      };
      buffers.push(buffer);
      return buffer;
    },
    createShaderModule(descriptor) { return descriptor; },
    createBindGroupLayout(descriptor) { return descriptor; },
    createPipelineLayout(descriptor) { return descriptor; },
    createComputePipeline(descriptor) {
      return {
        descriptor,
        getBindGroupLayout() {
          return { label: `${descriptor.label}-auto-layout` };
        }
      };
    },
    createBindGroup(descriptor) { return descriptor; },
    createCommandEncoder() {
      let boundGroup = null;
      return {
        beginComputePass() {
          let pipeline = null;
          return {
            setPipeline(value) { pipeline = value; },
            setBindGroup(index, value) { boundGroup = value; },
            dispatchWorkgroups(x, y = 1, z = 1) {
              dispatches.push({
                label: pipeline?.descriptor?.label ?? pipeline?.label ?? null,
                entryPoint:
                  pipeline?.descriptor?.compute?.entryPoint
                  ?? pipeline?.compute?.entryPoint
                  ?? null,
                workgroups: [x, y, z]
              });
            },
            end() {}
          };
        },
        copyBufferToBuffer(source, sourceOffset, destination, destinationOffset, size) {
          if (source?.label === 'ulg-schroeder-spatial-topology-transition-receipt') {
            const entries = Object.fromEntries(
              boundGroup.entries.map((entry) => [entry.binding, entry.resource.buffer])
            );
            const [
              sourceCount,
              successorCount,
              generationId,
              nonce,
              sourceEpoch,
              forceAdvance
            ] = entries[2]._writtenWords;
            const sourceMasses = entries[0]._masses;
            const successorMasses = entries[1]._masses;
            const comparisonCount = Math.max(sourceCount, successorCount);
            let sourceActiveCount = 0;
            let successorActiveCount = 0;
            let activatedCount = 0;
            let deactivatedCount = 0;
            for (let index = 0; index < comparisonCount; index += 1) {
              const sourceActive = index < sourceCount
                && activeMass(sourceMasses[index]);
              const successorActive = index < successorCount
                && activeMass(successorMasses[index]);
              if (sourceActive) sourceActiveCount += 1;
              if (successorActive) successorActiveCount += 1;
              if (sourceActive !== successorActive) {
                if (successorActive) activatedCount += 1;
                else deactivatedCount += 1;
              }
            }
            const xorCount = activatedCount + deactivatedCount;
            const changed = xorCount > 0 || forceAdvance === 1;
            const words = new Uint32Array(24);
            words.set([
              SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_MAGIC,
              SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_VERSION,
              generationId,
              nonce,
              sourceEpoch,
              sourceCount,
              successorCount,
              comparisonCount,
              1,
              comparisonCount,
              sourceActiveCount,
              successorActiveCount,
              activatedCount,
              deactivatedCount,
              xorCount,
              0,
              0,
              forceAdvance,
              1,
              changed ? 1 : 0,
              changed ? sourceEpoch + 1 : sourceEpoch,
              SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_STATUS.COMPLETE,
              0,
              SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_FINAL_SEAL
            ]);
            destination._mappedData = words;
            return;
          }
          const copy = new Uint8Array(destination.size);
          copy.set(
            source._storage.subarray(sourceOffset, sourceOffset + size),
            destinationOffset
          );
          destination._mappedData = copy;
          destination._storage.set(copy);
        },
        finish() { return { label: 'fake-successor-lineage-commands' }; }
      };
    },
    queue: {
      writeBuffer(buffer, offset, data) {
        const bytes = dataBytes(data);
        buffer._storage.set(bytes, offset);
        if (bytes.byteLength % Uint32Array.BYTES_PER_ELEMENT === 0) {
          buffer._writtenWords = new Uint32Array(
            bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
          );
        }
      },
      submit(commands) { submissions.push(commands); },
      async onSubmittedWorkDone() {}
    }
  };
  return device;
}

function taggedBuffer(device, label, size, masses = null) {
  const buffer = tagWebGpuBufferDevice(device.createBuffer({
    label,
    size,
    usage: 128
  }), device);
  if (masses) buffer._masses = [...masses];
  return buffer;
}

async function successorFixture() {
  const particleCount = 3;
  const sourceMasses = [1, 1, 0];
  const successorMasses = [1, 1, 0];
  const device = createFakeDevice();
  const sourceStateBuffer = taggedBuffer(
    device,
    'source-state',
    particleCount * 8 * Float32Array.BYTES_PER_ELEMENT,
    sourceMasses
  );
  const successorStateBuffer = taggedBuffer(
    device,
    'successor-state',
    particleCount * 8 * Float32Array.BYTES_PER_ELEMENT,
    successorMasses
  );
  const activeNodeBuffer = taggedBuffer(device, 'canonical-active-node', 4096);
  const directoryBuffer = taggedBuffer(device, 'canonical-directory', 4096);
  const sourceParticleUploads = {
    sphParticleUpload: {
      stateBuffer: sourceStateBuffer,
      thermoBuffer: taggedBuffer(device, 'source-thermo', particleCount * 48),
      identityBuffer: taggedBuffer(device, 'source-identity', particleCount * 16)
    },
    mlsMpmParticleUpload: {
      mechanicsBuffer: taggedBuffer(device, 'source-mechanics', particleCount * 128)
    }
  };
  const sourceEpoch = {
    storageGeneration: 11,
    physicsTick: 17,
    physicsSubstep: 0,
    positionEpoch: 17,
    topologyEpoch: 7,
    chartEpoch: 2,
    levelEpoch: 17,
    supportEpoch: 17
  };
  const generation = {
    selected: true,
    ready: true,
    releaseScheduled: false,
    directoryBuildCount: 1,
    privateLookupBuildCount: 0,
    source: {
      ready: true,
      sourceCount: particleCount,
      sourceStateBuffer,
      activeNodeBuffer,
      ...sourceEpoch
    },
    execution: {
      generationId: 19,
      buildOrdinal: 19,
      sortUniqueOrdinal: 19,
      submitPerformed: true,
      deviceId: webGpuDeviceId(device),
      sourceCount: particleCount,
      activeNodeBuffer,
      directoryBuffer,
      ...sourceEpoch,
      released: false
    }
  };
  const topologyTransitionReceipt =
    await runSchroederSpatialTopologyTransitionWebGpu({
      device,
      generation,
      sourceStateBuffer,
      successorStateBuffer,
      successorParticleCount: particleCount
    });
  const successorEpoch = {
    storageGeneration: 12,
    physicsTick: 18,
    physicsSubstep: 0,
    positionEpoch: 18,
    topologyEpoch: 999,
    chartEpoch: 2,
    levelEpoch: 18,
    supportEpoch: 18
  };
  const successorThermoBuffer = taggedBuffer(
    device,
    'successor-thermo',
    particleCount * 48
  );
  const successorIdentityBuffer = taggedBuffer(
    device,
    'successor-identity',
    particleCount * Uint32Array.BYTES_PER_ELEMENT
  );
  const successorMechanicsBuffer = taggedBuffer(
    device,
    'successor-mechanics',
    particleCount * 128
  );
  const nextParticleUploads = {
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: successorStateBuffer,
      thermoBuffer: successorThermoBuffer,
      identityBuffer: successorIdentityBuffer,
      identitySchema: ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
      identityRequired: true,
      identityBufferByteLength: successorIdentityBuffer.size,
      particleCount,
      ...successorEpoch,
      stateStrideBytes: 32,
      thermoStrideBytes: 48,
      identityStrideBytes: Uint32Array.BYTES_PER_ELEMENT
    },
    mlsMpmParticleUpload: {
      status: 'webgpu-uploaded',
      mechanicsBuffer: successorMechanicsBuffer,
      particleCount,
      ...successorEpoch,
      mechanicsStrideBytes: 128
    }
  };
  applySchroederSpatialTopologyTransitionReceipt(
    nextParticleUploads,
    topologyTransitionReceipt,
    { generation }
  );

  const transaction = createSchroederSpatialEpochTransaction({
    device,
    generation,
    ...sourceParticleUploads
  });
  const readerInputs = { generation, ...sourceParticleUploads };
  admitSchroederSpatialEpochTransactionReader(transaction, {
    readerId: SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_P2G,
    phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.PRE_INTEGRATION,
    ...readerInputs
  });
  admitSchroederSpatialEpochTransactionReader(transaction, {
    readerId: SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_G2P,
    phase: SCHROEDER_SPATIAL_EPOCH_READER_PHASE.INTEGRATION_COMMIT,
    ...readerInputs
  });
  sealSchroederSpatialEpochTransactionReaders(transaction);
  sealSchroederSpatialEpochTransactionProposals(transaction);
  const commitReceipt = commitSchroederSpatialEpochTransaction(transaction, {
    nextParticleUploads
  });
  const sourceFamily = createSchroederSpatialSuccessorSourceFamily({
    transaction,
    commitReceipt,
    generation,
    nextParticleUploads,
    topologyTransitionReceipt,
    componentOwnerStages: {
      state: 'test-successor-lineage',
      thermo: 'test-successor-lineage',
      identity: 'test-successor-lineage',
      mechanics: 'test-successor-lineage'
    }
  });
  const state = new Float32Array(particleCount * 8);
  for (let index = 0; index < particleCount; index += 1) {
    state[index * 8 + 3] = successorMasses[index];
  }
  const sphParticleState = {
    schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
    status: 'test-successor-resident-particles',
    particleCount,
    smoothingLengthM: 0.1,
    stateStrideFloats: 8,
    thermoStrideFloats: 12,
    identitySchema: ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
    identityStrideBytes: Uint32Array.BYTES_PER_ELEMENT,
    identityBufferByteLength: particleCount * Uint32Array.BYTES_PER_ELEMENT,
    cpuStateStale: true,
    cpuIdentityStale: true,
    state,
    thermo: new Float32Array(particleCount * 12),
    identity: new Uint32Array(particleCount)
  };
  const mlsMpmParticleState = {
    particleCount,
    mechanics: new Float32Array(particleCount * 32)
  };
  return {
    device,
    sourceFamily,
    sphParticleState,
    mlsMpmParticleState,
    sphParticleUpload: nextParticleUploads.sphParticleUpload,
    mlsMpmParticleUpload: nextParticleUploads.mlsMpmParticleUpload
  };
}

function surfaceTable() {
  return buildSphRenderFieldSurfaceTable([{
    surfaceKey: 'successor|test|solid',
    material: 'test',
    phase: 'solid',
    renderKey: 'test',
    resolution: 2,
    isolation: 20,
    subtract: 5,
    radiusNorm: 0.2,
    colorLinear: [0.8, 0.7, 0.6]
  }]);
}

async function retainedSuccessorRows(fixture) {
  return extractSphRenderRowsWebGpu({
    ...fixture,
    device: fixture.device,
    schroederSpatialSourceFamily: fixture.sourceFamily,
    readbackMode: 'no-full-readback',
    retainRenderRowsBuffer: true
  });
}

function exactRenderRowsLineage(fixture, rows, options = {}) {
  return {
    device: fixture.device,
    sourceFamily: fixture.sourceFamily,
    particleCount: fixture.sphParticleState.particleCount,
    renderRowsBuffer: options.renderRowsBuffer ?? rows.renderRowsBuffer ?? null,
    renderRows: options.renderRows ?? (
      options.renderRowsBuffer || rows.renderRowsBuffer ? null : rows.renderRows
    )
  };
}

function exactRenderFieldLineage(fixture, field) {
  return {
    device: fixture.device,
    sourceFamily: fixture.sourceFamily,
    particleCount: fixture.sphParticleState.particleCount,
    fieldRowsBuffer: field.fieldRowsBuffer ?? null,
    fieldRows: field.fieldRowsBuffer ? null : field.fieldRows,
    surfaceBuffer: field.surfaceBuffer ?? null,
    surfaceTable: field.surfaceTable
  };
}

async function denseSuccessorField(fixture, rows, table, targetFieldRowsBuffer) {
  return buildSphRenderFieldWebGpu({
    device: fixture.device,
    renderRowsBuffer: rows.renderRowsBuffer,
    renderRowsSource: rows,
    schroederSpatialSourceFamily: fixture.sourceFamily,
    surfaceTable: table,
    particleCount: fixture.sphParticleState.particleCount,
    readbackMode: 'no-full-readback',
    retainFieldRowsBuffer: true,
    retainSurfaceBuffer: true,
    waitForQueueCompletion: false,
    deferCleanup: false,
    targetFieldRowsBuffer,
    targetFieldRowsBufferByteLength: targetFieldRowsBuffer.size
  });
}

function externalSurfaceExecution(device, {
  surfaceGenerationId = 7,
  buffer: requestedBuffer = null,
  positionRows: requestedPositionRows = null,
  normalBuffer = null,
  actualVertexCounterBuffer = null,
  drawIndirectBuffer = null,
  isovalue = 20
} = {}) {
  const vertexCount = 3;
  const buffer = requestedBuffer || device.createBuffer({
    label: 'external-marching-cubes-position-rows',
    size: vertexCount * 4 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const positionRows = requestedPositionRows || new Float32Array([
    0, 0, 0, 0,
    1, 0, 0, 0,
    0, 1, 0, 0
  ]);
  return {
    schema: WEBGPU_MARCHING_CUBES_SURFACE_EXECUTION_SCHEMA,
    adapterId: 'fake-webgpu-marching-cubes',
    backend: 'webgpu',
    status: 'surface-ready',
    ok: true,
    ownsDevice: false,
    ownerDeviceId: webGpuDeviceId(device),
    readback: false,
    surfaceVertexReadback: false,
    webgpuStatus: { status: 'executed', reason: null },
    result: {
      schema: WEBGPU_MARCHING_CUBES_SURFACE_SCHEMA,
      status: 'surface-ready',
      vertexCount,
      triangleCount: 1,
      vertexStrideFloats: 4,
      vertexStrideBytes: 16,
      vertexFormat: ULG_MARCHING_CUBES_EXTENSION_POSITION_VERTEX_FORMAT,
      positionRows,
      buffer,
      bufferByteLength: buffer.size,
      bufferRetained: true,
      normalBuffer,
      normalBufferByteLength: normalBuffer?.size ?? 0,
      actualVertexCounterBuffer,
      actualVertexCounterBufferByteLength:
        actualVertexCounterBuffer?.size ?? 0,
      drawIndirectBuffer,
      drawIndirectBufferByteLength: drawIndirectBuffer?.size ?? 0,
      resourceOwnership: { ok: true, status: 'same-device' },
      surfaceGenerationId,
      volumeGenerationId: 42,
      isovalue,
      release() {
        this.buffer?.destroy?.();
      }
    }
  };
}

async function boundSuccessorSurfaceFixture({
  table = surfaceTable(),
  surfaceIndex = 0
} = {}) {
  const fixture = await successorFixture();
  const rows = await retainedSuccessorRows(fixture);
  const fieldPool = fixture.device.createBuffer({
    label: 'bound-successor-surface-field',
    size: table.totalFieldCells
      * SPH_GPU_RENDER_FIELD_CELL_FLOATS
      * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const field = await denseSuccessorField(fixture, rows, table, fieldPool);
  const descriptor = createUlgRenderFieldBufferVolumeDescriptor({
    device: fixture.device,
    renderField: field,
    surfaceIndex
  });
  assert.equal(descriptor.ok, true);
  const volume = {
    device: fixture.device,
    scalarBuffer: descriptor.scalarBuffer,
    storageBuffer: descriptor.scalarBuffer,
    sourceType: descriptor.sourceType,
    scalarType: descriptor.scalarType,
    scalarBufferByteLength: descriptor.scalarBufferByteLength,
    scalarRequiredByteLength: descriptor.scalarRequiredByteLength,
    scalarOffset: descriptor.scalarOffset,
    scalarOffsetBytes: descriptor.scalarOffsetBytes,
    rowStrideFloats: descriptor.rowStrideFloats,
    sliceStrideFloats: descriptor.sliceStrideFloats,
    normalSign: descriptor.normalSign,
    dims: [...descriptor.dims],
    dualGridDims: descriptor.dims.map(
      (dimension) => Math.max(0, dimension - 1)
    ),
    numVoxels: descriptor.dims.reduce(
      (product, dimension) => product * dimension,
      1
    ),
    dualGridNumVoxels: descriptor.dims.reduce(
      (product, dimension) => product * Math.max(0, dimension - 1),
      1
    ),
    scalarStrides: [...descriptor.scalarStrides]
  };
  bindUlgWebGpuMarchingCubesVolumeSuccessorLineage({
    device: fixture.device,
    descriptor,
    volume
  });
  return {
    ...fixture,
    rows,
    table,
    fieldPool,
    field,
    descriptor,
    volume
  };
}

function createBoundExternalSurfaceAdapter(harness, extractSurface) {
  return createUlgWebGpuMarchingCubesExtensionAdapter({
    device: harness.device,
    volume: harness.volume,
    adapter: {
      schema: 'peercompute.webgpu-marching-cubes.surface-adapter.v0',
      preflight() {
        return {
          schema: WEBGPU_MARCHING_CUBES_PREFLIGHT_SCHEMA,
          ok: true,
          status: 'ready',
          deviceChecks: [{ ok: true, status: 'same-device' }]
        };
      },
      extractSurface
    }
  });
}

function translateBoundSuccessorSurface(harness, extensionExecution, extra = {}) {
  return translateWebGpuMarchingCubesSurfaceToUlgRows({
    device: harness.device,
    extensionExecution,
    schroederSpatialSourceFamily: harness.sourceFamily,
    surfaceIndex: harness.descriptor.surfaceIndex,
    material: harness.descriptor.material,
    phase: harness.descriptor.phase,
    renderKey: harness.descriptor.renderKey,
    surfaceKey: harness.descriptor.surfaceKey,
    isolation: harness.descriptor.isovalue,
    ...extra
  });
}

test('successor render rows retain their source lease while material-interface submissions use an exact queue fence', async () => {
  const fixture = await successorFixture();
  const renderFence = deferred();
  let renderFenceCount = 0;
  fixture.device.queue.onSubmittedWorkDone = () => {
    renderFenceCount += 1;
    return renderFence.promise;
  };
  const rows = await retainedSuccessorRows(fixture);
  assert.equal(
    schroederSpatialSuccessorSourceFamilyLiveness(fixture.sourceFamily, {
      device: fixture.device
    }).leaseCount,
    1
  );
  assert.equal(renderFenceCount, 0);

  const materialFence = deferred();
  fixture.device.queue.onSubmittedWorkDone = () => materialFence.promise;
  const field = await buildSphMaterialInterfaceSourceFieldLocalWebGpu({
    device: fixture.device,
    renderRowsBuffer: rows.renderRowsBuffer,
    renderRowsSource: rows,
    schroederSpatialSourceFamily: fixture.sourceFamily,
    surfaceTable: surfaceTable(),
    particleCount: fixture.sphParticleState.particleCount,
    readbackMode: 'no-full-readback',
    retainFieldRowsBuffer: true,
    retainSurfaceBuffer: true,
    deferCleanup: false
  });
  assert.equal(
    schroederSpatialSuccessorSourceFamilyLiveness(fixture.sourceFamily, {
      device: fixture.device
    }).leaseCount,
    2
  );
  materialFence.resolve();
  await materialFence.promise;
  await Promise.resolve();
  assert.equal(
    schroederSpatialSuccessorSourceFamilyLiveness(fixture.sourceFamily, {
      device: fixture.device
    }).leaseCount,
    1
  );
  field.destroyMaterialInterfaceSourceFieldBuffers?.({ releaseLeases: true });
  rows.destroyRenderRowsBuffer();
  assert.equal(
    schroederSpatialSuccessorSourceFamilyLiveness(fixture.sourceFamily, {
      device: fixture.device
    }).leaseCount,
    0
  );
});

test('scene continuation consumption revokes stale lineage and retires after its exact compute fence', async () => {
  const fixture = await successorFixture();
  assert.deepEqual(
    schroederSpatialSuccessorSourceFamiliesFromResidentExecution({
      finalStep: {
        nextParticleUploads: {
          schroederSpatialSuccessorSourceFamily: fixture.sourceFamily
        }
      },
      retainedSteps: [{
        schroederSpatialSuccessorSourceFamily: fixture.sourceFamily
      }]
    }),
    [fixture.sourceFamily],
    'resident cleanup must deduplicate the exact branded family'
  );

  assert.throws(
    () => beginSchroederSpatialSuccessorSourceFamilyConsumption({
      sourceFamily: fixture.sourceFamily,
      device: fixture.device,
      particleCount: fixture.sphParticleUpload.particleCount,
      stateBuffer: taggedBuffer(
        fixture.device,
        'foreign-successor-state',
        fixture.sphParticleUpload.stateBuffer.size
      ),
      thermoBuffer: fixture.sphParticleUpload.thermoBuffer,
      identityBuffer: fixture.sphParticleUpload.identityBuffer,
      mechanicsBuffer: fixture.mlsMpmParticleUpload.mechanicsBuffer
    }),
    /exact committed same-device continuation/
  );
  const livenessAfterRejectedResolution =
    schroederSpatialSuccessorSourceFamilyLiveness(
      fixture.sourceFamily,
      { device: fixture.device }
    );
  assert.equal(livenessAfterRejectedResolution.active, true);
  assert.equal(livenessAfterRejectedResolution.leaseCount, 0);
  assert.equal(livenessAfterRejectedResolution.retirementRequested, false);
  assert.equal(
    livenessAfterRejectedResolution.status,
    'schroeder-successor-source-family-active',
    'failed exact resolution must release its provisional consumer lease'
  );

  const consumption =
    beginSchroederSpatialSuccessorSourceFamilyConsumption({
      sourceFamily: fixture.sourceFamily,
      device: fixture.device,
      particleCount: fixture.sphParticleUpload.particleCount,
      stateBuffer: fixture.sphParticleUpload.stateBuffer,
      thermoBuffer: fixture.sphParticleUpload.thermoBuffer,
      identityBuffer: fixture.sphParticleUpload.identityBuffer,
      mechanicsBuffer: fixture.mlsMpmParticleUpload.mechanicsBuffer,
      consumerStage: 'scene-successor-consumption-test',
      retirementReason: 'test continuation superseded',
      ownerFence: Promise.resolve()
    });
  assert.equal(consumption.levelAssignment, null);
  assert.equal(consumption.levelAssignmentSeal, null);
  assert.equal(Object.isFrozen(consumption.sourceFamilyLease), true);
  assert.equal(
    consumption.sourceFamilyLease.consumerStage,
    'scene-successor-consumption-test'
  );
  const requested = schroederSpatialSuccessorSourceFamilyLiveness(
    fixture.sourceFamily,
    { device: fixture.device }
  );
  assert.equal(requested.active, false);
  assert.equal(requested.leaseCount, 1);
  assert.match(requested.status, /retirement-requested/);

  const consumerFence = deferred();
  const releasePromise = consumption.releaseAfter(consumerFence.promise);
  let retirementSettled = false;
  consumption.retirementPromise.then(() => {
    retirementSettled = true;
  });
  await Promise.resolve();
  assert.equal(retirementSettled, false);
  assert.equal(
    schroederSpatialSuccessorSourceFamilyLiveness(fixture.sourceFamily).leaseCount,
    1
  );

  consumerFence.reject(new Error('first scene consumer fence rejected'));
  await assert.rejects(
    releasePromise,
    /first scene consumer fence rejected/
  );
  assert.equal(
    schroederSpatialSuccessorSourceFamilyLiveness(fixture.sourceFamily)
      .leaseCount,
    1,
    'a rejected fence preserves the exact lease for an explicit retry'
  );
  const retryFence = deferred();
  const retryReleasePromise =
    consumption.releaseAfter(retryFence.promise);
  assert.notEqual(retryReleasePromise, releasePromise);
  retryFence.resolve();
  const [releaseReceipt, retirementReceipt] = await Promise.all([
    retryReleasePromise,
    consumption.retirementPromise
  ]);
  assert.equal(releaseReceipt.remainingLeaseCount, 0);
  assert.equal(retirementReceipt.settled, true);
  assert.equal(retirementReceipt.retired, true);
  assert.equal(retirementReceipt.remainingLeaseCount, 0);
  assert.equal(
    schroederSpatialSuccessorSourceFamilyLiveness(fixture.sourceFamily).retired,
    true
  );
});

test('successor render rows require exact module brands and reject swapped or copied rows', async () => {
  const fixture = await successorFixture();
  const retainedRows = await retainedSuccessorRows(fixture);
  assert.equal(
    validateSphRenderRowsSuccessorSourceLineage(
      retainedRows,
      exactRenderRowsLineage(fixture, retainedRows)
    ),
    true
  );
  assert.equal(
    validateSphRenderRowsSuccessorSourceLineage(
      { ...retainedRows },
      exactRenderRowsLineage(fixture, retainedRows)
    ),
    false
  );
  const swappedBuffer = fixture.device.createBuffer({
    label: 'swapped-render-rows',
    size: retainedRows.renderRowsBuffer.size,
    usage: 128
  });
  assert.equal(
    validateSphRenderRowsSuccessorSourceLineage(
      retainedRows,
      exactRenderRowsLineage(fixture, retainedRows, {
        renderRowsBuffer: swappedBuffer
      })
    ),
    false
  );

  const readbackRows = await extractSphRenderRowsWebGpu({
    ...fixture,
    device: fixture.device,
    schroederSpatialSourceFamily: fixture.sourceFamily,
    readbackMode: 'full-parity-readback'
  });
  assert.equal(
    validateSphRenderRowsSuccessorSourceLineage(
      readbackRows,
      exactRenderRowsLineage(fixture, readbackRows)
    ),
    true
  );
  const copiedRows = new Float32Array(readbackRows.renderRows);
  assert.equal(
    validateSphRenderRowsSuccessorSourceLineage(
      readbackRows,
      exactRenderRowsLineage(fixture, readbackRows, { renderRows: copiedRows })
    ),
    false
  );

  const table = surfaceTable();
  await assert.rejects(
    buildSphRenderFieldWebGpu({
      device: fixture.device,
      renderRowsBuffer: swappedBuffer,
      renderRowsSource: retainedRows,
      schroederSpatialSourceFamily: fixture.sourceFamily,
      surfaceTable: table,
      particleCount: fixture.sphParticleState.particleCount
    }),
    /module-authenticated render-row derivation/
  );
  await assert.rejects(
    buildSphRenderFieldWebGpu({
      device: fixture.device,
      renderRows: copiedRows,
      renderRowsSource: readbackRows,
      schroederSpatialSourceFamily: fixture.sourceFamily,
      surfaceTable: table,
      particleCount: fixture.sphParticleState.particleCount
    }),
    /exact branded render rows/
  );

  const productEvents = new Float32Array(SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS);
  for (const builder of [
    buildSphRenderFieldWebGpu,
    buildSphMaterialInterfaceSourceFieldLocalWebGpu
  ]) {
    await assert.rejects(
      builder({
        device: fixture.device,
        renderRowsBuffer: retainedRows.renderRowsBuffer,
        renderRowsSource: retainedRows,
        schroederSpatialSourceFamily: fixture.sourceFamily,
        productEventRows: productEvents,
        productEventCount: 1,
        surfaceTable: table,
        particleCount: fixture.sphParticleState.particleCount
      }),
      /(no unauthenticated product-event source|exact render-row artifact)/
    );
  }
  retainedRows.destroyRenderRowsBuffer();
  assert.equal(
    validateSphRenderRowsSuccessorSourceLineage(
      retainedRows,
      exactRenderRowsLineage(fixture, retainedRows)
    ),
    false,
    'destroying the retained handoff buffer must retire its render-row brand'
  );
});

test('dense and source-local successor fields preserve exact lineage and invalidate pooled overwrites', async () => {
  const fixture = await successorFixture();
  const rows = await retainedSuccessorRows(fixture);
  const table = surfaceTable();
  const fieldByteLength = table.totalFieldCells
    * SPH_GPU_RENDER_FIELD_CELL_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;

  const densePool = fixture.device.createBuffer({
    label: 'pooled-dense-render-field',
    size: fieldByteLength,
    usage: 128
  });
  const denseFirst = await denseSuccessorField(
    fixture,
    rows,
    table,
    densePool
  );
  assert.equal(
    validateSphRenderFieldSuccessorSourceLineage(
      denseFirst,
      exactRenderFieldLineage(fixture, denseFirst)
    ),
    true
  );
  const denseCreateBindGroup = fixture.device.createBindGroup;
  fixture.device.createBindGroup = () => {
    throw new Error('manufactured dense replacement setup failure');
  };
  await assert.rejects(
    denseSuccessorField(fixture, rows, table, densePool),
    /manufactured dense replacement setup failure/
  );
  fixture.device.createBindGroup = denseCreateBindGroup;
  assert.equal(
    validateSphRenderFieldSuccessorSourceLineage(
      denseFirst,
      exactRenderFieldLineage(fixture, denseFirst)
    ),
    true,
    'a pre-submit dense replacement failure must retain the last publication'
  );
  assert.equal(
    validateSphRenderFieldSuccessorSourceLineage(
      { ...denseFirst },
      exactRenderFieldLineage(fixture, denseFirst)
    ),
    false
  );
  assert.equal(
    validateSphRenderFieldSuccessorSourceLineage(
      denseFirst,
      {
        ...exactRenderFieldLineage(fixture, denseFirst),
        surfaceTable: { ...table }
      }
    ),
    false
  );
  const denseSecond = await denseSuccessorField(
    fixture,
    rows,
    table,
    densePool
  );
  assert.equal(
    validateSphRenderFieldSuccessorSourceLineage(
      denseFirst,
      exactRenderFieldLineage(fixture, denseFirst)
    ),
    false,
    'writing the same pooled dense buffer must retire the previous brand'
  );
  assert.equal(
    validateSphRenderFieldSuccessorSourceLineage(
      denseSecond,
      exactRenderFieldLineage(fixture, denseSecond)
    ),
    true
  );

  const sourceLocalPool = fixture.device.createBuffer({
    label: 'pooled-source-local-field',
    size: fieldByteLength,
    usage: 128
  });
  const buildSourceLocal = () => buildSphMaterialInterfaceSourceFieldLocalWebGpu({
    device: fixture.device,
    renderRowsBuffer: rows.renderRowsBuffer,
    renderRowsSource: rows,
    schroederSpatialSourceFamily: fixture.sourceFamily,
    surfaceTable: table,
    particleCount: fixture.sphParticleState.particleCount,
    readbackMode: 'no-full-readback',
    retainFieldRowsBuffer: true,
    retainSurfaceBuffer: true,
    retainSourceIndexFieldBuffer: true,
    waitForQueueCompletion: false,
    deferCleanup: false,
    targetFieldRowsBuffer: sourceLocalPool,
    targetFieldRowsBufferByteLength: sourceLocalPool.size
  });
  const sourceLocalFirst = await buildSourceLocal();
  const sourceLocalFirstAuthority = sourceLocalFirst.sourceRenderField;
  assert.equal(
    validateSphMaterialInterfaceSourceFieldSuccessorLineage(
      sourceLocalFirstAuthority,
      exactRenderFieldLineage(fixture, sourceLocalFirstAuthority)
    ),
    true
  );
  const sourceLocalSubmit = fixture.device.queue.submit;
  fixture.device.queue.submit = () => {
    throw new Error('manufactured source-local replacement submit failure');
  };
  await assert.rejects(
    buildSourceLocal(),
    /manufactured source-local replacement submit failure/
  );
  fixture.device.queue.submit = sourceLocalSubmit;
  assert.equal(
    validateSphMaterialInterfaceSourceFieldSuccessorLineage(
      sourceLocalFirstAuthority,
      exactRenderFieldLineage(fixture, sourceLocalFirstAuthority)
    ),
    true,
    'a rejected source-local submit must retain the last publication'
  );
  assert.equal(
    validateSphMaterialInterfaceSourceFieldSuccessorLineage(
      { ...sourceLocalFirstAuthority },
      exactRenderFieldLineage(fixture, sourceLocalFirstAuthority)
    ),
    false
  );
  const sourceLocalSecond = await buildSourceLocal();
  const sourceLocalSecondAuthority = sourceLocalSecond.sourceRenderField;
  assert.equal(
    validateSphMaterialInterfaceSourceFieldSuccessorLineage(
      sourceLocalFirstAuthority,
      exactRenderFieldLineage(fixture, sourceLocalFirstAuthority)
    ),
    false,
    'writing the same pooled source-local buffer must retire the previous brand'
  );
  assert.equal(
    validateSphMaterialInterfaceSourceFieldSuccessorLineage(
      sourceLocalSecondAuthority,
      exactRenderFieldLineage(fixture, sourceLocalSecondAuthority)
    ),
    true
  );

  const sharedCrossBuilderPool = fixture.device.createBuffer({
    label: 'pooled-cross-builder-successor-field',
    size: fieldByteLength,
    usage: 128
  });
  const crossDense = await denseSuccessorField(
    fixture,
    rows,
    table,
    sharedCrossBuilderPool
  );
  const crossSourceLocal = await buildSphMaterialInterfaceSourceFieldLocalWebGpu({
    device: fixture.device,
    renderRowsBuffer: rows.renderRowsBuffer,
    renderRowsSource: rows,
    schroederSpatialSourceFamily: fixture.sourceFamily,
    surfaceTable: table,
    particleCount: fixture.sphParticleState.particleCount,
    readbackMode: 'no-full-readback',
    retainFieldRowsBuffer: true,
    retainSurfaceBuffer: true,
    targetFieldRowsBuffer: sharedCrossBuilderPool,
    targetFieldRowsBufferByteLength: sharedCrossBuilderPool.size
  });
  assert.equal(
    validateSphRenderFieldSuccessorSourceLineage(
      crossDense,
      exactRenderFieldLineage(fixture, crossDense)
    ),
    false,
    'source-local overwrite must retire a dense-field publication on the same buffer'
  );
  assert.equal(
    validateSphMaterialInterfaceSourceFieldSuccessorLineage(
      crossSourceLocal.sourceRenderField,
      exactRenderFieldLineage(fixture, crossSourceLocal.sourceRenderField)
    ),
    true
  );
  const crossDenseReplacement = await denseSuccessorField(
    fixture,
    rows,
    table,
    sharedCrossBuilderPool
  );
  assert.equal(
    validateSphMaterialInterfaceSourceFieldSuccessorLineage(
      crossSourceLocal.sourceRenderField,
      exactRenderFieldLineage(fixture, crossSourceLocal.sourceRenderField)
    ),
    false,
    'dense overwrite must retire a source-local publication on the same buffer'
  );
  assert.equal(
    validateSphRenderFieldSuccessorSourceLineage(
      crossDenseReplacement,
      exactRenderFieldLineage(fixture, crossDenseReplacement)
    ),
    true
  );
});

test('marching-cubes descriptors reject partial lineage and substituted surface metadata', async () => {
  const fixture = await successorFixture();
  const rows = await retainedSuccessorRows(fixture);
  const table = surfaceTable();
  const pool = fixture.device.createBuffer({
    label: 'descriptor-render-field',
    size: table.totalFieldCells
      * SPH_GPU_RENDER_FIELD_CELL_FLOATS
      * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const field = await denseSuccessorField(fixture, rows, table, pool);
  const descriptor = createUlgRenderFieldBufferVolumeDescriptor({
    device: fixture.device,
    renderField: field,
    surfaceIndex: 0
  });
  assert.equal(descriptor.ok, true);
  assert.equal(
    validateUlgRenderFieldBufferVolumeSuccessorLineage(descriptor, {
      device: fixture.device,
      sourceFamily: fixture.sourceFamily
    }),
    true
  );
  assert.equal(Object.isFrozen(descriptor.positionTransform), true);
  assert.equal(Object.isFrozen(descriptor.positionTransform.originM), true);

  const exactFieldByteLength = field.fieldRowsBufferByteLength;
  field.fieldRowsBufferByteLength = pool.size + 1024;
  assert.equal(
    validateUlgRenderFieldBufferVolumeSuccessorLineage(descriptor, {
      device: fixture.device,
      sourceFamily: fixture.sourceFamily
    }),
    false,
    'a forged public field byte-length claim must invalidate its lineage'
  );
  field.fieldRowsBufferByteLength = exactFieldByteLength;

  const exactIsolation = table.metadata[0].isolation;
  table.metadata[0].isolation = exactIsolation + 1;
  assert.equal(
    validateUlgRenderFieldBufferVolumeSuccessorLineage(descriptor, {
      device: fixture.device,
      sourceFamily: fixture.sourceFamily
    }),
    false,
    'in-place mutation of exact surface metadata must invalidate its field and descriptor'
  );
  table.metadata[0].isolation = exactIsolation;

  const partial = {
    ...field,
    schroederSpatialSourceFamily: null,
    schroederSpatialSourceFamilyStatus: fixture.sourceFamily.status
  };
  const partialDescriptor = createUlgRenderFieldBufferVolumeDescriptor({
    device: fixture.device,
    renderField: partial,
    surfaceIndex: 0
  });
  assert.equal(
    partialDescriptor.status,
    'ulg-render-field-buffer-volume-blocked-partial-successor-lineage'
  );

  const forgedFieldDescriptor = createUlgRenderFieldBufferVolumeDescriptor({
    device: fixture.device,
    renderField: { ...field },
    surfaceIndex: 0
  });
  assert.equal(
    forgedFieldDescriptor.status,
    'ulg-render-field-buffer-volume-blocked-successor-lineage'
  );

  const authoritativeSurface = table.metadata[0];
  const substitutedSurfaceDescriptor =
    createUlgRenderFieldBufferVolumeDescriptor({
      device: fixture.device,
      renderField: field,
      surfaceIndex: 0,
      surface: {
        ...authoritativeSurface,
        material: 'forged-material',
        phase: 'forged-phase',
        isolation: authoritativeSurface.isolation + 1
      }
    });
  assert.equal(
    substitutedSurfaceDescriptor.status,
    'ulg-render-field-buffer-volume-blocked-substituted-successor-surface',
    'a branded field must not authorize caller-substituted surface metadata'
  );
});

test('bound external marching-cubes extraction privately brands exact output and fails closed on tampering', async () => {
  const fixture = await successorFixture();
  const rows = await retainedSuccessorRows(fixture);
  const table = surfaceTable();
  const pool = fixture.device.createBuffer({
    label: 'external-extraction-render-field',
    size: table.totalFieldCells
      * SPH_GPU_RENDER_FIELD_CELL_FLOATS
      * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const field = await denseSuccessorField(fixture, rows, table, pool);
  const descriptor = createUlgRenderFieldBufferVolumeDescriptor({
    device: fixture.device,
    renderField: field,
    surfaceIndex: 0
  });
  assert.equal(descriptor.ok, true);
  assert.equal(Object.isFrozen(descriptor), true);
  const forgedDescriptor = {
    ...descriptor,
    scalarOffset: descriptor.scalarOffset + 1
  };
  assert.equal(
    validateUlgRenderFieldBufferVolumeSuccessorLineage(forgedDescriptor, {
      device: fixture.device,
      sourceFamily: fixture.sourceFamily
    }),
    false
  );
  assert.throws(
    () => bindUlgWebGpuMarchingCubesVolumeSuccessorLineage({
      device: fixture.device,
      descriptor: forgedDescriptor,
      volume: {}
    }),
    /active authenticated successor descriptor/
  );
  const volume = {
    device: fixture.device,
    scalarBuffer: descriptor.scalarBuffer,
    storageBuffer: descriptor.scalarBuffer,
    sourceType: descriptor.sourceType,
    scalarType: descriptor.scalarType,
    scalarBufferByteLength: descriptor.scalarBufferByteLength,
    scalarRequiredByteLength: descriptor.scalarRequiredByteLength,
    scalarOffset: descriptor.scalarOffset,
    scalarOffsetBytes: descriptor.scalarOffsetBytes,
    rowStrideFloats: descriptor.rowStrideFloats,
    sliceStrideFloats: descriptor.sliceStrideFloats,
    normalSign: descriptor.normalSign,
    dims: [...descriptor.dims],
    dualGridDims: descriptor.dims.map(
      (dimension) => Math.max(0, dimension - 1)
    ),
    numVoxels: descriptor.dims.reduce(
      (product, dimension) => product * dimension,
      1
    ),
    dualGridNumVoxels: descriptor.dims.reduce(
      (product, dimension) => product * Math.max(0, dimension - 1),
      1
    ),
    scalarStrides: [...descriptor.scalarStrides]
  };
  assert.equal(
    bindUlgWebGpuMarchingCubesVolumeSuccessorLineage({
      device: fixture.device,
      descriptor,
      volume
    }).status,
    'ulg-marching-cubes-successor-volume-lineage-bound'
  );

  const preflightTamperVolume = {
    ...volume,
    dims: [...volume.dims],
    scalarStrides: [...volume.scalarStrides]
  };
  bindUlgWebGpuMarchingCubesVolumeSuccessorLineage({
    device: fixture.device,
    descriptor,
    volume: preflightTamperVolume
  });
  const preflightTamperAdapter =
    createUlgWebGpuMarchingCubesExtensionAdapter({
      device: fixture.device,
      volume: preflightTamperVolume,
      adapter: {
        preflight() {
          preflightTamperVolume.dims[0] += 1;
          return {
            schema: WEBGPU_MARCHING_CUBES_PREFLIGHT_SCHEMA,
            ok: true,
            status: 'ready'
          };
        },
        async extractSurface() {
          return externalSurfaceExecution(fixture.device);
        }
      }
    });
  await assert.rejects(
    preflightTamperAdapter.extractSurface({
      volume: preflightTamperVolume,
      isovalue: descriptor.isovalue
    }),
    /changed during extension preflight/
  );

  let rawExecution = null;
  const adapter = createUlgWebGpuMarchingCubesExtensionAdapter({
    device: fixture.device,
    volume,
    adapter: {
      schema: 'peercompute.webgpu-marching-cubes.surface-adapter.v0',
      preflight(request) {
        assert.equal(request.volume, volume);
        return {
          schema: WEBGPU_MARCHING_CUBES_PREFLIGHT_SCHEMA,
          ok: true,
          status: 'ready',
          deviceChecks: [{ ok: true, status: 'same-device' }]
        };
      },
      async extractSurface(request) {
        assert.equal(request.volume, volume);
        rawExecution = externalSurfaceExecution(fixture.device);
        return rawExecution;
      }
    }
  });
  const wrappedExecution = await adapter.extractSurface({
    volume,
    isovalue: descriptor.isovalue
  });
  assert.equal(wrappedExecution.extensionExecution, rawExecution);
  await assert.rejects(
    adapter.extractSurface({
      volume,
      isovalue: descriptor.isovalue + 1
    }),
    /active exact successor volume binding/
  );

  const translated = translateWebGpuMarchingCubesSurfaceToUlgRows({
    device: fixture.device,
    extensionExecution: rawExecution,
    schroederSpatialSourceFamily: fixture.sourceFamily,
    surfaceIndex: descriptor.surfaceIndex,
    material: descriptor.material,
    phase: descriptor.phase,
    renderKey: descriptor.renderKey,
    surfaceKey: descriptor.surfaceKey,
    isolation: descriptor.isovalue
  });
  assert.equal(
    translated.schroederSpatialSourceFamily,
    fixture.sourceFamily
  );
  assert.equal(
    translated.status,
    'extension-surface-translated-to-ulg-rows'
  );
  assert.equal(
    validateUlgWebGpuMarchingCubesSurfaceSuccessorLineage(translated, {
      device: fixture.device,
      sourceFamily: fixture.sourceFamily,
      descriptor,
      extensionExecution: rawExecution
    }),
    true
  );
  assert.equal(
    validateUlgWebGpuMarchingCubesSurfaceSuccessorLineage(
      { ...translated },
      {
        device: fixture.device,
        sourceFamily: fixture.sourceFamily
      }
    ),
    false
  );
  const exactTriangleCount = translated.triangleCount;
  translated.triangleCount += 1;
  assert.equal(
    validateUlgWebGpuMarchingCubesSurfaceSuccessorLineage(translated, {
      device: fixture.device,
      sourceFamily: fixture.sourceFamily
    }),
    false,
    'mutating translated draw metadata must invalidate the private surface brand'
  );
  translated.triangleCount = exactTriangleCount;
  assert.equal(
    validateUlgWebGpuMarchingCubesSurfaceSuccessorLineage(
      translated.surfaceDraw,
      {
        device: fixture.device,
        sourceFamily: fixture.sourceFamily
      }
    ),
    true
  );

  const unbranded = externalSurfaceExecution(fixture.device);
  unbranded.schroederSpatialSourceFamily = fixture.sourceFamily;
  unbranded.result.schroederSpatialSourceFamily = fixture.sourceFamily;
  assert.throws(
    () => translateWebGpuMarchingCubesSurfaceToUlgRows({
      device: fixture.device,
      extensionExecution: unbranded,
      schroederSpatialSourceFamily: fixture.sourceFamily
    }),
    /unbranded or partial successor lineage/
  );
  assert.throws(
    () => translateWebGpuMarchingCubesSurfaceToUlgRows({
      device: fixture.device,
      extensionExecution: {
        ...rawExecution,
        result: { ...rawExecution.result }
      },
      schroederSpatialSourceFamily: fixture.sourceFamily
    }),
    /unbranded or partial successor lineage/
  );

  const authenticBuffer = rawExecution.result.buffer;
  rawExecution.result.buffer = fixture.device.createBuffer({
    label: 'tampered-external-position-rows',
    size: authenticBuffer.size,
    usage: 128
  });
  assert.throws(
    () => translateWebGpuMarchingCubesSurfaceToUlgRows({
      device: fixture.device,
      extensionExecution: rawExecution,
      schroederSpatialSourceFamily: fixture.sourceFamily
    }),
    /does not match its authenticated successor extraction/
  );
});

test('successor extraction quarantines prior pooled outputs even when the replacement is rejected', async () => {
  const harness = await boundSuccessorSurfaceFixture();
  const pooledPositionBuffer = harness.device.createBuffer({
    label: 'successor-pooled-position-output',
    size: 3 * 4 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const firstRaw = externalSurfaceExecution(harness.device, {
    buffer: pooledPositionBuffer,
    surfaceGenerationId: 101
  });
  const rejectedRaw = externalSurfaceExecution(harness.device, {
    buffer: harness.device.createBuffer({
      label: 'successor-rejected-position-output',
      size: pooledPositionBuffer.size,
      usage: 128
    }),
    normalBuffer: pooledPositionBuffer,
    surfaceGenerationId: 102
  });
  delete rejectedRaw.result.release;
  const outputs = [firstRaw, rejectedRaw];
  const adapter = createBoundExternalSurfaceAdapter(
    harness,
    async () => outputs.shift()
  );

  await adapter.extractSurface({
    volume: harness.volume,
    isovalue: harness.descriptor.isovalue
  });
  const firstSurface = translateBoundSuccessorSurface(harness, firstRaw);
  assert.equal(
    validateUlgWebGpuMarchingCubesExtensionExecutionSuccessorLineage(
      firstRaw,
      {
        device: harness.device,
        sourceFamily: harness.sourceFamily,
        descriptor: harness.descriptor
      }
    ),
    true
  );
  assert.equal(
    validateUlgWebGpuMarchingCubesSurfaceSuccessorLineage(firstSurface, {
      device: harness.device,
      sourceFamily: harness.sourceFamily
    }),
    true
  );

  await assert.rejects(
    adapter.extractSurface({
      volume: harness.volume,
      isovalue: harness.descriptor.isovalue
    }),
    /authenticated release lifecycle/
  );
  assert.equal(
    validateUlgWebGpuMarchingCubesExtensionExecutionSuccessorLineage(
      firstRaw,
      {
        device: harness.device,
        sourceFamily: harness.sourceFamily,
        descriptor: harness.descriptor
      }
    ),
    false,
    'a failed cross-role reuse must still retire the prior position owner'
  );
  assert.equal(
    validateUlgWebGpuMarchingCubesSurfaceSuccessorLineage(firstSurface, {
      device: harness.device,
      sourceFamily: harness.sourceFamily
    }),
    false,
    'a sealed surface must not survive reuse of its extraction output'
  );

  const sameRolePool = harness.device.createBuffer({
    label: 'successor-same-role-position-output',
    size: pooledPositionBuffer.size,
    usage: 128
  });
  const thirdRaw = externalSurfaceExecution(harness.device, {
    buffer: sameRolePool,
    surfaceGenerationId: 103
  });
  const fourthRaw = externalSurfaceExecution(harness.device, {
    buffer: sameRolePool,
    surfaceGenerationId: 104
  });
  outputs.push(thirdRaw, fourthRaw);
  await adapter.extractSurface({
    volume: harness.volume,
    isovalue: harness.descriptor.isovalue
  });
  await adapter.extractSurface({
    volume: harness.volume,
    isovalue: harness.descriptor.isovalue
  });
  assert.equal(
    validateUlgWebGpuMarchingCubesExtensionExecutionSuccessorLineage(
      thirdRaw,
      {
        device: harness.device,
        sourceFamily: harness.sourceFamily,
        descriptor: harness.descriptor
      }
    ),
    false
  );
  assert.equal(
    validateUlgWebGpuMarchingCubesExtensionExecutionSuccessorLineage(
      fourthRaw,
      {
        device: harness.device,
        sourceFamily: harness.sourceFamily,
        descriptor: harness.descriptor
      }
    ),
    true
  );
});

test('sealed successor surfaces reject mutable bytes, clamps, and every renderer-consumed alias', async () => {
  const harness = await boundSuccessorSurfaceFixture();
  const raw = externalSurfaceExecution(harness.device, {
    surfaceGenerationId: 201
  });
  const adapter = createBoundExternalSurfaceAdapter(harness, async () => raw);
  await adapter.extractSurface({
    volume: harness.volume,
    isovalue: harness.descriptor.isovalue
  });
  const surface = translateBoundSuccessorSurface(harness, raw);
  const isValid = () => validateUlgWebGpuMarchingCubesSurfaceSuccessorLineage(
    surface,
    {
      device: harness.device,
      sourceFamily: harness.sourceFamily,
      descriptor: harness.descriptor,
      extensionExecution: raw
    }
  );
  assert.equal(isValid(), true);

  const temperatureRows = { destroy() {} };
  const compactTemperatureRowsBuffer = { label: 'scene-owned-temperature' };
  const sceneTemperatureMetadata = {
    compactTemperatureRowsBufferRetained: true,
    compactTemperatureRowsBufferByteLength: 12,
    compactTemperatureRowsBufferRowCount: 3,
    compactTemperatureRowsStrideFloats: 1,
    compactTemperatureRowsSchema: 'peercompute.ulg.native-surface-temperature-rows.v0',
    compactTemperatureRowsLayoutName: 'temperatureK:f32',
    compactTemperatureRowsEncoding: 'temperature-kelvin-f32',
    compactTemperatureRowsSemantic: 'surface-vertex-temperature-k',
    compactTemperatureRowsSurfaceGenerationId: 201,
    compactTemperatureRowsVolumeGenerationId: 31,
    compactTemperatureRowsCoverageSchema: 'peercompute.ulg.surface-temperature-coverage.v0',
    compactTemperatureRowsCoverageComplete: true,
    compactTemperatureRowsCoverageRowCount: 3,
    compactTemperatureRowsOwnership: 'ulg-owned-generation-buffer',
    compactTemperatureRowsAdditionalSubmitCount: 1
  };
  surface.nativeSurfaceTemperatureRows = temperatureRows;
  Object.assign(surface, sceneTemperatureMetadata);
  Object.assign(surface.surfaceVertices, sceneTemperatureMetadata);
  Object.assign(surface.surfaceDraw, sceneTemperatureMetadata, {
    compactTemperatureRowsBuffer,
    emissiveTemperatureK: 1200
  });
  assert.equal(
    isValid(),
    true,
    'scene-owned temperature and emissive decorations must not rewrite sealed adapter lineage'
  );

  assert.throws(
    () => translateBoundSuccessorSurface(harness, raw, {
      positionClampMinM: [0, 0, 0]
    }),
    /translation inputs do not match/
  );

  const exactSourcePosition = raw.result.positionRows[0];
  raw.result.positionRows[0] = exactSourcePosition + 0.25;
  assert.equal(isValid(), false, 'in-place source row mutation must invalidate');
  raw.result.positionRows[0] = exactSourcePosition;
  assert.equal(isValid(), true);

  const exactVertex = surface.surfaceVertices.vertexRows[0];
  surface.surfaceVertices.vertexRows[0] = exactVertex + 0.25;
  assert.equal(isValid(), false, 'translated vertex byte mutation must invalidate');
  surface.surfaceVertices.vertexRows[0] = exactVertex;
  assert.equal(isValid(), true);

  const exactDraw = surface.surfaceDraw.drawRows[0];
  surface.surfaceDraw.drawRows[0] = exactDraw + 1;
  assert.equal(isValid(), false, 'translated draw byte mutation must invalidate');
  surface.surfaceDraw.drawRows[0] = exactDraw;
  assert.equal(isValid(), true);

  const exactTransform = surface.surfaceDraw.positionTransform;
  surface.surfaceDraw.positionTransform = { ...exactTransform };
  assert.equal(isValid(), false, 'copied transform aliases must be rejected');
  surface.surfaceDraw.positionTransform = exactTransform;
  assert.equal(isValid(), true);

  surface.surfaceDraw.surfaces.push({ ...surface.surfaceDraw.surfaces[0] });
  assert.equal(isValid(), false, 'surface list mutation must invalidate');
  surface.surfaceDraw.surfaces.pop();
  assert.equal(isValid(), true);

  const exactSurfaceCount = surface.surfaceDraw.surfaceCount;
  surface.surfaceDraw.surfaceCount = exactSurfaceCount + 1;
  assert.equal(isValid(), false, 'surfaceCount mutation must invalidate');
  surface.surfaceDraw.surfaceCount = exactSurfaceCount;
  assert.equal(isValid(), true);

  const exactNormalEncoding = surface.surfaceDraw.compactNormalRowsEncoding;
  surface.surfaceDraw.compactNormalRowsEncoding = 'forged-normal-encoding';
  assert.equal(isValid(), false, 'normal decoding mutation must invalidate');
  surface.surfaceDraw.compactNormalRowsEncoding = exactNormalEncoding;
  assert.equal(isValid(), true);

  const hadCompactedByteLength = Object.prototype.hasOwnProperty.call(
    surface.surfaceDraw,
    'compactedVertexRowsBufferByteLength'
  );
  const exactCompactedByteLength =
    surface.surfaceDraw.compactedVertexRowsBufferByteLength;
  surface.surfaceDraw.compactedVertexRowsBufferByteLength = 4;
  assert.equal(isValid(), false, 'compacted buffer extent mutation must invalidate');
  if (hadCompactedByteLength) {
    surface.surfaceDraw.compactedVertexRowsBufferByteLength =
      exactCompactedByteLength;
  } else {
    delete surface.surfaceDraw.compactedVertexRowsBufferByteLength;
  }
  assert.equal(isValid(), true);

  surface.surfaceDraw.renderFieldGradientVolume = {
    buffer: harness.descriptor.scalarBuffer,
    dims: [...harness.descriptor.dims],
    scalarStrides: [...harness.descriptor.scalarStrides],
    scalarOffset: harness.descriptor.scalarOffset
  };
  assert.equal(
    isValid(),
    false,
    'an unauthenticated renderer gradient volume must invalidate the surface'
  );
  delete surface.surfaceDraw.renderFieldGradientVolume;
  assert.equal(isValid(), true);

  raw.result.release();
  assert.equal(isValid(), false, 'source result release must retire sealed output');
});

test('successor extraction rejects source aliases, intra-output aliases, and unauthenticated release hooks', async () => {
  const harness = await boundSuccessorSurfaceFixture();
  const outputs = [];
  const adapter = createBoundExternalSurfaceAdapter(
    harness,
    async () => outputs.shift()
  );
  const extract = () => adapter.extractSurface({
    volume: harness.volume,
    isovalue: harness.descriptor.isovalue
  });

  const sourceAliasedOutput = externalSurfaceExecution(harness.device, {
    buffer: harness.descriptor.scalarBuffer,
    surfaceGenerationId: 301
  });
  outputs.push(sourceAliasedOutput);
  await assert.rejects(extract(), /distinct from the source volume/);
  assert.equal(
    harness.descriptor.scalarBuffer.destroyed,
    false,
    'rejected extension lifecycle must never retire the borrowed scalar source'
  );

  const aliasedOutput = harness.device.createBuffer({
    label: 'successor-intra-output-alias',
    size: 3 * 4 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  outputs.push(externalSurfaceExecution(harness.device, {
    buffer: aliasedOutput,
    normalBuffer: aliasedOutput,
    surfaceGenerationId: 302
  }));
  await assert.rejects(extract(), /from one another/);
  assert.equal(aliasedOutput.destroyed, true);

  const wrongIsovalue = externalSurfaceExecution(harness.device, {
    surfaceGenerationId: 3021,
    isovalue: harness.descriptor.isovalue + 1
  });
  outputs.push(wrongIsovalue);
  await assert.rejects(extract(), /output isovalue/);
  assert.equal(wrongIsovalue.result.buffer.destroyed, true);

  const missingRelease = externalSurfaceExecution(harness.device, {
    surfaceGenerationId: 303
  });
  delete missingRelease.result.release;
  outputs.push(missingRelease);
  await assert.rejects(extract(), /authenticated release lifecycle/);
  assert.equal(
    missingRelease.result.buffer.destroyed,
    false,
    'ULG must not infer ownership of an extension buffer with no lifecycle'
  );

  const sealedRelease = externalSurfaceExecution(harness.device, {
    surfaceGenerationId: 304
  });
  Object.defineProperty(sealedRelease.result, 'release', {
    value: sealedRelease.result.release,
    writable: false,
    configurable: false
  });
  outputs.push(sealedRelease);
  await assert.rejects(extract(), /lifecycle cannot be authenticated/);
  assert.equal(sealedRelease.result.buffer.destroyed, true);
});

test('successor volume rejects dual-grid mutation during extension preflight', async () => {
  const harness = await boundSuccessorSurfaceFixture();
  const adapter = createUlgWebGpuMarchingCubesExtensionAdapter({
    device: harness.device,
    volume: harness.volume,
    adapter: {
      preflight() {
        harness.volume.dualGridDims[0] += 1;
        return {
          schema: WEBGPU_MARCHING_CUBES_PREFLIGHT_SCHEMA,
          ok: true,
          status: 'ready'
        };
      },
      async extractSurface() {
        return externalSurfaceExecution(harness.device);
      }
    }
  });
  await assert.rejects(
    adapter.extractSurface({
      volume: harness.volume,
      isovalue: harness.descriptor.isovalue
    }),
    /changed during extension preflight/
  );
});

test('sealed translated surface survives retirement of its source field pool only until result release', async () => {
  const harness = await boundSuccessorSurfaceFixture();
  const raw = externalSurfaceExecution(harness.device, {
    surfaceGenerationId: 401
  });
  const adapter = createBoundExternalSurfaceAdapter(harness, async () => raw);
  await adapter.extractSurface({
    volume: harness.volume,
    isovalue: harness.descriptor.isovalue
  });
  const surface = translateBoundSuccessorSurface(harness, raw);
  assert.equal(
    validateUlgWebGpuMarchingCubesSurfaceSuccessorLineage(surface, {
      device: harness.device,
      sourceFamily: harness.sourceFamily
    }),
    true
  );

  await denseSuccessorField(
    harness,
    harness.rows,
    harness.table,
    harness.fieldPool
  );
  assert.equal(
    validateUlgRenderFieldBufferVolumeSuccessorLineage(harness.descriptor, {
      device: harness.device,
      sourceFamily: harness.sourceFamily
    }),
    false,
    'the overwritten source field must retire its active descriptor'
  );
  assert.equal(
    validateUlgWebGpuMarchingCubesSurfaceSuccessorLineage(surface, {
      device: harness.device,
      sourceFamily: harness.sourceFamily
    }),
    true,
    'sealed independent rows must retain their exact descriptor snapshot'
  );
  raw.result.release();
  assert.equal(
    validateUlgWebGpuMarchingCubesSurfaceSuccessorLineage(surface, {
      device: harness.device,
      sourceFamily: harness.sourceFamily
    }),
    false
  );
});

test('successor render-field targets reject forged and unknown GPU buffer capacities before submission', async () => {
  const fixture = await successorFixture();
  const rows = await retainedSuccessorRows(fixture);
  const table = surfaceTable();
  const requiredByteLength = table.totalFieldCells
    * SPH_GPU_RENDER_FIELD_CELL_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  const common = {
    device: fixture.device,
    renderRowsBuffer: rows.renderRowsBuffer,
    renderRowsSource: rows,
    schroederSpatialSourceFamily: fixture.sourceFamily,
    surfaceTable: table,
    particleCount: fixture.sphParticleState.particleCount,
    readbackMode: 'no-full-readback',
    retainFieldRowsBuffer: true,
    retainSurfaceBuffer: true
  };
  for (const builder of [
    buildSphRenderFieldWebGpu,
    buildSphMaterialInterfaceSourceFieldLocalWebGpu
  ]) {
    const undersized = fixture.device.createBuffer({
      label: 'forged-capacity-successor-field',
      size: requiredByteLength - 4,
      usage: 128
    });
    await assert.rejects(
      builder({
        ...common,
        targetFieldRowsBuffer: undersized,
        targetFieldRowsBufferByteLength: requiredByteLength
      }),
      /exceeds the actual GPU buffer capacity/
    );
    await assert.rejects(
      builder({
        ...common,
        targetFieldRowsBuffer: {
          label: 'unknown-capacity-successor-field',
          usage: 128
        },
        targetFieldRowsBufferByteLength: requiredByteLength
      }),
      /must expose its actual GPU buffer capacity/
    );
  }
});

test('GPU successor surface publication reauthenticates after awaits and preserves gradient params', async () => {
  const harness = await boundSuccessorSurfaceFixture({
    surfaceIndex: 1,
    table: buildSphRenderFieldSurfaceTable([
      {
        surfaceKey: 'successor|params|first',
        material: 'first',
        phase: 'solid',
        renderKey: 'first',
        resolution: 4,
        isolation: 17,
        subtract: 5,
        radiusNorm: 0.2,
        colorLinear: [0.7, 0.7, 0.7]
      },
      {
        surfaceKey: 'successor|params|second',
        material: 'second',
        phase: 'liquid',
        renderKey: 'second',
        resolution: 5,
        isolation: 23,
        subtract: 6,
        radiusNorm: 0.18,
        colorLinear: [0.3, 0.6, 0.9]
      }
    ])
  });
  assert.ok(harness.descriptor.scalarOffset > 0);
  const raw = externalSurfaceExecution(harness.device, {
    surfaceGenerationId: 501,
    isovalue: harness.descriptor.isovalue
  });
  const adapter = createBoundExternalSurfaceAdapter(harness, async () => raw);
  await adapter.extractSurface({
    volume: harness.volume,
    isovalue: harness.descriptor.isovalue
  });
  let releasedDuringBuild = false;
  const bufferStart = harness.device.buffers.length;
  await assert.rejects(
    buildWebGpuMarchingCubesExtensionSurfaceRowsWebGpu({
      device: harness.device,
      extensionExecution: raw,
      schroederSpatialSourceFamily: harness.sourceFamily,
      surfaceIndex: harness.descriptor.surfaceIndex,
      isolation: harness.descriptor.isovalue,
      sourceVoxelLinearIndex: harness.descriptor.fieldOffset,
      readbackMode: 'no-full-readback',
      waitForQueueCompletion: false,
      onProgress(progress) {
        if (
          !releasedDuringBuild
          && progress.status === 'extension-surface-translation-buffers-ready'
        ) {
          releasedDuringBuild = true;
          raw.result.release();
        }
      }
    }),
    /(still-active exact extraction lineage|does not match its authenticated successor extraction)/
  );
  assert.equal(releasedDuringBuild, true);
  const rejectedBuffers = harness.device.buffers.slice(bufferStart).filter(
    (buffer) => buffer.label?.startsWith('ulg-sph-extension-surface-')
  );
  assert.ok(rejectedBuffers.length >= 3);
  assert.equal(
    rejectedBuffers.every((buffer) => buffer.destroyed === true),
    true,
    'publication rejection must clean every ULG-owned retained surface buffer'
  );

  const freshRaw = externalSurfaceExecution(harness.device, {
    surfaceGenerationId: 502,
    isovalue: harness.descriptor.isovalue
  });
  const freshAdapter = createBoundExternalSurfaceAdapter(
    harness,
    async () => freshRaw
  );
  await freshAdapter.extractSurface({
    volume: harness.volume,
    isovalue: harness.descriptor.isovalue
  });
  const translated = await buildWebGpuMarchingCubesExtensionSurfaceRowsWebGpu({
    device: harness.device,
    extensionExecution: freshRaw,
    schroederSpatialSourceFamily: harness.sourceFamily,
    surfaceIndex: harness.descriptor.surfaceIndex,
    isolation: harness.descriptor.isovalue,
    sourceVoxelLinearIndex: harness.descriptor.fieldOffset,
    readbackMode: 'no-full-readback',
    waitForQueueCompletion: false
  });
  assert.equal(
    validateUlgWebGpuMarchingCubesSurfaceSuccessorLineage(translated, {
      device: harness.device,
      sourceFamily: harness.sourceFamily,
      descriptor: harness.descriptor,
      extensionExecution: freshRaw
    }),
    true
  );
  const paramsBuffer = [...harness.device.buffers].reverse().find(
    (buffer) => buffer.label === 'ulg-sph-extension-surface-translation-params'
  );
  assert.ok(paramsBuffer);
  const params = new DataView(paramsBuffer._storage.buffer);
  assert.equal(
    params.getFloat32(88, true),
    harness.descriptor.dims[0]
  );
  assert.equal(
    params.getFloat32(92, true),
    harness.descriptor.scalarOffset
  );
  assert.equal(params.getFloat32(124, true), 1);
  assert.equal(
    params.getFloat32(144, true),
    harness.descriptor.cellRowStrideFloats
  );
  translated.destroyExtensionSurfaceBuffers({
    force: true,
    releaseLeases: true,
    reason: 'successor-lineage-test-cleanup'
  });
  freshRaw.result.release();
});
