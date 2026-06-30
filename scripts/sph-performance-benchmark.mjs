import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const repoDir = path.resolve(process.env.ULG_BENCH_REPO_DIR || process.cwd());
const profile = String(process.env.ULG_BENCH_PROFILE || 'smoke').trim().toLowerCase();
const counts = String(
  process.env.ULG_BENCH_PARTICLE_COUNTS
    || (profile === 'full' ? '1000,10000,50000,100000' : '1000')
)
  .split(',')
  .map((value) => Math.max(1, Math.round(Number(value) || 0)))
  .filter((value, index, values) => value > 0 && values.indexOf(value) === index);
const outputPath = process.env.ULG_BENCH_OUTPUT
  ? path.resolve(process.env.ULG_BENCH_OUTPUT)
  : path.join(repoDir, 'artifacts', 'sph-performance-benchmark.json');
const probeScript = path.join(repoDir, 'scripts', 'sph-long-horizon-probe.mjs');
const basePort = Math.max(1, Math.round(Number(process.env.ULG_BENCH_PORT || 5180) || 5180));
const batches = Math.max(1, Math.round(Number(process.env.ULG_BENCH_BATCHES || 3) || 3));
const batchSteps = Math.max(1, Math.round(Number(process.env.ULG_BENCH_BATCH_STEPS || 16) || 16));
const timeoutMs = Math.max(10_000, Math.round(Number(process.env.ULG_BENCH_TIMEOUT_MS || 240_000) || 240_000));
const requestedProbeMode = String(
  process.env.ULG_BENCH_PROBE_MODE
    || (process.env.ULG_BENCH_DIRECT_RESIDENT === '1' ? 'direct-resident' : 'scene')
).trim().toLowerCase();
const probeMode = requestedProbeMode === 'direct'
  || requestedProbeMode === 'direct-resident'
  || requestedProbeMode === 'resident'
  ? 'direct-resident'
  : 'scene';
const viewportWidth = Math.max(1, Math.round(Number(process.env.ULG_BENCH_VIEWPORT_WIDTH || 1280) || 1280));
const viewportHeight = Math.max(1, Math.round(Number(process.env.ULG_BENCH_VIEWPORT_HEIGHT || 800) || 800));
const deviceScaleFactor = Number.isFinite(Number(process.env.ULG_BENCH_DEVICE_SCALE_FACTOR))
  && Number(process.env.ULG_BENCH_DEVICE_SCALE_FACTOR) > 0
  ? Number(process.env.ULG_BENCH_DEVICE_SCALE_FACTOR)
  : null;
const workerOffscreenTargetFps = Number.isFinite(Number(process.env.ULG_BENCH_WORKER_OFFSCREEN_TARGET_FPS))
  && Number(process.env.ULG_BENCH_WORKER_OFFSCREEN_TARGET_FPS) > 0
  ? Number(process.env.ULG_BENCH_WORKER_OFFSCREEN_TARGET_FPS)
  : 60;
const workerOffscreenPresentationRequested = ['1', 'true', 'yes', 'on'].includes(
  String(process.env.ULG_BENCH_WORKER_OFFSCREEN_PRESENTATION || '').toLowerCase()
);
const presentationWorkerResidentStagesRequested = ['1', 'true', 'yes', 'on'].includes(
  String(process.env.ULG_BENCH_PRESENTATION_WORKER_RESIDENT_STAGES || '').toLowerCase()
);
const retainedCompactSnapshotExportRequested = ['1', 'true', 'yes', 'on'].includes(
  String(process.env.ULG_BENCH_RETAINED_COMPACT_SNAPSHOT_EXPORT || '').toLowerCase()
);
const renderOwnershipMode = String(process.env.ULG_BENCH_RENDER_OWNERSHIP || '').trim();
const renderOwnershipUseCase = String(
  process.env.ULG_BENCH_RENDER_USE_CASE
    || process.env.ULG_BENCH_PEERCOMPUTE_RENDER_USE_CASE
    || ''
).trim();
const residentInterfaceRefreshWarmupFrames = Number.isFinite(Number(
  process.env.ULG_BENCH_RESIDENT_INTERFACE_WARMUP_FRAMES
    ?? process.env.ULG_BENCH_RESIDENT_INTERFACE_REFRESH_WARMUP_FRAMES
))
  && Number(
    process.env.ULG_BENCH_RESIDENT_INTERFACE_WARMUP_FRAMES
      ?? process.env.ULG_BENCH_RESIDENT_INTERFACE_REFRESH_WARMUP_FRAMES
  ) >= 0
  ? Math.round(Number(
    process.env.ULG_BENCH_RESIDENT_INTERFACE_WARMUP_FRAMES
      ?? process.env.ULG_BENCH_RESIDENT_INTERFACE_REFRESH_WARMUP_FRAMES
  ))
  : null;
const isMobile = ['1', 'true', 'yes', 'on'].includes(String(process.env.ULG_BENCH_IS_MOBILE || '').toLowerCase());
const hasTouch = ['1', 'true', 'yes', 'on'].includes(
  String(process.env.ULG_BENCH_HAS_TOUCH || (isMobile ? '1' : '')).toLowerCase()
);
const surfaceDrawMode = String(
  process.env.ULG_BENCH_SURFACE_DRAW_MODE
    || (isMobile ? 'three-render-row-spheres' : 'three-render-row-points')
).trim().toLowerCase();
const nativeSurfaceBenchmarkViewport = surfaceDrawMode === 'native-webgpu-surface-consumer';
const probeViewportWidth = Math.max(1, Math.round(Number(
  process.env.ULG_BENCH_PROBE_VIEWPORT_WIDTH
    || (nativeSurfaceBenchmarkViewport ? 320 : viewportWidth)
) || (nativeSurfaceBenchmarkViewport ? 320 : viewportWidth)));
const probeViewportHeight = Math.max(1, Math.round(Number(
  process.env.ULG_BENCH_PROBE_VIEWPORT_HEIGHT
    || (nativeSurfaceBenchmarkViewport ? 240 : viewportHeight)
) || (nativeSurfaceBenchmarkViewport ? 240 : viewportHeight)));
const booleanEnv = (name, fallback = false) => {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(raw).toLowerCase());
};
const lawThermal = booleanEnv('ULG_BENCH_LAW_THERMAL', probeMode !== 'direct-resident');
const lawReactions = booleanEnv('ULG_BENCH_LAW_REACTIONS', true);
const lawViscosity = booleanEnv('ULG_BENCH_LAW_VISCOSITY', true);
const lawSurfaceTension = booleanEnv('ULG_BENCH_LAW_SURFACE_TENSION', false);
const compactSummaryMode = ['none', 'plan-only', 'final-only', 'every-step'].includes(
  String(process.env.ULG_BENCH_COMPACT_SUMMARY_MODE || '').toLowerCase()
)
  ? String(process.env.ULG_BENCH_COMPACT_SUMMARY_MODE).toLowerCase()
  : 'none';
const activeGridPlanRefreshModeEnv = String(
  process.env.ULG_BENCH_ACTIVE_GRID_PLAN_REFRESH_MODE
    || process.env.ULG_BENCH_ACTIVE_GRID_PLAN_REFRESH
    || ''
).toLowerCase();
const activeGridDispatchPlanRefreshMode = ['none', 'final-only', 'every-step'].includes(activeGridPlanRefreshModeEnv)
  ? activeGridPlanRefreshModeEnv
  : (['none', 'plan-only'].includes(compactSummaryMode) ? 'final-only' : 'every-step');
const fuseResidentMechanicsSequence = !['0', 'false', 'off', 'no'].includes(
  String(process.env.ULG_BENCH_FUSE_RESIDENT_MECHANICS_SEQUENCE || '1').toLowerCase()
);
const fuseResidentMechanicsActiveGrid = !['0', 'false', 'off', 'no'].includes(
  String(process.env.ULG_BENCH_FUSE_RESIDENT_ACTIVE_GRID || '1').toLowerCase()
);
const fusedActiveGridSafetyCells = Number.isFinite(Number(process.env.ULG_BENCH_FUSE_RESIDENT_ACTIVE_GRID_SAFETY_CELLS))
  && Number(process.env.ULG_BENCH_FUSE_RESIDENT_ACTIVE_GRID_SAFETY_CELLS) > 0
  ? Math.round(Number(process.env.ULG_BENCH_FUSE_RESIDENT_ACTIVE_GRID_SAFETY_CELLS))
  : null;
const measureGpuQueueFence = booleanEnv(
  'ULG_BENCH_MEASURE_GPU_QUEUE_FENCE',
  probeMode === 'direct-resident'
);
const materialInterfaceDiagnosticRequested =
  booleanEnv('ULG_BENCH_MATERIAL_INTERFACE_DIAGNOSTIC', false)
  || booleanEnv('ULG_BENCH_FORCE_MATERIAL_INTERFACE_REFRESH', false);
const materialInterfaceCandidateReadbackModeEnv = String(
  process.env.ULG_BENCH_MATERIAL_INTERFACE_CANDIDATE_READBACK_MODE
    || process.env.ULG_BENCH_MATERIAL_INTERFACE_READBACK_MODE
    || ''
).toLowerCase();
const materialInterfaceCandidateReadbackMode = [
  'compact-active-readback',
  'dense-readback',
  'gpu-resident-summary'
].includes(materialInterfaceCandidateReadbackModeEnv)
  ? materialInterfaceCandidateReadbackModeEnv
  : 'compact-active-readback';
const requireActiveGridGate = booleanEnv(
  'ULG_BENCH_REQUIRE_ACTIVE_GRID',
  probeMode === 'direct-resident' && fuseResidentMechanicsActiveGrid
);
const requireQueueFenceGate = booleanEnv(
  'ULG_BENCH_REQUIRE_QUEUE_FENCE',
  probeMode === 'direct-resident' && measureGpuQueueFence
);
const minResidentStageStepsPerSecond = Number.isFinite(Number(process.env.ULG_BENCH_MIN_RESIDENT_STAGE_STEPS_PER_SECOND))
  && Number(process.env.ULG_BENCH_MIN_RESIDENT_STAGE_STEPS_PER_SECOND) > 0
  ? Number(process.env.ULG_BENCH_MIN_RESIDENT_STAGE_STEPS_PER_SECOND)
  : null;
const maxResidentGpuCompletedStageMs = Number.isFinite(Number(process.env.ULG_BENCH_MAX_RESIDENT_GPU_COMPLETED_STAGE_MS))
  && Number(process.env.ULG_BENCH_MAX_RESIDENT_GPU_COMPLETED_STAGE_MS) > 0
  ? Number(process.env.ULG_BENCH_MAX_RESIDENT_GPU_COMPLETED_STAGE_MS)
  : null;
const maxReadbackBytesPerStep = Number.isFinite(Number(process.env.ULG_BENCH_MAX_READBACK_BYTES_PER_STEP))
  && Number(process.env.ULG_BENCH_MAX_READBACK_BYTES_PER_STEP) >= 0
  ? Number(process.env.ULG_BENCH_MAX_READBACK_BYTES_PER_STEP)
  : null;
const WORKER_FRAME_COPY_WARN_BYTES_PER_SECOND = 256 * 1024 * 1024;
const WORKER_FRAME_COPY_FAIL_BYTES_PER_SECOND = 512 * 1024 * 1024;

function edgeForApproxParticleCount(targetCount) {
  return Math.max(1, Math.round(Math.cbrt(Math.max(1, targetCount) / 2)));
}

function scenarioUrlForCount(targetCount) {
  const edge = edgeForApproxParticleCount(targetCount);
  const actualParticleCount = edge ** 3 * 2;
  const params = new URLSearchParams({
    drop: 'h2o',
    base: 'h2o',
    dropt: '300',
    baset: '300',
    iceh: '0',
    ironh: '1',
    boxx: '5',
    boxy: '5',
    boxz: '5',
    dropn: String(edge),
    basen: String(edge),
    mech: 'mlsmpm',
    residentAuto: '0',
    residentFuseSequence: '1',
    residentActiveGrid: '1',
    ...(workerOffscreenPresentationRequested ? { workerOffscreenPresentation: '1' } : {}),
    ...(presentationWorkerResidentStagesRequested ? { presentationWorkerResidentStages: '1' } : {}),
    ...(retainedCompactSnapshotExportRequested ? { retainedCompactSnapshotExport: '1' } : {}),
    ...(renderOwnershipMode ? { renderOwnership: renderOwnershipMode } : {}),
    ...(renderOwnershipUseCase ? { renderUseCase: renderOwnershipUseCase } : {}),
    ...(residentInterfaceRefreshWarmupFrames != null
      ? { residentInterfaceRefreshWarmupFrames: String(residentInterfaceRefreshWarmupFrames) }
      : {}),
    ...(measureGpuQueueFence ? { residentQueueFence: '1' } : {}),
    lawt: lawThermal ? '1' : '0',
    lawr: lawReactions ? '1' : '0',
    lawv: lawViscosity ? '1' : '0',
    lawst: lawSurfaceTension ? '1' : '0',
    visualCapture: '1',
    surfaceDraw: surfaceDrawMode,
    blob: '1'
  });
  return {
    url: `/?${params.toString()}`,
    edge,
    actualParticleCount
  };
}

function runProbe(env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [probeScript], {
      cwd: repoDir,
      env: {
        ...process.env,
        ...env
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('close', (code, signal) => {
      resolve({ code, signal, stdout, stderr });
    });
  });
}

function lastMetricWithRenderState(result) {
  const metrics = Array.isArray(result?.timeline?.metrics) ? result.timeline.metrics : [];
  for (let index = metrics.length - 1; index >= 0; index -= 1) {
    if (metrics[index]?.renderState) return metrics[index];
  }
  return metrics.length ? metrics[metrics.length - 1] : null;
}

