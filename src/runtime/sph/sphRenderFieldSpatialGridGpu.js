import { sphDispersedMediumOpticsWgsl } from '../../../ulg-gpu-abi/src/sphDispersedMediumWgsl.js';
import {
  computeBufferBinding,
  createCachedExplicitBindGroup,
  createCachedExplicitComputePipeline,
  deferSubmittedWorkCleanup
} from '../webgpuComputeLayout.js';

export const SPH_RENDER_FIELD_SPATIAL_GRID_BRICK_EDGE = 4;
export const SPH_RENDER_FIELD_SPATIAL_GRID_MAX_SURFACES = 64;
export const SPH_RENDER_FIELD_SPATIAL_GRID_SCAN_BLOCK_SIZE = 512;
export const SPH_RENDER_FIELD_SPATIAL_GRID_MAX_BRICKS =
  SPH_RENDER_FIELD_SPATIAL_GRID_SCAN_BLOCK_SIZE
  * SPH_RENDER_FIELD_SPATIAL_GRID_SCAN_BLOCK_SIZE;
export const SPH_RENDER_FIELD_SPATIAL_GRID_MAX_BRICKS_PER_SOURCE = 512;
export const SPH_RENDER_FIELD_SPATIAL_GRID_PARAMS_BYTES =
  20 * Uint32Array.BYTES_PER_ELEMENT
  + SPH_RENDER_FIELD_SPATIAL_GRID_MAX_SURFACES * 4 * Uint32Array.BYTES_PER_ELEMENT;

const GPU_BUFFER_USAGE = {
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64
};

const SPATIAL_GRID_COMMON_STRUCTS_WGSL = /* wgsl */ `
struct RenderFieldParams {
  particle_count: u32,
  surface_count: u32,
  total_field_cells: u32,
  product_event_count: u32,
  field_padding: f32,
  ref_edge_m: f32,
  render_smear_dt_s: f32,
  dispersed_medium_enabled: u32,
};

struct RenderProductHistoryGateParams {
  gate_required: u32,
  expected_magic: u32,
  expected_version: u32,
  expected_ready_status: u32,
  expected_generation: u32,
  expected_seal: u32,
  expected_row_capacity: u32,
  expected_row_stride_vec4: u32,
};

struct SpatialGridParams {
  total_bricks: u32,
  scan_block_count: u32,
  particle_entry_capacity: u32,
  event_entry_capacity: u32,
  max_bricks_per_source: u32,
  has_product_events: u32,
  surface_fallback_offset: u32,
  surface_event_fallback_offset: u32,
  p_counts_offset: u32,
  p_offsets_offset: u32,
  p_cursors_offset: u32,
  p_block_totals_offset: u32,
  p_entries_offset: u32,
  e_counts_offset: u32,
  e_offsets_offset: u32,
  e_cursors_offset: u32,
  e_block_totals_offset: u32,
  e_entries_offset: u32,
  _pad0: u32,
  _pad1: u32,
  surface_brick_info: array<vec4<u32>, ${SPH_RENDER_FIELD_SPATIAL_GRID_MAX_SURFACES}>,
};

const RENDER_FIELD_RENDER_ROW_VEC4_STRIDE: u32 = 5u;
const RENDER_FIELD_F32_FINITE_MAX: f32 = 3.402823466e+38;
const RENDER_FIELD_F32_MIN_NORMAL: f32 = 1.175494351e-38;
`;

const SPATIAL_GRID_HISTORY_AND_SURFACE_HELPERS_WGSL = /* wgsl */ `
fn render_product_history_ready() -> bool {
  if (product_history_gate.gate_required == 0u) {
    return true;
  }
  return arrayLength(&product_history_control) >= 8u
    && product_history_control[0u] == product_history_gate.expected_magic
    && product_history_control[1u] == product_history_gate.expected_version
    && product_history_control[2u] == product_history_gate.expected_ready_status
    && product_history_control[3u] <= product_history_control[4u]
    && product_history_control[4u] == product_history_gate.expected_row_capacity
    && product_history_control[5u] == product_history_gate.expected_row_stride_vec4
    && product_history_control[6u] == product_history_gate.expected_generation
    && product_history_control[7u] == product_history_gate.expected_seal;
}

fn render_product_event_count() -> u32 {
  if (product_history_gate.gate_required != 0u) {
    return product_history_control[3u];
  }
  return params.product_event_count;
}

fn surface_row0(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u];
}

fn surface_row1(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u + 1u];
}

fn surface_row2(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u + 2u];
}

fn surface_row3(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u + 3u];
}

fn phase_partitioned_metaball_strength(
  full_strength: f32,
  phase_weight: f32,
  isolation: f32,
  subtract: f32
) -> f32 {
  let fraction = clamp(phase_weight, 0.0, 1.0);
  let volume_scale_squared = pow(fraction * fraction, 0.3333333333333333);
  let zero_radius_strength = max(isolation + subtract, 0.0) * 0.000001;
  return full_strength * volume_scale_squared
    + zero_radius_strength * (1.0 - volume_scale_squared);
}

fn metaball_support_norm(strength: f32, subtract: f32) -> f32 {
  return sqrt(max(strength / max(subtract, 1.0e-12) - 0.000001, 0.0));
}

fn render_phase_weight(surface_phase_id: f32, row_phase_id: f32, gas_fraction: f32, solid_fraction: f32) -> f32 {
  let gas = clamp(gas_fraction, 0.0, 1.0);
  let solid = clamp(solid_fraction, 0.0, 1.0);
  let liquid = clamp(1.0 - gas - solid, 0.0, 1.0);
  if (surface_phase_id == 1.0) { return solid; }
  if (surface_phase_id == 2.0) { return liquid; }
  if (surface_phase_id == 3.0) { return gas; }
  return select(0.0, 1.0, row_phase_id == surface_phase_id);
}
`;

const SPATIAL_GRID_PARTICLE_ROW_HELPERS_WGSL = /* wgsl */ `
fn render_row0(particle_index: u32) -> vec4<f32> {
  return render_rows[particle_index * RENDER_FIELD_RENDER_ROW_VEC4_STRIDE];
}

fn render_row1(particle_index: u32) -> vec4<f32> {
  return render_rows[particle_index * RENDER_FIELD_RENDER_ROW_VEC4_STRIDE + 1u];
}

fn render_row2(particle_index: u32) -> vec4<f32> {
  return render_rows[particle_index * RENDER_FIELD_RENDER_ROW_VEC4_STRIDE + 2u];
}

fn render_row3(particle_index: u32) -> vec4<f32> {
  return render_rows[particle_index * RENDER_FIELD_RENDER_ROW_VEC4_STRIDE + 3u];
}

fn render_row4(particle_index: u32) -> vec4<f32> {
  return render_rows[particle_index * RENDER_FIELD_RENDER_ROW_VEC4_STRIDE + 4u];
}

fn render_bulk_phase_weight(
  particle_index: u32,
  material_id: f32,
  surface_phase_id: f32,
  carrier_mass_kg: f32,
  phase_weight: f32
) -> f32 {
  if (params.dispersed_medium_enabled == 0u || !(carrier_mass_kg > 0.0)
    || !sph_dispersed_medium_optics_finite(carrier_mass_kg)) {
    return phase_weight;
  }
  let dispersed = dispersed_medium_optics_rows[particle_index];
  if (
    render_row1(particle_index).y == 3.0
    && surface_phase_id == 2.0
    && params.particle_count >= 4u
    && (params.particle_count % 4u) == 0u
  ) {
    let phase_stride = params.particle_count / 4u;
    let companion_index = (particle_index % phase_stride) + phase_stride;
    if (companion_index < arrayLength(&dispersed_medium_optics_rows)) {
      let companion = dispersed_medium_optics_rows[companion_index];
      if (
        sph_dispersed_medium_optics_row_is_ready(companion)
        && companion.dispersed_material_id == material_id
        && companion.dispersed_phase_id == surface_phase_id
      ) {
        return 0.0;
      }
    }
  }
  if (!sph_dispersed_medium_optics_row_is_ready(dispersed)
    || dispersed.dispersed_material_id != material_id
    || dispersed.dispersed_phase_id != surface_phase_id) {
    return phase_weight;
  }
  let dispersed_fraction = min(dispersed.dispersed_mass_kg, carrier_mass_kg) / carrier_mass_kg;
  return max(0.0, phase_weight - dispersed_fraction);
}
`;

