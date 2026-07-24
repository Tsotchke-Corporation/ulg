import { ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA } from './schroederSpatialEpoch.js';

export const ULG_SCHROEDER_SPATIAL_SUPPORT_PROFILE_SCHEMA =
  'peercompute.ulg.schroeder-spatial-support-profile.v1';
export const ULG_SCHROEDER_SPATIAL_CONSUMER_AUTHENTICATION_SCHEMA =
  'peercompute.ulg.schroeder-spatial-consumer-authentication.v1';
export const ULG_SCHROEDER_SPATIAL_EPOCH_CONSUMER_RECEIPT_SCHEMA =
  'peercompute.ulg.schroeder-spatial-epoch-consumer-receipt.v0';
export const ULG_SCHROEDER_SPATIAL_EXACT_NEAR_GPU_EVIDENCE_SCHEMA =
  'peercompute.ulg.schroeder-spatial-exact-near-gpu-evidence.v1';
export const ULG_SCHROEDER_SPATIAL_EXACT_NEAR_RESIDENT_BINDING_SCHEMA =
  'peercompute.ulg.schroeder-spatial-exact-near-resident-binding.v1';

export const SCHROEDER_SPATIAL_SUPPORT_PROFILE_VERSION = 1;

// The high 16 bits are the contract version and the low 16 bits identify the
// law-neutral support family. Consumers bind one exact ID; changing support
// semantics requires a new ID rather than silently reinterpreting a receipt.
export const SCHROEDER_SPATIAL_SUPPORT_PROFILE_PRESSURE_CONTACT_V1 = 0x0001_0001;
export const SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_DISCOVERY_V1 = 0x0001_0002;
export const SCHROEDER_SPATIAL_SUPPORT_PROFILE_SEPARATION_V1 = 0x0001_0003;
export const SCHROEDER_SPATIAL_SUPPORT_PROFILE_THERMAL_CONDUCTION_V1 = 0x0001_0004;
export const SCHROEDER_SPATIAL_SUPPORT_PROFILE_RADIATION_WIDE_V1 = 0x0001_0005;
export const SCHROEDER_SPATIAL_SUPPORT_PROFILE_MATERIAL_INTERFACE_LOCAL_V1 =
  0x0001_0006;
export const SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_PRODUCT_PLACEMENT_V1 =
  0x0001_0007;

function supportProfile({
  id,
  name,
  consumerFamily,
  artifactFamily,
  phase,
  exactFilter
}) {
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_SUPPORT_PROFILE_SCHEMA,
    version: SCHROEDER_SPATIAL_SUPPORT_PROFILE_VERSION,
    id,
    name,
    consumerFamily,
    artifactFamily,
    phase,
    directorySchema: ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA,
    traversal: 'exact-signed-cell-key-sparse-prefix-csr-v1',
    sourcePositionAuthority: 'same-epoch-pre-integration-particle-state',
    radiusAuthority: 'consumer-uniform-f32',
    broadPhaseEnvelope: 'complete-axis-aligned-cell-envelope',
    exactFilter,
    candidateBudget: null,
    candidateMaterialization: 'consumer-choice-byte-bounded-only',
    overflowPolicy: 'fail-closed',
    fallbackPolicy: 'none-after-canonical-generation-selection'
  });
}

