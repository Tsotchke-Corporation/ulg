import {
  computeBufferBinding,
  createCachedExplicitComputePipeline
} from '../webgpuComputeLayout.js';
import {
  SPH_THERMAL_WALL_FACE_IDS,
  SPH_THERMAL_WALL_MODEL_FINITE
} from '../thermalEnvironmentAuthority.js';

// Honest walls (finite heat capacity). One GPU-resident record per scene wall
// instance. The first 64 u32 words retain the legacy layout below; a canonical
// energy companion extends the complete record to 128 words.
//   [0..5]   face temperature K (f32 bits), x min, x max, y min, y max, z min, z max
//   [6..11]  face heat capacity J/K (f32 bits)
//   [12..17] pending energy into the face this step, J (f32 bits, CAS-added)
//   [18..23] cumulative energy into the face since the scene start, J (f32
//            bits, a display copy of the exact total below)
//   [24] magic, [25] version, [26] update count
//   [32..37] initial face temperature K (f32 bits)
//   [48..53] exact cumulative energy, low u32 of a signed 64-bit count of
//            1 microjoule quanta; [54..59] the high (signed) u32
// The face temperature is always T0 + total / C from the exact 64-bit total:
// a per-step increment (often far below one f32 ulp of the temperature) is
// never rounded away, and the total cannot drift with the step count.
// Exchangers (the fluid thermal kernel and the rigid-solid thermal stage) read
// the face temperatures through their uniform params (a GPU copy of words
// 0..5, so the existing wall-temperature reads stay unchanged) and add the
// energy each parcel gave the face into words 12..17. One update pass per step
// then moves each face temperature by pending / C and clears the pending word.
export const SPH_FINITE_WALL_STATE_WORDS = 64;
export const SPH_FINITE_WALL_STATE_MAGIC = 0x46574c31;
export const SPH_FINITE_WALL_STATE_VERSION = 3;
export const SPH_FINITE_WALL_ENERGY_QUANTUM_J = 1e-6;
export const SPH_FINITE_WALL_PENDING_FIRST_WORD = 12;
// The canonical companion uses signed energy words in the carrier ledger's
// basis. Legacy consumers keep their first 64 words; a legacy write marks the
// companion unavailable instead of pretending rounded history was exact.
export const SPH_FINITE_WALL_CANONICAL_WORDS = 128;
export const SPH_FINITE_WALL_CANONICAL_MAGIC = 0x46574531;
const STATE_BYTES = SPH_FINITE_WALL_CANONICAL_WORDS * 4;
const BUFFER_USAGE = Object.freeze({
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 0x80,
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 0x04,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 0x08
});

/** WGSL helper that adds energy (J) into a face's pending word. */
export function sphFiniteWallEnergyAddWgsl(bufferName) {
  return `
fn finite_wall_energy_add(face: u32, energy_j: f32) {
  if (face >= 6u || energy_j == 0.0 || energy_j != energy_j
      || arrayLength(&${bufferName}) < ${SPH_FINITE_WALL_STATE_WORDS}u) { return; }
  let word = ${SPH_FINITE_WALL_PENDING_FIRST_WORD}u + face;
  var prior = atomicLoad(&${bufferName}[word]);
  loop {
    let next = bitcast<u32>(bitcast<f32>(prior) + energy_j);
    let exchanged = atomicCompareExchangeWeak(&${bufferName}[word], prior, next);
    if (exchanged.exchanged) { break; }
    prior = exchanged.old_value;
  }
}
`;
}

export const sphFiniteWallUpdateWgsl = /* wgsl */ `
@group(0) @binding(0) var<storage, read_write> wall: array<atomic<u32>>;

@compute @workgroup_size(1)
fn update_finite_walls() {
  if (arrayLength(&wall) < ${SPH_FINITE_WALL_STATE_WORDS}u
      || atomicLoad(&wall[24u]) != ${SPH_FINITE_WALL_STATE_MAGIC}u) { return; }
  if (arrayLength(&wall) >= ${SPH_FINITE_WALL_CANONICAL_WORDS}u) {
    atomicStore(&wall[126u], 1u);
    if (atomicLoad(&wall[25u]) != ${SPH_FINITE_WALL_STATE_VERSION}u) { return; }
  }
  for (var face = 0u; face < 6u; face = face + 1u) {
    let energy = bitcast<f32>(atomicExchange(&wall[${SPH_FINITE_WALL_PENDING_FIRST_WORD}u + face], 0u));
    let capacity = bitcast<f32>(atomicLoad(&wall[6u + face]));
    if (!(capacity > 0.0) || energy != energy) { continue; }
    // Exact cumulative energy: a signed 64-bit count of microjoule quanta.
    let quanta = i32(clamp(round(energy / 1.0e-6),
      -2147483520.0, 2147483520.0));
    let lo = atomicLoad(&wall[48u + face]);
    let hi = atomicLoad(&wall[54u + face]);
    let add_lo = bitcast<u32>(quanta);
    let add_hi = select(0u, 0xffffffffu, quanta < 0);
    let next_lo = lo + add_lo;
    let carry = select(0u, 1u, next_lo < lo);
    let next_hi = hi + add_hi + carry;
    atomicStore(&wall[48u + face], next_lo);
    atomicStore(&wall[54u + face], next_hi);
    let total = f32(bitcast<i32>(next_hi)) * (4294967296.0 * 1.0e-6)
      + f32(next_lo) * 1.0e-6;
    atomicStore(&wall[18u + face], bitcast<u32>(total));
    let initial = bitcast<f32>(atomicLoad(&wall[32u + face]));
    atomicStore(&wall[face], bitcast<u32>(max(0.0, initial + total / capacity)));
  }
  atomicAdd(&wall[26u], 1u);
}
`;