const SPATIAL_GRID_DISPERSED_MATH_WGSL = /* wgsl */ `
fn smooth_palette_weight(ratio: f32) -> f32 {
  let t = clamp(ratio, 0.0, 1.0);
  return 1.0 - t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

fn render_field_saturating_nonnegative_add(a: f32, b: f32) -> f32 {
  if (!(a > 0.0)) { return max(0.0, b); }
  if (!(b > 0.0)) { return max(0.0, a); }
  if (a >= RENDER_FIELD_F32_FINITE_MAX - b) {
    return RENDER_FIELD_F32_FINITE_MAX;
  }
  let sum = a + b;
  return select(0.0, sum, sum >= RENDER_FIELD_F32_MIN_NORMAL);
}

fn render_field_saturating_nonnegative_product(a: f32, b: f32) -> f32 {
  if (!(a > 0.0) || !(b > 0.0)) { return 0.0; }
  let product = a * b;
  if (!(product <= RENDER_FIELD_F32_FINITE_MAX)) {
    return RENDER_FIELD_F32_FINITE_MAX;
  }
  if (product < RENDER_FIELD_F32_MIN_NORMAL) { return 0.0; }
  return product;
}

struct RenderFieldPositiveF32Scale {
  mantissa: f32,
  exponent: i32,
  nonzero: u32,
  _pad: u32,
};

fn render_field_decompose_f32_magnitude(
  value: f32
) -> RenderFieldPositiveF32Scale {
  let bits = bitcast<u32>(value) & 0x7fffffffu;
  let raw_exponent = (bits >> 23u) & 0xffu;
  let fraction = bits & 0x007fffffu;
  if (bits == 0u || raw_exponent == 0xffu) {
    return RenderFieldPositiveF32Scale(0.0, 0, 0u, 0u);
  }
  if (raw_exponent == 0u) {
    let highest = 31u - countLeadingZeros(fraction);
    let shift = 23u - highest;
    let normalized = fraction << shift;
    return RenderFieldPositiveF32Scale(
      bitcast<f32>(0x3f800000u | (normalized & 0x007fffffu)),
      i32(highest) - 149,
      1u,
      0u
    );
  }
  return RenderFieldPositiveF32Scale(
    bitcast<f32>(0x3f800000u | fraction),
    i32(raw_exponent) - 127,
    1u,
    0u
  );
}

fn render_field_balanced_optical_product(
  cross_section_m2: f32,
  cell_weight: f32,
  inverse_cell_edge_per_m: f32
) -> f32 {
  let cross_section =
    render_field_decompose_f32_magnitude(cross_section_m2);
  let weight = render_field_decompose_f32_magnitude(cell_weight);
  let inverse_edge =
    render_field_decompose_f32_magnitude(inverse_cell_edge_per_m);
  if (
    cross_section.nonzero == 0u
    || weight.nonzero == 0u
    || inverse_edge.nonzero == 0u
  ) {
    return 0.0;
  }
  var mantissa = (
    (cross_section.mantissa * weight.mantissa)
    * inverse_edge.mantissa
  ) * inverse_edge.mantissa;
  var exponent = cross_section.exponent
    + weight.exponent
    + 2 * inverse_edge.exponent;
  for (
    var iteration = 0u;
    iteration < 4u && mantissa >= 2.0;
    iteration = iteration + 1u
  ) {
    mantissa = mantissa * 0.5;
    exponent = exponent + 1;
  }
  if (exponent < -126) { return 0.0; }
  if (exponent > 127) { return RENDER_FIELD_F32_FINITE_MAX; }
  return bitcast<f32>(
    (u32(exponent + 127) << 23u)
    | (bitcast<u32>(mantissa) & 0x007fffffu)
  );
}

fn render_field_balanced_signed_optical_product(
  signed_cross_section_m2: f32,
  cell_weight: f32,
  inverse_cell_edge_per_m: f32
) -> f32 {
  let magnitude = render_field_balanced_optical_product(
    signed_cross_section_m2,
    cell_weight,
    inverse_cell_edge_per_m
  );
  if (magnitude == 0.0) { return 0.0; }
  let sign_bit = bitcast<u32>(signed_cross_section_m2) & 0x80000000u;
  return bitcast<f32>(bitcast<u32>(magnitude) | sign_bit);
}

struct RenderFieldWeightedTemperatureAccumulator {
  weight: RenderFieldPositiveF32Scale,
  weighted_temperature: RenderFieldPositiveF32Scale,
};

struct RenderFieldSignedF32ScaleAccumulator {
  positive: RenderFieldPositiveF32Scale,
  negative: RenderFieldPositiveF32Scale,
};

fn render_field_normalized_mantissa_at_exponent(
  mantissa: f32,
  exponent: i32
) -> f32 {
  if (exponent < -126) { return 0.0; }
  return bitcast<f32>(
    (u32(exponent + 127) << 23u)
    | (bitcast<u32>(mantissa) & 0x007fffffu)
  );
}

fn render_field_add_positive_scales(
  left: RenderFieldPositiveF32Scale,
  right: RenderFieldPositiveF32Scale
) -> RenderFieldPositiveF32Scale {
  if (left.nonzero == 0u) { return right; }
  if (right.nonzero == 0u) { return left; }
  var base_exponent: i32;
  var mantissa: f32;
  if (right.exponent >= left.exponent) {
    let scaled_left = render_field_normalized_mantissa_at_exponent(
      left.mantissa,
      left.exponent - right.exponent
    );
    base_exponent = right.exponent;
    mantissa = right.mantissa + scaled_left;
  } else {
    let scaled_right = render_field_normalized_mantissa_at_exponent(
      right.mantissa,
      right.exponent - left.exponent
    );
    base_exponent = left.exponent;
    mantissa = left.mantissa + scaled_right;
  }
  if (mantissa >= 2.0) {
    mantissa = mantissa * 0.5;
    base_exponent = base_exponent + 1;
  }
  return RenderFieldPositiveF32Scale(mantissa, base_exponent, 1u, 0u);
}

fn render_field_compare_positive_scales(
  left: RenderFieldPositiveF32Scale,
  right: RenderFieldPositiveF32Scale
) -> i32 {
  if (left.nonzero == 0u) {
    return select(0, -1, right.nonzero != 0u);
  }
  if (right.nonzero == 0u) { return 1; }
  if (left.exponent != right.exponent) {
    return select(-1, 1, left.exponent > right.exponent);
  }
  if (left.mantissa == right.mantissa) { return 0; }
  return select(-1, 1, left.mantissa > right.mantissa);
}

fn render_field_subtract_positive_scales(
  larger: RenderFieldPositiveF32Scale,
  smaller: RenderFieldPositiveF32Scale
) -> RenderFieldPositiveF32Scale {
  if (larger.nonzero == 0u) {
    return RenderFieldPositiveF32Scale(0.0, 0, 0u, 0u);
  }
  if (smaller.nonzero == 0u) { return larger; }
  let scaled_smaller = render_field_normalized_mantissa_at_exponent(
    smaller.mantissa,
    smaller.exponent - larger.exponent
  );
  let residual = larger.mantissa - scaled_smaller;
  let normalized_residual = render_field_decompose_f32_magnitude(residual);
  if (normalized_residual.nonzero == 0u) {
    return RenderFieldPositiveF32Scale(0.0, 0, 0u, 0u);
  }
  return RenderFieldPositiveF32Scale(
    normalized_residual.mantissa,
    larger.exponent + normalized_residual.exponent,
    1u,
    0u
  );
}

fn render_field_positive_scale_value(scale: RenderFieldPositiveF32Scale) -> f32 {
  if (scale.nonzero == 0u || scale.exponent < -126) { return 0.0; }
  if (scale.exponent > 127) { return RENDER_FIELD_F32_FINITE_MAX; }
  return bitcast<f32>(
    (u32(scale.exponent + 127) << 23u)
    | (bitcast<u32>(scale.mantissa) & 0x007fffffu)
  );
}

fn render_field_accumulate_signed_scale(
  state: RenderFieldSignedF32ScaleAccumulator,
  sample: f32
) -> RenderFieldSignedF32ScaleAccumulator {
  if (sample == 0.0 || !(sample == sample) || abs(sample) > RENDER_FIELD_F32_FINITE_MAX) {
    return state;
  }
  let sample_scale = render_field_decompose_f32_magnitude(sample);
  if (sample_scale.nonzero == 0u) { return state; }
  if ((bitcast<u32>(sample) & 0x80000000u) != 0u) {
    return RenderFieldSignedF32ScaleAccumulator(
      state.positive,
      render_field_add_positive_scales(state.negative, sample_scale)
    );
  }
  return RenderFieldSignedF32ScaleAccumulator(
    render_field_add_positive_scales(state.positive, sample_scale),
    state.negative
  );
}

fn render_field_signed_scale_sum(state: RenderFieldSignedF32ScaleAccumulator) -> f32 {
  let comparison = render_field_compare_positive_scales(state.positive, state.negative);
  if (comparison == 0) { return 0.0; }
  let positive = comparison > 0;
  var larger = state.negative;
  var smaller = state.positive;
  if (positive) {
    larger = state.positive;
    smaller = state.negative;
  }
  let magnitude = render_field_positive_scale_value(
    render_field_subtract_positive_scales(larger, smaller)
  );
  return select(-magnitude, magnitude, positive);
}

fn render_field_multiply_positive_scales(
  left: RenderFieldPositiveF32Scale,
  right: RenderFieldPositiveF32Scale
) -> RenderFieldPositiveF32Scale {
  if (left.nonzero == 0u || right.nonzero == 0u) {
    return RenderFieldPositiveF32Scale(0.0, 0, 0u, 0u);
  }
  var mantissa = left.mantissa * right.mantissa;
  var exponent = left.exponent + right.exponent;
  if (mantissa >= 2.0) {
    mantissa = mantissa * 0.5;
    exponent = exponent + 1;
  }
  return RenderFieldPositiveF32Scale(mantissa, exponent, 1u, 0u);
}

fn render_field_divide_positive_scales(
  numerator: RenderFieldPositiveF32Scale,
  denominator: RenderFieldPositiveF32Scale
) -> f32 {
  if (numerator.nonzero == 0u || denominator.nonzero == 0u) {
    return 0.0;
  }
  var mantissa = numerator.mantissa / denominator.mantissa;
  var exponent = numerator.exponent - denominator.exponent;
  if (mantissa < 1.0) {
    mantissa = mantissa * 2.0;
    exponent = exponent - 1;
  } else if (mantissa >= 2.0) {
    mantissa = mantissa * 0.5;
    exponent = exponent + 1;
  }
  if (exponent < -126) { return 0.0; }
  if (exponent > 127) { return RENDER_FIELD_F32_FINITE_MAX; }
  return bitcast<f32>(
    (u32(exponent + 127) << 23u)
    | (bitcast<u32>(mantissa) & 0x007fffffu)
  );
}

fn render_field_accumulate_weighted_temperature(
  state: RenderFieldWeightedTemperatureAccumulator,
  sample: f32,
  sample_weight: f32
) -> RenderFieldWeightedTemperatureAccumulator {
  if (
    !(sample_weight > 0.0)
    || !(sample == sample)
    || abs(sample) > RENDER_FIELD_F32_FINITE_MAX
  ) {
    return state;
  }
  let sample_scale = render_field_decompose_f32_magnitude(sample_weight);
  if (sample_scale.nonzero == 0u) { return state; }
  let next_weight = render_field_add_positive_scales(state.weight, sample_scale);
  let finite_sample = clamp(sample, 0.0, RENDER_FIELD_F32_FINITE_MAX);
  let temperature_scale = render_field_decompose_f32_magnitude(finite_sample);
  if (temperature_scale.nonzero == 0u) {
    return RenderFieldWeightedTemperatureAccumulator(next_weight, state.weighted_temperature);
  }
  return RenderFieldWeightedTemperatureAccumulator(
    next_weight,
    render_field_add_positive_scales(
      state.weighted_temperature,
      render_field_multiply_positive_scales(sample_scale, temperature_scale)
    )
  );
}

fn render_field_cic_axis_weight(
  cell_index: u32,
  particle_coordinate: f32,
  resolution: u32
) -> f32 {
  let particle_cell = clamp(particle_coordinate, 0.0, 1.0) * f32(resolution);
  var weight = max(0.0, 1.0 - abs(f32(cell_index) - particle_cell));
  if (cell_index == 0u) {
    weight = weight + max(0.0, 1.0 - abs(-1.0 - particle_cell));
  }
  if (cell_index + 1u == resolution) {
    weight = weight + max(0.0, 1.0 - abs(f32(resolution) - particle_cell));
  }
  return min(1.0, weight);
}
`;

