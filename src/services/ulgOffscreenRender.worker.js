import {
  createResidentRenderCandidateMailbox,
  ULG_RESIDENT_RENDER_CANDIDATE_SCHEMA,
  ULG_RESIDENT_RENDER_CANDIDATE_EPOCH_IDENTITY_WORD_FIELDS
} from '../visualization/residentRenderCandidateMailbox.js';
import {
  webGpuDeviceDescriptorForResidentSph
} from '../runtime/webgpuDeviceLimits.js';
import {
  flushWorkerQueueSubmitBurst
} from '../runtime/webgpuComputeLayout.js';
import {
  ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS,
  createWorkerOwnedIsosurfacePresenter
} from './workerOwnedIsosurfacePresenter.js';
import {
  ULG_WORKER_PRESENTATION_FRAME_QUEUE_COMPLETION_SCOPE,
  ULG_WORKER_PRESENTATION_PHYSICS_PREFIX_INCLUDED,
  ULG_WORKER_PRESENTATION_PHYSICS_PREFIX_NOT_ATTRIBUTED,
  ULG_WORKER_TIER0_PRESENTATION_QOS_BOUNDARY_PROOF_SCHEMA,
  ULG_WORKER_TIER0_PRESENTATION_QOS_BOUNDARY_PROOF_STATUS,
  isExactWorkerPresentationFrameQueueCompletionProof
} from '../runtime/sph/sphWorkerPresentationQos.js';

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
const PRESENTATION_WORKER_RESIDENT_SCHEDULE_CANCEL_SCHEMA =
  'peercompute.ulg.presentation-worker-resident-schedule-cancel.v0';
const PRESENTATION_WORKER_COMMITTED_RESIDENT_SCHEDULE_PRESENTATION_SCHEMA =
  'peercompute.ulg.presentation-worker-committed-resident-schedule-presentation.v0';
const WORKER_LANE_COMPUTE_MANAGER_COMPLETION_SCHEMA =
  'peercompute.ulg.schroeder-worker-lane-compute-manager-completion.v0';
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
const RESIDENT_PARTICLE_TEMPORAL_MOTION_SCHEMA =
  'peercompute.ulg.worker-offscreen-particle-temporal-motion.v0';
const RESIDENT_PARTICLE_TEMPORAL_MOTION_FRAME_SCHEMA =
  'peercompute.ulg.worker-offscreen-particle-temporal-motion-frame.v0';
const RESIDENT_PARTICLE_KEYFRAME_PRESENTATION_FRAME_SCHEMA =
  'peercompute.ulg.worker-offscreen-particle-keyframe-presentation-frame.v0';
const DEFAULT_PARTICLE_TEMPORAL_TARGET_HZ = 60;
const DEFAULT_PARTICLE_TEMPORAL_MAX_HORIZON_S = 0.25;
const WORKER_PRESENTATION_DEPTH_FORMAT = 'depth24plus';
const GAS_PHASE_ID = 3;
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
// GPUCanvasContext.configure() recreates presentation resources. Repeating it
// for every resident candidate needlessly churns the Dawn/Vulkan surface while
// the same device queue is still carrying canonical compute work. Keep the
// exact active configuration and reconfigure only when one of its inputs (or
// the canvas backing size) actually changes.
let canvasConfiguration = null;
let canvasConfigureCount = 0;
let canvasConfigureSkipCount = 0;
let canvasUnconfigureCount = 0;
let lastCanvasConfigureAction = 'unavailable';
let lastCanvasConfigureReason = null;
// The page owns the identity of the actual worker framebuffer. Every resize,
// clear, or destructive owner handoff advances this epoch before the command is
// posted. A render may advertise pixels only when the epoch captured at its
// queue submission is still current after the GPU fence and presentation edge.
let workerFramebufferEpoch = 0;
// init waits on adapter/device acquisition, while resize messages may arrive in
// the meantime. Retain the newest requested canvas geometry so the resumed init
// cannot restore stale pre-resize dimensions.
let desiredCanvasConfiguration = null;
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
let renderRowsVaporPipeline = null;
let renderRowsBindGroupLayout = null;
let renderRowsParticleBuffer = null;
let renderRowsParticleBufferByteLength = 0;
let renderRowsParticleVelocityBuffer = null;
let renderRowsParticleVelocityBufferByteLength = 0;
let renderRowsUniformBuffer = null;
let renderDepthTexture = null;
let renderDepthView = null;
let renderDepthTextureWidth = 0;
let renderDepthTextureHeight = 0;
let renderBoxPipeline = null;
let renderBoxBindGroupLayout = null;
let renderBoxUniformBuffer = null;
let renderBoxBindGroup = null;
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
// A terminal candidate is retained until the page proves that the exact
// schedule crossed BOTH authority boundaries: the worker terminal queue fence
// and the NodeKernel/ComputeManager/StateManager commit. Progress candidates
// remain mailbox telemetry only and can never reach the draw loop.
let pendingCommittedResidentSchedulePresentation = null;
// Live-preview camera channel: the page streams the current view-projection
// while the worker canvas owns the display; candidate draws prefer it over
// the matrix frozen into the schedule's render request, and camera updates
// redraw the freshest candidate without waiting for new physics.
let previewViewProjectionOverride = null;
let previewCameraRedraw = null;
let previewCameraRedrawLastMs = 0;
let workerOwnedIsosurfacePresenter = null;
let workerParticleTemporalPresentation = null;
let workerParticleTemporalAnimationHandle = null;
let workerParticleTemporalAnimationHandleKind = null;
let workerParticleTemporalGeneration = 0;
let workerParticleTemporalMotionFrameSerial = 0;
let workerParticleTemporalSubmittedFrameSerial = 0;
let workerParticleTemporalFrameInFlight = null;
let workerPresentationQueueCompletionSerial = 0;
let workerParticleTemporalBoundaryPending = false;
let workerParticleTemporalAuthorityAdmissionPending = false;
let residentScheduleCandidateStreamIdentity = null;
let residentScheduleCandidateStreamEpoch = 0;

function normalizeWorkerFramebufferEpoch(value) {
  const epoch = Number(value);
  return Number.isSafeInteger(epoch) && epoch > 0 ? epoch : null;
}

function adoptWorkerFramebufferEpoch(value) {
  const epoch = normalizeWorkerFramebufferEpoch(value);
  if (epoch == null || epoch < workerFramebufferEpoch) return false;
  workerFramebufferEpoch = epoch;
  return true;
}

function workerFramebufferEpochIsCurrent(epoch) {
  return normalizeWorkerFramebufferEpoch(epoch) === workerFramebufferEpoch;
}

function submittedWorkerFramebufferEpoch(data = null) {
  const requestedEpoch = normalizeWorkerFramebufferEpoch(
    data?.workerFramebufferEpoch
  );
  return requestedEpoch === workerFramebufferEpoch ? requestedEpoch : null;
}

function currentWorkerFramebufferEpoch() {
  return normalizeWorkerFramebufferEpoch(workerFramebufferEpoch);
}

function rememberDesiredCanvasConfiguration(data = {}) {
  const messageEpoch = normalizeWorkerFramebufferEpoch(
    data.workerFramebufferEpoch
  );
  if (
    messageEpoch != null
    && messageEpoch !== workerFramebufferEpoch
  ) return false;
  desiredCanvasConfiguration = {
    width: data.width,
    height: data.height,
    cssWidth: data.cssWidth,
    cssHeight: data.cssHeight,
    pixelRatio: data.pixelRatio
  };
  return true;
}

function nowMs() {
  return typeof self.performance?.now === 'function' ? self.performance.now() : Date.now();
}

export function retainHandledPromiseForLaterJoin(value) {
  const retained = Promise.resolve(value);
  // Register rejection handling in the same turn that starts the work. Keep
  // the original promise so a later authority join still observes failure.
  void retained.catch(() => {});
  return retained;
}

export function normalizeWorkerParticleTemporalMotionRequest(value = null) {
  if (value?.schema !== RESIDENT_PARTICLE_TEMPORAL_MOTION_SCHEMA) return null;
  if (value.enabled !== true) return null;
  const targetHz = Math.max(
    1,
    Math.min(
      240,
      Number.isFinite(Number(value.targetHz))
        ? Number(value.targetHz)
        : DEFAULT_PARTICLE_TEMPORAL_TARGET_HZ
    )
  );
  const maxHorizonS = Math.max(
    1 / targetHz,
    Math.min(
      1,
      Number.isFinite(Number(value.maxHorizonS))
        ? Number(value.maxHorizonS)
        : DEFAULT_PARTICLE_TEMPORAL_MAX_HORIZON_S
    )
  );
  const maxDisplacementM = Number(value.maxDisplacementM);
  if (!Number.isFinite(maxDisplacementM) || maxDisplacementM <= 0) return null;
  const simulationTimeScale = Math.max(
    0.01,
    Math.min(
      10,
      Number.isFinite(Number(value.simulationTimeScale))
        ? Number(value.simulationTimeScale)
        : 1
    )
  );
  const maxSimulationAgeS = Math.max(
    1e-6,
    Math.min(
      1,
      Number.isFinite(Number(value.maxSimulationAgeS))
        ? Number(value.maxSimulationAgeS)
      : maxHorizonS * simulationTimeScale
    )
  );
  const presentationSlotCount = Number(value.presentationSlotCount);
  if (
    !Number.isSafeInteger(presentationSlotCount)
    || presentationSlotCount <= 0
  ) return null;
  return Object.freeze({
    schema: RESIDENT_PARTICLE_TEMPORAL_MOTION_SCHEMA,
    enabled: true,
    targetHz,
    minFrameIntervalMs: 1000 / targetHz,
    maxHorizonS,
    simulationTimeScale,
    maxSimulationAgeS,
    presentationSlotCount,
    maxDisplacementM,
    method: 'bounded-keyframe-velocity-extrapolation',
    sourceVelocityLanes: Object.freeze([4, 5, 6]),
    authoritativeStateMutation: false
  });
}

function cancelWorkerParticleTemporalAnimationFrame() {
  if (workerParticleTemporalAnimationHandle == null) return;
  try {
    if (
      workerParticleTemporalAnimationHandleKind === 'raf'
      && typeof self.cancelAnimationFrame === 'function'
    ) {
      self.cancelAnimationFrame(workerParticleTemporalAnimationHandle);
    } else {
      globalThis.clearTimeout?.(workerParticleTemporalAnimationHandle);
    }
  } catch {}
  workerParticleTemporalAnimationHandle = null;
  workerParticleTemporalAnimationHandleKind = null;
}

function stopWorkerParticleTemporalPresentation({ clearState = true } = {}) {
  workerParticleTemporalGeneration += 1;
  cancelWorkerParticleTemporalAnimationFrame();
  // A generation bump makes any late completion stale. Detach it as well so a
  // lost/stuck presentation fence cannot poison every later keyframe or QoS
  // boundary by remaining installed in the single in-flight slot forever.
  workerParticleTemporalFrameInFlight = null;
  if (clearState) workerParticleTemporalPresentation = null;
}

function invalidateWorkerParticleTemporalFrameInFlight() {
  workerParticleTemporalGeneration += 1;
  cancelWorkerParticleTemporalAnimationFrame();
  if (workerParticleTemporalPresentation) {
    // Preserve the retained keyframe but move it to a new generation. Any
    // timed-out completion captured the prior generation and therefore cannot
    // publish late pixels or reclaim the single in-flight slot.
    workerParticleTemporalPresentation.generation =
      workerParticleTemporalGeneration;
  }
  workerParticleTemporalFrameInFlight = null;
}

function requestWorkerParticleTemporalAnimationFrame(callback) {
  if (typeof self.requestAnimationFrame === 'function') {
    workerParticleTemporalAnimationHandleKind = 'raf';
    workerParticleTemporalAnimationHandle = self.requestAnimationFrame(callback);
    return;
  }
  workerParticleTemporalAnimationHandleKind = 'timer';
  workerParticleTemporalAnimationHandle = globalThis.setTimeout(
    () => callback(nowMs()),
    Math.max(
      1,
      Math.round(
        workerParticleTemporalPresentation?.motion?.minFrameIntervalMs ?? 16
      )
    )
  );
}

function workerParticleFirstSlotMidpointMotionAgeS(
  presentation = workerParticleTemporalPresentation
) {
  const maxSimulationAgeS = Number(
    presentation?.motion?.maxSimulationAgeS
  );
  const presentationSlotCount = Number(
    presentation?.motion?.presentationSlotCount
  );
  if (
    !Number.isFinite(maxSimulationAgeS)
    || maxSimulationAgeS <= 0
    || !Number.isSafeInteger(presentationSlotCount)
    || presentationSlotCount <= 0
  ) return null;
  return maxSimulationAgeS / (2 * presentationSlotCount);
}

function scheduleWorkerParticleTemporalPresentation({
  preferImmediate = false,
  continueAfterAdmission = true,
  motionAgeSOverride = null
} = {}) {
  if (
    disposed
    || !workerParticleTemporalPresentation
    || workerParticleTemporalPresentation.autonomousEnabled !== true
    || workerParticleTemporalAnimationHandle != null
    || workerParticleTemporalFrameInFlight != null
    || workerParticleTemporalBoundaryPending
    || workerParticleTemporalAuthorityAdmissionPending
  ) return;
  const generation = workerParticleTemporalPresentation.generation;
  const drawAndContinue = async () => {
    if (
      disposed
      || !workerParticleTemporalPresentation
      || workerParticleTemporalPresentation.generation !== generation
      || workerParticleTemporalBoundaryPending
      || workerParticleTemporalAuthorityAdmissionPending
    ) return;
    const result = drawWorkerParticleTemporalMotionFrame({
      reason: 'worker-particle-temporal-display-cadence',
      // An admitted worker rAF is already the presentation clock. Submitting
      // its successor on that edge preserves 60 Hz monitors and does not
      // quantize 90/120/144 Hz displays down by rejecting sub-15ms intervals.
      force: preferImmediate,
      motionAgeSOverride
    });
    if (result?.rendered !== true || !result?.completion) {
      if (
        result?.horizonExhausted !== true
        && continueAfterAdmission === true
      ) {
        scheduleWorkerParticleTemporalPresentation();
      }
      return;
    }
    try {
      const completionResult = await result.completion;
      if (completionResult?.admitted !== true) return;
    } catch {
      return;
    }
    if (
      disposed
      || !workerParticleTemporalPresentation
      || workerParticleTemporalPresentation.generation !== generation
      || workerParticleTemporalBoundaryPending
      || workerParticleTemporalAuthorityAdmissionPending
    ) return;
    if (
      result?.horizonExhausted === true
      || continueAfterAdmission !== true
    ) return;
    // The post-GPU rAF that admitted this frame is itself the pacing
    // opportunity for its successor. Submit immediately from that callback;
    // adding another pre-submit rAF would halve autonomous cadence to ~30 Hz.
    scheduleWorkerParticleTemporalPresentation({ preferImmediate: true });
  };
  if (preferImmediate) {
    void drawAndContinue();
    return;
  }
  requestWorkerParticleTemporalAnimationFrame(() => {
    workerParticleTemporalAnimationHandle = null;
    workerParticleTemporalAnimationHandleKind = null;
    void drawAndContinue();
  });
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
    workerFramebufferEpoch,
    canvasConfigureCount,
    canvasConfigureSkipCount,
    canvasUnconfigureCount,
    canvasConfigured: canvasConfiguration !== null,
    lastCanvasConfigureAction,
    lastCanvasConfigureReason,
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
  error = null,
  // W4b: terminal truth of a batched resident schedule. The full W2 result
  // envelope is structured-cloneable by construction (the mechanics worker
  // posts it verbatim on its own message loop), so the scene adopts it from
  // this status channel without a second transport.
  residentScheduleResult = null,
  residentScheduleError = null
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
    ...(residentScheduleResult
      ? {
          scheduleId: residentScheduleResult.scheduleId ?? null,
          residentScheduleResult
        }
      : {}),
    ...(residentScheduleError
      ? { residentScheduleError }
      : {}),
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
  nextPixelRatio = pixelRatio,
  reason = 'configure-canvas'
} = {}) {
  if (!canvas || !context || !device || !format) {
    lastCanvasConfigureAction = 'unavailable';
    lastCanvasConfigureReason = String(reason || 'configure-canvas');
    return { configured: false, reason: 'canvas-configuration-unavailable' };
  }
  const backingWidth = Math.max(1, Math.floor(Number(width) || 1));
  const backingHeight = Math.max(1, Math.floor(Number(height) || 1));
  const usage = self.GPUTextureUsage?.RENDER_ATTACHMENT ?? TEXTURE_RENDER_ATTACHMENT;
  const alphaMode = 'premultiplied';
  cssWidth = Number.isFinite(Number(nextCssWidth)) ? Number(nextCssWidth) : cssWidth;
  cssHeight = Number.isFinite(Number(nextCssHeight)) ? Number(nextCssHeight) : cssHeight;
  pixelRatio = Number.isFinite(Number(nextPixelRatio)) && Number(nextPixelRatio) > 0
    ? Number(nextPixelRatio)
    : pixelRatio;

  const configurationMatches = Boolean(
    canvasConfiguration
    && canvasConfiguration.canvas === canvas
    && canvasConfiguration.context === context
    && canvasConfiguration.device === device
    && canvasConfiguration.format === format
    && canvasConfiguration.usage === usage
    && canvasConfiguration.alphaMode === alphaMode
    && canvasConfiguration.width === backingWidth
    && canvasConfiguration.height === backingHeight
    && Number(canvas.width) === backingWidth
    && Number(canvas.height) === backingHeight
  );
  lastCanvasConfigureReason = String(reason || 'configure-canvas');
  if (configurationMatches) {
    canvasConfigureSkipCount += 1;
    lastCanvasConfigureAction = 'reused';
    return {
      configured: false,
      reason: 'canvas-configuration-unchanged',
      configureCount: canvasConfigureCount,
      skipCount: canvasConfigureSkipCount
    };
  }

  if (Number(canvas.width) !== backingWidth) canvas.width = backingWidth;
  if (Number(canvas.height) !== backingHeight) canvas.height = backingHeight;
  try {
    context.configure({
      device,
      format,
      usage,
      alphaMode
    });
  } catch (error) {
    lastCanvasConfigureAction = 'configure-failed';
    throw error;
  }
  canvasConfiguration = {
    canvas,
    context,
    device,
    format,
    usage,
    alphaMode,
    width: backingWidth,
    height: backingHeight
  };
  canvasConfigureCount += 1;
  lastCanvasConfigureAction = 'configured';
  return {
    configured: true,
    reason: lastCanvasConfigureReason,
    configureCount: canvasConfigureCount,
    skipCount: canvasConfigureSkipCount
  };
}

