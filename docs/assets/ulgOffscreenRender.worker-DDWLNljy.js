const SCHEMA = 'peercompute.ulg.worker-offscreen-presentation.v0';
const TRANSPORT = 'worker-owned-presented-canvas';
const DISPLAY_HANDOFF = 'transferControlToOffscreen';
const REJECTED_TRANSPORT = 'frame-copy-back';
const RENDER_ROWS_SCHEMA = 'peercompute.ulg.worker-offscreen-render-rows.v0';
const RENDER_ROWS_INPUT_TRANSPORT = 'main-thread-compact-render-row-transfer';
const RESIDENT_RENDER_PRODUCER_SCHEMA = 'peercompute.ulg.worker-offscreen-resident-render-producer.v0';
const RESIDENT_PARTICLE_STATE_PRODUCER_SCHEMA =
  'peercompute.ulg.worker-offscreen-resident-particle-state-producer.v0';
const PRESENTATION_WORKER_RESIDENT_STAGE_SCHEMA =
  'peercompute.ulg.presentation-worker-resident-stage.v0';
const PRESENTATION_WORKER_RETAINED_COMPACT_SNAPSHOT_SCHEMA =
  'peercompute.ulg.presentation-worker-retained-compact-snapshot-export.v0';
const REMOTE_TASK_GRAPH_COMPACT_BUFFER_SNAPSHOT_SCHEMA =
  'peercompute.ulg.remote-task-graph-compact-buffer-snapshot.v0';
const DEFAULT_PRESENTATION_WORKER_RESIDENT_STAGE_TIMEOUT_MS = 30_000;
const RESIDENT_RENDER_PRODUCER_TRANSPORT = 'worker-owned-resident-render-producer';
const RESIDENT_PARTICLE_STATE_TRANSPORT = 'worker-resident-particle-state-transfer';
const RESIDENT_PARTICLE_STATE_CACHE_TRANSPORT = 'worker-resident-particle-state-cache';
const RESIDENT_STAGE_OUTPUT_TRANSPORT = 'worker-retained-resident-stage-output';
const RESIDENT_STAGE_OUTPUT_RENDER_REQUEST_SCHEMA =
  'peercompute.ulg.presentation-worker-retained-stage-output-render-request.v0';
const RENDER_ROW_PARTICLE_STRIDE_FLOATS = 8;
const RESIDENT_PARTICLE_STATE_COLOR_ROW_FLOATS = 8;
const TEXTURE_RENDER_ATTACHMENT = 0x10;
const BUFFER_USAGE_COPY_DST = 0x08;
const BUFFER_USAGE_UNIFORM = 0x40;
const BUFFER_USAGE_STORAGE = 0x80;
const SHADER_STAGE_VERTEX = 0x1;
const SHADER_STAGE_COMPUTE = 0x4;

let canvas = null;
let gpu = null;
let adapter = null;
let device = null;
let context = null;
let format = null;
let backgroundColor = '#000000';
let clearAlpha = 0;
let cssWidth = 0;
let cssHeight = 0;
let pixelRatio = 1;
let frameCount = 0;
let readyFrameCount = 0;
// Display arbitration: never present a state older than the newest one
// already on screen. The presentation-worker retained-stage lane can lag
// the authoritative main-thread chain; without this gate its late draws
// overwrite fresh render-row transfers and the canvas appears frozen at an
// old sim time. Reset on init/resize/clear (scene resets flow through
// those messages).
let lastPresentedSphStep = null;
function presentationStepAccepts(sphStep) {
  const step = Number(sphStep);
  if (!Number.isFinite(step)) return true;
  if (!Number.isFinite(Number(lastPresentedSphStep))) return true;
  return step >= Number(lastPresentedSphStep);
}
function notePresentedSphStep(sphStep) {
  const step = Number(sphStep);
  if (Number.isFinite(step)) lastPresentedSphStep = step;
}
function resetPresentedSphStep() {
  lastPresentedSphStep = null;
}
let disposed = false;
let renderRowsPipeline = null;
let renderRowsBindGroupLayout = null;
let renderRowsParticleBuffer = null;
let renderRowsParticleBufferByteLength = 0;
let renderRowsUniformBuffer = null;
let renderRowsStatus = null;
let residentRenderProducerPipeline = null;
let residentRenderProducerBindGroupLayout = null;
let residentRenderProducerSourceBuffer = null;
let residentRenderProducerSourceBufferByteLength = 0;
let residentRenderProducerSourceCacheKey = null;
let residentRenderProducerSourceParticleCount = 0;
let residentRenderProducerSourceStrideFloats = 0;
let residentRenderProducerSourceRowsByteLength = 0;
let residentRenderProducerParamsBuffer = null;
let residentParticleStateProducerPipeline = null;
let residentParticleStateProducerBindGroupLayout = null;
let residentParticleStateProducerStateBuffer = null;
let residentParticleStateProducerStateBufferByteLength = 0;
let residentParticleStateProducerThermoBuffer = null;
let residentParticleStateProducerThermoBufferByteLength = 0;
let residentParticleStateProducerColorBuffer = null;
let residentParticleStateProducerColorBufferByteLength = 0;
let residentParticleStateProducerParamsBuffer = null;
let residentParticleStateProducerCacheKey = null;
let residentParticleStateProducerParticleCount = 0;
let residentParticleStateProducerStateStrideFloats = 0;
let residentParticleStateProducerThermoStrideFloats = 0;
let residentParticleStateProducerStateRowsByteLength = 0;
let residentParticleStateProducerThermoRowsByteLength = 0;
let residentParticleStateProducerColorRowsByteLength = 0;
let residentStageRunnerModulePromise = null;
let retainedCompactSnapshotStatus = null;

function nowMs() {
  return typeof self.performance?.now === 'function' ? self.performance.now() : Date.now();
}

function publish(status) {
  self.postMessage({
    schema: SCHEMA,
    transport: TRANSPORT,
    displayHandoff: DISPLAY_HANDOFF,
    rejectedTransport: REJECTED_TRANSPORT,
    frameCopyBackRejected: true,
    copiedBytesPerFrame: 0,
    copiedBytesPerSecond: 0,
    frameCount,
    readyEver: readyFrameCount > 0,
    readyFrameCount,
    disposed,
    workerReady: Boolean(device && context),
    canvasTransferred: Boolean(canvas),
    contextStatus: context ? 'webgpu-context-ready' : 'webgpu-context-unavailable',
    format,
    cssWidth,
    cssHeight,
    pixelRatio,
    backingWidth: canvas?.width ?? null,
    backingHeight: canvas?.height ?? null,
    workerOffscreenRenderRows: renderRowsStatus,
    updatedAtMs: nowMs(),
    scientificValidation: false,
    sphValidation: false,
    fullPhysicsValidation: false,
    ...status
  });
}

function residentStageTimeoutMs(data = {}) {
  const value = Number(data.timeoutMs ?? data.payload?.timeoutMs);
  return Number.isFinite(value) && value > 0
    ? Math.max(1, Math.round(value))
    : DEFAULT_PRESENTATION_WORKER_RESIDENT_STAGE_TIMEOUT_MS;
}

function compactError(error) {
  if (!error) return {};
  return {
    errorName: error instanceof Error ? error.name : null,
    errorMessage: error instanceof Error ? error.message : String(error),
    errorStack: error instanceof Error ? String(error.stack || '').slice(0, 2000) : null
  };
}

function isGpuBufferLike(value) {
  return Boolean(
    value
    && typeof value === 'object'
    && (
      value.constructor?.name === 'GPUBuffer'
      || typeof value.mapAsync === 'function'
      || typeof value.getMappedRange === 'function'
    )
  );
}

function publishResidentStageStatus({
  status,
  reason,
  stagePayload = {},
  workerReady = Boolean(device),
  workerDeviceSource = 'offscreen-presentation-worker-device',
  workerDeviceProvided = Boolean(device),
  startedAtMs = null,
  timeoutMs = null,
  result = null,
  error = null
} = {}) {
  const residentStageStatus = {
    schema: PRESENTATION_WORKER_RESIDENT_STAGE_SCHEMA,
    status,
    reason,
    stageId: stagePayload.stage?.id || null,
    laneId: stagePayload.lease?.laneId || stagePayload.lane?.laneId || null,
    stateKey: stagePayload.lease?.stateKey || stagePayload.lane?.stateKey || null,
    workerDeviceSource,
    workerDeviceProvided,
    elapsedMs: Number.isFinite(startedAtMs) ? Math.max(0, nowMs() - startedAtMs) : null,
    timeoutMs: timeoutMs ?? null,
    ...(result
      ? {
          residentStageSummary: result?.summary || null,
          residentStageRetainedBufferRefs: Array.isArray(result?.retainedBufferRefs)
            ? [...result.retainedBufferRefs]
            : [],
          residentStageGpuFence: result?.gpuFence
            ? {
                schema: result.gpuFence.schema || null,
                status: result.gpuFence.status || null,
                fenceSatisfied: result.gpuFence.fenceSatisfied === true,
                queueCompletionStatus: result.gpuFence.queueCompletionStatus || null,
                queueCompletionMethod: result.gpuFence.queueCompletionMethod || null,
                queueCompletionErrorName: result.gpuFence.queueCompletionErrorName || null,
                queueCompletionErrorMessage: result.gpuFence.queueCompletionErrorMessage || null,
                queueCompletionFallbackFrom: result.gpuFence.queueCompletionFallbackFrom || null,
                queueCompletionFallbackStatus: result.gpuFence.queueCompletionFallbackStatus || null,
                queueCompletionFallbackErrorName: result.gpuFence.queueCompletionFallbackErrorName || null,
                queueCompletionFallbackErrorMessage: result.gpuFence.queueCompletionFallbackErrorMessage || null,
                cpuQueueFenceBypassed: result.gpuFence.cpuQueueFenceBypassed === true,
                sameWorkerGpuHandoff: result.gpuFence.sameWorkerGpuHandoff === true
              }
            : null
        }
      : {}),
    ...compactError(error)
  };
  publish({
    status,
    reason,
    workerReady,
    workerDeviceSource,
    workerDeviceProvided,
    workerOffscreenResidentStage: residentStageStatus
  });
  return residentStageStatus;
}

