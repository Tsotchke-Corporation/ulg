import {
  createEshkolClosureBundleAssetSpec,
  createMoonLabServiceAssetSpec,
  ULG_SERVICE_IDS,
  ULG_TASK_KINDS,
  createUlgServiceManifest,
  createUlgTaskCapsule
} from '../../ulg-gpu-abi/src/serviceContract.js';
import {
  createClosureInvalidationArtifact,
  createClosureRederivationArtifact,
  createClosureTableDescriptor,
  hashPayload
} from '../../ulg-gpu-abi/src/index.js';
import { ArtifactCache } from './ArtifactCache.js';
import { ChildWorkerLeaseManager } from './ChildWorkerLeaseManager.js';
import { ClosureRegistry } from './ClosureRegistry.js';
import { ComputeServiceRegistry } from './ComputeServiceRegistry.js';
import { GpuBroker } from './GpuBroker.js';
import { WorkerSupervisor } from './WorkerSupervisor.js';
import { createDefaultCarrierState } from './carrierRuntime.js';
import { createId } from './ids.js';

const DEFAULT_SERVICE_WORKER_MODULE_PATH = '../services/dummyService.worker.js';
const DEFAULT_ULG_RUNTIME_WORKER_MODULE_PATH = '../services/ulgRuntime.worker.js';
const DEFAULT_CHILD_WORKER_MODULE_PATH = '../services/dummyChild.worker.js';
const eshkolClosureBundleName = 'magnetar-closure';
const eshkolSmokeBundleName = 'hello';

function resolveSourceWorkerModule(relativePath) {
  return new URL(relativePath, import.meta.url).href;
}

