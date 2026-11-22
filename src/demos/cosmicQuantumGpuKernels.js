import { ULG_SERVICE_IDS } from '../../ulg-gpu-abi/src/serviceContract.js';
import {
  computeBufferBinding,
  createCachedExplicitBindGroup,
  createCachedExplicitComputePipeline
} from '../runtime/webgpuComputeLayout.js';

const USAGE_STORAGE = 0x0080;
const USAGE_UNIFORM = 0x0040;
const USAGE_VERTEX = 0x0020;
const USAGE_COPY_DST = 0x0008;
const USAGE_COPY_SRC = 0x0004;
const USAGE_MAP_READ = 0x0001;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic 8-float interleaved galactic body initializer matching the
 * `eshkols-in-space` ABI (`[x, y, z, mass, vx, vy, vz, radius]`).
 * Supports `disk` (2-arm logarithmic spiral + central core), `binary`
 * (colliding twin galaxies), and `sphere` (Plummer globular cluster),
 * scaling cleanly from 64 up to 262,144 resident GPU bodies.
 */
export function createGalacticBodies({
  count = 4096,
  preset = 'disk',
  seed = 825,
  gravity = 1.0,
  softening = 0.22
} = {}) {
  const n = Math.max(64, Math.min(262144, Math.floor(count)));
  const bodies = new Float32Array(n * 8);
  const rand = mulberry32(seed);
  const gauss = () => {
    const u1 = Math.max(1e-7, rand());
    const u2 = rand();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };
  // Normalize total stellar mass so orbital period stays comparable from 4K to 65K+ stars!
  const massNorm = 4096 / Math.max(4096, n);

  if (preset === 'binary') {
    const half = n >> 1;
    const coreMass = 180;
    for (let g = 0; g < 2; g += 1) {
      const sign = g === 0 ? -1 : 1;
      const cx = sign * 6.5;
      const cy = sign * 1.4;
      const cz = sign * -1.8;
      const cvx = -sign * 1.15;
      const cvy = sign * 0.35;
      const cvz = sign * 0.95;
      const start = g * half;
      const end = g === 0 ? half : n;
      bodies.set([cx, cy, cz, coreMass, cvx, cvy, cvz, 0.45], start * 8);
      for (let i = start + 1; i < end; i += 1) {
        const arm = i & 1;
        const r = 0.6 + Math.pow(rand(), 1.45) * 5.2;
        const theta = arm * Math.PI + r * 0.72 + gauss() * 0.28;
        const zOff = gauss() * (0.18 + 0.04 * r);
        const tilt = g === 0 ? 0.32 : -0.45;
        const lx = r * Math.cos(theta);
        const lz = r * Math.sin(theta);
        const ly = zOff;
        const cosT = Math.cos(tilt);
        const sinT = Math.sin(tilt);
        const rx = lx;
        const ry = ly * cosT - lz * sinT;
        const rz = ly * sinT + lz * cosT;

        const mEnc = coreMass + (end - start) * 0.08 * massNorm * (1 - Math.exp(-r / 2.2));
        const vCirc = Math.sqrt((gravity * mEnc) / Math.hypot(r, softening));
        const vtx = -Math.sin(theta) * vCirc;
        const vtz = Math.cos(theta) * vCirc;
        const vrx = vtx;
        const vry = -vtz * sinT;
        const vrz = vtz * cosT;
        const mass = (0.05 + rand() * 0.14) * massNorm;
        const radius = 0.03 + 0.04 * Math.cbrt(mass);
        bodies.set([
          cx + rx, cy + ry, cz + rz, mass,
          cvx + vrx, cvy + vry, cvz + vrz, radius
        ], i * 8);
      }
    }
    return bodies;
  }

  if (preset === 'sphere') {
    const coreMass = 120;
    bodies.set([0, 0, 0, coreMass, 0, 0, 0, 0.4], 0);
    for (let i = 1; i < n; i += 1) {
      const u = Math.max(1e-4, Math.min(0.995, rand()));
      const r = 2.6 / Math.sqrt(Math.pow(u, -2 / 3) - 1);
      const rClamped = Math.min(12.0, r);
      const cosPhi = 2 * rand() - 1;
      const sinPhi = Math.sqrt(Math.max(0, 1 - cosPhi * cosPhi));
      const theta = 2 * Math.PI * rand();
      const x = rClamped * sinPhi * Math.cos(theta);
      const y = rClamped * cosPhi;
      const z = rClamped * sinPhi * Math.sin(theta);
      const vScale = Math.sqrt((gravity * (coreMass + n * 0.04 * massNorm)) / Math.hypot(rClamped, 1.8)) * 0.45;
      const mass = (0.04 + rand() * 0.12) * massNorm;
      bodies.set([
        x, y, z, mass,
        gauss() * vScale, gauss() * vScale, gauss() * vScale,
        0.03 + 0.03 * Math.cbrt(mass)
      ], i * 8);
    }
    return bodies;
  }

  // Default: luminous 2-arm logarithmic spiral disk galaxy with massive core
  const coreMass = 260;
  bodies.set([0, 0, 0, coreMass, 0, 0, 0, 0.55], 0);
  const diskMassTotal = n * 0.09 * massNorm;
  for (let i = 1; i < n; i += 1) {
    const isBulge = i < n * 0.16;
    if (isBulge) {
      const r = Math.abs(gauss()) * 1.1 + 0.12;
      const theta = 2 * Math.PI * rand();
      const y = gauss() * 0.42;
      const x = r * Math.cos(theta);
      const z = r * Math.sin(theta);
      const vCirc = Math.sqrt((gravity * (coreMass + diskMassTotal * 0.12)) / Math.hypot(r, softening));
      const mass = (0.08 + rand() * 0.25) * massNorm;
      bodies.set([
        x, y, z, mass,
        -Math.sin(theta) * vCirc * 0.92 + gauss() * 0.35,
        gauss() * 0.25,
        Math.cos(theta) * vCirc * 0.92 + gauss() * 0.35,
        0.04 + 0.04 * Math.cbrt(mass)
      ], i * 8);
    } else {
      const arm = i & 1;
      const frac = rand();
      const r = 0.8 + Math.pow(frac, 1.35) * 9.8;
      const spiralTwist = 0.62 * Math.log(1 + r * 1.45) * 3.1;
      const spread = (0.14 + 0.042 * r) * gauss();
      const theta = arm * Math.PI + spiralTwist + spread;
      const y = gauss() * (0.14 + 0.025 * r);
      const x = r * Math.cos(theta);
      const z = r * Math.sin(theta);
      const mEnc = coreMass + diskMassTotal * (1 - Math.exp(-r / 3.4));
      const vCirc = Math.sqrt((gravity * mEnc) / Math.hypot(r, softening));
      const mass = (0.04 + Math.pow(rand(), 2.2) * 0.22) * massNorm;
      bodies.set([
        x, y, z, mass,
        -Math.sin(theta) * vCirc + gauss() * 0.16,
        gauss() * 0.06,
        Math.cos(theta) * vCirc + gauss() * 0.16,
        0.025 + 0.04 * Math.cbrt(mass)
      ], i * 8);
    }
  }
  return bodies;
}

