// Extracted from wgsl.js (Gate 6 Phase D mechanical decomposition).

import {
  sphDispersedMediumOpticsWgsl
} from './sphDispersedMediumWgsl.js';


export const sphRenderRowsWgsl = `
struct RenderRowsParams {
  particle_count: u32,
  render_domain_base_count: u32,
  render_domain_drop_count: u32,
  has_mechanics: u32,
  max_support_radius_m: f32,
  max_gas_radius_m: f32,
  material_bank_particle_size_row_count: u32,
  _pad0: u32,
  _pad1: u32,
  _pad2: u32,
};

@group(0) @binding(0) var<storage, read> sph_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> sph_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> render_rows: array<vec4<f32>>;
@group(0) @binding(3) var<uniform> params: RenderRowsParams;
@group(0) @binding(4) var<storage, read> mls_mpm_mechanics: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read> material_bank_particle_size_rows: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read> particle_identity: array<u32>;

const RENDER_ROW_VEC4_STRIDE: u32 = 5u;
const MATERIAL_BANK_PARTICLE_SIZE_ROW_VEC4_STRIDE: u32 = 4u;
const MATERIAL_BANK_GPU_ROW_STATUS_READY: u32 = 1u;
const RENDER_ROW_MAX_PARTICLE_RADIUS_GROWTH_RATIO: f32 = 4.0;
const RENDER_ROW_MAX_VOLUME_RATIO_J: f32 = 64.0;

fn radius_from_volume_m(volume_m3: f32) -> f32 {
  if (volume_m3 <= 0.0) {
    return 0.0;
  }
  return pow((3.0 * volume_m3) / (4.0 * 3.141592653589793), 1.0 / 3.0);
}

fn volume_from_radius_m(radius_m: f32) -> f32 {
  if (radius_m <= 0.0) {
    return 0.0;
  }
  return (4.0 * 3.141592653589793 * radius_m * radius_m * radius_m) / 3.0;
}

fn material_bank_rest_volume_for_role(role_id: f32) -> f32 {
  if (role_id <= 0.0 || params.material_bank_particle_size_row_count == 0u) {
    return 0.0;
  }
  var row_index = 0u;
  loop {
    if (row_index >= params.material_bank_particle_size_row_count) {
      break;
    }
    let base = row_index * MATERIAL_BANK_PARTICLE_SIZE_ROW_VEC4_STRIDE;
    let row0 = material_bank_particle_size_rows[base];
    let row1 = material_bank_particle_size_rows[base + 1u];
    let row3 = material_bank_particle_size_rows[base + 3u];
    let row_status = u32(row3.x + 0.5);
    if (abs(row0.x - role_id) < 0.5 && row_status == MATERIAL_BANK_GPU_ROW_STATUS_READY) {
      if (row1.w > 0.0) {
        return row1.w;
      }
      if (row1.z > 0.0) {
        return volume_from_radius_m(row1.z);
      }
    }
    row_index = row_index + 1u;
  }
  return 0.0;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }

  let pos_mass = sph_state[particle_index * 2u];
  let thermo0 = sph_thermo[particle_index * 3u];
  let thermo1 = sph_thermo[particle_index * 3u + 1u];
  let thermo2 = sph_thermo[particle_index * 3u + 2u];
  var render_domain_id: f32 = 0.0;
  if (params.render_domain_base_count > 0u && particle_index < params.render_domain_base_count) {
    render_domain_id = 1.0;
  }
  if (
    render_domain_id == 0.0
    && params.render_domain_drop_count > 0u
    && particle_index >= params.render_domain_base_count
    && particle_index < params.render_domain_base_count + params.render_domain_drop_count
  ) {
    render_domain_id = 2.0;
  }
  // Stable body identity is independent of mutable thermodynamic/mechanics
  // state. Positive explicit ids override the legacy contiguous base/drop
  // ranges; zero preserves that fallback and is the required spare/product
  // slot identity.
  let explicit_render_domain_id = particle_identity[particle_index];
  if (explicit_render_domain_id > 0u) {
    render_domain_id = f32(explicit_render_domain_id);
  }
  var volume_ratio_j = 1.0;
  var rest_volume_m3 = 0.0;
  var pressure_pa = 0.0;
  let visual_particle_radius_m = thermo2.w;
  if (thermo0.w > 0.0 && pos_mass.w > 0.0) {
    rest_volume_m3 = pos_mass.w / thermo0.w;
  }
  if (visual_particle_radius_m > 0.0) {
    rest_volume_m3 = volume_from_radius_m(visual_particle_radius_m);
  }
  let bank_rest_volume_m3 = material_bank_rest_volume_for_role(render_domain_id);
  if (bank_rest_volume_m3 > 0.0 && visual_particle_radius_m <= 0.0) {
    rest_volume_m3 = bank_rest_volume_m3;
  }
  if (params.has_mechanics != 0u) {
    let mechanics4 = mls_mpm_mechanics[particle_index * 8u + 4u];
    let mechanics7 = mls_mpm_mechanics[particle_index * 8u + 7u];
    volume_ratio_j = max(mechanics4.z, 1.0e-9);
    if (mechanics4.w > 0.0 && visual_particle_radius_m <= 0.0) {
      rest_volume_m3 = mechanics4.w;
    }
    pressure_pa = max(mechanics7.x, 0.0);
  }
  let raw_volume_ratio_j = max(volume_ratio_j, 1.0e-9);
  let raw_current_volume_m3 = max(rest_volume_m3 * raw_volume_ratio_j, 0.0);
  let rest_particle_radius_m = radius_from_volume_m(rest_volume_m3);
  let raw_particle_radius_m = radius_from_volume_m(raw_current_volume_m3);
  var current_volume_m3 = raw_current_volume_m3;
  var particle_radius_m = raw_particle_radius_m;
  var effective_volume_ratio_j = raw_volume_ratio_j;
  if (
    rest_particle_radius_m > 0.0
    && raw_particle_radius_m > rest_particle_radius_m * RENDER_ROW_MAX_PARTICLE_RADIUS_GROWTH_RATIO
  ) {
    particle_radius_m = rest_particle_radius_m * RENDER_ROW_MAX_PARTICLE_RADIUS_GROWTH_RATIO;
    current_volume_m3 = rest_volume_m3 * RENDER_ROW_MAX_VOLUME_RATIO_J;
    effective_volume_ratio_j = RENDER_ROW_MAX_VOLUME_RATIO_J;
  }
  if (params.max_support_radius_m > 0.0 && particle_radius_m > params.max_support_radius_m) {
    particle_radius_m = params.max_support_radius_m;
    current_volume_m3 = volume_from_radius_m(params.max_support_radius_m);
    if (rest_volume_m3 > 0.0) {
      effective_volume_ratio_j = max(current_volume_m3 / rest_volume_m3, 1.0e-9);
    }
  }
  if (
    u32(thermo0.y + 0.5) == 3u
    && params.max_gas_radius_m > 0.0
    && particle_radius_m > params.max_gas_radius_m
  ) {
    particle_radius_m = params.max_gas_radius_m;
    current_volume_m3 = volume_from_radius_m(params.max_gas_radius_m);
    if (rest_volume_m3 > 0.0) {
      effective_volume_ratio_j = max(current_volume_m3 / rest_volume_m3, 1.0e-9);
    }
  }
  let render_row_base = particle_index * RENDER_ROW_VEC4_STRIDE;
  // Spare product slots (zero mass) must never match a render surface or
  // decode into a sphere instance: mask their material id to 0.
  let render_material_id = select(thermo0.x, 0.0, pos_mass.w <= 0.0);
  render_rows[render_row_base] = pos_mass;
  render_rows[render_row_base + 1u] = vec4<f32>(render_material_id, thermo0.y, thermo0.z, thermo2.z);
  render_rows[render_row_base + 2u] = vec4<f32>(thermo0.w, thermo1.z, thermo2.y, render_domain_id);
  render_rows[render_row_base + 3u] = vec4<f32>(current_volume_m3, particle_radius_m, effective_volume_ratio_j, pressure_pa);
  // Tri-phase split (thermo row1 = solid/liquid/gas/plasma fractions): the
  // render field weights each particle's contribution per phase surface so
  // transition-boundary particles morph between surfaces instead of popping.
  // Pads row4.yzw carry the particle velocity so the render-field kernel can
  // measure per-cell velocity dispersion (splash-shard smear correction).
  let render_vel_u = sph_state[particle_index * 2u + 1u];
  render_rows[render_row_base + 4u] = vec4<f32>(thermo1.x, render_vel_u.x, render_vel_u.y, render_vel_u.z);
}
`;

