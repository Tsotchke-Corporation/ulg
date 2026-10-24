// Low-level resource owner, NOT published-source, interval or kinetic authority.
// The retained EOS owner authenticates the complete source and holds its reads
// until this operation settles. No candidate parcel enters the live family map.
import { computeBufferBinding, createCachedExplicitComputePipeline } from '../webgpuComputeLayout.js';
import { tagWebGpuBufferDevice, tagResidentProductMassDevice, webGpuBufferMatchesDevice } from './sphGpuDeviceIdentity.js';
import { forkSphAerosolParcelRead, releaseSphAerosolParcelRead, validateSphAerosolParcelRead } from './sphAerosolParcelGpu.js';
import { registerResidentProductEventCountAuthority, productEventLiveCountCopyDescriptor,
  validateProductEventLiveCountCopyDescriptor, retireResidentProductEventCountAuthority,
  revokeResidentProductEventCountAuthority } from './sphResidentProductHistoryGpu.js';
import { sphVaporAerosolExchangeWgsl } from './sphVaporAerosolExchangeWgsl.js';
import { SPH_VAPOR_AEROSOL_EXCHANGE_MAGIC, SPH_VAPOR_AEROSOL_EXCHANGE_VERSION,
  SPH_VAPOR_AEROSOL_EXCHANGE_PARAM_WORDS, SPH_VAPOR_AEROSOL_EXCHANGE_EDGE_WORDS,
  SPH_VAPOR_AEROSOL_EXCHANGE_MATERIAL_FLOATS, SPH_VAPOR_AEROSOL_EXCHANGE_SURFACE_FLOATS,
  SPH_VAPOR_AEROSOL_EXCHANGE_CONTROL_HEADER_WORDS } from '../../../ulg-gpu-abi/src/sphVaporAerosolExchange.js';

const MAP_READ = 1, COPY_SRC = 4, COPY_DST = 8, UNIFORM = 64, STORAGE = 128;
const READ_WRITE = STORAGE | COPY_SRC | COPY_DST;
const serials = new WeakMap();
const lossStates = new WeakMap();
const OWNER_SCHEMA = 'peercompute.ulg.sph-vapor-aerosol-exchange-resource-owner.v0';

function deviceLossState(device) {
  let state = lossStates.get(device);
  if (!state) {
    state = { lost: false, listeners: new Set() };
    lossStates.set(device, state);
    // The device-lifetime callback retains only this small subscription cell.
    Promise.resolve(device.lost).then(() => {
      state.lost = true;
      for (const notify of [...state.listeners]) notify();
      state.listeners.clear();
    }, () => {});
  }
  return state;
}

function uint(value, label, { positive = false, maximum = 0xffffffff } = {}) {
  if (!Number.isSafeInteger(value) || Object.is(value, -0)
      || value < (positive ? 1 : 0) || value > maximum) {
    throw new RangeError(`${label} must be an exact ${positive ? 'positive ' : ''}u32`);
  }
  return value;
}

function own(object, key, fallback) {
  const descriptor = object && Object.getOwnPropertyDescriptor(object, key);
  if (!descriptor) {
    if (object && key in object) throw new TypeError(`${key} must be an own data property`);
    if (arguments.length === 3) return fallback;
    throw new TypeError(`${key} is required`);
  }
  if (!Object.hasOwn(descriptor, 'value')) throw new TypeError(`${key} must be an own data property`);
  return descriptor.value;
}

function buffer(device, value, bytes, label, usage = COPY_SRC) {
  if (!value || !webGpuBufferMatchesDevice(value, device) || value.destroyed
      || !Number.isSafeInteger(value.size) || value.size < bytes
      || !Number.isInteger(value.usage) || (value.usage & usage) !== usage) {
    throw new TypeError(`${label} requires a live same-device buffer with exact capacity and usage`);
  }
  return value;
}

function checkedWords(value, label) {
  uint(value, label);
  if (!Number.isSafeInteger(value * 4)) throw new RangeError(`${label} byte size overflow`);
  return value;
}

