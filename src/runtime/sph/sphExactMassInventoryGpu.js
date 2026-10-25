import { validateSphExactMassFormat, encodeSphExactMass }
  from '../../../ulg-gpu-abi/src/sphExactMassInventory.js';
import { computeBufferBinding, createCachedExplicitComputePipeline } from '../webgpuComputeLayout.js';
import { tagWebGpuBufferDevice, webGpuBufferDevice } from './sphGpuDeviceIdentity.js';
import { createSphExactMassTransferWgsl, SPH_EXACT_MASS_TRANSFER_MAGIC }
  from './sphExactMassTransferWgsl.js';

const FAMILIES = new WeakMap(), READS = new WeakMap(), DEVICES = new WeakMap();
const STORAGE = 128, UNIFORM = 64, COPY_SRC = 4, COPY_DST = 8, MAP_READ = 1;
const USAGE = STORAGE | COPY_SRC | COPY_DST;
let nextFamilyId = 1;

function uint(value, name, positive = false) {
  if (!Number.isSafeInteger(value) || Object.is(value, -0) || value < (positive ? 1 : 0) || value > 0xffffffff) {
    throw new RangeError(`${name} must be an exact ${positive ? 'positive ' : ''}u32`);
  }
  return value;
}
function deviceState(device) {
  if (!device?.createBuffer || !device?.createCommandEncoder || !device?.queue?.writeBuffer
      || !device?.queue?.submit || !device?.queue?.onSubmittedWorkDone || !device?.lost?.then) {
    throw new TypeError('Exact inventory requires a WebGPU device with queue retirement');
  }
  let state = DEVICES.get(device);
  if (!state) {
    state = { lost: false, records: new Set(), lossListeners: new Set() };
    device.lost.then(() => {
      state.lost = true;
      for (const record of [...state.records]) { record.closed = true; destroy(record); }
      for (const listener of [...state.lossListeners]) listener();
      state.lossListeners.clear();
    }, () => {});
    DEVICES.set(device, state);
  }
  if (state.lost) throw new Error('Exact inventory device is lost');
  return state;
}
function untilLoss(record, operation) {
  const state = record.deviceState;
  if (state.lost) return Promise.resolve(false);
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (value, error = false) => {
      if (settled) return;
      settled = true; state.lossListeners.delete(onLoss);
      if (error) reject(value); else resolve(value);
    };
    const onLoss = () => finish(false);
    state.lossListeners.add(onLoss);
    // No Promise.race reactions accumulate on a never-settling device.lost.
    if (operation) Promise.resolve(operation).then(value => finish(value), error => finish(error, true));
  });
}
function allocate(device, resources, label, size, usage = USAGE) {
  const limit = Math.min(device.limits?.maxBufferSize ?? 268435456,
    usage & STORAGE ? device.limits?.maxStorageBufferBindingSize ?? 134217728 : Infinity);
  if (!Number.isSafeInteger(size) || size <= 0 || size % 4 || size > limit) {
    throw new RangeError(`${label} exceeds exact-mass buffer limits`);
  }
  const buffer = device.createBuffer({ label, size, usage });
  resources.add(buffer); tagWebGpuBufferDevice(buffer, device); return buffer;
}
function destroy(record) {
  if (record.destroyed) return;
  record.destroyed = true;
  for (const buffer of record.resources) {
    try { if (buffer.mapState === 'mapped') buffer.unmap(); } catch { /* Confirmed loss. */ }
    try { buffer.destroy(); } catch { /* Continue releasing the remaining owned buffers. */ }
  }
  record.resources.clear(); record.deviceState.records.delete(record);
}
async function queueFence(record) {
  if (record.deviceState.lost) return false;
  try {
    const fence = record.device.queue.onSubmittedWorkDone();
    if (!fence || typeof fence.then !== 'function') throw new Error('Missing queue fence');
    return await untilLoss(record, Promise.resolve(fence).then(() => true, () => {
      record.quarantined = true; return untilLoss(record);
    }));
  } catch { record.quarantined = true; return untilLoss(record); }
}
function recordFor(device, format, rowCount, generation) {
  const state = deviceState(device);
  const record = { device, deviceState: state, format, rowCount, generation, buffer: null,
    resources: new Set(), borrows: 0, closed: false, destroyed: false, quarantined: false, releasePromise: null };
  state.records.add(record); return record;
}
function mintFamily(record, provenance) {
  if (!Number.isSafeInteger(nextFamilyId)) throw new RangeError('Exact-mass family identity exhausted');
  const family = Object.freeze({ schema: 'peercompute.ulg.exact-mass-family.v1',
    familyId: nextFamilyId++,
    format: record.format, rowCount: record.rowCount, generation: record.generation,
    provenance, scope: 'mass-inventory-only', physicalPublicationAdmitted: false });
  record.family = family; FAMILIES.set(family, record); return family;
}
async function retire(record) {
  if (!record.closed || record.borrows || record.releasePromise) return record.releasePromise;
  record.releasePromise = queueFence(record).then(() => { destroy(record); return true; });
  return record.releasePromise;
}

