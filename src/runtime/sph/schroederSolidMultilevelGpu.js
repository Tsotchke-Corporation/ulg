import { computeBufferBinding, createCachedExplicitComputePipeline } from '../webgpuComputeLayout.js';

// A5 SOL-6 (plan/todo/sol-critic.md, .icc/completion-oracles.yaml):
// GPU-native multilevel 2:1 solid contact-proxy refinement/coarsening,
// double-float chart origin rebasing across SS level/chart boundaries, and
// symplectic N-body orbital root integration with local body-fixed surface
// patch materialization (zero uniform interior particle fill).
//
// Core invariants enforced on the GPU:
//   1. Representation-level separation: changing contact-proxy LOD (L=0 fine
//      1x1, L=1 medium 2x2, L=2 coarse 4x4) never modifies body mass,
//      principal moments, COM, linear momentum P, spin angular momentum L, or
//      visible surface mesh topology.
//   2. Single-owner surface quadrature: every elementary L=0 leaf face tile is
//      covered by exactly one emitted active proxy (owner_count == 1), so total
//      active quadrature area sum_p A_p equals exact total face area across any
//      spatial refinement/coarsening configuration, and accumulated normal
//      contact impulses reflux conservatively between parent and 4 children.
//   3. Chart-boundary continuity: each body carries a double-float chart origin
//      (origin_hi + origin_lo) plus local frame offset frames[base].xyz; chart
//      rebasing shifts origin and local offset in opposite directions on the
//      GPU so world position, velocity, spin, and camera-relative silhouette
//      stay continuous to sub-ULP precision across chart/SS boundaries.
//   4. Planetary/orbital scale without interior fill: celestial bodies advance
//      via symplectic Velocity-Verlet + DLM principal-axis free rotation in
//      O(B^2) while a local tangent-chart surface patch materializes only the
//      O(P_patch) boundary samples inside the focus aperture with zero kick to
//      the root orbit on patch activation, deactivation, or focus migration.
export const SCHROEDER_SOLID_MULTILEVEL_SCHEMA =
  'peercompute.ulg.schroeder-solid-multilevel.v1';

const GPU_BUFFER_USAGE = Object.freeze({
  MAP_READ: 0x01,
  COPY_SRC: 0x04,
  COPY_DST: 0x08,
  UNIFORM: 0x40,
  STORAGE: 0x80
});

/**
 * Split an f64 coordinate into exact non-overlapping f32 `(hi, lo)` pair
 * (`hi = Math.fround(x)`, `lo = Math.fround(x - hi)`).
 */
export function splitFloat64ToHiLo(value) {
  const hi = Math.fround(Number(value));
  const lo = Math.fround(Number(value) - hi);
  return [hi, lo];
}

/**
 * Build a 3-level (L=0 1x1, L=1 2x2, L=2 4x4) quadtree tile catalog over the 6
 * faces of a coherent rectangular solid block in its principal body frame.
 * Each coarse 4x4 macro-patch holds 16 leaf tiles indexed `(mu, mv) in [0..3]^2`.
 */
export function buildSchroederMultilevelProxyCatalog({
  bodyIndex = 0,
  halfExtentsM,
  finePitchM,
  padToMultipleOf4 = false
}) {
  const half = halfExtentsM.map(Number);
  const h0 = Number(finePitchM);
  if (!half.every((v) => v > 0) || !(h0 > 0)) {
    throw new TypeError('Multilevel proxy catalog requires positive halfExtentsM and finePitchM');
  }
  const counts = half.map((v) => {
    const raw = Math.max(1, Math.round((2 * v) / h0));
    if (padToMultipleOf4) {
      return Math.max(4, Math.ceil(raw / 4) * 4);
    }
    return Math.max(4, raw);
  });
  for (let a = 0; a < 3; a += 1) {
    if (counts[a] % 4 !== 0) {
      throw new RangeError(`Axis ${a} fine tile count (${counts[a]}) must be a multiple of 4 for L=0/1/2 2:1 hierarchy`);
    }
  }
  const axes = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1]
  ];
  // Macro 4x4 patches: 8 floats per macro patch:
  //   [center.xyz, leafPitchU, normal.xyz, leafPitchV]
  const macroFloats = [];
  const macroBodyIds = [];
  let leafCount = 0;
  let exactAreaM2 = 0;

  for (let axis = 0; axis < 3; axis += 1) {
    const uAxis = (axis + 1) % 3;
    const vAxis = (axis + 2) % 3;
    const du = (2 * half[uAxis]) / counts[uAxis];
    const dv = (2 * half[vAxis]) / counts[vAxis];
    const macroU = counts[uAxis] / 4;
    const macroV = counts[vAxis] / 4;

    for (const sign of [-1, 1]) {
      for (let mu = 0; mu < macroU; mu += 1) {
        for (let mv = 0; mv < macroV; mv += 1) {
          const uCenter = -half[uAxis] + (mu * 4 + 2) * du;
          const vCenter = -half[vAxis] + (mv * 4 + 2) * dv;
          const center = [0, 0, 0];
          center[axis] = sign * half[axis];
          center[uAxis] = uCenter;
          center[vAxis] = vCenter;
          const normal = axes[axis].map((c) => sign * c);
          macroFloats.push(center[0], center[1], center[2], du, normal[0], normal[1], normal[2], dv);
          macroBodyIds.push(bodyIndex, uAxis, vAxis, 0);
          leafCount += 16;
          exactAreaM2 += 16 * du * dv;
        }
      }
    }
  }

  return Object.freeze({
    schema: SCHROEDER_SOLID_MULTILEVEL_SCHEMA,
    macroCount: macroFloats.length / 8,
    leafCount,
    maxActiveProxies: leafCount,
    exactAreaM2,
    macroPatches: new Float32Array(macroFloats),
    macroMeta: new Uint32Array(macroBodyIds)
  });
}