function unconfigureCanvas({ reason = 'dispose' } = {}) {
  lastCanvasConfigureReason = String(reason || 'dispose');
  if (!canvasConfiguration) {
    lastCanvasConfigureAction = 'unconfigured';
    return false;
  }
  try {
    context?.unconfigure?.();
    canvasUnconfigureCount += 1;
    return true;
  } finally {
    canvasConfiguration = null;
    lastCanvasConfigureAction = 'unconfigured';
  }
}

function destroyRenderRowsResources() {
  stopWorkerParticleTemporalPresentation();
  renderRowsParticleBuffer?.destroy?.();
  renderRowsParticleVelocityBuffer?.destroy?.();
  renderRowsUniformBuffer?.destroy?.();
  renderDepthTexture?.destroy?.();
  renderBoxUniformBuffer?.destroy?.();
  residentRenderProducerSourceBuffer?.destroy?.();
  residentRenderProducerParamsBuffer?.destroy?.();
  renderRowsPipeline = null;
  renderRowsVaporPipeline = null;
  renderRowsBindGroupLayout = null;
  renderRowsParticleBuffer = null;
  renderRowsParticleVelocityBuffer = null;
  renderRowsUniformBuffer = null;
  renderRowsParticleBufferByteLength = 0;
  renderRowsParticleVelocityBufferByteLength = 0;
  renderDepthTexture = null;
  renderDepthView = null;
  renderDepthTextureWidth = 0;
  renderDepthTextureHeight = 0;
  renderBoxPipeline = null;
  renderBoxBindGroupLayout = null;
  renderBoxUniformBuffer = null;
  renderBoxBindGroup = null;
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
  stopWorkerParticleTemporalPresentation();
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
    workerFramebufferEpoch,
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

// --- W3: batched resident schedule on the presentation device ---
//
// Worker-local single-slot mailbox for the render candidates this worker's
// schedule runs produce. The bridge keeps its own mirror (fed by the
// 'resident-schedule-candidate' messages below); this instance is the
// worker-side arbitration point for future worker-local draw consumers.
// Exported for direct-invocation tests (this module is otherwise a plain
// worker script).
export const presentationResidentScheduleCandidateMailbox =
  createResidentRenderCandidateMailbox();

function resetResidentScheduleCandidateMailbox() {
  presentationResidentScheduleCandidateMailbox.reset();
  invalidatePendingCommittedResidentSchedulePresentation(
    'resident schedule candidate mailbox reset before terminal frame admission'
  );
  residentScheduleCandidateStreamIdentity = null;
  // The stream epoch is deliberately NOT zeroed: the bridge-side mailbox
  // orders candidates by (epoch, laneId, stateKey) across this worker's whole
  // lifetime. A page rebuild re-inits the presentation and seeds a NEW lane;
  // restarting the epoch at 1 would tie the new lane with the retired lane's
  // epoch and the bridge would reject every committed receipt of the rebuilt
  // lane as belonging to an inactive stream (observed as a silent 15s
  // committed-presentation timeout per schedule).
}

function prepareResidentScheduleCandidateStream({ laneId = null, stateKey = null } = {}) {
  const nextLaneId = nonEmptyString(laneId);
  const nextStateKey = nonEmptyString(stateKey);
  if (!nextLaneId || !nextStateKey) return null;
  const changed = Boolean(
    residentScheduleCandidateStreamIdentity
    && (
      residentScheduleCandidateStreamIdentity.laneId !== nextLaneId
      || residentScheduleCandidateStreamIdentity.stateKey !== nextStateKey
    )
  );
  if (changed) {
    presentationResidentScheduleCandidateMailbox.reset();
    resetPresentedSphStep();
  }
  if (!residentScheduleCandidateStreamIdentity || changed) {
    residentScheduleCandidateStreamEpoch += 1;
  }
  residentScheduleCandidateStreamIdentity = Object.freeze({
    epoch: residentScheduleCandidateStreamEpoch,
    laneId: nextLaneId,
    stateKey: nextStateKey
  });
  return residentScheduleCandidateStreamIdentity;
}

function residentScheduleCandidateStreamIsCurrent(stream = null) {
  return Boolean(
    stream
    && residentScheduleCandidateStreamIdentity
    && Number(stream.epoch) === Number(residentScheduleCandidateStreamIdentity.epoch)
    && stream.laneId === residentScheduleCandidateStreamIdentity.laneId
    && stream.stateKey === residentScheduleCandidateStreamIdentity.stateKey
  );
}

function nonEmptyString(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || null;
}

function sameResidentScheduleCandidateVersion(left = null, right = null) {
  return Boolean(
    left
    && right
    && Number.isSafeInteger(Number(left.residentExecutionGeneration))
    && Number(left.residentExecutionGeneration)
      === Number(right.residentExecutionGeneration)
    && Number.isSafeInteger(Number(left.nextStep))
    && Number(left.nextStep) === Number(right.nextStep)
    && nonEmptyString(left.scheduleId) === nonEmptyString(right.scheduleId)
    && Number.isSafeInteger(Number(left.stepOrdinal))
    && Number(left.stepOrdinal) === Number(right.stepOrdinal)
  );
}

function committedResidentSchedulePresentationReceiptFields(
  admission = null,
  candidate = null
) {
  return {
    residentScheduleCandidatePresentation: true,
    stateManagerCommittedPresentation: true,
    committedPresentationSchema: admission?.schema ?? null,
    committedPresentationStatus: admission?.status ?? null,
    scheduleId: admission?.scheduleId ?? null,
    laneId: admission?.laneId ?? null,
    stateKey: admission?.stateKey ?? null,
    presentationAdmissionPostedAtMs:
      Number.isFinite(Number(admission?.presentationAdmissionPostedAtMs))
        ? Number(admission.presentationAdmissionPostedAtMs)
        : null,
    presentationLaneEpoch:
      candidate?.presentationLaneEpoch ?? null,
    residentExecutionGeneration:
      admission?.candidateVersion?.residentExecutionGeneration ?? null,
    sphStep: admission?.candidateVersion?.nextStep ?? null,
    stepOrdinal: admission?.candidateVersion?.stepOrdinal ?? null,
    authorityStatus: admission?.authority?.status ?? null,
    computeManagerCompletionSchema:
      admission?.authority?.computeManagerCompletionSchema ?? null,
    computeManagerLeaseId:
      admission?.authority?.computeManagerLeaseId ?? null,
    computeManagerLeaseStatus:
      admission?.authority?.computeManagerLeaseStatus ?? null,
    computeManagerFenceSatisfied:
      admission?.authority?.computeManagerFenceSatisfied === true,
    stateManagerCommitStatus:
      admission?.authority?.stateManagerCommitStatus ?? null,
    stateManagerCommitAccepted:
      admission?.authority?.stateManagerCommitAccepted === true,
    terminalScheduleFence:
      admission?.terminalFence?.terminalScheduleFence === true,
    terminalFenceScope: admission?.terminalFence?.scope ?? null,
    terminalFenceSatisfied:
      admission?.terminalFence?.fenceSatisfied === true,
    terminalFenceAuthorityAdmissionReady:
      admission?.terminalFence?.authorityAdmissionReady === true
  };
}

function committedResidentSchedulePresentationRenderReceiptFields(data = {}) {
  if (data?.stateManagerCommittedPresentation !== true) return {};
  return {
    residentScheduleCandidatePresentation:
      data.residentScheduleCandidatePresentation === true,
    stateManagerCommittedPresentation: true,
    committedPresentationSchema: data.committedPresentationSchema ?? null,
    committedPresentationStatus: data.committedPresentationStatus ?? null,
    scheduleId: data.scheduleId ?? null,
    laneId: data.laneId ?? null,
    stateKey: data.stateKey ?? null,
    presentationLaneEpoch: data.presentationLaneEpoch ?? null,
    residentExecutionGeneration: data.residentExecutionGeneration ?? null,
    sphStep: data.sphStep ?? null,
    stepOrdinal: data.stepOrdinal ?? null,
    authorityStatus: data.authorityStatus ?? null,
    computeManagerCompletionSchema:
      data.computeManagerCompletionSchema ?? null,
    computeManagerLeaseId: data.computeManagerLeaseId ?? null,
    computeManagerLeaseStatus: data.computeManagerLeaseStatus ?? null,
    computeManagerFenceSatisfied:
      data.computeManagerFenceSatisfied === true,
    stateManagerCommitStatus: data.stateManagerCommitStatus ?? null,
    stateManagerCommitAccepted: data.stateManagerCommitAccepted === true,
    terminalScheduleFence: data.terminalScheduleFence === true,
    terminalFenceScope: data.terminalFenceScope ?? null,
    terminalFenceSatisfied: data.terminalFenceSatisfied === true,
    terminalFenceAuthorityAdmissionReady:
      data.terminalFenceAuthorityAdmissionReady === true
  };
}

// Version mapping (documented decision for W3):
//
// The de-facto version token for render candidates is the scene's
// resident-render-source metadata (peercompute.ulg.sph-resident-render-source
// .v0, src/visualization/sphPhaseScene.js), ordered by
// (residentExecutionGeneration, nextStep). The presentation worker has no
// access to the scene's counters, so it derives the same ordering from the
// lane's own sealed epoch identity words carried by every W2 schedule
// progress envelope and terminal result:
//
//   version.residentExecutionGeneration := epochIdentity.storageGeneration
//     The lane's generationId lineage word: it only changes when the lane's
//     storage generation re-materializes, which strictly supersedes every
//     candidate of the prior generation (the scene-side analogue is the
//     per-execution residentExecutionGeneration counter).
//
//   version.nextStep := epochIdentity.physicsTick
//     The W2 schedule driver's 'epoch-identity-regressed' seal guarantees
//     physicsTick (and positionEpoch) strictly advance per step, and a
//     continuation schedule on the retained lane keeps advancing from the
//     retained words — so within one storage generation versions strictly
//     increase across steps AND across schedules.
//
//   version.scheduleId / version.stepOrdinal are carried verbatim for
//     observability only; they do not participate in ordering.
//
// Together (storageGeneration, physicsTick) is strictly increasing over every
// candidate one lane emits, which is exactly the mailbox's ordering contract.
// The terminal-result candidate of a live-preview schedule whose last step
// already emitted a progress candidate carries the SAME version; the mailbox
// truthfully drops it as a duplicate (droppedStaleCount) rather than
// reordering. With live preview disabled, only this terminal candidate is
// constructed and posted.
//
// Fail-closed: when the epoch identity or either version word is missing or
// non-finite (e.g. a schedule cancelled before step 1 has a null
// finalEpochIdentity) the builder returns null — a candidate is skipped, never
// fabricated.
export function buildPresentationResidentScheduleRenderCandidate({
  scheduleId = null,
  laneId = null,
  stateKey = null,
  presentationLaneEpoch = null,
  stepOrdinal = null,
  epochIdentity = null,
  retainedBufferRefs = null,
  summary = null
} = {}) {
  if (!epochIdentity || typeof epochIdentity !== 'object') return null;
  for (const field of ULG_RESIDENT_RENDER_CANDIDATE_EPOCH_IDENTITY_WORD_FIELDS) {
    if (!Number.isFinite(Number(epochIdentity[field]))) return null;
  }
  const residentExecutionGeneration = Number(epochIdentity.storageGeneration);
  const nextStep = Number(epochIdentity.physicsTick);
  return {
    schema: ULG_RESIDENT_RENDER_CANDIDATE_SCHEMA,
    laneId: nonEmptyString(laneId),
    stateKey: nonEmptyString(stateKey),
    presentationLaneEpoch: Number.isSafeInteger(Number(presentationLaneEpoch))
      && Number(presentationLaneEpoch) > 0
      ? Number(presentationLaneEpoch)
      : null,
    version: {
      residentExecutionGeneration,
      nextStep,
      scheduleId: typeof scheduleId === 'string' ? scheduleId : null,
      stepOrdinal: Number.isFinite(Number(stepOrdinal))
        ? Number(stepOrdinal)
        : null
    },
    epochIdentity: Object.fromEntries(
      ULG_RESIDENT_RENDER_CANDIDATE_EPOCH_IDENTITY_WORD_FIELDS.map(
        (field) => [field, Number(epochIdentity[field])]
      )
    ),
    ...(Array.isArray(retainedBufferRefs)
      ? { retainedBufferRefs: [...retainedBufferRefs] }
      : {}),
    ...(summary && typeof summary === 'object' ? { summary } : {})
  };
}

// (a) publish into the worker-local mailbox, (b) post the bridge message.
// Stale/duplicate versions are dropped by the mailbox but the bridge message
// is still posted — the bridge-side mailbox applies the identical ordering
// gate and counts its own drops. Returns the candidate or null when the
// source had no publishable identity.
function postResidentScheduleCandidate(source) {
  const candidate = buildPresentationResidentScheduleRenderCandidate(source);
  if (!candidate) return null;
  // Telemetry is best-effort and cannot own presentation. The exact terminal
  // candidate returned here is retained separately for post-commit admission,
  // even when the mailbox drops its duplicate version or postMessage fails.
  try {
    presentationResidentScheduleCandidateMailbox.publish(candidate);
  } catch {
    // Candidate telemetry rejection never destroys the direct terminal value.
  }
  try {
    self.postMessage({
      type: 'resident-schedule-candidate',
      laneId: candidate.laneId,
      stateKey: candidate.stateKey,
      candidate
    });
  } catch {
    // The terminal presentation path is independent of telemetry delivery.
  }
  return candidate;
}

// W4b: worker-local terminal candidate consumer. Explicit live preview can
// publish time-coalesced progress candidates to the mailbox, but NEVER gives
// them committed authority. Only the page's exact post-StateManager-commit
// admission can promote/draw the terminal candidate from worker-retained
// post-step buffers.
function createResidentScheduleCandidateDrawLoop({
  runner = null,
  schedulePayload = {},
  isScheduleCurrent = () => true,
  workerOwnedIsosurfacePresenterOverride = null,
  reason = 'run-resident-schedule-on-presentation-device'
} = {}) {
  const request = retainedStageOutputRenderRequest(schedulePayload);
  const laneId = schedulePayload.lease?.laneId || schedulePayload.lane?.laneId || null;
  const stateKey = schedulePayload.lease?.stateKey || schedulePayload.lane?.stateKey || null;
  const resolverAvailable =
    typeof runner?.resolveUlgMechanicsResidentStageWorkerRetainedParticleState === 'function';
  if (
    !request
    || request.sourceStageId !== 'schroederSameLevelMechanics'
    || !resolverAvailable
  ) {
    return {
      active: false,
      requested: Boolean(request),
      inactiveReason: !request
        ? 'no-retained-stage-output-render-request'
        : (!resolverAvailable
          ? 'retained-particle-state-resolver-unavailable'
          : 'render-request-not-schroeder-same-level-mechanics'),
      notify() {}
    };
  }
  let drawing = false;
  let lastDrawnCandidate = null;
  let lastDrawnStatus = null;
  let lastDrawnPresentationCompletion = null;
  // A live-preview draw presents the lane's CURRENT retained state
  // mid-schedule. It must never claim StateManager commitment: the
  // committed receipt helper hardcodes stateManagerCommittedPresentation
  // true, so previews carry their own honest uncommitted marker (which
  // also keeps the page's committed-presentation matcher from ever
  // admitting one).
  const candidateReceiptFields = (admission, candidate) => (
    admission?.livePreview === true
      ? {
          residentScheduleCandidatePresentation: true,
          stateManagerCommittedPresentation: false,
          residentSchedulePresentationMode: 'uncommitted-live-preview',
          scheduleId: candidate?.scheduleId ?? null,
          laneId: candidate?.laneId ?? laneId,
          stateKey: candidate?.stateKey ?? stateKey,
          presentationLaneEpoch: candidate?.presentationLaneEpoch ?? null,
          stepOrdinal: candidate?.version?.stepOrdinal ?? null
        }
      : committedResidentSchedulePresentationReceiptFields(
          admission,
          candidate
        )
  );
  const drawCandidate = (admission, candidate) => {
    if (drawing) return null;
    drawing = true;
    try {
        if (!candidate) return null;
        const retained = runner.resolveUlgMechanicsResidentStageWorkerRetainedParticleState({
          laneId,
          stateKey,
          sourceStageId: 'schroederSameLevelMechanics'
        });
        const candidateParticleCount = Number(candidate?.summary?.particleCount);
        const retainedParticleCount = Number(retained?.particleCount);
        const retainedStateStrideFloats = Number(retained?.stateStrideFloats);
        const retainedThermoStrideFloats = Number(retained?.thermoStrideFloats);
        const retainedStateByteLength = Number(retained?.stateBufferByteLength);
        const retainedThermoByteLength = Number(retained?.thermoBufferByteLength);
        const retainedShapeReady = Boolean(
          Number.isSafeInteger(candidateParticleCount)
          && candidateParticleCount > 0
          && candidateParticleCount === retainedParticleCount
          && Number.isSafeInteger(retainedStateStrideFloats)
          && retainedStateStrideFloats > 0
          && Number.isSafeInteger(retainedThermoStrideFloats)
          && retainedThermoStrideFloats >= 12
          && Number.isSafeInteger(retainedStateByteLength)
          && retainedStateByteLength
            >= retainedParticleCount * retainedStateStrideFloats * 4
          && Number.isSafeInteger(retainedThermoByteLength)
          && retainedThermoByteLength
            >= retainedParticleCount * retainedThermoStrideFloats * 4
        );
        if (
          retained?.status !== 'worker-retained-particle-state-ready'
          || !isGpuBufferLike(retained.sourceStateBuffer)
          || !isGpuBufferLike(retained.sourceThermoBuffer)
          || !retainedShapeReady
        ) {
          return publishRenderRowsStatus({
            schema: RESIDENT_PARTICLE_STATE_PRODUCER_SCHEMA,
            renderRowsSchema: RENDER_ROWS_SCHEMA,
            status: 'worker-offscreen-resident-schedule-candidate-render-blocked-source-unavailable',
            reason: retained?.status !== 'worker-retained-particle-state-ready'
              ? (retained?.status || reason)
              : 'worker-retained-particle-state-terminal-shape-mismatch',
            inputTransport: RESIDENT_RENDER_PRODUCER_TRANSPORT,
            producerSourceKind: 'worker-retained-resident-stage-output',
            producerSourceTransport: RESIDENT_STAGE_OUTPUT_TRANSPORT,
            sourceStageId: 'schroederSameLevelMechanics',
            retainedParticleStateStatus: retained?.status || null,
            particleCount: retained?.particleCount ?? 0,
            sourceTransferBytes: 0,
            sourceStateTransferBytes: 0,
            workerLocalRenderRowsProduced: false,
            ...candidateReceiptFields(admission, candidate)
          });
        }
        const livePreviewMode = request.residentScheduleLivePreview === true;
        const workerOwnedIsosurfaceRequest = request.workerOwnedIsosurface;
        if (
          workerOwnedIsosurfaceRequest?.enabled === true
          && admission?.livePreview !== true
        ) {
          stopWorkerParticleTemporalPresentation();
          const receiptFields = {
            renderRowsSchema: RENDER_ROWS_SCHEMA,
            inputTransport: RESIDENT_RENDER_PRODUCER_TRANSPORT,
            producerSourceKind: 'worker-retained-resident-stage-output',
            producerSourceTransport: RESIDENT_STAGE_OUTPUT_TRANSPORT,
            sourceCacheStatus:
              'worker-retained-resident-schedule-candidate-captured',
            sourceStageId: 'schroederSameLevelMechanics',
            retainedParticleStateStatus: retained.status,
            particleCount: retained.particleCount,
            sourceTransferBytes: 0,
            sourceStateTransferBytes: 0,
            inputTransferBytes: 0,
            workerLocalRenderRowsProduced: false,
            sphStep: candidate.version.nextStep,
            residentScheduleCandidatePresentation: true,
            ...candidateReceiptFields(admission, candidate)
          };
          const isosurfacePresenter =
            workerOwnedIsosurfacePresenterOverride
            ?? ensureWorkerOwnedIsosurfacePresenter();
          return isosurfacePresenter.enqueue({
            request: workerOwnedIsosurfaceRequest,
            retained,
            sphStep: candidate.version.nextStep,
            receiptFields
          }).then((enqueueReceipt) => publishRenderRowsStatus({
            ...enqueueReceipt,
            ...receiptFields,
            workerLocalRenderRowsProduced: false,
            reason: enqueueReceipt.reason || `${reason}:worker-isosurface-enqueue`
          }));
        }
        if (livePreviewMode) {
          // Camera responsiveness: the page streams the current
          // view-projection while the preview owns the display; redraw the
          // freshest candidate on camera updates instead of waiting for the
          // next physics candidate.
          previewCameraRedraw = () => drawCandidate({ livePreview: true }, candidate);
        }
        const drawStatus = drawResidentParticleStateProducer({
          ...request,
          workerFramebufferEpoch,
          ...(livePreviewMode && previewViewProjectionOverride
            ? { viewProjectionMatrix: previewViewProjectionOverride }
            : {}),
          inputTransport: RESIDENT_RENDER_PRODUCER_TRANSPORT,
          producerSourceKind: 'worker-retained-resident-stage-output',
          producerSourceTransport: RESIDENT_STAGE_OUTPUT_TRANSPORT,
          sourceCacheStatus: 'worker-retained-resident-schedule-candidate-bound',
          sourceStageId: 'schroederSameLevelMechanics',
          retainedParticleStateStatus: retained.status,
          sourceStateBuffer: retained.sourceStateBuffer,
          sourceThermoBuffer: retained.sourceThermoBuffer,
          particleCount: retained.particleCount,
          stateStrideFloats: retained.stateStrideFloats,
          thermoStrideFloats: retained.thermoStrideFloats,
          stateByteLength: retained.stateBufferByteLength,
          thermoByteLength: retained.thermoBufferByteLength,
          // Presentation ordering rides the candidate's own strictly
          // advancing version word (physicsTick), so a stale draw can never
          // supersede a newer presented step.
          sphStep: candidate.version.nextStep,
          residentScheduleCandidatePresentation: true,
          ...candidateReceiptFields(admission, candidate),
          // A schedule can outlive a viewport resize. Presentation geometry
          // is camera-current, so it must also use the worker's current
          // backing/CSS dimensions rather than snapping the canvas and depth
          // texture back to the dimensions captured at schedule dispatch.
          width: canvas?.width ?? request.width ?? 1,
          height: canvas?.height ?? request.height ?? 1,
          cssWidth,
          cssHeight,
          pixelRatio,
          backgroundColor: request.backgroundColor || backgroundColor,
          // The worker is an overlay above the scene/environment canvas.
          // Worker-owned resident presentation removes the page-side stale
          // particle surface, and this renderer now supplies its own box, so
          // the preview must remain transparent to preserve the environment
          // instead of hiding it behind an opaque presentation canvas.
          clearAlpha: Number.isFinite(Number(request.clearAlpha))
            ? Number(request.clearAlpha)
            : clearAlpha,
          onTemporalFrameStatus(nextStatus) {
            if (
              sameResidentScheduleCandidateVersion(
                lastDrawnCandidate?.version,
                candidate?.version
              )
            ) {
              lastDrawnStatus = nextStatus;
            }
          },
          reason: `${reason}:resident-schedule-candidate`
        });
        if (
          drawStatus?.status
            === 'worker-offscreen-resident-particle-state-producer-rendered'
          || drawStatus?.presentationFrameCompletion
        ) {
          lastDrawnCandidate = candidate;
          lastDrawnStatus = drawStatus;
          lastDrawnPresentationCompletion =
            drawStatus.presentationFrameCompletion ?? null;
        }
        return drawStatus;
    } finally {
      drawing = false;
    }
  };
  return {
    active: true,
    requested: true,
    inactiveReason: null,
    notify(admission = null, candidate = null) {
      try {
        const promotion = resolveCommittedResidentSchedulePreviewPromotion({
          admission,
          candidate,
          lastDrawnCandidate,
          lastDrawnStatus,
          reason
        });
        if (
          promotion
          && workerFramebufferEpochIsCurrent(
            promotion.workerFramebufferEpoch
          )
        ) {
          // The exact terminal candidate was already submitted to the worker
          // canvas as an uncommitted live-preview frame. StateManager commit
          // does not change its pixels; promote that same versioned frame to
          // an authority-bearing receipt without a duplicate compute/render
          // submission. A non-matching candidate still takes the ordinary
          // committed draw path below.
          const promoted = publishRenderRowsStatus(promotion);
          lastDrawnStatus = promoted;
          promoteWorkerParticleTemporalPresentation(promoted);
          return promoted;
        }
        return drawCandidate(admission, candidate);
      } catch (error) {
        // Candidate presentation must never abort the batch; surface the
        // failure on the render-rows status channel instead.
        try {
          return publishRenderRowsStatus({
            schema: RESIDENT_PARTICLE_STATE_PRODUCER_SCHEMA,
            renderRowsSchema: RENDER_ROWS_SCHEMA,
            status: 'worker-offscreen-resident-schedule-candidate-render-failed',
            reason: error instanceof Error ? error.message : String(error),
            inputTransport: RESIDENT_RENDER_PRODUCER_TRANSPORT,
            producerSourceKind: 'worker-retained-resident-stage-output',
            producerSourceTransport: RESIDENT_STAGE_OUTPUT_TRANSPORT,
            sourceStageId: 'schroederSameLevelMechanics',
            workerLocalRenderRowsProduced: false,
            ...candidateReceiptFields(admission, candidate),
            ...compactError(error)
          });
        } catch {
          // Even status publication failures stay out of the step loop.
        }
        return null;
      }
    },
    async ensureTerminalPreview(candidate = null, {
      token = null,
      deadlineMs = 250
    } = {}) {
      const stillCurrent = () => Boolean(
        token?.active !== false
        && isScheduleCurrent()
      );
      const waitForProof = async (proof) => {
        const settled = await promiseWithinWorkerParticleDeadline(
          proof,
          deadlineMs
        );
        if (settled.timedOut) {
          if (token) token.active = false;
          invalidateWorkerParticleTemporalFrameInFlight();
          throw new Error(
            'worker particle terminal preview missed its presentation deadline'
          );
        }
        return settled.value;
      };
      if (!stillCurrent()) return null;
      // A final-boundary handoff cover is intentionally queued before the
      // terminal mechanics chunk. Let that exact old-source frame reach its
      // post-GPU presentation opportunity before replacing the temporal
      // generation with the terminal keyframe.
      if (workerParticleTemporalFrameInFlight) {
        try {
          await waitForProof(workerParticleTemporalFrameInFlight);
        } catch (error) {
          if (!stillCurrent()) return null;
          throw error;
        }
      }
      if (!stillCurrent()) return null;
      if (
        sameResidentScheduleCandidateVersion(
          lastDrawnCandidate?.version,
          candidate?.version
        )
        && workerFramebufferEpochIsCurrent(
          lastDrawnStatus?.workerFramebufferEpoch
        )
        && (
          lastDrawnStatus?.status
            === 'worker-offscreen-resident-particle-state-producer-rendered'
          || lastDrawnPresentationCompletion
        )
      ) {
        if (lastDrawnPresentationCompletion) {
          try {
            await waitForProof(lastDrawnPresentationCompletion);
          } catch (error) {
            if (!stillCurrent()) return null;
            throw error;
          }
        }
        if (!stillCurrent()) return null;
        return lastDrawnStatus;
      }
      if (!stillCurrent()) return null;
      const drawStatus = drawCandidate({ livePreview: true }, candidate);
      if (drawStatus?.presentationFrameCompletion) {
        try {
          await waitForProof(drawStatus.presentationFrameCompletion);
        } catch (error) {
          if (!stillCurrent()) return null;
          throw error;
        }
      }
      if (!stillCurrent()) return null;
      return lastDrawnStatus ?? drawStatus;
    }
  };
}

function workerParticleKeyframePresentationProofReady(status = null) {
  return Boolean(
    status?.presentationFrameSchema
      === RESIDENT_PARTICLE_KEYFRAME_PRESENTATION_FRAME_SCHEMA
    && status?.presentationFrameStatus
      === 'worker-particle-keyframe-presentation-opportunity'
    && status?.presentationFrameAdmitted === true
    && status?.presentationFrameGpuCompleted === true
    && status?.presentationFramePresentationOpportunity === true
    && status?.presentationFramePresentationOpportunityMethod
      === 'worker-request-animation-frame-after-gpu-completion'
    && isExactWorkerPresentationFrameQueueCompletionProof(status)
  );
}

export function resolveCommittedResidentSchedulePreviewPromotion({
  admission = null,
  candidate = null,
  lastDrawnCandidate = null,
  lastDrawnStatus = null,
  reason = 'run-resident-schedule-on-presentation-device'
} = {}) {
  if (
    admission?.livePreview === true
    || lastDrawnStatus?.status
      !== 'worker-offscreen-resident-particle-state-producer-rendered'
    || !workerParticleKeyframePresentationProofReady(lastDrawnStatus)
    || !sameResidentScheduleCandidateVersion(
      lastDrawnCandidate?.version,
      candidate?.version
    )
  ) {
    return null;
  }
  return {
    ...lastDrawnStatus,
    status: 'worker-offscreen-resident-particle-state-producer-rendered',
    reason:
      `${reason}:resident-schedule-terminal-preview-promoted-after-commit`,
    residentSchedulePresentationMode:
      'committed-terminal-live-preview-promotion',
    committedPresentationPromotedWithoutRedraw: true,
    workerLocalRenderRowsProduced: true,
    updatedAtMs: nowMs(),
    ...committedResidentSchedulePresentationReceiptFields(
      admission,
      candidate
    )
  };
}

function committedResidentSchedulePresentationBlocked(data = {}, reason) {
  return publishRenderRowsStatus({
    schema: RESIDENT_PARTICLE_STATE_PRODUCER_SCHEMA,
    renderRowsSchema: RENDER_ROWS_SCHEMA,
    status:
      'worker-offscreen-committed-resident-schedule-presentation-blocked',
    reason,
    inputTransport: RESIDENT_RENDER_PRODUCER_TRANSPORT,
    producerSourceKind: 'worker-retained-resident-stage-output',
    producerSourceTransport: RESIDENT_STAGE_OUTPUT_TRANSPORT,
    sourceStageId: 'schroederSameLevelMechanics',
    residentScheduleCandidatePresentation: true,
    stateManagerCommittedPresentation: false,
    scheduleId: data?.scheduleId ?? null,
    laneId: data?.laneId ?? null,
    stateKey: data?.stateKey ?? null,
    residentExecutionGeneration:
      data?.candidateVersion?.residentExecutionGeneration ?? null,
    sphStep: data?.candidateVersion?.nextStep ?? null,
    stepOrdinal: data?.candidateVersion?.stepOrdinal ?? null,
    workerLocalRenderRowsProduced: false
  });
}

function invalidatePendingCommittedResidentSchedulePresentation(reason) {
  const pending = pendingCommittedResidentSchedulePresentation;
  if (!pending) {
    workerParticleTemporalAuthorityAdmissionPending = false;
    return false;
  }
  if (pending.terminalPreviewToken) {
    pending.terminalPreviewToken.active = false;
  }
  pendingCommittedResidentSchedulePresentation = null;
  workerParticleTemporalAuthorityAdmissionPending = false;
  stopWorkerParticleTemporalPresentation();
  committedResidentSchedulePresentationBlocked({
    scheduleId: pending.scheduleId,
    laneId: pending.laneId,
    stateKey: pending.stateKey,
    candidateVersion: pending.terminalCandidate?.version ?? null
  }, reason);
  return true;
}

// Page -> presentation-worker admission for exactly one terminal candidate.
// This is intentionally exported as a direct test seam; the message loop is
// the only production caller. Any missing/mismatched authority word leaves the
// candidate undrawn and consumes no worker-retained source.
export function presentCommittedResidentScheduleCandidate(data = {}) {
  const pending = pendingCommittedResidentSchedulePresentation;
  if (!pending) {
    return committedResidentSchedulePresentationBlocked(
      data,
      'no pending terminal resident-schedule candidate exists'
    );
  }
  const scheduleId = nonEmptyString(data.scheduleId);
  const laneId = nonEmptyString(data.laneId);
  const stateKey = nonEmptyString(data.stateKey);
  const terminalFence = data.terminalFence;
  const authority = data.authority;
  const candidateVersion = data.candidateVersion;
  const identityReady = Boolean(
    data.schema
      === PRESENTATION_WORKER_COMMITTED_RESIDENT_SCHEDULE_PRESENTATION_SCHEMA
    && data.status
      === 'state-manager-committed-resident-schedule-presentation-admission'
    && scheduleId === pending.scheduleId
    && laneId === pending.laneId
    && stateKey === pending.stateKey
    && sameResidentScheduleCandidateVersion(
      candidateVersion,
      pending.terminalCandidate?.version
    )
  );
  const terminalFenceReady = Boolean(
    terminalFence
    && terminalFence.required === true
    && terminalFence.scope === 'resident-schedule-terminal'
    && terminalFence.terminalScheduleFence === true
    && terminalFence.fenceSatisfied === true
    && terminalFence.authorityAdmissionReady === true
    && terminalFence.queueCompletionStatus === 'queue-work-completed'
    && [
      'queue.onSubmittedWorkDone',
      'worker-device.queue.onSubmittedWorkDone'
    ].includes(terminalFence.queueCompletionMethod)
    && terminalFence.scheduleId === scheduleId
    && terminalFence.laneId === laneId
    && terminalFence.stateKey === stateKey
    && Number(terminalFence.completedStepCount)
      === Number(candidateVersion?.stepOrdinal)
    && terminalFence.scheduleId === pending.terminalFence?.scheduleId
    && Number(terminalFence.completedStepCount)
      === Number(pending.terminalFence?.completedStepCount)
  );
  const authorityReady = Boolean(
    authority
    && authority.status === 'state-manager-committed-worker-schedule'
    && authority.computeManagerCompletionSchema
      === WORKER_LANE_COMPUTE_MANAGER_COMPLETION_SCHEMA
    && nonEmptyString(authority.computeManagerLeaseId)
    && authority.computeManagerLeaseStatus === 'completed'
    && authority.computeManagerFenceSatisfied === true
    && authority.stateManagerCommitStatus === 'committed'
    && authority.stateManagerCommitAccepted === true
  );
  if (!identityReady || !terminalFenceReady || !authorityReady) {
    return committedResidentSchedulePresentationBlocked(
      data,
      !identityReady
        ? 'committed presentation identity does not match the pending terminal candidate'
        : (!terminalFenceReady
          ? 'committed presentation lacks the exact terminal schedule fence'
          : 'committed presentation lacks ComputeManager/StateManager authority')
    );
  }
  if (pending.admissionInFlight === true) {
    return committedResidentSchedulePresentationBlocked(
      data,
      'committed presentation admission is already joining terminal frame proof'
    );
  }
  const promoteProvedTerminalFrame = (provedStatus = null) => {
    if (pendingCommittedResidentSchedulePresentation !== pending) {
      return committedResidentSchedulePresentationBlocked(
        data,
        'pending terminal presentation changed before proof admission'
      );
    }
    if (
      pending.terminalPresentationCompletion
      && (
        provedStatus?.status
          !== 'worker-offscreen-resident-particle-state-producer-rendered'
        || !workerParticleKeyframePresentationProofReady(provedStatus)
      )
    ) {
      if (pending.terminalPreviewToken) {
        pending.terminalPreviewToken.active = false;
      }
      pendingCommittedResidentSchedulePresentation = null;
      workerParticleTemporalAuthorityAdmissionPending = false;
      stopWorkerParticleTemporalPresentation();
      return committedResidentSchedulePresentationBlocked(
        data,
        'terminal particle keyframe lacks exact GPU and presentation-opportunity proof'
      );
    }
    // Consume only after both signals joined so a duplicate admission or next
    // schedule cannot race the proof and replace the exact framebuffer.
    pendingCommittedResidentSchedulePresentation = null;
    if (pending.terminalPreviewToken) {
      pending.terminalPreviewToken.active = false;
    }
    workerParticleTemporalAuthorityAdmissionPending = false;
    const promoted = pending.candidateDrawLoop.notify(
      data,
      pending.terminalCandidate
    );
    if (
      promoted?.presentationFrameAdmitted === true
      && promoted?.presentationFrameGpuCompleted === true
      && promoted?.presentationFramePresentationOpportunity === true
    ) {
      scheduleWorkerParticleTemporalPresentation({
        preferImmediate: true,
        motionAgeSOverride: workerParticleFirstSlotMidpointMotionAgeS()
      });
    }
    return promoted;
  };
  if (pending.terminalPresentationCompletion) {
    pending.admissionInFlight = true;
    return promiseWithinWorkerParticleDeadline(
      pending.terminalPresentationCompletion,
      pending.terminalPresentationDeadlineMs ?? 250
    ).then(
      (proof) => {
        if (proof.timedOut) {
          if (pendingCommittedResidentSchedulePresentation === pending) {
            if (pending.terminalPreviewToken) {
              pending.terminalPreviewToken.active = false;
            }
            pendingCommittedResidentSchedulePresentation = null;
            workerParticleTemporalAuthorityAdmissionPending = false;
            stopWorkerParticleTemporalPresentation();
          }
          return committedResidentSchedulePresentationBlocked(
            data,
            'terminal particle keyframe presentation proof timed out'
          );
        }
        return promoteProvedTerminalFrame(proof.value);
      },
      (error) => {
        if (pendingCommittedResidentSchedulePresentation === pending) {
          if (pending.terminalPreviewToken) {
            pending.terminalPreviewToken.active = false;
          }
          pendingCommittedResidentSchedulePresentation = null;
          workerParticleTemporalAuthorityAdmissionPending = false;
          stopWorkerParticleTemporalPresentation();
        }
        return committedResidentSchedulePresentationBlocked(
          data,
          error instanceof Error
            ? `terminal particle keyframe proof failed: ${error.message}`
            : 'terminal particle keyframe proof failed'
        );
      }
    );
  }
  return promoteProvedTerminalFrame();
}

// Mirrors runResidentStageOnPresentationDevice exactly (same device-injection
// pattern through context.ulgMechanicsResidentStageWorker.common.deviceResult
// with sameWorkerQueueFenceFallback, same dynamic module import) but drives
// the W2 batched schedule entry runUlgMechanicsResidentStageWorkerSchedule-
// Payload. `runnerModuleOverride` is a test-only seam so node tests can inject
// a fake mechanics module; the message path never sets it. Exported for
// direct-invocation tests.
export async function runResidentScheduleOnPresentationDevice(data = {}, {
  runnerModuleOverride = null,
  workerOwnedIsosurfacePresenterOverride = null
} = {}) {
  const payload = data.payload && typeof data.payload === 'object' ? data.payload : {};
  if (!device || !context) {
    publishResidentStageStatus({
      status: 'worker-offscreen-resident-schedule-on-presentation-device-blocked-webgpu-unavailable',
      reason: 'presentation worker WebGPU device/context is unavailable',
      stagePayload: payload,
      workerDeviceSource: null,
      workerDeviceProvided: false,
      workerReady: false
    });
    return;
  }
  if (pendingCommittedResidentSchedulePresentation) {
    publishResidentStageStatus({
      status:
        'worker-offscreen-resident-schedule-on-presentation-device-blocked-pending-committed-presentation',
      reason:
        'the prior terminal candidate has not received its StateManager-commit presentation admission',
      stagePayload: payload,
      workerReady: true
    });
    return;
  }
  const startedAtMs = nowMs();
  const timeoutMs = residentStageTimeoutMs(data);
  let runner = runnerModuleOverride;
  if (!runner) {
    try {
      runner = await residentStageRunnerModule();
    } catch (error) {
      publishResidentStageStatus({
        status: 'worker-offscreen-resident-schedule-on-presentation-device-failed',
        reason: 'mechanics resident stage runner import failed',
        stagePayload: payload,
        workerReady: true,
        startedAtMs,
        timeoutMs,
        error
      });
      return;
    }
  }
  if (typeof runner.runUlgMechanicsResidentStageWorkerSchedulePayload !== 'function') {
    publishResidentStageStatus({
      status: 'worker-offscreen-resident-schedule-on-presentation-device-blocked-runner-unavailable',
      reason: 'mechanics resident schedule runner is unavailable in presentation worker',
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
  const schedulePayload = {
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
            reason: 'resident schedule is executing inside the offscreen presentation worker',
            device,
            workerDeviceSource: 'offscreen-presentation-worker-device',
            workerDeviceProvided: true
          },
          navigatorRef: self.navigator
        }
      }
    }
  };
  const scheduleLaneId =
    schedulePayload.lease?.laneId || schedulePayload.lane?.laneId || null;
  const scheduleStateKey =
    schedulePayload.lease?.stateKey || schedulePayload.lane?.stateKey || null;
  const scheduleCandidateStream = prepareResidentScheduleCandidateStream({
    laneId: scheduleLaneId,
    stateKey: scheduleStateKey
  });
  // W4b: a scheduleStepOptionsProvider is a FUNCTION and can never cross
  // postMessage, so the presentation worker injects the worker-local lane
  // continuation classifier here — the W2 driver consults it for steps 2+
  // (and for step 1 of a continuation schedule on a retained lane). An
  // explicitly provided provider (direct in-worker callers, tests) always
  // wins; without the factory the schedule keeps its original fail-closed
  // behavior.
  try {
    const injectedWorkerContext =
      schedulePayload.context.ulgMechanicsResidentStageWorker;
    const scheduleStageOptions = injectedWorkerContext.stageOptions
      && typeof injectedWorkerContext.stageOptions === 'object'
      ? injectedWorkerContext.stageOptions
      : null;
    const epochStageOptions = scheduleStageOptions?.schroederSpatialEpoch
      && typeof scheduleStageOptions.schroederSpatialEpoch === 'object'
      ? scheduleStageOptions.schroederSpatialEpoch
      : null;
    if (
      epochStageOptions
      && typeof epochStageOptions.scheduleStepOptionsProvider !== 'function'
      && typeof runner.createWorkerSchroederLaneLevelAssignmentProvider === 'function'
    ) {
      injectedWorkerContext.stageOptions = {
        ...scheduleStageOptions,
        schroederSpatialEpoch: {
          ...epochStageOptions,
          scheduleStepOptionsProvider:
            runner.createWorkerSchroederLaneLevelAssignmentProvider({
              laneId: schedulePayload.lease?.laneId
                ?? schedulePayload.lane?.laneId
                ?? null,
              stateKey: schedulePayload.lease?.stateKey
                ?? schedulePayload.lane?.stateKey
                ?? null,
              classifierOptions:
                epochStageOptions.laneContinuationClassifierOptions || null
            })
        }
      };
    }
  } catch {
    // Provider injection is an enabler, never a gate: without it the W2
    // driver fails closed exactly as before.
  }
  publishResidentStageStatus({
    status: 'worker-offscreen-resident-schedule-on-presentation-device-started',
    reason: data.reason || 'run-resident-schedule-on-presentation-device',
    stagePayload: schedulePayload,
    workerReady: true,
    startedAtMs,
    timeoutMs
  });
  // W4b: progress candidates are telemetry-only. The draw loop is retained
  // with the terminal candidate and can be notified only by an exact
  // post-StateManager-commit admission from the page.
  const candidateDrawLoop = createResidentScheduleCandidateDrawLoop({
    runner,
    schedulePayload,
    isScheduleCurrent: () => residentScheduleCandidateStreamIsCurrent(
      scheduleCandidateStream
    ),
    workerOwnedIsosurfacePresenterOverride,
    reason: data.reason || 'run-resident-schedule-on-presentation-device'
  });
  // Explicit page opt-in: mid-schedule LIVE PREVIEW draws of the lane's
  // current retained state on the worker canvas. Every preview publishes
  // with an uncommitted marker; the committed terminal presentation stays
  // the only authority-bearing draw. Throttled so per-step progress posts
  // do not swamp the canvas, and the submit burst is flushed around each
  // draw (a held canvas present would outlive its swapchain texture).
  const livePreviewRequest = retainedStageOutputRenderRequest(schedulePayload);
  const livePreviewEnabled = Boolean(
    candidateDrawLoop.active
    && livePreviewRequest?.residentScheduleLivePreview === true
  );
  const livePreviewMinIntervalMs = Math.max(
    8,
    Math.round(Number(livePreviewRequest?.livePreviewMinIntervalMs) || 66)
  );
  let livePreviewLastDrawMs = Number.NEGATIVE_INFINITY;
  const postLivePreviewProgress = livePreviewEnabled
    ? (progress) => {
        try {
          if (!residentScheduleCandidateStreamIsCurrent(scheduleCandidateStream)) {
            return;
          }
          const progressAtMs = nowMs();
          if (
            progressAtMs - livePreviewLastDrawMs
              < livePreviewMinIntervalMs
          ) {
            return;
          }
          // Gate before reading the progress envelope or building/freezing a
          // candidate. Off-cadence progress remains wholly worker-local.
          const candidate = postResidentScheduleCandidate({
            scheduleId: progress?.scheduleId ?? null,
            laneId: scheduleLaneId,
            stateKey: scheduleStateKey,
            presentationLaneEpoch: scheduleCandidateStream?.epoch ?? null,
            stepOrdinal: progress?.stepOrdinal ?? null,
            epochIdentity: progress?.epochIdentity ?? null,
            retainedBufferRefs:
              progress?.stepSummary?.retainedBufferRefs ?? null,
            summary: progress?.stepSummary ?? null
          });
          if (!candidate) return;
          livePreviewLastDrawMs = progressAtMs;
          try {
            flushWorkerQueueSubmitBurst(device);
          } catch {}
          candidateDrawLoop.notify({ livePreview: true }, candidate);
          try {
            flushWorkerQueueSubmitBurst(device);
          } catch {}
        } catch {
          // Candidate delivery must never abort the batch (mirrors the W2
          // driver's own fire-and-forget progress contract).
        }
      }
    : null;
  try {
    const result = await timeoutResidentStage(
      runner.runUlgMechanicsResidentStageWorkerSchedulePayload(
        schedulePayload,
        {
          id: data.id ?? null,
          ...(postLivePreviewProgress
            ? { postProgress: postLivePreviewProgress }
            : {}),
          ...(livePreviewEnabled
            ? {
                onTier0PresentationSubmissionBoundary: (boundary) =>
                  runWorkerParticleTemporalPresentationSubmissionBoundary(
                    boundary
                  )
              }
            : {})
        }
      ),
      timeoutMs
    );
    try {
      const terminalCandidate = residentScheduleCandidateStreamIsCurrent(
        scheduleCandidateStream
      )
        ? postResidentScheduleCandidate({
            scheduleId: result?.scheduleId ?? null,
            laneId: result?.laneId ?? scheduleLaneId,
            stateKey: result?.stateKey ?? scheduleStateKey,
            presentationLaneEpoch: scheduleCandidateStream?.epoch ?? null,
            stepOrdinal: result?.completedStepCount ?? null,
            epochIdentity: result?.finalEpochIdentity ?? null,
            retainedBufferRefs: result?.retainedBufferRefs ?? null,
            summary: result?.perStepSummaries?.lastStep ?? null
          })
        : null;
      if (terminalCandidate && candidateDrawLoop.active) {
        if (pendingCommittedResidentSchedulePresentation) {
          throw new Error(
            'worker resident schedule terminal candidate cannot overwrite a pending committed presentation'
          );
        }
        let terminalPresentationCompletion = null;
        let terminalPreviewToken = null;
        if (livePreviewEnabled) {
          // Materialize the exact terminal pixels while the terminal retained
          // family is current. GPU+rAF presentation proof and the page's
          // ComputeManager/StateManager commit are independent signals, so
          // start the proof now but do not serialize authority publication
          // behind it. The admission handler joins both before promotion.
          try {
            flushWorkerQueueSubmitBurst(device);
          } catch {}
          workerParticleTemporalAuthorityAdmissionPending = true;
          // An already armed autonomous callback must not overwrite the exact
          // terminal pixels between their proof and authority promotion.
          cancelWorkerParticleTemporalAnimationFrame();
          terminalPreviewToken = { active: true };
          terminalPresentationCompletion = retainHandledPromiseForLaterJoin(
            candidateDrawLoop.ensureTerminalPreview(terminalCandidate, {
              token: terminalPreviewToken,
              deadlineMs: 250
            })
          );
        }
        pendingCommittedResidentSchedulePresentation = {
          scheduleId: result?.scheduleId ?? null,
          laneId: result?.laneId ?? schedulePayload.lease?.laneId ?? null,
          stateKey: result?.stateKey ?? schedulePayload.lease?.stateKey ?? null,
          terminalCandidate,
          terminalFence: result?.gpuFence ?? null,
          candidateDrawLoop,
          terminalPresentationCompletion,
          terminalPreviewToken,
          terminalPresentationDeadlineMs: 250,
          admissionInFlight: false
        };
      }
    } catch {
      workerParticleTemporalAuthorityAdmissionPending = false;
      // Terminal candidate failures must not mask the completed result.
    }
    publishResidentStageStatus({
      status: 'worker-offscreen-resident-schedule-on-presentation-device-completed',
      reason: data.reason || 'run-resident-schedule-on-presentation-device',
      stagePayload: schedulePayload,
      workerReady: true,
      startedAtMs,
      timeoutMs,
      result,
      // The full W2 terminal envelope, forwarded verbatim: the page-side
      // scene adopts its truthful words (completedStepCount, per-step epoch
      // seals, lane identity, gpuFence, retained refs, cancellation).
      residentScheduleResult: result ?? null
    });
  } catch (error) {
    publishResidentStageStatus({
      status: error?.message?.includes('timed out')
        ? 'worker-offscreen-resident-schedule-on-presentation-device-timeout'
        : 'worker-offscreen-resident-schedule-on-presentation-device-failed',
      reason: data.reason || 'run-resident-schedule-on-presentation-device',
      stagePayload: schedulePayload,
      workerReady: true,
      startedAtMs,
      timeoutMs,
      error,
      residentScheduleError: error?.residentScheduleError ?? null
    });
  }
}

