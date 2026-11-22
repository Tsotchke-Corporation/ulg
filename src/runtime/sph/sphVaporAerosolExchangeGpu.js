import { validateSphTransportPacketMode } from './sphConservativeTransferPacketWgsl.js';
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
import { validateSphParticleExactMassRead, forkSphParticleExactMassRead, releaseSphParticleExactMassRead,
  markSphExactMassDerivedBuffers } from './sphGpuBuffers.js';
import { prepareSphExactHistoryGasViews } from './sphExactHistoryP2gGpu.js';
import { prepareSphExactVaporAerosolQuantities } from './sphExactVaporAerosolQuantitiesGpu.js';
import { prepareSphExactVaporAerosolEndpoints } from './sphExactVaporAerosolEndpointsGpu.js';
import { createSphExactVaporAerosolExchangeWgsl } from './sphExactVaporAerosolExchangeWgsl.js';
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

function packEdges(edges, particleCount, productCapacity, aerosolCapacity, materialCount, exact, cellPressureWork) {
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
    if (cellPressureWork && floats[offset + 7] !== 0) {
      throw new RangeError('Initial-cell pressure work is derived; prescribed work must be zero');
    }
    if (heatOnly && (floats[offset + 5] !== 0 || floats[offset + 7] !== 0)) {
      throw new RangeError('Heat-only edges cannot carry mass enthalpy or pressure work');
    }
    if (!exact && ((gases.has(gasKey) && (!heatOnly || !gases.get(gasKey)))
        || (parcels.has(parcelIndex) && (!heatOnly || !parcels.get(parcelIndex))))) {
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
  const aerosolRead = own(inputs, 'aerosolRead');
  const exact = aerosolRead?.exactQuantities ?? null;
  const pressureWorkMode = own(inputs, 'pressureWorkMode', 'prescribed');
  if (!['prescribed', 'initial-cell-pressure'].includes(pressureWorkMode)
      || (!exact && pressureWorkMode !== 'prescribed')) {
    throw new TypeError('Initial-cell pressure work requires exact exchange quantities');
  }
  const cellPressureWork = pressureWorkMode === 'initial-cell-pressure';
  const pressureCellsBuffer = cellPressureWork
    ? buffer(device, own(inputs, 'pressureCellsBuffer'), cellCapacity * 48, 'original EOS pressure cells') : null;
  const gasConstant = cellPressureWork ? own(inputs, 'spatialGasConstantJPerMolK') : null;
  if (cellPressureWork && (typeof gasConstant !== 'number' || !Number.isFinite(gasConstant)
      || gasConstant <= 0 || Math.fround(gasConstant) !== gasConstant)) {
    throw new RangeError('Initial-cell pressure work requires the original f32 EOS gas constant');
  }
  const geometryInput = cellPressureWork ? own(inputs, 'pressureGeometryWords') : new Uint32Array(24);
  if (!(geometryInput instanceof Uint32Array) || geometryInput.length !== 24) {
    throw new TypeError('Pressure work requires the original complete occupancy geometry');
  }
  const geometryWords = geometryInput.slice();
  const spatialGasCellSizeM = exact ? own(inputs, 'spatialGasCellSizeM') : null;
  if (exact && (typeof spatialGasCellSizeM !== 'number' || !Number.isFinite(spatialGasCellSizeM)
      || spatialGasCellSizeM <= 0 || Math.fround(spatialGasCellSizeM) !== spatialGasCellSizeM)) {
    throw new RangeError('Exact exchange requires the original finite positive f32 gas cell spacing');
  }
  const particleRead = own(inputs, 'exactParticleRead', null);
  const currentRead = own(inputs, 'exactPostMechanicsRead', null);
  if (particleRead && currentRead) throw new TypeError('Exchange cannot combine different exact source producers');
  const currentModule = currentRead ? await import('./sphMlsMpmPostMechanicsClosure.js') : null;
  const current = currentModule?.resolveMlsMpmPostMechanicsExactGasRead(currentRead, { device });
  const particleSource = current ? { ...current, read: current.massRead } : particleRead;
  if (exact && ((!current && !validateSphParticleExactMassRead(particleRead, { device, sourceSphUpload: particleRead?.sourceSphUpload }))
      || !particleSource?.quantities || particleSource.read.format !== exact.format
      || particleSource.quantities.quantityLayout.recordWords !== exact.quantityLayout.recordWords
      || particleSource.sourceSphUpload.stateBuffer !== sourceStateBuffer
      || particleSource.sourceSphUpload.thermoBuffer !== sourceThermoBuffer || particleSource.particleCount !== particleCount
      || (current && current.sourceMlsUpload.mechanicsBuffer !== sourceMechanicsBuffer))) {
    throw new TypeError('Exact exchange requires the matching original particle quantities');
  }
  let productCapacity = 0, sourceProductBuffer = null;
  if (sourceHistory != null) {
    if (!validateProductEventLiveCountCopyDescriptor(sourceCount, { handle: sourceHistory, device })
        || (!exact && sourceCount.rowStrideFloats !== 32)
        || own(sourceHistory, 'productEventRowCount') !== sourceCount.rowCapacity
        || own(sourceHistory, 'productEventStrideFloats') !== sourceCount.rowStrideFloats) {
      throw new TypeError('Exact full retained product count descriptor required');
    }
    productCapacity = uint(sourceCount.rowCapacity, 'product capacity', { positive: true, maximum: 0xffffff });
    sourceProductBuffer = buffer(device, own(sourceHistory, 'productEventBuffer'), productCapacity * 128, 'source products');
    buffer(device, sourceCount.controlBuffer, sourceCount.controlOffsetBytes + 256, 'source product count');
  } else if (sourceCount != null) throw new TypeError('Absent history cannot carry a count descriptor');
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
  const edgeRows = packEdges(own(inputs, 'edges'), particleCount, productCapacity, aerosolCapacity, materialCount, Boolean(exact), cellPressureWork);
  const rates = own(inputs, 'rateRows', null), produceRates = rates !== null;
  const rateIntegration = own(inputs, 'rateIntegration', 'initial-rate');
  if (!['initial-rate', 'midpoint'].includes(rateIntegration) || (!produceRates && rateIntegration !== 'initial-rate')) {
    throw new TypeError('Rate integration requires an explicit supported state-derived method');
  }
  const midpoint = produceRates && rateIntegration === 'midpoint';
  const rateSubsteps = own(inputs, 'rateSubsteps', 1);
  if (!Number.isSafeInteger(rateSubsteps) || rateSubsteps < 1 || rateSubsteps > 1024
      || (rateSubsteps & (rateSubsteps - 1)) !== 0 || (rateSubsteps !== 1 && !midpoint)) {
    throw new TypeError('Rate substeps require midpoint and a power of two from 1 through 1024');
  }
  const transportPacketMode = validateSphTransportPacketMode(own(inputs, 'transportPacketMode', 'exact-rational'));
  if (!exact && transportPacketMode !== 'exact-rational') throw new TypeError('Rounded transport packets require exact inventory');
  const intervalScaleExponent = -Math.log2(rateSubsteps);
  let packedMaterials = materialRows;
  if (produceRates) {
    if (!exact || !current || !cellPressureWork || !(current.dtSeconds > 0) || !Number.isFinite(current.dtSeconds)
        || !(rates instanceof Float32Array) || rates.length !== materialCount * (16 + materialCount)
        || !rates.every(Number.isFinite)) {
      throw new TypeError('State-derived rates require original current quantities, interval, pressure and complete coefficients');
    }
    const pairs = new Set();
    for (let b = 0; b < edgeRows.length; b += 8) {
      const key = `${edgeRows[b]}:${edgeRows[b + 1]}:${edgeRows[b + 2]}`;
      if (pairs.has(key) || edgeRows.slice(b + 4, b + 8).some(word => (word & 0x7fffffff) !== 0)) {
        throw new TypeError('Rate edges require unique gas/parcel pairs and zero prescribed transfers');
      }
      pairs.add(key);
    }
    packedMaterials = new Float32Array(materialRows.length + rates.length);
    packedMaterials.set(materialRows); packedMaterials.set(rates, materialRows.length);
  }
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
  const pressure = cellPressureWork ? segment('pressure-cells', cellCapacity * 12, pressureCellsBuffer) : null;
  const paramsData = new Uint32Array(SPH_VAPOR_AEROSOL_EXCHANGE_PARAM_WORDS);
  paramsData.set([particleCount, productCapacity, aerosolCapacity, edgeCount, materialCount,
    state.offset, thermo.offset, mechanics.offset, product.offset, parcel.offset, eos.offset,
    compact.offset, caloric.offset, count.offset, executionGeneration, compactCapacity,
    cellCapacity, wordCount, sourceHistory == null ? 0 : 1, generation, generation,
    sourceCount?.expectedGeneration ?? 0, sourceCount?.expectedSeal ?? 0]);
  // Exact-only uniform extension; the legacy ABI keeps all reserved words zero.
  if (exact) new Float32Array(paramsData.buffer)[23] = spatialGasCellSizeM;
  if (cellPressureWork) {
    paramsData.set([1, pressure.offset], 24);
    new Float32Array(paramsData.buffer)[26] = gasConstant;
  }
  const cell = lifetime(device), temporary = [];
  let sourceRead = null, exactParticleHold = null, exactCurrentHold = null, historyRead = null, exactWork = null,
    exactEndpoints = null, historyProjection = null, predictorWork = null;
  let queueTouched = false, mapped = null;
  const dropSourceRead = () => {
    if (sourceRead) { const read = sourceRead; sourceRead = null; releaseSphAerosolParcelRead(read); }
    if (historyRead) { historyRead.release(); historyRead = null; }
    if (exactParticleHold) { void releaseSphParticleExactMassRead(exactParticleHold, { deferInBurst: true }); exactParticleHold = null; }
    if (exactCurrentHold) { currentModule.releaseMlsMpmPostMechanicsExactGasRead(exactCurrentHold); exactCurrentHold = null; }
  };
  const validateSources = () => {
    cell.assertLive();
    if (!validateSphAerosolParcelRead(sourceRead, aerosolIdentity)
        || (sourceHistory != null && (!validateProductEventLiveCountCopyDescriptor(sourceCount,
          { handle: sourceHistory, device })
          || own(sourceHistory, 'productEventRowCount') !== productCapacity
          || own(sourceHistory, 'productEventStrideFloats') !== sourceCount.rowStrideFloats))) {
      throw new TypeError('Exchange source read changed');
    }
    if (exact && !current && !validateSphParticleExactMassRead(exactParticleHold, { device, sourceSphUpload: particleRead.sourceSphUpload })) {
      throw new TypeError('Exact exchange particle source changed');
    }
    if (exactCurrentHold) currentModule.resolveMlsMpmPostMechanicsExactGasRead(exactCurrentHold, { device });
    historyRead?.validate();
  };
  try {
    sourceRead = forkSphAerosolParcelRead(aerosolRead, aerosolIdentity);
    if (exact) {
      if (current) exactCurrentHold = currentModule.forkMlsMpmPostMechanicsExactGasRead(currentRead, { device });
      else exactParticleHold = forkSphParticleExactMassRead(particleRead, { device, sourceSphUpload: particleRead.sourceSphUpload });
      if (sourceHistory) {
        const history = await import('./sphMlsMpmGpuStep.js');
        historyRead = history.acquireResidentProductExactHistoryRead(sourceHistory,
          { device, identityBuffer: particleSource.sourceSphUpload.identityBuffer });
        if (historyRead.layout.format !== exact.format || historyRead.layout.quantityWords !== exact.quantityLayout.recordWords) {
          throw new TypeError('Exact exchange history must share the original run format');
        }
        queueTouched = true;
        historyProjection = await prepareSphExactHistoryGasViews({ device, source: historyRead,
          allocate: descriptor => { const b = cell.allocate(descriptor.label, descriptor.size, descriptor.usage); temporary.push(b); return b; } });
        product.source = historyProjection.outputBuffer;
      }
    }
    const sourceArena = cell.allocate('source-arena', wordCount * 4, READ_WRITE);
    const outputArena = cell.allocate('output-arena', wordCount * 4, READ_WRITE);
    const predictorArena = midpoint ? cell.allocate('midpoint-arena', wordCount * 4, READ_WRITE) : null;
    const stepArena = rateSubsteps > 1 ? cell.allocate('substep-arena', wordCount * 4, READ_WRITE) : sourceArena;
    if (stepArena !== sourceArena) temporary.push(stepArena);
    const predictorRates = midpoint ? cell.allocate('midpoint-initial-rates', edgeRows.byteLength, READ_WRITE) : null;
    const params = cell.allocate('params', paramsData.byteLength, UNIFORM | COPY_DST);
    const edges = cell.allocate('edges', edgeRows.byteLength, STORAGE | COPY_DST | (produceRates ? COPY_SRC : 0));
    const materials = cell.allocate('materials', packedMaterials.byteLength, STORAGE | COPY_DST);
    const pressureGeometry = exact ? cell.allocate('pressure-geometry', 96, UNIFORM | COPY_DST) : null;
    const controlBuffer = cell.allocate('control', (SPH_VAPOR_AEROSOL_EXCHANGE_CONTROL_HEADER_WORDS + edgeCount) * 4, READ_WRITE);
    const surfaceBuffer = cell.allocate('surface', aerosolCapacity * SPH_VAPOR_AEROSOL_EXCHANGE_SURFACE_FLOATS * 4, READ_WRITE);
    const predictorSurfaces = midpoint ? cell.allocate('midpoint-surfaces', surfaceBuffer.size, READ_WRITE) : null;
    const verdict = cell.allocate('verdict', SPH_VAPOR_AEROSOL_EXCHANGE_CONTROL_HEADER_WORDS * 4, MAP_READ | COPY_DST);
    temporary.push(sourceArena, outputArena, params, materials, verdict);
    if (!produceRates) temporary.push(edges);
    if (pressureGeometry) temporary.push(pressureGeometry);
    const outputSegments = [state, thermo, mechanics, product, parcel, count];
    const outputs = new Map(outputSegments.filter((entry) => entry.words > 0 && (entry !== count || (sourceHistory != null && !exact)))
      .map((entry) => [entry, cell.allocate(`candidate-${entry.name}`, entry.words * 4, READ_WRITE)]));
    const markingRead = current?.sourceParticleRead ?? exactParticleHold;
    if (exact) markSphExactMassDerivedBuffers(markingRead, [...outputs.values()],
      { mechanicsBuffers: [outputs.get(mechanics)] });
    let historyValidation = historyProjection?.validationBuffer;
    if (exact) {
      if (!historyValidation) { historyValidation = cell.allocate('absent-history-validation', 16, READ_WRITE); temporary.push(historyValidation); }
      queueTouched = true;
      if (midpoint) {
        predictorWork = await prepareSphExactVaporAerosolQuantities({ device, format: exact.format, layout: exact.quantityLayout,
          edgeRows, cellPressureWork, transportPacketMode, dtSeconds: current.dtSeconds, intervalScaleExponent: intervalScaleExponent - 1,
          particleRead: particleSource, historyRead, aerosolRead: sourceRead, edges,
          control: controlBuffer, surfaces: surfaceBuffer, allocate: (name, size, usage) => cell.allocate(`midpoint-${name}`, size, usage),
          validate: validateSources });
        temporary.push(...predictorWork.transient);
        markSphExactMassDerivedBuffers(markingRead, [predictorWork.output, predictorWork.projection]);
      }
      exactWork = await prepareSphExactVaporAerosolQuantities({ device, format: exact.format, layout: exact.quantityLayout,
        edgeRows, cellPressureWork, transportPacketMode, dtSeconds: produceRates ? current.dtSeconds : null, intervalScaleExponent,
        donorPairs: predictorWork?.output ?? null, predictorProjection: predictorWork?.projection ?? null,
        particleRead: current ? particleSource : exactParticleHold, historyRead, aerosolRead: sourceRead, edges,
        control: controlBuffer, surfaces: surfaceBuffer, allocate: (name, size, usage) => cell.allocate(name, size, usage), validate: validateSources });
      temporary.push(...exactWork.transient);
      markSphExactMassDerivedBuffers(markingRead, [exactWork.output, exactWork.projection]);
      exactEndpoints = await prepareSphExactVaporAerosolEndpoints({ device,
        particleRead: current ? particleSource : exactParticleHold, historyRead, aerosolRead: sourceRead,
        particleCount, edgeCount, edges, pairs: exactWork.output, projection: exactWork.projection,
        candidateArena: outputArena, productOffsetWords: product.offset, control: controlBuffer,
        allocate: (name, size, usage) => cell.allocate(name, size, usage), validate: validateSources });
      markSphExactMassDerivedBuffers(markingRead, exactEndpoints.retainedBuffers);
    }
    const regular = (exact ? ['initialize_vapor_aerosol_exchange', ...(produceRates ? ['produce_exact_vapor_rates'] : []),
      ...(cellPressureWork ? ['prepare_exact_vapor_pressure'] : []), 'prepare_exact_vapor_surface',
      'apply_exact_vapor_aerosol_exchange', 'finalize_exact_vapor_aerosol_exchange']
      : ['initialize_vapor_aerosol_exchange', 'apply_vapor_aerosol_exchange', 'finalize_vapor_aerosol_exchange']);
    const stage = (entryPoint, work = exactWork, from = stepArena, to = outputArena, role = 'final') =>
      ({ entryPoint, work, from, to, role });
    const specifications = midpoint ? [stage('initialize_vapor_aerosol_exchange', exactWork, sourceArena),
      ...['produce_exact_vapor_rates', 'prepare_exact_vapor_pressure', 'prepare_exact_vapor_surface',
        'apply_exact_vapor_aerosol_exchange', 'prepare_exact_vapor_midpoint']
        .map(name => stage(name, predictorWork, stepArena, predictorArena, 'predictor')),
      stage('produce_exact_vapor_rates', exactWork, predictorArena),
      stage('prepare_exact_vapor_pressure', exactWork, predictorArena),
      stage('prepare_exact_vapor_surface'), stage('apply_exact_vapor_aerosol_exchange'),
      stage('prepare_exact_vapor_endpoint'), stage('validate_exact_vapor_rate_endpoint', exactWork, outputArena, predictorArena),
      stage('finalize_exact_vapor_aerosol_exchange')] : regular.map(name => stage(name));
    const stages = [...specifications, ...(rateSubsteps > 1 ? [stage('begin_exact_vapor_substep')] : [])]
      .map(({ entryPoint, work, from, to, role }) => {
        const info = createCachedExplicitComputePipeline(device, {
          cacheKey: `ulg-${entryPoint}.v${SPH_VAPOR_AEROSOL_EXCHANGE_VERSION}.${exact ? `exact-rk-substeps-${produceRates}-${sourceCount?.rowStrideFloats ?? 32}` : 'legacy'}`, label: `ulg-${entryPoint}`, entryPoint,
          code: exact ? createSphExactVaporAerosolExchangeWgsl(sourceCount?.rowStrideFloats ?? 32, produceRates) : sphVaporAerosolExchangeWgsl,
          bindings: ['uniform', 'read-only-storage', produceRates ? 'storage' : 'read-only-storage', 'read-only-storage', 'storage', 'storage', 'storage',
            ...(exact ? ['storage', 'read-only-storage', 'uniform'] : [])]
            .map((type, binding) => computeBufferBinding(binding, type))
        });
        const bindGroup = device.createBindGroup({ layout: info.bindGroupLayout,
          entries: [params, from, edges, materials, to, surfaceBuffer, controlBuffer,
            ...(exact ? [work.projection, historyValidation, pressureGeometry] : [])]
            .map((value, binding) => ({ binding, resource: { buffer: value } })) });
        return { info, bindGroup, entryPoint, work, role };
      });
    const beginSubstep = rateSubsteps > 1 ? stages.pop() : null;
    const traced = {
      midpointSourceWords: predictorArena, midpointInitialRateWords: predictorRates,
      midpointPairWords: predictorWork?.output, midpointProjectionWords: predictorWork?.projection,
      midpointSurfaceValues: predictorSurfaces, rateWords: edges, exactPairWords: exactWork?.output,
      exactProjectionWords: exactWork?.projection, surfaceValues: surfaceBuffer, endpointSourceWords: outputArena
    };
    const substepStages = rateSubsteps > 1 ? Array.from({ length: rateSubsteps }, (_, i) =>
      Object.fromEntries(Object.entries(traced).map(([key, buffer]) => [key,
        cell.allocate(`substep-${i}-${key}`, buffer.size, READ_WRITE)]))) : [];
    // Writes are queue operations too. A later setup failure must retire them.
    queueTouched = true;
    device.queue.writeBuffer(params, 0, paramsData);
    device.queue.writeBuffer(edges, 0, edgeRows);
    device.queue.writeBuffer(materials, 0, packedMaterials);
    if (pressureGeometry) device.queue.writeBuffer(pressureGeometry, 0, geometryWords);
    const encoder = device.createCommandEncoder({ label: 'ulg-vapor-aerosol-exchange' });
    encoder.clearBuffer(sourceArena); encoder.clearBuffer(controlBuffer); encoder.clearBuffer(surfaceBuffer);
    if (historyProjection) historyProjection.encode(encoder);
    else if (exact) encoder.clearBuffer(historyValidation);
    for (const entry of segments) if (entry.source && entry.words) {
      encoder.copyBufferToBuffer(entry.source, entry.sourceOffset, sourceArena, entry.offset * 4, entry.words * 4);
    }
    encoder.copyBufferToBuffer(sourceArena, 0, outputArena, 0, wordCount * 4);
    for (let substep = 0; substep < rateSubsteps; substep++) {
      if (substep > 0) {
        encoder.copyBufferToBuffer(outputArena, 0, stepArena, 0, wordCount * 4);
        encoder.copyBufferToBuffer(outputArena, 0, predictorArena, 0, wordCount * 4);
        const pass = encoder.beginComputePass(); pass.setPipeline(beginSubstep.info.pipeline);
        pass.setBindGroup(0, beginSubstep.bindGroup); pass.dispatchWorkgroups(1); pass.end();
      }
      for (const [index, { info, bindGroup, entryPoint, work, role }] of stages.entries()) {
        if ((index === 0 && substep !== 0) || (index === stages.length - 1 && substep !== rateSubsteps - 1)) continue;
        const pass = encoder.beginComputePass(); pass.setPipeline(info.pipeline); pass.setBindGroup(0, bindGroup);
        const single = index === 0 || index === stages.length - 1
          || ['prepare_exact_vapor_midpoint', 'prepare_exact_vapor_endpoint'].includes(entryPoint);
        pass.dispatchWorkgroups(single ? 1 : edgeDispatch); pass.end();
        if (midpoint && index === 0) {
          encoder.copyBufferToBuffer(outputArena, 0, predictorArena, 0, wordCount * 4);
          if (stepArena !== sourceArena) encoder.copyBufferToBuffer(outputArena, 0, stepArena, 0, wordCount * 4);
        }
        if (exact && (produceRates ? entryPoint === 'produce_exact_vapor_rates' : index === 0)) {
          work.prepare(encoder, substep > 0 ? exactWork.output : null);
          if (!cellPressureWork) work.accumulate(encoder);
          if (role === 'predictor') encoder.copyBufferToBuffer(edges, 0, predictorRates, 0, edges.size);
        }
        if (entryPoint === 'prepare_exact_vapor_pressure') work.accumulate(encoder);
        if (entryPoint === 'prepare_exact_vapor_surface') {
          work.finish(encoder);
          if (role === 'predictor') encoder.copyBufferToBuffer(surfaceBuffer, 0, predictorSurfaces, 0, surfaceBuffer.size);
        }
        if (entryPoint === 'apply_exact_vapor_aerosol_exchange' && role === 'final'
            && substep === rateSubsteps - 1) exactEndpoints.encode(encoder);
      }
      if (substepStages.length) for (const [key, buffer] of Object.entries(traced)) {
        encoder.copyBufferToBuffer(buffer, 0, substepStages[substep][key], 0, buffer.size);
      }
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
      readyParcelCount: header[7], outputCountGeneration: exact ? null : header[8], outputCountSeal: exact ? null : header[9],
      candidateGeneration: header[8], productCountIssued: !exact && sourceHistory != null,
      expectedEosGeneration: header[10], words: Object.freeze([...header]) });
    dropSourceRead(); temporary.forEach(cell.destroy);
    return createCandidateOwner({ device, cell, ready, receipt, particleCount, productCapacity,
      aerosolCapacity, generation, stateBuffer: outputs.get(state), thermoBuffer: outputs.get(thermo),
      mechanicsBuffer: outputs.get(mechanics), productEventBuffer: outputs.get(product) ?? null,
      parcelBuffer: outputs.get(parcel), productCountBuffer: outputs.get(count) ?? null,
      surfaceBuffer, controlBuffer, sourceHistory, rateBuffer: produceRates ? edges : null,
      rateIntervalSeconds: produceRates ? current.dtSeconds : null, rateIntegration: produceRates ? rateIntegration : null,
      rateSubsteps: produceRates ? rateSubsteps : null, transportPacketMode, substepStages,
      midpointStage: midpoint ? { sourceBuffer: predictorArena, rateBuffer: predictorRates, surfaceBuffer: predictorSurfaces,
        pairBuffer: predictorWork.output, projectionBuffer: predictorWork.projection,
        productOffsetWords: product.offset, parcelOffsetWords: parcel.offset, pressureOffsetWords: pressure.offset } : null,
      dispatchCount: rateSubsteps * (stages.length - 2 + (exactWork?.dispatchCount ?? 0)
        + (predictorWork?.dispatchCount ?? 0)) + 2 + rateSubsteps - 1
        + (exactEndpoints?.dispatchCount ?? 0) + (historyProjection?.encodedDispatchCount ?? 0),
      exactQuantities: exactWork ? Object.freeze({ pairBuffer: exactWork.output, projectionBuffer: exactWork.projection,
        quantityLayout: exactWork.layout, format: exactWork.format, edgeCount,
        endpoints: Object.freeze({ particleBuffer: exactEndpoints.particleBuffer, particleLayout: exactEndpoints.particleLayout,
          aerosolBuffer: exactEndpoints.aerosolBuffer, aerosolLayout: exactEndpoints.aerosolLayout,
          historyBuffer: exactEndpoints.historyBuffer, historyLayout: exactEndpoints.historyLayout }) }) : null });
  } catch (error) {
    try { if (mapped) mapped.unmap(); } catch { /* Continue safe cleanup. */ }
    if (queueTouched && !cell.lost) await cell.queuePoint();
    cell.destroyAll(); dropSourceRead(); throw error;
  }
}