function publishRetainedCompactSnapshotStatus(nextStatus = {}) {
  const status = {
    schema: PRESENTATION_WORKER_RETAINED_COMPACT_SNAPSHOT_SCHEMA,
    status: 'worker-retained-compact-snapshot-export-status',
    compactBufferSnapshotSchema: REMOTE_TASK_GRAPH_COMPACT_BUFFER_SNAPSHOT_SCHEMA,
    workerDeviceSource: 'offscreen-presentation-worker-device',
    workerDeviceProvided: Boolean(device),
    portableSnapshotAvailable: false,
    crossPeerReplayReady: false,
    readbackByteLength: 0,
    updatedAtMs: nowMs(),
    scientificValidation: false,
    sphValidation: false,
    fullPhysicsValidation: false,
    ...nextStatus
  };
  retainedCompactSnapshotStatus = status;
  publish({
    status: status.status,
    reason: status.reason || null,
    workerReady: Boolean(device && context),
    workerDeviceSource: status.workerDeviceSource,
    workerDeviceProvided: status.workerDeviceProvided,
    workerOffscreenRetainedCompactSnapshot: status
  });
  return status;
}

function timeoutResidentStage(promise, timeoutMs) {
  let timeoutId = null;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`presentation worker resident stage timed out after ${timeoutMs} ms`));
    }, timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId != null) clearTimeout(timeoutId);
  });
}

function gpuBufferUsage(name, fallback) {
  return self.GPUBufferUsage?.[name] ?? fallback;
}

function gpuShaderStage(name, fallback) {
  return self.GPUShaderStage?.[name] ?? fallback;
}

