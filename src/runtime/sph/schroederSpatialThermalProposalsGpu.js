import {
  SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_HEADER_WORDS,
  SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_MAGIC,
  SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_MAX_RANKS_PER_LANE,
  SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_MAX_SOURCE_COUNT,
  SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_STATUS_ADMITTED,
  SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_STATUS_READY,
  SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_VERSION,
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_RADIATION_WIDE_V1,
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_THERMAL_CONDUCTION_V1,
  ULG_SCHROEDER_SPATIAL_EXACT_NEAR_RESIDENT_BINDING_SCHEMA,
  ULG_SPH_GPU_THERMAL_RESPONSE_GRAPH_BUFFER_SET_SCHEMA,
  validateSchroederSpatialActiveRankViewDescriptor,
  validateSchroederSpatialAggregateViewDescriptor
} from '../../../ulg-gpu-abi/src/index.js';
import {
  createSchroederSpatialExactNearTraversalV1Wgsl
} from '../../../ulg-gpu-abi/src/schroederSpatialExactNearTraversalWgsl.js';
import {
  createSchroederSpatialExactNearCellTreeTraversalV1Wgsl
} from '../../../ulg-gpu-abi/src/schroederSpatialExactNearCellTreeWgsl.js';
import {
  computeBufferBinding,
  createCachedExplicitComputePipeline,
  deferSubmittedWorkCleanup
} from '../webgpuComputeLayout.js';
import {
  tagWebGpuBufferDevice,
  webGpuBufferMatchesDevice
} from './sphGpuDeviceIdentity.js';
import {
  SCHROEDER_SPATIAL_EXACT_NEAR_RESIDENT_BINDING_STATUS,
  bindSchroederSpatialExactNearResidentConsumerEvidence,
  resolveSchroederSpatialExactNearConsumerGeneration
} from './schroederSpatialEpochGpu.js';
import {
  resolveSchroederSpatialExactNearCellTreeForConsumer
} from './schroederSpatialExactNearCellTreeGpu.js';
import {
  validateSchroederSpatialEpochTransactionSourceFamily
} from './schroederSpatialEpochTransaction.js';
import {
  resolvePostSeparationThermalBinAuthority
} from './sphPostSeparationThermalBinAuthority.js';

export const ULG_SCHROEDER_SPATIAL_THERMAL_PROPOSAL_SCHEMA =
  'peercompute.ulg.schroeder-spatial-thermal-proposal.v2';
export const ULG_SCHROEDER_SPATIAL_THERMAL_PROPOSAL_BUFFER_SCHEMA =
  'peercompute.ulg.schroeder-spatial-thermal-proposal-buffer.v2';
export const ULG_SCHROEDER_SPATIAL_THERMAL_EVIDENCE_SCHEMA =
  'peercompute.ulg.schroeder-spatial-thermal-evidence.v1';
export const ULG_CLASSIC_THERMAL_PROPOSAL_ENCODER_STAGE_SCHEMA =
  'peercompute.ulg.classic-thermal-proposal-encoder-stage.v2';
export const ULG_THERMAL_PROPOSAL_SOURCE_AUTHORITY_SCHEMA =
  'peercompute.ulg.thermal-proposal-source-authority.v0';
export const ULG_SCHROEDER_SPATIAL_MATCHED_TIME_THERMAL_ENCODER_STAGE_SCHEMA =
  'peercompute.ulg.schroeder-spatial-matched-time-thermal-encoder-stage.v0';
export const ULG_SCHROEDER_SPATIAL_THERMAL_CANDIDATE_CSR_SCHEMA =
  'peercompute.ulg.schroeder-spatial-thermal-candidate-csr.v1';

export const SCHROEDER_SPATIAL_THERMAL_CONSUMER = Object.freeze({
  CONDUCTION: 'thermal-conduction',
  RADIATION: 'thermal-radiation'
});

export const SCHROEDER_SPATIAL_THERMAL_CONSUMERS = Object.freeze([
  Object.freeze({
    consumerId: SCHROEDER_SPATIAL_THERMAL_CONSUMER.CONDUCTION,
    supportProfileId: SCHROEDER_SPATIAL_SUPPORT_PROFILE_THERMAL_CONDUCTION_V1
  }),
  Object.freeze({
    consumerId: SCHROEDER_SPATIAL_THERMAL_CONSUMER.RADIATION,
    supportProfileId: SCHROEDER_SPATIAL_SUPPORT_PROFILE_RADIATION_WIDE_V1
  })
]);

export const SCHROEDER_SPATIAL_THERMAL_PROPOSAL_MAGIC = 0x5450_4831;
export const SCHROEDER_SPATIAL_THERMAL_PROPOSAL_VERSION = 2;
export const SCHROEDER_SPATIAL_THERMAL_PROPOSAL_HEADER_WORDS = 16;
export const SCHROEDER_SPATIAL_THERMAL_PROPOSAL_ROW_WORDS = 4;
export const SCHROEDER_SPATIAL_THERMAL_PROPOSAL_ROW_FLOATS = 4;
export const SCHROEDER_SPATIAL_THERMAL_EVIDENCE_WORDS = 16;
export const SCHROEDER_SPATIAL_THERMAL_ACTIVE_MEMBER_PROJECTION_ADMISSION_WORD = 5;
export const SCHROEDER_SPATIAL_THERMAL_ACTIVE_MEMBER_PROJECTION_ADMITTED = 1;
export const SCHROEDER_SPATIAL_THERMAL_ACTIVE_MEMBER_PROJECTION_REJECTED = 2;
export const SCHROEDER_SPATIAL_THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_NONE = 0;
export const SCHROEDER_SPATIAL_THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_AGGREGATE = 1;
export const SCHROEDER_SPATIAL_THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_LOCAL = 2;
// The base epoch's compact canonical-rank view.  It is intentionally a
// separate value so saved aggregate/local receipts retain their ABI meaning.
export const SCHROEDER_SPATIAL_THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_ACTIVE_RANK = 3;
export const SCHROEDER_SPATIAL_THERMAL_CURRENT_ACTIVE_SOURCE_COUNT_WORD = 6;
export const SCHROEDER_SPATIAL_THERMAL_EXPECTED_ACTIVE_MEMBER_COUNT_WORD = 7;
export const SCHROEDER_SPATIAL_THERMAL_ACTIVE_SOURCE_RANK_COUNT_WORD = 8;
export const SCHROEDER_SPATIAL_THERMAL_DERIVED_HEADER_WORDS = 9;
export const SCHROEDER_SPATIAL_THERMAL_DERIVED_ROW_WORDS = 8;
export const SCHROEDER_SPATIAL_THERMAL_PARAMS_BYTES = 80;
export const SCHROEDER_SPATIAL_THERMAL_CANONICAL_PARAMS_OFFSET_BYTES = 104;
export const SCHROEDER_SPATIAL_THERMAL_CANONICAL_PARAMS_SENTINEL = 1;
export const CLASSIC_THERMAL_CANDIDATE_CAPACITY_DEFAULT = 256;
export const CLASSIC_THERMAL_CANDIDATE_OVERFLOW = 0xffff_ffff;
// The exact-near traversal is materialized once into a source-major fixed-row
// candidate arena and then replayed by the directional budget and reciprocal
// proposal passes.  A source owns one row through a checked state transition,
// avoiding a global append counter, prefix scan, and scatter pass on the hot
// path. The arena is deliberately bounded: a row overflow rejects the entire
// receipt instead of publishing a truncated peer prefix, then the reciprocal
// pass preserves physics by rewalking the authenticated exact-near directory.
export const SCHROEDER_SPATIAL_THERMAL_CSR_MAGIC = 0x5443_5331;
// Word seven is a diagnostic-only route receipt.  It is intentionally part of
// the authenticated control header so a benchmark can distinguish a sealed
// receipt that was actually replayed from one that still took the safe exact
// directory rewalk.  Version five also authenticates the expanded terminal
// accounting contract: ordinary exact visits proven to have no thermal effect
// may be represented by the terminal count rather than a raw peer word.
export const SCHROEDER_SPATIAL_THERMAL_CSR_VERSION = 5;
export const SCHROEDER_SPATIAL_THERMAL_CSR_CONTROL_WORDS = 8;
export const SCHROEDER_SPATIAL_THERMAL_CSR_ROW_STRIDE_WORD = 4;
export const SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_WORD = 6;
export const SCHROEDER_SPATIAL_THERMAL_CSR_ROUTE_WORD = 7;
// A row includes the terminal skipped-member sentinel, so the default covers
// a fully populated 1,024-particle source row plus its terminal receipt.
export const SCHROEDER_SPATIAL_THERMAL_CSR_DEFAULT_ROW_STRIDE = 1025;
export const SCHROEDER_SPATIAL_THERMAL_CSR_ROW_STATE_WRITING = 0xffff_ffff;
export const SCHROEDER_SPATIAL_THERMAL_CSR_SKIPPED_MEMBER_BIT = 0x8000_0000;
export const SCHROEDER_SPATIAL_THERMAL_CSR_VALUE_MASK = 0x7fff_ffff;
export const SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_READY = 1;
export const SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_INVALID = 2;
export const SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_OVERFLOW = 4;
export const SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_ROWS_FINALIZED = 8;
export const SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_VALIDATED = 16;
export const SCHROEDER_SPATIAL_THERMAL_CSR_ROUTE_UNIFORM_COMPLETION = 1;
export const SCHROEDER_SPATIAL_THERMAL_CSR_ROUTE_REPLAY = 2;
export const SCHROEDER_SPATIAL_THERMAL_CSR_ROUTE_EXACT_NEAR_REWALK = 4;

export const SCHROEDER_SPATIAL_THERMAL_PROPOSAL_HEADER_LAYOUT = Object.freeze([
  'magic:u32',
  'version:u32',
  'generationId:u32',
  'supportEpoch:u32',
  'particleCount:u32',
  'rowWords:u32',
  'conductionInvalidCount:atomic<u32>',
  'radiationInvalidCount:atomic<u32>',
  'conductionSupportProfileId:u32',
  'radiationSupportProfileId:u32',
  'positionEpoch:u32',
  'topologyEpoch:u32',
  'storageGeneration:u32',
  'physicsTick:u32',
  'physicsSubstep:u32',
  'publishedRowCount:atomic<u32>'
]);

export const SCHROEDER_SPATIAL_THERMAL_PROPOSAL_ROW_LAYOUT = Object.freeze([
  'limitedConductionSpecificEnergyDeltaJPerKg:f32',
  'limitedRadiationSpecificEnergyDeltaJPerKg:f32',
  'lowerSpecificInternalEnergyBoundJPerKg:f32',
  'upperSpecificInternalEnergyBoundJPerKg:f32'
]);

export const SCHROEDER_SPATIAL_THERMAL_DERIVED_ROW_LAYOUT = Object.freeze([
  'authoritativeTemperatureK:f32',
  'temperatureSlopeKdPerJPerKg:f32',
  'nominalRadiusM:f32',
  'emissivity:f32',
  'requestedGainScale:f32',
  'requestedLossScale:f32',
  'lowerSpecificInternalEnergyBoundJPerKg:f32',
  'upperSpecificInternalEnergyBoundJPerKg:f32'
]);

export const SCHROEDER_SPATIAL_THERMAL_DERIVED_HEADER_LAYOUT = Object.freeze([
  'maximumNominalRadiusM:atomic<f32-bits>',
  'invalidSourceFamilyCount:atomic<u32>',
  'maximumTemperatureK:atomic<f32-bits>',
  'complementedMinimumTemperatureK:atomic<u32>',
  'maximumPositionDisplacementM:atomic<f32-bits>',
  'activeMemberProjectionAdmission:atomic<u32>',
  'currentActiveSourceCount:atomic<u32>',
  'expectedActiveMemberCount:atomic<u32>',
  'materializedActiveSourceRankCount:atomic<u32>'
]);

export const SCHROEDER_SPATIAL_THERMAL_EVIDENCE_LAYOUT = Object.freeze([
  'sourceInvocationCount:atomic<u32>',
  'directoryAdmissionCount:atomic<u32>',
  'directoryRejectCount:atomic<u32>',
  'candidateVisitCount:atomic<u32>',
  'consumerMaskHitCount:atomic<u32>',
  'malformedTraversalCount:atomic<u32>',
  'proposalRowCount:atomic<u32>',
  'nonFiniteProposalCount:atomic<u32>',
  'evidenceMagic:u32',
  'supportProfileId:u32',
  'generationId:u32',
  'supportEpoch:u32',
  'traversalCount:u32',
  'privateLookupBuildCount:u32',
  'fixedCandidateBuildCount:u32',
  'exhaustiveTraversalCount:u32'
]);

const THERMAL_EVIDENCE_MAGIC = 0x5448_4531;
const EXPECTATION_BYTES = 112;
const WORKGROUP_SIZE = 64;
const PAIR_CONDUCTION_RELAXATION_LIMIT = 0.25;
const PAIR_CONDUCTION_RATE_DEFAULT = 1500;
const STEFAN_BOLTZMANN_W_PER_M2_K4 = 5.670374419e-8;
const RADIATION_PAIR_RANGE_RADII = 4;
const CLASSIC_THERMAL_MAX_BIN_SCAN_RADIUS_CELLS = 5;

const GPU_BUFFER_USAGE = Object.freeze({
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  INDIRECT: globalThis.GPUBufferUsage?.INDIRECT ?? 256,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64
});

const thermalRuntimeByDevice = new WeakMap();
const classicThermalRuntimeByDevice = new WeakMap();
const thermalProposalSourceAuthorities = new WeakMap();
const thermalProposalArtifacts = new WeakMap();
const matchedTimeThermalEncoderStages = new WeakMap();
const lostThermalProposalDevices = new WeakSet();

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeThermalLawConfig({
  dtS,
  smoothingLengthM,
  conductionRate
}) {
  return Object.freeze({
    dtS: Math.fround(finiteNumber(dtS, 0)),
    smoothingLengthM: Math.fround(
      Math.max(0, finiteNumber(smoothingLengthM, 0))
    ),
    conductionRate: Math.fround(
      Math.max(0, finiteNumber(conductionRate, 0))
    )
  });
}

function exactU32(value, label, { positive = false } = {}) {
  if (
    typeof value !== 'number'
    || !Number.isInteger(value)
    || value < (positive ? 1 : 0)
    || value > 0xffff_ffff
  ) {
    throw new RangeError(`${label} must be an exact ${positive ? 'positive ' : ''}u32`);
  }
  return value;
}

function positiveCapacity(value) {
  let capacity = 1;
  const target = exactU32(value, 'particleCount', { positive: true });
  while (capacity < target) capacity *= 2;
  return capacity;
}

function requireBuffer(device, buffer, label, minimumByteLength = 0) {
  if (!buffer || !webGpuBufferMatchesDevice(buffer, device)) {
    throw new TypeError(`${label} must be a live buffer on the canonical generation device`);
  }
  if (
    minimumByteLength > 0
    && Number.isFinite(Number(buffer.size))
    && Number(buffer.size) < minimumByteLength
  ) {
    throw new RangeError(`${label} is smaller than its declared thermal row count`);
  }
  return buffer;
}

function createBuffer(device, label, size, usage) {
  return tagWebGpuBufferDevice(device.createBuffer({
    label,
    size: Math.max(4, size),
    usage
  }), device);
}

function destroyOnce(buffer) {
  let destroyed = false;
  return () => {
    if (destroyed) return false;
    destroyed = true;
    buffer?.destroy?.();
    return true;
  };
}

function clampPairEnergy({
  energyJ,
  temperatureK,
  otherTemperatureK,
  temperatureSlopeKdPerJPerKg,
  otherTemperatureSlopeKdPerJPerKg,
  massKg,
  otherMassKg
}) {
  if (energyJ === 0) return 0;
  const gapK = otherTemperatureK - temperatureK;
  if (gapK === 0 || Math.sign(energyJ) !== Math.sign(gapK)) return energyJ;
  const responsePerJ = temperatureSlopeKdPerJPerKg / Math.max(massKg, 1e-30)
    + otherTemperatureSlopeKdPerJPerKg / Math.max(otherMassKg, 1e-30);
  if (!(responsePerJ > 0)) return energyJ;
  const equalizingEnergyJ = Math.abs(gapK) / responsePerJ;
  return Math.sign(energyJ) * Math.min(
    Math.abs(energyJ),
    equalizingEnergyJ * PAIR_CONDUCTION_RELAXATION_LIMIT
  );
}

function radiativeViewAreaM2(radiusM, otherRadiusM, distanceM) {
  if (!(radiusM > 0) || !(otherRadiusM > 0)) return 0;
  const distanceSquared = Math.max(distanceM * distanceM, 1e-12);
  const geometric = Math.PI * radiusM * radiusM
    * (otherRadiusM * otherRadiusM) / (4 * distanceSquared);
  const contactLimit = Math.PI * Math.min(radiusM, otherRadiusM) ** 2;
  return Math.min(geometric, contactLimit);
}

/** Small manufactured-pair oracle only; never a production neighbor fallback. */
export function evaluateSchroederSpatialThermalPairProposal({
  distanceM,
  smoothingLengthM,
  radiusM,
  otherRadiusM,
  massKg,
  otherMassKg,
  temperatureK,
  otherTemperatureK,
  temperatureSlopeKdPerJPerKg,
  otherTemperatureSlopeKdPerJPerKg,
  emissivity = 0,
  otherEmissivity = 0,
  dtS,
  conductionRate = PAIR_CONDUCTION_RATE_DEFAULT
} = {}) {
  const distance = Math.max(0, finiteNumber(distanceM, 0));
  const selfMass = Math.max(1e-30, finiteNumber(massKg, 0));
  const otherMass = Math.max(1e-30, finiteNumber(otherMassKg, 0));
  const pairRadiiM = Math.max(0, finiteNumber(radiusM, 0))
    + Math.max(0, finiteNumber(otherRadiusM, 0));
  const conductionSupportM = Math.max(
    2 * Math.max(0, finiteNumber(smoothingLengthM, 0)),
    pairRadiiM
  );
  const radiationSupportM = RADIATION_PAIR_RANGE_RADII * pairRadiiM;
  let conductionEnergyJ = 0;
  let radiationEnergyJ = 0;
  if (conductionSupportM > 0 && distance < conductionSupportM) {
    const weight = 1 - distance / conductionSupportM;
    conductionEnergyJ = clampPairEnergy({
      energyJ: finiteNumber(conductionRate, 0)
        * (otherTemperatureK - temperatureK) * weight * finiteNumber(dtS, 0),
      temperatureK,
      otherTemperatureK,
      temperatureSlopeKdPerJPerKg,
      otherTemperatureSlopeKdPerJPerKg,
      massKg: selfMass,
      otherMassKg: otherMass
    });
  }
  if (
    radiationSupportM > 0
    && distance < radiationSupportM
    && emissivity > 0
    && otherEmissivity > 0
  ) {
    const viewAreaM2 = radiativeViewAreaM2(radiusM, otherRadiusM, distance);
    radiationEnergyJ = clampPairEnergy({
      energyJ: emissivity * otherEmissivity * STEFAN_BOLTZMANN_W_PER_M2_K4
        * (otherTemperatureK ** 4 - temperatureK ** 4)
        * viewAreaM2 * finiteNumber(dtS, 0),
      temperatureK,
      otherTemperatureK,
      temperatureSlopeKdPerJPerKg,
      otherTemperatureSlopeKdPerJPerKg,
      massKg: selfMass,
      otherMassKg: otherMass
    });
  }
  return Object.freeze({
    conductionSupportM,
    radiationSupportM,
    conductionEnergyJ,
    radiationEnergyJ,
    conductionSpecificEnergyDeltaJPerKg: conductionEnergyJ / selfMass,
    radiationSpecificEnergyDeltaJPerKg: radiationEnergyJ / selfMass,
    neighborMinTemperatureK: Math.min(temperatureK, otherTemperatureK),
    neighborMaxTemperatureK: Math.max(temperatureK, otherTemperatureK)
  });
}

function createThermalParamsArray({
  particleCount,
  materialCount,
  responseCount,
  dtS,
  smoothingLengthM,
  conductionRate,
  activeSourceProjectionMode =
    SCHROEDER_SPATIAL_THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_NONE,
  lookupMode = 0,
  neighborBins = null,
  candidateCapacity = 0
}) {
  const buffer = new ArrayBuffer(SCHROEDER_SPATIAL_THERMAL_PARAMS_BYTES);
  const view = new DataView(buffer);
  view.setUint32(0, exactU32(particleCount, 'particleCount', { positive: true }), true);
  view.setUint32(4, exactU32(materialCount, 'materialCount'), true);
  view.setUint32(8, exactU32(responseCount, 'responseCount'), true);
  view.setUint32(12, SCHROEDER_SPATIAL_SUPPORT_PROFILE_THERMAL_CONDUCTION_V1, true);
  view.setUint32(16, SCHROEDER_SPATIAL_SUPPORT_PROFILE_RADIATION_WIDE_V1, true);
  const projectionMode = exactU32(
    activeSourceProjectionMode,
    'activeSourceProjectionMode'
  );
  if (
    projectionMode
      > SCHROEDER_SPATIAL_THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_ACTIVE_RANK
  ) {
    throw new RangeError('activeSourceProjectionMode is unsupported');
  }
  view.setUint32(20, projectionMode, true);
  view.setFloat32(24, finiteNumber(dtS, 0), true);
  view.setFloat32(28, Math.max(0, finiteNumber(smoothingLengthM, 0)), true);
  view.setFloat32(32, Math.max(0, finiteNumber(conductionRate, 0)), true);
  view.setFloat32(36, RADIATION_PAIR_RANGE_RADII, true);
  view.setFloat32(40, STEFAN_BOLTZMANN_W_PER_M2_K4, true);
  view.setUint32(44, exactU32(candidateCapacity, 'candidateCapacity'), true);
  const binsReady = lookupMode === 1
    && neighborBins?.binsBuffer
    && exactU32(Number(neighborBins.capacity), 'neighborBins.capacity', {
      positive: true
    }) > 0
    && exactU32(Number(neighborBins.nx), 'neighborBins.nx', {
      positive: true
    }) > 0
    && exactU32(Number(neighborBins.ny), 'neighborBins.ny', {
      positive: true
    }) > 0
    && exactU32(Number(neighborBins.nz), 'neighborBins.nz', {
      positive: true
    }) > 0
    && finiteNumber(neighborBins.cellSizeM, 0) > 0;
  view.setUint32(48, exactU32(lookupMode, 'lookupMode'), true);
  view.setUint32(52, binsReady ? Number(neighborBins.capacity) : 0, true);
  view.setUint32(56, binsReady ? Number(neighborBins.nx) : 0, true);
  view.setUint32(60, binsReady ? Number(neighborBins.ny) : 0, true);
  view.setUint32(64, binsReady ? Number(neighborBins.nz) : 0, true);
  view.setUint32(68, binsReady
    ? Number(neighborBins.nx) * Number(neighborBins.ny) * Number(neighborBins.nz)
    : 0, true);
  view.setFloat32(72, binsReady ? Number(neighborBins.cellSizeM) : 0, true);
  view.setUint32(76, CLASSIC_THERMAL_MAX_BIN_SCAN_RADIUS_CELLS, true);
  return buffer;
}

function createProposalHeader(execution, particleCount) {
  const words = new Uint32Array(SCHROEDER_SPATIAL_THERMAL_PROPOSAL_HEADER_WORDS);
  words[0] = SCHROEDER_SPATIAL_THERMAL_PROPOSAL_MAGIC;
  words[1] = SCHROEDER_SPATIAL_THERMAL_PROPOSAL_VERSION;
  words[2] = exactU32(execution.generationId, 'execution.generationId', { positive: true });
  words[3] = exactU32(execution.supportEpoch, 'execution.supportEpoch');
  words[4] = exactU32(particleCount, 'particleCount', { positive: true });
  words[5] = SCHROEDER_SPATIAL_THERMAL_PROPOSAL_ROW_WORDS;
  words[8] = SCHROEDER_SPATIAL_SUPPORT_PROFILE_THERMAL_CONDUCTION_V1;
  words[9] = SCHROEDER_SPATIAL_SUPPORT_PROFILE_RADIATION_WIDE_V1;
  words[10] = exactU32(execution.positionEpoch, 'execution.positionEpoch');
  words[11] = exactU32(execution.topologyEpoch, 'execution.topologyEpoch');
  words[12] = exactU32(execution.storageGeneration, 'execution.storageGeneration', {
    positive: true
  });
  words[13] = exactU32(execution.physicsTick, 'execution.physicsTick');
  words[14] = exactU32(execution.physicsSubstep, 'execution.physicsSubstep');
  return words;
}

function createEvidenceInitial(execution, supportProfileId) {
  const words = new Uint32Array(SCHROEDER_SPATIAL_THERMAL_EVIDENCE_WORDS);
  words[8] = THERMAL_EVIDENCE_MAGIC;
  words[9] = supportProfileId;
  words[10] = execution.generationId;
  words[11] = execution.supportEpoch;
  words[12] = 2;
  return words;
}

function proposalBufferByteLength(capacity) {
  return (
    SCHROEDER_SPATIAL_THERMAL_PROPOSAL_HEADER_WORDS
    + capacity * SCHROEDER_SPATIAL_THERMAL_PROPOSAL_ROW_WORDS
  ) * Uint32Array.BYTES_PER_ELEMENT;
}

function derivedBufferByteLength(capacity) {
  return (
    SCHROEDER_SPATIAL_THERMAL_DERIVED_HEADER_WORDS
    + capacity * SCHROEDER_SPATIAL_THERMAL_DERIVED_ROW_WORDS
    + capacity
  ) * Uint32Array.BYTES_PER_ELEMENT;
}

function positiveSafeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${label} must be a positive safe integer`);
  }
  return value;
}

function thermalCsrReplayWordLength(sourceCapacity, candidateCapacity) {
  const resolvedCandidateCapacity = exactU32(
    candidateCapacity,
    'thermal CSR candidateCapacity',
    { positive: true }
  );
  return positiveSafeInteger(
    SCHROEDER_SPATIAL_THERMAL_CSR_CONTROL_WORDS
      + resolvedCandidateCapacity,
    'thermal CSR replay word length'
  );
}

function thermalCsrReplayByteLength(sourceCapacity, candidateCapacity) {
  return thermalCsrReplayWordLength(sourceCapacity, candidateCapacity)
    * Uint32Array.BYTES_PER_ELEMENT;
}

function thermalCsrRowStateByteLength(sourceCapacity) {
  const resolvedSourceCapacity = exactU32(
    sourceCapacity,
    'thermal CSR sourceCapacity',
    { positive: true }
  );
  return positiveSafeInteger(
    resolvedSourceCapacity * Uint32Array.BYTES_PER_ELEMENT,
    'thermal CSR row-state byte length'
  );
}

function thermalCsrHeader(sourceCapacity, candidateCapacity, rowStride) {
  const words = new Uint32Array(SCHROEDER_SPATIAL_THERMAL_CSR_CONTROL_WORDS);
  words[0] = SCHROEDER_SPATIAL_THERMAL_CSR_MAGIC;
  words[1] = SCHROEDER_SPATIAL_THERMAL_CSR_VERSION;
  words[2] = exactU32(sourceCapacity, 'thermal CSR sourceCapacity', {
    positive: true
  });
  words[3] = exactU32(candidateCapacity, 'thermal CSR candidateCapacity', {
    positive: true
  });
  words[SCHROEDER_SPATIAL_THERMAL_CSR_ROW_STRIDE_WORD] = exactU32(
    rowStride,
    'thermal CSR rowStride',
    { positive: true }
  );
  return words;
}

function thermalCsrCandidateCapacityPlan(device, sourceCapacity) {
  const resolvedSourceCapacity = exactU32(
    sourceCapacity,
    'thermal CSR sourceCapacity',
    { positive: true }
  );
  // A fixed source-major row eliminates the old global append/scan/scatter
  // pipeline. It deliberately keeps a no-truncation *receipt*: if a source
  // exceeds its retained row, the shader invalidates that optional receipt
  // rather than publishing a prefix. The exact budget still completes its
  // authenticated walk and the reciprocal proposal rewalks the directory.
  // The default row fits the full active 1,024-particle source set plus one
  // terminal sentinel under common limits.
  const storageLimitBytes = Math.max(
    4,
    Math.floor(finiteNumber(
      device?.limits?.maxStorageBufferBindingSize,
      128 * 1024 * 1024
    ))
  );
  const bufferLimitBytes = Math.max(
    4,
    Math.floor(finiteNumber(
      device?.limits?.maxBufferSize,
      storageLimitBytes
    ))
  );
  const bindingLimitBytes = Math.min(storageLimitBytes, bufferLimitBytes);
  const maximumCandidateCapacity = Math.min(
    0x7fff_ffff,
    Math.floor(bindingLimitBytes / Uint32Array.BYTES_PER_ELEMENT)
      - SCHROEDER_SPATIAL_THERMAL_CSR_CONTROL_WORDS
  );
  const maximumRowStride = Math.floor(
    Math.max(0, maximumCandidateCapacity) / resolvedSourceCapacity
  );
  if (maximumRowStride < 1) {
    throw new RangeError(
      `thermal CSR cannot retain one candidate row per source for ${
        resolvedSourceCapacity
      } particles on this device`
    );
  }
  const rowStride = Math.min(
    SCHROEDER_SPATIAL_THERMAL_CSR_DEFAULT_ROW_STRIDE,
    maximumRowStride
  );
  const candidateCapacity = positiveSafeInteger(
    resolvedSourceCapacity * rowStride,
    'thermal CSR fixed-row candidate capacity'
  );
  return Object.freeze({
    sourceCapacity: resolvedSourceCapacity,
    rowStride,
    candidateCapacity,
    maximumCandidateCapacity,
    replayByteLength: thermalCsrReplayByteLength(
      resolvedSourceCapacity,
      candidateCapacity
    ),
    rowStateByteLength: thermalCsrRowStateByteLength(resolvedSourceCapacity),
    overflowPolicy:
      'candidate-receipt-fail-closed-then-authenticated-exact-near-rewalk-no-truncated-source-row-publication'
  });
}

function cpuStateMayAlreadyBeThermallyUniform(sphParticleState) {
  // A GPU-resident continuation deliberately retains the old CPU mirror.
  // That mirror cannot decide whether a new GPU temperature field is uniform:
  // suppressing the optional receipt here would force the safe but redundant
  // two-walk path on every subsequent non-uniform epoch.  The GPU-derived
  // uniform certificate remains the sole authority for the true fast path.
  if (sphParticleState?.cpuStateStale === true) return false;
  const state = sphParticleState?.state;
  const thermo = sphParticleState?.thermo;
  const particleCount = Number(sphParticleState?.particleCount);
  if (
    !ArrayBuffer.isView(state)
    || !ArrayBuffer.isView(thermo)
    || !Number.isInteger(particleCount)
    || particleCount < 1
    || state.length < particleCount * 8
    || thermo.length < particleCount * 12
  ) {
    return false;
  }
  let referenceEnergy = null;
  let referenceThermo = null;
  for (let particleIndex = 0; particleIndex < particleCount; particleIndex += 1) {
    const stateOffset = particleIndex * 8;
    const thermoOffset = particleIndex * 12;
    if (!(Number(state[stateOffset + 3]) > 0)) continue;
    const energy = Number(state[stateOffset + 7]);
    if (!Number.isFinite(energy)) return false;
    if (referenceEnergy == null) {
      referenceEnergy = energy;
      referenceThermo = Array.from(thermo.slice(thermoOffset, thermoOffset + 12));
      continue;
    }
    if (energy !== referenceEnergy) return false;
    for (let lane = 0; lane < 12; lane += 1) {
      if (Number(thermo[thermoOffset + lane]) !== referenceThermo[lane]) {
        return false;
      }
    }
  }
  // This value only decides whether the optional CSR path is attempted. A
  // positive result preserves the established exact traversal, so stale CPU
  // mirrors cannot weaken physics or the GPU uniform completion certificate.
  return referenceEnergy != null;
}

function createRuntimeEntry(
  device,
  arenaIndex,
  spatialCapacity,
  capacity,
  labelPrefix = 'ulg-schroeder-spatial-thermal'
) {
  const thermalCsrDummyBindingAlignment = Math.max(
    256,
    Math.floor(finiteNumber(
      device?.limits?.minStorageBufferOffsetAlignment,
      256
    ))
  );
  const buffers = {
    derivedBuffer: createBuffer(
      device,
      `${labelPrefix}-derived-${spatialCapacity}-arena-${arenaIndex}`,
      derivedBufferByteLength(capacity),
      GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
    ),
    proposalBuffer: createBuffer(
      device,
      `${labelPrefix}-proposals-${spatialCapacity}-arena-${arenaIndex}`,
      proposalBufferByteLength(capacity),
      GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
    ),
    conductionEvidenceBuffer: createBuffer(
      device,
      `${labelPrefix}-conduction-evidence-${spatialCapacity}-arena-${arenaIndex}`,
      SCHROEDER_SPATIAL_THERMAL_EVIDENCE_WORDS * Uint32Array.BYTES_PER_ELEMENT,
      GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
    ),
    radiationEvidenceBuffer: createBuffer(
      device,
      `${labelPrefix}-radiation-evidence-${spatialCapacity}-arena-${arenaIndex}`,
      SCHROEDER_SPATIAL_THERMAL_EVIDENCE_WORDS * Uint32Array.BYTES_PER_ELEMENT,
      GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
    ),
    conductionExpectationBuffer: createBuffer(
      device,
      `${labelPrefix}-conduction-expectation-${spatialCapacity}-arena-${arenaIndex}`,
      EXPECTATION_BYTES,
      GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
    ),
    radiationExpectationBuffer: createBuffer(
      device,
      `${labelPrefix}-radiation-expectation-${spatialCapacity}-arena-${arenaIndex}`,
      EXPECTATION_BYTES,
      GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
    ),
    paramsBuffer: createBuffer(
      device,
      `${labelPrefix}-params-${spatialCapacity}-arena-${arenaIndex}`,
      SCHROEDER_SPATIAL_THERMAL_PARAMS_BYTES,
      GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
    ),
    activeDispatchBuffer: createBuffer(
      device,
      `${labelPrefix}-active-dispatch-${spatialCapacity}-arena-${arenaIndex}`,
      3 * Uint32Array.BYTES_PER_ELEMENT,
      GPU_BUFFER_USAGE.STORAGE
        | GPU_BUFFER_USAGE.INDIRECT
        | GPU_BUFFER_USAGE.COPY_SRC
        | GPU_BUFFER_USAGE.COPY_DST
    ),
    // The exact shader keeps its CSR ABI declared even when the optional
    // capture path is disabled. Bind three non-overlapping storage ranges so
    // WebGPU's writable-alias validation remains satisfied without allocating
    // a full CSR arena for a known-uniform CPU mirror.
    thermalCsrDummyBuffer: createBuffer(
      device,
      `${labelPrefix}-csr-disabled-bindings-${spatialCapacity}-arena-${arenaIndex}`,
      thermalCsrDummyBindingAlignment * 3,
      GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
    )
  };
  return {
    arenaIndex,
    spatialCapacity,
    capacity,
    thermalCsrDummyBindingAlignment,
    buffers,
    destroyers: Object.values(buffers).map(destroyOnce),
    inUseGenerationId: null,
    releaseScheduled: false
  };
}

function ensureThermalCandidateCsrRuntime(device, entry) {
  if (entry.thermalCandidateCsr) return entry.thermalCandidateCsr;
  if (entry.thermalCandidateCsrFailure) {
    return Object.freeze({
      available: false,
      reason: entry.thermalCandidateCsrFailure
    });
  }
  let plan;
  let sourceRowStateBuffer = null;
  let replayBuffer = null;
  try {
    plan = thermalCsrCandidateCapacityPlan(device, entry.capacity);
    sourceRowStateBuffer = createBuffer(
      device,
      `ulg-schroeder-spatial-thermal-csr-source-rows-${entry.spatialCapacity}-arena-${entry.arenaIndex}`,
      plan.rowStateByteLength,
      GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
    );
    replayBuffer = createBuffer(
      device,
      `ulg-schroeder-spatial-thermal-csr-replay-${entry.spatialCapacity}-arena-${entry.arenaIndex}`,
      plan.replayByteLength,
      GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
    );
    const candidateCsr = Object.freeze({
      available: true,
      schema: ULG_SCHROEDER_SPATIAL_THERMAL_CANDIDATE_CSR_SCHEMA,
      construction: 'budget-exact-near-fixed-source-row-direct-publication',
      sourceCapacity: entry.capacity,
      rowStride: plan.rowStride,
      candidateCapacity: plan.candidateCapacity,
      sourceRowStateBuffer,
      replayBuffer,
      overflowPolicy: plan.overflowPolicy,
      // The production path never maps this buffer.  A probe may copy only
      // this fixed control header after a submitted step to classify the
      // terminal route without reading particles or candidate rows.
      routeEvidence: Object.freeze({
        schema: 'peercompute.ulg.schroeder-spatial-thermal-candidate-csr-route-evidence.v1',
        magic: SCHROEDER_SPATIAL_THERMAL_CSR_MAGIC,
        version: SCHROEDER_SPATIAL_THERMAL_CSR_VERSION,
        controlWordCount: SCHROEDER_SPATIAL_THERMAL_CSR_CONTROL_WORDS,
        readbackByteLength:
          SCHROEDER_SPATIAL_THERMAL_CSR_CONTROL_WORDS * Uint32Array.BYTES_PER_ELEMENT,
        statusWord: SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_WORD,
        routeWord: SCHROEDER_SPATIAL_THERMAL_CSR_ROUTE_WORD,
        statusBits: Object.freeze({
          ready: SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_READY,
          invalid: SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_INVALID,
          overflow: SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_OVERFLOW,
          rowsFinalized: SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_ROWS_FINALIZED,
          validated: SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_VALIDATED
        }),
        routeBits: Object.freeze({
          uniformCompletion: SCHROEDER_SPATIAL_THERMAL_CSR_ROUTE_UNIFORM_COMPLETION,
          replay: SCHROEDER_SPATIAL_THERMAL_CSR_ROUTE_REPLAY,
          exactNearRewalk: SCHROEDER_SPATIAL_THERMAL_CSR_ROUTE_EXACT_NEAR_REWALK
        }),
        capturePolicy: 'diagnostic-only-explicit-control-header-readback',
        normalHotLoopReadbackFree: true
      })
    });
    entry.thermalCandidateCsr = candidateCsr;
    entry.destroyers.push(
      destroyOnce(sourceRowStateBuffer),
      destroyOnce(replayBuffer)
    );
    return candidateCsr;
  } catch (error) {
    for (const buffer of [
      sourceRowStateBuffer,
      replayBuffer
    ]) {
      buffer?.destroy?.();
    }
    entry.thermalCandidateCsrFailure = String(
      error?.message || error || 'thermal-csr-runtime-allocation-failed'
    );
    return Object.freeze({
      available: false,
      reason: entry.thermalCandidateCsrFailure
    });
  }
}

function acquireRuntimeEntry(device, execution, particleCount) {
  const arenaIndex = exactU32(execution.arenaIndex, 'execution.arenaIndex');
  const spatialCapacity = exactU32(
    execution.sourceCapacity,
    'execution.sourceCapacity',
    { positive: true }
  );
  const entryKey = `${spatialCapacity}:${arenaIndex}`;
  const capacity = positiveCapacity(particleCount);
  let runtime = thermalRuntimeByDevice.get(device);
  if (!runtime) {
    runtime = { entries: new Map(), allocationCount: 0 };
    thermalRuntimeByDevice.set(device, runtime);
  }
  let entry = runtime.entries.get(entryKey) || null;
  let cacheHit = Boolean(entry && entry.capacity >= capacity);
  if (entry?.inUseGenerationId != null) {
    throw new Error(
      `Thermal proposal arena ${arenaIndex} is still leased by generation ${entry.inUseGenerationId}`
    );
  }
  if (!entry || entry.capacity < capacity) {
    if (entry) for (const destroy of entry.destroyers) destroy();
    entry = createRuntimeEntry(device, arenaIndex, spatialCapacity, capacity);
    runtime.entries.set(entryKey, entry);
    runtime.allocationCount += Object.keys(entry.buffers).length;
    cacheHit = false;
  }
  entry.inUseGenerationId = execution.generationId;
  entry.releaseScheduled = false;
  return { runtime, entry, cacheHit };
}

export function destroySchroederSpatialThermalProposalRuntime(device, {
  force = false
} = {}) {
  const runtime = thermalRuntimeByDevice.get(device);
  if (!runtime) return false;
  const active = [...runtime.entries.values()].filter(
    (entry) => entry.inUseGenerationId != null
  );
  if (active.length > 0 && !force) {
    throw new Error('Cannot destroy a thermal proposal runtime with active generation leases');
  }
  for (const entry of runtime.entries.values()) {
    for (const destroy of entry.destroyers) destroy();
  }
  thermalRuntimeByDevice.delete(device);
  return true;
}

function createClassicThermalRuntimeEntry(device, arenaIndex, capacity) {
  const entry = createRuntimeEntry(
    device,
    arenaIndex,
    capacity,
    capacity,
    'ulg-classic-thermal-v2'
  );
  const lookupPlaceholderBuffer = createBuffer(
    device,
    `ulg-classic-thermal-v2-empty-bins-${capacity}-arena-${arenaIndex}`,
    Uint32Array.BYTES_PER_ELEMENT,
    GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
  );
  const maxStorageBytes = Math.max(
    4,
    Number(device.limits?.maxStorageBufferBindingSize) || 128 * 1024 * 1024
  );
  const candidateCapacity = Math.max(1, Math.min(
    CLASSIC_THERMAL_CANDIDATE_CAPACITY_DEFAULT,
    Math.floor(maxStorageBytes / (capacity * Uint32Array.BYTES_PER_ELEMENT)) - 1
  ));
  const candidateDirectoryBuffer = createBuffer(
    device,
    `ulg-classic-thermal-v2-candidates-${capacity}-arena-${arenaIndex}`,
    capacity * (1 + candidateCapacity) * Uint32Array.BYTES_PER_ELEMENT,
    GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
  );
  entry.buffers.lookupPlaceholderBuffer = lookupPlaceholderBuffer;
  entry.buffers.candidateDirectoryBuffer = candidateDirectoryBuffer;
  entry.candidateCapacity = candidateCapacity;
  entry.destroyers.push(destroyOnce(lookupPlaceholderBuffer));
  entry.destroyers.push(destroyOnce(candidateDirectoryBuffer));
  return entry;
}

function acquireClassicThermalRuntimeEntry(device, particleCount) {
  const capacity = positiveCapacity(particleCount);
  let runtime = classicThermalRuntimeByDevice.get(device);
  if (!runtime) {
    runtime = {
      entries: [],
      allocationCount: 0,
      nextGenerationId: 1
    };
    classicThermalRuntimeByDevice.set(device, runtime);
  }
  let entry = runtime.entries.find((candidate) => (
    candidate.inUseGenerationId == null && candidate.capacity >= capacity
  )) || null;
  let cacheHit = Boolean(entry);
  if (!entry) {
    const replaceIndex = runtime.entries.findIndex((candidate) => (
      candidate.inUseGenerationId == null
    ));
    const arenaIndex = replaceIndex >= 0 ? replaceIndex : runtime.entries.length;
    if (replaceIndex >= 0) {
      for (const destroy of runtime.entries[replaceIndex].destroyers) destroy();
    }
    entry = createClassicThermalRuntimeEntry(device, arenaIndex, capacity);
    if (replaceIndex >= 0) runtime.entries[replaceIndex] = entry;
    else runtime.entries.push(entry);
    runtime.allocationCount += Object.keys(entry.buffers).length;
    cacheHit = false;
  }
  const generationId = runtime.nextGenerationId;
  runtime.nextGenerationId = generationId === 0xffff_ffff
    ? 1
    : generationId + 1;
  entry.inUseGenerationId = generationId;
  entry.releaseScheduled = false;
  return {
    runtime,
    entry,
    cacheHit,
    execution: Object.freeze({
      generationId,
      supportEpoch: 0,
      positionEpoch: 0,
      topologyEpoch: 0,
      storageGeneration: 1,
      physicsTick: 0,
      physicsSubstep: 0,
      arenaIndex: entry.arenaIndex,
      sourceCapacity: entry.capacity,
      sourceCount: particleCount
    })
  };
}

export function destroyClassicThermalProposalRuntime(device, {
  force = false
} = {}) {
  const runtime = classicThermalRuntimeByDevice.get(device);
  if (!runtime) return false;
  const active = runtime.entries.filter((entry) => entry.inUseGenerationId != null);
  if (active.length > 0 && !force) {
    throw new Error('Cannot destroy classic thermal proposal runtime with active leases');
  }
  for (const entry of runtime.entries) {
    for (const destroy of entry.destroyers) destroy();
  }
  classicThermalRuntimeByDevice.delete(device);
  return true;
}

export const schroederSpatialThermalDerivedPrepassWgsl = /* wgsl */ `
struct ThermalProposalParams {
  particle_count: u32,
  material_count: u32,
  response_count: u32,
  conduction_support_profile_id: u32,
  radiation_support_profile_id: u32,
  active_member_projection_enabled: u32,
  dt_s: f32,
  smoothing_length_m: f32,
  conduction_rate: f32,
  radiation_pair_range_radii: f32,
  stefan_boltzmann_w_per_m2_k4: f32,
  candidate_capacity: u32,
  lookup_mode: u32,
  bin_capacity: u32,
  bin_nx: u32,
  bin_ny: u32,
  bin_nz: u32,
  bin_cell_count: u32,
  bin_cell_size_m: f32,
  max_bin_scan_radius_cells: u32,
};

@group(0) @binding(0) var<storage, read> source_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> source_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> phase_response_records: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> phase_responses: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> thermal_graph_nodes: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read> thermal_graph_samples: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> thermal_derived: array<atomic<u32>>;
@group(0) @binding(7) var<uniform> thermal_params: ThermalProposalParams;
@group(0) @binding(8) var<storage, read> directory_position_state: array<vec4<f32>>;
@group(0) @binding(9) var<storage, read> preflight_spatial_directory: array<u32>;
@group(0) @binding(10) var<storage, read> preflight_spatial_aggregate_view: array<u32>;
@group(0) @binding(11) var<storage, read_write> thermal_active_dispatch: array<atomic<u32>>;

const THERMAL_PREFLIGHT_AGGREGATE_MAGIC: u32 = 0x53414731u;
const THERMAL_PREFLIGHT_AGGREGATE_VERSION: u32 = 2u;
const THERMAL_PREFLIGHT_AGGREGATE_STATUS_EXACT: u32 = 259u;
const THERMAL_PREFLIGHT_AGGREGATE_HEADER_WORDS: u32 = 112u;
const THERMAL_PREFLIGHT_AGGREGATE_RECORD_WORDS: u32 = 44u;
const THERMAL_PREFLIGHT_ACTIVE_MEMBER_MAGIC: u32 = 0x53414d31u;
const THERMAL_PREFLIGHT_ACTIVE_MEMBER_VERSION: u32 = 1u;
const THERMAL_PREFLIGHT_ACTIVE_MEMBER_STATUS_EXACT: u32 = 3u;
const THERMAL_PREFLIGHT_ACTIVE_MEMBER_ADMITTED: u32 = ${SCHROEDER_SPATIAL_THERMAL_ACTIVE_MEMBER_PROJECTION_ADMITTED}u;
const THERMAL_PREFLIGHT_ACTIVE_MEMBER_REJECTED: u32 = ${SCHROEDER_SPATIAL_THERMAL_ACTIVE_MEMBER_PROJECTION_REJECTED}u;
const THERMAL_PREFLIGHT_ACTIVE_MEMBER_ADMISSION_WORD: u32 = ${SCHROEDER_SPATIAL_THERMAL_ACTIVE_MEMBER_PROJECTION_ADMISSION_WORD}u;
const THERMAL_PREFLIGHT_CURRENT_ACTIVE_SOURCE_COUNT_WORD: u32 = ${SCHROEDER_SPATIAL_THERMAL_CURRENT_ACTIVE_SOURCE_COUNT_WORD}u;
const THERMAL_PREFLIGHT_EXPECTED_ACTIVE_MEMBER_COUNT_WORD: u32 = ${SCHROEDER_SPATIAL_THERMAL_EXPECTED_ACTIVE_MEMBER_COUNT_WORD}u;
const THERMAL_PREFLIGHT_ACTIVE_SOURCE_RANK_COUNT_WORD: u32 = ${SCHROEDER_SPATIAL_THERMAL_ACTIVE_SOURCE_RANK_COUNT_WORD}u;
const THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_NONE: u32 = ${SCHROEDER_SPATIAL_THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_NONE}u;
const THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_AGGREGATE: u32 = ${SCHROEDER_SPATIAL_THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_AGGREGATE}u;
const THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_LOCAL: u32 = ${SCHROEDER_SPATIAL_THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_LOCAL}u;
const THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_ACTIVE_RANK: u32 = ${SCHROEDER_SPATIAL_THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_ACTIVE_RANK}u;
const THERMAL_PREFLIGHT_ACTIVE_RANK_MAGIC: u32 = ${SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_MAGIC >>> 0}u;
const THERMAL_PREFLIGHT_ACTIVE_RANK_VERSION: u32 = ${SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_VERSION}u;
const THERMAL_PREFLIGHT_ACTIVE_RANK_STATUS_EXACT: u32 = ${
  SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_STATUS_READY
  | SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_STATUS_ADMITTED
}u;
const THERMAL_PREFLIGHT_ACTIVE_RANK_HEADER_WORDS: u32 = ${SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_HEADER_WORDS}u;
const THERMAL_PREFLIGHT_ACTIVE_RANK_MAX_SOURCE_COUNT: u32 = ${SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_MAX_SOURCE_COUNT}u;
const THERMAL_PREFLIGHT_ACTIVE_RANK_RANKS_PER_LANE: u32 = ${SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_MAX_RANKS_PER_LANE}u;
const THERMAL_PREFLIGHT_ACTIVE_RANK_FINGERPRINT_BASIS: u32 = 2166136261u;
const THERMAL_PREFLIGHT_ACTIVE_RANK_FINGERPRINT_PRIME: u32 = 16777619u;
const THERMAL_PREFLIGHT_DIRECTORY_MAGIC: u32 = 0x53534531u;
const THERMAL_PREFLIGHT_DIRECTORY_VERSION: u32 = 1u;
const THERMAL_PREFLIGHT_DIRECTORY_HEADER_WORDS: u32 = 48u;
const THERMAL_PREFLIGHT_DIRECTORY_READY: u32 = 1u;
const THERMAL_PREFLIGHT_DIRECTORY_ADMITTED: u32 = 2u;
const THERMAL_PREFLIGHT_DIRECTORY_REJECTED_MASK: u32 = 4u | 8u | 16u;

struct ThermalPrepassSourceLookup {
  admitted: u32,
  source_index: u32,
};

fn thermal_prepass_finite(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823e38;
}

fn thermal_prepass_source_at_rank(source_rank: u32) -> ThermalPrepassSourceLookup {
  if (
    thermal_params.active_member_projection_enabled
      != THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_LOCAL
    && thermal_params.active_member_projection_enabled
      != THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_ACTIVE_RANK
  ) {
    return ThermalPrepassSourceLookup(
      select(0u, 1u, source_rank < thermal_params.particle_count),
      source_rank
    );
  }
  let bound_words = arrayLength(&preflight_spatial_directory);
  if (bound_words < THERMAL_PREFLIGHT_DIRECTORY_HEADER_WORDS) {
    return ThermalPrepassSourceLookup(0u, 0u);
  }
  let status = preflight_spatial_directory[2u];
  let source_count = preflight_spatial_directory[16u];
  let source_capacity = preflight_spatial_directory[17u];
  let directory_capacity = preflight_spatial_directory[22u];
  let member_offset = preflight_spatial_directory[31u];
  let physical_upper = preflight_spatial_directory[47u];
  if (
    preflight_spatial_directory[0u] != THERMAL_PREFLIGHT_DIRECTORY_MAGIC
    || preflight_spatial_directory[1u] != THERMAL_PREFLIGHT_DIRECTORY_VERSION
    || (status & (
      THERMAL_PREFLIGHT_DIRECTORY_READY
        | THERMAL_PREFLIGHT_DIRECTORY_ADMITTED
    )) != (
      THERMAL_PREFLIGHT_DIRECTORY_READY
        | THERMAL_PREFLIGHT_DIRECTORY_ADMITTED
    )
    || (status & THERMAL_PREFLIGHT_DIRECTORY_REJECTED_MASK) != 0u
    || source_count != thermal_params.particle_count
    || source_count > source_capacity
    || source_rank >= source_count
    || directory_capacity > bound_words
    || physical_upper > directory_capacity
    || member_offset > physical_upper
    || source_count > physical_upper - member_offset
  ) {
    return ThermalPrepassSourceLookup(0u, 0u);
  }
  let source_index = preflight_spatial_directory[member_offset + source_rank];
  return ThermalPrepassSourceLookup(
    select(0u, 1u, source_index < source_count),
    source_index
  );
}

fn thermal_prepass_projection_mix(input_value: u32) -> u32 {
  var value = input_value;
  value = (value ^ (value >> 16u)) * 0x7feb352du;
  value = (value ^ (value >> 15u)) * 0x846ca68bu;
  return value ^ (value >> 16u);
}

fn thermal_prepass_projection_fold(seed: u32, value: u32) -> u32 {
  return thermal_prepass_projection_mix(
    seed ^ thermal_prepass_projection_mix(value)
  );
}

fn thermal_prepass_projection_fingerprint(active_member_count: u32) -> u32 {
  var value = thermal_prepass_projection_fold(
    preflight_spatial_aggregate_view[101u],
    THERMAL_PREFLIGHT_ACTIVE_MEMBER_MAGIC
  );
  value = thermal_prepass_projection_fold(
    value,
    preflight_spatial_aggregate_view[94u]
  );
  value = thermal_prepass_projection_fold(
    value,
    preflight_spatial_aggregate_view[95u]
  );
  value = thermal_prepass_projection_fold(
    value,
    preflight_spatial_directory[16u]
  );
  value = thermal_prepass_projection_fold(
    value,
    preflight_spatial_directory[18u]
  );
  value = thermal_prepass_projection_fold(value, active_member_count);
  value = thermal_prepass_projection_fold(
    value,
    preflight_spatial_directory[3u]
  );
  value = thermal_prepass_projection_fold(
    value,
    preflight_spatial_directory[8u]
  );
  return thermal_prepass_projection_fold(
    value,
    preflight_spatial_directory[35u]
  );
}

fn thermal_prepass_replay_guard_token(cell_count: u32) -> u32 {
  var value = thermal_prepass_projection_fold(
    THERMAL_PREFLIGHT_AGGREGATE_MAGIC,
    preflight_spatial_directory[16u]
  );
  value = thermal_prepass_projection_fold(value, cell_count);
  value = thermal_prepass_projection_fold(
    value,
    preflight_spatial_directory[3u]
  );
  value = thermal_prepass_projection_fold(
    value,
    preflight_spatial_directory[8u]
  );
  value = thermal_prepass_projection_fold(
    value,
    preflight_spatial_directory[11u]
  );
  value = thermal_prepass_projection_fold(
    value,
    preflight_spatial_directory[12u]
  );
  value = thermal_prepass_projection_fold(
    value,
    preflight_spatial_directory[13u]
  );
  value = thermal_prepass_projection_fold(
    value,
    preflight_spatial_directory[14u]
  );
  value = thermal_prepass_projection_fold(
    value,
    preflight_spatial_directory[15u]
  );
  return thermal_prepass_projection_fold(
    value,
    preflight_spatial_directory[35u]
  );
}

fn thermal_prepass_header_fingerprint(
  replay_token: u32,
  total_record_count: u32,
  root_record_index: u32
) -> u32 {
  var value = thermal_prepass_projection_fold(
    replay_token,
    total_record_count
  );
  value = thermal_prepass_projection_fold(value, root_record_index);
  return thermal_prepass_projection_fold(value, 160u);
}

fn thermal_prepass_active_rank_fold(value: u32, word: u32) -> u32 {
  return (value ^ word) * THERMAL_PREFLIGHT_ACTIVE_RANK_FINGERPRINT_PRIME;
}

fn thermal_prepass_active_rank_replay_guard_token() -> u32 {
  var value = thermal_prepass_active_rank_fold(
    THERMAL_PREFLIGHT_ACTIVE_RANK_FINGERPRINT_BASIS,
    preflight_spatial_directory[3u]
  );
  value = thermal_prepass_active_rank_fold(value, preflight_spatial_directory[7u]);
  value = thermal_prepass_active_rank_fold(value, preflight_spatial_directory[8u]);
  value = thermal_prepass_active_rank_fold(value, preflight_spatial_directory[9u]);
  value = thermal_prepass_active_rank_fold(value, preflight_spatial_directory[10u]);
  value = thermal_prepass_active_rank_fold(value, preflight_spatial_directory[11u]);
  value = thermal_prepass_active_rank_fold(value, preflight_spatial_directory[12u]);
  value = thermal_prepass_active_rank_fold(value, preflight_spatial_directory[13u]);
  value = thermal_prepass_active_rank_fold(value, preflight_spatial_directory[14u]);
  value = thermal_prepass_active_rank_fold(value, preflight_spatial_directory[15u]);
  return thermal_prepass_active_rank_fold(value, preflight_spatial_directory[35u]);
}

fn thermal_prepass_active_rank_header_fingerprint(
  replay_token: u32,
  active_count: u32,
  dormant_count: u32,
  prefix_offset: u32,
  prefix_capacity: u32,
  active_ranks_offset: u32,
  active_rank_capacity: u32,
  active_source_indices_offset: u32,
  active_source_index_capacity: u32
) -> u32 {
  var value = thermal_prepass_active_rank_fold(replay_token, prefix_offset);
  value = thermal_prepass_active_rank_fold(value, prefix_capacity);
  value = thermal_prepass_active_rank_fold(value, active_ranks_offset);
  value = thermal_prepass_active_rank_fold(value, active_rank_capacity);
  value = thermal_prepass_active_rank_fold(value, active_source_indices_offset);
  value = thermal_prepass_active_rank_fold(value, active_source_index_capacity);
  value = thermal_prepass_active_rank_fold(value, active_count);
  value = thermal_prepass_active_rank_fold(value, dormant_count);
  return thermal_prepass_active_rank_fold(value, 1u);
}

// Binding 10 is polymorphic: hierarchy aggregate data in mode 1 and the
// base epoch's immutable canonical active-rank data in mode 3.  Authenticate
// the full v1 header before its indirect count or compact lists can influence
// thermal work; a bad sidecar must make the later full-P sealing path reject.
fn thermal_prepass_active_rank_view_admitted() -> bool {
  if (
    thermal_params.active_member_projection_enabled
      != THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_ACTIVE_RANK
  ) { return false; }
  let directory_bound_words = arrayLength(&preflight_spatial_directory);
  let view_bound_words = arrayLength(&preflight_spatial_aggregate_view);
  if (
    directory_bound_words < THERMAL_PREFLIGHT_DIRECTORY_HEADER_WORDS
    || view_bound_words < THERMAL_PREFLIGHT_ACTIVE_RANK_HEADER_WORDS
  ) { return false; }
  let source_count = preflight_spatial_directory[16u];
  let source_capacity = preflight_spatial_directory[17u];
  let cell_count = preflight_spatial_directory[18u];
  let cell_capacity = preflight_spatial_directory[19u];
  let directory_capacity = preflight_spatial_directory[22u];
  let directory_high_water = preflight_spatial_directory[47u];
  let directory_members_offset = preflight_spatial_directory[31u];
  if (
    preflight_spatial_directory[0u] != THERMAL_PREFLIGHT_DIRECTORY_MAGIC
    || preflight_spatial_directory[1u] != THERMAL_PREFLIGHT_DIRECTORY_VERSION
    || preflight_spatial_directory[2u] != (
      THERMAL_PREFLIGHT_DIRECTORY_READY | THERMAL_PREFLIGHT_DIRECTORY_ADMITTED
    )
    || source_count == 0u
    || source_count != thermal_params.particle_count
    || source_count > source_capacity
    || source_capacity > THERMAL_PREFLIGHT_ACTIVE_RANK_MAX_SOURCE_COUNT
    || cell_count > cell_capacity
    || directory_capacity > directory_bound_words
    || directory_high_water > directory_capacity
    || directory_members_offset > directory_high_water
    || source_count > directory_high_water - directory_members_offset
  ) { return false; }
  let prefix_offset = THERMAL_PREFLIGHT_ACTIVE_RANK_HEADER_WORDS;
  let prefix_capacity = source_capacity + 1u;
  let active_ranks_offset = prefix_offset + prefix_capacity;
  let active_source_indices_offset = active_ranks_offset + source_capacity;
  let physical_capacity = active_source_indices_offset + source_capacity;
  let active_count = preflight_spatial_aggregate_view[26u];
  let dormant_count = preflight_spatial_aggregate_view[27u];
  let replay_token = thermal_prepass_active_rank_replay_guard_token();
  let dispatch_x = max(1u, (active_count + 63u) / 64u);
  return physical_capacity <= view_bound_words
    && preflight_spatial_aggregate_view[0u]
      == THERMAL_PREFLIGHT_ACTIVE_RANK_MAGIC
    && preflight_spatial_aggregate_view[1u]
      == THERMAL_PREFLIGHT_ACTIVE_RANK_VERSION
    && preflight_spatial_aggregate_view[2u]
      == THERMAL_PREFLIGHT_ACTIVE_RANK_STATUS_EXACT
    && preflight_spatial_aggregate_view[3u] == preflight_spatial_directory[3u]
    && preflight_spatial_aggregate_view[4u] == preflight_spatial_directory[4u]
    && preflight_spatial_aggregate_view[5u] == preflight_spatial_directory[5u]
    && preflight_spatial_aggregate_view[6u] == preflight_spatial_directory[6u]
    && preflight_spatial_aggregate_view[7u] == preflight_spatial_directory[7u]
    && preflight_spatial_aggregate_view[8u] == preflight_spatial_directory[8u]
    && preflight_spatial_aggregate_view[9u] == preflight_spatial_directory[9u]
    && preflight_spatial_aggregate_view[10u] == preflight_spatial_directory[10u]
    && preflight_spatial_aggregate_view[11u] == preflight_spatial_directory[11u]
    && preflight_spatial_aggregate_view[12u] == preflight_spatial_directory[12u]
    && preflight_spatial_aggregate_view[13u] == preflight_spatial_directory[13u]
    && preflight_spatial_aggregate_view[14u] == preflight_spatial_directory[14u]
    && preflight_spatial_aggregate_view[15u] == preflight_spatial_directory[15u]
    && preflight_spatial_aggregate_view[16u] == source_count
    && preflight_spatial_aggregate_view[17u] == source_capacity
    && preflight_spatial_aggregate_view[18u] == cell_count
    && preflight_spatial_aggregate_view[19u] == cell_capacity
    && preflight_spatial_aggregate_view[20u]
      == THERMAL_PREFLIGHT_ACTIVE_RANK_HEADER_WORDS
    && preflight_spatial_aggregate_view[21u] == prefix_offset
    && preflight_spatial_aggregate_view[22u] == prefix_capacity
    && preflight_spatial_aggregate_view[23u] == active_ranks_offset
    && preflight_spatial_aggregate_view[24u] == source_capacity
    && preflight_spatial_aggregate_view[25u] == physical_capacity
    && active_count <= source_count
    && dormant_count == source_count - active_count
    && preflight_spatial_aggregate_view[28u] == 0u
    && preflight_spatial_aggregate_view[29u] == 1u
    && preflight_spatial_aggregate_view[30u] == preflight_spatial_directory[46u]
    && preflight_spatial_aggregate_view[31u] == directory_members_offset
    && preflight_spatial_aggregate_view[32u] == preflight_spatial_directory[35u]
    && preflight_spatial_aggregate_view[33u] == preflight_spatial_directory[35u]
    && preflight_spatial_aggregate_view[34u] == preflight_spatial_directory[33u]
    && preflight_spatial_aggregate_view[35u] == 64u
    && preflight_spatial_aggregate_view[36u] == 44u
    && preflight_spatial_aggregate_view[37u] == 3u
    && preflight_spatial_aggregate_view[38u] == directory_capacity
    && preflight_spatial_aggregate_view[39u] == directory_high_water
    && preflight_spatial_aggregate_view[40u] == replay_token
    && preflight_spatial_aggregate_view[41u]
      == thermal_prepass_active_rank_header_fingerprint(
        replay_token,
        active_count,
        dormant_count,
        prefix_offset,
        prefix_capacity,
        active_ranks_offset,
        source_capacity,
        active_source_indices_offset,
        source_capacity
      )
    && preflight_spatial_aggregate_view[42u]
      == THERMAL_PREFLIGHT_ACTIVE_RANK_MAX_SOURCE_COUNT
    && preflight_spatial_aggregate_view[43u]
      == THERMAL_PREFLIGHT_ACTIVE_RANK_RANKS_PER_LANE
    && preflight_spatial_aggregate_view[44u] == dispatch_x
    && preflight_spatial_aggregate_view[45u] == 1u
    && preflight_spatial_aggregate_view[46u] == 1u
    && preflight_spatial_aggregate_view[47u]
      == THERMAL_PREFLIGHT_ACTIVE_RANK_HEADER_WORDS
    && preflight_spatial_aggregate_view[48u] == physical_capacity
    && preflight_spatial_aggregate_view[49u] == active_source_indices_offset
    && preflight_spatial_aggregate_view[50u] == source_capacity
    && preflight_spatial_aggregate_view[prefix_offset] == 0u
    && preflight_spatial_aggregate_view[prefix_offset + source_count]
      == active_count;
}

fn thermal_prepass_active_rank_membership_matches(
  source_rank: u32,
  source_index: u32,
  currently_active: bool
) -> bool {
  let source_count = thermal_params.particle_count;
  let source_capacity = preflight_spatial_directory[17u];
  if (source_capacity > THERMAL_PREFLIGHT_ACTIVE_RANK_MAX_SOURCE_COUNT) {
    return false;
  }
  // Use the canonical layout, rather than untrusted header offsets, before
  // the lane-zero header admission is visible to every workgroup.
  let prefix_offset = THERMAL_PREFLIGHT_ACTIVE_RANK_HEADER_WORDS;
  let active_ranks_offset = prefix_offset + source_capacity + 1u;
  let active_source_indices_offset = active_ranks_offset + source_capacity;
  let physical_capacity = active_source_indices_offset + source_capacity;
  let directory_member_offset = preflight_spatial_directory[31u];
  if (
    source_rank >= source_count
    || source_index >= source_count
    || physical_capacity > arrayLength(&preflight_spatial_aggregate_view)
    || directory_member_offset + source_rank >= arrayLength(&preflight_spatial_directory)
    || preflight_spatial_directory[directory_member_offset + source_rank]
      != source_index
    || prefix_offset + source_rank + 1u
      >= arrayLength(&preflight_spatial_aggregate_view)
  ) { return false; }
  let prefix = preflight_spatial_aggregate_view[prefix_offset + source_rank];
  let next_prefix = preflight_spatial_aggregate_view[
    prefix_offset + source_rank + 1u
  ];
  let expected_delta = select(0u, 1u, currently_active);
  if (
    prefix > next_prefix
    || next_prefix - prefix != expected_delta
    || next_prefix > preflight_spatial_aggregate_view[26u]
  ) { return false; }
  if (!currently_active) { return true; }
  return active_ranks_offset + prefix < arrayLength(&preflight_spatial_aggregate_view)
    && active_source_indices_offset + prefix
      < arrayLength(&preflight_spatial_aggregate_view)
    && preflight_spatial_aggregate_view[active_ranks_offset + prefix]
      == source_rank
    && preflight_spatial_aggregate_view[active_source_indices_offset + prefix]
      == source_index;
}

fn thermal_prepass_active_member_projection_admitted() -> bool {
  if (
    thermal_params.active_member_projection_enabled
      == THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_NONE
    || thermal_params.active_member_projection_enabled
      == THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_LOCAL
  ) { return true; }
  if (
    thermal_params.active_member_projection_enabled
      == THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_ACTIVE_RANK
  ) {
    return thermal_prepass_active_rank_view_admitted();
  }
  if (
    thermal_params.active_member_projection_enabled
      != THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_AGGREGATE
  ) { return false; }
  let directory_bound_words = arrayLength(&preflight_spatial_directory);
  let bound_words = arrayLength(&preflight_spatial_aggregate_view);
  if (
    directory_bound_words < 48u
    || bound_words < THERMAL_PREFLIGHT_AGGREGATE_HEADER_WORDS
  ) { return false; }
  let source_count = preflight_spatial_directory[16u];
  let source_capacity = preflight_spatial_directory[17u];
  let cell_count = preflight_spatial_directory[18u];
  let cell_capacity = preflight_spatial_directory[19u];
  let core_capacity_words = preflight_spatial_aggregate_view[31u];
  if (
    source_count == 0u
    || source_count != thermal_params.particle_count
    || source_count > source_capacity
    || cell_count == 0u
    || cell_count > 0x03ffffffu
    || cell_count > cell_capacity
    || core_capacity_words < THERMAL_PREFLIGHT_AGGREGATE_HEADER_WORDS
    || core_capacity_words > bound_words
    || source_capacity > bound_words - core_capacity_words
  ) { return false; }
  let total_record_count = preflight_spatial_aggregate_view[54u];
  let root_record_index = preflight_spatial_aggregate_view[53u];
  let record_capacity = (
    core_capacity_words - THERMAL_PREFLIGHT_AGGREGATE_HEADER_WORDS
  ) / THERMAL_PREFLIGHT_AGGREGATE_RECORD_WORDS;
  if (
    total_record_count == 0u
    || total_record_count > record_capacity
    || root_record_index >= total_record_count
  ) { return false; }
  let root_base = THERMAL_PREFLIGHT_AGGREGATE_HEADER_WORDS
    + root_record_index * THERMAL_PREFLIGHT_AGGREGATE_RECORD_WORDS;
  let active_member_count = preflight_spatial_aggregate_view[96u];
  let source_layout = preflight_spatial_aggregate_view[43u];
  let expected_internal_count = cell_count - 1u;
  let expected_total_record_count = cell_count * 2u - 1u;
  let required_words = THERMAL_PREFLIGHT_AGGREGATE_HEADER_WORDS
    + expected_total_record_count * THERMAL_PREFLIGHT_AGGREGATE_RECORD_WORDS;
  let replay_token = thermal_prepass_replay_guard_token(cell_count);
  return preflight_spatial_aggregate_view[0u]
      == THERMAL_PREFLIGHT_AGGREGATE_MAGIC
    && preflight_spatial_aggregate_view[1u]
      == THERMAL_PREFLIGHT_AGGREGATE_VERSION
    && preflight_spatial_aggregate_view[2u]
      == THERMAL_PREFLIGHT_AGGREGATE_STATUS_EXACT
    && preflight_spatial_aggregate_view[3u]
      == preflight_spatial_directory[3u]
    && preflight_spatial_aggregate_view[4u]
      == preflight_spatial_directory[4u]
    && preflight_spatial_aggregate_view[5u]
      == preflight_spatial_directory[5u]
    && preflight_spatial_aggregate_view[6u]
      == preflight_spatial_directory[6u]
    && preflight_spatial_aggregate_view[7u]
      == preflight_spatial_directory[7u]
    && preflight_spatial_aggregate_view[8u]
      == preflight_spatial_directory[8u]
    && preflight_spatial_aggregate_view[9u]
      == preflight_spatial_directory[9u]
    && preflight_spatial_aggregate_view[10u]
      == preflight_spatial_directory[10u]
    && preflight_spatial_aggregate_view[11u]
      == preflight_spatial_directory[11u]
    && preflight_spatial_aggregate_view[12u]
      == preflight_spatial_directory[12u]
    && preflight_spatial_aggregate_view[13u]
      == preflight_spatial_directory[13u]
    && preflight_spatial_aggregate_view[14u]
      == preflight_spatial_directory[14u]
    && preflight_spatial_aggregate_view[15u]
      == preflight_spatial_directory[15u]
    && preflight_spatial_aggregate_view[16u] == source_count
    && preflight_spatial_aggregate_view[17u] == source_capacity
    && preflight_spatial_aggregate_view[18u] == cell_count
    && preflight_spatial_aggregate_view[19u] == cell_capacity
    && preflight_spatial_aggregate_view[20u]
      == THERMAL_PREFLIGHT_AGGREGATE_RECORD_WORDS
    && preflight_spatial_aggregate_view[21u]
      == THERMAL_PREFLIGHT_AGGREGATE_HEADER_WORDS
    && preflight_spatial_aggregate_view[23u] == cell_count
    && preflight_spatial_aggregate_view[24u] == 2u
    && preflight_spatial_aggregate_view[27u] == expected_internal_count
    && preflight_spatial_aggregate_view[29u] == expected_total_record_count
    && preflight_spatial_aggregate_view[30u] == required_words
    && preflight_spatial_aggregate_view[30u] <= core_capacity_words
    && preflight_spatial_aggregate_view[32u] == 0u
    && preflight_spatial_aggregate_view[33u] == 0u
    && preflight_spatial_aggregate_view[34u] == 0u
    && preflight_spatial_aggregate_view[35u] == 0u
    && preflight_spatial_aggregate_view[36u] == source_count
    && preflight_spatial_aggregate_view[37u] == source_count
    && preflight_spatial_aggregate_view[38u] == cell_count
    && preflight_spatial_aggregate_view[39u] == expected_internal_count
    && preflight_spatial_aggregate_view[40u]
      == preflight_spatial_directory[35u]
    && (source_layout == 1u || source_layout == 2u)
    && preflight_spatial_aggregate_view[57u]
      == THERMAL_PREFLIGHT_AGGREGATE_STATUS_EXACT
    && preflight_spatial_aggregate_view[51u] == 2u
    && preflight_spatial_aggregate_view[52u] == 160u
    && preflight_spatial_aggregate_view[54u]
      == expected_total_record_count
    && preflight_spatial_aggregate_view[55u] == expected_internal_count
    && preflight_spatial_aggregate_view[56u] != 0u
    && preflight_spatial_aggregate_view[58u] == cell_count
    && preflight_spatial_aggregate_view[59u] == 0u
    && preflight_spatial_aggregate_view[62u] != 0u
    && preflight_spatial_aggregate_view[62u] == replay_token
    && preflight_spatial_aggregate_view[63u]
      == thermal_prepass_header_fingerprint(
        replay_token,
        total_record_count,
        root_record_index
      )
    && preflight_spatial_aggregate_view[80u] == root_record_index
    && preflight_spatial_aggregate_view[81u] == 0xffffffffu
    && preflight_spatial_aggregate_view[84u] == 2u
    && preflight_spatial_aggregate_view[85u] == total_record_count
    && preflight_spatial_aggregate_view[86u]
      == preflight_spatial_directory[46u]
    && preflight_spatial_aggregate_view[87u]
      == preflight_spatial_directory[29u]
    && preflight_spatial_aggregate_view[88u]
      == preflight_spatial_directory[30u]
    && preflight_spatial_aggregate_view[89u]
      == preflight_spatial_directory[31u]
    && preflight_spatial_aggregate_view[90u]
      == preflight_spatial_directory[32u]
    && preflight_spatial_aggregate_view[root_base + 19u]
      == active_member_count
    && preflight_spatial_aggregate_view[root_base + 43u] == source_count
    && preflight_spatial_aggregate_view[root_base + 36u] == 0xffffffffu
    && preflight_spatial_aggregate_view[root_base + 37u] == 0xffffffffu
    && preflight_spatial_aggregate_view[root_base + 38u] == 0u
    && preflight_spatial_aggregate_view[root_base + 39u] == cell_count
    && active_member_count <= source_count
    && preflight_spatial_aggregate_view[91u]
      == THERMAL_PREFLIGHT_ACTIVE_MEMBER_MAGIC
    && preflight_spatial_aggregate_view[92u]
      == THERMAL_PREFLIGHT_ACTIVE_MEMBER_VERSION
    && preflight_spatial_aggregate_view[93u]
      == THERMAL_PREFLIGHT_ACTIVE_MEMBER_STATUS_EXACT
    && preflight_spatial_aggregate_view[94u] == core_capacity_words
    && preflight_spatial_aggregate_view[95u] == source_capacity
    && preflight_spatial_aggregate_view[97u] == source_count
    && preflight_spatial_aggregate_view[98u] == cell_count
    && preflight_spatial_aggregate_view[99u]
      == preflight_spatial_directory[3u]
    && preflight_spatial_aggregate_view[100u]
      == preflight_spatial_directory[35u]
    && preflight_spatial_aggregate_view[101u]
      == preflight_spatial_aggregate_view[62u]
    && preflight_spatial_aggregate_view[102u]
      == preflight_spatial_directory[46u]
    && preflight_spatial_aggregate_view[103u]
      == preflight_spatial_directory[31u]
    && preflight_spatial_aggregate_view[104u] == cell_count
    && preflight_spatial_aggregate_view[105u] == 0u
    && preflight_spatial_aggregate_view[106u] == 1u
    && preflight_spatial_aggregate_view[107u]
      == core_capacity_words + source_capacity
    && preflight_spatial_aggregate_view[108u] == source_layout
    && preflight_spatial_aggregate_view[109u]
      == preflight_spatial_directory[8u]
    && preflight_spatial_aggregate_view[110u]
      == thermal_prepass_projection_fingerprint(active_member_count);
}

fn thermal_prepass_response_row0(response_index: u32) -> vec4<f32> {
  return phase_responses[response_index * 4u];
}

fn thermal_prepass_response_row1(response_index: u32) -> vec4<f32> {
  return phase_responses[response_index * 4u + 1u];
}

fn thermal_prepass_graph_node_row1(graph_index: u32) -> vec4<f32> {
  return thermal_graph_nodes[graph_index * 4u + 1u];
}

fn thermal_prepass_temperature_slope_from_graph(
  graph_index: u32,
  specific_internal_energy: f32
) -> f32 {
  let node1 = thermal_prepass_graph_node_row1(graph_index);
  let sample_offset = u32(max(node1.x, 0.0));
  let sample_count = u32(max(node1.y, 0.0));
  if (
    sample_count < 2u
    || sample_offset > arrayLength(&thermal_graph_samples)
    || sample_count > arrayLength(&thermal_graph_samples) - sample_offset
  ) { return -1.0; }
  let x = clamp(specific_internal_energy, node1.z, node1.w);
  var left_index = sample_offset;
  var right_index = sample_offset + sample_count - 1u;
  for (
    var index = sample_offset;
    index + 1u < sample_offset + sample_count;
    index = index + 1u
  ) {
    let left_axis = thermal_graph_samples[index].x;
    let right_axis = thermal_graph_samples[index + 1u].x;
    if (x >= left_axis && x <= right_axis) {
      left_index = index;
      right_index = index + 1u;
      break;
    }
  }
  let left = thermal_graph_samples[left_index];
  let right = thermal_graph_samples[right_index];
  if (right.x == left.x) { return 0.0; }
  return (right.y - left.y) / (right.x - left.x);
}

fn thermal_prepass_temperature_from_graph(
  graph_index: u32,
  specific_internal_energy: f32
) -> f32 {
  let node1 = thermal_prepass_graph_node_row1(graph_index);
  let sample_offset = u32(max(node1.x, 0.0));
  let sample_count = u32(max(node1.y, 0.0));
  if (
    sample_count < 2u
    || sample_offset > arrayLength(&thermal_graph_samples)
    || sample_count > arrayLength(&thermal_graph_samples) - sample_offset
  ) { return -1.0; }
  let x = clamp(specific_internal_energy, node1.z, node1.w);
  var left_index = sample_offset;
  var right_index = sample_offset + sample_count - 1u;
  for (
    var index = sample_offset;
    index + 1u < sample_offset + sample_count;
    index = index + 1u
  ) {
    let left_axis = thermal_graph_samples[index].x;
    let right_axis = thermal_graph_samples[index + 1u].x;
    if (x >= left_axis && x <= right_axis) {
      left_index = index;
      right_index = index + 1u;
      break;
    }
  }
  let left = thermal_graph_samples[left_index];
  let right = thermal_graph_samples[right_index];
  if (right.x == left.x) { return left.y; }
  let alpha = clamp((x - left.x) / (right.x - left.x), 0.0, 1.0);
  return left.y + alpha * (right.y - left.y);
}

struct ThermalCarrierSelection {
  response_index: u32,
  ready: u32,
  energy_lo: f32,
  energy_hi: f32,
};

struct ThermalEnergyInverse {
  energy: f32,
  ready: u32,
};

struct ThermalReachableEnergyDomain {
  energy_lo: f32,
  energy_hi: f32,
  ready: u32,
  segment_count: u32,
};

fn thermal_prepass_carrier_phase_classification(
  phase_id: f32,
  phase_fractions: vec4<f32>
) -> vec2<u32> {
  let epsilon = 1.0e-6;
  let fraction_sum = phase_fractions.x + phase_fractions.y
    + phase_fractions.z + phase_fractions.w;
  let valid = all(phase_fractions >= vec4<f32>(0.0))
    && all(phase_fractions <= vec4<f32>(1.0 + epsilon))
    && abs(fraction_sum - 1.0) <= epsilon;
  var positive_count = 0u;
  if (phase_fractions.x > 0.0) { positive_count = positive_count + 1u; }
  if (phase_fractions.y > 0.0) { positive_count = positive_count + 1u; }
  if (phase_fractions.z > 0.0) { positive_count = positive_count + 1u; }
  if (phase_fractions.w > 0.0) { positive_count = positive_count + 1u; }
  let carrier_phase = u32(clamp(round(phase_id), 0.0, 4.0));
  var pure_phase = 0u;
  if (valid && positive_count == 1u) {
    if (carrier_phase == 1u && abs(phase_fractions.x - 1.0) <= epsilon) {
      pure_phase = 1u;
    } else if (carrier_phase == 2u && abs(phase_fractions.y - 1.0) <= epsilon) {
      pure_phase = 2u;
    } else if (carrier_phase == 3u && abs(phase_fractions.z - 1.0) <= epsilon) {
      pure_phase = 3u;
    } else if (carrier_phase == 4u && abs(phase_fractions.w - 1.0) <= epsilon) {
      pure_phase = 4u;
    }
  }
  return vec2<u32>(pure_phase, select(0u, 1u, valid && positive_count >= 2u));
}

fn thermal_prepass_carrier_selection(
  material_id: f32,
  specific_internal_energy: f32,
  phase_id: f32,
  phase_fractions: vec4<f32>
) -> ThermalCarrierSelection {
  var rejected = ThermalCarrierSelection(0u, 0u, 0.0, 0.0);
  var response_offset = 0u;
  var response_count = 0u;
  var found_material = false;
  for (
    var record_index = 0u;
    record_index < thermal_params.material_count;
    record_index = record_index + 1u
  ) {
    let record = phase_response_records[record_index * 2u];
    if (record.x == material_id) {
      response_offset = u32(max(record.y, 0.0));
      response_count = u32(max(record.z, 0.0));
      found_material = record.w == 1.0;
      break;
    }
  }
  if (!found_material || response_count == 0u) { return rejected; }
  let classification = thermal_prepass_carrier_phase_classification(
    phase_id,
    phase_fractions
  );
  var containing = 0xffffffffu;
  var mixed_plateau = 0xffffffffu;
  var pure_phase_response = 0xffffffffu;
  var domain_lo = 3.402823e38;
  var domain_hi = -3.402823e38;
  for (var local = 0u; local < response_count; local = local + 1u) {
    let candidate = response_offset + local;
    if (candidate >= thermal_params.response_count) { return rejected; }
    let row0 = thermal_prepass_response_row0(candidate);
    let row1 = thermal_prepass_response_row1(candidate);
    if (
      row0.w != 1.0
      || row0.z < 0.0
      || !thermal_prepass_finite(row1.x)
      || !thermal_prepass_finite(row1.y)
      || row1.y < row1.x
    ) {
      return rejected;
    }
    if (specific_internal_energy >= row1.x && specific_internal_energy <= row1.y) {
      if (containing == 0xffffffffu) { containing = candidate; }
      domain_lo = min(domain_lo, row1.x);
      domain_hi = max(domain_hi, row1.y);
      let phase_from = u32(clamp(round(row1.z), 0.0, 4.0));
      let phase_to = u32(clamp(round(row1.w), 0.0, 4.0));
      if (
        classification.x != 0u
        && phase_from == classification.x
        && phase_to == classification.x
      ) {
        pure_phase_response = candidate;
      }
      if (classification.y == 1u && abs(row0.y - 2.0) < 0.5) {
        mixed_plateau = candidate;
      }
    }
  }
  if (containing == 0xffffffffu) { return rejected; }
  var selected = containing;
  if (mixed_plateau != 0xffffffffu) { selected = mixed_plateau; }
  if (pure_phase_response != 0xffffffffu) { selected = pure_phase_response; }
  return ThermalCarrierSelection(selected, 1u, domain_lo, domain_hi);
}

// Temperature and slope come from the selected current segment above. Pair
// exchange is allowed to traverse the entire material response only when its
// packed enthalpy curve is contiguous, continuous, and monotone. This keeps a
// zero-slope latent segment from becoming an artificial transport boundary.
fn thermal_prepass_reachable_energy_domain(
  material_id: f32,
  specific_internal_energy: f32
) -> ThermalReachableEnergyDomain {
  var rejected = ThermalReachableEnergyDomain(
    specific_internal_energy,
    specific_internal_energy,
    0u,
    0u
  );
  if (!thermal_prepass_finite(specific_internal_energy)) { return rejected; }
  var response_offset = 0u;
  var response_count = 0u;
  var found_material = false;
  for (
    var record_index = 0u;
    record_index < thermal_params.material_count;
    record_index = record_index + 1u
  ) {
    let record = phase_response_records[record_index * 2u];
    if (record.x == material_id) {
      if (
        record.w != 1.0
        || record.y < 0.0
        || record.z <= 0.0
        || floor(record.y) != record.y
        || floor(record.z) != record.z
      ) { return rejected; }
      response_offset = u32(record.y);
      response_count = u32(record.z);
      found_material = true;
      break;
    }
  }
  if (!found_material || response_count == 0u) { return rejected; }

  var domain_lo = 0.0;
  var domain_hi = 0.0;
  var previous_energy_hi = 0.0;
  var previous_temperature_hi = 0.0;
  var containing_count = 0u;
  for (var local = 0u; local < response_count; local = local + 1u) {
    let response_index = response_offset + local;
    if (response_index >= thermal_params.response_count) { return rejected; }
    let row0 = thermal_prepass_response_row0(response_index);
    let row1 = thermal_prepass_response_row1(response_index);
    if (
      row0.x != material_id
      || row0.w != 1.0
      || row0.z < 0.0
      || floor(row0.z) != row0.z
      || !thermal_prepass_finite(row1.x)
      || !thermal_prepass_finite(row1.y)
      || row1.y < row1.x
    ) { return rejected; }
    let graph_index = u32(row0.z);
    let graph_node_count = arrayLength(&thermal_graph_nodes);
    if (
      graph_node_count < 2u
      || graph_index > (graph_node_count - 2u) / 4u
    ) { return rejected; }
    let node1 = thermal_prepass_graph_node_row1(graph_index);
    let sample_offset = u32(max(node1.x, 0.0));
    let sample_count = u32(max(node1.y, 0.0));
    if (
      node1.x < 0.0
      || node1.y < 2.0
      || floor(node1.x) != node1.x
      || floor(node1.y) != node1.y
      || node1.z != row1.x
      || node1.w != row1.y
      || sample_offset > arrayLength(&thermal_graph_samples)
      || sample_count > arrayLength(&thermal_graph_samples) - sample_offset
    ) { return rejected; }
    let first = thermal_graph_samples[sample_offset];
    let last = thermal_graph_samples[sample_offset + sample_count - 1u];
    if (
      !thermal_prepass_finite(first.x)
      || !thermal_prepass_finite(first.y)
      || !thermal_prepass_finite(last.x)
      || !thermal_prepass_finite(last.y)
      || first.x != row1.x
      || last.x != row1.y
    ) { return rejected; }
    for (
      var sample_local = 0u;
      sample_local + 1u < sample_count;
      sample_local = sample_local + 1u
    ) {
      let left = thermal_graph_samples[sample_offset + sample_local];
      let right = thermal_graph_samples[sample_offset + sample_local + 1u];
      if (
        !thermal_prepass_finite(left.x)
        || !thermal_prepass_finite(left.y)
        || !thermal_prepass_finite(right.x)
        || !thermal_prepass_finite(right.y)
        || right.x < left.x
        || right.y < left.y
      ) { return rejected; }
    }
    if (local == 0u) {
      domain_lo = row1.x;
    } else if (
      row1.x != previous_energy_hi
      || first.y != previous_temperature_hi
    ) {
      return rejected;
    }
    domain_hi = row1.y;
    previous_energy_hi = row1.y;
    previous_temperature_hi = last.y;
    if (
      specific_internal_energy >= row1.x
      && specific_internal_energy <= row1.y
    ) {
      containing_count = containing_count + 1u;
    }
  }
  if (containing_count == 0u || domain_hi < domain_lo) { return rejected; }
  return ThermalReachableEnergyDomain(domain_lo, domain_hi, 1u, response_count);
}

fn thermal_prepass_energy_inverse_for_temperature(
  material_id: f32,
  target_temperature_k: f32,
  upper_inverse: bool
) -> ThermalEnergyInverse {
  var rejected = ThermalEnergyInverse(0.0, 0u);
  if (!thermal_prepass_finite(target_temperature_k)) { return rejected; }
  var response_offset = 0u;
  var response_count = 0u;
  var found_material = false;
  for (
    var record_index = 0u;
    record_index < thermal_params.material_count;
    record_index = record_index + 1u
  ) {
    let record = phase_response_records[record_index * 2u];
    if (record.x == material_id) {
      response_offset = u32(max(record.y, 0.0));
      response_count = u32(max(record.z, 0.0));
      found_material = record.w == 1.0;
      break;
    }
  }
  if (!found_material || response_count == 0u) { return rejected; }
  var domain_lo = 3.402823e38;
  var domain_hi = -3.402823e38;
  var temperature_lo = 3.402823e38;
  var temperature_hi = -3.402823e38;
  var lower_energy = 3.402823e38;
  var upper_energy = -3.402823e38;
  var lower_found = false;
  var upper_found = false;
  for (var local = 0u; local < response_count; local = local + 1u) {
    let response_index = response_offset + local;
    if (response_index >= thermal_params.response_count) { return rejected; }
    let row0 = thermal_prepass_response_row0(response_index);
    let row1 = thermal_prepass_response_row1(response_index);
    if (
      row0.w != 1.0
      || row0.z < 0.0
      || !thermal_prepass_finite(row1.x)
      || !thermal_prepass_finite(row1.y)
      || row1.y < row1.x
    ) { return rejected; }
    domain_lo = min(domain_lo, row1.x);
    domain_hi = max(domain_hi, row1.y);
    let node1 = thermal_prepass_graph_node_row1(u32(row0.z));
    let sample_offset = u32(max(node1.x, 0.0));
    let sample_count = u32(max(node1.y, 0.0));
    if (
      sample_count < 2u
      || sample_offset > arrayLength(&thermal_graph_samples)
      || sample_count > arrayLength(&thermal_graph_samples) - sample_offset
    ) { return rejected; }
    for (
      var sample_local = 0u;
      sample_local + 1u < sample_count;
      sample_local = sample_local + 1u
    ) {
      let left = thermal_graph_samples[sample_offset + sample_local];
      let right = thermal_graph_samples[sample_offset + sample_local + 1u];
      if (
        !thermal_prepass_finite(left.x)
        || !thermal_prepass_finite(left.y)
        || !thermal_prepass_finite(right.x)
        || !thermal_prepass_finite(right.y)
        || right.x < left.x
        || right.y < left.y
      ) { return rejected; }
      temperature_lo = min(temperature_lo, left.y);
      temperature_hi = max(temperature_hi, right.y);
      if (target_temperature_k <= left.y) {
        lower_energy = min(lower_energy, left.x);
        lower_found = true;
      } else if (target_temperature_k <= right.y) {
        var candidate = left.x;
        if (right.y > left.y) {
          candidate = left.x + (target_temperature_k - left.y)
            * (right.x - left.x) / (right.y - left.y);
        }
        lower_energy = min(lower_energy, candidate);
        lower_found = true;
      }
      if (target_temperature_k >= right.y) {
        upper_energy = max(upper_energy, right.x);
        upper_found = true;
      } else if (target_temperature_k >= left.y) {
        var candidate = right.x;
        if (right.y > left.y) {
          candidate = left.x + (target_temperature_k - left.y)
            * (right.x - left.x) / (right.y - left.y);
        }
        upper_energy = max(upper_energy, candidate);
        upper_found = true;
      }
    }
  }
  if (
    !thermal_prepass_finite(domain_lo)
    || !thermal_prepass_finite(domain_hi)
    || domain_hi < domain_lo
    || !thermal_prepass_finite(temperature_lo)
    || !thermal_prepass_finite(temperature_hi)
  ) { return rejected; }
  if (target_temperature_k <= temperature_lo) {
    lower_energy = domain_lo;
    upper_energy = domain_lo;
    lower_found = true;
    upper_found = true;
  } else if (target_temperature_k >= temperature_hi) {
    lower_energy = domain_hi;
    upper_energy = domain_hi;
    lower_found = true;
    upper_found = true;
  }
  let energy = select(lower_energy, upper_energy, upper_inverse);
  let ready = select(lower_found, upper_found, upper_inverse);
  if (!ready || !thermal_prepass_finite(energy)) { return rejected; }
  return ThermalEnergyInverse(clamp(energy, domain_lo, domain_hi), 1u);
}

fn thermal_prepass_emissivity(material_id: f32) -> f32 {
  for (
    var record_index = 0u;
    record_index < thermal_params.material_count;
    record_index = record_index + 1u
  ) {
    let record = phase_response_records[record_index * 2u];
    if (record.x == material_id) {
      return clamp(phase_response_records[record_index * 2u + 1u].x, 0.0, 1.0);
    }
  }
  return 0.0;
}

fn thermal_prepass_nominal_radius_m(mass_kg: f32, rest_density_kg_per_m3: f32) -> f32 {
  if (mass_kg <= 0.0 || rest_density_kg_per_m3 <= 0.0) { return 0.0; }
  return pow(0.238732414637843 * mass_kg / rest_density_kg_per_m3, 1.0 / 3.0);
}

@compute @workgroup_size(64)
fn derive(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let source_rank = global_id.x;
  if (source_rank >= thermal_params.particle_count) { return; }
  if (source_rank == 0u) {
    let projection_admitted = thermal_prepass_active_member_projection_admitted();
    atomicStore(
      &thermal_derived[THERMAL_PREFLIGHT_ACTIVE_MEMBER_ADMISSION_WORD],
      select(
        THERMAL_PREFLIGHT_ACTIVE_MEMBER_REJECTED,
        THERMAL_PREFLIGHT_ACTIVE_MEMBER_ADMITTED,
        projection_admitted
      )
    );
    var dispatch_source_count = thermal_params.particle_count;
    if (
      thermal_params.active_member_projection_enabled
        == THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_AGGREGATE
      && projection_admitted
    ) {
      dispatch_source_count = preflight_spatial_aggregate_view[96u];
    } else if (
      thermal_params.active_member_projection_enabled
        == THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_ACTIVE_RANK
      && projection_admitted
    ) {
      dispatch_source_count = preflight_spatial_aggregate_view[26u];
    } else if (
      thermal_params.active_member_projection_enabled
        == THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_LOCAL
    ) {
      dispatch_source_count = 0u;
    }
    atomicStore(
      &thermal_derived[THERMAL_PREFLIGHT_EXPECTED_ACTIVE_MEMBER_COUNT_WORD],
      dispatch_source_count
    );
    let dispatch_workgroups = max(
      1u,
      dispatch_source_count / 64u
        + select(0u, 1u, dispatch_source_count % 64u != 0u)
    );
    atomicStore(&thermal_active_dispatch[0u], dispatch_workgroups);
    atomicStore(&thermal_active_dispatch[1u], 1u);
    atomicStore(&thermal_active_dispatch[2u], 1u);
  }
  var local_sidecar_word = 0u;
  if (
    thermal_params.active_member_projection_enabled
      == THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_LOCAL
  ) {
    local_sidecar_word = ${SCHROEDER_SPATIAL_THERMAL_DERIVED_HEADER_WORDS}u
      + thermal_params.particle_count
        * ${SCHROEDER_SPATIAL_THERMAL_DERIVED_ROW_WORDS}u
      + source_rank;
    if (local_sidecar_word >= arrayLength(&thermal_derived)) {
      atomicAdd(&thermal_derived[1u], 1u);
      return;
    }
    atomicStore(&thermal_derived[local_sidecar_word], 0xffffffffu);
  }
  let source_lookup = thermal_prepass_source_at_rank(source_rank);
  if (source_lookup.admitted == 0u) {
    atomicAdd(&thermal_derived[1u], 1u);
    return;
  }
  let particle_index = source_lookup.source_index;
  let row_offset = ${SCHROEDER_SPATIAL_THERMAL_DERIVED_HEADER_WORDS}u
    + particle_index * ${SCHROEDER_SPATIAL_THERMAL_DERIVED_ROW_WORDS}u;
  let pos_mass = source_state[particle_index * 2u];
  let directory_pos_mass = directory_position_state[particle_index * 2u];
  let current_active = pos_mass.w > 0.0;
  let directory_active = directory_pos_mass.w > 0.0;
  let position_family_valid = all(pos_mass.xyz == pos_mass.xyz)
    && all(abs(pos_mass.xyz) <= vec3<f32>(3.402823e38))
    && all(directory_pos_mass.xyz == directory_pos_mass.xyz)
    && all(abs(directory_pos_mass.xyz) <= vec3<f32>(3.402823e38))
    && thermal_prepass_finite(pos_mass.w)
    && thermal_prepass_finite(directory_pos_mass.w)
    && current_active == directory_active
    && pos_mass.w == directory_pos_mass.w;
  if (!position_family_valid) {
    atomicAdd(&thermal_derived[1u], 1u);
    for (var component = 0u; component < ${SCHROEDER_SPATIAL_THERMAL_DERIVED_ROW_WORDS}u; component = component + 1u) {
      atomicStore(&thermal_derived[row_offset + component], 0u);
    }
    return;
  }
  if (
    thermal_params.active_member_projection_enabled
      == THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_ACTIVE_RANK
    && !thermal_prepass_active_rank_membership_matches(
      source_rank,
      particle_index,
      current_active
    )
  ) {
    atomicAdd(&thermal_derived[1u], 1u);
    for (var component = 0u; component < ${SCHROEDER_SPATIAL_THERMAL_DERIVED_ROW_WORDS}u; component = component + 1u) {
      atomicStore(&thermal_derived[row_offset + component], 0u);
    }
    return;
  }
  if (!current_active) {
    for (var component = 0u; component < ${SCHROEDER_SPATIAL_THERMAL_DERIVED_ROW_WORDS}u; component = component + 1u) {
      atomicStore(&thermal_derived[row_offset + component], 0u);
    }
    return;
  }
  atomicAdd(
    &thermal_derived[THERMAL_PREFLIGHT_CURRENT_ACTIVE_SOURCE_COUNT_WORD],
    1u
  );
  if (
    thermal_params.active_member_projection_enabled
      == THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_LOCAL
    || thermal_params.active_member_projection_enabled
      == THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_ACTIVE_RANK
  ) {
    atomicAdd(
      &thermal_derived[THERMAL_PREFLIGHT_ACTIVE_SOURCE_RANK_COUNT_WORD],
      1u
    );
  }
  if (
    thermal_params.active_member_projection_enabled
      == THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_LOCAL
  ) {
    atomicStore(&thermal_derived[local_sidecar_word], source_rank);
  }
  let displacement_m = length(pos_mass.xyz - directory_pos_mass.xyz);
  if (!thermal_prepass_finite(displacement_m)) {
    atomicAdd(&thermal_derived[1u], 1u);
  } else {
    atomicMax(&thermal_derived[4u], bitcast<u32>(displacement_m));
  }
  let vel_u = source_state[particle_index * 2u + 1u];
  let thermo0 = source_thermo[particle_index * 3u];
  let thermo1 = source_thermo[particle_index * 3u + 1u];
  let selection = thermal_prepass_carrier_selection(
    thermo0.x,
    vel_u.w,
    thermo0.y,
    thermo1
  );
  var temperature_k = -1.0;
  var temperature_slope = -1.0;
  if (selection.ready == 1u) {
    let response0 = thermal_prepass_response_row0(selection.response_index);
    temperature_k = thermal_prepass_temperature_from_graph(
      u32(response0.z),
      vel_u.w
    );
    temperature_slope = thermal_prepass_temperature_slope_from_graph(
      u32(response0.z),
      vel_u.w
    );
  }
  var radius_m = thermal_prepass_nominal_radius_m(pos_mass.w, thermo0.w);
  var emissivity = thermal_prepass_emissivity(thermo0.x);
  if (
    selection.ready != 1u
    || !thermal_prepass_finite(vel_u.w)
    || !thermal_prepass_finite(temperature_k)
    || temperature_k < 0.0
    || !thermal_prepass_finite(temperature_slope)
    || temperature_slope < 0.0
    || !thermal_prepass_finite(radius_m)
    || !thermal_prepass_finite(emissivity)
  ) {
    atomicAdd(&thermal_derived[1u], 1u);
    temperature_k = 0.0;
    temperature_slope = 0.0;
    radius_m = 0.0;
    emissivity = 0.0;
  }
  atomicStore(&thermal_derived[row_offset], bitcast<u32>(temperature_k));
  atomicStore(&thermal_derived[row_offset + 1u], bitcast<u32>(temperature_slope));
  atomicStore(&thermal_derived[row_offset + 2u], bitcast<u32>(radius_m));
  atomicStore(&thermal_derived[row_offset + 3u], bitcast<u32>(emissivity));
  atomicStore(&thermal_derived[row_offset + 4u], 0u);
  atomicStore(&thermal_derived[row_offset + 5u], 0u);
  atomicStore(&thermal_derived[row_offset + 6u], bitcast<u32>(temperature_k));
  atomicStore(&thermal_derived[row_offset + 7u], bitcast<u32>(temperature_k));
  if (radius_m > 0.0) {
    atomicMax(&thermal_derived[0u], bitcast<u32>(radius_m));
  }
  if (thermal_prepass_finite(temperature_k) && temperature_k >= 0.0) {
    let temperature_bits = bitcast<u32>(temperature_k);
    atomicMax(&thermal_derived[2u], temperature_bits);
    atomicMax(&thermal_derived[3u], ~temperature_bits);
  }
}

@compute @workgroup_size(1)
fn finalize_active_dispatch(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  if (
    global_id.x != 0u
    || thermal_params.active_member_projection_enabled
      != THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_LOCAL
  ) { return; }
  let current_active_count = atomicLoad(
    &thermal_derived[THERMAL_PREFLIGHT_CURRENT_ACTIVE_SOURCE_COUNT_WORD]
  );
  let materialized_active_count = atomicLoad(
    &thermal_derived[THERMAL_PREFLIGHT_ACTIVE_SOURCE_RANK_COUNT_WORD]
  );
  let admitted = atomicLoad(&thermal_derived[1u]) == 0u
    && current_active_count == materialized_active_count
    && current_active_count <= thermal_params.particle_count;
  let dispatch_source_count = select(0u, current_active_count, admitted);
  atomicStore(
    &thermal_derived[THERMAL_PREFLIGHT_ACTIVE_MEMBER_ADMISSION_WORD],
    select(
      THERMAL_PREFLIGHT_ACTIVE_MEMBER_REJECTED,
      THERMAL_PREFLIGHT_ACTIVE_MEMBER_ADMITTED,
      admitted
    )
  );
  atomicStore(
    &thermal_derived[THERMAL_PREFLIGHT_EXPECTED_ACTIVE_MEMBER_COUNT_WORD],
    dispatch_source_count
  );
  let dispatch_workgroups = max(
    1u,
    dispatch_source_count / 64u
      + select(0u, 1u, dispatch_source_count % 64u != 0u)
  );
  atomicStore(&thermal_active_dispatch[0u], dispatch_workgroups);
  atomicStore(&thermal_active_dispatch[1u], 1u);
  atomicStore(&thermal_active_dispatch[2u], 1u);
}

@compute @workgroup_size(64)
fn resolve_budget(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= thermal_params.particle_count) { return; }
  let row_offset = ${SCHROEDER_SPATIAL_THERMAL_DERIVED_HEADER_WORDS}u
    + particle_index * ${SCHROEDER_SPATIAL_THERMAL_DERIVED_ROW_WORDS}u;
  let pos_mass = source_state[particle_index * 2u];
  if (pos_mass.w <= 0.0) {
    atomicStore(&thermal_derived[row_offset + 4u], bitcast<u32>(1.0));
    atomicStore(&thermal_derived[row_offset + 5u], bitcast<u32>(1.0));
    return;
  }
  let vel_u = source_state[particle_index * 2u + 1u];
  let thermo0 = source_thermo[particle_index * 3u];
  let thermo1 = source_thermo[particle_index * 3u + 1u];
  let selection = thermal_prepass_carrier_selection(
    thermo0.x,
    vel_u.w,
    thermo0.y,
    thermo1
  );
  let reachable_domain = thermal_prepass_reachable_energy_domain(
    thermo0.x,
    vel_u.w
  );
  let neighbor_min_temperature = bitcast<f32>(
    atomicLoad(&thermal_derived[row_offset + 6u])
  );
  let neighbor_max_temperature = bitcast<f32>(
    atomicLoad(&thermal_derived[row_offset + 7u])
  );
  let lower_inverse = thermal_prepass_energy_inverse_for_temperature(
    thermo0.x,
    neighbor_min_temperature,
    false
  );
  let upper_inverse = thermal_prepass_energy_inverse_for_temperature(
    thermo0.x,
    neighbor_max_temperature,
    true
  );
  if (
    selection.ready != 1u
    || reachable_domain.ready != 1u
    || lower_inverse.ready != 1u
    || upper_inverse.ready != 1u
  ) {
    atomicAdd(&thermal_derived[1u], 1u);
    return;
  }
  var energy_lo = max(reachable_domain.energy_lo, lower_inverse.energy);
  var energy_hi = min(reachable_domain.energy_hi, upper_inverse.energy);
  let energy_scale = max(1.0, max(abs(vel_u.w), max(abs(energy_lo), abs(energy_hi))));
  let tolerance = 3.8146973e-6 * energy_scale;
  if (
    !thermal_prepass_finite(energy_lo)
    || !thermal_prepass_finite(energy_hi)
    || energy_hi < energy_lo
    || vel_u.w < energy_lo - tolerance
    || vel_u.w > energy_hi + tolerance
  ) {
    atomicAdd(&thermal_derived[1u], 1u);
    return;
  }
  energy_lo = min(vel_u.w, energy_lo);
  energy_hi = max(vel_u.w, energy_hi);
  let requested_gain_j = bitcast<f32>(
    atomicLoad(&thermal_derived[row_offset + 4u])
  );
  let requested_loss_j = bitcast<f32>(
    atomicLoad(&thermal_derived[row_offset + 5u])
  );
  if (
    !thermal_prepass_finite(requested_gain_j)
    || requested_gain_j < 0.0
    || !thermal_prepass_finite(requested_loss_j)
    || requested_loss_j < 0.0
  ) {
    atomicAdd(&thermal_derived[1u], 1u);
    return;
  }
  let gain_room_j = max(0.0, pos_mass.w * (energy_hi - vel_u.w));
  let loss_room_j = max(0.0, pos_mass.w * (vel_u.w - energy_lo));
  var gain_scale = 1.0;
  if (requested_gain_j > 0.0) {
    gain_scale = min(1.0, gain_room_j / requested_gain_j);
  }
  var loss_scale = 1.0;
  if (requested_loss_j > 0.0) {
    loss_scale = min(1.0, loss_room_j / requested_loss_j);
  }
  atomicStore(&thermal_derived[row_offset + 4u], bitcast<u32>(gain_scale));
  atomicStore(&thermal_derived[row_offset + 5u], bitcast<u32>(loss_scale));
  atomicStore(&thermal_derived[row_offset + 6u], bitcast<u32>(energy_lo));
  atomicStore(&thermal_derived[row_offset + 7u], bitcast<u32>(energy_hi));
}
`;

const exactNearTraversalWgsl = createSchroederSpatialExactNearTraversalV1Wgsl({
  directoryBindingName: 'spatial_directory'
});

const spatialThermalExactEntryPointsWgsl = /* wgsl */ `
// A uniform temperature field has no pairwise conduction or radiation work to
// do, but it still owes the canonical apply stage one row per particle and the
// two consumer receipts their exact traversal totals.  Keep this state local to
// a workgroup so the two expensive directory-admission checks run once per
// group rather than once per source.  The certificate below deliberately
// excludes aggregate projection: that route materializes its source-rank
// sidecar during the normal budget pass, and skipping it would weaken the
// active-member proof for a later non-uniform epoch.  The compact active-rank
// view is different: the prepass authenticates every rank/source-index pair
// before it seals the compact dispatch, so it can publish the live rows by
// ordinal while the encoder's full-row clear preserves inert dormant rows.
var<workgroup> thermal_uniform_completion_workgroup_flag: u32;

fn thermal_uniform_completion_admitted() -> bool {
  let particle_count = thermal_params.particle_count;
  if (particle_count == 0u || atomicLoad(&thermal_derived[1u]) != 0u) {
    return false;
  }
  let global_max_temperature_bits = atomicLoad(&thermal_derived[2u]);
  let global_min_temperature_bits = ~atomicLoad(&thermal_derived[3u]);
  if (global_max_temperature_bits != global_min_temperature_bits) {
    return false;
  }
  if (
    conduction_expectation.support_profile_id
        != thermal_params.conduction_support_profile_id
    || radiation_expectation.support_profile_id
        != thermal_params.radiation_support_profile_id
    || !ss_exact_near_directory_admitted(conduction_expectation)
    || !ss_exact_near_directory_admitted(radiation_expectation)
  ) {
    return false;
  }
  let projection_mode = thermal_params.active_member_projection_enabled;
  let current_active_count = atomicLoad(
    &thermal_derived[THERMAL_CURRENT_ACTIVE_SOURCE_COUNT_WORD]
  );
  let expected_active_count = atomicLoad(
    &thermal_derived[THERMAL_EXPECTED_ACTIVE_MEMBER_COUNT_WORD]
  );
  if (current_active_count == 0u) { return false; }
  if (projection_mode == THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_NONE) {
    return expected_active_count == particle_count;
  }
  if (!thermal_active_member_projection_admitted()) { return false; }
  if (
    projection_mode == THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_LOCAL
    || projection_mode == THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_ACTIVE_RANK
  ) {
    return current_active_count == expected_active_count
      && atomicLoad(
        &thermal_derived[THERMAL_ACTIVE_SOURCE_RANK_COUNT_WORD]
      ) == current_active_count;
  }
  return false;
}

fn thermal_uniform_completion_workgroup_admitted(
  local_invocation_index: u32
) -> bool {
  if (local_invocation_index == 0u) {
    thermal_uniform_completion_workgroup_flag = select(
      0u,
      1u,
      thermal_uniform_completion_admitted()
    );
  }
  workgroupBarrier();
  return thermal_uniform_completion_workgroup_flag != 0u;
}

fn thermal_record_uniform_completion(budget_mode: bool) {
  let source_count = thermal_params.particle_count;
  thermal_evidence_add(0u, source_count, true);
  thermal_evidence_add(0u, source_count, false);
  thermal_evidence_add(1u, source_count, true);
  thermal_evidence_add(1u, source_count, false);
  if (!budget_mode) {
    if (thermal_params.candidate_capacity != 0u) {
      // No pairwise candidates are consumed when the GPU-derived field is
      // uniform.  Record this separately from replay/rewalk so a READY CSR
      // header cannot be misreported as an actual candidate replay.
      thermal_csr_mark_route(THERMAL_CSR_ROUTE_UNIFORM_COMPLETION);
    }
    atomicAdd(&thermal_proposals[15u], source_count);
    thermal_evidence_add(6u, source_count, true);
    thermal_evidence_add(6u, source_count, false);
  }
}

fn thermal_publish_uniform_completion_row(particle_index: u32) {
  let row_offset = THERMAL_PROPOSAL_HEADER_WORDS
    + particle_index * THERMAL_PROPOSAL_ROW_WORDS;
  let derived_row_offset = THERMAL_DERIVED_HEADER_WORDS
    + particle_index * THERMAL_DERIVED_ROW_WORDS;
  atomicStore(&thermal_proposals[row_offset], 0u);
  atomicStore(&thermal_proposals[row_offset + 1u], 0u);
  atomicStore(
    &thermal_proposals[row_offset + 2u],
    atomicLoad(&thermal_derived[derived_row_offset + 6u])
  );
  atomicStore(
    &thermal_proposals[row_offset + 3u],
    atomicLoad(&thermal_derived[derived_row_offset + 7u])
  );
}

fn thermal_bulk_dormant_projection_evidence(
  expected_active_count: u32,
  budget_mode: bool
) {
  if (expected_active_count > thermal_params.particle_count) { return; }
  let dormant_count = thermal_params.particle_count - expected_active_count;
  if (dormant_count == 0u) { return; }
  thermal_evidence_add(0u, dormant_count, true);
  thermal_evidence_add(0u, dormant_count, false);
  thermal_evidence_add(1u, dormant_count, true);
  thermal_evidence_add(1u, dormant_count, false);
  if (!budget_mode) {
    atomicAdd(&thermal_proposals[15u], dormant_count);
    thermal_evidence_add(6u, dormant_count, true);
    thermal_evidence_add(6u, dormant_count, false);
  }
}

fn thermal_fail_active_source_rank_lookup() {
  atomicAdd(&thermal_derived[1u], 1u);
  thermal_evidence_add(0u, 1u, true);
  thermal_evidence_add(0u, 1u, false);
  thermal_evidence_add(5u, 1u, true);
  thermal_evidence_add(5u, 1u, false);
  thermal_mark_invalid(true);
  thermal_mark_invalid(false);
}

fn thermal_publish_uniform_completion_active_ordinal(active_ordinal: u32) {
  let lookup = thermal_active_rank_view_source_at_ordinal(active_ordinal, false);
  if (lookup.admitted == 0u) {
    thermal_fail_active_source_rank_lookup();
    return;
  }
  thermal_publish_uniform_completion_row(lookup.source_index);
}

fn thermal_materialize_uniform_completion_active_ordinal(active_ordinal: u32) {
  let lookup = thermal_active_rank_view_source_at_ordinal(active_ordinal, false);
  let sidecar_word = thermal_active_source_rank_sidecar_word(active_ordinal);
  if (lookup.admitted == 0u || sidecar_word >= arrayLength(&thermal_derived)) {
    thermal_fail_active_source_rank_lookup();
    return;
  }
  atomicStore(&thermal_derived[sidecar_word], lookup.source_rank);
}

fn thermal_fail_active_projection_global_seal() {
  let source_count = thermal_params.particle_count;
  thermal_evidence_add(0u, source_count, true);
  thermal_evidence_add(0u, source_count, false);
  thermal_evidence_add(1u, source_count, true);
  thermal_evidence_add(1u, source_count, false);
  thermal_evidence_add(5u, source_count, true);
  thermal_evidence_add(5u, source_count, false);
  atomicAdd(&thermal_proposals[6u], source_count);
  atomicAdd(&thermal_proposals[7u], source_count);
}

fn thermal_traverse_exact_source_rank(
  source_rank: u32,
  budget_mode: bool,
  active_rank_prevalidated: bool
) {
  let lookup = ss_exact_near_source_at_member(
    conduction_expectation,
    source_rank
  );
  if (
    lookup.admitted == 0u
    || lookup.source_index >= thermal_params.particle_count
  ) {
    thermal_evidence_add(0u, 1u, true);
    thermal_evidence_add(0u, 1u, false);
    thermal_evidence_add(5u, 1u, true);
    thermal_evidence_add(5u, 1u, false);
    thermal_mark_invalid(true);
    thermal_mark_invalid(false);
    return;
  }
  thermal_traverse_particle(
    lookup.source_index,
    budget_mode,
    select(
      0u,
      2u,
      !budget_mode && thermal_params.candidate_capacity != 0u
    ),
    active_rank_prevalidated
  );
}

@compute @workgroup_size(64)
fn budget(
  @builtin(global_invocation_id) global_id: vec3<u32>,
  @builtin(local_invocation_index) local_invocation_index: u32,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  if (thermal_uniform_completion_workgroup_admitted(local_invocation_index)) {
    let projection_mode = thermal_params.active_member_projection_enabled;
    if (
      projection_mode == THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_ACTIVE_RANK
      && global_id.x < atomicLoad(
        &thermal_derived[THERMAL_EXPECTED_ACTIVE_MEMBER_COUNT_WORD]
      )
    ) {
      thermal_materialize_uniform_completion_active_ordinal(global_id.x);
    }
    if (workgroup_id.x == 0u && local_invocation_index == 0u) {
      thermal_record_uniform_completion(true);
    }
    return;
  }
  let projection_mode = thermal_params.active_member_projection_enabled;
  if (projection_mode == THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_NONE) {
    if (global_id.x >= thermal_params.particle_count) { return; }
    thermal_traverse_exact_source_rank(global_id.x, true, false);
    return;
  }
  if (!thermal_active_member_projection_admitted()) {
    if (global_id.x == 0u) {
      thermal_fail_active_projection_global_seal();
    }
    return;
  }
  let expected_active_count = atomicLoad(
    &thermal_derived[THERMAL_EXPECTED_ACTIVE_MEMBER_COUNT_WORD]
  );
  let current_active_count = atomicLoad(
    &thermal_derived[THERMAL_CURRENT_ACTIVE_SOURCE_COUNT_WORD]
  );
  let materialized_active_count = atomicLoad(
    &thermal_derived[THERMAL_ACTIVE_SOURCE_RANK_COUNT_WORD]
  );
  if (
    atomicLoad(&thermal_derived[1u]) != 0u
    || current_active_count != expected_active_count
    || (
      (
        projection_mode == THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_LOCAL
        || projection_mode
          == THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_ACTIVE_RANK
      )
      && materialized_active_count != expected_active_count
    )
  ) {
    if (global_id.x == 0u) {
      thermal_fail_active_projection_global_seal();
    }
    return;
  }
  if (global_id.x == 0u) {
    thermal_bulk_dormant_projection_evidence(expected_active_count, true);
  }
  if (projection_mode == THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_LOCAL) {
    if (global_id.x >= thermal_params.particle_count) { return; }
    let local_sidecar_word = thermal_active_source_rank_sidecar_word(global_id.x);
    if (local_sidecar_word >= arrayLength(&thermal_derived)) {
      thermal_fail_active_source_rank_lookup();
      return;
    }
    let local_source_rank = atomicLoad(&thermal_derived[local_sidecar_word]);
    if (local_source_rank == 0xffffffffu) { return; }
    if (local_source_rank != global_id.x) {
      thermal_fail_active_source_rank_lookup();
      return;
    }
    thermal_traverse_exact_source_rank(local_source_rank, true, false);
    return;
  }
  if (global_id.x >= expected_active_count) { return; }
  let sidecar_word = thermal_active_source_rank_sidecar_word(global_id.x);
  if (sidecar_word >= arrayLength(&thermal_derived)) {
    thermal_fail_active_source_rank_lookup();
    return;
  }
  var source_rank = atomicLoad(&thermal_derived[sidecar_word]);
  if (projection_mode == THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_AGGREGATE) {
    let lookup = thermal_active_source_rank_at_ordinal(global_id.x);
    if (lookup.admitted == 0u) {
      thermal_fail_active_source_rank_lookup();
      return;
    }
    source_rank = lookup.source_rank;
    atomicStore(&thermal_derived[sidecar_word], source_rank);
    atomicAdd(&thermal_derived[THERMAL_ACTIVE_SOURCE_RANK_COUNT_WORD], 1u);
  } else if (
    projection_mode == THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_ACTIVE_RANK
  ) {
    let lookup = thermal_active_rank_view_source_at_ordinal(global_id.x, false);
    if (lookup.admitted == 0u) {
      thermal_fail_active_source_rank_lookup();
      return;
    }
    source_rank = lookup.source_rank;
    atomicStore(&thermal_derived[sidecar_word], source_rank);
  }
  thermal_traverse_exact_source_rank(
    source_rank,
    true,
    projection_mode == THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_ACTIVE_RANK
  );
}

@compute @workgroup_size(64)
fn propose(
  @builtin(global_invocation_id) global_id: vec3<u32>,
  @builtin(local_invocation_index) local_invocation_index: u32,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  if (thermal_uniform_completion_workgroup_admitted(local_invocation_index)) {
    let projection_mode = thermal_params.active_member_projection_enabled;
    if (
      projection_mode == THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_ACTIVE_RANK
      && global_id.x < atomicLoad(
        &thermal_derived[THERMAL_EXPECTED_ACTIVE_MEMBER_COUNT_WORD]
      )
    ) {
      thermal_publish_uniform_completion_active_ordinal(global_id.x);
    } else if (
      projection_mode != THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_ACTIVE_RANK
      && global_id.x < thermal_params.particle_count
    ) {
      thermal_publish_uniform_completion_row(global_id.x);
    }
    if (workgroup_id.x == 0u && local_invocation_index == 0u) {
      thermal_record_uniform_completion(false);
    }
    return;
  }
  let projection_mode = thermal_params.active_member_projection_enabled;
  if (projection_mode == THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_NONE) {
    if (global_id.x >= thermal_params.particle_count) { return; }
    thermal_traverse_exact_source_rank(global_id.x, false, false);
    return;
  }
  if (!thermal_active_member_projection_admitted()) {
    if (global_id.x == 0u) {
      thermal_fail_active_projection_global_seal();
    }
    return;
  }
  let expected_active_count = atomicLoad(
    &thermal_derived[THERMAL_EXPECTED_ACTIVE_MEMBER_COUNT_WORD]
  );
  let materialized_active_count = atomicLoad(
    &thermal_derived[THERMAL_ACTIVE_SOURCE_RANK_COUNT_WORD]
  );
  let current_active_count = atomicLoad(
    &thermal_derived[THERMAL_CURRENT_ACTIVE_SOURCE_COUNT_WORD]
  );
  if (
    atomicLoad(&thermal_derived[1u]) != 0u
    || current_active_count != expected_active_count
    || materialized_active_count != expected_active_count
  ) {
    if (global_id.x == 0u) {
      thermal_fail_active_projection_global_seal();
    }
    return;
  }
  if (global_id.x == 0u) {
    thermal_bulk_dormant_projection_evidence(expected_active_count, false);
  }
  if (projection_mode == THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_LOCAL) {
    if (global_id.x >= thermal_params.particle_count) { return; }
    let local_sidecar_word = thermal_active_source_rank_sidecar_word(global_id.x);
    if (local_sidecar_word >= arrayLength(&thermal_derived)) {
      thermal_fail_active_source_rank_lookup();
      return;
    }
    let local_source_rank = atomicLoad(&thermal_derived[local_sidecar_word]);
    if (local_source_rank == 0xffffffffu) { return; }
    if (local_source_rank != global_id.x) {
      thermal_fail_active_source_rank_lookup();
      return;
    }
    thermal_traverse_exact_source_rank(local_source_rank, false, false);
    return;
  }
  if (global_id.x >= expected_active_count) { return; }
  let sidecar_word = thermal_active_source_rank_sidecar_word(global_id.x);
  if (sidecar_word >= arrayLength(&thermal_derived)) {
    thermal_fail_active_source_rank_lookup();
    return;
  }
  let source_rank = atomicLoad(&thermal_derived[sidecar_word]);
  if (
    projection_mode == THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_ACTIVE_RANK
  ) {
    let lookup = thermal_active_rank_view_source_at_ordinal(global_id.x, false);
    if (lookup.admitted == 0u || lookup.source_rank != source_rank) {
      thermal_fail_active_source_rank_lookup();
      return;
    }
  }
  thermal_traverse_exact_source_rank(
    source_rank,
    false,
    projection_mode == THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_ACTIVE_RANK
  );
}
`;

const classicThermalExactEntryPointsWgsl = /* wgsl */ `
@compute @workgroup_size(64)
fn budget(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (global_id.x >= thermal_params.particle_count) { return; }
  thermal_traverse_particle(global_id.x, true, 0u, false);
}

@compute @workgroup_size(64)
fn propose(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (global_id.x >= thermal_params.particle_count) { return; }
  thermal_traverse_particle(global_id.x, false, 0u, false);
}
`;

// The exact thermal budget owns this compact, source-major candidate receipt.
// It is intentionally not shared with the mechanical pair graph: its support
// policy, active-member projection, and matched-time lifetime are thermal-law
// specific. The direct budget traversal writes raw peers plus one terminal
// skipped-member-count sentinel directly into its fixed source-major row. In
// particular, LOCAL projection keeps its compact source dispatch but its
// canonical directory still contains dormant phase companions and spare
// capacity. Those non-self, non-positive-mass peers have no pair-law effect;
// account for their candidate visits in the terminal record rather than
// consuming one bounded row word each. A sealed receipt replays
// deterministically for the reciprocal pass; an unsealed row receipt makes
// that pass rewalk the authenticated directory instead.
//
// Keep the extension in named fragments.  The classic thermal shader is
// mechanically derived from the shared pair-law source below and strips this
// exact-near-only ABI before compiling its own ten-binding variants.
const thermalCandidateCsrBindingsWgsl = /* wgsl */ `
// ULG_THERMAL_CANDIDATE_CSR_BINDINGS_BEGIN
@group(0) @binding(11) var<storage, read_write> thermal_csr_source_row_states: array<atomic<u32>>;
@group(0) @binding(12) var<storage, read_write> thermal_csr_unused: array<atomic<u32>>;
@group(0) @binding(13) var<storage, read_write> thermal_csr_control_and_peers: array<atomic<u32>>;
// ULG_THERMAL_CANDIDATE_CSR_BINDINGS_END
`;

const thermalCandidateCsrAdmissionWgsl = /* wgsl */ `
  // ULG_THERMAL_CANDIDATE_CSR_ADMISSION_BEGIN
  let csr_lookup = lookup_mode == 2u;
  if (csr_lookup) {
    conduction_admitted = conduction_expectation.support_profile_id
      == thermal_params.conduction_support_profile_id
      && ss_exact_near_directory_admitted(conduction_expectation);
    radiation_admitted = radiation_expectation.support_profile_id
      == thermal_params.radiation_support_profile_id
      && ss_exact_near_directory_admitted(radiation_expectation);
  }
  let csr_active_projection_admitted = !csr_lookup
    || thermal_active_member_projection_admitted();
  conduction_admitted = conduction_admitted
    && csr_active_projection_admitted;
  radiation_admitted = radiation_admitted
    && csr_active_projection_admitted;
  // ULG_THERMAL_CANDIDATE_CSR_ADMISSION_END
`;

const thermalCandidateCsrTraversalPreludeWgsl = /* wgsl */ `
  // ULG_THERMAL_CANDIDATE_CSR_TRAVERSAL_PRELUDE_BEGIN
  var thermal_csr_capture = budget_mode && exact_near_lookup
    && thermal_params.candidate_capacity != 0u;
  var thermal_csr_capture_row = ThermalCsrCaptureRow(0u, 0u, 0u);
  var thermal_csr_capture_abandoned = false;
  if (thermal_csr_capture) {
    thermal_csr_capture_row = thermal_csr_claim_source_row(particle_index);
    if (thermal_csr_capture_row.admitted == 0u) {
      // The candidate arena is an optional reuse receipt.  Preserve the
      // complete budget traversal when it cannot be claimed; the reciprocal
      // pass will rewalk the authenticated directory instead of consuming a
      // partial row.
      thermal_csr_capture = false;
      thermal_csr_capture_abandoned = true;
    }
  }
  var thermal_csr_capture_record_count = 0u;
  var thermal_csr_skipped_member_count = 0u;
  // ULG_THERMAL_CANDIDATE_CSR_TRAVERSAL_PRELUDE_END
`;

const thermalCandidateCsrRoutePreludeWgsl = /* wgsl */ `
  // ULG_THERMAL_CANDIDATE_CSR_ROUTE_PRELUDE_BEGIN
  // The proposal path is the only consumer of the captured candidate rows.
  // Evaluate the same authenticated admission used by the exact branch before
  // entering it, then preserve that branch's original directory fallback.
  if (!budget_mode && lookup_mode == 2u) {
    thermal_csr_mark_route(select(
      THERMAL_CSR_ROUTE_EXACT_NEAR_REWALK,
      THERMAL_CSR_ROUTE_REPLAY,
      thermal_csr_replay_admitted()
    ));
  }
  // ULG_THERMAL_CANDIDATE_CSR_ROUTE_PRELUDE_END
`;

const thermalCandidateCsrCaptureCandidateWgsl = /* wgsl */ `
            // ULG_THERMAL_CANDIDATE_CSR_CAPTURE_CANDIDATE_BEGIN
            if (thermal_csr_capture) {
              // The budget visit has already performed the authoritative
              // pair-law classification. Preserve every non-self candidate
              // count through the terminal record, but retain a raw peer only
              // when the exact reciprocal pass could reach a thermal effect
              // or a defensive malformed-state path. Self stays raw because
              // it never increments the candidate count in the first place.
              if (
                thermal_pair_visit_outcome
                  == THERMAL_PAIR_VISIT_OUTCOME_NO_REPLAY
              ) {
                if (!thermal_csr_add_skipped_member_count(
                  &thermal_csr_skipped_member_count,
                  1u
                )) {
                  thermal_csr_capture = false;
                  thermal_csr_capture_abandoned = true;
                }
              } else if (!thermal_csr_capture_candidate(
                thermal_csr_capture_row,
                &thermal_csr_capture_record_count,
                other_index,
                false
              )) {
                thermal_csr_capture = false;
                thermal_csr_capture_abandoned = true;
              }
            }
            // ULG_THERMAL_CANDIDATE_CSR_CAPTURE_CANDIDATE_END
`;

const thermalCandidateCsrSkippedMemberWgsl = /* wgsl */ `
            // ULG_THERMAL_CANDIDATE_CSR_SKIPPED_MEMBER_BEGIN
            if (
              thermal_csr_capture
              && !thermal_csr_add_skipped_member_count(
                &thermal_csr_skipped_member_count,
                skipped_dormant_count
              )
            ) {
              thermal_csr_capture = false;
              thermal_csr_capture_abandoned = true;
            }
            // ULG_THERMAL_CANDIDATE_CSR_SKIPPED_MEMBER_END
`;

const thermalCandidateCsrExactTraversalPrefixWgsl = /* wgsl */ `  if (
    csr_lookup && thermal_csr_replay_admitted()
  ) {
    let csr_range = thermal_csr_source_range(particle_index);
    if (csr_range.admitted == 0u) {
      malformed = true;
    } else {
      var csr_seen_skipped_member_count = false;
      for (
        var csr_cursor = csr_range.begin;
        csr_cursor < csr_range.end;
        csr_cursor = csr_cursor + 1u
      ) {
        let encoded_peer = atomicLoad(
          &thermal_csr_control_and_peers[
            THERMAL_CSR_CONTROL_WORDS + csr_cursor
          ]
        );
        if ((encoded_peer & THERMAL_CSR_SKIPPED_MEMBER_BIT) != 0u) {
          if (
            csr_seen_skipped_member_count
            || csr_cursor + 1u != csr_range.end
          ) {
            malformed = true;
            break;
          }
          let skipped_member_count = encoded_peer & THERMAL_CSR_VALUE_MASK;
          if (
            !thermal_add_local(
              &conduction_candidate_visit_count,
              skipped_member_count
            )
            || !thermal_add_local(
              &radiation_candidate_visit_count,
              skipped_member_count
            )
          ) {
            local_count_overflow = true;
            malformed = true;
            break;
          }
          csr_seen_skipped_member_count = true;
          continue;
        }
        if (encoded_peer >= thermal_params.particle_count) {
          malformed = true;
          break;
        }
        thermal_visit_fused_pair(
          budget_mode,
          particle_index,
          encoded_peer,
          self_pos_mass.xyz,
          self_mass,
          self_temperature,
          self_temperature_slope,
          self_radius_m,
          self_emissivity,
          self_gain_scale,
          self_loss_scale,
          &requested_gain_j,
          &requested_loss_j,
          &conduction_specific_energy_delta,
          &radiation_specific_energy_delta,
          &neighbor_min_temperature,
          &neighbor_max_temperature,
          &conduction_candidate_visit_count,
          &radiation_candidate_visit_count,
          &conduction_mask_hit_count,
          &radiation_mask_hit_count,
          &local_count_overflow
        );
      }
      if (!csr_seen_skipped_member_count) {
        malformed = true;
      }
    }
  } else {
`;

const thermalCandidateCsrExactTraversalSuffixWgsl = /* wgsl */ `  // ULG_THERMAL_CANDIDATE_CSR_EXACT_SUFFIX_BEGIN
  }
  // ULG_THERMAL_CANDIDATE_CSR_EXACT_SUFFIX_END
`;

const thermalCandidateCsrFinalizeCaptureWgsl = /* wgsl */ `  // ULG_THERMAL_CANDIDATE_CSR_FINALIZE_CAPTURE_BEGIN
  if (thermal_csr_capture) {
    if (
      !malformed
      && !thermal_csr_capture_candidate(
        thermal_csr_capture_row,
        &thermal_csr_capture_record_count,
        THERMAL_CSR_SKIPPED_MEMBER_BIT | thermal_csr_skipped_member_count,
        true
      )
    ) {
      thermal_csr_capture = false;
      thermal_csr_capture_abandoned = true;
    }
    if (
      thermal_csr_capture
      && !malformed
      && !thermal_csr_finish_capture(
        particle_index,
        thermal_csr_capture_row,
        thermal_csr_capture_record_count
      )
    ) {
      thermal_csr_capture = false;
      thermal_csr_capture_abandoned = true;
    }
  }
  if (thermal_csr_capture_abandoned || (thermal_csr_capture && malformed)) {
    thermal_csr_abort_capture(thermal_csr_capture_row);
  }
  // ULG_THERMAL_CANDIDATE_CSR_FINALIZE_CAPTURE_END
`;

const thermalCandidateCsrHelpersWgsl = /* wgsl */ `
// ULG_THERMAL_CANDIDATE_CSR_HELPERS_BEGIN
const THERMAL_CSR_MAGIC: u32 = ${SCHROEDER_SPATIAL_THERMAL_CSR_MAGIC}u;
const THERMAL_CSR_VERSION: u32 = ${SCHROEDER_SPATIAL_THERMAL_CSR_VERSION}u;
const THERMAL_CSR_CONTROL_WORDS: u32 = ${SCHROEDER_SPATIAL_THERMAL_CSR_CONTROL_WORDS}u;
const THERMAL_CSR_ROW_STRIDE_WORD: u32 = ${SCHROEDER_SPATIAL_THERMAL_CSR_ROW_STRIDE_WORD}u;
const THERMAL_CSR_STATUS_WORD: u32 = ${SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_WORD}u;
const THERMAL_CSR_ROUTE_WORD: u32 = ${SCHROEDER_SPATIAL_THERMAL_CSR_ROUTE_WORD}u;
const THERMAL_CSR_ROW_STATE_WRITING: u32 = ${SCHROEDER_SPATIAL_THERMAL_CSR_ROW_STATE_WRITING}u;
const THERMAL_CSR_SKIPPED_MEMBER_BIT: u32 = ${SCHROEDER_SPATIAL_THERMAL_CSR_SKIPPED_MEMBER_BIT}u;
const THERMAL_CSR_VALUE_MASK: u32 = ${SCHROEDER_SPATIAL_THERMAL_CSR_VALUE_MASK}u;
const THERMAL_CSR_STATUS_READY: u32 = ${SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_READY}u;
const THERMAL_CSR_STATUS_INVALID: u32 = ${SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_INVALID}u;
const THERMAL_CSR_STATUS_OVERFLOW: u32 = ${SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_OVERFLOW}u;
const THERMAL_CSR_STATUS_ROWS_FINALIZED: u32 = ${SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_ROWS_FINALIZED}u;
const THERMAL_CSR_STATUS_VALIDATED: u32 = ${SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_VALIDATED}u;
const THERMAL_CSR_ROUTE_UNIFORM_COMPLETION: u32 = ${SCHROEDER_SPATIAL_THERMAL_CSR_ROUTE_UNIFORM_COMPLETION}u;
const THERMAL_CSR_ROUTE_REPLAY: u32 = ${SCHROEDER_SPATIAL_THERMAL_CSR_ROUTE_REPLAY}u;
const THERMAL_CSR_ROUTE_EXACT_NEAR_REWALK: u32 = ${SCHROEDER_SPATIAL_THERMAL_CSR_ROUTE_EXACT_NEAR_REWALK}u;

struct ThermalCsrRange {
  begin: u32,
  end: u32,
  admitted: u32,
};

struct ThermalCsrCaptureRow {
  base: u32,
  stride: u32,
  admitted: u32,
};

fn thermal_csr_mark_status(status_bits: u32) {
  if (arrayLength(&thermal_csr_control_and_peers) > THERMAL_CSR_STATUS_WORD) {
    atomicOr(
      &thermal_csr_control_and_peers[THERMAL_CSR_STATUS_WORD],
      status_bits
    );
  }
}

fn thermal_csr_mark_route(route_bits: u32) {
  if (arrayLength(&thermal_csr_control_and_peers) > THERMAL_CSR_ROUTE_WORD) {
    atomicOr(
      &thermal_csr_control_and_peers[THERMAL_CSR_ROUTE_WORD],
      route_bits
    );
  }
}

// This is intentionally narrower than thermal_uniform_completion_admitted().
// A pairwise candidate arena is empty whenever the derived temperature field
// is uniform, even if some separate completion receipt cannot be short-cut.
// The normal proposal path still performs its own directory/projection
// admission before it consumes that zero-row replay receipt.
fn thermal_csr_pairwise_temperature_uniform() -> bool {
  return thermal_params.particle_count != 0u
    && atomicLoad(&thermal_derived[1u]) == 0u
    && atomicLoad(&thermal_derived[2u])
      == ~atomicLoad(&thermal_derived[3u]);
}

fn thermal_csr_header_admitted() -> bool {
  if (arrayLength(&thermal_csr_control_and_peers) < THERMAL_CSR_CONTROL_WORDS) {
    return false;
  }
  let source_capacity = atomicLoad(&thermal_csr_control_and_peers[2u]);
  let candidate_capacity = atomicLoad(&thermal_csr_control_and_peers[3u]);
  let row_stride = atomicLoad(
    &thermal_csr_control_and_peers[THERMAL_CSR_ROW_STRIDE_WORD]
  );
  if (
    atomicLoad(&thermal_csr_control_and_peers[0u]) != THERMAL_CSR_MAGIC
    || atomicLoad(&thermal_csr_control_and_peers[1u]) != THERMAL_CSR_VERSION
    || source_capacity == 0u
    || candidate_capacity == 0u
    || candidate_capacity != thermal_params.candidate_capacity
    || source_capacity < thermal_params.particle_count
    || source_capacity > arrayLength(&thermal_csr_source_row_states)
    || row_stride == 0u
    || row_stride > candidate_capacity / source_capacity
    || row_stride * source_capacity != candidate_capacity
    || candidate_capacity > arrayLength(&thermal_csr_control_and_peers)
      - THERMAL_CSR_CONTROL_WORDS
  ) {
    return false;
  }
  return true;
}

fn thermal_csr_capture_admitted() -> bool {
  return thermal_csr_header_admitted();
}

fn thermal_csr_replay_admitted() -> bool {
  if (!thermal_csr_header_admitted()) { return false; }
  let source_capacity = atomicLoad(&thermal_csr_control_and_peers[2u]);
  let status = atomicLoad(
    &thermal_csr_control_and_peers[THERMAL_CSR_STATUS_WORD]
  );
  return source_capacity <= arrayLength(&thermal_csr_source_row_states)
    && (status & THERMAL_CSR_STATUS_READY) != 0u
    && (status & (THERMAL_CSR_STATUS_INVALID | THERMAL_CSR_STATUS_OVERFLOW)) == 0u;
}

fn thermal_csr_claim_source_row(source_index: u32) -> ThermalCsrCaptureRow {
  if (!thermal_csr_capture_admitted()) {
    thermal_csr_mark_status(THERMAL_CSR_STATUS_INVALID);
    return ThermalCsrCaptureRow(0u, 0u, 0u);
  }
  let source_capacity = atomicLoad(&thermal_csr_control_and_peers[2u]);
  let row_stride = atomicLoad(
    &thermal_csr_control_and_peers[THERMAL_CSR_ROW_STRIDE_WORD]
  );
  if (
    source_index >= source_capacity
    || source_index >= thermal_params.particle_count
  ) {
    thermal_csr_mark_status(THERMAL_CSR_STATUS_INVALID);
    return ThermalCsrCaptureRow(0u, 0u, 0u);
  }
  // Weak compare-exchange may fail spuriously.  Retrying while the row is
  // still unclaimed distinguishes that harmless condition from a duplicate
  // physical-source traversal, which must reject the receipt.
  loop {
    let claim = atomicCompareExchangeWeak(
      &thermal_csr_source_row_states[source_index],
      0u,
      THERMAL_CSR_ROW_STATE_WRITING
    );
    if (claim.exchanged) { break; }
    if (claim.old_value != 0u) {
      thermal_csr_mark_status(THERMAL_CSR_STATUS_INVALID);
      return ThermalCsrCaptureRow(0u, 0u, 0u);
    }
  }
  return ThermalCsrCaptureRow(source_index * row_stride, row_stride, 1u);
}

fn thermal_csr_capture_candidate(
  capture_row: ThermalCsrCaptureRow,
  capture_record_count: ptr<function, u32>,
  encoded_peer: u32,
  is_terminal_skipped_member: bool
) -> bool {
  if (capture_row.admitted == 0u) {
    thermal_csr_mark_status(THERMAL_CSR_STATUS_INVALID);
    return false;
  }
  let encoded_is_skipped_member = (
    encoded_peer & THERMAL_CSR_SKIPPED_MEMBER_BIT
  ) != 0u;
  if (encoded_is_skipped_member != is_terminal_skipped_member) {
    thermal_csr_mark_status(THERMAL_CSR_STATUS_INVALID);
    return false;
  }
  if (*capture_record_count >= capture_row.stride) {
    thermal_csr_mark_status(
      THERMAL_CSR_STATUS_INVALID | THERMAL_CSR_STATUS_OVERFLOW
    );
    return false;
  }
  atomicStore(
    &thermal_csr_control_and_peers[
      THERMAL_CSR_CONTROL_WORDS + capture_row.base + *capture_record_count
    ],
    encoded_peer
  );
  *capture_record_count = *capture_record_count + 1u;
  return true;
}

fn thermal_csr_finish_capture(
  source_index: u32,
  capture_row: ThermalCsrCaptureRow,
  capture_record_count: u32
) -> bool {
  if (
    capture_row.admitted == 0u
    || source_index >= arrayLength(&thermal_csr_source_row_states)
    || capture_record_count == 0u
    || capture_record_count > capture_row.stride
  ) {
    thermal_csr_mark_status(THERMAL_CSR_STATUS_INVALID);
    return false;
  }
  atomicStore(
    &thermal_csr_source_row_states[source_index],
    capture_record_count
  );
  return true;
}

fn thermal_csr_abort_capture(capture_row: ThermalCsrCaptureRow) {
  if (capture_row.admitted != 0u) {
    // Leave the source row in WRITING.  Validation treats it as an incomplete
    // publication, so no partially written peer prefix can be replayed.
    thermal_csr_mark_status(THERMAL_CSR_STATUS_INVALID);
  }
}

fn thermal_csr_add_skipped_member_count(
  counter: ptr<function, u32>,
  value: u32
) -> bool {
  if (value > THERMAL_CSR_VALUE_MASK - *counter) { return false; }
  *counter = *counter + value;
  return true;
}

fn thermal_csr_source_range(source_index: u32) -> ThermalCsrRange {
  if (!thermal_csr_replay_admitted()) {
    return ThermalCsrRange(0u, 0u, 0u);
  }
  let source_capacity = atomicLoad(&thermal_csr_control_and_peers[2u]);
  let row_stride = atomicLoad(
    &thermal_csr_control_and_peers[THERMAL_CSR_ROW_STRIDE_WORD]
  );
  if (
    source_index >= source_capacity
    || source_index >= thermal_params.particle_count
  ) {
    return ThermalCsrRange(0u, 0u, 0u);
  }
  let row_count = atomicLoad(&thermal_csr_source_row_states[source_index]);
  if (
    row_count == 0u
    || row_count == THERMAL_CSR_ROW_STATE_WRITING
    || row_count > row_stride
  ) {
    return ThermalCsrRange(0u, 0u, 0u);
  }
  let begin = source_index * row_stride;
  return ThermalCsrRange(begin, begin + row_count, 1u);
}

@compute @workgroup_size(64)
fn validate_thermal_csr_rows(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let source_index = global_id.x;
  if (!thermal_csr_header_admitted()) {
    if (source_index == 0u) {
      thermal_csr_mark_status(THERMAL_CSR_STATUS_INVALID);
    }
    return;
  }
  let source_capacity = atomicLoad(&thermal_csr_control_and_peers[2u]);
  if (source_index >= source_capacity) { return; }
  let row_state = atomicLoad(&thermal_csr_source_row_states[source_index]);
  if (thermal_csr_pairwise_temperature_uniform()) {
    if (row_state != 0u) {
      thermal_csr_mark_status(THERMAL_CSR_STATUS_INVALID);
    }
  } else if (source_index >= thermal_params.particle_count) {
    if (row_state != 0u) {
      thermal_csr_mark_status(THERMAL_CSR_STATUS_INVALID);
    }
  } else {
  let source_pos_mass = source_state[source_index * 2u];
  if (source_pos_mass.w <= 0.0) {
    if (row_state != 0u) {
      thermal_csr_mark_status(THERMAL_CSR_STATUS_INVALID);
    }
  } else {
    let row_stride = atomicLoad(
      &thermal_csr_control_and_peers[THERMAL_CSR_ROW_STRIDE_WORD]
    );
    if (
      row_state == 0u
      || row_state == THERMAL_CSR_ROW_STATE_WRITING
      || row_state > row_stride
    ) {
      thermal_csr_mark_status(THERMAL_CSR_STATUS_INVALID);
    } else {
      let terminal_peer = atomicLoad(
        &thermal_csr_control_and_peers[
          THERMAL_CSR_CONTROL_WORDS
            + source_index * row_stride + row_state - 1u
        ]
      );
      if ((terminal_peer & THERMAL_CSR_SKIPPED_MEMBER_BIT) == 0u) {
        thermal_csr_mark_status(THERMAL_CSR_STATUS_INVALID);
      }
    }
  }
  }
  if (source_index == 0u) {
    thermal_csr_mark_status(
      THERMAL_CSR_STATUS_ROWS_FINALIZED | THERMAL_CSR_STATUS_VALIDATED
    );
  }
}

@compute @workgroup_size(64)
fn seal_thermal_csr(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (global_id.x != 0u) { return; }
  if (!thermal_csr_header_admitted()) {
    thermal_csr_mark_status(THERMAL_CSR_STATUS_INVALID);
    return;
  }
  let status = atomicLoad(
    &thermal_csr_control_and_peers[THERMAL_CSR_STATUS_WORD]
  );
  let required_bits = THERMAL_CSR_STATUS_ROWS_FINALIZED
    | THERMAL_CSR_STATUS_VALIDATED;
  if (
    (status & required_bits) != required_bits
    || (status & (THERMAL_CSR_STATUS_INVALID | THERMAL_CSR_STATUS_OVERFLOW)) != 0u
  ) {
    thermal_csr_mark_status(THERMAL_CSR_STATUS_INVALID);
    return;
  }
  thermal_csr_mark_status(THERMAL_CSR_STATUS_READY);
}
// ULG_THERMAL_CANDIDATE_CSR_HELPERS_END
`;

function stripThermalCandidateCsrWgsl(source) {
  return source
    .replace(thermalCandidateCsrBindingsWgsl, '')
    .replace(thermalCandidateCsrAdmissionWgsl, '')
    .replace(thermalCandidateCsrTraversalPreludeWgsl, '')
    .replace(thermalCandidateCsrRoutePreludeWgsl, '')
    .replaceAll(thermalCandidateCsrCaptureCandidateWgsl, '')
    .replaceAll(thermalCandidateCsrSkippedMemberWgsl, '')
    .replace(thermalCandidateCsrFinalizeCaptureWgsl, '')
    .replace(thermalCandidateCsrExactTraversalPrefixWgsl, '')
    .replace(thermalCandidateCsrExactTraversalSuffixWgsl, '')
    .replace(thermalCandidateCsrHelpersWgsl, '');
}

export const schroederSpatialThermalProposalWgsl = /* wgsl */ `
struct ThermalProposalParams {
  particle_count: u32,
  material_count: u32,
  response_count: u32,
  conduction_support_profile_id: u32,
  radiation_support_profile_id: u32,
  active_member_projection_enabled: u32,
  dt_s: f32,
  smoothing_length_m: f32,
  conduction_rate: f32,
  radiation_pair_range_radii: f32,
  stefan_boltzmann_w_per_m2_k4: f32,
  candidate_capacity: u32,
  lookup_mode: u32,
  bin_capacity: u32,
  bin_nx: u32,
  bin_ny: u32,
  bin_nz: u32,
  bin_cell_count: u32,
  bin_cell_size_m: f32,
  max_bin_scan_radius_cells: u32,
};

@group(0) @binding(0) var<storage, read> source_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> thermal_derived: array<atomic<u32>>;
@group(0) @binding(2) var<storage, read> spatial_directory: array<u32>;
@group(0) @binding(3) var<storage, read_write> thermal_proposals: array<atomic<u32>>;
@group(0) @binding(4) var<storage, read_write> conduction_evidence: array<atomic<u32>>;
@group(0) @binding(5) var<storage, read_write> radiation_evidence: array<atomic<u32>>;
@group(0) @binding(6) var<uniform> conduction_expectation: SchroederSpatialExactNearExpectationV1;
@group(0) @binding(7) var<uniform> radiation_expectation: SchroederSpatialExactNearExpectationV1;
@group(0) @binding(8) var<uniform> thermal_params: ThermalProposalParams;
@group(0) @binding(9) var<storage, read> directory_position_state: array<vec4<f32>>;
@group(0) @binding(10) var<storage, read> spatial_aggregate_view: array<u32>;
${thermalCandidateCsrBindingsWgsl}

${exactNearTraversalWgsl}

const THERMAL_PROPOSAL_HEADER_WORDS: u32 = ${SCHROEDER_SPATIAL_THERMAL_PROPOSAL_HEADER_WORDS}u;
const THERMAL_PROPOSAL_ROW_WORDS: u32 = ${SCHROEDER_SPATIAL_THERMAL_PROPOSAL_ROW_WORDS}u;
const THERMAL_DERIVED_HEADER_WORDS: u32 = ${SCHROEDER_SPATIAL_THERMAL_DERIVED_HEADER_WORDS}u;
const THERMAL_DERIVED_ROW_WORDS: u32 = ${SCHROEDER_SPATIAL_THERMAL_DERIVED_ROW_WORDS}u;
const THERMAL_PAIR_RELAXATION_LIMIT: f32 = 0.25;
// A pair visit reports whether the exact reciprocal proposal needs to replay
// it. The budget path still visits every authenticated candidate and counts
// every non-self candidate exactly once; a no-replay outcome simply permits
// the CSR receipt to accumulate that count in its terminal record.
const THERMAL_PAIR_VISIT_OUTCOME_NO_REPLAY: u32 = 0u;
const THERMAL_PAIR_VISIT_OUTCOME_REPLAY: u32 = 1u;
const THERMAL_PAIR_VISIT_OUTCOME_SELF: u32 = 2u;
const THERMAL_AGGREGATE_MAGIC: u32 = 0x53414731u;
const THERMAL_AGGREGATE_VERSION: u32 = 2u;
const THERMAL_AGGREGATE_STATUS_EXACT: u32 = 259u;
const THERMAL_AGGREGATE_HEADER_WORDS: u32 = 112u;
const THERMAL_AGGREGATE_RECORD_WORDS: u32 = 44u;
const THERMAL_AGGREGATE_RECORD_ACTIVE_COUNT: u32 = 19u;
const THERMAL_AGGREGATE_RECORD_STATUS: u32 = 27u;
const THERMAL_AGGREGATE_RECORD_BEGIN: u32 = 33u;
const THERMAL_AGGREGATE_RECORD_END: u32 = 34u;
const THERMAL_AGGREGATE_RECORD_CELL: u32 = 35u;
const THERMAL_AGGREGATE_RECORD_PARENT: u32 = 36u;
const THERMAL_AGGREGATE_RECORD_SOURCE_COUNT: u32 = 43u;
const THERMAL_AGGREGATE_RECORD_LEAF_EXACT: u32 = 67u;
const THERMAL_AGGREGATE_RECORD_INTERNAL_EXACT: u32 = 69u;
const THERMAL_ACTIVE_MEMBER_PROJECTION_ADMISSION_WORD: u32 = ${SCHROEDER_SPATIAL_THERMAL_ACTIVE_MEMBER_PROJECTION_ADMISSION_WORD}u;
const THERMAL_ACTIVE_MEMBER_PROJECTION_ADMITTED: u32 = ${SCHROEDER_SPATIAL_THERMAL_ACTIVE_MEMBER_PROJECTION_ADMITTED}u;
const THERMAL_CURRENT_ACTIVE_SOURCE_COUNT_WORD: u32 = ${SCHROEDER_SPATIAL_THERMAL_CURRENT_ACTIVE_SOURCE_COUNT_WORD}u;
const THERMAL_ACTIVE_SOURCE_RANK_COUNT_WORD: u32 = ${SCHROEDER_SPATIAL_THERMAL_ACTIVE_SOURCE_RANK_COUNT_WORD}u;
const THERMAL_EXPECTED_ACTIVE_MEMBER_COUNT_WORD: u32 = ${SCHROEDER_SPATIAL_THERMAL_EXPECTED_ACTIVE_MEMBER_COUNT_WORD}u;
const THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_NONE: u32 = ${SCHROEDER_SPATIAL_THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_NONE}u;
const THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_AGGREGATE: u32 = ${SCHROEDER_SPATIAL_THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_AGGREGATE}u;
const THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_LOCAL: u32 = ${SCHROEDER_SPATIAL_THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_LOCAL}u;
const THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_ACTIVE_RANK: u32 = ${SCHROEDER_SPATIAL_THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_ACTIVE_RANK}u;
const THERMAL_ACTIVE_RANK_VIEW_HEADER_WORDS: u32 = ${SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_HEADER_WORDS}u;
const THERMAL_ACTIVE_RANK_VIEW_MAX_SOURCE_COUNT: u32 = ${SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_MAX_SOURCE_COUNT}u;

struct ThermalActiveSourceRankLookup {
  admitted: u32,
  source_rank: u32,
};

struct ThermalActiveRankViewLookup {
  source_rank: u32,
  source_index: u32,
  admitted: u32,
};

struct ThermalActiveRankViewRange {
  begin: u32,
  end: u32,
  admitted: u32,
};

fn thermal_active_member_projection_admitted() -> bool {
  if (thermal_params.active_member_projection_enabled == 0u) { return true; }
  return atomicLoad(
    &thermal_derived[THERMAL_ACTIVE_MEMBER_PROJECTION_ADMISSION_WORD]
  ) == THERMAL_ACTIVE_MEMBER_PROJECTION_ADMITTED;
}

// ULG_THERMAL_ACTIVE_SOURCE_RANK_HELPERS_BEGIN
fn thermal_active_rank_mix(input_value: u32) -> u32 {
  var value = input_value;
  value = (value ^ (value >> 16u)) * 0x7feb352du;
  value = (value ^ (value >> 15u)) * 0x846ca68bu;
  return value ^ (value >> 16u);
}

fn thermal_active_rank_fold(seed: u32, value: u32) -> u32 {
  return thermal_active_rank_mix(seed ^ thermal_active_rank_mix(value));
}

fn thermal_active_rank_topology_fingerprint(record_index: u32) -> u32 {
  let base = THERMAL_AGGREGATE_HEADER_WORDS
    + record_index * THERMAL_AGGREGATE_RECORD_WORDS;
  var value = thermal_active_rank_fold(
    spatial_aggregate_view[62u],
    record_index
  );
  value = thermal_active_rank_fold(
    value,
    spatial_aggregate_view[base + THERMAL_AGGREGATE_RECORD_STATUS]
      & (2u | 4u | 8u)
  );
  for (var word = 28u; word <= 32u; word = word + 1u) {
    value = thermal_active_rank_fold(value, spatial_aggregate_view[base + word]);
  }
  for (var word = 36u; word <= 40u; word = word + 1u) {
    value = thermal_active_rank_fold(value, spatial_aggregate_view[base + word]);
  }
  value = thermal_active_rank_fold(
    value,
    spatial_aggregate_view[base + THERMAL_AGGREGATE_RECORD_BEGIN]
  );
  return thermal_active_rank_fold(
    value,
    spatial_aggregate_view[base + THERMAL_AGGREGATE_RECORD_END]
  );
}

fn thermal_active_source_rank_sidecar_word(active_ordinal: u32) -> u32 {
  return THERMAL_DERIVED_HEADER_WORDS
    + thermal_params.particle_count * THERMAL_DERIVED_ROW_WORDS
    + active_ordinal;
}

fn thermal_invalid_active_source_rank() -> ThermalActiveSourceRankLookup {
  return ThermalActiveSourceRankLookup(0u, 0u);
}

fn thermal_invalid_active_rank_view() -> ThermalActiveRankViewLookup {
  return ThermalActiveRankViewLookup(0u, 0u, 0u);
}

fn thermal_invalid_active_rank_view_range() -> ThermalActiveRankViewRange {
  return ThermalActiveRankViewRange(0u, 0u, 0u);
}

// The prevalidated flag is only true after this exact producer's full-P derive pass
// has replayed every rank/source-index membership and the compact-dispatch
// count seal.  The directory and active-rank view are immutable inputs to the
// following budget/proposal passes in the same command encoder, so the direct
// offsets are a checked-then-reused same-epoch receipt, not a weaker lookup.
fn thermal_active_rank_view_source_at_ordinal(
  active_ordinal: u32,
  prevalidated: bool
) -> ThermalActiveRankViewLookup {
  let rejected = thermal_invalid_active_rank_view();
  if (prevalidated) {
    let source_capacity = spatial_directory[17u];
    let prefix_offset = THERMAL_ACTIVE_RANK_VIEW_HEADER_WORDS;
    let active_ranks_offset = prefix_offset + source_capacity + 1u;
    let active_source_indices_offset = active_ranks_offset + source_capacity;
    return ThermalActiveRankViewLookup(
      spatial_aggregate_view[active_ranks_offset + active_ordinal],
      spatial_aggregate_view[active_source_indices_offset + active_ordinal],
      1u
    );
  }
  let expected_active_count = atomicLoad(
    &thermal_derived[THERMAL_EXPECTED_ACTIVE_MEMBER_COUNT_WORD]
  );
  let source_count = thermal_params.particle_count;
  let source_capacity = spatial_directory[17u];
  if (source_capacity > THERMAL_ACTIVE_RANK_VIEW_MAX_SOURCE_COUNT) {
    return rejected;
  }
  let prefix_offset = THERMAL_ACTIVE_RANK_VIEW_HEADER_WORDS;
  let active_ranks_offset = prefix_offset + source_capacity + 1u;
  let active_source_indices_offset = active_ranks_offset + source_capacity;
  let physical_capacity = active_source_indices_offset + source_capacity;
  if (
    physical_capacity > arrayLength(&spatial_aggregate_view)
    || active_ordinal >= expected_active_count
    || expected_active_count != spatial_aggregate_view[26u]
    || expected_active_count > source_count
  ) { return rejected; }
  let source_rank = spatial_aggregate_view[
    active_ranks_offset + active_ordinal
  ];
  let source_index = spatial_aggregate_view[
    active_source_indices_offset + active_ordinal
  ];
  if (
    source_rank >= source_count
    || source_index >= source_count
    || spatial_directory[31u] + source_rank >= arrayLength(&spatial_directory)
    || spatial_directory[spatial_directory[31u] + source_rank] != source_index
    || prefix_offset + source_rank + 1u >= arrayLength(&spatial_aggregate_view)
    || spatial_aggregate_view[prefix_offset + source_rank] != active_ordinal
    || spatial_aggregate_view[prefix_offset + source_rank + 1u]
      != active_ordinal + 1u
  ) { return rejected; }
  return ThermalActiveRankViewLookup(source_rank, source_index, 1u);
}

fn thermal_active_rank_view_cell_range(
  member_begin: u32,
  member_end: u32,
  prevalidated: bool
) -> ThermalActiveRankViewRange {
  let rejected = thermal_invalid_active_rank_view_range();
  if (prevalidated) {
    let source_capacity = spatial_directory[17u];
    let prefix_offset = THERMAL_ACTIVE_RANK_VIEW_HEADER_WORDS;
    return ThermalActiveRankViewRange(
      spatial_aggregate_view[prefix_offset + member_begin],
      spatial_aggregate_view[prefix_offset + member_end],
      1u
    );
  }
  let source_count = thermal_params.particle_count;
  let source_capacity = spatial_directory[17u];
  if (
    source_capacity > THERMAL_ACTIVE_RANK_VIEW_MAX_SOURCE_COUNT
    || member_begin > member_end
    || member_end > source_count
  ) { return rejected; }
  let prefix_offset = THERMAL_ACTIVE_RANK_VIEW_HEADER_WORDS;
  let active_ranks_offset = prefix_offset + source_capacity + 1u;
  let active_source_indices_offset = active_ranks_offset + source_capacity;
  let physical_capacity = active_source_indices_offset + source_capacity;
  if (
    physical_capacity > arrayLength(&spatial_aggregate_view)
    || prefix_offset + member_end >= arrayLength(&spatial_aggregate_view)
  ) { return rejected; }
  let begin = spatial_aggregate_view[prefix_offset + member_begin];
  let end = spatial_aggregate_view[prefix_offset + member_end];
  let active_count = atomicLoad(
    &thermal_derived[THERMAL_EXPECTED_ACTIVE_MEMBER_COUNT_WORD]
  );
  if (
    active_count != spatial_aggregate_view[26u]
    || begin > end
    || end > active_count
  ) { return rejected; }
  return ThermalActiveRankViewRange(begin, end, 1u);
}

fn thermal_active_source_rank_at_ordinal(
  active_ordinal: u32
) -> ThermalActiveSourceRankLookup {
  let expected_active_count = atomicLoad(
    &thermal_derived[THERMAL_EXPECTED_ACTIVE_MEMBER_COUNT_WORD]
  );
  let total_record_count = spatial_aggregate_view[54u];
  let leaf_count = spatial_aggregate_view[23u];
  let core_capacity_words = spatial_aggregate_view[31u];
  let root_record_index = spatial_aggregate_view[53u];
  var record_index = root_record_index;
  var remaining_ordinal = active_ordinal;
  if (
    active_ordinal >= expected_active_count
    || expected_active_count != spatial_aggregate_view[96u]
    || total_record_count == 0u
    || record_index >= total_record_count
  ) {
    return thermal_invalid_active_source_rank();
  }
  for (
    var iteration = 0u;
    iteration < total_record_count;
    iteration = iteration + 1u
  ) {
    if (record_index >= total_record_count) {
      return thermal_invalid_active_source_rank();
    }
    let record_base = THERMAL_AGGREGATE_HEADER_WORDS
      + record_index * THERMAL_AGGREGATE_RECORD_WORDS;
    if (
      record_base > core_capacity_words
      || THERMAL_AGGREGATE_RECORD_WORDS
        > core_capacity_words - record_base
    ) {
      return thermal_invalid_active_source_rank();
    }
    let record_status = spatial_aggregate_view[
      record_base + THERMAL_AGGREGATE_RECORD_STATUS
    ];
    let record_active_count = spatial_aggregate_view[
      record_base + THERMAL_AGGREGATE_RECORD_ACTIVE_COUNT
    ];
    let rank_begin = spatial_aggregate_view[record_base + 38u];
    let rank_end = spatial_aggregate_view[record_base + 39u];
    let source_member_count = spatial_aggregate_view[
      record_base + THERMAL_AGGREGATE_RECORD_SOURCE_COUNT
    ];
    let leaf_exact = (
      record_status & THERMAL_AGGREGATE_RECORD_LEAF_EXACT
    ) == THERMAL_AGGREGATE_RECORD_LEAF_EXACT;
    let internal_exact = (
      record_status & THERMAL_AGGREGATE_RECORD_INTERNAL_EXACT
    ) == THERMAL_AGGREGATE_RECORD_INTERNAL_EXACT
      && (record_status & 2u) == 0u;
    let root_status = (record_status & 8u) != 0u;
    if (
      remaining_ordinal >= record_active_count
      || leaf_exact == internal_exact
      || leaf_exact != (record_index < leaf_count)
      || root_status != (record_index == root_record_index)
      || rank_begin >= rank_end
      || rank_end > leaf_count
      || source_member_count == 0u
      || source_member_count > thermal_params.particle_count
      || record_active_count > source_member_count
      || spatial_aggregate_view[record_base + 41u]
        != thermal_active_rank_topology_fingerprint(record_index)
    ) {
      return thermal_invalid_active_source_rank();
    }
    if (
      record_index == root_record_index
      && (
        spatial_aggregate_view[record_base + THERMAL_AGGREGATE_RECORD_PARENT]
          != 0xffffffffu
        || spatial_aggregate_view[record_base + 37u] != 0xffffffffu
        || rank_begin != 0u
        || rank_end != leaf_count
        || source_member_count != thermal_params.particle_count
      )
    ) {
      return thermal_invalid_active_source_rank();
    }
    if (leaf_exact) {
      let cell_index = spatial_aggregate_view[
        record_base + THERMAL_AGGREGATE_RECORD_CELL
      ];
      let member_range = ss_exact_near_cell_member_range(
        conduction_expectation,
        cell_index
      );
      if (
        member_range.admitted == 0u
        || cell_index != record_index
        || rank_end != rank_begin + 1u
        || spatial_aggregate_view[
          record_base + THERMAL_AGGREGATE_RECORD_BEGIN
        ] != member_range.begin
        || spatial_aggregate_view[
          record_base + THERMAL_AGGREGATE_RECORD_END
        ] != member_range.end
        || source_member_count != member_range.end - member_range.begin
        || record_active_count > member_range.end - member_range.begin
      ) {
        return thermal_invalid_active_source_rank();
      }
      var observed_active_count = 0u;
      var selected_source_rank = 0xffffffffu;
      for (
        var source_rank = member_range.begin;
        source_rank < member_range.end;
        source_rank = source_rank + 1u
      ) {
        let source_lookup = ss_exact_near_source_at_member(
          conduction_expectation,
          source_rank
        );
        if (source_lookup.admitted == 0u) {
          return thermal_invalid_active_source_rank();
        }
        let source_index = source_lookup.source_index;
        let directory_pos_mass = directory_position_state[source_index * 2u];
        if (directory_pos_mass.w <= 0.0) { continue; }
        let projection_word = spatial_aggregate_view[94u]
          + member_range.begin + observed_active_count;
        if (
          observed_active_count >= record_active_count
          || projection_word >= spatial_aggregate_view[107u]
          || spatial_aggregate_view[projection_word] != source_index
        ) {
          return thermal_invalid_active_source_rank();
        }
        if (observed_active_count == remaining_ordinal) {
          selected_source_rank = source_rank;
        }
        observed_active_count = observed_active_count + 1u;
      }
      if (
        observed_active_count != record_active_count
        || selected_source_rank == 0xffffffffu
      ) {
        return thermal_invalid_active_source_rank();
      }
      return ThermalActiveSourceRankLookup(1u, selected_source_rank);
    }
    let left_record_index = spatial_aggregate_view[
      record_base + THERMAL_AGGREGATE_RECORD_BEGIN
    ];
    let right_record_index = spatial_aggregate_view[
      record_base + THERMAL_AGGREGATE_RECORD_END
    ];
    if (
      left_record_index >= total_record_count
      || right_record_index >= total_record_count
      || left_record_index == right_record_index
      || left_record_index == record_index
      || right_record_index == record_index
    ) {
      return thermal_invalid_active_source_rank();
    }
    let left_base = THERMAL_AGGREGATE_HEADER_WORDS
      + left_record_index * THERMAL_AGGREGATE_RECORD_WORDS;
    let right_base = THERMAL_AGGREGATE_HEADER_WORDS
      + right_record_index * THERMAL_AGGREGATE_RECORD_WORDS;
    if (
      left_base > core_capacity_words
      || THERMAL_AGGREGATE_RECORD_WORDS > core_capacity_words - left_base
      || right_base > core_capacity_words
      || THERMAL_AGGREGATE_RECORD_WORDS > core_capacity_words - right_base
      || spatial_aggregate_view[
        left_base + THERMAL_AGGREGATE_RECORD_PARENT
      ] != record_index
      || spatial_aggregate_view[
        right_base + THERMAL_AGGREGATE_RECORD_PARENT
      ] != record_index
    ) {
      return thermal_invalid_active_source_rank();
    }
    let left_active_count = spatial_aggregate_view[
      left_base + THERMAL_AGGREGATE_RECORD_ACTIVE_COUNT
    ];
    let right_active_count = spatial_aggregate_view[
      right_base + THERMAL_AGGREGATE_RECORD_ACTIVE_COUNT
    ];
    let left_source_count = spatial_aggregate_view[
      left_base + THERMAL_AGGREGATE_RECORD_SOURCE_COUNT
    ];
    let right_source_count = spatial_aggregate_view[
      right_base + THERMAL_AGGREGATE_RECORD_SOURCE_COUNT
    ];
    let left_rank_begin = spatial_aggregate_view[left_base + 38u];
    let left_rank_end = spatial_aggregate_view[left_base + 39u];
    let right_rank_begin = spatial_aggregate_view[right_base + 38u];
    let right_rank_end = spatial_aggregate_view[right_base + 39u];
    if (
      left_active_count > record_active_count
      || right_active_count != record_active_count - left_active_count
      || left_source_count > source_member_count
      || right_source_count != source_member_count - left_source_count
      || left_rank_begin != rank_begin
      || left_rank_end != right_rank_begin
      || right_rank_end != rank_end
    ) {
      return thermal_invalid_active_source_rank();
    }
    if (remaining_ordinal < left_active_count) {
      record_index = left_record_index;
    } else {
      remaining_ordinal = remaining_ordinal - left_active_count;
      record_index = right_record_index;
    }
  }
  return thermal_invalid_active_source_rank();
}
// ULG_THERMAL_ACTIVE_SOURCE_RANK_HELPERS_END

fn thermal_derived_value(particle_index: u32, component: u32) -> f32 {
  let offset = THERMAL_DERIVED_HEADER_WORDS
    + particle_index * THERMAL_DERIVED_ROW_WORDS + component;
  return bitcast<f32>(atomicLoad(&thermal_derived[offset]));
}

fn thermal_pow4(value: f32) -> f32 {
  let squared = value * value;
  return squared * squared;
}

fn thermal_radiative_view_area_m2(
  radius_m: f32,
  other_radius_m: f32,
  distance_m: f32
) -> f32 {
  if (radius_m <= 0.0 || other_radius_m <= 0.0) { return 0.0; }
  let distance_squared = max(distance_m * distance_m, 1.0e-12);
  let geometric = 3.14159265359 * radius_m * radius_m
    * (other_radius_m * other_radius_m) / (4.0 * distance_squared);
  let contact_limit = 3.14159265359
    * min(radius_m, other_radius_m) * min(radius_m, other_radius_m);
  return min(geometric, contact_limit);
}

fn thermal_clamp_pair_energy(
  energy_j: f32,
  temperature_k: f32,
  other_temperature_k: f32,
  temperature_slope: f32,
  other_temperature_slope: f32,
  mass_kg: f32,
  other_mass_kg: f32
) -> f32 {
  if (energy_j == 0.0) { return 0.0; }
  let gap_k = other_temperature_k - temperature_k;
  if (gap_k == 0.0 || sign(energy_j) != sign(gap_k)) { return energy_j; }
  let response_per_j = temperature_slope / max(mass_kg, 1.0e-30)
    + other_temperature_slope / max(other_mass_kg, 1.0e-30);
  if (response_per_j <= 0.0) { return energy_j; }
  let equalizing_energy_j = abs(gap_k) / response_per_j;
  return sign(energy_j) * min(
    abs(energy_j),
    equalizing_energy_j * THERMAL_PAIR_RELAXATION_LIMIT
  );
}

fn thermal_mark_invalid(is_conduction: bool) {
  let header_index = select(7u, 6u, is_conduction);
  atomicAdd(&thermal_proposals[header_index], 1u);
}

fn thermal_increment_local(counter: ptr<function, u32>) -> bool {
  if (*counter == 0xffffffffu) { return false; }
  *counter = *counter + 1u;
  return true;
}

fn thermal_add_local(counter: ptr<function, u32>, count: u32) -> bool {
  if (*counter > 0xffffffffu - count) { return false; }
  *counter = *counter + count;
  return true;
}

fn thermal_evidence_add(index: u32, count: u32, is_conduction: bool) -> u32 {
  if (is_conduction) {
    return atomicAdd(&conduction_evidence[index], count);
  }
  return atomicAdd(&radiation_evidence[index], count);
}

fn thermal_flush_evidence(index: u32, count: u32, is_conduction: bool) -> bool {
  if (count == 0u) { return true; }
  let previous = thermal_evidence_add(index, count, is_conduction);
  return previous <= 0xffffffffu - count;
}

fn thermal_publish_proposal_row(row_offset: u32, row: vec4<f32>) {
  atomicStore(&thermal_proposals[row_offset], bitcast<u32>(row.x));
  atomicStore(&thermal_proposals[row_offset + 1u], bitcast<u32>(row.y));
  atomicStore(&thermal_proposals[row_offset + 2u], bitcast<u32>(row.z));
  atomicStore(&thermal_proposals[row_offset + 3u], bitcast<u32>(row.w));
  atomicAdd(&thermal_proposals[15u], 1u);
  thermal_evidence_add(6u, 1u, true);
  thermal_evidence_add(6u, 1u, false);
}

fn thermal_visit_fused_pair(
  budget_mode: bool,
  self_index: u32,
  other_index: u32,
  self_position: vec3<f32>,
  self_mass: f32,
  self_temperature: f32,
  self_temperature_slope: f32,
  self_radius_m: f32,
  self_emissivity: f32,
  self_gain_scale: f32,
  self_loss_scale: f32,
  requested_gain_j: ptr<function, f32>,
  requested_loss_j: ptr<function, f32>,
  conduction_specific_energy_delta: ptr<function, f32>,
  radiation_specific_energy_delta: ptr<function, f32>,
  neighbor_min_temperature: ptr<function, f32>,
  neighbor_max_temperature: ptr<function, f32>,
  conduction_candidate_visit_count: ptr<function, u32>,
  radiation_candidate_visit_count: ptr<function, u32>,
  conduction_mask_hit_count: ptr<function, u32>,
  radiation_mask_hit_count: ptr<function, u32>,
  local_count_overflow: ptr<function, bool>
) -> u32 {
  // Keep self out of the terminal skipped-member count: the law returns
  // before it increments either candidate counter, whereas every other
  // no-op candidate is represented by exactly one terminal count.
  if (other_index == self_index) {
    return THERMAL_PAIR_VISIT_OUTCOME_SELF;
  }
  // Exact traversal validates its peer before calling here. Preserve a raw
  // replay for a defensive out-of-range call rather than coalescing a state
  // that could otherwise turn a malformed receipt into a sealed one.
  if (other_index >= thermal_params.particle_count) {
    return THERMAL_PAIR_VISIT_OUTCOME_REPLAY;
  }
  let conduction_count_ready = thermal_increment_local(
    conduction_candidate_visit_count
  );
  let radiation_count_ready = thermal_increment_local(
    radiation_candidate_visit_count
  );
  if (!conduction_count_ready || !radiation_count_ready) {
    *local_count_overflow = true;
    return THERMAL_PAIR_VISIT_OUTCOME_REPLAY;
  }
  let other_pos_mass = source_state[other_index * 2u];
  if (other_pos_mass.w <= 0.0) {
    return THERMAL_PAIR_VISIT_OUTCOME_NO_REPLAY;
  }
  let other_temperature = thermal_derived_value(other_index, 0u);
  let other_temperature_slope = thermal_derived_value(other_index, 1u);
  let other_radius_m = thermal_derived_value(other_index, 2u);
  let pair_radii_m = self_radius_m + other_radius_m;
  let pair_delta_m = self_position - other_pos_mass.xyz;
  let distance_squared_m2 = dot(pair_delta_m, pair_delta_m);
  let conduction_support_m = max(
    2.0 * thermal_params.smoothing_length_m,
    pair_radii_m
  );
  let radiation_support_m = thermal_params.radiation_pair_range_radii
    * pair_radii_m;
  // Preserve malformed/non-finite paths as raw peers. They are rare and the
  // direct law's result is the authority; only the ordinary finite no-op
  // paths below may be terminal-accounted by the bounded CSR receipt.
  if (!ss_exact_near_finite(distance_squared_m2)) {
    return THERMAL_PAIR_VISIT_OUTCOME_REPLAY;
  }
  // Preserve the original sqrt comparisons near either support boundary, but
  // reject the overwhelmingly common distant candidate with a conservative
  // squared shell. The margin dominates f32 multiply/rounding error, so a pair
  // that either original support test could admit always reaches that test.
  let maximum_support_m = max(conduction_support_m, radiation_support_m);
  let maximum_support_squared_m2 = maximum_support_m * maximum_support_m;
  if (
    ss_exact_near_finite(maximum_support_squared_m2)
    && distance_squared_m2
      > maximum_support_squared_m2 * 1.000003814697265625
  ) {
    return THERMAL_PAIR_VISIT_OUTCOME_NO_REPLAY;
  }
  let distance_m = sqrt(max(distance_squared_m2, 0.0));
  let conduction_hit = distance_m < conduction_support_m;
  let radiation_hit = distance_m < radiation_support_m;
  if (!conduction_hit && !radiation_hit) {
    return THERMAL_PAIR_VISIT_OUTCOME_NO_REPLAY;
  }
  *neighbor_min_temperature = min(*neighbor_min_temperature, other_temperature);
  *neighbor_max_temperature = max(*neighbor_max_temperature, other_temperature);
  var conduction_energy_j = 0.0;
  var radiation_energy_j = 0.0;
  if (conduction_hit) {
    let weight = 1.0 - distance_m / conduction_support_m;
    let raw_energy_j = thermal_params.conduction_rate
      * (other_temperature - self_temperature) * weight * thermal_params.dt_s;
    conduction_energy_j = thermal_clamp_pair_energy(
      raw_energy_j,
      self_temperature,
      other_temperature,
      self_temperature_slope,
      other_temperature_slope,
      self_mass,
      other_pos_mass.w
    );
    if (!thermal_increment_local(conduction_mask_hit_count)) {
      *local_count_overflow = true;
    }
  }
  if (radiation_hit) {
    if (!thermal_increment_local(radiation_mask_hit_count)) {
      *local_count_overflow = true;
    }
  }
  if (radiation_hit && self_emissivity > 0.0) {
    let other_emissivity = thermal_derived_value(other_index, 3u);
    if (other_emissivity > 0.0) {
      let view_area_m2 = thermal_radiative_view_area_m2(
        self_radius_m,
        other_radius_m,
        distance_m
      );
      let raw_energy_j = self_emissivity * other_emissivity
        * thermal_params.stefan_boltzmann_w_per_m2_k4
        * (thermal_pow4(other_temperature) - thermal_pow4(self_temperature))
        * view_area_m2 * thermal_params.dt_s;
      radiation_energy_j = thermal_clamp_pair_energy(
        raw_energy_j,
        self_temperature,
        other_temperature,
        self_temperature_slope,
        other_temperature_slope,
        self_mass,
        other_pos_mass.w
      );
    }
  }
  if (budget_mode) {
    *requested_gain_j = *requested_gain_j
      + max(conduction_energy_j, 0.0) + max(radiation_energy_j, 0.0);
    *requested_loss_j = *requested_loss_j
      + max(-conduction_energy_j, 0.0) + max(-radiation_energy_j, 0.0);
    return THERMAL_PAIR_VISIT_OUTCOME_REPLAY;
  }
  let other_gain_scale = thermal_derived_value(other_index, 4u);
  let other_loss_scale = thermal_derived_value(other_index, 5u);
  if (
    !ss_exact_near_finite(other_gain_scale)
    || !ss_exact_near_finite(other_loss_scale)
    || other_gain_scale < 0.0 || other_gain_scale > 1.0
    || other_loss_scale < 0.0 || other_loss_scale > 1.0
  ) {
    *local_count_overflow = true;
    return THERMAL_PAIR_VISIT_OUTCOME_REPLAY;
  }
  if (conduction_energy_j > 0.0) {
    conduction_energy_j = conduction_energy_j
      * min(self_gain_scale, other_loss_scale);
  } else if (conduction_energy_j < 0.0) {
    conduction_energy_j = conduction_energy_j
      * min(self_loss_scale, other_gain_scale);
  }
  if (radiation_energy_j > 0.0) {
    radiation_energy_j = radiation_energy_j
      * min(self_gain_scale, other_loss_scale);
  } else if (radiation_energy_j < 0.0) {
    radiation_energy_j = radiation_energy_j
      * min(self_loss_scale, other_gain_scale);
  }
  *conduction_specific_energy_delta = *conduction_specific_energy_delta
    + conduction_energy_j / self_mass;
  *radiation_specific_energy_delta = *radiation_specific_energy_delta
    + radiation_energy_j / self_mass;
  return THERMAL_PAIR_VISIT_OUTCOME_REPLAY;
}

${thermalCandidateCsrHelpersWgsl}

fn thermal_traverse_particle(
  particle_index: u32,
  budget_mode: bool,
  lookup_mode: u32,
  active_rank_prevalidated: bool
) {
  thermal_evidence_add(0u, 1u, true);
  thermal_evidence_add(0u, 1u, false);
  let exact_near_lookup = lookup_mode == 0u;
  let binned_lookup = lookup_mode == 1u && thermal_params.lookup_mode == 1u;
  var conduction_admitted = binned_lookup || (
    exact_near_lookup
    && conduction_expectation.support_profile_id
      == thermal_params.conduction_support_profile_id
    && ss_exact_near_directory_admitted(conduction_expectation)
  );
  var radiation_admitted = binned_lookup || (
    exact_near_lookup
    && radiation_expectation.support_profile_id
      == thermal_params.radiation_support_profile_id
    && ss_exact_near_directory_admitted(radiation_expectation)
  );
  let active_projection_admitted = !exact_near_lookup
    || thermal_active_member_projection_admitted();
  conduction_admitted = conduction_admitted && active_projection_admitted;
  radiation_admitted = radiation_admitted && active_projection_admitted;
${thermalCandidateCsrAdmissionWgsl}
  if (!conduction_admitted) { thermal_evidence_add(2u, 1u, true); }
  if (!radiation_admitted) { thermal_evidence_add(2u, 1u, false); }
  if (!conduction_admitted || !radiation_admitted) {
    thermal_mark_invalid(true);
    thermal_mark_invalid(false);
    return;
  }
  let use_prevalidated_active_rank = active_rank_prevalidated
    && thermal_params.active_member_projection_enabled
      == THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_ACTIVE_RANK;
  if (atomicLoad(&thermal_derived[1u]) != 0u) {
    thermal_evidence_add(5u, 1u, true);
    thermal_evidence_add(5u, 1u, false);
    thermal_mark_invalid(true);
    thermal_mark_invalid(false);
    return;
  }
  thermal_evidence_add(1u, 1u, true);
  thermal_evidence_add(1u, 1u, false);
  let self_pos_mass = source_state[particle_index * 2u];
  let self_vel_u = source_state[particle_index * 2u + 1u];
  let self_temperature = thermal_derived_value(particle_index, 0u);
  let row_offset = THERMAL_PROPOSAL_HEADER_WORDS
    + particle_index * THERMAL_PROPOSAL_ROW_WORDS;
  let derived_row_offset = THERMAL_DERIVED_HEADER_WORDS
    + particle_index * THERMAL_DERIVED_ROW_WORDS;
  if (self_pos_mass.w <= 0.0) {
    if (budget_mode) {
      atomicStore(&thermal_derived[derived_row_offset + 4u], 0u);
      atomicStore(&thermal_derived[derived_row_offset + 5u], 0u);
      atomicStore(&thermal_derived[derived_row_offset + 6u], 0u);
      atomicStore(&thermal_derived[derived_row_offset + 7u], 0u);
    } else {
      thermal_publish_proposal_row(row_offset, vec4<f32>(0.0));
    }
    return;
  }
  let self_mass = max(self_pos_mass.w, 1.0e-30);
  let self_temperature_slope = thermal_derived_value(particle_index, 1u);
  let self_radius_m = thermal_derived_value(particle_index, 2u);
  let self_emissivity = thermal_derived_value(particle_index, 3u);
  var self_gain_scale = 1.0;
  var self_loss_scale = 1.0;
  if (!budget_mode) {
    self_gain_scale = thermal_derived_value(particle_index, 4u);
    self_loss_scale = thermal_derived_value(particle_index, 5u);
    if (
      !ss_exact_near_finite(self_gain_scale)
      || !ss_exact_near_finite(self_loss_scale)
      || self_gain_scale < 0.0 || self_gain_scale > 1.0
      || self_loss_scale < 0.0 || self_loss_scale > 1.0
    ) {
      thermal_evidence_add(7u, 1u, true);
      thermal_evidence_add(7u, 1u, false);
      thermal_mark_invalid(true);
      thermal_mark_invalid(false);
      return;
    }
  }
  let global_max_temperature_bits = atomicLoad(&thermal_derived[2u]);
  let global_min_temperature_bits = ~atomicLoad(&thermal_derived[3u]);
  if (global_max_temperature_bits == global_min_temperature_bits) {
    if (budget_mode) {
      atomicStore(&thermal_derived[derived_row_offset + 4u], 0u);
      atomicStore(&thermal_derived[derived_row_offset + 5u], 0u);
      atomicStore(&thermal_derived[derived_row_offset + 6u], global_min_temperature_bits);
      atomicStore(&thermal_derived[derived_row_offset + 7u], global_max_temperature_bits);
    } else {
      thermal_publish_proposal_row(
        row_offset,
        vec4<f32>(
          0.0,
          0.0,
          bitcast<f32>(atomicLoad(&thermal_derived[derived_row_offset + 6u])),
          bitcast<f32>(atomicLoad(&thermal_derived[derived_row_offset + 7u]))
        )
      );
    }
    return;
  }
  let global_max_radius_m = bitcast<f32>(atomicLoad(&thermal_derived[0u]));
  let conduction_query_radius_m = max(
    2.0 * thermal_params.smoothing_length_m,
    self_radius_m + global_max_radius_m
  );
  let radiation_query_radius_m = thermal_params.radiation_pair_range_radii
    * (self_radius_m + global_max_radius_m);
  let query_radius_m = max(conduction_query_radius_m, radiation_query_radius_m);
  let max_position_displacement_m = bitcast<f32>(
    atomicLoad(&thermal_derived[4u])
  );
  let directory_query_radius_m = query_radius_m
    + 2.0 * max_position_displacement_m;
  if (
    !ss_exact_near_finite(query_radius_m)
    || query_radius_m <= 0.0
    || !ss_exact_near_finite(max_position_displacement_m)
    || max_position_displacement_m < 0.0
    || !ss_exact_near_finite(directory_query_radius_m)
  ) {
    thermal_evidence_add(5u, 1u, true);
    thermal_evidence_add(5u, 1u, false);
    thermal_mark_invalid(true);
    thermal_mark_invalid(false);
    return;
  }
  var conduction_specific_energy_delta = 0.0;
  var radiation_specific_energy_delta = 0.0;
  var requested_gain_j = 0.0;
  var requested_loss_j = 0.0;
  var neighbor_min_temperature = self_temperature;
  var neighbor_max_temperature = self_temperature;
  var conduction_candidate_visit_count = 0u;
  var radiation_candidate_visit_count = 0u;
  var conduction_mask_hit_count = 0u;
  var radiation_mask_hit_count = 0u;
  var local_count_overflow = false;
  var malformed = false;
${thermalCandidateCsrTraversalPreludeWgsl}
${thermalCandidateCsrRoutePreludeWgsl}
  if (binned_lookup) {
    let bins_length = arrayLength(&spatial_directory);
    let total_cells = thermal_params.bin_cell_count;
    let bin_capacity = thermal_params.bin_capacity;
    let dimensions_ready = thermal_params.bin_nx > 0u
      && thermal_params.bin_ny > 0u
      && thermal_params.bin_nz > 0u
      && thermal_params.bin_nx <= 0xffffffffu / thermal_params.bin_ny
      && thermal_params.bin_nx * thermal_params.bin_ny
        <= 0xffffffffu / thermal_params.bin_nz
      && thermal_params.bin_nx * thermal_params.bin_ny
        * thermal_params.bin_nz == total_cells;
    let storage_ready = dimensions_ready
      && total_cells > 0u
      && bin_capacity > 0u
      && total_cells <= bins_length
      && bin_capacity <= (bins_length - total_cells) / total_cells;
    let raw_scan_radius = ceil(
      query_radius_m / max(thermal_params.bin_cell_size_m, 1.0e-9)
    );
    var use_exhaustive_fallback = !storage_ready
      || !ss_exact_near_finite(thermal_params.bin_cell_size_m)
      || thermal_params.bin_cell_size_m <= 0.0
      || !ss_exact_near_finite(raw_scan_radius)
      || raw_scan_radius < 0.0
      || raw_scan_radius > f32(thermal_params.max_bin_scan_radius_cells);
    var scan_radius = 0i;
    var center = vec3<i32>(0i);
    if (!use_exhaustive_fallback) {
      scan_radius = i32(raw_scan_radius);
      let inv_cell = 1.0 / thermal_params.bin_cell_size_m;
      center = vec3<i32>(
        i32(clamp(
          u32(max(self_pos_mass.x, 0.0) * inv_cell),
          0u,
          thermal_params.bin_nx - 1u
        )),
        i32(clamp(
          u32(max(self_pos_mass.y, 0.0) * inv_cell),
          0u,
          thermal_params.bin_ny - 1u
        )),
        i32(clamp(
          u32(max(self_pos_mass.z, 0.0) * inv_cell),
          0u,
          thermal_params.bin_nz - 1u
        ))
      );
      // Preflight every candidate cell before accumulating pair budgets. If
      // any fixed-capacity cell overflowed, restarting this particle with the
      // deterministic exhaustive enumerator avoids a partial/double gather.
      for (var oz = -scan_radius; oz <= scan_radius; oz = oz + 1i) {
        let nz = center.z + oz;
        if (nz < 0i || nz >= i32(thermal_params.bin_nz)) { continue; }
        for (var oy = -scan_radius; oy <= scan_radius; oy = oy + 1i) {
          let ny = center.y + oy;
          if (ny < 0i || ny >= i32(thermal_params.bin_ny)) { continue; }
          for (var ox = -scan_radius; ox <= scan_radius; ox = ox + 1i) {
            let nx = center.x + ox;
            if (nx < 0i || nx >= i32(thermal_params.bin_nx)) { continue; }
            let cell = (u32(nz) * thermal_params.bin_ny + u32(ny))
              * thermal_params.bin_nx + u32(nx);
            if (spatial_directory[cell] > bin_capacity) {
              use_exhaustive_fallback = true;
            }
          }
        }
      }
    }
    if (use_exhaustive_fallback) {
      // Evidence word 15 counts particle-pass fallbacks. It stays resident so
      // the hot path remains readback-free while diagnostics can sample it.
      thermal_evidence_add(15u, 1u, true);
      thermal_evidence_add(15u, 1u, false);
      for (
        var other_index = 0u;
        other_index < thermal_params.particle_count;
        other_index = other_index + 1u
      ) {
        thermal_visit_fused_pair(
          budget_mode,
          particle_index,
          other_index,
          self_pos_mass.xyz,
          self_mass,
          self_temperature,
          self_temperature_slope,
          self_radius_m,
          self_emissivity,
          self_gain_scale,
          self_loss_scale,
          &requested_gain_j,
          &requested_loss_j,
          &conduction_specific_energy_delta,
          &radiation_specific_energy_delta,
          &neighbor_min_temperature,
          &neighbor_max_temperature,
          &conduction_candidate_visit_count,
          &radiation_candidate_visit_count,
          &conduction_mask_hit_count,
          &radiation_mask_hit_count,
          &local_count_overflow
        );
      }
    } else {
      for (var oz = -scan_radius; oz <= scan_radius; oz = oz + 1i) {
        let nz = center.z + oz;
        if (nz < 0i || nz >= i32(thermal_params.bin_nz)) { continue; }
        for (var oy = -scan_radius; oy <= scan_radius; oy = oy + 1i) {
          let ny = center.y + oy;
          if (ny < 0i || ny >= i32(thermal_params.bin_ny)) { continue; }
          for (var ox = -scan_radius; ox <= scan_radius; ox = ox + 1i) {
            let nx = center.x + ox;
            if (nx < 0i || nx >= i32(thermal_params.bin_nx)) { continue; }
            let cell = (u32(nz) * thermal_params.bin_ny + u32(ny))
              * thermal_params.bin_nx + u32(nx);
            let admitted_count = min(spatial_directory[cell], bin_capacity);
            for (var slot = 0u; slot < admitted_count; slot = slot + 1u) {
              let other_index = spatial_directory[
                total_cells + cell * bin_capacity + slot
              ];
              thermal_visit_fused_pair(
                budget_mode,
                particle_index,
                other_index,
                self_pos_mass.xyz,
                self_mass,
                self_temperature,
                self_temperature_slope,
                self_radius_m,
                self_emissivity,
                self_gain_scale,
                self_loss_scale,
                &requested_gain_j,
                &requested_loss_j,
                &conduction_specific_energy_delta,
                &radiation_specific_energy_delta,
                &neighbor_min_temperature,
                &neighbor_max_temperature,
                &conduction_candidate_visit_count,
                &radiation_candidate_visit_count,
                &conduction_mask_hit_count,
                &radiation_mask_hit_count,
                &local_count_overflow
              );
            }
          }
        }
      }
    }
  } else {
${thermalCandidateCsrExactTraversalPrefixWgsl}  for (
    var level_ordinal = 0u;
    level_ordinal < conduction_expectation.level_count;
    level_ordinal = level_ordinal + 1u
  ) {
    if (!ss_exact_near_level_occupied(conduction_expectation, level_ordinal)) {
      continue;
    }
    let level = conduction_expectation.min_level + i32(level_ordinal);
    let spacing_m = conduction_expectation.base_grid_spacing_m * exp2(f32(level));
    if (!ss_exact_near_finite(spacing_m) || spacing_m <= 0.0) {
      malformed = true;
      break;
    }
    let directory_pos_mass = directory_position_state[particle_index * 2u];
    let center_cell = vec3<i32>(floor(directory_pos_mass.xyz / spacing_m));
    let radius_cells = max(
      0,
      i32(min(ceil(directory_query_radius_m / spacing_m) + 1.0, 2147483520.0))
    );
    let minimum_cell = vec3<i32>(
      ss_exact_near_saturating_sub_radius(center_cell.x, radius_cells),
      ss_exact_near_saturating_sub_radius(center_cell.y, radius_cells),
      ss_exact_near_saturating_sub_radius(center_cell.z, radius_cells)
    );
    let maximum_cell = vec3<i32>(
      ss_exact_near_saturating_add_radius(center_cell.x, radius_cells),
      ss_exact_near_saturating_add_radius(center_cell.y, radius_cells),
      ss_exact_near_saturating_add_radius(center_cell.z, radius_cells)
    );
    let level_order = ss_exact_near_signed_order_key(level);
    let minimum_order = vec3<u32>(
      ss_exact_near_signed_order_key(minimum_cell.x),
      ss_exact_near_signed_order_key(minimum_cell.y),
      ss_exact_near_signed_order_key(minimum_cell.z)
    );
    let maximum_order = vec3<u32>(
      ss_exact_near_signed_order_key(maximum_cell.x),
      ss_exact_near_signed_order_key(maximum_cell.y),
      ss_exact_near_signed_order_key(maximum_cell.z)
    );
    let level_begin = ss_exact_near_lower_bound_cell_key(
      conduction_expectation,
      conduction_expectation.chart_id,
      level_order,
      vec3<u32>(0u)
    );
    let level_end = ss_exact_near_upper_bound_cell_key(
      conduction_expectation,
      conduction_expectation.chart_id,
      level_order,
      vec3<u32>(0xffffffffu)
    );
    var x_cursor = ss_exact_near_lower_bound_cell_key_range(
      conduction_expectation,
      conduction_expectation.chart_id,
      level_order,
      vec3<u32>(minimum_order.x, 0u, 0u),
      level_begin,
      level_end
    );
    for (
      var x_iteration = 0u;
      x_iteration < conduction_expectation.source_count && x_cursor < level_end;
      x_iteration = x_iteration + 1u
    ) {
      let x_order = ss_exact_near_cell_key_word(conduction_expectation, x_cursor, 2u);
      if (x_order > maximum_order.x) {
        x_cursor = level_end;
        continue;
      }
      let x_end = ss_exact_near_upper_bound_cell_key_range(
        conduction_expectation,
        conduction_expectation.chart_id,
        level_order,
        vec3<u32>(x_order, 0xffffffffu, 0xffffffffu),
        x_cursor,
        level_end
      );
      if (x_end <= x_cursor) { malformed = true; break; }
      var y_cursor = ss_exact_near_lower_bound_cell_key_range(
        conduction_expectation,
        conduction_expectation.chart_id,
        level_order,
        vec3<u32>(x_order, minimum_order.y, 0u),
        x_cursor,
        x_end
      );
      for (
        var y_iteration = 0u;
        y_iteration < conduction_expectation.source_count && y_cursor < x_end;
        y_iteration = y_iteration + 1u
      ) {
        let y_order = ss_exact_near_cell_key_word(conduction_expectation, y_cursor, 3u);
        if (y_order > maximum_order.y) {
          y_cursor = x_end;
          continue;
        }
        let y_end = ss_exact_near_upper_bound_cell_key_range(
          conduction_expectation,
          conduction_expectation.chart_id,
          level_order,
          vec3<u32>(x_order, y_order, 0xffffffffu),
          y_cursor,
          x_end
        );
        if (y_end <= y_cursor) { malformed = true; break; }
        let z_begin = ss_exact_near_lower_bound_cell_key_range(
          conduction_expectation,
          conduction_expectation.chart_id,
          level_order,
          vec3<u32>(x_order, y_order, minimum_order.z),
          y_cursor,
          y_end
        );
        let z_end = ss_exact_near_upper_bound_cell_key_range(
          conduction_expectation,
          conduction_expectation.chart_id,
          level_order,
          vec3<u32>(x_order, y_order, maximum_order.z),
          z_begin,
          y_end
        );
        for (
          var cell_index = z_begin;
          cell_index < z_end;
          cell_index = cell_index + 1u
        ) {
          let member_range = ss_exact_near_cell_member_range(
            conduction_expectation,
            cell_index
          );
          if (member_range.admitted == 0u) { malformed = true; break; }
          let source_member_count = member_range.end - member_range.begin;
          var visited_member_count = source_member_count;
          var active_ordinal_begin = 0u;
          if (
            thermal_params.active_member_projection_enabled
              == THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_AGGREGATE
          ) {
            let record_base = THERMAL_AGGREGATE_HEADER_WORDS
              + cell_index * THERMAL_AGGREGATE_RECORD_WORDS;
            if (
              record_base + THERMAL_AGGREGATE_RECORD_SOURCE_COUNT
                >= spatial_aggregate_view[31u]
              || (
                spatial_aggregate_view[record_base + THERMAL_AGGREGATE_RECORD_STATUS]
                  & THERMAL_AGGREGATE_RECORD_LEAF_EXACT
              ) != THERMAL_AGGREGATE_RECORD_LEAF_EXACT
              || spatial_aggregate_view[record_base + THERMAL_AGGREGATE_RECORD_BEGIN]
                != member_range.begin
              || spatial_aggregate_view[record_base + THERMAL_AGGREGATE_RECORD_END]
                != member_range.end
              || spatial_aggregate_view[
                record_base + THERMAL_AGGREGATE_RECORD_SOURCE_COUNT
              ] != source_member_count
            ) {
              malformed = true;
              break;
            }
            visited_member_count = spatial_aggregate_view[
              record_base + THERMAL_AGGREGATE_RECORD_ACTIVE_COUNT
            ];
            if (visited_member_count > source_member_count) {
              malformed = true;
              break;
            }
            let skipped_dormant_count = source_member_count
              - visited_member_count;
            if (
              !thermal_add_local(
                &conduction_candidate_visit_count,
                skipped_dormant_count
              )
              || !thermal_add_local(
                &radiation_candidate_visit_count,
                skipped_dormant_count
              )
            ) {
              local_count_overflow = true;
              malformed = true;
              break;
            }
${thermalCandidateCsrSkippedMemberWgsl}
          } else if (
            thermal_params.active_member_projection_enabled
              == THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_ACTIVE_RANK
          ) {
            let active_range = thermal_active_rank_view_cell_range(
              member_range.begin,
              member_range.end,
              use_prevalidated_active_rank
            );
            if (active_range.admitted == 0u) {
              malformed = true;
              break;
            }
            active_ordinal_begin = active_range.begin;
            visited_member_count = active_range.end - active_range.begin;
            if (visited_member_count > source_member_count) {
              malformed = true;
              break;
            }
            let skipped_dormant_count = source_member_count
              - visited_member_count;
            if (
              !thermal_add_local(
                &conduction_candidate_visit_count,
                skipped_dormant_count
              )
              || !thermal_add_local(
                &radiation_candidate_visit_count,
                skipped_dormant_count
              )
            ) {
              local_count_overflow = true;
              malformed = true;
              break;
            }
${thermalCandidateCsrSkippedMemberWgsl}
          }
          for (
            var member_ordinal = 0u;
            member_ordinal < visited_member_count;
            member_ordinal = member_ordinal + 1u
          ) {
            var other_index = 0xffffffffu;
            if (
              thermal_params.active_member_projection_enabled
                == THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_AGGREGATE
            ) {
              let projection_word = spatial_aggregate_view[94u]
                + member_range.begin + member_ordinal;
              if (projection_word >= spatial_aggregate_view[107u]) {
                malformed = true;
                break;
              }
              other_index = spatial_aggregate_view[projection_word];
            } else if (
              thermal_params.active_member_projection_enabled
                == THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_ACTIVE_RANK
            ) {
              let active_lookup = thermal_active_rank_view_source_at_ordinal(
                active_ordinal_begin + member_ordinal,
                use_prevalidated_active_rank
              );
              if (
                active_lookup.admitted == 0u
                || active_lookup.source_rank < member_range.begin
                || active_lookup.source_rank >= member_range.end
              ) {
                malformed = true;
                break;
              }
              other_index = active_lookup.source_index;
            } else {
              let source_rank = member_range.begin + member_ordinal;
              let lookup = ss_exact_near_source_at_member(
                conduction_expectation,
                source_rank
              );
              if (lookup.admitted == 0u) { malformed = true; break; }
              other_index = lookup.source_index;
            }
            if (other_index >= thermal_params.particle_count) {
              malformed = true;
              break;
            }
            let thermal_pair_visit_outcome = thermal_visit_fused_pair(
              budget_mode,
              particle_index,
              other_index,
              self_pos_mass.xyz,
              self_mass,
              self_temperature,
              self_temperature_slope,
              self_radius_m,
              self_emissivity,
              self_gain_scale,
              self_loss_scale,
              &requested_gain_j,
              &requested_loss_j,
              &conduction_specific_energy_delta,
              &radiation_specific_energy_delta,
              &neighbor_min_temperature,
              &neighbor_max_temperature,
              &conduction_candidate_visit_count,
              &radiation_candidate_visit_count,
              &conduction_mask_hit_count,
              &radiation_mask_hit_count,
              &local_count_overflow
            );
${thermalCandidateCsrCaptureCandidateWgsl}
          }
          if (malformed) { break; }
        }
        if (malformed) { break; }
        y_cursor = y_end;
      }
      if (malformed || y_cursor < x_end) { malformed = true; break; }
      x_cursor = x_end;
    }
    if (malformed || x_cursor < level_end) { malformed = true; break; }
  }
${thermalCandidateCsrFinalizeCaptureWgsl}${thermalCandidateCsrExactTraversalSuffixWgsl}  }
  let conduction_candidate_count_admitted = thermal_flush_evidence(
    3u, conduction_candidate_visit_count, true
  );
  let radiation_candidate_count_admitted = thermal_flush_evidence(
    3u, radiation_candidate_visit_count, false
  );
  let conduction_mask_hit_count_admitted = thermal_flush_evidence(
    4u, conduction_mask_hit_count, true
  );
  let radiation_mask_hit_count_admitted = thermal_flush_evidence(
    4u, radiation_mask_hit_count, false
  );
  if (
    local_count_overflow
    || !conduction_candidate_count_admitted
    || !radiation_candidate_count_admitted
    || !conduction_mask_hit_count_admitted
    || !radiation_mask_hit_count_admitted
  ) {
    malformed = true;
  }
  if (malformed) {
    thermal_evidence_add(5u, 1u, true);
    thermal_evidence_add(5u, 1u, false);
    thermal_mark_invalid(true);
    thermal_mark_invalid(false);
    return;
  }
  if (
    !ss_exact_near_finite(requested_gain_j)
    || requested_gain_j < 0.0
    || !ss_exact_near_finite(requested_loss_j)
    || requested_loss_j < 0.0
    || !ss_exact_near_finite(conduction_specific_energy_delta)
    || !ss_exact_near_finite(radiation_specific_energy_delta)
    || !ss_exact_near_finite(neighbor_min_temperature)
    || !ss_exact_near_finite(neighbor_max_temperature)
  ) {
    thermal_evidence_add(7u, 1u, true);
    thermal_evidence_add(7u, 1u, false);
    thermal_mark_invalid(true);
    thermal_mark_invalid(false);
    return;
  }
  if (budget_mode) {
    atomicStore(
      &thermal_derived[derived_row_offset + 4u],
      bitcast<u32>(requested_gain_j)
    );
    atomicStore(
      &thermal_derived[derived_row_offset + 5u],
      bitcast<u32>(requested_loss_j)
    );
    atomicStore(
      &thermal_derived[derived_row_offset + 6u],
      bitcast<u32>(neighbor_min_temperature)
    );
    atomicStore(
      &thermal_derived[derived_row_offset + 7u],
      bitcast<u32>(neighbor_max_temperature)
    );
    return;
  }
  let energy_lo = thermal_derived_value(particle_index, 6u);
  let energy_hi = thermal_derived_value(particle_index, 7u);
  let next_u = self_vel_u.w
    + conduction_specific_energy_delta + radiation_specific_energy_delta;
  if (
    !ss_exact_near_finite(energy_lo)
    || !ss_exact_near_finite(energy_hi)
    || energy_hi < energy_lo
    || !ss_exact_near_finite(next_u)
    || next_u < energy_lo
    || next_u > energy_hi
  ) {
    thermal_evidence_add(7u, 1u, true);
    thermal_evidence_add(7u, 1u, false);
    thermal_mark_invalid(true);
    thermal_mark_invalid(false);
    return;
  }
  thermal_publish_proposal_row(
    row_offset,
    vec4<f32>(
      conduction_specific_energy_delta,
      radiation_specific_energy_delta,
      energy_lo,
      energy_hi
    )
  );
}

${spatialThermalExactEntryPointsWgsl}

@compute @workgroup_size(64)
fn budget_binned(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (global_id.x >= thermal_params.particle_count) { return; }
  thermal_traverse_particle(global_id.x, true, 1u, false);
}

@compute @workgroup_size(64)
fn propose_binned(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (global_id.x >= thermal_params.particle_count) { return; }
  thermal_traverse_particle(global_id.x, false, 1u, false);
}
`;

// S9D-4 native evidence needs to exercise the real matched-time thermal
// producer and canonical apply before the exact-cell hierarchy can become a
// second production consumer.  The shader below is therefore constructed only
// by the explicit native-test arming hook later in this module.  It is not a
// runtime traversal selector, URL feature, or fallback path.
export const SCHROEDER_SPATIAL_THERMAL_TREE_SHADOW_DIAGNOSTIC_WORDS = 6;

const thermalExactCellTreeTraversalWgsl =
  createSchroederSpatialExactNearCellTreeTraversalV1Wgsl({
    treeBindingName: 'exact_near_cell_tree',
    directoryBindingName: 'spatial_directory'
  });

function singleWgslSection(source, startNeedle, endNeedle, label) {
  const start = source.indexOf(startNeedle);
  const secondStart = source.indexOf(startNeedle, start + startNeedle.length);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  if (start < 0 || secondStart >= 0 || end < 0 || end <= start) {
    throw new Error(`Unable to isolate native thermal tree shadow ${label}`);
  }
  return { start, end };
}

function createThermalTreeShadowTraversalWgsl({
  memberTraversalWgsl,
  observeTraversalCounters
}) {
  const counterDeclarations = observeTraversalCounters
    ? /* wgsl */ `
  var tree_node_visit_count = 0u;
  var tree_leaf_visit_count = 0u;
  var tree_member_visit_count = 0u;`
    : '';
  const nodeCounter = observeTraversalCounters
    ? /* wgsl */ `
    if (!thermal_add_local(&tree_node_visit_count, 1u)) {
      local_count_overflow = true;
      malformed = true;
      break;
    }`
    : '';
  const leafCounter = observeTraversalCounters
    ? /* wgsl */ `
      if (!thermal_add_local(&tree_leaf_visit_count, 1u)) {
        local_count_overflow = true;
        malformed = true;
        break;
      }`
    : '';
  const memberCounter = observeTraversalCounters
    ? /* wgsl */ `
          if (!thermal_add_local(
            &tree_member_visit_count,
            member_range.end - member_range.begin
          )) {
            local_count_overflow = true;
            malformed = true;
            break;
          }`
    : '';
  const counterFlush = observeTraversalCounters
    ? /* wgsl */ `
  let tree_diagnostic_base = select(3u, 0u, budget_mode);
  if (
    !thermal_tree_shadow_flush(
      tree_diagnostic_base,
      tree_node_visit_count
    )
    || !thermal_tree_shadow_flush(
      tree_diagnostic_base + 1u,
      tree_leaf_visit_count
    )
    || !thermal_tree_shadow_flush(
      tree_diagnostic_base + 2u,
      tree_member_visit_count
    )
  ) {
    local_count_overflow = true;
    malformed = true;
  }`
    : '';

  return /* wgsl */ `  let tree_leaf_capacity = exact_near_cell_tree[20u];
  let tree_node_capacity = exact_near_cell_tree[21u];
  let tree_depth = exact_near_cell_tree[23u];
  let tree_cell_count = exact_near_cell_tree[18u];
  let maximum_level_order = ss_exact_near_signed_order_key(
    conduction_expectation.min_level
  ) + conduction_expectation.level_count - 1u;
  let maximum_level = bitcast<i32>(maximum_level_order ^ 0x80000000u);
  let maximum_level_spacing_m = conduction_expectation.base_grid_spacing_m
    * exp2(f32(maximum_level));
  let directory_pos_mass = directory_position_state[particle_index * 2u];
  let tree_query_margin_m = directory_query_radius_m
    + maximum_level_spacing_m;
  if (
    tree_node_capacity == 0u
    || tree_cell_count == 0u
    || !ss_exact_near_finite(maximum_level_spacing_m)
    || maximum_level_spacing_m <= 0.0
    || !ss_exact_near_finite(tree_query_margin_m)
    || tree_query_margin_m <= 0.0
  ) {
    malformed = true;
  }
  let tree_query_minimum = directory_pos_mass.xyz
    - vec3<f32>(tree_query_margin_m);
  let tree_query_maximum = directory_pos_mass.xyz
    + vec3<f32>(tree_query_margin_m);
  var tree_stack: array<u32, 32>;
  var tree_stack_size = 0u;
  if (!malformed) {
    tree_stack[0] = 0u;
    tree_stack_size = 1u;
  }${counterDeclarations}
  for (
    var tree_iteration = 0u;
    tree_iteration < tree_node_capacity && tree_stack_size > 0u;
    tree_iteration = tree_iteration + 1u
  ) {
    tree_stack_size = tree_stack_size - 1u;
    let tree_node_index = tree_stack[tree_stack_size];${nodeCounter}
    let tree_node_base = ss_exact_cell_tree_node_base(tree_node_index);
    let tree_node_status = exact_near_cell_tree[tree_node_base + 6u];
    let tree_level_index = tree_node_index + 1u;
    let tree_node_depth = 31u - countLeadingZeros(tree_level_index);
    let tree_level_start = (1u << tree_node_depth) - 1u;
    let tree_leaves_per_node = tree_leaf_capacity >> tree_node_depth;
    let tree_first_leaf = (
      tree_node_index - tree_level_start
    ) * tree_leaves_per_node;
    let tree_node_expected_live = tree_first_leaf < tree_cell_count;
    if (!tree_node_expected_live) {
      if (tree_node_status != 0u) {
        malformed = true;
        break;
      }
      continue;
    }
    let tree_node_expected_leaf = tree_node_depth == tree_depth;
    let tree_node_expected_kind = select(
      SS_EXACT_CELL_TREE_NODE_VALID
        | SS_EXACT_CELL_TREE_NODE_INTERNAL,
      SS_EXACT_CELL_TREE_NODE_VALID
        | SS_EXACT_CELL_TREE_NODE_LEAF,
      tree_node_expected_leaf
    );
    let tree_node_payload = exact_near_cell_tree[tree_node_base + 7u];
    let tree_node_minimum = vec3<f32>(
      bitcast<f32>(exact_near_cell_tree[tree_node_base]),
      bitcast<f32>(exact_near_cell_tree[tree_node_base + 1u]),
      bitcast<f32>(exact_near_cell_tree[tree_node_base + 2u])
    );
    let tree_node_maximum = vec3<f32>(
      bitcast<f32>(exact_near_cell_tree[tree_node_base + 3u]),
      bitcast<f32>(exact_near_cell_tree[tree_node_base + 4u]),
      bitcast<f32>(exact_near_cell_tree[tree_node_base + 5u])
    );
    if (
      tree_node_status != tree_node_expected_kind
      || (
        tree_node_expected_leaf
          && tree_node_payload != tree_first_leaf
      )
      || (
        !tree_node_expected_leaf
          && tree_node_payload != SS_EXACT_CELL_TREE_INVALID_U32
      )
      || !ss_exact_near_finite(tree_node_minimum.x)
      || !ss_exact_near_finite(tree_node_minimum.y)
      || !ss_exact_near_finite(tree_node_minimum.z)
      || !ss_exact_near_finite(tree_node_maximum.x)
      || !ss_exact_near_finite(tree_node_maximum.y)
      || !ss_exact_near_finite(tree_node_maximum.z)
      || any(tree_node_minimum > tree_node_maximum)
    ) {
      malformed = true;
      break;
    }
    if (!ss_exact_cell_tree_node_intersects(
      tree_node_index,
      tree_query_minimum,
      tree_query_maximum
    )) {
      continue;
    }
    if (ss_exact_cell_tree_node_is_leaf(tree_node_index)) {${leafCounter}
      let cell_index = ss_exact_cell_tree_leaf_cell_index(tree_node_index);
      let cell_chart = ss_exact_near_cell_key_word(
        conduction_expectation,
        cell_index,
        0u
      );
      let cell_level_order = ss_exact_near_cell_key_word(
        conduction_expectation,
        cell_index,
        1u
      );
      let minimum_level_order = ss_exact_near_signed_order_key(
        conduction_expectation.min_level
      );
      if (
        cell_chart != conduction_expectation.chart_id
        || cell_level_order < minimum_level_order
        || cell_level_order - minimum_level_order
          >= conduction_expectation.level_count
      ) {
        continue;
      }
      let level_ordinal = cell_level_order - minimum_level_order;
      if (!ss_exact_near_level_occupied(
        conduction_expectation,
        level_ordinal
      )) {
        continue;
      }
      let level = bitcast<i32>(cell_level_order ^ 0x80000000u);
      let spacing_m = conduction_expectation.base_grid_spacing_m
        * exp2(f32(level));
      if (!ss_exact_near_finite(spacing_m) || spacing_m <= 0.0) {
        malformed = true;
        break;
      }
      let center_cell = vec3<i32>(floor(directory_pos_mass.xyz / spacing_m));
      let radius_cells = max(
        0,
        i32(min(
          ceil(directory_query_radius_m / spacing_m) + 1.0,
          2147483520.0
        ))
      );
      let minimum_cell = vec3<i32>(
        ss_exact_near_saturating_sub_radius(center_cell.x, radius_cells),
        ss_exact_near_saturating_sub_radius(center_cell.y, radius_cells),
        ss_exact_near_saturating_sub_radius(center_cell.z, radius_cells)
      );
      let maximum_cell = vec3<i32>(
        ss_exact_near_saturating_add_radius(center_cell.x, radius_cells),
        ss_exact_near_saturating_add_radius(center_cell.y, radius_cells),
        ss_exact_near_saturating_add_radius(center_cell.z, radius_cells)
      );
      let minimum_order = vec3<u32>(
        ss_exact_near_signed_order_key(minimum_cell.x),
        ss_exact_near_signed_order_key(minimum_cell.y),
        ss_exact_near_signed_order_key(minimum_cell.z)
      );
      let maximum_order = vec3<u32>(
        ss_exact_near_signed_order_key(maximum_cell.x),
        ss_exact_near_signed_order_key(maximum_cell.y),
        ss_exact_near_signed_order_key(maximum_cell.z)
      );
      let cell_order = vec3<u32>(
        ss_exact_near_cell_key_word(
          conduction_expectation,
          cell_index,
          2u
        ),
        ss_exact_near_cell_key_word(
          conduction_expectation,
          cell_index,
          3u
        ),
        ss_exact_near_cell_key_word(
          conduction_expectation,
          cell_index,
          4u
        )
      );
      if (
        any(cell_order < minimum_order)
        || any(cell_order > maximum_order)
      ) {
        continue;
      }
${memberTraversalWgsl}${memberCounter}
    } else if (ss_exact_cell_tree_node_is_internal(tree_node_index)) {
      if (
        tree_node_index > (0xffffffffu - 2u) / 2u
        || tree_stack_size > 30u
      ) {
        malformed = true;
        break;
      }
      let left_child = tree_node_index * 2u + 1u;
      let right_child = left_child + 1u;
      if (right_child >= tree_node_capacity) {
        malformed = true;
        break;
      }
      // Right first makes the LIFO traversal visit canonical left leaves in
      // ascending directory-cell order, preserving f32 accumulation order.
      tree_stack[tree_stack_size] = right_child;
      tree_stack_size = tree_stack_size + 1u;
      tree_stack[tree_stack_size] = left_child;
      tree_stack_size = tree_stack_size + 1u;
    } else {
      malformed = true;
      break;
    }
  }
  if (tree_stack_size != 0u) {
    malformed = true;
  }${counterFlush}
`;
}

export function createSchroederSpatialThermalTreeShadowWgslForNativeTest({
  observeTraversalCounters = true
} = {}) {
  let source = schroederSpatialThermalProposalWgsl;
  const memberStartNeedle =
    '          let member_range = ss_exact_near_cell_member_range(';
  const memberEndNeedle = `          if (malformed) { break; }
        }
        if (malformed) { break; }
        y_cursor = y_end;`;
  const memberSection = singleWgslSection(
    source,
    memberStartNeedle,
    memberEndNeedle,
    'canonical member traversal'
  );
  const memberTraversalWgsl = source.slice(
    memberSection.start,
    memberSection.end
      + '          if (malformed) { break; }\n'.length
  );
  const directoryStartNeedle = `  for (
    var level_ordinal = 0u;
    level_ordinal < conduction_expectation.level_count;`;
  const directoryEndNeedle =
    '  // ULG_THERMAL_CANDIDATE_CSR_FINALIZE_CAPTURE_BEGIN';
  const directorySection = singleWgslSection(
    source,
    directoryStartNeedle,
    directoryEndNeedle,
    'direct directory traversal'
  );
  const treeTraversal = createThermalTreeShadowTraversalWgsl({
    memberTraversalWgsl,
    observeTraversalCounters
  });
  source = source.slice(0, directorySection.start)
    + treeTraversal
    + source.slice(directorySection.end);

  const unusedBinding =
    '@group(0) @binding(12) var<storage, read_write> thermal_csr_unused: array<atomic<u32>>;';
  if (!source.includes(unusedBinding)) {
    throw new Error('Unable to bind the native thermal tree shadow');
  }
  source = source.replace(
    unusedBinding,
    '@group(0) @binding(12) var<storage, read> exact_near_cell_tree: array<u32>;'
  );
  if (observeTraversalCounters) {
    const binding13 =
      '@group(0) @binding(13) var<storage, read_write> thermal_csr_control_and_peers: array<atomic<u32>>;';
    source = source.replace(
      binding13,
      `${binding13}
@group(0) @binding(14) var<storage, read_write> thermal_tree_shadow_diagnostics: array<atomic<u32>>;`
    );
  }

  const constantsNeedle = 'const THERMAL_PROPOSAL_HEADER_WORDS: u32 = ';
  const constantsOffset = source.indexOf(constantsNeedle);
  if (constantsOffset < 0) {
    throw new Error('Unable to install native thermal tree traversal helpers');
  }
  const diagnosticHelpers = observeTraversalCounters
    ? /* wgsl */ `
fn thermal_tree_shadow_flush(word: u32, count: u32) -> bool {
  if (count == 0u) { return true; }
  let previous = atomicAdd(&thermal_tree_shadow_diagnostics[word], count);
  return previous <= 0xffffffffu - count;
}
`
    : '';
  source = source.slice(0, constantsOffset)
    + thermalExactCellTreeTraversalWgsl
    + diagnosticHelpers
    + source.slice(constantsOffset);

  for (const expectationName of [
    'conduction_expectation',
    'radiation_expectation'
  ]) {
    const directoryAdmission =
      `&& ss_exact_near_directory_admitted(${expectationName})`;
    if (!source.includes(directoryAdmission)) {
      throw new Error(
        `Unable to strengthen native thermal tree admission for ${expectationName}`
      );
    }
    source = source.replaceAll(
      directoryAdmission,
      `${directoryAdmission}
    && ss_exact_cell_tree_admitted(${expectationName})`
    );
  }
  return source;
}

export function createSchroederSpatialThermalExhaustiveShadowWgslForNativeTest() {
  let source = schroederSpatialThermalProposalWgsl;
  const directoryStartNeedle = `  for (
    var level_ordinal = 0u;
    level_ordinal < conduction_expectation.level_count;`;
  const directoryEndNeedle =
    '  // ULG_THERMAL_CANDIDATE_CSR_FINALIZE_CAPTURE_BEGIN';
  const directorySection = singleWgslSection(
    source,
    directoryStartNeedle,
    directoryEndNeedle,
    'direct directory traversal for exhaustive control'
  );
  const exhaustiveTraversal = /* wgsl */ `  // Native-test-only independent
  // control: stream every particle index without consulting cell keys,
  // member ranks, particle-to-cell mappings, or a spatial query envelope.
  // The unchanged exact pair predicate and CSR capture remain authoritative.
  for (
    var other_index = 0u;
    other_index < thermal_params.particle_count;
    other_index = other_index + 1u
  ) {
    let thermal_pair_visit_outcome = thermal_visit_fused_pair(
      budget_mode,
      particle_index,
      other_index,
      self_pos_mass.xyz,
      self_mass,
      self_temperature,
      self_temperature_slope,
      self_radius_m,
      self_emissivity,
      self_gain_scale,
      self_loss_scale,
      &requested_gain_j,
      &requested_loss_j,
      &conduction_specific_energy_delta,
      &radiation_specific_energy_delta,
      &neighbor_min_temperature,
      &neighbor_max_temperature,
      &conduction_candidate_visit_count,
      &radiation_candidate_visit_count,
      &conduction_mask_hit_count,
      &radiation_mask_hit_count,
      &local_count_overflow
    );
${thermalCandidateCsrCaptureCandidateWgsl}
  }
`;
  source = source.slice(0, directorySection.start)
    + exhaustiveTraversal
    + source.slice(directorySection.end);
  return source;
}

const classicThermalExactNearExpectationPreludeWgsl = /* wgsl */ `
struct SchroederSpatialExactNearExpectationV1 {
  source_count: u32,
  derivation_enabled: u32,
  support_profile_id: u32,
  chart_id: u32,
  level_count: u32,
  expected_generation_id: u32,
  expected_device_ordinal: u32,
  expected_lane_ordinal: u32,
  expected_lease_token: u32,
  expected_source_family_id: u32,
  expected_storage_generation: u32,
  expected_physics_tick: u32,
  expected_physics_substep: u32,
  expected_position_epoch: u32,
  expected_topology_epoch: u32,
  expected_chart_epoch: u32,
  expected_level_epoch: u32,
  expected_support_epoch: u32,
  min_level: i32,
  base_grid_spacing_m: f32,
  expected_cell_keys_offset_words: u32,
  expected_cell_offsets_offset_words: u32,
  expected_cell_members_offset_words: u32,
  expected_particle_to_cell_offset_words: u32,
  expected_directory_capacity_words: u32,
  expected_source_capacity: u32,
  expected_cell_capacity: u32,
};

fn ss_exact_near_finite(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823466e+38;
}
`;

function createClassicThermalProposalWgsl() {
  const expectationBindings = `@group(0) @binding(6) var<uniform> conduction_expectation: SchroederSpatialExactNearExpectationV1;
@group(0) @binding(7) var<uniform> radiation_expectation: SchroederSpatialExactNearExpectationV1;
`;
  const admissionBlock = `  let exact_near_lookup = lookup_mode == 0u;
  let binned_lookup = lookup_mode == 1u && thermal_params.lookup_mode == 1u;
  var conduction_admitted = binned_lookup || (
    exact_near_lookup
    && conduction_expectation.support_profile_id
      == thermal_params.conduction_support_profile_id
    && ss_exact_near_directory_admitted(conduction_expectation)
  );
  var radiation_admitted = binned_lookup || (
    exact_near_lookup
    && radiation_expectation.support_profile_id
      == thermal_params.radiation_support_profile_id
    && ss_exact_near_directory_admitted(radiation_expectation)
  );
  let active_projection_admitted = !exact_near_lookup
    || thermal_active_member_projection_admitted();
  conduction_admitted = conduction_admitted && active_projection_admitted;
  radiation_admitted = radiation_admitted && active_projection_admitted;`;
  const traversalStart = `  if (binned_lookup) {
    let bins_length = arrayLength(&spatial_directory);`;
  const traversalEnd = `  }
  let conduction_candidate_count_admitted`;
  if (
    !schroederSpatialThermalProposalWgsl.includes(exactNearTraversalWgsl)
    || !schroederSpatialThermalProposalWgsl.includes(expectationBindings)
    || !schroederSpatialThermalProposalWgsl.includes(admissionBlock)
    || !schroederSpatialThermalProposalWgsl.includes(traversalStart)
    || !schroederSpatialThermalProposalWgsl.includes(traversalEnd)
  ) {
    throw new Error('Classic thermal proposal WGSL source markers drifted');
  }
  let source = stripThermalCandidateCsrWgsl(schroederSpatialThermalProposalWgsl)
    .replace(exactNearTraversalWgsl, classicThermalExactNearExpectationPreludeWgsl)
    .replace(
      spatialThermalExactEntryPointsWgsl,
      classicThermalExactEntryPointsWgsl
    )
    .replace(admissionBlock, `  let exact_near_lookup = false;
  var conduction_admitted = true;
  var radiation_admitted = true;`);
  const activeRankHelpersStart = source.indexOf(
    '// ULG_THERMAL_ACTIVE_SOURCE_RANK_HELPERS_BEGIN'
  );
  const activeRankHelpersEndMarker =
    '// ULG_THERMAL_ACTIVE_SOURCE_RANK_HELPERS_END';
  const activeRankHelpersEnd = source.indexOf(
    activeRankHelpersEndMarker,
    activeRankHelpersStart
  );
  if (activeRankHelpersStart < 0 || activeRankHelpersEnd < 0) {
    throw new Error('Classic thermal active-rank helper markers drifted');
  }
  source = `${source.slice(0, activeRankHelpersStart)}${source.slice(
    activeRankHelpersEnd + activeRankHelpersEndMarker.length
  )}`;
  const start = source.indexOf(traversalStart);
  const end = source.indexOf(traversalEnd, start + traversalStart.length);
  if (start < 0 || end < 0) {
    throw new Error('Classic thermal proposal WGSL traversal markers drifted');
  }
  source = `${source.slice(0, start)}  thermal_evidence_add(15u, 1u, true);
  thermal_evidence_add(15u, 1u, false);
  for (
    var other_index = 0u;
    other_index < thermal_params.particle_count;
    other_index = other_index + 1u
  ) {
    thermal_visit_fused_pair(
      budget_mode,
      particle_index,
      other_index,
      self_pos_mass.xyz,
      self_mass,
      self_temperature,
      self_temperature_slope,
      self_radius_m,
      self_emissivity,
      self_gain_scale,
      self_loss_scale,
      &requested_gain_j,
      &requested_loss_j,
      &conduction_specific_energy_delta,
      &radiation_specific_energy_delta,
      &neighbor_min_temperature,
      &neighbor_max_temperature,
      &conduction_candidate_visit_count,
      &radiation_candidate_visit_count,
      &conduction_mask_hit_count,
      &radiation_mask_hit_count,
      &local_count_overflow
    );
  }
${
    source.slice(end + '  }\n'.length)
  }`;
  return source;
}

export const classicThermalProposalWgsl = createClassicThermalProposalWgsl();

function createClassicThermalBinnedProposalWgsl() {
  const expectationBindings = `@group(0) @binding(6) var<uniform> conduction_expectation: SchroederSpatialExactNearExpectationV1;
@group(0) @binding(7) var<uniform> radiation_expectation: SchroederSpatialExactNearExpectationV1;
`;
  const admissionBlock = `  let exact_near_lookup = lookup_mode == 0u;
  let binned_lookup = lookup_mode == 1u && thermal_params.lookup_mode == 1u;
  var conduction_admitted = binned_lookup || (
    exact_near_lookup
    && conduction_expectation.support_profile_id
      == thermal_params.conduction_support_profile_id
    && ss_exact_near_directory_admitted(conduction_expectation)
  );
  var radiation_admitted = binned_lookup || (
    exact_near_lookup
    && radiation_expectation.support_profile_id
      == thermal_params.radiation_support_profile_id
    && ss_exact_near_directory_admitted(radiation_expectation)
  );
  let active_projection_admitted = !exact_near_lookup
    || thermal_active_member_projection_admitted();
  conduction_admitted = conduction_admitted && active_projection_admitted;
  radiation_admitted = radiation_admitted && active_projection_admitted;`;
  const traversalPrefix = `  if (binned_lookup) {\n`;
  const exactTraversalBranch = `  } else {\n  for (\n    var level_ordinal = 0u;`;
  const traversalEnd = `  }\n  let conduction_candidate_count_admitted`;
  if (
    !schroederSpatialThermalProposalWgsl.includes(exactNearTraversalWgsl)
    || !schroederSpatialThermalProposalWgsl.includes(expectationBindings)
    || !schroederSpatialThermalProposalWgsl.includes(admissionBlock)
    || !schroederSpatialThermalProposalWgsl.includes(traversalPrefix)
    || !schroederSpatialThermalProposalWgsl.includes(exactTraversalBranch)
    || !schroederSpatialThermalProposalWgsl.includes(traversalEnd)
    || !schroederSpatialThermalProposalWgsl.includes(
      spatialThermalExactEntryPointsWgsl
    )
  ) {
    throw new Error('Classic binned thermal proposal WGSL source markers drifted');
  }
  let source = stripThermalCandidateCsrWgsl(schroederSpatialThermalProposalWgsl)
    .replace(exactNearTraversalWgsl, classicThermalExactNearExpectationPreludeWgsl)
    .replace(admissionBlock, `  let exact_near_lookup = false;
  let binned_lookup = lookup_mode == 1u
    && thermal_params.lookup_mode == 1u;
  var conduction_admitted = binned_lookup;
    var radiation_admitted = binned_lookup;`)
    .replace(spatialThermalExactEntryPointsWgsl, '');
  const activeRankHelpersStart = source.indexOf(
    '// ULG_THERMAL_ACTIVE_SOURCE_RANK_HELPERS_BEGIN'
  );
  const activeRankHelpersEndMarker =
    '// ULG_THERMAL_ACTIVE_SOURCE_RANK_HELPERS_END';
  const activeRankHelpersEnd = source.indexOf(
    activeRankHelpersEndMarker,
    activeRankHelpersStart
  );
  if (activeRankHelpersStart < 0 || activeRankHelpersEnd < 0) {
    throw new Error('Classic binned thermal active-rank helper markers drifted');
  }
  source = `${source.slice(0, activeRankHelpersStart)}${source.slice(
    activeRankHelpersEnd + activeRankHelpersEndMarker.length
  )}`;
  const traversalStart = source.indexOf(traversalPrefix);
  const exactBranchStart = source.indexOf(
    exactTraversalBranch,
    traversalStart + traversalPrefix.length
  );
  const traversalEndStart = source.indexOf(
    traversalEnd,
    exactBranchStart + exactTraversalBranch.length
  );
  if (
    traversalStart < 0
    || exactBranchStart < 0
    || traversalEndStart < 0
  ) {
    throw new Error('Classic binned thermal traversal markers drifted');
  }
  const binnedTraversal = source.slice(
    traversalStart + traversalPrefix.length,
    exactBranchStart
  );
  source = `${source.slice(0, traversalStart)}${binnedTraversal}${
    source.slice(traversalEndStart + '  }\n'.length)
  }`;
  const nestedPreflight = `      for (var oz = -scan_radius; oz <= scan_radius; oz = oz + 1i) {
        let nz = center.z + oz;
        if (nz < 0i || nz >= i32(thermal_params.bin_nz)) { continue; }
        for (var oy = -scan_radius; oy <= scan_radius; oy = oy + 1i) {
          let ny = center.y + oy;
          if (ny < 0i || ny >= i32(thermal_params.bin_ny)) { continue; }
          for (var ox = -scan_radius; ox <= scan_radius; ox = ox + 1i) {
            let nx = center.x + ox;
            if (nx < 0i || nx >= i32(thermal_params.bin_nx)) { continue; }
            let cell = (u32(nz) * thermal_params.bin_ny + u32(ny))
              * thermal_params.bin_nx + u32(nx);
            if (spatial_directory[cell] > bin_capacity) {
              use_exhaustive_fallback = true;
            }
          }
        }
      }`;
  const flattenedPreflight = `      let scan_width = u32(scan_radius * 2i + 1i);
      let scan_plane = scan_width * scan_width;
      let scan_cell_count = scan_plane * scan_width;
      for (var ordinal = 0u; ordinal < scan_cell_count; ordinal = ordinal + 1u) {
        let ox = i32(ordinal % scan_width) - scan_radius;
        let oy = i32((ordinal / scan_width) % scan_width) - scan_radius;
        let oz = i32(ordinal / scan_plane) - scan_radius;
        let nz = center.z + oz;
        if (nz < 0i || nz >= i32(thermal_params.bin_nz)) { continue; }
        let ny = center.y + oy;
        if (ny < 0i || ny >= i32(thermal_params.bin_ny)) { continue; }
        let nx = center.x + ox;
        if (nx < 0i || nx >= i32(thermal_params.bin_nx)) { continue; }
        let cell = (u32(nz) * thermal_params.bin_ny + u32(ny))
          * thermal_params.bin_nx + u32(nx);
        if (spatial_directory[cell] > bin_capacity) {
          use_exhaustive_fallback = true;
        }
      }`;
  const nestedGather = `      for (var oz = -scan_radius; oz <= scan_radius; oz = oz + 1i) {
        let nz = center.z + oz;
        if (nz < 0i || nz >= i32(thermal_params.bin_nz)) { continue; }
        for (var oy = -scan_radius; oy <= scan_radius; oy = oy + 1i) {
          let ny = center.y + oy;
          if (ny < 0i || ny >= i32(thermal_params.bin_ny)) { continue; }
          for (var ox = -scan_radius; ox <= scan_radius; ox = ox + 1i) {
            let nx = center.x + ox;
            if (nx < 0i || nx >= i32(thermal_params.bin_nx)) { continue; }
            let cell = (u32(nz) * thermal_params.bin_ny + u32(ny))
              * thermal_params.bin_nx + u32(nx);
            let admitted_count = min(spatial_directory[cell], bin_capacity);
            for (var slot = 0u; slot < admitted_count; slot = slot + 1u) {
              let other_index = spatial_directory[
                total_cells + cell * bin_capacity + slot
              ];
              thermal_visit_fused_pair(
                budget_mode,
                particle_index,
                other_index,
                self_pos_mass.xyz,
                self_mass,
                self_temperature,
                self_temperature_slope,
                self_radius_m,
                self_emissivity,
                self_gain_scale,
                self_loss_scale,
                &requested_gain_j,
                &requested_loss_j,
                &conduction_specific_energy_delta,
                &radiation_specific_energy_delta,
                &neighbor_min_temperature,
                &neighbor_max_temperature,
                &conduction_candidate_visit_count,
                &radiation_candidate_visit_count,
                &conduction_mask_hit_count,
                &radiation_mask_hit_count,
                &local_count_overflow
              );
            }
          }
        }
      }`;
  const flattenedGather = `      let scan_width = u32(scan_radius * 2i + 1i);
      let scan_plane = scan_width * scan_width;
      let scan_cell_count = scan_plane * scan_width;
      for (var ordinal = 0u; ordinal < scan_cell_count; ordinal = ordinal + 1u) {
        let ox = i32(ordinal % scan_width) - scan_radius;
        let oy = i32((ordinal / scan_width) % scan_width) - scan_radius;
        let oz = i32(ordinal / scan_plane) - scan_radius;
        let nz = center.z + oz;
        if (nz < 0i || nz >= i32(thermal_params.bin_nz)) { continue; }
        let ny = center.y + oy;
        if (ny < 0i || ny >= i32(thermal_params.bin_ny)) { continue; }
        let nx = center.x + ox;
        if (nx < 0i || nx >= i32(thermal_params.bin_nx)) { continue; }
        let cell = (u32(nz) * thermal_params.bin_ny + u32(ny))
          * thermal_params.bin_nx + u32(nx);
        let admitted_count = min(spatial_directory[cell], bin_capacity);
        for (var slot = 0u; slot < admitted_count; slot = slot + 1u) {
          let other_index = spatial_directory[
            total_cells + cell * bin_capacity + slot
          ];
          thermal_visit_fused_pair(
            budget_mode,
            particle_index,
            other_index,
            self_pos_mass.xyz,
            self_mass,
            self_temperature,
            self_temperature_slope,
            self_radius_m,
            self_emissivity,
            self_gain_scale,
            self_loss_scale,
            &requested_gain_j,
            &requested_loss_j,
            &conduction_specific_energy_delta,
            &radiation_specific_energy_delta,
            &neighbor_min_temperature,
            &neighbor_max_temperature,
            &conduction_candidate_visit_count,
            &radiation_candidate_visit_count,
            &conduction_mask_hit_count,
            &radiation_mask_hit_count,
            &local_count_overflow
          );
        }
      }`;
  if (!source.includes(nestedPreflight) || !source.includes(nestedGather)) {
    throw new Error('Classic binned thermal loop markers drifted');
  }
  source = source
    .replace(nestedPreflight, flattenedPreflight)
    .replace(nestedGather, flattenedGather);
  const compactTraversalStart = source.indexOf(
    '    let bins_length = arrayLength(&spatial_directory);'
  );
  const compactTraversalEnd = source.indexOf(
    '  let conduction_candidate_count_admitted',
    compactTraversalStart
  );
  if (compactTraversalStart < 0 || compactTraversalEnd < 0) {
    throw new Error('Classic compact binned traversal markers drifted');
  }
  const compactTraversal = `  let bins_length = arrayLength(&spatial_directory);
  let total_cells = thermal_params.bin_cell_count;
  let bin_capacity = thermal_params.bin_capacity;
  let dimensions_ready = thermal_params.bin_nx > 0u
    && thermal_params.bin_ny > 0u
    && thermal_params.bin_nz > 0u
    && thermal_params.bin_nx <= 0xffffffffu / thermal_params.bin_ny
    && thermal_params.bin_nx * thermal_params.bin_ny
      <= 0xffffffffu / thermal_params.bin_nz
    && thermal_params.bin_nx * thermal_params.bin_ny
      * thermal_params.bin_nz == total_cells;
  let storage_ready = dimensions_ready
    && total_cells > 0u
    && bin_capacity > 0u
    && total_cells <= bins_length
    && bin_capacity <= (bins_length - total_cells) / total_cells;
  let raw_scan_radius = ceil(
    query_radius_m / max(thermal_params.bin_cell_size_m, 1.0e-9)
  );
  var use_exhaustive_fallback = !storage_ready
    || !ss_exact_near_finite(thermal_params.bin_cell_size_m)
    || thermal_params.bin_cell_size_m <= 0.0
    || !ss_exact_near_finite(raw_scan_radius)
    || raw_scan_radius < 0.0
    || raw_scan_radius > f32(thermal_params.max_bin_scan_radius_cells);
  var scan_radius = 0i;
  var scan_width = 1u;
  var scan_plane = 1u;
  var scan_cell_count = 1u;
  var center = vec3<i32>(0i);
  if (!use_exhaustive_fallback) {
    scan_radius = i32(raw_scan_radius);
    scan_width = u32(scan_radius * 2i + 1i);
    scan_plane = scan_width * scan_width;
    scan_cell_count = scan_plane * scan_width;
    let inv_cell = 1.0 / thermal_params.bin_cell_size_m;
    center = vec3<i32>(
      i32(clamp(
        u32(max(self_pos_mass.x, 0.0) * inv_cell),
        0u,
        thermal_params.bin_nx - 1u
      )),
      i32(clamp(
        u32(max(self_pos_mass.y, 0.0) * inv_cell),
        0u,
        thermal_params.bin_ny - 1u
      )),
      i32(clamp(
        u32(max(self_pos_mass.z, 0.0) * inv_cell),
        0u,
        thermal_params.bin_nz - 1u
      ))
    );
    for (var ordinal = 0u; ordinal < scan_cell_count; ordinal = ordinal + 1u) {
      let ox = i32(ordinal % scan_width) - scan_radius;
      let oy = i32((ordinal / scan_width) % scan_width) - scan_radius;
      let oz = i32(ordinal / scan_plane) - scan_radius;
      let cell_position = center + vec3<i32>(ox, oy, oz);
      if (
        cell_position.x < 0i
        || cell_position.y < 0i
        || cell_position.z < 0i
        || cell_position.x >= i32(thermal_params.bin_nx)
        || cell_position.y >= i32(thermal_params.bin_ny)
        || cell_position.z >= i32(thermal_params.bin_nz)
      ) { continue; }
      let cell = (
        u32(cell_position.z) * thermal_params.bin_ny
          + u32(cell_position.y)
      ) * thermal_params.bin_nx + u32(cell_position.x);
      if (spatial_directory[cell] > bin_capacity) {
        use_exhaustive_fallback = true;
      }
    }
  }
  if (use_exhaustive_fallback) {
    thermal_evidence_add(15u, 1u, true);
    thermal_evidence_add(15u, 1u, false);
  }
  let safe_bin_capacity = max(bin_capacity, 1u);
  let binned_candidate_span = scan_cell_count * safe_bin_capacity;
  let traversal_count = select(
    binned_candidate_span,
    thermal_params.particle_count,
    use_exhaustive_fallback
  );
  for (var cursor = 0u; cursor < traversal_count; cursor = cursor + 1u) {
    var other_index = cursor;
    var visit = use_exhaustive_fallback;
    if (!use_exhaustive_fallback) {
      let ordinal = cursor / safe_bin_capacity;
      let slot = cursor % safe_bin_capacity;
      let ox = i32(ordinal % scan_width) - scan_radius;
      let oy = i32((ordinal / scan_width) % scan_width) - scan_radius;
      let oz = i32(ordinal / scan_plane) - scan_radius;
      let cell_position = center + vec3<i32>(ox, oy, oz);
      let cell_in_bounds = cell_position.x >= 0i
        && cell_position.y >= 0i
        && cell_position.z >= 0i
        && cell_position.x < i32(thermal_params.bin_nx)
        && cell_position.y < i32(thermal_params.bin_ny)
        && cell_position.z < i32(thermal_params.bin_nz);
      if (cell_in_bounds) {
        let cell = (
          u32(cell_position.z) * thermal_params.bin_ny
            + u32(cell_position.y)
        ) * thermal_params.bin_nx + u32(cell_position.x);
        let admitted_count = min(spatial_directory[cell], bin_capacity);
        if (slot < admitted_count) {
          other_index = spatial_directory[
            total_cells + cell * bin_capacity + slot
          ];
          visit = true;
        }
      }
    }
    if (!visit) { continue; }
    thermal_visit_fused_pair(
      budget_mode,
      particle_index,
      other_index,
      self_pos_mass.xyz,
      self_mass,
      self_temperature,
      self_temperature_slope,
      self_radius_m,
      self_emissivity,
      self_gain_scale,
      self_loss_scale,
      &requested_gain_j,
      &requested_loss_j,
      &conduction_specific_energy_delta,
      &radiation_specific_energy_delta,
      &neighbor_min_temperature,
      &neighbor_max_temperature,
      &conduction_candidate_visit_count,
      &radiation_candidate_visit_count,
      &conduction_mask_hit_count,
      &radiation_mask_hit_count,
      &local_count_overflow
    );
  }
`;
  source = `${source.slice(0, compactTraversalStart)}${compactTraversal}${
    source.slice(compactTraversalEnd)
  }`;
  return source;
}

export const classicThermalBinnedProposalWgsl =
  createClassicThermalBinnedProposalWgsl();

export const classicThermalCandidateBuildWgsl = /* wgsl */ `
struct ThermalProposalParams {
  particle_count: u32,
  material_count: u32,
  response_count: u32,
  conduction_support_profile_id: u32,
  radiation_support_profile_id: u32,
  active_member_projection_enabled: u32,
  dt_s: f32,
  smoothing_length_m: f32,
  conduction_rate: f32,
  radiation_pair_range_radii: f32,
  stefan_boltzmann_w_per_m2_k4: f32,
  candidate_capacity: u32,
  lookup_mode: u32,
  bin_capacity: u32,
  bin_nx: u32,
  bin_ny: u32,
  bin_nz: u32,
  bin_cell_count: u32,
  bin_cell_size_m: f32,
  max_bin_scan_radius_cells: u32,
};

@group(0) @binding(0) var<storage, read> source_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> thermal_derived: array<u32>;
@group(0) @binding(2) var<storage, read> source_bins: array<u32>;
@group(0) @binding(3) var<storage, read_write> candidate_directory: array<u32>;
@group(0) @binding(4) var<uniform> thermal_params: ThermalProposalParams;

fn finite_value(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823466e+38;
}

@compute @workgroup_size(64)
fn build(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle = global_id.x;
  if (particle >= thermal_params.particle_count) { return; }
  let count_offset = particle;
  let state_row = source_state[particle * 2u];
  if (state_row.w <= 0.0) {
    candidate_directory[count_offset] = 0u;
    return;
  }
  let derived_row = ${SCHROEDER_SPATIAL_THERMAL_DERIVED_HEADER_WORDS}u
    + particle * ${SCHROEDER_SPATIAL_THERMAL_DERIVED_ROW_WORDS}u;
  let self_radius_m = bitcast<f32>(thermal_derived[derived_row + 2u]);
  let global_max_radius_m = bitcast<f32>(thermal_derived[0u]);
  let conduction_radius_m = max(
    2.0 * thermal_params.smoothing_length_m,
    self_radius_m + global_max_radius_m
  );
  let radiation_radius_m = thermal_params.radiation_pair_range_radii
    * (self_radius_m + global_max_radius_m);
  let query_radius_m = max(conduction_radius_m, radiation_radius_m);
  let total_cells = thermal_params.bin_cell_count;
  let bin_capacity = thermal_params.bin_capacity;
  let raw_scan_radius = ceil(
    query_radius_m / max(thermal_params.bin_cell_size_m, 1.0e-9)
  );
  if (
    thermal_params.lookup_mode != 1u
    || thermal_params.candidate_capacity == 0u
    || total_cells == 0u
    || bin_capacity == 0u
    || thermal_params.bin_nx == 0u
    || thermal_params.bin_ny == 0u
    || thermal_params.bin_nz == 0u
    || !finite_value(query_radius_m)
    || query_radius_m <= 0.0
    || !finite_value(thermal_params.bin_cell_size_m)
    || thermal_params.bin_cell_size_m <= 0.0
    || !finite_value(raw_scan_radius)
    || raw_scan_radius < 0.0
    || raw_scan_radius > f32(thermal_params.max_bin_scan_radius_cells)
  ) {
    candidate_directory[count_offset] = ${CLASSIC_THERMAL_CANDIDATE_OVERFLOW}u;
    return;
  }
  let scan_radius = i32(raw_scan_radius);
  let inverse_cell = 1.0 / thermal_params.bin_cell_size_m;
  let center = vec3<i32>(
    i32(clamp(
      u32(max(state_row.x, 0.0) * inverse_cell),
      0u,
      thermal_params.bin_nx - 1u
    )),
    i32(clamp(
      u32(max(state_row.y, 0.0) * inverse_cell),
      0u,
      thermal_params.bin_ny - 1u
    )),
    i32(clamp(
      u32(max(state_row.z, 0.0) * inverse_cell),
      0u,
      thermal_params.bin_nz - 1u
    ))
  );
  var candidate_count = 0u;
  var overflow = false;
  for (
    var oz = -${CLASSIC_THERMAL_MAX_BIN_SCAN_RADIUS_CELLS}i;
    oz <= ${CLASSIC_THERMAL_MAX_BIN_SCAN_RADIUS_CELLS}i;
    oz = oz + 1i
  ) {
    if (oz < -scan_radius || oz > scan_radius) { continue; }
    let nz = center.z + oz;
    if (nz < 0i || nz >= i32(thermal_params.bin_nz)) { continue; }
    for (
      var oy = -${CLASSIC_THERMAL_MAX_BIN_SCAN_RADIUS_CELLS}i;
      oy <= ${CLASSIC_THERMAL_MAX_BIN_SCAN_RADIUS_CELLS}i;
      oy = oy + 1i
    ) {
      if (oy < -scan_radius || oy > scan_radius) { continue; }
      let ny = center.y + oy;
      if (ny < 0i || ny >= i32(thermal_params.bin_ny)) { continue; }
      for (
        var ox = -${CLASSIC_THERMAL_MAX_BIN_SCAN_RADIUS_CELLS}i;
        ox <= ${CLASSIC_THERMAL_MAX_BIN_SCAN_RADIUS_CELLS}i;
        ox = ox + 1i
      ) {
        if (ox < -scan_radius || ox > scan_radius) { continue; }
        let nx = center.x + ox;
        if (nx < 0i || nx >= i32(thermal_params.bin_nx)) { continue; }
        let cell = (u32(nz) * thermal_params.bin_ny + u32(ny))
          * thermal_params.bin_nx + u32(nx);
        let resident_count = source_bins[cell];
        if (resident_count > bin_capacity) {
          overflow = true;
          break;
        }
        for (var slot = 0u; slot < resident_count; slot = slot + 1u) {
          if (candidate_count >= thermal_params.candidate_capacity) {
            overflow = true;
            break;
          }
          candidate_directory[
            thermal_params.particle_count
              + particle * thermal_params.candidate_capacity
              + candidate_count
          ] = source_bins[total_cells + cell * bin_capacity + slot];
          candidate_count = candidate_count + 1u;
        }
        if (overflow) { break; }
      }
      if (overflow) {
        break;
      }
    }
    if (overflow) { break; }
  }
  candidate_directory[count_offset] = select(
    candidate_count,
    ${CLASSIC_THERMAL_CANDIDATE_OVERFLOW}u,
    overflow
  );
}
`;

function createClassicThermalCandidateProposalWgsl() {
  const traversalStart = `  thermal_evidence_add(15u, 1u, true);
  thermal_evidence_add(15u, 1u, false);
  for (
    var other_index = 0u;
    other_index < thermal_params.particle_count;
    other_index = other_index + 1u
  ) {`;
  const traversalEnd = `  }
  let conduction_candidate_count_admitted`;
  const binnedEntryPoints = `@compute @workgroup_size(64)
fn budget_binned(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (global_id.x >= thermal_params.particle_count) { return; }
  thermal_traverse_particle(global_id.x, true, 1u, false);
}

@compute @workgroup_size(64)
fn propose_binned(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (global_id.x >= thermal_params.particle_count) { return; }
  thermal_traverse_particle(global_id.x, false, 1u, false);
}
`;
  const start = classicThermalProposalWgsl.indexOf(traversalStart);
  const end = classicThermalProposalWgsl.indexOf(
    traversalEnd,
    start + traversalStart.length
  );
  if (
    start < 0
    || end < 0
    || !classicThermalProposalWgsl.includes(binnedEntryPoints)
  ) {
    throw new Error('Classic thermal candidate proposal WGSL markers drifted');
  }
  const candidateTraversal = `  let stored_candidate_count = spatial_directory[particle_index];
  let use_exhaustive_fallback = thermal_params.candidate_capacity == 0u
    || stored_candidate_count == ${CLASSIC_THERMAL_CANDIDATE_OVERFLOW}u
    || stored_candidate_count > thermal_params.candidate_capacity;
  if (use_exhaustive_fallback) {
    thermal_evidence_add(15u, 1u, true);
    thermal_evidence_add(15u, 1u, false);
  }
  let traversal_count = select(
    stored_candidate_count,
    thermal_params.particle_count,
    use_exhaustive_fallback
  );
  for (var cursor = 0u; cursor < traversal_count; cursor = cursor + 1u) {
    var other_index = cursor;
    if (!use_exhaustive_fallback) {
      other_index = spatial_directory[
        thermal_params.particle_count
          + particle_index * thermal_params.candidate_capacity
          + cursor
      ];
    }
    thermal_visit_fused_pair(
      budget_mode,
      particle_index,
      other_index,
      self_pos_mass.xyz,
      self_mass,
      self_temperature,
      self_temperature_slope,
      self_radius_m,
      self_emissivity,
      self_gain_scale,
      self_loss_scale,
      &requested_gain_j,
      &requested_loss_j,
      &conduction_specific_energy_delta,
      &radiation_specific_energy_delta,
      &neighbor_min_temperature,
      &neighbor_max_temperature,
      &conduction_candidate_visit_count,
      &radiation_candidate_visit_count,
      &conduction_mask_hit_count,
      &radiation_mask_hit_count,
      &local_count_overflow
    );`;
  return `${classicThermalProposalWgsl.slice(0, start)}${candidateTraversal}${
    classicThermalProposalWgsl.slice(end)
  }`.replace(binnedEntryPoints, '');
}

export const classicThermalCandidateProposalWgsl =
  createClassicThermalCandidateProposalWgsl();

function resolveThermalResponseUpload(device, upload) {
  if (
    upload?.schema !== ULG_SPH_GPU_THERMAL_RESPONSE_GRAPH_BUFFER_SET_SCHEMA
    || upload.status !== 'webgpu-uploaded'
    || upload.destroyed === true
  ) {
    throw new TypeError(
      'Canonical thermal proposals require one live SPH thermal response/graph upload'
    );
  }
  const materialCount = exactU32(upload.materialCount, 'thermalResponseGraphUpload.materialCount');
  const responseCount = exactU32(upload.responseCount, 'thermalResponseGraphUpload.responseCount');
  return Object.freeze({
    materialCount,
    responseCount,
    responseRecordBuffer: requireBuffer(
      device,
      upload.responseRecordBuffer,
      'thermalResponseGraphUpload.responseRecordBuffer',
      materialCount * 2 * 4 * Float32Array.BYTES_PER_ELEMENT
    ),
    responseBuffer: requireBuffer(
      device,
      upload.responseBuffer,
      'thermalResponseGraphUpload.responseBuffer',
      responseCount * 4 * 4 * Float32Array.BYTES_PER_ELEMENT
    ),
    graphNodeBuffer: requireBuffer(
      device,
      upload.graphNodeBuffer,
      'thermalResponseGraphUpload.graphNodeBuffer'
    ),
    graphSampleBuffer: requireBuffer(
      device,
      upload.graphSampleBuffer,
      'thermalResponseGraphUpload.graphSampleBuffer'
    )
  });
}

function authenticateThermalConsumers(device, generation) {
  return SCHROEDER_SPATIAL_THERMAL_CONSUMERS.map(
    ({ consumerId, supportProfileId }) => {
      const authentication = resolveSchroederSpatialExactNearConsumerGeneration(
        generation,
        {
          device,
          runtime: generation?.runtime,
          consumerId,
          supportProfileId,
          expectedTraversalCount: 2,
          sourceBuffer: generation?.source?.sourceBuffer
            ?? generation?.source?.activeNodeBuffer
        }
      );
      if (authentication?.ready !== true || authentication.authenticated !== true) {
        const error = new Error(
          authentication?.reason
          || `Canonical spatial thermal consumer ${consumerId} was not authenticated`
        );
        error.code = 'ERR_SCHROEDER_SPATIAL_THERMAL_AUTHENTICATION';
        throw error;
      }
      return authentication;
    }
  );
}

function createThermalProposalSourceAuthority({
  device,
  generation,
  transaction,
  sphParticleUpload,
  mlsMpmParticleUpload,
  particleCount
}) {
  if (!validateSchroederSpatialEpochTransactionSourceFamily(transaction, {
    generation,
    sphParticleUpload,
    mlsMpmParticleUpload
  })) {
    const error = new Error(
      'Canonical thermal proposal source does not match the transaction-owned immutable x_n family'
    );
    error.code = 'ERR_SCHROEDER_SPATIAL_THERMAL_SOURCE_AUTHORITY';
    throw error;
  }
  const execution = generation.execution;
  const authority = Object.freeze({
    schema: ULG_THERMAL_PROPOSAL_SOURCE_AUTHORITY_SCHEMA,
    status: 'thermal-proposal-source-authority-ready',
    positionAuthority: 'immutable-pre-integration-x-n',
    device,
    transaction,
    generation,
    generationId: execution.generationId,
    particleCount,
    stateStrideFloats: 8,
    thermoStrideFloats: 12,
    stateBufferByteLength: particleCount * 8 * Float32Array.BYTES_PER_ELEMENT,
    thermoBufferByteLength: particleCount * 12 * Float32Array.BYTES_PER_ELEMENT,
    stateBuffer: sphParticleUpload.stateBuffer,
    thermoBuffer: sphParticleUpload.thermoBuffer,
    identityBuffer: sphParticleUpload.identityBuffer ?? null,
    mechanicsBuffer: mlsMpmParticleUpload.mechanicsBuffer,
    epochIdentity: Object.freeze(Object.fromEntries(
      [
        'storageGeneration',
        'physicsTick',
        'physicsSubstep',
        'positionEpoch',
        'topologyEpoch',
        'chartEpoch',
        'levelEpoch',
        'supportEpoch'
      ].map((field) => [field, execution[field]])
    )),
    sourceCaptureOrdinal: execution.buildOrdinal
  });
  thermalProposalSourceAuthorities.set(authority, {
    active: true,
    device,
    generation
  });
  return authority;
}

export function isLiveThermalProposalSourceAuthority(authority, {
  device = null,
  generation = null,
  stateBuffer = null,
  thermoBuffer = null,
  particleCount = null
} = {}) {
  const record = thermalProposalSourceAuthorities.get(authority);
  return Boolean(
    authority
    && record?.active === true
    && record.device === authority.device
    && record.generation === authority.generation
    && authority.schema === ULG_THERMAL_PROPOSAL_SOURCE_AUTHORITY_SCHEMA
    && authority.status === 'thermal-proposal-source-authority-ready'
    && authority.positionAuthority === 'immutable-pre-integration-x-n'
    && (device == null || authority.device === device)
    && (generation == null || authority.generation === generation)
    && (stateBuffer == null || authority.stateBuffer === stateBuffer)
    && (thermoBuffer == null || authority.thermoBuffer === thermoBuffer)
    && (particleCount == null || authority.particleCount === particleCount)
    && authority.generation?.releaseScheduled !== true
    && authority.generation?.execution?.released !== true
  );
}

/**
 * Prepare authenticated resident evidence and an arena lease without encoding
 * or submitting the thermal law. The matched-time materializer later evaluates
 * the exact current state over the retained immutable-x_n directory and the
 * caller encodes that producer immediately before canonical apply.
 */
export function runSchroederSpatialThermalProposalWebGpu({
  device,
  generation,
  schroederSpatialEpochTransaction,
  sphParticleState,
  sphParticleUpload,
  mlsMpmParticleUpload,
  thermalResponseGraphUpload,
  dtS = 0,
  smoothingLengthM = sphParticleState?.smoothingLengthM ?? 0,
  conductionRate = PAIR_CONDUCTION_RATE_DEFAULT
} = {}) {
  if (!device?.createBuffer || !device?.createCommandEncoder || !device.queue?.writeBuffer) {
    throw new TypeError('Canonical thermal proposals require a WebGPU-like device');
  }
  if (lostThermalProposalDevices.has(device)) {
    throw new Error('Canonical thermal proposal device is already lost');
  }
  const particleCount = exactU32(
    sphParticleState?.particleCount,
    'sphParticleState.particleCount',
    { positive: true }
  );
  if (generation?.source?.sourceCount !== particleCount) {
    throw new RangeError(
      'Canonical thermal proposal particle count must match the frozen spatial source count'
    );
  }
  const thermalProposalSourceAuthority = createThermalProposalSourceAuthority({
    device,
    generation,
    transaction: schroederSpatialEpochTransaction,
    sphParticleUpload,
    mlsMpmParticleUpload,
    particleCount
  });
  const stateBuffer = requireBuffer(
    device,
    sphParticleUpload?.stateBuffer,
    'sphParticleUpload.stateBuffer',
    particleCount * 2 * 4 * Float32Array.BYTES_PER_ELEMENT
  );
  const thermoBuffer = requireBuffer(
    device,
    sphParticleUpload?.thermoBuffer,
    'sphParticleUpload.thermoBuffer',
    particleCount * 3 * 4 * Float32Array.BYTES_PER_ELEMENT
  );
  const responseUpload = resolveThermalResponseUpload(device, thermalResponseGraphUpload);
  const preparedLawConfig = normalizeThermalLawConfig({
    dtS,
    smoothingLengthM,
    conductionRate
  });
  const authentications = authenticateThermalConsumers(device, generation);
  const conductionAuthentication = authentications[0];
  const radiationAuthentication = authentications[1];
  const execution = generation.execution;
  const aggregateView = generation?.aggregateView ?? null;
  const generationActiveRankView = generation?.activeRankView ?? null;
  const activeRankView = generationActiveRankView
    ?? execution.activeRankView
    ?? null;
  let activeSourceProjectionMode =
    SCHROEDER_SPATIAL_THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_LOCAL;
  let activeProjectionViewBuffer = execution.directoryBuffer;
  let activeRankViewAdmissionStatus = activeRankView
    ? 'schroeder-spatial-active-rank-view-not-selected'
    : 'schroeder-spatial-active-rank-view-absent';
  if (aggregateView) {
    const aggregateAdmission = validateSchroederSpatialAggregateViewDescriptor(
      aggregateView,
      {
        generationId: execution.generationId,
        deviceOrdinal: execution.deviceOrdinal,
        laneOrdinal: execution.laneOrdinal,
        leaseToken: execution.leaseToken,
        sourceFamilyId: execution.sourceFamilyId,
        storageGeneration: execution.storageGeneration,
        physicsTick: execution.physicsTick,
        physicsSubstep: execution.physicsSubstep,
        positionEpoch: execution.positionEpoch,
        topologyEpoch: execution.topologyEpoch,
        chartEpoch: execution.chartEpoch,
        levelEpoch: execution.levelEpoch,
        supportEpoch: execution.supportEpoch,
        completionOrdinal: execution.buildOrdinal,
        sourceCount: particleCount,
        sourceCapacity: execution.sourceCapacity,
        cellCapacity: execution.cellCapacity,
        sourceRowLayoutId: generation.source?.sourceRowLayoutId
      }
    );
    const exactSourceAuthority = aggregateView.spatialExecution === execution
      && aggregateView.spatialSource === generation.source
      && aggregateView.sourceStateBuffer === thermalProposalSourceAuthority.stateBuffer
      && aggregateView.sourceThermoBuffer === thermalProposalSourceAuthority.thermoBuffer
      && (
        !thermalProposalSourceAuthority.identityBuffer
        || aggregateView.sourceIdentityBuffer
          === thermalProposalSourceAuthority.identityBuffer
      );
    if (aggregateAdmission.admitted !== true || !exactSourceAuthority) {
      const error = new TypeError(
        aggregateAdmission.admitted !== true
          ? `canonical thermal active-member projection was rejected: ${
              aggregateAdmission.status
            }`
          : 'canonical thermal active-member projection does not share the exact source authority'
      );
      error.code = 'ERR_SCHROEDER_SPATIAL_THERMAL_ACTIVE_MEMBER_AUTHENTICATION';
      throw error;
    }
    activeProjectionViewBuffer = requireBuffer(
      device,
      aggregateView.aggregateViewBuffer,
      'generation.aggregateView.aggregateViewBuffer',
      aggregateView.aggregatePhysicalByteLength
    );
    activeSourceProjectionMode =
      SCHROEDER_SPATIAL_THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_AGGREGATE;
  } else if (activeRankView) {
    const activeRankAdmission = validateSchroederSpatialActiveRankViewDescriptor(
      activeRankView,
      {
        spatialExecution: execution,
        sourceBuffer: execution.sourceBuffer,
        directoryBuffer: execution.directoryBuffer,
        sourceCount: particleCount,
        sourceCapacity: execution.sourceCapacity,
        sourceRowLayoutId: generation.source?.sourceRowLayoutId,
        generationId: execution.generationId,
        storageGeneration: execution.storageGeneration,
        physicsTick: execution.physicsTick,
        physicsSubstep: execution.physicsSubstep,
        positionEpoch: execution.positionEpoch,
        topologyEpoch: execution.topologyEpoch,
        chartEpoch: execution.chartEpoch,
        levelEpoch: execution.levelEpoch,
        supportEpoch: execution.supportEpoch,
        buildOrdinal: execution.buildOrdinal
      }
    );
    activeRankViewAdmissionStatus = activeRankAdmission.status;
    const exactActiveRankAuthority = (
      !generationActiveRankView || generationActiveRankView === activeRankView
    )
      && execution.activeRankView === activeRankView
      && activeRankView.spatialExecution === execution
      && activeRankView.sourceBuffer === execution.sourceBuffer
      && activeRankView.directoryBuffer === execution.directoryBuffer;
    if (activeRankAdmission.admitted !== true || !exactActiveRankAuthority) {
      const error = new TypeError(
        activeRankAdmission.admitted !== true
          ? `canonical thermal active-rank view was rejected: ${
              activeRankAdmission.status
            }`
          : 'canonical thermal active-rank view does not share the exact epoch authority'
      );
      error.code = 'ERR_SCHROEDER_SPATIAL_THERMAL_ACTIVE_RANK_AUTHENTICATION';
      throw error;
    }
    activeProjectionViewBuffer = requireBuffer(
      device,
      activeRankView.activeRankViewBuffer,
      'generation.activeRankView.activeRankViewBuffer',
      activeRankView.layout.byteLength
    );
    activeSourceProjectionMode =
      SCHROEDER_SPATIAL_THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_ACTIVE_RANK;
  }
  const { runtime, entry, cacheHit } = acquireRuntimeEntry(
    device,
    execution,
    particleCount
  );
  // The CPU mirror only selects whether it is worth paying the extra
  // materialize/replay passes.  A stale positive result takes the established
  // direct GPU traversal, so this optimization hint cannot alter correctness.
  const candidateCsrRequested = !cpuStateMayAlreadyBeThermallyUniform(
    sphParticleState
  );
  const hadThermalCandidateCsr = Boolean(entry.thermalCandidateCsr);
  const thermalCandidateCsr = candidateCsrRequested
    ? ensureThermalCandidateCsrRuntime(device, entry)
    : Object.freeze({
        available: false,
        reason: 'cpu-state-may-already-be-thermally-uniform'
      });
  if (!hadThermalCandidateCsr && thermalCandidateCsr.available) {
    runtime.allocationCount += 2;
  }
  const candidateCsrEnabled = thermalCandidateCsr.available === true;
  const {
    derivedBuffer,
    proposalBuffer,
    conductionEvidenceBuffer,
    radiationEvidenceBuffer,
    conductionExpectationBuffer,
    radiationExpectationBuffer,
    paramsBuffer,
    activeDispatchBuffer,
    thermalCsrDummyBuffer
  } = entry.buffers;

  try {

  device.queue.writeBuffer(
    proposalBuffer,
    0,
    createProposalHeader(execution, particleCount)
  );
  device.queue.writeBuffer(
    conductionEvidenceBuffer,
    0,
    createEvidenceInitial(
      execution,
      SCHROEDER_SPATIAL_SUPPORT_PROFILE_THERMAL_CONDUCTION_V1
    )
  );
  device.queue.writeBuffer(
    radiationEvidenceBuffer,
    0,
    createEvidenceInitial(
      execution,
      SCHROEDER_SPATIAL_SUPPORT_PROFILE_RADIATION_WIDE_V1
    )
  );
  device.queue.writeBuffer(
    conductionExpectationBuffer,
    0,
    conductionAuthentication.expectationData
  );
  device.queue.writeBuffer(
    radiationExpectationBuffer,
    0,
    radiationAuthentication.expectationData
  );
  if (candidateCsrEnabled) {
    device.queue.writeBuffer(
      thermalCandidateCsr.replayBuffer,
      0,
      thermalCsrHeader(
        thermalCandidateCsr.sourceCapacity,
        thermalCandidateCsr.candidateCapacity,
        thermalCandidateCsr.rowStride
      )
    );
  }
  device.queue.writeBuffer(paramsBuffer, 0, createThermalParamsArray({
    particleCount,
    materialCount: responseUpload.materialCount,
    responseCount: responseUpload.responseCount,
    activeSourceProjectionMode,
    candidateCapacity: candidateCsrEnabled
      ? thermalCandidateCsr.candidateCapacity
      : 0,
    ...preparedLawConfig
  }));

  const derivedPipeline = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-schroeder-spatial-thermal-derived-prepass.v9',
    label: 'ulg-schroeder-spatial-thermal-derived-prepass',
    code: schroederSpatialThermalDerivedPrepassWgsl,
    entryPoint: 'derive',
    bindings: [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'read-only-storage'),
      computeBufferBinding(3, 'read-only-storage'),
      computeBufferBinding(4, 'read-only-storage'),
      computeBufferBinding(5, 'read-only-storage'),
      computeBufferBinding(6, 'storage'),
      computeBufferBinding(7, 'uniform'),
      computeBufferBinding(8, 'read-only-storage'),
      computeBufferBinding(9, 'read-only-storage'),
      computeBufferBinding(10, 'read-only-storage'),
      computeBufferBinding(11, 'storage')
    ]
  });
  const activeDispatchFinalizePipeline = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-schroeder-spatial-thermal-active-dispatch-finalize.v3',
    label: 'ulg-schroeder-spatial-thermal-active-dispatch-finalize',
    code: schroederSpatialThermalDerivedPrepassWgsl,
    entryPoint: 'finalize_active_dispatch',
    bindings: [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'read-only-storage'),
      computeBufferBinding(3, 'read-only-storage'),
      computeBufferBinding(4, 'read-only-storage'),
      computeBufferBinding(5, 'read-only-storage'),
      computeBufferBinding(6, 'storage'),
      computeBufferBinding(7, 'uniform'),
      computeBufferBinding(8, 'read-only-storage'),
      computeBufferBinding(9, 'read-only-storage'),
      computeBufferBinding(10, 'read-only-storage'),
      computeBufferBinding(11, 'storage')
    ]
  });
  const budgetResolvePipeline = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-schroeder-spatial-thermal-budget-resolve.v9',
    label: 'ulg-schroeder-spatial-thermal-budget-resolve',
    code: schroederSpatialThermalDerivedPrepassWgsl,
    entryPoint: 'resolve_budget',
    bindings: [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'read-only-storage'),
      computeBufferBinding(3, 'read-only-storage'),
      computeBufferBinding(4, 'read-only-storage'),
      computeBufferBinding(5, 'read-only-storage'),
      computeBufferBinding(6, 'storage'),
      computeBufferBinding(7, 'uniform'),
      computeBufferBinding(8, 'read-only-storage'),
      computeBufferBinding(9, 'read-only-storage'),
      computeBufferBinding(10, 'read-only-storage'),
      computeBufferBinding(11, 'storage')
    ]
  });
  const budgetPipeline = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-schroeder-spatial-thermal-fused-budget.v21',
    label: 'ulg-schroeder-spatial-thermal-fused-budget',
    code: schroederSpatialThermalProposalWgsl,
    entryPoint: 'budget',
    bindings: [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'storage'),
      computeBufferBinding(2, 'read-only-storage'),
      computeBufferBinding(3, 'storage'),
      computeBufferBinding(4, 'storage'),
      computeBufferBinding(5, 'storage'),
      computeBufferBinding(6, 'uniform'),
      computeBufferBinding(7, 'uniform'),
      computeBufferBinding(8, 'uniform'),
      computeBufferBinding(9, 'read-only-storage'),
      computeBufferBinding(10, 'read-only-storage'),
      computeBufferBinding(11, 'storage'),
      computeBufferBinding(12, 'storage'),
      computeBufferBinding(13, 'storage')
    ]
  });
  const proposalPipeline = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-schroeder-spatial-thermal-fused-proposal.v22',
    label: 'ulg-schroeder-spatial-thermal-fused-proposal',
    code: schroederSpatialThermalProposalWgsl,
    entryPoint: 'propose',
    bindings: [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'storage'),
      computeBufferBinding(2, 'read-only-storage'),
      computeBufferBinding(3, 'storage'),
      computeBufferBinding(4, 'storage'),
      computeBufferBinding(5, 'storage'),
      computeBufferBinding(6, 'uniform'),
      computeBufferBinding(7, 'uniform'),
      computeBufferBinding(8, 'uniform'),
      computeBufferBinding(9, 'read-only-storage'),
      computeBufferBinding(10, 'read-only-storage'),
      computeBufferBinding(11, 'storage'),
      computeBufferBinding(12, 'storage'),
      computeBufferBinding(13, 'storage')
    ]
  });
  const thermalCandidateCsrPipelineBindings = [
    computeBufferBinding(0, 'read-only-storage'),
    computeBufferBinding(1, 'storage'),
    computeBufferBinding(2, 'read-only-storage'),
    computeBufferBinding(3, 'storage'),
    computeBufferBinding(4, 'storage'),
    computeBufferBinding(5, 'storage'),
    computeBufferBinding(6, 'uniform'),
    computeBufferBinding(7, 'uniform'),
    computeBufferBinding(8, 'uniform'),
    computeBufferBinding(9, 'read-only-storage'),
    computeBufferBinding(10, 'read-only-storage'),
    computeBufferBinding(11, 'storage'),
    computeBufferBinding(12, 'storage'),
    computeBufferBinding(13, 'storage')
  ];
  const createThermalCandidateCsrControlPipeline = (entryPoint, suffix) => (
    candidateCsrEnabled
      ? createCachedExplicitComputePipeline(device, {
          cacheKey: `ulg-schroeder-spatial-thermal-csr-${suffix}.v5`,
          label: `ulg-schroeder-spatial-thermal-csr-${suffix}`,
          code: schroederSpatialThermalProposalWgsl,
          entryPoint,
          bindings: thermalCandidateCsrPipelineBindings
        })
      : null
  );
  const thermalCandidateCsrValidatePipeline =
    createThermalCandidateCsrControlPipeline(
      'validate_thermal_csr_rows',
      'validate-rows'
    );
  const thermalCandidateCsrSealPipeline =
    createThermalCandidateCsrControlPipeline(
      'seal_thermal_csr',
      'seal'
    );
  const resolveNativeTestTreeShadowBinding = (phase) => {
    const treeShadow = artifactRecord.nativeTestTreeShadow;
    if (!treeShadow) return null;
    const treeAdmission =
      resolveSchroederSpatialExactNearCellTreeForConsumer(
        artifactRecord.generation?.exactNearCellTree,
        {
          device,
          spatialExecution: execution,
          supportProfileId: null
        }
      );
    if (
      treeAdmission.ready !== true
      || treeAdmission.tree !== treeShadow.tree
      || treeAdmission.treeBuffer !== treeShadow.treeBuffer
    ) {
      const error = new Error(
        `Native thermal tree shadow became stale before matched-time ${phase}`
      );
      error.code =
        'ERR_SCHROEDER_SPATIAL_THERMAL_TREE_SHADOW_STALE_BINDING';
      throw error;
    }
    return treeAdmission.treeBuffer;
  };
  const createMatchedTimeBindGroups = ({
    currentStateBuffer,
    currentThermoBuffer
  }) => {
    const treeShadow = artifactRecord.nativeTestTreeShadow;
    const treeShadowBindBuffer =
      resolveNativeTestTreeShadowBinding('binding');
    const derivedEntries = [
      { binding: 0, resource: { buffer: currentStateBuffer } },
      { binding: 1, resource: { buffer: currentThermoBuffer } },
      { binding: 2, resource: { buffer: responseUpload.responseRecordBuffer } },
      { binding: 3, resource: { buffer: responseUpload.responseBuffer } },
      { binding: 4, resource: { buffer: responseUpload.graphNodeBuffer } },
      { binding: 5, resource: { buffer: responseUpload.graphSampleBuffer } },
      { binding: 6, resource: { buffer: derivedBuffer } },
      { binding: 7, resource: { buffer: paramsBuffer } },
      { binding: 8, resource: { buffer: stateBuffer } },
      { binding: 9, resource: { buffer: execution.directoryBuffer } },
      { binding: 10, resource: { buffer: activeProjectionViewBuffer } },
      { binding: 11, resource: { buffer: activeDispatchBuffer } }
    ];
    const derivedBindGroup = device.createBindGroup({
      layout: derivedPipeline.bindGroupLayout,
      entries: derivedEntries
    });
    const activeDispatchFinalizeBindGroup = device.createBindGroup({
      layout: activeDispatchFinalizePipeline.bindGroupLayout,
      entries: derivedEntries
    });
    const budgetResolveBindGroup = device.createBindGroup({
      layout: budgetResolvePipeline.bindGroupLayout,
      entries: derivedEntries
    });
    const proposalEntries = [
      { binding: 0, resource: { buffer: currentStateBuffer } },
      { binding: 1, resource: { buffer: derivedBuffer } },
      { binding: 2, resource: { buffer: execution.directoryBuffer } },
      { binding: 3, resource: { buffer: proposalBuffer } },
      { binding: 4, resource: { buffer: conductionEvidenceBuffer } },
      { binding: 5, resource: { buffer: radiationEvidenceBuffer } },
      { binding: 6, resource: { buffer: conductionExpectationBuffer } },
      { binding: 7, resource: { buffer: radiationExpectationBuffer } },
      { binding: 8, resource: { buffer: paramsBuffer } },
      { binding: 9, resource: { buffer: stateBuffer } },
      { binding: 10, resource: { buffer: activeProjectionViewBuffer } }
    ];
    const candidateCsrDummyEntries = [
      {
        binding: 11,
        resource: { buffer: thermalCsrDummyBuffer, offset: 0, size: 4 }
      },
      {
        binding: 12,
        resource: {
          buffer: thermalCsrDummyBuffer,
          offset: entry.thermalCsrDummyBindingAlignment,
          size: 4
        }
      },
      {
        binding: 13,
        resource: {
          buffer: thermalCsrDummyBuffer,
          offset: entry.thermalCsrDummyBindingAlignment * 2,
          size: 4
        }
      }
    ];
    const candidateCsrEntries = candidateCsrEnabled
      ? [
          {
            binding: 11,
            resource: { buffer: thermalCandidateCsr.sourceRowStateBuffer }
          },
          {
            binding: 12,
            resource: {
              buffer: thermalCsrDummyBuffer,
              offset: entry.thermalCsrDummyBindingAlignment,
              size: 4
            }
          },
          { binding: 13, resource: { buffer: thermalCandidateCsr.replayBuffer } }
        ]
      : candidateCsrDummyEntries;
    const traversalEntries = treeShadow
      ? [
          candidateCsrEntries[0],
          {
            binding: 12,
            resource: { buffer: treeShadowBindBuffer }
          },
          candidateCsrEntries[2],
          ...(treeShadow.observeTraversalCounters
            ? [{
                binding: 14,
                resource: { buffer: treeShadow.diagnosticBuffer }
              }]
            : [])
        ]
      : candidateCsrEntries;
    const budgetBindGroup = device.createBindGroup({
      layout: artifactRecord.budgetPipeline.bindGroupLayout,
      entries: [...proposalEntries, ...traversalEntries]
    });
    const proposalBindGroup = device.createBindGroup({
      layout: artifactRecord.proposalPipeline.bindGroupLayout,
      entries: [...proposalEntries, ...traversalEntries]
    });
    const candidateCsrControlBindGroup = (pipelineInfo) => {
      if (!pipelineInfo || !candidateCsrEnabled) return null;
      return device.createBindGroup({
        layout: pipelineInfo.bindGroupLayout,
        entries: [...proposalEntries, ...candidateCsrEntries]
      });
    };
    const thermalCandidateCsrValidateBindGroup = candidateCsrControlBindGroup(
      thermalCandidateCsrValidatePipeline
    );
    const thermalCandidateCsrSealBindGroup = candidateCsrControlBindGroup(
      thermalCandidateCsrSealPipeline
    );
    return Object.freeze({
      derivedBindGroup,
      activeDispatchFinalizeBindGroup,
      budgetResolveBindGroup,
      budgetBindGroup,
      proposalBindGroup,
      thermalCandidateCsrValidateBindGroup,
      thermalCandidateCsrSealBindGroup
    });
  };
  const workgroups = Math.max(1, Math.ceil(particleCount / WORKGROUP_SIZE));
  const consumerReceipts = Object.freeze(Object.fromEntries(
    authentications.map((authentication) => {
      const evidenceBuffer = authentication.consumerId
        === SCHROEDER_SPATIAL_THERMAL_CONSUMER.CONDUCTION
        ? conductionEvidenceBuffer
        : radiationEvidenceBuffer;
      return [
        authentication.consumerId,
        bindSchroederSpatialExactNearResidentConsumerEvidence(
          authentication,
          Object.freeze({
            schema: ULG_SCHROEDER_SPATIAL_EXACT_NEAR_RESIDENT_BINDING_SCHEMA,
            status: SCHROEDER_SPATIAL_EXACT_NEAR_RESIDENT_BINDING_STATUS,
            evidenceBuffer,
            controlBuffer: proposalBuffer,
            evidenceWordCount: SCHROEDER_SPATIAL_THERMAL_EVIDENCE_WORDS,
            candidateVisitCountWord: 3,
            requiredDirectedPairCountWord: 0,
            publishedDirectedPairCountWord: 6,
            statusFlagsWord: 5,
            pairStorageCapacityBytes: 0,
            configuredRetainedByteBudget: 0,
            pairGraphSchema:
              ULG_SCHROEDER_SPATIAL_THERMAL_PROPOSAL_BUFFER_SCHEMA,
            resultCountersObserved: false,
            failClosedOnOverflow: true,
            partialPublicationAllowed: false,
            fullReadbackPerformed: false
          })
        )
      ];
    })
  ));

  const artifactRecord = {
    lifecycleStatus: 'prepared',
    materialized: false,
    encoded: false,
    submissionObserved: false,
    releaseScheduled: false,
    released: false,
    terminalDisposition: null,
    terminalReason: null,
    currentStateBuffer: null,
    currentThermoBuffer: null,
    encoderStage: null,
    device,
    generation,
    execution,
    particleCount,
    entry,
    frozenStateBuffer: stateBuffer,
    frozenThermoBuffer: thermoBuffer,
    responseUpload,
    preparedLawConfig,
    derivedBuffer,
    proposalBuffer,
    conductionEvidenceBuffer,
    radiationEvidenceBuffer,
    activeDispatchBuffer,
    activeSourceProjectionMode,
    activeRankView,
    activeRankViewAdmissionStatus,
    activeProjectionViewBuffer,
    candidateCsrEnabled,
    thermalCandidateCsr,
    derivedPipeline,
    activeDispatchFinalizePipeline,
    budgetPipeline,
    budgetResolvePipeline,
    proposalPipeline,
    thermalCandidateCsrValidatePipeline,
    thermalCandidateCsrSealPipeline,
    nativeTestTreeShadow: null,
    nativeTestExhaustiveShadow: null,
    resolveNativeTestTreeShadowBinding,
    createMatchedTimeBindGroups,
    workgroups,
    artifact: null
  };
  const releaseLease = () => {
    if (artifactRecord.released) return false;
    artifactRecord.released = true;
    artifactRecord.lifecycleStatus = 'released';
    const sourceAuthorityRecord = thermalProposalSourceAuthorities.get(
      thermalProposalSourceAuthority
    );
    if (sourceAuthorityRecord) sourceAuthorityRecord.active = false;
    artifactRecord.nativeTestTreeShadow?.diagnosticBuffer?.destroy?.();
    entry.inUseGenerationId = null;
    entry.releaseScheduled = false;
    return true;
  };
  const scheduleArtifactRelease = (terminalDisposition, terminalReason) => {
    if (artifactRecord.released || entry.releaseScheduled) return false;
    artifactRecord.releaseScheduled = true;
    artifactRecord.terminalDisposition = terminalDisposition;
    artifactRecord.terminalReason = terminalReason;
    artifactRecord.lifecycleStatus = artifactRecord.submissionObserved
      ? 'release-scheduled'
      : 'abandonment-release-scheduled';
    entry.releaseScheduled = true;
    deferSubmittedWorkCleanup(device, releaseLease);
    return true;
  };
  const releaseAfterCanonicalApplySubmittedWork = () => scheduleArtifactRelease(
    artifactRecord.submissionObserved
      ? 'submitted-released'
      : (
          artifactRecord.lifecycleStatus === 'encode-failed'
            ? 'encode-failed-quarantined'
            : `${artifactRecord.lifecycleStatus}-abandoned`
        ),
    artifactRecord.submissionObserved
      ? 'matched-time-producer-and-apply-submission-observed'
      : 'canonical-apply-submission-not-observed'
  );
  const abandonPreparedWork = (reason = 'canonical-thermal-stage-abandoned') => {
    if (artifactRecord.submissionObserved) {
      return releaseAfterCanonicalApplySubmittedWork();
    }
    return scheduleArtifactRelease(
      artifactRecord.lifecycleStatus === 'encode-failed'
        ? 'encode-failed-quarantined'
        : `${artifactRecord.lifecycleStatus}-abandoned`,
      String(reason || 'canonical-thermal-stage-abandoned')
    );
  };

  const artifact = Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_THERMAL_PROPOSAL_SCHEMA,
    status: 'schroeder-spatial-thermal-proposal-prepared',
    ready: true,
    backend: 'webgpu',
    particleCount,
    generation,
    generationId: execution.generationId,
    supportEpoch: execution.supportEpoch,
    arenaIndex: execution.arenaIndex,
    sourcePositionAuthority:
      'post-mechanics-current-state-with-swept-pre-integration-x-n-directory',
    directoryPositionAuthority: 'immutable-pre-integration-x-n',
    thermalProposalSourceAuthority,
    supportProfiles: SCHROEDER_SPATIAL_THERMAL_CONSUMERS,
    traversalCount: 2,
    traversalCountPerConsumer: 2,
    sharedTraversalConsumerCount: 2,
    // Encoding cannot know whether a bounded receipt will seal. Do not
    // advertise the preferred one-walk route as a guarantee: the exact
    // fallback is two hierarchy walks and preserves physics if capture fails.
    hierarchyTraversalCount: 2,
    preferredHierarchyTraversalCount: candidateCsrEnabled ? 1 : 2,
    maximumHierarchyTraversalCount: 2,
    reciprocalTraversalMode: candidateCsrEnabled
      ? 'fixed-source-row-thermal-candidate-replay-or-authenticated-exact-near-rewalk'
      : 'authenticated-exact-near-directory-rewalk',
    thermalCandidateCsrFallbackMode: candidateCsrEnabled
      ? 'authenticated-exact-near-directory-rewalk-on-unsealed-row-receipt'
      : null,
    thermalCandidateCsr: candidateCsrEnabled
      ? Object.freeze({
          schema: thermalCandidateCsr.schema,
          construction: thermalCandidateCsr.construction,
          sourceCapacity: thermalCandidateCsr.sourceCapacity,
          rowStride: thermalCandidateCsr.rowStride,
          candidateCapacity: thermalCandidateCsr.candidateCapacity,
          sourceRowStateBuffer: thermalCandidateCsr.sourceRowStateBuffer,
          replayBuffer: thermalCandidateCsr.replayBuffer,
          overflowPolicy: thermalCandidateCsr.overflowPolicy,
          routeEvidence: thermalCandidateCsr.routeEvidence,
          failClosed: true
        })
      : null,
    thermalCandidateCsrUnavailableReason: candidateCsrEnabled
      ? null
      : thermalCandidateCsr.reason,
    proposalBuffer,
    thermalDerivedBudgetBuffer: derivedBuffer,
    activeDispatchBuffer,
    activeSourceProjectionMode,
    activeRankView,
    activeRankViewAdmissionStatus,
    activeProjectionViewBuffer,
    thermalConductionProposalBuffer: proposalBuffer,
    thermalRadiationProposalBuffer: proposalBuffer,
    proposalBufferSchema: ULG_SCHROEDER_SPATIAL_THERMAL_PROPOSAL_BUFFER_SCHEMA,
    proposalHeaderWords: SCHROEDER_SPATIAL_THERMAL_PROPOSAL_HEADER_WORDS,
    proposalRowWords: SCHROEDER_SPATIAL_THERMAL_PROPOSAL_ROW_WORDS,
    proposalRowStrideFloats: SCHROEDER_SPATIAL_THERMAL_PROPOSAL_ROW_FLOATS,
    proposalBufferByteLength: proposalBufferByteLength(entry.capacity),
    activeProposalByteLength: proposalBufferByteLength(particleCount),
    proposalRowByteOffset:
      SCHROEDER_SPATIAL_THERMAL_PROPOSAL_HEADER_WORDS * Uint32Array.BYTES_PER_ELEMENT,
    proposalRowLayout: SCHROEDER_SPATIAL_THERMAL_PROPOSAL_ROW_LAYOUT,
    derivedRowLayout: SCHROEDER_SPATIAL_THERMAL_DERIVED_ROW_LAYOUT,
    derivedHeaderLayout: SCHROEDER_SPATIAL_THERMAL_DERIVED_HEADER_LAYOUT,
    derivedHeaderWords: SCHROEDER_SPATIAL_THERMAL_DERIVED_HEADER_WORDS,
    derivedRowWords: SCHROEDER_SPATIAL_THERMAL_DERIVED_ROW_WORDS,
    derivedBufferByteLength: derivedBufferByteLength(entry.capacity),
    activeDerivedByteLength: derivedBufferByteLength(particleCount),
    proposalHeaderLayout: SCHROEDER_SPATIAL_THERMAL_PROPOSAL_HEADER_LAYOUT,
    conductionEvidenceBuffer,
    radiationEvidenceBuffer,
    evidenceSchema: ULG_SCHROEDER_SPATIAL_THERMAL_EVIDENCE_SCHEMA,
    evidenceLayout: SCHROEDER_SPATIAL_THERMAL_EVIDENCE_LAYOUT,
    evidenceWordCount: SCHROEDER_SPATIAL_THERMAL_EVIDENCE_WORDS,
    consumerAuthentications: Object.freeze([...authentications]),
    consumerReceipts,
    consumerReceipt(consumerId) {
      return consumerReceipts[consumerId] ?? null;
    },
    gpuEvidenceByConsumer: null,
    resultCountersObserved: false,
    preparedLawConfig,
    producerApplySubmissionPolicy: 'single-command-buffer-producer-before-apply',
    matchedTimeQueryPolicy:
      'current-position-exact-filter-over-frozen-x-n-directory-expanded-by-two-times-max-displacement-plus-one-cell-halo',
    artifactDescriptors: Object.freeze({
      [SCHROEDER_SPATIAL_THERMAL_CONSUMER.CONDUCTION]: Object.freeze({
        spatialEpochGenerationId: execution.generationId,
        thermalConductionProposalBuffer: proposalBuffer,
        consumerReceiptBuffer: conductionEvidenceBuffer,
        owned: false,
        owner: 'schroeder-spatial-thermal-device-arena-cache'
      }),
      [SCHROEDER_SPATIAL_THERMAL_CONSUMER.RADIATION]: Object.freeze({
        spatialEpochGenerationId: execution.generationId,
        thermalRadiationProposalBuffer: proposalBuffer,
        consumerReceiptBuffer: radiationEvidenceBuffer,
        owned: false,
        owner: 'schroeder-spatial-thermal-device-arena-cache'
      })
    }),
    canonicalApplyMode: Object.freeze({
      status: 'thermal-canonical-proposal-apply-ready',
      replacesLegacyNeighborBinding: 10,
      paramsSentinelOffsetBytes: SCHROEDER_SPATIAL_THERMAL_CANONICAL_PARAMS_OFFSET_BYTES,
      paramsSentinelValue: SCHROEDER_SPATIAL_THERMAL_CANONICAL_PARAMS_SENTINEL,
      invalidHeaderWordIndices: Object.freeze([6, 7]),
      publishedRowCountHeaderWord: 15,
      completeSetPolicy:
        'both-invalid-counts-zero-and-published-row-count-equals-particle-count-or-apply-no-pair-rows',
      specificEnergyDeltaPolicy:
        'reciprocal-directional-energy-budget-with-live-response-and-neighbor-inverse-bounds-before-wall-and-ambient-laws'
    }),
    directoryBuildCount: 0,
    sharedGenerationDirectoryBuildCount: 1,
    privateBuildCount: 0,
    fixedCandidateBuildCount: 0,
    exhaustiveTraversalCount: 0,
    candidateBudget: null,
    fullParticleReadbackPerformed: false,
    readbackMode: 'no-full-readback',
    bufferOwnership: 'device-arena-runtime-cache',
    ownsProposalBuffer: false,
    ownsEvidenceBuffers: false,
    runtimeCacheHit: cacheHit,
    runtimeCapacity: entry.capacity,
    spatialRuntimeCapacity: entry.spatialCapacity,
    runtimeAllocationCount: runtime.allocationCount,
    releaseAfterCanonicalApplySubmittedWork,
    abandonPreparedWork,
    get lifecycleStatus() { return artifactRecord.lifecycleStatus; },
    get matchedTimeStateBuffer() { return artifactRecord.currentStateBuffer; },
    get matchedTimeThermoBuffer() { return artifactRecord.currentThermoBuffer; },
    get matchedTimeProducerEncoded() { return artifactRecord.encoded; },
    get matchedTimeProducerSubmissionObserved() {
      return artifactRecord.submissionObserved;
    },
    get terminalDisposition() { return artifactRecord.terminalDisposition; },
    get terminalReason() { return artifactRecord.terminalReason; },
    get released() { return artifactRecord.released; }
  });
  artifactRecord.artifact = artifact;
  thermalProposalArtifacts.set(artifact, artifactRecord);
  if (device?.lost?.then) {
    Promise.resolve(device.lost).then(
      (info) => {
        lostThermalProposalDevices.add(device);
        if (artifactRecord.released) return;
        artifactRecord.terminalDisposition = 'device-lost-quarantined';
        artifactRecord.terminalReason = String(
          info?.message || info?.reason || 'webgpu-device-lost'
        );
        const sourceAuthorityRecord = thermalProposalSourceAuthorities.get(
          thermalProposalSourceAuthority
        );
        if (sourceAuthorityRecord) sourceAuthorityRecord.active = false;
        releaseLease();
      },
      (error) => {
        lostThermalProposalDevices.add(device);
        if (artifactRecord.released) return;
        artifactRecord.terminalDisposition = 'device-loss-observation-rejected';
        artifactRecord.terminalReason = String(
          error?.message || error || 'webgpu-device-loss-observation-rejected'
        );
        const sourceAuthorityRecord = thermalProposalSourceAuthorities.get(
          thermalProposalSourceAuthority
        );
        if (sourceAuthorityRecord) sourceAuthorityRecord.active = false;
        releaseLease();
      }
    );
  }
  return artifact;
  } catch (error) {
    entry.inUseGenerationId = null;
    entry.releaseScheduled = false;
    throw error;
  }
}

/**
 * Native-test-only S9D-4 control. It replaces only the prepared artifact's two
 * exact-directory proposal pipelines with an exact-cell-tree shadow before
 * current-state binding. The normal runtime never calls or selects this hook.
 */
export function armSchroederSpatialThermalTreeShadowForNativeTest({
  device,
  schroederSpatialThermalProposal,
  observeTraversalCounters = true
} = {}) {
  const artifact = schroederSpatialThermalProposal;
  const record = thermalProposalArtifacts.get(artifact);
  if (!record || record.artifact !== artifact) {
    throw new TypeError(
      'Native thermal tree shadow requires the exact runtime-issued proposal artifact'
    );
  }
  if (device !== record.device || lostThermalProposalDevices.has(device)) {
    throw new TypeError(
      'Native thermal tree shadow requires the live proposal device'
    );
  }
  if (
    record.released
    || record.releaseScheduled
    || record.materialized
    || record.encoded
    || record.lifecycleStatus !== 'prepared'
    || record.nativeTestTreeShadow
    || record.nativeTestExhaustiveShadow
  ) {
    throw new Error(
      'Native thermal tree shadow must arm one fresh prepared proposal exactly once'
    );
  }
  if (
    artifact.consumerAuthentications.length
      !== SCHROEDER_SPATIAL_THERMAL_CONSUMERS.length
    || artifact.consumerAuthentications.some((authentication) => (
      authentication?.ready !== true
      || authentication.authenticated !== true
    ))
  ) {
    throw new Error(
      'Native thermal tree shadow requires both authenticated thermal support profiles'
    );
  }
  const treeAdmission = resolveSchroederSpatialExactNearCellTreeForConsumer(
    record.generation?.exactNearCellTree,
    {
      device,
      spatialExecution: record.execution,
      // The tree buffer is law-neutral. Its creation-time reaction profile is
      // only the builder's directory-admission witness, not thermal authority.
      supportProfileId: null
    }
  );
  if (treeAdmission.ready !== true) {
    const error = new Error(
      `Native thermal tree shadow rejected exact-cell tree: ${
        treeAdmission.status || 'unknown tree admission'
      }`
    );
    error.code = 'ERR_SCHROEDER_SPATIAL_THERMAL_TREE_SHADOW_ADMISSION';
    throw error;
  }

  const observed = observeTraversalCounters === true;
  const code = createSchroederSpatialThermalTreeShadowWgslForNativeTest({
    observeTraversalCounters: observed
  });
  const diagnosticBuffer = observed
    ? createBuffer(
        device,
        'ulg-native-test-s9d4-thermal-tree-shadow-diagnostics',
        SCHROEDER_SPATIAL_THERMAL_TREE_SHADOW_DIAGNOSTIC_WORDS
          * Uint32Array.BYTES_PER_ELEMENT,
        GPU_BUFFER_USAGE.STORAGE
          | GPU_BUFFER_USAGE.COPY_SRC
          | GPU_BUFFER_USAGE.COPY_DST
      )
    : null;
  const traversalBindings = [
    computeBufferBinding(0, 'read-only-storage'),
    computeBufferBinding(1, 'storage'),
    computeBufferBinding(2, 'read-only-storage'),
    computeBufferBinding(3, 'storage'),
    computeBufferBinding(4, 'storage'),
    computeBufferBinding(5, 'storage'),
    computeBufferBinding(6, 'uniform'),
    computeBufferBinding(7, 'uniform'),
    computeBufferBinding(8, 'uniform'),
    computeBufferBinding(9, 'read-only-storage'),
    computeBufferBinding(10, 'read-only-storage'),
    computeBufferBinding(11, 'storage'),
    computeBufferBinding(12, 'read-only-storage'),
    computeBufferBinding(13, 'storage'),
    ...(observed ? [computeBufferBinding(14, 'storage')] : [])
  ];
  let treeBudgetPipeline = null;
  let treeProposalPipeline = null;
  try {
    treeBudgetPipeline = createCachedExplicitComputePipeline(device, {
      cacheKey: `ulg-native-test-s9d4-thermal-tree-shadow-budget.${
        observed ? 'observed' : 'unobserved'
      }.v1`,
      label: 'ulg-native-test-s9d4-thermal-tree-shadow-budget',
      code,
      entryPoint: 'budget',
      bindings: traversalBindings
    });
    treeProposalPipeline = createCachedExplicitComputePipeline(device, {
      cacheKey: `ulg-native-test-s9d4-thermal-tree-shadow-proposal.${
        observed ? 'observed' : 'unobserved'
      }.v1`,
      label: 'ulg-native-test-s9d4-thermal-tree-shadow-proposal',
      code,
      entryPoint: 'propose',
      bindings: traversalBindings
    });
  } catch (error) {
    diagnosticBuffer?.destroy?.();
    throw error;
  }
  record.budgetPipeline = treeBudgetPipeline;
  record.proposalPipeline = treeProposalPipeline;
  const receipt = Object.freeze({
    schema: 'peercompute.ulg.native-test.s9d4-thermal-tree-shadow.v0',
    status: 'native-test-thermal-tree-shadow-armed',
    nativeTestOnly: true,
    traversal: 'immutable-canonical-exact-cell-tree',
    fallback: null,
    generation: record.generation,
    generationId: record.execution.generationId,
    tree: treeAdmission.tree,
    treeBuffer: treeAdmission.treeBuffer,
    observeTraversalCounters: observed,
    diagnosticBuffer,
    diagnosticWordCount: observed
      ? SCHROEDER_SPATIAL_THERMAL_TREE_SHADOW_DIAGNOSTIC_WORDS
      : 0,
    diagnosticLayout: Object.freeze([
      'budgetNodeVisitCount:atomic<u32>',
      'budgetLeafVisitCount:atomic<u32>',
      'budgetMemberVisitCount:atomic<u32>',
      'proposalNodeVisitCount:atomic<u32>',
      'proposalLeafVisitCount:atomic<u32>',
      'proposalMemberVisitCount:atomic<u32>'
    ])
  });
  record.nativeTestTreeShadow = receipt;
  return receipt;
}

/**
 * Native-test-only brute-force control for S9D-4. It preserves the production
 * pair law, evidence, projection, and CSR ABI, but streams every particle
 * index instead of using directory membership or the cell tree.
 */
export function armSchroederSpatialThermalExhaustiveShadowForNativeTest({
  device,
  schroederSpatialThermalProposal
} = {}) {
  const artifact = schroederSpatialThermalProposal;
  const record = thermalProposalArtifacts.get(artifact);
  if (!record || record.artifact !== artifact) {
    throw new TypeError(
      'Native thermal exhaustive shadow requires the exact runtime-issued proposal artifact'
    );
  }
  if (device !== record.device || lostThermalProposalDevices.has(device)) {
    throw new TypeError(
      'Native thermal exhaustive shadow requires the live proposal device'
    );
  }
  if (
    record.released
    || record.releaseScheduled
    || record.materialized
    || record.encoded
    || record.lifecycleStatus !== 'prepared'
    || record.nativeTestTreeShadow
    || record.nativeTestExhaustiveShadow
  ) {
    throw new Error(
      'Native thermal exhaustive shadow must arm one fresh prepared proposal exactly once'
    );
  }
  if (
    artifact.consumerAuthentications.length
      !== SCHROEDER_SPATIAL_THERMAL_CONSUMERS.length
    || artifact.consumerAuthentications.some((authentication) => (
      authentication?.ready !== true
      || authentication.authenticated !== true
    ))
  ) {
    throw new Error(
      'Native thermal exhaustive shadow requires both authenticated thermal support profiles'
    );
  }
  const code =
    createSchroederSpatialThermalExhaustiveShadowWgslForNativeTest();
  const traversalBindings = [
    computeBufferBinding(0, 'read-only-storage'),
    computeBufferBinding(1, 'storage'),
    computeBufferBinding(2, 'read-only-storage'),
    computeBufferBinding(3, 'storage'),
    computeBufferBinding(4, 'storage'),
    computeBufferBinding(5, 'storage'),
    computeBufferBinding(6, 'uniform'),
    computeBufferBinding(7, 'uniform'),
    computeBufferBinding(8, 'uniform'),
    computeBufferBinding(9, 'read-only-storage'),
    computeBufferBinding(10, 'read-only-storage'),
    computeBufferBinding(11, 'storage'),
    computeBufferBinding(12, 'storage'),
    computeBufferBinding(13, 'storage')
  ];
  const budgetPipeline = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-native-test-s9d4-thermal-exhaustive-shadow-budget.v1',
    label: 'ulg-native-test-s9d4-thermal-exhaustive-shadow-budget',
    code,
    entryPoint: 'budget',
    bindings: traversalBindings
  });
  const proposalPipeline = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-native-test-s9d4-thermal-exhaustive-shadow-proposal.v1',
    label: 'ulg-native-test-s9d4-thermal-exhaustive-shadow-proposal',
    code,
    entryPoint: 'propose',
    bindings: traversalBindings
  });
  record.budgetPipeline = budgetPipeline;
  record.proposalPipeline = proposalPipeline;
  const receipt = Object.freeze({
    schema: 'peercompute.ulg.native-test.s9d4-thermal-exhaustive-shadow.v0',
    status: 'native-test-thermal-exhaustive-shadow-armed',
    nativeTestOnly: true,
    traversal: 'independent-particle-index-brute-force',
    fallback: null,
    generation: record.generation,
    generationId: record.execution.generationId
  });
  record.nativeTestExhaustiveShadow = receipt;
  return receipt;
}

/**
 * Bind one prepared canonical thermal artifact to the exact post-mechanics
 * particle state. The returned producer is single-use and must be encoded
 * immediately before the canonical thermal apply in the same command encoder.
 */
export function createSchroederSpatialMatchedTimeThermalProposalEncoderStage({
  device,
  schroederSpatialThermalProposal,
  currentStateBuffer,
  currentThermoBuffer,
  thermalResponseGraphUpload = null,
  dtS,
  smoothingLengthM,
  conductionRate,
  gpuTimestampRecorder = null
} = {}) {
  const artifact = schroederSpatialThermalProposal;
  const record = thermalProposalArtifacts.get(artifact);
  if (!record || record.artifact !== artifact) {
    throw new TypeError(
      'Matched-time thermal materialization requires the exact runtime-issued proposal artifact'
    );
  }
  if (lostThermalProposalDevices.has(device)) {
    throw new Error('Matched-time thermal proposal device is lost');
  }
  if (device !== record.device) {
    throw new TypeError('Matched-time thermal materialization requires the proposal device');
  }
  if (
    record.released
    || record.releaseScheduled
    || record.materialized
    || record.lifecycleStatus !== 'prepared'
  ) {
    throw new Error('Matched-time thermal proposal materialization is single-use');
  }
  if (!isLiveThermalProposalSourceAuthority(
    artifact.thermalProposalSourceAuthority,
    {
      device,
      generation: record.generation,
      stateBuffer: record.frozenStateBuffer,
      thermoBuffer: record.frozenThermoBuffer,
      particleCount: record.particleCount
    }
  )) {
    throw new Error('Matched-time thermal proposal frozen x_n authority is no longer live');
  }
  const stateBuffer = requireBuffer(
    device,
    currentStateBuffer,
    'currentStateBuffer',
    record.particleCount * 2 * 4 * Float32Array.BYTES_PER_ELEMENT
  );
  const thermoBuffer = requireBuffer(
    device,
    currentThermoBuffer,
    'currentThermoBuffer',
    record.particleCount * 3 * 4 * Float32Array.BYTES_PER_ELEMENT
  );
  if (thermalResponseGraphUpload) {
    const bufferFields = [
      'responseRecordBuffer',
      'responseBuffer',
      'graphNodeBuffer',
      'graphSampleBuffer'
    ];
    if (
      bufferFields.some(
        (field) => thermalResponseGraphUpload[field] !== record.responseUpload[field]
      )
      || thermalResponseGraphUpload.materialCount !== record.responseUpload.materialCount
      || thermalResponseGraphUpload.responseCount !== record.responseUpload.responseCount
    ) {
      throw new Error(
        'Matched-time thermal producer and apply must share the prepared response graph family'
      );
    }
  }
  const applyLawConfig = normalizeThermalLawConfig({
    dtS,
    smoothingLengthM,
    conductionRate
  });
  for (const field of ['dtS', 'smoothingLengthM', 'conductionRate']) {
    if (!Object.is(applyLawConfig[field], record.preparedLawConfig[field])) {
      throw new Error(
        `Matched-time thermal producer/apply ${field} does not match the prepared law configuration`
      );
    }
  }
  const bindGroups = record.createMatchedTimeBindGroups({
    currentStateBuffer: stateBuffer,
    currentThermoBuffer: thermoBuffer
  });
  record.materialized = true;
  record.currentStateBuffer = stateBuffer;
  record.currentThermoBuffer = thermoBuffer;
  record.lifecycleStatus = 'current-state-bound';
  let encodeAttempted = false;
  const timestampActive = Boolean(
    gpuTimestampRecorder?.active === true
      && typeof gpuTimestampRecorder.beginEncoderSpan === 'function'
      && typeof gpuTimestampRecorder.endEncoderSpan === 'function'
  );
  const beginTimestamp = (encoder, stage) => (
    timestampActive
      ? gpuTimestampRecorder.beginEncoderSpan(encoder, {
          producerId: `schroeder-spatial-thermal:${stage}`,
          stage,
          spanClass: 'same-production-command-encoder',
          generationId: record.execution.generationId
        })
      : null
  );
  const endTimestamp = (encoder, token) => {
    if (token) gpuTimestampRecorder.endEncoderSpan(encoder, token);
  };
  const localActiveProjection = record.activeSourceProjectionMode
    === SCHROEDER_SPATIAL_THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_LOCAL;
  const compactActiveProjection = record.activeSourceProjectionMode
    === SCHROEDER_SPATIAL_THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_AGGREGATE
    || record.activeSourceProjectionMode
      === SCHROEDER_SPATIAL_THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_ACTIVE_RANK;
  const stage = Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_MATCHED_TIME_THERMAL_ENCODER_STAGE_SCHEMA,
    status: 'schroeder-spatial-matched-time-thermal-encoder-stage-ready',
    ready: true,
    backend: 'webgpu',
    artifact,
    generation: record.generation,
    generationId: record.execution.generationId,
    particleCount: record.particleCount,
    currentStateBuffer: stateBuffer,
    currentThermoBuffer: thermoBuffer,
    frozenDirectoryStateBuffer: record.frozenStateBuffer,
    proposalBuffer: record.proposalBuffer,
    proposalDispatchCount: record.candidateCsrEnabled
      ? (localActiveProjection ? 7 : 6)
      : (localActiveProjection ? 5 : 4),
    hierarchyTraversalCount: 2,
    preferredHierarchyTraversalCount: record.candidateCsrEnabled ? 1 : 2,
    maximumHierarchyTraversalCount: 2,
    thermalCandidateCsrEnabled: record.candidateCsrEnabled,
    thermalCandidateCsrFallbackMode: record.candidateCsrEnabled
      ? 'authenticated-exact-near-directory-rewalk-on-unsealed-row-receipt'
      : null,
    nativeTestTreeShadow: record.nativeTestTreeShadow,
    nativeTestExhaustiveShadow: record.nativeTestExhaustiveShadow,
    directoryBuildCount: 0,
    fullParticleReadbackPerformed: false,
    encode(encoder) {
      if (matchedTimeThermalEncoderStages.get(stage) !== record) {
        throw new TypeError('Matched-time thermal encoder stage identity is invalid');
      }
      if (encodeAttempted || record.encoded || record.releaseScheduled || record.released) {
        throw new Error('Matched-time thermal encoder stage is single-use');
      }
      if (
        !encoder?.clearBuffer
        || !encoder?.beginComputePass
      ) {
        throw new TypeError(
          'Matched-time thermal encoder stage requires clear/compute GPUCommandEncoder methods'
        );
      }
      record.resolveNativeTestTreeShadowBinding('encoding');
      encodeAttempted = true;
      record.lifecycleStatus = 'encoding';
      try {
        encoder.clearBuffer(
          record.derivedBuffer,
          0,
          derivedBufferByteLength(record.entry.capacity)
        );
        encoder.clearBuffer(
          record.proposalBuffer,
          SCHROEDER_SPATIAL_THERMAL_PROPOSAL_HEADER_WORDS
            * Uint32Array.BYTES_PER_ELEMENT,
          record.particleCount * SCHROEDER_SPATIAL_THERMAL_PROPOSAL_ROW_WORDS
            * Uint32Array.BYTES_PER_ELEMENT
        );
        if (record.nativeTestTreeShadow?.diagnosticBuffer) {
          encoder.clearBuffer(
            record.nativeTestTreeShadow.diagnosticBuffer,
            0,
            SCHROEDER_SPATIAL_THERMAL_TREE_SHADOW_DIAGNOSTIC_WORDS
              * Uint32Array.BYTES_PER_ELEMENT
          );
        }
        if (record.candidateCsrEnabled) {
          encoder.clearBuffer(
            record.thermalCandidateCsr.sourceRowStateBuffer,
            0,
            record.thermalCandidateCsr.sourceCapacity
              * Uint32Array.BYTES_PER_ELEMENT
          );
          encoder.clearBuffer(
            record.thermalCandidateCsr.replayBuffer,
            SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_WORD
              * Uint32Array.BYTES_PER_ELEMENT,
            Uint32Array.BYTES_PER_ELEMENT
          );
        }
        const encodePass = (
          label,
          timestampStage,
          pipelineInfo,
          bindGroup,
          {
            activeProjectionIndirect = false,
            singleWorkgroup = false,
            dispatchWorkgroups = null,
            dispatchIndirectBuffer = null,
            dispatchIndirectOffset = 0
          } = {}
        ) => {
          const timestamp = beginTimestamp(encoder, timestampStage);
          const pass = encoder.beginComputePass({ label });
          pass.setPipeline(pipelineInfo.pipeline);
          pass.setBindGroup(0, bindGroup);
          if (dispatchIndirectBuffer) {
            pass.dispatchWorkgroupsIndirect(
              dispatchIndirectBuffer,
              dispatchIndirectOffset
            );
          } else if (compactActiveProjection && activeProjectionIndirect) {
            pass.dispatchWorkgroupsIndirect(record.activeDispatchBuffer, 0);
          } else if (dispatchWorkgroups != null) {
            pass.dispatchWorkgroups(dispatchWorkgroups);
          } else {
            pass.dispatchWorkgroups(singleWorkgroup ? 1 : record.workgroups);
          }
          pass.end();
          endTimestamp(encoder, timestamp);
        };
        const preBudgetPasses = [
          [
            'ulg-schroeder-spatial-thermal-derived-prepass',
            'derived-prepass',
            record.derivedPipeline,
            bindGroups.derivedBindGroup,
            false,
            false
          ],
          ...(localActiveProjection
            ? [[
                'ulg-schroeder-spatial-thermal-active-dispatch-finalize',
                'active-dispatch-finalize',
                record.activeDispatchFinalizePipeline,
                bindGroups.activeDispatchFinalizeBindGroup,
                false,
                true
              ]]
            : []),
          [
            'ulg-schroeder-spatial-thermal-directional-budget',
            'directional-budget',
            record.budgetPipeline,
            bindGroups.budgetBindGroup,
            true,
            false
          ]
        ];
        for (const [
          label,
          timestampStage,
          pipelineInfo,
          bindGroup,
          activeProjectionIndirect,
          singleWorkgroup
        ] of preBudgetPasses) {
          encodePass(label, timestampStage, pipelineInfo, bindGroup, {
            activeProjectionIndirect,
            singleWorkgroup
          });
        }
        if (record.candidateCsrEnabled) {
          encodePass(
            'ulg-schroeder-spatial-thermal-csr-validate-rows',
            'candidate-csr-validate-rows',
            record.thermalCandidateCsrValidatePipeline,
            bindGroups.thermalCandidateCsrValidateBindGroup,
            {
              dispatchWorkgroups: Math.max(
                1,
                Math.ceil(
                  record.thermalCandidateCsr.sourceCapacity / WORKGROUP_SIZE
                )
              )
            }
          );
          encodePass(
            'ulg-schroeder-spatial-thermal-csr-seal',
            'candidate-csr-seal',
            record.thermalCandidateCsrSealPipeline,
            bindGroups.thermalCandidateCsrSealBindGroup,
            { singleWorkgroup: true }
          );
        }
        encodePass(
          'ulg-schroeder-spatial-thermal-budget-resolve',
          'budget-resolve',
          record.budgetResolvePipeline,
          bindGroups.budgetResolveBindGroup
        );
        encodePass(
          'ulg-schroeder-spatial-thermal-reciprocal-limited-proposal',
          'reciprocal-limited-proposal',
          record.proposalPipeline,
          bindGroups.proposalBindGroup,
          { activeProjectionIndirect: true }
        );
        record.encoded = true;
        record.lifecycleStatus = 'encoded';
      } catch (error) {
        record.lifecycleStatus = 'encode-failed';
        throw error;
      }
    },
    markSubmittedWork() {
      if (matchedTimeThermalEncoderStages.get(stage) !== record) {
        throw new TypeError('Matched-time thermal encoder stage identity is invalid');
      }
      if (!record.encoded || record.lifecycleStatus !== 'encoded') {
        throw new Error('Matched-time thermal producer was not encoded before submission');
      }
      if (record.submissionObserved) return false;
      record.submissionObserved = true;
      record.lifecycleStatus = 'submitted';
      return true;
    },
    get encoded() { return record.encoded; },
    get submissionObserved() { return record.submissionObserved; }
  });
  record.encoderStage = stage;
  matchedTimeThermalEncoderStages.set(stage, record);
  return stage;
}

function requireClassicThermalBuffer(device, buffer, label, minimumByteLength = 0) {
  if (!buffer || !webGpuBufferMatchesDevice(buffer, device)) {
    throw new TypeError(`${label} must be a live buffer on the classic thermal device`);
  }
  if (
    minimumByteLength > 0
    && Number.isFinite(Number(buffer.size))
    && Number(buffer.size) < minimumByteLength
  ) {
    throw new RangeError(`${label} is smaller than its declared thermal row count`);
  }
  return buffer;
}

function normalizeClassicThermalNeighborBins(
  device,
  neighborBins,
  { stateBuffer, particleCount }
) {
  const fallback = (reason) => Object.freeze({
    ready: false,
    reason,
    binsBuffer: null,
    capacity: 0,
    nx: 0,
    ny: 0,
    nz: 0,
    cellCount: 0,
    cellSizeM: 0
  });
  if (!neighborBins) return fallback('post-separation-bins-missing');
  const resolved = resolvePostSeparationThermalBinAuthority(neighborBins, {
    device,
    stateBuffer,
    particleCount
  });
  if (!resolved) return fallback('post-separation-bin-authority-unproven');
  return Object.freeze({
    ready: true,
    reason: null,
    ...resolved
  });
}

/**
 * Build the classic lookup adapter for the reciprocal thermal v2 law without
 * submitting work. The caller encodes this stage and the canonical apply into
 * one command buffer. Normal production uses the post-separation bin refill;
 * the shader falls back per particle only when the bin contract is unsupported
 * or a visited cell's resident count exceeds its fixed capacity.
 */
export function createClassicThermalProposalWebGpuEncoderStage({
  device,
  sphParticleState,
  stateBuffer,
  thermoBuffer,
  thermalResponseGraphUpload,
  neighborBins = null,
  dtS = 0,
  smoothingLengthM = sphParticleState?.smoothingLengthM ?? 0,
  conductionRate = PAIR_CONDUCTION_RATE_DEFAULT
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('Classic thermal v2 proposals require a WebGPU-like device');
  }
  const particleCount = exactU32(
    sphParticleState?.particleCount,
    'sphParticleState.particleCount',
    { positive: true }
  );
  const sourceStateBuffer = requireClassicThermalBuffer(
    device,
    stateBuffer,
    'stateBuffer',
    particleCount * 2 * 4 * Float32Array.BYTES_PER_ELEMENT
  );
  const sourceThermoBuffer = requireClassicThermalBuffer(
    device,
    thermoBuffer,
    'thermoBuffer',
    particleCount * 3 * 4 * Float32Array.BYTES_PER_ELEMENT
  );
  const responseUpload = resolveThermalResponseUpload(
    device,
    thermalResponseGraphUpload
  );
  const normalizedBins = normalizeClassicThermalNeighborBins(
    device,
    neighborBins,
    { stateBuffer: sourceStateBuffer, particleCount }
  );
  const normalLookupBinned = normalizedBins.ready;
  const proposalShaderCode = normalLookupBinned
    ? classicThermalCandidateProposalWgsl
    : classicThermalProposalWgsl;
  const budgetEntryPoint = 'budget';
  const proposalEntryPoint = 'propose';
  const {
    runtime,
    entry,
    cacheHit,
    execution
  } = acquireClassicThermalRuntimeEntry(device, particleCount);
  const {
    derivedBuffer,
    proposalBuffer,
    conductionEvidenceBuffer,
    radiationEvidenceBuffer,
    conductionExpectationBuffer,
    radiationExpectationBuffer,
    paramsBuffer,
    activeDispatchBuffer,
    lookupPlaceholderBuffer,
    candidateDirectoryBuffer
  } = entry.buffers;
  try {
    device.queue.writeBuffer(
      proposalBuffer,
      0,
      createProposalHeader(execution, particleCount)
    );
    device.queue.writeBuffer(
      conductionEvidenceBuffer,
      0,
      createEvidenceInitial(
        execution,
        SCHROEDER_SPATIAL_SUPPORT_PROFILE_THERMAL_CONDUCTION_V1
      )
    );
    device.queue.writeBuffer(
      radiationEvidenceBuffer,
      0,
      createEvidenceInitial(
        execution,
        SCHROEDER_SPATIAL_SUPPORT_PROFILE_RADIATION_WIDE_V1
      )
    );
    device.queue.writeBuffer(paramsBuffer, 0, createThermalParamsArray({
      particleCount,
      materialCount: responseUpload.materialCount,
      responseCount: responseUpload.responseCount,
      dtS,
      smoothingLengthM,
      conductionRate,
      lookupMode: normalLookupBinned ? 1 : 0,
      neighborBins: normalLookupBinned ? normalizedBins : null,
      candidateCapacity: normalLookupBinned ? entry.candidateCapacity : 0
    }));

    const derivedPipeline = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-classic-thermal-v2-derived-prepass.v6',
      label: 'ulg-classic-thermal-v2-derived-prepass',
      code: schroederSpatialThermalDerivedPrepassWgsl,
      entryPoint: 'derive',
      bindings: [
        computeBufferBinding(0, 'read-only-storage'),
        computeBufferBinding(1, 'read-only-storage'),
        computeBufferBinding(2, 'read-only-storage'),
        computeBufferBinding(3, 'read-only-storage'),
        computeBufferBinding(4, 'read-only-storage'),
        computeBufferBinding(5, 'read-only-storage'),
        computeBufferBinding(6, 'storage'),
        computeBufferBinding(7, 'uniform'),
        computeBufferBinding(8, 'read-only-storage'),
        computeBufferBinding(9, 'read-only-storage'),
        computeBufferBinding(10, 'read-only-storage'),
        computeBufferBinding(11, 'storage')
      ]
    });
    const budgetResolvePipeline = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-classic-thermal-v2-budget-resolve.v6',
      label: 'ulg-classic-thermal-v2-budget-resolve',
      code: schroederSpatialThermalDerivedPrepassWgsl,
      entryPoint: 'resolve_budget',
      bindings: [
        computeBufferBinding(0, 'read-only-storage'),
        computeBufferBinding(1, 'read-only-storage'),
        computeBufferBinding(2, 'read-only-storage'),
        computeBufferBinding(3, 'read-only-storage'),
        computeBufferBinding(4, 'read-only-storage'),
        computeBufferBinding(5, 'read-only-storage'),
        computeBufferBinding(6, 'storage'),
        computeBufferBinding(7, 'uniform'),
        computeBufferBinding(8, 'read-only-storage'),
        computeBufferBinding(9, 'read-only-storage'),
        computeBufferBinding(10, 'read-only-storage'),
        computeBufferBinding(11, 'storage')
      ]
    });
    const budgetPipeline = createCachedExplicitComputePipeline(device, {
      cacheKey: normalLookupBinned
        ? 'ulg-classic-thermal-v2-candidate-budget.v14'
        : 'ulg-classic-thermal-v2-exhaustive-budget.v11',
      label: normalLookupBinned
        ? 'ulg-classic-thermal-v2-binned-budget'
        : 'ulg-classic-thermal-v2-exhaustive-budget',
      code: proposalShaderCode,
      entryPoint: budgetEntryPoint,
      bindings: [
        computeBufferBinding(0, 'read-only-storage'),
        computeBufferBinding(1, 'storage'),
        computeBufferBinding(2, 'read-only-storage'),
        computeBufferBinding(3, 'storage'),
        computeBufferBinding(4, 'storage'),
        computeBufferBinding(5, 'storage'),
        computeBufferBinding(6, 'uniform'),
        computeBufferBinding(7, 'uniform'),
        computeBufferBinding(8, 'uniform'),
        computeBufferBinding(9, 'read-only-storage'),
        computeBufferBinding(10, 'read-only-storage')
      ]
    });
    const proposalPipeline = createCachedExplicitComputePipeline(device, {
      cacheKey: normalLookupBinned
        ? 'ulg-classic-thermal-v2-candidate-proposal.v14'
        : 'ulg-classic-thermal-v2-exhaustive-proposal.v11',
      label: normalLookupBinned
        ? 'ulg-classic-thermal-v2-binned-proposal'
        : 'ulg-classic-thermal-v2-exhaustive-proposal',
      code: proposalShaderCode,
      entryPoint: proposalEntryPoint,
      bindings: [
        computeBufferBinding(0, 'read-only-storage'),
        computeBufferBinding(1, 'storage'),
        computeBufferBinding(2, 'read-only-storage'),
        computeBufferBinding(3, 'storage'),
        computeBufferBinding(4, 'storage'),
        computeBufferBinding(5, 'storage'),
        computeBufferBinding(6, 'uniform'),
        computeBufferBinding(7, 'uniform'),
        computeBufferBinding(8, 'uniform'),
        computeBufferBinding(9, 'read-only-storage'),
        computeBufferBinding(10, 'read-only-storage')
      ]
    });
    const derivedEntries = [
      { binding: 0, resource: { buffer: sourceStateBuffer } },
      { binding: 1, resource: { buffer: sourceThermoBuffer } },
      { binding: 2, resource: { buffer: responseUpload.responseRecordBuffer } },
      { binding: 3, resource: { buffer: responseUpload.responseBuffer } },
      { binding: 4, resource: { buffer: responseUpload.graphNodeBuffer } },
      { binding: 5, resource: { buffer: responseUpload.graphSampleBuffer } },
      { binding: 6, resource: { buffer: derivedBuffer } },
      { binding: 7, resource: { buffer: paramsBuffer } },
      { binding: 8, resource: { buffer: sourceStateBuffer } },
      { binding: 9, resource: { buffer: sourceStateBuffer } },
      { binding: 10, resource: { buffer: sourceStateBuffer } },
      { binding: 11, resource: { buffer: activeDispatchBuffer } }
    ];
    const derivedBindGroup = device.createBindGroup({
      layout: derivedPipeline.bindGroupLayout,
      entries: derivedEntries
    });
    const budgetResolveBindGroup = device.createBindGroup({
      layout: budgetResolvePipeline.bindGroupLayout,
      entries: derivedEntries
    });
    const candidateBuildPipeline = normalLookupBinned
      ? createCachedExplicitComputePipeline(device, {
          cacheKey: 'ulg-classic-thermal-v2-candidate-build.v7',
          label: 'ulg-classic-thermal-v2-candidate-build',
          code: classicThermalCandidateBuildWgsl,
          entryPoint: 'build',
          bindings: [
            computeBufferBinding(0, 'read-only-storage'),
            computeBufferBinding(1, 'read-only-storage'),
            computeBufferBinding(2, 'read-only-storage'),
            computeBufferBinding(3, 'storage'),
            computeBufferBinding(4, 'uniform')
          ]
        })
      : null;
    const candidateBuildBindGroup = candidateBuildPipeline
      ? device.createBindGroup({
          layout: candidateBuildPipeline.bindGroupLayout,
          entries: [
            { binding: 0, resource: { buffer: sourceStateBuffer } },
            { binding: 1, resource: { buffer: derivedBuffer } },
            { binding: 2, resource: { buffer: normalizedBins.binsBuffer } },
            { binding: 3, resource: { buffer: candidateDirectoryBuffer } },
            { binding: 4, resource: { buffer: paramsBuffer } }
          ]
        })
      : null;
    const lookupBuffer = normalLookupBinned
      ? candidateDirectoryBuffer
      : lookupPlaceholderBuffer;
    const proposalEntries = [
      { binding: 0, resource: { buffer: sourceStateBuffer } },
      { binding: 1, resource: { buffer: derivedBuffer } },
      { binding: 2, resource: { buffer: lookupBuffer } },
      { binding: 3, resource: { buffer: proposalBuffer } },
      { binding: 4, resource: { buffer: conductionEvidenceBuffer } },
      { binding: 5, resource: { buffer: radiationEvidenceBuffer } },
      { binding: 6, resource: { buffer: conductionExpectationBuffer } },
      { binding: 7, resource: { buffer: radiationExpectationBuffer } },
      { binding: 8, resource: { buffer: paramsBuffer } },
      { binding: 9, resource: { buffer: sourceStateBuffer } },
      { binding: 10, resource: { buffer: sourceStateBuffer } }
    ];
    const budgetBindGroup = device.createBindGroup({
      layout: budgetPipeline.bindGroupLayout,
      entries: proposalEntries
    });
    const proposalBindGroup = device.createBindGroup({
      layout: proposalPipeline.bindGroupLayout,
      entries: proposalEntries
    });
    const workgroups = Math.max(1, Math.ceil(particleCount / WORKGROUP_SIZE));
    let encoded = false;
    let released = false;
    const encode = (encoder) => {
      if (encoded) throw new Error('Classic thermal v2 proposal stage was encoded twice');
      if (released) throw new Error('Classic thermal v2 proposal stage was already released');
      encoded = true;
      encoder.clearBuffer(derivedBuffer, 0, derivedBufferByteLength(entry.capacity));
      encoder.clearBuffer(
        proposalBuffer,
        SCHROEDER_SPATIAL_THERMAL_PROPOSAL_HEADER_WORDS * Uint32Array.BYTES_PER_ELEMENT,
        particleCount * SCHROEDER_SPATIAL_THERMAL_PROPOSAL_ROW_WORDS
          * Uint32Array.BYTES_PER_ELEMENT
      );
      const derivedPass = encoder.beginComputePass({
        label: 'ulg-classic-thermal-v2-derived-prepass'
      });
      derivedPass.setPipeline(derivedPipeline.pipeline);
      derivedPass.setBindGroup(0, derivedBindGroup);
      derivedPass.dispatchWorkgroups(workgroups);
      derivedPass.end();
      if (candidateBuildPipeline) {
        const candidateBuildPass = encoder.beginComputePass({
          label: 'ulg-classic-thermal-v2-candidate-build'
        });
        candidateBuildPass.setPipeline(candidateBuildPipeline.pipeline);
        candidateBuildPass.setBindGroup(0, candidateBuildBindGroup);
        candidateBuildPass.dispatchWorkgroups(workgroups);
        candidateBuildPass.end();
      }
      const budgetPass = encoder.beginComputePass({
        label: 'ulg-classic-thermal-v2-directional-budget'
      });
      budgetPass.setPipeline(budgetPipeline.pipeline);
      budgetPass.setBindGroup(0, budgetBindGroup);
      budgetPass.dispatchWorkgroups(workgroups);
      budgetPass.end();
      const budgetResolvePass = encoder.beginComputePass({
        label: 'ulg-classic-thermal-v2-budget-resolve'
      });
      budgetResolvePass.setPipeline(budgetResolvePipeline.pipeline);
      budgetResolvePass.setBindGroup(0, budgetResolveBindGroup);
      budgetResolvePass.dispatchWorkgroups(workgroups);
      budgetResolvePass.end();
      const proposalPass = encoder.beginComputePass({
        label: 'ulg-classic-thermal-v2-reciprocal-limited-proposal'
      });
      proposalPass.setPipeline(proposalPipeline.pipeline);
      proposalPass.setBindGroup(0, proposalBindGroup);
      proposalPass.dispatchWorkgroups(workgroups);
      proposalPass.end();
    };
    const cleanupSubmittedWork = () => {
      if (released) return false;
      released = true;
      entry.inUseGenerationId = null;
      entry.releaseScheduled = false;
      return true;
    };
    return Object.freeze({
      schema: ULG_CLASSIC_THERMAL_PROPOSAL_ENCODER_STAGE_SCHEMA,
      status: 'classic-thermal-v2-proposal-stage-ready',
      ready: true,
      backend: 'webgpu',
      particleCount,
      execution,
      proposalBuffer,
      activeProposalByteLength: proposalBufferByteLength(particleCount),
      proposalHeaderWords: SCHROEDER_SPATIAL_THERMAL_PROPOSAL_HEADER_WORDS,
      proposalRowWords: SCHROEDER_SPATIAL_THERMAL_PROPOSAL_ROW_WORDS,
      proposalBufferSchema: ULG_SCHROEDER_SPATIAL_THERMAL_PROPOSAL_BUFFER_SCHEMA,
      conductionEvidenceBuffer,
      radiationEvidenceBuffer,
      lookupMode: normalLookupBinned
        ? 'authenticated-post-separation-binned-with-resident-overflow-fallback'
        : 'immutable-source-deterministic-exhaustive',
      normalLookupBinned,
      residentOverflowFallbackCapable: normalLookupBinned,
      neighborBinsFallbackReason: normalLookupBinned ? null : normalizedBins.reason,
      neighborBinsPositionAuthority: normalLookupBinned
        ? normalizedBins.positionAuthority
        : null,
      fallbackEvidenceWord: 15,
      fallbackEvidenceUnit: 'particle-pass',
      proposalDispatchCount: normalLookupBinned ? 5 : 4,
      producerApplySubmissionPolicy: 'caller-single-command-buffer',
      binnedTraversalCount: normalLookupBinned ? 2 : 0,
      exhaustiveTraversalConfiguredCount: normalLookupBinned ? 0 : 2,
      exhaustiveTraversalPotentialCount: normalLookupBinned ? 2 : 0,
      privateBuildCount: 0,
      schroederSpatialBuildCount: 0,
      fixedCandidateBuildCount: normalLookupBinned ? 1 : 0,
      fullParticleReadbackPerformed: false,
      readbackMode: 'no-full-readback',
      bufferOwnership: 'classic-thermal-device-arena-cache',
      runtimeCacheHit: cacheHit,
      runtimeCapacity: entry.capacity,
      runtimeAllocationCount: runtime.allocationCount,
      encode,
      cleanupSubmittedWork,
      get released() { return released; }
    });
  } catch (error) {
    entry.inUseGenerationId = null;
    entry.releaseScheduled = false;
    throw error;
  }
}
