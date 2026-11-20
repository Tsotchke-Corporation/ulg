import { computeBufferBinding, createCachedExplicitComputePipeline } from '../webgpuComputeLayout.js';

// A5 SOL-4 (plan/todo/sol-critic.md, .icc/completion-oracles.yaml):
// Explicit material-space deformable surface carrier attached to fixed-corotated
// elasto-plastic MLS-MPM/APIC state, advected and rendered directly on the GPU
// without density-field / metaball rounding or CPU vertex readback.
//
// Surface embedding law:
//   Each material-space surface vertex X_v carries up to 8 material-point
//   indices p_a and partition-of-unity weights w_{va} >= 0, sum_a w_{va} = 1.
//   Given current particle world positions x_p (stateBuffer[p*8 + 0..2]) and
//   deformation gradients F_p (mechanicsBuffer[p*32 + 0..8], exact ULG
//   MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT):
//     x_v(t) = sum_{a=0..7} w_{va} * (x_{p_a}(t) + F_{p_a}(t) * (X_v - X_{p_a}))
//   Under any rigid motion (x_p = R X_p + c, F_p = R) or uniform affine map
//   (x_p = A X_p + c, F_p = A), x_v(t) reproduces R X_v + c or A X_v + c to
//   f32 precision across arbitrary grid crossings with zero metaball blobbiness.
export const SCHROEDER_DEFORMABLE_SOLID_SURFACE_SCHEMA =
  'peercompute.ulg.schroeder-deformable-solid-surface.v1';

const GPU_BUFFER_USAGE = Object.freeze({
  MAP_READ: 0x01,
  COPY_SRC: 0x04,
  COPY_DST: 0x08,
  INDEX: 0x10,
  VERTEX: 0x20,
  UNIFORM: 0x40,
  STORAGE: 0x80
});

/**
 * Build an explicit closed material-space surface mesh and 8-neighbor APIC/F
 * partition-of-unity embedding from initial solid material points on a pitchM
 * lattice.
 */
export function buildSchroederDeformableSolidSurfaceMesh(particles, { pitchM }) {
  const pitch = Array.isArray(pitchM) ? pitchM.map(Number) : [Number(pitchM), Number(pitchM), Number(pitchM)];
  if (!pitch.every((v) => v > 0) || !Array.isArray(particles) || particles.length === 0) {
    throw new TypeError('Deformable solid surface mesh requires positive pitchM and particles');
  }
  const count = particles.length;
  const restPositions = new Float32Array(count * 4);
  for (let i = 0; i < count; i += 1) {
    restPositions[i * 4 + 0] = particles[i].x[0];
    restPositions[i * 4 + 1] = particles[i].x[1];
    restPositions[i * 4 + 2] = particles[i].x[2];
    restPositions[i * 4 + 3] = particles[i].massKg ?? 1;
  }

  const origin = particles[0].x;
  const cells = particles.map((p) => [
    Math.round((p.x[0] - origin[0]) / pitch[0]),
    Math.round((p.x[1] - origin[1]) / pitch[1]),
    Math.round((p.x[2] - origin[2]) / pitch[2])
  ]);
  const cellMap = new Map(cells.map((c, idx) => [c.join(','), idx]));
  const half = pitch.map((v) => 0.5 * v);

  // Deduplicate corners on the integer half-lattice so the mesh is watertight/closed!
  // Wait: sharp-shaded faces look clean while sharing exact corner positions guarantees
  // exact watertight divergence-theorem volume V = (1/6) sum x0 . (x1 x x2)!
  const uniqueCornerPos = [];
  const cornerKeyToIndex = new Map();
  const faceVertices = []; // unshared render vertices (pos + face normal) via triangle corners
  const triangleIndices = [];

  function acquireCorner(ci, cj, ck) {
    // ci, cj, ck in half-cell units (2*cell + sign)
    const key = `${ci},${cj},${ck}`;
    let idx = cornerKeyToIndex.get(key);
    if (idx === undefined) {
      idx = uniqueCornerPos.length / 3;
      cornerKeyToIndex.set(key, idx);
      uniqueCornerPos.push(
        origin[0] + 0.5 * ci * pitch[0],
        origin[1] + 0.5 * cj * pitch[1],
        origin[2] + 0.5 * ck * pitch[2]
      );
    }
    return idx;
  }

  const axes = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let p = 0; p < count; p += 1) {
    const [cx, cy, cz] = cells[p];
    for (let axis = 0; axis < 3; axis += 1) {
      for (const sign of [-1, 1]) {
        const nb = [cx, cy, cz];
        nb[axis] += sign;
        if (cellMap.has(nb.join(','))) continue;

        const ku = (axis + 1) % 3;
        const kv = (axis + 2) % 3;
        const cornerHalfCoords = (su, sv) => {
          const hc = [2 * cx, 2 * cy, 2 * cz];
          hc[axis] += sign;
          hc[ku] += su;
          hc[kv] += sv;
          return acquireCorner(hc[0], hc[1], hc[2]);
        };
        let q = [
          cornerHalfCoords(-1, -1),
          cornerHalfCoords(1, -1),
          cornerHalfCoords(1, 1),
          cornerHalfCoords(-1, 1)
        ];
        // Ensure outward counter-clockwise winding along +sign * axes[axis]
        const p0 = uniqueCornerPos.slice(q[0] * 3, q[0] * 3 + 3);
        const p1 = uniqueCornerPos.slice(q[1] * 3, q[1] * 3 + 3);
        const p2 = uniqueCornerPos.slice(q[2] * 3, q[2] * 3 + 3);
        const e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
        const e2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
        const cr = [
          e1[1] * e2[2] - e1[2] * e2[1],
          e1[2] * e2[0] - e1[0] * e2[2],
          e1[0] * e2[1] - e1[1] * e2[0]
        ];
        const n = axes[axis].map((v) => sign * v);
        if (cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] < 0) {
          q = [q[0], q[3], q[2], q[1]];
        }
        triangleIndices.push(q[0], q[1], q[2], q[0], q[2], q[3]);
        faceVertices.push(q[0], q[1], q[2], q[0], q[2], q[3]);
      }
    }
  }

  const vertexCount = uniqueCornerPos.length / 3;
  const triangleCount = triangleIndices.length / 3;

  // Build up to 8 nearest-support material-point weights per unique surface corner
  // using smooth compact Gaussian/Wendland-like weights normalized to exact sum = 1.
  const vertRest = new Float32Array(vertexCount * 4);
  const vertIndices = new Uint32Array(vertexCount * 8);
  const vertWeights = new Float32Array(vertexCount * 8);
  const supportScale = 1.75 * Math.max(...pitch);

  for (let v = 0; v < vertexCount; v += 1) {
    const vx = uniqueCornerPos[v * 3 + 0];
    const vy = uniqueCornerPos[v * 3 + 1];
    const vz = uniqueCornerPos[v * 3 + 2];
    vertRest[v * 4 + 0] = vx;
    vertRest[v * 4 + 1] = vy;
    vertRest[v * 4 + 2] = vz;
    vertRest[v * 4 + 3] = 1;

    const candidates = [];
    for (let p = 0; p < count; p += 1) {
      const dx = vx - particles[p].x[0];
      const dy = vy - particles[p].x[1];
      const dz = vz - particles[p].x[2];
      const d2 = dx * dx + dy * dy + dz * dz;
      candidates.push({ p, d2 });
    }
    candidates.sort((a, b) => a.d2 - b.d2 || a.p - b.p);
    const chosen = candidates.slice(0, Math.min(8, candidates.length));
    let wSum = 0;
    const rawW = chosen.map(({ d2 }) => {
      const r = Math.sqrt(d2) / supportScale;
      const w = r < 1.5 ? Math.exp(-2.0 * r * r) : 1e-6 / (1 + r * r);
      wSum += w;
      return w;
    });
    let accF32 = 0;
    for (let k = 0; k < 8; k += 1) {
      if (k < chosen.length) {
        vertIndices[v * 8 + k] = chosen[k].p;
        if (k === chosen.length - 1) {
          vertWeights[v * 8 + k] = Math.max(0, 1.0 - accF32);
        } else {
          const wf = Math.fround(rawW[k] / wSum);
          vertWeights[v * 8 + k] = wf;
          accF32 = Math.fround(accF32 + wf);
        }
      } else {
        vertIndices[v * 8 + k] = chosen[0].p;
        vertWeights[v * 8 + k] = 0;
      }
    }
  }

  return Object.freeze({
    schema: SCHROEDER_DEFORMABLE_SOLID_SURFACE_SCHEMA,
    particleCount: count,
    vertexCount,
    triangleCount,
    pitchM: Object.freeze([...pitch]),
    halfM: Object.freeze(half),
    restParticlePositions: restPositions,
    vertexRestPositions: vertRest,
    vertexEmbedIndices: vertIndices,
    vertexEmbedWeights: vertWeights,
    triangleIndices: new Uint32Array(triangleIndices)
  });
}