function colorToClearValue(color, alpha = clearAlpha) {
  const text = String(color || '').trim();
  const match = text.match(/^#?([0-9a-f]{6})$/i);
  if (!match) return { r: 0, g: 0, b: 0, a: alpha };
  const value = match[1];
  // The canvas context is alphaMode 'premultiplied': color channels must be
  // multiplied by alpha or the compositor treats the clear as an invalid
  // premultiplied color (a washed-out veil at alpha 0 instead of
  // transparency).
  return {
    r: (Number.parseInt(value.slice(0, 2), 16) / 255) * alpha,
    g: (Number.parseInt(value.slice(2, 4), 16) / 255) * alpha,
    b: (Number.parseInt(value.slice(4, 6), 16) / 255) * alpha,
    a: alpha
  };
}

function configureCanvas({
  width = canvas?.width ?? 1,
  height = canvas?.height ?? 1,
  nextCssWidth = cssWidth,
  nextCssHeight = cssHeight,
  nextPixelRatio = pixelRatio
} = {}) {
  if (!canvas || !context || !device || !format) return;
  canvas.width = Math.max(1, Math.floor(Number(width) || 1));
  canvas.height = Math.max(1, Math.floor(Number(height) || 1));
  cssWidth = Number.isFinite(Number(nextCssWidth)) ? Number(nextCssWidth) : cssWidth;
  cssHeight = Number.isFinite(Number(nextCssHeight)) ? Number(nextCssHeight) : cssHeight;
  pixelRatio = Number.isFinite(Number(nextPixelRatio)) && Number(nextPixelRatio) > 0
    ? Number(nextPixelRatio)
    : pixelRatio;
  context.configure({
    device,
    format,
    usage: self.GPUTextureUsage?.RENDER_ATTACHMENT ?? TEXTURE_RENDER_ATTACHMENT,
    alphaMode: 'premultiplied'
  });
}

function destroyRenderRowsResources() {
  renderRowsParticleBuffer?.destroy?.();
  renderRowsUniformBuffer?.destroy?.();
  residentRenderProducerSourceBuffer?.destroy?.();
  residentRenderProducerParamsBuffer?.destroy?.();
  renderRowsPipeline = null;
  renderRowsBindGroupLayout = null;
  renderRowsParticleBuffer = null;
  renderRowsUniformBuffer = null;
  renderRowsParticleBufferByteLength = 0;
  residentRenderProducerPipeline = null;
  residentRenderProducerBindGroupLayout = null;
  residentRenderProducerSourceBuffer = null;
  residentRenderProducerParamsBuffer = null;
  residentRenderProducerSourceBufferByteLength = 0;
  residentRenderProducerSourceCacheKey = null;
  residentRenderProducerSourceParticleCount = 0;
  residentRenderProducerSourceStrideFloats = 0;
  residentRenderProducerSourceRowsByteLength = 0;
  residentParticleStateProducerStateBuffer?.destroy?.();
  residentParticleStateProducerThermoBuffer?.destroy?.();
  residentParticleStateProducerColorBuffer?.destroy?.();
  residentParticleStateProducerParamsBuffer?.destroy?.();
  residentParticleStateProducerPipeline = null;
  residentParticleStateProducerBindGroupLayout = null;
  residentParticleStateProducerStateBuffer = null;
  residentParticleStateProducerThermoBuffer = null;
  residentParticleStateProducerColorBuffer = null;
  residentParticleStateProducerParamsBuffer = null;
  residentParticleStateProducerStateBufferByteLength = 0;
  residentParticleStateProducerThermoBufferByteLength = 0;
  residentParticleStateProducerColorBufferByteLength = 0;
  residentParticleStateProducerCacheKey = null;
  residentParticleStateProducerParticleCount = 0;
  residentParticleStateProducerStateStrideFloats = 0;
  residentParticleStateProducerThermoStrideFloats = 0;
  residentParticleStateProducerStateRowsByteLength = 0;
  residentParticleStateProducerThermoRowsByteLength = 0;
  residentParticleStateProducerColorRowsByteLength = 0;
}

function clearPresentation({ reason = 'clear' } = {}) {
  if (!device || !context) {
    publish({
      status: 'worker-offscreen-presentation-clear-blocked',
      reason: 'WebGPU device/context is unavailable'
    });
    return;
  }
  const encoder = device.createCommandEncoder({ label: 'ulg-offscreen-presentation-clear' });
  const pass = encoder.beginRenderPass({
    colorAttachments: [{
      view: context.getCurrentTexture().createView(),
      clearValue: colorToClearValue(backgroundColor, clearAlpha),
      loadOp: 'clear',
      storeOp: 'store'
    }]
  });
  pass.end();
  device.queue.submit([encoder.finish()]);
  frameCount += 1;
  readyFrameCount = frameCount;
  publish({
    status: 'worker-offscreen-presentation-ready',
    reason,
    backgroundColor,
    clearAlpha,
    workerReady: true
  });
}

function publishRenderRowsStatus(nextStatus = {}) {
  renderRowsStatus = {
    schema: RENDER_ROWS_SCHEMA,
    status: 'worker-offscreen-render-rows-status',
    reason: null,
    inputTransport: RENDER_ROWS_INPUT_TRANSPORT,
    displayTransport: TRANSPORT,
    displayHandoff: DISPLAY_HANDOFF,
    rejectedTransport: REJECTED_TRANSPORT,
    frameCopyBackRejected: true,
    copiedBytesPerFrame: 0,
    copiedBytesPerSecond: 0,
    particleCount: 0,
    inputTransferBytes: 0,
    strideFloats: RENDER_ROW_PARTICLE_STRIDE_FLOATS,
    canvasTransferred: Boolean(canvas),
    workerReady: Boolean(device && context),
    contextStatus: context ? 'webgpu-context-ready' : 'webgpu-context-unavailable',
    frameCount,
    readyEver: readyFrameCount > 0,
    readyFrameCount,
    updatedAtMs: nowMs(),
    scientificValidation: false,
    sphValidation: false,
    fullPhysicsValidation: false,
    ...nextStatus
  };
  publish({
    status: renderRowsStatus.status,
    reason: renderRowsStatus.reason,
    workerOffscreenRenderRows: renderRowsStatus
  });
  return renderRowsStatus;
}

async function residentStageRunnerModule() {
  if (!residentStageRunnerModulePromise) {
    residentStageRunnerModulePromise = import('./ulgMechanicsResidentStage.worker.js');
  }
  return residentStageRunnerModulePromise;
}

function retainedStageOutputRenderRequest(stagePayload = {}) {
  const context = stagePayload.context?.ulgMechanicsResidentStageWorker
    || stagePayload.context?.mechanicsResidentStageWorker
    || {};
  const common = context.common && typeof context.common === 'object'
    ? context.common
    : {};
  const request = common.presentationWorkerRenderRetainedStageOutput
    || common.retainedStageOutputRenderRequest
    || null;
  return request?.enabled === true ? request : null;
}

async function maybeDrawRetainedResidentStageOutput({
  runner = null,
  stagePayload = {},
  result = null,
  reason = 'run-resident-stage-on-presentation-device'
} = {}) {
  const stageId = stagePayload.stage?.id || null;
  const request = retainedStageOutputRenderRequest(stagePayload);
  if (!request || stageId !== 'g2p') return null;
  if (typeof runner?.resolveUlgMechanicsResidentStageWorkerRetainedParticleState !== 'function') {
    return publishRenderRowsStatus({
      schema: RESIDENT_PARTICLE_STATE_PRODUCER_SCHEMA,
      renderRowsSchema: RENDER_ROWS_SCHEMA,
      status: 'worker-offscreen-resident-stage-output-render-blocked-resolver-unavailable',
      reason,
      inputTransport: RESIDENT_RENDER_PRODUCER_TRANSPORT,
      producerSourceKind: 'worker-retained-resident-stage-output',
      producerSourceTransport: RESIDENT_STAGE_OUTPUT_TRANSPORT,
      sourceStageId: stageId,
      sourceTransferBytes: 0,
      sourceStateTransferBytes: 0,
      workerLocalRenderRowsProduced: false
    });
  }
  const retained = runner.resolveUlgMechanicsResidentStageWorkerRetainedParticleState({
    laneId: stagePayload.lease?.laneId || stagePayload.lane?.laneId || null,
    stateKey: stagePayload.lease?.stateKey || stagePayload.lane?.stateKey || null,
    sourceStageId: stageId,
    particleCount: request.particleCount,
    stateStrideFloats: request.stateStrideFloats,
    thermoStrideFloats: request.thermoStrideFloats,
    stateByteLength: request.stateByteLength,
    thermoByteLength: request.thermoByteLength
  });
  if (
    retained?.status !== 'worker-retained-particle-state-ready'
    || !isGpuBufferLike(retained.sourceStateBuffer)
    || !isGpuBufferLike(retained.sourceThermoBuffer)
  ) {
    return publishRenderRowsStatus({
      schema: RESIDENT_PARTICLE_STATE_PRODUCER_SCHEMA,
      renderRowsSchema: RENDER_ROWS_SCHEMA,
      status: 'worker-offscreen-resident-stage-output-render-blocked-source-unavailable',
      reason: retained?.status || reason,
      inputTransport: RESIDENT_RENDER_PRODUCER_TRANSPORT,
      producerSourceKind: 'worker-retained-resident-stage-output',
      producerSourceTransport: RESIDENT_STAGE_OUTPUT_TRANSPORT,
      sourceStageId: stageId,
      retainedParticleStateStatus: retained?.status || null,
      particleCount: retained?.particleCount ?? 0,
      sourceTransferBytes: 0,
      sourceStateTransferBytes: 0,
      workerLocalRenderRowsProduced: false
    });
  }
  return drawResidentParticleStateProducer({
    ...request,
    schema: RESIDENT_STAGE_OUTPUT_RENDER_REQUEST_SCHEMA,
    inputTransport: RESIDENT_RENDER_PRODUCER_TRANSPORT,
    producerSourceKind: 'worker-retained-resident-stage-output',
    producerSourceTransport: RESIDENT_STAGE_OUTPUT_TRANSPORT,
    sourceCacheStatus: 'worker-retained-resident-stage-output-bound',
    sourceCacheKey: request.sourceCacheKey || [
      RESIDENT_STAGE_OUTPUT_TRANSPORT,
      retained.laneId || 'lane:unknown',
      retained.stateKey || 'state:unknown',
      stageId,
      `count:${retained.particleCount}`
    ].join('|'),
    sourceStageId: stageId,
    retainedParticleStateStatus: retained.status,
    sourceStateBuffer: retained.sourceStateBuffer,
    sourceThermoBuffer: retained.sourceThermoBuffer,
    particleCount: retained.particleCount,
    stateStrideFloats: retained.stateStrideFloats,
    thermoStrideFloats: retained.thermoStrideFloats,
    stateByteLength: retained.stateBufferByteLength,
    thermoByteLength: retained.thermoBufferByteLength,
    width: request.width ?? canvas?.width ?? 1,
    height: request.height ?? canvas?.height ?? 1,
    cssWidth: request.cssWidth ?? cssWidth,
    cssHeight: request.cssHeight ?? cssHeight,
    pixelRatio: request.pixelRatio ?? pixelRatio,
    backgroundColor: request.backgroundColor || backgroundColor,
    clearAlpha: Number.isFinite(Number(request.clearAlpha)) ? Number(request.clearAlpha) : clearAlpha,
    reason: request.reason || `${reason}:render-retained-g2p-output`,
    residentStageResultStatus: result?.summary?.status || result?.value?.status || null
  });
}

async function runResidentStageOnPresentationDevice(data = {}) {
  const payload = data.payload && typeof data.payload === 'object' ? data.payload : {};
  if (!device || !context) {
    publishResidentStageStatus({
      status: 'worker-offscreen-resident-stage-on-presentation-device-blocked-webgpu-unavailable',
      reason: 'presentation worker WebGPU device/context is unavailable',
      stagePayload: payload,
      workerDeviceSource: null,
      workerDeviceProvided: false,
      workerReady: false
    });
    return;
  }
  const startedAtMs = nowMs();
  const timeoutMs = residentStageTimeoutMs(data);
  let runner = null;
  try {
    runner = await residentStageRunnerModule();
  } catch (error) {
    publishResidentStageStatus({
      status: 'worker-offscreen-resident-stage-on-presentation-device-failed',
      reason: 'mechanics resident stage runner import failed',
      stagePayload: payload,
      workerReady: true,
      startedAtMs,
      timeoutMs,
      error
    });
    return;
  }
  if (typeof runner.runUlgMechanicsResidentStageWorkerPayload !== 'function') {
    publishResidentStageStatus({
      status: 'worker-offscreen-resident-stage-on-presentation-device-blocked-runner-unavailable',
      reason: 'mechanics resident stage runner is unavailable in presentation worker',
      stagePayload: payload,
      workerReady: true,
      startedAtMs,
      timeoutMs
    });
    return;
  }
  const previousContext = payload.context && typeof payload.context === 'object'
    ? payload.context
    : {};
  const previousWorkerContext = previousContext.ulgMechanicsResidentStageWorker
    || previousContext.mechanicsResidentStageWorker
    || {};
  const previousCommon = previousWorkerContext.common && typeof previousWorkerContext.common === 'object'
    ? previousWorkerContext.common
    : {};
  const stagePayload = {
    ...payload,
    context: {
      ...previousContext,
      ulgMechanicsResidentStageWorker: {
        ...previousWorkerContext,
        preferWebGpu: true,
        common: {
          ...previousCommon,
          sameWorkerQueueFenceFallback: true,
          deviceResult: {
            status: 'webgpu-ready-presentation-worker-device',
            reason: 'resident stage is executing inside the offscreen presentation worker',
            device,
            workerDeviceSource: 'offscreen-presentation-worker-device',
            workerDeviceProvided: true
          },
          navigatorRef: self.navigator
        }
      }
    }
  };
  publishResidentStageStatus({
    status: 'worker-offscreen-resident-stage-on-presentation-device-started',
    reason: data.reason || 'run-resident-stage-on-presentation-device',
    stagePayload,
    workerReady: true,
    startedAtMs,
    timeoutMs
  });
  try {
    const result = await timeoutResidentStage(
      runner.runUlgMechanicsResidentStageWorkerPayload(stagePayload),
      timeoutMs
    );
    publishResidentStageStatus({
      status: 'worker-offscreen-resident-stage-on-presentation-device-completed',
      reason: data.reason || 'run-resident-stage-on-presentation-device',
      stagePayload,
      workerReady: true,
      startedAtMs,
      timeoutMs,
      result
    });
    try {
      await maybeDrawRetainedResidentStageOutput({
        runner,
        stagePayload,
        result,
        reason: data.reason || 'run-resident-stage-on-presentation-device'
      });
    } catch (renderError) {
      publishRenderRowsStatus({
        schema: RESIDENT_PARTICLE_STATE_PRODUCER_SCHEMA,
        renderRowsSchema: RENDER_ROWS_SCHEMA,
        status: 'worker-offscreen-resident-stage-output-render-failed',
        reason: renderError instanceof Error ? renderError.message : String(renderError),
        inputTransport: RESIDENT_RENDER_PRODUCER_TRANSPORT,
        producerSourceKind: 'worker-retained-resident-stage-output',
        producerSourceTransport: RESIDENT_STAGE_OUTPUT_TRANSPORT,
        sourceStageId: stagePayload.stage?.id || null,
        sourceTransferBytes: 0,
        sourceStateTransferBytes: 0,
        workerLocalRenderRowsProduced: false,
        ...compactError(renderError)
      });
    }
  } catch (error) {
    publishResidentStageStatus({
      status: error?.message?.includes('timed out')
        ? 'worker-offscreen-resident-stage-on-presentation-device-timeout'
        : 'worker-offscreen-resident-stage-on-presentation-device-failed',
      reason: data.reason || 'run-resident-stage-on-presentation-device',
      stagePayload,
      workerReady: true,
      startedAtMs,
      timeoutMs,
      error
    });
  }
}

async function exportRetainedCompactSnapshotFromPresentationDevice(data = {}) {
  if (!device || !context) {
    return publishRetainedCompactSnapshotStatus({
      status: 'presentation-worker-retained-compact-snapshot-export-blocked-webgpu-unavailable',
      reason: 'presentation worker WebGPU device/context is unavailable',
      laneId: data.laneId || null,
      stateKey: data.stateKey || null,
      workerDeviceProvided: false
    });
  }
  const startedAtMs = nowMs();
  const timeoutMs = residentStageTimeoutMs(data);
  let runner = null;
  try {
    runner = await residentStageRunnerModule();
  } catch (error) {
    return publishRetainedCompactSnapshotStatus({
      status: 'presentation-worker-retained-compact-snapshot-export-failed',
      reason: 'mechanics resident stage runner import failed',
      laneId: data.laneId || null,
      stateKey: data.stateKey || null,
      elapsedMs: Math.max(0, nowMs() - startedAtMs),
      timeoutMs,
      ...compactError(error)
    });
  }
  if (typeof runner.exportUlgMechanicsResidentStageWorkerRetainedCompactSnapshot !== 'function') {
    return publishRetainedCompactSnapshotStatus({
      status: 'presentation-worker-retained-compact-snapshot-export-blocked-runner-unavailable',
      reason: 'mechanics resident stage compact snapshot exporter is unavailable in presentation worker',
      laneId: data.laneId || null,
      stateKey: data.stateKey || null,
      elapsedMs: Math.max(0, nowMs() - startedAtMs),
      timeoutMs
    });
  }
  publishRetainedCompactSnapshotStatus({
    status: 'presentation-worker-retained-compact-snapshot-export-started',
    reason: data.reason || 'export-retained-compact-snapshot',
    laneId: data.laneId || null,
    stateKey: data.stateKey || null,
    cacheKey: data.cacheKey || null,
    sourceStageId: data.sourceStageId || 'g2p',
    timeoutMs
  });
  try {
    const result = await timeoutResidentStage(
      runner.exportUlgMechanicsResidentStageWorkerRetainedCompactSnapshot({
        device,
        laneId: data.laneId || null,
        stateKey: data.stateKey || null,
        cacheKey: data.cacheKey || null,
        sourceStageId: data.sourceStageId || 'g2p',
        particleCount: data.particleCount ?? null,
        stateStrideFloats: data.stateStrideFloats ?? null,
        thermoStrideFloats: data.thermoStrideFloats ?? null,
        mechanicsStrideFloats: data.mechanicsStrideFloats ?? null,
        step: data.step ?? null,
        time: data.time ?? null,
        dimension: data.dimension ?? 3,
        smoothingLengthM: data.smoothingLengthM ?? 0
      }),
      timeoutMs
    );
    const exported = result?.status === 'worker-retained-compact-snapshot-exported'
      && result?.compactBufferSnapshot?.schema === REMOTE_TASK_GRAPH_COMPACT_BUFFER_SNAPSHOT_SCHEMA;
    return publishRetainedCompactSnapshotStatus({
      ...result,
      schema: PRESENTATION_WORKER_RETAINED_COMPACT_SNAPSHOT_SCHEMA,
      status: exported
        ? 'presentation-worker-retained-compact-snapshot-exported'
        : 'presentation-worker-retained-compact-snapshot-export-blocked',
      reason: result?.reason || data.reason || 'export-retained-compact-snapshot',
      laneId: result?.laneId ?? data.laneId ?? null,
      stateKey: result?.stateKey ?? data.stateKey ?? null,
      cacheKey: result?.cacheKey ?? data.cacheKey ?? null,
      sourceStageId: result?.sourceStageId ?? data.sourceStageId ?? 'g2p',
      elapsedMs: Math.max(0, nowMs() - startedAtMs),
      timeoutMs,
      portableSnapshotAvailable: exported,
      crossPeerReplayReady: exported
    });
  } catch (error) {
    return publishRetainedCompactSnapshotStatus({
      status: error?.message?.includes('timed out')
        ? 'presentation-worker-retained-compact-snapshot-export-timeout'
        : 'presentation-worker-retained-compact-snapshot-export-failed',
      reason: data.reason || 'export-retained-compact-snapshot',
      laneId: data.laneId || null,
      stateKey: data.stateKey || null,
      cacheKey: data.cacheKey || null,
      sourceStageId: data.sourceStageId || 'g2p',
      elapsedMs: Math.max(0, nowMs() - startedAtMs),
      timeoutMs,
      ...compactError(error)
    });
  }
}

function createRenderRowsShaderModule() {
  return device.createShaderModule({
    label: 'ulg-offscreen-render-rows-shader',
    code: `
struct Particle {
  positionRadius: vec4<f32>,
  color: vec4<f32>,
};

struct Params {
  viewProjection: mat4x4<f32>,
  canvasSizePx: vec2<f32>,
  radiusScalePx: f32,
  fallbackPointSizePx: f32,
  minPointSizePx: f32,
  maxPointSizePx: f32,
  _pad: vec2<f32>,
};

@group(0) @binding(0) var<storage, read> particles: array<Particle>;
@group(0) @binding(1) var<uniform> params: Params;

struct VertexOut {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec4<f32>,
};

fn quadCorner(vertexIndex: u32) -> vec2<f32> {
  var corner = vec2<f32>(-1.0, -1.0);
  if (vertexIndex == 1u || vertexIndex == 4u || vertexIndex == 5u) {
    corner.x = 1.0;
  }
  if (vertexIndex == 2u || vertexIndex == 3u || vertexIndex == 5u) {
    corner.y = 1.0;
  }
  return corner;
}

@vertex
fn vsMain(@builtin(vertex_index) vertexIndex: u32, @builtin(instance_index) instanceIndex: u32) -> VertexOut {
  let particle = particles[instanceIndex];
  let clip = params.viewProjection * vec4<f32>(particle.positionRadius.xyz, 1.0);
  var out: VertexOut;
  if (clip.w <= 0.0001) {
    out.position = vec4<f32>(2.0, 2.0, 1.0, 1.0);
    out.color = vec4<f32>(0.0);
    return out;
  }
  let corner = quadCorner(vertexIndex);
  let pointSizePx = clamp(
    max(particle.positionRadius.w * params.radiusScalePx, params.fallbackPointSizePx),
    params.minPointSizePx,
    params.maxPointSizePx
  );
  let ndcOffset = corner * vec2<f32>(
    (pointSizePx / max(params.canvasSizePx.x, 1.0)) * 2.0,
    (pointSizePx / max(params.canvasSizePx.y, 1.0)) * 2.0
  );
  let ndc = (clip.xy / clip.w) + ndcOffset;
  out.position = vec4<f32>(ndc * clip.w, clip.z, clip.w);
  out.color = particle.color;
  return out;
}

@fragment
fn fsMain(input: VertexOut) -> @location(0) vec4<f32> {
  return input.color;
}
`
  });
}

function ensureRenderRowsPipeline() {
  if (renderRowsPipeline && renderRowsBindGroupLayout && renderRowsUniformBuffer) {
    return;
  }
  const shaderModule = createRenderRowsShaderModule();
  renderRowsBindGroupLayout = device.createBindGroupLayout({
    label: 'ulg-offscreen-render-rows-bind-group-layout',
    entries: [
      {
        binding: 0,
        visibility: gpuShaderStage('VERTEX', SHADER_STAGE_VERTEX),
        buffer: { type: 'read-only-storage' }
      },
      {
        binding: 1,
        visibility: gpuShaderStage('VERTEX', SHADER_STAGE_VERTEX),
        buffer: { type: 'uniform' }
      }
    ]
  });
  const pipelineLayout = device.createPipelineLayout({
    label: 'ulg-offscreen-render-rows-pipeline-layout',
    bindGroupLayouts: [renderRowsBindGroupLayout]
  });
  renderRowsPipeline = device.createRenderPipeline({
    label: 'ulg-offscreen-render-rows-pipeline',
    layout: pipelineLayout,
    vertex: {
      module: shaderModule,
      entryPoint: 'vsMain'
    },
    fragment: {
      module: shaderModule,
      entryPoint: 'fsMain',
      targets: [{
        format,
        blend: {
          color: {
            srcFactor: 'src-alpha',
            dstFactor: 'one-minus-src-alpha',
            operation: 'add'
          },
          alpha: {
            srcFactor: 'one',
            dstFactor: 'one-minus-src-alpha',
            operation: 'add'
          }
        },
        writeMask: self.GPUColorWrite?.ALL ?? 0xF
      }]
    },
    primitive: {
      topology: 'triangle-list'
    }
  });
  renderRowsUniformBuffer = device.createBuffer({
    label: 'ulg-offscreen-render-rows-uniforms',
    size: 24 * Float32Array.BYTES_PER_ELEMENT,
    usage: gpuBufferUsage('UNIFORM', BUFFER_USAGE_UNIFORM)
      | gpuBufferUsage('COPY_DST', BUFFER_USAGE_COPY_DST)
  });
}

function ensureRenderRowsParticleBuffer(byteLength) {
  const nextByteLength = Math.max(
    RENDER_ROW_PARTICLE_STRIDE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    Math.ceil(Number(byteLength) || 0)
  );
  if (renderRowsParticleBuffer && renderRowsParticleBufferByteLength >= nextByteLength) {
    return;
  }
  renderRowsParticleBuffer?.destroy?.();
  renderRowsParticleBuffer = device.createBuffer({
    label: 'ulg-offscreen-render-rows-particles',
    size: nextByteLength,
    usage: gpuBufferUsage('STORAGE', BUFFER_USAGE_STORAGE)
      | gpuBufferUsage('COPY_DST', BUFFER_USAGE_COPY_DST)
  });
  renderRowsParticleBufferByteLength = nextByteLength;
}

function createResidentRenderProducerShaderModule() {
  return device.createShaderModule({
    label: 'ulg-offscreen-resident-render-producer-shader',
    code: `
struct Particle {
  positionRadius: vec4<f32>,
  color: vec4<f32>,
};

struct ProducerParams {
  particleCount: u32,
  _pad0: u32,
  _pad1: u32,
  _pad2: u32,
};

@group(0) @binding(0) var<storage, read> sourceParticles: array<Particle>;
@group(0) @binding(1) var<storage, read_write> outputParticles: array<Particle>;
@group(0) @binding(2) var<uniform> params: ProducerParams;

@compute @workgroup_size(64)
fn csMain(@builtin(global_invocation_id) globalId: vec3<u32>) {
  let index = globalId.x;
  if (index >= params.particleCount) {
    return;
  }
  let source = sourceParticles[index];
  outputParticles[index].positionRadius = vec4<f32>(
    source.positionRadius.xyz,
    max(source.positionRadius.w, 0.000001)
  );
  outputParticles[index].color = vec4<f32>(
    clamp(source.color.rgb, vec3<f32>(0.0), vec3<f32>(1.0)),
    clamp(source.color.a, 0.0, 1.0)
  );
}
`
  });
}

function ensureResidentRenderProducerPipeline() {
  if (
    residentRenderProducerPipeline
    && residentRenderProducerBindGroupLayout
    && residentRenderProducerParamsBuffer
  ) {
    return;
  }
  const shaderModule = createResidentRenderProducerShaderModule();
  residentRenderProducerBindGroupLayout = device.createBindGroupLayout({
    label: 'ulg-offscreen-resident-render-producer-bind-group-layout',
    entries: [
      {
        binding: 0,
        visibility: gpuShaderStage('COMPUTE', SHADER_STAGE_COMPUTE),
        buffer: { type: 'read-only-storage' }
      },
      {
        binding: 1,
        visibility: gpuShaderStage('COMPUTE', SHADER_STAGE_COMPUTE),
        buffer: { type: 'storage' }
      },
      {
        binding: 2,
        visibility: gpuShaderStage('COMPUTE', SHADER_STAGE_COMPUTE),
        buffer: { type: 'uniform' }
      }
    ]
  });
  const pipelineLayout = device.createPipelineLayout({
    label: 'ulg-offscreen-resident-render-producer-pipeline-layout',
    bindGroupLayouts: [residentRenderProducerBindGroupLayout]
  });
  residentRenderProducerPipeline = device.createComputePipeline({
    label: 'ulg-offscreen-resident-render-producer-pipeline',
    layout: pipelineLayout,
    compute: {
      module: shaderModule,
      entryPoint: 'csMain'
    }
  });
  residentRenderProducerParamsBuffer = device.createBuffer({
    label: 'ulg-offscreen-resident-render-producer-params',
    size: 4 * Uint32Array.BYTES_PER_ELEMENT,
    usage: gpuBufferUsage('UNIFORM', BUFFER_USAGE_UNIFORM)
      | gpuBufferUsage('COPY_DST', BUFFER_USAGE_COPY_DST)
  });
}

function ensureResidentRenderProducerSourceBuffer(byteLength) {
  const nextByteLength = Math.max(
    RENDER_ROW_PARTICLE_STRIDE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    Math.ceil(Number(byteLength) || 0)
  );
  if (residentRenderProducerSourceBuffer && residentRenderProducerSourceBufferByteLength >= nextByteLength) {
    return;
  }
  residentRenderProducerSourceBuffer?.destroy?.();
  residentRenderProducerSourceBuffer = device.createBuffer({
    label: 'ulg-offscreen-resident-render-producer-source',
    size: nextByteLength,
    usage: gpuBufferUsage('STORAGE', BUFFER_USAGE_STORAGE)
      | gpuBufferUsage('COPY_DST', BUFFER_USAGE_COPY_DST)
  });
  residentRenderProducerSourceBufferByteLength = nextByteLength;
}

function createResidentParticleStateProducerShaderModule() {
  return device.createShaderModule({
    label: 'ulg-offscreen-resident-particle-state-producer-shader',
    code: `
struct Particle {
  positionRadius: vec4<f32>,
  color: vec4<f32>,
};

struct ColorRow {
  materialPhase: vec4<f32>,
  color: vec4<f32>,
};

struct ParticleStateParams {
  counts: vec4<u32>,
  values: vec4<f32>,
  fallbackColor: vec4<f32>,
};

@group(0) @binding(0) var<storage, read> stateRows: array<f32>;
@group(0) @binding(1) var<storage, read> thermoRows: array<f32>;
@group(0) @binding(2) var<storage, read> colorRows: array<ColorRow>;
@group(0) @binding(3) var<storage, read_write> outputParticles: array<Particle>;
@group(0) @binding(4) var<uniform> params: ParticleStateParams;

fn materialPhaseColor(materialId: f32, phaseId: f32) -> vec4<f32> {
  var color = params.fallbackColor;
  var index = 0u;
  loop {
    if (index >= params.counts.w) {
      break;
    }
    let row = colorRows[index];
    if (abs(row.materialPhase.x - materialId) < 0.5 && abs(row.materialPhase.y - phaseId) < 0.5) {
      color = row.color;
      break;
    }
    index = index + 1u;
  }
  return vec4<f32>(
    clamp(color.rgb, vec3<f32>(0.0), vec3<f32>(1.0)),
    clamp(color.a, 0.0, 1.0)
  );
}

fn radiusFromMassDensity(massKg: f32, restDensityKgPerM3: f32, fallbackRadiusM: f32) -> f32 {
  if (massKg <= 0.0 || restDensityKgPerM3 <= 0.0) {
    return fallbackRadiusM;
  }
  let volumeM3 = massKg / restDensityKgPerM3;
  return pow(max((3.0 * volumeM3) / (4.0 * 3.141592653589793), 0.0), 0.3333333333333333);
}

@compute @workgroup_size(64)
fn csMain(@builtin(global_invocation_id) globalId: vec3<u32>) {
  let index = globalId.x;
  if (index >= params.counts.x) {
    return;
  }
  let stateOffset = index * params.counts.y;
  let thermoOffset = index * params.counts.z;
  let materialId = thermoRows[thermoOffset + 0u];
  let phaseId = thermoRows[thermoOffset + 1u];
  let restDensityKgPerM3 = thermoRows[thermoOffset + 3u];
  let smoothingLengthM = thermoRows[thermoOffset + 8u];
  let visualRadiusM = thermoRows[thermoOffset + 11u];
  let massKg = stateRows[stateOffset + 3u];
  let fallbackRadiusM = max(params.values.x, 0.000001);
  let densityRadiusM = radiusFromMassDensity(massKg, restDensityKgPerM3, fallbackRadiusM);
  var radiusM = select(densityRadiusM, visualRadiusM, visualRadiusM > 0.0);
  if (smoothingLengthM > 0.0) {
    radiusM = min(radiusM, smoothingLengthM * 12.0);
  }
  outputParticles[index].positionRadius = vec4<f32>(
    stateRows[stateOffset + 0u],
    stateRows[stateOffset + 1u],
    stateRows[stateOffset + 2u],
    max(radiusM, 0.000001)
  );
  let color = materialPhaseColor(materialId, phaseId);
  outputParticles[index].color = vec4<f32>(color.rgb, color.a * clamp(params.values.y, 0.0, 1.0));
}
`
  });
}

function ensureResidentParticleStateProducerPipeline() {
  if (
    residentParticleStateProducerPipeline
    && residentParticleStateProducerBindGroupLayout
    && residentParticleStateProducerParamsBuffer
  ) {
    return;
  }
  const shaderModule = createResidentParticleStateProducerShaderModule();
  residentParticleStateProducerBindGroupLayout = device.createBindGroupLayout({
    label: 'ulg-offscreen-resident-particle-state-producer-bind-group-layout',
    entries: [
      {
        binding: 0,
        visibility: gpuShaderStage('COMPUTE', SHADER_STAGE_COMPUTE),
        buffer: { type: 'read-only-storage' }
      },
      {
        binding: 1,
        visibility: gpuShaderStage('COMPUTE', SHADER_STAGE_COMPUTE),
        buffer: { type: 'read-only-storage' }
      },
      {
        binding: 2,
        visibility: gpuShaderStage('COMPUTE', SHADER_STAGE_COMPUTE),
        buffer: { type: 'read-only-storage' }
      },
      {
        binding: 3,
        visibility: gpuShaderStage('COMPUTE', SHADER_STAGE_COMPUTE),
        buffer: { type: 'storage' }
      },
      {
        binding: 4,
        visibility: gpuShaderStage('COMPUTE', SHADER_STAGE_COMPUTE),
        buffer: { type: 'uniform' }
      }
    ]
  });
  const pipelineLayout = device.createPipelineLayout({
    label: 'ulg-offscreen-resident-particle-state-producer-pipeline-layout',
    bindGroupLayouts: [residentParticleStateProducerBindGroupLayout]
  });
  residentParticleStateProducerPipeline = device.createComputePipeline({
    label: 'ulg-offscreen-resident-particle-state-producer-pipeline',
    layout: pipelineLayout,
    compute: {
      module: shaderModule,
      entryPoint: 'csMain'
    }
  });
  residentParticleStateProducerParamsBuffer = device.createBuffer({
    label: 'ulg-offscreen-resident-particle-state-producer-params',
    size: 12 * Float32Array.BYTES_PER_ELEMENT,
    usage: gpuBufferUsage('UNIFORM', BUFFER_USAGE_UNIFORM)
      | gpuBufferUsage('COPY_DST', BUFFER_USAGE_COPY_DST)
  });
}

function ensureResidentParticleStateProducerBuffer(kind, byteLength) {
  const nextByteLength = Math.max(
    Float32Array.BYTES_PER_ELEMENT,
    Math.ceil(Number(byteLength) || 0)
  );
  if (kind === 'state') {
    if (residentParticleStateProducerStateBuffer && residentParticleStateProducerStateBufferByteLength >= nextByteLength) {
      return;
    }
    residentParticleStateProducerStateBuffer?.destroy?.();
    residentParticleStateProducerStateBuffer = device.createBuffer({
      label: 'ulg-offscreen-resident-particle-state-producer-state',
      size: nextByteLength,
      usage: gpuBufferUsage('STORAGE', BUFFER_USAGE_STORAGE)
        | gpuBufferUsage('COPY_DST', BUFFER_USAGE_COPY_DST)
    });
    residentParticleStateProducerStateBufferByteLength = nextByteLength;
    return;
  }
  if (kind === 'thermo') {
    if (residentParticleStateProducerThermoBuffer && residentParticleStateProducerThermoBufferByteLength >= nextByteLength) {
      return;
    }
    residentParticleStateProducerThermoBuffer?.destroy?.();
    residentParticleStateProducerThermoBuffer = device.createBuffer({
      label: 'ulg-offscreen-resident-particle-state-producer-thermo',
      size: nextByteLength,
      usage: gpuBufferUsage('STORAGE', BUFFER_USAGE_STORAGE)
        | gpuBufferUsage('COPY_DST', BUFFER_USAGE_COPY_DST)
    });
    residentParticleStateProducerThermoBufferByteLength = nextByteLength;
    return;
  }
  if (residentParticleStateProducerColorBuffer && residentParticleStateProducerColorBufferByteLength >= nextByteLength) {
    return;
  }
  residentParticleStateProducerColorBuffer?.destroy?.();
  residentParticleStateProducerColorBuffer = device.createBuffer({
    label: 'ulg-offscreen-resident-particle-state-producer-colors',
    size: nextByteLength,
    usage: gpuBufferUsage('STORAGE', BUFFER_USAGE_STORAGE)
      | gpuBufferUsage('COPY_DST', BUFFER_USAGE_COPY_DST)
  });
  residentParticleStateProducerColorBufferByteLength = nextByteLength;
}

function normalizeMatrix(value) {
  if (value instanceof Float32Array && value.length >= 16) return value.slice(0, 16);
  const matrix = new Float32Array(16);
  for (let index = 0; index < 16; index += 1) {
    matrix[index] = Number.isFinite(Number(value?.[index]))
      ? Number(value[index])
      : (index % 5 === 0 ? 1 : 0);
  }
  return matrix;
}

function drawRenderRows(data) {
  if (!presentationStepAccepts(data.sphStep)) {
    return publishRenderRowsStatus({
      status: 'worker-offscreen-presentation-superseded-stale-step',
      reason: `draw carries sphStep ${data.sphStep} older than presented ${lastPresentedSphStep}`,
      sphStep: Number(data.sphStep),
      lastPresentedSphStep: Number(lastPresentedSphStep),
      particleCount: data.particleCount ?? 0,
      inputTransferBytes: 0
    });
  }
  if (!device || !context || !format) {
    publishRenderRowsStatus({
      status: 'worker-offscreen-render-rows-blocked-webgpu-unavailable',
      reason: 'WebGPU device/context is unavailable',
      workerReady: false
    });
    return;
  }
  configureCanvas({
    width: data.width,
    height: data.height,
    nextCssWidth: data.cssWidth,
    nextCssHeight: data.cssHeight,
    nextPixelRatio: data.pixelRatio
  });
  const particleRows = data.particleRows instanceof Float32Array
    ? data.particleRows
    : new Float32Array(data.particleRows || []);
  const particleCount = Math.max(0, Math.floor(Number(data.particleCount) || 0));
  const strideFloats = Math.max(
    RENDER_ROW_PARTICLE_STRIDE_FLOATS,
    Math.floor(Number(data.strideFloats) || RENDER_ROW_PARTICLE_STRIDE_FLOATS)
  );
  if (particleCount <= 0 || particleRows.length < particleCount * strideFloats) {
    clearPresentation({ reason: data.reason || 'draw-render-rows-empty' });
    publishRenderRowsStatus({
      status: 'worker-offscreen-render-rows-skipped-empty',
      reason: data.reason || 'draw-render-rows-empty',
      particleCount: 0,
      inputTransferBytes: particleRows.byteLength
    });
    return;
  }
  backgroundColor = data.backgroundColor || backgroundColor;
  clearAlpha = Number.isFinite(Number(data.clearAlpha)) ? Number(data.clearAlpha) : clearAlpha;
  ensureRenderRowsPipeline();
  ensureRenderRowsParticleBuffer(particleRows.byteLength);
  device.queue.writeBuffer(renderRowsParticleBuffer, 0, particleRows);
  const viewProjection = normalizeMatrix(data.viewProjectionMatrix);
  const uniforms = new Float32Array(24);
  uniforms.set(viewProjection, 0);
  uniforms[16] = Math.max(1, Number(canvas?.width) || Number(data.width) || 1);
  uniforms[17] = Math.max(1, Number(canvas?.height) || Number(data.height) || 1);
  uniforms[18] = Math.max(0, Number(data.radiusScalePx) || 96);
  uniforms[19] = Math.max(0, Number(data.fallbackPointSizePx) || 6);
  uniforms[20] = Math.max(0, Number(data.minPointSizePx) || 2);
  uniforms[21] = Math.max(uniforms[20], Number(data.maxPointSizePx) || 22);
  device.queue.writeBuffer(renderRowsUniformBuffer, 0, uniforms);
  const bindGroup = device.createBindGroup({
    label: 'ulg-offscreen-render-rows-bind-group',
    layout: renderRowsBindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: renderRowsParticleBuffer, size: particleRows.byteLength } },
      { binding: 1, resource: { buffer: renderRowsUniformBuffer } }
    ]
  });
  const encoder = device.createCommandEncoder({ label: 'ulg-offscreen-render-rows-encoder' });
  const pass = encoder.beginRenderPass({
    colorAttachments: [{
      view: context.getCurrentTexture().createView(),
      clearValue: colorToClearValue(backgroundColor, clearAlpha),
      loadOp: 'clear',
      storeOp: 'store'
    }]
  });
  pass.setPipeline(renderRowsPipeline);
  pass.setBindGroup(0, bindGroup);
  pass.draw(6, particleCount, 0, 0);
  pass.end();
  device.queue.submit([encoder.finish()]);
  frameCount += 1;
  notePresentedSphStep(data.sphStep);
  readyFrameCount = frameCount;
  publishRenderRowsStatus({
    status: 'worker-offscreen-render-rows-rendered',
    reason: data.reason || 'draw-render-rows',
    displayOwnerEpoch: Number.isFinite(Number(data.displayOwnerEpoch))
      ? Math.max(0, Math.round(Number(data.displayOwnerEpoch)))
      : null,
    sphStep: Number.isFinite(Number(data.sphStep)) ? Number(data.sphStep) : null,
    particleCount,
    inputTransferBytes: particleRows.byteLength + viewProjection.byteLength,
    inputTransport: data.inputTransport || RENDER_ROWS_INPUT_TRANSPORT,
    particleBufferByteLength: renderRowsParticleBufferByteLength,
    uniformBufferByteLength: renderRowsUniformBuffer.size ?? 0,
    canvasWidth: canvas?.width ?? null,
    canvasHeight: canvas?.height ?? null,
    radiusScalePx: uniforms[18],
    fallbackPointSizePx: uniforms[19],
    minPointSizePx: uniforms[20],
    maxPointSizePx: uniforms[21],
    frameCount,
    readyEver: true,
    readyFrameCount,
    workerReady: true
  });
}