const SUPPORT_PROFILE_LIST = Object.freeze([
  supportProfile({
    id: SCHROEDER_SPATIAL_SUPPORT_PROFILE_PRESSURE_CONTACT_V1,
    name: 'pressure-contact-v1',
    consumerFamily: 'pressure-interface-contact',
    artifactFamily: 'spatial-exact-near-pressure-contact-interface',
    phase: 'pressure-contact-proposal',
    exactFilter: 'law-declared-contact-volume'
  }),
  supportProfile({
    id: SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_DISCOVERY_V1,
    name: 'reaction-discovery-v1',
    consumerFamily: 'reaction-candidate-discovery',
    artifactFamily: 'spatial-exact-near-reaction-discovery',
    phase: 'reaction-discovery-proposal',
    exactFilter: 'euclidean-pair-radius-and-reaction-policy'
  }),
  supportProfile({
    id: SCHROEDER_SPATIAL_SUPPORT_PROFILE_SEPARATION_V1,
    name: 'separation-v1',
    consumerFamily: 'particle-separation',
    artifactFamily: 'spatial-exact-near-separation',
    phase: 'separation-proposal',
    exactFilter: 'euclidean-symmetric-pair-radius'
  }),
  supportProfile({
    id: SCHROEDER_SPATIAL_SUPPORT_PROFILE_THERMAL_CONDUCTION_V1,
    name: 'thermal-conduction-v1',
    consumerFamily: 'thermal-conduction',
    artifactFamily: 'spatial-exact-near-thermal-conduction',
    phase: 'thermal-conduction-proposal',
    exactFilter: 'euclidean-symmetric-pair-radius-and-thermal-policy'
  }),
  supportProfile({
    id: SCHROEDER_SPATIAL_SUPPORT_PROFILE_RADIATION_WIDE_V1,
    name: 'radiation-wide-v1',
    consumerFamily: 'wider-support-radiation',
    artifactFamily: 'spatial-exact-near-thermal-radiation',
    phase: 'thermal-radiation-proposal',
    exactFilter: 'law-declared-wide-radius-and-visibility-policy'
  }),
  supportProfile({
    id: SCHROEDER_SPATIAL_SUPPORT_PROFILE_MATERIAL_INTERFACE_LOCAL_V1,
    name: 'material-interface-local-v1',
    consumerFamily: 'material-interface-local-law',
    artifactFamily: 'spatial-exact-near-local-material-interface',
    phase: 'local-material-interface-proposal',
    exactFilter: 'law-declared-local-radius-and-interface-policy'
  }),
  supportProfile({
    id: SCHROEDER_SPATIAL_SUPPORT_PROFILE_REACTION_PRODUCT_PLACEMENT_V1,
    name: 'reaction-product-placement-v1',
    consumerFamily: 'reaction-product-placement',
    artifactFamily: 'spatial-exact-near-reaction-product-placement',
    phase: 'reaction-product-placement-proposal',
    exactFilter:
      'current-live-product-material-and-resolved-phase-euclidean-capture-distance-slot-tie-break'
  })
]);

export const SCHROEDER_SPATIAL_SUPPORT_PROFILE_CONTRACTS = Object.freeze(
  Object.fromEntries(SUPPORT_PROFILE_LIST.map((profile) => [profile.id, profile]))
);

export const SCHROEDER_SPATIAL_SUPPORT_PROFILE_IDS = Object.freeze(
  SUPPORT_PROFILE_LIST.map((profile) => profile.id)
);

export const SCHROEDER_SPATIAL_EXACT_NEAR_EXPECTATION_V1_LAYOUT = Object.freeze([
  'sourceCount:u32',
  'derivationEnabled:u32',
  'supportProfileId:u32',
  'chartId:u32',
  'levelCount:u32',
  'expectedGenerationId:u32',
  'expectedDeviceOrdinal:u32',
  'expectedLaneOrdinal:u32',
  'expectedLeaseToken:u32',
  'expectedSourceFamilyId:u32',
  'expectedStorageGeneration:u32',
  'expectedPhysicsTick:u32',
  'expectedPhysicsSubstep:u32',
  'expectedPositionEpoch:u32',
  'expectedTopologyEpoch:u32',
  'expectedChartEpoch:u32',
  'expectedLevelEpoch:u32',
  'expectedSupportEpoch:u32',
  'minLevel:i32',
  'baseGridSpacingM:f32',
  'expectedCellKeysOffsetWords:u32',
  'expectedCellOffsetsOffsetWords:u32',
  'expectedCellMembersOffsetWords:u32',
  'expectedParticleToCellOffsetWords:u32',
  'expectedDirectoryCapacityWords:u32',
  'expectedSourceCapacity:u32',
  'expectedCellCapacity:u32'
]);
export const SCHROEDER_SPATIAL_EXACT_NEAR_EXPECTATION_V1_PAYLOAD_WORDS =
  SCHROEDER_SPATIAL_EXACT_NEAR_EXPECTATION_V1_LAYOUT.length;
