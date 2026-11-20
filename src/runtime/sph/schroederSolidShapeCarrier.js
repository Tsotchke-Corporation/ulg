// G3 SOL-1 shape carrier (plan/todo/g3-solids-proposal.md, Phase 2):
// peercompute.ulg.schroeder-solid-shape-carrier.v0 for a voxel-lattice body.
//
// The rest mesh is the body's own voxel shape: every member is a cube of the
// lattice pitch, and every cube face without a neighbouring member is emitted
// as two triangles, in the body (principal) frame. The lattice axes in that
// frame are R^T e_k (R: body -> world at seed time). Vertices are 8 floats:
// position xyz, 0, normal xyz, 0. The draw reads the body pose straight from
// the resident frame buffer in the vertex shader, so the visible surface
// moves with the integrated frame without any CPU readback, and without
// density-field rounding or particle-lattice faceting.
export const SCHROEDER_SOLID_SHAPE_SCHEMA = 'peercompute.ulg.schroeder-solid-shape-carrier.v0';
export const SCHROEDER_SOLID_SHAPE_VERTEX_FLOATS = 8;

function rotateInverse([x, y, z, w], v) {
  const qx = -x, qy = -y, qz = -z;
  const t = [2 * (qy * v[2] - qz * v[1]), 2 * (qz * v[0] - qx * v[2]), 2 * (qx * v[1] - qy * v[0])];
  return [v[0] + w * t[0] + (qy * t[2] - qz * t[1]), v[1] + w * t[1] + (qz * t[0] - qx * t[2]), v[2] + w * t[2] + (qx * t[1] - qy * t[0])];
}

/**
 * Exposed-face voxel mesh of a lattice body seed: members on a lattice with
 * `pitchM` (a number, or per world axis [x, y, z]) along the seed-time world
 * axes.
 */
export function buildSchroederSolidVoxelShape(seed, { pitchM } = {}) {
  const pitch = Array.isArray(pitchM) ? pitchM.map(Number) : [pitchM, pitchM, pitchM].map(Number);
  if (!pitch.every(v => v > 0) || !seed?.members?.length) throw new TypeError('A voxel shape needs a seed and a lattice pitch');
  const axes = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map(e => rotateInverse(seed.quaternion, e));
  // Integer lattice coordinates of each member along the lattice axes.
  const origin = seed.members[0].rest;
  const keyOf = rest => axes.map((a, k) => Math.round(((rest[0] - origin[0]) * a[0] + (rest[1] - origin[1]) * a[1]
    + (rest[2] - origin[2]) * a[2]) / pitch[k]));
  const cells = seed.members.map(member => keyOf(member.rest));
  const occupied = new Set(cells.map(c => c.join(',')));
  const vertices = [];
  const half = pitch.map(v => 0.5 * v);
  seed.members.forEach((member, index) => {
    const c = cells[index];
    for (let k = 0; k < 3; k++) for (const sign of [-1, 1]) {
      const neighbour = [...c]; neighbour[k] += sign;
      if (occupied.has(neighbour.join(','))) continue;
      const n = axes[k].map(v => sign * v);
      const ku = (k + 1) % 3, kv = (k + 2) % 3, u = axes[ku], v = axes[kv];
      const centre = member.rest.map((x, i) => x + half[k] * n[i]);
      const corner = (su, sv) => centre.map((x, i) => x + half[ku] * su * u[i] + half[kv] * sv * v[i]);
      // Counter-clockwise seen from outside (along +n).
      let quad = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)];
      const e1 = quad[1].map((x, i) => x - quad[0][i]), e2 = quad[2].map((x, i) => x - quad[0][i]);
      const cross = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      if (cross[0] * n[0] + cross[1] * n[1] + cross[2] * n[2] < 0) quad = [quad[0], quad[3], quad[2], quad[1]];
      for (const corner3 of [quad[0], quad[1], quad[2], quad[0], quad[2], quad[3]]) vertices.push(...corner3, 0, ...n, 0);
    }
  });
  return Object.freeze({ schema: SCHROEDER_SOLID_SHAPE_SCHEMA, bodyId: seed.bodyId, pitchM: pitch,
    vertexCount: vertices.length / SCHROEDER_SOLID_SHAPE_VERTEX_FLOATS, vertices: new Float32Array(vertices) });
}