function drawResidentRenderProducer(data) {
  if (!presentationStepAccepts(data.sphStep)) {
    return publishRenderRowsStatus({
      status: 'worker-offscreen-presentation-superseded-stale-step',
      reason: `draw carries sphStep ${data.sphStep} older than presented ${lastPresentedSphStep}`,
      sphStep: Number(data.sphStep),
      lastPresentedSphStep: Number(lastPresentedSphStep),
      particleCount: data.particleCount ?? 0,
      inputTransferBytes: 0
    });
  }
  if (!device || !context || !format) {
    publishRenderRowsStatus({
      status: 'worker-offscreen-resident-render-producer-blocked-webgpu-unavailable',
      reason: 'WebGPU device/context is unavailable',
      inputTransport: RESIDENT_RENDER_PRODUCER_TRANSPORT,
      workerReady: false
    });
    return;
  }
  configureCanvas({
    width: data.width,
    height: data.height,
    nextCssWidth: data.cssWidth,
    nextCssHeight: data.cssHeight,
    nextPixelRatio: data.pixelRatio
  });
  const sourceRows = data.sourceParticleRows instanceof Float32Array
    ? data.sourceParticleRows
    : (
        data.sourceParticleRows
          ? new Float32Array(data.sourceParticleRows)
          : null
      );
  const particleCount = Math.max(0, Math.floor(Number(data.particleCount) || 0));
  const strideFloats = Math.max(
    RENDER_ROW_PARTICLE_STRIDE_FLOATS,
    Math.floor(Number(data.strideFloats) || RENDER_ROW_PARTICLE_STRIDE_FLOATS)
  );
  const sourceCacheKey = data.sourceCacheKey == null ? null : String(data.sourceCacheKey);
  const sourceRowsByteLength = Math.max(0, Math.floor(Number(data.sourceRowsByteLength) || 0));
  const reuseSourceCache = Boolean(data.reuseSourceCache);
  const sourceCacheHit = Boolean(
    reuseSourceCache
    && sourceCacheKey
    && residentRenderProducerSourceBuffer
    && residentRenderProducerSourceCacheKey === sourceCacheKey
    && residentRenderProducerSourceParticleCount === particleCount
    && residentRenderProducerSourceStrideFloats === strideFloats
    && residentRenderProducerSourceRowsByteLength === sourceRowsByteLength
    && residentRenderProducerSourceRowsByteLength >= particleCount * strideFloats * 4
  );
  const sourceRowsAvailable = sourceRows && sourceRows.length >= particleCount * strideFloats;
  if (particleCount <= 0 || (!sourceCacheHit && !sourceRowsAvailable)) {
    clearPresentation({ reason: data.reason || 'draw-resident-render-producer-empty' });
    publishRenderRowsStatus({
      schema: RESIDENT_RENDER_PRODUCER_SCHEMA,
      renderRowsSchema: RENDER_ROWS_SCHEMA,
      status: reuseSourceCache
        ? 'worker-offscreen-resident-render-producer-blocked-source-cache-miss'
        : 'worker-offscreen-resident-render-producer-skipped-empty',
      reason: reuseSourceCache
        ? 'requested source cache reuse without a matching worker-resident source buffer'
        : (data.reason || 'draw-resident-render-producer-empty'),
      inputTransport: RESIDENT_RENDER_PRODUCER_TRANSPORT,
      particleCount: particleCount > 0 ? particleCount : 0,
      inputTransferBytes: sourceRows?.byteLength || 0,
      sourceCacheKey,
      sourceCacheStatus: reuseSourceCache ? 'source-cache-miss' : 'source-cache-empty',
      sourceCacheHit: false,
      sourceRowsPacked: data.sourceRowsPacked ?? false,
      sourceTransferBytes: 0,
      producerSourceTransport: reuseSourceCache
        ? 'worker-resident-source-cache'
        : 'main-thread-visual-source-transfer'
    });
    return;
  }
  backgroundColor = data.backgroundColor || backgroundColor;
  clearAlpha = Number.isFinite(Number(data.clearAlpha)) ? Number(data.clearAlpha) : clearAlpha;
  ensureRenderRowsPipeline();
  ensureResidentRenderProducerPipeline();
  const activeSourceByteLength = sourceCacheHit
    ? residentRenderProducerSourceRowsByteLength
    : sourceRows.byteLength;
  ensureResidentRenderProducerSourceBuffer(activeSourceByteLength);
  ensureRenderRowsParticleBuffer(activeSourceByteLength);
  if (!sourceCacheHit) {
    device.queue.writeBuffer(residentRenderProducerSourceBuffer, 0, sourceRows);
    residentRenderProducerSourceCacheKey = sourceCacheKey;
    residentRenderProducerSourceParticleCount = particleCount;
    residentRenderProducerSourceStrideFloats = strideFloats;
    residentRenderProducerSourceRowsByteLength = sourceRows.byteLength;
  }
  device.queue.writeBuffer(
    residentRenderProducerParamsBuffer,
    0,
    new Uint32Array([particleCount, 0, 0, 0])
  );
  const viewProjection = normalizeMatrix(data.viewProjectionMatrix);
  const uniforms = new Float32Array(24);
  uniforms.set(viewProjection, 0);
  uniforms[16] = Math.max(1, Number(canvas?.width) || Number(data.width) || 1);
  uniforms[17] = Math.max(1, Number(canvas?.height) || Number(data.height) || 1);
  uniforms[18] = Math.max(0, Number(data.radiusScalePx) || 96);
  uniforms[19] = Math.max(0, Number(data.fallbackPointSizePx) || 6);
  uniforms[20] = Math.max(0, Number(data.minPointSizePx) || 2);
  uniforms[21] = Math.max(uniforms[20], Number(data.maxPointSizePx) || 22);
  device.queue.writeBuffer(renderRowsUniformBuffer, 0, uniforms);
  const producerBindGroup = device.createBindGroup({
    label: 'ulg-offscreen-resident-render-producer-bind-group',
    layout: residentRenderProducerBindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: residentRenderProducerSourceBuffer, size: activeSourceByteLength } },
      { binding: 1, resource: { buffer: renderRowsParticleBuffer, size: activeSourceByteLength } },
      { binding: 2, resource: { buffer: residentRenderProducerParamsBuffer } }
    ]
  });
  const renderBindGroup = device.createBindGroup({
    label: 'ulg-offscreen-resident-render-producer-render-bind-group',
    layout: renderRowsBindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: renderRowsParticleBuffer, size: activeSourceByteLength } },
      { binding: 1, resource: { buffer: renderRowsUniformBuffer } }
    ]
  });
  const encoder = device.createCommandEncoder({ label: 'ulg-offscreen-resident-render-producer-encoder' });
  const computePass = encoder.beginComputePass({
    label: 'ulg-offscreen-resident-render-producer-compute-pass'
  });
  computePass.setPipeline(residentRenderProducerPipeline);
  computePass.setBindGroup(0, producerBindGroup);
  computePass.dispatchWorkgroups(Math.max(1, Math.ceil(particleCount / 64)));
  computePass.end();
  const renderPass = encoder.beginRenderPass({
    colorAttachments: [{
      view: context.getCurrentTexture().createView(),
      clearValue: colorToClearValue(backgroundColor, clearAlpha),
      loadOp: 'clear',
      storeOp: 'store'
    }]
  });
  renderPass.setPipeline(renderRowsPipeline);
  renderPass.setBindGroup(0, renderBindGroup);
  renderPass.draw(6, particleCount, 0, 0);
  renderPass.end();
  device.queue.submit([encoder.finish()]);
  frameCount += 1;
  notePresentedSphStep(data.sphStep);
  readyFrameCount = frameCount;
  publishRenderRowsStatus({
    schema: RESIDENT_RENDER_PRODUCER_SCHEMA,
    renderRowsSchema: RENDER_ROWS_SCHEMA,
    status: 'worker-offscreen-resident-render-producer-rendered',
    reason: data.reason || 'draw-resident-render-producer',
    displayOwnerEpoch: Number.isFinite(Number(data.displayOwnerEpoch))
      ? Math.max(0, Math.round(Number(data.displayOwnerEpoch)))
      : null,
    sphStep: Number.isFinite(Number(data.sphStep)) ? Number(data.sphStep) : null,
    particleCount,
    inputTransferBytes: (sourceCacheHit ? 0 : activeSourceByteLength) + viewProjection.byteLength,
    inputTransport: data.inputTransport || RESIDENT_RENDER_PRODUCER_TRANSPORT,
    sourceCacheKey,
    sourceCacheStatus: sourceCacheHit ? 'source-cache-reused' : 'source-cache-uploaded',
    sourceCacheHit,
    sourceRowsPacked: data.sourceRowsPacked ?? !sourceCacheHit,
    sourceTransferBytes: sourceCacheHit ? 0 : activeSourceByteLength,
    producerSourceTransport: sourceCacheHit
      ? 'worker-resident-source-cache'
      : 'main-thread-visual-source-transfer',
    workerLocalRenderRowsProduced: true,
    workerLocalRenderRowsBufferByteLength: renderRowsParticleBufferByteLength,
    particleBufferByteLength: renderRowsParticleBufferByteLength,
    producerSourceBufferByteLength: residentRenderProducerSourceBufferByteLength,
    producerParamsBufferByteLength: residentRenderProducerParamsBuffer.size ?? 0,
    uniformBufferByteLength: renderRowsUniformBuffer.size ?? 0,
    canvasWidth: canvas?.width ?? null,
    canvasHeight: canvas?.height ?? null,
    radiusScalePx: uniforms[18],
    fallbackPointSizePx: uniforms[19],
    minPointSizePx: uniforms[20],
    maxPointSizePx: uniforms[21],
    frameCount,
    readyEver: true,
    readyFrameCount,
    workerReady: true
  });
}

