export const ULG_SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_RECEIPT_SCHEMA =
  'peercompute.ulg.schroeder-spatial-topology-transition-receipt.v1';

// "STP8". This fixed-size receipt is the only host observation required to
// decide whether the successor particle family advances topologyEpoch.
export const SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_MAGIC = 0x53545038;
export const SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_VERSION = 1;
export const SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_FINAL_SEAL = 0x5345414c;
export const SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_WORDS = 24;
export const SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_BYTES =
  SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_WORDS
  * Uint32Array.BYTES_PER_ELEMENT;
export const SCHROEDER_SPATIAL_TOPOLOGY_STATE_STRIDE_WORDS = 8;

export const SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_STATUS = Object.freeze({
  PENDING: 0,
  COMPLETE: 1,
  INVALID_MASS: 2,
  INCOMPLETE_DISPATCH: 3,
  EPOCH_EXHAUSTED: 4,
  CONTRACT_REJECTED: 5
});

export const SCHROEDER_SPATIAL_TOPOLOGY_TRANSITION_LAYOUT = Object.freeze([
  'magic:u32',
  'version:u32',
  'generationId:u32',
  'submissionNonce:u32',
  'sourceTopologyEpoch:u32',
  'sourceParticleCount:u32',
  'successorParticleCount:u32',
  'comparisonParticleCount:u32',
  'comparePassCount:u32',
  'visitedCount:u32',
  'sourceActiveCount:u32',
  'successorActiveCount:u32',
  'activatedCount:u32',
  'deactivatedCount:u32',
  'activeMaskXorCount:u32',
  'invalidSourceMassCount:u32',
  'invalidSuccessorMassCount:u32',
  'forceTopologyAdvance:u32',
  'sealPassCount:u32',
  'topologyChanged:u32',
  'nextTopologyEpoch:u32',
  'status:u32',
  'reserved:u32',
  'finalSeal:u32'
]);