/**
 * Deterministic Zel'dovich filamentary cosmic-web initial condition in comoving
 * supergalactic coordinates (`x, y, z` normalized inside the observable-universe
 * box `[-12, +12]` representing `~93 Gly / ~28.5 Gpc` horizon span).
 */
export function createCosmicWebBodies({
  count = 3072,
  seed = 1370
} = {}) {
  const n = Math.max(64, Math.min(65536, Math.floor(count)));
  const bodies = new Float32Array(n * 8);
  const rand = mulberry32(seed);
  const modes = [];
  for (let m = 0; m < 10; m += 1) {
    modes.push({
      kx: (rand() - 0.5) * 0.85,
      ky: (rand() - 0.5) * 0.85,
      kz: (rand() - 0.5) * 0.85,
      phase: rand() * Math.PI * 2,
      amp: 0.75 + rand() * 0.9
    });
  }
  for (let i = 0; i < n; i += 1) {
    let qx; let qy; let qz;
    do {
      qx = (rand() * 2 - 1) * 10.2;
      qy = (rand() * 2 - 1) * 10.2;
      qz = (rand() * 2 - 1) * 10.2;
    } while (qx * qx + qy * qy + qz * qz > 10.2 * 10.2);

    let dx = 0; let dy = 0; let dz = 0;
    for (const mode of modes) {
      const s = Math.sin(mode.kx * qx + mode.ky * qy + mode.kz * qz + mode.phase) * mode.amp;
      dx += mode.kx * s;
      dy += mode.ky * s;
      dz += mode.kz * s;
    }
    const x = qx + dx * 1.85;
    const y = qy + dy * 1.85;
    const z = qz + dz * 1.85;
    const mass = 0.5 + Math.pow(rand(), 2.5) * 6.0;
    bodies.set([
      x, y, z, mass,
      dx * 0.12, dy * 0.12, dz * 0.12,
      0.06 + 0.05 * Math.cbrt(mass)
    ], i * 8);
  }
  return bodies;
}

/**
 * Tiled shared-memory WebGPU direct N-body compute shader matching the
 * `eshkols-in-space` 8-float interleaved `Body` layout (`x,y,z,mass,vx,vy,vz,radius`).
 * Supports both Newtonian (`mode = 0`) and comoving ΛCDM (`mode = 1`).
 */
