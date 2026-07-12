export const ULG_SPH_GPU_SPARSE_RENDER_FIELD_EXECUTION_SCHEMA =
  'peercompute.ulg.sph-gpu-sparse-render-field-execution.v0';

export const SPH_GPU_SPARSE_RENDER_FIELD_ELIGIBLE_PAIR_ROW_LAYOUT = Object.freeze([
  'sourceIndex:u32',
  'sourceKind:u32',
  'surfaceSlot:u32',
  'status:u32'
]);

export const SPH_GPU_SPARSE_RENDER_FIELD_ROUTE_RANGE_ROW_LAYOUT = Object.freeze([
  'routeOffset:u32',
  'routeCount:u32',
  'generationId:u32',
  'status:u32'
]);

export const SPH_GPU_SPARSE_RENDER_FIELD_CANDIDATE_SLICE_ROW_LAYOUT = Object.freeze([
  'offsetU32:u32',
  'capacity:u32',
  'counterIndex:u32',
  'surfaceIndex:u32'
]);

export const SPH_GPU_SPARSE_RENDER_FIELD_ACTIVE_CANDIDATE_ROW_LAYOUT = Object.freeze([
  'surfaceIndex:u32',
  'brickX:u32',
  'brickY:u32',
  'brickZ:u32',
  'directoryIndex:u32',
  'activationFlags:u32',
  'generationId:u32',
  'status:u32'
]);

export const SPH_GPU_SPARSE_RENDER_FIELD_RUNTIME_EVIDENCE_ROW_LAYOUT = Object.freeze([
  'generationId:u32',
  'surfaceCount:u32',
  'particleCount:u32',
  'productEventCount:u32',
  'eligibilityCandidateCount:u32',
  'eligiblePairCapacity:u32',
  'eligiblePairCount:u32',
  'eligiblePairOverflowCount:u32',
  'routeCandidateCount:u32',
  'routeCapacity:u32',
  'routeCount:u32',
  'routeOverflowCount:u32',
  'activeCandidateCapacity:u32',
  'activeBrickCapacity:u32',
  'activeBrickCount:u32',
  'activeBrickOverflowCount:u32',
  'atlasCellRequiredCount:u32',
  'atlasCellCapacity:u32',
  'activeVoxelRequiredCount:u32',
  'activeVoxelCapacity:u32',
  'overflowFlags:u32',
  'admissionFlags:u32',
  'generationPublicationAllowed:u32',
  'failClosed:u32',
  'retainPreviousAcceptedGeneration:u32',
  'status:u32',
  'retainedByteLengthLow:u32',
  'retainedByteLengthHigh:u32',
  'allocatedByteLengthLow:u32',
  'allocatedByteLengthHigh:u32',
  'maxParticleSurfacesPerSource:u32',
  'maxProductSurfacesPerEvent:u32',
  'routeFanoutRadiusBricks:u32',
  'directActiveBrickCount:u32',
  'haloOnlyBrickCount:u32',
  'reserved0:u32'
]);

export const SPH_GPU_SPARSE_RENDER_FIELD_ACTIVE_VOXEL_UNUSED = 0xffffffff;
export const SPH_GPU_SPARSE_RENDER_FIELD_OVERFLOW_ELIGIBLE_PAIRS = 1 << 6;

const sparseParamsWgsl = /* wgsl */ `
struct SparseParams {
  particle_count: u32,
  product_event_count: u32,
  surface_count: u32,
  eligibility_candidate_count: u32,
  eligible_pair_capacity: u32,
  route_candidate_count: u32,
  route_capacity: u32,
  route_fanout_radius_bricks: u32,
  route_fanout_volume: u32,
  generation_id: u32,
  directory_capacity: u32,
  active_candidate_capacity: u32,
  active_brick_capacity: u32,
  atlas_cell_capacity: u32,
  active_voxel_capacity: u32,
  host_overflow_flags: u32,
  host_admitted: u32,
  max_particle_surfaces_per_source: u32,
  max_product_surfaces_per_event: u32,
  brick_size: u32,
  field_padding: f32,
  ref_edge_m: f32,
  render_smear_dt_s: f32,
  _pad0: f32,
  retained_bytes_low: u32,
  retained_bytes_high: u32,
  allocated_bytes_low: u32,
  allocated_bytes_high: u32,
  dispatch_width: u32,
  candidate_voxel_buffer_words: u32,
  _pad3: u32,
  _pad4: u32,
};

const SPARSE_SENTINEL: u32 = 0xffffffffu;
const SPARSE_READY: u32 = 1u;
const SPARSE_BLOCKED: u32 = 2u;
const SPARSE_SOURCE_PARTICLE: u32 = 0u;
const SPARSE_SOURCE_PRODUCT_EVENT: u32 = 1u;
const SPARSE_ACTIVE_DIRECT: u32 = 1u;
const SPARSE_ACTIVE_HALO: u32 = 2u;
const SPARSE_ACTIVE_PREDECESSOR_X: u32 = 4u;
const SPARSE_ACTIVE_PREDECESSOR_Y: u32 = 8u;
const SPARSE_ACTIVE_PREDECESSOR_Z: u32 = 16u;
const SPARSE_OVERFLOW_ROUTES: u32 = 2u;
const SPARSE_OVERFLOW_ACTIVE_BRICKS: u32 = 4u;
const SPARSE_OVERFLOW_ATLAS: u32 = 8u;
const SPARSE_OVERFLOW_VOXELS: u32 = 16u;
const SPARSE_OVERFLOW_ELIGIBLE_PAIRS: u32 = 64u;
const SPARSE_ADMISSION_APPROVED: u32 = 1u;
const SPARSE_ADMISSION_FAIL_CLOSED: u32 = 2u;
const SPARSE_ADMISSION_RETAIN_PREVIOUS: u32 = 4u;

const EVIDENCE_GENERATION: u32 = 0u;
const EVIDENCE_SURFACE_COUNT: u32 = 1u;
const EVIDENCE_PARTICLE_COUNT: u32 = 2u;
const EVIDENCE_PRODUCT_COUNT: u32 = 3u;
const EVIDENCE_ELIGIBILITY_CANDIDATES: u32 = 4u;
const EVIDENCE_ELIGIBLE_CAPACITY: u32 = 5u;
const EVIDENCE_ELIGIBLE_COUNT: u32 = 6u;
const EVIDENCE_ELIGIBLE_OVERFLOW: u32 = 7u;
const EVIDENCE_ROUTE_CANDIDATES: u32 = 8u;
const EVIDENCE_ROUTE_CAPACITY: u32 = 9u;
const EVIDENCE_ROUTE_COUNT: u32 = 10u;
const EVIDENCE_ROUTE_OVERFLOW: u32 = 11u;
const EVIDENCE_ACTIVE_CANDIDATES: u32 = 12u;
const EVIDENCE_ACTIVE_CAPACITY: u32 = 13u;
const EVIDENCE_ACTIVE_COUNT: u32 = 14u;
const EVIDENCE_ACTIVE_OVERFLOW: u32 = 15u;
const EVIDENCE_ATLAS_REQUIRED: u32 = 16u;
const EVIDENCE_ATLAS_CAPACITY: u32 = 17u;
const EVIDENCE_VOXEL_REQUIRED: u32 = 18u;
const EVIDENCE_VOXEL_CAPACITY: u32 = 19u;
const EVIDENCE_OVERFLOW_FLAGS: u32 = 20u;
const EVIDENCE_ADMISSION_FLAGS: u32 = 21u;
const EVIDENCE_PUBLICATION_ALLOWED: u32 = 22u;
const EVIDENCE_FAIL_CLOSED: u32 = 23u;
const EVIDENCE_RETAIN_PREVIOUS: u32 = 24u;
const EVIDENCE_STATUS: u32 = 25u;
const EVIDENCE_RETAINED_LOW: u32 = 26u;
const EVIDENCE_RETAINED_HIGH: u32 = 27u;
const EVIDENCE_ALLOCATED_LOW: u32 = 28u;
const EVIDENCE_ALLOCATED_HIGH: u32 = 29u;
const EVIDENCE_MAX_PARTICLE_SURFACES: u32 = 30u;
const EVIDENCE_MAX_PRODUCT_SURFACES: u32 = 31u;
const EVIDENCE_FANOUT_RADIUS: u32 = 32u;
const EVIDENCE_DIRECT_ACTIVE: u32 = 33u;
const EVIDENCE_HALO_ONLY: u32 = 34u;

fn sparse_linear_index(global_id: vec3<u32>) -> u32 {
  return global_id.x + global_id.y * params.dispatch_width * 64u;
}
`;

