import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { deriveSphPhaseInitialBaseBlockEdgeM } from '../src/runtime/sphPhaseDemo.js';

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
const iccTraceOutputPath = process.env.ULG_BENCH_ICC_TRACE_OUTPUT
  ? path.resolve(process.env.ULG_BENCH_ICC_TRACE_OUTPUT)
  : null;
const dropMaterial = String(
  process.env.ULG_BENCH_DROP_MATERIAL || 'h2o'
).trim() || 'h2o';
const baseMaterial = String(
  process.env.ULG_BENCH_BASE_MATERIAL || 'h2o'
).trim() || 'h2o';
const dropTemperatureK = Number.isFinite(Number(
  process.env.ULG_BENCH_DROP_TEMPERATURE_K
)) ? Number(process.env.ULG_BENCH_DROP_TEMPERATURE_K) : 300;
const baseTemperatureK = Number.isFinite(Number(
  process.env.ULG_BENCH_BASE_TEMPERATURE_K
)) ? Number(process.env.ULG_BENCH_BASE_TEMPERATURE_K) : 300;
const benchmarkIronBaseHeightM = (() => {
  const raw = process.env.ULG_BENCH_IRON_BASE_HEIGHT_M;
  if (raw == null || raw === '') return null;
  const heightM = Number(raw);
  if (!Number.isFinite(heightM) || heightM < 0) {
    throw new RangeError(
      'ULG_BENCH_IRON_BASE_HEIGHT_M must be a finite number greater than or equal to zero'
    );
  }
  return heightM;
})();
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
const schroederSimulationRequested = ['1', 'true', 'yes', 'on'].includes(
  String(process.env.ULG_BENCH_SCHROEDER_SIMULATION || '').toLowerCase()
);
const schroederSpatialArenaCount = (() => {
  const raw = process.env.ULG_BENCH_SCHROEDER_SPATIAL_ARENA_COUNT;
  if (raw == null || raw === '') return null;
  const count = Number(raw);
  if (!Number.isInteger(count) || count < 1 || count > 8) {
    throw new RangeError(
      'ULG_BENCH_SCHROEDER_SPATIAL_ARENA_COUNT must be an integer in [1, 8]'
    );
  }
  return count;
})();
const schroederSelectedLevel = Number.isFinite(Number(process.env.ULG_BENCH_SCHROEDER_LEVEL))
  && Number(process.env.ULG_BENCH_SCHROEDER_LEVEL) >= 0
  ? Math.round(Number(process.env.ULG_BENCH_SCHROEDER_LEVEL))
  : 0;
const schroederPortableSummaryRequested = ['0', 'false', 'no', 'off'].includes(
  String(process.env.ULG_BENCH_SCHROEDER_PORTABLE_SUMMARY || '').toLowerCase()
)
  ? false
  : schroederSimulationRequested;
const schroederActiveNodeIndexRequested = ['0', 'false', 'no', 'off'].includes(
  String(process.env.ULG_BENCH_SCHROEDER_ACTIVE_NODE_INDEX || '').toLowerCase()
)
  ? false
  : schroederSimulationRequested;