export const schroederSolidShapeRenderWgsl = /* wgsl */ `
struct ShapeUniforms {
  view_projection: mat4x4<f32>,
  // body index (u32 bits), unused...
  body: vec4<u32>,
  // base colour rgb, alpha
  color: vec4<f32>,
  // light direction xyz (world, towards the light), ambient
  light: vec4<f32>,
};
@group(0) @binding(0) var<uniform> uniforms: ShapeUniforms;
@group(0) @binding(1) var<storage, read> frames: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> vertices: array<vec4<f32>>;

fn quat_rotate(q: vec4<f32>, v: vec3<f32>) -> vec3<f32> {
  let t = 2.0 * cross(q.xyz, v);
  return v + q.w * t + cross(q.xyz, t);
}

struct VertexOut {
  @builtin(position) clip: vec4<f32>,
  @location(0) normal: vec3<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) index: u32) -> VertexOut {
  let base = uniforms.body.x * 8u;
  let centre = frames[base].xyz; let q = frames[base + 1u];
  let rest = vertices[index * 2u].xyz; let n = vertices[index * 2u + 1u].xyz;
  var out: VertexOut;
  out.clip = uniforms.view_projection * vec4<f32>(centre + quat_rotate(q, rest), 1.0);
  out.normal = quat_rotate(q, n);
  return out;
}

@fragment
fn fs_main(in: VertexOut) -> @location(0) vec4<f32> {
  let diffuse = max(dot(normalize(in.normal), normalize(uniforms.light.xyz)), 0.0);
  let shade = uniforms.light.w + (1.0 - uniforms.light.w) * diffuse;
  return vec4<f32>(uniforms.color.rgb * shade, uniforms.color.a);
}
`;

/**
 * Renderer for voxel shape carriers. `draw` binds the resident frame buffer
 * directly; the caller owns the pass (colour + depth attachments matching
 * `colorFormat`/`depthFormat`).
 */
export function createSchroederSolidShapeRenderer(device, { colorFormat = 'rgba8unorm', depthFormat = 'depth24plus' } = {}) {
  const module = device.createShaderModule({ label: 'ulg-solid-shape-render', code: schroederSolidShapeRenderWgsl });
  const pipeline = device.createRenderPipeline({ label: 'ulg-solid-shape-render', layout: 'auto',
    vertex: { module, entryPoint: 'vs_main' },
    fragment: { module, entryPoint: 'fs_main', targets: [{ format: colorFormat }] },
    primitive: { topology: 'triangle-list', cullMode: 'back', frontFace: 'ccw' },
    depthStencil: depthFormat ? { format: depthFormat, depthWriteEnabled: true, depthCompare: 'less' } : undefined });
  const shapes = new Map();
  return Object.freeze({
    /** Upload a shape once; returns a handle. */
    addShape(shape, { bodyIndex, colorLinear = [0.75, 0.85, 0.95], alpha = 1, ambient = 0.35,
      lightDirection = [0.3, 0.8, 0.5] } = {}) {
      const vertexBuffer = device.createBuffer({ label: 'ulg-solid-shape-vertices', size: shape.vertices.byteLength,
        usage: 0x80 | 0x08 });
      device.queue.writeBuffer(vertexBuffer, 0, shape.vertices);
      const uniformBuffer = device.createBuffer({ label: 'ulg-solid-shape-uniforms', size: 112, usage: 0x40 | 0x08 });
      const handle = { shape, vertexBuffer, uniformBuffer, bodyIndex, colorLinear, alpha, ambient, lightDirection,
        bindGroups: new WeakMap() };
      shapes.set(handle, true);
      return handle;
    },
    /** Encode the draw of one shape with the body pose read from `frameBuffer` on the GPU. */
    draw(pass, handle, { viewProjection, frameBuffer }) {
      const words = new ArrayBuffer(112), f = new Float32Array(words), u = new Uint32Array(words);
      f.set(viewProjection, 0); u.set([handle.bodyIndex, 0, 0, 0], 16);
      f.set([...handle.colorLinear, handle.alpha], 20); f.set([...handle.lightDirection, handle.ambient], 24);
      device.queue.writeBuffer(handle.uniformBuffer, 0, words);
      let bindGroup = handle.bindGroups.get(frameBuffer);
      if (!bindGroup) {
        bindGroup = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [
          { binding: 0, resource: { buffer: handle.uniformBuffer } }, { binding: 1, resource: { buffer: frameBuffer } },
          { binding: 2, resource: { buffer: handle.vertexBuffer } }] });
        handle.bindGroups.set(frameBuffer, bindGroup);
      }
      pass.setPipeline(pipeline); pass.setBindGroup(0, bindGroup);
      pass.draw(handle.shape.vertexCount);
    },
    removeShape(handle) {
      if (!shapes.delete(handle)) return;
      handle.vertexBuffer.destroy(); handle.uniformBuffer.destroy();
    }
  });
}