export const sphSparseRenderFieldRouteWgsl = /* wgsl */ `
${sparseParamsWgsl}

@group(0) @binding(0) var<storage, read> render_rows: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> render_surfaces: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> sparse_surfaces: array<u32>;
@group(0) @binding(3) var<storage, read> product_events: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> eligibility_flags: array<u32>;
@group(0) @binding(5) var<storage, read> eligibility_offsets: array<u32>;
@group(0) @binding(6) var<storage, read_write> eligible_pairs: array<u32>;
@group(0) @binding(7) var<storage, read_write> route_flags: array<u32>;
@group(0) @binding(8) var<storage, read> route_offsets: array<u32>;
@group(0) @binding(9) var<storage, read_write> route_rows: array<u32>;
@group(0) @binding(10) var<storage, read_write> route_keys: array<u32>;
@group(0) @binding(11) var<storage, read_write> evidence: array<atomic<u32>>;
@group(0) @binding(12) var<uniform> params: SparseParams;

fn render_phase_weight(surface_phase: f32, row_phase: f32, gas_fraction: f32, solid_fraction: f32) -> f32 {
  let gas = clamp(gas_fraction, 0.0, 1.0);
  let solid = clamp(solid_fraction, 0.0, 1.0);
  let liquid = clamp(1.0 - gas - solid, 0.0, 1.0);
  if (surface_phase == 1.0) { return solid; }
  if (surface_phase == 2.0) { return liquid; }
  if (surface_phase == 3.0) { return gas; }
  return select(0.0, 1.0, row_phase == surface_phase);
}

fn finite_position(value: vec3<f32>) -> bool {
  return !any(isNan(value)) && !any(isInf(value));
}

fn source_surface_eligible(source_ordinal: u32, surface_slot: u32) -> bool {
  if (surface_slot >= params.surface_count) { return false; }
  let s0 = render_surfaces[surface_slot * 4u];
  let s3 = render_surfaces[surface_slot * 4u + 3u];
  if (source_ordinal < params.particle_count) {
    let row0 = render_rows[source_ordinal * 5u];
    let row1 = render_rows[source_ordinal * 5u + 1u];
    let row2 = render_rows[source_ordinal * 5u + 2u];
    let row4 = render_rows[source_ordinal * 5u + 4u];
    if (!finite_position(row0.xyz)) { return false; }
    if (row1.x != s0.x || (s3.x > 0.0 && row2.w != s3.x)) { return false; }
    return render_phase_weight(s0.y, row1.y, row2.y, row4.x) > 0.003;
  }
  let event_index = source_ordinal - params.particle_count;
  if (event_index >= params.product_event_count) { return false; }
  let e0 = product_events[event_index * 8u];
  let e1 = product_events[event_index * 8u + 1u];
  let e2 = product_events[event_index * 8u + 2u];
  let e3 = product_events[event_index * 8u + 3u];
  let e4 = product_events[event_index * 8u + 4u];
  return finite_position(e0.xyz) && e4.z == 1.0 && e3.y > 0.0 && e1.x == s0.x
    && (e2.w <= 0.0 || e2.w == s0.y);
}

@compute @workgroup_size(64)
fn mark_eligibility(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let candidate = sparse_linear_index(global_id);
  if (candidate >= params.eligibility_candidate_count || params.surface_count == 0u) { return; }
  let source_ordinal = candidate / params.surface_count;
  let surface_slot = candidate - source_ordinal * params.surface_count;
  eligibility_flags[candidate] = select(0u, 1u, source_surface_eligible(source_ordinal, surface_slot));
}

@compute @workgroup_size(64)
fn scatter_eligible_pairs(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let candidate = sparse_linear_index(global_id);
  if (candidate >= params.eligibility_candidate_count || eligibility_flags[candidate] == 0u) { return; }
  let destination = eligibility_offsets[candidate];
  if (destination >= params.eligible_pair_capacity) {
    atomicAdd(&evidence[EVIDENCE_ELIGIBLE_OVERFLOW], 1u);
    atomicOr(&evidence[EVIDENCE_OVERFLOW_FLAGS], SPARSE_OVERFLOW_ELIGIBLE_PAIRS);
    return;
  }
  let source_ordinal = candidate / params.surface_count;
  let surface_slot = candidate - source_ordinal * params.surface_count;
  let is_product = source_ordinal >= params.particle_count;
  let source_index = select(source_ordinal, source_ordinal - params.particle_count, is_product);
  let base = destination * 4u;
  eligible_pairs[base] = source_index;
  eligible_pairs[base + 1u] = select(SPARSE_SOURCE_PARTICLE, SPARSE_SOURCE_PRODUCT_EVENT, is_product);
  eligible_pairs[base + 2u] = surface_slot;
  eligible_pairs[base + 3u] = SPARSE_READY;
}

@compute @workgroup_size(1)
fn finalize_eligibility() {
  var count = 0u;
  if (params.eligibility_candidate_count > 0u) {
    let last = params.eligibility_candidate_count - 1u;
    count = eligibility_offsets[last] + eligibility_flags[last];
  }
  atomicStore(&evidence[EVIDENCE_ELIGIBLE_COUNT], count);
  if (count > params.eligible_pair_capacity) {
    atomicStore(&evidence[EVIDENCE_ELIGIBLE_OVERFLOW], count - params.eligible_pair_capacity);
    atomicOr(&evidence[EVIDENCE_OVERFLOW_FLAGS], SPARSE_OVERFLOW_ELIGIBLE_PAIRS);
  }
}

struct RouteCandidate {
  valid: u32,
  surface_index: u32,
  source_index: u32,
  source_kind: u32,
  brick_x: u32,
  brick_y: u32,
  brick_z: u32,
  brick_linear: u32,
  directory_index: u32,
  support_radius_cells: u32,
};

fn invalid_route() -> RouteCandidate {
  return RouteCandidate(0u, SPARSE_SENTINEL, 0u, 0u, 0u, 0u, 0u, 0u, SPARSE_SENTINEL, 0u);
}

fn build_route_candidate(candidate: u32) -> RouteCandidate {
  if (candidate >= params.route_candidate_count || params.route_fanout_volume == 0u) {
    return invalid_route();
  }
  let pair_index = candidate / params.route_fanout_volume;
  let fanout_slot = candidate - pair_index * params.route_fanout_volume;
  if (pair_index >= params.eligible_pair_capacity) { return invalid_route(); }
  let pair_base = pair_index * 4u;
  if (eligible_pairs[pair_base + 3u] != SPARSE_READY) { return invalid_route(); }
  let source_index = eligible_pairs[pair_base];
  let source_kind = eligible_pairs[pair_base + 1u];
  let surface_slot = eligible_pairs[pair_base + 2u];
  if (surface_slot >= params.surface_count) { return invalid_route(); }
  let sparse_base = surface_slot * 16u;
  let surface_index = sparse_surfaces[sparse_base];
  let dimensions = vec3<u32>(
    sparse_surfaces[sparse_base + 1u],
    sparse_surfaces[sparse_base + 2u],
    sparse_surfaces[sparse_base + 3u]
  );
  let brick_counts = vec3<u32>(
    sparse_surfaces[sparse_base + 5u],
    sparse_surfaces[sparse_base + 6u],
    sparse_surfaces[sparse_base + 7u]
  );
  let directory_offset = sparse_surfaces[sparse_base + 8u];
  let s1 = render_surfaces[surface_slot * 4u + 1u];
  var position_m = vec3<f32>(0.0);
  var phase_weight = 1.0;
  if (source_kind == SPARSE_SOURCE_PARTICLE) {
    if (source_index >= params.particle_count) { return invalid_route(); }
    let row0 = render_rows[source_index * 5u];
    let row1 = render_rows[source_index * 5u + 1u];
    let row2 = render_rows[source_index * 5u + 2u];
    let row4 = render_rows[source_index * 5u + 4u];
    position_m = row0.xyz;
    phase_weight = render_phase_weight(render_surfaces[surface_slot * 4u].y, row1.y, row2.y, row4.x);
  } else {
    if (source_index >= params.product_event_count) { return invalid_route(); }
    position_m = product_events[source_index * 8u].xyz;
  }
  let subtract = max(s1.z, 1.0e-12);
  let positive_strength = s1.w * phase_weight;
  let support_sq = positive_strength / subtract - 0.000001;
  if (!(support_sq > 0.0)) { return invalid_route(); }
  let support_norm = sqrt(support_sq);
  let span = 1.0 - 2.0 * params.field_padding;
  let ref_edge = max(params.ref_edge_m, 1.0e-12);
  let position = clamp(
    vec3<f32>(params.field_padding) + (position_m / ref_edge) * span,
    vec3<f32>(0.001),
    vec3<f32>(0.999)
  );
  let dim_f = vec3<f32>(dimensions);
  let sample = min(vec3<u32>(floor(position * dim_f)), dimensions - vec3<u32>(1u));
  let home = sample / vec3<u32>(params.brick_size);
  let min_sample = vec3<u32>(floor(clamp(position - vec3<f32>(support_norm), vec3<f32>(0.0), vec3<f32>(0.999999)) * dim_f));
  let max_sample = min(
    vec3<u32>(floor(clamp(position + vec3<f32>(support_norm), vec3<f32>(0.0), vec3<f32>(0.999999)) * dim_f)),
    dimensions - vec3<u32>(1u)
  );
  let min_brick = min_sample / vec3<u32>(params.brick_size);
  let max_brick = max_sample / vec3<u32>(params.brick_size);
  let radius = params.route_fanout_radius_bricks;
  let exceeds_radius = any(home - min(home, min_brick) > vec3<u32>(radius))
    || any(max_brick - min(home, max_brick) > vec3<u32>(radius));
  if (exceeds_radius) {
    if (fanout_slot == 0u) {
      atomicAdd(&evidence[EVIDENCE_ROUTE_OVERFLOW], 1u);
      atomicOr(&evidence[EVIDENCE_OVERFLOW_FLAGS], SPARSE_OVERFLOW_ROUTES);
    }
    return invalid_route();
  }
  let side = radius * 2u + 1u;
  let dz = fanout_slot / (side * side);
  let rem = fanout_slot - dz * side * side;
  let dy = rem / side;
  let dx = rem - dy * side;
  let target_i = vec3<i32>(home) + vec3<i32>(i32(dx), i32(dy), i32(dz)) - vec3<i32>(i32(radius));
  if (any(target_i < vec3<i32>(0))) { return invalid_route(); }
  let target = vec3<u32>(target_i);
  if (any(target >= brick_counts) || any(target < min_brick) || any(target > max_brick)) {
    return invalid_route();
  }
  let linear = target.x + brick_counts.x * (target.y + brick_counts.y * target.z);
  let support_cells = u32(ceil(support_norm * max(dim_f.x, max(dim_f.y, dim_f.z))));
  return RouteCandidate(
    1u, surface_index, source_index, source_kind,
    target.x, target.y, target.z, linear, directory_offset + linear, support_cells
  );
}

@compute @workgroup_size(64)
fn mark_route_candidates(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let candidate = sparse_linear_index(global_id);
  if (candidate >= params.route_candidate_count) { return; }
  route_flags[candidate] = build_route_candidate(candidate).valid;
}

@compute @workgroup_size(64)
fn scatter_routes(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let candidate = sparse_linear_index(global_id);
  if (candidate >= params.route_candidate_count || route_flags[candidate] == 0u) { return; }
  let destination = route_offsets[candidate];
  if (destination >= params.route_capacity) {
    atomicAdd(&evidence[EVIDENCE_ROUTE_OVERFLOW], 1u);
    atomicOr(&evidence[EVIDENCE_OVERFLOW_FLAGS], SPARSE_OVERFLOW_ROUTES);
    return;
  }
  let route = build_route_candidate(candidate);
  if (route.valid == 0u) { return; }
  let base = destination * 12u;
  route_rows[base] = destination;
  route_rows[base + 1u] = route.source_index;
  route_rows[base + 2u] = route.source_kind;
  route_rows[base + 3u] = route.surface_index;
  route_rows[base + 4u] = route.brick_x;
  route_rows[base + 5u] = route.brick_y;
  route_rows[base + 6u] = route.brick_z;
  route_rows[base + 7u] = route.brick_linear;
  route_rows[base + 8u] = route.directory_index;
  route_rows[base + 9u] = route.support_radius_cells;
  route_rows[base + 10u] = params.generation_id;
  route_rows[base + 11u] = SPARSE_READY;
  // Directory offsets are global across all surfaces. Stable radix ordering of
  // this one-word key preserves source/kind order from eligibility compaction.
  route_keys[destination] = route.directory_index;
}

@compute @workgroup_size(1)
fn finalize_routes() {
  var count = 0u;
  if (params.route_candidate_count > 0u) {
    let last = params.route_candidate_count - 1u;
    count = route_offsets[last] + route_flags[last];
  }
  atomicStore(&evidence[EVIDENCE_ROUTE_COUNT], count);
  if (count > params.route_capacity) {
    atomicStore(&evidence[EVIDENCE_ROUTE_OVERFLOW], count - params.route_capacity);
    atomicOr(&evidence[EVIDENCE_OVERFLOW_FLAGS], SPARSE_OVERFLOW_ROUTES);
  }
}
`;