export const schroederDeformableSurfaceAdvectWgsl = /* wgsl */ `
struct SurfaceParams {
  // vertex_count, triangle_count, particle_count, mechanics_stride_floats
  counts: vec4<u32>,
};

@group(0) @binding(0) var<uniform> params: SurfaceParams;
@group(0) @binding(1) var<storage, read> particle_state: array<f32>;
@group(0) @binding(2) var<storage, read> particle_mechanics: array<f32>;
@group(0) @binding(3) var<storage, read> rest_particles: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> vert_rest: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read> vert_indices: array<vec4<u32>>;
@group(0) @binding(6) var<storage, read> vert_weights: array<vec4<f32>>;
@group(0) @binding(7) var<storage, read> triangles: array<u32>;
@group(0) @binding(8) var<storage, read_write> deformed_verts: array<vec4<f32>>;
// Expanded triangle render vertices (triangle_count * 3 * 2 vec4: [pos, 0], [normal, 0])
// plus 8 f32 summary words at the end: [signed_volume * 6, area * 2, vol_cx, vol_cy, vol_cz, min_y, max_y, inverted_count]
@group(0) @binding(9) var<storage, read_write> render_tris: array<vec4<f32>>;
@group(0) @binding(10) var<storage, read_write> mesh_summary: array<atomic<i32>>;

const FIXED_SCALE: f32 = 1048576.0; // 2^20 fixed-point for volume/area/bounds summary

@compute @workgroup_size(64)
fn clear_summary(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x < 8u) {
    if (id.x == 5u) {
      atomicStore(&mesh_summary[id.x], 2147483647);
    } else if (id.x == 6u) {
      atomicStore(&mesh_summary[id.x], -2147483647);
    } else {
      atomicStore(&mesh_summary[id.x], 0);
    }
  }
}

@compute @workgroup_size(64)
fn advect_vertices(@builtin(global_invocation_id) id: vec3<u32>) {
  let v = id.x;
  if (v >= params.counts.x) { return; }
  let xv0 = vert_rest[v].xyz;
  let idx0 = vert_indices[v * 2u];
  let idx1 = vert_indices[v * 2u + 1u];
  let w0 = vert_weights[v * 2u];
  let w1 = vert_weights[v * 2u + 1u];
  let idx = array<u32, 8>(idx0.x, idx0.y, idx0.z, idx0.w, idx1.x, idx1.y, idx1.z, idx1.w);
  let w = array<f32, 8>(w0.x, w0.y, w0.z, w0.w, w1.x, w1.y, w1.z, w1.w);

  var world = vec3<f32>(0.0);
  let mstride = params.counts.w;
  for (var k = 0u; k < 8u; k = k + 1u) {
    let wk = w[k];
    if (wk <= 0.0) { continue; }
    let p = idx[k];
    if (p >= params.counts.z) { continue; }
    let sbase = p * 8u;
    let xp = vec3<f32>(particle_state[sbase + 0u], particle_state[sbase + 1u], particle_state[sbase + 2u]);
    let xp0 = rest_particles[p].xyz;
    let dX = xv0 - xp0;
    let mbase = p * mstride;
    // Exact ULG MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT row-major F00..F22:
    let f0 = vec3<f32>(particle_mechanics[mbase + 0u], particle_mechanics[mbase + 1u], particle_mechanics[mbase + 2u]);
    let f1 = vec3<f32>(particle_mechanics[mbase + 3u], particle_mechanics[mbase + 4u], particle_mechanics[mbase + 5u]);
    let f2 = vec3<f32>(particle_mechanics[mbase + 6u], particle_mechanics[mbase + 7u], particle_mechanics[mbase + 8u]);
    let FdX = vec3<f32>(dot(f0, dX), dot(f1, dX), dot(f2, dX));
    world = world + wk * (xp + FdX);
  }
  deformed_verts[v] = vec4<f32>(world, 1.0);
  let yi = i32(clamp(round(world.y * FIXED_SCALE), -2.0e9, 2.0e9));
  atomicMin(&mesh_summary[5], yi);
  atomicMax(&mesh_summary[6], yi);
}

@compute @workgroup_size(64)
fn build_render_triangles(@builtin(global_invocation_id) id: vec3<u32>) {
  let t = id.x;
  if (t >= params.counts.y) { return; }
  let i0 = triangles[t * 3u + 0u];
  let i1 = triangles[t * 3u + 1u];
  let i2 = triangles[t * 3u + 2u];
  let p0 = deformed_verts[i0].xyz;
  let p1 = deformed_verts[i1].xyz;
  let p2 = deformed_verts[i2].xyz;
  let cr = cross(p1 - p0, p2 - p0);
  let len_cr = length(cr);
  let n = select(vec3<f32>(0.0, 1.0, 0.0), cr / len_cr, len_cr > 1.0e-20);

  let out_base = t * 6u;
  render_tris[out_base + 0u] = vec4<f32>(p0, 1.0);
  render_tris[out_base + 1u] = vec4<f32>(n, 0.0);
  render_tris[out_base + 2u] = vec4<f32>(p1, 1.0);
  render_tris[out_base + 3u] = vec4<f32>(n, 0.0);
  render_tris[out_base + 4u] = vec4<f32>(p2, 1.0);
  render_tris[out_base + 5u] = vec4<f32>(n, 0.0);

  // Divergence theorem: V = (1/6) sum p0 . (p1 x p2), centroid = (1/24V) sum (p0+p1+p2) (p0 . (p1 x p2))
  let vol6 = dot(p0, cr);
  let tri_center = 0.25 * (p0 + p1 + p2);
  atomicAdd(&mesh_summary[0], i32(clamp(round(vol6 * FIXED_SCALE * 64.0), -2.0e9, 2.0e9)));
  atomicAdd(&mesh_summary[1], i32(clamp(round(len_cr * FIXED_SCALE), -2.0e9, 2.0e9)));
  atomicAdd(&mesh_summary[2], i32(clamp(round(vol6 * tri_center.x * FIXED_SCALE * 64.0), -2.0e9, 2.0e9)));
  atomicAdd(&mesh_summary[3], i32(clamp(round(vol6 * tri_center.y * FIXED_SCALE * 64.0), -2.0e9, 2.0e9)));
  atomicAdd(&mesh_summary[4], i32(clamp(round(vol6 * tri_center.z * FIXED_SCALE * 64.0), -2.0e9, 2.0e9)));
  if (len_cr <= 1.0e-18) {
    atomicAdd(&mesh_summary[7], 1);
  }
}
`;

