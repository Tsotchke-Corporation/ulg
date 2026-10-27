// Diagnostic only: replay the actual recorded GPU operations with a fence at
// each pass boundary. This changes submission boundaries and cannot establish
// correctness of the original single-submission transaction.

// Storage-only production buffers cannot be copied directly. This diagnostic
// reads their unchanged u32 words through a storage binding into a copyable
// buffer; it neither changes production usage flags nor writes the source.
async function readNativeBufferWords(device, source, { offset = 0, size = source.size, uniform = false } = {}) {
  if (!(source.usage & (uniform ? 64 : 128)) || size % (uniform ? 16 : 4) !== 0) throw new Error('Invalid diagnostic buffer binding');
  const output = device.createBuffer({ label: 'diagnostic-buffer-words', size, usage: 128 | 4 });
  const staging = device.createBuffer({ label: 'diagnostic-buffer-readback', size, usage: 1 | 8 });
  let scopeOpen = false;
  try {
    device.pushErrorScope('validation'); scopeOpen = true;
    const module = device.createShaderModule({ code: `
      ${uniform ? `struct Source { words: array<vec4<u32>, ${size / 16}> };
      @group(0) @binding(0) var<uniform> source: Source;`
        : '@group(0) @binding(0) var<storage, read> source: array<u32>;'}
      @group(0) @binding(1) var<storage, read_write> destination: array<u32>;
      @compute @workgroup_size(64)
      fn inspect_words(@builtin(global_invocation_id) id: vec3<u32>) {
        if (id.x < ${size / 4}u) { destination[id.x] = ${uniform ? 'source.words[id.x / 4u][id.x % 4u]' : 'source[id.x]'}; }
      }` });
    const pipeline = await device.createComputePipelineAsync({ label: 'diagnostic-storage-read',
      layout: 'auto', compute: { module, entryPoint: 'inspect_words' } });
    const group = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [
      { binding: 0, resource: { buffer: source, offset, size } }, { binding: 1, resource: { buffer: output } }
    ] });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass(); pass.setPipeline(pipeline); pass.setBindGroup(0, group);
    pass.dispatchWorkgroups(Math.ceil(size / 256)); pass.end();
    encoder.copyBufferToBuffer(output, 0, staging, 0, size);
    device.queue.submit([encoder.finish()]);
    scopeOpen = false;
    const error = await device.popErrorScope();
    if (error) throw new Error(`Diagnostic storage readback: ${error.message}`);
    await staging.mapAsync(1);
    const words = new Uint32Array(staging.getMappedRange()).slice(); staging.unmap(); return words;
  } finally {
    if (scopeOpen) await device.popErrorScope().catch(() => {});
    output.destroy(); staging.destroy();
  }
}

export const readSphNativeStorageWords = (device, source) => readNativeBufferWords(device, source);
export const readSphNativeUniformWords = (device, { buffer, offset, size }) =>
  readNativeBufferWords(device, buffer, { offset, size, uniform: true });

// Diagnose a sequence of original producers without changing their bindings
// or arithmetic. Each recorded pass gets a real submission/fence. Results from
// this wrapper are diagnostic replay, never original-submission acceptance.
export async function withSphNativeSubmissionTrace(device, work, { splitDispatches = false } = {}) {
  const original = { create: device.createCommandEncoder, submit: device.queue.submit,
    done: device.queue.onSubmittedWorkDone };
  const native = { createCommandEncoder: original.create.bind(device),
    pushErrorScope: device.pushErrorScope.bind(device), popErrorScope: device.popErrorScope.bind(device),
    queue: { submit: original.submit.bind(device.queue), onSubmittedWorkDone: original.done.bind(device.queue) } };
  let pending = Promise.resolve(), submission = 0;
  device.createCommandEncoder = () => {
    const trace = createSphNativePassTrace({ splitDispatches });
    return { ...trace.encoder, finish: () => trace };
  };
  device.queue.submit = commands => {
    for (const trace of commands) {
      const current = submission++;
      pending = pending.then(() => trace.submit(native, detail => console.log('exact-routing-progress',
        JSON.stringify({ phase: 'carried-submission-trace', submission: current, ...detail })), () => {}));
      void pending.catch(() => {});
    }
  };
  device.queue.onSubmittedWorkDone = () => pending;
  try { const result = await work(); await pending; return result; }
  finally {
    device.createCommandEncoder = original.create; device.queue.submit = original.submit;
    device.queue.onSubmittedWorkDone = original.done;
  }
}