export const sphSparseRenderFieldInitializeWgsl = /* wgsl */ `
${sparseParamsWgsl}

@group(0) @binding(0) var<storage, read_write> directory_entries: array<u32>;
@group(0) @binding(1) var<storage, read_write> route_ranges: array<u32>;
@group(0) @binding(2) var<storage, read_write> route_keys: array<u32>;
@group(0) @binding(3) var<storage, read_write> active_candidate_rows: array<u32>;
@group(0) @binding(4) var<storage, read_write> active_candidate_keys: array<u32>;
@group(0) @binding(5) var<storage, read_write> active_voxel_ids: array<u32>;
@group(0) @binding(6) var<storage, read_write> evidence: array<atomic<u32>>;
@group(0) @binding(7) var<uniform> params: SparseParams;

@compute @workgroup_size(64)
fn initialize_sparse_outputs(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = sparse_linear_index(global_id);
  if (index < params.directory_capacity) {
    directory_entries[index] = SPARSE_SENTINEL;
    let range_base = index * 4u;
    route_ranges[range_base] = SPARSE_SENTINEL;
    route_ranges[range_base + 1u] = 0u;
    route_ranges[range_base + 2u] = params.generation_id;
    route_ranges[range_base + 3u] = 0u;
  }
  if (index < params.route_capacity) { route_keys[index] = SPARSE_SENTINEL; }
  if (index < params.active_candidate_capacity) {
    active_candidate_keys[index] = SPARSE_SENTINEL;
    active_candidate_rows[index * 8u + 7u] = 0u;
  }
  if (index < params.candidate_voxel_buffer_words) { active_voxel_ids[index] = SPARSE_SENTINEL; }
  if (index == 0u) {
    atomicStore(&evidence[EVIDENCE_GENERATION], params.generation_id);
    atomicStore(&evidence[EVIDENCE_SURFACE_COUNT], params.surface_count);
    atomicStore(&evidence[EVIDENCE_PARTICLE_COUNT], params.particle_count);
    atomicStore(&evidence[EVIDENCE_PRODUCT_COUNT], params.product_event_count);
    atomicStore(&evidence[EVIDENCE_ELIGIBILITY_CANDIDATES], params.eligibility_candidate_count);
    atomicStore(&evidence[EVIDENCE_ELIGIBLE_CAPACITY], params.eligible_pair_capacity);
    atomicStore(&evidence[EVIDENCE_ROUTE_CANDIDATES], params.route_candidate_count);
    atomicStore(&evidence[EVIDENCE_ROUTE_CAPACITY], params.route_capacity);
    atomicStore(&evidence[EVIDENCE_ACTIVE_CANDIDATES], params.active_candidate_capacity);
    atomicStore(&evidence[EVIDENCE_ACTIVE_CAPACITY], params.active_brick_capacity);
    atomicStore(&evidence[EVIDENCE_ATLAS_CAPACITY], params.atlas_cell_capacity);
    atomicStore(&evidence[EVIDENCE_VOXEL_CAPACITY], params.active_voxel_capacity);
    atomicStore(&evidence[EVIDENCE_OVERFLOW_FLAGS], params.host_overflow_flags);
    atomicStore(&evidence[EVIDENCE_RETAINED_LOW], params.retained_bytes_low);
    atomicStore(&evidence[EVIDENCE_RETAINED_HIGH], params.retained_bytes_high);
    atomicStore(&evidence[EVIDENCE_ALLOCATED_LOW], params.allocated_bytes_low);
    atomicStore(&evidence[EVIDENCE_ALLOCATED_HIGH], params.allocated_bytes_high);
    atomicStore(&evidence[EVIDENCE_MAX_PARTICLE_SURFACES], params.max_particle_surfaces_per_source);
    atomicStore(&evidence[EVIDENCE_MAX_PRODUCT_SURFACES], params.max_product_surfaces_per_event);
    atomicStore(&evidence[EVIDENCE_FANOUT_RADIUS], params.route_fanout_radius_bricks);
  }
}

@compute @workgroup_size(64)
fn initialize_home_sparse_outputs(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = sparse_linear_index(global_id);
  if (index < params.directory_capacity) {
    directory_entries[index] = SPARSE_SENTINEL;
    let range_base = index * 4u;
    route_ranges[range_base] = SPARSE_SENTINEL;
    route_ranges[range_base + 1u] = 0u;
    route_ranges[range_base + 2u] = params.generation_id;
    route_ranges[range_base + 3u] = 0u;
  }
  if (index < params.route_capacity) { route_keys[index] = SPARSE_SENTINEL; }
  if (index < params.candidate_voxel_buffer_words) { active_voxel_ids[index] = SPARSE_SENTINEL; }
  if (index == 0u) {
    atomicStore(&evidence[EVIDENCE_GENERATION], params.generation_id);
    atomicStore(&evidence[EVIDENCE_SURFACE_COUNT], params.surface_count);
    atomicStore(&evidence[EVIDENCE_PARTICLE_COUNT], params.particle_count);
    atomicStore(&evidence[EVIDENCE_PRODUCT_COUNT], params.product_event_count);
    atomicStore(&evidence[EVIDENCE_ELIGIBILITY_CANDIDATES], params.eligibility_candidate_count);
    atomicStore(&evidence[EVIDENCE_ELIGIBLE_CAPACITY], params.route_capacity);
    atomicStore(&evidence[EVIDENCE_ROUTE_CANDIDATES], params.route_capacity);
    atomicStore(&evidence[EVIDENCE_ROUTE_CAPACITY], params.route_capacity);
    atomicStore(&evidence[EVIDENCE_ACTIVE_CANDIDATES], params.directory_capacity);
    atomicStore(&evidence[EVIDENCE_ACTIVE_CAPACITY], params.active_brick_capacity);
    atomicStore(&evidence[EVIDENCE_ATLAS_CAPACITY], params.atlas_cell_capacity);
    atomicStore(&evidence[EVIDENCE_VOXEL_CAPACITY], params.active_voxel_capacity);
    atomicStore(&evidence[EVIDENCE_OVERFLOW_FLAGS], params.host_overflow_flags);
    atomicStore(&evidence[EVIDENCE_RETAINED_LOW], params.retained_bytes_low);
    atomicStore(&evidence[EVIDENCE_RETAINED_HIGH], params.retained_bytes_high);
    atomicStore(&evidence[EVIDENCE_ALLOCATED_LOW], params.allocated_bytes_low);
    atomicStore(&evidence[EVIDENCE_ALLOCATED_HIGH], params.allocated_bytes_high);
    atomicStore(&evidence[EVIDENCE_MAX_PARTICLE_SURFACES], params.max_particle_surfaces_per_source);
    atomicStore(&evidence[EVIDENCE_MAX_PRODUCT_SURFACES], params.max_product_surfaces_per_event);
    atomicStore(&evidence[EVIDENCE_FANOUT_RADIUS], params.route_fanout_radius_bricks);
  }
}
`;

export const sphSparseRenderFieldTopologyWgsl = /* wgsl */ `
${sparseParamsWgsl}

@group(0) @binding(0) var<storage, read> sorted_indices: array<u32>;
@group(0) @binding(1) var<storage, read> route_rows: array<u32>;
@group(0) @binding(2) var<storage, read> route_keys: array<u32>;
@group(0) @binding(3) var<storage, read_write> route_ranges: array<u32>;
@group(0) @binding(4) var<storage, read_write> active_candidate_rows: array<u32>;
@group(0) @binding(5) var<storage, read_write> active_candidate_keys: array<u32>;
@group(0) @binding(6) var<storage, read_write> evidence: array<atomic<u32>>;
@group(0) @binding(7) var<uniform> params: SparseParams;
@group(0) @binding(8) var<storage, read_write> active_head_flags: array<u32>;
@group(0) @binding(9) var<storage, read> active_head_offsets: array<u32>;
@group(0) @binding(10) var<storage, read> sparse_surfaces: array<u32>;
@group(0) @binding(11) var<storage, read_write> active_brick_rows: array<u32>;
@group(0) @binding(12) var<storage, read_write> active_voxel_counts: array<u32>;
@group(0) @binding(13) var<storage, read_write> directory_entries: array<u32>;

fn route_valid(record: u32) -> bool {
  return record < params.route_capacity && route_rows[record * 12u + 11u] == SPARSE_READY
    && route_keys[record] != SPARSE_SENTINEL;
}

@compute @workgroup_size(64)
fn build_route_ranges_and_halo(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let sorted_position = sparse_linear_index(global_id);
  if (sorted_position >= params.route_capacity) { return; }
  let record = sorted_indices[sorted_position];
  if (!route_valid(record)) { return; }
  let directory_index = route_keys[record];
  if (sorted_position > 0u) {
    let previous = sorted_indices[sorted_position - 1u];
    if (route_valid(previous) && route_keys[previous] == directory_index) { return; }
  }
  var end = sorted_position + 1u;
  loop {
    if (end >= params.route_capacity) { break; }
    let next = sorted_indices[end];
    if (!route_valid(next) || route_keys[next] != directory_index) { break; }
    end = end + 1u;
  }
  if (directory_index >= params.directory_capacity) {
    atomicAdd(&evidence[EVIDENCE_ROUTE_OVERFLOW], 1u);
    atomicOr(&evidence[EVIDENCE_OVERFLOW_FLAGS], SPARSE_OVERFLOW_ROUTES);
    return;
  }
  let range_base = directory_index * 4u;
  route_ranges[range_base] = sorted_position;
  route_ranges[range_base + 1u] = end - sorted_position;
  route_ranges[range_base + 2u] = params.generation_id;
  route_ranges[range_base + 3u] = SPARSE_READY;

  let route_base = record * 12u;
  let surface_index = route_rows[route_base + 3u];
  let surface_slot = find_surface_slot(surface_index);
  if (surface_slot == SPARSE_SENTINEL) {
    atomicAdd(&evidence[EVIDENCE_ACTIVE_OVERFLOW], 1u);
    atomicOr(&evidence[EVIDENCE_OVERFLOW_FLAGS], SPARSE_OVERFLOW_ACTIVE_BRICKS);
    return;
  }
  let sparse_base = surface_slot * 16u;
  let brick_count_x = sparse_surfaces[sparse_base + 5u];
  let brick_count_y = sparse_surfaces[sparse_base + 6u];
  let brick = vec3<u32>(
    route_rows[route_base + 4u], route_rows[route_base + 5u], route_rows[route_base + 6u]
  );
  for (var mask = 0u; mask < 8u; mask = mask + 1u) {
    let candidate_index = sorted_position * 8u + mask;
    if (candidate_index >= params.active_candidate_capacity) { continue; }
    let dx = mask & 1u;
    let dy = (mask >> 1u) & 1u;
    let dz = (mask >> 2u) & 1u;
    let valid = brick.x >= dx && brick.y >= dy && brick.z >= dz;
    if (!valid) { continue; }
    let target = brick - vec3<u32>(dx, dy, dz);
    let target_directory = directory_index - dx - dy * brick_count_x
      - dz * brick_count_x * brick_count_y;
    var flags = SPARSE_ACTIVE_DIRECT;
    if (mask != 0u) {
      flags = SPARSE_ACTIVE_HALO;
      if (dx != 0u) { flags = flags | SPARSE_ACTIVE_PREDECESSOR_X; }
      if (dy != 0u) { flags = flags | SPARSE_ACTIVE_PREDECESSOR_Y; }
      if (dz != 0u) { flags = flags | SPARSE_ACTIVE_PREDECESSOR_Z; }
    }
    let base = candidate_index * 8u;
    active_candidate_rows[base] = surface_index;
    active_candidate_rows[base + 1u] = target.x;
    active_candidate_rows[base + 2u] = target.y;
    active_candidate_rows[base + 3u] = target.z;
    active_candidate_rows[base + 4u] = target_directory;
    active_candidate_rows[base + 5u] = flags;
    active_candidate_rows[base + 6u] = params.generation_id;
    active_candidate_rows[base + 7u] = SPARSE_READY;
    active_candidate_keys[candidate_index] = target_directory;
  }
}

fn active_candidate_valid(record: u32) -> bool {
  return record < params.active_candidate_capacity
    && active_candidate_rows[record * 8u + 7u] == SPARSE_READY
    && active_candidate_keys[record] != SPARSE_SENTINEL;
}

@compute @workgroup_size(64)
fn mark_active_heads(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let position = sparse_linear_index(global_id);
  if (position >= params.active_candidate_capacity) { return; }
  let record = sorted_indices[position];
  if (!active_candidate_valid(record)) {
    active_head_flags[position] = 0u;
    return;
  }
  var is_head = position == 0u;
  if (!is_head) {
    let previous = sorted_indices[position - 1u];
    is_head = !active_candidate_valid(previous)
      || active_candidate_keys[previous] != active_candidate_keys[record];
  }
  active_head_flags[position] = select(0u, 1u, is_head);
}

fn find_surface_slot(surface_index: u32) -> u32 {
  for (var slot = 0u; slot < params.surface_count; slot = slot + 1u) {
    if (sparse_surfaces[slot * 16u] == surface_index) { return slot; }
  }
  return SPARSE_SENTINEL;
}

@compute @workgroup_size(64)
fn scatter_active_bricks(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let position = sparse_linear_index(global_id);
  if (position >= params.active_candidate_capacity || active_head_flags[position] == 0u) { return; }
  let active_index = active_head_offsets[position];
  if (active_index >= params.active_brick_capacity) {
    atomicAdd(&evidence[EVIDENCE_ACTIVE_OVERFLOW], 1u);
    atomicOr(&evidence[EVIDENCE_OVERFLOW_FLAGS], SPARSE_OVERFLOW_ACTIVE_BRICKS);
    return;
  }
  let record = sorted_indices[position];
  let key = active_candidate_keys[record];
  var activation_flags = 0u;
  var cursor = position;
  loop {
    if (cursor >= params.active_candidate_capacity) { break; }
    let candidate = sorted_indices[cursor];
    if (!active_candidate_valid(candidate) || active_candidate_keys[candidate] != key) { break; }
    activation_flags = activation_flags | active_candidate_rows[candidate * 8u + 5u];
    cursor = cursor + 1u;
  }
  let candidate_base = record * 8u;
  let surface_index = active_candidate_rows[candidate_base];
  let surface_slot = find_surface_slot(surface_index);
  if (surface_slot == SPARSE_SENTINEL) {
    atomicAdd(&evidence[EVIDENCE_ACTIVE_OVERFLOW], 1u);
    atomicOr(&evidence[EVIDENCE_OVERFLOW_FLAGS], SPARSE_OVERFLOW_ACTIVE_BRICKS);
    return;
  }
  let sparse_base = surface_slot * 16u;
  let brick = vec3<u32>(
    active_candidate_rows[candidate_base + 1u],
    active_candidate_rows[candidate_base + 2u],
    active_candidate_rows[candidate_base + 3u]
  );
  let dimensions = vec3<u32>(
    sparse_surfaces[sparse_base + 1u], sparse_surfaces[sparse_base + 2u], sparse_surfaces[sparse_base + 3u]
  );
  let brick_counts = vec3<u32>(
    sparse_surfaces[sparse_base + 5u], sparse_surfaces[sparse_base + 6u], sparse_surfaces[sparse_base + 7u]
  );
  let start = brick * vec3<u32>(params.brick_size);
  let sample_extent = min(vec3<u32>(params.brick_size), dimensions - min(dimensions, start));
  let dual_dimensions = dimensions - min(dimensions, vec3<u32>(1u));
  let voxel_extent = min(vec3<u32>(params.brick_size), dual_dimensions - min(dual_dimensions, start));
  let voxel_count = voxel_extent.x * voxel_extent.y * voxel_extent.z;
  let linear = brick.x + brick_counts.x * (brick.y + brick_counts.y * brick.z);
  let base = active_index * 16u;
  active_brick_rows[base] = surface_index;
  active_brick_rows[base + 1u] = brick.x;
  active_brick_rows[base + 2u] = brick.y;
  active_brick_rows[base + 3u] = brick.z;
  active_brick_rows[base + 4u] = linear;
  active_brick_rows[base + 5u] = key;
  active_brick_rows[base + 6u] = active_index;
  active_brick_rows[base + 7u] = active_index * 512u;
  active_brick_rows[base + 8u] = sample_extent.x;
  active_brick_rows[base + 9u] = sample_extent.y;
  active_brick_rows[base + 10u] = sample_extent.z;
  active_brick_rows[base + 11u] = voxel_count;
  active_brick_rows[base + 12u] = activation_flags;
  active_brick_rows[base + 13u] = params.generation_id;
  active_brick_rows[base + 14u] = 0u;
  active_brick_rows[base + 15u] = 0u;
  active_voxel_counts[active_index] = voxel_count;
  if ((activation_flags & SPARSE_ACTIVE_DIRECT) != 0u) {
    atomicAdd(&evidence[EVIDENCE_DIRECT_ACTIVE], 1u);
  } else {
    atomicAdd(&evidence[EVIDENCE_HALO_ONLY], 1u);
  }
}

@compute @workgroup_size(1)
fn finalize_active_bricks() {
  var count = 0u;
  if (params.active_candidate_capacity > 0u) {
    let last = params.active_candidate_capacity - 1u;
    count = active_head_offsets[last] + active_head_flags[last];
  }
  atomicStore(&evidence[EVIDENCE_ACTIVE_COUNT], count);
  let atlas_required = count * 512u;
  atomicStore(&evidence[EVIDENCE_ATLAS_REQUIRED], atlas_required);
  if (count > params.active_brick_capacity) {
    atomicStore(&evidence[EVIDENCE_ACTIVE_OVERFLOW], count - params.active_brick_capacity);
    atomicOr(&evidence[EVIDENCE_OVERFLOW_FLAGS], SPARSE_OVERFLOW_ACTIVE_BRICKS);
  }
  if (atlas_required > params.atlas_cell_capacity) {
    atomicOr(&evidence[EVIDENCE_OVERFLOW_FLAGS], SPARSE_OVERFLOW_ATLAS);
  }
}

@compute @workgroup_size(64)
fn publish_active_directory(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let active_index = sparse_linear_index(global_id);
  if (active_index >= params.active_brick_capacity) { return; }
  let base = active_index * 16u;
  if (active_brick_rows[base + 12u] == 0u || active_brick_rows[base + 13u] != params.generation_id) { return; }
  let directory_index = active_brick_rows[base + 5u];
  if (directory_index >= params.directory_capacity) { return; }
  directory_entries[directory_index] = active_index;
  let range_base = directory_index * 4u;
  if (route_ranges[range_base + 3u] == SPARSE_READY) {
    active_brick_rows[base + 14u] = route_ranges[range_base];
    active_brick_rows[base + 15u] = route_ranges[range_base + 1u];
  }
}
`;

