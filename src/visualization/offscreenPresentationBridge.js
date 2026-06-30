export const ULG_WORKER_OFFSCREEN_PRESENTATION_SCHEMA =
  'peercompute.ulg.worker-offscreen-presentation.v0';
export const ULG_WORKER_OFFSCREEN_PRESENTATION_TRANSPORT =
  'worker-owned-presented-canvas';
export const ULG_WORKER_OFFSCREEN_PRESENTATION_HANDOFF =
  'transferControlToOffscreen';
export const ULG_WORKER_OFFSCREEN_REJECTED_TRANSPORT = 'frame-copy-back';
export const ULG_WORKER_OFFSCREEN_RENDER_ROWS_SCHEMA =
  'peercompute.ulg.worker-offscreen-render-rows.v0';
export const ULG_WORKER_OFFSCREEN_RENDER_ROWS_INPUT_TRANSPORT =
  'main-thread-compact-render-row-transfer';
export const ULG_WORKER_OFFSCREEN_RENDER_ROW_PARTICLE_STRIDE_FLOATS = 8;
export const ULG_WORKER_OFFSCREEN_RETAINED_GPU_BUFFER_HANDOFF_SCHEMA =
  'peercompute.ulg.worker-offscreen-retained-gpubuffer-handoff.v0';
export const ULG_WORKER_OFFSCREEN_RETAINED_GPU_BUFFER_TRANSPORT =
  'cross-worker-gpubuffer-structured-clone';
export const ULG_WORKER_OFFSCREEN_WORKER_LOCAL_PRODUCER_TRANSPORT =
  'worker-owned-resident-render-producer';
export const ULG_WORKER_OFFSCREEN_RESIDENT_RENDER_PRODUCER_SCHEMA =
  'peercompute.ulg.worker-offscreen-resident-render-producer.v0';
export const ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_STATE_PRODUCER_SCHEMA =
  'peercompute.ulg.worker-offscreen-resident-particle-state-producer.v0';
export const ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_STATE_TRANSPORT =
  'worker-resident-particle-state-transfer';
export const ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_STATE_CACHE_TRANSPORT =
  'worker-resident-particle-state-cache';
export const ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_STATE_COLOR_ROW_FLOATS = 8;
export const ULG_WORKER_OFFSCREEN_PRESENTATION_RESIDENT_STAGE_SCHEMA =
  'peercompute.ulg.presentation-worker-resident-stage.v0';
export const ULG_WORKER_OFFSCREEN_PRESENTATION_RESIDENT_STAGE_TRANSPORT =
  'offscreen-presentation-worker-device';
export const ULG_WORKER_OFFSCREEN_RETAINED_COMPACT_SNAPSHOT_SCHEMA =
  'peercompute.ulg.presentation-worker-retained-compact-snapshot-export.v0';
export const ULG_REMOTE_TASK_GRAPH_COMPACT_BUFFER_SNAPSHOT_SCHEMA =
  'peercompute.ulg.remote-task-graph-compact-buffer-snapshot.v0';

function nowMs() {
  return typeof globalThis.performance?.now === 'function'
    ? globalThis.performance.now()
    : Date.now();
}

function positiveNumber(value, fallback = 1) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function arrayLikeLength(value) {
  return value && Number.isFinite(Number(value.length))
    ? Math.max(0, Math.floor(Number(value.length)))
    : 0;
}

function readArrayLikeNumber(value, index, fallback = 0) {
  if (!value || index < 0 || index >= arrayLikeLength(value)) return fallback;
  return finiteNumber(value[index], fallback);
}

function normalizeViewProjectionMatrix(value) {
  if (value instanceof Float32Array && value.length >= 16) {
    return value.length === 16 ? new Float32Array(value) : new Float32Array(value.slice(0, 16));
  }
  const matrix = new Float32Array(16);
  if (value && arrayLikeLength(value) >= 16) {
    for (let index = 0; index < 16; index += 1) {
      matrix[index] = finiteNumber(value[index], index % 5 === 0 ? 1 : 0);
    }
    return matrix;
  }
  matrix[0] = 1;
  matrix[5] = 1;
  matrix[10] = 1;
  matrix[15] = 1;
  return matrix;
}

function residentRenderProducerPackedSourceCacheKey({
  sourceCacheKey = null,
  alpha = 0.92,
  fallbackColorRgb = [1, 1, 1],
  fallbackRadiusM = 0.02
} = {}) {
  const sourceArrayCacheKey = sourceCacheKey == null
    ? null
    : String(sourceCacheKey);
  return sourceArrayCacheKey
    ? [
        sourceArrayCacheKey,
        `alpha:${finiteNumber(alpha, 0.92)}`,
        `fallbackColor:${finiteNumber(fallbackColorRgb?.[0], 1)},${finiteNumber(fallbackColorRgb?.[1], 1)},${finiteNumber(fallbackColorRgb?.[2], 1)}`,
        `fallbackRadius:${finiteNumber(fallbackRadiusM, 0.02)}`
      ].join('|')
    : null;
}

function residentRenderProducerExpectedPayloadShape(positionsM = null) {
  const particleCount = Math.floor(arrayLikeLength(positionsM) / 3);
  const strideFloats = ULG_WORKER_OFFSCREEN_RENDER_ROW_PARTICLE_STRIDE_FLOATS;
  return {
    particleCount,
    strideFloats,
    byteLength: particleCount * strideFloats * 4
  };
}

function normalizeResidentParticleStateProducerColorRows(value = null) {
  if (value instanceof Float32Array) {
    const alignedLength = value.length - (value.length % ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_STATE_COLOR_ROW_FLOATS);
    return value.length === alignedLength ? new Float32Array(value) : new Float32Array(value.slice(0, alignedLength));
  }
  const length = arrayLikeLength(value);
  const alignedLength = length - (length % ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_STATE_COLOR_ROW_FLOATS);
  const rows = new Float32Array(alignedLength);
  for (let index = 0; index < alignedLength; index += 1) {
    rows[index] = finiteNumber(value?.[index], 0);
  }
  return rows;
}

function residentParticleStateProducerExpectedPayloadShape({
  sphParticleState = null,
  materialColorRows = null
} = {}) {
  const particleCount = Math.max(0, Math.floor(Number(sphParticleState?.particleCount) || 0));
  const stateStrideFloats = Math.max(1, Math.floor(Number(sphParticleState?.stateStrideFloats) || 8));
  const thermoStrideFloats = Math.max(1, Math.floor(Number(sphParticleState?.thermoStrideFloats) || 12));
  const stateByteLength = particleCount * stateStrideFloats * Float32Array.BYTES_PER_ELEMENT;
  const thermoByteLength = particleCount * thermoStrideFloats * Float32Array.BYTES_PER_ELEMENT;
  const colorRows = normalizeResidentParticleStateProducerColorRows(materialColorRows);
  return {
    particleCount,
    stateStrideFloats,
    thermoStrideFloats,
    stateByteLength,
    thermoByteLength,
    colorRows,
    colorRowCount: Math.floor(colorRows.length / ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_STATE_COLOR_ROW_FLOATS),
    colorRowsByteLength: colorRows.byteLength
  };
}