const statesByDevice = new WeakMap();
const stateOwners = new WeakMap();
const STATE_CACHE_LIMIT = 4;

function initialWords(authority) {
  const words = new ArrayBuffer(STATE_BYTES);
  const f = new Float32Array(words);
  const u = new Uint32Array(words);
  SPH_THERMAL_WALL_FACE_IDS.forEach((faceId, index) => {
    f[index] = Number(authority.faces[faceId]);
    f[6 + index] = Number(authority.faceHeatCapacitiesJPerK[faceId]);
    f[32 + index] = Number(authority.faces[faceId]);
  });
  u[24] = SPH_FINITE_WALL_STATE_MAGIC;
  u[25] = SPH_FINITE_WALL_STATE_VERSION;
  u[118] = SPH_FINITE_WALL_CANONICAL_MAGIC;
  u[119] = 1;
  return words;
}

/**
 * The GPU-resident state of one finite-wall instance on a device, created on
 * first use with the authority's initial face temperatures and capacities.
 * Returns null for any non-finite wall model.
 */
export function sphFiniteWallStateFor(device, authority) {
  if (
    authority?.model !== SPH_THERMAL_WALL_MODEL_FINITE
    || authority.finiteCapacity !== true
    || !authority.instanceId
    || !device?.createBuffer
  ) {
    return null;
  }
  let states = statesByDevice.get(device);
  if (!states) {
    states = new Map();
    statesByDevice.set(device, states);
  }
  const existing = states.get(authority.instanceId);
  if (existing) {
    states.delete(authority.instanceId);
    states.set(authority.instanceId, existing);
    return existing;
  }
  if (states.size >= STATE_CACHE_LIMIT) {
    const available = [...states.entries()].find(([, item]) => !stateOwners.get(item).borrows);
    if (!available) throw new RangeError('All finite wall cache owners are retained');
    const [oldestKey, oldest] = available;
    states.delete(oldestKey);
    // Retired only after any queued work that may still reference it.
    const owner = stateOwners.get(oldest);
    owner.evicted = true;
    owner.retire();
  }
  const buffer = device.createBuffer({
    label: 'ulg-sph-finite-wall-state',
    size: STATE_BYTES,
    usage: BUFFER_USAGE.STORAGE | BUFFER_USAGE.COPY_SRC | BUFFER_USAGE.COPY_DST
  });
  device.queue.writeBuffer(buffer, 0, initialWords(authority));
  const update = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-sph-finite-wall-update.v4-canonical-invalidation',
    label: 'ulg-sph-finite-wall-update',
    code: sphFiniteWallUpdateWgsl,
    entryPoint: 'update_finite_walls',
    bindings: [computeBufferBinding(0, 'storage')]
  });
  const bindGroup = device.createBindGroup({
    layout: update.bindGroupLayout,
    entries: [{ binding: 0, resource: { buffer } }]
  });
  const destroyBuffer = buffer.destroy.bind(buffer);
  const owner = { device, borrows: 0, evicted: false, retired: false,
    retire() {
      if (!this.evicted || this.borrows || this.retired) return;
      this.retired = true;
      device.queue.onSubmittedWorkDone().then(destroyBuffer).catch(() => {});
    } };
  buffer.destroy = () => {
    if (owner.borrows) throw new TypeError('Finite wall state is retained by a canonical candidate');
    owner.retired = true; destroyBuffer();
  };
  const state = Object.freeze({
    instanceId: authority.instanceId,
    buffer,
    /** Copy the six face temperatures into a params buffer at byteOffset. */
    encodeTemperatureCopy(encoder, paramsBuffer, byteOffset, faceCount = 6, firstFace = 0) {
      encoder.copyBufferToBuffer(buffer, firstFace * 4, paramsBuffer, byteOffset, faceCount * 4);
    },
    /** Apply the step's pending face energy to the face temperatures. */
    encodeUpdate(encoder) {
      if (owner.borrows || owner.retired) throw new TypeError('Finite wall state has an active canonical reader or is retired');
      const pass = encoder.beginComputePass({ label: 'ulg-sph-finite-wall-update' });
      pass.setPipeline(update.pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.dispatchWorkgroups(1);
      pass.end();
    }
  });
  stateOwners.set(state, owner);
  states.set(authority.instanceId, state);
  return state;
}

/** A genuine read of the accepted wall owner. A candidate never mutates it.
 * The caller releases after its existing submitted-work retirement proof. */
export function borrowSphFiniteWallState(device, state) {
  const owner = stateOwners.get(state);
  if (!owner || owner.device !== device || owner.retired || owner.borrows) {
    throw new TypeError('Finite wall candidate requires an available original wall owner');
  }
  owner.borrows++;
  let live = true;
  return Object.freeze({ buffer: state.buffer, instanceId: state.instanceId,
    validate() { if (!live || owner.retired) throw new TypeError('Finite wall source read was retired'); return true; },
    release() { if (!live) return false; live = false; owner.borrows--; owner.retire(); return true; }
  });
}