export const sphRenderFieldSpatialParticleBinWgsl = /* wgsl */ `
${sphDispersedMediumOpticsWgsl}
${SPATIAL_GRID_COMMON_STRUCTS_WGSL}

@group(0) @binding(0) var<storage, read> render_rows: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> render_surfaces: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> dispersed_medium_optics_rows: array<SphDispersedMediumOptics>;
@group(0) @binding(3) var<storage, read> product_history_control: array<u32>;
@group(0) @binding(4) var<storage, read_write> spatial_grid_u32: array<atomic<u32>>;
@group(0) @binding(5) var<uniform> params: RenderFieldParams;
@group(0) @binding(6) var<uniform> product_history_gate: RenderProductHistoryGateParams;
@group(0) @binding(7) var<uniform> grid: SpatialGridParams;

${SPATIAL_GRID_HISTORY_AND_SURFACE_HELPERS_WGSL}
${SPATIAL_GRID_PARTICLE_ROW_HELPERS_WGSL}

struct ParticleBrickBounds {
  is_active: u32,
  is_sphere: u32,
  min_b: vec3<u32>,
  max_b: vec3<u32>,
  center: vec3<f32>,
  radius_pad_sq: f32,
};

fn compute_particle_brick_bounds(
  particle_index: u32,
  surface_index: u32,
  resolution: u32
) -> ParticleBrickBounds {
  var empty = ParticleBrickBounds(0u, 0u, vec3<u32>(0u), vec3<u32>(0u), vec3<f32>(0.0), 0.0);
  let s0 = surface_row0(surface_index);
  let s1 = surface_row1(surface_index);
  let s2 = surface_row2(surface_index);
  let s3 = surface_row3(surface_index);
  let dispersed_surface_active = s3.y > 0.0;
  let span = 1.0 - 2.0 * params.field_padding;
  let ref_edge = max(params.ref_edge_m, 1.0e-12);
  let res_f = f32(resolution);
  let max_cell_f = f32(resolution - 1u);

  if (dispersed_surface_active) {
    if (params.dispersed_medium_enabled == 0u) {
      return empty;
    }
    let dispersed = dispersed_medium_optics_rows[particle_index];
    if (
      sph_dispersed_medium_optics_row_is_ready(dispersed)
      && dispersed.optical_state_id > 0.0
      && dispersed.optical_state_id == s3.y
    ) {
      let row0 = render_row0(particle_index);
      let p = vec3<f32>(
        clamp(params.field_padding + (row0.x / ref_edge) * span, 0.001, 0.999),
        clamp(params.field_padding + (row0.y / ref_edge) * span, 0.001, 0.999),
        clamp(params.field_padding + (row0.z / ref_edge) * span, 0.001, 0.999)
      );
      let pc = p * res_f;
      let min_c = vec3<u32>(clamp(floor(pc - vec3<f32>(1.01)), vec3<f32>(0.0), vec3<f32>(max_cell_f)));
      let max_c = vec3<u32>(clamp(ceil(pc + vec3<f32>(1.01)), vec3<f32>(0.0), vec3<f32>(max_cell_f)));
      return ParticleBrickBounds(1u, 0u, min_c >> vec3<u32>(2u), max_c >> vec3<u32>(2u), p, 0.0);
    }
    let row0 = render_row0(particle_index);
    let row1 = render_row1(particle_index);
    if (
      row0.w > 0.0
      && row1.y == 3.0
      && params.particle_count >= 4u
      && (params.particle_count % 4u) == 0u
    ) {
      let phase_stride = params.particle_count / 4u;
      let companion_index = (particle_index % phase_stride) + phase_stride;
      if (companion_index < arrayLength(&dispersed_medium_optics_rows)) {
        let companion = dispersed_medium_optics_rows[companion_index];
        let row2 = render_row2(particle_index);
        let row4_wet = render_row4(particle_index);
        let suspended = clamp(1.0 - row2.y - row4_wet.x, 0.0, 1.0);
        if (
          suspended > 0.0
          && sph_dispersed_medium_optics_row_is_ready(companion)
          && companion.optical_state_id > 0.0
          && companion.optical_state_id == s3.y
        ) {
          let row3 = render_row3(particle_index);
          let p = vec3<f32>(
            clamp(params.field_padding + (row0.x / ref_edge) * span, 0.001, 0.999),
            clamp(params.field_padding + (row0.y / ref_edge) * span, 0.001, 0.999),
            clamp(params.field_padding + (row0.z / ref_edge) * span, 0.001, 0.999)
          );
          let support_cells = clamp(max((row3.y * span / ref_edge) * res_f, 3.6), 1.0, 6.0);
          let pc = p * res_f;
          let pad = vec3<f32>(support_cells + 0.01);
          let min_c = vec3<u32>(clamp(floor(pc - pad), vec3<f32>(0.0), vec3<f32>(max_cell_f)));
          let max_c = vec3<u32>(clamp(ceil(pc + pad), vec3<f32>(0.0), vec3<f32>(max_cell_f)));
          return ParticleBrickBounds(1u, 0u, min_c >> vec3<u32>(2u), max_c >> vec3<u32>(2u), p, 0.0);
        }
      }
    }
    return empty;
  }

  let material_id = s0.x;
  let row1 = render_row1(particle_index);
  if (row1.x != material_id) {
    return empty;
  }
  let render_domain_id = max(s3.x, 0.0);
  let row2 = render_row2(particle_index);
  if (render_domain_id > 0.0 && row2.w != render_domain_id) {
    return empty;
  }
  let row0 = render_row0(particle_index);
  let row4 = render_row4(particle_index);
  let phase_id = s0.y;
  let phase_weight = render_bulk_phase_weight(
    particle_index, material_id, phase_id, row0.w,
    render_phase_weight(phase_id, row1.y, row2.y, row4.x)
  );
  if (phase_weight <= 0.0) {
    return empty;
  }
  let row3 = render_row3(particle_index);
  let subtract = max(s1.z, 1.0e-12);
  let strength = s1.w;
  let particle_radius_scale = select(0.0, -s2.x, s2.x < 0.0);
  let inv_resolution = 1.0 / res_f;
  let particle_radius_norm_scale = particle_radius_scale * span / ref_edge;
  let particle_radius_floor_norm = select(
    0.0,
    sqrt(0.75 * inv_resolution * inv_resolution + 0.000001),
    particle_radius_scale > 0.0
  );
  let particle_radius_norm = select(
    0.0,
    max(row3.y * particle_radius_norm_scale, particle_radius_floor_norm),
    particle_radius_scale > 0.0 && row3.y > 0.0
  );
  let full_particle_strength = select(
    strength,
    (s1.y + subtract) * particle_radius_norm * particle_radius_norm,
    particle_radius_norm > 0.0
  );
  let particle_strength = phase_partitioned_metaball_strength(
    full_particle_strength,
    phase_weight,
    s1.y,
    subtract
  );
  let r2 = particle_strength / subtract - 0.000001;
  if (!(r2 > 0.0)) {
    return empty;
  }
  let r_pad = sqrt(r2) * 1.0001 + 1.0e-5;
  let p = vec3<f32>(
    clamp(params.field_padding + (row0.x / ref_edge) * span, 0.001, 0.999),
    clamp(params.field_padding + (row0.y / ref_edge) * span, 0.001, 0.999),
    clamp(params.field_padding + (row0.z / ref_edge) * span, 0.001, 0.999)
  );
  let min_c = vec3<u32>(clamp(floor((p - vec3<f32>(r_pad)) * res_f), vec3<f32>(0.0), vec3<f32>(max_cell_f)));
  let max_c = vec3<u32>(clamp(ceil((p + vec3<f32>(r_pad)) * res_f), vec3<f32>(0.0), vec3<f32>(max_cell_f)));
  return ParticleBrickBounds(1u, 1u, min_c >> vec3<u32>(2u), max_c >> vec3<u32>(2u), p, r_pad * r_pad);
}

fn sphere_intersects_brick(
  center: vec3<f32>,
  radius_pad_sq: f32,
  bx: u32,
  by: u32,
  bz: u32,
  resolution: u32,
  inv_resolution: f32
) -> bool {
  let bmin = vec3<f32>(f32(bx * 4u), f32(by * 4u), f32(bz * 4u)) * inv_resolution;
  let max_v = resolution - 1u;
  let bmax = vec3<f32>(
    f32(min(bx * 4u + 3u, max_v)),
    f32(min(by * 4u + 3u, max_v)),
    f32(min(bz * 4u + 3u, max_v))
  ) * inv_resolution;
  let closest = clamp(center, bmin, bmax);
  let delta = center - closest;
  return dot(delta, delta) <= radius_pad_sq;
}

@compute @workgroup_size(64, 1, 1)
fn count_particle_bricks(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  let surface_index = global_id.y;
  if (particle_index >= params.particle_count || surface_index >= params.surface_count) {
    return;
  }
  if (!render_product_history_ready()) {
    return;
  }
  let s1 = surface_row1(surface_index);
  let resolution = max(u32(s1.x), 1u);
  let bounds = compute_particle_brick_bounds(particle_index, surface_index, resolution);
  if (bounds.is_active == 0u) {
    return;
  }
  let span_b = bounds.max_b - bounds.min_b + vec3<u32>(1u);
  let box_bricks = span_b.x * span_b.y * span_b.z;
  if (box_bricks > grid.max_bricks_per_source) {
    atomicStore(&spatial_grid_u32[grid.surface_fallback_offset + surface_index], 1u);
    return;
  }
  let binfo = grid.surface_brick_info[surface_index];
  let brick_dim = binfo.x;
  let brick_offset = binfo.z;
  let inv_resolution = 1.0 / f32(resolution);
  for (var bz = bounds.min_b.z; bz <= bounds.max_b.z; bz = bz + 1u) {
    for (var by = bounds.min_b.y; by <= bounds.max_b.y; by = by + 1u) {
      for (var bx = bounds.min_b.x; bx <= bounds.max_b.x; bx = bx + 1u) {
        if (
          bounds.is_sphere == 0u
          || sphere_intersects_brick(bounds.center, bounds.radius_pad_sq, bx, by, bz, resolution, inv_resolution)
        ) {
          let brick_global = brick_offset + (bz * brick_dim + by) * brick_dim + bx;
          atomicAdd(&spatial_grid_u32[grid.p_counts_offset + brick_global], 1u);
        }
      }
    }
  }
}

@compute @workgroup_size(64, 1, 1)
fn scatter_particle_bricks(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  let surface_index = global_id.y;
  if (particle_index >= params.particle_count || surface_index >= params.surface_count) {
    return;
  }
  if (!render_product_history_ready()) {
    return;
  }
  if (
    atomicLoad(&spatial_grid_u32[1u]) != 0u
    || atomicLoad(&spatial_grid_u32[grid.surface_fallback_offset + surface_index]) != 0u
  ) {
    return;
  }
  let s1 = surface_row1(surface_index);
  let resolution = max(u32(s1.x), 1u);
  let bounds = compute_particle_brick_bounds(particle_index, surface_index, resolution);
  if (bounds.is_active == 0u) {
    return;
  }
  let span_b = bounds.max_b - bounds.min_b + vec3<u32>(1u);
  if (span_b.x * span_b.y * span_b.z > grid.max_bricks_per_source) {
    return;
  }
  let binfo = grid.surface_brick_info[surface_index];
  let brick_dim = binfo.x;
  let brick_offset = binfo.z;
  let inv_resolution = 1.0 / f32(resolution);
  for (var bz = bounds.min_b.z; bz <= bounds.max_b.z; bz = bz + 1u) {
    for (var by = bounds.min_b.y; by <= bounds.max_b.y; by = by + 1u) {
      for (var bx = bounds.min_b.x; bx <= bounds.max_b.x; bx = bx + 1u) {
        if (
          bounds.is_sphere == 0u
          || sphere_intersects_brick(bounds.center, bounds.radius_pad_sq, bx, by, bz, resolution, inv_resolution)
        ) {
          let brick_global = brick_offset + (bz * brick_dim + by) * brick_dim + bx;
          let slot = atomicAdd(&spatial_grid_u32[grid.p_cursors_offset + brick_global], 1u);
          if (slot < grid.particle_entry_capacity) {
            atomicStore(&spatial_grid_u32[grid.p_entries_offset + slot], particle_index);
          }
        }
      }
    }
  }
}
`;