// Both material-agnostic variants use this exact gather. The optional output
// retains moments already computed for smear; it does not change field lanes
// or add a second traversal of the particle source.
function createSphRenderFieldWgsl({ motionField = false } = {}) {
  return `
${sphDispersedMediumOpticsWgsl}
struct RenderFieldParams {
	  particle_count: u32,
	  surface_count: u32,
	  total_field_cells: u32,
	  product_event_count: u32,
  field_padding: f32,
  ref_edge_m: f32,
  // Render refresh interval (s): a cell whose particles diverge at sigma_v
  // smears its mass over sigma_v*dt between refreshes; the metaball
  // correction below folds that spread into the sample distance.
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

@group(0) @binding(0) var<storage, read> render_rows: array<vec4<f32>>;
	@group(0) @binding(1) var<storage, read> render_surfaces: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> render_field_cells: array<vec4<f32>>;
	@group(0) @binding(3) var<uniform> params: RenderFieldParams;
	@group(0) @binding(4) var<storage, read> product_events: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read> product_history_control: array<u32>;
@group(0) @binding(6) var<uniform> product_history_gate: RenderProductHistoryGateParams;
@group(0) @binding(7) var<storage, read> dispersed_medium_optics_rows: array<SphDispersedMediumOptics>;
${motionField ? '@group(0) @binding(8) var<storage, read_write> render_motion_field: array<vec4<f32>>;' : ''}

const RENDER_FIELD_RENDER_ROW_VEC4_STRIDE: u32 = 5u;

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

// Phase weight of a particle for a phase-keyed surface: solid/liquid/gas
// surfaces take the particle's phase FRACTION (transition-boundary particles
// contribute partially to both sides, which keeps apparent volume persistent
// and stops surfaces blinking as hard phase flags flip); other phase ids fall
// back to the exact phase-id match.
fn render_phase_weight(surface_phase_id: f32, row_phase_id: f32, gas_fraction: f32, solid_fraction: f32) -> f32 {
  let gas = clamp(gas_fraction, 0.0, 1.0);
  let solid = clamp(solid_fraction, 0.0, 1.0);
  let liquid = clamp(1.0 - gas - solid, 0.0, 1.0);
  if (surface_phase_id == 1.0) { return solid; }
  if (surface_phase_id == 2.0) { return liquid; }
  if (surface_phase_id == 3.0) { return gas; }
  return select(0.0, 1.0, row_phase_id == surface_phase_id);
}

// Optical ownership partitions existing mass; it never mutates physics or
// removes an unrelated carrier. Subtract dispersed / total mass from the phase
// fraction (not a multiplicative discount of that fraction) for mixed phases.
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

	fn product_event_row0(event_index: u32) -> vec4<f32> {
	  return product_events[event_index * 8u];
	}

	fn product_event_row1(event_index: u32) -> vec4<f32> {
	  return product_events[event_index * 8u + 1u];
	}

	fn product_event_row2(event_index: u32) -> vec4<f32> {
	  return product_events[event_index * 8u + 2u];
	}

	fn product_event_row3(event_index: u32) -> vec4<f32> {
	  return product_events[event_index * 8u + 3u];
	}

	fn product_event_row4(event_index: u32) -> vec4<f32> {
	  return product_events[event_index * 8u + 4u];
	}

fn smooth_palette_weight(ratio: f32) -> f32 {
  let t = clamp(ratio, 0.0, 1.0);
  return 1.0 - t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
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

const RENDER_FIELD_F32_FINITE_MAX: f32 = 3.402823466e+38;
const RENDER_FIELD_F32_MIN_NORMAL: f32 = 1.175494351e-38;

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
  return RenderFieldPositiveF32Scale(
    mantissa,
    base_exponent,
    1u,
    0u
  );
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

fn render_field_positive_scale_value(
  scale: RenderFieldPositiveF32Scale
) -> f32 {
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
  if (
    sample == 0.0
    || !(sample == sample)
    || abs(sample) > RENDER_FIELD_F32_FINITE_MAX
  ) {
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

fn render_field_signed_scale_sum(
  state: RenderFieldSignedF32ScaleAccumulator
) -> f32 {
  let comparison = render_field_compare_positive_scales(
    state.positive,
    state.negative
  );
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

// Accumulate numerator (temperature * extinction) and denominator
// independently as normalized mantissa/exponent scales. This retains both
// unequal high-dynamic-range weights and tiny weights whose large temperature
// can still make a representable contribution.
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
  let next_weight = render_field_add_positive_scales(
    state.weight,
    sample_scale
  );
  let finite_sample = clamp(sample, 0.0, RENDER_FIELD_F32_FINITE_MAX);
  let temperature_scale = render_field_decompose_f32_magnitude(finite_sample);
  if (temperature_scale.nonzero == 0u) {
    return RenderFieldWeightedTemperatureAccumulator(
      next_weight,
      state.weighted_temperature
    );
  }
  return RenderFieldWeightedTemperatureAccumulator(
    next_weight,
    render_field_add_positive_scales(
      state.weighted_temperature,
      render_field_multiply_positive_scales(
        sample_scale,
        temperature_scale
      )
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

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let cell_index = global_id.x;
  let surface_index = global_id.y;
  if (surface_index >= params.surface_count) {
    return;
  }

  let s0 = surface_row0(surface_index);
  let s1 = surface_row1(surface_index);
  let s2 = surface_row2(surface_index);
  let s3 = surface_row3(surface_index);
  let field_offset = u32(s0.z);
  let field_cell_count = u32(s0.w);
  if (cell_index >= field_cell_count) {
    return;
  }
  let out_index = field_offset + cell_index;
  if (out_index >= params.total_field_cells) {
    return;
  }
  // Product history and particle rows form one visible step. A pending,
  // failed, forged, or mismatched history view invalidates the whole step:
  // zero both rows explicitly so a caller-owned pooled output cannot retain a
  // stale frame, and do so before reading either source family.
  if (!render_product_history_ready()) {
    render_field_cells[out_index * 2u] = vec4<f32>(0.0);
    render_field_cells[out_index * 2u + 1u] = vec4<f32>(0.0);
${motionField ? '    render_motion_field[out_index] = vec4<f32>(0.0);' : ''}
    return;
  }
  let authenticated_product_event_count = render_product_event_count();

  let resolution = max(u32(s1.x), 1u);
  let xy_count = resolution * resolution;
  let z = cell_index / xy_count;
  let rem = cell_index - z * xy_count;
  let y = rem / resolution;
  let x = rem - y * resolution;
  let inv_resolution = 1.0 / f32(resolution);
  let cell = vec3<f32>(
    f32(x) * inv_resolution,
    f32(y) * inv_resolution,
    f32(z) * inv_resolution
  );

  let material_id = s0.x;
  let phase_id = s0.y;
  let render_domain_id = max(s3.x, 0.0);
  let subtract = max(s1.z, 1.0e-12);
  let strength = s1.w;
  let support_norm = sqrt(abs(strength) / subtract);
  // Render-field ABI v1 uses negative surface row2.x as the mode sentinel for
  // retained per-particle radius. Positive values keep the legacy radiusNorm
  // behavior inside v1; v0 consumers must reject the v1 schema. The
  // surface-wide strength remains the product-event fallback.
  let particle_radius_scale = select(0.0, -s2.x, s2.x < 0.0);
  let color = vec3<f32>(s2.y, s2.z, s2.w);
  let span = 1.0 - 2.0 * params.field_padding;
  let ref_edge = max(params.ref_edge_m, 1.0e-12);
  let particle_radius_norm_scale = particle_radius_scale * span / ref_edge;
  // Conservative sparse voxel proxy for an under-resolved physical radius.
  // sqrt(3/(4N^2) + kernel epsilon) is the tight interior 3-D point-sampling
  // bound. It prevents an all-negative field without claiming exact geometry.
  let particle_radius_floor_norm = select(
    0.0,
    sqrt(0.75 * inv_resolution * inv_resolution + 0.000001),
    particle_radius_scale > 0.0
  );
  var density = 0.0;
  var palette = vec3<f32>(0.0, 0.0, 0.0);
  // Density-weighted particle temperature for per-fragment emission. Product
  // event row4.x is not yet closure-resolved from product_u for every route,
  // so treating it as authoritative here could invent visible heat.
  var temperature_weighted = 0.0;
  var temperature_weight = 0.0;
  // Positive optical-state surfaces are reserved as exclusive
  // collective-medium routes even before an authenticated sidecar is enabled.
  // No ready match means an empty surface, never a fallback copy of carrier
  // geometry. Ordinary material surfaces use opticalStateId 0.
  let dispersed_surface_active = s3.y > 0.0;
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
  // Frame-indifferent (objective) velocity moments (weights = positive metaball
  // values) for the splash-shard smear correction: removes BOTH rigid-body
  // translation AND rigid-body rotation (v = v_cm + omega x r) via local 3x3
  // inertia-tensor projection, so spinning rigid solids have sigma_v^2 = 0
  // while genuinely diverging splash shards retain full smear correction.
  let cell_world_m = (cell - vec3<f32>(params.field_padding)) * (ref_edge / max(span, 1.0e-9));
  var velocity_weighted = vec3<f32>(0.0, 0.0, 0.0);
  var velocity_sq_weighted = 0.0;
  var rel_pos_weighted = vec3<f32>(0.0, 0.0, 0.0);
  var rel_pos_cross_v_weighted = vec3<f32>(0.0, 0.0, 0.0);
  var rel_pos_outer_diag = vec3<f32>(0.0, 0.0, 0.0);
  var rel_pos_outer_off = vec3<f32>(0.0, 0.0, 0.0);
	  for (var particle_index = 0u; particle_index < params.particle_count; particle_index = particle_index + 1u) {
    let row0 = render_row0(particle_index);
    let row1 = render_row1(particle_index);
    let row2 = render_row2(particle_index);
    let row3 = render_row3(particle_index);
    if (params.dispersed_medium_enabled != 0u) {
      let dispersed = dispersed_medium_optics_rows[particle_index];
      if (
        sph_dispersed_medium_optics_row_is_ready(dispersed)
        && dispersed.optical_state_id > 0.0
        && dispersed.optical_state_id == s3.y
      ) {
        // optical_state_id is the exact collective-medium surface route.
        // The constituent material/phase intentionally remain independent of
        // both this surface and the aligned carrier particle.
        let dispersed_particle = vec3<f32>(
          clamp(params.field_padding + (row0.x / ref_edge) * span, 0.001, 0.999),
          clamp(params.field_padding + (row0.y / ref_edge) * span, 0.001, 0.999),
          clamp(params.field_padding + (row0.z / ref_edge) * span, 0.001, 0.999)
        );
        let cell_weight = render_field_cic_axis_weight(x, dispersed_particle.x, resolution)
          * render_field_cic_axis_weight(y, dispersed_particle.y, resolution)
          * render_field_cic_axis_weight(z, dispersed_particle.z, resolution);
        if (cell_weight > 0.0) {
          // Deposit each extensive cross-section with a conservative
          // particle-to-grid cloud-in-cell kernel. Dividing by the physical
          // cell face area yields dimensionless optical depth through that
          // cell; the marching-cubes threshold is therefore tau = 1 rather
          // than a material-specific opacity knob.
          // Evaluate sigma * weight / edge^2 as two ordered inverse-edge
          // products. Squaring edge can overflow for a very large domain and
          // squaring its inverse can underflow before sigma rescales it; this
          // ordering keeps every representable final optical depth finite.
          let inverse_cell_edge_per_m = min(
            RENDER_FIELD_F32_FINITE_MAX,
            (span * f32(resolution)) / ref_edge
          );
          let scattering_optical_depth = render_field_balanced_optical_product(
            dispersed.scattering_cross_section_m2,
            cell_weight,
            inverse_cell_edge_per_m
          );
          let absorption_optical_depth = render_field_balanced_optical_product(
            dispersed.absorption_cross_section_m2,
            cell_weight,
            inverse_cell_edge_per_m
          );
          let asymmetry_optical_depth = render_field_balanced_signed_optical_product(
            dispersed.scattering_asymmetry_cross_section_m2,
            cell_weight,
            inverse_cell_edge_per_m
          );
          dispersed_scattering_optical_depth = render_field_saturating_nonnegative_add(
            dispersed_scattering_optical_depth,
            scattering_optical_depth
          );
          dispersed_absorption_optical_depth = render_field_saturating_nonnegative_add(
            dispersed_absorption_optical_depth,
            absorption_optical_depth
          );
          dispersed_scattering_asymmetry = render_field_accumulate_signed_scale(
            dispersed_scattering_asymmetry,
            asymmetry_optical_depth
          );
          // Keep scattering and absorption as separate extensive weights so
          // max+max does not clip before the balanced temperature accumulator.
          dispersed_temperature = render_field_accumulate_weighted_temperature(
            dispersed_temperature,
            row1.z,
            scattering_optical_depth
          );
          dispersed_temperature = render_field_accumulate_weighted_temperature(
            dispersed_temperature,
            row1.z,
            absorption_optical_depth
          );
        }
      } else if (
        dispersed_surface_active
        && row0.w > 0.0
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
              // Nucleated sub-micron condensate fog droplets suspended in wet vapor
              // at the Lorenz-Mie first interference maximum (r_32 = 0.45 um, Q_sca = 3.8, g = 0.72).
              let companion_rho = select(1000.0, render_row1(companion_index).w, render_row1(companion_index).w > 100.0);
              let mist_mass_kg = row0.w * suspended_condensate_fraction;
              let mist_scattering_m2 = (0.75 * 3.8 * mist_mass_kg) / (companion_rho * 0.45e-6);
              let inverse_cell_edge_per_m = min(
                RENDER_FIELD_F32_FINITE_MAX,
                (span * f32(resolution)) / ref_edge
              );
              let scattering_optical_depth = render_field_balanced_optical_product(
                mist_scattering_m2,
                cell_weight,
                inverse_cell_edge_per_m
              );
              let asymmetry_optical_depth = render_field_balanced_signed_optical_product(
                0.72 * mist_scattering_m2,
                cell_weight,
                inverse_cell_edge_per_m
              );
              dispersed_scattering_optical_depth = render_field_saturating_nonnegative_add(
                dispersed_scattering_optical_depth,
                scattering_optical_depth
              );
              dispersed_scattering_asymmetry = render_field_accumulate_signed_scale(
                dispersed_scattering_asymmetry,
                asymmetry_optical_depth
              );
              dispersed_temperature = render_field_accumulate_weighted_temperature(
                dispersed_temperature,
                row1.z,
                scattering_optical_depth
              );
            }
          }
        }
      }
    }
    // A positive optical-state surface is an exclusive collective-medium
    // route. Once the authenticated sidecar path has been considered, do not
    // also execute legacy carrier metaball/temperature/velocity math that the
    // CPU reference deliberately bypasses for this surface.
    if (dispersed_surface_active) {
      continue;
    }
    if (
      row1.x != material_id
      || (render_domain_id > 0.0 && row2.w != render_domain_id)
    ) {
      continue;
    }
    let row4 = render_row4(particle_index);
    let phase_weight = render_bulk_phase_weight(
      particle_index, material_id, phase_id, row0.w,
      render_phase_weight(phase_id, row1.y, row2.y, row4.x)
    );
    if (phase_weight <= 0.0) {
      continue;
    }
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
    let particle_strength = phase_partitioned_metaball_strength(
      full_particle_strength,
      phase_weight,
      s1.y,
      subtract
    );
    let particle_support_norm = metaball_support_norm(particle_strength, subtract);
    let value = particle_strength / (0.000001 + dist2) - subtract;
    if (value > 0.0) {
      density = density + value;
      let ratio = sqrt(dist2) / max(particle_support_norm, 1.0e-6);
      palette = palette + color * smooth_palette_weight(ratio);
      temperature_weighted = temperature_weighted + row1.z * value;
      temperature_weight = temperature_weight + value;
      let particle_velocity = row4.yzw;
      let rel_pos_m = row0.xyz - cell_world_m;
      velocity_weighted = velocity_weighted + particle_velocity * value;
      velocity_sq_weighted = velocity_sq_weighted + dot(particle_velocity, particle_velocity) * value;
      rel_pos_weighted = rel_pos_weighted + rel_pos_m * value;
      rel_pos_cross_v_weighted = rel_pos_cross_v_weighted + cross(rel_pos_m, particle_velocity) * value;
      rel_pos_outer_diag = rel_pos_outer_diag + (rel_pos_m * rel_pos_m) * value;
      rel_pos_outer_off = rel_pos_outer_off + vec3<f32>(
        rel_pos_m.x * rel_pos_m.y,
        rel_pos_m.x * rel_pos_m.z,
        rel_pos_m.y * rel_pos_m.z
      ) * value;
    }
  }

${motionField ? `  // Snapshot the matching, pre-smear particle moments. Product events have
  // no retained velocity; exclusive collective optical routes bypass the
  // particle gather and therefore remain zero here. Empty cells are zero too.
  // Interpolate all four lanes together, then divide xyz by the valid weight.
  render_motion_field[out_index] = vec4<f32>(velocity_weighted, temperature_weight);
` : ''}
  let dispersed_scattering_asymmetry_optical_depth = clamp(
    render_field_signed_scale_sum(dispersed_scattering_asymmetry),
    -dispersed_scattering_optical_depth,
    dispersed_scattering_optical_depth
  );

  if (dispersed_surface_active) {
    let dispersed_total_optical_depth = render_field_saturating_nonnegative_add(
      dispersed_scattering_optical_depth,
      dispersed_absorption_optical_depth
    );
    density = render_field_saturating_nonnegative_product(
      max(s1.y, 0.0),
      dispersed_total_optical_depth
    );
    palette = select(vec3<f32>(0.0), color, dispersed_total_optical_depth > 0.0);
    temperature_weighted = 0.0;
    temperature_weight = f32(dispersed_temperature.weight.nonzero);
  }

  // Splash-shard smear correction: mass in a dispersing cell spreads over
  // L = sigma_v * render_smear_dt between refreshes, so each contribution is
  // re-sampled at the smeared distance (dist2 + L^2, in normalized field
  // units). Coherent cells (sigma_v ~ 0) skip the pass entirely, keeping
  // solids, resting pools, and single-particle cohorts bit-exact; the guard
  // threshold is fp-noise scale (L < 1e-5 of the field edge), not a tunable.
  if (!dispersed_surface_active && temperature_weight > 0.0 && params.render_smear_dt_s > 0.0) {
    let inv_w = 1.0 / temperature_weight;
    let mean_velocity = velocity_weighted * inv_w;
    let raw_dispersion_sq = max(0.0, velocity_sq_weighted * inv_w - dot(mean_velocity, mean_velocity));
    // Project out local rigid-body angular velocity omega solving J * omega = L
    // so pure rigid rotation produces zero smear (objectivity / frame indifference).
    let mean_r = rel_pos_weighted * inv_w;
    let ang_mom = rel_pos_cross_v_weighted * inv_w - cross(mean_r, mean_velocity);
    let cxx = max(0.0, rel_pos_outer_diag.x * inv_w - mean_r.x * mean_r.x);
    let cyy = max(0.0, rel_pos_outer_diag.y * inv_w - mean_r.y * mean_r.y);
    let czz = max(0.0, rel_pos_outer_diag.z * inv_w - mean_r.z * mean_r.z);
    let cxy = rel_pos_outer_off.x * inv_w - mean_r.x * mean_r.y;
    let cxz = rel_pos_outer_off.y * inv_w - mean_r.x * mean_r.z;
    let cyz = rel_pos_outer_off.z * inv_w - mean_r.y * mean_r.z;
    let trace_c = cxx + cyy + czz;
    var rigid_rot_sq = 0.0;
    if (trace_c > 1.0e-12 && dot(ang_mom, ang_mom) > 1.0e-24) {
      let reg = max(trace_c * 1.0e-6, 1.0e-12);
      let j00 = cyy + czz + reg;
      let j11 = cxx + czz + reg;
      let j22 = cxx + cyy + reg;
      let j01 = -cxy;
      let j02 = -cxz;
      let j12 = -cyz;
      let c00 = j11 * j22 - j12 * j12;
      let c01 = j02 * j12 - j01 * j22;
      let c02 = j01 * j12 - j02 * j11;
      let c11 = j00 * j22 - j02 * j02;
      let c12 = j01 * j02 - j00 * j12;
      let c22 = j00 * j11 - j01 * j01;
      let det = j00 * c00 + j01 * c01 + j02 * c02;
      if (abs(det) > 1.0e-24) {
        let inv_det = 1.0 / det;
        let omega = vec3<f32>(
          (c00 * ang_mom.x + c01 * ang_mom.y + c02 * ang_mom.z) * inv_det,
          (c01 * ang_mom.x + c11 * ang_mom.y + c12 * ang_mom.z) * inv_det,
          (c02 * ang_mom.x + c12 * ang_mom.y + c22 * ang_mom.z) * inv_det
        );
        rigid_rot_sq = max(0.0, dot(omega, ang_mom));
      }
    }
    let dispersion_sq_ms = max(0.0, raw_dispersion_sq - rigid_rot_sq);
    let smear_norm = sqrt(dispersion_sq_ms) * params.render_smear_dt_s * span / ref_edge;
    let smear_sq = smear_norm * smear_norm;
    if (smear_sq > 1.0e-10) {
      var corrected_density = 0.0;
      var corrected_palette = vec3<f32>(0.0, 0.0, 0.0);
      var corrected_temperature_weighted = 0.0;
      var corrected_temperature_weight = 0.0;
	      for (var particle_index = 0u; particle_index < params.particle_count; particle_index = particle_index + 1u) {
        let row0 = render_row0(particle_index);
        let row1 = render_row1(particle_index);
        let row2 = render_row2(particle_index);
        let row3 = render_row3(particle_index);
        if (
          row1.x != material_id
          || (render_domain_id > 0.0 && row2.w != render_domain_id)
        ) {
          continue;
        }
        let phase_weight = render_bulk_phase_weight(
          particle_index, material_id, phase_id, row0.w,
          render_phase_weight(phase_id, row1.y, row2.y, render_row4(particle_index).x)
        );
        if (phase_weight <= 0.0) {
          continue;
        }
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
        let particle_strength = phase_partitioned_metaball_strength(
          full_particle_strength,
          phase_weight,
          s1.y,
          subtract
        );
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
      density = corrected_density;
      palette = corrected_palette;
      temperature_weighted = corrected_temperature_weighted;
      temperature_weight = corrected_temperature_weight;
    }
  }

	  for (var event_index = 0u; !dispersed_surface_active && event_index < authenticated_product_event_count; event_index = event_index + 1u) {
	    let event0 = product_event_row0(event_index);
	    let event1 = product_event_row1(event_index);
	    let event2 = product_event_row2(event_index);
	    let event3 = product_event_row3(event_index);
	    let event4 = product_event_row4(event_index);
	    let event_material_id = event1.x;
	    let event_phase_id = event2.w;
	    let event_unplaced_mass_kg = event3.y;
	    let event_status = event4.z;
	    if (
	      event_status != 1.0
	      || event_unplaced_mass_kg <= 0.0
	      || event_material_id != material_id
	      || (event_phase_id > 0.0 && event_phase_id != phase_id)
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

  let mean_temperature_k = select(
    select(0.0, temperature_weighted / max(temperature_weight, 1.0e-6), temperature_weight > 0.0),
    render_field_divide_positive_scales(
      dispersed_temperature.weighted_temperature,
      dispersed_temperature.weight
    ),
    dispersed_surface_active
  );
  render_field_cells[out_index * 2u] = vec4<f32>(density, palette);
  render_field_cells[out_index * 2u + 1u] = vec4<f32>(
    mean_temperature_k,
    dispersed_scattering_optical_depth,
    dispersed_absorption_optical_depth,
    dispersed_scattering_asymmetry_optical_depth
  );
}
`;

}