export async function createDemoRuntime({
  deferTriadServices = false,
  deferGpuProbe = false,
  serviceWorkerModuleUrl = null,
  ulgRuntimeWorkerModuleUrl = null,
  childWorkerModuleUrl = null
} = {}) {
  // Browser entrypoints pass Vite-bundled worker URLs. The lazy source-relative
  // defaults keep direct module consumers and tests usable without making Vite
  // copy unbundled worker sources (and their unresolved imports) into releases.
  const serviceWorkerModule = serviceWorkerModuleUrl
    || resolveSourceWorkerModule(DEFAULT_SERVICE_WORKER_MODULE_PATH);
  const ulgRuntimeWorkerModule = ulgRuntimeWorkerModuleUrl
    || resolveSourceWorkerModule(DEFAULT_ULG_RUNTIME_WORKER_MODULE_PATH);
  const childWorkerModule = childWorkerModuleUrl
    || resolveSourceWorkerModule(DEFAULT_CHILD_WORKER_MODULE_PATH);
  const registry = new ComputeServiceRegistry();
  const leaseManager = new ChildWorkerLeaseManager();
  const gpuBroker = new GpuBroker();
  const artifactCache = new ArtifactCache();
  const closureRegistry = new ClosureRegistry({ artifactCache });
  const supervisor = new WorkerSupervisor({ registry, leaseManager, gpuBroker, artifactCache });
  const listeners = new Set();

  supervisor.subscribe((event, telemetry) => {
    for (const listener of listeners) {
      listener(event, telemetry);
    }
  });

  const emitRuntimeEvent = (event) => {
    for (const listener of listeners) {
      listener(event, supervisor.getTreeTelemetry());
    }
  };
  const gpuProbePromise = gpuBroker.probe().then((capabilities) => {
    emitRuntimeEvent({ type: 'gpu-probe-complete', capabilities });
    return capabilities;
  }).catch((error) => {
    emitRuntimeEvent({
      type: 'gpu-probe-error',
      error: error instanceof Error ? error.message : String(error)
    });
    if (!deferGpuProbe) throw error;
    return gpuBroker.capabilities;
  });
  if (!deferGpuProbe) {
    await gpuProbePromise;
  }
  await registry.register(createUlgServiceManifest({
    serviceId: 'eshkol',
    workerModule: serviceWorkerModule,
    childWorkerModule,
    serviceAssets: createEshkolClosureBundleAssetSpec({ bundleName: eshkolClosureBundleName }),
    validation: {
      toleranceProfile: 'scientific-default'
    }
  }));
  await registry.register(createUlgServiceManifest({
    serviceId: 'moonlab',
    runtime: 'wasm',
    workerModule: serviceWorkerModule,
    serviceAssets: createMoonLabServiceAssetSpec(),
    childWorkerModule,
    validation: {
      toleranceProfile: 'quantum-response-demo'
    }
  }));
  await registry.register(createUlgServiceManifest({
    serviceId: ULG_SERVICE_IDS.ulgRuntime,
    runtime: 'js',
    workerModule: ulgRuntimeWorkerModule,
    childWorkers: {
      allowed: false,
      maxChildren: 0,
      allowedModules: []
    },
    resources: {
      maxCpuWorkers: 1,
      maxGpuMemoryBytes: 8 * 1024 * 1024
    },
    validation: {
      toleranceProfile: 'toy-carrier-reference',
      parityModes: ['cpu-reference', 'cpu-webgpu']
    }
  }));
  await supervisor.spawnService(ULG_SERVICE_IDS.ulgRuntime);
  if (!deferTriadServices) {
    await supervisor.spawnService('eshkol');
    await supervisor.spawnService('moonlab');
  }

  let activeRootTasks = [];
  let autoCancelTimer = null;

  const api = {
    registry,
    artifactCache,
    closureRegistry,
    supervisor,
    get telemetry() {
      return supervisor.getTreeTelemetry();
    },
    subscribe(listener) {
      listeners.add(listener);
      listener({ type: 'initial' }, supervisor.getTreeTelemetry());
      return () => listeners.delete(listener);
    },
    async runSmoke() {
      if (autoCancelTimer) {
        clearTimeout(autoCancelTimer);
      }
      activeRootTasks = [createTask('eshkol', 'eshkol.closure.derive'), createTask('moonlab', 'moonlab.quantum.response')];
      const taskPromises = activeRootTasks.map((task) => supervisor.submitTask(task));
      autoCancelTimer = setTimeout(() => {
        api.cancelActive();
      }, 4200);
      return Promise.allSettled(taskPromises);
    },
    async runOscillatorDemo(options = {}) {
      if (autoCancelTimer) {
        clearTimeout(autoCancelTimer);
        autoCancelTimer = null;
      }
      const closureArtifact = options.closureArtifact || createToyOscillatorClosureArtifact(options);
      const closureRef = await closureRegistry.store(closureArtifact);
      const initialState = options.initialState || createDefaultCarrierState({
        separation: options.separation ?? 1.2,
        velocity: options.velocity ?? 0,
        mass: options.mass ?? 1
      });
      const resolved = await closureRegistry.resolve({
        closureKind: closureArtifact.closureKind,
        inputHash: closureArtifact.inputHash || closureArtifact.provenance?.inputHash,
        methodHash: closureArtifact.methodHash || closureArtifact.provenance?.methodHash,
        point: { r: Math.abs(initialState.bodies[1].x - initialState.bodies[0].x) }
      });
      if (resolved.validity !== 'in-range') {
        await closureRegistry.invalidate({ ref: closureRef, reason: resolved.reason || 'closure-out-of-range' });
        throw new Error(`Oscillator closure resolve failed: ${resolved.validity}`);
      }
      const task = createOscillatorTask({
        closureRef: resolved.ref,
        closureArtifact: resolved.closure,
        closureValidity: resolved.validity,
        initialState,
        steps: options.steps ?? 64,
        dt: options.dt ?? 0.002,
        backendPreference: normalizeBackendPreference(options.backendPreference)
      });
      activeRootTasks = [task];
      const result = await supervisor.submitTask(task);
      const closureRefresh = await applyClosureRefreshFromSimulation({
        closureRegistry,
        artifactCache,
        closureRef: resolved.ref,
        closureArtifact: resolved.closure,
        result,
        rederiveClosure: options.rederiveOnRefresh ? rederiveToyOscillatorClosure : null
      });
      return {
        ...result,
        closureRef: resolved.ref,
        closureValidity: resolved.validity,
        closureRefresh
      };
    },
    async runSphPhaseRebuild(options = {}) {
      const task = createSphPhaseRebuildTask(options);
      return supervisor.submitTask(task);
    },
    async runSphStaticTableCacheUpdate(options = {}) {
      const task = createSphStaticTableCacheTask(options);
      return supervisor.submitTask(task);
    },
    async runSphStaticTableCacheRehydrate(options = {}) {
      const task = createSphStaticTableCacheTask({ ...options, mode: 'rehydrate' });
      return supervisor.submitTask(task);
    },
    async awaitGpuProbe() {
      return gpuProbePromise;
    },
    async cancelActive() {
      if (autoCancelTimer) {
        clearTimeout(autoCancelTimer);
        autoCancelTimer = null;
      }
      await Promise.all(activeRootTasks.map((task) => supervisor.cancelTree(task.rootTaskId)));
    },
    async createPeerComputeHandoff(options = {}) {
      return createPeerComputeHandoffEnvelope(
        await createCachedArtifactHandoffs(artifactCache, options)
      );
    },
    async createPeerComputeUlgRuntimeHandoff(options = {}) {
      return createUlgRuntimeHandoff(artifactCache, options);
    },
    async createPeerComputeEshkolSmokeHandoff(options = {}) {
      const cachedArtifacts = await createCachedArtifactHandoffs(artifactCache, {
        ...options,
        sourceServices: ['moonlab']
      });
      const smokeClosure = await createEshkolSmokeClosureHandoff(options);
      return createPeerComputeHandoffEnvelope([...cachedArtifacts, smokeClosure], {
        handoffKind: 'eshkol-smoke-output-semantics',
        notes: [
          'Uses the staged Eshkol hello closure bundle to prove gated runtime output semantics.',
          'Does not claim magnetar closure scientific validation.'
        ]
      });
    }
  };

  return api;
}

