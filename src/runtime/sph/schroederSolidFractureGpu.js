import { computeBufferBinding, createCachedExplicitComputePipeline } from '../webgpuComputeLayout.js';

// A5 SOL-5 (plan/todo/sol-critic.md, .icc/completion-oracles.yaml):
// GPU-native cohesive bond fracture, parallel connected-component body
// splitting, and supercooled fluid -> coherent solid refreeze / solidification.
//
// Operates directly on `schroederSolidRigidGpu.js` buffers (`frameBuffer`,
// `memberBuffer`, `memberWorldBuffer`, `proxyBuffer`, `neighborBuffer`,
// `latticeBuffer`, `thermoBuffer`) so every topology change preserves:
//   - exact total mass M = sum_b M_b + sum_fluid m_p
//   - exact centre of mass, linear momentum P, and angular momentum L_0
//   - diagonal principal inertia I_b on every resulting fragment via the
//     rigid stage's exact integer reductions + 12-sweep Jacobi rebase
//   - automatic fracture-face exposure in `schroederSolidMemberShapeRenderer`
//     (which draws any member face whose neighbor slot is 0xffffffffu)
//   - incremented `componentGeneration` (frame word 21) preventing spurious
//     re-merging of fractured sibling components.
export const SCHROEDER_SOLID_FRACTURE_SCHEMA =
  'peercompute.ulg.schroeder-solid-fracture.v1';

const GPU_BUFFER_USAGE = Object.freeze({
  MAP_READ: 0x01,
  COPY_SRC: 0x04,
  COPY_DST: 0x08,
  UNIFORM: 0x40,
  STORAGE: 0x80
});

