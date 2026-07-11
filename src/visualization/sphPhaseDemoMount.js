// SPH phase demo UI: a full-viewport overlay with the MLS-MPM-style particle renderer, a
// retro-terminal control panel (six wall temperatures + reduced-resolution controls), and live
// status rows. Also exposes a headless API on window.__ulgDemo for e2e/status checks.

import {
  SPH_SCENE_BACKGROUND_COLOR_DEFAULT,
  SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT,
  SPH_RESIDENT_SURFACE_DRAW_OVERLAY_MODE_DEFAULT,
  createSphPhaseScene,
  normalizeSphSceneBackgroundColorHex,
  normalizeResidentSurfaceDrawOverlayMode,
  normalizeSphRendererBackend,
  resolveOpticalSurfaceVisibility
} from './sphPhaseScene.js';
import { ELEMENT_MATERIAL_OPTIONS, MATERIAL_OPTIONS } from './sphMaterialOptions.js';
import { hashPayload } from '../../ulg-gpu-abi/src/index.js';
import {
  createSphPhaseDemo,
  gasPressureSummary,
  gasPressureSummaryFromResidentReaction,
  phaseMassSummary
} from '../runtime/sphPhaseDemo.js';
import { createSphPhaseViewState } from '../runtime/sphPhaseViewState.js';
import {
  REACTION_DISCOVERY_CACHE_RECORD_SCHEMA,
  clearReactionDiscoveryCache,
  createReactionDiscoveryCacheKey
} from '../runtime/sph/reactionDiscovery.js';
import {
  buildUlgSphMlsMpmRemoteSeedTaskGraph,
  ensurePeerComputeResidentAuthorityHost,
  summarizePeerComputeResidentAuthorityHost
} from '../runtime/peercomputeBrowserResidentHost.js';
import {
  resolvePeerComputeRenderOwnershipPolicy
} from '../runtime/peercomputeRenderOwnershipPolicy.js';
import {
  SPH_COLD_START_CACHE_SCHEMA,
  SPH_COLD_START_CACHE_STORAGE_KEY,
  SPH_GPU_WARMUP_CACHE_SCHEMA,
  SPH_PRODUCT_REUSE_RECORD_SCHEMA,
  SPH_STATIC_TABLE_CACHE_BUNDLE_SCHEMA,
  SPH_STATIC_TABLE_CACHE_STORAGE_KEY,
  SPH_STATIC_TABLE_CACHE_UPDATE_SCHEMA,
  SPH_TABLE_CACHE_RECORD_SCHEMA,
  createSphStaticTableCacheUpdate,
  emptySphColdStartCache,
  parseSphColdStartCacheSnapshot,
  parseSphStaticTableCacheSnapshot,
  rehydrateSphStaticTableBundle,
  sphStaticTableInputsFromScene
} from '../runtime/sph/sphColdStartCache.js';
import {
  applySphLocalCacheLookupToOptions,
  createSphLocalCacheLookup,
  createSphLocalCachePersistence
} from '../runtime/sph/sphLocalClosureCache.js';
import { createSphPhaseScenario } from '../runtime/thermoPreflight.js';
import {
  SPH_PHASE_SCENARIO_PRESETS,
  sphPhaseScenarioPresetById
} from '../runtime/sphPhaseScenarioPresets.js';
import { sphTotals } from '../runtime/sph/sphConservation.js';
import { deriveCompoundClosure } from '../runtime/material/compoundClosure.js';
import { deriveElementProperties } from '../runtime/material/elementClosures.js';
import {
  deriveFormulaMaterialProperties,
  deriveMaterialProperties,
  resolveMaterialSpec
} from '../runtime/material/materialDerivation.js';
import { requestOpticalGpuDevice } from '../runtime/material/opticalGpuBuffers.js';
import { materialDerivationSummary } from '../runtime/material/propertyProvenance.js';

const WALL_FACES = ['xMin', 'xMax', 'yMin', 'yMax', 'zMin', 'zMax'];
const PHYSICAL_LAW_GROUPS = Object.freeze([
  ['mechanics', 'MLS-MPM mechanics', true],
  ['gravity', 'gravity', true],
  ['eos', 'material EOS pressure', true],
  ['pressure', 'gas/pressure coupling', true],
  ['thermal', 'thermal/walls', true],
  ['reactions', 'reactions', true],
  ['viscosity', 'viscosity', true],
  ['surfaceTension', 'surface tension (pending)', false]
]);
const MECHANICS_MODE_OPTIONS = Object.freeze([
  ['mlsmpm', 'MLS-MPM resident'],
  ['sph', 'Plain SPH CPU reference']
]);
// MLS-MPM resident is the default integrator (standing directive): the GPU
// resident lane owns physics and presentation; the plain SPH CPU reference
// is an explicit opt-out (mech=sph) that owns BOTH its physics and its CPU
// surface rendering - mixed authority draws particle overlays on top of the
// webgpu surface.
const MECHANICS_MODE_DEFAULT = 'mlsmpm';
const DROP_MATERIAL_DEFAULT = 'Na';
const BASE_MATERIAL_DEFAULT = 'h2o';
const PEER_CLOSURE_CACHE_STORAGE_KEY = 'peercompute.ulg.sph-derived-closure-cache.v1';
export const SPH_PHASE_REBUILD_WORKER_STATUS_SCHEMA = 'peercompute.ulg.sph-phase-rebuild-worker-status.v0';
const PEER_CLOSURE_CACHE_SCHEMA = 'peercompute.ulg.local-derived-closure-cache.v2';
const PEER_CLOSURE_CACHE_RECORD_SCHEMA = 'peercompute.ulg.local-derived-material-closure-cache-record.v2';
const PEER_CLOSURE_CACHE_GENERATOR_SCHEMA = 'peercompute.ulg.material-closure-generator-fingerprint.v1';
const PEER_CLOSURE_CACHE_APP_VERSION = '0.1.0';
const PEER_CLOSURE_CACHE_METHOD_VERSION = 'ulg.generic-derivation+reference-bank-anchoring.v1';
const PEER_CLOSURE_CACHE_MAX_RECORDS_PER_MATERIAL = 32;
const PEER_CLOSURE_CACHE_GENERATOR_DESCRIPTOR = Object.freeze({
  schema: PEER_CLOSURE_CACHE_GENERATOR_SCHEMA,
  appVersion: PEER_CLOSURE_CACHE_APP_VERSION,
  methodVersion: PEER_CLOSURE_CACHE_METHOD_VERSION,
  moduleUrl: import.meta.url,
  generators: {
    deriveMaterialProperties: deriveMaterialProperties.toString(),
    resolveMaterialSpec: resolveMaterialSpec.toString(),
    deriveFormulaMaterialProperties: deriveFormulaMaterialProperties.toString(),
    deriveElementProperties: deriveElementProperties.toString(),
    deriveCompoundClosure: deriveCompoundClosure.toString(),
    materialDerivationSummary: materialDerivationSummary.toString()
  }
});
const PEER_CLOSURE_CACHE_GENERATOR_FINGERPRINT = hashPayload(PEER_CLOSURE_CACHE_GENERATOR_DESCRIPTOR);
const ICE_TEMP_K = 233.15;
const IRON_TEMP_K = 1850;
// Default wall reservoir temperature: 20 °C. This stays above the current derived H2O
// liquidus (~286 K) as well as the reference 273.15 K melt point, so the default
// "water/water" controls do not silently freeze wall-adjacent particles.
const WALL_DEFAULT_K = 293.15;
// Default starting elevations (m) of each block's bottom face: ice on the floor, iron a clear gap
// above it so the drop is visible. Both editable in the panel.
const ICE_BASE_DEFAULT_M = 0;
const IRON_BASE_DEFAULT_M = 2.5;
// Snug simulation box sized to the content (1 m base block + drop block + steam headroom) instead
// of the old 10 m domain, so the box wireframe frames the sim and the marching-cubes field spends
// its resolution where the material actually is.
const DEMO_BOX_EDGE_M = 5;
// Default per-axis container dimensions (m). Cubic by default; each axis editable in the panel.
const BOX_DIM_DEFAULTS_M = { x: 5, y: 5, z: 5 };
// Default particles per block edge: an N-edge block holds N³ particles. Drop block is denser-looking
// at a smaller edge; base block fills a larger footprint.
const DROP_PARTICLE_EDGE_DEFAULT = 3;
const BASE_PARTICLE_EDGE_DEFAULT = 5;
// Default isosurface blob-size multiplier. The default UI scenario keeps this at the explicit
// user-facing scale of 1; targeted tests still override it for smaller diagnostic captures.
const BLOB_SCALE_DEFAULT = 1;
// Default initial temperatures (K): room-temperature sodium over room-temperature water.
// Editable in the panel.
const DROP_TEMP_DEFAULT_K = 293.15;
const BASE_TEMP_DEFAULT_K = 293.15;
const RESIDENT_STEPS_PER_SCHEDULE_FALLBACK = 2;
const RESIDENT_STEPS_PER_SCHEDULE_MAX = 16;
const RESIDENT_PARTICLE_BRIDGE_STEPS_PER_SCHEDULE_MAX = 128;
const RESIDENT_PARTICLE_BRIDGE_TARGET_BATCH_TIME_S = 1 / 30;
const RESIDENT_CONTINUATION_CHAIN_BUDGET = 2;
const RESIDENT_RENDER_READBACK_CADENCE = 3;
const RESIDENT_PENDING_SLOW_NOTICE_MS = 20_000;
const RESIDENT_PENDING_WATCHDOG_MS = 120_000;
const RESIDENT_STAGE_ORDER_TRACE_EVENT_LIMIT = 64;
const RESIDENT_VISIBLE_MOTION_THRESHOLD_FRACTION = 1e-3;
const RESIDENT_VISIBLE_MOTION_THRESHOLD_MIN_M = 1e-6;
const STANDALONE_MECHANICS_PREDICTION_DEFAULT = false;
const DEFAULT_INTERACTIVE_RENDER_OWNERSHIP_USE_CASE = 'same-device-interactive';
export const SPH_REMOTE_RESIDENT_TASK_GRAPH_REFRESH_SCHEMA =
  'peercompute.ulg.sph-demo-remote-resident-task-graph-refresh.v0';
export const SPH_RESIDENT_STAGE_ORDER_TRACE_SCHEMA =
  'peercompute.ulg.sph-demo-resident-stage-order-trace.v0';
export const SPH_PHASE_URL_PARAM_KEYS = Object.freeze([
  'sph',
  'sphPhase',
  'scenario',
  'wxmin',
  'wxmax',
  'wymin',
  'wymax',
  'wzmin',
  'wzmax',
  'drop',
  'base',
  'dropt',
  'baset',
  'iceh',
  'ironh',
  'boxx',
  'boxy',
  'boxz',
  'dropn',
  'basen',
  'mech',
  'lawmech',
  'lawg',
  'laweos',
  'lawp',
  'lawt',
  'lawr',
  'lawv',
  'lawst',
  'blob',
  'bg',
  'residentAuto',
  'residentWorkers',
  'residentStageWorkers',
  'residentStepsPerSchedule',
  'residentStepBatch',
  'residentVisualSteps',
  'residentStepsPerScheduleMax',
  'residentMaxStepsPerSchedule',
  'residentVisualStepsMax',
  'residentParticleBridgeTargetBatchTimeS',
  'residentVisualTargetBatchTimeS',
  'residentInterfaceRefreshMode',
  'residentInterfaceRefresh',
  'residentPostStepInterfaceRefresh',
  'residentInterfaceRefreshWarmupFrames',
  'residentInterfaceWarmupFrames',
  'renderer',
  'rendererPresentation',
  'rendererPresentationUnsafe',
  'rendererResidentDevice',
  'surfaceBufferPresentation',
  'workerOffscreenPresentation',
  'renderOwnership',
  'renderOwner',
  'peercomputeRenderOwnership',
  'renderUseCase',
  'surfaceDraw',
  'surfaceDrawDiagnostic',
  'nativeSurfacePixelValidation',
  'surfaceOverlay',
  'schroeder',
  'ss',
  'schroederSimulation',
  'schroederLevel',
  'schroederSelectedLevel',
  'ssLevel',
  'schroederBaseGridSpacing',
  'schroederBaseGridSpacingM',
  'schroederMinLevel',
  'ssMinLevel',
  'schroederMaxLevel',
  'ssMaxLevel',
  'schroederTileCellCount',
  'schroederTile',
  'schroederPortableSummary',
  'ssPortableSummary',
  'schroederActiveNodeIndex',
  'ssIndex',
  'schroederActiveNodeSortedIndex',
  'ssSortedIndex',
  'schroederActiveNodeSortedIndexPolicy',
  'schroederCrossLevelCoupling',
  'schroederLawQueue',
  'schroederLawNeighbors',
  'schroederLawNeighborCandidates',
  'schroederParticleStorageMaterialization',
  'ssParticleStorageMaterialization',
  'schroederTwoLevel',
  'ssTwoLevel',
  'schroederTwoLevelAuthority',
  'schroederTwoLevelSubsteps',
  'schroederParticleStorageRowBudget',
  'schroederParticleStorageRequiredCapacity',
  'schroederParticleStorageCapacityMargin',
  'schroederParticleStorageFreeListSlotCapacity',
  'schroederParticleStorageFreeListAvailableSlotCount',
  'schroederParticleStorageFreeListMaxSlotsPerRow',
  'schroederLawNeighborTraversal',
  'schroederTraversal',
  'schroederLawNeighborCandidateReadback',
  'schroederUseCase'
]);

const RESIDENT_SURFACE_DRAW_DIAGNOSTIC_MODES = new Set([
  'auto',
  'metadata',
  'off',
  'three',
  'three-compact-vertices',
  'three-webgpu-surface-buffers',
  'three-points',
  'three-render-row-points',
  'three-spheres',
  'three-render-row-spheres',
  'native-webgpu-surface-consumer',
  'webgpu-points',
  'webgpu-render-row-points',
  'webgpu-spheres',
  'webgpu-render-row-spheres'
]);
// three-webgpu-surface-buffers is intentionally absent: its render plan
// always coerces to the non-presenting resident handoff, so offering it as a
// render mode showed users a blank canvas. URL requests for it alias to the
// native consumer; the internal handoff machinery remains for direct
// engine consumers.
const RESIDENT_SURFACE_RENDER_MODE_OPTIONS = Object.freeze([
  ['native-webgpu-surface-consumer', 'Surface - native WebGPU'],
  ['three-render-row-spheres', 'Particles - variable-size PBR spheres'],
  ['three-render-row-points', 'Particles - points'],
  ['auto', 'Auto']
]);
const THREE_WEBGPU_RENDERER_PRESENTATION_RUNTIME_VALIDATED = false;
const THREE_WEBGPU_RENDERER_OWNED_RESIDENT_DEVICE_RUNTIME_VALIDATED = false;

function normalizeResidentSurfaceDrawDiagnosticMode(value, fallback = 'three-render-row-points') {
  const normalized = String(value ?? fallback).trim().toLowerCase();
  return RESIDENT_SURFACE_DRAW_DIAGNOSTIC_MODES.has(normalized) ? normalized : fallback;
}

function residentSurfaceDrawParticleRenderMode(mode) {
  const normalized = normalizeResidentSurfaceDrawDiagnosticMode(mode, 'auto');
  if (
    normalized === 'three-render-row-spheres'
    || normalized === 'three-spheres'
    || normalized === 'webgpu-render-row-spheres'
    || normalized === 'webgpu-spheres'
  ) {
    return 'variable-size-spheres';
  }
  if (
    normalized === 'three-render-row-points'
    || normalized === 'three-points'
    || normalized === 'webgpu-render-row-points'
    || normalized === 'webgpu-points'
    || normalized === 'three'
  ) {
    return 'points';
  }
  return null;
}

function residentSurfaceDrawModeUsesParticleBridge(mode) {
  return residentSurfaceDrawParticleRenderMode(mode) != null;
}

function residentSurfaceDrawModeUsesNativeSurfaceConsumer(mode) {
  return normalizeResidentSurfaceDrawDiagnosticMode(mode, 'auto') === 'native-webgpu-surface-consumer';
}

function residentSurfaceDrawModeNeedsInitialVisualRefresh(mode) {
  return residentSurfaceDrawModeUsesParticleBridge(mode)
    || residentSurfaceDrawModeUsesNativeSurfaceConsumer(mode);
}

function residentSurfaceDrawModeUsesCompactBridge(mode) {
  const normalized = normalizeResidentSurfaceDrawDiagnosticMode(mode, 'auto');
  return normalized === 'three-compact-vertices'
    || normalized === 'three-webgpu-surface-buffers'
    || normalized === 'three-render-row-points'
    || normalized === 'three-points'
    || normalized === 'three-render-row-spheres'
    || normalized === 'three-spheres'
    || normalized === 'webgpu-render-row-points'
    || normalized === 'webgpu-points'
    || normalized === 'webgpu-render-row-spheres'
    || normalized === 'webgpu-spheres'
    || normalized === 'three';
}

function fmt(n, digits = 2) {
  if (n == null || !Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1e9) return n.toExponential(2);
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(digits)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(digits)}k`;
  return n.toFixed(digits);
}

function finiteNumberOrNull(value) {
  return Number.isFinite(value) ? Number(value) : null;
}

export function residentMotionDiagnostic({
  residentStep = null,
  residentSteps = null,
  gridSpacingM = null
} = {}) {
  const diagnostics = residentStep?.diagnostics || residentSteps?.finalStep?.diagnostics || null;
  const maxDisplacementM = finiteNumberOrNull(diagnostics?.maxDisplacementM);
  const maxSpeedMPerS = finiteNumberOrNull(diagnostics?.maxSpeedMPerS);
  const residentSequenceIndex = Number(residentStep?.sequenceIndex);
  const residentSequenceStepCount = Number.isFinite(residentSequenceIndex)
    ? residentSequenceIndex + 1
    : null;
  const completedStepCount = Math.max(
    1,
    Math.round(Number(
      residentSteps?.completedStepCount
        ?? residentSteps?.stepCount
        ?? residentSequenceStepCount
        ?? 1
    ) || 1)
  );
  const stepDtS = finiteNumberOrNull(
    residentStep?.dt
      ?? residentSteps?.finalStep?.dt
      ?? residentStep?.particlePingPong?.dt
      ?? null
  );
  const estimatedBatchTimeS = Number.isFinite(stepDtS) ? completedStepCount * stepDtS : null;
  const estimatedBatchDisplacementUpperBoundM = (
    Number.isFinite(maxSpeedMPerS) && Number.isFinite(estimatedBatchTimeS)
  )
    ? Math.max(0, maxSpeedMPerS * estimatedBatchTimeS)
    : null;
  const pressureImpulseNSeconds = finiteNumberOrNull(
    diagnostics?.pressureInterfaceAppliedImpulseMagnitudeNSeconds
      ?? residentStep?.pressureInterfaceAppliedImpulseMagnitudeNSeconds
      ?? residentStep?.gridUpdate?.pressureInterfaceAppliedImpulseMagnitudeNSeconds
  );
  const visibleThresholdM = Math.max(
    RESIDENT_VISIBLE_MOTION_THRESHOLD_MIN_M,
    Number.isFinite(gridSpacingM)
      ? Math.abs(gridSpacingM) * RESIDENT_VISIBLE_MOTION_THRESHOLD_FRACTION
      : RESIDENT_VISIBLE_MOTION_THRESHOLD_MIN_M
  );
  const hasExecution = Boolean(residentStep?.schema || residentSteps?.schema);
  const compactGpuSummaryAvailable = Boolean(diagnostics?.compactGpuSummaryAvailable);
  const batchMotionEstimateVisible = Number.isFinite(estimatedBatchDisplacementUpperBoundM)
    && estimatedBatchDisplacementUpperBoundM >= visibleThresholdM;
  let status = 'resident-execution-pending';
  if (hasExecution && maxDisplacementM == null) {
    status = compactGpuSummaryAvailable ? 'motion-unknown' : 'motion-unknown-no-compact-summary';
  } else if (hasExecution && maxDisplacementM >= visibleThresholdM) {
    status = 'motion-proven';
  } else if (hasExecution && batchMotionEstimateVisible) {
    status = 'batch-motion-estimate-visible';
  } else if (hasExecution) {
    status = 'motion-below-visible-threshold';
  }
  return {
    schema: 'peercompute.ulg.sph-demo-resident-motion-diagnostic.v0',
    status,
    maxDisplacementM,
    maxSpeedMPerS,
    pressureImpulseNSeconds,
    visibleThresholdM,
    completedStepCount,
    stepDtS,
    estimatedBatchTimeS,
    estimatedBatchDisplacementUpperBoundM,
    batchMotionEstimateVisible,
    compactGpuSummaryAvailable,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function compactResidentStageOrderFamilyOwners(familyOwners = {}) {
  return Object.fromEntries(
    Object.entries(familyOwners || {}).map(([family, owner]) => [family, {
      family,
      ownerStage: owner?.ownerStage ?? null,
      status: owner?.status ?? null,
      mutationMode: owner?.mutationMode ?? null,
      backend: owner?.backend ?? null,
      validationStatus: owner?.validationStatus ?? null,
      source: owner?.source ?? null,
      reads: [...(owner?.reads || [])],
      writes: [...(owner?.writes || [])],
      nextConsumers: [...(owner?.nextConsumers || [])]
    }])
  );
}

function residentStageOrderFromStatus(stageStatus = {}, stageBackends = {}) {
  const preferredOrder = [
    'p2g',
    'pressureInterface',
    'gridUpdate',
    'g2p',
    'thermalPhase',
    'reactionProduct'
  ];
  const observed = new Set([
    ...Object.keys(stageStatus || {}),
    ...Object.keys(stageBackends || {})
  ]);
  return [
    ...preferredOrder.filter((stage) => observed.has(stage)),
    ...[...observed].filter((stage) => !preferredOrder.includes(stage)).sort()
  ];
}

export function summarizeResidentStageOrderExecution(execution = null) {
  const stepSummaries = Array.isArray(execution?.stepSummaries) ? execution.stepSummaries : [];
  const lastStepSummary = stepSummaries.length ? stepSummaries[stepSummaries.length - 1] : null;
  const finalStep = execution?.finalStep || null;
  const stageTiming = finalStep?.stageTiming || lastStepSummary?.stageTiming || null;
  const diagnostics = finalStep?.diagnostics || lastStepSummary?.diagnostics || {};
  const stageStatus = finalStep?.stageStatus || lastStepSummary?.stageStatus || {};
  const stageBackends = finalStep?.stageBackends || lastStepSummary?.stageBackends || {};
  const familyOwners = execution?.residentAuthorityFamilyOwners
    || finalStep?.residentAuthorityFamilyOwners
    || finalStep?.residentAuthoritySummary?.familyOwners
    || lastStepSummary?.residentAuthorityFamilyOwners
    || {};
  const activeGridDispatch = stageTiming?.activeGridDispatch
    || finalStep?.stageTiming?.activeGridDispatch
    || finalStep?.fusedResidentSequence?.activeGridDispatch
    || finalStep?.gridUpdate?.activeGridDispatch
    || finalStep?.p2gGridProjection?.activeGridDispatch
    || null;
  return {
    schema: 'peercompute.ulg.sph-demo-resident-stage-order-execution-summary.v0',
    available: Boolean(execution?.schema || finalStep?.schema),
    executionSchema: execution?.schema || null,
    status: execution?.status || finalStep?.status || null,
    backend: execution?.backend || finalStep?.backend || null,
    readbackMode: execution?.readbackMode || finalStep?.readbackMode || null,
    normalHotLoopReadbackFree: Boolean(
      execution?.normalHotLoopReadbackFree ?? finalStep?.normalHotLoopReadbackFree
    ),
    continuedFromResidentState: Boolean(execution?.continuedFromResidentState),
    continuationAvailable: Boolean(execution?.continuationAvailable),
    stepCount: execution?.stepCount ?? null,
    completedStepCount: execution?.completedStepCount ?? null,
    finalStepIndex: finalStep?.sequenceIndex ?? lastStepSummary?.index ?? null,
    finalStepStatus: finalStep?.status || lastStepSummary?.status || null,
    stageOrder: residentStageOrderFromStatus(stageStatus, stageBackends),
    stageStatus: { ...(stageStatus || {}) },
    stageBackends: { ...(stageBackends || {}) },
    stageTiming: stageTiming ? {
      schema: stageTiming.schema || null,
      totalMs: stageTiming.totalMs ?? null,
      stageMs: { ...(stageTiming.stageMs || {}) },
      compactSummaryScope: stageTiming.compactSummaryScope ?? null,
      activeGridDispatchPlanOnlyRequested: stageTiming.activeGridDispatchPlanOnlyRequested ?? null,
      activeGridDispatchPlanOnlyEligible: stageTiming.activeGridDispatchPlanOnlyEligible ?? null,
      activeGridDispatchPlanRefreshMode: stageTiming.activeGridDispatchPlanRefreshMode ?? null,
      activeGridDispatchPlanRefreshRequested: stageTiming.activeGridDispatchPlanRefreshRequested ?? null,
      activeGridDispatchPlanRefreshFinalStep: stageTiming.activeGridDispatchPlanRefreshFinalStep ?? null,
      activeGridDispatchPlanRefreshSkippedReason: stageTiming.activeGridDispatchPlanRefreshSkippedReason ?? null
    } : null,
    activeGridDispatch: activeGridDispatch ? {
      useActiveGrid: activeGridDispatch.useActiveGrid === true,
      activeGridNodeCount: activeGridDispatch.activeGridNodeCount
        ?? activeGridDispatch.activeNodeCount
        ?? null,
      activeNodeCount: activeGridDispatch.activeNodeCount
        ?? activeGridDispatch.activeGridNodeCount
        ?? null,
      gridNodeScanCount: activeGridDispatch.gridNodeScanCount ?? null,
      dispatchNodeCount: activeGridDispatch.dispatchNodeCount
        ?? activeGridDispatch.activeNodeCount
        ?? activeGridDispatch.activeGridNodeCount
        ?? null,
      dispatchWorkgroups: activeGridDispatch.dispatchWorkgroups ?? null,
      maxSpeedMPerS: activeGridDispatch.maxSpeedMPerS ?? null,
      safetyCells: activeGridDispatch.safetyCells ?? null
    } : null,
    diagnostics: {
      particleCount: diagnostics?.particleCount ?? null,
      gridNodeCount: diagnostics?.gridNodeCount ?? null,
      activeGridNodeCount: diagnostics?.activeGridNodeCount ?? null,
      activeGridNodeCountAvailable: diagnostics?.activeGridNodeCountAvailable ?? null,
      activeGridNodeSummaryStatus: diagnostics?.activeGridNodeSummaryStatus ?? null,
      maxDisplacementM: diagnostics?.maxDisplacementM ?? null,
      maxSpeedMPerS: diagnostics?.maxSpeedMPerS ?? null,
      pressureInterfaceForceRowCount: diagnostics?.pressureInterfaceForceRowCount ?? null,
      pressureInterfaceAppliedImpulseMagnitudeNSeconds:
        diagnostics?.pressureInterfaceAppliedImpulseMagnitudeNSeconds ?? null,
      reactionProductEventActiveEventCount: diagnostics?.reactionProductEventActiveEventCount ?? null,
      reactionResidentProductMassStatus: diagnostics?.reactionResidentProductMassStatus ?? null,
      reactionProposalNeighborMode: diagnostics?.reactionProposalNeighborMode ?? null,
      reactionParticleBinGridStatus: diagnostics?.reactionParticleBinGridStatus ?? null,
      reactionParticleBinGridReason: diagnostics?.reactionParticleBinGridReason ?? null,
      reactionParticleBinGridEnabled: diagnostics?.reactionParticleBinGridEnabled ?? null,
      reactionParticleBinGridCellCount: diagnostics?.reactionParticleBinGridCellCount ?? null,
      reactionParticleBinGridBinCapacity: diagnostics?.reactionParticleBinGridBinCapacity ?? null,
      reactionParticleBinGridIndexBufferByteLength: diagnostics?.reactionParticleBinGridIndexBufferByteLength ?? null,
      reactionParticleBinGridMaxContactRadiusM: diagnostics?.reactionParticleBinGridMaxContactRadiusM ?? null,
      reactionParticleBinOverflowStatus: diagnostics?.reactionParticleBinOverflowStatus ?? null,
      reactionParticleBinOverflowCount: diagnostics?.reactionParticleBinOverflowCount ?? null,
      reactionParticleBinOverflowMetadataReadbackRequested:
        diagnostics?.reactionParticleBinOverflowMetadataReadbackRequested ?? null,
      thermalMechanicsRefreshStatus: diagnostics?.thermalMechanicsRefreshStatus ?? null
    },
    residentAuthorityLedgerStatus: execution?.residentAuthorityLedgerStatus
      ?? finalStep?.residentAuthorityLedgerStatus
      ?? lastStepSummary?.residentAuthorityLedgerStatus
      ?? null,
    residentAuthorityFamilyOwners: compactResidentStageOrderFamilyOwners(familyOwners),
    residentAuthorityWarnings: [
      ...(execution?.residentAuthorityWarnings || finalStep?.residentAuthorityWarnings || lastStepSummary?.residentAuthorityWarnings || [])
    ],
    residentAuthorityBlockers: [
      ...(execution?.residentAuthorityBlockers || finalStep?.residentAuthorityBlockers || lastStepSummary?.residentAuthorityBlockers || [])
    ],
    residentBufferLeaseLedgerStatus: execution?.residentBufferLeaseLedgerStatus
      ?? finalStep?.residentBufferLeaseLedgerStatus
      ?? lastStepSummary?.residentBufferLeaseLedgerStatus
      ?? null,
    residentBufferLeaseResourceCount: execution?.residentBufferLeaseResourceCount
      ?? finalStep?.residentBufferLeaseResourceCount
      ?? lastStepSummary?.residentBufferLeaseResourceCount
      ?? 0,
    residentBufferLeaseActiveLeaseCount: execution?.residentBufferLeaseActiveLeaseCount
      ?? finalStep?.residentBufferLeaseActiveLeaseCount
      ?? lastStepSummary?.residentBufferLeaseActiveLeaseCount
      ?? 0,
    residentBufferLeaseWarnings: [
      ...(execution?.residentBufferLeaseWarnings || finalStep?.residentBufferLeaseWarnings || lastStepSummary?.residentBufferLeaseWarnings || [])
    ],
    residentBufferLeaseBlockers: [
      ...(execution?.residentBufferLeaseBlockers || finalStep?.residentBufferLeaseBlockers || lastStepSummary?.residentBufferLeaseBlockers || [])
    ],
    gpuResidentLaneStatus: finalStep?.gpuResidentLaneStatus
      ?? lastStepSummary?.gpuResidentLaneStatus
      ?? null,
    gpuResidentLaneFenceStatus: finalStep?.gpuResidentLaneFenceStatus
      ?? lastStepSummary?.gpuResidentLaneFenceStatus
      ?? null,
    gpuResidentLaneFenceSatisfied: finalStep?.gpuResidentLaneFenceSatisfied === true
      || lastStepSummary?.gpuResidentLaneFenceSatisfied === true,
    nextParticleBufferMode: execution?.nextParticleBufferMode
      ?? finalStep?.nextParticleBufferMode
      ?? lastStepSummary?.nextParticleBufferMode
      ?? null,
    nextParticleStateBufferByteLength: finalStep?.nextParticleStateBufferByteLength ?? 0,
    nextParticleThermoBufferByteLength: finalStep?.nextParticleThermoBufferByteLength ?? 0,
    nextParticleMechanicsBufferByteLength: finalStep?.nextParticleMechanicsBufferByteLength ?? 0,
    residentProductMassStatus: finalStep?.residentProductMassStatus
      ?? lastStepSummary?.residentProductMassStatus
      ?? null,
    residentProductMassProductEventRowCount: finalStep?.residentProductMassProductEventRowCount
      ?? lastStepSummary?.residentProductMassProductEventRowCount
      ?? 0
  };
}

export function appendResidentStageOrderTrace(trace = null, event = {}, {
  maxEvents = RESIDENT_STAGE_ORDER_TRACE_EVENT_LIMIT
} = {}) {
  const previousEvents = Array.isArray(trace?.events) ? trace.events : [];
  const previousCount = Number.isFinite(Number(trace?.eventCount))
    ? Math.max(0, Math.round(Number(trace.eventCount)))
    : previousEvents.length;
  const eventSequence = previousCount + 1;
  const executionSummary = event.executionSummary
    || summarizeResidentStageOrderExecution(event.execution || null);
  const nextEvent = {
    schema: 'peercompute.ulg.sph-demo-resident-stage-order-trace-event.v0',
    eventSequence,
    status: event.status || 'resident-stage-order-trace-event',
    reason: event.reason || null,
    generation: Number.isFinite(Number(event.generation)) ? Math.round(Number(event.generation)) : null,
    scheduleToken: Number.isFinite(Number(event.scheduleToken)) ? Math.round(Number(event.scheduleToken)) : null,
    signature: event.signature || null,
    stepCount: Number.isFinite(Number(event.stepCount)) ? Math.round(Number(event.stepCount)) : null,
    particleCount: Number.isFinite(Number(event.particleCount)) ? Math.round(Number(event.particleCount)) : null,
    readbackMode: event.readbackMode || null,
    continueFromResidentState: event.continueFromResidentState === true,
    resetStatus: event.resetStatus || null,
    pendingStatus: event.pendingStatus || null,
    residentExecutionPolicy: event.residentExecutionPolicy ? { ...event.residentExecutionPolicy } : null,
    executionSummary,
    updatedAtMs: Number.isFinite(Number(event.updatedAtMs)) ? Number(event.updatedAtMs) : nowMs()
  };
  const limit = Math.max(1, Math.round(Number(maxEvents) || RESIDENT_STAGE_ORDER_TRACE_EVENT_LIMIT));
  const events = [...previousEvents, nextEvent].slice(-limit);
  return {
    schema: SPH_RESIDENT_STAGE_ORDER_TRACE_SCHEMA,
    status: nextEvent.status,
    eventCount: eventSequence,
    retainedEventCount: events.length,
    resetGeneration: nextEvent.generation ?? trace?.resetGeneration ?? null,
    lastEvent: nextEvent,
    events,
    updatedAtMs: nextEvent.updatedAtMs,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

export function workerRebuildResetGate({
  currentGeneration = 0,
  activeTask = null,
  reason = 'demo-rebuild',
  nowMs = 0
} = {}) {
  const generation = Math.max(0, Math.round(Number(currentGeneration) || 0)) + 1;
  const cancelledGeneration = Number.isFinite(Number(activeTask?.generation))
    ? Math.round(Number(activeTask.generation))
    : null;
  return {
    generation,
    activeWorkerRebuildTask: null,
    workerStatus: {
      schema: SPH_PHASE_REBUILD_WORKER_STATUS_SCHEMA,
      status: 'cancelled-by-reset',
      generation,
      cancelledGeneration,
      reason,
      previousStatus: activeTask?.status || null,
      updatedAtMs: Number.isFinite(Number(nowMs)) ? Number(nowMs) : 0,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    }
  };
}

function nowMs() {
  return typeof performance?.now === 'function' ? performance.now() : Date.now();
}

function remoteResidentTaskGraphRefreshTelemetry(status, extra = {}) {
  return {
    schema: SPH_REMOTE_RESIDENT_TASK_GRAPH_REFRESH_SCHEMA,
    status,
    enabled: false,
    submitted: false,
    refreshed: false,
    updatedAtMs: nowMs(),
    ...extra
  };
}

function compactRemoteResidentTaskGraphRefreshReport(report, graph) {
  const hotBufferRefresh = report?.hotBufferRefresh || report?.refresh || null;
  const seedPolicy = report?.seedPolicy || report?.stateSeedPolicy || null;
  const localRefs = Array.isArray(hotBufferRefresh?.localRefs)
    ? hotBufferRefresh.localRefs
    : Array.isArray(report?.localRefs)
    ? report.localRefs
    : [];
  return {
    reportSchema: report?.schema || null,
    reportStatus: report?.status || null,
    graphId: graph?.id || graph?.graphId || null,
    graphSchema: graph?.schema || null,
    remoteCacheArtifactStatus: report?.remoteTaskGraphCacheArtifactPreflight?.status
      || report?.cacheArtifactPreflight?.status
      || null,
    hotBufferRefreshStatus: hotBufferRefresh?.status || null,
    hotBufferKey: hotBufferRefresh?.hotBufferKey || report?.hotBufferKey || null,
    localRefCount: localRefs.length,
    localRefs,
    seedPolicyStatus: seedPolicy?.status || null,
    blockedStateFamilies: Array.isArray(seedPolicy?.disallowedStateFamilies)
      ? [...seedPolicy.disallowedStateFamilies]
      : Array.isArray(seedPolicy?.blockedStateFamilies)
      ? [...seedPolicy.blockedStateFamilies]
      : []
  };
}

export async function runRemoteResidentTaskGraphRefreshPrelude({
  enabled = false,
  host = null,
  graph = null,
  graphFactory = null,
  refreshOptions = null,
  context = {}
} = {}) {
  if (!enabled) {
    return remoteResidentTaskGraphRefreshTelemetry('disabled');
  }
  const startedAtMs = nowMs();
  if (typeof host?.submitTaskGraphWithRemoteSeedHotBufferRefresh !== 'function') {
    return remoteResidentTaskGraphRefreshTelemetry('unavailable-host-method-missing', {
      enabled: true,
      startedAtMs,
      elapsedMs: nowMs() - startedAtMs
    });
  }
  try {
    const resolvedGraph = typeof graphFactory === 'function'
      ? await graphFactory(context)
      : graph;
    if (!resolvedGraph) {
      return remoteResidentTaskGraphRefreshTelemetry('skipped-no-task-graph', {
        enabled: true,
        startedAtMs,
        elapsedMs: nowMs() - startedAtMs
      });
    }
    const resolvedRefreshOptions = typeof refreshOptions === 'function'
      ? await refreshOptions({ ...context, graph: resolvedGraph })
      : (refreshOptions || {});
    const report = await host.submitTaskGraphWithRemoteSeedHotBufferRefresh(
      resolvedGraph,
      resolvedRefreshOptions
    );
    const compact = compactRemoteResidentTaskGraphRefreshReport(report, resolvedGraph);
    return remoteResidentTaskGraphRefreshTelemetry(report?.status || 'submitted', {
      enabled: true,
      submitted: true,
      refreshed: compact.hotBufferRefreshStatus === 'refreshed-local-hot-buffers'
        || compact.hotBufferRefreshStatus === 'remote-seed-hot-buffer-refresh-complete'
        || report?.status === 'task-graph-submitted-remote-seed-hot-buffer-refreshed',
      startedAtMs,
      elapsedMs: nowMs() - startedAtMs,
      ...compact,
      report
    });
  } catch (error) {
    return remoteResidentTaskGraphRefreshTelemetry('error-local-resident-continued', {
      enabled: true,
      startedAtMs,
      elapsedMs: nowMs() - startedAtMs,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

function formatMaterialPhaseMasses(byMaterialPhase = {}) {
  return Object.entries(byMaterialPhase)
    .map(([material, phases]) => {
      const phaseText = Object.entries(phases)
        .map(([phase, massKg]) => `${phase} ${fmt(massKg)}kg`)
        .join('/');
      return `${material}:${phaseText}`;
    })
    .join('  ');
}

function materialStatusLabel(material) {
  const key = String(material || '');
  const option = MATERIAL_OPTIONS.find((candidate) => candidate.key === key || candidate.symbol === key);
  if (option?.formula) return option.formula;
  if (option?.symbol) return option.symbol;
  return key || 'material';
}

function materialParticleCountsText(counts = {}) {
  const entries = Object.entries(counts)
    .filter(([, count]) => Number(count) > 0)
    .sort(([left], [right]) => String(left).localeCompare(String(right)));
  const total = entries.reduce((sum, [, count]) => sum + (Number(count) || 0), 0);
  const body = entries.map(([material, count]) => `${materialStatusLabel(material)} ${count}`).join('  ');
  return `${body || 'none'}  total ${total}`;
}

function materialParticleCountsFromMaterials(materials = []) {
  const counts = {};
  for (const descriptor of materials || []) {
    const material = descriptor?.material || descriptor?.renderKey || 'unknown';
    counts[material] = (counts[material] || 0) + 1;
  }
  return counts;
}

function materialParticleCountsFromParticles(particles = []) {
  const counts = {};
  for (const particle of particles || []) {
    const material = particle?.material || 'unknown';
    counts[material] = (counts[material] || 0) + 1;
  }
  return counts;
}

function reactionStatusText(note, reactionLedger = null) {
  if (!reactionLedger?.eventCount) return note || '—';
  const productMaterials = Object.keys(reactionLedger.productMassKgByMaterial || {});
  const gasMaterials = Object.keys(reactionLedger.gasMassKgByMaterial || {});
  const productText = productMaterials.length ? `products=${productMaterials.join(',')}` : 'products=none';
  const gasText = gasMaterials.length ? `gas=${gasMaterials.join(',')}` : 'gas=none';
  return `${note || 'reaction'}; events=${reactionLedger.eventCount} ${productText} ${gasText}`;
}

function phaseStatusText(pre = {}, dropMaterial = 'drop', baseMaterial = 'base') {
  const feasibility = pre.feasibility || {};
  const dropPhase = feasibility.finalDropPhase
    || (String(dropMaterial).toLowerCase() === 'fe' ? feasibility.finalFePhase : null)
    || 'pending';
  const basePhase = feasibility.finalBasePhase
    || (String(baseMaterial).toLowerCase() === 'h2o' ? feasibility.finalH2oPhase : null)
    || 'pending';
  return `${materialStatusLabel(dropMaterial)} ${dropPhase} / ${materialStatusLabel(baseMaterial)} ${basePhase}`;
}

function massStatusText(pre = {}, dropMaterial = 'drop', baseMaterial = 'base') {
  const masses = pre.masses || {};
  const dropMassKg = masses.dropMassKg ?? masses.ironMassKg;
  const baseMassKg = masses.baseMassKg ?? masses.iceMassKg;
  return `${materialStatusLabel(dropMaterial)} ${fmt(dropMassKg)}  ${materialStatusLabel(baseMaterial)} ${fmt(baseMassKg)}  air ${fmt(masses.airMassKg)}`;
}

function roleParticleResolution(pre = {}, role, material) {
  const resolution = pre.particleResolution || {};
  if (resolution[role]) return resolution[role];
  if (resolution[material]) return resolution[material];
  if (role === 'drop') return resolution.fe || null;
  if (role === 'base') return resolution.h2o || null;
  return null;
}

function moleculesPerMacroStatusText(pre = {}, dropMaterial = 'drop', baseMaterial = 'base') {
  const drop = roleParticleResolution(pre, 'drop', dropMaterial);
  const base = roleParticleResolution(pre, 'base', baseMaterial);
  return `${materialStatusLabel(dropMaterial)} ${fmt(drop?.entitiesPerMacroParticle)}  ${materialStatusLabel(baseMaterial)} ${fmt(base?.entitiesPerMacroParticle)}`;
}

function solidFractionStatusText(phase = {}) {
  const byMaterialPhase = phase.byMaterialPhase || {};
  const fractions = phase.solidFractionByMaterial || {};
  return Object.entries(byMaterialPhase)
    .map(([material, phases]) => {
      const total = Object.values(phases || {}).reduce((sum, massKg) => sum + (Number(massKg) || 0), 0);
      const fraction = fractions[material] ?? (total > 0 ? (Number(phases?.solid) || 0) / total : null);
      return `${materialStatusLabel(material)} ${fmt(fraction, 3)}`;
    })
    .join('  ');
}

function nowIso() {
  return new Date().toISOString();
}

function storageAvailable() {
  try {
    return typeof window !== 'undefined' && Boolean(window.localStorage);
  } catch {
    return false;
  }
}

function readPeerClosureCache() {
  if (!storageAvailable()) {
    return { schema: PEER_CLOSURE_CACHE_SCHEMA, status: 'localstorage-unavailable', entries: {} };
  }
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PEER_CLOSURE_CACHE_STORAGE_KEY) || 'null');
    if (!parsed || parsed.schema !== PEER_CLOSURE_CACHE_SCHEMA || typeof parsed.entries !== 'object') {
      return {
        schema: PEER_CLOSURE_CACHE_SCHEMA,
        status: parsed?.schema ? 'schema-mismatch' : 'empty',
        previousSchema: parsed?.schema || null,
        staleEntryCount: Object.keys(parsed?.entries || {}).length,
        entries: {},
        materialIndex: {}
      };
    }
    return {
      ...parsed,
      status: 'loaded',
      materialIndex: parsed.materialIndex || buildMaterialIndex(parsed.entries || {})
    };
  } catch {
    return { schema: PEER_CLOSURE_CACHE_SCHEMA, status: 'parse-error', entries: {}, materialIndex: {} };
  }
}

function materialCacheKey(material) {
  return String(material || '').toLowerCase();
}

function materialValidityDomain(material, properties) {
  return {
    temperatureK: [0, 6000],
    pressurePa: [1, 1e9],
    composition: properties?.formula || properties?.label || material,
    phaseNames: (properties?.phases || []).map((phase) => phase.name),
    transitionCount: properties?.transitions?.length || 0
  };
}

function materialClosureInputHash(material, properties) {
  return hashPayload({
    materialKey: materialCacheKey(material),
    material,
    formula: properties?.formula || null,
    label: properties?.label || null,
    atomsPerFormula: properties?.atomsPerFormula || null,
    provenance: properties?.propertyProvenance || null
  });
}

function materialClosureMethodHash(properties) {
  return hashPayload({
    methodVersion: PEER_CLOSURE_CACHE_METHOD_VERSION,
    generatorFingerprint: PEER_CLOSURE_CACHE_GENERATOR_FINGERPRINT,
    derivation: properties?.derivation || null,
    materialDerivation: materialDerivationSummary(properties)
  });
}

function materialRecordKey({ material, inputHash, methodHash, validityDomainHash }) {
  return hashPayload({
    cacheFamily: 'peercompute-local-material-closure',
    schema: PEER_CLOSURE_CACHE_RECORD_SCHEMA,
    materialKey: materialCacheKey(material),
    inputHash,
    methodHash,
    validityDomainHash,
    generatorFingerprint: PEER_CLOSURE_CACHE_GENERATOR_FINGERPRINT
  });
}

function buildMaterialIndex(entries = {}) {
  const index = {};
  for (const [cacheKey, record] of Object.entries(entries)) {
    const materialKey = record.materialKey || record.key;
    if (!materialKey) continue;
    if (!index[materialKey]) index[materialKey] = [];
    index[materialKey].push(cacheKey);
  }
  return index;
}

function closureRecordFromProperties(material, properties) {
  const derivation = materialDerivationSummary(properties);
  const validityDomain = materialValidityDomain(material, properties);
  const inputHash = materialClosureInputHash(material, properties);
  const methodHash = materialClosureMethodHash(properties);
  const validityDomainHash = hashPayload(validityDomain);
  const propertiesHash = hashPayload(properties);
  const cacheKey = materialRecordKey({ material, inputHash, methodHash, validityDomainHash });
  return {
    schema: PEER_CLOSURE_CACHE_RECORD_SCHEMA,
    material,
    key: materialCacheKey(material),
    materialKey: materialCacheKey(material),
    cacheKey,
    closureFamily: 'material',
    methodVersion: PEER_CLOSURE_CACHE_METHOD_VERSION,
    inputHash,
    methodHash,
    validityDomain,
    validityDomainHash,
    propertiesHash,
    generatorSchema: PEER_CLOSURE_CACHE_GENERATOR_SCHEMA,
    generatorFingerprint: PEER_CLOSURE_CACHE_GENERATOR_FINGERPRINT,
    properties,
    materialDerivation: derivation,
    cacheStatus: 'peercompute-local-cache-write',
    invalidationPolicy: 'reuse only when schema, methodVersion, inputHash, validityDomainHash, and generatorFingerprint match current runtime',
    updatedAt: nowIso()
  };
}

function writePeerClosureCache(materialProperties = {}) {
  if (!storageAvailable()) {
    return { schema: PEER_CLOSURE_CACHE_SCHEMA, status: 'localstorage-unavailable', hitCount: 0, writeCount: 0 };
  }
  const cache = readPeerClosureCache();
  const entries = { ...(cache.entries || {}) };
  const materialIndex = { ...(cache.materialIndex || buildMaterialIndex(entries)) };
  let writeCount = 0;
  for (const [material, properties] of Object.entries(materialProperties || {})) {
    if (!properties) continue;
    const record = closureRecordFromProperties(material, properties);
    entries[record.cacheKey] = record;
    const previous = materialIndex[record.materialKey] || [];
    materialIndex[record.materialKey] = [
      record.cacheKey,
      ...previous.filter((key) => key !== record.cacheKey)
    ].slice(0, PEER_CLOSURE_CACHE_MAX_RECORDS_PER_MATERIAL);
    writeCount += 1;
  }
  const next = {
    schema: PEER_CLOSURE_CACHE_SCHEMA,
    status: 'stored',
    storageKey: PEER_CLOSURE_CACHE_STORAGE_KEY,
    entries,
    materialIndex,
    entryCount: Object.keys(entries).length,
    generatorFingerprint: PEER_CLOSURE_CACHE_GENERATOR_FINGERPRINT,
    generator: {
      schema: PEER_CLOSURE_CACHE_GENERATOR_SCHEMA,
      appVersion: PEER_CLOSURE_CACHE_APP_VERSION,
      methodVersion: PEER_CLOSURE_CACHE_METHOD_VERSION,
      fingerprint: PEER_CLOSURE_CACHE_GENERATOR_FINGERPRINT
    },
    updatedAt: nowIso(),
    provenance: {
      source: 'sph-phase-demo-materialProperties',
      reusePolicy: 'schema-input-method-validity-domain-generator-fingerprint-guarded-peercompute-local-cache'
    }
  };
  try {
    window.localStorage.setItem(PEER_CLOSURE_CACHE_STORAGE_KEY, JSON.stringify(next));
    return { ...next, writeCount };
  } catch (error) {
    return {
      schema: PEER_CLOSURE_CACHE_SCHEMA,
      status: 'write-error',
      reason: error instanceof Error ? error.message : String(error),
      entryCount: Object.keys(entries).length,
      generatorFingerprint: PEER_CLOSURE_CACHE_GENERATOR_FINGERPRINT,
      writeCount
    };
  }
}

function recordReuseStatus(record, materialKey) {
  if (!record) return { reusable: false, reason: 'missing-record' };
  if (record.schema !== PEER_CLOSURE_CACHE_RECORD_SCHEMA) {
    return { reusable: false, reason: 'record-schema-mismatch', cachedSchema: record.schema || null };
  }
  if (!record.properties) return { reusable: false, reason: 'missing-properties' };
  if ((record.materialKey || record.key) !== materialKey) {
    return { reusable: false, reason: 'material-key-mismatch', cachedMaterialKey: record.materialKey || record.key || null };
  }
  if (record.methodVersion !== PEER_CLOSURE_CACHE_METHOD_VERSION) {
    return { reusable: false, reason: 'method-version-mismatch', cachedMethodVersion: record.methodVersion || null };
  }
  if (record.generatorFingerprint !== PEER_CLOSURE_CACHE_GENERATOR_FINGERPRINT) {
    return {
      reusable: false,
      reason: 'generator-fingerprint-mismatch',
      cachedGeneratorFingerprint: record.generatorFingerprint || null,
      currentGeneratorFingerprint: PEER_CLOSURE_CACHE_GENERATOR_FINGERPRINT
    };
  }
  if (!record.inputHash || !record.methodHash || !record.validityDomainHash) {
    return { reusable: false, reason: 'missing-cache-guard-hash' };
  }
  if (record.propertiesHash && record.propertiesHash !== hashPayload(record.properties)) {
    return { reusable: false, reason: 'properties-hash-mismatch' };
  }
  return { reusable: true, reason: 'current-generator-match' };
}

function reusableRecordForMaterial(cache, material) {
  const materialKey = materialCacheKey(material);
  const indexedKeys = cache.materialIndex?.[materialKey] || [];
  const fallbackKeys = Object.entries(cache.entries || {})
    .filter(([, record]) => (record.materialKey || record.key) === materialKey)
    .map(([key]) => key);
  const candidateKeys = [...new Set([...indexedKeys, ...fallbackKeys])];
  const stale = [];
  for (const key of candidateKeys) {
    const record = cache.entries?.[key];
    const reuse = recordReuseStatus(record, materialKey);
    if (reuse.reusable) return { record, stale };
    stale.push({ material, cacheKey: key, ...reuse });
  }
  return { record: null, stale };
}

function cachedClosuresForMaterials(materials = []) {
  const cache = readPeerClosureCache();
  const closures = {};
  const hits = [];
  const misses = [];
  const stale = [];
  for (const material of materials) {
    const key = materialCacheKey(material);
    const { record, stale: staleForMaterial } = reusableRecordForMaterial(cache, material);
    stale.push(...staleForMaterial);
    if (record) {
      closures[material] = {
        closureFamily: 'material',
        closureId: `peercompute-local-cache-${key}`,
        material,
        properties: record.properties,
        materialDerivation: record.materialDerivation,
        provenance: {
          source: 'peercompute-localstorage-cache',
          cacheKey: record.cacheKey,
          inputHash: record.inputHash,
          methodHash: record.methodHash,
          validityDomainHash: record.validityDomainHash,
          generatorFingerprint: record.generatorFingerprint,
          updatedAt: record.updatedAt || null
        }
      };
      hits.push(material);
    } else {
      misses.push(material);
    }
  }
  return {
    schema: 'peercompute.ulg.local-derived-closure-cache-lookup.v1',
    status: hits.length > 0 ? 'peercompute-local-cache-hit' : cache.status,
    storageStatus: cache.status,
    previousSchema: cache.previousSchema || null,
    generatorFingerprint: PEER_CLOSURE_CACHE_GENERATOR_FINGERPRINT,
    closures,
    hits,
    misses,
    stale,
    hitCount: hits.length,
    missCount: misses.length,
    staleCount: stale.length + (cache.staleEntryCount || 0),
    entryCount: Object.keys(cache.entries || {}).length
  };
}

function readSphColdStartCache() {
  if (!storageAvailable()) {
    return emptySphColdStartCache('localstorage-unavailable', {
      generatorFingerprint: PEER_CLOSURE_CACHE_GENERATOR_FINGERPRINT
    });
  }
  try {
    return parseSphColdStartCacheSnapshot(
      window.localStorage.getItem(SPH_COLD_START_CACHE_STORAGE_KEY) || null,
      { generatorFingerprint: PEER_CLOSURE_CACHE_GENERATOR_FINGERPRINT }
    );
  } catch {
    return emptySphColdStartCache('parse-error', {
      generatorFingerprint: PEER_CLOSURE_CACHE_GENERATOR_FINGERPRINT
    });
  }
}

function readStorageSnapshot(storageKey) {
  if (!storageAvailable()) return null;
  try {
    return window.localStorage.getItem(storageKey) || null;
  } catch {
    return null;
  }
}

function readSphCacheStorageSnapshots() {
  const startMs = typeof performance?.now === 'function' ? performance.now() : Date.now();
  const materialCacheSnapshot = readStorageSnapshot(PEER_CLOSURE_CACHE_STORAGE_KEY);
  const coldStartCacheSnapshot = readStorageSnapshot(SPH_COLD_START_CACHE_STORAGE_KEY);
  const staticTableCacheSnapshot = readStorageSnapshot(SPH_STATIC_TABLE_CACHE_STORAGE_KEY);
  const endedAtMs = typeof performance?.now === 'function' ? performance.now() : Date.now();
  return {
    materialCacheSnapshot,
    coldStartCacheSnapshot,
    staticTableCacheSnapshot,
    timing: {
      schema: 'peercompute.ulg.sph-cache-storage-snapshot-read-timing.v0',
      totalMs: Math.max(0, endedAtMs - startMs),
      materialSnapshotBytes: typeof materialCacheSnapshot === 'string' ? materialCacheSnapshot.length : 0,
      coldStartSnapshotBytes: typeof coldStartCacheSnapshot === 'string' ? coldStartCacheSnapshot.length : 0,
      staticTableSnapshotBytes: typeof staticTableCacheSnapshot === 'string' ? staticTableCacheSnapshot.length : 0
    }
  };
}

function cacheLookupMaterialsForOptions(options) {
  return [
    options.dropMaterial,
    options.baseMaterial,
    'h2o',
    'fe',
    'air',
    'h2',
    'o2'
  ];
}

function workerCacheLookupInput(options, snapshots = readSphCacheStorageSnapshots()) {
  return {
    materialCacheSnapshot: snapshots.materialCacheSnapshot,
    coldStartCacheSnapshot: snapshots.coldStartCacheSnapshot,
    materials: cacheLookupMaterialsForOptions(options),
    options: {
      dropMaterial: options.dropMaterial,
      baseMaterial: options.baseMaterial,
      allowFixtureMaterialProperties: options.allowFixtureMaterialProperties === true,
      allowReducedProductProperties: options.allowReducedProductProperties === true,
      deriveCandidateEnergies: options.deriveCandidateEnergies !== false,
      strictEnergetics: options.strictEnergetics === true
    },
    generatorFingerprint: PEER_CLOSURE_CACHE_GENERATOR_FINGERPRINT,
    cacheSchema: PEER_CLOSURE_CACHE_SCHEMA,
    recordSchema: PEER_CLOSURE_CACHE_RECORD_SCHEMA,
    methodVersion: PEER_CLOSURE_CACHE_METHOD_VERSION,
    storageSnapshotTiming: snapshots.timing || null
  };
}

function workerCachePersistenceInput(snapshots = readSphCacheStorageSnapshots()) {
  return {
    materialCacheSnapshot: snapshots.materialCacheSnapshot,
    coldStartCacheSnapshot: snapshots.coldStartCacheSnapshot,
    generatorFingerprint: PEER_CLOSURE_CACHE_GENERATOR_FINGERPRINT,
    cacheSchema: PEER_CLOSURE_CACHE_SCHEMA,
    recordSchema: PEER_CLOSURE_CACHE_RECORD_SCHEMA,
    generatorSchema: PEER_CLOSURE_CACHE_GENERATOR_SCHEMA,
    appVersion: PEER_CLOSURE_CACHE_APP_VERSION,
    methodVersion: PEER_CLOSURE_CACHE_METHOD_VERSION
  };
}

function workerStaticTableCacheInput(snapshots = readSphCacheStorageSnapshots()) {
  return {
    cacheSnapshot: snapshots.staticTableCacheSnapshot,
    generatorFingerprint: PEER_CLOSURE_CACHE_GENERATOR_FINGERPRINT
  };
}

function materialPropertiesFromClosureLookup(lookup) {
  return Object.fromEntries(
    Object.entries(lookup?.closures || {})
      .filter(([, closure]) => closure?.properties)
      .map(([material, closure]) => [material, closure.properties])
  );
}

function reactionCacheKeyForOptions(options, materialProperties) {
  if (!options?.dropMaterial || !options?.baseMaterial || !materialProperties) return null;
  return createReactionDiscoveryCacheKey(options.dropMaterial, options.baseMaterial, {
    materialProperties,
    allowFixtureMaterialProperties: options.allowFixtureMaterialProperties === true,
    allowReducedProductProperties: options.allowReducedProductProperties === true,
    deriveCandidateEnergies: options.deriveCandidateEnergies !== false,
    strictEnergetics: options.strictEnergetics === true
  });
}

function cachedProductClosuresFromColdCache(cache) {
  const closures = {};
  for (const record of Object.values(cache?.productReuse || {})) {
    if (
      record?.schema === SPH_PRODUCT_REUSE_RECORD_SCHEMA
      && record.generatorFingerprint === PEER_CLOSURE_CACHE_GENERATOR_FINGERPRINT
      && record.productKey
      && record.closure?.properties
    ) {
      closures[record.productKey] = record.closure;
    }
  }
  return closures;
}

function cachedReactionRecordForOptions(options, closureLookup) {
  const cache = readSphColdStartCache();
  const materialProperties = materialPropertiesFromClosureLookup(closureLookup);
  const cacheKey = reactionCacheKeyForOptions(options, materialProperties);
  const record = cacheKey ? cache.reactions?.[cacheKey] : null;
  const reuse = record?.schema === REACTION_DISCOVERY_CACHE_RECORD_SCHEMA
    && record.cacheKey === cacheKey
    && record.generatorFingerprint === PEER_CLOSURE_CACHE_GENERATOR_FINGERPRINT
    && record.result
    ? {
      status: 'reaction-cache-hit',
      cacheKey,
      record,
      productClosures: {
        ...cachedProductClosuresFromColdCache(cache),
        ...(record.productClosures || {})
      }
    }
    : {
      status: cacheKey ? 'reaction-cache-miss' : 'reaction-cache-unkeyed',
      cacheKey,
      record: null,
      productClosures: cachedProductClosuresFromColdCache(cache)
    };
  return {
    schema: 'peercompute.ulg.sph-cold-start-cache-lookup.v0',
    storageStatus: cache.status,
    generatorFingerprint: PEER_CLOSURE_CACHE_GENERATOR_FINGERPRINT,
    reactionCount: Object.keys(cache.reactions || {}).length,
    productReuseCount: Object.keys(cache.productReuse || {}).length,
    tableCount: Object.keys(cache.tables || {}).length,
    gpuWarmupCount: Object.keys(cache.gpuWarmup || {}).length,
    staleCount: cache.staleEntryCount || 0,
    ...reuse
  };
}

function productReuseRecord(productKey, closure, reactionDiscovery) {
  return {
    schema: SPH_PRODUCT_REUSE_RECORD_SCHEMA,
    productKey,
    closure,
    sourceReactionCacheKey: reactionDiscovery?.cache?.cacheKey || null,
    generatorFingerprint: PEER_CLOSURE_CACHE_GENERATOR_FINGERPRINT,
    closureHash: hashPayload(closure?.properties || closure || null),
    updatedAt: nowIso(),
    provenance: {
      source: 'sph-phase-demo-reaction-product',
      reusePolicy: 'schema-product-key-generator-closure-hash'
    }
  };
}

function reactionRecordFromDiscovery(reactionDiscovery, materialProperties = {}) {
  const cacheKey = reactionDiscovery?.cache?.cacheKey;
  if (!cacheKey) return null;
  const productClosures = {};
  for (const [productKey, closure] of Object.entries(reactionDiscovery.productClosures || {})) {
    if (closure?.properties) productClosures[productKey] = closure;
  }
  return {
    schema: REACTION_DISCOVERY_CACHE_RECORD_SCHEMA,
    cacheKey,
    result: {
      reactions: reactionDiscovery.reactions || [],
      productClosures,
      note: reactionDiscovery.note || null,
      cache: {
        ...(reactionDiscovery.cache || {}),
        cacheStatus: 'persistent-record-source'
      }
    },
    productClosures,
    materialPropertiesHash: hashPayload(Object.fromEntries(
      Object.entries(materialProperties || {})
        .map(([material, properties]) => [materialCacheKey(material), hashPayload(properties)])
        .sort(([a], [b]) => a.localeCompare(b))
    )),
    generatorFingerprint: PEER_CLOSURE_CACHE_GENERATOR_FINGERPRINT,
    updatedAt: nowIso(),
    provenance: {
      source: 'sph-phase-demo-reaction-discovery',
      reusePolicy: 'schema-cache-key-generator-product-closure-hash'
    }
  };
}

function writeSphColdStartReactionCache(reactionDiscovery, materialProperties = {}) {
  if (!storageAvailable()) {
    return emptySphColdStartCache('localstorage-unavailable', {
      generatorFingerprint: PEER_CLOSURE_CACHE_GENERATOR_FINGERPRINT
    });
  }
  const reactionRecord = reactionRecordFromDiscovery(reactionDiscovery, materialProperties);
  const previous = readSphColdStartCache();
  const reactions = { ...(previous.reactions || {}) };
  const productReuse = { ...(previous.productReuse || {}) };
  let reactionWriteCount = 0;
  let productReuseWriteCount = 0;
  if (reactionRecord) {
    reactions[reactionRecord.cacheKey] = reactionRecord;
    reactionWriteCount = 1;
    for (const [productKey, closure] of Object.entries(reactionRecord.productClosures || {})) {
      productReuse[materialCacheKey(productKey)] = productReuseRecord(materialCacheKey(productKey), closure, reactionDiscovery);
      productReuseWriteCount += 1;
    }
  }
  const next = {
    schema: SPH_COLD_START_CACHE_SCHEMA,
    status: 'stored',
    storageKey: SPH_COLD_START_CACHE_STORAGE_KEY,
    generatorFingerprint: PEER_CLOSURE_CACHE_GENERATOR_FINGERPRINT,
    reactions,
    productReuse,
    tables: {},
    gpuWarmup: {},
    tableSchema: SPH_TABLE_CACHE_RECORD_SCHEMA,
    gpuWarmupSchema: SPH_GPU_WARMUP_CACHE_SCHEMA,
    updatedAt: nowIso(),
    counts: {
      reactions: Object.keys(reactions).length,
      productReuse: Object.keys(productReuse).length,
      tables: 0,
      gpuWarmup: 0
    },
    provenance: {
      source: 'sph-phase-demo-cold-start-cache-coordinator',
      reusePolicy: 'derived-artifact-cache-only'
    }
  };
  try {
    window.localStorage.setItem(SPH_COLD_START_CACHE_STORAGE_KEY, JSON.stringify(next));
    return {
      ...next,
      reactionWriteCount,
      productReuseWriteCount
    };
  } catch (error) {
    return emptySphColdStartCache('write-error', {
      reason: error instanceof Error ? error.message : String(error),
      reactionWriteCount,
      productReuseWriteCount,
      generatorFingerprint: PEER_CLOSURE_CACHE_GENERATOR_FINGERPRINT
    });
  }
}

function clearSphLocalDerivedCaches() {
  const beforeMaterial = readPeerClosureCache();
  const beforeCold = readSphColdStartCache();
  const beforeStatic = storageAvailable()
    ? parseSphStaticTableCacheSnapshot(window.localStorage.getItem(SPH_STATIC_TABLE_CACHE_STORAGE_KEY) || null, {
      generatorFingerprint: PEER_CLOSURE_CACHE_GENERATOR_FINGERPRINT
    })
    : { tables: {}, gpuWarmup: {} };
  if (storageAvailable()) {
    window.localStorage.removeItem(PEER_CLOSURE_CACHE_STORAGE_KEY);
    window.localStorage.removeItem(SPH_COLD_START_CACHE_STORAGE_KEY);
    window.localStorage.removeItem(SPH_STATIC_TABLE_CACHE_STORAGE_KEY);
  }
  clearReactionDiscoveryCache();
  return {
    schema: 'peercompute.ulg.sph-local-derived-cache-clear.v0',
    status: storageAvailable() ? 'cleared' : 'localstorage-unavailable',
    clearedAt: nowIso(),
    materialRecords: Object.keys(beforeMaterial.entries || {}).length,
    reactionRecords: Object.keys(beforeCold.reactions || {}).length,
    productReuseRecords: Object.keys(beforeCold.productReuse || {}).length,
    tableRecords: Object.keys(beforeStatic.tables || {}).length,
    gpuWarmupRecords: Object.keys(beforeStatic.gpuWarmup || {}).length,
    generatorFingerprint: PEER_CLOSURE_CACHE_GENERATOR_FINGERPRINT
  };
}

/**
 * Headless demo API attached to window.__ulgDemo (no rendering).
 */
export function createSphPhaseDemoApi() {
  let driver = null;
  const ensure = (options) => {
    if (!driver) driver = createSphPhaseDemo(options);
    return driver;
  };
  return {
    runSphPhaseDemoPreflight(options = {}) {
      return createSphPhaseDemo(options).preflight();
    },
    runSphPhaseDemoStep(options = {}) {
      const d = ensure(options);
      d.step();
      return { totals: d.totals(), phaseMassSummary: d.phaseMassSummary() };
    },
    runSphPhaseDemo(options = {}) {
      const d = createSphPhaseDemo(options);
      const preflight = d.preflight();
      const steps = options.steps ?? 0;
      for (let i = 0; i < steps; i += 1) d.step();
      return {
        preflight,
        counts: d.demo.counts,
        totals: d.totals(),
        phaseMassSummary: d.phaseMassSummary(),
        scientificValidation: false,
        sphValidation: false,
        phaseChangeValidation: false
      };
    },
    resetSphPhaseDemo() {
      driver = null;
    }
  };
}

function buildOverlayShell() {
  const overlay = document.createElement('div');
  overlay.id = 'sph-phase-overlay';
  // The 3D scene fills the whole overlay; the control panel is a slide-in drawer over it, so the
  // scene stays full-viewport (good for touch orbit) and the menu collapses on small screens.
  overlay.style.cssText = 'position:fixed;inset:0;z-index:50;background:#04070a;color:#bfe9d8;font-family:ui-monospace,monospace;';
  overlay.innerHTML = `
    <style>
      #sph-phase-overlay button { background:#14342c;color:#bfe9d8;border:1px solid #1d8b6d;border-radius:6px;padding:8px 12px;margin:0 4px 4px 0;font:600 13px ui-monospace,monospace;cursor:pointer;min-height:40px;touch-action:manipulation; }
      #sph-phase-overlay button:active { background:#1d8b6d;color:#04070a; }
      #sph-phase-overlay input, #sph-phase-overlay select { min-height:36px;font-size:16px;box-sizing:border-box; }
      #sph-phase-overlay select { width:100%;background:#0a1418;color:#bfe9d8;border:1px solid #14342c; }
      .sph-material-row { display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px;align-items:center; }
      .sph-picker-button { width:42px;padding:8px 0!important;margin:0!important; }
      .sph-element-picker-overlay { position:fixed;inset:0;z-index:90;background:rgba(2,6,8,.78);display:flex;align-items:center;justify-content:center;padding:14px; }
      .sph-element-picker { width:min(1080px,96vw);max-height:min(760px,92vh);box-sizing:border-box;border:1px solid #1d8b6d;background:#071114;color:#bfe9d8;padding:12px;box-shadow:0 18px 60px rgba(0,0,0,.58);display:flex;flex-direction:column;gap:10px; }
      .sph-picker-head { display:flex;justify-content:space-between;gap:10px;align-items:start; }
      .sph-picker-title { color:#75f7b4;font-weight:700;line-height:1.3; }
      .sph-picker-subtitle { color:#75c7f7;font-size:11px;opacity:.8;margin-top:3px; }
      .sph-picker-search { width:100%;background:#0a1418;color:#bfe9d8;border:1px solid #14342c;padding:8px; }
      .sph-element-grid-scroll { overflow:auto;-webkit-overflow-scrolling:touch;padding-bottom:4px; }
      .sph-element-grid { display:grid;grid-template-columns:repeat(18,48px);grid-auto-rows:48px;gap:4px;width:max-content;min-width:100%; }
      #sph-phase-overlay .sph-element-cell { position:relative;margin:0!important;padding:3px!important;min-height:48px;border-radius:4px;background:#0b181d;border-color:#245447;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px; }
      #sph-phase-overlay .sph-element-cell:hover { border-color:#75f7b4;background:#102823; }
      #sph-phase-overlay .sph-element-cell.selected { border-color:#fff2a8;box-shadow:0 0 0 2px rgba(255,242,168,.25); }
      .sph-element-number { font-size:9px;color:#75c7f7;line-height:1; }
      .sph-element-symbol { font-size:15px;font-weight:800;line-height:1; }
      .sph-element-name { font-size:8px;line-height:1;max-width:42px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:.86; }
      .sph-cat-alkali { background:#182412!important; }
      .sph-cat-alkaline { background:#202512!important; }
      .sph-cat-transition { background:#112127!important; }
      .sph-cat-post-transition { background:#211c25!important; }
      .sph-cat-metalloid { background:#1e2418!important; }
      .sph-cat-nonmetal { background:#162225!important; }
      .sph-cat-halogen { background:#241b17!important; }
      .sph-cat-lanthanide { background:#1d1d2a!important; }
      .sph-cat-actinide { background:#251b22!important; }
      .sph-picker-legend { display:flex;flex-wrap:wrap;gap:5px;font-size:10px;color:#75c7f7; }
      .sph-legend-chip { border:1px solid #245447;padding:3px 6px;background:#0a1418; }
      #sph-panel { transition:transform .25s ease; }
      #sph-panel.collapsed { transform:translateX(110%); }
      #sph-toggle { position:absolute;top:12px;left:12px;z-index:72; }
      #sph-warning-bar { position:absolute;top:0;left:0;right:0;z-index:65;display:flex;flex-wrap:wrap;gap:6px;align-items:flex-start;padding:8px 12px 8px 128px;box-sizing:border-box;pointer-events:none; }
      .sph-warning-chip { border:1px solid #f7c675;background:rgba(46,30,8,.92);color:#ffe7b2;padding:4px 7px;font-size:11px;line-height:1.25; }
      .sph-fps-chip { border:1px solid #1d8b6d;background:rgba(4,12,14,.88);color:#75f7b4;padding:4px 7px;font-size:11px;line-height:1.25;max-width:calc(100vw - 152px);white-space:normal;overflow-wrap:anywhere; }
      @media (max-width:700px) { #sph-panel { width:min(340px,92vw); } #sph-status { font-size:13px; } #sph-warning-bar { padding-left:118px;padding-right:8px; } .sph-fps-chip { max-width:calc(100vw - 134px);font-size:10px; } .sph-warning-chip { max-width:calc(100vw - 24px); } .sph-element-grid { grid-template-columns:repeat(18,42px);grid-auto-rows:42px; } #sph-phase-overlay .sph-element-cell { min-height:42px; } .sph-element-name { display:none; } }
    </style>
    <div id="sph-scene" style="position:absolute;inset:0;"></div>
    <div id="sph-warning-bar" aria-live="polite">
      <span id="sph-fps" class="sph-fps-chip">render fps -- | physics fps --</span>
    </div>
    <button id="sph-toggle" type="button" aria-label="Toggle controls">☰ menu</button>
    <aside id="sph-panel" style="position:absolute;top:0;right:0;height:100%;width:min(360px,92vw);box-sizing:border-box;border-left:1px solid #14342c;padding:14px;padding-top:56px;overflow:auto;-webkit-overflow-scrolling:touch;background:rgba(5,11,14,0.96);z-index:55;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
        <strong style="color:#75f7b4;">SPH PHASE — two materials interacting</strong>
        <button id="sph-close" type="button">close</button>
      </div>
      <p style="opacity:.6;font-size:11px;line-height:1.4;">Strict first-principles mode. The demo will not run reference or reduced material constants as physics; missing condensed, liquid, optical, or product closures are reported as blockers.</p>
      <div style="margin:8px 0;display:flex;flex-wrap:wrap;">
        <button id="sph-preflight" type="button">Preflight</button>
        <button id="sph-play" type="button">Play</button>
        <button id="sph-step" type="button">Step</button>
        <button id="sph-reset" type="button">Reset</button>
        <button id="sph-clear-cache" type="button">Clear Cache</button>
      </div>
      <div style="font-size:11px;color:#75c7f7;margin-top:6px;">scenario preset - auto-applies</div>
      <div id="sph-scenario-preset" style="display:grid;grid-template-columns:1fr;gap:6px;margin:4px 0 8px 0;"></div>
      <div style="font-size:11px;color:#75c7f7;margin-top:6px;">mechanics integrator — auto-applies</div>
      <div id="sph-mechanics-mode" style="display:grid;grid-template-columns:1fr;gap:6px;margin:4px 0 8px 0;"></div>
      <div style="font-size:11px;color:#75c7f7;margin-top:6px;">physical law groups — auto-applies</div>
      <div id="sph-laws" style="display:grid;grid-template-columns:1fr;gap:4px;margin:4px 0 8px 0;"></div>
      <div style="font-size:11px;color:#75c7f7;margin-top:6px;">wall temperatures (K)</div>
      <div id="sph-walls" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:4px 0;"></div>
      <div style="font-size:11px;color:#75c7f7;margin-top:6px;">materials — auto-applies</div>
      <div id="sph-elements" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:4px 0;"></div>
      <div style="font-size:11px;color:#75c7f7;margin-top:6px;">initial temperature (K) — auto-applies</div>
      <div id="sph-temps" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:4px 0;"></div>
      <div style="font-size:11px;color:#75c7f7;margin-top:6px;">initial block height (m, bottom face) — auto-applies</div>
      <div id="sph-heights" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:4px 0;"></div>
      <div style="font-size:11px;color:#75c7f7;margin-top:6px;">container box size (m, X·Y·Z) — auto-applies</div>
      <div id="sph-box" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin:4px 0;"></div>
      <div style="font-size:11px;color:#75c7f7;margin-top:6px;">particles per block edge (N → N³ particles) — auto-applies</div>
      <div id="sph-counts" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:4px 0;"></div>
      <div style="font-size:11px;color:#75c7f7;margin-top:6px;">isosurface blob size (× — independent of box) — live</div>
      <div id="sph-blob" style="display:grid;grid-template-columns:1fr;gap:6px;margin:4px 0;"></div>
      <div style="font-size:11px;color:#75c7f7;margin-top:6px;">render mode — live</div>
      <div id="sph-render-mode" style="display:grid;grid-template-columns:1fr;gap:6px;margin:4px 0;"></div>
      <div style="font-size:11px;color:#75c7f7;margin-top:6px;">background color — live</div>
      <div id="sph-background-color" style="display:grid;grid-template-columns:1fr;gap:6px;margin:4px 0;"></div>
      <div class="terminal-head"><span>status</span></div>
      <pre id="sph-status" style="white-space:pre-wrap;font-size:12px;line-height:1.5;margin:6px 0;"></pre>
    </aside>
  `;
  return overlay;
}

function categoryLabel(category) {
  return String(category || 'element').replace(/-/g, ' ');
}

function createPickerSpan(className, text) {
  const span = document.createElement('span');
  span.className = className;
  span.textContent = text;
  return span;
}

function canonicalMaterialKeyFromUrl(value) {
  if (typeof value !== 'string') return value;
  const raw = value.trim();
  if (!raw) return raw;
  const direct = MATERIAL_OPTIONS.find((option) => option.key === raw);
  if (direct) return direct.key;
  const lower = raw.toLowerCase();
  const match = MATERIAL_OPTIONS.find((option) => (
    option.key.toLowerCase() === lower
    || option.symbol?.toLowerCase() === lower
    || option.formula?.toLowerCase() === lower
  ));
  return match?.key || raw;
}

function normalizeUrlControlValue(key, value) {
  if (key === 'drop' || key === 'base') return canonicalMaterialKeyFromUrl(value);
  if (key === 'bg') return normalizeSphSceneBackgroundColorHex(value);
  return value;
}

function openElementPicker({ overlay, select, roleLabel }) {
  overlay.querySelector('.sph-element-picker-overlay')?.remove();

  const pickerOverlay = document.createElement('div');
  pickerOverlay.className = 'sph-element-picker-overlay';

  const picker = document.createElement('section');
  picker.className = 'sph-element-picker';
  picker.setAttribute('role', 'dialog');
  picker.setAttribute('aria-modal', 'true');
  picker.setAttribute('aria-label', `Choose element for ${roleLabel}`);

  const head = document.createElement('div');
  head.className = 'sph-picker-head';
  const titleWrap = document.createElement('div');
  const title = document.createElement('div');
  title.className = 'sph-picker-title';
  title.textContent = `periodic table - ${roleLabel}`;
  const subtitle = document.createElement('div');
  subtitle.className = 'sph-picker-subtitle';
  subtitle.textContent = 'Selectable cells resolve through the derived element material closure.';
  titleWrap.append(title, subtitle);
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.textContent = 'close';
  head.append(titleWrap, closeButton);

  const search = document.createElement('input');
  search.className = 'sph-picker-search';
  search.type = 'search';
  search.placeholder = 'filter by name, symbol, or Z';

  const scroll = document.createElement('div');
  scroll.className = 'sph-element-grid-scroll';
  const grid = document.createElement('div');
  grid.className = 'sph-element-grid';
  scroll.appendChild(grid);

  const legend = document.createElement('div');
  legend.className = 'sph-picker-legend';
  const categories = [...new Set(ELEMENT_MATERIAL_OPTIONS.map((option) => option.category))];
  for (const category of categories) {
    const chip = document.createElement('span');
    chip.className = `sph-legend-chip sph-cat-${category}`;
    chip.textContent = categoryLabel(category);
    legend.appendChild(chip);
  }

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    window.removeEventListener('keydown', onKeyDown);
    pickerOverlay.remove();
    select.focus();
  };
  function onKeyDown(event) {
    if (event.key === 'Escape') close();
  }

  function renderGrid() {
    const query = search.value.trim().toLowerCase();
    grid.replaceChildren();
    for (const option of ELEMENT_MATERIAL_OPTIONS) {
      const haystack = `${option.name} ${option.symbol} ${option.Z}`.toLowerCase();
      if (query && !haystack.includes(query)) continue;
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = `sph-element-cell sph-cat-${option.category}`;
      if (option.key === select.value) cell.classList.add('selected');
      cell.style.gridColumn = String(option.group);
      cell.style.gridRow = String(option.period);
      cell.title = option.label;
      cell.setAttribute('aria-label', option.label);
      cell.append(
        createPickerSpan('sph-element-number', String(option.Z)),
        createPickerSpan('sph-element-symbol', option.symbol),
        createPickerSpan('sph-element-name', option.name)
      );
      cell.addEventListener('click', () => {
        select.value = option.key;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        close();
      });
      grid.appendChild(cell);
    }
  }

  closeButton.addEventListener('click', close);
  pickerOverlay.addEventListener('click', (event) => {
    if (event.target === pickerOverlay) close();
  });
  search.addEventListener('input', renderGrid);
  window.addEventListener('keydown', onKeyDown);

  picker.append(head, search, scroll, legend);
  pickerOverlay.appendChild(picker);
  overlay.appendChild(pickerOverlay);
  renderGrid();
  search.focus();
}

/**
 * Open the visual SPH phase demo overlay. Returns a close handle.
 */
export async function mountSphPhaseDemoOverlay({
  autoStart = false,
  hideMenu = false,
  runtime = null,
  residentComputeManager = null,
  residentStateManager = null,
  residentAuthorityHost = null,
  enablePeerComputeResidentHost = true,
  peercomputeModuleUrl = undefined,
  residentComputeTaskModulePath = undefined,
  enableRemoteResidentTaskGraphRefresh = false,
  remoteResidentTaskGraph = null,
  remoteResidentTaskGraphFactory = null,
  remoteResidentTaskGraphOptions = null,
  remoteResidentTaskGraphRefreshOptions = null
} = {}) {
  const overlay = buildOverlayShell();
  document.body.appendChild(overlay);
  let peerComputeResidentAuthorityHost = residentAuthorityHost || null;
  let peerComputeResidentAuthorityHostPromise = null;
  function currentResidentAuthorityHostForScene() {
    return peerComputeResidentAuthorityHost
      || residentAuthorityHost
      || runtime?.residentAuthorityHost
      || globalThis.__ulgResidentAuthorityHost
      || null;
  }

  const mechanicsModeEl = overlay.querySelector('#sph-mechanics-mode');
  const mechanicsModeSelect = document.createElement('select');
  mechanicsModeSelect.title = 'Choose the mechanical integrator';
  mechanicsModeSelect.setAttribute('aria-label', 'Choose mechanics integrator');
  for (const [value, label] of MECHANICS_MODE_OPTIONS) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    if (value === MECHANICS_MODE_DEFAULT) option.selected = true;
    mechanicsModeSelect.appendChild(option);
  }
  mechanicsModeEl.appendChild(mechanicsModeSelect);

  const scenarioPresetEl = overlay.querySelector('#sph-scenario-preset');
  const scenarioPresetSelect = document.createElement('select');
  scenarioPresetSelect.title = 'Choose a standard physics scenario';
  scenarioPresetSelect.setAttribute('aria-label', 'Choose scenario preset');
  const customScenarioOption = document.createElement('option');
  customScenarioOption.value = 'custom';
  customScenarioOption.textContent = 'Custom controls';
  scenarioPresetSelect.appendChild(customScenarioOption);
  for (const entry of SPH_PHASE_SCENARIO_PRESETS) {
    const option = document.createElement('option');
    option.value = entry.id;
    option.textContent = entry.label;
    scenarioPresetSelect.appendChild(option);
  }
  scenarioPresetEl.appendChild(scenarioPresetSelect);

  const wallsEl = overlay.querySelector('#sph-walls');
  const lawsEl = overlay.querySelector('#sph-laws');
  const lawInputs = {};
  for (const [key, label, defaultEnabled = true] of PHYSICAL_LAW_GROUPS) {
    const wrap = document.createElement('label');
    wrap.style.cssText = 'font-size:11px;display:flex;align-items:center;gap:8px;min-height:28px;';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = defaultEnabled !== false;
    input.style.cssText = 'width:16px;height:16px;accent-color:#1d8b6d;';
    const text = document.createElement('span');
    text.textContent = label;
    wrap.append(input, text);
    lawsEl.appendChild(wrap);
    lawInputs[key] = input;
  }

  const wallInputs = {};
  for (const face of WALL_FACES) {
    const wrap = document.createElement('label');
    wrap.style.cssText = 'font-size:11px;display:flex;flex-direction:column;gap:2px;';
    wrap.textContent = face;
    const input = document.createElement('input');
    input.type = 'number';
    input.value = String(WALL_DEFAULT_K);
    input.step = '5';
    input.style.cssText = 'width:100%;background:#0a1418;color:#bfe9d8;border:1px solid #14342c;';
    wrap.appendChild(input);
    wallsEl.appendChild(wrap);
    wallInputs[face] = input;
  }

  const heightsEl = overlay.querySelector('#sph-heights');
  const heightInputs = {};
  for (const [key, label, value] of [['ice', 'ice base', ICE_BASE_DEFAULT_M], ['iron', 'iron base', IRON_BASE_DEFAULT_M]]) {
    const wrap = document.createElement('label');
    wrap.style.cssText = 'font-size:11px;display:flex;flex-direction:column;gap:2px;';
    wrap.textContent = label;
    const input = document.createElement('input');
    input.type = 'number';
    input.value = String(value);
    input.step = '0.25';
    input.style.cssText = 'width:100%;background:#0a1418;color:#bfe9d8;border:1px solid #14342c;';
    wrap.appendChild(input);
    heightsEl.appendChild(wrap);
    heightInputs[key] = input;
  }

  const boxEl = overlay.querySelector('#sph-box');
  const boxInputs = {};
  for (const [key, label, value] of [['x', 'X', BOX_DIM_DEFAULTS_M.x], ['y', 'Y', BOX_DIM_DEFAULTS_M.y], ['z', 'Z', BOX_DIM_DEFAULTS_M.z]]) {
    const wrap = document.createElement('label');
    wrap.style.cssText = 'font-size:11px;display:flex;flex-direction:column;gap:2px;';
    wrap.textContent = label;
    const input = document.createElement('input');
    input.type = 'number';
    input.value = String(value);
    input.step = '0.5';
    input.min = '1';
    input.style.cssText = 'width:100%;background:#0a1418;color:#bfe9d8;border:1px solid #14342c;';
    wrap.appendChild(input);
    boxEl.appendChild(wrap);
    boxInputs[key] = input;
  }

  const countsEl = overlay.querySelector('#sph-counts');
  const countInputs = {};
  for (const [key, label, value] of [['drop', 'drop edge', DROP_PARTICLE_EDGE_DEFAULT], ['base', 'base edge', BASE_PARTICLE_EDGE_DEFAULT]]) {
    const wrap = document.createElement('label');
    wrap.style.cssText = 'font-size:11px;display:flex;flex-direction:column;gap:2px;';
    wrap.textContent = label;
    const input = document.createElement('input');
    input.type = 'number';
    input.value = String(value);
    input.step = '1';
    input.min = '1';
    input.style.cssText = 'width:100%;background:#0a1418;color:#bfe9d8;border:1px solid #14342c;';
    wrap.appendChild(input);
    countsEl.appendChild(wrap);
    countInputs[key] = input;
  }

  const blobEl = overlay.querySelector('#sph-blob');
  const blobInput = document.createElement('input');
  blobInput.type = 'number';
  blobInput.value = String(BLOB_SCALE_DEFAULT);
  blobInput.step = '0.1';
  blobInput.min = '0.1';
  blobInput.style.cssText = 'width:100%;background:#0a1418;color:#bfe9d8;border:1px solid #14342c;';
  blobEl.appendChild(blobInput);

  const renderModeEl = overlay.querySelector('#sph-render-mode');
  const renderModeSelect = document.createElement('select');
  renderModeSelect.title = 'Choose the visible renderer mode';
  renderModeSelect.setAttribute('aria-label', 'Choose render mode');
  for (const [value, label] of RESIDENT_SURFACE_RENDER_MODE_OPTIONS) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    renderModeSelect.appendChild(option);
  }
  renderModeEl.appendChild(renderModeSelect);

  const backgroundColorEl = overlay.querySelector('#sph-background-color');
  const backgroundColorInput = document.createElement('input');
  backgroundColorInput.type = 'color';
  backgroundColorInput.value = SPH_SCENE_BACKGROUND_COLOR_DEFAULT;
  backgroundColorInput.title = 'Choose the scene background color';
  backgroundColorInput.setAttribute('aria-label', 'Choose scene background color');
  backgroundColorInput.style.cssText = 'width:100%;height:40px;background:#0a1418;color:#bfe9d8;border:1px solid #14342c;padding:4px;';
  backgroundColorEl.appendChild(backgroundColorInput);
  // Background image picker: the plan/ images ship with the repo and are
  // served by the dev server; the first entry falls back to the solid color.
  const BACKGROUND_IMAGE_OPTIONS = Object.freeze([
    ['', 'Background: solid color'],
    ['/plan/background-1.jpg', 'Background image 1'],
    ['/plan/background-2.jpg', 'Background image 2'],
    ['/plan/background-3.jpg', 'Background image 3'],
    ['/plan/background-4.jpg', 'Background image 4']
  ]);
  const backgroundImageSelect = document.createElement('select');
  backgroundImageSelect.title = 'Choose a background image (or the solid color)';
  backgroundImageSelect.setAttribute('aria-label', 'Choose scene background image');
  backgroundImageSelect.style.cssText = 'width:100%;background:#0a1418;color:#bfe9d8;border:1px solid #14342c;padding:6px;';
  for (const [value, label] of BACKGROUND_IMAGE_OPTIONS) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    backgroundImageSelect.appendChild(option);
  }
  backgroundColorEl.appendChild(backgroundImageSelect);

  const elementsEl = overlay.querySelector('#sph-elements');
  const elementSelects = {};
  for (const [role, label, def] of [['drop', 'drop block', DROP_MATERIAL_DEFAULT], ['base', 'base block', BASE_MATERIAL_DEFAULT]]) {
    const wrap = document.createElement('label');
    wrap.style.cssText = 'font-size:11px;display:flex;flex-direction:column;gap:2px;';
    wrap.textContent = label;
    const row = document.createElement('div');
    row.className = 'sph-material-row';
    const select = document.createElement('select');
    select.className = 'sph-material-select';
    for (const opt of MATERIAL_OPTIONS) {
      const o = document.createElement('option');
      o.value = opt.key;
      o.textContent = opt.label;
      if (opt.key === def) o.selected = true;
      select.appendChild(o);
    }
    const pickerButton = document.createElement('button');
    pickerButton.type = 'button';
    pickerButton.className = 'sph-picker-button';
    pickerButton.textContent = 'PT';
    pickerButton.title = `Open periodic table for ${label}`;
    pickerButton.setAttribute('aria-label', `Open periodic table for ${label}`);
    pickerButton.addEventListener('click', () => openElementPicker({ overlay, select, roleLabel: label }));
    row.append(select, pickerButton);
    wrap.appendChild(row);
    elementsEl.appendChild(wrap);
    elementSelects[role] = select;
  }

  const tempsEl = overlay.querySelector('#sph-temps');
  const tempInputs = {};
  for (const [role, label, def] of [['drop', 'drop block T', DROP_TEMP_DEFAULT_K], ['base', 'base block T', BASE_TEMP_DEFAULT_K]]) {
    const wrap = document.createElement('label');
    wrap.style.cssText = 'font-size:11px;display:flex;flex-direction:column;gap:2px;';
    wrap.textContent = label;
    const input = document.createElement('input');
    input.type = 'number';
    input.value = String(def);
    input.step = '10';
    input.style.cssText = 'width:100%;background:#0a1418;color:#bfe9d8;border:1px solid #14342c;';
    wrap.appendChild(input);
    tempsEl.appendChild(wrap);
    tempInputs[role] = input;
  }

  const statusEl = overlay.querySelector('#sph-status');
  const warningBarEl = overlay.querySelector('#sph-warning-bar');
  const fpsEl = overlay.querySelector('#sph-fps');
  const sceneContainer = overlay.querySelector('#sph-scene');

  // URL state: every control is encoded in the location hash so a refresh restores the full setup.
  // Query params are also accepted for direct links, then normalized into the hash on first sync.
  const urlControls = {
    scenario: scenarioPresetSelect,
    wxmin: wallInputs.xMin, wxmax: wallInputs.xMax, wymin: wallInputs.yMin, wymax: wallInputs.yMax, wzmin: wallInputs.zMin, wzmax: wallInputs.zMax,
    drop: elementSelects.drop, base: elementSelects.base,
    dropt: tempInputs.drop, baset: tempInputs.base,
    iceh: heightInputs.ice, ironh: heightInputs.iron,
    boxx: boxInputs.x, boxy: boxInputs.y, boxz: boxInputs.z,
    dropn: countInputs.drop, basen: countInputs.base,
    mech: mechanicsModeSelect,
    lawmech: lawInputs.mechanics,
    lawg: lawInputs.gravity,
    laweos: lawInputs.eos,
    lawp: lawInputs.pressure,
    lawt: lawInputs.thermal,
    lawr: lawInputs.reactions,
    lawv: lawInputs.viscosity,
    lawst: lawInputs.surfaceTension,
    blob: blobInput,
    bg: backgroundColorInput,
    bgimg: backgroundImageSelect
  };
  function urlValueForControl(el) {
    return el?.type === 'checkbox' ? (el.checked ? '1' : '0') : el.value;
  }
  function applyUrlValueToControl(key, el, value) {
    if (el?.type === 'checkbox') {
      el.checked = !['0', 'false', 'off', 'no'].includes(String(value).toLowerCase());
      return;
    }
    const previous = el.value;
    el.value = normalizeUrlControlValue(key, value);
    // A select with no matching option collapses to '', which downstream
    // consumers treat as a real (empty) material/mode and hang or fail
    // silently. Unknown URL values keep the control's default instead.
    if (el.tagName === 'SELECT' && el.value === '' && previous !== '') {
      el.value = previous;
    }
  }
  function applyUrlToControls() {
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const requestedPreset = sphPhaseScenarioPresetById(hash.get('scenario') ?? query.get('scenario'));
    if (requestedPreset) {
      scenarioPresetSelect.value = requestedPreset.id;
      for (const [key, value] of Object.entries(requestedPreset.controls)) {
        const el = urlControls[key];
        if (el) applyUrlValueToControl(key, el, value);
      }
    }
    for (const [key, el] of Object.entries(urlControls)) {
      const v = hash.get(key) ?? query.get(key);
      if (v != null && v !== '') applyUrlValueToControl(key, el, v);
    }
    if (requestedPreset) {
      const presetDiffers = Object.entries(requestedPreset.controls).some(([key, expected]) => {
        const explicitValue = hash.get(key) ?? query.get(key);
        const control = urlControls[key];
        if (explicitValue == null || explicitValue === '' || !control) return false;
        return urlValueForControl(control) !== String(expected);
      });
      if (presetDiffers) scenarioPresetSelect.value = 'custom';
    }
  }
  const initialQuery = new URLSearchParams(window.location.search);
  const initialHash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  // The mechanics select only receives the URL value at applyUrlToControls()
  // (just before the first build) - init-time policy decisions that key on
  // the integrator must read the URL directly or they see the default.
  const initialMechanicsMode = (() => {
    const raw = String(initialHash.get('mech') ?? initialQuery.get('mech') ?? '').trim().toLowerCase();
    return MECHANICS_MODE_OPTIONS.some(([value]) => value === raw) ? raw : MECHANICS_MODE_DEFAULT;
  })();
  const preserveDrawingBufferForCapture = ['1', 'true', 'yes'].includes(
    String(initialHash.get('visualCapture') ?? initialQuery.get('visualCapture') ?? '').toLowerCase()
  );
  const initialResidentAutoParam = String(
    initialHash.get('residentAuto')
      ?? initialQuery.get('residentAuto')
      ?? '1'
  ).toLowerCase();
  const initialResidentAutoEnabled = !['0', 'false', 'off', 'no', 'manual'].includes(initialResidentAutoParam);
  function booleanUrlParam(value, fallback = false) {
    if (value == null || value === '') return fallback;
    return !['0', 'false', 'off', 'no', 'manual'].includes(String(value).toLowerCase());
  }
  function positiveIntegerUrlParam(value) {
    if (value == null || value === '') return null;
    const number = Math.round(Number(value));
    return Number.isFinite(number) && number > 0 ? number : null;
  }
  function nonNegativeIntegerUrlParam(value) {
    if (value == null || value === '') return null;
    const number = Math.round(Number(value));
    return Number.isFinite(number) && number >= 0 ? number : null;
  }
  function positiveNumberUrlParam(value) {
    if (value == null || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : null;
  }
  const initialResidentWorkersEnabled = booleanUrlParam(
    initialHash.get('residentWorkers') ?? initialQuery.get('residentWorkers'),
    true
  );
  const initialResidentStageWorkersEnabled = booleanUrlParam(
    initialHash.get('residentStageWorkers') ?? initialQuery.get('residentStageWorkers'),
    false
  );
  const initialResidentActiveGridEnabled = booleanUrlParam(
    initialHash.get('residentActiveGrid') ?? initialQuery.get('residentActiveGrid'),
    false
  );
  const initialResidentFuseSequenceEnabled = initialResidentActiveGridEnabled || booleanUrlParam(
    initialHash.get('residentFuseSequence') ?? initialQuery.get('residentFuseSequence'),
    true
  );
  const initialResidentActiveGridSafetyCells = positiveIntegerUrlParam(
    initialHash.get('residentActiveGridSafety') ?? initialQuery.get('residentActiveGridSafety')
  );
  const initialResidentQueueFenceEnabled = booleanUrlParam(
    initialHash.get('residentQueueFence')
      ?? initialQuery.get('residentQueueFence')
      ?? initialHash.get('residentMeasureQueueFence')
      ?? initialQuery.get('residentMeasureQueueFence')
      ?? initialHash.get('residentGpuQueueFence')
      ?? initialQuery.get('residentGpuQueueFence'),
    false
  );
  const initialContactBinMetadataReadbackEnabled = booleanUrlParam(
    initialHash.get('contactBinMetadataReadback')
      ?? initialQuery.get('contactBinMetadataReadback')
      ?? initialHash.get('pressureInterfaceContactBinMetadataReadback')
      ?? initialQuery.get('pressureInterfaceContactBinMetadataReadback')
      ?? initialHash.get('contactKinematicsParticleBinMetadataReadback')
      ?? initialQuery.get('contactKinematicsParticleBinMetadataReadback'),
    false
  );
  const initialReactionBinMetadataReadbackEnabled = booleanUrlParam(
    initialHash.get('reactionBinMetadataReadback')
      ?? initialQuery.get('reactionBinMetadataReadback')
      ?? initialHash.get('reactionParticleBinMetadataReadback')
      ?? initialQuery.get('reactionParticleBinMetadataReadback'),
    false
  );
  const initialGridCflFactor = (() => {
    const value = Number(initialHash.get('cfl') ?? initialQuery.get('cfl'));
    return Number.isFinite(value) && value > 0 && value <= 2 ? value : null;
  })();
  const initialCflSafety = (() => {
    const value = Number(initialHash.get('cflSafety') ?? initialQuery.get('cflSafety'));
    return Number.isFinite(value) && value > 0 && value <= 2 ? value : null;
  })();
  const initialSimDtS = (() => {
    const value = Number(initialHash.get('sdt') ?? initialQuery.get('sdt'));
    return Number.isFinite(value) && value > 0 && value <= 0.01 ? value : null;
  })();
  const numericUrlOption = (key, { min = 0, max = 10 } = {}) => {
    const raw = initialHash.get(key) ?? initialQuery.get(key);
    // Absent params must stay null: Number(null) is 0, which silently
    // overrode tuned defaults (avAlpha/diffAlpha/wallAlpha) with 0.
    if (raw == null || raw === '') return null;
    const value = Number(raw);
    return Number.isFinite(value) && value >= min && value <= max ? value : null;
  };
  const initialArtificialViscosityAlpha = numericUrlOption('avAlpha');
  const initialHydrostaticInitialization = (() => {
    const raw = initialHash.get('hydroInit') ?? initialQuery.get('hydroInit');
    if (raw == null || raw === '') return null;
    return raw !== '0' && raw !== 'false';
  })();
  const initialLiquidVelocityDiffusionAlpha = numericUrlOption('diffAlpha');
  const initialLiquidWallDampingAlpha = numericUrlOption('wallAlpha');
  const initialParticleSeparationRelaxation = numericUrlOption('sep');
  const peerSchroederSimulationPolicy =
    currentResidentAuthorityHostForScene()?.schroederSimulationPolicy
    || runtime?.peercomputeSchroederSimulationPolicy
    || runtime?.schroederSimulationPolicy
    || null;
  function initialUrlParamValue(keys = []) {
    for (const key of keys) {
      const value = initialHash.get(key) ?? initialQuery.get(key);
      if (value != null && value !== '') return value;
    }
    return null;
  }
  function policyParamValue(policy, keys = []) {
    if (!policy || typeof policy !== 'object') return null;
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(policy, key)) return policy[key];
    }
    return null;
  }
  function initialUrlOrSchroederPolicyValue(urlKeys = [], policyKeys = urlKeys) {
    const urlValue = initialUrlParamValue(urlKeys);
    if (urlValue != null) return urlValue;
    return policyParamValue(peerSchroederSimulationPolicy, policyKeys);
  }
  function optionalStringParam(value) {
    if (value == null) return null;
    const text = String(value).trim();
    return text ? text : null;
  }
  const initialSchroederSimulationEnabled = booleanUrlParam(
    initialUrlOrSchroederPolicyValue(
      ['schroederSimulation', 'schroeder', 'ss'],
      ['enabled', 'schroederSimulation', 'sameLevelSimulation']
    ),
    false
  );
  const initialSchroederSelectedLevel = nonNegativeIntegerUrlParam(
    initialUrlOrSchroederPolicyValue(
      ['schroederSelectedLevel', 'schroederLevel', 'ssLevel'],
      ['selectedLevel', 'level', 'schroederSelectedLevel']
    )
  ) ?? 0;
  const initialSchroederBaseGridSpacingM = positiveNumberUrlParam(
    initialUrlOrSchroederPolicyValue(
      ['schroederBaseGridSpacingM', 'schroederBaseGridSpacing'],
      ['baseGridSpacingM', 'baseGridSpacing', 'schroederBaseGridSpacingM']
    )
  );
  const initialSchroederMinLevel = nonNegativeIntegerUrlParam(
    initialUrlOrSchroederPolicyValue(
      ['schroederMinLevel', 'ssMinLevel'],
      ['minLevel', 'schroederMinLevel']
    )
  );
  const initialSchroederMaxLevel = nonNegativeIntegerUrlParam(
    initialUrlOrSchroederPolicyValue(
      ['schroederMaxLevel', 'ssMaxLevel'],
      ['maxLevel', 'schroederMaxLevel']
    )
  );
  const initialSchroederTileCellCount = positiveIntegerUrlParam(
    initialUrlOrSchroederPolicyValue(
      ['schroederTileCellCount', 'schroederTile'],
      ['tileCellCount', 'tileCellCountPerEdge', 'schroederTileCellCount']
    )
  );
  const initialSchroederPortableSummaryEnabled = booleanUrlParam(
    initialUrlOrSchroederPolicyValue(
      ['schroederPortableSummary', 'ssPortableSummary'],
      ['enablePortableSummary', 'portableSummary', 'schroederEnablePortableSummary']
    ),
    initialSchroederSimulationEnabled
  );
  const initialSchroederActiveNodeIndexEnabled = booleanUrlParam(
    initialUrlOrSchroederPolicyValue(
      ['schroederActiveNodeIndex', 'ssIndex'],
      ['enableActiveNodeIndex', 'activeNodeIndex', 'schroederEnableActiveNodeIndex']
    ),
    initialSchroederSimulationEnabled
  );
  const initialSchroederActiveNodeSortedIndexEnabled = booleanUrlParam(
    initialUrlOrSchroederPolicyValue(
      ['schroederActiveNodeSortedIndex', 'ssSortedIndex'],
      ['enableActiveNodeSortedIndex', 'activeNodeSortedIndex', 'schroederEnableActiveNodeSortedIndex']
    ),
    false
  );
  const initialSchroederCrossLevelCouplingEnabled = booleanUrlParam(
    initialUrlOrSchroederPolicyValue(
      ['schroederCrossLevelCoupling'],
      ['enableCrossLevelCoupling', 'crossLevelCoupling', 'schroederEnableCrossLevelCoupling']
    ),
    true
  );
  const initialSchroederLawQueueEnabled = booleanUrlParam(
    initialUrlOrSchroederPolicyValue(
      ['schroederLawQueue'],
      ['enableLawQueue', 'lawQueue', 'schroederEnableLawQueue']
    ),
    true
  );
  const initialSchroederLawNeighborCandidatesEnabled = booleanUrlParam(
    initialUrlOrSchroederPolicyValue(
      ['schroederLawNeighborCandidates', 'schroederLawNeighbors'],
      ['enableLawNeighborCandidates', 'lawNeighborCandidates', 'schroederEnableLawNeighborCandidates']
    ),
    true
  );
  const initialSchroederTwoLevelMechanicsEnabled = booleanUrlParam(
    initialUrlOrSchroederPolicyValue(
      ['schroederTwoLevel', 'ssTwoLevel'],
      ['enableTwoLevelMechanics', 'schroederEnableTwoLevelMechanics', 'twoLevelMechanics']
    ),
    false
  );
  const initialSchroederTwoLevelMechanicsAuthority = (() => {
    const raw = String(initialUrlOrSchroederPolicyValue(
      ['schroederTwoLevelAuthority'],
      ['twoLevelMechanicsAuthority', 'schroederTwoLevelMechanicsAuthority']
    ) || 'observation').trim().toLowerCase();
    return raw === 'authoritative' ? 'authoritative' : 'observation';
  })();
  const initialSchroederTwoLevelFineSubstepCount = positiveIntegerUrlParam(
    initialUrlOrSchroederPolicyValue(
      ['schroederTwoLevelSubsteps'],
      ['twoLevelFineSubstepCount', 'schroederTwoLevelFineSubstepCount']
    )
  ) || 1;
  const initialSchroederParticleStorageMaterializationEnabled = booleanUrlParam(
    initialUrlOrSchroederPolicyValue(
      ['schroederParticleStorageMaterialization', 'ssParticleStorageMaterialization'],
      [
        'enableParticleStorageMaterialization',
        'schroederEnableParticleStorageMaterialization',
        'particleStorageMaterialization',
        'enableParticleStorageAdoption'
      ]
    ),
    false
  );
  const initialSchroederParticleStorageAdmissionRowBudget = positiveIntegerUrlParam(
    initialUrlOrSchroederPolicyValue(
      ['schroederParticleStorageRowBudget', 'schroederParticleStorageAdmissionRowBudget'],
      ['particleStorageAdmissionRowBudget', 'schroederParticleStorageAdmissionRowBudget']
    )
  );
  const initialSchroederParticleStorageRequiredCapacity = positiveIntegerUrlParam(
    initialUrlOrSchroederPolicyValue(
      ['schroederParticleStorageRequiredCapacity'],
      ['particleStorageRequiredCapacity', 'schroederParticleStorageRequiredCapacity']
    )
  );
  const initialSchroederParticleStorageCapacityMargin = positiveIntegerUrlParam(
    initialUrlOrSchroederPolicyValue(
      ['schroederParticleStorageCapacityMargin'],
      ['particleStorageCapacityMargin', 'schroederParticleStorageCapacityMargin']
    )
  );
  const initialSchroederParticleStorageFreeListSlotCapacity = positiveIntegerUrlParam(
    initialUrlOrSchroederPolicyValue(
      ['schroederParticleStorageFreeListSlotCapacity'],
      ['particleStorageFreeListSlotCapacity', 'schroederParticleStorageFreeListSlotCapacity']
    )
  );
  const initialSchroederParticleStorageFreeListAvailableSlotCount = positiveIntegerUrlParam(
    initialUrlOrSchroederPolicyValue(
      ['schroederParticleStorageFreeListAvailableSlotCount'],
      ['particleStorageFreeListAvailableSlotCount', 'schroederParticleStorageFreeListAvailableSlotCount']
    )
  );
  const initialSchroederParticleStorageFreeListMaxSlotsPerRow = positiveIntegerUrlParam(
    initialUrlOrSchroederPolicyValue(
      ['schroederParticleStorageFreeListMaxSlotsPerRow'],
      ['particleStorageFreeListMaxSlotsPerRow', 'schroederParticleStorageFreeListMaxSlotsPerRow']
    )
  );
  const initialSchroederActiveNodeSortedIndexPolicyMode = optionalStringParam(
    initialUrlOrSchroederPolicyValue(
      ['schroederActiveNodeSortedIndexPolicy'],
      ['activeNodeSortedIndexPolicyMode', 'schroederActiveNodeSortedIndexPolicyMode']
    )
  );
  const initialSchroederLawNeighborTraversalPolicyMode = optionalStringParam(
    initialUrlOrSchroederPolicyValue(
      ['schroederLawNeighborTraversal', 'schroederTraversal'],
      ['lawNeighborTraversalPolicyMode', 'schroederLawNeighborTraversalPolicyMode']
    )
  );
  const initialSchroederLawNeighborCandidateReadbackMode = optionalStringParam(
    initialUrlOrSchroederPolicyValue(
      ['schroederLawNeighborCandidateReadback'],
      ['lawNeighborCandidateReadbackMode', 'schroederLawNeighborCandidateReadbackMode']
    )
  );
  const initialSchroederPortableSummaryPeerComputeUseCase =
    optionalStringParam(
      initialUrlOrSchroederPolicyValue(
        ['schroederUseCase'],
        ['portableSummaryPeerComputeUseCase', 'useCase', 'peerComputeUseCase']
      )
    ) || 'scene-native-schroeder-render-lod';
  const initialSchroederSimulationConfig = Object.freeze({
    schema: 'peercompute.ulg.sph-demo-schroeder-simulation-config.v0',
    enabled: initialSchroederSimulationEnabled,
    selectedLevel: initialSchroederSelectedLevel,
    baseGridSpacingM: initialSchroederBaseGridSpacingM,
    minLevel: initialSchroederMinLevel,
    maxLevel: initialSchroederMaxLevel,
    tileCellCount: initialSchroederTileCellCount,
    enablePortableSummary: initialSchroederPortableSummaryEnabled,
    portableSummaryPeerComputeUseCase: initialSchroederPortableSummaryPeerComputeUseCase,
    enableActiveNodeIndex: initialSchroederActiveNodeIndexEnabled,
    enableActiveNodeSortedIndex: initialSchroederActiveNodeSortedIndexEnabled,
    activeNodeSortedIndexPolicyMode: initialSchroederActiveNodeSortedIndexPolicyMode,
    lawNeighborTraversalPolicyMode: initialSchroederLawNeighborTraversalPolicyMode,
    lawNeighborCandidateReadbackMode: initialSchroederLawNeighborCandidateReadbackMode,
    enableCrossLevelCoupling: initialSchroederCrossLevelCouplingEnabled,
    enableLawQueue: initialSchroederLawQueueEnabled,
    enableLawNeighborCandidates: initialSchroederLawNeighborCandidatesEnabled,
    enableTwoLevelMechanics: initialSchroederTwoLevelMechanicsEnabled,
    twoLevelMechanicsAuthority: initialSchroederTwoLevelMechanicsAuthority,
    twoLevelFineSubstepCount: initialSchroederTwoLevelFineSubstepCount,
    enableParticleStorageMaterialization: initialSchroederParticleStorageMaterializationEnabled,
    particleStorageAdmissionRowBudget: initialSchroederParticleStorageAdmissionRowBudget,
    particleStorageRequiredCapacity: initialSchroederParticleStorageRequiredCapacity,
    particleStorageCapacityMargin: initialSchroederParticleStorageCapacityMargin,
    particleStorageFreeListSlotCapacity: initialSchroederParticleStorageFreeListSlotCapacity,
    particleStorageFreeListAvailableSlotCount: initialSchroederParticleStorageFreeListAvailableSlotCount,
    particleStorageFreeListMaxSlotsPerRow: initialSchroederParticleStorageFreeListMaxSlotsPerRow,
    source: initialUrlParamValue(['schroederSimulation', 'schroeder', 'ss']) != null
      ? 'url'
      : (peerSchroederSimulationPolicy ? 'peercompute-policy' : 'default')
  });
  overlay.__sphSchroederSimulationConfig = initialSchroederSimulationConfig;
  function residentExecutionPolicyFromUrl() {
    return {
      schema: 'peercompute.ulg.sph-demo-resident-execution-policy.v0',
      residentWorkersEnabled: initialResidentWorkersEnabled,
      residentStageWorkersEnabled: initialResidentStageWorkersEnabled,
      fuseNoFullResidentMechanicsSequence: initialResidentFuseSequenceEnabled,
      fuseNoFullResidentMechanicsActiveGrid: initialResidentActiveGridEnabled,
      activeGridSafetyCells: initialResidentActiveGridSafetyCells,
      measureFusedSequenceQueueFence: initialResidentQueueFenceEnabled,
      contactKinematicsParticleBinMetadataReadback:
        initialContactBinMetadataReadbackEnabled,
      reactionParticleBinMetadataReadback:
        initialReactionBinMetadataReadbackEnabled
    };
  }
  function schroederResidentExecutionOptionsFromConfig(
    config = initialSchroederSimulationConfig
  ) {
    if (!config?.enabled) return { schroederSimulation: false };
    return {
      schroederSimulation: true,
      schroederSelectedLevel: config.selectedLevel,
      schroederBaseGridSpacingM: config.baseGridSpacingM,
      schroederMinLevel: config.minLevel,
      schroederMaxLevel: config.maxLevel,
      schroederTileCellCount: config.tileCellCount,
      schroederEnablePortableSummary: config.enablePortableSummary,
      schroederPortableSummaryPeerComputeUseCase: config.portableSummaryPeerComputeUseCase,
      schroederEnableActiveNodeIndex: config.enableActiveNodeIndex,
      schroederEnableActiveNodeSortedIndex: config.enableActiveNodeSortedIndex,
      schroederActiveNodeSortedIndexPolicyMode: config.activeNodeSortedIndexPolicyMode,
      schroederLawNeighborTraversalPolicyMode: config.lawNeighborTraversalPolicyMode,
      schroederLawNeighborCandidateReadbackMode: config.lawNeighborCandidateReadbackMode,
      schroederEnableCrossLevelCoupling: config.enableCrossLevelCoupling,
      schroederEnableLawQueue: config.enableLawQueue,
      schroederEnableLawNeighborCandidates: config.enableLawNeighborCandidates,
      schroederEnableTwoLevelMechanics: config.enableTwoLevelMechanics,
      schroederTwoLevelMechanicsAuthority: config.twoLevelMechanicsAuthority,
      schroederTwoLevelFineSubstepCount: config.twoLevelFineSubstepCount,
      schroederEnableParticleStorageMaterialization: config.enableParticleStorageMaterialization,
      schroederParticleStorageAdmissionRowBudget: config.particleStorageAdmissionRowBudget,
      schroederParticleStorageRequiredCapacity: config.particleStorageRequiredCapacity,
      schroederParticleStorageCapacityMargin: config.particleStorageCapacityMargin,
      schroederParticleStorageFreeListSlotCapacity: config.particleStorageFreeListSlotCapacity,
      schroederParticleStorageFreeListAvailableSlotCount: config.particleStorageFreeListAvailableSlotCount,
      schroederParticleStorageFreeListMaxSlotsPerRow: config.particleStorageFreeListMaxSlotsPerRow
    };
  }
  const residentSurfaceDrawOverlayMode = normalizeResidentSurfaceDrawOverlayMode(
    initialHash.get('surfaceOverlay')
      ?? initialQuery.get('surfaceOverlay')
      ?? SPH_RESIDENT_SURFACE_DRAW_OVERLAY_MODE_DEFAULT
  );
  const rawResidentSurfaceDrawDiagnosticMode =
    initialHash.get('surfaceDraw')
    ?? initialQuery.get('surfaceDraw')
    ?? initialHash.get('surfaceDrawDiagnostic')
    ?? initialQuery.get('surfaceDrawDiagnostic');
  // No-overlay policy: an unset or 'auto' surface-draw mode resolves to the
  // native WebGPU surface consumer whenever WebGPU exists. The legacy CPU
  // MarchingCubes overlay path and the particle diagnostics stay reachable
  // only by explicit mode selection (URL or render-mode menu).
  const surfaceDrawNativeAutoResolve = Boolean(globalThis?.navigator?.gpu);
  const resolvedResidentSurfaceDrawDiagnosticMode = (() => {
    const normalized = String(rawResidentSurfaceDrawDiagnosticMode ?? '').trim().toLowerCase();
    // The native surface consumer presents RESIDENT surface-draw buffers;
    // the CPU reference carrier (mech=sph) never produces them, and every
    // bridge mode skips the CPU surface geometry that carrier relies on -
    // auto-resolving it to a bridge mode leaves the scene blank.
    if (
      surfaceDrawNativeAutoResolve
      && (normalized === '' || normalized === 'auto')
      && initialMechanicsMode !== 'sph'
    ) {
      return 'native-webgpu-surface-consumer';
    }
    // three-webgpu-surface-buffers never presents (its render plan coerces to
    // the no-overlay resident handoff), so a user request for a visible
    // surface routes to the native consumer instead of a blank canvas.
    if (surfaceDrawNativeAutoResolve && normalized === 'three-webgpu-surface-buffers') {
      return 'native-webgpu-surface-consumer';
    }
    return rawResidentSurfaceDrawDiagnosticMode;
  })();
  const nativeSurfaceDrawRequested =
    String(resolvedResidentSurfaceDrawDiagnosticMode || '').trim().toLowerCase()
    === 'native-webgpu-surface-consumer';
  const rawRendererBackend =
    initialHash.get('renderer')
    ?? initialQuery.get('renderer')
    ?? initialHash.get('sphRenderer')
    ?? initialQuery.get('sphRenderer')
    ?? initialHash.get('threeRenderer')
    ?? initialQuery.get('threeRenderer');
  const initialSphRendererBackend = normalizeSphRendererBackend(
    rawRendererBackend ?? (nativeSurfaceDrawRequested ? 'native-webgpu' : 'webgl')
  );
  const initialThreeWebGpuRendererPresentationEnabled = booleanUrlParam(
    initialHash.get('rendererPresentation')
      ?? initialQuery.get('rendererPresentation')
      ?? initialHash.get('threeWebGpuPresentation')
      ?? initialQuery.get('threeWebGpuPresentation')
      ?? initialHash.get('webgpuPresentation')
      ?? initialQuery.get('webgpuPresentation'),
    false
  );
  const initialThreeWebGpuRendererResidentDeviceEnabled = booleanUrlParam(
    initialHash.get('rendererResidentDevice')
      ?? initialQuery.get('rendererResidentDevice')
      ?? initialHash.get('rendererWebGpuResidentDevice')
      ?? initialQuery.get('rendererWebGpuResidentDevice')
      ?? initialHash.get('threeWebGpuResidentDevice')
      ?? initialQuery.get('threeWebGpuResidentDevice')
      ?? initialHash.get('webgpuResidentDevice')
      ?? initialQuery.get('webgpuResidentDevice'),
    false
  );
  const initialThreeWebGpuRendererPresentationUnsafe = booleanUrlParam(
    initialHash.get('rendererPresentationUnsafe')
      ?? initialQuery.get('rendererPresentationUnsafe')
      ?? initialHash.get('threeWebGpuPresentationUnsafe')
      ?? initialQuery.get('threeWebGpuPresentationUnsafe')
      ?? initialHash.get('unsafeRendererPresentation')
      ?? initialQuery.get('unsafeRendererPresentation'),
    false
  );
  const initialThreeWebGpuSurfaceBufferPresentationEnabled = booleanUrlParam(
    initialHash.get('surfaceBufferPresentation')
      ?? initialQuery.get('surfaceBufferPresentation')
      ?? initialHash.get('rendererSurfaceBufferPresentation')
      ?? initialQuery.get('rendererSurfaceBufferPresentation')
      ?? initialHash.get('threeWebGpuSurfaceBufferPresentation')
      ?? initialQuery.get('threeWebGpuSurfaceBufferPresentation')
      ?? initialHash.get('externalBufferPresentation')
      ?? initialQuery.get('externalBufferPresentation'),
    false
  );
  const nativeSurfacePixelValidationEnabled = booleanUrlParam(
    initialHash.get('nativeSurfacePixelValidation')
      ?? initialQuery.get('nativeSurfacePixelValidation')
      ?? initialHash.get('nativeWebGpuSurfacePixelValidation')
      ?? initialQuery.get('nativeWebGpuSurfacePixelValidation')
      ?? initialHash.get('surfacePixelValidation')
      ?? initialQuery.get('surfacePixelValidation'),
    false
  );
  const rawRenderOwnershipMode =
    initialHash.get('renderOwnership')
    ?? initialQuery.get('renderOwnership')
    ?? initialHash.get('renderOwner')
    ?? initialQuery.get('renderOwner')
    ?? initialHash.get('peercomputeRenderOwnership')
    ?? initialQuery.get('peercomputeRenderOwnership')
    ?? initialHash.get('rendererOwnership')
    ?? initialQuery.get('rendererOwnership');
  const rawRenderOwnershipModeExplicitNonAuto = Boolean(
    rawRenderOwnershipMode != null
    && String(rawRenderOwnershipMode).trim().toLowerCase() !== 'auto'
  );
  const rawRenderOwnershipUseCase =
    initialHash.get('renderUseCase')
    ?? initialQuery.get('renderUseCase')
    ?? initialHash.get('peercomputeRenderUseCase')
    ?? initialQuery.get('peercomputeRenderUseCase')
    ?? null;
  const renderOwnershipUseCase = rawRenderOwnershipUseCase
    ?? (rawRenderOwnershipModeExplicitNonAuto ? null : DEFAULT_INTERACTIVE_RENDER_OWNERSHIP_USE_CASE);
  const rawWorkerOffscreenPresentationParam =
    initialHash.get('workerOffscreenPresentation')
    ?? initialQuery.get('workerOffscreenPresentation')
    ?? initialHash.get('offscreenPresentation')
    ?? initialQuery.get('offscreenPresentation')
    ?? initialHash.get('workerCanvas')
    ?? initialQuery.get('workerCanvas');
  const directWorkerOffscreenPresentationEnabled = booleanUrlParam(
    rawWorkerOffscreenPresentationParam,
    false
  );
  const workerOffscreenPresentationExplicitlyDisabled = Boolean(
    rawWorkerOffscreenPresentationParam != null
    && !directWorkerOffscreenPresentationEnabled
  );
  const presentationWorkerResidentStagesRequested = booleanUrlParam(
    initialHash.get('presentationWorkerResidentStages')
      ?? initialQuery.get('presentationWorkerResidentStages')
      ?? initialHash.get('workerOffscreenResidentStages')
      ?? initialQuery.get('workerOffscreenResidentStages')
      ?? initialHash.get('workerResidentStages')
      ?? initialQuery.get('workerResidentStages')
      ?? initialHash.get('residentStageChainOnPresentationWorker')
      ?? initialQuery.get('residentStageChainOnPresentationWorker'),
    false
  );
  const retainedCompactSnapshotExportRequested = booleanUrlParam(
    initialHash.get('retainedCompactSnapshotExport')
      ?? initialQuery.get('retainedCompactSnapshotExport')
      ?? initialHash.get('retainedCompactSnapshot')
      ?? initialQuery.get('retainedCompactSnapshot')
      ?? initialHash.get('presentationWorkerRetainedCompactSnapshotExport')
      ?? initialQuery.get('presentationWorkerRetainedCompactSnapshotExport')
      ?? initialHash.get('portableSnapshotExport')
      ?? initialQuery.get('portableSnapshotExport')
      ?? initialHash.get('crossPeerSnapshotExport')
      ?? initialQuery.get('crossPeerSnapshotExport'),
    false
  );
  const residentStepsPerScheduleOverride = positiveIntegerUrlParam(
    initialHash.get('residentStepsPerSchedule')
      ?? initialQuery.get('residentStepsPerSchedule')
      ?? initialHash.get('residentStepBatch')
      ?? initialQuery.get('residentStepBatch')
      ?? initialHash.get('residentVisualSteps')
      ?? initialQuery.get('residentVisualSteps')
      ?? initialHash.get('presentationStepsPerSchedule')
      ?? initialQuery.get('presentationStepsPerSchedule')
  );
  const residentStepsPerScheduleMax = positiveIntegerUrlParam(
    initialHash.get('residentStepsPerScheduleMax')
      ?? initialQuery.get('residentStepsPerScheduleMax')
      ?? initialHash.get('residentMaxStepsPerSchedule')
      ?? initialQuery.get('residentMaxStepsPerSchedule')
      ?? initialHash.get('residentVisualStepsMax')
      ?? initialQuery.get('residentVisualStepsMax')
      ?? initialHash.get('presentationStepsPerScheduleMax')
      ?? initialQuery.get('presentationStepsPerScheduleMax')
  );
  const residentParticleBridgeTargetBatchTimeS = positiveNumberUrlParam(
    initialHash.get('residentParticleBridgeTargetBatchTimeS')
      ?? initialQuery.get('residentParticleBridgeTargetBatchTimeS')
      ?? initialHash.get('residentVisualTargetBatchTimeS')
      ?? initialQuery.get('residentVisualTargetBatchTimeS')
      ?? initialHash.get('presentationTargetBatchTimeS')
      ?? initialQuery.get('presentationTargetBatchTimeS')
  );
  const residentInterfaceRefreshMode = (
    initialHash.get('residentInterfaceRefreshMode')
    ?? initialQuery.get('residentInterfaceRefreshMode')
    ?? initialHash.get('residentInterfaceRefresh')
    ?? initialQuery.get('residentInterfaceRefresh')
    ?? initialHash.get('residentPostStepInterfaceRefresh')
    ?? initialQuery.get('residentPostStepInterfaceRefresh')
    ?? null
  );
  const residentInterfaceRefreshWarmupFrames = nonNegativeIntegerUrlParam(
    initialHash.get('residentInterfaceRefreshWarmupFrames')
      ?? initialQuery.get('residentInterfaceRefreshWarmupFrames')
      ?? initialHash.get('residentInterfaceWarmupFrames')
      ?? initialQuery.get('residentInterfaceWarmupFrames')
  );
  const residentComputeManagerMode = (
    initialHash.get('residentComputeManagerMode')
    ?? initialQuery.get('residentComputeManagerMode')
    ?? initialHash.get('residentPlaybackComputeManagerMode')
    ?? initialQuery.get('residentPlaybackComputeManagerMode')
    ?? initialHash.get('residentPlaybackComputeMode')
    ?? initialQuery.get('residentPlaybackComputeMode')
    ?? initialHash.get('residentComputeMode')
    ?? initialQuery.get('residentComputeMode')
    ?? null
  );
  const urlMaterialInterfaceMaxFieldCells = positiveIntegerUrlParam(
    initialHash.get('materialInterfaceMaxFieldCells')
      ?? initialQuery.get('materialInterfaceMaxFieldCells')
      ?? initialHash.get('materialInterfaceFieldCells')
      ?? initialQuery.get('materialInterfaceFieldCells')
      ?? initialHash.get('miCells')
      ?? initialQuery.get('miCells')
  );
  const urlMaterialInterfaceMaxResolution = positiveIntegerUrlParam(
    initialHash.get('materialInterfaceMaxResolution')
      ?? initialQuery.get('materialInterfaceMaxResolution')
      ?? initialHash.get('materialInterfaceResolution')
      ?? initialQuery.get('materialInterfaceResolution')
      ?? initialHash.get('miRes')
      ?? initialQuery.get('miRes')
  );
  const peerMaterialInterfaceSurfaceTablePolicy =
    currentResidentAuthorityHostForScene()?.materialInterfaceSurfaceTablePolicy
    || runtime?.peercomputeMaterialInterfaceSurfaceTablePolicy
    || runtime?.materialInterfaceSurfaceTablePolicy
    || null;
  const initialMaterialInterfaceSurfaceTablePolicy = (
    peerMaterialInterfaceSurfaceTablePolicy
    || urlMaterialInterfaceMaxFieldCells
    || urlMaterialInterfaceMaxResolution
  )
    ? {
      ...(peerMaterialInterfaceSurfaceTablePolicy || {}),
      source: (urlMaterialInterfaceMaxFieldCells || urlMaterialInterfaceMaxResolution)
        ? 'url-material-interface-surface-table-policy'
        : (peerMaterialInterfaceSurfaceTablePolicy?.source || 'peercompute-material-interface-surface-table-policy'),
      maxFieldCells:
        urlMaterialInterfaceMaxFieldCells
        ?? peerMaterialInterfaceSurfaceTablePolicy?.maxFieldCells
        ?? peerMaterialInterfaceSurfaceTablePolicy?.materialInterfaceMaxFieldCells
        ?? null,
      maxResolution:
        urlMaterialInterfaceMaxResolution
        ?? peerMaterialInterfaceSurfaceTablePolicy?.maxResolution
        ?? peerMaterialInterfaceSurfaceTablePolicy?.materialInterfaceMaxResolution
        ?? null
    }
    : null;
  const initialPeerComputeRenderOwnershipPolicy = resolvePeerComputeRenderOwnershipPolicy({
    peercomputePolicy:
      currentResidentAuthorityHostForScene()?.renderOwnershipPolicy
      || runtime?.peercomputeRenderOwnershipPolicy
      || runtime?.renderOwnershipPolicy
      || null,
    requestedMode: rawRenderOwnershipMode,
    workerOffscreenPresentationRequested: directWorkerOffscreenPresentationEnabled,
    workerOffscreenPresentationExplicitlyDisabled,
    presentationWorkerResidentStagesRequested,
    retainedCompactSnapshotExportRequested,
    residentStepsPerScheduleOverride,
    residentStepsPerScheduleMax,
    residentParticleBridgeTargetBatchTimeS,
    residentInterfaceRefreshMode,
    residentInterfaceRefreshWarmupFrames,
    residentComputeManagerMode,
    useCase: renderOwnershipUseCase,
    source: rawRenderOwnershipMode
      ? 'sph-phase-demo-url'
      : 'sph-phase-demo'
  });
  const workerOffscreenPresentationEnabled = Boolean(
    initialPeerComputeRenderOwnershipPolicy.workerOffscreenPresentationRequested
  );
  overlay.__sphPeerComputeRenderOwnershipPolicy = initialPeerComputeRenderOwnershipPolicy;
  const acquireInitialRendererWebGpuDevice = Boolean(
    initialSphRendererBackend === 'webgpu'
    && initialThreeWebGpuRendererPresentationEnabled
    && initialThreeWebGpuRendererResidentDeviceEnabled
    && THREE_WEBGPU_RENDERER_OWNED_RESIDENT_DEVICE_RUNTIME_VALIDATED
    && (
      THREE_WEBGPU_RENDERER_PRESENTATION_RUNTIME_VALIDATED
      || initialThreeWebGpuRendererPresentationUnsafe
    )
  );
  let initialRendererWebGpuDeviceResult = null;
  if (acquireInitialRendererWebGpuDevice) {
    statusEl.textContent = 'acquiring shared WebGPU resident/render device...';
    initialRendererWebGpuDeviceResult = await requestOpticalGpuDevice(globalThis.navigator).catch((error) => ({
      status: 'webgpu-error-fallback',
      reason: error instanceof Error ? error.message : String(error),
      device: null
    }));
    overlay.__sphRendererWebGpuDevicePreflight = {
      schema: 'peercompute.ulg.sph-renderer-webgpu-device-preflight.v0',
      status: initialRendererWebGpuDeviceResult?.status ?? null,
      reason: initialRendererWebGpuDeviceResult?.reason ?? null,
      appOwnedDeviceReady: Boolean(initialRendererWebGpuDeviceResult?.device),
      requiredLimits: initialRendererWebGpuDeviceResult?.requiredLimits || null,
      adapterLimits: initialRendererWebGpuDeviceResult?.adapterLimits || null,
      updatedAtMs: performance.now()
    };
  }
  // The render-row bridge modes hand presentation to the RESIDENT render
  // refresh and skip CPU surface geometry entirely; the CPU reference
  // carrier (mech=sph) never runs that path, so defaulting it to a bridge
  // mode leaves the scene blank. CPU mechanics defaults to auto (CPU
  // surfaces); explicit surfaceDraw= URL selections still override.
  const defaultThreeResidentSurfaceDrawMode = initialMechanicsMode === 'sph'
    ? 'auto'
    : (window.innerWidth < 700
      ? 'three-render-row-spheres'
      : 'three-render-row-points');
  let residentSurfaceDrawDiagnosticMode = normalizeResidentSurfaceDrawDiagnosticMode(
    resolvedResidentSurfaceDrawDiagnosticMode,
    residentSurfaceDrawOverlayMode === 'enabled' ? 'auto' : defaultThreeResidentSurfaceDrawMode
  );
  // Explicit render-mode selections (URL surfaceDraw= or the render-mode
  // menu) must override the auto render-ownership policy's worker-owned
  // presentation; a defaulted mode must not.
  let residentSurfaceDrawDiagnosticModeExplicit = rawResidentSurfaceDrawDiagnosticMode != null;
  renderModeSelect.value = residentSurfaceDrawDiagnosticMode;
  if (renderModeSelect.value !== residentSurfaceDrawDiagnosticMode) {
    renderModeSelect.value = defaultThreeResidentSurfaceDrawMode;
    residentSurfaceDrawDiagnosticMode = defaultThreeResidentSurfaceDrawMode;
  }
  function publishRenderModeSelection(status = 'render-mode-selected', extra = {}) {
    const mode = currentResidentSurfaceDrawDiagnosticMode();
    const particleRenderMode = residentSurfaceDrawParticleRenderMode(mode);
    overlay.__sphRenderModeSelection = {
      schema: 'peercompute.ulg.sph-demo-render-mode-selection.v0',
      status,
      requestedMode: mode,
      particleMode: particleRenderMode != null,
      particleRenderMode,
      variableSizeSphereMode: particleRenderMode === 'variable-size-spheres',
      requiresLivePhysicsRefresh: particleRenderMode != null,
      requiresFreshPhysicsReadback: particleRenderMode != null,
      selectedByUrl: rawResidentSurfaceDrawDiagnosticMode != null,
      updatedAtMs: performance.now(),
      ...extra
    };
    return overlay.__sphRenderModeSelection;
  }
  function currentResidentSurfaceDrawDiagnosticMode() {
    const mode = normalizeResidentSurfaceDrawDiagnosticMode(
      renderModeSelect.value,
      residentSurfaceDrawDiagnosticMode
    );
    if (renderModeSelect.value !== mode) renderModeSelect.value = mode;
    residentSurfaceDrawDiagnosticMode = mode;
    return mode;
  }
  function sphRendererBackendRequiredForRenderMode(mode) {
    return String(mode || '').trim().toLowerCase() === 'native-webgpu-surface-consumer'
      ? 'native-webgpu'
      : 'webgl';
  }
  publishRenderModeSelection('render-mode-initialized');
  const residentAutoStartEnabled = Boolean(autoStart && initialResidentAutoEnabled);
  function syncUrlFromControls() {
    const q = new URLSearchParams();
    for (const [key, el] of Object.entries(urlControls)) q.set(key, urlValueForControl(el));
    if (!initialResidentWorkersEnabled) q.set('residentWorkers', '0');
    if (initialResidentStageWorkersEnabled) q.set('residentStageWorkers', '1');
    q.set('residentFuseSequence', initialResidentFuseSequenceEnabled ? '1' : '0');
    // The renderer backend must follow an explicitly selected render mode
    // (the native surface consumer presents on the native-webgpu backend;
    // three-* modes need the WebGL renderer to rasterize scene meshes), so a
    // cross-backend mode change can reload into a working configuration.
    const urlRendererBackend = residentSurfaceDrawDiagnosticModeExplicit
      ? sphRendererBackendRequiredForRenderMode(currentResidentSurfaceDrawDiagnosticMode())
      : initialSphRendererBackend;
    if (urlRendererBackend !== 'webgl') q.set('renderer', urlRendererBackend);
    if (initialThreeWebGpuRendererPresentationEnabled) q.set('rendererPresentation', '1');
    if (initialThreeWebGpuRendererResidentDeviceEnabled) q.set('rendererResidentDevice', '1');
    if (initialThreeWebGpuRendererPresentationUnsafe) q.set('rendererPresentationUnsafe', '1');
    if (initialThreeWebGpuSurfaceBufferPresentationEnabled) q.set('surfaceBufferPresentation', '1');
    if (workerOffscreenPresentationEnabled) q.set('workerOffscreenPresentation', '1');
    if (presentationWorkerResidentStagesRequested) q.set('presentationWorkerResidentStages', '1');
    if (rawRenderOwnershipMode != null) q.set(
      'renderOwnership',
      initialPeerComputeRenderOwnershipPolicy.requestedMode
    );
    if (renderOwnershipUseCase) q.set('renderUseCase', renderOwnershipUseCase);
    if (nativeSurfacePixelValidationEnabled) q.set('nativeSurfacePixelValidation', '1');
    if (residentSurfaceDrawDiagnosticModeExplicit) {
      q.set('surfaceDraw', currentResidentSurfaceDrawDiagnosticMode());
    }
    if (initialResidentActiveGridEnabled) q.set('residentActiveGrid', '1');
    if (initialResidentActiveGridSafetyCells != null) q.set('residentActiveGridSafety', String(initialResidentActiveGridSafetyCells));
    if (initialContactBinMetadataReadbackEnabled) q.set('contactBinMetadataReadback', '1');
    if (initialReactionBinMetadataReadbackEnabled) q.set('reactionBinMetadataReadback', '1');
    if (initialSchroederSimulationEnabled) {
      q.set('ss', '1');
      q.set('schroederLevel', String(initialSchroederSelectedLevel));
      q.set('schroederPortableSummary', initialSchroederPortableSummaryEnabled ? '1' : '0');
      q.set('schroederActiveNodeIndex', initialSchroederActiveNodeIndexEnabled ? '1' : '0');
      if (initialSchroederBaseGridSpacingM != null) q.set('schroederBaseGridSpacingM', String(initialSchroederBaseGridSpacingM));
      if (initialSchroederMinLevel != null) q.set('schroederMinLevel', String(initialSchroederMinLevel));
      if (initialSchroederMaxLevel != null) q.set('schroederMaxLevel', String(initialSchroederMaxLevel));
      if (initialSchroederTileCellCount != null) q.set('schroederTileCellCount', String(initialSchroederTileCellCount));
      if (initialSchroederActiveNodeSortedIndexEnabled) q.set('schroederActiveNodeSortedIndex', '1');
      if (initialSchroederActiveNodeSortedIndexPolicyMode) {
        q.set('schroederActiveNodeSortedIndexPolicy', initialSchroederActiveNodeSortedIndexPolicyMode);
      }
      if (!initialSchroederCrossLevelCouplingEnabled) q.set('schroederCrossLevelCoupling', '0');
      if (!initialSchroederLawQueueEnabled) q.set('schroederLawQueue', '0');
      if (!initialSchroederLawNeighborCandidatesEnabled) q.set('schroederLawNeighborCandidates', '0');
      if (initialSchroederParticleStorageMaterializationEnabled) {
        q.set('schroederParticleStorageMaterialization', '1');
      }
      if (initialSchroederTwoLevelMechanicsEnabled) {
        q.set('schroederTwoLevel', '1');
        if (initialSchroederTwoLevelMechanicsAuthority !== 'observation') {
          q.set('schroederTwoLevelAuthority', initialSchroederTwoLevelMechanicsAuthority);
        }
        if (initialSchroederTwoLevelFineSubstepCount > 1) {
          q.set('schroederTwoLevelSubsteps', String(initialSchroederTwoLevelFineSubstepCount));
        }
      }
      if (initialSchroederParticleStorageAdmissionRowBudget != null) {
        q.set('schroederParticleStorageRowBudget', String(initialSchroederParticleStorageAdmissionRowBudget));
      }
      if (initialSchroederParticleStorageRequiredCapacity != null) {
        q.set('schroederParticleStorageRequiredCapacity', String(initialSchroederParticleStorageRequiredCapacity));
      }
      if (initialSchroederParticleStorageCapacityMargin != null) {
        q.set('schroederParticleStorageCapacityMargin', String(initialSchroederParticleStorageCapacityMargin));
      }
      if (initialSchroederParticleStorageFreeListSlotCapacity != null) {
        q.set('schroederParticleStorageFreeListSlotCapacity', String(initialSchroederParticleStorageFreeListSlotCapacity));
      }
      if (initialSchroederParticleStorageFreeListAvailableSlotCount != null) {
        q.set(
          'schroederParticleStorageFreeListAvailableSlotCount',
          String(initialSchroederParticleStorageFreeListAvailableSlotCount)
        );
      }
      if (initialSchroederParticleStorageFreeListMaxSlotsPerRow != null) {
        q.set('schroederParticleStorageFreeListMaxSlotsPerRow', String(initialSchroederParticleStorageFreeListMaxSlotsPerRow));
      }
      if (initialSchroederLawNeighborTraversalPolicyMode) q.set('schroederTraversal', initialSchroederLawNeighborTraversalPolicyMode);
      if (initialSchroederLawNeighborCandidateReadbackMode) {
        q.set('schroederLawNeighborCandidateReadback', initialSchroederLawNeighborCandidateReadbackMode);
      }
      q.set('schroederUseCase', initialSchroederPortableSummaryPeerComputeUseCase);
    }
    window.history.replaceState(null, '', `#${q.toString()}`);
  }
  applyUrlToControls(); // restore from the URL before the first build
  syncUrlFromControls(); // and reflect the full current state in the URL

  function boxDimensionsFromControls() {
    const dim = (input, def) => { const v = Number(input.value); return Number.isFinite(v) && v > 0 ? v : def; };
    return [dim(boxInputs.x, BOX_DIM_DEFAULTS_M.x), dim(boxInputs.y, BOX_DIM_DEFAULTS_M.y), dim(boxInputs.z, BOX_DIM_DEFAULTS_M.z)];
  }

  function scenarioFromControls() {
    const wallFaces = {};
    for (const face of WALL_FACES) wallFaces[face] = Number(wallInputs[face].value) || WALL_DEFAULT_K;
    // Scenario default drop volume is 1/8 of the base block (drop edge = half
    // the base edge). The old override pinned the drop volume EQUAL to the
    // base block, which made every drop read as implausibly huge regardless
    // of the requested particle edge (user report: "drop block size is
    // perpetually too big"). The particle-edge inputs control sampling
    // resolution within these physical blocks, not the physical size itself.
    return createSphPhaseScenario({
      wallFaces,
      boxDimensionsM: boxDimensionsFromControls()
    });
  }

  function physicalLawGroupsFromControls() {
    return Object.fromEntries(PHYSICAL_LAW_GROUPS.map(([key]) => [key, lawInputs[key]?.checked !== false]));
  }

  function mechanicsModeFromControls() {
    return MECHANICS_MODE_OPTIONS.some(([value]) => value === mechanicsModeSelect.value)
      ? mechanicsModeSelect.value
      : MECHANICS_MODE_DEFAULT;
  }

  function driverOptionsFromControls() {
    const iceBaseHeightM = Number(heightInputs.ice.value);
    const ironBaseHeightM = Number(heightInputs.iron.value);
    const dropTemperatureK = Number(tempInputs.drop.value);
    const baseTemperatureK = Number(tempInputs.base.value);
    const dropEdge = Math.round(Number(countInputs.drop.value));
    const baseEdge = Math.round(Number(countInputs.base.value));
    return {
      scenario: scenarioFromControls(),
      dropMaterial: elementSelects.drop.value,
      baseMaterial: elementSelects.base.value,
      dropTemperatureK: Number.isFinite(dropTemperatureK) ? dropTemperatureK : DROP_TEMP_DEFAULT_K,
      baseTemperatureK: Number.isFinite(baseTemperatureK) ? baseTemperatureK : BASE_TEMP_DEFAULT_K,
      iceBaseHeightM: Number.isFinite(iceBaseHeightM) ? iceBaseHeightM : ICE_BASE_DEFAULT_M,
      ironBaseHeightM: Number.isFinite(ironBaseHeightM) ? ironBaseHeightM : IRON_BASE_DEFAULT_M,
      dropParticleEdge: Number.isFinite(dropEdge) && dropEdge >= 1 ? dropEdge : DROP_PARTICLE_EDGE_DEFAULT,
      baseParticleEdge: Number.isFinite(baseEdge) && baseEdge >= 1 ? baseEdge : BASE_PARTICLE_EDGE_DEFAULT,
      mechanics: mechanicsModeFromControls(),
      physicalLawGroups: physicalLawGroupsFromControls(),
      allowReducedProductProperties: true,
      ...(initialGridCflFactor != null ? { gridCflFactor: initialGridCflFactor } : {}),
      ...(initialCflSafety != null ? { cflSafety: initialCflSafety } : {}),
      ...(initialSimDtS != null ? { dt: initialSimDtS } : {}),
      ...(initialArtificialViscosityAlpha != null
        ? { mlsMpmArtificialViscosityAlpha: initialArtificialViscosityAlpha }
        : {}),
      ...(initialLiquidVelocityDiffusionAlpha != null
        ? { mlsMpmLiquidVelocityDiffusionAlpha: initialLiquidVelocityDiffusionAlpha }
        : {}),
      ...(initialLiquidWallDampingAlpha != null
        ? { mlsMpmLiquidWallDampingAlpha: initialLiquidWallDampingAlpha }
        : {}),
      ...(initialParticleSeparationRelaxation != null
        ? { mlsMpmParticleSeparationRelaxation: initialParticleSeparationRelaxation }
        : {}),
      ...(initialHydrostaticInitialization != null
        ? { hydrostaticInitialization: initialHydrostaticInitialization }
        : {})
    };
  }

  const blobScaleOf = () => { const v = Number(blobInput.value); return Number.isFinite(v) && v > 0 ? v : BLOB_SCALE_DEFAULT; };
  const backgroundColorOf = () => normalizeSphSceneBackgroundColorHex(backgroundColorInput.value);
  let renderModeRefreshToken = 0;
  let peerClosureCacheLookup = null;
  let peerClosureCacheWrite = null;
  let peerClosureCacheConsumed = false;
  let sphColdStartCacheLookup = null;
  let sphColdStartCacheWrite = null;
  let sphStaticTableCacheRead = null;
  let sphStaticTableCacheWrite = null;
  let sphStaticTableCacheSummary = null;
  let sphCacheClearStatus = null;
  let staticTableCacheGeneration = 0;
  let staticTableCacheReadGeneration = 0;
  let staticTableCacheBundle = null;
  let staticTableCacheBundleSignature = null;
  let staticTableCacheStorageSignature = 'empty';
  const sphPerformanceTrace = {
    schema: 'peercompute.ulg.sph-cold-start-performance-trace.v0',
    spans: [],
    updatedAtMs: performance.now()
  };
  let cpuClosureTask = null;
  const frameCounters = {
    renderFrames: 0,
    physicsFrames: 0,
    residentFrames: 0,
    renderFps: 0,
    physicsFps: 0,
    residentFps: 0,
    lastSampleMs: performance.now()
  };
  let blockedError = null;
  let driver = null;
  let activeViewState = null;
  let activeViewStatePreflight = null;
  let activeViewStateTotals = null;
  let activeViewStatePhaseSummary = null;
  let activeViewStateGasPressure = null;
  let activeViewStateSource = 'main-thread-driver';
  let workerRebuildGeneration = 0;
  let activeWorkerRebuildTask = null;
  function recordPerformanceSpan(label, startMs, endMs, extra = {}) {
    const span = {
      label,
      startMs,
      endMs,
      durationMs: Math.max(0, endMs - startMs),
      ...extra
    };
    sphPerformanceTrace.spans = [
      ...sphPerformanceTrace.spans.slice(-23),
      span
    ];
    sphPerformanceTrace.updatedAtMs = endMs;
    overlay.__sphPerformanceTrace = sphPerformanceTrace;
    return span;
  }

  function publishPeerClosureCacheState() {
    overlay.__sphPeerClosureCache = {
      lookup: peerClosureCacheLookup,
      write: peerClosureCacheWrite,
      consumed: peerClosureCacheConsumed,
      coldStartLookup: sphColdStartCacheLookup,
      coldStartWrite: sphColdStartCacheWrite,
      staticTableRead: sphStaticTableCacheRead,
      staticTableWrite: sphStaticTableCacheWrite,
      staticTableSummary: sphStaticTableCacheSummary,
      clear: sphCacheClearStatus
    };
    return overlay.__sphPeerClosureCache;
  }

  function cacheMissDerivationPending() {
    const materialMisses = peerClosureCacheLookup?.missCount ?? 0;
    const reactionStatus = sphColdStartCacheLookup?.status || '';
    const coldStorage = sphColdStartCacheLookup?.storageStatus || '';
    const reactionMiss = reactionStatus === 'reaction-cache-miss'
      || reactionStatus === 'reaction-cache-unkeyed'
      || coldStorage === 'empty'
      || coldStorage === 'schema-mismatch'
      || coldStorage === 'generator-fingerprint-mismatch';
    return materialMisses > 0 || reactionMiss;
  }

  function cacheReadyForInteractiveDriver() {
    return !cpuClosureTask?.active && Boolean(
      sphColdStartCacheWrite?.status === 'stored'
      || sphColdStartCacheLookup?.status === 'reaction-cache-hit'
      || peerClosureCacheWrite?.status === 'stored'
    );
  }

  function coldStartCacheStatusText() {
    const writeCounts = sphColdStartCacheWrite?.counts || {};
    const reactionCount = writeCounts.reactions ?? sphColdStartCacheLookup?.reactionCount ?? 0;
    const productReuseCount = writeCounts.productReuse ?? sphColdStartCacheLookup?.productReuseCount ?? 0;
    const tableCount = writeCounts.tables ?? sphColdStartCacheLookup?.tableCount ?? 0;
    const gpuWarmupCount = writeCounts.gpuWarmup ?? sphColdStartCacheLookup?.gpuWarmupCount ?? 0;
    return [
      `lookup=${sphColdStartCacheLookup?.status || 'pending'}`,
      `storage=${sphColdStartCacheLookup?.storageStatus || sphColdStartCacheWrite?.status || 'pending'}`,
      `reactions=${reactionCount}`,
      `products=${productReuseCount}`,
      `tables=${tableCount}`,
      `table-read=${sphStaticTableCacheRead?.status || 'pending'}`,
      `table-status=${sphStaticTableCacheWrite?.status || 'pending'}`,
      `table-writes=${sphStaticTableCacheWrite?.tableWriteCount ?? 0}`,
      `gpu=${gpuWarmupCount}`,
      `gpu-writes=${sphStaticTableCacheWrite?.gpuWarmupWriteCount ?? 0}`
    ].join(' ');
  }

  function cacheClearStatusText() {
    if (!sphCacheClearStatus) return 'idle';
    return [
      sphCacheClearStatus.status || 'unknown',
      `materials=${sphCacheClearStatus.materialRecords ?? 0}`,
      `reactions=${sphCacheClearStatus.reactionRecords ?? 0}`,
      `products=${sphCacheClearStatus.productReuseRecords ?? 0}`,
      `tables=${sphCacheClearStatus.tableRecords ?? 0}`,
      `gpu=${sphCacheClearStatus.gpuWarmupRecords ?? 0}`
    ].join(' ');
  }

  function performanceTraceStatusText() {
    const last = sphPerformanceTrace.spans.at(-1);
    if (!last) return 'spans=0 last=none';
    return `spans=${sphPerformanceTrace.spans.length} last="${last.label}" ${fmt(last.durationMs, 1)}ms`;
  }

  function residentStageTimingStatusText(stageTiming) {
    const stageMs = stageTiming?.stageMs || {};
    if (!stageTiming?.schema) return 'pending';
    const activeGrid = stageTiming.activeGridDispatch || null;
    const activeGridText = activeGrid
      ? activeGrid.useActiveGrid
        ? `${activeGrid.activeNodeCount ?? 'unknown'}/${activeGrid.fullGridNodeCount ?? 'unknown'}`
        : (activeGrid.status || 'inactive')
      : 'n/a';
    return [
      `total=${fmt(stageTiming.totalMs, 1)}ms`,
      `fused-seq=${stageTiming.fusedResidentSequence ? stageTiming.fusedResidentSequenceStepCount ?? 'yes' : 'off'}`,
      `active-grid=${activeGridText}`,
      `device=${fmt(stageMs.deviceAcquire, 1)}ms`,
      `p2g=${fmt(stageMs.p2gGridProjection, 1)}ms`,
      `grid=${fmt(stageMs.gridUpdate, 1)}ms`,
      `g2p=${fmt(stageMs.g2pReconstruction, 1)}ms`,
      `therm=${fmt(stageMs.thermalStep, 1)}ms`,
      `react=${fmt(stageMs.reactionStep, 1)}ms`,
      `summary=${fmt(stageMs.compactSummary, 1)}ms`
    ].join(' ');
  }

  function residentExecutionPolicyStatusText(policy = null) {
    const effective = policy || residentExecutionPolicyFromUrl();
    return [
      `fuse-seq=${effective?.fuseNoFullResidentMechanicsSequence ? 'on' : 'off'}`,
      `active-grid=${effective?.fuseNoFullResidentMechanicsActiveGrid ? 'on' : 'off'}`,
      `safety=${effective?.activeGridSafetyCells ?? 'default'}`,
      `queue-fence=${effective?.measureFusedSequenceQueueFence ? 'on' : 'off'}`,
      `contact-bin=${effective?.contactKinematicsParticleBinMetadataReadback ? 'readback' : 'off'}`,
      `reaction-bin=${effective?.reactionParticleBinMetadataReadback ? 'readback' : 'off'}`
    ].join(' ');
  }

  function schroederSimulationStatusText({
    residentSteps = null,
    residentStep = null,
    residentRenderState = null,
    residentSurfaceDraw = null,
    schroederRenderSource = null,
    schroederDrawSource = null,
    schroederBackendSelection = null
  } = {}) {
    const config = initialSchroederSimulationConfig;
    const mechanics = residentSteps?.schroederSameLevelMechanics
      || residentStep?.schroederSameLevelMechanics
      || null;
    const portableSummary = residentSteps?.portableSummary
      || residentStep?.portableSummary
      || mechanics?.portableSummary
      || null;
    const renderLod = portableSummary?.renderLod
      || residentSteps?.renderLod
      || mechanics?.renderLod
      || null;
    const enabled = Boolean(
      config.enabled
      || residentSteps?.schroederSimulation
      || residentStep?.schroederSimulation
    );
    const sequenceStatus = residentSteps?.schroederSameLevelSequenceStatus
      || residentStep?.schroederSameLevelSequenceStatus
      || mechanics?.status
      || (enabled ? 'pending' : 'disabled');
    const selectedLevel = renderLod?.selectedLevel
      ?? schroederRenderSource?.selectedLevel
      ?? mechanics?.selectedLevel
      ?? residentSteps?.schroederSelectedLevel
      ?? config.selectedLevel;
    const nativeGridSpacingM = renderLod?.nativeGridSpacingM
      ?? schroederRenderSource?.nativeGridSpacingM
      ?? mechanics?.mechanicsGridSpacingM
      ?? null;
    const activeLeafProxyCount = renderLod?.activeLeafProxyCount
      ?? schroederRenderSource?.activeLeafProxyCount
      ?? schroederDrawSource?.activeLeafProxyCount
      ?? 0;
    const phaseVolumeFeedback = residentSteps?.schroederPhaseVolumeAssignmentOverlayFeedback
      || residentSteps?.phaseVolumeAssignmentOverlayFeedback
      || residentStep?.schroederPhaseVolumeAssignmentOverlayFeedback
      || residentStep?.phaseVolumeAssignmentOverlayFeedback
      || null;
    const phaseVolumeDiagnostics = residentSteps?.schroederPhaseVolumeDiagnostics
      || residentSteps?.phaseVolumeDiagnostics
      || residentStep?.schroederPhaseVolumeDiagnostics
      || residentStep?.phaseVolumeDiagnostics
      || null;
    const phaseLevelUpdateChanged = phaseVolumeDiagnostics?.phaseVolumeLevelUpdateChanged === true;
    const phaseExpansionDetected = phaseVolumeDiagnostics?.phaseVolumeExpansionDetected === true
      || phaseVolumeDiagnostics?.waterToSteamScaleMigrationObserved === true;
    const phaseMigrationStatus = phaseLevelUpdateChanged
      ? 'changed'
      : (phaseExpansionDetected
          ? 'detected'
          : (phaseVolumeDiagnostics?.phaseVolumeDiagnosticSummaryStatus
              ? 'noop'
              : (phaseVolumeFeedback?.ready ? 'pending' : 'off')));
    const phaseObservedDelta = Number(phaseVolumeDiagnostics?.observedPositiveLevelDelta);
    const phaseExpectedDelta = Number(phaseVolumeDiagnostics?.expectedLevelDeltaFromVolume);
    const phaseVolumeRatio = Number(phaseVolumeDiagnostics?.representedToRestVolumeRatio);
    const drawBatchCount = schroederDrawSource?.drawBatchCount ?? 0;
    const retainedRefCount = residentSteps?.schroederLocalRetainedRenderBuffers?.retainedBufferRefs?.length
      ?? residentSteps?.localRetainedRenderBuffers?.retainedBufferRefs?.length
      ?? residentRenderState?.surfaceDrawRenderBridgeSchroederRenderProxyLocalResolverRetainedBufferRefCount
      ?? residentSurfaceDraw?.renderBridgeSchroederRenderProxyLocalResolverRetainedBufferRefCount
      ?? 0;
    const nativeSubmitDrawCount =
      residentRenderState?.surfaceDrawRenderBridgeSchroederRenderProxyNativeLastSubmitDrawCommandCount
      ?? residentSurfaceDraw?.renderBridgeSchroederRenderProxyNativeLastSubmitDrawCommandCount
      ?? 0;
    const backendStatus = schroederBackendSelection?.status
      || residentRenderState?.surfaceDrawRenderBridgeSchroederRenderProxyBackendSelectionStatus
      || 'pending';
    return [
      `request=${enabled ? 'on' : 'off'}`,
      `source=${config.source}`,
      `status=${sequenceStatus}`,
      `level=${selectedLevel ?? 'pending'}`,
      `dx=${Number.isFinite(nativeGridSpacingM) ? fmt(nativeGridSpacingM, 4) : 'pending'}m`,
      `leaves=${activeLeafProxyCount}`,
      `phase-feedback=${phaseVolumeFeedback?.ready ? 'ready' : 'off'}`,
      `phase-feedback-rows=${phaseVolumeFeedback?.levelUpdateRowCount ?? 0}`,
      `phase-feedback-index=${phaseVolumeFeedback?.sparseOverlayIndexRequired ? 'required' : 'not-required'}`,
      `phase-migration=${phaseMigrationStatus}`,
      `phase-delta=${Number.isFinite(phaseExpectedDelta) ? fmt(phaseExpectedDelta, 2) : 'pending'}`,
      `phase-update-delta=${Number.isFinite(phaseObservedDelta) ? fmt(phaseObservedDelta, 2) : 'pending'}`,
      `phase-update=${phaseLevelUpdateChanged ? 'changed' : (phaseExpansionDetected ? 'preleveled-or-refine' : 'pending')}`,
      `phase-ratio=${Number.isFinite(phaseVolumeRatio) ? fmt(phaseVolumeRatio, 1) : 'pending'}`,
      `phase-no-full=${phaseVolumeDiagnostics?.noFullParticleReadback === true ? 'true' : 'pending'}`,
      `draw-batches=${drawBatchCount}`,
      `retained=${retainedRefCount}`,
      `native-draws=${nativeSubmitDrawCount}`,
      `backend=${backendStatus}`
    ].join(' ');
  }

  function cpuDriverStepTimingStatusText(timing) {
    const stageMs = timing?.stageMs || {};
    if (!timing?.schema) return 'pending';
    return [
      `total=${fmt(timing.totalMs, 1)}ms`,
      `mech=${fmt(stageMs.mechanics, 1)}ms`,
      `therm=${fmt(stageMs.thermal, 1)}ms`,
      `react=${fmt(stageMs.reaction, 1)}ms`,
      `walls=${fmt((stageMs.wallLedger || 0) + (stageMs.wallClamp || 0), 1)}ms`,
      `active-grid=${fmt(timing.mechanicsActiveGridNodes?.mean, 0)}/${fmt(timing.mechanicsActiveGridNodes?.max, 0)}`,
      `events=${timing.reactionEvents ?? 0}`
    ].join(' ');
  }

  function workerRebuildTimingStatusText(timing) {
    const stageMs = timing?.stageMs || {};
    if (!timing?.schema) return 'pending';
    return [
      `total=${fmt(timing.totalMs, 1)}ms`,
      `demo=${fmt(stageMs.createSphPhaseDemo, 1)}ms`,
      `view=${fmt(stageMs.createSphPhaseViewState, 1)}ms`,
      `preflight=${fmt(stageMs.preflight, 1)}ms`,
      `materials=${timing.materialCount ?? 0}`,
      `reactions=${timing.reactionCount ?? 0}`,
      `cache=${timing.cacheStatus || 'pending'}`
    ].join(' ');
  }

  function sceneSyncTimingStatusText(timing) {
    const stageMs = timing?.stageMs || {};
    if (!timing?.schema) return 'pending';
    return [
      `total=${fmt(timing.totalMs, 1)}ms`,
      `batch=${fmt(stageMs.surfaceBatching, 1)}ms`,
      `thermal=${fmt((stageMs.thermalMaterialTable || 0) + (stageMs.thermalClosureGraphs || 0) + (stageMs.thermalPhaseResponse || 0), 1)}ms`,
      `react=${fmt(stageMs.reactionTable, 1)}ms`,
      `optical=${fmt(stageMs.opticalState, 1)}ms`,
      `surface=${fmt(stageMs.surfaceApply, 1)}ms`
    ].join(' ');
  }

  function compactStaticTableCacheUpdate(update, extra = {}) {
    if (!update) return null;
    const { cacheSnapshot, ...compact } = update;
    return {
      ...compact,
      cacheSnapshotBytes: typeof cacheSnapshot === 'string' ? cacheSnapshot.length : 0,
      ...extra
    };
  }

  function readStaticTableCacheSnapshot() {
    if (!storageAvailable()) return null;
    try {
      const snapshot = window.localStorage.getItem(SPH_STATIC_TABLE_CACHE_STORAGE_KEY) || null;
      staticTableCacheStorageSignature = staticTableSnapshotSignature(snapshot);
      return snapshot;
    } catch {
      return null;
    }
  }

  function staticTableSnapshotSignature(snapshot) {
    if (typeof snapshot !== 'string' || snapshot.length === 0) return 'empty';
    return `${snapshot.length}:${snapshot.slice(0, 48)}:${snapshot.slice(-48)}`;
  }

  function workerRebuildTaskOptions(controlOptions) {
    const snapshots = readSphCacheStorageSnapshots();
    staticTableCacheStorageSignature = staticTableSnapshotSignature(snapshots.staticTableCacheSnapshot);
    recordPerformanceSpan('cache storage snapshot read', performance.now() - (snapshots.timing?.totalMs || 0), performance.now(), {
      materialBytes: snapshots.timing?.materialSnapshotBytes || 0,
      coldStartBytes: snapshots.timing?.coldStartSnapshotBytes || 0,
      staticTableBytes: snapshots.timing?.staticTableSnapshotBytes || 0
    });
    return {
      ...controlOptions,
      __cacheLookup: workerCacheLookupInput(controlOptions, snapshots),
      __cachePersistence: workerCachePersistenceInput(snapshots),
      __staticTableCache: workerStaticTableCacheInput(snapshots)
    };
  }

  function compactStaticTableBundleRead(bundle, extra = {}) {
    return {
      schema: SPH_STATIC_TABLE_CACHE_BUNDLE_SCHEMA,
      status: bundle?.status || 'static-table-cache-bundle-miss',
      storageStatus: bundle?.storageStatus || null,
      hitCount: bundle?.hitCount || 0,
      restoredFamilies: bundle?.restoredFamilies || [],
      tableCount: bundle?.tableCount || 0,
      gpuWarmupCount: bundle?.gpuWarmupCount || 0,
      staleCount: bundle?.staleCount || 0,
      generatorFingerprint: PEER_CLOSURE_CACHE_GENERATOR_FINGERPRINT,
      ...extra
    };
  }

  function compactStaticTableSummary(summary) {
    if (!summary?.schema) return summary || null;
    return {
      schema: summary.schema,
      status: summary.status,
      storageStatus: summary.storageStatus || null,
      storageKey: summary.storageKey || SPH_STATIC_TABLE_CACHE_STORAGE_KEY,
      families: summary.families || [],
      tableCount: summary.tableCount ?? summary.records?.length ?? 0,
      gpuWarmupCount: summary.gpuWarmupCount ?? 0,
      hitCount: summary.hitCount ?? 0,
      staleCount: summary.staleCount ?? 0,
      generatorFingerprint: summary.generatorFingerprint || null,
      recordSummaries: (summary.records || []).map((record) => ({
        cacheKey: record.cacheKey,
        family: record.family,
        sourceSchema: record.sourceSchema,
        rowHash: record.rowHash,
        arrayCount: Object.keys(record.arrays || {}).length,
        generatorFingerprint: record.generatorFingerprint || null
      }))
    };
  }

  function rememberStaticTableCacheBundle(bundle, {
    signature,
    backend,
    durationMs = null,
    rootTaskId = null,
    artifactRef = null,
    timing = null,
    source = 'worker'
  } = {}) {
    staticTableCacheBundle = bundle?.hitCount > 0 ? bundle : null;
    staticTableCacheBundleSignature = staticTableCacheBundle ? signature : null;
    sphStaticTableCacheRead = compactStaticTableBundleRead(bundle, {
      status: staticTableCacheBundle ? bundle.status : bundle?.status || 'static-table-cache-bundle-miss',
      signature,
      backend,
      source,
      durationMs,
      rootTaskId,
      artifactRef,
      timing,
      ready: Boolean(staticTableCacheBundle)
    });
    if (staticTableCacheBundle) {
      recordPerformanceSpan('static table cache worker rehydrate', performance.now() - (durationMs || 0), performance.now(), {
        backend: backend || 'unknown',
        hitCount: staticTableCacheBundle.hitCount,
        restoredFamilies: staticTableCacheBundle.restoredFamilies.join(','),
        tableCount: staticTableCacheBundle.tableCount,
        gpuWarmupCount: staticTableCacheBundle.gpuWarmupCount
      });
    }
    publishPeerClosureCacheState();
    return staticTableCacheBundle;
  }

  function runStaticTableCacheReadFallback(snapshot, signature) {
    return new Promise((resolve) => {
      window.setTimeout(() => {
        const startMs = performance.now();
        const bundle = rehydrateSphStaticTableBundle(snapshot, {
          generatorFingerprint: PEER_CLOSURE_CACHE_GENERATOR_FINGERPRINT
        });
        resolve({
          bundle,
          bundleSummary: compactStaticTableBundleRead(bundle, {
            signature,
            backend: 'main-thread-deferred',
            durationMs: Math.max(0, performance.now() - startMs)
          }),
          artifact: {
            outputs: {
              timing: {
                schema: 'peercompute.ulg.sph-static-table-cache-worker-read-timing.v0',
                totalMs: Math.max(0, performance.now() - startMs),
                fallback: true
              }
            },
            execution: {
              backend: 'main-thread-deferred'
            }
          }
        });
      }, 0);
    });
  }

  function scheduleStaticTableCacheRead({ reason = 'preload', snapshot = null, force = false } = {}) {
    const cacheSnapshot = snapshot ?? readStaticTableCacheSnapshot();
    const signature = staticTableSnapshotSignature(cacheSnapshot);
    if (!cacheSnapshot) {
      staticTableCacheBundle = null;
      staticTableCacheBundleSignature = null;
      sphStaticTableCacheRead = compactStaticTableBundleRead(null, {
        status: storageAvailable() ? 'empty' : 'localstorage-unavailable',
        signature,
        reason,
        backend: 'none',
        ready: false
      });
      publishPeerClosureCacheState();
      return null;
    }
    if (!force && staticTableCacheBundle && staticTableCacheBundleSignature === signature) {
      sphStaticTableCacheRead = {
        ...sphStaticTableCacheRead,
        status: staticTableCacheBundle.status,
        reason,
        ready: true
      };
      publishPeerClosureCacheState();
      return staticTableCacheBundle;
    }
    const generation = staticTableCacheReadGeneration + 1;
    staticTableCacheReadGeneration = generation;
    const submittedAtMs = performance.now();
    const canUseWorker = typeof runtime?.runSphStaticTableCacheRehydrate === 'function';
    sphStaticTableCacheRead = compactStaticTableBundleRead(null, {
      status: 'submitted',
      signature,
      generation,
      reason,
      backend: canUseWorker ? 'ulg-runtime-worker' : 'main-thread-deferred',
      ready: false
    });
    publishPeerClosureCacheState();
    const taskPromise = canUseWorker
      ? runtime.runSphStaticTableCacheRehydrate({
        cacheSnapshot,
        generatorFingerprint: PEER_CLOSURE_CACHE_GENERATOR_FINGERPRINT
      })
      : runStaticTableCacheReadFallback(cacheSnapshot, signature);
    Promise.resolve(taskPromise).then((result) => {
      if (generation !== staticTableCacheReadGeneration) return;
      const artifact = result?.artifact || null;
      const bundle = result?.bundle || null;
      rememberStaticTableCacheBundle(bundle, {
        signature,
        backend: artifact?.execution?.backend || (canUseWorker ? 'cpu-worker' : 'main-thread-deferred'),
        durationMs: Math.max(0, performance.now() - submittedAtMs),
        rootTaskId: result?.rootTaskId || null,
        artifactRef: result?.artifactRef || null,
        timing: artifact?.outputs?.timing || artifact?.execution?.timing || null,
        source: canUseWorker ? 'worker-preloaded' : 'main-thread-deferred'
      });
      renderStatus();
      updateWarningBanner();
    }).catch((error) => {
      if (generation !== staticTableCacheReadGeneration) return;
      staticTableCacheBundle = null;
      staticTableCacheBundleSignature = null;
      sphStaticTableCacheRead = compactStaticTableBundleRead(null, {
        status: 'worker-error',
        signature,
        generation,
        reason: error instanceof Error ? error.message : String(error),
        backend: canUseWorker ? 'cpu-worker' : 'main-thread-deferred',
        ready: false
      });
      recordPerformanceSpan('static table cache worker rehydrate failed', submittedAtMs, performance.now(), {
        error: sphStaticTableCacheRead.reason
      });
      publishPeerClosureCacheState();
      renderStatus();
      updateWarningBanner();
    });
    return null;
  }

  function readStaticTableCacheBundle() {
    if (staticTableCacheBundle) {
      sphStaticTableCacheRead = {
        ...sphStaticTableCacheRead,
        status: staticTableCacheBundle.status,
        ready: true,
        consumedAtMs: performance.now()
      };
      publishPeerClosureCacheState();
      return staticTableCacheBundle;
    }
    sphStaticTableCacheRead = {
      ...(sphStaticTableCacheRead || compactStaticTableBundleRead(null, {
        signature: staticTableCacheStorageSignature,
        backend: 'none',
        ready: false
      })),
      status: sphStaticTableCacheRead?.status === 'submitted' ? 'submitted' : 'in-memory-miss',
      reason: sphStaticTableCacheRead?.status === 'submitted'
        ? sphStaticTableCacheRead.reason
        : 'scene-sync-no-storage-read',
      ready: false
    };
    publishPeerClosureCacheState();
    return null;
  }

  function persistStaticTableCacheSnapshot(update) {
    if (!storageAvailable() || typeof update?.cacheSnapshot !== 'string') {
      return { status: storageAvailable() ? 'no-snapshot' : 'localstorage-unavailable' };
    }
    try {
      window.localStorage.setItem(SPH_STATIC_TABLE_CACHE_STORAGE_KEY, update.cacheSnapshot);
      staticTableCacheStorageSignature = staticTableSnapshotSignature(update.cacheSnapshot);
      return { status: 'stored', bytes: update.cacheSnapshot.length };
    } catch (error) {
      return {
        status: 'write-error',
        reason: error instanceof Error ? error.message : String(error)
      };
    }
  }

  function staticTableCacheTaskPending() {
    return sphStaticTableCacheRead?.status === 'submitted' || sphStaticTableCacheWrite?.status === 'submitted';
  }

  function runStaticTableCacheFallback(tableInputs, previousSnapshot) {
    return new Promise((resolve) => {
      window.setTimeout(() => {
        const update = createSphStaticTableCacheUpdate({
          previousSnapshot,
          tableInputs,
          generatorFingerprint: PEER_CLOSURE_CACHE_GENERATOR_FINGERPRINT
        });
        resolve({
          artifact: {
            outputs: {
              update,
              summary: null,
              timing: {
                schema: 'peercompute.ulg.sph-static-table-cache-worker-timing.v0',
                totalMs: 0,
                fallback: true
              }
            },
            execution: {
              backend: 'main-thread-deferred'
            }
          }
        });
      }, 0);
    });
  }

  function scheduleStaticTableCacheUpdate({ reason = 'scene-setParticles' } = {}) {
    const generation = staticTableCacheGeneration + 1;
    staticTableCacheGeneration = generation;
    const submittedAtMs = performance.now();
    const tableInputs = sphStaticTableInputsFromScene(scene);
    const previousSnapshot = readStaticTableCacheSnapshot();
    const canUseWorker = typeof runtime?.runSphStaticTableCacheUpdate === 'function';
    sphStaticTableCacheWrite = {
      schema: SPH_STATIC_TABLE_CACHE_UPDATE_SCHEMA,
      status: 'submitted',
      storageKey: SPH_STATIC_TABLE_CACHE_STORAGE_KEY,
      generation,
      reason,
      backend: canUseWorker ? 'ulg-runtime-worker' : 'main-thread-deferred',
      submittedAtMs,
      counts: {
        tables: sphStaticTableCacheWrite?.counts?.tables ?? 0,
        gpuWarmup: sphStaticTableCacheWrite?.counts?.gpuWarmup ?? 0
      },
      tableWriteCount: 0,
      tableUnchangedCount: 0,
      gpuWarmupWriteCount: 0,
      generatorFingerprint: PEER_CLOSURE_CACHE_GENERATOR_FINGERPRINT
    };
    publishPeerClosureCacheState();
    const taskPromise = canUseWorker
      ? runtime.runSphStaticTableCacheUpdate({
        cacheSnapshot: previousSnapshot,
        tableInputs,
        generatorFingerprint: PEER_CLOSURE_CACHE_GENERATOR_FINGERPRINT
      })
      : runStaticTableCacheFallback(tableInputs, previousSnapshot);
    Promise.resolve(taskPromise).then((result) => {
      if (generation !== staticTableCacheGeneration) return;
      const artifact = result?.artifact || null;
      const update = result?.update
        ? { ...result.update, cacheSnapshot: result.cacheSnapshot || null }
        : artifact?.outputs?.update || null;
      const summary = compactStaticTableSummary(artifact?.outputs?.summary || null);
      const persist = persistStaticTableCacheSnapshot(update);
      sphStaticTableCacheSummary = summary;
      sphStaticTableCacheWrite = compactStaticTableCacheUpdate(update, {
        status: persist.status === 'stored' ? update?.status || 'stored' : persist.status,
        persist,
        generation,
        rootTaskId: result?.rootTaskId || null,
        artifactRef: result?.artifactRef || null,
        backend: artifact?.execution?.backend || (canUseWorker ? 'cpu-worker' : 'main-thread-deferred'),
        timing: artifact?.outputs?.timing || artifact?.execution?.timing || null
      });
      if (persist.status === 'stored' && result?.bundle?.hitCount > 0) {
        rememberStaticTableCacheBundle(result.bundle, {
          signature: staticTableSnapshotSignature(update?.cacheSnapshot || null),
          backend: artifact?.execution?.backend || (canUseWorker ? 'cpu-worker' : 'main-thread-deferred'),
          durationMs: artifact?.outputs?.timing?.totalMs ?? null,
          rootTaskId: result?.rootTaskId || null,
          artifactRef: result?.artifactRef || null,
          timing: artifact?.outputs?.timing || artifact?.execution?.timing || null,
          source: 'worker-post-write'
        });
      } else if (persist.status === 'stored') {
        scheduleStaticTableCacheRead({
          reason: 'post-write-preload',
          snapshot: update?.cacheSnapshot || null,
          force: true
        });
      }
      recordPerformanceSpan('static table cache worker update', submittedAtMs, performance.now(), {
        backend: sphStaticTableCacheWrite?.backend || 'unknown',
        status: sphStaticTableCacheWrite?.status || 'unknown',
        tableWrites: sphStaticTableCacheWrite?.tableWriteCount ?? 0,
        tableUnchanged: sphStaticTableCacheWrite?.tableUnchangedCount ?? 0,
        gpuWarmupWrites: sphStaticTableCacheWrite?.gpuWarmupWriteCount ?? 0,
        tableCount: sphStaticTableCacheWrite?.counts?.tables ?? 0,
        gpuWarmupCount: sphStaticTableCacheWrite?.counts?.gpuWarmup ?? 0
      });
      publishPeerClosureCacheState();
      renderStatus();
      updateWarningBanner();
    }).catch((error) => {
      if (generation !== staticTableCacheGeneration) return;
      sphStaticTableCacheWrite = {
        schema: SPH_STATIC_TABLE_CACHE_UPDATE_SCHEMA,
        status: 'worker-error',
        storageKey: SPH_STATIC_TABLE_CACHE_STORAGE_KEY,
        generation,
        reason: error instanceof Error ? error.message : String(error),
        backend: canUseWorker ? 'cpu-worker' : 'main-thread-deferred',
        generatorFingerprint: PEER_CLOSURE_CACHE_GENERATOR_FINGERPRINT
      };
      recordPerformanceSpan('static table cache worker update failed', submittedAtMs, performance.now(), {
        error: sphStaticTableCacheWrite.reason
      });
      publishPeerClosureCacheState();
      renderStatus();
      updateWarningBanner();
    });
  }

  function gasPressureStatusText(summary) {
    if (!summary?.schema) return 'pending';
    const feedback = summary.pressureFeedback || null;
    const speciesText = Object.values(summary.bySpecies || {})
      .sort((a, b) => b.partialPressurePa - a.partialPressurePa)
      .slice(0, 4)
      .map((item) => `${item.material}=${fmt(item.partialPressurePa, 1)}Pa`)
      .join(' ');
    return [
      `total=${fmt(summary.totalPressurePa, 1)}Pa`,
      `atm=${fmt(summary.totalPressureAtm, 3)}`,
      `vol=${fmt(summary.gasVolumeM3, 3)}m3`,
      `gauge=${feedback ? fmt(feedback.pressureGaugePa, 1) : 'pending'}Pa`,
      `wallF=${feedback ? fmt(feedback.totalAbsWallForceN, 1) : 'pending'}N`,
      `force=${feedback?.forceCouplingStatus || 'pending'}`,
      speciesText || 'species=none'
    ].join(' ');
  }

  function residentReactionSummaryFromStep(step) {
    const reactionResult = step?.reactionStep?.result || step?.reactionStep || null;
    return reactionResult?.reactionSummary || null;
  }

  function updateResidentGasPressureSummary(step = overlay.__mlsMpmResidentStep || null) {
    const baselineSummary = activeViewStateGasPressure
      || activeViewState?.gasPressureSummary
      || (driver?.demo ? gasPressureSummary(driver.demo) : null);
    const reactionSummary = residentReactionSummaryFromStep(step);
    const residentProductMass = step?.residentProductMass || step?.nextParticleUploads?.residentProductMass || null;
    if (!baselineSummary || (!reactionSummary && !residentProductMass?.gasSpeciesLedger)) {
      overlay.__sphResidentGasPressureSummary = null;
      return null;
    }
    const pressure = gasPressureSummaryFromResidentReaction({
      baselineSummary,
      reactionSummary,
      residentProductMass,
      pressureInterfaceState: scene.getSphResidentPressureInterfaceState?.()
        || overlay.__sphResidentPressureInterfaceState
        || null,
      reactionTable: scene.getSphReactionTable?.() || overlay.__sphReactionTable || null,
      materialProperties: activeMaterialProperties(),
      fallbackTemperatureK: driver?.demo?.scenario?.gas?.initialTemperatureK
        || activeViewState?.gasPressureSummary?.bySpecies?.air?.temperatureK
        || 293.15
    });
    overlay.__sphResidentGasPressureSummary = pressure;
    return pressure;
  }

  function currentGasPressureSummary(fallback = null) {
    const residentPressure = overlay.__sphResidentGasPressureSummary;
    if (residentPressure?.source?.startsWith?.('gpu-resident-')) return residentPressure;
    return fallback || residentPressure || null;
  }

  function optionsWithCachedClosures(options) {
    const lookupStartMs = performance.now();
    const snapshots = readSphCacheStorageSnapshots();
    const lookup = createSphLocalCacheLookup({
      materialCacheSnapshot: snapshots.materialCacheSnapshot,
      coldStartCacheSnapshot: snapshots.coldStartCacheSnapshot,
      materials: cacheLookupMaterialsForOptions(options),
      options: {
        dropMaterial: options.dropMaterial,
        baseMaterial: options.baseMaterial,
        allowFixtureMaterialProperties: options.allowFixtureMaterialProperties === true,
        allowReducedProductProperties: options.allowReducedProductProperties === true,
        deriveCandidateEnergies: options.deriveCandidateEnergies !== false,
        strictEnergetics: options.strictEnergetics === true
      },
      generatorFingerprint: PEER_CLOSURE_CACHE_GENERATOR_FINGERPRINT,
      cacheSchema: PEER_CLOSURE_CACHE_SCHEMA,
      recordSchema: PEER_CLOSURE_CACHE_RECORD_SCHEMA,
      methodVersion: PEER_CLOSURE_CACHE_METHOD_VERSION
    });
    peerClosureCacheLookup = lookup.peerClosureCacheLookup;
    sphColdStartCacheLookup = lookup.sphColdStartCacheLookup;
    const cachedClosureCount = Object.keys(peerClosureCacheLookup.closures || {}).length;
    peerClosureCacheConsumed = cachedClosureCount > 0;
    recordPerformanceSpan('cache lookup', lookupStartMs, performance.now(), {
      materialHits: peerClosureCacheLookup.hitCount,
      materialMisses: peerClosureCacheLookup.missCount,
      cachedClosureCount,
      reactionStatus: sphColdStartCacheLookup.status,
      reactionRecords: sphColdStartCacheLookup.reactionCount,
      productReuseRecords: sphColdStartCacheLookup.productReuseCount,
      materialSnapshotBytes: snapshots.timing?.materialSnapshotBytes || 0,
      coldStartSnapshotBytes: snapshots.timing?.coldStartSnapshotBytes || 0
    });
    return applySphLocalCacheLookupToOptions(options, lookup);
  }

  function workerViewStateClosureOptions(options, viewState) {
    const materialProperties = viewState?.materialProperties || null;
    if (!materialProperties || Object.keys(materialProperties).length === 0) return null;
    const closures = {};
    for (const [material, properties] of Object.entries(materialProperties)) {
      if (!properties) continue;
      closures[material] = {
        closureFamily: 'material',
        closureId: `peercompute-worker-view-state-${materialCacheKey(material)}`,
        material,
        properties,
        materialDerivation: materialDerivationSummary(properties),
        provenance: {
          source: 'peercompute-worker-view-state',
          generatorFingerprint: PEER_CLOSURE_CACHE_GENERATOR_FINGERPRINT
        }
      };
    }
    const reactionDiscovery = viewState.reactionDiscovery || null;
    const reactionRecord = reactionRecordFromDiscovery(reactionDiscovery, materialProperties);
    const productClosures = {
      ...(reactionDiscovery?.productClosures || {})
    };
    return {
      ...options,
      closures,
      reactionDiscoveryCacheRecord: reactionRecord || undefined,
      cachedProductClosures: Object.keys(productClosures).length > 0 ? productClosures : undefined,
      __interactiveClosureSource: 'peercompute-worker-view-state'
    };
  }

  function writeLocalCachePersistence(materialProperties = {}, reactionDiscovery = null, source = 'main-thread-fallback') {
    if (!storageAvailable()) {
      peerClosureCacheWrite = {
        schema: PEER_CLOSURE_CACHE_SCHEMA,
        status: 'localstorage-unavailable',
        writeCount: 0,
        source
      };
      sphColdStartCacheWrite = emptySphColdStartCache('localstorage-unavailable', {
        generatorFingerprint: PEER_CLOSURE_CACHE_GENERATOR_FINGERPRINT,
        source
      });
      return false;
    }
    const snapshots = readSphCacheStorageSnapshots();
    const persistence = createSphLocalCachePersistence({
      materialCacheSnapshot: snapshots.materialCacheSnapshot,
      coldStartCacheSnapshot: snapshots.coldStartCacheSnapshot,
      materialProperties,
      reactionDiscovery,
      generatorFingerprint: PEER_CLOSURE_CACHE_GENERATOR_FINGERPRINT,
      cacheSchema: PEER_CLOSURE_CACHE_SCHEMA,
      recordSchema: PEER_CLOSURE_CACHE_RECORD_SCHEMA,
      generatorSchema: PEER_CLOSURE_CACHE_GENERATOR_SCHEMA,
      appVersion: PEER_CLOSURE_CACHE_APP_VERSION,
      methodVersion: PEER_CLOSURE_CACHE_METHOD_VERSION
    });
    const materialStore = persistWorkerCacheSnapshot(
      PEER_CLOSURE_CACHE_STORAGE_KEY,
      persistence.material?.cacheSnapshot
    );
    const coldStore = persistWorkerCacheSnapshot(
      SPH_COLD_START_CACHE_STORAGE_KEY,
      persistence.coldStart?.cacheSnapshot
    );
    peerClosureCacheWrite = {
      ...(persistence.material?.summary || {}),
      storageWriteStatus: materialStore.status,
      storageWriteBytes: materialStore.bytes,
      storageWriteReason: materialStore.reason || null,
      source
    };
    sphColdStartCacheWrite = {
      ...(persistence.coldStart?.summary || {}),
      storageWriteStatus: coldStore.status,
      storageWriteBytes: coldStore.bytes,
      storageWriteReason: coldStore.reason || null,
      source
    };
    overlay.__sphLocalCachePersistenceFallback = {
      schema: persistence.schema,
      status: persistence.status,
      timing: persistence.timing || null,
      source,
      materialStore,
      coldStore,
      storageSnapshotTiming: snapshots.timing
    };
    return materialStore.status === 'stored' || coldStore.status === 'stored';
  }

  function createDriverFromControls({ preferActiveViewStateCache = false } = {}) {
    const startMs = performance.now();
    try {
      const controlOptions = driverOptionsFromControls();
      const workerOptions = preferActiveViewStateCache
        ? workerViewStateClosureOptions(controlOptions, activeViewState)
        : null;
      const driverOptions = workerOptions || optionsWithCachedClosures(controlOptions);
      const next = createSphPhaseDemo(driverOptions);
      recordPerformanceSpan('main-thread createSphPhaseDemo', startMs, performance.now(), {
        cacheStatus: next.demo.reactionDiscovery?.cache?.cacheStatus || null,
        reactionCount: next.demo.reactions?.length || 0,
        source: driverOptions.__interactiveClosureSource || 'localstorage-cache'
      });
      overlay.__sphInteractiveDriverSource = driverOptions.__interactiveClosureSource || 'localstorage-cache';
      if (!workerOptions) {
        writeLocalCachePersistence(next.demo.materialProperties, next.demo.reactionDiscovery, 'interactive-main-thread-driver');
      } else {
        peerClosureCacheWrite = {
          ...(peerClosureCacheWrite || {}),
          status: peerClosureCacheWrite?.status || 'worker-view-state-cache-reused',
          mainThreadWriteSkipped: true,
          reuseSource: 'peercompute-worker-view-state'
        };
        sphColdStartCacheWrite = {
          ...(sphColdStartCacheWrite || {}),
          status: sphColdStartCacheWrite?.status || 'worker-view-state-cache-reused',
          mainThreadWriteSkipped: true,
          reuseSource: 'peercompute-worker-view-state'
        };
      }
      publishPeerClosureCacheState();
      blockedError = null;
      return next;
    } catch (error) {
      recordPerformanceSpan('main-thread createSphPhaseDemo blocked', startMs, performance.now(), {
        error: error instanceof Error ? error.message : String(error)
      });
      peerClosureCacheConsumed = false;
      blockedError = error;
      return null;
    }
  }
  const initialWorkerRebuildAvailable = typeof runtime?.runSphPhaseRebuild === 'function';
  let initialWorkerRebuildPromise = null;
  if (initialWorkerRebuildAvailable) {
    activeViewStateSource = 'peercompute-worker-pending';
    const generation = workerRebuildGeneration + 1;
    workerRebuildGeneration = generation;
    const submittedAtMs = performance.now();
    const controlOptions = driverOptionsFromControls();
    const taskOptions = workerRebuildTaskOptions(controlOptions);
    activeWorkerRebuildTask = {
      generation,
      status: 'submitted',
      reason: 'initial-load',
      optionsHash: JSON.stringify({
        drop: controlOptions.dropMaterial,
        base: controlOptions.baseMaterial,
        counts: [controlOptions.dropParticleEdge, controlOptions.baseParticleEdge],
        box: controlOptions.scenario?.box?.dimensionsM
      }),
      submittedAtMs
    };
    cpuClosureTask = {
      schema: 'peercompute.ulg.sph-demo-cpu-closure-task.v0',
      active: true,
      label: 'material/reaction/closure rebuild',
      location: 'ulg-runtime worker',
      reason: 'supervised PeerCompute sph.phase.rebuild task',
      updatedAtMs: submittedAtMs
    };
    overlay.__sphCpuClosureTask = cpuClosureTask;
    overlay.__sphPhaseRebuildWorker = {
      schema: SPH_PHASE_REBUILD_WORKER_STATUS_SCHEMA,
      ...activeWorkerRebuildTask
    };
    statusEl.textContent = 'submitting initial material state and derived chemistry to ulg-runtime worker...';
    initialWorkerRebuildPromise = Promise.resolve(runtime.runSphPhaseRebuild(taskOptions))
      .then((result) => ({ result, generation, submittedAtMs, reason: 'initial-load' }))
      .catch((error) => ({ error, generation, submittedAtMs, reason: 'initial-load' }));
  } else {
    driver = createDriverFromControls();
  }
  const initialSchroederRenderProxyOverlayEnabled = booleanUrlParam(
    initialHash.get('schroederRenderProxy')
      ?? initialQuery.get('schroederRenderProxy')
      ?? initialHash.get('schroederRenderProxyOverlay')
      ?? initialQuery.get('schroederRenderProxyOverlay'),
    false
  );

  function applySchroederRenderProxyOverlayFlag(target) {
    if (target?.scene?.userData) {
      target.scene.userData.sphSchroederRenderProxyOverlayEnabled =
        initialSchroederRenderProxyOverlayEnabled;
    }
    return target;
  }
  let sceneBoxDimsM = driver?.demo.box.dimensionsM ?? boxDimensionsFromControls();
  let scene = createSphPhaseScene(sceneContainer, {
    boxDimsM: sceneBoxDimsM,
    surfaceRadiusScale: blobScaleOf(),
    preserveDrawingBuffer: preserveDrawingBufferForCapture,
    rendererBackend: initialSphRendererBackend,
    rendererWebGpuPresentation: initialThreeWebGpuRendererPresentationEnabled,
    rendererWebGpuResidentDevice: initialThreeWebGpuRendererResidentDeviceEnabled,
    rendererWebGpuPresentationUnsafe: initialThreeWebGpuRendererPresentationUnsafe,
    rendererWebGpuSurfaceBufferPresentation: initialThreeWebGpuSurfaceBufferPresentationEnabled,
    rendererWebGpuDeviceResult: initialRendererWebGpuDeviceResult,
    residentSurfaceDrawOverlay: residentSurfaceDrawOverlayMode,
    residentSurfaceDrawDiagnosticMode: currentResidentSurfaceDrawDiagnosticMode(),
    backgroundColor: backgroundColorOf(),
    nativeSurfacePixelValidation: nativeSurfacePixelValidationEnabled,
    workerOffscreenPresentation: workerOffscreenPresentationEnabled,
    renderOwnershipPolicy: initialPeerComputeRenderOwnershipPolicy,
    materialInterfaceSurfaceTablePolicy: initialMaterialInterfaceSurfaceTablePolicy,
    residentAuthorityHost: currentResidentAuthorityHostForScene()
  });
  applySchroederRenderProxyOverlayFlag(scene);
  overlay.__sphScene = scene;
  overlay.__sphSceneBackgroundColor = scene.scene?.userData?.sphSceneBackgroundColor || null;
  if (backgroundImageSelect.value) {
    applyBackgroundImageFromControl('initial-url-controls');
  }
  overlay.__sphPeerComputeRenderOwnershipPolicy =
    scene.getPeerComputeRenderOwnershipPolicy?.()
    || scene.scene?.userData?.sphPeerComputeRenderOwnershipPolicy
    || initialPeerComputeRenderOwnershipPolicy;
  overlay.__sphWorkerOffscreenPresentation = scene.getWorkerOffscreenPresentation?.() || null;
  overlay.__sphDriver = driver;
  overlay.__sphOpticalGpuLookup = scene.getOpticalGpuLookup?.() || null;
  overlay.__sphThermalMaterialTable = scene.getSphThermalMaterialTable?.() || null;
  overlay.__sphReactionTable = scene.getSphReactionTable?.() || null;
  overlay.__sphResidentRenderState = scene.getSphResidentRenderState?.() || null;
  overlay.__sphResidentPressureInterfaceState = scene.getSphResidentPressureInterfaceState?.() || null;
  overlay.__sphResidentSurfaceDraw = scene.getSphResidentSurfaceDraw?.() || null;
  overlay.__sphResidentSurfaceDrawOverlayPolicy = scene.getSphResidentSurfaceDrawOverlayPolicy?.() || null;
  overlay.__sphGpuParticleState = scene.getSphGpuParticleState?.() || null;
  overlay.__sphGpuParticleUpload = scene.getSphGpuParticleUpload?.() || null;
  startPeerComputeResidentAuthorityHost();
  overlay.__mlsMpmGpuParticleState = scene.getMlsMpmGpuParticleState?.() || null;
  overlay.__mlsMpmGpuParticleUpload = scene.getMlsMpmGpuParticleUpload?.() || null;
  overlay.__mlsMpmMechanicsPrediction = scene.getMlsMpmMechanicsPrediction?.() || null;
  overlay.__mlsMpmP2gGridProjection = scene.getMlsMpmP2gGridProjection?.() || null;
  overlay.__mlsMpmGridUpdate = scene.getMlsMpmGridUpdate?.() || null;
  overlay.__mlsMpmG2pReconstruction = scene.getMlsMpmG2pReconstruction?.() || null;
  overlay.__mlsMpmResidentStep = scene.getMlsMpmResidentStep?.() || null;
  overlay.__mlsMpmResidentSteps = scene.getMlsMpmResidentSteps?.() || null;
  overlay.__mlsMpmResidentRequestedReadbackMode = scene.getMlsMpmResidentRequestedReadbackMode?.() || SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT;
  overlay.__sphRemoteResidentTaskGraphRefresh = remoteResidentTaskGraphRefreshTelemetry(
    enableRemoteResidentTaskGraphRefresh ? 'configured-waiting-for-resident-schedule' : 'disabled',
    { enabled: Boolean(enableRemoteResidentTaskGraphRefresh) }
  );
  overlay.__sphStandaloneMechanicsPredictionEnabled = STANDALONE_MECHANICS_PREDICTION_DEFAULT;
  let rebuildTimer = null;
  let pendingOpticalLookupSignature = null;
  let pendingSphGpuParticleUploadSignature = null;
  let pendingMlsMpmGpuParticleUploadSignature = null;
  let pendingMlsMpmMechanicsPredictionSignature = null;
  let pendingMlsMpmP2gGridProjectionSignature = null;
  let pendingMlsMpmGridUpdateSignature = null;
  let pendingMlsMpmG2pReconstructionSignature = null;
  let pendingMlsMpmResidentStepsSignature = null;
  let pendingInitialResidentVisualRefreshSignature = null;
  let pendingMlsMpmResidentStepsToken = 0;
  let pendingResidentInterfaceRefreshPromise = null;
  let residentInterfaceRefreshToken = 0;
  let pendingMountedMechanicsStageWorkerLanePromise = null;
  let mountedMechanicsStageWorkerRunner = null;
  let mountedMechanicsStageWorkerRunnerHost = null;
  let mountedMechanicsStageWorkerLaneSequence = 0;
  let particleSyncGeneration = 0;
  let resetRebuildPending = false;
  let residentRenderReadbackSequence = 0;
  let residentRenderReadbackCount = 0;
  let residentRenderReadbackSkippedCount = 0;
  let residentAccumulatedSubvisibleMotionM = 0;
  let residentSubvisibleMotionBurstCount = 0;
  let residentStageOrderTrace = appendResidentStageOrderTrace(null, {
    status: 'resident-stage-order-trace-initialized',
    generation: particleSyncGeneration,
    updatedAtMs: performance.now()
  });
  let residentPerf = {
    schema: 'peercompute.ulg.sph-demo-resident-perf.v0',
    residentSubmissions: 0,
    residentStepsPerSchedule: RESIDENT_STEPS_PER_SCHEDULE_FALLBACK,
    renderReadbackCadence: RESIDENT_RENDER_READBACK_CADENCE,
    effectiveRenderReadbackCadence: RESIDENT_RENDER_READBACK_CADENCE,
    playbackVisualRefreshForced: false,
    renderReadbacks: 0,
    skippedRenderReadbacks: 0,
    residentInterfaceRefreshes: 0,
    skippedResidentInterfaceRefreshes: 0,
    deferredResidentInterfaceRefreshes: 0,
    residentInterfaceRefreshMode: initialPeerComputeRenderOwnershipPolicy?.residentInterfaceRefreshMode ?? null,
    residentInterfaceRefreshWarmupFrames:
      initialPeerComputeRenderOwnershipPolicy?.residentInterfaceRefreshWarmupFrames ?? 0,
    residentInterfaceRefreshPending: false,
    accumulatedSubvisibleMotionM: 0,
    subvisibleMotionBurstCount: 0,
    staleResidentSubmissions: 0,
    lastResidentMs: null,
    lastResidentCycleMs: null,
    lastResidentPostComputeMs: null,
    lastResidentMaterialInterfaceRefreshMs: null,
    lastResidentPressureInterfaceRefreshMs: null,
    lastResidentInterfaceRefreshMs: null,
    lastRenderReadbackMs: null,
    lastResidentStageTiming: null,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
  overlay.__sphResidentPerf = residentPerf;
  overlay.__sphResidentStageOrderTrace = residentStageOrderTrace;
  if (scene?.scene?.userData) scene.scene.userData.sphResidentStageOrderTrace = residentStageOrderTrace;
  publishPeerClosureCacheState();
  overlay.__sphPerformanceTrace = sphPerformanceTrace;
  overlay.__sphCpuClosureTask = cpuClosureTask;
  overlay.__sphFrameCounters = frameCounters;
  overlay.__sphUpdateResidentGasPressureSummary = updateResidentGasPressureSummary;

  function publishPeerComputeResidentAuthorityHostStatus(status, extra = {}) {
    overlay.__sphPeerComputeResidentAuthorityHost = {
      ...summarizePeerComputeResidentAuthorityHost(peerComputeResidentAuthorityHost),
      status,
      updatedAtMs: performance.now(),
      ...extra
    };
  }

  function startPeerComputeResidentAuthorityHost() {
    if (!enablePeerComputeResidentHost || peerComputeResidentAuthorityHost || peerComputeResidentAuthorityHostPromise) {
      if (peerComputeResidentAuthorityHost) {
        scene?.setResidentAuthorityHost?.(peerComputeResidentAuthorityHost);
        publishPeerComputeResidentAuthorityHostStatus('ready');
      }
      return peerComputeResidentAuthorityHostPromise;
    }
    publishPeerComputeResidentAuthorityHostStatus('initializing');
    peerComputeResidentAuthorityHostPromise = ensurePeerComputeResidentAuthorityHost({
      peercomputeModuleUrl,
      computeTaskModulePath: residentComputeTaskModulePath,
      renderOwnershipPolicy: initialPeerComputeRenderOwnershipPolicy,
      enableWorkers: initialResidentWorkersEnabled
    })
      .then((host) => {
        peerComputeResidentAuthorityHost = host;
        globalThis.__ulgResidentAuthorityHost = host;
        scene?.setResidentAuthorityHost?.(host);
        overlay.__sphPeerComputeRenderOwnershipPolicy =
          scene?.getPeerComputeRenderOwnershipPolicy?.()
          || host?.renderOwnershipPolicy
          || initialPeerComputeRenderOwnershipPolicy;
        publishPeerComputeResidentAuthorityHostStatus('ready');
        if (overlay.isConnected) {
          scheduleMlsMpmResidentSteps({ force: true });
        }
        return host;
      })
      .catch((error) => {
        publishPeerComputeResidentAuthorityHostStatus('unavailable', {
          error: error instanceof Error ? error.message : String(error)
        });
        return null;
      })
      .finally(() => {
        peerComputeResidentAuthorityHostPromise = null;
      });
    return peerComputeResidentAuthorityHostPromise;
  }

  function resolveResidentComputeManager() {
    const candidates = [
      ['residentAuthorityHost.computeManager', residentAuthorityHost?.computeManager],
      ['runtime.residentAuthorityHost.computeManager', runtime?.residentAuthorityHost?.computeManager],
      ['mount-option', residentComputeManager],
      ['runtime.residentComputeManager', runtime?.residentComputeManager],
      ['runtime.computeManager', runtime?.computeManager],
      ['runtime.nodeKernel.computeManager', runtime?.nodeKernel?.computeManager],
      ['runtime.nodeKernel.getComputeManager', runtime?.nodeKernel?.getComputeManager?.()],
      ['global.__ulgResidentComputeManager', globalThis.__ulgResidentComputeManager],
      ['peercompute-resident-authority-host', peerComputeResidentAuthorityHost?.computeManager],
      ['global.__ulgResidentAuthorityHost.computeManager', globalThis.__ulgResidentAuthorityHost?.computeManager]
    ];
    for (const [source, value] of candidates) {
      let candidate = value;
      if (typeof candidate === 'function') {
        try {
          candidate = candidate({ overlay, scene, runtime });
        } catch (error) {
          overlay.__sphResidentComputeManager = {
            schema: 'peercompute.ulg.sph-demo-resident-compute-manager.v0',
            status: 'resolver-error',
            source,
            error: error instanceof Error ? error.message : String(error),
            updatedAtMs: performance.now()
          };
          continue;
        }
      }
      if (candidate && typeof candidate.submitTask === 'function') {
        overlay.__sphResidentComputeManager = {
          schema: 'peercompute.ulg.sph-demo-resident-compute-manager.v0',
          status: 'available',
          source,
          submitTask: true,
          updatedAtMs: performance.now()
        };
        return candidate;
      }
    }
    overlay.__sphResidentComputeManager = {
      schema: 'peercompute.ulg.sph-demo-resident-compute-manager.v0',
      status: 'not-configured',
      source: null,
      submitTask: false,
      updatedAtMs: performance.now()
    };
    return null;
  }

  function resolveResidentStateManager({ allowPeerComputeAuthorityHost = true } = {}) {
    const candidates = [
      ['residentAuthorityHost.stateManager', residentAuthorityHost?.stateManager],
      ['runtime.residentAuthorityHost.stateManager', runtime?.residentAuthorityHost?.stateManager],
      ['mount-option', residentStateManager],
      ['runtime.residentStateManager', runtime?.residentStateManager],
      ['runtime.stateManager', runtime?.stateManager],
      ['runtime.nodeKernel.stateManager', runtime?.nodeKernel?.stateManager],
      ['runtime.nodeKernel.getStateManager', runtime?.nodeKernel?.getStateManager?.()],
      ['global.__ulgResidentStateManager', globalThis.__ulgResidentStateManager],
      ...(allowPeerComputeAuthorityHost
        ? [
          ['peercompute-resident-authority-host', peerComputeResidentAuthorityHost?.stateManager],
          ['global.__ulgResidentAuthorityHost.stateManager', globalThis.__ulgResidentAuthorityHost?.stateManager]
        ]
        : [])
    ];
    for (const [source, value] of candidates) {
      let candidate = value;
      if (typeof candidate === 'function') {
        try {
          candidate = candidate({ overlay, scene, runtime });
        } catch (error) {
          overlay.__sphResidentStateManager = {
            schema: 'peercompute.ulg.sph-demo-resident-state-manager.v0',
            status: 'resolver-error',
            source,
            error: error instanceof Error ? error.message : String(error),
            updatedAtMs: performance.now()
          };
          continue;
        }
      }
      const canReadWarm = typeof candidate?.getWarmDeltas === 'function'
        || typeof candidate?.readWarm === 'function'
        || typeof candidate?.getDataState === 'function';
      if (candidate && canReadWarm) {
        overlay.__sphResidentStateManager = {
          schema: 'peercompute.ulg.sph-demo-resident-state-manager.v0',
          status: 'available',
          source,
          getWarmDeltas: typeof candidate.getWarmDeltas === 'function',
          readWarm: typeof candidate.readWarm === 'function',
          getDataState: typeof candidate.getDataState === 'function',
          updatedAtMs: performance.now()
        };
        return candidate;
      }
    }
    overlay.__sphResidentStateManager = {
      schema: 'peercompute.ulg.sph-demo-resident-state-manager.v0',
      status: 'not-configured',
      source: null,
      getWarmDeltas: false,
      readWarm: false,
      getDataState: false,
      updatedAtMs: performance.now()
    };
    return null;
  }

  function recordPhysicsFrame(count = 1) {
    frameCounters.physicsFrames += Math.max(1, count);
    overlay.__sphFrameCounters = frameCounters;
  }

  function recordResidentFrame(count = 1) {
    frameCounters.residentFrames += Math.max(1, count);
    overlay.__sphFrameCounters = frameCounters;
  }

  function sampleFrameCounters() {
    const now = performance.now();
    frameCounters.renderFrames += 1;
    const elapsedS = (now - frameCounters.lastSampleMs) / 1000;
    if (elapsedS >= 1) {
      frameCounters.renderFps = frameCounters.renderFrames / elapsedS;
      frameCounters.physicsFps = frameCounters.physicsFrames / elapsedS;
      frameCounters.residentFps = frameCounters.residentFrames / elapsedS;
      frameCounters.renderFrames = 0;
      frameCounters.physicsFrames = 0;
      frameCounters.residentFrames = 0;
      frameCounters.lastSampleMs = now;
      overlay.__sphFrameCounters = frameCounters;
      renderStatus();
      updateWarningBanner();
    }
  }

  function currentSimulationTimeS() {
    return finiteNumberOrNull(
      scene.getMlsMpmResidentStep?.()?.particlePingPong?.nextTime
        ?? overlay.__mlsMpmResidentStep?.particlePingPong?.nextTime
        ?? scene.getMlsMpmResidentSteps?.()?.nextSphParticleState?.time
        ?? overlay.__mlsMpmResidentSteps?.nextSphParticleState?.time
        ?? driver?.demo?.state?.time
        ?? activeViewState?.time
    );
  }

  function setCpuClosureTask(task) {
    cpuClosureTask = task ? {
      schema: 'peercompute.ulg.sph-demo-cpu-closure-task.v0',
      active: true,
      ...task,
      updatedAtMs: performance.now()
    } : null;
    overlay.__sphCpuClosureTask = cpuClosureTask;
    updateWarningBanner();
  }

  function updateResidentPerf(patch = {}) {
    residentPerf = {
      ...residentPerf,
      ...patch,
      updatedAtMs: performance.now()
    };
    overlay.__sphResidentPerf = residentPerf;
    return residentPerf;
  }

  function publishResidentStageOrderTrace(event = {}) {
    residentStageOrderTrace = appendResidentStageOrderTrace(residentStageOrderTrace, {
      generation: particleSyncGeneration,
      resetStatus: overlay.__sphResetStatus?.status || null,
      pendingStatus: overlay.__mlsMpmResidentStepsPending?.status || null,
      updatedAtMs: performance.now(),
      ...event
    });
    overlay.__sphResidentStageOrderTrace = residentStageOrderTrace;
    if (scene?.scene?.userData) scene.scene.userData.sphResidentStageOrderTrace = residentStageOrderTrace;
    return residentStageOrderTrace;
  }
  overlay.__sphAppendResidentStageOrderTrace = publishResidentStageOrderTrace;

  function resetResidentPerf(reason) {
    residentRenderReadbackSequence = 0;
    residentRenderReadbackCount = 0;
    residentRenderReadbackSkippedCount = 0;
    residentAccumulatedSubvisibleMotionM = 0;
    residentSubvisibleMotionBurstCount = 0;
    updateResidentPerf({
      resetReason: reason,
      residentSubmissions: 0,
      residentStepsPerSchedule: currentResidentStepsPerSchedule(),
      renderReadbacks: 0,
      skippedRenderReadbacks: 0,
      residentInterfaceRefreshes: 0,
      skippedResidentInterfaceRefreshes: 0,
      residentInterfaceRefreshMode: currentResidentInterfaceRefreshMode(),
      residentInterfaceRefreshPending: false,
      accumulatedSubvisibleMotionM: 0,
      subvisibleMotionBurstCount: 0,
      staleResidentSubmissions: 0,
      effectiveRenderReadbackCadence: RESIDENT_RENDER_READBACK_CADENCE,
      playbackVisualRefreshForced: false,
      lastResidentMs: null,
      lastResidentCycleMs: null,
      lastResidentPostComputeMs: null,
      lastResidentMaterialInterfaceRefreshMs: null,
      lastResidentPressureInterfaceRefreshMs: null,
      lastResidentInterfaceRefreshMs: null,
      lastRenderReadbackMs: null,
      lastResidentStageTiming: null,
      lastRenderReadbackSkipped: false
    });
  }

  function statusIndicatesCpuFallback(status) {
    return typeof status === 'string' && (
      status.includes('cpu-reference')
      || status.includes('fallback')
      || status.includes('blocked-webgpu')
      || status.includes('webgpu-unavailable')
    );
  }

  function currentWarningMessages() {
    const messages = [];
    if (!navigator?.gpu) {
      messages.push('WebGPU unavailable: CPU/WASM fallback paths are active.');
    }
    if (
      cpuClosureTask?.active
      && (
        frameCounters.renderFps === 0
        || frameCounters.renderFps < 30
        || frameCounters.physicsFps < 30
      )
    ) {
      messages.push('deriving material or reaction properties');
    }
    if (cpuClosureTask?.active) {
      messages.push(`CPU closure task: ${cpuClosureTask.label || 'derived closure work'} (${cpuClosureTask.location || 'main thread'}).`);
    }
    if (cpuClosureTask?.active && cacheMissDerivationPending()) {
      messages.push('prepopulating cache with first principles derivations');
    }
    const lookup = scene.getOpticalGpuLookup?.();
    const thermalUpload = scene.getSphThermalResponseGraphUpload?.();
    const residentSteps = scene.getMlsMpmResidentSteps?.() || overlay.__mlsMpmResidentSteps || null;
    const residentStep = scene.getMlsMpmResidentStep?.() || overlay.__mlsMpmResidentStep || null;
    const p2gProjection = scene.getMlsMpmP2gGridProjection?.() || overlay.__mlsMpmP2gGridProjection || null;
    const gridUpdate = scene.getMlsMpmGridUpdate?.() || overlay.__mlsMpmGridUpdate || null;
    const renderState = scene.getSphResidentRenderState?.() || overlay.__sphResidentRenderState || null;
    const renderCadence = renderState?.renderReadbackCadence || overlay.__sphResidentRenderReadbackCadence || null;
    const particleBridgeLiveReadback = Boolean(
      renderCadence?.particleRenderModeRefresh === true
      && renderCadence?.skipped !== true
      && Number(renderCadence?.renderReadbackCount) > 0
    );
    const gridSpacingM = gridUpdate?.gridSpacingM || p2gProjection?.gridSpacingM || residentStep?.gridUpdate?.gridSpacingM || null;
    const motion = residentMotionDiagnostic({ residentStep, residentSteps, gridSpacingM });
    overlay.__sphResidentMotionDiagnostic = motion;
    const fallbackStatuses = [
      lookup?.execution?.backend,
      lookup?.execution?.webgpuStatus?.status,
      thermalUpload?.status,
      residentSteps?.backend,
      residentStep?.backend,
      renderState?.backend
    ].filter(Boolean);
    if (fallbackStatuses.some(statusIndicatesCpuFallback)) {
      messages.push('WebGPU fallback detected: at least one closure/runtime/render stage is CPU-backed.');
    }
    const normalHotLoopReadbackFree = residentSteps?.normalHotLoopReadbackFree
      ?? residentStep?.normalHotLoopReadbackFree
      ?? false;
    if (!normalHotLoopReadbackFree) {
      messages.push('Hot loop is not fully GPU-resident yet.');
    }
    if (renderState?.renderFieldReadback) {
      messages.push('Render field readback is active: MarchingCubes still consumes CPU arrays.');
    }
    if (overlay.__mlsMpmResidentStepsStale?.status) {
      messages.push('Discarded stale resident physics; rescheduling current particle state.');
    }
    if (overlay.__mlsMpmResidentStepsSlow?.status) {
      messages.push('Resident physics is still deriving a GPU-resident step; waiting for the current batch.');
    }
    if (
      (motion.status === 'motion-unknown-no-compact-summary' || motion.status === 'motion-unknown')
      && !particleBridgeLiveReadback
    ) {
      messages.push('Resident physics is stepping, but compact motion proof is unavailable.');
    } else if (motion.status === 'motion-below-visible-threshold') {
      messages.push('Resident physics is stepping, but displacement is below the visible threshold.');
    }
    return [...new Set(messages)];
  }

  function updateWarningBanner() {
    const simTimeS = currentSimulationTimeS();
    const simText = Number.isFinite(simTimeS) ? ` | sim t ${fmt(simTimeS, 3)}s` : '';
    fpsEl.textContent = `render fps ${fmt(frameCounters.renderFps, 1)} | physics fps ${fmt(frameCounters.physicsFps, 1)} | resident fps ${fmt(frameCounters.residentFps, 1)}${simText}`;
    const warnings = currentWarningMessages();
    const warningNodes = warnings.map((message) => {
      const chip = document.createElement('span');
      chip.className = 'sph-warning-chip';
      chip.textContent = message;
      return chip;
    });
    warningBarEl.replaceChildren(fpsEl, ...warningNodes);
    overlay.__sphWarnings = warnings;
  }

  function residentRenderReadbackDecision({
    continueFromResidentState = false,
    forceDue = false,
    forceReason = 'forced-visual-refresh',
    suppressDue = false,
    suppressReason = 'render-readback-suppressed'
  } = {}) {
    residentRenderReadbackSequence += 1;
    const hasRenderedState = Boolean(scene.getSphResidentRenderState?.()?.schema);
    const cadenceDue = !continueFromResidentState
      || !hasRenderedState
      || ((residentRenderReadbackSequence - 1) % RESIDENT_RENDER_READBACK_CADENCE === 0);
    const due = Boolean(forceDue) || cadenceDue;
    const suppressed = Boolean(suppressDue && !due);
    return {
      schema: 'peercompute.ulg.sph-demo-render-readback-cadence.v0',
      cadence: RESIDENT_RENDER_READBACK_CADENCE,
      effectiveCadence: forceDue ? 1 : RESIDENT_RENDER_READBACK_CADENCE,
      sequence: residentRenderReadbackSequence,
      due,
      skipped: !due,
      forced: Boolean(forceDue),
      suppressed,
      suppressionCandidate: Boolean(suppressDue),
      suppressionPolicy: 'subvisible-motion-cannot-suppress-cadence-refresh',
      skippedCount: residentRenderReadbackSkippedCount,
      renderReadbackCount: residentRenderReadbackCount,
      reason: forceDue ? forceReason : (cadenceDue ? 'cadence-due' : (suppressed ? suppressReason : 'cadence-skip')),
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  }

  function annotateResidentRenderStateCadence(state, cadence) {
    overlay.__sphResidentRenderReadbackCadence = cadence;
    if (state && typeof state === 'object') {
      state.renderReadbackCadence = { ...cadence };
      scene.scene.userData.sphResidentRenderState = state;
    }
    return state;
  }

  function disabledStandaloneMechanicsPrediction(sphGpuParticleState, mlsMpmGpuParticleState) {
    return {
      schema: 'peercompute.ulg.mls-mpm-gpu-mechanics-execution.v0',
      predictionSchema: 'peercompute.ulg.mls-mpm-gpu-mechanics-prediction.v0',
      backend: 'disabled',
      status: 'standalone-mechanics-prediction-disabled',
      reason: 'default demo hot loop uses the resident MLS-MPM chain instead',
      defaultEnabled: STANDALONE_MECHANICS_PREDICTION_DEFAULT,
      particleCount: sphGpuParticleState?.particleCount ?? mlsMpmGpuParticleState?.particleCount ?? 0,
      stateStrideFloats: sphGpuParticleState?.stateStrideFloats ?? 8,
      mechanicsStrideFloats: mlsMpmGpuParticleState?.mechanicsStrideFloats ?? 32,
      normalHotLoopReadbackFree: true,
      p2gValidation: false,
      gridValidation: false,
      g2pValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  }

  function scheduleOpticalGpuLookupRefresh() {
    const lookupState = scene.getOpticalGpuLookup?.();
    const signature = lookupState?.signature;
    if (!signature) return;
    if (lookupState.execution?.signature === signature || pendingOpticalLookupSignature === signature) return;
    pendingOpticalLookupSignature = signature;
    scene.refreshOpticalGpuLookup?.({ preferWebGpu: true }).then((nextLookupState) => {
      overlay.__sphOpticalGpuLookup = nextLookupState;
    }).catch((error) => {
      overlay.__sphOpticalGpuLookupError = error instanceof Error ? error.message : String(error);
    }).finally(() => {
      if (pendingOpticalLookupSignature === signature) pendingOpticalLookupSignature = null;
    });
  }

  function sphGpuParticleSignature(packed) {
    return packed
      ? [packed.particleCount, packed.step, packed.time, packed.state?.byteLength ?? 0, packed.thermo?.byteLength ?? 0].join('|')
      : null;
  }

  function scheduleSphGpuParticleUpload() {
    const packed = scene.getSphGpuParticleState?.();
    const signature = sphGpuParticleSignature(packed);
    if (!signature || pendingSphGpuParticleUploadSignature === signature) return null;
    pendingSphGpuParticleUploadSignature = signature;
    const promise = scene.refreshSphGpuParticleBuffers?.({ preferWebGpu: true }).then((upload) => {
      overlay.__sphGpuParticleUpload = upload;
      return upload;
    }).catch((error) => {
      overlay.__sphGpuParticleUploadError = error instanceof Error ? error.message : String(error);
      return null;
    }).finally(() => {
      if (pendingSphGpuParticleUploadSignature === signature) pendingSphGpuParticleUploadSignature = null;
    });
    return promise;
  }

  function mlsMpmGpuParticleSignature(packed) {
    return packed
      ? [
        packed.particleCount,
        packed.step,
        packed.time,
        packed.mechanics?.byteLength ?? 0,
        packed.mechanicsDtS ?? 0,
        packed.mechanicalSubsteps ?? 1,
        packed.soundSpeedScale ?? 0,
        packed.minGasSoundSpeedMPerS ?? 0
      ].join('|')
      : null;
  }

  function scheduleMlsMpmGpuParticleUpload() {
    const packed = scene.getMlsMpmGpuParticleState?.();
    const signature = mlsMpmGpuParticleSignature(packed);
    if (!signature || pendingMlsMpmGpuParticleUploadSignature === signature) return null;
    pendingMlsMpmGpuParticleUploadSignature = signature;
    const promise = scene.refreshMlsMpmGpuParticleBuffers?.({ preferWebGpu: true }).then((upload) => {
      overlay.__mlsMpmGpuParticleUpload = upload;
      return upload;
    }).catch((error) => {
      overlay.__mlsMpmGpuParticleUploadError = error instanceof Error ? error.message : String(error);
      return null;
    }).finally(() => {
      if (pendingMlsMpmGpuParticleUploadSignature === signature) pendingMlsMpmGpuParticleUploadSignature = null;
    });
    return promise;
  }

  function scheduleSphThermalResponseGraphUpload() {
    const promise = scene.refreshSphThermalResponseGraphBuffers?.({ preferWebGpu: true }).then((upload) => {
      overlay.__sphThermalResponseGraphUpload = upload;
      return upload;
    }).catch((error) => {
      overlay.__sphThermalResponseGraphUploadError = error instanceof Error ? error.message : String(error);
      return null;
    });
    return promise || null;
  }

  function scheduleInitialResidentVisualRefreshForBridge({
    generation = particleSyncGeneration,
    residentExecutionPolicy = residentExecutionPolicyFromUrl()
  } = {}) {
    const mode = currentResidentSurfaceDrawDiagnosticMode();
    const particleRenderMode = residentSurfaceDrawParticleRenderMode(mode);
    if (!particleRenderMode) return false;
    const signature = `${generation}|${mode}|${particleRenderMode}`;
    if (pendingInitialResidentVisualRefreshSignature === signature) return true;
    pendingInitialResidentVisualRefreshSignature = signature;
    overlay.__mlsMpmResidentAutoSchedule = {
      schema: 'peercompute.ulg.sph-demo-resident-auto-schedule.v0',
      status: 'resident-initial-visual-refresh-scheduled',
      residentAuto: false,
      residentInitialVisualRefresh: true,
      residentExecutionPolicy,
      generation,
      surfaceDrawDiagnosticMode: mode,
      particleRenderMode,
      updatedAtMs: performance.now()
    };
    publishRenderModeSelection('resident-initial-visual-refresh-scheduled', {
      reason: 'residentAuto disabled; particle bridge still needs an initial visible render state',
      generation,
      surfaceDrawDiagnosticMode: mode,
      particleRenderMode
    });
    updateResidentPerf({
      residentStepsPerSchedule: currentResidentStepsPerSchedule(),
      residentAutoScheduleStatus: 'resident-initial-visual-refresh-scheduled'
    });
    const prereqs = [
      scheduleSphGpuParticleUpload(),
      scheduleMlsMpmGpuParticleUpload(),
      scheduleSphThermalResponseGraphUpload()
    ].filter(Boolean);
    const runRefresh = async () => {
      if (!overlay.isConnected || generation !== particleSyncGeneration) return null;
      overlay.__mlsMpmResidentAutoSchedule = {
        ...(overlay.__mlsMpmResidentAutoSchedule || {}),
        status: 'resident-initial-visual-refresh-pending',
        updatedAtMs: performance.now()
      };
      publishRenderModeSelection('resident-initial-visual-refresh-pending', {
        reason: 'residentAuto disabled; refreshing particle bridge from uploaded initial buffers',
        generation,
        surfaceDrawDiagnosticMode: mode,
        particleRenderMode
      });
      const nativeSurfaceConsumerRefresh = residentSurfaceDrawModeUsesNativeSurfaceConsumer(mode);
      const renderStartMs = performance.now();
      const cadence = residentRenderReadbackDecision({
        forceDue: true,
        forceReason: 'resident-auto-disabled-initial-visual-refresh'
      });
      try {
        const renderState = await scene.refreshSphResidentRenderState?.({
          preferWebGpu: true,
          materialProperties: activeMaterialProperties(),
          gasPressureSummary: currentGasPressureSummary(
            overlay.__sphResidentGasPressureSummary
              || activeViewStateGasPressure
              || (driver?.demo ? gasPressureSummary(driver.demo) : null)
          ),
          residentAuthorityHost: currentResidentAuthorityHostForScene(),
          pressureInterfaceGasCellFieldImport:
            scene.getSphResidentPressureInterfaceState?.()?.pressureInterfaceGasCellFieldImport || null,
          pressureInterfaceGasCellFieldAdmission:
            scene.getSphResidentPressureInterfaceState?.()?.pressureInterfaceGasCellFieldAdmission || null,
          pressureInterfaceGasCellFieldImportStateKey: null,
          renderFieldReadbackMode: nativeSurfaceConsumerRefresh ? SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT : undefined,
          renderRowsReadbackMode: nativeSurfaceConsumerRefresh ? SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT : undefined,
          renderFieldSurfaceSummaryMode:
            (residentSurfaceDrawModeUsesCompactBridge(mode) || nativeSurfaceConsumerRefresh) ? 'skip' : 'auto',
          surfaceDrawDiagnosticMode: mode,
          surfaceDrawDiagnosticModeExplicit: residentSurfaceDrawDiagnosticModeExplicit,
          allowNativeSurfaceExtraction: nativeSurfaceConsumerRefresh ? true : undefined
        });
        if (!overlay.isConnected || generation !== particleSyncGeneration) return renderState;
        residentRenderReadbackCount += 1;
        overlay.__sphResidentRenderState = annotateResidentRenderStateCadence(renderState, {
          ...cadence,
          skipped: false,
          renderReadbackCount: residentRenderReadbackCount,
          skippedCount: residentRenderReadbackSkippedCount
        });
        overlay.__sphResidentSurfaceDraw = scene.getSphResidentSurfaceDraw?.() || null;
        overlay.__sphResidentSurfaceDrawOverlayPolicy = scene.getSphResidentSurfaceDrawOverlayPolicy?.() || null;
        overlay.__sphResidentPressureInterfaceState = scene.getSphResidentPressureInterfaceState?.() || null;
        overlay.__sphResidentRenderStateError = null;
        overlay.__mlsMpmResidentAutoSchedule = {
          ...(overlay.__mlsMpmResidentAutoSchedule || {}),
          status: 'resident-initial-visual-refresh-complete',
          visibleRendererBridge:
            overlay.__sphResidentSurfaceDraw?.visibleRendererBridge
            || renderState?.surfaceDrawVisibleRendererBridge
            || null,
          renderStateStatus: renderState?.status || null,
          completedAtMs: performance.now(),
          updatedAtMs: performance.now()
        };
        updateResidentPerf({
          renderReadbacks: residentRenderReadbackCount,
          skippedRenderReadbacks: residentRenderReadbackSkippedCount,
          effectiveRenderReadbackCadence: 1,
          playbackVisualRefreshForced: true,
          lastRenderReadbackMs: performance.now() - renderStartMs,
          lastRenderReadbackSkipped: false,
          residentAutoScheduleStatus: 'resident-initial-visual-refresh-complete'
        });
        publishRenderModeSelection('resident-initial-visual-refresh-complete', {
          reason: 'residentAuto disabled; particle bridge refreshed from uploaded initial buffers',
          generation,
          surfaceDrawDiagnosticMode: mode,
          particleRenderMode,
          visibleRendererBridge:
            overlay.__sphResidentSurfaceDraw?.visibleRendererBridge
            || renderState?.surfaceDrawVisibleRendererBridge
            || null,
          renderStateStatus: renderState?.status || null
        });
        renderStatus();
        updateWarningBanner();
        return renderState;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        overlay.__sphResidentRenderStateError = message;
        overlay.__mlsMpmResidentAutoSchedule = {
          ...(overlay.__mlsMpmResidentAutoSchedule || {}),
          status: 'resident-initial-visual-refresh-error',
          error: message,
          updatedAtMs: performance.now()
        };
        updateResidentPerf({
          residentAutoScheduleStatus: 'resident-initial-visual-refresh-error'
        });
        publishRenderModeSelection('resident-initial-visual-refresh-error', {
          reason: 'residentAuto disabled initial particle bridge refresh failed',
          generation,
          surfaceDrawDiagnosticMode: mode,
          particleRenderMode,
          error: message
        });
        renderStatus();
        updateWarningBanner();
        return null;
      } finally {
        if (pendingInitialResidentVisualRefreshSignature === signature) {
          pendingInitialResidentVisualRefreshSignature = null;
        }
      }
    };
    if (!prereqs.length) {
      runRefresh();
      return true;
    }
    Promise.allSettled(prereqs).finally(runRefresh);
    return true;
  }

  function scheduleInitialMlsMpmResidentSteps({ generation = particleSyncGeneration } = {}) {
    const residentExecutionPolicy = residentExecutionPolicyFromUrl();
    if (!initialResidentAutoEnabled) {
      const mode = currentResidentSurfaceDrawDiagnosticMode();
      if (residentSurfaceDrawModeNeedsInitialVisualRefresh(mode)) {
        scheduleInitialResidentVisualRefreshForBridge({ generation, residentExecutionPolicy });
        return;
      }
      overlay.__mlsMpmResidentAutoSchedule = {
        schema: 'peercompute.ulg.sph-demo-resident-auto-schedule.v0',
        status: 'disabled-by-url-residentAuto',
        residentAuto: false,
        residentExecutionPolicy,
        generation,
        updatedAtMs: performance.now()
      };
      updateResidentPerf({
        residentStepsPerSchedule: currentResidentStepsPerSchedule(),
        residentAutoScheduleStatus: 'disabled-by-url-residentAuto'
      });
      return;
    }
    overlay.__mlsMpmResidentAutoSchedule = {
      schema: 'peercompute.ulg.sph-demo-resident-auto-schedule.v0',
      status: 'resident-auto-schedule-enabled',
      residentAuto: true,
      residentExecutionPolicy,
      generation,
      updatedAtMs: performance.now()
    };
    const prereqs = [
      scheduleSphGpuParticleUpload(),
      scheduleMlsMpmGpuParticleUpload(),
      scheduleSphThermalResponseGraphUpload()
    ].filter(Boolean);
    updateResidentPerf({
      residentStepsPerSchedule: currentResidentStepsPerSchedule()
    });
    if (!prereqs.length) {
      scheduleMlsMpmResidentSteps({ generation });
      return;
    }
    Promise.allSettled(prereqs).finally(() => {
      if (!overlay.isConnected || generation !== particleSyncGeneration) return;
      scheduleMlsMpmResidentSteps({
        stepCount: currentResidentStepsPerSchedule(),
        generation
      });
    });
  }

  function mlsMpmMechanicsPredictionSignature() {
    const sph = scene.getSphGpuParticleState?.();
    const mls = scene.getMlsMpmGpuParticleState?.();
    const sphSignature = sphGpuParticleSignature(sph);
    const mlsSignature = mlsMpmGpuParticleSignature(mls);
    return sphSignature && mlsSignature ? `${sphSignature}|${mlsSignature}` : null;
  }

  function scheduleMlsMpmMechanicsPrediction() {
    const signature = mlsMpmMechanicsPredictionSignature();
    if (!signature || pendingMlsMpmMechanicsPredictionSignature === signature) return;
    pendingMlsMpmMechanicsPredictionSignature = signature;
    scene.refreshMlsMpmMechanicsPrediction?.({ preferWebGpu: true }).then((execution) => {
      overlay.__mlsMpmMechanicsPrediction = execution;
    }).catch((error) => {
      overlay.__mlsMpmMechanicsPredictionError = error instanceof Error ? error.message : String(error);
    }).finally(() => {
      if (pendingMlsMpmMechanicsPredictionSignature === signature) pendingMlsMpmMechanicsPredictionSignature = null;
    });
  }

  function mlsMpmP2gGridProjectionSignature() {
    const sph = scene.getSphGpuParticleState?.();
    const mls = scene.getMlsMpmGpuParticleState?.();
    const sphSignature = sphGpuParticleSignature(sph);
    const mlsSignature = mlsMpmGpuParticleSignature(mls);
    return sphSignature && mlsSignature ? `${sphSignature}|${mlsSignature}|${sph?.smoothingLengthM ?? 0}` : null;
  }

  function scheduleMlsMpmP2gGridProjection() {
    const signature = mlsMpmP2gGridProjectionSignature();
    if (!signature || pendingMlsMpmP2gGridProjectionSignature === signature) return;
    pendingMlsMpmP2gGridProjectionSignature = signature;
    scene.refreshMlsMpmP2gGridProjection?.({ preferWebGpu: true }).then((execution) => {
      overlay.__mlsMpmP2gGridProjection = execution;
      scheduleMlsMpmGridUpdate();
      renderStatus();
      updateWarningBanner();
    }).catch((error) => {
      overlay.__mlsMpmP2gGridProjectionError = error instanceof Error ? error.message : String(error);
      renderStatus();
      updateWarningBanner();
    }).finally(() => {
      if (pendingMlsMpmP2gGridProjectionSignature === signature) pendingMlsMpmP2gGridProjectionSignature = null;
    });
  }

  function mlsMpmGridUpdateSignature() {
    const p2g = scene.getMlsMpmP2gGridProjection?.();
    const mls = scene.getMlsMpmGpuParticleState?.();
    if (!p2g?.schema) return null;
    return [
      p2g.signature ?? `${p2g.schema}|${p2g.backend}|${p2g.gridNodeCount}|${p2g.dt ?? 0}`,
      mls?.mechanicsDtS ?? p2g.dt ?? 0,
      (mls?.gravityMPerS2 ?? [0, -9.80665, 0]).join(','),
      mls?.gridCflFactor ?? 0.6
    ].join('|');
  }

  function scheduleMlsMpmGridUpdate() {
    const signature = mlsMpmGridUpdateSignature();
    if (!signature || pendingMlsMpmGridUpdateSignature === signature) return;
    pendingMlsMpmGridUpdateSignature = signature;
    scene.refreshMlsMpmGridUpdate?.({ preferWebGpu: true }).then((execution) => {
      overlay.__mlsMpmGridUpdate = execution;
      scheduleMlsMpmG2pReconstruction();
      renderStatus();
      updateWarningBanner();
    }).catch((error) => {
      overlay.__mlsMpmGridUpdateError = error instanceof Error ? error.message : String(error);
      renderStatus();
      updateWarningBanner();
    }).finally(() => {
      if (pendingMlsMpmGridUpdateSignature === signature) pendingMlsMpmGridUpdateSignature = null;
    });
  }

  function mlsMpmG2pReconstructionSignature() {
    const sph = scene.getSphGpuParticleState?.();
    const mls = scene.getMlsMpmGpuParticleState?.();
    const grid = scene.getMlsMpmGridUpdate?.();
    const sphSignature = sphGpuParticleSignature(sph);
    const mlsSignature = mlsMpmGpuParticleSignature(mls);
    if (!sphSignature || !mlsSignature || !grid?.schema) return null;
    return `${sphSignature}|${mlsSignature}|${grid.signature ?? `${grid.schema}|${grid.backend}|${grid.gridNodeCount}|${grid.dt ?? 0}`}`;
  }

  function scheduleMlsMpmG2pReconstruction() {
    const signature = mlsMpmG2pReconstructionSignature();
    if (!signature || pendingMlsMpmG2pReconstructionSignature === signature) return;
    pendingMlsMpmG2pReconstructionSignature = signature;
    scene.refreshMlsMpmG2pReconstruction?.({ preferWebGpu: true }).then((execution) => {
      overlay.__mlsMpmG2pReconstruction = execution;
      renderStatus();
      updateWarningBanner();
    }).catch((error) => {
      overlay.__mlsMpmG2pReconstructionError = error instanceof Error ? error.message : String(error);
      renderStatus();
      updateWarningBanner();
    }).finally(() => {
      if (pendingMlsMpmG2pReconstructionSignature === signature) pendingMlsMpmG2pReconstructionSignature = null;
    });
  }

  function mlsMpmResidentStepsSignature({
    stepCount = currentResidentStepsPerSchedule(),
    readbackMode = SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT,
    residentStageWorkersEnabled = false,
    fuseNoFullResidentMechanicsSequence = false,
    fuseNoFullResidentMechanicsActiveGrid = false,
    activeGridSafetyCells = null,
    measureFusedSequenceQueueFence = false,
    schroederSimulation = false,
    schroederSelectedLevel = 0,
    schroederBaseGridSpacingM = null,
    schroederMinLevel = null,
    schroederMaxLevel = null,
    schroederTileCellCount = null,
    schroederEnablePortableSummary = true,
    schroederEnableActiveNodeIndex = true,
    schroederEnableActiveNodeSortedIndex = false,
    schroederActiveNodeSortedIndexPolicyMode = null,
    schroederLawNeighborTraversalPolicyMode = null,
    schroederLawNeighborCandidateReadbackMode = null,
    schroederEnableCrossLevelCoupling = true,
    schroederEnableLawQueue = true,
    schroederEnableLawNeighborCandidates = true,
    schroederEnableParticleStorageMaterialization = false,
    schroederParticleStorageAdmissionRowBudget = null,
    schroederParticleStorageRequiredCapacity = null,
    schroederParticleStorageCapacityMargin = null,
    schroederParticleStorageFreeListSlotCapacity = null,
    schroederParticleStorageFreeListAvailableSlotCount = null,
    schroederParticleStorageFreeListMaxSlotsPerRow = null
  } = {}) {
    const sph = scene.getSphGpuParticleState?.();
    const mls = scene.getMlsMpmGpuParticleState?.();
    const sphSignature = sphGpuParticleSignature(sph);
    const mlsSignature = mlsMpmGpuParticleSignature(mls);
    if (!sphSignature || !mlsSignature) return null;
    return [
      sphSignature,
      mlsSignature,
      sph?.smoothingLengthM ?? 0,
      mls?.mechanicsDtS ?? 0,
      (mls?.gravityMPerS2 ?? [0, -9.80665, 0]).join(','),
      mls?.gridCflFactor ?? 0.6,
      Math.max(1, Math.round(Number(stepCount) || 1)),
      readbackMode,
      Object.entries(physicalLawGroupsFromControls()).map(([key, enabled]) => `${key}:${enabled ? 1 : 0}`).join(','),
      `stageWorkers=${Boolean(residentStageWorkersEnabled) ? 1 : 0}`,
      `fuseSeq=${Boolean(fuseNoFullResidentMechanicsSequence) ? 1 : 0}`,
      `activeGrid=${Boolean(fuseNoFullResidentMechanicsActiveGrid) ? 1 : 0}`,
      `activeGridSafety=${activeGridSafetyCells ?? 'default'}`,
      `queueFence=${Boolean(measureFusedSequenceQueueFence) ? 1 : 0}`,
      `ss=${Boolean(schroederSimulation) ? 1 : 0}`,
      `ssLevel=${schroederSelectedLevel ?? 0}`,
      `ssBaseDx=${schroederBaseGridSpacingM ?? 'auto'}`,
      `ssMin=${schroederMinLevel ?? 'auto'}`,
      `ssMax=${schroederMaxLevel ?? 'auto'}`,
      `ssTile=${schroederTileCellCount ?? 'auto'}`,
      `ssPortable=${Boolean(schroederEnablePortableSummary) ? 1 : 0}`,
      `ssIndex=${Boolean(schroederEnableActiveNodeIndex) ? 1 : 0}`,
      `ssSorted=${Boolean(schroederEnableActiveNodeSortedIndex) ? 1 : 0}`,
      `ssSortedPolicy=${schroederActiveNodeSortedIndexPolicyMode ?? 'default'}`,
      `ssTraversal=${schroederLawNeighborTraversalPolicyMode ?? 'default'}`,
      `ssCandidateReadback=${schroederLawNeighborCandidateReadbackMode ?? 'default'}`,
      `ssCross=${Boolean(schroederEnableCrossLevelCoupling) ? 1 : 0}`,
      `ssLawQueue=${Boolean(schroederEnableLawQueue) ? 1 : 0}`,
      `ssLawNeighbors=${Boolean(schroederEnableLawNeighborCandidates) ? 1 : 0}`,
      `ssParticleStorage=${Boolean(schroederEnableParticleStorageMaterialization) ? 1 : 0}`,
      `ssParticleStorageRows=${schroederParticleStorageAdmissionRowBudget ?? 'auto'}`,
      `ssParticleStorageCapacity=${schroederParticleStorageRequiredCapacity ?? 'auto'}`,
      `ssParticleStorageMargin=${schroederParticleStorageCapacityMargin ?? 'auto'}`,
      `ssParticleStorageFreeSlotCapacity=${schroederParticleStorageFreeListSlotCapacity ?? 'auto'}`,
      `ssParticleStorageFreeAvailable=${schroederParticleStorageFreeListAvailableSlotCount ?? 'auto'}`,
      `ssParticleStorageFreeSlotsPerRow=${schroederParticleStorageFreeListMaxSlotsPerRow ?? 'auto'}`
    ].join('|');
  }

  function residentGpuContinuationReady(execution = scene.getMlsMpmResidentSteps?.() || overlay.__mlsMpmResidentSteps) {
    return Boolean(
      execution?.schema
      && execution?.backend === 'webgpu'
      && execution?.readbackMode === 'no-full-readback'
      && execution?.continuationAvailable
    );
  }

  function currentPeerComputeRenderOwnershipPolicy() {
    return scene.getPeerComputeRenderOwnershipPolicy?.()
      || scene.scene?.userData?.sphPeerComputeRenderOwnershipPolicy
      || overlay.__sphPeerComputeRenderOwnershipPolicy
      || initialPeerComputeRenderOwnershipPolicy
      || null;
  }

  function currentResidentInterfaceRefreshMode() {
    const policy = currentPeerComputeRenderOwnershipPolicy();
    const rawMode = String(
      policy?.residentInterfaceRefreshMode
      ?? policy?.residentPlaybackCadencePolicy?.interfaceRefreshMode
      ?? ''
    ).trim().toLowerCase();
    if (rawMode === 'pipeline' || rawMode === 'pipelined' || rawMode === 'async') return 'pipelined';
    if (rawMode === 'blocking' || rawMode === 'sync' || rawMode === 'synchronous') return 'blocking';
    if (rawMode === 'disabled' || rawMode === 'off' || rawMode === 'none') return 'disabled';
    return policy?.effectiveMode === 'worker-owned-resident-render-producer'
      ? 'pipelined'
      : 'blocking';
  }

  function currentResidentComputeManagerMode() {
    const policy = currentPeerComputeRenderOwnershipPolicy();
    const rawMode = String(
      policy?.residentComputeManagerMode
      ?? policy?.residentPlaybackCadencePolicy?.computeManagerMode
      ?? ''
    ).trim().toLowerCase();
    if (
      rawMode === 'direct'
      || rawMode === 'inline'
      || rawMode === 'local'
      || rawMode === 'same-device'
      || rawMode === 'same-thread'
      || rawMode === 'resident-direct'
    ) {
      return 'direct';
    }
    if (
      rawMode === 'compute-manager'
      || rawMode === 'computemanager'
      || rawMode === 'peercompute'
      || rawMode === 'peer-compute'
      || rawMode === 'task'
      || rawMode === 'task-submit'
      || rawMode === 'task-submission'
      || rawMode === 'state-manager'
    ) {
      return 'compute-manager';
    }
    return 'compute-manager';
  }

  function currentResidentStepsPerSchedule() {
    let baseCount = RESIDENT_STEPS_PER_SCHEDULE_FALLBACK;
    const candidates = [
      scene.getMlsMpmGpuParticleState?.()?.mechanicalSubsteps,
      activeViewState?.mlsMpmGpuParticleState?.mechanicalSubsteps,
      activeViewState?.gpuMechanics?.mechanicalSubsteps,
      driver?.demo?.gpuMechanics?.mechanicalSubsteps,
      RESIDENT_STEPS_PER_SCHEDULE_FALLBACK
    ];
    for (const candidate of candidates) {
      const count = Number(candidate);
      if (Number.isFinite(count) && count > 0) {
        baseCount = Math.max(1, Math.min(RESIDENT_STEPS_PER_SCHEDULE_MAX, Math.round(count)));
        break;
      }
    }
    const playbackPolicy = currentPeerComputeRenderOwnershipPolicy();
    const explicitStepCount = positiveIntegerUrlParam(
      playbackPolicy?.residentStepsPerScheduleOverride
    );
    if (explicitStepCount != null) {
      return Math.max(1, Math.min(RESIDENT_PARTICLE_BRIDGE_STEPS_PER_SCHEDULE_MAX, explicitStepCount));
    }
    const particleBridgePlayback = residentSurfaceDrawModeUsesParticleBridge(
      currentResidentSurfaceDrawDiagnosticMode()
    );
    if (!particleBridgePlayback) return baseCount;
    const dtCandidates = [
      scene.getMlsMpmGpuParticleState?.()?.mechanicsDtS,
      activeViewState?.mlsMpmGpuParticleState?.mechanicsDtS,
      activeViewState?.gpuMechanics?.dt,
      driver?.demo?.gpuMechanics?.dt
    ];
    const dt = dtCandidates.map(Number).find((value) => Number.isFinite(value) && value > 0);
    if (!Number.isFinite(dt) || dt <= 0) return baseCount;
    const policyTargetBatchTimeS = positiveNumberUrlParam(
      playbackPolicy?.residentParticleBridgeTargetBatchTimeS
    );
    const targetBatchTimeS = policyTargetBatchTimeS ?? RESIDENT_PARTICLE_BRIDGE_TARGET_BATCH_TIME_S;
    const targetCount = Math.ceil(targetBatchTimeS / dt);
    const throughputCount = Math.max(
      baseCount,
      Math.min(RESIDENT_PARTICLE_BRIDGE_STEPS_PER_SCHEDULE_MAX, targetCount)
    );
    const policyMax = positiveIntegerUrlParam(playbackPolicy?.residentStepsPerScheduleMax);
    const maxSteps = policyMax ?? RESIDENT_PARTICLE_BRIDGE_STEPS_PER_SCHEDULE_MAX;
    return Math.max(1, Math.min(maxSteps, throughputCount));
  }

  function currentResidentTargetSubsteps() {
    const candidates = [
      scene.getMlsMpmGpuParticleState?.()?.mechanicalSubsteps,
      activeViewState?.mlsMpmGpuParticleState?.mechanicalSubsteps,
      activeViewState?.gpuMechanics?.mechanicalSubsteps,
      driver?.demo?.gpuMechanics?.mechanicalSubsteps,
      currentResidentStepsPerSchedule()
    ];
    for (const candidate of candidates) {
      const count = Number(candidate);
      if (Number.isFinite(count) && count > 0) return Math.max(1, Math.round(count));
    }
    return currentResidentStepsPerSchedule();
  }

  function accumulateResidentSubvisibleMotion(motion) {
    const maxDx = finiteNumberOrNull(motion?.maxDisplacementM);
    if (motion?.status === 'motion-below-visible-threshold' && maxDx != null && maxDx > 0) {
      residentAccumulatedSubvisibleMotionM += maxDx;
      residentSubvisibleMotionBurstCount += 1;
    } else if (motion?.status === 'motion-proven') {
      residentAccumulatedSubvisibleMotionM = Math.max(0, maxDx ?? 0);
      residentSubvisibleMotionBurstCount = 0;
    }
    return {
      accumulatedSubvisibleMotionM: residentAccumulatedSubvisibleMotionM,
      subvisibleMotionBurstCount: residentSubvisibleMotionBurstCount,
      accumulatedMotionVisible: motion?.status === 'motion-below-visible-threshold'
        && residentAccumulatedSubvisibleMotionM >= (motion?.visibleThresholdM ?? Number.POSITIVE_INFINITY)
    };
  }

  async function buildDefaultRemoteResidentTaskGraph(context = {}) {
    const rawState = driver?.demo?.state?.particles ? driver.demo.state : null;
    if (!rawState) return null;
    const optionSource = typeof remoteResidentTaskGraphOptions === 'function'
      ? await remoteResidentTaskGraphOptions({ ...context, state: rawState })
      : (remoteResidentTaskGraphOptions || {});
    return buildUlgSphMlsMpmRemoteSeedTaskGraph({
      ...optionSource,
      state: optionSource?.state || rawState,
      materialProperties: optionSource?.materialProperties || activeMaterialProperties(),
      extraCacheValues: {
        source: 'mounted-sph-phase-resident-scheduler',
        signature: context.signature || null,
        scheduleToken: context.scheduleToken || null,
        stepCount: context.stepCount || null,
        readbackMode: context.readbackMode || null,
        ...(optionSource?.extraCacheValues && typeof optionSource.extraCacheValues === 'object'
          ? optionSource.extraCacheValues
          : {})
      }
    });
  }

  async function refreshResidentInterfacesForExecution({
    execution,
    residentGasPressureForRefresh,
    residentProductMassForRefresh,
    residentReactionSummaryForRefresh,
    residentAuthorityHostForSchedule,
    generation,
    scheduleToken,
    mode,
    sourceCadence = 'resident-step-completed'
  }) {
    const refreshStartMs = performance.now();
    const reportBase = {
      schema: 'peercompute.ulg.sph-demo-resident-interface-refresh.v0',
      status: 'resident-interface-refresh-pending',
      mode,
      scheduleToken,
      generation,
      sourceCadence,
      startedAtMs: refreshStartMs,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
    overlay.__sphResidentInterfaceRefresh = reportBase;
    publishResidentStageOrderTrace({
      status: 'resident-interface-refresh-pending',
      mode,
      scheduleToken,
      generation,
      sourceCadence
    });
    try {
      const materialStartMs = performance.now();
      const materialInterfaceState = await scene.refreshSphResidentMaterialInterfaceState?.({
        preferWebGpu: true,
        residentSteps: execution,
        materialProperties: activeMaterialProperties(),
        gasPressureSummary: residentGasPressureForRefresh,
        source: 'resident-physics-loop-material-interface-refresh',
        sourceCadence
      });
      const materialMs = performance.now() - materialStartMs;
      const pressureStartMs = performance.now();
      const pressureInterfaceState = await scene.refreshSphResidentPressureInterfaceState?.({
        preferWebGpu: true,
        gasPressureSummary: residentGasPressureForRefresh,
        residentProductMass: residentProductMassForRefresh,
        reactionSummary: residentReactionSummaryForRefresh,
        reactionTable: scene.getSphReactionTable?.() || null,
        residentAuthorityHost: residentAuthorityHostForSchedule,
        pressureInterfaceGasCellFieldImport: scene.getSphResidentPressureInterfaceState?.()?.pressureInterfaceGasCellFieldImport || null,
        pressureInterfaceGasCellFieldAdmission: scene.getSphResidentPressureInterfaceState?.()?.pressureInterfaceGasCellFieldAdmission || null,
        pressureInterfaceGasCellFieldImportStateKey: execution?.computeManagerTask?.stateKey || null,
        pressureInterfaceGasCellFieldImportSourceTaskId: execution?.computeManagerTask?.acceptedTaskId
          || execution?.commitDelta?.taskId
          || null,
        source: 'resident-physics-loop-pressure-interface-refresh',
        sourceCadence
      });
      const pressureMs = performance.now() - pressureStartMs;
      const totalMs = performance.now() - refreshStartMs;
      if (generation === particleSyncGeneration && overlay.isConnected) {
        overlay.__sphResidentMaterialInterfaceState = materialInterfaceState;
        overlay.__sphResidentPressureInterfaceState = pressureInterfaceState;
        updateResidentGasPressureSummary(overlay.__mlsMpmResidentStep);
        overlay.__sphResidentMaterialInterfaceStateError = null;
        overlay.__sphResidentPressureInterfaceStateError = null;
      }
      const report = {
        ...reportBase,
        status: generation === particleSyncGeneration
          ? 'resident-interface-refresh-complete'
          : 'resident-interface-refresh-stale',
        materialInterfaceStatus: materialInterfaceState?.status ?? null,
        pressureInterfaceStatus: pressureInterfaceState?.status ?? null,
        materialMs,
        pressureMs,
        totalMs,
        completedAtMs: performance.now()
      };
      overlay.__sphResidentInterfaceRefresh = report;
      updateResidentPerf({
        residentInterfaceRefreshes: (residentPerf.residentInterfaceRefreshes || 0) + 1,
        residentInterfaceRefreshMode: mode,
        residentInterfaceRefreshPending: mode === 'pipelined'
          && pendingResidentInterfaceRefreshPromise != null,
        lastResidentMaterialInterfaceRefreshMs: materialMs,
        lastResidentPressureInterfaceRefreshMs: pressureMs,
        lastResidentInterfaceRefreshMs: totalMs
      });
      publishResidentStageOrderTrace({
        status: report.status,
        mode,
        scheduleToken,
        generation,
        materialMs,
        pressureMs,
        totalMs,
        materialInterfaceStatus: report.materialInterfaceStatus,
        pressureInterfaceStatus: report.pressureInterfaceStatus
      });
      return report;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      overlay.__sphResidentMaterialInterfaceStateError = message;
      overlay.__sphResidentPressureInterfaceStateError = message;
      const report = {
        ...reportBase,
        status: 'resident-interface-refresh-error',
        error: message,
        totalMs: performance.now() - refreshStartMs,
        completedAtMs: performance.now()
      };
      overlay.__sphResidentInterfaceRefresh = report;
      updateResidentPerf({
        residentInterfaceRefreshMode: mode,
        residentInterfaceRefreshPending: mode === 'pipelined'
          && pendingResidentInterfaceRefreshPromise != null,
        lastResidentInterfaceRefreshMs: report.totalMs
      });
      publishResidentStageOrderTrace({
        status: 'resident-interface-refresh-error',
        mode,
        scheduleToken,
        generation,
        error: message,
        totalMs: report.totalMs
      });
      return report;
    }
  }

  function startResidentInterfaceRefresh(context) {
    const mode = currentResidentInterfaceRefreshMode();
    const policy = currentPeerComputeRenderOwnershipPolicy();
    const warmupFrames = Math.max(
      0,
      Math.round(Number(
        policy?.residentInterfaceRefreshWarmupFrames
          ?? policy?.residentPlaybackCadencePolicy?.interfaceRefreshWarmupFrames
          ?? 0
      ) || 0)
    );
    if (mode === 'disabled') {
      overlay.__sphResidentInterfaceRefresh = {
        schema: 'peercompute.ulg.sph-demo-resident-interface-refresh.v0',
        status: 'resident-interface-refresh-disabled',
        mode,
        scheduleToken: context.scheduleToken,
        generation: context.generation,
        updatedAtMs: performance.now(),
        scientificValidation: false,
        sphValidation: false,
        phaseChangeValidation: false,
        fullPhysicsValidation: false
      };
      updateResidentPerf({
        residentInterfaceRefreshMode: mode,
        residentInterfaceRefreshWarmupFrames: warmupFrames,
        residentInterfaceRefreshPending: false
      });
      return null;
    }
    if (mode === 'blocking') {
      return refreshResidentInterfacesForExecution({
        ...context,
        mode
      });
    }
    if (pendingResidentInterfaceRefreshPromise) {
      overlay.__sphResidentInterfaceRefresh = {
        schema: 'peercompute.ulg.sph-demo-resident-interface-refresh.v0',
        status: 'resident-interface-refresh-coalesced-pending',
        mode,
        scheduleToken: context.scheduleToken,
        generation: context.generation,
        reason: 'previous pipelined material/pressure interface refresh is still running',
        updatedAtMs: performance.now(),
        scientificValidation: false,
        sphValidation: false,
        phaseChangeValidation: false,
        fullPhysicsValidation: false
      };
      updateResidentPerf({
        skippedResidentInterfaceRefreshes: (residentPerf.skippedResidentInterfaceRefreshes || 0) + 1,
        residentInterfaceRefreshMode: mode,
        residentInterfaceRefreshPending: true
      });
      return pendingResidentInterfaceRefreshPromise;
    }
    const residentSubmissionCount = Math.max(0, Math.round(Number(residentPerf.residentSubmissions) || 0));
    if (mode === 'pipelined' && warmupFrames > 0 && residentSubmissionCount < warmupFrames) {
      overlay.__sphResidentInterfaceRefresh = {
        schema: 'peercompute.ulg.sph-demo-resident-interface-refresh.v0',
        status: 'resident-interface-refresh-deferred-for-presentation-warmup',
        mode,
        scheduleToken: context.scheduleToken,
        generation: context.generation,
        reason: 'initial worker-owned presentation frames are prioritized before cold material/pressure interface refresh',
        residentSubmissionCount,
        residentInterfaceRefreshWarmupFrames: warmupFrames,
        updatedAtMs: performance.now(),
        scientificValidation: false,
        sphValidation: false,
        phaseChangeValidation: false,
        fullPhysicsValidation: false
      };
      updateResidentPerf({
        deferredResidentInterfaceRefreshes: (residentPerf.deferredResidentInterfaceRefreshes || 0) + 1,
        residentInterfaceRefreshMode: mode,
        residentInterfaceRefreshWarmupFrames: warmupFrames,
        residentInterfaceRefreshPending: false
      });
      publishResidentStageOrderTrace({
        status: 'resident-interface-refresh-deferred-for-presentation-warmup',
        mode,
        scheduleToken: context.scheduleToken,
        generation: context.generation,
        residentSubmissionCount,
        residentInterfaceRefreshWarmupFrames: warmupFrames
      });
      return null;
    }
    const token = residentInterfaceRefreshToken + 1;
    residentInterfaceRefreshToken = token;
    let promise = null;
    promise = refreshResidentInterfacesForExecution({
      ...context,
      mode,
      sourceCadence: 'resident-step-completed-pipelined'
    }).finally(() => {
      if (pendingResidentInterfaceRefreshPromise === promise) {
        pendingResidentInterfaceRefreshPromise = null;
        updateResidentPerf({
          residentInterfaceRefreshMode: currentResidentInterfaceRefreshMode(),
          residentInterfaceRefreshPending: false
        });
      }
    });
    pendingResidentInterfaceRefreshPromise = promise;
    updateResidentPerf({
      residentInterfaceRefreshMode: mode,
      residentInterfaceRefreshWarmupFrames: warmupFrames,
      residentInterfaceRefreshPending: true,
      residentInterfaceRefreshToken: token
    });
    return promise;
  }

  function mountedMechanicsStageWorkerLaneReport(status, extra = {}) {
    return {
      schema: 'peercompute.ulg.sph-demo-mounted-mechanics-stage-worker-lane.v0',
      enabled: initialResidentStageWorkersEnabled,
      status,
      source: 'mounted-sph-phase-resident-scheduler',
      updatedAtMs: performance.now(),
      ...extra
    };
  }

  function mountedWorkerStringList(values = []) {
    const source = Array.isArray(values) ? values : [];
    return [...new Set(source.map((value) => String(value ?? '').trim()).filter(Boolean))];
  }

  function mountedWorkerPositiveInteger(values = [], fallback = 0) {
    for (const value of values) {
      const number = Math.trunc(Number(value));
      if (Number.isFinite(number) && number > 0) return number;
    }
    return Math.max(0, Math.trunc(Number(fallback) || 0));
  }

  function mountedWorkerGasPressureRefs(importDescriptor = null, fieldName) {
    if (!importDescriptor || typeof importDescriptor !== 'object') return [];
    return mountedWorkerStringList([
      ...(importDescriptor[fieldName] || []),
      ...(importDescriptor.retainedGasCellFieldSource?.[fieldName] || []),
      ...(importDescriptor.pressureInterfaceGasCellFieldAdmission?.[fieldName] || []),
      ...(importDescriptor.gasCellFieldAdmission?.[fieldName] || []),
      ...(importDescriptor.admission?.[fieldName] || [])
    ]);
  }

  function mountedWorkerPressureInterfaceGasCellImportDescriptor() {
    const pressureState = scene.getSphResidentPressureInterfaceState?.()
      || overlay.__sphResidentPressureInterfaceState
      || null;
    const publication = pressureState?.pressureInterfaceGasCellFieldImportPublication
      || scene.userData?.sphPressureInterfaceGasCellFieldImportPublication
      || null;
    const source = pressureState?.pressureInterfaceGasCellFieldImport
      || publication?.pressureInterfaceGasCellFieldImport
      || scene.userData?.sphPressureInterfaceGasCellFieldImport
      || null;
    if (!source || typeof source !== 'object') return null;
    const retainedSource = source.retainedGasCellFieldSource
      || source.pressureInterfaceGasCellFieldAdmission?.retainedGasCellFieldSource
      || source.admission?.retainedGasCellFieldSource
      || null;
    const admission = source.pressureInterfaceGasCellFieldAdmission
      || source.gasCellFieldAdmission
      || source.admission
      || null;
    const workerRetainedGasPressureBufferRefs =
      mountedWorkerGasPressureRefs(source, 'workerRetainedGasPressureBufferRefs');
    const retainedGasPressureBufferRefs =
      mountedWorkerGasPressureRefs(source, 'retainedGasPressureBufferRefs');
    const rowCount = mountedWorkerPositiveInteger([
      source.pressureInterfaceGasPressureCellRowCount,
      source.gasPressureCellRowCount,
      publication?.pressureInterfaceGasPressureCellRowCount,
      retainedSource?.pressureInterfaceGasPressureCellRowCount
    ]);
    const rowStrideFloats = mountedWorkerPositiveInteger([
      source.pressureInterfaceGasPressureCellRowStrideFloats,
      source.gasPressureCellRowStrideFloats,
      publication?.pressureInterfaceGasPressureCellRowStrideFloats,
      retainedSource?.pressureInterfaceGasPressureCellRowStrideFloats
    ], 12);
    const rowByteLength = mountedWorkerPositiveInteger([
      source.pressureInterfaceGasPressureCellRowByteLength,
      source.gasPressureCellRowByteLength,
      publication?.pressureInterfaceGasPressureCellRowByteLength,
      retainedSource?.pressureInterfaceGasPressureCellRowByteLength
    ], rowCount * rowStrideFloats * Float32Array.BYTES_PER_ELEMENT);
    const hasRefs = workerRetainedGasPressureBufferRefs.length > 0 || retainedGasPressureBufferRefs.length > 0;
    const admissionApproved = admission?.schema === 'peercompute.ulg.pressure-interface-gas-cell-field-admission.v0'
      && admission?.status === 'pressure-interface-gas-cell-field-consumption-approved'
      && admission?.gasCellFieldConsumptionApproved === true;
    const sourceReady = source.status === 'pressure-interface-gas-cell-field-import-ready'
      || source.pressureInterfaceImportReady === true
      || publication?.pressureInterfaceGasCellFieldImportReady === true;
    if (!sourceReady || !admissionApproved || !hasRefs || rowCount <= 0 || rowByteLength <= 0) {
      return null;
    }
    const retainedGasCellFieldSource = retainedSource
      ? {
          schema: retainedSource.schema || 'peercompute.ulg.pressure-interface-retained-gas-cell-field-source.v0',
          status: retainedSource.status || 'pressure-interface-retained-gas-cell-field-source-ready',
          sourceHotBufferKey:
            retainedSource.sourceHotBufferKey
              || source.sourceHotBufferKey
              || publication?.hotBufferKey
              || null,
          sourceTaskId: retainedSource.sourceTaskId || source.sourceTaskId || publication?.sourceTaskId || null,
          sourceStage: retainedSource.sourceStage || source.sourceStage || publication?.sourceStage || null,
          workerRetainedGasPressureBufferRefs,
          retainedGasPressureBufferRefs,
          pressureInterfaceGasPressureCellRowCount: rowCount,
          pressureInterfaceGasPressureCellRowStrideFloats: rowStrideFloats,
          pressureInterfaceGasPressureCellRowByteLength: rowByteLength,
          pressureInterfaceGasPressureCellRowsBufferRetained: true,
          pressureFieldMode: retainedSource.pressureFieldMode || source.pressureFieldMode || null,
          pressureFieldResolution: retainedSource.pressureFieldResolution || source.pressureFieldResolution || null,
          localPressureGradientReady: true,
          localPressureGradientStatus:
            retainedSource.localPressureGradientStatus
              || source.localPressureGradientStatus
              || 'retained-gpu-gas-cell-rows-ready-cpu-snapshot-not-read',
          sourceFamilies: mountedWorkerStringList(retainedSource.sourceFamilies || ['resident-gas-pressure']),
          stateManagerAdmissionRequired: true,
          authoritativeStateMutation: false
        }
      : null;
    return {
      schema: 'peercompute.ulg.pressure-interface-gas-cell-field-import.v0',
      status: 'pressure-interface-gas-cell-field-import-ready',
      sourceSchema: source.sourceSchema || source.schema || null,
      sourceHotBufferKey: source.sourceHotBufferKey || publication?.hotBufferKey || null,
      sourceTaskId: source.sourceTaskId || publication?.sourceTaskId || null,
      sourceNodeId: source.sourceNodeId || publication?.sourceNodeId || null,
      sourceStage: source.sourceStage || publication?.sourceStage || null,
      retainedGasPressureBufferRefs,
      workerRetainedGasPressureBufferRefs,
      pressureInterfaceGasPressureCellRowCount: rowCount,
      pressureInterfaceGasPressureCellRowStrideFloats: rowStrideFloats,
      pressureInterfaceGasPressureCellRowByteLength: rowByteLength,
      pressureInterfaceGasPressureCellRowsBufferRetained: true,
      pressureFieldMode: source.pressureFieldMode || retainedSource?.pressureFieldMode || null,
      pressureFieldResolution: source.pressureFieldResolution || retainedSource?.pressureFieldResolution || null,
      localPressureGradientStatus:
        source.localPressureGradientStatus
          || retainedSource?.localPressureGradientStatus
          || 'retained-gpu-gas-cell-rows-ready-cpu-snapshot-not-read',
      pressureInterfaceGasCellFieldAdmission: {
        schema: admission.schema,
        status: admission.status,
        gasCellFieldConsumptionApproved: true,
        sourceHotBufferKey: admission.sourceHotBufferKey || source.sourceHotBufferKey || publication?.hotBufferKey || null,
        sourceTaskId: admission.sourceTaskId || source.sourceTaskId || null,
        sourceStage: admission.sourceStage || source.sourceStage || null,
        retainedGasPressureBufferRefs,
        workerRetainedGasPressureBufferRefs,
        retainedGasCellFieldSource,
        pressureInterfaceGasPressureCellRowCount: rowCount,
        pressureInterfaceGasPressureCellRowStrideFloats: rowStrideFloats,
        pressureInterfaceGasPressureCellRowByteLength: rowByteLength,
        stateManagerAdmitted: true,
        authoritativeStateMutation: false
      },
      retainedGasCellFieldSource,
      stateManagerAdmissionRequired: true,
      authoritativeStateMutation: false
    };
  }

  function mountedPressureInterfaceGasCellImportTelemetry() {
    const pressureState = scene.getSphResidentPressureInterfaceState?.()
      || overlay.__sphResidentPressureInterfaceState
      || null;
    const publication = pressureState?.pressureInterfaceGasCellFieldImportPublication
      || scene.userData?.sphPressureInterfaceGasCellFieldImportPublication
      || null;
    const importDescriptor = pressureState?.pressureInterfaceGasCellFieldImport
      || publication?.pressureInterfaceGasCellFieldImport
      || scene.userData?.sphPressureInterfaceGasCellFieldImport
      || null;
    const rowCount = Math.max(0, Number(
      importDescriptor?.pressureInterfaceGasPressureCellRowCount
        ?? importDescriptor?.gasPressureCellRowCount
        ?? publication?.pressureInterfaceGasPressureCellRowCount
        ?? 0
    ) || 0);
    const rowByteLength = Math.max(0, Number(
      importDescriptor?.pressureInterfaceGasPressureCellRowByteLength
        ?? importDescriptor?.gasPressureCellRowByteLength
        ?? publication?.pressureInterfaceGasPressureCellRowByteLength
        ?? 0
    ) || 0);
    const importReady = pressureState?.pressureInterfaceGasCellFieldImportReady === true
      || publication?.pressureInterfaceGasCellFieldImportReady === true
      || importDescriptor?.status === 'pressure-interface-gas-cell-field-import-ready'
      || importDescriptor?.pressureInterfaceImportReady === true;
    return {
      pressureInterfaceGasCellFieldImportAvailable: importReady,
      pressureInterfaceGasCellFieldImportSchema: importDescriptor?.schema || publication?.pressureInterfaceGasCellFieldImportSchema || null,
      pressureInterfaceGasCellFieldImportStatus: importDescriptor?.status || publication?.pressureInterfaceGasCellFieldImportStatus || null,
      pressureInterfaceGasCellFieldImportSourceHotBufferKey:
        importDescriptor?.sourceHotBufferKey
          || publication?.pressureInterfaceGasCellFieldImportSourceHotBufferKey
          || publication?.hotBufferKey
          || null,
      pressureInterfaceGasPressureCellRowCount: rowCount,
      pressureInterfaceGasPressureCellRowByteLength: rowByteLength,
      pressureInterfaceGasPressureCellRowsBufferRetained:
        importDescriptor?.pressureInterfaceGasPressureCellRowsBufferRetained === true
        || importDescriptor?.gasPressureCellRowsBufferRetained === true,
      pressureInterfaceGasCellFieldImportRetainedGasPressureCellsBuffer:
        Boolean(
          importDescriptor?.retainedGasPressureCellsBuffer
            || importDescriptor?.gasPressureCellsBuffer
            || importDescriptor?.pressureInterfaceGasPressureCellsBuffer
        ),
      schroederPressureInterfaceGasCellFieldImportPromotionStatus:
        pressureState?.schroederPressureInterfaceGasCellFieldImportPromotionStatus
          || scene.userData?.sphPressureInterfaceGasCellFieldImportPublication?.status
          || null,
      mountedWorkerLanePressureInterfaceGasCellImportTransferStatus: importReady
        ? 'main-thread-retained-import-observed-not-posted-to-worker-lane'
        : 'no-main-thread-retained-import'
    };
  }

  function currentSchroederAdoptedParticleStoragePublication(sourceExecution = null) {
    const sceneUserData = scene?.scene?.userData || scene?.userData || {};
    return sourceExecution?.schroederAdoptedParticleStoragePublication
      || sourceExecution?.finalStep?.schroederAdoptedParticleStoragePublication
      || sceneUserData.mlsMpmResidentSchroederAdoptedParticleStoragePublication
      || sceneUserData.schroederAdoptedParticleStoragePublication
      || overlay.__sphSchroederAdoptedParticleStoragePublication
      || null;
  }

  function schroederAdoptedParticleStorageTelemetry(sourceExecution = null, chain = null) {
    const publication = currentSchroederAdoptedParticleStoragePublication(sourceExecution);
    const hotBufferKey =
      publication?.hotBufferKey
      || sourceExecution?.schroederAdoptedParticleStorageContinuationHotBufferKey
      || sourceExecution?.finalStep?.schroederAdoptedParticleStorageContinuationHotBufferKey
      || null;
    const localResolverReady =
      publication?.schroederAdoptedParticleStorageLocalRetainedBufferResolverReady === true
      || publication?.schroederAdoptedParticleStorageLocalRetainedBufferResolver?.ready === true;
    const localResolver =
      publication?.schroederAdoptedParticleStorageLocalRetainedBufferResolver || null;
    const telemetry = {
      schema: 'peercompute.ulg.sph-demo-schroeder-adopted-particle-storage-telemetry.v0',
      status: publication?.status || 'schroeder-adopted-particle-storage-publication-pending',
      publicationAvailable: Boolean(publication),
      publicationStatus: publication?.status || null,
      publicationReason: publication?.reason || null,
      publicationHotBufferKey: hotBufferKey,
      descriptorStatus:
        publication?.descriptorStatus
        || publication?.schroederAdoptedParticleStorageDescriptor?.status
        || null,
      descriptorReady:
        publication?.descriptorReady === true
        || publication?.schroederAdoptedParticleStorageDescriptor?.ready === true,
      adopted:
        publication?.adopted === true
        || publication?.schroederAdoptedParticleStorageDescriptor?.adopted === true,
      // Adoption status straight off the executed step: distinguishes guard
      // skips (oscillation/no-topology-change/torn-group) from a storage
      // chain that never ran, which the publication skip reason cannot.
      adoptionStatus:
        sourceExecution?.finalStep?.schroederParticleStorageAdoptionStatus || null,
      localResolverStatus:
        publication?.schroederAdoptedParticleStorageLocalRetainedBufferResolverStatus
        || publication?.schroederAdoptedParticleStorageLocalRetainedBufferResolver?.status
        || null,
      localResolverReady,
      localResolverResolvedRefCount:
        publication?.schroederAdoptedParticleStorageLocalRetainedBufferResolvedRefCount
        ?? localResolver?.resolvedRetainedBufferRefCount
        ?? 0,
      continuationRequested: Boolean(hotBufferKey && localResolverReady),
      continuationScheduleStatus:
        chain?.schroederAdoptedParticleStorageContinuationScheduleStatus || null,
      workerRematerializationScheduled:
        chain?.schroederAdoptedParticleStorageWorkerRematerializationScheduled === true,
      workerRematerializationStatus:
        chain?.schroederAdoptedParticleStorageWorkerRematerializationStatus || null,
      workerRematerializationApplied:
        chain?.schroederAdoptedParticleStorageWorkerRematerializationApplied === true,
      continuationSourceHotBufferKey:
        chain?.schroederAdoptedParticleStorageContinuationSourceHotBufferKey || null,
      stageLocalResolverStatus:
        chain?.schroederAdoptedParticleStorageLocalResolverStatus || null,
      stageLocalResolverReady:
        chain?.schroederAdoptedParticleStorageLocalResolverReady === true,
      rawGpuBufferPeerComputeTransfer:
        publication?.rawGpuBufferTransferDetected === true
        || publication?.rawGpuBufferPeerComputeTransfer === true
        || chain?.schroederAdoptedParticleStorageLocalResolverRawGpuBufferPeerComputeTransfer === true,
      updatedAtMs: performance.now()
    };
    overlay.__sphSchroederAdoptedParticleStoragePublication = publication;
    overlay.__sphSchroederAdoptedParticleStorage = telemetry;
    if (scene?.scene?.userData) {
      scene.scene.userData.sphSchroederAdoptedParticleStorage = telemetry;
    }
    return telemetry;
  }

  function disposeMountedMechanicsStageWorkerRunner(reason = 'dispose') {
    try {
      mountedMechanicsStageWorkerRunner?.dispose?.();
    } catch {}
    mountedMechanicsStageWorkerRunner = null;
    mountedMechanicsStageWorkerRunnerHost = null;
    overlay.__sphMountedMechanicsStageWorkerRunnerStatus = {
      schema: 'peercompute.ulg.sph-demo-mounted-mechanics-stage-worker-runner.v0',
      status: 'disposed',
      reason,
      updatedAtMs: performance.now()
    };
  }

  function mountedMechanicsStageWorkerRunnerForHost(resolvedHost, sequence) {
    if (!mountedMechanicsStageWorkerRunner || mountedMechanicsStageWorkerRunnerHost !== resolvedHost) {
      disposeMountedMechanicsStageWorkerRunner(
        mountedMechanicsStageWorkerRunner ? 'host-changed' : 'initial-create'
      );
      mountedMechanicsStageWorkerRunner = resolvedHost.createUlgMechanicsResidentStageWorkerRunner({
        timeoutMs: 60000,
        requestIdPrefix: 'ulg-mounted-mechanics-stage-worker'
      });
      mountedMechanicsStageWorkerRunnerHost = resolvedHost;
      overlay.__sphMountedMechanicsStageWorkerRunnerStatus = {
        schema: 'peercompute.ulg.sph-demo-mounted-mechanics-stage-worker-runner.v0',
        status: 'ready',
        sequence,
        reusedAcrossSchedules: true,
        updatedAtMs: performance.now()
      };
    }
    return mountedMechanicsStageWorkerRunner;
  }

  function publishMountedMechanicsStageWorkerLane(status, extra = {}) {
    const report = mountedMechanicsStageWorkerLaneReport(status, extra);
    overlay.__sphMountedMechanicsStageWorkerLane = report;
    return report;
  }

  function maybeRunMountedMechanicsStageWorkerLane({
    host,
    signature,
    scheduleToken,
    generation,
    sourceExecution = null
  } = {}) {
    if (!initialResidentStageWorkersEnabled) return null;
    if (pendingMountedMechanicsStageWorkerLanePromise) {
      publishMountedMechanicsStageWorkerLane('worker-stage-lane-joining-pending-run', {
        signature,
        scheduleToken,
        generation
      });
      return pendingMountedMechanicsStageWorkerLanePromise;
    }
    const resolvedHost = host
      || peerComputeResidentAuthorityHost
      || residentAuthorityHost
      || runtime?.residentAuthorityHost
      || globalThis.__ulgResidentAuthorityHost
      || null;
    const adoptedStoragePendingTelemetry =
      schroederAdoptedParticleStorageTelemetry(sourceExecution);
    const sequence = mountedMechanicsStageWorkerLaneSequence + 1;
    mountedMechanicsStageWorkerLaneSequence = sequence;
    publishMountedMechanicsStageWorkerLane('worker-stage-lane-pending', {
      signature,
      scheduleToken,
      generation,
      sequence,
      workerCapabilityStatus: resolvedHost?.workerCapability?.status || null,
      schroederAdoptedParticleStoragePublicationStatus:
        adoptedStoragePendingTelemetry.publicationStatus,
      schroederAdoptedParticleStoragePublicationHotBufferKey:
        adoptedStoragePendingTelemetry.publicationHotBufferKey,
      schroederAdoptedParticleStorageLocalResolverReady:
        adoptedStoragePendingTelemetry.localResolverReady,
      schroederAdoptedParticleStorageContinuationRequested:
        adoptedStoragePendingTelemetry.continuationRequested,
      ...mountedPressureInterfaceGasCellImportTelemetry()
    });
    pendingMountedMechanicsStageWorkerLanePromise = (async () => {
      if (!resolvedHost || typeof resolvedHost.runMechanicsStageTaskChain !== 'function') {
        return publishMountedMechanicsStageWorkerLane('worker-stage-lane-blocked', {
          signature,
          scheduleToken,
          generation,
          sequence,
          blocker: 'resident-authority-host-stage-chain-required'
        });
      }
      if (typeof resolvedHost.createUlgMechanicsResidentStageWorkerRunner !== 'function') {
        return publishMountedMechanicsStageWorkerLane('worker-stage-lane-blocked', {
          signature,
          scheduleToken,
          generation,
          sequence,
          blocker: 'mechanics-stage-worker-runner-factory-required'
        });
      }
      if (typeof resolvedHost.publishWorkerRetainedMechanicsStageOutput !== 'function') {
        return publishMountedMechanicsStageWorkerLane('worker-stage-lane-blocked', {
          signature,
          scheduleToken,
          generation,
          sequence,
          blocker: 'worker-retained-publication-authority-required'
        });
      }
      const sphParticleState = scene.getSphGpuParticleState?.()
        || sourceExecution?.finalStep?.nextSphParticleState
        || null;
      const mlsMpmParticleState = scene.getMlsMpmGpuParticleState?.()
        || sourceExecution?.finalStep?.nextMlsMpmParticleState
        || null;
      if (!sphParticleState?.schema || !mlsMpmParticleState?.schema) {
        return publishMountedMechanicsStageWorkerLane('worker-stage-lane-blocked', {
          signature,
          scheduleToken,
          generation,
          sequence,
          blocker: 'scene-particle-states-required'
        });
      }
      const sameDeviceRetainedBufferImport = (
        sourceExecution?.sameDeviceRetainedBufferImport
        || sourceExecution?.finalStep?.sameDeviceRetainedBufferImport
        || sourceExecution?.finalStep?.g2pReconstruction?.sameDeviceRetainedBufferImport
        || sourceExecution?.finalStep?.g2pReconstruction?.gpuResult?.sameDeviceRetainedBufferImport
        || scene.userData?.mlsMpmResidentSameDeviceHotBufferSourcePublication?.sameDeviceRetainedBufferImport
        || null
      );
      const sameDeviceSourceHotBufferKey = sameDeviceRetainedBufferImport?.sameDevice === true
        ? (
            sameDeviceRetainedBufferImport.sourceHotBufferKey
            || sameDeviceRetainedBufferImport.hotBufferKey
            || sameDeviceRetainedBufferImport.hotBufferRecordKey
            || null
          )
        : null;
      const adoptedStorageBeforeStage =
        schroederAdoptedParticleStorageTelemetry(sourceExecution);
      const adoptedStorageContinuationHotBufferKey =
        adoptedStorageBeforeStage.localResolverReady
          ? adoptedStorageBeforeStage.publicationHotBufferKey
          : null;
      const workerRunner = mountedMechanicsStageWorkerRunnerForHost(resolvedHost, sequence);
      const pressureInterfaceGasCellFieldImportForWorkerLane =
        mountedWorkerPressureInterfaceGasCellImportDescriptor();
      const mountedWorkerGasPressureSummary = currentGasPressureSummary(
        overlay.__sphResidentGasPressureSummary
          || activeViewStateGasPressure
          || activeViewState?.gasPressureSummary
          || (driver?.demo ? gasPressureSummary(driver.demo) : null)
      );
      const mountedWorkerMaterialInterfaceState = scene.getSphResidentMaterialInterfaceState?.()
        || overlay.__sphResidentMaterialInterfaceState
        || scene.getSphResidentPressureInterfaceState?.()?.materialInterfaceField
        || null;
      const mountedWorkerMaterialInterfaceField =
        mountedWorkerMaterialInterfaceState?.materialInterfaceField
          || mountedWorkerMaterialInterfaceState;
      const includeMountedPressureInterfaceStage = Boolean(
        mountedWorkerMaterialInterfaceField?.schema
          && mountedWorkerGasPressureSummary
      );
      const includeMountedGasCellEosProducerStage = includeMountedPressureInterfaceStage
        && !pressureInterfaceGasCellFieldImportForWorkerLane
        && Boolean(
          mountedWorkerGasPressureSummary?.spatialGasSpeciesLedger
            || mountedWorkerGasPressureSummary?.pressureFeedback?.spatialGasSpeciesLedger
        );
      const stageResult = await resolvedHost.runMechanicsStageTaskChain({
          sphParticleState,
          mlsMpmParticleState,
          stageTaskIdPrefix: `ulg:mounted:mechanics-stage-worker:${sequence}`,
          preferWebGpu: true,
          useNativeTaskGraph: false,
          readbackMode: 'no-full-readback',
          compactSummaryScope: 'particle-visual',
          gridSpacingM: sphParticleState.smoothingLengthM,
          boxDimsM: scene.getBoxDimensionsM?.() || sceneBoxDimsM,
          dt: mlsMpmParticleState.mechanicsDtS ?? sphParticleState.dt ?? 0,
          gpuResidentLaneId: 'ulg:mounted:mechanics-stage-worker-lane',
          gpuResidentLaneStateKey: 'ulg:mounted:mechanics-stage-worker-state',
          gpuResidentLaneDomainKey: 'sph-phase-demo-mounted-stage-worker',
          gpuHubResidentStageWorkerRunner: workerRunner,
          gpuHubResidentStageWorkerModuleUrl: resolvedHost.ulgMechanicsResidentStageWorkerModulePath,
          sameDeviceRetainedBufferImport,
          includeGasCellEosProducerStage: includeMountedGasCellEosProducerStage,
          includePressureInterfaceStage: includeMountedPressureInterfaceStage,
          approveSameFramePressureInterfaceGridForces: includeMountedPressureInterfaceStage,
          gasPressureSummary: mountedWorkerGasPressureSummary,
          pressureSummary: mountedWorkerGasPressureSummary,
          pressureFeedback:
            mountedWorkerGasPressureSummary?.pressureFeedback
              || mountedWorkerGasPressureSummary
              || null,
          materialInterfaceField: mountedWorkerMaterialInterfaceField,
          pressureInterfaceGasCellFieldImport: pressureInterfaceGasCellFieldImportForWorkerLane,
          pressureInterfaceGasCellFieldAdmission:
            pressureInterfaceGasCellFieldImportForWorkerLane?.pressureInterfaceGasCellFieldAdmission
              || scene.getSphResidentPressureInterfaceState?.()?.pressureInterfaceGasCellFieldAdmission
              || null,
          ...(adoptedStorageContinuationHotBufferKey
            ? {
                schroederAdoptedParticleStorageContinuationHotBufferKey:
                  adoptedStorageContinuationHotBufferKey,
                schroederAdoptedParticleStorageContinuationConsumerMode: 'same-device'
              }
            : {}),
          gpuHubResidentStageWorkerOutputPublisher: (payload) => (
            resolvedHost.publishWorkerRetainedMechanicsStageOutput({
              ...payload,
              sameDeviceRetainedBufferImport
            })
          ),
          gpuHubResidentPressureInterfaceStageWorkerOutputPublisher:
            typeof resolvedHost.publishWorkerRetainedPressureInterfaceStageOutput === 'function'
              ? ((payload) => resolvedHost.publishWorkerRetainedPressureInterfaceStageOutput(payload))
              : null
      });
        const chain = stageResult?.mechanicsStageTaskChain || null;
        const adoptedStorageAfterStage =
          schroederAdoptedParticleStorageTelemetry(sourceExecution, chain);
        const hotBufferKey = chain?.workerCompactPublicationHotBufferKey || null;
        const hotBufferRecord = hotBufferKey
          ? resolvedHost.stateManager?.getHotBuffer?.(hotBufferKey)
          : null;
        const stateManagerWarmDeltas = resolvedHost.stateManager
          ?.getWarmDeltas?.('ulg-worker-retained-mechanics-publications') || {};
        const workerWarmDelta = Object.values(stateManagerWarmDeltas)
          .find((entry) => entry?.payload?.hotBufferKey === hotBufferKey) || null;
        const workerRetainedAccessContract = hotBufferRecord?.workerRetainedAccessContract
          || hotBufferRecord?.workerRetainedBufferImport?.workerRetainedAccessContract
          || workerWarmDelta?.payload?.workerRetainedAccessContract
          || null;
        const published = chain?.workerCompactPublicationCommitted === true;
        let workerRetainedContinuationPlan = null;
        if (
          hotBufferKey
          && published
          && typeof resolvedHost.planWorkerRetainedContinuation === 'function'
        ) {
          workerRetainedContinuationPlan = resolvedHost.planWorkerRetainedContinuation({
            hotBufferKey,
            requiredOutputFamilies: workerRetainedAccessContract?.outputFamilies
              || ['sph-particle-state', 'mls-mpm-mechanics'],
            consumerStageId: 'p2g',
            consumerLawNodeId: 'ulg-mls-mpm-mechanics-p2g-stage',
            requestedLaneId: 'ulg:mounted:mechanics-stage-worker-lane',
            requestedStateKey: 'ulg:mounted:mechanics-stage-worker-state'
          });
        }
        const stageLaneSummaries = chain?.gpuResidentLaneStageTaskLaneSummaries || {};
        const pressureStageLaneSummary = stageLaneSummaries.pressureInterface || null;
        const stageCopyBudgetPresent = Object.values(stageLaneSummaries)
          .some((summary) => Boolean(summary?.copyBudget));
        const stageCopyBudgetTotals = Object.values(stageLaneSummaries).reduce((totals, summary) => ({
          uploadBytes: totals.uploadBytes + Math.max(0, Number(summary?.copyBudgetUploadBytes) || 0),
          readbackBytes: totals.readbackBytes + Math.max(0, Number(summary?.copyBudgetReadbackBytes) || 0),
          retainedBytes: totals.retainedBytes + Math.max(0, Number(summary?.copyBudgetRetainedBytes) || 0),
          compactSummaryBytes:
            totals.compactSummaryBytes + Math.max(0, Number(summary?.copyBudgetCompactSummaryBytes) || 0)
        }), {
          uploadBytes: 0,
          readbackBytes: 0,
          retainedBytes: 0,
          compactSummaryBytes: 0
        });
        const stageBufferByteTotals = Object.values(stageLaneSummaries).reduce((totals, summary) => {
          const stateBytes = Math.max(0, Number(summary?.stateBufferByteLength) || 0);
          const thermoBytes = Math.max(0, Number(summary?.thermoBufferByteLength) || 0);
          const mechanicsBytes = Math.max(0, Number(summary?.mechanicsBufferByteLength) || 0);
          const gridBytes = Math.max(0, Number(summary?.gridBufferByteLength) || 0);
          const updatedGridBytes = Math.max(0, Number(summary?.updatedGridBufferByteLength) || 0);
          return {
            stateBufferByteLength: totals.stateBufferByteLength + stateBytes,
            thermoBufferByteLength: totals.thermoBufferByteLength + thermoBytes,
            mechanicsBufferByteLength: totals.mechanicsBufferByteLength + mechanicsBytes,
            gridBufferByteLength: totals.gridBufferByteLength + gridBytes,
            updatedGridBufferByteLength: totals.updatedGridBufferByteLength + updatedGridBytes,
            totalByteLength: totals.totalByteLength
              + stateBytes
              + thermoBytes
              + mechanicsBytes
              + gridBytes
              + updatedGridBytes
          };
        }, {
          stateBufferByteLength: 0,
          thermoBufferByteLength: 0,
          mechanicsBufferByteLength: 0,
          gridBufferByteLength: 0,
          updatedGridBufferByteLength: 0,
          totalByteLength: 0
        });
      return publishMountedMechanicsStageWorkerLane(
          published ? 'worker-stage-lane-published' : 'worker-stage-lane-executed',
          {
            signature,
            scheduleToken,
            generation,
            sequence,
            authorityHostStatus: resolvedHost.status || null,
            authorityHostSource: resolvedHost.source || null,
            authorityHostNodeId: resolvedHost.nodeKernel?.nodeId || resolvedHost.nodeId || null,
            stateManagerWarmDeltaScope: 'ulg-worker-retained-mechanics-publications',
            stateManagerWarmDeltaFound: Boolean(workerWarmDelta),
            stateManagerWarmDeltaStatus: workerWarmDelta?.payload?.status || null,
            sameDeviceRetainedBufferImportAvailable:
              sameDeviceRetainedBufferImport?.sameDevice === true && Boolean(sameDeviceSourceHotBufferKey),
            sameDeviceRetainedBufferImportSourceHotBufferKey: sameDeviceSourceHotBufferKey,
            schroederAdoptedParticleStoragePublicationStatus:
              adoptedStorageAfterStage.publicationStatus,
            schroederAdoptedParticleStoragePublicationHotBufferKey:
              adoptedStorageAfterStage.publicationHotBufferKey,
            schroederAdoptedParticleStorageDescriptorReady:
              adoptedStorageAfterStage.descriptorReady,
            schroederAdoptedParticleStorageLocalResolverStatus:
              adoptedStorageAfterStage.localResolverStatus,
            schroederAdoptedParticleStorageLocalResolverReady:
              adoptedStorageAfterStage.localResolverReady,
            schroederAdoptedParticleStorageLocalResolverResolvedRefCount:
              adoptedStorageAfterStage.localResolverResolvedRefCount,
            schroederAdoptedParticleStorageContinuationRequested:
              adoptedStorageAfterStage.continuationRequested,
            schroederAdoptedParticleStorageContinuationScheduleStatus:
              adoptedStorageAfterStage.continuationScheduleStatus,
            schroederAdoptedParticleStorageWorkerRematerializationScheduled:
              adoptedStorageAfterStage.workerRematerializationScheduled,
            schroederAdoptedParticleStorageWorkerRematerializationStatus:
              adoptedStorageAfterStage.workerRematerializationStatus,
            schroederAdoptedParticleStorageWorkerRematerializationApplied:
              adoptedStorageAfterStage.workerRematerializationApplied,
            schroederAdoptedParticleStorageContinuationSourceHotBufferKey:
              adoptedStorageAfterStage.continuationSourceHotBufferKey,
            schroederAdoptedParticleStorageStageLocalResolverStatus:
              adoptedStorageAfterStage.stageLocalResolverStatus,
            schroederAdoptedParticleStorageStageLocalResolverReady:
              adoptedStorageAfterStage.stageLocalResolverReady,
            schroederAdoptedParticleStorageRawGpuBufferPeerComputeTransfer:
              adoptedStorageAfterStage.rawGpuBufferPeerComputeTransfer,
            ...mountedPressureInterfaceGasCellImportTelemetry(),
            mountedWorkerLaneRunnerReusedAcrossSchedules: true,
            mountedWorkerLanePressureInterfaceStageIncluded: includeMountedPressureInterfaceStage,
            mountedWorkerLaneGasCellEosProducerStageIncluded: includeMountedGasCellEosProducerStage,
            mountedWorkerLanePressureInterfaceGasCellImportTransferStatus:
              pressureInterfaceGasCellFieldImportForWorkerLane
                ? 'worker-lane-retained-import-descriptor-posted'
                : mountedPressureInterfaceGasCellImportTelemetry().mountedWorkerLanePressureInterfaceGasCellImportTransferStatus,
            mountedWorkerLanePressureInterfaceGasCellImportDescriptorReady:
              Boolean(pressureInterfaceGasCellFieldImportForWorkerLane),
            mountedWorkerLanePressureInterfaceGasCellImportWorkerRetainedRefCount:
              pressureInterfaceGasCellFieldImportForWorkerLane?.workerRetainedGasPressureBufferRefs?.length ?? 0,
            mountedWorkerLanePressureInterfaceGasCellImportRetainedRefCount:
              pressureInterfaceGasCellFieldImportForWorkerLane?.retainedGasPressureBufferRefs?.length ?? 0,
            pressureInterfaceWorkerLaneSummaryPresent: Boolean(pressureStageLaneSummary),
            pressureInterfaceWorkerLaneGasCellFieldImportReady:
              pressureStageLaneSummary?.pressureInterfaceGasCellFieldImportReady === true,
            pressureInterfaceWorkerLaneRetainedLocalPressureGradientReady:
              pressureStageLaneSummary?.pressureInterfaceGasCellFieldImportRetainedLocalPressureGradientReady === true,
            pressureInterfaceWorkerLaneRetainedGasPressureCellsBuffer:
              pressureStageLaneSummary?.pressureInterfaceGasCellFieldImportRetainedGasPressureCellsBuffer === true,
            pressureInterfaceWorkerLaneGasPressureCellRowsBufferRetained:
              pressureStageLaneSummary?.pressureInterfaceGasPressureCellRowsBufferRetained === true,
            pressureInterfaceWorkerLaneGasPressureCellRowsBufferBorrowed:
              pressureStageLaneSummary?.pressureInterfaceGasPressureCellRowsBufferBorrowed === true,
            pressureInterfaceWorkerLaneRetainedRowConsumptionStatus:
              pressureStageLaneSummary?.pressureInterfaceRetainedRowConsumptionStatus
                || chain?.pressureInterfaceRetainedRowConsumptionStatus
                || null,
            stageChainStatus: chain?.status || null,
            gpuResidentLaneStagePlanLaneId: chain?.gpuResidentLaneStagePlanLaneId || null,
            gpuResidentLaneStagePlanStateKey: chain?.gpuResidentLaneStagePlanStateKey || null,
            gpuResidentLaneStagePlanContractSchema: chain?.gpuResidentLaneStagePlanContractSchema || null,
            gpuHubResidentStageExecutorMode: chain?.gpuHubResidentStageExecutorMode || null,
            gpuResidentLaneStageExecutionStatus: chain?.gpuResidentLaneStageExecutionStatus || null,
            gpuResidentLaneStageExecutionStageOrder:
              chain?.gpuResidentLaneStageExecutionStageOrder || [],
            gpuResidentLaneStageExecutionAuthorityPath:
              chain?.gpuResidentLaneStageExecutionAuthorityPath || null,
            gpuResidentLaneStageExecutionUsedGpuHubExecutors:
              chain?.gpuResidentLaneStageExecutionUsedGpuHubExecutors ?? null,
            gpuResidentLaneStageExecutionWorkerRunnerSupplied:
              chain?.gpuResidentLaneStageExecutionWorkerRunnerSupplied ?? null,
            gpuResidentLaneStageExecutionWorkerResidencyStatuses:
              chain?.gpuResidentLaneStageExecutionWorkerResidencyStatuses || {},
            gpuResidentLaneStageExecutionStateFamilyConflictPolicy:
              chain?.gpuResidentLaneStageExecutionStateFamilyConflictPolicy || null,
            gpuResidentLaneStageExecutionStateFamilyConflictDeferralCount:
              chain?.gpuResidentLaneStageExecutionStateFamilyConflictDeferralCount ?? null,
            gpuResidentLaneStageTaskBackends: chain?.gpuResidentLaneStageTaskBackends || {},
            gpuResidentLaneStageTaskReadbackModes:
              chain?.gpuResidentLaneStageTaskReadbackModes || {},
            gpuResidentLaneStageTaskNormalHotLoopReadbackFree:
              chain?.gpuResidentLaneStageTaskNormalHotLoopReadbackFree || {},
            gpuResidentLaneStageTaskFenceSatisfied: chain?.gpuResidentLaneStageTaskFenceSatisfied || {},
            gpuResidentLaneStageTaskCopyBudgets: Object.fromEntries(
              Object.entries(stageLaneSummaries)
                .map(([stageId, summary]) => [stageId, summary?.copyBudget || null])
            ),
            gpuResidentLaneStageTaskCopyBudgetStatus: stageCopyBudgetPresent
              ? 'stage-copy-budgets-recorded'
              : 'stage-copy-budgets-not-present-worker-summary',
            gpuResidentLaneStageTaskCopyBudgetTotals: stageCopyBudgetTotals,
            gpuResidentLaneStageTaskBufferByteTotals: stageBufferByteTotals,
            workerCompactPublicationCandidateStatus: chain?.workerCompactPublicationCandidateStatus || null,
            workerCompactPublicationCandidateSameDeviceRetainedBufferImportAvailable:
              chain?.workerCompactPublicationCandidateSameDeviceRetainedBufferImportAvailable === true,
            workerCompactPublicationCandidateSameDeviceSourceHotBufferKey:
              chain?.workerCompactPublicationCandidateSameDeviceSourceHotBufferKey || null,
            workerCompactPublicationCandidateLocalMaterializationStatus:
              chain?.workerCompactPublicationCandidateLocalMaterializationStatus || null,
            workerCompactPublicationCandidateAcceptedMaterializationModes:
              chain?.workerCompactPublicationCandidateAcceptedMaterializationModes || [],
            workerCompactPublicationStatus: chain?.workerCompactPublicationStatus || null,
            workerCompactPublicationCommitted: published,
            workerCompactPublicationHotBufferKey: hotBufferKey,
            workerCompactPublicationCommitDeltaTaskId:
              chain?.workerCompactPublicationCommitDeltaTaskId || null,
            workerCompactPublicationSameDeviceRetainedBufferImportAvailable:
              chain?.workerCompactPublicationSameDeviceRetainedBufferImportAvailable === true,
            workerCompactPublicationSameDeviceSourceHotBufferKey:
              chain?.workerCompactPublicationSameDeviceSourceHotBufferKey || null,
            workerCompactPublicationRecordSchema: hotBufferRecord?.schema || null,
            workerCompactPublicationRecordStatus: hotBufferRecord?.status || null,
            workerCompactPublicationRecordStateKey: hotBufferRecord?.stateKey || null,
            workerCompactPublicationRecordSourceStage: hotBufferRecord?.sourceStage || null,
            workerCompactPublicationRecordWorkerLocal: hotBufferRecord?.workerLocal === true,
            workerCompactPublicationRecordSameDevice: hotBufferRecord?.sameDevice === true,
            workerCompactPublicationRecordCopyMode: hotBufferRecord?.copyMode || null,
            workerCompactPublicationRecordSameDeviceRetainedBufferImportAvailable:
              hotBufferRecord?.sameDeviceRetainedBufferImportAvailable === true,
            workerCompactPublicationRecordSameDeviceSourceHotBufferKey:
              hotBufferRecord?.sameDeviceSourceHotBufferKey || null,
            workerCompactPublicationRecordLocalBufferRefCount:
              hotBufferRecord?.localBufferRefs?.length ?? null,
            workerCompactPublicationRecordWorkerRetainedBufferRefCount:
              hotBufferRecord?.workerRetainedBufferRefs?.length ?? null,
            workerCompactPublicationRecordHasWorkerRunner: Boolean(hotBufferRecord?.workerRunner),
            workerRetainedAccessContractSchema: workerRetainedAccessContract?.schema || null,
            workerRetainedAccessContractStatus: workerRetainedAccessContract?.status || null,
            workerRetainedAccessContractWorkerContinuationRequired:
              workerRetainedAccessContract?.workerContinuationRequired === true,
            workerRetainedAccessContractMainThreadGpuHandlesAvailable:
              workerRetainedAccessContract?.mainThreadGpuHandlesAvailable === true,
            workerRetainedAccessContractSameDeviceRetainedBufferImportAvailable:
              workerRetainedAccessContract?.sameDeviceRetainedBufferImportAvailable === true,
            workerRetainedAccessContractSameDeviceSourceHotBufferKey:
              workerRetainedAccessContract?.sameDeviceSourceHotBufferKey || null,
            workerRetainedAccessContractLocalMaterializationStatus:
              workerRetainedAccessContract?.localMaterializationStatus || null,
            workerRetainedAccessContractLocalMaterializationBlocker:
              workerRetainedAccessContract?.localMaterializationBlocker || null,
            workerRetainedAccessContractAcceptedConsumerModes:
              workerRetainedAccessContract?.acceptedConsumerModes || [],
            workerRetainedAccessContractAcceptedMaterializationModes:
              workerRetainedAccessContract?.acceptedMaterializationModes || [],
            workerRetainedAccessContractOutputFamilies:
              workerRetainedAccessContract?.outputFamilies || [],
            workerRetainedAccessContractLocalBufferRefCount:
              workerRetainedAccessContract?.localBufferRefs?.length ?? null,
            workerRetainedAccessContractWorkerRetainedBufferRefCount:
              workerRetainedAccessContract?.workerRetainedBufferRefs?.length ?? null,
            workerRetainedContinuationPlanStatus:
              workerRetainedContinuationPlan?.status || null,
            workerRetainedContinuationPlanConsumerMode:
              workerRetainedContinuationPlan?.consumerMode || null,
            workerRetainedContinuationPlanWorkerRunnerAvailable:
              workerRetainedContinuationPlan?.workerRunnerAvailable === true,
            workerRetainedContinuationPlanSameDeviceRetainedBufferImportAvailable:
              workerRetainedContinuationPlan?.sameDeviceRetainedBufferImportAvailable === true,
            workerRetainedContinuationPlanSameDeviceSourceHotBufferKey:
              workerRetainedContinuationPlan?.sameDeviceSourceHotBufferKey || null,
            workerRetainedContinuationPlanUseWorkerInput:
              workerRetainedContinuationPlan?.useWorkerRetainedInput === true,
            workerRetainedContinuationPlanMissingOutputFamilies:
              workerRetainedContinuationPlan?.missingOutputFamilies || [],
            workerRetainedContinuationPlanWorkerRetainedBufferRefCount:
              workerRetainedContinuationPlan?.workerRetainedBufferRefCount ?? null,
            workerRetainedContinuationPlanLocalBufferRefCount:
              workerRetainedContinuationPlan?.localBufferRefCount ?? null,
            renderHandoffStatus: published
              ? 'blocked-worker-gpu-handles-not-main-thread-renderable'
              : 'blocked-worker-publication-required',
            nextRequiredImplementation:
              'main-thread-render-import-from-worker-retained-compact-surface-or-same-device-renderer'
          }
      );
    })().catch((error) => publishMountedMechanicsStageWorkerLane('worker-stage-lane-error', {
      signature,
      scheduleToken,
      generation,
      sequence,
      error: error instanceof Error ? error.message : String(error)
    })).finally(() => {
      pendingMountedMechanicsStageWorkerLanePromise = null;
      renderStatus();
      updateWarningBanner();
    });
    return pendingMountedMechanicsStageWorkerLanePromise;
  }

  function scheduleMlsMpmResidentSteps({
    stepCount = currentResidentStepsPerSchedule(),
    readbackMode = SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT,
    continueFromResidentState = false,
    continuationBudget = RESIDENT_CONTINUATION_CHAIN_BUDGET,
    generation = particleSyncGeneration,
    force = false
  } = {}) {
    // Single authority: the plain SPH CPU reference owns its physics AND its
    // CPU surface rendering. Auto-scheduling resident mlsmpm steps alongside
    // it draws native webgpu surfaces UNDER the CPU particle geometry - the
    // mixed-source overlay the no-overlay architecture forbids. Explicit
    // scene.refreshMlsMpmResidentSteps calls (diagnostic proofs) bypass this.
    if (mechanicsModeFromControls() === 'sph') return;
    const normalizedStepCount = Math.max(1, Math.round(Number(stepCount) || 1));
    const residentExecutionPolicy = residentExecutionPolicyFromUrl();
    const schroederExecutionOptions = schroederResidentExecutionOptionsFromConfig();
    const baseSignature = mlsMpmResidentStepsSignature({
      stepCount: normalizedStepCount,
      readbackMode,
      ...residentExecutionPolicy,
      ...schroederExecutionOptions
    });
    const signature = baseSignature
      ? `${baseSignature}|sync=${generation}|continue=${Boolean(continueFromResidentState)}`
      : null;
    if (!signature || (pendingMlsMpmResidentStepsSignature && !force)) return;
    overlay.__mlsMpmResidentRequestedReadbackMode = readbackMode;
    overlay.__mlsMpmResidentExecutionPolicy = residentExecutionPolicy;
    overlay.__sphSchroederSimulationConfig = initialSchroederSimulationConfig;
    overlay.__mlsMpmSchroederExecutionOptions = schroederExecutionOptions;
    const scheduleToken = pendingMlsMpmResidentStepsToken + 1;
    pendingMlsMpmResidentStepsToken = scheduleToken;
    pendingMlsMpmResidentStepsSignature = signature;
    // Durable schedule trace: each stage of this schedule's lifecycle lands
    // here so a wedged refresh is diagnosable from the page (the pending
    // record alone cannot say WHERE a schedule stalled).
    const traceResidentSchedule = (stage, extra = {}) => {
      const trace = overlay.__sphResidentScheduleTrace || (overlay.__sphResidentScheduleTrace = []);
      trace.push({ scheduleToken, stage, atMs: performance.now(), ...extra });
      if (trace.length > 64) trace.splice(0, trace.length - 64);
    };
    traceResidentSchedule('scheduled', {
      continueFromResidentState: Boolean(continueFromResidentState),
      execPresent: Boolean(overlay.__mlsMpmResidentSteps)
    });
    overlay.__mlsMpmResidentStepsPending = {
      schema: 'peercompute.ulg.sph-demo-resident-pending.v0',
      status: force ? 'resident-execution-force-rescheduled' : 'resident-execution-pending',
      signature,
      scheduleToken,
      stepCount: normalizedStepCount,
      readbackMode,
      continueFromResidentState: Boolean(continueFromResidentState),
      residentExecutionPolicy,
      schroederSimulationConfig: initialSchroederSimulationConfig,
      schroederExecutionOptions,
      generation,
      startedAtMs: performance.now()
    };
    publishResidentStageOrderTrace({
      status: force ? 'resident-execution-force-rescheduled' : 'resident-execution-pending',
      signature,
      scheduleToken,
      stepCount: normalizedStepCount,
      readbackMode,
      continueFromResidentState: Boolean(continueFromResidentState),
      residentExecutionPolicy,
      schroederSimulationConfig: initialSchroederSimulationConfig,
      schroederExecutionOptions,
      generation
    });
    overlay.__mlsMpmResidentStepsSlow = null;
    let scheduleContinuation = false;
    let scheduleLatestGeneration = false;
    let restartPlaybackContinuation = false;
    const residentStartMs = performance.now();
    const slowNoticeTimer = window.setTimeout(() => {
      if (
        pendingMlsMpmResidentStepsSignature !== signature
        || pendingMlsMpmResidentStepsToken !== scheduleToken
        || scene.getMlsMpmResidentSteps?.()?.schema
        || !overlay.isConnected
        || generation !== particleSyncGeneration
      ) {
        return;
      }
      const elapsedMs = performance.now() - residentStartMs;
      overlay.__mlsMpmResidentStepsSlow = {
        schema: 'peercompute.ulg.sph-demo-slow-resident-execution.v0',
        status: 'resident-execution-slow-current-batch-retained',
        signature,
        scheduleToken,
        stepCount: normalizedStepCount,
        readbackMode,
        continueFromResidentState: Boolean(continueFromResidentState),
        residentExecutionPolicy,
        generation,
        elapsedMs,
        noticedAtMs: performance.now(),
        resubmitted: false,
        reason: 'normal cold resident submissions can exceed the short UI warning window'
      };
      updateResidentPerf({
        residentStepsPerSchedule: currentResidentStepsPerSchedule(),
        lastResidentSlowNoticeMs: elapsedMs
      });
      renderStatus();
      updateWarningBanner();
    }, RESIDENT_PENDING_SLOW_NOTICE_MS);
    const watchdogTimer = window.setTimeout(() => {
      if (
        pendingMlsMpmResidentStepsSignature !== signature
        || pendingMlsMpmResidentStepsToken !== scheduleToken
        || scene.getMlsMpmResidentSteps?.()?.schema
        || !overlay.isConnected
        || generation !== particleSyncGeneration
      ) {
        return;
      }
      const elapsedMs = performance.now() - residentStartMs;
      pendingMlsMpmResidentStepsSignature = null;
      overlay.__mlsMpmResidentStepsPending = {
        ...(overlay.__mlsMpmResidentStepsPending || {}),
        status: 'resident-execution-watchdog-rescheduled',
        elapsedMs,
        rescheduledAtMs: performance.now()
      };
      overlay.__mlsMpmResidentStepsSlow = null;
      overlay.__mlsMpmResidentStepsError = 'resident execution exceeded the stall watchdog; forced a fresh resident submission';
      publishResidentStageOrderTrace({
        status: 'resident-execution-watchdog-rescheduled',
        reason: 'resident execution exceeded the stall watchdog; forced a fresh resident submission',
        signature,
        scheduleToken,
        stepCount: normalizedStepCount,
        readbackMode,
        continueFromResidentState: Boolean(continueFromResidentState),
        residentExecutionPolicy,
        schroederSimulationConfig: initialSchroederSimulationConfig,
        schroederExecutionOptions,
        generation
      });
      updateResidentPerf({
        residentStepsPerSchedule: currentResidentStepsPerSchedule(),
        lastResidentWatchdogMs: elapsedMs
      });
      scheduleMlsMpmResidentSteps({
        stepCount: currentResidentStepsPerSchedule(),
        readbackMode,
        continueFromResidentState: false,
        continuationBudget,
        generation,
        force: true
      });
    }, RESIDENT_PENDING_WATCHDOG_MS);
    const residentComputeManagerModeForSchedule = currentResidentComputeManagerMode();
    const residentComputeManagerForSchedule = residentComputeManagerModeForSchedule === 'direct'
      ? null
      : resolveResidentComputeManager();
    if (residentComputeManagerModeForSchedule === 'direct') {
      overlay.__sphResidentComputeManager = {
        schema: 'peercompute.ulg.sph-demo-resident-compute-manager.v0',
        status: 'policy-bypassed-direct-resident-execution',
        source: null,
        submitTask: false,
        mode: residentComputeManagerModeForSchedule,
        updatedAtMs: performance.now()
      };
    }
    const residentComputeManagerSource = overlay.__sphResidentComputeManager?.source || null;
    const allowPeerComputeStateManagerForSchedule =
      residentComputeManagerModeForSchedule !== 'direct'
      && (!residentComputeManagerForSchedule
      || residentComputeManagerSource === 'peercompute-resident-authority-host'
      || residentComputeManagerSource === 'residentAuthorityHost.computeManager'
      || residentComputeManagerSource === 'runtime.residentAuthorityHost.computeManager'
      || residentComputeManagerSource === 'global.__ulgResidentAuthorityHost.computeManager');
    const residentStateManagerForSchedule = resolveResidentStateManager({
      allowPeerComputeAuthorityHost: allowPeerComputeStateManagerForSchedule
    });
    const computeTaskModulePathForSchedule = residentComputeTaskModulePath
      || peerComputeResidentAuthorityHost?.computeTaskModulePath
      || residentComputeManagerForSchedule?.ulgResidentComputeTaskModulePath
      || undefined;
    const residentAuthorityHostForSchedule = peerComputeResidentAuthorityHost
      || residentAuthorityHost
      || runtime?.residentAuthorityHost
      || globalThis.__ulgResidentAuthorityHost
      || null;
    const gasPressureForSchedule = currentGasPressureSummary(
      overlay.__sphResidentGasPressureSummary
        || activeViewStateGasPressure
        || (driver?.demo ? gasPressureSummary(driver.demo) : null)
    );
    let remoteRefreshPreludePromise = Promise.resolve(null);
    if (enableRemoteResidentTaskGraphRefresh) {
      overlay.__sphRemoteResidentTaskGraphRefresh = remoteResidentTaskGraphRefreshTelemetry('pending', {
        enabled: true,
        signature,
        scheduleToken,
        stepCount: normalizedStepCount,
        readbackMode,
        continueFromResidentState: Boolean(continueFromResidentState),
        residentExecutionPolicy,
        schroederSimulationConfig: initialSchroederSimulationConfig,
        schroederExecutionOptions,
        generation
      });
      remoteRefreshPreludePromise = runRemoteResidentTaskGraphRefreshPrelude({
        enabled: true,
        host: residentAuthorityHostForSchedule,
        graph: remoteResidentTaskGraph,
        graphFactory: remoteResidentTaskGraphFactory || (remoteResidentTaskGraph ? null : buildDefaultRemoteResidentTaskGraph),
        refreshOptions: remoteResidentTaskGraphRefreshOptions,
        context: {
          overlay,
          scene,
          runtime,
          signature,
          scheduleToken,
          stepCount: normalizedStepCount,
          readbackMode,
          continueFromResidentState: Boolean(continueFromResidentState),
          continuationBudget,
          generation,
          force: Boolean(force || continueFromResidentState),
          residentExecutionPolicy,
          schroederSimulationConfig: initialSchroederSimulationConfig,
          schroederExecutionOptions,
          computeManager: residentComputeManagerForSchedule,
          residentStateManager: residentStateManagerForSchedule,
          residentComputeManagerMode: residentComputeManagerModeForSchedule,
          computeTaskModulePath: computeTaskModulePathForSchedule
        }
      }).then((report) => {
        overlay.__sphRemoteResidentTaskGraphRefresh = {
          ...report,
          signature,
          scheduleToken,
          stepCount: normalizedStepCount,
          readbackMode,
          continueFromResidentState: Boolean(continueFromResidentState),
          generation
        };
        return report;
      });
    }
    remoteRefreshPreludePromise.then(() => {
      traceResidentSchedule('refresh-invoked');
      return scene.refreshMlsMpmResidentSteps?.({
      preferWebGpu: true,
      computeManager: residentComputeManagerForSchedule,
      residentStateManager: residentStateManagerForSchedule,
      residentAuthorityHost: residentAuthorityHostForSchedule,
      residentComputeManagerMode: residentComputeManagerModeForSchedule,
      computeTaskModulePath: computeTaskModulePathForSchedule,
      computeTaskLaneId: 'ulg:sph-resident:demo-auto',
      computeTaskDomainKey: 'sph-phase-demo',
      gasPressureSummary: gasPressureForSchedule,
      pressureInterfaceGasCellFieldImport: scene.getSphResidentPressureInterfaceState?.()?.pressureInterfaceGasCellFieldImport || null,
      pressureInterfaceGasCellFieldAdmission: scene.getSphResidentPressureInterfaceState?.()?.pressureInterfaceGasCellFieldAdmission || null,
      stepCount: normalizedStepCount,
      readbackMode,
      // final-only keeps the hot loop free of full readbacks while still
      // producing the compact GPU summary (fixed-size readback, allowed on
      // the hot path) once per scheduled batch: it carries maxDisplacementM,
      // the demo's numeric motion proof. 'none' left every readback-free
      // presentation path (native consumer, worker-owned producer) unable to
      // prove motion, tripping the warning banner despite a healthy sim.
      compactSummaryMode: readbackMode === 'no-full-readback' ? 'final-only' : undefined,
      continueFromResidentState,
      ...residentExecutionPolicy,
      ...schroederExecutionOptions,
      force: Boolean(force || continueFromResidentState)
      });
    }).then(async (execution) => {
      traceResidentSchedule('refresh-settled', {
        status: execution?.status ?? null,
        stale: Boolean(execution?.stale)
      });
      const residentMs = performance.now() - residentStartMs;
      if (!execution?.schema) {
        overlay.__mlsMpmResidentStepsError = 'resident execution did not produce a step envelope';
        overlay.__mlsMpmResidentStepsPending = null;
        overlay.__mlsMpmResidentStepsSlow = null;
        publishResidentStageOrderTrace({
          status: 'resident-execution-missing-envelope',
          reason: overlay.__mlsMpmResidentStepsError,
          signature,
          scheduleToken,
          stepCount: normalizedStepCount,
          readbackMode,
          continueFromResidentState: Boolean(continueFromResidentState),
          residentExecutionPolicy,
          generation,
          execution
        });
        updateResidentPerf({
          lastResidentMs: residentMs,
          lastResidentBackend: execution?.backend || 'missing',
          lastResidentReadbackMode: execution?.readbackMode || 'missing',
          lastResidentStageTiming: null
        });
        renderStatus();
        updateWarningBanner();
        return;
      }
      const stepSummaries = Array.isArray(execution?.stepSummaries) ? execution.stepSummaries : [];
      const lastStepSummary = stepSummaries.length ? stepSummaries[stepSummaries.length - 1] : null;
      const lastResidentStageTiming = execution?.finalStep?.stageTiming || lastStepSummary?.stageTiming || null;
      if (execution?.stale || generation !== particleSyncGeneration) {
        scheduleLatestGeneration = true;
        overlay.__mlsMpmResidentStepsPending = null;
        overlay.__mlsMpmResidentStepsSlow = null;
        overlay.__mlsMpmResidentStepsStale = {
          schema: 'peercompute.ulg.sph-demo-stale-resident-execution.v0',
          status: 'discarded-stale-resident-execution',
          requestedGeneration: generation,
          currentGeneration: particleSyncGeneration,
          backend: execution?.backend || 'missing',
          readbackMode: execution?.readbackMode || 'missing',
          residentMs,
          staleFlag: Boolean(execution?.stale),
          scientificValidation: false,
          sphValidation: false,
          phaseChangeValidation: false,
          fullPhysicsValidation: false
        };
        publishResidentStageOrderTrace({
          status: 'resident-execution-stale-discarded',
          signature,
          scheduleToken,
          stepCount: normalizedStepCount,
          readbackMode,
          continueFromResidentState: Boolean(continueFromResidentState),
          residentExecutionPolicy,
          generation,
          execution
        });
        updateResidentPerf({
          staleResidentSubmissions: (residentPerf.staleResidentSubmissions || 0) + 1,
          lastStaleResidentMs: residentMs,
          lastStaleResidentBackend: execution?.backend || 'missing',
          lastStaleResidentReadbackMode: execution?.readbackMode || 'missing',
          lastStaleResidentStageTiming: lastResidentStageTiming
        });
        renderStatus();
        updateWarningBanner();
        return;
      }
      overlay.__mlsMpmResidentStepsError = null;
      overlay.__mlsMpmResidentStepsPending = null;
      overlay.__mlsMpmResidentStepsSlow = null;
      overlay.__mlsMpmResidentStepsStale = null;
      updateResidentPerf({
        residentSubmissions: residentPerf.residentSubmissions + 1,
        residentStepsPerSchedule: normalizedStepCount,
        lastResidentMs: residentMs,
        lastResidentBackend: execution?.backend || 'missing',
        lastResidentReadbackMode: execution?.readbackMode || 'missing',
        lastResidentStageTiming
      });
      const completedResidentSteps = execution?.completedStepCount || normalizedStepCount;
      recordResidentFrame(completedResidentSteps);
      if (!driver && activeViewState) recordPhysicsFrame(completedResidentSteps);
      overlay.__mlsMpmResidentSteps = execution;
      traceResidentSchedule('published', { schema: execution?.schema ?? null });
      {
        // Live thermal summary for the render side: the surface shader's
        // blackbody emission tracks the hottest live temperature instead of
        // static phase-transition anchors (hot SOLID iron must still glow).
        // Published here (every completed execution), NOT in the status
        // panel formatter, which only runs with the menu open.
        const liveDiagnostics = execution?.finalStep?.diagnostics || null;
        const liveMaxK = Number(liveDiagnostics?.maxTemperatureK);
        if (Number.isFinite(liveMaxK) && scene.scene?.userData) {
          scene.scene.userData.sphLiveThermalSummary = {
            maxTemperatureK: liveMaxK,
            minTemperatureK: Number(liveDiagnostics?.minTemperatureK) || null,
            meanTemperatureK: Number(liveDiagnostics?.temperatureMassWeightedMeanK) || null,
            updatedAtMs: performance.now()
          };
        }
      }
      overlay.__mlsMpmResidentStep = scene.getMlsMpmResidentStep?.() || execution?.finalStep || null;
      overlay.__mlsMpmP2gGridProjection = scene.getMlsMpmP2gGridProjection?.() || execution?.finalStep?.p2gGridProjection || null;
      overlay.__mlsMpmGridUpdate = scene.getMlsMpmGridUpdate?.() || execution?.finalStep?.gridUpdate || null;
      overlay.__mlsMpmG2pReconstruction = scene.getMlsMpmG2pReconstruction?.() || execution?.finalStep?.g2pReconstruction || null;
      overlay.__mlsMpmResidentRequestedReadbackMode = execution?.requestedReadbackMode || readbackMode;
      overlay.__mlsMpmResidentSourceMode = execution?.residentSourceMode || 'cpu-packed-state';
      overlay.__mlsMpmResidentContinuedFromResidentState = Boolean(execution?.continuedFromResidentState);
      overlay.__mlsMpmResidentContinuationAvailable = Boolean(execution?.continuationAvailable);
      publishResidentStageOrderTrace({
        status: 'resident-execution-complete',
        signature,
        scheduleToken,
        stepCount: normalizedStepCount,
        readbackMode,
        continueFromResidentState: Boolean(continueFromResidentState),
        residentExecutionPolicy,
        generation,
        execution
      });
      updateResidentGasPressureSummary(overlay.__mlsMpmResidentStep);
      const adoptedStorageForMountedStage =
        schroederAdoptedParticleStorageTelemetry(execution);
      if (
        initialResidentStageWorkersEnabled
        && (!continueFromResidentState || adoptedStorageForMountedStage.continuationRequested)
      ) {
        maybeRunMountedMechanicsStageWorkerLane({
          host: residentAuthorityHostForSchedule,
          signature,
          scheduleToken,
          generation,
          sourceExecution: execution
        });
      }
      const residentStepForRefresh = overlay.__mlsMpmResidentStep || execution?.finalStep || null;
      const residentReactionResultForRefresh = residentStepForRefresh?.reactionStep?.result
        || residentStepForRefresh?.reactionStep
        || null;
      const residentReactionSummaryForRefresh = residentReactionResultForRefresh?.reactionSummary || null;
      const residentProductMassForRefresh = residentStepForRefresh?.residentProductMass
        || residentReactionResultForRefresh?.residentProductMass
        || null;
      const residentGasPressureForRefresh = currentGasPressureSummary(
        overlay.__sphResidentGasPressureSummary
          || activeViewStateGasPressure
          || (driver?.demo ? gasPressureSummary(driver.demo) : null)
      );
      const schedulerResidentInterfaceRefreshMode = currentResidentInterfaceRefreshMode();
      const residentInterfaceRefresh = startResidentInterfaceRefresh({
        execution,
        residentGasPressureForRefresh,
        residentProductMassForRefresh,
        residentReactionSummaryForRefresh,
        residentAuthorityHostForSchedule,
        generation,
        scheduleToken
      });
      if (schedulerResidentInterfaceRefreshMode === 'blocking') {
        await residentInterfaceRefresh;
      }
      scheduleContinuation = Boolean(
        execution?.continuationAvailable
        && execution?.readbackMode === 'no-full-readback'
        && execution?.backend === 'webgpu'
        && continuationBudget > 0
        && generation === particleSyncGeneration
        // Continuation chaining is playback: a paused page runs exactly one
        // bootstrap schedule to materialize resident render state, then
        // holds. Without this gate the paused default page burned its
        // continuation budget (visible fluid twitch) and froze mid-motion.
        && playing
      );
      const renderMotion = residentMotionDiagnostic({
        residentStep: execution?.finalStep || null,
        residentSteps: execution,
        gridSpacingM: scene.getSphGpuParticleState?.()?.smoothingLengthM
      });
      const accumulatedMotion = accumulateResidentSubvisibleMotion(renderMotion);
      const pressureForceRowsReady = Boolean(
        scene.getSphResidentPressureInterfaceState?.()?.pressureInterfaceForceRowsBufferRetained
        || scene.getSphResidentRenderState?.()?.pressureInterfaceForceRowsBufferRetained
      );
      const suppressSubvisiblePlaybackRender = Boolean(
        renderMotion.status === 'motion-below-visible-threshold'
        && !accumulatedMotion.accumulatedMotionVisible
        && residentGpuContinuationReady(execution)
        && pressureForceRowsReady
      );
      restartPlaybackContinuation = Boolean(
        !scheduleContinuation
        && playing
        && residentGpuContinuationReady(execution)
        && generation === particleSyncGeneration
      );
      if (execution?.backend === 'webgpu') {
        const selectedSurfaceDrawDiagnosticMode = currentResidentSurfaceDrawDiagnosticMode();
        const selectedParticleRenderMode = residentSurfaceDrawParticleRenderMode(selectedSurfaceDrawDiagnosticMode);
        const selectedNativeSurfaceConsumerRefresh = residentSurfaceDrawModeUsesNativeSurfaceConsumer(
          selectedSurfaceDrawDiagnosticMode
        );
        const forceParticleRenderModeRefresh = residentSurfaceDrawModeUsesParticleBridge(
          selectedSurfaceDrawDiagnosticMode
        );
        const hasResidentRenderState = Boolean(scene.getSphResidentRenderState?.()?.schema);
        const forceInitialRenderStateRefresh = !hasResidentRenderState;
        const forceMotionProvenRefresh = renderMotion.status === 'motion-proven';
        const forceBatchMotionEstimateRefresh = renderMotion.batchMotionEstimateVisible === true;
        const forceAccumulatedMotionRefresh = accumulatedMotion.accumulatedMotionVisible;
        const forceResidentRenderRefreshReason = forceInitialRenderStateRefresh
          ? 'resident-initial-visual-refresh'
          : forceMotionProvenRefresh
          ? 'resident-motion-proven-visual-refresh'
          : forceBatchMotionEstimateRefresh
          ? 'resident-batch-motion-estimate-visual-refresh'
          : forceAccumulatedMotionRefresh
          ? 'resident-accumulated-motion-visual-refresh'
          : forceParticleRenderModeRefresh
          ? 'resident-particle-render-mode-live-physics-refresh'
          : 'playback-initial-visual-refresh';
        const cadence = residentRenderReadbackDecision({
          continueFromResidentState,
          forceDue: forceInitialRenderStateRefresh
            || forceMotionProvenRefresh
            || forceBatchMotionEstimateRefresh
            || forceAccumulatedMotionRefresh
            || forceParticleRenderModeRefresh,
          forceReason: forceResidentRenderRefreshReason,
          suppressDue: suppressSubvisiblePlaybackRender,
          suppressReason: 'resident-motion-below-visible-threshold'
        });
        cadence.motionStatus = renderMotion.status;
        cadence.maxDisplacementM = renderMotion.maxDisplacementM;
        cadence.visibleThresholdM = renderMotion.visibleThresholdM;
        cadence.estimatedBatchTimeS = renderMotion.estimatedBatchTimeS;
        cadence.estimatedBatchDisplacementUpperBoundM = renderMotion.estimatedBatchDisplacementUpperBoundM;
        cadence.batchMotionEstimateVisible = renderMotion.batchMotionEstimateVisible;
        cadence.accumulatedSubvisibleMotionM = accumulatedMotion.accumulatedSubvisibleMotionM;
        cadence.subvisibleMotionBurstCount = accumulatedMotion.subvisibleMotionBurstCount;
        cadence.accumulatedMotionVisible = accumulatedMotion.accumulatedMotionVisible;
        cadence.particleRenderModeRefresh = forceParticleRenderModeRefresh;
        cadence.particleRenderMode = selectedParticleRenderMode;
        cadence.surfaceDrawDiagnosticMode = selectedSurfaceDrawDiagnosticMode;
        try {
          if (cadence.due) {
            const renderStartMs = performance.now();
            overlay.__sphResidentRenderState = await scene.refreshSphResidentRenderState?.({
              preferWebGpu: true,
              residentSteps: execution,
              materialProperties: activeMaterialProperties(),
              gasPressureSummary: overlay.__sphResidentGasPressureSummary
                || activeViewStateGasPressure
                || (driver?.demo ? gasPressureSummary(driver.demo) : null),
              residentAuthorityHost: residentAuthorityHostForSchedule,
              pressureInterfaceGasCellFieldImport: scene.getSphResidentPressureInterfaceState?.()?.pressureInterfaceGasCellFieldImport || null,
              pressureInterfaceGasCellFieldAdmission: scene.getSphResidentPressureInterfaceState?.()?.pressureInterfaceGasCellFieldAdmission || null,
              pressureInterfaceGasCellFieldImportStateKey: execution?.computeManagerTask?.stateKey || null,
              renderFieldReadbackMode: selectedNativeSurfaceConsumerRefresh
                ? SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT
                : undefined,
              renderRowsReadbackMode: selectedNativeSurfaceConsumerRefresh
                ? SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT
                : undefined,
              renderFieldSurfaceSummaryMode: (
                residentSurfaceDrawModeUsesCompactBridge(selectedSurfaceDrawDiagnosticMode)
                || selectedNativeSurfaceConsumerRefresh
              )
                ? 'skip'
                : 'auto',
              surfaceDrawDiagnosticMode: selectedSurfaceDrawDiagnosticMode,
              surfaceDrawDiagnosticModeExplicit: residentSurfaceDrawDiagnosticModeExplicit,
              allowNativeSurfaceExtraction: selectedNativeSurfaceConsumerRefresh ? true : undefined,
              skipPressureInterfaceRefresh: true
            });
            overlay.__sphResidentSurfaceDraw = scene.getSphResidentSurfaceDraw?.() || null;
            overlay.__sphResidentSurfaceDrawOverlayPolicy = scene.getSphResidentSurfaceDrawOverlayPolicy?.() || null;
            overlay.__sphResidentPressureInterfaceState = scene.getSphResidentPressureInterfaceState?.() || null;
            updateResidentGasPressureSummary(overlay.__mlsMpmResidentStep);
            residentRenderReadbackCount += 1;
            residentAccumulatedSubvisibleMotionM = 0;
            residentSubvisibleMotionBurstCount = 0;
            annotateResidentRenderStateCadence(overlay.__sphResidentRenderState, {
              ...cadence,
              skipped: false,
              renderReadbackCount: residentRenderReadbackCount,
              skippedCount: residentRenderReadbackSkippedCount,
              accumulatedSubvisibleMotionM: 0,
              subvisibleMotionBurstCount: 0
            });
            updateResidentPerf({
              residentStepsPerSchedule: normalizedStepCount,
              renderReadbacks: residentRenderReadbackCount,
              skippedRenderReadbacks: residentRenderReadbackSkippedCount,
              accumulatedSubvisibleMotionM: 0,
              subvisibleMotionBurstCount: 0,
              effectiveRenderReadbackCadence: cadence.effectiveCadence,
              playbackVisualRefreshForced: Boolean(cadence.forced),
              lastRenderReadbackMs: performance.now() - renderStartMs,
              lastRenderReadbackSkipped: false
            });
          } else {
            residentRenderReadbackSkippedCount += 1;
            overlay.__sphResidentRenderState = annotateResidentRenderStateCadence(
              scene.getSphResidentRenderState?.() || overlay.__sphResidentRenderState || null,
              {
                ...cadence,
                skipped: true,
                renderReadbackCount: residentRenderReadbackCount,
                skippedCount: residentRenderReadbackSkippedCount
              }
            );
            overlay.__sphResidentSurfaceDraw = scene.getSphResidentSurfaceDraw?.() || overlay.__sphResidentSurfaceDraw || null;
            overlay.__sphResidentSurfaceDrawOverlayPolicy = scene.getSphResidentSurfaceDrawOverlayPolicy?.()
              || overlay.__sphResidentSurfaceDrawOverlayPolicy
              || null;
            overlay.__sphResidentPressureInterfaceState = scene.getSphResidentPressureInterfaceState?.()
              || overlay.__sphResidentPressureInterfaceState
              || null;
            updateResidentGasPressureSummary(overlay.__mlsMpmResidentStep);
            updateResidentPerf({
              residentStepsPerSchedule: normalizedStepCount,
              renderReadbacks: residentRenderReadbackCount,
              skippedRenderReadbacks: residentRenderReadbackSkippedCount,
              accumulatedSubvisibleMotionM: residentAccumulatedSubvisibleMotionM,
              subvisibleMotionBurstCount: residentSubvisibleMotionBurstCount,
              effectiveRenderReadbackCadence: cadence.effectiveCadence,
              playbackVisualRefreshForced: false,
              lastRenderReadbackSkipped: true
            });
          }
        } catch (error) {
          overlay.__sphResidentRenderStateError = error instanceof Error ? error.message : String(error);
        }
      } else {
        overlay.__sphResidentRenderState = scene.getSphResidentRenderState?.() || null;
        overlay.__sphResidentPressureInterfaceState = scene.getSphResidentPressureInterfaceState?.() || null;
        overlay.__sphResidentSurfaceDraw = scene.getSphResidentSurfaceDraw?.() || null;
        overlay.__sphResidentSurfaceDrawOverlayPolicy = scene.getSphResidentSurfaceDrawOverlayPolicy?.() || null;
      }
      renderStatus();
      updateWarningBanner();
    }).catch((error) => {
      overlay.__mlsMpmResidentStepsError = error instanceof Error ? error.message : String(error);
      overlay.__mlsMpmResidentStepsPending = null;
      overlay.__mlsMpmResidentStepsSlow = null;
      publishResidentStageOrderTrace({
        status: 'resident-execution-error',
        reason: overlay.__mlsMpmResidentStepsError,
        signature,
        scheduleToken,
        stepCount: normalizedStepCount,
        readbackMode,
        continueFromResidentState: Boolean(continueFromResidentState),
        residentExecutionPolicy,
        generation
      });
      renderStatus();
      updateWarningBanner();
    }).finally(() => {
      window.clearTimeout(slowNoticeTimer);
      window.clearTimeout(watchdogTimer);
      updateResidentPerf({
        residentInterfaceRefreshMode: currentResidentInterfaceRefreshMode(),
        residentInterfaceRefreshPending: Boolean(pendingResidentInterfaceRefreshPromise),
        lastResidentCycleMs: performance.now() - residentStartMs,
        lastResidentPostComputeMs: Math.max(
          0,
          (performance.now() - residentStartMs) - Number(residentPerf.lastResidentMs || 0)
        )
      });
      if (
        pendingMlsMpmResidentStepsSignature === signature
        && pendingMlsMpmResidentStepsToken === scheduleToken
      ) {
        pendingMlsMpmResidentStepsSignature = null;
      }
      if (scheduleLatestGeneration && overlay.isConnected && !resetRebuildPending) {
        window.requestAnimationFrame(() => {
          if (!overlay.isConnected || resetRebuildPending) return;
          scheduleMlsMpmResidentSteps({
            stepCount: normalizedStepCount,
            readbackMode,
            continueFromResidentState: false,
            continuationBudget,
            generation: particleSyncGeneration
          });
        });
      } else if (scheduleContinuation && overlay.isConnected && generation === particleSyncGeneration) {
        window.requestAnimationFrame(() => {
          if (!overlay.isConnected || generation !== particleSyncGeneration) return;
          scheduleMlsMpmResidentSteps({
            stepCount: normalizedStepCount,
            readbackMode,
            continueFromResidentState: true,
            continuationBudget: continuationBudget - 1,
            generation
          });
        });
      } else if (restartPlaybackContinuation && overlay.isConnected && generation === particleSyncGeneration) {
        window.requestAnimationFrame(() => {
          if (!overlay.isConnected || !playing || generation !== particleSyncGeneration) return;
          scheduleMlsMpmResidentSteps({
            stepCount: normalizedStepCount,
            readbackMode,
            continueFromResidentState: true,
            continuationBudget: RESIDENT_CONTINUATION_CHAIN_BUDGET,
            generation
          });
        });
      }
    });
  }

  async function refreshResidentRenderForCurrentMode(reason = 'render-mode-change') {
    const mode = currentResidentSurfaceDrawDiagnosticMode();
    const token = renderModeRefreshToken + 1;
    renderModeRefreshToken = token;
    publishRenderModeSelection('render-mode-refresh-pending', { reason, token });
    const execution = scene.getMlsMpmResidentSteps?.() || overlay.__mlsMpmResidentSteps || null;
    if (!execution?.schema || execution?.backend !== 'webgpu') {
      publishRenderModeSelection('render-mode-resident-state-pending', {
        reason,
        token,
        residentBackend: execution?.backend || 'pending'
      });
      scheduleMlsMpmResidentSteps({
        stepCount: currentResidentStepsPerSchedule(),
        generation: particleSyncGeneration,
        force: true
      });
      renderStatus();
      updateWarningBanner();
      return null;
    }
    const renderStartMs = performance.now();
    const nativeSurfaceConsumerRefresh = residentSurfaceDrawModeUsesNativeSurfaceConsumer(mode);
    try {
      const renderState = await scene.refreshSphResidentRenderState?.({
        preferWebGpu: true,
        residentSteps: execution,
        materialProperties: activeMaterialProperties(),
        gasPressureSummary: currentGasPressureSummary(
          overlay.__sphResidentGasPressureSummary
            || activeViewStateGasPressure
            || (driver?.demo ? gasPressureSummary(driver.demo) : null)
        ),
        residentAuthorityHost: currentResidentAuthorityHostForScene(),
        pressureInterfaceGasCellFieldImport:
          scene.getSphResidentPressureInterfaceState?.()?.pressureInterfaceGasCellFieldImport || null,
        pressureInterfaceGasCellFieldAdmission:
          scene.getSphResidentPressureInterfaceState?.()?.pressureInterfaceGasCellFieldAdmission || null,
        pressureInterfaceGasCellFieldImportStateKey: execution?.computeManagerTask?.stateKey || null,
        renderFieldReadbackMode: nativeSurfaceConsumerRefresh ? SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT : undefined,
        renderRowsReadbackMode: nativeSurfaceConsumerRefresh ? SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT : undefined,
        renderFieldSurfaceSummaryMode:
          (residentSurfaceDrawModeUsesCompactBridge(mode) || nativeSurfaceConsumerRefresh) ? 'skip' : 'auto',
        surfaceDrawDiagnosticMode: mode,
        surfaceDrawDiagnosticModeExplicit: residentSurfaceDrawDiagnosticModeExplicit,
        allowNativeSurfaceExtraction: nativeSurfaceConsumerRefresh ? true : undefined
      });
      if (token !== renderModeRefreshToken) return renderState;
      overlay.__sphResidentRenderState = annotateResidentRenderStateCadence(renderState, {
        cadence: RESIDENT_RENDER_READBACK_CADENCE,
        effectiveCadence: 1,
        forced: true,
        forceReason: reason,
        reason,
        sequence: residentRenderReadbackSequence + 1,
        skipped: false,
        renderReadbackCount: residentRenderReadbackCount + 1,
        skippedCount: residentRenderReadbackSkippedCount
      });
      overlay.__sphResidentSurfaceDraw = scene.getSphResidentSurfaceDraw?.() || null;
      overlay.__sphResidentSurfaceDrawOverlayPolicy = scene.getSphResidentSurfaceDrawOverlayPolicy?.() || null;
      overlay.__sphResidentPressureInterfaceState = scene.getSphResidentPressureInterfaceState?.() || null;
      overlay.__sphResidentRenderStateError = null;
      residentRenderReadbackSequence += 1;
      residentRenderReadbackCount += 1;
      updateResidentPerf({
        renderReadbacks: residentRenderReadbackCount,
        skippedRenderReadbacks: residentRenderReadbackSkippedCount,
        effectiveRenderReadbackCadence: 1,
        playbackVisualRefreshForced: true,
        lastRenderReadbackMs: performance.now() - renderStartMs,
        lastRenderReadbackSkipped: false
      });
      publishRenderModeSelection('render-mode-refresh-complete', {
        reason,
        token,
        visibleRendererBridge:
          overlay.__sphResidentSurfaceDraw?.visibleRendererBridge
          || renderState?.surfaceDrawVisibleRendererBridge
          || null,
        renderStateStatus: renderState?.status || null
      });
      renderStatus();
      updateWarningBanner();
      return renderState;
    } catch (error) {
      if (token !== renderModeRefreshToken) return null;
      const message = error instanceof Error ? error.message : String(error);
      overlay.__sphResidentRenderStateError = message;
      publishRenderModeSelection('render-mode-refresh-error', {
        reason,
        token,
        error: message
      });
      renderStatus();
      updateWarningBanner();
      return null;
    }
  }

  // Blob size is live: update the scene's surface scale and re-render without a reset.
  blobInput.addEventListener('input', () => { scene.setSurfaceRadiusScale(blobScaleOf()); syncParticles(); });
  function applyBackgroundImageFromControl(reason = 'background-image-control-input') {
    overlay.__sphSceneBackgroundImage = scene.setBackgroundImage?.(backgroundImageSelect.value || null, { reason }) || null;
  }
  backgroundImageSelect.addEventListener('change', () => {
    applyBackgroundImageFromControl('background-image-control-change');
    syncUrlFromControls();
  });
  function applyBackgroundColorFromControl(reason = 'background-color-control-input') {
    overlay.__sphSceneBackgroundColor = scene.setBackgroundColor?.(backgroundColorOf(), { reason }) || null;
    syncUrlFromControls();
    renderStatus();
    updateWarningBanner();
    return overlay.__sphSceneBackgroundColor;
  }
  backgroundColorInput.addEventListener('input', () => {
    applyBackgroundColorFromControl('background-color-control-input');
  });
  renderModeSelect.addEventListener('change', () => {
    residentSurfaceDrawDiagnosticModeExplicit = true;
    const selectedMode = currentResidentSurfaceDrawDiagnosticMode();
    syncUrlFromControls();
    const requiredBackend = sphRendererBackendRequiredForRenderMode(selectedMode);
    if (requiredBackend !== initialSphRendererBackend) {
      // The renderer backend is fixed at mount time; a cross-backend mode
      // change (e.g. native surface -> three-render-row spheres) would leave
      // the new bridge unrendered. The URL was just synced with the mode and
      // its required backend, so reload into the working configuration.
      publishRenderModeSelection('render-mode-renderer-backend-reload', {
        requiredRendererBackend: requiredBackend,
        mountedRendererBackend: initialSphRendererBackend
      });
      globalThis.location?.reload?.();
      return;
    }
    refreshResidentRenderForCurrentMode('render-mode-control-change');
  });

  function dimensionsEqual(a, b, tolerance = 1e-9) {
    return Array.isArray(a)
      && Array.isArray(b)
      && a.length >= 3
      && b.length >= 3
      && Math.abs(Number(a[0]) - Number(b[0])) <= tolerance
      && Math.abs(Number(a[1]) - Number(b[1])) <= tolerance
      && Math.abs(Number(a[2]) - Number(b[2])) <= tolerance;
  }

  function clearSceneDerivedSignatures() {
    pendingOpticalLookupSignature = null;
    pendingSphGpuParticleUploadSignature = null;
    pendingMlsMpmGpuParticleUploadSignature = null;
    pendingMlsMpmMechanicsPredictionSignature = null;
    pendingMlsMpmP2gGridProjectionSignature = null;
    pendingMlsMpmGridUpdateSignature = null;
    pendingMlsMpmG2pReconstructionSignature = null;
    pendingMlsMpmResidentStepsSignature = null;
  }

  function invalidateResidentRuntimeForReset(reason = 'demo-rebuild') {
    resetRebuildPending = true;
    particleSyncGeneration += 1;
    pendingMlsMpmResidentStepsToken += 1;
    disposeMountedMechanicsStageWorkerRunner(`${reason}-resident-reset`);
    clearSceneDerivedSignatures();
    scene.resetResidentStateForParticleReset?.({ reason, clearOverlay: true });
    overlay.__sphLastStepResult = null;
    overlay.__sphResidentRenderState = null;
    overlay.__sphResidentRenderStateError = null;
    overlay.__sphResidentRenderReadbackCadence = null;
    overlay.__sphResidentMaterialInterfaceState = null;
    overlay.__sphResidentMaterialInterfaceStateError = null;
    overlay.__sphResidentPressureInterfaceState = null;
    overlay.__sphResidentPressureInterfaceStateError = null;
    overlay.__sphResidentSurfaceDraw = null;
    overlay.__sphResidentSurfaceDrawOverlayPolicy = scene.getSphResidentSurfaceDrawOverlayPolicy?.() || null;
    overlay.__sphResidentGasPressureSummary = null;
    overlay.__sphSchroederAdoptedParticleStorage = null;
    overlay.__sphSchroederAdoptedParticleStoragePublication = null;
    overlay.__mlsMpmP2gGridProjection = null;
    overlay.__mlsMpmGridUpdate = null;
    overlay.__mlsMpmG2pReconstruction = null;
    overlay.__mlsMpmResidentStep = null;
    overlay.__mlsMpmResidentSteps = null;
    overlay.__mlsMpmResidentStepsError = null;
    overlay.__mlsMpmResidentStepsPending = null;
    overlay.__mlsMpmResidentStepsSlow = null;
    overlay.__mlsMpmResidentStepsStale = null;
    overlay.__mlsMpmResidentSourceMode = 'reset-pending-rebuild';
    overlay.__mlsMpmResidentContinuedFromResidentState = false;
    overlay.__mlsMpmResidentContinuationAvailable = false;
    overlay.__sphResetStatus = {
      schema: 'peercompute.ulg.sph-demo-reset-status.v0',
      status: 'resident-state-invalidated-for-reset',
      reason,
      generation: particleSyncGeneration,
      updatedAtMs: performance.now()
    };
    publishResidentStageOrderTrace({
      status: 'resident-reset-invalidated',
      reason,
      generation: particleSyncGeneration
    });
    residentRenderReadbackSequence = 0;
    residentRenderReadbackCount = 0;
    residentRenderReadbackSkippedCount = 0;
    residentAccumulatedSubvisibleMotionM = 0;
    residentSubvisibleMotionBurstCount = 0;
    resetResidentPerf(reason);
  }

  function resetSceneForDimensions(boxDimsM, resetReason) {
    const nextDims = Array.isArray(boxDimsM) ? [...boxDimsM] : boxDimensionsFromControls();
    disposeMountedMechanicsStageWorkerRunner(`${resetReason}-scene-reset`);
    if (dimensionsEqual(sceneBoxDimsM, nextDims)) {
      scene.setResidentAuthorityHost?.(currentResidentAuthorityHostForScene());
      scene.setSurfaceRadiusScale(blobScaleOf());
      overlay.__sphSceneBackgroundColor = scene.setBackgroundColor?.(backgroundColorOf(), {
        reason: `${resetReason}-scene-reused`,
        refresh: false
      }) || null;
      if (backgroundImageSelect.value) {
        overlay.__sphSceneBackgroundImage = scene.setBackgroundImage?.(backgroundImageSelect.value, {
          reason: `${resetReason}-scene-reused`,
          refresh: false
        }) || null;
      }
      scene.resetResidentStateForParticleReset?.({
        reason: `${resetReason}-scene-reused`,
        clearOverlay: true
      });
      clearSceneDerivedSignatures();
      overlay.__sphResidentRenderState = null;
      overlay.__sphResidentRenderStateError = null;
      overlay.__sphResidentMaterialInterfaceState = null;
      overlay.__sphResidentMaterialInterfaceStateError = null;
      overlay.__sphResidentPressureInterfaceState = null;
      overlay.__sphResidentPressureInterfaceStateError = null;
      overlay.__sphResidentSurfaceDraw = scene.getSphResidentSurfaceDraw?.() || null;
      overlay.__sphResidentSurfaceDrawOverlayPolicy = scene.getSphResidentSurfaceDrawOverlayPolicy?.() || null;
      overlay.__sphSchroederAdoptedParticleStorage = null;
      overlay.__sphSchroederAdoptedParticleStoragePublication = null;
      overlay.__sphGpuParticleUpload = scene.getSphGpuParticleUpload?.() || null;
      overlay.__mlsMpmGpuParticleUpload = scene.getMlsMpmGpuParticleUpload?.() || null;
      resetResidentPerf(`${resetReason}-scene-reused`);
      overlay.__sphSceneReuseStatus = {
        schema: 'peercompute.ulg.sph-scene-reuse-status.v0',
        status: 'reused-existing-scene',
        reason: resetReason,
        dimensionsM: [...nextDims],
        updatedAtMs: performance.now()
      };
      return;
    }
    scene.dispose();
    sceneBoxDimsM = nextDims;
    scene = createSphPhaseScene(sceneContainer, {
      boxDimsM: nextDims,
      surfaceRadiusScale: blobScaleOf(),
      preserveDrawingBuffer: preserveDrawingBufferForCapture,
      rendererBackend: initialSphRendererBackend,
      rendererWebGpuPresentation: initialThreeWebGpuRendererPresentationEnabled,
      rendererWebGpuResidentDevice: initialThreeWebGpuRendererResidentDeviceEnabled,
      rendererWebGpuPresentationUnsafe: initialThreeWebGpuRendererPresentationUnsafe,
      rendererWebGpuSurfaceBufferPresentation: initialThreeWebGpuSurfaceBufferPresentationEnabled,
      rendererWebGpuDeviceResult: initialRendererWebGpuDeviceResult,
      residentSurfaceDrawOverlay: residentSurfaceDrawOverlayMode,
      residentSurfaceDrawDiagnosticMode: currentResidentSurfaceDrawDiagnosticMode(),
      backgroundColor: backgroundColorOf(),
      nativeSurfacePixelValidation: nativeSurfacePixelValidationEnabled,
      workerOffscreenPresentation: workerOffscreenPresentationEnabled,
      renderOwnershipPolicy: initialPeerComputeRenderOwnershipPolicy,
      materialInterfaceSurfaceTablePolicy: initialMaterialInterfaceSurfaceTablePolicy,
      residentAuthorityHost: currentResidentAuthorityHostForScene()
    });
    applySchroederRenderProxyOverlayFlag(scene);
    overlay.__sphScene = scene;
    overlay.__sphSceneBackgroundColor = scene.scene?.userData?.sphSceneBackgroundColor || null;
    overlay.__sphPeerComputeRenderOwnershipPolicy =
      scene.getPeerComputeRenderOwnershipPolicy?.()
      || scene.scene?.userData?.sphPeerComputeRenderOwnershipPolicy
      || initialPeerComputeRenderOwnershipPolicy;
    overlay.__sphWorkerOffscreenPresentation = scene.getWorkerOffscreenPresentation?.() || null;
    overlay.__sphOpticalGpuLookup = scene.getOpticalGpuLookup?.() || null;
    overlay.__sphThermalMaterialTable = scene.getSphThermalMaterialTable?.() || null;
    overlay.__sphReactionTable = scene.getSphReactionTable?.() || null;
    overlay.__sphResidentRenderState = scene.getSphResidentRenderState?.() || null;
    overlay.__sphResidentPressureInterfaceState = scene.getSphResidentPressureInterfaceState?.() || null;
    overlay.__sphResidentSurfaceDraw = scene.getSphResidentSurfaceDraw?.() || null;
    overlay.__sphResidentSurfaceDrawOverlayPolicy = scene.getSphResidentSurfaceDrawOverlayPolicy?.() || null;
    overlay.__sphSchroederAdoptedParticleStorage = null;
    overlay.__sphSchroederAdoptedParticleStoragePublication = null;
    overlay.__sphGpuParticleState = scene.getSphGpuParticleState?.() || null;
    overlay.__sphGpuParticleUpload = scene.getSphGpuParticleUpload?.() || null;
    overlay.__mlsMpmGpuParticleState = scene.getMlsMpmGpuParticleState?.() || null;
    overlay.__mlsMpmGpuParticleUpload = scene.getMlsMpmGpuParticleUpload?.() || null;
    overlay.__mlsMpmMechanicsPrediction = scene.getMlsMpmMechanicsPrediction?.() || null;
    overlay.__mlsMpmP2gGridProjection = scene.getMlsMpmP2gGridProjection?.() || null;
    overlay.__mlsMpmGridUpdate = scene.getMlsMpmGridUpdate?.() || null;
    overlay.__mlsMpmG2pReconstruction = scene.getMlsMpmG2pReconstruction?.() || null;
    overlay.__mlsMpmResidentStep = scene.getMlsMpmResidentStep?.() || null;
    overlay.__mlsMpmResidentSteps = scene.getMlsMpmResidentSteps?.() || null;
    overlay.__mlsMpmResidentRequestedReadbackMode = scene.getMlsMpmResidentRequestedReadbackMode?.() || SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT;
    clearSceneDerivedSignatures();
    resetResidentPerf(resetReason);
    overlay.__sphSceneReuseStatus = {
      schema: 'peercompute.ulg.sph-scene-reuse-status.v0',
      status: 'recreated-scene',
      reason: resetReason,
      dimensionsM: [...nextDims],
      updatedAtMs: performance.now()
    };
  }

  function applyWorkerCacheLookup(lookup) {
    if (!lookup?.schema) return false;
    peerClosureCacheLookup = lookup.peerClosureCacheLookup || peerClosureCacheLookup;
    sphColdStartCacheLookup = lookup.sphColdStartCacheLookup || sphColdStartCacheLookup;
    peerClosureCacheConsumed = Object.keys(peerClosureCacheLookup?.closures || {}).length > 0;
    overlay.__sphWorkerCacheLookup = {
      schema: lookup.schema,
      status: lookup.status,
      timing: lookup.timing || null,
      materialHits: peerClosureCacheLookup?.hitCount ?? 0,
      materialMisses: peerClosureCacheLookup?.missCount ?? 0,
      reactionStatus: sphColdStartCacheLookup?.status || null,
      reactionRecords: sphColdStartCacheLookup?.reactionCount ?? 0,
      productReuseRecords: sphColdStartCacheLookup?.productReuseCount ?? 0
    };
    return true;
  }

  function persistWorkerCacheSnapshot(storageKey, snapshot) {
    if (!storageAvailable() || typeof snapshot !== 'string') {
      return { status: 'skipped', bytes: 0 };
    }
    try {
      window.localStorage.setItem(storageKey, snapshot);
      return { status: 'stored', bytes: snapshot.length };
    } catch (error) {
      return {
        status: 'write-error',
        bytes: snapshot.length,
        reason: error instanceof Error ? error.message : String(error)
      };
    }
  }

  function applyWorkerCachePersistence(persistence) {
    if (!persistence?.schema) return false;
    const materialStore = persistWorkerCacheSnapshot(
      PEER_CLOSURE_CACHE_STORAGE_KEY,
      persistence.material?.cacheSnapshot
    );
    const coldStore = persistWorkerCacheSnapshot(
      SPH_COLD_START_CACHE_STORAGE_KEY,
      persistence.coldStart?.cacheSnapshot
    );
    peerClosureCacheWrite = {
      ...(persistence.material?.summary || {}),
      storageWriteStatus: materialStore.status,
      storageWriteBytes: materialStore.bytes,
      storageWriteReason: materialStore.reason || null
    };
    sphColdStartCacheWrite = {
      ...(persistence.coldStart?.summary || {}),
      storageWriteStatus: coldStore.status,
      storageWriteBytes: coldStore.bytes,
      storageWriteReason: coldStore.reason || null
    };
    overlay.__sphWorkerCachePersistence = {
      schema: persistence.schema,
      status: persistence.status,
      timing: persistence.timing || null,
      materialStore,
      coldStore,
      material: persistence.material?.summary || null,
      coldStart: persistence.coldStart?.summary || null
    };
    return materialStore.status === 'stored' || coldStore.status === 'stored';
  }

  function applyWorkerStaticTableCache(result) {
    const update = result?.staticTableCacheUpdate || null;
    const snapshot = result?.staticTableCacheSnapshot || update?.cacheSnapshot || null;
    if (!update?.schema || typeof snapshot !== 'string') return false;
    const storage = persistStaticTableCacheSnapshot({ ...update, cacheSnapshot: snapshot });
    sphStaticTableCacheSummary = compactStaticTableSummary(result?.staticTableCacheSummary || null);
    sphStaticTableCacheWrite = compactStaticTableCacheUpdate(
      { ...update, cacheSnapshot: snapshot },
      {
        backend: 'cpu-worker-rebuild',
        storage,
        readyBundle: Boolean(result?.staticTableCacheBundle?.hitCount)
      }
    );
    if (result?.staticTableCacheBundle?.hitCount > 0) {
      rememberStaticTableCacheBundle(result.staticTableCacheBundle, {
        signature: staticTableSnapshotSignature(snapshot),
        durationMs: update?.timing?.totalMs || 0,
        backend: 'cpu-worker-rebuild'
      });
    } else {
      scheduleStaticTableCacheRead({ reason: 'worker-rebuild-static-cache', snapshot, force: true });
    }
    return true;
  }

  function applyWorkerRebuildResult(result, generation) {
    const artifact = result?.artifact || null;
    const outputs = artifact?.outputs || result?.outputs || {};
    const viewState = result?.viewState || outputs.viewState;
    if (!viewState?.positionsM || generation !== workerRebuildGeneration) {
      return false;
    }
    driver = null;
    activeViewStatePreflight = result?.preflight || outputs.preflight || null;
    overlay.__sphPhasePreflight = activeViewStatePreflight;
    activeViewStateTotals = result?.totals || outputs.totals || viewState.totals || null;
    activeViewStatePhaseSummary = result?.phaseMassSummary || outputs.phaseMassSummary || viewState.phaseMassSummary || null;
    activeViewStateGasPressure = result?.gasPressureSummary || outputs.gasPressureSummary || viewState.gasPressureSummary || null;
    const workerTiming = outputs.timing || artifact?.execution?.timing || null;
    blockedError = null;
    applyWorkerCacheLookup(result?.cacheLookup || outputs.cacheLookup);
    const persistedWorkerCache = applyWorkerCachePersistence(result?.cachePersistence || outputs.cachePersistence);
    if (!persistedWorkerCache) {
      writeLocalCachePersistence(
        viewState.materialProperties || {},
        viewState.reactionDiscovery,
        'worker-result-persistence-fallback'
      );
    }
    applyWorkerStaticTableCache(result);
    publishPeerClosureCacheState();
    overlay.__sphPhaseWorkerTiming = workerTiming;
    overlay.__sphPhaseRebuildWorker = {
      schema: SPH_PHASE_REBUILD_WORKER_STATUS_SCHEMA,
      status: 'complete',
      rootTaskId: result?.rootTaskId || activeWorkerRebuildTask?.rootTaskId || null,
      artifactRef: result?.artifactRef || null,
      generation,
      backend: artifact?.execution?.backend || 'cpu-worker',
      materialKeys: outputs.materialKeys || outputs.viewStateSummary?.materialKeys || Object.keys(viewState.materialProperties || {}),
      timing: workerTiming,
      directViewState: Boolean(result?.viewState),
      artifactViewStateSummary: outputs.viewStateSummary || null,
      updatedAtMs: performance.now()
    };
    resetSceneForDimensions(viewState.box?.dimensionsM || boxDimensionsFromControls(), 'worker-rebuild');
    overlay.__sphDriver = null;
    syncParticles(viewState, 'peercompute-worker-packed-state');
    renderStatus();
    updateWarningBanner();
    if (residentAutoStartEnabled) startWorkerResidentPlayback();
    return true;
  }

  function rebuildDemoFromControls() {
    playing = false;
    overlay.querySelector('#sph-play').textContent = 'Play';
    driver = createDriverFromControls();
    activeViewStatePreflight = null;
    // The box dimensions may have changed, so rebuild the scene (its field/wireframe/camera are
    // sized to the box at creation) against the new driver's box.
    resetSceneForDimensions(driver?.demo.box.dimensionsM ?? boxDimensionsFromControls(), 'demo-rebuild');
    overlay.__sphDriver = driver;
    syncParticles();
    renderStatus();
    updateWarningBanner();
  }

  function ensureInteractiveDriverFromCache() {
    if (driver) return true;
    if (cpuClosureTask?.active || (cacheMissDerivationPending() && !cacheReadyForInteractiveDriver())) {
      renderStatus();
      updateWarningBanner();
      return false;
    }
    const startMs = performance.now();
    const next = createDriverFromControls({ preferActiveViewStateCache: true });
    recordPerformanceSpan('main-thread interactive driver from cache', startMs, performance.now(), {
      status: next ? 'ready' : 'blocked',
      cacheStatus: next?.demo?.reactionDiscovery?.cache?.cacheStatus || null
    });
    if (!next) {
      renderStatus();
      updateWarningBanner();
      return false;
    }
    driver = next;
    activeViewStatePreflight = null;
    resetSceneForDimensions(driver?.demo.box.dimensionsM ?? boxDimensionsFromControls(), 'interactive-driver-from-cache');
    overlay.__sphDriver = driver;
    syncParticles();
    renderStatus();
    updateWarningBanner();
    return true;
  }

  function cancelWorkerRebuildForReset(reason = 'demo-rebuild') {
    const gate = workerRebuildResetGate({
      currentGeneration: workerRebuildGeneration,
      activeTask: activeWorkerRebuildTask,
      reason,
      nowMs: performance.now()
    });
    workerRebuildGeneration = gate.generation;
    activeWorkerRebuildTask = gate.activeWorkerRebuildTask;
    overlay.__sphPhaseRebuildWorker = gate.workerStatus;
    return gate;
  }

  function scheduleWorkerDemoRebuild({ reason = 'control-rebuild' } = {}) {
    const generation = workerRebuildGeneration + 1;
    workerRebuildGeneration = generation;
    const submittedAtMs = performance.now();
    const controlOptions = driverOptionsFromControls();
    const taskOptions = workerRebuildTaskOptions(controlOptions);
    activeWorkerRebuildTask = {
      generation,
      status: 'submitted',
      reason,
      optionsHash: JSON.stringify({
        drop: controlOptions.dropMaterial,
        base: controlOptions.baseMaterial,
        counts: [controlOptions.dropParticleEdge, controlOptions.baseParticleEdge],
        box: controlOptions.scenario?.box?.dimensionsM
      }),
      submittedAtMs
    };
    overlay.__sphPhaseRebuildWorker = {
      schema: SPH_PHASE_REBUILD_WORKER_STATUS_SCHEMA,
      ...activeWorkerRebuildTask
    };
    setCpuClosureTask({
      label: 'material/reaction/closure rebuild',
      location: 'ulg-runtime worker',
      reason: 'supervised PeerCompute sph.phase.rebuild task'
    });
    statusEl.textContent = 'submitting material state and derived chemistry to ulg-runtime worker...';
    Promise.resolve(runtime.runSphPhaseRebuild(taskOptions)).then((result) => {
      if (generation !== workerRebuildGeneration) return;
      activeWorkerRebuildTask = {
        ...activeWorkerRebuildTask,
        rootTaskId: result?.rootTaskId || null,
        status: 'complete'
      };
      const artifact = result?.artifact || null;
      recordPerformanceSpan('ulg-runtime worker createSphPhaseDemo', submittedAtMs, performance.now(), {
        reason,
        backend: artifact?.execution?.backend || 'cpu-worker',
        reactionCount: result?.viewState?.reactions?.length
          ?? artifact?.outputs?.viewStateSummary?.reactionCount
          ?? artifact?.outputs?.viewState?.reactions?.length
          ?? 0,
        materialCount: Object.keys(result?.viewState?.materialProperties || {}).length
          || artifact?.outputs?.viewStateSummary?.materialKeys?.length
          || Object.keys(artifact?.outputs?.viewState?.materialProperties || {}).length
      });
      applyWorkerRebuildResult(result, generation);
    }).catch((error) => {
      if (generation !== workerRebuildGeneration) return;
      recordPerformanceSpan('ulg-runtime worker createSphPhaseDemo failed', submittedAtMs, performance.now(), {
        reason,
        error: error instanceof Error ? error.message : String(error)
      });
      overlay.__sphPhaseRebuildWorker = {
        schema: SPH_PHASE_REBUILD_WORKER_STATUS_SCHEMA,
        status: 'fallback-main-thread',
        generation,
        reason: error instanceof Error ? error.message : String(error),
        updatedAtMs: performance.now()
      };
      setCpuClosureTask({
        label: 'material/reaction/closure rebuild',
        location: 'main thread fallback',
        reason: error instanceof Error ? error.message : String(error)
      });
      rebuildDemoFromControls();
    }).finally(() => {
      if (generation === workerRebuildGeneration) {
        activeWorkerRebuildTask = null;
        setCpuClosureTask(null);
        publishPeerClosureCacheState();
        renderStatus();
        updateWarningBanner();
      }
    });
  }

  function scheduleDemoRebuild() {
    syncUrlFromControls();
    if (rebuildTimer != null) window.clearTimeout(rebuildTimer);
    playing = false;
    overlay.querySelector('#sph-play').textContent = 'Play';
    invalidateResidentRuntimeForReset('demo-rebuild');
    const canUseWorkerRebuild = typeof runtime?.runSphPhaseRebuild === 'function';
    if (canUseWorkerRebuild) cancelWorkerRebuildForReset('demo-rebuild');
    const rebuildLocation = canUseWorkerRebuild ? 'ulg-runtime worker' : 'main thread';
    setCpuClosureTask({
      label: 'material/reaction/closure rebuild',
      location: rebuildLocation,
      reason: canUseWorkerRebuild
        ? 'supervised PeerCompute sph.phase.rebuild task'
        : 'ulg-runtime worker unavailable'
    });
    statusEl.textContent = 'rebuilding material state and derived chemistry...';
    rebuildTimer = window.setTimeout(() => {
      rebuildTimer = null;
      if (canUseWorkerRebuild) {
        scheduleWorkerDemoRebuild();
        return;
      }
      try {
        rebuildDemoFromControls();
      } finally {
        setCpuClosureTask(null);
        publishPeerClosureCacheState();
        renderStatus();
        updateWarningBanner();
      }
    }, 0);
  }

  function clearLocalDerivedCachesAndRebuild() {
    const startMs = performance.now();
    sphCacheClearStatus = clearSphLocalDerivedCaches();
    peerClosureCacheLookup = null;
    peerClosureCacheWrite = null;
    peerClosureCacheConsumed = false;
    sphColdStartCacheLookup = null;
    sphColdStartCacheWrite = null;
    staticTableCacheReadGeneration += 1;
    staticTableCacheBundle = null;
    staticTableCacheBundleSignature = null;
    staticTableCacheStorageSignature = 'empty';
    sphStaticTableCacheRead = null;
    sphStaticTableCacheWrite = null;
    sphStaticTableCacheSummary = null;
    recordPerformanceSpan('clear local derived caches', startMs, performance.now(), {
      materialRecords: sphCacheClearStatus.materialRecords ?? 0,
      reactionRecords: sphCacheClearStatus.reactionRecords ?? 0,
      productReuseRecords: sphCacheClearStatus.productReuseRecords ?? 0,
      tableRecords: sphCacheClearStatus.tableRecords ?? 0,
      gpuWarmupRecords: sphCacheClearStatus.gpuWarmupRecords ?? 0
    });
    publishPeerClosureCacheState();
    renderStatus();
    updateWarningBanner();
    scheduleDemoRebuild();
  }

  for (const [key, el] of Object.entries(urlControls)) {
    if (key === 'scenario') {
      el.addEventListener('change', () => {
        const entry = sphPhaseScenarioPresetById(el.value);
        if (!entry) {
          syncUrlFromControls();
          return;
        }
        for (const [controlKey, value] of Object.entries(entry.controls)) {
          const control = urlControls[controlKey];
          if (control) applyUrlValueToControl(controlKey, control, value);
        }
        scheduleDemoRebuild();
      });
    } else if (key === 'blob') {
      el.addEventListener('change', syncUrlFromControls);
    } else if (key === 'bg') {
      el.addEventListener('change', () => applyBackgroundColorFromControl('background-color-control-change'));
    } else if (key === 'bgimg') {
      // Background image changes are render-only; the change listener added
      // at control creation already applies + syncs the URL. No demo rebuild.
    } else {
      el.addEventListener('change', () => {
        scenarioPresetSelect.value = 'custom';
        scheduleDemoRebuild();
      });
    }
  }

  function activeMaterialProperties() {
    return driver?.demo?.materialProperties || activeViewState?.materialProperties || {};
  }

  function syncParticles(viewStateOverride = null, sourceMode = 'cpu-packed-state') {
    particleSyncGeneration += 1;
    const viewState = viewStateOverride || (driver ? createSphPhaseViewState(driver) : null);
    if (!viewState) {
      activeViewState = null;
      activeViewStateTotals = null;
      activeViewStatePhaseSummary = null;
      activeViewStateGasPressure = null;
      scene.setParticles({
        positionsM: new Float32Array(0),
        colorsRgb: new Float32Array(0),
        particleRadiiM: new Float32Array(0),
        materials: [],
        reactions: [],
        physicalLawGroups: physicalLawGroupsFromControls()
      });
      overlay.__sphPhysicalLawGroups = physicalLawGroupsFromControls();
      overlay.__sphResidentRenderState = scene.getSphResidentRenderState?.() || null;
      overlay.__sphResidentPressureInterfaceState = scene.getSphResidentPressureInterfaceState?.() || null;
      overlay.__sphResidentSurfaceDraw = scene.getSphResidentSurfaceDraw?.() || null;
      overlay.__sphResidentSurfaceDrawOverlayPolicy = scene.getSphResidentSurfaceDrawOverlayPolicy?.() || null;
      return;
    }
    activeViewState = viewState;
    activeViewStateTotals = viewState.totals || null;
    activeViewStatePhaseSummary = viewState.phaseMassSummary || null;
    activeViewStateGasPressure = viewState.gasPressureSummary || null;
    activeViewStateSource = sourceMode;
    overlay.__sphPhaseViewState = viewState;
    overlay.__sphPhaseViewStateSource = sourceMode;
    const staticTableCache = readStaticTableCacheBundle();
    scene.setParticles({
      positionsM: viewState.positionsM,
      colorsRgb: viewState.colorsRgb,
      particleRadiiM: viewState.particleRadiiM,
      materials: viewState.materials,
      emissiveByMaterial: viewState.emissiveByMaterial,
      emissiveTemperatureByMaterial: viewState.emissiveTemperatureByMaterial ?? null,
      materialProperties: viewState.materialProperties,
      reactions: viewState.reactions,
      reactionContactRadiusM: viewState.reactionContactRadiusM,
      sphGpuParticleState: viewState.sphGpuParticleState,
      mlsMpmGpuParticleState: viewState.mlsMpmGpuParticleState,
      renderDomainCounts: viewState.counts,
      physicalLawGroups: physicalLawGroupsFromControls(),
      wallTemperaturesK: viewState.wallTemperaturesK || viewState.scenario?.walls?.faces || null,
      staticTableCache
    });
    resetRebuildPending = false;
    if (overlay.__sphResetStatus?.status === 'resident-state-invalidated-for-reset') {
      overlay.__sphResetStatus = {
        ...overlay.__sphResetStatus,
        status: 'particle-state-resynced-after-reset',
        completedAtMs: performance.now()
      };
      publishResidentStageOrderTrace({
        status: 'resident-reset-particle-state-resynced',
        reason: sourceMode,
        generation: particleSyncGeneration,
        particleCount: Math.floor((viewState.positionsM?.length || 0) / 3)
      });
    }
    overlay.__sphPhysicalLawGroups = physicalLawGroupsFromControls();
    overlay.__sphOpticalGpuLookup = scene.getOpticalGpuLookup?.() || null;
    overlay.__sphThermalMaterialTable = scene.getSphThermalMaterialTable?.() || null;
    overlay.__sphReactionTable = scene.getSphReactionTable?.() || null;
    overlay.__sphResidentRenderState = scene.getSphResidentRenderState?.() || null;
    overlay.__sphResidentPressureInterfaceState = scene.getSphResidentPressureInterfaceState?.() || null;
    overlay.__sphResidentSurfaceDraw = scene.getSphResidentSurfaceDraw?.() || null;
    overlay.__sphResidentSurfaceDrawOverlayPolicy = scene.getSphResidentSurfaceDrawOverlayPolicy?.() || null;
    overlay.__sphGpuParticleState = scene.getSphGpuParticleState?.() || null;
    overlay.__mlsMpmGpuParticleState = scene.getMlsMpmGpuParticleState?.() || null;
    overlay.__mlsMpmGridUpdate = scene.getMlsMpmGridUpdate?.() || null;
    overlay.__mlsMpmG2pReconstruction = scene.getMlsMpmG2pReconstruction?.() || null;
    overlay.__mlsMpmResidentStep = scene.getMlsMpmResidentStep?.() || null;
    overlay.__mlsMpmResidentSteps = scene.getMlsMpmResidentSteps?.() || null;
    overlay.__sphSetParticlesTiming = scene.scene?.userData?.sphSetParticlesTiming || null;
    overlay.__sphSameMaterialDomainMergeDiagnostics =
      scene.scene?.userData?.sphSameMaterialDomainMergeDiagnostics || null;
    overlay.__sphSurfaceApplyTiming = scene.scene?.userData?.sphSurfaceApplyTiming || null;
    overlay.__mlsMpmResidentSourceMode = sourceMode;
    overlay.__mlsMpmResidentContinuedFromResidentState = false;
    overlay.__mlsMpmResidentContinuationAvailable = false;
    if (!staticTableCache?.hitCount && !staticTableCacheTaskPending()) {
      scheduleStaticTableCacheUpdate({ reason: sourceMode });
    }
    publishPeerClosureCacheState();
    scheduleOpticalGpuLookupRefresh();
    if (overlay.__sphStandaloneMechanicsPredictionEnabled) {
      scheduleMlsMpmMechanicsPrediction();
    } else {
      overlay.__mlsMpmMechanicsPrediction = disabledStandaloneMechanicsPrediction(
        viewState.sphGpuParticleState,
        viewState.mlsMpmGpuParticleState
      );
    }
    scheduleInitialMlsMpmResidentSteps({ generation: particleSyncGeneration });
  }

  function stepDemoForVisualTest(steps = 1) {
    if (!driver && !ensureInteractiveDriverFromCache()) {
      return {
        blocked: true,
        reason: blockedError?.message || 'first-principles material resolution blocked',
        blockers: blockedError?.blockers || []
      };
    }
    const count = Math.max(1, Math.round(Number(steps) || 1));
    let reactionEventsStep = 0;
    for (let i = 0; i < count; i += 1) {
      driver.step();
      reactionEventsStep += driver.demo.lastStepTiming?.reactionEvents || 0;
    }
    recordPhysicsFrame(count);
    syncParticles();
    renderStatus();
    const reactionLedger = driver.demo.state.reactionLedger || null;
    const result = {
      step: driver.demo.state.step ?? 0,
      time: driver.demo.state.time ?? 0,
      reactionEventsStep,
      reactionEventsTotal: reactionLedger?.eventCount ?? reactionEventsStep,
      gasPressureSummary: gasPressureSummary(driver.demo),
      particlesByMaterial: driver.demo.state.particles.reduce((acc, particle) => {
        acc[particle.material] = (acc[particle.material] || 0) + 1;
        return acc;
      }, {}),
      phaseMassSummary: phaseMassSummary(driver.demo),
      reactionLedger: reactionLedger ? {
        schema: reactionLedger.schema || 'peercompute.ulg.sph-reaction-ledger.v0',
        eventCount: reactionLedger.eventCount ?? 0,
        productMassKgByMaterial: { ...(reactionLedger.productMassKgByMaterial || {}) },
        gasMassKgByMaterial: { ...(reactionLedger.gasMassKgByMaterial || {}) },
        heatJ: reactionLedger.heatJ ?? 0,
        massResidualKg: reactionLedger.massResidualKg ?? 0,
        maxAbsAtomResidualMol: reactionLedger.maxAbsAtomResidualMol ?? null,
        chargeResidualMol: reactionLedger.chargeResidualMol ?? null
      } : null
    };
    overlay.__sphLastStepResult = result;
    return result;
  }
  overlay.__sphStep = stepDemoForVisualTest;
  // Diagnostic hook: proofs that drive scene.refresh* directly (bypassing
  // the mount scheduler) re-render the status panel from the live scene
  // getters before asserting panel truth.
  overlay.__sphRenderStatus = renderStatus;

  function lawGroupStatusText() {
    return Object.entries(physicalLawGroupsFromControls())
      .map(([key, enabled]) => `${key}=${enabled ? 'on' : 'off'}`)
      .join(' ');
  }

  // Explicit pure-vapor vs condensed-steam readout: summarizes the derived
  // optical visibility gates on gas/vapor surfaces (phase-resolved steam
  // optics plan). Reads mesh userData written by the visibility resolver.
  function vaporOpticalModeStatusText() {
    const rows = [];
    const describeVisibility = (key, visibility) => {
      const mode = visibility.reason === 'derived-droplet-scattering-visible'
        ? 'condensed-steam'
        : visibility.reason === 'derived-vapor-optical-depth-visible'
        ? 'optically-thick-vapor'
        : 'pure-vapor-thin';
      const tau = Number.isFinite(visibility.opticalDepth) ? visibility.opticalDepth.toFixed(3) : 'n/a';
      const sigma = Number.isFinite(visibility.scatteringCoefficientPerM)
        ? visibility.scatteringCoefficientPerM.toFixed(3)
        : 'n/a';
      rows.push(`${key}=${mode}(tau=${tau} sigma=${sigma}/m ${visibility.visible ? 'shown' : 'hidden'})`);
    };
    scene?.scene?.traverse?.((obj) => {
      const visibility = obj?.userData?.opticalSurfaceVisibility;
      const descriptor = obj?.userData?.renderDescriptor || obj?.userData?.descriptor || null;
      const phase = String(descriptor?.phase ?? obj?.userData?.phase ?? '').toLowerCase();
      if (!visibility || (phase !== 'gas' && phase !== 'vapor')) return;
      describeVisibility(descriptor?.renderKey || descriptor?.material || 'gas', visibility);
    });
    // Native WebGPU consumer surfaces never become Three meshes; report their
    // gas-phase entries from the retained drawState metadata instead. Steam
    // and other multi-material secondaries live in additionalSurfaceDraws
    // (surfaceKey embeds material|phase), not the primary surfaces list.
    const nativeDrawState = scene?.scene?.userData?.sphResidentSurfaceDrawRenderBridge?.drawState || null;
    const additionalDraws = Array.isArray(nativeDrawState?.additionalSurfaceDraws)
      ? nativeDrawState.additionalSurfaceDraws
      : [];
    for (const draw of additionalDraws) {
      const key = String(draw?.surfaceKey || '');
      if (!/\|gas\b|\bsteam\b|\|vapor\b/i.test(key)) continue;
      rows.push(`${key}[native-additional]=attached(vertex-count-gpu-resident)`);
    }
    const nativeSurfaces = nativeDrawState?.surfaces;
    if (Array.isArray(nativeSurfaces)) {
      for (const surface of nativeSurfaces) {
        const phase = String(surface?.phase ?? surface?.descriptor?.phase ?? '').toLowerCase();
        if (phase !== 'gas' && phase !== 'vapor') continue;
        const key = surface?.renderKey || surface?.material || surface?.surfaceKey || 'gas';
        const optics = surface?.optical || surface?.optics || surface?.descriptor?.optical || null;
        if (optics) {
          describeVisibility(`${key}[native]`, resolveOpticalSurfaceVisibility({
            optics,
            descriptorOrRow: surface?.descriptor || surface,
            wasVisible: true
          }));
        } else {
          rows.push(`${key}[native]=drawn(optics-metadata-unavailable)`);
        }
      }
    }
    return rows.length ? rows.join(' ') : 'no-gas-surfaces';
  }

  function renderModeStatusText(residentSurfaceDraw = null, residentRenderState = null) {
    const selection = overlay.__sphRenderModeSelection || null;
    const requestedMode = currentResidentSurfaceDrawDiagnosticMode();
    const particleRenderMode = residentSurfaceDraw?.renderBridgeParticleRenderMode
      || residentRenderState?.surfaceDrawRenderBridgeParticleRenderMode
      || selection?.particleRenderMode
      || 'surface';
    const sphereSizingMode = residentSurfaceDraw?.renderBridgeSphereSizingMode
      || residentRenderState?.surfaceDrawRenderBridgeSphereSizingMode
      || (particleRenderMode === 'variable-size-spheres' ? 'per-particle-radius' : 'n/a');
    const pbrSource = residentSurfaceDraw?.renderBridgeSpherePbrMaterialSource
      || residentRenderState?.surfaceDrawRenderBridgeSpherePbrMaterialSource
      || (particleRenderMode === 'variable-size-spheres' ? 'pending-closure-derived-pbr' : 'n/a');
    return `requested=${requestedMode} particle=${particleRenderMode} sizing=${sphereSizingMode} pbr=${pbrSource}`;
  }

  function renderStatus() {
    if (!driver && activeViewState) {
      const pre = activeViewStatePreflight || {};
      const totals = activeViewStateTotals || activeViewState.totals || {};
      const phase = activeViewStatePhaseSummary || activeViewState.phaseMassSummary || { byMaterialPhase: {} };
      const gasPressure = currentGasPressureSummary(activeViewStateGasPressure || activeViewState.gasPressureSummary || null);
      const materialPhases = formatMaterialPhaseMasses(phase.byMaterialPhase || {});
      const particleCounts = materialParticleCountsText(materialParticleCountsFromMaterials(activeViewState.materials || []));
      const solidFractions = solidFractionStatusText(phase);
      const ledger = pre.energyBudget?.wallLedger?.map((w) => `  ${w.faceId} ${w.role} ${fmt(w.heatJ)}J`).join('\n') || '  pending';
      const residentSteps = scene.getMlsMpmResidentSteps?.() || overlay.__mlsMpmResidentSteps || null;
      const residentStep = scene.getMlsMpmResidentStep?.() || overlay.__mlsMpmResidentStep || null;
      const p2gProjection = scene.getMlsMpmP2gGridProjection?.() || overlay.__mlsMpmP2gGridProjection || null;
      const gridUpdate = scene.getMlsMpmGridUpdate?.() || overlay.__mlsMpmGridUpdate || null;
      const residentRenderState = scene.getSphResidentRenderState?.() || overlay.__sphResidentRenderState || null;
      const residentSurfaceDraw = scene.getSphResidentSurfaceDraw?.() || overlay.__sphResidentSurfaceDraw || null;
      const residentSurfaceOverlayPolicy = scene.getSphResidentSurfaceDrawOverlayPolicy?.()
        || overlay.__sphResidentSurfaceDrawOverlayPolicy
        || null;
      const schroederRenderSource = scene.getSchroederRenderSource?.()
        || scene.scene?.userData?.schroederRenderSource
        || null;
      const schroederDrawSource = scene.getSchroederRenderProxyDrawSource?.()
        || scene.scene?.userData?.schroederRenderProxyDrawSource
        || null;
      const schroederBackendSelection = scene.getSchroederRenderProxyBackendSelection?.()
        || scene.scene?.userData?.schroederRenderProxyBackendSelection
        || null;
      const schroederAdoptedStorage = schroederAdoptedParticleStorageTelemetry(residentSteps);
      const reactionTable = scene.getSphReactionTable?.() || overlay.__sphReactionTable || null;
      const residentRequestedReadback = residentSteps?.requestedReadbackMode
        || residentStep?.requestedReadbackMode
        || overlay.__mlsMpmResidentRequestedReadbackMode
        || SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT;
      const residentActualReadback = residentSteps?.readbackMode || residentStep?.readbackMode || 'pending';
      const residentBackend = residentSteps?.backend || residentStep?.backend || 'pending';
      const gridDims = gridUpdate?.gridDims || p2gProjection?.gridDims || residentStep?.gridUpdate?.gridDims || null;
      const gridNodeCount = gridUpdate?.gridNodeCount || p2gProjection?.gridNodeCount || residentStep?.gridNodeCount || 0;
      const gridSpacingM = gridUpdate?.gridSpacingM || p2gProjection?.gridSpacingM || activeViewState.gpuMechanics?.gridSpacingM || null;
      const residentPerfSummary = overlay.__sphResidentPerf || residentPerf;
      const residentAutoSchedule = overlay.__mlsMpmResidentAutoSchedule || null;
      const residentExecutionPolicyStatus = residentExecutionPolicyStatusText(
        residentSteps?.residentExecutionPolicy
          || overlay.__mlsMpmResidentExecutionPolicy
          || residentAutoSchedule?.residentExecutionPolicy
          || null
      );
      const residentStageTiming = residentStep?.stageTiming
        || residentSteps?.finalStep?.stageTiming
        || residentPerfSummary?.lastResidentStageTiming
        || null;
      const residentMotion = residentMotionDiagnostic({ residentStep, residentSteps, gridSpacingM });
      overlay.__sphResidentMotionDiagnostic = residentMotion;
      const renderPressureSource = residentRenderState?.gasPressureSummarySource
        || overlay.__sphResidentGasPressureSummary?.source
        || gasPressure?.source
        || 'pending';
      const renderPressureOpticalState = residentRenderState?.residentPressureOpticalStateApplied ?? false;
      const renderCadence = residentRenderState?.renderReadbackCadence
        || overlay.__sphResidentRenderReadbackCadence
        || null;
      const residentRenderError = overlay.__sphResidentRenderStateError || null;
      const residentMaterialInterfaceState = scene.getSphResidentMaterialInterfaceState?.()
        || overlay.__sphResidentMaterialInterfaceState
        || residentRenderState?.materialInterfaceField
        || null;
      const residentProductMass = residentStep?.residentProductMass || residentSteps?.finalStep?.residentProductMass || null;
      const workerTiming = overlay.__sphPhaseWorkerTiming || overlay.__sphPhaseRebuildWorker?.timing || null;
      statusEl.textContent = [
        `preflight        : ${pre.status || 'worker-view-state'} (feasible=${pre.feasibility?.feasible ?? 'pending'})`,
        `final phase      : ${phaseStatusText(pre, activeViewState.dropMaterial, activeViewState.baseMaterial)}`,
        `heat to walls    : ${fmt(pre.energyBudget?.heatExportedToWallsJ)} J`,
        `masses (kg)      : ${massStatusText(pre, activeViewState.dropMaterial, activeViewState.baseMaterial)}`,
        `particles        : ${particleCounts}`,
        `reaction         : ${reactionStatusText(activeViewState.reactionNote)}`,
        `material phases  : ${materialPhases || '—'}`,
        `gas pressure     : ${gasPressureStatusText(gasPressure)}`,
        `solid fractions  : ${solidFractions || '—'}`,
        `total energy     : ${fmt(totals.totalEnergyJ)} J`,
        `momentum |p|     : ${fmt(totals.momentumMagnitudeKgMPerS)} kg·m/s`,
        `view state       : ${activeViewStateSource}`,
        `law groups       : ${lawGroupStatusText()}`,
        `resident auto    : ${residentAutoSchedule?.status || (initialResidentAutoEnabled ? 'enabled' : 'disabled')}`,
        `resident workers : ${initialResidentWorkersEnabled ? 'enabled' : 'disabled-by-url'}`,
        `resident policy  : ${residentExecutionPolicyStatus}`,
        `schroeder sim   : ${schroederSimulationStatusText({ residentSteps, residentStep, residentRenderState, residentSurfaceDraw, schroederRenderSource, schroederDrawSource, schroederBackendSelection })}`,
        `ss storage      : adoption=${schroederAdoptedStorage.adoptionStatus || 'pending'} pub=${schroederAdoptedStorage.publicationStatus || 'pending'} resolver=${schroederAdoptedStorage.localResolverStatus || 'pending'} ready=${Boolean(schroederAdoptedStorage.localResolverReady)} stage=${schroederAdoptedStorage.continuationScheduleStatus || 'pending'} raw-transfer=${Boolean(schroederAdoptedStorage.rawGpuBufferPeerComputeTransfer)}`,
        `resident backend : ${residentBackend}`,
        `mls grid         : dims=${gridDims ? gridDims.join('x') : 'pending'} nodes=${gridNodeCount || 'pending'} dx=${Number.isFinite(gridSpacingM) ? fmt(gridSpacingM, 3) : 'pending'}m`,
        `resident readback: requested=${residentRequestedReadback} actual=${residentActualReadback}`,
        `resident motion  : status=${residentMotion.status} max-dx=${Number.isFinite(residentMotion.maxDisplacementM) ? fmt(residentMotion.maxDisplacementM, 6) : 'pending'}m max-v=${Number.isFinite(residentMotion.maxSpeedMPerS) ? fmt(residentMotion.maxSpeedMPerS, 6) : 'pending'}m/s threshold=${fmt(residentMotion.visibleThresholdM, 6)}m batch-est=${Number.isFinite(residentMotion.estimatedBatchDisplacementUpperBoundM) ? fmt(residentMotion.estimatedBatchDisplacementUpperBoundM, 6) : 'pending'}m accumulated=${fmt(renderCadence?.accumulatedSubvisibleMotionM ?? residentPerfSummary?.accumulatedSubvisibleMotionM ?? 0, 6)}m bursts=${renderCadence?.subvisibleMotionBurstCount ?? residentPerfSummary?.subvisibleMotionBurstCount ?? 0} pressure-impulse=${Number.isFinite(residentMotion.pressureImpulseNSeconds) ? fmt(residentMotion.pressureImpulseNSeconds, 6) : 'pending'}N*s`,
        `resident reaction: status=${residentStep?.stageStatus?.reaction || (reactionTable?.reactionCount > 0 ? 'pending' : 'no-derived-reactions')} backend=${residentStep?.stageBackends?.reaction || 'pending'} reactions=${reactionTable?.reactionCount ?? 0}`,
        `resident product : status=${residentProductMass?.status || 'pending'} rows=${residentProductMass?.productEventRowCount ?? 0} unplaced=${Number.isFinite(residentProductMass?.unplacedProductMassKg) ? fmt(residentProductMass.unplacedProductMassKg) : 'pending'}kg eos=${residentProductMass?.eosCouplingStatus || 'pending'}`,
        `material iface  : owner=${residentMaterialInterfaceState?.authority || 'pending'} source=${residentMaterialInterfaceState?.source || 'pending'} status=${residentMaterialInterfaceState?.status || 'pending'} ready=${residentMaterialInterfaceState?.readySurfaceCount ?? 0}/${residentMaterialInterfaceState?.surfaceCount ?? 0} source-field=${residentMaterialInterfaceState?.interfaceSourceFieldSchema || residentMaterialInterfaceState?.sourceFieldSchema || 'pending'} candidate-readback=${Boolean(residentMaterialInterfaceState?.candidateReadback)}`,
        `render source    : ${residentRenderState?.source || 'cpu-particles'} status=${residentRenderState?.status || 'pending'} backend=${residentRenderState?.backend || 'pending'} rows=${residentRenderState?.particleCount ?? 0} field-cells=${residentRenderState?.renderFieldTotalCells ?? 0} field-readback=${Boolean(residentRenderState?.renderFieldReadback)}`,
        `render mode      : ${renderModeStatusText(residentSurfaceDraw, residentRenderState)}`,
        `render error     : ${residentRenderError || 'none'}`,
        `surface draw     : status=${residentSurfaceDraw?.status || residentRenderState?.surfaceDrawStatus || 'pending'} policy=${residentSurfaceDraw?.overlayPolicyStatus || residentRenderState?.surfaceDrawOverlayPolicyStatus || residentSurfaceOverlayPolicy?.status || 'pending'} mode=${residentSurfaceDraw?.overlayPolicyMode || residentRenderState?.surfaceDrawOverlayPolicyMode || residentSurfaceOverlayPolicy?.mode || 'pending'} active=${residentSurfaceDraw?.activeSurfaceCount ?? residentRenderState?.surfaceDrawActiveSurfaceCount ?? 0} vertices=${residentSurfaceDraw?.vertexCount ?? residentRenderState?.surfaceDrawVertexCount ?? 0} draw-retained=${Boolean(residentSurfaceDraw?.drawRowsBufferRetained ?? residentRenderState?.surfaceDrawRowsBufferRetained)} indirect-retained=${Boolean(residentSurfaceDraw?.drawIndirectRowsBufferRetained ?? residentRenderState?.surfaceDrawIndirectRowsBufferRetained)} compact-retained=${Boolean(residentSurfaceDraw?.compactedVertexRowsBufferRetained ?? residentRenderState?.surfaceDrawCompactedVertexRowsBufferRetained)} readback=${Boolean(residentSurfaceDraw?.surfaceDrawReadback ?? residentRenderState?.surfaceDrawReadback)} bridge=${residentSurfaceDraw?.visibleRendererBridge || residentRenderState?.surfaceDrawVisibleRendererBridge || 'pending'} depth=${residentSurfaceDraw?.renderBridgeDepthPolicy || residentRenderState?.surfaceDrawRenderBridgeDepthPolicy || 'pending'} depth-ready=${Boolean(residentSurfaceDraw?.renderBridgeDepthAttachmentReady ?? residentRenderState?.surfaceDrawRenderBridgeDepthAttachmentReady)} transparent=${residentSurfaceDraw?.renderBridgeTransparencyCompositeMode || residentRenderState?.surfaceDrawRenderBridgeTransparencyCompositeMode || 'pending'} optics=${residentSurfaceDraw?.renderBridgeOpticalRenderSource || residentRenderState?.surfaceDrawRenderBridgeOpticalRenderSource || 'pending'} records=${residentSurfaceDraw?.renderBridgeOpticalRecordCount ?? residentRenderState?.surfaceDrawRenderBridgeOpticalRecordCount ?? 0} spectra=${residentSurfaceDraw?.renderBridgeOpticalSpectralSampleCount ?? residentRenderState?.surfaceDrawRenderBridgeOpticalSpectralSampleCount ?? 0} swap=${residentSurfaceDraw?.renderBridgeTemporalSwapPolicy || residentRenderState?.surfaceDrawRenderBridgeTemporalSwapPolicy || 'pending'} retained=${Boolean(residentSurfaceDraw?.renderBridgeRetainedPreviousOverlay ?? residentRenderState?.surfaceDrawRenderBridgeRetainedPreviousOverlay)}`,
        `render pressure  : source=${renderPressureSource} optical-state=${Boolean(renderPressureOpticalState)}`,
        `steam optics     : ${vaporOpticalModeStatusText()}`,
        `render cadence   : every=${renderCadence?.cadence ?? RESIDENT_RENDER_READBACK_CADENCE} effective=${renderCadence?.effectiveCadence ?? residentPerfSummary?.effectiveRenderReadbackCadence ?? RESIDENT_RENDER_READBACK_CADENCE} forced=${Boolean(renderCadence?.forced ?? residentPerfSummary?.playbackVisualRefreshForced)} reason=${renderCadence?.reason || 'pending'} sequence=${renderCadence?.sequence ?? 0} skipped=${renderCadence?.skippedCount ?? 0} last-skipped=${Boolean(renderCadence?.skipped)}`,
        `resident profile : submissions=${residentPerfSummary?.residentSubmissions ?? 0} stale=${residentPerfSummary?.staleResidentSubmissions ?? 0} substeps=${residentPerfSummary?.residentStepsPerSchedule ?? currentResidentStepsPerSchedule()} target=${currentResidentTargetSubsteps()} step-ms=${fmt(residentPerfSummary?.lastResidentMs, 1)} render-ms=${fmt(residentPerfSummary?.lastRenderReadbackMs, 1)}`,
        `resident stages  : ${residentStageTimingStatusText(residentStageTiming)}`,
        `scene sync       : ${sceneSyncTimingStatusText(overlay.__sphSetParticlesTiming)}`,
        `worker rebuild   : ${workerRebuildTimingStatusText(workerTiming)}`,
        `fps              : render ${fmt(frameCounters.renderFps, 1)} physics ${fmt(frameCounters.physicsFps, 1)} resident ${fmt(frameCounters.residentFps, 1)}`,
        `closure cache    : lookup=${peerClosureCacheLookup?.status || 'pending'} hits=${peerClosureCacheLookup?.hitCount ?? 0} misses=${peerClosureCacheLookup?.missCount ?? 0} stale=${peerClosureCacheLookup?.staleCount ?? 0} stored=${peerClosureCacheWrite?.entryCount ?? 0} consumed=${Boolean(peerClosureCacheConsumed)}`,
        `cold cache       : ${coldStartCacheStatusText()}`,
        `cache clear      : ${cacheClearStatusText()}`,
        `perf trace       : ${performanceTraceStatusText()}`,
        `cpu closure task : ${cpuClosureTask?.active ? `${cpuClosureTask.label} (${cpuClosureTask.location})` : 'idle'}`,
        `per-wall ledger  :\n${ledger}`,
        ``,
        `validation       : scientific=false sph=false phase=false (worker view-state evidence-only)`
      ].join('\n');
      return;
    }
    const workerStatus = overlay.__sphPhaseRebuildWorker || null;
    if (!driver && workerStatus?.status && !blockedError) {
      const workerTiming = overlay.__sphPhaseWorkerTiming || workerStatus.timing || null;
      statusEl.textContent = [
        `preflight        : ${workerStatus.status}`,
        `worker           : generation=${workerStatus.generation ?? 'pending'} reason=${workerStatus.reason || 'initial-load'} backend=${workerStatus.backend || 'pending'}`,
        `view state       : ${activeViewStateSource}`,
        `worker rebuild   : ${workerRebuildTimingStatusText(workerTiming)}`,
        `closure cache    : lookup=${peerClosureCacheLookup?.status || 'pending'} hits=${peerClosureCacheLookup?.hitCount ?? 0} misses=${peerClosureCacheLookup?.missCount ?? 0} stale=${peerClosureCacheLookup?.staleCount ?? 0} stored=${peerClosureCacheWrite?.entryCount ?? 0} consumed=${Boolean(peerClosureCacheConsumed)}`,
        `cold cache       : ${coldStartCacheStatusText()}`,
        `cache clear      : ${cacheClearStatusText()}`,
        `perf trace       : ${performanceTraceStatusText()}`,
        `cpu closure task : ${cpuClosureTask?.active ? `${cpuClosureTask.label} (${cpuClosureTask.location})` : 'idle'}`,
        '',
        'validation       : pending worker view-state'
      ].join('\n');
      return;
    }
    if (!driver) {
      statusEl.textContent = [
        'preflight        : blocked',
        'reason           : first-principles material properties are required',
        `error            : ${blockedError?.message || 'material closure missing'}`,
        `blockers         : ${(blockedError?.blockers || []).join(', ') || 'first-principles-material-closure-not-produced'}`,
        '',
        'validation       : no fixture/reduced material properties consumed'
      ].join('\n');
      return;
    }
    const pre = driver.preflight();
    overlay.__sphPhasePreflight = pre;
    const totals = sphTotals(driver.demo.state);
    const phase = phaseMassSummary(driver.demo);
    const gasPressure = currentGasPressureSummary(gasPressureSummary(driver.demo));
    const ledger = pre.energyBudget.wallLedger.map((w) => `  ${w.faceId} ${w.role} ${fmt(w.heatJ)}J`).join('\n');
    const materialPhases = formatMaterialPhaseMasses(phase.byMaterialPhase);
    const solidFractions = solidFractionStatusText(phase);
    const particleCounts = materialParticleCountsText(materialParticleCountsFromParticles(driver.demo.state.particles));
    const reactionLedger = driver.demo.state.reactionLedger || null;
    const residentSteps = scene.getMlsMpmResidentSteps?.() || overlay.__mlsMpmResidentSteps || null;
    const residentStep = scene.getMlsMpmResidentStep?.() || overlay.__mlsMpmResidentStep || null;
    const p2gProjection = scene.getMlsMpmP2gGridProjection?.() || overlay.__mlsMpmP2gGridProjection || null;
    const gridUpdate = scene.getMlsMpmGridUpdate?.() || overlay.__mlsMpmGridUpdate || null;
    const residentRenderState = scene.getSphResidentRenderState?.() || overlay.__sphResidentRenderState || null;
    const residentRequestedReadback = residentSteps?.requestedReadbackMode
      || residentStep?.requestedReadbackMode
      || overlay.__mlsMpmResidentRequestedReadbackMode
      || SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT;
    const residentActualReadback = residentSteps?.readbackMode || residentStep?.readbackMode || 'pending';
    const residentBackend = residentSteps?.backend || residentStep?.backend || 'pending';
    const renderStateReadbackAvailable = residentSteps?.renderStateReadbackAvailable
      ?? residentStep?.renderStateReadbackAvailable
      ?? null;
    const normalHotLoopReadbackFree = residentSteps?.normalHotLoopReadbackFree
      ?? residentStep?.normalHotLoopReadbackFree
      ?? false;
    const gpuAuthoritativeState = residentSteps?.gpuAuthoritativeState
      ?? residentStep?.gpuAuthoritativeState
      ?? false;
    const residentSourceMode = residentSteps?.residentSourceMode
      || overlay.__mlsMpmResidentSourceMode
      || 'cpu-packed-state';
    const residentContinued = residentSteps?.continuedFromResidentState
      ?? overlay.__mlsMpmResidentContinuedFromResidentState
      ?? false;
    const residentContinuationAvailable = residentSteps?.continuationAvailable
      ?? overlay.__mlsMpmResidentContinuationAvailable
      ?? false;
    const compactDiagnostics = residentStep?.diagnostics || null;
    const compactStatus = compactDiagnostics?.compactGpuSummaryStatus || 'pending';
    const compactMode = compactDiagnostics?.compactGpuSummaryReadbackMode
      || compactDiagnostics?.readbackMode
      || 'pending';
    const compactReduction = compactDiagnostics?.compactSummaryReductionStrategy || 'pending';
    const thermalPhaseMassKg = compactDiagnostics?.phaseMassKg || {};
    const thermalMeanK = compactDiagnostics?.temperatureMassWeightedMeanK;
    const thermalMinK = compactDiagnostics?.minTemperatureK;
    const thermalMaxK = compactDiagnostics?.maxTemperatureK;
    const thermalProblemCount = compactDiagnostics?.thermalProblemCount;
    const residentThermalStatus = residentStep?.stageStatus?.thermal
      || residentStep?.thermalStep?.status
      || residentStep?.thermalStep?.result?.status
      || 'pending';
    const residentThermalBackend = residentStep?.stageBackends?.thermal
      || residentStep?.thermalStep?.backend
      || residentStep?.thermalStep?.result?.backend
      || 'pending';
    const thermalResponseGraphUpload = scene.getSphThermalResponseGraphUpload?.()
      || scene.scene?.userData?.sphThermalResponseGraphUpload
      || null;
    const reactionTable = scene.getSphReactionTable?.() || overlay.__sphReactionTable || null;
    const residentReactionStatus = residentStep?.stageStatus?.reaction
      || residentStep?.reactionStep?.status
      || residentStep?.reactionStep?.result?.status
      || (reactionTable?.reactionCount > 0 ? 'pending' : 'no-derived-reactions');
    const residentReactionBackend = residentStep?.stageBackends?.reaction
      || residentStep?.reactionStep?.backend
      || residentStep?.reactionStep?.result?.backend
      || (reactionTable?.reactionCount > 0 ? 'pending' : 'not-required');
    const reactionSummaryStatus = compactDiagnostics?.reactionSummaryStatus || 'pending';
    const reactionSummaryMode = compactDiagnostics?.reactionSummaryReadbackMode || 'pending';
    const reactionVisibleProductKg = compactDiagnostics?.reactionVisibleProductMassKg;
    const reactionVisibleGasKg = compactDiagnostics?.reactionVisibleGasProductMassKg;
    const reactionOutputGasKg = compactDiagnostics?.reactionOutputGasPhaseMassKg;
    const reactionChangedMaterials = compactDiagnostics?.reactionChangedMaterialCount;
    const reactionChangedMasses = compactDiagnostics?.reactionChangedMassCount;
    const reactionLedgerEvents = compactDiagnostics?.reactionCanonicalEventCount;
    const reactionLedgerUnplacedKg = compactDiagnostics?.reactionLedgerUnplacedProductMassKg;
    const reactionLedgerGasKg = compactDiagnostics?.reactionLedgerGasProductMassKg;
    const reactionLedgerUnplacedGasKg = compactDiagnostics?.reactionLedgerUnplacedGasProductMassKg;
    const reactionLedgerGasMoles = compactDiagnostics?.reactionSealedBoxGasProductMoles;
    const reactionHeatJ = compactDiagnostics?.reactionHeatJ;
    const reactionLedgerResidualKg = compactDiagnostics?.reactionLedgerMassResidualKg;
	    const reactionProductInventoryCount = compactDiagnostics?.reactionProductInventoryCount;
	    const reactionProductInventoryBytes = compactDiagnostics?.reactionProductInventoryReadbackByteLength;
	    const reactionProductEventRows = compactDiagnostics?.reactionProductEventRowCount;
	    const reactionProductEventActive = compactDiagnostics?.reactionProductEventActiveEventCount;
	    const reactionProductEventReadbackBytes = compactDiagnostics?.reactionProductEventReadbackByteLength;
	    const reactionProductEventBufferBytes = compactDiagnostics?.reactionProductEventBufferByteLength;
	    const reactionProductEventRetained = compactDiagnostics?.reactionProductEventBufferRetained;
	    const reactionResidentProductMassStatus = compactDiagnostics?.reactionResidentProductMassStatus || residentStep?.residentProductMassStatus || 'pending';
	    const reactionResidentProductMassRows = compactDiagnostics?.reactionResidentProductMassProductEventRowCount ?? residentStep?.residentProductMassProductEventRowCount ?? 0;
	    const reactionResidentProductMassUnplacedKg = compactDiagnostics?.reactionResidentProductMassUnplacedProductMassKg ?? residentStep?.residentProductMassUnplacedProductMassKg;
	    const reactionResidentProductMassEosStatus = compactDiagnostics?.reactionResidentProductMassEosCouplingStatus || residentStep?.residentProductMassEosCouplingStatus || 'pending';
	    const reactionAtomResidualCount = compactDiagnostics?.reactionAtomResidualCount;
    const reactionAtomResidualBytes = compactDiagnostics?.reactionAtomResidualReadbackByteLength;
    const reactionStrictGateStatus = compactDiagnostics?.reactionStrictGateStatus;
    const reactionGasSpeciesCount = compactDiagnostics?.reactionGasSpeciesLedgerCount;
    const reactionGasSpeciesBytes = compactDiagnostics?.reactionGasSpeciesReadbackByteLength;
    const residentThermalBufferMode = residentStep?.nextParticleBufferMode || 'pending';
    const renderSource = residentRenderState?.source || 'cpu-particles';
    const renderRowsStatus = residentRenderState?.status || 'pending';
    const renderRowsBackend = residentRenderState?.backend || 'pending';
    const renderRowsCount = residentRenderState?.particleCount ?? 0;
    const renderFieldCells = residentRenderState?.renderFieldTotalCells ?? 0;
    const renderFieldReadback = residentRenderState?.renderFieldReadback ?? false;
    const residentSurfaceDraw = scene.getSphResidentSurfaceDraw?.() || overlay.__sphResidentSurfaceDraw || null;
    const residentSurfaceOverlayPolicy = scene.getSphResidentSurfaceDrawOverlayPolicy?.()
      || overlay.__sphResidentSurfaceDrawOverlayPolicy
      || null;
    const schroederRenderSource = scene.getSchroederRenderSource?.()
      || scene.scene?.userData?.schroederRenderSource
      || null;
    const schroederDrawSource = scene.getSchroederRenderProxyDrawSource?.()
      || scene.scene?.userData?.schroederRenderProxyDrawSource
      || null;
    const schroederBackendSelection = scene.getSchroederRenderProxyBackendSelection?.()
      || scene.scene?.userData?.schroederRenderProxyBackendSelection
      || null;
    const schroederAdoptedStorage = schroederAdoptedParticleStorageTelemetry(residentSteps);
    const renderPressureSource = residentRenderState?.gasPressureSummarySource
      || overlay.__sphResidentGasPressureSummary?.source
      || gasPressure?.source
      || 'pending';
    const renderPressureOpticalState = residentRenderState?.residentPressureOpticalStateApplied ?? false;
    const renderCadence = residentRenderState?.renderReadbackCadence
      || overlay.__sphResidentRenderReadbackCadence
      || null;
    const residentMaterialInterfaceState = scene.getSphResidentMaterialInterfaceState?.()
      || overlay.__sphResidentMaterialInterfaceState
      || residentRenderState?.materialInterfaceField
      || null;
    const residentRenderError = overlay.__sphResidentRenderStateError || null;
    const renderAuthoritative = Boolean(residentRenderState?.gpuAuthoritativeState);
    const residentPerfSummary = overlay.__sphResidentPerf || residentPerf;
    const residentAutoSchedule = overlay.__mlsMpmResidentAutoSchedule || null;
    const residentExecutionPolicyStatus = residentExecutionPolicyStatusText(
      residentSteps?.residentExecutionPolicy
        || overlay.__mlsMpmResidentExecutionPolicy
        || residentAutoSchedule?.residentExecutionPolicy
        || null
    );
    const residentStageTiming = residentStep?.stageTiming
      || residentSteps?.finalStep?.stageTiming
      || residentPerfSummary?.lastResidentStageTiming
      || null;
    const cpuDriverStepTiming = driver.demo.lastStepTiming || null;
    const workerTiming = overlay.__sphPhaseWorkerTiming || overlay.__sphPhaseRebuildWorker?.timing || null;
    const standaloneMechanics = overlay.__mlsMpmMechanicsPrediction || null;
    const gridDims = gridUpdate?.gridDims || p2gProjection?.gridDims || residentStep?.gridUpdate?.gridDims || null;
    const gridNodeCount = gridUpdate?.gridNodeCount || p2gProjection?.gridNodeCount || residentStep?.gridNodeCount || 0;
    const gridSpacingM = gridUpdate?.gridSpacingM || p2gProjection?.gridSpacingM || driver.demo.gpuMechanics?.gridSpacingM || null;
    const residentMotion = residentMotionDiagnostic({ residentStep, residentSteps, gridSpacingM });
    overlay.__sphResidentMotionDiagnostic = residentMotion;
    statusEl.textContent = [
      `preflight        : ${pre.status} (feasible=${pre.feasibility.feasible})`,
      `final phase      : ${phaseStatusText(pre, driver.demo.dropMaterial, driver.demo.baseMaterial)}`,
      `heat to walls    : ${fmt(pre.energyBudget.heatExportedToWallsJ)} J`,
      `masses (kg)      : ${massStatusText(pre, driver.demo.dropMaterial, driver.demo.baseMaterial)}`,
      `particles        : ${particleCounts}`,
      `reaction         : ${reactionStatusText(driver.demo.reactionNote, reactionLedger)}`,
      `material phases  : ${materialPhases || '—'}`,
      `molecules/macro  : ${moleculesPerMacroStatusText(pre, driver.demo.dropMaterial, driver.demo.baseMaterial)}`,
      `gas pressure     : ${gasPressureStatusText(gasPressure)}`,
      `solid fractions  : ${solidFractions || '—'}`,
      `total energy     : ${fmt(totals.totalEnergyJ)} J`,
      `momentum |p|     : ${fmt(totals.momentumMagnitudeKgMPerS)} kg·m/s`,
      `law groups       : ${lawGroupStatusText()}`,
      `resident auto    : ${residentAutoSchedule?.status || (initialResidentAutoEnabled ? 'enabled' : 'disabled')}`,
      `resident policy  : ${residentExecutionPolicyStatus}`,
      `schroeder sim   : ${schroederSimulationStatusText({ residentSteps, residentStep, residentRenderState, residentSurfaceDraw, schroederRenderSource, schroederDrawSource, schroederBackendSelection })}`,
      `ss storage      : adoption=${schroederAdoptedStorage.adoptionStatus || 'pending'} pub=${schroederAdoptedStorage.publicationStatus || 'pending'} resolver=${schroederAdoptedStorage.localResolverStatus || 'pending'} ready=${Boolean(schroederAdoptedStorage.localResolverReady)} stage=${schroederAdoptedStorage.continuationScheduleStatus || 'pending'} raw-transfer=${Boolean(schroederAdoptedStorage.rawGpuBufferPeerComputeTransfer)}`,
      `resident backend : ${residentBackend}`,
      `mls grid         : dims=${gridDims ? gridDims.join('x') : 'pending'} nodes=${gridNodeCount || 'pending'} dx=${Number.isFinite(gridSpacingM) ? fmt(gridSpacingM, 3) : 'pending'}m`,
      `resident readback: requested=${residentRequestedReadback} actual=${residentActualReadback}`,
      `resident source  : ${residentSourceMode} continued=${Boolean(residentContinued)} next=${Boolean(residentContinuationAvailable)}`,
      `resident motion  : status=${residentMotion.status} max-dx=${Number.isFinite(residentMotion.maxDisplacementM) ? fmt(residentMotion.maxDisplacementM, 6) : 'pending'}m max-v=${Number.isFinite(residentMotion.maxSpeedMPerS) ? fmt(residentMotion.maxSpeedMPerS, 6) : 'pending'}m/s threshold=${fmt(residentMotion.visibleThresholdM, 6)}m batch-est=${Number.isFinite(residentMotion.estimatedBatchDisplacementUpperBoundM) ? fmt(residentMotion.estimatedBatchDisplacementUpperBoundM, 6) : 'pending'}m accumulated=${fmt(renderCadence?.accumulatedSubvisibleMotionM ?? residentPerfSummary?.accumulatedSubvisibleMotionM ?? 0, 6)}m bursts=${renderCadence?.subvisibleMotionBurstCount ?? residentPerfSummary?.subvisibleMotionBurstCount ?? 0} pressure-impulse=${Number.isFinite(residentMotion.pressureImpulseNSeconds) ? fmt(residentMotion.pressureImpulseNSeconds, 6) : 'pending'}N*s`,
      `compact summary  : status=${compactStatus} mode=${compactMode} reduction=${compactReduction}`,
      `thermal summary  : mean=${Number.isFinite(thermalMeanK) ? fmt(thermalMeanK) : 'pending'}K min=${Number.isFinite(thermalMinK) ? fmt(thermalMinK) : 'pending'}K max=${Number.isFinite(thermalMaxK) ? fmt(thermalMaxK) : 'pending'}K solid=${fmt(thermalPhaseMassKg.solid ?? 0)}kg liquid=${fmt(thermalPhaseMassKg.liquid ?? 0)}kg gas=${fmt(thermalPhaseMassKg.gas ?? 0)}kg plasma=${fmt(thermalPhaseMassKg.plasma ?? 0)}kg problem=${thermalProblemCount ?? 'pending'}`,
      `thermal graph gpu: status=${thermalResponseGraphUpload?.status || 'pending'} responses=${thermalResponseGraphUpload?.responseCount ?? 0} graphs=${thermalResponseGraphUpload?.graphCount ?? 0} bytes=${thermalResponseGraphUpload?.responseBufferByteLength ?? 0}`,
      `resident thermal : status=${residentThermalStatus} backend=${residentThermalBackend} next=${residentThermalBufferMode}`,
      `resident reaction: status=${residentReactionStatus} backend=${residentReactionBackend} reactions=${reactionTable?.reactionCount ?? 0}`,
      `reaction summary: status=${reactionSummaryStatus} mode=${reactionSummaryMode} product=${Number.isFinite(reactionVisibleProductKg) ? fmt(reactionVisibleProductKg) : 'pending'}kg gas-product=${Number.isFinite(reactionVisibleGasKg) ? fmt(reactionVisibleGasKg) : 'pending'}kg output-gas=${Number.isFinite(reactionOutputGasKg) ? fmt(reactionOutputGasKg) : 'pending'}kg changed-material=${reactionChangedMaterials ?? 'pending'} changed-mass=${reactionChangedMasses ?? 'pending'}`,
	      `reaction ledger : events=${reactionLedgerEvents ?? 'pending'} gate=${reactionStrictGateStatus || 'pending'} inventory=${reactionProductInventoryCount ?? 'pending'} inventory-bytes=${reactionProductInventoryBytes ?? 0} product-event-rows=${reactionProductEventRows ?? 'pending'} product-event-active=${reactionProductEventActive ?? 'pending'} product-event-buffer=${reactionProductEventBufferBytes ?? 0} product-event-readback=${reactionProductEventReadbackBytes ?? 0} product-event-retained=${Boolean(reactionProductEventRetained)} atom-residuals=${reactionAtomResidualCount ?? 'pending'} atom-bytes=${reactionAtomResidualBytes ?? 0} species=${reactionGasSpeciesCount ?? 'pending'} species-bytes=${reactionGasSpeciesBytes ?? 0} unplaced=${Number.isFinite(reactionLedgerUnplacedKg) ? fmt(reactionLedgerUnplacedKg) : 'pending'}kg gas=${Number.isFinite(reactionLedgerGasKg) ? fmt(reactionLedgerGasKg) : 'pending'}kg unplaced-gas=${Number.isFinite(reactionLedgerUnplacedGasKg) ? fmt(reactionLedgerUnplacedGasKg) : 'pending'}kg gas-mol=${Number.isFinite(reactionLedgerGasMoles) ? fmt(reactionLedgerGasMoles) : 'pending'} heat=${Number.isFinite(reactionHeatJ) ? fmt(reactionHeatJ) : 'pending'}J residual=${Number.isFinite(reactionLedgerResidualKg) ? fmt(reactionLedgerResidualKg) : 'pending'}kg`,
      `resident product : status=${reactionResidentProductMassStatus} rows=${reactionResidentProductMassRows} unplaced=${Number.isFinite(reactionResidentProductMassUnplacedKg) ? fmt(reactionResidentProductMassUnplacedKg) : 'pending'}kg eos=${reactionResidentProductMassEosStatus}`,
      `render readback  : available=${renderStateReadbackAvailable == null ? 'pending' : String(renderStateReadbackAvailable)} hot-loop-no-full=${Boolean(normalHotLoopReadbackFree)}`,
      `material iface  : owner=${residentMaterialInterfaceState?.authority || 'pending'} source=${residentMaterialInterfaceState?.source || 'pending'} status=${residentMaterialInterfaceState?.status || 'pending'} ready=${residentMaterialInterfaceState?.readySurfaceCount ?? 0}/${residentMaterialInterfaceState?.surfaceCount ?? 0} source-field=${residentMaterialInterfaceState?.interfaceSourceFieldSchema || residentMaterialInterfaceState?.sourceFieldSchema || 'pending'} candidate-readback=${Boolean(residentMaterialInterfaceState?.candidateReadback)}`,
      `render source    : ${renderSource} status=${renderRowsStatus} backend=${renderRowsBackend} rows=${renderRowsCount} field-cells=${renderFieldCells} field-readback=${Boolean(renderFieldReadback)}`,
      `render mode      : ${renderModeStatusText(residentSurfaceDraw, residentRenderState)}`,
      `render error     : ${residentRenderError || 'none'}`,
      `surface draw     : status=${residentSurfaceDraw?.status || residentRenderState?.surfaceDrawStatus || 'pending'} policy=${residentSurfaceDraw?.overlayPolicyStatus || residentRenderState?.surfaceDrawOverlayPolicyStatus || residentSurfaceOverlayPolicy?.status || 'pending'} mode=${residentSurfaceDraw?.overlayPolicyMode || residentRenderState?.surfaceDrawOverlayPolicyMode || residentSurfaceOverlayPolicy?.mode || 'pending'} active=${residentSurfaceDraw?.activeSurfaceCount ?? residentRenderState?.surfaceDrawActiveSurfaceCount ?? 0} vertices=${residentSurfaceDraw?.vertexCount ?? residentRenderState?.surfaceDrawVertexCount ?? 0} draw-retained=${Boolean(residentSurfaceDraw?.drawRowsBufferRetained ?? residentRenderState?.surfaceDrawRowsBufferRetained)} indirect-retained=${Boolean(residentSurfaceDraw?.drawIndirectRowsBufferRetained ?? residentRenderState?.surfaceDrawIndirectRowsBufferRetained)} compact-retained=${Boolean(residentSurfaceDraw?.compactedVertexRowsBufferRetained ?? residentRenderState?.surfaceDrawCompactedVertexRowsBufferRetained)} readback=${Boolean(residentSurfaceDraw?.surfaceDrawReadback ?? residentRenderState?.surfaceDrawReadback)} bridge=${residentSurfaceDraw?.visibleRendererBridge || residentRenderState?.surfaceDrawVisibleRendererBridge || 'pending'} depth=${residentSurfaceDraw?.renderBridgeDepthPolicy || residentRenderState?.surfaceDrawRenderBridgeDepthPolicy || 'pending'} depth-ready=${Boolean(residentSurfaceDraw?.renderBridgeDepthAttachmentReady ?? residentRenderState?.surfaceDrawRenderBridgeDepthAttachmentReady)} transparent=${residentSurfaceDraw?.renderBridgeTransparencyCompositeMode || residentRenderState?.surfaceDrawRenderBridgeTransparencyCompositeMode || 'pending'} optics=${residentSurfaceDraw?.renderBridgeOpticalRenderSource || residentRenderState?.surfaceDrawRenderBridgeOpticalRenderSource || 'pending'} records=${residentSurfaceDraw?.renderBridgeOpticalRecordCount ?? residentRenderState?.surfaceDrawRenderBridgeOpticalRecordCount ?? 0} spectra=${residentSurfaceDraw?.renderBridgeOpticalSpectralSampleCount ?? residentRenderState?.surfaceDrawRenderBridgeOpticalSpectralSampleCount ?? 0} swap=${residentSurfaceDraw?.renderBridgeTemporalSwapPolicy || residentRenderState?.surfaceDrawRenderBridgeTemporalSwapPolicy || 'pending'} retained=${Boolean(residentSurfaceDraw?.renderBridgeRetainedPreviousOverlay ?? residentRenderState?.surfaceDrawRenderBridgeRetainedPreviousOverlay)}`,
      `render pressure  : source=${renderPressureSource} optical-state=${Boolean(renderPressureOpticalState)}`,
      `steam optics     : ${vaporOpticalModeStatusText()}`,
      `render cadence   : every=${renderCadence?.cadence ?? RESIDENT_RENDER_READBACK_CADENCE} effective=${renderCadence?.effectiveCadence ?? residentPerfSummary?.effectiveRenderReadbackCadence ?? RESIDENT_RENDER_READBACK_CADENCE} forced=${Boolean(renderCadence?.forced ?? residentPerfSummary?.playbackVisualRefreshForced)} reason=${renderCadence?.reason || 'pending'} sequence=${renderCadence?.sequence ?? 0} skipped=${renderCadence?.skippedCount ?? 0} last-skipped=${Boolean(renderCadence?.skipped)}`,
      `resident profile : submissions=${residentPerfSummary?.residentSubmissions ?? 0} stale=${residentPerfSummary?.staleResidentSubmissions ?? 0} substeps=${residentPerfSummary?.residentStepsPerSchedule ?? currentResidentStepsPerSchedule()} target=${currentResidentTargetSubsteps()} step-ms=${fmt(residentPerfSummary?.lastResidentMs, 1)} render-ms=${fmt(residentPerfSummary?.lastRenderReadbackMs, 1)}`,
      `resident stages  : ${residentStageTimingStatusText(residentStageTiming)}`,
      `cpu step stages  : ${cpuDriverStepTimingStatusText(cpuDriverStepTiming)}`,
      `scene sync       : ${sceneSyncTimingStatusText(overlay.__sphSetParticlesTiming)}`,
      `worker rebuild   : ${workerRebuildTimingStatusText(workerTiming)}`,
      `fps              : render ${fmt(frameCounters.renderFps, 1)} physics ${fmt(frameCounters.physicsFps, 1)} resident ${fmt(frameCounters.residentFps, 1)}`,
      `closure cache    : lookup=${peerClosureCacheLookup?.status || 'pending'} hits=${peerClosureCacheLookup?.hitCount ?? 0} misses=${peerClosureCacheLookup?.missCount ?? 0} stale=${peerClosureCacheLookup?.staleCount ?? 0} stored=${peerClosureCacheWrite?.entryCount ?? 0} consumed=${Boolean(peerClosureCacheConsumed)}`,
      `cold cache       : ${coldStartCacheStatusText()}`,
      `cache clear      : ${cacheClearStatusText()}`,
      `perf trace       : ${performanceTraceStatusText()}`,
      `cpu closure task : ${cpuClosureTask?.active ? `${cpuClosureTask.label} (${cpuClosureTask.location})` : 'idle'}`,
      `mechanics mode   : ${driver?.demo?.gpuMechanics?.integrator || activeViewState?.gpuMechanics?.integrator || mechanicsModeFromControls()}`,
      `standalone mech  : ${standaloneMechanics?.status || 'pending'} backend=${standaloneMechanics?.backend || 'pending'}`,
      `render authoritative: ${renderAuthoritative}`,
      `gpu authoritative: ${Boolean(gpuAuthoritativeState)}`,
      `per-wall ledger  :\n${ledger}`,
      ``,
      `validation       : scientific=false sph=false phase=false (evidence-only)`
    ].join('\n');
  }

  let playing = false;
  let playbackLoopScheduled = false;

  function requestPlaybackTick() {
    if (playbackLoopScheduled) return;
    playbackLoopScheduled = true;
    requestAnimationFrame(tick);
  }

  function startWorkerResidentPlayback({ force = false } = {}) {
    if (driver || !activeViewState) return false;
    if (activeViewState.gpuMechanics?.integrator && activeViewState.gpuMechanics.integrator !== 'mlsmpm') {
      driver = createDriverFromControls({ preferActiveViewStateCache: true });
      if (!driver) return false;
      syncParticles();
      playing = true;
      overlay.querySelector('#sph-play').textContent = 'Pause';
      requestPlaybackTick();
      renderStatus();
      updateWarningBanner();
      return true;
    }
    if (playing && !force) return true;
    playing = true;
    overlay.querySelector('#sph-play').textContent = 'Pause';
    scheduleMlsMpmResidentSteps({
      continueFromResidentState: residentGpuContinuationReady(),
      force
    });
    requestPlaybackTick();
    renderStatus();
    updateWarningBanner();
    return true;
  }

  function tick() {
    playbackLoopScheduled = false;
    if (!playing) return;
    if (!driver) {
      if (activeViewState) {
        scheduleMlsMpmResidentSteps({
          continueFromResidentState: residentGpuContinuationReady()
        });
        renderStatus();
        updateWarningBanner();
        requestPlaybackTick();
      }
      return;
    }
    // A resident refresh in flight owns the next particle state; stepping the
    // CPU driver during it bumps particleSyncGeneration every tick, so any
    // resident backend slower than one playback tick lands stale and is
    // discarded forever (measured livelock on the ComputeManager commit
    // path: generations advanced ~13/s while each ~500ms execution came back
    // ~5 generations behind). Hold CPU stepping until the refresh resolves;
    // the pending watchdog still clears wedged refreshes.
    if (initialResidentAutoEnabled && mechanicsModeFromControls() !== 'sph' && overlay.__mlsMpmResidentStepsPending) {
      renderStatus();
      updateWarningBanner();
      requestPlaybackTick();
      return;
    }
    // Single-authority handoff: once resident GPU continuation is ready, the
    // resident execution owns physics and each CPU step would immediately
    // invalidate it (scene.setParticles clears the resident artifacts and the
    // following sync overwrites the committed execution with a null getter -
    // measured as a publish/null cycle every ~1.5s on the ComputeManager
    // path). Schedule resident continuation exactly like the driverless
    // branch; the CPU driver keeps stepping only while no resident
    // continuation exists (pre-first-execution, or CPU-only mechanics).
    if (initialResidentAutoEnabled && mechanicsModeFromControls() !== 'sph' && residentGpuContinuationReady()) {
      scheduleMlsMpmResidentSteps({ continueFromResidentState: true });
      renderStatus();
      updateWarningBanner();
      requestPlaybackTick();
      return;
    }
    driver.step();
    recordPhysicsFrame(1);
    syncParticles();
    renderStatus();
    updateWarningBanner();
    requestPlaybackTick();
  }

  overlay.querySelector('#sph-preflight').addEventListener('click', renderStatus);
  overlay.querySelector('#sph-step').addEventListener('click', () => {
    if (!driver) {
      if (activeViewState?.gpuMechanics?.integrator && activeViewState.gpuMechanics.integrator !== 'mlsmpm') {
        driver = createDriverFromControls({ preferActiveViewStateCache: true });
        if (driver) {
          driver.step();
          recordPhysicsFrame(1);
          syncParticles();
        }
        renderStatus();
        updateWarningBanner();
        return;
      }
      if (activeViewState) {
        scheduleMlsMpmResidentSteps({
          continueFromResidentState: residentGpuContinuationReady()
        });
      }
      renderStatus();
      updateWarningBanner();
      return;
    }
    driver.step(); recordPhysicsFrame(1); syncParticles(); renderStatus(); updateWarningBanner();
  });
  overlay.querySelector('#sph-play').addEventListener('click', (e) => {
    if (!driver) {
      if (activeViewState?.gpuMechanics?.integrator && activeViewState.gpuMechanics.integrator !== 'mlsmpm') {
        driver = createDriverFromControls({ preferActiveViewStateCache: true });
        if (driver) {
          syncParticles();
          playing = !playing;
          e.target.textContent = playing ? 'Pause' : 'Play';
          if (playing) requestPlaybackTick();
        } else {
          playing = false;
          e.target.textContent = 'Play';
        }
        renderStatus();
        updateWarningBanner();
        return;
      }
      if (activeViewState) {
        playing = !playing;
        e.target.textContent = playing ? 'Pause' : 'Play';
        if (playing) {
          scheduleMlsMpmResidentSteps({
            continueFromResidentState: residentGpuContinuationReady()
          });
          requestPlaybackTick();
        }
      } else {
        playing = false;
        e.target.textContent = 'Play';
        renderStatus();
      }
      return;
    }
    playing = !playing;
    e.target.textContent = playing ? 'Pause' : 'Play';
    if (playing) requestPlaybackTick();
  });
  overlay.querySelector('#sph-reset').addEventListener('click', () => {
    syncUrlFromControls();
    scheduleDemoRebuild();
  });
  overlay.querySelector('#sph-clear-cache').addEventListener('click', () => {
    clearLocalDerivedCachesAndRebuild();
  });

  // Collapsible control drawer. Start collapsed on small/portrait screens so the scene is the
  // first thing visible; the toggle button reveals it.
  const panel = overlay.querySelector('#sph-panel');
  const toggle = overlay.querySelector('#sph-toggle');
  let collapsed = hideMenu || autoStart || window.innerWidth < 700;
  function applyCollapsed() {
    panel.classList.toggle('collapsed', collapsed);
    toggle.textContent = collapsed ? '☰ menu' : '✕ hide';
    toggle.setAttribute('aria-expanded', String(!collapsed));
  }
  toggle.addEventListener('click', () => { collapsed = !collapsed; applyCollapsed(); });
  applyCollapsed();

  let fpsLoopRunning = true;
  function fpsLoop() {
    if (!fpsLoopRunning || !overlay.isConnected) return;
    sampleFrameCounters();
    requestAnimationFrame(fpsLoop);
  }
  updateWarningBanner();
  requestAnimationFrame(fpsLoop);
  if (!initialWorkerRebuildAvailable) {
    scheduleStaticTableCacheRead({ reason: 'initial-preload' });
  }

  function close() {
    playing = false;
    fpsLoopRunning = false;
    staticTableCacheReadGeneration += 1;
    staticTableCacheGeneration += 1;
    if (rebuildTimer != null) window.clearTimeout(rebuildTimer);
    disposeMountedMechanicsStageWorkerRunner('demo-close');
    scene.dispose();
    initialRendererWebGpuDeviceResult?.device?.destroy?.();
    overlay.remove();
  }
  overlay.querySelector('#sph-close').addEventListener('click', close);

  if (initialWorkerRebuildAvailable) {
    renderStatus();
    updateWarningBanner();
    Promise.resolve(initialWorkerRebuildPromise).then(({ result, error, generation, submittedAtMs, reason }) => {
      if (!overlay.isConnected || generation !== workerRebuildGeneration) return;
      if (error) {
        recordPerformanceSpan('ulg-runtime worker createSphPhaseDemo failed', submittedAtMs, performance.now(), {
          reason,
          error: error instanceof Error ? error.message : String(error)
        });
        overlay.__sphPhaseRebuildWorker = {
          schema: SPH_PHASE_REBUILD_WORKER_STATUS_SCHEMA,
          status: 'fallback-main-thread',
          generation,
          reason: error instanceof Error ? error.message : String(error),
          updatedAtMs: performance.now()
        };
        setCpuClosureTask({
          label: 'material/reaction/closure rebuild',
          location: 'main thread fallback',
          reason: error instanceof Error ? error.message : String(error)
        });
        rebuildDemoFromControls();
        return;
      }
      activeWorkerRebuildTask = {
        ...activeWorkerRebuildTask,
        rootTaskId: result?.rootTaskId || null,
        status: 'complete'
      };
      const artifact = result?.artifact || null;
      recordPerformanceSpan('ulg-runtime worker createSphPhaseDemo', submittedAtMs, performance.now(), {
        reason,
        backend: artifact?.execution?.backend || 'cpu-worker',
        reactionCount: result?.viewState?.reactions?.length
          ?? artifact?.outputs?.viewStateSummary?.reactionCount
          ?? artifact?.outputs?.viewState?.reactions?.length
          ?? 0,
        materialCount: Object.keys(result?.viewState?.materialProperties || {}).length
          || artifact?.outputs?.viewStateSummary?.materialKeys?.length
          || Object.keys(artifact?.outputs?.viewState?.materialProperties || {}).length
      });
      applyWorkerRebuildResult(result, generation);
    }).finally(() => {
      if (overlay.isConnected) {
        activeWorkerRebuildTask = null;
        setCpuClosureTask(null);
        publishPeerClosureCacheState();
        renderStatus();
        updateWarningBanner();
      }
    });
  } else {
    syncParticles();
    renderStatus();
  }
  if (residentAutoStartEnabled && driver) {
    playing = true;
    overlay.querySelector('#sph-play').textContent = 'Pause';
    requestPlaybackTick();
  } else if (residentAutoStartEnabled) {
    startWorkerResidentPlayback();
  }
  return { close, overlay };
}
