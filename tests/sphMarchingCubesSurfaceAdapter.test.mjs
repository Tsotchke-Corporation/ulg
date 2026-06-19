import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SPH_GPU_RENDER_FIELD_CELL_ROW_LAYOUT,
  SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_ROW_LAYOUT,
  SPH_GPU_RENDER_SURFACE_DRAW_ROW_LAYOUT,
  SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT,
  ULG_SPH_GPU_RENDER_FIELD_SCHEMA,
  ULG_SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_SCHEMA,
  ULG_SPH_GPU_RENDER_SURFACE_DRAW_SCHEMA,
  ULG_SPH_GPU_RENDER_SURFACE_VERTICES_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import {
  ULG_MARCHING_CUBES_EXTENSION_POSITION_VERTEX_FORMAT,
  ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_EXECUTION_SCHEMA,
  ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_PREFLIGHT_SCHEMA,
  ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_TRANSLATION_SCHEMA,
  WEBGPU_MARCHING_CUBES_SCALAR_BUFFER_LAYOUT_NAME,
  WEBGPU_MARCHING_CUBES_SCALAR_BUFFER_VOLUME_SOURCE,
  WEBGPU_MARCHING_CUBES_COMPACT_POSITION_ROWS_SCHEMA,
  WEBGPU_MARCHING_CUBES_INDIRECT_DRAW_ROWS_SCHEMA,
  WEBGPU_MARCHING_CUBES_PREFLIGHT_SCHEMA,
  WEBGPU_MARCHING_CUBES_SURFACE_DRAW_ROWS_SCHEMA,
  WEBGPU_MARCHING_CUBES_SURFACE_EXECUTION_SCHEMA,
  WEBGPU_MARCHING_CUBES_SURFACE_OUTPUT_DESCRIPTOR_SCHEMA,
  WEBGPU_MARCHING_CUBES_SURFACE_ROW_METADATA_SCHEMA,
  WEBGPU_MARCHING_CUBES_SURFACE_SCHEMA,
  buildWebGpuMarchingCubesExtensionSurfaceRowsWebGpu,
  createUlgRenderFieldBufferVolumeDescriptor,
  createUlgWebGpuMarchingCubesExtensionAdapter,
  summarizeWebGpuMarchingCubesExtensionExecution,
  translateWebGpuMarchingCubesSurfaceToUlgRows,
  webGpuMarchingCubesExtensionSurfaceRowsWgsl
} from '../src/runtime/sph/sphMarchingCubesSurfaceAdapter.js';

