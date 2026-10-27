import { deriveSphReactionStrictGateStaticBlockerFlags } from './sphReactionGpuSummary.js';
import { createSphReactionStrictGateFinalizeParams, SPH_REACTION_STRICT_GATE_PARAMS_INDEX as EXACT_POLICY_INDEX }
  from '../../../ulg-gpu-abi/src/sphReactionStrictGate.js';
import { acquireSphExactReactionSourceSelectionRead } from './sphExactReactionSourceGpu.js';
import { createSphExactReactionRoutingWgsl, sphExactReactionRoutingLayout }
  from './sphExactReactionRoutingWgsl.js';
import { computeBufferBinding, prewarmCachedExplicitComputePipeline,
  deferConfirmedSubmittedWorkCleanup } from '../webgpuComputeLayout.js';
import { tagWebGpuBufferDevice } from './sphGpuDeviceIdentity.js';
import { runSphExactReactionOutputCandidateWebGpu } from './sphExactReactionOutputGpu.js';

export const SPH_EXACT_REACTION_ROUTING_SCHEMA = 'peercompute.ulg.exact-reaction-routing-candidate.v1';
const RECORDS = new WeakMap();
const DEVICE_STATES = new WeakMap();

function routingDeviceState(device) {
  let state = DEVICE_STATES.get(device);
  if (state) return state;
  state = { lost: false, owners: new Set() };
  DEVICE_STATES.set(device, state);
  try {
    const lost = device.lost;
    if (lost?.then) Promise.resolve(lost).then(() => {
      state.lost = true;
      for (const retire of [...state.owners]) retire();
      state.owners.clear();
    }, () => {});
  } catch { /* A failed observer does not confirm retirement. */ }
  return state;
}

/** The reaction runner's exact routing branch. It holds the original packet
 * before any compilation await. Rows retain their parent/term quantity bases;
 * they are not independently spendable physical carriers or product history.
 * Terminal placement must select routing, S/T/M and live history together. */