export const schroederSolidFractureWgsl = /* wgsl */ `
struct FractureParams {
  // member_count, proxy_count, max_body_capacity, fluid_count
  counts: vec4<u32>,
  // tensile_strength_pa, shear_strength_pa, fracture_energy_j_per_m2, dt
  strength: vec4<f32>,
  // pitch_x, pitch_y, pitch_z, solid_energy_max_j_per_kg
  geom: vec4<f32>,
  // solid_ref_T, solid_ref_u, solid_cv, material_id_f32
  caloric: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: FractureParams;
@group(0) @binding(1) var<storage, read_write> frames: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> members: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> member_world: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> proxies: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> neighbors: array<atomic<u32>>;
@group(0) @binding(6) var<storage, read_write> lattice: array<vec4<f32>>;
@group(0) @binding(7) var<storage, read_write> member_thermo: array<vec4<f32>>;
// Applied per-member body/world stress force vector (vec4<f32>: fx, fy, fz, unused)
@group(0) @binding(8) var<storage, read> member_loads: array<vec4<f32>>;
// Scratch: [0]: active_body_count, [1]: cleaved_bonds_total, [2]: split_events_total,
//          [3]: solidified_count_total, [4..4+M-1]: comp_label[M], [4+M..4+2M-1]: root_to_body_plus1[M]
@group(0) @binding(9) var<storage, read_write> topo_state: array<atomic<u32>>;

const NONE: u32 = 0xffffffffu;
const FRAME_VEC4: u32 = 8u;
const MEMBER_VEC4: u32 = 2u;

fn quat_rotate(q: vec4<f32>, v: vec3<f32>) -> vec3<f32> {
  let t = 2.0 * cross(q.xyz, v);
  return v + q.w * t + cross(q.xyz, t);
}

fn quat_rotate_inverse(q: vec4<f32>, v: vec3<f32>) -> vec3<f32> {
  return quat_rotate(vec4<f32>(-q.xyz, q.w), v);
}

fn face_area(axis: u32) -> f32 {
  if (axis == 0u) { return params.geom.y * params.geom.z; }
  if (axis == 1u) { return params.geom.x * params.geom.z; }
  return params.geom.x * params.geom.y;
}

fn opposite_face(face: u32) -> u32 {
  return face ^ 1u;
}

fn comp_offset(i: u32) -> u32 { return 4u + i; }
fn root_body_offset(i: u32) -> u32 { return 4u + params.counts.x + i; }
fn body_primary_root_offset(b: u32) -> u32 { return 4u + 2u * params.counts.x + b; }

@compute @workgroup_size(64)
fn cleave_overstressed_bonds(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.counts.x) { return; }
  let m_i = members[i * MEMBER_VEC4].w;
  if (!(m_i > 0.0)) { return; }
  let body = bitcast<u32>(members[i * MEMBER_VEC4 + 1u].x);
  let q = frames[body * FRAME_VEC4 + 1u];
  let fi = member_loads[i].xyz;

  // Each undirected bond {i, j} is owned once by the positive face (+x=0, +y=2, +z=4)
  for (var axis = 0u; axis < 3u; axis = axis + 1u) {
    let face = axis * 2u;
    let j = atomicLoad(&neighbors[i * 8u + face]);
    if (j == NONE || j >= params.counts.x) { continue; }
    let m_j = members[j * MEMBER_VEC4].w;
    if (!(m_j > 0.0)) {
      atomicStore(&neighbors[i * 8u + face], NONE);
      continue;
    }
    let fj = member_loads[j].xyz;
    let axis_world = normalize(quat_rotate(q, lattice[body * 4u + axis].xyz));
    // Relative differential traction across face (j is at +axis_world from i):
    let df = 0.5 * (fj - fi);
    let fn_load = dot(df, axis_world); // > 0 in tension
    let ft_vec = df - fn_load * axis_world;
    let ft_load = length(ft_vec);
    let area = max(face_area(axis), 1.0e-12);
    let sigma_n = max(fn_load, 0.0) / area;
    let tau = ft_load / area;

    if (sigma_n > params.strength.x || tau > params.strength.y) {
      atomicStore(&neighbors[i * 8u + face], NONE);
      atomicStore(&neighbors[j * 8u + opposite_face(face)], NONE);
      atomicAdd(&topo_state[1], 1u);
      // Deposit half of Griffith surface cleavage energy gamma * A into each side's thermal u
      let half_gamma = 0.5 * params.strength.z * area;
      if (half_gamma > 0.0) {
        let ti = member_thermo[i];
        let tj = member_thermo[j];
        member_thermo[i] = vec4<f32>(ti.x + half_gamma / m_i, ti.y, ti.z, ti.w);
        member_thermo[j] = vec4<f32>(tj.x + half_gamma / m_j, tj.y, tj.z, tj.w);
      }
    }
  }
}

@compute @workgroup_size(64)
fn init_components(@builtin(global_invocation_id) id: vec3<u32>) {
  let idx = id.x;
  if (idx < params.counts.x) {
    let alive = members[idx * MEMBER_VEC4].w > 0.0;
    atomicStore(&topo_state[comp_offset(idx)], select(NONE, idx, alive));
    atomicStore(&topo_state[root_body_offset(idx)], 0u);
  }
  if (idx < params.counts.z) {
    atomicStore(&topo_state[body_primary_root_offset(idx)], NONE);
  }
}

@compute @workgroup_size(64)
fn propagate_components(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.counts.x) { return; }
  var my_c = atomicLoad(&topo_state[comp_offset(i)]);
  if (my_c == NONE) { return; }
  let my_body = bitcast<u32>(members[i * MEMBER_VEC4 + 1u].x);

  for (var f = 0u; f < 6u; f = f + 1u) {
    let j = atomicLoad(&neighbors[i * 8u + f]);
    if (j != NONE && j < params.counts.x) {
      if (bitcast<u32>(members[j * MEMBER_VEC4 + 1u].x) == my_body && members[j * MEMBER_VEC4].w > 0.0) {
        let cj = atomicLoad(&topo_state[comp_offset(j)]);
        my_c = min(my_c, cj);
      }
    }
  }
  // Pointer jumping halves component diameter each pass!
  if (my_c < params.counts.x) {
    let jumped = atomicLoad(&topo_state[comp_offset(my_c)]);
    if (jumped != NONE) { my_c = min(my_c, jumped); }
  }
  atomicMin(&topo_state[comp_offset(i)], my_c);
}

@compute @workgroup_size(64)
fn elect_primary_roots(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.counts.x) { return; }
  let root = atomicLoad(&topo_state[comp_offset(i)]);
  if (root != i) { return; }
  let b = bitcast<u32>(members[i * MEMBER_VEC4 + 1u].x);
  if (b < params.counts.z) {
    atomicMin(&topo_state[body_primary_root_offset(b)], root);
  }
}

@compute @workgroup_size(64)
fn allocate_split_bodies(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.counts.x) { return; }
  let root = atomicLoad(&topo_state[comp_offset(i)]);
  if (root != i) { return; }
  let parent_b = bitcast<u32>(members[i * MEMBER_VEC4 + 1u].x);
  if (parent_b >= params.counts.z) { return; }
  let primary = atomicLoad(&topo_state[body_primary_root_offset(parent_b)]);
  if (root == primary) {
    atomicStore(&topo_state[root_body_offset(root)], parent_b + 1u);
    return;
  }
  // Secondary connected component -> claim a fresh independent body slot!
  let new_b = atomicAdd(&topo_state[0], 1u);
  if (new_b >= params.counts.z) {
    // Capacity full: keep on parent body fail-closed rather than dropping mass!
    atomicStore(&topo_state[root_body_offset(root)], parent_b + 1u);
    return;
  }
  atomicStore(&topo_state[root_body_offset(root)], new_b + 1u);
  atomicAdd(&topo_state[2], 1u);

  // Initialize new_b with parent's exact kinematic pose & velocity field (v_com + omega x r)
  // and set mass = 1e30 sentinel so schroederSolidRigidGpu's rebase_prepare sees |reduced_mass - f0.w| > 1e-5
  // and diagonalizes both parent_b and new_b from their exact member reductions!
  let p_base = parent_b * FRAME_VEC4;
  let n_base = new_b * FRAME_VEC4;
  let parent_mass = max(frames[p_base].w, 1.0e-12);
  let v_parent = frames[p_base + 2u].xyz / parent_mass;
  let q_parent = frames[p_base + 1u];
  let l_parent = frames[p_base + 3u].xyz;
  let i_parent = max(frames[p_base + 4u].xyz, vec3<f32>(1.0e-20));
  let sentinel_mass = parent_mass * 2.0; // differs by 100% from any fragment mass -> forces exact rebase!

  frames[n_base + 0u] = vec4<f32>(frames[p_base].xyz, sentinel_mass);
  frames[n_base + 1u] = q_parent;
  frames[n_base + 2u] = vec4<f32>(v_parent * sentinel_mass, 0.0);
  frames[n_base + 3u] = vec4<f32>(quat_rotate(q_parent, (quat_rotate_inverse(q_parent, l_parent) / i_parent) * i_parent), 0.0);
  // Note: omega_new = quat_rotate(q_parent, quat_rotate_inverse(q_parent, l_parent) / i_parent) === omega_parent
  // when frames[n_base + 4u] = i_parent and frames[n_base + 3u] = l_parent!
  frames[n_base + 3u] = vec4<f32>(l_parent, 0.0);
  frames[n_base + 4u] = vec4<f32>(i_parent, 0.0);
  let parent_meta = frames[p_base + 5u];
  let next_gen = bitcast<u32>(parent_meta.y) + 1u;
  frames[n_base + 5u] = vec4<f32>(bitcast<f32>(new_b), bitcast<f32>(next_gen), 0.0, 0.0);
  frames[p_base + 5u] = vec4<f32>(parent_meta.x, bitcast<f32>(next_gen), parent_meta.z, parent_meta.w);
  frames[n_base + 6u] = vec4<f32>(0.0, 0.0, 0.0, bitcast<f32>(1u));
  frames[n_base + 7u] = vec4<f32>(0.0);

  for (var k = 0u; k < 4u; k = k + 1u) {
    lattice[new_b * 4u + k] = lattice[parent_b * 4u + k];
  }
}

@compute @workgroup_size(64)
fn remap_members_and_proxies(@builtin(global_invocation_id) id: vec3<u32>) {
  let idx = id.x;
  if (idx < params.counts.x) {
    if (members[idx * MEMBER_VEC4].w > 0.0) {
      let root = atomicLoad(&topo_state[comp_offset(idx)]);
      if (root < params.counts.x) {
        let b_plus1 = atomicLoad(&topo_state[root_body_offset(root)]);
        if (b_plus1 > 0u) {
          let m1 = members[idx * MEMBER_VEC4 + 1u];
          members[idx * MEMBER_VEC4 + 1u] = vec4<f32>(bitcast<f32>(b_plus1 - 1u), m1.y, m1.z, m1.w);
        }
      }
    }
  }
  if (idx < params.counts.y) {
    let owner_m = bitcast<u32>(proxies[idx * 2u + 1u].y);
    if (owner_m < params.counts.x && members[owner_m * MEMBER_VEC4].w > 0.0) {
      let new_b = members[owner_m * MEMBER_VEC4 + 1u].x;
      let p1 = proxies[idx * 2u + 1u];
      proxies[idx * 2u + 1u] = vec4<f32>(new_b, p1.y, p1.z, p1.w);
    }
  }
}
`;

