// SPH phase demo UI: a full-viewport overlay with the MLS-MPM-style particle renderer, a
// retro-terminal control panel (six wall temperatures + reduced-resolution controls), and live
// status rows. Also exposes a headless API on window.__ulgDemo for e2e/status checks.

import {
  SPH_SCENE_BACKGROUND_COLOR_DEFAULT,
  SPH_SCENE_LIGHTING_MODE_DARK_LAB,
  SPH_SCENE_LIGHTING_MODE_DEFAULT,
  SPH_NATIVE_SURFACE_CAMERA_SNAPSHOT_STALE_ERROR_CODE,
  SPH_NATIVE_WEBGPU_SURFACE_VALIDATION_MAP_TIMEOUT_MS,
  SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT,
  SPH_RESIDENT_SURFACE_DRAW_OVERLAY_MODE_DEFAULT,
  ULG_WORKER_LANE_NATIVE_SURFACE_PRESENTATION_SOURCE_SCHEMA,
  compactPageVisibleGpuReadbackTelemetry,
  createSphPhaseScene,
  inspectExactSphSpatialGasPressureAuthorityImport,
  normalizeSphSceneBackgroundColorHex,
  normalizeSphSceneLightingMode,
  normalizeResidentSurfaceDrawOverlayMode,
  normalizeSphRendererBackend,
  resolveOpticalSurfaceVisibility,
  resolveSphSchroederHierarchyContactAdmission
} from './sphPhaseScene.js';
import { ELEMENT_MATERIAL_OPTIONS, MATERIAL_OPTIONS } from './sphMaterialOptions.js';
import {
  ULG_SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_EXECUTION_SCHEMA,
  ULG_SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_SCHEMA,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
  ULG_MLS_MPM_GPU_RESIDENT_STEPS_EXECUTION_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  hashPayload
} from '../../ulg-gpu-abi/src/index.js';
import {
  ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V1
} from '../runtime/sph/sphSpatialGasLedgerEosGpu.js';
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
  refreshUlgSphMlsMpmHotBuffersFromCompactSnapshot,
  summarizePeerComputeResidentAuthorityHost
} from '../runtime/peercomputeBrowserResidentHost.js';
import {
  SPH_GPU_PARTICLE_IDENTITY_UINTS,
  destroyMlsMpmGpuParticleBuffers,
  destroySphGpuParticleBuffers
} from '../runtime/sph/sphGpuBuffers.js';
import {
  ULG_PEERCOMPUTE_RENDER_OWNERSHIP_MODES,
  normalizePeerComputeRenderOwnershipMode,
  resolvePeerComputeRenderOwnershipPolicy
} from '../runtime/peercomputeRenderOwnershipPolicy.js';
import {
  ULG_WORKER_LANE_COMPUTE_MANAGER_COMPLETION_SCHEMA,
  ULG_WORKER_OFFSCREEN_COMMITTED_RESIDENT_SCHEDULE_PRESENTATION_SCHEMA,
  resolveUlgWorkerOffscreenPresentationCapability
} from './offscreenPresentationBridge.js';
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
import {
  allocateNextSphInitialBodyIdentity,
  deriveSphInitialBodySizeM,
  duplicateSphInitialBody,
  moveSphInitialBody,
  normalizeSphInitialBodies,
  parseSphInitialBodies,
  preflightSphInitialBodiesForSimulation,
  serializeSphInitialBodies,
  sphInitialBodiesFromLegacyPhaseControls
} from '../runtime/sphInitialBodies.js';
import { sphTotals } from '../runtime/sph/sphConservation.js';
import { deriveCompoundClosure } from '../runtime/material/compoundClosure.js';
import { CONDUCTOR_OPTICAL_CONSTANTS_BANK } from '../runtime/material/conductorOpticalConstants.js';
import { deriveElementProperties } from '../runtime/material/elementClosures.js';
import {
  deriveFormulaMaterialProperties,
  deriveMaterialProperties,
  resolveMaterialSpec
} from '../runtime/material/materialDerivation.js';
import { requestOpticalGpuDevice } from '../runtime/material/opticalGpuBuffers.js';
import { RESIDENT_SPH_STORAGE_BUFFERS_PER_STAGE } from '../runtime/webgpuDeviceLimits.js';
import { materialDerivationSummary } from '../runtime/material/propertyProvenance.js';
import { MOLECULAR_ELECTRONIC_BANDS_BANK } from '../runtime/material/referenceBankAnchoring.js';
import { unpackSphPhaseViewStateFromTransport } from '../runtime/sphPhaseViewStateTransport.js';

const WALL_FACES = ['xMin', 'xMax', 'yMin', 'yMax', 'zMin', 'zMax'];
const PHYSICAL_LAW_GROUPS = Object.freeze([
  ['mechanics', 'MLS-MPM mechanics', true],
  ['gravity', 'gravity', true],
  ['eos', 'material EOS pressure', true],
  ['pressure', 'gas/pressure coupling', true],
  ['thermal', 'thermal/walls', true],
  ['reactions', 'reactions', true],
  ['viscosity', 'viscosity', true],
  ['surfaceTension', 'surface tension (single-level SS)', false]
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
export const SPH_PENDING_BODY_ENVELOPE_PREVIEW_SCHEMA =
  'peercompute.ulg.sph-pending-body-envelope-preview.v0';
export const SPH_SIMULATION_RUNTIME_PREREQUISITE_SCHEMA =
  'peercompute.ulg.sph-simulation-runtime-prerequisite.v0';
export const SPH_LOCAL_BACKGROUND_IMAGE_CONTROL_VALUE = '__local-background-image__';
export const SPH_LOCAL_BACKGROUND_IMAGE_MAX_BYTES = 32 * 1024 * 1024;
export const SPH_LOCAL_BACKGROUND_IMAGE_MIME_TYPES = Object.freeze([
  'image/avif',
  'image/jpeg',
  'image/png',
  'image/webp'
]);

export function validateSphLocalBackgroundImageFile(file, {
  maxBytes = SPH_LOCAL_BACKGROUND_IMAGE_MAX_BYTES
} = {}) {
  if (!file || typeof file !== 'object') {
    return {
      accepted: false,
      status: 'local-background-image-missing-file',
      reason: 'Choose a PNG, JPEG, WebP, or AVIF image.'
    };
  }
  const name = String(file.name || 'local image');
  const type = String(file.type || '').trim().toLowerCase();
  const sizeBytes = Math.max(0, Math.floor(Number(file.size) || 0));
  if (!SPH_LOCAL_BACKGROUND_IMAGE_MIME_TYPES.includes(type)) {
    return {
      accepted: false,
      status: 'local-background-image-unsupported-type',
      reason: 'Use a PNG, JPEG, WebP, or AVIF image.',
      name,
      type,
      sizeBytes
    };
  }
  if (sizeBytes <= 0) {
    return {
      accepted: false,
      status: 'local-background-image-empty-file',
      reason: 'The selected image is empty.',
      name,
      type,
      sizeBytes
    };
  }
  const resolvedMaxBytes = Math.max(1, Math.floor(Number(maxBytes) || SPH_LOCAL_BACKGROUND_IMAGE_MAX_BYTES));
  if (sizeBytes > resolvedMaxBytes) {
    return {
      accepted: false,
      status: 'local-background-image-too-large',
      reason: `Choose an image no larger than ${Math.round(resolvedMaxBytes / (1024 * 1024))} MiB.`,
      name,
      type,
      sizeBytes,
      maxBytes: resolvedMaxBytes
    };
  }
  return {
    accepted: true,
    status: 'local-background-image-file-accepted',
    reason: null,
    name,
    type,
    sizeBytes,
    maxBytes: resolvedMaxBytes
  };
}
const PEER_CLOSURE_CACHE_SCHEMA = 'peercompute.ulg.local-derived-closure-cache.v2';
const PEER_CLOSURE_CACHE_RECORD_SCHEMA = 'peercompute.ulg.local-derived-material-closure-cache-record.v2';
const PEER_CLOSURE_CACHE_GENERATOR_SCHEMA = 'peercompute.ulg.material-closure-generator-fingerprint.v1';
const PEER_CLOSURE_CACHE_APP_VERSION = '0.1.0';
const PEER_CLOSURE_CACHE_METHOD_VERSION = 'ulg.generic-derivation+reference-bank-anchoring.v4';
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
  },
  referenceBanks: {
    conductorOpticalConstants: CONDUCTOR_OPTICAL_CONSTANTS_BANK,
    molecularElectronicBands: MOLECULAR_ELECTRONIC_BANDS_BANK
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
// A committed body-card edit updates the authoritative draft immediately,
// while material/reaction closure rebuilds are coalesced across a short burst
// of axis edits or card operations. This avoids queueing obsolete expensive
// rebuilds as somebody tabs through X/Y/Z fields.
const INITIAL_BODY_EDITOR_REBUILD_DEBOUNCE_MS = 200;
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
// A native surface candidate is not allowed to race ahead of the visible
// presentation forever. This is deliberately bounded: an unusually slow
// presentation admission must not deadlock resident mechanics, while the
// normal path waits long enough to publish the exact current generation.
// Candidate validation is asynchronous and diagnostic pixel proof may permit one GPU
// map timeout. Allow its full deadline plus a commit/frame margin before
// mechanics is allowed to supersede the exact-generation candidate.
const NATIVE_SURFACE_CURRENT_PRESENTATION_WAIT_MS =
  SPH_NATIVE_WEBGPU_SURFACE_VALIDATION_MAP_TIMEOUT_MS + 250;
const NATIVE_SURFACE_CAMERA_PRESENTATION_SETTLE_FRAME_COUNT = 6;
const NATIVE_SURFACE_CAMERA_PRESENTATION_SETTLE_WAIT_MS = 8_000;
const NATIVE_SURFACE_CAMERA_PRESENTATION_RECOVERY_MAX_ATTEMPTS = 3;
// The camera-only snapshot contract accepts 1e-6 sub-pixel damping drift.
// Anchor this recovery window an order of magnitude tighter so the remaining
// OrbitControls damping tail stays within that scene-side admission bound.
export const SPH_NATIVE_SURFACE_CAMERA_PRESENTATION_SETTLE_ABSOLUTE_TOLERANCE =
  1e-7;

export function sphNativeSurfaceCameraPresentationFingerprintsMatch(
  left,
  right,
  {
    absoluteTolerance = SPH_NATIVE_SURFACE_CAMERA_PRESENTATION_SETTLE_ABSOLUTE_TOLERANCE
  } = {}
) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
    return false;
  }
  const tolerance = Number.isFinite(Number(absoluteTolerance))
    ? Math.max(0, Number(absoluteTolerance))
    : 0;
  return left.every((value, index) => {
    const other = right[index];
    if (Object.is(value, other)) return true;
    return tolerance > 0
      && Number.isFinite(Number(value))
      && Number.isFinite(Number(other))
      && Math.abs(Number(value) - Number(other)) <= tolerance;
  });
}
const RESIDENT_PENDING_SLOW_NOTICE_MS = 20_000;
const RESIDENT_PENDING_WATCHDOG_MS = 120_000;
const RESIDENT_STAGE_ORDER_TRACE_EVENT_LIMIT = 64;
const RESIDENT_VISIBLE_MOTION_THRESHOLD_FRACTION = 1e-3;
const RESIDENT_VISIBLE_MOTION_THRESHOLD_MIN_M = 1e-6;
const STANDALONE_MECHANICS_PREDICTION_DEFAULT = false;
const DEFAULT_INTERACTIVE_RENDER_OWNERSHIP_USE_CASE = 'same-device-interactive';

// Bounded status telemetry (plan/todo/ss-regression.md correction 4): the
// full status traversal is expensive scene-wide work, so it may never run
// per resident step. Hidden panel: zero traversals, one deferred flush on
// expand. Visible panel: leading-edge render, then trailing coalescence at
// this cadence.
export const SPH_STATUS_REFRESH_MIN_INTERVAL_MS = 250;

export function resolveSphStatusRefreshDecision({
  panelHidden = false,
  lastRenderMs = 0,
  nowMs = 0,
  minIntervalMs = SPH_STATUS_REFRESH_MIN_INTERVAL_MS
} = {}) {
  if (panelHidden) return Object.freeze({ action: 'skip-hidden', delayMs: 0 });
  const elapsed = Math.max(0, Number(nowMs) - Number(lastRenderMs));
  if (!Number.isFinite(elapsed) || elapsed >= minIntervalMs) {
    return Object.freeze({ action: 'render-now', delayMs: 0 });
  }
  return Object.freeze({
    action: 'defer',
    delayMs: Math.max(1, minIntervalMs - elapsed)
  });
}

export function resolveSphResidentScheduleStepCount({
  requestedStepCount = 1,
  schroederSimulationEnabled = false,
  workerLaneActive = false
} = {}) {
  const normalized = Math.max(
    1,
    Math.min(
      RESIDENT_PARTICLE_BRIDGE_STEPS_PER_SCHEDULE_MAX,
      Math.round(Number(requestedStepCount) || 1)
    )
  );
  // One canonical SS generation is immutable for exactly one position epoch.
  // Asking the DIRECT scene-resident sequence executor to reuse it across a
  // multi-step mounted batch is rejected before step 1, so the direct route
  // publishes one completed epoch per schedule and the RAF continuation
  // builds the next hierarchy generation for the next physics step.
  //
  // W4b: the worker-owned resident lane batches legally. Each worker schedule
  // step builds and seals ITS OWN spatial epoch generation (the W2 driver
  // fails closed with 'epoch-identity-regressed' if a step does not advance),
  // so a multi-step batch never reuses a generation across a position epoch
  // and the whole batch runs off the page thread.
  if (schroederSimulationEnabled) return workerLaneActive ? normalized : 1;
  return normalized;
}

export function resolveSphMountedWorkerLaneScheduleStepCount({
  requestedStepCount = 1,
  residentStepsPerScheduleMax = null,
  workerLaneActive = false
} = {}) {
  const requested = Math.max(1, Math.round(Number(requestedStepCount) || 1));
  const policyMax = Number.isInteger(Number(residentStepsPerScheduleMax))
    && Number(residentStepsPerScheduleMax) > 0
    ? Number(residentStepsPerScheduleMax)
    : RESIDENT_PARTICLE_BRIDGE_STEPS_PER_SCHEDULE_MAX;
  return resolveSphResidentScheduleStepCount({
    requestedStepCount: Math.min(requested, policyMax),
    schroederSimulationEnabled: true,
    workerLaneActive
  });
}

export function resolveSphMountedScheduleControlEvidence({
  requestedStepCount = 1,
  residentStepsPerScheduleMax = null,
  workerLaneActive = false
} = {}) {
  const requested = Math.max(1, Math.round(Number(requestedStepCount) || 1));
  const policyMax = Number.isInteger(Number(residentStepsPerScheduleMax))
    && Number(residentStepsPerScheduleMax) > 0
    ? Number(residentStepsPerScheduleMax)
    : RESIDENT_PARTICLE_BRIDGE_STEPS_PER_SCHEDULE_MAX;
  const effective = resolveSphMountedWorkerLaneScheduleStepCount({
    requestedStepCount: requested,
    residentStepsPerScheduleMax: policyMax,
    workerLaneActive
  });
  return Object.freeze({
    schema: 'peercompute.ulg.sph-mounted-schedule-control-evidence.v0',
    status: 'mounted-schedule-control-evidence-ready',
    requestedStepCount: requested,
    policyMaxStepCount: policyMax,
    effectiveStepCount: effective,
    workerLaneActive: workerLaneActive === true,
    requestCappedByPolicy: effective < requested
  });
}

export function resolveSphMountedArchitectureControlState({
  mechanicsMode = 'mlsmpm',
  ss = false,
  twoLevel = false,
  activeNodeIndex = false,
  activeNodeSortedIndex = false,
  lawQueue = false,
  lawNeighborCandidates = false,
  crossLevelCoupling = false,
  phaseVolumeMigration = false,
  mechanicsFieldPairV2 = false,
  contactSolver = true,
  surfaceDraw = 'auto',
  surfaceOverlay = false,
  workerParticleOverlay = false,
  twoLevelAuthority = 'observation',
  fineSubsteps = 2,
  normalizeDependencies = false
} = {}) {
  const state = {
    mechanicsMode: String(mechanicsMode || 'mlsmpm'),
    ss: ss === true,
    twoLevel: twoLevel === true,
    activeNodeIndex: activeNodeIndex === true,
    activeNodeSortedIndex: activeNodeSortedIndex === true,
    lawQueue: lawQueue === true,
    lawNeighborCandidates: lawNeighborCandidates === true,
    crossLevelCoupling: crossLevelCoupling === true,
    phaseVolumeMigration: phaseVolumeMigration === true,
    mechanicsFieldPairV2: mechanicsFieldPairV2 === true,
    contactSolver: contactSolver !== false,
    surfaceDraw: String(surfaceDraw || 'auto'),
    surfaceOverlay: surfaceOverlay === true,
    workerParticleOverlay: workerParticleOverlay === true,
    twoLevelAuthority:
      String(twoLevelAuthority).toLowerCase() === 'authoritative'
        ? 'authoritative'
        : 'observation',
    fineSubsteps: Math.max(1, Math.min(4, Math.round(Number(fineSubsteps) || 1)))
  };
  const workerSs = state.mechanicsMode === 'mlsmpm' && state.ss;
  if (normalizeDependencies) {
    // Plain SPH owns a CPU-reference route and cannot host the Schroeder
    // hierarchy. Selecting it is an explicit architecture opt-out, so clear
    // the parent switch together with all of its dependent controls.
    if (state.mechanicsMode !== 'mlsmpm') state.ss = false;
    // Contact under worker SS is an explicit choice, not a forced law:
    // unchecked declares the contact-free bulk profile (grid + EOS own
    // liquid volume; the worker lane fails closed unless its
    // law-activation receipt is quiescent). It never silently turns the
    // hierarchy into the legacy direct route.
    if (!workerSs) {
      for (const key of [
        'twoLevel',
        'activeNodeIndex',
        'activeNodeSortedIndex',
        'lawQueue',
        'lawNeighborCandidates',
        'crossLevelCoupling',
        'phaseVolumeMigration',
        'mechanicsFieldPairV2',
        'workerParticleOverlay'
      ]) state[key] = false;
      state.twoLevelAuthority = 'observation';
    }
    if (!state.twoLevel) {
      state.crossLevelCoupling = false;
      state.mechanicsFieldPairV2 = false;
      state.twoLevelAuthority = 'observation';
    } else if (state.twoLevelAuthority === 'authoritative') {
      // Authoritative adjacent-level transport is the paired-field terminal
      // reflux transaction. The generic coupling-candidate path is an
      // observation-mode subsystem and is deliberately bypassed by the GPU
      // hierarchy in authoritative mode.
      state.crossLevelCoupling = false;
    }
    if (!state.activeNodeIndex) state.activeNodeSortedIndex = false;
    if (!state.lawQueue) state.lawNeighborCandidates = false;
    if (
      state.twoLevel
      && state.twoLevelAuthority === 'authoritative'
      && state.fineSubsteps < 2
    ) state.fineSubsteps = 2;
  }
  const normalizedWorkerSs = state.mechanicsMode === 'mlsmpm' && state.ss;
  const normalizedTwoLevel = normalizedWorkerSs && state.twoLevel;
  const dependencyIssues = [];
  if (state.ss && state.mechanicsMode !== 'mlsmpm') {
    dependencyIssues.push('ss-requires-mlsmpm');
  }
  if (state.twoLevel && !normalizedWorkerSs) dependencyIssues.push('two-level-requires-worker-ss');
  if (state.activeNodeSortedIndex && !state.activeNodeIndex) {
    dependencyIssues.push('sorted-active-index-requires-active-index');
  }
  if (state.lawNeighborCandidates && !state.lawQueue) {
    dependencyIssues.push('law-neighbor-candidates-require-law-queue');
  }
  if (state.crossLevelCoupling) {
    if (!normalizedTwoLevel) {
      dependencyIssues.push('cross-level-coupling-requires-two-level');
    } else if (state.twoLevelAuthority === 'authoritative') {
      dependencyIssues.push(
        'generic-cross-level-coupling-superseded-by-authoritative-paired-fields'
      );
    }
  }
  if (state.mechanicsFieldPairV2 && !normalizedTwoLevel) {
    dependencyIssues.push('paired-fields-require-two-level');
  }
  if (state.workerParticleOverlay && !normalizedWorkerSs) {
    dependencyIssues.push('worker-particle-overlay-requires-worker-ss');
  }
  // Contact-off under worker SS is the declared contact-free bulk profile,
  // not a dependency violation; the worker lane enforces its eligibility.
  if (
    normalizedTwoLevel
    && state.twoLevelAuthority === 'authoritative'
    && state.fineSubsteps < 2
  ) dependencyIssues.push('authoritative-two-level-requires-two-fine-substeps');
  const disabled = Object.freeze({
    // Keep a dirty checked URL repairable; once SS is off, plain SPH makes the
    // unavailable hierarchy control explicitly read-only.
    ss: state.mechanicsMode !== 'mlsmpm' && !state.ss,
    twoLevel: !normalizedWorkerSs,
    activeNodeIndex: !normalizedWorkerSs,
    activeNodeSortedIndex: !normalizedWorkerSs || !state.activeNodeIndex,
    lawQueue: !normalizedWorkerSs,
    lawNeighborCandidates: !normalizedWorkerSs || !state.lawQueue,
    crossLevelCoupling:
      !normalizedTwoLevel || state.twoLevelAuthority === 'authoritative',
    phaseVolumeMigration: !normalizedWorkerSs,
    mechanicsFieldPairV2: !normalizedTwoLevel,
    // Contact under worker SS is an explicit, editable choice: checked runs
    // the canonical pair-contact solve, unchecked declares contact-free bulk.
    contactSolver: false,
    workerParticleOverlay: !normalizedWorkerSs,
    twoLevelAuthority: !normalizedTwoLevel,
    fineSubsteps: !normalizedTwoLevel
  });
  const canonicalWorkerCommon = Boolean(
    normalizedWorkerSs
    && state.activeNodeIndex
    && state.activeNodeSortedIndex
    && state.lawQueue
    && state.lawNeighborCandidates
    && state.phaseVolumeMigration
    && state.contactSolver
    && state.surfaceDraw === 'native-webgpu-surface-consumer'
    && !state.surfaceOverlay
    && !state.workerParticleOverlay
  );
  let profile = 'custom';
  if (
    canonicalWorkerCommon
    && !state.twoLevel
    && !state.crossLevelCoupling
    && !state.mechanicsFieldPairV2
    && state.twoLevelAuthority === 'observation'
    && state.fineSubsteps === 2
  ) {
    profile = 'ss-single-worker';
  } else if (
    canonicalWorkerCommon
    && state.twoLevel
    && state.mechanicsFieldPairV2
    && state.fineSubsteps === 2
    && (
      (state.twoLevelAuthority === 'authoritative'
        && !state.crossLevelCoupling)
      || (state.twoLevelAuthority === 'observation'
        && state.crossLevelCoupling)
    )
  ) {
    profile = state.twoLevelAuthority === 'authoritative'
      ? 'ss-two-authoritative-worker'
      : 'ss-two-observation-worker';
  } else if (
    !state.ss
    && !state.twoLevel
    && !state.activeNodeIndex
    && !state.activeNodeSortedIndex
    && !state.lawQueue
    && !state.lawNeighborCandidates
    && !state.crossLevelCoupling
    && !state.phaseVolumeMigration
    && !state.mechanicsFieldPairV2
    && !state.surfaceOverlay
    && !state.workerParticleOverlay
    && state.contactSolver
    && state.surfaceDraw === 'auto'
  ) {
    profile = 'main-thread-diagnostic';
  }
  return Object.freeze({
    schema: 'peercompute.ulg.sph-mounted-architecture-control-state.v0',
    status: 'mounted-architecture-control-state-ready',
    ...state,
    workerSs,
    normalizedWorkerSs,
    normalizedTwoLevel,
    crossLevelTransportMode: normalizedTwoLevel
      ? (state.twoLevelAuthority === 'authoritative'
        ? 'authoritative-paired-fields-terminal-reflux'
        : (state.crossLevelCoupling
          ? 'generic-coupling-candidates-observation'
          : 'disabled'))
      : 'disabled',
    authoritativeFineSubstepMinimum:
      normalizedTwoLevel && state.twoLevelAuthority === 'authoritative' ? 2 : 1,
    contactSolverMode: normalizedWorkerSs
      ? (state.contactSolver
        ? 'canonical-spatial-contact'
        : 'explicit-contact-free-bulk')
      : 'diagnostic-inactive-without-worker-ss',
    dependencyIssues: Object.freeze(dependencyIssues),
    disabled,
    profile
  });
}

export function resolveSphResidentInterfaceRefreshContinuationPolicy({
  schroederSimulationEnabled = false,
  residentComputeManagerMode = 'direct',
  workerOwnedResidentLaneActive = false,
  pressureEnabled = true,
  reactionsEnabled = true,
  reactionCount = 0,
  interfaceRefreshMode = 'blocking'
} = {}) {
  const directResidentExecution = residentComputeManagerMode === 'direct';
  const canonicalSchroederDirectHotLoop = Boolean(
    schroederSimulationEnabled === true
    && directResidentExecution
  );
  const canonicalSchroederWorkerHotLoop = Boolean(
    schroederSimulationEnabled === true
    && workerOwnedResidentLaneActive === true
  );
  const canonicalSchroederHotLoop = Boolean(
    canonicalSchroederDirectHotLoop
    || canonicalSchroederWorkerHotLoop
  );
  const legacyPressureRowContinuationGate = Boolean(
    !canonicalSchroederHotLoop
    && directResidentExecution
    && pressureEnabled !== false
    && reactionsEnabled !== false
    && Math.max(0, Math.round(Number(reactionCount) || 0)) > 0
  );
  return Object.freeze({
    canonicalSchroederDirectHotLoop,
    canonicalSchroederWorkerHotLoop,
    canonicalSchroederHotLoop,
    startLegacyPostStepInterfaceRefresh: !canonicalSchroederHotLoop,
    requireInterfaceBeforeNextResidentContinuation: legacyPressureRowContinuationGate,
    awaitLegacyPostStepInterfaceRefresh: Boolean(
      !canonicalSchroederHotLoop
      && (
        interfaceRefreshMode === 'blocking'
        || legacyPressureRowContinuationGate
      )
    )
  });
}

export function sphResidentInterfaceRefreshPublicationIsCurrent({
  interfaceRefreshToken = null,
  currentInterfaceRefreshToken = null,
  generation = null,
  currentGeneration = null,
  overlayConnected = false
} = {}) {
  return Boolean(
    Number.isSafeInteger(interfaceRefreshToken)
    && Number.isSafeInteger(currentInterfaceRefreshToken)
    && interfaceRefreshToken === currentInterfaceRefreshToken
    && Number.isSafeInteger(generation)
    && Number.isSafeInteger(currentGeneration)
    && generation === currentGeneration
    && overlayConnected === true
  );
}

export function sphResidentSchedulePublicationIsCurrent({
  overlayConnected = false,
  resetRebuildPending = false,
  sceneCurrent = false,
  generation = null,
  currentGeneration = null,
  scheduleToken = null,
  currentScheduleToken = null
} = {}) {
  return Boolean(
    overlayConnected === true
    && resetRebuildPending !== true
    && sceneCurrent === true
    && Number.isSafeInteger(generation)
    && Number.isSafeInteger(currentGeneration)
    && generation === currentGeneration
    && Number.isSafeInteger(scheduleToken)
    && Number.isSafeInteger(currentScheduleToken)
    && scheduleToken === currentScheduleToken
  );
}

export function sphResidentRenderSchedulePublicationIsCurrent({
  residentComputeManagerMode = null,
  currentResidentComputeManagerMode = null,
  surfaceDrawDiagnosticMode = null,
  currentSurfaceDrawDiagnosticMode = null,
  ...scheduleState
} = {}) {
  return Boolean(
    sphResidentSchedulePublicationIsCurrent(scheduleState)
    && typeof residentComputeManagerMode === 'string'
    && residentComputeManagerMode.length > 0
    && residentComputeManagerMode === currentResidentComputeManagerMode
    && typeof surfaceDrawDiagnosticMode === 'string'
    && surfaceDrawDiagnosticMode.length > 0
    && surfaceDrawDiagnosticMode === currentSurfaceDrawDiagnosticMode
  );
}

export function sphResidentInterfaceSchedulePublicationIsCurrent(state = {}) {
  return Boolean(
    sphResidentInterfaceRefreshPublicationIsCurrent(state)
    && sphResidentSchedulePublicationIsCurrent(state)
  );
}

export function sphResidentPlaybackRestartAllowed({
  scheduleContinuation = false,
  playing = false,
  continuationReady = false,
  generationCurrent = false,
  requiredInterfaceRefreshReady = true
} = {}) {
  return Boolean(
    scheduleContinuation !== true
    && playing === true
    && continuationReady === true
    && generationCurrent === true
    && requiredInterfaceRefreshReady === true
  );
}

export function sphResidentChainedContinuationAllowed({
  scheduleContinuation = false,
  playing = false,
  scheduleCurrent = false
} = {}) {
  return Boolean(
    scheduleContinuation === true
    && playing === true
    && scheduleCurrent === true
  );
}

export function shouldSkipSphResidentPressureInterfaceForRenderRefresh({
  schroederSimulationEnabled = false,
  residentComputeManagerMode = null,
  workerOwnedResidentLaneActive = false
} = {}) {
  return Boolean(
    schroederSimulationEnabled === true
    && (
      residentComputeManagerMode === 'direct'
      || workerOwnedResidentLaneActive === true
    )
  );
}

export function resolveSphResidentScheduleAdmission({
  signature = null,
  pendingSignature = null,
  force = false
} = {}) {
  if (!signature) {
    return {
      admit: false,
      status: 'resident-schedule-rejected-missing-signature'
    };
  }
  if (pendingSignature === signature) {
    return {
      admit: false,
      status: 'resident-schedule-coalesced-identical-pending'
    };
  }
  if (pendingSignature && force !== true) {
    return {
      admit: false,
      status: 'resident-schedule-held-behind-different-pending'
    };
  }
  return {
    admit: true,
    status:
      pendingSignature && force === true
        ? 'resident-schedule-admitted-forced-latest-wins'
        : 'resident-schedule-admitted'
  };
}

export function isSphResidentTerminalAutoScheduleError({
  scheduleIsCurrent = false,
  invocationProgress = null,
  currentProgress = null
} = {}) {
  if (
    scheduleIsCurrent !== true
    || !invocationProgress
    || !currentProgress
    || currentProgress === invocationProgress
    || currentProgress.status !== 'resident-steps-error'
    || !invocationProgress.signature
    || currentProgress.signature !== invocationProgress.signature
  ) {
    return false;
  }
  const invocationGeneration = Number(
    invocationProgress.residentExecutionGeneration
  );
  const errorGeneration = Number(
    currentProgress.residentExecutionGeneration
  );
  const currentGeneration = Number(
    currentProgress.currentResidentExecutionGeneration
  );
  return Number.isSafeInteger(invocationGeneration)
    && Number.isSafeInteger(errorGeneration)
    && Number.isSafeInteger(currentGeneration)
    && errorGeneration === invocationGeneration
    && errorGeneration === currentGeneration;
}

export function resolveSphNativeSurfaceStartupPresentationGateSettlement({
  gate = null,
  generation = null,
  currentGeneration = generation,
  presentationAdmitted = null,
  presentationVisible = false,
  presentationProof = null,
  presentationProofWait = null,
  refreshError = null,
  updatedAtMs = null
} = {}) {
  const validGenerationInput = (value) => (
    typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= 0
  );
  const requestedGeneration = generation;
  const activeGeneration = currentGeneration;
  const gateGeneration = gate?.generation;
  if (
    !gate?.active
    || !validGenerationInput(requestedGeneration)
    || !validGenerationInput(activeGeneration)
    || !validGenerationInput(gateGeneration)
    || requestedGeneration !== activeGeneration
    || gateGeneration !== requestedGeneration
  ) {
    return gate;
  }

  const proofStatus = presentationProof?.status || null;
  const exactProofAdmitted = Boolean(
    presentationProof?.admitted === true
    && presentationProof?.sourceCurrent === true
    && (
      proofStatus === 'native-resident-presentation-submission-admitted'
      || proofStatus === 'native-resident-presentation-foreground-proved'
    )
  );
  const admitted = Boolean(
    exactProofAdmitted
    && (
      presentationAdmitted == null
      || presentationAdmitted === true
    )
  );
  const foregroundProved = Boolean(
    admitted
    && presentationVisible === true
    && presentationProof?.foregroundProved === true
    && proofStatus === 'native-resident-presentation-foreground-proved'
  );
  const error = typeof refreshError === 'string' && refreshError.trim()
    ? refreshError.trim()
    : null;
  if (!admitted && !error && presentationProofWait == null) return gate;
  const proofWaitStatus = presentationProofWait?.status || null;
  const timedOut = (
    proofWaitStatus === 'resident-presentation-proof-wait-timeout'
    || proofStatus === 'resident-presentation-proof-wait-timeout'
  );
  const status = admitted
    ? 'native-surface-startup-initial-presentation-admitted'
    : error
      ? 'native-surface-startup-initial-presentation-error-fail-open'
      : timedOut
        ? 'native-surface-startup-initial-presentation-timeout-fail-open'
        : 'native-surface-startup-initial-presentation-unadmitted-fail-open';
  const reason = admitted
    ? (foregroundProved
      ? 'the exact t=0 native source was runtime-admitted with foreground pixel proof before resident playback began'
      : 'the exact t=0 native source was runtime-admitted by its ordered GPU submission receipt before resident playback began')
    : error
      ? 'the initial native presentation refresh failed; resident playback was released to preserve simulation liveness'
      : timedOut
        ? 'the bounded t=0 native presentation proof timed out; resident playback was released to preserve simulation liveness'
        : 'the bounded t=0 native presentation attempt remained unadmitted; resident playback was released to preserve simulation liveness';
  const normalizedUpdatedAtMs =
    updatedAtMs != null && Number.isFinite(Number(updatedAtMs))
      ? Number(updatedAtMs)
      : null;

  return Object.freeze({
    ...gate,
    schema: 'peercompute.ulg.sph-native-surface-startup-presentation-gate.v0',
    status,
    active: false,
    generation: requestedGeneration,
    reason,
    presentationProofStatus: proofStatus,
    presentationProofWaitStatus: proofWaitStatus,
    presentationSourceCurrent: presentationProof?.sourceCurrent === true,
    startupPresentationAdmitted: admitted,
    startupPresentationProved: foregroundProved,
    livenessFailOpen: !admitted,
    residentPlaybackReleased: true,
    refreshError: error,
    releasedAtMs: normalizedUpdatedAtMs,
    updatedAtMs: normalizedUpdatedAtMs
  });
}

export function resolveSphNativeSurfacePostStepPresentationGateSettlement({
  gate = null,
  generation = null,
  currentGeneration = generation,
  scheduleToken = null,
  currentScheduleToken = scheduleToken,
  presentationAdmitted = null,
  presentationVisible = false,
  presentationProof = null,
  presentationProofWait = null,
  presentationHandoffAdmission = null,
  presentationHandoffWait = null,
  boundedAttemptComplete = false,
  refreshError = null,
  updatedAtMs = null
} = {}) {
  const validIdentityInput = (value) => (
    typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= 0
  );
  const requestedGeneration = generation;
  const activeGeneration = currentGeneration;
  const gateGeneration = gate?.generation;
  const requestedScheduleToken = scheduleToken;
  const activeScheduleToken = currentScheduleToken;
  const gateScheduleToken = gate?.scheduleToken;
  if (
    !gate?.active
    || !validIdentityInput(generation)
    || !validIdentityInput(currentGeneration)
    || !validIdentityInput(gate?.generation)
    || !validIdentityInput(scheduleToken)
    || !validIdentityInput(currentScheduleToken)
    || !validIdentityInput(gate?.scheduleToken)
    || requestedGeneration !== activeGeneration
    || gateGeneration !== requestedGeneration
    || requestedScheduleToken !== activeScheduleToken
    || gateScheduleToken !== requestedScheduleToken
  ) {
    return gate;
  }

  const proofStatus =
    presentationProof?.status
    ?? gate?.proofStatus
    ?? gate?.presentationProofStatus
    ?? null;
  const proofWaitStatus =
    presentationProofWait?.status
    ?? gate?.proofWaitStatus
    ?? gate?.presentationProofWaitStatus
    ?? null;
  const presentationSourceCurrent =
    presentationProof?.sourceCurrent === true;
  const handoffStatus =
    presentationHandoffAdmission?.status
    ?? gate?.handoffStatus
    ?? null;
  const handoffAdmitted = presentationHandoffAdmission == null
    ? (gate?.handoffAdmitted ?? null)
    : presentationHandoffAdmission.admitted === true;
  const handoffWaitStatus =
    presentationHandoffWait?.handoffWaitStatus
    ?? presentationHandoffWait?.status
    ?? gate?.handoffWaitStatus
    ?? null;
  const exactPresentationAdmitted = Boolean(
    handoffAdmitted === true
    && (
      presentationAdmitted == null
        ? presentationProof?.admitted === true
        : presentationAdmitted === true
    )
    && presentationProof?.admitted === true
    && (
      proofStatus === 'native-resident-presentation-submission-admitted'
      || proofStatus === 'native-resident-presentation-foreground-proved'
    )
    && presentationSourceCurrent
  );
  const exactForegroundProved = Boolean(
    exactPresentationAdmitted
    && presentationVisible === true
    && presentationProof?.foregroundProved === true
    && proofStatus === 'native-resident-presentation-foreground-proved'
  );
  const error = typeof refreshError === 'string' && refreshError.trim()
    ? refreshError.trim()
    : null;
  if (
    !exactPresentationAdmitted
    && !error
    && boundedAttemptComplete !== true
  ) {
    return gate;
  }

  const timedOut = Boolean(
    presentationProofWait?.timedOut === true
    || presentationHandoffWait?.timedOut === true
    || proofWaitStatus === 'resident-presentation-proof-wait-timeout'
    || proofStatus === 'resident-presentation-proof-wait-timeout'
  );
  const status = exactPresentationAdmitted
    ? 'native-surface-post-step-presentation-admitted'
    : error
      ? 'native-surface-post-step-presentation-error-fail-open'
      : timedOut
        ? 'native-surface-post-step-presentation-timeout-fail-open'
        : 'native-surface-post-step-presentation-unadmitted-fail-open';
  const reason = exactPresentationAdmitted
    ? (exactForegroundProved
      ? 'the exact current native source was runtime-admitted with foreground pixel proof after the resident batch'
      : 'the exact current native source was runtime-admitted by its ordered GPU submission receipt after the resident batch')
    : error
      ? 'the bounded native presentation refresh failed; resident playback was released to preserve simulation liveness'
      : timedOut
        ? 'the bounded native presentation proof timed out; resident playback was released to preserve simulation liveness'
        : 'the bounded native presentation attempt remained unadmitted; resident playback was released to preserve simulation liveness';
  const normalizedUpdatedAtMs =
    updatedAtMs != null && Number.isFinite(Number(updatedAtMs))
      ? Number(updatedAtMs)
      : null;

  return Object.freeze({
    ...gate,
    schema: 'peercompute.ulg.sph-native-surface-post-step-presentation-gate.v0',
    status,
    active: false,
    generation: requestedGeneration,
    scheduleToken: requestedScheduleToken,
    proofStatus,
    proofWaitStatus,
    presentationProofStatus: proofStatus,
    presentationProofWaitStatus: proofWaitStatus,
    sourceCurrent: presentationSourceCurrent,
    presentationSourceCurrent,
    handoffStatus,
    handoffAdmitted,
    handoffWaitStatus,
    postStepPresentationAdmitted: exactPresentationAdmitted,
    postStepPresentationProved: exactForegroundProved,
    livenessFailOpen: !exactPresentationAdmitted,
    residentPlaybackReleased: true,
    boundedAttemptComplete: true,
    refreshError: error,
    reason,
    releasedAtMs: normalizedUpdatedAtMs,
    updatedAtMs: normalizedUpdatedAtMs
  });
}

export const SPH_REMOTE_RESIDENT_TASK_GRAPH_REFRESH_SCHEMA =
  'peercompute.ulg.sph-demo-remote-resident-task-graph-refresh.v0';
export const SPH_RESIDENT_STAGE_ORDER_TRACE_SCHEMA =
  'peercompute.ulg.sph-demo-resident-stage-order-trace.v0';
export const SPH_PHASE_URL_PARAM_KEYS = Object.freeze([
  'sph',
  'sphPhase',
  'scenario',
  'sceneLengthScale',
  'wallModel',
  'cameraPositionNormalized',
  'cameraTargetNormalized',
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
  'bodies',
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
  'sdt',
  'cfl',
  'cflSafety',
  'avAlpha',
  'diffAlpha',
  'wallAlpha',
  'sep',
  'sepVel',
  'reactionProductReserveMinimumLiveFraction',
  'contactSolver',
  'contactJacobiIterations',
  'contactCleanupPasses',
  'contactInnerRounds',
  'ambientPressurePa',
  'submitBurstSteps',
  'bg',
  'bgimg',
  'lighting',
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
  'workerParticleOverlay',
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
  'schroederSpatialArenaCount',
  'ssArenaCount',
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
  'schroederPhaseVolumeMigration',
  'ssPhaseVolumeMigration',
  'schroederLawQueue',
  'stageMechanicsTrace',
  'schroederLawNeighbors',
  'schroederLawNeighborCandidates',
  'schroederParticleStorageMaterialization',
  'ssParticleStorageMaterialization',
  'schroederTwoLevel',
  'ssTwoLevel',
  'schroederMechanicsFieldPairV2',
  'ssMechanicsFieldPairV2',
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

export function resolveSphRendererSurfaceStartupSelection({
  requestedRendererBackend = null,
  requestedSurfaceDrawMode = null,
  mechanicsMode = 'mlsmpm',
  webGpuAvailable = false
} = {}) {
  const rendererBackendExplicit = requestedRendererBackend != null;
  const surfaceDrawModeExplicit = requestedSurfaceDrawMode != null;
  const normalizedMechanicsMode = String(mechanicsMode || '').trim().toLowerCase();
  const normalizedRequestedSurfaceDrawMode = String(
    requestedSurfaceDrawMode ?? ''
  ).trim().toLowerCase();
  const nativeSurfaceEligible = Boolean(
    webGpuAvailable
    && normalizedMechanicsMode !== 'sph'
  );
  let surfaceDrawMode = normalizeResidentSurfaceDrawDiagnosticMode(
    requestedSurfaceDrawMode,
    'auto'
  );
  if (
    nativeSurfaceEligible
    && (
      normalizedRequestedSurfaceDrawMode === ''
      || normalizedRequestedSurfaceDrawMode === 'auto'
    )
  ) {
    surfaceDrawMode = 'native-webgpu-surface-consumer';
  } else if (normalizedRequestedSurfaceDrawMode === 'three-webgpu-surface-buffers') {
    // The internal Three/WebGPU handoff is non-presenting. Route it to the
    // native consumer only when that consumer is viable; otherwise retain a
    // visible CPU/WebGL surface instead of accepting a known blank mode.
    surfaceDrawMode = nativeSurfaceEligible
      ? 'native-webgpu-surface-consumer'
      : 'auto';
  }

  let rendererBackend = normalizeSphRendererBackend(
    requestedRendererBackend
      ?? (surfaceDrawMode === 'native-webgpu-surface-consumer'
        ? 'native-webgpu'
        : 'webgl')
  );
  let status = 'renderer-surface-startup-compatible';
  let reason = 'renderer backend and surface presentation mode are compatible';

  if (
    normalizedMechanicsMode === 'sph'
    && surfaceDrawMode === 'native-webgpu-surface-consumer'
  ) {
    // The CPU reference carrier never publishes resident native surface
    // buffers. Keeping a native canvas here makes renderer.render() a no-op
    // with no native consumer to replace it.
    rendererBackend = 'webgl';
    surfaceDrawMode = 'auto';
    status = 'renderer-surface-startup-cpu-visible-fallback';
    reason = 'CPU SPH mechanics requires CPU/WebGL surface presentation';
  } else if (surfaceDrawModeExplicit) {
    const requiredRendererBackend =
      surfaceDrawMode === 'native-webgpu-surface-consumer'
        ? 'native-webgpu'
        : 'webgl';
    if (rendererBackend !== requiredRendererBackend) {
      rendererBackend = requiredRendererBackend;
      status = 'renderer-surface-startup-reconciled-to-explicit-surface';
      reason = 'the explicit surface presentation mode determines its compatible renderer backend';
    }
  } else if (rendererBackendExplicit) {
    if (rendererBackend === 'native-webgpu') {
      surfaceDrawMode = 'native-webgpu-surface-consumer';
      status = 'renderer-surface-startup-reconciled-to-explicit-renderer';
      reason = 'the explicit native renderer requires the native surface consumer';
    } else if (surfaceDrawMode === 'native-webgpu-surface-consumer') {
      // Preserve the unset value so the later viewport-specific default can
      // choose points or spheres. Unlike `auto`, both modes continue to
      // consume live resident render rows on a supported compute device.
      surfaceDrawMode = null;
      status = 'renderer-surface-startup-reconciled-to-explicit-renderer';
      reason = 'the explicit non-native renderer requires a Three/WebGL-visible surface mode';
    }
  } else if (surfaceDrawMode !== 'native-webgpu-surface-consumer') {
    // Keep the historical viewport-specific WebGL default when native
    // presentation was not selected.
    surfaceDrawMode = requestedSurfaceDrawMode;
  }

  return Object.freeze({
    status,
    reason,
    rendererBackend,
    surfaceDrawMode,
    rendererBackendExplicit,
    surfaceDrawModeExplicit,
    nativeSurfaceDrawRequested:
      surfaceDrawMode === 'native-webgpu-surface-consumer'
  });
}

export function resolveSphNativeWebGpuStartupPreflight({
  requestedRendererBackend = 'webgl',
  requestedSurfaceDrawMode = 'auto',
  deviceResult = null,
  fallbackSurfaceDrawMode = 'auto'
} = {}) {
  const rendererBackend = normalizeSphRendererBackend(requestedRendererBackend);
  const surfaceDrawMode = normalizeResidentSurfaceDrawDiagnosticMode(
    requestedSurfaceDrawMode,
    'auto'
  );
  const nativeRequested = Boolean(
    rendererBackend === 'native-webgpu'
    || surfaceDrawMode === 'native-webgpu-surface-consumer'
  );
  if (!nativeRequested) {
    return Object.freeze({
      status: 'native-webgpu-startup-preflight-not-requested',
      reason: 'native WebGPU presentation was not selected',
      nativeRequested: false,
      ready: false,
      fallbackApplied: false,
      rendererBackend,
      surfaceDrawMode,
      maxStorageBuffersPerShaderStage: null,
      requiredStorageBuffersPerShaderStage:
        RESIDENT_SPH_STORAGE_BUFFERS_PER_STAGE
    });
  }
  const device = deviceResult?.device || null;
  const maxStorageBuffersPerShaderStage = Number(
    device?.limits?.maxStorageBuffersPerShaderStage
      ?? deviceResult?.adapterLimits?.maxStorageBuffersPerShaderStage
  );
  const storageLimitReady = Boolean(
    Number.isFinite(maxStorageBuffersPerShaderStage)
    && maxStorageBuffersPerShaderStage
      >= RESIDENT_SPH_STORAGE_BUFFERS_PER_STAGE
  );
  const ready = Boolean(device && storageLimitReady);
  const blockedReason = !device
    ? (deviceResult?.reason || 'resident WebGPU device acquisition failed')
    : `resident WebGPU requires ${RESIDENT_SPH_STORAGE_BUFFERS_PER_STAGE} storage buffers per shader stage; device exposes ${maxStorageBuffersPerShaderStage || 0}`;
  return Object.freeze({
    status: ready
      ? 'native-webgpu-startup-preflight-ready'
      : 'native-webgpu-startup-preflight-visible-fallback',
    reason: ready
      ? 'resident WebGPU adapter, device, and shader-stage storage limit are ready'
      : blockedReason,
    nativeRequested: true,
    ready,
    fallbackApplied: !ready,
    rendererBackend: ready ? 'native-webgpu' : 'webgl',
    surfaceDrawMode: ready
      ? 'native-webgpu-surface-consumer'
      : normalizeResidentSurfaceDrawDiagnosticMode(
        fallbackSurfaceDrawMode,
        'auto'
      ),
    maxStorageBuffersPerShaderStage:
      Number.isFinite(maxStorageBuffersPerShaderStage)
        ? maxStorageBuffersPerShaderStage
        : null,
    requiredStorageBuffersPerShaderStage:
      RESIDENT_SPH_STORAGE_BUFFERS_PER_STAGE
  });
}

export function resolveSphResidentParticleBridgeStartupPreflight({
  requestedSurfaceDrawMode = 'auto',
  deviceResult = null,
  fallbackSurfaceDrawMode = 'auto'
} = {}) {
  const surfaceDrawMode = normalizeResidentSurfaceDrawDiagnosticMode(
    requestedSurfaceDrawMode,
    'auto'
  );
  const bridgeRequested = residentSurfaceDrawModeUsesParticleBridge(
    surfaceDrawMode
  );
  if (!bridgeRequested) {
    return Object.freeze({
      status: 'resident-particle-bridge-startup-preflight-not-requested',
      reason: 'a resident render-row particle bridge was not selected',
      bridgeRequested: false,
      ready: false,
      fallbackApplied: false,
      surfaceDrawMode,
      maxStorageBuffersPerShaderStage: null,
      requiredStorageBuffersPerShaderStage:
        RESIDENT_SPH_STORAGE_BUFFERS_PER_STAGE
    });
  }
  const device = deviceResult?.device || null;
  const maxStorageBuffersPerShaderStage = Number(
    device?.limits?.maxStorageBuffersPerShaderStage
      ?? deviceResult?.adapterLimits?.maxStorageBuffersPerShaderStage
  );
  const ready = Boolean(
    device
    && Number.isFinite(maxStorageBuffersPerShaderStage)
    && maxStorageBuffersPerShaderStage
      >= RESIDENT_SPH_STORAGE_BUFFERS_PER_STAGE
  );
  return Object.freeze({
    status: ready
      ? 'resident-particle-bridge-startup-preflight-ready'
      : 'resident-particle-bridge-startup-preflight-visible-fallback',
    reason: ready
      ? 'resident WebGPU device is ready for the render-row particle bridge'
      : (deviceResult?.reason
        || `resident WebGPU requires ${RESIDENT_SPH_STORAGE_BUFFERS_PER_STAGE} storage buffers per shader stage; device exposes ${maxStorageBuffersPerShaderStage || 0}`),
    bridgeRequested: true,
    ready,
    fallbackApplied: !ready,
    surfaceDrawMode: ready
      ? surfaceDrawMode
      : normalizeResidentSurfaceDrawDiagnosticMode(
        fallbackSurfaceDrawMode,
        'auto'
      ),
    maxStorageBuffersPerShaderStage:
      Number.isFinite(maxStorageBuffersPerShaderStage)
        ? maxStorageBuffersPerShaderStage
        : null,
    requiredStorageBuffersPerShaderStage:
      RESIDENT_SPH_STORAGE_BUFFERS_PER_STAGE
  });
}

/**
 * The interactive simulation has no inline/main-thread degradation mode.
 * This is deliberately separate from presentation-mode selection: a visible
 * WebGL shell is not evidence that the worker-backed WebGPU simulation can
 * safely run.
 */
export function resolveSphSimulationRuntimePrerequisite({
  workersEnabled = true,
  workerConstructorAvailable = typeof globalThis.Worker === 'function',
  deviceResult = null
} = {}) {
  const webGpuDeviceReady = Boolean(deviceResult?.device);
  let status = 'sph-simulation-runtime-prerequisite-ready';
  let reason = 'WebGPU device acquisition and browser worker availability are ready';
  if (workersEnabled !== true) {
    status = 'blocked-sph-simulation-workers-disabled';
    reason = 'residentWorkers=0 explicitly disables the required browser worker pool';
  } else if (!workerConstructorAvailable) {
    status = 'blocked-sph-simulation-worker-constructor-unavailable';
    reason = 'the browser Worker constructor is unavailable';
  } else if (!webGpuDeviceReady) {
    status = 'blocked-sph-simulation-webgpu-unavailable';
    reason = deviceResult?.reason || 'resident WebGPU device acquisition failed';
  }
  return Object.freeze({
    schema: SPH_SIMULATION_RUNTIME_PREREQUISITE_SCHEMA,
    status,
    ready: status === 'sph-simulation-runtime-prerequisite-ready',
    reason,
    workersEnabled: workersEnabled === true,
    workerConstructorAvailable: workerConstructorAvailable === true,
    webGpuDeviceReady,
    webGpuStatus: deviceResult?.status || null,
    webGpuRequiredLimits: deviceResult?.requiredLimits || null,
    webGpuAdapterLimits: deviceResult?.adapterLimits || null
  });
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

export function residentSurfaceDrawInitialVisualRefreshPlan(mode) {
  const particleRenderMode = residentSurfaceDrawParticleRenderMode(mode);
  const nativeSurfaceConsumerRefresh = residentSurfaceDrawModeUsesNativeSurfaceConsumer(mode);
  return {
    required: particleRenderMode != null || nativeSurfaceConsumerRefresh,
    particleRenderMode,
    nativeSurfaceConsumerRefresh
  };
}

export function resolveSphInitialPresentationSchedulePlan({
  surfaceDrawMode = 'auto',
  residentAutoEnabled = true
} = {}) {
  const visualRefresh = residentSurfaceDrawInitialVisualRefreshPlan(surfaceDrawMode);
  const scheduleResidentPhysics = Boolean(residentAutoEnabled);
  return Object.freeze({
    ...visualRefresh,
    residentAutoEnabled: scheduleResidentPhysics,
    scheduleResidentPhysics,
    residentPhysicsOrder:
      scheduleResidentPhysics && visualRefresh.required
        ? 'after-initial-visual-presentation'
        : (scheduleResidentPhysics ? 'after-upload-prerequisites' : 'disabled')
  });
}

// A native surface cannot become active until its first exact presentation
// admission has settled. During that bootstrap window, replacing the active
// candidate on every resident playback batch invalidates its publication
// authority faster than admission can finish, leaving only the deliberately
// non-physical control-envelope preview on screen. Once a native surface has
// committed, the scene's temporal-retention policy safely handles successor
// candidates; coalescing is therefore limited to the first publication.
export function resolveSphNativeSurfaceStartupRefreshCoalescing({
  nativeSurfaceConsumerRefresh = false,
  surfaceDraw = null,
  validationScheduler = null
} = {}) {
  const activeCandidateCount = Math.max(0, Math.round(Number(
    validationScheduler?.activeCount
  ) || 0));
  const queuedCandidateCount = Math.max(0, Math.round(Number(
    validationScheduler?.queuedCount
  ) || 0));
  const publishedCandidateCount = Math.max(0, Math.round(Number(
    validationScheduler?.published
  ) || 0));
  const nativePresentationCommitted = Boolean(
    publishedCandidateCount > 0
    || (
      surfaceDraw?.visibleRendererBridge === 'native-webgpu-surface-consumer'
      && surfaceDraw?.surfaceDrawVisibleGpuConsumerReady === true
      && surfaceDraw
        ?.surfaceDrawVisibleGpuConsumerRuntimePresentationAdmitted === true
    )
  );
  const validationInFlight = activeCandidateCount > 0 || queuedCandidateCount > 0;
  const deferRefresh = Boolean(
    nativeSurfaceConsumerRefresh
    && !nativePresentationCommitted
    && validationInFlight
  );
  return Object.freeze({
    schema: 'peercompute.ulg.sph-native-surface-startup-refresh-coalescing.v0',
    status: deferRefresh
      ? 'native-surface-first-publication-coalesced'
      : (nativeSurfaceConsumerRefresh
        ? 'native-surface-startup-refresh-ready'
        : 'native-surface-startup-refresh-not-requested'),
    deferRefresh,
    nativeSurfaceConsumerRefresh: Boolean(nativeSurfaceConsumerRefresh),
    nativePresentationCommitted,
    validationInFlight,
    activeCandidateCount,
    queuedCandidateCount,
    publishedCandidateCount,
    reason: deferRefresh
      ? 'the first native surface candidate remains authoritative until presentation admission publishes it'
      : (nativeSurfaceConsumerRefresh
        ? 'no uncommitted native surface validation is in flight'
        : 'the selected presentation mode is not the native WebGPU surface consumer')
  });
}

export function createSphPendingBodyEnvelopePreview({
  initialBodies,
  boxDimsM,
  reason = 'material-closure-pending',
  generation = null,
  previewSerial = null
} = {}) {
  const normalizedBodies = normalizeSphInitialBodies(initialBodies);
  const preflight = preflightSphInitialBodiesForSimulation(normalizedBodies);
  if (!preflight.feasible) {
    throw new RangeError(
      `Initial-body envelope preview preflight blocked: ${preflight.blockers.join(', ')}`
    );
  }
  if (!Array.isArray(boxDimsM) || boxDimsM.length !== 3) {
    throw new TypeError('boxDimsM must contain exactly three positive dimensions');
  }
  const dimensionsM = boxDimsM.map((value, axis) => {
    const dimensionM = Number(value);
    if (!Number.isFinite(dimensionM) || dimensionM <= 0) {
      throw new RangeError(`boxDimsM[${axis}] must be a positive finite number`);
    }
    return dimensionM;
  });
  const toleranceM = Math.max(1e-9, Math.max(...dimensionsM) * 1e-9);
  const bodies = normalizedBodies.bodies.map((body, bodyOrder) => {
    const minM = body.centerM.map((center, axis) => center - body.sizeM[axis] / 2);
    const maxM = body.centerM.map((center, axis) => center + body.sizeM[axis] / 2);
    for (let axis = 0; axis < 3; axis += 1) {
      if (minM[axis] < -toleranceM || maxM[axis] > dimensionsM[axis] + toleranceM) {
        throw new RangeError(
          `Initial body '${body.id}' preview envelope is outside container axis ${axis}`
        );
      }
    }
    return Object.freeze({
      bodyOrder,
      id: body.id,
      domainId: body.domainId,
      material: body.material,
      centerM: Object.freeze([...body.centerM]),
      sizeM: Object.freeze([...body.sizeM]),
      minM: Object.freeze(minM),
      maxM: Object.freeze(maxM),
      particlesPerEdge: Object.freeze([...body.particlesPerEdge])
    });
  });
  return Object.freeze({
    schema: SPH_PENDING_BODY_ENVELOPE_PREVIEW_SCHEMA,
    status: 'physics-pending-control-envelope-preview',
    reason,
    generation:
      generation != null && Number.isSafeInteger(Number(generation))
        ? Number(generation)
        : null,
    previewSerial:
      previewSerial != null && Number.isSafeInteger(Number(previewSerial))
        ? Number(previewSerial)
        : null,
    source: 'validated-initial-body-controls',
    label: 'physics pending',
    description: 'control-body envelope preview — not simulation output',
    presentationOnly: true,
    authoritativePhysicsState: false,
    physicsStateCurrent: false,
    boxDimsM: Object.freeze(dimensionsM),
    bodyCount: bodies.length,
    bodies: Object.freeze(bodies),
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  });
}

export function resolveSphResidentPresentationProof({
  renderState = null,
  surfaceDraw = null,
  requireCurrentSource = false
} = {}) {
  if (!renderState?.schema) {
    return {
      visible: false,
      admitted: false,
      foregroundProved: false,
      status: 'resident-presentation-proof-missing-render-state'
    };
  }
  const bridge = surfaceDraw?.visibleRendererBridge
    || renderState.surfaceDrawVisibleRendererBridge
    || null;
  const exactNonNegativeInteger = (value) => (
    typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= 0
      ? value
      : null
  );
  if (bridge === 'native-webgpu-surface-consumer') {
    const activeGeneration = exactNonNegativeInteger(
      surfaceDraw
        ?.surfaceDrawVisibleGpuConsumerNativeActiveResourceGeneration
      ?? renderState.surfaceDrawVisibleGpuConsumerNativeActiveResourceGeneration
      ?? surfaceDraw?.renderBridgeNativeSurfaceResourceGeneration
      ?? renderState.surfaceDrawRenderBridgeNativeSurfaceResourceGeneration
    );
    const offscreenValidatedGeneration = exactNonNegativeInteger(
      surfaceDraw
        ?.surfaceDrawVisibleGpuConsumerNativeOffscreenValidationResourceGeneration
      ?? renderState
        .surfaceDrawVisibleGpuConsumerNativeOffscreenValidationResourceGeneration
      ?? surfaceDraw?.renderBridgeOffscreenValidationResourceGeneration
      ?? renderState.surfaceDrawRenderBridgeOffscreenValidationResourceGeneration
    );
    const candidateForegroundResourceGeneration = exactNonNegativeInteger(
      surfaceDraw
        ?.surfaceDrawVisibleGpuConsumerNativeCandidateForegroundResourceGeneration
      ?? renderState
        .surfaceDrawVisibleGpuConsumerNativeCandidateForegroundResourceGeneration
    );
    const offscreenForegroundClaimed = (
      surfaceDraw?.surfaceDrawVisibleGpuConsumerOffscreenForegroundValidated
      ?? renderState.surfaceDrawVisibleGpuConsumerOffscreenForegroundValidated
    ) === true;
    const browserFrameForegroundClaimed = (
      surfaceDraw?.surfaceDrawVisibleGpuConsumerBrowserFrameForegroundValidated
      ?? renderState.surfaceDrawVisibleGpuConsumerBrowserFrameForegroundValidated
    ) === true;
    const genericForegroundProofEvidence = surfaceDraw
      ?.surfaceDrawVisibleGpuConsumerForegroundProofValidated
      ?? renderState.surfaceDrawVisibleGpuConsumerForegroundProofValidated
      ?? null;
    const sameQueueStructuralSubmissionClaimed = (
      surfaceDraw
        ?.surfaceDrawVisibleGpuConsumerSameQueueStructuralSubmissionAdmitted
      ?? renderState
        .surfaceDrawVisibleGpuConsumerSameQueueStructuralSubmissionAdmitted
    ) === true;
    const genericPresentationAdmissionEvidence = surfaceDraw
      ?.surfaceDrawVisibleGpuConsumerRuntimePresentationAdmitted
      ?? renderState.surfaceDrawVisibleGpuConsumerRuntimePresentationAdmitted
      ?? null;
    const candidateForegroundProofKind = surfaceDraw
      ?.surfaceDrawVisibleGpuConsumerNativeCandidateForegroundProofKind
      ?? renderState.surfaceDrawVisibleGpuConsumerNativeCandidateForegroundProofKind
      ?? null;
    const candidateForegroundValidationStatus = surfaceDraw
      ?.surfaceDrawVisibleGpuConsumerNativeCandidateForegroundValidationStatus
      ?? renderState
        .surfaceDrawVisibleGpuConsumerNativeCandidateForegroundValidationStatus
      ?? null;
    const candidateForegroundSameQueueSubmissionBoundary = surfaceDraw
      ?.surfaceDrawVisibleGpuConsumerNativeCandidateForegroundSameQueueSubmissionBoundary
      ?? renderState
        .surfaceDrawVisibleGpuConsumerNativeCandidateForegroundSameQueueSubmissionBoundary
      ?? null;
    const candidateForegroundSubmittedDrawCount = exactNonNegativeInteger(
      surfaceDraw
        ?.surfaceDrawVisibleGpuConsumerNativeCandidateForegroundSubmittedDrawCount
      ?? renderState
        .surfaceDrawVisibleGpuConsumerNativeCandidateForegroundSubmittedDrawCount
    ) ?? 0;
    const offscreenValidationStatus = surfaceDraw
      ?.surfaceDrawVisibleGpuConsumerNativeOffscreenValidationStatus
      ?? renderState.surfaceDrawVisibleGpuConsumerNativeOffscreenValidationStatus
      ?? null;
    const offscreenValidationNonzeroPixelCount = exactNonNegativeInteger(
      surfaceDraw
        ?.surfaceDrawVisibleGpuConsumerNativeOffscreenValidationNonzeroPixelCount
      ?? renderState
        .surfaceDrawVisibleGpuConsumerNativeOffscreenValidationNonzeroPixelCount
    ) ?? 0;
    const pixelValidationStatus = surfaceDraw
      ?.surfaceDrawVisibleGpuConsumerPixelValidationStatus
      ?? renderState.surfaceDrawVisibleGpuConsumerPixelValidationStatus
      ?? null;
    const pixelValidationSource = surfaceDraw
      ?.surfaceDrawVisibleGpuConsumerNativePixelValidationSource
      ?? renderState.surfaceDrawVisibleGpuConsumerNativePixelValidationSource
      ?? null;
    const pixelValidationNonzeroPixelCount = exactNonNegativeInteger(
      surfaceDraw
        ?.surfaceDrawVisibleGpuConsumerNativePixelValidationNonzeroPixelCount
      ?? renderState
        .surfaceDrawVisibleGpuConsumerNativePixelValidationNonzeroPixelCount
    ) ?? 0;
    const pixelValidatedGeneration = exactNonNegativeInteger(
      surfaceDraw
        ?.surfaceDrawVisibleGpuConsumerNativePixelValidationResourceGeneration
      ?? renderState
        .surfaceDrawVisibleGpuConsumerNativePixelValidationResourceGeneration
    );
    const structuralGenerationMatched = Boolean(
      activeGeneration != null
      && candidateForegroundResourceGeneration === activeGeneration
    );
    const sameQueueStructuralSubmissionAdmitted = Boolean(
      sameQueueStructuralSubmissionClaimed
      && candidateForegroundValidationStatus === 'passed'
      && candidateForegroundProofKind
        === 'same-queue-private-staged-composite-submission'
      && candidateForegroundSameQueueSubmissionBoundary === true
      && candidateForegroundSubmittedDrawCount > 0
      && structuralGenerationMatched
    );
    const offscreenForegroundValidated = Boolean(
      offscreenForegroundClaimed
      && offscreenValidationStatus === 'passed'
      && offscreenValidationNonzeroPixelCount > 0
      && activeGeneration != null
      && offscreenValidatedGeneration === activeGeneration
    );
    const browserFrameForegroundValidated = Boolean(
      browserFrameForegroundClaimed
      && pixelValidationStatus === 'passed'
      && /browser-frame|playwright.*compositor|composited-frame/i.test(
        String(pixelValidationSource || '')
      )
      && pixelValidationNonzeroPixelCount > 0
      && activeGeneration != null
      && pixelValidatedGeneration === activeGeneration
    );
    const foregroundEvidenceClaimed = genericForegroundProofEvidence == null
      ? offscreenForegroundClaimed || browserFrameForegroundClaimed
      : genericForegroundProofEvidence === true;
    const foregroundProofValidated = Boolean(
      foregroundEvidenceClaimed
      && (offscreenForegroundValidated || browserFrameForegroundValidated)
    );
    const exactAdmissionEvidence = Boolean(
      sameQueueStructuralSubmissionAdmitted
      || foregroundProofValidated
    );
    const presentationAdmissionValidated = Boolean(
      exactAdmissionEvidence
      && (
        genericPresentationAdmissionEvidence == null
        || genericPresentationAdmissionEvidence === true
      )
    );
    const foregroundValidatedGeneration = offscreenForegroundValidated
      ? offscreenValidatedGeneration
      : browserFrameForegroundValidated
        ? pixelValidatedGeneration
        : null;
    const validatedGeneration = sameQueueStructuralSubmissionAdmitted
      ? candidateForegroundResourceGeneration
      : foregroundValidatedGeneration;
    const ready = (
      surfaceDraw?.surfaceDrawVisibleGpuConsumerReady
      ?? renderState.surfaceDrawVisibleGpuConsumerReady
    ) === true;
    const lastRenderStatus = surfaceDraw?.renderBridgeLastRenderStatus
      ?? renderState.surfaceDrawRenderBridgeLastRenderStatus
      ?? null;
    const frameCount = exactNonNegativeInteger(
      surfaceDraw?.renderBridgeFrameCount
      ?? renderState.surfaceDrawRenderBridgeFrameCount
    ) ?? 0;
    const submittedDrawCount = exactNonNegativeInteger(
      surfaceDraw?.renderBridgeLastSubmittedDrawCount
      ?? renderState.surfaceDrawRenderBridgeLastSubmittedDrawCount
    ) ?? 0;
    const debugMode = surfaceDraw?.renderBridgeNativeSurfaceDebugMode
      ?? renderState.surfaceDrawRenderBridgeNativeSurfaceDebugMode
      ?? 'none';
    const generationMatched = Boolean(
      exactNonNegativeInteger(activeGeneration) != null
      && exactNonNegativeInteger(validatedGeneration) != null
      && activeGeneration === validatedGeneration
    );
    // A resident batch temporarily owns the shared WebGPU queue.  During that
    // window the native consumer deliberately skips a redundant redraw, but
    // keeps the already admitted resource alive. That is a retained committed
    // presentation, not a new claim that compositor pixels were observed.
    const retainedPresentationWhileResidentGpuWorkInFlight =
      lastRenderStatus === 'resident-surface-draw-skipped-resident-gpu-work-in-flight';
    // A staged candidate is rendered once into its private, candidate-local
    // composite, admitted by either diagnostic private-pixel evidence or the
    // default same-queue structural receipt, then published through a texture
    // copy. Its canvas submission intentionally has no geometry calls.
    const stagedPresentationStatus = surfaceDraw
      ?.renderBridgeNativeSurfaceCandidateStagedPresentationStatus
      ?? renderState.surfaceDrawRenderBridgeNativeSurfaceCandidateStagedPresentationStatus
      ?? null;
    const stagedPresentationCopyCount =
      surfaceDraw?.renderBridgeNativeSurfaceCandidatePresentationCopyCount
      ?? renderState.surfaceDrawRenderBridgeNativeSurfaceCandidatePresentationCopyCount
      ?? null;
    const stagedPresentationPostAdmissionGeometrySubmitCount =
      surfaceDraw
        ?.renderBridgeNativeSurfaceCandidatePresentationPostAdmissionGeometrySubmitCount
      ?? renderState
        .surfaceDrawRenderBridgeNativeSurfaceCandidatePresentationPostAdmissionGeometrySubmitCount
      ?? null;
    const stagedCopyOnlyPresentation = Boolean(
      lastRenderStatus
        === 'native-webgpu-surface-consumer-candidate-staged-composite-presented'
      && stagedPresentationStatus
        === 'candidate-staged-presentation-canvas-copy-submitted'
      && exactNonNegativeInteger(stagedPresentationCopyCount) != null
      && stagedPresentationCopyCount > 0
      && exactNonNegativeInteger(
        stagedPresentationPostAdmissionGeometrySubmitCount
      ) != null
      && stagedPresentationPostAdmissionGeometrySubmitCount === 0
    );
    const sourceGenerationMatchesCurrent = surfaceDraw
      ?.sourceResidentExecutionGenerationMatchesCurrent
      ?? renderState.surfaceDrawSourceResidentExecutionGenerationMatchesCurrent
      ?? renderState.sourceResidentExecutionGenerationMatchesCurrent
      ?? null;
    const sourceRetainedPrevious = Boolean(
      surfaceDraw?.sourceResidentRetainedPrevious
      ?? renderState.surfaceDrawSourceResidentRetainedPrevious
      ?? renderState.sourceResidentRetainedPrevious
      ?? false
    );
    const sourceMarkedStale = Boolean(
      surfaceDraw?.residentRenderSourceStaleAfterPublish
      ?? renderState.residentRenderSourceStaleAfterPublish
      ?? false
    );
    const sourceCurrent = Boolean(
      sourceGenerationMatchesCurrent === true
      && !sourceRetainedPrevious
      && !sourceMarkedStale
    );
    const presentationCommitted = Boolean(
      ready
      && presentationAdmissionValidated
      && generationMatched
      && (
        lastRenderStatus === 'native-webgpu-surface-consumer-rendered'
        || retainedPresentationWhileResidentGpuWorkInFlight
        || stagedCopyOnlyPresentation
      )
      && frameCount > 0
      && submittedDrawCount > 0
      && debugMode !== 'clear-only'
    );
    const admitted = Boolean(
      presentationCommitted
      && (!requireCurrentSource || sourceCurrent)
    );
    const foregroundProved = Boolean(admitted && foregroundProofValidated);
    return {
      visible: foregroundProved,
      admitted,
      foregroundProved,
      status: foregroundProved
        ? 'native-resident-presentation-foreground-proved'
        : admitted
          ? 'native-resident-presentation-submission-admitted'
          : (requireCurrentSource && presentationCommitted && !sourceCurrent)
            ? 'native-resident-presentation-stale-source'
            : 'native-resident-presentation-unadmitted',
      bridge,
      ready,
      presentationAdmissionValidated,
      foregroundProofValidated,
      sameQueueStructuralSubmissionAdmitted,
      sameQueueForegroundSubmissionValidated: false,
      offscreenForegroundValidated,
      browserFrameForegroundValidated,
      activeGeneration,
      validatedGeneration,
      foregroundValidatedGeneration,
      offscreenValidatedGeneration,
      pixelValidatedGeneration,
      candidateForegroundValidationStatus,
      candidateForegroundProofKind,
      candidateForegroundSameQueueSubmissionBoundary,
      candidateForegroundSubmittedDrawCount,
      candidateForegroundResourceGeneration,
      structuralGenerationMatched,
      offscreenValidationStatus,
      offscreenValidationNonzeroPixelCount,
      pixelValidationStatus,
      pixelValidationSource,
      pixelValidationNonzeroPixelCount,
      generationMatched,
      lastRenderStatus,
      frameCount,
      submittedDrawCount,
      debugMode,
      retainedPresentationWhileResidentGpuWorkInFlight,
      presentationCommitted,
      stagedCopyOnlyPresentation,
      stagedPresentationStatus,
      stagedPresentationCopyCount,
      stagedPresentationPostAdmissionGeometrySubmitCount,
      requireCurrentSource: Boolean(requireCurrentSource),
      sourceGenerationMatchesCurrent,
      sourceRetainedPrevious,
      sourceMarkedStale,
      sourceCurrent
    };
  }
  if (
    bridge === 'three-render-row-points'
    || bridge === 'three-render-row-spheres'
  ) {
    const meshCount = Math.max(0, Math.round(Number(
      surfaceDraw?.renderBridgeThreeMeshCount
      ?? renderState.surfaceDrawRenderBridgeThreeMeshCount
    ) || 0));
    const geometryByteLength = Math.max(0, Math.round(Number(
      surfaceDraw?.renderBridgeThreeGeometryByteLength
      ?? renderState.surfaceDrawRenderBridgeThreeGeometryByteLength
    ) || 0));
    const visible = meshCount > 0 && geometryByteLength > 0;
    return {
      visible,
      admitted: visible,
      foregroundProved: false,
      status: visible
        ? 'three-resident-presentation-geometry-ready'
        : 'three-resident-presentation-geometry-missing',
      bridge,
      meshCount,
      geometryByteLength
    };
  }
  const visible = Boolean(
    (bridge === 'webgpu-render-row-points' || bridge === 'webgpu-render-row-spheres')
    && Math.max(0, Math.round(Number(surfaceDraw?.renderBridgeFrameCount) || 0)) > 0
  );
  return {
    visible,
    admitted: visible,
    foregroundProved: false,
    status: visible
      ? 'webgpu-overlay-resident-presentation-frame-ready'
      : 'resident-presentation-proof-missing-visible-bridge',
    bridge
  };
}

/**
 * Decide whether the mounted native surface needs an immediate recovery
 * refresh, independently from the exact-current-source admission proof for a
 * newly staged candidate.
 *
 * A resident physics publish deliberately marks the last admitted display
 * source as retained/stale while preserving its already runtime-admitted
 * texture submission. That remains a healthy display during the normal bounded cadence:
 * it is not permission to admit a new stale candidate.  Every actual native
 * refresh still re-reads live state with requireCurrentSource=true after its
 * private candidate completion handoff before playback may continue.
 */
export function resolveSphNativeSurfaceCadenceRefreshPolicy({
  nativeSurfaceConsumerRefresh = false,
  renderState = null,
  surfaceDraw = null
} = {}) {
  if (!nativeSurfaceConsumerRefresh) {
    return Object.freeze({
      schema: 'peercompute.ulg.sph-native-surface-cadence-refresh-policy.v0',
      status: 'native-surface-cadence-policy-not-requested',
      nativeSurfaceConsumerRefresh: false,
      presentationVisible: false,
      presentationAdmitted: false,
      presentationForegroundProved: false,
      currentSourceForAdmission: false,
      forceDue: false,
      deferToCadence: false,
      displayProofStatus: null,
      displayProof: null,
      reason: 'the selected presentation mode is not the native WebGPU surface consumer'
    });
  }

  // Do not use requireCurrentSource here.  This asks only whether the already
  // admitted texture submission is safe to retain until the next normal cadence
  // point; current-source exactness is checked again at candidate admission.
  const displayProof = resolveSphResidentPresentationProof({
    renderState,
    surfaceDraw,
    requireCurrentSource: false
  });
  const presentationVisible = displayProof.visible === true;
  const presentationAdmitted = displayProof.admitted === true;
  const presentationForegroundProved = displayProof.foregroundProved === true;
  const currentSourceForAdmission = displayProof.sourceCurrent === true;
  const forceDue = !presentationAdmitted;
  return Object.freeze({
    schema: 'peercompute.ulg.sph-native-surface-cadence-refresh-policy.v0',
    status: forceDue
      ? 'native-surface-presentation-admission-recovery-required'
      : 'native-surface-admitted-presentation-cadence-deferred',
    nativeSurfaceConsumerRefresh: true,
    presentationVisible,
    presentationAdmitted,
    presentationForegroundProved,
    currentSourceForAdmission,
    forceDue,
    deferToCadence: !forceDue,
    displayProofStatus: displayProof.status,
    displayProof: Object.freeze({ ...displayProof }),
    reason: forceDue
      ? 'no native surface submission is currently admitted, so recovery cannot wait for cadence'
      : (currentSourceForAdmission
        ? 'the current runtime-admitted source may wait for the normal cadence'
        : 'a previously runtime-admitted retained source may remain presented until the next normal cadence; new candidate admission still requires an exact current source')
  });
}

function nativeSurfaceCandidateCompletionHandoffExactInteger(value) {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= 0
    ? value
    : null;
}

/**
 * Select the only request which may admit a native presentation handoff for a
 * particular resident execution. A retained visible surface can legitimately
 * still name request N after the scheduler has published N + 1 for that same
 * exact source; recovery must not let the retained draw hide the newer
 * receipt. Conversely, scheduler counters alone are never enough authority
 * to cross an execution/signature boundary.
 */
export function resolveSphNativeSurfaceCandidateCompletionRequestSelection({
  surfaceRequest = null,
  scheduler = null,
  execution = null,
  allowSurfaceDrawRequestFallback = true
} = {}) {
  const expectedResidentExecutionGeneration =
    nativeSurfaceCandidateCompletionHandoffExactInteger(
      execution?.residentExecutionGeneration
      ?? execution?.finalStep?.residentExecutionGeneration
    );
  const expectedResidentStepsSignature = execution?.signature ?? null;
  const expectedResidentStepSignature = execution?.finalStep?.signature ?? null;
  const latestToken = nativeSurfaceCandidateCompletionHandoffExactInteger(
    scheduler?.latestToken
  );
  const latestCandidateRequestToken =
    nativeSurfaceCandidateCompletionHandoffExactInteger(
      scheduler?.latestCandidateRequestToken
    );
  const latestCandidateGeneration =
    nativeSurfaceCandidateCompletionHandoffExactInteger(
      scheduler?.latestCandidateGeneration
    );
  const lifecycleGeneration = nativeSurfaceCandidateCompletionHandoffExactInteger(
    scheduler?.lifecycleGeneration
  );
  const latestCandidateLifecycleGeneration =
    nativeSurfaceCandidateCompletionHandoffExactInteger(
      scheduler?.latestCandidateLifecycleGeneration
    );
  const schedulerIdentityMatches = Boolean(
    latestToken != null
    && latestCandidateRequestToken != null
    && latestCandidateGeneration != null
    && lifecycleGeneration != null
    && latestCandidateLifecycleGeneration != null
    && latestCandidateRequestToken === latestToken
    && latestCandidateLifecycleGeneration === lifecycleGeneration
  );
  const schedulerExactCurrentSource = Boolean(
    scheduler?.latestCandidateSourceResidentExecutionGenerationMatchesCurrent
      === true
    && expectedResidentExecutionGeneration != null
    && expectedResidentStepsSignature != null
    && expectedResidentStepSignature != null
    && scheduler?.latestCandidateSourceResidentExecutionGeneration
      === expectedResidentExecutionGeneration
    && scheduler?.latestCandidateSourceResidentStepsSignature
      === expectedResidentStepsSignature
    && scheduler?.latestCandidateSourceResidentStepSignature
      === expectedResidentStepSignature
  );
  const schedulerExactCurrent = Boolean(
    schedulerIdentityMatches && schedulerExactCurrentSource
  );
  const request = schedulerExactCurrent
    ? Object.freeze({
      schema: scheduler?.schema
        || 'peercompute.ulg.sph-native-surface-candidate-validation-request.v0',
      status: scheduler?.status ?? null,
      token: latestToken,
      lifecycleGeneration,
      candidateGeneration: latestCandidateGeneration
    })
    : (allowSurfaceDrawRequestFallback ? surfaceRequest : null);
  return Object.freeze({
    schema: 'peercompute.ulg.sph-native-surface-candidate-completion-request-selection.v0',
    status: schedulerExactCurrent
      ? 'native-surface-candidate-completion-request-scheduler-exact-current'
      : (request
        ? 'native-surface-candidate-completion-request-surface-fallback'
        : 'native-surface-candidate-completion-request-unavailable'),
    request,
    selectedSchedulerLatest: schedulerExactCurrent,
    usedSurfaceDrawRequestFallback:
      !schedulerExactCurrent && request != null,
    schedulerIdentityMatches,
    schedulerExactCurrentSource,
    expectedResidentExecutionGeneration,
    expectedResidentStepsSignature,
    expectedResidentStepSignature,
    latestToken,
    latestCandidateRequestToken,
    latestCandidateGeneration,
    lifecycleGeneration,
    latestCandidateLifecycleGeneration
  });
}

/**
 * Admit a settled scene-private candidate completion receipt for the mounted
 * scheduler.  This is intentionally not a presentation proof: callers must
 * still re-read the live render state and run resolveSphResidentPresentationProof
 * with requireCurrentSource=true before physics may continue.
 */
export function resolveSphNativeSurfaceCandidateCompletionHandoff({
  handoff = null,
  expectedRequestToken = null,
  expectedLifecycleGeneration = null,
  expectedCandidateGeneration = null,
  expectedResidentExecutionGeneration = null,
  expectedResidentStepsSignature = null,
  expectedResidentStepSignature = null
} = {}) {
  const requestToken = nativeSurfaceCandidateCompletionHandoffExactInteger(
    handoff?.requestToken
  );
  const lifecycleGeneration = nativeSurfaceCandidateCompletionHandoffExactInteger(
    handoff?.lifecycleGeneration
  );
  const candidateGeneration = nativeSurfaceCandidateCompletionHandoffExactInteger(
    handoff?.candidateGeneration
  );
  const expectedRequest = nativeSurfaceCandidateCompletionHandoffExactInteger(
    expectedRequestToken
  );
  const expectedLifecycle = nativeSurfaceCandidateCompletionHandoffExactInteger(
    expectedLifecycleGeneration
  );
  const expectedCandidate = nativeSurfaceCandidateCompletionHandoffExactInteger(
    expectedCandidateGeneration
  );
  const expectedSourceGeneration = nativeSurfaceCandidateCompletionHandoffExactInteger(
    expectedResidentExecutionGeneration
  );
  const exactReceipt = Boolean(
    handoff?.schema
      === 'peercompute.ulg.sph-native-surface-candidate-completion-handoff.v0'
    && requestToken != null
    && lifecycleGeneration != null
    && candidateGeneration != null
  );
  const requestMatches = exactReceipt
    && expectedRequest != null
    && requestToken === expectedRequest;
  const lifecycleMatches = exactReceipt
    && expectedLifecycle != null
    && lifecycleGeneration === expectedLifecycle;
  const candidateMatches = exactReceipt
    && expectedCandidate != null
    && candidateGeneration === expectedCandidate;
  const sourceExecutionGenerationMatches = exactReceipt
    && expectedSourceGeneration != null
    && handoff?.sourceResidentExecutionGeneration === expectedSourceGeneration;
  const sourceStepsSignatureMatches = exactReceipt
    && expectedResidentStepsSignature != null
    && handoff?.sourceResidentStepsSignature === expectedResidentStepsSignature;
  const sourceStepSignatureMatches = exactReceipt
    && expectedResidentStepSignature != null
    && handoff?.sourceResidentStepSignature === expectedResidentStepSignature;
  const sourceWasCurrent = handoff?.sourceResidentExecutionGenerationMatchesCurrent === true;
  const published = handoff?.status === 'published' && handoff?.published === true;
  // Scene-side publication already verifies the retained step/signature
  // identities immediately before its irreversible submit. The mounted
  // continuation can reliably carry the numeric execution generation across
  // its public envelope, but not necessarily the same signature object
  // identity. Keep the signature comparisons as diagnostics; the final live
  // current-source presentation admission below remains the second required gate.
  const accepted = Boolean(
    requestMatches
    && lifecycleMatches
    && candidateMatches
    && sourceExecutionGenerationMatches
    && sourceWasCurrent
    && published
  );
  let status = 'native-surface-candidate-completion-handoff-admitted';
  if (
    !handoff
    || handoff?.handoffWaitStatus === 'unavailable'
  ) {
    status = 'native-surface-candidate-completion-handoff-unavailable';
  } else if (handoff?.handoffWaitStatus === 'timeout') {
    status = 'native-surface-candidate-completion-handoff-timeout';
  } else if (handoff?.handoffWaitStatus === 'error') {
    status = 'native-surface-candidate-completion-handoff-error';
  } else if (!exactReceipt) status = 'native-surface-candidate-completion-handoff-invalid-receipt';
  else if (!requestMatches || !lifecycleMatches || !candidateMatches) {
    status = 'native-surface-candidate-completion-handoff-request-mismatch';
  } else if (!sourceExecutionGenerationMatches) {
    status = 'native-surface-candidate-completion-handoff-source-mismatch';
  } else if (!sourceWasCurrent) {
    status = 'native-surface-candidate-completion-handoff-source-not-current';
  } else if (!published) {
    status = 'native-surface-candidate-completion-handoff-not-published';
  }
  return {
    schema: 'peercompute.ulg.sph-native-surface-candidate-completion-handoff-admission.v0',
    status,
    admitted: accepted,
    requestToken,
    lifecycleGeneration,
    candidateGeneration,
    sourceResidentExecutionGeneration:
      handoff?.sourceResidentExecutionGeneration ?? null,
    requestMatches,
    lifecycleMatches,
    candidateMatches,
    sourceExecutionGenerationMatches,
    sourceStepsSignatureMatches,
    sourceStepSignatureMatches,
    sourceWasCurrent,
    published,
    reason: handoff?.reason ?? null
  };
}

export function normalizeSphResidentPresentationProofWaitTimeout(timeoutMs = null) {
  // `Number(null)` is zero. Preserve null/undefined as an unbounded wait so
  // the initial native presentation gate does not self-time-out on its first
  // animation frame before the asynchronous candidate can publish.
  if (timeoutMs == null) return null;
  const numericTimeoutMs = Number(timeoutMs);
  return Number.isFinite(numericTimeoutMs)
    ? Math.max(0, numericTimeoutMs)
    : null;
}

/**
 * The Scene marks only a pre-copy snapshot drift of a private candidate's
 * camera inputs with this code. It is safe to discard and rebuild that same
 * resident source once the camera stops moving; every other presentation
 * failure remains fail-closed.
 */
export function isSphNativeSurfaceCameraPresentationSnapshotStale(value) {
  return String(value || '').includes(
    SPH_NATIVE_SURFACE_CAMERA_SNAPSHOT_STALE_ERROR_CODE
  );
}

/**
 * A camera retry is permitted only for the structured terminal failure carried
 * by the exact scene-private handoff and mirrored by the scheduler's current
 * latest receipt. A reason string is diagnostic text, never retry authority.
 */
export function resolveSphNativeSurfaceCameraRetryEligibility({
  handoff = null,
  scheduler = null,
  expectedRequestToken = null,
  expectedLifecycleGeneration = null,
  expectedCandidateGeneration = null,
  expectedResidentExecutionGeneration = null,
  expectedResidentStepsSignature = null,
  expectedResidentStepSignature = null,
  sourceStillCurrent = false
} = {}) {
  const requestToken = nativeSurfaceCandidateCompletionHandoffExactInteger(
    handoff?.requestToken
  );
  const lifecycleGeneration = nativeSurfaceCandidateCompletionHandoffExactInteger(
    handoff?.lifecycleGeneration
  );
  const candidateGeneration = nativeSurfaceCandidateCompletionHandoffExactInteger(
    handoff?.candidateGeneration
  );
  const expectedRequest = nativeSurfaceCandidateCompletionHandoffExactInteger(
    expectedRequestToken
  );
  const expectedLifecycle = nativeSurfaceCandidateCompletionHandoffExactInteger(
    expectedLifecycleGeneration
  );
  const expectedCandidate = nativeSurfaceCandidateCompletionHandoffExactInteger(
    expectedCandidateGeneration
  );
  const expectedSourceGeneration = nativeSurfaceCandidateCompletionHandoffExactInteger(
    expectedResidentExecutionGeneration
  );
  const exactReceipt = Boolean(
    handoff?.schema
      === 'peercompute.ulg.sph-native-surface-candidate-completion-handoff.v0'
    && requestToken != null
    && lifecycleGeneration != null
    && candidateGeneration != null
  );
  const identityMatches = Boolean(
    exactReceipt
    && expectedRequest != null
    && expectedLifecycle != null
    && expectedCandidate != null
    && requestToken === expectedRequest
    && lifecycleGeneration === expectedLifecycle
    && candidateGeneration === expectedCandidate
  );
  const sourceMatches = Boolean(
    exactReceipt
    && expectedSourceGeneration != null
    && expectedResidentStepsSignature != null
    && expectedResidentStepSignature != null
    && handoff?.sourceResidentExecutionGeneration === expectedSourceGeneration
    && handoff?.sourceResidentStepsSignature === expectedResidentStepsSignature
    && handoff?.sourceResidentStepSignature === expectedResidentStepSignature
    && handoff?.sourceResidentExecutionGenerationMatchesCurrent === true
  );
  const structuredCameraFailure = Boolean(
    handoff?.status === 'failed'
    && handoff?.terminalStatus === 'failed'
    && handoff?.terminalFailureCode
      === SPH_NATIVE_SURFACE_CAMERA_SNAPSHOT_STALE_ERROR_CODE
    && handoff?.terminalFailureCameraOnly === true
    && handoff?.terminalReceiptMatchesRequest === true
    && handoff?.terminalRequestToken === requestToken
    && handoff?.terminalLifecycleGeneration === lifecycleGeneration
    && handoff?.terminalCandidateGeneration === candidateGeneration
  );
  const schedulerLatestMatches = Boolean(
    scheduler?.terminalStatus === 'failed'
    && scheduler?.terminalFailureCode
      === SPH_NATIVE_SURFACE_CAMERA_SNAPSHOT_STALE_ERROR_CODE
    && scheduler?.terminalFailureCameraOnly === true
    && scheduler?.terminalReceiptMatchesRequest === true
    && scheduler?.terminalIsCurrentLatest === true
    && scheduler?.latestToken === requestToken
    && scheduler?.latestCandidateRequestToken === requestToken
    && scheduler?.latestCandidateGeneration === candidateGeneration
    && scheduler?.lifecycleGeneration === lifecycleGeneration
    && scheduler?.latestCandidateLifecycleGeneration === lifecycleGeneration
    && scheduler?.terminalRequestToken === requestToken
    && scheduler?.terminalCandidateGeneration === candidateGeneration
    && scheduler?.terminalLifecycleGeneration === lifecycleGeneration
    && scheduler?.terminalSourceResidentExecutionGeneration
      === expectedSourceGeneration
    && scheduler?.terminalSourceResidentStepsSignature
      === expectedResidentStepsSignature
    && scheduler?.terminalSourceResidentStepSignature
      === expectedResidentStepSignature
    && scheduler?.terminalSourceResidentExecutionGenerationMatchesCurrent === true
    && scheduler?.latestCandidateSourceResidentExecutionGeneration
      === expectedSourceGeneration
    && scheduler?.latestCandidateSourceResidentStepsSignature
      === expectedResidentStepsSignature
    && scheduler?.latestCandidateSourceResidentStepSignature
      === expectedResidentStepSignature
    && scheduler?.latestCandidateSourceResidentExecutionGenerationMatchesCurrent
      === true
  );
  const eligible = Boolean(
    identityMatches
    && sourceMatches
    && structuredCameraFailure
    && schedulerLatestMatches
    && sourceStillCurrent === true
  );
  return Object.freeze({
    schema: 'peercompute.ulg.sph-native-surface-camera-retry-eligibility.v0',
    eligible,
    identityMatches,
    sourceMatches,
    structuredCameraFailure,
    schedulerLatestMatches,
    sourceStillCurrent: sourceStillCurrent === true,
    requestToken,
    lifecycleGeneration,
    candidateGeneration,
    failureCode: handoff?.terminalFailureCode ?? null
  });
}

/**
 * Re-open a held post-step gate only when a candidate that completed after the
 * bounded handoff wait is now the scheduler's exact current successful
 * receipt. A later receipt may supersede the held gate only monotonically
 * within the same lifecycle and exact resident source. The caller still has
 * to runtime-admit that receipt for the live source before it can schedule
 * another physics batch. Foreground pixel proof remains separate telemetry.
 */
export function resolveSphNativeSurfaceLatePresentationSuccessEligibility({
  context = null,
  gate = null,
  scheduler = null,
  sourceStillCurrent = false
} = {}) {
  const contextGeneration = nativeSurfaceCandidateCompletionHandoffExactInteger(
    context?.generation
  );
  const contextScheduleToken = nativeSurfaceCandidateCompletionHandoffExactInteger(
    context?.scheduleToken
  );
  const expectedSourceGeneration = nativeSurfaceCandidateCompletionHandoffExactInteger(
    context?.sourceResidentExecutionGeneration
  );
  const expectedSourceStepsSignature = context?.sourceResidentStepsSignature ?? null;
  const expectedSourceStepSignature = context?.sourceResidentStepSignature ?? null;
  const gateRequestToken = nativeSurfaceCandidateCompletionHandoffExactInteger(
    gate?.requestToken
  );
  const gateCandidateGeneration = nativeSurfaceCandidateCompletionHandoffExactInteger(
    gate?.candidateGeneration
  );
  const gateLifecycleGeneration = nativeSurfaceCandidateCompletionHandoffExactInteger(
    gate?.lifecycleGeneration
  );
  const terminalRequestToken = nativeSurfaceCandidateCompletionHandoffExactInteger(
    scheduler?.terminalRequestToken
  );
  const terminalCandidateGeneration = nativeSurfaceCandidateCompletionHandoffExactInteger(
    scheduler?.terminalCandidateGeneration
  );
  const terminalLifecycleGeneration = nativeSurfaceCandidateCompletionHandoffExactInteger(
    scheduler?.terminalLifecycleGeneration
  );
  const terminalAtOrAfterGate = Boolean(
    terminalRequestToken != null
    && terminalCandidateGeneration != null
    && gateRequestToken != null
    && gateCandidateGeneration != null
    && terminalRequestToken >= gateRequestToken
    && terminalCandidateGeneration >= gateCandidateGeneration
  );
  const gateMatchesContext = Boolean(
    gate?.active === true
    && gate?.status === 'native-surface-post-step-presentation-unadmitted'
    && contextGeneration != null
    && contextScheduleToken != null
    && Number(gate?.generation) === contextGeneration
    && Number(gate?.scheduleToken) === contextScheduleToken
  );
  const gateExactSource = Boolean(
    gateRequestToken != null
    && gateCandidateGeneration != null
    && gateLifecycleGeneration != null
    && expectedSourceGeneration != null
    && expectedSourceStepsSignature != null
    && expectedSourceStepSignature != null
    && gate?.sourceResidentExecutionGeneration === expectedSourceGeneration
    && gate?.sourceResidentStepsSignature === expectedSourceStepsSignature
    && gate?.sourceResidentStepSignature === expectedSourceStepSignature
  );
  const terminalExactCurrentSuccess = Boolean(
    scheduler?.terminalStatus === 'published'
    && scheduler?.terminalReceiptMatchesRequest === true
    && scheduler?.terminalIsCurrentLatest === true
    && terminalRequestToken != null
    && terminalCandidateGeneration != null
    && terminalLifecycleGeneration != null
    && scheduler?.latestToken === terminalRequestToken
    && scheduler?.latestCandidateRequestToken === terminalRequestToken
    && scheduler?.latestCandidateGeneration === terminalCandidateGeneration
    && scheduler?.lifecycleGeneration === terminalLifecycleGeneration
    && scheduler?.latestCandidateLifecycleGeneration === terminalLifecycleGeneration
    && terminalLifecycleGeneration === gateLifecycleGeneration
    && terminalAtOrAfterGate
    && scheduler?.terminalSourceResidentExecutionGeneration
      === expectedSourceGeneration
    && scheduler?.terminalSourceResidentStepsSignature
      === expectedSourceStepsSignature
    && scheduler?.terminalSourceResidentStepSignature
      === expectedSourceStepSignature
    && scheduler?.terminalSourceResidentExecutionGenerationMatchesCurrent === true
    && scheduler?.latestCandidateSourceResidentExecutionGeneration
      === expectedSourceGeneration
    && scheduler?.latestCandidateSourceResidentStepsSignature
      === expectedSourceStepsSignature
    && scheduler?.latestCandidateSourceResidentStepSignature
      === expectedSourceStepSignature
    && scheduler?.latestCandidateSourceResidentExecutionGenerationMatchesCurrent
      === true
  );
  const eligible = Boolean(
    gateMatchesContext
    && gateExactSource
    && terminalExactCurrentSuccess
    && sourceStillCurrent === true
  );
  return Object.freeze({
    schema: 'peercompute.ulg.sph-native-surface-late-presentation-success-eligibility.v0',
    eligible,
    gateMatchesContext,
    gateExactSource,
    terminalExactCurrentSuccess,
    sourceStillCurrent: sourceStillCurrent === true,
    terminalAtOrAfterGate,
    gateRequestToken,
    gateCandidateGeneration,
    gateLifecycleGeneration,
    requestToken: terminalRequestToken,
    candidateGeneration: terminalCandidateGeneration,
    lifecycleGeneration: terminalLifecycleGeneration,
    supersedesGate: Boolean(
      terminalAtOrAfterGate
      && (
        terminalRequestToken !== gateRequestToken
        || terminalCandidateGeneration !== gateCandidateGeneration
      )
    )
  });
}

/**
 * Decide whether one terminal scheduler receipt authorizes a render-only
 * retry of the active native post-step gate. This deliberately accepts a
 * prior admitted request N followed by a camera-only terminal failure N + 1,
 * but only when N + 1 is still the scheduler's latest exact source. A global
 * scheduler reason, a stale terminal receipt, or any changed source identity
 * is not authority to retry physics or presentation.
 */
export function resolveSphNativeSurfaceCameraPresentationRecoveryEligibility({
  context = null,
  gate = null,
  scheduler = null,
  sourceStillCurrent = false
} = {}) {
  const contextGeneration = nativeSurfaceCandidateCompletionHandoffExactInteger(
    context?.generation
  );
  const contextScheduleToken = nativeSurfaceCandidateCompletionHandoffExactInteger(
    context?.scheduleToken
  );
  const contextGateRequestToken = nativeSurfaceCandidateCompletionHandoffExactInteger(
    context?.gateRequestToken
  );
  const contextGateCandidateGeneration = nativeSurfaceCandidateCompletionHandoffExactInteger(
    context?.gateCandidateGeneration
  );
  const contextGateLifecycleGeneration = nativeSurfaceCandidateCompletionHandoffExactInteger(
    context?.gateLifecycleGeneration
  );
  const gateRequestToken = nativeSurfaceCandidateCompletionHandoffExactInteger(
    gate?.requestToken
  );
  const gateCandidateGeneration = nativeSurfaceCandidateCompletionHandoffExactInteger(
    gate?.candidateGeneration
  );
  const gateLifecycleGeneration = nativeSurfaceCandidateCompletionHandoffExactInteger(
    gate?.lifecycleGeneration
  );
  const terminalRequestToken = nativeSurfaceCandidateCompletionHandoffExactInteger(
    scheduler?.terminalRequestToken
  );
  const terminalCandidateGeneration = nativeSurfaceCandidateCompletionHandoffExactInteger(
    scheduler?.terminalCandidateGeneration
  );
  const terminalLifecycleGeneration = nativeSurfaceCandidateCompletionHandoffExactInteger(
    scheduler?.terminalLifecycleGeneration
  );
  const schedulerLatestToken = nativeSurfaceCandidateCompletionHandoffExactInteger(
    scheduler?.latestToken
  );
  const schedulerLifecycleGeneration = nativeSurfaceCandidateCompletionHandoffExactInteger(
    scheduler?.lifecycleGeneration
  );
  const expectedSourceExecutionGeneration =
    nativeSurfaceCandidateCompletionHandoffExactInteger(
      context?.sourceResidentExecutionGeneration
    );
  const expectedSourceStepsSignature =
    context?.sourceResidentStepsSignature ?? null;
  const expectedSourceStepSignature =
    context?.sourceResidentStepSignature ?? null;
  const gateMatchesContext = Boolean(
    gate?.active === true
    && contextGeneration != null
    && contextScheduleToken != null
    && Number(gate?.generation) === contextGeneration
    && Number(gate?.scheduleToken) === contextScheduleToken
  );
  // A retry may itself create a newer candidate, so the gate can advance past
  // the immutable opening request. It must never regress, cross lifecycles,
  // or lose the exact request/candidate identity captured for this source.
  const gateLineageMatchesContext = Boolean(
    contextGateRequestToken != null
    && contextGateCandidateGeneration != null
    && contextGateLifecycleGeneration != null
    && gateRequestToken != null
    && gateCandidateGeneration != null
    && gateLifecycleGeneration != null
    && gateRequestToken >= contextGateRequestToken
    && gateCandidateGeneration >= contextGateCandidateGeneration
    && gateLifecycleGeneration === contextGateLifecycleGeneration
  );
  const terminalReceiptMatchesScheduler = Boolean(
    scheduler?.terminalReceiptMatchesRequest === true
    && scheduler?.terminalIsCurrentLatest === true
    && terminalRequestToken != null
    && terminalCandidateGeneration != null
    && terminalLifecycleGeneration != null
    && schedulerLatestToken != null
    && schedulerLifecycleGeneration != null
    && terminalRequestToken === schedulerLatestToken
    && terminalLifecycleGeneration === schedulerLifecycleGeneration
  );
  const terminalMatchesGateLifecycle = Boolean(
    gateLifecycleGeneration != null
    && terminalLifecycleGeneration != null
    && gateLifecycleGeneration === terminalLifecycleGeneration
  );
  const terminalIsAtOrAfterCurrentGate = Boolean(
    gateRequestToken != null
    && gateCandidateGeneration != null
    && terminalRequestToken != null
    && terminalCandidateGeneration != null
    && terminalRequestToken >= gateRequestToken
    && terminalCandidateGeneration >= gateCandidateGeneration
  );
  const exactSourceMatches = Boolean(
    expectedSourceExecutionGeneration != null
    && expectedSourceStepsSignature != null
    && expectedSourceStepSignature != null
    && scheduler?.terminalSourceResidentExecutionGenerationMatchesCurrent === true
    && scheduler?.terminalSourceResidentExecutionGeneration
      === expectedSourceExecutionGeneration
    && scheduler?.terminalSourceResidentStepsSignature
      === expectedSourceStepsSignature
    && scheduler?.terminalSourceResidentStepSignature
      === expectedSourceStepSignature
  );
  const typedCameraFailure = Boolean(
    scheduler?.terminalStatus === 'failed'
    && scheduler?.terminalFailureCode
      === SPH_NATIVE_SURFACE_CAMERA_SNAPSHOT_STALE_ERROR_CODE
    && scheduler?.terminalFailureCameraOnly === true
  );
  const eligible = Boolean(
    gateMatchesContext
    && gateLineageMatchesContext
    && sourceStillCurrent === true
    && typedCameraFailure
    && terminalReceiptMatchesScheduler
    && terminalMatchesGateLifecycle
    && terminalIsAtOrAfterCurrentGate
    && exactSourceMatches
  );
  return Object.freeze({
    schema: 'peercompute.ulg.sph-native-surface-camera-presentation-recovery-eligibility.v0',
    eligible,
    gateMatchesContext,
    gateLineageMatchesContext,
    sourceStillCurrent: sourceStillCurrent === true,
    typedCameraFailure,
    terminalReceiptMatchesScheduler,
    terminalMatchesGateLifecycle,
    terminalIsAtOrAfterCurrentGate,
    exactSourceMatches,
    terminalRequestToken,
    terminalCandidateGeneration,
    terminalLifecycleGeneration,
    gateRequestToken,
    gateCandidateGeneration,
    gateLifecycleGeneration,
    contextGateRequestToken,
    contextGateCandidateGeneration,
    contextGateLifecycleGeneration,
    sourceResidentExecutionGeneration:
      scheduler?.terminalSourceResidentExecutionGeneration ?? null
  });
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

const RESIDENT_GPU_CONTINUATION_NO_FULL_STATE_READBACK_MODES = new Set([
  SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT,
  'compact-grid-conservation-summary-readback'
]);

const INCOMPLETE_GPU_RESIDENCY_WARNING =
  'Hot-loop GPU residency telemetry is incomplete or unproven.';

function failClosedPageVisibleGpuReadbackTelemetryEvidence({
  explicitInvalidParticipant = true
} = {}) {
  return {
    readbackTelemetryComplete: explicitInvalidParticipant ? false : null,
    normalHotLoopReadbackFree: null,
    productionHotLoopHostDependencyFree: null
  };
}

function ownDataProperty(source, field) {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(source, field);
    if (!descriptor) {
      return Reflect.get(source, field) === undefined
        ? { present: false, data: false, value: undefined }
        : { present: true, data: false, value: undefined };
    }
    if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      return { present: true, data: false, value: undefined };
    }
    const value = Reflect.get(source, field);
    if (!Object.is(value, descriptor.value)) {
      return { present: true, data: false, value: undefined };
    }
    return { present: true, data: true, value };
  } catch (_) {
    return { present: true, data: false, value: undefined };
  }
}

function residentGpuReadbackParticipantControls(source) {
  const backend = ownDataProperty(source, 'backend');
  const readbackMode = ownDataProperty(source, 'readbackMode');
  const fullParticleReadbackPerformed = ownDataProperty(
    source,
    'fullParticleReadbackPerformed'
  );
  const fullParticleReadbackFree = ownDataProperty(
    source,
    'fullParticleReadbackFree'
  );
  return {
    valid: Boolean(
      backend.present
      && backend.data
      && backend.value === 'webgpu'
      && readbackMode.present
      && readbackMode.data
      && typeof readbackMode.value === 'string'
      && RESIDENT_GPU_CONTINUATION_NO_FULL_STATE_READBACK_MODES.has(
        readbackMode.value
      )
      && fullParticleReadbackPerformed.present
      && fullParticleReadbackPerformed.data
      && fullParticleReadbackPerformed.value === false
      && fullParticleReadbackFree.present
      && fullParticleReadbackFree.data
      && fullParticleReadbackFree.value === true
    ),
    backend,
    readbackMode,
    fullParticleReadbackPerformed,
    fullParticleReadbackFree
  };
}

function pageVisibleGpuReadbackTelemetryParticipantEvidence(source) {
  try {
    if (
      !source
      || typeof source !== 'object'
      || Array.isArray(source)
    ) {
      return failClosedPageVisibleGpuReadbackTelemetryEvidence();
    }
    if (!residentGpuReadbackParticipantControls(source).valid) {
      return failClosedPageVisibleGpuReadbackTelemetryEvidence();
    }
    const compact = compactPageVisibleGpuReadbackTelemetry(source);
    return {
      readbackTelemetryComplete: compact.readbackTelemetryComplete,
      normalHotLoopReadbackFree: compact.normalHotLoopReadbackFree,
      productionHotLoopHostDependencyFree:
        compact.productionHotLoopHostDependencyFree
    };
  } catch (_) {
    return failClosedPageVisibleGpuReadbackTelemetryEvidence();
  }
}

export function compositePageVisibleGpuReadbackTelemetryEvidence(
  sources = []
) {
  try {
    if (!Array.isArray(sources)) {
      return failClosedPageVisibleGpuReadbackTelemetryEvidence();
    }
    const sourceLength = ownDataProperty(sources, 'length');
    const sourceCount = sourceLength.value;
    if (
      !sourceLength.present
      || !sourceLength.data
      || !Number.isSafeInteger(sourceCount)
      || sourceCount < 0
    ) {
      return failClosedPageVisibleGpuReadbackTelemetryEvidence();
    }
    if (sourceCount === 0) {
      return failClosedPageVisibleGpuReadbackTelemetryEvidence({
        explicitInvalidParticipant: false
      });
    }
    const participants = [];
    for (let index = 0; index < sourceCount; index += 1) {
      // Array iteration helpers skip vacancies. Require an own data element at
      // every logical index so sparse and proxied-hole arrays cannot turn zero
      // evidence into an "all participants passed" vote.
      const source = ownDataProperty(sources, String(index));
      if (!source.present || !source.data) {
        return failClosedPageVisibleGpuReadbackTelemetryEvidence();
      }
      participants.push(
        pageVisibleGpuReadbackTelemetryParticipantEvidence(source.value)
      );
    }

    let everyComplete = true;
    let anyIncomplete = false;
    for (const participant of participants) {
      everyComplete = everyComplete
        && participant.readbackTelemetryComplete === true;
      anyIncomplete = anyIncomplete
        || participant.readbackTelemetryComplete === false;
    }
    const readbackTelemetryComplete = everyComplete
      ? true
      : (anyIncomplete ? false : null);
    const coupledClaim = (field) => {
      let everyPositive = true;
      for (const participant of participants) {
        if (participant[field] === false) return false;
        everyPositive = everyPositive && participant[field] === true;
      }
      return readbackTelemetryComplete === true && everyPositive
        ? true
        : null;
    };
    return {
      readbackTelemetryComplete,
      normalHotLoopReadbackFree: coupledClaim('normalHotLoopReadbackFree'),
      productionHotLoopHostDependencyFree: coupledClaim(
        'productionHotLoopHostDependencyFree'
      )
    };
  } catch (_) {
    return failClosedPageVisibleGpuReadbackTelemetryEvidence();
  }
}

export function residentGpuResidencyWarningMessage(options = {}) {
  try {
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
      return INCOMPLETE_GPU_RESIDENCY_WARNING;
    }
    const pendingProperty = ownDataProperty(options, 'pending');
    const completedProperty = ownDataProperty(
      options,
      'completedExecutionAvailable'
    );
    const telemetrySourcesProperty = ownDataProperty(
      options,
      'telemetrySources'
    );
    if (
      (pendingProperty.present && !pendingProperty.data)
      || (completedProperty.present && !completedProperty.data)
      || (telemetrySourcesProperty.present && !telemetrySourcesProperty.data)
    ) return INCOMPLETE_GPU_RESIDENCY_WARNING;
    const pending = pendingProperty.present ? pendingProperty.value : false;
    const completedExecutionAvailable = completedProperty.present
      ? completedProperty.value
      : false;
    const telemetrySources = telemetrySourcesProperty.present
      ? telemetrySourcesProperty.value
      : null;
    if (pending === true || completedExecutionAvailable !== true) return null;
    const {
      readbackTelemetryComplete,
      normalHotLoopReadbackFree,
      productionHotLoopHostDependencyFree
    } = compositePageVisibleGpuReadbackTelemetryEvidence(telemetrySources);
    if (
      readbackTelemetryComplete !== true
      || typeof productionHotLoopHostDependencyFree !== 'boolean'
      || (
        productionHotLoopHostDependencyFree === true
        && typeof normalHotLoopReadbackFree !== 'boolean'
      )
    ) {
      return INCOMPLETE_GPU_RESIDENCY_WARNING;
    }
    if (productionHotLoopHostDependencyFree === false) {
      return 'Hot loop has an observed awaited or unclassified host dependency.';
    }
    if (
      productionHotLoopHostDependencyFree === true
      && normalHotLoopReadbackFree === false
    ) {
      return 'Strict GPU residency is false only because final diagnostics or deferred cleanup callbacks were observed; no production hot-loop host dependency was observed.';
    }
    return null;
  } catch (_) {
    return INCOMPLETE_GPU_RESIDENCY_WARNING;
  }
}

function residentGpuContinuationEvidenceReadyUnchecked(execution = null) {
  const executionObjectValid = Boolean(
    execution
    && typeof execution === 'object'
    && !Array.isArray(execution)
  );
  const finalStepProperty = executionObjectValid
    ? ownDataProperty(execution, 'finalStep')
    : { present: false, data: false, value: undefined };
  const finalStep = finalStepProperty.data ? finalStepProperty.value : null;
  const telemetrySources = [execution];
  if (finalStepProperty.present) telemetrySources.push(finalStep);
  const continuationParticipantsValid = Boolean(
    telemetrySources.length > 0
    && telemetrySources.every((source) => {
      if (
        !source
        || typeof source !== 'object'
        || Array.isArray(source)
      ) {
        return false;
      }
      const controls = residentGpuReadbackParticipantControls(source);
      const compact = compactPageVisibleGpuReadbackTelemetry(source);
      const certifiedReadbackTelemetry = Boolean(
        compact.readbackTelemetryComplete === true
        || (
          compact.readbackTelemetryComplete !== true
          && compact.legacyExactZeroProductionEvidence === true
        )
      );
      const residentContinuationReady = ownDataProperty(
        source,
        'residentContinuationReady'
      );
      const continuationAvailable = ownDataProperty(
        source,
        'continuationAvailable'
      );
      const residentContinuationReadyValid = Boolean(
        !residentContinuationReady.present
        || (
          residentContinuationReady.data
          && typeof residentContinuationReady.value === 'boolean'
        )
      );
      const continuationAvailableValid = Boolean(
        !continuationAvailable.present
        || (
          continuationAvailable.data
          && typeof continuationAvailable.value === 'boolean'
        )
      );
      const continuationReady = Boolean(
        (
          residentContinuationReady.value === true
          || continuationAvailable.value === true
        )
        && residentContinuationReady.value !== false
        && continuationAvailable.value !== false
      );
      return Boolean(
        controls.valid
        && residentContinuationReadyValid
        && continuationAvailableValid
        && continuationReady
        && certifiedReadbackTelemetry
      );
    })
  );
  const nextSphParticleState =
    execution?.nextSphParticleState
    ?? finalStep?.nextSphParticleState
    ?? null;
  const nextMlsMpmParticleState =
    execution?.nextMlsMpmParticleState
    ?? finalStep?.nextMlsMpmParticleState
    ?? null;
  const nextParticleUploads =
    execution?.nextParticleUploads
    ?? finalStep?.nextParticleUploads
    ?? null;
  const sphParticleUpload = nextParticleUploads?.sphParticleUpload ?? null;
  const mlsMpmParticleUpload = nextParticleUploads?.mlsMpmParticleUpload ?? null;
  const particleCount = Number(nextSphParticleState?.particleCount);
  const particleCountsMatch = Boolean(
    Number.isInteger(particleCount)
    && particleCount > 0
    && Number(nextMlsMpmParticleState?.particleCount) === particleCount
    && Number(sphParticleUpload?.particleCount) === particleCount
    && Number(mlsMpmParticleUpload?.particleCount) === particleCount
  );

  return Boolean(
    execution?.schema === ULG_MLS_MPM_GPU_RESIDENT_STEPS_EXECUTION_SCHEMA
    && continuationParticipantsValid
    && nextSphParticleState?.schema === ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA
    && nextMlsMpmParticleState?.schema === ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA
    && particleCountsMatch
    && sphParticleUpload?.schema === ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA
    && sphParticleUpload?.sourceSchema === ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA
    && sphParticleUpload?.status === 'webgpu-uploaded'
    && sphParticleUpload?.destroyed !== true
    && sphParticleUpload?.stateBuffer
    && sphParticleUpload.stateBuffer.destroyed !== true
    && sphParticleUpload?.thermoBuffer
    && sphParticleUpload.thermoBuffer.destroyed !== true
    && mlsMpmParticleUpload?.schema === ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA
    && mlsMpmParticleUpload?.sourceSchema === ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA
    && mlsMpmParticleUpload?.status === 'webgpu-uploaded'
    && mlsMpmParticleUpload?.destroyed !== true
    && mlsMpmParticleUpload?.mechanicsBuffer
    && mlsMpmParticleUpload.mechanicsBuffer.destroyed !== true
  );
}

export function residentGpuContinuationEvidenceReady(execution = null) {
  try {
    return residentGpuContinuationEvidenceReadyUnchecked(execution);
  } catch (_) {
    return false;
  }
}

// W4b: continuation readiness for the worker-owned resident lane. The lane
// retains its post-step particle buffers INSIDE the presentation worker, so
// the page-device continuation evidence (nextParticleUploads with live
// GPUBuffers) truthfully does not exist on a worker-lane execution. The lane
// itself is the continuation: a completed, uncancelled schedule whose
// terminal envelope proves retained worker refs and a sealed final epoch
// identity is ready for the next batched schedule on the SAME lane.
export function residentWorkerLaneContinuationReady(execution = null) {
  const lane = execution?.workerOwnedResidentLane;
  const presentation = lane?.committedPresentation;
  return Boolean(
    execution?.residentComputeManagerMode === 'worker-owned-resident-lane'
    && execution?.workerLaneFallback == null
    && lane?.residentScheduleStatus === 'worker-resident-schedule-completed'
    && lane?.cancelled !== true
    && Number.isSafeInteger(Number(lane?.completedStepCount))
    && Number(lane.completedStepCount) > 0
    && lane?.finalEpochIdentity
    && typeof lane.finalEpochIdentity === 'object'
    && Array.isArray(lane?.retainedBufferRefs)
    && lane.retainedBufferRefs.length > 0
    && presentation?.status
      === 'worker-offscreen-resident-particle-state-producer-rendered'
    && presentation?.committedPresentationSchema
      === ULG_WORKER_OFFSCREEN_COMMITTED_RESIDENT_SCHEDULE_PRESENTATION_SCHEMA
    && presentation?.committedPresentationStatus
      === 'state-manager-committed-resident-schedule-presentation-admission'
    && presentation?.residentScheduleCandidatePresentation === true
    && presentation?.stateManagerCommittedPresentation === true
    && presentation?.scheduleId === lane?.scheduleId
    && presentation?.laneId === lane?.laneId
    && presentation?.stateKey === lane?.stateKey
    && Number(presentation?.residentExecutionGeneration)
      === Number(lane?.finalEpochIdentity?.storageGeneration)
    && Number(presentation?.sphStep)
      === Number(lane?.finalEpochIdentity?.physicsTick)
    && Number(presentation?.stepOrdinal)
      === Number(lane?.completedStepCount)
    && presentation?.authorityStatus
      === 'state-manager-committed-worker-schedule'
    && presentation?.computeManagerCompletionSchema
      === ULG_WORKER_LANE_COMPUTE_MANAGER_COMPLETION_SCHEMA
    && typeof presentation?.computeManagerLeaseId === 'string'
    && presentation.computeManagerLeaseId.length > 0
    && presentation?.computeManagerLeaseStatus === 'completed'
    && presentation?.computeManagerFenceSatisfied === true
    && presentation?.stateManagerCommitStatus === 'committed'
    && presentation?.stateManagerCommitAccepted === true
    && presentation?.terminalScheduleFence === true
    && presentation?.terminalFenceScope === 'resident-schedule-terminal'
    && presentation?.terminalFenceSatisfied === true
    && presentation?.terminalFenceAuthorityAdmissionReady === true
    && presentation?.producerSourceKind
      === 'worker-retained-resident-stage-output'
    && presentation?.producerSourceTransport
      === 'worker-retained-resident-stage-output'
    && presentation?.sourceStageId === 'schroederSameLevelMechanics'
    && presentation?.retainedParticleStateStatus
      === 'worker-retained-particle-state-ready'
  );
}

export function residentWorkerLaneNativeSurfacePresentationReady({
  execution = null,
  presentation = null,
  renderState = null,
  surfaceDraw = null
} = {}) {
  const lane = execution?.workerOwnedResidentLane;
  const committedPresentation = lane?.committedPresentation;
  const sourceStep = Number(presentation?.sourceStep);
  const sourceTimeS = Number(presentation?.sourceTimeS);
  const renderSource = renderState?.residentRenderSource || null;
  const handoff = renderSource?.workerLaneNativeSurfaceSnapshotHandoff || null;
  const presentationProof = resolveSphResidentPresentationProof({
    renderState,
    surfaceDraw,
    requireCurrentSource: true
  });
  return Boolean(
    residentWorkerLaneContinuationReady(execution)
    && presentation?.schema
      === ULG_WORKER_LANE_NATIVE_SURFACE_PRESENTATION_SOURCE_SCHEMA
    && presentation?.status
      === 'worker-lane-native-surface-presentation-source-ready'
    && presentation?.scheduleId === lane?.scheduleId
    && presentation?.laneId === lane?.laneId
    && presentation?.stateKey === lane?.stateKey
    && typeof presentation?.requestId === 'string'
    && presentation.requestId.length > 0
    && presentation?.cacheKey === presentation.requestId
    && Number.isSafeInteger(sourceStep)
    && sourceStep === Number(committedPresentation?.sphStep) + 1
    && Number.isFinite(sourceTimeS)
    && Math.abs(sourceTimeS - Number(lane?.laneSimTimeS)) <= 1e-9
    && presentation?.readbackScope
      === 'resident-schedule-terminal-presentation'
    && presentation?.terminalPresentationFullParticleReadbackPerformed === true
    && presentation?.physicsHotLoopParticipation === false
    && renderState?.status === 'resident-render-field-applied'
    && renderState?.sourceResidentRenderSourceStatus
      === 'resident-render-source-current'
    && renderState?.surfaceDrawOverlayPolicyStatus
      === 'surface-draw-native-webgpu-main-canvas'
    && renderState?.workerOffscreenPresentationStatus
      === 'worker-offscreen-display-hidden-main-native-owner'
    && renderState?.workerOffscreenRetainedCompactSnapshotStatus
      === 'presentation-worker-retained-compact-snapshot-exported'
    && renderState?.workerOffscreenRetainedCompactSnapshotAvailable === true
    && Number(
      renderState?.workerOffscreenRetainedCompactSnapshotStep
        ?? renderState?.workerOffscreenRetainedCompactSnapshot
          ?.compactBufferSnapshotStep
    )
      === sourceStep
    && renderSource?.residentExecutionGenerationMatchesCurrent === true
    && Number(renderSource?.nextStep) === sourceStep
    && Math.abs(Number(renderSource?.nextTimeS) - sourceTimeS) <= 1e-9
    && handoff?.schema
      === ULG_WORKER_LANE_NATIVE_SURFACE_PRESENTATION_SOURCE_SCHEMA
    && handoff?.status
      === 'worker-lane-native-surface-presentation-source-admitted'
    && handoff?.scheduleId === presentation.scheduleId
    && handoff?.laneId === presentation.laneId
    && handoff?.stateKey === presentation.stateKey
    && handoff?.requestId === presentation.requestId
    && handoff?.cacheKey === presentation.cacheKey
    && Number(handoff?.sourceStep) === sourceStep
    && Math.abs(Number(handoff?.sourceTimeS) - sourceTimeS) <= 1e-9
    && handoff?.sharedSlotIdentityVerified === true
    && handoff?.workerLineageMetadataStatus
      === 'worker-retained-compact-snapshot-lineage-metadata-ready'
    && handoff?.terminalCompactSnapshotReadback === true
    && presentationProof.bridge === 'native-webgpu-surface-consumer'
    && presentationProof.admitted === true
    && presentationProof.sourceCurrent === true
  );
}

export async function materializeSphWorkerLaneNativeSurfacePresentationSource({
  sceneApi = null,
  execution = null,
  generation = 0,
  scheduleToken = 0,
  materialProperties = null,
  timeoutMs = 16000,
  pollIntervalMs = 20
} = {}) {
  if (!residentWorkerLaneContinuationReady(execution)) {
    throw new Error(
      'native surface snapshot requires an admitted worker resident schedule'
    );
  }
  if (
    typeof sceneApi?.exportWorkerOffscreenRetainedCompactSnapshot !== 'function'
    || typeof sceneApi?.getWorkerOffscreenRetainedCompactSnapshotStatus
      !== 'function'
    || typeof sceneApi?.requestOpticalGpuDevice !== 'function'
  ) {
    throw new Error('native surface snapshot APIs are unavailable');
  }
  const lane = execution.workerOwnedResidentLane;
  const sourceStageId = 'schroederSameLevelMechanics';
  const particleCount = Math.max(0, Math.floor(Number(
    lane?.perStepSummaries?.lastStep?.particleCount
      ?? sceneApi.getSphGpuParticleState?.()?.particleCount
      ?? sceneApi.getMlsMpmGpuParticleState?.()?.particleCount
  ) || 0));
  const sourceStep = Number(lane?.committedPresentation?.sphStep) + 1;
  const sourceTimeS = Number(lane?.laneSimTimeS);
  if (
    particleCount < 1
    || !Number.isSafeInteger(sourceStep)
    || sourceStep < 0
    || !Number.isFinite(sourceTimeS)
  ) {
    throw new Error('worker terminal snapshot identity is incomplete');
  }
  const cacheKey = [
    lane.scheduleId,
    'native-surface',
    Math.max(0, Math.floor(Number(generation) || 0)),
    Math.max(0, Math.floor(Number(scheduleToken) || 0))
  ].join(':');
  const currentSphState = sceneApi.getSphGpuParticleState?.() || null;
  sceneApi.exportWorkerOffscreenRetainedCompactSnapshot({
    laneId: lane.laneId,
    stateKey: lane.stateKey,
    cacheKey,
    sourceStageId,
    particleCount,
    stateStrideFloats: 8,
    thermoStrideFloats: 12,
    mechanicsStrideFloats: 32,
    step: sourceStep,
    time: sourceTimeS,
    dimension: currentSphState?.dimension ?? 3,
    smoothingLengthM: currentSphState?.smoothingLengthM ?? 0,
    timeoutMs: Math.max(1, Number(timeoutMs) - 1000),
    allowLocalMaterializationBypass: false,
    reason: 'worker-terminal-native-surface-presentation'
  });
  const startedAtMs = performance.now();
  let snapshotStatus = null;
  while (performance.now() - startedAtMs < timeoutMs) {
    const current =
      sceneApi.getWorkerOffscreenRetainedCompactSnapshotStatus?.() || null;
    try {
      // Diagnostic mirror of the poll's live view (payload presence is the
      // load-bearing bit the compacted mirrors cannot show).
      globalThis.__ulgWorkerLaneSnapshotPoll = {
        status: current?.status ?? null,
        cacheKey: current?.cacheKey ?? null,
        wantCacheKey: cacheKey,
        hasPayload: Boolean(current?.compactBufferSnapshot),
        stale: current?.stale === true,
        updatedAtMs: current?.updatedAtMs ?? null
      };
    } catch {}
    const requestMatches = Boolean(
      current?.cacheKey === cacheKey
      && current?.laneId === lane.laneId
      && current?.stateKey === lane.stateKey
      && current?.sourceStageId === sourceStageId
    );
    if (
      requestMatches
      && /exported|blocked|failed|timeout/.test(String(current?.status || ''))
    ) {
      snapshotStatus = current;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  const snapshot = snapshotStatus?.compactBufferSnapshot || null;
  const snapshotReady = Boolean(
    snapshotStatus?.status
      === 'presentation-worker-retained-compact-snapshot-exported'
    && snapshotStatus?.portableSnapshotAvailable === true
    && snapshot?.schema
      === 'peercompute.ulg.remote-task-graph-compact-buffer-snapshot.v0'
    && snapshot?.cacheKey === cacheKey
    && snapshot?.laneId === lane.laneId
    && snapshot?.stateKey === lane.stateKey
    && snapshot?.sourceStageId === sourceStageId
    && Number(snapshot?.particleCount) === particleCount
    && Number(snapshot?.step) === sourceStep
    && Math.abs(Number(snapshot?.time) - sourceTimeS) <= 1e-9
    && snapshot?.sharedSlotIdentityVerified === true
    && snapshot?.workerLineageMetadata?.status
      === 'worker-retained-compact-snapshot-lineage-metadata-ready'
  );
  if (!snapshotReady) {
    // Name the exact failing readiness terms; every compacted mirror in
    // this chain hides a different subset of them.
    const why = {
      status: snapshotStatus?.status ?? null,
      portable: snapshotStatus?.portableSnapshotAvailable === true,
      hasSnapshot: Boolean(snapshot),
      snapshotSchemaOk: snapshot?.schema
        === 'peercompute.ulg.remote-task-graph-compact-buffer-snapshot.v0',
      cacheKeyOk: snapshot?.cacheKey === cacheKey,
      laneOk: snapshot?.laneId === lane.laneId
        && snapshot?.stateKey === lane.stateKey,
      stageOk: snapshot?.sourceStageId === sourceStageId,
      particleCountOk: Number(snapshot?.particleCount) === particleCount,
      stepOk: Number(snapshot?.step) === sourceStep,
      snapshotStep: snapshot?.step ?? null,
      wantStep: sourceStep,
      timeOk: Math.abs(Number(snapshot?.time) - sourceTimeS) <= 1e-9,
      snapshotTime: snapshot?.time ?? null,
      wantTime: sourceTimeS,
      slotOk: snapshot?.sharedSlotIdentityVerified === true,
      lineageOk: snapshot?.workerLineageMetadata?.status
        === 'worker-retained-compact-snapshot-lineage-metadata-ready',
      lineageStatus: snapshot?.workerLineageMetadata?.status ?? null
    };
    throw new Error(
      `worker terminal compact snapshot not ready: ${JSON.stringify(why)}`
    );
  }
  if (
    snapshot.identityRequired === true
    && (
      snapshot.identitySchema
        !== ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA
      || !(snapshot.sphIdentity instanceof Uint32Array)
      || snapshot.sphIdentity.length
        !== particleCount * SPH_GPU_PARTICLE_IDENTITY_UINTS
    )
  ) {
    throw new Error('worker terminal compact snapshot identity rows are incomplete');
  }
  const deviceResult = await sceneApi.requestOpticalGpuDevice();
  const device = deviceResult?.device || null;
  if (!device?.queue?.writeBuffer) {
    throw new Error('native surface presentation device is unavailable');
  }
  let hotBufferRecord = null;
  refreshUlgSphMlsMpmHotBuffersFromCompactSnapshot({
    device,
    compactBufferSnapshot: snapshot,
    materialProperties,
    stateManager: {
      setHotBuffer(_key, record) {
        hotBufferRecord = record;
      }
    },
    cacheKey,
    stateKey: `${lane.stateKey}:native-surface-presentation`,
    hotBufferKey: `${cacheKey}:page-native-surface`
  });
  if (!hotBufferRecord?.sphUpload || !hotBufferRecord?.mlsMpmUpload) {
    throw new Error('native surface compact snapshot uploads were not materialized');
  }
  const slotMetadata = {
    slot: snapshot.slot ?? null,
    sourceSlot: snapshot.sourceSlot ?? null,
    nextSlot: snapshot.nextSlot ?? null,
    topologyEpoch: snapshot.topologyEpoch ?? null,
    identityRevision: snapshot.identityRevision ?? null
  };
  const sphParticleState = Object.freeze({
    ...hotBufferRecord.sphPacked,
    ...slotMetadata
  });
  const mlsMpmParticleState = Object.freeze({
    ...hotBufferRecord.mlsMpmPacked,
    ...slotMetadata
  });
  const sphParticleUpload = Object.freeze({
    ...hotBufferRecord.sphUpload,
    ...slotMetadata
  });
  const mlsMpmParticleUpload = Object.freeze({
    ...hotBufferRecord.mlsMpmUpload,
    ...slotMetadata
  });
  let released = false;
  const releaseAfterQueue = async () => {
    if (released) return false;
    released = true;
    try {
      await device.queue?.onSubmittedWorkDone?.();
    } catch {}
    destroySphGpuParticleBuffers(hotBufferRecord.sphUpload);
    destroyMlsMpmGpuParticleBuffers(hotBufferRecord.mlsMpmUpload);
    return true;
  };
  return Object.freeze({
    schema: ULG_WORKER_LANE_NATIVE_SURFACE_PRESENTATION_SOURCE_SCHEMA,
    status: 'worker-lane-native-surface-presentation-source-ready',
    scheduleId: lane.scheduleId,
    laneId: lane.laneId,
    stateKey: lane.stateKey,
    requestId: cacheKey,
    cacheKey,
    sourceStageId,
    sourceStep,
    sourceTimeS,
    particleCount,
    sphParticleState,
    mlsMpmParticleState,
    sphParticleUpload,
    mlsMpmParticleUpload,
    sharedSlotIdentityVerified: true,
    workerLineageMetadataStatus:
      snapshot.workerLineageMetadata.status,
    readbackScope: 'resident-schedule-terminal-presentation',
    terminalPresentationFullParticleReadbackPerformed: true,
    physicsHotLoopParticipation: false,
    releaseAfterQueue
  });
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
  try {
    return summarizeResidentStageOrderExecutionUnchecked(execution);
  } catch (_) {
    return summarizeResidentStageOrderExecutionUnchecked(null);
  }
}

function summarizeResidentStageOrderExecutionUnchecked(execution = null) {
  const stepSummaries = Array.isArray(execution?.stepSummaries) ? execution.stepSummaries : [];
  const lastStepSummary = stepSummaries.length ? stepSummaries[stepSummaries.length - 1] : null;
  const finalStepProperty = (
    execution
    && typeof execution === 'object'
    && !Array.isArray(execution)
  )
    ? ownDataProperty(execution, 'finalStep')
    : { present: false, data: false, value: undefined };
  const hasFinalStep = finalStepProperty.present;
  const finalStep = finalStepProperty.data ? finalStepProperty.value : null;
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
  const readbackTelemetrySources = execution == null ? [] : [execution];
  if (hasFinalStep) readbackTelemetrySources.push(finalStep);
  const readbackTelemetryEvidence =
    compositePageVisibleGpuReadbackTelemetryEvidence(readbackTelemetrySources);
  return {
    schema: 'peercompute.ulg.sph-demo-resident-stage-order-execution-summary.v0',
    available: Boolean(execution?.schema || finalStep?.schema),
    executionSchema: execution?.schema || null,
    status: execution?.status || finalStep?.status || null,
    backend: execution?.backend || finalStep?.backend || null,
    readbackMode: execution?.readbackMode || finalStep?.readbackMode || null,
    // Null, not false, when neither source reported it. Boolean() turned an
    // absent measurement into "a readback happened", which is the same failure
    // as reporting 0 ms for a timestamp query the device never wrote: it reads
    // as a measured bad result rather than as no result. Every "not readback
    // free" sample in the 2026-07-26 probe campaign was this, not a readback.
    readbackTelemetryComplete:
      readbackTelemetryEvidence.readbackTelemetryComplete,
    normalHotLoopReadbackFree:
      readbackTelemetryEvidence.normalHotLoopReadbackFree,
    productionHotLoopHostDependencyFree:
      readbackTelemetryEvidence.productionHotLoopHostDependencyFree,
    // SS unification check. The thermal law runs its own spatial path rather
    // than the shared law-neighbour candidate artifact, and its binned-versus-
    // exhaustive decision was computed on every step and surfaced nowhere --
    // the same shape as the law-neighbour traversal ratios, which turned out to
    // be 100% exhaustive once anyone could see them.
    thermalTraversal: (() => {
      const thermal = finalStep?.thermalStep || null;
      if (!thermal) return null;
      return {
        schema: 'peercompute.ulg.sph-thermal-traversal-summary.v0',
        lookupMode: thermal.thermalProposalLookupMode ?? null,
        normalLookupBinned: thermal.thermalProposalNormalLookupBinned ?? null,
        fallbackReason: thermal.thermalProposalFallbackReason ?? null,
        exhaustiveConfiguredCount:
          thermal.thermalProposalExhaustiveTraversalConfiguredCount ?? null,
        exhaustivePotentialCount:
          thermal.thermalProposalExhaustiveTraversalPotentialCount ?? null,
        binnedTraversalCount: thermal.thermalProposalBinnedTraversalCount ?? null,
        dispatchCount: thermal.thermalProposalDispatchCount ?? null,
        // The canonical spatial producer is what actually runs; the classic
        // fields above stay null when it does. These are the ones that say
        // whether thermal shares SS's directory or builds its own.
        canonical: (() => {
          const c = thermal.canonicalThermalProposal || null;
          if (!c) return null;
          return {
            status: c.status ?? null,
            proposalMode: c.proposalMode ?? null,
            directoryBuildCount: c.directoryBuildCount ?? null,
            sharedGenerationDirectoryBuildCount:
              c.sharedGenerationDirectoryBuildCount ?? null,
            privateBuildCount: c.privateBuildCount ?? null,
            fixedCandidateBuildCount: c.fixedCandidateBuildCount ?? null,
            exhaustiveTraversalCount: c.exhaustiveTraversalCount ?? null,
            readbackMode: c.readbackMode ?? null,
            fullParticleReadbackPerformed: c.fullParticleReadbackPerformed ?? null
          };
        })()
      };
    })(),
    // A/B'ing ss=1 showed the hydrostatic gradient collapse from 8,826 Pa to
    // 2.3 Pa while the pressure lane's base moved from 0 to 101325. Code
    // tracing could not separate "ambient differs" from "the stress term is
    // near zero", so the resolved values are surfaced and compared directly.
    // Per-stage mechanics snapshots, when the diagnostic flag is set. Null in
    // every normal run.
    stageMechanicsTrace: finalStep?.stageMechanicsTrace
      ?? execution?.stageMechanicsTrace ?? null,
    ambientPressurePa: execution?.ambientPressurePa
      ?? finalStep?.ambientPressurePa ?? null,
    ambientPressureAppliedInStressProjection:
      execution?.ambientPressureAppliedInStressProjection
        ?? finalStep?.ambientPressureAppliedInStressProjection ?? null,
    internalPressureScale: finalStep?.internalPressureScale
      ?? execution?.internalPressureScale ?? null,
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
    if (descriptor?.spareProductSlot === true || descriptor?.phaseCompanionSlot === true) continue;
    const material = descriptor?.material || descriptor?.renderKey || 'unknown';
    counts[material] = (counts[material] || 0) + 1;
  }
  return counts;
}

function materialParticleCountsFromParticles(particles = []) {
  const counts = {};
  for (const particle of particles || []) {
    if (particle?.spareProductSlot === true || !(Number(particle?.massKg) > 0)) continue;
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
  const bodies = pre.materials?.bodies;
  if (Array.isArray(bodies) && bodies.length > 0 && feasibility.finalPhaseByBodyId) {
    return bodies.map((body) => (
      `${body.id}:${materialStatusLabel(body.material)} `
      + `${feasibility.finalPhaseByBodyId[body.id] || 'pending'}`
    )).join(' / ');
  }
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
  const bodies = pre.materials?.bodies;
  if (Array.isArray(bodies) && bodies.length > 0 && masses.byBodyId) {
    const bodyText = bodies.map((body) => (
      `${body.id}:${materialStatusLabel(body.material)} ${fmt(masses.byBodyId[body.id])}`
    )).join('  ');
    return `${bodyText}  air ${fmt(masses.airMassKg)}`;
  }
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
  const bodies = pre.materials?.bodies;
  const byBodyId = pre.particleResolution?.byBodyId;
  if (Array.isArray(bodies) && bodies.length > 0 && byBodyId) {
    return bodies.map((body) => (
      `${body.id}:${materialStatusLabel(body.material)} `
      + `${fmt(byBodyId[body.id]?.entitiesPerMacroParticle)}`
    )).join('  ');
  }
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
  const initialBodyList = Array.isArray(options.initialBodies)
    ? options.initialBodies
    : (options.initialBodies?.bodies || []);
  return [...new Set([
    ...initialBodyList.map((body) => body.material),
    options.dropMaterial,
    options.baseMaterial,
    'h2o',
    'fe',
    'air',
    'h2',
    'o2'
  ].filter(Boolean))];
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

function mountedPressureStringList(values = []) {
  const source = Array.isArray(values) ? values : [];
  return [...new Set(
    source.map((value) => String(value ?? '').trim()).filter(Boolean)
  )];
}

function mountedPressurePositiveInteger(values = [], fallback = 0) {
  for (const value of values) {
    const number = Math.trunc(Number(value));
    if (Number.isFinite(number) && number > 0) return number;
  }
  return Math.max(0, Math.trunc(Number(fallback) || 0));
}

function mountedPressureGasBufferRefs(importDescriptor = null, fieldName) {
  if (!importDescriptor || typeof importDescriptor !== 'object') return [];
  return mountedPressureStringList([
    ...(importDescriptor[fieldName] || []),
    ...(importDescriptor.retainedGasCellFieldSource?.[fieldName] || []),
    ...(importDescriptor.pressureInterfaceGasCellFieldAdmission?.[fieldName] || []),
    ...(importDescriptor.gasCellFieldAdmission?.[fieldName] || []),
    ...(importDescriptor.admission?.[fieldName] || [])
  ]);
}

function mountedPressureLegacySourceKind(source = null, retainedSource = null) {
  const schemas = [
    source?.schema,
    source?.sourceSchema,
    source?.sourceSchroederFarAggregateGasCellImportSchema,
    source?.sourceSchroederFarAggregateGasCellImport?.schema,
    retainedSource?.schema,
    retainedSource?.sourceSchema
  ];
  if (schemas.includes(ULG_SPH_RETAINED_GAS_CELL_EOS_SOURCE_SCHEMA_V1)) {
    return 'standalone-v1';
  }
  if (
    schemas.includes(ULG_SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_SCHEMA)
    || schemas.includes(
      ULG_SCHROEDER_FAR_AGGREGATE_GAS_CELL_IMPORT_EXECUTION_SCHEMA
    )
  ) {
    return 'schroeder-far-aggregate';
  }
  return null;
}

/**
 * Produce the explicitly legacy descriptor accepted by the mounted worker
 * lane. Exact v4 authority remains a same-realm identity and is never cloned,
 * rematerialized, or posted through this cross-thread boundary.
 */
export function resolveMountedWorkerPressureInterfaceGasCellImportDescriptor({
  source = null,
  publication = null,
  device = null
} = {}) {
  if (!source || typeof source !== 'object') return null;
  const exactAuthority = inspectExactSphSpatialGasPressureAuthorityImport(
    source,
    { expectedDevice: device }
  );
  if (
    exactAuthority.exactAuthorityObserved
    || !exactAuthority.graphSafeForLegacyFallback
  ) {
    return null;
  }
  source = exactAuthority.legacyImportDescriptor;
  if (!source) return null;
  const retainedSource = source.retainedGasCellFieldSource
    || source.pressureInterfaceGasCellFieldAdmission?.retainedGasCellFieldSource
    || source.admission?.retainedGasCellFieldSource
    || null;
  if (!mountedPressureLegacySourceKind(source, retainedSource)) return null;
  const admission = source.pressureInterfaceGasCellFieldAdmission
    || source.gasCellFieldAdmission
    || source.admission
    || null;
  const workerRetainedGasPressureBufferRefs =
    mountedPressureGasBufferRefs(source, 'workerRetainedGasPressureBufferRefs');
  const retainedGasPressureBufferRefs =
    mountedPressureGasBufferRefs(source, 'retainedGasPressureBufferRefs');
  const rowCount = mountedPressurePositiveInteger([
    source.pressureInterfaceGasPressureCellRowCount,
    source.gasPressureCellRowCount,
    publication?.pressureInterfaceGasPressureCellRowCount,
    retainedSource?.pressureInterfaceGasPressureCellRowCount
  ]);
  const rowStrideFloats = mountedPressurePositiveInteger([
    source.pressureInterfaceGasPressureCellRowStrideFloats,
    source.gasPressureCellRowStrideFloats,
    publication?.pressureInterfaceGasPressureCellRowStrideFloats,
    retainedSource?.pressureInterfaceGasPressureCellRowStrideFloats
  ], 12);
  const rowByteLength = mountedPressurePositiveInteger([
    source.pressureInterfaceGasPressureCellRowByteLength,
    source.gasPressureCellRowByteLength,
    publication?.pressureInterfaceGasPressureCellRowByteLength,
    retainedSource?.pressureInterfaceGasPressureCellRowByteLength
  ], rowCount * rowStrideFloats * Float32Array.BYTES_PER_ELEMENT);
  const hasRefs = workerRetainedGasPressureBufferRefs.length > 0
    || retainedGasPressureBufferRefs.length > 0;
  const admissionApproved =
    admission?.schema === 'peercompute.ulg.pressure-interface-gas-cell-field-admission.v0'
    && admission?.status
      === 'pressure-interface-gas-cell-field-consumption-approved'
    && admission?.gasCellFieldConsumptionApproved === true;
  const sourceReady =
    source.status === 'pressure-interface-gas-cell-field-import-ready'
    || source.pressureInterfaceImportReady === true
    || publication?.pressureInterfaceGasCellFieldImportReady === true;
  if (
    !sourceReady
    || !admissionApproved
    || !hasRefs
    || rowCount <= 0
    || rowByteLength <= 0
  ) return null;
  const retainedGasCellFieldSource = retainedSource
    ? {
        schema: retainedSource.schema
          || 'peercompute.ulg.pressure-interface-retained-gas-cell-field-source.v0',
        status: retainedSource.status
          || 'pressure-interface-retained-gas-cell-field-source-ready',
        sourceHotBufferKey:
          retainedSource.sourceHotBufferKey
            || source.sourceHotBufferKey
            || publication?.hotBufferKey
            || null,
        sourceTaskId:
          retainedSource.sourceTaskId
            || source.sourceTaskId
            || publication?.sourceTaskId
            || null,
        sourceStage:
          retainedSource.sourceStage
            || source.sourceStage
            || publication?.sourceStage
            || null,
        workerRetainedGasPressureBufferRefs,
        retainedGasPressureBufferRefs,
        pressureInterfaceGasPressureCellRowCount: rowCount,
        pressureInterfaceGasPressureCellRowStrideFloats: rowStrideFloats,
        pressureInterfaceGasPressureCellRowByteLength: rowByteLength,
        pressureInterfaceGasPressureCellRowsBufferRetained: true,
        pressureFieldMode:
          retainedSource.pressureFieldMode || source.pressureFieldMode || null,
        pressureFieldResolution:
          retainedSource.pressureFieldResolution
            || source.pressureFieldResolution
            || null,
        localPressureGradientReady: true,
        localPressureGradientStatus:
          retainedSource.localPressureGradientStatus
            || source.localPressureGradientStatus
            || 'retained-gpu-gas-cell-rows-ready-cpu-snapshot-not-read',
        sourceFamilies: mountedPressureStringList(
          retainedSource.sourceFamilies || ['resident-gas-pressure']
        ),
        stateManagerAdmissionRequired: true,
        authoritativeStateMutation: false
      }
    : null;
  return {
    schema: 'peercompute.ulg.pressure-interface-gas-cell-field-import.v0',
    status: 'pressure-interface-gas-cell-field-import-ready',
    sourceSchema: source.sourceSchema || source.schema || null,
    sourceHotBufferKey: source.sourceHotBufferKey
      || publication?.hotBufferKey
      || null,
    sourceTaskId: source.sourceTaskId || publication?.sourceTaskId || null,
    sourceNodeId: source.sourceNodeId || publication?.sourceNodeId || null,
    sourceStage: source.sourceStage || publication?.sourceStage || null,
    retainedGasPressureBufferRefs,
    workerRetainedGasPressureBufferRefs,
    pressureInterfaceGasPressureCellRowCount: rowCount,
    pressureInterfaceGasPressureCellRowStrideFloats: rowStrideFloats,
    pressureInterfaceGasPressureCellRowByteLength: rowByteLength,
    pressureInterfaceGasPressureCellRowsBufferRetained: true,
    pressureFieldMode: source.pressureFieldMode
      || retainedSource?.pressureFieldMode
      || null,
    pressureFieldResolution: source.pressureFieldResolution
      || retainedSource?.pressureFieldResolution
      || null,
    localPressureGradientStatus:
      source.localPressureGradientStatus
        || retainedSource?.localPressureGradientStatus
        || 'retained-gpu-gas-cell-rows-ready-cpu-snapshot-not-read',
    pressureInterfaceGasCellFieldAdmission: {
      schema: admission.schema,
      status: admission.status,
      gasCellFieldConsumptionApproved: true,
      sourceHotBufferKey: admission.sourceHotBufferKey
        || source.sourceHotBufferKey
        || publication?.hotBufferKey
        || null,
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

export function summarizeMountedPressureInterfaceGasCellImport({
  pressureState = null,
  publication = null,
  importDescriptor = null,
  device = null,
  schroederPromotionStatus = null
} = {}) {
  const exactAuthority = inspectExactSphSpatialGasPressureAuthorityImport(
    importDescriptor,
    { expectedDevice: device }
  );
  if (exactAuthority.exactAuthorityObserved) {
    const description = exactAuthority.exactAuthorityDescription;
    const capacity = exactAuthority.pressureInterfaceGasPressureCellRowCapacity;
    const strideFloats =
      exactAuthority.pressureInterfaceGasPressureCellRowStrideFloats;
    const importReady = exactAuthority.exactAuthorityReady;
    return {
      pressureInterfaceGasCellFieldImportAvailable: importReady,
      pressureInterfaceGasCellFieldImportSchema: description?.sourceSchema || null,
      pressureInterfaceGasCellFieldImportStatus:
        importReady
          ? (description?.sourceStatusObserved || exactAuthority.status)
          : exactAuthority.status,
      pressureInterfaceGasCellFieldImportBoundaryStatus: exactAuthority.status,
      pressureInterfaceGasCellFieldImportSourceHotBufferKey: null,
      pressureInterfaceGasPressureCellRowCount: 0,
      pressureInterfaceGasPressureCellRowCapacity: capacity,
      pressureInterfaceGasPressureCellRowByteLength:
        capacity * strideFloats * Float32Array.BYTES_PER_ELEMENT,
      pressureInterfaceGasPressureCellRowsBufferRetained: importReady,
      pressureInterfaceGasPressureCellLogicalCountGpuAuthored: true,
      pressureInterfaceGasCellFieldImportRetainedGasPressureCellsBuffer: false,
      pressureInterfaceGasCellFieldImportExactAuthority: true,
      pressureInterfaceGasCellFieldImportExactAuthorityReady: importReady,
      pressureInterfaceGasCellFieldImportExactAuthorityCloneable: false,
      schroederPressureInterfaceGasCellFieldImportPromotionStatus:
        schroederPromotionStatus,
      mountedWorkerLanePressureInterfaceGasCellImportTransferStatus:
        importReady
          ? 'main-thread-exact-opaque-authority-kept-local-not-posted-to-worker-lane'
          : 'blocked-main-thread-exact-opaque-authority-import'
    };
  }
  if (!exactAuthority.graphSafeForLegacyFallback) {
    return {
      pressureInterfaceGasCellFieldImportAvailable: false,
      pressureInterfaceGasCellFieldImportSchema: null,
      pressureInterfaceGasCellFieldImportStatus: exactAuthority.status,
      pressureInterfaceGasCellFieldImportBoundaryStatus: exactAuthority.status,
      pressureInterfaceGasCellFieldImportSourceHotBufferKey: null,
      pressureInterfaceGasPressureCellRowCount: 0,
      pressureInterfaceGasPressureCellRowCapacity: 0,
      pressureInterfaceGasPressureCellRowByteLength: 0,
      pressureInterfaceGasPressureCellRowsBufferRetained: false,
      pressureInterfaceGasPressureCellLogicalCountGpuAuthored: false,
      pressureInterfaceGasCellFieldImportRetainedGasPressureCellsBuffer: false,
      pressureInterfaceGasCellFieldImportExactAuthority: false,
      pressureInterfaceGasCellFieldImportExactAuthorityReady: false,
      pressureInterfaceGasCellFieldImportExactAuthorityCloneable: false,
      schroederPressureInterfaceGasCellFieldImportPromotionStatus:
        schroederPromotionStatus,
      mountedWorkerLanePressureInterfaceGasCellImportTransferStatus:
        'no-main-thread-retained-import'
    };
  }
  importDescriptor = exactAuthority.legacyImportDescriptor;
  if (!importDescriptor) {
    return {
      pressureInterfaceGasCellFieldImportAvailable: false,
      pressureInterfaceGasCellFieldImportSchema: null,
      pressureInterfaceGasCellFieldImportStatus:
        'blocked-gas-pressure-legacy-capture-missing',
      pressureInterfaceGasCellFieldImportBoundaryStatus:
        'blocked-gas-pressure-legacy-capture-missing',
      pressureInterfaceGasPressureCellRowCount: 0,
      pressureInterfaceGasPressureCellRowCapacity: 0,
      pressureInterfaceGasPressureCellRowByteLength: 0,
      pressureInterfaceGasPressureCellRowsBufferRetained: false,
      pressureInterfaceGasPressureCellLogicalCountGpuAuthored: false,
      pressureInterfaceGasCellFieldImportRetainedGasPressureCellsBuffer: false,
      pressureInterfaceGasCellFieldImportExactAuthority: false,
      pressureInterfaceGasCellFieldImportExactAuthorityReady: false,
      pressureInterfaceGasCellFieldImportExactAuthorityCloneable: false,
      schroederPressureInterfaceGasCellFieldImportPromotionStatus:
        schroederPromotionStatus,
      mountedWorkerLanePressureInterfaceGasCellImportTransferStatus:
        'no-main-thread-retained-import'
    };
  }
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
    pressureInterfaceGasCellFieldImportSchema:
      importDescriptor?.schema
        || publication?.pressureInterfaceGasCellFieldImportSchema
        || null,
    pressureInterfaceGasCellFieldImportStatus:
      importDescriptor?.status
        || publication?.pressureInterfaceGasCellFieldImportStatus
        || null,
    pressureInterfaceGasCellFieldImportBoundaryStatus: exactAuthority.status,
    pressureInterfaceGasCellFieldImportSourceHotBufferKey:
      importDescriptor?.sourceHotBufferKey
        || publication?.pressureInterfaceGasCellFieldImportSourceHotBufferKey
        || publication?.hotBufferKey
        || null,
    pressureInterfaceGasPressureCellRowCount: rowCount,
    pressureInterfaceGasPressureCellRowCapacity: rowCount,
    pressureInterfaceGasPressureCellRowByteLength: rowByteLength,
    pressureInterfaceGasPressureCellRowsBufferRetained:
      importDescriptor?.pressureInterfaceGasPressureCellRowsBufferRetained === true
      || importDescriptor?.gasPressureCellRowsBufferRetained === true,
    pressureInterfaceGasPressureCellLogicalCountGpuAuthored: false,
    pressureInterfaceGasCellFieldImportRetainedGasPressureCellsBuffer:
      Boolean(
        importDescriptor?.retainedGasPressureCellsBuffer
          || importDescriptor?.gasPressureCellsBuffer
          || importDescriptor?.pressureInterfaceGasPressureCellsBuffer
      ),
    pressureInterfaceGasCellFieldImportExactAuthority: false,
    pressureInterfaceGasCellFieldImportExactAuthorityReady: false,
    pressureInterfaceGasCellFieldImportExactAuthorityCloneable: false,
    schroederPressureInterfaceGasCellFieldImportPromotionStatus:
      schroederPromotionStatus,
    mountedWorkerLanePressureInterfaceGasCellImportTransferStatus: importReady
      ? 'main-thread-retained-import-observed-not-posted-to-worker-lane'
      : 'no-main-thread-retained-import'
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

const SPH_PENDING_BODY_ENVELOPE_EDGE_PAIRS = Object.freeze([
  [0, 1], [0, 2], [0, 4],
  [1, 3], [1, 5], [2, 3], [2, 6],
  [3, 7], [4, 5], [4, 6], [5, 7], [6, 7]
]);
const SPH_PENDING_BODY_ENVELOPE_FACE_INDICES = Object.freeze([
  [2, 3, 7, 6],
  [0, 1, 3, 2],
  [1, 5, 7, 3]
]);
const SPH_PENDING_BODY_ENVELOPE_COLORS = Object.freeze([
  '#75f7b4', '#75c7f7', '#f7c675', '#d5a8ff', '#ff9c9c', '#8ee7e7'
]);

function sphPendingBodyEnvelopeCorners(minM, maxM) {
  return [
    [minM[0], minM[1], minM[2]],
    [maxM[0], minM[1], minM[2]],
    [minM[0], maxM[1], minM[2]],
    [maxM[0], maxM[1], minM[2]],
    [minM[0], minM[1], maxM[2]],
    [maxM[0], minM[1], maxM[2]],
    [minM[0], maxM[1], maxM[2]],
    [maxM[0], maxM[1], maxM[2]]
  ];
}

function projectSphPendingBodyEnvelopePoint(pointM, boxDimsM) {
  const x = pointM[0] / boxDimsM[0];
  const y = pointM[1] / boxDimsM[1];
  const z = pointM[2] / boxDimsM[2];
  return [
    500 + (x - z) * 300,
    690 - y * 500 + (x + z - 1) * 100
  ];
}

function appendSphPendingBodyEnvelopeLine(documentRef, parent, from, to, {
  color,
  width = 2,
  opacity = 1
} = {}) {
  const line = documentRef.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', String(from[0]));
  line.setAttribute('y1', String(from[1]));
  line.setAttribute('x2', String(to[0]));
  line.setAttribute('y2', String(to[1]));
  line.setAttribute('stroke', color);
  line.setAttribute('stroke-width', String(width));
  line.setAttribute('stroke-opacity', String(opacity));
  line.setAttribute('vector-effect', 'non-scaling-stroke');
  parent.appendChild(line);
}

function renderSphPendingBodyEnvelopePreview(layer, preview) {
  const svg = layer?.querySelector?.('#sph-pending-body-envelope');
  const title = layer?.querySelector?.('#sph-pending-presentation-title');
  const detail = layer?.querySelector?.('#sph-pending-presentation-detail');
  const documentRef = layer?.ownerDocument;
  if (!svg || !documentRef || !preview?.schema) return false;
  svg.replaceChildren();
  svg.setAttribute('viewBox', '0 0 1000 1000');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', preview.description);

  const containerCorners = sphPendingBodyEnvelopeCorners([0, 0, 0], preview.boxDimsM)
    .map((point) => projectSphPendingBodyEnvelopePoint(point, preview.boxDimsM));
  for (const [fromIndex, toIndex] of SPH_PENDING_BODY_ENVELOPE_EDGE_PAIRS) {
    appendSphPendingBodyEnvelopeLine(
      documentRef,
      svg,
      containerCorners[fromIndex],
      containerCorners[toIndex],
      { color: '#1d8b6d', width: 1.5, opacity: 0.5 }
    );
  }

  for (const body of preview.bodies) {
    const color = SPH_PENDING_BODY_ENVELOPE_COLORS[
      body.bodyOrder % SPH_PENDING_BODY_ENVELOPE_COLORS.length
    ];
    const corners = sphPendingBodyEnvelopeCorners(body.minM, body.maxM)
      .map((point) => projectSphPendingBodyEnvelopePoint(point, preview.boxDimsM));
    for (const indices of SPH_PENDING_BODY_ENVELOPE_FACE_INDICES) {
      const polygon = documentRef.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      polygon.setAttribute(
        'points',
        indices.map((index) => corners[index].join(',')).join(' ')
      );
      polygon.setAttribute('fill', color);
      polygon.setAttribute('fill-opacity', '0.1');
      svg.appendChild(polygon);
    }
    for (const [fromIndex, toIndex] of SPH_PENDING_BODY_ENVELOPE_EDGE_PAIRS) {
      appendSphPendingBodyEnvelopeLine(
        documentRef,
        svg,
        corners[fromIndex],
        corners[toIndex],
        { color, width: 3, opacity: 0.95 }
      );
    }
    const projectedCenter = projectSphPendingBodyEnvelopePoint(body.centerM, preview.boxDimsM);
    const label = documentRef.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', String(projectedCenter[0]));
    label.setAttribute('y', String(projectedCenter[1] - 12));
    label.setAttribute('fill', color);
    label.setAttribute('font-size', '24');
    label.setAttribute('font-family', 'ui-monospace, monospace');
    label.setAttribute('font-weight', '700');
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('paint-order', 'stroke');
    label.setAttribute('stroke', '#071114');
    label.setAttribute('stroke-width', '7');
    label.setAttribute('stroke-linejoin', 'round');
    label.textContent = `${body.material} · ${body.id}`;
    svg.appendChild(label);
  }

  if (title) title.textContent = preview.label;
  if (detail) detail.textContent = preview.description;
  layer.dataset.status = preview.status;
  layer.dataset.previewSerial = String(preview.previewSerial ?? '');
  layer.dataset.bodyCount = String(preview.bodyCount);
  layer.hidden = false;
  layer.setAttribute('aria-busy', 'true');
  return true;
}

function hideSphPendingBodyEnvelopePreview(layer) {
  if (!layer) return false;
  layer.hidden = true;
  layer.setAttribute('aria-busy', 'false');
  layer.dataset.status = 'physics-presentation-current';
  return true;
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
      .sph-initial-bodies-box { margin:10px 0 8px;padding:8px;border:1px solid #245447;background:rgba(5,18,20,.66); }
      .sph-initial-bodies-head { display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:5px; }
      #sph-phase-overlay .sph-add-body { margin:0!important;min-height:34px;padding:5px 9px; }
      .sph-initial-bodies-help { color:#75c7f7;font-size:10px;line-height:1.35;opacity:.82;margin:0 0 7px; }
      .sph-initial-bodies-list { display:flex;flex-direction:column;gap:8px; }
      .sph-initial-body-card { border:1px solid #14342c;background:#071114;padding:8px; }
      .sph-initial-body-card-head { display:flex;align-items:flex-start;justify-content:space-between;gap:7px;margin-bottom:7px; }
      .sph-initial-body-title { color:#75f7b4;font-size:12px;font-weight:700;overflow-wrap:anywhere; }
      .sph-initial-body-domain { color:#75c7f7;font-size:9px;margin-top:2px; }
      .sph-initial-body-actions { display:flex;flex-wrap:wrap;justify-content:flex-end;gap:3px; }
      #sph-phase-overlay .sph-initial-body-action { margin:0!important;min-height:30px;min-width:31px;padding:3px 6px;font-size:11px; }
      .sph-initial-body-grid { display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px; }
      .sph-initial-body-field { display:flex;flex-direction:column;gap:2px;min-width:0;color:#75c7f7;font-size:9px; }
      .sph-initial-body-field input { width:100%;padding:3px;background:#0a1418;color:#bfe9d8;border:1px solid #14342c; }
      .sph-initial-body-derived { min-height:36px;display:flex;align-items:center;padding:3px 6px;box-sizing:border-box;background:#081216;color:#9fcaba;border:1px dashed #245447;font-size:12px;overflow-wrap:anywhere; }
      .sph-initial-body-row-label { grid-column:1/-1;color:#75c7f7;font-size:10px;margin-top:3px; }
      .sph-initial-body-material { grid-column:1/-1; }
      .sph-initial-body-velocity { grid-column:1/-1;border:1px solid #14342c;padding:5px;margin-top:3px; }
      .sph-advanced-controls { margin:10px 0 8px;border:1px solid #245447;background:rgba(5,18,20,.66);padding:7px; }
      .sph-advanced-controls > summary { cursor:pointer;color:#75f7b4;font-size:11px;font-weight:700; }
      .sph-advanced-grid { display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:7px; }
      .sph-advanced-grid > label { display:flex;flex-direction:column;gap:3px;color:#75c7f7;font-size:10px;min-width:0; }
      .sph-advanced-checks { display:grid;grid-template-columns:1fr;gap:3px;margin-top:7px; }
      .sph-advanced-checks > label { display:flex;align-items:center;gap:7px;color:#bfe9d8;font-size:10px;min-height:25px; }
      .sph-advanced-checks input[type="checkbox"] { width:16px;height:16px;accent-color:#1d8b6d; }
      .sph-initial-body-velocity summary { color:#75c7f7;font-size:10px;cursor:pointer; }
      .sph-initial-body-error { display:none;border:1px solid #f7c675;background:rgba(46,30,8,.92);color:#ffe7b2;padding:5px;margin:0 0 7px;font-size:10px;line-height:1.35; }
      .sph-initial-body-error.visible { display:block; }
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
      #sph-lighting-toggle { position:absolute;bottom:12px;left:12px;z-index:72; }
      #sph-lighting-toggle[aria-pressed="true"] { border-color:#f7c675;color:#ffe7b2;background:#261d0b; }
      #sph-pending-presentation { position:absolute;inset:0;z-index:8;pointer-events:none;display:flex;align-items:flex-end;justify-content:center;padding:24px 18px 70px;box-sizing:border-box;background:radial-gradient(circle at 50% 55%,rgba(17,48,48,.2),rgba(4,7,10,0) 58%); }
      #sph-pending-presentation[hidden] { display:none; }
      #sph-pending-body-envelope { position:absolute;inset:6% 5% 9%;width:90%;height:85%;overflow:visible;filter:drop-shadow(0 0 7px rgba(117,247,180,.2)); }
      .sph-pending-presentation-label { position:relative;display:flex;flex-direction:column;align-items:center;gap:4px;max-width:min(620px,86vw);padding:8px 12px;border:1px solid #1d8b6d;background:rgba(4,12,14,.9);color:#bfe9d8;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,.35); }
      .sph-pending-presentation-title { color:#75f7b4;font-weight:800;letter-spacing:.08em;text-transform:uppercase; }
      .sph-pending-presentation-detail { color:#75c7f7;font-size:11px;line-height:1.35; }
      #sph-warning-bar { position:absolute;top:0;left:0;right:0;z-index:65;display:flex;flex-wrap:wrap;gap:6px;align-items:flex-start;padding:8px 12px 8px 128px;box-sizing:border-box;pointer-events:none; }
      .sph-warning-chip { border:1px solid #f7c675;background:rgba(46,30,8,.92);color:#ffe7b2;padding:4px 7px;font-size:11px;line-height:1.25; }
      .sph-fps-chip { border:1px solid #1d8b6d;background:rgba(4,12,14,.88);color:#75f7b4;padding:4px 7px;font-size:11px;line-height:1.25;max-width:calc(100vw - 152px);white-space:normal;overflow-wrap:anywhere; }
      @media (max-width:700px) { #sph-panel { width:min(340px,92vw); } #sph-status { font-size:13px; } #sph-warning-bar { padding-left:118px;padding-right:8px; } .sph-fps-chip { max-width:calc(100vw - 134px);font-size:10px; } .sph-warning-chip { max-width:calc(100vw - 24px); } .sph-element-grid { grid-template-columns:repeat(18,42px);grid-auto-rows:42px; } #sph-phase-overlay .sph-element-cell { min-height:42px; } .sph-element-name { display:none; } }
    </style>
    <div id="sph-scene" style="position:absolute;inset:0;"></div>
    <div id="sph-pending-presentation" aria-live="polite" aria-busy="true">
      <svg id="sph-pending-body-envelope" aria-hidden="true"></svg>
      <div class="sph-pending-presentation-label">
        <strong id="sph-pending-presentation-title" class="sph-pending-presentation-title">initializing simulation</strong>
        <span id="sph-pending-presentation-detail" class="sph-pending-presentation-detail">acquiring the GPU and validating initial material bodies…</span>
      </div>
    </div>
    <div id="sph-warning-bar" aria-live="polite">
      <span id="sph-fps" class="sph-fps-chip">render fps -- | physics fps --</span>
    </div>
    <button id="sph-toggle" type="button" aria-label="Toggle controls">☰ menu</button>
    <button id="sph-lighting-toggle" type="button" aria-label="Toggle dark-lab lighting" aria-pressed="false">☾ dark lab</button>
    <aside id="sph-panel" style="position:absolute;top:0;right:0;height:100%;width:min(360px,92vw);box-sizing:border-box;border-left:1px solid #14342c;padding:14px;padding-top:56px;overflow:auto;-webkit-overflow-scrolling:touch;background:rgba(5,11,14,0.96);z-index:55;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
        <strong style="color:#75f7b4;">SPH PHASE — material bodies interacting</strong>
        <button id="sph-close" type="button">close</button>
      </div>
      <p style="opacity:.6;font-size:11px;line-height:1.4;">Strict first-principles mode. The demo will not run reference or reduced material constants as physics; missing condensed, liquid, optical, or product closures are reported as blockers.</p>
      <div style="margin:8px 0;display:flex;flex-wrap:wrap;">
        <button id="sph-preflight" type="button">Validate &amp; Apply</button>
        <button id="sph-play" type="button" disabled>Play</button>
        <button id="sph-step" type="button" disabled>Step</button>
        <button id="sph-reset" type="button" disabled>Reset</button>
        <button id="sph-clear-cache" type="button">Clear Cache</button>
      </div>
      <div style="font-size:11px;color:#75c7f7;margin-top:6px;">scenario preset — reload-applied</div>
      <div id="sph-scenario-preset" style="display:grid;grid-template-columns:1fr;gap:6px;margin:4px 0 8px 0;"></div>
      <div style="font-size:11px;color:#75c7f7;margin-top:6px;">lighting — live</div>
      <div id="sph-lighting-mode" style="display:grid;grid-template-columns:1fr;gap:6px;margin:4px 0 8px 0;"></div>
      <div style="font-size:11px;color:#75c7f7;margin-top:6px;">mechanics integrator — reload-applied</div>
      <div id="sph-mechanics-mode" style="display:grid;grid-template-columns:1fr;gap:6px;margin:4px 0 8px 0;"></div>
      <div style="font-size:11px;color:#75c7f7;margin-top:6px;">physical law groups — staged; Apply, Play, or Step commits</div>
      <div id="sph-laws" style="display:grid;grid-template-columns:1fr;gap:4px;margin:4px 0 8px 0;"></div>
      <div style="font-size:11px;color:#75c7f7;margin-top:6px;">wall temperatures (K) — staged; Apply, Play, or Step commits</div>
      <div id="sph-walls" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:4px 0;"></div>
      <section class="sph-initial-bodies-box" aria-labelledby="sph-initial-bodies-label">
        <div class="sph-initial-bodies-head">
          <strong id="sph-initial-bodies-label" style="font-size:11px;color:#75f7b4;">initial material bodies</strong>
          <button id="sph-add-body" class="sph-add-body" type="button">+ add body</button>
        </div>
        <p class="sph-initial-bodies-help">Particle count per edge is the geometry control. Physical size is derived from the body's existing per-axis particle pitch; body identity remains stable when reordered.</p>
        <div id="sph-initial-bodies-error" class="sph-initial-body-error" role="alert"></div>
        <div id="sph-initial-bodies" class="sph-initial-bodies-list"></div>
      </section>
      <div id="sph-legacy-body-controls" hidden style="display:none;">
        <div style="font-size:11px;color:#75c7f7;margin-top:6px;">legacy materials</div>
        <div id="sph-elements" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:4px 0;"></div>
        <div style="font-size:11px;color:#75c7f7;margin-top:6px;">legacy initial temperature (K)</div>
        <div id="sph-temps" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:4px 0;"></div>
        <div style="font-size:11px;color:#75c7f7;margin-top:6px;">legacy block height (m, bottom face)</div>
        <div id="sph-heights" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:4px 0;"></div>
        <div style="font-size:11px;color:#75c7f7;margin-top:6px;">legacy particles per block edge</div>
        <div id="sph-counts" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:4px 0;"></div>
      </div>
      <div style="font-size:11px;color:#75c7f7;margin-top:6px;">container box size (m, X·Y·Z) — staged</div>
      <div id="sph-box" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin:4px 0;"></div>
      <div style="font-size:11px;color:#75c7f7;margin-top:6px;">isosurface blob size (× — independent of box) — live</div>
      <div id="sph-blob" style="display:grid;grid-template-columns:1fr;gap:6px;margin:4px 0;"></div>
      <div style="font-size:11px;color:#75c7f7;margin-top:6px;">render mode — live within a backend; cross-backend changes reload</div>
      <div id="sph-render-mode" style="display:grid;grid-template-columns:1fr;gap:6px;margin:4px 0;"></div>
      <div style="font-size:11px;color:#75c7f7;margin-top:6px;">background — live (local images stay on this device)</div>
      <div id="sph-background-color" style="display:grid;grid-template-columns:1fr;gap:6px;margin:4px 0;"></div>
      <details id="sph-advanced-controls" class="sph-advanced-controls">
        <summary>advanced architecture &amp; execution</summary>
        <div style="font-size:10px;color:#8fc7b2;margin-top:7px;line-height:1.35;">Architecture changes are serialized into the URL and reload atomically so the UI, worker lane, SS hierarchy, and presentation owner cannot disagree.</div>
        <div class="sph-advanced-grid">
          <label>architecture profile<div id="sph-architecture-profile"></div></label>
          <label>two-level authority<div id="sph-two-level-authority"></div></label>
        </div>
        <div id="sph-architecture-toggles" class="sph-advanced-checks"></div>
        <div id="sph-execution-controls" class="sph-advanced-grid"></div>
      </details>
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
  if (key === 'lighting') return normalizeSphSceneLightingMode(value);
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
  peercomputeModule = undefined,
  peercomputeModuleUrl = undefined,
  residentComputeTaskModulePath = undefined,
  residentMechanicsStageWorkerModuleUrl = undefined,
  enableRemoteResidentTaskGraphRefresh = false,
  remoteResidentTaskGraph = null,
  remoteResidentTaskGraphFactory = null,
  remoteResidentTaskGraphOptions = null,
  remoteResidentTaskGraphRefreshOptions = null
} = {}) {
  const overlay = buildOverlayShell();
  document.body.appendChild(overlay);
  const bootstrapPresentation = document.querySelector('#sph-bootstrap-presentation');
  if (bootstrapPresentation) {
    bootstrapPresentation.hidden = true;
    bootstrapPresentation.setAttribute('aria-busy', 'false');
    bootstrapPresentation.dataset.status = 'handed-off-to-sph-overlay';
  }
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

  const architectureProfileEl = overlay.querySelector('#sph-architecture-profile');
  const architectureProfileSelect = document.createElement('select');
  architectureProfileSelect.setAttribute('aria-label', 'Choose SS architecture profile');
  for (const [value, label] of [
    ['preset', 'Preset defaults'],
    ['ss-single-worker', 'SS worker · single-level'],
    ['ss-two-authoritative-worker', 'SS worker · two-level authoritative'],
    ['ss-two-observation-worker', 'SS worker · two-level observation'],
    ['main-thread-diagnostic', 'Main-thread diagnostic'],
    ['custom', 'Custom architecture']
  ]) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    if (value === 'custom') option.disabled = true;
    architectureProfileSelect.appendChild(option);
  }
  architectureProfileEl.appendChild(architectureProfileSelect);

  const twoLevelAuthorityEl = overlay.querySelector('#sph-two-level-authority');
  const twoLevelAuthoritySelect = document.createElement('select');
  twoLevelAuthoritySelect.setAttribute('aria-label', 'Choose two-level mechanics authority');
  for (const [value, label] of [
    ['observation', 'Observation'],
    ['authoritative', 'Authoritative']
  ]) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    twoLevelAuthoritySelect.appendChild(option);
  }
  twoLevelAuthorityEl.appendChild(twoLevelAuthoritySelect);

  const architectureTogglesEl = overlay.querySelector('#sph-architecture-toggles');
  const architectureInputs = {};
  const appendArchitectureToggle = (key, label, checked = false) => {
    const wrap = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = checked;
    input.dataset.architectureControl = key;
    const text = document.createElement('span');
    text.textContent = label;
    wrap.append(input, text);
    architectureTogglesEl.appendChild(wrap);
    architectureInputs[key] = input;
  };
  appendArchitectureToggle('ss', 'Enable Schroeder hierarchy', false);
  appendArchitectureToggle('schroederTwoLevel', 'Two-level mechanics', false);
  appendArchitectureToggle('schroederActiveNodeIndex', 'Active-node index', true);
  appendArchitectureToggle('schroederActiveNodeSortedIndex', 'Sorted active-node index', true);
  appendArchitectureToggle('schroederLawQueue', 'Local law queue', true);
  appendArchitectureToggle('schroederLawNeighborCandidates', 'Law-neighbor candidates', true);
  appendArchitectureToggle(
    'schroederCrossLevelCoupling',
    'Generic coupling candidates (observation only)',
    false
  );
  appendArchitectureToggle('schroederPhaseVolumeMigration', 'Phase-volume migration proposals', true);
  appendArchitectureToggle('schroederMechanicsFieldPairV2', 'Paired two-level mechanics fields', false);
  appendArchitectureToggle('contactSolver', 'Contact solver (off = contact-free bulk)', true);
  appendArchitectureToggle('surfaceOverlay', 'Show native surface/debug overlay', false);
  appendArchitectureToggle('workerParticleOverlay', 'Show worker particle/debug overlay', false);

  const executionControlsEl = overlay.querySelector('#sph-execution-controls');
  const executionInputs = {};
  const appendExecutionNumber = ({ key, label, value, min, max, step }) => {
    const wrap = document.createElement('label');
    wrap.textContent = label;
    const input = document.createElement('input');
    input.type = 'number';
    input.value = String(value);
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.dataset.architectureControl = key;
    input.style.cssText = 'width:100%;background:#0a1418;color:#bfe9d8;border:1px solid #14342c;';
    wrap.appendChild(input);
    executionControlsEl.appendChild(wrap);
    executionInputs[key] = input;
  };
  appendExecutionNumber({
    key: 'schroederTwoLevelSubsteps', label: 'fine substeps / macro step', value: 2,
    min: 1, max: 4, step: 1
  });
  appendExecutionNumber({
    key: 'residentStepsPerSchedule', label: 'authenticated steps / worker schedule',
    // Match currentResidentStepsPerSchedule()'s interactive SS default.  A
    // preset may still request a larger authenticated batch (for example the
    // sodium 64-step contact horizon), but an untouched control must describe
    // the schedule that this mount will actually submit.
    value: RESIDENT_STEPS_PER_SCHEDULE_MAX,
    min: 1, max: 128, step: 1
  });
  const residentScheduleEffectiveEl = document.createElement('output');
  residentScheduleEffectiveEl.id = 'sph-resident-schedule-effective';
  residentScheduleEffectiveEl.setAttribute('aria-live', 'polite');
  residentScheduleEffectiveEl.style.cssText =
    'grid-column:1/-1;color:#8fc7b2;font-size:10px;line-height:1.35;';
  residentScheduleEffectiveEl.textContent = 'effective schedule: resolving policy…';
  executionControlsEl.appendChild(residentScheduleEffectiveEl);
  appendExecutionNumber({ key: 'cfl', label: 'CFL factor', value: 0.6, min: 0.01, max: 2, step: 0.05 });
  appendExecutionNumber({ key: 'cflSafety', label: 'CFL stiffness safety', value: 0.4, min: 0.01, max: 2, step: 0.05 });

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

  const lightingModeEl = overlay.querySelector('#sph-lighting-mode');
  const lightingQuickToggle = overlay.querySelector('#sph-lighting-toggle');
  const lightingModeSelect = document.createElement('select');
  lightingModeSelect.title = 'Choose scene lighting';
  lightingModeSelect.setAttribute('aria-label', 'Choose scene lighting');
  for (const [value, label] of [
    [SPH_SCENE_LIGHTING_MODE_DEFAULT, 'Lighting: normal'],
    ['dark-lab', 'Dark lab — dim ambient only']
  ]) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    lightingModeSelect.appendChild(option);
  }
  lightingModeEl.appendChild(lightingModeSelect);

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
  const localBackgroundImageOption = document.createElement('option');
  localBackgroundImageOption.value = SPH_LOCAL_BACKGROUND_IMAGE_CONTROL_VALUE;
  localBackgroundImageOption.textContent = 'Custom image (local session)';
  localBackgroundImageOption.hidden = true;
  localBackgroundImageOption.disabled = true;
  backgroundImageSelect.appendChild(localBackgroundImageOption);
  backgroundColorEl.appendChild(backgroundImageSelect);

  const localBackgroundImageRow = document.createElement('div');
  localBackgroundImageRow.style.cssText = 'display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;align-items:center;';
  const localBackgroundImageInput = document.createElement('input');
  localBackgroundImageInput.id = 'sph-background-image-file';
  localBackgroundImageInput.type = 'file';
  localBackgroundImageInput.accept = SPH_LOCAL_BACKGROUND_IMAGE_MIME_TYPES.join(',');
  localBackgroundImageInput.title = 'Choose a local background image; the file stays in this browser session';
  localBackgroundImageInput.setAttribute('aria-label', 'Choose a local background image');
  localBackgroundImageInput.style.cssText = 'min-width:0;width:100%;font-size:11px;color:#bfe9d8;';
  const clearBackgroundImageButton = document.createElement('button');
  clearBackgroundImageButton.id = 'sph-background-image-clear';
  clearBackgroundImageButton.type = 'button';
  clearBackgroundImageButton.textContent = 'clear image';
  clearBackgroundImageButton.title = 'Restore the solid background color';
  clearBackgroundImageButton.disabled = true;
  localBackgroundImageRow.append(localBackgroundImageInput, clearBackgroundImageButton);
  backgroundColorEl.appendChild(localBackgroundImageRow);

  const localBackgroundImageStatus = document.createElement('output');
  localBackgroundImageStatus.id = 'sph-background-image-status';
  localBackgroundImageStatus.setAttribute('role', 'status');
  localBackgroundImageStatus.setAttribute('aria-live', 'polite');
  localBackgroundImageStatus.style.cssText = 'min-height:1.25em;font-size:10px;line-height:1.25;color:#8fc7b2;overflow-wrap:anywhere;';
  localBackgroundImageStatus.textContent = 'Local images stay on this device and last for this session only.';
  backgroundColorEl.appendChild(localBackgroundImageStatus);

  let localBackgroundImageObjectUrl = null;
  let pendingLocalBackgroundImageObjectUrl = null;
  let localBackgroundImageFileName = null;
  let localBackgroundImageFileType = null;
  let localBackgroundImageFileSizeBytes = 0;
  let localBackgroundImageLoadGeneration = 0;
  const revokedLocalBackgroundImageObjectUrls = new Set();

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

  const initialBodiesEl = overlay.querySelector('#sph-initial-bodies');
  const initialBodiesErrorEl = overlay.querySelector('#sph-initial-bodies-error');
  const addInitialBodyButton = overlay.querySelector('#sph-add-body');
  let currentInitialBodies = null;
  let initialBodiesEditorReady = false;
  let stopPlaybackForInvalidInitialBodyDraft = null;
  let interactiveSimulationStateReady = false;
  let syncSphInteractiveControlAvailability = () => {};
  addInitialBodyButton.disabled = true;
  initialBodiesEl.inert = true;

  function setInitialBodiesEditorError(error = null, { blocksSimulation = false } = {}) {
    const message = error == null
      ? ''
      : (error instanceof Error ? error.message : String(error));
    initialBodiesErrorEl.textContent = message;
    initialBodiesErrorEl.classList.toggle('visible', message.length > 0);
    overlay.__sphInitialBodiesEditorError = message || null;
    const draftInvalid = Boolean(message && blocksSimulation);
    overlay.__sphInitialBodiesDraftInvalid = draftInvalid;
    syncSphInteractiveControlAvailability();
    if (draftInvalid) stopPlaybackForInvalidInitialBodyDraft?.();
  }

  function validateInitialBodiesEditorState(value) {
    const normalized = normalizeSphInitialBodies(value);
    const preflight = preflightSphInitialBodiesForSimulation(normalized);
    if (!preflight.feasible) {
      throw new RangeError(
        `Initial-body spatial preflight blocked: ${preflight.blockers.join(', ')}`
      );
    }
    const boxDimensionsM = boxDimensionsFromControls();
    const toleranceM = Math.max(1e-9, Math.max(...boxDimensionsM) * 1e-9);
    for (const body of normalized.bodies) {
      for (let axis = 0; axis < 3; axis += 1) {
        const minM = body.centerM[axis] - body.sizeM[axis] / 2;
        const maxM = body.centerM[axis] + body.sizeM[axis] / 2;
        if (minM < -toleranceM || maxM > boxDimensionsM[axis] + toleranceM) {
          throw new RangeError(
            `Initial body '${body.id}' is outside container axis ${axis}: `
            + `[${minM}, ${maxM}] is not within [0, ${boxDimensionsM[axis]}]`
          );
        }
      }
    }
    return normalized;
  }

  function legacyInitialBodiesFromProxyControls() {
    const scenario = scenarioFromControls();
    const safeParticleEdge = (input, fallback) => {
      const value = Math.round(Number(input.value));
      return Number.isFinite(value) && value >= 1 ? value : fallback;
    };
    const safeNumber = (input, fallback) => {
      const value = Number(input.value);
      return Number.isFinite(value) ? value : fallback;
    };
    const baseParticlesPerEdge = safeParticleEdge(countInputs.base, BASE_PARTICLE_EDGE_DEFAULT);
    const dropParticlesPerEdge = safeParticleEdge(countInputs.drop, DROP_PARTICLE_EDGE_DEFAULT);
    return sphInitialBodiesFromLegacyPhaseControls({
      baseMaterial: elementSelects.base.value,
      dropMaterial: elementSelects.drop.value,
      baseTemperatureK: safeNumber(tempInputs.base, BASE_TEMP_DEFAULT_K),
      dropTemperatureK: safeNumber(tempInputs.drop, DROP_TEMP_DEFAULT_K),
      baseParticlesPerEdge,
      dropParticlesPerEdge,
      referenceBaseEdgeM: scenario.referenceGeometry.iceEdgeM,
      referenceBaseParticlesPerEdge: BASE_PARTICLE_EDGE_DEFAULT,
      sceneLengthScale: initialSceneLengthScale,
      referenceBoxDimensionsM:
        scenario.referenceGeometry.boxDimensionsM,
      referenceBaseBottomM:
        safeNumber(heightInputs.ice, ICE_BASE_DEFAULT_M),
      referenceDropBottomM:
        safeNumber(heightInputs.iron, IRON_BASE_DEFAULT_M)
    });
  }

  function appendInitialBodyNumberField(container, {
    bodyId,
    field,
    axis = null,
    label,
    value,
    min = null,
    step = 'any'
  }) {
    const wrap = document.createElement('label');
    wrap.className = 'sph-initial-body-field';
    wrap.textContent = label;
    const input = document.createElement('input');
    input.type = 'number';
    const numericValue = Number(value);
    input.value = Number.isFinite(numericValue)
      ? String(Number(numericValue.toPrecision(12)))
      : String(value);
    input.step = String(step);
    if (min != null) input.min = String(min);
    input.dataset.bodyId = bodyId;
    input.dataset.bodyField = field;
    if (axis != null) input.dataset.axis = String(axis);
    wrap.appendChild(input);
    container.appendChild(wrap);
    return input;
  }

  function createInitialBodyActionButton({ action, bodyId, text, label, disabled = false }) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'sph-initial-body-action';
    button.dataset.bodyAction = action;
    button.dataset.bodyId = bodyId;
    button.textContent = text;
    button.title = label;
    button.setAttribute('aria-label', label);
    button.disabled = disabled;
    return button;
  }

  function createInitialBodyCard(body, index, bodyCount) {
    const card = document.createElement('article');
    card.className = 'sph-initial-body-card';
    card.dataset.bodyId = body.id;

    const head = document.createElement('div');
    head.className = 'sph-initial-body-card-head';
    const titleWrap = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'sph-initial-body-title';
    title.textContent = body.legacyRole ? `${body.id} (${body.legacyRole})` : body.id;
    const domain = document.createElement('div');
    domain.className = 'sph-initial-body-domain';
    const bodyParticleCount = body.particlesPerEdge.reduce(
      (count, particlesPerAxis) => count * particlesPerAxis,
      1
    );
    domain.textContent = `domain ${body.domainId} · ${bodyParticleCount.toLocaleString()} particles`;
    titleWrap.append(title, domain);
    const actions = document.createElement('div');
    actions.className = 'sph-initial-body-actions';
    actions.append(
      createInitialBodyActionButton({
        action: 'move-up', bodyId: body.id, text: '↑',
        label: `Move ${body.id} up`, disabled: index === 0
      }),
      createInitialBodyActionButton({
        action: 'move-down', bodyId: body.id, text: '↓',
        label: `Move ${body.id} down`, disabled: index === bodyCount - 1
      }),
      createInitialBodyActionButton({
        action: 'duplicate', bodyId: body.id, text: 'copy',
        label: `Duplicate ${body.id}`
      }),
      createInitialBodyActionButton({
        action: 'remove', bodyId: body.id, text: '−',
        label: `Remove ${body.id}`, disabled: bodyCount <= 1
      })
    );
    head.append(titleWrap, actions);

    const grid = document.createElement('div');
    grid.className = 'sph-initial-body-grid';
    const materialWrap = document.createElement('label');
    materialWrap.className = 'sph-initial-body-field sph-initial-body-material';
    materialWrap.textContent = 'material';
    const materialRow = document.createElement('div');
    materialRow.className = 'sph-material-row';
    const materialSelect = document.createElement('select');
    materialSelect.className = 'sph-material-select';
    materialSelect.dataset.bodyId = body.id;
    materialSelect.dataset.bodyField = 'material';
    let materialOptionFound = false;
    for (const option of MATERIAL_OPTIONS) {
      const item = document.createElement('option');
      item.value = option.key;
      item.textContent = option.label;
      if (option.key === body.material) {
        item.selected = true;
        materialOptionFound = true;
      }
      materialSelect.appendChild(item);
    }
    if (!materialOptionFound) {
      const item = document.createElement('option');
      item.value = body.material;
      item.textContent = `${body.material} (custom)`;
      item.selected = true;
      materialSelect.prepend(item);
    }
    const pickerButton = document.createElement('button');
    pickerButton.type = 'button';
    pickerButton.className = 'sph-picker-button';
    pickerButton.textContent = 'PT';
    pickerButton.title = `Open periodic table for ${body.id}`;
    pickerButton.setAttribute('aria-label', `Open periodic table for ${body.id}`);
    pickerButton.addEventListener('click', () => openElementPicker({
      overlay,
      select: materialSelect,
      roleLabel: body.id
    }));
    materialRow.append(materialSelect, pickerButton);
    materialWrap.appendChild(materialRow);
    grid.appendChild(materialWrap);

    const appendVector = ({ title: rowTitle, field, values, labels, min = null, step = 'any' }) => {
      const rowLabel = document.createElement('div');
      rowLabel.className = 'sph-initial-body-row-label';
      rowLabel.textContent = rowTitle;
      grid.appendChild(rowLabel);
      values.forEach((value, axis) => appendInitialBodyNumberField(grid, {
        bodyId: body.id,
        field,
        axis,
        label: labels[axis],
        value,
        min,
        step
      }));
    };
    const appendDerivedVector = ({ title: rowTitle, field, values, labels }) => {
      const rowLabel = document.createElement('div');
      rowLabel.className = 'sph-initial-body-row-label';
      rowLabel.textContent = rowTitle;
      grid.appendChild(rowLabel);
      values.forEach((value, axis) => {
        const wrap = document.createElement('label');
        wrap.className = 'sph-initial-body-field';
        wrap.textContent = labels[axis];
        const output = document.createElement('output');
        output.className = 'sph-initial-body-derived';
        output.dataset.bodyDerivedField = field;
        output.dataset.axis = String(axis);
        output.value = String(value);
        output.textContent = Number(value).toPrecision(6);
        wrap.appendChild(output);
        grid.appendChild(wrap);
      });
    };
    appendVector({
      title: 'particle count per edge', field: 'particlesPerEdge', values: body.particlesPerEdge,
      labels: ['X', 'Y', 'Z'], min: 1, step: 1
    });
    appendDerivedVector({
      title: 'derived edge length (m)', field: 'sizeM', values: body.sizeM,
      labels: ['X', 'Y', 'Z']
    });
    appendVector({
      title: 'center position (m)', field: 'centerM', values: body.centerM,
      labels: ['X', 'Y', 'Z']
    });
    const temperatureLabel = document.createElement('div');
    temperatureLabel.className = 'sph-initial-body-row-label';
    temperatureLabel.textContent = 'temperature';
    grid.appendChild(temperatureLabel);
    appendInitialBodyNumberField(grid, {
      bodyId: body.id,
      field: 'temperatureK',
      label: 'K',
      value: body.temperatureK,
      min: Number.EPSILON
    });
    const velocity = document.createElement('details');
    velocity.className = 'sph-initial-body-velocity';
    const velocitySummary = document.createElement('summary');
    velocitySummary.textContent = 'initial velocity (m/s)';
    const velocityGrid = document.createElement('div');
    velocityGrid.className = 'sph-initial-body-grid';
    body.velocityMPerS.forEach((value, axis) => appendInitialBodyNumberField(velocityGrid, {
      bodyId: body.id,
      field: 'velocityMPerS',
      axis,
      label: ['X', 'Y', 'Z'][axis],
      value
    }));
    velocity.append(velocitySummary, velocityGrid);
    grid.appendChild(velocity);
    card.append(head, grid);
    return card;
  }

  function renderInitialBodiesEditor() {
    initialBodiesEl.replaceChildren();
    const bodies = currentInitialBodies?.bodies || [];
    if (bodies.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'sph-initial-bodies-help';
      empty.textContent = 'No initial bodies. Add one to create material in the simulation.';
      initialBodiesEl.appendChild(empty);
    }
    for (let index = 0; index < bodies.length; index += 1) {
      initialBodiesEl.appendChild(createInitialBodyCard(bodies[index], index, bodies.length));
    }
    overlay.__sphInitialBodies = currentInitialBodies;
  }

  function bodyFromCommittedCard(card) {
    const bodyId = card.dataset.bodyId;
    const existing = currentInitialBodies.bodies.find((body) => body.id === bodyId);
    if (!existing) throw new Error(`Initial body '${bodyId}' no longer exists.`);
    const valueFor = (field, axis = null) => {
      const selector = axis == null
        ? `[data-body-field="${field}"]`
        : `[data-body-field="${field}"][data-axis="${axis}"]`;
      return card.querySelector(selector)?.value;
    };
    const particlesPerEdge = [0, 1, 2].map(
      (axis) => valueFor('particlesPerEdge', axis)
    );
    return {
      ...existing,
      material: valueFor('material'),
      sizeM: deriveSphInitialBodySizeM(existing, particlesPerEdge),
      centerM: [0, 1, 2].map((axis) => valueFor('centerM', axis)),
      temperatureK: valueFor('temperatureK'),
      particlesPerEdge,
      velocityMPerS: [0, 1, 2].map((axis) => valueFor('velocityMPerS', axis))
    };
  }

  function commitInitialBodyCard(card) {
    try {
      const nextBody = bodyFromCommittedCard(card);
      currentInitialBodies = validateInitialBodiesEditorState(
        currentInitialBodies.bodies.map((body) => body.id === nextBody.id ? nextBody : body)
      );
      setInitialBodiesEditorError();
      renderInitialBodiesEditor();
      scenarioPresetSelect.value = 'custom';
      scheduleDemoRebuild({ delayMs: INITIAL_BODY_EDITOR_REBUILD_DEBOUNCE_MS });
    } catch (error) {
      setInitialBodiesEditorError(error, { blocksSimulation: true });
    }
  }

  function applyInitialBodiesMutation(mutate) {
    try {
      currentInitialBodies = validateInitialBodiesEditorState(mutate(currentInitialBodies));
      setInitialBodiesEditorError();
      renderInitialBodiesEditor();
      scenarioPresetSelect.value = 'custom';
      scheduleDemoRebuild({ delayMs: INITIAL_BODY_EDITOR_REBUILD_DEBOUNCE_MS });
    } catch (error) {
      setInitialBodiesEditorError(error, { blocksSimulation: true });
    }
  }

  initialBodiesEl.addEventListener('change', (event) => {
    if (!initialBodiesEditorReady) return;
    const input = event.target.closest('[data-body-field]');
    if (!input || !initialBodiesEl.contains(input)) return;
    const card = input.closest('.sph-initial-body-card');
    if (card) commitInitialBodyCard(card);
  });
  initialBodiesEl.addEventListener('click', (event) => {
    if (!initialBodiesEditorReady) return;
    const button = event.target.closest('[data-body-action]');
    if (!button || !initialBodiesEl.contains(button)) return;
    const bodyId = button.dataset.bodyId;
    const index = currentInitialBodies.bodies.findIndex((body) => body.id === bodyId);
    if (index < 0) return;
    if (button.dataset.bodyAction === 'duplicate') {
      applyInitialBodiesMutation((value) => duplicateSphInitialBody(value, bodyId));
    } else if (button.dataset.bodyAction === 'remove' && currentInitialBodies.bodies.length > 1) {
      applyInitialBodiesMutation((value) => value.bodies.filter((body) => body.id !== bodyId));
    } else if (button.dataset.bodyAction === 'move-up' && index > 0) {
      applyInitialBodiesMutation((value) => moveSphInitialBody(value, bodyId, index - 1));
    } else if (button.dataset.bodyAction === 'move-down' && index < currentInitialBodies.bodies.length - 1) {
      applyInitialBodiesMutation((value) => moveSphInitialBody(value, bodyId, index + 1));
    }
  });
  addInitialBodyButton.addEventListener('click', () => {
    if (!initialBodiesEditorReady) return;
    applyInitialBodiesMutation((value) => {
      const identity = allocateNextSphInitialBodyIdentity(value);
      const boxDimensionsM = boxDimensionsFromControls();
      const template = value.bodies[value.bodies.length - 1] || {
        material: elementSelects.drop.value || DROP_MATERIAL_DEFAULT,
        sizeM: [0.6, 0.6, 0.6],
        centerM: [boxDimensionsM[0] / 2, 0.3, boxDimensionsM[2] / 2],
        temperatureK: DROP_TEMP_DEFAULT_K,
        particlesPerEdge: [3, 3, 3],
        velocityMPerS: [0, 0, 0]
      };
      const verticalPitchM = template.sizeM[1] / template.particlesPerEdge[1];
      return [
        ...value.bodies,
        {
          ...template,
          id: identity.id,
          domainId: identity.domainId,
          centerM: [
            template.centerM[0],
            template.centerM[1] + template.sizeM[1] + verticalPitchM,
            template.centerM[2]
          ],
          velocityMPerS: [0, 0, 0],
          legacyRole: undefined
        }
      ].map((body) => {
        if (body.legacyRole == null) {
          const { legacyRole, ...withoutLegacyRole } = body;
          return withoutLegacyRole;
        }
        return body;
      });
    });
  });

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
    ss: architectureInputs.ss,
    schroederTwoLevel: architectureInputs.schroederTwoLevel,
    schroederActiveNodeIndex: architectureInputs.schroederActiveNodeIndex,
    schroederActiveNodeSortedIndex:
      architectureInputs.schroederActiveNodeSortedIndex,
    schroederLawQueue: architectureInputs.schroederLawQueue,
    schroederLawNeighborCandidates:
      architectureInputs.schroederLawNeighborCandidates,
    schroederCrossLevelCoupling:
      architectureInputs.schroederCrossLevelCoupling,
    schroederPhaseVolumeMigration:
      architectureInputs.schroederPhaseVolumeMigration,
    schroederMechanicsFieldPairV2:
      architectureInputs.schroederMechanicsFieldPairV2,
    contactSolver: architectureInputs.contactSolver,
    surfaceOverlay: architectureInputs.surfaceOverlay,
    schroederTwoLevelAuthority: twoLevelAuthoritySelect,
    schroederTwoLevelSubsteps: executionInputs.schroederTwoLevelSubsteps,
    residentStepsPerSchedule: executionInputs.residentStepsPerSchedule,
    cfl: executionInputs.cfl,
    cflSafety: executionInputs.cflSafety,
    workerParticleOverlay: architectureInputs.workerParticleOverlay,
    blob: blobInput,
    lighting: lightingModeSelect,
    bg: backgroundColorInput,
    bgimg: backgroundImageSelect
  };
  function canonicalMountedLocationWithHash(
    params,
    { clearSearchKeys = [] } = {}
  ) {
    const search = new URLSearchParams(window.location.search);
    for (const key of clearSearchKeys) search.delete(key);
    const query = search.toString();
    const hash = params.toString();
    return `${window.location.pathname}${query ? `?${query}` : ''}${hash ? `#${hash}` : ''}`;
  }
  function urlValueForControl(key, el) {
    if (
      key === 'bgimg'
      && el?.value === SPH_LOCAL_BACKGROUND_IMAGE_CONTROL_VALUE
    ) {
      // Local object URLs and filenames are intentionally session-only.
      return '';
    }
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
      const v = hash.get(key) ?? query.get(key) ?? requestedPreset?.runtime?.[key];
      if (v != null && v !== '') applyUrlValueToControl(key, el, v);
    }
    const legacyInitialBodies = legacyInitialBodiesFromProxyControls();
    const serializedInitialBodies = hash.get('bodies')
      ?? query.get('bodies')
      ?? requestedPreset?.runtime?.bodies;
    let explicitInitialBodiesDifferFromPreset = false;
    if (serializedInitialBodies != null && serializedInitialBodies !== '') {
      try {
        currentInitialBodies = validateInitialBodiesEditorState(
          parseSphInitialBodies(serializedInitialBodies)
        );
        const expectedPresetInitialBodies = requestedPreset?.runtime?.bodies
          ? validateInitialBodiesEditorState(
              parseSphInitialBodies(requestedPreset.runtime.bodies)
            )
          : legacyInitialBodies;
        explicitInitialBodiesDifferFromPreset =
          serializeSphInitialBodies(currentInitialBodies)
          !== serializeSphInitialBodies(expectedPresetInitialBodies);
        setInitialBodiesEditorError();
      } catch (error) {
        currentInitialBodies = legacyInitialBodies;
        setInitialBodiesEditorError(
          `The bodies URL value is invalid; legacy controls were restored instead. ${error instanceof Error ? error.message : String(error)}`
        );
      }
    } else {
      currentInitialBodies = legacyInitialBodies;
      setInitialBodiesEditorError();
    }
    renderInitialBodiesEditor();
    if (requestedPreset) {
      const presetDiffers = Object.entries(requestedPreset.controls).some(([key, expected]) => {
        const explicitValue = hash.get(key) ?? query.get(key);
        const control = urlControls[key];
        if (explicitValue == null || explicitValue === '' || !control) return false;
        return urlValueForControl(key, control) !== String(expected);
      });
      if (presetDiffers || explicitInitialBodiesDifferFromPreset) {
        scenarioPresetSelect.value = 'custom';
      }
    }
  }
  const mountedRuntimeControlKeys = new Set([
    'mech',
    'ss',
    'schroederTwoLevel',
    'schroederActiveNodeIndex',
    'schroederActiveNodeSortedIndex',
    'schroederLawQueue',
    'schroederLawNeighborCandidates',
    'schroederCrossLevelCoupling',
    'schroederPhaseVolumeMigration',
    'schroederMechanicsFieldPairV2',
    'contactSolver',
    'surfaceOverlay',
    'schroederTwoLevelAuthority',
    'schroederTwoLevelSubsteps',
    'residentStepsPerSchedule',
    'cfl',
    'cflSafety',
    'workerParticleOverlay'
  ]);
  const mountedPresentationPolicyResetKeys = Object.freeze([
    'renderer',
    'rendererPresentation',
    'rendererPresentationUnsafe',
    'rendererResidentDevice',
    'surfaceBufferPresentation',
    'surfaceDraw',
    'surfaceDrawDiagnostic',
    'surfaceOverlay',
    'renderOwnership',
    'renderOwner',
    'peercomputeRenderOwnership',
    'workerOffscreenPresentation',
    'workerParticleOverlay',
    'residentWorkers',
    'residentComputeManagerMode',
    'residentStepsPerScheduleMax',
    'residentMaxStepsPerSchedule',
    'residentVisualStepsMax'
  ]);
  const mountedHierarchyPolicyResetKeys = Object.freeze([
    'schroeder',
    'ss',
    'schroederSimulation',
    'schroederLevel',
    'schroederSelectedLevel',
    'ssLevel',
    'schroederMinLevel',
    'ssMinLevel',
    'schroederMaxLevel',
    'ssMaxLevel',
    'schroederBaseGridSpacing',
    'schroederBaseGridSpacingM',
    'schroederPortableSummary',
    'ssPortableSummary',
    'schroederActiveNodeIndex',
    'ssIndex',
    'schroederActiveNodeSortedIndex',
    'ssSortedIndex',
    'schroederActiveNodeSortedIndexPolicy',
    'schroederLawQueue',
    'schroederLawNeighbors',
    'schroederLawNeighborCandidates',
    'schroederCrossLevelCoupling',
    'schroederPhaseVolumeMigration',
    'ssPhaseVolumeMigration',
    'schroederTwoLevel',
    'ssTwoLevel',
    'schroederTwoLevelAuthority',
    'schroederTwoLevelSubsteps',
    'schroederMechanicsFieldPairV2',
    'ssMechanicsFieldPairV2'
  ]);
  const mountedPresetRuntimeResetKeys = Object.freeze([
    // Mechanics is a preset control rather than runtime metadata, but it must
    // be cleared alongside mount-time policy. Otherwise "Preset defaults"
    // can resurrect worker SS around a stale Plain-SPH opt-out.
    'mech',
    'sdt',
    'cfl',
    'cflSafety',
    'avAlpha',
    'diffAlpha',
    'wallAlpha',
    'sep',
    'sepVel',
    'reactionProductReserveMinimumLiveFraction',
    'hydroInit',
    'residentStepsPerSchedule',
    'residentStepBatch',
    'residentVisualSteps',
    'residentInterfaceRefreshMode',
    'residentInterfaceRefresh',
    'residentPostStepInterfaceRefresh',
    'sceneLengthScale',
    'wallModel',
    'cameraPositionNormalized',
    'cameraTargetNormalized',
    'bodies',
    'contactSolver',
    'contactJacobiIterations',
    'contactCleanupPasses',
    'contactInnerRounds',
    'ambientPressurePa',
    'submitBurstSteps',
    ...mountedPresentationPolicyResetKeys,
    ...mountedHierarchyPolicyResetKeys
  ]);
  let mountedRuntimeControlReloadPending = false;
  function readArchitectureControlState({ normalizeDependencies = false } = {}) {
    return resolveSphMountedArchitectureControlState({
      mechanicsMode: mechanicsModeSelect.value,
      ss: architectureInputs.ss.checked,
      twoLevel: architectureInputs.schroederTwoLevel.checked,
      activeNodeIndex: architectureInputs.schroederActiveNodeIndex.checked,
      activeNodeSortedIndex:
        architectureInputs.schroederActiveNodeSortedIndex.checked,
      lawQueue: architectureInputs.schroederLawQueue.checked,
      lawNeighborCandidates:
        architectureInputs.schroederLawNeighborCandidates.checked,
      crossLevelCoupling:
        architectureInputs.schroederCrossLevelCoupling.checked,
      phaseVolumeMigration:
        architectureInputs.schroederPhaseVolumeMigration.checked,
      mechanicsFieldPairV2:
        architectureInputs.schroederMechanicsFieldPairV2.checked,
      contactSolver: architectureInputs.contactSolver.checked,
      surfaceDraw: renderModeSelect.value || 'auto',
      surfaceOverlay: architectureInputs.surfaceOverlay.checked,
      workerParticleOverlay: architectureInputs.workerParticleOverlay.checked,
      twoLevelAuthority: twoLevelAuthoritySelect.value,
      fineSubsteps: executionInputs.schroederTwoLevelSubsteps.value,
      normalizeDependencies
    });
  }
  function syncArchitectureControlDependencies({ normalizeDependencies = false } = {}) {
    const state = readArchitectureControlState({ normalizeDependencies });
    if (normalizeDependencies) {
      architectureInputs.ss.checked = state.ss;
      architectureInputs.schroederTwoLevel.checked = state.twoLevel;
      architectureInputs.schroederActiveNodeIndex.checked = state.activeNodeIndex;
      architectureInputs.schroederActiveNodeSortedIndex.checked =
        state.activeNodeSortedIndex;
      architectureInputs.schroederLawQueue.checked = state.lawQueue;
      architectureInputs.schroederLawNeighborCandidates.checked =
        state.lawNeighborCandidates;
      architectureInputs.schroederCrossLevelCoupling.checked =
        state.crossLevelCoupling;
      architectureInputs.schroederPhaseVolumeMigration.checked =
        state.phaseVolumeMigration;
      architectureInputs.schroederMechanicsFieldPairV2.checked =
        state.mechanicsFieldPairV2;
      architectureInputs.contactSolver.checked = state.contactSolver;
      architectureInputs.surfaceOverlay.checked = state.surfaceOverlay;
      architectureInputs.workerParticleOverlay.checked = state.workerParticleOverlay;
      twoLevelAuthoritySelect.value = state.twoLevelAuthority;
      executionInputs.schroederTwoLevelSubsteps.value = String(state.fineSubsteps);
    }
    architectureInputs.ss.disabled = state.disabled.ss;
    architectureInputs.schroederTwoLevel.disabled = state.disabled.twoLevel;
    architectureInputs.schroederActiveNodeIndex.disabled = state.disabled.activeNodeIndex;
    architectureInputs.schroederActiveNodeSortedIndex.disabled =
      state.disabled.activeNodeSortedIndex;
    architectureInputs.schroederLawQueue.disabled = state.disabled.lawQueue;
    architectureInputs.schroederLawNeighborCandidates.disabled =
      state.disabled.lawNeighborCandidates;
    architectureInputs.schroederCrossLevelCoupling.disabled =
      state.disabled.crossLevelCoupling;
    architectureInputs.schroederPhaseVolumeMigration.disabled =
      state.disabled.phaseVolumeMigration;
    architectureInputs.schroederMechanicsFieldPairV2.disabled =
      state.disabled.mechanicsFieldPairV2;
    architectureInputs.contactSolver.disabled = state.disabled.contactSolver;
    architectureInputs.workerParticleOverlay.disabled =
      state.disabled.workerParticleOverlay;
    twoLevelAuthoritySelect.disabled = state.disabled.twoLevelAuthority;
    executionInputs.schroederTwoLevelSubsteps.disabled = state.disabled.fineSubsteps;
    executionInputs.schroederTwoLevelSubsteps.min = String(
      state.authoritativeFineSubstepMinimum
    );
    const invalidAuthoritativeFineSubsteps = Boolean(
      state.normalizedTwoLevel
      && state.twoLevelAuthority === 'authoritative'
      && state.fineSubsteps < 2
    );
    executionInputs.schroederTwoLevelSubsteps.setCustomValidity(
      invalidAuthoritativeFineSubsteps
        ? 'Authoritative two-level mechanics requires at least two fine substeps.'
        : ''
    );
    architectureProfileSelect.value = state.profile;
    overlay.__sphMountedArchitectureControlState = state;
    return state;
  }
  function architectureProfileFromControls() {
    return readArchitectureControlState().profile;
  }
  function validateMountedArchitectureControls() {
    const state = syncArchitectureControlDependencies({
      normalizeDependencies: false
    });
    for (const input of Object.values(executionInputs)) {
      if (typeof input.checkValidity === 'function' && !input.checkValidity()) {
        input.reportValidity?.();
        throw new RangeError(input.validationMessage || 'Invalid architecture execution value.');
      }
    }
    if (state.dependencyIssues.length > 0) {
      throw new RangeError(
        `Architecture controls are inconsistent: ${state.dependencyIssues.join(', ')}.`
      );
    }
    return state;
  }
  function replaceMountedRuntimeHashAndReload({
    reason = 'mounted-runtime-control-change',
    resetToPreset = false,
    architectureStateOverride = null
  } = {}) {
    syncUrlFromControls();
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const controlledKeys = [...mountedRuntimeControlKeys];
    const clearedSearchKeys = new Set([
      ...controlledKeys,
      ...mountedPresentationPolicyResetKeys,
      ...mountedHierarchyPolicyResetKeys
    ]);
    if (resetToPreset) {
      for (const key of mountedPresetRuntimeResetKeys) params.delete(key);
      for (const key of mountedPresetRuntimeResetKeys) clearedSearchKeys.add(key);
      // A mount-time architecture override intentionally marks the visible
      // scenario selector Custom. "Preset defaults" still means the scenario
      // named by the current URL, so fall back to the preset resolved when
      // this mount was created instead of restoring only its visible controls.
      const presetEntry = sphPhaseScenarioPresetById(scenarioPresetSelect.value)
        || initialScenarioPreset;
      for (const [key, value] of Object.entries(presetEntry?.runtime || {})) {
        if (value != null && value !== '') params.set(key, String(value));
      }
    } else {
      const architectureState = architectureStateOverride
        ?? syncArchitectureControlDependencies({ normalizeDependencies: true });
      const architectureControlValues = {
        mech: architectureState.mechanicsMode,
        ss: architectureState.ss ? '1' : '0',
        schroederTwoLevel: architectureState.twoLevel ? '1' : '0',
        schroederActiveNodeIndex:
          architectureState.activeNodeIndex ? '1' : '0',
        schroederActiveNodeSortedIndex:
          architectureState.activeNodeSortedIndex ? '1' : '0',
        schroederLawQueue: architectureState.lawQueue ? '1' : '0',
        schroederLawNeighborCandidates:
          architectureState.lawNeighborCandidates ? '1' : '0',
        schroederCrossLevelCoupling:
          architectureState.crossLevelCoupling ? '1' : '0',
        schroederPhaseVolumeMigration:
          architectureState.phaseVolumeMigration ? '1' : '0',
        schroederMechanicsFieldPairV2:
          architectureState.mechanicsFieldPairV2 ? '1' : '0',
        contactSolver: architectureState.contactSolver ? '1' : '0',
        surfaceOverlay: architectureState.surfaceOverlay ? '1' : '0',
        workerParticleOverlay:
          architectureState.workerParticleOverlay ? '1' : '0',
        schroederTwoLevelAuthority: architectureState.twoLevelAuthority,
        schroederTwoLevelSubsteps: String(architectureState.fineSubsteps)
      };
      for (const key of controlledKeys) {
        const value = architectureControlValues[key];
        if (value != null) {
          params.set(key, value);
          continue;
        }
        const control = urlControls[key];
        if (control) params.set(key, urlValueForControl(key, control));
      }
      const workerProfile = architectureState.normalizedWorkerSs;
      params.set('renderer', workerProfile ? 'native-webgpu' : 'webgl');
      params.set(
        'renderOwnership',
        workerProfile
          ? 'worker-owned-resident-render-producer'
          : 'main-thread-renderer'
      );
      params.set('workerOffscreenPresentation', workerProfile ? '1' : '0');
      params.set(
        'surfaceDraw',
        workerProfile ? 'native-webgpu-surface-consumer' : 'auto'
      );
      params.set('surfaceOverlay', architectureState.surfaceOverlay ? '1' : '0');
      params.set('contactSolver', architectureState.contactSolver ? '1' : '0');
      // The interactive mount requires its supervised runtime Worker even
      // when presentation is a main-thread diagnostic.
      params.set('residentWorkers', '1');
      params.set(
        'residentComputeManagerMode',
        workerProfile ? 'worker-owned-resident-lane' : 'direct'
      );
      params.set('schroederLevel', '0');
      params.set('schroederMinLevel', '0');
      params.set(
        'schroederMaxLevel',
        architectureState.twoLevel ? '1' : '0'
      );
      params.set('schroederPortableSummary', workerProfile ? '1' : '0');
    }
    // Once the exact mount-time policy is serialized, freeze old-page URL
    // writers until navigation commits. Async rebuild/render callbacks can
    // otherwise run syncUrlFromControls() in this brief window and erase
    // non-visible architecture keys such as renderOwnership.
    mountedRuntimeControlReloadPending = true;
    overlay.__sphMountedRuntimeControlReload = {
      schema: 'peercompute.ulg.sph-mounted-runtime-control-reload.v0',
      status: 'mounted-runtime-controls-serialized-for-reload',
      reason,
      profile: resetToPreset ? 'preset' : architectureProfileFromControls(),
      updatedAtMs: performance.now()
    };
    window.history.replaceState(
      null,
      '',
      canonicalMountedLocationWithHash(params, {
        clearSearchKeys: [...clearedSearchKeys]
      })
    );
    window.location.reload();
  }
  function applyArchitectureProfile(profile) {
    if (profile === 'custom') {
      architectureProfileSelect.value = architectureProfileFromControls();
      return;
    }
    if (profile === 'preset') {
      replaceMountedRuntimeHashAndReload({
        reason: 'architecture-profile-preset-defaults',
        resetToPreset: true
      });
      return;
    }
    const workerProfile = profile !== 'main-thread-diagnostic';
    mechanicsModeSelect.value = 'mlsmpm';
    architectureInputs.ss.checked = workerProfile;
    architectureInputs.schroederTwoLevel.checked =
      profile === 'ss-two-authoritative-worker'
      || profile === 'ss-two-observation-worker';
    twoLevelAuthoritySelect.value = profile === 'ss-two-authoritative-worker'
      ? 'authoritative'
      : 'observation';
    architectureInputs.schroederActiveNodeIndex.checked = workerProfile;
    architectureInputs.schroederActiveNodeSortedIndex.checked = workerProfile;
    architectureInputs.schroederLawQueue.checked = workerProfile;
    architectureInputs.schroederLawNeighborCandidates.checked = workerProfile;
    architectureInputs.schroederCrossLevelCoupling.checked =
      profile === 'ss-two-observation-worker';
    architectureInputs.schroederPhaseVolumeMigration.checked = workerProfile;
    architectureInputs.schroederMechanicsFieldPairV2.checked =
      architectureInputs.schroederTwoLevel.checked;
    architectureInputs.contactSolver.checked = true;
    architectureInputs.surfaceOverlay.checked = false;
    architectureInputs.workerParticleOverlay.checked = false;
    executionInputs.schroederTwoLevelSubsteps.value = '2';
    renderModeSelect.value = workerProfile
      ? 'native-webgpu-surface-consumer'
      : 'auto';
    const architectureState = syncArchitectureControlDependencies({
      normalizeDependencies: true
    });
    replaceMountedRuntimeHashAndReload({
      reason: `architecture-profile-${profile}`,
      architectureStateOverride: architectureState
    });
  }
  const initialQuery = new URLSearchParams(window.location.search);
  const initialHash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const initialScenarioPreset = sphPhaseScenarioPresetById(
    initialHash.get('scenario') ?? initialQuery.get('scenario')
  );
  const initialScenarioRuntime = initialScenarioPreset?.runtime || {};
  const initialHashScenarioId = initialHash.get('scenario');
  const initialQueryScenarioId = initialQuery.get('scenario');
  const cameraQueryMatchesSelectedScenario = initialHashScenarioId == null
    || initialQueryScenarioId == null
    || initialHashScenarioId === initialQueryScenarioId;
  const initialCameraPositionNormalized =
    initialHash.get('cameraPositionNormalized')
    ?? (cameraQueryMatchesSelectedScenario
      ? initialQuery.get('cameraPositionNormalized')
      : null)
    ?? initialScenarioRuntime.cameraPositionNormalized
    ?? null;
  const initialCameraTargetNormalized =
    initialHash.get('cameraTargetNormalized')
    ?? (cameraQueryMatchesSelectedScenario
      ? initialQuery.get('cameraTargetNormalized')
      : null)
    ?? initialScenarioRuntime.cameraTargetNormalized
    ?? null;
  // The mechanics select only receives the URL value at applyUrlToControls()
  // (just before the first build) - init-time policy decisions that key on
  // the integrator must read the URL directly or they see the default.
  const initialMechanicsMode = (() => {
    const raw = String(
      initialHash.get('mech')
      ?? initialQuery.get('mech')
      ?? initialScenarioPreset?.controls?.mech
      ?? ''
    ).trim().toLowerCase();
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
  const initialSceneLengthScale = positiveNumberUrlParam(
    initialHash.get('sceneLengthScale')
      ?? initialQuery.get('sceneLengthScale')
      ?? initialScenarioRuntime.sceneLengthScale
  ) ?? 1;
  const initialWallModel = (() => {
    const value = String(
      initialHash.get('wallModel')
        ?? initialQuery.get('wallModel')
        ?? initialScenarioRuntime.wallModel
        ?? 'infinite-fixed-temperature-reservoir'
    ).trim();
    return value === 'adiabatic'
      ? 'adiabatic'
      : 'infinite-fixed-temperature-reservoir';
  })();
  const initialResidentWorkersEnabled = booleanUrlParam(
    initialHash.get('residentWorkers')
      ?? initialQuery.get('residentWorkers')
      ?? initialScenarioRuntime.residentWorkers,
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
  // FIELD-0. The visible render field is built by the particle-parallel splat
  // rather than the dense per-cell gather. Measured on native Vulkan with the
  // queue-stage recorder, same scenario, identical output (466,033 triangles in
  // both arms, n=15): device render-field cost per build 24.3 ms dense versus
  // 3.8 ms splat, and renderRefreshTotalMs 40.8 ms versus 16.7 ms -- so the win
  // is at the total, not work moved between stages. ?sourceLocalField=0 falls
  // back to the dense gather, which the splat also does internally whenever it
  // refuses, so this default cannot lose a field.
  const initialSourceLocalRenderFieldEnabled = booleanUrlParam(
    initialHash.get('sourceLocalField')
      ?? initialQuery.get('sourceLocalField')
      ?? initialHash.get('sourceLocalRenderField')
      ?? initialQuery.get('sourceLocalRenderField'),
    true
  );
  const initialResidentGpuTimestampProfilingEnabled = booleanUrlParam(
    initialHash.get('residentGpuTimestampProfile')
      ?? initialQuery.get('residentGpuTimestampProfile')
      ?? initialHash.get('residentGpuTimestamp')
      ?? initialQuery.get('residentGpuTimestamp'),
    false
  );
  const initialResidentGpuTimestampFeatureRequested = booleanUrlParam(
    initialHash.get('residentGpuTimestampFeature')
      ?? initialQuery.get('residentGpuTimestampFeature'),
    initialResidentGpuTimestampProfilingEnabled
  );
  const initialWorkerParticleOverlayEnabled = booleanUrlParam(
    initialHash.get('workerParticleOverlay')
      ?? initialQuery.get('workerParticleOverlay')
      ?? initialScenarioRuntime.workerParticleOverlay,
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
  const initialContactCleanupProfileReadbackEnabled = booleanUrlParam(
    initialHash.get('contactCleanupProfileReadback')
      ?? initialQuery.get('contactCleanupProfileReadback'),
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
    const value = Number(
      initialHash.get('cfl')
      ?? initialQuery.get('cfl')
      ?? initialScenarioRuntime.cfl
    );
    return Number.isFinite(value) && value > 0 && value <= 2 ? value : null;
  })();
  const initialCflSafety = (() => {
    const value = Number(
      initialHash.get('cflSafety')
      ?? initialQuery.get('cflSafety')
      ?? initialScenarioRuntime.cflSafety
    );
    return Number.isFinite(value) && value > 0 && value <= 2 ? value : null;
  })();
  const initialSimDtS = (() => {
    const value = Number(
      initialHash.get('sdt')
      ?? initialQuery.get('sdt')
      ?? initialScenarioRuntime.sdt
    );
    return Number.isFinite(value) && value > 0 && value <= 0.01 ? value : null;
  })();
  const numericUrlOption = (key, { min = 0, max = 10 } = {}) => {
    const raw = initialHash.get(key) ?? initialQuery.get(key) ?? initialScenarioRuntime[key];
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
  const initialParticleSeparationVelocityDamping = numericUrlOption('sepVel', { max: 1 });
  const initialReactionProductReserveMinimumLiveFraction = numericUrlOption(
    'reactionProductReserveMinimumLiveFraction',
    { max: 1 }
  );
  // Contact-solver knobs. Absent params stay null so the scene's interactive
  // preset (16 Jacobi rounds, 512 cleanup passes) applies; out-of-range
  // values clamp, and the clamped value is what gets sealed into telemetry.
  const clampedContactUrlOption = (key, min, max) => {
    const raw = initialHash.get(key) ?? initialQuery.get(key) ?? initialScenarioRuntime[key];
    if (raw == null || raw === '') return null;
    const value = Number(raw);
    if (!Number.isFinite(value)) return null;
    return Math.min(max, Math.max(min, Math.round(value)));
  };
  const initialContactSolverEnabled = (() => {
    const raw = initialHash.get('contactSolver') ?? initialQuery.get('contactSolver') ?? initialScenarioRuntime.contactSolver;
    if (raw == null || raw === '') return true;
    return String(raw) !== '0' && String(raw) !== 'false';
  })();
  const initialContactJacobiIterations = clampedContactUrlOption('contactJacobiIterations', 1, 16);
  const initialContactCleanupPasses = clampedContactUrlOption('contactCleanupPasses', 16, 65536);
  // Opt-in inner solver rounds per cleanup pass (worker lane only):
  // each logical pass runs this many selection+apply+propagate rounds,
  // advancing several violation layers while paying the expansion, wall,
  // and evidence phases once. Compiled into the sealed solver-budget
  // shader variant; 1 preserves the historical pass bit-for-bit.
  const initialContactInnerRounds = clampedContactUrlOption(
    'contactInnerRounds',
    1,
    16
  );
  // Ambient (external) pressure is a physics boundary condition; it must be
  // an explicit input, never an implicit atmosphere. When present it takes
  // the explicit-ambient branch of resolveMlsMpmAmbientPressureEvidence and
  // wins over wall-ledger pressure feedback. '0' declares vacuum ambient.
  const initialAmbientPressurePaOverride = (() => {
    const raw = initialHash.get('ambientPressurePa')
      ?? initialQuery.get('ambientPressurePa')
      ?? initialScenarioRuntime.ambientPressurePa;
    if (raw == null || raw === '') return null;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : null;
  })();
  // M4 submit burst: K worker-lane steps per queue.submit flush. The worker
  // derives eligibility from its law-activation receipt; on ineligible lanes
  // the request is declared-and-ignored, never silently applied.
  const initialSubmitBurstSteps = clampedContactUrlOption(
    'submitBurstSteps',
    2,
    256
  );
  // Diagnostic: per-step canonical spatial-authority evidence readback.
  const initialObserveSpatialAuthority = (() => {
    const raw = initialHash.get('observeSpatialAuthority')
      ?? initialQuery.get('observeSpatialAuthority')
      ?? initialScenarioRuntime.observeSpatialAuthority;
    return String(raw ?? '') === '1';
  })();
  // Explicit consumer gate for the compact mechanics view (0 selects the
  // plain canonical V1 full-grid route).
  const initialConsumeCompactMechanicsView = (() => {
    const raw = initialHash.get('compactMechanicsView')
      ?? initialQuery.get('compactMechanicsView')
      ?? initialScenarioRuntime.compactMechanicsView;
    if (raw == null || raw === '') return true;
    return String(raw) !== '0' && String(raw) !== 'false';
  })();
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
    const policyValue = policyParamValue(
      peerSchroederSimulationPolicy,
      policyKeys
    );
    if (policyValue != null) return policyValue;
    // Preset-only hierarchy geometry (notably Cs/F base spacing and max
    // level) has no basic UI field. It is nevertheless executable policy and
    // must reach the immutable mount config instead of falling back to the
    // generic single-level grid.
    return policyParamValue(initialScenarioRuntime, [
      ...new Set([...urlKeys, ...policyKeys])
    ]);
  }
  function optionalStringParam(value) {
    if (value == null) return null;
    const text = String(value).trim();
    return text ? text : null;
  }
  const initialSchroederSimulationUrlValue = initialUrlParamValue(
    ['schroederSimulation', 'schroeder', 'ss']
  );
  const initialSchroederSimulationPolicyValue = policyParamValue(
    peerSchroederSimulationPolicy,
    ['enabled', 'schroederSimulation', 'sameLevelSimulation']
  );
  const initialSchroederSimulationEnabled = booleanUrlParam(
    initialSchroederSimulationUrlValue
      ?? initialSchroederSimulationPolicyValue
      ?? initialScenarioRuntime.ss,
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
  const initialSchroederSpatialArenaCount = positiveIntegerUrlParam(
    initialUrlOrSchroederPolicyValue(
      ['schroederSpatialArenaCount', 'ssArenaCount'],
      ['spatialArenaCount', 'schroederSpatialArenaCount']
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
  const initialSchroederLawNeighborCandidatesEnabled = booleanUrlParam(
    initialUrlOrSchroederPolicyValue(
      ['schroederLawNeighborCandidates', 'schroederLawNeighbors'],
      ['enableLawNeighborCandidates', 'lawNeighborCandidates', 'schroederEnableLawNeighborCandidates']
    ),
    false
  );
  // Defaults to whatever the law-neighbour path is doing, because that path is
  // its only consumer and the cost is only worth paying when something reads it.
  //
  // Measured on ss=1 with the law-neighbour path on, 9,000 particles, three runs
  // per arm: batch wall time 3,890 ms -> 1,728 ms median of medians, a 2.25x
  // speedup, with identical output in every run. Enabling
  // it trades one radix sort per step for 288,512 exhaustive per-particle scans,
  // and the sort is far cheaper. Without this, the traversal falls back to
  // bucketed-active-node-index and misses about half its queries.
  const initialSchroederActiveNodeSortedIndexEnabled = booleanUrlParam(
    initialUrlOrSchroederPolicyValue(
      ['schroederActiveNodeSortedIndex', 'ssSortedIndex'],
      ['enableActiveNodeSortedIndex', 'activeNodeSortedIndex', 'schroederEnableActiveNodeSortedIndex']
    ),
    initialSchroederLawNeighborCandidatesEnabled
  );
  const initialSchroederCrossLevelCouplingEnabled = booleanUrlParam(
    initialUrlOrSchroederPolicyValue(
      ['schroederCrossLevelCoupling'],
      ['enableCrossLevelCoupling', 'crossLevelCoupling', 'schroederEnableCrossLevelCoupling']
    ),
    false
  );
  const initialSchroederPhaseVolumeMigrationEnabled = booleanUrlParam(
    initialUrlOrSchroederPolicyValue(
      ['schroederPhaseVolumeMigration', 'ssPhaseVolumeMigration'],
      ['enablePhaseVolumeMigration', 'phaseVolumeMigration', 'schroederEnablePhaseVolumeMigration']
    ),
    false
  );
  const initialSchroederLawQueueEnabled = booleanUrlParam(
    initialUrlOrSchroederPolicyValue(
      ['schroederLawQueue'],
      ['enableLawQueue', 'lawQueue', 'schroederEnableLawQueue']
    ),
    false
  );
  // Diagnostic only. Serializes the post-mechanics stage pipeline, so it is
  // never on by default and never on in a timing run.
  const initialStageMechanicsTraceEnabled = booleanUrlParam(
    initialUrlOrSchroederPolicyValue(
      ['stageMechanicsTrace'],
      ['stageMechanicsTrace', 'schroederStageMechanicsTrace']
    ),
    false
  );
  const initialSchroederTwoLevelMechanicsEnabled = booleanUrlParam(
    initialUrlOrSchroederPolicyValue(
      ['schroederTwoLevel', 'ssTwoLevel'],
      ['enableTwoLevelMechanics', 'schroederEnableTwoLevelMechanics', 'twoLevelMechanics']
    ),
    false
  );
  const initialSchroederMechanicsFieldPairV2Enabled = booleanUrlParam(
    initialUrlOrSchroederPolicyValue(
      ['schroederMechanicsFieldPairV2', 'ssMechanicsFieldPairV2'],
      ['enableMechanicsFieldPairV2', 'schroederEnableMechanicsFieldPairV2']
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
  ) || 2;
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
    contactSolverEnabled: initialContactSolverEnabled,
    contactJacobiIterations: initialContactJacobiIterations,
    contactCleanupPassBudget: initialContactCleanupPasses,
    contactInnerRounds: initialContactInnerRounds,
    selectedLevel: initialSchroederSelectedLevel,
    baseGridSpacingM: initialSchroederBaseGridSpacingM,
    minLevel: initialSchroederMinLevel,
    maxLevel: initialSchroederMaxLevel,
    spatialArenaCount: initialSchroederSpatialArenaCount,
    tileCellCount: initialSchroederTileCellCount,
    enablePortableSummary: initialSchroederPortableSummaryEnabled,
    portableSummaryPeerComputeUseCase: initialSchroederPortableSummaryPeerComputeUseCase,
    enableActiveNodeIndex: initialSchroederActiveNodeIndexEnabled,
    enableActiveNodeSortedIndex: initialSchroederActiveNodeSortedIndexEnabled,
    activeNodeSortedIndexPolicyMode: initialSchroederActiveNodeSortedIndexPolicyMode,
    lawNeighborTraversalPolicyMode: initialSchroederLawNeighborTraversalPolicyMode,
    lawNeighborCandidateReadbackMode: initialSchroederLawNeighborCandidateReadbackMode,
    enableCrossLevelCoupling: initialSchroederCrossLevelCouplingEnabled,
    enablePhaseVolumeMigration: initialSchroederPhaseVolumeMigrationEnabled,
    enableLawQueue: initialSchroederLawQueueEnabled,
    enableLawNeighborCandidates: initialSchroederLawNeighborCandidatesEnabled,
    enableTwoLevelMechanics: initialSchroederTwoLevelMechanicsEnabled,
    enableMechanicsFieldPairV2:
      initialSchroederMechanicsFieldPairV2Enabled,
    twoLevelMechanicsAuthority: initialSchroederTwoLevelMechanicsAuthority,
    twoLevelFineSubstepCount: initialSchroederTwoLevelFineSubstepCount,
    enableParticleStorageMaterialization: initialSchroederParticleStorageMaterializationEnabled,
    particleStorageAdmissionRowBudget: initialSchroederParticleStorageAdmissionRowBudget,
    particleStorageRequiredCapacity: initialSchroederParticleStorageRequiredCapacity,
    particleStorageCapacityMargin: initialSchroederParticleStorageCapacityMargin,
    particleStorageFreeListSlotCapacity: initialSchroederParticleStorageFreeListSlotCapacity,
    particleStorageFreeListAvailableSlotCount: initialSchroederParticleStorageFreeListAvailableSlotCount,
    particleStorageFreeListMaxSlotsPerRow: initialSchroederParticleStorageFreeListMaxSlotsPerRow,
    source: initialSchroederSimulationUrlValue != null
      ? 'url'
      : (initialSchroederSimulationPolicyValue != null
          ? 'peercompute-policy'
          : (initialScenarioRuntime.ss != null ? 'scenario-preset' : 'default'))
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
      contactCleanupProfileReadback:
        initialContactCleanupProfileReadbackEnabled,
      reactionParticleBinMetadataReadback:
        initialReactionBinMetadataReadbackEnabled
    };
  }
  function schroederResidentExecutionOptionsFromConfig(
    config = initialSchroederSimulationConfig
  ) {
    if (!config?.enabled) {
      return {
        schroederSimulation: false,
        schroederContactSolverEnabled: config?.contactSolverEnabled !== false
      };
    }
    return {
      schroederSimulation: true,
      // Preserve the explicit request so the scene can reject an invalid
      // SS-without-contact schedule. Never translate it into ss=false.
      schroederContactSolverEnabled: config.contactSolverEnabled !== false,
      schroederContactJacobiIterations: config.contactJacobiIterations,
      schroederContactCleanupPassBudget: config.contactCleanupPassBudget,
      schroederContactInnerRounds: config.contactInnerRounds,
      schroederSelectedLevel: config.selectedLevel,
      schroederBaseGridSpacingM: config.baseGridSpacingM,
      schroederMinLevel: config.minLevel,
      schroederMaxLevel: config.maxLevel,
      schroederSpatialArenaCount: config.spatialArenaCount,
      schroederTileCellCount: config.tileCellCount,
      schroederEnablePortableSummary: config.enablePortableSummary,
      schroederPortableSummaryPeerComputeUseCase: config.portableSummaryPeerComputeUseCase,
      schroederEnableActiveNodeIndex: config.enableActiveNodeIndex,
      schroederEnableActiveNodeSortedIndex: config.enableActiveNodeSortedIndex,
      schroederActiveNodeSortedIndexPolicyMode: config.activeNodeSortedIndexPolicyMode,
      schroederLawNeighborTraversalPolicyMode: config.lawNeighborTraversalPolicyMode,
      schroederLawNeighborCandidateReadbackMode: config.lawNeighborCandidateReadbackMode,
      schroederEnableCrossLevelCoupling: config.enableCrossLevelCoupling,
      schroederEnablePhaseVolumeMigration: config.enablePhaseVolumeMigration,
      schroederEnableLawQueue: config.enableLawQueue,
      schroederEnableLawNeighborCandidates: config.enableLawNeighborCandidates,
      schroederEnableTwoLevelMechanics: config.enableTwoLevelMechanics,
      schroederEnableMechanicsFieldPairV2:
        config.enableMechanicsFieldPairV2,
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
      ?? initialScenarioRuntime.surfaceOverlay
      ?? SPH_RESIDENT_SURFACE_DRAW_OVERLAY_MODE_DEFAULT
  );
  const explicitResidentSurfaceDrawDiagnosticMode =
    initialHash.get('surfaceDraw')
    ?? initialQuery.get('surfaceDraw')
    ?? initialHash.get('surfaceDrawDiagnostic')
    ?? initialQuery.get('surfaceDrawDiagnostic');
  const rawResidentSurfaceDrawDiagnosticMode =
    explicitResidentSurfaceDrawDiagnosticMode
    ?? initialScenarioRuntime.surfaceDraw;
  const rawRendererBackend =
    initialHash.get('renderer')
    ?? initialQuery.get('renderer')
    ?? initialHash.get('sphRenderer')
    ?? initialQuery.get('sphRenderer')
    ?? initialHash.get('threeRenderer')
    ?? initialQuery.get('threeRenderer')
    ?? initialScenarioRuntime.renderer;
  const rendererSurfaceStartupSelection =
    resolveSphRendererSurfaceStartupSelection({
      requestedRendererBackend: rawRendererBackend,
      requestedSurfaceDrawMode: rawResidentSurfaceDrawDiagnosticMode,
      mechanicsMode: initialMechanicsMode,
      webGpuAvailable: Boolean(globalThis?.navigator?.gpu)
    });
  const resolvedResidentSurfaceDrawDiagnosticMode =
    rendererSurfaceStartupSelection.surfaceDrawMode;
  const nativeSurfaceDrawRequested =
    rendererSurfaceStartupSelection.nativeSurfaceDrawRequested;
  let initialSphRendererBackend =
    rendererSurfaceStartupSelection.rendererBackend;
  overlay.__sphRendererSurfaceStartupSelection =
    rendererSurfaceStartupSelection;
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
  const explicitRenderOwnershipMode =
    initialHash.get('renderOwnership')
    ?? initialQuery.get('renderOwnership')
    ?? initialHash.get('renderOwner')
    ?? initialQuery.get('renderOwner')
    ?? initialHash.get('peercomputeRenderOwnership')
    ?? initialQuery.get('peercomputeRenderOwnership')
    ?? initialHash.get('rendererOwnership')
    ?? initialQuery.get('rendererOwnership');
  const rawRenderOwnershipMode =
    explicitRenderOwnershipMode
    ?? initialScenarioRuntime.renderOwnership;
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
    ?? initialQuery.get('workerCanvas')
    ?? initialScenarioRuntime.workerOffscreenPresentation;
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
      ?? initialScenarioRuntime.residentStepsPerSchedule
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
      ?? initialScenarioRuntime.residentStepsPerScheduleMax
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
    ?? initialScenarioRuntime.residentInterfaceRefreshMode
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
    ?? initialScenarioRuntime.residentComputeManagerMode
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
  // W4b policy readiness: resolve the requested ownership mode once without
  // claiming producer readiness, probe only when that policy selects the SS
  // worker lane, then resolve the final policy with the measured capability.
  // This admits the same-device interactive default while preserving explicit
  // main-thread/offscreen choices and PeerCompute policy overrides.
  const explicitRenderOwnershipRequest = normalizePeerComputeRenderOwnershipMode(
    rawRenderOwnershipMode,
    null
  );
  const workerOwnedResidentLaneModeExplicitlyRequested = Boolean(
    explicitRenderOwnershipRequest
      === ULG_PEERCOMPUTE_RENDER_OWNERSHIP_MODES.WORKER_OWNED_RESIDENT_RENDER_PRODUCER
    || explicitRenderOwnershipRequest
      === ULG_PEERCOMPUTE_RENDER_OWNERSHIP_MODES
        .PRESENTATION_WORKER_RETAINED_OUTPUT_PRESENTATION_ONLY
  );
  const initialRenderOwnershipPolicyOptions = {
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
    source: explicitRenderOwnershipMode != null
      ? 'sph-phase-demo-url'
      : initialScenarioRuntime.renderOwnership != null
        ? 'sph-phase-demo-preset'
        : 'sph-phase-demo'
  };
  const pendingPeerComputeRenderOwnershipPolicy =
    resolvePeerComputeRenderOwnershipPolicy({
      ...initialRenderOwnershipPolicyOptions,
      workerOwnedResidentProducerReady: false
    });
  const workerOwnedResidentLaneModeRequested = Boolean(
    pendingPeerComputeRenderOwnershipPolicy.workerOwnedResidentProducerRequested
  );
  const workerOwnedResidentLaneCapabilityProbe =
    workerOwnedResidentLaneModeRequested && initialSchroederSimulationEnabled
      ? resolveUlgWorkerOffscreenPresentationCapability({
          requested: true,
          canvas: typeof document?.createElement === 'function'
            ? document.createElement('canvas')
            : null,
          windowRef: window,
          navigatorRef: globalThis.navigator
        })
      : null;
  const initialWorkerOwnedResidentLaneReady = Boolean(
    workerOwnedResidentLaneModeRequested
    && initialSchroederSimulationEnabled
    && workerOwnedResidentLaneCapabilityProbe?.status
      === 'worker-offscreen-presentation-transfer-ready'
  );
  overlay.__sphWorkerOwnedResidentLaneAdmission = {
    schema: 'peercompute.ulg.sph-demo-worker-owned-resident-lane-admission.v0',
    ready: initialWorkerOwnedResidentLaneReady,
    explicitRenderOwnershipRequest,
    workerOwnedResidentLaneModeExplicitlyRequested,
    workerOwnedResidentLaneModeRequested,
    requestedRenderOwnershipMode:
      pendingPeerComputeRenderOwnershipPolicy.requestedMode ?? null,
    schroederSimulationRequested: initialSchroederSimulationEnabled,
    capabilityProbeStatus: workerOwnedResidentLaneCapabilityProbe?.status ?? null,
    capabilityProbeReason: workerOwnedResidentLaneCapabilityProbe?.reason ?? null,
    updatedAtMs: performance.now()
  };
  const initialPeerComputeRenderOwnershipPolicy = resolvePeerComputeRenderOwnershipPolicy({
    ...initialRenderOwnershipPolicyOptions,
    workerOwnedResidentProducerReady: initialWorkerOwnedResidentLaneReady,
  });
  const workerOffscreenPresentationEnabled = Boolean(
    initialPeerComputeRenderOwnershipPolicy.workerOffscreenPresentationRequested
  );
  overlay.__sphPeerComputeRenderOwnershipPolicy = initialPeerComputeRenderOwnershipPolicy;
  // Render-row bridge modes suppress the CPU meshes, so they must prove that
  // their resident WebGPU producer is usable before the scene is mounted.
  // Otherwise a browser which exposes navigator.gpu but cannot acquire an
  // adapter produces the same blank canvas as a failed native consumer.
  const defaultThreeResidentSurfaceDrawMode = initialMechanicsMode === 'sph'
    ? 'auto'
    : (window.innerWidth < 700
      ? 'three-render-row-spheres'
      : 'three-render-row-points');
  const provisionalResidentSurfaceDrawDiagnosticMode =
    normalizeResidentSurfaceDrawDiagnosticMode(
      resolvedResidentSurfaceDrawDiagnosticMode,
      residentSurfaceDrawOverlayMode === 'enabled'
        ? 'auto'
        : defaultThreeResidentSurfaceDrawMode
    );
  const residentParticleBridgeStartupRequested =
    residentSurfaceDrawModeUsesParticleBridge(
      provisionalResidentSurfaceDrawDiagnosticMode
    );
  // A live SPH simulation is admitted only with a resident WebGPU device.
  // Presentation choice must never downgrade this requirement to a visible
  // WebGL shell plus inline compute.
  const acquireInitialRendererWebGpuDevice = true;
  let initialRendererWebGpuDeviceResult = null;
  let initialSimulationRuntimePrerequisite = null;
  let nativeWebGpuStartupPreflight = null;
  let residentParticleBridgeStartupPreflight = null;
  if (acquireInitialRendererWebGpuDevice) {
    statusEl.textContent = 'acquiring shared WebGPU resident/render device...';
    initialRendererWebGpuDeviceResult = await requestOpticalGpuDevice(globalThis.navigator, {
      // The resident/render preflight is the first device acquisition for
      // particle-bridge and native-surface modes. Preserve an explicit
      // benchmark profiling request here; a later scene request cannot add
      // timestamp-query to an already-created GPUDevice.
      // Outer queue-interval probes need the timestamp-query device feature,
      // but must not turn on the serialized per-stage recorder. The latter is
      // controlled independently by residentGpuTimestampProfile.
      timestampProfilingRequested: initialResidentGpuTimestampFeatureRequested
    }).catch((error) => ({
      status: 'blocked-webgpu-error',
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
    initialSimulationRuntimePrerequisite = resolveSphSimulationRuntimePrerequisite({
        workersEnabled: initialResidentWorkersEnabled,
        workerConstructorAvailable: typeof globalThis.Worker === 'function',
        deviceResult: initialRendererWebGpuDeviceResult
      });
    overlay.__sphSimulationRuntimePrerequisite = initialSimulationRuntimePrerequisite;
    if (!initialSimulationRuntimePrerequisite.ready) {
      const pendingPresentation = overlay.querySelector('#sph-pending-presentation');
      const pendingTitle = overlay.querySelector('#sph-pending-presentation-title');
      const pendingDetail = overlay.querySelector('#sph-pending-presentation-detail');
      const pendingEnvelope = overlay.querySelector('#sph-pending-body-envelope');
      if (pendingEnvelope) pendingEnvelope.replaceChildren();
      if (pendingTitle) pendingTitle.textContent = 'simulation blocked';
      if (pendingDetail) pendingDetail.textContent = initialSimulationRuntimePrerequisite.reason;
      if (pendingPresentation) {
        pendingPresentation.hidden = false;
        pendingPresentation.dataset.status = initialSimulationRuntimePrerequisite.status;
        pendingPresentation.setAttribute('aria-busy', 'false');
      }
      overlay.dataset.sphSimulationRuntime = 'blocked';
      statusEl.textContent = `simulation blocked — ${initialSimulationRuntimePrerequisite.reason}`;
      for (const selector of [
        '#sph-preflight', '#sph-play', '#sph-step', '#sph-reset', '#sph-clear-cache'
      ]) {
        const control = overlay.querySelector(selector);
        if (control) control.disabled = true;
      }
      const close = () => {
        initialRendererWebGpuDeviceResult?.device?.destroy?.();
        overlay.remove();
      };
      overlay.querySelector('#sph-close')?.addEventListener('click', close, { once: true });
      return {
        close,
        overlay,
        simulationRuntimePrerequisite: initialSimulationRuntimePrerequisite
      };
    }
    if (initialSphRendererBackend === 'native-webgpu') {
      nativeWebGpuStartupPreflight = resolveSphNativeWebGpuStartupPreflight({
        requestedRendererBackend: initialSphRendererBackend,
        requestedSurfaceDrawMode:
          resolvedResidentSurfaceDrawDiagnosticMode,
        deviceResult: initialRendererWebGpuDeviceResult,
        // A failed adapter/device preflight cannot fall back to either
        // render-row bridge: both bridges need resident GPU render rows and
        // therefore reproduce the same blank canvas when WebGPU is absent.
        // `auto` keeps the packed initial CPU surface meshes visible through
        // Three/WebGL while the warning explains that live resident physics
        // is unavailable.
        fallbackSurfaceDrawMode: 'auto'
      });
      if (nativeWebGpuStartupPreflight.fallbackApplied) {
        initialRendererWebGpuDeviceResult?.device?.destroy?.();
        initialRendererWebGpuDeviceResult = {
          ...(initialRendererWebGpuDeviceResult || {}),
          status: nativeWebGpuStartupPreflight.status,
          reason: nativeWebGpuStartupPreflight.reason,
          device: null,
          nativeStartupDeviceReleased: true
        };
        initialSphRendererBackend = nativeWebGpuStartupPreflight.rendererBackend;
      }
      overlay.__sphNativeWebGpuStartupPreflight = nativeWebGpuStartupPreflight;
    } else if (residentParticleBridgeStartupRequested) {
      residentParticleBridgeStartupPreflight =
        resolveSphResidentParticleBridgeStartupPreflight({
          requestedSurfaceDrawMode:
            provisionalResidentSurfaceDrawDiagnosticMode,
          deviceResult: initialRendererWebGpuDeviceResult,
          fallbackSurfaceDrawMode: 'auto'
        });
      if (residentParticleBridgeStartupPreflight.fallbackApplied) {
        initialRendererWebGpuDeviceResult?.device?.destroy?.();
        initialRendererWebGpuDeviceResult = {
          ...(initialRendererWebGpuDeviceResult || {}),
          status: residentParticleBridgeStartupPreflight.status,
          reason: residentParticleBridgeStartupPreflight.reason,
          device: null,
          residentParticleBridgeStartupDeviceReleased: true
        };
      }
      overlay.__sphResidentParticleBridgeStartupPreflight =
        residentParticleBridgeStartupPreflight;
    }
  }
  initialSimulationRuntimePrerequisite ||= resolveSphSimulationRuntimePrerequisite({
    workersEnabled: initialResidentWorkersEnabled,
    workerConstructorAvailable: typeof globalThis.Worker === 'function',
    deviceResult: initialRendererWebGpuDeviceResult
  });
  let simulationRuntimeAdmission = Object.freeze({
    schema: SPH_SIMULATION_RUNTIME_PREREQUISITE_SCHEMA,
    status: 'sph-simulation-awaiting-worker-bootstrap',
    ready: false,
    reason: 'waiting for the required browser worker to acknowledge readiness',
    preflight: initialSimulationRuntimePrerequisite,
    workerCapability: null,
    updatedAtMs: performance.now()
  });
  let interactiveControlHandlersBound = false;
  syncSphInteractiveControlAvailability = () => {
    const commonReady = Boolean(
      simulationRuntimeAdmission.ready
      && interactiveControlHandlersBound
      && overlay.__sphInitialBodiesDraftInvalid !== true
    );
    const stateReady = interactiveSimulationStateReady;
    for (const selector of ['#sph-play', '#sph-step']) {
      const control = overlay.querySelector(selector);
      if (control) control.disabled = !(commonReady && stateReady);
    }
    const resetControl = overlay.querySelector('#sph-reset');
    if (resetControl) resetControl.disabled = !commonReady;
  };
  overlay.__sphSimulationRuntimeAdmission = simulationRuntimeAdmission;
  for (const selector of ['#sph-play', '#sph-step', '#sph-reset']) {
    const control = overlay.querySelector(selector);
    if (control) control.disabled = true;
  }

  function simulationRuntimeBlocked() {
    return simulationRuntimeAdmission?.status === 'blocked-sph-simulation-runtime';
  }

  function blockSphSimulationRuntime(reason, {
    source = 'resident-authority-host',
    errorCode = null
  } = {}) {
    const message = reason instanceof Error ? reason.message : String(reason || 'required runtime admission failed');
    simulationRuntimeAdmission = Object.freeze({
      ...simulationRuntimeAdmission,
      status: 'blocked-sph-simulation-runtime',
      ready: false,
      reason: message,
      source,
      errorCode,
      updatedAtMs: performance.now()
    });
    overlay.__sphSimulationRuntimeAdmission = simulationRuntimeAdmission;
    overlay.dataset.sphSimulationRuntime = 'blocked';
    stopPlaybackForInvalidInitialBodyDraft?.();
    const pendingPresentation = overlay.querySelector('#sph-pending-presentation');
    const pendingTitle = overlay.querySelector('#sph-pending-presentation-title');
    const pendingDetail = overlay.querySelector('#sph-pending-presentation-detail');
    const pendingEnvelope = overlay.querySelector('#sph-pending-body-envelope');
    if (pendingEnvelope) pendingEnvelope.replaceChildren();
    if (pendingTitle) pendingTitle.textContent = 'simulation blocked';
    if (pendingDetail) pendingDetail.textContent = message;
    if (pendingPresentation) {
      pendingPresentation.hidden = false;
      pendingPresentation.dataset.status = simulationRuntimeAdmission.status;
      pendingPresentation.setAttribute('aria-busy', 'false');
    }
    statusEl.textContent = `simulation blocked — ${message}`;
    for (const selector of [
      '#sph-preflight', '#sph-play', '#sph-step', '#sph-reset', '#sph-clear-cache'
    ]) {
      const control = overlay.querySelector(selector);
      if (control) control.disabled = true;
    }
    return simulationRuntimeAdmission;
  }

  const initialSchroederHierarchyContactAdmission =
    resolveSphSchroederHierarchyContactAdmission({
      schroederSimulation: initialSchroederSimulationConfig.enabled,
      contactSolver: initialSchroederSimulationConfig.contactSolverEnabled
    });
  overlay.__sphSchroederHierarchyContactAdmission =
    initialSchroederHierarchyContactAdmission;
  if (
    initialSchroederHierarchyContactAdmission.hierarchyRequested
    && !initialSchroederHierarchyContactAdmission.admitted
  ) {
    blockSphSimulationRuntime(
      'Schroeder hierarchy requires the canonical contact solver; '
      + 'disable SS before selecting the contact-off diagnostic.',
      {
        source: 'schroeder-hierarchy-contact-admission',
        errorCode: initialSchroederHierarchyContactAdmission.reason
      }
    );
  }

  function admitSphSimulationRuntime(workerCapability) {
    if (simulationRuntimeBlocked()) return false;
    if (workerCapability?.status !== 'worker-capability-ready') {
      blockSphSimulationRuntime(
        workerCapability?.blocker || 'the required browser worker did not finish bootstrap',
        { source: 'resident-authority-host-worker-capability' }
      );
      return false;
    }
    simulationRuntimeAdmission = Object.freeze({
      ...simulationRuntimeAdmission,
      status: 'sph-simulation-runtime-admitted',
      ready: true,
      reason: 'WebGPU device and required browser worker are ready',
      workerCapability,
      updatedAtMs: performance.now()
    });
    overlay.__sphSimulationRuntimeAdmission = simulationRuntimeAdmission;
    overlay.dataset.sphSimulationRuntime = 'ready';
    syncSphInteractiveControlAvailability();
    return true;
  }

  let residentSurfaceDrawDiagnosticMode = nativeWebGpuStartupPreflight?.fallbackApplied
    ? nativeWebGpuStartupPreflight.surfaceDrawMode
    : (residentParticleBridgeStartupPreflight?.fallbackApplied
      ? residentParticleBridgeStartupPreflight.surfaceDrawMode
      : provisionalResidentSurfaceDrawDiagnosticMode);
  // Explicit render-mode selections (URL surfaceDraw= or the render-mode
  // menu) must override the auto render-ownership policy's worker-owned
  // presentation; a defaulted mode must not.
  let residentSurfaceDrawDiagnosticModeExplicit =
    explicitResidentSurfaceDrawDiagnosticMode != null;
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
      selectedByUrl: explicitResidentSurfaceDrawDiagnosticMode != null,
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
    if (mountedRuntimeControlReloadPending) return;
    const q = new URLSearchParams();
    for (const [key, el] of Object.entries(urlControls)) q.set(key, urlValueForControl(key, el));
    if (currentInitialBodies) {
      q.set('bodies', serializeSphInitialBodies(currentInitialBodies));
    }
    // These policies have no visible inputs, but they are part of a preset's
    // simulation state. Keep them in the canonical hash when body edits turn
    // a preset into `custom`, otherwise the same body URL runs with different
    // dt/CFL/cadence after a reload.
    if (initialSimDtS != null) q.set('sdt', String(initialSimDtS));
    if (initialGridCflFactor != null) q.set('cfl', String(initialGridCflFactor));
    if (initialCflSafety != null) q.set('cflSafety', String(initialCflSafety));
    if (initialArtificialViscosityAlpha != null) {
      q.set('avAlpha', String(initialArtificialViscosityAlpha));
    }
    if (initialLiquidVelocityDiffusionAlpha != null) {
      q.set('diffAlpha', String(initialLiquidVelocityDiffusionAlpha));
    }
    if (initialLiquidWallDampingAlpha != null) {
      q.set('wallAlpha', String(initialLiquidWallDampingAlpha));
    }
    if (initialParticleSeparationRelaxation != null) {
      q.set('sep', String(initialParticleSeparationRelaxation));
    }
    if (initialParticleSeparationVelocityDamping != null) {
      q.set('sepVel', String(initialParticleSeparationVelocityDamping));
    }
    if (initialReactionProductReserveMinimumLiveFraction != null) {
      q.set(
        'reactionProductReserveMinimumLiveFraction',
        String(initialReactionProductReserveMinimumLiveFraction)
      );
    }
    if (initialHydrostaticInitialization != null) {
      q.set('hydroInit', initialHydrostaticInitialization ? '1' : '0');
    }
    if (residentStepsPerScheduleOverride != null) {
      q.set('residentStepsPerSchedule', String(residentStepsPerScheduleOverride));
    }
    if (residentInterfaceRefreshMode) {
      q.set('residentInterfaceRefreshMode', String(residentInterfaceRefreshMode));
    }
    if (residentComputeManagerMode) {
      q.set('residentComputeManagerMode', String(residentComputeManagerMode));
    }
    if (initialSceneLengthScale !== 1) {
      q.set('sceneLengthScale', String(initialSceneLengthScale));
    }
    if (initialWallModel !== 'infinite-fixed-temperature-reservoir') {
      q.set('wallModel', initialWallModel);
    }
    if (initialCameraPositionNormalized != null) {
      q.set('cameraPositionNormalized', String(initialCameraPositionNormalized));
    }
    if (initialCameraTargetNormalized != null) {
      q.set('cameraTargetNormalized', String(initialCameraTargetNormalized));
    }
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
      if (initialSchroederCrossLevelCouplingEnabled) q.set('schroederCrossLevelCoupling', '1');
      if (initialSchroederPhaseVolumeMigrationEnabled) q.set('schroederPhaseVolumeMigration', '1');
      if (initialSchroederLawQueueEnabled) q.set('schroederLawQueue', '1');
      if (initialSchroederLawNeighborCandidatesEnabled) q.set('schroederLawNeighborCandidates', '1');
      if (initialSchroederParticleStorageMaterializationEnabled) {
        q.set('schroederParticleStorageMaterialization', '1');
      }
      if (initialSchroederTwoLevelMechanicsEnabled) {
        q.set('schroederTwoLevel', '1');
        if (initialSchroederMechanicsFieldPairV2Enabled) {
          q.set('schroederMechanicsFieldPairV2', '1');
        }
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
    window.history.replaceState(null, '', canonicalMountedLocationWithHash(q));
  }
  applyUrlToControls(); // restore from the URL before the first build
  syncArchitectureControlDependencies({ normalizeDependencies: false });
  syncUrlFromControls(); // and reflect the full current state in the URL

  function referenceBoxDimensionsFromControls() {
    const dim = (input, def) => { const v = Number(input.value); return Number.isFinite(v) && v > 0 ? v : def; };
    return [dim(boxInputs.x, BOX_DIM_DEFAULTS_M.x), dim(boxInputs.y, BOX_DIM_DEFAULTS_M.y), dim(boxInputs.z, BOX_DIM_DEFAULTS_M.z)];
  }

  function boxDimensionsFromControls() {
    return referenceBoxDimensionsFromControls().map(
      (dimensionM) => dimensionM * initialSceneLengthScale
    );
  }

  function scenarioFromControls() {
    const wallFaces = {};
    for (const face of WALL_FACES) wallFaces[face] = Number(wallInputs[face].value) || WALL_DEFAULT_K;
    // The canonical initial-body editor owns body geometry. Particle counts
    // are its editable authority; each body's existing per-axis particle pitch
    // determines the derived physical edge length. This scenario object owns
    // only container and wall configuration.
    return createSphPhaseScenario({
      wallFaces,
      wallModel: initialWallModel,
      sceneLengthScale: initialSceneLengthScale,
      boxDimensionsM: referenceBoxDimensionsFromControls()
    });
  }

  function physicalLawGroupsFromControls() {
    return Object.fromEntries(PHYSICAL_LAW_GROUPS.map(([key]) => [key, lawInputs[key]?.checked !== false]));
  }

  function effectivePhysicalLawGroups(
    admission = activeViewState?.surfaceTensionLawAdmission ?? null
  ) {
    const requested = physicalLawGroupsFromControls();
    return {
      ...requested,
      surfaceTension: Boolean(
        requested.surfaceTension
        && requested.mechanics
        && admission?.admitted === true
      )
    };
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
      initialBodies: currentInitialBodies,
      dropMaterial: elementSelects.drop.value,
      baseMaterial: elementSelects.base.value,
      dropTemperatureK: Number.isFinite(dropTemperatureK) ? dropTemperatureK : DROP_TEMP_DEFAULT_K,
      baseTemperatureK: Number.isFinite(baseTemperatureK) ? baseTemperatureK : BASE_TEMP_DEFAULT_K,
      iceBaseHeightM: Number.isFinite(iceBaseHeightM) ? iceBaseHeightM : ICE_BASE_DEFAULT_M,
      ironBaseHeightM: Number.isFinite(ironBaseHeightM) ? ironBaseHeightM : IRON_BASE_DEFAULT_M,
      dropParticleEdge: Number.isFinite(dropEdge) && dropEdge >= 1 ? dropEdge : DROP_PARTICLE_EDGE_DEFAULT,
      baseParticleEdge: Number.isFinite(baseEdge) && baseEdge >= 1 ? baseEdge : BASE_PARTICLE_EDGE_DEFAULT,
      mechanics: mechanicsModeFromControls(),
      reactionProductReserveMinimumLiveFraction:
        initialReactionProductReserveMinimumLiveFraction,
      physicalLawGroups: physicalLawGroupsFromControls(),
      schroederSimulationConfig: initialSchroederSimulationConfig,
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
      ...(initialParticleSeparationVelocityDamping != null
        ? { mlsMpmParticleSeparationVelocityDamping: initialParticleSeparationVelocityDamping }
        : {}),
      ...(initialHydrostaticInitialization != null
        ? { hydrostaticInitialization: initialHydrostaticInitialization }
        : {})
    };
  }

  const blobScaleOf = () => { const v = Number(blobInput.value); return Number.isFinite(v) && v > 0 ? v : BLOB_SCALE_DEFAULT; };
  const lightingModeOf = () => normalizeSphSceneLightingMode(lightingModeSelect.value);
  const backgroundColorOf = () => normalizeSphSceneBackgroundColorHex(backgroundColorInput.value);
  const backgroundImageUrlOf = () => (
    backgroundImageSelect.value === SPH_LOCAL_BACKGROUND_IMAGE_CONTROL_VALUE
      ? localBackgroundImageObjectUrl
      : (backgroundImageSelect.value || null)
  );
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
    residentCompletionThroughputFps: null,
    residentCompletionThroughputEwmaFps: null,
    lastResidentCompletionAtMs: null,
    lastResidentCompletionStepCount: 0,
    lastResidentCompletionElapsedMs: null,
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
  const pendingPresentationEl = overlay.querySelector('#sph-pending-presentation');
  let pendingBodyEnvelopePreviewSerial = 0;
  let pendingResidentPresentationProofWait = null;
  function publishPendingBodyEnvelopePreview({
    reason = 'material-closure-pending',
    generation = workerRebuildGeneration
  } = {}) {
    pendingBodyEnvelopePreviewSerial += 1;
    try {
      const preview = Object.freeze({
        ...createSphPendingBodyEnvelopePreview({
          initialBodies: currentInitialBodies,
          boxDimsM: boxDimensionsFromControls(),
          reason,
          generation,
          previewSerial: pendingBodyEnvelopePreviewSerial
        }),
        active: true,
        particleGeneration: null,
        createdAtMs: performance.now(),
        updatedAtMs: performance.now()
      });
      renderSphPendingBodyEnvelopePreview(pendingPresentationEl, preview);
      overlay.__sphPendingPresentation = preview;
      return preview;
    } catch (error) {
      const blocked = Object.freeze({
        schema: SPH_PENDING_BODY_ENVELOPE_PREVIEW_SCHEMA,
        status: 'physics-pending-control-envelope-preview-blocked',
        reason,
        generation:
          generation != null && Number.isSafeInteger(Number(generation))
            ? Number(generation)
            : null,
        previewSerial: pendingBodyEnvelopePreviewSerial,
        active: false,
        presentationOnly: true,
        authoritativePhysicsState: false,
        physicsStateCurrent: false,
        error: error instanceof Error ? error.message : String(error),
        updatedAtMs: performance.now(),
        scientificValidation: false,
        sphValidation: false,
        phaseChangeValidation: false,
        fullPhysicsValidation: false
      });
      hideSphPendingBodyEnvelopePreview(pendingPresentationEl);
      overlay.__sphPendingPresentation = blocked;
      return blocked;
    }
  }
  function bindPendingBodyEnvelopePreviewToParticleGeneration(generation) {
    const current = overlay.__sphPendingPresentation;
    if (!current?.active) return current || null;
    const next = Object.freeze({
      ...current,
      particleGeneration:
        generation != null && Number.isSafeInteger(Number(generation))
          ? Number(generation)
          : null,
      updatedAtMs: performance.now()
    });
    overlay.__sphPendingPresentation = next;
    return next;
  }
  function completePendingBodyEnvelopePreview({
    generation = particleSyncGeneration,
    reason = 'current-presentation-ready'
  } = {}) {
    const current = overlay.__sphPendingPresentation;
    if (!current?.active) return false;
    // A newly published rebuild preview is deliberately unbound until its
    // own particle generation arrives. An older in-flight resident render
    // must never retire that replacement preview.
    if (current.particleGeneration == null) return false;
    if (
      Number(current.particleGeneration) !== Number(generation)
    ) {
      return false;
    }
    hideSphPendingBodyEnvelopePreview(pendingPresentationEl);
    overlay.__sphPendingPresentation = Object.freeze({
      ...current,
      status: 'control-envelope-preview-retired-after-current-presentation',
      active: false,
      retiredReason: reason,
      retiredAtMs: performance.now(),
      updatedAtMs: performance.now()
    });
    return true;
  }
  function residentPresentationIsAdmitted(renderState, surfaceDraw, options = {}) {
    const proof = resolveSphResidentPresentationProof({
      renderState,
      surfaceDraw,
      ...options
    });
    overlay.__sphResidentPresentationProof = Object.freeze({
      ...proof,
      updatedAtMs: performance.now()
    });
    return proof.admitted === true;
  }
  function waitForCurrentResidentPresentationProof({
    generation = particleSyncGeneration,
    reason = 'resident-presentation-proof-ready',
    requirePresentationWithoutPreview = false,
    requireCurrentSource = false,
    timeoutMs = null
  } = {}) {
    const preview = overlay.__sphPendingPresentation;
    const waitsForBoundPreview = Boolean(preview?.active && preview.particleGeneration != null);
    const normalizedTimeoutMs =
      normalizeSphResidentPresentationProofWaitTimeout(timeoutMs);
    // A caller asking for the current resident source is explicitly waiting
    // for a presentation transition, even after the startup preview retired.
    // Returning the last proof here would let a retained prior-generation
    // surface bypass the exact-generation gate.
    if (
      !waitsForBoundPreview
      && !requirePresentationWithoutPreview
      && !requireCurrentSource
    ) {
      return Promise.resolve(overlay.__sphResidentPresentationProof || null);
    }
    if (
      pendingResidentPresentationProofWait
      && pendingResidentPresentationProofWait.generation === Number(generation)
      && pendingResidentPresentationProofWait.previewSerial === (waitsForBoundPreview
        ? preview.previewSerial
        : null)
      && pendingResidentPresentationProofWait.requireCurrentSource === Boolean(requireCurrentSource)
      && pendingResidentPresentationProofWait.timeoutMs === normalizedTimeoutMs
    ) {
      return pendingResidentPresentationProofWait.promise;
    }
    if (pendingResidentPresentationProofWait) {
      pendingResidentPresentationProofWait.settle?.({
        visible: false,
        admitted: false,
        foregroundProved: false,
        status: 'resident-presentation-proof-wait-superseded'
      });
    }
    let resolveWait;
    const wait = {
      generation: Number(generation),
      previewSerial: waitsForBoundPreview ? preview.previewSerial : null,
      requireCurrentSource: Boolean(requireCurrentSource),
      timeoutMs: normalizedTimeoutMs,
      startedAtMs: performance.now(),
      rafId: null,
      timeoutId: null,
      settled: false,
      resolve: null,
      settle: null,
      promise: new Promise((resolve) => {
        resolveWait = resolve;
      })
    };
    wait.resolve = resolveWait;
    pendingResidentPresentationProofWait = wait;
    const settle = (result) => {
      if (wait.settled) return;
      wait.settled = true;
      if (wait.rafId != null) {
        window.cancelAnimationFrame(wait.rafId);
        wait.rafId = null;
      }
      if (wait.timeoutId != null) {
        window.clearTimeout(wait.timeoutId);
        wait.timeoutId = null;
      }
      if (pendingResidentPresentationProofWait === wait) {
        pendingResidentPresentationProofWait = null;
      }
      const currentPreview = overlay.__sphPendingPresentation || null;
      // Keep compact liveness evidence on the mounted overlay: a stale
      // generation, preview replacement, or watchdog result otherwise leaves
      // the native startup gate looking merely "pending" after the wait has
      // already settled.
      overlay.__sphResidentPresentationProofWait = Object.freeze({
        schema: 'peercompute.ulg.sph-resident-presentation-proof-wait.v0',
        status: result?.status || 'resident-presentation-proof-wait-settled',
        visible: result?.visible === true,
        admitted: result?.admitted === true,
        foregroundProved: result?.foregroundProved === true,
        generation: wait.generation,
        currentParticleGeneration: particleSyncGeneration,
        previewSerial: wait.previewSerial,
        currentPreviewSerial: currentPreview?.previewSerial ?? null,
        currentPreviewParticleGeneration: currentPreview?.particleGeneration ?? null,
        requireCurrentSource: wait.requireCurrentSource,
        timeoutMs: wait.timeoutMs,
        elapsedMs: Math.max(0, performance.now() - wait.startedAtMs),
        updatedAtMs: performance.now()
      });
      resolveWait(result);
    };
    wait.settle = settle;
    const waitHasGoneStale = () => {
      const currentPreview = overlay.__sphPendingPresentation;
      return !overlay.isConnected
        || Number(generation) !== Number(particleSyncGeneration)
        || (wait.previewSerial != null && (
          !currentPreview?.active
          || currentPreview.previewSerial !== wait.previewSerial
          || Number(currentPreview.particleGeneration) !== Number(generation)
        ));
    };
    const timeoutResult = () => ({
      ...(overlay.__sphResidentPresentationProof || {}),
      visible: false,
      admitted: false,
      foregroundProved: false,
      status: 'resident-presentation-proof-wait-timeout',
      timeoutMs: wait.timeoutMs,
      requireCurrentSource: wait.requireCurrentSource
    });
    const poll = () => {
      if (waitHasGoneStale()) {
        settle({
          visible: false,
          admitted: false,
          foregroundProved: false,
          status: 'resident-presentation-proof-wait-stale-or-complete'
        });
        return;
      }
      const renderState = scene.getSphResidentRenderState?.()
        || overlay.__sphResidentRenderState
        || null;
      const surfaceDraw = scene.getSphResidentSurfaceDraw?.()
        || overlay.__sphResidentSurfaceDraw
        || null;
      if (residentPresentationIsAdmitted(renderState, surfaceDraw, {
        requireCurrentSource: wait.requireCurrentSource
      })) {
        overlay.__sphResidentRenderState = renderState;
        overlay.__sphResidentSurfaceDraw = surfaceDraw;
        completePendingBodyEnvelopePreview({ generation, reason });
        renderStatus();
        updateWarningBanner();
        settle(overlay.__sphResidentPresentationProof);
        return;
      }
      if (
        wait.timeoutMs != null
        && (performance.now() - wait.startedAtMs) >= wait.timeoutMs
      ) {
        settle(timeoutResult());
        return;
      }
      wait.rafId = window.requestAnimationFrame(poll);
    };
    // requestAnimationFrame is suspended in a background tab. Keep a real
    // wall-clock watchdog so a presentation-admission stall cannot retain the
    // mechanics scheduler indefinitely; the next foreground frame can retry.
    if (wait.timeoutMs != null) {
      wait.timeoutId = window.setTimeout(() => {
        if (wait.settled) return;
        if (waitHasGoneStale()) {
          settle({
            visible: false,
            admitted: false,
            foregroundProved: false,
            status: 'resident-presentation-proof-wait-stale-or-complete'
          });
          return;
        }
        const renderState = scene.getSphResidentRenderState?.()
          || overlay.__sphResidentRenderState
          || null;
        const surfaceDraw = scene.getSphResidentSurfaceDraw?.()
          || overlay.__sphResidentSurfaceDraw
          || null;
        if (residentPresentationIsAdmitted(renderState, surfaceDraw, {
          requireCurrentSource: wait.requireCurrentSource
        })) {
          overlay.__sphResidentRenderState = renderState;
          overlay.__sphResidentSurfaceDraw = surfaceDraw;
          completePendingBodyEnvelopePreview({ generation, reason });
          renderStatus();
          updateWarningBanner();
          settle(overlay.__sphResidentPresentationProof);
          return;
        }
        settle(timeoutResult());
      }, wait.timeoutMs);
    }
    wait.rafId = window.requestAnimationFrame(poll);
    return wait.promise;
  }
  function currentNativeSurfaceCandidateCompletionHandoff(
    execution = null,
    { allowSurfaceDrawRequestFallback = true } = {}
  ) {
    const surfaceDraw = scene.getSphResidentSurfaceDraw?.()
      || overlay.__sphResidentSurfaceDraw
      || null;
    const selection =
      resolveSphNativeSurfaceCandidateCompletionRequestSelection({
        surfaceRequest: surfaceDraw?.nativeSurfaceCandidateValidationRequest || null,
        scheduler: scene?.scene?.userData
          ?.sphNativeSurfaceCandidateValidationScheduler || null,
        execution,
        allowSurfaceDrawRequestFallback
      });
    const request = selection.request;
    const handoff = scene.getSphNativeSurfaceCandidateValidationCompletion?.({
      requestToken: request?.token ?? null,
      lifecycleGeneration: request?.lifecycleGeneration ?? null,
      candidateGeneration: request?.candidateGeneration ?? null,
      sourceResidentExecutionGeneration:
        selection.expectedResidentExecutionGeneration,
      sourceResidentStepsSignature:
        selection.expectedResidentStepsSignature,
      sourceResidentStepSignature:
        selection.expectedResidentStepSignature
    }) || null;
    return {
      request,
      handoff,
      expectedResidentExecutionGeneration:
        selection.expectedResidentExecutionGeneration,
      expectedResidentStepsSignature: selection.expectedResidentStepsSignature,
      expectedResidentStepSignature: selection.expectedResidentStepSignature,
      selection
    };
  }
  function waitForNativeSurfaceCandidateCompletionHandoff(
    handoff,
    { timeoutMs = null } = {}
  ) {
    const normalizedTimeoutMs =
      normalizeSphResidentPresentationProofWaitTimeout(timeoutMs);
    const startedAtMs = performance.now();
    if (!handoff?.completion || typeof handoff.completion.then !== 'function') {
      return Promise.resolve({
        schema: 'peercompute.ulg.sph-native-surface-candidate-completion-handoff-wait.v0',
        status: 'native-surface-candidate-completion-handoff-unavailable',
        handoffWaitStatus: 'unavailable',
        handoffAvailable: false,
        timedOut: false,
        elapsedMs: 0
      });
    }
    return new Promise((resolve) => {
      let settled = false;
      let timeoutId = null;
      const settle = (result) => {
        if (settled) return;
        settled = true;
        if (timeoutId != null) window.clearTimeout(timeoutId);
        resolve({
          ...result,
          handoffWaitStatus: result?.handoffWaitStatus || 'settled',
          handoffAvailable: true,
          timedOut: result?.timedOut === true,
          elapsedMs: Math.max(0, performance.now() - startedAtMs)
        });
      };
      if (normalizedTimeoutMs != null) {
        timeoutId = window.setTimeout(() => {
          settle({
            schema: 'peercompute.ulg.sph-native-surface-candidate-completion-handoff-wait.v0',
            status: 'native-surface-candidate-completion-handoff-timeout',
            handoffWaitStatus: 'timeout',
            published: false,
            timedOut: true
          });
        }, normalizedTimeoutMs);
      }
      Promise.resolve(handoff.completion).then((result) => {
        settle(result);
      }).catch((error) => {
        settle({
          schema: 'peercompute.ulg.sph-native-surface-candidate-completion-handoff-wait.v0',
          status: 'native-surface-candidate-completion-handoff-error',
          handoffWaitStatus: 'error',
          published: false,
          reason: error instanceof Error ? error.message : String(error)
        });
      });
    });
  }
  function residentExecutionIsCurrentForNativePresentationRecovery(execution) {
    const currentExecution = scene.getMlsMpmResidentSteps?.() || null;
    if (!execution || currentExecution !== execution) return false;
    const expectedGeneration = execution?.residentExecutionGeneration
      ?? execution?.finalStep?.residentExecutionGeneration
      ?? null;
    const currentGeneration = currentExecution?.residentExecutionGeneration
      ?? currentExecution?.finalStep?.residentExecutionGeneration
      ?? null;
    const expectedStepsSignature = execution?.signature ?? null;
    const currentStepsSignature = currentExecution?.signature ?? null;
    const expectedStepSignature = execution?.finalStep?.signature ?? null;
    const currentStepSignature = currentExecution?.finalStep?.signature ?? null;
    return Boolean(
      Number.isSafeInteger(Number(expectedGeneration))
      && Number(expectedGeneration) === Number(currentGeneration)
      && expectedStepsSignature != null
      && expectedStepsSignature === currentStepsSignature
      && expectedStepSignature != null
      && expectedStepSignature === currentStepSignature
    );
  }
  function nativeSurfaceCameraPresentationFingerprint() {
    const camera = scene?.camera || null;
    if (!camera?.projectionMatrix?.elements || !camera?.matrixWorld?.elements) {
      return null;
    }
    camera.updateMatrixWorld?.();
    return [
      ...Array.from(camera.projectionMatrix.elements, Number),
      ...Array.from(camera.matrixWorld.elements, Number),
      Number(camera.position?.x),
      Number(camera.position?.y),
      Number(camera.position?.z)
    ];
  }
  function waitForNativeSurfaceCameraPresentationToSettle({
    isCurrent = () => true,
    timeoutMs = NATIVE_SURFACE_CAMERA_PRESENTATION_SETTLE_WAIT_MS
  } = {}) {
    const startedAtMs = performance.now();
    const normalizedTimeoutMs = Math.max(0, Number(timeoutMs) || 0);
    return new Promise((resolve) => {
      let settled = false;
      let rafId = null;
      let timeoutId = null;
      let anchorFingerprint = null;
      let stableFrameCount = 0;
      let interactionWaitFrameCount = 0;
      let settleWindowStartedAtMs = null;
      let snappedInteractionEndSequence = null;
      let lastCameraInteraction = null;
      let lastDampingSettle = null;
      let watchdogGeneration = 0;
      const readCameraInteraction = () => {
        if (typeof scene?.getNativeSurfaceCameraInteractionState !== 'function') {
          return null;
        }
        return scene.getNativeSurfaceCameraInteractionState();
      };
      const clearSettleWatchdog = () => {
        watchdogGeneration += 1;
        if (timeoutId != null) {
          window.clearTimeout(timeoutId);
          timeoutId = null;
        }
      };
      const resetPostInteractionSettleWindow = () => {
        clearSettleWatchdog();
        anchorFingerprint = null;
        stableFrameCount = 0;
        settleWindowStartedAtMs = null;
        snappedInteractionEndSequence = null;
      };
      const settle = (status, extra = {}) => {
        if (settled) return;
        settled = true;
        if (rafId != null) window.cancelAnimationFrame(rafId);
        clearSettleWatchdog();
        const completedAtMs = performance.now();
        resolve(Object.freeze({
          schema: 'peercompute.ulg.sph-native-surface-camera-presentation-settle.v0',
          status,
          settled: status === 'native-surface-camera-presentation-settled',
          stableFrameCount,
          anchorTolerance:
            SPH_NATIVE_SURFACE_CAMERA_PRESENTATION_SETTLE_ABSOLUTE_TOLERANCE,
          // The bounded watchdog begins only after the controller has observed
          // an interaction end and deterministically consumed its damping
          // delta. An intentional long drag cannot spend the proof budget.
          elapsedMs: Math.max(
            0,
            completedAtMs - (settleWindowStartedAtMs ?? completedAtMs)
          ),
          totalElapsedMs: Math.max(0, completedAtMs - startedAtMs),
          interactionWaitElapsedMs: Math.max(
            0,
            (settleWindowStartedAtMs ?? completedAtMs) - startedAtMs
          ),
          interactionWaitFrameCount,
          cameraInteraction: lastCameraInteraction,
          dampingSettle: lastDampingSettle,
          ...extra
        }));
      };
      const armPostInteractionSettleWatchdog = () => {
        clearSettleWatchdog();
        const armGeneration = watchdogGeneration;
        timeoutId = window.setTimeout(() => {
          if (settled || armGeneration !== watchdogGeneration) return;
          const interaction = readCameraInteraction();
          lastCameraInteraction = interaction;
          // A fresh user gesture takes ownership of the controller. Leave the
          // native gate held and restart the bounded window only after its end
          // is observed and snapped on a later RAF.
          if (interaction?.active === true) {
            resetPostInteractionSettleWindow();
            rafId = window.requestAnimationFrame(poll);
            return;
          }
          settle('native-surface-camera-presentation-settle-timeout');
        }, normalizedTimeoutMs);
      };
      const poll = () => {
        rafId = null;
        if (!isCurrent()) {
          settle('native-surface-camera-presentation-settle-stale');
          return;
        }
        const interaction = readCameraInteraction();
        if (!interaction) {
          settle('native-surface-camera-presentation-settle-controller-unavailable');
          return;
        }
        lastCameraInteraction = interaction;
        if (interaction.active === true) {
          interactionWaitFrameCount += 1;
          resetPostInteractionSettleWindow();
          rafId = window.requestAnimationFrame(poll);
          return;
        }
        const interactionEndSequence = Number(interaction.endSequence);
        if (!Number.isSafeInteger(interactionEndSequence)) {
          settle('native-surface-camera-presentation-settle-controller-invalid');
          return;
        }
        if (snappedInteractionEndSequence !== interactionEndSequence) {
          if (typeof scene?.settleNativeSurfaceCameraDampingForPresentation !== 'function') {
            settle('native-surface-camera-presentation-settle-controller-unavailable');
            return;
          }
          lastDampingSettle =
            scene.settleNativeSurfaceCameraDampingForPresentation({
              expectedInteractionEndSequence: interactionEndSequence
            });
          if (lastDampingSettle?.settled !== true) {
            if (
              lastDampingSettle?.status
              === 'native-surface-camera-damping-settle-interaction-active'
            ) {
              resetPostInteractionSettleWindow();
              rafId = window.requestAnimationFrame(poll);
              return;
            }
            settle('native-surface-camera-presentation-settle-damping-snap-failed');
            return;
          }
          snappedInteractionEndSequence = interactionEndSequence;
          anchorFingerprint = null;
          stableFrameCount = 0;
          settleWindowStartedAtMs = performance.now();
          armPostInteractionSettleWatchdog();
        }
        const fingerprint = nativeSurfaceCameraPresentationFingerprint();
        if (!fingerprint) {
          settle('native-surface-camera-presentation-settle-unavailable');
          return;
        }
        // Compare every RAF to one fixed anchor, not merely its immediate
        // predecessor. Consecutive damping deltas can each be tiny while the
        // cumulative camera move remains large enough to invalidate a staged
        // candidate. Six anchored samples at 1e-7 bound the remaining tail
        // inside the scene's 1e-6 camera-only snapshot admission tolerance.
        if (!anchorFingerprint) {
          anchorFingerprint = fingerprint;
          stableFrameCount = 0;
        } else if (sphNativeSurfaceCameraPresentationFingerprintsMatch(
          anchorFingerprint,
          fingerprint
        )) {
          stableFrameCount += 1;
        } else {
          anchorFingerprint = fingerprint;
          stableFrameCount = 0;
        }
        if (stableFrameCount >= NATIVE_SURFACE_CAMERA_PRESENTATION_SETTLE_FRAME_COUNT) {
          settle('native-surface-camera-presentation-settled');
          return;
        }
        if (
          settleWindowStartedAtMs != null
          && (performance.now() - settleWindowStartedAtMs) >= normalizedTimeoutMs
        ) {
          settle('native-surface-camera-presentation-settle-timeout');
          return;
        }
        rafId = window.requestAnimationFrame(poll);
      };
      poll();
    });
  }
  function resolveNativeSurfaceCameraPresentationRecoveryFailure(
    context = residentNativeSurfaceCameraPresentationRecoveryContext
  ) {
    const gate = residentPostStepPresentationGate || null;
    const scheduler = scene?.scene?.userData
      ?.sphNativeSurfaceCandidateValidationScheduler || null;
    const sourceStillCurrent = Boolean(
      context?.isCurrent?.() === true
      && residentExecutionIsCurrentForNativePresentationRecovery(context?.execution)
    );
    const eligibility =
      resolveSphNativeSurfaceCameraPresentationRecoveryEligibility({
        context,
        gate,
        scheduler,
        sourceStillCurrent
      });
    return Object.freeze({
      ...eligibility,
      schema: 'peercompute.ulg.sph-native-surface-camera-presentation-recovery-failure.v0',
      schedulerStatus: scheduler?.status ?? null,
      schedulerReason: scheduler?.reason ?? null,
      terminalStatus: scheduler?.terminalStatus ?? null,
      terminalReason: scheduler?.terminalReason ?? null,
      updatedAtMs: performance.now()
    });
  }
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
      // A direct scene refresh must derive pressure from this completed
      // reaction generation. Supplying the prior interface state here lets a
      // stale spatial ledger outrank the new compact H2 ledger indefinitely.
      pressureInterfaceState: currentResidentComputeManagerMode() === 'direct'
        ? null
        : (scene.getSphResidentPressureInterfaceState?.()
          || overlay.__sphResidentPressureInterfaceState
          || null),
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
    if (simulationRuntimeBlocked()) {
      blockedError = new Error(simulationRuntimeAdmission.reason);
      return null;
    }
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
        bodies: controlOptions.initialBodies,
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
    publishPendingBodyEnvelopePreview({
      reason: 'initial-material-closure-pending',
      generation
    });
    statusEl.textContent = 'submitting initial material state and derived chemistry to ulg-runtime worker...';
    initialWorkerRebuildPromise = Promise.resolve(runtime.runSphPhaseRebuild(taskOptions))
      .then((result) => ({ result, generation, submittedAtMs, reason: 'initial-load' }))
      .catch((error) => ({ error, generation, submittedAtMs, reason: 'initial-load' }));
  } else {
    blockSphSimulationRuntime(
      'the required ULG runtime worker is unavailable; no main-thread simulation will be created',
      { source: 'initial-runtime-worker-admission' }
    );
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
    stageMechanicsTraceEnabled: initialStageMechanicsTraceEnabled,
    boxDimsM: sceneBoxDimsM,
    surfaceRadiusScale: blobScaleOf(),
    preserveDrawingBuffer: preserveDrawingBufferForCapture,
    rendererBackend: initialSphRendererBackend,
    rendererWebGpuPresentation: initialThreeWebGpuRendererPresentationEnabled,
    rendererWebGpuResidentDevice: initialThreeWebGpuRendererResidentDeviceEnabled,
    rendererWebGpuPresentationUnsafe: initialThreeWebGpuRendererPresentationUnsafe,
    rendererWebGpuSurfaceBufferPresentation: initialThreeWebGpuSurfaceBufferPresentationEnabled,
    rendererWebGpuDeviceResult: initialRendererWebGpuDeviceResult,
    residentGpuTimestampProfiling:
      initialResidentGpuTimestampProfilingEnabled,
    sourceLocalRenderField: initialSourceLocalRenderFieldEnabled,
    residentSurfaceDrawOverlay: residentSurfaceDrawOverlayMode,
    residentSurfaceDrawDiagnosticMode: currentResidentSurfaceDrawDiagnosticMode(),
    backgroundColor: backgroundColorOf(),
    lightingMode: lightingModeOf(),
    nativeSurfacePixelValidation: nativeSurfacePixelValidationEnabled,
    workerOffscreenPresentation: workerOffscreenPresentationEnabled,
    workerParticleOverlay: initialWorkerParticleOverlayEnabled,
    renderOwnershipPolicy: initialPeerComputeRenderOwnershipPolicy,
    materialInterfaceSurfaceTablePolicy: initialMaterialInterfaceSurfaceTablePolicy,
    residentAuthorityHost: currentResidentAuthorityHostForScene(),
    cameraPositionNormalized: initialCameraPositionNormalized,
    cameraTargetNormalized: initialCameraTargetNormalized
  });
  applySchroederRenderProxyOverlayFlag(scene);
  overlay.__sphScene = scene;
  overlay.__sphSceneBackgroundColor = scene.scene?.userData?.sphSceneBackgroundColor || null;
  overlay.__sphSceneLighting = scene.getLightingMode?.() || null;
  applyBackgroundImageFromControl('initial-url-controls', { refresh: false });
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
  // The authority host can become ready before the first particle upload and
  // attempt to start resident playback. A native surface has no safe visible
  // fallback at that point: hold those early schedules until the initial
  // runtime-admitted presentation has committed.
  let residentStartupPresentationGate = residentSurfaceDrawModeUsesNativeSurfaceConsumer(
    currentResidentSurfaceDrawDiagnosticMode()
  )
    ? {
      schema: 'peercompute.ulg.sph-native-surface-startup-presentation-gate.v0',
      status: 'native-surface-startup-awaiting-initial-particle-presentation',
      active: true,
      generation: null,
      reason: 'resident playback must not supersede the first native surface candidate before presentation admission',
      updatedAtMs: performance.now()
    }
    : null;
  overlay.__sphResidentStartupPresentationGate = residentStartupPresentationGate;
  // A completed resident batch may retain the last runtime-admitted native
  // surface while its exact successor is still validating. If that successor
  // fails the bounded proof, this independent gate prevents both the
  // continuation chain and the playback RAF from immediately superseding it.
  let residentPostStepPresentationGate = null;
  overlay.__sphResidentPostStepPresentationGate = residentPostStepPresentationGate;
  let residentStartupPresentationDeferredManualIntent = null;
  let residentStartupPresentationHandoff = null;

  function deferResidentStartupPresentationManualIntent({
    kind = 'resident-schedule',
    scheduleOptions = null,
    reason = 'manual resident action arrived before the first native presentation proof'
  } = {}) {
    const gateGenerationRaw = residentStartupPresentationGate?.generation;
    const gateGeneration = Number(gateGenerationRaw);
    if (
      !residentStartupPresentationGate?.active
      || gateGenerationRaw == null
      || !Number.isSafeInteger(gateGeneration)
      || gateGeneration !== Number(particleSyncGeneration)
    ) {
      return false;
    }
    const normalizedKind = kind === 'cpu-driver-step' ? 'cpu-driver-step' : 'resident-schedule';
    const normalizedScheduleOptions = normalizedKind === 'resident-schedule'
      ? Object.freeze({ ...(scheduleOptions || {}) })
      : null;
    residentStartupPresentationDeferredManualIntent = Object.freeze({
      schema: 'peercompute.ulg.sph-native-surface-startup-deferred-manual-intent.v0',
      status: 'resident-manual-action-deferred-for-initial-native-presentation',
      kind: normalizedKind,
      generation: gateGeneration,
      scheduleOptions: normalizedScheduleOptions,
      reason,
      updatedAtMs: performance.now()
    });
    overlay.__sphResidentStartupDeferredManualIntent = residentStartupPresentationDeferredManualIntent;
    return true;
  }

  function drainResidentStartupPresentationDeferredManualIntent({
    generation = particleSyncGeneration,
    gateStatus = residentStartupPresentationGate?.status || null
  } = {}) {
    const intent = residentStartupPresentationDeferredManualIntent;
    if (!intent || Number(intent.generation) !== Number(generation)) return false;
    residentStartupPresentationDeferredManualIntent = null;
    overlay.__sphResidentStartupDeferredManualIntent = Object.freeze({
      ...intent,
      status: 'resident-manual-action-deferred-intent-drained-after-native-startup-gate-release',
      startupGateStatus: gateStatus,
      drainedAtMs: performance.now(),
      updatedAtMs: performance.now()
    });
    window.requestAnimationFrame(() => {
      if (
        !overlay.isConnected
        || Number(generation) !== Number(particleSyncGeneration)
        || residentStartupPresentationGate?.active
      ) {
        return;
      }
      if (intent.kind === 'cpu-driver-step') {
        stepDemoForVisualTest(1);
        return;
      }
      scheduleMlsMpmResidentSteps({
        ...(intent.scheduleOptions || {}),
        generation
      });
    });
    return true;
  }

  function settleResidentStartupPresentationGate({
    generation = particleSyncGeneration,
    presentationAdmitted = null,
    presentationVisible = false,
    presentationProof = null,
    presentationProofWait = null,
    refreshError = null
  } = {}) {
    const settledGate = resolveSphNativeSurfaceStartupPresentationGateSettlement({
      gate: residentStartupPresentationGate,
      generation,
      currentGeneration: particleSyncGeneration,
      presentationAdmitted,
      presentationVisible,
      presentationProof,
      presentationProofWait,
      refreshError,
      updatedAtMs: performance.now()
    });
    if (settledGate === residentStartupPresentationGate) return false;
    residentStartupPresentationGate = settledGate;
    overlay.__sphResidentStartupPresentationGate = settledGate;
    drainResidentStartupPresentationDeferredManualIntent({
      generation,
      gateStatus: settledGate?.status || null
    });
    return true;
  }

  function clearResidentStartupPresentationDeferredManualIntent(reason) {
    if (!residentStartupPresentationDeferredManualIntent) return false;
    const staleIntent = residentStartupPresentationDeferredManualIntent;
    residentStartupPresentationDeferredManualIntent = null;
    overlay.__sphResidentStartupDeferredManualIntent = Object.freeze({
      ...staleIntent,
      status: 'resident-manual-action-deferred-intent-cleared',
      clearedReason: reason,
      clearedAtMs: performance.now(),
      updatedAtMs: performance.now()
    });
    return true;
  }

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
  let pendingInitialResidentVisualRefreshPromise = null;
  let pendingMlsMpmResidentStepsToken = 0;
  let pendingResidentInterfaceRefreshPromise = null;
  let residentInterfaceRefreshToken = 0;
  let pendingMountedMechanicsStageWorkerLanePromise = null;
  let mountedMechanicsStageWorkerRunner = null;
  let mountedMechanicsStageWorkerRunnerHost = null;
  let mountedMechanicsStageWorkerLaneSequence = 0;
  let particleSyncGeneration = 0;
  let residentNativeSurfaceCameraPresentationRecovery = null;
  let residentNativeSurfaceCameraPresentationRecoveryEpoch = 0;
  overlay.__sphNativeSurfaceCameraPresentationRecovery =
    residentNativeSurfaceCameraPresentationRecovery;
  let residentNativeSurfaceCameraPresentationRecoveryContext = null;
  let workerLaneNativeSurfacePresentationMirror = null;
  const releaseWorkerLaneNativeSurfacePresentationMirror = (
    source = workerLaneNativeSurfacePresentationMirror
  ) => {
    if (!source) return Promise.resolve(false);
    if (workerLaneNativeSurfacePresentationMirror === source) {
      workerLaneNativeSurfacePresentationMirror = null;
    }
    return Promise.resolve(source.releaseAfterQueue?.()).catch(() => false);
  };
  const adoptWorkerLaneNativeSurfacePresentationMirror = (source) => {
    const previous = workerLaneNativeSurfacePresentationMirror;
    workerLaneNativeSurfacePresentationMirror = source || null;
    if (previous && previous !== source) {
      void Promise.resolve(previous.releaseAfterQueue?.()).catch(() => false);
    }
    return workerLaneNativeSurfacePresentationMirror;
  };
  // A completed candidate can publish after the bounded post-step handoff
  // wait. Keep this recovery single-flight and generation-guarded: it may
  // only re-prove a scheduler-current exact receipt, never revive a reset or
  // a superseded gate.
  let residentNativeSurfaceLatePresentationRecovery = null;
  let residentNativeSurfaceLatePresentationRecoveryEpoch = 0;
  overlay.__sphNativeSurfaceLatePresentationRecovery =
    residentNativeSurfaceLatePresentationRecovery;
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
    residentCompletionThroughputFps: null,
    residentCompletionThroughputEwmaFps: null,
    lastResidentCompletionAtMs: null,
    lastResidentCompletionStepCount: 0,
    lastResidentCompletionElapsedMs: null,
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
    if (!enablePeerComputeResidentHost) {
      blockSphSimulationRuntime('the required PeerCompute resident authority host was disabled', {
        source: 'mount-option'
      });
      publishPeerComputeResidentAuthorityHostStatus('blocked', {
        error: simulationRuntimeAdmission.reason
      });
      return Promise.resolve(null);
    }
    if (peerComputeResidentAuthorityHost || peerComputeResidentAuthorityHostPromise) {
      if (peerComputeResidentAuthorityHost) {
        if (!admitSphSimulationRuntime(peerComputeResidentAuthorityHost.workerCapability)) {
          publishPeerComputeResidentAuthorityHostStatus('blocked', {
            error: simulationRuntimeAdmission.reason
          });
          return Promise.resolve(null);
        }
        scene?.setResidentAuthorityHost?.(peerComputeResidentAuthorityHost);
        publishPeerComputeResidentAuthorityHostStatus('ready');
      }
      return peerComputeResidentAuthorityHostPromise;
    }
    publishPeerComputeResidentAuthorityHostStatus('initializing');
    peerComputeResidentAuthorityHostPromise = ensurePeerComputeResidentAuthorityHost({
      peercomputeModule,
      peercomputeModuleUrl,
      computeTaskModulePath: residentComputeTaskModulePath,
      mechanicsResidentStageWorkerModuleUrl: residentMechanicsStageWorkerModuleUrl,
      renderOwnershipPolicy: initialPeerComputeRenderOwnershipPolicy,
      enableWorkers: initialResidentWorkersEnabled,
      requireWorkers: true,
      workerBootstrapTimeoutMs: 5000,
      enableWebGPU: true,
      fallbackToDirectManagers: false
    })
      .then((host) => {
        if (!admitSphSimulationRuntime(host?.workerCapability)) {
          publishPeerComputeResidentAuthorityHostStatus('blocked', {
            error: simulationRuntimeAdmission.reason
          });
          return null;
        }
        peerComputeResidentAuthorityHost = host;
        globalThis.__ulgResidentAuthorityHost = host;
        scene?.setResidentAuthorityHost?.(host);
        overlay.__sphPeerComputeRenderOwnershipPolicy =
          scene?.getPeerComputeRenderOwnershipPolicy?.()
          || host?.renderOwnershipPolicy
          || initialPeerComputeRenderOwnershipPolicy;
        publishPeerComputeResidentAuthorityHostStatus('ready');
        if (overlay.isConnected) {
          scheduleMlsMpmResidentSteps();
        }
        return host;
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        blockSphSimulationRuntime(message, {
          source: 'resident-authority-host-bootstrap',
          errorCode: error?.code || null
        });
        publishPeerComputeResidentAuthorityHostStatus('blocked', { error: message });
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

  function recordResidentCompletion(count = 1, elapsedMs = null) {
    const completedStepCount = Math.max(1, Math.round(Number(count) || 1));
    const normalizedElapsedMs = Number(elapsedMs);
    const completionThroughputFps =
      Number.isFinite(normalizedElapsedMs) && normalizedElapsedMs > 0
        ? completedStepCount * 1000 / normalizedElapsedMs
        : null;
    const previousEwma = frameCounters.residentCompletionThroughputEwmaFps;
    const completionThroughputEwmaFps = Number.isFinite(completionThroughputFps)
      ? (
        Number.isFinite(previousEwma)
          ? previousEwma + 0.25 * (completionThroughputFps - previousEwma)
          : completionThroughputFps
      )
      : previousEwma;
    const completedAtMs = performance.now();
    Object.assign(frameCounters, {
      residentCompletionThroughputFps: completionThroughputFps,
      residentCompletionThroughputEwmaFps: completionThroughputEwmaFps,
      lastResidentCompletionAtMs: completedAtMs,
      lastResidentCompletionStepCount: completedStepCount,
      lastResidentCompletionElapsedMs:
        Number.isFinite(normalizedElapsedMs) ? normalizedElapsedMs : null
    });
    overlay.__sphFrameCounters = frameCounters;
    updateResidentPerf({
      residentCompletionThroughputFps: completionThroughputFps,
      residentCompletionThroughputEwmaFps: completionThroughputEwmaFps,
      lastResidentCompletionAtMs: completedAtMs,
      lastResidentCompletionStepCount: completedStepCount,
      lastResidentCompletionElapsedMs:
        Number.isFinite(normalizedElapsedMs) ? normalizedElapsedMs : null
    });
  }

  function residentCompletionRateStatusText() {
    const throughput = frameCounters.residentCompletionThroughputFps;
    const ewma = frameCounters.residentCompletionThroughputEwmaFps;
    const completedAtMs = frameCounters.lastResidentCompletionAtMs;
    const completionAgeS = Number.isFinite(completedAtMs)
      ? Math.max(0, (performance.now() - completedAtMs) / 1000)
      : null;
    return [
      `completion=${Number.isFinite(throughput) ? fmt(throughput, 1) : 'pending'} steps/s`,
      `ewma=${Number.isFinite(ewma) ? fmt(ewma, 1) : 'pending'} steps/s`,
      `last=${Number.isFinite(completionAgeS) ? `${fmt(completionAgeS, 1)}s ago` : 'pending'}`
    ].join(' ');
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
        // W4b: the worker-owned resident lane retains its post-step state
        // worker-side (no page-device nextSphParticleState exists); the
        // truthful adopted clock is baseTime + completedStepCount * dt from
        // the terminal schedule envelope.
        ?? scene.getMlsMpmResidentSteps?.()?.workerLaneSimTime?.timeS
        ?? overlay.__mlsMpmResidentSteps?.workerLaneSimTime?.timeS
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
      residentCompletionThroughputFps: null,
      residentCompletionThroughputEwmaFps: null,
      lastResidentCompletionAtMs: null,
      lastResidentCompletionStepCount: 0,
      lastResidentCompletionElapsedMs: null,
      lastResidentCycleMs: null,
      lastResidentPostComputeMs: null,
      lastResidentMaterialInterfaceRefreshMs: null,
      lastResidentPressureInterfaceRefreshMs: null,
      lastResidentInterfaceRefreshMs: null,
      lastRenderReadbackMs: null,
      lastResidentStageTiming: null,
      lastRenderReadbackSkipped: false
    });
    Object.assign(frameCounters, {
      residentCompletionThroughputFps: null,
      residentCompletionThroughputEwmaFps: null,
      lastResidentCompletionAtMs: null,
      lastResidentCompletionStepCount: 0,
      lastResidentCompletionElapsedMs: null
    });
    overlay.__sphFrameCounters = frameCounters;
  }

  function statusIndicatesCpuFallback(status) {
    return typeof status === 'string' && (
      status.includes('cpu-reference')
      || status.includes('fallback')
      || status.includes('blocked-webgpu')
      || status.includes('webgpu-unavailable')
    );
  }

  function currentResidentReadbackTelemetryPending() {
    const pending = overlay.__mlsMpmResidentStepsPending;
    return Boolean(
      pending
      && Number(pending.generation) === Number(particleSyncGeneration)
      && Number(pending.scheduleToken) === Number(pendingMlsMpmResidentStepsToken)
    );
  }

  function currentResidentReadbackTelemetrySources({
    residentSteps = null,
    residentStep = null
  } = {}) {
    const sources = [];
    if (residentSteps != null) sources.push(residentSteps);
    const workerLanePageMirrorsSealed = Boolean(
      residentWorkerLaneContinuationReady(residentSteps)
      && typeof residentSteps?.workerLaneSealedAbsentFields?.finalStep
        === 'string'
      && residentSteps.workerLaneSealedAbsentFields.finalStep.length > 0
    );
    if (
      residentSteps
      && typeof residentSteps === 'object'
      && !Array.isArray(residentSteps)
      && Object.prototype.hasOwnProperty.call(residentSteps, 'finalStep')
    ) {
      const finalStep = residentSteps.finalStep;
      // Worker-owned schedules intentionally seal the page-device finalStep
      // mirror absent. Their exact terminal lane receipt is the continuation
      // authority, so a deliberate null mirror is not a missing telemetry
      // participant. Direct/page-device schedules remain fail-closed.
      if (
        finalStep != null
        || !workerLanePageMirrorsSealed
      ) {
        sources.push(finalStep);
      }
    }
    if (residentStep != null && !workerLanePageMirrorsSealed) {
      sources.push(residentStep);
    }
    return sources;
  }

  function currentResidentExecutionEvidenceAvailable({
    residentSteps = null,
    residentStep = null
  } = {}) {
    return Boolean(
      residentSteps?.finalStep
      || Number(residentSteps?.completedStepCount) > 0
      || residentStep?.schema
    );
  }

  function currentResidentReadbackTelemetryEvidence({
    residentSteps = null,
    residentStep = null
  } = {}) {
    if (currentResidentReadbackTelemetryPending()) {
      return {
        readbackTelemetryComplete: null,
        normalHotLoopReadbackFree: null,
        productionHotLoopHostDependencyFree: null
      };
    }
    return compositePageVisibleGpuReadbackTelemetryEvidence(
      currentResidentReadbackTelemetrySources({ residentSteps, residentStep })
    );
  }

  function currentWarningMessages() {
    const messages = [];
    if (simulationRuntimeBlocked()) {
      messages.push(`Simulation blocked: ${simulationRuntimeAdmission.reason}`);
      return messages;
    }
    if (pendingControlEdit) {
      messages.push('Control changes staged — press Apply, Play, Step, or Reset to apply.');
    }
    if (!navigator?.gpu) {
      messages.push('WebGPU unavailable: simulation admission is blocked.');
    }
    if (overlay.__sphPendingPresentation?.active === true) {
      messages.push('Physics pending: showing control-body envelopes, not simulation output.');
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
    const surfaceDraw = scene.getSphResidentSurfaceDraw?.()
      || overlay.__sphResidentSurfaceDraw
      || null;
    const workerLaneNativeSurfacePresentation =
      overlay.__sphWorkerLaneNativeSurfacePresentation || null;
    const workerLaneNativeSurfacePresentationCurrent =
      residentWorkerLaneNativeSurfacePresentationReady({
        execution: residentSteps,
        presentation: workerLaneNativeSurfacePresentation,
        renderState,
        surfaceDraw
      });
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
    const readbackTelemetryEvidence =
      currentResidentReadbackTelemetryEvidence({
        residentSteps,
        residentStep
      });
    const {
      readbackTelemetryComplete,
      normalHotLoopReadbackFree,
      productionHotLoopHostDependencyFree
    } = readbackTelemetryEvidence;
    const gpuResidencyWarning = residentGpuResidencyWarningMessage({
      pending: currentResidentReadbackTelemetryPending(),
      completedExecutionAvailable: currentResidentExecutionEvidenceAvailable({
        residentSteps,
        residentStep
      }),
      telemetrySources: currentResidentReadbackTelemetrySources({
        residentSteps,
        residentStep
      }),
      readbackTelemetryComplete,
      normalHotLoopReadbackFree,
      productionHotLoopHostDependencyFree
    });
    if (gpuResidencyWarning) messages.push(gpuResidencyWarning);
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
      && !workerLaneNativeSurfacePresentationCurrent
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
    fpsEl.textContent = `render fps ${fmt(frameCounters.renderFps, 1)} | physics fps ${fmt(frameCounters.physicsFps, 1)} | resident fps ${fmt(frameCounters.residentFps, 1)} | resident ${residentCompletionRateStatusText()}${simText}`;
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
    const {
      required,
      particleRenderMode,
      nativeSurfaceConsumerRefresh
    } = residentSurfaceDrawInitialVisualRefreshPlan(mode);
    if (!required) return null;
    const signature = `${generation}|${mode}|${particleRenderMode}`;
    const initialRenderScene = scene;
    const initialRenderPublicationIsCurrent = () => Boolean(
      overlay.isConnected
      && !resetRebuildPending
      && scene === initialRenderScene
      && generation === particleSyncGeneration
      && pendingInitialResidentVisualRefreshSignature === signature
      && currentResidentSurfaceDrawDiagnosticMode() === mode
    );
    if (
      pendingInitialResidentVisualRefreshSignature === signature
      && pendingInitialResidentVisualRefreshPromise
    ) {
      return pendingInitialResidentVisualRefreshPromise;
    }
    pendingInitialResidentVisualRefreshSignature = signature;
    overlay.__mlsMpmResidentAutoSchedule = {
      schema: 'peercompute.ulg.sph-demo-resident-auto-schedule.v0',
      status: 'resident-initial-visual-refresh-scheduled',
      residentAuto: Boolean(initialResidentAutoEnabled),
      residentInitialVisualRefresh: true,
      residentExecutionPolicy,
      generation,
      surfaceDrawDiagnosticMode: mode,
      particleRenderMode,
      updatedAtMs: performance.now()
    };
    publishRenderModeSelection('resident-initial-visual-refresh-scheduled', {
      reason: 'initial t=0 particle presentation is required before resident physics advances',
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
      if (!initialRenderPublicationIsCurrent()) return null;
      overlay.__mlsMpmResidentAutoSchedule = {
        ...(overlay.__mlsMpmResidentAutoSchedule || {}),
        status: 'resident-initial-visual-refresh-pending',
        updatedAtMs: performance.now()
      };
      publishRenderModeSelection('resident-initial-visual-refresh-pending', {
        reason: 'refreshing initial t=0 particle presentation from uploaded buffers',
        generation,
        surfaceDrawDiagnosticMode: mode,
        particleRenderMode
      });
      const renderStartMs = performance.now();
      const cadence = residentRenderReadbackDecision({
        forceDue: true,
        forceReason: 'resident-initial-t0-visual-refresh'
      });
      try {
        const renderState = await initialRenderScene.refreshSphResidentRenderState?.({
          preferWebGpu: true,
          materialProperties: activeMaterialProperties(),
          gasPressureSummary: currentGasPressureSummary(
            overlay.__sphResidentGasPressureSummary
              || activeViewStateGasPressure
              || (driver?.demo ? gasPressureSummary(driver.demo) : null)
          ),
          residentAuthorityHost: currentResidentAuthorityHostForScene(),
          pressureInterfaceGasCellFieldImport:
            initialRenderScene.getSphResidentPressureInterfaceState?.()?.pressureInterfaceGasCellFieldImport || null,
          pressureInterfaceGasCellFieldAdmission:
            initialRenderScene.getSphResidentPressureInterfaceState?.()?.pressureInterfaceGasCellFieldAdmission || null,
          pressureInterfaceGasCellFieldImportStateKey: null,
          renderFieldReadbackMode: nativeSurfaceConsumerRefresh ? SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT : undefined,
          renderRowsReadbackMode: nativeSurfaceConsumerRefresh ? SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT : undefined,
          renderFieldSurfaceSummaryMode:
            (residentSurfaceDrawModeUsesCompactBridge(mode) || nativeSurfaceConsumerRefresh) ? 'skip' : 'auto',
          surfaceDrawDiagnosticMode: mode,
          surfaceDrawDiagnosticModeExplicit: residentSurfaceDrawDiagnosticModeExplicit,
          allowNativeSurfaceExtraction: nativeSurfaceConsumerRefresh ? true : undefined,
          // The t=0 presentation is a visual consumer. It must never publish
          // a competing pressure producer or overwrite a newer physics-owned
          // pressure-interface generation while startup work is in flight.
          skipPressureInterfaceRefresh: true,
          publicationGuard: initialRenderPublicationIsCurrent
        });
        if (!initialRenderPublicationIsCurrent()) return renderState;
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
          reason: 'initial t=0 particle presentation refreshed from uploaded buffers',
          generation,
          surfaceDrawDiagnosticMode: mode,
          particleRenderMode,
          visibleRendererBridge:
            overlay.__sphResidentSurfaceDraw?.visibleRendererBridge
            || renderState?.surfaceDrawVisibleRendererBridge
            || null,
          renderStateStatus: renderState?.status || null
        });
        const initialPresentationProofOptions = nativeSurfaceConsumerRefresh
          ? { requireCurrentSource: true }
          : {};
        let initialPresentationAdmitted = residentPresentationIsAdmitted(
          renderState,
          overlay.__sphResidentSurfaceDraw,
          initialPresentationProofOptions
        );
        let initialPresentationProof = overlay.__sphResidentPresentationProof || null;
        let initialPresentationProofWait = null;
        if (initialPresentationAdmitted) {
          completePendingBodyEnvelopePreview({
            generation,
            reason: 'initial-t0-resident-presentation-ready'
          });
        }
        renderStatus();
        updateWarningBanner();
        if (!initialPresentationAdmitted) {
          initialPresentationProofWait = await waitForCurrentResidentPresentationProof({
            generation,
            reason: 'initial-t0-resident-presentation-admission-ready',
            requirePresentationWithoutPreview: nativeSurfaceConsumerRefresh,
            requireCurrentSource: nativeSurfaceConsumerRefresh,
            timeoutMs: nativeSurfaceConsumerRefresh
              ? NATIVE_SURFACE_CURRENT_PRESENTATION_WAIT_MS
              : null
          });
          if (!initialRenderPublicationIsCurrent()) {
            return renderState;
          }
          initialPresentationAdmitted = residentPresentationIsAdmitted(
            scene.getSphResidentRenderState?.() || renderState,
            scene.getSphResidentSurfaceDraw?.() || overlay.__sphResidentSurfaceDraw,
            initialPresentationProofOptions
          );
          initialPresentationProof = overlay.__sphResidentPresentationProof || null;
        }
        if (nativeSurfaceConsumerRefresh) {
          settleResidentStartupPresentationGate({
            generation,
            presentationAdmitted: initialPresentationAdmitted,
            presentationVisible:
              initialPresentationProof?.visible === true,
            presentationProof: initialPresentationProof,
            presentationProofWait: initialPresentationProofWait
          });
          renderStatus();
          updateWarningBanner();
        }
        return scene.getSphResidentRenderState?.() || renderState;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!initialRenderPublicationIsCurrent()) {
          return null;
        }
        if (nativeSurfaceConsumerRefresh) {
          settleResidentStartupPresentationGate({
            generation,
            presentationVisible: false,
            presentationProof: overlay.__sphResidentPresentationProof || null,
            refreshError: message
          });
        }
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
          reason: 'initial t=0 particle presentation refresh failed',
          generation,
          surfaceDrawDiagnosticMode: mode,
          particleRenderMode,
          error: message
        });
        renderStatus();
        updateWarningBanner();
        return null;
      }
    };
    const refreshPromise = prereqs.length
      ? Promise.allSettled(prereqs).then(runRefresh)
      : Promise.resolve().then(runRefresh);
    pendingInitialResidentVisualRefreshPromise = refreshPromise;
    const clearPendingRefresh = () => {
      if (pendingInitialResidentVisualRefreshSignature === signature) {
        pendingInitialResidentVisualRefreshSignature = null;
        pendingInitialResidentVisualRefreshPromise = null;
      }
    };
    refreshPromise.then(clearPendingRefresh, clearPendingRefresh);
    return refreshPromise;
  }

  function scheduleInitialMlsMpmResidentSteps({ generation = particleSyncGeneration } = {}) {
    const residentExecutionPolicy = residentExecutionPolicyFromUrl();
    const mode = currentResidentSurfaceDrawDiagnosticMode();
    const initialPresentationPlan = resolveSphInitialPresentationSchedulePlan({
      surfaceDrawMode: mode,
      residentAutoEnabled: initialResidentAutoEnabled
    });
    if (initialPresentationPlan.nativeSurfaceConsumerRefresh) {
      residentPostStepPresentationGate = null;
      overlay.__sphResidentPostStepPresentationGate = residentPostStepPresentationGate;
      residentNativeSurfaceCameraPresentationRecovery = null;
      overlay.__sphNativeSurfaceCameraPresentationRecovery = null;
      residentNativeSurfaceCameraPresentationRecoveryEpoch += 1;
      residentNativeSurfaceCameraPresentationRecoveryContext = null;
      residentNativeSurfaceLatePresentationRecoveryEpoch += 1;
      residentNativeSurfaceLatePresentationRecovery = null;
      overlay.__sphNativeSurfaceLatePresentationRecovery = null;
      clearResidentStartupPresentationDeferredManualIntent(
        'a newer native startup presentation generation superseded the prior deferred manual intent'
      );
      residentStartupPresentationGate = {
        schema: 'peercompute.ulg.sph-native-surface-startup-presentation-gate.v0',
        status: 'native-surface-startup-initial-presentation-pending',
        active: true,
        generation,
        reason: 'resident playback is held until the first native surface has exact presentation admission',
        updatedAtMs: performance.now()
      };
      overlay.__sphResidentStartupPresentationGate = residentStartupPresentationGate;
      residentStartupPresentationHandoff = initialPresentationPlan.scheduleResidentPhysics
        ? {
          schema: 'peercompute.ulg.sph-native-surface-startup-handoff.v0',
          status: 'native-surface-startup-handoff-awaiting-initial-resident-schedule',
          active: true,
          generation,
          reason: 'the direct driver must not mutate the admitted t=0 generation before the initial resident batch is submitted',
          updatedAtMs: performance.now()
        }
        : null;
      overlay.__sphResidentStartupPresentationHandoff = residentStartupPresentationHandoff;
    } else {
      residentStartupPresentationGate = null;
      overlay.__sphResidentStartupPresentationGate = null;
      residentPostStepPresentationGate = null;
      overlay.__sphResidentPostStepPresentationGate = null;
      residentNativeSurfaceCameraPresentationRecovery = null;
      overlay.__sphNativeSurfaceCameraPresentationRecovery = null;
      residentNativeSurfaceCameraPresentationRecoveryEpoch += 1;
      residentNativeSurfaceCameraPresentationRecoveryContext = null;
      residentNativeSurfaceLatePresentationRecoveryEpoch += 1;
      residentNativeSurfaceLatePresentationRecovery = null;
      overlay.__sphNativeSurfaceLatePresentationRecovery = null;
      residentStartupPresentationHandoff = null;
      overlay.__sphResidentStartupPresentationHandoff = null;
    }
    if (initialPresentationPlan.required) {
      const initialPresentation = scheduleInitialResidentVisualRefreshForBridge({
        generation,
        residentExecutionPolicy
      });
      if (!initialPresentationPlan.scheduleResidentPhysics) return;
      Promise.resolve(initialPresentation).then(() => {
        if (!overlay.isConnected || generation !== particleSyncGeneration) return;
        if (residentStartupPresentationGate?.active) {
          overlay.__mlsMpmResidentAutoSchedule = {
            ...(overlay.__mlsMpmResidentAutoSchedule || {}),
            status: 'resident-auto-schedule-held-for-initial-native-presentation',
            residentAuto: true,
            residentInitialVisualRefresh: true,
            residentPhysicsOrder: initialPresentationPlan.residentPhysicsOrder,
            residentStartupPresentationGate,
            updatedAtMs: performance.now()
          };
          updateResidentPerf({
            residentStepsPerSchedule: currentResidentStepsPerSchedule(),
            residentAutoScheduleStatus: 'resident-auto-schedule-held-for-initial-native-presentation'
          });
          renderStatus();
          updateWarningBanner();
          return;
        }
        overlay.__mlsMpmResidentAutoSchedule = {
          ...(overlay.__mlsMpmResidentAutoSchedule || {}),
          status: 'resident-auto-schedule-enabled-after-initial-visual-refresh',
          residentAuto: true,
          residentInitialVisualRefresh: true,
          residentPhysicsOrder: initialPresentationPlan.residentPhysicsOrder,
          updatedAtMs: performance.now()
        };
        updateResidentPerf({
          residentStepsPerSchedule: currentResidentStepsPerSchedule(),
          residentAutoScheduleStatus: 'resident-auto-schedule-enabled-after-initial-visual-refresh'
        });
        window.requestAnimationFrame(() => {
          if (!overlay.isConnected || generation !== particleSyncGeneration) return;
          if (
            residentStartupPresentationHandoff?.active
            && Number(residentStartupPresentationHandoff.generation) === Number(generation)
          ) {
            residentStartupPresentationHandoff = {
              ...residentStartupPresentationHandoff,
              status: 'native-surface-startup-handoff-initial-resident-schedule-submitted',
              active: false,
              submittedAtMs: performance.now(),
              updatedAtMs: performance.now()
            };
            overlay.__sphResidentStartupPresentationHandoff = residentStartupPresentationHandoff;
          }
          scheduleMlsMpmResidentSteps({
            stepCount: currentResidentStepsPerSchedule(),
            generation
          });
        });
      });
      return;
    }
    completePendingBodyEnvelopePreview({
      generation,
      reason: 'synchronous-particle-surface-presentation-ready'
    });
    if (!initialPresentationPlan.scheduleResidentPhysics) {
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
    workerLaneProgressEverySteps = 1,
    readbackMode = SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT,
    residentStageWorkersEnabled = false,
    fuseNoFullResidentMechanicsSequence = false,
    fuseNoFullResidentMechanicsActiveGrid = false,
    activeGridSafetyCells = null,
    measureFusedSequenceQueueFence = false,
    schroederSimulation = false,
    schroederContactSolverEnabled = true,
    schroederContactJacobiIterations = null,
    schroederContactCleanupPassBudget = null,
    schroederSelectedLevel = 0,
    schroederBaseGridSpacingM = null,
    schroederMinLevel = null,
    schroederMaxLevel = null,
    schroederSpatialArenaCount = null,
    schroederTileCellCount = null,
    schroederEnablePortableSummary = true,
    schroederEnableActiveNodeIndex = true,
    schroederEnableActiveNodeSortedIndex = false,
    schroederActiveNodeSortedIndexPolicyMode = null,
    schroederLawNeighborTraversalPolicyMode = null,
    schroederLawNeighborCandidateReadbackMode = null,
    schroederEnableCrossLevelCoupling = true,
    schroederEnablePhaseVolumeMigration = true,
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
      `workerProgress=${Math.max(1, Math.round(Number(workerLaneProgressEverySteps) || 1))}`,
      readbackMode,
      Object.entries(physicalLawGroupsFromControls()).map(([key, enabled]) => `${key}:${enabled ? 1 : 0}`).join(','),
      `stageWorkers=${Boolean(residentStageWorkersEnabled) ? 1 : 0}`,
      `fuseSeq=${Boolean(fuseNoFullResidentMechanicsSequence) ? 1 : 0}`,
      `activeGrid=${Boolean(fuseNoFullResidentMechanicsActiveGrid) ? 1 : 0}`,
      `activeGridSafety=${activeGridSafetyCells ?? 'default'}`,
      `queueFence=${Boolean(measureFusedSequenceQueueFence) ? 1 : 0}`,
      `ss=${Boolean(schroederSimulation) ? 1 : 0}`,
      `ssContactSolver=${schroederContactSolverEnabled === false ? 0 : 1}`,
      `ssContactJacobi=${schroederContactJacobiIterations ?? 'preset'}`,
      `ssContactCleanup=${schroederContactCleanupPassBudget ?? 'preset'}`,
      `ssLevel=${schroederSelectedLevel ?? 0}`,
      `ssBaseDx=${schroederBaseGridSpacingM ?? 'auto'}`,
      `ssMin=${schroederMinLevel ?? 'auto'}`,
      `ssMax=${schroederMaxLevel ?? 'auto'}`,
      `ssArenas=${schroederSpatialArenaCount ?? 'default'}`,
      `ssTile=${schroederTileCellCount ?? 'auto'}`,
      `ssPortable=${Boolean(schroederEnablePortableSummary) ? 1 : 0}`,
      `ssIndex=${Boolean(schroederEnableActiveNodeIndex) ? 1 : 0}`,
      `ssSorted=${Boolean(schroederEnableActiveNodeSortedIndex) ? 1 : 0}`,
      `ssSortedPolicy=${schroederActiveNodeSortedIndexPolicyMode ?? 'default'}`,
      `ssTraversal=${schroederLawNeighborTraversalPolicyMode ?? 'default'}`,
      `ssCandidateReadback=${schroederLawNeighborCandidateReadbackMode ?? 'default'}`,
      `ssCross=${Boolean(schroederEnableCrossLevelCoupling) ? 1 : 0}`,
      `ssPhaseVolume=${Boolean(schroederEnablePhaseVolumeMigration) ? 1 : 0}`,
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
    return residentGpuContinuationEvidenceReady(execution);
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
    // The worker-owned SS producer is an admitted ComputeManager lane, not a
    // direct scene execution. Some scenario presets still carry the legacy
    // same-device `direct` cadence hint; allowing that hint to null the
    // manager here makes the worker route structurally impossible even after
    // its render-ownership admission is ready. Worker-lane authority wins
    // because it is the more specific execution contract.
    if (
      policy?.workerOwnedResidentProducerRequested === true
      && policy?.workerOwnedResidentProducerReady === true
    ) {
      return 'compute-manager';
    }
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
    if (initialSchroederSimulationConfig.enabled) {
      // The scenario override is a requested batch size resolved through the
      // interactive presentation policy. With no explicit batch request,
      // worker-owned committed-frame playback defaults to one step per
      // schedule (the retained presentation-only use case to four). An
      // explicit residentStepsPerSchedule request lifts those defaults so the
      // worker lane can amortize the schedule lifecycle across the batch; an
      // explicit residentStepsPerScheduleMax and the global bridge cap still
      // bind, and per-step progress render candidates keep presentation live
      // inside a batch.
      const playbackPolicy = currentPeerComputeRenderOwnershipPolicy();
      const workerLaneRequestedStepCount = positiveIntegerUrlParam(
        playbackPolicy?.residentStepsPerScheduleOverride
      ) ?? RESIDENT_STEPS_PER_SCHEDULE_MAX;
      const workerLanePolicyMax = positiveIntegerUrlParam(
        playbackPolicy?.residentStepsPerScheduleMax
      ) ?? RESIDENT_PARTICLE_BRIDGE_STEPS_PER_SCHEDULE_MAX;
      const evidence = resolveSphMountedScheduleControlEvidence({
        requestedStepCount: initialWorkerOwnedResidentLaneReady
          ? workerLaneRequestedStepCount
          : 1,
        residentStepsPerScheduleMax: workerLanePolicyMax,
        workerLaneActive: initialWorkerOwnedResidentLaneReady
      });
      overlay.__sphResidentScheduleControlEvidence = evidence;
      residentScheduleEffectiveEl.textContent = evidence.workerLaneActive
        ? `effective schedule: ${evidence.effectiveStepCount} step${evidence.effectiveStepCount === 1 ? '' : 's'} `
          + `(requested ${workerLaneRequestedStepCount}, policy maximum ${evidence.policyMaxStepCount})`
        : `effective schedule: waiting for worker lane (requested ${workerLaneRequestedStepCount})`;
      return evidence.effectiveStepCount;
    }
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
    const remoteResidentGasPressure = currentGasPressureSummary(
      overlay.__sphResidentGasPressureSummary
        || activeViewStateGasPressure
        || (driver?.demo ? gasPressureSummary(driver.demo) : null)
    );
    return buildUlgSphMlsMpmRemoteSeedTaskGraph({
      ...optionSource,
      residentAmbientPressurePa: optionSource?.residentAmbientPressurePa
        ?? remoteResidentGasPressure?.pressureFeedback?.externalPressurePa
        ?? remoteResidentGasPressure?.externalPressurePa
        ?? 0,
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
    residentComputeManagerMode = null,
    generation,
    scheduleToken,
    mode,
    interfaceRefreshToken,
    sourceCadence = 'resident-step-completed'
  }) {
    const refreshScene = scene;
    const ownsCurrentRefreshPublication = () =>
      sphResidentInterfaceSchedulePublicationIsCurrent({
        interfaceRefreshToken,
        currentInterfaceRefreshToken: residentInterfaceRefreshToken,
        generation,
        currentGeneration: particleSyncGeneration,
        overlayConnected: overlay.isConnected,
        resetRebuildPending,
        sceneCurrent: refreshScene === scene,
        scheduleToken,
        currentScheduleToken: pendingMlsMpmResidentStepsToken
      });
    const refreshStartMs = performance.now();
    const reportBase = {
      schema: 'peercompute.ulg.sph-demo-resident-interface-refresh.v0',
      status: 'resident-interface-refresh-pending',
      mode,
      interfaceRefreshToken,
      scheduleToken,
      generation,
      sourceCadence,
      startedAtMs: refreshStartMs,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
    if (ownsCurrentRefreshPublication()) {
      overlay.__sphResidentInterfaceRefresh = reportBase;
      publishResidentStageOrderTrace({
        status: 'resident-interface-refresh-pending',
        mode,
        scheduleToken,
        generation,
        sourceCadence
      });
    }
    try {
      const materialStartMs = performance.now();
      const materialInterfaceState = await refreshScene.refreshSphResidentMaterialInterfaceState?.({
        preferWebGpu: true,
        residentSteps: execution,
        materialProperties: activeMaterialProperties(),
        gasPressureSummary: residentGasPressureForRefresh,
        source: 'resident-physics-loop-material-interface-refresh',
        sourceCadence,
        publicationGuard: ownsCurrentRefreshPublication
      });
      const materialMs = performance.now() - materialStartMs;
      if (!ownsCurrentRefreshPublication()) {
        materialInterfaceState?.destroyMaterialInterfaceFieldBuffers?.({
          reason: 'stale-mounted-interface-refresh-after-material-stage'
        });
        return {
          ...reportBase,
          status: 'resident-interface-refresh-stale',
          materialInterfaceStatus: materialInterfaceState?.status ?? null,
          pressureInterfaceStatus: null,
          materialMs,
          pressureMs: 0,
          totalMs: performance.now() - refreshStartMs,
          completedAtMs: performance.now()
        };
      }
      const pressureStartMs = performance.now();
      const pressureInterfaceState = await refreshScene.refreshSphResidentPressureInterfaceState?.({
        preferWebGpu: true,
        gasPressureSummary: residentGasPressureForRefresh,
        residentProductMass: residentProductMassForRefresh,
        reactionSummary: residentReactionSummaryForRefresh,
        reactionTable: refreshScene.getSphReactionTable?.() || null,
        residentAuthorityHost: residentAuthorityHostForSchedule,
        residentComputeManagerMode,
        pressureInterfaceGasCellFieldImport: refreshScene.getSphResidentPressureInterfaceState?.()?.pressureInterfaceGasCellFieldImport || null,
        pressureInterfaceGasCellFieldAdmission: refreshScene.getSphResidentPressureInterfaceState?.()?.pressureInterfaceGasCellFieldAdmission || null,
        pressureInterfaceGasCellFieldImportStateKey: execution?.computeManagerTask?.stateKey || null,
        pressureInterfaceGasCellFieldImportSourceTaskId: execution?.computeManagerTask?.acceptedTaskId
          || execution?.commitDelta?.taskId
          || null,
        source: 'resident-physics-loop-pressure-interface-refresh',
        sourceCadence,
        publicationGuard: ownsCurrentRefreshPublication
      });
      const pressureMs = performance.now() - pressureStartMs;
      const totalMs = performance.now() - refreshStartMs;
      const currentRefreshPublication = ownsCurrentRefreshPublication();
      if (currentRefreshPublication) {
        overlay.__sphResidentMaterialInterfaceState = materialInterfaceState;
        overlay.__sphResidentPressureInterfaceState = pressureInterfaceState;
        updateResidentGasPressureSummary(overlay.__mlsMpmResidentStep);
        overlay.__sphResidentMaterialInterfaceStateError = null;
        overlay.__sphResidentPressureInterfaceStateError = null;
      }
      const report = {
        ...reportBase,
        status: currentRefreshPublication
          ? 'resident-interface-refresh-complete'
          : 'resident-interface-refresh-stale',
        materialInterfaceStatus: materialInterfaceState?.status ?? null,
        pressureInterfaceStatus: pressureInterfaceState?.status ?? null,
        materialMs,
        pressureMs,
        totalMs,
        completedAtMs: performance.now()
      };
      if (currentRefreshPublication) {
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
      }
      return report;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const currentRefreshPublication = ownsCurrentRefreshPublication();
      const report = {
        ...reportBase,
        status: currentRefreshPublication
          ? 'resident-interface-refresh-error'
          : 'resident-interface-refresh-stale-error',
        error: message,
        totalMs: performance.now() - refreshStartMs,
        completedAtMs: performance.now()
      };
      if (currentRefreshPublication) {
        overlay.__sphResidentMaterialInterfaceStateError = message;
        overlay.__sphResidentPressureInterfaceStateError = message;
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
      }
      return report;
    }
  }

  function startResidentInterfaceRefresh(context) {
    const mode = (
      context?.mode === 'blocking'
      || context?.mode === 'pipelined'
      || context?.mode === 'disabled'
    )
      ? context.mode
      : currentResidentInterfaceRefreshMode();
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
      residentInterfaceRefreshToken += 1;
      pendingResidentInterfaceRefreshPromise = null;
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
      const token = residentInterfaceRefreshToken + 1;
      residentInterfaceRefreshToken = token;
      pendingResidentInterfaceRefreshPromise = null;
      return refreshResidentInterfacesForExecution({
        ...context,
        mode,
        interfaceRefreshToken: token
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
    if (
      mode === 'pipelined'
      && context.requireBeforeNextResidentContinuation !== true
      && warmupFrames > 0
      && residentSubmissionCount < warmupFrames
    ) {
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
      interfaceRefreshToken: token,
      sourceCadence: 'resident-step-completed-pipelined'
    }).finally(() => {
      if (
        pendingResidentInterfaceRefreshPromise === promise
        && residentInterfaceRefreshToken === token
      ) {
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
    return resolveMountedWorkerPressureInterfaceGasCellImportDescriptor({
      source,
      publication,
      device: initialRendererWebGpuDeviceResult?.device || null
    });
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
    return summarizeMountedPressureInterfaceGasCellImport({
      pressureState,
      publication,
      importDescriptor,
      device: initialRendererWebGpuDeviceResult?.device || null,
      schroederPromotionStatus:
        pressureState?.schroederPressureInterfaceGasCellFieldImportPromotionStatus
          || scene.userData?.sphPressureInterfaceGasCellFieldImportPublication?.status
          || null
    });
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
            workerRunner,
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
    workerLaneProgressEverySteps = 1,
    readbackMode = SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT,
    continueFromResidentState = false,
    continuationBudget = RESIDENT_CONTINUATION_CHAIN_BUDGET,
    generation = particleSyncGeneration,
    force = false
  } = {}) {
    if (!simulationRuntimeAdmission.ready) {
      overlay.__mlsMpmResidentAutoSchedule = {
        ...(overlay.__mlsMpmResidentAutoSchedule || {}),
        schema: 'peercompute.ulg.sph-demo-resident-auto-schedule.v0',
        status: simulationRuntimeBlocked()
          ? 'resident-auto-schedule-blocked-by-runtime-prerequisite'
          : 'resident-auto-schedule-waiting-for-worker-bootstrap',
        residentAuto: Boolean(initialResidentAutoEnabled),
        runtimeAdmission: simulationRuntimeAdmission,
        updatedAtMs: performance.now()
      };
      return;
    }
    // Single authority: the plain SPH CPU reference owns its physics AND its
    // CPU surface rendering. Auto-scheduling resident mlsmpm steps alongside
    // it draws native webgpu surfaces UNDER the CPU particle geometry - the
    // mixed-source overlay the no-overlay architecture forbids. Explicit
    // scene.refreshMlsMpmResidentSteps calls (diagnostic proofs) bypass this.
    if (mechanicsModeFromControls() === 'sph') return;
    if (
      residentPostStepPresentationGate?.active
      && Number(residentPostStepPresentationGate.generation) === Number(generation)
    ) {
      overlay.__mlsMpmResidentAutoSchedule = {
        ...(overlay.__mlsMpmResidentAutoSchedule || {}),
        schema: 'peercompute.ulg.sph-demo-resident-auto-schedule.v0',
        status: 'resident-auto-schedule-held-for-current-native-presentation',
        residentAuto: Boolean(initialResidentAutoEnabled),
        residentPostStepPresentationGate,
        updatedAtMs: performance.now()
      };
      return;
    }
    if (residentStartupPresentationGate?.active) {
      const deferredManualSchedule = !initialResidentAutoEnabled && !force
        && deferResidentStartupPresentationManualIntent({
          kind: 'resident-schedule',
          scheduleOptions: {
            stepCount,
            workerLaneProgressEverySteps,
            readbackMode,
            continueFromResidentState,
            continuationBudget,
            force: false
          },
          reason: 'manual resident schedule arrived before the first native presentation proof'
        });
      overlay.__mlsMpmResidentAutoSchedule = {
        ...(overlay.__mlsMpmResidentAutoSchedule || {}),
        schema: 'peercompute.ulg.sph-demo-resident-auto-schedule.v0',
        status: deferredManualSchedule
          ? 'resident-manual-schedule-deferred-for-initial-native-presentation'
          : 'resident-auto-schedule-held-for-initial-native-presentation',
        residentAuto: Boolean(initialResidentAutoEnabled),
        residentInitialVisualRefresh: true,
        deferredManualSchedule,
        residentStartupPresentationGate,
        updatedAtMs: performance.now()
      };
      return;
    }
    const requestedStepCount = Math.max(1, Math.round(Number(stepCount) || 1));
    const requestedWorkerLaneProgressEverySteps = Math.max(
      1,
      Math.round(Number(workerLaneProgressEverySteps) || 1)
    );
    const normalizedStepCount = resolveSphResidentScheduleStepCount({
      requestedStepCount,
      schroederSimulationEnabled: initialSchroederSimulationConfig.enabled,
      workerLaneActive: initialWorkerOwnedResidentLaneReady
    });
    const residentExecutionPolicy = residentExecutionPolicyFromUrl();
    const schroederExecutionOptions = schroederResidentExecutionOptionsFromConfig();
    const baseSignature = mlsMpmResidentStepsSignature({
      stepCount: normalizedStepCount,
      workerLaneProgressEverySteps: requestedWorkerLaneProgressEverySteps,
      readbackMode,
      ...residentExecutionPolicy,
      ...schroederExecutionOptions
    });
    const signature = baseSignature
      ? `${baseSignature}|sync=${generation}|continue=${Boolean(continueFromResidentState)}`
      : null;
    const scheduleAdmission = resolveSphResidentScheduleAdmission({
      signature,
      pendingSignature: pendingMlsMpmResidentStepsSignature,
      force
    });
    if (!scheduleAdmission.admit) return;
    overlay.__mlsMpmResidentRequestedReadbackMode = readbackMode;
    overlay.__mlsMpmResidentExecutionPolicy = residentExecutionPolicy;
    overlay.__sphSchroederSimulationConfig = initialSchroederSimulationConfig;
    overlay.__mlsMpmSchroederExecutionOptions = schroederExecutionOptions;
    const scheduleToken = pendingMlsMpmResidentStepsToken + 1;
    pendingMlsMpmResidentStepsToken = scheduleToken;
    const scheduledScene = scene;
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
    // W4b: set when the settled execution is a worker-owned resident-lane
    // batch. Its continuation issues directly from schedule completion (the
    // batch itself is the pacing) instead of the per-step rAF chain.
    let workerLaneScheduleCompletionContinuation = false;
    // Any continuation that crosses an await must retain the exact mounted
    // scene and schedule identity it began with.  In particular, reset can
    // replace the scene and advance its generation while a native candidate
    // completion is settling; that old receipt must not publish into the new
    // scene's overlay state.
    const residentScheduleIsCurrent = () => (
      sphResidentSchedulePublicationIsCurrent({
        overlayConnected: overlay.isConnected,
        resetRebuildPending,
        sceneCurrent: scene === scheduledScene,
        generation,
        currentGeneration: particleSyncGeneration,
        scheduleToken,
        currentScheduleToken: pendingMlsMpmResidentStepsToken
      })
    );
    const discardStaleResidentPresentationContinuation = () => {
      scheduleContinuation = false;
      restartPlaybackContinuation = false;
    };
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
      overlay.__mlsMpmResidentStepsPending = {
        ...(overlay.__mlsMpmResidentStepsPending || {}),
        status: 'resident-execution-watchdog-current-submission-retained',
        elapsedMs,
        noticedAtMs: performance.now(),
        resubmitted: false
      };
      overlay.__mlsMpmResidentStepsSlow = {
        ...(overlay.__mlsMpmResidentStepsSlow || {}),
        schema: 'peercompute.ulg.sph-demo-slow-resident-execution.v0',
        status: 'resident-execution-watchdog-current-submission-retained',
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
        reason:
          'resident execution exceeded the watchdog interval; the single in-flight GPU submission remains authoritative'
      };
      publishResidentStageOrderTrace({
        status: 'resident-execution-watchdog-current-submission-retained',
        reason:
          'resident execution exceeded the watchdog interval; the single in-flight GPU submission remains authoritative',
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
      renderStatus();
      updateWarningBanner();
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
    let residentStepsInvocationProgress = null;
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
          force: Boolean(force),
          residentExecutionPolicy,
          schroederSimulationConfig: initialSchroederSimulationConfig,
          schroederExecutionOptions,
          computeManager: residentComputeManagerForSchedule,
          residentStateManager: residentStateManagerForSchedule,
          residentComputeManagerMode: residentComputeManagerModeForSchedule,
          computeTaskModulePath: computeTaskModulePathForSchedule
        }
      }).then((report) => {
        if (residentScheduleIsCurrent()) {
          overlay.__sphRemoteResidentTaskGraphRefresh = {
            ...report,
            signature,
            scheduleToken,
            stepCount: normalizedStepCount,
            readbackMode,
            continueFromResidentState: Boolean(continueFromResidentState),
            generation
          };
        }
        return report;
      });
    }
    const mountedResidentSchedulePromise = remoteRefreshPreludePromise.then(() => {
      if (!residentScheduleIsCurrent()) return null;
      traceResidentSchedule('refresh-invoked');
      const refreshPromise = scheduledScene.refreshMlsMpmResidentSteps?.({
      ambientPressurePa: initialAmbientPressurePaOverride,
      mechanicsSubmitBurstSteps: initialSubmitBurstSteps,
      observeCanonicalSpatialAuthority: initialObserveSpatialAuthority,
      consumeCompactMechanicsView: initialConsumeCompactMechanicsView,
      preferWebGpu: true,
      computeManager: residentComputeManagerForSchedule,
      residentStateManager: residentStateManagerForSchedule,
      residentAuthorityHost: residentAuthorityHostForSchedule,
      residentComputeManagerMode: residentComputeManagerModeForSchedule,
      computeTaskModulePath: computeTaskModulePathForSchedule,
      computeTaskLaneId: 'ulg:sph-resident:demo-auto',
      computeTaskDomainKey: 'sph-phase-demo',
      gasPressureSummary: gasPressureForSchedule,
      pressureInterfaceGasCellFieldImport: scheduledScene.getSphResidentPressureInterfaceState?.()?.pressureInterfaceGasCellFieldImport || null,
      pressureInterfaceGasCellFieldAdmission: scheduledScene.getSphResidentPressureInterfaceState?.()?.pressureInterfaceGasCellFieldAdmission || null,
      stepCount: normalizedStepCount,
      workerLaneProgressEverySteps: requestedWorkerLaneProgressEverySteps,
      readbackMode,
      // Mounted playback is a literal zero-map hot loop. Motion telemetry may
      // remain pending when the renderer consumes retained GPU buffers; it
      // must not insert a CPU queue fence merely to prove that a visible
      // presentation advanced. Explicit probes can still request final-only
      // or every-step compact diagnostics through the scene API.
      compactSummaryMode: readbackMode === 'no-full-readback' ? 'none' : undefined,
      continueFromResidentState,
      ...residentExecutionPolicy,
      ...schroederExecutionOptions,
      force: Boolean(force)
      });
      residentStepsInvocationProgress =
        scheduledScene.scene?.userData?.mlsMpmResidentStepsProgress || null;
      return refreshPromise;
    }).then(async (execution) => {
      traceResidentSchedule('refresh-settled', {
        status: execution?.status ?? null,
        stale: Boolean(execution?.stale)
      });
      const residentMs = performance.now() - residentStartMs;
      if (!residentScheduleIsCurrent()) {
        discardStaleResidentPresentationContinuation();
        scheduleLatestGeneration = Boolean(
          overlay.isConnected
          && !resetRebuildPending
          && Number(generation) !== Number(particleSyncGeneration)
        );
        return execution;
      }
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
      recordPhysicsFrame(completedResidentSteps);
      recordResidentCompletion(completedResidentSteps, residentMs);
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
      const schedulerResidentInterfaceRefreshMode = currentResidentInterfaceRefreshMode();
      const activePhysicalLawGroups = physicalLawGroupsFromControls();
      const residentInterfaceRefreshContinuationPolicy =
        resolveSphResidentInterfaceRefreshContinuationPolicy({
          schroederSimulationEnabled: initialSchroederSimulationEnabled,
          residentComputeManagerMode: residentComputeManagerModeForSchedule,
          workerOwnedResidentLaneActive:
            residentWorkerLaneContinuationReady(execution),
          pressureEnabled: activePhysicalLawGroups.pressure,
          reactionsEnabled: activePhysicalLawGroups.reactions,
          reactionCount: scene.getSphReactionTable?.()?.reactionCount ?? 0,
          interfaceRefreshMode: schedulerResidentInterfaceRefreshMode
        });
      const requireInterfaceBeforeNextResidentContinuation =
        residentInterfaceRefreshContinuationPolicy
          .requireInterfaceBeforeNextResidentContinuation;
      let residentInterfaceRefresh = null;
      if (
        residentInterfaceRefreshContinuationPolicy
          .startLegacyPostStepInterfaceRefresh
      ) {
        const residentStepForRefresh =
          overlay.__mlsMpmResidentStep || execution?.finalStep || null;
        const residentReactionResultForRefresh =
          residentStepForRefresh?.reactionStep?.result
          || residentStepForRefresh?.reactionStep
          || null;
        const residentReactionSummaryForRefresh =
          residentReactionResultForRefresh?.reactionSummary || null;
        const residentProductMassForRefresh =
          residentStepForRefresh?.residentProductMass
          || residentReactionResultForRefresh?.residentProductMass
          || null;
        const residentGasPressureForRefresh = currentGasPressureSummary(
          overlay.__sphResidentGasPressureSummary
            || activeViewStateGasPressure
            || (driver?.demo ? gasPressureSummary(driver.demo) : null)
        );
        residentInterfaceRefresh = startResidentInterfaceRefresh({
          execution,
          residentGasPressureForRefresh,
          residentProductMassForRefresh,
          residentReactionSummaryForRefresh,
          residentAuthorityHostForSchedule,
          residentComputeManagerMode: residentComputeManagerModeForSchedule,
          requireBeforeNextResidentContinuation:
            requireInterfaceBeforeNextResidentContinuation,
          mode: schedulerResidentInterfaceRefreshMode,
          generation,
          scheduleToken
        });
      } else {
        // Invalidate a prior pipelined refresh before publishing the excluded
        // canonical report. Its cleanup may finish, but neither the mount nor
        // the scene publication guards may let it overwrite this epoch.
        residentInterfaceRefreshToken += 1;
        pendingResidentInterfaceRefreshPromise = null;
        // The legacy refresh can map material/interface candidates back to the
        // host and then upload derived force rows. Those rows are diagnostic,
        // not an authority for the next immutable SS epoch, so neither their
        // readback nor their readiness may participate in the canonical hot
        // loop. A dedicated diagnostic refresh can run outside this scheduler.
        const excludedRefreshReport = {
          schema: 'peercompute.ulg.sph-demo-resident-interface-refresh.v0',
          status: 'resident-interface-refresh-excluded-from-canonical-schroeder-hot-loop',
          mode: 'diagnostic-only-outside-hot-loop',
          configuredMode: schedulerResidentInterfaceRefreshMode,
          scheduleToken,
          generation,
          reason: 'legacy post-step CPU-derived interface rows are not canonical SS continuation authority',
          updatedAtMs: performance.now(),
          scientificValidation: false,
          sphValidation: false,
          phaseChangeValidation: false,
          fullPhysicsValidation: false
        };
        overlay.__sphResidentInterfaceRefresh = excludedRefreshReport;
        updateResidentPerf({
          residentInterfaceRefreshMode: excludedRefreshReport.mode,
          residentInterfaceRefreshPending: false,
          excludedCanonicalSchroederInterfaceRefreshes:
            (residentPerf.excludedCanonicalSchroederInterfaceRefreshes || 0) + 1
        });
        publishResidentStageOrderTrace({
          status: excludedRefreshReport.status,
          mode: excludedRefreshReport.mode,
          configuredMode: schedulerResidentInterfaceRefreshMode,
          scheduleToken,
          generation
        });
      }
      let requiredInterfaceRefreshReady =
        !requireInterfaceBeforeNextResidentContinuation;
      if (
        residentInterfaceRefreshContinuationPolicy
          .awaitLegacyPostStepInterfaceRefresh
      ) {
        const interfaceRefreshReport = await residentInterfaceRefresh;
        if (!residentScheduleIsCurrent()) {
          discardStaleResidentPresentationContinuation();
          scheduleLatestGeneration = Boolean(
            overlay.isConnected
            && !resetRebuildPending
            && Number(generation) !== Number(particleSyncGeneration)
          );
          return execution;
        }
        if (requireInterfaceBeforeNextResidentContinuation) {
          const currentPressureInterfaceState =
            scene.getSphResidentPressureInterfaceState?.()
            || overlay.__sphResidentPressureInterfaceState
            || null;
          requiredInterfaceRefreshReady = Boolean(
            interfaceRefreshReport?.status === 'resident-interface-refresh-complete'
            && interfaceRefreshReport?.generation === generation
            && interfaceRefreshReport?.scheduleToken === scheduleToken
            && currentPressureInterfaceState?.status
              === 'resident-pressure-interface-force-rows-ready'
            && currentPressureInterfaceState?.pressureInterfaceForceRowsBufferRetained === true
            && currentPressureInterfaceState?.pressureInterfaceGridForceAdmissionApproved === true
          );
          if (!requiredInterfaceRefreshReady) {
            overlay.__sphResidentPressureInterfaceStateError =
              'current direct resident interface refresh did not publish approved same-device pressure rows';
          }
        }
      }
      // W4b: worker-lane continuation readiness is lane-resident evidence
      // (the presentation worker retains the post-step buffers); the direct
      // page-device continuation evidence stays byte-identical.
      const workerLaneContinuationReady =
        residentWorkerLaneContinuationReady(execution);
      workerLaneScheduleCompletionContinuation = workerLaneContinuationReady;
      scheduleContinuation = Boolean(
        (residentGpuContinuationReady(execution) || workerLaneContinuationReady)
        && continuationBudget > 0
        && generation === particleSyncGeneration
        && requiredInterfaceRefreshReady
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
      restartPlaybackContinuation = sphResidentPlaybackRestartAllowed({
        scheduleContinuation,
        playing,
        continuationReady:
          residentGpuContinuationReady(execution) || workerLaneContinuationReady,
        generationCurrent: generation === particleSyncGeneration,
        requiredInterfaceRefreshReady
      });
      if (execution?.backend === 'webgpu') {
        const selectedSurfaceDrawDiagnosticMode = currentResidentSurfaceDrawDiagnosticMode();
        const selectedParticleRenderMode = residentSurfaceDrawParticleRenderMode(selectedSurfaceDrawDiagnosticMode);
        const selectedNativeSurfaceConsumerRefresh = residentSurfaceDrawModeUsesNativeSurfaceConsumer(
          selectedSurfaceDrawDiagnosticMode
        );
        const workerLaneNativeSurfaceSnapshotRefresh = Boolean(
          selectedNativeSurfaceConsumerRefresh
          && workerLaneContinuationReady
        );
        const residentRenderScheduleIsCurrent = () => (
          sphResidentRenderSchedulePublicationIsCurrent({
            overlayConnected: overlay.isConnected,
            resetRebuildPending,
            sceneCurrent: scene === scheduledScene,
            generation,
            currentGeneration: particleSyncGeneration,
            scheduleToken,
            currentScheduleToken: pendingMlsMpmResidentStepsToken,
            residentComputeManagerMode: residentComputeManagerModeForSchedule,
            currentResidentComputeManagerMode: currentResidentComputeManagerMode(),
            surfaceDrawDiagnosticMode: selectedSurfaceDrawDiagnosticMode,
            currentSurfaceDrawDiagnosticMode:
              currentResidentSurfaceDrawDiagnosticMode()
          })
        );
        const forceParticleRenderModeRefresh = residentSurfaceDrawModeUsesParticleBridge(
          selectedSurfaceDrawDiagnosticMode
        );
        const currentResidentRenderState = scene.getSphResidentRenderState?.()
          || overlay.__sphResidentRenderState
          || null;
        const currentResidentSurfaceDraw = scene.getSphResidentSurfaceDraw?.()
          || overlay.__sphResidentSurfaceDraw
          || null;
        const hasResidentRenderState = Boolean(currentResidentRenderState?.schema);
        const forceInitialRenderStateRefresh = !hasResidentRenderState;
        const nativeSurfaceCadenceRefresh =
          resolveSphNativeSurfaceCadenceRefreshPolicy({
            nativeSurfaceConsumerRefresh: selectedNativeSurfaceConsumerRefresh,
            renderState: currentResidentRenderState,
            surfaceDraw: currentResidentSurfaceDraw
          });
        const forceNativeSurfacePresentationRecovery =
          nativeSurfaceCadenceRefresh.forceDue;
        const forceMotionProvenRefresh = renderMotion.status === 'motion-proven';
        const forceBatchMotionEstimateRefresh = renderMotion.batchMotionEstimateVisible === true;
        const forceAccumulatedMotionRefresh = accumulatedMotion.accumulatedMotionVisible;
        const forceResidentRenderRefreshReason = forceInitialRenderStateRefresh
          ? 'resident-initial-visual-refresh'
          : workerLaneNativeSurfaceSnapshotRefresh
          ? 'worker-lane-terminal-native-surface-snapshot'
          : forceNativeSurfacePresentationRecovery
          ? 'native-surface-visible-presentation-recovery-refresh'
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
            || forceNativeSurfacePresentationRecovery
            || forceMotionProvenRefresh
            || forceBatchMotionEstimateRefresh
            || forceAccumulatedMotionRefresh
            || forceParticleRenderModeRefresh
            || workerLaneNativeSurfaceSnapshotRefresh,
          forceReason: forceResidentRenderRefreshReason,
          suppressDue: suppressSubvisiblePlaybackRender,
          suppressReason: 'resident-motion-below-visible-threshold'
        });
        const nativeSurfaceStartupRefresh =
          resolveSphNativeSurfaceStartupRefreshCoalescing({
            nativeSurfaceConsumerRefresh: selectedNativeSurfaceConsumerRefresh,
            surfaceDraw: currentResidentSurfaceDraw,
            validationScheduler: scene.scene?.userData
              ?.sphNativeSurfaceCandidateValidationScheduler
              || null
          });
        if (
          cadence.due
          && nativeSurfaceStartupRefresh.deferRefresh
          && !workerLaneNativeSurfaceSnapshotRefresh
        ) {
          // The active startup candidate is still the only presentation that
          // could retire the control-envelope preview. Do not enqueue a newer
          // candidate yet: the latest-wins scheduler correctly supersedes
          // successors after a first commit, but doing so before any commit
          // livelocks presentation admission and presents a blank canvas.
          cadence.due = false;
          cadence.skipped = true;
          cadence.forced = false;
          cadence.suppressed = true;
          cadence.suppressionCandidate = true;
          cadence.suppressionPolicy =
            'native-surface-first-publication-coalesces-playback-refreshes';
          cadence.reason = 'native-surface-first-publication-validation-pending';
        }
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
        cadence.nativeSurfaceStartupRefresh = nativeSurfaceStartupRefresh;
        cadence.nativeSurfaceCadenceRefresh = nativeSurfaceCadenceRefresh;
        cadence.nativeSurfacePresentationVisible =
          nativeSurfaceCadenceRefresh.presentationVisible;
        cadence.nativeSurfacePresentationAdmitted =
          nativeSurfaceCadenceRefresh.presentationAdmitted;
        cadence.nativeSurfacePresentationForegroundProved =
          nativeSurfaceCadenceRefresh.presentationForegroundProved;
        cadence.nativeSurfaceCurrentSourceForAdmission =
          nativeSurfaceCadenceRefresh.currentSourceForAdmission;
        // A camera-only private-candidate rejection may rebuild this exact
        // resident execution, but it must use precisely the same admission
        // inputs as the ordinary post-step render refresh. Keep the option
        // construction here so a recovery cannot accidentally render a CPU,
        // stale, or differently configured source.
        let workerLaneNativeSurfacePresentationSource = null;
        const refreshResidentRenderForExactExecution = () =>
          scheduledScene.refreshSphResidentRenderState?.({
            preferWebGpu: true,
            residentSteps: execution,
            workerLaneNativeSurfacePresentationSource,
            materialProperties: activeMaterialProperties(),
            gasPressureSummary: overlay.__sphResidentGasPressureSummary
              || activeViewStateGasPressure
              || (driver?.demo ? gasPressureSummary(driver.demo) : null),
            residentAuthorityHost: residentAuthorityHostForSchedule,
            pressureInterfaceGasCellFieldImport: scheduledScene.getSphResidentPressureInterfaceState?.()?.pressureInterfaceGasCellFieldImport || null,
            pressureInterfaceGasCellFieldAdmission: scheduledScene.getSphResidentPressureInterfaceState?.()?.pressureInterfaceGasCellFieldAdmission || null,
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
            skipPressureInterfaceRefresh: true,
            publicationGuard: residentRenderScheduleIsCurrent
          });
        try {
          if (cadence.due) {
            if (workerLaneNativeSurfaceSnapshotRefresh) {
              const materializedSource =
                await materializeSphWorkerLaneNativeSurfacePresentationSource({
                  sceneApi: scheduledScene,
                  execution,
                  generation,
                  scheduleToken,
                  materialProperties: activeMaterialProperties()
                });
              if (!residentRenderScheduleIsCurrent()) {
                await materializedSource.releaseAfterQueue?.();
                discardStaleResidentPresentationContinuation();
                return;
              }
              workerLaneNativeSurfacePresentationSource =
                adoptWorkerLaneNativeSurfacePresentationMirror(materializedSource);
              overlay.__sphWorkerLaneNativeSurfacePresentation = Object.freeze({
                schema: materializedSource.schema,
                status: materializedSource.status,
                scheduleId: materializedSource.scheduleId,
                laneId: materializedSource.laneId,
                stateKey: materializedSource.stateKey,
                requestId: materializedSource.requestId,
                cacheKey: materializedSource.cacheKey,
                sourceStageId: materializedSource.sourceStageId,
                sourceStep: materializedSource.sourceStep,
                sourceTimeS: materializedSource.sourceTimeS,
                particleCount: materializedSource.particleCount,
                readbackScope: materializedSource.readbackScope,
                terminalPresentationFullParticleReadbackPerformed: true,
                physicsHotLoopParticipation: false
              });
            }
            const renderStartMs = performance.now();
            const refreshedResidentRenderState =
              await refreshResidentRenderForExactExecution();
            if (!residentRenderScheduleIsCurrent()) {
              discardStaleResidentPresentationContinuation();
              return;
            }
            overlay.__sphResidentRenderState = refreshedResidentRenderState;
            overlay.__sphResidentRenderStateError = null;
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
            let postStepPresentationWait = null;
            let postStepPresentationHandoffWait = null;
            let postStepPresentationHandoffAdmission = null;
            let postStepPresentationAdmitted = false;
            if (selectedNativeSurfaceConsumerRefresh) {
              if (!residentRenderScheduleIsCurrent()) {
                discardStaleResidentPresentationContinuation();
                return;
              }
              let candidateHandoff =
                currentNativeSurfaceCandidateCompletionHandoff(
                  execution,
                  { allowSurfaceDrawRequestFallback: false }
                );
              residentNativeSurfaceCameraPresentationRecoveryContext =
                Object.freeze({
                  schema:
                    'peercompute.ulg.sph-native-surface-camera-presentation-recovery-context.v0',
                  generation,
                  scheduleToken,
                  workerLaneProgressEverySteps:
                    requestedWorkerLaneProgressEverySteps,
                  execution,
                  sourceResidentExecutionGeneration:
                    candidateHandoff.expectedResidentExecutionGeneration ?? null,
                  sourceResidentStepsSignature:
                    candidateHandoff.expectedResidentStepsSignature ?? null,
                  sourceResidentStepSignature:
                    candidateHandoff.expectedResidentStepSignature ?? null,
                  gateRequestToken: candidateHandoff.request?.token ?? null,
                  gateCandidateGeneration:
                    candidateHandoff.request?.candidateGeneration ?? null,
                  gateLifecycleGeneration:
                    candidateHandoff.request?.lifecycleGeneration ?? null,
                  isCurrent: () => (
                    residentRenderScheduleIsCurrent()
                    && residentExecutionIsCurrentForNativePresentationRecovery(execution)
                  ),
                  refresh: refreshResidentRenderForExactExecution
                });
              const publishPostStepPresentationHandoff = ({
                cameraRecoveryAttempt = 0
              } = {}) => {
                overlay.__sphResidentPostStepPresentationHandoff = Object.freeze({
                  schema: 'peercompute.ulg.sph-native-surface-post-step-presentation-handoff.v0',
                  status: postStepPresentationHandoffAdmission?.status ?? null,
                  admitted: postStepPresentationHandoffAdmission?.admitted === true,
                  requestToken: candidateHandoff.request?.token ?? null,
                  candidateGeneration:
                    candidateHandoff.request?.candidateGeneration ?? null,
                  lifecycleGeneration:
                    candidateHandoff.request?.lifecycleGeneration ?? null,
                  waitStatus:
                    postStepPresentationHandoffWait?.handoffWaitStatus ?? null,
                  waitElapsedMs:
                    postStepPresentationHandoffWait?.elapsedMs ?? null,
                  timedOut: postStepPresentationHandoffWait?.timedOut === true,
                  requestMatches:
                    postStepPresentationHandoffAdmission?.requestMatches === true,
                  lifecycleMatches:
                    postStepPresentationHandoffAdmission?.lifecycleMatches === true,
                  candidateMatches:
                    postStepPresentationHandoffAdmission?.candidateMatches === true,
                  sourceExecutionGenerationMatches:
                    postStepPresentationHandoffAdmission
                      ?.sourceExecutionGenerationMatches === true,
                  sourceStepsSignatureMatches:
                    postStepPresentationHandoffAdmission
                      ?.sourceStepsSignatureMatches === true,
                  sourceStepSignatureMatches:
                    postStepPresentationHandoffAdmission
                      ?.sourceStepSignatureMatches === true,
                  sourceWasCurrent:
                    postStepPresentationHandoffAdmission?.sourceWasCurrent === true,
                  sourceResidentExecutionGeneration:
                    postStepPresentationHandoffAdmission
                      ?.sourceResidentExecutionGeneration ?? null,
                  cameraPresentationRecoveryAttempt: cameraRecoveryAttempt,
                  updatedAtMs: performance.now()
                });
              };
              // Publish the hold before awaiting any asynchronous candidate
              // work. A reset or manual scheduling intent cannot supersede
              // the exact source between its GPU validation and the final
              // live-state proof below.
              residentPostStepPresentationGate = Object.freeze({
                schema: 'peercompute.ulg.sph-native-surface-post-step-presentation-gate.v0',
                status: 'native-surface-post-step-presentation-proof-pending',
                active: true,
                generation,
                scheduleToken,
                requestToken: candidateHandoff.request?.token ?? null,
                candidateGeneration:
                  candidateHandoff.request?.candidateGeneration ?? null,
                lifecycleGeneration:
                  candidateHandoff.request?.lifecycleGeneration ?? null,
                sourceResidentExecutionGeneration:
                  candidateHandoff.expectedResidentExecutionGeneration ?? null,
                sourceResidentStepsSignature:
                  candidateHandoff.expectedResidentStepsSignature ?? null,
                sourceResidentStepSignature:
                  candidateHandoff.expectedResidentStepSignature ?? null,
                proofStatus: null,
                proofWaitStatus: null,
                sourceCurrent: false,
                handoffStatus: null,
                handoffAdmitted: null,
                handoffWaitStatus: null,
                postStepPresentationAdmitted: false,
                postStepPresentationProved: false,
                livenessFailOpen: false,
                residentPlaybackReleased: false,
                boundedAttemptComplete: false,
                reason:
                  'resident playback is held while the exact native candidate publishes and is runtime-admitted',
                updatedAtMs: performance.now()
              });
              overlay.__sphResidentPostStepPresentationGate =
                residentPostStepPresentationGate;
              const handoffStartedAtMs = performance.now();
              postStepPresentationHandoffWait =
                await waitForNativeSurfaceCandidateCompletionHandoff(
                  candidateHandoff.handoff,
                  { timeoutMs: NATIVE_SURFACE_CURRENT_PRESENTATION_WAIT_MS }
                );
              if (!residentRenderScheduleIsCurrent()) {
                discardStaleResidentPresentationContinuation();
                return;
              }
              postStepPresentationHandoffAdmission =
                resolveSphNativeSurfaceCandidateCompletionHandoff({
                  handoff: postStepPresentationHandoffWait,
                  expectedRequestToken: candidateHandoff.request?.token ?? null,
                  expectedLifecycleGeneration:
                    candidateHandoff.request?.lifecycleGeneration ?? null,
                  expectedCandidateGeneration:
                    candidateHandoff.request?.candidateGeneration ?? null,
                  expectedResidentExecutionGeneration:
                    candidateHandoff.expectedResidentExecutionGeneration,
                  expectedResidentStepsSignature:
                    candidateHandoff.expectedResidentStepsSignature,
                  expectedResidentStepSignature:
                    candidateHandoff.expectedResidentStepSignature
                });
              publishPostStepPresentationHandoff();
              recordPerformanceSpan(
                'resident-native-surface-candidate-completion-handoff',
                handoffStartedAtMs,
                performance.now(),
                {
                  scheduleToken,
                  generation,
                  requestToken: candidateHandoff.request?.token ?? null,
                  candidateGeneration:
                    candidateHandoff.request?.candidateGeneration ?? null,
                  status: postStepPresentationHandoffAdmission.status,
                  admitted: postStepPresentationHandoffAdmission.admitted,
                  timedOut: postStepPresentationHandoffWait?.timedOut === true
                }
              );
              updateResidentPerf({
                lastNativeSurfaceCandidateHandoffMs:
                  postStepPresentationHandoffWait?.elapsedMs ?? null,
                lastNativeSurfaceCandidateHandoffStatus:
                  postStepPresentationHandoffAdmission.status,
                lastNativeSurfaceCandidateHandoffAdmitted:
                  postStepPresentationHandoffAdmission.admitted === true
              });
              if (postStepPresentationHandoffAdmission.admitted) {
                const currentRenderState = scene.getSphResidentRenderState?.()
                  || overlay.__sphResidentRenderState
                  || null;
                const currentSurfaceDraw = scene.getSphResidentSurfaceDraw?.()
                  || overlay.__sphResidentSurfaceDraw
                  || null;
                postStepPresentationAdmitted = residentPresentationIsAdmitted(
                  currentRenderState,
                  currentSurfaceDraw,
                  { requireCurrentSource: true }
                );
                if (postStepPresentationAdmitted) {
                  overlay.__sphResidentRenderState = currentRenderState;
                  overlay.__sphResidentSurfaceDraw = currentSurfaceDraw;
                  completePendingBodyEnvelopePreview({
                    generation,
                    reason: 'resident-post-step-candidate-completion-handoff-ready'
                  });
                }
              }
              const resolvePostStepCameraRetryEligibility = () =>
                resolveSphNativeSurfaceCameraRetryEligibility({
                  handoff: postStepPresentationHandoffWait,
                  scheduler: scene?.scene?.userData
                    ?.sphNativeSurfaceCandidateValidationScheduler || null,
                  expectedRequestToken: candidateHandoff.request?.token ?? null,
                  expectedLifecycleGeneration:
                    candidateHandoff.request?.lifecycleGeneration ?? null,
                  expectedCandidateGeneration:
                    candidateHandoff.request?.candidateGeneration ?? null,
                  expectedResidentExecutionGeneration:
                    candidateHandoff.expectedResidentExecutionGeneration,
                  expectedResidentStepsSignature:
                    candidateHandoff.expectedResidentStepsSignature,
                  expectedResidentStepSignature:
                    candidateHandoff.expectedResidentStepSignature,
                  sourceStillCurrent: (
                    residentRenderScheduleIsCurrent()
                    && residentExecutionIsCurrentForNativePresentationRecovery(execution)
                  )
                });
              let postStepCameraRetryEligibility =
                resolvePostStepCameraRetryEligibility();
              if (
                !postStepPresentationAdmitted
                && postStepCameraRetryEligibility.eligible
              ) {
                const failedRequestToken =
                  postStepCameraRetryEligibility.requestToken;
                const failedCandidateGeneration =
                  postStepCameraRetryEligibility.candidateGeneration;
                const failedLifecycleGeneration =
                  postStepCameraRetryEligibility.lifecycleGeneration;
                const failureKey = [
                  failedRequestToken,
                  failedCandidateGeneration,
                  failedLifecycleGeneration
                ].join(':');
                let recoveryAttempt = 0;
                while (
                  !postStepPresentationAdmitted
                  && postStepCameraRetryEligibility.eligible
                  && recoveryAttempt < NATIVE_SURFACE_CAMERA_PRESENTATION_RECOVERY_MAX_ATTEMPTS
                ) {
                  recoveryAttempt += 1;
                  if (
                    !residentRenderScheduleIsCurrent()
                    || !residentExecutionIsCurrentForNativePresentationRecovery(execution)
                  ) {
                    discardStaleResidentPresentationContinuation();
                    return;
                  }
                  residentPostStepPresentationGate = Object.freeze({
                    ...residentPostStepPresentationGate,
                    status: 'native-surface-post-step-presentation-camera-retry-pending',
                    active: true,
                    retryAttempt: recoveryAttempt,
                    failureCode: SPH_NATIVE_SURFACE_CAMERA_SNAPSHOT_STALE_ERROR_CODE,
                    reason:
                      'the private native candidate changed camera inputs before its visible copy; the exact resident source is being revalidated after the camera settles',
                    updatedAtMs: performance.now()
                  });
                  overlay.__sphResidentPostStepPresentationGate =
                    residentPostStepPresentationGate;
                  residentNativeSurfaceCameraPresentationRecovery = Object.freeze({
                    schema: 'peercompute.ulg.sph-native-surface-camera-presentation-recovery.v0',
                    status: 'native-surface-camera-presentation-recovery-awaiting-camera-settle',
                    active: true,
                    generation,
                    scheduleToken,
                    failedRequestToken,
                    failedCandidateGeneration,
                    failedLifecycleGeneration,
                    failureKey,
                    retryAttempt: recoveryAttempt,
                    failureCode: SPH_NATIVE_SURFACE_CAMERA_SNAPSHOT_STALE_ERROR_CODE,
                    sourceExecutionGeneration:
                      candidateHandoff.expectedResidentExecutionGeneration ?? null,
                    sourceExecutionVerified: true,
                    updatedAtMs: performance.now()
                  });
                  overlay.__sphNativeSurfaceCameraPresentationRecovery =
                    residentNativeSurfaceCameraPresentationRecovery;
                  const cameraSettle =
                    await waitForNativeSurfaceCameraPresentationToSettle({
                      isCurrent: () => (
                        residentRenderScheduleIsCurrent()
                        && residentExecutionIsCurrentForNativePresentationRecovery(execution)
                      )
                    });
                  if (
                    !residentRenderScheduleIsCurrent()
                    || !residentExecutionIsCurrentForNativePresentationRecovery(execution)
                  ) {
                    discardStaleResidentPresentationContinuation();
                    return;
                  }
                  if (!cameraSettle.settled) {
                    residentNativeSurfaceCameraPresentationRecovery = Object.freeze({
                      ...residentNativeSurfaceCameraPresentationRecovery,
                      status: cameraSettle.status,
                      active: false,
                      cameraSettle,
                      updatedAtMs: performance.now()
                    });
                    overlay.__sphNativeSurfaceCameraPresentationRecovery =
                      residentNativeSurfaceCameraPresentationRecovery;
                    break;
                  }
                  residentNativeSurfaceCameraPresentationRecovery = Object.freeze({
                    ...residentNativeSurfaceCameraPresentationRecovery,
                    status: 'native-surface-camera-presentation-recovery-render-refresh-pending',
                    active: true,
                    cameraSettle,
                    updatedAtMs: performance.now()
                  });
                  overlay.__sphNativeSurfaceCameraPresentationRecovery =
                    residentNativeSurfaceCameraPresentationRecovery;
                  const priorRequestToken = candidateHandoff.request?.token ?? null;
                  const retryRenderStartedAtMs = performance.now();
                  let retryRenderState = null;
                  try {
                    retryRenderState = await refreshResidentRenderForExactExecution();
                  } catch (error) {
                    if (
                      !residentRenderScheduleIsCurrent()
                      || !residentExecutionIsCurrentForNativePresentationRecovery(execution)
                    ) {
                      discardStaleResidentPresentationContinuation();
                      return;
                    }
                    residentNativeSurfaceCameraPresentationRecovery = Object.freeze({
                      ...residentNativeSurfaceCameraPresentationRecovery,
                      status: 'native-surface-camera-presentation-recovery-render-refresh-error',
                      active: false,
                      error: error instanceof Error ? error.message : String(error),
                      updatedAtMs: performance.now()
                    });
                    overlay.__sphNativeSurfaceCameraPresentationRecovery =
                      residentNativeSurfaceCameraPresentationRecovery;
                    break;
                  }
                  if (
                    !residentRenderScheduleIsCurrent()
                    || !residentExecutionIsCurrentForNativePresentationRecovery(execution)
                  ) {
                    discardStaleResidentPresentationContinuation();
                    return;
                  }
                  overlay.__sphResidentRenderState = retryRenderState;
                  overlay.__sphResidentSurfaceDraw =
                    scene.getSphResidentSurfaceDraw?.() || null;
                  overlay.__sphResidentSurfaceDrawOverlayPolicy =
                    scene.getSphResidentSurfaceDrawOverlayPolicy?.() || null;
                  overlay.__sphResidentPressureInterfaceState =
                    scene.getSphResidentPressureInterfaceState?.() || null;
                  residentRenderReadbackCount += 1;
                  annotateResidentRenderStateCadence(overlay.__sphResidentRenderState, {
                    ...cadence,
                    forced: true,
                    forceReason: 'native-surface-camera-presentation-recovery',
                    skipped: false,
                    renderReadbackCount: residentRenderReadbackCount,
                    skippedCount: residentRenderReadbackSkippedCount,
                    cameraPresentationRecovery: true,
                    retryAttempt: recoveryAttempt
                  });
                  updateResidentPerf({
                    residentStepsPerSchedule: normalizedStepCount,
                    renderReadbacks: residentRenderReadbackCount,
                    skippedRenderReadbacks: residentRenderReadbackSkippedCount,
                    playbackVisualRefreshForced: true,
                    lastRenderReadbackMs: performance.now() - retryRenderStartedAtMs,
                    lastRenderReadbackSkipped: false,
                    nativeSurfaceCameraPresentationRecoveryAttempt: recoveryAttempt
                  });
                  candidateHandoff =
                    currentNativeSurfaceCandidateCompletionHandoff(
                      execution,
                      { allowSurfaceDrawRequestFallback: false }
                    );
                  if (
                    candidateHandoff.request?.token == null
                    || candidateHandoff.request.token === priorRequestToken
                  ) {
                    residentNativeSurfaceCameraPresentationRecovery = Object.freeze({
                      ...residentNativeSurfaceCameraPresentationRecovery,
                      status: 'native-surface-camera-presentation-recovery-candidate-unavailable',
                      active: false,
                      requestToken: candidateHandoff.request?.token ?? null,
                      updatedAtMs: performance.now()
                    });
                    overlay.__sphNativeSurfaceCameraPresentationRecovery =
                      residentNativeSurfaceCameraPresentationRecovery;
                    break;
                  }
                  residentPostStepPresentationGate = Object.freeze({
                    ...residentPostStepPresentationGate,
                    requestToken: candidateHandoff.request?.token ?? null,
                    candidateGeneration:
                      candidateHandoff.request?.candidateGeneration ?? null,
                    retryAttempt: recoveryAttempt,
                    updatedAtMs: performance.now()
                  });
                  overlay.__sphResidentPostStepPresentationGate =
                    residentPostStepPresentationGate;
                  residentNativeSurfaceCameraPresentationRecovery = Object.freeze({
                    ...residentNativeSurfaceCameraPresentationRecovery,
                    status: 'native-surface-camera-presentation-recovery-candidate-handoff-pending',
                    active: true,
                    requestToken: candidateHandoff.request?.token ?? null,
                    candidateGeneration:
                      candidateHandoff.request?.candidateGeneration ?? null,
                    updatedAtMs: performance.now()
                  });
                  overlay.__sphNativeSurfaceCameraPresentationRecovery =
                    residentNativeSurfaceCameraPresentationRecovery;
                  const retryHandoffStartedAtMs = performance.now();
                  postStepPresentationHandoffWait =
                    await waitForNativeSurfaceCandidateCompletionHandoff(
                      candidateHandoff.handoff,
                      { timeoutMs: NATIVE_SURFACE_CURRENT_PRESENTATION_WAIT_MS }
                    );
                  if (!residentRenderScheduleIsCurrent()) {
                    discardStaleResidentPresentationContinuation();
                    return;
                  }
                  postStepPresentationHandoffAdmission =
                    resolveSphNativeSurfaceCandidateCompletionHandoff({
                      handoff: postStepPresentationHandoffWait,
                      expectedRequestToken: candidateHandoff.request?.token ?? null,
                      expectedLifecycleGeneration:
                        candidateHandoff.request?.lifecycleGeneration ?? null,
                      expectedCandidateGeneration:
                        candidateHandoff.request?.candidateGeneration ?? null,
                      expectedResidentExecutionGeneration:
                        candidateHandoff.expectedResidentExecutionGeneration,
                      expectedResidentStepsSignature:
                        candidateHandoff.expectedResidentStepsSignature,
                      expectedResidentStepSignature:
                        candidateHandoff.expectedResidentStepSignature
                    });
                  postStepCameraRetryEligibility =
                    resolvePostStepCameraRetryEligibility();
                  publishPostStepPresentationHandoff({
                    cameraRecoveryAttempt: recoveryAttempt
                  });
                  recordPerformanceSpan(
                    'resident-native-surface-camera-presentation-recovery-handoff',
                    retryHandoffStartedAtMs,
                    performance.now(),
                    {
                      scheduleToken,
                      generation,
                      retryAttempt: recoveryAttempt,
                      requestToken: candidateHandoff.request?.token ?? null,
                      candidateGeneration:
                        candidateHandoff.request?.candidateGeneration ?? null,
                      status: postStepPresentationHandoffAdmission.status,
                      admitted: postStepPresentationHandoffAdmission.admitted,
                      timedOut: postStepPresentationHandoffWait?.timedOut === true
                    }
                  );
                  if (postStepPresentationHandoffAdmission.admitted) {
                    const currentRenderState = scene.getSphResidentRenderState?.()
                      || overlay.__sphResidentRenderState
                      || null;
                    const currentSurfaceDraw = scene.getSphResidentSurfaceDraw?.()
                      || overlay.__sphResidentSurfaceDraw
                      || null;
                    postStepPresentationAdmitted = residentPresentationIsAdmitted(
                      currentRenderState,
                      currentSurfaceDraw,
                      { requireCurrentSource: true }
                    );
                    if (postStepPresentationAdmitted) {
                      overlay.__sphResidentRenderState = currentRenderState;
                      overlay.__sphResidentSurfaceDraw = currentSurfaceDraw;
                      completePendingBodyEnvelopePreview({
                        generation,
                        reason:
                          'resident-post-step-camera-presentation-recovery-ready'
                      });
                    }
                  }
                  residentNativeSurfaceCameraPresentationRecovery = Object.freeze({
                    ...residentNativeSurfaceCameraPresentationRecovery,
                    status: postStepPresentationAdmitted
                      ? 'native-surface-camera-presentation-recovery-admitted'
                      : (postStepCameraRetryEligibility.eligible
                        ? 'native-surface-camera-presentation-recovery-camera-stale-again'
                        : 'native-surface-camera-presentation-recovery-not-admitted'),
                    active: !postStepPresentationAdmitted
                      && postStepCameraRetryEligibility.eligible
                      && recoveryAttempt < NATIVE_SURFACE_CAMERA_PRESENTATION_RECOVERY_MAX_ATTEMPTS,
                    handoffStatus: postStepPresentationHandoffAdmission.status,
                    proofStatus: overlay.__sphResidentPresentationProof?.status ?? null,
                    proofSourceCurrent:
                      overlay.__sphResidentPresentationProof?.sourceCurrent === true,
                    updatedAtMs: performance.now()
                  });
                  overlay.__sphNativeSurfaceCameraPresentationRecovery =
                    residentNativeSurfaceCameraPresentationRecovery;
                }
              }
            }
            if (!postStepPresentationAdmitted) {
              const handoffElapsedMs = Number(
                postStepPresentationHandoffWait?.elapsedMs
              );
              const remainingProofTimeoutMs = selectedNativeSurfaceConsumerRefresh
                ? Math.max(
                  0,
                  NATIVE_SURFACE_CURRENT_PRESENTATION_WAIT_MS
                    - (Number.isFinite(handoffElapsedMs) ? handoffElapsedMs : 0)
                )
                : null;
              postStepPresentationWait = await waitForCurrentResidentPresentationProof({
                generation,
                reason: 'resident-post-step-presentation-admission-ready',
                requirePresentationWithoutPreview:
                  selectedNativeSurfaceConsumerRefresh,
                requireCurrentSource: selectedNativeSurfaceConsumerRefresh,
                timeoutMs: remainingProofTimeoutMs
              });
              if (!residentRenderScheduleIsCurrent()) {
                discardStaleResidentPresentationContinuation();
                return;
              }
              postStepPresentationAdmitted = residentPresentationIsAdmitted(
                scene.getSphResidentRenderState?.() || overlay.__sphResidentRenderState,
                scene.getSphResidentSurfaceDraw?.() || overlay.__sphResidentSurfaceDraw,
                { requireCurrentSource: selectedNativeSurfaceConsumerRefresh }
              );
            }
            if (!residentRenderScheduleIsCurrent()) {
              discardStaleResidentPresentationContinuation();
              return;
            }
            const postStepPresentationProof = overlay.__sphResidentPresentationProof
            || postStepPresentationWait
            || null;
            overlay.__sphResidentPostStepPresentationProof = postStepPresentationProof;
            if (selectedNativeSurfaceConsumerRefresh) {
              residentPostStepPresentationGate =
                resolveSphNativeSurfacePostStepPresentationGateSettlement({
                  gate: residentPostStepPresentationGate,
                  generation,
                  currentGeneration: particleSyncGeneration,
                  scheduleToken,
                  currentScheduleToken: pendingMlsMpmResidentStepsToken,
                  presentationAdmitted: postStepPresentationAdmitted,
                  presentationVisible:
                    overlay.__sphResidentPresentationProof?.visible === true,
                  presentationProof:
                    overlay.__sphResidentPresentationProof || null,
                  presentationProofWait: postStepPresentationWait,
                  presentationHandoffAdmission:
                    postStepPresentationHandoffAdmission,
                  presentationHandoffWait:
                    postStepPresentationHandoffWait,
                  boundedAttemptComplete: true,
                  updatedAtMs: performance.now()
                });
              overlay.__sphResidentPostStepPresentationGate =
                residentPostStepPresentationGate;
              traceResidentSchedule(
                'native-surface-post-step-presentation-gate-settled',
                {
                  status: residentPostStepPresentationGate?.status ?? null,
                  active:
                    residentPostStepPresentationGate?.active === true,
                  postStepPresentationProved:
                    residentPostStepPresentationGate
                      ?.postStepPresentationProved === true,
                  livenessFailOpen:
                    residentPostStepPresentationGate
                      ?.livenessFailOpen === true,
                  proofStatus:
                    residentPostStepPresentationGate?.proofStatus ?? null,
                  proofWaitStatus:
                    residentPostStepPresentationGate
                      ?.proofWaitStatus ?? null
                }
              );
              if (
                residentPostStepPresentationGate?.active
                // W4b: worker-lane schedule issuance is never suppressed by
                // the native-surface presentation gate — the worker lane's
                // presentation flows through the resident render candidate
                // mailbox, so holding physics for a page-side presentation
                // proof would deadlock playback against a proof that this
                // route never produces.
                && !workerLaneScheduleCompletionContinuation
              ) {
                // A non-terminal exact-generation proof still owns the
                // continuation. Terminal unadmitted/error/timeout outcomes are
                // inactive fail-open receipts and preserve playback.
                scheduleContinuation = false;
                restartPlaybackContinuation = false;
                overlay.__mlsMpmResidentAutoSchedule = {
                  ...(overlay.__mlsMpmResidentAutoSchedule || {}),
                  schema: 'peercompute.ulg.sph-demo-resident-auto-schedule.v0',
                  status: 'resident-auto-schedule-held-for-current-native-presentation',
                  residentAuto: Boolean(initialResidentAutoEnabled),
                  residentPostStepPresentationGate,
                  updatedAtMs: performance.now()
                };
              }
            }
            if (postStepPresentationAdmitted) {
              completePendingBodyEnvelopePreview({
                generation,
                reason: 'resident-post-step-presentation-ready'
              });
            }
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
          if (!residentRenderScheduleIsCurrent()) {
            discardStaleResidentPresentationContinuation();
            return;
          }
          const renderStateError =
            error instanceof Error ? error.message : String(error);
          overlay.__sphResidentRenderStateError = renderStateError;
          if (
            selectedNativeSurfaceConsumerRefresh
            && residentPostStepPresentationGate?.active
          ) {
            const settledGate =
              resolveSphNativeSurfacePostStepPresentationGateSettlement({
                gate: residentPostStepPresentationGate,
                generation,
                currentGeneration: particleSyncGeneration,
                scheduleToken,
                currentScheduleToken: pendingMlsMpmResidentStepsToken,
                presentationProof:
                  overlay.__sphResidentPresentationProof || null,
                boundedAttemptComplete: true,
                refreshError: renderStateError,
                updatedAtMs: performance.now()
              });
            if (settledGate !== residentPostStepPresentationGate) {
              residentPostStepPresentationGate = settledGate;
              overlay.__sphResidentPostStepPresentationGate = settledGate;
              traceResidentSchedule(
                'native-surface-post-step-presentation-gate-settled',
                {
                  status: settledGate?.status ?? null,
                  active: settledGate?.active === true,
                  postStepPresentationProved:
                    settledGate?.postStepPresentationProved === true,
                  livenessFailOpen:
                    settledGate?.livenessFailOpen === true,
                  refreshError: renderStateError
                }
              );
            }
          }
        }
      } else {
        overlay.__sphResidentRenderState = scene.getSphResidentRenderState?.() || null;
        overlay.__sphResidentPressureInterfaceState = scene.getSphResidentPressureInterfaceState?.() || null;
        overlay.__sphResidentSurfaceDraw = scene.getSphResidentSurfaceDraw?.() || null;
        overlay.__sphResidentSurfaceDrawOverlayPolicy = scene.getSphResidentSurfaceDrawOverlayPolicy?.() || null;
      }
      renderStatus();
      updateWarningBanner();
      return execution;
    }).catch((error) => {
      if (!residentScheduleIsCurrent()) {
        discardStaleResidentPresentationContinuation();
        scheduleLatestGeneration = Boolean(
          overlay.isConnected
          && !resetRebuildPending
          && Number(generation) !== Number(particleSyncGeneration)
        );
        return;
      }
      overlay.__mlsMpmResidentStepsError = error instanceof Error ? error.message : String(error);
      overlay.__mlsMpmResidentStepsPending = null;
      overlay.__mlsMpmResidentStepsSlow = null;
      const residentStepsErrorProgress =
        scheduledScene.scene?.userData?.mlsMpmResidentStepsProgress || null;
      const terminalCurrentError = isSphResidentTerminalAutoScheduleError({
        scheduleIsCurrent: residentScheduleIsCurrent(),
        invocationProgress: residentStepsInvocationProgress,
        currentProgress: residentStepsErrorProgress
      });
      if (terminalCurrentError) {
        scheduleContinuation = false;
        scheduleLatestGeneration = false;
        restartPlaybackContinuation = false;
        playing = false;
        const playButton = overlay.querySelector('#sph-play');
        if (playButton) playButton.textContent = 'Play';
        overlay.__mlsMpmResidentAutoSchedule = {
          ...(overlay.__mlsMpmResidentAutoSchedule || {}),
          schema: 'peercompute.ulg.sph-demo-resident-auto-schedule.v0',
          status: 'resident-auto-schedule-stopped-terminal-error',
          residentAuto: Boolean(initialResidentAutoEnabled),
          signature: residentStepsErrorProgress.signature,
          scheduleToken,
          generation,
          progress: residentStepsErrorProgress,
          updatedAtMs: performance.now()
        };
      }
      publishResidentStageOrderTrace({
        status: terminalCurrentError
          ? 'resident-execution-terminal-error-autoplay-stopped'
          : 'resident-execution-error',
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
      if (residentScheduleIsCurrent()) {
        updateResidentPerf({
          residentInterfaceRefreshMode: currentResidentInterfaceRefreshMode(),
          residentInterfaceRefreshPending: Boolean(pendingResidentInterfaceRefreshPromise),
          lastResidentCycleMs: performance.now() - residentStartMs,
          lastResidentPostComputeMs: Math.max(
            0,
            (performance.now() - residentStartMs) - Number(residentPerf.lastResidentMs || 0)
          )
        });
      }
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
            workerLaneProgressEverySteps:
              requestedWorkerLaneProgressEverySteps,
            readbackMode,
            continueFromResidentState: false,
            continuationBudget,
            generation: particleSyncGeneration
          });
        });
      } else if (
        workerLaneScheduleCompletionContinuation
        && scheduleContinuation
        && residentScheduleIsCurrent()
      ) {
        // W4b: the worker lane issues its next batched schedule directly
        // from THIS schedule's completion. The per-step rAF chain below
        // paces one-epoch direct schedules against page presentation; a
        // worker batch is its own pacing and never waits on a page frame.
        if (sphResidentChainedContinuationAllowed({
          scheduleContinuation,
          playing,
          scheduleCurrent: residentScheduleIsCurrent()
        })) {
          scheduleMlsMpmResidentSteps({
            stepCount: normalizedStepCount,
            workerLaneProgressEverySteps:
              requestedWorkerLaneProgressEverySteps,
            readbackMode,
            continueFromResidentState: true,
            continuationBudget: continuationBudget - 1,
            generation
          });
        }
      } else if (scheduleContinuation && residentScheduleIsCurrent()) {
        window.requestAnimationFrame(() => {
          if (!sphResidentChainedContinuationAllowed({
            scheduleContinuation,
            playing,
            scheduleCurrent: residentScheduleIsCurrent()
          })) return;
          scheduleMlsMpmResidentSteps({
            stepCount: normalizedStepCount,
            workerLaneProgressEverySteps:
              requestedWorkerLaneProgressEverySteps,
            readbackMode,
            continueFromResidentState: true,
            continuationBudget: continuationBudget - 1,
            generation
          });
        });
      } else if (
        workerLaneScheduleCompletionContinuation
        && restartPlaybackContinuation
        && residentScheduleIsCurrent()
      ) {
        // W4b: worker-lane playback restart also issues from schedule
        // completion rather than a page frame.
        if (overlay.isConnected && playing && generation === particleSyncGeneration) {
          scheduleMlsMpmResidentSteps({
            stepCount: normalizedStepCount,
            workerLaneProgressEverySteps:
              requestedWorkerLaneProgressEverySteps,
            readbackMode,
            continueFromResidentState: true,
            continuationBudget: RESIDENT_CONTINUATION_CHAIN_BUDGET,
            generation
          });
        }
      } else if (restartPlaybackContinuation && residentScheduleIsCurrent()) {
        window.requestAnimationFrame(() => {
          if (!overlay.isConnected || !playing || generation !== particleSyncGeneration) return;
          scheduleMlsMpmResidentSteps({
            stepCount: normalizedStepCount,
            workerLaneProgressEverySteps:
              requestedWorkerLaneProgressEverySteps,
            readbackMode,
            continueFromResidentState: true,
            continuationBudget: RESIDENT_CONTINUATION_CHAIN_BUDGET,
            generation
          });
        });
      }
    });
    return mountedResidentSchedulePromise;
  }

  // The long-horizon architecture probe must exercise the mounted scheduler,
  // not call the scene's compute method directly.  The mounted scheduler owns
  // the terminal worker-snapshot -> native-surface handoff and therefore is
  // the only path that can prove the preset does not reveal the worker's
  // diagnostic particle canvas after an authoritative schedule commits.
  overlay.__sphScheduleMlsMpmResidentSteps = (options = {}) =>
    scheduleMlsMpmResidentSteps(options);

  async function refreshResidentRenderForCurrentMode(reason = 'render-mode-change') {
    const mode = currentResidentSurfaceDrawDiagnosticMode();
    const token = renderModeRefreshToken + 1;
    renderModeRefreshToken = token;
    const renderModeScene = scene;
    const renderModeGeneration = particleSyncGeneration;
    const renderModeComputeManagerMode = currentResidentComputeManagerMode();
    const renderModeRefreshIsCurrent = () => Boolean(
      token === renderModeRefreshToken
      && renderModeScene === scene
      && renderModeGeneration === particleSyncGeneration
      && overlay.isConnected
      && !resetRebuildPending
      && currentResidentSurfaceDrawDiagnosticMode() === mode
      && currentResidentComputeManagerMode() === renderModeComputeManagerMode
    );
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
      const renderState = await renderModeScene.refreshSphResidentRenderState?.({
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
        skipPressureInterfaceRefresh:
          shouldSkipSphResidentPressureInterfaceForRenderRefresh({
            schroederSimulationEnabled:
              initialSchroederSimulationConfig.enabled,
            residentComputeManagerMode: renderModeComputeManagerMode,
            workerOwnedResidentLaneActive:
              residentWorkerLaneContinuationReady(execution)
          }),
        renderFieldReadbackMode: nativeSurfaceConsumerRefresh ? SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT : undefined,
        renderRowsReadbackMode: nativeSurfaceConsumerRefresh ? SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT : undefined,
        renderFieldSurfaceSummaryMode:
          (residentSurfaceDrawModeUsesCompactBridge(mode) || nativeSurfaceConsumerRefresh) ? 'skip' : 'auto',
        surfaceDrawDiagnosticMode: mode,
        surfaceDrawDiagnosticModeExplicit: residentSurfaceDrawDiagnosticModeExplicit,
        allowNativeSurfaceExtraction: nativeSurfaceConsumerRefresh ? true : undefined,
        publicationGuard: renderModeRefreshIsCurrent
      });
      if (!renderModeRefreshIsCurrent()) return renderState;
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
      if (!renderModeRefreshIsCurrent()) return null;
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

  // Blob size is presentation-only. Never call syncParticles() here: doing so
  // invalidates the worker-retained authority just to change an isosurface
  // radius. The next native presentation refresh consumes the new scale.
  blobInput.addEventListener('input', () => {
    scene.setSurfaceRadiusScale(blobScaleOf());
    renderStatus();
  });

  function revokeLocalBackgroundImageObjectUrl(url, reason = 'local-background-image-retired') {
    if (!url || revokedLocalBackgroundImageObjectUrls.has(url)) return false;
    revokedLocalBackgroundImageObjectUrls.add(url);
    try { URL.revokeObjectURL(url); } catch { /* browser teardown */ }
    overlay.__sphLocalBackgroundImageLastRevocation = {
      schema: 'peercompute.ulg.sph-local-background-image-revocation.v0',
      status: 'local-background-image-object-url-revoked',
      reason,
      updatedAtMs: performance.now()
    };
    return true;
  }

  function publishLocalBackgroundImageStatus({
    status,
    reason = null,
    message = null,
    error = null,
    width = null,
    height = null
  } = {}) {
    const activeUrl = backgroundImageUrlOf();
    const localActive = backgroundImageSelect.value === SPH_LOCAL_BACKGROUND_IMAGE_CONTROL_VALUE
      && Boolean(localBackgroundImageObjectUrl);
    const builtInActive = Boolean(activeUrl) && !localActive;
    const defaultMessage = localActive
      ? `Using ${localBackgroundImageFileName || 'a local image'} — session only; nothing was uploaded.`
      : (builtInActive
          ? `Using ${backgroundImageSelect.selectedOptions?.[0]?.textContent || 'the selected background image'}.`
          : 'Using the solid background color. Local images stay on this device.');
    localBackgroundImageStatus.textContent = message || defaultMessage;
    localBackgroundImageStatus.style.color = error ? '#ffb7a1' : '#8fc7b2';
    clearBackgroundImageButton.disabled = !activeUrl && !pendingLocalBackgroundImageObjectUrl;
    overlay.__sphLocalBackgroundImage = {
      schema: 'peercompute.ulg.sph-local-background-image-control.v0',
      status: status || (
        localActive
          ? 'local-background-image-active'
          : (builtInActive ? 'bundled-background-image-active' : 'solid-background-active')
      ),
      reason,
      sessionOnly: true,
      localObjectUrlActive: localActive,
      localObjectUrlPending: Boolean(pendingLocalBackgroundImageObjectUrl),
      fileName: localActive ? localBackgroundImageFileName : null,
      fileType: localActive ? localBackgroundImageFileType : null,
      fileSizeBytes: localActive ? localBackgroundImageFileSizeBytes : 0,
      width,
      height,
      error: error ? String(error) : null,
      updatedAtMs: performance.now()
    };
    return overlay.__sphLocalBackgroundImage;
  }

  function applyBackgroundImageFromControl(
    reason = 'background-image-control-input',
    { refresh = true } = {}
  ) {
    overlay.__sphSceneBackgroundImage = scene.setBackgroundImage?.(
      backgroundImageUrlOf(),
      { reason, refresh }
    ) || null;
    publishLocalBackgroundImageStatus({ reason });
    return overlay.__sphSceneBackgroundImage;
  }

  function cancelPendingLocalBackgroundImage(reason) {
    localBackgroundImageLoadGeneration += 1;
    const pendingUrl = pendingLocalBackgroundImageObjectUrl;
    pendingLocalBackgroundImageObjectUrl = null;
    revokeLocalBackgroundImageObjectUrl(pendingUrl, reason);
  }

  function detachActiveLocalBackgroundImage() {
    const retiredUrl = localBackgroundImageObjectUrl;
    localBackgroundImageObjectUrl = null;
    localBackgroundImageFileName = null;
    localBackgroundImageFileType = null;
    localBackgroundImageFileSizeBytes = 0;
    localBackgroundImageOption.hidden = true;
    localBackgroundImageOption.disabled = true;
    localBackgroundImageOption.textContent = 'Custom image (local session)';
    localBackgroundImageInput.value = '';
    return retiredUrl;
  }

  backgroundImageSelect.addEventListener('change', () => {
    cancelPendingLocalBackgroundImage('local-background-image-selection-superseded');
    const retiredLocalUrl = backgroundImageSelect.value === SPH_LOCAL_BACKGROUND_IMAGE_CONTROL_VALUE
      ? null
      : detachActiveLocalBackgroundImage();
    applyBackgroundImageFromControl('background-image-control-change');
    revokeLocalBackgroundImageObjectUrl(retiredLocalUrl, 'local-background-image-replaced-by-selector');
    syncUrlFromControls();
  });

  localBackgroundImageInput.addEventListener('change', () => {
    const file = localBackgroundImageInput.files?.[0] || null;
    if (!file) return;
    // Every non-null selection is authoritative, including an invalid file:
    // a prior candidate must never commit after the user has replaced it.
    cancelPendingLocalBackgroundImage('local-background-image-new-selection');
    const validation = validateSphLocalBackgroundImageFile(file);
    if (!validation.accepted) {
      localBackgroundImageInput.value = '';
      publishLocalBackgroundImageStatus({
        status: validation.status,
        reason: 'local-background-image-file-validation',
        message: validation.reason,
        error: validation.reason
      });
      return;
    }

    const loadGeneration = localBackgroundImageLoadGeneration;
    let candidateUrl = null;
    try {
      candidateUrl = URL.createObjectURL(file);
    } catch (error) {
      localBackgroundImageInput.value = '';
      publishLocalBackgroundImageStatus({
        status: 'local-background-image-object-url-failed',
        reason: 'local-background-image-file-selection',
        message: 'The browser could not open that local image.',
        error: error instanceof Error ? error.message : String(error)
      });
      return;
    }
    pendingLocalBackgroundImageObjectUrl = candidateUrl;
    publishLocalBackgroundImageStatus({
      status: 'local-background-image-loading',
      reason: 'local-background-image-file-selection',
      message: `Checking ${validation.name}…`
    });

    const candidateImage = new Image();
    candidateImage.onload = () => {
      if (
        loadGeneration !== localBackgroundImageLoadGeneration
        || pendingLocalBackgroundImageObjectUrl !== candidateUrl
        || !overlay.isConnected
      ) {
        revokeLocalBackgroundImageObjectUrl(candidateUrl, 'local-background-image-stale-candidate');
        return;
      }
      pendingLocalBackgroundImageObjectUrl = null;
      const previousLocalUrl = localBackgroundImageObjectUrl;
      localBackgroundImageObjectUrl = candidateUrl;
      localBackgroundImageFileName = validation.name;
      localBackgroundImageFileType = validation.type;
      localBackgroundImageFileSizeBytes = validation.sizeBytes;
      localBackgroundImageOption.hidden = false;
      localBackgroundImageOption.disabled = false;
      localBackgroundImageOption.textContent = `Custom: ${validation.name}`;
      backgroundImageSelect.value = SPH_LOCAL_BACKGROUND_IMAGE_CONTROL_VALUE;
      localBackgroundImageInput.value = '';
      applyBackgroundImageFromControl('local-background-image-loaded');
      revokeLocalBackgroundImageObjectUrl(previousLocalUrl, 'local-background-image-replaced');
      syncUrlFromControls();
      publishLocalBackgroundImageStatus({
        status: 'local-background-image-active',
        reason: 'local-background-image-loaded',
        width: Math.max(1, Number(candidateImage.naturalWidth || candidateImage.width) || 1),
        height: Math.max(1, Number(candidateImage.naturalHeight || candidateImage.height) || 1)
      });
    };
    candidateImage.onerror = () => {
      if (pendingLocalBackgroundImageObjectUrl === candidateUrl) {
        pendingLocalBackgroundImageObjectUrl = null;
      }
      revokeLocalBackgroundImageObjectUrl(candidateUrl, 'local-background-image-decode-failed');
      localBackgroundImageInput.value = '';
      if (loadGeneration !== localBackgroundImageLoadGeneration || !overlay.isConnected) return;
      publishLocalBackgroundImageStatus({
        status: 'local-background-image-decode-failed',
        reason: 'local-background-image-file-selection',
        message: `${validation.name} could not be decoded as an image. The current background was kept.`,
        error: 'image-decode-failed'
      });
    };
    candidateImage.src = candidateUrl;
  });

  clearBackgroundImageButton.addEventListener('click', () => {
    cancelPendingLocalBackgroundImage('local-background-image-cleared');
    const retiredLocalUrl = detachActiveLocalBackgroundImage();
    backgroundImageSelect.value = '';
    applyBackgroundImageFromControl('background-image-clear-button');
    revokeLocalBackgroundImageObjectUrl(retiredLocalUrl, 'local-background-image-cleared');
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
  function applyLightingModeFromControl(reason = 'lighting-mode-control-change') {
    overlay.__sphSceneLighting = scene.setLightingMode?.(lightingModeOf(), { reason }) || null;
    syncLightingQuickToggle();
    syncUrlFromControls();
    renderStatus();
    updateWarningBanner();
    return overlay.__sphSceneLighting;
  }
  lightingModeSelect.addEventListener('change', () => {
    applyLightingModeFromControl('lighting-mode-control-change');
  });
  function syncLightingQuickToggle() {
    const darkLab = lightingModeOf() === SPH_SCENE_LIGHTING_MODE_DARK_LAB;
    lightingQuickToggle.textContent = darkLab ? '☀ normal lights' : '☾ dark lab';
    lightingQuickToggle.title = darkLab
      ? 'Restore normal laboratory lighting'
      : 'Turn off incident lights and preserve only dim ambient plus physical emission';
    lightingQuickToggle.setAttribute('aria-pressed', String(darkLab));
  }
  lightingQuickToggle.addEventListener('click', () => {
    lightingModeSelect.value = lightingModeOf() === SPH_SCENE_LIGHTING_MODE_DARK_LAB
      ? SPH_SCENE_LIGHTING_MODE_DEFAULT
      : SPH_SCENE_LIGHTING_MODE_DARK_LAB;
    applyLightingModeFromControl('lighting-mode-quick-toggle');
  });
  syncLightingQuickToggle();
  renderModeSelect.addEventListener('change', () => {
    residentSurfaceDrawDiagnosticModeExplicit = true;
    const selectedMode = currentResidentSurfaceDrawDiagnosticMode();
    // Render mode is part of the architecture profile contract. Keep the
    // selector truthful even when the new mode uses the already-mounted
    // backend and therefore does not reload the page.
    syncArchitectureControlDependencies({ normalizeDependencies: false });
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
    clearResidentStartupPresentationDeferredManualIntent(
      `resident runtime invalidated for reset: ${reason}`
    );
    residentStartupPresentationHandoff = null;
    overlay.__sphResidentStartupPresentationHandoff = null;
    residentPostStepPresentationGate = null;
    overlay.__sphResidentPostStepPresentationGate = null;
    residentNativeSurfaceCameraPresentationRecovery = null;
    overlay.__sphNativeSurfaceCameraPresentationRecovery = null;
    residentNativeSurfaceCameraPresentationRecoveryEpoch += 1;
    residentNativeSurfaceCameraPresentationRecoveryContext = null;
    void releaseWorkerLaneNativeSurfacePresentationMirror();
    residentNativeSurfaceLatePresentationRecoveryEpoch += 1;
    residentNativeSurfaceLatePresentationRecovery = null;
    overlay.__sphNativeSurfaceLatePresentationRecovery = null;
    overlay.__sphResidentPostStepPresentationProof = null;
    overlay.__sphResidentPostStepPresentationHandoff = null;
    particleSyncGeneration += 1;
    pendingMlsMpmResidentStepsToken += 1;
    residentInterfaceRefreshToken += 1;
    pendingResidentInterfaceRefreshPromise = null;
    renderModeRefreshToken += 1;
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
      overlay.__sphSceneLighting = scene.setLightingMode?.(lightingModeOf(), {
        reason: `${resetReason}-scene-reused`,
        refresh: false
      }) || null;
      applyBackgroundImageFromControl(`${resetReason}-scene-reused`, { refresh: false });
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
      stageMechanicsTraceEnabled: initialStageMechanicsTraceEnabled,
      boxDimsM: nextDims,
      surfaceRadiusScale: blobScaleOf(),
      preserveDrawingBuffer: preserveDrawingBufferForCapture,
      rendererBackend: initialSphRendererBackend,
      rendererWebGpuPresentation: initialThreeWebGpuRendererPresentationEnabled,
      rendererWebGpuResidentDevice: initialThreeWebGpuRendererResidentDeviceEnabled,
      rendererWebGpuPresentationUnsafe: initialThreeWebGpuRendererPresentationUnsafe,
      rendererWebGpuSurfaceBufferPresentation: initialThreeWebGpuSurfaceBufferPresentationEnabled,
      rendererWebGpuDeviceResult: initialRendererWebGpuDeviceResult,
      residentGpuTimestampProfiling:
        initialResidentGpuTimestampProfilingEnabled,
      residentSurfaceDrawOverlay: residentSurfaceDrawOverlayMode,
      residentSurfaceDrawDiagnosticMode: currentResidentSurfaceDrawDiagnosticMode(),
      backgroundColor: backgroundColorOf(),
      lightingMode: lightingModeOf(),
      nativeSurfacePixelValidation: nativeSurfacePixelValidationEnabled,
      workerOffscreenPresentation: workerOffscreenPresentationEnabled,
      workerParticleOverlay: initialWorkerParticleOverlayEnabled,
      renderOwnershipPolicy: initialPeerComputeRenderOwnershipPolicy,
      materialInterfaceSurfaceTablePolicy: initialMaterialInterfaceSurfaceTablePolicy,
      residentAuthorityHost: currentResidentAuthorityHostForScene(),
      cameraPositionNormalized: initialCameraPositionNormalized,
      cameraTargetNormalized: initialCameraTargetNormalized
    });
    applySchroederRenderProxyOverlayFlag(scene);
    overlay.__sphScene = scene;
    overlay.__sphSceneBackgroundColor = scene.scene?.userData?.sphSceneBackgroundColor || null;
    overlay.__sphSceneLighting = scene.getLightingMode?.() || null;
    applyBackgroundImageFromControl(`${resetReason}-scene-recreated`, { refresh: false });
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
    // The worker packs the per-slot object arrays columnar for transport; this
    // restores exactly the arrays createSphPhaseViewState produced. Safe on an
    // unpacked value, so an older worker build still works.
    const viewState = unpackSphPhaseViewStateFromTransport(
      result?.viewState || outputs.viewState
    );
    if (!viewState?.positionsM || generation !== workerRebuildGeneration) {
      // A worker task that throws is reported as an error artifact, which lands
      // here with no positionsM and used to be discarded silently -- the app
      // then waited on initial-material-closure-pending forever with nothing
      // to show for it. Record why, so a failed rebuild is diagnosable instead
      // of looking like a hang.
      if (generation === workerRebuildGeneration && !viewState?.positionsM) {
        const outputError = outputs?.error
          ?? artifact?.outputs?.error
          ?? artifact?.validation?.blockers?.join?.(', ')
          ?? result?.error?.message
          ?? (viewState ? 'worker rebuild returned a view state without positionsM' : 'worker rebuild returned no view state');
        overlay.__sphPhaseRebuildWorkerError = {
          schema: 'peercompute.ulg.sph-phase-rebuild-worker-error.v0',
          generation,
          reason: String(outputError).slice(0, 800),
          artifactStatus: artifact?.execution?.status ?? null,
          validationStatus: artifact?.validation?.status ?? null,
          updatedAtMs: performance.now()
        };
        renderStatus();
        updateWarningBanner();
      }
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
    const postRebuildIntent = consumePendingPostRebuildIntent();
    if (postRebuildIntent === 'play' || postRebuildIntent === 'step') {
      queueMicrotask(() => {
        if (!overlay.isConnected) return;
        overlay.querySelector(
          postRebuildIntent === 'play' ? '#sph-play' : '#sph-step'
        )?.click();
      });
    } else if (postRebuildIntent == null && residentAutoStartEnabled) {
      startWorkerResidentPlayback();
    }
    return true;
  }

  function rebuildDemoFromControls() {
    if (simulationRuntimeBlocked()) return false;
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
    return Boolean(driver);
  }

  function ensureInteractiveDriverFromCache() {
    if (simulationRuntimeBlocked()) return false;
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
    if (!simulationRuntimeAdmission.ready) return false;
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
        bodies: controlOptions.initialBodies,
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
      pendingPostRebuildIntent = null;
      recordPerformanceSpan('ulg-runtime worker createSphPhaseDemo failed', submittedAtMs, performance.now(), {
        reason,
        error: error instanceof Error ? error.message : String(error)
      });
      const message = error instanceof Error ? error.message : String(error);
      overlay.__sphPhaseRebuildWorker = {
        schema: SPH_PHASE_REBUILD_WORKER_STATUS_SCHEMA,
        status: 'blocked-runtime-worker',
        generation,
        reason: message,
        updatedAtMs: performance.now()
      };
      blockSphSimulationRuntime(message, {
        source: 'runtime-worker-rebuild',
        errorCode: error?.code || null
      });
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

  function scheduleDemoRebuild({ delayMs = 0 } = {}) {
    if (!simulationRuntimeAdmission.ready) return false;
    pendingControlEdit = false;
    syncUrlFromControls();
    if (rebuildTimer != null) window.clearTimeout(rebuildTimer);
    playing = false;
    interactiveSimulationStateReady = false;
    syncSphInteractiveControlAvailability();
    overlay.querySelector('#sph-play').textContent = 'Play';
    publishPendingBodyEnvelopePreview({
      reason: 'replacement-material-closure-pending',
      generation: null
    });
    invalidateResidentRuntimeForReset('demo-rebuild');
    const canUseWorkerRebuild = typeof runtime?.runSphPhaseRebuild === 'function';
    if (canUseWorkerRebuild) cancelWorkerRebuildForReset('demo-rebuild');
    const rebuildLocation = canUseWorkerRebuild ? 'ulg-runtime worker' : 'blocked';
    setCpuClosureTask({
      label: 'material/reaction/closure rebuild',
      location: rebuildLocation,
      reason: canUseWorkerRebuild
        ? 'supervised PeerCompute sph.phase.rebuild task'
        : 'the required ULG runtime worker is unavailable'
    });
    statusEl.textContent = 'rebuilding material state and derived chemistry...';
    rebuildTimer = window.setTimeout(() => {
      rebuildTimer = null;
      if (canUseWorkerRebuild) {
        scheduleWorkerDemoRebuild();
        return;
      }
      blockSphSimulationRuntime(
        'the required ULG runtime worker is unavailable; no main-thread rebuild will run',
        { source: 'runtime-worker-rebuild-admission' }
      );
      setCpuClosureTask(null);
      publishPeerClosureCacheState();
      updateWarningBanner();
    }, Math.max(0, Number(delayMs) || 0));
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

  const legacyInitialBodyControlKeys = new Set([
    'drop', 'base', 'dropt', 'baset', 'iceh', 'ironh', 'dropn', 'basen'
  ]);
  const initialBodyContainerControlKeys = new Set(['boxx', 'boxy', 'boxz']);
  function reloadWithScenarioPresetRuntime(entry) {
    // Runtime tuning (dt/CFL/cadence/manager mode) is resolved while the
    // resident renderer and authority host are created. Rebuilding only the
    // particle driver would leave those mount-time policies from the previous
    // preset alive until the next manual reload. Serialize the selected
    // preset's runtime alongside its visible controls and reload once so the
    // controls, driver, renderer, and resident host all share one authority.
    syncUrlFromControls();
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    for (const key of mountedPresetRuntimeResetKeys) {
      params.delete(key);
    }
    for (const [key, value] of Object.entries(entry.runtime || {})) {
      if (value != null && value !== '') params.set(key, String(value));
    }
    mountedRuntimeControlReloadPending = true;
    window.history.replaceState(
      null,
      '',
      canonicalMountedLocationWithHash(params, {
        clearSearchKeys: ['scenario', ...mountedPresetRuntimeResetKeys]
      })
    );
    window.location.reload();
  }
  architectureProfileSelect.addEventListener('change', () => {
    applyArchitectureProfile(architectureProfileSelect.value);
  });
  initialBodiesEditorReady = true;
  initialBodiesEl.inert = false;
  addInitialBodyButton.disabled = false;
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
        currentInitialBodies = legacyInitialBodiesFromProxyControls();
        setInitialBodiesEditorError();
        renderInitialBodiesEditor();
        reloadWithScenarioPresetRuntime(entry);
      });
    } else if (mountedRuntimeControlKeys.has(key)) {
      el.addEventListener('change', () => {
        if (typeof el.checkValidity === 'function' && !el.checkValidity()) {
          el.reportValidity?.();
          return;
        }
        replaceMountedRuntimeHashAndReload({
          reason: `mounted-runtime-control-${key}`
        });
      });
    } else if (key === 'blob') {
      el.addEventListener('change', syncUrlFromControls);
    } else if (key === 'bg') {
      el.addEventListener('change', () => applyBackgroundColorFromControl('background-color-control-change'));
    } else if (key === 'bgimg') {
      // Background image changes are render-only; the change listener added
      // at control creation already applies + syncs the URL. No demo rebuild.
    } else if (key === 'lighting') {
      // Lighting is render-only; the dedicated live listener applies it and
      // syncs the URL without rebuilding or resetting the physics state.
    } else {
      el.addEventListener('change', () => {
        if (legacyInitialBodyControlKeys.has(key)) {
          currentInitialBodies = legacyInitialBodiesFromProxyControls();
          setInitialBodiesEditorError();
          renderInitialBodiesEditor();
        }
        if (initialBodyContainerControlKeys.has(key)) {
          try {
            validateInitialBodiesEditorState(currentInitialBodies);
            setInitialBodiesEditorError();
          } catch (error) {
            setInitialBodiesEditorError(error, { blocksSimulation: true });
            return;
          }
        }
        scenarioPresetSelect.value = 'custom';
        stageControlEdit();
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
      interactiveSimulationStateReady = false;
      activeViewState = null;
      activeViewStateTotals = null;
      activeViewStatePhaseSummary = null;
      activeViewStateGasPressure = null;
      const requestedPhysicalLawGroups = physicalLawGroupsFromControls();
      const activePhysicalLawGroups = effectivePhysicalLawGroups(null);
      scene.setParticles({
        positionsM: new Float32Array(0),
        colorsRgb: new Float32Array(0),
        particleRadiiM: new Float32Array(0),
        materials: [],
        reactions: [],
        physicalLawGroups: activePhysicalLawGroups,
        requestedPhysicalLawGroups,
        surfaceTensionLawAdmission: null
      });
      overlay.__sphPhysicalLawGroups = requestedPhysicalLawGroups;
      overlay.__sphEffectivePhysicalLawGroups = activePhysicalLawGroups;
      overlay.__sphSurfaceTensionLawAdmission = null;
      overlay.__sphResidentRenderState = scene.getSphResidentRenderState?.() || null;
      overlay.__sphResidentPressureInterfaceState = scene.getSphResidentPressureInterfaceState?.() || null;
      overlay.__sphResidentSurfaceDraw = scene.getSphResidentSurfaceDraw?.() || null;
      overlay.__sphResidentSurfaceDrawOverlayPolicy = scene.getSphResidentSurfaceDrawOverlayPolicy?.() || null;
      syncSphInteractiveControlAvailability();
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
    const requestedPhysicalLawGroups = physicalLawGroupsFromControls();
    const activePhysicalLawGroups = effectivePhysicalLawGroups(
      viewState.surfaceTensionLawAdmission
    );
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
      physicalLawGroups: activePhysicalLawGroups,
      requestedPhysicalLawGroups,
      surfaceTensionLawAdmission: viewState.surfaceTensionLawAdmission,
      wallTemperaturesK: viewState.wallTemperaturesK || viewState.scenario?.walls?.faces || null,
      wallReservoirAuthority:
        viewState.wallReservoirAuthority
        ?? viewState.scenario?.walls?.authority
        ?? null,
      ambientTemperatureK:
        viewState.ambientTemperatureK
        ?? viewState.scenario?.ambientTemperatureK
        ?? null,
      thermalEnvironmentAuthority:
        viewState.thermalEnvironmentAuthority
        ?? viewState.scenario?.thermalEnvironment
        ?? null,
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
    overlay.__sphPhysicalLawGroups = requestedPhysicalLawGroups;
    overlay.__sphEffectivePhysicalLawGroups = activePhysicalLawGroups;
    overlay.__sphSurfaceTensionLawAdmission =
      viewState.surfaceTensionLawAdmission;
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
    bindPendingBodyEnvelopePreviewToParticleGeneration(particleSyncGeneration);
    scheduleInitialMlsMpmResidentSteps({ generation: particleSyncGeneration });
    interactiveSimulationStateReady = true;
    syncSphInteractiveControlAvailability();
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
    const requested = physicalLawGroupsFromControls();
    const admission = activeViewState?.surfaceTensionLawAdmission ?? null;
    const effective = effectivePhysicalLawGroups(admission);
    return Object.entries(requested)
      .map(([key, enabled]) => {
        if (key !== 'surfaceTension' || !enabled) {
          return `${key}=${enabled ? 'on' : 'off'}`;
        }
        return effective.surfaceTension
          ? `${key}=on(admitted-single-level-s9ab)`
          : `${key}=pending(${admission?.reason || 'route-not-admitted'})`;
      })
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

  let statusRenderLastMs = 0;
  let statusRenderTimer = null;
  let statusRenderDirty = false;
  function statusPanelHidden() {
    return overlay.querySelector('#sph-panel')?.classList?.contains('collapsed') === true;
  }
  function flushStatusRender() {
    if (statusRenderTimer) {
      clearTimeout(statusRenderTimer);
      statusRenderTimer = null;
    }
    statusRenderDirty = false;
    renderStatusNow();
  }
  function renderStatus() {
    const decision = resolveSphStatusRefreshDecision({
      panelHidden: statusPanelHidden(),
      lastRenderMs: statusRenderLastMs,
      nowMs: Date.now()
    });
    if (decision.action === 'skip-hidden') {
      statusRenderDirty = true;
      return;
    }
    if (decision.action === 'render-now') {
      statusRenderDirty = false;
      renderStatusNow();
      return;
    }
    statusRenderDirty = true;
    if (statusRenderTimer) return;
    statusRenderTimer = setTimeout(() => {
      statusRenderTimer = null;
      if (statusRenderDirty && !statusPanelHidden()) {
        statusRenderDirty = false;
        renderStatusNow();
      }
    }, decision.delayMs);
  }
  function renderStatusNow() {
    statusRenderLastMs = Date.now();
    currentResidentStepsPerSchedule();
    if (simulationRuntimeBlocked()) {
      statusEl.textContent = `simulation blocked — ${simulationRuntimeAdmission.reason}`;
      return;
    }
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
      const renderStateReadbackAvailable = residentSteps?.renderStateReadbackAvailable
        ?? residentStep?.renderStateReadbackAvailable
        ?? null;
      const {
        normalHotLoopReadbackFree,
        productionHotLoopHostDependencyFree
      } = currentResidentReadbackTelemetryEvidence({
        residentSteps,
        residentStep
      });
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
        `render readback  : available=${renderStateReadbackAvailable == null ? 'pending' : String(renderStateReadbackAvailable)} hot-loop-no-full=${normalHotLoopReadbackFree == null ? 'pending' : String(normalHotLoopReadbackFree)} production-host-free=${productionHotLoopHostDependencyFree == null ? 'pending' : String(productionHotLoopHostDependencyFree)}`,
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
        `resident profile : submissions=${residentPerfSummary?.residentSubmissions ?? 0} stale=${residentPerfSummary?.staleResidentSubmissions ?? 0} substeps=${residentPerfSummary?.residentStepsPerSchedule ?? currentResidentStepsPerSchedule()} target=${currentResidentTargetSubsteps()} step-ms=${fmt(residentPerfSummary?.lastResidentMs, 1)} render-ms=${fmt(residentPerfSummary?.lastRenderReadbackMs, 1)} ${residentCompletionRateStatusText()}`,
        `resident stages  : ${residentStageTimingStatusText(residentStageTiming)}`,
        `scene sync       : ${sceneSyncTimingStatusText(overlay.__sphSetParticlesTiming)}`,
        `worker rebuild   : ${workerRebuildTimingStatusText(workerTiming)}`,
        `fps              : render ${fmt(frameCounters.renderFps, 1)} physics ${fmt(frameCounters.physicsFps, 1)} resident ${fmt(frameCounters.residentFps, 1)} ${residentCompletionRateStatusText()}`,
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
    const {
      normalHotLoopReadbackFree,
      productionHotLoopHostDependencyFree
    } = currentResidentReadbackTelemetryEvidence({
      residentSteps,
      residentStep
    });
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
      `render readback  : available=${renderStateReadbackAvailable == null ? 'pending' : String(renderStateReadbackAvailable)} hot-loop-no-full=${normalHotLoopReadbackFree == null ? 'pending' : String(normalHotLoopReadbackFree)} production-host-free=${productionHotLoopHostDependencyFree == null ? 'pending' : String(productionHotLoopHostDependencyFree)}`,
      `material iface  : owner=${residentMaterialInterfaceState?.authority || 'pending'} source=${residentMaterialInterfaceState?.source || 'pending'} status=${residentMaterialInterfaceState?.status || 'pending'} ready=${residentMaterialInterfaceState?.readySurfaceCount ?? 0}/${residentMaterialInterfaceState?.surfaceCount ?? 0} source-field=${residentMaterialInterfaceState?.interfaceSourceFieldSchema || residentMaterialInterfaceState?.sourceFieldSchema || 'pending'} candidate-readback=${Boolean(residentMaterialInterfaceState?.candidateReadback)}`,
      `render source    : ${renderSource} status=${renderRowsStatus} backend=${renderRowsBackend} rows=${renderRowsCount} field-cells=${renderFieldCells} field-readback=${Boolean(renderFieldReadback)}`,
      `render mode      : ${renderModeStatusText(residentSurfaceDraw, residentRenderState)}`,
      `render error     : ${residentRenderError || 'none'}`,
      `surface draw     : status=${residentSurfaceDraw?.status || residentRenderState?.surfaceDrawStatus || 'pending'} policy=${residentSurfaceDraw?.overlayPolicyStatus || residentRenderState?.surfaceDrawOverlayPolicyStatus || residentSurfaceOverlayPolicy?.status || 'pending'} mode=${residentSurfaceDraw?.overlayPolicyMode || residentRenderState?.surfaceDrawOverlayPolicyMode || residentSurfaceOverlayPolicy?.mode || 'pending'} active=${residentSurfaceDraw?.activeSurfaceCount ?? residentRenderState?.surfaceDrawActiveSurfaceCount ?? 0} vertices=${residentSurfaceDraw?.vertexCount ?? residentRenderState?.surfaceDrawVertexCount ?? 0} draw-retained=${Boolean(residentSurfaceDraw?.drawRowsBufferRetained ?? residentRenderState?.surfaceDrawRowsBufferRetained)} indirect-retained=${Boolean(residentSurfaceDraw?.drawIndirectRowsBufferRetained ?? residentRenderState?.surfaceDrawIndirectRowsBufferRetained)} compact-retained=${Boolean(residentSurfaceDraw?.compactedVertexRowsBufferRetained ?? residentRenderState?.surfaceDrawCompactedVertexRowsBufferRetained)} readback=${Boolean(residentSurfaceDraw?.surfaceDrawReadback ?? residentRenderState?.surfaceDrawReadback)} bridge=${residentSurfaceDraw?.visibleRendererBridge || residentRenderState?.surfaceDrawVisibleRendererBridge || 'pending'} depth=${residentSurfaceDraw?.renderBridgeDepthPolicy || residentRenderState?.surfaceDrawRenderBridgeDepthPolicy || 'pending'} depth-ready=${Boolean(residentSurfaceDraw?.renderBridgeDepthAttachmentReady ?? residentRenderState?.surfaceDrawRenderBridgeDepthAttachmentReady)} transparent=${residentSurfaceDraw?.renderBridgeTransparencyCompositeMode || residentRenderState?.surfaceDrawRenderBridgeTransparencyCompositeMode || 'pending'} optics=${residentSurfaceDraw?.renderBridgeOpticalRenderSource || residentRenderState?.surfaceDrawRenderBridgeOpticalRenderSource || 'pending'} records=${residentSurfaceDraw?.renderBridgeOpticalRecordCount ?? residentRenderState?.surfaceDrawRenderBridgeOpticalRecordCount ?? 0} spectra=${residentSurfaceDraw?.renderBridgeOpticalSpectralSampleCount ?? residentRenderState?.surfaceDrawRenderBridgeOpticalSpectralSampleCount ?? 0} swap=${residentSurfaceDraw?.renderBridgeTemporalSwapPolicy || residentRenderState?.surfaceDrawRenderBridgeTemporalSwapPolicy || 'pending'} retained=${Boolean(residentSurfaceDraw?.renderBridgeRetainedPreviousOverlay ?? residentRenderState?.surfaceDrawRenderBridgeRetainedPreviousOverlay)}`,
      `render pressure  : source=${renderPressureSource} optical-state=${Boolean(renderPressureOpticalState)}`,
      `steam optics     : ${vaporOpticalModeStatusText()}`,
      `render cadence   : every=${renderCadence?.cadence ?? RESIDENT_RENDER_READBACK_CADENCE} effective=${renderCadence?.effectiveCadence ?? residentPerfSummary?.effectiveRenderReadbackCadence ?? RESIDENT_RENDER_READBACK_CADENCE} forced=${Boolean(renderCadence?.forced ?? residentPerfSummary?.playbackVisualRefreshForced)} reason=${renderCadence?.reason || 'pending'} sequence=${renderCadence?.sequence ?? 0} skipped=${renderCadence?.skippedCount ?? 0} last-skipped=${Boolean(renderCadence?.skipped)}`,
      `resident profile : submissions=${residentPerfSummary?.residentSubmissions ?? 0} stale=${residentPerfSummary?.staleResidentSubmissions ?? 0} substeps=${residentPerfSummary?.residentStepsPerSchedule ?? currentResidentStepsPerSchedule()} target=${currentResidentTargetSubsteps()} step-ms=${fmt(residentPerfSummary?.lastResidentMs, 1)} render-ms=${fmt(residentPerfSummary?.lastRenderReadbackMs, 1)} ${residentCompletionRateStatusText()}`,
      `resident stages  : ${residentStageTimingStatusText(residentStageTiming)}`,
      `cpu step stages  : ${cpuDriverStepTimingStatusText(cpuDriverStepTiming)}`,
      `scene sync       : ${sceneSyncTimingStatusText(overlay.__sphSetParticlesTiming)}`,
      `worker rebuild   : ${workerRebuildTimingStatusText(workerTiming)}`,
      `fps              : render ${fmt(frameCounters.renderFps, 1)} physics ${fmt(frameCounters.physicsFps, 1)} resident ${fmt(frameCounters.residentFps, 1)} ${residentCompletionRateStatusText()}`,
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
  // Editing a control stages the change instead of rebuilding under the user.
  // A rebuild mid-run discards the state they were watching and, for controls
  // that move geometry, does it while the solver is mid-step. Changes apply on
  // Play or Reset.
  let pendingControlEdit = false;
  let pendingPostRebuildIntent = null;
  function stageControlEdit() {
    pendingControlEdit = true;
    if (playing) {
      playing = false;
      const playButton = overlay.querySelector('#sph-play');
      if (playButton) playButton.textContent = 'Play';
    }
    syncUrlFromControls();
    renderStatus();
    updateWarningBanner();
  }
  function applyPendingControlEditIfAny(intent = 'preflight') {
    if (!pendingControlEdit) return false;
    pendingPostRebuildIntent = intent;
    scheduleDemoRebuild();
    return true;
  }
  function consumePendingPostRebuildIntent() {
    const intent = pendingPostRebuildIntent;
    pendingPostRebuildIntent = null;
    return intent;
  }
  let playbackLoopScheduled = false;
  stopPlaybackForInvalidInitialBodyDraft = () => {
    playing = false;
    const playButton = overlay.querySelector('#sph-play');
    if (playButton) playButton.textContent = 'Play';
  };

  function requestPlaybackTick() {
    if (playbackLoopScheduled) return;
    playbackLoopScheduled = true;
    requestAnimationFrame(tick);
  }

  function startWorkerResidentPlayback({ force = false } = {}) {
    if (!simulationRuntimeAdmission.ready) return false;
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

  function beginNativeSurfaceLatePresentationSuccessRecovery() {
    const context = residentNativeSurfaceCameraPresentationRecoveryContext;
    const gateSnapshot = residentPostStepPresentationGate || null;
    const scheduler = scene?.scene?.userData
      ?.sphNativeSurfaceCandidateValidationScheduler || null;
    const sourceStillCurrent = () => Boolean(
      context?.isCurrent?.() === true
      && residentExecutionIsCurrentForNativePresentationRecovery(context?.execution)
    );
    const resolveSuccess = (gate = residentPostStepPresentationGate || null) =>
      resolveSphNativeSurfaceLatePresentationSuccessEligibility({
        context,
        gate,
        scheduler: scene?.scene?.userData
          ?.sphNativeSurfaceCandidateValidationScheduler || null,
        sourceStillCurrent: sourceStillCurrent()
      });
    const success = resolveSuccess(gateSnapshot);
    if (!gateSnapshot || success.eligible !== true) return false;

    const recoveryKey = [
      context?.generation ?? null,
      context?.scheduleToken ?? null,
      success.requestToken,
      success.candidateGeneration,
      success.lifecycleGeneration
    ].join(':');
    const priorRecovery = residentNativeSurfaceLatePresentationRecovery;
    if (priorRecovery?.recoveryKey === recoveryKey) {
      // A pending exact receipt is already being awaited, or this exact
      // receipt already failed presentation admission. Do not create a polling
      // retry loop around the same successful scheduler terminal.
      return priorRecovery.active === true;
    }

    const candidateHandoff = currentNativeSurfaceCandidateCompletionHandoff(
      context?.execution,
      { allowSurfaceDrawRequestFallback: false }
    );
    const candidateMatchesTerminal = Boolean(
      candidateHandoff.selection?.selectedSchedulerLatest === true
      && candidateHandoff.request?.token === success.requestToken
      && candidateHandoff.request?.candidateGeneration
        === success.candidateGeneration
      && candidateHandoff.request?.lifecycleGeneration
        === success.lifecycleGeneration
      && candidateHandoff.expectedResidentExecutionGeneration
        === context?.sourceResidentExecutionGeneration
      && candidateHandoff.expectedResidentStepsSignature
        === context?.sourceResidentStepsSignature
      && candidateHandoff.expectedResidentStepSignature
        === context?.sourceResidentStepSignature
      && candidateHandoff.handoff?.completion
      && typeof candidateHandoff.handoff.completion.then === 'function'
    );
    if (!candidateMatchesTerminal) return false;

    // CAS the held lineage from N/N to the exact scheduler-current terminal
    // receipt (which can be a later N+1/N+1 within this same lifecycle).
    // From here on every asynchronous write is tied to this exact object.
    if (residentPostStepPresentationGate !== gateSnapshot) return false;
    const targetGate = Object.freeze({
      ...gateSnapshot,
      status: 'native-surface-post-step-presentation-unadmitted',
      active: true,
      requestToken: success.requestToken,
      candidateGeneration: success.candidateGeneration,
      lifecycleGeneration: success.lifecycleGeneration,
      latePresentationSuccessRecoveryKey: recoveryKey,
      latePresentationSuccessSupersedesGate: success.supersedesGate === true,
      latePresentationSuccessHeldRequestToken: success.gateRequestToken,
      latePresentationSuccessHeldCandidateGeneration:
        success.gateCandidateGeneration,
      latePresentationSuccessHeldLifecycleGeneration:
        success.gateLifecycleGeneration,
      reason:
        'resident playback remains held while a scheduler-current native candidate that settled after the bounded handoff wait is runtime-admitted',
      updatedAtMs: performance.now()
    });
    residentPostStepPresentationGate = targetGate;
    overlay.__sphResidentPostStepPresentationGate = targetGate;
    const recoveryEpoch = residentNativeSurfaceLatePresentationRecoveryEpoch + 1;
    residentNativeSurfaceLatePresentationRecoveryEpoch = recoveryEpoch;
    const recoveryOwnsTargetGate = () => Boolean(
      residentNativeSurfaceLatePresentationRecoveryEpoch === recoveryEpoch
      && residentPostStepPresentationGate === targetGate
      && sourceStillCurrent()
    );
    const exactTerminalIsStillCurrent = () => {
      if (!recoveryOwnsTargetGate()) return null;
      const current = resolveSuccess(targetGate);
      return current.eligible === true
        && current.requestToken === success.requestToken
        && current.candidateGeneration === success.candidateGeneration
        && current.lifecycleGeneration === success.lifecycleGeneration
        ? current
        : null;
    };
    const publishRecovery = (status, {
      active = false,
      ...extra
    } = {}) => {
      if (!recoveryOwnsTargetGate()) return null;
      const next = Object.freeze({
        schema: 'peercompute.ulg.sph-native-surface-late-presentation-recovery.v0',
        status,
        active,
        recoveryKey,
        recoveryEpoch,
        generation: context?.generation ?? null,
        scheduleToken: context?.scheduleToken ?? null,
        heldRequestToken: success.gateRequestToken,
        heldCandidateGeneration: success.gateCandidateGeneration,
        heldLifecycleGeneration: success.gateLifecycleGeneration,
        requestToken: success.requestToken,
        candidateGeneration: success.candidateGeneration,
        lifecycleGeneration: success.lifecycleGeneration,
        supersedesHeldGate: success.supersedesGate === true,
        sourceExecutionGeneration:
          context?.sourceResidentExecutionGeneration ?? null,
        sourceExecutionVerified: sourceStillCurrent(),
        ...extra,
        updatedAtMs: performance.now()
      });
      residentNativeSurfaceLatePresentationRecovery = next;
      overlay.__sphNativeSurfaceLatePresentationRecovery = next;
      return next;
    };
    publishRecovery('native-surface-late-presentation-recovery-handoff-pending', {
      active: true
    });
    void (async () => {
      const handoffWait = await waitForNativeSurfaceCandidateCompletionHandoff(
        candidateHandoff.handoff,
        // The public terminal proves the scheduler completion has already
        // settled; await the exact private derived receipt without inventing
        // a timer race between those two promise reactions. Object-identity
        // CAS checks below make a reset or newer terminal harmless.
        { timeoutMs: null }
      );
      if (!exactTerminalIsStillCurrent()) {
        publishRecovery('native-surface-late-presentation-recovery-terminal-no-longer-current');
        return;
      }
      const handoffAdmission =
        resolveSphNativeSurfaceCandidateCompletionHandoff({
          handoff: handoffWait,
          expectedRequestToken: success.requestToken,
          expectedLifecycleGeneration: success.lifecycleGeneration,
          expectedCandidateGeneration: success.candidateGeneration,
          expectedResidentExecutionGeneration:
            context?.sourceResidentExecutionGeneration ?? null,
          expectedResidentStepsSignature:
            context?.sourceResidentStepsSignature ?? null,
          expectedResidentStepSignature:
            context?.sourceResidentStepSignature ?? null
        });
      if (handoffAdmission.admitted !== true || !exactTerminalIsStillCurrent()) {
        publishRecovery('native-surface-late-presentation-recovery-handoff-not-admitted', {
          handoffStatus: handoffAdmission.status,
          handoffAdmitted: handoffAdmission.admitted === true
        });
        return;
      }
      const currentRenderState = scene.getSphResidentRenderState?.()
        || overlay.__sphResidentRenderState
        || null;
      const currentSurfaceDraw = scene.getSphResidentSurfaceDraw?.()
        || overlay.__sphResidentSurfaceDraw
        || null;
      const presentationAdmitted = residentPresentationIsAdmitted(
        currentRenderState,
        currentSurfaceDraw,
        { requireCurrentSource: true }
      );
      const proof = overlay.__sphResidentPresentationProof || null;
      if (!presentationAdmitted || !exactTerminalIsStillCurrent()) {
        publishRecovery('native-surface-late-presentation-recovery-not-admitted', {
          handoffStatus: handoffAdmission.status,
          handoffAdmitted: handoffAdmission.admitted === true,
          proofStatus: proof?.status ?? null,
          proofSourceCurrent: proof?.sourceCurrent === true
        });
        return;
      }
      // The object identity check is the final compare-and-swap. A reset,
      // newer gate, or competing recovery cannot be overwritten by this
      // late promise after its exact presentation admission returns.
      if (!recoveryOwnsTargetGate()) return;
      const admittedGate = Object.freeze({
        ...targetGate,
        status: 'native-surface-post-step-presentation-admitted',
        active: false,
        proofStatus: proof?.status ?? null,
        sourceCurrent: proof?.sourceCurrent === true,
        postStepPresentationAdmitted: true,
        postStepPresentationProved: proof?.foregroundProved === true,
        reason:
          'the scheduler-current exact native source was runtime-admitted after its bounded handoff wait elapsed',
        updatedAtMs: performance.now()
      });
      residentPostStepPresentationGate = admittedGate;
      overlay.__sphResidentPostStepPresentationGate = admittedGate;
      if (residentNativeSurfaceLatePresentationRecoveryEpoch !== recoveryEpoch
        || residentPostStepPresentationGate !== admittedGate) {
        return;
      }
      const admittedRecovery = Object.freeze({
        schema: 'peercompute.ulg.sph-native-surface-late-presentation-recovery.v0',
        status: 'native-surface-late-presentation-recovery-admitted',
        active: false,
        recoveryKey,
        recoveryEpoch,
        generation: context?.generation ?? null,
        scheduleToken: context?.scheduleToken ?? null,
        heldRequestToken: success.gateRequestToken,
        heldCandidateGeneration: success.gateCandidateGeneration,
        heldLifecycleGeneration: success.gateLifecycleGeneration,
        requestToken: success.requestToken,
        candidateGeneration: success.candidateGeneration,
        lifecycleGeneration: success.lifecycleGeneration,
        supersedesHeldGate: success.supersedesGate === true,
        sourceExecutionGeneration:
          context?.sourceResidentExecutionGeneration ?? null,
        sourceExecutionVerified: true,
        handoffStatus: handoffAdmission.status,
        handoffAdmitted: true,
        proofStatus: proof?.status ?? null,
        proofSourceCurrent: proof?.sourceCurrent === true,
        proofForegroundProved: proof?.foregroundProved === true,
        updatedAtMs: performance.now()
      });
      residentNativeSurfaceLatePresentationRecovery = admittedRecovery;
      overlay.__sphNativeSurfaceLatePresentationRecovery = admittedRecovery;
      overlay.__sphResidentRenderState = currentRenderState;
      overlay.__sphResidentSurfaceDraw = currentSurfaceDraw;
      completePendingBodyEnvelopePreview({
        generation: context?.generation,
        reason: 'resident-post-step-late-presentation-recovery-ready'
      });
      requestPlaybackTick();
    })().catch((error) => {
      publishRecovery('native-surface-late-presentation-recovery-error', {
        error: error instanceof Error ? error.message : String(error)
      });
    });
    return true;
  }

  function beginNativeSurfaceCameraPresentationRecoveryFromSchedulerFailure() {
    const context = residentNativeSurfaceCameraPresentationRecoveryContext;
    const failure = resolveNativeSurfaceCameraPresentationRecoveryFailure(context);
    const gate = residentPostStepPresentationGate || null;
    // The in-schedule handoff loop owns proof-pending and retry-pending
    // states. This late path exists only for the N -> N + 1 terminal race
    // after the original post-step attempt has already finalized unadmitted.
    if (
      gate?.status !== 'native-surface-post-step-presentation-unadmitted'
      || failure.eligible !== true
    ) {
      return false;
    }
    const failureKey = [
      failure.terminalRequestToken,
      failure.terminalLifecycleGeneration,
      failure.terminalCandidateGeneration
    ].join(':');
    const previousRecovery = residentNativeSurfaceCameraPresentationRecovery;
    const previousMatchesContext = Boolean(
      previousRecovery
      && Number(previousRecovery.generation) === Number(context?.generation)
      && Number(previousRecovery.scheduleToken) === Number(context?.scheduleToken)
    );
    if (previousRecovery?.active === true) return true;
    // Never issue a second render refresh for the exact same settled failure.
    // A later terminal receipt can be considered, but only within the bounded
    // per-gate retry budget below.
    if (
      previousMatchesContext
      && previousRecovery?.failureKey === failureKey
    ) {
      return false;
    }
    const priorAttempt = previousMatchesContext
      && Number.isSafeInteger(Number(previousRecovery?.retryAttempt))
      ? Math.max(0, Number(previousRecovery.retryAttempt))
      : 0;
    const retryAttempt = priorAttempt + 1;
    if (retryAttempt > NATIVE_SURFACE_CAMERA_PRESENTATION_RECOVERY_MAX_ATTEMPTS) {
      residentNativeSurfaceCameraPresentationRecovery = Object.freeze({
        ...(previousMatchesContext ? previousRecovery : {}),
        schema: 'peercompute.ulg.sph-native-surface-camera-presentation-recovery.v0',
        status: 'native-surface-camera-presentation-recovery-retry-limit-reached',
        active: false,
        generation: context?.generation ?? null,
        scheduleToken: context?.scheduleToken ?? null,
        failureKey,
        retryAttempt: priorAttempt,
        sourceExecutionVerified: failure.sourceStillCurrent === true,
        updatedAtMs: performance.now()
      });
      overlay.__sphNativeSurfaceCameraPresentationRecovery =
        residentNativeSurfaceCameraPresentationRecovery;
      return false;
    }
    const sourceExecutionIsStillCurrent = () => Boolean(
      context?.isCurrent?.() === true
      && residentExecutionIsCurrentForNativePresentationRecovery(context?.execution)
    );
    const contextIsStillCurrent = () => Boolean(
      sourceExecutionIsStillCurrent()
      && residentPostStepPresentationGate?.active === true
      && Number(residentPostStepPresentationGate?.generation)
        === Number(context?.generation)
      && Number(residentPostStepPresentationGate?.scheduleToken)
        === Number(context?.scheduleToken)
    );
    if (residentPostStepPresentationGate !== gate || !contextIsStillCurrent()) {
      return false;
    }
    let recoveryGate = Object.freeze({
      ...gate,
      status: 'native-surface-post-step-presentation-camera-retry-pending',
      active: true,
      retryAttempt,
      failureCode: SPH_NATIVE_SURFACE_CAMERA_SNAPSHOT_STALE_ERROR_CODE,
      failureRequestToken: failure.terminalRequestToken,
      failureCandidateGeneration: failure.terminalCandidateGeneration,
      failureLifecycleGeneration: failure.terminalLifecycleGeneration,
      reason:
        'the current exact native source hit a typed camera snapshot drift after an earlier candidate handoff; it is being revalidated without advancing physics',
      updatedAtMs: performance.now()
    });
    residentPostStepPresentationGate = recoveryGate;
    overlay.__sphResidentPostStepPresentationGate = recoveryGate;
    const recoveryEpoch = residentNativeSurfaceCameraPresentationRecoveryEpoch + 1;
    residentNativeSurfaceCameraPresentationRecoveryEpoch = recoveryEpoch;
    const recoveryOwnsGate = () => Boolean(
      residentNativeSurfaceCameraPresentationRecoveryEpoch === recoveryEpoch
      && residentPostStepPresentationGate === recoveryGate
      && contextIsStillCurrent()
    );
    const publishRecovery = (status, {
      active = false,
      ...extra
    } = {}) => {
      if (!recoveryOwnsGate()) return null;
      const next = Object.freeze({
        schema: 'peercompute.ulg.sph-native-surface-camera-presentation-recovery.v0',
        status,
        active,
        recoveryEpoch,
        generation: context?.generation ?? null,
        scheduleToken: context?.scheduleToken ?? null,
        failureKey,
        failedRequestToken: failure.terminalRequestToken,
        failedCandidateGeneration: failure.terminalCandidateGeneration,
        failedLifecycleGeneration: failure.terminalLifecycleGeneration,
        failureCode: SPH_NATIVE_SURFACE_CAMERA_SNAPSHOT_STALE_ERROR_CODE,
        retryAttempt,
        sourceExecutionGeneration:
          context?.sourceResidentExecutionGeneration ?? null,
        sourceExecutionVerified: recoveryOwnsGate(),
        ...extra,
        updatedAtMs: performance.now()
      });
      residentNativeSurfaceCameraPresentationRecovery = next;
      overlay.__sphNativeSurfaceCameraPresentationRecovery = next;
      return next;
    };
    publishRecovery('native-surface-camera-presentation-recovery-awaiting-camera-settle', {
      active: true
    });
    void (async () => {
      const cameraSettle = await waitForNativeSurfaceCameraPresentationToSettle({
        isCurrent: contextIsStillCurrent
      });
      if (!cameraSettle.settled) {
        publishRecovery(cameraSettle.status, {
          active: false,
          cameraSettle,
          sourceExecutionVerified: false
        });
        return;
      }
      if (!recoveryOwnsGate()) {
        publishRecovery('native-surface-camera-presentation-recovery-source-stale', {
          active: false,
          cameraSettle,
          sourceExecutionVerified: false
        });
        return;
      }
      publishRecovery('native-surface-camera-presentation-recovery-render-refresh-pending', {
        active: true,
        cameraSettle
      });
      const refreshStartedAtMs = performance.now();
      let renderState = null;
      try {
        renderState = await context.refresh?.();
      } catch (error) {
        publishRecovery('native-surface-camera-presentation-recovery-render-refresh-error', {
          active: false,
          cameraSettle,
          error: error instanceof Error ? error.message : String(error)
        });
        return;
      }
      if (!recoveryOwnsGate()) {
        publishRecovery('native-surface-camera-presentation-recovery-source-stale', {
          active: false,
          cameraSettle,
          sourceExecutionVerified: false
        });
        return;
      }
      overlay.__sphResidentRenderState = renderState
        || scene.getSphResidentRenderState?.()
        || overlay.__sphResidentRenderState
        || null;
      overlay.__sphResidentSurfaceDraw =
        scene.getSphResidentSurfaceDraw?.() || null;
      overlay.__sphResidentSurfaceDrawOverlayPolicy =
        scene.getSphResidentSurfaceDrawOverlayPolicy?.() || null;
      overlay.__sphResidentPressureInterfaceState =
        scene.getSphResidentPressureInterfaceState?.() || null;
      residentRenderReadbackCount += 1;
      updateResidentPerf({
        renderReadbacks: residentRenderReadbackCount,
        skippedRenderReadbacks: residentRenderReadbackSkippedCount,
        playbackVisualRefreshForced: true,
        lastRenderReadbackMs: performance.now() - refreshStartedAtMs,
        lastRenderReadbackSkipped: false,
        nativeSurfaceCameraPresentationRecoveryAttempt: retryAttempt
      });
      if (!recoveryOwnsGate()) {
        publishRecovery('native-surface-camera-presentation-recovery-source-stale', {
          active: false,
          cameraSettle,
          sourceExecutionVerified: false
        });
        return;
      }
      const candidateHandoff =
        currentNativeSurfaceCandidateCompletionHandoff(
          context.execution,
          { allowSurfaceDrawRequestFallback: false }
        );
      const retryRequestToken = nativeSurfaceCandidateCompletionHandoffExactInteger(
        candidateHandoff.request?.token
      );
      const retryCandidateGeneration = nativeSurfaceCandidateCompletionHandoffExactInteger(
        candidateHandoff.request?.candidateGeneration
      );
      const retryLifecycleGeneration = nativeSurfaceCandidateCompletionHandoffExactInteger(
        candidateHandoff.request?.lifecycleGeneration
      );
      const retrySourceMatchesContext = Boolean(
        candidateHandoff.expectedResidentExecutionGeneration
          === context?.sourceResidentExecutionGeneration
        && candidateHandoff.expectedResidentStepsSignature
          === context?.sourceResidentStepsSignature
        && candidateHandoff.expectedResidentStepSignature
          === context?.sourceResidentStepSignature
      );
      if (
        retryRequestToken == null
        || retryCandidateGeneration == null
        || retryLifecycleGeneration == null
        || retryRequestToken <= failure.terminalRequestToken
        || retryCandidateGeneration <= failure.terminalCandidateGeneration
        || retryLifecycleGeneration !== context?.gateLifecycleGeneration
        || !retrySourceMatchesContext
      ) {
        publishRecovery('native-surface-camera-presentation-recovery-candidate-unavailable', {
          active: false,
          cameraSettle,
          requestToken: retryRequestToken,
          candidateGeneration: retryCandidateGeneration,
          lifecycleGeneration: retryLifecycleGeneration,
          retrySourceMatchesContext
        });
        return;
      }
      if (!recoveryOwnsGate()) return;
      recoveryGate = Object.freeze({
        ...recoveryGate,
        requestToken: retryRequestToken,
        candidateGeneration: retryCandidateGeneration,
        lifecycleGeneration: retryLifecycleGeneration,
        sourceResidentExecutionGeneration:
          candidateHandoff.expectedResidentExecutionGeneration ?? null,
        sourceResidentStepsSignature:
          candidateHandoff.expectedResidentStepsSignature ?? null,
        sourceResidentStepSignature:
          candidateHandoff.expectedResidentStepSignature ?? null,
        updatedAtMs: performance.now()
      });
      residentPostStepPresentationGate = recoveryGate;
      overlay.__sphResidentPostStepPresentationGate = recoveryGate;
      publishRecovery('native-surface-camera-presentation-recovery-candidate-handoff-pending', {
        active: true,
        cameraSettle,
        requestToken: retryRequestToken,
        candidateGeneration: retryCandidateGeneration,
        lifecycleGeneration: retryLifecycleGeneration
      });
      const handoffStartedAtMs = performance.now();
      const handoffWait = await waitForNativeSurfaceCandidateCompletionHandoff(
        candidateHandoff.handoff,
        { timeoutMs: NATIVE_SURFACE_CURRENT_PRESENTATION_WAIT_MS }
      );
      if (!recoveryOwnsGate()) {
        publishRecovery('native-surface-camera-presentation-recovery-source-stale', {
          active: false,
          cameraSettle,
          sourceExecutionVerified: false
        });
        return;
      }
      const handoffAdmission =
        resolveSphNativeSurfaceCandidateCompletionHandoff({
          handoff: handoffWait,
          expectedRequestToken: retryRequestToken,
          expectedLifecycleGeneration: retryLifecycleGeneration,
          expectedCandidateGeneration: retryCandidateGeneration,
          expectedResidentExecutionGeneration:
            context?.sourceResidentExecutionGeneration ?? null,
          expectedResidentStepsSignature:
            context?.sourceResidentStepsSignature ?? null,
          expectedResidentStepSignature:
            context?.sourceResidentStepSignature ?? null
        });
      overlay.__sphResidentPostStepPresentationHandoff = Object.freeze({
        schema: 'peercompute.ulg.sph-native-surface-post-step-presentation-handoff.v0',
        status: handoffAdmission.status,
        admitted: handoffAdmission.admitted === true,
        requestToken: retryRequestToken,
        candidateGeneration: retryCandidateGeneration,
        lifecycleGeneration: retryLifecycleGeneration,
        waitStatus: handoffWait?.handoffWaitStatus ?? null,
        waitElapsedMs: handoffWait?.elapsedMs ?? null,
        timedOut: handoffWait?.timedOut === true,
        requestMatches: handoffAdmission.requestMatches === true,
        lifecycleMatches: handoffAdmission.lifecycleMatches === true,
        candidateMatches: handoffAdmission.candidateMatches === true,
        sourceExecutionGenerationMatches:
          handoffAdmission.sourceExecutionGenerationMatches === true,
        sourceStepsSignatureMatches:
          handoffAdmission.sourceStepsSignatureMatches === true,
        sourceStepSignatureMatches:
          handoffAdmission.sourceStepSignatureMatches === true,
        sourceWasCurrent: handoffAdmission.sourceWasCurrent === true,
        sourceResidentExecutionGeneration:
          handoffAdmission.sourceResidentExecutionGeneration ?? null,
        cameraPresentationRecoveryAttempt: retryAttempt,
        updatedAtMs: performance.now()
      });
      recordPerformanceSpan(
        'resident-native-surface-camera-presentation-late-recovery-handoff',
        handoffStartedAtMs,
        performance.now(),
        {
          generation: context?.generation ?? null,
          scheduleToken: context?.scheduleToken ?? null,
          retryAttempt,
          requestToken: retryRequestToken,
          candidateGeneration: retryCandidateGeneration,
          status: handoffAdmission.status,
          admitted: handoffAdmission.admitted === true,
          timedOut: handoffWait?.timedOut === true
        }
      );
      let presentationAdmitted = false;
      if (handoffAdmission.admitted === true) {
        const currentRenderState = scene.getSphResidentRenderState?.()
          || overlay.__sphResidentRenderState
          || null;
        const currentSurfaceDraw = scene.getSphResidentSurfaceDraw?.()
          || overlay.__sphResidentSurfaceDraw
          || null;
        presentationAdmitted = residentPresentationIsAdmitted(
          currentRenderState,
          currentSurfaceDraw,
          { requireCurrentSource: true }
        );
        if (presentationAdmitted) {
          overlay.__sphResidentRenderState = currentRenderState;
          overlay.__sphResidentSurfaceDraw = currentSurfaceDraw;
          completePendingBodyEnvelopePreview({
            generation: context?.generation,
            reason: 'resident-post-step-late-camera-presentation-recovery-ready'
          });
        }
      }
      const proof = overlay.__sphResidentPresentationProof || null;
      overlay.__sphResidentPostStepPresentationProof = proof;
      if (!presentationAdmitted) {
        if (!recoveryOwnsGate()) return;
        recoveryGate = Object.freeze({
          ...recoveryGate,
          status: 'native-surface-post-step-presentation-unadmitted',
          active: true,
          proofStatus: proof?.status ?? null,
          sourceCurrent: proof?.sourceCurrent === true,
          reason:
            'the render-only recovery did not runtime-admit the exact native source; resident physics remains held',
          updatedAtMs: performance.now()
        });
        residentPostStepPresentationGate = recoveryGate;
        overlay.__sphResidentPostStepPresentationGate = recoveryGate;
        publishRecovery('native-surface-camera-presentation-recovery-not-admitted', {
          active: false,
          cameraSettle,
          handoffStatus: handoffAdmission.status,
          proofStatus: proof?.status ?? null,
          proofSourceCurrent: proof?.sourceCurrent === true
        });
        return;
      }
      if (!recoveryOwnsGate()) return;
      // Publish while this recovery still owns the active gate; then perform
      // the final synchronous object-identity CAS to release it.
      publishRecovery('native-surface-camera-presentation-recovery-admitted', {
        active: false,
        cameraSettle,
        requestToken: retryRequestToken,
        candidateGeneration: retryCandidateGeneration,
        lifecycleGeneration: retryLifecycleGeneration,
        handoffStatus: handoffAdmission.status,
        proofStatus: proof?.status ?? null,
        proofSourceCurrent: proof?.sourceCurrent === true,
        proofForegroundProved: proof?.foregroundProved === true,
        sourceExecutionVerified: true
      });
      if (!recoveryOwnsGate()) return;
      const admittedGate = Object.freeze({
        ...recoveryGate,
        status: 'native-surface-post-step-presentation-admitted',
        active: false,
        proofStatus: proof?.status ?? null,
        sourceCurrent: proof?.sourceCurrent === true,
        postStepPresentationAdmitted: true,
        postStepPresentationProved: proof?.foregroundProved === true,
        reason:
          'the exact native source was runtime-admitted by a bounded camera-settle render-only recovery',
        updatedAtMs: performance.now()
      });
      residentPostStepPresentationGate = admittedGate;
      overlay.__sphResidentPostStepPresentationGate = admittedGate;
      window.requestAnimationFrame(() => {
        if (
          !overlay.isConnected
          || !playing
          || residentNativeSurfaceCameraPresentationRecoveryEpoch !== recoveryEpoch
          || !sourceExecutionIsStillCurrent()
          || residentPostStepPresentationGate !== admittedGate
          || admittedGate.active
        ) {
          return;
        }
        scheduleMlsMpmResidentSteps({
          workerLaneProgressEverySteps:
            context.workerLaneProgressEverySteps,
          continueFromResidentState:
            residentGpuContinuationReady(context.execution),
          generation: context.generation
        });
        requestPlaybackTick();
      });
    })().catch((error) => {
      publishRecovery('native-surface-camera-presentation-recovery-error', {
        active: false,
        error: error instanceof Error ? error.message : String(error)
      });
    });
    return true;
  }

  function tick() {
    playbackLoopScheduled = false;
    if (!simulationRuntimeAdmission.ready) {
      stopPlaybackForInvalidInitialBodyDraft();
      return;
    }
    if (!playing || overlay.__sphInitialBodiesDraftInvalid === true) {
      stopPlaybackForInvalidInitialBodyDraft();
      return;
    }
    if (
      residentPostStepPresentationGate?.active
      && Number(residentPostStepPresentationGate.generation) === Number(particleSyncGeneration)
    ) {
      overlay.__mlsMpmResidentAutoSchedule = {
        ...(overlay.__mlsMpmResidentAutoSchedule || {}),
        schema: 'peercompute.ulg.sph-demo-resident-auto-schedule.v0',
        status: 'resident-auto-schedule-held-for-current-native-presentation',
        residentAuto: Boolean(initialResidentAutoEnabled),
        residentPostStepPresentationGate,
        updatedAtMs: performance.now()
      };
      renderStatus();
      updateWarningBanner();
      // A successful exact receipt that settled just after the bounded wait
      // is the narrowest way to release this gate. Only if no such receipt is
      // eligible may the typed camera-only recovery rebuild presentation.
      const lateSuccessRecoveryStarted =
        beginNativeSurfaceLatePresentationSuccessRecovery();
      if (!lateSuccessRecoveryStarted) {
        beginNativeSurfaceCameraPresentationRecoveryFromSchedulerFailure();
      }
      // A failed presentation admission is exceptional. Keep the page responsive
      // without burning a full playback RAF loop while the visible retained
      // surface remains on screen and the gate reports the exact blocker.
      window.setTimeout(() => {
        if (overlay.isConnected && playing) requestPlaybackTick();
      }, 100);
      return;
    }
    if (!driver) {
      if (activeViewState) {
        if (residentStartupPresentationHandoff?.active) {
          renderStatus();
          updateWarningBanner();
          requestPlaybackTick();
          return;
        }
        scheduleMlsMpmResidentSteps({
          continueFromResidentState: residentGpuContinuationReady()
        });
        renderStatus();
        updateWarningBanner();
        requestPlaybackTick();
      }
      return;
    }
    if (residentStartupPresentationGate?.active) {
      overlay.__mlsMpmResidentAutoSchedule = {
        ...(overlay.__mlsMpmResidentAutoSchedule || {}),
        schema: 'peercompute.ulg.sph-demo-resident-auto-schedule.v0',
        status: 'resident-cpu-driver-playback-held-for-initial-native-presentation',
        residentAuto: Boolean(initialResidentAutoEnabled),
        residentStartupPresentationGate,
        updatedAtMs: performance.now()
      };
      renderStatus();
      updateWarningBanner();
      requestPlaybackTick();
      return;
    }
    if (residentStartupPresentationHandoff?.active) {
      overlay.__mlsMpmResidentAutoSchedule = {
        ...(overlay.__mlsMpmResidentAutoSchedule || {}),
        schema: 'peercompute.ulg.sph-demo-resident-auto-schedule.v0',
        status: 'resident-cpu-driver-playback-held-for-native-startup-handoff',
        residentAuto: Boolean(initialResidentAutoEnabled),
        residentStartupPresentationHandoff,
        updatedAtMs: performance.now()
      };
      renderStatus();
      updateWarningBanner();
      requestPlaybackTick();
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

  overlay.querySelector('#sph-preflight').addEventListener('click', () => {
    try {
      const bodies = validateInitialBodiesEditorState(currentInitialBodies);
      const architecture = validateMountedArchitectureControls();
      overlay.__sphControlPreflight = {
        schema: 'peercompute.ulg.sph-mounted-control-preflight.v0',
        status: pendingControlEdit
          ? 'control-preflight-rebuild-submitted'
          : 'control-preflight-current-state-admitted',
        bodyCount: bodies.bodies.length,
        particleCount: bodies.bodies.reduce((sum, body) => (
          sum + body.particlesPerEdge.reduce((product, count) => product * count, 1)
        ), 0),
        architectureProfile: architecture.profile,
        architectureDependencyIssues: architecture.dependencyIssues,
        pendingControlEdit,
        simulationRuntimeReady: simulationRuntimeAdmission.ready === true,
        updatedAtMs: performance.now()
      };
      if (applyPendingControlEditIfAny('preflight')) return;
      renderStatus();
      updateWarningBanner();
    } catch (error) {
      setInitialBodiesEditorError(error, { blocksSimulation: true });
    }
  });
  overlay.querySelector('#sph-step').addEventListener('click', () => {
    if (!simulationRuntimeAdmission.ready) return;
    if (overlay.__sphInitialBodiesDraftInvalid === true) return;
    if (applyPendingControlEditIfAny('step')) return;
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
    if (residentStartupPresentationGate?.active) {
      const deferredManualStep = !initialResidentAutoEnabled
        && deferResidentStartupPresentationManualIntent({
          kind: 'cpu-driver-step',
          reason: 'manual CPU driver step arrived before the first native presentation proof'
        });
      overlay.__mlsMpmResidentAutoSchedule = {
        ...(overlay.__mlsMpmResidentAutoSchedule || {}),
        schema: 'peercompute.ulg.sph-demo-resident-auto-schedule.v0',
        status: deferredManualStep
          ? 'resident-manual-cpu-step-deferred-for-initial-native-presentation'
          : 'resident-manual-step-held-for-initial-native-presentation',
        residentAuto: Boolean(initialResidentAutoEnabled),
        residentStartupPresentationGate,
        updatedAtMs: performance.now()
      };
      renderStatus();
      updateWarningBanner();
      return;
    }
    driver.step(); recordPhysicsFrame(1); syncParticles(); renderStatus(); updateWarningBanner();
  });
  overlay.querySelector('#sph-play').addEventListener('click', (e) => {
    if (!simulationRuntimeAdmission.ready) return;
    if (overlay.__sphInitialBodiesDraftInvalid === true) return;
    // One click applies a staged edit, then resumes this exact Play intent
    // after the supervised rebuild publishes the replacement state.
    if (applyPendingControlEditIfAny('play')) return;
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
    pendingPostRebuildIntent = null;
    syncUrlFromControls();
    scheduleDemoRebuild();
  });
  interactiveControlHandlersBound = true;
  syncSphInteractiveControlAvailability();
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
    // Deferred status work accumulated while hidden lands exactly once on
    // expand, so an opened panel is never stale and a hidden one costs zero.
    if (!collapsed && statusRenderDirty) flushStatusRender();
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
    if (statusRenderTimer != null) {
      clearTimeout(statusRenderTimer);
      statusRenderTimer = null;
    }
    if (rebuildTimer != null) window.clearTimeout(rebuildTimer);
    disposeMountedMechanicsStageWorkerRunner('demo-close');
    cancelPendingLocalBackgroundImage('sph-demo-close-pending-background-image');
    void releaseWorkerLaneNativeSurfacePresentationMirror();
    const retiredLocalBackgroundImageUrl = detachActiveLocalBackgroundImage();
    scene.dispose();
    revokeLocalBackgroundImageObjectUrl(
      retiredLocalBackgroundImageUrl,
      'sph-demo-close-active-background-image'
    );
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
        const message = error instanceof Error ? error.message : String(error);
        recordPerformanceSpan('ulg-runtime worker createSphPhaseDemo failed', submittedAtMs, performance.now(), {
          reason,
          error: message
        });
        overlay.__sphPhaseRebuildWorker = {
          schema: SPH_PHASE_REBUILD_WORKER_STATUS_SCHEMA,
          status: 'blocked-runtime-worker',
          generation,
          reason: message,
          updatedAtMs: performance.now()
        };
        blockSphSimulationRuntime(message, {
          source: 'initial-runtime-worker-rebuild',
          errorCode: error?.code || null
        });
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
  if (residentAutoStartEnabled && driver && overlay.__sphInitialBodiesDraftInvalid !== true) {
    playing = true;
    overlay.querySelector('#sph-play').textContent = 'Pause';
    requestPlaybackTick();
  } else if (residentAutoStartEnabled && overlay.__sphInitialBodiesDraftInvalid !== true) {
    startWorkerResidentPlayback();
  }
  return {
    close,
    overlay,
    setLightingMode(nextMode, options = {}) {
      lightingModeSelect.value = normalizeSphSceneLightingMode(nextMode);
      overlay.__sphSceneLighting = scene.setLightingMode?.(lightingModeSelect.value, options) || null;
      syncLightingQuickToggle();
      syncUrlFromControls();
      renderStatus();
      return overlay.__sphSceneLighting;
    },
    getLightingMode() {
      return scene.getLightingMode?.() || overlay.__sphSceneLighting || null;
    },
    getBackgroundImage() {
      return scene.getBackgroundImage?.() || overlay.__sphSceneBackgroundImage || null;
    },
    getLocalBackgroundImageStatus() {
      return overlay.__sphLocalBackgroundImage || null;
    }
  };
}
