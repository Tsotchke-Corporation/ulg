import {
  encodeSphExactMass, projectSphExactMassF32Bits, validateSphExactMassFormat
} from '../../../ulg-gpu-abi/src/sphExactMassInventory.js';

const SEEDS = new WeakMap(), PACKED = new WeakMap(), ARRAYS = new WeakSet();
const ROW_KEYS = ['id', 'material', 'materialId', 'phaseId', 'renderDomainId',
  'spareProductSlot', 'phaseCompanionSlot', 'phaseCarrierPrimaryIndex',
  'phaseCarrierCompanionIndex', 'phaseCarrierLineageIndex', 'phaseCarrierLane', 'phaseCarrierTargetPhaseId'];
const PACKED_KEYS = ['particleCount', 'step', 'time', 'topologyEpoch', 'identityRevision',
  'stateStrideBytes', 'thermoStrideBytes', 'identityStrideBytes', 'positionEpoch',
  'storageGeneration', 'physicsTick', 'physicsSubstep', 'chartEpoch', 'levelEpoch', 'supportEpoch', 'dimension', 'status'];

function bytes(array) {
  return new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
}
function equalBytes(array, snapshot) {
  if (!ArrayBuffer.isView(array) || array.byteLength !== snapshot.length) return false;
  const view = bytes(array);
  return view.every((value, index) => value === snapshot[index]);
}

/** Capture declared cold binary64 masses before the legacy f32 projection. */
export function prepareSphExactParticleMassSeed(state, options) {
  if (options == null) return null;
  const format = options.format;
  validateSphExactMassFormat(format);
  if (typeof options.reference !== 'string' || !options.reference.trim()
      || !Array.isArray(state?.particles) || !state.particles.length
      || (state.step ?? 0) !== 0 || (state.time ?? 0) !== 0
      || state.cpuStateStale === true || state.cpuThermoStale === true
      || state.cpuIdentityStale === true) {
    throw new TypeError('Exact particle mass requires explicit cold initial conditions and a reference');
  }
  const massesKg = [], projections = [];
  for (let index = 0; index < state.particles.length; index++) {
    const row = Object.getOwnPropertyDescriptor(state.particles, String(index));
    const mass = row && Object.hasOwn(row, 'value') && row.value
      && Object.getOwnPropertyDescriptor(row.value, 'massKg');
    if (!mass || !Object.hasOwn(mass, 'value')) {
      throw new TypeError('Exact particle mass requires an explicit own-data mass for every row');
    }
    const words = encodeSphExactMass(mass.value, format);
    const projection = projectSphExactMassF32Bits(words, format);
    // Current mechanics uses normal f32 projections. Keep the numeric codec's
    // broader range, but do not enroll an unrepresentable physical carrier.
    if (projection.error || (projection.bits !== 0 && (projection.bits & 0x7f800000) === 0)) {
      throw new RangeError('Exact particle mass is outside the normal-f32 carrier projection domain');
    }
    massesKg.push(mass.value); projections.push(projection.bits);
  }
  const seed = Object.freeze({ format, reference: options.reference.trim(), rowCount: massesKg.length });
  SEEDS.set(seed, { massesKg: Object.freeze(massesKg), projections });
  return seed;
}

export function bindSphExactParticleMassSeed(packed, seed) {
  if (seed == null) return packed;
  const record = SEEDS.get(seed);
  if (!record || PACKED.has(packed) || packed.particleCount !== seed.rowCount
      || !(packed.state instanceof Float32Array) || !(packed.thermo instanceof Float32Array)
      || !(packed.identity instanceof Uint32Array) || !Array.isArray(packed.metadata)
      || ['state', 'thermo', 'identity'].some(key => !(packed[key].buffer instanceof ArrayBuffer))) {
    throw new TypeError('Exact particle seed requires the original packed initial family');
  }
  const stateBits = new Uint32Array(packed.state.buffer, packed.state.byteOffset, packed.state.length);
  for (let row = 0; row < seed.rowCount; row++) {
    if (stateBits[row * 8 + 3] !== record.projections[row]) {
      throw new TypeError('Initial particle mass projection disagrees with exact inventory');
    }
  }
  Object.defineProperty(packed, 'exactMass', { value: seed, enumerable: true });
  const arrays = ['state', 'thermo', 'identity'].map(key => {
    ARRAYS.add(packed[key]); ARRAYS.add(packed[key].buffer);
    return [key, packed[key], bytes(packed[key]).slice()];
  });
  PACKED.set(packed, { seed, ...record, arrays,
    packedSnapshot: { ...packed },
    fields: PACKED_KEYS.map(key => [key, packed[key]]),
    rows: packed.metadata.map(row => ROW_KEYS.map(key => [key, row[key]])) });
  return packed;
}

export function sphExactParticleSeedMass(seed, index) {
  const record = SEEDS.get(seed);
  if (!record) throw new TypeError('Unknown initial exact particle seed');
  return record.massesKg[index];
}

export function sphPackedParticleAdvertisesExactMass(packed) {
  return Boolean(packed && (PACKED.has(packed) || 'exactMass' in packed
    || ['state', 'thermo', 'identity'].some(key => ARRAYS.has(packed[key]) || ARRAYS.has(packed[key]?.buffer))));
}

/** Reject copied, stale or changed cold mirrors before allocating any GPU state. */
export function resolveSphExactParticleMassSeed(packed) {
  const record = PACKED.get(packed);
  if (!record) {
    if (sphPackedParticleAdvertisesExactMass(packed)) {
      throw new TypeError('Exact particle mass seed was copied or lost its private initial binding');
    }
    return null;
  }
  if (packed.exactMass !== record.seed || packed.cpuStateStale === true
      || packed.cpuThermoStale === true || packed.cpuIdentityStale === true
      || record.fields.some(([key, value]) => packed[key] !== value)
      || record.arrays.some(([key, array, snapshot]) => packed[key] !== array || !equalBytes(array, snapshot))
      || packed.metadata?.length !== record.rows.length
      || record.rows.some((row, index) => row.some(([key, value]) => packed.metadata[index]?.[key] !== value))) {
    throw new TypeError('Exact particle mass initial family changed or became a stale CPU mirror');
  }
  // Upload these private bytes, not caller-owned arrays after validation.
  const packedSnapshot = { ...record.packedSnapshot };
  for (const [key, , snapshot] of record.arrays) {
    packedSnapshot[key] = key === 'identity'
      ? new Uint32Array(snapshot.slice().buffer) : new Float32Array(snapshot.slice().buffer);
  }
  return Object.freeze({ ...record.seed, massesKg: record.massesKg, packed: Object.freeze(packedSnapshot) });
}
