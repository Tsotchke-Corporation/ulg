// Extracted from sphPhaseDemoMount.js (Gate 6 Phase D mechanical decomposition).

import { SPH_ENVIRONMENT_CONTROL_DEFAULTS, sphEnvironmentOptionsFromControls } from '../runtime/sphEnvironmentControls.js';
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
import {
  REACTION_DISCOVERY_CACHE_RECORD_SCHEMA,
  clearReactionDiscoveryCache,
  createReactionDiscoveryCacheKey
} from '../runtime/sph/reactionDiscovery.js';
import {
  SCHROEDER_DYNAMIC_LAW_ROUTING_DEFAULT_POLICY,
  SCHROEDER_DYNAMIC_LAW_ROUTING_POLICIES,
  SCHROEDER_DYNAMIC_LAW_ROUTING_POLICY_AUTHORITATIVE,
  exactSchroederDynamicLawRoutingPolicy
} from '../runtime/sph/schroederDynamicLawRoutingContract.js';
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
import { deriveCompoundClosure } from '../runtime/material/compoundClosure.js';
import {
  CONDENSED_DISPERSED_OPTICAL_REFERENCE_BANK_FINGERPRINT,
  CONDENSED_DISPERSED_OPTICAL_REFERENCE_METHOD_REVISION,
  createCondensedDispersedMediumOpticalClosure
} from '../runtime/material/condensedDispersedOpticalReferences.js';
import { CONDUCTOR_OPTICAL_CONSTANTS_BANK } from '../runtime/material/conductorOpticalConstants.js';
import { deriveElementProperties } from '../runtime/material/elementClosures.js';
import {
  createH2oDispersedMediumOpticalClosure,
  createReferenceAnchoredMaterialClosure,
  deriveFormulaMaterialProperties,
  deriveMaterialProperties,
  resolveMaterialSpec
} from '../runtime/material/materialDerivation.js';
import { requestOpticalGpuDevice } from '../runtime/material/opticalGpuBuffers.js';
import { RESIDENT_SPH_STORAGE_BUFFERS_PER_STAGE } from '../runtime/webgpuDeviceLimits.js';
import { materialDerivationSummary } from '../runtime/material/propertyProvenance.js';
import { MOLECULAR_ELECTRONIC_BANDS_BANK } from '../runtime/material/referenceBankAnchoring.js';


export const WALL_FACES = ['xMin', 'xMax', 'yMin', 'yMax', 'zMin', 'zMax'];
export const PHYSICAL_LAW_GROUPS = Object.freeze([
  ['mechanics', 'MLS-MPM mechanics', true],
  ['gravity', 'gravity', true],
  ['eos', 'material EOS pressure', true],
  ['pressure', 'gas/pressure coupling', true],
  ['thermal', 'thermal/walls', true],
  ['reactions', 'reactions', true],
  ['viscosity', 'viscosity', true],
  ['surfaceTension', 'surface tension (single-level SS)', false]
]);


// Density of the explicit room-air atmosphere at the standard-atmosphere
// basis (rho * 101325 / p), for the single-level implicit-atmosphere stand-in;
// returns 0 when multi-level SS owns explicit air on levels matching parcel
// size (retiring the implicit stand-in), and undefined without room air.
export function explicitAtmosphereReferenceDensityKgPerM3(inventory, { multiLevelExplicitAir = false } = {}) {
  const pressurePa = Number(inventory?.environment?.totalPressurePa);
  const massKg = Number(inventory?.totalGasMassKg);
  const volumeM3 = Number(inventory?.freeVolumeM3);
  if (inventory?.environment?.mode !== 'air'
    || !(pressurePa > 0) || !(massKg > 0) || !(volumeM3 > 0)) return undefined;
  if (multiLevelExplicitAir === true) return 0;
  return (massKg / volumeM3) * 101325 / pressurePa;
}

export function resolveSphReactionActivationConfiguration({
  reactionsEnabled = true,
  schroederSimulationEnabled = false,
  reactionActivationPolicy = SCHROEDER_DYNAMIC_LAW_ROUTING_DEFAULT_POLICY
} = {}) {
  const normalizedPolicy =
    exactSchroederDynamicLawRoutingPolicy(reactionActivationPolicy)
    ?? SCHROEDER_DYNAMIC_LAW_ROUTING_DEFAULT_POLICY;
  const requestedReactionsEnabled = reactionsEnabled !== false;
  const normalizedSchroederSimulationEnabled =
    schroederSimulationEnabled === true;
  const authoritativeDynamicActivation = Boolean(
    requestedReactionsEnabled
    && normalizedSchroederSimulationEnabled
    && normalizedPolicy === SCHROEDER_DYNAMIC_LAW_ROUTING_POLICY_AUTHORITATIVE
  );
  return Object.freeze({
    schema: 'peercompute.ulg.sph-reaction-activation-configuration.v0',
    reactionsEnabled: requestedReactionsEnabled,
    schroederSimulationEnabled: normalizedSchroederSimulationEnabled,
    reactionActivationPolicy: normalizedPolicy,
    hardUserOff: !requestedReactionsEnabled,
    staticReactionExecution: Boolean(
      requestedReactionsEnabled && !authoritativeDynamicActivation
    ),
    authoritativeDynamicActivation
  });
}
export const MECHANICS_MODE_OPTIONS = Object.freeze([
  ['mlsmpm', 'MLS-MPM resident'],
  ['sph', 'Plain SPH CPU reference']
]);
// MLS-MPM resident is the default integrator (standing directive): the GPU
// resident lane owns physics and presentation; the plain SPH CPU reference
// is an explicit opt-out (mech=sph) that owns BOTH its physics and its CPU
// surface rendering - mixed authority draws particle overlays on top of the
// webgpu surface.
export const MECHANICS_MODE_DEFAULT = 'mlsmpm';
export const DROP_MATERIAL_DEFAULT = 'Na';
export const BASE_MATERIAL_DEFAULT = 'h2o';
export const PEER_CLOSURE_CACHE_STORAGE_KEY = 'peercompute.ulg.sph-derived-closure-cache.v1';
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
export const SPH_BUNDLED_BACKGROUND_IMAGES = Object.freeze([
  Object.freeze({ id: 'bg-1', url: './plan/background-1.jpeg', label: 'Subway Vault (1)' }),
  Object.freeze({ id: 'bg-2', url: './plan/background-2.jpg', label: 'Alpine Cloud Sea (2)' }),
  Object.freeze({ id: 'bg-3', url: './plan/background-3.jpg', label: 'Misty Forest Lake (3)' }),
  Object.freeze({ id: 'bg-4', url: './plan/background-4.jpg', label: 'Spiral Galaxy (4)' })
]);
export const SPH_DEFAULT_BACKGROUND_IMAGE_URL = './plan/background-3.jpg';