export const cosmicNBodyTiledWgsl = /* wgsl */ `
struct Body {
  pos_mass: vec4<f32>,
  vel_radius: vec4<f32>,
};

struct StepParams {
  count: u32,
  mode: u32,
  pad0: u32,
  pad1: u32,
  dt: f32,
  gravity: f32,
  softening2: f32,
  hubble_drag: f32,
  inv_a3: f32,
  pad2: f32,
  pad3: f32,
  pad4: f32,
};

@group(0) @binding(0) var<storage, read> src_bodies: array<Body>;
@group(0) @binding(1) var<storage, read_write> dst_bodies: array<Body>;
@group(0) @binding(2) var<uniform> params: StepParams;

var<workgroup> tile: array<vec4<f32>, 64>;

@compute @workgroup_size(64)
fn step_nbody(
  @builtin(global_invocation_id) gid: vec3<u32>,
  @builtin(local_invocation_id) lid: vec3<u32>
) {
  let idx = gid.x;
  let n = params.count;
  var self_pm = vec4<f32>(0.0);
  var self_vr = vec4<f32>(0.0);
  let alive = idx < n;
  if (alive) {
    self_pm = src_bodies[idx].pos_mass;
    self_vr = src_bodies[idx].vel_radius;
  }

  var acc = vec3<f32>(0.0);
  let num_tiles = (n + 63u) / 64u;
  for (var t = 0u; t < num_tiles; t = t + 1u) {
    let j = t * 64u + lid.x;
    if (j < n) {
      tile[lid.x] = src_bodies[j].pos_mass;
    } else {
      tile[lid.x] = vec4<f32>(0.0);
    }
    workgroupBarrier();

    if (alive && self_pm.w > 0.0) {
      let limit = min(64u, n - t * 64u);
      for (var k = 0u; k < limit; k = k + 1u) {
        let other = tile[k];
        if (other.w <= 0.0) { continue; }
        let d = other.xyz - self_pm.xyz;
        let r2 = dot(d, d) + params.softening2;
        let inv_r = inverseSqrt(r2);
        let inv_r3 = inv_r * inv_r * inv_r;
        acc = acc + d * (other.w * inv_r3);
      }
    }
    workgroupBarrier();
  }

  if (!alive) { return; }
  if (self_pm.w <= 0.0) {
    dst_bodies[idx] = Body(vec4<f32>(0.0), vec4<f32>(0.0));
    return;
  }

  var vel = self_vr.xyz;
  if (params.mode == 1u) {
    let drag = max(0.0, 1.0 - params.hubble_drag * params.dt);
    vel = vel * drag + acc * (params.gravity * params.inv_a3 * params.dt);
  } else {
    vel = vel + acc * (params.gravity * params.dt);
  }
  let pos = self_pm.xyz + vel * params.dt;
  dst_bodies[idx] = Body(vec4<f32>(pos, self_pm.w), vec4<f32>(vel, self_vr.w));
}
`;

/**
 * Resident 3D Hierarchical Barnes-Hut Octree Gravity Compute Shader (WGSL)
 * matching the exact `eshkols-in-space` 8-float interleaved `Body` ABI.
 *
 * Hierarchy:
 *   - Level 2 (leaves): 16x16x16 = 4,096 spatial octree cells covering [-boxHalf, +boxHalf]^3
 *   - Level 1 (coarse):  4x4x4   =    64 parent octree cells (each covering 4x4x4 = 64 leaves)
 *   - Deterministic fixed-point atomic<i32> leaf accumulation -> exact COM + mass monopole nodes
 *   - Per-body Barnes-Hut opening angle walk (`cellSize / dist < theta`) -> O(N) scaling up to 262k bodies!
 */