export const sphRenderFieldSpatialEventBinWgsl = /* wgsl */ `
${SPATIAL_GRID_COMMON_STRUCTS_WGSL}

@group(0) @binding(0) var<storage, read> product_events: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> render_surfaces: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> product_history_control: array<u32>;
@group(0) @binding(3) var<storage, read_write> spatial_grid_u32: array<atomic<u32>>;
@group(0) @binding(4) var<uniform> params: RenderFieldParams;
@group(0) @binding(5) var<uniform> product_history_gate: RenderProductHistoryGateParams;
@group(0) @binding(6) var<uniform> grid: SpatialGridParams;

${SPATIAL_GRID_HISTORY_AND_SURFACE_HELPERS_WGSL}

struct EventBrickBounds {
  is_active: u32,
  min_b: vec3<u32>,
  max_b: vec3<u32>,
  center: vec3<f32>,
  radius_pad_sq: f32,
};

fn compute_event_brick_bounds(
  event_index: u32,
  surface_index: u32,
  resolution: u32
) -> EventBrickBounds {
  var empty = EventBrickBounds(0u, vec3<u32>(0u), vec3<u32>(0u), vec3<f32>(0.0), 0.0);
  let s3 = surface_row3(surface_index);
  if (s3.y > 0.0) {
    return empty;
  }
  let event4 = product_events[event_index * 8u + 4u];
  if (event4.z != 1.0) {
    return empty;
  }
  let event3 = product_events[event_index * 8u + 3u];
  if (event3.y <= 0.0) {
    return empty;
  }
  let s0 = surface_row0(surface_index);
  let event1 = product_events[event_index * 8u + 1u];
  if (event1.x != s0.x) {
    return empty;
  }
  let event2 = product_events[event_index * 8u + 2u];
  if (event2.w > 0.0 && event2.w != s0.y) {
    return empty;
  }
  let s1 = surface_row1(surface_index);
  let subtract = max(s1.z, 1.0e-12);
  let strength = s1.w;
  let r2 = strength / subtract - 0.000001;
  if (!(r2 > 0.0)) {
    return empty;
  }
  let r_pad = sqrt(r2) * 1.0001 + 1.0e-5;
  let span = 1.0 - 2.0 * params.field_padding;
  let ref_edge = max(params.ref_edge_m, 1.0e-12);
  let event0 = product_events[event_index * 8u];
  let p = vec3<f32>(
    clamp(params.field_padding + (event0.x / ref_edge) * span, 0.001, 0.999),
    clamp(params.field_padding + (event0.y / ref_edge) * span, 0.001, 0.999),
    clamp(params.field_padding + (event0.z / ref_edge) * span, 0.001, 0.999)
  );
  let res_f = f32(resolution);
  let max_cell_f = f32(resolution - 1u);
  let min_c = vec3<u32>(clamp(floor((p - vec3<f32>(r_pad)) * res_f), vec3<f32>(0.0), vec3<f32>(max_cell_f)));
  let max_c = vec3<u32>(clamp(ceil((p + vec3<f32>(r_pad)) * res_f), vec3<f32>(0.0), vec3<f32>(max_cell_f)));
  return EventBrickBounds(1u, min_c >> vec3<u32>(2u), max_c >> vec3<u32>(2u), p, r_pad * r_pad);
}

fn event_sphere_intersects_brick(
  center: vec3<f32>,
  radius_pad_sq: f32,
  bx: u32,
  by: u32,
  bz: u32,
  resolution: u32,
  inv_resolution: f32
) -> bool {
  let bmin = vec3<f32>(f32(bx * 4u), f32(by * 4u), f32(bz * 4u)) * inv_resolution;
  let max_v = resolution - 1u;
  let bmax = vec3<f32>(
    f32(min(bx * 4u + 3u, max_v)),
    f32(min(by * 4u + 3u, max_v)),
    f32(min(bz * 4u + 3u, max_v))
  ) * inv_resolution;
  let closest = clamp(center, bmin, bmax);
  let delta = center - closest;
  return dot(delta, delta) <= radius_pad_sq;
}

@compute @workgroup_size(64, 1, 1)
fn count_event_bricks(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let event_index = global_id.x;
  let surface_index = global_id.y;
  if (surface_index >= params.surface_count || !render_product_history_ready()) {
    return;
  }
  if (event_index >= render_product_event_count()) {
    return;
  }
  let resolution = max(u32(surface_row1(surface_index).x), 1u);
  let bounds = compute_event_brick_bounds(event_index, surface_index, resolution);
  if (bounds.is_active == 0u) {
    return;
  }
  let span_b = bounds.max_b - bounds.min_b + vec3<u32>(1u);
  if (span_b.x * span_b.y * span_b.z > grid.max_bricks_per_source) {
    atomicStore(&spatial_grid_u32[grid.surface_event_fallback_offset + surface_index], 1u);
    return;
  }
  let binfo = grid.surface_brick_info[surface_index];
  let brick_dim = binfo.x;
  let brick_offset = binfo.z;
  let inv_resolution = 1.0 / f32(resolution);
  for (var bz = bounds.min_b.z; bz <= bounds.max_b.z; bz = bz + 1u) {
    for (var by = bounds.min_b.y; by <= bounds.max_b.y; by = by + 1u) {
      for (var bx = bounds.min_b.x; bx <= bounds.max_b.x; bx = bx + 1u) {
        if (event_sphere_intersects_brick(bounds.center, bounds.radius_pad_sq, bx, by, bz, resolution, inv_resolution)) {
          let brick_global = brick_offset + (bz * brick_dim + by) * brick_dim + bx;
          atomicAdd(&spatial_grid_u32[grid.e_counts_offset + brick_global], 1u);
        }
      }
    }
  }
}

@compute @workgroup_size(64, 1, 1)
fn scatter_event_bricks(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let event_index = global_id.x;
  let surface_index = global_id.y;
  if (surface_index >= params.surface_count || !render_product_history_ready()) {
    return;
  }
  if (event_index >= render_product_event_count()) {
    return;
  }
  if (
    atomicLoad(&spatial_grid_u32[3u]) != 0u
    || atomicLoad(&spatial_grid_u32[grid.surface_event_fallback_offset + surface_index]) != 0u
  ) {
    return;
  }
  let resolution = max(u32(surface_row1(surface_index).x), 1u);
  let bounds = compute_event_brick_bounds(event_index, surface_index, resolution);
  if (bounds.is_active == 0u) {
    return;
  }
  let span_b = bounds.max_b - bounds.min_b + vec3<u32>(1u);
  if (span_b.x * span_b.y * span_b.z > grid.max_bricks_per_source) {
    return;
  }
  let binfo = grid.surface_brick_info[surface_index];
  let brick_dim = binfo.x;
  let brick_offset = binfo.z;
  let inv_resolution = 1.0 / f32(resolution);
  for (var bz = bounds.min_b.z; bz <= bounds.max_b.z; bz = bz + 1u) {
    for (var by = bounds.min_b.y; by <= bounds.max_b.y; by = by + 1u) {
      for (var bx = bounds.min_b.x; bx <= bounds.max_b.x; bx = bx + 1u) {
        if (event_sphere_intersects_brick(bounds.center, bounds.radius_pad_sq, bx, by, bz, resolution, inv_resolution)) {
          let brick_global = brick_offset + (bz * brick_dim + by) * brick_dim + bx;
          let slot = atomicAdd(&spatial_grid_u32[grid.e_cursors_offset + brick_global], 1u);
          if (slot < grid.event_entry_capacity) {
            atomicStore(&spatial_grid_u32[grid.e_entries_offset + slot], event_index);
          }
        }
      }
    }
  }
}
`;

export const sphRenderFieldSpatialScanWgsl = /* wgsl */ `
${SPATIAL_GRID_COMMON_STRUCTS_WGSL}

@group(0) @binding(0) var<storage, read_write> spatial_grid_u32: array<u32>;
@group(0) @binding(1) var<uniform> grid: SpatialGridParams;

var<workgroup> wg_scan: array<u32, 512>;

@compute @workgroup_size(256, 1, 1)
fn scan_brick_blocks(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let tid = local_id.x;
  let block_id = workgroup_id.x;
  let channel = workgroup_id.y;
  let counts_base = select(grid.p_counts_offset, grid.e_counts_offset, channel != 0u);
  let offsets_base = select(grid.p_offsets_offset, grid.e_offsets_offset, channel != 0u);
  let cursors_base = select(grid.p_cursors_offset, grid.e_cursors_offset, channel != 0u);
  let totals_base = select(grid.p_block_totals_offset, grid.e_block_totals_offset, channel != 0u);
  let meta_base = select(0u, 2u, channel != 0u);
  let entry_cap = select(grid.particle_entry_capacity, grid.event_entry_capacity, channel != 0u);

  let block_base = block_id * 512u;
  let i0 = block_base + tid;
  let i1 = block_base + tid + 256u;
  wg_scan[tid] = select(0u, spatial_grid_u32[counts_base + i0], i0 < grid.total_bricks);
  wg_scan[tid + 256u] = select(0u, spatial_grid_u32[counts_base + i1], i1 < grid.total_bricks);

  var offset = 1u;
  for (var d = 256u; d > 0u; d = d >> 1u) {
    workgroupBarrier();
    if (tid < d) {
      let ai = offset * (2u * tid + 1u) - 1u;
      let bi = offset * (2u * tid + 2u) - 1u;
      wg_scan[bi] = wg_scan[bi] + wg_scan[ai];
    }
    offset = offset << 1u;
  }
  workgroupBarrier();
  if (tid == 0u) {
    let block_total = wg_scan[511u];
    spatial_grid_u32[totals_base + block_id] = block_total;
    if (grid.scan_block_count == 1u) {
      spatial_grid_u32[meta_base] = block_total;
      if (block_total > entry_cap) {
        spatial_grid_u32[meta_base + 1u] = 1u;
      }
    }
    wg_scan[511u] = 0u;
  }
  for (var d = 1u; d < 512u; d = d << 1u) {
    offset = offset >> 1u;
    workgroupBarrier();
    if (tid < d) {
      let ai = offset * (2u * tid + 1u) - 1u;
      let bi = offset * (2u * tid + 2u) - 1u;
      let t = wg_scan[ai];
      wg_scan[ai] = wg_scan[bi];
      wg_scan[bi] = wg_scan[bi] + t;
    }
  }
  workgroupBarrier();
  if (i0 < grid.total_bricks) {
    let v0 = wg_scan[tid];
    spatial_grid_u32[offsets_base + i0] = v0;
    if (grid.scan_block_count == 1u) {
      spatial_grid_u32[cursors_base + i0] = v0;
    }
  }
  if (i1 < grid.total_bricks) {
    let v1 = wg_scan[tid + 256u];
    spatial_grid_u32[offsets_base + i1] = v1;
    if (grid.scan_block_count == 1u) {
      spatial_grid_u32[cursors_base + i1] = v1;
    }
  }
}

@compute @workgroup_size(256, 1, 1)
fn scan_brick_block_totals(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let tid = local_id.x;
  let channel = workgroup_id.y;
  let totals_base = select(grid.p_block_totals_offset, grid.e_block_totals_offset, channel != 0u);
  let meta_base = select(0u, 2u, channel != 0u);
  let entry_cap = select(grid.particle_entry_capacity, grid.event_entry_capacity, channel != 0u);
  let n = grid.scan_block_count;

  wg_scan[tid] = select(0u, spatial_grid_u32[totals_base + tid], tid < n);
  wg_scan[tid + 256u] = select(0u, spatial_grid_u32[totals_base + tid + 256u], tid + 256u < n);

  var offset = 1u;
  for (var d = 256u; d > 0u; d = d >> 1u) {
    workgroupBarrier();
    if (tid < d) {
      let ai = offset * (2u * tid + 1u) - 1u;
      let bi = offset * (2u * tid + 2u) - 1u;
      wg_scan[bi] = wg_scan[bi] + wg_scan[ai];
    }
    offset = offset << 1u;
  }
  workgroupBarrier();
  if (tid == 0u) {
    let grand_total = wg_scan[511u];
    spatial_grid_u32[meta_base] = grand_total;
    if (grand_total > entry_cap) {
      spatial_grid_u32[meta_base + 1u] = 1u;
    }
    wg_scan[511u] = 0u;
  }
  for (var d = 1u; d < 512u; d = d << 1u) {
    offset = offset >> 1u;
    workgroupBarrier();
    if (tid < d) {
      let ai = offset * (2u * tid + 1u) - 1u;
      let bi = offset * (2u * tid + 2u) - 1u;
      let t = wg_scan[ai];
      wg_scan[ai] = wg_scan[bi];
      wg_scan[bi] = wg_scan[bi] + t;
    }
  }
  workgroupBarrier();
  if (tid < n) {
    spatial_grid_u32[totals_base + tid] = wg_scan[tid];
  }
  if (tid + 256u < n) {
    spatial_grid_u32[totals_base + tid + 256u] = wg_scan[tid + 256u];
  }
}

@compute @workgroup_size(256, 1, 1)
fn add_brick_block_offsets(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let tid = local_id.x;
  let block_id = workgroup_id.x;
  let channel = workgroup_id.y;
  let offsets_base = select(grid.p_offsets_offset, grid.e_offsets_offset, channel != 0u);
  let cursors_base = select(grid.p_cursors_offset, grid.e_cursors_offset, channel != 0u);
  let totals_base = select(grid.p_block_totals_offset, grid.e_block_totals_offset, channel != 0u);
  let block_offset = spatial_grid_u32[totals_base + block_id];
  let block_base = block_id * 512u;
  let i0 = block_base + tid;
  let i1 = block_base + tid + 256u;
  if (i0 < grid.total_bricks) {
    let v0 = spatial_grid_u32[offsets_base + i0] + block_offset;
    spatial_grid_u32[offsets_base + i0] = v0;
    spatial_grid_u32[cursors_base + i0] = v0;
  }
  if (i1 < grid.total_bricks) {
    let v1 = spatial_grid_u32[offsets_base + i1] + block_offset;
    spatial_grid_u32[offsets_base + i1] = v1;
    spatial_grid_u32[cursors_base + i1] = v1;
  }
}
`;