const SPH_BUNDLED_BACKGROUND_BY_ALIAS = new Map([
  ['/plan/background-1.jpg', './plan/background-1.jpeg'],
  ['/plan/background-1.jpeg', './plan/background-1.jpeg'],
  ['/plan/background-2.jpg', './plan/background-2.jpg'],
  ['/plan/background-3.jpg', './plan/background-3.jpg'],
  ['/plan/background-4.jpg', './plan/background-4.jpg'],
  ['./plan/background-1.jpg', './plan/background-1.jpeg'],
  ['background-1.jpg', './plan/background-1.jpeg'],
  ['background-1.jpeg', './plan/background-1.jpeg'],
  ['background-2.jpg', './plan/background-2.jpg'],
  ['background-3.jpg', './plan/background-3.jpg'],
  ['background-4.jpg', './plan/background-4.jpg'],
  ['1', './plan/background-1.jpeg'],
  ['2', './plan/background-2.jpg'],
  ['3', './plan/background-3.jpg'],
  ['4', './plan/background-4.jpg']
]);
for (const item of SPH_BUNDLED_BACKGROUND_IMAGES) {
  SPH_BUNDLED_BACKGROUND_BY_ALIAS.set(item.id, item.url);
  SPH_BUNDLED_BACKGROUND_BY_ALIAS.set(item.url, item.url);
}

