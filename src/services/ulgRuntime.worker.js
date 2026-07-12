import { createSimulationArtifact } from '../../ulg-gpu-abi/src/index.js';
import { ULG_TASK_KINDS } from '../../ulg-gpu-abi/src/serviceContract.js';
import { createDefaultCarrierState } from '../runtime/carrierRuntime.js';
import { createClosureHandle } from '../runtime/closureHandle.js';
import { createSphPhaseDemo } from '../runtime/sphPhaseDemo.js';
import { createSphPhaseViewState } from '../runtime/sphPhaseViewState.js';
import {
  SPH_STATIC_TABLE_CACHE_BUNDLE_SCHEMA,
  SPH_STATIC_TABLE_CACHE_UPDATE_SCHEMA,
  compactSphStaticTableBundleForTransfer,
  createSphStaticTableCacheUpdate,
  rehydrateSphStaticTableBundle,
  summarizeSphStaticTableCacheSnapshot
} from '../runtime/sph/sphColdStartCache.js';
import {
  residentSurfaceDescriptorsFromViewState,
  sphStaticTableInputsFromViewState,
} from '../runtime/sph/sphStaticTableInputs.js';
import {
  applySphLocalCacheLookupToOptions,
  compactSphLocalCacheLookup,
  compactSphLocalCachePersistence,
  createSphLocalCacheLookup,
  createSphLocalCachePersistence
} from '../runtime/sph/sphLocalClosureCache.js';
import { runCarrierRuntimeWithOptionalWebGpu } from '../runtime/webgpuCarrierKernel.js';

let workerId = null;
let manifest = null;
let heartbeat = null;
const activeTasks = new Map();

function nowMs() {
  return typeof globalThis.performance?.now === 'function'
    ? globalThis.performance.now()
    : Date.now();
}

const REQUIRED_STATIC_TABLE_FAMILIES = Object.freeze([
  'thermalMaterialTable',
  'thermalClosureGraphSet',
  'thermalPhaseResponseTable',
  'opticalGpuTable',
  'reactionTable'
]);

function sortedStrings(values = []) {
  return [...values].map(String).sort();
}