/** Explicit initial inventory, never a replacement imported from a hot-state
 * f32 projection. Rows and their material/phase binding belong to the caller's
 * physical source family; this numeric owner alone cannot publish that family.
 */
export function createSphExactMassInventoryWebGpu({ device, format, massesKg, provenance } = {}) {
  validateSphExactMassFormat(format);
  const kind = provenance && Object.getOwnPropertyDescriptor(provenance, 'kind');
  const reference = provenance && Object.getOwnPropertyDescriptor(provenance, 'reference');
  if (!Array.isArray(massesKg) || !massesKg.length || kind?.value !== 'initial-conditions'
      || typeof reference?.value !== 'string' || !reference.value.trim()) {
    throw new TypeError('Explicit mass rows and initial-condition provenance required');
  }
  const rowCount = uint(massesKg.length, 'inventory row count', true);
  const words = new Uint32Array(rowCount * format.wordCount);
  for (let row = 0; row < rowCount; row++) {
    const descriptor = Object.getOwnPropertyDescriptor(massesKg, String(row));
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) {
      throw new TypeError('Each initial mass row must be explicit own data');
    }
    words.set(encodeSphExactMass(descriptor.value, format), row * format.wordCount);
  }
  const initialProvenance = Object.freeze({ kind: 'initial-conditions', reference: reference.value.trim() });
  const record = recordFor(device, format, rowCount, 0);
  try {
    record.buffer = allocate(device, record.resources, 'ulg-exact-mass-initial', words.byteLength);
    device.queue.writeBuffer(record.buffer, 0, words);
    return mintFamily(record, initialProvenance);
  } catch (error) { record.closed = true; void retire(record); throw error; }
}

export function acquireSphExactMassRead({ family, device, format = family?.format,
  expectedGeneration = family?.generation } = {}) {
  const record = FAMILIES.get(family);
  if (!record || record.device !== device || record.format !== format || record.generation !== expectedGeneration
      || record.closed || record.destroyed || record.quarantined || record.deviceState.lost) {
    throw new TypeError('Exact mass requires the live original family, format, device and generation');
  }
  return mintRead(record);
}
function mintRead(record) {
  const read = Object.freeze({ family: record.family, device: record.device, format: record.format,
    buffer: record.buffer, rowCount: record.rowCount, generation: record.generation });
  READS.set(read, { record, released: false }); record.borrows++; return read;
}
function liveRead(read, device) {
  const held = READS.get(read), record = held?.record;
  if (!held || held.released || record.device !== device || record.destroyed || record.quarantined
      || record.deviceState.lost || read.buffer !== record.buffer || read.format !== record.format) {
    throw new TypeError('Exact mass requires an original live retained read');
  }
  return record;
}
export function validateSphExactMassRead(read, { device, family, format, expectedGeneration } = {}) {
  try {
    const record = liveRead(read, device);
    return record.family === family && record.format === format && record.generation === expectedGeneration;
  } catch { return false; }
}
/** Existing readers may delegate their held inventory while retirement drains. */
export function forkSphExactMassRead(read, { device, family = read?.family,
  format = read?.format, expectedGeneration = read?.generation } = {}) {
  if (!validateSphExactMassRead(read, { device, family, format, expectedGeneration })) {
    throw new TypeError('Exact mass read fork requires its original live retained read');
  }
  return mintRead(liveRead(read, device));
}
export function releaseSphExactMassRead(read) {
  const held = READS.get(read);
  if (!held) throw new TypeError('Exact mass retirement requires the original read');
  if (held.released) return held.releasePromise;
  held.released = true;
  held.releasePromise = queueFence(held.record).then(() => {
    held.record.borrows--; void retire(held.record); return true;
  });
  return held.releasePromise;
}
export function releaseSphExactMassInventory(family) {
  const record = FAMILIES.get(family);
  if (!record) throw new TypeError('Exact mass retirement requires the original family');
  record.closed = true; void retire(record);
}

/** GPU-buffer graph: [donor u32, receiver u32, exact packet words] per edge.
 * The caller keeps that proposal buffer alive until this promise settles. The
 * graph is copied once before execution; it cannot mutate source inventory.
 * A success is only a mass candidate, not phase/energy/interval acceptance.
 */
