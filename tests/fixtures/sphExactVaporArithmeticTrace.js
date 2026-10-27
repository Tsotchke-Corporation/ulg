import { sphExactVaporAerosolProgram } from '../../src/runtime/sph/sphExactVaporAerosolQuantitiesGpu.js';

// Diagnostic only. Insert read-only copies before private scratch is reused;
// the original arithmetic, bindings and publication decisions are unchanged.
// Extra inspection dispatches mean this run is not acceptance evidence.
export async function traceExactVaporArithmetic(device, work, { edgeCount, retainedWordCount }) {
  const original = { createBuffer: device.createBuffer, createCommandEncoder: device.createCommandEncoder,
    submit: device.queue.submit };
  const scratch = new Set(), snapshots = [], resources = [];
  const module = device.createShaderModule({ code: `
    @group(0) @binding(0) var<storage, read> source: array<u32>;
    @group(0) @binding(1) var<storage, read_write> output: array<u32>;
    @compute @workgroup_size(64)
    fn copy_words(@builtin(global_invocation_id) id: vec3<u32>) {
      if (id.x < arrayLength(&source)) { output[id.x] = source[id.x]; }
    }` });
  const pipeline = await device.createComputePipelineAsync({ label: 'diagnostic-vapor-scratch-copy',
    layout: 'auto', compute: { module, entryPoint: 'copy_words' } });
  const snapshot = (encoder, source) => {
    const output = original.createBuffer.call(device, { size: source.size, usage: 128 | 4 });
    const staging = original.createBuffer.call(device, { size: source.size, usage: 1 | 8 });
    resources.push(output, staging);
    const group = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [
      { binding: 0, resource: { buffer: source } }, { binding: 1, resource: { buffer: output } }
    ] });
    const pass = encoder.beginComputePass(); pass.setPipeline(pipeline); pass.setBindGroup(0, group);
    pass.dispatchWorkgroups(Math.ceil(source.size / 256)); pass.end();
    encoder.copyBufferToBuffer(output, 0, staging, 0, source.size);
    snapshots.push({ label: source.label, staging });
  };
  device.createBuffer = descriptor => {
    const buffer = original.createBuffer.call(device, descriptor);
    if (/^ulg-vapor-aerosol-exchange-(midpoint-)?exact-scratch$/.test(descriptor.label ?? '')) scratch.add(buffer);
    return buffer;
  };
  device.createCommandEncoder = descriptor => {
    const encoder = original.createCommandEncoder.call(device, descriptor);
    const clear = encoder.clearBuffer.bind(encoder);
    encoder.clearBuffer = (buffer, ...args) => {
      if (scratch.has(buffer)) snapshot(encoder, buffer);
      return clear(buffer, ...args);
    };
    return encoder;
  };
  let captured = false;
  device.queue.submit = commands => {
    if (!scratch.size || captured) return original.submit.call(device.queue, commands);
    captured = true;
    const encoder = original.createCommandEncoder.call(device);
    for (const buffer of scratch) snapshot(encoder, buffer);
    return original.submit.call(device.queue, [...commands, encoder.finish()]);
  };
  try {
    const result = await work();
    const failed = [], retainedEndpointOverflows = [];
    let scalar;
    for (const [index, { label, staging }] of snapshots.entries()) {
      await staging.mapAsync(1);
      const words = new Uint32Array(staging.getMappedRange()).slice(); staging.unmap();
      const program = sphExactVaporAerosolProgram({ shared: true, cellPressureWork: true,
        integrateRates: true, midpointDonors: !label.includes('midpoint-') });
      const recordWords = words.length / (edgeCount * program.registers);
      const wordCount = (recordWords - 4) / 2;
      if (!Number.isInteger(wordCount) || wordCount <= 0) throw new Error('Invalid diagnostic scalar width');
      if (scalar && scalar.wordCount !== wordCount) throw new Error('Mixed diagnostic scalar widths');
      scalar = { wordCount, recordWords, headerWords: 4, numeratorOffsetWords: 4, denominatorOffsetWords: 4 + wordCount };
      if (words.length !== edgeCount * program.registers * scalar.recordWords) throw new Error('Diagnostic layout mismatch');
      const row = (edge, slot) => words.slice((edge * program.registers + slot) * scalar.recordWords,
        (edge * program.registers + slot + 1) * scalar.recordWords);
      const bits = values => {
        for (let i = values.length - 1; i >= 0; i--) if (values[i]) return i * 32 + 32 - Math.clz32(values[i]);
        return 0;
      };
      for (let edge = 0; edge < edgeCount; edge++) for (const [endpoint, slots] of [program.gas, program.liquid].entries()) {
        for (let field = 1; field < slots.length; field++) {
          const value = row(edge, slots[field]);
          const numeratorBits = bits(value.slice(4, 4 + wordCount));
          const denominatorBits = bits(value.slice(4 + wordCount));
          if (!value[1] && Math.max(numeratorBits, denominatorBits) > retainedWordCount * 32) {
            retainedEndpointOverflows.push({ snapshot: index, label, edge, endpoint, field,
              slot: slots[field], numeratorBits, denominatorBits, retainedCapacityBits: retainedWordCount * 32,
              value: [...value] });
          }
        }
      }
      for (let edge = 0; edge < edgeCount; edge++) for (let slot = 0; slot < program.registers; slot++) {
        const value = row(edge, slot);
        if (!value[1]) continue;
        const operation = program.operations.find(op => op[3] === slot);
        failed.push({ snapshot: index, label, edge, slot, error: value[1], operation,
          operands: operation ? [row(edge, operation[1]), row(edge, operation[2])].map(v => [...v]) : null });
      }
    }
    await globalThis.recordExactPlacementProgress?.({ phase: 'vapor-arithmetic-diagnostic',
      scalar, snapshotCount: snapshots.length, failed, retainedEndpointOverflows });
    return result;
  } finally {
    device.createBuffer = original.createBuffer; device.createCommandEncoder = original.createCommandEncoder;
    device.queue.submit = original.submit;
    await device.queue.onSubmittedWorkDone().catch(() => {});
    for (const buffer of resources) buffer.destroy();
  }
}
