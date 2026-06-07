import {
  createEshkolClosureBundleAssetSpec,
  createMoonLabServiceAssetSpec,
  createUlgServiceManifest,
  createUlgTaskCapsule
} from '../../ulg-gpu-abi/src/serviceContract.js';
import { ArtifactCache } from './ArtifactCache.js';
import { ChildWorkerLeaseManager } from './ChildWorkerLeaseManager.js';
import { ComputeServiceRegistry } from './ComputeServiceRegistry.js';
import { GpuBroker } from './GpuBroker.js';
import { WorkerSupervisor } from './WorkerSupervisor.js';
import { createId } from './ids.js';

const serviceWorkerModule = new URL('../services/dummyService.worker.js', import.meta.url).href;
const childWorkerModule = new URL('../services/dummyChild.worker.js', import.meta.url).href;
const eshkolClosureBundleName = 'magnetar-closure';
const eshkolSmokeBundleName = 'hello';

export async function createDemoRuntime() {
  const registry = new ComputeServiceRegistry();
  const leaseManager = new ChildWorkerLeaseManager();
  const gpuBroker = new GpuBroker();
  const artifactCache = new ArtifactCache();
  const supervisor = new WorkerSupervisor({ registry, leaseManager, gpuBroker, artifactCache });
  const listeners = new Set();

  supervisor.subscribe((event, telemetry) => {
    for (const listener of listeners) {
      listener(event, telemetry);
    }
  });

  await gpuBroker.probe();
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
  await supervisor.spawnService('eshkol');
  await supervisor.spawnService('moonlab');

  let activeRootTasks = [];
  let autoCancelTimer = null;

  const api = {
    registry,
    artifactCache,
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

function createPeerComputeHandoffEnvelope(artifacts, extra = {}) {
  return {
    schema: 'peercompute.ulg.demo-handoff.v0',
    createdAt: new Date().toISOString(),
    artifactCount: artifacts.length,
    artifacts,
    ...extra
  };
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
