import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_ROW_LAYOUT,
  SPH_GPU_RENDER_SURFACE_DRAW_ROW_LAYOUT,
  SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT,
  ULG_SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_SCHEMA,
  ULG_SPH_GPU_RENDER_SURFACE_DRAW_SCHEMA,
  ULG_SPH_GPU_RENDER_SURFACE_VERTICES_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import {
  ULG_MARCHING_CUBES_EXTENSION_POSITION_VERTEX_FORMAT,
  ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_EXECUTION_SCHEMA,
  ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_TRANSLATION_SCHEMA,
  WEBGPU_MARCHING_CUBES_SURFACE_EXECUTION_SCHEMA,
  WEBGPU_MARCHING_CUBES_SURFACE_SCHEMA,
  createUlgWebGpuMarchingCubesExtensionAdapter,
  summarizeWebGpuMarchingCubesExtensionExecution,
  translateWebGpuMarchingCubesSurfaceToUlgRows
} from '../src/runtime/sph/sphMarchingCubesSurfaceAdapter.js';

function extensionExecution({
  status = 'surface-ready',
  ok = true,
  vertexCount = 3,
  vertexStrideFloats = 4,
  vertexFormat = ULG_MARCHING_CUBES_EXTENSION_POSITION_VERTEX_FORMAT,
  bufferRetained = true,
  readback = false,
  resourceOwnershipStatus = 'same-device'
} = {}) {
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
      buffer: bufferRetained ? { label: 'surface-buffer', size: vertexCount * vertexStrideFloats * 4 } : null,
      bufferByteLength: vertexCount * vertexStrideFloats * 4,
      bufferRetained,
      resourceOwnership: { status: resourceOwnershipStatus }
    }
  };
}

function assertApprox(actual, expected, epsilon = 1e-6) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `expected ${actual} to be within ${epsilon} of ${expected}`
  );
}

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

test('ULG wrapper preserves caller-owned device and adapter swapability', async () => {
  const device = { label: 'scene-device' };
  const volume = { label: 'resident-render-field-volume' };
  let factoryCalled = 0;
  const wrapper = createUlgWebGpuMarchingCubesExtensionAdapter({
    device,
    volume,
    adapterFactory({ device: receivedDevice, volume: receivedVolume }) {
      factoryCalled += 1;
      assert.equal(receivedDevice, device);
      assert.equal(receivedVolume, volume);
      return {
        schema: 'peercompute.webgpu-marching-cubes.surface-adapter.v0',
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
  assert.equal(execution.schema, ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_EXECUTION_SCHEMA);
  assert.equal(execution.status, 'extension-surface-ready-needs-ulg-row-translation');
  assert.equal(execution.ownsDevice, false);
  assert.equal(execution.extensionAdapterSchema, 'peercompute.webgpu-marching-cubes.surface-adapter.v0');
  assert.equal(execution.readyForUlgSurfaceVertexRows, false);
  assert.equal(execution.requiresUlgVertexRowTranslation, true);
  assert.equal(execution.hotLoopSafe, true);
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