export async function runSphExactMassTransferCandidateWebGpu({ device, sourceRead, edgeBuffer, edgeCount, edgeFormat } = {}) {
  const source = liveRead(sourceRead, device), format = source.format;
  // Reserve before any caller-controlled proposal or device-limit property can
  // retire the incoming capability. The held read owns this operation's work.
  const held = mintRead(source);
  let output = null, temporary = null, mapBuffer = null;
  try {
    if (edgeFormat !== format) throw new TypeError('Proposal and source require the same original exact-mass format');
    uint(edgeCount, 'edge count', true);
    const edgeBytes = edgeCount * (format.wordCount + 2) * 4;
    if (!edgeBuffer || webGpuBufferDevice(edgeBuffer) !== device || edgeBuffer.destroyed
        || edgeBuffer.size !== edgeBytes || !(edgeBuffer.usage & COPY_SRC)) {
      throw new TypeError('Exact mass graph requires the complete same-device COPY_SRC proposal buffer');
    }
    const groups = Math.ceil(source.rowCount / 64);
    if (groups > (device.limits?.maxComputeWorkgroupsPerDimension ?? 65535)) {
      throw new RangeError('Exact mass gather exceeds device dispatch limit');
    }
    uint(source.generation + 1, 'candidate generation', true);
    output = recordFor(device, format, source.rowCount, source.generation + 1);
    temporary = recordFor(device, format, 0, 0);
    output.buffer = allocate(device, output.resources, 'ulg-exact-mass-candidate', source.buffer.size);
    const params = allocate(device, temporary.resources, 'ulg-exact-mass-params', 16, UNIFORM | COPY_DST);
    const edges = allocate(device, temporary.resources, 'ulg-exact-mass-edges', edgeBytes);
    const control = allocate(device, temporary.resources, 'ulg-exact-mass-control', 64);
    const verdict = allocate(device, temporary.resources, 'ulg-exact-mass-verdict', 64, MAP_READ | COPY_DST);
    const code = createSphExactMassTransferWgsl(format);
    const stages = ['exact_mass_gather', 'exact_mass_validate', 'exact_mass_finalize'].map(entryPoint => {
      const info = createCachedExplicitComputePipeline(device, {
        cacheKey: `ulg-${entryPoint}.v1.${format.wordCount}.${format.quantumExponent}`,
        label: entryPoint, entryPoint, code,
        bindings: ['uniform', 'read-only-storage', 'read-only-storage', 'storage', 'storage']
          .map((type, binding) => computeBufferBinding(binding, type))
      });
      const group = device.createBindGroup({ layout: info.bindGroupLayout,
        entries: [params, source.buffer, edges, output.buffer, control]
          .map((buffer, binding) => ({ binding, resource: { buffer } })) });
      return { info, group };
    });
    liveRead(held, device);
    device.queue.writeBuffer(params, 0, new Uint32Array([source.rowCount, edgeCount, source.generation, output.generation]));
    const encoder = device.createCommandEncoder();
    encoder.copyBufferToBuffer(edgeBuffer, 0, edges, 0, edgeBytes); encoder.clearBuffer(control);
    for (const [index, { info, group }] of stages.entries()) {
      const pass = encoder.beginComputePass(); pass.setPipeline(info.pipeline); pass.setBindGroup(0, group);
      pass.dispatchWorkgroups(index === 2 ? 1 : groups); pass.end();
    }
    encoder.copyBufferToBuffer(control, 0, verdict, 0, 64);
    device.queue.submit([encoder.finish()]);
    const fence = queueFence(temporary);
    if (!await untilLoss(temporary, Promise.resolve(verdict.mapAsync(MAP_READ)).then(() => true))) {
      throw new Error('Exact mass device lost during verdict observation');
    }
    mapBuffer = verdict;
    const header = new Uint32Array(verdict.getMappedRange()).slice();
    verdict.unmap(); mapBuffer = null;
    if (!await fence) throw new Error('Exact mass device lost before confirmed retirement');
    liveRead(held, device);
    if (header[0] !== SPH_EXACT_MASS_TRANSFER_MAGIC || header[1] !== 1 || ![1, 2].includes(header[2])
        || header[4] !== source.rowCount || header[5] !== edgeCount || header[6] !== source.rowCount
        || header[7] !== output.generation || header[8] !== source.generation
        || header.slice(9).some(Boolean) || (header[2] === 1) !== (header[3] === 0)) {
      throw new Error('Malformed exact-mass transfer verdict');
    }
    const receipt = Object.freeze({ ready: header[2] === 1, errorBits: header[3], rowCount: source.rowCount,
      edgeCount, sourceGeneration: source.generation, generation: output.generation,
      observedBytes: 64, scope: 'mass-only', physicalPublicationAdmitted: false });
    const family = receipt.ready ? mintFamily(output, Object.freeze({ kind: 'mass-transfer-candidate',
      sourceFamilyId: source.family.familyId, sourceGeneration: source.generation })) : null;
    if (!family) destroy(output);
    return Object.freeze({ ...receipt, family });
  } catch (error) {
    if (mapBuffer) { try { mapBuffer.unmap(); } catch { /* Confirmed loss. */ } }
    if (temporary) await queueFence(temporary);
    if (output) destroy(output);
    throw error;
  } finally {
    if (temporary) { await queueFence(temporary); destroy(temporary); }
    await releaseSphExactMassRead(held);
  }
}
