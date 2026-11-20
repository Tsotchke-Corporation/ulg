// A6: the derivation task a PeerCompute responder PAGE runs (browser client).
// The WASM services live in Web Workers owned by this page and created once
// (module scope), so they stay warm across tasks:
//   - MoonLab: /workers/moonlab-warm-webgpu.worker.js (MoonLab's moonlab.js +
//     moonlab.wasm with its WebGPU backend, from /service-assets/moonlab/);
//   - Eshkol: /workers/eshkol-warm-vm.worker.js (Eshkol's VM from
//     /service-assets/eshkol/vm/).
// The returned value is deterministic (replicas can be quorum-compared);
// residency evidence (page id, worker spawns, calls, timings) travels in the
// commit delta.
let moonlabWorker = null;
let eshkolWorker = null;
const spawns = { moonlab: 0, eshkol: 0 };
const calls = { moonlab: 0, eshkol: 0 };
let nextId = 1;

function request(worker, message, match) {
  return new Promise((resolve, reject) => {
    const onMessage = (event) => {
      const data = event.data ?? {};
      if (!match(data)) return;
      worker.removeEventListener('message', onMessage);
      resolve(data);
    };
    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', (error) => reject(new Error(String(error?.message ?? error))), { once: true });
    worker.postMessage(message);
  });
}

async function runMoonlab({ qubits = 12 } = {}) {
  if (!moonlabWorker) { moonlabWorker = new Worker('/workers/moonlab-warm-webgpu.worker.js'); spawns.moonlab += 1; }
  calls.moonlab += 1;
  const id = `ulg-a6-moonlab-${nextId++}`;
  const started = performance.now();
  const reply = await request(moonlabWorker, { id, type: 'ghz', qubits }, (data) => data.id === id);
  if (!reply.ok) throw new Error(`MoonLab: ${reply.error}`);
  return {
    elapsedMs: performance.now() - started,
    workerResidency: reply.residency,
    value: { schema: 'peercompute.ulg.client-quantum-response.v2', service: 'moonlab-wasm-webgpu-worker',
      circuit: `ghz-${qubits}`, dim: reply.dim, nonzero: reply.nonzero, probabilitySum: reply.probabilitySum }
  };
}

async function runEshkol({ operation = 'sample', threshold = null, definition, call, points, n, a, b }) {
  if (!eshkolWorker) { eshkolWorker = new Worker('/workers/eshkol-warm-vm.worker.js'); spawns.eshkol += 1; }
  calls.eshkol += 1;
  const id = `ulg-a6-eshkol-${nextId++}`;
  const started = performance.now();
  const message = operation === 'matmul-sum'
    ? { id, type: 'matmul-sum', threshold, n, a, b }
    : { id, type: 'sample', threshold, definition, call, points };
  const reply = await request(eshkolWorker, message, (data) => data.id === id);
  if (!reply.ok) throw new Error(`Eshkol: ${reply.error}`);
  const value = operation === 'matmul-sum'
    ? { schema: 'peercompute.ulg.client-tensor-result.v1', service: 'eshkol-vm-wasm-webgpu-worker', n,
        matmulSum: reply.matmulSum }
    : { schema: 'peercompute.ulg.client-closure-samples.v1', service: 'eshkol-vm-wasm-webgpu-worker', call, points,
        samples: reply.samples };
  return {
    elapsedMs: performance.now() - started,
    workerResidency: { ...reply.residency, gpuDispatches: reply.gpuDispatches ?? null },
    value
  };
}

export async function run({ service, scope = 'ulg-a6-client', ...data } = {}) {
  const result = service === 'eshkol' ? await runEshkol(data) : await runMoonlab(data);
  return {
    value: result.value,
    commitDelta: {
      taskId: `ulg-a6-client:${service}`,
      scope,
      version: calls[service] ?? 0,
      payload: { residency: { pageId: globalThis.__ulgA6PeerId ?? null, service, spawns: spawns[service],
        calls: calls[service], elapsedMs: result.elapsedMs, worker: result.workerResidency ?? null } }
    }
  };
}
