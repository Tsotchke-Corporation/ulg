export const ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCHEMA =
  'peercompute.ulg.schroeder-spatial-phase-volume-transport.v1';

export const SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_PARAMS_BYTES = 256;
export const SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_WORKGROUP_SIZE = 64;
export const SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCRATCH_MAGIC = 0x53543931;
export const SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCRATCH_VERSION = 1;
export const SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCRATCH_HEADER_WORDS = 8;
export const SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCRATCH_ROW_WORDS = 12;
export const SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCRATCH_ROW_READY =
  0x53545231;

export const SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_ACCUMULATOR = Object.freeze({
  localHeatJ: 0,
  localHeatContributionCount: 1,
  parentRouteHeatJ: 2,
  localPressureInternalCompensationJ: 3,
  localReversibleStressInternalCompensationJ: 3,
  ambientImpulseXNs: 4,
  ambientImpulseYNs: 5,
  ambientImpulseZNs: 6,
  ambientWorkJ: 7
});

export const SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_ABI = Object.freeze({
  schema: ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCHEMA,
  paramsBytes: SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_PARAMS_BYTES,
  workgroupSize: SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_WORKGROUP_SIZE,
  topology:
    'exact-s9c-sparse-local-head-ranges-with-virtual-pairs-no-materialized-pair-graph',
  volumeAuthority: 's9a-current-volume-v0-times-j-only',
  materialAuthority:
    'exact-mechanics-material-phase-records-rest-density-sound-speed-viscosity-surface-tension',
  localConservation:
    'antisymmetric-pressure-drag-and-cartesian-surface-stress-impulses;drag-loss-to-local-heat;reversible-pressure-and-capillary-work-to-signed-compensation-ledger',
  surfaceStress:
    's9a-color-gradient-css-on-exact-same-level-cartesian-faces;affine-parent-routes-are-not-physical-faces',
  ambientBoundary:
    'hydrostatic-reference-density-buoyancy-with-explicit-external-impulse-and-work-ledger',
  fallbackPolicy:
    'fail-closed-no-density-render-radius-private-grid-cpu-or-unverified-buffer-fallback'
});

export function schroederSpatialPhaseVolumeTransportScratchWordLength(
  fieldCapacity
) {
  const capacity = Math.max(0, Math.floor(Number(fieldCapacity) || 0));
  return SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCRATCH_HEADER_WORDS
    + capacity * SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCRATCH_ROW_WORDS;
}

export function createSchroederSpatialPhaseVolumeTransportScratchHeader({
  fieldCapacity,
  generationId,
  fieldCompletionOrdinal
} = {}) {
  const capacity = Math.max(0, Math.floor(Number(fieldCapacity) || 0)) >>> 0;
  const generation = Math.max(0, Math.floor(Number(generationId) || 0)) >>> 0;
  const completion =
    Math.max(0, Math.floor(Number(fieldCompletionOrdinal) || 0)) >>> 0;
  const header = new Uint32Array(
    SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCRATCH_HEADER_WORDS
  );
  header[0] =
    SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCRATCH_MAGIC >>> 0;
  header[1] =
    SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCRATCH_VERSION >>> 0;
  header[2] = 0;
  header[3] = capacity;
  header[4] = generation;
  header[5] = completion;
  header[6] =
    SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCRATCH_ROW_WORDS >>> 0;
  header[7] = (
    SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCRATCH_MAGIC
    ^ SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCRATCH_VERSION
    ^ capacity
    ^ generation
    ^ completion
    ^ SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCRATCH_ROW_WORDS
  ) >>> 0;
  return header;
}
