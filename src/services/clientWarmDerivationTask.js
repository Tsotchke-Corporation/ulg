// A6: the derivation task a PeerCompute responder PAGE runs (browser client).
// The WASM services live in Web Workers owned by this page and created once
// (module scope), so they stay warm across tasks:
//   - MoonLab: /workers/moonlab-warm-webgpu.worker.js (MoonLab's moonlab.js +
//     moonlab.wasm with its WebGPU backend, from /service-assets/moonlab/);
//   - Eshkol: /workers/eshkol-warm-vm.worker.js (Eshkol's VM from
//     /service-assets/eshkol/vm/).
//
// Requests to a given warm worker are serialized so module-scoped stdout
// buffers never interleave. Listener cleanup, bounded timeouts, and automatic
// worker termination + respawn on fatal errors/timeouts ensure worker crashes
// recover cleanly without stalling the physics loop.
const DEFAULT_TIMEOUT_MS = 30_000;
const WORKER_PATHS = Object.freeze({
  moonlab: './workers/moonlab-warm-webgpu.worker.js',
  eshkol: './workers/eshkol-warm-vm.worker.js'
});

function resolveWarmWorkerUrl(service) {
  const rel = WORKER_PATHS[service];
  const pageHref = globalThis.location?.href;
  if (typeof pageHref === 'string' && /^https?:/i.test(pageHref)) {
    try {
      return new URL(rel, pageHref).href;
    } catch {
      return rel;
    }
  }
  return rel;
}

const WARM_STATE_KEY = Symbol.for('ulg.a6.warmDerivationState');
const warmState = (globalThis[WARM_STATE_KEY] ??= {
  workers: { moonlab: null, eshkol: null },
  queues: { moonlab: Promise.resolve(), eshkol: Promise.resolve() },
  spawns: { moonlab: 0, eshkol: 0 },
  calls: { moonlab: 0, eshkol: 0 },
  failures: { moonlab: 0, eshkol: 0 },
  recoveries: { moonlab: 0, eshkol: 0 },
  nextId: 1
});
const { workers, queues, spawns, calls, failures, recoveries } = warmState;

function normalizeService(service) {
  return service === 'eshkol' ? 'eshkol' : 'moonlab';
}

function ensureWorker(service) {
  if (!workers[service]) {
    workers[service] = new Worker(resolveWarmWorkerUrl(service));
    spawns[service] += 1;
  }
  return workers[service];
}

/**
 * Terminate and clear a warm worker (used for teardown and crash-recovery
 * tests). The next call for `service` automatically spawns a fresh warm worker.
 */
export function terminateWarmWorker(service, { countRecovery = true } = {}) {
  const key = normalizeService(service);
  const existing = workers[key];
  workers[key] = null;
  if (existing) {
    try { existing.terminate(); } catch { /* Already terminated. */ }
    if (countRecovery) recoveries[key] += 1;
    return true;
  }
  return false;
}

/** Snapshot of warm-worker residency, failure, and recovery counters. */
export function getWarmDerivationResidency() {
  return Object.freeze({
    spawns: Object.freeze({ ...spawns }),
    calls: Object.freeze({ ...calls }),
    failures: Object.freeze({ ...failures }),
    recoveries: Object.freeze({ ...recoveries }),
    activeWorkers: Object.freeze({
      moonlab: workers.moonlab !== null,
      eshkol: workers.eshkol !== null
    })
  });
}

function requestWithRecovery(service, message, match, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const execute = () => new Promise((resolve, reject) => {
    let worker;
    try {
      worker = ensureWorker(service);
    } catch (error) {
      failures[service] += 1;
      reject(error);
      return;
    }
    let settled = false;
    let timer = null;
    const cleanup = () => {
      if (timer != null) { clearTimeout(timer); timer = null; }
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
    };
    const onMessage = (event) => {
      const data = event.data ?? {};
      if (!match(data)) return;
      if (settled) return;
      settled = true;
      cleanup();
      resolve(data);
    };
    const onError = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      failures[service] += 1;
      terminateWarmWorker(service, { countRecovery: true });
      reject(new Error(`A6 ${service} worker crashed: ${String(error?.message ?? error)}`));
    };
    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);
    if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
      timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        failures[service] += 1;
        terminateWarmWorker(service, { countRecovery: true });
        reject(new Error(`A6 ${service} worker timed out after ${timeoutMs} ms`));
      }, timeoutMs);
    }
    try {
      worker.postMessage(message);
    } catch (error) {
      settled = true;
      cleanup();
      failures[service] += 1;
      terminateWarmWorker(service, { countRecovery: true });
      reject(error);
    }
  });
  // Serialize requests to the same warm worker so stdout/context stay coherent,
  // while keeping the queue advancing even after a rejected call.
  const pending = queues[service].then(execute, execute);
  queues[service] = pending.then(() => {}, () => {});
  return pending;
}