// Forwards to the W2 cancel entry (a pure between-steps flag; no device is
// required, so cancellation works even while init is still pending). The
// terminal 'resident-schedule-...-completed' status with result.cancelled:
// true remains the acknowledgement, exactly as on the mechanics worker's own
// message loop. Exported for direct-invocation tests.
export async function cancelResidentScheduleOnPresentationDevice(data = {}, {
  runnerModuleOverride = null
} = {}) {
  let runner = runnerModuleOverride;
  if (!runner) {
    try {
      runner = await residentStageRunnerModule();
    } catch (error) {
      publish({
        status: 'worker-offscreen-resident-schedule-cancel-failed',
        reason: 'mechanics resident stage runner import failed',
        workerReady: Boolean(device && context),
        ...compactError(error)
      });
      return null;
    }
  }
  if (typeof runner.cancelUlgMechanicsResidentStageWorkerSchedule !== 'function') {
    publish({
      status: 'worker-offscreen-resident-schedule-cancel-blocked-runner-unavailable',
      reason: 'mechanics resident schedule cancel entry is unavailable in presentation worker',
      workerReady: Boolean(device && context)
    });
    return null;
  }
  const outcome = runner.cancelUlgMechanicsResidentStageWorkerSchedule(data.id);
  publish({
    status: 'worker-offscreen-resident-schedule-cancel-forwarded',
    reason: data.reason || 'cancel-resident-schedule-on-presentation-device',
    workerReady: Boolean(device && context),
    workerOffscreenResidentScheduleCancel: {
      schema: PRESENTATION_WORKER_RESIDENT_SCHEDULE_CANCEL_SCHEMA,
      id: data.id ?? null,
      ...(outcome && typeof outcome === 'object' ? outcome : {})
    }
  });
  return outcome;
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
    label: 'ulg-offscreen-projective-sphere-impostor-shader',
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
  motionAgeS: f32,
  motionMaxDisplacementM: f32,
};

