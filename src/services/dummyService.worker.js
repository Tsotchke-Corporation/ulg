import { probeManifestServiceAssets } from '../runtime/ServiceAssetProbe.js';

let workerId = null;
let manifest = null;
let heartbeat = null;
let assetProbe = null;
let initPromise = null;
let serviceBundleArtifact = null;
let serviceBundleManifest = null;
let serviceBundleStatus = 'skipped';
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
  await loadServiceBundleAssets();
  heartbeat = setInterval(sendHeartbeat, 500);
  self.postMessage({ type: 'ready', workerId, serviceId: manifest.serviceId, assetProbe });
}

async function loadServiceBundleAssets() {
  const serviceAssets = manifest?.entry?.serviceAssets ?? {};
  if (!serviceAssets.artifactModule || assetProbe?.status !== 'ready' || typeof self.fetch !== 'function') {
    serviceBundleStatus = serviceAssets.artifactModule ? 'unavailable' : 'skipped';
    return;
  }
  try {
    const artifactUrl = new URL(serviceAssets.artifactModule, self.location?.href).href;
    const artifactResponse = await self.fetch(artifactUrl, { cache: 'no-store' });
    if (!artifactResponse.ok) {
      serviceBundleStatus = 'missing-artifact';
      return;
    }
    serviceBundleArtifact = await artifactResponse.json();
    if (serviceAssets.bundleManifest) {
      const manifestUrl = new URL(serviceAssets.bundleManifest, self.location?.href).href;
      const manifestResponse = await self.fetch(manifestUrl, { cache: 'no-store' });
      if (manifestResponse.ok) {
        serviceBundleManifest = await manifestResponse.json();
      }
    }
    serviceBundleStatus = 'ready';
    assetProbe = {
      ...assetProbe,
      bundleArtifact: {
        status: serviceBundleStatus,
        artifactModule: serviceAssets.artifactModule,
        bundleManifest: serviceAssets.bundleManifest ?? null,
        closureId: serviceBundleArtifact.closureId ?? null,
        closureKind: serviceBundleArtifact.closureKind ?? null,
        moduleUrl: serviceBundleArtifact.execution?.module?.url ?? null
      }
    };
  } catch (error) {
    serviceBundleStatus = 'error';
    assetProbe = {
      ...assetProbe,
      bundleArtifact: {
        status: serviceBundleStatus,
        error: error instanceof Error ? error.message : String(error)
      }
    };
  }
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
      assetProbe,
      serviceBundleStatus
    }
  });
}