export async function applyClosureRefreshFromSimulation({
  closureRegistry,
  artifactCache,
  closureRef,
  closureArtifact,
  result,
  rederiveClosure = null
}) {
  const refreshRequest = result?.artifact?.outputs?.closureRefreshRequest || null;
  if (!refreshRequest) {
    return null;
  }
  const applied = await closureRegistry.applyRefreshRequest({ ref: closureRef, refreshRequest });
  if (applied?.status !== 'invalidated') {
    return {
      status: applied?.status || 'unchanged',
      registryAction: applied?.registryAction || refreshRequest.registryAction || 'none',
      refreshRequest
    };
  }
  const invalidationArtifact = createClosureInvalidationArtifact({
    artifactId: `${result.rootTaskId}.closure-invalidation`,
    closureRef,
    closureId: closureArtifact?.closureId || null,
    closureKind: closureArtifact?.closureKind || null,
    refreshRequest,
    invalidation: applied,
    simulationArtifactRef: result.artifactRef || null
  });
  const invalidationRef = await artifactCache.put(invalidationArtifact);
  const closureRefresh = {
    status: 'invalidated',
    reason: applied.reason,
    registryAction: refreshRequest.registryAction || 'invalidate-and-rerun-closure-derive',
    refreshRequest,
    artifactRef: invalidationRef,
    artifact: invalidationArtifact
  };
  // Opt-in: actually re-derive and re-register a refreshed closure so a supervised run can
  // continue (closes the "recommend-only" gap). Evidence-only; the re-derived closure is a toy.
  if (typeof rederiveClosure === 'function' && closureArtifact) {
    const axisName = closureArtifact.execution?.table?.axisName || 'r';
    const previousDomain = Array.isArray(closureArtifact.validity?.[axisName])
      ? closureArtifact.validity[axisName]
      : null;
    const newClosure = rederiveClosure(closureArtifact, refreshRequest);
    const newClosureRef = await closureRegistry.store(newClosure);
    const expandedDomain = Array.isArray(newClosure.validity?.[axisName])
      ? newClosure.validity[axisName]
      : null;
    const rederivationArtifact = createClosureRederivationArtifact({
      artifactId: `${result.rootTaskId}.closure-rederivation`,
      previousClosureRef: closureRef,
      newClosureRef,
      previousClosureId: closureArtifact.closureId || null,
      newClosureId: newClosure.closureId || null,
      closureKind: newClosure.closureKind || closureArtifact.closureKind || null,
      refreshRequest,
      previousDomain,
      expandedDomain,
      axisName,
      invalidationArtifactRef: invalidationRef
    });
    const rederivationRef = await artifactCache.put(rederivationArtifact);
    closureRefresh.rederivation = {
      status: 'rederived',
      newClosureRef,
      newClosureId: newClosure.closureId || null,
      previousDomain,
      expandedDomain,
      artifactRef: rederivationRef,
      artifact: rederivationArtifact,
      closure: newClosure
    };
  }
  return closureRefresh;
}