function residentParticleStateProducerCacheMissReason(bridge, {
  normalizedSourceCacheKey = null,
  expected = null
} = {}) {
  if (!normalizedSourceCacheKey) return 'source-cache-key-missing';
  if (!bridge.residentParticleStateProducerCacheKey) return 'source-cache-empty';
  if (bridge.residentParticleStateProducerCacheKey !== normalizedSourceCacheKey) {
    return 'source-cache-key-changed';
  }
  if (bridge.residentParticleStateProducerParticleCount !== expected?.particleCount) {
    return 'particle-count-changed';
  }
  if (bridge.residentParticleStateProducerStateStrideFloats !== expected?.stateStrideFloats) {
    return 'state-stride-changed';
  }
  if (bridge.residentParticleStateProducerThermoStrideFloats !== expected?.thermoStrideFloats) {
    return 'thermo-stride-changed';
  }
  if (bridge.residentParticleStateProducerStateByteLength !== expected?.stateByteLength) {
    return 'state-byte-length-changed';
  }
  if (bridge.residentParticleStateProducerThermoByteLength !== expected?.thermoByteLength) {
    return 'thermo-byte-length-changed';
  }
  if (bridge.residentParticleStateProducerColorRowsByteLength !== expected?.colorRowsByteLength) {
    return 'color-row-byte-length-changed';
  }
  return 'source-cache-unavailable';
}

export function packUlgWorkerOffscreenRenderRowsPayload({
  positionsM = null,
  colorsRgb = null,
  particleRadiiM = null,
  alpha = 0.92,
  fallbackColorRgb = [1, 1, 1],
  fallbackRadiusM = 0.02,
  maxParticles = null
} = {}) {
  const positionCount = Math.floor(arrayLikeLength(positionsM) / 3);
  const requestedMaxParticles = maxParticles != null && Number.isFinite(Number(maxParticles))
    ? Math.max(0, Math.floor(Number(maxParticles)))
    : positionCount;
  const particleCount = Math.min(positionCount, requestedMaxParticles);
  const particleRows = new Float32Array(
    particleCount * ULG_WORKER_OFFSCREEN_RENDER_ROW_PARTICLE_STRIDE_FLOATS
  );
  const hasColors = arrayLikeLength(colorsRgb) >= particleCount * 3;
  const hasRadii = arrayLikeLength(particleRadiiM) >= particleCount;
  for (let particleIndex = 0; particleIndex < particleCount; particleIndex += 1) {
    const sourceOffset = particleIndex * 3;
    const targetOffset = particleIndex * ULG_WORKER_OFFSCREEN_RENDER_ROW_PARTICLE_STRIDE_FLOATS;
    particleRows[targetOffset + 0] = readArrayLikeNumber(positionsM, sourceOffset + 0);
    particleRows[targetOffset + 1] = readArrayLikeNumber(positionsM, sourceOffset + 1);
    particleRows[targetOffset + 2] = readArrayLikeNumber(positionsM, sourceOffset + 2);
    particleRows[targetOffset + 3] = Math.max(
      0,
      hasRadii
        ? readArrayLikeNumber(particleRadiiM, particleIndex, fallbackRadiusM)
        : finiteNumber(fallbackRadiusM, 0.02)
    );
    particleRows[targetOffset + 4] = Math.max(0, Math.min(1, hasColors
      ? readArrayLikeNumber(colorsRgb, sourceOffset + 0, fallbackColorRgb[0] ?? 1)
      : finiteNumber(fallbackColorRgb[0], 1)));
    particleRows[targetOffset + 5] = Math.max(0, Math.min(1, hasColors
      ? readArrayLikeNumber(colorsRgb, sourceOffset + 1, fallbackColorRgb[1] ?? 1)
      : finiteNumber(fallbackColorRgb[1], 1)));
    particleRows[targetOffset + 6] = Math.max(0, Math.min(1, hasColors
      ? readArrayLikeNumber(colorsRgb, sourceOffset + 2, fallbackColorRgb[2] ?? 1)
      : finiteNumber(fallbackColorRgb[2], 1)));
    particleRows[targetOffset + 7] = Math.max(0, Math.min(1, finiteNumber(alpha, 0.92)));
  }
  return {
    schema: ULG_WORKER_OFFSCREEN_RENDER_ROWS_SCHEMA,
    status: particleCount > 0
      ? 'worker-offscreen-render-rows-packed'
      : 'worker-offscreen-render-rows-empty',
    inputTransport: ULG_WORKER_OFFSCREEN_RENDER_ROWS_INPUT_TRANSPORT,
    particleRows,
    particleCount,
    strideFloats: ULG_WORKER_OFFSCREEN_RENDER_ROW_PARTICLE_STRIDE_FLOATS,
    byteLength: particleRows.byteLength,
    positionsByteLength: arrayLikeLength(positionsM) * Float32Array.BYTES_PER_ELEMENT,
    colorsByteLength: arrayLikeLength(colorsRgb) * Float32Array.BYTES_PER_ELEMENT,
    radiiByteLength: arrayLikeLength(particleRadiiM) * Float32Array.BYTES_PER_ELEMENT
  };
}

export function resolveUlgWorkerOffscreenRetainedGpuBufferHandoffCapability({
  requested = false,
  presentationStatus = null,
  retainedRenderRowsBufferAvailable = false,
  retainedRenderRowsBufferByteLength = 0,
  retainedSurfaceDrawBufferAvailable = false,
  retainedSurfaceDrawBufferByteLength = 0,
  crossOriginIsolated = globalThis.crossOriginIsolated,
  gpuBufferStructuredCloneSupported = false,
  gpuBufferStructuredCloneProbeStatus = null,
  gpuBufferStructuredCloneProbeReason = null,
  workerPresentationDeviceOwner = 'worker-owned-presentation-device',
  residentBufferDeviceOwner = 'main-thread-resident-device',
  reason = 'resident-render-refresh'
} = {}) {
  const requestedHandoff = Boolean(requested);
  const presentationReady = Boolean(
    presentationStatus?.canvasTransferred
    && presentationStatus?.workerReady
    && presentationStatus?.status !== 'worker-offscreen-presentation-disposed'
  );
  const retainedBufferAvailable = Boolean(
    retainedRenderRowsBufferAvailable || retainedSurfaceDrawBufferAvailable
  );
  const structuredCloneSupported = Boolean(gpuBufferStructuredCloneSupported);
  const sameDeviceOwner = workerPresentationDeviceOwner === residentBufferDeviceOwner
    || residentBufferDeviceOwner === 'same-worker-presentation-device';
  let status = 'worker-offscreen-retained-gpubuffer-handoff-not-requested';
  let blockerReason = null;
  if (requestedHandoff && !presentationReady) {
    status = 'worker-offscreen-retained-gpubuffer-handoff-blocked-presentation-unavailable';
    blockerReason = 'worker-owned presentation must be transferred and ready before retained GPUBuffer handoff can be considered';
  } else if (requestedHandoff && !retainedBufferAvailable) {
    status = 'worker-offscreen-retained-gpubuffer-handoff-blocked-no-retained-buffer';
    blockerReason = 'resident render refresh did not expose a retained GPUBuffer input for the worker canvas';
  } else if (requestedHandoff && !structuredCloneSupported) {
    status = 'worker-offscreen-retained-gpubuffer-handoff-blocked-structured-clone-unavailable';
    blockerReason = gpuBufferStructuredCloneProbeReason
      || (crossOriginIsolated
        ? 'GPUBuffer structured-clone handoff to the presentation worker has not been validated'
        : 'GPUBuffer structured-clone handoff requires browser support not available on this page; current page is not cross-origin isolated');
  } else if (requestedHandoff && !sameDeviceOwner) {
    status = 'worker-offscreen-retained-gpubuffer-handoff-blocked-device-owner-split';
    blockerReason = 'main-thread resident GPUBuffer cannot be bound by the worker-owned presentation GPUDevice';
  } else if (requestedHandoff) {
    status = 'worker-offscreen-retained-gpubuffer-handoff-ready';
  }
  return {
    schema: ULG_WORKER_OFFSCREEN_RETAINED_GPU_BUFFER_HANDOFF_SCHEMA,
    status,
    reason: blockerReason || reason,
    requested: requestedHandoff,
    inputTransport: requestedHandoff ? ULG_WORKER_OFFSCREEN_RETAINED_GPU_BUFFER_TRANSPORT : null,
    preferredReplacementTransport: requestedHandoff
      ? ULG_WORKER_OFFSCREEN_WORKER_LOCAL_PRODUCER_TRANSPORT
      : null,
    displayTransport: requestedHandoff ? ULG_WORKER_OFFSCREEN_PRESENTATION_TRANSPORT : null,
    displayHandoff: requestedHandoff ? ULG_WORKER_OFFSCREEN_PRESENTATION_HANDOFF : null,
    rejectedTransport: ULG_WORKER_OFFSCREEN_REJECTED_TRANSPORT,
    frameCopyBackRejected: true,
    copiedBytesPerFrame: 0,
    copiedBytesPerSecond: 0,
    retainedRenderRowsBufferAvailable: Boolean(retainedRenderRowsBufferAvailable),
    retainedRenderRowsBufferByteLength: Math.max(
      0,
      Math.floor(Number(retainedRenderRowsBufferByteLength) || 0)
    ),
    retainedSurfaceDrawBufferAvailable: Boolean(retainedSurfaceDrawBufferAvailable),
    retainedSurfaceDrawBufferByteLength: Math.max(
      0,
      Math.floor(Number(retainedSurfaceDrawBufferByteLength) || 0)
    ),
    presentationReady,
    canvasTransferred: Boolean(presentationStatus?.canvasTransferred),
    workerReady: Boolean(presentationStatus?.workerReady),
    crossOriginIsolated: Boolean(crossOriginIsolated),
    gpuBufferStructuredCloneSupported: structuredCloneSupported,
    gpuBufferStructuredCloneProbeStatus,
    gpuBufferStructuredCloneProbeReason,
    workerPresentationDeviceOwner,
    residentBufferDeviceOwner,
    sameDeviceOwner,
    planChangeRequired: requestedHandoff && status !== 'worker-offscreen-retained-gpubuffer-handoff-ready',
    updatedAtMs: nowMs(),
    scientificValidation: false,
    sphValidation: false,
    fullPhysicsValidation: false
  };
}

