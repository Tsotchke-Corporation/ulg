import {
  SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_ROW_LAYOUT,
  SPH_GPU_RENDER_SURFACE_DRAW_ROW_LAYOUT,
  SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT,
  ULG_SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_SCHEMA,
  ULG_SPH_GPU_RENDER_SURFACE_DRAW_SCHEMA,
  ULG_SPH_GPU_RENDER_SURFACE_VERTICES_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';

export const ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_ADAPTER_SCHEMA =
  'peercompute.ulg.sph-webgpu-marching-cubes-extension-adapter.v0';
export const ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_EXECUTION_SCHEMA =
  'peercompute.ulg.sph-webgpu-marching-cubes-extension-execution.v0';
export const WEBGPU_MARCHING_CUBES_SURFACE_EXECUTION_SCHEMA =
  'peercompute.webgpu-marching-cubes.surface-execution.v0';
export const WEBGPU_MARCHING_CUBES_SURFACE_SCHEMA =
  'peercompute.webgpu-marching-cubes.surface.v0';

export const ULG_MARCHING_CUBES_EXTENSION_POSITION_VERTEX_FORMAT = 'float32x4-position';
export const ULG_MARCHING_CUBES_REQUIRED_SURFACE_VERTEX_FORMAT =
  'peercompute.ulg.sph-gpu-render-surface-vertex-row.v0';

function isObject(value) {
  return (typeof value === 'object' || typeof value === 'function') && value !== null;
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeStatusReason(value) {
  if (typeof value === 'string' && value.length > 0) return value;
  return null;
}

function createMissingExecutionSummary(reason) {
  return {
    schema: ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_EXECUTION_SCHEMA,
    status: 'extension-surface-execution-invalid',
    reason,
    extensionExecutionSchema: null,
    extensionSurfaceSchema: null,
    extensionStatus: null,
    extensionOk: false,
    extensionBackend: null,
    extensionAdapterId: null,
    extensionOwnsDevice: null,
    extensionOwnerDeviceId: null,
    extensionResourceOwnershipStatus: null,
    extensionVertexFormat: null,
    extensionVertexStrideFloats: null,
    extensionVertexStrideBytes: null,
    extensionVertexCount: 0,
    extensionTriangleCount: 0,
    extensionBufferRetained: false,
    extensionReadback: null,
    extensionSurfaceVertexReadback: null,
    readyForUlgSurfaceVertexRows: false,
    requiresUlgVertexRowTranslation: true,
    requiresUlgDrawMetadata: true,
    surfaceVertexSchema: ULG_SPH_GPU_RENDER_SURFACE_VERTICES_SCHEMA,
    surfaceVertexFormat: ULG_MARCHING_CUBES_REQUIRED_SURFACE_VERTEX_FORMAT,
    surfaceVertexRowLayout: [...SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT],
    surfaceVertexRowStrideFloats: SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT.length,
    surfaceDrawSchema: ULG_SPH_GPU_RENDER_SURFACE_DRAW_SCHEMA,
    surfaceDrawRowLayout: [...SPH_GPU_RENDER_SURFACE_DRAW_ROW_LAYOUT],
    surfaceDrawRowStrideFloats: SPH_GPU_RENDER_SURFACE_DRAW_ROW_LAYOUT.length,
    surfaceDrawIndirectSchema: ULG_SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_SCHEMA,
    surfaceDrawIndirectRowLayout: [...SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_ROW_LAYOUT],
    surfaceDrawIndirectRowStrideUints: SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_ROW_LAYOUT.length,
    hotLoopSafe: false,
    rendererIntegration: 'not-integrated'
  };
}

export function summarizeWebGpuMarchingCubesExtensionExecution(execution) {
  if (!isObject(execution)) {
    return createMissingExecutionSummary('missing extension surface execution');
  }
  const result = execution.result || null;
  const extensionSurfaceSchema = result?.schema ?? null;
  const extensionOk = execution.ok === true;
  const extensionVertexCount = Math.max(0, Math.round(finiteNumber(result?.vertexCount, 0)));
  const extensionTriangleCount = Math.max(0, finiteNumber(result?.triangleCount, 0));
  const extensionVertexStrideFloats = result?.vertexStrideFloats == null
    ? null
    : Math.max(0, Math.round(finiteNumber(result.vertexStrideFloats, 0)));
  const extensionVertexStrideBytes = result?.vertexStrideBytes == null
    ? null
    : Math.max(0, Math.round(finiteNumber(result.vertexStrideBytes, 0)));
  const extensionVertexFormat = result?.vertexFormat ?? null;
  const extensionBufferRetained = Boolean(result?.bufferRetained && result?.buffer);
  const extensionResourceOwnershipStatus = result?.resourceOwnership?.status ?? null;
  const blockedReason = normalizeStatusReason(execution.webgpuStatus?.reason)
    || normalizeStatusReason(result?.reason)
    || normalizeStatusReason(execution.status);
  const readyCompactPositionBuffer = Boolean(
    extensionOk
    && extensionSurfaceSchema === WEBGPU_MARCHING_CUBES_SURFACE_SCHEMA
    && extensionBufferRetained
    && extensionVertexCount > 0
  );
  const readyForUlgSurfaceVertexRows = Boolean(
    readyCompactPositionBuffer
    && extensionVertexStrideFloats === SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT.length
    && extensionVertexFormat === ULG_MARCHING_CUBES_REQUIRED_SURFACE_VERTEX_FORMAT
  );
  const requiresUlgVertexRowTranslation = !readyForUlgSurfaceVertexRows;
  let status = 'extension-surface-execution-blocked';
  if (!extensionOk) {
    status = execution.status === 'same-device-check-failed'
      ? 'extension-surface-same-device-check-failed'
      : 'extension-surface-execution-blocked';
  } else if (!readyCompactPositionBuffer) {
    status = extensionVertexCount > 0
      ? 'extension-surface-buffer-unavailable'
      : 'extension-surface-empty';
  } else if (requiresUlgVertexRowTranslation) {
    status = 'extension-surface-ready-needs-ulg-row-translation';
  } else {
    status = 'extension-surface-ready-ulg-row-compatible';
  }

  return {
    schema: ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_EXECUTION_SCHEMA,
    status,
    reason: status.endsWith('failed') || status.endsWith('blocked') ? blockedReason : null,
    extensionExecutionSchema: execution.schema ?? null,
    extensionSurfaceSchema,
    extensionStatus: execution.status ?? null,
    extensionOk,
    extensionBackend: execution.backend ?? null,
    extensionAdapterId: execution.adapterId ?? null,
    extensionOwnsDevice: execution.ownsDevice ?? null,
    extensionOwnerDeviceId: execution.ownerDeviceId ?? result?.ownerDeviceId ?? null,
    extensionResourceOwnershipStatus,
    extensionVertexFormat,
    extensionVertexStrideFloats,
    extensionVertexStrideBytes,
    extensionVertexCount,
    extensionTriangleCount,
    extensionBufferRetained,
    extensionBufferByteLength: Math.max(0, Math.round(finiteNumber(result?.bufferByteLength, 0))),
    extensionReadback: execution.readback ?? null,
    extensionSurfaceVertexReadback: execution.surfaceVertexReadback ?? null,
    readyForUlgSurfaceVertexRows,
    requiresUlgVertexRowTranslation,
    requiresUlgDrawMetadata: true,
    surfaceVertexSchema: ULG_SPH_GPU_RENDER_SURFACE_VERTICES_SCHEMA,
    surfaceVertexFormat: ULG_MARCHING_CUBES_REQUIRED_SURFACE_VERTEX_FORMAT,
    surfaceVertexRowLayout: [...SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT],
    surfaceVertexRowStrideFloats: SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT.length,
    surfaceDrawSchema: ULG_SPH_GPU_RENDER_SURFACE_DRAW_SCHEMA,
    surfaceDrawRowLayout: [...SPH_GPU_RENDER_SURFACE_DRAW_ROW_LAYOUT],
    surfaceDrawRowStrideFloats: SPH_GPU_RENDER_SURFACE_DRAW_ROW_LAYOUT.length,
    surfaceDrawIndirectSchema: ULG_SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_SCHEMA,
    surfaceDrawIndirectRowLayout: [...SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_ROW_LAYOUT],
    surfaceDrawIndirectRowStrideUints: SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_ROW_LAYOUT.length,
    hotLoopSafe: Boolean(readyCompactPositionBuffer && execution.readback === false && execution.surfaceVertexReadback === false),
    rendererIntegration: 'pending-ulg-row-translation-and-engine-bridge'
  };
}

export function createUlgWebGpuMarchingCubesExtensionAdapter({
  device,
  volume = null,
  adapterFactory,
  adapter = null,
  adapterId = 'webgpu-marching-cubes',
  backend = 'webgpu-marching-cubes-extension'
} = {}) {
  if (!isObject(device)) {
    throw new TypeError('createUlgWebGpuMarchingCubesExtensionAdapter requires a caller-owned GPUDevice');
  }
  if (!adapter && typeof adapterFactory !== 'function') {
    throw new TypeError('createUlgWebGpuMarchingCubesExtensionAdapter requires an adapter or adapterFactory');
  }
  let extensionAdapter = adapter;
  const wrapper = {
    schema: ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_ADAPTER_SCHEMA,
    adapterId,
    backend,
    device,
    ownsDevice: false,
    volume,
    get adapter() {
      return extensionAdapter;
    },
    async extractSurface(input = {}) {
      if (!extensionAdapter) {
        extensionAdapter = await adapterFactory({
          device,
          volume,
          adapterId
        });
      }
      const extensionExecution = await extensionAdapter.extractSurface({
        ...input,
        volume: input.volume || volume
      });
      const summary = summarizeWebGpuMarchingCubesExtensionExecution(extensionExecution);
      return {
        schema: ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_EXECUTION_SCHEMA,
        status: summary.status,
        backend,
        adapterSchema: wrapper.schema,
        extensionAdapterSchema: extensionAdapter?.schema ?? null,
        adapterId,
        ownsDevice: false,
        summary,
        extensionExecution,
        surfaceVertexSchema: summary.surfaceVertexSchema,
        surfaceDrawSchema: summary.surfaceDrawSchema,
        surfaceDrawIndirectSchema: summary.surfaceDrawIndirectSchema,
        readyForUlgSurfaceVertexRows: summary.readyForUlgSurfaceVertexRows,
        requiresUlgVertexRowTranslation: summary.requiresUlgVertexRowTranslation,
        requiresUlgDrawMetadata: summary.requiresUlgDrawMetadata,
        hotLoopSafe: summary.hotLoopSafe,
        rendererIntegration: summary.rendererIntegration
      };
    }
  };
  return wrapper;
}
