import { computeBufferBinding, createCachedExplicitBindGroup, prewarmCachedExplicitComputePipeline } from '../webgpuComputeLayout.js';
import { validateSphParticleExactMassRead, markSphExactMassDerivedBuffers } from './sphGpuBuffers.js';
import { createSphExactG2pQuantityWgsl, sphExactG2pQuantityProgram } from './sphExactG2pQuantityWgsl.js';

// Allocation, queue submission and output retirement belong to the genuine
// G2P producer. This helper cannot mint an output capture or particle owner.
export async function prepareSphExactG2pQuantities({ device, sourceRead, allocate }) {
  const validate = () => {
    if (!validateSphParticleExactMassRead(sourceRead, { device, sourceSphUpload: sourceRead.sourceSphUpload })
        || !sourceRead.quantities) throw new TypeError('Exact G2P requires its retained particle quantity owner');
  };
  validate();
  return prepareSphExactG2pNumericQuantities({ device, ...sourceRead.quantities,
    particleCount: sourceRead.particleCount, allocate, validate,
    markDerivedBuffers: buffers => markSphExactMassDerivedBuffers(sourceRead, buffers) });
}

// Numerical kernel shared by the original particle and residual producers.
// It confers no inventory, count, publication or producer authority. Each
// caller owns/pins its input tuple and supplies its original validation hook.
export async function prepareSphExactG2pNumericQuantities({ device, quantityBuffer: original,
  quantityLayout: layout, format, particleCount: count, allocate, validate,
  markDerivedBuffers, indirectDispatch = null }) {
  validate();
  const program = sphExactG2pQuantityProgram();
  const bytes = count * layout.recordWords * 4;
  const scratchBytes = count * program.registerCount * layout.scalar.recordWords * 4;
  const alignment = device.limits.minUniformBufferOffsetAlignment;
  const parameterBytes = Math.max(1, program.operations.length) * alignment;
  if (!Number.isSafeInteger(count) || count < 1 || layout.rowCount !== count || bytes !== original.size
      || !Number.isSafeInteger(scratchBytes) || scratchBytes > device.limits.maxStorageBufferBindingSize
      || Math.max(bytes, scratchBytes, parameterBytes) > device.limits.maxBufferSize
      || Math.ceil(count * 6 / 32) > device.limits.maxComputeWorkgroupsPerDimension) {
    throw new RangeError('Exact G2P quantities exceed the original carrier/device capacity');
  }
  if (indirectDispatch && ((indirectDispatch.buffer?.usage & 256) === 0
      || ![indirectDispatch.rowOffset, indirectDispatch.projectionOffset].every(offset =>
        Number.isSafeInteger(offset) && offset >= 0 && offset % 4 === 0
        && offset + 12 <= indirectDispatch.buffer.size))) {
    throw new RangeError('Exact G2P requires complete indirect row/projection dispatch ranges');
  }
  const quantityBuffer = allocate({ label: 'ulg-exact-g2p-quantities', size: bytes, usage: 128 | 4 | 8 });
  const scratch = allocate({ label: 'ulg-exact-g2p-scratch', size: scratchBytes, usage: 128 | 8 });
  const validationBuffer = allocate({ label: 'ulg-exact-g2p-validation', size: 16, usage: 128 | 4 | 8 });
  const projection = allocate({ label: 'ulg-exact-g2p-projections-and-increments', size: count * 48, usage: 128 | 8 | 4 });
  const params = allocate({ label: 'ulg-exact-g2p-params', size: 16, usage: 64 | 8 });
  const instructions = allocate({ label: 'ulg-exact-g2p-instructions', size: parameterBytes, usage: 64 | 8 });
  await markDerivedBuffers([quantityBuffer]);
  validate();
  const words = new Uint32Array(parameterBytes / 4);
  program.operations.forEach((op, i) => words.set([op.kind, op.left, op.right, op.out], i * alignment / 4));
  device.queue.writeBuffer(instructions, 0, words);
  device.queue.writeBuffer(params, 0, new Uint32Array([count, 0, 0, 0]));
  const pipelines = new Map();
  const descriptors = [
    { key: 'prepare', entryPoint: 'prepare_exact_g2p_quantities' },
    ...['add', 'subtract', 'multiply', 'divide'].map((name, kind) => ({ key: kind,
      entryPoint: 'execute_exact_g2p_quantity_op', label: `execute_exact_g2p_quantity_${name}`, kind })),
    { key: 'project', entryPoint: 'project_exact_g2p_quantities' },
    { key: 'apply', entryPoint: 'apply_exact_g2p_quantities' }
  ];
  // Each immutable instruction selects its own arithmetic pipeline. A runtime
  // switch combines four wide call graphs and excessive private storage.
  for (const { key, entryPoint, label = entryPoint, kind = null } of descriptors) {
    const code = createSphExactG2pQuantityWgsl(format, layout, program, kind);
    const pipeline = await prewarmCachedExplicitComputePipeline(device, { code, entryPoint,
      label: `ulg-${label}`, cacheKey: `${label}-v3-${format.wordCount}-${format.quantumExponent}-${layout.scalar.wordCount}`,
      bindings: ['read-only-storage', 'read-only-storage', 'read-only-storage', 'storage', 'storage',
        'storage', 'storage', 'storage', 'uniform', 'uniform', 'storage']
        .map((type, binding) => computeBufferBinding(binding, type)) });
    if (!pipeline.pipeline) throw pipeline.error ?? new Error(`Exact G2P pipeline unavailable: ${entryPoint}`);
    validate(); pipelines.set(key, pipeline);
  }
  return { quantityBuffer, quantityLayout: layout, format, validationBuffer, original, projectionBuffer: projection,
    transientBuffers: [scratch, params, instructions],
    encode(encoder, { stateBuffer, mechanicsBuffer, outStateBuffer, outMechanicsBuffer }) {
      validate(); encoder.clearBuffer(validationBuffer); encoder.clearBuffer(quantityBuffer);
      const resources = [original, stateBuffer, mechanicsBuffer, outStateBuffer, outMechanicsBuffer,
        quantityBuffer, scratch, validationBuffer, params, instructions, projection];
      const dispatch = (key, offset, groups) => {
        const pipeline = pipelines.get(key);
        const group = createCachedExplicitBindGroup(device, { layout: pipeline.bindGroupLayout,
          entries: resources.map((buffer, binding) => ({ binding, resource: binding === 9
            ? { buffer, offset, size: 16 } : { buffer } })) });
        const pass = encoder.beginComputePass(); pass.setPipeline(pipeline.pipeline);
        pass.setBindGroup(0, group);
        if (indirectDispatch) pass.dispatchWorkgroupsIndirect(indirectDispatch.buffer,
          key === 'project' ? indirectDispatch.projectionOffset : indirectDispatch.rowOffset);
        else pass.dispatchWorkgroups(groups);
        pass.end();
      };
      dispatch('prepare', 0, Math.ceil(count / 32));
      program.operations.forEach((op, i) => dispatch(op.kind, i * alignment, Math.ceil(count / 32)));
      dispatch('project', 0, Math.ceil(count * 6 / 32));
      dispatch('apply', 0, Math.ceil(count / 32));
    }
  };
}
