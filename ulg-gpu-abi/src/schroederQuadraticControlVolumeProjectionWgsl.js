// Shared geometry implementation; intentionally independent of bindings and
// scheduling. W scatters occupancy, and the exact same weights implement W^T.
export const schroederQuadraticControlVolumeProjectionWgsl = /* wgsl */ `
struct QcvAxisProjection {
  cell0: i32, cell1: i32, weight0: f32, weight1: f32,
  capacity: f32, valid: u32,
};
fn qcv_finite(x: f32) -> bool { return (bitcast<u32>(x) & 0x7f800000u) != 0x7f800000u; }
fn qcv_axis_valid(lc: i32, lf: f32, uc: i32, uf: f32) -> bool {
  return qcv_finite(lf) && qcv_finite(uf) && lf >= 0.0 && lf < 1.0
    && uf >= 0.0 && uf < 1.0 && (uc > lc || (uc == lc && uf > lf));
}
fn qcv_local_boundary(node: i32, cell: i32, fraction: f32) -> f32 {
  // Integer subtraction first: adjacent cells above 2^24 remain distinct.
  if (cell >= node) {
    let delta = bitcast<u32>(cell) - bitcast<u32>(node);
    if (delta >= 4u) { return 4.0; }
    return f32(delta) + fraction;
  }
  let delta = bitcast<u32>(node) - bitcast<u32>(cell);
  if (delta > 4u) { return -4.0; }
  return max(-4.0, -f32(delta) + fraction);
}
fn qcv_local_cell(node: i32, cell: i32) -> i32 {
  if (cell >= node) { return i32(min(4u, bitcast<u32>(cell) - bitcast<u32>(node))); }
  return -i32(min(4u, bitcast<u32>(node) - bitcast<u32>(cell)));
}
fn qcv_pair_width(lc: i32, lf: f32, uc: i32, uf: f32) -> f32 {
  if (uc < lc || (uc == lc && uf <= lf)) { return 0.0; }
  if (uc == lc) { return uf - lf; }
  return f32(uc - lc - 1) + (1.0 - lf) + uf;
}
// Clip with integer/fraction comparisons BEFORE evaluating a polynomial. In a
// thin box e.g. [0, 2^-28], adding a node offset to both endpoints would round
// them to the same f32. The independent positive width below retains that box.
fn qcv_segment(lc_in: i32, lf_in: f32, uc_in: i32, uf_in: f32,
    left: i32, kind: u32) -> f32 {
  var lc = lc_in; var lf = lf_in; var uc = uc_in; var uf = uf_in;
  if (lc < left || (lc == left && lf < 0.5)) { lc = left; lf = 0.5; }
  if (uc > left + 1 || (uc == left + 1 && uf > 0.5)) { uc = left + 1; uf = 0.5; }
  let width = qcv_pair_width(lc, lf, uc, uf);
  if (width == 0.0) { return 0.0; }
  if (kind == 2u || kind == 4u) {
    let v0 = f32(left + 1 - uc) + (0.5 - uf);
    let v1 = f32(left + 1 - lc) + (0.5 - lf);
    let q = (v0 * v0 + v0 * v1 + v1 * v1) / 6.0;
    return width * select(q, 1.0 - q, kind == 4u);
  }
  let t0 = f32(lc - left) + (lf - 0.5);
  let t1 = f32(uc - left) + (uf - 0.5);
  let quadratic = t0 * t0 + t0 * t1 + t1 * t1;
  if (kind == 0u) { return width * quadratic / 6.0; }
  if (kind == 3u) { return width * (1.0 - quadratic / 6.0); }
  let x0 = t0 - 0.5; let x1 = t1 - 0.5;
  return width * (0.75 - (x0 * x0 + x0 * x1 + x1 * x1) / 3.0);
}
fn qcv_basis_capacity(lc: i32, lf: f32, uc: i32, uf: f32) -> f32 {
  return qcv_segment(lc, lf, uc, uf, -2, 0u)
    + qcv_segment(lc, lf, uc, uf, -1, 1u)
    + qcv_segment(lc, lf, uc, uf, 0, 2u);
}
fn qcv_local_prefix(lc_in: i32, lf_in: f32, uc_in: i32, uf_in: f32,
    mirrored: bool) -> f32 {
  var lc = lc_in; var lf = lf_in; var uc = uc_in; var uf = uf_in;
  if (mirrored) {
    // Integrate the mirrored polynomial directly. Reflecting fractions with
    // 1-f would erase tiny positive f before integration even in local space.
    var start_cell = lc; var start_fraction = lf;
    if (lc < 1 || (lc == 1 && lf < 0.5)) { start_cell = 1; start_fraction = 0.5; }
    return qcv_pair_width(start_cell, start_fraction, uc, uf)
      + qcv_segment(lc, lf, uc, uf, -1, 0u)
      + qcv_segment(lc, lf, uc, uf, 0, 4u);
  }
  var end_cell = uc; var end_fraction = uf;
  if (uc > -2 || (uc == -2 && uf > 0.5)) { end_cell = -2; end_fraction = 0.5; }
  return qcv_pair_width(lc, lf, end_cell, end_fraction)
    + qcv_segment(lc, lf, uc, uf, -2, 3u)
    + qcv_segment(lc, lf, uc, uf, -1, 2u);
}
fn qcv_primal_axis_extent(cell: i32, lc: i32, lf: f32, uc: i32, uf: f32) -> f32 {
  if (!qcv_axis_valid(lc, lf, uc, uf)) { return -1.0; }
  if (cell < lc || cell > uc) { return 0.0; }
  return max(0.0, select(1.0, uf, cell == uc) - select(0.0, lf, cell == lc));
}
fn qcv_primal_axis_center_fraction(cell: i32, lc: i32, lf: f32, uc: i32, uf: f32) -> f32 {
  let extent = qcv_primal_axis_extent(cell, lc, lf, uc, uf);
  if (extent <= 0.0) { return -1.0; }
  return select(0.0, lf, cell == lc) + extent * 0.5;
}
fn qcv_axis_projection(node: i32, lc: i32, lf: f32, uc: i32, uf: f32) -> QcvAxisProjection {
  let invalid = QcvAxisProjection(0, 0, 0.0, 0.0, 0.0, 0u);
  if (!qcv_axis_valid(lc, lf, uc, uf)) { return invalid; }
  let a = qcv_local_boundary(node, lc, lf);
  let b = qcv_local_boundary(node, uc, uf);
  let local_lc = qcv_local_cell(node, lc);
  let local_uc = qcv_local_cell(node, uc);
  let capacity = qcv_basis_capacity(local_lc, lf, local_uc, uf);
  if (capacity == 0.0) {
    let positive_support = (local_lc < 1 || (local_lc == 1 && lf < 0.5))
      && (local_uc > -2 || (local_uc == -2 && uf > 0.5));
    if (positive_support) { return invalid; }
    return QcvAxisProjection(0, 0, 0.0, 0.0, 0.0, 1u);
  }
  if (!qcv_finite(capacity) || !(capacity > 0.0) || capacity > 1.0) { return invalid; }
  var cell0 = 0; var weight0 = 0.0;
  if (a <= -1.5 && b >= 1.5) {
    if (node == bitcast<i32>(0x80000000u)) { return invalid; }
    cell0 = node - 1; weight0 = 0.5;
  }
  else if (lc == uc || (uc > lc && bitcast<u32>(uc) - bitcast<u32>(lc) == 1u && uf == 0.0)) {
    cell0 = lc; weight0 = 1.0;
  } else if (a + b >= 0.0) {
    let start = lf + qcv_local_prefix(local_lc, lf, local_uc, uf, false);
    let whole = floor(start);
    cell0 = lc + i32(whole);
    weight0 = min(1.0, (1.0 - (start - whole)) / capacity);
  } else {
    let end = uf - qcv_local_prefix(local_lc, lf, local_uc, uf, true);
    let whole = ceil(end) - 1.0;
    let last = uc + i32(whole);
    let last_weight = min(1.0, (end - whole) / capacity);
    if (last_weight == 1.0) { cell0 = last; weight0 = 1.0; }
    else { cell0 = last - 1; weight0 = 1.0 - last_weight; }
  }
  let weight1 = 1.0 - weight0;
  if (cell0 == 2147483647 && weight1 > 0.0) { return invalid; }
  if (!qcv_finite(weight0) || !(weight0 > 0.0) || weight0 > 1.0
      || qcv_primal_axis_extent(cell0, lc, lf, uc, uf) <= 0.0
      || (weight1 > 0.0 && qcv_primal_axis_extent(cell0 + 1, lc, lf, uc, uf) <= 0.0)) { return invalid; }
  return QcvAxisProjection(cell0, select(cell0, cell0 + 1, weight1 > 0.0), weight0, weight1, capacity, 1u);
}
fn qcv_descriptor_seal(version: u32, spacing: f32, origin: vec3<i32>, dims: vec3<u32>,
    node_count: u32, chart: u32, level: i32, bounds: array<u32, 12>) -> u32 {
  let header = array<u32, 11>(version, bitcast<u32>(spacing), bitcast<u32>(origin.x),
    bitcast<u32>(origin.y), bitcast<u32>(origin.z), dims.x, dims.y, dims.z,
    node_count, chart, bitcast<u32>(level));
  var hash = 2166136261u;
  for (var i = 0u; i < 11u; i++) { hash = (hash ^ header[i]) * 16777619u; }
  for (var i = 0u; i < 12u; i++) { hash = (hash ^ bounds[i]) * 16777619u; }
  return hash;
}
`;