function packEdges(edges, particleCount, productCapacity, aerosolCapacity, materialCount) {
  if (!Array.isArray(edges) || !edges.length) throw new TypeError('Nonempty prescribed edges required');
  uint(edges.length, 'edge count', { maximum: 0xffffff });
  const words = new Uint32Array(edges.length * SPH_VAPOR_AEROSOL_EXCHANGE_EDGE_WORDS);
  const floats = new Float32Array(words.buffer), gases = new Map(), parcels = new Map();
  for (let index = 0; index < edges.length; index++) {
    const edge = own(edges, String(index));
    const gasKind = uint(own(edge, 'gasKind'), 'gas kind', { maximum: 1 });
    const gasIndex = uint(own(edge, 'gasIndex'), 'gas index');
    const parcelIndex = uint(own(edge, 'parcelIndex'), 'parcel index');
    const materialRow = uint(own(edge, 'materialRow'), 'material row');
    const gasKey = `${gasKind}:${gasIndex}`;
    if (gasIndex >= (gasKind === 0 ? particleCount : productCapacity)
        || parcelIndex >= aerosolCapacity || materialRow >= materialCount) {
      throw new RangeError('Prescribed edges require in-range source and parcel indices');
    }
    const offset = index * SPH_VAPOR_AEROSOL_EXCHANGE_EDGE_WORDS;
    words.set([gasKind, gasIndex, parcelIndex, materialRow], offset);
    for (const [lane, key] of ['deltaMassKg', 'transportEnthalpyCorrectionJ',
      'conductiveHeatJ', 'pressureWorkIntoLiquidJ'].entries()) {
      const value = own(edge, key), packed = Math.fround(value);
      if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isFinite(packed)
          || (value !== 0 && packed === 0)) throw new RangeError(`${key} must be representable finite f32`);
      floats[offset + 4 + lane] = packed;
    }
    const heatOnly = floats[offset + 4] === 0;
    if (heatOnly && (floats[offset + 5] !== 0 || floats[offset + 7] !== 0)) {
      throw new RangeError('Heat-only edges cannot carry mass enthalpy or pressure work');
    }
    if ((gases.has(gasKey) && (!heatOnly || !gases.get(gasKey)))
        || (parcels.has(parcelIndex) && (!heatOnly || !parcels.get(parcelIndex)))) {
      throw new RangeError('Mass-transfer edges require disjoint source and parcel indices');
    }
    gases.set(gasKey, heatOnly); parcels.set(parcelIndex, heatOnly);
  }
  return words;
}

// A rejected fence never resolves the operation while live source reads might
// remain on the GPU. The outer EOS wrapper may release its source holds only
// after this function returns or throws; quarantine therefore waits for loss.
function lifetime(device) {
  const resources = new Set();
  const lossState = deviceLossState(device);
  const listeners = new Set();
  let lost = lossState.lost, quarantine = false, resolveLoss;
  const loss = new Promise((resolve) => { resolveLoss = resolve; });
  const onLoss = () => {
    lost = true; resolveLoss(false);
    for (const notify of [...listeners]) notify();
  };
  if (lost) onLoss(); else lossState.listeners.add(onLoss);
  const destroy = (resource) => {
    if (!resources.delete(resource)) return;
    try { if (resource.mapState === 'mapped') resource.unmap(); } catch { /* Loss cleanup. */ }
    try { resource.destroy(); } catch { /* Retire every independently owned allocation. */ }
  };
  return {
    resources, get lost() { return lost; }, get quarantined() { return quarantine; },
    assertLive() { if (lost) throw new Error('Vapor/aerosol candidate device lost'); },
    onLoss(notify) { if (lost) notify(); else listeners.add(notify); },
    wait(value) {
      return Promise.race([value, loss.then(() => { throw new Error('Vapor/aerosol candidate device lost'); })]);
    },
    allocate(label, bytes, usage) {
      this.assertLive();
      if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes % 4 !== 0
          || bytes > (device.limits?.maxBufferSize ?? 268435456)
          || ((usage & STORAGE) && bytes > (device.limits?.maxStorageBufferBindingSize ?? 134217728))) {
        throw new RangeError(`${label} exceeds supported buffer limits`);
      }
      const result = device.createBuffer({ label: `ulg-vapor-aerosol-exchange-${label}`, size: bytes, usage });
      // Register immediately: tagging or later allocation may throw.
      resources.add(result); tagWebGpuBufferDevice(result, device);
      return result;
    },
    async queuePoint() {
      if (lost) return false;
      let fence;
      try {
        fence = device.queue.onSubmittedWorkDone();
        if (!fence || typeof fence.then !== 'function') throw new Error('Missing queue fence');
      } catch { quarantine = true; return loss; }
      const confirmed = await Promise.race([Promise.resolve(fence).then(() => true,
        () => { quarantine = true; return loss; }), loss]);
      return confirmed && !lost;
    },
    destroy,
    destroyAll() {
      [...resources].forEach(destroy);
      lossState.listeners.delete(onLoss); listeners.clear();
    }
  };
}

