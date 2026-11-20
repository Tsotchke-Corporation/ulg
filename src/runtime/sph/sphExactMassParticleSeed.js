import {
  createSphExactMassFormat, encodeSphExactMass, projectSphExactMassF32Bits, validateSphExactMassFormat
} from '../../../ulg-gpu-abi/src/sphExactMassInventory.js';
import { encodeSphExactSigned } from '../../../ulg-gpu-abi/src/sphExactSignedLedger.js';
import { SPH_EXACT_THERMAL_ENERGY_FORMAT } from './sphExactThermalEnergyWgsl.js';

const SEEDS = new WeakMap(), PACKED = new WeakMap(), ARRAYS = new WeakSet();
const ROW_KEYS = ['id', 'material', 'materialId', 'phaseId', 'renderDomainId',
  'molarMassBits', 'initialPhaseReferenceMatchesMass',
  'spareProductSlot', 'spareSplitSlot', 'phaseCompanionSlot', 'phaseCarrierPrimaryIndex',
  'phaseCarrierCompanionIndex', 'phaseCarrierLineageIndex', 'phaseCarrierLane', 'phaseCarrierTargetPhaseId'];
const PACKED_KEYS = ['particleCount', 'step', 'time', 'topologyEpoch', 'identityRevision',
  'stateStrideBytes', 'thermoStrideBytes', 'identityStrideBytes', 'positionEpoch',
  'storageGeneration', 'physicsTick', 'physicsSubstep', 'chartEpoch', 'levelEpoch', 'supportEpoch', 'dimension', 'status'];