export function createSphRenderFieldSpatialGatherWgsl({ motionField = false } = {}) {
  return /* wgsl */ `
${sphDispersedMediumOpticsWgsl}
${SPATIAL_GRID_COMMON_STRUCTS_WGSL}

@group(0) @binding(0) var<storage, read> render_rows: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> render_surfaces: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> render_field_cells: array<vec4<f32>>;
@group(0) @binding(3) var<uniform> params: RenderFieldParams;
@group(0) @binding(4) var<storage, read> product_events: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read> product_history_control: array<u32>;
@group(0) @binding(6) var<uniform> product_history_gate: RenderProductHistoryGateParams;
@group(0) @binding(7) var<storage, read> dispersed_medium_optics_rows: array<SphDispersedMediumOptics>;
@group(0) @binding(8) var<storage, read> spatial_grid_u32: array<u32>;
@group(0) @binding(9) var<uniform> grid: SpatialGridParams;
${motionField ? '@group(0) @binding(10) var<storage, read_write> render_motion_field: array<vec4<f32>>;' : ''}

${SPATIAL_GRID_HISTORY_AND_SURFACE_HELPERS_WGSL}
${SPATIAL_GRID_PARTICLE_ROW_HELPERS_WGSL}
${SPATIAL_GRID_DISPERSED_MATH_WGSL}

struct BrickCtrl {
  ready: u32,
  dispersed: u32,
  p_fb: u32,
  e_fb: u32,
  p_start: u32,
  p_count: u32,
  e_start: u32,
  e_count: u32,
};

var<workgroup> wg_ctrl: BrickCtrl;
var<workgroup> wg_p_pos_str: array<vec4<f32>, 64>;
var<workgroup> wg_p_sup_temp_vel: array<vec4<f32>, 64>;
var<workgroup> wg_p_vel_z: array<f32, 64>;
var<workgroup> wg_smear_votes: array<u32, 64>;
var<workgroup> wg_any_smear: u32;

@compute @workgroup_size(64, 1, 1)
fn gather_bricks(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let tid = local_id.x;
  let brick_local = workgroup_id.x;
  let surface_index = workgroup_id.y;
  if (surface_index >= params.surface_count) {
    return;
  }
  let binfo = grid.surface_brick_info[surface_index];
  let brick_dim = binfo.x;
  let brick_count = binfo.y;
  let brick_offset = binfo.z;
  if (brick_local >= brick_count) {
    return;
  }
  let brick_global = brick_offset + brick_local;

  if (tid == 0u) {
    let ready = render_product_history_ready();
    let dispersed = surface_row3(surface_index).y > 0.0;
    let p_fb = (spatial_grid_u32[1u] != 0u)
      || (spatial_grid_u32[grid.surface_fallback_offset + surface_index] != 0u);
    let e_fb = (grid.has_product_events != 0u)
      && (
        (spatial_grid_u32[3u] != 0u)
        || (spatial_grid_u32[grid.surface_event_fallback_offset + surface_index] != 0u)
      );
    wg_ctrl = BrickCtrl(
      select(0u, 1u, ready),
      select(0u, 1u, dispersed),
      select(0u, 1u, p_fb),
      select(0u, 1u, e_fb),
      spatial_grid_u32[grid.p_offsets_offset + brick_global],
      spatial_grid_u32[grid.p_counts_offset + brick_global],
      select(0u, spatial_grid_u32[grid.e_offsets_offset + brick_global], grid.has_product_events != 0u),
      select(0u, spatial_grid_u32[grid.e_counts_offset + brick_global], grid.has_product_events != 0u)
    );
  }
  let ctrl = workgroupUniformLoad(&wg_ctrl);

  let s0 = surface_row0(surface_index);
  let s1 = surface_row1(surface_index);
  let s2 = surface_row2(surface_index);
  let s3 = surface_row3(surface_index);
  let field_offset = u32(s0.z);
  let field_cell_count = u32(s0.w);
  let resolution = max(u32(s1.x), 1u);

  let brick_plane = brick_dim * brick_dim;
  let bz = brick_local / brick_plane;
  let brem = brick_local - bz * brick_plane;
  let by = brem / brick_dim;
  let bx = brem - by * brick_dim;

  let lx = tid & 3u;
  let ly = (tid >> 2u) & 3u;
  let lz = tid >> 4u;
  let x = bx * 4u + lx;
  let y = by * 4u + ly;
  let z = bz * 4u + lz;
  let cell_index = z * resolution * resolution + y * resolution + x;
  let out_index = field_offset + cell_index;
  let in_bounds = x < resolution && y < resolution && z < resolution
    && cell_index < field_cell_count && out_index < params.total_field_cells;

  if (ctrl.ready == 0u) {
    if (in_bounds) {
      render_field_cells[out_index * 2u] = vec4<f32>(0.0);
      render_field_cells[out_index * 2u + 1u] = vec4<f32>(0.0);
${motionField ? '      render_motion_field[out_index] = vec4<f32>(0.0);' : ''}
    }
    return;
  }

  let empty_brick = (ctrl.p_fb == 0u && ctrl.p_count == 0u)
    && (ctrl.dispersed != 0u || (ctrl.e_fb == 0u && ctrl.e_count == 0u));
  if (empty_brick) {
    if (in_bounds) {
      render_field_cells[out_index * 2u] = vec4<f32>(0.0);
      render_field_cells[out_index * 2u + 1u] = vec4<f32>(0.0);
${motionField ? '      render_motion_field[out_index] = vec4<f32>(0.0);' : ''}
    }
    return;
  }

  let inv_resolution = 1.0 / f32(resolution);
  let cell = vec3<f32>(f32(x) * inv_resolution, f32(y) * inv_resolution, f32(z) * inv_resolution);
  let material_id = s0.x;
  let phase_id = s0.y;
  let render_domain_id = max(s3.x, 0.0);
  let subtract = max(s1.z, 1.0e-12);
  let strength = s1.w;
  let support_norm = sqrt(abs(strength) / subtract);
  let particle_radius_scale = select(0.0, -s2.x, s2.x < 0.0);
  let color = vec3<f32>(s2.y, s2.z, s2.w);
  let span = 1.0 - 2.0 * params.field_padding;
  let ref_edge = max(params.ref_edge_m, 1.0e-12);
  let particle_radius_norm_scale = particle_radius_scale * span / ref_edge;
  let particle_radius_floor_norm = select(
    0.0,
    sqrt(0.75 * inv_resolution * inv_resolution + 0.000001),
    particle_radius_scale > 0.0
  );

  var density = 0.0;
  var palette = vec3<f32>(0.0, 0.0, 0.0);
  var temperature_weighted = 0.0;
  var temperature_weight = 0.0;
  var velocity_weighted = vec3<f32>(0.0, 0.0, 0.0);
  var velocity_sq_weighted = 0.0;
  var dispersed_scattering_optical_depth = 0.0;
  var dispersed_absorption_optical_depth = 0.0;
  var dispersed_scattering_asymmetry = RenderFieldSignedF32ScaleAccumulator(
    RenderFieldPositiveF32Scale(0.0, 0, 0u, 0u),
    RenderFieldPositiveF32Scale(0.0, 0, 0u, 0u)
  );
  var dispersed_temperature = RenderFieldWeightedTemperatureAccumulator(
    RenderFieldPositiveF32Scale(0.0, 0, 0u, 0u),
    RenderFieldPositiveF32Scale(0.0, 0, 0u, 0u)
  );

  if (ctrl.dispersed != 0u) {
    if (in_bounds && params.dispersed_medium_enabled != 0u) {
      let loop_count = select(ctrl.p_count, params.particle_count, ctrl.p_fb != 0u);
      let inverse_cell_edge_per_m = min(
        RENDER_FIELD_F32_FINITE_MAX,
        (span * f32(resolution)) / ref_edge
      );
      for (var iter = 0u; iter < loop_count; iter = iter + 1u) {
        let particle_index = select(
          spatial_grid_u32[grid.p_entries_offset + ctrl.p_start + iter],
          iter,
          ctrl.p_fb != 0u
        );
        let row0 = render_row0(particle_index);
        let row1 = render_row1(particle_index);
        let row2 = render_row2(particle_index);
        let row3 = render_row3(particle_index);
        let dispersed = dispersed_medium_optics_rows[particle_index];
        if (
          sph_dispersed_medium_optics_row_is_ready(dispersed)
          && dispersed.optical_state_id > 0.0
          && dispersed.optical_state_id == s3.y
        ) {
          let dispersed_particle = vec3<f32>(
            clamp(params.field_padding + (row0.x / ref_edge) * span, 0.001, 0.999),
            clamp(params.field_padding + (row0.y / ref_edge) * span, 0.001, 0.999),
            clamp(params.field_padding + (row0.z / ref_edge) * span, 0.001, 0.999)
          );
          let cell_weight = render_field_cic_axis_weight(x, dispersed_particle.x, resolution)
            * render_field_cic_axis_weight(y, dispersed_particle.y, resolution)
            * render_field_cic_axis_weight(z, dispersed_particle.z, resolution);
          if (cell_weight > 0.0) {
            let scattering_optical_depth = render_field_balanced_optical_product(
              dispersed.scattering_cross_section_m2, cell_weight, inverse_cell_edge_per_m
            );
            let absorption_optical_depth = render_field_balanced_optical_product(
              dispersed.absorption_cross_section_m2, cell_weight, inverse_cell_edge_per_m
            );
            let asymmetry_optical_depth = render_field_balanced_signed_optical_product(
              dispersed.scattering_asymmetry_cross_section_m2, cell_weight, inverse_cell_edge_per_m
            );
            dispersed_scattering_optical_depth = render_field_saturating_nonnegative_add(
              dispersed_scattering_optical_depth, scattering_optical_depth
            );
            dispersed_absorption_optical_depth = render_field_saturating_nonnegative_add(
              dispersed_absorption_optical_depth, absorption_optical_depth
            );
            dispersed_scattering_asymmetry = render_field_accumulate_signed_scale(
              dispersed_scattering_asymmetry, asymmetry_optical_depth
            );
            dispersed_temperature = render_field_accumulate_weighted_temperature(
              dispersed_temperature, row1.z, scattering_optical_depth
            );
            dispersed_temperature = render_field_accumulate_weighted_temperature(
              dispersed_temperature, row1.z, absorption_optical_depth
            );
          }
        } else if (
          row0.w > 0.0
          && row1.y == 3.0
          && params.particle_count >= 4u
          && (params.particle_count % 4u) == 0u
        ) {
          let phase_stride = params.particle_count / 4u;
          let companion_index = (particle_index % phase_stride) + phase_stride;
          if (companion_index < arrayLength(&dispersed_medium_optics_rows)) {
            let companion = dispersed_medium_optics_rows[companion_index];
            let row4_wet = render_row4(particle_index);
            let suspended_condensate_fraction = clamp(1.0 - row2.y - row4_wet.x, 0.0, 1.0);
            if (
              suspended_condensate_fraction > 0.0
              && sph_dispersed_medium_optics_row_is_ready(companion)
              && companion.optical_state_id > 0.0
              && companion.optical_state_id == s3.y
            ) {
              let dispersed_particle = vec3<f32>(
                clamp(params.field_padding + (row0.x / ref_edge) * span, 0.001, 0.999),
                clamp(params.field_padding + (row0.y / ref_edge) * span, 0.001, 0.999),
                clamp(params.field_padding + (row0.z / ref_edge) * span, 0.001, 0.999)
              );
              let support_cells = clamp(max((row3.y * span / ref_edge) * f32(resolution), 3.6), 1.0, 6.0);
              let wx = max(0.0, 1.0 - abs(f32(x) - dispersed_particle.x * f32(resolution)) / support_cells) / support_cells;
              let wy = max(0.0, 1.0 - abs(f32(y) - dispersed_particle.y * f32(resolution)) / support_cells) / support_cells;
              let wz = max(0.0, 1.0 - abs(f32(z) - dispersed_particle.z * f32(resolution)) / support_cells) / support_cells;
              let cell_weight = wx * wy * wz;
              if (cell_weight > 0.0) {
                let companion_rho = select(1000.0, render_row1(companion_index).w, render_row1(companion_index).w > 100.0);
                let mist_mass_kg = row0.w * suspended_condensate_fraction;
                let mist_scattering_m2 = (0.75 * 3.8 * mist_mass_kg) / (companion_rho * 0.45e-6);
                let scattering_optical_depth = render_field_balanced_optical_product(
                  mist_scattering_m2, cell_weight, inverse_cell_edge_per_m
                );
                let asymmetry_optical_depth = render_field_balanced_signed_optical_product(
                  0.72 * mist_scattering_m2, cell_weight, inverse_cell_edge_per_m
                );
                dispersed_scattering_optical_depth = render_field_saturating_nonnegative_add(
                  dispersed_scattering_optical_depth, scattering_optical_depth
                );
                dispersed_scattering_asymmetry = render_field_accumulate_signed_scale(
                  dispersed_scattering_asymmetry, asymmetry_optical_depth
                );
                dispersed_temperature = render_field_accumulate_weighted_temperature(
                  dispersed_temperature, row1.z, scattering_optical_depth
                );
              }
            }
          }
        }
      }
    }
    if (in_bounds) {
${motionField ? '      render_motion_field[out_index] = vec4<f32>(0.0);' : ''}
      let dispersed_scattering_asymmetry_optical_depth = clamp(
        render_field_signed_scale_sum(dispersed_scattering_asymmetry),
        -dispersed_scattering_optical_depth,
        dispersed_scattering_optical_depth
      );
      let dispersed_total_optical_depth = render_field_saturating_nonnegative_add(
        dispersed_scattering_optical_depth,
        dispersed_absorption_optical_depth
      );
      let out_density = render_field_saturating_nonnegative_product(
        max(s1.y, 0.0),
        dispersed_total_optical_depth
      );
      let out_palette = select(vec3<f32>(0.0), color, dispersed_total_optical_depth > 0.0);
      let mean_temperature_k = render_field_divide_positive_scales(
        dispersed_temperature.weighted_temperature,
        dispersed_temperature.weight
      );
      render_field_cells[out_index * 2u] = vec4<f32>(out_density, out_palette);
      render_field_cells[out_index * 2u + 1u] = vec4<f32>(
        mean_temperature_k,
        dispersed_scattering_optical_depth,
        dispersed_absorption_optical_depth,
        dispersed_scattering_asymmetry_optical_depth
      );
    }
    return;
  }

  // Bulk surface path: cooperative shared-memory tiled gather over brick entries.
  if (ctrl.p_fb == 0u) {
    let p_end = ctrl.p_start + ctrl.p_count;
    for (var batch = ctrl.p_start; batch < p_end; batch = batch + 64u) {
      let batch_len = min(64u, p_end - batch);
      if (tid < batch_len) {
        let p_idx = spatial_grid_u32[grid.p_entries_offset + batch + tid];
        let row0 = render_row0(p_idx);
        let row1 = render_row1(p_idx);
        let row2 = render_row2(p_idx);
        let row3 = render_row3(p_idx);
        let row4 = render_row4(p_idx);
        let pw = render_bulk_phase_weight(
          p_idx, material_id, phase_id, row0.w,
          render_phase_weight(phase_id, row1.y, row2.y, row4.x)
        );
        let p_pos = vec3<f32>(
          clamp(params.field_padding + (row0.x / ref_edge) * span, 0.001, 0.999),
          clamp(params.field_padding + (row0.y / ref_edge) * span, 0.001, 0.999),
          clamp(params.field_padding + (row0.z / ref_edge) * span, 0.001, 0.999)
        );
        let p_rad = select(
          0.0,
          max(row3.y * particle_radius_norm_scale, particle_radius_floor_norm),
          particle_radius_scale > 0.0 && row3.y > 0.0
        );
        let full_str = select(
          strength,
          (s1.y + subtract) * p_rad * p_rad,
          p_rad > 0.0
        );
        let p_str = phase_partitioned_metaball_strength(full_str, pw, s1.y, subtract);
        let p_sup = max(metaball_support_norm(p_str, subtract), 1.0e-6);
        wg_p_pos_str[tid] = vec4<f32>(p_pos, p_str);
        wg_p_sup_temp_vel[tid] = vec4<f32>(p_sup, row1.z, row4.y, row4.z);
        wg_p_vel_z[tid] = row4.w;
      }
      workgroupBarrier();
      if (in_bounds) {
        for (var k = 0u; k < batch_len; k = k + 1u) {
          let ps = wg_p_pos_str[k];
          let delta = cell - ps.xyz;
          let dist2 = dot(delta, delta);
          let value = ps.w / (0.000001 + dist2) - subtract;
          if (value > 0.0) {
            let stv = wg_p_sup_temp_vel[k];
            let vz = wg_p_vel_z[k];
            density = density + value;
            let ratio = sqrt(dist2) / stv.x;
            palette = palette + color * smooth_palette_weight(ratio);
            temperature_weighted = temperature_weighted + stv.y * value;
            temperature_weight = temperature_weight + value;
            let vel = vec3<f32>(stv.z, stv.w, vz);
            velocity_weighted = velocity_weighted + vel * value;
            velocity_sq_weighted = velocity_sq_weighted + dot(vel, vel) * value;
          }
        }
      }
      workgroupBarrier();
    }
  } else if (in_bounds) {
    for (var particle_index = 0u; particle_index < params.particle_count; particle_index = particle_index + 1u) {
      let row0 = render_row0(particle_index);
      let row1 = render_row1(particle_index);
      let row2 = render_row2(particle_index);
      let row3 = render_row3(particle_index);
      if (row1.x != material_id || (render_domain_id > 0.0 && row2.w != render_domain_id)) {
        continue;
      }
      let row4 = render_row4(particle_index);
      let phase_weight = render_bulk_phase_weight(
        particle_index, material_id, phase_id, row0.w,
        render_phase_weight(phase_id, row1.y, row2.y, row4.x)
      );
      if (phase_weight <= 0.0) { continue; }
      let particle = vec3<f32>(
        clamp(params.field_padding + (row0.x / ref_edge) * span, 0.001, 0.999),
        clamp(params.field_padding + (row0.y / ref_edge) * span, 0.001, 0.999),
        clamp(params.field_padding + (row0.z / ref_edge) * span, 0.001, 0.999)
      );
      let delta = cell - particle;
      let dist2 = dot(delta, delta);
      let particle_radius_norm = select(
        0.0,
        max(row3.y * particle_radius_norm_scale, particle_radius_floor_norm),
        particle_radius_scale > 0.0 && row3.y > 0.0
      );
      let full_particle_strength = select(
        strength,
        (s1.y + subtract) * particle_radius_norm * particle_radius_norm,
        particle_radius_norm > 0.0
      );
      let particle_strength = phase_partitioned_metaball_strength(full_particle_strength, phase_weight, s1.y, subtract);
      let particle_support_norm = metaball_support_norm(particle_strength, subtract);
      let value = particle_strength / (0.000001 + dist2) - subtract;
      if (value > 0.0) {
        density = density + value;
        let ratio = sqrt(dist2) / max(particle_support_norm, 1.0e-6);
        palette = palette + color * smooth_palette_weight(ratio);
        temperature_weighted = temperature_weighted + row1.z * value;
        temperature_weight = temperature_weight + value;
        let particle_velocity = row4.yzw;
        velocity_weighted = velocity_weighted + particle_velocity * value;
        velocity_sq_weighted = velocity_sq_weighted + dot(particle_velocity, particle_velocity) * value;
      }
    }
  }

${motionField ? `  if (in_bounds) {
    render_motion_field[out_index] = vec4<f32>(velocity_weighted, temperature_weight);
  }
` : ''}
  // Splash-shard smear correction (workgroup-uniform fast path).
  var smear_sq = 0.0;
  var needs_smear = false;
  if (in_bounds && temperature_weight > 0.0 && params.render_smear_dt_s > 0.0) {
    let mean_velocity = velocity_weighted / temperature_weight;
    let dispersion_sq_ms = max(0.0, velocity_sq_weighted / temperature_weight - dot(mean_velocity, mean_velocity));
    let smear_norm = sqrt(dispersion_sq_ms) * params.render_smear_dt_s * span / ref_edge;
    smear_sq = smear_norm * smear_norm;
    needs_smear = smear_sq > 1.0e-10;
  }
  wg_smear_votes[tid] = select(0u, 1u, needs_smear);
  workgroupBarrier();
  if (tid == 0u) {
    var any_flag = 0u;
    for (var i = 0u; i < 64u; i = i + 1u) {
      any_flag = any_flag | wg_smear_votes[i];
    }
    wg_any_smear = any_flag;
  }
  let brick_has_smear = workgroupUniformLoad(&wg_any_smear) != 0u;

  if (brick_has_smear) {
    var corrected_density = 0.0;
    var corrected_palette = vec3<f32>(0.0, 0.0, 0.0);
    var corrected_temperature_weighted = 0.0;
    var corrected_temperature_weight = 0.0;
    if (ctrl.p_fb == 0u) {
      if (ctrl.p_count <= 64u) {
        if (needs_smear) {
          for (var k = 0u; k < ctrl.p_count; k = k + 1u) {
            let ps = wg_p_pos_str[k];
            let delta = cell - ps.xyz;
            let dist2 = dot(delta, delta) + smear_sq;
            let value = ps.w / (0.000001 + dist2) - subtract;
            if (value > 0.0) {
              let stv = wg_p_sup_temp_vel[k];
              corrected_density = corrected_density + value;
              let ratio = sqrt(dist2) / stv.x;
              corrected_palette = corrected_palette + color * smooth_palette_weight(ratio);
              corrected_temperature_weighted = corrected_temperature_weighted + stv.y * value;
              corrected_temperature_weight = corrected_temperature_weight + value;
            }
          }
        }
      } else {
        let p_end = ctrl.p_start + ctrl.p_count;
        for (var batch = ctrl.p_start; batch < p_end; batch = batch + 64u) {
          let batch_len = min(64u, p_end - batch);
          if (tid < batch_len) {
            let p_idx = spatial_grid_u32[grid.p_entries_offset + batch + tid];
            let row0 = render_row0(p_idx);
            let row1 = render_row1(p_idx);
            let row2 = render_row2(p_idx);
            let row3 = render_row3(p_idx);
            let row4 = render_row4(p_idx);
            let pw = render_bulk_phase_weight(
              p_idx, material_id, phase_id, row0.w,
              render_phase_weight(phase_id, row1.y, row2.y, row4.x)
            );
            let p_pos = vec3<f32>(
              clamp(params.field_padding + (row0.x / ref_edge) * span, 0.001, 0.999),
              clamp(params.field_padding + (row0.y / ref_edge) * span, 0.001, 0.999),
              clamp(params.field_padding + (row0.z / ref_edge) * span, 0.001, 0.999)
            );
            let p_rad = select(
              0.0,
              max(row3.y * particle_radius_norm_scale, particle_radius_floor_norm),
              particle_radius_scale > 0.0 && row3.y > 0.0
            );
            let full_str = select(
              strength,
              (s1.y + subtract) * p_rad * p_rad,
              p_rad > 0.0
            );
            let p_str = phase_partitioned_metaball_strength(full_str, pw, s1.y, subtract);
            let p_sup = max(metaball_support_norm(p_str, subtract), 1.0e-6);
            wg_p_pos_str[tid] = vec4<f32>(p_pos, p_str);
            wg_p_sup_temp_vel[tid] = vec4<f32>(p_sup, row1.z, 0.0, 0.0);
          }
          workgroupBarrier();
          if (needs_smear) {
            for (var k = 0u; k < batch_len; k = k + 1u) {
              let ps = wg_p_pos_str[k];
              let delta = cell - ps.xyz;
              let dist2 = dot(delta, delta) + smear_sq;
              let value = ps.w / (0.000001 + dist2) - subtract;
              if (value > 0.0) {
                let stv = wg_p_sup_temp_vel[k];
                corrected_density = corrected_density + value;
                let ratio = sqrt(dist2) / stv.x;
                corrected_palette = corrected_palette + color * smooth_palette_weight(ratio);
                corrected_temperature_weighted = corrected_temperature_weighted + stv.y * value;
                corrected_temperature_weight = corrected_temperature_weight + value;
              }
            }
          }
          workgroupBarrier();
        }
      }
    } else if (needs_smear) {
      for (var particle_index = 0u; particle_index < params.particle_count; particle_index = particle_index + 1u) {
        let row0 = render_row0(particle_index);
        let row1 = render_row1(particle_index);
        let row2 = render_row2(particle_index);
        let row3 = render_row3(particle_index);
        if (row1.x != material_id || (render_domain_id > 0.0 && row2.w != render_domain_id)) {
          continue;
        }
        let phase_weight = render_bulk_phase_weight(
          particle_index, material_id, phase_id, row0.w,
          render_phase_weight(phase_id, row1.y, row2.y, render_row4(particle_index).x)
        );
        if (phase_weight <= 0.0) { continue; }
        let particle = vec3<f32>(
          clamp(params.field_padding + (row0.x / ref_edge) * span, 0.001, 0.999),
          clamp(params.field_padding + (row0.y / ref_edge) * span, 0.001, 0.999),
          clamp(params.field_padding + (row0.z / ref_edge) * span, 0.001, 0.999)
        );
        let delta = cell - particle;
        let dist2 = dot(delta, delta) + smear_sq;
        let particle_radius_norm = select(
          0.0,
          max(row3.y * particle_radius_norm_scale, particle_radius_floor_norm),
          particle_radius_scale > 0.0 && row3.y > 0.0
        );
        let full_particle_strength = select(
          strength,
          (s1.y + subtract) * particle_radius_norm * particle_radius_norm,
          particle_radius_norm > 0.0
        );
        let particle_strength = phase_partitioned_metaball_strength(full_particle_strength, phase_weight, s1.y, subtract);
        let particle_support_norm = metaball_support_norm(particle_strength, subtract);
        let value = particle_strength / (0.000001 + dist2) - subtract;
        if (value > 0.0) {
          corrected_density = corrected_density + value;
          let ratio = sqrt(dist2) / max(particle_support_norm, 1.0e-6);
          corrected_palette = corrected_palette + color * smooth_palette_weight(ratio);
          corrected_temperature_weighted = corrected_temperature_weighted + row1.z * value;
          corrected_temperature_weight = corrected_temperature_weight + value;
        }
      }
    }
    if (needs_smear) {
      density = corrected_density;
      palette = corrected_palette;
      temperature_weighted = corrected_temperature_weighted;
      temperature_weight = corrected_temperature_weight;
    }
  }

  // Product events pass (brick-binned with shared-memory batching or exact fallback).
  if (grid.has_product_events != 0u) {
    if (ctrl.e_fb == 0u) {
      let e_end = ctrl.e_start + ctrl.e_count;
      let denom_sup = max(support_norm, 1.0e-6);
      for (var batch = ctrl.e_start; batch < e_end; batch = batch + 64u) {
        let batch_len = min(64u, e_end - batch);
        if (tid < batch_len) {
          let ev_idx = spatial_grid_u32[grid.e_entries_offset + batch + tid];
          let event0 = product_events[ev_idx * 8u];
          let ev_pos = vec3<f32>(
            clamp(params.field_padding + (event0.x / ref_edge) * span, 0.001, 0.999),
            clamp(params.field_padding + (event0.y / ref_edge) * span, 0.001, 0.999),
            clamp(params.field_padding + (event0.z / ref_edge) * span, 0.001, 0.999)
          );
          wg_p_pos_str[tid] = vec4<f32>(ev_pos, 0.0);
        }
        workgroupBarrier();
        if (in_bounds) {
          for (var k = 0u; k < batch_len; k = k + 1u) {
            let ev_pos = wg_p_pos_str[k].xyz;
            let delta = cell - ev_pos;
            let dist2 = dot(delta, delta);
            let value = strength / (0.000001 + dist2) - subtract;
            if (value > 0.0) {
              density = density + value;
              let ratio = sqrt(dist2) / denom_sup;
              palette = palette + color * smooth_palette_weight(ratio);
            }
          }
        }
        workgroupBarrier();
      }
    } else if (in_bounds) {
      let authenticated_product_event_count = render_product_event_count();
      for (var event_index = 0u; event_index < authenticated_product_event_count; event_index = event_index + 1u) {
        let event0 = product_events[event_index * 8u];
        let event1 = product_events[event_index * 8u + 1u];
        let event2 = product_events[event_index * 8u + 2u];
        let event3 = product_events[event_index * 8u + 3u];
        let event4 = product_events[event_index * 8u + 4u];
        if (
          event4.z != 1.0
          || event3.y <= 0.0
          || event1.x != material_id
          || (event2.w > 0.0 && event2.w != phase_id)
        ) {
          continue;
        }
        let event_position = vec3<f32>(
          clamp(params.field_padding + (event0.x / ref_edge) * span, 0.001, 0.999),
          clamp(params.field_padding + (event0.y / ref_edge) * span, 0.001, 0.999),
          clamp(params.field_padding + (event0.z / ref_edge) * span, 0.001, 0.999)
        );
        let delta = cell - event_position;
        let dist2 = dot(delta, delta);
        let value = strength / (0.000001 + dist2) - subtract;
        if (value > 0.0) {
          density = density + value;
          let ratio = sqrt(dist2) / max(support_norm, 1.0e-6);
          palette = palette + color * smooth_palette_weight(ratio);
        }
      }
    }
  }

  if (in_bounds) {
    let mean_temperature_k = select(
      0.0,
      temperature_weighted / max(temperature_weight, 1.0e-6),
      temperature_weight > 0.0
    );
    render_field_cells[out_index * 2u] = vec4<f32>(density, palette);
    render_field_cells[out_index * 2u + 1u] = vec4<f32>(mean_temperature_k, 0.0, 0.0, 0.0);
  }
}
`;
}

