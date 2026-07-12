export const coherentSolidMetamorphicValidationWgsl = /* wgsl */ `
struct CoherentSolidMetamorphicParams {
  left_body_count: u32,
  right_body_count: u32,
  left_proxy_count: u32,
  right_proxy_count: u32,
  left_draw_count: u32,
  right_draw_count: u32,
  mode: u32,
  left_generation_id: u32,
  right_generation_id: u32,
  left_chart_id: i32,
  left_level_id: i32,
  left_hierarchy_generation: u32,
  left_position_epoch: u32,
  right_chart_id: i32,
  right_level_id: i32,
  right_hierarchy_generation: u32,
  right_position_epoch: u32,
  absolute_tolerance: f32,
  relative_tolerance: f32,
  validation_extent: u32,
  validation_dispatch_x: u32,
  validation_workgroup_size: u32,
  pad0: u32,
  pad1: u32,
};

const FRAME_WORDS: u32 = 80u;
const WORLD_PROXY_WORDS: u32 = 24u;
const EVIDENCE_MAGIC: u32 = 0x534f4c4du;
const EVIDENCE_VERSION: u32 = 1u;
const MODE_PARTITION_EQUIVALENCE: u32 = 0u;
const MODE_CHART_TRANSITION_CONTINUITY: u32 = 1u;
const INVALID_RESIDUAL: f32 = 3.402823e38;

@group(0) @binding(0) var<storage, read> left_frames: array<u32>;
@group(0) @binding(1) var<storage, read> right_frames: array<u32>;
@group(0) @binding(2) var<storage, read> left_world_proxies: array<u32>;
@group(0) @binding(3) var<storage, read> right_world_proxies: array<u32>;
@group(0) @binding(4) var<storage, read> left_draw_indices: array<u32>;
@group(0) @binding(5) var<storage, read> right_draw_indices: array<u32>;
@group(0) @binding(6) var<uniform> params: CoherentSolidMetamorphicParams;
@group(0) @binding(7) var<storage, read_write> evidence: array<atomic<u32>>;

fn finite_scalar(value: f32) -> bool {
  return value == value && abs(value) <= INVALID_RESIDUAL;
}

fn absolute_residual(left_word: u32, right_word: u32) -> f32 {
  let left = bitcast<f32>(left_word);
  let right = bitcast<f32>(right_word);
  let residual = abs(left - right);
  return select(INVALID_RESIDUAL, residual,
    finite_scalar(left) && finite_scalar(right) && finite_scalar(residual));
}

fn relative_residual(left_word: u32, right_word: u32) -> f32 {
  let left = bitcast<f32>(left_word);
  let right = bitcast<f32>(right_word);
  let scale = max(1e-30, max(abs(left), abs(right)));
  let residual = abs(left - right) / scale;
  return select(INVALID_RESIDUAL, residual,
    finite_scalar(left) && finite_scalar(right) && finite_scalar(residual));
}

fn mixed_tolerance_valid(left_word: u32, right_word: u32) -> bool {
  let left = bitcast<f32>(left_word);
  let right = bitcast<f32>(right_word);
  let residual = abs(left - right);
  if (!finite_scalar(left) || !finite_scalar(right) || !finite_scalar(residual)) {
    atomicAdd(&evidence[22], 1u);
    return false;
  }
  let tolerance = params.absolute_tolerance
    + params.relative_tolerance * max(abs(left), abs(right));
  return residual <= tolerance;
}

fn record_absolute_residual(left_word: u32, right_word: u32, evidence_word: u32) {
  let residual = absolute_residual(left_word, right_word);
  atomicMax(&evidence[evidence_word], bitcast<u32>(residual));
  if (residual == INVALID_RESIDUAL) { atomicAdd(&evidence[22], 1u); }
}

fn record_relative_residual(left_word: u32, right_word: u32, evidence_word: u32) {
  let residual = relative_residual(left_word, right_word);
  atomicMax(&evidence[evidence_word], bitcast<u32>(residual));
  if (residual == INVALID_RESIDUAL) { atomicAdd(&evidence[22], 1u); }
}

fn ordered_before(
  previous_body_id: u32,
  previous_proxy_id: u32,
  body_id: u32,
  proxy_id: u32
) -> bool {
  return previous_body_id < body_id
    || (previous_body_id == body_id && previous_proxy_id < proxy_id);
}

fn validation_index(
  workgroup_id: vec3<u32>,
  local_id: vec3<u32>
) -> u32 {
  return (workgroup_id.x + workgroup_id.y * params.validation_dispatch_x)
    * params.validation_workgroup_size + local_id.x;
}

@compute @workgroup_size(1)
fn initialize_coherent_solid_metamorphic_evidence() {
  for (var word = 0u; word < 32u; word += 1u) {
    atomicStore(&evidence[word], 0u);
  }
  atomicStore(&evidence[0], EVIDENCE_MAGIC);
  atomicStore(&evidence[1], EVIDENCE_VERSION);
  atomicStore(&evidence[2], params.mode);
  atomicStore(&evidence[4], params.left_body_count);
  atomicStore(&evidence[5], params.right_body_count);
  atomicStore(&evidence[6], params.left_proxy_count);
  atomicStore(&evidence[7], params.right_proxy_count);
  atomicStore(&evidence[8], select(0u, 1u,
    params.left_body_count != params.right_body_count));
  atomicStore(&evidence[9], select(0u, 1u,
    params.left_proxy_count != params.right_proxy_count));
  atomicStore(&evidence[10], select(0u, 1u,
    params.left_draw_count != params.right_draw_count
      || params.left_draw_count != params.left_body_count
      || params.right_draw_count != params.right_body_count));
  let partition_metadata_matches = params.left_generation_id == params.right_generation_id
    && params.left_chart_id == params.right_chart_id
    && params.left_level_id == params.right_level_id
    && params.left_hierarchy_generation == params.right_hierarchy_generation
    && params.left_position_epoch == params.right_position_epoch;
  atomicStore(&evidence[18], select(0u, 1u,
    params.mode == MODE_PARTITION_EQUIVALENCE && !partition_metadata_matches));
}

@compute @workgroup_size(64)
fn validate_coherent_solid_metamorphic_rows(
  @builtin(workgroup_id) workgroup_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>
) {
  let index = validation_index(workgroup_id, local_id);
  if (index >= params.validation_extent) { return; }

  if (index > 0u && index < params.left_proxy_count) {
    let previous = (index - 1u) * WORLD_PROXY_WORDS;
    let current = index * WORLD_PROXY_WORDS;
    if (!ordered_before(
      left_world_proxies[previous + 0u],
      left_world_proxies[previous + 1u],
      left_world_proxies[current + 0u],
      left_world_proxies[current + 1u]
    )) {
      atomicAdd(&evidence[11], 1u);
    }
  }
  if (index > 0u && index < params.right_proxy_count) {
    let previous = (index - 1u) * WORLD_PROXY_WORDS;
    let current = index * WORLD_PROXY_WORDS;
    if (!ordered_before(
      right_world_proxies[previous + 0u],
      right_world_proxies[previous + 1u],
      right_world_proxies[current + 0u],
      right_world_proxies[current + 1u]
    )) {
      atomicAdd(&evidence[12], 1u);
    }
  }

  if (index < min(params.left_proxy_count, params.right_proxy_count)) {
    let left_base = index * WORLD_PROXY_WORDS;
    let right_base = index * WORLD_PROXY_WORDS;
    if (left_world_proxies[left_base + 0u] != right_world_proxies[right_base + 0u]
      || left_world_proxies[left_base + 1u] != right_world_proxies[right_base + 1u]) {
      atomicAdd(&evidence[13], 1u);
    }
    if (left_world_proxies[left_base + 2u] != right_world_proxies[right_base + 2u]
      || left_world_proxies[left_base + 7u] != right_world_proxies[right_base + 7u]
      || left_world_proxies[left_base + 19u] != right_world_proxies[right_base + 19u]
      || left_world_proxies[left_base + 20u] != right_world_proxies[right_base + 20u]
      || left_world_proxies[left_base + 23u] != right_world_proxies[right_base + 23u]) {
      atomicAdd(&evidence[14], 1u);
    }
    let left_metadata_valid = left_world_proxies[left_base + 3u] == params.left_generation_id
      && bitcast<i32>(left_world_proxies[left_base + 11u]) == params.left_level_id
      && bitcast<i32>(left_world_proxies[left_base + 15u]) == params.left_chart_id
      && left_world_proxies[left_base + 21u] == params.left_hierarchy_generation
      && left_world_proxies[left_base + 22u] == params.left_position_epoch;
    let right_metadata_valid = right_world_proxies[right_base + 3u] == params.right_generation_id
      && bitcast<i32>(right_world_proxies[right_base + 11u]) == params.right_level_id
      && bitcast<i32>(right_world_proxies[right_base + 15u]) == params.right_chart_id
      && right_world_proxies[right_base + 21u] == params.right_hierarchy_generation
      && right_world_proxies[right_base + 22u] == params.right_position_epoch;
    if (!left_metadata_valid || !right_metadata_valid) {
      atomicAdd(&evidence[15], 1u);
    }
    for (var word = 4u; word <= 6u; word += 1u) {
      record_absolute_residual(
        left_world_proxies[left_base + word],
        right_world_proxies[right_base + word],
        23u
      );
    }
    for (var word = 8u; word <= 10u; word += 1u) {
      record_absolute_residual(
        left_world_proxies[left_base + word],
        right_world_proxies[right_base + word],
        24u
      );
    }
    for (var word = 12u; word <= 14u; word += 1u) {
      record_absolute_residual(
        left_world_proxies[left_base + word],
        right_world_proxies[right_base + word],
        25u
      );
    }
    for (var word = 16u; word <= 18u; word += 1u) {
      record_absolute_residual(
        left_world_proxies[left_base + word],
        right_world_proxies[right_base + word],
        26u
      );
    }
  }

  if (index < min(params.left_body_count, params.right_body_count)) {
    let left_base = index * FRAME_WORDS;
    let right_base = index * FRAME_WORDS;
    if (left_frames[left_base + 0u] != right_frames[right_base + 0u]) {
      atomicAdd(&evidence[16], 1u);
    }
    var static_mismatch = left_frames[left_base + 1u] != right_frames[right_base + 1u]
      || left_frames[left_base + 7u] != right_frames[right_base + 7u]
      || left_frames[left_base + 8u] != right_frames[right_base + 8u]
      || left_frames[left_base + 11u] != right_frames[right_base + 11u]
      || left_frames[left_base + 12u] != right_frames[right_base + 12u]
      || left_frames[left_base + 56u] != right_frames[right_base + 56u]
      || left_frames[left_base + 57u] != right_frames[right_base + 57u]
      || left_frames[left_base + 58u] != right_frames[right_base + 58u]
      || left_frames[left_base + 59u] != right_frames[right_base + 59u]
      || left_frames[left_base + 60u] != right_frames[right_base + 60u]
      || left_frames[left_base + 61u] != right_frames[right_base + 61u]
      || left_frames[left_base + 62u] != right_frames[right_base + 62u]
      || left_frames[left_base + 63u] != right_frames[right_base + 63u]
      || left_frames[left_base + 64u] != right_frames[right_base + 64u]
      || left_frames[left_base + 65u] != right_frames[right_base + 65u]
      || left_frames[left_base + 70u] != right_frames[right_base + 70u]
      || left_frames[left_base + 71u] != right_frames[right_base + 71u]
      || left_frames[left_base + 76u] != right_frames[right_base + 76u]
      || left_frames[left_base + 77u] != right_frames[right_base + 77u]
      || left_frames[left_base + 79u] != right_frames[right_base + 79u];
    if (params.mode == MODE_PARTITION_EQUIVALENCE
      && left_frames[left_base + 78u] != right_frames[right_base + 78u]) {
      static_mismatch = true;
    }
    for (var word = 28u; word <= 34u; word += 1u) {
      if (!mixed_tolerance_valid(
        left_frames[left_base + word],
        right_frames[right_base + word]
      )) { static_mismatch = true; }
    }
    for (var word = 36u; word <= 38u; word += 1u) {
      if (!mixed_tolerance_valid(
        left_frames[left_base + word],
        right_frames[right_base + word]
      )) { static_mismatch = true; }
    }
    for (var word = 40u; word <= 42u; word += 1u) {
      if (!mixed_tolerance_valid(
        left_frames[left_base + word],
        right_frames[right_base + word]
      )) { static_mismatch = true; }
    }
    for (var word = 44u; word <= 46u; word += 1u) {
      if (!mixed_tolerance_valid(
        left_frames[left_base + word],
        right_frames[right_base + word]
      )) { static_mismatch = true; }
    }
    for (var word = 48u; word <= 50u; word += 1u) {
      if (!mixed_tolerance_valid(
        left_frames[left_base + word],
        right_frames[right_base + word]
      )) { static_mismatch = true; }
    }
    for (var word = 52u; word <= 54u; word += 1u) {
      if (!mixed_tolerance_valid(
        left_frames[left_base + word],
        right_frames[right_base + word]
      )) { static_mismatch = true; }
    }
    for (var word = 66u; word <= 69u; word += 1u) {
      if (!mixed_tolerance_valid(
        left_frames[left_base + word],
        right_frames[right_base + word]
      )) { static_mismatch = true; }
    }
    if (params.mode == MODE_PARTITION_EQUIVALENCE) {
      for (var word = 72u; word <= 75u; word += 1u) {
        if (!mixed_tolerance_valid(
          left_frames[left_base + word],
          right_frames[right_base + word]
        )) { static_mismatch = true; }
      }
    }
    if (static_mismatch) { atomicAdd(&evidence[17], 1u); }
    let left_metadata_valid = left_frames[left_base + 2u] == params.left_position_epoch
      && bitcast<i32>(left_frames[left_base + 4u]) == params.left_chart_id
      && left_frames[left_base + 5u] == params.left_hierarchy_generation
      && bitcast<i32>(left_frames[left_base + 6u]) == params.left_level_id
      && left_frames[left_base + 9u] == params.left_generation_id;
    let right_metadata_valid = right_frames[right_base + 2u] == params.right_position_epoch
      && bitcast<i32>(right_frames[right_base + 4u]) == params.right_chart_id
      && right_frames[right_base + 5u] == params.right_hierarchy_generation
      && bitcast<i32>(right_frames[right_base + 6u]) == params.right_level_id
      && right_frames[right_base + 9u] == params.right_generation_id;
    if (!left_metadata_valid || !right_metadata_valid) {
      atomicAdd(&evidence[18], 1u);
    }
    for (var word = 13u; word <= 15u; word += 1u) {
      record_absolute_residual(
        left_frames[left_base + word],
        right_frames[right_base + word],
        27u
      );
    }
    for (var word = 16u; word <= 19u; word += 1u) {
      record_absolute_residual(
        left_frames[left_base + word],
        right_frames[right_base + word],
        28u
      );
    }
    for (var word = 20u; word <= 22u; word += 1u) {
      record_relative_residual(
        left_frames[left_base + word],
        right_frames[right_base + word],
        29u
      );
    }
    for (var word = 24u; word <= 26u; word += 1u) {
      record_relative_residual(
        left_frames[left_base + word],
        right_frames[right_base + word],
        29u
      );
    }
    record_relative_residual(
      left_frames[left_base + 30u],
      right_frames[right_base + 30u],
      30u
    );
  }

  if (index < min(params.left_draw_count, params.right_draw_count)) {
    if (left_draw_indices[index] != right_draw_indices[index]) {
      atomicAdd(&evidence[19], 1u);
    }
    if (left_draw_indices[index] != index) {
      atomicAdd(&evidence[20], 1u);
    }
    if (right_draw_indices[index] != index) {
      atomicAdd(&evidence[21], 1u);
    }
  }
}

@compute @workgroup_size(1)
fn finalize_coherent_solid_metamorphic_evidence() {
  let mode_valid = params.mode == MODE_PARTITION_EQUIVALENCE
    || params.mode == MODE_CHART_TRANSITION_CONTINUITY;
  var counters_clear = true;
  for (var word = 8u; word <= 22u; word += 1u) {
    counters_clear = counters_clear && atomicLoad(&evidence[word]) == 0u;
  }
  let residuals_clear = bitcast<f32>(atomicLoad(&evidence[23]))
      <= params.absolute_tolerance
    && bitcast<f32>(atomicLoad(&evidence[24])) <= params.absolute_tolerance
    && bitcast<f32>(atomicLoad(&evidence[25])) <= params.absolute_tolerance
    && bitcast<f32>(atomicLoad(&evidence[26])) <= params.absolute_tolerance
    && bitcast<f32>(atomicLoad(&evidence[27])) <= params.absolute_tolerance
    && bitcast<f32>(atomicLoad(&evidence[28])) <= params.absolute_tolerance
    && bitcast<f32>(atomicLoad(&evidence[29])) <= params.relative_tolerance
    && bitcast<f32>(atomicLoad(&evidence[30])) <= params.relative_tolerance;
  atomicStore(&evidence[3], select(0u, 1u,
    mode_valid && counters_clear && residuals_clear));
  atomicStore(&evidence[31], select(0u, 3u, mode_valid));
}
`;