// G3 Phase 4c: the member-driven shape carrier. The same exposed-face voxel
// surface, emitted on the GPU from the members themselves: vertex v belongs
// to member v / 36, face (v % 36) / 6 (+x, -x, +y, -y, +z, -z); a face is drawn
// when its member is alive (mass > 0) and the neighbour across it is not.
// Melted members vanish and newly exposed faces appear with no mesh rebuild;
// the pose comes from the resident frame buffer and the lattice axes rebase
// with the body (schroederSolidRigidGpu rebase_commit).
export const schroederSolidMemberShapeRenderWgsl = /* wgsl */ `
struct ShapeUniforms {
  view_projection: mat4x4<f32>,
  // unused, member count, unused, unused
  body: vec4<u32>,
  color: vec4<f32>,
  light: vec4<f32>,
};
@group(0) @binding(0) var<uniform> uniforms: ShapeUniforms;
@group(0) @binding(1) var<storage, read> frames: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> members: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> neighbors: array<vec4<u32>>;
@group(0) @binding(4) var<storage, read> lattice: array<vec4<f32>>;

fn quat_rotate(q: vec4<f32>, v: vec3<f32>) -> vec3<f32> {
  let t = 2.0 * cross(q.xyz, v);
  return v + q.w * t + cross(q.xyz, t);
}
struct VertexOut {
  @builtin(position) clip: vec4<f32>,
  @location(0) normal: vec3<f32>,
};

@vertex
fn vs_member(@builtin(vertex_index) index: u32) -> VertexOut {
  var out: VertexOut;
  out.clip = vec4<f32>(2.0, 2.0, 2.0, 1.0);
  out.normal = vec3<f32>(0.0, 1.0, 0.0);
  let member = index / 36u; let local = index % 36u; let face = local / 6u; let corner = local % 6u;
  if (member >= uniforms.body.y) { return out; }
  let m0 = members[member * 2u];
  if (!(m0.w > 0.0)) { return out; }
  let row = neighbors[member * 2u + face / 4u];
  let other = row[face % 4u];
  if (other != 0xffffffffu && members[other * 2u].w > 0.0) { return out; }
  let body = bitcast<u32>(members[member * 2u + 1u].x);
  let axes = array<vec3<f32>, 3>(lattice[body * 4u].xyz, lattice[body * 4u + 1u].xyz, lattice[body * 4u + 2u].xyz);
  let half = 0.5 * lattice[body * 4u + 3u].xyz;
  let axis = face / 2u; let ku = (axis + 1u) % 3u; let kv = (axis + 2u) % 3u;
  let positive = face % 2u == 0u;
  let n = select(-1.0, 1.0, positive) * axes[axis];
  // Two triangles; counter-clockwise seen from outside.
  var su = array<f32, 6>(-1.0, 1.0, 1.0, -1.0, 1.0, -1.0);
  var sv = array<f32, 6>(-1.0, -1.0, 1.0, -1.0, 1.0, 1.0);
  if (!positive) {
    su = array<f32, 6>(-1.0, -1.0, 1.0, -1.0, 1.0, 1.0);
    sv = array<f32, 6>(-1.0, 1.0, 1.0, -1.0, 1.0, -1.0);
  }
  let rest = m0.xyz + half[axis] * n + half[ku] * su[corner] * axes[ku] + half[kv] * sv[corner] * axes[kv];
  let base = body * 8u;
  let q = frames[base + 1u];
  out.clip = uniforms.view_projection * vec4<f32>(frames[base].xyz + quat_rotate(q, rest), 1.0);
  out.normal = quat_rotate(q, n);
  return out;
}

@fragment
fn fs_member(in: VertexOut) -> @location(0) vec4<f32> {
  let diffuse = max(dot(normalize(in.normal), normalize(uniforms.light.xyz)), 0.0);
  let shade = uniforms.light.w + (1.0 - uniforms.light.w) * diffuse;
  return vec4<f32>(uniforms.color.rgb * shade, uniforms.color.a);
}
`;

/** Renderer for member-driven voxel shapes (one draw per family). */
export function createSchroederSolidMemberShapeRenderer(device, { colorFormat = 'rgba8unorm', depthFormat = 'depth24plus' } = {}) {
  const module = device.createShaderModule({ label: 'ulg-solid-member-shape', code: schroederSolidMemberShapeRenderWgsl });
  const pipeline = device.createRenderPipeline({ label: 'ulg-solid-member-shape', layout: 'auto',
    vertex: { module, entryPoint: 'vs_member' },
    fragment: { module, entryPoint: 'fs_member', targets: [{ format: colorFormat }] },
    primitive: { topology: 'triangle-list', cullMode: 'back', frontFace: 'ccw' },
    depthStencil: depthFormat ? { format: depthFormat, depthWriteEnabled: true, depthCompare: 'less' } : undefined });
  const uniformBuffer = device.createBuffer({ label: 'ulg-solid-member-shape-uniforms', size: 112, usage: 0x40 | 0x08 });
  const groups = new WeakMap();
  return Object.freeze({
    draw(pass, family, { viewProjection, colorLinear = [0.78, 0.9, 0.98], ambient = 0.35, lightDirection = [0.3, 0.8, 0.5] }) {
      const words = new ArrayBuffer(112), f = new Float32Array(words), u = new Uint32Array(words);
      f.set(viewProjection, 0); u.set([0, family.memberCount, 0, 0], 16);
      f.set([...colorLinear, 1], 20); f.set([...lightDirection, ambient], 24);
      device.queue.writeBuffer(uniformBuffer, 0, words);
      let group = groups.get(family);
      if (!group) {
        group = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [
          { binding: 0, resource: { buffer: uniformBuffer } }, { binding: 1, resource: { buffer: family.frameBuffer } },
          { binding: 2, resource: { buffer: family.memberBuffer } }, { binding: 3, resource: { buffer: family.neighborBuffer } },
          { binding: 4, resource: { buffer: family.latticeBuffer } }] });
        groups.set(family, group);
      }
      pass.setPipeline(pipeline); pass.setBindGroup(0, group);
      pass.draw(family.memberCount * 36);
    }
  });
}