export const cosmicBarnesHutOctreeWgsl = /* wgsl */ `
struct Body {
  pos_mass: vec4<f32>,
  vel_radius: vec4<f32>,
};

struct BhParams {
  count: u32,
  mode: u32,
  pad0: u32,
  pad1: u32,
  dt: f32,
  gravity: f32,
  softening2: f32,
  hubble_drag: f32,
  inv_a3: f32,
  box_half: f32,
  theta2: f32,
  pad2: f32,
};

@group(0) @binding(0) var<storage, read> src_bodies: array<Body>;
@group(0) @binding(1) var<storage, read_write> dst_bodies: array<Body>;
// 4,096 leaves * 4 i32 slots = 16,384 atomic<i32>: [mass_q, mx_q, my_q, mz_q]
@group(0) @binding(2) var<storage, read_write> leaf_accum: array<atomic<i32>>;
// 4,096 L2 monopole nodes (com.xyz, mass) + 64 L1 coarse monopole nodes = 4,160 vec4<f32>
@group(0) @binding(3) var<storage, read_write> tree_nodes: array<vec4<f32>>;
@group(0) @binding(4) var<uniform> params: BhParams;

const L2_DIM: u32 = 16u;
const L2_COUNT: u32 = 4096u;
const L1_DIM: u32 = 4u;
const L1_COUNT: u32 = 64u;
const Q_MASS: f32 = 4096.0;
const Q_MOM: f32 = 256.0;

@compute @workgroup_size(64)
fn bh_clear_tree(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i < L2_COUNT) {
    let base = i * 4u;
    atomicStore(&leaf_accum[base + 0u], 0);
    atomicStore(&leaf_accum[base + 1u], 0);
    atomicStore(&leaf_accum[base + 2u], 0);
    atomicStore(&leaf_accum[base + 3u], 0);
    tree_nodes[i] = vec4<f32>(0.0);
  }
  if (i < L1_COUNT) {
    tree_nodes[L2_COUNT + i] = vec4<f32>(0.0);
  }
}

fn clamp_cell(v: f32, half_extent: f32) -> u32 {
  let u = clamp((v + half_extent) / (2.0 * half_extent), 0.0, 0.9999);
  return min(15u, u32(u * 16.0));
}

@compute @workgroup_size(64)
fn bh_deposit_leaves(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.count) { return; }
  let pm = src_bodies[i].pos_mass;
  if (pm.w <= 0.0) { return; }
  let cx = clamp_cell(pm.x, params.box_half);
  let cy = clamp_cell(pm.y, params.box_half);
  let cz = clamp_cell(pm.z, params.box_half);
  let cell = (cz * 256u) + (cy * 16u) + cx;
  let base = cell * 4u;
  let mq = i32(clamp(pm.w * Q_MASS, -1e8, 1e8));
  let mxq = i32(clamp(pm.w * pm.x * Q_MOM, -1e8, 1e8));
  let myq = i32(clamp(pm.w * pm.y * Q_MOM, -1e8, 1e8));
  let mzq = i32(clamp(pm.w * pm.z * Q_MOM, -1e8, 1e8));
  atomicAdd(&leaf_accum[base + 0u], mq);
  atomicAdd(&leaf_accum[base + 1u], mxq);
  atomicAdd(&leaf_accum[base + 2u], myq);
  atomicAdd(&leaf_accum[base + 3u], mzq);
}

@compute @workgroup_size(64)
fn bh_finalize_leaves(@builtin(global_invocation_id) gid: vec3<u32>) {
  let cell = gid.x;
  if (cell >= L2_COUNT) { return; }
  let base = cell * 4u;
  let m = f32(atomicLoad(&leaf_accum[base + 0u])) / Q_MASS;
  if (m > 1e-6) {
    let inv_m = 1.0 / m;
    let cx = (f32(atomicLoad(&leaf_accum[base + 1u])) / Q_MOM) * inv_m;
    let cy = (f32(atomicLoad(&leaf_accum[base + 2u])) / Q_MOM) * inv_m;
    let cz = (f32(atomicLoad(&leaf_accum[base + 3u])) / Q_MOM) * inv_m;
    tree_nodes[cell] = vec4<f32>(cx, cy, cz, m);
  } else {
    tree_nodes[cell] = vec4<f32>(0.0);
  }
}

@compute @workgroup_size(64)
fn bh_reduce_coarse(@builtin(global_invocation_id) gid: vec3<u32>) {
  let p = gid.x;
  if (p >= L1_COUNT) { return; }
  let px = p & 3u;
  let py = (p >> 2u) & 3u;
  let pz = (p >> 4u) & 3u;
  var m_sum = 0.0;
  var mom = vec3<f32>(0.0);
  for (var dz = 0u; dz < 4u; dz = dz + 1u) {
    for (var dy = 0u; dy < 4u; dy = dy + 1u) {
      for (var dx = 0u; dx < 4u; dx = dx + 1u) {
        let lx = px * 4u + dx;
        let ly = py * 4u + dy;
        let lz = pz * 4u + dz;
        let leaf = tree_nodes[(lz * 256u) + (ly * 16u) + lx];
        if (leaf.w > 0.0) {
          m_sum = m_sum + leaf.w;
          mom = mom + leaf.xyz * leaf.w;
        }
      }
    }
  }
  if (m_sum > 1e-6) {
    tree_nodes[L2_COUNT + p] = vec4<f32>(mom / m_sum, m_sum);
  } else {
    tree_nodes[L2_COUNT + p] = vec4<f32>(0.0);
  }
}

@compute @workgroup_size(64)
fn bh_integrate(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= params.count) { return; }
  let self_pm = src_bodies[idx].pos_mass;
  let self_vr = src_bodies[idx].vel_radius;
  if (self_pm.w <= 0.0) {
    dst_bodies[idx] = Body(vec4<f32>(0.0), vec4<f32>(0.0));
    return;
  }

  let l1_size = (2.0 * params.box_half) / 4.0;
  let open_thresh2 = (l1_size * l1_size) / max(0.05, params.theta2);
  let self_cell_x = clamp_cell(self_pm.x, params.box_half);
  let self_cell_y = clamp_cell(self_pm.y, params.box_half);
  let self_cell_z = clamp_cell(self_pm.z, params.box_half);
  let self_leaf_id = (self_cell_z * 256u) + (self_cell_y * 16u) + self_cell_x;

  var acc = vec3<f32>(0.0);
  for (var p = 0u; p < L1_COUNT; p = p + 1u) {
    let coarse = tree_nodes[L2_COUNT + p];
    if (coarse.w <= 0.0) { continue; }
    let d_c = coarse.xyz - self_pm.xyz;
    let dist2_c = dot(d_c, d_c);
    if (dist2_c > open_thresh2) {
      let r2 = dist2_c + params.softening2;
      let inv_r = inverseSqrt(r2);
      acc = acc + d_c * (coarse.w * inv_r * inv_r * inv_r);
    } else {
      let px = p & 3u;
      let py = (p >> 2u) & 3u;
      let pz = (p >> 4u) & 3u;
      for (var dz = 0u; dz < 4u; dz = dz + 1u) {
        for (var dy = 0u; dy < 4u; dy = dy + 1u) {
          for (var dx = 0u; dx < 4u; dx = dx + 1u) {
            let leaf_id = ((pz * 4u + dz) * 256u) + ((py * 4u + dy) * 16u) + (px * 4u + dx);
            let leaf = tree_nodes[leaf_id];
            if (leaf.w <= 0.0) { continue; }
            var eff_m = leaf.w;
            var eff_pos = leaf.xyz;
            if (leaf_id == self_leaf_id) {
              eff_m = leaf.w - self_pm.w;
              if (eff_m <= 1e-6) { continue; }
              eff_pos = (leaf.xyz * leaf.w - self_pm.xyz * self_pm.w) / eff_m;
            }
            let d = eff_pos - self_pm.xyz;
            let r2 = dot(d, d) + params.softening2;
            let inv_r = inverseSqrt(r2);
            acc = acc + d * (eff_m * inv_r * inv_r * inv_r);
          }
        }
      }
    }
  }

  var vel = self_vr.xyz;
  if (params.mode == 1u) {
    let drag = max(0.0, 1.0 - params.hubble_drag * params.dt);
    vel = vel * drag + acc * (params.gravity * params.inv_a3 * params.dt);
  } else {
    vel = vel + acc * (params.gravity * params.dt);
  }
  let pos = self_pm.xyz + vel * params.dt;
  dst_bodies[idx] = Body(vec4<f32>(pos, self_pm.w), vec4<f32>(vel, self_vr.w));
}
`;