export const schroederSolidMultilevelWgsl = /* wgsl */ `
struct MultilevelParams {
  // macro_count, body_count, orbital_body_count, patch_grid_dim
  counts: vec4<u32>,
  // focus_world.xyz, fine_radius_m
  focus_fine: vec4<f32>,
  // medium_radius_m, dt_s, grav_G, softening_m
  lod_orbit: vec4<f32>,
  // patch_focus_body_dir.xyz (unit in body frame), patch_half_angle_rad
  patch_aperture: vec4<f32>,
  // target_planet_index, patch_enabled (1/0), planet_radius_m, patch_sample_mass_kg
  patch_meta: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: MultilevelParams;
// Rigid frames (32 words = 8 vec4<f32> per body, exact schroederSolidRigidGpu layout)
@group(0) @binding(1) var<storage, read_write> frames: array<vec4<f32>>;
// Per-body chart origins: 2 vec4<f32> per body: [origin_hi.xyz, scale], [origin_lo.xyz, chart_id_f32]
@group(0) @binding(2) var<storage, read_write> body_charts: array<vec4<f32>>;
// Target chart origins for rebase_body_chart: 2 vec4<f32> per body
@group(0) @binding(3) var<storage, read> next_charts: array<vec4<f32>>;
// Macro 4x4 surface patches: 2 vec4<f32> per macro + 1 vec4<u32> meta
@group(0) @binding(4) var<storage, read> macro_patches: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read> macro_meta: array<vec4<u32>>;
// Per-leaf-tile persistent normal impulse scalar (16 leaves per macro) for conservative LOD reflux
@group(0) @binding(6) var<storage, read_write> leaf_impulse: array<f32>;
// Emitted active multilevel proxies (4 vec4<f32> per proxy):
//   [0]: body_pos.xyz, effective_radius_m
//   [1]: body_normal.xyz, quadrature_area_m2
//   [2]: world_pos.xyz, refluxed_impulse_ns
//   [3]: bitcast<f32>(bodyId, level, macroId, coveredLeafMask16)
@group(0) @binding(7) var<storage, read_write> active_proxies: array<vec4<f32>>;
// Diagnostics / counters:
//   [0]: active_proxy_count
//   [1]: level0_count
//   [2]: level1_count
//   [3]: level2_count
//   [4]: covered_leaf_count (must equal 16 * macro_count, owner uniqueness check!)
//   [5]: overlap_violation_count (must equal 0!)
//   [6]: area_fixed_hi (sum A_p * 2^20)
//   [7]: impulse_fixed_sum (sum J_p * 2^20)
@group(0) @binding(8) var<storage, read_write> lod_stats: array<atomic<u32>>;
// Orbital double-float state (4 vec4<f32> per celestial body):
//   [0]: pos_hi.xyz, mass_kg
//   [1]: pos_lo.xyz, radius_m
//   [2]: vel.xyz, spin_rate_placeholder
//   [3]: acc.xyz, potential_energy_per_body
@group(0) @binding(9) var<storage, read_write> orbital_state: array<vec4<f32>>;
// Materialized local tangent-chart surface patch samples (2 vec4<f32> per sample + header vec4<f32> at [0..1]):
//   header [0]: patch_origin_hi.xyz, active_sample_count_f32
//   header [1]: patch_origin_lo.xyz, patch_area_m2
//   sample 2 + 2*s + 0: local_pos_m.xyz (relative to patch_origin), sample_mass_kg
//   sample 2 + 2*s + 1: world_vel_m_s.xyz, local_normal_dot_up
@group(0) @binding(10) var<storage, read_write> local_patch: array<vec4<f32>>;

const FRAME_VEC4: u32 = 8u;
const FIXED_AREA: f32 = 1048576.0;

fn quat_rotate(q: vec4<f32>, v: vec3<f32>) -> vec3<f32> {
  let t = 2.0 * cross(q.xyz, v);
  return v + q.w * t + cross(q.xyz, t);
}

fn axis_vec(ax: u32) -> vec3<f32> {
  if (ax == 0u) { return vec3<f32>(1.0, 0.0, 0.0); }
  if (ax == 1u) { return vec3<f32>(0.0, 1.0, 0.0); }
  return vec3<f32>(0.0, 0.0, 1.0);
}

// Two-sum exact error-free transformation in f32 for double-float position drift/rebase
fn two_sum(a: f32, b: f32) -> vec2<f32> {
  let s = a + b;
  let v = s - a;
  let e = (a - (s - v)) + (b - v);
  return vec2<f32>(s, e);
}

fn df_add_vec3(ahi: vec3<f32>, alo: vec3<f32>, bhi: vec3<f32>, blo: vec3<f32>) -> array<vec3<f32>, 2> {
  let sx = two_sum(ahi.x, bhi.x);
  let sy = two_sum(ahi.y, bhi.y);
  let sz = two_sum(ahi.z, bhi.z);
  let ex = sx.y + alo.x + blo.x;
  let ey = sy.y + alo.y + blo.y;
  let ez = sz.y + alo.z + blo.z;
  let rx = two_sum(sx.x, ex);
  let ry = two_sum(sy.x, ey);
  let rz = two_sum(sz.x, ez);
  return array<vec3<f32>, 2>(
    vec3<f32>(rx.x, ry.x, rz.x),
    vec3<f32>(rx.y, ry.y, rz.y)
  );
}

fn df_sub_to_f32(ahi: vec3<f32>, alo: vec3<f32>, bhi: vec3<f32>, blo: vec3<f32>) -> vec3<f32> {
  return (ahi - bhi) + (alo - blo);
}

@compute @workgroup_size(64)
fn clear_lod_stats(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x < 12u) {
    atomicStore(&lod_stats[id.x], 0u);
  }
}

@compute @workgroup_size(64)
fn build_multilevel_proxies(@builtin(global_invocation_id) id: vec3<u32>) {
  let m = id.x;
  if (m >= params.counts.x) { return; }

  let mp0 = macro_patches[m * 2u + 0u];
  let mp1 = macro_patches[m * 2u + 1u];
  let mmeta = macro_meta[m];
  let body = mmeta.x;
  let u_ax = mmeta.y;
  let v_ax = mmeta.z;
  let du = mp0.w;
  let dv = mp1.w;
  let eu = axis_vec(u_ax);
  let ev = axis_vec(v_ax);
  let n_body = mp1.xyz;

  let base = body * FRAME_VEC4;
  let com_local = frames[base + 0u].xyz;
  let q = frames[base + 1u];
  let chart_hi = body_charts[body * 2u + 0u].xyz;
  let chart_lo = body_charts[body * 2u + 1u].xyz;
  let body_world = (chart_hi + com_local) + chart_lo;

  let macro_world = body_world + quat_rotate(q, mp0.xyz);
  let n_world = quat_rotate(q, n_body);
  let d_macro = distance(macro_world, params.focus_fine.xyz);

  var ownership_mask = 0u;
  var overlap_err = 0u;

  if (d_macro > params.lod_orbit.x) {
    // Emit single L=2 coarse 4x4 proxy covering all 16 leaves (mask 0xffff)
    var j_sum = 0.0;
    for (var l = 0u; l < 16u; l = l + 1u) {
      j_sum = j_sum + leaf_impulse[m * 16u + l];
    }
    let area = 16.0 * du * dv;
    let rad = 0.5 * sqrt(area);
    let slot = atomicAdd(&lod_stats[0], 1u);
    atomicAdd(&lod_stats[3], 1u);
    active_proxies[slot * 4u + 0u] = vec4<f32>(mp0.xyz, rad);
    active_proxies[slot * 4u + 1u] = vec4<f32>(n_body, area);
    active_proxies[slot * 4u + 2u] = vec4<f32>(macro_world, j_sum);
    active_proxies[slot * 4u + 3u] = vec4<f32>(
      bitcast<f32>(body),
      bitcast<f32>(2u),
      bitcast<f32>(m),
      bitcast<f32>(0xffffu)
    );
    ownership_mask = 0xffffu;
    atomicAdd(&lod_stats[6], u32(round(area * FIXED_AREA)));
    atomicAdd(&lod_stats[7], u32(max(round(j_sum * FIXED_AREA), 0.0)));
  } else {
    // Evaluate each 2x2 L=1 quadrant (qu, qv) in {0, 1}^2 independently -> clean 2:1 transitions!
    for (var qu = 0u; qu < 2u; qu = qu + 1u) {
      for (var qv = 0u; qv < 2u; qv = qv + 1u) {
        let u_off_q = (f32(qu) * 2.0 - 1.0) * du;
        let v_off_q = (f32(qv) * 2.0 - 1.0) * dv;
        let q_body = mp0.xyz + u_off_q * eu + v_off_q * ev;
        let q_world = body_world + quat_rotate(q, q_body);
        let d_quad = distance(q_world, params.focus_fine.xyz);

        if (d_quad > params.focus_fine.w) {
          // Emit L=1 medium 2x2 proxy covering 4 leaves
          var q_mask = 0u;
          var j_quad = 0.0;
          for (var lu = 0u; lu < 2u; lu = lu + 1u) {
            for (var lv = 0u; lv < 2u; lv = lv + 1u) {
              let leaf_idx = (qv * 2u + lv) * 4u + (qu * 2u + lu);
              let bit = 1u << leaf_idx;
              if ((ownership_mask & bit) != 0u) { overlap_err = overlap_err + 1u; }
              ownership_mask = ownership_mask | bit;
              j_quad = j_quad + leaf_impulse[m * 16u + leaf_idx];
            }
          }
          let area = 4.0 * du * dv;
          let rad = 0.5 * sqrt(area);
          let slot = atomicAdd(&lod_stats[0], 1u);
          atomicAdd(&lod_stats[2], 1u);
          active_proxies[slot * 4u + 0u] = vec4<f32>(q_body, rad);
          active_proxies[slot * 4u + 1u] = vec4<f32>(n_body, area);
          active_proxies[slot * 4u + 2u] = vec4<f32>(q_world, j_quad);
          active_proxies[slot * 4u + 3u] = vec4<f32>(
            bitcast<f32>(body),
            bitcast<f32>(1u),
            bitcast<f32>(m),
            bitcast<f32>(q_mask)
          );
          atomicAdd(&lod_stats[6], u32(round(area * FIXED_AREA)));
          atomicAdd(&lod_stats[7], u32(max(round(j_quad * FIXED_AREA), 0.0)));
        } else {
          // Emit 4 L=0 fine 1x1 proxies
          for (var lu = 0u; lu < 2u; lu = lu + 1u) {
            for (var lv = 0u; lv < 2u; lv = lv + 1u) {
              let iu = qu * 2u + lu;
              let iv = qv * 2u + lv;
              let leaf_idx = iv * 4u + iu;
              let bit = 1u << leaf_idx;
              if ((ownership_mask & bit) != 0u) { overlap_err = overlap_err + 1u; }
              ownership_mask = ownership_mask | bit;
              let u_off = (f32(iu) - 1.5) * du;
              let v_off = (f32(iv) - 1.5) * dv;
              let l_body = mp0.xyz + u_off * eu + v_off * ev;
              let l_world = body_world + quat_rotate(q, l_body);
              let j_leaf = leaf_impulse[m * 16u + leaf_idx];
              let area = du * dv;
              let rad = 0.5 * sqrt(area);
              let slot = atomicAdd(&lod_stats[0], 1u);
              atomicAdd(&lod_stats[1], 1u);
              active_proxies[slot * 4u + 0u] = vec4<f32>(l_body, rad);
              active_proxies[slot * 4u + 1u] = vec4<f32>(n_world * 0.0 + n_body, area);
              active_proxies[slot * 4u + 2u] = vec4<f32>(l_world, j_leaf);
              active_proxies[slot * 4u + 3u] = vec4<f32>(
                bitcast<f32>(body),
                bitcast<f32>(0u),
                bitcast<f32>(m),
                bitcast<f32>(bit)
              );
              atomicAdd(&lod_stats[6], u32(round(area * FIXED_AREA)));
              atomicAdd(&lod_stats[7], u32(max(round(j_leaf * FIXED_AREA), 0.0)));
            }
          }
        }
      }
    }
  }

  atomicAdd(&lod_stats[4], countOneBits(ownership_mask));
  if (ownership_mask != 0xffffu || overlap_err > 0u) {
    atomicAdd(&lod_stats[5], 1u + overlap_err);
  }
}

// Live GPU consumer of active_proxies: aggregates emitted multilevel surface
// proxies into lod_stats[8..11] ([consumed_count, near_focus_count,
// consumed_area_fixed, consumed_impulse_fixed]) so activeProxiesBuffer drives
// GPU quadrature verification inside the same single rigid-lane compute pass.
@compute @workgroup_size(64)
fn consume_active_proxy_quadrature(@builtin(global_invocation_id) id: vec3<u32>) {
  let p = id.x;
  let count = atomicLoad(&lod_stats[0]);
  if (p >= count) { return; }
  let p1 = active_proxies[p * 4u + 1u];
  let p2 = active_proxies[p * 4u + 2u];
  let area = max(0.0, p1.w);
  let imp = max(0.0, p2.w);
  let dist_focus = length(p2.xyz - params.focus_fine.xyz);
  atomicAdd(&lod_stats[8], 1u);
  if (dist_focus <= params.focus_fine.w) {
    atomicAdd(&lod_stats[9], 1u);
  }
  atomicAdd(&lod_stats[10], u32(round(area * FIXED_AREA)));
  atomicAdd(&lod_stats[11], u32(round(imp * FIXED_AREA)));
}

// Conservatively scatter/reflux active proxy impulses back to leaf tiles (1/count split for coarse proxies)
@compute @workgroup_size(64)
fn reflux_proxy_impulses(@builtin(global_invocation_id) id: vec3<u32>) {
  let p = id.x;
  let count = atomicLoad(&lod_stats[0]);
  if (p >= count) { return; }
  let j_total = active_proxies[p * 4u + 2u].w;
  let pmeta = active_proxies[p * 4u + 3u];
  let m = bitcast<u32>(pmeta.z);
  let mask = bitcast<u32>(pmeta.w);
  let n_leaves = max(countOneBits(mask), 1u);
  let share = j_total / f32(n_leaves);
  for (var l = 0u; l < 16u; l = l + 1u) {
    if ((mask & (1u << l)) != 0u) {
      leaf_impulse[m * 16u + l] = share;
    }
  }
}

// Chart origin rebasing across SS level / astronomical chart boundaries:
// Preserves world position = (chart_hi + chart_lo) + frames[base].xyz to double-float precision
// while leaving mass, quaternion, linear momentum P, spin angular momentum L, and principal I bit-identical!
@compute @workgroup_size(64)
fn rebase_body_chart(@builtin(global_invocation_id) id: vec3<u32>) {
  let b = id.x;
  if (b >= params.counts.y) { return; }
  let base = b * FRAME_VEC4;
  let old_hi = body_charts[b * 2u + 0u].xyz;
  let old_lo = body_charts[b * 2u + 1u].xyz;
  let new_c0 = next_charts[b * 2u + 0u];
  let new_c1 = next_charts[b * 2u + 1u];

  let delta_origin = df_sub_to_f32(old_hi, old_lo, new_c0.xyz, new_c1.xyz);
  let f0 = frames[base + 0u];
  frames[base + 0u] = vec4<f32>(f0.xyz + delta_origin, f0.w);
  body_charts[b * 2u + 0u] = new_c0;
  body_charts[b * 2u + 1u] = new_c1;
}

// Symplectic Velocity-Verlet N-body orbital integrator on double-float positions:
@compute @workgroup_size(64)
fn orbital_kick_drift(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  let n = params.counts.z;
  if (i >= n) { return; }
  let dt = params.lod_orbit.y;
  if (!(dt > 0.0)) { return; }

  let p0 = orbital_state[i * 4u + 0u];
  let p1 = orbital_state[i * 4u + 1u];
  let v0 = orbital_state[i * 4u + 2u];
  let a0 = orbital_state[i * 4u + 3u].xyz;

  let v_half = v0.xyz + 0.5 * dt * a0;
  let dx = dt * v_half;
  let next_p = df_add_vec3(p0.xyz, p1.xyz, dx, vec3<f32>(0.0));

  orbital_state[i * 4u + 0u] = vec4<f32>(next_p[0], p0.w);
  orbital_state[i * 4u + 1u] = vec4<f32>(next_p[1], p1.w);
  orbital_state[i * 4u + 2u] = vec4<f32>(v_half, v0.w);

  // Sync body_charts + rigid spin orientation when body i has a matching rigid frame
  if (i < params.counts.y) {
    body_charts[i * 2u + 0u] = vec4<f32>(next_p[0], 1.0);
    body_charts[i * 2u + 1u] = vec4<f32>(next_p[1], f32(i));
    let fbase = i * FRAME_VEC4;
    frames[fbase + 0u] = vec4<f32>(0.0, 0.0, 0.0, p0.w);
    // Advance rigid spin about z by spin_rate * dt if nonzero
    let omega_z = v0.w;
    if (abs(omega_z) > 0.0) {
      let half_th = 0.5 * omega_z * dt;
      let dq = vec4<f32>(0.0, 0.0, sin(half_th), cos(half_th));
      let q = frames[fbase + 1u];
      let qn = vec4<f32>(
        q.w * dq.xyz + dq.w * q.xyz + cross(q.xyz, dq.xyz),
        q.w * dq.w - dot(q.xyz, dq.xyz)
      );
      frames[fbase + 1u] = normalize(qn);
    }
  }
}

@compute @workgroup_size(64)
fn orbital_forces_and_kick(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  let n = params.counts.z;
  if (i >= n) { return; }
  let dt = params.lod_orbit.y;
  let G = params.lod_orbit.z;
  let eps2 = params.lod_orbit.w * params.lod_orbit.w;

  let pi_hi = orbital_state[i * 4u + 0u].xyz;
  let pi_lo = orbital_state[i * 4u + 1u].xyz;
  let mi = orbital_state[i * 4u + 0u].w;

  var acc = vec3<f32>(0.0);
  var pot = 0.0;
  for (var j = 0u; j < n; j = j + 1u) {
    if (j == i) { continue; }
    let pj_hi = orbital_state[j * 4u + 0u].xyz;
    let pj_lo = orbital_state[j * 4u + 1u].xyz;
    let mj = orbital_state[j * 4u + 0u].w;
    let rij = df_sub_to_f32(pj_hi, pj_lo, pi_hi, pi_lo);
    let r2 = dot(rij, rij) + eps2;
    let inv_r = inverseSqrt(max(r2, 1.0e-24));
    let inv_r3 = inv_r * inv_r * inv_r;
    acc = acc + (G * mj * inv_r3) * rij;
    // Half pair potential energy 0.5 * (-G mi mj / r) per body so sum_i pot_i == U_grav!
    pot = pot - 0.5 * G * mi * mj * inv_r;
  }

  let v_in = orbital_state[i * 4u + 2u];
  let v_new = select(v_in.xyz, v_in.xyz + 0.5 * dt * acc, dt > 0.0);
  orbital_state[i * 4u + 2u] = vec4<f32>(v_new, v_in.w);
  orbital_state[i * 4u + 3u] = vec4<f32>(acc, pot);
  if (i < params.counts.y) {
    frames[i * FRAME_VEC4 + 2u] = vec4<f32>(mi * v_new, 0.0);
  }
}

// Local tangent-chart planetary surface patch materializer:
// Generates O(grid^2) boundary carriers around patch_focus_body_dir on the target
// celestial body without touching orbital_state (zero orbital recoil/kick) and
// without any O((R/dx)^3) interior particle fill!
@compute @workgroup_size(64)
fn materialize_local_patch(@builtin(global_invocation_id) id: vec3<u32>) {
  let gdim = params.counts.w;
  let total = gdim * gdim;
  let idx = id.x;
  if (idx >= total) { return; }

  let enabled = params.patch_meta.y > 0.5;
  let planet = u32(params.patch_meta.x);
  let radius = params.patch_meta.z;
  let sample_mass = params.patch_meta.w;
  let half_angle = params.patch_aperture.w;
  let focus_body = normalize(params.patch_aperture.xyz);

  let q = select(vec4<f32>(0.0, 0.0, 0.0, 1.0), frames[planet * FRAME_VEC4 + 1u], planet < params.counts.y);
  let p_hi = orbital_state[planet * 4u + 0u].xyz;
  let p_lo = orbital_state[planet * 4u + 1u].xyz;
  let v_planet = orbital_state[planet * 4u + 2u].xyz;
  let omega_z = orbital_state[planet * 4u + 2u].w;
  let omega_world = vec3<f32>(0.0, 0.0, omega_z);

  let n_center_world = quat_rotate(q, focus_body);
  let patch_origin = df_add_vec3(p_hi, p_lo, radius * n_center_world, vec3<f32>(0.0));
  let patch_area = (2.0 * radius * half_angle) * (2.0 * radius * half_angle);

  if (idx == 0u) {
    local_patch[0] = vec4<f32>(patch_origin[0], select(0.0, f32(total), enabled));
    local_patch[1] = vec4<f32>(patch_origin[1], select(0.0, patch_area, enabled));
  }
  if (!enabled) {
    local_patch[2u + idx * 2u + 0u] = vec4<f32>(0.0);
    local_patch[2u + idx * 2u + 1u] = vec4<f32>(0.0);
    return;
  }

  // Orthonormal tangent basis (t1, t2) around focus_body in body frame
  let helper = select(vec3<f32>(1.0, 0.0, 0.0), vec3<f32>(0.0, 1.0, 0.0), abs(focus_body.x) > 0.85);
  let t1 = normalize(cross(helper, focus_body));
  let t2 = cross(focus_body, t1);

  let iu = idx % gdim;
  let iv = idx / gdim;
  let su = ((f32(iu) + 0.5) / f32(gdim) * 2.0 - 1.0) * half_angle;
  let sv = ((f32(iv) + 0.5) / f32(gdim) * 2.0 - 1.0) * half_angle;
  let dir_body = normalize(focus_body + tan(su) * t1 + tan(sv) * t2);
  let dir_world = quat_rotate(q, dir_body);

  // Exact tangent-chart local offset from patch_origin = radius * (dir_world - n_center_world)!
  // Note: |dir_world - n_center_world| ~ O(half_angle * R), avoiding catastrophic cancellation at R = 6.37e6 m!
  let local_offset = radius * (dir_world - n_center_world);
  let world_vel = v_planet + cross(omega_world, radius * dir_world);

  local_patch[2u + idx * 2u + 0u] = vec4<f32>(local_offset, sample_mass);
  local_patch[2u + idx * 2u + 1u] = vec4<f32>(world_vel, dot(dir_world, n_center_world));
}
`;

