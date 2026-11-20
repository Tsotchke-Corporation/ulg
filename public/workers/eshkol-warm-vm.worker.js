// A6: Eshkol's WASM VM with its WebGPU compute backend, as a warm client
// service (classic Web Worker). Build: eshkol upstream/master site/static
// (eshkol-webgpu.js + eshkol-vm.js/.wasm; see /service-assets/eshkol/vm/SOURCE.txt).
// EshkolWebGPU.attachVm installs the VM's GPU imports as JSPI-suspending
// WebGPU dispatches (matmul, same-shape elementwise, full reductions; sf64
// exact precision by default), so tensor work above the backend threshold
// runs in WGSL on the GPU and everything else on the VM's CPU path. The VM is
// instantiated once per worker and reused for every request.
let vmPromise = null;
let printed = [];
let loads = 0;
let calls = 0;
let loadMs = null;
let gpu = null;
let webgpuStatus = null;

function loadVm(baseUrl, threshold) {
  if (!vmPromise) {
    vmPromise = (async () => {
      const started = performance.now();
      importScripts(`${baseUrl}eshkol-webgpu.js`, `${baseUrl}eshkol-vm.js`);
      // eslint-disable-next-line no-undef
      gpu = await EshkolWebGPU.create(threshold == null ? {} : { threshold });
      const arg = {
        print: (text) => printed.push(String(text)),
        printErr: (text) => printed.push(`ERR ${text}`),
        locateFile: (file) => `${baseUrl}${file}`
      };
      // eslint-disable-next-line no-undef
      EshkolWebGPU.attachVm(arg, gpu.ok ? gpu.backend : null, { wasmUrl: `${baseUrl}eshkol-vm.wasm` });
      webgpuStatus = { ...arg.eshkolWebGPUStatus, gpuReason: gpu.ok ? null : gpu.reason ?? null };
      // eslint-disable-next-line no-undef
      const vm = await EshkolVM(arg);
      // eslint-disable-next-line no-undef
      await EshkolWebGPU.vmCall(vm, 'repl_init');
      loads += 1;
      loadMs = performance.now() - started;
      return vm;
    })();
  }
  return vmPromise;
}

// The VM's stdout is line-buffered: print/printErr receive a line only when a
// newline flushes it, so displayed values are always followed by (newline).
// repl_eval's own string result is kept too (it is "" for these forms).
async function evaluate(vm, source) {
  printed = [];
  // eslint-disable-next-line no-undef
  const output = await EshkolWebGPU.vmCall(vm, 'repl_eval', source);
  const lines = printed.slice();
  if (typeof output === 'string' && output.length > 0) lines.push(...output.split('\n').filter((line) => line.length > 0));
  return lines;
}

const ERROR_LINE_PATTERN =
  /^(?:ERR\b|error\b|parse\s+error|syntax\s+error|runtime\s+error|type\s+error|compile\s+error|exception\b|undefined\b|unbound\b|unterminated\b|unexpected\b|invalid\b|failed\b)/i;
const NUMERIC_LINE_PATTERN =
  /^(?:=>\s*)?([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)$/;

function isErrorLine(line) {
  return ERROR_LINE_PATTERN.test(String(line ?? '').trim());
}

function assertBalancedSexp(source) {
  const text = String(source ?? '');
  let depth = 0;
  let inString = false;
  let inComment = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inComment) {
      if (ch === '\n') inComment = false;
      continue;
    }
    if (inString) {
      if (ch === '\\') { i += 1; continue; }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === ';') { inComment = true; continue; }
    if (ch === '"') { inString = true; continue; }
    if (ch === '#' && text[i + 1] === '\\') { i += 2; continue; }
    if (ch === '(' || ch === '[') depth += 1;
    else if (ch === ')' || ch === ']') {
      depth -= 1;
      if (depth < 0) throw new Error('Eshkol syntax error: unexpected closing parenthesis');
    }
  }
  if (inString) throw new Error('Eshkol syntax error: unterminated string literal');
  if (depth !== 0) throw new Error(`Eshkol syntax error: unbalanced parentheses (depth=${depth})`);
}

function lastNumber(lines) {
  if (!Array.isArray(lines) || lines.length === 0) return NaN;
  if (lines.some(isErrorLine)) return NaN;
  for (let i = lines.length - 1; i >= 0; i--) {
    const trimmed = String(lines[i] ?? '').trim();
    if (!trimmed) continue;
    const match = NUMERIC_LINE_PATTERN.exec(trimmed);
    if (!match) continue;
    const value = Number(match[1]);
    if (Number.isFinite(value)) return value;
  }
  return NaN;
}

function backendTelemetry() {
  const be = gpu?.ok ? gpu.backend : null;
  return be ? { active: Boolean(be.device), name: be.backendName?.() ?? null, precision: be.precision ?? null,
    threshold: be.threshold ?? null, dispatchCount: be.dispatchCount ?? 0, lastPath: be.lastPath ?? null,
    fallbackCount: be.fallbackCount ?? 0 } : null;
}

self.addEventListener('message', async (event) => {
  const { id, type, baseUrl = '/service-assets/eshkol/vm/', threshold = null } = event.data ?? {};
  try {
    const vm = await loadVm(baseUrl, threshold);
    calls += 1;
    let result;
    if (type === 'sample') {
      const { definition, call, points = [] } = event.data;
      assertBalancedSexp(definition);
      const definitionOutput = await evaluate(vm, definition);
      if (definitionOutput.some(isErrorLine)) throw new Error(definitionOutput.join(' '));
      const samples = [];
      for (const point of points) {
        const lines = await evaluate(vm, `(begin (display (${call} ${point.map((x) => Number(x).toPrecision(17)).join(' ')})) (newline))`);
        const value = lastNumber(lines);
        if (!Number.isFinite(value)) throw new Error(`Eshkol returned ${JSON.stringify(lines)}`);
        samples.push(value);
      }
      result = { samples };
    } else if (type === 'matmul-sum') {
      // Tensor work that reaches the WebGPU seam: sum(A B) for given n x n matrices.
      const { n, a, b } = event.data;
      const literal = (values) => `#(${values.map((x) => Number(x).toFixed(1)).join(' ')})`;
      const before = backendTelemetry()?.dispatchCount ?? 0;
      await evaluate(vm, `(define A (reshape ${literal(a)} ${n} ${n}))`);
      await evaluate(vm, `(define B (reshape ${literal(b)} ${n} ${n}))`);
      const lines = await evaluate(vm, '(begin (display (tensor-sum (matmul A B))) (newline))');
      const value = lastNumber(lines);
      if (!Number.isFinite(value)) throw new Error(`Eshkol returned ${JSON.stringify(lines)}`);
      result = { matmulSum: value, gpuDispatches: (backendTelemetry()?.dispatchCount ?? 0) - before };
    } else {
      return;
    }
    self.postMessage({ id, ok: true, ...result,
      residency: { loads, calls, loadMs, runtime: 'eshkol-vm-wasm-webgpu-worker', webgpuStatus, backend: backendTelemetry() } });
  } catch (error) {
    self.postMessage({ id, ok: false, error: String(error?.message ?? error) });
  }
});
