/**
 * Presentation-only deformation of retained isosurface vertices. The caller
 * declares `isosurface_motion_rows: array<vec4<f32>>` as read-only storage.
 * Rows are (sum(weight * velocity_m_per_s), sum(weight)), x-fastest; offsets
 * and row_count are in vec4 rows, not floats. Grid is compact position plus
 * the descriptor's gridBias; grid_scale_m converts one grid cell to metres.
 * This helper neither advances physics nor changes density/optical fields.
 */
export const ISOSURFACE_MOTION_WGSL = /* wgsl */ `
struct IsosurfaceMotion {
  displacement: vec3<f32>,
  normal: vec3<f32>,
};

fn isosurface_motion_finite(value: f32) -> bool {
  return value == value && abs(value) < 1.0e30;
}

fn isosurface_motion_finite3(value: vec3<f32>) -> bool {
  return all(value == value) && all(abs(value) < vec3<f32>(1.0e30));
}

fn isosurface_motion_unit(value: vec3<f32>, fallback: vec3<f32>) -> vec3<f32> {
  if (!isosurface_motion_finite3(value)) { return fallback; }
  let scale = max(max(abs(value.x), abs(value.y)), abs(value.z));
  if (!(scale > 0.0)) { return fallback; }
  let scaled = value / scale;
  return scaled / length(scaled);
}

fn sample_isosurface_motion(
  grid: vec3<f32>, grid_scale_m: f32, normal: vec3<f32>,
  age_s: f32, max_displacement_m: f32,
  field_offset: u32, resolution: u32, row_count: u32
) -> IsosurfaceMotion {
  let source_normal = isosurface_motion_unit(normal, vec3<f32>(0.0, 1.0, 0.0));
  let held = IsosurfaceMotion(vec3<f32>(0.0), source_normal);
  if (!isosurface_motion_finite3(grid)
    || !isosurface_motion_finite(grid_scale_m) || !(grid_scale_m > 0.0)
    || !isosurface_motion_finite(age_s) || !(age_s > 0.0)
    || !isosurface_motion_finite(max_displacement_m) || !(max_displacement_m > 0.0)
    || resolution < 2u) { return held; }
  let available = min(row_count, arrayLength(&isosurface_motion_rows));
  if (field_offset >= available) { return held; }
  // Check both products before multiplication; hostile dimensions cannot wrap
  // a row index into another surface's sidecar.
  let remaining = available - field_offset;
  if (resolution > remaining / resolution) { return held; }
  let slab = resolution * resolution;
  if (resolution > remaining / slab) { return held; }

  let maximum = vec3<f32>(f32(resolution - 1u));
  let p = clamp(grid, vec3<f32>(0.0), maximum);
  let base = min(vec3<u32>(floor(p)), vec3<u32>(resolution - 2u));
  let f = p - vec3<f32>(base);
  var moment = vec4<f32>(0.0);
  var dx = vec4<f32>(0.0);
  var dy = vec4<f32>(0.0);
  var dz = vec4<f32>(0.0);
  for (var corner = 0u; corner < 8u; corner = corner + 1u) {
    let offset = vec3<u32>(corner & 1u, (corner >> 1u) & 1u, (corner >> 2u) & 1u);
    let cell = base + offset;
    let row = isosurface_motion_rows[field_offset + cell.x + resolution * cell.y + slab * cell.z];
    if (!isosurface_motion_finite3(row.xyz)
      || !isosurface_motion_finite(row.w) || row.w < 0.0
      || (row.w == 0.0 && any(row.xyz != vec3<f32>(0.0)))) { return held; }
    let w = select(vec3<f32>(1.0) - f, f, offset == vec3<u32>(1u));
    let sign = select(vec3<f32>(-1.0), vec3<f32>(1.0), offset == vec3<u32>(1u));
    moment += row * (w.x * w.y * w.z);
    dx += row * (sign.x * w.y * w.z);
    dy += row * (w.x * sign.y * w.z);
    dz += row * (w.x * w.y * sign.z);
  }
  if (!isosurface_motion_finite3(moment.xyz)
    || !isosurface_motion_finite(moment.w) || !(moment.w > 0.0)) { return held; }
  // Interpolate MOMENTS first: interpolating per-corner quotients invents
  // velocities at empty corners and does not conserve the sampling weights.
  let velocity = moment.xyz / moment.w;
  if (!isosurface_motion_finite3(velocity)) { return held; }
  // Quotient rule, then grid-to-world derivative. Outside the lattice the
  // clamped field is constant along that axis; endpoints use the inner limit.
  let active_axes = vec3<f32>(
    select(0.0, 1.0, grid.x >= 0.0 && grid.x <= maximum.x),
    select(0.0, 1.0, grid.y >= 0.0 && grid.y <= maximum.y),
    select(0.0, 1.0, grid.z >= 0.0 && grid.z <= maximum.z)
  );
  var jx = ((dx.xyz - velocity * dx.w) / moment.w / grid_scale_m) * (age_s * active_axes.x);
  var jy = ((dy.xyz - velocity * dy.w) / moment.w / grid_scale_m) * (age_s * active_axes.y);
  var jz = ((dz.xyz - velocity * dz.w) / moment.w / grid_scale_m) * (age_s * active_axes.z);
  var displacement = age_s * velocity;
  if (!isosurface_motion_finite3(displacement)
    || !isosurface_motion_finite3(jx) || !isosurface_motion_finite3(jy)
    || !isosurface_motion_finite3(jz)) { return held; }
  let magnitude_scale = max(max(abs(displacement.x), abs(displacement.y)), abs(displacement.z));
  if (magnitude_scale > 0.0) {
    let magnitude = magnitude_scale * length(displacement / magnitude_scale);
    if (magnitude >= max_displacement_m) {
      let direction = displacement / magnitude;
      let saturation_scale = max_displacement_m / magnitude;
      displacement = max_displacement_m * direction;
      // Derivative of R*d/|d|, not the uncapped velocity gradient. At the
      // nondifferentiable cap boundary choose the saturated outer derivative.
      jx = saturation_scale * (jx - direction * dot(direction, jx));
      jy = saturation_scale * (jy - direction * dot(direction, jy));
      jz = saturation_scale * (jz - direction * dot(direction, jz));
    }
  }
  jx += vec3<f32>(1.0, 0.0, 0.0);
  jy += vec3<f32>(0.0, 1.0, 0.0);
  jz += vec3<f32>(0.0, 0.0, 1.0);
  // Cofactor(F)*n transports oriented area normals without dividing by det F.
  // A rank-two map can retain a valid surface normal; collapsed/nonfinite
  // transported areas fall back to the normalized source normal.
  let transported_normal = cross(jy, jz) * source_normal.x
    + cross(jz, jx) * source_normal.y + cross(jx, jy) * source_normal.z;
  return IsosurfaceMotion(displacement, isosurface_motion_unit(transported_normal, source_normal));
}
`;
