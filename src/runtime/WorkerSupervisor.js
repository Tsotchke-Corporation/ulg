import { createId } from './ids.js';

export class WorkerSupervisor {
  constructor({ registry, leaseManager, gpuBroker, artifactCache, workerFactory = defaultWorkerFactory } = {}) {
    this.registry = registry;
    this.leaseManager = leaseManager;
    this.gpuBroker = gpuBroker;
    this.artifactCache = artifactCache;
    this.workerFactory = workerFactory;
    this.handles = new Map();
    this.tasks = new Map();
    this.pending = new Map();
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async spawnService(serviceId) {
    const service = this.registry.get(serviceId);
    if (!service) {
      throw new Error(`No registered service: ${serviceId}`);
    }
    if (this.handles.has(serviceId)) {
      return this.handles.get(serviceId);
    }

    const worker = this.workerFactory(service.manifest.entry.workerModule, serviceId);
    const handle = {
      serviceId,
      workerId: createId(`root-${serviceId}`),
      manifest: service.manifest,
      worker,
      status: 'spawning',
      heartbeatAt: null,
      telemetry: {}
    };
    worker.addEventListener('message', (event) => this.#handleMessage(handle, event.data));
    worker.addEventListener('error', (event) => {
      handle.status = 'error';
      handle.error = event.message;
      this.#emit({ type: 'worker-error', handle });
    });
    worker.postMessage({ type: 'init', workerId: handle.workerId, manifest: handle.manifest });
    this.handles.set(serviceId, handle);
    this.#emit({ type: 'service-spawned', handle });
    return handle;
  }

  async submitTask(task) {
    const handle = this.handles.get(task.serviceId) ?? await this.spawnService(task.serviceId);
    const gpuLease = await this.gpuBroker.requestLease({
      gpu: task.resources.gpu,
      priority: task.resources.priority,
      gpuMemoryBytes: task.resources.gpuMemoryBytes,
      rootTaskId: task.rootTaskId
    });
    const taskRecord = {
      ...task,
      status: 'queued',
      serviceId: handle.serviceId,
      gpuLease,
      startedAt: Date.now(),
      children: []
    };
    this.tasks.set(task.rootTaskId, taskRecord);
    const promise = new Promise((resolve, reject) => {
      this.pending.set(task.rootTaskId, { resolve, reject });
    });
    handle.worker.postMessage({ type: 'submit-task', task, gpuLease });
    this.#emit({ type: 'task-submitted', task: taskRecord });
    return promise;
  }

  async cancelTree(rootTaskId) {
    const task = this.tasks.get(rootTaskId);
    if (!task) {
      return;
    }
    await this.leaseManager.revokeByRootTask(rootTaskId);
    const handle = this.handles.get(task.serviceId);
    handle?.worker.postMessage({ type: 'cancel-task', rootTaskId });
    task.status = 'cancelling';
    this.#emit({ type: 'task-cancelling', task });
  }

  async shutdown() {
    await Promise.all([...this.tasks.keys()].map((rootTaskId) => this.cancelTree(rootTaskId)));
    for (const handle of this.handles.values()) {
      handle.worker.postMessage({ type: 'shutdown' });
      handle.worker.terminate();
      handle.status = 'terminated';
    }
    this.handles.clear();
    this.#emit({ type: 'shutdown' });
  }

  getTreeTelemetry() {
    return {
      services: [...this.handles.values()].map((handle) => ({
        serviceId: handle.serviceId,
        workerId: handle.workerId,
        status: handle.status,
        heartbeatAt: handle.heartbeatAt,
        telemetry: handle.telemetry,
        capabilities: handle.manifest.capabilities
      })),
      tasks: [...this.tasks.values()].map((task) => ({
        taskId: task.taskId,
        rootTaskId: task.rootTaskId,
        serviceId: task.serviceId,
        taskKind: task.taskKind,
        status: task.status,
        progress: task.progress ?? 0,
        children: task.children ?? [],
        gpuLease: task.gpuLease
      })),
      leases: this.leaseManager.list(),
      gpu: this.gpuBroker.reportPressure(),
      artifacts: this.artifactCache.list()
    };
  }

  async #handleMessage(handle, message) {
    if (message.type === 'ready') {
      handle.status = 'ready';
    }
    if (message.type === 'heartbeat') {
      handle.heartbeatAt = Date.now();
      handle.telemetry = message.telemetry ?? {};
    }
    if (message.type === 'task-status') {
      const task = this.tasks.get(message.rootTaskId);
      if (task) {
        task.status = message.status;
        task.progress = message.progress;
        task.children = message.children ?? task.children;
      }
    }
    if (message.type === 'lease-request') {
      await this.#handleLeaseRequest(handle, message);
    }
    if (message.type === 'lease-release') {
      await this.leaseManager.release(message.leaseId);
    }
    if (message.type === 'task-result') {
      await this.#completeTask(message.rootTaskId, message.result, 'complete');
    }
    if (message.type === 'task-cancelled') {
      await this.#completeTask(message.rootTaskId, message.result, 'cancelled-clean');
    }
    this.#emit({ type: 'worker-message', handle, message });
  }

  async #handleLeaseRequest(handle, message) {
    try {
      const lease = await this.leaseManager.request(handle.workerId, {
        rootTaskId: message.rootTaskId,
        module: message.module,
        count: message.count,
        resources: message.resources,
        allowed: handle.manifest.childWorkers.allowed,
        maxChildren: handle.manifest.childWorkers.maxChildren,
        allowedModules: handle.manifest.childWorkers.allowedModules
      });
      handle.worker.postMessage({ type: 'lease-granted', requestId: message.requestId, lease });
    } catch (error) {
      handle.worker.postMessage({ type: 'lease-denied', requestId: message.requestId, error: error.message });
    }
  }

  async #completeTask(rootTaskId, result, status) {
    const task = this.tasks.get(rootTaskId);
    if (!task) {
      return;
    }
    task.status = status;
    task.finishedAt = Date.now();
    if (result?.artifact) {
      task.artifactRef = await this.artifactCache.put(result.artifact);
    }
    await this.gpuBroker.releaseLease(task.gpuLease.leaseId);
    const pending = this.pending.get(rootTaskId);
    pending?.resolve({ ...result, status, rootTaskId, artifactRef: task.artifactRef });
    this.pending.delete(rootTaskId);
  }

  #emit(event) {
    for (const listener of this.listeners) {
      listener(event, this.getTreeTelemetry());
    }
  }
}

function defaultWorkerFactory(moduleUrl, serviceId) {
  return new Worker(moduleUrl, { type: 'module', name: `ulg-${serviceId}` });
}