function createArtifact(task) {
  if (manifest.serviceId === 'moonlab') {
    const coreProbe = task.coreProbe ?? null;
    const coreProbeReady = coreProbe?.status === 'ready';
    const magnetarDipoleIsing = coreProbe?.magnetarDipoleIsing ?? null;
    const magnetarReference = magnetarDipoleIsing?.reference ?? null;
    const magnetarReferences = Array.isArray(magnetarDipoleIsing?.references)
      ? magnetarDipoleIsing.references.filter((reference) => (
        reference != null && typeof reference === 'object' && !Array.isArray(reference)
      ))
      : [];
    const webGpuParityScope = coreProbe?.webGpuParityScope?.artifact ?? null;
    const webGpuParityHandoffSummary = coreProbe?.webGpuParityHandoffSummary?.artifact ?? null;
    const magnetarOutputReferenceCount = (magnetarReference ? 1 : 0) + magnetarReferences.length;
    const magnetarReady = magnetarDipoleIsing?.validation?.status === 'pass'
      && magnetarDipoleIsing?.parity?.status === 'pass';
    return {
      artifactId: `${task.rootTaskId}.quantum-response`,
      sourceService: 'moonlab',
      taskKind: 'quantum.response',
      inputHash: task.inputHash,
      method: coreProbeReady ? 'moonlab-wasm-bell-phi-plus-probe' : 'dummy-lanczos-demo',
      representation: 'state_vector',
      responseDescriptor: coreProbeReady ? coreProbe.responseDescriptor : createFallbackQuantumResponseDescriptor(),
      outputs: {
        energyLevels: coreProbeReady ? [coreProbe.entropy, coreProbe.purity] : [0, 0.5, 1],
        forceSamples: [0.1, 0.2, 0.1],
        basisProbabilities: coreProbeReady ? coreProbe.probabilities : [0.5, 0, 0, 0.5],
        bellState: coreProbeReady ? coreProbe.sample : 'placeholder',
        reference: magnetarReference,
        references: magnetarReferences,
        magnetarDipoleIsing: magnetarDipoleIsing?.summary ?? null
      },
      calibrationArtifacts: magnetarDipoleIsing ? {
        magnetarDipoleIsing
      } : {},
      webGpuParityScope,
      webGpuParityHandoffSummary,
      uncertainty: {
        truncationError: coreProbeReady ? coreProbe.maxProbabilityError : 0,
        parityError: coreProbeReady ? coreProbe.parity?.metrics?.maxProbabilityError ?? 0 : 0,
        magnetarEnergyTolerance: magnetarDipoleIsing?.parity?.tolerance ?? null
      },
      parity: coreProbeReady ? coreProbe.parity : createFallbackQuantumParityReport(),
      validationMetrics: {
        maxProbabilityError: coreProbeReady ? coreProbe.maxProbabilityError : 0,
        normalizationDelta: coreProbeReady ? coreProbe.parity?.metrics?.normalizationDelta ?? 0 : 0,
        unsupportedParityModeCount: coreProbeReady ? coreProbe.parity?.metrics?.unsupportedModeCount ?? 0 : 1,
        magnetarMaxEnergyDelta: magnetarDipoleIsing?.summary?.maxEnergyDelta ?? null,
        magnetarEvaluatedBitstrings: magnetarDipoleIsing?.summary?.evaluatedBitstrings ?? 0,
        outputReferenceCount: magnetarOutputReferenceCount,
        magnetarCalibratedReferenceCount: magnetarReferences.length,
        magnetarCalibratedReferenceReadyCount: magnetarReferences.filter((reference) => reference.ready === true).length,
        calibrationArtifactCount: magnetarDipoleIsing ? 1 : 0,
        webGpuParityScopeReady: coreProbe?.webGpuParityScope?.status === 'ready',
        webGpuParityScopeBackendAvailable: webGpuParityScope?.backendAvailable ?? null,
        webGpuParityExecuted: webGpuParityScope?.webgpuParity?.executed ?? null,
        webGpuParityBlockerCount: Array.isArray(webGpuParityScope?.blockers) ? webGpuParityScope.blockers.length : 0,
        webGpuParityHandoffSummaryReady: coreProbe?.webGpuParityHandoffSummary?.status === 'ready',
        webGpuParityHandoffSummaryRuntimeBackendReady: webGpuParityHandoffSummary?.runtimeBackendReady ?? null,
        webGpuParityHandoffSummaryReducedFixtureReady:
          webGpuParityHandoffSummary?.reducedFixtureWebGpuParityReady ?? null
      },
      validation: {
        status: coreProbeReady && coreProbe.maxProbabilityError <= 1e-9 && (!magnetarDipoleIsing || magnetarReady) ? 'pass' : 'warn',
        validationMode: coreProbeReady ? 'moonlab-wasm-analytic-parity' : 'self'
      },
      runtime: {
        assetProbe,
        coreProbe
      },
      provenance: task.provenance
    };
  }
  if (manifest.serviceId === 'eshkol' && serviceBundleArtifact) {
    return {
      ...serviceBundleArtifact,
      sourceService: serviceBundleArtifact.sourceService || 'eshkol',
      taskKind: task.taskKind,
      inputHash: task.inputHash,
      validation: {
        ...(serviceBundleArtifact.validation || {}),
        status: serviceBundleArtifact.validation?.status || 'pass',
        validationMode: serviceBundleArtifact.validation?.validationMode || 'eshkol-static-closure-bundle'
      },
      runtime: {
        assetProbe,
        bundleManifest: serviceBundleManifest ? {
          schema: serviceBundleManifest.schema || null,
          copyFiles: serviceBundleManifest.manualDeploy?.copyFiles || [],
          hostImports: serviceBundleManifest.hostImports ? {
            path: serviceBundleManifest.hostImports.path || null,
            sha256: serviceBundleManifest.hostImports.sha256 || null,
            factory: serviceBundleManifest.hostImports.factory || null,
            global: serviceBundleManifest.hostImports.global || null,
            domFree: serviceBundleManifest.hostImports.domFree === true
          } : null,
          preserveRelativeUrls: serviceBundleManifest.manualDeploy?.preserveRelativeUrls === true
        } : null
      },
      taskProvenance: task.provenance,
      provenance: serviceBundleArtifact.provenance || task.provenance
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

function createFallbackQuantumResponseDescriptor() {
  return {
    schema: 'peercompute.ulg.quantum-response-descriptor.v0',
    sample: 'placeholder',
    qubitCount: 2,
    basis: {
      kind: 'computational',
      ordering: 'little-endian-basis-index',
      states: ['00', '01', '10', '11']
    },
    representation: {
      state: 'state_vector',
      amplitudeDType: 'complex64',
      probabilityDType: 'f64',
      probabilityLayout: 'basis-index-vector'
    },
    deterministic: false,
    expectedProbabilities: [0.5, 0, 0, 0.5],
    observedProbabilities: [0.5, 0, 0, 0.5],
    invariants: {
      probabilitySum: 1,
      normalizationDelta: 0,
      purity: null,
      entropy: null
    }
  };
}

function createFallbackQuantumParityReport() {
  return {
    schema: 'peercompute.ulg.quantum-response-parity.v0',
    sample: 'placeholder',
    status: 'warn',
    tolerance: 1e-9,
    reference: {
      mode: 'placeholder-reference',
      probabilities: [0.5, 0, 0, 0.5]
    },
    comparisons: [
      {
        mode: 'moonlab-wasm-core',
        status: 'unsupported',
        reason: 'moonlab-assets-unavailable',
        maxProbabilityError: null
      },
      {
        mode: 'moonlab-webgpu',
        status: 'unsupported',
        reason: 'moonlab-webgpu-response-kernel-unavailable',
        maxProbabilityError: null
      }
    ],
    metrics: {
      maxProbabilityError: 0,
      normalizationDelta: 0,
      parityGap: null,
      unsupportedModeCount: 2
    }
  };
}
