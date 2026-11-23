// A6: MoonLab's WASM core with its WebGPU backend, as a warm client service
// (classic Web Worker). Build: /service-assets/moonlab/moonlab.js + .wasm
// (exports the gpu_* compute API; gpu_webgpu.c dispatches complex64 WGSL
// kernels through Asyncify when the browser has WebGPU). The module and its
// GPU context are created once per worker and reused for every request.
// A request runs a GHZ circuit (H on qubit 0, then CNOT 0 -> i) on a GPU
// state buffer and reads the probabilities back; gpu_is_native_accelerated
// reports whether the WebGPU kernels (not the CPU fallback) executed.
const GPU_BACKEND_WEBGPU = 2;
let modulePromise = null;
let context = 0;
let loads = 0;
let calls = 0;
let loadMs = null;

function absolute(path) { return new URL(path, self.location.href).href; }

function load() {
  if (!modulePromise) {
    modulePromise = (async () => {
      const started = performance.now();
      // The first requestAdapter() in a fresh GPU process can resolve null;
      // MoonLab's init then returns 0 and that dispatch runs on the CPU. Wait
      // for an adapter first so every gate dispatch takes the WGSL path.
      for (let attempt = 0; attempt < 20 && navigator.gpu; attempt++) {
        if (await navigator.gpu.requestAdapter()) break;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      importScripts(absolute('../service-assets/moonlab/moonlab.js'));
      const module = await globalThis.MoonlabModule({
        locateFile: (path) => (path.endsWith('.wasm') ? absolute('../service-assets/moonlab/moonlab.wasm') : path)
      });
      context = await module.ccall('gpu_compute_init', 'number', ['number'], [GPU_BACKEND_WEBGPU], { async: true });
      if (!context) throw new Error('gpu_compute_init(WEBGPU) returned null');
      loads += 1;
      loadMs = performance.now() - started;
      return module;
    })();
  }
  return modulePromise;
}

const call = (module, name, types, args) => module.ccall(name, 'number', types, args, { async: true });

async function ghz(module, qubits) {
  const dim = 2 ** qubits;
  const bytes = dim * 16; // double complex host amplitudes
  const host = module._malloc(bytes);
  const amplitudes = new Float64Array(module.HEAPF64.buffer, host, dim * 2);
  amplitudes.fill(0);
  amplitudes[0] = 1;
  const state = await call(module, 'gpu_buffer_create_from_data', ['number', 'number', 'number'], [context, host, bytes]);
  const probabilitiesBuffer = await call(module, 'gpu_buffer_create', ['number', 'number'], [context, dim * 8]);
  const out = module._malloc(dim * 8);
  try {
    if (!state || !probabilitiesBuffer) throw new Error('gpu_buffer_create failed');
    let error = await call(module, 'gpu_hadamard_u32', ['number', 'number', 'number', 'number'], [context, state, 0, dim]);
    for (let target = 1; target < qubits && error === 0; target++) {
      error = await call(module, 'gpu_cnot_u32', ['number', 'number', 'number', 'number', 'number'],
        [context, state, 0, target, dim]);
    }
    if (error === 0) {
      error = await call(module, 'gpu_compute_probabilities_u32', ['number', 'number', 'number', 'number'],
        [context, state, probabilitiesBuffer, dim]);
    }
    if (error === 0) {
      error = await call(module, 'gpu_buffer_read', ['number', 'number', 'number', 'number'],
        [probabilitiesBuffer, out, dim * 8, 0]);
    }
    if (error !== 0) throw new Error(`MoonLab GPU error ${error}`);
    const probabilities = Array.from(new Float64Array(module.HEAPF64.buffer, out, dim));
    const nonzero = probabilities.map((p, index) => [index, p]).filter(([, p]) => p > 1e-12);
    return { dim, nonzero, probabilitySum: probabilities.reduce((a, b) => a + b, 0) };
  } finally {
    module._free(out);
    module._free(host);
    if (state) module._gpu_buffer_free?.(state);
    if (probabilitiesBuffer) module._gpu_buffer_free?.(probabilitiesBuffer);
  }
}

self.addEventListener('message', async (event) => {
  const { id, type, qubits = 12 } = event.data ?? {};
  if (type !== 'ghz') return;
  try {
    const module = await load();
    calls += 1;
    const dispatchesBefore = module.__moonlabWebGPU?.nativeDispatches ?? 0;
    const result = await ghz(module, qubits);
    // H + (qubits - 1) CNOT + probabilities, each a WGSL dispatch when native.
    result.nativeDispatches = (module.__moonlabWebGPU?.nativeDispatches ?? 0) - dispatchesBefore;
    result.expectedDispatches = qubits + 1;
    self.postMessage({ id, ok: true, ...result, residency: { loads, calls, loadMs,
      runtime: 'moonlab-wasm-webgpu-worker',
      backendType: module._gpu_get_backend_type?.(context) ?? null,
      nativeAccelerated: module._gpu_is_native_accelerated?.(context) ?? null,
      webgpuAvailable: module._gpu_webgpu_available?.() ?? null,
      webgpuInitError: module.__moonlabWebGPU?.lastInitError ?? null,
      webgpuDispatchError: module.__moonlabWebGPU?.lastDispatchError ?? null } });
  } catch (error) {
    self.postMessage({ id, ok: false, error: String(error?.message ?? error) });
  }
});