function lastMetricWithMaterialInterfaceState(result) {
  const metrics = Array.isArray(result?.timeline?.metrics) ? result.timeline.metrics : [];
  for (let index = metrics.length - 1; index >= 0; index -= 1) {
    const metric = metrics[index];
    if (
      metric?.residentMaterialInterfaceState
      || metric?.materialInterfaceField
      || metric?.renderState?.materialInterfaceField
    ) {
      return metric;
    }
  }
  return null;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function sumKnownNumbers(values) {
  let sum = 0;
  let known = false;
  for (const value of values) {
    const number = numberOrNull(value);
    if (number === null) continue;
    sum += number;
    known = true;
  }
  return known ? sum : null;
}

function byteCountLabel(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value < 0) return null;
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(2)} GiB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(2)} MiB`;
  if (value >= 1024) return `${(value / 1024).toFixed(2)} KiB`;
  return `${Math.round(value)} B`;
}

function workerOffscreenFrameTransportBudget({
  width,
  height,
  dpr = null,
  refreshHz = null,
  targetFps = workerOffscreenTargetFps
} = {}) {
  const cssWidth = Math.max(1, Math.round(Number(width) || viewportWidth));
  const cssHeight = Math.max(1, Math.round(Number(height) || viewportHeight));
  const scale = Number.isFinite(Number(dpr)) && Number(dpr) > 0 ? Number(dpr) : 1;
  const physicalWidth = Math.max(1, Math.round(cssWidth * scale));
  const physicalHeight = Math.max(1, Math.round(cssHeight * scale));
  const frameHz = Number.isFinite(Number(refreshHz)) && Number(refreshHz) > 0
    ? Number(refreshHz)
    : Math.max(1, Number(targetFps) || 60);
  const pixelCount = physicalWidth * physicalHeight;
  const rgba8FrameBytes = pixelCount * 4;
  const copyBackBytesPerSecond = rgba8FrameBytes * frameHz;
  const copyBackStatus = copyBackBytesPerSecond >= WORKER_FRAME_COPY_FAIL_BYTES_PER_SECOND
    ? 'frame-copy-back-likely-performance-blocker'
    : copyBackBytesPerSecond >= WORKER_FRAME_COPY_WARN_BYTES_PER_SECOND
      ? 'frame-copy-back-high-bandwidth-risk'
      : 'frame-copy-back-moderate-bandwidth-risk';
  return {
    schema: 'peercompute.ulg.worker-offscreen-frame-transport-budget.v0',
    status: 'worker-owned-presented-canvas-required-for-zero-copy-display',
    cssWidth,
    cssHeight,
    deviceScaleFactor: scale,
    physicalWidth,
    physicalHeight,
    pixelCount,
    refreshHz: frameHz,
    preferred: {
      transport: 'worker-owned-presented-canvas',
      displayHandoff: 'transferControlToOffscreen',
      copiedBytesPerFrame: 0,
      copiedBytesPerSecond: 0,
      status: 'zero-copy-display-path'
    },
    rejected: {
      transport: 'frame-copy-back',
      examples: [
        'worker-renders-to-texture-then-readPixels',
        'worker-creates-ImageBitmap-every-frame-for-main-thread-present'
      ],
      rgba8FrameBytes,
      rgba8FrameBytesLabel: byteCountLabel(rgba8FrameBytes),
      copiedBytesPerSecond: copyBackBytesPerSecond,
      copiedBytesPerSecondLabel: byteCountLabel(copyBackBytesPerSecond),
      warningThresholdBytesPerSecond: WORKER_FRAME_COPY_WARN_BYTES_PER_SECOND,
      failThresholdBytesPerSecond: WORKER_FRAME_COPY_FAIL_BYTES_PER_SECOND,
      status: copyBackStatus
    }
  };
}

function scenarioPerformanceGate({
  residentGpuCompletedStageMs,
  residentStageStepsPerSecond,
  estimatedReadbackBytesPerStep,
  activeGridDispatch,
  residentStageTiming,
  fusedResidentSequenceBlockedForSidecars = false
}) {
  const blockers = [];
  if (requireActiveGridGate && activeGridDispatch?.useActiveGrid !== true) {
    blockers.push('active-grid-dispatch-required');
  }
  if (
    requireQueueFenceGate
    && fusedResidentSequenceBlockedForSidecars !== true
    && residentStageTiming?.queueFenceStatus?.fusedMechanicsSequence !== 'complete'
  ) {
    blockers.push('queue-fenced-resident-sequence-required');
  }
  if (
    minResidentStageStepsPerSecond !== null
    && !(
      Number.isFinite(Number(residentStageStepsPerSecond))
      && Number(residentStageStepsPerSecond) >= minResidentStageStepsPerSecond
    )
  ) {
    blockers.push('resident-stage-steps-per-second-below-threshold');
  }
  if (
    maxResidentGpuCompletedStageMs !== null
    && !(
      Number.isFinite(Number(residentGpuCompletedStageMs))
      && Number(residentGpuCompletedStageMs) <= maxResidentGpuCompletedStageMs
    )
  ) {
    blockers.push('resident-gpu-completed-stage-ms-above-threshold');
  }
  if (
    maxReadbackBytesPerStep !== null
    && !(
      Number.isFinite(Number(estimatedReadbackBytesPerStep))
      && Number(estimatedReadbackBytesPerStep) <= maxReadbackBytesPerStep
    )
  ) {
    blockers.push('readback-bytes-per-step-above-threshold');
  }
  return {
    schema: 'peercompute.ulg.sph-performance-benchmark-gate.v0',
    status: blockers.length === 0 ? 'pass' : 'fail',
    blockers,
    requireActiveGrid: requireActiveGridGate,
    requireQueueFence: requireQueueFenceGate,
    thresholds: {
      minResidentStageStepsPerSecond,
      maxResidentGpuCompletedStageMs,
      maxReadbackBytesPerStep
    },
    observed: {
      residentGpuCompletedStageMs,
      residentStageStepsPerSecond,
      estimatedReadbackBytesPerStep,
      activeGridUsed: activeGridDispatch?.useActiveGrid === true,
      queueFenceStatus: residentStageTiming?.queueFenceStatus?.fusedMechanicsSequence ?? null,
      queueFenceBypassedBySidecarFallback: fusedResidentSequenceBlockedForSidecars === true
    }
  };
}

function ownMetricValue(object, key) {
  return object && Object.prototype.hasOwnProperty.call(object, key)
    ? object[key]
    : undefined;
}

function firstDefinedMetricValue(...values) {
  for (const value of values) {
    if (value !== undefined) return value;
  }
  return null;
}

function firstNonNullMetricValue(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null) return value;
  }
  return null;
}

function summarizeProbeResult({ targetParticleCount, scenario, result, exit }) {
  const analysis = result?.analysis || {};
  const metrics = Array.isArray(result?.timeline?.metrics) ? result.timeline.metrics : [];
  const initialMetric = metrics.find((entry) => entry?.initial) || null;
  const initialParticleEdgeDiagnostics = initialMetric?.initial?.initialParticleEdgeDiagnostics || null;
  const metric = lastMetricWithRenderState(result);
  const renderState = metric?.renderState || null;
  const surfaceDraw = metric?.surfaceDraw || null;
  const materialMetric = lastMetricWithMaterialInterfaceState(result) || metric;
  const materialRenderState = materialMetric?.renderState || null;
  const materialInterfaceField =
    materialRenderState?.materialInterfaceField
    ?? materialMetric?.materialInterfaceField
    ?? materialMetric?.residentMaterialInterfaceState
    ?? renderState?.materialInterfaceField
    ?? metric?.materialInterfaceField
    ?? metric?.residentMaterialInterfaceState
    ?? null;
  const probeResidentBatchTiming = metric?.probeResidentBatchTiming || null;
  const probeResidentBatchResidentStepsAwaitMs = numberOrNull(
    probeResidentBatchTiming?.residentStepsAwaitMs
  );
  const probeResidentBatchRenderRefreshAwaitMs = numberOrNull(
    probeResidentBatchTiming?.renderRefreshAwaitMs
  );
  const probeResidentBatchMaterialInterfaceDiagnosticMs = numberOrNull(
    probeResidentBatchTiming?.materialInterfaceDiagnosticMs
  );
  const probeResidentBatchViewportRefreshMs = numberOrNull(
    probeResidentBatchTiming?.viewportRefreshMs
  );
  const probeResidentBatchViewportRafMs = numberOrNull(
    probeResidentBatchTiming?.viewportRafMs
  );
  const probeResidentBatchViewportSignal = probeResidentBatchTiming?.viewportSignal ?? null;
  const probeResidentBatchViewportRafSkipped = probeResidentBatchTiming?.viewportRafSkipped === true;
  const probeResidentBatchViewportWorkerOffscreenStatus =
    probeResidentBatchTiming?.viewportWorkerOffscreenStatus ?? null;
  const probeResidentBatchViewportWorkerOffscreenFrameCount = numberOrNull(
    probeResidentBatchTiming?.viewportWorkerOffscreenFrameCount
  );
  const probeResidentBatchViewportWorkerOffscreenReadyFrameCount = numberOrNull(
    probeResidentBatchTiming?.viewportWorkerOffscreenReadyFrameCount
  );
  const probeResidentBatchNativeSurfaceValidationWaitMs = numberOrNull(
    probeResidentBatchTiming?.nativeSurfaceValidationWaitMs
  );
  const probeResidentBatchTotalBeforeSampleMs = numberOrNull(
    probeResidentBatchTiming?.totalBeforeSampleMs
  );
  const probeResidentBatchViewportNonRafMs = (() => {
    if (probeResidentBatchViewportRefreshMs === null) return null;
    const excluded = sumKnownNumbers([
      probeResidentBatchViewportRafMs,
      probeResidentBatchNativeSurfaceValidationWaitMs
    ]);
    return Math.max(0, probeResidentBatchViewportRefreshMs - excluded);
  })();
  const probeEngineBatchComponents = [
    probeResidentBatchResidentStepsAwaitMs,
    probeResidentBatchRenderRefreshAwaitMs,
    probeResidentBatchMaterialInterfaceDiagnosticMs,
    probeResidentBatchViewportNonRafMs,
    probeResidentBatchNativeSurfaceValidationWaitMs
  ];
  const probeEngineBatchMs = probeEngineBatchComponents.some((value) => value !== null)
    ? sumKnownNumbers(probeEngineBatchComponents)
    : null;
  const residentStep = metric?.residentStep || null;
  const residentSteps = metric?.residentSteps || null;
  const mechanicsMaterialPhaseUpload = metric?.mlsMpmMechanicsMaterialPhaseUpload || null;
  const effectiveProbeMode = result?.timeline?.probeMode || probeMode;
  const residentStageTiming = residentStep?.stageTiming ?? residentSteps?.finalStepStageTiming ?? null;
  const fusedResidentSequencePreflight = residentSteps?.fusedResidentSequencePreflight
    ?? residentStageTiming?.fusedResidentSequencePreflight
    ?? residentStep?.fusedResidentSequencePreflight
    ?? null;
  const residentStepsTiming = residentSteps?.residentStepsTiming ?? null;
  const residentStepsStageMs = residentSteps?.residentStepsStageMs
    ?? residentStepsTiming?.stageMs
    ?? null;
  const residentStepsWallMs = numberOrNull(
    residentSteps?.residentStepsWallMs ?? residentStepsTiming?.totalWallMs
  );
  const residentStepsSurfaceDrawSubmitFenceMs = numberOrNull(
    residentSteps?.residentStepsSurfaceDrawSubmitFenceMs
      ?? residentStepsStageMs?.surfaceDrawSubmitFenceMs
  );
  const residentStepsDeviceAcquireMs = numberOrNull(
    residentSteps?.residentStepsDeviceAcquireMs ?? residentStepsStageMs?.deviceAcquireMs
  );
  const residentStepsSphUploadMs = numberOrNull(
    residentSteps?.residentStepsSphUploadMs ?? residentStepsStageMs?.sphUploadMs
  );
  const residentStepsMlsUploadMs = numberOrNull(
    residentSteps?.residentStepsMlsUploadMs ?? residentStepsStageMs?.mlsUploadMs
  );
  const residentStepsThermalUploadMs = numberOrNull(
    residentSteps?.residentStepsThermalUploadMs ?? residentStepsStageMs?.thermalUploadMs
  );
  const residentStepsMechanicsMaterialUploadMs = numberOrNull(
    residentSteps?.residentStepsMechanicsMaterialUploadMs
      ?? residentStepsStageMs?.mechanicsMaterialUploadMs
  );
  const residentStepsPressureRowsMs = numberOrNull(
    residentSteps?.residentStepsPressureRowsMs ?? residentStepsStageMs?.pressureRowsMs
  );
  const residentStepsKernelsWallMs = numberOrNull(
    residentSteps?.residentStepsKernelsWallMs ?? residentStepsStageMs?.kernelsWallMs
  );
  const residentStepsPostKernelPublicationMs = numberOrNull(
    residentSteps?.residentStepsPostKernelPublicationMs
      ?? residentStepsStageMs?.postKernelPublicationMs
  );
  const residentStepsArtifactClearMs = numberOrNull(
    residentSteps?.residentStepsArtifactClearMs ?? residentStepsStageMs?.artifactClearMs
  );
  const residentStepsArtifactPublishMs = numberOrNull(
    residentSteps?.residentStepsArtifactPublishMs ?? residentStepsStageMs?.artifactPublishMs
  );
  const dispatchTopology = residentStageTiming?.dispatchTopology
    ?? residentStep?.dispatchTopology
    ?? residentSteps?.fusedResidentSequence?.dispatchTopology
    ?? null;
  const p2gAccumulatorClearTopology = dispatchTopology?.p2gAccumulatorClear ?? null;
  const residentDiagnostics = residentStep?.diagnostics ?? null;
  const meanBatchMs = Number.isFinite(Number(analysis.meanBatchMs)) ? Number(analysis.meanBatchMs) : null;
  const residentStageMs = numberOrNull(residentStageTiming?.totalMs);
  const residentGpuQueueFenceMs = numberOrNull(residentStageTiming?.queueFenceMs?.fusedMechanicsSequence);
  const residentGpuCompletedStageMs = residentGpuQueueFenceMs !== null
    ? Math.max(residentStageMs ?? 0, residentGpuQueueFenceMs)
    : residentStageMs;
  const completedStepCount = Number.isFinite(Number(metric?.residentSteps?.completedStepCount))
    ? Number(metric.residentSteps.completedStepCount)
    : batchSteps;
  const browserConsoleIssueCount = analysis.browserConsoleIssueCount ?? null;
  const residentStageStepsPerSecond = residentGpuCompletedStageMs && residentGpuCompletedStageMs > 0
    ? 1000 / residentGpuCompletedStageMs
    : null;
  const probeBatchWallMs = probeResidentBatchTotalBeforeSampleMs ?? meanBatchMs;
  const probeWallStepsPerSecond = probeBatchWallMs && probeBatchWallMs > 0
    ? (completedStepCount * 1000) / probeBatchWallMs
    : null;
  const probeEngineStepsPerSecond = probeEngineBatchMs && probeEngineBatchMs > 0
    ? (completedStepCount * 1000) / probeEngineBatchMs
    : null;
  const probeWallRefreshHz = meanBatchMs && meanBatchMs > 0
    ? 1000 / meanBatchMs
    : null;
  const probeRafShare = probeBatchWallMs && probeResidentBatchViewportRafMs !== null
    ? probeResidentBatchViewportRafMs / probeBatchWallMs
    : null;
  const probeEngineShare = probeBatchWallMs && probeEngineBatchMs !== null
    ? probeEngineBatchMs / probeBatchWallMs
    : null;
  const probeWallOverheadMs = probeBatchWallMs && probeEngineBatchMs !== null
    ? Math.max(0, probeBatchWallMs - probeEngineBatchMs)
    : null;
  const probeWallRafDominated = Boolean(
    !probeResidentBatchViewportRafSkipped
    && probeResidentBatchViewportSignal !== 'worker-offscreen-presented-canvas'
    && probeResidentBatchViewportRafMs !== null
    && probeBatchWallMs
    && probeResidentBatchViewportRafMs >= 250
    && probeResidentBatchViewportRafMs >= probeBatchWallMs * 0.5
  );
  const probeWallTimeAttribution = {
    schema: 'peercompute.ulg.sph-performance-benchmark-wall-time-attribution.v0',
    status: probeBatchWallMs == null
      ? 'probe-wall-attribution-unavailable'
      : (probeWallRafDominated
        ? 'probe-wall-dominated-by-browser-raf'
        : (probeEngineShare !== null && probeEngineShare >= 0.5
          ? 'probe-wall-dominated-by-engine-work'
          : 'probe-wall-mixed')),
    benchmarkWallIncludesBrowserRaf: !probeResidentBatchViewportRafSkipped,
    viewportSignal: probeResidentBatchViewportSignal,
    viewportRafSkipped: probeResidentBatchViewportRafSkipped,
    benchmarkWallRateSource: 'probe-total-before-sample',
    engineRateSource: 'resident-step-plus-render-refresh-minus-browser-raf-wait',
    totalBeforeSampleMs: probeBatchWallMs,
    meanBatchMs,
    engineBatchMs: probeEngineBatchMs,
    browserRafMs: probeResidentBatchViewportRafMs,
    viewportWorkerOffscreenStatus: probeResidentBatchViewportWorkerOffscreenStatus,
    viewportWorkerOffscreenFrameCount: probeResidentBatchViewportWorkerOffscreenFrameCount,
    viewportWorkerOffscreenReadyFrameCount: probeResidentBatchViewportWorkerOffscreenReadyFrameCount,
    viewportRefreshMs: probeResidentBatchViewportRefreshMs,
    viewportNonRafMs: probeResidentBatchViewportNonRafMs,
    nativeSurfaceValidationWaitMs: probeResidentBatchNativeSurfaceValidationWaitMs,
    residentStepsAwaitMs: probeResidentBatchResidentStepsAwaitMs,
    renderRefreshAwaitMs: probeResidentBatchRenderRefreshAwaitMs,
    materialInterfaceDiagnosticMs: probeResidentBatchMaterialInterfaceDiagnosticMs,
    wallOverheadMs: probeWallOverheadMs,
    rafShare: probeRafShare,
    engineShare: probeEngineShare,
    wallStepsPerSecond: probeWallStepsPerSecond,
    engineStepsPerSecond: probeEngineStepsPerSecond,
    residentStageStepsPerSecond
  };
  const workerOffscreenTransportBudget = workerOffscreenFrameTransportBudget({
    width: viewportWidth,
    height: viewportHeight,
    dpr: deviceScaleFactor,
    refreshHz: workerOffscreenTargetFps
  });
  const peerComputeRenderOwnershipPolicy = metric?.peerComputeRenderOwnershipPolicy
    ?? renderState?.peerComputeRenderOwnershipPolicy
    ?? metric?.rendererInit?.peerComputeRenderOwnershipPolicy
    ?? null;
  const peerComputeRenderOwnershipPolicyStatus =
    peerComputeRenderOwnershipPolicy?.status
    ?? renderState?.peerComputeRenderOwnershipPolicyStatus
    ?? metric?.rendererInit?.peerComputeRenderOwnershipStatus
    ?? null;
  const peerComputeRenderOwnershipPolicyRequestedMode =
    peerComputeRenderOwnershipPolicy?.requestedMode
    ?? renderState?.peerComputeRenderOwnershipPolicyRequestedMode
    ?? metric?.rendererInit?.peerComputeRenderOwnershipRequestedMode
    ?? null;
  const peerComputeRenderOwnershipPolicyEffectiveMode =
    peerComputeRenderOwnershipPolicy?.effectiveMode
    ?? renderState?.peerComputeRenderOwnershipPolicyEffectiveMode
    ?? metric?.rendererInit?.peerComputeRenderOwnershipEffectiveMode
    ?? null;
  const peerComputeRenderOwnershipPolicyInputTransport =
    peerComputeRenderOwnershipPolicy?.inputTransport
    ?? renderState?.peerComputeRenderOwnershipPolicyInputTransport
    ?? metric?.rendererInit?.peerComputeRenderOwnershipInputTransport
    ?? null;
  const peerComputeRenderOwnershipPolicyDisplayTransport =
    peerComputeRenderOwnershipPolicy?.displayTransport
    ?? renderState?.peerComputeRenderOwnershipPolicyDisplayTransport
    ?? null;
  const peerComputeRenderOwnershipPolicyConfiguredByPeerCompute =
    peerComputeRenderOwnershipPolicy?.configuredByPeerCompute
    ?? renderState?.peerComputeRenderOwnershipPolicyConfiguredByPeerCompute
    ?? metric?.rendererInit?.peerComputeRenderOwnershipConfiguredByPeerCompute
    ?? null;
  const peerComputeRenderOwnershipWorkerOwnedResidentProducerPending =
    peerComputeRenderOwnershipPolicy?.workerOwnedResidentProducerPending
    ?? renderState?.peerComputeRenderOwnershipWorkerOwnedResidentProducerPending
    ?? null;
  const peerComputeRenderOwnershipWorkerOwnedResidentProducerSourceTransferRequired =
    peerComputeRenderOwnershipPolicy?.workerOwnedResidentProducerSourceTransferRequired
    ?? renderState?.peerComputeRenderOwnershipWorkerOwnedResidentProducerSourceTransferRequired
    ?? metric?.rendererInit?.peerComputeRenderOwnershipWorkerOwnedResidentProducerSourceTransferRequired
    ?? null;
  const peerComputeRenderOwnershipPresentationWorkerRetainedOutputPresentationOnlyRequested =
    peerComputeRenderOwnershipPolicy?.presentationWorkerRetainedOutputPresentationOnlyRequested
    ?? renderState?.peerComputeRenderOwnershipPresentationWorkerRetainedOutputPresentationOnlyRequested
    ?? metric?.rendererInit?.peerComputeRenderOwnershipPresentationWorkerRetainedOutputPresentationOnlyRequested
    ?? null;
  const peerComputeRenderOwnershipPresentationWorkerRetainedOutputPresentationOnlyReady =
    peerComputeRenderOwnershipPolicy?.presentationWorkerRetainedOutputPresentationOnlyReady
    ?? renderState?.peerComputeRenderOwnershipPresentationWorkerRetainedOutputPresentationOnlyReady
    ?? metric?.rendererInit?.peerComputeRenderOwnershipPresentationWorkerRetainedOutputPresentationOnlyReady
    ?? null;
  const peerComputeRenderOwnershipRetainedCompactSnapshotExportRequested =
    peerComputeRenderOwnershipPolicy?.retainedCompactSnapshotExportRequested
    ?? renderState?.peerComputeRenderOwnershipRetainedCompactSnapshotExportRequested
    ?? null;
  const peerComputeRenderOwnershipStatePromotionMode =
    peerComputeRenderOwnershipPolicy?.statePromotionMode
    ?? renderState?.peerComputeRenderOwnershipStatePromotionMode
    ?? metric?.rendererInit?.peerComputeRenderOwnershipStatePromotionMode
    ?? null;
  const peerComputeRenderOwnershipAuthoritativeStateMutationExpected =
    peerComputeRenderOwnershipPolicy?.authoritativeStateMutationExpected
    ?? renderState?.peerComputeRenderOwnershipAuthoritativeStateMutationExpected
    ?? metric?.rendererInit?.peerComputeRenderOwnershipAuthoritativeStateMutationExpected
    ?? null;
  const peerComputeRenderOwnershipPresentationWorkerResidentStagesRequested =
    peerComputeRenderOwnershipPolicy?.presentationWorkerResidentStagesRequested
    ?? renderState?.peerComputeRenderOwnershipPresentationWorkerResidentStagesRequested
    ?? metric?.rendererInit?.peerComputeRenderOwnershipPresentationWorkerResidentStagesRequested
    ?? null;
  const peerComputeRenderOwnershipPresentationWorkerResidentStagesReady =
    peerComputeRenderOwnershipPolicy?.presentationWorkerResidentStagesReady
    ?? renderState?.peerComputeRenderOwnershipPresentationWorkerResidentStagesReady
    ?? metric?.rendererInit?.peerComputeRenderOwnershipPresentationWorkerResidentStagesReady
    ?? null;
  const peerComputeRenderOwnershipPresentationWorkerResidentStagesPending =
    peerComputeRenderOwnershipPolicy?.presentationWorkerResidentStagesPending
    ?? renderState?.peerComputeRenderOwnershipPresentationWorkerResidentStagesPending
    ?? metric?.rendererInit?.peerComputeRenderOwnershipPresentationWorkerResidentStagesPending
    ?? null;
  const peerComputeRenderOwnershipPresentationWorkerResidentStageTransport =
    peerComputeRenderOwnershipPolicy?.presentationWorkerResidentStageTransport
    ?? renderState?.peerComputeRenderOwnershipPresentationWorkerResidentStageTransport
    ?? metric?.rendererInit?.peerComputeRenderOwnershipPresentationWorkerResidentStageTransport
    ?? null;
  const peerComputeRenderOwnershipResidentPlaybackUseCase =
    peerComputeRenderOwnershipPolicy?.residentPlaybackUseCase
    ?? renderState?.peerComputeRenderOwnershipResidentPlaybackUseCase
    ?? metric?.rendererInit?.peerComputeRenderOwnershipResidentPlaybackUseCase
    ?? null;
  const peerComputeRenderOwnershipResidentStepsPerScheduleOverride = numberOrNull(
    peerComputeRenderOwnershipPolicy?.residentStepsPerScheduleOverride
      ?? renderState?.peerComputeRenderOwnershipResidentStepsPerScheduleOverride
      ?? metric?.rendererInit?.peerComputeRenderOwnershipResidentStepsPerScheduleOverride
  );
  const peerComputeRenderOwnershipResidentStepsPerScheduleMax = numberOrNull(
    peerComputeRenderOwnershipPolicy?.residentStepsPerScheduleMax
      ?? renderState?.peerComputeRenderOwnershipResidentStepsPerScheduleMax
      ?? metric?.rendererInit?.peerComputeRenderOwnershipResidentStepsPerScheduleMax
  );
  const peerComputeRenderOwnershipResidentParticleBridgeTargetBatchTimeS = numberOrNull(
    peerComputeRenderOwnershipPolicy?.residentParticleBridgeTargetBatchTimeS
      ?? renderState?.peerComputeRenderOwnershipResidentParticleBridgeTargetBatchTimeS
      ?? metric?.rendererInit?.peerComputeRenderOwnershipResidentParticleBridgeTargetBatchTimeS
  );
  const peerComputeRenderOwnershipResidentInterfaceRefreshMode =
    peerComputeRenderOwnershipPolicy?.residentInterfaceRefreshMode
    ?? renderState?.peerComputeRenderOwnershipResidentInterfaceRefreshMode
    ?? metric?.rendererInit?.peerComputeRenderOwnershipResidentInterfaceRefreshMode
    ?? null;
  const peerComputeRenderOwnershipResidentComputeManagerMode =
    peerComputeRenderOwnershipPolicy?.residentComputeManagerMode
    ?? renderState?.peerComputeRenderOwnershipResidentComputeManagerMode
    ?? metric?.rendererInit?.peerComputeRenderOwnershipResidentComputeManagerMode
    ?? null;
  const peerComputeRenderOwnershipResidentComputeManagerModeExplicit =
    peerComputeRenderOwnershipPolicy?.residentComputeManagerModeExplicit
    ?? renderState?.peerComputeRenderOwnershipResidentComputeManagerModeExplicit
    ?? metric?.rendererInit?.peerComputeRenderOwnershipResidentComputeManagerModeExplicit
    ?? null;
  const peerComputeRenderOwnershipTransitionalRenderRowsActive =
    peerComputeRenderOwnershipPolicy?.transitionalRenderRowsActive
    ?? renderState?.peerComputeRenderOwnershipTransitionalRenderRowsActive
    ?? metric?.rendererInit?.peerComputeRenderOwnershipTransitionalRenderRowsActive
    ?? null;
  const workerOffscreenPresentation = metric?.workerOffscreenPresentation
    ?? renderState?.workerOffscreenPresentation
    ?? metric?.rendererInit?.workerOffscreenPresentation
    ?? null;
  const workerOffscreenPresentationStatus = workerOffscreenPresentation?.status
    ?? renderState?.workerOffscreenPresentationStatus
    ?? metric?.rendererInit?.workerOffscreenPresentationStatus
    ?? null;
  const workerOffscreenPresentationTransport = workerOffscreenPresentation?.transport
    ?? renderState?.workerOffscreenPresentationTransport
    ?? metric?.rendererInit?.workerOffscreenPresentationTransport
    ?? null;
  const workerOffscreenPresentationDisplayHandoff = workerOffscreenPresentation?.displayHandoff
    ?? renderState?.workerOffscreenPresentationDisplayHandoff
    ?? null;
  const workerOffscreenPresentationFrameCopyBackRejected = workerOffscreenPresentation?.frameCopyBackRejected
    ?? renderState?.workerOffscreenPresentationFrameCopyBackRejected
    ?? metric?.rendererInit?.workerOffscreenPresentationFrameCopyBackRejected
    ?? null;
  const workerOffscreenPresentationCopiedBytesPerFrame = numberOrNull(
    workerOffscreenPresentation?.copiedBytesPerFrame
      ?? renderState?.workerOffscreenPresentationCopiedBytesPerFrame
  );
  const workerOffscreenPresentationCopiedBytesPerSecond = numberOrNull(
    workerOffscreenPresentation?.copiedBytesPerSecond
      ?? renderState?.workerOffscreenPresentationCopiedBytesPerSecond
  );
  const workerOffscreenPresentationCanvasTransferred = workerOffscreenPresentation?.canvasTransferred
    ?? renderState?.workerOffscreenPresentationCanvasTransferred
    ?? null;
  const workerOffscreenPresentationWorkerReady = workerOffscreenPresentation?.workerReady
    ?? renderState?.workerOffscreenPresentationWorkerReady
    ?? null;
  const workerOffscreenPresentationReadyEver = workerOffscreenPresentation?.readyEver
    ?? renderState?.workerOffscreenPresentationReadyEver
    ?? null;
  const workerOffscreenPresentationReadyFrameCount = numberOrNull(
    workerOffscreenPresentation?.readyFrameCount
      ?? renderState?.workerOffscreenPresentationReadyFrameCount
  );
  const workerOffscreenPresentationContextStatus = workerOffscreenPresentation?.contextStatus
    ?? renderState?.workerOffscreenPresentationContextStatus
    ?? null;
  const workerOffscreenRenderRows = metric?.workerOffscreenRenderRows
    ?? renderState?.workerOffscreenRenderRows
    ?? metric?.rendererInit?.workerOffscreenRenderRows
    ?? workerOffscreenPresentation?.workerOffscreenRenderRows
    ?? null;
  const workerOffscreenRenderRowsStatus = workerOffscreenRenderRows?.status
    ?? renderState?.workerOffscreenRenderRowsStatus
    ?? metric?.rendererInit?.workerOffscreenRenderRowsStatus
    ?? null;
  const workerOffscreenRenderRowsInputTransport = workerOffscreenRenderRows?.inputTransport
    ?? renderState?.workerOffscreenRenderRowsInputTransport
    ?? metric?.rendererInit?.workerOffscreenRenderRowsInputTransport
    ?? null;
  const workerOffscreenRenderRowsDisplayTransport = workerOffscreenRenderRows?.displayTransport
    ?? renderState?.workerOffscreenRenderRowsDisplayTransport
    ?? null;
  const workerOffscreenRenderRowsDisplayHandoff = workerOffscreenRenderRows?.displayHandoff
    ?? renderState?.workerOffscreenRenderRowsDisplayHandoff
    ?? null;
  const workerOffscreenRenderRowsFrameCopyBackRejected = workerOffscreenRenderRows?.frameCopyBackRejected
    ?? renderState?.workerOffscreenRenderRowsFrameCopyBackRejected
    ?? metric?.rendererInit?.workerOffscreenRenderRowsFrameCopyBackRejected
    ?? null;
  const workerOffscreenRenderRowsCopiedBytesPerFrame = numberOrNull(
    workerOffscreenRenderRows?.copiedBytesPerFrame
      ?? renderState?.workerOffscreenRenderRowsCopiedBytesPerFrame
  );
  const workerOffscreenRenderRowsCopiedBytesPerSecond = numberOrNull(
    workerOffscreenRenderRows?.copiedBytesPerSecond
      ?? renderState?.workerOffscreenRenderRowsCopiedBytesPerSecond
  );
  const workerOffscreenRenderRowsParticleCount = numberOrNull(
    workerOffscreenRenderRows?.particleCount
      ?? renderState?.workerOffscreenRenderRowsParticleCount
  );
  const workerOffscreenRenderRowsInputTransferBytes = numberOrNull(
    workerOffscreenRenderRows?.inputTransferBytes
      ?? renderState?.workerOffscreenRenderRowsInputTransferBytes
  );
  const workerOffscreenRenderRowsParticleBufferByteLength = numberOrNull(
    workerOffscreenRenderRows?.particleBufferByteLength
      ?? renderState?.workerOffscreenRenderRowsParticleBufferByteLength
  );
  const workerOffscreenRenderRowsWorkerLocalProduced =
    workerOffscreenRenderRows?.workerLocalRenderRowsProduced
    ?? renderState?.workerOffscreenRenderRowsWorkerLocalProduced
    ?? null;
  const workerOffscreenRenderRowsProducerSourceKind =
    workerOffscreenRenderRows?.producerSourceKind
    ?? renderState?.workerOffscreenRenderRowsProducerSourceKind
    ?? null;
  const workerOffscreenRenderRowsProducerSourceTransport =
    workerOffscreenRenderRows?.producerSourceTransport
    ?? renderState?.workerOffscreenRenderRowsProducerSourceTransport
    ?? null;
  const workerOffscreenRenderRowsSourceStageId =
    workerOffscreenRenderRows?.sourceStageId
    ?? renderState?.workerOffscreenRenderRowsSourceStageId
    ?? null;
  const workerOffscreenRenderRowsRetainedParticleStateStatus =
    workerOffscreenRenderRows?.retainedParticleStateStatus
    ?? renderState?.workerOffscreenRenderRowsRetainedParticleStateStatus
    ?? null;
  const workerOffscreenRenderRowsRetainedStageOutputPreserved =
    workerOffscreenRenderRows?.retainedStageOutputPreservedByResidentRenderAssembly
    ?? renderState?.workerOffscreenRenderRowsRetainedStageOutputPreserved
    ?? null;
  const workerOffscreenRenderRowsSkippedLegacyDrawForRetainedStageOutput =
    workerOffscreenRenderRows?.skippedLegacyDrawForRetainedStageOutput
    ?? renderState?.workerOffscreenRenderRowsSkippedLegacyDrawForRetainedStageOutput
    ?? null;
  const workerOffscreenRenderRowsSourceTransferBytes = numberOrNull(
    workerOffscreenRenderRows?.sourceTransferBytes
      ?? renderState?.workerOffscreenRenderRowsSourceTransferBytes
  );
  const workerOffscreenRenderRowsSourceStateTransferBytes = numberOrNull(
    workerOffscreenRenderRows?.sourceStateTransferBytes
      ?? renderState?.workerOffscreenRenderRowsSourceStateTransferBytes
  );
  const workerOffscreenRenderRowsSourceCacheKey = workerOffscreenRenderRows?.sourceCacheKey
    ?? renderState?.workerOffscreenRenderRowsSourceCacheKey
    ?? null;
  const workerOffscreenRenderRowsSourceCacheStatus = workerOffscreenRenderRows?.sourceCacheStatus
    ?? renderState?.workerOffscreenRenderRowsSourceCacheStatus
    ?? null;
  const workerOffscreenRenderRowsSourceCacheKeyStrategy = workerOffscreenRenderRows?.sourceCacheKeyStrategy
    ?? renderState?.workerOffscreenRenderRowsSourceCacheKeyStrategy
    ?? null;
  const workerOffscreenRenderRowsSourceCacheMissReason = workerOffscreenRenderRows?.sourceCacheMissReason
    ?? renderState?.workerOffscreenRenderRowsSourceCacheMissReason
    ?? null;
  const workerOffscreenRenderRowsSourceCpuStateStale = workerOffscreenRenderRows?.sourceCpuStateStale
    ?? renderState?.workerOffscreenRenderRowsSourceCpuStateStale
    ?? null;
  const workerOffscreenRenderRowsSourceCacheHit = workerOffscreenRenderRows?.sourceCacheHit
    ?? renderState?.workerOffscreenRenderRowsSourceCacheHit
    ?? null;
  const workerOffscreenRenderRowsSourceRowsPacked = workerOffscreenRenderRows?.sourceRowsPacked
    ?? renderState?.workerOffscreenRenderRowsSourceRowsPacked
    ?? null;
  const workerOffscreenRenderRowsCanvasTransferred = workerOffscreenRenderRows?.canvasTransferred
    ?? renderState?.workerOffscreenRenderRowsCanvasTransferred
    ?? null;
  const workerOffscreenRenderRowsWorkerReady = workerOffscreenRenderRows?.workerReady
    ?? renderState?.workerOffscreenRenderRowsWorkerReady
    ?? null;
  const workerOffscreenRenderRowsReadyEver = workerOffscreenRenderRows?.readyEver
    ?? renderState?.workerOffscreenRenderRowsReadyEver
    ?? null;
  const workerOffscreenRenderRowsReadyFrameCount = numberOrNull(
    workerOffscreenRenderRows?.readyFrameCount
      ?? renderState?.workerOffscreenRenderRowsReadyFrameCount
  );
  const workerOffscreenRenderRowsContextStatus = workerOffscreenRenderRows?.contextStatus
    ?? renderState?.workerOffscreenRenderRowsContextStatus
    ?? null;
  const workerOffscreenRetainedGpuBufferHandoff = metric?.workerOffscreenRetainedGpuBufferHandoff
    ?? renderState?.workerOffscreenRetainedGpuBufferHandoff
    ?? metric?.rendererInit?.workerOffscreenRetainedGpuBufferHandoff
    ?? null;
  const workerOffscreenRetainedGpuBufferHandoffStatus =
    workerOffscreenRetainedGpuBufferHandoff?.status
    ?? renderState?.workerOffscreenRetainedGpuBufferHandoffStatus
    ?? metric?.rendererInit?.workerOffscreenRetainedGpuBufferHandoffStatus
    ?? null;
  const workerOffscreenRetainedGpuBufferHandoffReason =
    workerOffscreenRetainedGpuBufferHandoff?.reason
    ?? renderState?.workerOffscreenRetainedGpuBufferHandoffReason
    ?? null;
  const workerOffscreenRetainedGpuBufferHandoffInputTransport =
    workerOffscreenRetainedGpuBufferHandoff?.inputTransport
    ?? renderState?.workerOffscreenRetainedGpuBufferHandoffInputTransport
    ?? null;
  const workerOffscreenRetainedGpuBufferHandoffPreferredReplacementTransport =
    workerOffscreenRetainedGpuBufferHandoff?.preferredReplacementTransport
    ?? renderState?.workerOffscreenRetainedGpuBufferHandoffPreferredReplacementTransport
    ?? null;
  const workerOffscreenRetainedGpuBufferHandoffFrameCopyBackRejected =
    workerOffscreenRetainedGpuBufferHandoff?.frameCopyBackRejected
    ?? renderState?.workerOffscreenRetainedGpuBufferHandoffFrameCopyBackRejected
    ?? null;
  const workerOffscreenRetainedGpuBufferHandoffPlanChangeRequired =
    workerOffscreenRetainedGpuBufferHandoff?.planChangeRequired
    ?? renderState?.workerOffscreenRetainedGpuBufferHandoffPlanChangeRequired
    ?? metric?.rendererInit?.workerOffscreenRetainedGpuBufferHandoffPlanChangeRequired
    ?? null;
  const workerOffscreenRetainedGpuBufferHandoffCrossOriginIsolated =
    workerOffscreenRetainedGpuBufferHandoff?.crossOriginIsolated
    ?? renderState?.workerOffscreenRetainedGpuBufferHandoffCrossOriginIsolated
    ?? null;
  const workerOffscreenRetainedGpuBufferHandoffStructuredCloneSupported =
    workerOffscreenRetainedGpuBufferHandoff?.gpuBufferStructuredCloneSupported
    ?? renderState?.workerOffscreenRetainedGpuBufferHandoffStructuredCloneSupported
    ?? null;
  const workerOffscreenRetainedGpuBufferHandoffProbeStatus =
    workerOffscreenRetainedGpuBufferHandoff?.gpuBufferStructuredCloneProbeStatus
    ?? renderState?.workerOffscreenRetainedGpuBufferHandoffProbeStatus
    ?? null;
  const workerOffscreenRetainedGpuBufferHandoffRetainedRenderRowsBufferAvailable =
    workerOffscreenRetainedGpuBufferHandoff?.retainedRenderRowsBufferAvailable
    ?? renderState?.workerOffscreenRetainedGpuBufferHandoffRetainedRenderRowsBufferAvailable
    ?? null;
  const workerOffscreenRetainedGpuBufferHandoffRetainedSurfaceDrawBufferAvailable =
    workerOffscreenRetainedGpuBufferHandoff?.retainedSurfaceDrawBufferAvailable
    ?? renderState?.workerOffscreenRetainedGpuBufferHandoffRetainedSurfaceDrawBufferAvailable
    ?? null;
  const workerOffscreenRetainedGpuBufferHandoffSameDeviceOwner =
    workerOffscreenRetainedGpuBufferHandoff?.sameDeviceOwner
    ?? renderState?.workerOffscreenRetainedGpuBufferHandoffSameDeviceOwner
    ?? null;
  const workerOffscreenRetainedGpuBufferHandoffWorkerPresentationDeviceOwner =
    workerOffscreenRetainedGpuBufferHandoff?.workerPresentationDeviceOwner
    ?? renderState?.workerOffscreenRetainedGpuBufferHandoffWorkerPresentationDeviceOwner
    ?? null;
  const workerOffscreenRetainedGpuBufferHandoffResidentBufferDeviceOwner =
    workerOffscreenRetainedGpuBufferHandoff?.residentBufferDeviceOwner
    ?? renderState?.workerOffscreenRetainedGpuBufferHandoffResidentBufferDeviceOwner
    ?? null;
  const workerOffscreenResidentStage = metric?.workerOffscreenResidentStage
    ?? renderState?.workerOffscreenResidentStage
    ?? metric?.rendererInit?.workerOffscreenResidentStage
    ?? null;
  const workerOffscreenResidentStageStatus =
    workerOffscreenResidentStage?.status
    ?? renderState?.workerOffscreenResidentStageStatus
    ?? metric?.rendererInit?.workerOffscreenResidentStageStatus
    ?? null;
  const workerOffscreenResidentStageInputTransport =
    workerOffscreenResidentStage?.inputTransport
    ?? renderState?.workerOffscreenResidentStageInputTransport
    ?? metric?.rendererInit?.workerOffscreenResidentStageInputTransport
    ?? null;
  const workerOffscreenResidentStageStageId =
    workerOffscreenResidentStage?.stageId
    ?? renderState?.workerOffscreenResidentStageStageId
    ?? null;
  const workerOffscreenResidentStageWorkerDeviceSource =
    workerOffscreenResidentStage?.workerDeviceSource
    ?? renderState?.workerOffscreenResidentStageWorkerDeviceSource
    ?? metric?.rendererInit?.workerOffscreenResidentStageWorkerDeviceSource
    ?? null;
  const workerOffscreenResidentStageWorkerDeviceProvided =
    workerOffscreenResidentStage?.workerDeviceProvided
    ?? renderState?.workerOffscreenResidentStageWorkerDeviceProvided
    ?? null;
  const workerOffscreenResidentStageRetainedBufferRefCount = numberOrNull(
    workerOffscreenResidentStage?.residentStageRetainedBufferRefs?.length
      ?? renderState?.workerOffscreenResidentStageRetainedBufferRefCount
  );
  const workerOffscreenResidentStageGpuFenceSatisfied =
    workerOffscreenResidentStage?.residentStageGpuFence?.fenceSatisfied
    ?? renderState?.workerOffscreenResidentStageGpuFenceSatisfied
    ?? null;
  const workerOffscreenResidentStageGpuFenceStatus =
    workerOffscreenResidentStage?.residentStageGpuFence?.status
    ?? renderState?.workerOffscreenResidentStageGpuFenceStatus
    ?? null;
  const workerOffscreenResidentStageQueueCompletionStatus =
    workerOffscreenResidentStage?.residentStageGpuFence?.queueCompletionStatus
    ?? renderState?.workerOffscreenResidentStageQueueCompletionStatus
    ?? null;
  const workerOffscreenResidentStageQueueCompletionMethod =
    workerOffscreenResidentStage?.residentStageGpuFence?.queueCompletionMethod
    ?? renderState?.workerOffscreenResidentStageQueueCompletionMethod
    ?? null;
  const workerOffscreenResidentStageQueueCompletionFallbackFrom =
    workerOffscreenResidentStage?.residentStageGpuFence?.queueCompletionFallbackFrom
    ?? renderState?.workerOffscreenResidentStageQueueCompletionFallbackFrom
    ?? null;
  const workerOffscreenResidentStageQueueCompletionErrorMessage =
    workerOffscreenResidentStage?.residentStageGpuFence?.queueCompletionErrorMessage
    ?? renderState?.workerOffscreenResidentStageQueueCompletionErrorMessage
    ?? null;
  const workerOffscreenResidentStageCpuQueueFenceBypassed =
    workerOffscreenResidentStage?.residentStageGpuFence?.cpuQueueFenceBypassed
    ?? renderState?.workerOffscreenResidentStageCpuQueueFenceBypassed
    ?? null;
  const workerOffscreenResidentStageSameWorkerGpuHandoff =
    workerOffscreenResidentStage?.residentStageGpuFence?.sameWorkerGpuHandoff
    ?? renderState?.workerOffscreenResidentStageSameWorkerGpuHandoff
    ?? null;
  const workerOffscreenResidentStageElapsedMs = numberOrNull(
    workerOffscreenResidentStage?.elapsedMs
      ?? renderState?.workerOffscreenResidentStageElapsedMs
  );
  const workerOffscreenResidentStageTimeoutMs = numberOrNull(
    workerOffscreenResidentStage?.timeoutMs
      ?? renderState?.workerOffscreenResidentStageTimeoutMs
  );
  const workerOffscreenResidentStageErrorName =
    workerOffscreenResidentStage?.errorName
    ?? renderState?.workerOffscreenResidentStageErrorName
    ?? null;
  const workerOffscreenResidentStageErrorMessage =
    workerOffscreenResidentStage?.errorMessage
    ?? renderState?.workerOffscreenResidentStageErrorMessage
    ?? null;
  const workerOffscreenResidentStageChain =
    metric?.workerOffscreenResidentStageChain
    ?? renderState?.workerOffscreenResidentStageChain
    ?? metric?.rendererInit?.workerOffscreenResidentStageChain
    ?? null;
  const workerOffscreenResidentStageChainStatus =
    workerOffscreenResidentStageChain?.status
    ?? renderState?.workerOffscreenResidentStageChainStatus
    ?? metric?.rendererInit?.workerOffscreenResidentStageChainStatus
    ?? null;
  const workerOffscreenResidentStageChainStageCount = numberOrNull(
    workerOffscreenResidentStageChain?.stages?.length
      ?? renderState?.workerOffscreenResidentStageChainStageCount
  );
  const workerOffscreenResidentStageChainSameWorkerGpuHandoff =
    workerOffscreenResidentStageChain?.sameWorkerGpuHandoff
    ?? renderState?.workerOffscreenResidentStageChainSameWorkerGpuHandoff
    ?? null;
  const workerOffscreenResidentStageChainAuto =
    metric?.workerOffscreenResidentStageChainAuto
    ?? renderState?.workerOffscreenResidentStageChainAuto
    ?? metric?.rendererInit?.workerOffscreenResidentStageChainAuto
    ?? null;
  const workerOffscreenResidentStageChainAutoStatus =
    workerOffscreenResidentStageChainAuto?.status
    ?? renderState?.workerOffscreenResidentStageChainAutoStatus
    ?? metric?.rendererInit?.workerOffscreenResidentStageChainAutoStatus
    ?? null;
  const workerOffscreenResidentStageChainAutoRequested =
    workerOffscreenResidentStageChainAuto?.requested
    ?? renderState?.workerOffscreenResidentStageChainAutoRequested
    ?? null;
  const workerOffscreenResidentStageChainAutoPolicyReady =
    workerOffscreenResidentStageChainAuto?.policyReady
    ?? renderState?.workerOffscreenResidentStageChainAutoPolicyReady
    ?? null;
  const workerOffscreenResidentStageChainAutoPresentationReady =
    workerOffscreenResidentStageChainAuto?.presentationReady
    ?? renderState?.workerOffscreenResidentStageChainAutoPresentationReady
    ?? null;
  const workerOffscreenResidentStageChainAutoSourceSignature =
    workerOffscreenResidentStageChainAuto?.sourceSignature
    ?? renderState?.workerOffscreenResidentStageChainAutoSourceSignature
    ?? null;
  const workerOffscreenResidentStageChainAutoSourceMode =
    workerOffscreenResidentStageChainAuto?.sourceMode
    ?? renderState?.workerOffscreenResidentStageChainAutoSourceMode
    ?? null;
  const workerOffscreenResidentStageChainAutoSourceCpuStateStale =
    workerOffscreenResidentStageChainAuto?.sourceCpuStateStale
    ?? renderState?.workerOffscreenResidentStageChainAutoSourceCpuStateStale
    ?? null;
  const workerOffscreenResidentStageChainAutoLatestResidentOutputCpuStateStale =
    workerOffscreenResidentStageChainAuto?.latestResidentOutputCpuStateStale
    ?? renderState?.workerOffscreenResidentStageChainAutoLatestResidentOutputCpuStateStale
    ?? null;
  const workerOffscreenResidentStageChainAutoAuthoritativeStateMutation =
    workerOffscreenResidentStageChainAuto?.authoritativeStateMutation
    ?? renderState?.workerOffscreenResidentStageChainAutoAuthoritativeStateMutation
    ?? null;
  const workerOffscreenResidentStageChainAutoStatePromotionStatus =
    workerOffscreenResidentStageChainAuto?.statePromotionStatus
    ?? renderState?.workerOffscreenResidentStageChainAutoStatePromotionStatus
    ?? null;
  const workerOffscreenResidentStageChainAutoChainStatus =
    workerOffscreenResidentStageChainAuto?.chainStatus
    ?? renderState?.workerOffscreenResidentStageChainAutoChainStatus
    ?? null;
  const workerOffscreenResidentStageChainAutoSameWorkerGpuHandoff =
    workerOffscreenResidentStageChainAuto?.sameWorkerGpuHandoff
    ?? renderState?.workerOffscreenResidentStageChainAutoSameWorkerGpuHandoff
    ?? null;
  const workerOffscreenRetainedStatePromotionCandidate =
    metric?.workerOffscreenRetainedStatePromotionCandidate
    ?? renderState?.workerOffscreenRetainedStatePromotionCandidate
    ?? metric?.rendererInit?.workerOffscreenRetainedStatePromotionCandidate
    ?? null;
  const workerOffscreenRetainedStatePromotionCandidateStatus =
    workerOffscreenRetainedStatePromotionCandidate?.status
    ?? renderState?.workerOffscreenRetainedStatePromotionCandidateStatus
    ?? null;
  const workerOffscreenRetainedStatePromotionCandidateAdmissionStatus =
    workerOffscreenRetainedStatePromotionCandidate?.admissionStatus
    ?? renderState?.workerOffscreenRetainedStatePromotionCandidateAdmissionStatus
    ?? null;
  const workerOffscreenRetainedStatePromotionCandidateStatePromotionStatus =
    workerOffscreenRetainedStatePromotionCandidate?.statePromotionStatus
    ?? renderState?.workerOffscreenRetainedStatePromotionCandidateStatePromotionStatus
    ?? null;
  const workerOffscreenRetainedStatePromotionCandidateAuthoritativeStateMutation =
    workerOffscreenRetainedStatePromotionCandidate?.authoritativeStateMutation
    ?? renderState?.workerOffscreenRetainedStatePromotionCandidateAuthoritativeStateMutation
    ?? null;
  const workerOffscreenRetainedStatePromotionCandidateStateManagerAdmissionRequired =
    workerOffscreenRetainedStatePromotionCandidate?.stateManagerAdmissionRequired
    ?? renderState?.workerOffscreenRetainedStatePromotionCandidateStateManagerAdmissionRequired
    ?? null;
  const workerOffscreenRetainedStatePromotionCandidateSameWorkerGpuHandoff =
    workerOffscreenRetainedStatePromotionCandidate?.sameWorkerGpuHandoff
    ?? renderState?.workerOffscreenRetainedStatePromotionCandidateSameWorkerGpuHandoff
    ?? null;
  const workerOffscreenRetainedStatePromotionCandidateSourceStageId =
    workerOffscreenRetainedStatePromotionCandidate?.sourceStageId
    ?? renderState?.workerOffscreenRetainedStatePromotionCandidateSourceStageId
    ?? null;
  const workerOffscreenRetainedStatePromotionCandidateRetainedBufferRefCount = numberOrNull(
    workerOffscreenRetainedStatePromotionCandidate?.retainedBufferRefCount
      ?? renderState?.workerOffscreenRetainedStatePromotionCandidateRetainedBufferRefCount
  );
  const workerOffscreenRetainedStatePromotionCandidateGpuFenceSatisfied =
    workerOffscreenRetainedStatePromotionCandidate?.gpuFenceSatisfied
    ?? renderState?.workerOffscreenRetainedStatePromotionCandidateGpuFenceSatisfied
    ?? null;
  const workerOffscreenRetainedStatePromotionCandidateSourceStateTransferBytes = numberOrNull(
    workerOffscreenRetainedStatePromotionCandidate?.sourceStateTransferBytes
      ?? renderState?.workerOffscreenRetainedStatePromotionCandidateSourceStateTransferBytes
  );
  const workerOffscreenRetainedStatePromotionCandidateSourceTransferBytes = numberOrNull(
    workerOffscreenRetainedStatePromotionCandidate?.sourceTransferBytes
      ?? renderState?.workerOffscreenRetainedStatePromotionCandidateSourceTransferBytes
  );
  const workerOffscreenRetainedStatePromotionCandidatePortableSnapshotRequired =
    workerOffscreenRetainedStatePromotionCandidate?.portableSnapshotRequired
    ?? renderState?.workerOffscreenRetainedStatePromotionCandidatePortableSnapshotRequired
    ?? null;
  const workerOffscreenRetainedStatePromotionCandidatePortableSnapshotAvailable =
    workerOffscreenRetainedStatePromotionCandidate?.portableSnapshotAvailable
    ?? renderState?.workerOffscreenRetainedStatePromotionCandidatePortableSnapshotAvailable
    ?? null;
  const workerOffscreenRetainedStatePromotionCandidateCrossPeerReplayStatus =
    workerOffscreenRetainedStatePromotionCandidate?.crossPeerReplayStatus
    ?? renderState?.workerOffscreenRetainedStatePromotionCandidateCrossPeerReplayStatus
    ?? null;
  const workerOffscreenRetainedStatePromotionCandidateCrossPeerReplayBlocker =
    workerOffscreenRetainedStatePromotionCandidate?.crossPeerReplayBlocker
    ?? renderState?.workerOffscreenRetainedStatePromotionCandidateCrossPeerReplayBlocker
    ?? null;
  const workerOffscreenRetainedStatePromotionAdmission =
    metric?.workerOffscreenRetainedStatePromotionAdmission
    ?? renderState?.workerOffscreenRetainedStatePromotionAdmission
    ?? metric?.rendererInit?.workerOffscreenRetainedStatePromotionAdmission
    ?? null;
  const workerOffscreenRetainedStatePromotionAdmissionStatus =
    workerOffscreenRetainedStatePromotionAdmission?.status
    ?? renderState?.workerOffscreenRetainedStatePromotionAdmissionStatus
    ?? null;
  const workerOffscreenRetainedStatePromotionAdmissionAccepted =
    workerOffscreenRetainedStatePromotionAdmission?.accepted
    ?? renderState?.workerOffscreenRetainedStatePromotionAdmissionAccepted
    ?? null;
  const workerOffscreenRetainedStatePromotionAdmissionCommitted =
    workerOffscreenRetainedStatePromotionAdmission?.committed
    ?? renderState?.workerOffscreenRetainedStatePromotionAdmissionCommitted
    ?? null;
  const workerOffscreenRetainedStatePromotionAdmissionScope =
    workerOffscreenRetainedStatePromotionAdmission?.commitDeltaScope
    ?? renderState?.workerOffscreenRetainedStatePromotionAdmissionScope
    ?? null;
  const workerOffscreenRetainedStatePromotionAdmissionTaskId =
    workerOffscreenRetainedStatePromotionAdmission?.commitDeltaTaskId
    ?? renderState?.workerOffscreenRetainedStatePromotionAdmissionTaskId
    ?? null;
  const workerOffscreenRetainedStatePromotionAdmissionHotBufferKey =
    workerOffscreenRetainedStatePromotionAdmission?.hotBufferKey
    ?? renderState?.workerOffscreenRetainedStatePromotionAdmissionHotBufferKey
    ?? null;
  const workerOffscreenRetainedStatePromotionAdmissionStatePromotionStatus =
    workerOffscreenRetainedStatePromotionAdmission?.statePromotionStatus
    ?? renderState?.workerOffscreenRetainedStatePromotionAdmissionStatePromotionStatus
    ?? null;
  const workerOffscreenRetainedStatePromotionAdmissionContinuationRequired =
    workerOffscreenRetainedStatePromotionAdmission?.continuationRequired
    ?? renderState?.workerOffscreenRetainedStatePromotionAdmissionContinuationRequired
    ?? null;
  const workerOffscreenRetainedStatePromotionAdmissionPortableState =
    workerOffscreenRetainedStatePromotionAdmission?.portableState
    ?? renderState?.workerOffscreenRetainedStatePromotionAdmissionPortableState
    ?? null;
  const workerOffscreenRetainedStatePromotionAdmissionAuthoritativeStateMutation =
    workerOffscreenRetainedStatePromotionAdmission?.authoritativeStateMutation
    ?? renderState?.workerOffscreenRetainedStatePromotionAdmissionAuthoritativeStateMutation
    ?? null;
  const workerOffscreenRetainedStatePromotionAdmissionPortableSnapshotRequired =
    workerOffscreenRetainedStatePromotionAdmission?.portableSnapshotRequired
    ?? renderState?.workerOffscreenRetainedStatePromotionAdmissionPortableSnapshotRequired
    ?? null;
  const workerOffscreenRetainedStatePromotionAdmissionPortableSnapshotAvailable =
    workerOffscreenRetainedStatePromotionAdmission?.portableSnapshotAvailable
    ?? renderState?.workerOffscreenRetainedStatePromotionAdmissionPortableSnapshotAvailable
    ?? null;
  const workerOffscreenRetainedStatePromotionAdmissionPortableMaterializationStatus =
    workerOffscreenRetainedStatePromotionAdmission?.portableMaterializationStatus
    ?? renderState?.workerOffscreenRetainedStatePromotionAdmissionPortableMaterializationStatus
    ?? null;
  const workerOffscreenRetainedStatePromotionAdmissionCrossPeerReplayStatus =
    workerOffscreenRetainedStatePromotionAdmission?.crossPeerReplayStatus
    ?? renderState?.workerOffscreenRetainedStatePromotionAdmissionCrossPeerReplayStatus
    ?? null;
  const workerOffscreenRetainedStatePromotionAdmissionCrossPeerReplayBlocker =
    workerOffscreenRetainedStatePromotionAdmission?.crossPeerReplayBlocker
    ?? renderState?.workerOffscreenRetainedStatePromotionAdmissionCrossPeerReplayBlocker
    ?? null;
  const workerOffscreenRetainedStateContinuation =
    metric?.workerOffscreenRetainedStateContinuation
    ?? renderState?.workerOffscreenRetainedStateContinuation
    ?? metric?.rendererInit?.workerOffscreenRetainedStateContinuation
    ?? null;
  const workerOffscreenRetainedStateContinuationStatus =
    workerOffscreenRetainedStateContinuation?.status
    ?? renderState?.workerOffscreenRetainedStateContinuationStatus
    ?? null;
  const workerOffscreenRetainedStateContinuationHotBufferKey =
    workerOffscreenRetainedStateContinuation?.hotBufferKey
    ?? renderState?.workerOffscreenRetainedStateContinuationHotBufferKey
    ?? null;
  const workerOffscreenRetainedStateContinuationSourceHotBufferKey =
    workerOffscreenRetainedStateContinuation?.sourceHotBufferKey
    ?? renderState?.workerOffscreenRetainedStateContinuationSourceHotBufferKey
    ?? null;
  const workerOffscreenRetainedStateContinuationAdmissionStatus =
    workerOffscreenRetainedStateContinuation?.admissionStatus
    ?? renderState?.workerOffscreenRetainedStateContinuationAdmissionStatus
    ?? null;
  const workerOffscreenRetainedStateContinuationAdmissionCommitted =
    workerOffscreenRetainedStateContinuation?.admissionCommitted
    ?? renderState?.workerOffscreenRetainedStateContinuationAdmissionCommitted
    ?? null;
  const workerOffscreenRetainedStateContinuationPlanStatus =
    workerOffscreenRetainedStateContinuation?.continuationPlanStatus
    ?? renderState?.workerOffscreenRetainedStateContinuationPlanStatus
    ?? null;
  const workerOffscreenRetainedStateContinuationUseWorkerRetainedInput =
    workerOffscreenRetainedStateContinuation?.useWorkerRetainedInput
    ?? renderState?.workerOffscreenRetainedStateContinuationUseWorkerRetainedInput
    ?? null;
  const workerOffscreenRetainedStateContinuationInputStatus =
    workerOffscreenRetainedStateContinuation?.workerRetainedContinuationInputStatus
    ?? renderState?.workerOffscreenRetainedStateContinuationInputStatus
    ?? null;
  const workerOffscreenRetainedStateContinuationApplied =
    workerOffscreenRetainedStateContinuation?.workerRetainedContinuationApplied
    ?? renderState?.workerOffscreenRetainedStateContinuationApplied
    ?? null;
  const workerOffscreenRetainedStateContinuationChainStatus =
    workerOffscreenRetainedStateContinuation?.chainStatus
    ?? renderState?.workerOffscreenRetainedStateContinuationChainStatus
    ?? null;
  const workerOffscreenRetainedStateContinuationBlocker =
    workerOffscreenRetainedStateContinuation?.blocker
    ?? renderState?.workerOffscreenRetainedStateContinuationBlocker
    ?? null;
  const workerOffscreenRetainedStateContinuationPortableState =
    workerOffscreenRetainedStateContinuation?.portableState
    ?? renderState?.workerOffscreenRetainedStateContinuationPortableState
    ?? null;
  const workerOffscreenRetainedStateContinuationAuthoritativeStateMutation =
    workerOffscreenRetainedStateContinuation?.authoritativeStateMutation
    ?? renderState?.workerOffscreenRetainedStateContinuationAuthoritativeStateMutation
    ?? null;
  const workerOffscreenRetainedStateContinuationPortableSnapshotRequired =
    workerOffscreenRetainedStateContinuation?.portableSnapshotRequired
    ?? renderState?.workerOffscreenRetainedStateContinuationPortableSnapshotRequired
    ?? null;
  const workerOffscreenRetainedStateContinuationPortableSnapshotAvailable =
    workerOffscreenRetainedStateContinuation?.portableSnapshotAvailable
    ?? renderState?.workerOffscreenRetainedStateContinuationPortableSnapshotAvailable
    ?? null;
  const workerOffscreenRetainedStateContinuationPortableMaterializationStatus =
    workerOffscreenRetainedStateContinuation?.portableMaterializationStatus
    ?? renderState?.workerOffscreenRetainedStateContinuationPortableMaterializationStatus
    ?? null;
  const workerOffscreenRetainedStateContinuationCrossPeerReplayStatus =
    workerOffscreenRetainedStateContinuation?.crossPeerReplayStatus
    ?? renderState?.workerOffscreenRetainedStateContinuationCrossPeerReplayStatus
    ?? null;
  const workerOffscreenRetainedStateContinuationCrossPeerReplayBlocker =
    workerOffscreenRetainedStateContinuation?.crossPeerReplayBlocker
    ?? renderState?.workerOffscreenRetainedStateContinuationCrossPeerReplayBlocker
    ?? null;
  const workerOffscreenRetainedCompactSnapshot =
    metric?.workerOffscreenRetainedCompactSnapshot
    ?? renderState?.workerOffscreenRetainedCompactSnapshot
    ?? metric?.rendererInit?.workerOffscreenRetainedCompactSnapshot
    ?? null;
  const workerOffscreenRetainedCompactSnapshotStatus =
    workerOffscreenRetainedCompactSnapshot?.status
    ?? renderState?.workerOffscreenRetainedCompactSnapshotStatus
    ?? null;
  const workerOffscreenRetainedCompactSnapshotReason =
    workerOffscreenRetainedCompactSnapshot?.reason
    ?? renderState?.workerOffscreenRetainedCompactSnapshotReason
    ?? null;
  const workerOffscreenRetainedCompactSnapshotSchema =
    workerOffscreenRetainedCompactSnapshot?.compactBufferSnapshot?.schema
    ?? workerOffscreenRetainedCompactSnapshot?.compactBufferSnapshotSchema
    ?? renderState?.workerOffscreenRetainedCompactSnapshotSchema
    ?? null;
  const workerOffscreenRetainedCompactSnapshotAvailable =
    workerOffscreenRetainedCompactSnapshot?.portableSnapshotAvailable
    ?? renderState?.workerOffscreenRetainedCompactSnapshotAvailable
    ?? null;
  const workerOffscreenRetainedCompactSnapshotCrossPeerReplayReady =
    workerOffscreenRetainedCompactSnapshot?.crossPeerReplayReady
    ?? renderState?.workerOffscreenRetainedCompactSnapshotCrossPeerReplayReady
    ?? null;
  const workerOffscreenRetainedCompactSnapshotParticleCount = numberOrNull(
    workerOffscreenRetainedCompactSnapshot?.particleCount
      ?? renderState?.workerOffscreenRetainedCompactSnapshotParticleCount
  );
  const workerOffscreenRetainedCompactSnapshotReadbackByteLength = numberOrNull(
    workerOffscreenRetainedCompactSnapshot?.readbackByteLength
      ?? renderState?.workerOffscreenRetainedCompactSnapshotReadbackByteLength
  );
  const workerOffscreenRetainedCompactSnapshotSphStateByteLength = numberOrNull(
    workerOffscreenRetainedCompactSnapshot?.sphStateByteLength
      ?? renderState?.workerOffscreenRetainedCompactSnapshotSphStateByteLength
  );
  const workerOffscreenRetainedCompactSnapshotSphThermoByteLength = numberOrNull(
    workerOffscreenRetainedCompactSnapshot?.sphThermoByteLength
      ?? renderState?.workerOffscreenRetainedCompactSnapshotSphThermoByteLength
  );
  const workerOffscreenRetainedCompactSnapshotMlsMpmMechanicsByteLength = numberOrNull(
    workerOffscreenRetainedCompactSnapshot?.mlsMpmMechanicsByteLength
      ?? renderState?.workerOffscreenRetainedCompactSnapshotMlsMpmMechanicsByteLength
  );
  const workerOffscreenRetainedCompactSnapshotErrorMessage =
    workerOffscreenRetainedCompactSnapshot?.errorMessage
    ?? renderState?.workerOffscreenRetainedCompactSnapshotErrorMessage
    ?? null;
  const surfaceDrawStatus = renderState?.surfaceDrawStatus ?? surfaceDraw?.status ?? null;
  const surfaceDrawBridge = renderState?.surfaceDrawVisibleRendererBridge ?? surfaceDraw?.visibleRendererBridge ?? null;
  const surfaceDrawBridgeCapabilityStatus = renderState?.surfaceDrawRenderBridgeCapabilityStatus
    ?? surfaceDraw?.renderBridgeCapabilityStatus
    ?? null;
  const surfaceDrawBridgeCapabilityReason = renderState?.surfaceDrawRenderBridgeCapabilityReason
    ?? surfaceDraw?.renderBridgeCapabilityReason
    ?? null;
  const surfaceDrawBridgeRendererBackend = renderState?.surfaceDrawRenderBridgeRendererBackend
    ?? surfaceDraw?.renderBridgeRendererBackend
    ?? null;
  const surfaceDrawBridgeVisibleNoReadbackSupported = renderState?.surfaceDrawRenderBridgeVisibleNoReadbackSupported
    ?? surfaceDraw?.renderBridgeVisibleNoReadbackSupported
    ?? null;
  const surfaceDrawGpuBufferHandoffReady = Boolean(
    renderState?.surfaceDrawGpuBufferHandoffReady
    ?? surfaceDraw?.gpuBufferHandoffReady
    ?? surfaceDraw?.surfaceDrawGpuBufferHandoffReady
  );
  const surfaceDrawGpuBufferHandoffStatus = renderState?.surfaceDrawGpuBufferHandoffStatus
    ?? surfaceDraw?.gpuBufferHandoffStatus
    ?? surfaceDraw?.surfaceDrawGpuBufferHandoffStatus
    ?? null;
  const surfaceDrawGpuBufferHandoffReason = renderState?.surfaceDrawGpuBufferHandoffReason
    ?? surfaceDraw?.gpuBufferHandoffReason
    ?? surfaceDraw?.surfaceDrawGpuBufferHandoffReason
    ?? null;
  const surfaceDrawGpuBufferHandoffKind = renderState?.surfaceDrawGpuBufferHandoffKind
    ?? surfaceDraw?.gpuBufferHandoffKind
    ?? surfaceDraw?.surfaceDrawGpuBufferHandoffKind
    ?? null;
  const surfaceDrawGpuBufferHandoffInputSchema = renderState?.surfaceDrawGpuBufferHandoffInputSchema
    ?? surfaceDraw?.gpuBufferHandoffInputSchema
    ?? surfaceDraw?.surfaceDrawGpuBufferHandoffInputSchema
    ?? null;
  const surfaceDrawGpuBufferHandoffRequiresSurfaceExtraction = Boolean(
    renderState?.surfaceDrawGpuBufferHandoffRequiresSurfaceExtraction
    ?? surfaceDraw?.gpuBufferHandoffRequiresSurfaceExtraction
    ?? surfaceDraw?.surfaceDrawGpuBufferHandoffRequiresSurfaceExtraction
  );
  const surfaceDrawGpuBufferHandoffUpperBoundVertexCount = numberOrNull(
    renderState?.surfaceDrawGpuBufferHandoffUpperBoundVertexCount
      ?? surfaceDraw?.gpuBufferHandoffUpperBoundVertexCount
      ?? surfaceDraw?.surfaceDrawGpuBufferHandoffUpperBoundVertexCount
  );
  const surfaceDrawVisibleGpuConsumerReady = Boolean(firstDefinedMetricValue(
    ownMetricValue(renderState, 'surfaceDrawVisibleGpuConsumerReady'),
    ownMetricValue(surfaceDraw, 'surfaceDrawVisibleGpuConsumerReady'),
    ownMetricValue(surfaceDraw, 'visibleGpuConsumerReady')
  ));
  const surfaceDrawVisibleGpuConsumerStatus = firstDefinedMetricValue(
    ownMetricValue(renderState, 'surfaceDrawVisibleGpuConsumerStatus'),
    ownMetricValue(surfaceDraw, 'surfaceDrawVisibleGpuConsumerStatus'),
    ownMetricValue(surfaceDraw, 'visibleGpuConsumerStatus')
  );
  const surfaceDrawVisibleGpuConsumerReason = firstDefinedMetricValue(
    ownMetricValue(renderState, 'surfaceDrawVisibleGpuConsumerReason'),
    ownMetricValue(surfaceDraw, 'surfaceDrawVisibleGpuConsumerReason'),
    ownMetricValue(surfaceDraw, 'visibleGpuConsumerReason')
  );
  const surfaceDrawVisibleGpuConsumerInputReady = Boolean(firstDefinedMetricValue(
    ownMetricValue(renderState, 'surfaceDrawVisibleGpuConsumerInputReady'),
    ownMetricValue(surfaceDraw, 'surfaceDrawVisibleGpuConsumerInputReady'),
    ownMetricValue(surfaceDraw, 'visibleGpuConsumerInputReady')
  ));
  const surfaceDrawVisibleGpuConsumerInputKind = firstDefinedMetricValue(
    ownMetricValue(renderState, 'surfaceDrawVisibleGpuConsumerInputKind'),
    ownMetricValue(surfaceDraw, 'surfaceDrawVisibleGpuConsumerInputKind'),
    ownMetricValue(surfaceDraw, 'visibleGpuConsumerInputKind')
  );
  const surfaceDrawVisibleGpuConsumerRuntimeReady = Boolean(firstDefinedMetricValue(
    ownMetricValue(renderState, 'surfaceDrawVisibleGpuConsumerRuntimeReady'),
    ownMetricValue(surfaceDraw, 'surfaceDrawVisibleGpuConsumerRuntimeReady'),
    ownMetricValue(surfaceDraw, 'visibleGpuConsumerRuntimeReady')
  ));
  const surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportSelected = firstDefinedMetricValue(
    ownMetricValue(renderState, 'surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportSelected'),
    ownMetricValue(surfaceDraw, 'surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportSelected'),
    ownMetricValue(surfaceDraw, 'visibleGpuConsumerSameDeviceMainThreadImportSelected')
  );
  const surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportRoute = firstDefinedMetricValue(
    ownMetricValue(renderState, 'surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportRoute'),
    ownMetricValue(surfaceDraw, 'surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportRoute'),
    ownMetricValue(surfaceDraw, 'visibleGpuConsumerSameDeviceMainThreadImportRoute')
  );
  const surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportThread = firstDefinedMetricValue(
    ownMetricValue(renderState, 'surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportThread'),
    ownMetricValue(surfaceDraw, 'surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportThread'),
    ownMetricValue(surfaceDraw, 'visibleGpuConsumerSameDeviceMainThreadImportThread')
  );
  const surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportDeviceScope = firstDefinedMetricValue(
    ownMetricValue(renderState, 'surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportDeviceScope'),
    ownMetricValue(surfaceDraw, 'surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportDeviceScope'),
    ownMetricValue(surfaceDraw, 'visibleGpuConsumerSameDeviceMainThreadImportDeviceScope')
  );
  const surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportStatus = firstDefinedMetricValue(
    ownMetricValue(renderState, 'surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportStatus'),
    ownMetricValue(surfaceDraw, 'surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportStatus'),
    ownMetricValue(surfaceDraw, 'visibleGpuConsumerSameDeviceMainThreadImportStatus')
  );
  const surfaceDrawVisibleGpuConsumerPixelValidationStatus = firstDefinedMetricValue(
    ownMetricValue(renderState, 'surfaceDrawVisibleGpuConsumerPixelValidationStatus'),
    ownMetricValue(surfaceDraw, 'surfaceDrawVisibleGpuConsumerPixelValidationStatus'),
    ownMetricValue(surfaceDraw, 'visibleGpuConsumerPixelValidationStatus')
  );
  const surfaceDrawVisibleGpuConsumerValidated = firstDefinedMetricValue(
    ownMetricValue(renderState, 'surfaceDrawVisibleGpuConsumerValidated'),
    ownMetricValue(surfaceDraw, 'surfaceDrawVisibleGpuConsumerValidated'),
    ownMetricValue(surfaceDraw, 'visibleGpuConsumerValidated')
  );
  const surfaceDrawVisibleGpuConsumerNativeReadbackFallbackValidated = firstDefinedMetricValue(
    ownMetricValue(renderState, 'surfaceDrawVisibleGpuConsumerNativeReadbackFallbackValidated'),
    ownMetricValue(surfaceDraw, 'surfaceDrawVisibleGpuConsumerNativeReadbackFallbackValidated'),
    ownMetricValue(surfaceDraw, 'visibleGpuConsumerNativeReadbackFallbackValidated')
  );
  const surfaceDrawVisibleGpuConsumerNativeReadbackSmokeValidationStatus = firstDefinedMetricValue(
    ownMetricValue(renderState, 'surfaceDrawVisibleGpuConsumerNativeReadbackSmokeValidationStatus'),
    ownMetricValue(surfaceDraw, 'surfaceDrawVisibleGpuConsumerNativeReadbackSmokeValidationStatus'),
    ownMetricValue(surfaceDraw, 'visibleGpuConsumerNativeReadbackSmokeValidationStatus')
  );
  const surfaceDrawVisibleGpuConsumerNativeOffscreenValidationStatus = firstDefinedMetricValue(
    ownMetricValue(renderState, 'surfaceDrawVisibleGpuConsumerNativeOffscreenValidationStatus'),
    ownMetricValue(surfaceDraw, 'surfaceDrawVisibleGpuConsumerNativeOffscreenValidationStatus'),
    ownMetricValue(surfaceDraw, 'visibleGpuConsumerNativeOffscreenValidationStatus')
  );
  const surfaceDrawVisibleGpuConsumerNativeDeviceMapSmokeStatus = firstDefinedMetricValue(
    ownMetricValue(renderState, 'surfaceDrawVisibleGpuConsumerNativeDeviceMapSmokeStatus'),
    ownMetricValue(surfaceDraw, 'surfaceDrawVisibleGpuConsumerNativeDeviceMapSmokeStatus'),
    ownMetricValue(surfaceDraw, 'visibleGpuConsumerNativeDeviceMapSmokeStatus')
  );
  const surfaceDrawVisibleGpuConsumerNativeValidationBlockerFamily = firstDefinedMetricValue(
    ownMetricValue(renderState, 'surfaceDrawVisibleGpuConsumerNativeValidationBlockerFamily'),
    ownMetricValue(surfaceDraw, 'surfaceDrawVisibleGpuConsumerNativeValidationBlockerFamily'),
    ownMetricValue(surfaceDraw, 'visibleGpuConsumerNativeValidationBlockerFamily')
  );
  const surfaceDrawVisibleGpuConsumerNativeTextureReadbackUnavailable = firstDefinedMetricValue(
    ownMetricValue(renderState, 'surfaceDrawVisibleGpuConsumerNativeTextureReadbackUnavailable'),
    ownMetricValue(surfaceDraw, 'surfaceDrawVisibleGpuConsumerNativeTextureReadbackUnavailable'),
    ownMetricValue(surfaceDraw, 'visibleGpuConsumerNativeTextureReadbackUnavailable')
  );
  const surfaceDrawRenderBridgeFrameCount = numberOrNull(
    renderState?.surfaceDrawRenderBridgeFrameCount
      ?? surfaceDraw?.renderBridgeFrameCount
      ?? surfaceDraw?.surfaceDrawRenderBridgeFrameCount
  );
  const surfaceDrawRenderBridgeLastRenderStatus =
    renderState?.surfaceDrawRenderBridgeLastRenderStatus
    ?? surfaceDraw?.renderBridgeLastRenderStatus
    ?? surfaceDraw?.surfaceDrawRenderBridgeLastRenderStatus
    ?? null;
  const surfaceDrawRenderBridgeReadbackSmokeValidationStatus =
    renderState?.surfaceDrawRenderBridgeReadbackSmokeValidationStatus
    ?? surfaceDraw?.renderBridgeReadbackSmokeValidationStatus
    ?? surfaceDraw?.surfaceDrawRenderBridgeReadbackSmokeValidationStatus
    ?? null;
  const surfaceDrawRenderBridgeOffscreenValidationStatus =
    renderState?.surfaceDrawRenderBridgeOffscreenValidationStatus
    ?? surfaceDraw?.renderBridgeOffscreenValidationStatus
    ?? surfaceDraw?.surfaceDrawRenderBridgeOffscreenValidationStatus
    ?? null;
  const surfaceDrawRenderBridgeNativeSurfaceValidationCadenceStatus =
    renderState?.surfaceDrawRenderBridgeNativeSurfaceValidationCadenceStatus
    ?? surfaceDraw?.renderBridgeNativeSurfaceValidationCadenceStatus
    ?? surfaceDraw?.surfaceDrawRenderBridgeNativeSurfaceValidationCadenceStatus
    ?? null;
  const surfaceDrawRenderBridgeNativeSurfaceValidationEncoderRequired =
    renderState?.surfaceDrawRenderBridgeNativeSurfaceValidationEncoderRequired
    ?? surfaceDraw?.renderBridgeNativeSurfaceValidationEncoderRequired
    ?? surfaceDraw?.surfaceDrawRenderBridgeNativeSurfaceValidationEncoderRequired
    ?? null;
  const surfaceDrawRenderBridgeNativeSurfaceValidationScope =
    renderState?.surfaceDrawRenderBridgeNativeSurfaceValidationScope
    ?? surfaceDraw?.renderBridgeNativeSurfaceValidationScope
    ?? surfaceDraw?.surfaceDrawRenderBridgeNativeSurfaceValidationScope
    ?? null;
  const surfaceDrawRenderBridgeNativeSurfaceReadbackSmokeValidationNeeded =
    renderState?.surfaceDrawRenderBridgeNativeSurfaceReadbackSmokeValidationNeeded
    ?? surfaceDraw?.renderBridgeNativeSurfaceReadbackSmokeValidationNeeded
    ?? surfaceDraw?.surfaceDrawRenderBridgeNativeSurfaceReadbackSmokeValidationNeeded
    ?? null;
  const surfaceDrawRenderBridgeNativeSurfaceOffscreenValidationEligible =
    renderState?.surfaceDrawRenderBridgeNativeSurfaceOffscreenValidationEligible
    ?? surfaceDraw?.renderBridgeNativeSurfaceOffscreenValidationEligible
    ?? surfaceDraw?.surfaceDrawRenderBridgeNativeSurfaceOffscreenValidationEligible
    ?? null;
  const surfaceDrawRenderBridgeNativeSurfaceOffscreenValidationNeeded =
    renderState?.surfaceDrawRenderBridgeNativeSurfaceOffscreenValidationNeeded
    ?? surfaceDraw?.renderBridgeNativeSurfaceOffscreenValidationNeeded
    ?? surfaceDraw?.surfaceDrawRenderBridgeNativeSurfaceOffscreenValidationNeeded
    ?? null;
  const surfaceDrawRenderBridgeNativeSurfaceOffscreenValidationSkippedReason =
    renderState?.surfaceDrawRenderBridgeNativeSurfaceOffscreenValidationSkippedReason
    ?? surfaceDraw?.renderBridgeNativeSurfaceOffscreenValidationSkippedReason
    ?? surfaceDraw?.surfaceDrawRenderBridgeNativeSurfaceOffscreenValidationSkippedReason
    ?? null;
  const surfaceDrawRenderBridgeLastRenderSkipReason =
    renderState?.surfaceDrawRenderBridgeLastRenderSkipReason
    ?? surfaceDraw?.renderBridgeLastRenderSkipReason
    ?? surfaceDraw?.surfaceDrawRenderBridgeLastRenderSkipReason
    ?? null;
  const surfaceDrawRenderBridgeReused =
    renderState?.surfaceDrawRenderBridgeReused
    ?? surfaceDraw?.renderBridgeReused
    ?? surfaceDraw?.surfaceDrawRenderBridgeReused
    ?? null;
  const surfaceDrawRenderBridgeUpdateCount = numberOrNull(
    renderState?.surfaceDrawRenderBridgeUpdateCount
      ?? surfaceDraw?.renderBridgeUpdateCount
      ?? surfaceDraw?.surfaceDrawRenderBridgeUpdateCount
  );
  const surfaceDrawRenderBridgeNativeSurfaceReuseStatus =
    renderState?.surfaceDrawRenderBridgeNativeSurfaceReuseStatus
    ?? surfaceDraw?.renderBridgeNativeSurfaceReuseStatus
    ?? surfaceDraw?.surfaceDrawRenderBridgeNativeSurfaceReuseStatus
    ?? (surfaceDrawRenderBridgeReused === true && surfaceDrawBridge === 'native-webgpu-surface-consumer'
      ? 'native-webgpu-surface-consumer-bridge-reused'
      : null)
    ?? null;
  const surfaceDrawNativeMarchingCubesExtractionElapsedMs = numberOrNull(
    renderState?.surfaceDrawNativeMarchingCubesExtractionElapsedMs
      ?? surfaceDraw?.nativeMarchingCubesExtractionElapsedMs
      ?? surfaceDraw?.surfaceDrawNativeMarchingCubesExtractionElapsedMs
  );
  const surfaceDrawNativeMarchingCubesExtensionExecutionElapsedMs = numberOrNull(
    renderState?.surfaceDrawNativeMarchingCubesExtensionExecutionElapsedMs
      ?? surfaceDraw?.nativeMarchingCubesExtensionExecutionElapsedMs
      ?? surfaceDraw?.surfaceDrawNativeMarchingCubesExtensionExecutionElapsedMs
  );
  const surfaceDrawNativeMarchingCubesTotalElapsedMs = numberOrNull(
    renderState?.surfaceDrawNativeMarchingCubesTotalElapsedMs
      ?? surfaceDraw?.nativeMarchingCubesTotalElapsedMs
      ?? surfaceDraw?.surfaceDrawNativeMarchingCubesTotalElapsedMs
  );
  const surfaceDrawNativeMarchingCubesAdapterCacheStatus =
    renderState?.surfaceDrawNativeMarchingCubesAdapterCacheStatus
      ?? surfaceDraw?.nativeMarchingCubesAdapterCacheStatus
      ?? surfaceDraw?.surfaceDrawNativeMarchingCubesAdapterCacheStatus
      ?? null;
  const surfaceDrawNativeMarchingCubesAdapterCacheReason =
    renderState?.surfaceDrawNativeMarchingCubesAdapterCacheReason
      ?? surfaceDraw?.nativeMarchingCubesAdapterCacheReason
      ?? surfaceDraw?.surfaceDrawNativeMarchingCubesAdapterCacheReason
      ?? null;
  const surfaceDrawNativeMarchingCubesAdapterCacheHit =
    renderState?.surfaceDrawNativeMarchingCubesAdapterCacheHit
      ?? surfaceDraw?.nativeMarchingCubesAdapterCacheHit
      ?? surfaceDraw?.surfaceDrawNativeMarchingCubesAdapterCacheHit
      ?? null;
  const surfaceDrawNativeMarchingCubesAdapterCacheEntryCount = numberOrNull(
    renderState?.surfaceDrawNativeMarchingCubesAdapterCacheEntryCount
      ?? surfaceDraw?.nativeMarchingCubesAdapterCacheEntryCount
      ?? surfaceDraw?.surfaceDrawNativeMarchingCubesAdapterCacheEntryCount
  );
  const surfaceDrawNativeMarchingCubesAdapterCacheHitCount = numberOrNull(
    renderState?.surfaceDrawNativeMarchingCubesAdapterCacheHitCount
      ?? surfaceDraw?.nativeMarchingCubesAdapterCacheHitCount
      ?? surfaceDraw?.surfaceDrawNativeMarchingCubesAdapterCacheHitCount
  );
  const surfaceDrawNativeMarchingCubesAdapterCacheMissCount = numberOrNull(
    renderState?.surfaceDrawNativeMarchingCubesAdapterCacheMissCount
      ?? surfaceDraw?.nativeMarchingCubesAdapterCacheMissCount
      ?? surfaceDraw?.surfaceDrawNativeMarchingCubesAdapterCacheMissCount
  );
  const surfaceDrawNativeMarchingCubesAdapterCacheReleaseCount = numberOrNull(
    renderState?.surfaceDrawNativeMarchingCubesAdapterCacheReleaseCount
      ?? surfaceDraw?.nativeMarchingCubesAdapterCacheReleaseCount
      ?? surfaceDraw?.surfaceDrawNativeMarchingCubesAdapterCacheReleaseCount
  );
  const surfaceDrawExtensionSurfaceTranslationElapsedMs = numberOrNull(
    renderState?.surfaceDrawExtensionSurfaceTranslationElapsedMs
      ?? surfaceDraw?.extensionSurfaceTranslationElapsedMs
      ?? surfaceDraw?.surfaceDrawExtensionSurfaceTranslationElapsedMs
  );
  const surfaceDrawExtensionSurfaceTranslationPipelineCacheStatus =
    renderState?.surfaceDrawExtensionSurfaceTranslationPipelineCacheStatus
      ?? surfaceDraw?.extensionSurfaceTranslationPipelineCacheStatus
      ?? surfaceDraw?.surfaceDrawExtensionSurfaceTranslationPipelineCacheStatus
      ?? null;
  const surfaceDrawExtensionSurfaceVertexRowsBufferClearStatus =
    renderState?.surfaceDrawExtensionSurfaceVertexRowsBufferClearStatus
      ?? surfaceDraw?.extensionSurfaceVertexRowsBufferClearStatus
      ?? surfaceDraw?.surfaceDrawExtensionSurfaceVertexRowsBufferClearStatus
      ?? null;
  const surfaceDrawExtensionSurfaceRenderBridgeBuildElapsedMs = numberOrNull(
    renderState?.surfaceDrawExtensionSurfaceRenderBridgeBuildElapsedMs
      ?? surfaceDraw?.extensionSurfaceRenderBridgeBuildElapsedMs
      ?? surfaceDraw?.surfaceDrawExtensionSurfaceRenderBridgeBuildElapsedMs
  );
  const surfaceDrawExtensionSurfaceRefreshElapsedMs = numberOrNull(
    renderState?.surfaceDrawExtensionSurfaceRefreshElapsedMs
      ?? surfaceDraw?.extensionSurfaceRefreshElapsedMs
      ?? surfaceDraw?.surfaceDrawExtensionSurfaceRefreshElapsedMs
  );
  const surfaceDrawRequestedDiagnosticMode = renderState?.surfaceDrawRequestedDiagnosticMode
    ?? surfaceDraw?.requestedDiagnosticMode
    ?? null;
  const surfaceDrawDiagnosticFallbackReason = renderState?.surfaceDrawDiagnosticFallbackReason
    ?? surfaceDraw?.diagnosticFallbackReason
    ?? null;
  const surfaceDrawNativeMarchingCubesSurfaceTableBudgetStatus =
    renderState?.surfaceDrawNativeMarchingCubesSurfaceTableBudgetStatus
      ?? surfaceDraw?.surfaceDrawNativeMarchingCubesSurfaceTableBudgetStatus
      ?? null;
  const surfaceDrawNativeMarchingCubesSurfaceTableMaxResolution = numberOrNull(
    renderState?.surfaceDrawNativeMarchingCubesSurfaceTableMaxResolution
      ?? surfaceDraw?.surfaceDrawNativeMarchingCubesSurfaceTableMaxResolution
  );
  const surfaceDrawNativeMarchingCubesMaxVertexRowsBufferByteLength = numberOrNull(
    renderState?.surfaceDrawNativeMarchingCubesMaxVertexRowsBufferByteLength
      ?? surfaceDraw?.surfaceDrawNativeMarchingCubesMaxVertexRowsBufferByteLength
  );
  const surfaceDrawNativeMarchingCubesEstimatedMaxVertexRowsBufferByteLength = numberOrNull(
    renderState?.surfaceDrawNativeMarchingCubesEstimatedMaxVertexRowsBufferByteLength
      ?? surfaceDraw?.surfaceDrawNativeMarchingCubesEstimatedMaxVertexRowsBufferByteLength
  );
  const renderRowsReadbackByteLength = numberOrNull(renderState?.renderRowsReadbackByteLength);
  const renderRowsReadbackWorkerOwnedResidentParticleStateProducerReadbackFree =
    renderState?.renderRowsReadbackWorkerOwnedResidentParticleStateProducerReadbackFree
    ?? (
      (
        workerOffscreenRenderRowsProducerSourceKind === 'worker-resident-particle-state'
        || workerOffscreenRenderRowsProducerSourceKind === 'worker-retained-resident-stage-output'
      )
      && renderRowsReadbackByteLength === 0
      ? true
      : null
    );
  const presentationWorkerRetainedOutputPresentationOnlyReadbackFree =
    renderState?.presentationWorkerRetainedOutputPresentationOnlyReadbackFree
    ?? (
      workerOffscreenRenderRowsSkippedLegacyDrawForRetainedStageOutput === true
      && renderRowsReadbackByteLength === 0
        ? true
        : null
    );
  const surfaceDrawSummaryReadbackByteLength = numberOrNull(
    renderState?.surfaceDrawSummaryReadbackByteLength ?? surfaceDraw?.surfaceDrawSummaryReadbackByteLength
  );
  const surfaceDrawRowsBufferByteLength = numberOrNull(
    renderState?.surfaceDrawRowsBufferByteLength ?? surfaceDraw?.drawRowsBufferByteLength
  );
  const surfaceDrawIndirectRowsBufferByteLength = numberOrNull(
    renderState?.surfaceDrawIndirectRowsBufferByteLength ?? surfaceDraw?.drawIndirectRowsBufferByteLength
  );
  const surfaceDrawCompactedVertexRowsBufferByteLength = numberOrNull(
    renderState?.surfaceDrawCompactedVertexRowsBufferByteLength ?? surfaceDraw?.compactedVertexRowsBufferByteLength
  );
  const surfaceDrawCompactPositionRowsBufferByteLength = numberOrNull(
    renderState?.surfaceDrawCompactPositionRowsBufferByteLength ?? surfaceDraw?.compactPositionRowsBufferByteLength
  );
  const surfaceDrawRenderBridgeExternalGpuBufferInputLayout =
    renderState?.surfaceDrawRenderBridgeExternalGpuBufferInputLayout
      ?? surfaceDraw?.renderBridgeExternalGpuBufferInputLayout
      ?? null;
  const surfaceDrawCompactPositionRowsStrideFloats = numberOrNull(
    renderState?.surfaceDrawCompactPositionRowsStrideFloats
      ?? surfaceDraw?.compactPositionRowsStrideFloats
      ?? (surfaceDrawRenderBridgeExternalGpuBufferInputLayout === 'webgpu-marching-cubes-compact-position-rows' ? 4 : null)
  );
  const surfaceDrawCompactPositionRowsVertexCountDirect = numberOrNull(
    renderState?.surfaceDrawCompactPositionRowsVertexCount ?? surfaceDraw?.compactPositionRowsVertexCount
  );
  const surfaceDrawCompactPositionRowsVertexCount = surfaceDrawCompactPositionRowsVertexCountDirect
    ?? (
      Number(surfaceDrawCompactPositionRowsBufferByteLength ?? 0) > 0
      && Number(surfaceDrawCompactPositionRowsStrideFloats ?? 0) > 0
        ? Math.floor(
            Number(surfaceDrawCompactPositionRowsBufferByteLength)
            / (Number(surfaceDrawCompactPositionRowsStrideFloats) * Float32Array.BYTES_PER_ELEMENT)
          )
        : null
  );
  const surfaceDrawDirectCompactPositionDraw =
    renderState?.surfaceDrawDirectCompactPositionDraw ?? surfaceDraw?.directCompactPositionDraw ?? null;
  const surfaceDrawRenderBridgeCompactPositionDirectInput =
    renderState?.surfaceDrawRenderBridgeCompactPositionDirectInput
      ?? surfaceDraw?.renderBridgeCompactPositionDirectInput
      ?? null;
  const surfaceDrawRenderFieldRowsBufferByteLength = numberOrNull(
    renderState?.surfaceDrawRenderFieldRowsBufferByteLength ?? surfaceDraw?.renderFieldRowsBufferByteLength
  );
  const surfaceDrawRenderFieldRowsBufferBorrowed =
    renderState?.surfaceDrawRenderFieldRowsBufferBorrowed
      ?? surfaceDraw?.renderFieldRowsBufferBorrowed
      ?? null;
  const surfaceDrawRenderFieldRowsBufferReused =
    renderState?.surfaceDrawRenderFieldRowsBufferReused
      ?? surfaceDraw?.renderFieldRowsBufferReused
      ?? null;
  const surfaceDrawRenderFieldRowsBufferPoolStatus =
    renderState?.surfaceDrawRenderFieldRowsBufferPoolStatus
      ?? surfaceDraw?.renderFieldRowsBufferPoolStatus
      ?? null;
  const surfaceDrawRenderFieldRowsBufferPoolReason =
    renderState?.surfaceDrawRenderFieldRowsBufferPoolReason
      ?? surfaceDraw?.renderFieldRowsBufferPoolReason
      ?? null;
  const surfaceDrawRenderFieldRowsBufferPoolReused =
    renderState?.surfaceDrawRenderFieldRowsBufferPoolReused
      ?? surfaceDraw?.renderFieldRowsBufferPoolReused
      ?? null;
  const surfaceDrawRenderFieldRowsBufferPoolByteLength = numberOrNull(
    renderState?.surfaceDrawRenderFieldRowsBufferPoolByteLength
      ?? surfaceDraw?.renderFieldRowsBufferPoolByteLength
  );
  const surfaceDrawRenderFieldSurfaceBufferByteLength = numberOrNull(
    renderState?.surfaceDrawRenderFieldSurfaceBufferByteLength ?? surfaceDraw?.renderFieldSurfaceBufferByteLength
  );
  const surfaceDrawThreeGeometryByteLength = numberOrNull(
    renderState?.surfaceDrawRenderBridgeThreeGeometryByteLength
      ?? surfaceDraw?.renderBridgeThreeGeometryByteLength
  );
  const renderRefreshTiming = renderState?.renderRefreshTiming ?? null;
  const renderRefreshStageMs = renderState?.renderRefreshStageMs
    ?? renderRefreshTiming?.stageMs
    ?? null;
  const renderRefreshTotalMs = numberOrNull(
    renderState?.renderRefreshTotalMs ?? renderRefreshTiming?.totalMs
  );
  const renderRefreshDeviceAcquireMs = numberOrNull(
    renderState?.renderRefreshDeviceAcquireMs ?? renderRefreshStageMs?.deviceAcquireMs
  );
  const renderRefreshRenderRowsMs = numberOrNull(
    renderState?.renderRefreshRenderRowsMs ?? renderRefreshStageMs?.renderRowsMs
  );
  const renderRefreshRenderFieldMs = numberOrNull(
    renderState?.renderRefreshRenderFieldMs ?? renderRefreshStageMs?.renderFieldMs
  );
  const renderRefreshRenderFieldSurfaceSummaryMs = numberOrNull(
    renderState?.renderRefreshRenderFieldSurfaceSummaryMs
      ?? renderRefreshStageMs?.renderFieldSurfaceSummaryMs
  );
  const renderRefreshMaterialInterfaceMs = numberOrNull(
    renderState?.renderRefreshMaterialInterfaceMs ?? renderRefreshStageMs?.materialInterfaceMs
  );
  const renderRefreshSurfaceDrawMs = numberOrNull(
    renderState?.renderRefreshSurfaceDrawMs ?? renderRefreshStageMs?.surfaceDrawMs
  );
  const renderRefreshOpticalLookupMs = numberOrNull(
    renderState?.renderRefreshOpticalLookupMs ?? renderRefreshStageMs?.opticalLookupMs
  );
  const renderRefreshPressureInterfaceMs = numberOrNull(
    renderState?.renderRefreshPressureInterfaceMs ?? renderRefreshStageMs?.pressureInterfaceMs
  );
  const renderRefreshWorkerOffscreenRenderRowsMs = numberOrNull(
    renderState?.renderRefreshWorkerOffscreenRenderRowsMs
      ?? renderRefreshStageMs?.workerOffscreenRenderRowsMs
  );
  const renderRefreshRenderStateAssemblyMs = numberOrNull(
    renderState?.renderRefreshRenderStateAssemblyMs
      ?? renderRefreshStageMs?.renderStateAssemblyMs
  );
  const materialInterfaceStatus = firstDefinedMetricValue(
    ownMetricValue(materialInterfaceField, 'status'),
    ownMetricValue(materialRenderState, 'materialInterfaceFieldStatus'),
    ownMetricValue(renderState, 'materialInterfaceFieldStatus')
  );
  const materialInterfaceReason = firstDefinedMetricValue(
    ownMetricValue(materialInterfaceField, 'reason'),
    ownMetricValue(materialRenderState, 'materialInterfaceFieldReason'),
    ownMetricValue(renderState, 'materialInterfaceFieldReason')
  );
  const sourceRenderFieldStatus = firstDefinedMetricValue(
    ownMetricValue(materialInterfaceField, 'sourceRenderFieldStatus'),
    ownMetricValue(materialRenderState, 'sourceRenderFieldStatus'),
    ownMetricValue(renderState, 'sourceRenderFieldStatus')
  );
  const sourceRenderFieldSchema = firstDefinedMetricValue(
    ownMetricValue(materialInterfaceField, 'sourceRenderFieldSchema'),
    ownMetricValue(materialRenderState, 'sourceRenderFieldSchema'),
    ownMetricValue(renderState, 'sourceRenderFieldSchema')
  );
  const sourceRenderFieldReadback = firstDefinedMetricValue(
    ownMetricValue(materialInterfaceField, 'sourceRenderFieldReadback'),
    ownMetricValue(materialRenderState, 'sourceRenderFieldReadback'),
    ownMetricValue(renderState, 'sourceRenderFieldReadback')
  );
  const sourceRenderFieldReadbackMode = firstDefinedMetricValue(
    ownMetricValue(materialInterfaceField, 'sourceRenderFieldReadbackMode'),
    ownMetricValue(materialRenderState, 'sourceRenderFieldReadbackMode'),
    ownMetricValue(renderState, 'sourceRenderFieldReadbackMode')
  );
  const materialInterfaceRefreshStageMs =
    materialInterfaceField?.materialInterfaceRefreshStageMs
    || materialRenderState?.materialInterfaceRefreshStageMs
    || renderState?.materialInterfaceRefreshStageMs
    || null;
  const materialInterfaceSourceField = {
    schema: 'peercompute.ulg.sph-performance-material-interface-source-field.v0',
    status: firstNonNullMetricValue(
      ownMetricValue(materialInterfaceField, 'interfaceSourceFieldStatus'),
      ownMetricValue(materialInterfaceField, 'sourceFieldStatus'),
      ownMetricValue(materialRenderState, 'interfaceSourceFieldStatus'),
      ownMetricValue(renderState, 'interfaceSourceFieldStatus'),
      sourceRenderFieldStatus,
      materialInterfaceStatus
    ),
    materialInterfaceStatus,
    materialInterfaceReason,
    sourceRenderFieldSchema,
    sourceRenderFieldStatus,
    sourceRenderFieldReadback,
    sourceRenderFieldReadbackMode,
    sourceFieldPipelineCacheStatus: firstDefinedMetricValue(
      ownMetricValue(materialInterfaceField, 'sourceFieldPipelineCacheStatus'),
      ownMetricValue(materialRenderState, 'sourceFieldPipelineCacheStatus'),
      ownMetricValue(renderState, 'sourceFieldPipelineCacheStatus')
    ),
    sourceRenderFieldPipelineCacheStatus: firstDefinedMetricValue(
      ownMetricValue(materialInterfaceField, 'sourceRenderFieldPipelineCacheStatus'),
      ownMetricValue(materialRenderState, 'sourceRenderFieldPipelineCacheStatus'),
      ownMetricValue(renderState, 'sourceRenderFieldPipelineCacheStatus')
    ),
    candidatePipelineCacheStatus: firstDefinedMetricValue(
      ownMetricValue(materialInterfaceField, 'candidatePipelineCacheStatus'),
      ownMetricValue(materialRenderState, 'candidatePipelineCacheStatus'),
      ownMetricValue(renderState, 'candidatePipelineCacheStatus')
    ),
    refreshTotalMs: numberOrNull(firstDefinedMetricValue(
      ownMetricValue(materialInterfaceField, 'materialInterfaceRefreshTotalMs'),
      ownMetricValue(materialRenderState, 'materialInterfaceRefreshTotalMs'),
      ownMetricValue(renderState, 'materialInterfaceRefreshTotalMs'),
      ownMetricValue(materialInterfaceRefreshStageMs, 'totalMs')
    )),
    refreshRenderRowsMs: numberOrNull(firstDefinedMetricValue(
      ownMetricValue(materialInterfaceField, 'materialInterfaceRefreshRenderRowsMs'),
      ownMetricValue(materialRenderState, 'materialInterfaceRefreshRenderRowsMs'),
      ownMetricValue(renderState, 'materialInterfaceRefreshRenderRowsMs'),
      ownMetricValue(materialInterfaceRefreshStageMs, 'renderRowsMs')
    )),
    refreshSourceFieldMs: numberOrNull(firstDefinedMetricValue(
      ownMetricValue(materialInterfaceField, 'materialInterfaceRefreshSourceFieldMs'),
      ownMetricValue(materialRenderState, 'materialInterfaceRefreshSourceFieldMs'),
      ownMetricValue(renderState, 'materialInterfaceRefreshSourceFieldMs'),
      ownMetricValue(materialInterfaceRefreshStageMs, 'sourceFieldMs')
    )),
    refreshCandidateFieldMs: numberOrNull(firstDefinedMetricValue(
      ownMetricValue(materialInterfaceField, 'materialInterfaceRefreshCandidateFieldMs'),
      ownMetricValue(materialRenderState, 'materialInterfaceRefreshCandidateFieldMs'),
      ownMetricValue(renderState, 'materialInterfaceRefreshCandidateFieldMs'),
      ownMetricValue(materialInterfaceRefreshStageMs, 'candidateFieldMs')
    )),
    sourceFieldSchema: firstDefinedMetricValue(
      ownMetricValue(materialInterfaceField, 'interfaceSourceFieldSchema'),
      ownMetricValue(materialInterfaceField, 'sourceFieldSchema'),
      ownMetricValue(materialRenderState, 'interfaceSourceFieldSchema'),
      ownMetricValue(renderState, 'interfaceSourceFieldSchema')
    ),
    backend: firstDefinedMetricValue(
      ownMetricValue(materialInterfaceField, 'interfaceSourceFieldBackend'),
      ownMetricValue(materialInterfaceField, 'sourceFieldBackend'),
      ownMetricValue(materialRenderState, 'interfaceSourceFieldBackend'),
      ownMetricValue(renderState, 'interfaceSourceFieldBackend')
    ),
    kernelScope: firstDefinedMetricValue(
      ownMetricValue(materialInterfaceField, 'interfaceSourceFieldKernelScope'),
      ownMetricValue(materialRenderState, 'interfaceSourceFieldKernelScope'),
      ownMetricValue(renderState, 'interfaceSourceFieldKernelScope')
    ),
    sourceLocal: firstDefinedMetricValue(
      ownMetricValue(materialInterfaceField, 'interfaceSourceFieldSourceLocal'),
      ownMetricValue(materialRenderState, 'interfaceSourceFieldSourceLocal'),
      ownMetricValue(renderState, 'interfaceSourceFieldSourceLocal')
    ),
    sourceCount: numberOrNull(firstDefinedMetricValue(
      ownMetricValue(materialInterfaceField, 'interfaceSourceFieldSourceLocalSourceCount'),
      ownMetricValue(materialRenderState, 'interfaceSourceFieldSourceLocalSourceCount'),
      ownMetricValue(renderState, 'interfaceSourceFieldSourceLocalSourceCount')
    )),
    estimatedCellVisits: numberOrNull(firstDefinedMetricValue(
      ownMetricValue(materialInterfaceField, 'interfaceSourceFieldSourceLocalEstimatedCellVisits'),
      ownMetricValue(materialRenderState, 'interfaceSourceFieldSourceLocalEstimatedCellVisits'),
      ownMetricValue(renderState, 'interfaceSourceFieldSourceLocalEstimatedCellVisits')
    )),
    denseCellParticlePairs: numberOrNull(firstDefinedMetricValue(
      ownMetricValue(materialInterfaceField, 'interfaceSourceFieldDenseCellParticlePairs'),
      ownMetricValue(materialRenderState, 'interfaceSourceFieldDenseCellParticlePairs'),
      ownMetricValue(renderState, 'interfaceSourceFieldDenseCellParticlePairs')
    )),
    estimatedVisitRatio: numberOrNull(firstDefinedMetricValue(
      ownMetricValue(materialInterfaceField, 'interfaceSourceFieldSourceLocalEstimatedVisitRatio'),
      ownMetricValue(materialRenderState, 'interfaceSourceFieldSourceLocalEstimatedVisitRatio'),
      ownMetricValue(renderState, 'interfaceSourceFieldSourceLocalEstimatedVisitRatio')
    )),
    densityScale: numberOrNull(firstDefinedMetricValue(
      ownMetricValue(materialInterfaceField, 'interfaceSourceFieldSourceLocalDensityScale'),
      ownMetricValue(materialRenderState, 'interfaceSourceFieldSourceLocalDensityScale'),
      ownMetricValue(renderState, 'interfaceSourceFieldSourceLocalDensityScale')
    )),
    queueCompletionStatus: firstDefinedMetricValue(
      ownMetricValue(materialInterfaceField, 'interfaceSourceFieldQueueCompletionStatus'),
      ownMetricValue(materialRenderState, 'interfaceSourceFieldQueueCompletionStatus'),
      ownMetricValue(renderState, 'interfaceSourceFieldQueueCompletionStatus')
    ),
    queueCompletionMethod: firstDefinedMetricValue(
      ownMetricValue(materialInterfaceField, 'interfaceSourceFieldQueueCompletionMethod'),
      ownMetricValue(materialRenderState, 'interfaceSourceFieldQueueCompletionMethod'),
      ownMetricValue(renderState, 'interfaceSourceFieldQueueCompletionMethod')
    ),
    rowsBufferBorrowed: firstDefinedMetricValue(
      ownMetricValue(materialInterfaceField, 'interfaceSourceFieldRowsBufferBorrowed'),
      ownMetricValue(materialRenderState, 'interfaceSourceFieldRowsBufferBorrowed'),
      ownMetricValue(renderState, 'interfaceSourceFieldRowsBufferBorrowed')
    ),
    rowsBufferReused: firstDefinedMetricValue(
      ownMetricValue(materialInterfaceField, 'interfaceSourceFieldRowsBufferReused'),
      ownMetricValue(materialRenderState, 'interfaceSourceFieldRowsBufferReused'),
      ownMetricValue(renderState, 'interfaceSourceFieldRowsBufferReused')
    ),
    renderFieldReadback: firstDefinedMetricValue(
      ownMetricValue(materialInterfaceField, 'renderFieldReadback'),
      ownMetricValue(materialRenderState, 'renderFieldReadback'),
      ownMetricValue(renderState, 'renderFieldReadback')
    ),
    renderRowsReadback: firstDefinedMetricValue(
      ownMetricValue(materialInterfaceField, 'renderRowsReadback'),
      ownMetricValue(materialRenderState, 'renderRowsReadback'),
      ownMetricValue(renderState, 'renderRowsReadback')
    ),
    candidateReadbackMode: firstDefinedMetricValue(
      ownMetricValue(materialInterfaceField, 'candidateReadbackMode'),
      ownMetricValue(materialRenderState, 'candidateReadbackMode'),
      ownMetricValue(renderState, 'candidateReadbackMode')
    )
  };
  const estimatedReadbackBytesPerBatch = sumKnownNumbers([
    renderRowsReadbackByteLength,
    surfaceDrawSummaryReadbackByteLength
  ]);
  const estimatedReadbackBytesPerStep = estimatedReadbackBytesPerBatch !== null && completedStepCount > 0
    ? estimatedReadbackBytesPerBatch / completedStepCount
    : null;
  const validResidentRenderRowBridge = (
    (surfaceDrawStatus === 'resident-render-row-points-built' && surfaceDrawBridge === 'three-render-row-points')
    || (surfaceDrawStatus === 'resident-render-row-spheres-built' && surfaceDrawBridge === 'three-render-row-spheres')
    || (
      surfaceDrawStatus === 'resident-render-row-webgpu-points-built'
      && surfaceDrawBridge === 'webgpu-render-row-points'
    )
    || (
      surfaceDrawStatus === 'resident-render-row-webgpu-spheres-built'
      && surfaceDrawBridge === 'webgpu-render-row-spheres'
    )
    || (
      surfaceDrawDiagnosticFallbackReason === 'webgpu-render-row-overlay-disabled-pending-pixel-validation'
      && surfaceDrawRequestedDiagnosticMode === 'webgpu-render-row-points'
      && surfaceDrawStatus === 'resident-render-row-points-built'
      && surfaceDrawBridge === 'three-render-row-points'
    )
    || (
      surfaceDrawDiagnosticFallbackReason === 'webgpu-render-row-overlay-disabled-pending-pixel-validation'
      && surfaceDrawRequestedDiagnosticMode === 'webgpu-render-row-spheres'
      && surfaceDrawStatus === 'resident-render-row-spheres-built'
      && surfaceDrawBridge === 'three-render-row-spheres'
    )
  );
  const validResidentSurfaceBufferHandoff = (
    surfaceDrawGpuBufferHandoffReady
    && surfaceDrawStatus !== 'resident-render-row-three-bridge-retained-no-full-readback'
    && (
      (
        surfaceDrawGpuBufferHandoffKind === 'surface-draw-buffers'
        && (
          Number(surfaceDrawCompactedVertexRowsBufferByteLength ?? 0) > 0
          || Number(surfaceDrawCompactPositionRowsBufferByteLength ?? 0) > 0
        )
        && Number(surfaceDrawIndirectRowsBufferByteLength ?? 0) > 0
        && Number(surfaceDrawGpuBufferHandoffUpperBoundVertexCount ?? 0) >= 3
      )
      || (
        surfaceDrawGpuBufferHandoffKind === 'render-field-buffers'
        && Number(surfaceDrawRenderFieldRowsBufferByteLength ?? 0) > 0
        && Number(surfaceDrawRenderFieldSurfaceBufferByteLength ?? 0) > 0
      )
    )
  );
  const validWorkerOwnedResidentParticleStateProducer = Boolean(
    workerOffscreenRenderRowsStatus === 'worker-offscreen-resident-particle-state-producer-rendered'
    && workerOffscreenRenderRowsDisplayHandoff === 'transferControlToOffscreen'
    && workerOffscreenRenderRowsFrameCopyBackRejected === true
    && workerOffscreenRenderRowsWorkerReady === true
    && workerOffscreenRenderRowsContextStatus === 'webgpu-context-ready'
    && Number(workerOffscreenRenderRowsParticleCount ?? 0) > 0
    && Number(workerOffscreenRenderRowsReadyFrameCount ?? 0) > 0
  );
  const activeGridDispatch = residentStageTiming?.activeGridDispatch ?? null;
  const activeGridNodeCountFromDiagnostics = numberOrNull(residentDiagnostics?.activeGridNodeCount);
  const activeGridNodeCount = activeGridNodeCountFromDiagnostics
    ?? numberOrNull(activeGridDispatch?.activeNodeCount)
    ?? numberOrNull(dispatchTopology?.activeGridNodeCount)
    ?? numberOrNull(dispatchTopology?.activeGridIndirectDispatch?.activeGridNodeCount);
  const gridNodeCount = numberOrNull(residentDiagnostics?.gridNodeCount)
    ?? numberOrNull(activeGridDispatch?.fullGridNodeCount)
    ?? numberOrNull(dispatchTopology?.fullGridNodeCount)
    ?? numberOrNull(dispatchTopology?.activeGridIndirectDispatch?.fullGridNodeCount);
  const activeGridNodeCountAvailable = activeGridNodeCount !== null
    ? true
    : (residentDiagnostics?.activeGridNodeCountAvailable ?? null);
  const activeGridNodeCountSource = activeGridNodeCountFromDiagnostics !== null
    ? 'resident-diagnostics'
    : (numberOrNull(activeGridDispatch?.activeNodeCount) !== null
        ? 'active-grid-dispatch'
        : (numberOrNull(dispatchTopology?.activeGridNodeCount) !== null
            ? 'dispatch-topology'
            : (numberOrNull(dispatchTopology?.activeGridIndirectDispatch?.activeGridNodeCount) !== null
                ? 'active-grid-indirect-dispatch'
                : null)));
  const activeGridRatio = numberOrNull(activeGridDispatch?.activeGridRatio)
    ?? (activeGridNodeCount !== null && gridNodeCount !== null && gridNodeCount > 0
      ? activeGridNodeCount / gridNodeCount
      : null);
  const fusedResidentSequencePreflightBlockers = Array.isArray(fusedResidentSequencePreflight?.blockers)
    ? fusedResidentSequencePreflight.blockers
    : [];
  const fusedResidentSequencePreflightSidecarBlockers = Array.isArray(fusedResidentSequencePreflight?.sidecarBlockers)
    ? fusedResidentSequencePreflight.sidecarBlockers
    : [];
  const fusedResidentSequenceSidecarFusionPlan = fusedResidentSequencePreflight?.sidecarFusionPlan || null;
  const fusedResidentSequenceSidecarFusionStepEvidence = residentStageTiming?.sidecarFusionStepEvidence || null;
  const fusedResidentSequenceBlockedForSidecars = Boolean(
    fusedResidentSequencePreflight?.status === 'blocked-fused-resident-sequence'
    && fusedResidentSequencePreflightSidecarBlockers.length > 0
    && fusedResidentSequencePreflightBlockers.length === fusedResidentSequencePreflightSidecarBlockers.length
    && fusedResidentSequencePreflightBlockers.every(
      (blocker) => fusedResidentSequencePreflightSidecarBlockers.includes(blocker)
    )
    && (
      fusedResidentSequencePreflight?.fallbackMode === 'per-step-resident-pass-dag'
      || fusedResidentSequencePreflight?.fallbackMode === 'per-step-fused-mechanics-active-grid'
    )
  );
  const fusedResidentSequenceRequirementSatisfied = Boolean(
    !fuseResidentMechanicsSequence
    || residentStageTiming?.fusedResidentSequence === true
    || fusedResidentSequenceBlockedForSidecars
  );
  const fusedResidentActiveGridRequirementSatisfied = Boolean(
    !fuseResidentMechanicsActiveGrid
    || activeGridDispatch?.useActiveGrid === true
    || (
      fusedResidentSequenceBlockedForSidecars
      && fusedResidentSequencePreflight?.fallbackMode === 'per-step-fused-mechanics-active-grid'
    )
  );
  const performanceGate = scenarioPerformanceGate({
    residentGpuCompletedStageMs,
    residentStageStepsPerSecond,
    estimatedReadbackBytesPerStep,
    activeGridDispatch,
    residentStageTiming,
    fusedResidentSequenceBlockedForSidecars
  });
  const validDirectResidentLoop = effectiveProbeMode === 'direct-resident'
    && residentSteps?.status === 'resident-steps-executed'
    && residentStep?.status === 'resident-step-webgpu-executed'
    && fusedResidentSequenceRequirementSatisfied
    && fusedResidentActiveGridRequirementSatisfied;
  const benchmarkStatus = exit.code === 0
    && Number(browserConsoleIssueCount ?? 0) === 0
    && Number.isFinite(residentStageMs)
    && (effectiveProbeMode === 'direct-resident'
      ? validDirectResidentLoop
      : (
        validResidentRenderRowBridge
        || validResidentSurfaceBufferHandoff
        || validWorkerOwnedResidentParticleStateProducer
      ))
    ? 'good'
    : (exit.code === 0 ? 'bad' : 'probe-error');
  return {
    schema: 'peercompute.ulg.sph-performance-benchmark-scenario.v0',
    targetParticleCount,
    actualParticleCount: scenario.actualParticleCount,
    latticeEdgePerCohort: scenario.edge,
    effectiveParticleCount: initialParticleEdgeDiagnostics?.totalGeneratedParticleCount ?? null,
    requestedDropParticlesPerEdge: initialParticleEdgeDiagnostics?.requestedDropParticlesPerEdge ?? scenario.edge,
    requestedBaseParticlesPerEdge: initialParticleEdgeDiagnostics?.requestedBaseParticlesPerEdge ?? scenario.edge,
    effectiveDropParticlesPerEdge: initialParticleEdgeDiagnostics?.effectiveDropParticlesPerEdge ?? null,
    effectiveBaseParticlesPerEdge: initialParticleEdgeDiagnostics?.effectiveBaseParticlesPerEdge ?? null,
    initialParticleEdgeStatus: initialParticleEdgeDiagnostics?.status ?? null,
    initialParticleEdgePreservationStatus: initialParticleEdgeDiagnostics?.requestedEdgePreservationStatus ?? null,
    initialParticleEdgePreservedRequestedRole: initialParticleEdgeDiagnostics?.preservedRequestedRole ?? null,
    initialParticleEdgeDiagnostics,
    status: benchmarkStatus,
    probeStatus: result?.status ?? (exit.code === 0 ? 'unknown' : 'probe-error'),
    probeMode: effectiveProbeMode,
    probeIssues: Array.isArray(analysis.issues) ? analysis.issues : [],
    exitCode: exit.code,
    signal: exit.signal,
    scenarioUrl: scenario.url,
    batches,
    batchSteps,
    completedStepCount,
    meanBatchMs,
    maxBatchMs: analysis.maxBatchMs ?? null,
    physicsStepsPerSecond: residentStageStepsPerSecond,
    probeWallStepsPerSecond,
    probeEngineStepsPerSecond,
    probeBatchWallMs,
    probeEngineBatchMs,
    probeWallRefreshHz,
    probeWallTimeAttribution,
    residentStageMs,
    residentGpuQueueFenceMs,
    residentGpuCompletedStageMs,
    residentStageStepsPerSecond,
    performanceGate,
    probeResidentBatchTiming,
    probeResidentBatchResidentStepsAwaitMs,
    probeResidentBatchRenderRefreshAwaitMs,
    probeResidentBatchMaterialInterfaceDiagnosticMs,
    probeResidentBatchViewportRefreshMs,
    probeResidentBatchViewportRafMs,
    probeResidentBatchViewportSignal,
    probeResidentBatchViewportRafSkipped,
    probeResidentBatchViewportWorkerOffscreenStatus,
    probeResidentBatchViewportWorkerOffscreenFrameCount,
    probeResidentBatchViewportWorkerOffscreenReadyFrameCount,
    probeResidentBatchViewportNonRafMs,
    probeResidentBatchNativeSurfaceValidationWaitMs,
    probeResidentBatchTotalBeforeSampleMs,
    residentStageTiming,
    residentStepsTiming,
    residentStepsStageMs,
    residentStepsWallMs,
    residentStepsSurfaceDrawSubmitFenceMs,
    residentStepsDeviceAcquireMs,
    residentStepsSphUploadMs,
    residentStepsMlsUploadMs,
    residentStepsThermalUploadMs,
    residentStepsMechanicsMaterialUploadMs,
    residentStepsPressureRowsMs,
    residentStepsKernelsWallMs,
    residentStepsPostKernelPublicationMs,
    residentStepsArtifactClearMs,
    residentStepsArtifactPublishMs,
    renderRefreshTiming,
    renderRefreshStageMs,
    renderRefreshTotalMs,
    renderRefreshDeviceAcquireMs,
    renderRefreshRenderRowsMs,
    renderRefreshRenderFieldMs,
    renderRefreshRenderFieldSurfaceSummaryMs,
    renderRefreshMaterialInterfaceMs,
    renderRefreshSurfaceDrawMs,
    renderRefreshOpticalLookupMs,
    renderRefreshPressureInterfaceMs,
    renderRefreshWorkerOffscreenRenderRowsMs,
    renderRefreshRenderStateAssemblyMs,
    materialInterfaceSourceField,
    dispatchTopologyStatus: dispatchTopology?.status ?? null,
    dispatchesPerSubstep: dispatchTopology?.dispatchesPerSubstep ?? null,
    totalDispatches: dispatchTopology?.totalDispatches ?? null,
    workgroupsPerSubstep: dispatchTopology?.workgroupsPerSubstep ?? null,
    totalWorkgroups: dispatchTopology?.totalWorkgroups ?? null,
    p2gAccumulatorClear: p2gAccumulatorClearTopology ? {
      stageId: p2gAccumulatorClearTopology.stageId ?? null,
      topology: p2gAccumulatorClearTopology.topology ?? null,
      entryPoint: p2gAccumulatorClearTopology.entryPoint ?? null,
      dispatchAxis: p2gAccumulatorClearTopology.dispatchAxis ?? null,
      dispatchWorkgroupsPerSubstep: p2gAccumulatorClearTopology.dispatchWorkgroupsPerSubstep ?? null,
      invocationLimitPerSubstep: p2gAccumulatorClearTopology.invocationLimitPerSubstep ?? null,
      activeGridEnabled: p2gAccumulatorClearTopology.activeGridEnabled ?? null,
      bufferClearMode: p2gAccumulatorClearTopology.bufferClearMode ?? null
    } : null,
    residentStepsStatus: residentSteps?.status ?? null,
    residentStepStatus: residentStep?.status ?? null,
    mechanicsMaterialPhaseUploadStatus: mechanicsMaterialPhaseUpload?.status ?? null,
    mechanicsMaterialPhaseUploadPhaseRecordCount: mechanicsMaterialPhaseUpload?.phaseRecordCount ?? null,
    mechanicsMaterialPhaseUploadRecordsByteLength: mechanicsMaterialPhaseUpload?.recordsByteLength ?? null,
    fusedResidentMechanics: residentStageTiming?.fusedResidentMechanics ?? null,
    fusedResidentSequence: residentStageTiming?.fusedResidentSequence ?? null,
    fusedResidentSequenceStepCount: residentStageTiming?.fusedResidentSequenceStepCount ?? null,
    fusedResidentSequenceRequested: fuseResidentMechanicsSequence,
    fusedResidentSequencePreflightStatus: fusedResidentSequencePreflight?.status ?? null,
    fusedResidentSequencePreflightFallbackMode: fusedResidentSequencePreflight?.fallbackMode ?? null,
    fusedResidentSequencePreflightBlockers,
    fusedResidentSequencePreflightSidecarBlockers,
    fusedResidentSequenceSidecarFusionRequired: fusedResidentSequencePreflight?.sidecarFusionRequired ?? null,
    fusedResidentSequenceSidecarFusionRunnable: fusedResidentSequencePreflight?.sidecarFusionRunnable ?? null,
    fusedResidentSequenceSidecarFusionPlanStatus: fusedResidentSequencePreflight?.sidecarFusionPlanStatus ?? null,
    fusedResidentSequenceSidecarFusionStageCount: fusedResidentSequencePreflight?.sidecarFusionStageCount ?? null,
    fusedResidentSequenceSidecarFusionRequiredStageOrder:
      [...(fusedResidentSequenceSidecarFusionPlan?.requiredStageOrder || [])],
    fusedResidentSequenceSidecarFusionStepEvidenceStatus:
      fusedResidentSequenceSidecarFusionStepEvidence?.status ?? null,
    fusedResidentSequenceSidecarFusionExecutedStageCount:
      fusedResidentSequenceSidecarFusionStepEvidence?.executedStageCount ?? null,
    fusedResidentSequenceSidecarFusionPassedStageCount:
      fusedResidentSequenceSidecarFusionStepEvidence?.passedStageCount ?? null,
    fusedResidentSequenceSidecarFusionAllRequiredStagesPassed:
      fusedResidentSequenceSidecarFusionStepEvidence?.allRequiredStagesPassed ?? null,
    fusedResidentSequenceSidecarFusionPromotesFusedSequence:
      fusedResidentSequenceSidecarFusionStepEvidence?.promotesFusedSequence ?? null,
    fusedResidentSequenceBlockedForSidecars,
    fusedResidentSequenceRequirementSatisfied,
    fusedResidentActiveGridRequirementSatisfied,
    fusedResidentActiveGridRequested: fuseResidentMechanicsActiveGrid,
    activeGridDispatchPlanRefreshModeRequested: activeGridDispatchPlanRefreshMode,
    activeGridDispatchPlanRefreshMode: residentStageTiming?.activeGridDispatchPlanRefreshMode ?? null,
    activeGridDispatchPlanRefreshRequested: residentStageTiming?.activeGridDispatchPlanRefreshRequested ?? null,
    activeGridDispatchPlanRefreshFinalStep: residentStageTiming?.activeGridDispatchPlanRefreshFinalStep ?? null,
    activeGridDispatchPlanOnlyEligible: residentStageTiming?.activeGridDispatchPlanOnlyEligible ?? null,
    activeGridDispatchPlanOnlyRequested: residentStageTiming?.activeGridDispatchPlanOnlyRequested ?? null,
    activeGridDispatchPlanRefreshSkippedReason: residentStageTiming?.activeGridDispatchPlanRefreshSkippedReason ?? null,
    gridNodeCount,
    activeGridNodeCount,
    activeGridNodeCountAvailable,
    activeGridNodeCountSource,
    activeGridRatio,
    activeGridDispatch,
    visualRefreshHzEstimate: probeWallRefreshHz,
    compactSummaryMeanBatchShare: analysis.compactSummaryMeanBatchShare ?? null,
    browserConsoleIssueCount,
    browserConsoleIssueCounts: analysis.browserConsoleIssueCounts || {},
    browserConsoleWarningCounts: analysis.browserConsoleWarningCounts || {},
    surfaceDrawStatus,
    surfaceDrawBridge,
    surfaceDrawBridgeCapabilityStatus,
    surfaceDrawBridgeCapabilityReason,
    surfaceDrawBridgeRendererBackend,
    surfaceDrawBridgeVisibleNoReadbackSupported,
    surfaceDrawGpuBufferHandoffReady,
    surfaceDrawGpuBufferHandoffStatus,
    surfaceDrawGpuBufferHandoffReason,
    surfaceDrawGpuBufferHandoffKind,
    surfaceDrawGpuBufferHandoffInputSchema,
    surfaceDrawGpuBufferHandoffRequiresSurfaceExtraction,
    surfaceDrawGpuBufferHandoffUpperBoundVertexCount,
    validResidentSurfaceBufferHandoff,
    validWorkerOwnedResidentParticleStateProducer,
    surfaceDrawVisibleGpuConsumerReady,
    surfaceDrawVisibleGpuConsumerStatus,
    surfaceDrawVisibleGpuConsumerReason,
    surfaceDrawVisibleGpuConsumerInputReady,
    surfaceDrawVisibleGpuConsumerInputKind,
    surfaceDrawVisibleGpuConsumerRuntimeReady,
    surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportSelected,
    surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportRoute,
    surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportThread,
    surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportDeviceScope,
    surfaceDrawVisibleGpuConsumerSameDeviceMainThreadImportStatus,
    surfaceDrawVisibleGpuConsumerPixelValidationStatus,
    surfaceDrawVisibleGpuConsumerValidated,
    surfaceDrawVisibleGpuConsumerNativeReadbackFallbackValidated,
    surfaceDrawVisibleGpuConsumerNativeReadbackSmokeValidationStatus,
    surfaceDrawVisibleGpuConsumerNativeOffscreenValidationStatus,
    surfaceDrawVisibleGpuConsumerNativeDeviceMapSmokeStatus,
    surfaceDrawVisibleGpuConsumerNativeValidationBlockerFamily,
    surfaceDrawVisibleGpuConsumerNativeTextureReadbackUnavailable,
    surfaceDrawRenderBridgeFrameCount,
    surfaceDrawRenderBridgeLastRenderStatus,
    surfaceDrawRenderBridgeReadbackSmokeValidationStatus,
    surfaceDrawRenderBridgeOffscreenValidationStatus,
    surfaceDrawRenderBridgeNativeSurfaceValidationCadenceStatus,
    surfaceDrawRenderBridgeNativeSurfaceValidationEncoderRequired,
    surfaceDrawRenderBridgeNativeSurfaceValidationScope,
    surfaceDrawRenderBridgeNativeSurfaceReadbackSmokeValidationNeeded,
    surfaceDrawRenderBridgeNativeSurfaceOffscreenValidationEligible,
    surfaceDrawRenderBridgeNativeSurfaceOffscreenValidationNeeded,
    surfaceDrawRenderBridgeNativeSurfaceOffscreenValidationSkippedReason,
    surfaceDrawRenderBridgeLastRenderSkipReason,
    surfaceDrawRenderBridgeReused,
    surfaceDrawRenderBridgeUpdateCount,
    surfaceDrawRenderBridgeNativeSurfaceReuseStatus,
    surfaceDrawNativeMarchingCubesExtractionElapsedMs,
    surfaceDrawNativeMarchingCubesExtensionExecutionElapsedMs,
    surfaceDrawNativeMarchingCubesTotalElapsedMs,
    surfaceDrawNativeMarchingCubesAdapterCacheStatus,
    surfaceDrawNativeMarchingCubesAdapterCacheReason,
    surfaceDrawNativeMarchingCubesAdapterCacheHit,
    surfaceDrawNativeMarchingCubesAdapterCacheEntryCount,
    surfaceDrawNativeMarchingCubesAdapterCacheHitCount,
    surfaceDrawNativeMarchingCubesAdapterCacheMissCount,
    surfaceDrawNativeMarchingCubesAdapterCacheReleaseCount,
    surfaceDrawExtensionSurfaceTranslationElapsedMs,
    surfaceDrawExtensionSurfaceTranslationPipelineCacheStatus,
    surfaceDrawExtensionSurfaceVertexRowsBufferClearStatus,
    surfaceDrawExtensionSurfaceRenderBridgeBuildElapsedMs,
    surfaceDrawExtensionSurfaceRefreshElapsedMs,
    surfaceDrawRequestedDiagnosticMode,
    surfaceDrawDiagnosticFallbackReason,
    surfaceDrawNativeMarchingCubesSurfaceTableBudgetStatus,
    surfaceDrawNativeMarchingCubesSurfaceTableMaxResolution,
    surfaceDrawNativeMarchingCubesMaxVertexRowsBufferByteLength,
    surfaceDrawNativeMarchingCubesEstimatedMaxVertexRowsBufferByteLength,
    surfaceDrawSource: renderState?.surfaceDrawVisibleRenderSource
      ?? renderState?.surfaceDrawSource
      ?? surfaceDraw?.visibleRenderSource
      ?? surfaceDraw?.source
      ?? null,
    surfaceDrawReadback: renderState?.surfaceDrawReadback ?? surfaceDraw?.surfaceDrawReadback ?? null,
    renderRowsReadback: renderState?.renderRowsReadback ?? null,
    renderRowsReadbackMode: renderState?.renderRowsReadbackMode ?? null,
    renderRowsReadbackCoercionReason: renderState?.renderRowsReadbackCoercionReason ?? null,
    renderRowsReadbackForcedForWorkerOffscreenPresentation:
      renderState?.renderRowsReadbackForcedForWorkerOffscreenPresentation ?? null,
    renderRowsReadbackForcedForWorkerOwnedResidentProducer:
      renderState?.renderRowsReadbackForcedForWorkerOwnedResidentProducer ?? null,
    renderRowsReadbackWorkerOffscreenPresentationRequired:
      renderState?.renderRowsReadbackWorkerOffscreenPresentationRequired ?? null,
    renderRowsReadbackWorkerOwnedResidentProducerRequired:
      renderState?.renderRowsReadbackWorkerOwnedResidentProducerRequired ?? null,
    renderRowsReadbackWorkerOwnedResidentParticleStateProducerReadbackFree:
      renderRowsReadbackWorkerOwnedResidentParticleStateProducerReadbackFree,
    presentationWorkerRetainedOutputPresentationOnlyReadbackFree,
    renderRowsReadbackByteLength,
    surfaceDrawSummaryReadback: renderState?.surfaceDrawSummaryReadback ?? surfaceDraw?.surfaceDrawSummaryReadback ?? null,
    surfaceDrawSummaryReadbackByteLength,
    surfaceDrawRowsBufferByteLength,
    surfaceDrawIndirectRowsBufferByteLength,
    surfaceDrawCompactedVertexRowsBufferByteLength,
    surfaceDrawCompactPositionRowsBufferByteLength,
    surfaceDrawCompactPositionRowsVertexCount,
    surfaceDrawCompactPositionRowsStrideFloats,
    surfaceDrawDirectCompactPositionDraw,
    surfaceDrawRenderBridgeExternalGpuBufferInputLayout,
    surfaceDrawRenderBridgeCompactPositionDirectInput,
    surfaceDrawRenderFieldRowsBufferByteLength,
    surfaceDrawRenderFieldRowsBufferBorrowed,
    surfaceDrawRenderFieldRowsBufferReused,
    surfaceDrawRenderFieldRowsBufferPoolStatus,
    surfaceDrawRenderFieldRowsBufferPoolReason,
    surfaceDrawRenderFieldRowsBufferPoolReused,
    surfaceDrawRenderFieldRowsBufferPoolByteLength,
    surfaceDrawRenderFieldSurfaceBufferByteLength,
	    estimatedReadbackBytesPerBatch,
	    estimatedReadbackBytesPerStep,
	    workerOffscreenFrameTransportBudget: workerOffscreenTransportBudget,
	    workerOffscreenPresentation,
	    workerOffscreenPresentationStatus,
	    workerOffscreenPresentationTransport,
	    workerOffscreenPresentationDisplayHandoff,
	    workerOffscreenPresentationFrameCopyBackRejected,
	    workerOffscreenPresentationCopiedBytesPerFrame,
	    workerOffscreenPresentationCopiedBytesPerSecond,
	    workerOffscreenPresentationCanvasTransferred,
	    workerOffscreenPresentationWorkerReady,
	    workerOffscreenPresentationReadyEver,
	    workerOffscreenPresentationReadyFrameCount,
	    workerOffscreenPresentationContextStatus,
	    peerComputeRenderOwnershipPolicy,
	    peerComputeRenderOwnershipPolicyStatus,
	    peerComputeRenderOwnershipPolicyRequestedMode,
	    peerComputeRenderOwnershipPolicyEffectiveMode,
	    peerComputeRenderOwnershipPolicyInputTransport,
	    peerComputeRenderOwnershipPolicyDisplayTransport,
	    peerComputeRenderOwnershipPolicyConfiguredByPeerCompute,
	    peerComputeRenderOwnershipWorkerOwnedResidentProducerPending,
	    peerComputeRenderOwnershipWorkerOwnedResidentProducerSourceTransferRequired,
    peerComputeRenderOwnershipPresentationWorkerRetainedOutputPresentationOnlyRequested,
    peerComputeRenderOwnershipPresentationWorkerRetainedOutputPresentationOnlyReady,
    peerComputeRenderOwnershipRetainedCompactSnapshotExportRequested,
    peerComputeRenderOwnershipStatePromotionMode,
	    peerComputeRenderOwnershipAuthoritativeStateMutationExpected,
	    peerComputeRenderOwnershipPresentationWorkerResidentStagesRequested,
	    peerComputeRenderOwnershipPresentationWorkerResidentStagesReady,
	    peerComputeRenderOwnershipPresentationWorkerResidentStagesPending,
	    peerComputeRenderOwnershipPresentationWorkerResidentStageTransport,
	    peerComputeRenderOwnershipResidentPlaybackUseCase,
	    peerComputeRenderOwnershipResidentStepsPerScheduleOverride,
	    peerComputeRenderOwnershipResidentStepsPerScheduleMax,
	    peerComputeRenderOwnershipResidentParticleBridgeTargetBatchTimeS,
	    peerComputeRenderOwnershipResidentInterfaceRefreshMode,
	    peerComputeRenderOwnershipResidentComputeManagerMode,
	    peerComputeRenderOwnershipResidentComputeManagerModeExplicit,
	    peerComputeRenderOwnershipTransitionalRenderRowsActive,
	    workerOffscreenRenderRows,
	    workerOffscreenRenderRowsStatus,
	    workerOffscreenRenderRowsInputTransport,
	    workerOffscreenRenderRowsDisplayTransport,
	    workerOffscreenRenderRowsDisplayHandoff,
	    workerOffscreenRenderRowsFrameCopyBackRejected,
	    workerOffscreenRenderRowsCopiedBytesPerFrame,
	    workerOffscreenRenderRowsCopiedBytesPerSecond,
	    workerOffscreenRenderRowsParticleCount,
	    workerOffscreenRenderRowsInputTransferBytes,
	    workerOffscreenRenderRowsParticleBufferByteLength,
	    workerOffscreenRenderRowsWorkerLocalProduced,
	    workerOffscreenRenderRowsProducerSourceKind,
	    workerOffscreenRenderRowsProducerSourceTransport,
	    workerOffscreenRenderRowsSourceStageId,
	    workerOffscreenRenderRowsRetainedParticleStateStatus,
	    workerOffscreenRenderRowsRetainedStageOutputPreserved,
	    workerOffscreenRenderRowsSkippedLegacyDrawForRetainedStageOutput,
	    workerOffscreenRenderRowsSourceTransferBytes,
	    workerOffscreenRenderRowsSourceStateTransferBytes,
	    workerOffscreenRenderRowsSourceCacheKey,
	    workerOffscreenRenderRowsSourceCacheStatus,
	    workerOffscreenRenderRowsSourceCacheKeyStrategy,
	    workerOffscreenRenderRowsSourceCacheMissReason,
	    workerOffscreenRenderRowsSourceCpuStateStale,
	    workerOffscreenRenderRowsSourceCacheHit,
	    workerOffscreenRenderRowsSourceRowsPacked,
	    workerOffscreenRenderRowsCanvasTransferred,
	    workerOffscreenRenderRowsWorkerReady,
	    workerOffscreenRenderRowsReadyEver,
	    workerOffscreenRenderRowsReadyFrameCount,
	    workerOffscreenRenderRowsContextStatus,
	    workerOffscreenRetainedGpuBufferHandoff,
	    workerOffscreenRetainedGpuBufferHandoffStatus,
	    workerOffscreenRetainedGpuBufferHandoffReason,
	    workerOffscreenRetainedGpuBufferHandoffInputTransport,
	    workerOffscreenRetainedGpuBufferHandoffPreferredReplacementTransport,
	    workerOffscreenRetainedGpuBufferHandoffFrameCopyBackRejected,
	    workerOffscreenRetainedGpuBufferHandoffPlanChangeRequired,
	    workerOffscreenRetainedGpuBufferHandoffCrossOriginIsolated,
	    workerOffscreenRetainedGpuBufferHandoffStructuredCloneSupported,
	    workerOffscreenRetainedGpuBufferHandoffProbeStatus,
	    workerOffscreenRetainedGpuBufferHandoffRetainedRenderRowsBufferAvailable,
	    workerOffscreenRetainedGpuBufferHandoffRetainedSurfaceDrawBufferAvailable,
	    workerOffscreenRetainedGpuBufferHandoffSameDeviceOwner,
	    workerOffscreenRetainedGpuBufferHandoffWorkerPresentationDeviceOwner,
	    workerOffscreenRetainedGpuBufferHandoffResidentBufferDeviceOwner,
	    workerOffscreenResidentStage,
	    workerOffscreenResidentStageStatus,
	    workerOffscreenResidentStageInputTransport,
	    workerOffscreenResidentStageStageId,
	    workerOffscreenResidentStageWorkerDeviceSource,
	    workerOffscreenResidentStageWorkerDeviceProvided,
	    workerOffscreenResidentStageRetainedBufferRefCount,
	    workerOffscreenResidentStageGpuFenceSatisfied,
	    workerOffscreenResidentStageGpuFenceStatus,
	    workerOffscreenResidentStageQueueCompletionStatus,
	    workerOffscreenResidentStageQueueCompletionMethod,
	    workerOffscreenResidentStageQueueCompletionFallbackFrom,
	    workerOffscreenResidentStageQueueCompletionErrorMessage,
	    workerOffscreenResidentStageCpuQueueFenceBypassed,
	    workerOffscreenResidentStageSameWorkerGpuHandoff,
	    workerOffscreenResidentStageElapsedMs,
	    workerOffscreenResidentStageTimeoutMs,
	    workerOffscreenResidentStageErrorName,
	    workerOffscreenResidentStageErrorMessage,
		    workerOffscreenResidentStageChain,
		    workerOffscreenResidentStageChainStatus,
		    workerOffscreenResidentStageChainStageCount,
		    workerOffscreenResidentStageChainSameWorkerGpuHandoff,
		    workerOffscreenResidentStageChainAuto,
		    workerOffscreenResidentStageChainAutoStatus,
		    workerOffscreenResidentStageChainAutoRequested,
		    workerOffscreenResidentStageChainAutoPolicyReady,
		    workerOffscreenResidentStageChainAutoPresentationReady,
		    workerOffscreenResidentStageChainAutoSourceSignature,
		    workerOffscreenResidentStageChainAutoSourceMode,
		    workerOffscreenResidentStageChainAutoSourceCpuStateStale,
		    workerOffscreenResidentStageChainAutoLatestResidentOutputCpuStateStale,
		    workerOffscreenResidentStageChainAutoAuthoritativeStateMutation,
		    workerOffscreenResidentStageChainAutoStatePromotionStatus,
		    workerOffscreenResidentStageChainAutoChainStatus,
		    workerOffscreenResidentStageChainAutoSameWorkerGpuHandoff,
		    workerOffscreenRetainedStatePromotionCandidate,
		    workerOffscreenRetainedStatePromotionCandidateStatus,
		    workerOffscreenRetainedStatePromotionCandidateAdmissionStatus,
		    workerOffscreenRetainedStatePromotionCandidateStatePromotionStatus,
		    workerOffscreenRetainedStatePromotionCandidateAuthoritativeStateMutation,
		    workerOffscreenRetainedStatePromotionCandidateStateManagerAdmissionRequired,
		    workerOffscreenRetainedStatePromotionCandidateSameWorkerGpuHandoff,
		    workerOffscreenRetainedStatePromotionCandidateSourceStageId,
		    workerOffscreenRetainedStatePromotionCandidateRetainedBufferRefCount,
		    workerOffscreenRetainedStatePromotionCandidateGpuFenceSatisfied,
		    workerOffscreenRetainedStatePromotionCandidateSourceStateTransferBytes,
		    workerOffscreenRetainedStatePromotionCandidateSourceTransferBytes,
		    workerOffscreenRetainedStatePromotionCandidatePortableSnapshotRequired,
		    workerOffscreenRetainedStatePromotionCandidatePortableSnapshotAvailable,
		    workerOffscreenRetainedStatePromotionCandidateCrossPeerReplayStatus,
		    workerOffscreenRetainedStatePromotionCandidateCrossPeerReplayBlocker,
		    workerOffscreenRetainedStatePromotionAdmission,
		    workerOffscreenRetainedStatePromotionAdmissionStatus,
		    workerOffscreenRetainedStatePromotionAdmissionAccepted,
		    workerOffscreenRetainedStatePromotionAdmissionCommitted,
		    workerOffscreenRetainedStatePromotionAdmissionScope,
		    workerOffscreenRetainedStatePromotionAdmissionTaskId,
		    workerOffscreenRetainedStatePromotionAdmissionHotBufferKey,
		    workerOffscreenRetainedStatePromotionAdmissionStatePromotionStatus,
		    workerOffscreenRetainedStatePromotionAdmissionContinuationRequired,
		    workerOffscreenRetainedStatePromotionAdmissionPortableState,
		    workerOffscreenRetainedStatePromotionAdmissionPortableSnapshotRequired,
		    workerOffscreenRetainedStatePromotionAdmissionPortableSnapshotAvailable,
		    workerOffscreenRetainedStatePromotionAdmissionPortableMaterializationStatus,
		    workerOffscreenRetainedStatePromotionAdmissionCrossPeerReplayStatus,
		    workerOffscreenRetainedStatePromotionAdmissionCrossPeerReplayBlocker,
		    workerOffscreenRetainedStatePromotionAdmissionAuthoritativeStateMutation,
		    workerOffscreenRetainedStateContinuation,
		    workerOffscreenRetainedStateContinuationStatus,
		    workerOffscreenRetainedStateContinuationHotBufferKey,
		    workerOffscreenRetainedStateContinuationSourceHotBufferKey,
		    workerOffscreenRetainedStateContinuationAdmissionStatus,
		    workerOffscreenRetainedStateContinuationAdmissionCommitted,
		    workerOffscreenRetainedStateContinuationPlanStatus,
		    workerOffscreenRetainedStateContinuationUseWorkerRetainedInput,
		    workerOffscreenRetainedStateContinuationInputStatus,
		    workerOffscreenRetainedStateContinuationApplied,
		    workerOffscreenRetainedStateContinuationChainStatus,
		    workerOffscreenRetainedStateContinuationBlocker,
		    workerOffscreenRetainedStateContinuationPortableState,
		    workerOffscreenRetainedStateContinuationPortableSnapshotRequired,
		    workerOffscreenRetainedStateContinuationPortableSnapshotAvailable,
		    workerOffscreenRetainedStateContinuationPortableMaterializationStatus,
		    workerOffscreenRetainedStateContinuationCrossPeerReplayStatus,
		    workerOffscreenRetainedStateContinuationCrossPeerReplayBlocker,
		    workerOffscreenRetainedStateContinuationAuthoritativeStateMutation,
		    workerOffscreenRetainedCompactSnapshot,
		    workerOffscreenRetainedCompactSnapshotStatus,
		    workerOffscreenRetainedCompactSnapshotReason,
		    workerOffscreenRetainedCompactSnapshotSchema,
		    workerOffscreenRetainedCompactSnapshotAvailable,
		    workerOffscreenRetainedCompactSnapshotCrossPeerReplayReady,
		    workerOffscreenRetainedCompactSnapshotParticleCount,
		    workerOffscreenRetainedCompactSnapshotReadbackByteLength,
		    workerOffscreenRetainedCompactSnapshotSphStateByteLength,
		    workerOffscreenRetainedCompactSnapshotSphThermoByteLength,
		    workerOffscreenRetainedCompactSnapshotMlsMpmMechanicsByteLength,
		    workerOffscreenRetainedCompactSnapshotErrorMessage,
		    copyBudget: {
	      schema: 'peercompute.ulg.sph-performance-benchmark-copy-budget.v0',
	      renderRowsReadbackByteLength,
	      surfaceDrawSummaryReadbackByteLength,
	      estimatedReadbackBytesPerBatch,
	      estimatedReadbackBytesPerStep,
	      workerOffscreenFrameTransportBudget: workerOffscreenTransportBudget,
	      workerOffscreenPresentationCopiedBytesPerFrame,
	      workerOffscreenPresentationCopiedBytesPerSecond,
	      workerOffscreenPresentationFrameCopyBackRejected,
	      workerOffscreenRenderRowsInputTransferBytes,
	      workerOffscreenRenderRowsCopiedBytesPerFrame,
	      workerOffscreenRenderRowsCopiedBytesPerSecond,
	      workerOffscreenRenderRowsFrameCopyBackRejected
	    },
    surfaceDrawVertexCount: renderState?.surfaceDrawVertexCount ?? surfaceDraw?.vertexCount ?? null,
    surfaceDrawTriangleCount: renderState?.surfaceDrawTriangleCount ?? surfaceDraw?.triangleCount ?? null,
    surfaceDrawThreeMeshCount: renderState?.surfaceDrawRenderBridgeThreeMeshCount
      ?? surfaceDraw?.renderBridgeThreeMeshCount
      ?? null,
    surfaceDrawThreeGeometryByteLength
  };
}

async function main() {
  if (counts.length === 0) {
    throw new Error('No particle counts requested');
  }
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'ulg-sph-bench-'));
  const scenarios = [];
  for (let index = 0; index < counts.length; index += 1) {
    const targetParticleCount = counts[index];
    const scenario = scenarioUrlForCount(targetParticleCount);
    const probeOutput = path.join(tempDir, `probe-${targetParticleCount}.json`);
    const exit = await runProbe({
      ULG_PROBE_URL: scenario.url,
      ULG_PROBE_OUTPUT: probeOutput,
      ULG_PROBE_PORT: String(basePort + index),
      ULG_PROBE_MODE: probeMode,
      ULG_PROBE_TIMEOUT_MS: String(timeoutMs),
      ULG_PROBE_BATCHES: String(batches),
      ULG_PROBE_BATCH_STEPS: String(batchSteps),
      ULG_PROBE_RENDER_EVERY: '1',
      ULG_PROBE_READBACK_MODE: 'no-full-readback',
      ULG_PROBE_RENDER_READBACK_MODE: 'no-full-readback',
      ULG_PROBE_RENDER_ROWS_READBACK_MODE: 'no-full-readback',
      ULG_PROBE_RENDER_FIELD_SURFACE_SUMMARY_MODE: 'skip',
      ULG_PROBE_SURFACE_DRAW_DIAGNOSTIC_MODE: surfaceDrawMode,
      ULG_PROBE_SURFACE_DRAW_DIAGNOSTIC_MAX_FIELD_CELLS: '100000',
      ULG_PROBE_SURFACE_DRAW_DIAGNOSTIC_MAX_RESOLUTION: '8',
      ULG_PROBE_COMPACT_SUMMARY_MODE: compactSummaryMode,
      ULG_PROBE_COMPACT_SUMMARY_SCOPE: 'particle-visual',
      ULG_PROBE_FUSE_RESIDENT_MECHANICS_SEQUENCE: fuseResidentMechanicsSequence ? '1' : '0',
      ULG_PROBE_FUSE_RESIDENT_ACTIVE_GRID: fuseResidentMechanicsActiveGrid ? '1' : '0',
      ULG_PROBE_ACTIVE_GRID_PLAN_REFRESH_MODE: activeGridDispatchPlanRefreshMode,
      ULG_PROBE_MEASURE_GPU_QUEUE_FENCE: measureGpuQueueFence ? '1' : '0',
      ULG_PROBE_MATERIAL_INTERFACE_DIAGNOSTIC: materialInterfaceDiagnosticRequested ? '1' : '0',
      ULG_PROBE_MATERIAL_INTERFACE_CANDIDATE_READBACK_MODE: materialInterfaceCandidateReadbackMode,
      ...(fusedActiveGridSafetyCells ? {
        ULG_PROBE_FUSE_RESIDENT_ACTIVE_GRID_SAFETY_CELLS: String(fusedActiveGridSafetyCells)
      } : {}),
      ULG_PROBE_VIEWPORT_WIDTH: String(probeViewportWidth),
      ULG_PROBE_VIEWPORT_HEIGHT: String(probeViewportHeight),
      ...(deviceScaleFactor ? { ULG_PROBE_DEVICE_SCALE_FACTOR: String(deviceScaleFactor) } : {}),
      ULG_PROBE_IS_MOBILE: isMobile ? '1' : '0',
      ULG_PROBE_HAS_TOUCH: hasTouch ? '1' : '0',
      ULG_PROBE_FAIL_ON_BAD: '0'
    });
    let result = null;
    try {
      result = JSON.parse(await readFile(probeOutput, 'utf8'));
    } catch {
      try {
        result = JSON.parse(exit.stdout);
      } catch {
        result = null;
      }
    }
    scenarios.push({
      ...summarizeProbeResult({ targetParticleCount, scenario, result, exit }),
      stderrTail: exit.stderr ? exit.stderr.slice(-4000) : ''
    });
  }
  const report = {
    schema: 'peercompute.ulg.sph-performance-benchmark.v0',
    status: scenarios.every((scenario) => scenario.exitCode === 0) ? 'complete' : 'completed-with-errors',
    profile,
    repoDir,
    generatedAt: new Date().toISOString(),
    batches,
    batchSteps,
    probeMode,
    compactSummaryMode,
    lawGroups: {
      mechanics: true,
      gravity: true,
      eos: true,
      pressure: true,
      thermal: lawThermal,
      reactions: lawReactions,
      viscosity: lawViscosity,
      surfaceTension: lawSurfaceTension
    },
    page: {
      schema: 'peercompute.ulg.sph-performance-benchmark-page.v0',
      viewport: { width: viewportWidth, height: viewportHeight },
      probeViewport: { width: probeViewportWidth, height: probeViewportHeight },
      deviceScaleFactor,
      isMobile,
      hasTouch,
      workerOffscreenPresentationRequested,
      retainedCompactSnapshotExportRequested,
      workerOffscreenFrameTransportBudget: workerOffscreenFrameTransportBudget({
        width: viewportWidth,
        height: viewportHeight,
        dpr: deviceScaleFactor,
        refreshHz: workerOffscreenTargetFps
      })
    },
    surfaceDrawMode,
    materialInterfaceDiagnosticRequested,
    materialInterfaceCandidateReadbackMode,
    fusedResidentMechanicsSequence: fuseResidentMechanicsSequence,
    fusedResidentMechanicsActiveGrid: fuseResidentMechanicsActiveGrid,
    activeGridDispatchPlanRefreshMode,
    fusedActiveGridSafetyCells,
    measureGpuQueueFence,
    performanceGate: {
      schema: 'peercompute.ulg.sph-performance-benchmark-suite-gate.v0',
      status: scenarios.every((scenario) => scenario.performanceGate?.status === 'pass') ? 'pass' : 'fail',
      failedScenarioCount: scenarios.filter((scenario) => scenario.performanceGate?.status !== 'pass').length,
      requireActiveGrid: requireActiveGridGate,
      requireQueueFence: requireQueueFenceGate,
      thresholds: {
        minResidentStageStepsPerSecond,
        maxResidentGpuCompletedStageMs,
        maxReadbackBytesPerStep
      }
    },
    scenarios
  };
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (
    process.env.ULG_BENCH_FAIL_ON_ERROR === '1'
    && (
      report.status !== 'complete'
      || report.performanceGate.status !== 'pass'
      || scenarios.some((scenario) => scenario.status !== 'good')
    )
  ) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 2;
});