function drawResidentParticleStateProducer(data) {
  if (!presentationStepAccepts(data.sphStep)) {
    return publishRenderRowsStatus({
      status: 'worker-offscreen-presentation-superseded-stale-step',
      reason: `draw carries sphStep ${data.sphStep} older than presented ${lastPresentedSphStep}`,
      sphStep: Number(data.sphStep),
      lastPresentedSphStep: Number(lastPresentedSphStep),
      particleCount: data.particleCount ?? 0,
      inputTransferBytes: 0
    });
  }
  if (!device || !context || !format) {
    publishRenderRowsStatus({
      schema: RESIDENT_PARTICLE_STATE_PRODUCER_SCHEMA,
      renderRowsSchema: RENDER_ROWS_SCHEMA,
      status: 'worker-offscreen-resident-particle-state-producer-blocked-webgpu-unavailable',
      reason: 'WebGPU device/context is unavailable',
      inputTransport: RESIDENT_RENDER_PRODUCER_TRANSPORT,
      workerReady: false
    });
    return;
  }
  configureCanvas({
    width: data.width,
    height: data.height,
    nextCssWidth: data.cssWidth,
    nextCssHeight: data.cssHeight,
    nextPixelRatio: data.pixelRatio
  });
  const particleCount = Math.max(0, Math.floor(Number(data.particleCount) || 0));
  const stateStrideFloats = Math.max(1, Math.floor(Number(data.stateStrideFloats) || 8));
  const thermoStrideFloats = Math.max(12, Math.floor(Number(data.thermoStrideFloats) || 12));
  const stateByteLength = Math.max(0, Math.floor(Number(data.stateByteLength) || 0));
  const thermoByteLength = Math.max(0, Math.floor(Number(data.thermoByteLength) || 0));
  const colorRowsByteLength = Math.max(0, Math.floor(Number(data.colorRowsByteLength) || 0));
  const colorRowCount = Math.max(0, Math.floor(Number(data.colorRowCount) || 0));
  const sourceCacheKey = data.sourceCacheKey == null ? null : String(data.sourceCacheKey);
  const reuseSourceCache = Boolean(data.reuseSourceCache);
  const sourceStateBuffer = isGpuBufferLike(data.sourceStateBuffer) ? data.sourceStateBuffer : null;
  const sourceThermoBuffer = isGpuBufferLike(data.sourceThermoBuffer) ? data.sourceThermoBuffer : null;
  const workerRetainedStageOutputSource = Boolean(sourceStateBuffer && sourceThermoBuffer);
  const sourceCacheHit = Boolean(
    !workerRetainedStageOutputSource
    && reuseSourceCache
    && sourceCacheKey
    && residentParticleStateProducerStateBuffer
    && residentParticleStateProducerThermoBuffer
    && residentParticleStateProducerColorBuffer
    && residentParticleStateProducerCacheKey === sourceCacheKey
    && residentParticleStateProducerParticleCount === particleCount
    && residentParticleStateProducerStateStrideFloats === stateStrideFloats
    && residentParticleStateProducerThermoStrideFloats === thermoStrideFloats
    && residentParticleStateProducerStateRowsByteLength === stateByteLength
    && residentParticleStateProducerThermoRowsByteLength === thermoByteLength
    && residentParticleStateProducerColorRowsByteLength === colorRowsByteLength
    && stateByteLength >= particleCount * stateStrideFloats * 4
    && thermoByteLength >= particleCount * thermoStrideFloats * 4
  );
  const sourceState = data.sourceState instanceof Float32Array
    ? data.sourceState
    : (data.sourceState ? new Float32Array(data.sourceState) : null);
  const sourceThermo = data.sourceThermo instanceof Float32Array
    ? data.sourceThermo
    : (data.sourceThermo ? new Float32Array(data.sourceThermo) : null);
  const materialColorRows = data.materialColorRows instanceof Float32Array
    ? data.materialColorRows
    : (data.materialColorRows ? new Float32Array(data.materialColorRows) : null);
  const sourceStateAvailable = workerRetainedStageOutputSource
    || (sourceState && sourceState.byteLength >= stateByteLength);
  const sourceThermoAvailable = workerRetainedStageOutputSource
    || (sourceThermo && sourceThermo.byteLength >= thermoByteLength);
  if (particleCount <= 0 || (!sourceCacheHit && (!sourceStateAvailable || !sourceThermoAvailable))) {
    clearPresentation({ reason: data.reason || 'draw-resident-particle-state-producer-empty' });
    return publishRenderRowsStatus({
      schema: RESIDENT_PARTICLE_STATE_PRODUCER_SCHEMA,
      renderRowsSchema: RENDER_ROWS_SCHEMA,
      status: reuseSourceCache
        ? 'worker-offscreen-resident-particle-state-producer-blocked-source-cache-miss'
        : 'worker-offscreen-resident-particle-state-producer-skipped-empty',
      reason: reuseSourceCache
        ? 'requested resident particle-state cache reuse without matching worker-resident state buffers'
        : (data.reason || 'draw-resident-particle-state-producer-empty'),
      inputTransport: RESIDENT_RENDER_PRODUCER_TRANSPORT,
      producerSourceKind: 'worker-resident-particle-state',
      producerSourceTransport: reuseSourceCache
        ? RESIDENT_PARTICLE_STATE_CACHE_TRANSPORT
        : RESIDENT_PARTICLE_STATE_TRANSPORT,
      particleCount: particleCount > 0 ? particleCount : 0,
      inputTransferBytes: sourceState?.byteLength || 0,
      sourceCacheKey,
      sourceCacheStatus: reuseSourceCache
        ? 'resident-particle-state-cache-miss'
        : 'resident-particle-state-empty',
      sourceCacheKeyStrategy: data.sourceCacheKeyStrategy ?? null,
      sourceCpuStateStale: data.sourceCpuStateStale ?? null,
      sourceCacheMissReason: data.sourceCacheMissReason ?? null,
      sourceCacheHit: false,
      sourceRowsPacked: false,
      sourceTransferBytes: 0,
      sourceStateTransferBytes: 0
    });
  }
  backgroundColor = data.backgroundColor || backgroundColor;
  clearAlpha = Number.isFinite(Number(data.clearAlpha)) ? Number(data.clearAlpha) : clearAlpha;
  ensureRenderRowsPipeline();
  ensureResidentParticleStateProducerPipeline();
  const outputByteLength = particleCount
    * RENDER_ROW_PARTICLE_STRIDE_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  ensureRenderRowsParticleBuffer(outputByteLength);
  if (!workerRetainedStageOutputSource) {
    ensureResidentParticleStateProducerBuffer('state', stateByteLength);
    ensureResidentParticleStateProducerBuffer('thermo', thermoByteLength);
  }
  ensureResidentParticleStateProducerBuffer('color', Math.max(
    colorRowsByteLength,
    RESIDENT_PARTICLE_STATE_COLOR_ROW_FLOATS * Float32Array.BYTES_PER_ELEMENT
  ));
  if (!sourceCacheHit && !workerRetainedStageOutputSource) {
    device.queue.writeBuffer(residentParticleStateProducerStateBuffer, 0, sourceState);
    device.queue.writeBuffer(residentParticleStateProducerThermoBuffer, 0, sourceThermo);
    const colors = materialColorRows && materialColorRows.length > 0
      ? materialColorRows
      : new Float32Array(RESIDENT_PARTICLE_STATE_COLOR_ROW_FLOATS);
    device.queue.writeBuffer(residentParticleStateProducerColorBuffer, 0, colors);
    residentParticleStateProducerCacheKey = sourceCacheKey;
    residentParticleStateProducerParticleCount = particleCount;
    residentParticleStateProducerStateStrideFloats = stateStrideFloats;
    residentParticleStateProducerThermoStrideFloats = thermoStrideFloats;
    residentParticleStateProducerStateRowsByteLength = stateByteLength;
    residentParticleStateProducerThermoRowsByteLength = thermoByteLength;
    residentParticleStateProducerColorRowsByteLength = colorRowsByteLength;
  }
  if (workerRetainedStageOutputSource) {
    const colors = materialColorRows && materialColorRows.length > 0
      ? materialColorRows
      : new Float32Array(RESIDENT_PARTICLE_STATE_COLOR_ROW_FLOATS);
    device.queue.writeBuffer(residentParticleStateProducerColorBuffer, 0, colors);
    residentParticleStateProducerColorRowsByteLength = colorRowsByteLength;
  }
  const paramsBuffer = new ArrayBuffer(12 * Float32Array.BYTES_PER_ELEMENT);
  const paramsU32 = new Uint32Array(paramsBuffer);
  const paramsF32 = new Float32Array(paramsBuffer);
  paramsU32[0] = particleCount;
  paramsU32[1] = stateStrideFloats;
  paramsU32[2] = thermoStrideFloats;
  paramsU32[3] = sourceCacheHit
    ? Math.floor(residentParticleStateProducerColorRowsByteLength / (RESIDENT_PARTICLE_STATE_COLOR_ROW_FLOATS * 4))
    : colorRowCount;
  paramsF32[4] = Math.max(0.000001, Number(data.fallbackRadiusM) || 0.02);
  paramsF32[5] = Math.max(0, Math.min(1, Number(data.alpha) || 0.92));
  paramsF32[6] = 0;
  paramsF32[7] = 0;
  paramsF32[8] = Math.max(0, Math.min(1, Number(data.fallbackColorRgb?.[0]) || 1));
  paramsF32[9] = Math.max(0, Math.min(1, Number(data.fallbackColorRgb?.[1]) || 1));
  paramsF32[10] = Math.max(0, Math.min(1, Number(data.fallbackColorRgb?.[2]) || 1));
  paramsF32[11] = 1;
  device.queue.writeBuffer(residentParticleStateProducerParamsBuffer, 0, paramsBuffer);

  const viewProjection = normalizeMatrix(data.viewProjectionMatrix);
  const uniforms = new Float32Array(24);
  uniforms.set(viewProjection, 0);
  uniforms[16] = Math.max(1, Number(canvas?.width) || Number(data.width) || 1);
  uniforms[17] = Math.max(1, Number(canvas?.height) || Number(data.height) || 1);
  uniforms[18] = Math.max(0, Number(data.radiusScalePx) || 96);
  uniforms[19] = Math.max(0, Number(data.fallbackPointSizePx) || 6);
  uniforms[20] = Math.max(0, Number(data.minPointSizePx) || 2);
  uniforms[21] = Math.max(uniforms[20], Number(data.maxPointSizePx) || 22);
  device.queue.writeBuffer(renderRowsUniformBuffer, 0, uniforms);

  const producerBindGroup = device.createBindGroup({
    label: 'ulg-offscreen-resident-particle-state-producer-bind-group',
    layout: residentParticleStateProducerBindGroupLayout,
    entries: [
      {
        binding: 0,
        resource: {
          buffer: workerRetainedStageOutputSource ? sourceStateBuffer : residentParticleStateProducerStateBuffer,
          size: stateByteLength
        }
      },
      {
        binding: 1,
        resource: {
          buffer: workerRetainedStageOutputSource ? sourceThermoBuffer : residentParticleStateProducerThermoBuffer,
          size: thermoByteLength
        }
      },
      {
        binding: 2,
        resource: {
          buffer: residentParticleStateProducerColorBuffer,
          size: Math.max(RESIDENT_PARTICLE_STATE_COLOR_ROW_FLOATS * 4, colorRowsByteLength)
        }
      },
      { binding: 3, resource: { buffer: renderRowsParticleBuffer, size: outputByteLength } },
      { binding: 4, resource: { buffer: residentParticleStateProducerParamsBuffer } }
    ]
  });
  const renderBindGroup = device.createBindGroup({
    label: 'ulg-offscreen-resident-particle-state-producer-render-bind-group',
    layout: renderRowsBindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: renderRowsParticleBuffer, size: outputByteLength } },
      { binding: 1, resource: { buffer: renderRowsUniformBuffer } }
    ]
  });
  const encoder = device.createCommandEncoder({ label: 'ulg-offscreen-resident-particle-state-producer-encoder' });
  const computePass = encoder.beginComputePass({
    label: 'ulg-offscreen-resident-particle-state-producer-compute-pass'
  });
  computePass.setPipeline(residentParticleStateProducerPipeline);
  computePass.setBindGroup(0, producerBindGroup);
  computePass.dispatchWorkgroups(Math.max(1, Math.ceil(particleCount / 64)));
  computePass.end();
  const renderPass = encoder.beginRenderPass({
    colorAttachments: [{
      view: context.getCurrentTexture().createView(),
      clearValue: colorToClearValue(backgroundColor, clearAlpha),
      loadOp: 'clear',
      storeOp: 'store'
    }]
  });
  renderPass.setPipeline(renderRowsPipeline);
  renderPass.setBindGroup(0, renderBindGroup);
  renderPass.draw(6, particleCount, 0, 0);
  renderPass.end();
  device.queue.submit([encoder.finish()]);
  frameCount += 1;
  notePresentedSphStep(data.sphStep);
  readyFrameCount = frameCount;
  const sourceStateTransferBytes = (sourceCacheHit || workerRetainedStageOutputSource)
    ? 0
    : stateByteLength + thermoByteLength + colorRowsByteLength;
  const inputTransferBytes = workerRetainedStageOutputSource
    ? viewProjection.byteLength + colorRowsByteLength
    : sourceStateTransferBytes + viewProjection.byteLength;
  return publishRenderRowsStatus({
    schema: RESIDENT_PARTICLE_STATE_PRODUCER_SCHEMA,
    renderRowsSchema: RENDER_ROWS_SCHEMA,
    status: 'worker-offscreen-resident-particle-state-producer-rendered',
    reason: data.reason || 'draw-resident-particle-state-producer',
    displayOwnerEpoch: Number.isFinite(Number(data.displayOwnerEpoch))
      ? Math.max(0, Math.round(Number(data.displayOwnerEpoch)))
      : null,
    sphStep: Number.isFinite(Number(data.sphStep)) ? Number(data.sphStep) : null,
    particleCount,
    inputTransferBytes,
    inputTransport: data.inputTransport || RESIDENT_RENDER_PRODUCER_TRANSPORT,
    producerSourceKind: data.producerSourceKind || 'worker-resident-particle-state',
    producerSourceTransport: data.producerSourceTransport || (
      sourceCacheHit
        ? RESIDENT_PARTICLE_STATE_CACHE_TRANSPORT
        : RESIDENT_PARTICLE_STATE_TRANSPORT
    ),
    sourceStageId: data.sourceStageId || null,
    retainedParticleStateStatus: data.retainedParticleStateStatus || null,
    sourceCacheKey,
    sourceCacheStatus: data.sourceCacheStatus || (
      sourceCacheHit
        ? 'resident-particle-state-cache-reused'
        : 'resident-particle-state-uploaded'
    ),
    sourceCacheKeyStrategy: data.sourceCacheKeyStrategy ?? null,
    sourceCpuStateStale: data.sourceCpuStateStale ?? null,
    sourceCacheMissReason: sourceCacheHit ? null : (data.sourceCacheMissReason ?? null),
    sourceCacheHit,
    sourceRowsPacked: false,
    sourceTransferBytes: 0,
    sourceStateTransferBytes,
    workerLocalRenderRowsProduced: true,
    workerLocalRenderRowsBufferByteLength: renderRowsParticleBufferByteLength,
    particleBufferByteLength: renderRowsParticleBufferByteLength,
    producerStateBufferByteLength: workerRetainedStageOutputSource
      ? stateByteLength
      : residentParticleStateProducerStateBufferByteLength,
    producerThermoBufferByteLength: workerRetainedStageOutputSource
      ? thermoByteLength
      : residentParticleStateProducerThermoBufferByteLength,
    producerColorBufferByteLength: residentParticleStateProducerColorBufferByteLength,
    producerParamsBufferByteLength: residentParticleStateProducerParamsBuffer.size ?? 0,
    uniformBufferByteLength: renderRowsUniformBuffer.size ?? 0,
    canvasWidth: canvas?.width ?? null,
    canvasHeight: canvas?.height ?? null,
    radiusScalePx: uniforms[18],
    fallbackPointSizePx: uniforms[19],
    minPointSizePx: uniforms[20],
    maxPointSizePx: uniforms[21],
    frameCount,
    readyEver: true,
    readyFrameCount,
    workerReady: true
  });
}

