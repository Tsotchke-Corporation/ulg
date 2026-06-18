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
export const ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_TRANSLATION_SCHEMA =
  'peercompute.ulg.sph-webgpu-marching-cubes-extension-translation.v0';

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

function vector3(value, fallback = [0, 1, 0]) {
  const source = Array.isArray(value) || ArrayBuffer.isView(value) ? value : fallback;
  return [
    finiteNumber(source[0], fallback[0]),
    finiteNumber(source[1], fallback[1]),
    finiteNumber(source[2], fallback[2])
  ];
}

function normalizeVector3(value, fallback = [0, 1, 0]) {
  const v = vector3(value, fallback);
  const length = Math.hypot(v[0], v[1], v[2]);
  if (!(length > 1e-12)) return [...fallback];
  return [v[0] / length, v[1] / length, v[2] / length];
}

function triangleNormal(a, b, c, fallbackNormal) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  return normalizeVector3([
    ab[1] * ac[2] - ab[2] * ac[1],
    ab[2] * ac[0] - ab[0] * ac[2],
    ab[0] * ac[1] - ab[1] * ac[0]
  ], fallbackNormal);
}

function writeSurfaceDrawRow(drawRows, offset, {
  surfaceIndex,
  materialId,
  phaseId,
  opticalStateId,
  vertexOffset,
  vertexCount,
  triangleOffset,
  triangleCount,
  renderOrder,
  transparencyClassId,
  depthWriteFlag,
  status,
  boundsCenterM,
  boundsRadiusM
}) {
  drawRows.set([
    surfaceIndex,
    materialId,
    phaseId,
    opticalStateId,
    vertexOffset,
    vertexCount,
    triangleOffset,
    triangleCount,
    renderOrder,
    transparencyClassId,
    depthWriteFlag,
    status,
    boundsCenterM[0],
    boundsCenterM[1],
    boundsCenterM[2],
    boundsRadiusM
  ], offset);
}