/** Copy and execute the material-general kernel, without public source admission.
 * Every numerical source value enters by GPU COPY. Host writes contain only
 * layout, declared materials/edges and generation operands. `observe` is an
 * explicit diagnostic readback of candidate outputs, never a production input.
 */
export async function runSphVaporAerosolExchangeCandidateGpu(inputs = {}) {
  const device = own(inputs, 'device');
  if (!device?.createBuffer || !device?.createCommandEncoder || !device?.queue?.writeBuffer
      || !device?.queue?.submit || !device?.queue?.onSubmittedWorkDone || !device?.lost?.then) {
    throw new TypeError('Vapor/aerosol exchange requires a WebGPU device with confirmed retirement');
  }
  const particleCount = uint(own(inputs, 'particleCount'), 'particle count', { positive: true, maximum: 0xffffff });
  const compactCapacity = uint(own(inputs, 'compactCapacity'), 'compact capacity', { positive: true, maximum: 0xffffff });
  const cellCapacity = uint(own(inputs, 'cellCapacity'), 'cell capacity', { positive: true });
  const executionGeneration = uint(own(inputs, 'executionGeneration'), 'EOS generation', { positive: true });
  const sourceStateBuffer = buffer(device, own(inputs, 'sourceStateBuffer'), particleCount * 32, 'source state');
  const sourceThermoBuffer = buffer(device, own(inputs, 'sourceThermoBuffer'), particleCount * 48, 'source thermo');
  const sourceMechanicsBuffer = buffer(device, own(inputs, 'sourceMechanicsBuffer'), particleCount * 128, 'source mechanics');
  const eosControlBuffer = buffer(device, own(inputs, 'eosControlBuffer'), 36 * 4, 'EOS control');
  const compactRowsBuffer = buffer(device, own(inputs, 'compactRowsBuffer'), compactCapacity * 64, 'compact rows');
  const caloricRowsBuffer = buffer(device, own(inputs, 'caloricRowsBuffer'), cellCapacity * 32, 'caloric cells');
  const sourceHistory = own(inputs, 'residentProductMass', null);
  const sourceCount = own(inputs, 'productEventLiveCountDescriptor', null);
  let productCapacity = 0, sourceProductBuffer = null;
  if (sourceHistory != null) {
    if (!validateProductEventLiveCountCopyDescriptor(sourceCount, { handle: sourceHistory, device })
        || sourceCount.rowStrideFloats !== 32
        || own(sourceHistory, 'productEventRowCount') !== sourceCount.rowCapacity
        || own(sourceHistory, 'productEventStrideFloats') !== 32) {
      throw new TypeError('Exact full retained product count descriptor required');
    }
    productCapacity = uint(sourceCount.rowCapacity, 'product capacity', { positive: true, maximum: 0xffffff });
    sourceProductBuffer = buffer(device, own(sourceHistory, 'productEventBuffer'), productCapacity * 128, 'source products');
    buffer(device, sourceCount.controlBuffer, sourceCount.controlOffsetBytes + 256, 'source product count');
  } else if (sourceCount != null) throw new TypeError('Absent history cannot carry a count descriptor');
  const aerosolRead = own(inputs, 'aerosolRead');
  const aerosolIdentity = { device, family: aerosolRead?.family, expectedGeneration: aerosolRead?.generation };
  if (!validateSphAerosolParcelRead(aerosolRead, aerosolIdentity)) throw new TypeError('Exact retained aerosol read required');
  const aerosolCapacity = uint(aerosolRead.capacity, 'aerosol capacity', { positive: true, maximum: 0xffffff });
  buffer(device, aerosolRead.buffer, aerosolCapacity * 96, 'source parcels');
  const suppliedMaterials = own(inputs, 'materialRows');
  if (!(suppliedMaterials instanceof Float32Array) || !suppliedMaterials.length
      || suppliedMaterials.length % SPH_VAPOR_AEROSOL_EXCHANGE_MATERIAL_FLOATS !== 0) {
    throw new TypeError('Complete Float32Array material rows required');
  }
  const materialRows = Float32Array.prototype.slice.call(suppliedMaterials);
  if (!materialRows.every(Number.isFinite)) throw new RangeError('Material rows must be finite');
  const materialCount = materialRows.length / SPH_VAPOR_AEROSOL_EXCHANGE_MATERIAL_FLOATS;
  const edgeRows = packEdges(own(inputs, 'edges'), particleCount, productCapacity, aerosolCapacity, materialCount);
  const edgeCount = edgeRows.length / SPH_VAPOR_AEROSOL_EXCHANGE_EDGE_WORDS;
  const edgeDispatch = Math.ceil(edgeCount / 64);
  if (edgeDispatch > (device.limits?.maxComputeWorkgroupsPerDimension ?? 65535)) {
    throw new RangeError('Exchange edge dispatch exceeds device limit');
  }
  const generation = Math.max(serials.get(device) ?? 0, sourceCount?.expectedGeneration ?? 0) + 1;
  uint(generation, 'output count generation', { positive: true }); serials.set(device, generation);

  let wordCount = 0;
  const segments = [];
  const segment = (name, words, source = null, sourceOffset = 0) => {
    const result = { name, offset: wordCount, words, source, sourceOffset };
    wordCount = checkedWords(wordCount + words, 'source arena words'); segments.push(result); return result;
  };
  const state = segment('state', particleCount * 8, sourceStateBuffer);
  const thermo = segment('thermo', particleCount * 12, sourceThermoBuffer);
  const mechanics = segment('mechanics', particleCount * 32, sourceMechanicsBuffer);
  const product = segment('products', productCapacity * 32, sourceProductBuffer);
  const parcel = segment('parcels', aerosolCapacity * 24, aerosolRead.buffer);
  const eos = segment('eos', 36, eosControlBuffer);
  const compact = segment('compact', compactCapacity * 16, compactRowsBuffer);
  const caloric = segment('caloric', cellCapacity * 8, caloricRowsBuffer);
  wordCount = Math.ceil(wordCount / 64) * 64;
  const count = segment('product-count', 64, sourceCount?.controlBuffer ?? null, sourceCount?.controlOffsetBytes ?? 0);
  const paramsData = new Uint32Array(SPH_VAPOR_AEROSOL_EXCHANGE_PARAM_WORDS);
  paramsData.set([particleCount, productCapacity, aerosolCapacity, edgeCount, materialCount,
    state.offset, thermo.offset, mechanics.offset, product.offset, parcel.offset, eos.offset,
    compact.offset, caloric.offset, count.offset, executionGeneration, compactCapacity,
    cellCapacity, wordCount, sourceHistory == null ? 0 : 1, generation, generation,
    sourceCount?.expectedGeneration ?? 0, sourceCount?.expectedSeal ?? 0]);
  const cell = lifetime(device), temporary = [];
  let sourceRead = null, queueTouched = false, mapped = null;
  const dropSourceRead = () => {
    if (sourceRead) { const read = sourceRead; sourceRead = null; releaseSphAerosolParcelRead(read); }
  };
  const validateSources = () => {
    cell.assertLive();
    if (!validateSphAerosolParcelRead(sourceRead, aerosolIdentity)
        || (sourceHistory != null && (!validateProductEventLiveCountCopyDescriptor(sourceCount,
          { handle: sourceHistory, device })
          || own(sourceHistory, 'productEventRowCount') !== productCapacity
          || own(sourceHistory, 'productEventStrideFloats') !== 32))) {
      throw new TypeError('Exchange source read changed');
    }
  };
  try {
    sourceRead = forkSphAerosolParcelRead(aerosolRead, aerosolIdentity);
    const sourceArena = cell.allocate('source-arena', wordCount * 4, READ_WRITE);
    const outputArena = cell.allocate('output-arena', wordCount * 4, READ_WRITE);
    const params = cell.allocate('params', paramsData.byteLength, UNIFORM | COPY_DST);
    const edges = cell.allocate('edges', edgeRows.byteLength, STORAGE | COPY_DST);
    const materials = cell.allocate('materials', materialRows.byteLength, STORAGE | COPY_DST);
    const controlBuffer = cell.allocate('control', (SPH_VAPOR_AEROSOL_EXCHANGE_CONTROL_HEADER_WORDS + edgeCount) * 4, READ_WRITE);
    const surfaceBuffer = cell.allocate('surface', aerosolCapacity * SPH_VAPOR_AEROSOL_EXCHANGE_SURFACE_FLOATS * 4, READ_WRITE);
    const verdict = cell.allocate('verdict', SPH_VAPOR_AEROSOL_EXCHANGE_CONTROL_HEADER_WORDS * 4, MAP_READ | COPY_DST);
    temporary.push(sourceArena, outputArena, params, edges, materials, verdict);
    const outputSegments = [state, thermo, mechanics, product, parcel, count];
    const outputs = new Map(outputSegments.filter((entry) => entry.words > 0 && (entry !== count || sourceHistory != null))
      .map((entry) => [entry, cell.allocate(`candidate-${entry.name}`, entry.words * 4, READ_WRITE)]));
    const stages = ['initialize_vapor_aerosol_exchange', 'apply_vapor_aerosol_exchange', 'finalize_vapor_aerosol_exchange']
      .map((entryPoint) => {
        const info = createCachedExplicitComputePipeline(device, {
          cacheKey: `ulg-${entryPoint}.v${SPH_VAPOR_AEROSOL_EXCHANGE_VERSION}`, label: `ulg-${entryPoint}`, entryPoint,
          code: sphVaporAerosolExchangeWgsl,
          bindings: ['uniform', 'read-only-storage', 'read-only-storage', 'read-only-storage', 'storage', 'storage', 'storage']
            .map((type, binding) => computeBufferBinding(binding, type))
        });
        const bindGroup = device.createBindGroup({ layout: info.bindGroupLayout,
          entries: [params, sourceArena, edges, materials, outputArena, surfaceBuffer, controlBuffer]
            .map((value, binding) => ({ binding, resource: { buffer: value } })) });
        return { info, bindGroup };
      });
    // Writes are queue operations too. A later setup failure must retire them.
    queueTouched = true;
    device.queue.writeBuffer(params, 0, paramsData);
    device.queue.writeBuffer(edges, 0, edgeRows);
    device.queue.writeBuffer(materials, 0, materialRows);
    const encoder = device.createCommandEncoder({ label: 'ulg-vapor-aerosol-exchange' });
    encoder.clearBuffer(sourceArena); encoder.clearBuffer(controlBuffer); encoder.clearBuffer(surfaceBuffer);
    for (const entry of segments) if (entry.source && entry.words) {
      encoder.copyBufferToBuffer(entry.source, entry.sourceOffset, sourceArena, entry.offset * 4, entry.words * 4);
    }
    encoder.copyBufferToBuffer(sourceArena, 0, outputArena, 0, wordCount * 4);
    for (const [index, { info, bindGroup }] of stages.entries()) {
      const pass = encoder.beginComputePass(); pass.setPipeline(info.pipeline); pass.setBindGroup(0, bindGroup);
      pass.dispatchWorkgroups(index === 1 ? edgeDispatch : 1); pass.end();
    }
    for (const [entry, destination] of outputs) encoder.copyBufferToBuffer(outputArena, entry.offset * 4,
      destination, 0, entry.words * 4);
    encoder.copyBufferToBuffer(controlBuffer, 0, verdict, 0, verdict.size);
    const command = encoder.finish(); validateSources();
    device.queue.submit([command]);
    // Keep the outer source hold until BOTH the receipt and the actual queue
    // fence settle. A map is not permission to ignore a rejected latest fence.
    const fence = cell.queuePoint();
    let mapFailure = null, header = null;
    try {
      await cell.wait(verdict.mapAsync(MAP_READ)); mapped = verdict;
      header = new Uint32Array(verdict.getMappedRange()).slice();
      verdict.unmap(); mapped = null;
    } catch (error) { mapFailure = error; }
    if (!await fence) throw new Error('Vapor/aerosol candidate device lost before confirmed source retirement');
    if (mapFailure) throw mapFailure;
    validateSources();
    if (header.length !== 16 || header[0] !== SPH_VAPOR_AEROSOL_EXCHANGE_MAGIC
        || header[1] !== SPH_VAPOR_AEROSOL_EXCHANGE_VERSION || ![1, 2].includes(header[2])
        || header[4] !== edgeCount || header[5] > edgeCount || header[6] > productCapacity
        || header[7] > aerosolCapacity || header[8] !== generation || header[9] !== generation
        || header[10] !== executionGeneration || header.slice(11).some((value) => value !== 0)
        || (header[2] === 1 && (header[3] !== 0 || header[5] !== edgeCount))
        || (header[2] === 2 && header[3] === 0)) throw new Error('Malformed vapor/aerosol GPU candidate verdict');
    const ready = header[2] === 1;
    const receipt = Object.freeze({ magic: header[0], version: header[1], status: header[2],
      errorBits: header[3], edgeCount, acceptedEdges: header[5], productLiveCount: header[6],
      readyParcelCount: header[7], outputCountGeneration: header[8], outputCountSeal: header[9],
      expectedEosGeneration: header[10], words: Object.freeze([...header]) });
    dropSourceRead(); temporary.forEach(cell.destroy);
    return createCandidateOwner({ device, cell, ready, receipt, particleCount, productCapacity,
      aerosolCapacity, generation, stateBuffer: outputs.get(state), thermoBuffer: outputs.get(thermo),
      mechanicsBuffer: outputs.get(mechanics), productEventBuffer: outputs.get(product) ?? null,
      parcelBuffer: outputs.get(parcel), productCountBuffer: outputs.get(count) ?? null,
      surfaceBuffer, controlBuffer, sourceHistory });
  } catch (error) {
    try { if (mapped) mapped.unmap(); } catch { /* Continue safe cleanup. */ }
    if (queueTouched && !cell.lost) await cell.queuePoint();
    cell.destroyAll(); dropSourceRead(); throw error;
  }
}