export const sphSparseRenderFieldAtlasWgsl = /* wgsl */ `
${sparseParamsWgsl}

@group(0) @binding(0) var<storage, read> render_rows: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> render_surfaces: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> sparse_surfaces: array<u32>;
@group(0) @binding(3) var<storage, read> product_events: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> sorted_route_indices: array<u32>;
@group(0) @binding(5) var<storage, read> route_rows: array<u32>;
@group(0) @binding(6) var<storage, read> active_brick_rows: array<u32>;
@group(0) @binding(7) var<storage, read_write> atlas_cells: array<vec4<f32>>;
@group(0) @binding(8) var<uniform> params: SparseParams;
@group(0) @binding(9) var<storage, read> directory_entries: array<u32>;
@group(0) @binding(10) var<storage, read> active_voxel_offsets: array<u32>;
@group(0) @binding(11) var<storage, read_write> active_voxel_ids: array<u32>;
@group(0) @binding(12) var<storage, read> active_voxel_counts: array<u32>;
@group(0) @binding(13) var<storage, read_write> evidence: array<atomic<u32>>;

fn find_surface_slot(surface_index: u32) -> u32 {
  for (var slot = 0u; slot < params.surface_count; slot = slot + 1u) {
    if (sparse_surfaces[slot * 16u] == surface_index) { return slot; }
  }
  return SPARSE_SENTINEL;
}

fn render_phase_weight(surface_phase: f32, row_phase: f32, gas_fraction: f32, solid_fraction: f32) -> f32 {
  let gas = clamp(gas_fraction, 0.0, 1.0);
  let solid = clamp(solid_fraction, 0.0, 1.0);
  let liquid = clamp(1.0 - gas - solid, 0.0, 1.0);
  if (surface_phase == 1.0) { return solid; }
  if (surface_phase == 2.0) { return liquid; }
  if (surface_phase == 3.0) { return gas; }
  return select(0.0, 1.0, row_phase == surface_phase);
}

fn smooth_palette_weight(ratio: f32) -> f32 {
  let t = clamp(ratio, 0.0, 1.0);
  return 1.0 - t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

fn particle_value(
  source_index: u32,
  surface_slot: u32,
  cell: vec3<f32>,
  smear_sq: f32
) -> vec4<f32> {
  let row0 = render_rows[source_index * 5u];
  let row1 = render_rows[source_index * 5u + 1u];
  let row2 = render_rows[source_index * 5u + 2u];
  let row4 = render_rows[source_index * 5u + 4u];
  let s0 = render_surfaces[surface_slot * 4u];
  let s1 = render_surfaces[surface_slot * 4u + 1u];
  let phase_weight = render_phase_weight(s0.y, row1.y, row2.y, row4.x);
  if (phase_weight <= 0.003) { return vec4<f32>(0.0); }
  let span = 1.0 - 2.0 * params.field_padding;
  let particle = clamp(
    vec3<f32>(params.field_padding) + (row0.xyz / max(params.ref_edge_m, 1.0e-12)) * span,
    vec3<f32>(0.001), vec3<f32>(0.999)
  );
  let dist2 = dot(cell - particle, cell - particle) + smear_sq;
  let value = (s1.w * phase_weight) / (0.000001 + dist2) - max(s1.z, 1.0e-12);
  if (value <= 0.0) { return vec4<f32>(0.0); }
  let support_norm = sqrt(abs(s1.w) / max(s1.z, 1.0e-12));
  return vec4<f32>(value, smooth_palette_weight(sqrt(dist2) / max(support_norm, 1.0e-6)) * phase_weight, row1.z, 1.0);
}

@compute @workgroup_size(64)
fn evaluate_atlas(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let linear = sparse_linear_index(global_id);
  let active_index = linear / 512u;
  let local_index = linear - active_index * 512u;
  if (active_index >= params.active_brick_capacity) { return; }
  let active_base = active_index * 16u;
  if (active_brick_rows[active_base + 12u] == 0u
    || active_brick_rows[active_base + 13u] != params.generation_id) { return; }
  let lx = local_index & 7u;
  let ly = (local_index >> 3u) & 7u;
  let lz = local_index >> 6u;
  if (lx >= active_brick_rows[active_base + 8u]
    || ly >= active_brick_rows[active_base + 9u]
    || lz >= active_brick_rows[active_base + 10u]) { return; }
  let surface_index = active_brick_rows[active_base];
  let surface_slot = find_surface_slot(surface_index);
  if (surface_slot == SPARSE_SENTINEL) { return; }
  let sparse_base = surface_slot * 16u;
  let dimensions = vec3<u32>(
    sparse_surfaces[sparse_base + 1u], sparse_surfaces[sparse_base + 2u], sparse_surfaces[sparse_base + 3u]
  );
  let sample = vec3<u32>(
    active_brick_rows[active_base + 1u] * 8u + lx,
    active_brick_rows[active_base + 2u] * 8u + ly,
    active_brick_rows[active_base + 3u] * 8u + lz
  );
  let cell = vec3<f32>(sample) / vec3<f32>(dimensions);
  let route_offset = active_brick_rows[active_base + 14u];
  let route_count = active_brick_rows[active_base + 15u];
  let color = render_surfaces[surface_slot * 4u + 2u].yzw;
  var density = 0.0;
  var palette = vec3<f32>(0.0);
  var temperature_weighted = 0.0;
  var temperature_weight = 0.0;
  var velocity_weighted = vec3<f32>(0.0);
  var velocity_sq_weighted = 0.0;
  for (var member = 0u; member < route_count; member = member + 1u) {
    let route_index = sorted_route_indices[route_offset + member];
    let route_base = route_index * 12u;
    if (route_rows[route_base + 11u] != SPARSE_READY
      || route_rows[route_base + 2u] != SPARSE_SOURCE_PARTICLE) { continue; }
    let source_index = route_rows[route_base + 1u];
    let contribution = particle_value(source_index, surface_slot, cell, 0.0);
    if (contribution.x <= 0.0) { continue; }
    density = density + contribution.x;
    palette = palette + color * contribution.y;
    temperature_weighted = temperature_weighted + contribution.z * contribution.x;
    temperature_weight = temperature_weight + contribution.x;
    let velocity = render_rows[source_index * 5u + 4u].yzw;
    velocity_weighted = velocity_weighted + velocity * contribution.x;
    velocity_sq_weighted = velocity_sq_weighted + dot(velocity, velocity) * contribution.x;
  }
  if (temperature_weight > 0.0 && params.render_smear_dt_s > 0.0) {
    let mean_velocity = velocity_weighted / temperature_weight;
    let dispersion_sq = max(0.0, velocity_sq_weighted / temperature_weight - dot(mean_velocity, mean_velocity));
    let span = 1.0 - 2.0 * params.field_padding;
    let smear = sqrt(dispersion_sq) * params.render_smear_dt_s * span / max(params.ref_edge_m, 1.0e-12);
    let smear_sq = smear * smear;
    if (smear_sq > 1.0e-10) {
      density = 0.0;
      palette = vec3<f32>(0.0);
      temperature_weighted = 0.0;
      temperature_weight = 0.0;
      // The correction intentionally reuses only this brick's CSR member range.
      for (var member = 0u; member < route_count; member = member + 1u) {
        let route_index = sorted_route_indices[route_offset + member];
        let route_base = route_index * 12u;
        if (route_rows[route_base + 11u] != SPARSE_READY
          || route_rows[route_base + 2u] != SPARSE_SOURCE_PARTICLE) { continue; }
        let contribution = particle_value(route_rows[route_base + 1u], surface_slot, cell, smear_sq);
        if (contribution.x <= 0.0) { continue; }
        density = density + contribution.x;
        palette = palette + color * contribution.y;
        temperature_weighted = temperature_weighted + contribution.z * contribution.x;
        temperature_weight = temperature_weight + contribution.x;
      }
    }
  }
  let s1 = render_surfaces[surface_slot * 4u + 1u];
  for (var member = 0u; member < route_count; member = member + 1u) {
    let route_index = sorted_route_indices[route_offset + member];
    let route_base = route_index * 12u;
    if (route_rows[route_base + 11u] != SPARSE_READY
      || route_rows[route_base + 2u] != SPARSE_SOURCE_PRODUCT_EVENT) { continue; }
    let source_index = route_rows[route_base + 1u];
    let event0 = product_events[source_index * 8u];
    let event_position = clamp(
      vec3<f32>(params.field_padding)
        + (event0.xyz / max(params.ref_edge_m, 1.0e-12)) * (1.0 - 2.0 * params.field_padding),
      vec3<f32>(0.001), vec3<f32>(0.999)
    );
    let dist2 = dot(cell - event_position, cell - event_position);
    let value = s1.w / (0.000001 + dist2) - max(s1.z, 1.0e-12);
    if (value > 0.0) {
      let support_norm = sqrt(abs(s1.w) / max(s1.z, 1.0e-12));
      density = density + value;
      palette = palette + color * smooth_palette_weight(sqrt(dist2) / max(support_norm, 1.0e-6));
    }
  }
  let atlas_offset = active_brick_rows[active_base + 7u] + local_index;
  if (atlas_offset < params.atlas_cell_capacity) {
    atlas_cells[atlas_offset * 2u] = vec4<f32>(density, palette);
    atlas_cells[atlas_offset * 2u + 1u] = vec4<f32>(
      select(0.0, temperature_weighted / max(temperature_weight, 1.0e-6), temperature_weight > 0.0),
      0.0, 0.0, 0.0
    );
  }
}

fn atlas_density(surface_index: u32, sample: vec3<u32>) -> f32 {
  let surface_slot = find_surface_slot(surface_index);
  if (surface_slot == SPARSE_SENTINEL) { return 0.0; }
  let sparse_base = surface_slot * 16u;
  let dimensions = vec3<u32>(
    sparse_surfaces[sparse_base + 1u], sparse_surfaces[sparse_base + 2u], sparse_surfaces[sparse_base + 3u]
  );
  if (any(sample >= dimensions)) { return 0.0; }
  let brick = sample / vec3<u32>(8u);
  let counts = vec3<u32>(
    sparse_surfaces[sparse_base + 5u], sparse_surfaces[sparse_base + 6u], sparse_surfaces[sparse_base + 7u]
  );
  let linear = brick.x + counts.x * (brick.y + counts.y * brick.z);
  let directory_index = sparse_surfaces[sparse_base + 8u] + linear;
  if (directory_index >= params.directory_capacity) { return 0.0; }
  let active_index = directory_entries[directory_index];
  if (active_index == SPARSE_SENTINEL || active_index >= params.active_brick_capacity) { return 0.0; }
  let active_base = active_index * 16u;
  if (active_brick_rows[active_base + 12u] == 0u
    || active_brick_rows[active_base + 13u] != params.generation_id) { return 0.0; }
  let local = sample - brick * vec3<u32>(8u);
  let local_index = local.x + 8u * (local.y + 8u * local.z);
  let atlas_offset = active_brick_rows[active_base + 7u] + local_index;
  if (atlas_offset >= params.atlas_cell_capacity) { return 0.0; }
  return atlas_cells[atlas_offset * 2u].x;
}

@compute @workgroup_size(64)
fn evaluate_voxel_candidates(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let linear = sparse_linear_index(global_id);
  let active_index = linear / 512u;
  let local_voxel = linear - active_index * 512u;
  if (active_index >= params.active_brick_capacity) { return; }
  let active_base = active_index * 16u;
  if (active_brick_rows[active_base + 12u] == 0u
    || active_brick_rows[active_base + 13u] != params.generation_id) { return; }
  let surface_index = active_brick_rows[active_base];
  let surface_slot = find_surface_slot(surface_index);
  if (surface_slot == SPARSE_SENTINEL) { return; }
  let sparse_base = surface_slot * 16u;
  let dimensions = vec3<u32>(
    sparse_surfaces[sparse_base + 1u], sparse_surfaces[sparse_base + 2u], sparse_surfaces[sparse_base + 3u]
  );
  let start = vec3<u32>(
    active_brick_rows[active_base + 1u],
    active_brick_rows[active_base + 2u],
    active_brick_rows[active_base + 3u]
  ) * vec3<u32>(8u);
  let dual = dimensions - min(dimensions, vec3<u32>(1u));
  let extent = min(vec3<u32>(8u), dual - min(dual, start));
  let voxel_count = extent.x * extent.y * extent.z;
  if (local_voxel >= voxel_count || extent.x == 0u || extent.y == 0u) { return; }
  let lz = local_voxel / (extent.x * extent.y);
  let rem = local_voxel - lz * extent.x * extent.y;
  let ly = rem / extent.x;
  let lx = rem - ly * extent.x;
  let sample = start + vec3<u32>(lx, ly, lz);
  let v0 = atlas_density(surface_index, sample);
  let v1 = atlas_density(surface_index, sample + vec3<u32>(1u, 0u, 0u));
  let v2 = atlas_density(surface_index, sample + vec3<u32>(1u, 1u, 0u));
  let v3 = atlas_density(surface_index, sample + vec3<u32>(0u, 1u, 0u));
  let v4 = atlas_density(surface_index, sample + vec3<u32>(0u, 0u, 1u));
  let v5 = atlas_density(surface_index, sample + vec3<u32>(1u, 0u, 1u));
  let v6 = atlas_density(surface_index, sample + vec3<u32>(1u, 1u, 1u));
  let v7 = atlas_density(surface_index, sample + vec3<u32>(0u, 1u, 1u));
  let isolation = render_surfaces[surface_slot * 4u + 1u].y;
  var mask = 0u;
  if (v0 >= isolation) { mask = mask | 1u; }
  if (v1 >= isolation) { mask = mask | 2u; }
  if (v2 >= isolation) { mask = mask | 4u; }
  if (v3 >= isolation) { mask = mask | 8u; }
  if (v4 >= isolation) { mask = mask | 16u; }
  if (v5 >= isolation) { mask = mask | 32u; }
  if (v6 >= isolation) { mask = mask | 64u; }
  if (v7 >= isolation) { mask = mask | 128u; }
  let destination = active_voxel_offsets[active_index] + local_voxel;
  if (destination < params.active_voxel_capacity && mask != 0u && mask != 255u) {
    active_voxel_ids[destination] = active_index * 512u + local_voxel;
  }
}

@compute @workgroup_size(1)
fn finalize_generation() {
  var voxel_required = 0u;
  if (params.active_brick_capacity > 0u) {
    let last = params.active_brick_capacity - 1u;
    voxel_required = active_voxel_offsets[last] + active_voxel_counts[last];
  }
  atomicStore(&evidence[EVIDENCE_VOXEL_REQUIRED], voxel_required);
  if (voxel_required > params.active_voxel_capacity) {
    atomicOr(&evidence[EVIDENCE_OVERFLOW_FLAGS], SPARSE_OVERFLOW_VOXELS);
  }
  let overflow = atomicLoad(&evidence[EVIDENCE_OVERFLOW_FLAGS]);
  let admitted = params.host_admitted != 0u && overflow == 0u;
  atomicStore(&evidence[EVIDENCE_ADMISSION_FLAGS], select(
    SPARSE_ADMISSION_FAIL_CLOSED | SPARSE_ADMISSION_RETAIN_PREVIOUS,
    SPARSE_ADMISSION_APPROVED,
    admitted
  ));
  atomicStore(&evidence[EVIDENCE_PUBLICATION_ALLOWED], select(0u, 1u, admitted));
  atomicStore(&evidence[EVIDENCE_FAIL_CLOSED], select(1u, 0u, admitted));
  atomicStore(&evidence[EVIDENCE_RETAIN_PREVIOUS], select(1u, 0u, admitted));
  atomicStore(&evidence[EVIDENCE_STATUS], select(SPARSE_BLOCKED, SPARSE_READY, admitted));
}
`;