function extensionExecution({
  status = 'surface-ready',
  ok = true,
  vertexCount = 3,
  vertexStrideFloats = 4,
  vertexFormat = ULG_MARCHING_CUBES_EXTENSION_POSITION_VERTEX_FORMAT,
  bufferRetained = true,
  readback = false,
  resourceOwnershipStatus = 'same-device',
  includeRowMetadata = false,
  includeOutputDescriptors = false,
  topLevelBuffer = true
} = {}) {
  const buffer = bufferRetained ? { label: 'surface-buffer', size: vertexCount * vertexStrideFloats * 4 } : null;
  const resourceOwnership = {
    ok: resourceOwnershipStatus !== 'cross-device-resource',
    status: resourceOwnershipStatus
  };
  const rowMetadata = includeRowMetadata ? {
    schema: WEBGPU_MARCHING_CUBES_SURFACE_ROW_METADATA_SCHEMA,
    status: buffer ? 'surface-position-rows-resident' : 'surface-position-rows-empty',
    readback: false,
    fullReadback: false,
    rowCount: vertexCount,
    triangleCount: vertexCount / 3,
    position: {
      schema: WEBGPU_MARCHING_CUBES_COMPACT_POSITION_ROWS_SCHEMA,
      family: 'position',
      status: buffer ? 'position-rows-resident' : 'position-rows-empty',
      available: Boolean(buffer),
      rowLayout: ['positionX:f32', 'positionY:f32', 'positionZ:f32', 'padding:f32'],
      rowStrideFloats: vertexStrideFloats,
      rowStrideBytes: vertexStrideFloats * Float32Array.BYTES_PER_ELEMENT,
      rowCount: vertexCount,
      buffer,
      bufferByteLength: vertexCount * vertexStrideFloats * 4,
      bufferRetained: Boolean(bufferRetained && buffer),
      resourceOwnership,
      readback: false
    },
    normal: {
      status: 'normal-rows-not-produced',
      available: false
    },
    material: {
      status: 'material-rows-not-produced',
      available: false
    }
  } : null;
  const outputDescriptors = includeOutputDescriptors ? {
    schema: WEBGPU_MARCHING_CUBES_SURFACE_OUTPUT_DESCRIPTOR_SCHEMA,
    status: buffer ? 'surface-outputs-resident' : 'surface-outputs-empty',
    topology: 'triangle-list',
    readback: false,
    fullReadback: false,
    retainedBuffers: {
      position: buffer
    },
    rows: {
      position: {
        schema: WEBGPU_MARCHING_CUBES_COMPACT_POSITION_ROWS_SCHEMA,
        family: 'position',
        status: buffer ? 'position-rows-resident' : 'position-rows-empty',
        available: Boolean(buffer),
        layoutName: 'peercompute.webgpu-marching-cubes.layout.compact-position-f32x4.v0',
        rowLayout: ['positionX:f32', 'positionY:f32', 'positionZ:f32', 'padding:f32'],
        rowStrideFloats: vertexStrideFloats,
        rowStrideBytes: vertexStrideFloats * Float32Array.BYTES_PER_ELEMENT,
        rowCount: vertexCount,
        buffer,
        bufferByteLength: vertexCount * vertexStrideFloats * 4,
        bufferRetained: Boolean(bufferRetained && buffer),
        resourceOwnership,
        readback: false
      },
      normal: {
        status: 'normal-rows-not-produced',
        available: false
      },
      material: {
        status: 'material-rows-not-produced',
        available: false
      },
      draw: {
        schema: WEBGPU_MARCHING_CUBES_SURFACE_DRAW_ROWS_SCHEMA,
        status: 'draw-rows-not-produced',
        available: false
      },
      indirect: {
        schema: WEBGPU_MARCHING_CUBES_INDIRECT_DRAW_ROWS_SCHEMA,
        status: 'indirect-draw-rows-not-produced',
        available: false
      }
    },
    materialPayload: {
      schema: 'peercompute.webgpu-marching-cubes.material-metadata.v0',
      available: true,
      payload: { materialId: 7 }
    },
    pbrPayload: {
      schema: 'peercompute.webgpu-marching-cubes.pbr-metadata.v0',
      available: true,
      payload: { roughnessFactor: 0.4 }
    }
  } : null;
  return {
    schema: WEBGPU_MARCHING_CUBES_SURFACE_EXECUTION_SCHEMA,
    adapterId: 'webgpu-marching-cubes',
    backend: 'webgpu',
    status,
    ok,
    ownsDevice: false,
    ownerDeviceId: 'gpu-device-1',
    readback,
    surfaceVertexReadback: readback,
    webgpuStatus: { status: ok ? 'executed' : 'blocked', reason: ok ? null : status },
    result: {
      schema: WEBGPU_MARCHING_CUBES_SURFACE_SCHEMA,
      status: ok ? 'surface-ready' : 'surface-device-check-failed',
      vertexCount,
      triangleCount: vertexCount / 3,
      vertexStrideFloats,
      vertexStrideBytes: vertexStrideFloats * Float32Array.BYTES_PER_ELEMENT,
      vertexFormat,
      buffer: topLevelBuffer ? buffer : null,
      bufferByteLength: vertexCount * vertexStrideFloats * 4,
      bufferRetained: topLevelBuffer ? bufferRetained : false,
      resourceOwnership: topLevelBuffer ? resourceOwnership : null,
      rowMetadata,
      outputDescriptors
    }
  };
}

function assertApprox(actual, expected, epsilon = 1e-6) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `expected ${actual} to be within ${epsilon} of ${expected}`
  );
}

function fakeExtensionSurfaceDevice() {
  const shaderModules = [];
  const bindGroups = [];
  const dispatches = [];
  const copies = [];
  const createdBuffers = [];
  const queueWrites = [];
  const device = {
    queue: {
      writeBuffer(buffer, offset, data) {
        queueWrites.push({ buffer, offset, byteLength: data?.byteLength ?? 0 });
      },
      submit(commands) {
        this.submitted = commands;
      },
      async onSubmittedWorkDone() {}
    },
    createBuffer({ label, size, usage }) {
      const buffer = {
        label,
        size,
        usage,
        destroyed: false,
        async mapAsync() {},
        getMappedRange() {
          return new ArrayBuffer(size);
        },
        unmap() {
          this.unmapped = true;
        },
        destroy() {
          this.destroyed = true;
        }
      };
      createdBuffers.push(buffer);
      return buffer;
    },
    createShaderModule({ label, code }) {
      const module = { label, code };
      shaderModules.push(module);
      return module;
    },
    createComputePipeline({ label, layout, compute }) {
      return {
        label,
        layout,
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
            setPipeline(pipeline) {
              this.pipeline = pipeline;
            },
            setBindGroup(index, bindGroup) {
              this.bindGroup = { index, bindGroup };
            },
            dispatchWorkgroups(count) {
              dispatches.push({ count, pipeline: this.pipeline, bindGroup: this.bindGroup?.bindGroup });
            },
            end() {
              this.ended = true;
            }
          };
        },
        copyBufferToBuffer(source, sourceOffset, destination, destinationOffset, size) {
          copies.push({ source, sourceOffset, destination, destinationOffset, size });
        },
        finish() {
          return { dispatches: [...dispatches], copies: [...copies] };
        }
      };
    }
  };
  return { device, shaderModules, bindGroups, dispatches, copies, createdBuffers, queueWrites };
}