/**
 * Re-derive a refreshed toy oscillator closure with a validity domain expanded to cover the
 * input that left the previous closure's domain. Infers the harmonic spring constant and rest
 * length from the previous table so the physics is preserved across the wider domain.
 */
export function rederiveToyOscillatorClosure(previousClosure, refreshRequest, { marginFraction = 0.25 } = {}) {
  const axisName = previousClosure?.execution?.table?.axisName || 'r';
  const prevDomain = Array.isArray(previousClosure?.validity?.[axisName])
    ? previousClosure.validity[axisName]
    : [0.6, 1.8];
  const samples = Array.isArray(previousClosure?.execution?.table?.samples)
    ? previousClosure.execution.table.samples
    : [];
  let springK = 1;
  let restLength = 1;
  if (samples.length >= 2) {
    const first = samples[0];
    const last = samples[samples.length - 1];
    const dFirst = Number(first.dEdr);
    const dLast = Number(last.dEdr);
    const rFirst = Number(first.r);
    const rLast = Number(last.r);
    if (Number.isFinite(dFirst) && Number.isFinite(dLast) && rLast !== rFirst) {
      const slope = (dLast - dFirst) / (rLast - rFirst);
      if (slope !== 0) {
        springK = slope;
        restLength = rFirst - dFirst / slope;
      }
    }
  }
  const offendingMin = Number.isFinite(refreshRequest?.minOutOfRangeInput)
    ? refreshRequest.minOutOfRangeInput
    : prevDomain[0];
  const offendingMax = Number.isFinite(refreshRequest?.maxOutOfRangeInput)
    ? refreshRequest.maxOutOfRangeInput
    : prevDomain[1];
  const span = Math.max(prevDomain[1] - prevDomain[0], 1e-6);
  const margin = span * marginFraction;
  const minR = Math.max(1e-6, Math.min(prevDomain[0], offendingMin) - margin);
  const maxR = Math.max(prevDomain[1], offendingMax) + margin;
  return createToyOscillatorClosureArtifact({ minR, maxR, restLength, springK });
}

function createToyOscillatorClosureArtifact({
  sampleCount = 121,
  minR = 0.6,
  maxR = 1.8,
  restLength = 1,
  springK = 1,
  createdAt = new Date().toISOString()
} = {}) {
  const input = { closureKind: 'toy-two-particle-oscillator', minR, maxR, restLength, springK };
  const method = { mode: 'table-interpolation', model: 'harmonic-potential', sampleCount };
  const inputHash = hashPayload(input);
  const methodHash = hashPayload(method);
  const samples = [];
  for (let index = 0; index < sampleCount; index += 1) {
    const r = minR + (index / (sampleCount - 1)) * (maxR - minR);
    const displacement = r - restLength;
    samples.push({
      r,
      energy: 0.5 * springK * displacement * displacement,
      dEdr: springK * displacement
    });
  }
  const tableDescriptor = createClosureTableDescriptor({
    closureId: `toy-oscillator-closure-${sampleCount}`,
    axes: [{ name: 'r', samples: sampleCount, min: minR, max: maxR, units: 'demo-length' }],
    outputs: [{ name: 'energy', dtype: 'f32', samples: sampleCount, units: 'demo-energy' }],
    derivativeName: 'dEdr',
    interpolation: 'linear',
    validity: { r: [minR, maxR] }
  });
  return {
    closureId: tableDescriptor.closureId,
    sourceService: 'ulg-runtime-fixture',
    closureKind: 'toy-two-particle-oscillator',
    inputHash,
    methodHash,
    inputs: [{ name: 'r', units: 'demo-length' }],
    outputs: [{ name: 'energy', units: 'demo-energy' }],
    derivatives: [{ output: 'energy', axis: 'r', name: 'dEdr' }],
    tableDescriptor,
    execution: {
      mode: 'table-interpolation',
      tableDescriptor,
      wgslTableDescriptor: tableDescriptor.wgslTableDescriptor,
      table: {
        axisName: 'r',
        outputName: 'energy',
        derivativeName: 'dEdr',
        samples
      }
    },
    validity: { r: [minR, maxR] },
    uncertainty: {
      interpolationError: 0,
      modelScope: 'toy-harmonic-reference'
    },
    validation: {
      status: 'pass',
      validationMode: 'analytic-harmonic-table-fixture',
      scientificValidation: false,
      fullPhysicsValidation: false
    },
    provenance: {
      sourceService: 'ulg-runtime-fixture',
      methodHash,
      inputHash,
      codeVersion: 'ulg-demo',
      deterministicSeed: 'toy-oscillator-table',
      createdAt,
      notes: [
        'Phase 1 ULG carrier runtime fixture.',
        'Table-interpolation closure for a two-particle harmonic oscillator.',
        'Not a scientific or full-physics validation artifact.'
      ]
    }
  };
}

