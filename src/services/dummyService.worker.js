import { probeManifestServiceAssets } from '../runtime/ServiceAssetProbe.js';

let workerId = null;
let manifest = null;
let heartbeat = null;
let assetProbe = null;
let initPromise = null;
const activeTasks = new Map();
const pendingLeaseRequests = new Map();

self.addEventListener('message', (event) => {
  const message = event.data;
  if (message.type === 'init') {
    initPromise = initService(message);
  }
  if (message.type === 'submit-task') {
    startTaskAfterInit(message.task);
  }
  if (message.type === 'lease-granted') {
    const task = pendingLeaseRequests.get(message.requestId);
    pendingLeaseRequests.delete(message.requestId);
    if (task) {
      startChildren(task, message.lease);
    }
  }
  if (message.type === 'lease-denied') {
    const task = pendingLeaseRequests.get(message.requestId);
    pendingLeaseRequests.delete(message.requestId);
    if (task) {
      task.status = 'lease-denied';
      postStatus(task);
    }
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

async function initService(message) {
  workerId = message.workerId;
  manifest = message.manifest;
  assetProbe = await probeManifestServiceAssets(manifest, {
    fetchImpl: self.fetch?.bind(self),
    locationHref: self.location?.href
  });
  heartbeat = setInterval(sendHeartbeat, 500);
  self.postMessage({ type: 'ready', workerId, serviceId: manifest.serviceId, assetProbe });
}

async function startTaskAfterInit(taskCapsule) {
  if (initPromise) {
    await initPromise;
  }
  startTask(taskCapsule);
}

function startTask(taskCapsule) {
  const task = {
    ...taskCapsule,
    status: 'requesting-lease',
    progress: 0,
    lease: null,
    children: [],
    childSpec: selectChildWorkerSpec(taskCapsule)
  };
  activeTasks.set(task.rootTaskId, task);
  postStatus(task);

  const requestId = `${workerId}:${task.rootTaskId}:lease`;
  pendingLeaseRequests.set(requestId, task);
  self.postMessage({
    type: 'lease-request',
    requestId,
    rootTaskId: task.rootTaskId,
    module: task.childSpec.module,
    workerType: task.childSpec.workerType,
    count: task.resources.childWorkers ?? 1,
    resources: {
      wasmMemoryBytes: task.resources.wasmMemoryBytes,
      priority: task.resources.priority
    }
  });
}

function startChildren(task, lease) {
  task.lease = lease;
  task.status = 'running';
  for (let index = 0; index < lease.count; index += 1) {
    const child = {
      childId: `${task.rootTaskId}:child-${index + 1}`,
      status: 'starting',
      progress: 0,
      workerType: lease.workerType ?? 'module',
      worker: new Worker(lease.module, {
        type: lease.workerType ?? 'module',
        name: `${manifest.serviceId}-child-${index + 1}`
      })
    };
    child.worker.addEventListener('message', (event) => handleChildMessage(task, child, event.data));
    child.worker.postMessage({
      type: 'start',
      childId: child.childId,
      rootTaskId: task.rootTaskId,
      serviceId: manifest.serviceId,
      serviceAssets: manifest.entry.serviceAssets
    });
    task.children.push(child);
  }
  postStatus(task);
}

function handleChildMessage(task, child, message) {
  if (message.type === 'progress') {
    child.status = 'running';
    child.progress = message.progress;
  }
  if (message.type === 'complete') {
    child.status = 'complete';
    child.progress = 1;
    if (message.coreProbe) {
      child.coreProbe = message.coreProbe;
      task.coreProbe = message.coreProbe;
    }
  }
  if (message.type === 'cancelled') {
    child.status = 'cancelled';
  }

  task.progress = task.children.reduce((total, item) => total + item.progress, 0) / Math.max(task.children.length, 1);
  postStatus(task);

  if (task.children.every((item) => item.status === 'complete')) {
    finishTask(task);
  }
}

function finishTask(task) {
  task.status = 'complete';
  cleanupChildren(task);
  releaseLease(task);
  self.postMessage({
    type: 'task-result',
    rootTaskId: task.rootTaskId,
    result: {
      artifact: createArtifact(task)
    }
  });
  activeTasks.delete(task.rootTaskId);
}

function cancelTask(rootTaskId) {
  const task = activeTasks.get(rootTaskId);
  if (!task) {
    return;
  }
  task.status = 'cancelled-clean';
  for (const child of task.children) {
    child.worker.postMessage({ type: 'cancel' });
    child.worker.terminate();
    child.status = 'cancelled';
  }
  releaseLease(task);
  self.postMessage({
    type: 'task-cancelled',
    rootTaskId,
    result: {
      artifact: createArtifact(task)
    }
  });
  activeTasks.delete(rootTaskId);
  postStatus(task);
}

function cleanupChildren(task) {
  for (const child of task.children) {
    child.worker.terminate();
  }
}

function releaseLease(task) {
  if (task.lease) {
    self.postMessage({ type: 'lease-release', leaseId: task.lease.leaseId });
  }
}

function postStatus(task) {
  self.postMessage({
    type: 'task-status',
    rootTaskId: task.rootTaskId,
    status: task.status,
    progress: task.progress,
    children: task.children.map((child) => ({
      childId: child.childId,
      status: child.status,
      progress: child.progress,
      workerType: child.workerType,
      coreProbeStatus: child.coreProbe?.status
    }))
  });
}

function sendHeartbeat() {
  self.postMessage({
    type: 'heartbeat',
    serviceId: manifest?.serviceId,
    telemetry: {
      activeTasks: activeTasks.size,
      children: [...activeTasks.values()].reduce((total, task) => total + task.children.length, 0),
      memoryEstimateBytes: activeTasks.size * 1024 * 1024,
      assetProbe
    }
  });
}

function createArtifact(task) {
  if (manifest.serviceId === 'moonlab') {
    const coreProbe = task.coreProbe ?? null;
    const coreProbeReady = coreProbe?.status === 'ready';
    return {
      artifactId: `${task.rootTaskId}.quantum-response`,
      sourceService: 'moonlab',
      taskKind: 'quantum.response',
      inputHash: task.inputHash,
      method: coreProbeReady ? 'moonlab-wasm-bell-phi-plus-probe' : 'dummy-lanczos-demo',
      representation: 'state_vector',
      outputs: {
        energyLevels: coreProbeReady ? [coreProbe.entropy, coreProbe.purity] : [0, 0.5, 1],
        forceSamples: [0.1, 0.2, 0.1],
        basisProbabilities: coreProbeReady ? coreProbe.probabilities : [0.5, 0, 0, 0.5],
        bellState: coreProbeReady ? coreProbe.sample : 'placeholder'
      },
      uncertainty: {
        truncationError: coreProbeReady ? coreProbe.maxProbabilityError : 0,
        parityError: 0
      },
      validation: {
        status: coreProbeReady && coreProbe.maxProbabilityError <= 1e-9 ? 'pass' : 'warn',
        validationMode: coreProbeReady ? 'moonlab-wasm-self' : 'self'
      },
      runtime: {
        assetProbe,
        coreProbe
      },
      provenance: task.provenance
    };
  }
  return {
    closureId: `${task.rootTaskId}.closure`,
    sourceService: 'eshkol',
    closureKind: 'dummy-eos-table',
    inputs: task.inputs,
    outputs: task.outputs,
    execution: {
      mode: 'dummy-service-worker'
    },
    validity: {
      density: [0, 1],
      temperature: [0, 1]
    },
    uncertainty: {
      interpolationError: 0
    },
    validation: {
      status: 'pass',
      validationMode: 'self'
    },
    provenance: task.provenance
  };
}

function selectChildWorkerSpec(taskCapsule) {
  const coreProbeWorkerModule = manifest.entry.serviceAssets?.coreProbeWorkerModule;
  if (
    manifest.serviceId === 'moonlab'
    && taskCapsule.taskKind === 'moonlab.quantum.response'
    && assetProbe?.status === 'ready'
    && coreProbeWorkerModule
  ) {
    return {
      module: coreProbeWorkerModule,
      workerType: 'classic'
    };
  }

  return {
    module: manifest.childWorkers.allowedModules[0],
    workerType: 'module'
  };
}