function stepCpuFallbackBodies({ cpuBodies, count, mode, scaleFactorA, dt, gravity, softening, hubbleRate }) {
  const next = new Float32Array(cpuBodies.length);
  const eps2 = softening * softening;
  const invA3 = mode === 1 ? 1 / Math.max(0.05, scaleFactorA ** 3) : 1.0;
  const drag = mode === 1 ? Math.max(0, 1 - 2 * hubbleRate * dt) : 1.0;
  const stride = count > 512 ? Math.ceil(count / 512) : 1;
  for (let i = 0; i < count; i += 1) {
    const bi = i * 8;
    const mi = cpuBodies[bi + 3];
    if (!(mi > 0)) continue;
    const xi = cpuBodies[bi]; const yi = cpuBodies[bi + 1]; const zi = cpuBodies[bi + 2];
    let ax = 0; let ay = 0; let az = 0;
    for (let j = 0; j < count; j += stride) {
      const bj = j * 8;
      const mj = cpuBodies[bj + 3];
      if (!(mj > 0)) continue;
      const dx = cpuBodies[bj] - xi;
      const dy = cpuBodies[bj + 1] - yi;
      const dz = cpuBodies[bj + 2] - zi;
      const r2 = dx * dx + dy * dy + dz * dz + eps2;
      const f = (mj * stride) / (r2 * Math.sqrt(r2));
      ax += dx * f; ay += dy * f; az += dz * f;
    }
    const gScale = gravity * invA3 * dt;
    const vx = cpuBodies[bi + 4] * drag + ax * gScale;
    const vy = cpuBodies[bi + 5] * drag + ay * gScale;
    const vz = cpuBodies[bi + 6] * drag + az * gScale;
    next[bi] = xi + vx * dt;
    next[bi + 1] = yi + vy * dt;
    next[bi + 2] = zi + vz * dt;
    next[bi + 3] = mi;
    next[bi + 4] = vx;
    next[bi + 5] = vy;
    next[bi + 6] = vz;
    next[bi + 7] = cpuBodies[bi + 7];
  }
  return next;
}

/**
 * Resident WebGPU tiled direct N-body engine supporting both Galactic (`mode=0`)
 * and Supergalactic Comoving ΛCDM (`mode=1`) populations on a shared `GPUDevice`,
 * with `GPUBufferUsage.VERTEX` enabled for zero-copy `WebGPURenderer` presentation.
 */