export const sphRenderFieldWgsl = createSphRenderFieldWgsl();
export const sphRenderFieldMotionWgsl = createSphRenderFieldWgsl({ motionField: true });

export const sphMaterialInterfaceCandidatesWgsl = `
struct InterfaceCandidateParams {
  surface_count: u32,
  total_field_cells: u32,
  candidate_count: u32,
  source_key_enabled: u32,
  field_padding: f32,
  ref_edge_m: f32,
  isolation_scale: f32,
  _pad1: f32,
};

@group(0) @binding(0) var<storage, read> render_surfaces: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> render_field_cells: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> interface_candidates: array<vec4<f32>>;
@group(0) @binding(3) var<uniform> params: InterfaceCandidateParams;

fn surface_row0(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u];
}

fn surface_row1(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u + 1u];
}

fn field_index_3d(x: u32, y: u32, z: u32, resolution: u32) -> u32 {
  return z * resolution * resolution + y * resolution + x;
}

fn write_candidate(candidate_index: u32, row0: vec4<f32>, row1: vec4<f32>, row2: vec4<f32>, row3: vec4<f32>) {
  if (candidate_index >= params.candidate_count) {
    return;
  }
  let base = candidate_index * 4u;
  interface_candidates[base] = row0;
  interface_candidates[base + 1u] = row1;
  interface_candidates[base + 2u] = row2;
  interface_candidates[base + 3u] = row3;
}

fn physical_coord_m(coord: f32, resolution: u32) -> f32 {
  let span = max(1.0e-12, 1.0 - 2.0 * params.field_padding);
  return ((((coord + 0.5) / f32(resolution)) - params.field_padding) * max(params.ref_edge_m, 1.0e-12)) / span;
}

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let local_candidate_index = global_id.x;
  let surface_index = global_id.y;
  if (surface_index >= params.surface_count) {
    return;
  }

  let s0 = surface_row0(surface_index);
  let s1 = surface_row1(surface_index);
  let field_offset = u32(s0.z);
  let field_cell_count = u32(s0.w);
  let cell_index = local_candidate_index / 3u;
  let axis = local_candidate_index - cell_index * 3u;
  if (cell_index >= field_cell_count) {
    return;
  }

  let candidate_index = field_offset * 3u + local_candidate_index;
  let base_row0 = vec4<f32>(f32(surface_index), s0.x, s0.y, f32(axis));
  write_candidate(
    candidate_index,
    base_row0,
    vec4<f32>(0.0, 0.0, 0.0, 0.0),
    vec4<f32>(0.0, 0.0, 0.0, 0.0),
    vec4<f32>(0.0, 0.0, 0.0, 0.0)
  );

  let resolution = max(u32(s1.x), 1u);
  let xy_count = resolution * resolution;
  let z = cell_index / xy_count;
  let rem = cell_index - z * xy_count;
  let y = rem / resolution;
  let x = rem - y * resolution;

  var nx = x;
  var ny = y;
  var nz = z;
  if (axis == 0u) {
    nx = x + 1u;
  } else if (axis == 1u) {
    ny = y + 1u;
  } else {
    nz = z + 1u;
  }
  if (nx >= resolution || ny >= resolution || nz >= resolution) {
    return;
  }

  let value = render_field_cells[(field_offset + cell_index) * 2u].x;
  let neighbor = render_field_cells[(field_offset + field_index_3d(nx, ny, nz, resolution)) * 2u].x;
  let isolation = s1.y * params.isolation_scale;
  let inside = value >= isolation;
  let neighbor_inside = neighbor >= isolation;
  if (inside == neighbor_inside) {
    return;
  }

  var sign = -1.0;
  if (inside) {
    sign = 1.0;
  }
  var normal = vec3<f32>(0.0, 0.0, 0.0);
  if (axis == 0u) {
    normal.x = sign;
  } else if (axis == 1u) {
    normal.y = sign;
  } else {
    normal.z = sign;
  }

  let span = max(1.0e-12, 1.0 - 2.0 * params.field_padding);
  let cell_size_m = max(params.ref_edge_m, 1.0e-12) / (span * f32(resolution));
  let area_m2 = cell_size_m * cell_size_m;
  let centroid = vec3<f32>(
    physical_coord_m((f32(x) + f32(nx)) * 0.5, resolution),
    physical_coord_m((f32(y) + f32(ny)) * 0.5, resolution),
    physical_coord_m((f32(z) + f32(nz)) * 0.5, resolution)
  );
  let normal_area = normal * area_m2;
  write_candidate(
    candidate_index,
    base_row0,
    vec4<f32>(centroid, area_m2),
    vec4<f32>(normal, normal_area.x),
    vec4<f32>(normal_area.y, normal_area.z, sign, 1.0)
  );
}
`;