function createOscillatorTask({
  closureRef,
  closureArtifact,
  closureValidity,
  initialState,
  steps,
  dt,
  backendPreference
}) {
  const taskId = createId('task-ulg-runtime');
  const requestsWebGpu = backendPreference.includes('webgpu');
  return createUlgTaskCapsule({
    taskId,
    serviceId: ULG_SERVICE_IDS.ulgRuntime,
    taskKind: ULG_TASK_KINDS.simulationStep,
    outputs: [{ artifactKind: 'simulation-delta' }],
    input: {
      closureRef,
      closureArtifact,
      closureValidity,
      initialState,
      steps,
      dt,
      backendPreference,
      toleranceProfile: {
        name: 'toy-carrier-reference',
        energyAbs: 1e-3,
        momentumAbs: 1e-9
      }
    },
    method: {
      serviceId: ULG_SERVICE_IDS.ulgRuntime,
      taskKind: ULG_TASK_KINDS.simulationStep,
      integrator: 'velocity-verlet',
      backend: requestsWebGpu ? 'webgpu-or-cpu-reference' : 'cpu-reference',
      backendPreference
    },
    resources: {
      childWorkers: 0,
      gpu: 'optional',
      wasmMemoryBytes: 0,
      gpuMemoryBytes: 1024 * 1024,
      priority: 'simulation'
    },
    validation: {
      mode: requestsWebGpu ? 'cpu-webgpu' : 'cpu-reference',
      toleranceProfile: 'toy-carrier-reference'
    },
    provenanceNotes: [
      'ulg-carrier-runtime-phase-1',
      requestsWebGpu ? 'ulg-carrier-runtime-webgpu-phase-2-requested' : 'ulg-carrier-runtime-cpu-reference'
    ]
  });
}

export function createSphPhaseRebuildTask(options = {}) {
  const taskId = createId('task-ulg-sph-phase');
  const {
    __cacheLookup: cacheLookup = null,
    __cachePersistence: cachePersistence = null,
    __staticTableCache: staticTableCache = null,
    ...demoOptions
  } = options || {};
  return createUlgTaskCapsule({
    taskId,
    serviceId: ULG_SERVICE_IDS.ulgRuntime,
    taskKind: ULG_TASK_KINDS.sphPhaseRebuild,
    outputs: [{ artifactKind: 'sph-phase-rebuild-view-state' }],
    input: {
      options: demoOptions,
      cacheLookup,
      cachePersistence,
      staticTableCache,
      closureRef: { uri: 'artifact://sph-phase-derived-runtime-state' }
    },
    method: {
      serviceId: ULG_SERVICE_IDS.ulgRuntime,
      taskKind: ULG_TASK_KINDS.sphPhaseRebuild,
      backend: 'supervised-cpu-worker',
      version: '0.5-demo'
    },
    resources: {
      childWorkers: 0,
      gpu: 'optional',
      wasmMemoryBytes: 0,
      gpuMemoryBytes: 1024 * 1024,
      priority: 'background'
    },
    validation: {
      mode: 'self',
      toleranceProfile: 'sph-phase-derived-view-state'
    },
    provenanceNotes: [
      'ulg-sph-phase-rebuild-worker',
      'material-reaction-particle-view-state-offloaded-from-ui-thread',
      'evidence-only-not-scientific-validation'
    ]
  });
}