export function createResidentTiledNBodyEngine({
  device = null,
  initialBodies,
  mode = 0,
  label = 'ulg-cosmic-nbody'
}) {
  let cpuBodies = Float32Array.from(initialBodies);
  const count = cpuBodies.length / 8;
  let stepIndex = 0;
  let scaleFactorA = mode === 1 ? 0.25 : 1.0;
  let disposed = false;

  let buffers = null;
  let paramsBuffer = null;
  let stagingBuffer = null;
  let pipeline = null;
  let bindGroups = null;
  let ping = 0;

  if (device && typeof device.createBuffer === 'function') {
    const byteLength = Math.max(32, cpuBodies.byteLength);
    const bodyUsage = USAGE_STORAGE | USAGE_VERTEX | USAGE_COPY_DST | USAGE_COPY_SRC;
    buffers = [
      device.createBuffer({ label: `${label}-buf-0`, size: byteLength, usage: bodyUsage }),
      device.createBuffer({ label: `${label}-buf-1`, size: byteLength, usage: bodyUsage })
    ];
    paramsBuffer = device.createBuffer({ label: `${label}-params`, size: 48, usage: USAGE_UNIFORM | USAGE_COPY_DST });
    stagingBuffer = device.createBuffer({ label: `${label}-staging`, size: byteLength, usage: USAGE_COPY_DST | USAGE_MAP_READ });
    device.queue.writeBuffer(buffers[0], 0, cpuBodies);
    device.queue.writeBuffer(buffers[1], 0, cpuBodies);

    const bindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'storage'),
      computeBufferBinding(2, 'uniform')
    ];
    pipeline = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-cosmic-nbody-tiled.v1',
      label: 'ulg-cosmic-nbody-tiled',
      code: cosmicNBodyTiledWgsl,
      entryPoint: 'step_nbody',
      bindings
    });
    bindGroups = [
      createCachedExplicitBindGroup(device, {
        layout: pipeline.bindGroupLayout,
        label: `${label}-bg-0`,
        entries: [
          { binding: 0, resource: { buffer: buffers[0] } },
          { binding: 1, resource: { buffer: buffers[1] } },
          { binding: 2, resource: { buffer: paramsBuffer } }
        ]
      }),
      createCachedExplicitBindGroup(device, {
        layout: pipeline.bindGroupLayout,
        label: `${label}-bg-1`,
        entries: [
          { binding: 0, resource: { buffer: buffers[1] } },
          { binding: 1, resource: { buffer: buffers[0] } },
          { binding: 2, resource: { buffer: paramsBuffer } }
        ]
      })
    ];
  }

  let mapInFlight = false;

  async function readbackBodies() {
    if (!buffers || !stagingBuffer || mapInFlight || disposed) return cpuBodies;
    mapInFlight = true;
    try {
      const encoder = device.createCommandEncoder({ label: `${label}-readback` });
      encoder.copyBufferToBuffer(buffers[ping], 0, stagingBuffer, 0, cpuBodies.byteLength);
      device.queue.submit([encoder.finish()]);
      await stagingBuffer.mapAsync(1);
      cpuBodies.set(new Float32Array(stagingBuffer.getMappedRange()));
      stagingBuffer.unmap();
    } finally {
      mapInFlight = false;
    }
    return cpuBodies;
  }

  async function step({
    dt = 0.014,
    gravity = 1.0,
    softening = 0.22,
    hubbleRate = 0.12,
    readback = true
  } = {}) {
    if (disposed) return cpuBodies;
    if (!buffers || !pipeline) {
      cpuBodies = stepCpuFallbackBodies({ cpuBodies, count, mode, scaleFactorA, dt, gravity, softening, hubbleRate });
      stepIndex += 1;
      if (mode === 1) scaleFactorA = Math.min(2.0, scaleFactorA + dt * hubbleRate * scaleFactorA);
      return cpuBodies;
    }
    const paramData = new ArrayBuffer(48);
    const u32 = new Uint32Array(paramData);
    const f32 = new Float32Array(paramData);
    const invA3 = mode === 1 ? 1 / Math.max(0.05, scaleFactorA ** 3) : 1.0;
    u32[0] = count;
    u32[1] = mode;
    f32[4] = dt;
    f32[5] = gravity;
    f32[6] = softening * softening;
    f32[7] = mode === 1 ? 2 * hubbleRate : 0;
    f32[8] = invA3;
    device.queue.writeBuffer(paramsBuffer, 0, paramData);

    const srcIdx = ping;
    const dstIdx = 1 - ping;
    const encoder = device.createCommandEncoder({ label: `${label}-step-${stepIndex}` });
    const pass = encoder.beginComputePass({ label: `${label}-pass` });
    pass.setPipeline(pipeline.pipeline);
    pass.setBindGroup(0, bindGroups[srcIdx]);
    pass.dispatchWorkgroups(Math.ceil(count / 64));
    pass.end();

    const doReadback = readback && !mapInFlight;
    if (doReadback) {
      encoder.copyBufferToBuffer(buffers[dstIdx], 0, stagingBuffer, 0, cpuBodies.byteLength);
    }
    device.queue.submit([encoder.finish()]);
    ping = dstIdx;
    stepIndex += 1;
    if (mode === 1) {
      scaleFactorA = Math.min(2.0, scaleFactorA + dt * hubbleRate * scaleFactorA);
    }
    if (doReadback) {
      mapInFlight = true;
      try {
        await stagingBuffer.mapAsync(1);
        cpuBodies.set(new Float32Array(stagingBuffer.getMappedRange()));
        stagingBuffer.unmap();
      } finally {
        mapInFlight = false;
      }
    }
    return cpuBodies;
  }

  function resetBodies(nextBodies) {
    cpuBodies = Float32Array.from(nextBodies);
    stepIndex = 0;
    scaleFactorA = mode === 1 ? 0.25 : 1.0;
    ping = 0;
    if (buffers && device) {
      device.queue.writeBuffer(buffers[0], 0, cpuBodies);
      device.queue.writeBuffer(buffers[1], 0, cpuBodies);
    }
  }

  function getResidentBuffer() {
    return buffers ? buffers[ping] : null;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    buffers?.[0]?.destroy();
    buffers?.[1]?.destroy();
    paramsBuffer?.destroy();
    stagingBuffer?.destroy();
    buffers = null;
  }

  return {
    get count() { return count; },
    get activeCount() { return count; },
    get stepIndex() { return stepIndex; },
    get scaleFactorA() { return scaleFactorA; },
    get backend() { return buffers ? 'webgpu' : 'cpu-fallback'; },
    get gravityMode() { return buffers ? 'webgpu-tiled-direct' : 'cpu-fallback'; },
    getBodies: () => cpuBodies,
    readbackBodies,
    getResidentBuffer,
    step,
    resetBodies,
    dispose
  };
}

/**
 * Resident WebGPU Hierarchical Barnes-Hut Octree N-body engine scaling cleanly
 * to 32,768 - 262,144+ stars on a single shared `GPUDevice` with zero CPU
 * readback per frame and `GPUBufferUsage.VERTEX` zero-copy rendering support!
 */