function createCandidateOwner({ device, cell, ready, receipt, particleCount, productCapacity,
  aerosolCapacity, generation, stateBuffer, thermoBuffer, mechanicsBuffer, productEventBuffer,
  parcelBuffer, productCountBuffer, surfaceBuffer, controlBuffer, sourceHistory }) {
  let owner, releaseRequested = false, released = false, observing = false, historyBorrows = 0;
  let releasePromise = null, resolveRelease;
  let history = null, countDescriptor = null;
  const status = ready ? 'vapor-aerosol-candidate-ready-not-adopted' : 'vapor-aerosol-candidate-rejected';
  const assertReadable = () => {
    cell.assertLive();
    if (releaseRequested || released || observing) throw new Error('Exchange candidate is released or has an active observation');
    if (history && (!validateProductEventLiveCountCopyDescriptor(countDescriptor, { handle: history, device })
      || history.productEventBuffer !== productEventBuffer)) throw new TypeError('Candidate product history changed');
  };
  const finishRelease = async () => {
    if (released || observing || historyBorrows) return;
    released = true;
    await cell.queuePoint();
    if (history) revokeResidentProductEventCountAuthority(history);
    cell.destroyAll(); resolveRelease?.(true);
  };
  const requestRelease = () => {
    if (releasePromise) return releasePromise;
    releaseRequested = true;
    releasePromise = new Promise((resolve) => { resolveRelease = resolve; });
    if (history) retireResidentProductEventCountAuthority(history);
    void finishRelease(); return releasePromise;
  };
  if (ready && productEventBuffer) {
    history = tagResidentProductMassDevice({
      schema: 'peercompute.ulg.sph-residual-product-history-candidate.v0',
      status: 'residual-product-history-candidate-not-adopted',
      productEventBuffer, productEventBufferRetained: true,
      productEventBufferByteLength: productCapacity * 128, productEventRowCount: productCapacity,
      productEventStrideFloats: 32, productEventStrideBytes: 128,
      sourceResidentProductMass: sourceHistory,
      inventoryScope: 'current-unplaced-residual-products-only',
      consumeMassPolicy: 'unplaced-product-mass-only', historicalProductionTotals: false,
      kineticsAdmitted: false, exchangeIntervalAdmitted: false, published: false,
      destroyResidentProductMassBuffers: requestRelease
    }, device);
    Object.defineProperty(history, '__ulgActiveBorrowCount', { enumerable: false, configurable: false,
      get: () => historyBorrows,
      set(value) {
        uint(value, 'candidate product borrow count');
        if ((releaseRequested || released) && value > historyBorrows) return;
        historyBorrows = value;
        if (releaseRequested && !historyBorrows) void finishRelease();
      } });
    registerResidentProductEventCountAuthority(history, { device, controlBuffer: productCountBuffer,
      controlOffsetBytes: 0, rowCapacity: productCapacity, rowStrideFloats: 32,
      generation, seal: generation, zeroTailSealed: true });
    countDescriptor = productEventLiveCountCopyDescriptor(history, device);
  }
  owner = Object.freeze({ schema: OWNER_SCHEMA, ready, status, receipt,
    particleCount, aerosolCapacity, productCapacity, stateBuffer, thermoBuffer, mechanicsBuffer,
    productEventBuffer, parcelBuffer, surfaceBuffer, controlBuffer, productCountBuffer,
    residentProductMass: history, productEventLiveCountDescriptor: countDescriptor,
    sourceAuthority: false, kineticsAdmitted: false, exchangeIntervalAdmitted: false,
    published: false, residentAdopted: false, scientificValidation: false,
    pressureRequiresRefresh: true, mechanicsContinuationAdmitted: false, outerPublicationAdmitted: false,
    readbackByteLength: 64, dispatchCount: 3,
    async observe() {
      if (this !== owner) throw new TypeError('Exact exchange resource owner required');
      assertReadable(); observing = true;
      let staging = null, mapped = false, submitted = false;
      try {
        const rows = [['stateValues', stateBuffer, Float32Array], ['thermoValues', thermoBuffer, Float32Array],
          ['mechanicsValues', mechanicsBuffer, Float32Array], ['productEventValues', productEventBuffer, Float32Array],
          ['parcelWords', parcelBuffer, Uint32Array], ['surfaceValues', surfaceBuffer, Float32Array],
          ['productCountWords', productCountBuffer, Uint32Array], ['controlWords', controlBuffer, Uint32Array]];
        let bytes = 0;
        const ranges = rows.map(([key, value, Type]) => {
          const range = { key, buffer: value, Type, offset: bytes, bytes: value?.size ?? 0 };
          bytes += range.bytes; return range;
        });
        staging = cell.allocate('observation', bytes, MAP_READ | COPY_DST);
        const encoder = device.createCommandEncoder({ label: 'ulg-vapor-aerosol-exchange-observation' });
        for (const range of ranges) if (range.buffer) encoder.copyBufferToBuffer(range.buffer, 0, staging, range.offset, range.bytes);
        const command = encoder.finish(); submitted = true; device.queue.submit([command]);
        const fence = cell.queuePoint();
        let mapError = null, copy = null;
        try {
          await cell.wait(staging.mapAsync(MAP_READ)); mapped = true;
          copy = staging.getMappedRange().slice(0); staging.unmap(); mapped = false;
        } catch (error) { mapError = error; }
        if (!await fence) throw new Error('Exchange observation lost its device');
        if (mapError) throw mapError;
        return { ready, status, receipt, ...Object.fromEntries(ranges.map((range) => [range.key,
          range.buffer ? new range.Type(copy.slice(range.offset, range.offset + range.bytes)) : null])) };
      } finally {
        try { if (mapped) staging.unmap(); } catch { /* Loss cleanup. */ }
        if (submitted && !cell.lost) await cell.queuePoint();
        if (staging) cell.destroy(staging);
        observing = false;
        if (releaseRequested) void finishRelease();
      }
    },
    release() {
      if (this !== owner) throw new TypeError('Exact exchange resource owner required');
      return requestRelease();
    }
  });
  cell.onLoss(() => { historyBorrows = 0; void requestRelease(); });
  return owner;
}
