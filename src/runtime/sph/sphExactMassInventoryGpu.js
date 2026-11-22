import { validateSphExactMassFormat, encodeSphExactMass }
  from '../../../ulg-gpu-abi/src/sphExactMassInventory.js';
import {
  acquireQueueOrderedPooledBuffer,
  computeBufferBinding,
  createCachedExplicitComputePipeline,
  prewarmCachedExplicitComputePipeline,
  deferConfirmedSubmittedWorkCleanup,
  registerQueueOrderedPooledBufferReturn,
  releaseOrDestroyQueueOrderedPooledBuffer,
  submitQueueOrderedFinalConsumerWork
} from '../webgpuComputeLayout.js';
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
function allocate(device, resources, label, size, usage = USAGE, poolable = false) {
  const limit = Math.min(device.limits?.maxBufferSize ?? 268435456,
    usage & STORAGE ? device.limits?.maxStorageBufferBindingSize ?? 134217728 : Infinity);
  if (!Number.isSafeInteger(size) || size <= 0 || size % 4 || size > limit) {
    throw new RangeError(`${label} exceeds exact-mass buffer limits`);
  }
  const usePool = poolable
    && typeof globalThis.GPUDevice === 'function'
    && device instanceof globalThis.GPUDevice;
  const buffer = usePool
    ? registerQueueOrderedPooledBufferReturn(
        acquireQueueOrderedPooledBuffer(device, { bucketKey: label, label, size, usage }),
        device,
        { bucketKey: label, size, usage }
      )
    : device.createBuffer({ label, size, usage });
  resources.add(buffer); tagWebGpuBufferDevice(buffer, device); return buffer;
}
function destroy(record) {
  if (record.destroyed) return;
  record.destroyed = true;
  const allowPool = !record.deviceState.lost && !record.quarantined;
  for (const buffer of record.resources) {
    try { if (buffer.mapState === 'mapped') buffer.unmap(); } catch { /* Confirmed loss. */ }
    try { releaseOrDestroyQueueOrderedPooledBuffer(buffer, { allowPool }); } catch { /* Continue releasing the remaining owned buffers. */ }
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
  record.releasePromise = deferConfirmedSubmittedWorkCleanup(record.device, () => {
    destroy(record);
  }, {
    onQueueFenceRejected() { record.quarantined = true; }
  }).then(() => true, () => {
    record.quarantined = true;
    return untilLoss(record).then(() => { destroy(record); return true; });
  });
  return record.releasePromise;
}

/** Explicit initial inventory, never a replacement imported from a hot-state
 * f32 projection. Rows and their material/phase binding belong to the caller's
 * physical source family; this numeric owner alone cannot publish that family.
 */
export function createSphExactMassInventoryWebGpu({ device, format, massesKg, massWords, provenance } = {}) {
  validateSphExactMassFormat(format);
  const kind = provenance && Object.getOwnPropertyDescriptor(provenance, 'kind');
  const reference = provenance && Object.getOwnPropertyDescriptor(provenance, 'reference');
  const explicitWords = massWords instanceof Uint32Array && massWords.buffer instanceof ArrayBuffer
    && massWords.length > 0 && massWords.length % format.wordCount === 0;
  if ((massWords === undefined ? !Array.isArray(massesKg) || !massesKg.length : !explicitWords || massesKg !== undefined)
      || kind?.value !== 'initial-conditions'
      || typeof reference?.value !== 'string' || !reference.value.trim()) {
    throw new TypeError('Explicit mass rows and initial-condition provenance required');
  }
  const rowCount = uint(explicitWords ? massWords.length / format.wordCount : massesKg.length, 'inventory row count', true);
  const words = explicitWords ? massWords.slice() : new Uint32Array(rowCount * format.wordCount);
  for (let row = 0; !explicitWords && row < rowCount; row++) {
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

/** Consume one retained original placement read into independent numeric
 * storage. The producer has selected both current carriers and residuals;
 * every integer limb is copied without importing a floating mass projection.
 * Success releases this read in submission order. Failure leaves its release
 * with the caller, while any new allocation retires behind confirmed work.
 * This does not adopt physical quantities or residual history, or admit a
 * closure. Those owners must retain their complete aligned records separately.
 */
export async function createSphExactMassInventoryFromReactionPlacementWebGpu({ device, placementRead } = {}) {
  const { resolveSchroederSpatialReactionPlacementDestinationRead: resolve,
    releaseSchroederSpatialReactionPlacementDestinationRead: release } =
    await import('./schroederSpatialReactionPlacementEpochGpu.js');
  const source = resolve(placementRead, { device });
  const { format, quantityLayout: layout, massBuffer, massByteLength, sourceInventoryGeneration } = source;
  validateSphExactMassFormat(format);
  const rowCount = uint(layout?.rowCount, 'placement inventory row count', true);
  const generation = uint(uint(sourceInventoryGeneration, 'source inventory generation') + 1,
    'successor inventory generation', true);
  if (layout.currentRowOffset !== 0 || layout.eventRowOffset !== source.particleCount
      || rowCount !== source.particleCount + source.residualLayout?.eventCapacity
      || massByteLength !== rowCount * format.wordCount * 4
      || webGpuBufferDevice(massBuffer) !== device || massBuffer.size < massByteLength
      || (massBuffer.usage & COPY_SRC) !== COPY_SRC) {
    throw new TypeError('Reaction inventory requires the complete original terminal mass plane');
  }
  const record = recordFor(device, format, rowCount, generation);
  try {
    record.buffer = allocate(device, record.resources, 'ulg-exact-mass-reaction-successor', massByteLength);
    const encoder = device.createCommandEncoder({ label: 'ulg-exact-mass-reaction-successor' });
    encoder.copyBufferToBuffer(massBuffer, 0, record.buffer, 0, massByteLength);
    const commands = encoder.finish();
    resolve(placementRead, { device });
    const family = mintFamily(record, Object.freeze({ kind: 'reaction-placement',
      sourceGeneration: sourceInventoryGeneration, carrierRowCount: source.particleCount,
      residualRowOffset: source.particleCount, residualRowCount: source.residualLayout.eventCapacity }));
    const finalConsumer = submitQueueOrderedFinalConsumerWork(device, [commands],
      { finalConsumerOwner: family, producerClaims: [placementRead.queueOrderedCleanupClaim] });
    // This path consumes the exact producer claim synchronously; it adds no
    // host fence and retains no predecessor family or read in the new owner.
    release(placementRead, { queueOrderedFinalConsumer: finalConsumer });
    return family;
  } catch (error) {
    record.closed = true;
    void retire(record);
    throw error;
  }
}

/** Exact, disjoint carrier/history rows for the original mechanics projection.
 * This numeric owner is private to that projection; it cannot publish a new
 * physical branch. No mass is reconstructed from its f32 rendering value. */
export async function createSphExactMassInventoryFromResidualMechanicsWebGpu({device,sourceRead}={}) {
  const {resolveSchroederResidualMechanicsSourceRead:resolve}=
    await import('./schroederResidualMechanicsSourceGpu.js');
  const {SPH_REACTION_RESIDUAL_HISTORY_LAYOUT:H}=await import('./sphReactionResidualHistoryGpu.js');
  const held=resolve(sourceRead,{device}),{source,carrier}=held;
  const mass=carrier.read,original=liveRead(mass,device);
  const count=uint(source.particleCount,'mechanics inventory count',true);
  const record=recordFor(device,original.format,count,
    uint(Math.max(mass.generation,source.history.generation)+1,'mechanics inventory generation',true));
  try {
    record.buffer=allocate(device,record.resources,'ulg-exact-mass-residual-mechanics',count*H.format.wordCount*4);
    const code=`
@group(0) @binding(0) var<storage,read> history:array<u32>;
@group(0) @binding(1) var<storage,read> control:array<u32>;
@group(0) @binding(2) var<storage,read_write> mass:array<u32>;
@compute @workgroup_size(64) fn gather(@builtin(global_invocation_id) id:vec3<u32>){
  let row=id.x;if(row>=${source.historyCapacity}u || row>=control[4] || control[2]!=0u){return;}
  for(var w=0u;w<${H.format.wordCount}u;w++){
    mass[(${source.phaseLayout?.carrierLineageCount??source.carrierCount}u+row)*${H.format.wordCount}u+w]=
      history[${H.headerWords}u+row*${H.rowWords}u+${H.massOffset}u+w];
  }
}`;
    const p=createCachedExplicitComputePipeline(device,{code,entryPoint:'gather',
      cacheKey:`ulg-residual-mechanics-mass-v2-${source.carrierCount}-${source.historyCapacity}-${source.phaseLayout?.lineageCount??0}`,
      bindings:[computeBufferBinding(0,'read-only-storage'),computeBufferBinding(1,'read-only-storage'),computeBufferBinding(2,'storage')]});
    const group=device.createBindGroup({layout:p.bindGroupLayout,entries:[source.history.buffer,source.controlBuffer,record.buffer]
      .map((buffer,binding)=>({binding,resource:{buffer}}))});
    const encoder=device.createCommandEncoder();
    if(source.phaseLayout){
      const {carrierLineageCount,carrierLaneCount,lineageCount}=source.phaseLayout,stride=H.format.wordCount*4;
      for(let lane=0;lane<carrierLaneCount;lane++)encoder.copyBufferToBuffer(mass.buffer,
        mass.byteOffset+lane*carrierLineageCount*stride,record.buffer,lane*lineageCount*stride,carrierLineageCount*stride);
    }else encoder.copyBufferToBuffer(mass.buffer,mass.byteOffset,record.buffer,0,mass.byteLength);
    const pass=encoder.beginComputePass();pass.setPipeline(p.pipeline);pass.setBindGroup(0,group);
    pass.dispatchWorkgroups(Math.ceil(source.historyCapacity/64));pass.end();
    resolve(sourceRead,{device});device.queue.submit([encoder.finish()]);
    return mintFamily(record,Object.freeze({kind:'residual-mechanics-projection',
      carrierRowCount:source.carrierCount,historyCapacity:source.historyCapacity,
      sourceGeneration:mass.generation,historyGeneration:source.history.generation}));
  }catch(error){record.closed=true;void retire(record);throw error;}
}

/** Copy the current particle mass limbs from the original completed exchange.
 * This owner still grants only numeric inventory; the closure must adopt its
 * aligned quantities, history and aerosol together before physical publication.
 * The caller keeps its producer read; this consumer owns a separate fork until
 * its submitted gather is confirmed complete (or the device is lost).
 */
export async function createSphExactMassInventoryFromVaporExchangeWebGpu({ device, producerRead } = {}) {
  const { resolveSphSpatialVaporAerosolProducerRead: resolve,
    forkSphSpatialVaporAerosolProducerRead: fork,
    releaseSphSpatialVaporAerosolProducerRead: release } = await import('./sphSpatialGasLedgerEosGpu.js');
  const held = fork(producerRead, { device });
  let record = null, submitted = false;
  try {
    const source = resolve(held, { device });
    const { format, sourceInventoryGeneration, endpoints } = source;
    validateSphExactMassFormat(format);
    const rowCount = uint(source.particleCount, 'exchange inventory row count', true);
    const generation = uint(uint(sourceInventoryGeneration, 'source inventory generation') + 1,
      'successor inventory generation', true);
    const layout = endpoints.particleLayout, buffer = endpoints.particleBuffer;
    const words = rowCount * format.wordCount, groups = Math.ceil(words / 64);
    if (layout.rowCount !== rowCount || layout.recordWords < 16 + format.wordCount
        || layout.wordLength !== rowCount * layout.recordWords
        || webGpuBufferDevice(buffer) !== device || buffer.size !== layout.wordLength * 4
        || (buffer.usage & STORAGE) !== STORAGE
        || groups > device.limits.maxComputeWorkgroupsPerDimension) {
      throw new TypeError('Exchange inventory requires its complete original particle quantity plane');
    }
    record = recordFor(device, format, rowCount, generation);
    record.buffer = allocate(device, record.resources, 'ulg-exact-mass-vapor-successor', words * 4);
    const code = /* wgsl */ `
@group(0) @binding(0) var<storage, read> quantities: array<u32>;
@group(0) @binding(1) var<storage, read_write> masses: array<u32>;
@compute @workgroup_size(64)
fn gather_vapor_particle_mass(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x; if (i >= arrayLength(&masses)) { return; }
  let row = i / ${format.wordCount}u; let limb = i % ${format.wordCount}u;
  masses[i] = quantities[row * ${layout.recordWords}u + 16u + limb];
}`;
    const pipeline = await prewarmCachedExplicitComputePipeline(device, {
      code, entryPoint: 'gather_vapor_particle_mass', label: 'ulg-exact-mass-vapor-successor',
      cacheKey: `ulg-exact-mass-vapor-successor-v1:${format.wordCount}:${layout.recordWords}`,
      bindings: ['read-only-storage', 'storage'].map((type, binding) => computeBufferBinding(binding, type)) });
    if (!pipeline.pipeline) throw pipeline.error ?? new Error('Exact exchange mass gather unavailable');
    resolve(held, { device });
    const group = device.createBindGroup({ layout: pipeline.bindGroupLayout,
      entries: [buffer, record.buffer].map((buffer, binding) => ({ binding, resource: { buffer } })) });
    const encoder = device.createCommandEncoder({ label: 'ulg-exact-mass-vapor-successor' });
    const pass = encoder.beginComputePass(); pass.setPipeline(pipeline.pipeline); pass.setBindGroup(0, group);
    pass.dispatchWorkgroups(groups); pass.end();
    const family = mintFamily(record, Object.freeze({ kind: 'vapor-aerosol-exchange',
      sourceGeneration: sourceInventoryGeneration, carrierRowCount: rowCount }));
    submitted = true;
    device.queue.submit([encoder.finish()]);
    return family;
  } catch (error) {
    if (record) { record.closed = true; void retire(record); }
    throw error;
  } finally {
    if (submitted) void deferConfirmedSubmittedWorkCleanup(device, () => release(held)).catch(() => {});
    else release(held);
  }
}

/** Integer energy-ledger phase transfer (g2-integer-ledger-proposal.md, Phase
 * 2): mint the successor family whose rows the caller's ledger kernel writes
 * in its own encoder from the original live read. The caller must submit that
 * write before any read of the family, or abandon it before submission. */
export function createSphExactMassLedgerSuccessorWebGpu({ device, sourceRead } = {}) {
  const held = READS.get(sourceRead), source = held?.record;
  if (!held || held.released || source.device !== device || source.destroyed || source.quarantined
      || source.deviceState.lost || sourceRead.buffer !== source.buffer) {
    throw new TypeError('Ledger mass successor requires an original live source read');
  }
  const rowCount = uint(sourceRead.rowCount, 'ledger successor row count', true);
  const generation = uint(uint(sourceRead.generation, 'ledger source generation') + 1, 'ledger successor generation', true);
  const record = recordFor(device, source.format, rowCount, generation);
  try {
    record.buffer = allocate(device, record.resources, 'ulg-exact-mass-ledger-phase-successor',
      rowCount * source.format.wordCount * 4, USAGE, true);
    const family = mintFamily(record, Object.freeze({ kind: 'ledger-phase-carrier-transfer',
      sourceGeneration: sourceRead.generation, carrierRowCount: rowCount }));
    let settled = false;
    return Object.freeze({ family, buffer: record.buffer,
      abandon() { if (settled) return false; settled = true; record.closed = true; void retire(record); return true; },
      commit() { if (settled) throw new TypeError('Ledger mass successor was already settled'); settled = true; return family; } });
  } catch (error) { record.closed = true; void retire(record); throw error; }
}

/** Gather only from an original phase producer's final committed records,
 * including global rollback after caloric or geometry rejection. */
export async function createSphExactMassInventoryFromPhaseTransferWebGpu({ device, result, token } = {}) {
  const { resolveSphPhaseCarrierTransferSourceCapture: resolve } = await import('./sphPhaseCarrierTransferGpu.js');
  const seal = resolve(result, token), held = seal.retain();
  let record = null, submitted = false;
  try {
    const source = seal.exactPhase;
    if (!source || seal.inputs.device !== device) throw new TypeError('Phase inventory requires its original exact producer');
    const { format, quantityBuffer: buffer, quantityLayout: layout, sourceInventoryGeneration } = source;
    validateSphExactMassFormat(format);
    const rowCount = uint(source.particleCount, 'phase inventory row count', true);
    const generation = uint(uint(sourceInventoryGeneration, 'phase source generation') + 1, 'phase successor generation', true);
    const words = rowCount * format.wordCount;
    if (layout.rowCount !== rowCount || layout.massOffsetWords !== 16 || layout.wordLength !== rowCount * layout.recordWords
        || webGpuBufferDevice(buffer) !== device || buffer.size !== layout.wordLength * 4
        || (buffer.usage & STORAGE) !== STORAGE || Math.ceil(words / 64) > device.limits.maxComputeWorkgroupsPerDimension) {
      throw new TypeError('Phase inventory requires its complete original committed quantity plane');
    }
    record = recordFor(device, format, rowCount, generation);
    record.buffer = allocate(device, record.resources, 'ulg-exact-mass-phase-successor', words * 4);
    const code = `@group(0) @binding(0) var<storage, read> quantities: array<u32>;
@group(0) @binding(1) var<storage, read_write> masses: array<u32>;
@compute @workgroup_size(64) fn gather_phase_particle_mass(@builtin(global_invocation_id) id: vec3<u32>) {
 let i=id.x; if(i<arrayLength(&masses)){masses[i]=quantities[(i/${format.wordCount}u)*${layout.recordWords}u+16u+i%${format.wordCount}u];}}`;
    const pipeline = await prewarmCachedExplicitComputePipeline(device, { code, entryPoint: 'gather_phase_particle_mass',
      cacheKey: `ulg-exact-mass-phase-successor-v1:${format.wordCount}:${layout.recordWords}`,
      bindings: ['read-only-storage', 'storage'].map((type, binding) => computeBufferBinding(binding, type)) });
    if (!pipeline.pipeline) throw pipeline.error ?? new Error('Exact phase mass gather unavailable');
    resolve(result, token); held.validate();
    const group = device.createBindGroup({ layout: pipeline.bindGroupLayout,
      entries: [buffer, record.buffer].map((buffer, binding) => ({ binding, resource: { buffer } })) });
    const encoder = device.createCommandEncoder(); const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline.pipeline); pass.setBindGroup(0, group); pass.dispatchWorkgroups(Math.ceil(words / 64)); pass.end();
    const family = mintFamily(record, Object.freeze({ kind: 'phase-carrier-transfer', sourceGeneration: sourceInventoryGeneration, carrierRowCount: rowCount }));
    submitted = true; device.queue.submit([encoder.finish()]); return family;
  } catch (error) { if (record) { record.closed = true; void retire(record); } throw error; }
  finally {
    if (submitted) void deferConfirmedSubmittedWorkCleanup(device, () => held.release()).catch(() => {});
    else held.release();
  }
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
function mintRead(record, rowOffset = 0, rowCount = record.rowCount) {
  const byteOffset = rowOffset * record.format.wordCount * 4;
  const byteLength = rowCount * record.format.wordCount * 4;
  const read = Object.freeze({ family: record.family, device: record.device, format: record.format,
    buffer: record.buffer, rowOffset, rowCount, byteOffset, byteLength, generation: record.generation });
  READS.set(read, { record, rowOffset, rowCount, released: false }); record.borrows++; return read;
}
function liveRead(read, device) {
  const held = READS.get(read), record = held?.record;
  if (!held || held.released || record.device !== device || record.destroyed || record.quarantined
      || record.deviceState.lost || read.buffer !== record.buffer || read.format !== record.format
      || read.rowOffset !== held.rowOffset || read.rowCount !== held.rowCount) {
    throw new TypeError('Exact mass requires an original live retained read');
  }
  return record;
}
export function validateSphExactMassRead(read, { device, family, format, expectedGeneration,
  rowOffset, rowCount } = {}) {
  try {
    const record = liveRead(read, device);
    return record.family === family && record.format === format && record.generation === expectedGeneration
      && (rowOffset === undefined || (Object.is(read.rowOffset, rowOffset)))
      && (rowCount === undefined || (Object.is(read.rowCount, rowCount)));
  } catch { return false; }
}
/** Existing readers may delegate their held inventory while retirement drains. */
export function forkSphExactMassRead(read, { device, family = read?.family,
  format = read?.format, expectedGeneration = read?.generation,
  rowOffset = read?.rowOffset, rowCount = read?.rowCount } = {}) {
  if (!validateSphExactMassRead(read, { device, family, format, expectedGeneration, rowOffset, rowCount })) {
    throw new TypeError('Exact mass read fork requires its original live retained read');
  }
  return mintRead(liveRead(read, device), read.rowOffset, read.rowCount);
}

/** Retain a nonempty subrange relative to an original read. This delegates
 * numeric storage only: physical carrier/history roles require their producer.
 * Offsets need not satisfy storage-binding alignment; consumers must copy the
 * exact byte span or use an explicit row offset in their program.
 */
export function sliceSphExactMassRead(read, { device, rowOffset, rowCount } = {}) {
  const record = liveRead(read, device);
  uint(rowOffset, 'relative inventory row offset');
  uint(rowCount, 'inventory window row count', true);
  if (rowOffset + rowCount > read.rowCount) {
    throw new RangeError('Exact mass window cannot extend outside its retained source range');
  }
  return mintRead(record, read.rowOffset + rowOffset, rowCount);
}
export function releaseSphExactMassRead(read, { deferInBurst = false, confirmed = false } = {}) {
  const held = READS.get(read);
  if (!held) throw new TypeError('Exact mass retirement requires the original read');
  if (held.released) return held.releasePromise;
  held.released = true;
  const finishRelease = () => {
    held.record.borrows--;
    if (held.record.closed && !held.record.borrows && !held.record.releasePromise) {
      held.record.releasePromise = Promise.resolve(true);
      destroy(held.record);
    }
    return true;
  };
  if (confirmed === true) {
    held.releasePromise = Promise.resolve(finishRelease());
    return held.releasePromise;
  }
  if (deferInBurst === true) {
    held.releasePromise = deferConfirmedSubmittedWorkCleanup(held.record.device, () => {
      finishRelease();
    }, {
      onQueueFenceRejected() { held.record.quarantined = true; }
    }).then(() => true, () => {
      held.record.quarantined = true;
      return untilLoss(held.record).then(finishRelease);
    });
    return held.releasePromise;
  }
  held.releasePromise = queueFence(held.record).then(finishRelease);
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
export function runSphExactMassTransferCandidateWebGpu({ device, sourceRead, edgeBuffer, edgeCount, edgeFormat } = {}) {
  return runExactMassCandidate({ device, sourceReads: [sourceRead], edgeBuffer, edgeCount, edgeFormat });
}

/** Join current numeric rows, conservatively remap them, then apply one graph.
 * Each input row has exactly one destination; 0xffffffff drops ONLY exact zero.
 * Multiple source rows may merge into one destination with checked addition;
 * unreferenced destination rows start at exact zero. Edges name destination
 * rows and cannot spend another edge's incoming packet in the same interval.
 *
 * This numeric candidate does not certify that distinct families represent
 * disjoint physical inventory. Actual carrier/product/aerosol owners must
 * authenticate their current roles and adopt a single complete physical branch.
 * No source is consumed or published by this operation.
 */
export function runSphExactMassPartitionCandidateWebGpu({ device, sourceReads,
  outputRowCount, destinationBuffer, edgeBuffer = null, edgeCount = 0, edgeFormat } = {}) {
  return runExactMassCandidate({ device, sourceReads, outputRowCount, destinationBuffer,
    edgeBuffer, edgeCount, edgeFormat, partition: true });
}

/** Conservative cumulative-ratio allocation over remapped immutable rows.
 * Each GPU edge is [donor, receiver, lower[W], upper[W], denominator[W]]. The
 * selected packet is floor(available*upper/denominator) minus
 * floor(available*lower/denominator), with all operands unsigned integers.
 * Adjacent intervals covering [0, denominator) allocate the entire donor;
 * incomplete coverage retains the exact remainder. Denominators are positive
 * dimensionless integers in W limbs, independent of the mass quantum.
 *
 * This selects numerical packets only. The actual reaction/phase producer
 * must bind product terms, validate chemistry/energy, choose rollback and
 * publish matched physical owners. Ratios cannot authorize those actions.
 */
export function runSphExactMassAllocationCandidateWebGpu({ device, sourceReads,
  outputRowCount, destinationBuffer, edgeBuffer = null, edgeCount = 0, edgeFormat } = {}) {
  return runExactMassCandidate({ device, sourceReads, outputRowCount, destinationBuffer,
    edgeBuffer, edgeCount, edgeFormat, partition: true, allocation: true });
}

async function reserveSourceReads(device, sourceReads) {
  const held = [], records = [], known = new Map();
  try {
    const length = Object.getOwnPropertyDescriptor(sourceReads ?? {}, 'length')?.value;
    if (!Array.isArray(sourceReads) || !Number.isSafeInteger(length) || length < 1) {
      throw new TypeError('Exact inventory sources require a nonempty array of original reads');
    }
    for (let i = 0; i < length; i++) {
      const descriptor = Object.getOwnPropertyDescriptor(sourceReads, String(i));
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) {
        throw new TypeError('Exact inventory sources require explicit own data reads');
      }
      const read = descriptor.value, source = liveRead(read, device);
      const ranges = known.get(source) ?? [];
      if (ranges.some(range => read.rowOffset < range.rowOffset + range.rowCount
          && range.rowOffset < read.rowOffset + read.rowCount)) {
        throw new TypeError('Exact inventory sources cannot repeat or overlap rows from a numeric owner');
      }
      ranges.push(read); known.set(source, ranges); records.push(source);
      held.push(mintRead(source, read.rowOffset, read.rowCount));
    }
    return { held, records };
  } catch (error) {
    // No GPU work has started, but earlier reads may already have been used
    // by their genuine owner. Their normal queue/loss retirement still applies.
    await Promise.all(held.map(read => releaseSphExactMassRead(read)));
    throw error;
  }
}

async function runExactMassCandidate({ device, sourceReads, outputRowCount, destinationBuffer,
  edgeBuffer, edgeCount, edgeFormat, partition = false, allocation = false }) {
  const { held, records } = await reserveSourceReads(device, sourceReads);
  const source = records[0], format = source.format;
  let output = null, temporary = null, mapBuffer = null, fenceConfirmed = false;
  try {
    if (edgeFormat !== format || records.some(record => record.format !== format)) {
      throw new TypeError('Proposal and sources require the same original exact-mass format');
    }
    const sourceRows = uint(held.reduce((count, read) => count + read.rowCount, 0), 'joined source row count', true);
    const rowCount = partition ? uint(outputRowCount, 'output row count', true) : sourceRows;
    const sourceGeneration = records.reduce((generation, record) => Math.max(generation, record.generation), 0);
    const generation = uint(sourceGeneration + 1, 'candidate generation', true);
    uint(edgeCount, 'edge count', !partition);
    const edgeBytes = edgeCount * (format.wordCount * (allocation ? 3 : 1) + 2) * 4;
    if (edgeCount > 0 && (!edgeBuffer || webGpuBufferDevice(edgeBuffer) !== device || edgeBuffer.destroyed
        || edgeBuffer.size !== edgeBytes || !(edgeBuffer.usage & COPY_SRC))) {
      throw new TypeError('Exact mass graph requires the complete same-device COPY_SRC proposal buffer');
    }
    if (edgeCount === 0 && edgeBuffer != null) throw new TypeError('Empty exact graph must omit its proposal buffer');
    if (partition && (!destinationBuffer || webGpuBufferDevice(destinationBuffer) !== device || destinationBuffer.destroyed
        || destinationBuffer.size !== sourceRows * 4 || !(destinationBuffer.usage & COPY_SRC))) {
      throw new TypeError('Exact row mapping requires the complete same-device COPY_SRC destination buffer');
    }
    const groups = Math.ceil(rowCount / 64);
    if (groups > (device.limits?.maxComputeWorkgroupsPerDimension ?? 65535)) {
      throw new RangeError('Exact mass gather exceeds device dispatch limit');
    }
    output = recordFor(device, format, rowCount, generation);
    temporary = recordFor(device, format, 0, 0);
    output.buffer = allocate(device, output.resources, 'ulg-exact-mass-candidate', rowCount * format.wordCount * 4);
    const params = allocate(device, temporary.resources, 'ulg-exact-mass-params', partition ? 32 : 16, UNIFORM | COPY_DST);
    const edges = allocate(device, temporary.resources, 'ulg-exact-mass-edges', Math.max(4, edgeBytes));
    const snapshotSource = partition || held[0].rowOffset !== 0 || held[0].rowCount !== source.rowCount;
    const joined = snapshotSource
      ? allocate(device, temporary.resources, 'ulg-exact-mass-joined-source', sourceRows * format.wordCount * 4)
      : source.buffer;
    const destinations = partition ? allocate(device, temporary.resources, 'ulg-exact-mass-destinations', sourceRows * 4) : null;
    const control = allocate(device, temporary.resources, 'ulg-exact-mass-control', 64);
    const verdict = allocate(device, temporary.resources, 'ulg-exact-mass-verdict', 64, MAP_READ | COPY_DST);
    const version = allocation ? 3 : partition ? 2 : 1;
    const code = createSphExactMassTransferWgsl(format, { partition, allocation });
    const bindings = ['uniform', 'read-only-storage', 'read-only-storage', 'storage', 'storage'];
    if (partition) bindings.push('read-only-storage');
    const stages = ['exact_mass_gather', 'exact_mass_validate', 'exact_mass_finalize'].map(entryPoint => {
      const info = createCachedExplicitComputePipeline(device, {
        cacheKey: `ulg-${entryPoint}.v${version}.${format.wordCount}.${format.quantumExponent}`,
        label: entryPoint, entryPoint, code,
        bindings: bindings.map((type, binding) => computeBufferBinding(binding, type))
      });
      const buffers = [params, joined, edges, output.buffer, control];
      if (partition) buffers.push(destinations);
      const group = device.createBindGroup({ layout: info.bindGroupLayout,
        entries: buffers.map((buffer, binding) => ({ binding, resource: { buffer } })) });
      return { info, group };
    });
    for (const read of held) liveRead(read, device);
    const words = [rowCount, edgeCount, sourceGeneration, generation];
    if (partition) words.push(sourceRows, records.length, allocation ? 1 : 0, 0);
    device.queue.writeBuffer(params, 0, new Uint32Array(words));
    const encoder = device.createCommandEncoder();
    if (snapshotSource) {
      let offset = 0;
      for (const read of held) {
        encoder.copyBufferToBuffer(read.buffer, read.byteOffset, joined, offset, read.byteLength);
        offset += read.byteLength;
      }
    }
    if (partition) {
      encoder.copyBufferToBuffer(destinationBuffer, 0, destinations, 0, sourceRows * 4);
    }
    if (edgeCount) encoder.copyBufferToBuffer(edgeBuffer, 0, edges, 0, edgeBytes);
    else encoder.clearBuffer(edges);
    encoder.clearBuffer(control);
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
    fenceConfirmed = true;
    for (const read of held) liveRead(read, device);
    if (header[0] !== SPH_EXACT_MASS_TRANSFER_MAGIC || header[1] !== version || ![1, 2].includes(header[2])
        || header[4] !== rowCount || header[5] !== edgeCount || header[6] !== rowCount
        || header[7] !== generation || header[8] !== sourceGeneration
        || (partition && (header[9] !== sourceRows || header[10] !== records.length))
        || header.slice(partition ? 11 : 9).some(Boolean) || (header[2] === 1) !== (header[3] === 0)) {
      throw new Error('Malformed exact-mass transfer verdict');
    }
    const receipt = Object.freeze({ ready: header[2] === 1, errorBits: header[3], rowCount,
      edgeCount, sourceGeneration, generation, ...(partition ? { sourceRowCount: sourceRows, sourceCount: records.length } : {}),
      observedBytes: 64, scope: 'mass-only', physicalPublicationAdmitted: false,
      ...(allocation ? { packetSelection: 'cumulative-integer-ratio' } : {}) });
    const provenance = partition ? Object.freeze({ kind: allocation ? 'mass-allocation-candidate' : 'mass-partition-transfer-candidate',
      sources: Object.freeze(held.map(read => Object.freeze({ familyId: read.family.familyId,
        generation: read.generation, rowOffset: read.rowOffset, rowCount: read.rowCount }))) })
      : Object.freeze({ kind: 'mass-transfer-candidate', sourceFamilyId: source.family.familyId, sourceGeneration,
        sourceRowOffset: held[0].rowOffset, sourceRowCount: held[0].rowCount });
    const family = receipt.ready ? mintFamily(output, provenance) : null;
    if (!family) destroy(output);
    return Object.freeze({ ...receipt, family });
  } catch (error) {
    if (mapBuffer) { try { mapBuffer.unmap(); } catch { /* Confirmed loss. */ } }
    if (temporary) await queueFence(temporary);
    if (output) destroy(output);
    throw error;
  } finally {
    const canReuseConfirmedFence = fenceConfirmed
      && typeof globalThis.GPUDevice === 'function'
      && device instanceof globalThis.GPUDevice;
    if (temporary) {
      if (!canReuseConfirmedFence) await queueFence(temporary);
      destroy(temporary);
    }
    await Promise.all(held.map(read => releaseSphExactMassRead(read, { confirmed: canReuseConfirmedFence })));
    // The verdict precedes these retirement fences. A device loss while
    // draining them must not return an already-destroyed successful family.
    if (output?.family && (output.destroyed || output.deviceState.lost || output.quarantined)) {
      throw new Error('Exact mass device lost before candidate delivery');
    }
  }
}