export function createSphStaticTableCacheTask(options = {}) {
  const taskId = createId('task-ulg-sph-static-cache');
  const mode = options.mode === 'rehydrate' ? 'rehydrate' : 'update';
  return createUlgTaskCapsule({
    taskId,
    serviceId: ULG_SERVICE_IDS.ulgRuntime,
    taskKind: ULG_TASK_KINDS.sphStaticTableCache,
    outputs: [{ artifactKind: 'sph-static-table-cache' }],
    input: {
      mode,
      cacheSnapshot: options.cacheSnapshot || null,
      tableInputs: mode === 'update' ? options.tableInputs || {} : {},
      generatorFingerprint: options.generatorFingerprint || null,
      closureRef: { uri: 'artifact://sph-static-table-cache-state' }
    },
    method: {
      serviceId: ULG_SERVICE_IDS.ulgRuntime,
      taskKind: ULG_TASK_KINDS.sphStaticTableCache,
      backend: 'supervised-cpu-worker',
      version: '0.5-demo'
    },
    resources: {
      childWorkers: 0,
      gpu: 'none',
      wasmMemoryBytes: 0,
      gpuMemoryBytes: 0,
      priority: 'background'
    },
    validation: {
      mode: 'self',
      toleranceProfile: 'sph-static-cache-integrity'
    },
    provenanceNotes: [
      'ulg-sph-static-table-cache-worker',
      mode === 'rehydrate'
        ? 'static-table-cache-rehydration-offloaded-from-ui-thread'
        : 'static-table-cache-serialization-offloaded-from-ui-thread',
      'evidence-only-not-scientific-validation'
    ]
  });
}

function normalizeBackendPreference(backendPreference) {
  if (!Array.isArray(backendPreference)) {
    return ['webgpu', 'cpu-reference'];
  }
  const allowedBackends = new Set(['webgpu', 'cpu-reference']);
  const selected = [];
  for (const backend of backendPreference) {
    if (allowedBackends.has(backend) && !selected.includes(backend)) {
      selected.push(backend);
    }
  }
  return selected.length > 0 ? selected : ['cpu-reference'];
}

function createPeerComputeHandoffEnvelope(artifacts, extra = {}) {
  return {
    schema: 'peercompute.ulg.demo-handoff.v0',
    createdAt: new Date().toISOString(),
    artifactCount: artifacts.length,
    artifacts,
    ...extra
  };
}

export const ULG_RUNTIME_HANDOFF_SOURCE_SERVICES = ['ulg-runtime', 'ulg-runtime-fixture'];

/**
 * Opt-in handoff that deliberately includes ULG runtime closure + simulation (and
 * closure-invalidation) artifacts so PeerCompute can inspect
 * `tableDescriptor.wgslTableDescriptor`. The default `createPeerComputeHandoff`
 * carries whatever the live smoke produced (MoonLab/Eshkol); this is the explicit
 * mode for ULG runtime evidence. Closure/provenance + runtime evidence only — no
 * material/EOS/SPH/phase or scientific validation is claimed.
 */
export async function createUlgRuntimeHandoff(artifactCache, options = {}) {
  const sourceServices = options.includeAncestors
    ? [...ULG_RUNTIME_HANDOFF_SOURCE_SERVICES, 'moonlab', 'eshkol']
    : [...ULG_RUNTIME_HANDOFF_SOURCE_SERVICES];
  const artifacts = await createCachedArtifactHandoffs(artifactCache, { ...options, sourceServices });
  const wgslDescriptorCount = artifacts.filter((handoff) => handoff.wgslTableDescriptor).length;
  return createPeerComputeHandoffEnvelope(artifacts, {
    handoffKind: 'ulg-runtime-closure-simulation',
    ulgRuntimeArtifactCount: artifacts.length,
    wgslTableDescriptorCount: wgslDescriptorCount,
    includesAncestors: options.includeAncestors === true,
    scientificValidation: false,
    fullPhysicsValidation: false,
    materialValidation: false,
    eosValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    notes: [
      'Opt-in ULG runtime handoff: includes ULG closure + simulation artifacts so PeerCompute can inspect tableDescriptor.wgslTableDescriptor.',
      'Closure/provenance + runtime evidence only; no material/EOS/SPH/phase or scientific validation claim.'
    ]
  });
}

