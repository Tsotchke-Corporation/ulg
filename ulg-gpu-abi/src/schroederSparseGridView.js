export const ULG_SCHROEDER_SPARSE_GRID_VIEW_SCHEMA =
  'peercompute.ulg.schroeder-sparse-grid-view.v1';
export const ULG_SCHROEDER_SPARSE_GRID_VIEW_EXECUTION_SCHEMA =
  'peercompute.ulg.schroeder-sparse-grid-view-execution.v1';

export const SCHROEDER_SPARSE_GRID_VIEW_HEADER_WORDS = 16;
export const SCHROEDER_SPARSE_GRID_VIEW_DISPATCH_WORDS = 9;
export const SCHROEDER_SPARSE_GRID_VIEW_STENCIL_WIDTH = 3;
export const SCHROEDER_SPARSE_GRID_VIEW_STENCIL_NODE_COUNT =
  SCHROEDER_SPARSE_GRID_VIEW_STENCIL_WIDTH ** 3;
export const SCHROEDER_SPARSE_GRID_VIEW_INVALID_INDEX = 0xffffffff;

export const SCHROEDER_SPARSE_GRID_VIEW_HEADER_LAYOUT = Object.freeze([
  'generation_id:u32',
  'active_node_count:u32',
  'requested_unique_node_count:u32',
  'admitted:u32',
  'overflow_flags:u32',
  'full_grid_node_count:u32',
  'node_capacity:u32',
  'selected_level_bits:u32',
  'chart_id_bits:u32',
  'stencil_width:u32',
  'hash_key_word_offset:u32',
  'hash_value_word_offset:u32',
  'reverse_mapping_word_offset:u32',
  'hash_capacity:u32',
  'status:u32',
  'hierarchy_unique_node_count:u32'
]);

export const SCHROEDER_SPARSE_GRID_VIEW_DISPATCH_LAYOUT = Object.freeze([
  'consumer_workgroup_count_x:u32',
  'consumer_workgroup_count_y:u32',
  'consumer_workgroup_count_z:u32',
  'reserved_workgroup_count_x:u32',
  'reserved_workgroup_count_y:u32',
  'reserved_workgroup_count_z:u32',
  'materialize_workgroup_count_x:u32',
  'materialize_workgroup_count_y:u32',
  'materialize_workgroup_count_z:u32'
]);

export const SCHROEDER_SPARSE_GRID_VIEW_OVERFLOW_NODE_ARENA = 1 << 0;
export const SCHROEDER_SPARSE_GRID_VIEW_OVERFLOW_HASH_PROBE = 1 << 1;
export const SCHROEDER_SPARSE_GRID_VIEW_OVERFLOW_DISPATCH = 1 << 2;
export const SCHROEDER_SPARSE_GRID_VIEW_OVERFLOW_SOURCE_IDENTITY = 1 << 3;
export const SCHROEDER_SPARSE_GRID_VIEW_OVERFLOW_PRIMITIVE = 1 << 4;
export const SCHROEDER_SPARSE_GRID_VIEW_OVERFLOW_UNSUPPORTED_SOURCE = 1 << 5;

export const SCHROEDER_SPARSE_GRID_VIEW_SOURCE_PRODUCT_EVENT = 1 << 0;
export const SCHROEDER_SPARSE_GRID_VIEW_SOURCE_PRESSURE_FORCE = 1 << 1;

export const SCHROEDER_SPARSE_GRID_VIEW_STATUS_READY = 1 << 0;
export const SCHROEDER_SPARSE_GRID_VIEW_STATUS_ADMITTED = 1 << 1;
export const SCHROEDER_SPARSE_GRID_VIEW_STATUS_FAIL_CLOSED = 1 << 2;

export const ULG_SCHROEDER_SPARSE_GRID_VIEW_ABI = Object.freeze({
  schema: ULG_SCHROEDER_SPARSE_GRID_VIEW_SCHEMA,
  executionSchema: ULG_SCHROEDER_SPARSE_GRID_VIEW_EXECUTION_SCHEMA,
  headerLayout: SCHROEDER_SPARSE_GRID_VIEW_HEADER_LAYOUT,
  dispatchLayout: SCHROEDER_SPARSE_GRID_VIEW_DISPATCH_LAYOUT,
  keyEncoding: 'dense-z-fastest-full-grid-node-index-u32',
  candidateGeneration:
    'current-particle-product-event-and-pressure-row-invocations-emit-only-in-bounds-nonzero-quadratic-stencil-keys',
  gridSpacingAuthority:
    'production-p2g-grid-spacing-when-bound-otherwise-schroeder-level-assignment-native-spacing',
  uniqueness:
    'gpu-open-addressed-set-before-stable-u32-radix-scan-unique-compaction',
  compactOrdering: 'ascending-full-grid-node-index',
  capacityAuthority: 'byte-bounded-unique-node-arena',
  overflowPolicy: 'fixed-evidence-and-zero-consumer-indirect-fail-closed',
  sourceFamilies: Object.freeze({
    particleState: 'implemented',
    reactionProductEvents: 'implemented-gpu-metadata-and-resident-identity-guarded',
    pressureForceRows: 'implemented-gpu-metadata-and-resident-identity-guarded'
  }),
  submissionOwnership: 'caller',
  readbackPolicy: 'fixed-header-and-explicit-manufactured-samples-only',
  cpuReferenceRequired: false
});
