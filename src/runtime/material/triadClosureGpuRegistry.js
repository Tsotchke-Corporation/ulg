import {
  RESPONSE_FUNCTION_GPU_HEADER_FLOATS,
  RESPONSE_FUNCTION_GPU_RECORD_FLOATS,
  RESPONSE_FUNCTION_GPU_SCHEMA
} from './responseFunctionGpu.js';
import { eshkolTriadClosuresWgsl } from './eshkolTriadClosures.js';
import { stableOpticalMaterialId } from './opticalGpuBuffers.js';
import {
  deferSubmittedWorkCleanup,
  unwrapWebGpuCacheDevice
} from '../webgpuComputeLayout.js';

export const ULG_TRIAD_CLOSURE_GPU_REGISTRY_SCHEMA = 'peercompute.ulg.triad-closure-gpu-registry.v1';
export const TRIAD_CLOSURE_MATERIAL_MAP_WORDS_PER_ROW = 8; // 2 x vec4<u32>
export const TRIAD_CLOSURE_RECEIPT_WORDS = 8;
export const TRIAD_CLOSURE_ABSENT_SLOT = 0xffffffff;

const GPU_BUFFER_USAGE = {
  MAP_READ: 0x0001,
  COPY_SRC: 0x0004,
  COPY_DST: 0x0008,
  STORAGE: 0x0080
};

const TRIAD_REGISTRY_SYM = Symbol.for('ulg.triadClosureRegistryByDevice.v1');
const registryByDevice = (globalThis[TRIAD_REGISTRY_SYM] ??= new WeakMap());

/**
 * Unpack an already-packed RESPONSE_FUNCTION_GPU_SCHEMA Float32Array into
 * individual function record/coefficient slices without refitting.
 */
export function unpackPackedResponseTable(data) {
  if (!(data instanceof Float32Array) || data.length < RESPONSE_FUNCTION_GPU_HEADER_FLOATS) {
    return [];
  }
  const count = Math.floor(data[0]);
  const coeffBase = Math.floor(data[1]);
  if (!(count > 0) || coeffBase < RESPONSE_FUNCTION_GPU_HEADER_FLOATS + count * RESPONSE_FUNCTION_GPU_RECORD_FLOATS) {
    return [];
  }
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const recOff = RESPONSE_FUNCTION_GPU_HEADER_FLOATS + i * RESPONSE_FUNCTION_GPU_RECORD_FLOATS;
    const record = data.slice(recOff, recOff + RESPONSE_FUNCTION_GPU_RECORD_FLOATS);
    const axes = Math.max(1, Math.min(3, Math.floor(record[0])));
    const n0 = Math.max(1, Math.floor(record[2]));
    const n1 = axes >= 2 ? Math.max(1, Math.floor(record[3])) : 1;
    const n2 = axes >= 3 ? Math.max(1, Math.floor(record[4])) : 1;
    const coeffCount = n0 * n1 * n2;
    const coeffStart = coeffBase + Math.floor(record[1]);
    if (coeffStart + coeffCount > data.length) {
      throw new RangeError(`Packed response function ${i} exceeds table length`);
    }
    out.push({
      record,
      coefficients: data.slice(coeffStart, coeffStart + coeffCount)
    });
  }
  return out;
}

/**
 * Merge a list of unpacked response function slices into one packed
 * RESPONSE_FUNCTION_GPU_SCHEMA Float32Array.
 */
export function packUnpackedResponseSlices(slices) {
  if (!Array.isArray(slices) || slices.length === 0) {
    return new Float32Array(RESPONSE_FUNCTION_GPU_HEADER_FLOATS);
  }
  const count = slices.length;
  const coeffBase = RESPONSE_FUNCTION_GPU_HEADER_FLOATS + count * RESPONSE_FUNCTION_GPU_RECORD_FLOATS;
  let totalCoeffs = 0;
  for (const s of slices) totalCoeffs += s.coefficients.length;
  const data = new Float32Array(coeffBase + totalCoeffs);
  data[0] = count;
  data[1] = coeffBase;
  let coeffOffset = 0;
  for (let i = 0; i < count; i += 1) {
    const recOff = RESPONSE_FUNCTION_GPU_HEADER_FLOATS + i * RESPONSE_FUNCTION_GPU_RECORD_FLOATS;
    const rec = slices[i].record;
    data.set(rec, recOff);
    data[recOff + 1] = coeffOffset;
    data.set(slices[i].coefficients, coeffBase + coeffOffset);
    coeffOffset += slices[i].coefficients.length;
  }
  return data;
}