export function normalizeSphBackgroundImageUrl(
  rawValue,
  fallback = SPH_DEFAULT_BACKGROUND_IMAGE_URL
) {
  if (rawValue == null) return fallback;
  const trimmed = String(rawValue).trim();
  if (!trimmed) return '';
  const lowered = trimmed.toLowerCase();
  if (lowered === 'none' || lowered === 'solid' || lowered === 'off' || lowered === 'color') {
    return '';
  }
  if (SPH_BUNDLED_BACKGROUND_BY_ALIAS.has(trimmed)) {
    return SPH_BUNDLED_BACKGROUND_BY_ALIAS.get(trimmed);
  }
  if (SPH_BUNDLED_BACKGROUND_BY_ALIAS.has(lowered)) {
    return SPH_BUNDLED_BACKGROUND_BY_ALIAS.get(lowered);
  }
  return fallback;
}

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
export const PEER_CLOSURE_CACHE_SCHEMA = 'peercompute.ulg.local-derived-closure-cache.v2';
export const PEER_CLOSURE_CACHE_RECORD_SCHEMA = 'peercompute.ulg.local-derived-material-closure-cache-record.v2';
export const PEER_CLOSURE_CACHE_GENERATOR_SCHEMA = 'peercompute.ulg.material-closure-generator-fingerprint.v1';
export const PEER_CLOSURE_CACHE_APP_VERSION = '0.1.0';
export const PEER_CLOSURE_CACHE_METHOD_VERSION = 'ulg.generic-derivation+reference-bank-anchoring.v6';
const PEER_CLOSURE_CACHE_MAX_RECORDS_PER_MATERIAL = 32;
const PEER_CLOSURE_CACHE_GENERATOR_DESCRIPTOR = Object.freeze({
  schema: PEER_CLOSURE_CACHE_GENERATOR_SCHEMA,
  appVersion: PEER_CLOSURE_CACHE_APP_VERSION,
  methodVersion: PEER_CLOSURE_CACHE_METHOD_VERSION,
  moduleUrl: import.meta.url,
  generators: {
    createCondensedDispersedMediumOpticalClosure:
      createCondensedDispersedMediumOpticalClosure.toString(),
    condensedDispersedOpticalReferenceMethodRevision:
      CONDENSED_DISPERSED_OPTICAL_REFERENCE_METHOD_REVISION,
    createH2oDispersedMediumOpticalClosure:
      createH2oDispersedMediumOpticalClosure.toString(),
    createReferenceAnchoredMaterialClosure:
      createReferenceAnchoredMaterialClosure.toString(),
    deriveMaterialProperties: deriveMaterialProperties.toString(),
    resolveMaterialSpec: resolveMaterialSpec.toString(),
    deriveFormulaMaterialProperties: deriveFormulaMaterialProperties.toString(),
    deriveElementProperties: deriveElementProperties.toString(),
    deriveCompoundClosure: deriveCompoundClosure.toString(),
    materialDerivationSummary: materialDerivationSummary.toString()
  },
  referenceBanks: {
    condensedDispersedOpticalConstants: {
      fingerprint: CONDENSED_DISPERSED_OPTICAL_REFERENCE_BANK_FINGERPRINT,
      methodRevision: CONDENSED_DISPERSED_OPTICAL_REFERENCE_METHOD_REVISION
    },
    conductorOpticalConstants: CONDUCTOR_OPTICAL_CONSTANTS_BANK,
    molecularElectronicBands: MOLECULAR_ELECTRONIC_BANDS_BANK
  }
});
export const PEER_CLOSURE_CACHE_GENERATOR_FINGERPRINT = hashPayload(PEER_CLOSURE_CACHE_GENERATOR_DESCRIPTOR);
const ICE_TEMP_K = 233.15;
const IRON_TEMP_K = 1850;
// Default wall reservoir temperature: 20 °C. This stays above the current derived H2O
// liquidus (~286 K) as well as the reference 273.15 K melt point, so the default
// "water/water" controls do not silently freeze wall-adjacent particles.
export const WALL_DEFAULT_K = 293.15;
// Default starting elevations (m) of each block's bottom face: ice on the floor, iron a clear gap
// above it so the drop is visible. Both editable in the panel.
export const ICE_BASE_DEFAULT_M = 0;
export const IRON_BASE_DEFAULT_M = 2.5;
// Snug simulation box sized to the content (1 m base block + drop block + steam headroom) instead
// of the old 10 m domain, so the box wireframe frames the sim and the marching-cubes field spends
// its resolution where the material actually is.
const DEMO_BOX_EDGE_M = 5;
// Default per-axis container dimensions (m). Cubic by default; each axis editable in the panel.
export const BOX_DIM_DEFAULTS_M = { x: 5, y: 5, z: 5 };
// Default particles per block edge: an N-edge block holds N³ particles. Drop block is denser-looking
// at a smaller edge; base block fills a larger footprint.
export const DROP_PARTICLE_EDGE_DEFAULT = 3;
export const BASE_PARTICLE_EDGE_DEFAULT = 5;
// A committed body-card edit updates the authoritative draft immediately,
// while material/reaction closure rebuilds are coalesced across a short burst
// of axis edits or card operations. This avoids queueing obsolete expensive
// rebuilds as somebody tabs through X/Y/Z fields.
export const INITIAL_BODY_EDITOR_REBUILD_DEBOUNCE_MS = 200;
// Default isosurface blob-size multiplier. The default UI scenario keeps this at the explicit
// user-facing scale of 1; targeted tests still override it for smaller diagnostic captures.
export const BLOB_SCALE_DEFAULT = 1;
// Default initial temperatures (K): room-temperature sodium over room-temperature water.
// Editable in the panel.
export const DROP_TEMP_DEFAULT_K = 293.15;
export const BASE_TEMP_DEFAULT_K = 293.15;
export const RESIDENT_STEPS_PER_SCHEDULE_FALLBACK = 2;
export const RESIDENT_STEPS_PER_SCHEDULE_MAX = 16;
export const RESIDENT_PARTICLE_BRIDGE_STEPS_PER_SCHEDULE_MAX = 128;
export const RESIDENT_PARTICLE_BRIDGE_TARGET_BATCH_TIME_S = 1 / 30;
export const RESIDENT_CONTINUATION_CHAIN_BUDGET = 2;
export const RESIDENT_RENDER_READBACK_CADENCE = 3;
// A native surface candidate is not allowed to race ahead of the visible
// presentation forever. This is deliberately bounded: an unusually slow
// presentation admission must not deadlock resident mechanics, while the
// normal path waits long enough to publish the exact current generation.
// Candidate validation is asynchronous and diagnostic pixel proof may permit one GPU
// map timeout. Allow its full deadline plus a commit/frame margin before
// mechanics is allowed to supersede the exact-generation candidate.
export const NATIVE_SURFACE_CURRENT_PRESENTATION_WAIT_MS =
  SPH_NATIVE_WEBGPU_SURFACE_VALIDATION_MAP_TIMEOUT_MS + 250;
export const NATIVE_SURFACE_CAMERA_PRESENTATION_SETTLE_FRAME_COUNT = 6;
export const NATIVE_SURFACE_CAMERA_PRESENTATION_SETTLE_WAIT_MS = 8_000;
export const NATIVE_SURFACE_CAMERA_PRESENTATION_RECOVERY_MAX_ATTEMPTS = 3;
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
export const RESIDENT_PENDING_SLOW_NOTICE_MS = 20_000;
export const RESIDENT_PENDING_WATCHDOG_MS = 120_000;
const RESIDENT_STAGE_ORDER_TRACE_EVENT_LIMIT = 64;
const RESIDENT_VISIBLE_MOTION_THRESHOLD_FRACTION = 1e-3;
const RESIDENT_VISIBLE_MOTION_THRESHOLD_MIN_M = 1e-6;
export const STANDALONE_MECHANICS_PREDICTION_DEFAULT = false;
export const DEFAULT_INTERACTIVE_RENDER_OWNERSHIP_USE_CASE = 'same-device-interactive';

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