export const sphMaterialInterfaceCompactCandidatesWgsl = `
struct InterfaceCandidateParams {
  surface_count: u32,
  total_field_cells: u32,
  candidate_count: u32,
  source_key_enabled: u32,
  field_padding: f32,
  ref_edge_m: f32,
  isolation_scale: f32,
  _pad1: f32,
};

@group(0) @binding(0) var<storage, read> render_surfaces: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> render_field_cells: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> interface_candidates: array<vec4<f32>>;
@group(0) @binding(3) var<uniform> params: InterfaceCandidateParams;
@group(0) @binding(4) var<storage, read_write> compact_metadata: array<atomic<u32>>;
@group(0) @binding(5) var<storage, read_write> source_index_field: array<atomic<u32>>;
@group(0) @binding(6) var<storage, read_write> interface_source_keys: array<vec4<f32>>;

fn compact_surface_row0(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u];
}

fn compact_surface_row1(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u + 1u];
}

fn compact_field_index_3d(x: u32, y: u32, z: u32, resolution: u32) -> u32 {
  return z * resolution * resolution + y * resolution + x;
}

fn compact_write_candidate(
  row0: vec4<f32>,
  row1: vec4<f32>,
  row2: vec4<f32>,
  row3: vec4<f32>,
  source_field_index: u32
) {
  let compact_index = atomicAdd(&compact_metadata[0], 1u);
  let capacity = atomicLoad(&compact_metadata[2]);
  if (compact_index >= capacity) {
    atomicAdd(&compact_metadata[1], 1u);
    return;
  }
  let base = compact_index * 4u;
  interface_candidates[base] = row0;
  interface_candidates[base + 1u] = row1;
  interface_candidates[base + 2u] = row2;
  interface_candidates[base + 3u] = row3;
  var source_particle_index = 0.0;
  var key_status = 0.0;
  if (params.source_key_enabled != 0u && source_field_index < params.total_field_cells) {
    let packed_source_key = atomicLoad(&source_index_field[source_field_index]);
    if (packed_source_key > 0u) {
      source_particle_index = f32(packed_source_key - 1u);
      key_status = 1.0;
    }
  }
  interface_source_keys[compact_index] = vec4<f32>(
    f32(compact_index),
    source_particle_index,
    key_status,
    0.0
  );
}

fn compact_physical_coord_m(coord: f32, resolution: u32) -> f32 {
  let span = max(1.0e-12, 1.0 - 2.0 * params.field_padding);
  return ((((coord + 0.5) / f32(resolution)) - params.field_padding) * max(params.ref_edge_m, 1.0e-12)) / span;
}

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let local_candidate_index = global_id.x;
  let surface_index = global_id.y;
  if (surface_index >= params.surface_count) {
    return;
  }

  let s0 = compact_surface_row0(surface_index);
  let s1 = compact_surface_row1(surface_index);
  let field_offset = u32(s0.z);
  let field_cell_count = u32(s0.w);
  let cell_index = local_candidate_index / 3u;
  let axis = local_candidate_index - cell_index * 3u;
  if (cell_index >= field_cell_count) {
    return;
  }

  let resolution = max(u32(s1.x), 1u);
  let xy_count = resolution * resolution;
  let z = cell_index / xy_count;
  let rem = cell_index - z * xy_count;
  let y = rem / resolution;
  let x = rem - y * resolution;

  var nx = x;
  var ny = y;
  var nz = z;
  if (axis == 0u) {
    nx = x + 1u;
  } else if (axis == 1u) {
    ny = y + 1u;
  } else {
    nz = z + 1u;
  }
  if (nx >= resolution || ny >= resolution || nz >= resolution) {
    return;
  }

  let value = render_field_cells[(field_offset + cell_index) * 2u].x;
  let neighbor_cell_index = compact_field_index_3d(nx, ny, nz, resolution);
  let neighbor = render_field_cells[(field_offset + neighbor_cell_index) * 2u].x;
  let isolation = s1.y * params.isolation_scale;
  let inside = value >= isolation;
  let neighbor_inside = neighbor >= isolation;
  if (inside == neighbor_inside) {
    return;
  }

  var sign = -1.0;
  if (inside) {
    sign = 1.0;
  }
  var normal = vec3<f32>(0.0, 0.0, 0.0);
  if (axis == 0u) {
    normal.x = sign;
  } else if (axis == 1u) {
    normal.y = sign;
  } else {
    normal.z = sign;
  }

  let span = max(1.0e-12, 1.0 - 2.0 * params.field_padding);
  let cell_size_m = max(params.ref_edge_m, 1.0e-12) / (span * f32(resolution));
  let area_m2 = cell_size_m * cell_size_m;
  let centroid = vec3<f32>(
    compact_physical_coord_m((f32(x) + f32(nx)) * 0.5, resolution),
    compact_physical_coord_m((f32(y) + f32(ny)) * 0.5, resolution),
    compact_physical_coord_m((f32(z) + f32(nz)) * 0.5, resolution)
  );
  let normal_area = normal * area_m2;
  let source_field_index = field_offset + select(neighbor_cell_index, cell_index, inside);
  compact_write_candidate(
    vec4<f32>(f32(surface_index), s0.x, s0.y, f32(axis)),
    vec4<f32>(centroid, area_m2),
    vec4<f32>(normal, normal_area.x),
    vec4<f32>(normal_area.y, normal_area.z, sign, 1.0),
    source_field_index
  );
}
`;