// A clone-safe declaration for the original scene/worker initialization only.
// Reconstruct the numeric format locally; copied GPU seeds remain inadmissible.
export function sphExactMassOptionsFromColdState(state) {
  if (!Object.hasOwn(state, 'exactMassInitialization')) return null;
  const input = state.exactMassInitialization;
  if (!input || input.schema !== 'peercompute.ulg.sph-exact-mass-initialization.v1'
      || Object.keys(input).some(key => !['schema', 'wordCount', 'quantumExponent', 'reference', 'massWords', 'initialQuantities', 'energyLedger'].includes(key))
      || !Object.hasOwn(input, 'wordCount') || !Object.hasOwn(input, 'quantumExponent')
      || (Object.hasOwn(input, 'initialQuantities') && typeof input.initialQuantities !== 'boolean')
      || (Object.hasOwn(input, 'energyLedger') && typeof input.energyLedger !== 'boolean')
      || (input.energyLedger === true && input.initialQuantities === true)
      || typeof input.reference !== 'string' || !input.reference.trim()) {
    throw new TypeError('Explicit exact mass cold initialization declaration required');
  }
  // energyLedger declares the G2 integer energy ledger route: integer mass and
  // energy rows only, no rational quantities, and the heat-proxy reaction law.
  return { format: createSphExactMassFormat(input), reference: input.reference, initialQuantities: input.initialQuantities ?? false,
    energyLedger: input.energyLedger === true,
    ...(Object.hasOwn(input, 'massWords') ? { massWords: input.massWords } : {}) };
}

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
  if (options.initialQuantities !== undefined && typeof options.initialQuantities !== 'boolean') {
    throw new TypeError('Cold initial quantities declaration must be boolean');
  }
  if (options.energyLedger !== undefined && typeof options.energyLedger !== 'boolean') {
    throw new TypeError('Cold energy ledger declaration must be boolean');
  }
  if (options.energyLedger === true && options.initialQuantities === true) {
    throw new TypeError('The integer energy ledger carries no rational initial quantities');
  }
  if (typeof options.reference !== 'string' || !options.reference.trim()
      || !Array.isArray(state?.particles) || !state.particles.length
      || (state.step ?? 0) !== 0 || (state.time ?? 0) !== 0
      || state.cpuStateStale === true || state.cpuThermoStale === true
      || state.cpuIdentityStale === true) {
    throw new TypeError('Exact particle mass requires explicit cold initial conditions and a reference');
  }
  const massesKg = [], projections = [];
  const sourceWords = options.massWords;
  if (sourceWords !== undefined && (!Array.isArray(sourceWords)
      || sourceWords.length !== state.particles.length * format.wordCount
      || Array.from(sourceWords).some(word => !Number.isInteger(word) || word < 0 || word > 0xffffffff))) {
    throw new TypeError('Cold exact mass requires one complete explicit unsigned word array');
  }
  const massWords = sourceWords === undefined ? null : Uint32Array.from(sourceWords);
  for (let index = 0; index < state.particles.length; index++) {
    const row = Object.getOwnPropertyDescriptor(state.particles, String(index));
    const mass = row && Object.hasOwn(row, 'value') && row.value
      && Object.getOwnPropertyDescriptor(row.value, 'massKg');
    if (!mass || !Object.hasOwn(mass, 'value')) {
      throw new TypeError('Exact particle mass requires an explicit own-data mass for every row');
    }
    const words = massWords ? massWords.slice(index * format.wordCount, (index + 1) * format.wordCount)
      : encodeSphExactMass(mass.value, format);
    const projection = projectSphExactMassF32Bits(words, format);
    // Current mechanics uses normal f32 projections. Keep the numeric codec's
    // broader range, but do not enroll an unrepresentable physical carrier.
    if (projection.error || (projection.bits !== 0 && (projection.bits & 0x7f800000) === 0)) {
      throw new RangeError('Exact particle mass is outside the normal-f32 carrier projection domain');
    }
    const displayBits = new Uint32Array(new Float32Array([mass.value]).buffer)[0];
    if (massWords && (typeof mass.value !== 'number' || !Number.isFinite(mass.value)
        || mass.value < 0 || displayBits !== projection.bits)) {
      throw new TypeError('Cold mass projection disagrees with its exact word inventory');
    }
    massesKg.push(mass.value); projections.push(projection.bits);
  }
  const seed = Object.freeze({ format, reference: options.reference.trim(), rowCount: massesKg.length,
    initialQuantities: options.initialQuantities === true, energyLedger: options.energyLedger === true });
  SEEDS.set(seed, { massesKg: Object.freeze(massesKg), massWords, projections });
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
  // Extensive internal energy U0 = fl32(m*u) in signed run quanta: the
  // correctly rounded f32 product of the two projections the solver starts
  // from, which the GPU ledger can recompute bit for bit to recognise a cold
  // row. Each row is stored exactly or not at all. A run format too narrow or
  // coarse for any row seeds no energy rows; ledger consumers then refuse.
  const ledgerFormat = seed.format.wordCount === SPH_EXACT_THERMAL_ENERGY_FORMAT.wordCount
    && seed.format.quantumExponent === SPH_EXACT_THERMAL_ENERGY_FORMAT.quantumExponent;
  let energyWords = ledgerFormat ? new Uint32Array(seed.rowCount * seed.format.wordCount) : null;
  let energyRowsStatus = ledgerFormat ? 'exact' : 'run-format-is-not-the-energy-ledger-format';
  for (let row = 0; row < seed.rowCount && energyWords; row++) {
    const energyJ = Math.fround(packed.state[row * 8 + 3] * packed.state[row * 8 + 7]);
    try {
      energyWords.set(encodeSphExactSigned(energyJ, seed.format), row * seed.format.wordCount);
    } catch {
      energyWords = null;
      energyRowsStatus = `row-${row}-not-exact-in-run-format`;
    }
  }
  Object.defineProperty(packed, 'exactMass', { value: seed, enumerable: true });
  const arrays = ['state', 'thermo', 'identity'].map(key => {
    ARRAYS.add(packed[key]); ARRAYS.add(packed[key].buffer);
    return [key, packed[key], bytes(packed[key]).slice()];
  });
  PACKED.set(packed, { seed, ...record, energyWords, energyRowsStatus, arrays,
    packedSnapshot: { ...packed, metadata: packed.metadata.map(row => ({ ...row })) },
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
  packedSnapshot.metadata = record.packedSnapshot.metadata.map(row => ({ ...row }));
  for (const [key, , snapshot] of record.arrays) {
    packedSnapshot[key] = key === 'identity'
      ? new Uint32Array(snapshot.slice().buffer) : new Float32Array(snapshot.slice().buffer);
  }
  return Object.freeze({ ...record.seed, massesKg: record.massesKg, massWords: record.massWords?.slice() ?? null,
    energyWords: record.energyWords?.slice() ?? null, energyRowsStatus: record.energyRowsStatus,
    packed: Object.freeze(packedSnapshot) });
}

/** Original cold inputs for a NEW worker-local owner. This is not a portable
 * continuing inventory capability. Only a zero-clock, unchanged cold family
 * can export/import it; all advancing owners retain their GPU inventory.
 */
export function exportSphExactParticleMassColdInput(packed) {
  const seed = resolveSphExactParticleMassSeed(packed);
  if (!seed) return null;
  return { schema: 'peercompute.ulg.sph-exact-mass-cold-input.v1',
    wordCount: seed.format.wordCount, quantumExponent: seed.format.quantumExponent,
    reference: seed.reference, initialQuantities: seed.initialQuantities, energyLedger: seed.energyLedger,
    massesKg: [...seed.massesKg],
    massWords: seed.massWords ? Array.from(seed.massWords) : null,
    fields: Object.fromEntries(PACKED_KEYS.map(key => [key, packed[key]])),
    rows: packed.metadata.map(row => Object.fromEntries(ROW_KEYS.map(key => [key, row[key]]))),
    arrays: Object.fromEntries(['state', 'thermo', 'identity'].map(key => [key, bytes(packed[key]).slice()])) };
}

export function importSphExactParticleMassColdInput(packed, input) {
  if (!input || input.schema !== 'peercompute.ulg.sph-exact-mass-cold-input.v1'
      || packed?.step !== 0 || packed?.time !== 0
      || packed.cpuStateStale === true || packed.cpuThermoStale === true || packed.cpuIdentityStale === true
      || !Array.isArray(input.massesKg) || !Array.isArray(input.rows)
      || input.rows.length !== packed?.metadata?.length
      || PACKED_KEYS.some(key => packed[key] !== input.fields?.[key])
      || input.rows.some((row, i) => ROW_KEYS.some(key => packed.metadata[i]?.[key] !== row[key]))
      || ['state', 'thermo', 'identity'].some(key => !(input.arrays?.[key] instanceof Uint8Array)
        || !equalBytes(packed[key], input.arrays[key]))) {
    throw new TypeError('Exact mass cold transfer requires unchanged original zero-clock inputs');
  }
  const seed = prepareSphExactParticleMassSeed({ step: 0, time: 0,
    particles: input.massesKg.map(massKg => ({ massKg })) }, {
    format: createSphExactMassFormat(input), reference: input.reference, initialQuantities: input.initialQuantities ?? false,
    energyLedger: input.energyLedger === true,
    ...(input.massWords != null ? { massWords: input.massWords } : {}) });
  if (PACKED.has(packed)) {
    const original = resolveSphExactParticleMassSeed(packed);
    if (original.format.wordCount !== seed.format.wordCount
        || original.format.quantumExponent !== seed.format.quantumExponent
        || original.reference !== seed.reference
        || original.initialQuantities !== seed.initialQuantities
        || original.energyLedger !== seed.energyLedger
        || original.massesKg.some((mass, i) => mass !== input.massesKg[i])
        || Boolean(original.massWords) !== Boolean(input.massWords)
        || original.massWords?.some((word, i) => word !== input.massWords[i])) {
      throw new TypeError('Cold transfer differs from its already bound original seed');
    }
    return packed;
  }
  if (!packed.exactMass || packed.exactMass.format.wordCount !== input.wordCount
      || packed.exactMass.format.quantumExponent !== input.quantumExponent
      || packed.exactMass.reference !== input.reference
      || (packed.exactMass.initialQuantities ?? false) !== seed.initialQuantities
      || (packed.exactMass.energyLedger ?? false) !== seed.energyLedger) {
    throw new TypeError('Cold transfer differs from the packed exact mass declaration');
  }
  return bindSphExactParticleMassSeed(packed, seed);
}