export function resolveSphAdaptiveSyncScheduleStepCount({
  baseEffectiveStepCount = 1,
  throughputStepsPerS = null,
  targetScheduleWallS = 0.042,
  minSteps = 4,
  warmupMaxSteps = 4
} = {}) {
  const ceiling = Math.max(1, Math.round(Number(baseEffectiveStepCount) || 1));
  const floorSteps = Math.max(1, Math.min(ceiling, Math.round(Number(minSteps) || 1)));
  const rate = Number(throughputStepsPerS);
  if (!(Number.isFinite(rate) && rate > 0)) {
    const warmup = Math.max(1, Math.round(Number(warmupMaxSteps) || floorSteps));
    return Math.min(ceiling, warmup);
  }
  if (ceiling <= floorSteps) return ceiling;
  const targetWallS = Number(targetScheduleWallS);
  const desired = Math.floor(rate * (Number.isFinite(targetWallS) && targetWallS > 0 ? targetWallS : 0.042));
  return Math.max(floorSteps, Math.min(ceiling, desired));
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
      // The worker-owned canvas presented the current schedule's committed,
      // pre-continuation-captured stage output (see resolveSphResidentPresentationProof).
      || proofStatus === 'worker-resident-presentation-committed'
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
  ...Object.keys(SPH_ENVIRONMENT_CONTROL_DEFAULTS),
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
  'reactionActivationPolicy',
  'lawv',
  'lawst',
  'blob',
  'sdt',
  'exactEnergyLedger',
  'dynamicHierarchyLod',
  'thermalDormancyK',
  'reactionDormancy',
  'thermalPotential',
  'rigidSolids',
  'cfl',
  'cflSafety',
  'implicitPressure',
  'implicitCfl',
  'implicitIters',
  'implicitPrecond',
  'implicitTol',
  'avAlpha',
  'diffAlpha',
  'wallAlpha',
  'sep',
  'sepVel',
  'reactionProductReserveMinimumLiveFraction',
  'reactionProductReserveExactDiscovery',
  'splitSpareLineages',
  'contactSolver',
  'contactJacobiIterations',
  'contactCleanupPasses',
  'contactInnerRounds',
  'ambientPressurePa',
  'submitBurstSteps',
  'realtimePacing',
  'workerLivePreview',
  'compactMechanicsView',
  'observeSpatialAuthority',
  'spatialChurnProfile',
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
  'schroederPhaseSlotRefinement',
  'schroederLiquidPhaseSlotRefinement',
  'liquidPhaseSlotRefinement',
  'schroederLawQueue',
  'stageMechanicsTrace',
  'schroederLawNeighbors',
  'schroederLawNeighborCandidates',
  'schroederParticleStorageMaterialization',
  'ssParticleStorageMaterialization',
  'schroederTwoLevel',
  'ssTwoLevel',
  'schroederLevelChain',
  'ssLevelChain',
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
export const RESIDENT_SURFACE_RENDER_MODE_OPTIONS = Object.freeze([
  ['native-webgpu-surface-consumer', 'Surface - native WebGPU'],
  ['three-render-row-spheres', 'Particles - variable-size PBR spheres'],
  ['three-render-row-points', 'Particles - points'],
  ['auto', 'Auto']
]);
const THREE_WEBGPU_RENDERER_PRESENTATION_RUNTIME_VALIDATED = false;
const THREE_WEBGPU_RENDERER_OWNED_RESIDENT_DEVICE_RUNTIME_VALIDATED = false;

export function normalizeResidentSurfaceDrawDiagnosticMode(value, fallback = 'three-render-row-points') {
  const normalized = String(value ?? fallback).trim().toLowerCase();
  return RESIDENT_SURFACE_DRAW_DIAGNOSTIC_MODES.has(normalized) ? normalized : fallback;
}

// `surfaceDraw` serves two distinct URL roles: scenario presets serialize it
// as mount-time runtime state, while direct URLs and the render-mode control
// use it as an explicit diagnostic override. Treating the former as the latter
// steals display ownership from the worker-owned SS lane after a menu preset
// reload. A same-preset hash value without the diagnostic marker is legacy
// preset serialization; query values, differing values, and the explicit
// `surfaceDrawDiagnostic` marker remain true user overrides.
export function resolveSphResidentSurfaceDrawModeRequest({
  hashSurfaceDraw = null,
  querySurfaceDraw = null,
  hashSurfaceDrawDiagnostic = null,
  querySurfaceDrawDiagnostic = null,
  hashScenarioPresetSurfaceDraw = null
} = {}) {
  const serializedUrlMode = hashSurfaceDraw ?? querySurfaceDraw;
  const diagnosticUrlMode =
    hashSurfaceDrawDiagnostic ?? querySurfaceDrawDiagnostic;
  const requestedUrlMode = serializedUrlMode ?? diagnosticUrlMode;
  const presetMode = hashScenarioPresetSurfaceDraw;
  const normalizeForComparison = (value) =>
    String(value ?? '').trim().toLowerCase();
  const hashMatchesSelectedPreset = Boolean(
    hashSurfaceDraw != null
    && presetMode != null
    && normalizeForComparison(hashSurfaceDraw)
      === normalizeForComparison(presetMode)
  );
  const explicitDiagnosticMarker = diagnosticUrlMode != null;
  const presetSerializedRuntime = Boolean(
    hashMatchesSelectedPreset
    && !explicitDiagnosticMarker
  );
  const explicit = Boolean(
    requestedUrlMode != null
    && !presetSerializedRuntime
  );
  return Object.freeze({
    schema: 'peercompute.ulg.sph-resident-surface-draw-mode-request.v0',
    status: explicit
      ? 'surface-draw-mode-explicit-diagnostic-override'
      : (presetSerializedRuntime
        ? 'surface-draw-mode-preset-runtime-serialized'
        : (presetMode != null
          ? 'surface-draw-mode-preset-runtime-default'
          : 'surface-draw-mode-unconfigured')),
    requestedMode: requestedUrlMode ?? presetMode ?? null,
    requestedUrlMode,
    presetMode: presetMode ?? null,
    explicit,
    explicitDiagnosticMarker,
    presetSerializedRuntime,
    hashMatchesSelectedPreset
  });
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

export function residentSurfaceDrawParticleRenderMode(mode) {
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

export function residentSurfaceDrawModeUsesParticleBridge(mode) {
  return residentSurfaceDrawParticleRenderMode(mode) != null;
}

export function residentSurfaceDrawModeUsesNativeSurfaceConsumer(mode) {
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

export function resolveSphConfiguredAutoplayStartup({
  configured = false,
  runtimeReady = false,
  initialBodiesValid = true,
  startupPresentationReady = true,
  resetPending = false,
  driverReady = false,
  workerViewReady = false
} = {}) {
  let status = 'configured-autoplay-disabled';
  let start = false;
  let mode = null;
  if (configured && !initialBodiesValid) {
    status = 'configured-autoplay-blocked-invalid-initial-bodies';
  } else if (configured && resetPending) {
    status = 'configured-autoplay-waiting-for-reset-rebuild';
  } else if (configured && !runtimeReady) {
    status = 'configured-autoplay-waiting-for-runtime';
  } else if (configured && !startupPresentationReady) {
    status = 'configured-autoplay-waiting-for-startup-presentation';
  } else if (configured && driverReady) {
    status = 'configured-autoplay-driver-ready';
    start = true;
    mode = 'driver';
  } else if (configured && workerViewReady) {
    status = 'configured-autoplay-worker-view-ready';
    start = true;
    mode = 'worker-view';
  } else if (configured) {
    status = 'configured-autoplay-waiting-for-scene';
  }
  return Object.freeze({ status, start, mode });
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
  if (bridge === 'worker-owned-presented-canvas') {
    // The presentation worker owns the visible canvas (transferControlToOffscreen)
    // and draws the retained resident stage output itself. Its receipts are the
    // proof: the worker reports its display canvas visible with content and
    // frames, the retained stage output is preserved, and that output's source
    // step matches the current lane schedule (the scene sets this only from the
    // state-manager-committed presentation of the current schedule, whose source
    // was captured before physics continued, or from an explicit step match).
    // A resident publish marks this state stale until the next render refresh,
    // so a previous batch's frame cannot satisfy requireCurrentSource. This
    // claims an admitted worker presentation, not observed compositor pixels.
    const readFlag = (name) => (surfaceDraw?.[name] ?? renderState[name]) === true;
    const presentationFrameCount = exactNonNegativeInteger(
      renderState.workerOffscreenPresentationFrameCount
    ) ?? 0;
    const displayContentVisible = Boolean(
      renderState.workerOffscreenPresentationDisplayOwner === 'worker'
      && renderState.workerOffscreenPresentationDisplayCanvasVisible === true
      && renderState.workerOffscreenPresentationStatus
        === 'worker-offscreen-display-worker-content-visible'
      && presentationFrameCount > 0
    );
    const retainedStageOutputPreserved = readFlag('workerOffscreenRetainedStageOutputPreserved');
    const retainedStageOutputSourceStepMatchesCurrent =
      readFlag('workerOffscreenRetainedStageOutputSourceStepMatchesCurrent');
    const renderRowsStatus = renderState.workerOffscreenRenderRowsStatus ?? null;
    const workerFrameRendered =
      renderRowsStatus === 'worker-offscreen-resident-isosurface-presentation-rendered';
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
      retainedStageOutputSourceStepMatchesCurrent
      && sourceGenerationMatchesCurrent === true
      && !sourceRetainedPrevious
      && !sourceMarkedStale
    );
    const presentationCommitted = Boolean(
      displayContentVisible
      && retainedStageOutputPreserved
      && workerFrameRendered
    );
    const admitted = Boolean(
      presentationCommitted
      && (!requireCurrentSource || sourceCurrent)
    );
    return {
      visible: admitted,
      admitted,
      foregroundProved: false,
      status: admitted
        ? 'worker-resident-presentation-committed'
        : (requireCurrentSource && presentationCommitted && !sourceCurrent)
          ? 'worker-resident-presentation-stale-source'
          : 'worker-resident-presentation-unadmitted',
      bridge,
      displayContentVisible,
      presentationFrameCount,
      retainedStageOutputPreserved,
      retainedStageOutputSourceStepMatchesCurrent,
      workerFrameRendered,
      renderRowsStatus,
      presentationCommitted,
      requireCurrentSource: Boolean(requireCurrentSource),
      sourceGenerationMatchesCurrent,
      sourceRetainedPrevious,
      sourceMarkedStale,
      sourceCurrent
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

export function nativeSurfaceCandidateCompletionHandoffExactInteger(value) {
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

export function residentSurfaceDrawModeUsesCompactBridge(mode) {
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

export function fmt(n, digits = 2) {
  if (n == null || !Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1e9) return n.toExponential(2);
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(digits)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(digits)}k`;
  return n.toFixed(digits);
}

export function finiteNumberOrNull(value) {
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

export const ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_SCHEMA =
  'peercompute.ulg.worker-offscreen-resident-isosurface-presentation.v0';
export const ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_ENQUEUED_STATUS =
  'worker-offscreen-resident-isosurface-presentation-enqueued';
export const ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS =
  'worker-offscreen-resident-isosurface-presentation-rendered';
export const ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_GEOMETRY =
  'worker-owned-true-isosurface';

function residentWorkerLaneRetainedAuthorityReady(execution = null) {
  const lane = execution?.workerOwnedResidentLane;
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
  );
}

function residentWorkerLaneCommittedPresentationAuthorityReady({
  execution = null,
  presentation = null
} = {}) {
  const lane = execution?.workerOwnedResidentLane;
  return Boolean(
    residentWorkerLaneRetainedAuthorityReady(execution)
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

function residentWorkerLaneParticlePresentationReady(execution = null) {
  const presentation = execution?.workerOwnedResidentLane?.committedPresentation;
  return Boolean(
    presentation?.status
      === 'worker-offscreen-resident-particle-state-producer-rendered'
    && residentWorkerLaneCommittedPresentationAuthorityReady({
      execution,
      presentation
    })
  );
}

export function residentWorkerLaneIsosurfacePresentationEnqueued(
  execution = null
) {
  const presentation = execution?.workerOwnedResidentLane?.committedPresentation;
  return Boolean(
    presentation?.schema
      === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_SCHEMA
    && presentation?.status
      === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_ENQUEUED_STATUS
    && presentation?.presentationGeometry
      === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_GEOMETRY
    && presentation?.sourceCapturedBeforePhysicsContinuation === true
    && residentWorkerLaneCommittedPresentationAuthorityReady({
      execution,
      presentation
    })
  );
}

// Presentation completion is deliberately separate from continuation
// authority. A rendered receipt can claim the worker canvas only when it
// carries the same exact committed schedule identity as its enqueue receipt;
// it can never substitute for that enqueue receipt in the physics hot loop.
export function residentWorkerLaneIsosurfacePresentationConsumerReady({
  execution = null,
  presentation = null
} = {}) {
  return Boolean(
    presentation?.schema
      === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_SCHEMA
    && presentation?.status
      === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS
    && presentation?.presentationGeometry
      === ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_GEOMETRY
    && residentWorkerLaneCommittedPresentationAuthorityReady({
      execution,
      presentation
    })
  );
}

// The asynchronous worker consumer cannot retire a preview at enqueue time.
// Reuse its exact committed-source proof and the live canvas admission checks,
// excluding only the preview gates which this action is responsible for clearing.
export function residentWorkerLaneIsosurfacePendingPreviewRetirementReady({
  execution = null,
  presentation = null,
  observation = null,
  pendingPresentation = null,
  currentParticleGeneration = null,
  currentRebuildGeneration = null,
  resetRebuildPending = false
} = {}) {
  const content = presentation?.displayOwnerLastRenderedContent;
  return Boolean(
    !resetRebuildPending
    && pendingPresentation?.active === true
    && Number.isSafeInteger(currentParticleGeneration)
    && currentParticleGeneration > 0
    && pendingPresentation.particleGeneration === currentParticleGeneration
    && Number.isSafeInteger(currentRebuildGeneration)
    && currentRebuildGeneration >= 0
    && pendingPresentation.generation === currentRebuildGeneration
    && residentWorkerLaneIsosurfacePresentationConsumerReady({
      execution,
      presentation: content
    })
    && presentation?.displayOwner === 'worker'
    && presentation?.displayOwnerContentReady === true
    && Number.isSafeInteger(presentation?.workerFramebufferEpoch)
    && presentation.workerFramebufferEpoch > 0
    && content.workerFramebufferEpoch === presentation.workerFramebufferEpoch
    && Number.isSafeInteger(presentation?.displayOwnerEpoch)
    && presentation.displayOwnerEpoch >= 0
    && content.displayOwnerEpoch === presentation.displayOwnerEpoch
    && observation?.owner === 'worker'
    && observation.displayOwnerEpoch === presentation.displayOwnerEpoch
    && observation.sourceStep === content.sphStep
    && observation.presentationSerial === content.frameCount
    && Array.isArray(observation.admissionBlockers)
    && observation.admissionBlockers.every((blocker) => (
      blocker === 'control-envelope-retired'
      || blocker === 'control-envelope-layer-hidden'
    ))
  );
}

// W4b: continuation readiness for the worker-owned resident lane. The lane
// retains its post-step particle buffers INSIDE the presentation worker, so
// the page-device continuation evidence (nextParticleUploads with live
// GPUBuffers) truthfully does not exist on a worker-lane execution. The lane
// itself is the continuation: a completed, uncancelled schedule whose
// terminal envelope proves retained worker refs and a sealed final epoch
// identity is ready for the next batched schedule on the SAME lane.
export function residentWorkerLaneContinuationReady(execution = null) {
  return residentWorkerLaneParticlePresentationReady(execution)
    || residentWorkerLaneIsosurfacePresentationEnqueued(execution);
}

function residentWorkerLaneTier0LogicalExecutionReady(route = null) {
  const requestedStepCount = route?.requestedStepCount;
  const commandSubmissionCount = route?.commandSubmissionCount;
  const submissionStepCounts = route?.submissionStepCounts;
  const presentationBoundaryCount = route?.presentationBoundaryCount;
  const presentationBoundaryCompletedCount =
    route?.presentationBoundaryCompletedCount;
  const presentationBoundaryFailureCount =
    route?.presentationBoundaryFailureCount;
  const presentationQosHostQueueFenceCount =
    route?.presentationQosHostQueueFenceCount;
  if (
    !Number.isSafeInteger(requestedStepCount)
    || requestedStepCount < 1
    || !Number.isSafeInteger(commandSubmissionCount)
    || commandSubmissionCount < 1
    || !Array.isArray(submissionStepCounts)
    || submissionStepCounts.length !== commandSubmissionCount
    || submissionStepCounts.some(
      (count) => !Number.isSafeInteger(count) || count < 1
    )
    || submissionStepCounts.reduce((sum, count) => sum + count, 0)
      !== requestedStepCount
    || !Number.isSafeInteger(presentationBoundaryCount)
    || presentationBoundaryCount !== commandSubmissionCount - 1
    || !Number.isSafeInteger(presentationBoundaryCompletedCount)
    || presentationBoundaryCompletedCount < 0
    || !Number.isSafeInteger(presentationBoundaryFailureCount)
    || presentationBoundaryFailureCount < 0
    || presentationBoundaryCompletedCount + presentationBoundaryFailureCount
      !== presentationBoundaryCount
    || !Number.isSafeInteger(presentationQosHostQueueFenceCount)
    || presentationQosHostQueueFenceCount
      !== presentationBoundaryCompletedCount
    || route?.logicalAuthorityPublicationCount !== 1
    || route?.intermediateAuthorityPublicationCount !== 0
  ) return false;
  if (route?.submissionMode === 'single-terminal-submission') {
    return commandSubmissionCount === 1
      && submissionStepCounts[0] === requestedStepCount
      && route?.maxSubstepsPerSubmission == null
      && presentationBoundaryCount === 0;
  }
  const maxSubstepsPerSubmission = route?.maxSubstepsPerSubmission;
  return route?.submissionMode === 'queue-ordered-presentation-qos-chunks'
    && commandSubmissionCount > 1
    && Number.isSafeInteger(maxSubstepsPerSubmission)
    && maxSubstepsPerSubmission > 0
    && maxSubstepsPerSubmission < requestedStepCount
    && submissionStepCounts.every(
      (count) => count <= maxSubstepsPerSubmission
    );
}

export function resolveSphWorkerLanePostCommitFastContinuation({
  execution = null,
  workerLivePreviewEnabled = false
} = {}) {
  const lane = execution?.workerOwnedResidentLane ?? null;
  const route = lane?.executionRoute ?? null;
  const isosurfacePresentationEnqueued =
    residentWorkerLaneIsosurfacePresentationEnqueued(execution);
  const blockers = [];
  if (!residentWorkerLaneContinuationReady(execution)) {
    blockers.push('strict-worker-lane-continuation-not-ready');
  }
  if (
    !isosurfacePresentationEnqueued
    && workerLivePreviewEnabled !== true
  ) {
    blockers.push('worker-live-preview-not-enabled');
  }
  if (
    route?.schema !== 'peercompute.ulg.worker-schedule-execution-route-receipt.v6'
    || route?.status !== 'tier0-fused-resident-sequence-admitted'
    || route?.route !== 'tier0-fused-resident-sequence'
    || route?.routeDecisionStatus
      !== 'tier0-fused-resident-sequence-selected'
  ) {
    blockers.push('tier0-route-not-exactly-admitted');
  }
  if (!Array.isArray(route?.blockers) || route.blockers.length !== 0) {
    blockers.push('tier0-route-blockers-present');
  }
  const requestedStepCount = Number(route?.requestedStepCount);
  const completedStepCount = Number(route?.completedStepCount);
  if (
    !Number.isSafeInteger(requestedStepCount)
    || requestedStepCount < 1
    || completedStepCount !== requestedStepCount
    || route?.atomicSchedule !== true
    || !residentWorkerLaneTier0LogicalExecutionReady(route)
    || route?.internalPositionSubstepCount !== requestedStepCount
  ) {
    blockers.push('tier0-atomic-execution-incomplete');
  }
  if (
    execution?.fullParticleReadbackPerformed !== false
    || execution?.fullParticleReadbackFree !== true
    || route?.fullParticleReadbackPerformed !== false
    || route?.fullParticleReadbackFree !== true
    || route?.mapAsyncCount !== 0
    || route?.readbackBytes !== 0
  ) {
    blockers.push('tier0-readback-contract-incomplete');
  }
  if (
    route?.residentContinuationReady !== true
    || route?.terminalFenceSatisfied !== true
  ) {
    blockers.push('tier0-terminal-authority-incomplete');
  }
  return Object.freeze({
    schema:
      'peercompute.ulg.sph-worker-lane-post-commit-fast-continuation.v0',
    status: blockers.length === 0
      ? 'tier0-post-commit-fast-continuation-ready'
      : 'tier0-post-commit-fast-continuation-blocked',
    eligible: blockers.length === 0,
    physicsAuthority:
      blockers.length === 0
        ? 'terminal-fence-compute-manager-state-manager-committed'
        : null,
    presentationConsumer:
      blockers.length === 0
        ? (isosurfacePresentationEnqueued
          ? ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_GEOMETRY
          : 'worker-live-preview-versioned-mailbox')
        : null,
    presentationCompletionReady:
      blockers.length === 0 && !isosurfacePresentationEnqueued,
    scheduleId: lane?.scheduleId ?? null,
    laneId: lane?.laneId ?? null,
    stateKey: lane?.stateKey ?? null,
    route: route?.route ?? null,
    requestedStepCount:
      Number.isSafeInteger(requestedStepCount) ? requestedStepCount : null,
    completedStepCount:
      Number.isSafeInteger(completedStepCount) ? completedStepCount : null,
    blockers: Object.freeze(blockers)
  });
}

// Slice 1.1 (A1 decoupled presentation): when the canonical active-law worker
// lane has already crossed its terminal fence, committed through ComputeManager
// and StateManager, and synchronously captured + enqueued its exact true WebGPU
// isosurface presentation on the worker's OffscreenCanvas, skip the duplicate
// page-device full-particle readback, upload, and secondary surface extraction.
export function resolveSphCanonicalWorkerLanePostCommitFastContinuation({
  execution = null
} = {}) {
  const lane = execution?.workerOwnedResidentLane ?? null;
  const isosurfacePresentationEnqueued =
    residentWorkerLaneIsosurfacePresentationEnqueued(execution);
  const blockers = [];
  if (!residentWorkerLaneContinuationReady(execution)) {
    blockers.push('strict-worker-lane-continuation-not-ready');
  }
  if (!isosurfacePresentationEnqueued) {
    blockers.push('worker-isosurface-presentation-not-enqueued');
  }
  if (execution?.fullParticleReadbackPerformed === true) {
    blockers.push('full-particle-readback-already-performed');
  }
  return Object.freeze({
    schema:
      'peercompute.ulg.sph-canonical-worker-lane-post-commit-fast-continuation.v0',
    status: blockers.length === 0
      ? 'canonical-worker-post-commit-fast-continuation-ready'
      : 'canonical-worker-post-commit-fast-continuation-blocked',
    eligible: blockers.length === 0,
    physicsAuthority:
      blockers.length === 0
        ? 'terminal-fence-compute-manager-state-manager-committed'
        : null,
    presentationConsumer:
      blockers.length === 0
        ? ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_GEOMETRY
        : null,
    presentationCompletionReady: false,
    scheduleId: lane?.scheduleId ?? null,
    laneId: lane?.laneId ?? null,
    stateKey: lane?.stateKey ?? null,
    route: lane?.executionRoute?.route ?? 'canonical-worker-resident-lane',
    blockers: Object.freeze(blockers)
  });
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
  // Upload authority is attached to these exact objects (including the SPH
  // parent/sidecar borrow lifecycle). A structural presentation clone loses
  // that private authority and cannot be authenticated by the renderer.
  // Slot metadata remains on the packed presentation states above.
  const sphParticleUpload = hotBufferRecord.sphUpload;
  const mlsMpmParticleUpload = hotBufferRecord.mlsMpmUpload;
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

export function nowMs() {
  return typeof performance?.now === 'function' ? performance.now() : Date.now();
}

export function remoteResidentTaskGraphRefreshTelemetry(status, extra = {}) {
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

export function formatMaterialPhaseMasses(byMaterialPhase = {}) {
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

export function materialParticleCountsText(counts = {}) {
  const entries = Object.entries(counts)
    .filter(([, count]) => Number(count) > 0)
    .sort(([left], [right]) => String(left).localeCompare(String(right)));
  const total = entries.reduce((sum, [, count]) => sum + (Number(count) || 0), 0);
  const body = entries.map(([material, count]) => `${materialStatusLabel(material)} ${count}`).join('  ');
  return `${body || 'none'}  total ${total}`;
}

export function materialParticleCountsFromMaterials(materials = []) {
  const counts = {};
  for (const descriptor of materials || []) {
    if (descriptor?.spareProductSlot === true || descriptor?.spareSplitSlot === true
      || descriptor?.phaseCompanionSlot === true) continue;
    const material = descriptor?.material || descriptor?.renderKey || 'unknown';
    counts[material] = (counts[material] || 0) + 1;
  }
  return counts;
}

export function materialParticleCountsFromParticles(particles = []) {
  const counts = {};
  for (const particle of particles || []) {
    if (particle?.spareProductSlot === true || particle?.spareSplitSlot === true
      || !(Number(particle?.massKg) > 0)) continue;
    const material = particle?.material || 'unknown';
    counts[material] = (counts[material] || 0) + 1;
  }
  return counts;
}

export function reactionStatusText(note, reactionLedger = null) {
  if (!reactionLedger?.eventCount) return note || '—';
  const productMaterials = Object.keys(reactionLedger.productMassKgByMaterial || {});
  const gasMaterials = Object.keys(reactionLedger.gasMassKgByMaterial || {});
  const productText = productMaterials.length ? `products=${productMaterials.join(',')}` : 'products=none';
  const gasText = gasMaterials.length ? `gas=${gasMaterials.join(',')}` : 'gas=none';
  return `${note || 'reaction'}; events=${reactionLedger.eventCount} ${productText} ${gasText}`;
}

export function phaseStatusText(pre = {}, dropMaterial = 'drop', baseMaterial = 'base') {
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

export function massStatusText(pre = {}, dropMaterial = 'drop', baseMaterial = 'base') {
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

export function moleculesPerMacroStatusText(pre = {}, dropMaterial = 'drop', baseMaterial = 'base') {
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

export function solidFractionStatusText(phase = {}) {
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

export function storageAvailable() {
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

export function materialCacheKey(material) {
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

export function readSphCacheStorageSnapshots() {
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

export function cacheLookupMaterialsForOptions(options) {
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

export function workerCacheLookupInput(options, snapshots = readSphCacheStorageSnapshots()) {
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

export function workerCachePersistenceInput(snapshots = readSphCacheStorageSnapshots()) {
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

export function workerStaticTableCacheInput(snapshots = readSphCacheStorageSnapshots()) {
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

export function reactionRecordFromDiscovery(reactionDiscovery, materialProperties = {}) {
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
      emptyCatalogAuthority: reactionDiscovery.emptyCatalogAuthority || null,
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

export function clearSphLocalDerivedCaches() {
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

export function renderSphPendingBodyEnvelopePreview(layer, preview) {
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

export function hideSphPendingBodyEnvelopePreview(layer) {
  if (!layer) return false;
  layer.hidden = true;
  layer.setAttribute('aria-busy', 'false');
  layer.dataset.status = 'physics-presentation-current';
  return true;
}

export function buildOverlayShell() {
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
      #sph-phase-overlay.ulg-studio-managed #sph-panel,
      #sph-phase-overlay.ulg-studio-managed #sph-toggle,
      #sph-phase-overlay.ulg-studio-managed #sph-lighting-toggle,
      #sph-phase-overlay.ulg-studio-managed #sph-warning-bar { display:none!important;pointer-events:none!important; }
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
      <span id="sph-fps" class="sph-fps-chip" title="Presented/source states count admitted render-input transitions, not pixel-verified motion, over up to five wall-clock seconds. Visible motion rate is unavailable. Physics/resident rates count completed steps. UI rAF counts callbacks; simulation speed is simulated time per wall-clock second.">visible unavailable updates/s | presented unavailable states/s | source unavailable states/s | physics unavailable steps/s</span>
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

export function normalizeUrlControlValue(key, value) {
  if (key === 'drop' || key === 'base') return canonicalMaterialKeyFromUrl(value);
  if (key === 'bg') return normalizeSphSceneBackgroundColorHex(value);
  if (key === 'bgimg') return normalizeSphBackgroundImageUrl(value, SPH_DEFAULT_BACKGROUND_IMAGE_URL);
  if (key === 'lighting') return normalizeSphSceneLightingMode(value);
  if (key === 'reactionActivationPolicy') {
    return exactSchroederDynamicLawRoutingPolicy(value)
      ?? SCHROEDER_DYNAMIC_LAW_ROUTING_DEFAULT_POLICY;
  }
  return value;
}

export function openElementPicker({ overlay, select, roleLabel }) {
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

