export const schroederCrossLevelInvariantEvidenceWgsl = /* wgsl */ `
struct CouplingParams {
  fine_nx: u32,
  fine_ny: u32,
  fine_nz: u32,
  parent_nx: u32,
  parent_ny: u32,
  parent_nz: u32,
  grid_stride: u32,
  flags: u32,
  fine_spacing_m: f32,
  origin_x_m: f32,
  origin_y_m: f32,
  origin_z_m: f32,
  grid_shift: i32,
  box_x_m: f32,
  box_y_m: f32,
  box_z_m: f32,
  delta_scale: f32,
  shared_accel_dt_x: f32,
  shared_accel_dt_y: f32,
  shared_accel_dt_z: f32,
  max_parent_velocity_m_per_s: f32,
  pad0: f32,
  pad1: f32,
  pad2: f32,
};

struct MomentPartial {
  mass: f32,
  first_x: f32,
  first_y: f32,
  first_z: f32,
  momentum_x: f32,
  momentum_y: f32,
  momentum_z: f32,
  angular_x: f32,
  angular_y: f32,
  angular_z: f32,
  active_count: u32,
  invalid: u32,
};

@group(0) @binding(0) var<storage, read> fine_grid: array<f32>;
@group(0) @binding(1) var<storage, read> parent_grid: array<f32>;
@group(0) @binding(2) var<storage, read> hierarchy_view: array<u32>;
@group(0) @binding(3) var<storage, read_write> evidence: array<u32>;
@group(0) @binding(4) var<uniform> params: CouplingParams;

var<workgroup> fine_partial: array<MomentPartial, 64>;
var<workgroup> parent_partial: array<MomentPartial, 64>;

const HIERARCHY_MAGIC: u32 = 0x53485631u;
const HIERARCHY_VERSION: u32 = 1u;
const EVIDENCE_MAGIC: u32 = 0x53434931u;
const EVIDENCE_VERSION: u32 = 1u;
const STATUS_READY: u32 = 1u;
const STATUS_ADMITTED: u32 = 2u;
const STATUS_FAIL_CLOSED: u32 = 4u;
const STATUS_INVALID_SOURCE: u32 = 8u;
const STATUS_RESIDUAL_EXCEEDED: u32 = 16u;
const FLAG_Z_FASTEST: u32 = 2u;
const P2G_QUANTUM: f32 = 1.0 / 65536.0;
const F32_UNIT_ROUNDOFF: f32 = 5.960464477539063e-8;

fn finite_f32(value: f32) -> bool {
  return value == value && abs(value) <= bitcast<f32>(0x7f7fffffu);
}

fn zero_partial() -> MomentPartial {
  return MomentPartial(
    0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0,
    0.0, 0.0, 0.0,
    0u, 0u
  );
}

fn add_partial(left: MomentPartial, right: MomentPartial) -> MomentPartial {
  return MomentPartial(
    left.mass + right.mass,
    left.first_x + right.first_x,
    left.first_y + right.first_y,
    left.first_z + right.first_z,
    left.momentum_x + right.momentum_x,
    left.momentum_y + right.momentum_y,
    left.momentum_z + right.momentum_z,
    left.angular_x + right.angular_x,
    left.angular_y + right.angular_y,
    left.angular_z + right.angular_z,
    left.active_count + right.active_count,
    left.invalid + right.invalid
  );
}

fn grid_coords(index: u32, dims: vec3<u32>) -> vec3<u32> {
  if ((params.flags & FLAG_Z_FASTEST) != 0u) {
    let plane = dims.y * dims.z;
    let x = index / plane;
    let remainder = index - x * plane;
    return vec3<u32>(x, remainder / dims.z, remainder % dims.z);
  }
  return vec3<u32>(
    index % dims.x,
    (index / dims.x) % dims.y,
    index / (dims.x * dims.y)
  );
}

fn accumulate_node(
  dense_index: u32,
  dims: vec3<u32>,
  spacing_m: f32,
  grid: ptr<storage, array<f32>, read>,
  partial: ptr<function, MomentPartial>
) {
  let stride = max(params.grid_stride, 8u);
  let dense_count = dims.x * dims.y * dims.z;
  if (dense_index >= dense_count || dense_index > (arrayLength(grid) - 4u) / stride) {
    (*partial).invalid = (*partial).invalid + 1u;
    return;
  }
  let offset = dense_index * stride;
  let raw_mass = (*grid)[offset];
  let momentum = vec3<f32>(
    (*grid)[offset + 1u],
    (*grid)[offset + 2u],
    (*grid)[offset + 3u]
  );
  if (
    !finite_f32(raw_mass)
    || raw_mass < 0.0
    || any(momentum != momentum)
    || any(abs(momentum) > vec3<f32>(bitcast<f32>(0x7f7fffffu)))
  ) {
    (*partial).invalid = (*partial).invalid + 1u;
    return;
  }
  if (!(raw_mass > 0.0)) { return; }
  let coords = grid_coords(dense_index, dims);
  let position = vec3<f32>(
    params.origin_x_m + f32(i32(coords.x) - params.grid_shift) * spacing_m,
    params.origin_y_m + f32(i32(coords.y) - params.grid_shift) * spacing_m,
    params.origin_z_m + f32(i32(coords.z) - params.grid_shift) * spacing_m
  );
  if (any(position != position)) {
    (*partial).invalid = (*partial).invalid + 1u;
    return;
  }
  let first = raw_mass * position;
  let angular = cross(position, momentum);
  (*partial).mass = (*partial).mass + raw_mass;
  (*partial).first_x = (*partial).first_x + first.x;
  (*partial).first_y = (*partial).first_y + first.y;
  (*partial).first_z = (*partial).first_z + first.z;
  (*partial).momentum_x = (*partial).momentum_x + momentum.x;
  (*partial).momentum_y = (*partial).momentum_y + momentum.y;
  (*partial).momentum_z = (*partial).momentum_z + momentum.z;
  (*partial).angular_x = (*partial).angular_x + angular.x;
  (*partial).angular_y = (*partial).angular_y + angular.y;
  (*partial).angular_z = (*partial).angular_z + angular.z;
  (*partial).active_count = (*partial).active_count + 1u;
}

fn hierarchy_admitted() -> bool {
  if (arrayLength(&hierarchy_view) < 68u || arrayLength(&evidence) < 48u) {
    return false;
  }
  let fine_count = hierarchy_view[34u];
  let parent_count = hierarchy_view[35u];
  let fine_offset = hierarchy_view[48u];
  let parent_offset = hierarchy_view[49u];
  return hierarchy_view[0u] == HIERARCHY_MAGIC
    && hierarchy_view[1u] == HIERARCHY_VERSION
    && (hierarchy_view[2u] & (STATUS_READY | STATUS_ADMITTED))
      == (STATUS_READY | STATUS_ADMITTED)
    && hierarchy_view[18u] == params.fine_nx * params.fine_ny * params.fine_nz
    && hierarchy_view[19u] == params.parent_nx * params.parent_ny * params.parent_nz
    && hierarchy_view[28u] == bitcast<u32>(params.fine_spacing_m)
    && hierarchy_view[29u] == bitcast<u32>(params.fine_spacing_m * 2.0)
    && fine_count > 0u
    && parent_count > 0u
    && fine_offset <= arrayLength(&hierarchy_view)
    && fine_count <= arrayLength(&hierarchy_view) - fine_offset
    && parent_offset <= arrayLength(&hierarchy_view)
    && parent_count <= arrayLength(&hierarchy_view) - parent_offset;
}

fn write_f32(index: u32, value: f32) {
  evidence[index] = bitcast<u32>(value);
}

@compute @workgroup_size(64)
fn main(@builtin(local_invocation_id) local_id: vec3<u32>) {
  let lane = local_id.x;
  let admitted_source = hierarchy_admitted();
  var fine = zero_partial();
  var parent = zero_partial();
  if (admitted_source) {
    let fine_count = hierarchy_view[34u];
    let parent_count = hierarchy_view[35u];
    let fine_offset = hierarchy_view[48u];
    let parent_offset = hierarchy_view[49u];
    let fine_dims = vec3<u32>(params.fine_nx, params.fine_ny, params.fine_nz);
    let parent_dims = vec3<u32>(params.parent_nx, params.parent_ny, params.parent_nz);
    for (var index = lane; index < fine_count; index = index + 64u) {
      accumulate_node(
        hierarchy_view[fine_offset + index],
        fine_dims,
        params.fine_spacing_m,
        &fine_grid,
        &fine
      );
    }
    for (var index = lane; index < parent_count; index = index + 64u) {
      accumulate_node(
        hierarchy_view[parent_offset + index],
        parent_dims,
        params.fine_spacing_m * 2.0,
        &parent_grid,
        &parent
      );
    }
  } else if (lane == 0u) {
    fine.invalid = 1u;
    parent.invalid = 1u;
  }
  fine_partial[lane] = fine;
  parent_partial[lane] = parent;
  workgroupBarrier();

  var width = 32u;
  loop {
    if (lane < width) {
      fine_partial[lane] = add_partial(fine_partial[lane], fine_partial[lane + width]);
      parent_partial[lane] = add_partial(
        parent_partial[lane],
        parent_partial[lane + width]
      );
    }
    workgroupBarrier();
    if (width == 1u) { break; }
    width = width >> 1u;
  }

  if (lane != 0u) { return; }
  let f = fine_partial[0u];
  let p = parent_partial[0u];
  let mass_residual = abs(f.mass - p.mass);
  let first_residual = abs(vec3<f32>(f.first_x, f.first_y, f.first_z)
    - vec3<f32>(p.first_x, p.first_y, p.first_z));
  let momentum_residual = abs(vec3<f32>(f.momentum_x, f.momentum_y, f.momentum_z)
    - vec3<f32>(p.momentum_x, p.momentum_y, p.momentum_z));
  let angular_residual = abs(vec3<f32>(f.angular_x, f.angular_y, f.angular_z)
    - vec3<f32>(p.angular_x, p.angular_y, p.angular_z));
  let node_scale = f32(max(f.active_count + p.active_count, 1u));
  let coordinate_scale = max(
    1.0,
    max(
      max(abs(params.origin_x_m), abs(params.origin_y_m)),
      max(abs(params.origin_z_m), max(params.box_x_m, max(params.box_y_m, params.box_z_m)))
    )
  );
  let mass_scale = max(1.0, max(abs(f.mass), abs(p.mass)));
  let momentum_scale = max(
    1.0,
    max(
      max(abs(f.momentum_x), max(abs(f.momentum_y), abs(f.momentum_z))),
      max(abs(p.momentum_x), max(abs(p.momentum_y), abs(p.momentum_z)))
    )
  );
  let mass_tolerance = 4.0 * (
    256.0 * F32_UNIT_ROUNDOFF * mass_scale
    + 0.5 * P2G_QUANTUM * node_scale
  );
  let first_tolerance = 4.0 * (
    256.0 * F32_UNIT_ROUNDOFF * mass_scale * coordinate_scale
    + coordinate_scale * 0.5 * P2G_QUANTUM * node_scale
  );
  let momentum_tolerance = 4.0 * (
    256.0 * F32_UNIT_ROUNDOFF * momentum_scale
    + 0.5 * P2G_QUANTUM * node_scale
  );
  let angular_tolerance = 4.0 * (
    256.0 * F32_UNIT_ROUNDOFF * momentum_scale * coordinate_scale
    + coordinate_scale * 0.5 * P2G_QUANTUM * node_scale
  );
  let invalid = f.invalid + p.invalid;
  let residuals_admitted = mass_residual <= mass_tolerance
    && max(first_residual.x, max(first_residual.y, first_residual.z)) <= first_tolerance
    && max(momentum_residual.x, max(momentum_residual.y, momentum_residual.z))
      <= momentum_tolerance
    && max(angular_residual.x, max(angular_residual.y, angular_residual.z))
      <= angular_tolerance;
  var status = STATUS_READY | STATUS_ADMITTED;
  if (!admitted_source || invalid != 0u || !residuals_admitted) {
    status = STATUS_FAIL_CLOSED;
    if (!admitted_source || invalid != 0u) { status = status | STATUS_INVALID_SOURCE; }
    if (!residuals_admitted) { status = status | STATUS_RESIDUAL_EXCEEDED; }
  }
  evidence[0u] = EVIDENCE_MAGIC;
  evidence[1u] = EVIDENCE_VERSION;
  evidence[2u] = status;
  evidence[3u] = select(0u, hierarchy_view[3u], admitted_source);
  evidence[4u] = select(0u, hierarchy_view[34u], admitted_source);
  evidence[5u] = select(0u, hierarchy_view[35u], admitted_source);
  evidence[6u] = params.flags;
  evidence[7u] = 64u;
  write_f32(8u, f.mass);
  write_f32(9u, f.first_x);
  write_f32(10u, f.first_y);
  write_f32(11u, f.first_z);
  write_f32(12u, f.momentum_x);
  write_f32(13u, f.momentum_y);
  write_f32(14u, f.momentum_z);
  write_f32(15u, f.angular_x);
  write_f32(16u, f.angular_y);
  write_f32(17u, f.angular_z);
  evidence[18u] = f.active_count;
  evidence[19u] = f.invalid;
  write_f32(20u, p.mass);
  write_f32(21u, p.first_x);
  write_f32(22u, p.first_y);
  write_f32(23u, p.first_z);
  write_f32(24u, p.momentum_x);
  write_f32(25u, p.momentum_y);
  write_f32(26u, p.momentum_z);
  write_f32(27u, p.angular_x);
  write_f32(28u, p.angular_y);
  write_f32(29u, p.angular_z);
  evidence[30u] = p.active_count;
  evidence[31u] = p.invalid;
  write_f32(32u, mass_residual);
  write_f32(33u, first_residual.x);
  write_f32(34u, first_residual.y);
  write_f32(35u, first_residual.z);
  write_f32(36u, momentum_residual.x);
  write_f32(37u, momentum_residual.y);
  write_f32(38u, momentum_residual.z);
  write_f32(39u, angular_residual.x);
  write_f32(40u, angular_residual.y);
  write_f32(41u, angular_residual.z);
  write_f32(42u, mass_tolerance);
  write_f32(43u, first_tolerance);
  write_f32(44u, momentum_tolerance);
  write_f32(45u, angular_tolerance);
  evidence[46u] = select(0u, hierarchy_view[44u], admitted_source);
  evidence[47u] = 0u;
}
`;