async function runMoonlab({ qubits = 12, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  calls.moonlab += 1;
  const id = `ulg-a6-moonlab-${warmState.nextId++}`;
  const started = performance.now();
  const reply = await requestWithRecovery('moonlab', { id, type: 'ghz', qubits }, (data) => data.id === id, { timeoutMs });
  if (!reply.ok) {
    failures.moonlab += 1;
    throw new Error(`MoonLab: ${reply.error}`);
  }
  return {
    elapsedMs: performance.now() - started,
    workerResidency: reply.residency,
    value: {
      schema: 'peercompute.ulg.client-quantum-response.v2',
      service: 'moonlab-wasm-webgpu-worker',
      circuit: `ghz-${qubits}`,
      dim: reply.dim,
      nonzero: reply.nonzero,
      probabilitySum: reply.probabilitySum,
      nativeDispatches: reply.nativeDispatches ?? null,
      expectedDispatches: reply.expectedDispatches ?? (qubits + 1)
    }
  };
}

async function runEshkol({ operation = 'sample', threshold = null, definition, call, points, n, a, b, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  calls.eshkol += 1;
  const id = `ulg-a6-eshkol-${warmState.nextId++}`;
  const started = performance.now();
  const message = operation === 'matmul-sum'
    ? { id, type: 'matmul-sum', threshold, n, a, b }
    : { id, type: 'sample', threshold, definition, call, points };
  const reply = await requestWithRecovery('eshkol', message, (data) => data.id === id, { timeoutMs });
  if (!reply.ok) {
    failures.eshkol += 1;
    throw new Error(`Eshkol: ${reply.error}`);
  }
  const value = operation === 'matmul-sum'
    ? {
        schema: 'peercompute.ulg.client-tensor-result.v1',
        service: 'eshkol-vm-wasm-webgpu-worker',
        n,
        matmulSum: reply.matmulSum
      }
    : {
        schema: 'peercompute.ulg.client-closure-samples.v1',
        service: 'eshkol-vm-wasm-webgpu-worker',
        call,
        points,
        samples: reply.samples
      };
  return {
    elapsedMs: performance.now() - started,
    workerResidency: { ...reply.residency, gpuDispatches: reply.gpuDispatches ?? null },
    value
  };
}

export async function run({ service, scope = 'ulg-a6-client', ...data } = {}) {
  const key = normalizeService(service);
  const result = key === 'eshkol' ? await runEshkol(data) : await runMoonlab(data);
  return {
    value: result.value,
    commitDelta: {
      taskId: `ulg-a6-client:${key}`,
      scope,
      version: calls[key] ?? 0,
      payload: {
        residency: {
          pageId: globalThis.__ulgA6PeerId ?? null,
          service: key,
          spawns: spawns[key],
          calls: calls[key],
          failures: failures[key],
          recoveries: recoveries[key],
          elapsedMs: result.elapsedMs,
          worker: result.workerResidency ?? null
        }
      }
    }
  };
}

/** Direct sampler adapter for `deriveEosStiffnessResponse` backed by the warm Eshkol worker. */
export async function sampleEshkolWarm(definition, call, points, { threshold = null, timeoutMs = DEFAULT_TIMEOUT_MS, scope = 'ulg-a6-eos-stiffness' } = {}) {
  const response = await run({
    service: 'eshkol',
    operation: 'sample',
    scope,
    threshold,
    timeoutMs,
    definition,
    call,
    points
  });
  return response.value.samples;
}
