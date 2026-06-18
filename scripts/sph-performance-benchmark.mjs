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
const isMobile = ['1', 'true', 'yes', 'on'].includes(String(process.env.ULG_BENCH_IS_MOBILE || '').toLowerCase());
const hasTouch = ['1', 'true', 'yes', 'on'].includes(
  String(process.env.ULG_BENCH_HAS_TOUCH || (isMobile ? '1' : '')).toLowerCase()
);
const surfaceDrawMode = String(
  process.env.ULG_BENCH_SURFACE_DRAW_MODE
    || (isMobile ? 'three-render-row-spheres' : 'three-render-row-points')
).trim().toLowerCase();
const booleanEnv = (name, fallback = false) => {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(raw).toLowerCase());
};
const lawThermal = booleanEnv('ULG_BENCH_LAW_THERMAL', probeMode !== 'direct-resident');
const lawReactions = booleanEnv('ULG_BENCH_LAW_REACTIONS', true);
const lawViscosity = booleanEnv('ULG_BENCH_LAW_VISCOSITY', true);
const lawSurfaceTension = booleanEnv('ULG_BENCH_LAW_SURFACE_TENSION', false);
const compactSummaryMode = ['none', 'final-only', 'every-step'].includes(
  String(process.env.ULG_BENCH_COMPACT_SUMMARY_MODE || '').toLowerCase()
)
  ? String(process.env.ULG_BENCH_COMPACT_SUMMARY_MODE).toLowerCase()
  : (probeMode === 'direct-resident' ? 'none' : 'final-only');
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