// Production FIELD route construction emits exactly one route per eligible
// source/surface pair. The route key is the globally offset home directory;
// support expansion is performed on directory activation flags, not by
// duplicating route rows.
export const sphSparseRenderFieldHomeRouteWgsl = /* wgsl */ `
${sparseParamsWgsl}

@group(0) @binding(0) var<storage, read> render_rows: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> render_surfaces: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> sparse_surfaces: array<u32>;
@group(0) @binding(3) var<storage, read> product_events: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> eligibility_flags: array<u32>;
@group(0) @binding(5) var<storage, read> eligibility_offsets: array<u32>;
@group(0) @binding(6) var<storage, read_write> route_rows: array<u32>;
@group(0) @binding(7) var<storage, read_write> route_keys: array<u32>;
@group(0) @binding(8) var<storage, read_write> evidence: array<atomic<u32>>;
@group(0) @binding(9) var<uniform> params: SparseParams;

fn phase_weight(surface_phase: f32, row_phase: f32, gas_fraction: f32, solid_fraction: f32) -> f32 {
  let gas = clamp(gas_fraction, 0.0, 1.0);
  let solid = clamp(solid_fraction, 0.0, 1.0);
  let liquid = clamp(1.0 - gas - solid, 0.0, 1.0);
  if (surface_phase == 1.0) { return solid; }
  if (surface_phase == 2.0) { return liquid; }
  if (surface_phase == 3.0) { return gas; }
  return select(0.0, 1.0, row_phase == surface_phase);
}

fn source_eligible(source_ordinal: u32, surface_slot: u32) -> bool {
  let s0 = render_surfaces[surface_slot * 4u];
  let s3 = render_surfaces[surface_slot * 4u + 3u];
  if (source_ordinal < params.particle_count) {
    let row0 = render_rows[source_ordinal * 5u];
    let row1 = render_rows[source_ordinal * 5u + 1u];
    let row2 = render_rows[source_ordinal * 5u + 2u];
    let row4 = render_rows[source_ordinal * 5u + 4u];
    return row1.x == s0.x
      && (s3.x <= 0.0 || row2.w == s3.x)
      && phase_weight(s0.y, row1.y, row2.y, row4.x) > 0.003
      && all(abs(row0.xyz) < vec3<f32>(3.0e38));
  }
  let event_index = source_ordinal - params.particle_count;
  if (event_index >= params.product_event_count) { return false; }
  let e0 = product_events[event_index * 8u];
  let e1 = product_events[event_index * 8u + 1u];
  let e2 = product_events[event_index * 8u + 2u];
  let e3 = product_events[event_index * 8u + 3u];
  let e4 = product_events[event_index * 8u + 4u];
  return e4.z == 1.0 && e3.y > 0.0 && e1.x == s0.x
    && (e2.w <= 0.0 || e2.w == s0.y)
    && all(abs(e0.xyz) < vec3<f32>(3.0e38));
}

@compute @workgroup_size(64)
fn mark_home_route_eligibility(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let candidate = sparse_linear_index(global_id);
  if (candidate >= params.eligibility_candidate_count || params.surface_count == 0u) { return; }
  let source_ordinal = candidate / params.surface_count;
  let surface_slot = candidate - source_ordinal * params.surface_count;
  eligibility_flags[candidate] = select(0u, 1u, source_eligible(source_ordinal, surface_slot));
}

@compute @workgroup_size(64)
fn scatter_home_routes(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let candidate = sparse_linear_index(global_id);
  if (candidate >= params.eligibility_candidate_count || eligibility_flags[candidate] == 0u) { return; }
  let destination = eligibility_offsets[candidate];
  if (destination >= params.route_capacity) {
    atomicAdd(&evidence[EVIDENCE_ROUTE_OVERFLOW], 1u);
    atomicOr(&evidence[EVIDENCE_OVERFLOW_FLAGS], SPARSE_OVERFLOW_ROUTES);
    return;
  }
  let source_ordinal = candidate / params.surface_count;
  let surface_slot = candidate - source_ordinal * params.surface_count;
  let is_product = source_ordinal >= params.particle_count;
  let source_index = select(source_ordinal, source_ordinal - params.particle_count, is_product);
  let source_kind = select(SPARSE_SOURCE_PARTICLE, SPARSE_SOURCE_PRODUCT_EVENT, is_product);
  let sparse_base = surface_slot * 16u;
  let dimensions = vec3<u32>(
    sparse_surfaces[sparse_base + 1u], sparse_surfaces[sparse_base + 2u], sparse_surfaces[sparse_base + 3u]
  );
  let brick_counts = vec3<u32>(
    sparse_surfaces[sparse_base + 5u], sparse_surfaces[sparse_base + 6u], sparse_surfaces[sparse_base + 7u]
  );
  var position_m = vec3<f32>(0.0);
  if (is_product) {
    position_m = product_events[source_index * 8u].xyz;
  } else {
    position_m = render_rows[source_index * 5u].xyz;
  }
  let span = 1.0 - 2.0 * params.field_padding;
  let position = clamp(
    vec3<f32>(params.field_padding) + position_m / max(params.ref_edge_m, 1.0e-12) * span,
    vec3<f32>(0.001), vec3<f32>(0.999)
  );
  let sample = min(vec3<u32>(floor(position * vec3<f32>(dimensions))), dimensions - vec3<u32>(1u));
  let brick = sample / vec3<u32>(params.brick_size);
  let linear = brick.x + brick_counts.x * (brick.y + brick_counts.y * brick.z);
  let directory_index = sparse_surfaces[sparse_base + 8u] + linear;
  let s1 = render_surfaces[surface_slot * 4u + 1u];
  var source_phase_weight = 1.0;
  if (!is_product) {
    let row1 = render_rows[source_index * 5u + 1u];
    let row2 = render_rows[source_index * 5u + 2u];
    let row4 = render_rows[source_index * 5u + 4u];
    source_phase_weight = phase_weight(render_surfaces[surface_slot * 4u].y, row1.y, row2.y, row4.x);
  }
  let support_norm = sqrt(max(0.0, s1.w * source_phase_weight / max(s1.z, 1.0e-12) - 0.000001));
  let support_cells = u32(ceil(support_norm * max(
    f32(dimensions.x), max(f32(dimensions.y), f32(dimensions.z))
  )));
  let base = destination * 12u;
  route_rows[base] = destination;
  route_rows[base + 1u] = source_index;
  route_rows[base + 2u] = source_kind;
  route_rows[base + 3u] = sparse_surfaces[sparse_base];
  route_rows[base + 4u] = brick.x;
  route_rows[base + 5u] = brick.y;
  route_rows[base + 6u] = brick.z;
  route_rows[base + 7u] = linear;
  route_rows[base + 8u] = directory_index;
  route_rows[base + 9u] = support_cells;
  route_rows[base + 10u] = params.generation_id;
  route_rows[base + 11u] = SPARSE_READY;
  route_keys[destination] = directory_index;
}

@compute @workgroup_size(1)
fn finalize_home_routes() {
  var count = 0u;
  if (params.eligibility_candidate_count > 0u) {
    let last = params.eligibility_candidate_count - 1u;
    count = eligibility_offsets[last] + eligibility_flags[last];
  }
  atomicStore(&evidence[EVIDENCE_ELIGIBLE_COUNT], count);
  atomicStore(&evidence[EVIDENCE_ROUTE_COUNT], count);
  if (count > params.route_capacity) {
    atomicStore(&evidence[EVIDENCE_ROUTE_OVERFLOW], count - params.route_capacity);
    atomicOr(&evidence[EVIDENCE_OVERFLOW_FLAGS], SPARSE_OVERFLOW_ROUTES);
  }
}
`;