export const sphRenderFieldSpatialGatherWgsl = createSphRenderFieldSpatialGatherWgsl();
export const sphRenderFieldSpatialGatherMotionWgsl = createSphRenderFieldSpatialGatherWgsl({ motionField: true });

const spatialGridScratchByDevice = new WeakMap();

export function planSphRenderFieldSpatialGrid({
  device,
  surfaceRecords,
  surfaceCount,
  particleCount,
  productEventCount = 0
} = {}) {
  if (
    !Number.isInteger(surfaceCount)
    || surfaceCount < 1
    || surfaceCount > SPH_RENDER_FIELD_SPATIAL_GRID_MAX_SURFACES
    || !(surfaceRecords instanceof Float32Array)
    || surfaceRecords.length < surfaceCount * 16
  ) {
    return null;
  }
  const maxWorkgroups = Number(device?.limits?.maxComputeWorkgroupsPerDimension ?? 65535);
  const maxBufferSize = Number(device?.limits?.maxBufferSize ?? 256 * 1024 * 1024);
  const maxStorageSize = Number(device?.limits?.maxStorageBufferBindingSize ?? 128 * 1024 * 1024);
  const maxStorageBytes = Math.min(maxBufferSize, maxStorageSize);
  const maxStoragePerStage = Number(device?.limits?.maxStorageBuffersPerShaderStage ?? 8);
  if (maxStoragePerStage < 8) return null;

  const surfaceBrickInfo = new Uint32Array(SPH_RENDER_FIELD_SPATIAL_GRID_MAX_SURFACES * 4);
  let totalBricks = 0;
  let maxBricksPerSurface = 0;
  for (let s = 0; s < surfaceCount; s += 1) {
    const res = Math.max(1, Math.trunc(Number(surfaceRecords[s * 16 + 4]) || 1));
    const brickDim = Math.ceil(res / SPH_RENDER_FIELD_SPATIAL_GRID_BRICK_EDGE);
    const brickCount = brickDim * brickDim * brickDim;
    if (brickCount > maxWorkgroups) return null;
    surfaceBrickInfo[s * 4] = brickDim;
    surfaceBrickInfo[s * 4 + 1] = brickCount;
    surfaceBrickInfo[s * 4 + 2] = totalBricks;
    surfaceBrickInfo[s * 4 + 3] = 0;
    totalBricks += brickCount;
    if (brickCount > maxBricksPerSurface) maxBricksPerSurface = brickCount;
  }
  if (totalBricks < 1 || totalBricks > SPH_RENDER_FIELD_SPATIAL_GRID_MAX_BRICKS) {
    return null;
  }
  const particleWorkgroups = particleCount > 0 ? Math.ceil(particleCount / 64) : 0;
  const hasProductEvents = productEventCount > 0;
  const eventWorkgroups = hasProductEvents ? Math.ceil(productEventCount / 64) : 0;
  if (
    particleWorkgroups > maxWorkgroups
    || eventWorkgroups > maxWorkgroups
    || surfaceCount > maxWorkgroups
  ) {
    return null;
  }

  const scanBlockCount = Math.ceil(totalBricks / SPH_RENDER_FIELD_SPATIAL_GRID_SCAN_BLOCK_SIZE);
  const pad4 = (n) => Math.ceil(n / 4) * 4;
  const surfaceFallbackOffset = 8;
  const surfaceEventFallbackOffset = surfaceFallbackOffset + pad4(surfaceCount);
  const pCountsOffset = surfaceEventFallbackOffset + pad4(surfaceCount);
  const eCountsOffset = pCountsOffset + pad4(totalBricks);
  const clearWords = hasProductEvents ? eCountsOffset + pad4(totalBricks) : eCountsOffset;

  const pOffsetsOffset = clearWords;
  const pCursorsOffset = pOffsetsOffset + pad4(totalBricks);
  const pBlockTotalsOffset = pCursorsOffset + pad4(totalBricks);
  const pEntriesOffset = pBlockTotalsOffset + pad4(scanBlockCount);
  const particleEntryCapacity = Math.max(
    262_144,
    Math.min(4_194_304, Math.max(totalBricks * 8, particleCount * 16))
  );
  const afterParticleEntries = pEntriesOffset + particleEntryCapacity;

  const eventEntryCapacity = hasProductEvents
    ? Math.max(131_072, Math.min(2_097_152, Math.max(totalBricks * 4, productEventCount * 8)))
    : 0;
  const eOffsetsOffset = afterParticleEntries;
  const eCursorsOffset = hasProductEvents ? eOffsetsOffset + pad4(totalBricks) : afterParticleEntries;
  const eBlockTotalsOffset = hasProductEvents ? eCursorsOffset + pad4(totalBricks) : afterParticleEntries;
  const eEntriesOffset = hasProductEvents ? eBlockTotalsOffset + pad4(scanBlockCount) : afterParticleEntries;
  const totalWords = hasProductEvents ? eEntriesOffset + eventEntryCapacity : afterParticleEntries;
  const totalBytes = totalWords * Uint32Array.BYTES_PER_ELEMENT;
  if (totalBytes > maxStorageBytes) {
    return null;
  }

  return {
    surfaceCount,
    totalBricks,
    maxBricksPerSurface,
    scanBlockCount,
    particleWorkgroups,
    eventWorkgroups,
    hasProductEvents,
    surfaceFallbackOffset,
    surfaceEventFallbackOffset,
    pCountsOffset,
    eCountsOffset,
    clearBytes: clearWords * Uint32Array.BYTES_PER_ELEMENT,
    pOffsetsOffset,
    pCursorsOffset,
    pBlockTotalsOffset,
    pEntriesOffset,
    particleEntryCapacity,
    eOffsetsOffset,
    eCursorsOffset,
    eBlockTotalsOffset,
    eEntriesOffset,
    eventEntryCapacity,
    totalBytes,
    surfaceBrickInfo
  };
}