function createCandidateOwner({ device, cell, ready, receipt, particleCount, productCapacity,
  aerosolCapacity, generation, stateBuffer, thermoBuffer, mechanicsBuffer, productEventBuffer,
  parcelBuffer, productCountBuffer, surfaceBuffer, controlBuffer, sourceHistory, rateBuffer = null, rateIntervalSeconds = null,
  rateIntegration = null, rateSubsteps = null, transportPacketMode = 'exact-rational', substepStages = [], midpointStage = null, exactQuantities = null, dispatchCount = 3 }) {
  let owner, releaseRequested = false, released = false, observing = false, historyBorrows = 0, producerBorrows = 0;
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
    if (released || observing || (!cell.lost && (historyBorrows || producerBorrows))) return;
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
  const mintProducerRead = () => {
    producerBorrows++;
    let closed = false;
    const read = Object.freeze({
      stateBuffer, thermoBuffer, mechanicsBuffer, parcelBuffer, exactQuantities,
      validate() {
        if (this !== read || closed || released) throw new TypeError('Original live exchange producer read required');
        cell.assertLive(); return true;
      },
      retain() {
        read.validate.call(this);
        // Existing output readers may delegate their hold while public
        // retirement drains. No new reader may enter through the owner then.
        return mintProducerRead();
      },
      release() {
        if (this !== read) throw new TypeError('Original exchange producer read required');
        if (closed) return false;
        closed = true; producerBorrows--;
        if (releaseRequested) void finishRelease();
        return true;
      }
    });
    return read;
  };
  if (ready && productEventBuffer && !exactQuantities) {
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
    productEventBuffer, parcelBuffer, surfaceBuffer, controlBuffer, productCountBuffer, exactQuantities,
    residentProductMass: history, productEventLiveCountDescriptor: countDescriptor,
    sourceAuthority: false, kineticsAdmitted: false, exchangeIntervalAdmitted: false,
    published: false, residentAdopted: false, scientificValidation: false,
    pressureRequiresRefresh: true, mechanicsContinuationAdmitted: false, outerPublicationAdmitted: false,
    readbackByteLength: 64, dispatchCount, rateIntervalSeconds, rateIntegration, rateSubsteps, transportPacketMode,
    retainProducer() {
      if (this !== owner) throw new TypeError('Exact exchange resource owner required');
      assertReadable();
      if (!ready || !exactQuantities) throw new TypeError('Complete exact exchange output required');
      return mintProducerRead();
    },
    async observe() {
      if (this !== owner) throw new TypeError('Exact exchange resource owner required');
      assertReadable(); observing = true;
      let staging = null, mapped = false, submitted = false;
      try {
        const rows = [['stateValues', stateBuffer, Float32Array], ['thermoValues', thermoBuffer, Float32Array],
          ['mechanicsValues', mechanicsBuffer, Float32Array], ['productEventValues', productEventBuffer, Float32Array],
          ['parcelWords', parcelBuffer, Uint32Array], ['surfaceValues', surfaceBuffer, Float32Array],
          ['rateWords', rateBuffer, Uint32Array],
          ['midpointSourceWords', midpointStage?.sourceBuffer, Uint32Array],
          ['midpointInitialRateWords', midpointStage?.rateBuffer, Uint32Array],
          ['midpointPairWords', midpointStage?.pairBuffer, Uint32Array],
          ['midpointProjectionWords', midpointStage?.projectionBuffer, Uint32Array],
          ['midpointSurfaceValues', midpointStage?.surfaceBuffer, Float32Array],
          ['productCountWords', productCountBuffer, Uint32Array], ['controlWords', controlBuffer, Uint32Array],
          ['exactPairWords', exactQuantities?.pairBuffer, Uint32Array], ['exactProjectionWords', exactQuantities?.projectionBuffer, Uint32Array],
          ['exactParticleWords', exactQuantities?.endpoints.particleBuffer, Uint32Array],
          ['exactAerosolWords', exactQuantities?.endpoints.aerosolBuffer, Uint32Array],
          ['exactHistoryWords', exactQuantities?.endpoints.historyBuffer, Uint32Array]];
        substepStages.forEach((stage, index) => {
          for (const [key, buffer] of Object.entries(stage)) rows.push([`substep${index}:${key}`, buffer,
            key.endsWith('Values') ? Float32Array : Uint32Array]);
        });
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
        return { ready, status, receipt, rateIntervalSeconds, rateIntegration, rateSubsteps, transportPacketMode,
          midpointViewLayout: midpointStage ? { productOffsetWords: midpointStage.productOffsetWords,
            parcelOffsetWords: midpointStage.parcelOffsetWords, pressureOffsetWords: midpointStage.pressureOffsetWords } : null,
          ...Object.fromEntries(ranges.map((range) => [range.key,
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