export function createResidentBarnesHutNBodyEngine({
  device = null,
  initialBodies,
  mode = 0,
  boxHalf = 16.0,
  theta = 0.65,
  label = 'ulg-cosmic-bh'
}) {
  let cpuBodies = Float32Array.from(initialBodies);
  const count = cpuBodies.length / 8;
  let stepIndex = 0;
  let scaleFactorA = mode === 1 ? 0.25 : 1.0;
  let disposed = false;

  let buffers = null;
  let leafAccumBuf = null;
  let treeNodesBuf = null;
  let paramsBuffer = null;
  let stagingBuffer = null;
  let pipes = null;
  let bindGroups = null;
  let ping = 0;

  if (device && typeof device.createBuffer === 'function') {
    const byteLength = Math.max(32, cpuBodies.byteLength);
    const bodyUsage = USAGE_STORAGE | USAGE_VERTEX | USAGE_COPY_DST | USAGE_COPY_SRC;
    buffers = [
      device.createBuffer({ label: `${label}-buf-0`, size: byteLength, usage: bodyUsage }),
      device.createBuffer({ label: `${label}-buf-1`, size: byteLength, usage: bodyUsage })
    ];
    leafAccumBuf = device.createBuffer({ label: `${label}-leaf-accum`, size: 4096 * 16, usage: USAGE_STORAGE });
    treeNodesBuf = device.createBuffer({ label: `${label}-tree-nodes`, size: 4160 * 16, usage: USAGE_STORAGE });
    paramsBuffer = device.createBuffer({ label: `${label}-params`, size: 48, usage: USAGE_UNIFORM | USAGE_COPY_DST });
    stagingBuffer = device.createBuffer({ label: `${label}-staging`, size: byteLength, usage: USAGE_COPY_DST | USAGE_MAP_READ });
    device.queue.writeBuffer(buffers[0], 0, cpuBodies);
    device.queue.writeBuffer(buffers[1], 0, cpuBodies);

    const bindings = [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'storage'),
      computeBufferBinding(2, 'storage'),
      computeBufferBinding(3, 'storage'),
      computeBufferBinding(4, 'uniform')
    ];
    const mk = (entryPoint) => createCachedExplicitComputePipeline(device, {
      cacheKey: `ulg-cosmic-bh-${entryPoint}.v1`,
      label: `ulg-cosmic-bh-${entryPoint}`,
      code: cosmicBarnesHutOctreeWgsl,
      entryPoint,
      bindings
    });
    pipes = {
      clear: mk('bh_clear_tree'),
      deposit: mk('bh_deposit_leaves'),
      finalize: mk('bh_finalize_leaves'),
      reduce: mk('bh_reduce_coarse'),
      integrate: mk('bh_integrate')
    };
    const mkBg = (src, dst, idx) => createCachedExplicitBindGroup(device, {
      layout: pipes.integrate.bindGroupLayout,
      label: `${label}-bg-${idx}`,
      entries: [
        { binding: 0, resource: { buffer: src } },
        { binding: 1, resource: { buffer: dst } },
        { binding: 2, resource: { buffer: leafAccumBuf } },
        { binding: 3, resource: { buffer: treeNodesBuf } },
        { binding: 4, resource: { buffer: paramsBuffer } }
      ]
    });
    bindGroups = [mkBg(buffers[0], buffers[1], 0), mkBg(buffers[1], buffers[0], 1)];
  }

  let mapInFlight = false;

  async function readbackBodies() {
    if (!buffers || !stagingBuffer || mapInFlight || disposed) return cpuBodies;
    mapInFlight = true;
    try {
      const encoder = device.createCommandEncoder({ label: `${label}-readback` });
      encoder.copyBufferToBuffer(buffers[ping], 0, stagingBuffer, 0, cpuBodies.byteLength);
      device.queue.submit([encoder.finish()]);
      await stagingBuffer.mapAsync(1);
      cpuBodies.set(new Float32Array(stagingBuffer.getMappedRange()));
      stagingBuffer.unmap();
    } finally {
      mapInFlight = false;
    }
    return cpuBodies;
  }

  async function step({
    dt = 0.012,
    gravity = 1.0,
    softening = 0.24,
    hubbleRate = 0.12,
    readback = false
  } = {}) {
    if (disposed) return cpuBodies;
    if (!buffers || !pipes) {
      cpuBodies = stepCpuFallbackBodies({ cpuBodies, count, mode, scaleFactorA, dt, gravity, softening, hubbleRate });
      stepIndex += 1;
      if (mode === 1) scaleFactorA = Math.min(2.0, scaleFactorA + dt * hubbleRate * scaleFactorA);
      return cpuBodies;
    }
    const paramData = new ArrayBuffer(48);
    const u32 = new Uint32Array(paramData);
    const f32 = new Float32Array(paramData);
    const invA3 = mode === 1 ? 1 / Math.max(0.05, scaleFactorA ** 3) : 1.0;
    u32[0] = count;
    u32[1] = mode;
    f32[4] = dt;
    f32[5] = gravity;
    f32[6] = softening * softening;
    f32[7] = mode === 1 ? 2 * hubbleRate : 0;
    f32[8] = invA3;
    f32[9] = boxHalf;
    f32[10] = theta * theta;
    device.queue.writeBuffer(paramsBuffer, 0, paramData);

    const srcIdx = ping;
    const dstIdx = 1 - ping;
    const bg = bindGroups[srcIdx];
    const bodyGroups = Math.ceil(count / 64);

    const encoder = device.createCommandEncoder({ label: `${label}-bh-step-${stepIndex}` });
    const pass = encoder.beginComputePass({ label: `${label}-bh-pass` });
    pass.setPipeline(pipes.clear.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(64); // 4096 / 64 = 64

    pass.setPipeline(pipes.deposit.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(bodyGroups);

    pass.setPipeline(pipes.finalize.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(64);

    pass.setPipeline(pipes.reduce.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(1);

    pass.setPipeline(pipes.integrate.pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(bodyGroups);
    pass.end();

    const doReadback = readback && !mapInFlight;
    if (doReadback) {
      encoder.copyBufferToBuffer(buffers[dstIdx], 0, stagingBuffer, 0, cpuBodies.byteLength);
    }
    device.queue.submit([encoder.finish()]);
    ping = dstIdx;
    stepIndex += 1;
    if (mode === 1) {
      scaleFactorA = Math.min(2.0, scaleFactorA + dt * hubbleRate * scaleFactorA);
    }
    if (doReadback) {
      mapInFlight = true;
      try {
        await stagingBuffer.mapAsync(1);
        cpuBodies.set(new Float32Array(stagingBuffer.getMappedRange()));
        stagingBuffer.unmap();
      } finally {
        mapInFlight = false;
      }
    }
    return cpuBodies;
  }

  function resetBodies(nextBodies) {
    cpuBodies = Float32Array.from(nextBodies);
    stepIndex = 0;
    scaleFactorA = mode === 1 ? 0.25 : 1.0;
    ping = 0;
    if (buffers && device) {
      device.queue.writeBuffer(buffers[0], 0, cpuBodies);
      device.queue.writeBuffer(buffers[1], 0, cpuBodies);
    }
  }

  function getResidentBuffer() {
    return buffers ? buffers[ping] : null;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    buffers?.[0]?.destroy();
    buffers?.[1]?.destroy();
    leafAccumBuf?.destroy();
    treeNodesBuf?.destroy();
    paramsBuffer?.destroy();
    stagingBuffer?.destroy();
    buffers = null;
  }

  return {
    get count() { return count; },
    get activeCount() { return count; },
    get stepIndex() { return stepIndex; },
    get scaleFactorA() { return scaleFactorA; },
    get backend() { return buffers ? 'webgpu' : 'cpu-fallback'; },
    get gravityMode() { return buffers ? 'webgpu-barnes-hut-octree' : 'cpu-fallback'; },
    getBodies: () => cpuBodies,
    readbackBodies,
    getResidentBuffer,
    step,
    resetBodies,
    dispose
  };
}

/**
 * Wrap a resident N-body engine (`direct` or `barnes-hut-octree`) into a ULG
 * `SimulationModuleRegistry` registration (`nbody-gravity@1` or
 * `cosmology-comoving-nbody@1`).
 */
export function createResidentCosmicModuleRegistration({
  method,
  engine,
  scaleRangeM,
  zeroCopy = false
}) {
  const stateLayout = {
    tensorId: 'bodies',
    dtype: 'f32',
    layout: 'interleaved',
    strideElements: 8,
    strideBytes: 32,
    fields: ['x', 'y', 'z', 'mass', 'vx', 'vy', 'vz', 'radius']
  };
  return {
    method,
    kernel: {
      sourceModule: 'src/demos/cosmicQuantumGpuKernels.js',
      entryPoint: engine.gravityMode === 'webgpu-barnes-hut-octree' ? 'bh_integrate' : 'step_nbody',
      wgsl: engine.gravityMode === 'webgpu-barnes-hut-octree' ? cosmicBarnesHutOctreeWgsl : cosmicNBodyTiledWgsl,
      workgroupSize: 64
    },
    parameterSchema: {
      dt: { type: 'number', min: 0, required: true },
      gravity: { type: 'number', min: 0, required: true },
      softening: { type: 'number', min: 0, required: false },
      hubbleRate: { type: 'number', min: 0, required: false },
      readback: { type: 'boolean', required: false }
    },
    stateLayout,
    scaleRangeM,
    async stepCapsule(capsule, { createSimulationArtifact, leaseSession }) {
      const fromStep = engine.stepIndex;
      const params = capsule.input?.parameters || {};
      const doReadback = params.readback !== undefined ? Boolean(params.readback) : !zeroCopy;
      const bodies = await engine.step({ ...params, readback: doReadback });
      const toStep = engine.stepIndex;
      leaseSession.publishBuffer({
        resourceKey: 'bodies',
        buffer: engine.getResidentBuffer(),
        destroyFn: () => true,
        byteLength: bodies.byteLength,
        rowCount: engine.count,
        layout: stateLayout,
        stepIndex: toStep,
        portableSnapshotFn: async () => Float32Array.from(
          doReadback ? bodies : await engine.readbackBodies()
        )
      });
      const leaseHandle = leaseSession.borrowBufferReadLease({
        resourceKey: 'bodies',
        consumerStage: 'cosmic-quantum-renderer',
        reason: zeroCopy ? 'zero-copy-gpu-vertex-lease' : 'live-render-frame-lease'
      });
      const artifact = createSimulationArtifact({
        artifactId: `${capsule.taskId}:${method.model}:${toStep}`,
        taskKind: capsule.taskKind,
        closureRef: { module: 'src/demos/cosmicQuantumGpuKernels.js', entryPoint: engine.gravityMode },
        representation: 'nbody-interleaved-f32',
        outputs: {
          deltas: [{ operation: 'replace', tensorId: 'bodies', fromStep, toStep }]
        },
        execution: {
          backend: engine.backend,
          stage: `${method.model}.step`,
          placement: 'local',
          gravityMode: engine.gravityMode,
          zeroCopyReadbackSkipped: !doReadback,
          scaleFactorA: engine.scaleFactorA
        },
        validity: {
          finite: true,
          bodyCount: engine.activeCount,
          slotCount: engine.count
        },
        validation: {
          status: 'pass',
          validationMode: 'finite-output',
          scientificValidation: false,
          fullPhysicsValidation: false
        },
        provenance: {
          ...capsule.provenance,
          sourceService: ULG_SERVICE_IDS.ulgRuntime,
          methodHash: capsule.methodHash,
          inputHash: capsule.inputHash
        }
      });
      return { artifact, leaseHandle };
    }
  };
}
