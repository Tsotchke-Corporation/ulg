// SPH phase demo UI: a full-viewport overlay with the MLS-MPM-style particle renderer, a
// retro-terminal control panel (six wall temperatures + reduced-resolution controls), and live
// status rows. Also exposes a headless API on window.__ulgDemo for e2e/status checks.

import {
  SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT,
  SPH_RESIDENT_SURFACE_DRAW_OVERLAY_MODE_DEFAULT,
  SPH_SURFACE_RADIUS_SCALE_DEFAULT,
  createSphPhaseScene,
  normalizeResidentSurfaceDrawOverlayMode
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
import { sphTotals } from '../runtime/sph/sphConservation.js';
import { deriveCompoundClosure } from '../runtime/material/compoundClosure.js';
import { deriveElementProperties } from '../runtime/material/elementClosures.js';
import {
  deriveFormulaMaterialProperties,
  deriveMaterialProperties,
  resolveMaterialSpec
} from '../runtime/material/materialDerivation.js';
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
const PEER_CLOSURE_CACHE_STORAGE_KEY = 'peercompute.ulg.sph-derived-closure-cache.v1';
const PEER_CLOSURE_CACHE_SCHEMA = 'peercompute.ulg.local-derived-closure-cache.v2';
const PEER_CLOSURE_CACHE_RECORD_SCHEMA = 'peercompute.ulg.local-derived-material-closure-cache-record.v2';
const PEER_CLOSURE_CACHE_GENERATOR_SCHEMA = 'peercompute.ulg.material-closure-generator-fingerprint.v1';
const PEER_CLOSURE_CACHE_APP_VERSION = '0.1.0';
const PEER_CLOSURE_CACHE_METHOD_VERSION = 'ulg.generic-first-principles-material-derivation.v0';
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
// Default isosurface blob-size multiplier. Kept conservative for dense material cohorts; the
// renderer applies a sparse-cohort floor at the default scale so small drops remain visible without
// bloating the base surface.
const BLOB_SCALE_DEFAULT = SPH_SURFACE_RADIUS_SCALE_DEFAULT;
// Default initial temperatures (K): hot drop block (molten iron above its 1811 K liquidus) and cold
// base block (ice at −40 °F). Editable in the panel.
const DROP_TEMP_DEFAULT_K = 1850;
const BASE_TEMP_DEFAULT_K = 233.15;
const RESIDENT_STEPS_PER_SCHEDULE_FALLBACK = 2;
const RESIDENT_STEPS_PER_SCHEDULE_MAX = 16;
const RESIDENT_CONTINUATION_CHAIN_BUDGET = 2;
const RESIDENT_RENDER_READBACK_CADENCE = 3;
const RESIDENT_PENDING_SLOW_NOTICE_MS = 20_000;
const RESIDENT_PENDING_WATCHDOG_MS = 120_000;
const RESIDENT_VISIBLE_MOTION_THRESHOLD_FRACTION = 1e-3;
const RESIDENT_VISIBLE_MOTION_THRESHOLD_MIN_M = 1e-6;
const STANDALONE_MECHANICS_PREDICTION_DEFAULT = false;
export const SPH_REMOTE_RESIDENT_TASK_GRAPH_REFRESH_SCHEMA =
  'peercompute.ulg.sph-demo-remote-resident-task-graph-refresh.v0';
export const SPH_PHASE_URL_PARAM_KEYS = Object.freeze([
  'sph',
  'sphPhase',
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
  'residentAuto'
]);

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
      #sph-warning-bar { position:absolute;top:0;left:0;right:0;z-index:65;display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:8px 12px 8px 62px;box-sizing:border-box;pointer-events:none; }
      .sph-warning-chip { border:1px solid #f7c675;background:rgba(46,30,8,.92);color:#ffe7b2;padding:4px 7px;font-size:11px;line-height:1.25; }
      .sph-fps-chip { border:1px solid #1d8b6d;background:rgba(4,12,14,.88);color:#75f7b4;padding:4px 7px;font-size:11px;line-height:1.25; }
      @media (max-width:700px) { #sph-panel { width:min(340px,92vw); } #sph-status { font-size:13px; } .sph-element-grid { grid-template-columns:repeat(18,42px);grid-auto-rows:42px; } #sph-phase-overlay .sph-element-cell { min-height:42px; } .sph-element-name { display:none; } }
    </style>
    <div id="sph-scene" style="position:absolute;inset:0;"></div>
    <div id="sph-warning-bar" aria-live="polite">
      <span id="sph-fps" class="sph-fps-chip">render fps -- | physics fps --</span>
    </div>
    <button id="sph-toggle" type="button" aria-label="Toggle controls" style="position:absolute;top:12px;left:12px;z-index:60;">☰ menu</button>
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
  return key === 'drop' || key === 'base'
    ? canonicalMaterialKeyFromUrl(value)
    : value;
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
export function mountSphPhaseDemoOverlay({
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

  const mechanicsModeEl = overlay.querySelector('#sph-mechanics-mode');
  const mechanicsModeSelect = document.createElement('select');
  mechanicsModeSelect.title = 'Choose the mechanical integrator';
  mechanicsModeSelect.setAttribute('aria-label', 'Choose mechanics integrator');
  for (const [value, label] of MECHANICS_MODE_OPTIONS) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    mechanicsModeSelect.appendChild(option);
  }
  mechanicsModeEl.appendChild(mechanicsModeSelect);

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

  const elementsEl = overlay.querySelector('#sph-elements');
  const elementSelects = {};
  for (const [role, label, def] of [['drop', 'drop block', 'fe'], ['base', 'base block', 'h2o']]) {
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
    blob: blobInput
  };
  function urlValueForControl(el) {
    return el?.type === 'checkbox' ? (el.checked ? '1' : '0') : el.value;
  }
  function applyUrlValueToControl(key, el, value) {
    if (el?.type === 'checkbox') {
      el.checked = !['0', 'false', 'off', 'no'].includes(String(value).toLowerCase());
      return;
    }
    el.value = normalizeUrlControlValue(key, value);
  }
  function applyUrlToControls() {
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    for (const [key, el] of Object.entries(urlControls)) {
      const v = hash.get(key) ?? query.get(key);
      if (v != null && v !== '') applyUrlValueToControl(key, el, v);
    }
  }
  const initialQuery = new URLSearchParams(window.location.search);
  const initialHash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
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
  const initialResidentActiveGridEnabled = booleanUrlParam(
    initialHash.get('residentActiveGrid') ?? initialQuery.get('residentActiveGrid'),
    false
  );
  const initialResidentFuseSequenceEnabled = initialResidentActiveGridEnabled || booleanUrlParam(
    initialHash.get('residentFuseSequence') ?? initialQuery.get('residentFuseSequence'),
    false
  );
  const initialResidentActiveGridSafetyCells = positiveIntegerUrlParam(
    initialHash.get('residentActiveGridSafety') ?? initialQuery.get('residentActiveGridSafety')
  );
  function residentExecutionPolicyFromUrl() {
    return {
      schema: 'peercompute.ulg.sph-demo-resident-execution-policy.v0',
      fuseNoFullResidentMechanicsSequence: initialResidentFuseSequenceEnabled,
      fuseNoFullResidentMechanicsActiveGrid: initialResidentActiveGridEnabled,
      activeGridSafetyCells: initialResidentActiveGridSafetyCells
    };
  }
  const residentSurfaceDrawOverlayMode = normalizeResidentSurfaceDrawOverlayMode(
    initialHash.get('surfaceOverlay')
      ?? initialQuery.get('surfaceOverlay')
      ?? SPH_RESIDENT_SURFACE_DRAW_OVERLAY_MODE_DEFAULT
  );
  const residentAutoStartEnabled = Boolean(autoStart && initialResidentAutoEnabled);
  function syncUrlFromControls() {
    const q = new URLSearchParams();
    for (const [key, el] of Object.entries(urlControls)) q.set(key, urlValueForControl(el));
    if (initialResidentFuseSequenceEnabled) q.set('residentFuseSequence', '1');
    if (initialResidentActiveGridEnabled) q.set('residentActiveGrid', '1');
    if (initialResidentActiveGridSafetyCells != null) q.set('residentActiveGridSafety', String(initialResidentActiveGridSafetyCells));
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
    return createSphPhaseScenario({ wallFaces, boxDimensionsM: boxDimensionsFromControls() });
  }

  function physicalLawGroupsFromControls() {
    return Object.fromEntries(PHYSICAL_LAW_GROUPS.map(([key]) => [key, lawInputs[key]?.checked !== false]));
  }

  function mechanicsModeFromControls() {
    return MECHANICS_MODE_OPTIONS.some(([value]) => value === mechanicsModeSelect.value)
      ? mechanicsModeSelect.value
      : 'mlsmpm';
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
      physicalLawGroups: physicalLawGroupsFromControls()
    };
  }

  const blobScaleOf = () => { const v = Number(blobInput.value); return Number.isFinite(v) && v > 0 ? v : BLOB_SCALE_DEFAULT; };
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
      `safety=${effective?.activeGridSafetyCells ?? 'default'}`
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
      schema: 'peercompute.ulg.sph-phase-rebuild-worker-status.v0',
      ...activeWorkerRebuildTask
    };
    statusEl.textContent = 'submitting initial material state and derived chemistry to ulg-runtime worker...';
    initialWorkerRebuildPromise = Promise.resolve(runtime.runSphPhaseRebuild(taskOptions))
      .then((result) => ({ result, generation, submittedAtMs, reason: 'initial-load' }))
      .catch((error) => ({ error, generation, submittedAtMs, reason: 'initial-load' }));
  } else {
    driver = createDriverFromControls();
  }
  let sceneBoxDimsM = driver?.demo.box.dimensionsM ?? boxDimensionsFromControls();
  let scene = createSphPhaseScene(sceneContainer, {
    boxDimsM: sceneBoxDimsM,
    surfaceRadiusScale: blobScaleOf(),
    preserveDrawingBuffer: preserveDrawingBufferForCapture,
    residentSurfaceDrawOverlay: residentSurfaceDrawOverlayMode
  });
  overlay.__sphScene = scene;
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
  let pendingMlsMpmResidentStepsToken = 0;
  let particleSyncGeneration = 0;
  let residentRenderReadbackSequence = 0;
  let residentRenderReadbackCount = 0;
  let residentRenderReadbackSkippedCount = 0;
  let residentAccumulatedSubvisibleMotionM = 0;
  let residentSubvisibleMotionBurstCount = 0;
  let residentPerf = {
    schema: 'peercompute.ulg.sph-demo-resident-perf.v0',
    residentSubmissions: 0,
    residentStepsPerSchedule: RESIDENT_STEPS_PER_SCHEDULE_FALLBACK,
    renderReadbackCadence: RESIDENT_RENDER_READBACK_CADENCE,
    effectiveRenderReadbackCadence: RESIDENT_RENDER_READBACK_CADENCE,
    playbackVisualRefreshForced: false,
    renderReadbacks: 0,
    skippedRenderReadbacks: 0,
    accumulatedSubvisibleMotionM: 0,
    subvisibleMotionBurstCount: 0,
    staleResidentSubmissions: 0,
    lastResidentMs: null,
    lastRenderReadbackMs: null,
    lastResidentStageTiming: null,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
  overlay.__sphResidentPerf = residentPerf;
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
      if (peerComputeResidentAuthorityHost) publishPeerComputeResidentAuthorityHostStatus('ready');
      return peerComputeResidentAuthorityHostPromise;
    }
    publishPeerComputeResidentAuthorityHostStatus('initializing');
    peerComputeResidentAuthorityHostPromise = ensurePeerComputeResidentAuthorityHost({
      peercomputeModuleUrl,
      computeTaskModulePath: residentComputeTaskModulePath
    })
      .then((host) => {
        peerComputeResidentAuthorityHost = host;
        globalThis.__ulgResidentAuthorityHost = host;
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
      accumulatedSubvisibleMotionM: 0,
      subvisibleMotionBurstCount: 0,
      staleResidentSubmissions: 0,
      effectiveRenderReadbackCadence: RESIDENT_RENDER_READBACK_CADENCE,
      playbackVisualRefreshForced: false,
      lastResidentMs: null,
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
    if (motion.status === 'motion-unknown-no-compact-summary' || motion.status === 'motion-unknown') {
      messages.push('Resident physics is stepping, but compact motion proof is unavailable.');
    } else if (motion.status === 'motion-below-visible-threshold') {
      messages.push('Resident physics is stepping, but displacement is below the visible threshold.');
    }
    return [...new Set(messages)];
  }

  function updateWarningBanner() {
    fpsEl.textContent = `render fps ${fmt(frameCounters.renderFps, 1)} | physics fps ${fmt(frameCounters.physicsFps, 1)} | resident fps ${fmt(frameCounters.residentFps, 1)}`;
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

  function scheduleInitialMlsMpmResidentSteps({ generation = particleSyncGeneration } = {}) {
    const residentExecutionPolicy = residentExecutionPolicyFromUrl();
    if (!initialResidentAutoEnabled) {
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
    fuseNoFullResidentMechanicsSequence = false,
    fuseNoFullResidentMechanicsActiveGrid = false,
    activeGridSafetyCells = null
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
      `fuseSeq=${Boolean(fuseNoFullResidentMechanicsSequence) ? 1 : 0}`,
      `activeGrid=${Boolean(fuseNoFullResidentMechanicsActiveGrid) ? 1 : 0}`,
      `activeGridSafety=${activeGridSafetyCells ?? 'default'}`
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

  function currentResidentStepsPerSchedule() {
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
        return Math.max(1, Math.min(RESIDENT_STEPS_PER_SCHEDULE_MAX, Math.round(count)));
      }
    }
    return RESIDENT_STEPS_PER_SCHEDULE_FALLBACK;
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

  function scheduleMlsMpmResidentSteps({
    stepCount = currentResidentStepsPerSchedule(),
    readbackMode = SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT,
    continueFromResidentState = false,
    continuationBudget = RESIDENT_CONTINUATION_CHAIN_BUDGET,
    generation = particleSyncGeneration,
    force = false
  } = {}) {
    const normalizedStepCount = Math.max(1, Math.round(Number(stepCount) || 1));
    const residentExecutionPolicy = residentExecutionPolicyFromUrl();
    const baseSignature = mlsMpmResidentStepsSignature({
      stepCount: normalizedStepCount,
      readbackMode,
      ...residentExecutionPolicy
    });
    const signature = baseSignature
      ? `${baseSignature}|sync=${generation}|continue=${Boolean(continueFromResidentState)}`
      : null;
    if (!signature || (pendingMlsMpmResidentStepsSignature && !force)) return;
    overlay.__mlsMpmResidentRequestedReadbackMode = readbackMode;
    overlay.__mlsMpmResidentExecutionPolicy = residentExecutionPolicy;
    const scheduleToken = pendingMlsMpmResidentStepsToken + 1;
    pendingMlsMpmResidentStepsToken = scheduleToken;
    pendingMlsMpmResidentStepsSignature = signature;
    overlay.__mlsMpmResidentStepsPending = {
      schema: 'peercompute.ulg.sph-demo-resident-pending.v0',
      status: force ? 'resident-execution-force-rescheduled' : 'resident-execution-pending',
      signature,
      scheduleToken,
      stepCount: normalizedStepCount,
      readbackMode,
      continueFromResidentState: Boolean(continueFromResidentState),
      residentExecutionPolicy,
      generation,
      startedAtMs: performance.now()
    };
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
    const residentComputeManagerForSchedule = resolveResidentComputeManager();
    const residentComputeManagerSource = overlay.__sphResidentComputeManager?.source || null;
    const allowPeerComputeStateManagerForSchedule =
      !residentComputeManagerForSchedule
      || residentComputeManagerSource === 'peercompute-resident-authority-host'
      || residentComputeManagerSource === 'residentAuthorityHost.computeManager'
      || residentComputeManagerSource === 'runtime.residentAuthorityHost.computeManager'
      || residentComputeManagerSource === 'global.__ulgResidentAuthorityHost.computeManager';
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
          computeManager: residentComputeManagerForSchedule,
          residentStateManager: residentStateManagerForSchedule,
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
    remoteRefreshPreludePromise.then(() => scene.refreshMlsMpmResidentSteps?.({
      preferWebGpu: true,
      computeManager: residentComputeManagerForSchedule,
      residentStateManager: residentStateManagerForSchedule,
      residentAuthorityHost: residentAuthorityHostForSchedule,
      computeTaskModulePath: computeTaskModulePathForSchedule,
      computeTaskLaneId: 'ulg:sph-resident:demo-auto',
      computeTaskDomainKey: 'sph-phase-demo',
      stepCount: normalizedStepCount,
      readbackMode,
      continueFromResidentState,
      ...residentExecutionPolicy,
      force: Boolean(force || continueFromResidentState)
    })).then(async (execution) => {
      const residentMs = performance.now() - residentStartMs;
      if (!execution?.schema) {
        overlay.__mlsMpmResidentStepsError = 'resident execution did not produce a step envelope';
        overlay.__mlsMpmResidentStepsPending = null;
        overlay.__mlsMpmResidentStepsSlow = null;
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
      overlay.__mlsMpmResidentStep = scene.getMlsMpmResidentStep?.() || execution?.finalStep || null;
      overlay.__mlsMpmP2gGridProjection = scene.getMlsMpmP2gGridProjection?.() || execution?.finalStep?.p2gGridProjection || null;
      overlay.__mlsMpmGridUpdate = scene.getMlsMpmGridUpdate?.() || execution?.finalStep?.gridUpdate || null;
      overlay.__mlsMpmG2pReconstruction = scene.getMlsMpmG2pReconstruction?.() || execution?.finalStep?.g2pReconstruction || null;
      overlay.__mlsMpmResidentRequestedReadbackMode = execution?.requestedReadbackMode || readbackMode;
      overlay.__mlsMpmResidentSourceMode = execution?.residentSourceMode || 'cpu-packed-state';
      overlay.__mlsMpmResidentContinuedFromResidentState = Boolean(execution?.continuedFromResidentState);
      overlay.__mlsMpmResidentContinuationAvailable = Boolean(execution?.continuationAvailable);
      updateResidentGasPressureSummary(overlay.__mlsMpmResidentStep);
      try {
        overlay.__sphResidentMaterialInterfaceState = await scene.refreshSphResidentMaterialInterfaceState?.({
          preferWebGpu: true,
          residentSteps: execution,
          materialProperties: activeMaterialProperties(),
          gasPressureSummary: currentGasPressureSummary(
            activeViewStateGasPressure || (driver?.demo ? gasPressureSummary(driver.demo) : null)
          ),
          source: 'resident-physics-loop-material-interface-refresh',
          sourceCadence: 'resident-step-completed'
        });
        overlay.__sphResidentPressureInterfaceState = await scene.refreshSphResidentPressureInterfaceState?.({
          preferWebGpu: true,
          gasPressureSummary: currentGasPressureSummary(
            activeViewStateGasPressure || (driver?.demo ? gasPressureSummary(driver.demo) : null)
          ),
          source: 'resident-physics-loop-pressure-interface-refresh',
          sourceCadence: 'resident-step-completed'
        });
        overlay.__sphResidentMaterialInterfaceStateError = null;
        overlay.__sphResidentPressureInterfaceStateError = null;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        overlay.__sphResidentMaterialInterfaceStateError = message;
        overlay.__sphResidentPressureInterfaceStateError = message;
      }
      scheduleContinuation = Boolean(
        execution?.continuationAvailable
        && execution?.readbackMode === 'no-full-readback'
        && execution?.backend === 'webgpu'
        && continuationBudget > 0
        && generation === particleSyncGeneration
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
        const hasResidentRenderState = Boolean(scene.getSphResidentRenderState?.()?.schema);
        const forceMotionProvenRefresh = renderMotion.status === 'motion-proven';
        const forceBatchMotionEstimateRefresh = renderMotion.batchMotionEstimateVisible === true;
        const forceAccumulatedMotionRefresh = accumulatedMotion.accumulatedMotionVisible;
        const cadence = residentRenderReadbackDecision({
          continueFromResidentState,
          forceDue: (playing && !hasResidentRenderState)
            || forceMotionProvenRefresh
            || forceBatchMotionEstimateRefresh
            || forceAccumulatedMotionRefresh,
          forceReason: forceMotionProvenRefresh
            ? 'resident-motion-proven-visual-refresh'
            : forceBatchMotionEstimateRefresh
            ? 'resident-batch-motion-estimate-visual-refresh'
            : forceAccumulatedMotionRefresh
            ? 'resident-accumulated-motion-visual-refresh'
            : 'playback-initial-visual-refresh',
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
        try {
          if (cadence.due) {
            const renderStartMs = performance.now();
            overlay.__sphResidentRenderState = await scene.refreshSphResidentRenderState?.({
              preferWebGpu: true,
              residentSteps: execution,
              materialProperties: activeMaterialProperties(),
              gasPressureSummary: overlay.__sphResidentGasPressureSummary
                || activeViewStateGasPressure
                || (driver?.demo ? gasPressureSummary(driver.demo) : null)
            });
            overlay.__sphResidentSurfaceDraw = scene.getSphResidentSurfaceDraw?.() || null;
            overlay.__sphResidentSurfaceDrawOverlayPolicy = scene.getSphResidentSurfaceDrawOverlayPolicy?.() || null;
            overlay.__sphResidentPressureInterfaceState = scene.getSphResidentPressureInterfaceState?.() || null;
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
      renderStatus();
      updateWarningBanner();
    }).finally(() => {
      window.clearTimeout(slowNoticeTimer);
      window.clearTimeout(watchdogTimer);
      if (
        pendingMlsMpmResidentStepsSignature === signature
        && pendingMlsMpmResidentStepsToken === scheduleToken
      ) {
        pendingMlsMpmResidentStepsSignature = null;
      }
      if (scheduleLatestGeneration && overlay.isConnected) {
        window.requestAnimationFrame(() => {
          if (!overlay.isConnected) return;
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

  // Blob size is live: update the scene's surface scale and re-render without a reset.
  blobInput.addEventListener('input', () => { scene.setSurfaceRadiusScale(blobScaleOf()); syncParticles(); });

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

  function resetSceneForDimensions(boxDimsM, resetReason) {
    const nextDims = Array.isArray(boxDimsM) ? [...boxDimsM] : boxDimensionsFromControls();
    if (dimensionsEqual(sceneBoxDimsM, nextDims)) {
      scene.setSurfaceRadiusScale(blobScaleOf());
      clearSceneDerivedSignatures();
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
      residentSurfaceDrawOverlay: residentSurfaceDrawOverlayMode
    });
    overlay.__sphScene = scene;
    overlay.__sphOpticalGpuLookup = scene.getOpticalGpuLookup?.() || null;
    overlay.__sphThermalMaterialTable = scene.getSphThermalMaterialTable?.() || null;
    overlay.__sphReactionTable = scene.getSphReactionTable?.() || null;
    overlay.__sphResidentRenderState = scene.getSphResidentRenderState?.() || null;
    overlay.__sphResidentPressureInterfaceState = scene.getSphResidentPressureInterfaceState?.() || null;
    overlay.__sphResidentSurfaceDraw = scene.getSphResidentSurfaceDraw?.() || null;
    overlay.__sphResidentSurfaceDrawOverlayPolicy = scene.getSphResidentSurfaceDrawOverlayPolicy?.() || null;
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
      schema: 'peercompute.ulg.sph-phase-rebuild-worker-status.v0',
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
      schema: 'peercompute.ulg.sph-phase-rebuild-worker-status.v0',
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
        schema: 'peercompute.ulg.sph-phase-rebuild-worker-status.v0',
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
    const canUseWorkerRebuild = typeof runtime?.runSphPhaseRebuild === 'function';
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
    if (key === 'blob') {
      el.addEventListener('change', syncUrlFromControls);
    } else {
      el.addEventListener('change', scheduleDemoRebuild);
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
      materials: viewState.materials,
      emissiveByMaterial: viewState.emissiveByMaterial,
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
    for (let i = 0; i < count; i += 1) driver.step();
    recordPhysicsFrame(count);
    syncParticles();
    renderStatus();
    return {
      step: driver.demo.state.step ?? 0,
      time: driver.demo.state.time ?? 0,
      gasPressureSummary: gasPressureSummary(driver.demo),
      particlesByMaterial: driver.demo.state.particles.reduce((acc, particle) => {
        acc[particle.material] = (acc[particle.material] || 0) + 1;
        return acc;
      }, {})
    };
  }
  overlay.__sphStep = stepDemoForVisualTest;

  function lawGroupStatusText() {
    return Object.entries(physicalLawGroupsFromControls())
      .map(([key, enabled]) => `${key}=${enabled ? 'on' : 'off'}`)
      .join(' ');
  }

  function renderStatus() {
    if (!driver && activeViewState) {
      const pre = activeViewStatePreflight || {};
      const totals = activeViewStateTotals || activeViewState.totals || {};
      const phase = activeViewStatePhaseSummary || activeViewState.phaseMassSummary || { byMaterialPhase: {} };
      const gasPressure = currentGasPressureSummary(activeViewStateGasPressure || activeViewState.gasPressureSummary || null);
      const materialPhases = formatMaterialPhaseMasses(phase.byMaterialPhase || {});
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
        `particles        : ${activeViewState.dropMaterial} ${activeViewState.counts?.drop ?? 0}  ${activeViewState.baseMaterial} ${activeViewState.counts?.base ?? 0}  total ${activeViewState.counts?.total ?? 0}`,
        `reaction         : ${activeViewState.reactionNote || '—'}`,
        `material phases  : ${materialPhases || '—'}`,
        `gas pressure     : ${gasPressureStatusText(gasPressure)}`,
        `solid fractions  : ${solidFractions || '—'}`,
        `total energy     : ${fmt(totals.totalEnergyJ)} J`,
        `momentum |p|     : ${fmt(totals.momentumMagnitudeKgMPerS)} kg·m/s`,
        `view state       : ${activeViewStateSource}`,
        `law groups       : ${lawGroupStatusText()}`,
        `resident auto    : ${residentAutoSchedule?.status || (initialResidentAutoEnabled ? 'enabled' : 'disabled')}`,
        `resident policy  : ${residentExecutionPolicyStatus}`,
        `resident backend : ${residentBackend}`,
        `mls grid         : dims=${gridDims ? gridDims.join('x') : 'pending'} nodes=${gridNodeCount || 'pending'} dx=${Number.isFinite(gridSpacingM) ? fmt(gridSpacingM, 3) : 'pending'}m`,
        `resident readback: requested=${residentRequestedReadback} actual=${residentActualReadback}`,
        `resident motion  : status=${residentMotion.status} max-dx=${Number.isFinite(residentMotion.maxDisplacementM) ? fmt(residentMotion.maxDisplacementM, 6) : 'pending'}m max-v=${Number.isFinite(residentMotion.maxSpeedMPerS) ? fmt(residentMotion.maxSpeedMPerS, 6) : 'pending'}m/s threshold=${fmt(residentMotion.visibleThresholdM, 6)}m batch-est=${Number.isFinite(residentMotion.estimatedBatchDisplacementUpperBoundM) ? fmt(residentMotion.estimatedBatchDisplacementUpperBoundM, 6) : 'pending'}m accumulated=${fmt(renderCadence?.accumulatedSubvisibleMotionM ?? residentPerfSummary?.accumulatedSubvisibleMotionM ?? 0, 6)}m bursts=${renderCadence?.subvisibleMotionBurstCount ?? residentPerfSummary?.subvisibleMotionBurstCount ?? 0} pressure-impulse=${Number.isFinite(residentMotion.pressureImpulseNSeconds) ? fmt(residentMotion.pressureImpulseNSeconds, 6) : 'pending'}N*s`,
        `resident reaction: status=${residentStep?.stageStatus?.reaction || (reactionTable?.reactionCount > 0 ? 'pending' : 'no-derived-reactions')} backend=${residentStep?.stageBackends?.reaction || 'pending'} reactions=${reactionTable?.reactionCount ?? 0}`,
        `resident product : status=${residentProductMass?.status || 'pending'} rows=${residentProductMass?.productEventRowCount ?? 0} unplaced=${Number.isFinite(residentProductMass?.unplacedProductMassKg) ? fmt(residentProductMass.unplacedProductMassKg) : 'pending'}kg eos=${residentProductMass?.eosCouplingStatus || 'pending'}`,
        `material iface  : owner=${residentMaterialInterfaceState?.authority || 'pending'} source=${residentMaterialInterfaceState?.source || 'pending'} status=${residentMaterialInterfaceState?.status || 'pending'} ready=${residentMaterialInterfaceState?.readySurfaceCount ?? 0}/${residentMaterialInterfaceState?.surfaceCount ?? 0} source-field=${residentMaterialInterfaceState?.interfaceSourceFieldSchema || residentMaterialInterfaceState?.sourceFieldSchema || 'pending'} candidate-readback=${Boolean(residentMaterialInterfaceState?.candidateReadback)}`,
        `render source    : ${residentRenderState?.source || 'cpu-particles'} status=${residentRenderState?.status || 'pending'} backend=${residentRenderState?.backend || 'pending'} rows=${residentRenderState?.particleCount ?? 0} field-cells=${residentRenderState?.renderFieldTotalCells ?? 0} field-readback=${Boolean(residentRenderState?.renderFieldReadback)}`,
        `render error     : ${residentRenderError || 'none'}`,
        `surface draw     : status=${residentSurfaceDraw?.status || residentRenderState?.surfaceDrawStatus || 'pending'} policy=${residentSurfaceDraw?.overlayPolicyStatus || residentRenderState?.surfaceDrawOverlayPolicyStatus || residentSurfaceOverlayPolicy?.status || 'pending'} mode=${residentSurfaceDraw?.overlayPolicyMode || residentRenderState?.surfaceDrawOverlayPolicyMode || residentSurfaceOverlayPolicy?.mode || 'pending'} active=${residentSurfaceDraw?.activeSurfaceCount ?? residentRenderState?.surfaceDrawActiveSurfaceCount ?? 0} vertices=${residentSurfaceDraw?.vertexCount ?? residentRenderState?.surfaceDrawVertexCount ?? 0} draw-retained=${Boolean(residentSurfaceDraw?.drawRowsBufferRetained ?? residentRenderState?.surfaceDrawRowsBufferRetained)} indirect-retained=${Boolean(residentSurfaceDraw?.drawIndirectRowsBufferRetained ?? residentRenderState?.surfaceDrawIndirectRowsBufferRetained)} compact-retained=${Boolean(residentSurfaceDraw?.compactedVertexRowsBufferRetained ?? residentRenderState?.surfaceDrawCompactedVertexRowsBufferRetained)} readback=${Boolean(residentSurfaceDraw?.surfaceDrawReadback ?? residentRenderState?.surfaceDrawReadback)} bridge=${residentSurfaceDraw?.visibleRendererBridge || residentRenderState?.surfaceDrawVisibleRendererBridge || 'pending'} depth=${residentSurfaceDraw?.renderBridgeDepthPolicy || residentRenderState?.surfaceDrawRenderBridgeDepthPolicy || 'pending'} depth-ready=${Boolean(residentSurfaceDraw?.renderBridgeDepthAttachmentReady ?? residentRenderState?.surfaceDrawRenderBridgeDepthAttachmentReady)} transparent=${residentSurfaceDraw?.renderBridgeTransparencyCompositeMode || residentRenderState?.surfaceDrawRenderBridgeTransparencyCompositeMode || 'pending'} optics=${residentSurfaceDraw?.renderBridgeOpticalRenderSource || residentRenderState?.surfaceDrawRenderBridgeOpticalRenderSource || 'pending'} records=${residentSurfaceDraw?.renderBridgeOpticalRecordCount ?? residentRenderState?.surfaceDrawRenderBridgeOpticalRecordCount ?? 0} spectra=${residentSurfaceDraw?.renderBridgeOpticalSpectralSampleCount ?? residentRenderState?.surfaceDrawRenderBridgeOpticalSpectralSampleCount ?? 0} swap=${residentSurfaceDraw?.renderBridgeTemporalSwapPolicy || residentRenderState?.surfaceDrawRenderBridgeTemporalSwapPolicy || 'pending'} retained=${Boolean(residentSurfaceDraw?.renderBridgeRetainedPreviousOverlay ?? residentRenderState?.surfaceDrawRenderBridgeRetainedPreviousOverlay)}`,
        `render pressure  : source=${renderPressureSource} optical-state=${Boolean(renderPressureOpticalState)}`,
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
      `particles        : ${driver.demo.dropMaterial} ${driver.demo.counts.drop}  ${driver.demo.baseMaterial} ${driver.demo.counts.base}  total ${driver.demo.counts.total}`,
      `reaction         : ${driver.demo.reactionNote || '—'}`,
      `material phases  : ${materialPhases || '—'}`,
      `molecules/macro  : ${moleculesPerMacroStatusText(pre, driver.demo.dropMaterial, driver.demo.baseMaterial)}`,
      `gas pressure     : ${gasPressureStatusText(gasPressure)}`,
      `solid fractions  : ${solidFractions || '—'}`,
      `total energy     : ${fmt(totals.totalEnergyJ)} J`,
      `momentum |p|     : ${fmt(totals.momentumMagnitudeKgMPerS)} kg·m/s`,
      `law groups       : ${lawGroupStatusText()}`,
      `resident auto    : ${residentAutoSchedule?.status || (initialResidentAutoEnabled ? 'enabled' : 'disabled')}`,
      `resident policy  : ${residentExecutionPolicyStatus}`,
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
      `render error     : ${residentRenderError || 'none'}`,
      `surface draw     : status=${residentSurfaceDraw?.status || residentRenderState?.surfaceDrawStatus || 'pending'} policy=${residentSurfaceDraw?.overlayPolicyStatus || residentRenderState?.surfaceDrawOverlayPolicyStatus || residentSurfaceOverlayPolicy?.status || 'pending'} mode=${residentSurfaceDraw?.overlayPolicyMode || residentRenderState?.surfaceDrawOverlayPolicyMode || residentSurfaceOverlayPolicy?.mode || 'pending'} active=${residentSurfaceDraw?.activeSurfaceCount ?? residentRenderState?.surfaceDrawActiveSurfaceCount ?? 0} vertices=${residentSurfaceDraw?.vertexCount ?? residentRenderState?.surfaceDrawVertexCount ?? 0} draw-retained=${Boolean(residentSurfaceDraw?.drawRowsBufferRetained ?? residentRenderState?.surfaceDrawRowsBufferRetained)} indirect-retained=${Boolean(residentSurfaceDraw?.drawIndirectRowsBufferRetained ?? residentRenderState?.surfaceDrawIndirectRowsBufferRetained)} compact-retained=${Boolean(residentSurfaceDraw?.compactedVertexRowsBufferRetained ?? residentRenderState?.surfaceDrawCompactedVertexRowsBufferRetained)} readback=${Boolean(residentSurfaceDraw?.surfaceDrawReadback ?? residentRenderState?.surfaceDrawReadback)} bridge=${residentSurfaceDraw?.visibleRendererBridge || residentRenderState?.surfaceDrawVisibleRendererBridge || 'pending'} depth=${residentSurfaceDraw?.renderBridgeDepthPolicy || residentRenderState?.surfaceDrawRenderBridgeDepthPolicy || 'pending'} depth-ready=${Boolean(residentSurfaceDraw?.renderBridgeDepthAttachmentReady ?? residentRenderState?.surfaceDrawRenderBridgeDepthAttachmentReady)} transparent=${residentSurfaceDraw?.renderBridgeTransparencyCompositeMode || residentRenderState?.surfaceDrawRenderBridgeTransparencyCompositeMode || 'pending'} optics=${residentSurfaceDraw?.renderBridgeOpticalRenderSource || residentRenderState?.surfaceDrawRenderBridgeOpticalRenderSource || 'pending'} records=${residentSurfaceDraw?.renderBridgeOpticalRecordCount ?? residentRenderState?.surfaceDrawRenderBridgeOpticalRecordCount ?? 0} spectra=${residentSurfaceDraw?.renderBridgeOpticalSpectralSampleCount ?? residentRenderState?.surfaceDrawRenderBridgeOpticalSpectralSampleCount ?? 0} swap=${residentSurfaceDraw?.renderBridgeTemporalSwapPolicy || residentRenderState?.surfaceDrawRenderBridgeTemporalSwapPolicy || 'pending'} retained=${Boolean(residentSurfaceDraw?.renderBridgeRetainedPreviousOverlay ?? residentRenderState?.surfaceDrawRenderBridgeRetainedPreviousOverlay)}`,
      `render pressure  : source=${renderPressureSource} optical-state=${Boolean(renderPressureOpticalState)}`,
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
    scene.dispose();
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
          schema: 'peercompute.ulg.sph-phase-rebuild-worker-status.v0',
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