export async function runSphExactReactionRoutingCandidateWebGpu({ selection, expected } = {}) {
  const parent = acquireSphExactReactionSourceSelectionRead(selection, expected);
  const { result: selected, source, compiled } = parent.view;
  const device = source.device, format = selected.format;
  let strictGatePolicy;
  const originalExpected = Object.freeze({ ...Object.fromEntries(Object.entries(
    Object.getOwnPropertyDescriptors(expected)).map(([key, descriptor]) => [key, descriptor.value])),
    device, sourceSelection: selected, particleCount: source.particleCount, format,
    reactionTable: parent.view.reactionTable, thermalMaterialTable: parent.view.thermalMaterialTable,
    reactionDiscoveryProposal: parent.view.reactionDiscoveryProposal,
    sourceSphUpload: source.sourceSphUpload, sourceMlsUpload: source.sourceMlsUpload,
    sphParticleUpload: source.sourceSphUpload, mlsMpmParticleUpload: source.sourceMlsUpload,
    transaction: source.transaction, generation: source.generation,
    dtSeconds: source.dtSeconds, encodedDtBits: source.encodedDtBits,
    stateBuffer: source.stateBuffer, thermoBuffer: source.thermoBuffer, mechanicsBuffer: source.mechanicsBuffer,
    sourceStateBuffer: source.stateBuffer, sourceThermoBuffer: source.thermoBuffer,
    sourceMechanicsBuffer: source.mechanicsBuffer });
  const deviceState = routingDeviceState(device);
  const owned = new Set();
  const reads = new Set(), drainWaiters = new Set();
  const dropRead = read => {
    if (!reads.delete(read)) return;
    if (!reads.size) {
      for (const resolve of drainWaiters) resolve();
      drainWaiters.clear();
    }
  };
  const drainReads = () => !reads.size || deviceState.lost ? Promise.resolve()
    : new Promise(resolve => drainWaiters.add(resolve));
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
    completion = drainReads().then(() => submitted && !confirmed && !deviceState.lost
      ? deferConfirmedSubmittedWorkCleanup(device, cleanup)
      : Promise.resolve().then(() => { cleanup(); return !deviceState.lost; }))
    .then(async queueCompleted => {
      const sourceCompleted = await parent.release();
      if (result) RECORDS.delete(result);
      deviceState.owners.delete(retireAfterLoss);
      return queueCompleted && sourceCompleted && !deviceState.lost;
    }).catch(error => { completion = null; throw error; });
    return completion;
  };
  const retireAfterLoss = () => {
    for (const read of [...reads]) read.retireAfterLoss();
    void release().catch(() => {});
  };
  const validateRetained = () => {
    if (deviceState.lost) throw new TypeError('Exact reaction routing device was lost');
    parent.validate();
    if (deviceState.lost) throw new TypeError('Exact reaction routing device was lost');
    return true;
  };
  const validate = () => {
    if (closed) throw new TypeError('Exact reaction routing candidate was released');
    validateRetained();
    if (closed) throw new TypeError('Exact reaction routing candidate was released');
    return true;
  };
  try {
  // Current reaction entry has no tolerance option. Capture its ORIGINAL default
  // policy before the first await; this is policy data, not a completed gate.
  // Caller-customizable future policy must be owned by that original entry.
  parent.validate();
  const originalPolicyWords = createSphReactionStrictGateFinalizeParams({
    reactionCount: parent.view.reactionTable.reactionCount,
    atomTermCount: parent.view.reactionTable.atomTermCount,
    staticBlockerFlags: deriveSphReactionStrictGateStaticBlockerFlags(parent.view.reactionTable)
  });
  parent.validate();
  strictGatePolicy = Object.freeze({
    schema: 'peercompute.ulg.exact-reaction-original-default-policy.v1',
    reactionTable: parent.view.reactionTable,
    atomToleranceBits: originalPolicyWords[EXACT_POLICY_INDEX.atomResidualToleranceMol],
    chargeToleranceBits: originalPolicyWords[EXACT_POLICY_INDEX.chargeResidualToleranceMol],
    staticBlockerFlags: originalPolicyWords[EXACT_POLICY_INDEX.staticBlockerFlags],
    gateCompleted: false,
    get paramsWords() { return originalPolicyWords.slice(); }
  });
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
    const physicalOutput = await runSphExactReactionOutputCandidateWebGpu({
      parent, routingBuffer: outputBuffer, routingLayout: layout, allocate, validate,
      markSubmitted: () => { submitted = true; }
    });
    result = Object.freeze({ schema: SPH_EXACT_REACTION_ROUTING_SCHEMA,
      status: 'webgpu-exact-reaction-routing-candidate', outputBuffer, outputByteLength,
      particleCount: selected.particleCount, format, layout, sourceSelection: selected,
      physicalOutput, physicalPublicationAdmitted: false, release });
    const view = Object.freeze({ result, source: parent.view, strictGatePolicy });
    const acquireRead = () => {
      validate();
      let released = false, retirement = null;
      const read = { retireAfterLoss() {
        released = true; retirement ??= Promise.resolve(false); dropRead(read);
      } };
      reads.add(read);
      const validateRead = () => {
        if (released) throw new TypeError('Exact reaction routing read was released');
        validateRetained();
        if (released) throw new TypeError('Exact reaction routing read was released');
        return view;
      };
      return Object.freeze({ view, validate: validateRead,
        markDerivedBuffers(buffers, options) {
          validateRead(); parent.markDerivedBuffers(buffers, options); validateRead();
        },
        release() {
          if (retirement) return retirement;
          released = true;
          retirement = deviceState.lost
            ? Promise.resolve().then(() => { dropRead(read); return false; })
            : deferConfirmedSubmittedWorkCleanup(device, () => dropRead(read))
              .then(completed => completed && !deviceState.lost);
          return retirement;
        },
        get released() { return released || deviceState.lost; }
      });
    };
    RECORDS.set(result, { result, parent, validate, originalExpected, acquireRead });
    deviceState.owners.add(retireAfterLoss);
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

/** Retain the original routing and physical-output allocations across consumer
 * awaits and owner close. This read grants no placement or publication right. */
export function acquireSphExactReactionRoutingRead(result, expected = {}) {
  const record = RECORDS.get(result);
  if (!record) throw new TypeError('Original exact reaction routing candidate required');
  const descriptors = Object.getOwnPropertyDescriptors(expected);
  if (!Object.hasOwn(descriptors.device ?? {}, 'value')
      || descriptors.device.value !== record.originalExpected.device) {
    throw new TypeError('Exact reaction routing read requires the original device');
  }
  for (const key of Reflect.ownKeys(descriptors)) {
    const descriptor = descriptors[key];
    if (!Object.hasOwn(record.originalExpected, key) || !Object.hasOwn(descriptor, 'value')
        || !Object.is(descriptor.value, record.originalExpected[key])) {
      throw new TypeError(`Exact reaction routing read changed original ${String(key)}`);
    }
  }
  return record.acquireRead();
}
