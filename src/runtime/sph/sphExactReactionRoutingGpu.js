import { acquireSphExactReactionSourceSelectionRead } from './sphExactReactionSourceGpu.js';
import { createSphExactReactionRoutingWgsl, sphExactReactionRoutingLayout }
  from './sphExactReactionRoutingWgsl.js';
import { computeBufferBinding, prewarmCachedExplicitComputePipeline,
  deferConfirmedSubmittedWorkCleanup } from '../webgpuComputeLayout.js';
import { tagWebGpuBufferDevice } from './sphGpuDeviceIdentity.js';

export const SPH_EXACT_REACTION_ROUTING_SCHEMA = 'peercompute.ulg.exact-reaction-routing-candidate.v1';
const RECORDS = new WeakMap();

/** The reaction runner's exact routing branch. It holds the original packet
 * before any compilation await. Rows retain their parent/term quantity bases;
 * they are not independently spendable physical carriers or product history.
 * Terminal placement must select routing, S/T/M and live history together. */
export async function runSphExactReactionRoutingCandidateWebGpu({ selection, expected } = {}) {
  const parent = acquireSphExactReactionSourceSelectionRead(selection, expected);
  const { result: selected, source, compiled } = parent.view;
  const device = source.device, format = selected.format;
  const owned = new Set();
  let result, closed = false, submitted = false, confirmed = false, completion = null;
  const release = () => {
    if (completion) return completion;
    closed = true;
    const cleanup = () => {
      confirmed = true;
      const errors = [];
      for (const buffer of owned) {
        try { buffer.destroy(); owned.delete(buffer); } catch (error) { errors.push(error); }
      }
      if (errors.length) throw new AggregateError(errors, 'Exact reaction routing cleanup failed');
    };
    const retired = submitted && !confirmed ? deferConfirmedSubmittedWorkCleanup(device, cleanup)
      : Promise.resolve().then(() => { cleanup(); return true; });
    completion = retired.then(async queueCompleted => {
      const sourceCompleted = await parent.release();
      if (result) RECORDS.delete(result);
      return queueCompleted && sourceCompleted;
    }).catch(error => { completion = null; throw error; });
    return completion;
  };
  const validate = () => {
    if (closed) throw new TypeError('Exact reaction routing candidate was released');
    parent.validate();
    if (closed) throw new TypeError('Exact reaction routing candidate was released');
    return true;
  };
  try {
    const layout = sphExactReactionRoutingLayout(format, { productCapacity: selected.caloricProductCapacity });
    const metadataStride = 1 + layout.productCapacity;
    const orderWords = new Uint32Array(compiled.length * metadataStride).fill(0xffffffff);
    compiled.forEach((token, reaction) => {
      const order = token.products.map((term, ordinal) => ({ ordinal, gas: term.targetPhase === 3 }));
      order.sort((a, b) => Number(a.gas) - Number(b.gas) || a.ordinal - b.ordinal);
      orderWords[reaction * metadataStride] = order.length;
      orderWords.set(order.map(term => term.ordinal), reaction * metadataStride + 1);
    });
    const params = new Uint32Array([selected.particleCount, selected.recordWords, layout.recordWords,
      layout.productCapacity, selected.caloricOffsetWords, selected.productEnergyOffsetWords,
      selected.speciesOffsetWords, selected.speciesLayout.termOffsetWords, selected.speciesLayout.termStrideWords,
      compiled.length, 0, 0, 0, 0, 0, 0]);
    const allocate = (label, size, usage) => {
      const bindingLimit = usage & 128 ? device.limits.maxStorageBufferBindingSize : device.limits.maxUniformBufferBindingSize;
      if (!Number.isSafeInteger(size) || size < 4 || size % 4
          || size > Math.min(device.limits.maxBufferSize, bindingLimit)) {
        throw new RangeError(`${label} exceeds device capacity`);
      }
      const buffer = device.createBuffer({ label, size, usage }); owned.add(buffer);
      tagWebGpuBufferDevice(buffer, device); return buffer;
    };
    if (selected.particleCount > device.limits.maxComputeWorkgroupsPerDimension) {
      throw new RangeError('Exact reaction routing exceeds dispatch capacity');
    }
    const outputByteLength = selected.particleCount * layout.recordWords * 4;
    const outputBuffer = allocate('ulg-exact-reaction-routing', outputByteLength, 128 | 8 | 4);
    const orderBuffer = allocate('ulg-exact-reaction-routing-order', orderWords.byteLength, 128 | 8);
    const paramsBuffer = allocate('ulg-exact-reaction-routing-params', params.byteLength, 64 | 8);
    const descriptor = { label: 'ulg-exact-reaction-endpoint-routing',
      cacheKey: `${SPH_EXACT_REACTION_ROUTING_SCHEMA}-${format.wordCount}-${format.quantumExponent}`,
      code: createSphExactReactionRoutingWgsl(format), entryPoint: 'prepare_exact_reaction_endpoint_routes',
      bindings: [computeBufferBinding(0, 'read-only-storage'), computeBufferBinding(1, 'read-only-storage'),
        computeBufferBinding(2, 'storage'), computeBufferBinding(3, 'uniform')] };
    const pipeline = await prewarmCachedExplicitComputePipeline(device, descriptor);
    if (!pipeline.pipeline) throw pipeline.error ?? new Error('Exact reaction routing pipeline unavailable');
    validate();
    device.queue.writeBuffer(orderBuffer, 0, orderWords); device.queue.writeBuffer(paramsBuffer, 0, params);
    const group = device.createBindGroup({ layout: pipeline.bindGroupLayout,
      entries: [selected.outputBuffer, orderBuffer, outputBuffer, paramsBuffer]
        .map((buffer, binding) => ({ binding, resource: { buffer } })) });
    const encoder = device.createCommandEncoder(); encoder.clearBuffer(outputBuffer);
    const pass = encoder.beginComputePass(); pass.setPipeline(pipeline.pipeline); pass.setBindGroup(0, group);
    pass.dispatchWorkgroups(selected.particleCount); pass.end();
    const command = encoder.finish(); validate(); submitted = true; device.queue.submit([command]);
    result = Object.freeze({ schema: SPH_EXACT_REACTION_ROUTING_SCHEMA,
      status: 'webgpu-exact-reaction-routing-candidate', outputBuffer, outputByteLength,
      particleCount: selected.particleCount, format, layout, sourceSelection: selected,
      physicalPublicationAdmitted: false, release });
    RECORDS.set(result, { result, parent, validate });
    return result;
  } catch (error) {
    error.exactReactionRoutingCleanupCompletion = release();
    throw error;
  }
}

/** Non-owning inspection of this original candidate. Placement executes inside
 * the owning reaction transaction; this resolver is not a physical installer. */
export function resolveSphExactReactionRoutingCandidate(result, { device } = {}) {
  const record = RECORDS.get(result);
  if (!record || record.parent.view.source.device !== device) {
    throw new TypeError('Original exact reaction routing candidate required');
  }
  record.validate();
  return Object.freeze({ result, source: record.parent.view });
}