test('ULG exposes retained render-field buffers as native MC scalar-buffer volumes', () => {
  const device = { label: 'ulg-render-device' };
  const scalarBuffer = {
    label: 'ulg-render-field-rows',
    size: 4 * 4 * 8 * 8 * 8 * 2,
    device
  };
  const surfaceTable = {
    schema: ULG_SPH_GPU_RENDER_FIELD_SCHEMA,
    surfaceCount: 2,
    metadata: [
      {
        surfaceKey: 'h2o|h2o|liquid|domain:base',
        material: 'h2o',
        phase: 'liquid',
        renderKey: 'h2o',
        renderDomainId: 1,
        renderDomainKey: 'base',
        resolution: 8,
        fieldOffset: 0,
        fieldCellCount: 8 ** 3,
        isolation: 14
      },
      {
        surfaceKey: 'h2o|h2o|liquid|domain:drop',
        material: 'h2o',
        phase: 'liquid',
        renderKey: 'h2o',
        renderDomainId: 2,
        renderDomainKey: 'drop',
        resolution: 8,
        fieldOffset: 8 ** 3,
        fieldCellCount: 8 ** 3,
        isolation: 14
      }
    ]
  };
  const renderField = {
    schema: ULG_SPH_GPU_RENDER_FIELD_SCHEMA,
    backend: 'webgpu',
    surfaceTable,
    surfaceCount: 2,
    rowLayout: [...SPH_GPU_RENDER_FIELD_CELL_ROW_LAYOUT],
    rowStrideFloats: SPH_GPU_RENDER_FIELD_CELL_ROW_LAYOUT.length,
    totalFieldCells: 8 ** 3 * 2,
    fieldRowsBufferRetained: true,
    fieldRowsBuffer: scalarBuffer,
    fieldRowsBufferByteLength: scalarBuffer.size,
    fieldPadding: 0.22,
    refEdgeM: 5
  };

  const descriptor = createUlgRenderFieldBufferVolumeDescriptor({
    device,
    renderField,
    surfaceIndex: 1
  });

  assert.equal(descriptor.ok, true);
  assert.equal(descriptor.status, 'ulg-render-field-buffer-volume-descriptor-ready');
  assert.equal(descriptor.extensionDescriptorFactory, 'createBufferVolumeDescriptor');
  assert.equal(descriptor.sourceType, WEBGPU_MARCHING_CUBES_SCALAR_BUFFER_VOLUME_SOURCE);
  assert.equal(descriptor.scalarLayoutName, WEBGPU_MARCHING_CUBES_SCALAR_BUFFER_LAYOUT_NAME);
  assert.equal(descriptor.scalarBuffer, scalarBuffer);
  assert.equal(descriptor.storageBuffer, scalarBuffer);
  assert.equal(descriptor.buffer, scalarBuffer);
  assert.deepEqual(descriptor.dims, [8, 8, 8]);
  assert.deepEqual(descriptor.scalarStrides, [4, 32, 256]);
  assert.equal(descriptor.scalarOffset, 8 ** 3 * 4);
  assert.equal(descriptor.scalarOffsetBytes, 8 ** 3 * 4 * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(descriptor.scalarLane, 'density');
  assert.equal(descriptor.scalarLaneIndex, 0);
  assert.equal(descriptor.rowStrideFloats, 32);
  assert.equal(descriptor.sliceStrideFloats, 256);
  assert.equal(descriptor.cellRowStrideFloats, 4);
  assert.equal(descriptor.isovalue, 14);
  assert.equal(descriptor.sameDeviceStatus, 'same-device');
  assert.equal(descriptor.nativeConsumerKind, 'native-webgpu-marching-cubes-buffer-volume');
  assert.equal(descriptor.nativeRequiredAdapter, 'webgpu-marching-cubes.buffer-volume.v0');

  const tooSmall = createUlgRenderFieldBufferVolumeDescriptor({
    device,
    renderField: {
      ...renderField,
      fieldRowsBuffer: { label: 'small-field', size: 16, device },
      fieldRowsBufferByteLength: 16
    },
    surfaceIndex: 1
  });
  assert.equal(tooSmall.ok, false);
  assert.equal(tooSmall.status, 'ulg-render-field-buffer-volume-blocked-undersized-buffer');
  assert.equal(tooSmall.scalarRequiredByteLength > tooSmall.scalarBufferByteLength, true);

  const crossDevice = createUlgRenderFieldBufferVolumeDescriptor({
    device,
    renderField: {
      ...renderField,
      fieldRowsBuffer: {
        label: 'other-device-field',
        size: scalarBuffer.size,
        device: { label: 'other-device' }
      }
    },
    surfaceIndex: 0
  });
  assert.equal(crossDevice.ok, false);
  assert.equal(crossDevice.status, 'ulg-render-field-buffer-volume-blocked-cross-device');
  assert.equal(crossDevice.sameDeviceStatus, 'cross-device-resource');
});

test('ULG summarizes extension compact position buffers as translation-ready but not direct row-compatible', () => {
  const summary = summarizeWebGpuMarchingCubesExtensionExecution(extensionExecution());

  assert.equal(summary.schema, ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_EXECUTION_SCHEMA);
  assert.equal(summary.status, 'extension-surface-ready-needs-ulg-row-translation');
  assert.equal(summary.extensionExecutionSchema, WEBGPU_MARCHING_CUBES_SURFACE_EXECUTION_SCHEMA);
  assert.equal(summary.extensionSurfaceSchema, WEBGPU_MARCHING_CUBES_SURFACE_SCHEMA);
  assert.equal(summary.extensionVertexFormat, ULG_MARCHING_CUBES_EXTENSION_POSITION_VERTEX_FORMAT);
  assert.equal(summary.extensionVertexStrideFloats, 4);
  assert.equal(summary.extensionVertexCount, 3);
  assert.equal(summary.readyForUlgSurfaceVertexRows, false);
  assert.equal(summary.requiresUlgVertexRowTranslation, true);
  assert.equal(summary.requiresUlgDrawMetadata, true);
  assert.equal(summary.hotLoopSafe, true);
  assert.equal(summary.surfaceVertexSchema, ULG_SPH_GPU_RENDER_SURFACE_VERTICES_SCHEMA);
  assert.equal(summary.surfaceVertexRowStrideFloats, SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT.length);
  assert.deepEqual(summary.surfaceDrawRowLayout, [...SPH_GPU_RENDER_SURFACE_DRAW_ROW_LAYOUT]);
  assert.equal(summary.surfaceDrawSchema, ULG_SPH_GPU_RENDER_SURFACE_DRAW_SCHEMA);
  assert.deepEqual(summary.surfaceDrawIndirectRowLayout, [...SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_ROW_LAYOUT]);
  assert.equal(summary.surfaceDrawIndirectSchema, ULG_SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_SCHEMA);
});

test('ULG consumes extension compact position row metadata without legacy top-level buffers', async () => {
  const { device, bindGroups } = fakeExtensionSurfaceDevice();
  const execution = extensionExecution({
    includeRowMetadata: true,
    topLevelBuffer: false,
    vertexCount: 3
  });
  const rowBuffer = execution.result.rowMetadata.position.buffer;
  const summary = summarizeWebGpuMarchingCubesExtensionExecution(execution);

  assert.equal(summary.status, 'extension-surface-ready-needs-ulg-row-translation');
  assert.equal(summary.extensionBufferRetained, true);
  assert.equal(summary.extensionBufferByteLength, rowBuffer.size);
  assert.equal(summary.extensionRowMetadataSchema, WEBGPU_MARCHING_CUBES_SURFACE_ROW_METADATA_SCHEMA);
  assert.equal(summary.extensionPositionRowsSchema, WEBGPU_MARCHING_CUBES_COMPACT_POSITION_ROWS_SCHEMA);
  assert.equal(summary.extensionPositionRowsStatus, 'position-rows-resident');
  assert.equal(summary.extensionPositionRowsAvailable, true);
  assert.equal(summary.extensionPositionRowsReadback, false);
  assert.equal(summary.extensionNormalRowsStatus, 'normal-rows-not-produced');
  assert.equal(summary.extensionMaterialRowsStatus, 'material-rows-not-produced');
  assert.equal(summary.hotLoopSafe, true);

  const translated = await buildWebGpuMarchingCubesExtensionSurfaceRowsWebGpu({
    device,
    extensionExecution: execution,
    readbackMode: 'no-full-readback'
  });

  assert.equal(translated.status, 'extension-surface-translated-resident-webgpu');
  assert.equal(bindGroups[0].entries[0].resource.buffer, rowBuffer);
});

test('ULG consumes extension output descriptors without row metadata or legacy top-level buffers', async () => {
  const { device, bindGroups } = fakeExtensionSurfaceDevice();
  const execution = extensionExecution({
    includeOutputDescriptors: true,
    includeRowMetadata: false,
    topLevelBuffer: false,
    vertexCount: 3
  });
  const descriptorBuffer = execution.result.outputDescriptors.rows.position.buffer;
  const summary = summarizeWebGpuMarchingCubesExtensionExecution(execution);

  assert.equal(summary.status, 'extension-surface-ready-needs-ulg-row-translation');
  assert.equal(summary.extensionBufferRetained, true);
  assert.equal(summary.extensionBufferByteLength, descriptorBuffer.size);
  assert.equal(summary.extensionOutputDescriptorSchema, WEBGPU_MARCHING_CUBES_SURFACE_OUTPUT_DESCRIPTOR_SCHEMA);
  assert.equal(summary.extensionOutputDescriptorStatus, 'surface-outputs-resident');
  assert.equal(summary.extensionOutputDescriptorTopology, 'triangle-list');
  assert.equal(summary.extensionRowMetadataSchema, null);
  assert.equal(summary.extensionPositionRowsSchema, WEBGPU_MARCHING_CUBES_COMPACT_POSITION_ROWS_SCHEMA);
  assert.equal(summary.extensionPositionRowsStatus, 'position-rows-resident');
  assert.equal(summary.extensionPositionRowsAvailable, true);
  assert.equal(summary.extensionPositionRowsLayoutName, 'peercompute.webgpu-marching-cubes.layout.compact-position-f32x4.v0');
  assert.equal(summary.extensionDrawRowsStatus, 'draw-rows-not-produced');
  assert.equal(summary.extensionDrawRowsAvailable, false);
  assert.equal(summary.extensionIndirectDrawRowsStatus, 'indirect-draw-rows-not-produced');
  assert.equal(summary.extensionIndirectDrawRowsAvailable, false);
  assert.equal(summary.extensionMaterialMetadataAvailable, true);
  assert.equal(summary.extensionPbrMetadataAvailable, true);
  assert.equal(summary.hotLoopSafe, true);

  const translated = await buildWebGpuMarchingCubesExtensionSurfaceRowsWebGpu({
    device,
    extensionExecution: execution,
    readbackMode: 'no-full-readback'
  });

  assert.equal(translated.status, 'extension-surface-translated-resident-webgpu');
  assert.equal(bindGroups[0].entries[0].resource.buffer, descriptorBuffer);
});

test('ULG wrapper preserves caller-owned device and adapter swapability', async () => {
  const device = { label: 'scene-device' };
  const volume = { label: 'resident-render-field-volume' };
  let factoryCalled = 0;
  let preflightCalled = 0;
  const wrapper = createUlgWebGpuMarchingCubesExtensionAdapter({
    device,
    volume,
    adapterFactory({ device: receivedDevice, volume: receivedVolume }) {
      factoryCalled += 1;
      assert.equal(receivedDevice, device);
      assert.equal(receivedVolume, volume);
      return {
        schema: 'peercompute.webgpu-marching-cubes.surface-adapter.v0',
        preflight(request) {
          preflightCalled += 1;
          assert.equal(request.volume, volume);
          assert.equal(request.isovalue, 0.5);
          return {
            schema: WEBGPU_MARCHING_CUBES_PREFLIGHT_SCHEMA,
            ok: true,
            status: 'ready',
            deviceChecks: [{ ok: true, status: 'same-device', label: 'volume.device' }]
          };
        },
        async extractSurface(request) {
          assert.equal(request.volume, volume);
          assert.equal(request.isovalue, 0.5);
          return extensionExecution();
        }
      };
    }
  });

  assert.equal(wrapper.ownsDevice, false);
  const execution = await wrapper.extractSurface({ isovalue: 0.5 });

  assert.equal(factoryCalled, 1);
  assert.equal(preflightCalled, 1);
  assert.equal(execution.schema, ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_EXECUTION_SCHEMA);
  assert.equal(execution.status, 'extension-surface-ready-needs-ulg-row-translation');
  assert.equal(execution.ownsDevice, false);
  assert.equal(execution.preflight.schema, ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_PREFLIGHT_SCHEMA);
  assert.equal(execution.preflight.status, 'extension-preflight-ready');
  assert.equal(execution.preflight.extensionPreflightSchema, WEBGPU_MARCHING_CUBES_PREFLIGHT_SCHEMA);
  assert.equal(execution.extensionAdapterSchema, 'peercompute.webgpu-marching-cubes.surface-adapter.v0');
  assert.equal(execution.readyForUlgSurfaceVertexRows, false);
  assert.equal(execution.requiresUlgVertexRowTranslation, true);
  assert.equal(execution.hotLoopSafe, true);
});

test('ULG wrapper stops extraction when extension preflight blocks', async () => {
  let extractCalled = false;
  const wrapper = createUlgWebGpuMarchingCubesExtensionAdapter({
    device: { label: 'expected-device' },
    volume: { label: 'foreign-volume' },
    adapter: {
      schema: 'peercompute.webgpu-marching-cubes.surface-adapter.v0',
      preflight() {
        return {
          schema: WEBGPU_MARCHING_CUBES_PREFLIGHT_SCHEMA,
          ok: false,
          status: 'preflight-check-failed',
          deviceChecks: [
            { ok: false, status: 'cross-device-volume', label: 'volume.device' }
          ]
        };
      },
      async extractSurface() {
        extractCalled = true;
        return extensionExecution();
      }
    }
  });

  const execution = await wrapper.extractSurface({ isovalue: 0.25 });

  assert.equal(extractCalled, false);
  assert.equal(execution.schema, ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_EXECUTION_SCHEMA);
  assert.equal(execution.status, 'extension-surface-preflight-blocked');
  assert.equal(execution.reason, 'preflight-check-failed');
  assert.equal(execution.preflight.schema, ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_PREFLIGHT_SCHEMA);
  assert.equal(execution.preflight.status, 'extension-preflight-blocked');
  assert.equal(execution.preflight.deviceChecks[0].status, 'cross-device-volume');
  assert.equal(execution.readyForUlgSurfaceVertexRows, false);
  assert.equal(execution.hotLoopSafe, false);
});

test('ULG wrapper propagates extension same-device blockers before renderer integration', async () => {
  const wrapper = createUlgWebGpuMarchingCubesExtensionAdapter({
    device: { label: 'expected-device' },
    volume: { label: 'foreign-volume' },
    adapter: {
      schema: 'peercompute.webgpu-marching-cubes.surface-adapter.v0',
      async extractSurface() {
        return {
          ...extensionExecution({ ok: false, status: 'same-device-check-failed', vertexCount: 0, bufferRetained: false }),
          status: 'same-device-check-failed',
          deviceChecks: [
            { ok: false, status: 'cross-device-volume', label: 'volume.device' }
          ],
          result: {
            schema: WEBGPU_MARCHING_CUBES_SURFACE_SCHEMA,
            status: 'surface-device-check-failed',
            reason: 'cross-device-volume',
            vertexCount: 0,
            triangleCount: 0,
            vertexStrideFloats: 4,
            vertexStrideBytes: 16,
            vertexFormat: ULG_MARCHING_CUBES_EXTENSION_POSITION_VERTEX_FORMAT,
            buffer: null,
            bufferRetained: false,
            resourceOwnership: null
          }
        };
      }
    }
  });

  const execution = await wrapper.extractSurface({ isovalue: 0.25 });

  assert.equal(execution.status, 'extension-surface-same-device-check-failed');
  assert.equal(execution.readyForUlgSurfaceVertexRows, false);
  assert.equal(execution.requiresUlgVertexRowTranslation, true);
  assert.equal(execution.hotLoopSafe, false);
  assert.equal(execution.summary.reason, 'same-device-check-failed');
});

test('ULG translates extension compact position rows into native surface vertices and draw metadata', () => {
  const translation = translateWebGpuMarchingCubesSurfaceToUlgRows({
    extensionExecution: extensionExecution(),
    positionRows: new Float32Array([
      0, 0, 0, 1,
      1, 0, 0, 1,
      0, 1, 0, 1
    ]),
    surfaceIndex: 2,
    materialId: 42,
    phaseId: 3,
    opticalStateId: 7,
    material: 'h2o',
    phase: 'liquid',
    density: 1000,
    isolation: 0.5,
    sourceVoxelLinearIndex: 11,
    transparencyClassId: 4,
    depthWriteFlag: 1,
    renderOrder: 9
  });

  assert.equal(translation.schema, ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_TRANSLATION_SCHEMA);
  assert.equal(translation.status, 'extension-surface-translated-to-ulg-rows');
  assert.equal(translation.hotLoopGpuTranslationRequired, false);
  assert.equal(translation.sourceVertexCount, 3);
  assert.equal(translation.translatedVertexCount, 3);
  assert.equal(translation.ignoredTrailingVertexCount, 0);

  const vertices = translation.surfaceVertices;
  assert.equal(vertices.schema, ULG_SPH_GPU_RENDER_SURFACE_VERTICES_SCHEMA);
  assert.equal(vertices.status, 'surface-vertices-ready');
  assert.equal(vertices.vertexCount, 3);
  assert.equal(vertices.triangleCount, 1);
  assert.deepEqual(vertices.rowLayout, [...SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT]);
  assert.equal(vertices.rowStrideFloats, SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT.length);
  assert.equal(vertices.surfaceVertexReadback, true);
  assert.equal(vertices.surfaces.length, 1);
  assert.equal(vertices.surfaces[0].surfaceIndex, 2);
  assert.equal(vertices.surfaces[0].material, 'h2o');
  assert.equal(vertices.surfaces[0].phase, 'liquid');

  const rowStride = SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT.length;
  const firstVertex = [...vertices.vertexRows.slice(0, rowStride)];
  assert.deepEqual(firstVertex.slice(0, 8), [
    2,
    42,
    3,
    0,
    0,
    0,
    0,
    0
  ]);
  assert.deepEqual(firstVertex.slice(8, 16), [
    0,
    0,
    1,
    7,
    1000,
    0.5,
    11,
    1
  ]);
  assert.deepEqual([...vertices.vertexRows.slice(rowStride + 5, rowStride + 8)], [1, 0, 0]);
  assert.deepEqual([...vertices.vertexRows.slice(rowStride * 2 + 5, rowStride * 2 + 8)], [0, 1, 0]);

  const draw = translation.surfaceDraw;
  assert.equal(draw.schema, ULG_SPH_GPU_RENDER_SURFACE_DRAW_SCHEMA);
  assert.equal(draw.drawIndirectSchema, ULG_SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_SCHEMA);
  assert.equal(draw.status, 'surface-draw-metadata-ready');
  assert.equal(draw.surfaceCount, 1);
  assert.equal(draw.activeSurfaceCount, 1);
  assert.equal(draw.vertexCount, 3);
  assert.equal(draw.triangleCount, 1);
  assert.deepEqual(draw.rowLayout, [...SPH_GPU_RENDER_SURFACE_DRAW_ROW_LAYOUT]);
  assert.deepEqual(draw.drawIndirectRowLayout, [...SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_ROW_LAYOUT]);

  const drawRow = [...draw.drawRows];
  assert.deepEqual(drawRow.slice(0, 12), [
    2,
    42,
    3,
    7,
    0,
    3,
    0,
    1,
    9,
    4,
    1,
    1
  ]);
  assertApprox(drawRow[12], 0.5);
  assertApprox(drawRow[13], 0.5);
  assertApprox(drawRow[14], 0);
  assertApprox(drawRow[15], Math.hypot(0.5, 0.5, 0));
  assert.deepEqual([...draw.drawIndirectRows], [3, 1, 0, 2]);
});

test('ULG reports retained extension buffers need a GPU translation kernel when CPU positions are absent', () => {
  const translation = translateWebGpuMarchingCubesSurfaceToUlgRows({
    extensionExecution: extensionExecution()
  });

  assert.equal(translation.schema, ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_TRANSLATION_SCHEMA);
  assert.equal(translation.status, 'extension-surface-translation-needs-position-readback-or-gpu-kernel');
  assert.equal(translation.sourceBufferRetained, true);
  assert.equal(translation.hotLoopGpuTranslationRequired, true);
  assert.equal(translation.surfaceVertices, null);
  assert.equal(translation.surfaceDraw, null);
});

test('ULG translation preserves extension blockers instead of manufacturing render rows', () => {
  const translation = translateWebGpuMarchingCubesSurfaceToUlgRows({
    extensionExecution: extensionExecution({
      ok: false,
      status: 'same-device-check-failed',
      vertexCount: 0,
      bufferRetained: false
    })
  });

  assert.equal(translation.schema, ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_TRANSLATION_SCHEMA);
  assert.equal(translation.status, 'extension-surface-translation-blocked');
  assert.equal(translation.surfaceVertices, null);
  assert.equal(translation.surfaceDraw, null);
  assert.equal(translation.summary.status, 'extension-surface-same-device-check-failed');
});

test('ULG GPU builder translates retained extension compact positions into resident surface draw buffers', async () => {
  const { device, shaderModules, bindGroups, dispatches, createdBuffers, queueWrites } = fakeExtensionSurfaceDevice();
  const execution = extensionExecution({ vertexCount: 3 });

  const result = await buildWebGpuMarchingCubesExtensionSurfaceRowsWebGpu({
    device,
    extensionExecution: execution,
    surfaceIndex: 5,
    materialId: 12,
    phaseId: 2,
    opticalStateId: 8,
    material: 'h2o',
    phase: 'liquid',
    density: 998,
    isolation: 0.25,
    readbackMode: 'no-full-readback',
    retainVertexRowsBuffer: true,
    retainDrawRowsBuffer: true,
    retainDrawIndirectRowsBuffer: true
  });

  assert.equal(result.schema, ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_TRANSLATION_SCHEMA);
  assert.equal(result.backend, 'webgpu');
  assert.equal(result.status, 'extension-surface-translated-resident-webgpu');
  assert.equal(result.sourceBufferBound, true);
  assert.equal(result.sourceBufferRetained, true);
  assert.equal(result.sourceVertexCount, 3);
  assert.equal(result.translatedVertexCount, 3);
  assert.equal(result.triangleCount, 1);
  assert.equal(result.queueCompletionStatus, 'queue-work-completed');
  assert.equal(result.queueCompletionMethod, 'queue.onSubmittedWorkDone');
  assert.equal(result.hotLoopGpuTranslationRequired, false);

  assert.equal(result.surfaceVertices.schema, ULG_SPH_GPU_RENDER_SURFACE_VERTICES_SCHEMA);
  assert.equal(result.surfaceVertices.backend, 'webgpu');
  assert.equal(result.surfaceVertices.vertexRowsBufferRetained, true);
  assert.equal(result.surfaceVertices.vertexRowsBufferRowCount, 3);
  assert.equal(result.surfaceVertices.vertexRowsBufferByteLength, 3 * SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT.length * 4);
  assert.equal(result.surfaceVertices.surfaceVertexReadback, false);
  assert.equal(result.surfaceVertices.vertexRows.length, 0);
  assert.equal(result.surfaceVertices.surfaces[0].surfaceIndex, 5);

  assert.equal(result.surfaceDraw.schema, ULG_SPH_GPU_RENDER_SURFACE_DRAW_SCHEMA);
  assert.equal(result.surfaceDraw.backend, 'webgpu');
  assert.equal(result.surfaceDraw.drawRowsBufferRetained, true);
  assert.equal(result.surfaceDraw.drawIndirectRowsBufferRetained, true);
  assert.equal(result.surfaceDraw.compactedVertexRowsBufferRetained, true);
  assert.equal(result.surfaceDraw.drawRowsByteLength, SPH_GPU_RENDER_SURFACE_DRAW_ROW_LAYOUT.length * 4);
  assert.equal(result.surfaceDraw.drawIndirectRowsByteLength, SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_ROW_LAYOUT.length * 4);
  assert.equal(result.surfaceDraw.surfaceDrawReadback, false);
  assert.equal(result.surfaceDraw.compactedVertexRowsBuffer, result.surfaceVertices.vertexRowsBuffer);
  assert.equal(result.surfaceDraw.surfaces[0].status, 'surface-draw-summary-not-read');

  assert.equal(result.residentBufferLeaseLedgerStatus, 'resident-buffer-lease-ledger-active');
  assert.equal(result.residentBufferLeaseResourceCount, 3);
  assert.equal(result.residentBufferLeaseActiveLeaseCount, 3);
  assert.equal(shaderModules.length, 1);
  assert.equal(shaderModules[0].code, webGpuMarchingCubesExtensionSurfaceRowsWgsl);
  assert.match(shaderModules[0].code, /SurfaceTranslationParams|compact_position_rows|surface_draw_indirect_rows/);
  assert.equal(bindGroups.length, 1);
  assert.equal(bindGroups[0].entries.length, 5);
  assert.equal(bindGroups[0].entries[0].resource.buffer, execution.result.buffer);
  assert.equal(bindGroups[0].entries[1].resource.buffer.label, 'ulg-sph-extension-surface-vertices');
  assert.equal(bindGroups[0].entries[2].resource.buffer.label, 'ulg-sph-extension-surface-draw');
  assert.equal(bindGroups[0].entries[3].resource.buffer.label, 'ulg-sph-extension-surface-draw-indirect');
  assert.deepEqual(dispatches.map((dispatch) => dispatch.count), [1]);
  assert.ok(createdBuffers.some((buffer) => buffer.label === 'ulg-sph-extension-surface-translation-params'));
  assert.ok(queueWrites.some((write) => write.buffer.label === 'ulg-sph-extension-surface-translation-params' && write.byteLength === 64));

  const retainedBuffers = [
    result.surfaceVertices.vertexRowsBuffer,
    result.surfaceDraw.drawRowsBuffer,
    result.surfaceDraw.drawIndirectRowsBuffer
  ];
  result.destroyExtensionSurfaceBuffers();
  assert.equal(result.residentBufferLeaseSummary.skippedDestroyCount, 3);
  assert.equal(retainedBuffers.every((buffer) => buffer.destroyed === false), true);
  result.releaseExtensionSurfaceBufferLeases();
  assert.equal(result.residentBufferLeaseLedgerStatus, 'resident-buffer-lease-ledger-ready');
  result.destroyExtensionSurfaceBuffers();
  assert.equal(result.residentBufferLeaseLedgerStatus, 'resident-buffer-lease-ledger-cleaned');
  assert.equal(retainedBuffers.every((buffer) => buffer.destroyed === true), true);
});

test('ULG GPU builder exposes full-readback rows for the Three compact scene bridge', async () => {
  const { device } = fakeExtensionSurfaceDevice();
  const result = await buildWebGpuMarchingCubesExtensionSurfaceRowsWebGpu({
    device,
    extensionExecution: extensionExecution({ vertexCount: 3 }),
    readbackMode: 'full-parity-readback',
    retainVertexRowsBuffer: false,
    retainDrawRowsBuffer: false,
    retainDrawIndirectRowsBuffer: false
  });

  assert.equal(result.surfaceVertices.surfaceVertexReadback, true);
  assert.equal(result.surfaceVertices.vertexRows.length, 3 * SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT.length);
  assert.equal(result.surfaceDraw.surfaceDrawReadback, true);
  assert.equal(result.surfaceDraw.compactedVertexRows, result.surfaceVertices.vertexRows);
  assert.equal(result.surfaceDraw.compactedVertexRowsByteLength, result.surfaceVertices.vertexRows.byteLength);
  assert.equal(result.surfaceDraw.compactedVertexRowsBufferRetained, false);
  assert.equal(result.surfaceDraw.surfaces[0].status, 'surface-draw-ready');
});

test('ULG GPU builder rejects extension buffers reported on a different GPUDevice', async () => {
  const { device } = fakeExtensionSurfaceDevice();
  await assert.rejects(
    buildWebGpuMarchingCubesExtensionSurfaceRowsWebGpu({
      device,
      extensionExecution: extensionExecution({
        resourceOwnershipStatus: 'cross-device-resource'
      })
    }),
    /not owned by this GPUDevice/
  );
});