export function createSchroederSolidFractureStage({
  device,
  memberCount,
  proxyCount = 0,
  initialBodyCount = 1,
  maxBodyCapacity,
  frameBuffer,
  memberBuffer,
  memberWorldBuffer,
  proxyBuffer = null,
  neighborBuffer,
  latticeBuffer,
  thermoBuffer = null,
  pitchM,
  tensileStrengthPa = 1.0e5,
  shearStrengthPa = 1.0e5,
  fractureEnergyJPerM2 = 1.0,
  solidBranch = { referenceTemperatureK: 250, referenceInternalEnergyJPerKg: 0, cvJPerKgK: 2050, energyMaxJPerKg: 0 },
  materialId = 0,
  propagationRounds = 12
}) {
  const pitch = Array.isArray(pitchM) ? pitchM.map(Number) : [Number(pitchM), Number(pitchM), Number(pitchM)];
  // Fail-closed guard: clamp maxBodyCapacity to actual GPU buffer capacity so
  // allocate_split_bodies can never write past frameBuffer or latticeBuffer.
  const frameCapacity = Number(frameBuffer?.size) > 0 ? Math.floor(frameBuffer.size / 128) : maxBodyCapacity;
  const latticeCapacity = Number(latticeBuffer?.size) > 0 ? Math.floor(latticeBuffer.size / 64) : maxBodyCapacity;
  const safeMaxBodyCapacity = Math.max(
    initialBodyCount,
    Math.min(maxBodyCapacity, frameCapacity, latticeCapacity)
  );
  const bindings = [
    computeBufferBinding(0, 'uniform'),
    computeBufferBinding(1, 'storage'),
    computeBufferBinding(2, 'storage'),
    computeBufferBinding(3, 'read-only-storage'),
    computeBufferBinding(4, 'storage'),
    computeBufferBinding(5, 'storage'),
    computeBufferBinding(6, 'storage'),
    computeBufferBinding(7, 'storage'),
    computeBufferBinding(8, 'read-only-storage'),
    computeBufferBinding(9, 'storage')
  ];
  const entryNames = [
    'cleave_overstressed_bonds',
    'init_components',
    'propagate_components',
    'elect_primary_roots',
    'allocate_split_bodies',
    'remap_members_and_proxies'
  ];
  const pipelines = Object.fromEntries(
    entryNames.map((entryPoint) => [
      entryPoint,
      createCachedExplicitComputePipeline(device, {
        cacheKey: `ulg-sol5-fracture-${entryPoint}.v1`,
        label: `ulg-sol5-fracture-${entryPoint}`,
        code: schroederSolidFractureWgsl,
        entryPoint,
        bindings
      })
    ])
  );

  const paramsBuffer = device.createBuffer({
    label: 'ulg-sol5-fracture-params',
    size: 64,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const raw = new ArrayBuffer(64);
  const u = new Uint32Array(raw);
  const f = new Float32Array(raw);
  u.set([memberCount, proxyCount, safeMaxBodyCapacity, 0], 0);
  f.set([tensileStrengthPa, shearStrengthPa, fractureEnergyJPerM2, 0], 4);
  f.set([pitch[0], pitch[1], pitch[2], solidBranch.energyMaxJPerKg], 8);
  f.set([
    solidBranch.referenceTemperatureK,
    solidBranch.referenceInternalEnergyJPerKg,
    solidBranch.cvJPerKgK,
    materialId
  ], 12);
  device.queue.writeBuffer(paramsBuffer, 0, raw);

  const memberLoadBuffer = device.createBuffer({
    label: 'ulg-sol5-member-loads',
    size: Math.max(16, memberCount * 16),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
  });
  const topoWords = 4 + 2 * memberCount + safeMaxBodyCapacity;
  const topoStateBuffer = device.createBuffer({
    label: 'ulg-sol5-topo-state',
    size: topoWords * 4,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.COPY_SRC
  });
  const initTopo = new Uint32Array(4);
  initTopo[0] = initialBodyCount;
  device.queue.writeBuffer(topoStateBuffer, 0, initTopo);

  const proxyPlaceholder = proxyBuffer ? null : device.createBuffer({ size: 32, usage: GPU_BUFFER_USAGE.STORAGE });
  const thermoPlaceholder = thermoBuffer
    ? null
    : device.createBuffer({ size: Math.max(16, memberCount * 16), usage: GPU_BUFFER_USAGE.STORAGE });

  const bindGroup = device.createBindGroup({
    layout: pipelines.cleave_overstressed_bonds.bindGroupLayout,
    entries: [
      paramsBuffer,
      frameBuffer,
      memberBuffer,
      memberWorldBuffer,
      proxyBuffer ?? proxyPlaceholder,
      neighborBuffer,
      latticeBuffer,
      thermoBuffer ?? thermoPlaceholder,
      memberLoadBuffer,
      topoStateBuffer
    ].map((buffer, binding) => ({ binding, resource: { buffer } }))
  });

  let loadsActive = false;

  return Object.freeze({
    memberLoadBuffer,
    topoStateBuffer,
    maxBodyCapacity: safeMaxBodyCapacity,
    hasActiveLoads() {
      return loadsActive;
    },
    setMemberLoads(loadsFloat32) {
      loadsActive = Boolean(loadsFloat32 && loadsFloat32.length > 0);
      device.queue.writeBuffer(memberLoadBuffer, 0, loadsFloat32);
    },
    prepare(dtSeconds = 1e-3) {
      f[7] = dtSeconds;
      device.queue.writeBuffer(paramsBuffer, 0, raw);
    },
    encode(encoder, dtSeconds = 1e-3, { pass: sharedPass = null, prepared = false, skipIfNoLoads = false } = {}) {
      if (skipIfNoLoads && !loadsActive) return false;
      if (!prepared) {
        f[7] = dtSeconds;
        device.queue.writeBuffer(paramsBuffer, 0, raw);
      }
      const pass = sharedPass ?? encoder.beginComputePass({ label: 'ulg-sol5-fracture' });
      pass.setBindGroup(0, bindGroup);
      const mGroups = Math.ceil(memberCount / 64);
      const maxInitGroups = Math.ceil(Math.max(memberCount, safeMaxBodyCapacity) / 64);
      const remapGroups = Math.ceil(Math.max(memberCount, proxyCount, 1) / 64);

      pass.setPipeline(pipelines.cleave_overstressed_bonds.pipeline);
      pass.dispatchWorkgroups(mGroups);
      pass.setPipeline(pipelines.init_components.pipeline);
      pass.dispatchWorkgroups(maxInitGroups);
      pass.setPipeline(pipelines.propagate_components.pipeline);
      for (let r = 0; r < propagationRounds; r += 1) {
        pass.dispatchWorkgroups(mGroups);
      }
      pass.setPipeline(pipelines.elect_primary_roots.pipeline);
      pass.dispatchWorkgroups(mGroups);
      pass.setPipeline(pipelines.allocate_split_bodies.pipeline);
      pass.dispatchWorkgroups(mGroups);
      pass.setPipeline(pipelines.remap_members_and_proxies.pipeline);
      pass.dispatchWorkgroups(remapGroups);
      if (!sharedPass) pass.end();
      return true;
    },
    /**
     * Conservative supercooled-liquid -> coherent-solid refreeze transfer on GPU
     * buffers: re-admits supercooled released liquid rows back into their
     * dormant solid member slots, restoring lattice neighbor links, transferring
     * exact mass, linear momentum, angular momentum, and thermal energy u, and
     * marking the body frame for exact Jacobi principal-frame rebase!
     */
    async solidifyReleasedRows({
      releaseRows,
      fluidStateBuffer,
      fluidThermoBuffer,
      thermoBuffer: activeThermoBuffer = thermoBuffer
    }) {
      const readF32 = async (buf, words) => {
        const st = device.createBuffer({ size: words * 4, usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST });
        const e = device.createCommandEncoder();
        e.copyBufferToBuffer(buf, 0, st, 0, words * 4);
        device.queue.submit([e.finish()]);
        await st.mapAsync(GPU_BUFFER_USAGE.MAP_READ);
        const arr = new Float32Array(st.getMappedRange().slice(0));
        st.unmap();
        st.destroy();
        return arr;
      };
      const fs = await readF32(fluidStateBuffer, Math.floor(fluidStateBuffer.size / 4));
      const mf = await readF32(memberBuffer, memberCount * 8);
      const mu = new Uint32Array(mf.buffer);
      const ff = await readF32(frameBuffer, safeMaxBodyCapacity * 32);
      const tf = activeThermoBuffer ? await readF32(activeThermoBuffer, memberCount * 4) : null;
      const lf = latticeBuffer ? await readF32(latticeBuffer, safeMaxBodyCapacity * 16) : null;
      const pf = proxyBuffer && proxyCount > 0 ? await readF32(proxyBuffer, proxyCount * 8) : null;
      const pu = pf ? new Uint32Array(pf.buffer) : null;
      const nf = neighborBuffer ? await readF32(neighborBuffer, memberCount * 8) : null;
      const nu = nf ? new Uint32Array(nf.buffer) : null;

      const rot = (q, v) => {
        const [qx, qy, qz, qw] = q;
        const t = [2 * (qy * v[2] - qz * v[1]), 2 * (qz * v[0] - qx * v[2]), 2 * (qx * v[1] - qy * v[0])];
        return [
          v[0] + qw * t[0] + (qy * t[2] - qz * t[1]),
          v[1] + qw * t[1] + (qz * t[0] - qx * t[2]),
          v[2] + qw * t[2] + (qx * t[1] - qy * t[0])
        ];
      };
      const rotInv = (q, v) => rot([-q[0], -q[1], -q[2], q[3]], v);
      const cross3 = (a, b) => [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
      ];
      const quatFromCols = (c0, c1, c2) => {
        const tr = c0[0] + c1[1] + c2[2];
        let x, y, z, w;
        if (tr > 0) {
          const s = 0.5 / Math.sqrt(tr + 1);
          w = 0.25 / s; x = (c1[2] - c2[1]) * s; y = (c2[0] - c0[2]) * s; z = (c0[1] - c1[0]) * s;
        } else if (c0[0] > c1[1] && c0[0] > c2[2]) {
          const s = 2 * Math.sqrt(1 + c0[0] - c1[1] - c2[2]);
          w = (c1[2] - c2[1]) / s; x = 0.25 * s; y = (c1[0] + c0[1]) / s; z = (c2[0] + c0[2]) / s;
        } else if (c1[1] > c2[2]) {
          const s = 2 * Math.sqrt(1 + c1[1] - c0[0] - c2[2]);
          w = (c2[0] - c0[2]) / s; x = (c1[0] + c0[1]) / s; y = 0.25 * s; z = (c2[1] + c1[2]) / s;
        } else {
          const s = 2 * Math.sqrt(1 + c2[2] - c0[0] - c1[1]);
          w = (c0[1] - c1[0]) / s; x = (c2[0] + c0[2]) / s; y = (c2[1] + c1[2]) / s; z = 0.25 * s;
        }
        const n = Math.hypot(x, y, z, w) || 1;
        return [x / n, y / n, z / n, w / n];
      };
      const jacobi3 = (mat) => {
        const a = mat.map((r) => [...r]);
        const v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
        for (let sw = 0; sw < 32; sw += 1) {
          for (const [pi, qi] of [[0, 1], [0, 2], [1, 2]]) {
            if (Math.abs(a[pi][qi]) < 1e-30) continue;
            const th = (a[qi][qi] - a[pi][pi]) / (2 * a[pi][qi]);
            const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
            const c = 1 / Math.sqrt(t * t + 1);
            const s = t * c;
            for (let k = 0; k < 3; k += 1) {
              const akp = a[k][pi], akq = a[k][qi];
              a[k][pi] = c * akp - s * akq; a[k][qi] = s * akp + c * akq;
            }
            for (let k = 0; k < 3; k += 1) {
              const apk = a[pi][k], aqk = a[qi][k];
              a[pi][k] = c * apk - s * aqk; a[qi][k] = s * apk + c * aqk;
            }
            for (let k = 0; k < 3; k += 1) {
              const vkp = v[k][pi], vkq = v[k][qi];
              v[k][pi] = c * vkp - s * vkq; v[k][qi] = s * vkp + c * vkq;
            }
          }
        }
        const order = [0, 1, 2].sort((i, j) => a[i][i] - a[j][j]);
        const cols = order.map((k) => [v[0][k], v[1][k], v[2][k]]);
        const cr = cross3(cols[0], cols[1]);
        if (cr[0] * cols[2][0] + cr[1] * cols[2][1] + cr[2] * cols[2][2] < 0) {
          cols[2] = cols[2].map((val) => -val);
        }
        return {
          moments: order.map((k) => Math.max(a[k][k], 1e-30)),
          quat: quatFromCols(cols[0], cols[1], cols[2])
        };
      };

      // Track existing world positions of alive members before modifying frames
      const memberWorldPos = new Array(memberCount).fill(null);
      for (let m = 0; m < memberCount; m += 1) {
        if (mf[m * 8 + 3] > 0) {
          const b = mu[m * 8 + 4];
          const cx = [ff[b * 32 + 0], ff[b * 32 + 1], ff[b * 32 + 2]];
          const q = [ff[b * 32 + 4], ff[b * 32 + 5], ff[b * 32 + 6], ff[b * 32 + 7]];
          const rw = rot(q, [mf[m * 8 + 0], mf[m * 8 + 1], mf[m * 8 + 2]]);
          memberWorldPos[m] = [cx[0] + rw[0], cx[1] + rw[1], cx[2] + rw[2]];
        }
      }

      let solidified = 0;
      const bodyAbsorbed = new Map();
      for (let m = 0; m < memberCount; m += 1) {
        if (mf[m * 8 + 3] > 0) continue; // already solid
        const row = releaseRows[m];
        if (row === 0xffffffff || row * 8 + 7 >= fs.length) continue;
        const mass = fs[row * 8 + 3];
        const uSpec = fs[row * 8 + 7];
        if (!(mass > 0) || uSpec > solidBranch.energyMaxJPerKg) continue;
        const b = mu[m * 8 + 4];
        if (b >= safeMaxBodyCapacity || !(ff[b * 32 + 3] > 0)) continue;

        const px = [fs[row * 8 + 0], fs[row * 8 + 1], fs[row * 8 + 2]];
        const pv = [fs[row * 8 + 4], fs[row * 8 + 5], fs[row * 8 + 6]];
        memberWorldPos[m] = px;
        mf[m * 8 + 3] = mass;

        if (!bodyAbsorbed.has(b)) bodyAbsorbed.set(b, []);
        bodyAbsorbed.get(b).push({ m, mass, px, pv });

        if (tf) {
          const T = solidBranch.referenceTemperatureK
            + (uSpec - solidBranch.referenceInternalEnergyJPerKg) / solidBranch.cvJPerKgK;
          tf[m * 4 + 0] = uSpec;
          tf[m * 4 + 1] = T;
          tf[m * 4 + 2] = 0;
          tf[m * 4 + 3] = 1;
        }
        // Zero fluid carrier mass & momentum exactly once absorbed into coherent solid!
        fs[row * 8 + 3] = 0;
        fs[row * 8 + 4] = 0;
        fs[row * 8 + 5] = 0;
        fs[row * 8 + 6] = 0;
        fs[row * 8 + 7] = 0;
        solidified += 1;
      }

      // Rebase each body that absorbed refrozen carriers with exact M, COM, P, L_0, and principal I!
      for (const [b, added] of bodyAbsorbed.entries()) {
        const base = b * 32;
        const M_old = ff[base + 3];
        const X_old = [ff[base + 0], ff[base + 1], ff[base + 2]];
        const q_old = [ff[base + 4], ff[base + 5], ff[base + 6], ff[base + 7]];
        const P_old = [ff[base + 8], ff[base + 9], ff[base + 10]];
        const L_old = [ff[base + 12], ff[base + 13], ff[base + 14]];

        let M_tot = 0;
        const MX = [0, 0, 0];
        for (let m = 0; m < memberCount; m += 1) {
          if (mu[m * 8 + 4] === b && mf[m * 8 + 3] > 0 && memberWorldPos[m]) {
            const mm = mf[m * 8 + 3];
            M_tot += mm;
            MX[0] += mm * memberWorldPos[m][0];
            MX[1] += mm * memberWorldPos[m][1];
            MX[2] += mm * memberWorldPos[m][2];
          }
        }
        const X_tot = MX.map((v) => v / M_tot);
        const P_tot = [...P_old];
        for (const item of added) {
          for (let k = 0; k < 3; k += 1) P_tot[k] += item.mass * item.pv[k];
        }
        const dOld = [X_old[0] - X_tot[0], X_old[1] - X_tot[1], X_old[2] - X_tot[2]];
        const shiftOld = cross3(dOld, P_old);
        const L_tot = [L_old[0] + shiftOld[0], L_old[1] + shiftOld[1], L_old[2] + shiftOld[2]];
        for (const item of added) {
          const rNew = [item.px[0] - X_tot[0], item.px[1] - X_tot[1], item.px[2] - X_tot[2]];
          const ang = cross3(rNew, item.pv.map((v) => item.mass * v));
          for (let k = 0; k < 3; k += 1) L_tot[k] += ang[k];
        }

        const inertia = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
        for (let m = 0; m < memberCount; m += 1) {
          if (mu[m * 8 + 4] === b && mf[m * 8 + 3] > 0 && memberWorldPos[m]) {
            const mm = mf[m * 8 + 3];
            const r = memberWorldPos[m].map((v, k) => v - X_tot[k]);
            const r2 = r[0] * r[0] + r[1] * r[1] + r[2] * r[2];
            for (let i = 0; i < 3; i += 1) {
              for (let j = 0; j < 3; j += 1) {
                inertia[i][j] += mm * ((i === j ? r2 : 0) - r[i] * r[j]);
              }
            }
          }
        }
        const { moments, quat } = jacobi3(inertia);
        ff.set([...X_tot, M_tot, ...quat, ...P_tot, 0, ...L_tot, 0, ...moments, 0], base);

        for (let m = 0; m < memberCount; m += 1) {
          if (mu[m * 8 + 4] === b && mf[m * 8 + 3] > 0 && memberWorldPos[m]) {
            const rWorld = memberWorldPos[m].map((v, k) => v - X_tot[k]);
            const rLocal = rotInv(quat, rWorld);
            mf[m * 8 + 0] = rLocal[0];
            mf[m * 8 + 1] = rLocal[1];
            mf[m * 8 + 2] = rLocal[2];
          }
        }
        if (lf) {
          for (let axis = 0; axis < 3; axis += 1) {
            const eWorld = rot(q_old, [lf[b * 16 + axis * 4 + 0], lf[b * 16 + axis * 4 + 1], lf[b * 16 + axis * 4 + 2]]);
            const eNew = rotInv(quat, eWorld);
            lf.set([eNew[0], eNew[1], eNew[2], 0], b * 16 + axis * 4);
          }
        }
        if (pf && pu) {
          for (let p = 0; p < proxyCount; p += 1) {
            if (pu[p * 8 + 4] === b) {
              const pWorld = rot(q_old, [pf[p * 8 + 0], pf[p * 8 + 1], pf[p * 8 + 2]])
                .map((v, k) => v + X_old[k] - X_tot[k]);
              const pLocal = rotInv(quat, pWorld);
              pf[p * 8 + 0] = pLocal[0];
              pf[p * 8 + 1] = pLocal[1];
              pf[p * 8 + 2] = pLocal[2];
            }
          }
        }
        // Re-link lattice faces between alive members of body b
        if (nu && lf) {
          const axesWorld = [0, 1, 2].map((ax) =>
            rot(quat, [lf[b * 16 + ax * 4 + 0], lf[b * 16 + ax * 4 + 1], lf[b * 16 + ax * 4 + 2]])
          );
          for (let i = 0; i < memberCount; i += 1) {
            if (mu[i * 8 + 4] !== b || !(mf[i * 8 + 3] > 0) || !memberWorldPos[i]) continue;
            for (let j = i + 1; j < memberCount; j += 1) {
              if (mu[j * 8 + 4] !== b || !(mf[j * 8 + 3] > 0) || !memberWorldPos[j]) continue;
              const d = memberWorldPos[j].map((v, k) => v - memberWorldPos[i][k]);
              for (let ax = 0; ax < 3; ax += 1) {
                const proj = d[0] * axesWorld[ax][0] + d[1] * axesWorld[ax][1] + d[2] * axesWorld[ax][2];
                const orthSq = d[0] * d[0] + d[1] * d[1] + d[2] * d[2] - proj * proj;
                if (Math.abs(Math.abs(proj) - pitch[ax]) < 0.2 * pitch[ax] && orthSq < (0.2 * pitch[ax]) ** 2) {
                  const faceI = proj > 0 ? ax * 2 : ax * 2 + 1;
                  const faceJ = faceI ^ 1;
                  nu[i * 8 + faceI] = j;
                  nu[j * 8 + faceJ] = i;
                }
              }
            }
          }
        }
      }

      if (solidified > 0) {
        device.queue.writeBuffer(memberBuffer, 0, mf);
        device.queue.writeBuffer(frameBuffer, 0, ff);
        device.queue.writeBuffer(fluidStateBuffer, 0, fs);
        if (lf && latticeBuffer) device.queue.writeBuffer(latticeBuffer, 0, lf);
        if (pf && proxyBuffer) device.queue.writeBuffer(proxyBuffer, 0, pf);
        if (nu && neighborBuffer) device.queue.writeBuffer(neighborBuffer, 0, nu);
        if (tf && activeThermoBuffer) device.queue.writeBuffer(activeThermoBuffer, 0, tf);
        if (tf && thermoBuffer && thermoBuffer !== activeThermoBuffer) {
          device.queue.writeBuffer(thermoBuffer, 0, tf);
        }
        const topoSummary = await readF32(topoStateBuffer, 4);
        const tu = new Uint32Array(topoSummary.buffer);
        tu[3] += solidified;
        device.queue.writeBuffer(topoStateBuffer, 0, tu);
        if (fluidThermoBuffer) {
          const ft = await readF32(fluidThermoBuffer, Math.floor(fluidThermoBuffer.size / 4));
          for (let m = 0; m < memberCount; m += 1) {
            const row = releaseRows[m];
            if (row !== 0xffffffff && fs[row * 8 + 3] === 0 && row * 12 + 9 < ft.length) {
              ft[row * 12 + 9] = 0; // zero represented entities on solidified fluid slot
            }
          }
          device.queue.writeBuffer(fluidThermoBuffer, 0, ft);
        }
      }
      return solidified;
    },
    async readTopologySummary() {
      const staging = device.createBuffer({ size: 16, usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST });
      const e = device.createCommandEncoder();
      e.copyBufferToBuffer(topoStateBuffer, 0, staging, 0, 16);
      device.queue.submit([e.finish()]);
      await staging.mapAsync(GPU_BUFFER_USAGE.MAP_READ);
      const w = new Uint32Array(staging.getMappedRange().slice(0));
      staging.unmap();
      staging.destroy();
      return {
        activeBodyCount: w[0],
        cleavedBonds: w[1],
        splitEvents: w[2],
        solidifiedCount: w[3]
      };
    },
    destroy() {
      paramsBuffer.destroy();
      memberLoadBuffer.destroy();
      topoStateBuffer.destroy();
      proxyPlaceholder?.destroy();
      thermoPlaceholder?.destroy();
    }
  });
}