function resolveWorkerConstructor(workerFactory = null, windowRef = globalThis) {
  return workerFactory || windowRef?.Worker || globalThis.Worker || null;
}

function createWorkerFromFactory(workerFactory, url, options) {
  try {
    return new workerFactory(url, options);
  } catch (error) {
    if (error instanceof TypeError) return workerFactory(url, options);
    throw error;
  }
}

export function resolveUlgWorkerOffscreenPresentationSize({
  container = null,
  width = null,
  height = null,
  devicePixelRatio = globalThis.devicePixelRatio
} = {}) {
  const rect = typeof container?.getBoundingClientRect === 'function'
    ? container.getBoundingClientRect()
    : null;
  const cssWidth = positiveNumber(
    width ?? rect?.width ?? container?.clientWidth ?? globalThis.innerWidth,
    1
  );
  const cssHeight = positiveNumber(
    height ?? rect?.height ?? container?.clientHeight ?? globalThis.innerHeight,
    1
  );
  const pixelRatio = Math.max(1, Math.min(2, positiveNumber(devicePixelRatio, 1)));
  return {
    cssWidth,
    cssHeight,
    pixelRatio,
    backingWidth: Math.max(1, Math.floor(cssWidth * pixelRatio)),
    backingHeight: Math.max(1, Math.floor(cssHeight * pixelRatio))
  };
}

export function resolveUlgWorkerOffscreenPresentationCapability({
  requested = false,
  canvas = null,
  workerFactory = null,
  workerAvailable = null,
  windowRef = globalThis,
  navigatorRef = globalThis.navigator
} = {}) {
  const requestedPresentation = Boolean(requested);
  const resolvedWorkerAvailable = workerAvailable ?? Boolean(resolveWorkerConstructor(workerFactory, windowRef));
  const transferAvailable = typeof canvas?.transferControlToOffscreen === 'function';
  const mainThreadWebGpuAvailable = Boolean(navigatorRef?.gpu || globalThis.navigator?.gpu);
  let status = 'worker-offscreen-presentation-not-requested';
  let reason = null;
  if (requestedPresentation && !resolvedWorkerAvailable) {
    status = 'worker-offscreen-presentation-blocked-worker-unavailable';
    reason = 'worker-owned presentation requires a module Worker';
  } else if (requestedPresentation && !canvas) {
    status = 'worker-offscreen-presentation-blocked-canvas-unavailable';
    reason = 'worker-owned presentation requires a display canvas element';
  } else if (requestedPresentation && !transferAvailable) {
    status = 'worker-offscreen-presentation-blocked-transfer-unavailable';
    reason = 'worker-owned presentation requires HTMLCanvasElement.transferControlToOffscreen';
  } else if (requestedPresentation) {
    status = 'worker-offscreen-presentation-transfer-ready';
  }
  return {
    schema: ULG_WORKER_OFFSCREEN_PRESENTATION_SCHEMA,
    status,
    reason,
    requested: requestedPresentation,
    transport: requestedPresentation ? ULG_WORKER_OFFSCREEN_PRESENTATION_TRANSPORT : null,
    displayHandoff: requestedPresentation ? ULG_WORKER_OFFSCREEN_PRESENTATION_HANDOFF : null,
    rejectedTransport: ULG_WORKER_OFFSCREEN_REJECTED_TRANSPORT,
    frameCopyBackRejected: true,
    copiedBytesPerFrame: 0,
    copiedBytesPerSecond: 0,
    workerAvailable: Boolean(resolvedWorkerAvailable),
    transferControlToOffscreenAvailable: transferAvailable,
    mainThreadWebGpuAvailable,
    canvasTransferred: false,
    workerReady: false,
    updatedAtMs: nowMs(),
    scientificValidation: false,
    sphValidation: false,
    fullPhysicsValidation: false
  };
}

function setDisplayCanvasStyle(canvas) {
  if (!canvas?.style) return;
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '3';
  canvas.style.background = 'transparent';
}

function applyInitialCanvasBackingSize(canvas, size) {
  if (!canvas) return;
  canvas.width = size.backingWidth;
  canvas.height = size.backingHeight;
}