export const sphRenderMarchingCubeCellsWgsl = `
struct MarchingCubesCandidateParams {
  surface_count: u32,
  total_field_cells: u32,
  candidate_count: u32,
  _pad0: u32,
  field_padding: f32,
  ref_edge_m: f32,
  isolation_scale: f32,
  _pad1: f32,
};

@group(0) @binding(0) var<storage, read> render_surfaces: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> render_field_cells: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> marching_cubes_candidates: array<vec4<f32>>;
@group(0) @binding(3) var<uniform> params: MarchingCubesCandidateParams;

fn mc_surface_row0(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u];
}

fn mc_surface_row1(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u + 1u];
}

fn mc_field_index_3d(x: u32, y: u32, z: u32, resolution: u32) -> u32 {
  return z * resolution * resolution + y * resolution + x;
}

fn mc_density(field_offset: u32, x: u32, y: u32, z: u32, resolution: u32) -> f32 {
  return render_field_cells[(field_offset + mc_field_index_3d(x, y, z, resolution)) * 2u].x;
}

fn mc_physical_coord_m(coord: f32, resolution: u32) -> f32 {
  let span = max(1.0e-12, 1.0 - 2.0 * params.field_padding);
  return (((coord / f32(resolution)) - params.field_padding) * max(params.ref_edge_m, 1.0e-12)) / span;
}

fn mc_edge_crossing(a: f32, b: f32, isolation: f32) -> u32 {
  if ((a >= isolation) != (b >= isolation)) {
    return 1u;
  }
  return 0u;
}

fn mc_write_candidate(candidate_index: u32, row0: vec4<f32>, row1: vec4<f32>, row2: vec4<f32>, row3: vec4<f32>) {
  if (candidate_index >= params.candidate_count) {
    return;
  }
  let base = candidate_index * 4u;
  marching_cubes_candidates[base] = row0;
  marching_cubes_candidates[base + 1u] = row1;
  marching_cubes_candidates[base + 2u] = row2;
  marching_cubes_candidates[base + 3u] = row3;
}

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let local_voxel_index = global_id.x;
  let surface_index = global_id.y;
  if (surface_index >= params.surface_count) {
    return;
  }

  let s0 = mc_surface_row0(surface_index);
  let s1 = mc_surface_row1(surface_index);
  let field_offset = u32(s0.z);
  let field_cell_count = u32(s0.w);
  let resolution = max(u32(s1.x), 1u);
  if (resolution <= 1u) {
    return;
  }

  let voxel_resolution = resolution - 1u;
  let voxel_xy_count = voxel_resolution * voxel_resolution;
  let voxel_count = voxel_xy_count * voxel_resolution;
  if (local_voxel_index >= voxel_count || local_voxel_index >= field_cell_count) {
    return;
  }

  let candidate_index = field_offset + local_voxel_index;
  let z = local_voxel_index / voxel_xy_count;
  let rem = local_voxel_index - z * voxel_xy_count;
  let y = rem / voxel_resolution;
  let x = rem - y * voxel_resolution;
  let isolation = s1.y * params.isolation_scale;

  let v0 = mc_density(field_offset, x, y, z, resolution);
  let v1 = mc_density(field_offset, x + 1u, y, z, resolution);
  let v2 = mc_density(field_offset, x + 1u, y + 1u, z, resolution);
  let v3 = mc_density(field_offset, x, y + 1u, z, resolution);
  let v4 = mc_density(field_offset, x, y, z + 1u, resolution);
  let v5 = mc_density(field_offset, x + 1u, y, z + 1u, resolution);
  let v6 = mc_density(field_offset, x + 1u, y + 1u, z + 1u, resolution);
  let v7 = mc_density(field_offset, x, y + 1u, z + 1u, resolution);

  var corner_mask = 0u;
  if (v0 >= isolation) { corner_mask = corner_mask | 1u; }
  if (v1 >= isolation) { corner_mask = corner_mask | 2u; }
  if (v2 >= isolation) { corner_mask = corner_mask | 4u; }
  if (v3 >= isolation) { corner_mask = corner_mask | 8u; }
  if (v4 >= isolation) { corner_mask = corner_mask | 16u; }
  if (v5 >= isolation) { corner_mask = corner_mask | 32u; }
  if (v6 >= isolation) { corner_mask = corner_mask | 64u; }
  if (v7 >= isolation) { corner_mask = corner_mask | 128u; }

  var edge_crossing_count = 0u;
  edge_crossing_count = edge_crossing_count + mc_edge_crossing(v0, v1, isolation);
  edge_crossing_count = edge_crossing_count + mc_edge_crossing(v1, v2, isolation);
  edge_crossing_count = edge_crossing_count + mc_edge_crossing(v2, v3, isolation);
  edge_crossing_count = edge_crossing_count + mc_edge_crossing(v3, v0, isolation);
  edge_crossing_count = edge_crossing_count + mc_edge_crossing(v4, v5, isolation);
  edge_crossing_count = edge_crossing_count + mc_edge_crossing(v5, v6, isolation);
  edge_crossing_count = edge_crossing_count + mc_edge_crossing(v6, v7, isolation);
  edge_crossing_count = edge_crossing_count + mc_edge_crossing(v7, v4, isolation);
  edge_crossing_count = edge_crossing_count + mc_edge_crossing(v0, v4, isolation);
  edge_crossing_count = edge_crossing_count + mc_edge_crossing(v1, v5, isolation);
  edge_crossing_count = edge_crossing_count + mc_edge_crossing(v2, v6, isolation);
  edge_crossing_count = edge_crossing_count + mc_edge_crossing(v3, v7, isolation);

  let cell_is_active = corner_mask != 0u && corner_mask != 255u;
  let reserved_triangle_count = select(0.0, 12.0, cell_is_active);
  let reserved_vertex_count = reserved_triangle_count * 3.0;
  let status = select(0.0, 1.0, cell_is_active);
  let span = max(1.0e-12, 1.0 - 2.0 * params.field_padding);
  let cell_size_m = max(params.ref_edge_m, 1.0e-12) / (span * f32(resolution));
  let center = vec3<f32>(
    mc_physical_coord_m(f32(x) + 0.5, resolution),
    mc_physical_coord_m(f32(y) + 0.5, resolution),
    mc_physical_coord_m(f32(z) + 0.5, resolution)
  );
  let density_min = min(min(min(v0, v1), min(v2, v3)), min(min(v4, v5), min(v6, v7)));
  let density_max = max(max(max(v0, v1), max(v2, v3)), max(max(v4, v5), max(v6, v7)));

  mc_write_candidate(
    candidate_index,
    vec4<f32>(f32(surface_index), s0.x, s0.y, f32(local_voxel_index)),
    vec4<f32>(center, cell_size_m),
    vec4<f32>(f32(corner_mask), f32(edge_crossing_count), reserved_triangle_count, reserved_vertex_count),
    vec4<f32>(density_min, density_max, isolation, status)
  );
}
`;