export const sphSparseRenderFieldDirectoryWgsl = /* wgsl */ `
${sparseParamsWgsl}

@group(0) @binding(0) var<storage, read> sorted_route_indices: array<u32>;
@group(0) @binding(1) var<storage, read> route_rows: array<u32>;
@group(0) @binding(2) var<storage, read> route_keys: array<u32>;
@group(0) @binding(3) var<storage, read_write> route_ranges: array<u32>;
@group(0) @binding(4) var<storage, read_write> activation_flags: array<atomic<u32>>;
@group(0) @binding(5) var<storage, read_write> active_presence: array<u32>;
@group(0) @binding(6) var<storage, read> active_offsets: array<u32>;
@group(0) @binding(7) var<storage, read> sparse_surfaces: array<u32>;
@group(0) @binding(8) var<storage, read_write> active_brick_rows: array<u32>;
@group(0) @binding(9) var<storage, read_write> directory_entries: array<u32>;
@group(0) @binding(10) var<storage, read_write> evidence: array<atomic<u32>>;
@group(0) @binding(11) var<storage, read_write> active_dispatch: array<u32>;
@group(0) @binding(12) var<uniform> params: SparseParams;
@group(0) @binding(13) var<storage, read> unique_route_keys: array<u32>;
@group(0) @binding(14) var<storage, read> unique_route_offsets: array<u32>;
@group(0) @binding(15) var<storage, read> unique_route_evidence: array<u32>;
@group(0) @binding(16) var<storage, read_write> unique_home_dispatch: array<u32>;

var<workgroup> unique_home_support_radius: array<u32, 64>;

fn route_valid(record: u32) -> bool {
  return record < params.route_capacity && route_rows[record * 12u + 11u] == SPARSE_READY
    && route_rows[record * 12u + 10u] == params.generation_id
    && route_keys[record] != SPARSE_SENTINEL;
}

fn surface_slot_for_index(surface_index: u32) -> u32 {
  for (var slot = 0u; slot < params.surface_count; slot = slot + 1u) {
    if (sparse_surfaces[slot * 16u] == surface_index) { return slot; }
  }
  return SPARSE_SENTINEL;
}

fn mark_activation(surface_slot: u32, brick: vec3<i32>, flags: u32) {
  let base = surface_slot * 16u;
  let counts = vec3<i32>(
    i32(sparse_surfaces[base + 5u]), i32(sparse_surfaces[base + 6u]), i32(sparse_surfaces[base + 7u])
  );
  if (any(brick < vec3<i32>(0)) || any(brick >= counts)) { return; }
  let b = vec3<u32>(brick);
  let linear = b.x + u32(counts.x) * (b.y + u32(counts.y) * b.z);
  atomicOr(&activation_flags[sparse_surfaces[base + 8u] + linear], flags);
}

@compute @workgroup_size(1)
fn finalize_unique_home_dispatch() {
  let evidence_complete = unique_route_evidence[0u] == params.generation_id
    && unique_route_evidence[1u] == params.route_capacity
    && unique_route_evidence[3u] == SPARSE_READY
    && unique_route_evidence[4u] == 0u
    && unique_route_evidence[5u] == 1u
    && unique_route_evidence[6u] == 1u
    && unique_route_evidence[7u] == SPARSE_READY;
  if (!evidence_complete) {
    atomicAdd(&evidence[EVIDENCE_ROUTE_OVERFLOW], 1u);
    atomicOr(&evidence[EVIDENCE_OVERFLOW_FLAGS], SPARSE_OVERFLOW_ROUTES);
  }
  let unique_count = select(
    0u,
    min(unique_route_evidence[2u], params.route_capacity),
    evidence_complete
  );
  let x = min(unique_count, params.dispatch_width);
  unique_home_dispatch[0] = x;
  unique_home_dispatch[1] = select(0u, (unique_count + max(x, 1u) - 1u) / max(x, 1u), x > 0u);
  unique_home_dispatch[2] = 1u;
}

@compute @workgroup_size(64)
fn build_unique_ranges_and_activation(
  @builtin(workgroup_id) workgroup_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>
) {
  let unique_index = workgroup_id.x + workgroup_id.y * params.dispatch_width;
  let unique_count = min(unique_route_evidence[2u], params.route_capacity);
  if (unique_index >= unique_count) { return; }
  let directory_index = unique_route_keys[unique_index];
  if (directory_index == SPARSE_SENTINEL || directory_index >= params.directory_capacity) { return; }
  let start = unique_route_offsets[unique_index];
  let end = min(unique_route_offsets[unique_index + 1u], params.route_capacity);
  if (start >= end) { return; }
  let first_record = sorted_route_indices[start];
  if (!route_valid(first_record) || route_keys[first_record] != directory_index) { return; }
  let first_base = first_record * 12u;
  let surface_slot = surface_slot_for_index(route_rows[first_base + 3u]);
  if (surface_slot == SPARSE_SENTINEL) { return; }
  let home = vec3<i32>(
    i32(route_rows[first_base + 4u]),
    i32(route_rows[first_base + 5u]),
    i32(route_rows[first_base + 6u])
  );

  var local_radius = 0u;
  for (var position = start + local_id.x; position < end; position = position + 64u) {
    let record = sorted_route_indices[position];
    if (route_valid(record) && route_keys[record] == directory_index) {
      let route_base = record * 12u;
      local_radius = max(
        local_radius,
        (route_rows[route_base + 9u] + params.brick_size - 1u) / params.brick_size
      );
    }
  }
  unique_home_support_radius[local_id.x] = local_radius;
  workgroupBarrier();
  for (var stride = 32u; stride > 0u; stride = stride >> 1u) {
    if (local_id.x < stride) {
      unique_home_support_radius[local_id.x] = max(
        unique_home_support_radius[local_id.x],
        unique_home_support_radius[local_id.x + stride]
      );
    }
    workgroupBarrier();
  }
  let radius = unique_home_support_radius[0u];
  if (radius > params.route_fanout_radius_bricks) {
    if (local_id.x == 0u) {
      atomicAdd(&evidence[EVIDENCE_ROUTE_OVERFLOW], 1u);
      atomicOr(&evidence[EVIDENCE_OVERFLOW_FLAGS], SPARSE_OVERFLOW_ROUTES);
    }
    return;
  }
  if (local_id.x == 0u) {
    let range = directory_index * 4u;
    route_ranges[range] = start;
    route_ranges[range + 1u] = end - start;
    route_ranges[range + 2u] = params.generation_id;
    route_ranges[range + 3u] = SPARSE_READY;
  }

  let side = radius * 2u + 1u;
  let direct_count = side * side * side;
  let activation_count = direct_count * 8u;
  for (var activation = local_id.x; activation < activation_count; activation = activation + 64u) {
    let direct_slot = activation >> 3u;
    let mask = activation & 7u;
    let dz = direct_slot / (side * side);
    let remainder = direct_slot - dz * side * side;
    let dy = remainder / side;
    let dx = remainder - dy * side;
    let direct = home + vec3<i32>(i32(dx), i32(dy), i32(dz)) - vec3<i32>(i32(radius));
    if (mask == 0u) {
      mark_activation(surface_slot, direct, SPARSE_ACTIVE_DIRECT);
    } else {
      let px = mask & 1u;
      let py = (mask >> 1u) & 1u;
      let pz = (mask >> 2u) & 1u;
      var flags = SPARSE_ACTIVE_HALO;
      if (px != 0u) { flags = flags | SPARSE_ACTIVE_PREDECESSOR_X; }
      if (py != 0u) { flags = flags | SPARSE_ACTIVE_PREDECESSOR_Y; }
      if (pz != 0u) { flags = flags | SPARSE_ACTIVE_PREDECESSOR_Z; }
      mark_activation(surface_slot, direct - vec3<i32>(i32(px), i32(py), i32(pz)), flags);
    }
  }
}

@compute @workgroup_size(64)
fn mark_active_presence(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let directory_index = sparse_linear_index(global_id);
  if (directory_index < params.directory_capacity) {
    active_presence[directory_index] = select(0u, 1u, atomicLoad(&activation_flags[directory_index]) != 0u);
  }
}

fn surface_slot_for_directory(directory_index: u32) -> u32 {
  for (var slot = 0u; slot < params.surface_count; slot = slot + 1u) {
    let base = slot * 16u;
    let offset = sparse_surfaces[base + 8u];
    let count = sparse_surfaces[base + 9u];
    if (directory_index >= offset && directory_index < offset + count) { return slot; }
  }
  return SPARSE_SENTINEL;
}

@compute @workgroup_size(64)
fn scatter_active_directory(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let directory_index = sparse_linear_index(global_id);
  if (directory_index >= params.directory_capacity || active_presence[directory_index] == 0u) { return; }
  let active_index = active_offsets[directory_index];
  if (active_index >= params.active_brick_capacity) {
    atomicAdd(&evidence[EVIDENCE_ACTIVE_OVERFLOW], 1u);
    atomicOr(&evidence[EVIDENCE_OVERFLOW_FLAGS], SPARSE_OVERFLOW_ACTIVE_BRICKS);
    return;
  }
  let slot = surface_slot_for_directory(directory_index);
  if (slot == SPARSE_SENTINEL) { return; }
  let sparse_base = slot * 16u;
  let local = directory_index - sparse_surfaces[sparse_base + 8u];
  let nx = sparse_surfaces[sparse_base + 5u];
  let ny = sparse_surfaces[sparse_base + 6u];
  let bz = local / (nx * ny);
  let rem = local - bz * nx * ny;
  let by = rem / nx;
  let bx = rem - by * nx;
  let dimensions = vec3<u32>(
    sparse_surfaces[sparse_base + 1u], sparse_surfaces[sparse_base + 2u], sparse_surfaces[sparse_base + 3u]
  );
  let start = vec3<u32>(bx, by, bz) * vec3<u32>(8u);
  let sample_extent = min(vec3<u32>(8u), dimensions - min(dimensions, start));
  let dual = dimensions - min(dimensions, vec3<u32>(1u));
  let voxel_extent = min(vec3<u32>(8u), dual - min(dual, start));
  let flags = atomicLoad(&activation_flags[directory_index]);
  let base = active_index * 16u;
  active_brick_rows[base] = sparse_surfaces[sparse_base];
  active_brick_rows[base + 1u] = bx;
  active_brick_rows[base + 2u] = by;
  active_brick_rows[base + 3u] = bz;
  active_brick_rows[base + 4u] = local;
  active_brick_rows[base + 5u] = directory_index;
  active_brick_rows[base + 6u] = active_index;
  active_brick_rows[base + 7u] = active_index * 512u;
  active_brick_rows[base + 8u] = sample_extent.x;
  active_brick_rows[base + 9u] = sample_extent.y;
  active_brick_rows[base + 10u] = sample_extent.z;
  active_brick_rows[base + 11u] = voxel_extent.x * voxel_extent.y * voxel_extent.z;
  active_brick_rows[base + 12u] = flags;
  active_brick_rows[base + 13u] = params.generation_id;
  let range = directory_index * 4u;
  active_brick_rows[base + 14u] = select(0u, route_ranges[range], route_ranges[range + 3u] == SPARSE_READY);
  active_brick_rows[base + 15u] = select(0u, route_ranges[range + 1u], route_ranges[range + 3u] == SPARSE_READY);
  directory_entries[directory_index] = active_index;
  if ((flags & SPARSE_ACTIVE_DIRECT) != 0u) {
    atomicAdd(&evidence[EVIDENCE_DIRECT_ACTIVE], 1u);
  } else {
    atomicAdd(&evidence[EVIDENCE_HALO_ONLY], 1u);
  }
}

@compute @workgroup_size(1)
fn finalize_active_directory() {
  var count = 0u;
  if (params.directory_capacity > 0u) {
    let last = params.directory_capacity - 1u;
    count = active_offsets[last] + active_presence[last];
  }
  atomicStore(&evidence[EVIDENCE_ACTIVE_COUNT], count);
  let atlas_required = count * 512u;
  atomicStore(&evidence[EVIDENCE_ATLAS_REQUIRED], atlas_required);
  if (count > params.active_brick_capacity) {
    atomicStore(&evidence[EVIDENCE_ACTIVE_OVERFLOW], count - params.active_brick_capacity);
    atomicOr(&evidence[EVIDENCE_OVERFLOW_FLAGS], SPARSE_OVERFLOW_ACTIVE_BRICKS);
  }
  if (atlas_required > params.atlas_cell_capacity) {
    atomicOr(&evidence[EVIDENCE_OVERFLOW_FLAGS], SPARSE_OVERFLOW_ATLAS);
  }
  let groups = min(count, params.active_brick_capacity) * 8u;
  let x = min(groups, params.dispatch_width);
  active_dispatch[0] = x;
  var y = 0u;
  if (x > 0u) { y = (groups + x - 1u) / x; }
  active_dispatch[1] = y;
  active_dispatch[2] = 1u;
}
`;