async function initPresentation(data) {
  canvas = data.canvas || null;
  backgroundColor = data.backgroundColor || backgroundColor;
  clearAlpha = Number.isFinite(Number(data.clearAlpha)) ? Number(data.clearAlpha) : clearAlpha;
  cssWidth = Number(data.cssWidth) || 0;
  cssHeight = Number(data.cssHeight) || 0;
  pixelRatio = Number(data.pixelRatio) || 1;
  if (!canvas?.getContext) {
    publish({
      status: 'worker-offscreen-presentation-blocked-canvas-unavailable',
      reason: 'transferred OffscreenCanvas is unavailable',
      workerReady: false
    });
    return;
  }
  gpu = self.navigator?.gpu || null;
  if (!gpu?.requestAdapter || !gpu?.getPreferredCanvasFormat) {
    publish({
      status: 'worker-offscreen-presentation-blocked-webgpu-unavailable',
      reason: 'Worker navigator.gpu is unavailable',
      workerReady: false
    });
    return;
  }
  context = canvas.getContext('webgpu');
  if (!context) {
    publish({
      status: 'worker-offscreen-presentation-blocked-context-unavailable',
      reason: 'OffscreenCanvas.getContext("webgpu") returned null',
      workerReady: false
    });
    return;
  }
  adapter = await gpu.requestAdapter();
  if (!adapter) {
    publish({
      status: 'worker-offscreen-presentation-blocked-adapter-unavailable',
      reason: 'Worker WebGPU adapter request returned null',
      workerReady: false
    });
    return;
  }
  device = await adapter.requestDevice();
  format = gpu.getPreferredCanvasFormat();
  configureCanvas({
    width: data.width,
    height: data.height,
    nextCssWidth: data.cssWidth,
    nextCssHeight: data.cssHeight,
    nextPixelRatio: data.pixelRatio
  });
  device.lost?.then?.((info) => {
    publish({
      status: disposed
        ? 'worker-offscreen-presentation-device-destroyed-after-dispose'
        : 'worker-offscreen-presentation-device-lost',
      reason: info?.message || info?.reason || 'Worker WebGPU device lost',
      workerReady: false
    });
  }).catch?.((error) => {
    publish({
      status: 'worker-offscreen-presentation-device-lost-watch-error',
      reason: error instanceof Error ? error.message : String(error),
      workerReady: Boolean(device && context)
    });
  });
  clearPresentation({ reason: 'init-offscreen-presentation' });
}