@group(0) @binding(0) var<storage, read> particles: array<Particle>;
@group(0) @binding(1) var<uniform> params: Params;
@group(0) @binding(2) var<storage, read> particleVelocities: array<vec4<f32>>;

struct VertexOut {
  @builtin(position) position: vec4<f32>,
  @location(0) quadUv: vec2<f32>,
  @location(1) color: vec4<f32>,
  @location(2) @interpolate(flat) vaporClass: f32,
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

fn hiddenVertex() -> VertexOut {
  var out: VertexOut;
  out.position = vec4<f32>(2.0, 2.0, 1.0, 1.0);
  out.quadUv = vec2<f32>(2.0);
  out.color = vec4<f32>(0.0);
  out.vaporClass = 0.0;
  return out;
}

fn projectedAxisOffsetPx(
  centerClip: vec4<f32>,
  axisClip: vec4<f32>
) -> vec2<f32> {
  if (centerClip.w <= 0.0001 || axisClip.w <= 0.0001) {
    return vec2<f32>(0.0);
  }
  let deltaNdc = axisClip.xy / axisClip.w - centerClip.xy / centerClip.w;
  return deltaNdc * max(params.canvasSizePx, vec2<f32>(1.0)) * 0.5;
}

fn projectiveRadiusPx(
  centerM: vec3<f32>,
  radiusM: f32,
  centerClip: vec4<f32>
) -> f32 {
  let dx = projectedAxisOffsetPx(
    centerClip,
    params.viewProjection * vec4<f32>(centerM + vec3<f32>(radiusM, 0.0, 0.0), 1.0)
  );
  let dy = projectedAxisOffsetPx(
    centerClip,
    params.viewProjection * vec4<f32>(centerM + vec3<f32>(0.0, radiusM, 0.0), 1.0)
  );
  let dz = projectedAxisOffsetPx(
    centerClip,
    params.viewProjection * vec4<f32>(centerM + vec3<f32>(0.0, 0.0, radiusM), 1.0)
  );
  // The three projected axis offsets are the columns of a 2x3 screen-space
  // Jacobian. A sphere projects to the ellipse defined by that Jacobian; its
  // outer radius is the largest singular value, not the Frobenius norm (which
  // overstates a centered sphere by sqrt(2)). Compute the largest eigenvalue
  // of A*A^T directly so physical radius remains truthful at every view.
  let rowXX = dx.x * dx.x + dy.x * dy.x + dz.x * dz.x;
  let rowXY = dx.x * dx.y + dy.x * dy.y + dz.x * dz.y;
  let rowYY = dx.y * dx.y + dy.y * dy.y + dz.y * dz.y;
  let eigenGap = sqrt(max(
    0.0,
    (rowXX - rowYY) * (rowXX - rowYY) + 4.0 * rowXY * rowXY
  ));
  let largestEigenvalue = 0.5 * (rowXX + rowYY + eigenGap);
  return sqrt(max(largestEigenvalue, 0.0));
}

fn buildVertex(
  vertexIndex: u32,
  instanceIndex: u32,
  vaporPass: bool
) -> VertexOut {
  let particle = particles[instanceIndex];
  let signedRadiusM = particle.positionRadius.w;
  let belongsToPass = (vaporPass && signedRadiusM < 0.0)
    || (!vaporPass && signedRadiusM > 0.0);
  let rawDisplacementM = particleVelocities[instanceIndex].xyz
    * max(params.motionAgeS, 0.0);
  let rawDisplacementLengthM = length(rawDisplacementM);
  let displacementScale = select(
    1.0,
    params.motionMaxDisplacementM / max(rawDisplacementLengthM, 0.000001),
    params.motionMaxDisplacementM > 0.0
      && rawDisplacementLengthM > params.motionMaxDisplacementM
  );
  let centerM = particle.positionRadius.xyz
    + rawDisplacementM * displacementScale;
  var clip = params.viewProjection * vec4<f32>(centerM, 1.0);
  if (
    clip.w <= 0.0001
    || !belongsToPass
    || particle.color.a <= 0.0
  ) {
    return hiddenVertex();
  }
  let corner = quadCorner(vertexIndex);
  let radiusM = abs(signedRadiusM);
  var pointSizePx = projectiveRadiusPx(centerM, radiusM, clip);
  if (pointSizePx <= 0.0001) {
    pointSizePx = max(radiusM * params.radiusScalePx, params.fallbackPointSizePx);
  }
  pointSizePx = clamp(
    pointSizePx,
    params.minPointSizePx,
    params.maxPointSizePx
  );
  let ndcOffset = corner * vec2<f32>(
    (pointSizePx / max(params.canvasSizePx.x, 1.0)) * 2.0,
    (pointSizePx / max(params.canvasSizePx.y, 1.0)) * 2.0
  );
  let ndc = (clip.xy / clip.w) + ndcOffset;
  clip.z = clip.z * 0.5 + clip.w * 0.5;
  var out: VertexOut;
  out.position = vec4<f32>(ndc * clip.w, clip.z, clip.w);
  out.quadUv = corner;
  out.color = particle.color;
  out.vaporClass = select(0.0, 1.0, vaporPass);
  return out;
}

@vertex
fn vsCondensed(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32
) -> VertexOut {
  return buildVertex(vertexIndex, instanceIndex, false);
}

@vertex
fn vsVapor(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32
) -> VertexOut {
  return buildVertex(vertexIndex, instanceIndex, true);
}

@fragment
fn fsMain(input: VertexOut) -> @location(0) vec4<f32> {
  let radiusSquared = dot(input.quadUv, input.quadUv);
  if (radiusSquared > 1.0) {
    discard;
  }
  let sphereNormal = normalize(vec3<f32>(
    input.quadUv,
    sqrt(max(0.0, 1.0 - radiusSquared))
  ));
  let light = normalize(vec3<f32>(-0.36, 0.52, 0.77));
  let diffuse = 0.34 + 0.66 * max(dot(sphereNormal, light), 0.0);
  let rim = pow(1.0 - max(sphereNormal.z, 0.0), 2.0) * 0.16;
  let condensedEdge = 1.0 - smoothstep(0.90, 1.0, radiusSquared);
  let vaporEdge = 1.0 - smoothstep(0.18, 1.0, radiusSquared);
  let edge = mix(condensedEdge, vaporEdge, input.vaporClass);
  let vaporOpacity = mix(1.0, 0.68, input.vaporClass);
  return vec4<f32>(
    input.color.rgb * (diffuse + rim),
    input.color.a * edge * vaporOpacity
  );
}
`
  });
}

function ensureRenderRowsPipeline() {
  if (
    renderRowsPipeline
    && renderRowsVaporPipeline
    && renderRowsBindGroupLayout
    && renderRowsUniformBuffer
  ) {
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
      },
      {
        binding: 2,
        visibility: gpuShaderStage('VERTEX', SHADER_STAGE_VERTEX),
        buffer: { type: 'read-only-storage' }
      }
    ]
  });
  const pipelineLayout = device.createPipelineLayout({
    label: 'ulg-offscreen-render-rows-pipeline-layout',
    bindGroupLayouts: [renderRowsBindGroupLayout]
  });
  renderRowsPipeline = device.createRenderPipeline({
    label: 'ulg-offscreen-condensed-sphere-impostor-pipeline',
    layout: pipelineLayout,
    vertex: {
      module: shaderModule,
      entryPoint: 'vsCondensed'
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
    },
    depthStencil: {
      format: WORKER_PRESENTATION_DEPTH_FORMAT,
      depthWriteEnabled: true,
      depthCompare: 'less-equal'
    }
  });
  renderRowsVaporPipeline = device.createRenderPipeline({
    label: 'ulg-offscreen-vapor-sphere-impostor-pipeline',
    layout: pipelineLayout,
    vertex: {
      module: shaderModule,
      entryPoint: 'vsVapor'
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
    },
    depthStencil: {
      format: WORKER_PRESENTATION_DEPTH_FORMAT,
      depthWriteEnabled: false,
      depthCompare: 'less-equal'
    }
  });
  renderRowsUniformBuffer = device.createBuffer({
    label: 'ulg-offscreen-render-rows-uniforms',
    size: 24 * Float32Array.BYTES_PER_ELEMENT,
    usage: gpuBufferUsage('UNIFORM', BUFFER_USAGE_UNIFORM)
      | gpuBufferUsage('COPY_DST', BUFFER_USAGE_COPY_DST)
  });
}

function ensureWorkerPresentationDepthView() {
  const width = Math.max(1, Number(canvas?.width) || 1);
  const height = Math.max(1, Number(canvas?.height) || 1);
  if (
    renderDepthTexture
    && renderDepthView
    && renderDepthTextureWidth === width
    && renderDepthTextureHeight === height
  ) {
    return renderDepthView;
  }
  renderDepthTexture?.destroy?.();
  renderDepthTexture = device.createTexture({
    label: 'ulg-offscreen-presentation-depth',
    size: [width, height, 1],
    format: WORKER_PRESENTATION_DEPTH_FORMAT,
    usage: self.GPUTextureUsage?.RENDER_ATTACHMENT ?? TEXTURE_RENDER_ATTACHMENT
  });
  renderDepthView = renderDepthTexture.createView();
  renderDepthTextureWidth = width;
  renderDepthTextureHeight = height;
  return renderDepthView;
}

function ensureWorkerPresentationBoxPipeline() {
  if (
    renderBoxPipeline
    && renderBoxBindGroupLayout
    && renderBoxUniformBuffer
    && renderBoxBindGroup
  ) {
    return;
  }
  const shaderModule = device.createShaderModule({
    label: 'ulg-offscreen-presentation-box-wireframe-shader',
    code: `
struct BoxParams {
  viewProjection: mat4x4<f32>,
  dimsM: vec4<f32>,
  color: vec4<f32>,
};

struct VertexOut {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: BoxParams;

const BOX_EDGES = array<vec3<f32>, 24>(
  vec3<f32>(0., 0., 0.), vec3<f32>(1., 0., 0.),
  vec3<f32>(1., 0., 0.), vec3<f32>(1., 0., 1.),
  vec3<f32>(1., 0., 1.), vec3<f32>(0., 0., 1.),
  vec3<f32>(0., 0., 1.), vec3<f32>(0., 0., 0.),
  vec3<f32>(0., 1., 0.), vec3<f32>(1., 1., 0.),
  vec3<f32>(1., 1., 0.), vec3<f32>(1., 1., 1.),
  vec3<f32>(1., 1., 1.), vec3<f32>(0., 1., 1.),
  vec3<f32>(0., 1., 1.), vec3<f32>(0., 1., 0.),
  vec3<f32>(0., 0., 0.), vec3<f32>(0., 1., 0.),
  vec3<f32>(1., 0., 0.), vec3<f32>(1., 1., 0.),
  vec3<f32>(1., 0., 1.), vec3<f32>(1., 1., 1.),
  vec3<f32>(0., 0., 1.), vec3<f32>(0., 1., 1.)
);

@vertex
fn vsMain(@builtin(vertex_index) index: u32) -> VertexOut {
  let corner = BOX_EDGES[index] * params.dimsM.xyz;
  var clip = params.viewProjection * vec4<f32>(corner, 1.0);
  clip.z = clip.z * 0.5 + clip.w * 0.5;
  if (clip.w <= 0.0001) {
    clip = vec4<f32>(2.0, 2.0, 1.0, 1.0);
  }
  var out: VertexOut;
  out.position = clip;
  out.color = params.color;
  return out;
}

@fragment
fn fsMain(input: VertexOut) -> @location(0) vec4<f32> {
  return input.color;
}
`
  });
  renderBoxBindGroupLayout = device.createBindGroupLayout({
    label: 'ulg-offscreen-presentation-box-wireframe-bind-group-layout',
    entries: [{
      binding: 0,
      visibility: gpuShaderStage('VERTEX', SHADER_STAGE_VERTEX),
      buffer: { type: 'uniform' }
    }]
  });
  renderBoxPipeline = device.createRenderPipeline({
    label: 'ulg-offscreen-presentation-box-wireframe-pipeline',
    layout: device.createPipelineLayout({
      label: 'ulg-offscreen-presentation-box-wireframe-pipeline-layout',
      bindGroupLayouts: [renderBoxBindGroupLayout]
    }),
    vertex: { module: shaderModule, entryPoint: 'vsMain' },
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
    primitive: { topology: 'line-list' },
    depthStencil: {
      format: WORKER_PRESENTATION_DEPTH_FORMAT,
      depthWriteEnabled: false,
      depthCompare: 'less-equal'
    }
  });
  renderBoxUniformBuffer = device.createBuffer({
    label: 'ulg-offscreen-presentation-box-wireframe-uniforms',
    size: 24 * Float32Array.BYTES_PER_ELEMENT,
    usage: gpuBufferUsage('UNIFORM', BUFFER_USAGE_UNIFORM)
      | gpuBufferUsage('COPY_DST', BUFFER_USAGE_COPY_DST)
  });
  renderBoxBindGroup = device.createBindGroup({
    label: 'ulg-offscreen-presentation-box-wireframe-bind-group',
    layout: renderBoxBindGroupLayout,
    entries: [{ binding: 0, resource: { buffer: renderBoxUniformBuffer } }]
  });
}

function normalizeWorkerPresentationBoxDims(value) {
  if (!(Array.isArray(value) || ArrayBuffer.isView(value)) || value.length !== 3) {
    return null;
  }
  const dims = Array.from(value, Number);
  return dims.every((entry) => Number.isFinite(entry) && entry > 0)
    ? dims
    : null;
}

function workerPresentationRenderPassDescriptor() {
  return {
    colorAttachments: [{
      view: context.getCurrentTexture().createView(),
      clearValue: colorToClearValue(backgroundColor, clearAlpha),
      loadOp: 'clear',
      storeOp: 'store'
    }],
    depthStencilAttachment: {
      view: ensureWorkerPresentationDepthView(),
      depthClearValue: 1,
      depthLoadOp: 'clear',
      depthStoreOp: 'discard'
    }
  };
}

function drawWorkerPresentationParticles(pass, bindGroup, particleCount) {
  pass.setPipeline(renderRowsPipeline);
  pass.setBindGroup(0, bindGroup);
  pass.draw(6, particleCount, 0, 0);
  pass.setPipeline(renderRowsVaporPipeline);
  pass.setBindGroup(0, bindGroup);
  pass.draw(6, particleCount, 0, 0);
}

function drawWorkerPresentationBox(pass, viewProjection, boxDimsM) {
  const dims = normalizeWorkerPresentationBoxDims(boxDimsM);
  if (!dims) return null;
  ensureWorkerPresentationBoxPipeline();
  const params = new Float32Array(24);
  params.set(viewProjection, 0);
  params[16] = dims[0];
  params[17] = dims[1];
  params[18] = dims[2];
  params[20] = 0.36;
  params[21] = 0.82;
  params[22] = 0.74;
  params[23] = 0.82;
  device.queue.writeBuffer(renderBoxUniformBuffer, 0, params);
  pass.setPipeline(renderBoxPipeline);
  pass.setBindGroup(0, renderBoxBindGroup);
  pass.draw(24, 1, 0, 0);
  return dims;
}

function armWorkerParticleTemporalPresentation({
  motionRequest = null,
  renderBindGroup = null,
  particleCount = 0,
  viewProjection = null,
  uniformTemplate = null,
  boxDimsM = null,
  sourceReceipt = null,
  onStatus = null,
  scheduleImmediately = true,
  autonomousEnabled = true
} = {}) {
  const motion = normalizeWorkerParticleTemporalMotionRequest(motionRequest);
  if (
    !motion
    || !renderBindGroup
    || !(particleCount > 0)
    || !(uniformTemplate instanceof Float32Array)
    || uniformTemplate.length < 24
    || !sourceReceipt
  ) {
    stopWorkerParticleTemporalPresentation();
    return false;
  }
  stopWorkerParticleTemporalPresentation();
  const submittedAtMs = nowMs();
  workerParticleTemporalPresentation = {
    generation: workerParticleTemporalGeneration,
    motion,
    renderBindGroup,
    particleCount,
    viewProjection: normalizeMatrix(viewProjection),
    uniformTemplate: new Float32Array(uniformTemplate),
    boxDimsM: normalizeWorkerPresentationBoxDims(boxDimsM),
    sourceReceipt: { ...sourceReceipt },
    sourceFrameCount: Number(sourceReceipt.frameCount),
    sourceSphStep: Number.isFinite(Number(sourceReceipt.sphStep))
      ? Number(sourceReceipt.sphStep)
      : null,
    submittedAtMs,
    lastSubmittedAtMs: submittedAtMs,
    lastMotionAgeS: 0,
    autonomousEnabled: autonomousEnabled === true,
    onStatus: typeof onStatus === 'function' ? onStatus : null
  };
  if (scheduleImmediately) scheduleWorkerParticleTemporalPresentation();
  return true;
}

function updateWorkerParticleTemporalViewProjection(viewProjection) {
  if (!workerParticleTemporalPresentation) return false;
  workerParticleTemporalPresentation.viewProjection =
    normalizeMatrix(viewProjection);
  return true;
}

function promoteWorkerParticleTemporalPresentation(sourceReceipt = null) {
  const presentation = workerParticleTemporalPresentation;
  if (!presentation || !sourceReceipt) return false;
  const sourceStep = Number(sourceReceipt.sphStep);
  if (
    Number.isFinite(Number(presentation.sourceSphStep))
    && Number.isFinite(sourceStep)
    && sourceStep !== Number(presentation.sourceSphStep)
  ) return false;
  presentation.sourceReceipt = { ...sourceReceipt };
  presentation.onStatus?.(presentation.sourceReceipt);
  return true;
}

function waitForWorkerParticlePresentationOpportunity({ timeoutMs = 75 } = {}) {
  const boundedTimeoutMs = Math.max(8, Math.round(Number(timeoutMs) || 75));
  return new Promise((resolve) => {
    let settled = false;
    let frameHandle = null;
    let timeoutHandle = null;
    const finish = ({ available, method }) => {
      if (settled) return;
      settled = true;
      if (timeoutHandle != null) globalThis.clearTimeout?.(timeoutHandle);
      resolve(Object.freeze({
        available: available === true,
        method,
        observedAtMs: nowMs()
      }));
    };
    if (typeof self.requestAnimationFrame !== 'function') {
      timeoutHandle = globalThis.setTimeout?.(() => finish({
        available: false,
        method: 'worker-request-animation-frame-unavailable'
      }), 0);
      return;
    }
    frameHandle = self.requestAnimationFrame(() => finish({
      available: true,
      method: 'worker-request-animation-frame-after-gpu-completion'
    }));
    timeoutHandle = globalThis.setTimeout?.(() => {
      try { self.cancelAnimationFrame?.(frameHandle); } catch {}
      finish({
        available: false,
        method: 'worker-request-animation-frame-timeout'
      });
    }, boundedTimeoutMs);
  });
}

function promiseWithinWorkerParticleDeadline(promise, timeoutMs) {
  const boundedTimeoutMs = Math.max(8, Math.round(Number(timeoutMs) || 75));
  let timeoutHandle = null;
  return Promise.race([
    Promise.resolve(promise).then((value) => ({ timedOut: false, value })),
    new Promise((resolve) => {
      timeoutHandle = globalThis.setTimeout?.(
        () => resolve({ timedOut: true, value: null }),
        boundedTimeoutMs
      );
    })
  ]).finally(() => {
    if (timeoutHandle != null) globalThis.clearTimeout?.(timeoutHandle);
  });
}

function trackWorkerParticleKeyframePresentationCompletion({
  queueCompletion = null,
  queueCompletionSerial = null,
  generation = null,
  submittedFramebufferEpoch = null,
  submittedAtMs = nowMs(),
  drawnBoxDimsM = null
} = {}) {
  const presentation = workerParticleTemporalPresentation;
  if (
    !presentation
    || presentation.generation !== generation
  ) return null;
  const completion = (async () => {
    if (!queueCompletion || typeof queueCompletion.then !== 'function') {
      const nextStatus = publishRenderRowsStatus({
        ...presentation.sourceReceipt,
        status: 'worker-offscreen-resident-particle-keyframe-presentation-blocked',
        reason: 'worker-particle-keyframe-queue-completion-unavailable',
        presentationFrameSchema:
          RESIDENT_PARTICLE_KEYFRAME_PRESENTATION_FRAME_SCHEMA,
        presentationFrameStatus:
          'worker-particle-keyframe-queue-completion-unavailable',
        presentationFrameAdmitted: false,
        presentationFrameGpuCompleted: false,
        presentationFramePresentationOpportunity: false,
        presentationQueueCompletionCount: null,
        presentationQueueCompletionSerial: queueCompletionSerial,
        presentationQueueCompletionMethod: null,
        presentationQueueCompletionScope:
          ULG_WORKER_PRESENTATION_FRAME_QUEUE_COMPLETION_SCOPE,
        physicsQueuePrefixCoverage:
          ULG_WORKER_PRESENTATION_PHYSICS_PREFIX_NOT_ATTRIBUTED,
        physicsHostQueueFenceParticipation: null,
        authoritativeStateMutation: false
      });
      presentation.sourceReceipt = { ...nextStatus };
      presentation.onStatus?.(nextStatus);
      return {
        rendered: false,
        gpuCompleted: false,
        presentationOpportunity: false,
        admitted: false,
        reason: 'worker-particle-keyframe-queue-completion-unavailable',
        status: nextStatus
      };
    }
    try {
      await queueCompletion;
    } catch (error) {
      if (
        disposed
        || !workerParticleTemporalPresentation
        || workerParticleTemporalPresentation.generation !== generation
        || !workerFramebufferEpochIsCurrent(submittedFramebufferEpoch)
      ) {
        return {
          rendered: false,
          gpuCompleted: false,
          presentationOpportunity: false,
          admitted: false,
          stale: true,
          reason: 'worker-particle-keyframe-generation-superseded',
          error
        };
      }
      const nextStatus = publishRenderRowsStatus({
        ...presentation.sourceReceipt,
        status: 'worker-offscreen-resident-particle-keyframe-presentation-blocked',
        reason: 'worker-particle-keyframe-queue-completion-failed',
        presentationFrameSchema:
          RESIDENT_PARTICLE_KEYFRAME_PRESENTATION_FRAME_SCHEMA,
        presentationFrameStatus:
          'worker-particle-keyframe-queue-completion-failed',
        presentationFrameAdmitted: false,
        presentationFrameGpuCompleted: false,
        presentationFramePresentationOpportunity: false,
        presentationQueueCompletionCount: null,
        presentationQueueCompletionSerial: queueCompletionSerial,
        presentationQueueCompletionMethod:
          'worker-device.queue.onSubmittedWorkDone',
        presentationQueueCompletionScope:
          ULG_WORKER_PRESENTATION_FRAME_QUEUE_COMPLETION_SCOPE,
        physicsQueuePrefixCoverage:
          ULG_WORKER_PRESENTATION_PHYSICS_PREFIX_NOT_ATTRIBUTED,
        physicsHostQueueFenceParticipation: null,
        authoritativeStateMutation: false,
        ...compactError(error)
      });
      presentation.sourceReceipt = { ...nextStatus };
      presentation.onStatus?.(nextStatus);
      return {
        rendered: false,
        gpuCompleted: false,
        presentationOpportunity: false,
        admitted: false,
        reason: 'worker-particle-keyframe-queue-completion-failed',
        error,
        status: nextStatus
      };
    }
    const gpuCompletedAtMs = nowMs();
    const opportunity = await waitForWorkerParticlePresentationOpportunity({
      timeoutMs: Math.max(50, presentation.motion.minFrameIntervalMs * 4)
    });
    if (
      disposed
      || !workerParticleTemporalPresentation
      || workerParticleTemporalPresentation.generation !== generation
      || !workerFramebufferEpochIsCurrent(submittedFramebufferEpoch)
    ) {
      return {
        rendered: true,
        gpuCompleted: true,
        presentationOpportunity: opportunity.available,
        admitted: false,
        stale: true,
        reason: 'worker-particle-keyframe-generation-superseded'
      };
    }
    const currentPresentation = workerParticleTemporalPresentation;
    const admitted = opportunity.available === true;
    if (admitted) {
      frameCount += 1;
      readyFrameCount = frameCount;
      notePresentedSphStep(currentPresentation.sourceSphStep);
      currentPresentation.sourceFrameCount = frameCount;
    }
    const completedAtMs = opportunity.observedAtMs;
    const nextStatus = publishRenderRowsStatus({
      ...currentPresentation.sourceReceipt,
      status: admitted
        ? 'worker-offscreen-resident-particle-state-producer-rendered'
        : 'worker-offscreen-resident-particle-keyframe-presentation-blocked',
      reason: admitted
        ? 'worker-particle-keyframe-presentation-opportunity'
        : 'worker-particle-keyframe-gpu-completed-without-presentation-opportunity',
      frameCount,
      readyFrameCount,
      readyEver: readyFrameCount > 0,
      workerReady: true,
      workerFramebufferEpoch: submittedFramebufferEpoch,
      updatedAtMs: completedAtMs,
      ...workerPresentationGeometryReceipt(drawnBoxDimsM),
      presentationFrameSchema:
        RESIDENT_PARTICLE_KEYFRAME_PRESENTATION_FRAME_SCHEMA,
      presentationFrameStatus: admitted
        ? 'worker-particle-keyframe-presentation-opportunity'
        : 'worker-particle-keyframe-gpu-completed-without-presentation-opportunity',
      presentationFrameAdmitted: admitted,
      presentationFrameGpuCompleted: true,
      presentationFrameGpuCompletedAtMs: gpuCompletedAtMs,
      presentationFramePresentationOpportunity: admitted,
      presentationFramePresentationOpportunityMethod: opportunity.method,
      presentationFrameSubmitToGpuCompleteMs: Math.max(
        0,
        gpuCompletedAtMs - submittedAtMs
      ),
      presentationFrameSubmitToPresentationOpportunityMs: Math.max(
        0,
        completedAtMs - submittedAtMs
      ),
      presentationQueueCompletionCount: queueCompletionSerial,
      presentationQueueCompletionSerial: queueCompletionSerial,
      presentationQueueCompletionMethod:
        'worker-device.queue.onSubmittedWorkDone',
      presentationQueueCompletionScope:
        ULG_WORKER_PRESENTATION_FRAME_QUEUE_COMPLETION_SCOPE,
      physicsQueuePrefixCoverage:
        ULG_WORKER_PRESENTATION_PHYSICS_PREFIX_NOT_ATTRIBUTED,
      physicsHostQueueFenceParticipation: null,
      authoritativeStateMutation: false
    });
    currentPresentation.sourceReceipt = { ...nextStatus };
    currentPresentation.onStatus?.(nextStatus);
    return {
      rendered: true,
      gpuCompleted: true,
      presentationOpportunity: admitted,
      admitted,
      status: nextStatus
    };
  })();
  let trackedCompletion = null;
  trackedCompletion = completion.then(
    (result) => {
      if (workerParticleTemporalFrameInFlight === trackedCompletion) {
        workerParticleTemporalFrameInFlight = null;
        if (
          result?.admitted === true
          && workerParticleTemporalPresentation?.autonomousEnabled === true
          && !workerParticleTemporalAuthorityAdmissionPending
        ) {
          scheduleWorkerParticleTemporalPresentation({
            preferImmediate: true,
            // Start halfway to the first deterministic QoS boundary. This
            // keeps the first autonomous cover distinct from the boundary's
            // exact completed-substep age even when wall time lands on it.
            motionAgeSOverride:
              workerParticleFirstSlotMidpointMotionAgeS()
          });
        }
      }
      return result;
    },
    (error) => {
      if (workerParticleTemporalFrameInFlight === trackedCompletion) {
        workerParticleTemporalFrameInFlight = null;
      }
      throw error;
    }
  );
  workerParticleTemporalFrameInFlight = trackedCompletion;
  return trackedCompletion;
}

function drawWorkerParticleTemporalMotionFrame({
  reason = 'worker-particle-temporal-motion-frame',
  force = false,
  boundary = null,
  motionAgeSOverride = null
} = {}) {
  const presentation = workerParticleTemporalPresentation;
  if (
    !presentation
    || presentation.autonomousEnabled !== true
    || !device
    || !context
    || !format
    || disposed
  ) {
    return { rendered: false, horizonExhausted: true, completion: null };
  }
  if (workerParticleTemporalFrameInFlight) {
    return {
      rendered: false,
      horizonExhausted: false,
      frameInFlight: true,
      completion: workerParticleTemporalFrameInFlight
    };
  }
  const drawAtMs = nowMs();
  const minimumIntervalMs = presentation.motion.minFrameIntervalMs;
  if (
    force !== true
    &&
    drawAtMs - presentation.lastSubmittedAtMs
      < minimumIntervalMs * 0.9
  ) {
    return { rendered: false, horizonExhausted: false, completion: null };
  }
  const rawAgeS = Math.max(0, (drawAtMs - presentation.submittedAtMs) / 1000);
  const boundaryCompletedSubsteps = Number(boundary?.completedSubstepCount);
  const boundaryTotalSubsteps = Number(boundary?.totalSubstepCount);
  const boundaryProgressReady = Boolean(
    boundary
    && Number.isSafeInteger(boundaryCompletedSubsteps)
    && Number.isSafeInteger(boundaryTotalSubsteps)
    && boundaryCompletedSubsteps > 0
    && boundaryTotalSubsteps > 0
    && boundaryCompletedSubsteps < boundaryTotalSubsteps
  );
  // Forced queue-boundary frames represent an exact fraction of the logical
  // K-step transaction. Their motion age must not depend on whether a fence
  // happened to resolve just before or after vsync. Autonomous frames retain
  // wall-time extrapolation between those deterministic anchors.
  const wallMotionAgeS = Math.min(
    rawAgeS * presentation.motion.simulationTimeScale,
    presentation.motion.maxSimulationAgeS
  );
  const boundaryMotionAgeS = boundaryProgressReady
    ? presentation.motion.maxSimulationAgeS
      * boundaryCompletedSubsteps / boundaryTotalSubsteps
    : null;
  const requestedMotionAgeS = Number(motionAgeSOverride);
  const motionAgeOverrideReady = Boolean(
    Number.isFinite(requestedMotionAgeS)
    && requestedMotionAgeS > 0
  );
  const motionAgeS = motionAgeOverrideReady
    ? Math.max(
        presentation.lastMotionAgeS,
        Math.min(
          requestedMotionAgeS,
          presentation.motion.maxSimulationAgeS
        )
      )
    : boundaryProgressReady
      ? Math.max(
          presentation.lastMotionAgeS,
          Math.min(
            boundaryMotionAgeS,
            presentation.motion.maxSimulationAgeS
          )
        )
      : wallMotionAgeS;
  const horizonExhausted = motionAgeOverrideReady || boundaryProgressReady
    ? false
    : rawAgeS >= presentation.motion.maxHorizonS - 1e-6
      || motionAgeS >= presentation.motion.maxSimulationAgeS - 1e-6;
  if (motionAgeS <= presentation.lastMotionAgeS + 1e-6) {
    return { rendered: false, horizonExhausted, completion: null };
  }
  const uniforms = new Float32Array(presentation.uniformTemplate);
  uniforms.set(presentation.viewProjection, 0);
  uniforms[22] = motionAgeS;
  uniforms[23] = presentation.motion.maxDisplacementM;
  device.queue.writeBuffer(renderRowsUniformBuffer, 0, uniforms);
  const encoder = device.createCommandEncoder({
    label: 'ulg-offscreen-particle-temporal-motion-encoder'
  });
  const pass = encoder.beginRenderPass(workerPresentationRenderPassDescriptor());
  drawWorkerPresentationParticles(
    pass,
    presentation.renderBindGroup,
    presentation.particleCount
  );
  const drawnBoxDimsM = drawWorkerPresentationBox(
    pass,
    presentation.viewProjection,
    presentation.boxDimsM
  );
  pass.end();
  const motionFramebufferEpoch = currentWorkerFramebufferEpoch();
  if (motionFramebufferEpoch == null) {
    return { rendered: false, horizonExhausted: true, completion: null };
  }
  device.queue.submit([encoder.finish()]);
  workerParticleTemporalSubmittedFrameSerial += 1;
  const submittedFrameSerial = workerParticleTemporalSubmittedFrameSerial;
  const submittedGeneration = presentation.generation;
  presentation.lastSubmittedAtMs = drawAtMs;
  presentation.lastMotionAgeS = motionAgeS;
  let queueCompletion = null;
  let queueCompletionSerial = null;
  try {
    queueCompletion = typeof device.queue?.onSubmittedWorkDone === 'function'
      ? device.queue.onSubmittedWorkDone()
      : null;
    if (queueCompletion && typeof queueCompletion.then === 'function') {
      workerPresentationQueueCompletionSerial += 1;
      queueCompletionSerial = workerPresentationQueueCompletionSerial;
    }
  } catch {}
  const completion = (async () => {
    if (!queueCompletion || typeof queueCompletion.then !== 'function') {
      return {
        rendered: true,
        gpuCompleted: false,
        presentationOpportunity: false,
        admitted: false,
        reason: 'worker-particle-temporal-queue-completion-unavailable'
      };
    }
    try {
      await queueCompletion;
    } catch (error) {
      return {
        rendered: true,
        gpuCompleted: false,
        presentationOpportunity: false,
        admitted: false,
        reason: 'worker-particle-temporal-queue-completion-failed',
        error
      };
    }
    const gpuCompletedAtMs = nowMs();
    const opportunity = await waitForWorkerParticlePresentationOpportunity({
      timeoutMs: Math.max(50, presentation.motion.minFrameIntervalMs * 4)
    });
    if (
      disposed
      || !workerParticleTemporalPresentation
      || workerParticleTemporalPresentation.generation !== submittedGeneration
      || !workerFramebufferEpochIsCurrent(motionFramebufferEpoch)
    ) {
      return {
        rendered: true,
        gpuCompleted: true,
        presentationOpportunity: opportunity.available,
        admitted: false,
        stale: true,
        reason: 'worker-particle-temporal-generation-superseded'
      };
    }
    const currentPresentation = workerParticleTemporalPresentation;
    const admitted = opportunity.available === true;
    if (admitted) {
      frameCount += 1;
      readyFrameCount = frameCount;
      notePresentedSphStep(currentPresentation.sourceSphStep);
      workerParticleTemporalMotionFrameSerial += 1;
    }
    const completedAtMs = opportunity.observedAtMs;
    const nextStatus = publishRenderRowsStatus({
      ...currentPresentation.sourceReceipt,
      status: 'worker-offscreen-resident-particle-state-producer-rendered',
      reason,
      frameCount,
      readyFrameCount,
      readyEver: true,
      workerReady: true,
      workerFramebufferEpoch: motionFramebufferEpoch,
      updatedAtMs: completedAtMs,
      ...workerPresentationGeometryReceipt(drawnBoxDimsM),
      motionFrameSchema: RESIDENT_PARTICLE_TEMPORAL_MOTION_FRAME_SCHEMA,
      motionFrameStatus: admitted
        ? 'worker-particle-temporal-motion-frame-presentation-opportunity'
        : 'worker-particle-temporal-motion-frame-gpu-completed-without-presentation-opportunity',
      motionFrameAdmitted: admitted,
      motionFrameSubmittedSerial: submittedFrameSerial,
      motionFrameGpuCompleted: true,
      motionFrameGpuCompletedAtMs: gpuCompletedAtMs,
      motionFramePresentationOpportunity: admitted,
      motionFramePresentationOpportunityMethod: opportunity.method,
      motionFrameSerial: admitted
        ? workerParticleTemporalMotionFrameSerial
        : null,
      motionSourceFrameCount: currentPresentation.sourceFrameCount,
      motionSourceSphStep: currentPresentation.sourceSphStep,
      motionAgeS,
      motionHorizonS: currentPresentation.motion.maxHorizonS,
      motionSimulationTimeScale:
        currentPresentation.motion.simulationTimeScale,
      motionMaxSimulationAgeS:
        currentPresentation.motion.maxSimulationAgeS,
      motionMaxDisplacementM: currentPresentation.motion.maxDisplacementM,
      motionTargetHz: currentPresentation.motion.targetHz,
      motionMethod: currentPresentation.motion.method,
      motionVelocityBufferRetained: true,
      motionVelocitySourceLanes: [
        ...currentPresentation.motion.sourceVelocityLanes
      ],
      motionSubmitToGpuCompleteMs: Math.max(0, gpuCompletedAtMs - drawAtMs),
      motionSubmitToPresentationOpportunityMs: Math.max(
        0,
        completedAtMs - drawAtMs
      ),
      presentationQueueCompletionCount: queueCompletionSerial,
      presentationQueueCompletionSerial: queueCompletionSerial,
      presentationQueueCompletionMethod:
        'worker-device.queue.onSubmittedWorkDone',
      presentationQueueCompletionScope:
        ULG_WORKER_PRESENTATION_FRAME_QUEUE_COMPLETION_SCOPE,
      physicsQueuePrefixCoverage: boundaryProgressReady
        ? ULG_WORKER_PRESENTATION_PHYSICS_PREFIX_INCLUDED
        : ULG_WORKER_PRESENTATION_PHYSICS_PREFIX_NOT_ATTRIBUTED,
      physicsHostQueueFenceParticipation: boundaryProgressReady
        ? true
        : null,
      motionAgeSource: motionAgeOverrideReady
        ? 'explicit-qos-midpoint'
        : boundaryProgressReady
          ? 'completed-substep-boundary'
          : 'bounded-wall-clock',
      ...(boundary && typeof boundary === 'object'
        ? { motionPresentationQosBoundary: { ...boundary } }
        : {}),
      authoritativeStateMutation: false
    });
    currentPresentation.sourceReceipt = { ...nextStatus };
    currentPresentation.onStatus?.(nextStatus);
    return {
      rendered: true,
      gpuCompleted: true,
      presentationOpportunity: admitted,
      admitted,
      status: nextStatus
    };
  })();
  let trackedCompletion = null;
  trackedCompletion = completion.finally(() => {
    if (workerParticleTemporalFrameInFlight === trackedCompletion) {
      workerParticleTemporalFrameInFlight = null;
    }
  });
  workerParticleTemporalFrameInFlight = trackedCompletion;
  return {
    rendered: true,
    horizonExhausted,
    submittedFrameSerial,
    completion: trackedCompletion
  };
}

export async function runWorkerParticleTemporalPresentationSubmissionBoundary(
  boundary = {}
) {
  workerParticleTemporalBoundaryPending = true;
  cancelWorkerParticleTemporalAnimationFrame();
  let terminalHandoffCoverReady = false;
  let terminalHandoffMotionAgeS = null;
  try {
    const presentation = workerParticleTemporalPresentation;
    if (
      !presentation
      || presentation.autonomousEnabled !== true
      || disposed
    ) {
      throw new Error(
        'worker particle temporal presentation is unavailable at the fused submission boundary'
      );
    }
    const boundaryGeneration = presentation.generation;
    const deadlineMs = Math.max(
      50,
      presentation.motion.minFrameIntervalMs * 4
    );
    if (workerParticleTemporalFrameInFlight) {
      const prior = await promiseWithinWorkerParticleDeadline(
        workerParticleTemporalFrameInFlight,
        deadlineMs
      );
      if (prior.timedOut) {
        invalidateWorkerParticleTemporalFrameInFlight();
        throw new Error(
          'worker particle temporal presentation prior frame missed the QoS boundary deadline'
        );
      }
      cancelWorkerParticleTemporalAnimationFrame();
    }
    if (
      disposed
      || !workerParticleTemporalPresentation
      || workerParticleTemporalPresentation.generation !== boundaryGeneration
    ) {
      throw new Error(
        'worker particle temporal presentation was superseded at the QoS boundary'
      );
    }
    const draw = drawWorkerParticleTemporalMotionFrame({
      reason: 'worker-particle-temporal-fused-submission-boundary',
      force: true,
      boundary
    });
    if (!draw.rendered || !draw.completion) {
      throw new Error(
        draw.horizonExhausted
          ? 'worker particle temporal presentation exhausted its bounded horizon'
          : 'worker particle temporal presentation did not submit at the QoS boundary'
      );
    }
    const completed = await promiseWithinWorkerParticleDeadline(
      draw.completion,
      deadlineMs
    );
    if (completed.timedOut) {
      invalidateWorkerParticleTemporalFrameInFlight();
      throw new Error(
        'worker particle temporal presentation missed the QoS boundary deadline'
      );
    }
    if (completed.value?.admitted !== true) {
      throw new Error(
        completed.value?.reason
        || 'worker particle temporal presentation lacked a completed presentation opportunity'
      );
    }
    const completedSubstepCount = Number(boundary?.completedSubstepCount);
    const totalSubstepCount = Number(boundary?.totalSubstepCount);
    const chunkStepCount = Number(boundary?.chunkStepCount);
    terminalHandoffCoverReady = Boolean(
      Number.isSafeInteger(completedSubstepCount)
      && Number.isSafeInteger(totalSubstepCount)
      && Number.isSafeInteger(chunkStepCount)
      && completedSubstepCount > 0
      && chunkStepCount > 0
      && completedSubstepCount < totalSubstepCount
      && completedSubstepCount + chunkStepCount >= totalSubstepCount
    );
    if (terminalHandoffCoverReady) {
      terminalHandoffMotionAgeS = presentation.motion.maxSimulationAgeS
        * (
          completedSubstepCount
          + (totalSubstepCount - completedSubstepCount) / 2
        )
        / totalSubstepCount;
    }
    return Object.freeze({
      schema: ULG_WORKER_TIER0_PRESENTATION_QOS_BOUNDARY_PROOF_SCHEMA,
      status: ULG_WORKER_TIER0_PRESENTATION_QOS_BOUNDARY_PROOF_STATUS,
      submissionOrdinal: Number(boundary?.submissionOrdinal) || null,
      completedSubstepCount: Number(boundary?.completedSubstepCount) || null,
      totalSubstepCount: Number(boundary?.totalSubstepCount) || null,
      chunkStepCount: Number(boundary?.chunkStepCount) || null,
      motionFrameSubmittedSerial:
        draw.submittedFrameSerial ?? null,
      motionFrameSerial:
        completed.value?.status?.motionFrameSerial ?? null,
      gpuCompleted: true,
      gpuCompletionMethod: 'worker-device.queue.onSubmittedWorkDone',
      presentationOpportunity: true,
      presentationOpportunityMethod:
        completed.value?.status?.motionFramePresentationOpportunityMethod
        ?? null,
      queuePrefixCoveredPhysics: true,
      presentationQueueCompletionScope:
        ULG_WORKER_PRESENTATION_FRAME_QUEUE_COMPLETION_SCOPE,
      physicsQueuePrefixCoverage:
        ULG_WORKER_PRESENTATION_PHYSICS_PREFIX_INCLUDED,
      physicsContinuationBlocked: true,
      presentationQosHostQueueFenceCount: 1,
      terminalHandoffCoverReady,
      presentationQueueCompletionCount:
        completed.value?.status?.presentationQueueCompletionCount ?? null,
      presentationQueueCompletionSerial:
        completed.value?.status?.presentationQueueCompletionSerial ?? null,
      presentationQueueCompletionMethod:
        completed.value?.status?.presentationQueueCompletionMethod ?? null
    });
  } finally {
    workerParticleTemporalBoundaryPending = false;
    if (terminalHandoffCoverReady) {
      // The boundary's post-GPU rAF is also the pacing edge for one final
      // old-source cover. Submit it now so it can be proved on the next rAF
      // while the terminal mechanics chunk/fence completes. The terminal
      // keyframe then supersedes it and is proved on the following edge.
      scheduleWorkerParticleTemporalPresentation({
        preferImmediate: true,
        continueAfterAdmission: false,
        motionAgeSOverride: terminalHandoffMotionAgeS
      });
    }
  }
}

function ensureWorkerOwnedIsosurfacePresenter() {
  if (workerOwnedIsosurfacePresenter) return workerOwnedIsosurfacePresenter;
  if (!device || !context || !format) {
    throw new Error('worker-owned isosurface presentation requires an initialized canvas device');
  }
  workerOwnedIsosurfacePresenter = createWorkerOwnedIsosurfacePresenter({
    device,
    context,
    format,
    depthFormat: WORKER_PRESENTATION_DEPTH_FORMAT,
    getDepthView: () => ensureWorkerPresentationDepthView(),
    drawOverlay(pass, viewProjection, boxDimsM) {
      drawWorkerPresentationBox(pass, viewProjection, boxDimsM);
    },
    waitForPresentationOpportunity: () =>
      waitForWorkerParticlePresentationOpportunity({ timeoutMs: 100 }),
    getFramebufferEpoch: () => workerFramebufferEpoch,
    nextPresentationQueueCompletionSerial() {
      workerPresentationQueueCompletionSerial += 1;
      return workerPresentationQueueCompletionSerial;
    },
    onFrameSubmitted({ sphStep }) {
      frameCount += 1;
      readyFrameCount = frameCount;
      notePresentedSphStep(sphStep);
    },
    onTerminal(receipt) {
      publishRenderRowsStatus({
        ...receipt,
        renderRowsSchema: RENDER_ROWS_SCHEMA,
        inputTransport: RESIDENT_RENDER_PRODUCER_TRANSPORT,
        producerSourceKind: 'worker-retained-resident-stage-output',
        producerSourceTransport: RESIDENT_STAGE_OUTPUT_TRANSPORT,
        sourceStageId: 'schroederSameLevelMechanics',
        workerLocalRenderRowsProduced:
          receipt?.status
            === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS,
        frameCount,
        readyFrameCount,
        readyEver: readyFrameCount > 0
      });
    }
  });
  return workerOwnedIsosurfacePresenter;
}

function workerPresentationGeometryReceipt(boxDimsM) {
  return {
    presentationGeometry: 'sphere-impostor-depth-fallback',
    particleImpostorShape: 'projective-circular-lit-disc',
    particleImpostorPassCount: 2,
    projectiveParticleSizing: true,
    particleDepthModel: 'center-plane-depth',
    depthAttachmentFormat: WORKER_PRESENTATION_DEPTH_FORMAT,
    depthAttachmentReady: Boolean(renderDepthTexture && renderDepthView),
    condensedDepthTestEnabled: true,
    condensedDepthWriteEnabled: true,
    vaporDepthTestEnabled: true,
    vaporDepthWriteEnabled: false,
    boxWireframeDrawCount: boxDimsM ? 1 : 0,
    boxDimsM: boxDimsM ? [...boxDimsM] : null,
    sameDevicePresentation: true
  };
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

function ensureRenderRowsParticleVelocityBuffer(byteLength) {
  const nextByteLength = Math.max(
    4 * Float32Array.BYTES_PER_ELEMENT,
    Math.ceil(Number(byteLength) || 0)
  );
  if (
    renderRowsParticleVelocityBuffer
    && renderRowsParticleVelocityBufferByteLength >= nextByteLength
  ) return;
  renderRowsParticleVelocityBuffer?.destroy?.();
  renderRowsParticleVelocityBuffer = device.createBuffer({
    label: 'ulg-offscreen-render-rows-particle-velocities',
    size: nextByteLength,
    usage: gpuBufferUsage('STORAGE', BUFFER_USAGE_STORAGE)
      | gpuBufferUsage('COPY_DST', BUFFER_USAGE_COPY_DST)
  });
  renderRowsParticleVelocityBufferByteLength = nextByteLength;
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
  // Preserve the signed presentation radius packed by the shared bridge.
  // Negative means exact gas (depth-tested/non-depth-writing); zero remains a
  // deliberately hidden dormant row. This producer never changes physics.
  outputParticles[index].positionRadius = source.positionRadius;
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
@group(0) @binding(5) var<storage, read_write> outputVelocities: array<vec4<f32>>;

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
  // Phase-carrier topology preallocates dormant product/companion rows with
  // zero mass. They are capacity, not visible particles. Rendering them with
  // the fallback radius overlays every live carrier with a white square and
  // makes truthful motion/reaction frames look frozen.
  if (!(massKg > 0.0)) {
    outputParticles[index].positionRadius = vec4<f32>(
      stateRows[stateOffset + 0u],
      stateRows[stateOffset + 1u],
      stateRows[stateOffset + 2u],
      0.0
    );
    outputParticles[index].color = vec4<f32>(0.0);
    outputVelocities[index] = vec4<f32>(0.0);
    return;
  }
  let fallbackRadiusM = max(params.values.x, 0.000001);
  let densityRadiusM = radiusFromMassDensity(massKg, restDensityKgPerM3, fallbackRadiusM);
  var radiusM = select(densityRadiusM, visualRadiusM, visualRadiusM > 0.0);
  if (smoothingLengthM > 0.0) {
    radiusM = min(radiusM, smoothingLengthM * 12.0);
  }
  // A signed visual radius is worker-local presentation metadata. It lets
  // one generic producer route exact gas through a depth-tested,
  // non-depth-writing pass while plasma and condensed carriers retain normal
  // depth writes; the physical state/thermo buffers remain untouched.
  let vaporLike = abs(phaseId - ${GAS_PHASE_ID}.0) < 0.5;
  let signedRadiusM = select(
    max(radiusM, 0.000001),
    -max(radiusM, 0.000001),
    vaporLike
  );
  outputParticles[index].positionRadius = vec4<f32>(
    stateRows[stateOffset + 0u],
    stateRows[stateOffset + 1u],
    stateRows[stateOffset + 2u],
    signedRadiusM
  );
  let color = materialPhaseColor(materialId, phaseId);
  outputParticles[index].color = vec4<f32>(color.rgb, color.a * clamp(params.values.y, 0.0, 1.0));
  outputVelocities[index] = vec4<f32>(
    stateRows[stateOffset + 4u],
    stateRows[stateOffset + 5u],
    stateRows[stateOffset + 6u],
    1.0
  );
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
      },
      {
        binding: 5,
        visibility: gpuShaderStage('COMPUTE', SHADER_STAGE_COMPUTE),
        buffer: { type: 'storage' }
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
  const framebufferEpoch = submittedWorkerFramebufferEpoch(data);
  if (framebufferEpoch == null) {
    return publishRenderRowsStatus({
      status: 'worker-offscreen-presentation-superseded-stale-framebuffer-epoch',
      reason: 'draw-render-rows carries a stale worker framebuffer epoch',
      workerFramebufferEpoch: normalizeWorkerFramebufferEpoch(
        data.workerFramebufferEpoch
      )
    });
  }
  if (!presentationStepAccepts(data.sphStep)) {
    return publishRenderRowsStatus({
      schema: RESIDENT_PARTICLE_STATE_PRODUCER_SCHEMA,
      renderRowsSchema: RENDER_ROWS_SCHEMA,
      status: 'worker-offscreen-presentation-superseded-stale-step',
      reason: `draw carries sphStep ${data.sphStep} older than presented ${lastPresentedSphStep}`,
      sphStep: Number(data.sphStep),
      lastPresentedSphStep: Number(lastPresentedSphStep),
      particleCount: data.particleCount ?? 0,
      inputTransferBytes: 0,
      ...committedResidentSchedulePresentationRenderReceiptFields(data)
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
  stopWorkerParticleTemporalPresentation();
  configureCanvas({
    width: data.width,
    height: data.height,
    nextCssWidth: data.cssWidth,
    nextCssHeight: data.cssHeight,
    nextPixelRatio: data.pixelRatio,
    reason: 'draw-render-rows'
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
  ensureRenderRowsParticleVelocityBuffer(
    particleCount * 4 * Float32Array.BYTES_PER_ELEMENT
  );
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
      { binding: 1, resource: { buffer: renderRowsUniformBuffer } },
      {
        binding: 2,
        resource: {
          buffer: renderRowsParticleVelocityBuffer,
          size: particleCount * 4 * Float32Array.BYTES_PER_ELEMENT
        }
      }
    ]
  });
  const encoder = device.createCommandEncoder({ label: 'ulg-offscreen-render-rows-encoder' });
  const pass = encoder.beginRenderPass(workerPresentationRenderPassDescriptor());
  drawWorkerPresentationParticles(pass, bindGroup, particleCount);
  const drawnBoxDimsM = drawWorkerPresentationBox(
    pass,
    viewProjection,
    data.boxDimsM
  );
  pass.end();
  device.queue.submit([encoder.finish()]);
  frameCount += 1;
  notePresentedSphStep(data.sphStep);
  readyFrameCount = frameCount;
  return publishRenderRowsStatus({
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
    ...workerPresentationGeometryReceipt(drawnBoxDimsM),
    frameCount,
    readyEver: true,
    readyFrameCount,
    workerReady: true,
    workerFramebufferEpoch: framebufferEpoch
  });
}

function drawResidentRenderProducer(data) {
  const framebufferEpoch = submittedWorkerFramebufferEpoch(data);
  if (framebufferEpoch == null) {
    return publishRenderRowsStatus({
      schema: RESIDENT_RENDER_PRODUCER_SCHEMA,
      status: 'worker-offscreen-presentation-superseded-stale-framebuffer-epoch',
      reason:
        'draw-resident-render-producer carries a stale worker framebuffer epoch',
      workerFramebufferEpoch: normalizeWorkerFramebufferEpoch(
        data.workerFramebufferEpoch
      )
    });
  }
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
      workerReady: false,
      ...committedResidentSchedulePresentationRenderReceiptFields(data)
    });
    return;
  }
  stopWorkerParticleTemporalPresentation();
  configureCanvas({
    width: data.width,
    height: data.height,
    nextCssWidth: data.cssWidth,
    nextCssHeight: data.cssHeight,
    nextPixelRatio: data.pixelRatio,
    reason: 'draw-resident-render-producer'
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
  ensureRenderRowsParticleVelocityBuffer(
    particleCount * 4 * Float32Array.BYTES_PER_ELEMENT
  );
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
      { binding: 1, resource: { buffer: renderRowsUniformBuffer } },
      {
        binding: 2,
        resource: {
          buffer: renderRowsParticleVelocityBuffer,
          size: particleCount * 4 * Float32Array.BYTES_PER_ELEMENT
        }
      }
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
  const renderPass = encoder.beginRenderPass(workerPresentationRenderPassDescriptor());
  drawWorkerPresentationParticles(renderPass, renderBindGroup, particleCount);
  const drawnBoxDimsM = drawWorkerPresentationBox(
    renderPass,
    viewProjection,
    data.boxDimsM
  );
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
    ...workerPresentationGeometryReceipt(drawnBoxDimsM),
    frameCount,
    readyEver: true,
    readyFrameCount,
    workerReady: true,
    workerFramebufferEpoch: framebufferEpoch
  });
}

function drawResidentParticleStateProducer(data) {
  const framebufferEpoch = submittedWorkerFramebufferEpoch(data);
  if (framebufferEpoch == null) {
    return publishRenderRowsStatus({
      schema: RESIDENT_PARTICLE_STATE_PRODUCER_SCHEMA,
      status: 'worker-offscreen-presentation-superseded-stale-framebuffer-epoch',
      reason:
        'draw-resident-particle-state-producer carries a stale worker framebuffer epoch',
      workerFramebufferEpoch: normalizeWorkerFramebufferEpoch(
        data.workerFramebufferEpoch
      )
    });
  }
  if (!presentationStepAccepts(data.sphStep)) {
    return publishRenderRowsStatus({
      schema: RESIDENT_PARTICLE_STATE_PRODUCER_SCHEMA,
      renderRowsSchema: RENDER_ROWS_SCHEMA,
      status: 'worker-offscreen-presentation-superseded-stale-step',
      reason: `draw carries sphStep ${data.sphStep} older than presented ${lastPresentedSphStep}`,
      sphStep: Number(data.sphStep),
      lastPresentedSphStep: Number(lastPresentedSphStep),
      particleCount: data.particleCount ?? 0,
      inputTransferBytes: 0,
      ...committedResidentSchedulePresentationRenderReceiptFields(data)
    });
  }
  if (!device || !context || !format) {
    publishRenderRowsStatus({
      schema: RESIDENT_PARTICLE_STATE_PRODUCER_SCHEMA,
      renderRowsSchema: RENDER_ROWS_SCHEMA,
      status: 'worker-offscreen-resident-particle-state-producer-blocked-webgpu-unavailable',
      reason: 'WebGPU device/context is unavailable',
      inputTransport: RESIDENT_RENDER_PRODUCER_TRANSPORT,
      workerReady: false,
      ...committedResidentSchedulePresentationRenderReceiptFields(data)
    });
    return;
  }
  stopWorkerParticleTemporalPresentation();
  configureCanvas({
    width: data.width,
    height: data.height,
    nextCssWidth: data.cssWidth,
    nextCssHeight: data.cssHeight,
    nextPixelRatio: data.pixelRatio,
    reason: 'draw-resident-particle-state-producer'
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
      sourceStateTransferBytes: 0,
      ...committedResidentSchedulePresentationRenderReceiptFields(data)
    });
  }
  backgroundColor = data.backgroundColor || backgroundColor;
  clearAlpha = Number.isFinite(Number(data.clearAlpha)) ? Number(data.clearAlpha) : clearAlpha;
  ensureRenderRowsPipeline();
  ensureResidentParticleStateProducerPipeline();
  const outputByteLength = particleCount
    * RENDER_ROW_PARTICLE_STRIDE_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  const velocityByteLength = particleCount
    * 4
    * Float32Array.BYTES_PER_ELEMENT;
  ensureRenderRowsParticleBuffer(outputByteLength);
  ensureRenderRowsParticleVelocityBuffer(velocityByteLength);
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
      { binding: 4, resource: { buffer: residentParticleStateProducerParamsBuffer } },
      {
        binding: 5,
        resource: {
          buffer: renderRowsParticleVelocityBuffer,
          size: velocityByteLength
        }
      }
    ]
  });
  const renderBindGroup = device.createBindGroup({
    label: 'ulg-offscreen-resident-particle-state-producer-render-bind-group',
    layout: renderRowsBindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: renderRowsParticleBuffer, size: outputByteLength } },
      { binding: 1, resource: { buffer: renderRowsUniformBuffer } },
      {
        binding: 2,
        resource: {
          buffer: renderRowsParticleVelocityBuffer,
          size: velocityByteLength
        }
      }
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
  const renderPass = encoder.beginRenderPass(workerPresentationRenderPassDescriptor());
  drawWorkerPresentationParticles(renderPass, renderBindGroup, particleCount);
  const drawnBoxDimsM = drawWorkerPresentationBox(
    renderPass,
    viewProjection,
    data.boxDimsM
  );
  renderPass.end();
  const temporalMotion = normalizeWorkerParticleTemporalMotionRequest(
    data.temporalMotion
  );
  const keyframePresentationProofRequired = Boolean(
    temporalMotion
    || data.residentScheduleCandidatePresentation === true
  );
  // Every authority-bearing particle candidate needs the same queue-complete
  // plus post-completion presentation-opportunity proof. A candidate without
  // autonomous extrapolation still arms the proof state, but can never enter
  // the temporal frame scheduler.
  const keyframeProofMotionRequest = temporalMotion ?? (
    keyframePresentationProofRequired
      ? {
          schema: RESIDENT_PARTICLE_TEMPORAL_MOTION_SCHEMA,
          enabled: true,
          targetHz: DEFAULT_PARTICLE_TEMPORAL_TARGET_HZ,
          presentationSlotCount: 1,
          maxHorizonS: 1 / DEFAULT_PARTICLE_TEMPORAL_TARGET_HZ,
          simulationTimeScale: 1,
          maxSimulationAgeS: 1e-6,
          maxDisplacementM: 1e-6
        }
      : null
  );
  const keyframeSubmittedAtMs = nowMs();
  device.queue.submit([encoder.finish()]);
  let keyframeQueueCompletion = null;
  let keyframeQueueCompletionSerial = null;
  if (keyframePresentationProofRequired) {
    try {
      keyframeQueueCompletion =
        typeof device.queue?.onSubmittedWorkDone === 'function'
          ? device.queue.onSubmittedWorkDone()
          : null;
      if (
        keyframeQueueCompletion
        && typeof keyframeQueueCompletion.then === 'function'
      ) {
        workerPresentationQueueCompletionSerial += 1;
        keyframeQueueCompletionSerial =
          workerPresentationQueueCompletionSerial;
      }
    } catch {}
  } else {
    frameCount += 1;
    notePresentedSphStep(data.sphStep);
    readyFrameCount = frameCount;
  }
  const sourceStateTransferBytes = (sourceCacheHit || workerRetainedStageOutputSource)
    ? 0
    : stateByteLength + thermoByteLength + colorRowsByteLength;
  const inputTransferBytes = workerRetainedStageOutputSource
    ? viewProjection.byteLength + colorRowsByteLength
    : sourceStateTransferBytes + viewProjection.byteLength;
  const initialStatus = publishRenderRowsStatus({
    schema: RESIDENT_PARTICLE_STATE_PRODUCER_SCHEMA,
    renderRowsSchema: RENDER_ROWS_SCHEMA,
    status: keyframePresentationProofRequired
      ? 'worker-offscreen-resident-particle-keyframe-submitted'
      : 'worker-offscreen-resident-particle-state-producer-rendered',
    reason: data.reason || 'draw-resident-particle-state-producer',
    displayOwnerEpoch: Number.isFinite(Number(data.displayOwnerEpoch))
      ? Math.max(0, Math.round(Number(data.displayOwnerEpoch)))
      : null,
    // W4b: candidate-driven presentations are ordered by the candidate's own
    // strictly advancing version (presentationStepAccepts above), not by the
    // page display-owner epoch — the bridge reveals them on this marker.
    ...(data.residentScheduleCandidatePresentation === true
      ? { residentScheduleCandidatePresentation: true }
      : {}),
    ...(data.stateManagerCommittedPresentation === true
      ? {
          stateManagerCommittedPresentation: true,
          committedPresentationSchema:
            data.committedPresentationSchema ?? null,
          committedPresentationStatus:
            data.committedPresentationStatus ?? null,
          scheduleId: data.scheduleId ?? null,
          laneId: data.laneId ?? null,
          stateKey: data.stateKey ?? null,
          presentationAdmissionPostedAtMs:
            data.presentationAdmissionPostedAtMs ?? null,
          presentationLaneEpoch:
            data.presentationLaneEpoch ?? null,
          residentExecutionGeneration:
            data.residentExecutionGeneration ?? null,
          stepOrdinal: data.stepOrdinal ?? null,
          authorityStatus: data.authorityStatus ?? null,
          computeManagerCompletionSchema:
            data.computeManagerCompletionSchema ?? null,
          computeManagerLeaseId:
            data.computeManagerLeaseId ?? null,
          computeManagerLeaseStatus:
            data.computeManagerLeaseStatus ?? null,
          computeManagerFenceSatisfied:
            data.computeManagerFenceSatisfied === true,
          stateManagerCommitStatus:
            data.stateManagerCommitStatus ?? null,
          stateManagerCommitAccepted:
            data.stateManagerCommitAccepted === true,
          terminalScheduleFence:
            data.terminalScheduleFence === true,
          terminalFenceScope: data.terminalFenceScope ?? null,
          terminalFenceSatisfied:
            data.terminalFenceSatisfied === true,
          terminalFenceAuthorityAdmissionReady:
            data.terminalFenceAuthorityAdmissionReady === true
        }
      : {}),
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
    particleVelocityBufferByteLength: velocityByteLength,
    canvasWidth: canvas?.width ?? null,
    canvasHeight: canvas?.height ?? null,
    radiusScalePx: uniforms[18],
    fallbackPointSizePx: uniforms[19],
    minPointSizePx: uniforms[20],
    maxPointSizePx: uniforms[21],
    ...workerPresentationGeometryReceipt(drawnBoxDimsM),
    frameCount,
    readyEver: readyFrameCount > 0,
    readyFrameCount,
    workerReady: true,
    workerFramebufferEpoch: framebufferEpoch,
    ...(keyframePresentationProofRequired
      ? {
          presentationFrameSchema:
            RESIDENT_PARTICLE_KEYFRAME_PRESENTATION_FRAME_SCHEMA,
          presentationFrameStatus:
            'worker-particle-keyframe-submitted-awaiting-presentation-opportunity',
          presentationFrameAdmitted: false,
          presentationFrameGpuCompleted: false,
          presentationFramePresentationOpportunity: false,
          presentationQueueCompletionCount: null,
          presentationQueueCompletionSerial:
            keyframeQueueCompletionSerial,
          presentationQueueCompletionMethod: null,
          presentationQueueCompletionScope:
            ULG_WORKER_PRESENTATION_FRAME_QUEUE_COMPLETION_SCOPE,
          physicsQueuePrefixCoverage:
            ULG_WORKER_PRESENTATION_PHYSICS_PREFIX_NOT_ATTRIBUTED,
          physicsHostQueueFenceParticipation: null
        }
      : {}),
    motionFrameSchema: null,
    motionFrameStatus: 'worker-particle-temporal-motion-awaiting-next-frame',
    motionFrameAdmitted: false,
    motionFrameSerial: null
  });
  const temporalPresentationArmed = armWorkerParticleTemporalPresentation({
    motionRequest: keyframeProofMotionRequest,
    renderBindGroup,
    particleCount,
    viewProjection,
    uniformTemplate: uniforms,
    boxDimsM: drawnBoxDimsM,
    sourceReceipt: initialStatus,
    onStatus: data.onTemporalFrameStatus,
    scheduleImmediately: false,
    autonomousEnabled: Boolean(temporalMotion)
  });
  if (temporalPresentationArmed) {
    const presentationFrameCompletion =
      trackWorkerParticleKeyframePresentationCompletion({
        queueCompletion: keyframeQueueCompletion,
        queueCompletionSerial: keyframeQueueCompletionSerial,
        generation: workerParticleTemporalPresentation?.generation ?? null,
        submittedFramebufferEpoch: framebufferEpoch,
        submittedAtMs: keyframeSubmittedAtMs,
        drawnBoxDimsM
      });
    if (presentationFrameCompletion) {
      Object.defineProperty(initialStatus, 'presentationFrameCompletion', {
        value: presentationFrameCompletion,
        enumerable: false,
        configurable: false,
        writable: false
      });
    }
  }
  return initialStatus;
}

async function initPresentation(data) {
  canvas = data.canvas || null;
  canvasConfiguration = null;
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
  device = await adapter.requestDevice(
    // timestamp-query is negotiated whenever the adapter offers it: the
    // feature itself is free, and the resident stages that share this
    // device can only place diagnostic pass timestamps when it was granted
    // at acquisition (the device is a session singleton).
    webGpuDeviceDescriptorForResidentSph(adapter, {
      timestampProfilingRequested: true
    })
  );
  format = gpu.getPreferredCanvasFormat();
  const initialCanvasConfiguration = desiredCanvasConfiguration || data;
  configureCanvas({
    width: initialCanvasConfiguration.width,
    height: initialCanvasConfiguration.height,
    nextCssWidth: initialCanvasConfiguration.cssWidth,
    nextCssHeight: initialCanvasConfiguration.cssHeight,
    nextPixelRatio: initialCanvasConfiguration.pixelRatio,
    reason: 'init-offscreen-presentation'
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
      if (!adoptWorkerFramebufferEpoch(data.workerFramebufferEpoch)) {
        publish({
          status:
            'worker-offscreen-presentation-blocked-invalid-framebuffer-epoch',
          reason: 'init requires a positive monotonic worker framebuffer epoch',
          workerReady: false
        });
        return;
      }
      rememberDesiredCanvasConfiguration(data);
      resetPresentedSphStep();
      resetResidentScheduleCandidateMailbox();
      previewViewProjectionOverride = null;
      previewCameraRedraw = null;
      await initPresentation(data);
      return;
    }
    if (data.type === 'resize') {
      if (!adoptWorkerFramebufferEpoch(data.workerFramebufferEpoch)) return;
      rememberDesiredCanvasConfiguration(data);
      invalidatePendingCommittedResidentSchedulePresentation(
        'terminal resident-schedule presentation invalidated by canvas resize'
      );
      configureCanvas({
        width: data.width,
        height: data.height,
        nextCssWidth: data.cssWidth,
        nextCssHeight: data.cssHeight,
        nextPixelRatio: data.pixelRatio,
        reason: data.reason || 'resize'
      });
      clearPresentation({ reason: data.reason || 'resize' });
      await workerOwnedIsosurfacePresenter?.resize?.({
        viewProjectionMatrix: previewViewProjectionOverride,
        reason: 'worker-owned-isosurface-resize-redraw'
      });
      return;
    }
    if (data.type === 'clear') {
      if (!adoptWorkerFramebufferEpoch(data.workerFramebufferEpoch)) return;
      invalidatePendingCommittedResidentSchedulePresentation(
        'terminal resident-schedule presentation invalidated by canvas clear'
      );
      resetPresentedSphStep();
      // A deliberate clear invalidates the redraw closure (its content is
      // being wiped); the camera override itself stays current.
      previewCameraRedraw = null;
      workerOwnedIsosurfacePresenter?.clear?.({
        reason: data.reason || 'worker-owned-isosurface-clear'
      });
      if (data.resetResidentScheduleCandidateMailbox !== false) {
        resetResidentScheduleCandidateMailbox();
      }
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
    if (data.type === 'run-resident-schedule-on-presentation-device') {
      await runResidentScheduleOnPresentationDevice(data);
      return;
    }
    if (data.type === 'update-preview-view-projection') {
      const matrix = data.viewProjectionMatrix;
      if (matrix && Number(matrix.length) === 16) {
        previewViewProjectionOverride = matrix instanceof Float32Array
          ? matrix
          : new Float32Array(matrix);
        const now = nowMs();
        let workerIsosurfaceRedrawn = false;
        if (
          workerOwnedIsosurfacePresenter
          && now - previewCameraRedrawLastMs >= 16
        ) {
          try {
            workerIsosurfaceRedrawn =
              await workerOwnedIsosurfacePresenter.redraw({
                viewProjectionMatrix: previewViewProjectionOverride,
                cameraPositionM: data.cameraPositionM,
                reason: 'worker-owned-isosurface-camera-redraw'
              }) === true;
            if (workerIsosurfaceRedrawn) previewCameraRedrawLastMs = now;
          } catch {
            workerIsosurfaceRedrawn = false;
          }
        }
        const workerParticleTemporalCameraUpdated = Boolean(
          !workerIsosurfaceRedrawn
          && updateWorkerParticleTemporalViewProjection(
            previewViewProjectionOverride
          )
        );
        if (
          !workerIsosurfaceRedrawn
          && !workerParticleTemporalCameraUpdated
          && previewCameraRedraw
          && now - previewCameraRedrawLastMs >= 33
        ) {
          previewCameraRedrawLastMs = now;
          try {
            previewCameraRedraw();
          } catch {
            // A redraw against torn-down retained state just disarms the
            // camera channel until the next candidate rearms it.
            previewCameraRedraw = null;
          }
        }
      }
      return;
    }
    if (data.type === 'present-committed-resident-schedule-candidate') {
      await presentCommittedResidentScheduleCandidate(data);
      return;
    }
    if (data.type === 'cancel-resident-schedule-on-presentation-device') {
      await cancelResidentScheduleOnPresentationDevice(data);
      return;
    }
    if (data.type === 'export-retained-compact-snapshot') {
      await exportRetainedCompactSnapshotFromPresentationDevice(data);
      return;
    }
    if (data.type === 'dispose') {
      if (disposed) return;
      disposed = true;
      pendingCommittedResidentSchedulePresentation = null;
      workerParticleTemporalAuthorityAdmissionPending = false;
      await workerOwnedIsosurfacePresenter?.dispose?.();
      workerOwnedIsosurfacePresenter = null;
      destroyRenderRowsResources();
      unconfigureCanvas({ reason: data.reason || 'dispose' });
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