export const sphRenderFieldSurfaceSummaryWgsl = `
struct SurfaceSummaryParams {
  surface_count: u32,
  total_field_cells: u32,
  _pad0: u32,
  _pad1: u32,
  field_padding: f32,
  ref_edge_m: f32,
  isolation_scale: f32,
  _pad2: f32,
};

@group(0) @binding(0) var<storage, read> render_surfaces: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> render_field_cells: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> surface_summary_rows: array<vec4<f32>>;
@group(0) @binding(3) var<uniform> params: SurfaceSummaryParams;

fn ss_surface_row0(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u];
}

fn ss_surface_row1(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u + 1u];
}

fn ss_surface_row3(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u + 3u];
}

fn ss_field_index_3d(x: u32, y: u32, z: u32, resolution: u32) -> u32 {
  return z * resolution * resolution + y * resolution + x;
}

fn ss_physical_coord_m(coord: f32, resolution: u32) -> f32 {
  let span = max(1.0e-12, 1.0 - 2.0 * params.field_padding);
  return (((coord / f32(resolution)) - params.field_padding) * max(params.ref_edge_m, 1.0e-12)) / span;
}

@compute @workgroup_size(1, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let surface_index = global_id.x;
  if (surface_index >= params.surface_count) {
    return;
  }
  let row0 = ss_surface_row0(surface_index);
  let row1 = ss_surface_row1(surface_index);
  let row3 = ss_surface_row3(surface_index);
  let field_offset = u32(max(0.0, round(row0.z)));
  let field_cell_count = u32(max(0.0, round(row0.w)));
  let resolution = max(1u, u32(max(1.0, round(row1.x))));
  let isolation = max(0.0, row1.y * params.isolation_scale);
  let bounded_cell_count = min(field_cell_count, resolution * resolution * resolution);
  var active_cell_count = 0u;
  var max_density = 0.0;
  var min_pos = vec3<f32>(1.0e30, 1.0e30, 1.0e30);
  var max_pos = vec3<f32>(-1.0e30, -1.0e30, -1.0e30);
  for (var cell_index = 0u; cell_index < bounded_cell_count; cell_index = cell_index + 1u) {
    let density = render_field_cells[(field_offset + cell_index) * 2u].x;
    max_density = max(max_density, density);
    if (density >= isolation && density > 0.0) {
      let xy = resolution * resolution;
      let z = cell_index / xy;
      let rem = cell_index - z * xy;
      let y = rem / resolution;
      let x = rem - y * resolution;
      let pos = vec3<f32>(
        ss_physical_coord_m(f32(x), resolution),
        ss_physical_coord_m(f32(y), resolution),
        ss_physical_coord_m(f32(z), resolution)
      );
      min_pos = min(min_pos, pos);
      max_pos = max(max_pos, pos);
      active_cell_count = active_cell_count + 1u;
    }
  }
  let has_active_cells = active_cell_count > 0u;
  let min_active = select(vec3<f32>(0.0, 0.0, 0.0), min_pos, has_active_cells);
  let max_active = select(vec3<f32>(0.0, 0.0, 0.0), max_pos, has_active_cells);
  let center = select(vec3<f32>(0.0, 0.0, 0.0), (min_active + max_active) * 0.5, has_active_cells);
  let radius = select(0.0, length(max_active - center), has_active_cells);
  let cell_size_m = max(params.ref_edge_m, 1.0e-12)
    / max(1.0e-12, (1.0 - 2.0 * params.field_padding) * f32(resolution));
  let base = surface_index * 5u;
  surface_summary_rows[base] = vec4<f32>(f32(surface_index), row0.x, row0.y, row3.y);
  surface_summary_rows[base + 1u] = vec4<f32>(f32(active_cell_count), f32(active_cell_count), max_density, isolation);
  surface_summary_rows[base + 2u] = vec4<f32>(min_active, select(0.0, 1.0, has_active_cells));
  surface_summary_rows[base + 3u] = vec4<f32>(max_active, cell_size_m);
  surface_summary_rows[base + 4u] = vec4<f32>(center, radius);
}
`;

