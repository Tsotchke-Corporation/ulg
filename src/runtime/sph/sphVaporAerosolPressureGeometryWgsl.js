import { schroederQuadraticControlVolumeProjectionWgsl }
  from '../../../ulg-gpu-abi/src/schroederQuadraticControlVolumeProjectionWgsl.js';

// Adjoint of the original aerosol occupancy B -> optional geometric A -> W.
// It uses the original fine/coarse grids and clipped control-volume bounds.
// Missing gas cells contribute zero pressure, without renormalizing support.
export const sphVaporAerosolPressureGeometryWgsl = schroederQuadraticControlVolumeProjectionWgsl + /* wgsl */ `
struct ExchangeGeometry { words: array<vec4<u32>, 6>, };
@group(0) @binding(9) var<uniform> pressure_geometry: ExchangeGeometry;
fn xgp(lane: u32) -> u32 { return pressure_geometry.words[lane / 4u][lane % 4u]; }
fn xwork_axis(node: i32, cell: i32, axis: u32) -> f32 {
  let indexed = node + bitcast<i32>(xgp(7u));
  if (indexed < 0 || indexed >= i32(xgp(8u + axis))) { return -1.0; }
  let b = 12u + axis * 4u;
  let w = qcv_axis_projection(node, bitcast<i32>(xgp(b)), bitcast<f32>(xgp(b + 1u)),
    bitcast<i32>(xgp(b + 2u)), bitcast<f32>(xgp(b + 3u)));
  if (w.valid == 0u || !(w.capacity > 0.0)) { return -1.0; }
  return select(0.0, w.weight0, cell == w.cell0) + select(0.0, w.weight1, cell == w.cell1);
}
fn xwork_weight(position: vec3<f32>, cell: vec3<i32>) -> f32 {
  let levels = xgp(0u); let spacing = bitcast<f32>(xgp(1u));
  if ((levels != 1u && levels != 2u) || !xpos(spacing)) { return -1.0; }
  let p = position * (1.0 / spacing);
  if (!xvecfinite(p) || any(abs(p) > vec3<f32>(2147483000.0))) { return -1.0; }
  let base_f = floor(p - vec3<f32>(0.5)); let base = vec3<i32>(base_f); let f = p - base_f;
  var weights = vec3<f32>(0.0);
  // The tensor product is separable. Evaluate three one-dimensional adjoints
  // instead of visiting 27 fine nodes and up to eight parents for each pair.
  for (var axis = 0u; axis < 3u; axis++) {
    for (var ordinal = 0u; ordinal < 3u; ordinal++) {
      let delta = select(1.5 - f[axis], f[axis] - 0.5, ordinal == 2u);
      var b = 0.5 * delta * delta;
      if (ordinal == 1u) { let d = f[axis] - 1.0; b = 0.75 - d * d; }
      if (b == 0.0) { continue; }
      let node = base[axis] + i32(ordinal); let indexed = node + bitcast<i32>(xgp(2u));
      if (indexed < 0 || indexed >= i32(xgp(4u + axis))) { return -1.0; }
      var w = 0.0;
      if (levels == 1u) {
        w = xwork_axis(node, cell[axis], axis);
        if (w < 0.0) { return -1.0; }
      } else {
        // Same canonical 2:1 geometric A as the volume producer. Positive
        // out-of-grid support rejects; it is never clipped and redistributed.
        let coarse = f32(node) * 0.5 + f32(bitcast<i32>(xgp(7u)));
        let lo = floor(coarse); let fraction = coarse - lo;
        for (var corner = 0u; corner < 2u; corner++) {
          let a = select(1.0 - fraction, fraction, corner == 1u);
          if (a == 0.0) { continue; }
          let c = i32(lo) + i32(corner) - bitcast<i32>(xgp(7u));
          let v = xwork_axis(c, cell[axis], axis);
          if (v < 0.0) { return -1.0; }
          w += a * v;
        }
      }
      weights[axis] += b * w;
    }
  }
  return weights.x * weights.y * weights.z;
}
`;