function sameStringSet(a = [], b = []) {
  const left = sortedStrings(a);
  const right = sortedStrings(b);
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function opticalCoverageKey(record = {}) {
  return [
    record.material,
    record.phase ?? 'phase-unspecified',
    record.opticalStateKey || 'default'
  ].join('|');
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function nearlyEqual(a, b, tolerance = 1e-9) {
  const left = finiteNumber(a, 0);
  const right = finiteNumber(b, 0);
  return Math.abs(left - right) <= Math.max(tolerance, Math.max(Math.abs(left), Math.abs(right)) * 1e-6);
}

function expectedReactionContactRadiusM(reaction = {}, viewState = {}) {
  return finiteNumber(
    reaction?.contactRadiusM
      ?? viewState.reactionContactRadiusM
      ?? viewState.sphGpuParticleState?.smoothingLengthM,
    0
  );
}

function reactionTableContactRadiiCoverViewState(reactionTable = {}, viewState = {}) {
  const reactions = viewState.reactions || [];
  const metadata = reactionTable.metadata || [];
  if ((reactionTable.reactionCount ?? 0) !== reactions.length) return false;
  for (let index = 0; index < reactions.length; index += 1) {
    const expected = expectedReactionContactRadiusM(reactions[index], viewState);
    const restored = finiteNumber(metadata[index]?.contactRadiusM ?? reactionTable.reactionHeaders?.[index * 16 + 9], NaN);
    if (!Number.isFinite(restored) || !nearlyEqual(expected, restored)) return false;
  }
  return true;
}

export function staticTableBundleCoversViewState(bundle, viewState = {}) {
  if (!bundle?.schema || bundle.hitCount <= 0) return false;
  if (!REQUIRED_STATIC_TABLE_FAMILIES.every((family) => bundle.restoredFamilies?.includes(family))) {
    return false;
  }
  const expectedMaterials = Object.keys(viewState.materialProperties || {});
  const thermalMaterials = (bundle.thermalMaterialTable?.metadata || []).map((entry) => entry.material).filter(Boolean);
  if (!sameStringSet(expectedMaterials, thermalMaterials)) return false;

  const expectedProducts = (viewState.reactions || []).map((reaction) => reaction.product).filter(Boolean);
  const reactionProducts = (bundle.reactionTable?.metadata || []).map((entry) => entry.product).filter(Boolean);
  if (
    (bundle.reactionTable?.reactionCount ?? 0) !== (viewState.reactions || []).length
    || !sameStringSet(expectedProducts, reactionProducts)
    || !reactionTableContactRadiiCoverViewState(bundle.reactionTable, viewState)
  ) {
    return false;
  }

  const availableOptics = new Set((bundle.opticalGpuTable?.recordMetadata || []).map(opticalCoverageKey));
  return residentSurfaceDescriptorsFromViewState(viewState, {
    reactionTable: bundle.reactionTable
  }).every((descriptor) => availableOptics.has(opticalCoverageKey({
    material: descriptor.material,
    phase: descriptor.phase,
    opticalStateKey: descriptor.opticalStateKey
  })));
}

function reusedStaticTableCacheUpdate({ snapshot, bundle, generatorFingerprint }) {
  return {
    schema: SPH_STATIC_TABLE_CACHE_UPDATE_SCHEMA,
    status: 'reused',
    cacheSnapshot: snapshot,
    counts: {
      tables: bundle?.tableCount ?? 0,
      gpuWarmup: bundle?.gpuWarmupCount ?? 0
    },
    tableWriteCount: 0,
    tableUnchangedCount: bundle?.hitCount ?? 0,
    gpuWarmupWriteCount: 0,
    gpuWarmupUnchangedCount: bundle?.gpuWarmupCount ?? 0,
    writtenFamilies: [],
    generatorFingerprint,
    previousStatus: bundle?.storageStatus || 'loaded',
    tableSchema: 'peercompute.ulg.sph-static-table-cache.v0',
    gpuWarmupSchema: 'peercompute.ulg.sph-gpu-warmup-cache.v0',
    reusedBundle: true,
    cacheSnapshotBytes: typeof snapshot === 'string' ? snapshot.length : 0,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function compactSphPhaseViewStateForArtifact(viewState = {}) {
  return {
    schema: 'peercompute.ulg.sph-phase-view-state-summary.v0',
    status: viewState.status || 'sph-phase-view-state-built',
    sourcePayload: 'direct-task-result',
    particleCount: viewState.positionsM?.length ? viewState.positionsM.length / 3 : 0,
    colorRows: viewState.colorsRgb?.length ? viewState.colorsRgb.length / 3 : 0,
    materialKeys: Object.keys(viewState.materialProperties || {}),
    surfaceMaterialRows: viewState.materials?.length || 0,
    reactionCount: viewState.reactions?.length || 0,
    reactionNote: viewState.reactionNote || null,
    counts: viewState.counts || null,
    box: viewState.box || null,
    dropMaterial: viewState.dropMaterial || null,
    baseMaterial: viewState.baseMaterial || null,
    totals: viewState.totals || null,
    phaseMassSummary: viewState.phaseMassSummary || null,
    gasPressureSummary: viewState.gasPressureSummary || null,
    gasPressureFeedback: viewState.gasPressureFeedback || viewState.gasPressureSummary?.pressureFeedback || null,
    gpuMechanics: viewState.gpuMechanics || null,
    bufferByteLengths: {
      positionsM: viewState.positionsM?.byteLength || 0,
      colorsRgb: viewState.colorsRgb?.byteLength || 0,
      sphGpuParticleState: viewState.sphGpuParticleState?.state?.byteLength || 0,
      mlsMpmGpuParticleState: viewState.mlsMpmGpuParticleState?.state?.byteLength || 0
    },
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function collectTransferableBuffers(value, out = [], seen = new Set()) {
  if (!value || typeof value !== 'object') return out;
  if (value instanceof ArrayBuffer) {
    if (value.byteLength > 0 && !seen.has(value)) {
      seen.add(value);
      out.push(value);
    }
    return out;
  }
  if (ArrayBuffer.isView(value)) {
    return collectTransferableBuffers(value.buffer, out, seen);
  }
  for (const item of Object.values(value)) {
    collectTransferableBuffers(item, out, seen);
  }
  return out;
}

function postTaskResult(rootTaskId, result) {
  self.postMessage({
    type: 'task-result',
    rootTaskId,
    result
  }, collectTransferableBuffers(result));
}

self.addEventListener('message', (event) => {
  const message = event.data;
  if (message.type === 'init') {
    initService(message);
  }
  if (message.type === 'submit-task') {
    runTask(message.task, message.gpuLease).catch((error) => failTask(message.task, error));
  }
  if (message.type === 'cancel-task') {
    cancelTask(message.rootTaskId);
  }
  if (message.type === 'shutdown') {
    clearInterval(heartbeat);
    for (const task of activeTasks.values()) {
      cancelTask(task.rootTaskId);
    }
    self.close();
  }
});

function initService(message) {
  workerId = message.workerId;
  manifest = message.manifest;
  heartbeat = setInterval(sendHeartbeat, 500);
  self.postMessage({
    type: 'ready',
    workerId,
    serviceId: manifest.serviceId,
    assetProbe: { status: 'skipped', reason: 'cpu-reference-runtime-no-external-assets' }
  });
}

async function runTask(task, gpuLease) {
  const record = {
    rootTaskId: task.rootTaskId,
    status: 'running',
    progress: 0,
    cancelled: false
  };
  activeTasks.set(task.rootTaskId, record);
  postStatus(record);
  if (task.taskKind === ULG_TASK_KINDS.sphPhaseRebuild) {
    await runSphPhaseRebuildTask(task, record);
    return;
  }
  if (task.taskKind === ULG_TASK_KINDS.sphStaticTableCache) {
    await runSphStaticTableCacheTask(task, record);
    return;
  }
  const input = task.input || {};
  const closureArtifact = input.closureArtifact;
  if (!closureArtifact) {
    throw new Error('simulation.step task missing input.closureArtifact');
  }
  const closureHandle = createClosureHandle(closureArtifact);
  const toleranceProfile = input.toleranceProfile || {
    name: 'toy-carrier-reference',
    energyAbs: 1e-3,
    momentumAbs: 1e-9
  };
  const steps = input.steps ?? 64;
  const initialState = input.initialState || createDefaultCarrierState();
  const run = await runCarrierRuntimeWithOptionalWebGpu({
    closureArtifact,
    closureHandle,
    initialState,
    steps,
    dt: input.dt ?? 0.002,
    toleranceProfile,
    preferWebGpu: gpuLease?.status === 'granted' || input.backendPreference?.includes?.('webgpu') === true,
    navigatorRef: self.navigator,
    onDeviceLost(info) {
      self.postMessage({
        type: 'gpu-device-lost',
        rootTaskId: task.rootTaskId,
        leaseId: gpuLease?.leaseId || null,
        reason: info?.reason || info?.message || String(info || 'device lost')
      });
    }
  });
  if (record.cancelled) {
    return;
  }
  record.progress = 1;
  postStatus(record);
  const refreshRequest = run.closureRefreshRequest || null;
  const domainExit = run.domainExit || null;
  const refreshRecommended = refreshRequest?.refreshRecommended === true
    || refreshRequest?.status === 'refresh-recommended';
  const artifact = createSimulationArtifact({
    artifactId: `${task.rootTaskId}.simulation`,
    taskKind: task.taskKind,
    closureRef: input.closureRef,
    representation: 'carrier-toy',
    outputs: {
      deltas: run.deltas,
      invariants: run.invariants,
      invariantSeries: run.invariantSeries,
      finalState: run.finalState,
      completedSteps: run.completedSteps ?? run.deltas.length,
      requestedSteps: run.requestedSteps ?? run.steps,
      closureRefreshRequest: refreshRequest,
      domainExit
    },
    execution: {
      backend: run.backend,
      gpuLeaseStatus: gpuLease?.status || null,
      webgpuStatus: run.webgpuStatus || null,
      webgpuParity: run.webgpuParity || null,
      dt: run.dt,
      steps: run.steps,
      integrator: run.integrator
    },
    validity: {
      status: refreshRecommended ? 'closure-domain-exited' : 'toy-reference-valid',
      closureValidity: input.closureValidity || null,
      closureId: closureArtifact.closureId,
      closureKind: closureArtifact.closureKind,
      closureRefreshRecommended: refreshRecommended,
      closureRefreshRegistryAction: refreshRequest?.registryAction || 'none'
    },
    uncertainty: {
      modelScope: 'toy-two-particle-carrier-reference',
      calibratedPhysics: false
    },
    validation: {
      status: refreshRecommended ? 'warn' : run.invariants.status,
      validationMode: run.backend === 'webgpu'
        ? 'cpu-webgpu-parity-invariant-drift'
        : 'cpu-reference-invariant-drift',
      scientificValidation: false,
      fullPhysicsValidation: false,
      blockers: refreshRecommended
        ? [
            'toy-carrier-reference-not-scientific-physics',
            'closure-domain-exited-refresh-recommended'
          ]
        : ['toy-carrier-reference-not-scientific-physics']
    },
    provenance: {
      ...task.provenance,
      sourceService: 'ulg-runtime',
      parents: [input.closureRef],
      notes: [
        ...(task.provenance?.notes || []),
        'Consumed a cached table-interpolation closure with CPU reference carrier runtime.',
        run.backend === 'webgpu'
          ? 'Executed the toy carrier kernel through WebGPU and accepted CPU/WebGPU parity.'
          : 'WebGPU carrier execution was unavailable or not requested; CPU reference artifact retained.',
        ...(refreshRecommended
          ? [
              `Carrier left the closure sampled domain at step ${domainExit?.atStep ?? 'unknown'}; closure refresh recommended.`,
              'Closure/provenance evidence only; no material/EOS/SPH/phase validation claim.'
            ]
          : []),
        'Toy oscillator only; no scientific or full-physics validation claim.'
      ]
    }
  });
  postTaskResult(task.rootTaskId, { artifact });
  activeTasks.delete(task.rootTaskId);
}

async function runSphPhaseRebuildTask(task, record) {
  const input = task.input || {};
  const taskStartMs = nowMs();
  const timing = {
    schema: 'peercompute.ulg.sph-phase-worker-rebuild-timing.v0',
    stageMs: {},
    totalMs: 0
  };
  record.progress = 0.2;
  postStatus(record);
  const cacheLookupStartMs = nowMs();
  const cacheLookup = input.cacheLookup
    ? createSphLocalCacheLookup(input.cacheLookup)
    : null;
  const demoOptions = cacheLookup
    ? applySphLocalCacheLookupToOptions(input.options || input, cacheLookup)
    : input.options || input;
  timing.stageMs.cacheLookup = Math.max(0, nowMs() - cacheLookupStartMs);
  const createDemoStartMs = nowMs();
  const driver = createSphPhaseDemo(demoOptions);
  timing.stageMs.createSphPhaseDemo = Math.max(0, nowMs() - createDemoStartMs);
  if (record.cancelled) return;
  record.progress = 0.65;
  postStatus(record);
  const viewStateStartMs = nowMs();
  const viewState = createSphPhaseViewState(driver);
  timing.stageMs.createSphPhaseViewState = Math.max(0, nowMs() - viewStateStartMs);
  const preflightStartMs = nowMs();
  const preflight = driver.preflight();
  timing.stageMs.preflight = Math.max(0, nowMs() - preflightStartMs);
  timing.materialCount = Object.keys(viewState.materialProperties || {}).length;
  timing.reactionCount = viewState.reactionDiscovery?.reactions?.length ?? driver.demo.reactions?.length ?? 0;
  timing.productReuseCount = Object.keys(viewState.reactionDiscovery?.productReuse || {}).length;
  timing.cacheStatus = viewState.reactionDiscovery?.cache?.cacheStatus || null;
  const cachePersistenceStartMs = nowMs();
  const cachePersistence = input.cachePersistence
    ? createSphLocalCachePersistence({
      ...input.cachePersistence,
      materialProperties: viewState.materialProperties || {},
      reactionDiscovery: viewState.reactionDiscovery || driver.demo.reactionDiscovery || null
    })
    : null;
  timing.stageMs.cachePersistence = Math.max(0, nowMs() - cachePersistenceStartMs);
  const staticTableStartMs = nowMs();
  let staticTableCacheUpdate = null;
  let staticTableCacheBundle = null;
  let staticTableCacheSummary = null;
  if (input.staticTableCache) {
    const generatorFingerprint = input.staticTableCache.generatorFingerprint || null;
    const previousSnapshot = input.staticTableCache.cacheSnapshot || null;
    const cachedBundle = rehydrateSphStaticTableBundle(previousSnapshot, { generatorFingerprint });
    if (staticTableBundleCoversViewState(cachedBundle, viewState)) {
      staticTableCacheBundle = compactSphStaticTableBundleForTransfer(cachedBundle);
      staticTableCacheUpdate = reusedStaticTableCacheUpdate({
        snapshot: previousSnapshot,
        bundle: cachedBundle,
        generatorFingerprint
      });
      staticTableCacheSummary = {
        schema: 'peercompute.ulg.sph-static-table-cache-reuse-summary.v0',
        status: 'static-table-cache-reused',
        storageStatus: cachedBundle.storageStatus || null,
        tableCount: cachedBundle.tableCount || 0,
        gpuWarmupCount: cachedBundle.gpuWarmupCount || 0,
        hitCount: cachedBundle.hitCount || 0,
        staleCount: cachedBundle.staleCount || 0,
        restoredFamilies: cachedBundle.restoredFamilies || [],
        generatorFingerprint
      };
    } else {
      staticTableCacheUpdate = createSphStaticTableCacheUpdate({
        previousSnapshot,
        tableInputs: sphStaticTableInputsFromViewState(viewState),
        generatorFingerprint
      });
      staticTableCacheBundle = compactSphStaticTableBundleForTransfer(rehydrateSphStaticTableBundle(staticTableCacheUpdate.cacheSnapshot, {
        generatorFingerprint
      }));
      staticTableCacheSummary = summarizeSphStaticTableCacheSnapshot(staticTableCacheUpdate.cacheSnapshot, {
        generatorFingerprint
      });
    }
  }
  timing.stageMs.staticTableCache = Math.max(0, nowMs() - staticTableStartMs);
  timing.totalMs = Math.max(0, nowMs() - taskStartMs);
  if (record.cancelled) return;
  record.progress = 1;
  postStatus(record);
  const artifact = createSimulationArtifact({
    artifactId: `${task.rootTaskId}.sph-phase-rebuild`,
    taskKind: task.taskKind,
    closureRef: input.closureRef || { uri: 'artifact://sph-phase-derived-runtime-state' },
    representation: 'sph-phase-rebuild-view-state',
    outputs: {
      viewStateSummary: compactSphPhaseViewStateForArtifact(viewState),
      preflight,
      totals: viewState.totals,
      phaseMassSummary: viewState.phaseMassSummary,
      gasPressureSummary: viewState.gasPressureSummary,
      gasPressureFeedback: viewState.gasPressureFeedback || viewState.gasPressureSummary?.pressureFeedback || null,
      counts: viewState.counts,
      reactionNote: viewState.reactionNote,
      cacheLookup: compactSphLocalCacheLookup(cacheLookup),
      cachePersistence: compactSphLocalCachePersistence(cachePersistence),
      staticTableCache: staticTableCacheUpdate
        ? {
          schema: SPH_STATIC_TABLE_CACHE_UPDATE_SCHEMA,
          status: staticTableCacheUpdate.status,
          counts: staticTableCacheUpdate.counts,
          tableWriteCount: staticTableCacheUpdate.tableWriteCount,
          tableUnchangedCount: staticTableCacheUpdate.tableUnchangedCount,
          gpuWarmupWriteCount: staticTableCacheUpdate.gpuWarmupWriteCount,
          gpuWarmupUnchangedCount: staticTableCacheUpdate.gpuWarmupUnchangedCount,
          bundleSummary: {
            schema: SPH_STATIC_TABLE_CACHE_BUNDLE_SCHEMA,
            status: staticTableCacheBundle?.status || 'static-table-cache-bundle-miss',
            hitCount: staticTableCacheBundle?.hitCount || 0,
            staleCount: staticTableCacheBundle?.staleCount || 0,
            tableCount: staticTableCacheBundle?.tableCount || 0,
            gpuWarmupCount: staticTableCacheBundle?.gpuWarmupCount || 0,
            restoredFamilies: staticTableCacheBundle?.restoredFamilies || []
          },
          summary: staticTableCacheSummary
        }
        : null,
      materialKeys: Object.keys(viewState.materialProperties || {}),
      timing
    },
    execution: {
      backend: 'cpu-worker',
      status: 'sph-phase-rebuild-complete',
      workerId,
      gpuLeaseStatus: null,
      timing
    },
    validity: {
      status: 'derived-view-state-built',
      cacheable: true
    },
    uncertainty: {
      modelScope: 'sph-phase-demo-view-state',
      calibratedPhysics: false
    },
    validation: {
      status: 'warn',
      validationMode: 'cpu-worker-derived-view-state',
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false,
      blockers: ['sph-phase-worker-view-state-not-full-physics-validation']
    },
    provenance: {
      ...task.provenance,
      sourceService: 'ulg-runtime',
      notes: [
        ...(task.provenance?.notes || []),
        'Built SPH phase demo material/reaction/particle view state in the supervised ULG runtime worker.',
        'Intended as the PeerCompute-compatible CPU/WASM offload seam for UI-nonblocking rebuilds.',
        'Evidence-only; no scientific/SPH/phase validation claim.'
      ]
    }
  });
  postTaskResult(task.rootTaskId, {
    artifact,
    viewState,
    preflight,
    totals: viewState.totals,
    phaseMassSummary: viewState.phaseMassSummary,
    gasPressureSummary: viewState.gasPressureSummary,
    gasPressureFeedback: viewState.gasPressureFeedback || viewState.gasPressureSummary?.pressureFeedback || null,
    cacheLookup,
    cachePersistence,
    staticTableCacheUpdate,
    staticTableCacheSnapshot: staticTableCacheUpdate?.cacheSnapshot || null,
    staticTableCacheBundle,
    staticTableCacheSummary
  });
  activeTasks.delete(task.rootTaskId);
}

async function runSphStaticTableCacheTask(task, record) {
  const input = task.input || {};
  const taskStartMs = nowMs();
  if (input.mode === 'rehydrate') {
    await runSphStaticTableCacheRehydrateTask(task, record, taskStartMs);
    return;
  }
  record.progress = 0.25;
  postStatus(record);
  const update = createSphStaticTableCacheUpdate({
    previousSnapshot: input.cacheSnapshot || null,
    tableInputs: input.tableInputs || {},
    generatorFingerprint: input.generatorFingerprint || null
  });
  const { cacheSnapshot, ...compactUpdate } = update;
  const summary = summarizeSphStaticTableCacheSnapshot(update.cacheSnapshot, {
    generatorFingerprint: input.generatorFingerprint || null
  });
  const bundle = compactSphStaticTableBundleForTransfer(rehydrateSphStaticTableBundle(update.cacheSnapshot, {
    generatorFingerprint: input.generatorFingerprint || null
  }));
  const bundleSummary = {
    schema: SPH_STATIC_TABLE_CACHE_BUNDLE_SCHEMA,
    status: bundle?.status || 'static-table-cache-bundle-miss',
    storageStatus: bundle?.storageStatus || null,
    restoredFamilies: bundle?.restoredFamilies || [],
    hitCount: bundle?.hitCount || 0,
    staleCount: bundle?.staleCount || 0,
    tableCount: bundle?.tableCount || 0,
    gpuWarmupCount: bundle?.gpuWarmupCount || 0,
    generatorFingerprint: input.generatorFingerprint || null
  };
  const timing = {
    schema: 'peercompute.ulg.sph-static-table-cache-worker-timing.v0',
    totalMs: Math.max(0, nowMs() - taskStartMs),
    tableCount: update.counts?.tables ?? 0,
    gpuWarmupCount: update.counts?.gpuWarmup ?? 0,
    tableWriteCount: update.tableWriteCount ?? 0,
    tableUnchangedCount: update.tableUnchangedCount ?? 0,
    gpuWarmupWriteCount: update.gpuWarmupWriteCount ?? 0
  };
  if (record.cancelled) return;
  record.progress = 1;
  postStatus(record);
  const artifact = createSimulationArtifact({
    artifactId: `${task.rootTaskId}.sph-static-table-cache`,
    taskKind: task.taskKind,
    closureRef: input.closureRef || { uri: 'artifact://sph-static-table-cache-state' },
    representation: 'sph-static-table-cache',
    outputs: {
      update: compactUpdate,
      summary,
      bundleSummary,
      timing
    },
    execution: {
      backend: 'cpu-worker',
      status: 'sph-static-table-cache-complete',
      workerId,
      gpuLeaseStatus: null,
      timing
    },
    validity: {
      status: update.schema === SPH_STATIC_TABLE_CACHE_UPDATE_SCHEMA ? 'static-table-cache-updated' : 'static-table-cache-invalid',
      cacheable: true
    },
    uncertainty: {
      modelScope: 'sph-phase-demo-static-table-cache',
      calibratedPhysics: false
    },
    validation: {
      status: 'warn',
      validationMode: 'cache-integrity-only',
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false,
      blockers: ['static-table-cache-is-derived-artifact-reuse-not-physics-validation']
    },
    provenance: {
      ...task.provenance,
      sourceService: 'ulg-runtime',
      notes: [
        ...(task.provenance?.notes || []),
        'Serialized SPH static table cache records inside the supervised ULG runtime worker.',
        'Main thread persists the returned snapshot; worker owns parsing, hashing, typed-array payloads, and cache summaries.',
        'Evidence-only; no scientific/SPH/phase validation claim.'
      ]
    }
  });
  postTaskResult(task.rootTaskId, {
    artifact,
    update: compactUpdate,
    cacheSnapshot,
    bundle: bundleSummary.hitCount > 0 ? bundle : null,
    bundleSummary
  });
  activeTasks.delete(task.rootTaskId);
}

async function runSphStaticTableCacheRehydrateTask(task, record, taskStartMs) {
  const input = task.input || {};
  record.progress = 0.25;
  postStatus(record);
  const bundle = compactSphStaticTableBundleForTransfer(rehydrateSphStaticTableBundle(input.cacheSnapshot || null, {
    generatorFingerprint: input.generatorFingerprint || null
  }));
  const bundleSummary = {
    schema: SPH_STATIC_TABLE_CACHE_BUNDLE_SCHEMA,
    status: bundle?.status || 'static-table-cache-bundle-miss',
    storageStatus: bundle?.storageStatus || null,
    restoredFamilies: bundle?.restoredFamilies || [],
    hitCount: bundle?.hitCount || 0,
    staleCount: bundle?.staleCount || 0,
    tableCount: bundle?.tableCount || 0,
    gpuWarmupCount: bundle?.gpuWarmupCount || 0,
    generatorFingerprint: input.generatorFingerprint || null
  };
  const timing = {
    schema: 'peercompute.ulg.sph-static-table-cache-worker-read-timing.v0',
    totalMs: Math.max(0, nowMs() - taskStartMs),
    hitCount: bundleSummary.hitCount,
    tableCount: bundleSummary.tableCount,
    gpuWarmupCount: bundleSummary.gpuWarmupCount,
    staleCount: bundleSummary.staleCount
  };
  if (record.cancelled) return;
  record.progress = 1;
  postStatus(record);
  const artifact = createSimulationArtifact({
    artifactId: `${task.rootTaskId}.sph-static-table-cache-read`,
    taskKind: task.taskKind,
    closureRef: input.closureRef || { uri: 'artifact://sph-static-table-cache-state' },
    representation: 'sph-static-table-cache-read-summary',
    outputs: {
      bundleSummary,
      timing
    },
    execution: {
      backend: 'cpu-worker',
      status: 'sph-static-table-cache-read-complete',
      workerId,
      gpuLeaseStatus: null,
      timing
    },
    validity: {
      status: bundleSummary.hitCount > 0 ? 'static-table-cache-rehydrated' : 'static-table-cache-miss',
      cacheable: false
    },
    uncertainty: {
      modelScope: 'sph-phase-demo-static-table-cache-read',
      calibratedPhysics: false
    },
    validation: {
      status: 'warn',
      validationMode: 'cache-integrity-only',
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false,
      blockers: ['static-table-cache-is-derived-artifact-reuse-not-physics-validation']
    },
    provenance: {
      ...task.provenance,
      sourceService: 'ulg-runtime',
      notes: [
        ...(task.provenance?.notes || []),
        'Rehydrated SPH static table cache records inside the supervised ULG runtime worker.',
        'The large scene-consumable bundle is returned as direct task result data, not embedded in the artifact cache payload.',
        'Evidence-only; no scientific/SPH/phase validation claim.'
      ]
    }
  });
  postTaskResult(task.rootTaskId, {
    artifact,
    bundle: bundleSummary.hitCount > 0 ? bundle : null,
    bundleSummary
  });
  activeTasks.delete(task.rootTaskId);
}

function failTask(task, error) {
  activeTasks.delete(task.rootTaskId);
  self.postMessage({
    type: 'task-result',
    rootTaskId: task.rootTaskId,
    result: {
      artifact: createSimulationArtifact({
        artifactId: `${task.rootTaskId}.simulation-error`,
        taskKind: task.taskKind,
        closureRef: task.input?.closureRef || { uri: 'artifact://missing' },
        representation: 'carrier-toy',
        outputs: { deltas: [], error: error instanceof Error ? error.message : String(error) },
        execution: { backend: 'cpu-reference', status: 'error', steps: 0 },
        validity: { status: 'error' },
        validation: { status: 'fail', blockers: ['ulg-runtime-task-error'] },
        provenance: task.provenance
      })
    }
  });
}

function cancelTask(rootTaskId) {
  const record = activeTasks.get(rootTaskId);
  if (!record) return;
  record.cancelled = true;
  record.status = 'cancelled-clean';
  record.progress = 1;
  self.postMessage({
    type: 'task-cancelled',
    rootTaskId,
    result: {
      artifact: createSimulationArtifact({
        artifactId: `${rootTaskId}.simulation-cancelled`,
        taskKind: 'simulation.step',
        closureRef: { uri: 'artifact://cancelled' },
        representation: 'carrier-toy',
        outputs: { deltas: [] },
        execution: { backend: 'cpu-reference', status: 'cancelled', steps: 0 },
        validity: { status: 'cancelled' },
        validation: { status: 'warn', blockers: ['cancelled'] },
        provenance: { sourceService: 'ulg-runtime', notes: ['cancelled'] }
      })
    }
  });
  activeTasks.delete(rootTaskId);
}

function postStatus(task) {
  self.postMessage({
    type: 'task-status',
    rootTaskId: task.rootTaskId,
    status: task.status,
    progress: task.progress,
    children: []
  });
}

function sendHeartbeat() {
  self.postMessage({
    type: 'heartbeat',
    serviceId: manifest?.serviceId,
    telemetry: {
      activeTasks: activeTasks.size,
      backend: 'cpu-reference',
      runtime: 'toy-carrier'
    }
  });
}
