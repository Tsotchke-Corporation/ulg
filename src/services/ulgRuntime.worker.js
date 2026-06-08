import { createSimulationArtifact } from '../../ulg-gpu-abi/src/index.js';
import { createCarrierRuntime, createDefaultCarrierState } from '../runtime/carrierRuntime.js';
import { createClosureHandle } from '../runtime/closureHandle.js';

let workerId = null;
let manifest = null;
let heartbeat = null;
const activeTasks = new Map();

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
  const input = task.input || {};
  const closureArtifact = input.closureArtifact;
  if (!closureArtifact) {
    throw new Error('simulation.step task missing input.closureArtifact');
  }
  const closureHandle = createClosureHandle(closureArtifact);
  const runtime = createCarrierRuntime({
    closureHandle,
    dt: input.dt ?? 0.002,
    toleranceProfile: input.toleranceProfile || {
      name: 'toy-carrier-reference',
      energyAbs: 1e-3,
      momentumAbs: 1e-9
    }
  });
  const steps = input.steps ?? 64;
  const initialState = input.initialState || createDefaultCarrierState();
  const run = runtime.run(initialState, steps);
  if (record.cancelled) {
    return;
  }
  record.progress = 1;
  postStatus(record);
  const artifact = createSimulationArtifact({
    artifactId: `${task.rootTaskId}.simulation`,
    taskKind: task.taskKind,
    closureRef: input.closureRef,
    representation: 'carrier-toy',
    outputs: {
      deltas: run.deltas,
      invariants: run.invariants,
      invariantSeries: run.invariantSeries,
      finalState: run.finalState
    },
    execution: {
      backend: run.backend,
      gpuLeaseStatus: gpuLease?.status || null,
      dt: run.dt,
      steps: run.steps,
      integrator: run.integrator
    },
    validity: {
      status: 'toy-reference-valid',
      closureValidity: input.closureValidity || null,
      closureId: closureArtifact.closureId,
      closureKind: closureArtifact.closureKind
    },
    uncertainty: {
      modelScope: 'toy-two-particle-carrier-reference',
      calibratedPhysics: false
    },
    validation: {
      status: run.invariants.status,
      validationMode: 'cpu-reference-invariant-drift',
      scientificValidation: false,
      fullPhysicsValidation: false,
      blockers: ['toy-carrier-reference-not-scientific-physics']
    },
    provenance: {
      ...task.provenance,
      sourceService: 'ulg-runtime',
      parents: [input.closureRef],
      notes: [
        ...(task.provenance?.notes || []),
        'Consumed a cached table-interpolation closure with CPU reference carrier runtime.',
        'Toy oscillator only; no scientific or full-physics validation claim.'
      ]
    }
  });
  self.postMessage({
    type: 'task-result',
    rootTaskId: task.rootTaskId,
    result: { artifact }
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