export const sphRenderSurfaceVerticesWgsl = `
struct SurfaceVertexParams {
  surface_count: u32,
  max_vertex_rows: u32,
  total_field_cells: u32,
  emission_mode: u32,
  field_padding: f32,
  ref_edge_m: f32,
  isolation_scale: f32,
  _pad1: f32,
};

struct SurfaceVertexCounter {
  vertex_count: atomic<u32>,
  overflow_count: atomic<u32>,
  _pad0: u32,
  _pad1: u32,
};

@group(0) @binding(0) var<storage, read> render_surfaces: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> render_field_cells: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> surface_vertices: array<vec4<f32>>;
@group(0) @binding(3) var<uniform> params: SurfaceVertexParams;
@group(0) @binding(4) var<storage, read_write> surface_vertex_counter: SurfaceVertexCounter;

fn sv_surface_row0(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u];
}

fn sv_surface_row1(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u + 1u];
}

fn sv_surface_row3(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u + 3u];
}

fn sv_field_index_3d(x: u32, y: u32, z: u32, resolution: u32) -> u32 {
  return z * resolution * resolution + y * resolution + x;
}

fn sv_density(field_offset: u32, x: u32, y: u32, z: u32, resolution: u32) -> f32 {
  return render_field_cells[(field_offset + sv_field_index_3d(x, y, z, resolution)) * 2u].x;
}

fn sv_physical_coord_m(coord: f32, resolution: u32) -> f32 {
  let span = max(1.0e-12, 1.0 - 2.0 * params.field_padding);
  return (((coord / f32(resolution)) - params.field_padding) * max(params.ref_edge_m, 1.0e-12)) / span;
}

fn sv_corner_position(corner: u32, x: u32, y: u32, z: u32, resolution: u32) -> vec3<f32> {
  var cx = x;
  var cy = y;
  var cz = z;
  if (corner == 1u || corner == 2u || corner == 5u || corner == 6u) { cx = x + 1u; }
  if (corner == 2u || corner == 3u || corner == 6u || corner == 7u) { cy = y + 1u; }
  if (corner >= 4u) { cz = z + 1u; }
  return vec3<f32>(
    sv_physical_coord_m(f32(cx), resolution),
    sv_physical_coord_m(f32(cy), resolution),
    sv_physical_coord_m(f32(cz), resolution)
  );
}

fn sv_corner_density(field_offset: u32, corner: u32, x: u32, y: u32, z: u32, resolution: u32) -> f32 {
  var cx = x;
  var cy = y;
  var cz = z;
  if (corner == 1u || corner == 2u || corner == 5u || corner == 6u) { cx = x + 1u; }
  if (corner == 2u || corner == 3u || corner == 6u || corner == 7u) { cy = y + 1u; }
  if (corner >= 4u) { cz = z + 1u; }
  return sv_density(field_offset, cx, cy, cz, resolution);
}

fn sv_tetra_corner(tetra_index: u32, slot: u32) -> u32 {
  if (tetra_index == 0u) {
    if (slot == 0u) { return 0u; }
    if (slot == 1u) { return 5u; }
    if (slot == 2u) { return 1u; }
    return 6u;
  }
  if (tetra_index == 1u) {
    if (slot == 0u) { return 0u; }
    if (slot == 1u) { return 1u; }
    if (slot == 2u) { return 2u; }
    return 6u;
  }
  if (tetra_index == 2u) {
    if (slot == 0u) { return 0u; }
    if (slot == 1u) { return 2u; }
    if (slot == 2u) { return 3u; }
    return 6u;
  }
  if (tetra_index == 3u) {
    if (slot == 0u) { return 0u; }
    if (slot == 1u) { return 3u; }
    if (slot == 2u) { return 7u; }
    return 6u;
  }
  if (tetra_index == 4u) {
    if (slot == 0u) { return 0u; }
    if (slot == 1u) { return 7u; }
    if (slot == 2u) { return 4u; }
    return 6u;
  }
  if (slot == 0u) { return 0u; }
  if (slot == 1u) { return 4u; }
  if (slot == 2u) { return 5u; }
  return 6u;
}

fn sv_interpolate(a: vec3<f32>, b: vec3<f32>, value_a: f32, value_b: f32, isolation: f32) -> vec3<f32> {
  let denom = value_b - value_a;
  let t = select(0.5, clamp((isolation - value_a) / denom, 0.0, 1.0), abs(denom) > 1.0e-12);
  return a + (b - a) * t;
}

fn sv_triangle_normal(a: vec3<f32>, b: vec3<f32>, c: vec3<f32>) -> vec3<f32> {
  let n = cross(b - a, c - a);
  let len = length(n);
  if (len <= 1.0e-12) {
    return vec3<f32>(0.0, 0.0, 0.0);
  }
  return n / len;
}

fn sv_write_vertex(
  row_index: u32,
  surface_index: u32,
  material_id: f32,
  phase_id: f32,
  triangle_index: u32,
  vertex_index: u32,
  position: vec3<f32>,
  normal: vec3<f32>,
  optical_state_id: f32,
  density: f32,
  isolation: f32,
  source_voxel_index: u32
) {
  if (row_index >= params.max_vertex_rows) {
    return;
  }
  let base = row_index * 4u;
  surface_vertices[base] = vec4<f32>(f32(surface_index), material_id, phase_id, f32(triangle_index));
  surface_vertices[base + 1u] = vec4<f32>(f32(vertex_index), position.x, position.y, position.z);
  surface_vertices[base + 2u] = vec4<f32>(normal.x, normal.y, normal.z, optical_state_id);
  surface_vertices[base + 3u] = vec4<f32>(density, isolation, f32(source_voxel_index), 1.0);
}

fn sv_emit_triangle(
  base_vertex_row: u32,
  local_vertex_offset: u32,
  surface_index: u32,
  material_id: f32,
  phase_id: f32,
  optical_state_id: f32,
  source_voxel_index: u32,
  isolation: f32,
  outward_hint: vec3<f32>,
  a: vec3<f32>,
  b: vec3<f32>,
  c: vec3<f32>
) -> u32 {
  if (local_vertex_offset + 2u >= 36u) {
    return local_vertex_offset;
  }
  var va = a;
  var vb = b;
  var vc = c;
  var normal = sv_triangle_normal(va, vb, vc);
  if (dot(normal, outward_hint) < 0.0) {
    vb = c;
    vc = b;
    normal = sv_triangle_normal(va, vb, vc);
  }
  var write_base = base_vertex_row + local_vertex_offset;
  if (params.emission_mode == 1u) {
    write_base = atomicAdd(&surface_vertex_counter.vertex_count, 3u);
  }
  if (write_base + 2u >= params.max_vertex_rows) {
    if (params.emission_mode == 1u) {
      atomicAdd(&surface_vertex_counter.overflow_count, 3u);
    }
    return local_vertex_offset + 3u;
  }
  let triangle_index = write_base / 3u;
  sv_write_vertex(write_base, surface_index, material_id, phase_id, triangle_index, 0u, va, normal, optical_state_id, isolation, isolation, source_voxel_index);
  sv_write_vertex(write_base + 1u, surface_index, material_id, phase_id, triangle_index, 1u, vb, normal, optical_state_id, isolation, isolation, source_voxel_index);
  sv_write_vertex(write_base + 2u, surface_index, material_id, phase_id, triangle_index, 2u, vc, normal, optical_state_id, isolation, isolation, source_voxel_index);
  return local_vertex_offset + 3u;
}

fn sv_emit_tetra(
  tetra_index: u32,
  base_vertex_row: u32,
  local_vertex_offset: u32,
  surface_index: u32,
  material_id: f32,
  phase_id: f32,
  optical_state_id: f32,
  field_offset: u32,
  x: u32,
  y: u32,
  z: u32,
  resolution: u32,
  source_voxel_index: u32,
  isolation: f32
) -> u32 {
  var inside: array<u32, 4>;
  var outside: array<u32, 4>;
  var inside_count = 0u;
  var outside_count = 0u;
  for (var slot = 0u; slot < 4u; slot = slot + 1u) {
    let corner = sv_tetra_corner(tetra_index, slot);
    let density = sv_corner_density(field_offset, corner, x, y, z, resolution);
    if (density >= isolation) {
      inside[inside_count] = corner;
      inside_count = inside_count + 1u;
    } else {
      outside[outside_count] = corner;
      outside_count = outside_count + 1u;
    }
  }
  if (inside_count == 0u || inside_count == 4u) {
    return local_vertex_offset;
  }
  var offset = local_vertex_offset;
  if (inside_count == 1u || inside_count == 3u) {
    let source = select(outside[0], inside[0], inside_count == 1u);
    let target0 = select(inside[0], outside[0], inside_count == 1u);
    let target1 = select(inside[1], outside[1], inside_count == 1u);
    let target2 = select(inside[2], outside[2], inside_count == 1u);
    let ps = sv_corner_position(source, x, y, z, resolution);
    let vs = sv_corner_density(field_offset, source, x, y, z, resolution);
    let p0 = sv_interpolate(ps, sv_corner_position(target0, x, y, z, resolution), vs, sv_corner_density(field_offset, target0, x, y, z, resolution), isolation);
    let p1 = sv_interpolate(ps, sv_corner_position(target1, x, y, z, resolution), vs, sv_corner_density(field_offset, target1, x, y, z, resolution), isolation);
    let p2 = sv_interpolate(ps, sv_corner_position(target2, x, y, z, resolution), vs, sv_corner_density(field_offset, target2, x, y, z, resolution), isolation);
    let target_center = (
      sv_corner_position(target0, x, y, z, resolution)
      + sv_corner_position(target1, x, y, z, resolution)
      + sv_corner_position(target2, x, y, z, resolution)
    ) / 3.0;
    let outward_hint = select(ps - target_center, target_center - ps, inside_count == 1u);
    offset = sv_emit_triangle(base_vertex_row, offset, surface_index, material_id, phase_id, optical_state_id, source_voxel_index, isolation, outward_hint, p0, p1, p2);
    return offset;
  }

  let inside_a = inside[0];
  let inside_b = inside[1];
  let outside_a = outside[0];
  let outside_b = outside[1];
  let pia = sv_corner_position(inside_a, x, y, z, resolution);
  let pib = sv_corner_position(inside_b, x, y, z, resolution);
  let poa = sv_corner_position(outside_a, x, y, z, resolution);
  let pob = sv_corner_position(outside_b, x, y, z, resolution);
  let via = sv_corner_density(field_offset, inside_a, x, y, z, resolution);
  let vib = sv_corner_density(field_offset, inside_b, x, y, z, resolution);
  let voa = sv_corner_density(field_offset, outside_a, x, y, z, resolution);
  let vob = sv_corner_density(field_offset, outside_b, x, y, z, resolution);
  let edge_a0 = sv_interpolate(pia, poa, via, voa, isolation);
  let edge_a1 = sv_interpolate(pia, pob, via, vob, isolation);
  let edge_b0 = sv_interpolate(pib, poa, vib, voa, isolation);
  let edge_b1 = sv_interpolate(pib, pob, vib, vob, isolation);
  let outward_hint = ((poa + pob) * 0.5) - ((pia + pib) * 0.5);
  offset = sv_emit_triangle(base_vertex_row, offset, surface_index, material_id, phase_id, optical_state_id, source_voxel_index, isolation, outward_hint, edge_a0, edge_a1, edge_b0);
  offset = sv_emit_triangle(base_vertex_row, offset, surface_index, material_id, phase_id, optical_state_id, source_voxel_index, isolation, outward_hint, edge_b0, edge_a1, edge_b1);
  return offset;
}

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let local_voxel_index = global_id.x;
  let surface_index = global_id.y;
  if (surface_index >= params.surface_count) {
    return;
  }

  let s0 = sv_surface_row0(surface_index);
  let s1 = sv_surface_row1(surface_index);
  let s3 = sv_surface_row3(surface_index);
  let field_offset = u32(s0.z);
  let field_cell_count = u32(s0.w);
  let resolution = max(u32(s1.x), 1u);
  if (resolution <= 1u) {
    return;
  }

  let voxel_resolution = resolution - 1u;
  let voxel_xy_count = voxel_resolution * voxel_resolution;
  let voxel_count = voxel_xy_count * voxel_resolution;
  if (local_voxel_index >= voxel_count || local_voxel_index >= field_cell_count) {
    return;
  }

  let z = local_voxel_index / voxel_xy_count;
  let rem = local_voxel_index - z * voxel_xy_count;
  let y = rem / voxel_resolution;
  let x = rem - y * voxel_resolution;
  let isolation = s1.y * params.isolation_scale;
  var local_vertex_offset = 0u;
  let base_vertex_row = (field_offset + local_voxel_index) * 36u;
  for (var tetra_index = 0u; tetra_index < 6u; tetra_index = tetra_index + 1u) {
    local_vertex_offset = sv_emit_tetra(
      tetra_index,
      base_vertex_row,
      local_vertex_offset,
      surface_index,
      s0.x,
      s0.y,
      s3.y,
      field_offset,
      x,
      y,
      z,
      resolution,
      local_voxel_index,
      isolation
    );
  }
}
`;

