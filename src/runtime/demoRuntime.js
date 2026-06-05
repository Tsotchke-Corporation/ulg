import {
  ULG_GPU_ABI_VERSION,
  ULG_IR_VERSION,
  createProvenanceBlock,
  hashPayload
} from '../../ulg-gpu-abi/src/index.js';
import { ArtifactCache } from './ArtifactCache.js';
import { ChildWorkerLeaseManager } from './ChildWorkerLeaseManager.js';
import { ComputeServiceRegistry } from './ComputeServiceRegistry.js';
import { GpuBroker } from './GpuBroker.js';
import { WorkerSupervisor } from './WorkerSupervisor.js';
import { createId } from './ids.js';

const serviceWorkerModule = new URL('../services/dummyService.worker.js', import.meta.url).href;
const childWorkerModule = new URL('../services/dummyChild.worker.js', import.meta.url).href;

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
  await registry.register(createServiceManifest('eshkol', {
    capabilities: ['ulg.closure.derive', 'ulg.table.generate', 'ulg.validation.reference'],
    taskKinds: ['eshkol.closure.derive'],
    toleranceProfile: 'scientific-default'
  }));
  await registry.register(createServiceManifest('moonlab', {
    capabilities: ['ulg.quantum.response', 'ulg.parity.cpu_webgpu', 'ulg.tensor.contract'],
    taskKinds: ['moonlab.quantum.response'],
    toleranceProfile: 'quantum-response-demo'
  }));
  await supervisor.spawnService('eshkol');
  await supervisor.spawnService('moonlab');

  let activeRootTasks = [];
  let autoCancelTimer = null;

  const api = {
    registry,
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
    }
  };

  return api;
}

function createServiceManifest(serviceId, { capabilities, taskKinds, toleranceProfile }) {
  return {
    serviceId,
    version: '0.5.0-demo',
    runtime: 'js',
    entry: {
      workerModule: serviceWorkerModule
    },
    childWorkers: {
      allowed: true,
      maxChildren: 4,
      allowedModules: [childWorkerModule],
      sameOriginOnly: true
    },
    resources: {
      maxWasmMemoryBytes: 64 * 1024 * 1024,
      maxGpuMemoryBytes: 32 * 1024 * 1024,
      maxCpuWorkers: 4,
      maxTaskMs: 30_000
    },
    capabilities,
    taskKinds,
    abi: {
      ulgIrVersion: ULG_IR_VERSION,
      gpuAbiVersion: ULG_GPU_ABI_VERSION,
      supportedDTypes: ['f32', 'complex64'],
      supportedLayouts: ['soa', 'interleaved', 'row-major']
    },
    validation: {
      requiresCpuReference: true,
      toleranceProfile,
      parityModes: ['wasm-reference', 'js-dummy-reference']
    }
  };
}

function createTask(serviceId, taskKind) {
  const taskId = createId(`task-${serviceId}`);
  const method = { serviceId, taskKind, version: '0.5-demo' };
  const input = { demo: 'supervised-service-smoke', serviceId };
  return {
    taskId,
    rootTaskId: taskId,
    serviceId,
    taskKind,
    inputs: [],
    outputs: [{ artifactKind: taskKind.includes('moonlab') ? 'quantum-response' : 'closure' }],
    unitsHash: hashPayload({ units: 'demo' }),
    inputHash: hashPayload(input),
    methodHash: hashPayload(method),
    deterministicSeed: 'ulg-demo-seed',
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
    provenance: createProvenanceBlock({
      sourceService: serviceId,
      methodHash: hashPayload(method),
      inputHash: hashPayload(input),
      notes: ['dummy-service-smoke']
    })
  };
}