export function createSchroederDeformableSolidSurfaceStage({
  device,
  mesh,
  mechanicsStrideFloats = 32
}) {
  const bindings = [
    computeBufferBinding(0, 'uniform'),
    computeBufferBinding(1, 'read-only-storage'),
    computeBufferBinding(2, 'read-only-storage'),
    computeBufferBinding(3, 'read-only-storage'),
    computeBufferBinding(4, 'read-only-storage'),
    computeBufferBinding(5, 'read-only-storage'),
    computeBufferBinding(6, 'read-only-storage'),
    computeBufferBinding(7, 'read-only-storage'),
    computeBufferBinding(8, 'storage'),
    computeBufferBinding(9, 'storage'),
    computeBufferBinding(10, 'storage')
  ];
  const pipelines = Object.fromEntries(
    ['clear_summary', 'advect_vertices', 'build_render_triangles'].map((entryPoint) => [
      entryPoint,
      createCachedExplicitComputePipeline(device, {
        cacheKey: `ulg-sol4-surface-${entryPoint}.v1`,
        label: `ulg-sol4-surface-${entryPoint}`,
        code: schroederDeformableSurfaceAdvectWgsl,
        entryPoint,
        bindings
      })
    ])
  );
  const upload = (label, data) => {
    const b = device.createBuffer({
      label,
      size: Math.max(16, data.byteLength),
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.COPY_SRC
    });
    device.queue.writeBuffer(b, 0, data);
    return b;
  };
  const paramsBuffer = device.createBuffer({
    label: 'ulg-sol4-surface-params',
    size: 16,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  device.queue.writeBuffer(
    paramsBuffer,
    0,
    new Uint32Array([mesh.vertexCount, mesh.triangleCount, mesh.particleCount, mechanicsStrideFloats])
  );
  const restParticlesBuffer = upload('ulg-sol4-rest-particles', mesh.restParticlePositions);
  const vertRestBuffer = upload('ulg-sol4-vert-rest', mesh.vertexRestPositions);
  const vertIndicesBuffer = upload('ulg-sol4-vert-indices', mesh.vertexEmbedIndices);
  const vertWeightsBuffer = upload('ulg-sol4-vert-weights', mesh.vertexEmbedWeights);
  const trianglesBuffer = upload('ulg-sol4-triangles', mesh.triangleIndices);
  const deformedVertsBuffer = device.createBuffer({
    label: 'ulg-sol4-deformed-verts',
    size: Math.max(16, mesh.vertexCount * 16),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const renderTrisBuffer = device.createBuffer({
    label: 'ulg-sol4-render-tris',
    size: Math.max(32, mesh.triangleCount * 3 * 32),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const summaryBuffer = device.createBuffer({
    label: 'ulg-sol4-mesh-summary',
    size: 32,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const bindGroups = new Map();

  return Object.freeze({
    mesh,
    deformedVertsBuffer,
    renderTrisBuffer,
    summaryBuffer,
    renderVertexCount: mesh.triangleCount * 3,
    encode(encoder, { stateBuffer, mechanicsBuffer, pass: sharedPass = null }) {
      let group = null;
      for (const [k, g] of bindGroups) {
        if (k[0] === stateBuffer && k[1] === mechanicsBuffer) group = g;
      }
      if (!group) {
        group = device.createBindGroup({
          layout: pipelines.advect_vertices.bindGroupLayout,
          entries: [
            paramsBuffer,
            stateBuffer,
            mechanicsBuffer,
            restParticlesBuffer,
            vertRestBuffer,
            vertIndicesBuffer,
            vertWeightsBuffer,
            trianglesBuffer,
            deformedVertsBuffer,
            renderTrisBuffer,
            summaryBuffer
          ].map((buffer, binding) => ({ binding, resource: { buffer } }))
        });
        if (bindGroups.size > 4) bindGroups.clear();
        bindGroups.set([stateBuffer, mechanicsBuffer], group);
      }
      const pass = sharedPass ?? encoder.beginComputePass({ label: 'ulg-sol4-surface-advect' });
      pass.setBindGroup(0, group);
      pass.setPipeline(pipelines.clear_summary.pipeline);
      pass.dispatchWorkgroups(1);
      pass.setPipeline(pipelines.advect_vertices.pipeline);
      pass.dispatchWorkgroups(Math.ceil(mesh.vertexCount / 64));
      pass.setPipeline(pipelines.build_render_triangles.pipeline);
      pass.dispatchWorkgroups(Math.ceil(mesh.triangleCount / 64));
      if (!sharedPass) pass.end();
    },
    async readSummary() {
      const staging = device.createBuffer({ size: 32, usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST });
      const enc = device.createCommandEncoder();
      enc.copyBufferToBuffer(summaryBuffer, 0, staging, 0, 32);
      device.queue.submit([enc.finish()]);
      await staging.mapAsync(GPU_BUFFER_USAGE.MAP_READ);
      const words = new Int32Array(staging.getMappedRange().slice(0));
      staging.unmap();
      staging.destroy();
      const SCALE = 1048576.0;
      const vol6 = words[0] / (SCALE * 64.0);
      const volumeM3 = vol6 / 6.0;
      const areaM2 = 0.5 * (words[1] / SCALE);
      const invVol6 = Math.abs(vol6) > 1e-12 ? 1.0 / vol6 : 0;
      return {
        volumeM3,
        areaM2,
        centroidM: [
          (words[2] / (SCALE * 64.0)) * invVol6,
          (words[3] / (SCALE * 64.0)) * invVol6,
          (words[4] / (SCALE * 64.0)) * invVol6
        ],
        minYM: words[5] / SCALE,
        maxYM: words[6] / SCALE,
        degenerateTriangles: words[7]
      };
    },
    destroy() {
      for (const b of [
        paramsBuffer,
        restParticlesBuffer,
        vertRestBuffer,
        vertIndicesBuffer,
        vertWeightsBuffer,
        trianglesBuffer,
        deformedVertsBuffer,
        renderTrisBuffer,
        summaryBuffer
      ]) {
        b.destroy();
      }
    }
  });
}

export const schroederDeformableSurfaceRenderWgsl = /* wgsl */ `
struct RenderUniforms {
  view_projection: mat4x4<f32>,
  color: vec4<f32>,
  light: vec4<f32>,
};
@group(0) @binding(0) var<uniform> uniforms: RenderUniforms;
@group(0) @binding(1) var<storage, read> render_tris: array<vec4<f32>>;

struct VertexOut {
  @builtin(position) clip: vec4<f32>,
  @location(0) normal: vec3<f32>,
};

@vertex
fn vs_deformable(@builtin(vertex_index) index: u32) -> VertexOut {
  let pos = render_tris[index * 2u].xyz;
  let nrm = render_tris[index * 2u + 1u].xyz;
  var out: VertexOut;
  out.clip = uniforms.view_projection * vec4<f32>(pos, 1.0);
  out.normal = nrm;
  return out;
}

@fragment
fn fs_deformable(in: VertexOut) -> @location(0) vec4<f32> {
  let diffuse = max(dot(normalize(in.normal), normalize(uniforms.light.xyz)), 0.0);
  let shade = uniforms.light.w + (1.0 - uniforms.light.w) * diffuse;
  return vec4<f32>(uniforms.color.rgb * shade, uniforms.color.a);
}
`;

export function createSchroederDeformableSolidSurfaceRenderer(
  device,
  { colorFormat = 'rgba8unorm', depthFormat = 'depth24plus' } = {}
) {
  const module = device.createShaderModule({
    label: 'ulg-sol4-surface-render',
    code: schroederDeformableSurfaceRenderWgsl
  });
  const pipeline = device.createRenderPipeline({
    label: 'ulg-sol4-surface-render',
    layout: 'auto',
    vertex: { module, entryPoint: 'vs_deformable' },
    fragment: { module, entryPoint: 'fs_deformable', targets: [{ format: colorFormat }] },
    primitive: { topology: 'triangle-list', cullMode: 'back', frontFace: 'ccw' },
    depthStencil: depthFormat ? { format: depthFormat, depthWriteEnabled: true, depthCompare: 'less' } : undefined
  });
  const bindGroups = new Map();

  return Object.freeze({
    draw(
      pass,
      surfaceStage,
      {
        viewProjection,
        colorLinear = [0.82, 0.56, 0.34],
        alpha = 1,
        ambient = 0.35,
        lightDirection = [0.35, 0.82, 0.45]
      }
    ) {
      const f = new Float32Array(24);
      f.set(viewProjection, 0);
      f.set([...colorLinear, alpha], 16);
      f.set([...lightDirection, ambient], 20);
      let record = bindGroups.get(surfaceStage.renderTrisBuffer);
      if (!record) {
        const uniformBuffer = device.createBuffer({
          label: 'ulg-sol4-surface-render-uniforms',
          size: 96,
          usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
        });
        const group = device.createBindGroup({
          layout: pipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: uniformBuffer } },
            { binding: 1, resource: { buffer: surfaceStage.renderTrisBuffer } }
          ]
        });
        record = { uniformBuffer, group };
        if (bindGroups.size >= 32) {
          for (const old of bindGroups.values()) old.uniformBuffer.destroy();
          bindGroups.clear();
        }
        bindGroups.set(surfaceStage.renderTrisBuffer, record);
      }
      device.queue.writeBuffer(record.uniformBuffer, 0, f);
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, record.group);
      pass.draw(surfaceStage.renderVertexCount);
    },
    destroy() {
      for (const rec of bindGroups.values()) rec.uniformBuffer.destroy();
      bindGroups.clear();
    }
  });
}

// GPU Fixed-Corotated Elasto-Plastic MLS-MPM/APIC Solver Stage (SOL-4):
// Operates on exact ULG stateBuffer (8 floats/row) & mechanicsBuffer (32 floats/row),
// with polar decomposition R of F_e, fixed-corotated stress P = 2 mu (F_e - R) + lambda (J - 1) J F_e^{-T},
// von Mises / Hencky return mapping on singular/principal stretches above yieldStressPa,
// dissipating plastic work dW_p >= 0 into internal energy u (stateBuffer[p*8 + 7]),
// plus optional fluid-immersion Archimedes buoyancy + quadratic drag below fluidSurfaceYM.
export const schroederElastoPlasticMpmWgsl = /* wgsl */ `
struct MpmParams {
  // particle_count, grid_nx, grid_ny, grid_nz
  counts: vec4<u32>,
  // dx, inv_dx, dt, friction
  grid: vec4<f32>,
  // gravity xyz, wall_margin_cells
  gravity: vec4<f32>,
  // mu (shear Pa), lambda (Lame Pa), yield_stress_pa, fluid_density_kg_m3
  material: vec4<f32>,
  // fluid_surface_y_m, fluid_drag_coeff, specific_heat_cv, unused
  fluid: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: MpmParams;
@group(0) @binding(1) var<storage, read_write> state: array<f32>;
@group(0) @binding(2) var<storage, read_write> mechanics: array<f32>;
@group(0) @binding(3) var<storage, read_write> grid_nodes: array<atomic<u32>>;

fn atomic_add_f32(ptr_word: ptr<storage, atomic<u32>, read_write>, delta: f32) {
  if (delta == 0.0) { return; }
  var old_bits = atomicLoad(ptr_word);
  loop {
    let next_val = bitcast<f32>(old_bits) + delta;
    let res = atomicCompareExchangeWeak(ptr_word, old_bits, bitcast<u32>(next_val));
    if (res.exchanged) { break; }
    old_bits = res.old_value;
  }
}

fn mat3_mul(a: mat3x3<f32>, b: mat3x3<f32>) -> mat3x3<f32> {
  return a * b;
}

fn mat3_det(m: mat3x3<f32>) -> f32 {
  return determinant(m);
}

// Higham polar decomposition R of 3x3 F_e (5 Newton-Schulz / inverse-transpose iterations)
fn polar_rotation(F_in: mat3x3<f32>) -> mat3x3<f32> {
  var R = F_in;
  for (var it = 0u; it < 6u; it = it + 1u) {
    let c0 = R[0]; let c1 = R[1]; let c2 = R[2];
    let adj_t0 = cross(c1, c2);
    let adj_t1 = cross(c2, c0);
    let adj_t2 = cross(c0, c1);
    let det = dot(c0, adj_t0);
    if (abs(det) < 1.0e-12) {
      return mat3x3<f32>(vec3<f32>(1.0,0.0,0.0), vec3<f32>(0.0,1.0,0.0), vec3<f32>(0.0,0.0,1.0));
    }
    let inv_t = mat3x3<f32>(adj_t0 / det, adj_t1 / det, adj_t2 / det);
    R = 0.5 * (R + inv_t);
  }
  return R;
}

fn mat3_inv_transpose(F_in: mat3x3<f32>, det: f32) -> mat3x3<f32> {
  let c0 = F_in[0]; let c1 = F_in[1]; let c2 = F_in[2];
  let inv_d = select(1.0, 1.0 / det, abs(det) > 1.0e-12);
  return mat3x3<f32>(cross(c1, c2) * inv_d, cross(c2, c0) * inv_d, cross(c0, c1) * inv_d);
}

@compute @workgroup_size(128)
fn clear_grid(@builtin(global_invocation_id) id: vec3<u32>) {
  let total = params.counts.y * params.counts.z * params.counts.w * 4u;
  if (id.x < total) {
    atomicStore(&grid_nodes[id.x], 0u);
  }
}

@compute @workgroup_size(64)
fn p2g(@builtin(global_invocation_id) id: vec3<u32>) {
  let p = id.x;
  if (p >= params.counts.x) { return; }
  let sb = p * 8u;
  let mb = p * 32u;
  let mass = state[sb + 3u];
  if (!(mass > 0.0)) { return; }
  let xp = vec3<f32>(state[sb + 0u], state[sb + 1u], state[sb + 2u]);
  let vp = vec3<f32>(state[sb + 4u], state[sb + 5u], state[sb + 6u]);

  // Row-major F00..F22 -> WGSL column-major mat3x3
  let F = mat3x3<f32>(
    vec3<f32>(mechanics[mb + 0u], mechanics[mb + 3u], mechanics[mb + 6u]),
    vec3<f32>(mechanics[mb + 1u], mechanics[mb + 4u], mechanics[mb + 7u]),
    vec3<f32>(mechanics[mb + 2u], mechanics[mb + 5u], mechanics[mb + 8u])
  );
  let C = mat3x3<f32>(
    vec3<f32>(mechanics[mb + 9u], mechanics[mb + 12u], mechanics[mb + 15u]),
    vec3<f32>(mechanics[mb + 10u], mechanics[mb + 13u], mechanics[mb + 16u]),
    vec3<f32>(mechanics[mb + 11u], mechanics[mb + 14u], mechanics[mb + 17u])
  );
  let vol0 = mechanics[mb + 19u];

  let R = polar_rotation(F);
  let J = clamp(mat3_det(F), 0.2, 5.0);
  let FinvT = mat3_inv_transpose(F, J);
  let mu = params.material.x;
  let lam = params.material.y;
  // First Piola-Kirchhoff stress P and Kirchhoff stress tau = P * F^T:
  let P = 2.0 * mu * (F - R) + lam * (J - 1.0) * J * FinvT;
  let FT = transpose(F);
  let stress = P * FT;

  let dx = params.grid.x;
  let inv_dx = params.grid.y;
  let dt = params.grid.z;
  let affine = (-dt * vol0 * 4.0 * inv_dx * inv_dx) * stress + mass * C;

  let base = vec3<i32>(floor(xp * inv_dx - vec3<f32>(0.5)));
  let fx = xp * inv_dx - vec3<f32>(base);
  let w0 = 0.5 * (vec3<f32>(1.5) - fx) * (vec3<f32>(1.5) - fx);
  let w1 = vec3<f32>(0.75) - (fx - vec3<f32>(1.0)) * (fx - vec3<f32>(1.0));
  let w2 = 0.5 * (fx - vec3<f32>(0.5)) * (fx - vec3<f32>(0.5));
  let wx = array<f32, 3>(w0.x, w1.x, w2.x);
  let wy = array<f32, 3>(w0.y, w1.y, w2.y);
  let wz = array<f32, 3>(w0.z, w1.z, w2.z);

  let nx = i32(params.counts.y);
  let ny = i32(params.counts.z);
  let nz = i32(params.counts.w);

  for (var i = 0; i < 3; i = i + 1) {
    let gx = base.x + i;
    if (gx < 0 || gx >= nx) { continue; }
    for (var j = 0; j < 3; j = j + 1) {
      let gy = base.y + j;
      if (gy < 0 || gy >= ny) { continue; }
      for (var k = 0; k < 3; k = k + 1) {
        let gz = base.z + k;
        if (gz < 0 || gz >= nz) { continue; }
        let weight = wx[i] * wy[j] * wz[k];
        let dpos = (vec3<f32>(f32(i), f32(j), f32(k)) - fx) * dx;
        let mom = weight * (mass * vp + affine * dpos);
        let wm = weight * mass;
        let node = u32((gz * ny + gy) * nx + gx) * 4u;
        atomic_add_f32(&grid_nodes[node + 0u], mom.x);
        atomic_add_f32(&grid_nodes[node + 1u], mom.y);
        atomic_add_f32(&grid_nodes[node + 2u], mom.z);
        atomic_add_f32(&grid_nodes[node + 3u], wm);
      }
    }
  }
}

@compute @workgroup_size(128)
fn update_grid(@builtin(global_invocation_id) id: vec3<u32>) {
  let nx = params.counts.y;
  let ny = params.counts.z;
  let nz = params.counts.w;
  let idx = id.x;
  if (idx >= nx * ny * nz) { return; }
  let base = idx * 4u;
  let m = bitcast<f32>(atomicLoad(&grid_nodes[base + 3u]));
  if (!(m > 0.0)) { return; }
  var v = vec3<f32>(
    bitcast<f32>(atomicLoad(&grid_nodes[base + 0u])),
    bitcast<f32>(atomicLoad(&grid_nodes[base + 1u])),
    bitcast<f32>(atomicLoad(&grid_nodes[base + 2u]))
  ) / m;

  let dt = params.grid.z;
  let gx = idx % nx;
  let gy = (idx / nx) % ny;
  let gz = idx / (nx * ny);
  let y_world = f32(gy) * params.grid.x;

  let g_eff = params.gravity.xyz;
  if (params.material.w > 0.0 && y_world < params.fluid.x) {
    let sub_frac = clamp((params.fluid.x - y_world) * params.grid.y, 0.0, 1.0);
    let speed = length(v);
    v = v / (1.0 + dt * params.fluid.y * sub_frac * (1.0 + speed));
  }
  v = v + dt * g_eff;

  let margin = u32(max(params.gravity.w, 2.0));
  let fric = params.grid.w;
  if (gx < margin && v.x < 0.0) { v.x = 0.0; }
  if (gx >= nx - margin && v.x > 0.0) { v.x = 0.0; }
  if (gy < margin && v.y < 0.0) {
    let vn = -v.y;
    v.y = 0.0;
    let vt = vec2<f32>(v.x, v.z);
    let vtl = length(vt);
    if (vtl > 1.0e-9) {
      let scale = max(0.0, vtl - fric * vn) / vtl;
      v.x = v.x * scale;
      v.z = v.z * scale;
    }
  }
  if (gy >= ny - margin && v.y > 0.0) { v.y = 0.0; }
  if (gz < margin && v.z < 0.0) { v.z = 0.0; }
  if (gz >= nz - margin && v.z > 0.0) { v.z = 0.0; }

  atomicStore(&grid_nodes[base + 0u], bitcast<u32>(v.x));
  atomicStore(&grid_nodes[base + 1u], bitcast<u32>(v.y));
  atomicStore(&grid_nodes[base + 2u], bitcast<u32>(v.z));
}

@compute @workgroup_size(64)
fn g2p(@builtin(global_invocation_id) id: vec3<u32>) {
  let p = id.x;
  if (p >= params.counts.x) { return; }
  let sb = p * 8u;
  let mb = p * 32u;
  let mass = state[sb + 3u];
  if (!(mass > 0.0)) { return; }
  var xp = vec3<f32>(state[sb + 0u], state[sb + 1u], state[sb + 2u]);
  var u_spec = state[sb + 7u];

  let dx = params.grid.x;
  let inv_dx = params.grid.y;
  let dt = params.grid.z;

  let base = vec3<i32>(floor(xp * inv_dx - vec3<f32>(0.5)));
  let fx = xp * inv_dx - vec3<f32>(base);
  let w0 = 0.5 * (vec3<f32>(1.5) - fx) * (vec3<f32>(1.5) - fx);
  let w1 = vec3<f32>(0.75) - (fx - vec3<f32>(1.0)) * (fx - vec3<f32>(1.0));
  let w2 = 0.5 * (fx - vec3<f32>(0.5)) * (fx - vec3<f32>(0.5));
  let wx = array<f32, 3>(w0.x, w1.x, w2.x);
  let wy = array<f32, 3>(w0.y, w1.y, w2.y);
  let wz = array<f32, 3>(w0.z, w1.z, w2.z);

  let nx = i32(params.counts.y);
  let ny = i32(params.counts.z);
  let nz = i32(params.counts.w);

  var new_v = vec3<f32>(0.0);
  var new_C = mat3x3<f32>(vec3<f32>(0.0), vec3<f32>(0.0), vec3<f32>(0.0));

  for (var i = 0; i < 3; i = i + 1) {
    let gx = base.x + i;
    if (gx < 0 || gx >= nx) { continue; }
    for (var j = 0; j < 3; j = j + 1) {
      let gy = base.y + j;
      if (gy < 0 || gy >= ny) { continue; }
      for (var k = 0; k < 3; k = k + 1) {
        let gz = base.z + k;
        if (gz < 0 || gz >= nz) { continue; }
        let weight = wx[i] * wy[j] * wz[k];
        let node = u32((gz * ny + gy) * nx + gx) * 4u;
        let gv = vec3<f32>(
          bitcast<f32>(atomicLoad(&grid_nodes[node + 0u])),
          bitcast<f32>(atomicLoad(&grid_nodes[node + 1u])),
          bitcast<f32>(atomicLoad(&grid_nodes[node + 2u]))
        );
        let dpos = (vec3<f32>(f32(i), f32(j), f32(k)) - fx) * dx;
        new_v = new_v + weight * gv;
        let scale = 4.0 * inv_dx * inv_dx * weight;
        new_C = new_C + mat3x3<f32>(gv * (scale * dpos.x), gv * (scale * dpos.y), gv * (scale * dpos.z));
      }
    }
  }

  let vol0 = mechanics[mb + 19u];
  // Apply exact Archimedes buoyancy impulse when submerged below fluid_surface_y_m
  if (params.material.w > 0.0 && xp.y < params.fluid.x && vol0 > 0.0) {
    let sub = clamp((params.fluid.x - xp.y) * inv_dx, 0.0, 1.0);
    let displaced_mass = params.material.w * vol0 * sub;
    // Buoyant force = -displaced_mass * gravity
    new_v = new_v - dt * (displaced_mass / mass) * params.gravity.xyz;
  }

  let F_old = mat3x3<f32>(
    vec3<f32>(mechanics[mb + 0u], mechanics[mb + 3u], mechanics[mb + 6u]),
    vec3<f32>(mechanics[mb + 1u], mechanics[mb + 4u], mechanics[mb + 7u]),
    vec3<f32>(mechanics[mb + 2u], mechanics[mb + 5u], mechanics[mb + 8u])
  );
  let I3 = mat3x3<f32>(vec3<f32>(1.0,0.0,0.0), vec3<f32>(0.0,1.0,0.0), vec3<f32>(0.0,0.0,1.0));
  var F_trial = (I3 + dt * new_C) * F_old;

  // von Mises / Corotational Symmetric-Stretch Return Mapping above yield_stress_pa:
  let yield_pa = params.material.z;
  let mu = params.material.x;
  let lam = params.material.y;
  if (yield_pa > 0.0 && yield_pa < 1.0e20 && mu > 0.0) {
    let R_tr = polar_rotation(F_trial);
    // Symmetric right stretch S = R^T * F_trial; elastic strain e = S - I
    let S_tr = transpose(R_tr) * F_trial;
    let tr_e = (S_tr[0][0] - 1.0) + (S_tr[1][1] - 1.0) + (S_tr[2][2] - 1.0);
    let mean_e = tr_e / 3.0;
    let dev_S = S_tr - mat3x3<f32>(
      vec3<f32>(1.0 + mean_e, 0.0, 0.0),
      vec3<f32>(0.0, 1.0 + mean_e, 0.0),
      vec3<f32>(0.0, 0.0, 1.0 + mean_e)
    );
    let dev_norm_sq = dot(dev_S[0], dev_S[0]) + dot(dev_S[1], dev_S[1]) + dot(dev_S[2], dev_S[2]);
    let dev_norm = sqrt(max(dev_norm_sq, 0.0));
    let tau_eq = sqrt(1.5) * 2.0 * mu * dev_norm;
    if (tau_eq > yield_pa && dev_norm > 1.0e-12) {
      let gamma = yield_pa / tau_eq;
      let S_returned = mat3x3<f32>(
        vec3<f32>(1.0 + mean_e, 0.0, 0.0),
        vec3<f32>(0.0, 1.0 + mean_e, 0.0),
        vec3<f32>(0.0, 0.0, 1.0 + mean_e)
      ) + gamma * dev_S;
      let dW_plastic = mu * (dev_norm_sq * (1.0 - gamma * gamma)) * vol0;
      u_spec = u_spec + max(0.0, dW_plastic) / mass;
      F_trial = R_tr * S_returned;
    }
  }

  xp = xp + dt * new_v;
  let J_new = clamp(mat3_det(F_trial), 0.1, 10.0);

  state[sb + 0u] = xp.x;
  state[sb + 1u] = xp.y;
  state[sb + 2u] = xp.z;
  state[sb + 4u] = new_v.x;
  state[sb + 5u] = new_v.y;
  state[sb + 6u] = new_v.z;
  state[sb + 7u] = u_spec;

  // Store row-major F00..F22 and C00..C22 matching MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT
  mechanics[mb + 0u] = F_trial[0].x; mechanics[mb + 1u] = F_trial[1].x; mechanics[mb + 2u] = F_trial[2].x;
  mechanics[mb + 3u] = F_trial[0].y; mechanics[mb + 4u] = F_trial[1].y; mechanics[mb + 5u] = F_trial[2].y;
  mechanics[mb + 6u] = F_trial[0].z; mechanics[mb + 7u] = F_trial[1].z; mechanics[mb + 8u] = F_trial[2].z;

  mechanics[mb + 9u]  = new_C[0].x; mechanics[mb + 10u] = new_C[1].x; mechanics[mb + 11u] = new_C[2].x;
  mechanics[mb + 12u] = new_C[0].y; mechanics[mb + 13u] = new_C[1].y; mechanics[mb + 14u] = new_C[2].y;
  mechanics[mb + 15u] = new_C[0].z; mechanics[mb + 16u] = new_C[1].z; mechanics[mb + 17u] = new_C[2].z;
  mechanics[mb + 18u] = J_new;
}
`;

export function createSchroederElastoPlasticMpmStage({
  device,
  particleCount,
  gridDims = [48, 48, 48],
  dxM = 0.025,
  gravity = [0, -9.81, 0],
  friction = 0.4,
  shearModulusPa = 4.0e4,
  bulkLambdaPa = 8.0e4,
  yieldStressPa = 1.0e30,
  fluidDensityKgPerM3 = 0,
  fluidSurfaceYM = 0,
  fluidDragPerS = 4.0
}) {
  const bindings = [
    computeBufferBinding(0, 'uniform'),
    computeBufferBinding(1, 'storage'),
    computeBufferBinding(2, 'storage'),
    computeBufferBinding(3, 'storage')
  ];
  const pipelines = Object.fromEntries(
    ['clear_grid', 'p2g', 'update_grid', 'g2p'].map((entryPoint) => [
      entryPoint,
      createCachedExplicitComputePipeline(device, {
        cacheKey: `ulg-sol4-mpm-${entryPoint}.v1`,
        label: `ulg-sol4-mpm-${entryPoint}`,
        code: schroederElastoPlasticMpmWgsl,
        entryPoint,
        bindings
      })
    ])
  );
  const [nx, ny, nz] = gridDims.map(Number);
  const nodeWords = nx * ny * nz * 4;
  const gridBuffer = device.createBuffer({
    label: 'ulg-sol4-mpm-grid',
    size: nodeWords * 4,
    usage: GPU_BUFFER_USAGE.STORAGE
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-sol4-mpm-params',
    size: 80,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const raw = new ArrayBuffer(80);
  const u = new Uint32Array(raw);
  const f = new Float32Array(raw);
  u.set([particleCount, nx, ny, nz], 0);
  f.set([dxM, 1.0 / dxM, 0, friction], 4);
  f.set([gravity[0], gravity[1], gravity[2], 2.0], 8);
  f.set([shearModulusPa, bulkLambdaPa, yieldStressPa, fluidDensityKgPerM3], 12);
  f.set([fluidSurfaceYM, fluidDragPerS, 1000.0, 0], 16);
  const bindGroups = new Map();

  return Object.freeze({
    encode(encoder, dtSeconds, { stateBuffer, mechanicsBuffer, substeps = 1 }) {
      f[6] = dtSeconds;
      device.queue.writeBuffer(paramsBuffer, 0, raw);
      let group = null;
      for (const [k, g] of bindGroups) {
        if (k[0] === stateBuffer && k[1] === mechanicsBuffer) group = g;
      }
      if (!group) {
        group = device.createBindGroup({
          layout: pipelines.p2g.bindGroupLayout,
          entries: [paramsBuffer, stateBuffer, mechanicsBuffer, gridBuffer].map((buffer, binding) => ({
            binding,
            resource: { buffer }
          }))
        });
        if (bindGroups.size > 4) bindGroups.clear();
        bindGroups.set([stateBuffer, mechanicsBuffer], group);
      }
      const pass = encoder.beginComputePass({ label: 'ulg-sol4-elasto-plastic-mpm' });
      pass.setBindGroup(0, group);
      const clearGroups = Math.ceil(nodeWords / 128);
      const gridGroups = Math.ceil((nx * ny * nz) / 128);
      const pGroups = Math.ceil(particleCount / 64);
      for (let s = 0; s < substeps; s += 1) {
        pass.setPipeline(pipelines.clear_grid.pipeline);
        pass.dispatchWorkgroups(clearGroups);
        pass.setPipeline(pipelines.p2g.pipeline);
        pass.dispatchWorkgroups(pGroups);
        pass.setPipeline(pipelines.update_grid.pipeline);
        pass.dispatchWorkgroups(gridGroups);
        pass.setPipeline(pipelines.g2p.pipeline);
        pass.dispatchWorkgroups(pGroups);
      }
      pass.end();
    },
    destroy() {
      gridBuffer.destroy();
      paramsBuffer.destroy();
    }
  });
}