export const SCHROEDER_SPATIAL_EXACT_NEAR_EXPECTATION_V1_UNIFORM_WORDS = 28;
export const SCHROEDER_SPATIAL_EXACT_NEAR_EXPECTATION_V1_UNIFORM_BYTES =
  SCHROEDER_SPATIAL_EXACT_NEAR_EXPECTATION_V1_UNIFORM_WORDS
    * Uint32Array.BYTES_PER_ELEMENT;

function exactU32(value, label, { positive = false } = {}) {
  if (
    typeof value !== 'number'
    || !Number.isInteger(value)
    || value < (positive ? 1 : 0)
    || value > 0xffff_ffff
  ) {
    throw new RangeError(`${label} must be ${positive ? 'a positive' : 'a'} u32 integer`);
  }
  return value;
}

function exactI32(value, label) {
  if (
    typeof value !== 'number'
    || !Number.isInteger(value)
    || value < -0x8000_0000
    || value > 0x7fff_ffff
  ) {
    throw new RangeError(`${label} must be an i32 integer`);
  }
  return value;
}

function finiteF32(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number`);
  }
  const canonical = Math.fround(value);
  if (!Number.isFinite(canonical)) {
    throw new RangeError(`${label} is not representable as finite f32`);
  }
  return canonical;
}

export function createSchroederSpatialExactNearExpectationV1Data({
  sourceCount,
  derivationEnabled = true,
  supportProfileId,
  chartId,
  levelCount,
  generationId,
  deviceOrdinal,
  laneOrdinal,
  leaseToken,
  sourceFamilyId,
  storageGeneration,
  physicsTick,
  physicsSubstep,
  positionEpoch,
  topologyEpoch,
  chartEpoch,
  levelEpoch,
  supportEpoch,
  minLevel,
  baseGridSpacingM,
  cellKeysOffsetWords,
  cellOffsetsOffsetWords,
  cellMembersOffsetWords,
  particleToCellOffsetWords,
  directoryCapacityWords,
  sourceCapacity,
  cellCapacity
} = {}) {
  if (!resolveSchroederSpatialSupportProfileContract(supportProfileId)) {
    throw new RangeError(`unsupported Schroeder spatial support profile: ${supportProfileId}`);
  }
  const enabled = derivationEnabled === true || derivationEnabled === 1
    ? 1
    : derivationEnabled === false || derivationEnabled === 0
      ? 0
      : null;
  if (enabled == null) {
    throw new TypeError('derivationEnabled must be boolean or 0/1');
  }
  const values = [
    exactU32(sourceCount, 'sourceCount', { positive: true }),
    enabled,
    exactU32(supportProfileId, 'supportProfileId', { positive: true }),
    exactU32(chartId, 'chartId'),
    exactU32(levelCount, 'levelCount', { positive: true }),
    exactU32(generationId, 'generationId', { positive: true }),
    exactU32(deviceOrdinal, 'deviceOrdinal'),
    exactU32(laneOrdinal, 'laneOrdinal'),
    exactU32(leaseToken, 'leaseToken'),
    exactU32(sourceFamilyId, 'sourceFamilyId'),
    exactU32(storageGeneration, 'storageGeneration', { positive: true }),
    exactU32(physicsTick, 'physicsTick'),
    exactU32(physicsSubstep, 'physicsSubstep'),
    exactU32(positionEpoch, 'positionEpoch'),
    exactU32(topologyEpoch, 'topologyEpoch'),
    exactU32(chartEpoch, 'chartEpoch'),
    exactU32(levelEpoch, 'levelEpoch'),
    exactU32(supportEpoch, 'supportEpoch'),
    exactI32(minLevel, 'minLevel'),
    finiteF32(baseGridSpacingM, 'baseGridSpacingM'),
    exactU32(cellKeysOffsetWords, 'cellKeysOffsetWords'),
    exactU32(cellOffsetsOffsetWords, 'cellOffsetsOffsetWords'),
    exactU32(cellMembersOffsetWords, 'cellMembersOffsetWords'),
    exactU32(particleToCellOffsetWords, 'particleToCellOffsetWords'),
    exactU32(directoryCapacityWords, 'directoryCapacityWords', { positive: true }),
    exactU32(sourceCapacity, 'sourceCapacity', { positive: true }),
    exactU32(cellCapacity, 'cellCapacity', { positive: true })
  ];
  if (values[3] > 0x00ff_ffff) {
    throw new RangeError('chartId exceeds exact f32 integer identity');
  }
  if (values[4] > 64) {
    throw new RangeError('levelCount exceeds the exact-near v1 limit of 64');
  }
  if (!(values[19] > 0)) {
    throw new RangeError('baseGridSpacingM must be positive');
  }
  const data = new Uint32Array(
    SCHROEDER_SPATIAL_EXACT_NEAR_EXPECTATION_V1_UNIFORM_WORDS
  );
  for (let index = 0; index < values.length; index += 1) {
    if (index === 18) {
      new Int32Array(data.buffer)[index] = values[index];
    } else if (index === 19) {
      new Float32Array(data.buffer)[index] = values[index];
    } else {
      data[index] = values[index];
    }
  }
  return data;
}

export function resolveSchroederSpatialSupportProfileContract(supportProfileId) {
  if (
    typeof supportProfileId !== 'number'
    || !Number.isInteger(supportProfileId)
    || supportProfileId < 0
    || supportProfileId > 0xffff_ffff
  ) return null;
  return SCHROEDER_SPATIAL_SUPPORT_PROFILE_CONTRACTS[supportProfileId] ?? null;
}

export function validateSchroederSpatialSupportProfileDescriptor(
  descriptor,
  { supportProfileId, supportEpoch } = {}
) {
  if (
    !descriptor
    || descriptor.schema !== ULG_SCHROEDER_SPATIAL_SUPPORT_PROFILE_SCHEMA
    || descriptor.version !== SCHROEDER_SPATIAL_SUPPORT_PROFILE_VERSION
  ) {
    return {
      admitted: false,
      status: 'schroeder-spatial-support-profile-rejected-schema'
    };
  }
  const contract = resolveSchroederSpatialSupportProfileContract(descriptor.id);
  if (!contract || descriptor.name !== contract.name) {
    return {
      admitted: false,
      status: 'schroeder-spatial-support-profile-rejected-id'
    };
  }
  if (supportProfileId !== undefined && descriptor.id !== supportProfileId) {
    return {
      admitted: false,
      status: 'schroeder-spatial-support-profile-rejected-expected-id',
      expected: supportProfileId,
      actual: descriptor.id
    };
  }
  if (
    supportEpoch !== undefined
    && (
      !Number.isInteger(descriptor.supportEpoch)
      || descriptor.supportEpoch !== supportEpoch
    )
  ) {
    return {
      admitted: false,
      status: 'schroeder-spatial-support-profile-rejected-support-epoch',
      expected: supportEpoch,
      actual: descriptor.supportEpoch
    };
  }
  return {
    admitted: true,
    status: 'schroeder-spatial-support-profile-admitted',
    contract
  };
}

export function createSchroederSpatialSupportProfileDescriptor({
  supportProfileId,
  supportEpoch,
  sourceCount
} = {}) {
  const contract = resolveSchroederSpatialSupportProfileContract(supportProfileId);
  if (!contract) {
    throw new RangeError(`unsupported Schroeder spatial support profile: ${supportProfileId}`);
  }
  if (
    !Number.isInteger(supportEpoch)
    || supportEpoch < 0
    || supportEpoch > 0xffff_ffff
  ) {
    throw new RangeError('supportEpoch must be a u32 integer');
  }
  if (
    !Number.isInteger(sourceCount)
    || sourceCount < 1
    || sourceCount > 0xffff_ffff
  ) {
    throw new RangeError('sourceCount must be a positive u32 integer');
  }
  return Object.freeze({
    ...contract,
    supportEpoch,
    sourceCount,
    status: 'schroeder-spatial-support-profile-ready',
    ready: true
  });
}