const renderOwnershipMode = String(process.env.ULG_BENCH_RENDER_OWNERSHIP || '').trim();
const renderOwnershipUseCase = String(
  process.env.ULG_BENCH_RENDER_USE_CASE
    || process.env.ULG_BENCH_PEERCOMPUTE_RENDER_USE_CASE
    || (probeMode === 'scene' ? 'same-device-interactive' : '')
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
const schroederLawQueueRequested = booleanEnv(
  'ULG_BENCH_SCHROEDER_LAW_QUEUE',
  false
);
const schroederLawNeighborCandidatesRequested = booleanEnv(
  'ULG_BENCH_SCHROEDER_LAW_NEIGHBOR_CANDIDATES',
  false
);
const schroederCrossLevelCouplingRequested = booleanEnv(
  'ULG_BENCH_SCHROEDER_CROSS_LEVEL_COUPLING',
  false
);
const schroederTwoLevelMechanicsRequested = booleanEnv(
  'ULG_BENCH_SCHROEDER_TWO_LEVEL',
  false
);
const schroederTwoLevelMechanicsAuthority = (() => {
  const requested = String(
    process.env.ULG_BENCH_SCHROEDER_TWO_LEVEL_AUTHORITY
      || (schroederTwoLevelMechanicsRequested ? 'authoritative' : 'observation')
  ).trim().toLowerCase();
  return requested === 'authoritative' ? 'authoritative' : 'observation';
})();
const schroederTwoLevelFineSubstepCount = Math.max(1, Math.min(4, Math.round(
  Number(process.env.ULG_BENCH_SCHROEDER_TWO_LEVEL_SUBSTEPS || 2) || 2
)));
const schroederMaxLevel = Math.max(
  schroederSelectedLevel,
  Math.round(Number(
    process.env.ULG_BENCH_SCHROEDER_MAX_LEVEL
      || (schroederTwoLevelMechanicsRequested ? schroederSelectedLevel + 1 : schroederSelectedLevel)
  ) || 0)
);
const schroederPhaseVolumeMigrationRequested = booleanEnv(
  'ULG_BENCH_SCHROEDER_PHASE_VOLUME_MIGRATION',
  false
);
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
  false
);
const measureGpuTimestampInterval = booleanEnv(
  'ULG_BENCH_MEASURE_GPU_TIMESTAMPS',
  false
);
const measureGpuStageTimestamps = booleanEnv(
  'ULG_BENCH_MEASURE_GPU_STAGE_TIMESTAMPS',
  false
);
const requireMigratedLawGpuStageTimestamps = booleanEnv(
  'ULG_BENCH_REQUIRE_MIGRATED_LAW_GPU_TIMESTAMPS',
  false
);
const requireGpuTimestampInterval = booleanEnv(
  'ULG_BENCH_REQUIRE_GPU_TIMESTAMPS',
  measureGpuTimestampInterval
);
const gpuTimestampWarmupBatchCount = Math.max(0, Math.min(
  Math.max(0, batches - 1),
  Math.round(Number(
    process.env.ULG_BENCH_GPU_TIMESTAMP_WARMUP_BATCHES || 0
  ) || 0)
));
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
const captureThermalCandidateCsrRouteEvidence = booleanEnv(
  'ULG_BENCH_CAPTURE_THERMAL_CSR_ROUTE_EVIDENCE',
  false
);
const requireActiveGridGate = booleanEnv(
  'ULG_BENCH_REQUIRE_ACTIVE_GRID',
  probeMode === 'direct-resident' && fuseResidentMechanicsActiveGrid
);
const requireQueueFenceGate = booleanEnv(
  'ULG_BENCH_REQUIRE_QUEUE_FENCE',
  measureGpuQueueFence
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

export function createSchroederBenchmarkScenarioParams({
  simulationRequested = false,
  selectedLevel = 0,
  maxLevel = selectedLevel,
  spatialArenaCount = null,
  portableSummaryRequested = false,
  activeNodeIndexRequested = false,
  lawQueueRequested = false,
  lawNeighborCandidatesRequested = false,
  crossLevelCouplingRequested = false,
  phaseVolumeMigrationRequested = false,
  twoLevelMechanicsRequested = false,
  twoLevelMechanicsAuthority = 'observation',
  twoLevelFineSubstepCount = 2
} = {}) {
  if (simulationRequested !== true) return {};
  const normalizedSelectedLevel = Math.max(0, Math.round(Number(selectedLevel) || 0));
  const normalizedTwoLevelRequested = twoLevelMechanicsRequested === true;
  const normalizedMaxLevel = Math.max(
    normalizedSelectedLevel + (normalizedTwoLevelRequested ? 1 : 0),
    Math.round(Number(maxLevel) || 0)
  );
  const normalizedAuthority = String(twoLevelMechanicsAuthority).trim().toLowerCase()
    === 'authoritative'
    ? 'authoritative'
    : 'observation';
  const normalizedSubstepCount = Math.max(
    1,
    Math.min(4, Math.round(Number(twoLevelFineSubstepCount) || 2))
  );
  return {
    ss: '1',
    schroederLevel: String(normalizedSelectedLevel),
    schroederMaxLevel: String(normalizedMaxLevel),
    ...(spatialArenaCount == null
      ? {}
      : { schroederSpatialArenaCount: String(spatialArenaCount) }),
    schroederPortableSummary: portableSummaryRequested ? '1' : '0',
    schroederActiveNodeIndex: activeNodeIndexRequested ? '1' : '0',
    schroederLawQueue: lawQueueRequested ? '1' : '0',
    schroederLawNeighborCandidates: lawNeighborCandidatesRequested ? '1' : '0',
    schroederCrossLevelCoupling: crossLevelCouplingRequested ? '1' : '0',
    schroederPhaseVolumeMigration: phaseVolumeMigrationRequested ? '1' : '0',
    ...(normalizedTwoLevelRequested ? {
      schroederTwoLevel: '1',
      schroederTwoLevelAuthority: normalizedAuthority,
      schroederTwoLevelSubsteps: String(normalizedSubstepCount)
    } : {})
  };
}

export function scenarioUrlForCount(targetCount) {
  const edge = edgeForApproxParticleCount(targetCount);
  const actualParticleCount = edge ** 3 * 2;
  const iceBaseHeightM = 0;
  // The benchmark varies matter amount with particles-per-edge.  Its initial
  // bodies must therefore use the demo's fixed matter quantum instead of a
  // hard-coded height: the drop's bottom exactly meets the generated base.
  const baseBlockEdgeM = deriveSphPhaseInitialBaseBlockEdgeM({
    baseParticleEdge: edge
  });
  const ironBaseHeightM = benchmarkIronBaseHeightM
    ?? (iceBaseHeightM + baseBlockEdgeM);
  // The box has to contain the bodies the sweep generates. It was fixed at
  // 5 m on every axis while dropn/basen scale with the target particle count,
  // so above 12 particles per edge the drop block -- which sits on top of the
  // base -- ran past the ceiling and the worker rejected the scenario:
  //
  //   Initial body 'drop' is outside container axis 1:
  //   [2.6000000000000005, 5.2] is not within [0, 5]
  //
  // That rejection surfaced as a startup hang rather than an error, so the
  // sweep looked like an application scaling cliff at roughly 3.5k particles
  // and could not measure above it. The box now follows the geometry, with the
  // 5 m floor preserved so small counts keep their existing scenario exactly.
  const requiredHeightM = ironBaseHeightM + baseBlockEdgeM;
  const requiredWidthM = baseBlockEdgeM;
  const boxHeightM = Math.max(5, Math.ceil((requiredHeightM * 1.1) * 10) / 10);
  const boxWidthM = Math.max(5, Math.ceil((requiredWidthM * 1.5) * 10) / 10);
  const params = new URLSearchParams({
    drop: dropMaterial,
    base: baseMaterial,
    dropt: String(dropTemperatureK),
    baset: String(baseTemperatureK),
    iceh: String(iceBaseHeightM),
    ironh: String(ironBaseHeightM),
    boxx: String(boxWidthM),
    boxy: String(boxHeightM),
    boxz: String(boxWidthM),
    dropn: String(edge),
    basen: String(edge),
    mech: 'mlsmpm',
    residentAuto: '0',
    residentFuseSequence: '1',
    residentActiveGrid: '1',
    ...(workerOffscreenPresentationRequested ? { workerOffscreenPresentation: '1' } : {}),
    ...(presentationWorkerResidentStagesRequested ? { presentationWorkerResidentStages: '1' } : {}),
    ...(retainedCompactSnapshotExportRequested ? { retainedCompactSnapshotExport: '1' } : {}),
    ...createSchroederBenchmarkScenarioParams({
      simulationRequested: schroederSimulationRequested,
      selectedLevel: schroederSelectedLevel,
      maxLevel: schroederMaxLevel,
      spatialArenaCount: schroederSpatialArenaCount,
      portableSummaryRequested: schroederPortableSummaryRequested,
      activeNodeIndexRequested: schroederActiveNodeIndexRequested,
      lawQueueRequested: schroederLawQueueRequested,
      lawNeighborCandidatesRequested: schroederLawNeighborCandidatesRequested,
      crossLevelCouplingRequested: schroederCrossLevelCouplingRequested,
      phaseVolumeMigrationRequested: schroederPhaseVolumeMigrationRequested,
      twoLevelMechanicsRequested: schroederTwoLevelMechanicsRequested,
      twoLevelMechanicsAuthority: schroederTwoLevelMechanicsAuthority,
      twoLevelFineSubstepCount: schroederTwoLevelFineSubstepCount
    }),
    ...(renderOwnershipMode ? { renderOwnership: renderOwnershipMode } : {}),
    ...(renderOwnershipUseCase ? { renderUseCase: renderOwnershipUseCase } : {}),
    ...(residentInterfaceRefreshWarmupFrames != null
      ? { residentInterfaceRefreshWarmupFrames: String(residentInterfaceRefreshWarmupFrames) }
      : {}),
    ...(measureGpuQueueFence ? { residentQueueFence: '1' } : {}),
    ...((measureGpuTimestampInterval || measureGpuStageTimestamps)
      ? { residentGpuTimestampProfile: '1' }
      : {}),
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
    actualParticleCount,
    iceBaseHeightM,
    baseBlockEdgeM,
    ironBaseHeightM,
    ironBaseHeightSource: benchmarkIronBaseHeightM == null
      ? 'derived-touching-base-block-edge'
      : 'ULG_BENCH_IRON_BASE_HEIGHT_M'
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

/**
 * Turn a compact transaction admission record into explicit runtime proof for
 * ICC. This deliberately emits nothing unless a real resident simulation
 * admitted a finalized, same-device WebGPU reaction-discovery receipt with
 * every no-fallback invariant intact.
 */
export function buildSchroederReactionReceiptIccTrace({
  scenarios = [],
  reportPath = null
} = {}) {
  const candidates = (Array.isArray(scenarios) ? scenarios : []).flatMap(
    (scenario) => (
      Array.isArray(scenario?.schroederAdmittedConsumerReceiptTelemetry)
        ? scenario.schroederAdmittedConsumerReceiptTelemetry.map((receipt) => ({
            scenario,
            receipt
          }))
        : []
    )
  ).filter(({ scenario, receipt }) => (
    scenario?.schroederSimulationActive === true
    && scenario?.schroederTransactionCoverageComplete === true
    && receipt?.consumerId === 'reaction-discovery'
    && receipt?.status === 'schroeder-spatial-epoch-consumer-receipt-finalized'
    && receipt?.backend === 'webgpu'
    && receipt?.backendSelection === 'same-device-submitted-webgpu-generation'
    && receipt?.fallbackIntent === 'forbidden'
    && receipt?.authenticated === true
    && receipt?.gpuAuthenticated === true
    && receipt?.submitPerformed === true
    && receipt?.generationBound === true
    && Number.isSafeInteger(receipt?.expectedTraversalCount)
    && receipt.expectedTraversalCount > 0
    && receipt.traversalCount === receipt.expectedTraversalCount
    && receipt?.overflowed === false
    && receipt?.partialPublication === false
    && receipt?.fallbackObserved === false
    && receipt?.fullReadbackPerformed === false
    && receipt?.privateLookupBuildCount === 0
    && receipt?.fixedCandidateBuildCount === 0
    && receipt?.exhaustiveTraversalCount === 0
  ));
  if (candidates.length === 0) return Object.freeze([]);
  const { scenario, receipt } = candidates.at(-1);
  const value = Object.freeze({
    backend: receipt.backend,
    backendSelection: receipt.backendSelection,
    fallbackIntent: receipt.fallbackIntent,
    consumerId: receipt.consumerId,
    deviceId: receipt.deviceId,
    generationId: receipt.generationId,
    epochIdentity: receipt.epochIdentity,
    gpuAuthenticated: receipt.gpuAuthenticated,
    submitPerformed: receipt.submitPerformed,
    generationBound: receipt.generationBound,
    expectedTraversalCount: receipt.expectedTraversalCount,
    traversalCount: receipt.traversalCount,
    overflowed: receipt.overflowed,
    partialPublication: receipt.partialPublication,
    fallbackObserved: receipt.fallbackObserved,
    fullReadbackPerformed: receipt.fullReadbackPerformed,
    privateLookupBuildCount: receipt.privateLookupBuildCount,
    fixedCandidateBuildCount: receipt.fixedCandidateBuildCount,
    exhaustiveTraversalCount: receipt.exhaustiveTraversalCount,
    receiptCount: candidates.length,
    particleCount: scenario?.targetParticleCount ?? null,
    reportPath
  });
  return Object.freeze([
    Object.freeze({
      kind: 'function_called',
      name: 'finalizeSchroederSpatialExactNearConsumerReceipt',
      value,
      snippet: 'A finalized reaction-discovery receipt was admitted by a real resident WebGPU transaction.'
    }),
    Object.freeze({
      kind: 'test_result',
      name: 'schroeder-spatial-reaction-discovery-native-receipt',
      status: 'PASS',
      value,
      snippet: 'Native WebGPU reaction discovery finalized one same-device exact-near consumer receipt without fallback or full readback.'
    })
  ]);
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

export function scenarioPerformanceGate({
  residentGpuCompletedStageMs,
  residentStageStepsPerSecond,
  probeWallStepsPerSecond,
  probeEngineStepsPerSecond,
  estimatedReadbackBytesPerStep,
  activeGridDispatch,
  residentStageTiming,
  fusedResidentSequenceBlockedForSidecars = false,
  schroederSimulationRequested = false,
  schroederSimulationRequestedObserved = null,
  schroederSimulationActive = null,
  schroederTransactionCoverageComplete = null,
  schroederSpatialArenaCountRequested = null,
  schroederSpatialArenaCountCoverageComplete = null,
  schroederTwoLevelMechanicsRequested = false,
  schroederTwoLevelMechanicsRequestedObserved = null,
  schroederTwoLevelMechanicsCoverageComplete = null,
  schroederTwoLevelMechanicsAuthorityRequested = null,
  schroederTwoLevelMechanicsAuthorityObserved = null,
  schroederTwoLevelFineSubstepCountRequested = null,
  schroederTwoLevelFineSubstepCountObserved = null,
  schroederTwoLevelMechanicsStepStatus = null,
  schroederTwoLevelAuthoritativeCommitVerified = null,
  gpuTimestampIntervalEvidence = null,
  gpuTimestampRequired = requireGpuTimestampInterval,
  gpuStageTimestampEvidence = null,
  gpuStageTimestampsRequired = measureGpuStageTimestamps
}) {
  const blockers = [];
  if (
    schroederSimulationRequested === true
    && schroederSimulationRequestedObserved !== true
  ) {
    blockers.push('schroeder-simulation-request-not-observed');
  }
  if (
    schroederSimulationRequested === true
    && schroederSimulationActive !== true
  ) {
    blockers.push('schroeder-simulation-requested-but-inactive');
  }
  if (
    schroederSimulationRequested === true
    && schroederTransactionCoverageComplete !== true
  ) {
    blockers.push('schroeder-spatial-transaction-coverage-incomplete');
  }
  if (
    schroederSpatialArenaCountRequested !== null
    && schroederSpatialArenaCountCoverageComplete !== true
  ) {
    blockers.push('schroeder-spatial-arena-count-coverage-incomplete');
  }
  if (
    schroederTwoLevelMechanicsRequested === true
    && schroederTwoLevelMechanicsRequestedObserved !== true
  ) {
    blockers.push('schroeder-two-level-request-not-observed');
  }
  if (
    schroederTwoLevelMechanicsRequested === true
    && schroederTwoLevelMechanicsCoverageComplete !== true
  ) {
    blockers.push('schroeder-two-level-batch-coverage-incomplete');
  }
  if (
    schroederTwoLevelMechanicsRequested === true
    && schroederTwoLevelMechanicsAuthorityObserved
      !== schroederTwoLevelMechanicsAuthorityRequested
  ) {
    blockers.push('schroeder-two-level-authority-mismatch');
  }
  if (
    schroederTwoLevelMechanicsRequested === true
    && Number(schroederTwoLevelFineSubstepCountObserved)
      !== Number(schroederTwoLevelFineSubstepCountRequested)
  ) {
    blockers.push('schroeder-two-level-substep-count-mismatch');
  }
  if (
    schroederTwoLevelMechanicsRequested === true
    && schroederTwoLevelMechanicsStepStatus
      !== 'schroeder-two-level-authoritative-step-executed'
  ) {
    blockers.push('schroeder-two-level-authoritative-step-not-executed');
  }
  if (
    schroederTwoLevelMechanicsRequested === true
    && schroederTwoLevelAuthoritativeCommitVerified !== true
  ) {
    blockers.push('schroeder-two-level-authoritative-commit-unverified');
  }
  if (
    gpuTimestampRequired === true
    && (
      gpuTimestampIntervalEvidence?.status !== 'complete'
      || gpuTimestampIntervalEvidence?.batchCoverageComplete !== true
      || gpuTimestampIntervalEvidence?.measurementCoverageComplete !== true
    )
  ) {
    blockers.push('gpu-timestamp-interval-evidence-incomplete');
  }
  if (
    gpuStageTimestampsRequired === true
    && (
      gpuStageTimestampEvidence?.status !== 'complete'
      || gpuStageTimestampEvidence?.batchCoverageComplete !== true
      || gpuStageTimestampEvidence?.stageCoverageComplete !== true
    )
  ) {
    blockers.push('gpu-stage-timestamp-evidence-incomplete');
  }
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
    requireGpuTimestampInterval: gpuTimestampRequired === true,
    thresholds: {
      minResidentStageStepsPerSecond,
      maxResidentGpuCompletedStageMs,
      maxReadbackBytesPerStep
    },
    observed: {
      residentGpuCompletedStageMs,
      residentStageStepsPerSecond,
      probeWallStepsPerSecond,
      probeEngineStepsPerSecond,
      estimatedReadbackBytesPerStep,
      schroederSimulationRequested,
      schroederSimulationRequestedObserved,
      schroederSimulationActive,
      schroederTransactionCoverageComplete,
      schroederSpatialArenaCountRequested,
      schroederSpatialArenaCountCoverageComplete,
      schroederTwoLevelMechanicsRequested,
      schroederTwoLevelMechanicsRequestedObserved,
      schroederTwoLevelMechanicsCoverageComplete,
      schroederTwoLevelMechanicsAuthorityRequested,
      schroederTwoLevelMechanicsAuthorityObserved,
      schroederTwoLevelFineSubstepCountRequested,
      schroederTwoLevelFineSubstepCountObserved,
      schroederTwoLevelMechanicsStepStatus,
      schroederTwoLevelAuthoritativeCommitVerified,
      gpuTimestampIntervalStatus:
        gpuTimestampIntervalEvidence?.status ?? null,
      gpuTimestampIntervalBatchCoverageComplete:
        gpuTimestampIntervalEvidence?.batchCoverageComplete ?? null,
      gpuTimestampIntervalMeasurementCoverageComplete:
        gpuTimestampIntervalEvidence?.measurementCoverageComplete ?? null,
      gpuTimestampIntervalMeasuredSampleCount:
        gpuTimestampIntervalEvidence?.measuredSampleCount ?? null,
      gpuTimestampIntervalP50Ms:
        gpuTimestampIntervalEvidence?.p50Ms ?? null,
      gpuTimestampIntervalP95Ms:
        gpuTimestampIntervalEvidence?.p95Ms ?? null,
      gpuStageTimestampStatus: gpuStageTimestampEvidence?.status ?? null,
      gpuStageTimestampBatchCoverageComplete:
        gpuStageTimestampEvidence?.batchCoverageComplete ?? null,
      gpuStageTimestampProducerCount:
        gpuStageTimestampEvidence?.producerSummaries?.length ?? null,
      activeGridUsed: activeGridDispatch?.useActiveGrid === true,
      queueFenceStatus: residentStageTiming?.queueFenceStatus?.fusedMechanicsSequence ?? null,
      queueFenceBypassedBySidecarFallback: fusedResidentSequenceBlockedForSidecars === true
    }
  };
}

function percentile(values, fraction) {
  const sorted = (Array.isArray(values) ? values : [])
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const boundedFraction = Math.max(0, Math.min(1, Number(fraction) || 0));
  const nearestRank = Math.max(1, Math.ceil(boundedFraction * sorted.length));
  return sorted[nearestRank - 1];
}

/**
 * Strictly summarize the two timestamp markers wrapped around each untouched
 * production resident batch.  Every requested batch must publish exactly one
 * complete, same-device interval; warmups are retained as evidence but are
 * excluded from the reported p50/p95 measurement distribution.
 */
export function summarizeResidentGpuTimestampEvidence({
  metrics = [],
  requested = false,
  requestedBatchCount = 0,
  warmupBatchCount = 0
} = {}) {
  const expectedBatchCount = exactNonNegativeIntegerOrNull(requestedBatchCount);
  const requestedShapeValid = Number.isInteger(expectedBatchCount)
    && expectedBatchCount > 0;
  const normalizedWarmupBatchCount = requestedShapeValid
    ? Math.max(0, Math.min(
      expectedBatchCount - 1,
      exactNonNegativeIntegerOrNull(warmupBatchCount) ?? 0
    ))
    : 0;
  if (requested !== true) {
    return {
      schema: 'peercompute.ulg.sph-performance-gpu-queue-interval-evidence.v0',
      status: 'not-requested',
      requested: false,
      expectedBatchCount: requestedShapeValid ? expectedBatchCount : 0,
      warmupBatchCount: normalizedWarmupBatchCount,
      measuredSampleCount: 0,
      batchCoverageComplete: null,
      measurementCoverageComplete: null,
      p50Ms: null,
      p95Ms: null,
      percentileEstimator: 'nearest-rank-ceil-nq',
      profilingOverhead: {
        markerSubmissionCount: 0,
        queryResolveByteLength: 0,
        mappedReadbackByteLength: 0,
        mapAsyncCount: 0
      },
      samples: []
    };
  }
  const residentBatchMetrics = (Array.isArray(metrics) ? metrics : [])
    .filter((entry) => (
      entry?.phase === 'resident-batch'
      && Number.isInteger(Number(entry?.batchIndex))
      && Number(entry.batchIndex) > 0
    ));
  const metricsByBatch = new Map();
  for (const metric of residentBatchMetrics) {
    const batchIndex = Number(metric.batchIndex);
    const existing = metricsByBatch.get(batchIndex) || [];
    existing.push(metric);
    metricsByBatch.set(batchIndex, existing);
  }
  const expectedBatchIndices = requestedShapeValid
    ? Array.from({ length: expectedBatchCount }, (_, index) => index + 1)
    : [];
  const samples = expectedBatchIndices.map((batchIndex) => {
    const batchMetrics = metricsByBatch.get(batchIndex) || [];
    const interval = batchMetrics.length === 1
      ? batchMetrics[0]?.probeResidentBatchTiming?.gpuTimestampInterval || null
      : null;
    let monotonicTimestampPair = false;
    let timestampPairDurationNs = null;
    try {
      const startTimestampNs = BigInt(interval?.startTimestampNs);
      const endTimestampNs = BigInt(interval?.endTimestampNs);
      const difference = endTimestampNs - startTimestampNs;
      monotonicTimestampPair = difference > 0n;
      if (difference <= BigInt(Number.MAX_SAFE_INTEGER)) {
        timestampPairDurationNs = Number(difference);
      }
    } catch {
      monotonicTimestampPair = false;
    }
    const durationNs = numberOrNull(interval?.durationNs);
    const durationMs = numberOrNull(interval?.durationMs);
    const requiredFeatures = Array.isArray(interval?.requiredFeatures)
      ? interval.requiredFeatures.map(String)
      : [];
    const enabledFeatures = Array.isArray(interval?.enabledFeatures)
      ? interval.enabledFeatures.map(String)
      : [];
    const durationConsistent = Number.isSafeInteger(durationNs)
      && durationNs === timestampPairDurationNs
      && Number.isFinite(durationMs)
      && Math.abs(durationMs - durationNs / 1e6)
        <= Math.max(1e-9, Math.abs(durationNs / 1e6) * 1e-12);
    const complete = Boolean(
      batchMetrics.length === 1
      && interval?.schema === 'peercompute.ulg.sph-probe-gpu-queue-interval.v0'
      && interval?.requested === true
      && Number(interval?.batchIndex) === batchIndex
      && interval?.status === 'gpu-timestamp-interval-complete'
      && interval?.timestampUnit === 'nanoseconds'
      && interval?.timestampProfilingRequested === true
      && interval?.timestampQuerySupported === true
      && requiredFeatures.includes('timestamp-query')
      && enabledFeatures.includes('timestamp-query')
      && Number(interval?.queryCount) === 2
      && Number(interval?.validQueryCount) === 2
      && Number(interval?.invalidQueryCount) === 0
      && Number(interval?.markerSubmissionCount) === 2
      && Number(interval?.queryResolveByteLength) === 16
      && Number(interval?.mappedReadbackByteLength) === 16
      && Number(interval?.mapAsyncCount) === 1
      && monotonicTimestampPair
      && durationConsistent
      && durationNs > 0
      && Number.isFinite(durationMs)
      && durationMs > 0
      && interval?.intervalSemantics
        === 'same-queue-start-to-end-markers-includes-production-work-and-queue-idle'
    );
    return {
      batchIndex,
      warmup: batchIndex <= normalizedWarmupBatchCount,
      metricCount: batchMetrics.length,
      status: interval?.status ?? 'missing',
      complete,
      queryCount: numberOrNull(interval?.queryCount),
      validQueryCount: numberOrNull(interval?.validQueryCount),
      invalidQueryCount: numberOrNull(interval?.invalidQueryCount),
      markerSubmissionCount: numberOrNull(interval?.markerSubmissionCount),
      queryResolveByteLength: numberOrNull(interval?.queryResolveByteLength),
      mappedReadbackByteLength: numberOrNull(interval?.mappedReadbackByteLength),
      mapAsyncCount: numberOrNull(interval?.mapAsyncCount),
      durationNs,
      durationMs,
      timestampPairDurationNs,
      durationConsistent,
      timestampProfilingRequested:
        interval?.timestampProfilingRequested ?? null,
      timestampQuerySupported: interval?.timestampQuerySupported ?? null,
      requiredFeatures,
      enabledFeatures
    };
  });
  const observedBatchIndices = [...metricsByBatch.keys()].sort((a, b) => a - b);
  const batchIndexCoverageComplete = requestedShapeValid
    && residentBatchMetrics.length === expectedBatchCount
    && observedBatchIndices.length === expectedBatchIndices.length
    && observedBatchIndices.every(
      (batchIndex, index) => batchIndex === expectedBatchIndices[index]
    );
  const batchCoverageComplete = batchIndexCoverageComplete
    && samples.every((sample) => sample.complete);
  const measuredSamples = samples.filter((sample) => !sample.warmup);
  const measurementCoverageComplete = batchCoverageComplete
    && measuredSamples.length === expectedBatchCount - normalizedWarmupBatchCount
    && measuredSamples.length > 0
    && measuredSamples.every((sample) => sample.complete);
  const measuredDurationsMs = measurementCoverageComplete
    ? measuredSamples.map((sample) => sample.durationMs)
    : [];
  return {
    schema: 'peercompute.ulg.sph-performance-gpu-queue-interval-evidence.v0',
    status: measurementCoverageComplete ? 'complete' : 'incomplete',
    requested: true,
    intervalSemantics:
      'same-queue-start-to-end-markers-includes-production-work-and-queue-idle',
    expectedBatchCount: requestedShapeValid ? expectedBatchCount : 0,
    observedBatchCount: residentBatchMetrics.length,
    observedBatchIndices,
    warmupBatchCount: normalizedWarmupBatchCount,
    expectedMeasuredSampleCount: requestedShapeValid
      ? expectedBatchCount - normalizedWarmupBatchCount
      : 0,
    measuredSampleCount: measuredSamples.filter((sample) => sample.complete).length,
    invalidSampleCount: samples.filter((sample) => !sample.complete).length,
    batchIndexCoverageComplete,
    batchCoverageComplete,
    measurementCoverageComplete,
    p50Ms: percentile(measuredDurationsMs, 0.5),
    p95Ms: percentile(measuredDurationsMs, 0.95),
    percentileEstimator: 'nearest-rank-ceil-nq',
    minMs: measuredDurationsMs.length > 0
      ? Math.min(...measuredDurationsMs)
      : null,
    maxMs: measuredDurationsMs.length > 0
      ? Math.max(...measuredDurationsMs)
      : null,
    profilingOverhead: {
      markerSubmissionCount: samples.reduce(
        (sum, sample) => sum + (sample.markerSubmissionCount ?? 0),
        0
      ),
      queryResolveByteLength: samples.reduce(
        (sum, sample) => sum + (sample.queryResolveByteLength ?? 0),
        0
      ),
      mappedReadbackByteLength: samples.reduce(
        (sum, sample) => sum + (sample.mappedReadbackByteLength ?? 0),
        0
      ),
      mapAsyncCount: samples.reduce(
        (sum, sample) => sum + (sample.mapAsyncCount ?? 0),
        0
      ),
      productionHotStateReadback: false,
      classification: 'benchmark-only-timestamp-query-readback'
    },
    samples
  };
}

/**
 * Validate benchmark-only timestamp spans. Same-encoder spans bracket the
 * unchanged production command stream. Queue-boundary spans are explicitly
 * elapsed queue intervals (including queue idle), never claims of pure GPU
 * busy time. Canonical key/sort/unique/view counts are exact per generation;
 * authoritative two-level traversal is exact per macrostep.
 */
export function summarizeResidentGpuStageTimestampEvidence({
  metrics = [],
  requested = false,
  requestedBatchCount = 0,
  requestedBatchStepCount = 1,
  warmupBatchCount = 0,
  twoLevelAuthoritative = false,
  twoLevelFineSubstepCount = 2,
  requireMigratedLawCoverage = false,
  lawThermalEnabled = true,
  lawReactionsEnabled = true
} = {}) {
  const schema = 'peercompute.ulg.sph-performance-gpu-stage-evidence.v0';
  const markerEncodingMode =
    'empty-compute-pass-timestampWrites';
  const encoderSpanSemantics =
    'same-command-encoder-empty-pass-boundaries-bracket-production-commands';
  const queueIntervalSemantics =
    'ordered-queue-boundary-marker-submissions-measure-elapsed-queue-interval-including-production-work-and-queue-idle-not-pure-gpu-busy';
  const encoderMeasurementKind =
    'same-command-encoder-gpu-elapsed-interval';
  const queueMeasurementKind = 'elapsed-queue-interval';
  const expectedBatchCount = exactNonNegativeIntegerOrNull(
    requestedBatchCount
  );
  const batchStepCount = Math.max(
    1,
    exactNonNegativeIntegerOrNull(requestedBatchStepCount) ?? 1
  );
  const fineSubstepCount = Math.max(
    1,
    exactNonNegativeIntegerOrNull(twoLevelFineSubstepCount) ?? 2
  );
  const normalizedWarmupBatchCount = Math.max(
    0,
    exactNonNegativeIntegerOrNull(warmupBatchCount) ?? 0
  );
  if (requested !== true) {
    return {
      schema,
      status: 'not-requested',
      requested: false,
      batchCoverageComplete: null,
      stageCoverageComplete: null,
      producerSummaries: []
    };
  }
  const residentMetrics = (Array.isArray(metrics) ? metrics : []).filter(
    (metric) => metric?.phase === 'resident-batch'
  );
  const releasedTransactionAggregate =
    aggregateSchroederResidentBatchEvidence({
      metrics: residentMetrics,
      requestedBatchCount: expectedBatchCount,
      requestedBatchStepCount: batchStepCount,
      schroederSimulationRequested: true,
      schroederTwoLevelMechanicsRequested: twoLevelAuthoritative,
      schroederTwoLevelMechanicsAuthority: twoLevelAuthoritative
        ? 'authoritative'
        : 'observation',
      schroederTwoLevelFineSubstepCount: fineSubstepCount
    });
  const authenticReleasedTransactionSummaryCoverageComplete = Boolean(
    residentMetrics.length > 0
    && residentMetrics.every((metric) => {
      const residentSteps = metric?.residentSteps ?? null;
      const transactions = Array.isArray(
        residentSteps?.schroederSpatialEpochTransactionSummaries
      )
        ? residentSteps.schroederSpatialEpochTransactionSummaries
        : [];
      return metric?.schroederTelemetry?.requested === true
        && metric?.schroederTelemetry?.active === true
        && residentSteps?.status === 'resident-steps-executed'
        && exactNonNegativeIntegerOrNull(residentSteps?.completedStepCount)
          === batchStepCount
        && transactions.length === batchStepCount
        && transactions.every((transaction) => (
          transaction?.schema
            === 'peercompute.ulg.schroeder-spatial-epoch-transaction-summary.v0'
          && transaction?.status
            === 'schroeder-spatial-epoch-transaction-released'
          && transaction?.state === 'released'
          && typeof transaction?.deviceId === 'string'
          && transaction.deviceId.length > 0
          && exactNonNegativeIntegerOrNull(transaction?.generationId) !== null
          && exactEpochIdentityOrNull(transaction?.epochIdentity) !== null
        ));
    })
  );
  const releasedTransactionEvidenceComplete = Boolean(
    authenticReleasedTransactionSummaryCoverageComplete
    && releasedTransactionAggregate.transactionCoverageComplete === true
    && (
      !twoLevelAuthoritative
      || releasedTransactionAggregate.twoLevelMechanicsCoverageComplete
        === true
    )
  );
  const expectedGenerationCountPerBatch = batchStepCount * (
    twoLevelAuthoritative ? fineSubstepCount + 2 : 1
  );
  const migratedLawProducerMappings = twoLevelAuthoritative
    ? [
        ...(lawReactionsEnabled ? [{
          producerId:
            'schroeder-hierarchy:two-level-post-mechanics-reaction-discovery-proposal',
          consumerIds: ['reaction-discovery']
        }] : []),
        ...(lawThermalEnabled ? [{
          producerId:
            'schroeder-hierarchy:two-level-post-mechanics-thermal-proposal',
          consumerIds: ['thermal-conduction', 'thermal-radiation']
        }] : [])
      ]
    : [
        {
          producerId: 'mls-mpm-resident:spatialMechanicalProposal',
          consumerIds: [
            'pressure-contact-interface',
            'separation',
            'local-material-interface'
          ]
        },
        ...(lawReactionsEnabled ? [{
          producerId: 'mls-mpm-resident:spatialReactionDiscoveryProposal',
          consumerIds: ['reaction-discovery']
        }] : []),
        ...(lawThermalEnabled ? [{
          producerId: 'mls-mpm-resident:spatialThermalProposal',
          consumerIds: ['thermal-conduction', 'thermal-radiation']
        }] : [])
      ];
  const exactProducerCountPerBatch = new Map([
    ['schroeder-spatial-key-emission', expectedGenerationCountPerBatch],
    ['webgpu-stable-radix-sort', expectedGenerationCountPerBatch],
    ['webgpu-sorted-unique', expectedGenerationCountPerBatch],
    ['schroeder-spatial-derived-view-build', expectedGenerationCountPerBatch],
    ['schroeder-spatial-aggregate-traversal',
      twoLevelAuthoritative ? batchStepCount : 0],
    ...(requireMigratedLawCoverage
      ? migratedLawProducerMappings.map(({ producerId }) => [
          producerId,
          batchStepCount
        ])
      : [])
  ]);
  const exactProducerSpanContract = new Map([
    ['schroeder-spatial-key-emission', {
      spanClass: 'same-production-command-encoder',
      markerSubmissionMode: 'same-production-command-encoder'
    }],
    ['webgpu-stable-radix-sort', {
      spanClass: 'same-grouped-production-compute-pass',
      markerSubmissionMode: 'same-production-command-encoder'
    }],
    ['webgpu-sorted-unique', {
      spanClass: 'same-grouped-production-compute-pass',
      markerSubmissionMode: 'same-production-command-encoder'
    }],
    ['schroeder-spatial-derived-view-build', {
      spanClass: 'same-production-command-encoder',
      markerSubmissionMode: 'same-production-command-encoder'
    }],
    ['schroeder-spatial-aggregate-traversal', {
      spanClass: 'same-production-command-encoder',
      markerSubmissionMode: 'same-production-command-encoder'
    }],
    ...migratedLawProducerMappings.map(({ producerId }) => [
      producerId,
      {
        spanClass: twoLevelAuthoritative
          ? 'hierarchy-queue-stage'
          : 'resident-queue-stage',
        markerSubmissionMode: 'same-queue-boundary-submissions'
      }
    ])
  ]);
  const batchEvidence = residentMetrics.map((metric) => {
    const evidence = metric?.probeResidentBatchTiming?.gpuStageTimestamps
      ?? null;
    const spans = Array.isArray(evidence?.spans) ? evidence.spans : [];
    const residentTransactions = Array.isArray(
      metric?.residentSteps?.schroederSpatialEpochTransactionSummaries
    )
      ? metric.residentSteps.schroederSpatialEpochTransactionSummaries
      : [];
    const authenticReleasedTransactionCount = residentTransactions.filter(
      (transaction) => (
        transaction?.schema
          === 'peercompute.ulg.schroeder-spatial-epoch-transaction-summary.v0'
        && transaction?.status
          === 'schroeder-spatial-epoch-transaction-released'
        && transaction?.state === 'released'
        && typeof transaction?.deviceId === 'string'
        && transaction.deviceId.length > 0
        && exactNonNegativeIntegerOrNull(transaction?.generationId) !== null
        && exactEpochIdentityOrNull(transaction?.epochIdentity) !== null
      )
    ).length;
    const releasedTransactionBatchComplete = Boolean(
      metric?.schroederTelemetry?.requested === true
      && metric?.schroederTelemetry?.active === true
      && metric?.residentSteps?.status === 'resident-steps-executed'
      && exactNonNegativeIntegerOrNull(
        metric?.residentSteps?.completedStepCount
      ) === batchStepCount
      && residentTransactions.length === batchStepCount
      && authenticReleasedTransactionCount === batchStepCount
    );
    const queryIndices = [];
    const normalizedSpans = spans.map((span) => {
      let timestampDifferenceNs = null;
      try {
        const start = BigInt(span?.startTimestampNs);
        const end = BigInt(span?.endTimestampNs);
        const difference = end - start;
        if (difference > 0n && difference <= BigInt(Number.MAX_SAFE_INTEGER)) {
          timestampDifferenceNs = Number(difference);
        }
      } catch {
        timestampDifferenceNs = null;
      }
      const durationNs = numberOrNull(span?.durationNs);
      const durationMs = numberOrNull(span?.durationMs);
      const startQueryIndex = exactNonNegativeIntegerOrNull(
        span?.startQueryIndex
      );
      const endQueryIndex = exactNonNegativeIntegerOrNull(span?.endQueryIndex);
      if (startQueryIndex !== null) queryIndices.push(startQueryIndex);
      if (endQueryIndex !== null) queryIndices.push(endQueryIndex);
      const queueBoundarySpan = span?.markerSubmissionMode
        === 'same-queue-boundary-submissions';
      const measurementKind = span?.measurementKind ?? null;
      const intervalSemantics = span?.intervalSemantics ?? null;
      const intervalContractComplete = queueBoundarySpan
        ? (
            measurementKind === queueMeasurementKind
            && intervalSemantics === queueIntervalSemantics
          )
        : (
            span?.markerSubmissionMode
              === 'same-production-command-encoder'
            && measurementKind === encoderMeasurementKind
            && intervalSemantics === encoderSpanSemantics
          );
      const valid = Boolean(
        span?.schema === 'peercompute.ulg.sph-probe-gpu-stage-span.v0'
        && span?.valid === true
        && typeof span?.producerId === 'string'
        && span.producerId.length > 0
        && Number.isSafeInteger(durationNs)
        && durationNs > 0
        && durationNs === timestampDifferenceNs
        && Number.isFinite(durationMs)
        && Math.abs(durationMs - durationNs / 1e6)
          <= Math.max(1e-9, Math.abs(durationNs / 1e6) * 1e-12)
        && startQueryIndex !== null
        && endQueryIndex !== null
        && endQueryIndex > startQueryIndex
        && intervalContractComplete
      );
      return {
        producerId: span?.producerId ?? null,
        stage: span?.stage ?? null,
        spanClass: span?.spanClass ?? null,
        markerSubmissionMode: span?.markerSubmissionMode ?? null,
        measurementKind,
        intervalSemantics,
        intervalContractComplete,
        generationId: exactNonNegativeIntegerOrNull(span?.generationId),
        durationNs,
        durationMs,
        startQueryIndex,
        endQueryIndex,
        valid
      };
    });
    const producerCounts = Object.fromEntries([...exactProducerCountPerBatch]
      .map(([producerId]) => [
        producerId,
        normalizedSpans.filter((span) => span.producerId === producerId).length
      ]));
    const exactProducerCoverageComplete = [...exactProducerCountPerBatch]
      .every(([producerId, expectedCount]) => (
        producerCounts[producerId] === expectedCount
      ));
    const exactProducerContractComplete = [...exactProducerCountPerBatch]
      .every(([producerId, expectedCount]) => {
        if (expectedCount === 0) return true;
        const contract = exactProducerSpanContract.get(producerId);
        return Boolean(contract) && normalizedSpans
          .filter((span) => span.producerId === producerId)
          .every((span) => (
            span.spanClass === contract.spanClass
            && span.markerSubmissionMode === contract.markerSubmissionMode
          ));
      });
    const indicesContiguous = queryIndices.length === spans.length * 2
      && new Set(queryIndices).size === queryIndices.length
      && [...queryIndices].sort((a, b) => a - b).every(
        (value, index) => value === index
      );
    const queryCount = exactNonNegativeIntegerOrNull(evidence?.queryCount);
    const queryCapacity = exactNonNegativeIntegerOrNull(
      evidence?.queryCapacity
    );
    const requiredQueryCapacity = exactNonNegativeIntegerOrNull(
      evidence?.requiredQueryCapacity
    );
    const queryBudgetPerStep = exactNonNegativeIntegerOrNull(
      evidence?.queryBudgetPerStep
    );
    const configuredBatchStepCount = exactNonNegativeIntegerOrNull(
      evidence?.configuredBatchStepCount
    );
    const configuredFineSubstepCount = exactNonNegativeIntegerOrNull(
      evidence?.configuredFineSubstepCount
    );
    const maxQueryCapacity = exactNonNegativeIntegerOrNull(
      evidence?.maxQueryCapacity
    );
    const queueBoundarySpanCount = normalizedSpans.filter(
      (span) => (
        span.markerSubmissionMode === 'same-queue-boundary-submissions'
      )
    ).length;
    const expectedMarkerSubmissionCount = queueBoundarySpanCount * 2;
    const markerSubmissionCount = exactNonNegativeIntegerOrNull(
      evidence?.markerSubmissionCount
    );
    const requiredFeatures = Array.isArray(evidence?.requiredFeatures)
      ? evidence.requiredFeatures.map(String)
      : [];
    const enabledFeatures = Array.isArray(evidence?.enabledFeatures)
      ? evidence.enabledFeatures.map(String)
      : [];
    const timestampCapabilityComplete = Boolean(
      evidence?.timestampProfilingRequested === true
      && evidence?.timestampQuerySupported === true
      && requiredFeatures.includes('timestamp-query')
      && enabledFeatures.includes('timestamp-query')
    );
    const markerSemanticsComplete = Boolean(
      evidence?.markerEncodingMode === markerEncodingMode
      && evidence?.encoderSpanSemantics === encoderSpanSemantics
      && evidence?.queueIntervalSemantics === queueIntervalSemantics
      && normalizedSpans.every((span) => span.intervalContractComplete)
    );
    const queryCapacityComplete = Boolean(
      queryCount !== null
      && queryCapacity !== null
      && queryCapacity >= queryCount
      && requiredQueryCapacity !== null
      && requiredQueryCapacity > 0
      && queryCapacity >= requiredQueryCapacity
      && queryBudgetPerStep !== null
      && queryBudgetPerStep > 0
      && configuredBatchStepCount === batchStepCount
      && evidence?.twoLevelConfigured === twoLevelAuthoritative
      && (
        !twoLevelAuthoritative
        || configuredFineSubstepCount === fineSubstepCount
      )
      && maxQueryCapacity !== null
      && maxQueryCapacity >= queryCapacity
      && evidence?.queryCapacityPreflightStatus
        === 'gpu-stage-timestamp-query-capacity-ready'
      && evidence?.queryCapacityExhausted === false
    );
    const markerSubmissionCoverageComplete =
      markerSubmissionCount === expectedMarkerSubmissionCount;
    const complete = Boolean(
      evidence?.schema === 'peercompute.ulg.sph-probe-gpu-stage-timestamps.v0'
      && evidence?.status === 'gpu-stage-timestamps-complete'
      && evidence?.requested === true
      && Number(evidence?.batchIndex) === Number(metric?.batchIndex)
      && evidence?.timestampUnit === 'nanoseconds'
      && timestampCapabilityComplete
      && markerSemanticsComplete
      && queryCapacityComplete
      && evidence?.productionPassGroupingPreserved === true
      && queryCount === spans.length * 2
      && Number(evidence?.spanCount) === spans.length
      && Number(evidence?.validSpanCount) === spans.length
      && Number(evidence?.invalidSpanCount) === 0
      && Number(evidence?.resolveSubmissionCount) === 1
      && Number(evidence?.mapAsyncCount) === 1
      && Number(evidence?.queryResolveByteLength) === spans.length * 16
      && Number(evidence?.mappedReadbackByteLength) === spans.length * 16
      && markerSubmissionCoverageComplete
      && spans.length > 0
      && normalizedSpans.every((span) => span.valid)
      && indicesContiguous
      && exactProducerCoverageComplete
      && exactProducerContractComplete
      && releasedTransactionBatchComplete
    );
    return {
      batchIndex: Number(metric?.batchIndex),
      status: evidence?.status ?? 'missing',
      complete,
      releasedTransactionBatchComplete,
      releasedTransactionCount: residentTransactions.length,
      authenticReleasedTransactionCount,
      spanCount: spans.length,
      queryCount,
      queryCapacity,
      requiredQueryCapacity,
      queryBudgetPerStep,
      configuredBatchStepCount,
      twoLevelConfigured: evidence?.twoLevelConfigured ?? null,
      configuredFineSubstepCount,
      maxQueryCapacity,
      queryCapacityComplete,
      queryCapacityPreflightStatus:
        evidence?.queryCapacityPreflightStatus ?? null,
      queryCapacityExhausted: evidence?.queryCapacityExhausted ?? null,
      timestampCapabilityComplete,
      timestampProfilingRequested:
        evidence?.timestampProfilingRequested ?? null,
      timestampQuerySupported: evidence?.timestampQuerySupported ?? null,
      requiredFeatures,
      enabledFeatures,
      markerEncodingMode: evidence?.markerEncodingMode ?? null,
      encoderSpanSemantics: evidence?.encoderSpanSemantics ?? null,
      queueIntervalSemantics: evidence?.queueIntervalSemantics ?? null,
      markerSemanticsComplete,
      markerSubmissionCount,
      expectedMarkerSubmissionCount,
      queueBoundarySpanCount,
      markerSubmissionCoverageComplete,
      producerCounts,
      exactProducerCoverageComplete,
      exactProducerContractComplete,
      spans: normalizedSpans
    };
  });
  const expectedIndices = Number.isInteger(expectedBatchCount)
    ? Array.from({ length: expectedBatchCount }, (_, index) => index + 1)
    : [];
  const observedIndices = batchEvidence.map((batch) => batch.batchIndex);
  const batchCoverageComplete = expectedIndices.length > 0
    && batchEvidence.length === expectedIndices.length
    && observedIndices.every((value, index) => value === expectedIndices[index])
    && batchEvidence.every((batch) => batch.complete);
  const measuredBatches = batchEvidence.slice(normalizedWarmupBatchCount);
  const measurementCoverageComplete = measuredBatches.length > 0
    && measuredBatches.every((batch) => batch.complete);
  const allRecordedSpans = batchEvidence.flatMap((batch) => batch.spans);
  const measuredSpans = measuredBatches.flatMap((batch) => batch.spans);
  const producerIds = [...new Set(measuredSpans.map((span) => span.producerId))]
    .filter(Boolean)
    .sort();
  const producerSummaries = producerIds.map((producerId) => {
    const samples = measuredSpans.filter(
      (span) => span.producerId === producerId
    );
    const durationsMs = samples.map((span) => span.durationMs);
    return {
      producerId,
      sampleCount: samples.length,
      p50Ms: percentile(durationsMs, 0.5),
      p95Ms: percentile(durationsMs, 0.95),
      spanClasses: [...new Set(samples.map((span) => span.spanClass))],
      markerSubmissionModes: [
        ...new Set(samples.map((span) => span.markerSubmissionMode))
      ],
      measurementKinds: [
        ...new Set(samples.map((span) => span.measurementKind))
      ],
      intervalSemantics: [
        ...new Set(samples.map((span) => span.intervalSemantics))
      ]
    };
  });
  const migratedLawConsumerMappings = migratedLawProducerMappings.map((mapping) => {
    const summary = producerSummaries.find(
      (candidate) => candidate.producerId === mapping.producerId
    ) ?? null;
    const expectedSampleCount = measuredBatches.length * batchStepCount;
    return {
      producerId: mapping.producerId,
      consumerIds: [...mapping.consumerIds],
      sharedProducerSpan: mapping.consumerIds.length > 1,
      aggregationRule: mapping.consumerIds.length > 1
        ? 'count-shared-producer-once-never-sum-per-consumer-aliases'
        : 'count-producer-once',
      expectedSampleCount,
      sampleCount: summary?.sampleCount ?? 0,
      p50Ms: summary?.p50Ms ?? null,
      p95Ms: summary?.p95Ms ?? null,
      coverageComplete: summary?.sampleCount === expectedSampleCount
    };
  });
  const migratedLawCoverageComplete = migratedLawConsumerMappings.every(
    (mapping) => mapping.coverageComplete
  );
  const stageCoverageComplete = batchCoverageComplete
    && measurementCoverageComplete
    && releasedTransactionEvidenceComplete
    && (!requireMigratedLawCoverage || migratedLawCoverageComplete);
  return {
    schema,
    status: stageCoverageComplete ? 'complete' : 'incomplete',
    requested: true,
    expectedBatchCount: expectedBatchCount ?? 0,
    observedBatchCount: batchEvidence.length,
    warmupBatchCount: normalizedWarmupBatchCount,
    measuredBatchCount: measuredBatches.length,
    expectedGenerationCountPerBatch,
    expectedTraversalCountPerBatch:
      twoLevelAuthoritative ? batchStepCount : 0,
    batchCoverageComplete,
    measurementCoverageComplete,
    stageCoverageComplete,
    releasedTransactionEvidenceComplete,
    releasedTransactionEvidence: {
      status: releasedTransactionEvidenceComplete
        ? 'authentic-released-transaction-evidence-complete'
        : 'authentic-released-transaction-evidence-incomplete',
      authenticSummaryCoverageComplete:
        authenticReleasedTransactionSummaryCoverageComplete,
      transactionCoverageComplete:
        releasedTransactionAggregate.transactionCoverageComplete,
      transactionLifecycleCoverageComplete:
        releasedTransactionAggregate.transactionLifecycleCoverageComplete,
      generationCoverageComplete:
        releasedTransactionAggregate.generationCoverageComplete,
      artifactLedgerCoverageComplete:
        releasedTransactionAggregate.artifactLedgerCoverageComplete,
      twoLevelMechanicsCoverageComplete:
        releasedTransactionAggregate.twoLevelMechanicsCoverageComplete,
      expectedTransactionCount:
        releasedTransactionAggregate.expectedStepCount,
      observedTransactionCount:
        releasedTransactionAggregate.transactionMountedCount
    },
    migratedLawCoverageRequired: requireMigratedLawCoverage,
    migratedLawCoverageComplete,
    requiredMigratedLawConsumerIds: requireMigratedLawCoverage
      ? [...new Set(migratedLawProducerMappings.flatMap(
          (mapping) => mapping.consumerIds
        ))]
      : [],
    migratedLawConsumerMappings,
    percentileEstimator: 'nearest-rank-ceil-nq',
    profilingOverhead: {
      markerSubmissionCount: batchEvidence.reduce(
        (sum, batch) => sum + (batch.markerSubmissionCount ?? 0),
        0
      ),
      queryResolveByteLength: allRecordedSpans.length * 16,
      mappedReadbackByteLength: allRecordedSpans.length * 16,
      mapAsyncCount: batchEvidence.length,
      measuredQueryResolveByteLength: measuredSpans.length * 16,
      measuredMappedReadbackByteLength: measuredSpans.length * 16,
      measuredMapAsyncCount: measuredBatches.length,
      productionHotStateReadback: false,
      classification: 'benchmark-only-stage-timestamp-readback'
    },
    producerSummaries,
    batches: batchEvidence
  };
}

function finitePositiveNumberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function median(values) {
  const sorted = (Array.isArray(values) ? values : [])
    .map(Number)
    .filter(Number.isFinite)
    .sort((left, right) => left - right);
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function pairedTimestampArmEvidence(arm, {
  requiredWarmupBatchCount,
  requiredMeasuredSampleCount
}) {
  const timestamp = arm?.gpuTimestampIntervalEvidence
    ?? arm?.gpuTimestampEvidence
    ?? null;
  const p50Ms = finitePositiveNumberOrNull(timestamp?.p50Ms);
  const p95Ms = finitePositiveNumberOrNull(timestamp?.p95Ms);
  const warmupBatchCount = exactNonNegativeIntegerOrNull(
    timestamp?.warmupBatchCount
  );
  const measuredSampleCount = exactNonNegativeIntegerOrNull(
    timestamp?.measuredSampleCount
  );
  const complete = Boolean(
    timestamp?.schema
      === 'peercompute.ulg.sph-performance-gpu-queue-interval-evidence.v0'
    && timestamp?.status === 'complete'
    && timestamp?.requested === true
    && timestamp?.batchCoverageComplete === true
    && timestamp?.measurementCoverageComplete === true
    && timestamp?.percentileEstimator === 'nearest-rank-ceil-nq'
    && warmupBatchCount !== null
    && warmupBatchCount >= requiredWarmupBatchCount
    && measuredSampleCount !== null
    && measuredSampleCount >= requiredMeasuredSampleCount
    && p50Ms !== null
    && p95Ms !== null
  );
  return {
    complete,
    status: timestamp?.status ?? 'missing',
    warmupBatchCount,
    measuredSampleCount,
    p50Ms,
    p95Ms,
    percentileEstimator: timestamp?.percentileEstimator ?? null
  };
}

function pairedTimestampProvenanceEvidence(arm) {
  const provenance = arm?.sourceProvenance ?? null;
  const gitHead = typeof provenance?.gitHead === 'string'
    ? provenance.gitHead.trim()
    : '';
  const sourceFingerprintBefore = typeof provenance?.sourceFingerprintBefore
    === 'string'
    ? provenance.sourceFingerprintBefore.trim()
    : '';
  const sourceFingerprintAfter = typeof provenance?.sourceFingerprintAfter
    === 'string'
    ? provenance.sourceFingerprintAfter.trim()
    : '';
  const commonConfigSignature = typeof provenance?.commonConfigSignature
    === 'string'
    ? provenance.commonConfigSignature.trim()
    : '';
  const armConfigSignature = typeof provenance?.armConfigSignature === 'string'
    ? provenance.armConfigSignature.trim()
    : '';
  const complete = Boolean(
    /^[0-9a-f]{40}$/i.test(gitHead)
    && /^[0-9a-f]{64}$/i.test(sourceFingerprintBefore)
    && sourceFingerprintBefore === sourceFingerprintAfter
    && /^[0-9a-f]{64}$/i.test(commonConfigSignature)
    && /^[0-9a-f]{64}$/i.test(armConfigSignature)
  );
  return {
    complete,
    gitHead: gitHead || null,
    sourceFingerprintBefore: sourceFingerprintBefore || null,
    sourceFingerprintAfter: sourceFingerprintAfter || null,
    commonConfigSignature: commonConfigSignature || null,
    armConfigSignature: armConfigSignature || null,
    worktreeDirtyBefore: provenance?.worktreeDirtyBefore ?? null,
    worktreeDirtyAfter: provenance?.worktreeDirtyAfter ?? null
  };
}

/**
 * Aggregate independent paired browser/device runs without treating sequential
 * batches from one probe as independent samples.  This is intentionally pure:
 * the campaign runner owns process/browser isolation and immutable source
 * receipts, while this function owns the fail-closed statistical contract.
 */
export function summarizePairedGpuTimestampRuns({
  runs = [],
  requiredRunCount = 3,
  requiredWarmupBatchCount = 4,
  requiredMeasuredSampleCount = 9,
  expectedRunOrders = ['AB', 'BA', 'AB'],
  maxRegressionPercent = 5,
  applyRegressionGate = true,
  requireSameSource = true,
  requireBaselineControl = true,
  requireCandidateAuthoritative = true
} = {}) {
  const normalizedRequiredRunCount = Math.max(
    1,
    Math.round(Number(requiredRunCount) || 3)
  );
  const normalizedRequiredWarmups = Math.max(
    0,
    Math.round(Number(requiredWarmupBatchCount) || 0)
  );
  const normalizedRequiredMeasurements = Math.max(
    1,
    Math.round(Number(requiredMeasuredSampleCount) || 9)
  );
  const normalizedExpectedOrders = Array.from(
    { length: normalizedRequiredRunCount },
    (_, index) => String(
      expectedRunOrders[index]
        ?? (index % 2 === 0 ? 'AB' : 'BA')
    ).toUpperCase()
  );
  const normalizedRuns = (Array.isArray(runs) ? runs : []).map(
    (run, index) => {
      const baselineTimestamp = pairedTimestampArmEvidence(run?.baseline, {
        requiredWarmupBatchCount: normalizedRequiredWarmups,
        requiredMeasuredSampleCount: normalizedRequiredMeasurements
      });
      const candidateTimestamp = pairedTimestampArmEvidence(run?.candidate, {
        requiredWarmupBatchCount: normalizedRequiredWarmups,
        requiredMeasuredSampleCount: normalizedRequiredMeasurements
      });
      const baselineProvenance = pairedTimestampProvenanceEvidence(
        run?.baseline
      );
      const candidateProvenance = pairedTimestampProvenanceEvidence(
        run?.candidate
      );
      const baselineScenario = run?.baseline?.scenario ?? null;
      const candidateScenario = run?.candidate?.scenario ?? null;
      const baselineControlComplete = requireBaselineControl !== true || Boolean(
        baselineScenario?.schroederSimulationConfiguredRequested === true
        && baselineScenario?.schroederTransactionCoverageComplete === true
        && baselineScenario?.schroederTwoLevelMechanicsConfiguredRequested
          === false
      );
      const candidateAuthoritativeComplete =
        requireCandidateAuthoritative !== true || Boolean(
          candidateScenario?.schroederSimulationConfiguredRequested === true
          && candidateScenario?.schroederTransactionCoverageComplete === true
          && candidateScenario?.schroederTwoLevelMechanicsConfiguredRequested
            === true
          && candidateScenario?.schroederTwoLevelMechanicsRequestedObserved
            === true
          && candidateScenario?.schroederTwoLevelMechanicsCoverageComplete
            === true
          && candidateScenario?.schroederTwoLevelMechanicsAuthorityRequested
            === 'authoritative'
          && candidateScenario?.schroederTwoLevelMechanicsAuthorityObserved
            === 'authoritative'
          && candidateScenario?.schroederTwoLevelAuthoritativeCommitVerified
            === true
        );
      const p50Ratio = baselineTimestamp.p50Ms !== null
        && candidateTimestamp.p50Ms !== null
        ? candidateTimestamp.p50Ms / baselineTimestamp.p50Ms
        : null;
      const p95Ratio = baselineTimestamp.p95Ms !== null
        && candidateTimestamp.p95Ms !== null
        ? candidateTimestamp.p95Ms / baselineTimestamp.p95Ms
        : null;
      return {
        runIndex: index + 1,
        runId: String(run?.runId ?? ''),
        order: String(run?.order ?? '').toUpperCase(),
        baselineTimestamp,
        candidateTimestamp,
        baselineProvenance,
        candidateProvenance,
        baselineControlComplete,
        candidateAuthoritativeComplete,
        p50Ratio,
        p95Ratio,
        p50DeltaPercent: p50Ratio === null ? null : (p50Ratio - 1) * 100,
        p95DeltaPercent: p95Ratio === null ? null : (p95Ratio - 1) * 100
      };
    }
  );
  const blockers = [];
  if (normalizedRuns.length !== normalizedRequiredRunCount) {
    blockers.push('independent-run-count-mismatch');
  }
  const runIds = normalizedRuns.map((run) => run.runId);
  if (
    runIds.some((runId) => !runId)
    || new Set(runIds).size !== runIds.length
  ) {
    blockers.push('run-identities-missing-or-duplicated');
  }
  if (
    normalizedRuns.some((run, index) => (
      run.order !== normalizedExpectedOrders[index]
    ))
  ) {
    blockers.push('run-order-not-ab-ba-alternating');
  }
  if (normalizedRuns.some((run) => !run.baselineTimestamp.complete)) {
    blockers.push('baseline-timestamp-evidence-incomplete');
  }
  if (normalizedRuns.some((run) => !run.candidateTimestamp.complete)) {
    blockers.push('candidate-timestamp-evidence-incomplete');
  }
  if (normalizedRuns.some((run) => !run.baselineProvenance.complete)) {
    blockers.push('baseline-source-provenance-incomplete');
  }
  if (normalizedRuns.some((run) => !run.candidateProvenance.complete)) {
    blockers.push('candidate-source-provenance-incomplete');
  }
  if (normalizedRuns.some((run) => !run.baselineControlComplete)) {
    blockers.push('baseline-control-route-incomplete');
  }
  if (normalizedRuns.some((run) => !run.candidateAuthoritativeComplete)) {
    blockers.push('candidate-authoritative-route-incomplete');
  }
  const commonConfigSignatures = new Set(normalizedRuns.flatMap((run) => [
    run.baselineProvenance.commonConfigSignature,
    run.candidateProvenance.commonConfigSignature
  ]).filter(Boolean));
  if (commonConfigSignatures.size !== 1) {
    blockers.push('common-config-signature-mismatch');
  }
  const baselineSourceIdentities = new Set(normalizedRuns.map((run) => (
    `${run.baselineProvenance.gitHead}:`
    + `${run.baselineProvenance.sourceFingerprintBefore}`
  )));
  const candidateSourceIdentities = new Set(normalizedRuns.map((run) => (
    `${run.candidateProvenance.gitHead}:`
    + `${run.candidateProvenance.sourceFingerprintBefore}`
  )));
  if (baselineSourceIdentities.size !== 1) {
    blockers.push('baseline-source-changed-between-runs');
  }
  if (candidateSourceIdentities.size !== 1) {
    blockers.push('candidate-source-changed-between-runs');
  }
  if (
    requireSameSource === true
    && (
      baselineSourceIdentities.size !== 1
      || candidateSourceIdentities.size !== 1
      || [...baselineSourceIdentities][0] !== [...candidateSourceIdentities][0]
    )
  ) {
    blockers.push('paired-arms-do-not-share-exact-source');
  }
  const p50Ratios = normalizedRuns.map((run) => run.p50Ratio)
    .filter((value) => Number.isFinite(value) && value > 0);
  const p95Ratios = normalizedRuns.map((run) => run.p95Ratio)
    .filter((value) => Number.isFinite(value) && value > 0);
  if (
    p50Ratios.length !== normalizedRequiredRunCount
    || p95Ratios.length !== normalizedRequiredRunCount
  ) {
    blockers.push('paired-ratio-coverage-incomplete');
  }
  const medianP50Ratio = median(p50Ratios);
  const medianP95Ratio = median(p95Ratios);
  const independentBaselineP50 = median(normalizedRuns.map(
    (run) => run.baselineTimestamp.p50Ms
  ));
  const independentCandidateP50 = median(normalizedRuns.map(
    (run) => run.candidateTimestamp.p50Ms
  ));
  const independentBaselineP95 = median(normalizedRuns.map(
    (run) => run.baselineTimestamp.p95Ms
  ));
  const independentCandidateP95 = median(normalizedRuns.map(
    (run) => run.candidateTimestamp.p95Ms
  ));
  const threshold = Number(maxRegressionPercent);
  const regressionThresholdPercent = Number.isFinite(threshold)
    ? threshold
    : 5;
  const medianP50DeltaPercent = medianP50Ratio === null
    ? null
    : (medianP50Ratio - 1) * 100;
  const medianP95DeltaPercent = medianP95Ratio === null
    ? null
    : (medianP95Ratio - 1) * 100;
  const p50WithinThreshold = medianP50DeltaPercent !== null
    && medianP50DeltaPercent <= regressionThresholdPercent;
  const p95WithinThreshold = medianP95DeltaPercent !== null
    && medianP95DeltaPercent <= regressionThresholdPercent;
  if (applyRegressionGate === true && !p50WithinThreshold) {
    blockers.push('paired-p50-regression-exceeds-threshold');
  }
  if (applyRegressionGate === true && !p95WithinThreshold) {
    blockers.push('paired-p95-regression-exceeds-threshold');
  }
  return {
    schema: 'peercompute.ulg.sph-paired-gpu-timestamp-campaign.v0',
    status: blockers.length === 0 ? 'pass' : 'fail',
    blockers,
    method: {
      independentRunCount: normalizedRequiredRunCount,
      requiredWarmupBatchCount: normalizedRequiredWarmups,
      requiredMeasuredSampleCount: normalizedRequiredMeasurements,
      expectedRunOrders: normalizedExpectedOrders,
      percentileEstimator: 'nearest-rank-ceil-nq',
      pairedAggregation: 'median-of-within-run-candidate-over-baseline-ratios',
      applyRegressionGate: applyRegressionGate === true,
      regressionThresholdPercent,
      requireSameSource: requireSameSource === true
    },
    runCount: normalizedRuns.length,
    runs: normalizedRuns,
    paired: {
      p50Ratios,
      p95Ratios,
      medianP50Ratio,
      medianP95Ratio,
      medianP50DeltaPercent,
      medianP95DeltaPercent,
      p50WithinThreshold,
      p95WithinThreshold
    },
    independentMedianCrossCheck: {
      baselineP50Ms: independentBaselineP50,
      candidateP50Ms: independentCandidateP50,
      p50Ratio: independentBaselineP50 && independentCandidateP50
        ? independentCandidateP50 / independentBaselineP50
        : null,
      baselineP95Ms: independentBaselineP95,
      candidateP95Ms: independentCandidateP95,
      p95Ratio: independentBaselineP95 && independentCandidateP95
        ? independentCandidateP95 / independentBaselineP95
        : null
    }
  };
}

function pairedThroughputProvenanceEvidence(arm) {
  const basic = pairedTimestampProvenanceEvidence(arm);
  const provenance = arm?.sourceProvenance ?? null;
  const worktreeStatusHashBefore = typeof provenance?.worktreeStatusHashBefore
    === 'string'
    ? provenance.worktreeStatusHashBefore.trim()
    : '';
  const worktreeStatusHashAfter = typeof provenance?.worktreeStatusHashAfter
    === 'string'
    ? provenance.worktreeStatusHashAfter.trim()
    : '';
  const trackedAndUntrackedFileCountBefore = exactNonNegativeIntegerOrNull(
    provenance?.trackedAndUntrackedFileCountBefore
  );
  const trackedAndUntrackedFileCountAfter = exactNonNegativeIntegerOrNull(
    provenance?.trackedAndUntrackedFileCountAfter
  );
  const complete = Boolean(
    basic.complete
    && /^[0-9a-f]{64}$/i.test(worktreeStatusHashBefore)
    && worktreeStatusHashBefore === worktreeStatusHashAfter
    && provenance?.worktreeDirtyBefore
      === provenance?.worktreeDirtyAfter
    && trackedAndUntrackedFileCountBefore !== null
    && trackedAndUntrackedFileCountBefore
      === trackedAndUntrackedFileCountAfter
  );
  return {
    ...basic,
    complete,
    worktreeStatusHashBefore: worktreeStatusHashBefore || null,
    worktreeStatusHashAfter: worktreeStatusHashAfter || null,
    trackedAndUntrackedFileCountBefore,
    trackedAndUntrackedFileCountAfter
  };
}

const REACTION_STEP_HISTORICAL_PRODUCER_ID =
  'schroeder-hierarchy:two-level-post-mechanics-reactionStep';
const REACTION_DISCOVERY_HISTORICAL_PRODUCER_ID =
  'schroeder-hierarchy:two-level-post-mechanics-reaction-discovery-proposal';
const REACTION_PLACEMENT_SERIAL_PRODUCER_ID =
  'sph-reaction-summary:product-event-placement';
const REACTION_PLACEMENT_SEGMENTED_PRODUCER_PREFIX =
  `${REACTION_PLACEMENT_SERIAL_PRODUCER_ID}:`;

function exactStringSet(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(String))]
    .sort();
}

function exactBenchmarkScenarioUrlEvidence(scenario) {
  let params = null;
  try {
    params = new URL(
      String(scenario?.scenarioUrl || ''),
      'https://benchmark.invalid'
    ).searchParams;
  } catch {
    params = null;
  }
  const exactParams = {
    drop: 'na',
    base: 'h2o',
    dropt: '300',
    baset: '300',
    dropn: '8',
    basen: '8',
    mech: 'mlsmpm',
    ss: '1',
    schroederLevel: '0',
    schroederMaxLevel: '1',
    schroederCrossLevelCoupling: '1',
    schroederTwoLevel: '1',
    schroederTwoLevelAuthority: 'authoritative',
    schroederTwoLevelSubsteps: '2',
    residentGpuTimestampProfile: '1',
    lawr: '1'
  };
  const observedParams = Object.fromEntries(Object.keys(exactParams).map(
    (key) => [key, params?.get(key) ?? null]
  ));
  return {
    complete: Boolean(
      params
      && Object.entries(exactParams).every(
        ([key, expected]) => params.get(key) === expected
      )
    ),
    expectedParams: exactParams,
    observedParams
  };
}

function pairedGpuStageProducerArmEvidence(arm, {
  producerId,
  requiredWarmupBatchCount,
  requiredMeasuredSampleCount,
  historicalBaseline = false
}) {
  const scenario = arm?.scenario ?? null;
  const evidence = arm?.gpuStageTimestampEvidence
    ?? scenario?.gpuStageTimestampEvidence
    ?? null;
  const interval = arm?.gpuTimestampIntervalEvidence
    ?? scenario?.gpuTimestampIntervalEvidence
    ?? null;
  const expectedBatchCount = requiredWarmupBatchCount
    + requiredMeasuredSampleCount;
  const batches = Array.isArray(evidence?.batches) ? evidence.batches : [];
  const expectedBatchIndices = Array.from(
    { length: expectedBatchCount },
    (_, index) => index + 1
  );
  const batchShapeComplete = Boolean(
    exactNonNegativeIntegerOrNull(evidence?.expectedBatchCount)
      === expectedBatchCount
    && exactNonNegativeIntegerOrNull(evidence?.observedBatchCount)
      === expectedBatchCount
    && exactNonNegativeIntegerOrNull(evidence?.warmupBatchCount)
      === requiredWarmupBatchCount
    && exactNonNegativeIntegerOrNull(evidence?.measuredBatchCount)
      === requiredMeasuredSampleCount
    && batches.length === expectedBatchCount
    && batches.every((batch, index) => (
      exactNonNegativeIntegerOrNull(batch?.batchIndex)
        === expectedBatchIndices[index]
      && batch?.complete === true
    ))
  );
  const measuredBatches = batchShapeComplete
    ? batches.slice(requiredWarmupBatchCount)
    : [];
  const measuredTargetSpans = measuredBatches.flatMap((batch) => (
    (Array.isArray(batch?.spans) ? batch.spans : []).filter(
      (span) => span?.producerId === producerId
    )
  ));
  const targetSpanCoverageComplete = Boolean(
    measuredBatches.length === requiredMeasuredSampleCount
    && measuredBatches.every((batch) => {
      const matching = (Array.isArray(batch?.spans) ? batch.spans : [])
        .filter((span) => span?.producerId === producerId);
      return matching.length === 1
        && matching[0]?.valid === true
        && matching[0]?.spanClass === 'hierarchy-queue-stage'
        && matching[0]?.markerSubmissionMode
          === 'same-queue-boundary-submissions'
        && finitePositiveNumberOrNull(matching[0]?.durationMs) !== null;
    })
  );
  const measuredDurationsMs = targetSpanCoverageComplete
    ? measuredTargetSpans.map((span) => Number(span.durationMs))
    : [];
  const recomputedP50Ms = percentile(measuredDurationsMs, 0.5);
  const recomputedP95Ms = percentile(measuredDurationsMs, 0.95);
  const producerSummaries = Array.isArray(evidence?.producerSummaries)
    ? evidence.producerSummaries
    : [];
  const targetSummaries = producerSummaries.filter(
    (summary) => summary?.producerId === producerId
  );
  const targetSummary = targetSummaries.length === 1
    ? targetSummaries[0]
    : null;
  const summaryP50Ms = finitePositiveNumberOrNull(targetSummary?.p50Ms);
  const summaryP95Ms = finitePositiveNumberOrNull(targetSummary?.p95Ms);
  const summaryMatchesRawSpans = Boolean(
    targetSummary
    && exactNonNegativeIntegerOrNull(targetSummary.sampleCount)
      === requiredMeasuredSampleCount
    && exactStringSet(targetSummary.spanClasses).length === 1
    && exactStringSet(targetSummary.spanClasses)[0]
      === 'hierarchy-queue-stage'
    && exactStringSet(targetSummary.markerSubmissionModes).length === 1
    && exactStringSet(targetSummary.markerSubmissionModes)[0]
      === 'same-queue-boundary-submissions'
    && summaryP50Ms === recomputedP50Ms
    && summaryP95Ms === recomputedP95Ms
  );
  const discoveryMapping = Array.isArray(evidence?.migratedLawConsumerMappings)
    ? evidence.migratedLawConsumerMappings.filter((mapping) => (
      mapping?.producerId === REACTION_DISCOVERY_HISTORICAL_PRODUCER_ID
      && Array.isArray(mapping?.consumerIds)
      && mapping.consumerIds.length === 1
      && mapping.consumerIds[0] === 'reaction-discovery'
    ))
    : [];
  const historicalDiscoveryIdentityComplete = Boolean(
    discoveryMapping.length === 1
    && discoveryMapping[0]?.coverageComplete === true
    && exactNonNegativeIntegerOrNull(discoveryMapping[0]?.sampleCount)
      === requiredMeasuredSampleCount
    && exactNonNegativeIntegerOrNull(discoveryMapping[0]?.expectedSampleCount)
      === requiredMeasuredSampleCount
  );
  const segmentedPlacementSummaries = producerSummaries.filter((summary) => (
    typeof summary?.producerId === 'string'
    && summary.producerId.startsWith(
      REACTION_PLACEMENT_SEGMENTED_PRODUCER_PREFIX
    )
  ));
  const serialPlacementSummaryCount = producerSummaries.filter(
    (summary) => summary?.producerId
      === REACTION_PLACEMENT_SERIAL_PRODUCER_ID
  ).length;
  const measuredSegmentedPlacementBatches = measuredBatches.filter((batch) => (
    (Array.isArray(batch?.spans) ? batch.spans : []).some((span) => (
      typeof span?.producerId === 'string'
      && span.producerId.startsWith(
        REACTION_PLACEMENT_SEGMENTED_PRODUCER_PREFIX
      )
      && span?.valid === true
    ))
  )).length;
  const measuredSerialPlacementSpanCount = measuredBatches.reduce(
    (count, batch) => count + (
      Array.isArray(batch?.spans)
        ? batch.spans.filter((span) => (
          span?.producerId === REACTION_PLACEMENT_SERIAL_PRODUCER_ID
        )).length
        : 0
    ),
    0
  );
  const segmentedPlacementAttributionComplete = historicalBaseline
    ? true
    : Boolean(
      segmentedPlacementSummaries.length > 0
      && segmentedPlacementSummaries.every((summary) => (
        exactNonNegativeIntegerOrNull(summary?.sampleCount) !== null
        && summary.sampleCount > 0
      ))
      && serialPlacementSummaryCount === 0
      && measuredSegmentedPlacementBatches === requiredMeasuredSampleCount
      && measuredSerialPlacementSpanCount === 0
    );
  const intervalCoverageComplete = Boolean(
    interval?.schema
      === 'peercompute.ulg.sph-performance-gpu-queue-interval-evidence.v0'
    && interval?.status === 'complete'
    && interval?.requested === true
    && interval?.batchCoverageComplete === true
    && interval?.measurementCoverageComplete === true
    && interval?.percentileEstimator === 'nearest-rank-ceil-nq'
    && exactNonNegativeIntegerOrNull(interval?.warmupBatchCount)
      === requiredWarmupBatchCount
    && exactNonNegativeIntegerOrNull(interval?.measuredSampleCount)
      === requiredMeasuredSampleCount
  );
  const scenarioUrl = exactBenchmarkScenarioUrlEvidence(scenario);
  const performanceGateBlockers = Array.isArray(
    scenario?.performanceGate?.blockers
  ) ? [...scenario.performanceGate.blockers] : [];
  const routeComplete = Boolean(
    arm?.process?.exitCode === 0
    && arm?.reportStatus === 'complete'
    && arm?.reportPerformanceGateStatus === 'pass'
    && arm?.scenarioStatus === 'good'
    && scenario?.status === 'good'
    && scenario?.exitCode === 0
    && scenario?.probeMode === 'scene'
    && exactNonNegativeIntegerOrNull(scenario?.targetParticleCount) === 1000
    && exactNonNegativeIntegerOrNull(scenario?.actualParticleCount) === 1024
    && exactNonNegativeIntegerOrNull(scenario?.effectiveParticleCount) === 1024
    && exactNonNegativeIntegerOrNull(scenario?.batches)
      === expectedBatchCount
    && exactNonNegativeIntegerOrNull(scenario?.batchSteps) === 1
    && exactNonNegativeIntegerOrNull(scenario?.completedStepCount) === 1
    && scenario?.schroederSimulationConfiguredRequested === true
    && scenario?.schroederSimulationRequestedObserved === true
    && scenario?.schroederSimulationActive === true
    && scenario?.schroederTransactionCoverageComplete === true
    && exactNonNegativeIntegerOrNull(scenario?.schroederSelectedLevel) === 0
    && scenario?.schroederTwoLevelMechanicsConfiguredRequested === true
    && scenario?.schroederTwoLevelMechanicsRequestedObserved === true
    && scenario?.schroederTwoLevelMechanicsCoverageComplete === true
    && scenario?.schroederTwoLevelMechanicsAuthorityRequested
      === 'authoritative'
    && scenario?.schroederTwoLevelMechanicsAuthorityObserved
      === 'authoritative'
    && exactNonNegativeIntegerOrNull(
      scenario?.schroederTwoLevelFineSubstepCountRequested
    ) === 2
    && exactNonNegativeIntegerOrNull(
      scenario?.schroederTwoLevelFineSubstepCountObserved
    ) === 2
    && scenario?.schroederTwoLevelMechanicsStepStatus
      === 'schroeder-two-level-authoritative-step-executed'
    && scenario?.schroederTwoLevelAuthoritativeCommitVerified === true
    && scenario?.performanceGate?.status === 'pass'
    && performanceGateBlockers.length === 0
    && intervalCoverageComplete
    && scenarioUrl.complete
  );
  const complete = Boolean(
    evidence?.schema
      === 'peercompute.ulg.sph-performance-gpu-stage-evidence.v0'
    && evidence?.status === 'complete'
    && evidence?.requested === true
    && evidence?.batchCoverageComplete === true
    && evidence?.measurementCoverageComplete === true
    && evidence?.stageCoverageComplete === true
    && evidence?.migratedLawCoverageRequired === true
    && evidence?.migratedLawCoverageComplete === true
    && evidence?.percentileEstimator === 'nearest-rank-ceil-nq'
    && batchShapeComplete
    && targetSpanCoverageComplete
    && targetSummaries.length === 1
    && summaryMatchesRawSpans
    && historicalDiscoveryIdentityComplete
    && segmentedPlacementAttributionComplete
    && routeComplete
  );
  return {
    complete,
    historicalBaseline: historicalBaseline === true,
    status: evidence?.status ?? 'missing',
    producerId,
    targetProducerSummaryCount: targetSummaries.length,
    sampleCount: targetSummary?.sampleCount ?? null,
    p50Ms: recomputedP50Ms,
    p95Ms: recomputedP95Ms,
    summaryP50Ms,
    summaryP95Ms,
    batchShapeComplete,
    targetSpanCoverageComplete,
    summaryMatchesRawSpans,
    historicalDiscoveryIdentityComplete,
    segmentedPlacementAttributionComplete,
    segmentedPlacementProducerIds: segmentedPlacementSummaries.map(
      (summary) => summary.producerId
    ).sort(),
    serialPlacementSummaryCount,
    measuredSegmentedPlacementBatches,
    measuredSerialPlacementSpanCount,
    intervalCoverageComplete,
    routeComplete,
    scenarioUrl,
    performanceGateBlockers
  };
}

/**
 * Compare one exact GPU stage producer across three independent historical /
 * candidate process pairs.  Each arm must prove its raw per-batch span shape,
 * immutable source identity, and the exact authoritative SS route before any
 * duration is admitted to the regression math.
 */
export function summarizePairedGpuStageProducerRuns({
  runs = [],
  producerId = REACTION_STEP_HISTORICAL_PRODUCER_ID,
  expectedBaselineGitHead = null,
  requiredRunCount = 3,
  expectedRunOrders = ['AB', 'BA', 'AB'],
  requiredWarmupBatchCount = 4,
  requiredMeasuredSampleCount = 9,
  maxRegressionPercent = 5,
  maxCandidateMedianP50Ms = 363.575232
} = {}) {
  const normalizedRequiredRunCount = Math.max(
    1,
    Math.round(Number(requiredRunCount) || 3)
  );
  const normalizedRequiredWarmups = Math.max(
    0,
    Math.round(Number(requiredWarmupBatchCount) || 0)
  );
  const normalizedRequiredMeasurements = Math.max(
    1,
    Math.round(Number(requiredMeasuredSampleCount) || 9)
  );
  const normalizedExpectedOrders = Array.from(
    { length: normalizedRequiredRunCount },
    (_, index) => String(
      expectedRunOrders[index]
        ?? (index % 2 === 0 ? 'AB' : 'BA')
    ).toUpperCase()
  );
  const normalizedExpectedBaselineGitHead = String(
    expectedBaselineGitHead || ''
  ).trim();
  const regressionThresholdPercent = Number.isFinite(
    Number(maxRegressionPercent)
  ) ? Number(maxRegressionPercent) : 5;
  const maximumCandidateMedianP50Ms = finitePositiveNumberOrNull(
    maxCandidateMedianP50Ms
  );
  const normalizedRuns = (Array.isArray(runs) ? runs : []).map(
    (run, index) => {
      const baseline = pairedGpuStageProducerArmEvidence(run?.baseline, {
        producerId,
        requiredWarmupBatchCount: normalizedRequiredWarmups,
        requiredMeasuredSampleCount: normalizedRequiredMeasurements,
        historicalBaseline: true
      });
      const candidate = pairedGpuStageProducerArmEvidence(run?.candidate, {
        producerId,
        requiredWarmupBatchCount: normalizedRequiredWarmups,
        requiredMeasuredSampleCount: normalizedRequiredMeasurements,
        historicalBaseline: false
      });
      const baselineProvenance = pairedThroughputProvenanceEvidence(
        run?.baseline
      );
      const candidateProvenance = pairedThroughputProvenanceEvidence(
        run?.candidate
      );
      const p50Ratio = baseline.p50Ms && candidate.p50Ms
        ? candidate.p50Ms / baseline.p50Ms
        : null;
      const p95Ratio = baseline.p95Ms && candidate.p95Ms
        ? candidate.p95Ms / baseline.p95Ms
        : null;
      return {
        runIndex: index + 1,
        runId: String(run?.runId ?? ''),
        order: String(run?.order ?? '').toUpperCase(),
        baseline,
        candidate,
        baselineProvenance,
        candidateProvenance,
        p50Ratio,
        p95Ratio
      };
    }
  );
  const blockers = [];
  if (normalizedRuns.length !== normalizedRequiredRunCount) {
    blockers.push('independent-run-count-mismatch');
  }
  const runIds = normalizedRuns.map((run) => run.runId);
  if (runIds.some((runId) => !runId) || new Set(runIds).size !== runIds.length) {
    blockers.push('run-identities-missing-or-duplicated');
  }
  if (normalizedRuns.some((run, index) => (
    run.order !== normalizedExpectedOrders[index]
  ))) {
    blockers.push('run-order-not-ab-ba-alternating');
  }
  if (normalizedRuns.some((run) => !run.baseline.complete)) {
    blockers.push('baseline-stage-producer-evidence-incomplete');
  }
  if (normalizedRuns.some((run) => !run.candidate.complete)) {
    blockers.push('candidate-stage-producer-evidence-incomplete');
  }
  if (normalizedRuns.some((run) => !run.baseline.routeComplete)) {
    blockers.push('baseline-authoritative-route-incomplete');
  }
  if (normalizedRuns.some((run) => !run.candidate.routeComplete)) {
    blockers.push('candidate-authoritative-route-incomplete');
  }
  if (normalizedRuns.some((run) => (
    !run.candidate.segmentedPlacementAttributionComplete
  ))) {
    blockers.push('candidate-segmented-placement-attribution-incomplete');
  }
  if (normalizedRuns.some((run) => (
    run.candidate.serialPlacementSummaryCount > 0
    || run.candidate.measuredSerialPlacementSpanCount > 0
  ))) {
    blockers.push('candidate-serial-placement-producer-present');
  }
  if (normalizedRuns.some((run) => !run.baselineProvenance.complete)) {
    blockers.push('baseline-source-provenance-incomplete');
  }
  if (normalizedRuns.some((run) => !run.candidateProvenance.complete)) {
    blockers.push('candidate-source-provenance-incomplete');
  }
  if (normalizedRuns.some((run) => (
    run.baselineProvenance.worktreeDirtyBefore !== false
    || run.baselineProvenance.worktreeDirtyAfter !== false
  ))) {
    blockers.push('historical-baseline-worktree-not-clean');
  }
  const commonConfigSignatures = new Set(normalizedRuns.flatMap((run) => [
    run.baselineProvenance.commonConfigSignature,
    run.candidateProvenance.commonConfigSignature
  ]).filter(Boolean));
  if (commonConfigSignatures.size !== 1) {
    blockers.push('common-config-signature-mismatch');
  }
  const armConfigSignatures = new Set(normalizedRuns.flatMap((run) => [
    run.baselineProvenance.armConfigSignature,
    run.candidateProvenance.armConfigSignature
  ]).filter(Boolean));
  if (armConfigSignatures.size !== 1) {
    blockers.push('authoritative-route-signature-mismatch');
  }
  const baselineSourceIdentities = new Set(normalizedRuns.map((run) => (
    `${run.baselineProvenance.gitHead}:`
    + `${run.baselineProvenance.sourceFingerprintBefore}:`
    + `${run.baselineProvenance.worktreeStatusHashBefore}`
  )));
  const candidateSourceIdentities = new Set(normalizedRuns.map((run) => (
    `${run.candidateProvenance.gitHead}:`
    + `${run.candidateProvenance.sourceFingerprintBefore}:`
    + `${run.candidateProvenance.worktreeStatusHashBefore}`
  )));
  if (baselineSourceIdentities.size !== 1) {
    blockers.push('baseline-source-changed-between-runs');
  }
  if (candidateSourceIdentities.size !== 1) {
    blockers.push('candidate-source-changed-between-runs');
  }
  if (
    baselineSourceIdentities.size === 1
    && candidateSourceIdentities.size === 1
    && [...baselineSourceIdentities][0] === [...candidateSourceIdentities][0]
  ) {
    blockers.push('historical-and-candidate-source-identities-match');
  }
  if (
    !/^[0-9a-f]{40}$/i.test(normalizedExpectedBaselineGitHead)
    || normalizedRuns.some((run) => (
      run.baselineProvenance.gitHead !== normalizedExpectedBaselineGitHead
    ))
  ) {
    blockers.push('historical-baseline-git-head-mismatch');
  }
  const p50Ratios = normalizedRuns.map((run) => run.p50Ratio).filter(
    (value) => Number.isFinite(value) && value > 0
  );
  const p95Ratios = normalizedRuns.map((run) => run.p95Ratio).filter(
    (value) => Number.isFinite(value) && value > 0
  );
  if (
    p50Ratios.length !== normalizedRequiredRunCount
    || p95Ratios.length !== normalizedRequiredRunCount
  ) {
    blockers.push('paired-stage-producer-ratio-coverage-incomplete');
  }
  const pairedMedianP50Ratio = median(p50Ratios);
  const pairedMedianP95Ratio = median(p95Ratios);
  const baselineMedianP50Ms = median(normalizedRuns.map(
    (run) => run.baseline.p50Ms
  ));
  const candidateMedianP50Ms = median(normalizedRuns.map(
    (run) => run.candidate.p50Ms
  ));
  const baselineMedianP95Ms = median(normalizedRuns.map(
    (run) => run.baseline.p95Ms
  ));
  const candidateMedianP95Ms = median(normalizedRuns.map(
    (run) => run.candidate.p95Ms
  ));
  const independentP50Ratio = baselineMedianP50Ms && candidateMedianP50Ms
    ? candidateMedianP50Ms / baselineMedianP50Ms
    : null;
  const independentP95Ratio = baselineMedianP95Ms && candidateMedianP95Ms
    ? candidateMedianP95Ms / baselineMedianP95Ms
    : null;
  const maximumAcceptedRatio = 1 + regressionThresholdPercent / 100;
  const pairedP50WithinThreshold = pairedMedianP50Ratio !== null
    && pairedMedianP50Ratio <= maximumAcceptedRatio;
  const pairedP95WithinThreshold = pairedMedianP95Ratio !== null
    && pairedMedianP95Ratio <= maximumAcceptedRatio;
  const independentP50WithinThreshold = independentP50Ratio !== null
    && independentP50Ratio <= maximumAcceptedRatio;
  const independentP95WithinThreshold = independentP95Ratio !== null
    && independentP95Ratio <= maximumAcceptedRatio;
  const candidateP50WithinAbsoluteCeiling = candidateMedianP50Ms !== null
    && maximumCandidateMedianP50Ms !== null
    && candidateMedianP50Ms <= maximumCandidateMedianP50Ms;
  if (!pairedP50WithinThreshold) {
    blockers.push('paired-stage-producer-p50-regression-exceeds-threshold');
  }
  if (!pairedP95WithinThreshold) {
    blockers.push('paired-stage-producer-p95-regression-exceeds-threshold');
  }
  if (!independentP50WithinThreshold) {
    blockers.push(
      'independent-median-stage-producer-p50-regression-exceeds-threshold'
    );
  }
  if (!independentP95WithinThreshold) {
    blockers.push(
      'independent-median-stage-producer-p95-regression-exceeds-threshold'
    );
  }
  if (!candidateP50WithinAbsoluteCeiling) {
    blockers.push('candidate-stage-producer-p50-exceeds-absolute-ceiling');
  }
  return {
    schema: 'peercompute.ulg.sph-paired-gpu-stage-producer-campaign.v0',
    status: blockers.length === 0 ? 'pass' : 'fail',
    blockers,
    method: {
      producerId,
      independentRunCount: normalizedRequiredRunCount,
      expectedRunOrders: normalizedExpectedOrders,
      requiredWarmupBatchCount: normalizedRequiredWarmups,
      requiredMeasuredSampleCount: normalizedRequiredMeasurements,
      percentileEstimator: 'nearest-rank-ceil-nq',
      direction: 'lower-is-better',
      pairedAggregation:
        'median-of-within-run-candidate-over-historical-ratios',
      independentMedianCrossCheckRequired: true,
      regressionThresholdPercent,
      maximumAcceptedRatio,
      maximumCandidateMedianP50Ms,
      expectedBaselineGitHead: normalizedExpectedBaselineGitHead || null,
      candidatePlacementAttribution:
        'segmented-product-event-placement-producers-required-serial-producer-rejected'
    },
    runCount: normalizedRuns.length,
    runs: normalizedRuns,
    paired: {
      p50Ratios,
      p95Ratios,
      medianP50Ratio: pairedMedianP50Ratio,
      medianP95Ratio: pairedMedianP95Ratio,
      p50WithinThreshold: pairedP50WithinThreshold,
      p95WithinThreshold: pairedP95WithinThreshold
    },
    independentMedianCrossCheck: {
      baselineP50Ms: baselineMedianP50Ms,
      candidateP50Ms: candidateMedianP50Ms,
      p50Ratio: independentP50Ratio,
      p50WithinThreshold: independentP50WithinThreshold,
      baselineP95Ms: baselineMedianP95Ms,
      candidateP95Ms: candidateMedianP95Ms,
      p95Ratio: independentP95Ratio,
      p95WithinThreshold: independentP95WithinThreshold
    },
    absoluteCandidateCeiling: {
      metric: 'p50Ms',
      observedMedianMs: candidateMedianP50Ms,
      maximumMs: maximumCandidateMedianP50Ms,
      withinCeiling: candidateP50WithinAbsoluteCeiling,
      provenance:
        'fixed-upper-bound-equal-to-best-accepted-historical-reaction-step-p50-not-historical-median'
    }
  };
}

function authoritativeTwoLevelThroughputScenarioUrlEvidence(
  scenario,
  requiredFineSubstepCount
) {
  let params = null;
  try {
    params = new URL(
      String(scenario?.scenarioUrl || ''),
      'https://benchmark.invalid'
    ).searchParams;
  } catch {
    params = null;
  }
  const expectedParams = {
    ss: '1',
    schroederLevel: '0',
    schroederMaxLevel: '1',
    schroederCrossLevelCoupling: '1',
    schroederTwoLevel: '1',
    schroederTwoLevelAuthority: 'authoritative',
    schroederTwoLevelSubsteps: String(requiredFineSubstepCount)
  };
  const observedParams = Object.fromEntries(Object.keys(expectedParams).map(
    (key) => [key, params?.get(key) ?? null]
  ));
  return {
    complete: Boolean(
      params
      && Object.entries(expectedParams).every(
        ([key, expected]) => params.get(key) === expected
      )
    ),
    expectedParams,
    observedParams
  };
}

function authoritativeTwoLevelThroughputRouteEvidence(
  scenario,
  requiredFineSubstepCount
) {
  const scenarioUrl = authoritativeTwoLevelThroughputScenarioUrlEvidence(
    scenario,
    requiredFineSubstepCount
  );
  const complete = Boolean(
    scenario?.schroederTwoLevelMechanicsConfiguredRequested === true
    && scenario?.schroederTwoLevelMechanicsRequestedObserved === true
    && scenario?.schroederTwoLevelMechanicsCoverageComplete === true
    && scenario?.schroederTwoLevelMechanicsAuthorityRequested
      === 'authoritative'
    && scenario?.schroederTwoLevelMechanicsAuthorityObserved
      === 'authoritative'
    && exactNonNegativeIntegerOrNull(
      scenario?.schroederTwoLevelFineSubstepCountRequested
    ) === requiredFineSubstepCount
    && exactNonNegativeIntegerOrNull(
      scenario?.schroederTwoLevelFineSubstepCountObserved
    ) === requiredFineSubstepCount
    && scenario?.schroederTwoLevelMechanicsStepStatus
      === 'schroeder-two-level-authoritative-step-executed'
    && scenario?.schroederTwoLevelAuthoritativeCommitVerified === true
    && scenarioUrl.complete
  );
  return {
    complete,
    configuredRequested:
      scenario?.schroederTwoLevelMechanicsConfiguredRequested ?? null,
    requestedObserved:
      scenario?.schroederTwoLevelMechanicsRequestedObserved ?? null,
    coverageComplete:
      scenario?.schroederTwoLevelMechanicsCoverageComplete ?? null,
    authorityRequested:
      scenario?.schroederTwoLevelMechanicsAuthorityRequested ?? null,
    authorityObserved:
      scenario?.schroederTwoLevelMechanicsAuthorityObserved ?? null,
    fineSubstepCountRequested: exactNonNegativeIntegerOrNull(
      scenario?.schroederTwoLevelFineSubstepCountRequested
    ),
    fineSubstepCountObserved: exactNonNegativeIntegerOrNull(
      scenario?.schroederTwoLevelFineSubstepCountObserved
    ),
    stepStatus: scenario?.schroederTwoLevelMechanicsStepStatus ?? null,
    authoritativeCommitVerified:
      scenario?.schroederTwoLevelAuthoritativeCommitVerified ?? null,
    scenarioUrl
  };
}

function pairedThroughputArmEvidence(arm, {
  requiredBatchCount,
  requiredBatchStepCount,
  historicalBaseline = false,
  routeKind = 'single-level',
  requiredFineSubstepCount = 2
}) {
  const scenario = arm?.scenario ?? null;
  const authoritativeTwoLevel = routeKind === 'authoritative-two-level';
  const twoLevelRoute = authoritativeTwoLevel
    ? authoritativeTwoLevelThroughputRouteEvidence(
        scenario,
        requiredFineSubstepCount
      )
    : null;
  const routeComplete = authoritativeTwoLevel
    ? twoLevelRoute.complete
    : Boolean(
      scenario?.schroederTwoLevelMechanicsConfiguredRequested === false
      && scenario?.schroederTwoLevelMechanicsRequestedObserved !== true
    );
  const physicsStepsPerSecond = finitePositiveNumberOrNull(
    scenario?.physicsStepsPerSecond
  );
  const expectedTotalStepCount = requiredBatchCount
    * requiredBatchStepCount;
  const transactionCounters = scenario?.schroederTransactionCounterTotals
    ?? null;
  const historicalRouteCompatibilityComplete = Boolean(
    historicalBaseline === true
    && scenario?.schroederSimulationConfiguredRequested === true
    && scenario?.schroederSimulationActive === true
    && exactNonNegativeIntegerOrNull(
      scenario?.schroederTransactionExpectedStepCount
    ) === expectedTotalStepCount
    && exactNonNegativeIntegerOrNull(
      scenario?.schroederTransactionCompletedStepCount
    ) === expectedTotalStepCount
    && exactNonNegativeIntegerOrNull(
      scenario?.schroederTransactionExpectedBatchCount
    ) === requiredBatchCount
    && exactNonNegativeIntegerOrNull(
      scenario?.schroederTransactionObservedBatchCount
    ) === requiredBatchCount
    && scenario?.schroederTransactionBatchCoverageComplete === true
    && scenario?.schroederTransactionCompletedStepCoverageComplete === true
    && exactNonNegativeIntegerOrNull(
      scenario?.schroederSpatialEpochReleaseSettlementCount
    ) === expectedTotalStepCount
    && scenario?.schroederSpatialEpochReleaseSettlementCoverageComplete
      === true
    && scenario?.schroederTransactionNextStepStrideCoverageComplete === true
    && scenario?.schroederTransactionStepIdentityCoverageComplete === true
    && scenario?.schroederTransactionGenerationAlignmentComplete === true
    && scenario?.schroederSpatialEpochGenerationCoverageComplete === true
    && [
      'epochCount',
      'directoryBuildCount',
      'sortUniqueCount',
      'proposalSealCount',
      'commitCount',
      'releaseScheduleCount',
      'releaseCount'
    ].every((key) => (
      exactNonNegativeIntegerOrNull(transactionCounters?.[key])
        === expectedTotalStepCount
    ))
    && [
      'privateCanonicalLookupBuildCount',
      'releaseRetryCount',
      'legacyPrivateLookupBuildCount',
      'legacyExhaustiveTraversalCount'
    ].every((key) => (
      exactNonNegativeIntegerOrNull(transactionCounters?.[key]) === 0
    ))
  );
  const performanceGateBlockers = Array.isArray(
    scenario?.performanceGate?.blockers
  ) ? [...scenario.performanceGate.blockers] : [];
  const historicalInstrumentationCompatibilityGate = Boolean(
    historicalRouteCompatibilityComplete
    && arm?.reportPerformanceGateStatus === 'fail'
    && arm?.scenarioStatus === 'bad'
    && performanceGateBlockers.length === 1
    && performanceGateBlockers[0]
      === 'schroeder-spatial-transaction-coverage-incomplete'
  );
  const routeAndGateComplete = historicalBaseline
    ? Boolean(
      (
        arm?.reportPerformanceGateStatus === 'pass'
        && arm?.scenarioStatus === 'good'
        && scenario?.schroederTransactionCoverageComplete === true
      )
      || historicalInstrumentationCompatibilityGate
    )
    : Boolean(
      arm?.reportPerformanceGateStatus === 'pass'
      && arm?.scenarioStatus === 'good'
      && scenario?.schroederTransactionCoverageComplete === true
    );
  const complete = Boolean(
    arm?.process?.exitCode === 0
    && arm?.reportStatus === 'complete'
    && routeAndGateComplete
    && scenario?.probeMode === 'scene'
    && scenario?.physicsStepsPerSecondSource === 'complete-engine-batch'
    && physicsStepsPerSecond !== null
    && exactNonNegativeIntegerOrNull(scenario?.batches)
      === requiredBatchCount
    && exactNonNegativeIntegerOrNull(scenario?.batchSteps)
      === requiredBatchStepCount
    && exactNonNegativeIntegerOrNull(scenario?.completedStepCount)
      === requiredBatchStepCount
    && scenario?.schroederSimulationConfiguredRequested === true
    && scenario?.schroederSimulationActive === true
    && routeComplete
  );
  return {
    complete,
    routeKind,
    routeComplete,
    processExitCode: arm?.process?.exitCode ?? null,
    reportStatus: arm?.reportStatus ?? null,
    reportPerformanceGateStatus:
      arm?.reportPerformanceGateStatus ?? null,
    performanceGateBlockers,
    scenarioStatus: arm?.scenarioStatus ?? null,
    probeMode: scenario?.probeMode ?? null,
    physicsStepsPerSecondSource:
      scenario?.physicsStepsPerSecondSource ?? null,
    physicsStepsPerSecond,
    batches: exactNonNegativeIntegerOrNull(scenario?.batches),
    batchSteps: exactNonNegativeIntegerOrNull(scenario?.batchSteps),
    completedStepCount:
      exactNonNegativeIntegerOrNull(scenario?.completedStepCount),
    schroederSimulationActive:
      scenario?.schroederSimulationActive ?? null,
    schroederTransactionCoverageComplete:
      scenario?.schroederTransactionCoverageComplete ?? null,
    historicalBaseline: historicalBaseline === true,
    historicalRouteCompatibilityComplete,
    historicalInstrumentationCompatibilityGate,
    schroederTwoLevelMechanicsConfiguredRequested:
      scenario?.schroederTwoLevelMechanicsConfiguredRequested ?? null,
    twoLevelRoute,
    probeIssues: Array.isArray(scenario?.probeIssues)
      ? [...scenario.probeIssues]
      : []
  };
}

/**
 * Compare a historical and candidate worktree on the same non-target visual
 * SS route. Physics throughput is higher-is-better, so its ratio and gate are
 * deliberately separate from the lower-is-better GPU duration campaign.
 */
export function summarizePairedPhysicsThroughputRuns({
  runs = [],
  requiredRunCount = 3,
  expectedRunOrders = ['AB', 'BA', 'AB'],
  requiredWarmupBatchCount = 4,
  requiredMeasuredBatchCount = 1,
  requiredBatchStepCount = 16,
  expectedBaselineGitHead = null,
  maxRegressionPercent = 5,
  routeKind = 'single-level',
  requiredFineSubstepCount = 2
} = {}) {
  if (
    routeKind !== 'single-level'
    && routeKind !== 'authoritative-two-level'
  ) {
    throw new RangeError(`Unsupported throughput route kind ${routeKind}`);
  }
  const normalizedFineSubstepCount = Math.max(
    1,
    Math.round(Number(requiredFineSubstepCount) || 2)
  );
  const normalizedRequiredRunCount = Math.max(
    1,
    Math.round(Number(requiredRunCount) || 3)
  );
  const normalizedWarmupBatchCount = Math.max(
    0,
    Math.round(Number(requiredWarmupBatchCount) || 0)
  );
  const normalizedMeasuredBatchCount = Math.max(
    1,
    Math.round(Number(requiredMeasuredBatchCount) || 1)
  );
  const normalizedBatchCount = normalizedWarmupBatchCount
    + normalizedMeasuredBatchCount;
  const normalizedBatchStepCount = Math.max(
    1,
    Math.round(Number(requiredBatchStepCount) || 16)
  );
  const normalizedExpectedOrders = Array.from(
    { length: normalizedRequiredRunCount },
    (_, index) => String(
      expectedRunOrders[index]
        ?? (index % 2 === 0 ? 'AB' : 'BA')
    ).toUpperCase()
  );
  const normalizedExpectedBaselineGitHead = typeof expectedBaselineGitHead
    === 'string'
    ? expectedBaselineGitHead.trim()
    : '';
  const normalizedRuns = (Array.isArray(runs) ? runs : []).map(
    (run, index) => {
      const baseline = pairedThroughputArmEvidence(run?.baseline, {
        requiredBatchCount: normalizedBatchCount,
        requiredBatchStepCount: normalizedBatchStepCount,
        historicalBaseline: true,
        routeKind,
        requiredFineSubstepCount: normalizedFineSubstepCount
      });
      const candidate = pairedThroughputArmEvidence(run?.candidate, {
        requiredBatchCount: normalizedBatchCount,
        requiredBatchStepCount: normalizedBatchStepCount,
        historicalBaseline: false,
        routeKind,
        requiredFineSubstepCount: normalizedFineSubstepCount
      });
      const baselineProvenance = pairedThroughputProvenanceEvidence(
        run?.baseline
      );
      const candidateProvenance = pairedThroughputProvenanceEvidence(
        run?.candidate
      );
      const throughputRatio = baseline.physicsStepsPerSecond !== null
        && candidate.physicsStepsPerSecond !== null
        ? candidate.physicsStepsPerSecond / baseline.physicsStepsPerSecond
        : null;
      return {
        runIndex: index + 1,
        runId: String(run?.runId ?? ''),
        order: String(run?.order ?? '').toUpperCase(),
        baseline,
        candidate,
        baselineProvenance,
        candidateProvenance,
        throughputRatio,
        regressionPercent: throughputRatio === null
          ? null
          : (1 - throughputRatio) * 100
      };
    }
  );
  const blockers = [];
  if (normalizedRuns.length !== normalizedRequiredRunCount) {
    blockers.push('independent-run-count-mismatch');
  }
  const runIds = normalizedRuns.map((run) => run.runId);
  if (
    runIds.some((runId) => !runId)
    || new Set(runIds).size !== runIds.length
  ) {
    blockers.push('run-identities-missing-or-duplicated');
  }
  if (normalizedRuns.some((run, index) => (
    run.order !== normalizedExpectedOrders[index]
  ))) {
    blockers.push('run-order-not-ab-ba-alternating');
  }
  if (normalizedRuns.some((run) => !run.baseline.complete)) {
    blockers.push('baseline-throughput-evidence-incomplete');
  }
  if (normalizedRuns.some((run) => !run.candidate.complete)) {
    blockers.push('candidate-throughput-evidence-incomplete');
  }
  if (normalizedRuns.some((run) => !run.baselineProvenance.complete)) {
    blockers.push('baseline-source-provenance-incomplete');
  }
  if (normalizedRuns.some((run) => !run.candidateProvenance.complete)) {
    blockers.push('candidate-source-provenance-incomplete');
  }
  if (normalizedRuns.some((run) => (
    run.baselineProvenance.worktreeDirtyBefore !== false
    || run.baselineProvenance.worktreeDirtyAfter !== false
  ))) {
    blockers.push('historical-baseline-worktree-not-clean');
  }
  const commonConfigSignatures = new Set(normalizedRuns.flatMap((run) => [
    run.baselineProvenance.commonConfigSignature,
    run.candidateProvenance.commonConfigSignature
  ]).filter(Boolean));
  if (commonConfigSignatures.size !== 1) {
    blockers.push('common-config-signature-mismatch');
  }
  const armConfigSignatures = new Set(normalizedRuns.flatMap((run) => [
    run.baselineProvenance.armConfigSignature,
    run.candidateProvenance.armConfigSignature
  ]).filter(Boolean));
  if (armConfigSignatures.size !== 1) {
    blockers.push(
      routeKind === 'authoritative-two-level'
        ? 'authoritative-two-level-route-signature-mismatch'
        : 'non-target-route-signature-mismatch'
    );
  }
  const baselineSourceIdentities = new Set(normalizedRuns.map((run) => (
    `${run.baselineProvenance.gitHead}:`
    + `${run.baselineProvenance.sourceFingerprintBefore}`
  )));
  const candidateSourceIdentities = new Set(normalizedRuns.map((run) => (
    `${run.candidateProvenance.gitHead}:`
    + `${run.candidateProvenance.sourceFingerprintBefore}`
  )));
  if (baselineSourceIdentities.size !== 1) {
    blockers.push('baseline-source-changed-between-runs');
  }
  if (candidateSourceIdentities.size !== 1) {
    blockers.push('candidate-source-changed-between-runs');
  }
  if (
    baselineSourceIdentities.size === 1
    && candidateSourceIdentities.size === 1
    && [...baselineSourceIdentities][0] === [...candidateSourceIdentities][0]
  ) {
    blockers.push('historical-and-candidate-source-identities-match');
  }
  if (
    normalizedExpectedBaselineGitHead
    && (
      !/^[0-9a-f]{40}$/i.test(normalizedExpectedBaselineGitHead)
      || normalizedRuns.some((run) => (
        run.baselineProvenance.gitHead
          !== normalizedExpectedBaselineGitHead
      ))
    )
  ) {
    blockers.push('historical-baseline-git-head-mismatch');
  }
  const ratios = normalizedRuns.map((run) => run.throughputRatio)
    .filter((value) => Number.isFinite(value) && value > 0);
  if (ratios.length !== normalizedRequiredRunCount) {
    blockers.push('paired-throughput-ratio-coverage-incomplete');
  }
  const pairedMedianRatio = median(ratios);
  const baselineMedianPhysicsStepsPerSecond = median(normalizedRuns.map(
    (run) => run.baseline.physicsStepsPerSecond
  ));
  const candidateMedianPhysicsStepsPerSecond = median(normalizedRuns.map(
    (run) => run.candidate.physicsStepsPerSecond
  ));
  const independentMedianRatio = baselineMedianPhysicsStepsPerSecond
    && candidateMedianPhysicsStepsPerSecond
    ? candidateMedianPhysicsStepsPerSecond
      / baselineMedianPhysicsStepsPerSecond
    : null;
  const threshold = Number(maxRegressionPercent);
  const regressionThresholdPercent = Number.isFinite(threshold)
    ? threshold
    : 5;
  const minimumAcceptedRatio = 1 - regressionThresholdPercent / 100;
  const pairedMedianRegressionPercent = pairedMedianRatio === null
    ? null
    : (1 - pairedMedianRatio) * 100;
  const independentMedianRegressionPercent = independentMedianRatio === null
    ? null
    : (1 - independentMedianRatio) * 100;
  const pairedWithinThreshold = pairedMedianRatio !== null
    && pairedMedianRatio >= minimumAcceptedRatio;
  const independentMedianWithinThreshold = independentMedianRatio !== null
    && independentMedianRatio >= minimumAcceptedRatio;
  if (!pairedWithinThreshold) {
    blockers.push('paired-physics-throughput-regression-exceeds-threshold');
  }
  if (!independentMedianWithinThreshold) {
    blockers.push(
      'independent-median-physics-throughput-regression-exceeds-threshold'
    );
  }
  return {
    schema: routeKind === 'authoritative-two-level'
      ? 'peercompute.ulg.sph-paired-authoritative-two-level-physics-throughput-campaign.v0'
      : 'peercompute.ulg.sph-paired-physics-throughput-campaign.v0',
    status: blockers.length === 0 ? 'pass' : 'fail',
    blockers,
    method: {
      independentRunCount: normalizedRequiredRunCount,
      expectedRunOrders: normalizedExpectedOrders,
      warmupBatchCount: normalizedWarmupBatchCount,
      measuredBatchCount: normalizedMeasuredBatchCount,
      batchStepCount: normalizedBatchStepCount,
      metric: 'physicsStepsPerSecond',
      metricSource: 'complete-engine-batch',
      direction: 'higher-is-better',
      routeKind,
      requiredFineSubstepCount: routeKind === 'authoritative-two-level'
        ? normalizedFineSubstepCount
        : null,
      pairedAggregation:
        'median-of-within-run-candidate-over-historical-ratios',
      independentMedianCrossCheckRequired: true,
      regressionThresholdPercent,
      minimumAcceptedRatio,
      expectedBaselineGitHead:
        normalizedExpectedBaselineGitHead || null
    },
    runCount: normalizedRuns.length,
    runs: normalizedRuns,
    paired: {
      throughputRatios: ratios,
      medianRatio: pairedMedianRatio,
      medianRegressionPercent: pairedMedianRegressionPercent,
      withinThreshold: pairedWithinThreshold
    },
    independentMedianCrossCheck: {
      baselinePhysicsStepsPerSecond:
        baselineMedianPhysicsStepsPerSecond,
      candidatePhysicsStepsPerSecond:
        candidateMedianPhysicsStepsPerSecond,
      ratio: independentMedianRatio,
      regressionPercent: independentMedianRegressionPercent,
      withinThreshold: independentMedianWithinThreshold
    }
  };
}

/**
 * Compare a historical and candidate worktree on the identical complete-engine
 * authoritative two-level SS route. This deliberately cannot admit the
 * single-level throughput fixture or a two-level observation/control arm.
 */
export function summarizePairedAuthoritativeTwoLevelPhysicsThroughputRuns(
  options = {}
) {
  return summarizePairedPhysicsThroughputRuns({
    ...options,
    routeKind: 'authoritative-two-level'
  });
}

function spatialArenaDepthScenarioUrlEvidence(scenario, expectedArenaCount) {
  let params = null;
  try {
    params = new URL(
      String(scenario?.scenarioUrl || ''),
      'https://benchmark.invalid'
    ).searchParams;
  } catch {
    params = null;
  }
  const expectedParams = {
    ss: '1',
    schroederLevel: '0',
    schroederMaxLevel: '0',
    schroederCrossLevelCoupling: '0',
    schroederSpatialArenaCount: String(expectedArenaCount)
  };
  const observedParams = Object.fromEntries(Object.keys(expectedParams).map(
    (key) => [key, params?.get(key) ?? null]
  ));
  return {
    complete: Boolean(
      params
      && Object.entries(expectedParams).every(
        ([key, expected]) => params.get(key) === expected
      )
      && params.get('schroederTwoLevel') === null
    ),
    expectedParams,
    observedParams,
    observedTwoLevel: params?.get('schroederTwoLevel') ?? null
  };
}

function pairedSpatialArenaDepthArmEvidence(arm, {
  requiredBatchCount,
  requiredBatchStepCount,
  expectedArenaCount
}) {
  const throughput = pairedThroughputArmEvidence(arm, {
    requiredBatchCount,
    requiredBatchStepCount,
    historicalBaseline: false
  });
  const scenario = arm?.scenario ?? null;
  const requestedArenaCount = exactNonNegativeIntegerOrNull(
    scenario?.schroederSpatialArenaCountRequested
  );
  const observedArenaCounts = [...new Set(
    (Array.isArray(scenario?.schroederSpatialArenaCountsObserved)
      ? scenario.schroederSpatialArenaCountsObserved
      : []
    ).map(exactNonNegativeIntegerOrNull).filter((value) => value !== null)
  )].sort((a, b) => a - b);
  const arenaCoverageComplete =
    scenario?.schroederSpatialArenaCountCoverageComplete === true;
  const scenarioUrlEvidence = spatialArenaDepthScenarioUrlEvidence(
    scenario,
    expectedArenaCount
  );
  const backpressureWaitCount = exactNonNegativeIntegerOrNull(
    scenario?.schroederBackpressureWaitCount
  );
  const rawBackpressureWaitMs = Number(scenario?.schroederBackpressureWaitMs);
  const backpressureWaitMs = Number.isFinite(rawBackpressureWaitMs)
    && rawBackpressureWaitMs >= 0
    ? rawBackpressureWaitMs
    : null;
  const backpressureEvidenceComplete = backpressureWaitCount !== null
    && backpressureWaitMs !== null;
  const arenaDepthEvidenceComplete = Boolean(
    requestedArenaCount === expectedArenaCount
    && observedArenaCounts.length === 1
    && observedArenaCounts[0] === expectedArenaCount
    && arenaCoverageComplete
    && scenarioUrlEvidence.complete
  );
  return {
    ...throughput,
    throughputEvidenceComplete: throughput.complete,
    complete: Boolean(
      throughput.complete
      && arenaDepthEvidenceComplete
      && backpressureEvidenceComplete
    ),
    expectedArenaCount,
    requestedArenaCount,
    observedArenaCounts,
    arenaCoverageComplete,
    arenaDepthEvidenceComplete,
    scenarioUrlEvidence,
    backpressureWaitCount,
    backpressureWaitMs,
    backpressureEvidenceComplete
  };
}

function spatialArenaDepthSourceIdentity(provenance) {
  if (provenance?.complete !== true) return null;
  return [
    provenance.gitHead,
    provenance.sourceFingerprintBefore,
    provenance.worktreeStatusHashBefore,
    provenance.trackedAndUntrackedFileCountBefore,
    provenance.worktreeDirtyBefore === true ? 'dirty' : 'clean'
  ].join(':');
}

function ratioOrNull(numerator, denominator) {
  if (!(Number.isFinite(numerator) && Number.isFinite(denominator))) {
    return null;
  }
  if (denominator === 0) return numerator === 0 ? 1 : null;
  return numerator / denominator;
}

/**
 * Characterize the same resident SS route with two direct spatial-generation
 * arena depths.  This is deliberately a same-source diagnostic rather than a
 * historical-versus-candidate regression gate: it must prove route/depth
 * identity and stable source state, while reporting either performance result
 * without prejudging the production default.
 */
export function summarizePairedSpatialArenaDepthThroughputRuns({
  runs = [],
  requiredRunCount = 3,
  expectedRunOrders = ['AB', 'BA', 'AB'],
  requiredWarmupBatchCount = 1,
  requiredMeasuredBatchCount = 6,
  requiredBatchStepCount = 16,
  referenceArenaCount = 3,
  comparisonArenaCount = 8
} = {}) {
  const normalizedRequiredRunCount = Math.max(
    1,
    Math.round(Number(requiredRunCount) || 3)
  );
  const normalizedWarmupBatchCount = Math.max(
    0,
    Math.round(Number(requiredWarmupBatchCount) || 0)
  );
  const normalizedMeasuredBatchCount = Math.max(
    1,
    Math.round(Number(requiredMeasuredBatchCount) || 1)
  );
  const normalizedBatchCount = normalizedWarmupBatchCount
    + normalizedMeasuredBatchCount;
  const normalizedBatchStepCount = Math.max(
    1,
    Math.round(Number(requiredBatchStepCount) || 16)
  );
  const normalizedReferenceArenaCount = exactNonNegativeIntegerOrNull(
    referenceArenaCount
  );
  const normalizedComparisonArenaCount = exactNonNegativeIntegerOrNull(
    comparisonArenaCount
  );
  const normalizedExpectedOrders = Array.from(
    { length: normalizedRequiredRunCount },
    (_, index) => String(
      expectedRunOrders[index]
        ?? (index % 2 === 0 ? 'AB' : 'BA')
    ).toUpperCase()
  );
  const normalizedRuns = (Array.isArray(runs) ? runs : []).map(
    (run, index) => {
      const reference = pairedSpatialArenaDepthArmEvidence(run?.baseline, {
        requiredBatchCount: normalizedBatchCount,
        requiredBatchStepCount: normalizedBatchStepCount,
        expectedArenaCount: normalizedReferenceArenaCount
      });
      const comparison = pairedSpatialArenaDepthArmEvidence(run?.candidate, {
        requiredBatchCount: normalizedBatchCount,
        requiredBatchStepCount: normalizedBatchStepCount,
        expectedArenaCount: normalizedComparisonArenaCount
      });
      const referenceProvenance = pairedThroughputProvenanceEvidence(
        run?.baseline
      );
      const comparisonProvenance = pairedThroughputProvenanceEvidence(
        run?.candidate
      );
      return {
        runIndex: index + 1,
        runId: String(run?.runId ?? ''),
        order: String(run?.order ?? '').toUpperCase(),
        reference,
        comparison,
        referenceProvenance,
        comparisonProvenance,
        physicsStepsPerSecondRatio: ratioOrNull(
          comparison.physicsStepsPerSecond,
          reference.physicsStepsPerSecond
        ),
        backpressureWaitCountDelta: (
          comparison.backpressureWaitCount === null
          || reference.backpressureWaitCount === null
        ) ? null : comparison.backpressureWaitCount - reference.backpressureWaitCount,
        backpressureWaitMsDelta: (
          comparison.backpressureWaitMs === null
          || reference.backpressureWaitMs === null
        ) ? null : comparison.backpressureWaitMs - reference.backpressureWaitMs
      };
    }
  );
  const blockers = [];
  if (
    normalizedReferenceArenaCount === null
    || normalizedReferenceArenaCount < 1
    || normalizedReferenceArenaCount > 8
  ) {
    blockers.push('reference-arena-count-invalid');
  }
  if (
    normalizedComparisonArenaCount === null
    || normalizedComparisonArenaCount < 1
    || normalizedComparisonArenaCount > 8
  ) {
    blockers.push('comparison-arena-count-invalid');
  }
  if (
    normalizedReferenceArenaCount !== null
    && normalizedComparisonArenaCount !== null
    && normalizedReferenceArenaCount === normalizedComparisonArenaCount
  ) {
    blockers.push('arena-depth-arms-not-distinct');
  }
  if (normalizedRuns.length !== normalizedRequiredRunCount) {
    blockers.push('independent-run-count-mismatch');
  }
  const runIds = normalizedRuns.map((run) => run.runId);
  if (runIds.some((runId) => !runId) || new Set(runIds).size !== runIds.length) {
    blockers.push('run-identities-missing-or-duplicated');
  }
  if (normalizedRuns.some((run, index) => run.order !== normalizedExpectedOrders[index])) {
    blockers.push('run-order-not-ab-ba-alternating');
  }
  if (normalizedRuns.some((run) => !run.reference.complete)) {
    blockers.push('reference-arena-depth-evidence-incomplete');
  }
  if (normalizedRuns.some((run) => !run.comparison.complete)) {
    blockers.push('comparison-arena-depth-evidence-incomplete');
  }
  if (normalizedRuns.some((run) => !run.referenceProvenance.complete)) {
    blockers.push('reference-source-provenance-incomplete');
  }
  if (normalizedRuns.some((run) => !run.comparisonProvenance.complete)) {
    blockers.push('comparison-source-provenance-incomplete');
  }
  const commonConfigSignatures = new Set(normalizedRuns.flatMap((run) => [
    run.referenceProvenance.commonConfigSignature,
    run.comparisonProvenance.commonConfigSignature
  ]).filter(Boolean));
  if (commonConfigSignatures.size !== 1) {
    blockers.push('common-config-signature-mismatch');
  }
  const referenceArmConfigSignatures = new Set(normalizedRuns.map(
    (run) => run.referenceProvenance.armConfigSignature
  ).filter(Boolean));
  const comparisonArmConfigSignatures = new Set(normalizedRuns.map(
    (run) => run.comparisonProvenance.armConfigSignature
  ).filter(Boolean));
  if (referenceArmConfigSignatures.size !== 1) {
    blockers.push('reference-arena-config-signature-mismatch');
  }
  if (comparisonArmConfigSignatures.size !== 1) {
    blockers.push('comparison-arena-config-signature-mismatch');
  }
  if (
    referenceArmConfigSignatures.size === 1
    && comparisonArmConfigSignatures.size === 1
    && [...referenceArmConfigSignatures][0]
      === [...comparisonArmConfigSignatures][0]
  ) {
    blockers.push('arena-depth-arm-config-signatures-match');
  }
  const sourceIdentities = new Set(normalizedRuns.flatMap((run) => [
    spatialArenaDepthSourceIdentity(run.referenceProvenance),
    spatialArenaDepthSourceIdentity(run.comparisonProvenance)
  ]).filter(Boolean));
  if (sourceIdentities.size !== 1) {
    blockers.push('arena-depth-arms-do-not-share-exact-source');
  }
  const throughputRatios = normalizedRuns.map(
    (run) => run.physicsStepsPerSecondRatio
  ).filter((value) => Number.isFinite(value) && value > 0);
  if (throughputRatios.length !== normalizedRequiredRunCount) {
    blockers.push('paired-throughput-ratio-coverage-incomplete');
  }
  const backpressureWaitCountDeltas = normalizedRuns.map(
    (run) => run.backpressureWaitCountDelta
  ).filter(Number.isFinite);
  const backpressureWaitMsDeltas = normalizedRuns.map(
    (run) => run.backpressureWaitMsDelta
  ).filter(Number.isFinite);
  if (backpressureWaitCountDeltas.length !== normalizedRequiredRunCount) {
    blockers.push('backpressure-wait-count-coverage-incomplete');
  }
  if (backpressureWaitMsDeltas.length !== normalizedRequiredRunCount) {
    blockers.push('backpressure-wait-ms-coverage-incomplete');
  }
  const referenceMedianPhysicsStepsPerSecond = median(normalizedRuns.map(
    (run) => run.reference.physicsStepsPerSecond
  ));
  const comparisonMedianPhysicsStepsPerSecond = median(normalizedRuns.map(
    (run) => run.comparison.physicsStepsPerSecond
  ));
  return {
    schema: 'peercompute.ulg.sph-paired-spatial-arena-depth-characterization.v0',
    status: blockers.length === 0 ? 'pass' : 'fail',
    blockers,
    method: {
      independentRunCount: normalizedRequiredRunCount,
      expectedRunOrders: normalizedExpectedOrders,
      warmupBatchCount: normalizedWarmupBatchCount,
      measuredBatchCount: normalizedMeasuredBatchCount,
      batchStepCount: normalizedBatchStepCount,
      referenceRole: `arena-${normalizedReferenceArenaCount}-reference`,
      comparisonRole: `arena-${normalizedComparisonArenaCount}-comparison`,
      referenceArenaCount: normalizedReferenceArenaCount,
      comparisonArenaCount: normalizedComparisonArenaCount,
      metric: 'physicsStepsPerSecond',
      metricSource: 'complete-engine-batch',
      sameSourceRequired: true,
      performanceGate: 'diagnostic-only-no-throughput-threshold'
    },
    runCount: normalizedRuns.length,
    runs: normalizedRuns,
    paired: {
      physicsStepsPerSecondRatios: throughputRatios,
      medianPhysicsStepsPerSecondRatio: median(throughputRatios),
      medianPhysicsStepsPerSecondDeltaPercent: median(throughputRatios) === null
        ? null
        : (median(throughputRatios) - 1) * 100,
      backpressureWaitCountDeltas,
      medianBackpressureWaitCountDelta: median(backpressureWaitCountDeltas),
      backpressureWaitMsDeltas,
      medianBackpressureWaitMsDelta: median(backpressureWaitMsDeltas)
    },
    independentMedianCrossCheck: {
      referencePhysicsStepsPerSecond: referenceMedianPhysicsStepsPerSecond,
      comparisonPhysicsStepsPerSecond: comparisonMedianPhysicsStepsPerSecond,
      physicsStepsPerSecondRatio: ratioOrNull(
        comparisonMedianPhysicsStepsPerSecond,
        referenceMedianPhysicsStepsPerSecond
      )
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

// A resident batch publishes `surfaceDraw` after the render-state snapshot.
// Treat the direct batch record as the authoritative observation when it is
// available: a snapshot can otherwise describe the pre-publication state
// while the same batch has already handed validated GPU buffers to the native
// surface consumer. `false` and `0` are meaningful current observations and
// must not be overwritten by an older snapshot.
export function currentResidentSurfaceDrawEvidence({
  surfaceDraw = null,
  renderState = null
} = {}) {
  const direct = surfaceDraw && typeof surfaceDraw === 'object'
    ? surfaceDraw
    : null;
  const snapshot = renderState && typeof renderState === 'object'
    ? renderState
    : null;
  const current = (directKey, snapshotKey = directKey) => firstNonNullMetricValue(
    ownMetricValue(direct, directKey),
    ownMetricValue(snapshot, snapshotKey)
  );

  return {
    status: current('status', 'surfaceDrawStatus'),
    bridge: current('visibleRendererBridge', 'surfaceDrawVisibleRendererBridge'),
    gpuBufferHandoffReady: current(
      'gpuBufferHandoffReady',
      'surfaceDrawGpuBufferHandoffReady'
    ),
    gpuBufferHandoffStatus: current(
      'gpuBufferHandoffStatus',
      'surfaceDrawGpuBufferHandoffStatus'
    ),
    gpuBufferHandoffReason: current(
      'gpuBufferHandoffReason',
      'surfaceDrawGpuBufferHandoffReason'
    ),
    gpuBufferHandoffKind: current(
      'gpuBufferHandoffKind',
      'surfaceDrawGpuBufferHandoffKind'
    ),
    gpuBufferHandoffInputSchema: current(
      'gpuBufferHandoffInputSchema',
      'surfaceDrawGpuBufferHandoffInputSchema'
    ),
    gpuBufferHandoffRequiresSurfaceExtraction: current(
      'gpuBufferHandoffRequiresSurfaceExtraction',
      'surfaceDrawGpuBufferHandoffRequiresSurfaceExtraction'
    ),
    gpuBufferHandoffUpperBoundVertexCount: current(
      'gpuBufferHandoffUpperBoundVertexCount',
      'surfaceDrawGpuBufferHandoffUpperBoundVertexCount'
    ),
    summaryReadback: current('surfaceDrawSummaryReadback'),
    summaryReadbackByteLength: current('surfaceDrawSummaryReadbackByteLength'),
    rowsBufferByteLength: current('drawRowsBufferByteLength', 'surfaceDrawRowsBufferByteLength'),
    indirectRowsBufferByteLength: current(
      'drawIndirectRowsBufferByteLength',
      'surfaceDrawIndirectRowsBufferByteLength'
    ),
    compactedVertexRowsBufferByteLength: current(
      'compactedVertexRowsBufferByteLength',
      'surfaceDrawCompactedVertexRowsBufferByteLength'
    ),
    compactPositionRowsBufferByteLength: current(
      'compactPositionRowsBufferByteLength',
      'surfaceDrawCompactPositionRowsBufferByteLength'
    ),
    compactPositionRowsStrideFloats: current(
      'compactPositionRowsStrideFloats',
      'surfaceDrawCompactPositionRowsStrideFloats'
    ),
    compactPositionRowsVertexCount: current(
      'compactPositionRowsVertexCount',
      'surfaceDrawCompactPositionRowsVertexCount'
    ),
    directCompactPositionDraw: current(
      'directCompactPositionDraw',
      'surfaceDrawDirectCompactPositionDraw'
    ),
    renderBridgeExternalGpuBufferInputLayout: current(
      'renderBridgeExternalGpuBufferInputLayout',
      'surfaceDrawRenderBridgeExternalGpuBufferInputLayout'
    ),
    renderBridgeCompactPositionDirectInput: current(
      'renderBridgeCompactPositionDirectInput',
      'surfaceDrawRenderBridgeCompactPositionDirectInput'
    ),
    renderFieldRowsBufferByteLength: current(
      'renderFieldRowsBufferByteLength',
      'surfaceDrawRenderFieldRowsBufferByteLength'
    ),
    renderFieldSurfaceBufferByteLength: current(
      'renderFieldSurfaceBufferByteLength',
      'surfaceDrawRenderFieldSurfaceBufferByteLength'
    ),
    source: firstNonNullMetricValue(
      ownMetricValue(direct, 'visibleRenderSource'),
      ownMetricValue(direct, 'source'),
      ownMetricValue(snapshot, 'surfaceDrawVisibleRenderSource'),
      ownMetricValue(snapshot, 'surfaceDrawSource')
    ),
    readback: current('surfaceDrawReadback')
  };
}

const SCHROEDER_TRANSACTION_COUNTER_KEYS = Object.freeze([
  'epochCount',
  'directoryBuildCount',
  'sortUniqueCount',
  'privateCanonicalLookupBuildCount',
  'readerRejectCount',
  'proposalSealCount',
  'privateAdvanceCount',
  'commitCount',
  'releaseScheduleCount',
  'releaseRetryCount',
  'releaseCount',
  'staleLawInputForwardCount',
  'legacyPrivateLookupBuildCount',
  'legacyExhaustiveTraversalCount'
]);

function exactNonNegativeIntegerOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

function exactIntegerSequenceEvidence(values, { requireContiguous = true } = {}) {
  const exact = values.every((value) => Number.isInteger(value) && value >= 0);
  const unique = exact && new Set(values).size === values.length;
  const strictlyIncreasing = exact && values.every(
    (value, index) => index === 0 || value > values[index - 1]
  );
  const contiguous = exact && values.every(
    (value, index) => index === 0 || value === values[index - 1] + 1
  );
  return {
    count: values.length,
    start: values.length > 0 && exact ? values[0] : null,
    end: values.length > 0 && exact ? values[values.length - 1] : null,
    exact,
    unique,
    strictlyIncreasing,
    contiguous,
    complete: values.length > 0
      && exact
      && unique
      && strictlyIncreasing
      && (!requireContiguous || contiguous)
  };
}

const SCHROEDER_SUCCESSOR_SOURCE_FAMILY_SCHEMA =
  'peercompute.ulg.schroeder-committed-successor-source-family.v1';
const SCHROEDER_SUCCESSOR_SOURCE_FAMILY_STATUS =
  'schroeder-committed-successor-source-family-authenticated';
const SCHROEDER_SUCCESSOR_EPOCH_IDENTITY_FIELDS = Object.freeze([
  'storageGeneration',
  'physicsTick',
  'physicsSubstep',
  'positionEpoch',
  'topologyEpoch',
  'chartEpoch',
  'levelEpoch',
  'supportEpoch'
]);
const U32_MAX = 0xffff_ffff;

function exactU32OrNull(value) {
  const number = exactNonNegativeIntegerOrNull(value);
  return number !== null && number <= U32_MAX ? number : null;
}

function exactEpochIdentityOrNull(identity) {
  if (!identity || typeof identity !== 'object') return null;
  const normalized = {};
  for (const field of SCHROEDER_SUCCESSOR_EPOCH_IDENTITY_FIELDS) {
    const value = exactU32OrNull(identity[field]);
    if (value === null) return null;
    normalized[field] = value;
  }
  return normalized;
}

function exactEpochIdentitiesMatch(left, right) {
  return Boolean(
    left
    && right
    && SCHROEDER_SUCCESSOR_EPOCH_IDENTITY_FIELDS.every(
      (field) => left[field] === right[field]
    )
  );
}

function successorEpochEvidenceClaimsPlacementFloor(evidence) {
  return Boolean(
    evidence
    && typeof evidence === 'object'
    && (
      evidence.positionEpochFloorAuthenticated === true
      || evidence.positionEpochFloor !== null && evidence.positionEpochFloor !== undefined
      || evidence.positionAuthority
        === 'authenticated-transactional-placement-epoch-floor-with-conservative-final-family'
    )
  );
}

function authenticatedPlacementEpochTransition(previous, next) {
  const previousPositionEpoch = exactU32OrNull(
    previous?.epochIdentity?.positionEpoch
  );
  const nextPositionEpoch = exactU32OrNull(next?.epochIdentity?.positionEpoch);
  const evidence = previous?.successorEpochEvidence ?? null;
  if (previousPositionEpoch === null || nextPositionEpoch === null) {
    return { accepted: false, reason: 'position-epoch-not-u32' };
  }
  if (nextPositionEpoch === previousPositionEpoch + 1) {
    return successorEpochEvidenceClaimsPlacementFloor(evidence)
      ? { accepted: false, reason: 'unexpected-placement-floor-on-contiguous-transition' }
      : { accepted: true, kind: 'ordinary-contiguous' };
  }
  if (
    previousPositionEpoch > U32_MAX - 2
    || nextPositionEpoch !== previousPositionEpoch + 2
  ) {
    return { accepted: false, reason: 'unsupported-position-epoch-transition' };
  }
  const previousIdentity = exactEpochIdentityOrNull(previous?.epochIdentity);
  const nextIdentity = exactEpochIdentityOrNull(next?.epochIdentity);
  const evidenceSourceIdentity = exactEpochIdentityOrNull(
    evidence?.sourceEpochIdentity
  );
  const evidenceSuccessorIdentity = exactEpochIdentityOrNull(
    evidence?.successorEpochIdentity
  );
  const previousGenerationId = exactU32OrNull(previous?.generationId);
  const proofMatches = Boolean(
    evidence
    && evidence.schema === SCHROEDER_SUCCESSOR_SOURCE_FAMILY_SCHEMA
    && evidence.status === SCHROEDER_SUCCESSOR_SOURCE_FAMILY_STATUS
    && evidence.ready === true
    && evidence.admitted === true
    && evidence.authenticated === true
    && evidence.sourceFamily === 'hot-particle-successor'
    && evidence.sourceFamilyRole === 'committed-successor-x-n-plus-1'
    && evidence.publicationAuthority
      === 'spatial-epoch-transaction-preflight-and-commit'
    && evidence.exactBufferFamilyAuthenticated === true
    && evidence.storageAllocationAuthenticated === true
    && evidence.topologyTransitionAuthenticated === true
    && evidence.positionEpochFloorAuthenticated === true
    && evidence.positionTransitionAuthenticated === false
    && evidence.positionAuthority
      === 'authenticated-transactional-placement-epoch-floor-with-conservative-final-family'
    && evidence.positionChanged === true
    && exactU32OrNull(evidence.positionEpochFloor) === nextPositionEpoch
    && previousGenerationId !== null
    && exactU32OrNull(evidence.sourceGenerationId) === previousGenerationId
    && exactU32OrNull(evidence.ancestorSpatialGenerationId) === previousGenerationId
    && typeof evidence.deviceId === 'string'
    && evidence.deviceId.length > 0
    && evidence.deviceId === previous?.deviceId
    && evidence.deviceId === next?.deviceId
    && exactEpochIdentitiesMatch(evidenceSourceIdentity, previousIdentity)
    && exactEpochIdentitiesMatch(evidenceSuccessorIdentity, nextIdentity)
  );
  return proofMatches
    ? { accepted: true, kind: 'authenticated-reaction-placement-floor' }
    : { accepted: false, reason: 'authenticated-placement-floor-proof-mismatch' };
}

function sameLevelPositionEpochTransitionEvidence(transactions) {
  const rows = Array.isArray(transactions) ? transactions : [];
  const failureReasons = new Set();
  let ordinaryContiguousTransitionCount = 0;
  let authenticatedPlacementTransitionCount = 0;
  let rejectedTransitionCount = 0;
  for (let index = 1; index < rows.length; index += 1) {
    const transition = authenticatedPlacementEpochTransition(
      rows[index - 1],
      rows[index]
    );
    if (!transition.accepted) {
      rejectedTransitionCount += 1;
      failureReasons.add(transition.reason ?? 'unknown-position-epoch-transition');
    } else if (transition.kind === 'authenticated-reaction-placement-floor') {
      authenticatedPlacementTransitionCount += 1;
    } else {
      ordinaryContiguousTransitionCount += 1;
    }
  }
  return {
    transitionCount: Math.max(0, rows.length - 1),
    ordinaryContiguousTransitionCount,
    authenticatedPlacementTransitionCount,
    rejectedTransitionCount,
    rejectionReasons: [...failureReasons].sort(),
    complete: rows.length > 0 && rejectedTransitionCount === 0
  };
}

function positionEpochSequenceWithTransitionProof({
  positionEpochs,
  transactions,
  authoritativePrivateAdvance
}) {
  const sequence = exactIntegerSequenceEvidence(positionEpochs, {
    requireContiguous: false
  });
  const transitionEvidence = authoritativePrivateAdvance
    ? null
    : sameLevelPositionEpochTransitionEvidence(transactions);
  return {
    sequence: {
      ...sequence,
      complete: sequence.complete
        && (authoritativePrivateAdvance || transitionEvidence?.complete === true)
    },
    transitionEvidence
  };
}

/**
 * Audit the canonical SS epoch transaction over the complete benchmark run.
 *
 * A benchmark metric is a batch snapshot, so looking only at the final metric
 * can hide an earlier partial, duplicated, or unreleased tick.  Select exactly
 * one primary resident-batch metric for every requested batch, then flatten its
 * per-tick transaction and generation summaries in execution order.
 */
export function aggregateSchroederResidentBatchEvidence({
  metrics = [],
  requestedBatchCount,
  requestedBatchStepCount,
  schroederSimulationRequested: simulationRequested = false,
  schroederTwoLevelMechanicsRequested: twoLevelMechanicsRequested = false,
  schroederTwoLevelMechanicsAuthority:
    twoLevelMechanicsAuthorityRequested = 'authoritative',
  schroederTwoLevelFineSubstepCount:
    twoLevelFineSubstepCountRequested = 2,
  schroederSpatialArenaCount: spatialArenaCountRequested = null
} = {}) {
  const expectedBatchCount = exactNonNegativeIntegerOrNull(requestedBatchCount);
  const expectedBatchStepCount = exactNonNegativeIntegerOrNull(requestedBatchStepCount);
  const requestedShapeValid = Boolean(
    expectedBatchCount > 0 && expectedBatchStepCount > 0
  );
  const expectedStepCount = requestedShapeValid
    ? expectedBatchCount * expectedBatchStepCount
    : 0;
  const requestedSpatialArenaCount = spatialArenaCountRequested == null
    ? null
    : exactNonNegativeIntegerOrNull(spatialArenaCountRequested);
  // An authoritative two-level outer step legitimately consumes private fine
  // generations and position epochs between consecutive public transactions.
  // Physics ticks must remain contiguous; generation/position identities must
  // remain exact, unique, increasing, and aligned with their summaries, but
  // cannot truthfully be required to advance by exactly one.
  const authoritativePrivateAdvance = twoLevelMechanicsRequested === true
    && twoLevelMechanicsAuthorityRequested === 'authoritative';
  const residentBatchMetrics = (Array.isArray(metrics) ? metrics : [])
    .filter((entry) => (
      entry?.phase === 'resident-batch'
      && Number.isInteger(Number(entry?.batchIndex))
      && Number(entry.batchIndex) > 0
    ))
    .sort((a, b) => Number(a.batchIndex) - Number(b.batchIndex));
  const observedBatchIndices = residentBatchMetrics.map((entry) => Number(entry.batchIndex));
  const expectedBatchIndices = requestedShapeValid
    ? Array.from({ length: expectedBatchCount }, (_, index) => index + 1)
    : [];
  const batchIndexCoverageComplete = requestedShapeValid
    && observedBatchIndices.length === expectedBatchIndices.length
    && observedBatchIndices.every((batchIndex, index) => batchIndex === expectedBatchIndices[index]);
  const batchEvidence = residentBatchMetrics.map((entry) => {
    const residentSteps = entry?.residentSteps || null;
    const transactions = Array.isArray(residentSteps?.schroederSpatialEpochTransactionSummaries)
      ? residentSteps.schroederSpatialEpochTransactionSummaries
      : [];
    const generations = Array.isArray(residentSteps?.schroederSpatialEpochGenerationSummaries)
      ? residentSteps.schroederSpatialEpochGenerationSummaries
      : [];
    const artifactLedgers = Array.isArray(
      residentSteps?.schroederHierarchyArtifactLedgerSummaries
    ) ? residentSteps.schroederHierarchyArtifactLedgerSummaries : [];
    const completedStepCount = exactNonNegativeIntegerOrNull(residentSteps?.completedStepCount);
    const nextStep = exactNonNegativeIntegerOrNull(residentSteps?.nextStep);
    const releaseSettlementCount = exactNonNegativeIntegerOrNull(
      residentSteps?.schroederSpatialEpochReleaseSettlementCount
    );
    const releaseSettlementComplete =
      residentSteps?.schroederSpatialEpochReleaseSettlementComplete === true;
    const artifactLedgerSettlementCount = exactNonNegativeIntegerOrNull(
      residentSteps?.schroederHierarchyArtifactLedgerSettlementCount
    );
    const artifactLedgerSettlementComplete =
      residentSteps?.schroederHierarchyArtifactLedgerSettlementComplete === true;
    const telemetry = entry?.schroederTelemetry || null;
    const residentTwoLevelAuthoritativeStepCount = exactNonNegativeIntegerOrNull(
      residentSteps?.schroederTwoLevelAuthoritativeStepCount
    );
    const telemetryTwoLevelAuthoritativeStepCount = exactNonNegativeIntegerOrNull(
      telemetry?.twoLevelAuthoritativeStepCount
    );
    const twoLevelAuthoritativeStepCount =
      residentTwoLevelAuthoritativeStepCount
      ?? telemetryTwoLevelAuthoritativeStepCount;
    const twoLevelAuthoritativeStepCountAgreement =
      residentTwoLevelAuthoritativeStepCount !== null
      && telemetryTwoLevelAuthoritativeStepCount !== null
      && residentTwoLevelAuthoritativeStepCount
        === telemetryTwoLevelAuthoritativeStepCount;
    const twoLevelMechanicsCoverageComplete = twoLevelMechanicsRequested !== true
      ? null
      : Boolean(
        telemetry?.twoLevelMechanicsRequested === true
        && telemetry?.twoLevelMechanicsActive === true
        && telemetry?.twoLevelMechanicsAuthorityRequested
          === twoLevelMechanicsAuthorityRequested
        && telemetry?.twoLevelMechanicsAuthorityObserved
          === twoLevelMechanicsAuthorityRequested
        && Number(telemetry?.twoLevelFineSubstepCountRequested)
          === Number(twoLevelFineSubstepCountRequested)
        && Number(telemetry?.twoLevelFineSubstepCountObserved)
          === Number(twoLevelFineSubstepCountRequested)
        && telemetry?.twoLevelMechanicsStepStatus
          === 'schroeder-two-level-authoritative-step-executed'
        && telemetry?.twoLevelAuthoritativeCommitVerified === true
        && telemetry?.twoLevelMechanicsCoverageComplete === true
        && twoLevelAuthoritativeStepCountAgreement
        && twoLevelAuthoritativeStepCount === completedStepCount
      );
    const physicsTicks = transactions.map(
      (transaction) => exactNonNegativeIntegerOrNull(transaction?.epochIdentity?.physicsTick)
    );
    const positionEpochs = transactions.map(
      (transaction) => exactNonNegativeIntegerOrNull(transaction?.epochIdentity?.positionEpoch)
    );
    const transactionGenerationIds = transactions.map(
      (transaction) => exactNonNegativeIntegerOrNull(transaction?.generationId)
    );
    const generationSummaryIds = generations.map(
      (generation) => exactNonNegativeIntegerOrNull(generation?.generationId)
    );
    const physicsTickSequence = exactIntegerSequenceEvidence(physicsTicks);
    const positionEpochEvidence = positionEpochSequenceWithTransitionProof({
      positionEpochs,
      transactions,
      authoritativePrivateAdvance
    });
    const positionEpochSequence = positionEpochEvidence.sequence;
    const positionEpochTransitionEvidence = positionEpochEvidence.transitionEvidence;
    const transactionGenerationSequence = exactIntegerSequenceEvidence(
      transactionGenerationIds,
      { requireContiguous: !authoritativePrivateAdvance }
    );
    const generationSummarySequence = exactIntegerSequenceEvidence(generationSummaryIds, {
      requireContiguous: !authoritativePrivateAdvance
    });
    const transactionGenerationAlignmentComplete = transactionGenerationIds.length === generationSummaryIds.length
      && transactionGenerationIds.every(
        (generationId, index) => generationId === generationSummaryIds[index]
      );
    const artifactLedgerGenerationAlignmentComplete =
      transactionGenerationIds.length === artifactLedgers.length
      && transactionGenerationIds.every((generationId, index) => (
        generationId === exactNonNegativeIntegerOrNull(
          artifactLedgers[index]?.spatialEpochGenerationId
        )
      ));
    const nextStepAlignmentComplete = Number.isInteger(nextStep)
      && physicsTicks.length > 0
      && physicsTicks.at(-1) + 1 === nextStep
      && physicsTicks[0] === nextStep - physicsTicks.length;
    return {
      batchIndex: Number(entry.batchIndex),
      residentStepsStatus: residentSteps?.status ?? null,
      completedStepCount,
      nextStep,
      releaseSettlementCount,
      releaseSettlementComplete,
      artifactLedgerSettlementCount,
      artifactLedgerSettlementComplete,
      schroederSimulationActive: telemetry?.active === true,
      twoLevelMechanicsCoverageComplete,
      twoLevelAuthoritativeStepCount,
      residentTwoLevelAuthoritativeStepCount,
      telemetryTwoLevelAuthoritativeStepCount,
      twoLevelAuthoritativeStepCountAgreement,
      transactionCount: transactions.length,
      generationSummaryCount: generations.length,
      artifactLedgerSummaryCount: artifactLedgers.length,
      physicsTickSequence,
      positionEpochSequence,
      positionEpochTransitionEvidence,
      transactionGenerationSequence,
      generationSummarySequence,
      transactionGenerationAlignmentComplete,
      artifactLedgerGenerationAlignmentComplete,
      nextStepAlignmentComplete,
      transactions,
      generations,
      artifactLedgers
    };
  });
  const completedStepCount = batchEvidence.reduce(
    (sum, batch) => sum + (batch.completedStepCount ?? 0),
    0
  );
  const completedStepCoverageComplete = requestedShapeValid
    && batchEvidence.length === expectedBatchCount
    && batchEvidence.every((batch) => (
      batch.residentStepsStatus === 'resident-steps-executed'
      && batch.completedStepCount === expectedBatchStepCount
    ))
    && completedStepCount === expectedStepCount;
  const releaseSettlementCount = batchEvidence.reduce(
    (sum, batch) => sum + (batch.releaseSettlementCount ?? 0),
    0
  );
  const releaseSettlementCoverageComplete = requestedShapeValid
    && batchEvidence.length === expectedBatchCount
    && batchEvidence.every((batch) => (
      batch.releaseSettlementComplete === true
      && batch.releaseSettlementCount === expectedBatchStepCount
      && batch.releaseSettlementCount === batch.completedStepCount
    ))
    && releaseSettlementCount === expectedStepCount;
  const nextStepSequence = exactIntegerSequenceEvidence(
    batchEvidence.map((batch) => batch.nextStep),
    { requireContiguous: false }
  );
  const nextStepStrideCoverageComplete = nextStepSequence.complete
    && batchEvidence.every((batch, index) => (
      batch.nextStepAlignmentComplete
      && (
        index === 0
        || batch.nextStep - batchEvidence[index - 1].nextStep === batch.completedStepCount
      )
    ));
  const transactions = batchEvidence.flatMap((batch) => batch.transactions);
  const generations = batchEvidence.flatMap((batch) => batch.generations);
  const artifactLedgers = batchEvidence.flatMap((batch) => batch.artifactLedgers);
  const admittedConsumerReceiptTelemetry = Object.freeze(
    transactions.flatMap((transaction) => (
      Array.isArray(transaction?.admittedReaders)
        ? transaction.admittedReaders
          .map((reader) => reader?.receiptTelemetry ?? null)
          .filter(Boolean)
        : []
    ))
  );
  const transactionGenerationIds = transactions.map(
    (transaction) => exactNonNegativeIntegerOrNull(transaction?.generationId)
  );
  const transactionPhysicsTicks = transactions.map(
    (transaction) => exactNonNegativeIntegerOrNull(transaction?.epochIdentity?.physicsTick)
  );
  const transactionPositionEpochs = transactions.map(
    (transaction) => exactNonNegativeIntegerOrNull(transaction?.epochIdentity?.positionEpoch)
  );
  const generationSummaryIds = generations.map(
    (generation) => exactNonNegativeIntegerOrNull(generation?.generationId)
  );
  const transactionGenerationSequence = exactIntegerSequenceEvidence(transactionGenerationIds, {
    requireContiguous: !authoritativePrivateAdvance
  });
  const transactionPhysicsTickSequence = exactIntegerSequenceEvidence(transactionPhysicsTicks);
  const transactionPositionEpochEvidence = positionEpochSequenceWithTransitionProof({
    positionEpochs: transactionPositionEpochs,
    transactions,
    authoritativePrivateAdvance
  });
  const transactionPositionEpochSequence = transactionPositionEpochEvidence.sequence;
  const transactionPositionEpochTransitionEvidence =
    transactionPositionEpochEvidence.transitionEvidence;
  const generationSummarySequence = exactIntegerSequenceEvidence(generationSummaryIds, {
    requireContiguous: !authoritativePrivateAdvance
  });
  const transactionGenerationAlignmentComplete = transactionGenerationIds.length === generationSummaryIds.length
    && transactionGenerationIds.every(
      (generationId, index) => generationId === generationSummaryIds[index]
    );
  const artifactLedgerGenerationAlignmentComplete =
    transactionGenerationIds.length === artifactLedgers.length
    && transactionGenerationIds.every((generationId, index) => (
      generationId === exactNonNegativeIntegerOrNull(
        artifactLedgers[index]?.spatialEpochGenerationId
      )
    ));
  const transactionCounterTotals = Object.fromEntries(
    SCHROEDER_TRANSACTION_COUNTER_KEYS.map((key) => [key, 0])
  );
  let transactionCountersComplete = true;
  for (const transaction of transactions) {
    const counters = transaction?.counters || null;
    for (const key of SCHROEDER_TRANSACTION_COUNTER_KEYS) {
      const value = exactNonNegativeIntegerOrNull(counters?.[key]);
      if (value === null) {
        transactionCountersComplete = false;
      } else {
        transactionCounterTotals[key] += value;
      }
    }
  }
  const transactionExactOnceCoverageComplete = transactions.length === expectedStepCount
    && transactions.every((transaction) => {
      const counters = transaction?.counters || null;
      return counters?.epochCount === 1
        && counters?.directoryBuildCount === 1
        && counters?.sortUniqueCount === 1
        && counters?.privateCanonicalLookupBuildCount === 0
        && counters?.readerRejectCount === 0
        && counters?.proposalSealCount === 1
        && counters?.privateAdvanceCount
          === (authoritativePrivateAdvance ? 1 : 0)
        && counters?.commitCount
          === (authoritativePrivateAdvance ? 0 : 1)
        && counters?.releaseScheduleCount === 1
        && counters?.releaseRetryCount === 0
        && counters?.releaseCount === 1
        && counters?.staleLawInputForwardCount === 0;
    });
  const transactionLifecycleCoverageComplete = transactions.length === expectedStepCount
    && transactions.every((transaction) => transaction?.state === 'released')
    && transactionCountersComplete
    && transactionExactOnceCoverageComplete
    && transactionCounterTotals.epochCount === expectedStepCount
    && transactionCounterTotals.directoryBuildCount === expectedStepCount
    && transactionCounterTotals.sortUniqueCount === expectedStepCount
    && transactionCounterTotals.privateCanonicalLookupBuildCount === 0
    && transactionCounterTotals.readerRejectCount === 0
    && transactionCounterTotals.proposalSealCount === expectedStepCount
    && transactionCounterTotals.privateAdvanceCount
      === (authoritativePrivateAdvance ? expectedStepCount : 0)
    && transactionCounterTotals.commitCount
      === (authoritativePrivateAdvance ? 0 : expectedStepCount)
    && transactionCounterTotals.releaseScheduleCount === expectedStepCount
    && transactionCounterTotals.releaseRetryCount === 0
    && transactionCounterTotals.releaseCount === expectedStepCount
    && transactionCounterTotals.staleLawInputForwardCount === 0;
  const generationCoverageComplete = generations.length === expectedStepCount
    && generationSummarySequence.complete
    && transactionGenerationAlignmentComplete
    && generations.every((generation) => (
      generation?.directoryBuildCount === 1
      && generation?.privateLookupBuildCount === 0
      && generation?.releaseScheduled === true
      && generation?.releaseStatus
        === 'spatial-epoch-generation-released-after-final-consumer'
      && generation?.releaseAttemptCount === 1
      && generation?.releaseFailureCount === 0
    ));
  const artifactLedgerSettlementCount = batchEvidence.reduce(
    (sum, batch) => sum + (batch.artifactLedgerSettlementCount ?? 0),
    0
  );
  const artifactLedgerFailedDestroyResourceCount = artifactLedgers.reduce(
    (sum, ledger) => sum + (exactNonNegativeIntegerOrNull(
      ledger?.failedDestroyResourceCount
    ) ?? 0),
    0
  );
  const artifactLedgerBlockerCount = artifactLedgers.reduce(
    (sum, ledger) => sum + (exactNonNegativeIntegerOrNull(
      ledger?.blockerCount
    ) ?? 0),
    0
  );
  const artifactLedgerUnsafeUnretiredOwnedResourceCount = artifactLedgers.reduce(
    (sum, ledger) => sum + (exactNonNegativeIntegerOrNull(
      ledger?.unsafeUnretiredOwnedResourceCount
    ) ?? 0),
    0
  );
  const artifactLedgerCoverageComplete = artifactLedgers.length === expectedStepCount
    && artifactLedgerSettlementCount === expectedStepCount
    && artifactLedgerGenerationAlignmentComplete
    && batchEvidence.every((batch) => (
      batch.artifactLedgerSettlementComplete === true
      && batch.artifactLedgerSettlementCount === expectedBatchStepCount
      && batch.artifactLedgerSummaryCount === batch.completedStepCount
      && batch.artifactLedgerGenerationAlignmentComplete
    ))
    && artifactLedgers.every((ledger) => (
      ledger?.safe === true
      && ledger?.retirementScheduled === true
      && ledger?.retirementCompleted === true
      && ledger?.failedDestroyResourceCount === 0
      && ledger?.blockerCount === 0
      && ledger?.unsafeUnretiredOwnedResourceCount === 0
      && ledger?.resourceInventoryComplete === true
      && ledger?.unretiredOwnedResourceCountMatches === true
    ));
  const stepIdentityCoverageComplete = transactions.length === expectedStepCount
    && transactionGenerationSequence.complete
    && transactionPhysicsTickSequence.complete
    && transactionPositionEpochSequence.complete
    && batchEvidence.every((batch) => (
      batch.transactionCount === batch.completedStepCount
      && batch.generationSummaryCount === batch.completedStepCount
      && batch.physicsTickSequence.complete
      && batch.positionEpochSequence.complete
      && batch.transactionGenerationSequence.complete
      && batch.generationSummarySequence.complete
      && batch.transactionGenerationAlignmentComplete
    ));
  const schroederSimulationActiveBatchCount = batchEvidence.filter(
    (batch) => batch.schroederSimulationActive
  ).length;
  const schroederSimulationActive = batchIndexCoverageComplete
    && schroederSimulationActiveBatchCount === expectedBatchCount;
  const twoLevelMechanicsCoverageComplete = twoLevelMechanicsRequested !== true
    ? null
    : Boolean(
      batchIndexCoverageComplete
      && batchEvidence.length === expectedBatchCount
      && batchEvidence.every(
        (batch) => batch.twoLevelMechanicsCoverageComplete === true
      )
    );
  const twoLevelAuthoritativeStepCount = batchEvidence.reduce(
    (sum, batch) => sum + (batch.twoLevelAuthoritativeStepCount ?? 0),
    0
  );
  const backpressureWaitCount = generations.reduce(
    (sum, generation) => sum + (exactNonNegativeIntegerOrNull(generation?.backpressureWaitCount) ?? 0),
    0
  );
  const backpressureWaitMs = generations.reduce(
    (sum, generation) => sum + (Number(generation?.backpressureWaitMs) || 0),
    0
  );
  const observedSpatialArenaCounts = Array.from(new Set(
    generations.map((generation) => exactNonNegativeIntegerOrNull(
      generation?.directArenaCount ?? generation?.arenaCapacity
    )).filter((arenaCount) => arenaCount !== null)
  )).sort((a, b) => a - b);
  const spatialArenaCountCoverageComplete = requestedSpatialArenaCount === null
    ? null
    : Boolean(
      requestedSpatialArenaCount >= 1
      && generations.length === expectedStepCount
      && generations.every((generation) => (
        exactNonNegativeIntegerOrNull(generation?.directArenaCount)
          === requestedSpatialArenaCount
        && exactNonNegativeIntegerOrNull(generation?.arenaCapacity)
          === requestedSpatialArenaCount
      ))
    );
  const transactionCoverageComplete = simulationRequested !== true
    ? null
    : Boolean(
      requestedShapeValid
      && schroederSimulationActive
      && batchIndexCoverageComplete
      && completedStepCoverageComplete
      && releaseSettlementCoverageComplete
      && nextStepStrideCoverageComplete
      && stepIdentityCoverageComplete
      && generationCoverageComplete
      && artifactLedgerCoverageComplete
      && transactionLifecycleCoverageComplete
    );
  return {
    requestedBatchCount: expectedBatchCount,
    requestedBatchStepCount: expectedBatchStepCount,
    expectedStepCount,
    observedBatchCount: residentBatchMetrics.length,
    observedBatchIndices,
    batchIndexCoverageComplete,
    completedStepCount,
    completedStepCoverageComplete,
    releaseSettlementCount,
    releaseSettlementCoverageComplete,
    nextStepSequence,
    nextStepStrideCoverageComplete,
    transactionMountedCount: transactions.length,
    transactionGenerationCount: new Set(
      transactionGenerationIds.filter(Number.isInteger)
    ).size,
    transactionPhysicsTickCount: new Set(
      transactionPhysicsTicks.filter(Number.isInteger)
    ).size,
    transactionPositionEpochCount: new Set(
      transactionPositionEpochs.filter(Number.isInteger)
    ).size,
    transactionGenerationSequence,
    transactionPhysicsTickSequence,
    transactionPositionEpochSequence,
    transactionPositionEpochTransitionEvidence,
    transactionCounterTotals,
    transactionCountersComplete,
    transactionExactOnceCoverageComplete,
    transactionLifecycleCoverageComplete,
    generationSummaryCount: generations.length,
    generationSummaryGenerationCount: new Set(
      generationSummaryIds.filter(Number.isInteger)
    ).size,
    generationSummarySequence,
    generationCoverageComplete,
    artifactLedgerSummaryCount: artifactLedgers.length,
    artifactLedgerSettlementCount,
    artifactLedgerFailedDestroyResourceCount,
    artifactLedgerBlockerCount,
    artifactLedgerUnsafeUnretiredOwnedResourceCount,
    artifactLedgerGenerationAlignmentComplete,
    artifactLedgerCoverageComplete,
    transactionGenerationAlignmentComplete,
    stepIdentityCoverageComplete,
    admittedConsumerReceiptTelemetry,
    schroederSimulationActive,
    schroederSimulationActiveBatchCount,
    twoLevelMechanicsRequested: twoLevelMechanicsRequested === true,
    twoLevelMechanicsAuthorityRequested,
    twoLevelFineSubstepCountRequested,
    twoLevelMechanicsCoverageComplete,
    twoLevelAuthoritativeStepCount,
    backpressureWaitCount,
    backpressureWaitMs,
    requestedSpatialArenaCount,
    observedSpatialArenaCounts,
    spatialArenaCountCoverageComplete,
    batchCoverage: batchEvidence.map((batch) => ({
      batchIndex: batch.batchIndex,
      residentStepsStatus: batch.residentStepsStatus,
      completedStepCount: batch.completedStepCount,
      nextStep: batch.nextStep,
      schroederSimulationActive: batch.schroederSimulationActive,
      twoLevelMechanicsCoverageComplete:
        batch.twoLevelMechanicsCoverageComplete,
      twoLevelAuthoritativeStepCount:
        batch.twoLevelAuthoritativeStepCount,
      residentTwoLevelAuthoritativeStepCount:
        batch.residentTwoLevelAuthoritativeStepCount,
      telemetryTwoLevelAuthoritativeStepCount:
        batch.telemetryTwoLevelAuthoritativeStepCount,
      twoLevelAuthoritativeStepCountAgreement:
        batch.twoLevelAuthoritativeStepCountAgreement,
      transactionCount: batch.transactionCount,
      generationSummaryCount: batch.generationSummaryCount,
      physicsTickStart: batch.physicsTickSequence.start,
      physicsTickEnd: batch.physicsTickSequence.end,
      positionEpochStart: batch.positionEpochSequence.start,
      positionEpochEnd: batch.positionEpochSequence.end,
      positionEpochTransitionEvidence: batch.positionEpochTransitionEvidence,
      generationIdStart: batch.transactionGenerationSequence.start,
      generationIdEnd: batch.transactionGenerationSequence.end,
      transactionGenerationAlignmentComplete: batch.transactionGenerationAlignmentComplete,
      nextStepAlignmentComplete: batch.nextStepAlignmentComplete
    })),
    transactionCoverageComplete
  };
}

function summarizeProbeResult({ targetParticleCount, scenario, result, exit }) {
  const analysis = result?.analysis || {};
  const metrics = Array.isArray(result?.timeline?.metrics) ? result.timeline.metrics : [];
  const thermalCandidateCsrRouteEvidenceByBatch = metrics
    .filter((entry) => entry?.phase === 'resident-batch')
    .map((entry) => ({
      batchIndex: entry.batchIndex ?? null,
      ...(entry.thermalCandidateCsrRouteEvidence || {
        schema: 'peercompute.ulg.sph-probe-thermal-candidate-csr-route-evidence.v1',
        status: 'not-published'
      })
    }));
  const thermalCandidateCsrRouteEvidence =
    thermalCandidateCsrRouteEvidenceByBatch.at(-1) || null;
  const thermalCandidateCsrRouteCounts = {
    uniformCompletion: thermalCandidateCsrRouteEvidenceByBatch.filter(
      (evidence) => evidence?.uniformCompletion === true
    ).length,
    replay: thermalCandidateCsrRouteEvidenceByBatch.filter(
      (evidence) => evidence?.replay === true
    ).length,
    exactNearRewalk: thermalCandidateCsrRouteEvidenceByBatch.filter(
      (evidence) => evidence?.exactNearRewalk === true
    ).length,
    sealed: thermalCandidateCsrRouteEvidenceByBatch.filter(
      (evidence) => evidence?.sealed === true
    ).length,
    captured: thermalCandidateCsrRouteEvidenceByBatch.filter(
      (evidence) => evidence?.status === 'candidate-csr-route-evidence-captured'
    ).length
  };
  const gpuTimestampIntervalEvidence = summarizeResidentGpuTimestampEvidence({
    metrics,
    requested: measureGpuTimestampInterval,
    requestedBatchCount: batches,
    warmupBatchCount: gpuTimestampWarmupBatchCount
  });
  const gpuStageTimestampEvidence =
    summarizeResidentGpuStageTimestampEvidence({
      metrics,
      requested: measureGpuStageTimestamps,
      requestedBatchCount: batches,
      requestedBatchStepCount: batchSteps,
      warmupBatchCount: gpuTimestampWarmupBatchCount,
      twoLevelAuthoritative: Boolean(
        schroederTwoLevelMechanicsRequested
        && schroederTwoLevelMechanicsAuthority === 'authoritative'
      ),
      twoLevelFineSubstepCount: schroederTwoLevelFineSubstepCount,
      requireMigratedLawCoverage: requireMigratedLawGpuStageTimestamps,
      lawThermalEnabled: lawThermal,
      lawReactionsEnabled: lawReactions
    });
  const initialMetric = metrics.find((entry) => entry?.initial) || null;
  const initialParticleEdgeDiagnostics = initialMetric?.initial?.initialParticleEdgeDiagnostics || null;
  const metric = lastMetricWithRenderState(result);
  const renderState = metric?.renderState || null;
  const surfaceDraw = metric?.surfaceDraw || null;
  const currentSurfaceDraw = currentResidentSurfaceDrawEvidence({
    surfaceDraw,
    renderState
  });
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
  const probeResidentBatchThermalCandidateCsrRouteReadbackMs = numberOrNull(
    probeResidentBatchTiming?.thermalCandidateCsrRouteReadbackMs
  );
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
  const schroederTelemetry = metric?.schroederTelemetry || null;
  const schroederSimulationRequestedMetric = schroederTelemetry?.requested ?? null;
  const schroederSimulationRequestedObserved = schroederSimulationRequestedMetric;
  const schroederResidentBatchEvidence = aggregateSchroederResidentBatchEvidence({
    metrics,
    requestedBatchCount: batches,
    requestedBatchStepCount: batchSteps,
    schroederSimulationRequested,
    schroederTwoLevelMechanicsRequested,
    schroederTwoLevelMechanicsAuthority,
    schroederTwoLevelFineSubstepCount,
    schroederSpatialArenaCount
  });
  const schroederSimulationActive = schroederSimulationRequested === true
    ? schroederResidentBatchEvidence.schroederSimulationActive
    : (schroederTelemetry?.active ?? null);
  const schroederTransactionCoverageComplete =
    schroederResidentBatchEvidence.transactionCoverageComplete;
  const schroederTwoLevelMechanicsRequestedObserved =
    schroederTelemetry?.twoLevelMechanicsRequested ?? null;
  const schroederTwoLevelMechanicsCoverageComplete =
    schroederResidentBatchEvidence.twoLevelMechanicsCoverageComplete;
  const schroederTwoLevelMechanicsAuthorityObserved =
    schroederTelemetry?.twoLevelMechanicsAuthorityObserved ?? null;
  const schroederTwoLevelFineSubstepCountObserved = numberOrNull(
    schroederTelemetry?.twoLevelFineSubstepCountObserved
  );
  const schroederTwoLevelMechanicsStepStatus =
    schroederTelemetry?.twoLevelMechanicsStepStatus ?? null;
  const schroederTwoLevelAuthoritativeCommitVerified =
    schroederTelemetry?.twoLevelAuthoritativeCommitVerified ?? null;
  const schroederTransactionMountedCount =
    schroederResidentBatchEvidence.transactionMountedCount;
  const schroederTransactionGenerationCount =
    schroederResidentBatchEvidence.transactionGenerationCount;
  const schroederTransactionPhysicsTickCount =
    schroederResidentBatchEvidence.transactionPhysicsTickCount;
  const schroederTransactionPositionEpochCount =
    schroederResidentBatchEvidence.transactionPositionEpochCount;
  const schroederTransactionCounterTotals =
    schroederResidentBatchEvidence.transactionCounterTotals;
  const schroederAdmittedConsumerReceiptTelemetry =
    schroederResidentBatchEvidence.admittedConsumerReceiptTelemetry;
  const schroederBackpressureWaitCount =
    schroederResidentBatchEvidence.backpressureWaitCount;
  const schroederBackpressureWaitMs =
    schroederResidentBatchEvidence.backpressureWaitMs;
  const schroederConfigSource = schroederTelemetry?.configSource ?? null;
  const schroederSelectedLevelMetric = numberOrNull(schroederTelemetry?.selectedLevel);
  const schroederSequenceStatus = schroederTelemetry?.sequenceStatus ?? null;
  const schroederMechanicsStatus = schroederTelemetry?.mechanicsStatus ?? null;
  const schroederResidentComputeManagerMode = schroederTelemetry?.residentComputeManagerMode ?? null;
  const schroederPortableSummaryStatus = schroederTelemetry?.portableSummaryStatus ?? null;
  const schroederRenderLodStatus = schroederTelemetry?.renderLodStatus ?? null;
  const schroederNativeGridSpacingM = numberOrNull(schroederTelemetry?.nativeGridSpacingM);
  const schroederActiveLeafProxyCount = numberOrNull(schroederTelemetry?.activeLeafProxyCount);
  const schroederAggregateProxyCount = numberOrNull(schroederTelemetry?.aggregateProxyCount);
  const schroederLawQueueProxyCount = numberOrNull(schroederTelemetry?.lawQueueProxyCount);
  const schroederRenderSourceStatus = schroederTelemetry?.renderSourceStatus ?? null;
  const schroederRenderSourcePresentationReady = schroederTelemetry?.renderSourcePresentationReady ?? null;
  const schroederDrawSourceStatus = schroederTelemetry?.drawSourceStatus ?? null;
  const schroederDrawBatchCount = numberOrNull(schroederTelemetry?.drawBatchCount);
  const schroederLocalRetainedResolverStatus = schroederTelemetry?.localRetainedResolverStatus ?? null;
  const schroederLocalRetainedRefCount = numberOrNull(schroederTelemetry?.localRetainedRefCount);
  const schroederBackendSelectionStatus = schroederTelemetry?.backendSelectionStatus ?? null;
  const schroederBackendSelected = schroederTelemetry?.backendSelected ?? null;
  const schroederBackendNativeSubmitReady = schroederTelemetry?.backendNativeSubmitReady ?? null;
  const schroederNativeExecutorStatus = schroederTelemetry?.nativeExecutorStatus ?? null;
  const schroederNativeExecutorReady = schroederTelemetry?.nativeExecutorReady ?? null;
  const schroederNativeExecutorDrawCommandCount =
    numberOrNull(schroederTelemetry?.nativeExecutorDrawCommandCount);
  const schroederNativeLastSubmitStatus = schroederTelemetry?.nativeLastSubmitStatus ?? null;
  const schroederNativeLastSubmitDrawCommandCount =
    numberOrNull(schroederTelemetry?.nativeLastSubmitDrawCommandCount);
  const schroederRenderFieldReadback = schroederTelemetry?.renderFieldReadback ?? null;
  const schroederRenderRowsReadback = schroederTelemetry?.renderRowsReadback ?? null;
  const schroederSurfaceDrawStatus = schroederTelemetry?.surfaceDrawStatus ?? null;
  const schroederSurfaceDrawBridge = schroederTelemetry?.surfaceDrawBridge ?? null;
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
  const surfaceDrawStatus = currentSurfaceDraw.status;
  const surfaceDrawBridge = currentSurfaceDraw.bridge;
  const surfaceDrawBridgeCapabilityStatus = surfaceDraw?.renderBridgeCapabilityStatus
    ?? renderState?.surfaceDrawRenderBridgeCapabilityStatus
    ?? null;
  const surfaceDrawBridgeCapabilityReason = surfaceDraw?.renderBridgeCapabilityReason
    ?? renderState?.surfaceDrawRenderBridgeCapabilityReason
    ?? null;
  const surfaceDrawBridgeRendererBackend = surfaceDraw?.renderBridgeRendererBackend
    ?? renderState?.surfaceDrawRenderBridgeRendererBackend
    ?? null;
  const surfaceDrawBridgeVisibleNoReadbackSupported = surfaceDraw?.renderBridgeVisibleNoReadbackSupported
    ?? renderState?.surfaceDrawRenderBridgeVisibleNoReadbackSupported
    ?? null;
  const surfaceDrawGpuBufferHandoffReady = Boolean(
    currentSurfaceDraw.gpuBufferHandoffReady
  );
  const surfaceDrawGpuBufferHandoffStatus = currentSurfaceDraw.gpuBufferHandoffStatus;
  const surfaceDrawGpuBufferHandoffReason = currentSurfaceDraw.gpuBufferHandoffReason;
  const surfaceDrawGpuBufferHandoffKind = currentSurfaceDraw.gpuBufferHandoffKind;
  const surfaceDrawGpuBufferHandoffInputSchema = currentSurfaceDraw.gpuBufferHandoffInputSchema;
  const surfaceDrawGpuBufferHandoffRequiresSurfaceExtraction = Boolean(
    currentSurfaceDraw.gpuBufferHandoffRequiresSurfaceExtraction
  );
  const surfaceDrawGpuBufferHandoffUpperBoundVertexCount = numberOrNull(
    currentSurfaceDraw.gpuBufferHandoffUpperBoundVertexCount
  );
  const surfaceDrawVisibleGpuConsumerReady = Boolean(firstDefinedMetricValue(
    ownMetricValue(surfaceDraw, 'surfaceDrawVisibleGpuConsumerReady'),
    ownMetricValue(surfaceDraw, 'visibleGpuConsumerReady'),
    ownMetricValue(renderState, 'surfaceDrawVisibleGpuConsumerReady')
  ));
  const surfaceDrawVisibleGpuConsumerStatus = firstDefinedMetricValue(
    ownMetricValue(surfaceDraw, 'surfaceDrawVisibleGpuConsumerStatus'),
    ownMetricValue(surfaceDraw, 'visibleGpuConsumerStatus'),
    ownMetricValue(renderState, 'surfaceDrawVisibleGpuConsumerStatus')
  );
  const surfaceDrawVisibleGpuConsumerReason = firstDefinedMetricValue(
    ownMetricValue(surfaceDraw, 'surfaceDrawVisibleGpuConsumerReason'),
    ownMetricValue(surfaceDraw, 'visibleGpuConsumerReason'),
    ownMetricValue(renderState, 'surfaceDrawVisibleGpuConsumerReason')
  );
  const surfaceDrawVisibleGpuConsumerInputReady = Boolean(firstDefinedMetricValue(
    ownMetricValue(surfaceDraw, 'surfaceDrawVisibleGpuConsumerInputReady'),
    ownMetricValue(surfaceDraw, 'visibleGpuConsumerInputReady'),
    ownMetricValue(renderState, 'surfaceDrawVisibleGpuConsumerInputReady')
  ));
  const surfaceDrawVisibleGpuConsumerInputKind = firstDefinedMetricValue(
    ownMetricValue(surfaceDraw, 'surfaceDrawVisibleGpuConsumerInputKind'),
    ownMetricValue(surfaceDraw, 'visibleGpuConsumerInputKind'),
    ownMetricValue(renderState, 'surfaceDrawVisibleGpuConsumerInputKind')
  );
  const surfaceDrawVisibleGpuConsumerRuntimeReady = Boolean(firstDefinedMetricValue(
    ownMetricValue(surfaceDraw, 'surfaceDrawVisibleGpuConsumerRuntimeReady'),
    ownMetricValue(surfaceDraw, 'visibleGpuConsumerRuntimeReady'),
    ownMetricValue(renderState, 'surfaceDrawVisibleGpuConsumerRuntimeReady')
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
    currentSurfaceDraw.summaryReadbackByteLength
  );
  const surfaceDrawRowsBufferByteLength = numberOrNull(
    currentSurfaceDraw.rowsBufferByteLength
  );
  const surfaceDrawIndirectRowsBufferByteLength = numberOrNull(
    currentSurfaceDraw.indirectRowsBufferByteLength
  );
  const surfaceDrawCompactedVertexRowsBufferByteLength = numberOrNull(
    currentSurfaceDraw.compactedVertexRowsBufferByteLength
  );
  const surfaceDrawCompactPositionRowsBufferByteLength = numberOrNull(
    currentSurfaceDraw.compactPositionRowsBufferByteLength
  );
  const surfaceDrawRenderBridgeExternalGpuBufferInputLayout =
    currentSurfaceDraw.renderBridgeExternalGpuBufferInputLayout;
  const surfaceDrawCompactPositionRowsStrideFloats = numberOrNull(
    currentSurfaceDraw.compactPositionRowsStrideFloats
      ?? (surfaceDrawRenderBridgeExternalGpuBufferInputLayout === 'webgpu-marching-cubes-compact-position-rows' ? 4 : null)
  );
  const surfaceDrawCompactPositionRowsVertexCountDirect = numberOrNull(
    currentSurfaceDraw.compactPositionRowsVertexCount
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
    currentSurfaceDraw.directCompactPositionDraw;
  const surfaceDrawRenderBridgeCompactPositionDirectInput =
    currentSurfaceDraw.renderBridgeCompactPositionDirectInput;
  const surfaceDrawRenderFieldRowsBufferByteLength = numberOrNull(
    currentSurfaceDraw.renderFieldRowsBufferByteLength
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
    currentSurfaceDraw.renderFieldSurfaceBufferByteLength
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
  const sidecarAwareResidentSequence = residentStageTiming?.sidecarAwareResidentSequence
    || residentSteps?.sidecarAwareResidentSequence
    || residentStep?.sidecarAwareResidentSequence
    || null;
  const sidecarAwareDirectRunnerContract = sidecarAwareResidentSequence?.directRunnerContract
    || residentStageTiming?.sidecarAwareDirectRunnerContract
    || residentSteps?.sidecarAwareDirectRunnerContract
    || fusedResidentSequencePreflight?.sidecarAwareDirectRunnerContract
    || null;
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
    probeWallStepsPerSecond,
    probeEngineStepsPerSecond,
    estimatedReadbackBytesPerStep,
    activeGridDispatch,
    residentStageTiming,
    fusedResidentSequenceBlockedForSidecars,
    schroederSimulationRequested,
    schroederSimulationRequestedObserved,
    schroederSimulationActive,
    schroederTransactionCoverageComplete,
    schroederSpatialArenaCountRequested:
      schroederResidentBatchEvidence.requestedSpatialArenaCount,
    schroederSpatialArenaCountCoverageComplete:
      schroederResidentBatchEvidence.spatialArenaCountCoverageComplete,
    schroederTwoLevelMechanicsRequested,
    schroederTwoLevelMechanicsRequestedObserved,
    schroederTwoLevelMechanicsCoverageComplete,
    schroederTwoLevelMechanicsAuthorityRequested:
      schroederTwoLevelMechanicsAuthority,
    schroederTwoLevelMechanicsAuthorityObserved,
    schroederTwoLevelFineSubstepCountRequested:
      schroederTwoLevelFineSubstepCount,
    schroederTwoLevelFineSubstepCountObserved,
    schroederTwoLevelMechanicsStepStatus,
    schroederTwoLevelAuthoritativeCommitVerified,
    gpuTimestampIntervalEvidence,
    gpuTimestampRequired: requireGpuTimestampInterval,
    gpuStageTimestampEvidence,
    gpuStageTimestampsRequired: measureGpuStageTimestamps
  });
  const validDirectResidentLoop = effectiveProbeMode === 'direct-resident'
    && residentSteps?.status === 'resident-steps-executed'
    && (
      residentStep?.status === 'resident-step-webgpu-executed'
      || (
        schroederTwoLevelMechanicsRequested
        && residentStep?.status
          === 'schroeder-two-level-authoritative-step-executed'
      )
    )
    && fusedResidentSequenceRequirementSatisfied
    && fusedResidentActiveGridRequirementSatisfied;
  const scenarioTimingEvidenceAvailable = schroederTwoLevelMechanicsRequested
    ? Boolean(
      Number.isFinite(probeEngineBatchMs)
      && probeEngineBatchMs > 0
      && schroederTwoLevelMechanicsCoverageComplete === true
    )
    : Number.isFinite(residentStageMs);
  const benchmarkStatus = exit.code === 0
    && Number(browserConsoleIssueCount ?? 0) === 0
    && performanceGate.status === 'pass'
    && scenarioTimingEvidenceAvailable
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
    motionMaxSpeedObservedMPerS: analysis.motionMaxSpeedObservedMPerS ?? null,
    motionMaxDisplacementObservedM: analysis.motionMaxDisplacementObservedM ?? null,
    motionSpeedEvidenceSource: analysis.motionSpeedEvidenceSource ?? null,
    motionDisplacementEvidenceSource: analysis.motionDisplacementEvidenceSource ?? null,
    directResidentNoReadbackActiveGridMotionEvidenceAvailable:
      analysis.directResidentNoReadbackActiveGridMotionEvidenceAvailable ?? null,
    activeGridPredictedMaxDisplacementM: analysis.activeGridPredictedMaxDisplacementM ?? null,
    activeGridPredictedMaxSpeedMPerS: analysis.activeGridPredictedMaxSpeedMPerS ?? null,
    exitCode: exit.code,
    signal: exit.signal,
    scenarioUrl: scenario.url,
    batches,
    batchSteps,
    completedStepCount,
    meanBatchMs,
    maxBatchMs: analysis.maxBatchMs ?? null,
    physicsStepsPerSecond: probeEngineStepsPerSecond ?? probeWallStepsPerSecond,
    physicsStepsPerSecondSource: probeEngineStepsPerSecond !== null
      ? 'complete-engine-batch'
      : 'complete-probe-wall-batch',
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
    scenarioTimingEvidenceAvailable,
    scenarioTimingEvidenceSource: schroederTwoLevelMechanicsRequested
      ? 'authoritative-two-level-complete-engine-batch'
      : 'resident-stage-timing',
    performanceGate,
    gpuTimestampIntervalEvidence,
    gpuStageTimestampEvidence,
    thermalCandidateCsrRouteEvidenceRequested:
      captureThermalCandidateCsrRouteEvidence,
    thermalCandidateCsrRouteEvidence,
    thermalCandidateCsrRouteEvidenceByBatch,
    thermalCandidateCsrRouteCounts,
    probeResidentBatchTiming,
    probeResidentBatchResidentStepsAwaitMs,
    probeResidentBatchThermalCandidateCsrRouteReadbackMs,
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
    fusedResidentSequenceSidecarOnlyBlocked:
      fusedResidentSequencePreflight?.sidecarOnlySequenceBlocked ?? null,
    sidecarAwareResidentSequenceCandidate:
      fusedResidentSequencePreflight?.sidecarAwareSequenceCandidate ?? null,
    sidecarAwareResidentSequencePreflightStatus:
      fusedResidentSequencePreflight?.sidecarAwareSequenceStatus ?? null,
    sidecarAwareResidentSequenceMode:
      sidecarAwareResidentSequence?.mode ?? fusedResidentSequencePreflight?.sidecarAwareSequenceMode ?? null,
    sidecarAwareResidentSequenceRunner:
      sidecarAwareResidentSequence?.runner ?? fusedResidentSequencePreflight?.sidecarAwareSequenceRunner ?? null,
    sidecarAwareResidentSequencePath:
      sidecarAwareResidentSequence?.sequencePath ?? fusedResidentSequencePreflight?.sidecarAwareSequencePath ?? null,
    sidecarAwareDirectRunnerContractStatus:
      sidecarAwareDirectRunnerContract?.status
      ?? residentStageTiming?.sidecarAwareDirectRunnerContractStatus
      ?? residentSteps?.sidecarAwareDirectRunnerContractStatus
      ?? fusedResidentSequencePreflight?.sidecarAwareDirectRunnerContractStatus
      ?? null,
    sidecarAwareDirectRunnerEligible:
      sidecarAwareDirectRunnerContract?.directRunnerEligible
      ?? residentSteps?.sidecarAwareDirectRunnerEligible
      ?? fusedResidentSequencePreflight?.sidecarAwareDirectRunnerEligible
      ?? null,
    sidecarAwareDirectRunnerRunnable:
      sidecarAwareDirectRunnerContract?.directRunnerRunnable
      ?? residentSteps?.sidecarAwareDirectRunnerRunnable
      ?? fusedResidentSequencePreflight?.sidecarAwareDirectRunnerRunnable
      ?? null,
    sidecarAwareDirectRunnerSelected:
      sidecarAwareDirectRunnerContract?.directRunnerSelected
      ?? residentSteps?.sidecarAwareDirectRunnerSelected
      ?? fusedResidentSequencePreflight?.sidecarAwareDirectRunnerSelected
      ?? null,
    sidecarAwareDirectRunnerSelectionStatus:
      sidecarAwareDirectRunnerContract?.directRunnerSelectionStatus
      ?? fusedResidentSequencePreflight?.sidecarAwareDirectRunnerSelectionStatus
      ?? null,
    sidecarAwareDirectRunnerSelectionBlockers:
      [...(sidecarAwareDirectRunnerContract?.directRunnerSelectionBlockers || [])],
    thermalSidecarDirectRunnerStatus:
      residentStageTiming?.thermalSidecarDirectRunnerStatus
      ?? residentStep?.thermalSidecarDirectRunnerStatus
      ?? null,
    thermalSidecarDirectRunnerGenericEntrypointBypassed:
      residentStageTiming?.thermalSidecarDirectRunnerGenericEntrypointBypassed
      ?? residentStageTiming?.thermalSidecarDirectRunner?.genericResidentStepEntrypointBypassed
      ?? residentStep?.thermalSidecarDirectRunnerGenericEntrypointBypassed
      ?? residentStep?.thermalSidecarDirectRunner?.genericResidentStepEntrypointBypassed
      ?? null,
    sidecarAwareResidentSequenceActive:
      residentStageTiming?.sidecarAwareResidentSequenceActive
      ?? residentSteps?.sidecarAwareResidentSequenceActive
      ?? null,
    sidecarAwareResidentSequenceStatus:
      sidecarAwareResidentSequence?.status ?? null,
    sidecarAwareResidentSequenceExecuted:
      sidecarAwareResidentSequence?.sidecarAwareSequenceExecuted ?? null,
    sidecarAwareResidentSequenceStepCount:
      sidecarAwareResidentSequence?.stepCount ?? null,
    sidecarAwareResidentSequenceCompletedStepCount:
      sidecarAwareResidentSequence?.completedStepCount ?? null,
    sidecarAwareResidentSequencePassedStepCount:
      sidecarAwareResidentSequence?.passedStepCount ?? null,
    sidecarAwareResidentSequencePartialStepCount:
      sidecarAwareResidentSequence?.partialStepCount ?? null,
    sidecarAwareResidentSequenceAllStepsPassed:
      sidecarAwareResidentSequence?.allStepsPassed ?? null,
    sidecarAwareResidentSequencePromotesFusedSequence:
      sidecarAwareResidentSequence?.promotesFusedSequence ?? null,
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
    schroederTelemetry,
    schroederSimulationConfiguredRequested: schroederSimulationRequested,
    schroederSimulationRequested: schroederSimulationRequestedMetric,
    schroederSimulationRequestedObserved,
    schroederSimulationActive,
    schroederTransactionCoverageComplete,
    schroederSpatialArenaCountRequested:
      schroederResidentBatchEvidence.requestedSpatialArenaCount,
    schroederSpatialArenaCountsObserved:
      schroederResidentBatchEvidence.observedSpatialArenaCounts,
    schroederSpatialArenaCountCoverageComplete:
      schroederResidentBatchEvidence.spatialArenaCountCoverageComplete,
    schroederTwoLevelMechanicsConfiguredRequested:
      schroederTwoLevelMechanicsRequested,
    schroederTwoLevelMechanicsRequestedObserved,
    schroederTwoLevelMechanicsCoverageComplete,
    schroederTwoLevelMechanicsAuthorityRequested:
      schroederTwoLevelMechanicsAuthority,
    schroederTwoLevelMechanicsAuthorityObserved,
    schroederTwoLevelFineSubstepCountRequested:
      schroederTwoLevelFineSubstepCount,
    schroederTwoLevelFineSubstepCountObserved,
    schroederTwoLevelMechanicsStepStatus,
    schroederTwoLevelAuthoritativeCommitVerified,
    schroederTwoLevelAuthoritativeStepCount:
      schroederResidentBatchEvidence.twoLevelAuthoritativeStepCount,
    schroederTransactionExpectedStepCount: schroederSimulationRequested === true
      ? schroederResidentBatchEvidence.expectedStepCount
      : 0,
    schroederTransactionCompletedStepCount:
      schroederResidentBatchEvidence.completedStepCount,
    schroederTransactionExpectedBatchCount:
      schroederResidentBatchEvidence.requestedBatchCount,
    schroederTransactionObservedBatchCount:
      schroederResidentBatchEvidence.observedBatchCount,
    schroederTransactionObservedBatchIndices:
      schroederResidentBatchEvidence.observedBatchIndices,
    schroederTransactionBatchCoverageComplete:
      schroederResidentBatchEvidence.batchIndexCoverageComplete,
    schroederTransactionCompletedStepCoverageComplete:
      schroederResidentBatchEvidence.completedStepCoverageComplete,
    schroederSpatialEpochReleaseSettlementCount:
      schroederResidentBatchEvidence.releaseSettlementCount,
    schroederSpatialEpochReleaseSettlementCoverageComplete:
      schroederResidentBatchEvidence.releaseSettlementCoverageComplete,
    schroederTransactionNextStepStrideCoverageComplete:
      schroederResidentBatchEvidence.nextStepStrideCoverageComplete,
    schroederTransactionStepIdentityCoverageComplete:
      schroederResidentBatchEvidence.stepIdentityCoverageComplete,
    schroederTransactionLifecycleCoverageComplete:
      schroederResidentBatchEvidence.transactionLifecycleCoverageComplete,
    schroederTransactionExactOnceCoverageComplete:
      schroederResidentBatchEvidence.transactionExactOnceCoverageComplete,
    schroederTransactionMountedCount,
    schroederTransactionGenerationCount,
    schroederTransactionPhysicsTickCount,
    schroederTransactionPositionEpochCount,
    schroederTransactionCounterTotals,
    schroederAdmittedConsumerReceiptTelemetry,
    schroederTransactionReleaseCount:
      schroederTransactionCounterTotals.releaseCount,
    schroederTransactionReleaseRetryCount:
      schroederTransactionCounterTotals.releaseRetryCount,
    schroederTransactionLegacyPrivateLookupBuildCount:
      schroederTransactionCounterTotals.legacyPrivateLookupBuildCount,
    schroederTransactionLegacyExhaustiveTraversalCount:
      schroederTransactionCounterTotals.legacyExhaustiveTraversalCount,
    schroederTransactionGenerationSequence:
      schroederResidentBatchEvidence.transactionGenerationSequence,
    schroederTransactionPhysicsTickSequence:
      schroederResidentBatchEvidence.transactionPhysicsTickSequence,
    schroederTransactionPositionEpochSequence:
      schroederResidentBatchEvidence.transactionPositionEpochSequence,
    schroederTransactionGenerationAlignmentComplete:
      schroederResidentBatchEvidence.transactionGenerationAlignmentComplete,
    schroederSpatialEpochGenerationSummaryCount:
      schroederResidentBatchEvidence.generationSummaryCount,
    schroederSpatialEpochGenerationCount:
      schroederResidentBatchEvidence.generationSummaryGenerationCount,
    schroederSpatialEpochGenerationSequence:
      schroederResidentBatchEvidence.generationSummarySequence,
    schroederSpatialEpochGenerationCoverageComplete:
      schroederResidentBatchEvidence.generationCoverageComplete,
    schroederHierarchyArtifactLedgerSummaryCount:
      schroederResidentBatchEvidence.artifactLedgerSummaryCount,
    schroederHierarchyArtifactLedgerSettlementCount:
      schroederResidentBatchEvidence.artifactLedgerSettlementCount,
    schroederHierarchyArtifactLedgerFailedDestroyResourceCount:
      schroederResidentBatchEvidence.artifactLedgerFailedDestroyResourceCount,
    schroederHierarchyArtifactLedgerBlockerCount:
      schroederResidentBatchEvidence.artifactLedgerBlockerCount,
    schroederHierarchyArtifactLedgerUnsafeUnretiredOwnedResourceCount:
      schroederResidentBatchEvidence.artifactLedgerUnsafeUnretiredOwnedResourceCount,
    schroederHierarchyArtifactLedgerGenerationAlignmentComplete:
      schroederResidentBatchEvidence.artifactLedgerGenerationAlignmentComplete,
    schroederHierarchyArtifactLedgerCoverageComplete:
      schroederResidentBatchEvidence.artifactLedgerCoverageComplete,
    schroederBackpressureWaitCount,
    schroederBackpressureWaitMs,
    schroederTransactionBatchCoverage:
      schroederResidentBatchEvidence.batchCoverage,
    schroederConfigSource,
    schroederSelectedLevel: schroederSelectedLevelMetric,
    schroederSequenceStatus,
    schroederMechanicsStatus,
    schroederResidentComputeManagerMode,
    schroederPortableSummaryStatus,
    schroederRenderLodStatus,
    schroederNativeGridSpacingM,
    schroederActiveLeafProxyCount,
    schroederAggregateProxyCount,
    schroederLawQueueProxyCount,
    schroederRenderSourceStatus,
    schroederRenderSourcePresentationReady,
    schroederDrawSourceStatus,
    schroederDrawBatchCount,
    schroederLocalRetainedResolverStatus,
    schroederLocalRetainedRefCount,
    schroederBackendSelectionStatus,
    schroederBackendSelected,
    schroederBackendNativeSubmitReady,
    schroederNativeExecutorStatus,
    schroederNativeExecutorReady,
    schroederNativeExecutorDrawCommandCount,
    schroederNativeLastSubmitStatus,
    schroederNativeLastSubmitDrawCommandCount,
    schroederRenderFieldReadback,
    schroederRenderRowsReadback,
    schroederSurfaceDrawStatus,
    schroederSurfaceDrawBridge,
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
    surfaceDrawSource: currentSurfaceDraw.source,
    surfaceDrawReadback: currentSurfaceDraw.readback,
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
    surfaceDrawSummaryReadback: currentSurfaceDraw.summaryReadback,
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
      ULG_PROBE_MEASURE_GPU_TIMESTAMP_INTERVAL:
        measureGpuTimestampInterval ? '1' : '0',
      ULG_PROBE_MEASURE_GPU_STAGE_TIMESTAMPS:
        measureGpuStageTimestamps ? '1' : '0',
      ULG_PROBE_MATERIAL_INTERFACE_DIAGNOSTIC: materialInterfaceDiagnosticRequested ? '1' : '0',
      ULG_PROBE_MATERIAL_INTERFACE_CANDIDATE_READBACK_MODE: materialInterfaceCandidateReadbackMode,
      ULG_PROBE_CAPTURE_THERMAL_CSR_ROUTE_EVIDENCE:
        captureThermalCandidateCsrRouteEvidence ? '1' : '0',
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
    materials: {
      drop: dropMaterial,
      base: baseMaterial,
      dropTemperatureK,
      baseTemperatureK
    },
    batches,
    batchSteps,
    probeMode,
    compactSummaryMode,
    thermalCandidateCsrRouteEvidenceRequested:
      captureThermalCandidateCsrRouteEvidence,
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
    schroederSimulationRequested,
    schroederSelectedLevel,
    schroederMaxLevel,
    schroederPortableSummaryRequested,
    schroederActiveNodeIndexRequested,
    schroederLawQueueRequested,
    schroederLawNeighborCandidatesRequested,
    schroederCrossLevelCouplingRequested,
    schroederTwoLevelMechanicsRequested,
    schroederTwoLevelMechanicsAuthority,
    schroederTwoLevelFineSubstepCount,
    schroederPhaseVolumeMigrationRequested,
    materialInterfaceDiagnosticRequested,
    materialInterfaceCandidateReadbackMode,
    fusedResidentMechanicsSequence: fuseResidentMechanicsSequence,
    fusedResidentMechanicsActiveGrid: fuseResidentMechanicsActiveGrid,
    activeGridDispatchPlanRefreshMode,
    fusedActiveGridSafetyCells,
    measureGpuQueueFence,
    measureGpuTimestampInterval,
    measureGpuStageTimestamps,
    requireMigratedLawGpuStageTimestamps,
    requireGpuTimestampInterval,
    gpuTimestampWarmupBatchCount,
    performanceGate: {
      schema: 'peercompute.ulg.sph-performance-benchmark-suite-gate.v0',
      status: scenarios.every((scenario) => scenario.performanceGate?.status === 'pass') ? 'pass' : 'fail',
      failedScenarioCount: scenarios.filter((scenario) => scenario.performanceGate?.status !== 'pass').length,
      requireActiveGrid: requireActiveGridGate,
      requireQueueFence: requireQueueFenceGate,
      requireGpuTimestampInterval,
      requireGpuStageTimestamps: measureGpuStageTimestamps,
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
  const iccTraceEvents = buildSchroederReactionReceiptIccTrace({
    scenarios: report.scenarios,
    reportPath: outputPath
  });
  if (iccTraceOutputPath) {
    // Never leave a previous positive trace in place when a later benchmark
    // did not exercise reaction discovery. A missing route is useful negative
    // evidence, while stale PASS evidence would be actively misleading.
    const persistedTraceEvents = iccTraceEvents.length > 0
      ? iccTraceEvents
      : [Object.freeze({
          kind: 'failure',
          name: 'schroeder-spatial-reaction-discovery-native-receipt',
          status: 'FAIL',
          value: Object.freeze({
            backend: 'webgpu',
            reportPath: outputPath,
            reason: 'no finalized reaction-discovery receipt was admitted by this benchmark run'
          }),
          snippet: 'This benchmark did not exercise a finalized reaction-discovery receipt; no positive ICC backend proof is available.'
        })];
    await mkdir(path.dirname(iccTraceOutputPath), { recursive: true });
    await writeFile(
      iccTraceOutputPath,
      `${persistedTraceEvents.map((event) => JSON.stringify(event)).join('\n')}\n`,
      'utf8'
    );
  }
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

const invokedAsMain = Boolean(
  process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
);

if (invokedAsMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    process.exitCode = 2;
  });
}