function summarizeProbeResult({ targetParticleCount, scenario, result, exit }) {
  const analysis = result?.analysis || {};
  const metric = lastMetricWithRenderState(result);
  const renderState = metric?.renderState || null;
  const surfaceDraw = metric?.surfaceDraw || null;
  const residentStep = metric?.residentStep || null;
  const residentSteps = metric?.residentSteps || null;
  const effectiveProbeMode = result?.timeline?.probeMode || probeMode;
  const residentStageTiming = residentStep?.stageTiming ?? residentSteps?.finalStepStageTiming ?? null;
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
  const physicsStepsPerSecond = meanBatchMs && meanBatchMs > 0
    ? (completedStepCount * 1000) / meanBatchMs
    : null;
  const visualRefreshHzEstimate = meanBatchMs && meanBatchMs > 0
    ? 1000 / meanBatchMs
    : null;
  const surfaceDrawStatus = renderState?.surfaceDrawStatus ?? surfaceDraw?.status ?? null;
  const surfaceDrawBridge = renderState?.surfaceDrawVisibleRendererBridge ?? surfaceDraw?.visibleRendererBridge ?? null;
  const surfaceDrawRequestedDiagnosticMode = renderState?.surfaceDrawRequestedDiagnosticMode
    ?? surfaceDraw?.requestedDiagnosticMode
    ?? null;
  const surfaceDrawDiagnosticFallbackReason = renderState?.surfaceDrawDiagnosticFallbackReason
    ?? surfaceDraw?.diagnosticFallbackReason
    ?? null;
  const renderRowsReadbackByteLength = numberOrNull(renderState?.renderRowsReadbackByteLength);
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
  const surfaceDrawThreeGeometryByteLength = numberOrNull(
    renderState?.surfaceDrawRenderBridgeThreeGeometryByteLength
      ?? surfaceDraw?.renderBridgeThreeGeometryByteLength
  );
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
  const activeGridDispatch = residentStageTiming?.activeGridDispatch ?? null;
  const validDirectResidentLoop = effectiveProbeMode === 'direct-resident'
    && residentSteps?.status === 'resident-steps-executed'
    && residentStep?.status === 'resident-step-webgpu-executed'
    && (
      !fuseResidentMechanicsSequence
      || residentStageTiming?.fusedResidentSequence === true
    )
    && (
      !fuseResidentMechanicsActiveGrid
      || activeGridDispatch?.useActiveGrid === true
    );
  const benchmarkStatus = exit.code === 0
    && Number(browserConsoleIssueCount ?? 0) === 0
    && Number.isFinite(residentStageMs)
    && (effectiveProbeMode === 'direct-resident' ? validDirectResidentLoop : validResidentRenderRowBridge)
    ? 'good'
    : (exit.code === 0 ? 'bad' : 'probe-error');
  return {
    schema: 'peercompute.ulg.sph-performance-benchmark-scenario.v0',
    targetParticleCount,
    actualParticleCount: scenario.actualParticleCount,
    latticeEdgePerCohort: scenario.edge,
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
    probeWallStepsPerSecond: physicsStepsPerSecond,
    residentStageMs,
    residentGpuQueueFenceMs,
    residentGpuCompletedStageMs,
    residentStageStepsPerSecond,
    residentStageTiming,
    residentStepsStatus: residentSteps?.status ?? null,
    residentStepStatus: residentStep?.status ?? null,
    fusedResidentMechanics: residentStageTiming?.fusedResidentMechanics ?? null,
    fusedResidentSequence: residentStageTiming?.fusedResidentSequence ?? null,
    fusedResidentSequenceStepCount: residentStageTiming?.fusedResidentSequenceStepCount ?? null,
    fusedResidentSequenceRequested: fuseResidentMechanicsSequence,
    fusedResidentActiveGridRequested: fuseResidentMechanicsActiveGrid,
    gridNodeCount: numberOrNull(residentDiagnostics?.gridNodeCount),
    activeGridNodeCount: numberOrNull(residentDiagnostics?.activeGridNodeCount),
    activeGridNodeCountAvailable: residentDiagnostics?.activeGridNodeCountAvailable ?? null,
    activeGridDispatch,
    visualRefreshHzEstimate,
    compactSummaryMeanBatchShare: analysis.compactSummaryMeanBatchShare ?? null,
    browserConsoleIssueCount,
    browserConsoleIssueCounts: analysis.browserConsoleIssueCounts || {},
    browserConsoleWarningCounts: analysis.browserConsoleWarningCounts || {},
    surfaceDrawStatus,
    surfaceDrawBridge,
    surfaceDrawRequestedDiagnosticMode,
    surfaceDrawDiagnosticFallbackReason,
    surfaceDrawSource: renderState?.surfaceDrawVisibleRenderSource ?? surfaceDraw?.visibleRenderSource ?? null,
    surfaceDrawReadback: renderState?.surfaceDrawReadback ?? surfaceDraw?.surfaceDrawReadback ?? null,
    renderRowsReadback: renderState?.renderRowsReadback ?? null,
    renderRowsReadbackMode: renderState?.renderRowsReadbackMode ?? null,
    renderRowsReadbackByteLength,
    surfaceDrawSummaryReadback: renderState?.surfaceDrawSummaryReadback ?? surfaceDraw?.surfaceDrawSummaryReadback ?? null,
    surfaceDrawSummaryReadbackByteLength,
    surfaceDrawRowsBufferByteLength,
    surfaceDrawIndirectRowsBufferByteLength,
    surfaceDrawCompactedVertexRowsBufferByteLength,
    estimatedReadbackBytesPerBatch,
    estimatedReadbackBytesPerStep,
    copyBudget: {
      schema: 'peercompute.ulg.sph-performance-benchmark-copy-budget.v0',
      renderRowsReadbackByteLength,
      surfaceDrawSummaryReadbackByteLength,
      estimatedReadbackBytesPerBatch,
      estimatedReadbackBytesPerStep
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
      ULG_PROBE_MEASURE_GPU_QUEUE_FENCE: measureGpuQueueFence ? '1' : '0',
      ...(fusedActiveGridSafetyCells ? {
        ULG_PROBE_FUSE_RESIDENT_ACTIVE_GRID_SAFETY_CELLS: String(fusedActiveGridSafetyCells)
      } : {}),
      ULG_PROBE_VIEWPORT_WIDTH: String(viewportWidth),
      ULG_PROBE_VIEWPORT_HEIGHT: String(viewportHeight),
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
      deviceScaleFactor,
      isMobile,
      hasTouch
    },
    surfaceDrawMode,
    fusedResidentMechanicsSequence: fuseResidentMechanicsSequence,
    fusedResidentMechanicsActiveGrid: fuseResidentMechanicsActiveGrid,
    fusedActiveGridSafetyCells,
    measureGpuQueueFence,
    scenarios
  };
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (
    process.env.ULG_BENCH_FAIL_ON_ERROR === '1'
    && (report.status !== 'complete' || scenarios.some((scenario) => scenario.status !== 'good'))
  ) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 2;
});
