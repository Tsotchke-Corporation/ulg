export const ULG_RESIDENT_NEIGHBORHOOD_DESCRIPTOR_SCHEMA =
  'peercompute.ulg.resident-neighborhood-descriptor.v0';
export const ULG_RESIDENT_NEIGHBORHOOD_CAPACITY_EVIDENCE_SCHEMA =
  'peercompute.ulg.resident-neighborhood-capacity-evidence.v0';

export const RESIDENT_NEIGHBORHOOD_EVIDENCE_VERSION = 0;

export const RESIDENT_NEIGHBORHOOD_CONSUMER = Object.freeze({
  MECHANICS: 1 << 0,
  CONTACT: 1 << 1,
  THERMAL: 1 << 2,
  RADIATION: 1 << 3,
  REACTION: 1 << 4,
  PRESSURE_INTERFACE: 1 << 5,
  SOLID_KINEMATICS: 1 << 6,
  SS_UNIQUE_NODE_COMPACTION: 1 << 7
});

export const RESIDENT_NEIGHBORHOOD_ALL_CONSUMER_MASK = Object.values(
  RESIDENT_NEIGHBORHOOD_CONSUMER
).reduce((mask, value) => (mask | value) >>> 0, 0);

export const RESIDENT_NEIGHBORHOOD_SUPPORT_FLAG = Object.freeze({
  EXACT_NEAR_REQUIRED: 1 << 0,
  INCLUDE_SOURCE_CELL: 1 << 1,
  EXCLUDE_SELF: 1 << 2,
  CROSS_LEVEL: 1 << 3,
  CROSS_CHART: 1 << 4,
  AGGREGATE_FAR_ALLOWED: 1 << 5
});

export const RESIDENT_NEIGHBORHOOD_STATUS_FLAG = Object.freeze({
  READY: 1 << 0,
  OVERFLOW: 1 << 1,
  FAIL_CLOSED: 1 << 2,
  LEASE_BOUND: 1 << 3,
  GENERATION_BOUND: 1 << 4,
  CONSUMER_DISPATCH_ADMITTED: 1 << 5,
  REBUILD_REQUIRED: 1 << 6
});

// The first five words are the structural sort/unique key. Generation binds a
// key row to one resident build without making a hash the source of identity.
export const RESIDENT_NEIGHBORHOOD_CELL_KEY_U32_LAYOUT = Object.freeze([
  'chartId:u32',
  'levelOrderKey:u32',
  'cellXOrderKey:u32',
  'cellYOrderKey:u32',
  'cellZOrderKey:u32',
  'generation:u32',
  'keyFlags:u32',
  'reserved0:u32'
]);

export const RESIDENT_NEIGHBORHOOD_CELL_KEY_STRUCTURAL_WORDS = 5;
export const RESIDENT_NEIGHBORHOOD_CELL_KEY_IDENTITY_WORDS = 6;

export const RESIDENT_NEIGHBORHOOD_SUPPORT_CLASS_U32_LAYOUT = Object.freeze([
  'supportClassId:u32',
  'consumerMask:u32',
  'minLevelDeltaOrderKey:u32',
  'maxLevelDeltaOrderKey:u32',
  'cellRadius:u32',
  'maxCandidatesPerSource:u32',
  'generation:u32',
  'supportFlags:u32'
]);

export const RESIDENT_NEIGHBORHOOD_SOURCE_SPAN_U32_LAYOUT = Object.freeze([
  'candidateOffset:u32',
  'candidateCount:u32',
  'supportClassId:u32',
  'generation:u32'
]);

export const RESIDENT_NEIGHBORHOOD_CSR_OFFSET_U32_LAYOUT = Object.freeze([
  'offset:u32'
]);

export const RESIDENT_NEIGHBORHOOD_CANDIDATE_U32_LAYOUT = Object.freeze([
  'targetIndex:u32',
  'matchedConsumerMask:u32'
]);

// One compact row is suitable for a fixed-size diagnostic readback. Required,
// admitted, capacity, and overflow values remain distinct so no consumer can
// silently treat a truncated neighborhood as authoritative.
export const RESIDENT_NEIGHBORHOOD_CAPACITY_EVIDENCE_U32_LAYOUT = Object.freeze([
  'evidenceVersion:u32',
  'generation:u32',
  'leaseTokenLow:u32',
  'leaseTokenHigh:u32',
  'sourceCount:u32',
  'requiredUniqueCellCount:u32',
  'admittedUniqueCellCount:u32',
  'uniqueCellCapacity:u32',
  'overflowUniqueCellCount:u32',
  'requiredCellOffsetCount:u32',
  'admittedCellOffsetCount:u32',
  'cellOffsetCapacity:u32',
  'overflowCellOffsetCount:u32',
  'requiredCellMemberCount:u32',
  'admittedCellMemberCount:u32',
  'cellMemberCapacity:u32',
  'overflowCellMemberCount:u32',
  'requiredSourceOffsetCount:u32',
  'admittedSourceOffsetCount:u32',
  'sourceOffsetCapacity:u32',
  'overflowSourceOffsetCount:u32',
  'requiredCandidateCount:u32',
  'admittedCandidateCount:u32',
  'candidateCapacity:u32',
  'overflowCandidateCount:u32',
  'requiredBytesLow:u32',
  'requiredBytesHigh:u32',
  'admittedBytesLow:u32',
  'admittedBytesHigh:u32',
  'byteCapacityLow:u32',
  'byteCapacityHigh:u32',
  'overflowBytesLow:u32',
  'overflowBytesHigh:u32',
  'consumerMask:u32',
  'supportClassCount:u32',
  'statusFlags:u32',
  'failClosed:u32',
  'consumerDispatchAllowed:u32',
  'reserved0:u32',
  'reserved1:u32'
]);