function writeSurfaceDrawIndirectRow(indirectRows, offset, {
  vertexCount,
  instanceCount,
  firstVertex,
  firstInstance
}) {
  indirectRows.set([
    Math.max(0, Math.round(finiteNumber(vertexCount, 0))),
    Math.max(0, Math.round(finiteNumber(instanceCount, 0))),
    Math.max(0, Math.round(finiteNumber(firstVertex, 0))),
    Math.max(0, Math.round(finiteNumber(firstInstance, 0)))
  ], offset);
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

export function translateWebGpuMarchingCubesSurfaceToUlgRows({
  extensionExecution,
  positionRows = null,
  surfaceIndex = 0,
  materialId = 0,
  phaseId = 0,
  opticalStateId = 0,
  material = null,
  phase = null,
  renderKey = null,
  surfaceKey = null,
  density = 0,
  isolation = null,
  sourceVoxelLinearIndex = 0,
  fallbackNormal = [0, 1, 0],
  transparencyClassId = 0,
  depthWriteFlag = 1,
  renderOrder = null
} = {}) {
  const summary = summarizeWebGpuMarchingCubesExtensionExecution(extensionExecution);
  if (summary.extensionOk !== true) {
    return {
      schema: ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_TRANSLATION_SCHEMA,
      status: 'extension-surface-translation-blocked',
      reason: summary.reason || summary.extensionStatus || 'extension surface execution was not successful',
      summary,
      surfaceVertices: null,
      surfaceDraw: null
    };
  }
  if (summary.extensionVertexCount === 0) {
    return {
      schema: ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_TRANSLATION_SCHEMA,
      status: 'extension-surface-translation-empty',
      reason: null,
      summary,
      surfaceVertices: {
        schema: ULG_SPH_GPU_RENDER_SURFACE_VERTICES_SCHEMA,
        backend: 'cpu-reference',
        status: 'surface-vertices-empty',
        vertexRows: new Float32Array(),
        vertexCount: 0,
        triangleCount: 0,
        surfaces: [],
        rowLayout: [...SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT],
        rowStrideFloats: SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT.length
      },
      surfaceDraw: {
        schema: ULG_SPH_GPU_RENDER_SURFACE_DRAW_SCHEMA,
        backend: 'cpu-reference',
        status: 'surface-draw-metadata-empty',
        drawRows: new Float32Array(),
        drawIndirectSchema: ULG_SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_SCHEMA,
        drawIndirectRows: new Uint32Array(),
        surfaces: []
      }
    };
  }
  const sourceRows = positionRows
    || extensionExecution?.result?.positionRows
    || extensionExecution?.result?.compactPositionRows
    || null;
  if (!(sourceRows instanceof Float32Array)) {
    return {
      schema: ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_TRANSLATION_SCHEMA,
      status: 'extension-surface-translation-needs-position-readback-or-gpu-kernel',
      reason: 'extension output retained a compact position GPUBuffer without CPU position rows',
      summary,
      surfaceVertices: null,
      surfaceDraw: null,
      sourceBufferRetained: summary.extensionBufferRetained,
      hotLoopGpuTranslationRequired: true
    };
  }
  const sourceStride = Math.max(1, Math.round(finiteNumber(summary.extensionVertexStrideFloats, 4)));
  const vertexCount = summary.extensionVertexCount;
  if (sourceRows.length < vertexCount * sourceStride) {
    throw new RangeError('extension compact position rows are shorter than declared vertexCount');
  }
  const resolvedSurfaceIndex = Math.max(0, Math.round(finiteNumber(surfaceIndex, 0)));
  const resolvedMaterialId = finiteNumber(materialId, 0);
  const resolvedPhaseId = finiteNumber(phaseId, 0);
  const resolvedOpticalStateId = finiteNumber(opticalStateId, 0);
  const resolvedDensity = finiteNumber(density, 0);
  const resolvedIsolation = isolation == null
    ? finiteNumber(extensionExecution?.result?.isovalue ?? extensionExecution?.isovalue, 0)
    : finiteNumber(isolation, 0);
  const resolvedFallbackNormal = normalizeVector3(fallbackNormal);
  const triangleCount = Math.floor(vertexCount / 3);
  const alignedVertexCount = triangleCount * 3;
  const vertexRows = new Float32Array(alignedVertexCount * SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT.length);
  const positions = [];
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let index = 0; index < alignedVertexCount; index += 1) {
    const sourceOffset = index * sourceStride;
    const p = [
      finiteNumber(sourceRows[sourceOffset], 0),
      finiteNumber(sourceRows[sourceOffset + 1], 0),
      finiteNumber(sourceRows[sourceOffset + 2], 0)
    ];
    positions.push(p);
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], p[axis]);
      max[axis] = Math.max(max[axis], p[axis]);
    }
  }
  for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex += 1) {
    const vertexBase = triangleIndex * 3;
    const normal = triangleNormal(
      positions[vertexBase],
      positions[vertexBase + 1],
      positions[vertexBase + 2],
      resolvedFallbackNormal
    );
    for (let localVertex = 0; localVertex < 3; localVertex += 1) {
      const vertexIndex = vertexBase + localVertex;
      const p = positions[vertexIndex];
      const rowOffset = vertexIndex * SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT.length;
      vertexRows.set([
        resolvedSurfaceIndex,
        resolvedMaterialId,
        resolvedPhaseId,
        triangleIndex,
        vertexIndex,
        p[0],
        p[1],
        p[2],
        normal[0],
        normal[1],
        normal[2],
        resolvedOpticalStateId,
        resolvedDensity,
        resolvedIsolation,
        finiteNumber(sourceVoxelLinearIndex, 0) + triangleIndex,
        1
      ], rowOffset);
    }
  }
  const boundsCenterM = alignedVertexCount > 0
    ? [(min[0] + max[0]) * 0.5, (min[1] + max[1]) * 0.5, (min[2] + max[2]) * 0.5]
    : [0, 0, 0];
  const boundsRadiusM = alignedVertexCount > 0
    ? Math.hypot(max[0] - boundsCenterM[0], max[1] - boundsCenterM[1], max[2] - boundsCenterM[2])
    : 0;
  const surface = {
    surfaceKey: surfaceKey || `extension-surface-${resolvedSurfaceIndex}`,
    material,
    phase,
    renderKey,
    surfaceIndex: resolvedSurfaceIndex,
    materialId: resolvedMaterialId,
    phaseId: resolvedPhaseId,
    opticalStateId: resolvedOpticalStateId,
    vertexOffset: 0,
    vertexCount: alignedVertexCount,
    triangleOffset: 0,
    triangleCount,
    renderOrder: renderOrder == null ? resolvedSurfaceIndex : finiteNumber(renderOrder, resolvedSurfaceIndex),
    transparencyClassId: finiteNumber(transparencyClassId, 0),
    depthWriteFlag: finiteNumber(depthWriteFlag, 1),
    boundsCenterM,
    boundsRadiusM,
    status: alignedVertexCount > 0 ? 'surface-draw-ready' : 'surface-draw-empty'
  };
  const drawRows = new Float32Array(SPH_GPU_RENDER_SURFACE_DRAW_ROW_LAYOUT.length);
  const drawIndirectRows = new Uint32Array(SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_ROW_LAYOUT.length);
  writeSurfaceDrawRow(drawRows, 0, {
    ...surface,
    status: alignedVertexCount > 0 ? 1 : 0
  });
  writeSurfaceDrawIndirectRow(drawIndirectRows, 0, {
    vertexCount: alignedVertexCount,
    instanceCount: alignedVertexCount > 0 ? 1 : 0,
    firstVertex: 0,
    firstInstance: resolvedSurfaceIndex
  });
  const surfaceVertices = {
    schema: ULG_SPH_GPU_RENDER_SURFACE_VERTICES_SCHEMA,
    backend: 'cpu-reference',
    status: alignedVertexCount > 0 ? 'surface-vertices-ready' : 'surface-vertices-empty',
    sourceSurfaceExecutionSchema: summary.extensionExecutionSchema,
    sourceSurfaceSchema: summary.extensionSurfaceSchema,
    surfaceExtractionMethod: 'webgpu-marching-cubes-extension-compact-position-translation',
    compactionMode: 'extension-compact-position-to-ulg-rows',
    rowLayout: [...SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT],
    rowStrideFloats: SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT.length,
    vertexRows,
    vertexCount: alignedVertexCount,
    triangleCount,
    surfaces: [surface],
    surfaceVertexReadback: true,
    scientificValidation: false,
    sphValidation: false,
    surfaceExtractionValidation: false,
    fullPhysicsValidation: false
  };
  const surfaceDraw = {
    schema: ULG_SPH_GPU_RENDER_SURFACE_DRAW_SCHEMA,
    backend: 'cpu-reference',
    status: alignedVertexCount > 0 ? 'surface-draw-metadata-ready' : 'surface-draw-metadata-empty',
    sourceSurfaceVertexSchema: surfaceVertices.schema,
    sourceSurfaceVertexBackend: surfaceVertices.backend,
    surfaceCount: 1,
    activeSurfaceCount: alignedVertexCount > 0 ? 1 : 0,
    vertexCount: alignedVertexCount,
    triangleCount,
    rowLayout: [...SPH_GPU_RENDER_SURFACE_DRAW_ROW_LAYOUT],
    rowStrideFloats: SPH_GPU_RENDER_SURFACE_DRAW_ROW_LAYOUT.length,
    drawRows,
    drawRowsByteLength: drawRows.byteLength,
    drawIndirectSchema: ULG_SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_SCHEMA,
    drawIndirectRowLayout: [...SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_ROW_LAYOUT],
    drawIndirectRowStrideUints: SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_ROW_LAYOUT.length,
    drawIndirectRows,
    drawIndirectRowsByteLength: drawIndirectRows.byteLength,
    compactionMode: 'extension-compact-position-to-ulg-draw-metadata',
    surfaces: [surface],
    scientificValidation: false,
    sphValidation: false,
    surfaceExtractionValidation: false,
    fullPhysicsValidation: false
  };
  return {
    schema: ULG_SPH_WEBGPU_MARCHING_CUBES_EXTENSION_TRANSLATION_SCHEMA,
    status: alignedVertexCount > 0
      ? 'extension-surface-translated-to-ulg-rows'
      : 'extension-surface-translation-empty',
    reason: vertexCount !== alignedVertexCount
      ? 'extension vertexCount was not divisible by 3; trailing vertices were ignored'
      : null,
    summary,
    sourceVertexCount: vertexCount,
    translatedVertexCount: alignedVertexCount,
    ignoredTrailingVertexCount: vertexCount - alignedVertexCount,
    surfaceVertices,
    surfaceDraw,
    hotLoopGpuTranslationRequired: false
  };
}