async function createCachedArtifactHandoffs(artifactCache, options = {}) {
  const allowedSourceServices = Array.isArray(options.sourceServices)
    ? new Set(options.sourceServices)
    : null;
  const artifacts = [];
  for (const record of artifactCache.list()) {
    if (allowedSourceServices && !allowedSourceServices.has(record.ref.sourceService)) {
      continue;
    }
    const artifact = await artifactCache.get(record.ref);
    const handoff = {
      ref: record.ref,
      artifactKind: record.artifactKind,
      artifactSummary: record.artifactSummary,
      artifact
    };
    // Surface the closure-table WGSL descriptor so PeerCompute can inspect it without
    // re-walking the artifact body (used by the opt-in ULG runtime handoff).
    const wgslTableDescriptor = artifact?.tableDescriptor?.wgslTableDescriptor
      || artifact?.execution?.wgslTableDescriptor
      || null;
    if (wgslTableDescriptor) {
      handoff.wgslTableDescriptor = wgslTableDescriptor;
    }
    if (record.artifactKind === 'closure' && options.includeWasmBytes !== false) {
      const wasmAsset = artifact?.runtime?.assetProbe?.assets?.find((asset) => asset.kind === 'wasmModule');
      if (wasmAsset?.url) {
        await attachWasmBytes(handoff, wasmAsset.url);
      }
    }
    artifacts.push(handoff);
  }
  return artifacts;
}

async function createEshkolSmokeClosureHandoff(options = {}) {
  const assets = createEshkolClosureBundleAssetSpec({ bundleName: eshkolSmokeBundleName });
  const [artifact, bundleManifest] = await Promise.all([
    fetchJsonAsset(assets.artifactModule),
    fetchJsonAsset(assets.bundleManifest)
  ]);
  const smokeArtifact = {
    ...artifact,
    sourceService: artifact.sourceService || 'eshkol',
    taskKind: 'eshkol.closure.derive',
    runtime: {
      ...(artifact.runtime || {}),
      assetProbe: createEshkolSmokeAssetProbe(assets),
      bundleManifest
    }
  };
  const cache = new ArtifactCache();
  const ref = await cache.put(smokeArtifact);
  const handoff = {
    ref,
    artifactKind: cache.list()[0].artifactKind,
    artifactSummary: await cache.getSummary(ref),
    artifact: smokeArtifact
  };
  if (options.includeWasmBytes !== false) {
    await attachWasmBytes(handoff, assets.wasmModule);
    const expectedByteLength = smokeArtifact.execution?.module?.byteLength;
    if (Number.isFinite(expectedByteLength) && expectedByteLength !== handoff.wasmByteLength) {
      throw new Error(`Eshkol smoke WASM byte length mismatch: expected ${expectedByteLength}, got ${handoff.wasmByteLength}`);
    }
  }
  return handoff;
}

function createEshkolSmokeAssetProbe(assets) {
  return {
    status: 'ready',
    baseUrl: assets.baseUrl,
    assets: [
      { kind: 'artifactModule', url: assets.artifactModule, status: 'ready' },
      { kind: 'wasmModule', url: assets.wasmModule, status: 'ready' },
      { kind: 'hostImportsModule', url: assets.hostImportsModule, status: 'ready' },
      { kind: 'schemaModule', url: assets.schemaModule, status: 'ready' },
      { kind: 'bundleManifest', url: assets.bundleManifest, status: 'ready' }
    ]
  };
}

async function fetchJsonAsset(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Unable to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function attachWasmBytes(handoff, url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Unable to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  const wasmBytes = new Uint8Array(await response.arrayBuffer());
  handoff.wasmBytes = Array.from(wasmBytes);
  handoff.wasmByteLength = wasmBytes.byteLength;
  handoff.wasmSourceUrl = url;
}

function createTask(serviceId, taskKind) {
  const taskId = createId(`task-${serviceId}`);
  const method = { serviceId, taskKind, version: '0.5-demo' };
  const input = { demo: 'supervised-service-smoke', serviceId };
  return createUlgTaskCapsule({
    taskId,
    serviceId,
    taskKind,
    outputs: [{ artifactKind: taskKind.includes('moonlab') ? 'quantum-response' : 'closure' }],
    input,
    method,
    resources: {
      childWorkers: 2,
      gpu: 'optional',
      wasmMemoryBytes: 8 * 1024 * 1024,
      gpuMemoryBytes: 4 * 1024 * 1024,
      priority: 'simulation'
    },
    validation: {
      mode: 'self',
      toleranceProfile: 'demo-parity'
    },
    provenanceNotes: ['dummy-service-smoke']
  });
}