function buildSpatialGridParamsArray(plan) {
  const words = new Uint32Array(SPH_RENDER_FIELD_SPATIAL_GRID_PARAMS_BYTES / 4);
  words[0] = plan.totalBricks;
  words[1] = plan.scanBlockCount;
  words[2] = plan.particleEntryCapacity;
  words[3] = plan.eventEntryCapacity;
  words[4] = SPH_RENDER_FIELD_SPATIAL_GRID_MAX_BRICKS_PER_SOURCE;
  words[5] = plan.hasProductEvents ? 1 : 0;
  words[6] = plan.surfaceFallbackOffset;
  words[7] = plan.surfaceEventFallbackOffset;
  words[8] = plan.pCountsOffset;
  words[9] = plan.pOffsetsOffset;
  words[10] = plan.pCursorsOffset;
  words[11] = plan.pBlockTotalsOffset;
  words[12] = plan.pEntriesOffset;
  words[13] = plan.eCountsOffset;
  words[14] = plan.eOffsetsOffset;
  words[15] = plan.eCursorsOffset;
  words[16] = plan.eBlockTotalsOffset;
  words[17] = plan.eEntriesOffset;
  words[18] = 0;
  words[19] = 0;
  words.set(plan.surfaceBrickInfo, 20);
  return words;
}

