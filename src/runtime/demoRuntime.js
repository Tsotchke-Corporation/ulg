import {
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