function getOrCreateDeviceState(device) {
  const key = unwrapWebGpuCacheDevice(device);
  let state = registryByDevice.get(key);
  if (state) return state;
  state = {
    device,
    generation: 0,
    gasByMaterialId: new Map(), // materialId -> { materialKey, slots: { soundSpeed, viscosity, conductivity, density }, slices }
    triadByMaterialId: new Map(), // materialId -> { materialKey, sourceFingerprint, slices[5], g6DebyeSamples }
    tableBuffer: null,
    materialMapBuffer: null,
    packedTableAndMapBuffer: null,
    receiptBuffer: null,
    tableByteLength: 0,
    materialCount: 0,
    functionCount: 0,
    dirty: false,
    destroyed: false
  };
  registryByDevice.set(key, state);
  return state;
}

function retireBufferSafely(device, buffer) {
  if (!buffer) return;
  try {
    deferSubmittedWorkCleanup(device, () => {
      try { buffer.destroy?.(); } catch {}
    });
  } catch {
    try { buffer.destroy?.(); } catch {}
  }
}

function rebuildDeviceBuffers(state) {
  const { device } = state;
  if (!device?.createBuffer || !device?.queue?.writeBuffer) return false;
  const materialIds = Array.from(
    new Set([...state.gasByMaterialId.keys(), ...state.triadByMaterialId.keys()])
  ).sort((a, b) => a - b);
  if (materialIds.length === 0) return false;

  const slices = [];
  const mapWords = new Uint32Array(materialIds.length * TRIAD_CLOSURE_MATERIAL_MAP_WORDS_PER_ROW);
  mapWords.fill(TRIAD_CLOSURE_ABSENT_SLOT);

  for (let i = 0; i < materialIds.length; i += 1) {
    const matId = materialIds[i];
    const rowOff = i * TRIAD_CLOSURE_MATERIAL_MAP_WORDS_PER_ROW;
    mapWords[rowOff] = matId >>> 0;

    const triad = state.triadByMaterialId.get(matId);
    if (triad && triad.slices.length === 5) {
      const base = slices.length;
      for (const s of triad.slices) slices.push(s);
      mapWords[rowOff + 1] = base;     // helmholtz slot
      mapWords[rowOff + 2] = base + 1; // solidHyperelastic slot
      mapWords[rowOff + 3] = base + 2; // transport base slot (k, mu, D)
    }

    const gas = state.gasByMaterialId.get(matId);
    if (gas) {
      if (gas.soundSpeed) {
        mapWords[rowOff + 4] = slices.length;
        slices.push(gas.soundSpeed);
      }
      if (gas.dynamicViscosity) {
        mapWords[rowOff + 5] = slices.length;
        slices.push(gas.dynamicViscosity);
      }
      if (gas.thermalConductivity) {
        mapWords[rowOff + 6] = slices.length;
        slices.push(gas.thermalConductivity);
      }
      if (gas.density) {
        mapWords[rowOff + 7] = slices.length;
        slices.push(gas.density);
      }
    }
  }

  if (slices.length === 0) return false;
  const packed = packUnpackedResponseSlices(slices);
  const nextTable = device.createBuffer({
    label: `ulg-triad-a4-unified-table-g${state.generation + 1}`,
    size: Math.max(16, packed.byteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
  });
  device.queue.writeBuffer(nextTable, 0, packed);

  const nextMap = device.createBuffer({
    label: `ulg-triad-a4-material-map-g${state.generation + 1}`,
    size: Math.max(32, mapWords.byteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
  });
  device.queue.writeBuffer(nextMap, 0, mapWords);

  // Combined read-only buffer packing [tableFloats..., mapWordsAsF32..., bitcast(mapStart), bitcast(mapRowCount)]
  // so downstream kernels stay within baseline WebGPU storage-buffer limits without extra bindings.
  const packedWithMapWords = packed.length + mapWords.length + 2;
  const packedWithMapBytes = new ArrayBuffer(packedWithMapWords * 4);
  const packedWithMapF32 = new Float32Array(packedWithMapBytes);
  const packedWithMapU32 = new Uint32Array(packedWithMapBytes);
  packedWithMapF32.set(packed, 0);
  packedWithMapU32.set(mapWords, packed.length);
  packedWithMapU32[packed.length + mapWords.length] = packed.length >>> 0;
  packedWithMapU32[packed.length + mapWords.length + 1] = materialIds.length >>> 0;
  const nextPackedWithMap = device.createBuffer({
    label: `ulg-triad-a4-packed-table-map-g${state.generation + 1}`,
    size: Math.max(32, packedWithMapBytes.byteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
  });
  device.queue.writeBuffer(nextPackedWithMap, 0, packedWithMapBytes);

  if (!state.receiptBuffer) {
    state.receiptBuffer = device.createBuffer({
      label: 'ulg-triad-a4-envelope-receipt',
      size: TRIAD_CLOSURE_RECEIPT_WORDS * Uint32Array.BYTES_PER_ELEMENT,
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.COPY_SRC
    });
    device.queue.writeBuffer(
      state.receiptBuffer,
      0,
      new Uint32Array(TRIAD_CLOSURE_RECEIPT_WORDS)
    );
  }

  const prevTable = state.tableBuffer;
  const prevMap = state.materialMapBuffer;
  const prevPackedWithMap = state.packedTableAndMapBuffer;
  state.tableBuffer = nextTable;
  state.materialMapBuffer = nextMap;
  state.packedTableAndMapBuffer = nextPackedWithMap;
  state.tableByteLength = packed.byteLength;
  state.materialCount = materialIds.length;
  state.functionCount = slices.length;
  state.generation += 1;
  state.dirty = false;

  // Record active generation in word 7 of the receipt without clobbering hit counters.
  device.queue.writeBuffer(
    state.receiptBuffer,
    7 * Uint32Array.BYTES_PER_ELEMENT,
    new Uint32Array([state.generation])
  );

  if (prevTable) retireBufferSafely(device, prevTable);
  if (prevMap) retireBufferSafely(device, prevMap);
  if (prevPackedWithMap) retireBufferSafely(device, prevPackedWithMap);
  publishGlobalStatus(state);
  return true;
}

function publishGlobalStatus(state) {
  const status = buildStatusSnapshot(state);
  globalThis.__ulgTriadA4ClosureStatus = status;
  return status;
}

function buildStatusSnapshot(state) {
  if (!state) {
    return Object.freeze({
      schema: ULG_TRIAD_CLOSURE_GPU_REGISTRY_SCHEMA,
      active: false,
      generation: 0,
      materialCount: 0,
      triadMaterialCount: 0,
      gasMaterialCount: 0,
      functionCount: 0,
      tableByteLength: 0,
      triadMaterials: Object.freeze([]),
      gasMaterials: Object.freeze([])
    });
  }
  return Object.freeze({
    schema: ULG_TRIAD_CLOSURE_GPU_REGISTRY_SCHEMA,
    active: Boolean(state.tableBuffer && state.materialMapBuffer && state.receiptBuffer && state.functionCount > 0),
    generation: state.generation,
    materialCount: state.materialCount,
    triadMaterialCount: state.triadByMaterialId.size,
    gasMaterialCount: state.gasByMaterialId.size,
    functionCount: state.functionCount,
    tableByteLength: state.tableByteLength,
    triadMaterials: Object.freeze(Array.from(state.triadByMaterialId.values(), (entry) => entry.materialKey)),
    gasMaterials: Object.freeze(Array.from(state.gasByMaterialId.values(), (entry) => entry.materialKey))
  });
}

/**
 * Seed A4 2-D `(T, P)` gas response functions from a mechanics material table
 * into the device's unified Triad A4 GPU registry.
 */
export function registerGasResponseTableOnDevice(device, {
  a4GasResponseTable = null,
  a4GasResponseByMaterial = null
} = {}) {
  if (!device || !a4GasResponseTable?.data || !a4GasResponseByMaterial) return null;
  const allSlices = unpackPackedResponseTable(a4GasResponseTable.data);
  if (allSlices.length === 0) return null;
  const state = getOrCreateDeviceState(device);
  let changed = false;
  for (const [materialKey, entry] of Object.entries(a4GasResponseByMaterial)) {
    const matId = Number.isInteger(entry?.materialId)
      ? entry.materialId
      : stableOpticalMaterialId(materialKey);
    const soundIdx = entry?.soundSpeedIndex;
    const viscIdx = entry?.dynamicViscosityIndex;
    const condIdx = entry?.thermalConductivityIndex;
    const densIdx = entry?.densityIndex;
    const gasRecord = {
      materialKey,
      soundSpeed: Number.isInteger(soundIdx) && soundIdx < allSlices.length ? allSlices[soundIdx] : null,
      dynamicViscosity: Number.isInteger(viscIdx) && viscIdx < allSlices.length ? allSlices[viscIdx] : null,
      thermalConductivity: Number.isInteger(condIdx) && condIdx < allSlices.length ? allSlices[condIdx] : null,
      density: Number.isInteger(densIdx) && densIdx < allSlices.length ? allSlices[densIdx] : null,
      sourceFingerprint: entry?.sourceFingerprint ?? null
    };
    const prev = state.gasByMaterialId.get(matId);
    if (!prev || prev.sourceFingerprint !== gasRecord.sourceFingerprint) {
      state.gasByMaterialId.set(matId, gasRecord);
      changed = true;
    }
  }
  if (changed || !state.tableBuffer) {
    rebuildDeviceBuffers(state);
  }
  return buildStatusSnapshot(state);
}

/**
 * Register a synthesized Eshkol Triad 5-slot A4 closure bundle
 * (Helmholtz a(T,v), Solid Psi(J,T), Transport k/mu/D) onto a WebGPU device
 * at a committed schedule boundary.
 */
export function registerTriadClosureBundleOnDevice(device, {
  materialKey,
  materialId = null,
  packedData,
  sourceFingerprint = null,
  g6DebyeSamples = null
} = {}) {
  if (!device || !materialKey) return null;
  const floatData = packedData instanceof Float32Array
    ? packedData
    : (packedData?.data instanceof Float32Array
        ? packedData.data
        : (ArrayBuffer.isView(packedData) ? new Float32Array(packedData.buffer, packedData.byteOffset, packedData.byteLength / 4) : null));
  if (!floatData || floatData.length < RESPONSE_FUNCTION_GPU_HEADER_FLOATS) return null;
  const slices = unpackPackedResponseTable(floatData);
  if (slices.length !== 5) {
    throw new RangeError(`Triad A4 closure bundle expects 5 slots, got ${slices.length}`);
  }
  const matId = Number.isInteger(materialId)
    ? materialId
    : stableOpticalMaterialId(String(materialKey));
  const state = getOrCreateDeviceState(device);
  const prev = state.triadByMaterialId.get(matId);
  if (prev && sourceFingerprint && prev.sourceFingerprint === sourceFingerprint && state.tableBuffer) {
    return buildStatusSnapshot(state);
  }
  state.triadByMaterialId.set(matId, {
    materialKey: String(materialKey),
    sourceFingerprint: sourceFingerprint ?? null,
    slices,
    g6DebyeSamples: Array.isArray(g6DebyeSamples) ? g6DebyeSamples : null
  });
  rebuildDeviceBuffers(state);
  return buildStatusSnapshot(state);
}

export function getTriadClosureGpuBinding(device) {
  const state = device ? registryByDevice.get(unwrapWebGpuCacheDevice(device)) : null;
  if (!state || !state.tableBuffer || !state.materialMapBuffer || !state.receiptBuffer || state.functionCount <= 0) {
    return Object.freeze({
      active: false,
      generation: 0,
      materialCount: 0,
      functionCount: 0,
      tableBuffer: null,
      materialMapBuffer: null,
      packedTableAndMapBuffer: null,
      receiptBuffer: null,
      status: buildStatusSnapshot(state)
    });
  }
  return Object.freeze({
    active: true,
    generation: state.generation,
    materialCount: state.materialCount,
    functionCount: state.functionCount,
    tableBuffer: state.tableBuffer,
    materialMapBuffer: state.materialMapBuffer,
    packedTableAndMapBuffer: state.packedTableAndMapBuffer ?? state.tableBuffer,
    receiptBuffer: state.receiptBuffer,
    status: buildStatusSnapshot(state)
  });
}

export function getTriadClosureDeviceStatus(device) {
  const state = device ? registryByDevice.get(unwrapWebGpuCacheDevice(device)) : null;
  return buildStatusSnapshot(state);
}

/**
 * Diagnostic-only async readback of the compact 32-byte GPU envelope receipt.
 * Never called in the normal physics hot loop.
 */
export async function readTriadClosureEnvelopeReceipt(device) {
  const binding = getTriadClosureGpuBinding(device);
  if (!binding.active || !binding.receiptBuffer) return null;
  const byteLength = TRIAD_CLOSURE_RECEIPT_WORDS * Uint32Array.BYTES_PER_ELEMENT;
  const staging = device.createBuffer({
    label: 'ulg-triad-a4-receipt-readback',
    size: byteLength,
    usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
  });
  try {
    const encoder = device.createCommandEncoder({ label: 'ulg-triad-a4-receipt-copy' });
    encoder.copyBufferToBuffer(binding.receiptBuffer, 0, staging, 0, byteLength);
    device.queue.submit([encoder.finish()]);
    await staging.mapAsync(GPU_BUFFER_USAGE.MAP_READ);
    const words = new Uint32Array(staging.getMappedRange().slice(0));
    staging.unmap();
    return Object.freeze({
      evalCount: words[0],
      helmholtzHits: words[1],
      solidHits: words[2],
      transportHits: words[3],
      gasA4Hits: words[4],
      outOfBoxMisses: words[5],
      fallbackCount: words[6],
      generation: words[7]
    });
  } finally {
    staging.destroy();
  }
}

export function destroyTriadClosureRegistry(device) {
  const key = device ? unwrapWebGpuCacheDevice(device) : null;
  const state = key ? registryByDevice.get(key) : null;
  if (!state || state.destroyed) return false;
  state.destroyed = true;
  if (state.tableBuffer) retireBufferSafely(device, state.tableBuffer);
  if (state.materialMapBuffer) retireBufferSafely(device, state.materialMapBuffer);
  if (state.packedTableAndMapBuffer) retireBufferSafely(device, state.packedTableAndMapBuffer);
  if (state.receiptBuffer) retireBufferSafely(device, state.receiptBuffer);
  state.tableBuffer = null;
  state.materialMapBuffer = null;
  state.packedTableAndMapBuffer = null;
  state.receiptBuffer = null;
  state.gasByMaterialId.clear();
  state.triadByMaterialId.clear();
  registryByDevice.delete(key);
  return true;
}

/**
 * WGSL helper block evaluating the unified Triad A4 + Gas A4 resident table
 * strictly inside certified boxes (`ok == 1`), falling back cleanly to closed
 * form outside the box and counting hits/misses in `triad_envelope_receipt`.
 */
export function triadClosureMechanicsRefreshWgsl({
  packedMap = false,
  tableBinding = 9,
  mapBinding = 10,
  receiptBinding = 11,
  sharedReceiptVar = null,
  sharedReceiptBaseWord = 0
} = {}) {
  const useSharedReceipt = Boolean(sharedReceiptVar);
  const receiptVar = useSharedReceipt ? String(sharedReceiptVar) : 'triad_envelope_receipt';
  const receiptWord = (idx) => `${receiptVar}[${Math.max(0, Math.trunc(Number(sharedReceiptBaseWord) || 0)) + idx}u]`;
  const bindingsDecl = [
    `@group(0) @binding(${tableBinding}) var<storage, read> triad_a4_table: array<f32>;`,
    ...(packedMap ? [] : [`@group(0) @binding(${mapBinding}) var<storage, read> triad_material_map: array<vec4<u32>>;`]),
    ...(useSharedReceipt ? [] : [`@group(0) @binding(${receiptBinding}) var<storage, read_write> triad_envelope_receipt: array<atomic<u32>>;`])
  ].join('\n');
  const lookupBody = packedMap
    ? `  let total_words = arrayLength(&triad_a4_table);
  if (total_words < 10u) { return out; }
  let map_base = bitcast<u32>(triad_a4_table[total_words - 2u]);
  let row_count = bitcast<u32>(triad_a4_table[total_words - 1u]);
  for (var i = 0u; i < row_count; i = i + 1u) {
    let base = map_base + i * 8u;
    if (base + 7u >= total_words - 2u) { break; }
    let mat_w = bitcast<u32>(triad_a4_table[base]);
    if (mat_w == material_id) {
      out.found = 1u;
      out.helmholtz_slot = bitcast<u32>(triad_a4_table[base + 1u]);
      out.solid_slot = bitcast<u32>(triad_a4_table[base + 2u]);
      out.transport_base = bitcast<u32>(triad_a4_table[base + 3u]);
      out.gas_sound_slot = bitcast<u32>(triad_a4_table[base + 4u]);
      out.gas_visc_slot = bitcast<u32>(triad_a4_table[base + 5u]);
      out.gas_cond_slot = bitcast<u32>(triad_a4_table[base + 6u]);
      out.gas_dens_slot = bitcast<u32>(triad_a4_table[base + 7u]);
      return out;
    }
  }`
    : `  let row_count = arrayLength(&triad_material_map) / 2u;
  for (var i = 0u; i < row_count; i = i + 1u) {
    let r0 = triad_material_map[i * 2u];
    if (r0.x == material_id) {
      let r1 = triad_material_map[i * 2u + 1u];
      out.found = 1u;
      out.helmholtz_slot = r0.y;
      out.solid_slot = r0.z;
      out.transport_base = r0.w;
      out.gas_sound_slot = r1.x;
      out.gas_visc_slot = r1.y;
      out.gas_cond_slot = r1.z;
      out.gas_dens_slot = r1.w;
      return out;
    }
  }`;
  return /* wgsl */ `
${bindingsDecl}

${eshkolTriadClosuresWgsl('triad_a4_table')}

const TRIAD_ABSENT_SLOT: u32 = ${TRIAD_CLOSURE_ABSENT_SLOT}u;

struct TriadMaterialSlots {
  found: u32,
  helmholtz_slot: u32,
  solid_slot: u32,
  transport_base: u32,
  gas_sound_slot: u32,
  gas_visc_slot: u32,
  gas_cond_slot: u32,
  gas_dens_slot: u32,
};

fn triad_lookup_material_slots(material_id: u32) -> TriadMaterialSlots {
  var out: TriadMaterialSlots;
  out.found = 0u;
  out.helmholtz_slot = TRIAD_ABSENT_SLOT;
  out.solid_slot = TRIAD_ABSENT_SLOT;
  out.transport_base = TRIAD_ABSENT_SLOT;
  out.gas_sound_slot = TRIAD_ABSENT_SLOT;
  out.gas_visc_slot = TRIAD_ABSENT_SLOT;
  out.gas_cond_slot = TRIAD_ABSENT_SLOT;
  out.gas_dens_slot = TRIAD_ABSENT_SLOT;
${lookupBody}
  return out;
}

fn apply_triad_a4_mechanics_envelopes(
  material_id_f: f32,
  temperature_k: f32,
  current_density: f32,
  volume_ratio_j: f32,
  base: PhaseMechanics
) -> PhaseMechanics {
  var out = base;
  if (!(temperature_k > 0.0) || !(current_density > 0.0) || !(volume_ratio_j > 0.0)) {
    return out;
  }
  let mat_id = u32(max(0.0, floor(material_id_f + 0.5)));
  let slots = triad_lookup_material_slots(mat_id);
  if (slots.found == 0u) {
    return out;
  }
  atomicAdd(&${receiptWord(0)}, 1u);

  // 1. A4 2-D (T, P) Gas response closures (strict in-box, CFL-ceiling safe).
  if (base.eos_model == 2.0 && slots.gas_sound_slot != TRIAD_ABSENT_SLOT) {
    let c_sq = base.sound_speed * base.sound_speed;
    let p_est = max(1.0, current_density * c_sq / 1.4);
    let r_cs = rf_eval(slots.gas_sound_slot, vec3<f32>(temperature_k, p_est, 0.0));
    if (r_cs.y == 1.0 && r_cs.x > 0.0 && rf_finite(r_cs.x)) {
      // Never exceed the CFL-admitted sound speed cap on explicit lanes.
      out.sound_speed = min(r_cs.x, max(base.sound_speed, 1.0));
      atomicAdd(&${receiptWord(4)}, 1u);
    } else {
      atomicAdd(&${receiptWord(5)}, 1u);
    }
    if (base.dynamic_viscosity > 0.0 && slots.gas_visc_slot != TRIAD_ABSENT_SLOT) {
      let r_mu = rf_eval(slots.gas_visc_slot, vec3<f32>(temperature_k, p_est, 0.0));
      if (r_mu.y == 1.0 && r_mu.x > 0.0 && rf_finite(r_mu.x)) {
        out.dynamic_viscosity = r_mu.x;
        atomicAdd(&${receiptWord(4)}, 1u);
      } else {
        atomicAdd(&${receiptWord(5)}, 1u);
      }
    }
  }

  // 2. Triad Eshkol Transport mu(T, rho) closure (only when viscosity enabled).
  if (slots.transport_base != TRIAD_ABSENT_SLOT) {
    let tr = triad_eval_transport(
      slots.transport_base,
      slots.transport_base + 1u,
      slots.transport_base + 2u,
      temperature_k,
      current_density
    );
    if (tr.w == 1.0) {
      if (base.dynamic_viscosity > 0.0 && base.eos_model != 2.0) {
        out.dynamic_viscosity = tr.y;
      }
      atomicAdd(&${receiptWord(3)}, 1u);
    } else {
      atomicAdd(&${receiptWord(5)}, 1u);
    }
  }

  // 3. Triad Eshkol Solid Hyperelastic Psi(J, T) tangent stiffness envelope.
  if (base.solid > 0.5 && slots.solid_slot != TRIAD_ABSENT_SLOT) {
    let sol = triad_eval_solid_hyperelastic(slots.solid_slot, volume_ratio_j, temperature_k);
    if (sol.w == 1.0) {
      atomicAdd(&${receiptWord(2)}, 1u);
      if (base.bulk > 0.0 && sol.z > 0.0 && sol.z <= base.bulk) {
        out.bulk = sol.z;
      }
    } else {
      atomicAdd(&${receiptWord(5)}, 1u);
    }
  }

  // 4. Triad Eshkol Fluid Helmholtz a(T, v) Maxwell-consistent K_T envelope.
  if (base.solid <= 0.5 && slots.helmholtz_slot != TRIAD_ABSENT_SLOT) {
    let v_spec = 1.0 / current_density;
    let helm = triad_eval_helmholtz(slots.helmholtz_slot, temperature_k, v_spec);
    if (helm.ok == 1u) {
      atomicAdd(&${receiptWord(1)}, 1u);
      if (base.bulk > 0.0 && helm.bulk_modulus_kt_pa > 0.0 && helm.bulk_modulus_kt_pa <= base.bulk) {
        out.bulk = helm.bulk_modulus_kt_pa;
      }
    } else {
      atomicAdd(&${receiptWord(5)}, 1u);
    }
  }

  return out;
}
`;
}

export { RESPONSE_FUNCTION_GPU_SCHEMA };
