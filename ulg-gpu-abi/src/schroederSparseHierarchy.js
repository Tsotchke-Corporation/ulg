export const ULG_SCHROEDER_SPARSE_HIERARCHY_SCHEMA =
  'peercompute.ulg.schroeder-sparse-hierarchy.v0';
export const ULG_SCHROEDER_SPARSE_HIERARCHY_EXECUTION_SCHEMA =
  'peercompute.ulg.schroeder-sparse-hierarchy-execution.v0';

export const SCHROEDER_SPARSE_HIERARCHY_KEY_WORDS = 5;
export const SCHROEDER_SPARSE_HIERARCHY_EVIDENCE_WORDS = 16;
export const SCHROEDER_SPARSE_HIERARCHY_NODE_WORDS = 16;

export const SCHROEDER_SPARSE_HIERARCHY_KEY_LAYOUT = Object.freeze([
  'chart_id_sortable:u32',
  'level_id_sortable:u32',
  'tile_x_sortable:u32',
  'tile_y_sortable:u32',
  'tile_z_sortable:u32'
]);

export const SCHROEDER_SPARSE_HIERARCHY_NODE_LAYOUT = Object.freeze([
  ...SCHROEDER_SPARSE_HIERARCHY_KEY_LAYOUT,
  'source_span_offset:u32',
  'source_span_end:u32',
  'source_count:u32',
  'level_id_bits:u32',
  'chart_id_bits:u32',
  'tile_x_bits:u32',
  'tile_y_bits:u32',
  'tile_z_bits:u32',
  'generation_id:u32',
  'status:u32',
  'pad0:u32'
]);

export const SCHROEDER_SPARSE_HIERARCHY_EVIDENCE_LAYOUT = Object.freeze([
  'generation_id:u32',
  'source_row_count:u32',
  'route_capacity:u32',
  'requested_route_count:u32',
  'emitted_route_count:u32',
  'unique_node_count:u32',
  'admitted:u32',
  'overflow_flags:u32',
  'invalid_source_count:u32',
  'source_span_limit_count:u32',
  'retained_arena_bytes:u32',
  'scratch_arena_bytes:u32',
  'fine_level_bits:u32',
  'coarse_level_bits:u32',
  'status:u32',
  'third_level_hold:u32'
]);

export const SCHROEDER_SPARSE_HIERARCHY_OVERFLOW_ROUTE_ARENA = 1 << 0;
export const SCHROEDER_SPARSE_HIERARCHY_OVERFLOW_INVALID_SOURCE = 1 << 1;
export const SCHROEDER_SPARSE_HIERARCHY_OVERFLOW_SOURCE_SPAN = 1 << 2;
export const SCHROEDER_SPARSE_HIERARCHY_OVERFLOW_RETAINED_BUDGET = 1 << 3;
export const SCHROEDER_SPARSE_HIERARCHY_OVERFLOW_SCRATCH_BUDGET = 1 << 4;

export const SCHROEDER_SPARSE_HIERARCHY_STATUS_READY = 1 << 0;
export const SCHROEDER_SPARSE_HIERARCHY_STATUS_ADMITTED = 1 << 1;
export const SCHROEDER_SPARSE_HIERARCHY_STATUS_FAIL_CLOSED = 1 << 2;

export const ULG_SCHROEDER_SPARSE_HIERARCHY_ABI = Object.freeze({
  schema: ULG_SCHROEDER_SPARSE_HIERARCHY_SCHEMA,
  executionSchema: ULG_SCHROEDER_SPARSE_HIERARCHY_EXECUTION_SCHEMA,
  keyEncoding: 'signed-i32-xor-0x80000000-in-u32',
  keyOrdering: 'chart-level-x-y-z',
  keyLayout: SCHROEDER_SPARSE_HIERARCHY_KEY_LAYOUT,
  nodeLayout: SCHROEDER_SPARSE_HIERARCHY_NODE_LAYOUT,
  evidenceLayout: SCHROEDER_SPARSE_HIERARCHY_EVIDENCE_LAYOUT,
  sourceMembership: 'stable-sorted-route-indices-with-exact-csr-sentinel',
  arenaOwnership: 'compute-manager-gpu-lane-byte-budgeted',
  submissionOwnership: 'caller',
  readbackPolicy: 'fixed-evidence-and-explicit-manufactured-samples-only',
  levelLimit: 2,
  thirdLevelStatus: 'on-hold'
});