self.onmessage = (event) => {
  const data = event?.data || {};
  Promise.resolve().then(async () => {
    if (data.type === 'init-offscreen-presentation') {
      resetPresentedSphStep();
      await initPresentation(data);
      return;
    }
    if (data.type === 'resize') {
      configureCanvas({
        width: data.width,
        height: data.height,
        nextCssWidth: data.cssWidth,
        nextCssHeight: data.cssHeight,
        nextPixelRatio: data.pixelRatio
      });
      clearPresentation({ reason: data.reason || 'resize' });
      return;
    }
    if (data.type === 'clear') {
      resetPresentedSphStep();
      backgroundColor = data.backgroundColor || backgroundColor;
      clearAlpha = Number.isFinite(Number(data.clearAlpha)) ? Number(data.clearAlpha) : clearAlpha;
      clearPresentation({ reason: data.reason || 'clear' });
      return;
    }
    if (data.type === 'draw-render-rows') {
      drawRenderRows(data);
      return;
    }
    if (data.type === 'draw-resident-render-producer') {
      drawResidentRenderProducer(data);
      return;
    }
    if (data.type === 'draw-resident-particle-state-producer') {
      drawResidentParticleStateProducer(data);
      return;
    }
    if (data.type === 'run-resident-stage-on-presentation-device') {
      await runResidentStageOnPresentationDevice(data);
      return;
    }
    if (data.type === 'export-retained-compact-snapshot') {
      await exportRetainedCompactSnapshotFromPresentationDevice(data);
      return;
    }
    if (data.type === 'dispose') {
      disposed = true;
      destroyRenderRowsResources();
      context?.unconfigure?.();
      device?.destroy?.();
      publish({
        status: 'worker-offscreen-presentation-disposed',
        reason: data.reason || 'dispose',
        workerReady: false
      });
      self.close?.();
    }
  }).catch((error) => {
    publish({
      status: 'worker-offscreen-presentation-error',
      reason: error instanceof Error ? error.message : String(error),
      workerReady: false
    });
  });
};