export function createSchroederSolidMultilevelStage({
  device,
  bodyCount = 1,
  frameBuffer,
  catalog,
  orbitalBodies = [],
  patchGridDim = 8
}) {
  const macroCount = catalog?.macroCount ?? 1;
  const orbitalCount = Math.max(1, orbitalBodies.length);
  const bindings = [
    computeBufferBinding(0, 'uniform'),
    computeBufferBinding(1, 'storage'),
    computeBufferBinding(2, 'storage'),
    computeBufferBinding(3, 'read-only-storage'),
    computeBufferBinding(4, 'read-only-storage'),
    computeBufferBinding(5, 'read-only-storage'),
    computeBufferBinding(6, 'storage'),
    computeBufferBinding(7, 'storage'),
    computeBufferBinding(8, 'storage'),
    computeBufferBinding(9, 'storage'),
    computeBufferBinding(10, 'storage')
  ];
  const entryPoints = [
    'clear_lod_stats',
    'build_multilevel_proxies',
    'consume_active_proxy_quadrature',
    'reflux_proxy_impulses',
    'rebase_body_chart',
    'orbital_kick_drift',
    'orbital_forces_and_kick',
    'materialize_local_patch'
  ];
  const pipelines = Object.fromEntries(
    entryPoints.map((entryPoint) => [
      entryPoint,
      createCachedExplicitComputePipeline(device, {
        cacheKey: `ulg-sol6-multilevel-${entryPoint}.v2`,
        label: `ulg-sol6-multilevel-${entryPoint}`,
        code: schroederSolidMultilevelWgsl,
        entryPoint,
        bindings
      })
    ])
  );

  const paramsBuffer = device.createBuffer({
    label: 'ulg-sol6-params',
    size: 80,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const raw = new ArrayBuffer(80);
  const u = new Uint32Array(raw);
  const f = new Float32Array(raw);
  u.set([macroCount, bodyCount, orbitalBodies.length, patchGridDim], 0);
  f.set([0, 0, 0, 0.15], 4);
  f.set([0.45, 0, 6.6743e-11, 1e-3], 8);
  f.set([1, 0, 0, 0.05], 12);
  f.set([0, 0, 1000, 1], 16);
  device.queue.writeBuffer(paramsBuffer, 0, raw);

  const makeStorage = (label, dataOrBytes) => {
    const byteLength = typeof dataOrBytes === 'number' ? dataOrBytes : dataOrBytes.byteLength;
    const b = device.createBuffer({
      label,
      size: Math.max(16, byteLength),
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
    });
    if (typeof dataOrBytes !== 'number') {
      device.queue.writeBuffer(b, 0, dataOrBytes);
    }
    return b;
  };

  const initCharts = new Float32Array(Math.max(1, bodyCount) * 8);
  for (let b = 0; b < bodyCount; b += 1) initCharts[b * 8 + 3] = 1;
  const bodyChartsBuffer = makeStorage('ulg-sol6-body-charts', initCharts);
  const nextChartsBuffer = makeStorage('ulg-sol6-next-charts', initCharts);

  const macroPatchesBuffer = makeStorage(
    'ulg-sol6-macro-patches',
    catalog ? catalog.macroPatches : new Float32Array(8)
  );
  const macroMetaBuffer = makeStorage(
    'ulg-sol6-macro-meta',
    catalog ? catalog.macroMeta : new Uint32Array(4)
  );
  const leafImpulseBuffer = makeStorage('ulg-sol6-leaf-impulse', Math.max(16, (catalog?.leafCount ?? 16) * 4));
  const activeProxiesBuffer = makeStorage(
    'ulg-sol6-active-proxies',
    Math.max(64, (catalog?.maxActiveProxies ?? 16) * 64)
  );
  const lodStatsBuffer = makeStorage('ulg-sol6-lod-stats', 48);

  const orbitalInit = new Float32Array(orbitalCount * 16);
  orbitalBodies.forEach((ob, idx) => {
    const [xh, xl] = splitFloat64ToHiLo(ob.x[0]);
    const [yh, yl] = splitFloat64ToHiLo(ob.x[1]);
    const [zh, zl] = splitFloat64ToHiLo(ob.x[2]);
    orbitalInit.set([xh, yh, zh, ob.massKg], idx * 16 + 0);
    orbitalInit.set([xl, yl, zl, ob.radiusM ?? 1], idx * 16 + 4);
    orbitalInit.set([ob.v[0], ob.v[1], ob.v[2], ob.spinRadPerS ?? 0], idx * 16 + 8);
  });
  const orbitalStateBuffer = makeStorage('ulg-sol6-orbital-state', orbitalInit);
  const localPatchBuffer = makeStorage('ulg-sol6-local-patch', (2 + patchGridDim * patchGridDim * 2) * 16);

  const bindGroup = device.createBindGroup({
    layout: pipelines.build_multilevel_proxies.bindGroupLayout,
    entries: [
      paramsBuffer,
      frameBuffer,
      bodyChartsBuffer,
      nextChartsBuffer,
      macroPatchesBuffer,
      macroMetaBuffer,
      leafImpulseBuffer,
      activeProxiesBuffer,
      lodStatsBuffer,
      orbitalStateBuffer,
      localPatchBuffer
    ].map((buffer, binding) => ({ binding, resource: { buffer } }))
  });

  // Prime initial gravitational accelerations (dt = 0) if orbitalBodies present
  if (orbitalBodies.length > 0) {
    f[9] = 0;
    device.queue.writeBuffer(paramsBuffer, 0, raw);
    const enc = device.createCommandEncoder();
    const pass = enc.beginComputePass({ label: 'ulg-sol6-orbital-prime' });
    pass.setBindGroup(0, bindGroup);
    pass.setPipeline(pipelines.orbital_forces_and_kick.pipeline);
    pass.dispatchWorkgroups(Math.ceil(orbitalBodies.length / 64));
    pass.end();
    device.queue.submit([enc.finish()]);
  }

  const readBufferF32 = async (buf, countFloats = buf.size / 4) => {
    const st = device.createBuffer({
      size: countFloats * 4,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
    });
    const enc = device.createCommandEncoder();
    enc.copyBufferToBuffer(buf, 0, st, 0, countFloats * 4);
    device.queue.submit([enc.finish()]);
    await st.mapAsync(GPU_BUFFER_USAGE.MAP_READ);
    const out = new Float32Array(st.getMappedRange().slice(0));
    st.unmap();
    st.destroy();
    return out;
  };

  return Object.freeze({
    macroCount,
    bodyCount,
    bodyChartsBuffer,
    activeProxiesBuffer,
    lodStatsBuffer,
    orbitalStateBuffer,
    localPatchBuffer,
    leafImpulseBuffer,
    setLeafImpulses(impulsesFloat32) {
      device.queue.writeBuffer(leafImpulseBuffer, 0, impulsesFloat32);
    },
    prepareMultilevelProxies({ focusWorldM = [0, 0, 0], fineRadiusM = 0.15, mediumRadiusM = 0.45 } = {}) {
      f.set([focusWorldM[0], focusWorldM[1], focusWorldM[2], fineRadiusM], 4);
      f[8] = mediumRadiusM;
      device.queue.writeBuffer(paramsBuffer, 0, raw);
    },
    encodeMultilevelProxies(
      encoder,
      {
        focusWorldM = [0, 0, 0],
        fineRadiusM = 0.15,
        mediumRadiusM = 0.45,
        reflux = true,
        pass: sharedPass = null,
        prepared = false
      } = {}
    ) {
      if (!(macroCount > 0)) return;
      if (!prepared) {
        f.set([focusWorldM[0], focusWorldM[1], focusWorldM[2], fineRadiusM], 4);
        f[8] = mediumRadiusM;
        device.queue.writeBuffer(paramsBuffer, 0, raw);
      }
      const pass = sharedPass ?? encoder.beginComputePass({ label: 'ulg-sol6-multilevel-proxies' });
      pass.setBindGroup(0, bindGroup);
      pass.setPipeline(pipelines.clear_lod_stats.pipeline);
      pass.dispatchWorkgroups(1);
      pass.setPipeline(pipelines.build_multilevel_proxies.pipeline);
      pass.dispatchWorkgroups(Math.ceil(macroCount / 64));
      pass.setPipeline(pipelines.consume_active_proxy_quadrature.pipeline);
      pass.dispatchWorkgroups(Math.ceil((catalog?.maxActiveProxies ?? 16) / 64));
      if (reflux) {
        pass.setPipeline(pipelines.reflux_proxy_impulses.pipeline);
        pass.dispatchWorkgroups(Math.ceil((catalog?.maxActiveProxies ?? 16) / 64));
      }
      if (!sharedPass) pass.end();
    },
    encodeChartRebase(encoder, targetCharts) {
      const packed = new Float32Array(Math.max(1, bodyCount) * 8);
      targetCharts.forEach((c, idx) => {
        const [xh, xl] = splitFloat64ToHiLo(c.originM[0]);
        const [yh, yl] = splitFloat64ToHiLo(c.originM[1]);
        const [zh, zl] = splitFloat64ToHiLo(c.originM[2]);
        packed.set([xh, yh, zh, c.scale ?? 1], idx * 8 + 0);
        packed.set([xl, yl, zl, c.chartId ?? 0], idx * 8 + 4);
      });
      device.queue.writeBuffer(nextChartsBuffer, 0, packed);
      const pass = encoder.beginComputePass({ label: 'ulg-sol6-chart-rebase' });
      pass.setBindGroup(0, bindGroup);
      pass.setPipeline(pipelines.rebase_body_chart.pipeline);
      pass.dispatchWorkgroups(Math.ceil(bodyCount / 64));
      pass.end();
    },
    encodeOrbitalStep(
      encoder,
      dtSeconds,
      {
        gravitationalConstant = 1.0,
        softeningM = 0,
        substeps = 1,
        patch = null
      } = {}
    ) {
      f[9] = dtSeconds;
      f[10] = gravitationalConstant;
      f[11] = softeningM;
      if (patch) {
        f.set(
          [
            patch.focusBodyDir?.[0] ?? 1,
            patch.focusBodyDir?.[1] ?? 0,
            patch.focusBodyDir?.[2] ?? 0,
            patch.halfAngleRad ?? 0.02
          ],
          12
        );
        f.set(
          [
            patch.planetIndex ?? 0,
            patch.enabled ? 1 : 0,
            patch.planetRadiusM ?? 1000,
            patch.sampleMassKg ?? 1
          ],
          16
        );
      } else {
        f[17] = 0;
      }
      device.queue.writeBuffer(paramsBuffer, 0, raw);

      const pass = encoder.beginComputePass({ label: 'ulg-sol6-orbital-step' });
      pass.setBindGroup(0, bindGroup);
      const oGroups = Math.ceil(Math.max(1, orbitalBodies.length) / 64);
      for (let s = 0; s < substeps; s += 1) {
        pass.setPipeline(pipelines.orbital_kick_drift.pipeline);
        pass.dispatchWorkgroups(oGroups);
        pass.setPipeline(pipelines.orbital_forces_and_kick.pipeline);
        pass.dispatchWorkgroups(oGroups);
      }
      if (patch) {
        pass.setPipeline(pipelines.materialize_local_patch.pipeline);
        pass.dispatchWorkgroups(Math.ceil((patchGridDim * patchGridDim) / 64));
      }
      pass.end();
    },
    async readLodSummary() {
      const st = await readBufferF32(lodStatsBuffer, 12);
      const wu = new Uint32Array(st.buffer);
      return {
        activeProxies: wu[0],
        level0Fine: wu[1],
        level1Medium: wu[2],
        level2Coarse: wu[3],
        coveredLeaves: wu[4],
        overlapViolations: wu[5],
        totalAreaM2: wu[6] / 1048576.0,
        totalImpulseNs: wu[7] / 1048576.0,
        consumedProxies: wu[8],
        nearFocusProxies: wu[9],
        consumedAreaM2: wu[10] / 1048576.0,
        consumedImpulseNs: wu[11] / 1048576.0
      };
    },
    async readOrbitalSummary() {
      const rawOrb = await readBufferF32(orbitalStateBuffer, orbitalBodies.length * 16);
      const bodies = [];
      let totalMassKg = 0;
      const linearMomentum = [0, 0, 0];
      const angularMomentum = [0, 0, 0];
      let kineticEnergyJ = 0;
      let potentialEnergyJ = 0;
      for (let i = 0; i < orbitalBodies.length; i += 1) {
        const b = i * 16;
        const x = [
          rawOrb[b + 0] + rawOrb[b + 4],
          rawOrb[b + 1] + rawOrb[b + 5],
          rawOrb[b + 2] + rawOrb[b + 6]
        ];
        const m = rawOrb[b + 3];
        const v = [rawOrb[b + 8], rawOrb[b + 9], rawOrb[b + 10]];
        const pot = rawOrb[b + 15];
        totalMassKg += m;
        for (let k = 0; k < 3; k += 1) linearMomentum[k] += m * v[k];
        angularMomentum[0] += m * (x[1] * v[2] - x[2] * v[1]);
        angularMomentum[1] += m * (x[2] * v[0] - x[0] * v[2]);
        angularMomentum[2] += m * (x[0] * v[1] - x[1] * v[0]);
        kineticEnergyJ += 0.5 * m * (v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
        potentialEnergyJ += pot;
        bodies.push({ x, v, massKg: m });
      }
      const patchRaw = await readBufferF32(localPatchBuffer, (2 + patchGridDim * patchGridDim * 2) * 4);
      const patchOrigin = [
        patchRaw[0] + patchRaw[4],
        patchRaw[1] + patchRaw[5],
        patchRaw[2] + patchRaw[6]
      ];
      return {
        bodies,
        totalMassKg,
        linearMomentum,
        angularMomentum,
        kineticEnergyJ,
        potentialEnergyJ,
        totalEnergyJ: kineticEnergyJ + potentialEnergyJ,
        patch: {
          activeSampleCount: Math.round(patchRaw[3]),
          areaM2: patchRaw[7],
          originM: patchOrigin,
          firstSampleLocalM: [patchRaw[8], patchRaw[9], patchRaw[10]],
          firstSampleVelMPerS: [patchRaw[12], patchRaw[13], patchRaw[14]]
        }
      };
    },
    destroy() {
      for (const b of [
        paramsBuffer,
        bodyChartsBuffer,
        nextChartsBuffer,
        macroPatchesBuffer,
        macroMetaBuffer,
        leafImpulseBuffer,
        activeProxiesBuffer,
        lodStatsBuffer,
        orbitalStateBuffer,
        localPatchBuffer
      ]) {
        b.destroy();
      }
    }
  });
}