export function createUlgWorkerOffscreenPresentationBridge({
  requested = false,
  retainedGpuBufferHandoffRequested = requested,
  container = null,
  width = null,
  height = null,
  devicePixelRatio = globalThis.devicePixelRatio,
  backgroundColor = '#000000',
  clearAlpha = 0,
  workerFactory = null,
  windowRef = globalThis,
  navigatorRef = globalThis.navigator,
  onStatus = null,
  onRenderRowsStatus = null,
  onRetainedGpuBufferHandoffStatus = null,
  onResidentStageStatus = null,
  onRetainedCompactSnapshotStatus = null
} = {}) {
  const documentRef = container?.ownerDocument || windowRef?.document || globalThis.document || null;
  let currentBackgroundColor = backgroundColor;
  const requestedRetainedGpuBufferHandoff = Boolean(retainedGpuBufferHandoffRequested);
  const canvas = requested && typeof documentRef?.createElement === 'function'
    ? documentRef.createElement('canvas')
    : null;
  const size = resolveUlgWorkerOffscreenPresentationSize({
    container,
    width,
    height,
    devicePixelRatio
  });
  const publish = (nextStatus) => {
    const status = {
      schema: ULG_WORKER_OFFSCREEN_PRESENTATION_SCHEMA,
      transport: requested ? ULG_WORKER_OFFSCREEN_PRESENTATION_TRANSPORT : null,
      displayHandoff: requested ? ULG_WORKER_OFFSCREEN_PRESENTATION_HANDOFF : null,
      rejectedTransport: ULG_WORKER_OFFSCREEN_REJECTED_TRANSPORT,
      frameCopyBackRejected: true,
      copiedBytesPerFrame: 0,
      copiedBytesPerSecond: 0,
      cssWidth: size.cssWidth,
      cssHeight: size.cssHeight,
      pixelRatio: size.pixelRatio,
      backingWidth: size.backingWidth,
      backingHeight: size.backingHeight,
      updatedAtMs: nowMs(),
      scientificValidation: false,
      sphValidation: false,
      fullPhysicsValidation: false,
      ...nextStatus
    };
    bridge.status = status;
    onStatus?.(status);
    return status;
  };
  const bridge = {
    schema: ULG_WORKER_OFFSCREEN_PRESENTATION_SCHEMA,
    canvas,
    worker: null,
    status: null,
    renderRowsStatus: null,
    retainedGpuBufferHandoffStatus: null,
    residentStageStatus: null,
    retainedCompactSnapshotStatus: null,
    residentRenderProducerSourceCacheKey: null,
    residentRenderProducerSourceParticleCount: 0,
    residentRenderProducerSourceStrideFloats: 0,
    residentRenderProducerSourceByteLength: 0,
    residentParticleStateProducerCacheKey: null,
    residentParticleStateProducerParticleCount: 0,
    residentParticleStateProducerStateStrideFloats: 0,
    residentParticleStateProducerThermoStrideFloats: 0,
    residentParticleStateProducerStateByteLength: 0,
    residentParticleStateProducerThermoByteLength: 0,
    residentParticleStateProducerColorRowsByteLength: 0,
    clearResidentRenderProducerSourceCache() {
      this.residentRenderProducerSourceCacheKey = null;
      this.residentRenderProducerSourceParticleCount = 0;
      this.residentRenderProducerSourceStrideFloats = 0;
      this.residentRenderProducerSourceByteLength = 0;
    },
    clearResidentParticleStateProducerCache() {
      this.residentParticleStateProducerCacheKey = null;
      this.residentParticleStateProducerParticleCount = 0;
      this.residentParticleStateProducerStateStrideFloats = 0;
      this.residentParticleStateProducerThermoStrideFloats = 0;
      this.residentParticleStateProducerStateByteLength = 0;
      this.residentParticleStateProducerThermoByteLength = 0;
      this.residentParticleStateProducerColorRowsByteLength = 0;
    },
    publishRenderRowsStatus(nextStatus = {}) {
      if (
        nextStatus?.schema === ULG_WORKER_OFFSCREEN_RESIDENT_RENDER_PRODUCER_SCHEMA
        && nextStatus?.sourceCacheStatus === 'source-cache-miss'
      ) {
        this.clearResidentRenderProducerSourceCache();
      }
      if (
        nextStatus?.schema === ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_STATE_PRODUCER_SCHEMA
        && nextStatus?.sourceCacheStatus === 'resident-particle-state-cache-miss'
      ) {
        this.clearResidentParticleStateProducerCache();
      }
      const status = {
        schema: ULG_WORKER_OFFSCREEN_RENDER_ROWS_SCHEMA,
        status: 'worker-offscreen-render-rows-status',
        inputTransport: requested ? ULG_WORKER_OFFSCREEN_RENDER_ROWS_INPUT_TRANSPORT : null,
        displayTransport: requested ? ULG_WORKER_OFFSCREEN_PRESENTATION_TRANSPORT : null,
        displayHandoff: requested ? ULG_WORKER_OFFSCREEN_PRESENTATION_HANDOFF : null,
        rejectedTransport: ULG_WORKER_OFFSCREEN_REJECTED_TRANSPORT,
        frameCopyBackRejected: true,
        copiedBytesPerFrame: 0,
        copiedBytesPerSecond: 0,
        particleCount: 0,
        inputTransferBytes: 0,
        strideFloats: ULG_WORKER_OFFSCREEN_RENDER_ROW_PARTICLE_STRIDE_FLOATS,
        canvasTransferred: Boolean(this.status?.canvasTransferred),
        workerReady: Boolean(this.status?.workerReady),
        updatedAtMs: nowMs(),
        scientificValidation: false,
        sphValidation: false,
        fullPhysicsValidation: false,
        ...nextStatus
      };
      this.renderRowsStatus = status;
      onRenderRowsStatus?.(status);
      return status;
    },
    publishRetainedGpuBufferHandoffStatus(nextStatus = {}) {
      const status = {
        schema: ULG_WORKER_OFFSCREEN_RETAINED_GPU_BUFFER_HANDOFF_SCHEMA,
        status: 'worker-offscreen-retained-gpubuffer-handoff-status',
        requested: requestedRetainedGpuBufferHandoff,
        inputTransport: requestedRetainedGpuBufferHandoff
          ? ULG_WORKER_OFFSCREEN_RETAINED_GPU_BUFFER_TRANSPORT
          : null,
        preferredReplacementTransport: requestedRetainedGpuBufferHandoff
          ? ULG_WORKER_OFFSCREEN_WORKER_LOCAL_PRODUCER_TRANSPORT
          : null,
        displayTransport: requested ? ULG_WORKER_OFFSCREEN_PRESENTATION_TRANSPORT : null,
        displayHandoff: requested ? ULG_WORKER_OFFSCREEN_PRESENTATION_HANDOFF : null,
        rejectedTransport: ULG_WORKER_OFFSCREEN_REJECTED_TRANSPORT,
        frameCopyBackRejected: true,
        copiedBytesPerFrame: 0,
        copiedBytesPerSecond: 0,
        canvasTransferred: Boolean(this.status?.canvasTransferred),
        workerReady: Boolean(this.status?.workerReady),
        updatedAtMs: nowMs(),
        scientificValidation: false,
        sphValidation: false,
        fullPhysicsValidation: false,
        ...nextStatus
      };
      this.retainedGpuBufferHandoffStatus = status;
      onRetainedGpuBufferHandoffStatus?.(status);
      return status;
    },
    publishResidentStageStatus(nextStatus = {}) {
      const status = {
        schema: ULG_WORKER_OFFSCREEN_PRESENTATION_RESIDENT_STAGE_SCHEMA,
        status: 'worker-offscreen-resident-stage-on-presentation-device-status',
        inputTransport: requested
          ? ULG_WORKER_OFFSCREEN_PRESENTATION_RESIDENT_STAGE_TRANSPORT
          : null,
        displayTransport: requested ? ULG_WORKER_OFFSCREEN_PRESENTATION_TRANSPORT : null,
        displayHandoff: requested ? ULG_WORKER_OFFSCREEN_PRESENTATION_HANDOFF : null,
        rejectedTransport: ULG_WORKER_OFFSCREEN_REJECTED_TRANSPORT,
        frameCopyBackRejected: true,
        copiedBytesPerFrame: 0,
        copiedBytesPerSecond: 0,
        canvasTransferred: Boolean(this.status?.canvasTransferred),
        workerReady: Boolean(this.status?.workerReady),
        updatedAtMs: nowMs(),
        scientificValidation: false,
        sphValidation: false,
        fullPhysicsValidation: false,
        ...nextStatus
      };
      this.residentStageStatus = status;
      onResidentStageStatus?.(status);
      return status;
    },
    publishRetainedCompactSnapshotStatus(nextStatus = {}) {
      const status = {
        schema: ULG_WORKER_OFFSCREEN_RETAINED_COMPACT_SNAPSHOT_SCHEMA,
        status: 'presentation-worker-retained-compact-snapshot-export-status',
        compactBufferSnapshotSchema: ULG_REMOTE_TASK_GRAPH_COMPACT_BUFFER_SNAPSHOT_SCHEMA,
        displayTransport: requested ? ULG_WORKER_OFFSCREEN_PRESENTATION_TRANSPORT : null,
        displayHandoff: requested ? ULG_WORKER_OFFSCREEN_PRESENTATION_HANDOFF : null,
        rejectedTransport: ULG_WORKER_OFFSCREEN_REJECTED_TRANSPORT,
        frameCopyBackRejected: true,
        copiedBytesPerFrame: 0,
        copiedBytesPerSecond: 0,
        canvasTransferred: Boolean(this.status?.canvasTransferred),
        workerReady: Boolean(this.status?.workerReady),
        portableSnapshotAvailable: false,
        crossPeerReplayReady: false,
        readbackByteLength: 0,
        updatedAtMs: nowMs(),
        scientificValidation: false,
        sphValidation: false,
        fullPhysicsValidation: false,
        ...nextStatus
      };
      this.retainedCompactSnapshotStatus = status;
      onRetainedCompactSnapshotStatus?.(status);
      return status;
    },
    resolveRetainedGpuBufferHandoff(next = {}) {
      return this.publishRetainedGpuBufferHandoffStatus(
        resolveUlgWorkerOffscreenRetainedGpuBufferHandoffCapability({
          requested: requestedRetainedGpuBufferHandoff,
          presentationStatus: this.status,
          crossOriginIsolated: Boolean(windowRef?.crossOriginIsolated ?? globalThis.crossOriginIsolated),
          ...next
        })
      );
    },
    resize(next = {}) {
      const nextSize = resolveUlgWorkerOffscreenPresentationSize({
        container,
        width: next.width ?? width,
        height: next.height ?? height,
        devicePixelRatio: next.devicePixelRatio ?? devicePixelRatio
      });
      Object.assign(size, nextSize);
      if (this.worker) {
        this.worker.postMessage?.({
          type: 'resize',
          width: nextSize.backingWidth,
          height: nextSize.backingHeight,
          cssWidth: nextSize.cssWidth,
          cssHeight: nextSize.cssHeight,
          pixelRatio: nextSize.pixelRatio,
          reason: next.reason || 'resize'
        });
      }
      return publish({
        ...(this.status || {}),
        status: this.status?.status || 'worker-offscreen-presentation-resize-posted',
        reason: next.reason || 'resize',
        cssWidth: nextSize.cssWidth,
        cssHeight: nextSize.cssHeight,
        pixelRatio: nextSize.pixelRatio,
        backingWidth: nextSize.backingWidth,
        backingHeight: nextSize.backingHeight
      });
    },
    setBackgroundColor(color, { reason = 'background-color' } = {}) {
      currentBackgroundColor = color || currentBackgroundColor;
      if (this.worker) {
        this.worker.postMessage?.({
          type: 'clear',
          backgroundColor: currentBackgroundColor,
          clearAlpha,
          reason
        });
      }
      return publish({
        ...(this.status || {}),
        status: this.status?.status || 'worker-offscreen-presentation-clear-posted',
        reason,
        backgroundColor: color
      });
    },
    drawRenderRows({
      positionsM = null,
      colorsRgb = null,
      particleRadiiM = null,
      viewProjectionMatrix = null,
      alpha = 0.92,
      fallbackColorRgb = [1, 1, 1],
      fallbackRadiusM = 0.02,
      radiusScalePx = 96,
      fallbackPointSizePx = 6,
      minPointSizePx = 2,
      maxPointSizePx = 22,
      reason = 'resident-render-rows-refresh'
    } = {}) {
      if (!requested) {
        return this.publishRenderRowsStatus({
          status: 'worker-offscreen-render-rows-not-requested',
          reason
        });
      }
      if (!this.worker) {
        return this.publishRenderRowsStatus({
          status: 'worker-offscreen-render-rows-blocked-worker-unavailable',
          reason,
          canvasTransferred: Boolean(this.status?.canvasTransferred),
          workerReady: false
        });
      }
      const payload = packUlgWorkerOffscreenRenderRowsPayload({
        positionsM,
        colorsRgb,
        particleRadiiM,
        alpha,
        fallbackColorRgb,
        fallbackRadiusM
      });
      if (payload.particleCount <= 0) {
        return this.publishRenderRowsStatus({
          status: 'worker-offscreen-render-rows-skipped-empty',
          reason,
          particleCount: 0,
          inputTransferBytes: 0
        });
      }
      const viewProjection = normalizeViewProjectionMatrix(viewProjectionMatrix);
      const inputTransferBytes = payload.byteLength + viewProjection.byteLength;
      this.worker.postMessage?.({
        type: 'draw-render-rows',
        schema: ULG_WORKER_OFFSCREEN_RENDER_ROWS_SCHEMA,
        inputTransport: ULG_WORKER_OFFSCREEN_RENDER_ROWS_INPUT_TRANSPORT,
        particleRows: payload.particleRows,
        particleCount: payload.particleCount,
        strideFloats: payload.strideFloats,
        viewProjectionMatrix: viewProjection,
        width: size.backingWidth,
        height: size.backingHeight,
        cssWidth: size.cssWidth,
        cssHeight: size.cssHeight,
        pixelRatio: size.pixelRatio,
        radiusScalePx: finiteNumber(radiusScalePx, 96),
        fallbackPointSizePx: finiteNumber(fallbackPointSizePx, 6),
        minPointSizePx: finiteNumber(minPointSizePx, 2),
        maxPointSizePx: finiteNumber(maxPointSizePx, 22),
        backgroundColor: currentBackgroundColor,
        clearAlpha,
        reason
      }, [payload.particleRows.buffer, viewProjection.buffer]);
      return this.publishRenderRowsStatus({
        status: 'worker-offscreen-render-rows-submit-posted',
        reason,
        particleCount: payload.particleCount,
        inputTransferBytes,
        inputTransport: ULG_WORKER_OFFSCREEN_RENDER_ROWS_INPUT_TRANSPORT,
        canvasTransferred: Boolean(this.status?.canvasTransferred),
        workerReady: Boolean(this.status?.workerReady)
      });
    },
    drawResidentRenderProducer({
      positionsM = null,
      colorsRgb = null,
      particleRadiiM = null,
      sourceCacheKey = null,
      viewProjectionMatrix = null,
      alpha = 0.92,
      fallbackColorRgb = [1, 1, 1],
      fallbackRadiusM = 0.02,
      radiusScalePx = 96,
      fallbackPointSizePx = 6,
      minPointSizePx = 2,
      maxPointSizePx = 22,
      reason = 'worker-owned-resident-render-producer-refresh'
    } = {}) {
      if (!requested) {
        return this.publishRenderRowsStatus({
          status: 'worker-offscreen-resident-render-producer-not-requested',
          reason,
          inputTransport: null
        });
      }
      if (!this.worker) {
        return this.publishRenderRowsStatus({
          status: 'worker-offscreen-resident-render-producer-blocked-worker-unavailable',
          reason,
          inputTransport: ULG_WORKER_OFFSCREEN_WORKER_LOCAL_PRODUCER_TRANSPORT,
          canvasTransferred: Boolean(this.status?.canvasTransferred),
          workerReady: false
        });
      }
      const normalizedSourceCacheKey = residentRenderProducerPackedSourceCacheKey({
        sourceCacheKey,
        alpha,
        fallbackColorRgb,
        fallbackRadiusM
      });
      const expectedPayload = residentRenderProducerExpectedPayloadShape(positionsM);
      if (expectedPayload.particleCount <= 0) {
        return this.publishRenderRowsStatus({
          status: 'worker-offscreen-resident-render-producer-skipped-empty',
          reason,
          inputTransport: ULG_WORKER_OFFSCREEN_WORKER_LOCAL_PRODUCER_TRANSPORT,
          particleCount: 0,
          inputTransferBytes: 0
        });
      }
      const viewProjection = normalizeViewProjectionMatrix(viewProjectionMatrix);
      let sourceCacheReusable = Boolean(
        normalizedSourceCacheKey
        && this.residentRenderProducerSourceCacheKey === normalizedSourceCacheKey
        && this.residentRenderProducerSourceParticleCount === expectedPayload.particleCount
        && this.residentRenderProducerSourceStrideFloats === expectedPayload.strideFloats
        && this.residentRenderProducerSourceByteLength === expectedPayload.byteLength
      );
      const payload = sourceCacheReusable
        ? null
        : packUlgWorkerOffscreenRenderRowsPayload({
            positionsM,
            colorsRgb,
            particleRadiiM,
            alpha,
            fallbackColorRgb,
            fallbackRadiusM
          });
      if (payload && payload.particleCount <= 0) {
        return this.publishRenderRowsStatus({
          status: 'worker-offscreen-resident-render-producer-skipped-empty',
          reason,
          inputTransport: ULG_WORKER_OFFSCREEN_WORKER_LOCAL_PRODUCER_TRANSPORT,
          particleCount: 0,
          inputTransferBytes: 0
        });
      }
      const particleCount = payload?.particleCount ?? expectedPayload.particleCount;
      const strideFloats = payload?.strideFloats ?? expectedPayload.strideFloats;
      const sourceByteLength = payload?.byteLength ?? expectedPayload.byteLength;
      sourceCacheReusable = Boolean(
        sourceCacheReusable
        && particleCount === expectedPayload.particleCount
        && strideFloats === expectedPayload.strideFloats
        && sourceByteLength === expectedPayload.byteLength
      );
      const inputTransferBytes = (
        sourceCacheReusable
          ? viewProjection.byteLength
          : sourceByteLength + viewProjection.byteLength
      );
      const message = {
        type: 'draw-resident-render-producer',
        schema: ULG_WORKER_OFFSCREEN_RESIDENT_RENDER_PRODUCER_SCHEMA,
        renderRowsSchema: ULG_WORKER_OFFSCREEN_RENDER_ROWS_SCHEMA,
        inputTransport: ULG_WORKER_OFFSCREEN_WORKER_LOCAL_PRODUCER_TRANSPORT,
        sourceCacheKey: normalizedSourceCacheKey,
        sourceCacheStatus: sourceCacheReusable ? 'source-cache-reused' : 'source-cache-uploaded',
        reuseSourceCache: sourceCacheReusable,
        sourceRowsPacked: !sourceCacheReusable,
        particleCount,
        strideFloats,
        sourceRowsByteLength: sourceByteLength,
        viewProjectionMatrix: viewProjection,
        width: size.backingWidth,
        height: size.backingHeight,
        cssWidth: size.cssWidth,
        cssHeight: size.cssHeight,
        pixelRatio: size.pixelRatio,
        radiusScalePx: finiteNumber(radiusScalePx, 96),
        fallbackPointSizePx: finiteNumber(fallbackPointSizePx, 6),
        minPointSizePx: finiteNumber(minPointSizePx, 2),
        maxPointSizePx: finiteNumber(maxPointSizePx, 22),
        backgroundColor: currentBackgroundColor,
        clearAlpha,
        reason
      };
      const transferList = [viewProjection.buffer];
      if (!sourceCacheReusable) {
        message.sourceParticleRows = payload.particleRows;
        transferList.unshift(payload.particleRows.buffer);
        this.residentRenderProducerSourceCacheKey = normalizedSourceCacheKey;
        this.residentRenderProducerSourceParticleCount = particleCount;
        this.residentRenderProducerSourceStrideFloats = strideFloats;
        this.residentRenderProducerSourceByteLength = sourceByteLength;
      }
      this.worker.postMessage?.(message, transferList);
      return this.publishRenderRowsStatus({
        status: 'worker-offscreen-resident-render-producer-submit-posted',
        reason,
        schema: ULG_WORKER_OFFSCREEN_RESIDENT_RENDER_PRODUCER_SCHEMA,
        renderRowsSchema: ULG_WORKER_OFFSCREEN_RENDER_ROWS_SCHEMA,
        particleCount,
        inputTransferBytes,
        inputTransport: ULG_WORKER_OFFSCREEN_WORKER_LOCAL_PRODUCER_TRANSPORT,
        sourceCacheKey: normalizedSourceCacheKey,
        sourceCacheStatus: sourceCacheReusable ? 'source-cache-reused' : 'source-cache-uploaded',
        sourceCacheHit: sourceCacheReusable,
        sourceRowsPacked: !sourceCacheReusable,
        sourceTransferBytes: sourceCacheReusable ? 0 : sourceByteLength,
        producerSourceTransport: sourceCacheReusable
          ? 'worker-resident-source-cache'
          : 'main-thread-visual-source-transfer',
        canvasTransferred: Boolean(this.status?.canvasTransferred),
        workerReady: Boolean(this.status?.workerReady)
      });
    },
    drawResidentParticleStateProducer({
      sphParticleState = null,
      materialColorRows = null,
      sourceCacheKey = null,
      sourceCacheKeyStrategy = null,
      sourceCpuStateStale = null,
      viewProjectionMatrix = null,
      alpha = 0.92,
      fallbackColorRgb = [1, 1, 1],
      fallbackRadiusM = 0.02,
      radiusScalePx = 96,
      fallbackPointSizePx = 6,
      minPointSizePx = 2,
      maxPointSizePx = 22,
      reason = 'worker-owned-resident-particle-state-producer-refresh'
    } = {}) {
      if (!requested) {
        return this.publishRenderRowsStatus({
          status: 'worker-offscreen-resident-particle-state-producer-not-requested',
          reason,
          inputTransport: null
        });
      }
      if (!this.worker) {
        return this.publishRenderRowsStatus({
          status: 'worker-offscreen-resident-particle-state-producer-blocked-worker-unavailable',
          reason,
          schema: ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_STATE_PRODUCER_SCHEMA,
          inputTransport: ULG_WORKER_OFFSCREEN_WORKER_LOCAL_PRODUCER_TRANSPORT,
          canvasTransferred: Boolean(this.status?.canvasTransferred),
          workerReady: false
        });
      }
      const expected = residentParticleStateProducerExpectedPayloadShape({
        sphParticleState,
        materialColorRows
      });
      if (expected.particleCount <= 0 || expected.stateByteLength <= 0 || expected.thermoByteLength <= 0) {
        return this.publishRenderRowsStatus({
          status: 'worker-offscreen-resident-particle-state-producer-skipped-empty',
          reason,
          schema: ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_STATE_PRODUCER_SCHEMA,
          inputTransport: ULG_WORKER_OFFSCREEN_WORKER_LOCAL_PRODUCER_TRANSPORT,
          particleCount: 0,
          inputTransferBytes: 0
        });
      }
      const normalizedSourceCacheKey = sourceCacheKey == null
        ? null
        : [
            String(sourceCacheKey),
            `alpha:${finiteNumber(alpha, 0.92)}`,
            `fallbackColor:${finiteNumber(fallbackColorRgb?.[0], 1)},${finiteNumber(fallbackColorRgb?.[1], 1)},${finiteNumber(fallbackColorRgb?.[2], 1)}`,
            `fallbackRadius:${finiteNumber(fallbackRadiusM, 0.02)}`
          ].join('|');
      const viewProjection = normalizeViewProjectionMatrix(viewProjectionMatrix);
      const sourceCacheReusable = Boolean(
        normalizedSourceCacheKey
        && this.residentParticleStateProducerCacheKey === normalizedSourceCacheKey
        && this.residentParticleStateProducerParticleCount === expected.particleCount
        && this.residentParticleStateProducerStateStrideFloats === expected.stateStrideFloats
        && this.residentParticleStateProducerThermoStrideFloats === expected.thermoStrideFloats
        && this.residentParticleStateProducerStateByteLength === expected.stateByteLength
        && this.residentParticleStateProducerThermoByteLength === expected.thermoByteLength
        && this.residentParticleStateProducerColorRowsByteLength === expected.colorRowsByteLength
      );
      const sourceCacheMissReason = sourceCacheReusable
        ? null
        : residentParticleStateProducerCacheMissReason(this, {
            normalizedSourceCacheKey,
            expected
          });
      const state = sourceCacheReusable
        ? null
        : new Float32Array(sphParticleState?.state || []);
      const thermo = sourceCacheReusable
        ? null
        : new Float32Array(sphParticleState?.thermo || []);
      if (!sourceCacheReusable && (
        state.byteLength < expected.stateByteLength
        || thermo.byteLength < expected.thermoByteLength
      )) {
        return this.publishRenderRowsStatus({
          status: 'worker-offscreen-resident-particle-state-producer-skipped-incomplete-state',
          reason,
          schema: ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_STATE_PRODUCER_SCHEMA,
          inputTransport: ULG_WORKER_OFFSCREEN_WORKER_LOCAL_PRODUCER_TRANSPORT,
          particleCount: expected.particleCount,
          inputTransferBytes: 0,
          sourceCacheKey: normalizedSourceCacheKey,
          sourceCacheStatus: 'resident-particle-state-incomplete',
          sourceCacheKeyStrategy,
          sourceCpuStateStale,
          sourceCacheMissReason
        });
      }
      const sourceTransferBytes = sourceCacheReusable
        ? 0
        : state.byteLength + thermo.byteLength + expected.colorRowsByteLength;
      const inputTransferBytes = viewProjection.byteLength + sourceTransferBytes;
      const message = {
        type: 'draw-resident-particle-state-producer',
        schema: ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_STATE_PRODUCER_SCHEMA,
        renderRowsSchema: ULG_WORKER_OFFSCREEN_RENDER_ROWS_SCHEMA,
        inputTransport: ULG_WORKER_OFFSCREEN_WORKER_LOCAL_PRODUCER_TRANSPORT,
        producerSourceKind: 'worker-resident-particle-state',
        sourceCacheKey: normalizedSourceCacheKey,
        sourceCacheStatus: sourceCacheReusable
          ? 'resident-particle-state-cache-reused'
          : 'resident-particle-state-uploaded',
        sourceCacheKeyStrategy,
        sourceCpuStateStale,
        sourceCacheMissReason,
        reuseSourceCache: sourceCacheReusable,
        sourceRowsPacked: false,
        particleCount: expected.particleCount,
        stateStrideFloats: expected.stateStrideFloats,
        thermoStrideFloats: expected.thermoStrideFloats,
        stateByteLength: expected.stateByteLength,
        thermoByteLength: expected.thermoByteLength,
        colorRowCount: expected.colorRowCount,
        colorRowsByteLength: expected.colorRowsByteLength,
        fallbackRadiusM: finiteNumber(fallbackRadiusM, 0.02),
        alpha: finiteNumber(alpha, 0.92),
        fallbackColorRgb: [
          finiteNumber(fallbackColorRgb?.[0], 1),
          finiteNumber(fallbackColorRgb?.[1], 1),
          finiteNumber(fallbackColorRgb?.[2], 1)
        ],
        viewProjectionMatrix: viewProjection,
        width: size.backingWidth,
        height: size.backingHeight,
        cssWidth: size.cssWidth,
        cssHeight: size.cssHeight,
        pixelRatio: size.pixelRatio,
        radiusScalePx: finiteNumber(radiusScalePx, 96),
        fallbackPointSizePx: finiteNumber(fallbackPointSizePx, 6),
        minPointSizePx: finiteNumber(minPointSizePx, 2),
        maxPointSizePx: finiteNumber(maxPointSizePx, 22),
        backgroundColor: currentBackgroundColor,
        clearAlpha,
        reason
      };
      const transferList = [viewProjection.buffer];
      if (!sourceCacheReusable) {
        message.sourceState = state;
        message.sourceThermo = thermo;
        message.materialColorRows = expected.colorRows;
        transferList.unshift(state.buffer, thermo.buffer, expected.colorRows.buffer);
        this.residentParticleStateProducerCacheKey = normalizedSourceCacheKey;
        this.residentParticleStateProducerParticleCount = expected.particleCount;
        this.residentParticleStateProducerStateStrideFloats = expected.stateStrideFloats;
        this.residentParticleStateProducerThermoStrideFloats = expected.thermoStrideFloats;
        this.residentParticleStateProducerStateByteLength = expected.stateByteLength;
        this.residentParticleStateProducerThermoByteLength = expected.thermoByteLength;
        this.residentParticleStateProducerColorRowsByteLength = expected.colorRowsByteLength;
      }
      this.worker.postMessage?.(message, transferList);
      return this.publishRenderRowsStatus({
        status: 'worker-offscreen-resident-particle-state-producer-submit-posted',
        reason,
        schema: ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_STATE_PRODUCER_SCHEMA,
        renderRowsSchema: ULG_WORKER_OFFSCREEN_RENDER_ROWS_SCHEMA,
        particleCount: expected.particleCount,
        inputTransferBytes,
        inputTransport: ULG_WORKER_OFFSCREEN_WORKER_LOCAL_PRODUCER_TRANSPORT,
        producerSourceKind: 'worker-resident-particle-state',
        producerSourceTransport: sourceCacheReusable
          ? ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_STATE_CACHE_TRANSPORT
          : ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_STATE_TRANSPORT,
        sourceCacheKey: normalizedSourceCacheKey,
        sourceCacheStatus: sourceCacheReusable
          ? 'resident-particle-state-cache-reused'
          : 'resident-particle-state-uploaded',
        sourceCacheKeyStrategy,
        sourceCpuStateStale,
        sourceCacheMissReason,
        sourceCacheHit: sourceCacheReusable,
        sourceRowsPacked: false,
        sourceTransferBytes: 0,
        sourceStateTransferBytes: sourceTransferBytes,
        canvasTransferred: Boolean(this.status?.canvasTransferred),
        workerReady: Boolean(this.status?.workerReady)
      });
    },
    runResidentStageOnPresentationDevice({
      payload = null,
      reason = 'run-resident-stage-on-presentation-device'
    } = {}) {
      if (!requested) {
        return this.publishResidentStageStatus({
          status: 'worker-offscreen-resident-stage-on-presentation-device-not-requested',
          reason,
          inputTransport: null
        });
      }
      if (!this.worker) {
        return this.publishResidentStageStatus({
          status: 'worker-offscreen-resident-stage-on-presentation-device-blocked-worker-unavailable',
          reason,
          workerReady: false
        });
      }
      const stagePayload = payload && typeof payload === 'object' ? payload : {};
      const message = {
        type: 'run-resident-stage-on-presentation-device',
        schema: ULG_WORKER_OFFSCREEN_PRESENTATION_RESIDENT_STAGE_SCHEMA,
        payload: stagePayload,
        reason
      };
      this.worker.postMessage?.(message);
      return this.publishResidentStageStatus({
        status: 'worker-offscreen-resident-stage-on-presentation-device-submit-posted',
        reason,
        stageId: stagePayload.stage?.id || null,
        laneId: stagePayload.lease?.laneId || stagePayload.lane?.laneId || null,
        stateKey: stagePayload.lease?.stateKey || stagePayload.lane?.stateKey || null,
        workerDeviceSource: ULG_WORKER_OFFSCREEN_PRESENTATION_RESIDENT_STAGE_TRANSPORT,
        workerDeviceProvided: true
      });
    },
    exportRetainedCompactSnapshot({
      laneId = null,
      stateKey = null,
      cacheKey = null,
      sourceStageId = 'g2p',
      particleCount = null,
      stateStrideFloats = null,
      thermoStrideFloats = null,
      mechanicsStrideFloats = null,
      step = null,
      time = null,
      dimension = 3,
      smoothingLengthM = 0,
      timeoutMs = null,
      reason = 'export-retained-compact-snapshot'
    } = {}) {
      if (!requested) {
        return this.publishRetainedCompactSnapshotStatus({
          status: 'presentation-worker-retained-compact-snapshot-export-not-requested',
          reason,
          inputTransport: null
        });
      }
      if (!this.worker) {
        return this.publishRetainedCompactSnapshotStatus({
          status: 'presentation-worker-retained-compact-snapshot-export-blocked-worker-unavailable',
          reason,
          laneId,
          stateKey,
          workerReady: false
        });
      }
      const message = {
        type: 'export-retained-compact-snapshot',
        schema: ULG_WORKER_OFFSCREEN_RETAINED_COMPACT_SNAPSHOT_SCHEMA,
        laneId,
        stateKey,
        cacheKey,
        sourceStageId,
        particleCount,
        stateStrideFloats,
        thermoStrideFloats,
        mechanicsStrideFloats,
        step,
        time,
        dimension,
        smoothingLengthM,
        timeoutMs,
        reason
      };
      this.worker.postMessage?.(message);
      return this.publishRetainedCompactSnapshotStatus({
        status: 'presentation-worker-retained-compact-snapshot-export-submit-posted',
        reason,
        laneId,
        stateKey,
        cacheKey,
        sourceStageId,
        particleCount,
        workerDeviceSource: ULG_WORKER_OFFSCREEN_PRESENTATION_RESIDENT_STAGE_TRANSPORT,
        workerDeviceProvided: true
      });
    },
    dispose() {
      this.worker?.postMessage?.({ type: 'dispose', reason: 'scene-dispose' });
      this.worker?.terminate?.();
      if (this.canvas?.parentNode) this.canvas.parentNode.removeChild(this.canvas);
      this.worker = null;
      this.clearResidentRenderProducerSourceCache();
      this.clearResidentParticleStateProducerCache();
      return publish({
        ...(this.status || {}),
        status: 'worker-offscreen-presentation-disposed',
        reason: 'scene-dispose',
        workerReady: false
      });
    }
  };
  const capability = resolveUlgWorkerOffscreenPresentationCapability({
    requested,
    canvas,
    workerFactory,
    windowRef,
    navigatorRef
  });
  publish(capability);
  if (capability.status !== 'worker-offscreen-presentation-transfer-ready') {
    return bridge;
  }
  try {
    setDisplayCanvasStyle(canvas);
    canvas.setAttribute?.('aria-hidden', 'true');
    canvas.setAttribute?.('data-ulg-worker-offscreen-presentation', 'true');
    applyInitialCanvasBackingSize(canvas, size);
    container?.appendChild?.(canvas);
    const offscreenCanvas = canvas.transferControlToOffscreen();
    const workerCtor = resolveWorkerConstructor(workerFactory, windowRef);
    const worker = createWorkerFromFactory(
      workerCtor,
      new URL('../services/ulgOffscreenRender.worker.js', import.meta.url),
      { type: 'module', name: 'ulg-offscreen-render' }
    );
    bridge.worker = worker;
    const handleWorkerMessage = (event) => {
      const data = event?.data || {};
      if (data?.schema !== ULG_WORKER_OFFSCREEN_PRESENTATION_SCHEMA) return;
      if (
        data.workerOffscreenRenderRows?.schema === ULG_WORKER_OFFSCREEN_RENDER_ROWS_SCHEMA
        || data.workerOffscreenRenderRows?.schema === ULG_WORKER_OFFSCREEN_RESIDENT_RENDER_PRODUCER_SCHEMA
        || data.workerOffscreenRenderRows?.schema === ULG_WORKER_OFFSCREEN_RESIDENT_PARTICLE_STATE_PRODUCER_SCHEMA
      ) {
        bridge.publishRenderRowsStatus(data.workerOffscreenRenderRows);
      }
      if (
        data.workerOffscreenResidentStage?.schema
        === ULG_WORKER_OFFSCREEN_PRESENTATION_RESIDENT_STAGE_SCHEMA
      ) {
        bridge.publishResidentStageStatus(data.workerOffscreenResidentStage);
      }
      if (
        data.workerOffscreenRetainedCompactSnapshot?.schema
        === ULG_WORKER_OFFSCREEN_RETAINED_COMPACT_SNAPSHOT_SCHEMA
      ) {
        bridge.publishRetainedCompactSnapshotStatus(data.workerOffscreenRetainedCompactSnapshot);
      }
      publish({
        ...data,
        requested: true,
        canvasTransferred: true
      });
    };
    if (typeof worker.addEventListener === 'function') {
      worker.addEventListener('message', handleWorkerMessage);
    } else {
      worker.onmessage = handleWorkerMessage;
    }
    worker.onerror = (event) => {
      publish({
        status: 'worker-offscreen-presentation-worker-error',
        reason: event?.message || 'worker-owned presentation worker error',
        requested: true,
        canvasTransferred: true,
        workerReady: false
      });
    };
    worker.postMessage({
      type: 'init-offscreen-presentation',
      canvas: offscreenCanvas,
      width: size.backingWidth,
      height: size.backingHeight,
      cssWidth: size.cssWidth,
      cssHeight: size.cssHeight,
      pixelRatio: size.pixelRatio,
      backgroundColor: currentBackgroundColor,
      clearAlpha
    }, [offscreenCanvas]);
    publish({
      status: 'worker-offscreen-presentation-transfer-submitted',
      reason: null,
      requested: true,
      canvasTransferred: true,
      workerReady: false
    });
    return bridge;
  } catch (error) {
    if (canvas?.parentNode) canvas.parentNode.removeChild(canvas);
    return publish({
      status: 'worker-offscreen-presentation-transfer-error',
      reason: error instanceof Error ? error.message : String(error),
      requested: true,
      canvasTransferred: false,
      workerReady: false
    });
  }
}