function ensureSpatialGridScratch(device, requiredGridBytes) {
  let state = spatialGridScratchByDevice.get(device);
  if (!state) {
    state = {
      gridBuffer: null,
      gridCapacityBytes: 0,
      paramsBuffer: null
    };
    spatialGridScratchByDevice.set(device, state);
  }
  if (!state.paramsBuffer) {
    state.paramsBuffer = device.createBuffer({
      label: 'ulg-sph-render-field-spatial-grid-params',
      size: SPH_RENDER_FIELD_SPATIAL_GRID_PARAMS_BYTES,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
    });
  }
  if (!state.gridBuffer || state.gridCapacityBytes < requiredGridBytes) {
    const oldBuffer = state.gridBuffer;
    const nextCap = Math.max(requiredGridBytes, Math.min(requiredGridBytes * 2, 32 * 1024 * 1024));
    state.gridBuffer = device.createBuffer({
      label: 'ulg-sph-render-field-spatial-grid-u32',
      size: nextCap,
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
    });
    state.gridCapacityBytes = nextCap;
    if (oldBuffer) {
      deferSubmittedWorkCleanup(device, () => oldBuffer.destroy?.());
    }
  }
  return state;
}

export function encodeSphRenderFieldSpatialGridPasses({
  device,
  encoder,
  plan,
  sourceRowsResource,
  surfaceResource,
  fieldRowsResource,
  paramsBuffer,
  productEventsResource,
  productHistoryControlResource,
  productHistoryGateParamsBuffer,
  dispersedOpticsResource,
  motionFieldResource = null
}) {
  const scratch = ensureSpatialGridScratch(device, plan.totalBytes);
  const gridParamsWords = buildSpatialGridParamsArray(plan);
  device.queue.writeBuffer(scratch.paramsBuffer, 0, gridParamsWords);

  const gridStorageResource = {
    buffer: scratch.gridBuffer,
    offset: 0,
    size: plan.totalBytes
  };

  // Clear meta, fallback flags, and brick counts in one GPU fill.
  encoder.clearBuffer(scratch.gridBuffer, 0, plan.clearBytes);

  const particleBinBindings = [
    computeBufferBinding(0, 'read-only-storage'),
    computeBufferBinding(1, 'read-only-storage'),
    computeBufferBinding(2, 'read-only-storage'),
    computeBufferBinding(3, 'read-only-storage'),
    computeBufferBinding(4, 'storage'),
    computeBufferBinding(5, 'uniform'),
    computeBufferBinding(6, 'uniform'),
    computeBufferBinding(7, 'uniform')
  ];
  const scanBindings = [
    computeBufferBinding(0, 'storage'),
    computeBufferBinding(1, 'uniform')
  ];
  const gatherBindings = [
    computeBufferBinding(0, 'read-only-storage'),
    computeBufferBinding(1, 'read-only-storage'),
    computeBufferBinding(2, 'storage'),
    computeBufferBinding(3, 'uniform'),
    computeBufferBinding(4, 'read-only-storage'),
    computeBufferBinding(5, 'read-only-storage'),
    computeBufferBinding(6, 'uniform'),
    computeBufferBinding(7, 'read-only-storage'),
    computeBufferBinding(8, 'read-only-storage'),
    computeBufferBinding(9, 'uniform'),
    ...(motionFieldResource ? [computeBufferBinding(10, 'storage')] : [])
  ];

  const countParticlePipe = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-sph-render-field-spatial-v1-count-particles',
    label: 'ulg-sph-render-field-spatial-count-particles',
    code: sphRenderFieldSpatialParticleBinWgsl,
    entryPoint: 'count_particle_bricks',
    bindings: particleBinBindings
  });
  const scatterParticlePipe = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-sph-render-field-spatial-v1-scatter-particles',
    label: 'ulg-sph-render-field-spatial-scatter-particles',
    code: sphRenderFieldSpatialParticleBinWgsl,
    entryPoint: 'scatter_particle_bricks',
    bindings: particleBinBindings
  });
  const scanBlocksPipe = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-sph-render-field-spatial-v1-scan-blocks',
    label: 'ulg-sph-render-field-spatial-scan-blocks',
    code: sphRenderFieldSpatialScanWgsl,
    entryPoint: 'scan_brick_blocks',
    bindings: scanBindings
  });
  const scanTotalsPipe = plan.scanBlockCount > 1
    ? createCachedExplicitComputePipeline(device, {
        cacheKey: 'ulg-sph-render-field-spatial-v1-scan-totals',
        label: 'ulg-sph-render-field-spatial-scan-totals',
        code: sphRenderFieldSpatialScanWgsl,
        entryPoint: 'scan_brick_block_totals',
        bindings: scanBindings
      })
    : null;
  const addOffsetsPipe = plan.scanBlockCount > 1
    ? createCachedExplicitComputePipeline(device, {
        cacheKey: 'ulg-sph-render-field-spatial-v1-add-offsets',
        label: 'ulg-sph-render-field-spatial-add-offsets',
        code: sphRenderFieldSpatialScanWgsl,
        entryPoint: 'add_brick_block_offsets',
        bindings: scanBindings
      })
    : null;
  const gatherPipe = createCachedExplicitComputePipeline(device, {
    cacheKey: motionFieldResource
      ? 'ulg-sph-render-field-spatial-v1-gather-motion'
      : 'ulg-sph-render-field-spatial-v1-gather',
    label: 'ulg-sph-render-field-spatial-gather',
    code: motionFieldResource
      ? sphRenderFieldSpatialGatherMotionWgsl
      : sphRenderFieldSpatialGatherWgsl,
    entryPoint: 'gather_bricks',
    bindings: gatherBindings
  });

  const particleBinBG = plan.particleWorkgroups > 0
    ? createCachedExplicitBindGroup(device, {
        label: 'ulg-sph-render-field-spatial-particle-bin-bg',
        layout: countParticlePipe.bindGroupLayout,
        entries: [
          { binding: 0, resource: sourceRowsResource },
          { binding: 1, resource: surfaceResource },
          { binding: 2, resource: dispersedOpticsResource },
          { binding: 3, resource: productHistoryControlResource },
          { binding: 4, resource: gridStorageResource },
          { binding: 5, resource: { buffer: paramsBuffer } },
          { binding: 6, resource: { buffer: productHistoryGateParamsBuffer } },
          { binding: 7, resource: { buffer: scratch.paramsBuffer } }
        ]
      })
    : null;

  let countEventPipe = null;
  let scatterEventPipe = null;
  let eventBinBG = null;
  if (plan.hasProductEvents && plan.eventWorkgroups > 0) {
    const eventBinBindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'read-only-storage'),
      computeBufferBinding(3, 'storage'),
      computeBufferBinding(4, 'uniform'),
      computeBufferBinding(5, 'uniform'),
      computeBufferBinding(6, 'uniform')
    ];
    countEventPipe = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-sph-render-field-spatial-v1-count-events',
      label: 'ulg-sph-render-field-spatial-count-events',
      code: sphRenderFieldSpatialEventBinWgsl,
      entryPoint: 'count_event_bricks',
      bindings: eventBinBindings
    });
    scatterEventPipe = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-sph-render-field-spatial-v1-scatter-events',
      label: 'ulg-sph-render-field-spatial-scatter-events',
      code: sphRenderFieldSpatialEventBinWgsl,
      entryPoint: 'scatter_event_bricks',
      bindings: eventBinBindings
    });
    eventBinBG = createCachedExplicitBindGroup(device, {
      label: 'ulg-sph-render-field-spatial-event-bin-bg',
      layout: countEventPipe.bindGroupLayout,
      entries: [
        { binding: 0, resource: productEventsResource },
        { binding: 1, resource: surfaceResource },
        { binding: 2, resource: productHistoryControlResource },
        { binding: 3, resource: gridStorageResource },
        { binding: 4, resource: { buffer: paramsBuffer } },
        { binding: 5, resource: { buffer: productHistoryGateParamsBuffer } },
        { binding: 6, resource: { buffer: scratch.paramsBuffer } }
      ]
    });
  }

  const scanBG = createCachedExplicitBindGroup(device, {
    label: 'ulg-sph-render-field-spatial-scan-bg',
    layout: scanBlocksPipe.bindGroupLayout,
    entries: [
      { binding: 0, resource: gridStorageResource },
      { binding: 1, resource: { buffer: scratch.paramsBuffer } }
    ]
  });

  const gatherBG = createCachedExplicitBindGroup(device, {
    label: 'ulg-sph-render-field-spatial-gather-bg',
    layout: gatherPipe.bindGroupLayout,
    entries: [
      { binding: 0, resource: sourceRowsResource },
      { binding: 1, resource: surfaceResource },
      { binding: 2, resource: fieldRowsResource },
      { binding: 3, resource: { buffer: paramsBuffer } },
      { binding: 4, resource: productEventsResource },
      { binding: 5, resource: productHistoryControlResource },
      { binding: 6, resource: { buffer: productHistoryGateParamsBuffer } },
      { binding: 7, resource: dispersedOpticsResource },
      { binding: 8, resource: gridStorageResource },
      { binding: 9, resource: { buffer: scratch.paramsBuffer } },
      ...(motionFieldResource ? [{ binding: 10, resource: motionFieldResource }] : [])
    ]
  });

  const dispatch = (label, pipe, bg, x, y = 1, z = 1) => {
    const pass = encoder.beginComputePass({ label });
    pass.setPipeline(pipe.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(x, y, z);
    pass.end();
  };

  const scanChannels = plan.hasProductEvents ? 2 : 1;
  if (particleBinBG) {
    dispatch(
      'ulg-sph-render-field-spatial-count-particles',
      countParticlePipe,
      particleBinBG,
      plan.particleWorkgroups,
      plan.surfaceCount
    );
  }
  if (eventBinBG) {
    dispatch(
      'ulg-sph-render-field-spatial-count-events',
      countEventPipe,
      eventBinBG,
      plan.eventWorkgroups,
      plan.surfaceCount
    );
  }
  dispatch(
    'ulg-sph-render-field-spatial-scan-blocks',
    scanBlocksPipe,
    scanBG,
    plan.scanBlockCount,
    scanChannels
  );
  if (plan.scanBlockCount > 1) {
    dispatch(
      'ulg-sph-render-field-spatial-scan-totals',
      scanTotalsPipe,
      scanBG,
      1,
      scanChannels
    );
    dispatch(
      'ulg-sph-render-field-spatial-add-offsets',
      addOffsetsPipe,
      scanBG,
      plan.scanBlockCount,
      scanChannels
    );
  }
  if (particleBinBG) {
    dispatch(
      'ulg-sph-render-field-spatial-scatter-particles',
      scatterParticlePipe,
      particleBinBG,
      plan.particleWorkgroups,
      plan.surfaceCount
    );
  }
  if (eventBinBG) {
    dispatch(
      'ulg-sph-render-field-spatial-scatter-events',
      scatterEventPipe,
      eventBinBG,
      plan.eventWorkgroups,
      plan.surfaceCount
    );
  }
  dispatch(
    'ulg-sph-render-field-spatial-gather',
    gatherPipe,
    gatherBG,
    plan.maxBricksPerSurface,
    plan.surfaceCount
  );

  return {
    pipelineCacheStatus: gatherPipe.cacheStatus
  };
}