export function createSphNativePassTrace({ splitDispatches = false } = {}) {
  const blocks = [], copies = [];
  let openPass = false, consumed = false;
  const copyArgs = args => args.map(value => ArrayBuffer.isView(value) ? value.slice()
    : Array.isArray(value) ? [...value] : value);
  const encoder = {
    finish() { throw new Error('A diagnostic pass trace is not a single command buffer'); },
    clearBuffer(...args) { copies.push(['clearBuffer', args]); },
    copyBufferToBuffer(...args) { copies.push(['copyBufferToBuffer', args]); },
    beginComputePass(descriptor = {}) {
      if (openPass || consumed) throw new Error('Invalid diagnostic recorder state');
      openPass = true;
      const calls = [];
      let pipeline;
      return {
        setPipeline(value) { pipeline = value; calls.push(['setPipeline', [value]]); },
        setBindGroup(...args) { calls.push(['setBindGroup', copyArgs(args)]); },
        dispatchWorkgroups(...args) { calls.push(['dispatchWorkgroups', args]); },
        dispatchWorkgroupsIndirect(...args) { calls.push(['dispatchWorkgroupsIndirect', args]); },
        end() {
          if (!openPass) throw new Error('Diagnostic pass already ended');
          openPass = false;
          if (splitDispatches) {
            // Replay the unchanged binding state before each dispatch. This
            // diagnostic adds fences; it cannot prove the original batch.
            const state = [];
            let currentPipeline;
            for (const call of calls) {
              if (call[0] === 'setPipeline') currentPipeline = call[1][0];
              if (call[0].startsWith('dispatchWorkgroups')) {
                blocks.push({ descriptor, calls: [...state, call], copies: copies.splice(0),
                  label: currentPipeline?.label || descriptor.label || 'unlabeled' });
              } else state.push(call);
            }
          } else {
            blocks.push({ descriptor, calls, copies: copies.splice(0),
              label: descriptor.label || pipeline?.label || 'unlabeled' });
          }
        }
      };
    }
  };
  return {
    encoder,
    async submit(device, onProgress, onSubmitted, beforePass = async () => {}) {
      if (openPass || consumed) throw new Error('Diagnostic recording is incomplete or consumed');
      consumed = true;
      if (copies.length) blocks.push({ copies: copies.splice(0), label: 'final-copies' });
      for (const [index, block] of blocks.entries()) {
        const dispatches = (block.calls ?? []).filter(([method]) => method === 'dispatchWorkgroups').map(([, args]) => args);
        const recreation = await beforePass({ index, label: block.label, dispatches });
        const recreatedBindGroup = recreation?.bindGroup, recreatedPipeline = recreation?.pipeline;
        device.pushErrorScope('validation');
        const actual = device.createCommandEncoder({ label: `diagnostic-pass-${index}` });
        for (const [method, args] of block.copies) actual[method](...args);
        if (block.calls) {
          const pass = actual.beginComputePass(block.descriptor);
          for (const [method, args] of block.calls) {
            const actualArgs = recreatedPipeline && method === 'setPipeline' ? [recreatedPipeline]
              : recreatedBindGroup && method === 'setBindGroup' && args[0] === 0
                ? [args[0], recreatedBindGroup, ...args.slice(2)]
                : recreation?.dispatch && method === 'dispatchWorkgroups' ? recreation.dispatch : args;
            pass[method](...actualArgs);
          }
          pass.end();
        }
        const started = performance.now();
        onProgress({ phase: 'diagnostic-pass-submit', index, count: blocks.length, label: block.label, dispatches,
          diagnosticDispatch: recreation?.dispatch ?? null,
          recreatedBindGroup: !!recreatedBindGroup, recreatedPipeline: !!recreatedPipeline });
        device.queue.submit([actual.finish()]); onSubmitted();
        const validation = await device.popErrorScope();
        if (validation) throw new Error(`Diagnostic pass ${index} (${block.label}) validation: ${validation.message}`);
        onProgress({ phase: 'diagnostic-pass-validated', index, label: block.label });
        if (recreation?.completion) await recreation.completion();
        else await device.queue.onSubmittedWorkDone();
        onProgress({ phase: 'diagnostic-pass-completed', index, label: block.label,
          elapsedMs: performance.now() - started });
        await recreation?.afterPass?.();
      }
    }
  };
}