export const sphRenderSurfaceDrawWgsl = `
struct SurfaceDrawParams {
  surface_count: u32,
  source_vertex_row_count: u32,
  max_compact_vertex_rows: u32,
  source_vertex_counter_mode: u32,
};

struct SurfaceDrawVertexCounter {
  vertex_count: u32,
  overflow_count: u32,
  _pad0: u32,
  _pad1: u32,
};

@group(0) @binding(0) var<storage, read> render_surfaces: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> source_surface_vertices: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> compact_surface_vertices: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> surface_draw_rows: array<vec4<f32>>;
@group(0) @binding(4) var<uniform> params: SurfaceDrawParams;
@group(0) @binding(5) var<storage, read_write> surface_draw_indirect_rows: array<vec4<u32>>;
@group(0) @binding(6) var<storage, read> source_vertex_counter: SurfaceDrawVertexCounter;
@group(0) @binding(7) var<storage, read_write> surface_draw_aggregate_indirect: array<vec4<u32>>;

fn sd_surface_row0(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u];
}

fn sd_surface_row3(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u + 3u];
}

fn sd_vertex_row0(row_index: u32) -> vec4<f32> {
  return source_surface_vertices[row_index * 4u];
}

fn sd_vertex_row1(row_index: u32) -> vec4<f32> {
  return source_surface_vertices[row_index * 4u + 1u];
}

fn sd_vertex_row2(row_index: u32) -> vec4<f32> {
  return source_surface_vertices[row_index * 4u + 2u];
}

fn sd_vertex_row3(row_index: u32) -> vec4<f32> {
  return source_surface_vertices[row_index * 4u + 3u];
}

fn sd_surface_index_from_row(row0: vec4<f32>) -> u32 {
  return u32(max(0.0, round(row0.x)));
}

fn sd_is_active(row3: vec4<f32>) -> bool {
  return row3.w > 0.0;
}

fn sd_source_vertex_row_count() -> u32 {
  if (params.source_vertex_counter_mode == 1u) {
    return min(params.source_vertex_row_count, source_vertex_counter.vertex_count);
  }
  return params.source_vertex_row_count;
}

fn sd_transparency_class(phase_id: f32) -> f32 {
  let phase = u32(max(0.0, round(phase_id)));
  if (phase == 3u) {
    return 3.0;
  }
  if (phase == 2u) {
    return 2.0;
  }
  return 0.0;
}

fn sd_write_compact_vertex(
  write_row: u32,
  source_surface_index: u32,
  source_row0: vec4<f32>,
  source_row1: vec4<f32>,
  source_row2: vec4<f32>,
  source_row3: vec4<f32>
) {
  if (write_row >= params.max_compact_vertex_rows) {
    return;
  }
  let base = write_row * 4u;
  compact_surface_vertices[base] = vec4<f32>(
    f32(source_surface_index),
    source_row0.y,
    source_row0.z,
    f32(write_row / 3u)
  );
  compact_surface_vertices[base + 1u] = vec4<f32>(
    f32(write_row % 3u),
    source_row1.y,
    source_row1.z,
    source_row1.w
  );
  compact_surface_vertices[base + 2u] = source_row2;
  compact_surface_vertices[base + 3u] = source_row3;
}

fn sd_write_draw_row(
  surface_index: u32,
  material_id: f32,
  phase_id: f32,
  optical_state_id: f32,
  vertex_offset: u32,
  vertex_count: u32,
  triangle_offset: u32,
  triangle_count: u32,
  render_order: f32,
  transparency_class_id: f32,
  depth_write_flag: f32,
  status: f32,
  bounds_center: vec3<f32>,
  bounds_radius_m: f32
) {
  let base = surface_index * 4u;
  surface_draw_rows[base] = vec4<f32>(f32(surface_index), material_id, phase_id, optical_state_id);
  surface_draw_rows[base + 1u] = vec4<f32>(f32(vertex_offset), f32(vertex_count), f32(triangle_offset), f32(triangle_count));
  surface_draw_rows[base + 2u] = vec4<f32>(render_order, transparency_class_id, depth_write_flag, status);
  surface_draw_rows[base + 3u] = vec4<f32>(bounds_center, bounds_radius_m);
}

fn sd_write_draw_indirect_row(
  surface_index: u32,
  vertex_count: u32,
  instance_count: u32,
  first_vertex: u32,
  first_instance: u32
) {
  surface_draw_indirect_rows[surface_index] = vec4<u32>(
    vertex_count,
    instance_count,
    first_vertex,
    first_instance
  );
}

fn sd_write_aggregate_indirect_row(vertex_count: u32) {
  let aligned_vertex_count = vertex_count - (vertex_count % 3u);
  surface_draw_aggregate_indirect[0] = vec4<u32>(
    aligned_vertex_count,
    select(0u, 1u, aligned_vertex_count >= 3u),
    0u,
    0u
  );
}

@compute @workgroup_size(1, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let surface_index = global_id.x;
  if (surface_index >= params.surface_count) {
    return;
  }

  let surface_row0 = sd_surface_row0(surface_index);
  let surface_row3 = sd_surface_row3(surface_index);
  let source_vertex_row_count = sd_source_vertex_row_count();
  if (surface_index == 0u) {
    sd_write_aggregate_indirect_row(source_vertex_row_count);
  }
  var prefix_vertex_count = 0u;
  for (var row_index = 0u; row_index < source_vertex_row_count; row_index = row_index + 1u) {
    let row0 = sd_vertex_row0(row_index);
    let row3 = sd_vertex_row3(row_index);
    let source_surface_index = sd_surface_index_from_row(row0);
    if (sd_is_active(row3) && source_surface_index < surface_index) {
      prefix_vertex_count = prefix_vertex_count + 1u;
    }
  }

  var vertex_count = 0u;
  var min_pos = vec3<f32>(1.0e30, 1.0e30, 1.0e30);
  var max_pos = vec3<f32>(-1.0e30, -1.0e30, -1.0e30);
  for (var row_index = 0u; row_index < source_vertex_row_count; row_index = row_index + 1u) {
    let row0 = sd_vertex_row0(row_index);
    let row1 = sd_vertex_row1(row_index);
    let row2 = sd_vertex_row2(row_index);
    let row3 = sd_vertex_row3(row_index);
    let source_surface_index = sd_surface_index_from_row(row0);
    if (sd_is_active(row3) && source_surface_index == surface_index) {
      let write_row = prefix_vertex_count + vertex_count;
      sd_write_compact_vertex(write_row, source_surface_index, row0, row1, row2, row3);
      let position = vec3<f32>(row1.y, row1.z, row1.w);
      min_pos = min(min_pos, position);
      max_pos = max(max_pos, position);
      vertex_count = vertex_count + 1u;
    }
  }

  let surface_is_active = vertex_count > 0u;
  let triangle_count = vertex_count / 3u;
  let vertex_offset = select(0u, prefix_vertex_count, surface_is_active);
  let triangle_offset = select(0u, prefix_vertex_count / 3u, surface_is_active);
  let bounds_center = select(vec3<f32>(0.0, 0.0, 0.0), (min_pos + max_pos) * 0.5, surface_is_active);
  let bounds_delta = max_pos - bounds_center;
  let bounds_radius_m = select(0.0, length(bounds_delta), surface_is_active);
  let explicit_transparency_class_id = surface_row3.z;
  let transparency_class_id = select(
    sd_transparency_class(surface_row0.y),
    explicit_transparency_class_id,
    explicit_transparency_class_id >= 0.0
  );
  let render_order = transparency_class_id * 1000.0 + f32(surface_index);
  let explicit_depth_write_flag = surface_row3.w;
  let depth_write_flag = select(
    select(1.0, 0.0, transparency_class_id > 0.0),
    explicit_depth_write_flag,
    explicit_depth_write_flag >= 0.0
  );
  sd_write_draw_row(
    surface_index,
    surface_row0.x,
    surface_row0.y,
    surface_row3.y,
    vertex_offset,
    vertex_count,
    triangle_offset,
    triangle_count,
    render_order,
    transparency_class_id,
    depth_write_flag,
    select(0.0, 1.0, surface_is_active),
    bounds_center,
    bounds_radius_m
  );
  sd_write_draw_indirect_row(
    surface_index,
    select(0u, vertex_count, surface_is_active),
    select(0u, 1u, surface_is_active),
    vertex_offset,
    surface_index
  );
}
`;