export const sphSparseRenderFieldGatherAtlasWgsl = /* wgsl */ `
${sparseParamsWgsl}

@group(0) @binding(0) var<storage, read> render_rows: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> render_surfaces: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> sparse_surfaces: array<u32>;
@group(0) @binding(3) var<storage, read> product_events: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> sorted_route_indices: array<u32>;
@group(0) @binding(5) var<storage, read> route_rows: array<u32>;
@group(0) @binding(6) var<storage, read> route_ranges: array<u32>;
@group(0) @binding(7) var<storage, read> active_brick_rows: array<u32>;
@group(0) @binding(8) var<storage, read_write> atlas_cells: array<vec4<f32>>;
@group(0) @binding(9) var<storage, read> directory_entries: array<u32>;
@group(0) @binding(10) var<storage, read> candidate_slices: array<u32>;
@group(0) @binding(11) var<storage, read_write> candidate_voxel_ids: array<u32>;
@group(0) @binding(12) var<storage, read_write> candidate_counters: array<atomic<u32>>;
@group(0) @binding(13) var<storage, read_write> evidence: array<atomic<u32>>;
@group(0) @binding(14) var<uniform> params: SparseParams;
@group(0) @binding(15) var<storage, read_write> candidate_dispatch_indirect: array<u32>;

fn surface_slot_for_index(surface_index: u32) -> u32 {
  for (var slot = 0u; slot < params.surface_count; slot = slot + 1u) {
    if (sparse_surfaces[slot * 16u] == surface_index) { return slot; }
  }
  return SPARSE_SENTINEL;
}

fn phase_weight(surface_phase: f32, row_phase: f32, gas_fraction: f32, solid_fraction: f32) -> f32 {
  let gas = clamp(gas_fraction, 0.0, 1.0);
  let solid = clamp(solid_fraction, 0.0, 1.0);
  let liquid = clamp(1.0 - gas - solid, 0.0, 1.0);
  if (surface_phase == 1.0) { return solid; }
  if (surface_phase == 2.0) { return liquid; }
  if (surface_phase == 3.0) { return gas; }
  return select(0.0, 1.0, row_phase == surface_phase);
}

fn palette_weight(ratio: f32) -> f32 {
  let t = clamp(ratio, 0.0, 1.0);
  return 1.0 - t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

fn route_range_for_neighbor(surface_slot: u32, home: vec3<i32>) -> vec2<u32> {
  let base = surface_slot * 16u;
  let counts = vec3<i32>(
    i32(sparse_surfaces[base + 5u]), i32(sparse_surfaces[base + 6u]), i32(sparse_surfaces[base + 7u])
  );
  if (any(home < vec3<i32>(0)) || any(home >= counts)) { return vec2<u32>(0u); }
  let b = vec3<u32>(home);
  let linear = b.x + u32(counts.x) * (b.y + u32(counts.y) * b.z);
  let directory_index = sparse_surfaces[base + 8u] + linear;
  let range = directory_index * 4u;
  if (route_ranges[range + 3u] != SPARSE_READY) { return vec2<u32>(0u); }
  return vec2<u32>(route_ranges[range], route_ranges[range + 1u]);
}

struct ParticleContribution {
  value: f32,
  palette: f32,
  temperature: f32,
};

fn particle_contribution(source_index: u32, surface_slot: u32, cell: vec3<f32>, smear_sq: f32) -> ParticleContribution {
  let row0 = render_rows[source_index * 5u];
  let row1 = render_rows[source_index * 5u + 1u];
  let row2 = render_rows[source_index * 5u + 2u];
  let row4 = render_rows[source_index * 5u + 4u];
  let s0 = render_surfaces[surface_slot * 4u];
  let s1 = render_surfaces[surface_slot * 4u + 1u];
  let weight = phase_weight(s0.y, row1.y, row2.y, row4.x);
  let position = clamp(
    vec3<f32>(params.field_padding)
      + row0.xyz / max(params.ref_edge_m, 1.0e-12) * (1.0 - 2.0 * params.field_padding),
    vec3<f32>(0.001), vec3<f32>(0.999)
  );
  let dist2 = dot(cell - position, cell - position) + smear_sq;
  let value = s1.w * weight / (0.000001 + dist2) - max(s1.z, 1.0e-12);
  if (weight <= 0.003 || value <= 0.0) { return ParticleContribution(0.0, 0.0, 0.0); }
  let support = sqrt(abs(s1.w) / max(s1.z, 1.0e-12));
  return ParticleContribution(value, palette_weight(sqrt(dist2) / max(support, 1.0e-6)) * weight, row1.z);
}

@compute @workgroup_size(64)
fn gather_atlas(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let linear = sparse_linear_index(global_id);
  let active_index = linear / 512u;
  let local_index = linear - active_index * 512u;
  if (active_index >= params.active_brick_capacity) { return; }
  let active_base = active_index * 16u;
  if (active_brick_rows[active_base + 12u] == 0u
    || active_brick_rows[active_base + 13u] != params.generation_id) { return; }
  let lx = local_index & 7u;
  let ly = (local_index >> 3u) & 7u;
  let lz = local_index >> 6u;
  if (lx >= active_brick_rows[active_base + 8u]
    || ly >= active_brick_rows[active_base + 9u]
    || lz >= active_brick_rows[active_base + 10u]) { return; }
  let surface_index = active_brick_rows[active_base];
  let surface_slot = surface_slot_for_index(surface_index);
  if (surface_slot == SPARSE_SENTINEL) { return; }
  let sparse_base = surface_slot * 16u;
  let dimensions = vec3<u32>(
    sparse_surfaces[sparse_base + 1u], sparse_surfaces[sparse_base + 2u], sparse_surfaces[sparse_base + 3u]
  );
  let brick = vec3<i32>(
    i32(active_brick_rows[active_base + 1u]),
    i32(active_brick_rows[active_base + 2u]),
    i32(active_brick_rows[active_base + 3u])
  );
  let sample = vec3<u32>(brick) * vec3<u32>(8u) + vec3<u32>(lx, ly, lz);
  let cell = vec3<f32>(sample) / vec3<f32>(dimensions);
  let radius = i32(params.route_fanout_radius_bricks);
  let side = u32(radius * 2 + 1);
  let neighbor_count = side * side * side;
  let color = render_surfaces[surface_slot * 4u + 2u].yzw;
  var density = 0.0;
  var palette = vec3<f32>(0.0);
  var temperature_weighted = 0.0;
  var temperature_weight = 0.0;
  var velocity_weighted = vec3<f32>(0.0);
  var velocity_sq_weighted = 0.0;
  for (var neighbor = 0u; neighbor < neighbor_count; neighbor = neighbor + 1u) {
    let oz = neighbor / (side * side);
    let rem = neighbor - oz * side * side;
    let oy = rem / side;
    let ox = rem - oy * side;
    let range = route_range_for_neighbor(
      surface_slot,
      brick + vec3<i32>(i32(ox), i32(oy), i32(oz)) - vec3<i32>(radius)
    );
    for (var member = 0u; member < range.y; member = member + 1u) {
      let route_index = sorted_route_indices[range.x + member];
      let route_base = route_index * 12u;
      if (route_rows[route_base + 2u] != SPARSE_SOURCE_PARTICLE) { continue; }
      let source = route_rows[route_base + 1u];
      let contribution = particle_contribution(source, surface_slot, cell, 0.0);
      if (contribution.value <= 0.0) { continue; }
      density = density + contribution.value;
      palette = palette + color * contribution.palette;
      temperature_weighted = temperature_weighted + contribution.temperature * contribution.value;
      temperature_weight = temperature_weight + contribution.value;
      let velocity = render_rows[source * 5u + 4u].yzw;
      velocity_weighted = velocity_weighted + velocity * contribution.value;
      velocity_sq_weighted = velocity_sq_weighted + dot(velocity, velocity) * contribution.value;
    }
  }
  if (temperature_weight > 0.0 && params.render_smear_dt_s > 0.0) {
    let mean_velocity = velocity_weighted / temperature_weight;
    let dispersion_sq = max(0.0, velocity_sq_weighted / temperature_weight - dot(mean_velocity, mean_velocity));
    let smear = sqrt(dispersion_sq) * params.render_smear_dt_s
      * (1.0 - 2.0 * params.field_padding) / max(params.ref_edge_m, 1.0e-12);
    let smear_sq = smear * smear;
    if (smear_sq > 1.0e-10) {
      density = 0.0;
      palette = vec3<f32>(0.0);
      temperature_weighted = 0.0;
      temperature_weight = 0.0;
      // The correction repeats only bounded neighboring home-directory CSR ranges.
      for (var neighbor = 0u; neighbor < neighbor_count; neighbor = neighbor + 1u) {
        let oz = neighbor / (side * side);
        let rem = neighbor - oz * side * side;
        let oy = rem / side;
        let ox = rem - oy * side;
        let range = route_range_for_neighbor(
          surface_slot,
          brick + vec3<i32>(i32(ox), i32(oy), i32(oz)) - vec3<i32>(radius)
        );
        for (var member = 0u; member < range.y; member = member + 1u) {
          let route_index = sorted_route_indices[range.x + member];
          let route_base = route_index * 12u;
          if (route_rows[route_base + 2u] != SPARSE_SOURCE_PARTICLE) { continue; }
          let contribution = particle_contribution(route_rows[route_base + 1u], surface_slot, cell, smear_sq);
          if (contribution.value <= 0.0) { continue; }
          density = density + contribution.value;
          palette = palette + color * contribution.palette;
          temperature_weighted = temperature_weighted + contribution.temperature * contribution.value;
          temperature_weight = temperature_weight + contribution.value;
        }
      }
    }
  }
  let s1 = render_surfaces[surface_slot * 4u + 1u];
  for (var neighbor = 0u; neighbor < neighbor_count; neighbor = neighbor + 1u) {
    let oz = neighbor / (side * side);
    let rem = neighbor - oz * side * side;
    let oy = rem / side;
    let ox = rem - oy * side;
    let range = route_range_for_neighbor(
      surface_slot,
      brick + vec3<i32>(i32(ox), i32(oy), i32(oz)) - vec3<i32>(radius)
    );
    for (var member = 0u; member < range.y; member = member + 1u) {
      let route_index = sorted_route_indices[range.x + member];
      let route_base = route_index * 12u;
      if (route_rows[route_base + 2u] != SPARSE_SOURCE_PRODUCT_EVENT) { continue; }
      let source = route_rows[route_base + 1u];
      let position = clamp(
        vec3<f32>(params.field_padding)
          + product_events[source * 8u].xyz / max(params.ref_edge_m, 1.0e-12)
            * (1.0 - 2.0 * params.field_padding),
        vec3<f32>(0.001), vec3<f32>(0.999)
      );
      let dist2 = dot(cell - position, cell - position);
      let value = s1.w / (0.000001 + dist2) - max(s1.z, 1.0e-12);
      if (value > 0.0) {
        density = density + value;
        let support = sqrt(abs(s1.w) / max(s1.z, 1.0e-12));
        palette = palette + color * palette_weight(sqrt(dist2) / max(support, 1.0e-6));
      }
    }
  }
  let atlas_offset = active_brick_rows[active_base + 7u] + local_index;
  if (atlas_offset < params.atlas_cell_capacity) {
    atlas_cells[atlas_offset * 2u] = vec4<f32>(density, palette);
    atlas_cells[atlas_offset * 2u + 1u] = vec4<f32>(
      select(0.0, temperature_weighted / max(temperature_weight, 1.0e-6), temperature_weight > 0.0),
      0.0, 0.0, 0.0
    );
  }
}

fn atlas_density(surface_index: u32, sample: vec3<u32>) -> f32 {
  let slot = surface_slot_for_index(surface_index);
  if (slot == SPARSE_SENTINEL) { return 0.0; }
  let base = slot * 16u;
  let dimensions = vec3<u32>(
    sparse_surfaces[base + 1u], sparse_surfaces[base + 2u], sparse_surfaces[base + 3u]
  );
  if (any(sample >= dimensions)) { return 0.0; }
  let brick = sample / vec3<u32>(8u);
  let counts = vec3<u32>(
    sparse_surfaces[base + 5u], sparse_surfaces[base + 6u], sparse_surfaces[base + 7u]
  );
  let directory_index = sparse_surfaces[base + 8u]
    + brick.x + counts.x * (brick.y + counts.y * brick.z);
  let active_index = directory_entries[directory_index];
  if (active_index == SPARSE_SENTINEL || active_index >= params.active_brick_capacity) { return 0.0; }
  let active_base = active_index * 16u;
  let local = sample - brick * vec3<u32>(8u);
  let atlas_offset = active_brick_rows[active_base + 7u] + local.x + 8u * (local.y + 8u * local.z);
  if (atlas_offset >= params.atlas_cell_capacity) { return 0.0; }
  return atlas_cells[atlas_offset * 2u].x;
}

@compute @workgroup_size(64)
fn compact_surface_voxels(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let linear = sparse_linear_index(global_id);
  let active_index = linear / 512u;
  let local_voxel = linear - active_index * 512u;
  if (active_index >= params.active_brick_capacity) { return; }
  let active_base = active_index * 16u;
  if (active_brick_rows[active_base + 12u] == 0u
    || active_brick_rows[active_base + 13u] != params.generation_id) { return; }
  let surface_index = active_brick_rows[active_base];
  let slot = surface_slot_for_index(surface_index);
  if (slot == SPARSE_SENTINEL) { return; }
  let base = slot * 16u;
  let dimensions = vec3<u32>(
    sparse_surfaces[base + 1u], sparse_surfaces[base + 2u], sparse_surfaces[base + 3u]
  );
  let start = vec3<u32>(
    active_brick_rows[active_base + 1u],
    active_brick_rows[active_base + 2u],
    active_brick_rows[active_base + 3u]
  ) * vec3<u32>(8u);
  let dual = dimensions - min(dimensions, vec3<u32>(1u));
  let extent = min(vec3<u32>(8u), dual - min(dual, start));
  let count = extent.x * extent.y * extent.z;
  if (local_voxel >= count || extent.x == 0u || extent.y == 0u) { return; }
  let lz = local_voxel / (extent.x * extent.y);
  let rem = local_voxel - lz * extent.x * extent.y;
  let ly = rem / extent.x;
  let lx = rem - ly * extent.x;
  let sample = start + vec3<u32>(lx, ly, lz);
  let isolation = render_surfaces[slot * 4u + 1u].y;
  var mask = 0u;
  if (atlas_density(surface_index, sample) >= isolation) { mask = mask | 1u; }
  if (atlas_density(surface_index, sample + vec3<u32>(1u, 0u, 0u)) >= isolation) { mask = mask | 2u; }
  if (atlas_density(surface_index, sample + vec3<u32>(1u, 1u, 0u)) >= isolation) { mask = mask | 4u; }
  if (atlas_density(surface_index, sample + vec3<u32>(0u, 1u, 0u)) >= isolation) { mask = mask | 8u; }
  if (atlas_density(surface_index, sample + vec3<u32>(0u, 0u, 1u)) >= isolation) { mask = mask | 16u; }
  if (atlas_density(surface_index, sample + vec3<u32>(1u, 0u, 1u)) >= isolation) { mask = mask | 32u; }
  if (atlas_density(surface_index, sample + vec3<u32>(1u, 1u, 1u)) >= isolation) { mask = mask | 64u; }
  if (atlas_density(surface_index, sample + vec3<u32>(0u, 1u, 1u)) >= isolation) { mask = mask | 128u; }
  if (mask == 0u || mask == 255u) { return; }
  let slice = slot * 4u;
  let output_index = atomicAdd(&candidate_counters[candidate_slices[slice + 2u]], 1u);
  if (output_index >= candidate_slices[slice + 1u]) {
    atomicOr(&evidence[EVIDENCE_OVERFLOW_FLAGS], SPARSE_OVERFLOW_VOXELS);
    return;
  }
  let logical_id = sample.x + dual.x * (sample.y + dual.y * sample.z);
  candidate_voxel_ids[candidate_slices[slice] + output_index] = logical_id;
}

@compute @workgroup_size(1)
fn finalize_surface_candidates() {
  var total = 0u;
  for (var slot = 0u; slot < params.surface_count; slot = slot + 1u) {
    let slice = slot * 4u;
    let count = atomicLoad(&candidate_counters[candidate_slices[slice + 2u]]);
    total = total + count;
    if (count > candidate_slices[slice + 1u]) {
      atomicOr(&evidence[EVIDENCE_OVERFLOW_FLAGS], SPARSE_OVERFLOW_VOXELS);
    }
  }
  atomicStore(&evidence[EVIDENCE_VOXEL_REQUIRED], total);
  let overflow = atomicLoad(&evidence[EVIDENCE_OVERFLOW_FLAGS]);
  let admitted = params.host_admitted != 0u && overflow == 0u;
  for (var slot = 0u; slot < params.surface_count; slot = slot + 1u) {
    let slice = slot * 4u;
    let count = atomicLoad(&candidate_counters[candidate_slices[slice + 2u]]);
    let dispatch = slot * 3u;
    candidate_dispatch_indirect[dispatch] = select(
      0u,
      (min(count, candidate_slices[slice + 1u]) + 31u) / 32u,
      admitted
    );
    candidate_dispatch_indirect[dispatch + 1u] = 1u;
    candidate_dispatch_indirect[dispatch + 2u] = 1u;
  }
  if (admitted) {
    atomicStore(&evidence[EVIDENCE_ADMISSION_FLAGS], SPARSE_ADMISSION_APPROVED);
    atomicStore(&evidence[EVIDENCE_PUBLICATION_ALLOWED], 1u);
    atomicStore(&evidence[EVIDENCE_FAIL_CLOSED], 0u);
    atomicStore(&evidence[EVIDENCE_RETAIN_PREVIOUS], 0u);
    atomicStore(&evidence[EVIDENCE_STATUS], SPARSE_READY);
  } else {
    atomicStore(&evidence[EVIDENCE_ADMISSION_FLAGS], SPARSE_ADMISSION_FAIL_CLOSED | SPARSE_ADMISSION_RETAIN_PREVIOUS);
    atomicStore(&evidence[EVIDENCE_PUBLICATION_ALLOWED], 0u);
    atomicStore(&evidence[EVIDENCE_FAIL_CLOSED], 1u);
    atomicStore(&evidence[EVIDENCE_RETAIN_PREVIOUS], 1u);
    atomicStore(&evidence[EVIDENCE_STATUS], SPARSE_BLOCKED);
  }
}
`;
