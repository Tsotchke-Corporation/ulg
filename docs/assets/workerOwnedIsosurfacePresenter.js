import{vn as e,yn as t}from"./eshkolTriadClosures-2aA1ll1H.js";import{Eo as n,G as r,N as i,So as a,Yc as o,_c as s,bo as c,c as l,gc as u,qc as d,sl as f,vc as p,wc as m,xc as h}from"./sphGpuBuffers-C0RtBOv4.js";import{acquireQueueOrderedPooledBuffer as g,computeBufferBinding as _,createCachedExplicitComputePipeline as v,deferSubmittedWorkCleanup as y,registerQueueOrderedPooledBufferReturn as b,releaseOrDestroyQueueOrderedPooledBuffer as x}from"../runtime/webgpuComputeLayout.js";import{E as S,L as C,M as w,R as T,a as E,b as D,d as ee,f as te,i as ne,l as re,m as O,o as ie,r as ae,u as k,v as oe,y as se}from"./nativeSurfaceTemperatureWgsl-riJB_itF.js";import{s as ce}from"./sphGpuDeviceIdentity-CxQWvfZe.js";import{ULG_WORKER_PRESENTATION_FRAME_QUEUE_COMPLETION_SCOPE as le,ULG_WORKER_PRESENTATION_PHYSICS_PREFIX_INCLUDED as ue,ULG_WORKER_PRESENTATION_PHYSICS_PREFIX_NOT_ATTRIBUTED as de}from"../runtime/sph/sphWorkerPresentationQos.js";import{createIsosurfaceMotionPacing as fe,createPresentationPauseClock as A,isosurfaceMotionAge as j,resumeIsosurfaceMotionPacing as pe,slowIsosurfaceMotionPacing as me,snapshotIsosurfaceSourceTimingBootstrap as he}from"./workerOwnedIsosurfaceMotion.js";var ge=`
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
`;function _e(e,{colorFormat:t=`rgba8unorm`,depthFormat:n=`depth24plus`}={}){let r=e.createShaderModule({label:`ulg-solid-member-shape`,code:ge}),i=e.createRenderPipeline({label:`ulg-solid-member-shape`,layout:`auto`,vertex:{module:r,entryPoint:`vs_member`},fragment:{module:r,entryPoint:`fs_member`,targets:[{format:t}]},primitive:{topology:`triangle-list`,cullMode:`back`,frontFace:`ccw`},depthStencil:n?{format:n,depthWriteEnabled:!0,depthCompare:`less`}:void 0}),a=e.createBuffer({label:`ulg-solid-member-shape-uniforms`,size:112,usage:72}),o=new WeakMap;return Object.freeze({draw(t,n,{viewProjection:r,colorLinear:s=[.78,.9,.98],ambient:c=.35,lightDirection:l=[.3,.8,.5]}){let u=new ArrayBuffer(112),d=new Float32Array(u),f=new Uint32Array(u);d.set(r,0),f.set([0,n.memberCount,0,0],16),d.set([...s,1],20),d.set([...l,c],24),e.queue.writeBuffer(a,0,u);let p=o.get(n);p||(p=e.createBindGroup({layout:i.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:a}},{binding:1,resource:{buffer:n.frameBuffer}},{binding:2,resource:{buffer:n.memberBuffer}},{binding:3,resource:{buffer:n.neighborBuffer}},{binding:4,resource:{buffer:n.latticeBuffer}}]}),o.set(n,p)),t.setPipeline(i),t.setBindGroup(0,p),t.draw(n.memberCount*36)}})}var ve=Object.freeze({wavelengthM:55e-8,refractiveIndex:1.333,asymmetry:.85}),ye=Object.freeze({STORAGE:128,UNIFORM:64,COPY_DST:8}),M=`
struct OpticsParams {
  // parcel_count, resolution, field_offset, unused
  counts: vec4<u32>,
  // field padding, reference edge (m), wavelength (m), refractive index
  map: vec4<f32>,
  // asymmetry, gas-cell size (m), unused...
  optics: vec4<f32>,
};
@group(0) @binding(0) var<uniform> params: OpticsParams;
@group(0) @binding(1) var<storage, read> parcels: array<f32>;
@group(0) @binding(2) var<storage, read_write> field_rows: array<f32>;
const PI: f32 = 3.14159265358979;
const PARAM_FLOATS: u32 = 8u;
const CELL_FLOATS: u32 = 8u;

// Normalized tent of half-width h: integrates to one along the axis.
fn tent(distance: f32, h: f32) -> f32 {
  return max(0.0, 1.0 - abs(distance) / h) / h;
}
fn extinction_efficiency(radius_m: f32) -> f32 {
  let size = 2.0 * PI * radius_m / params.map.z;
  let rho = 2.0 * size * (params.map.w - 1.0);
  if (rho < 1.0e-2) { return 0.5 * rho * rho; }
  return 2.0 - 4.0 / rho * sin(rho) + 4.0 / (rho * rho) * (1.0 - cos(rho));
}

@compute @workgroup_size(64)
fn add_parcel_optics(@builtin(global_invocation_id) id: vec3<u32>) {
  let resolution = params.counts.y;
  let cell = id.x;
  if (cell >= resolution * resolution * resolution) { return; }
  let xy = resolution * resolution;
  let z = cell / xy; let rem = cell - z * xy; let y = rem / resolution; let x = rem - y * resolution;
  let padding = params.map.x; let span = 1.0 - 2.0 * padding;
  let ref_edge = params.map.y;
  let render_edge = ref_edge / (span * f32(resolution));
  let h = params.optics.y;
  // World position of this render cell's node: the inverse of the gather map
  // p = padding + (pos / ref_edge) * span with node i at p = i / resolution.
  let node = (vec3<f32>(f32(x), f32(y), f32(z)) / f32(resolution) - vec3<f32>(padding)) * (ref_edge / span);
  var scattering = 0.0;
  var weighted_temperature = 0.0;
  for (var p = 0u; p < params.counts.x; p++) {
    let base = p * PARAM_FLOATS;
    let radius = parcels[base + 7u];
    let count = parcels[base + 3u];
    if (!(radius > 0.0) || !(count > 0.0)) { continue; }
    let d = node - vec3<f32>(parcels[base], parcels[base + 1u], parcels[base + 2u]);
    let density = tent(d.x, h) * tent(d.y, h) * tent(d.z, h);
    if (density <= 0.0) { continue; }
    // Extinction coefficient (1/m) times the render cell edge.
    let cross_section = count * PI * radius * radius * extinction_efficiency(radius);
    let tau = (cross_section * density) * render_edge;
    scattering += tau;
    weighted_temperature += parcels[base + 6u] * tau;
  }
  if (!(scattering > 0.0)) { return; }
  let row = (params.counts.z + cell) * CELL_FLOATS;
  // Lane 1 is (T, tau_s, tau_a, tau_g); T is extinction-weighted like the
  // gather's dispersed temperature, so the medium's emission stays consistent.
  let prior_extinction = max(field_rows[row + 5u], 0.0) + max(field_rows[row + 6u], 0.0);
  field_rows[row + 4u] = (field_rows[row + 4u] * prior_extinction + weighted_temperature)
    / (prior_extinction + scattering);
  field_rows[row + 5u] = field_rows[row + 5u] + scattering;
  field_rows[row + 7u] = field_rows[row + 7u] + params.optics.x * scattering;
}
`;function be({device:e,encoder:t,parcels:n,fieldRowsBuffer:r,fieldOffset:i,resolution:a,fieldPadding:o,refEdgeM:s}={}){if(!n?.count||!r||!(a>0)||!(s>0))return null;let c=n.boxDimensionsM[0]/n.cellsPerAxis;if(!(c>0))throw TypeError(`Ledger parcel optics require the parcel gas-cell size`);let l=v(e,{cacheKey:`ulg-ledger-parcel-optics.v1`,label:`ulg-ledger-parcel-optics`,code:M,entryPoint:`add_parcel_optics`,bindings:[`uniform`,`read-only-storage`,`storage`].map((e,t)=>_(t,e))}),u=e.createBuffer({label:`ulg-ledger-parcel-optics-params`,size:48,usage:ye.UNIFORM|ye.COPY_DST}),d=new ArrayBuffer(48),f=new Uint32Array(d),p=new Float32Array(d);f.set([n.count,a,i,0],0),p.set([o,s,ve.wavelengthM,ve.refractiveIndex],4),p.set([ve.asymmetry,c,0,0],8),e.queue.writeBuffer(u,0,d);let m=e.createBindGroup({layout:l.bindGroupLayout,entries:[u,n.paramsBuffer,r].map((e,t)=>({binding:t,resource:{buffer:e}}))}),h=t.beginComputePass({label:`ulg-ledger-parcel-optics`});return h.setPipeline(l.pipeline),h.setBindGroup(0,m),h.dispatchWorkgroups(Math.ceil(a**3/64)),h.end(),u}var N=`peercompute.ulg.sph-participating-medium-descriptor.v0`,P=`peercompute.ulg.sph-participating-medium-gpu.v0`,xe=`peercompute.ulg.sph-participating-medium-packed-frame.v0`,F=Object.freeze({ready:`participating-medium-ready`,empty:`participating-medium-empty`,blocked:`participating-medium-blocked`}),Se=`participating-medium-packed-gpu-resident`,I=`rgba16float`,L=65504,R=Object.freeze({COPY_DST:globalThis.GPUBufferUsage?.COPY_DST??8,UNIFORM:globalThis.GPUBufferUsage?.UNIFORM??64,STORAGE:globalThis.GPUBufferUsage?.STORAGE??128,INDIRECT:globalThis.GPUBufferUsage?.INDIRECT??256}),Ce=Object.freeze({TEXTURE_BINDING:globalThis.GPUTextureUsage?.TEXTURE_BINDING??4,STORAGE_BINDING:globalThis.GPUTextureUsage?.STORAGE_BINDING??8}),z=8*Uint32Array.BYTES_PER_ELEMENT,B=8*Uint32Array.BYTES_PER_ELEMENT,we=40,Te=we*Float32Array.BYTES_PER_ELEMENT,Ee=80,De=1e-6,V=40,Oe=8,ke=128,Ae=new WeakMap,je=new WeakMap,Me=new WeakMap,Ne=`
struct PackParams {
  resolution: u32,
  route_count: u32,
  field_row_stride_vec4: u32,
  reserved0: u32,
  max_optical_depth: f32,
  activity_epsilon: f32,
  reserved1: vec2<f32>,
};

struct RouteRow {
  identity: vec4<u32>,
  scattering_color: vec4<f32>,
};

@group(0) @binding(0) var<storage, read> field_rows: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> route_rows: array<RouteRow>;
@group(0) @binding(2) var<uniform> params: PackParams;
@group(0) @binding(3) var optical_volume: texture_storage_3d<rgba16float, write>;
@group(0) @binding(4) var scattering_volume: texture_storage_3d<rgba16float, write>;
@group(0) @binding(5) var<storage, read_write> draw_indirect: array<atomic<u32>>;

const HALF_FLOAT_MAX: f32 = 65504.0;
const F32_FINITE_MAX: f32 = 3.402823e38;

fn finite_nonnegative(value: f32, ceiling: f32) -> f32 {
  let finite = value == value && abs(value) <= F32_FINITE_MAX;
  return select(0.0, min(value, ceiling), finite && value > 0.0);
}

fn finite_signed(value: f32, ceiling: f32) -> f32 {
  // Equality with itself is the portable WGSL NaN test. Apply it before the
  // signed clamp so a poisoned asymmetry moment cannot survive the clamp.
  let finite = value == value && abs(value) <= F32_FINITE_MAX;
  let sanitized = select(0.0, value, finite);
  return clamp(sanitized, -ceiling, ceiling);
}

@compute @workgroup_size(4, 4, 4)
fn pack_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (any(global_id >= vec3<u32>(params.resolution))) {
    return;
  }
  if (all(global_id == vec3<u32>(0u))) {
    atomicStore(&draw_indirect[1], 1u);
  }

  let xy_count = params.resolution * params.resolution;
  let cell_index = global_id.x
    + global_id.y * params.resolution
    + global_id.z * xy_count;
  // First find one common physical scale. Clamping individual components
  // before summing changes albedo and asymmetry in optically thick cells.
  // Normalizing every component by the same maximum keeps all ratios intact
  // and avoids overflowing the aggregate before the presentation cap.
  var common_scale = 0.0;
  for (var route_index = 0u; route_index < params.route_count; route_index += 1u) {
    let route = route_rows[route_index];
    let row_index = (route.identity.x + cell_index) * params.field_row_stride_vec4;
    let moments = field_rows[row_index + 1u];
    let route_scattering = finite_nonnegative(moments.y, F32_FINITE_MAX);
    let route_absorption = finite_nonnegative(moments.z, F32_FINITE_MAX);
    common_scale = max(common_scale, max(route_scattering, route_absorption));
  }

  var normalized_scattering = 0.0;
  var normalized_absorption = 0.0;
  var normalized_asymmetry = 0.0;
  var normalized_weighted_temperature = 0.0;
  var normalized_scattering_color = vec3<f32>(0.0);
  if (common_scale > 0.0) {
    for (var route_index = 0u; route_index < params.route_count; route_index += 1u) {
      let route = route_rows[route_index];
      let row_index = (route.identity.x + cell_index) * params.field_row_stride_vec4;
      let moments = field_rows[row_index + 1u];
      let route_scattering = finite_nonnegative(moments.y, F32_FINITE_MAX);
      let route_absorption = finite_nonnegative(moments.z, F32_FINITE_MAX);
      let route_asymmetry = clamp(
        finite_signed(moments.w, F32_FINITE_MAX),
        -0.95 * route_scattering,
        0.95 * route_scattering
      );
      let route_temperature = finite_nonnegative(moments.x, HALF_FLOAT_MAX);
      // Divide directly: 1/common_scale can become a subnormal and flush to
      // zero when the source moment is near the f32 ceiling.
      let scattering_normalized = route_scattering / common_scale;
      let absorption_normalized = route_absorption / common_scale;
      let extinction_normalized = scattering_normalized + absorption_normalized;
      normalized_scattering += scattering_normalized;
      normalized_absorption += absorption_normalized;
      normalized_asymmetry += route_asymmetry / common_scale;
      normalized_weighted_temperature += route_temperature * extinction_normalized;
      normalized_scattering_color += route.scattering_color.rgb
        * scattering_normalized;
    }
  }

  let normalized_extinction = normalized_scattering + normalized_absorption;
  let storage_optical_cap = min(
    finite_nonnegative(params.max_optical_depth, HALF_FLOAT_MAX),
    HALF_FLOAT_MAX
  );
  var packed_extinction = 0.0;
  if (normalized_extinction > 0.0) {
    packed_extinction = storage_optical_cap;
    // Branch instead of eagerly evaluating common_scale * normalized_extinction
    // when the product would overflow f32.
    if (common_scale <= storage_optical_cap / normalized_extinction) {
      packed_extinction = common_scale * normalized_extinction;
    }
  }
  var output_scale = 0.0;
  if (normalized_extinction > 0.0) {
    output_scale = packed_extinction / normalized_extinction;
  }
  let scattering_depth = min(
    normalized_scattering * output_scale,
    HALF_FLOAT_MAX
  );
  let absorption_depth = min(
    normalized_absorption * output_scale,
    HALF_FLOAT_MAX
  );
  let scattering_asymmetry_depth = clamp(
    normalized_asymmetry * output_scale,
    -HALF_FLOAT_MAX,
    HALF_FLOAT_MAX
  );
  let scattering_color_depth = clamp(
    normalized_scattering_color * output_scale,
    vec3<f32>(0.0),
    vec3<f32>(HALF_FLOAT_MAX)
  );
  var temperature = 0.0;
  if (normalized_extinction > 0.0) {
    temperature = min(
      normalized_weighted_temperature / normalized_extinction,
      HALF_FLOAT_MAX
    );
  }
  if (packed_extinction > params.activity_epsilon) {
    atomicMax(&draw_indirect[0], 3u);
  }
  let coordinate = vec3<i32>(global_id);
  textureStore(
    optical_volume,
    coordinate,
    vec4<f32>(
      scattering_depth,
      absorption_depth,
      scattering_asymmetry_depth,
      temperature
    )
  );
  textureStore(
    scattering_volume,
    coordinate,
    vec4<f32>(scattering_color_depth, 0.0)
  );
}
`,H=`
struct VolumeUniforms {
  inverse_view_projection: mat4x4<f32>,
  camera_step_count: vec4<f32>,
  bounds_min_cell_edge: vec4<f32>,
  bounds_max_ambient: vec4<f32>,
  light_direction_intensity: vec4<f32>,
  viewport_depth_epsilon: vec4<f32>,
  motion_params: vec4<f32>,
};

struct RenderRouteRow {
  identity: vec4<u32>,
  scattering_color: vec4<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: VolumeUniforms;
@group(0) @binding(1) var optical_volume: texture_3d<f32>;
@group(0) @binding(2) var scattering_volume: texture_3d<f32>;
@group(0) @binding(3) var volume_sampler: sampler;
@group(0) @binding(4) var opaque_depth: texture_depth_2d;
@group(0) @binding(5) var<storage, read> motion_rows: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read> route_rows: array<RenderRouteRow>;

const HALF_FLOAT_MAX: f32 = 65504.0;

fn sample_medium_velocity(uvw: vec3<f32>) -> vec3<f32> {
  let age_s = uniforms.motion_params.x;
  let route_count = u32(max(uniforms.motion_params.y, 0.0));
  let resolution = u32(max(uniforms.motion_params.z, 0.0));
  let row_count = u32(max(uniforms.motion_params.w, 0.0));
  if (!(age_s > 0.0) || route_count == 0u || resolution < 2u || row_count == 0u) {
    return vec3<f32>(0.0);
  }
  let available = min(row_count, arrayLength(&motion_rows));
  let route_limit = min(route_count, arrayLength(&route_rows));
  let slab = resolution * resolution;
  let max_idx = resolution - 1u;
  let cell = min(
    vec3<u32>(clamp(uvw * f32(max_idx) + vec3<f32>(0.5), vec3<f32>(0.0), vec3<f32>(f32(max_idx)))),
    vec3<u32>(max_idx)
  );
  let cell_offset = cell.x + resolution * cell.y + slab * cell.z;
  var moment = vec4<f32>(0.0);
  for (var route_index = 0u; route_index < route_limit; route_index += 1u) {
    let field_offset = route_rows[route_index].identity.x;
    if (field_offset >= available) {
      continue;
    }
    let remaining = available - field_offset;
    if (resolution > remaining / resolution || resolution > remaining / slab) {
      continue;
    }
    let row = motion_rows[field_offset + cell_offset];
    if (row.w > 0.0 && row.w == row.w && all(row.xyz == row.xyz)) {
      moment += row;
    }
  }
  if (!(moment.w > 1.0e-8) || moment.w != moment.w || any(moment.xyz != moment.xyz)) {
    return vec3<f32>(0.0);
  }
  let vel = moment.xyz / moment.w;
  if (any(vel != vel) || any(abs(vel) > vec3<f32>(1.0e6))) {
    return vec3<f32>(0.0);
  }
  return vel;
}

fn finite_nonnegative_sample(value: f32) -> f32 {
  let finite = value == value && abs(value) <= HALF_FLOAT_MAX;
  return select(0.0, max(value, 0.0), finite);
}

fn finite_signed_sample(value: f32) -> f32 {
  let finite = value == value && abs(value) <= HALF_FLOAT_MAX;
  return select(0.0, value, finite);
}

fn finite_nonnegative_sample3(value: vec3<f32>) -> vec3<f32> {
  let non_nan = select(vec3<f32>(0.0), value, value == value);
  let finite = abs(non_nan) <= vec3<f32>(HALF_FLOAT_MAX);
  return select(
    vec3<f32>(0.0),
    max(non_nan, vec3<f32>(0.0)),
    finite
  );
}

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
};

@vertex
fn vertex_main(@builtin(vertex_index) vertex_index: u32) -> VertexOutput {
  var output: VertexOutput;
  let x = f32((vertex_index << 1u) & 2u);
  let y = f32(vertex_index & 2u);
  output.position = vec4<f32>(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);
  return output;
}

fn unproject(ndc: vec3<f32>) -> vec3<f32> {
  let homogeneous = uniforms.inverse_view_projection * vec4<f32>(ndc, 1.0);
  let safe_w = select(-1.0e-8, 1.0e-8, homogeneous.w >= 0.0);
  return homogeneous.xyz / select(safe_w, homogeneous.w, abs(homogeneous.w) > 1.0e-8);
}

fn safe_inverse(value: vec3<f32>) -> vec3<f32> {
  let signs = select(vec3<f32>(-1.0), vec3<f32>(1.0), value >= vec3<f32>(0.0));
  return 1.0 / select(signs * vec3<f32>(1.0e-8), value, abs(value) > vec3<f32>(1.0e-8));
}

fn box_interval(origin: vec3<f32>, direction: vec3<f32>) -> vec2<f32> {
  let inverse_direction = safe_inverse(direction);
  let t0 = (uniforms.bounds_min_cell_edge.xyz - origin) * inverse_direction;
  let t1 = (uniforms.bounds_max_ambient.xyz - origin) * inverse_direction;
  let near_axis = min(t0, t1);
  let far_axis = max(t0, t1);
  return vec2<f32>(
    max(max(near_axis.x, near_axis.y), near_axis.z),
    min(min(far_axis.x, far_axis.y), far_axis.z)
  );
}

fn relative_henyey_greenstein(asymmetry: f32, cosine_angle: f32) -> f32 {
  let g = clamp(asymmetry, -0.95, 0.95);
  let denominator = max(1.0 + g * g - 2.0 * g * cosine_angle, 1.0e-5);
  return (1.0 - g * g) / pow(denominator, 1.5);
}

@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4<f32> {
  let viewport = max(uniforms.viewport_depth_epsilon.xy, vec2<f32>(1.0));
  let ndc_xy = vec2<f32>(
    input.position.x * 2.0 / viewport.x - 1.0,
    1.0 - input.position.y * 2.0 / viewport.y
  );
  // The scene view-projection matrix is OpenGL-style. Surface shaders remap
  // clip z into WebGPU's [0, 1] depth range, so reverse that remap before
  // applying the original inverse matrix here.
  let near_world = unproject(vec3<f32>(ndc_xy, -1.0));
  let far_world = unproject(vec3<f32>(ndc_xy, 1.0));
  let ray_direction = normalize(far_world - near_world);
  let interval = box_interval(near_world, ray_direction);
  var ray_start = max(interval.x, 0.0);
  var ray_end = interval.y;
  if (!(ray_end > ray_start)) {
    discard;
  }

  let pixel = vec2<i32>(clamp(
    vec2<f32>(input.position.xy),
    vec2<f32>(0.0),
    viewport - vec2<f32>(1.0)
  ));
  let scene_depth = textureLoad(opaque_depth, pixel, 0);
  if (scene_depth < 1.0 - uniforms.viewport_depth_epsilon.z) {
    let scene_world = unproject(vec3<f32>(ndc_xy, scene_depth * 2.0 - 1.0));
    let scene_distance = dot(scene_world - near_world, ray_direction);
    ray_end = min(ray_end, scene_distance);
  }
  if (!(ray_end > ray_start)) {
    discard;
  }

  let requested_steps = clamp(
    u32(max(uniforms.camera_step_count.w, 1.0)),
    1u,
    128u
  );
  let step_length = (ray_end - ray_start) / f32(requested_steps);
  let cell_edge = max(uniforms.bounds_min_cell_edge.w, 1.0e-8);
  let light_direction = normalize(uniforms.light_direction_intensity.xyz);
  let view_direction = -ray_direction;
  var transmittance = 1.0;
  var radiance = vec3<f32>(0.0);
  for (var step_index = 0u; step_index < 128u; step_index += 1u) {
    if (step_index >= requested_steps || transmittance < 0.00390625) {
      break;
    }
    let distance = ray_start + (f32(step_index) + 0.5) * step_length;
    let world_position = near_world + ray_direction * distance;
    let uvw = clamp(
      (world_position - uniforms.bounds_min_cell_edge.xyz)
        / (uniforms.bounds_max_ambient.xyz - uniforms.bounds_min_cell_edge.xyz),
      vec3<f32>(0.0),
      vec3<f32>(1.0)
    );
    var sample_uvw = uvw;
    if (uniforms.motion_params.x > 0.0 && uniforms.motion_params.w > 0.0) {
      let local_velocity = sample_medium_velocity(uvw);
      let raw_disp = local_velocity * uniforms.motion_params.x;
      let disp_len = length(raw_disp);
      if (disp_len > 1.0e-9) {
        let max_disp = cell_edge * 1.5;
        let adv_disp = raw_disp * (max_disp / (max_disp + disp_len));
        sample_uvw = clamp(
          (world_position - adv_disp - uniforms.bounds_min_cell_edge.xyz)
            / (uniforms.bounds_max_ambient.xyz - uniforms.bounds_min_cell_edge.xyz),
          vec3<f32>(0.0),
          vec3<f32>(1.0)
        );
      }
    }
    let optical = textureSampleLevel(optical_volume, volume_sampler, sample_uvw, 0.0);
    let scattering_color_depth = textureSampleLevel(
      scattering_volume,
      volume_sampler,
      sample_uvw,
      0.0
    ).rgb;
    let distance_scale = step_length / cell_edge;
    let cell_scattering_depth = finite_nonnegative_sample(optical.x);
    let scattering_depth = cell_scattering_depth * distance_scale;
    let absorption_depth = finite_nonnegative_sample(optical.y) * distance_scale;
    let extinction_depth = scattering_depth + absorption_depth;
    if (extinction_depth <= 1.0e-7) {
      continue;
    }
    let segment_transmission = exp(-extinction_depth);
    let segment_opacity = 1.0 - segment_transmission;
    let albedo = scattering_depth / extinction_depth;
    let raw_asymmetry = finite_signed_sample(optical.z)
      / max(cell_scattering_depth, 1.0e-8);
    let defensive_asymmetry = select(
      0.0,
      raw_asymmetry,
      raw_asymmetry == raw_asymmetry && abs(raw_asymmetry) <= HALF_FLOAT_MAX
    );
    let asymmetry = clamp(
      defensive_asymmetry,
      -0.95,
      0.95
    );
    let cos_theta = dot(-light_direction, view_direction);
    let forward_phase = relative_henyey_greenstein(
      asymmetry,
      // light_direction points from the sample toward the light; photons
      // arrive along its negative, which is the propagation direction used
      // by the physical asymmetry convention.
      cos_theta
    );
    let backward_phase = relative_henyey_greenstein(-0.35 * asymmetry, cos_theta);
    let phase = 0.70 * forward_phase + 0.30 * backward_phase + 0.55 * albedo * albedo;
    let scattering_color = finite_nonnegative_sample3(scattering_color_depth)
      / max(cell_scattering_depth, 1.0e-8);
    let source = max(scattering_color, vec3<f32>(0.0))
      * albedo
      * (uniforms.bounds_max_ambient.w
        + uniforms.light_direction_intensity.w * phase);
    radiance += transmittance * segment_opacity * source;
    transmittance *= segment_transmission;
  }
  let alpha = clamp(1.0 - transmittance, 0.0, 1.0);
  if (alpha <= 1.0e-6) {
    discard;
  }
  return vec4<f32>(max(radiance, vec3<f32>(0.0)), alpha);
}
`;function U(e){return typeof e==`object`&&!!e||typeof e==`function`}function Pe(e,t=null){let n=Number(e);return Number.isFinite(n)?n:t}function W(e,t){if(!(Array.isArray(e)||ArrayBuffer.isView(e))||e.length!==t)return null;let n=Array.from(e,Number);return n.every(Number.isFinite)?n:null}function G(e,t,n){let r=W(e,n),i=W(t,n);return!!(r&&i&&r.every((e,t)=>e===i[t]))}function K(e){return Array.isArray(e)&&e.length===t.length&&e.every((e,n)=>e===t[n])}function q(e){let t=Number(e?.descriptor?.surfaceIndex);if(Number.isSafeInteger(t)&&t>=0)return t;let n=Number(e?.metadata?.index);return Number.isSafeInteger(n)&&n>=0?n:null}function Fe(e){return Object.freeze(Array.isArray(e)?e.map(q).filter(e=>e!=null):[])}function Ie(e){let t=e?.metadata;return!!(U(t)&&Number.isSafeInteger(Number(t.opticalStateId))&&Number(t.opticalStateId)===0)}function J(e,t=[],n={}){return Object.freeze({schema:N,ok:!1,status:F.blocked,reason:e,routeCount:0,collectiveSurfaceCount:t.length,consumedSurfaceIndices:Fe(t),readback:!1,fullReadback:!1,...n})}function Le(){return Object.freeze({schema:N,ok:!0,status:F.empty,reason:null,routeCount:0,collectiveSurfaceCount:0,consumedSurfaceIndices:Object.freeze([]),readback:!1,fullReadback:!1})}function Re(e,t){return!!(U(e)&&U(t)&&[`index`,`resolution`,`fieldOffset`,`fieldCellCount`,`opticalStateId`,`collectiveOpticalRoute`,`collectiveOpticalRouteSchema`,`collectiveOpticalRouteKey`,`collectiveOpticalRouteId`,`opticalResponseAuthorityFlag`,`opticalResponseReady`,`opticalVisibilityFlag`,`opticalBlockedFlag`].every(n=>e[n]===t[n])&&G(e.colorLinear,t.colorLinear,3)&&(e.opticalScatteringSourceLinear==null?t.opticalScatteringSourceLinear==null:G(e.opticalScatteringSourceLinear,t.opticalScatteringSourceLinear,3)))}function ze(e){let t=W(e?.opticalScatteringSourceLinear,3),n=W(e?.colorLinear,3),r=t||n;return!r||r.some(e=>e<0)?null:r.map(e=>Math.min(e,1))}function Be(e,n){if(!U(e))return`participating medium requires a GPUDevice`;if(!U(n)||n.schema!==`peercompute.ulg.sph-gpu-render-field.v1`)return`participating medium requires the exact ULG render-field schema`;if(n.backend!==`webgpu`)return`participating medium requires a WebGPU render field`;if(n.fieldRowsBufferRetained!==!0||!U(n.fieldRowsBuffer))return`participating medium requires a retained render-field GPU buffer`;if(!ce(n.fieldRowsBuffer,e))return`participating medium rejects a cross-device render-field buffer`;if(n.rowStrideFloats!==t.length)return`participating medium requires the exact render-field cell stride`;if(!K(n.rowLayout))return`participating medium requires the exact render-field row layout`;let r=Number(n.fieldRowsBufferByteLength),i=Number(n.fieldRowsBuffer.size),a=Number(n.totalFieldCells)*t.length*Float32Array.BYTES_PER_ELEMENT;return!Number.isSafeInteger(Number(n.totalFieldCells))||Number(n.totalFieldCells)<=0||!Number.isSafeInteger(r)||r!==a||!Number.isSafeInteger(i)||i<r?`participating medium rejects inconsistent render-field buffer bounds`:n.surfaceTable?.schema!==`peercompute.ulg.sph-gpu-render-field.v1`||!Array.isArray(n.surfaceTable.metadata)||n.surfaceTable.metadata.length!==n.surfaceTable.surfaceCount?`participating medium requires the exact render-field surface table`:null}function Ve({device:e,renderField:n,volumeDescriptor:r,metadata:i,sourceMetadata:a}){if(!U(r)||r.schema!==`peercompute.ulg.sph-webgpu-marching-cubes-buffer-volume-descriptor.v0`||r.ok!==!0||r.status!==`ulg-render-field-buffer-volume-descriptor-ready`||r.device!==e||r.scalarBuffer!==n.fieldRowsBuffer||r.storageBuffer!==n.fieldRowsBuffer||r.buffer!==n.fieldRowsBuffer||r.sameDeviceStatus===`cross-device-resource`)return`participating medium rejected an unauthenticated field-volume descriptor`;let o=Number(r.surfaceIndex),s=Number(a?.resolution),c=Number(a?.fieldOffset),l=Number(a?.fieldCellCount);return!Number.isSafeInteger(o)||o<0||a!==n.surfaceTable.metadata[o]||!Re(i,a)||!Number.isSafeInteger(s)||s<2||!Number.isSafeInteger(c)||c<0||l!==s**3||r.fieldOffset!==c||r.fieldCellCount!==l||r.scalarOffset!==c*t.length||r.scalarOffsetBytes!==r.scalarOffset*Float32Array.BYTES_PER_ELEMENT||r.cellRowStrideFloats!==t.length||!G(r.dims,[s,s,s],3)?`participating medium rejected inconsistent field-volume bounds`:r.positionTransform?.enabled!==!0||r.positionTransformStatus!==`ulg-render-field-grid-to-world-transform-ready`||!G(r.positionTransformOriginM,r.positionTransform.originM,3)||!(Number(r.positionTransformScaleM)>0)||r.positionTransformScaleM!==r.positionTransform.scaleM?`participating medium requires an authenticated grid-to-world transform`:n.schroederSpatialSourceFamily&&!O(r,{device:e,sourceFamily:n.schroederSpatialSourceFamily})?`participating medium rejected stale successor field lineage`:null}function He(e){let t=Number(e?.opticalStateId);return!!(Object.isFrozen(e)&&e.collectiveOpticalRoute===!0&&e.collectiveOpticalRouteSchema===`peercompute.ulg.sph-collective-dispersed-medium-optical-route.v0`&&typeof e.collectiveOpticalRouteKey==`string`&&e.collectiveOpticalRouteKey.length>0&&Number.isSafeInteger(t)&&t>0&&Number(e.collectiveOpticalRouteId)===t&&e.opticalResponseAuthorityFlag===1&&e.opticalResponseReady===!0&&e.opticalVisibilityFlag===1&&e.opticalBlockedFlag===0&&ze(e))}function Ue(e){return Object.freeze({surfaceIndex:e.surfaceIndex,scalarBuffer:e.scalarBuffer,fieldOffset:e.fieldOffset,fieldCellCount:e.fieldCellCount,scalarOffset:e.scalarOffset,scalarOffsetBytes:e.scalarOffsetBytes,cellRowStrideFloats:e.cellRowStrideFloats,positionTransform:e.positionTransform,positionTransformStatus:e.positionTransformStatus,positionTransformScaleM:e.positionTransformScaleM,positionTransformGridBias:e.positionTransformGridBias,positionTransformOriginM:Object.freeze([...e.positionTransformOriginM]),dims:Object.freeze([...e.dims])})}function We(e,t){return!!(e.surfaceIndex===t.surfaceIndex&&e.scalarBuffer===t.scalarBuffer&&e.fieldOffset===t.fieldOffset&&e.fieldCellCount===t.fieldCellCount&&e.scalarOffset===t.scalarOffset&&e.scalarOffsetBytes===t.scalarOffsetBytes&&e.cellRowStrideFloats===t.cellRowStrideFloats&&e.positionTransform===t.positionTransform&&e.positionTransformStatus===t.positionTransformStatus&&e.positionTransformScaleM===t.positionTransformScaleM&&e.positionTransformGridBias===t.positionTransformGridBias&&G(e.positionTransformOriginM,t.positionTransformOriginM,3)&&G(e.dims,t.dims,3))}function Ge({device:n=null,renderField:r=null,surfaceDescriptors:i=[]}={}){if(!Array.isArray(i))return J(`participating medium surfaceDescriptors must be an array`);if(i.length===0)return Le();let a=i.filter(e=>!Ie(e));if(a.length===0)return Le();let o=Be(n,r);if(o)return J(o,a);let s=[...a].sort((e,t)=>q(e)-q(t)),c=new Set,l=new Set,u=new ArrayBuffer(s.length*z),d=new Uint32Array(u),f=new Float32Array(u),p=[],m=null,h=null,g=null,_=null;for(let e=0;e<s.length;e+=1){let t=s[e],i=t?.descriptor??null,o=t?.metadata??null,u=q(t),v=Number.isSafeInteger(u)?r.surfaceTable.metadata[u]:null;if(!He(o))return J(`participating medium rejected a blocked or noncanonical collective route`,a,{blockedSurfaceIndex:u});let y=Ve({device:n,renderField:r,volumeDescriptor:i,metadata:o,sourceMetadata:v});if(y)return J(y,a,{blockedSurfaceIndex:u});let b=Number(o.opticalStateId);if(c.has(b)||l.has(u))return J(`participating medium rejects duplicate route or surface identity`,a,{blockedSurfaceIndex:u});c.add(b),l.add(u);let x=Number(v.resolution),S=Number(i.positionTransformScaleM),C=Number(i.positionTransformGridBias),w=W(i.positionTransformOriginM,3);if(e===0)m=x,h=S,g=C,_=w;else if(x!==m||S!==h||C!==g||!G(w,_,3))return J(`participating medium requires one exact shared grid transform`,a,{blockedSurfaceIndex:u});let T=ze(o),E=e*8;d[E]=Number(v.fieldOffset),d[E+1]=x,d[E+2]=b,d[E+3]=u,f[E+4]=T[0],f[E+5]=T[1],f[E+6]=T[2],f[E+7]=1,p.push(Object.freeze({surfaceIndex:u,opticalStateId:b,fieldOffset:Number(v.fieldOffset),resolution:x,scatteringColorLinear:Object.freeze([...T]),volumeDescriptor:i,volumeDescriptorSnapshot:Ue(i),metadata:o,sourceMetadata:v}))}let v=Number(n.limits?.maxTextureDimension3D);if(Number.isFinite(v)&&m>v)return J(`participating medium grid exceeds maxTextureDimension3D`,a);let y=_.map(e=>e-.5*h),b=_.map(e=>e+(m-.5)*h),x={schema:N,ok:!0,status:F.ready,reason:null,sourceRenderFieldSchema:r.schema,sourceRenderFieldBackend:r.backend,routeCount:p.length,collectiveSurfaceCount:p.length,consumedSurfaceIndices:Object.freeze(p.map(e=>e.surfaceIndex)),opticalStateIds:Object.freeze(p.map(e=>e.opticalStateId)),resolution:m,dims:Object.freeze([m,m,m]),cellEdgeM:h,fieldMinM:Object.freeze(y),fieldMaxM:Object.freeze(b),fieldRowsBuffer:r.fieldRowsBuffer,fieldRowsBufferByteLength:r.fieldRowsBufferByteLength,fieldCellRowStrideFloats:t.length,temperatureLaneIndex:e.temperatureK,scatteringOpticalDepthLaneIndex:e.scatteringOpticalDepth,absorptionOpticalDepthLaneIndex:e.absorptionOpticalDepth,scatteringAsymmetryOpticalDepthLaneIndex:e.scatteringAsymmetryOpticalDepth,aggregateTextureCount:2,textureFormat:I,storageComponentMax:L,readback:!1,fullReadback:!1,activityMode:`gpu-indirect-not-read-back`,sourceReleaseBoundary:`after-containing-command-buffer-submit`};return Ae.set(x,{active:!0,device:n,renderField:r,surfaceTable:r.surfaceTable,surfaceMetadataArray:r.surfaceTable.metadata,fieldRowsBuffer:r.fieldRowsBuffer,routeRowsBytes:new Uint8Array(u),routes:p,resolution:m,cellEdgeM:h,fieldMinM:y,fieldMaxM:b}),Object.freeze(x)}function Ke(e,t){if(typeof e?.[t]!=`function`)throw TypeError(`participating medium requires device.${t}()`)}function Y(e,t,n,r){return typeof e[t]==`function`?Promise.resolve(e[t](r)):(Ke(e,n),Promise.resolve(e[n](r)))}function qe(e,{colorFormat:t=`rgba8unorm`,depthFormat:n=`depth24plus`,maxOpticalDepth:r=Ee,activityEpsilon:i=De}={}){for(let t of[`createBuffer`,`createTexture`,`createShaderModule`,`createBindGroup`,`createSampler`])Ke(e,t);if(Ke(e?.queue,`writeBuffer`),typeof t!=`string`||t.length===0)throw TypeError(`participating medium requires a color format`);if(typeof n!=`string`||n.length===0)throw TypeError(`participating medium requires a depth format`);let a=Pe(r),o=Pe(i);if(!(a>0)||!(o>=0))throw RangeError(`participating medium optical limits must be finite and nonnegative`);let s=Math.min(a,L),c=e.createShaderModule({label:`ulg-sph-participating-medium-pack-wgsl`,code:Ne}),l=e.createShaderModule({label:`ulg-sph-participating-medium-render-wgsl`,code:H}),u=Y(e,`createComputePipelineAsync`,`createComputePipeline`,{label:`ulg-sph-participating-medium-pack`,layout:`auto`,compute:{module:c,entryPoint:`pack_main`}}),d=Y(e,`createRenderPipelineAsync`,`createRenderPipeline`,{label:`ulg-sph-participating-medium-render`,layout:`auto`,vertex:{module:l,entryPoint:`vertex_main`},fragment:{module:l,entryPoint:`fragment_main`,targets:[{format:t,blend:{color:{operation:`add`,srcFactor:`one`,dstFactor:`one-minus-src-alpha`},alpha:{operation:`add`,srcFactor:`one`,dstFactor:`one-minus-src-alpha`}},writeMask:15}]},primitive:{topology:`triangle-list`,cullMode:`none`}}),f={active:!0,device:e,colorFormat:t,depthFormat:n,maxOpticalDepth:s,activityEpsilon:o,packPipelinePromise:u,renderPipelinePromise:d,sampler:e.createSampler({label:`ulg-sph-participating-medium-linear-sampler`,addressModeU:`clamp-to-edge`,addressModeV:`clamp-to-edge`,addressModeW:`clamp-to-edge`,magFilter:`linear`,minFilter:`linear`,mipmapFilter:`nearest`}),emptyMotionBuffer:e.createBuffer({label:`ulg-sph-participating-medium-empty-motion`,size:16,usage:R.STORAGE|R.COPY_DST}),frames:new Set},p={schema:P,status:`participating-medium-gpu-ready-pending-pipelines`,colorFormat:t,depthFormat:n,textureFormat:I,maxOpticalDepth:s,storageComponentMax:L,readback:!1,get destroyed(){return!f.active},ready:Promise.all([u,d]).then(()=>!0),destroy(){if(!f.active)return!1;f.active=!1;for(let e of[...f.frames])et(e);return f.frames.clear(),Ye(f.emptyMotionBuffer),!0}};return je.set(p,f),Object.freeze(p)}function X(e){let t=je.get(e);if(!t||!t.active)throw TypeError(`participating medium GPU runtime is missing or destroyed`);return t}function Je(e,t){let n=Ae.get(e);if(!n||!n.active||e.status!==F.ready)throw TypeError(`participating medium descriptor is missing, consumed, or blocked`);if(n.device!==t.device||e.fieldRowsBuffer!==n.fieldRowsBuffer)throw TypeError(`participating medium descriptor belongs to a different GPU runtime`);let r=Be(t.device,n.renderField);if(r)throw TypeError(`participating medium render-field source failed revalidation: ${r}`);if(n.renderField.fieldRowsBuffer!==n.fieldRowsBuffer||n.renderField.fieldRowsBufferRetained!==!0||n.renderField.surfaceTable!==n.surfaceTable||n.surfaceTable.metadata!==n.surfaceMetadataArray||!ce(n.fieldRowsBuffer,t.device))throw TypeError(`participating medium render-field/table identity is stale or cross-device`);for(let e of n.routes){if(n.surfaceMetadataArray[e.surfaceIndex]!==e.sourceMetadata||!Re(e.metadata,e.sourceMetadata)||!He(e.metadata)||!We(e.volumeDescriptor,e.volumeDescriptorSnapshot))throw TypeError(`participating medium route authority changed after descriptor creation`);if(n.renderField.schroederSpatialSourceFamily&&!O(e.volumeDescriptor,{device:t.device,sourceFamily:n.renderField.schroederSpatialSourceFamily}))throw TypeError(`participating medium successor lineage expired before packing`)}return n}function Ye(e){try{e?.destroy?.()}catch{}}function Xe(e,t,n,r,i){let a={active:!0,runtime:e,runtimeRecord:t,descriptor:n,descriptorRecord:r,...i},o={schema:xe,ok:!0,status:Se,resolution:n.resolution,dims:n.dims,routeCount:n.routeCount,collectiveSurfaceCount:n.collectiveSurfaceCount,consumedSurfaceIndices:n.consumedSurfaceIndices,opticalStateIds:n.opticalStateIds,opticalTexture:i.opticalTexture,scatteringTexture:i.scatteringTexture,drawIndirectBuffer:i.drawIndirectBuffer,drawIndirectOffsetBytes:0,drawCountMode:`gpu-indirect-not-read-back`,sourceBufferConsumptionEncoded:!0,sourceReleaseBoundary:n.sourceReleaseBoundary,readback:!1,fullReadback:!1,get destroyed(){return!a.active},destroy(){return et(o)}};return a.frame=o,Me.set(o,a),t.frames.add(o),Object.freeze(o)}async function Ze(e,n,r){let i=X(e);if(!U(n)||typeof n.clearBuffer!=`function`||typeof n.beginComputePass!=`function`)throw TypeError(`participating medium pack requires a GPUCommandEncoder`);let a=Je(r,i),o=await i.packPipelinePromise;X(e),Je(r,i);let s=a.resolution,c={size:{width:s,height:s,depthOrArrayLayers:s},dimension:`3d`,format:I,mipLevelCount:1,sampleCount:1,usage:Ce.STORAGE_BINDING|Ce.TEXTURE_BINDING},l=[];try{let u=i.device.createTexture({...c,label:`ulg-sph-participating-medium-optical-volume`});l.push(u);let d=i.device.createTexture({...c,label:`ulg-sph-participating-medium-scattering-volume`});l.push(d);let f=u.createView({dimension:`3d`}),p=d.createView({dimension:`3d`}),m=i.device.createBuffer({label:`ulg-sph-participating-medium-route-rows`,size:a.routeRowsBytes.byteLength,usage:R.STORAGE|R.COPY_DST});l.push(m);let h=i.device.createBuffer({label:`ulg-sph-participating-medium-pack-params`,size:B,usage:R.UNIFORM|R.COPY_DST});l.push(h);let g=i.device.createBuffer({label:`ulg-sph-participating-medium-draw-indirect`,size:4*Uint32Array.BYTES_PER_ELEMENT,usage:R.STORAGE|R.INDIRECT|R.COPY_DST});l.push(g);let _=i.device.createBuffer({label:`ulg-sph-participating-medium-render-uniforms`,size:Te,usage:R.UNIFORM|R.COPY_DST});l.push(_);let v=new ArrayBuffer(B),y=new Uint32Array(v),b=new Float32Array(v);y[0]=s,y[1]=r.routeCount,y[2]=t.length/4,b[4]=i.maxOpticalDepth,b[5]=i.activityEpsilon,i.device.queue.writeBuffer(m,0,a.routeRowsBytes),i.device.queue.writeBuffer(h,0,new Uint8Array(v));let x=i.device.createBindGroup({label:`ulg-sph-participating-medium-pack-bind-group`,layout:o.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:a.fieldRowsBuffer}},{binding:1,resource:{buffer:m}},{binding:2,resource:{buffer:h}},{binding:3,resource:f},{binding:4,resource:p},{binding:5,resource:{buffer:g}}]});n.clearBuffer(g,0,4*Uint32Array.BYTES_PER_ELEMENT);let S=n.beginComputePass({label:`ulg-sph-participating-medium-pack-pass`});S.setPipeline(o),S.setBindGroup(0,x);let C=Math.ceil(s/4);return S.dispatchWorkgroups(C,C,C),S.end(),a.active=!1,Xe(e,i,r,a,{opticalTexture:u,scatteringTexture:d,opticalTextureView:f,scatteringTextureView:p,routeRowsBuffer:m,packParamsBuffer:h,drawIndirectBuffer:g,renderUniformBuffer:_,packDispatch:Object.freeze([C,C,C])})}catch(e){a.active=!1;for(let e of l)Ye(e);throw e}}function Qe(e,{inverseViewProjectionMatrix:t,cameraPositionM:n,viewportSize:r,lightDirection:i=[.38,.82,.42],lightIntensity:a=1,ambientIntensity:o=.18,stepCount:s=V,depthEpsilon:c=1e-6,motionAgeS:l=0,motionRowCount:u=0}){let d=W(t,16),f=W(n,3),p=W(r,2),m=W(i,3),h=Pe(a),g=Pe(o),_=Pe(c);if(!d||!f||!p||p.some(e=>!(e>0))||!m||Math.hypot(...m)<=1e-12||!(h>=0)||!(g>=0)||!(_>=0))throw TypeError(`participating medium render uniforms are incomplete or non-finite`);let v=Math.max(Oe,Math.min(ke,Math.round(Pe(s,V)))),y=new Float32Array(we);y.set(d,0),y.set(f,16),y[19]=v,y.set(e.descriptorRecord.fieldMinM,20),y[23]=e.descriptorRecord.cellEdgeM,y.set(e.descriptorRecord.fieldMaxM,24),y[27]=g;let b=Math.hypot(...m);y[28]=m[0]/b,y[29]=m[1]/b,y[30]=m[2]/b,y[31]=h,y[32]=p[0],y[33]=p[1],y[34]=_;let x=Number.isFinite(Number(l))&&Number(l)>0?Number(l):0,S=Number.isSafeInteger(Number(u))&&Number(u)>0?Number(u):0;return y[36]=S>0?x:0,y[37]=e.descriptor.routeCount||0,y[38]=e.descriptor.resolution||0,y[39]=S,e.runtimeRecord.device.queue.writeBuffer(e.renderUniformBuffer,0,y),Object.freeze({stepCount:v,viewportSize:Object.freeze([...p]),readback:!1})}async function $e(e,t,{packedFrame:n=null,inverseViewProjectionMatrix:r=null,cameraPositionM:i=null,viewportSize:a=null,depthTextureView:o=null,lightDirection:s=[.38,.82,.42],lightIntensity:c=1,ambientIntensity:l=.18,stepCount:u=V,depthEpsilon:d=1e-6,motionField:f=null,motionAgeS:p=0}={}){let m=X(e),h=Me.get(n);if(!h||!h.active||h.runtime!==e||!U(t)||typeof t.setPipeline!=`function`||typeof t.setBindGroup!=`function`||typeof t.drawIndirect!=`function`||!U(o))throw TypeError(`participating medium render requires a live packed frame, pass, and depth view`);let g=await m.renderPipelinePromise;if(X(e),!h.active)throw TypeError(`participating medium packed frame was destroyed before rendering`);let _=f?.buffer&&f?.destroyed!==!0?f.buffer:m.emptyMotionBuffer,v=Qe(h,{inverseViewProjectionMatrix:r,cameraPositionM:i,viewportSize:a,lightDirection:s,lightIntensity:c,ambientIntensity:l,stepCount:u,depthEpsilon:d,motionAgeS:p,motionRowCount:_===m.emptyMotionBuffer?0:Math.max(0,Math.floor(Number(f?.rowCount)||0))}),y=h.cachedRenderBindGroup;return(!y||h.cachedRenderDepthView!==o||h.cachedRenderMotionBuffer!==_)&&(y=m.device.createBindGroup({label:`ulg-sph-participating-medium-render-bind-group`,layout:g.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:h.renderUniformBuffer}},{binding:1,resource:h.opticalTextureView},{binding:2,resource:h.scatteringTextureView},{binding:3,resource:m.sampler},{binding:4,resource:o},{binding:5,resource:{buffer:_}},{binding:6,resource:{buffer:h.routeRowsBuffer}}]}),h.cachedRenderBindGroup=y,h.cachedRenderDepthView=o,h.cachedRenderMotionBuffer=_),t.setPipeline(g),t.setBindGroup(0,y),t.drawIndirect(h.drawIndirectBuffer,0),Object.freeze({status:`participating-medium-render-encoded`,routeCount:n.routeCount,consumedSurfaceIndices:n.consumedSurfaceIndices,drawCountMode:n.drawCountMode,readback:!1,...v})}function et(e){let t=Me.get(e);if(!t||!t.active)return!1;t.active=!1,t.runtimeRecord.frames.delete(e);for(let e of[t.opticalTexture,t.scatteringTexture,t.routeRowsBuffer,t.packParamsBuffer,t.drawIndirectBuffer,t.renderUniformBuffer])Ye(e);return!0}var tt=`
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
`,nt=`
struct WorkerSurfaceMotionUniform {
  grid: vec4<u32>,
  motion: vec4<f32>,
};
@group(0) @binding(6) var<storage, read> isosurface_motion_rows: array<vec4<f32>>;
@group(0) @binding(7) var<uniform> surface_motion: WorkerSurfaceMotionUniform;
${tt}
`,rt=`@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32) -> VertexOut {
  var normal = compact_normal(vertex_index);
  let smooth_normal = compact_packed_normal(vertex_index);
  if (dot(smooth_normal, smooth_normal) > 0.25) {
    normal = smooth_normal;
  }
  let motion = sample_isosurface_motion(
    compact_position(vertex_index) + vec3<f32>(camera_data.position_grid_bias),
    camera_data.position_scale_m, normal, surface_motion.motion.x, surface_motion.motion.y,
    surface_motion.grid.x, surface_motion.grid.y, surface_motion.grid.z
  );
  let position_m = compact_world_position(vertex_index) + motion.displacement;
  var out: VertexOut;
  var clip = camera_data.view_projection * vec4<f32>(position_m, 1.0);
  clip.z = clip.z * 0.5 + clip.w * 0.5;
  if (clip.w <= 0.0) {
    clip = vec4<f32>(2.0, 2.0, 1.0, 1.0);
  }
  out.position = clip;
  out.world_position = position_m;
  out.normal = motion.normal;
  out.material_id = camera_data.material_id;
  out.phase_id = camera_data.phase_id;
  out.optical_state_id = camera_data.optical_state_id;
  var vertex_temperature_k = 0.0;
  if (vertex_index < arrayLength(&compact_vertex_temperatures_k)) {
    vertex_temperature_k = compact_vertex_temperatures_k[vertex_index];
  }
  out.emissive_temperature_k = vertex_temperature_k;
  return out;
}
`,it=/@vertex\nfn vs_main\(@builtin\(vertex_index\) vertex_index: u32\) -> VertexOut \{[\s\S]*?\n\}\n/;if(!it.test(ie))throw Error(`shared native compact vertex entry unavailable for retained motion`);var at=nt+ie.replace(it,rt);function ot({pixels:e,width:t,height:n,mipLevelCount:r,sampleCount:i=64}={}){let a=Math.max(1,Math.round(Number(t)||0)),o=Math.max(1,Math.round(Number(n)||0)),s=Math.max(1,Math.round(Number(r)||1)),c=Math.max(1,Math.round(Number(i)||1)),l=new Float32Array(a*o*3);for(let t=0;t<a*o;t+=1)l[t*3+0]=((e[t*4+0]||0)/255)**2.2,l[t*3+1]=((e[t*4+1]||0)/255)**2.2,l[t*3+2]=((e[t*4+2]||0)/255)**2.2;let u=(e,t,n)=>{let r=e*a-.5,i=Math.min(Math.max(t*o-.5,0),o-1),s=Math.floor(r),c=Math.floor(i),u=r-s,d=i-c,f=(s%a+a)%a,p=(f+1)%a,m=Math.min(Math.max(c,0),o-1),h=Math.min(m+1,o-1);for(let e=0;e<3;e+=1){let t=l[(m*a+f)*3+e]*(1-u)+l[(m*a+p)*3+e]*u,r=l[(h*a+f)*3+e]*(1-u)+l[(h*a+p)*3+e]*u;n[e]=t*(1-d)+r*d}},d=[],f=a,p=o,m=[0,0,0];for(let t=0;t<s;t+=1){let n=new Uint8ClampedArray(f*p*4);if(t===0)for(let t=0;t<f*p;t+=1)n[t*4+0]=e[t*4+0],n[t*4+1]=e[t*4+1],n[t*4+2]=e[t*4+2],n[t*4+3]=255;else{let e=t/Math.max(1,s-1),r=e*e,i=new Float32Array(c*3);for(let e=0;e<c;e+=1){let t=(e+.5)/c,n=e;n=(n<<16|n>>>16)>>>0,n=((n&1431655765)<<1|(n&2863311530)>>>1)>>>0,n=((n&858993459)<<2|(n&3435973836)>>>2)>>>0,n=((n&252645135)<<4|(n&4042322160)>>>4)>>>0,n=((n&16711935)<<8|(n&4278255360)>>>8)>>>0;let a=n*23283064365386963e-26,o=2*Math.PI*t,s=Math.sqrt((1-a)/(1+(r*r-1)*a)),l=Math.sqrt(Math.max(0,1-s*s));i[e*3+0]=Math.cos(o)*l,i[e*3+1]=Math.sin(o)*l,i[e*3+2]=s}for(let e=0;e<p;e+=1){let t=(e+.5)/p*Math.PI,r=Math.cos(t),a=Math.sin(t);for(let t=0;t<f;t+=1){let o=((t+.5)/f-.5)*2*Math.PI,s=Math.cos(o)*a,l=Math.sin(o)*a,d=Math.abs(r)<.999,p=+!d,h=+!!d,g=h*l-0*r,_=0*s-p*l,v=p*r-h*s,y=Math.hypot(g,_,v)||1;g/=y,_/=y,v/=y;let b=r*v-l*_,x=l*g-s*v,S=s*_-r*g,C=0,w=0,T=0,E=0;for(let e=0;e<c;e+=1){let t=i[e*3+0]*g+i[e*3+1]*b+i[e*3+2]*s,n=i[e*3+0]*_+i[e*3+1]*x+i[e*3+2]*r,a=i[e*3+0]*v+i[e*3+1]*S+i[e*3+2]*l,o=s*t+r*n+l*a,c=2*o*t-s,d=2*o*n-r,f=2*o*a-l,p=s*c+r*d+l*f;p<=0||(u(Math.atan2(f,c)*.15915494+.5,Math.acos(Math.min(Math.max(d,-1),1))*.31830989,m),C+=m[0]*p,w+=m[1]*p,T+=m[2]*p,E+=p)}let D=E>0?1/E:0,ee=(e*f+t)*4;n[ee+0]=Math.round(Math.min(Math.max(C*D,0),1)**(1/2.2)*255),n[ee+1]=Math.round(Math.min(Math.max(w*D,0),1)**(1/2.2)*255),n[ee+2]=Math.round(Math.min(Math.max(T*D,0),1)**(1/2.2)*255),n[ee+3]=255}}}d.push({width:f,height:p,pixels:n}),f=Math.max(1,f>>1),p=Math.max(1,p>>1)}return d}var st=E,ct=136,lt=6,ut=20,Z=(e,t)=>(Array.isArray(e)||ArrayBuffer.isView(e))&&e.length===t&&Array.from(e).every(Number.isFinite);function dt(e,t){if(e.byteLength!==t.byteLength)return!1;let n=new Uint8Array(e.buffer,e.byteOffset,e.byteLength),r=new Uint8Array(t.buffer,t.byteOffset,t.byteLength);return n.every((e,t)=>e===r[t])}function ft(e,t){return e.schema===t.schema&&e.recordCount===t.recordCount&&e.spectralSampleCount===t.spectralSampleCount&&e.recordStrideBytes===t.recordStrideBytes&&e.spectralSampleStrideBytes===t.spectralSampleStrideBytes&&dt(e.records,t.records)&&dt(e.spectralSamples,t.spectralSamples)}function pt(e){let t=e?.opticalTable;if(e?.schema!==`peercompute.ulg.worker-native-surface-material.v0`||t?.schema!==`peercompute.ulg.optical-gpu-table.v0`||!(t.records instanceof Float32Array)||!(t.spectralSamples instanceof Float32Array)||!Number.isSafeInteger(t.recordCount)||t.recordCount<=0||!Number.isSafeInteger(t.spectralSampleCount)||t.spectralSampleCount<0||t.recordStrideFloats!==d||t.recordStrideBytes!==d*4||t.spectralSampleStrideFloats!==o||t.spectralSampleStrideBytes!==o*4||t.records.length!==t.recordCount*d||t.spectralSamples.length!==t.spectralSampleCount*o||!t.records.every(Number.isFinite)||!t.spectralSamples.every(Number.isFinite))throw TypeError(`worker native surface requires the exact finite optical closure table`);return Object.freeze({...e,lightingProfile:Object.freeze({...e.lightingProfile}),backgroundClearValue:Object.freeze({...e.backgroundClearValue}),opticalTable:Object.freeze({schema:t.schema,recordCount:t.recordCount,recordStrideFloats:d,recordStrideBytes:d*4,spectralSampleCount:t.spectralSampleCount,spectralSampleStrideFloats:o,spectralSampleStrideBytes:o*4,records:new Float32Array(t.records),spectralSamples:new Float32Array(t.spectralSamples)})})}function mt(e,t,n){let r=new Float32Array(st/4),i=new Uint32Array(r.buffer);if(!Z(e.viewProjectionMatrix,16)||!Z(n,16))throw TypeError(`native surface requires finite forward and inverse camera matrices`);r.set(e.viewProjectionMatrix,0),r.set(n,64);let a=t.metadata||{},o=t.translation?.surfaceDraw||{},s=t.translation?.surfaceVertices||{},c=t.translation?.positionTransform||t.descriptor?.positionTransform||{},l=t.translation?.positionClamp||{},u=(e.nativeSurfaceAppearance||e.request?.nativeSurfaceMaterial||{}).lightingProfile||{};i[16]=s.compactPositionRowsVertexCount??s.compactPositionRowsBufferRowCount??0,i[17]=s.compactPositionRowsStrideFloats??o.compactPositionRowsStrideFloats??4,i[18]=t.descriptor?.surfaceIndex||0,r[20]=Number(a.materialId)||0,r[21]=Number(a.phaseId)||0,r[22]=Number(a.opticalStateId)||0,r[23]=Number(a.density)||0,r[24]=Number(t.descriptor?.isovalue)||0,r[26]=Number(a.transparencyClassId)||0,r[27]=Number(a.depthWriteFlag)===0?0:1,r[28]=Number(a.renderOrder)||0,r.set([0,1,0],29);let d=c.enabled===!0;r[32]=d&&Number.isFinite(c.scaleM)?c.scaleM:1,r.set(d&&Z(c.originM,3)?c.originM:[0,0,0],33),r[36]=d&&Number.isFinite(c.gridBias)?c.gridBias:0,r[37]=+!!d,r[38]=Number(u.nativeAmbientSuppression)||0,r[39]=Number(u.nativeDirectSuppression)||0,l.enabled===!0&&Z(l.minM,3)&&Z(l.maxM,3)&&(r.set(l.minM,40),r.set(l.maxM,43),r[46]=1),r[47]=Number(u.nativeEnvironmentSuppression)||0;let f=e.boxDimsM;return r[51]=Z(f,3)?Math.hypot(...f)/2:0,r.set(Z(e.cameraPositionM,3)?e.cameraPositionM:[0,0,0],60),r[63]=Math.max(0,Number(a.emissiveTemperatureK)||0),r}function ht(e,t,n){let r=new Float32Array(32/4);if(!e.motionField?.buffer)return r;let i=new Uint32Array(r.buffer);return i[0]=t.descriptor?.fieldOffset??0,i[1]=t.metadata?.resolution??0,i[2]=e.motionField.rowCount,r[4]=Math.max(0,Number(e.drawMotionAgeS)||0),r[5]=Math.abs(n[32]),r}function gt(e){let t=e?.metadata||{};return t.renderLayer===`vapor-surface`||Number(t.transparencyClassId)===1?`vapor`:t.renderLayer===`refractive-surface`||Number(t.transparencyClassId)===2?`refractive`:`opaque`}function _t({device:e,format:t,depthFormat:n,onAppearanceReady:r=null,fetchImage:i=(...e)=>globalThis.fetch(...e),decodeImage:a=(...e)=>globalThis.createImageBitmap(...e),createEnvironmentCanvas:o=(e,t)=>new globalThis.OffscreenCanvas(e,t),createBackgroundCanvas:s=o}){let c=!1,l=null,u=new Map,d=new Map,p=new Set,m=new Set,h=e=>(m.add(e),e),_=typeof globalThis.GPUDevice==`function`&&e instanceof globalThis.GPUDevice,v=(t,n,r,i)=>h(_?b(g(e,{bucketKey:t,label:n,size:r,usage:i}),e,{bucketKey:t,size:r,usage:i}):e.createBuffer({label:n,size:r,usage:i})),S=t=>{let n=[...new Set(t.filter(e=>e&&m.has(e)))];for(let e of n)m.delete(e);n.length!==0&&y(e,()=>{for(let e of n)x(e,{allowPool:!c&&_})})},C=e.createSampler({magFilter:`linear`,minFilter:`linear`,mipmapFilter:`linear`,addressModeU:`clamp-to-edge`,addressModeV:`clamp-to-edge`}),w=e.createSampler({magFilter:`linear`,minFilter:`linear`,mipmapFilter:`linear`,addressModeU:`repeat`,addressModeV:`clamp-to-edge`}),T=h(e.createTexture({label:`ulg-worker-native-dummy-color`,size:[1,1],format:`rgba8unorm`,usage:lt}));e.queue.writeTexture({texture:T},new Uint8Array([0,0,0,255]),{bytesPerRow:4},[1,1]);let E=h(e.createTexture({label:`ulg-worker-native-dummy-back-depth`,size:[1,1],format:`depth32float`,usage:ut})),D=h(e.createBuffer({label:`ulg-worker-native-no-vertex-temperature`,size:16,usage:ct})),ee=h(e.createBuffer({label:`ulg-worker-native-no-motion`,size:16,usage:ct})),te=e.createShaderModule({label:`ulg-worker-shared-native-surface`,code:at}),re=e.createBindGroupLayout({entries:[{binding:0,visibility:1,buffer:{type:`read-only-storage`}},{binding:1,visibility:3,buffer:{type:`uniform`}},{binding:2,visibility:2,buffer:{type:`read-only-storage`}},{binding:3,visibility:2,buffer:{type:`read-only-storage`}},{binding:4,visibility:1,buffer:{type:`read-only-storage`}},{binding:5,visibility:1,buffer:{type:`read-only-storage`}},{binding:6,visibility:1,buffer:{type:`read-only-storage`}},{binding:7,visibility:1,buffer:{type:`uniform`,minBindingSize:32}}]}),O=e.createBindGroupLayout({entries:[{binding:0,visibility:2,texture:{sampleType:`float`}},{binding:1,visibility:2,sampler:{type:`filtering`}},{binding:2,visibility:2,texture:{sampleType:`float`}},{binding:3,visibility:2,sampler:{type:`filtering`}},{binding:4,visibility:2,texture:{sampleType:`depth`}}]}),ie=e.createPipelineLayout({bindGroupLayouts:[re,O]}),ae=t=>e.createRenderPipelineAsync?e.createRenderPipelineAsync(t):Promise.resolve(e.createRenderPipeline(t)),k={},oe={color:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}},se=(async()=>{let r=(await te.getCompilationInfo?.())?.messages?.filter(e=>e.type===`error`)||[];if(r.length)throw Error(r.map(e=>e.message).join(`; `));await Promise.all([`opaque`,`vapor`,`backface`].map(async e=>{let r=e===`backface`;k[e]=await ae({label:`ulg-worker-native-surface-${e}`,layout:ie,vertex:{module:te,entryPoint:`vs_main`},...r?{}:{fragment:{module:te,entryPoint:`fs_main`,targets:[{format:t,...e===`vapor`?{blend:oe}:{}}]}},primitive:{topology:`triangle-list`,cullMode:r?`front`:`back`},depthStencil:{format:r?`depth32float`:n,depthWriteEnabled:e!==`vapor`,depthCompare:r?`less`:`less-equal`}})}));let i=e.createShaderModule({code:ne});k.background=await ae({label:`ulg-worker-native-background`,layout:`auto`,vertex:{module:i,entryPoint:`vs_main`},fragment:{module:i,entryPoint:`fs_main`,targets:[{format:t}]},primitive:{topology:`triangle-list`},depthStencil:{format:n,depthWriteEnabled:!1,depthCompare:`always`}})})(),ce=e=>{if(!(c||d.get(e.url)!==e||e.refs<=0))try{r?.({backgroundImageUrl:e.url,status:e.status,error:e.error})}catch{}},le=e=>{e&&(e.width=1,e.height=1)},ue=t=>{if(!t)return null;let n=d.get(t);return n||(n={url:t,refs:0,texture:null,status:`pending`,error:null,environmentTexture:null,environmentStatus:`pending`,environmentError:null,abort:new AbortController},d.set(t,n),n.ready=Promise.resolve().then(async()=>{let r=await i(t,{signal:n.abort.signal});if(!r.ok)throw Error(`native background image HTTP ${r.status}`);if(c||d.get(t)!==n)return;let l=await a(await r.blob()),u=null;try{if(c||d.get(t)!==n)return;let r=Math.max(1,Number(l.width)||1),i=Math.max(1,Number(l.height)||1),a=Math.max(1,Math.floor(Number(e.limits?.maxTextureDimension2D)||2048)),f=Math.min(1,Math.min(2048,a)/Math.max(r,i));n.width=Math.max(1,Math.round(r*f)),n.height=Math.max(1,Math.round(i*f)),u=s(n.width,n.height);let p=u.getContext(`2d`,{willReadFrequently:!0});if(!p)throw Error(`native background resize sampler unavailable`);p.drawImage(l,0,0,n.width,n.height);let m=p.getImageData(0,0,n.width,n.height).data,g=n.width*4,_=Math.ceil(g/256)*256,v=m;if(_!==g){v=new Uint8Array(_*n.height);for(let e=0;e<n.height;e++)v.set(m.subarray(e*g,(e+1)*g),e*_)}n.texture=h(e.createTexture({label:`ulg-worker-native-background-image`,size:[n.width,n.height,1],format:`rgba8unorm`,usage:lt})),e.queue.writeTexture({texture:n.texture},v,{bytesPerRow:_,rowsPerImage:n.height},[n.width,n.height,1]),le(u),u=null,n.status=`ready`;let y=null;try{y=o(256,128);let t=y.getContext(`2d`,{willReadFrequently:!0});if(!t)throw Error(`native environment 2D image sampler unavailable`);t.drawImage(l,0,0,256,128);let r=ot({pixels:t.getImageData(0,0,256,128).data,width:256,height:128,mipLevelCount:9,sampleCount:64});n.environmentTexture=h(e.createTexture({label:`ulg-worker-native-environment-prefilter`,size:[256,128],format:`rgba8unorm`,mipLevelCount:9,usage:lt}));for(let t=0;t<r.length;t++)e.queue.writeTexture({texture:n.environmentTexture,mipLevel:t},r[t].pixels,{bytesPerRow:r[t].width*4,rowsPerImage:r[t].height},[r[t].width,r[t].height,1]);n.environmentStatus=`ready`}catch(e){S([n.environmentTexture]),n.environmentTexture=null,n.environmentStatus=`failed`,n.environmentError=String(e?.message||e)}finally{le(y)}}finally{le(u),l.close()}}).catch(e=>{S([n.texture]),n.texture=null,n.status=`failed`,n.error=String(e?.message||e),n.environmentStatus=`unavailable-background-failed`}).finally(()=>ce(n))),n.refs+=1,n},de=e=>{!e||--e.refs>0||(d.get(e.url)===e&&d.delete(e.url),e.abort.abort(),S([e.texture,e.environmentTexture]))},fe=t=>{for(let e of p)if(ft(e.table,t))return e.refs+=1,e;let n=f(e,t);h(n.recordsBuffer),h(n.spectralSamplesBuffer);let r={buffers:n,refs:1,table:{...t,records:new Float32Array(t.records),spectralSamples:new Float32Array(t.spectralSamples)}};return p.add(r),r},A=e=>{!e||--e.refs>0||(p.delete(e),S([e.buffers.recordsBuffer,e.buffers.spectralSamplesBuffer]))},j=e=>{let t=u.get(e);t&&(u.delete(e),de(t.background),A(t.optical),S([t.backgroundUniform,...[...t.bindGroups.values()].map(e=>e.motionUniform)]))},pe=async(n,r)=>{if(await se,c)throw Error(`worker native material disposed`);let[i,a]=r.map(Math.floor);if(!(Number.isFinite(i)&&Number.isFinite(a)&&i>0&&a>0))throw TypeError(`native material viewport unavailable`);(!l||l.width!==i||l.height!==a)&&(l&&S([l.color,l.backDepth]),l={width:i,height:a,color:h(e.createTexture({label:`ulg-worker-native-scene-copy`,size:[i,a],format:t,usage:lt})),backDepth:h(e.createTexture({label:`ulg-worker-native-back-depth`,size:[i,a],format:`depth32float`,usage:ut}))});let o=n.request.nativeSurfaceMaterial,s=n.nativeSurfaceAppearance||o,d=u.get(n);if(!d){let e=fe(o.opticalTable);try{d={optical:e,background:null,backgroundUrl:null,bindGroups:new Map,backgroundUniform:v(`ulg-worker-native-background-uniform`,`ulg-worker-native-background-uniform`,16,72)},u.set(n,d)}catch(t){throw A(e),t}}let f=s.backgroundImageUrl||null;d.backgroundUrl!==f&&(de(d.background),d.backgroundUrl=f,d.background=ue(f));let p=d.background?.environmentTexture||T;return(d.opticsTargets!==l||d.environmentTexture!==p)&&(d.opticsBindGroup=e.createBindGroup({layout:O,entries:[{binding:0,resource:l.color.createView()},{binding:1,resource:C},{binding:2,resource:p.createView()},{binding:3,resource:w},{binding:4,resource:l.backDepth.createView()}]}),d.opaqueOpticsBindGroup=e.createBindGroup({layout:O,entries:[{binding:0,resource:T.createView()},{binding:1,resource:C},{binding:2,resource:p.createView()},{binding:3,resource:w},{binding:4,resource:E.createView()}]}),d.opticsTargets=l,d.environmentTexture=p),d.diagnostics=ge(n),d},me=(t,n,r,{inverse:i,refractive:a=!1,backface:o=!1}={})=>{let s=u.get(n),l=r.translation?.surfaceVertices,d=r.translation?.surfaceDraw?.drawIndirectRowsBuffer;if(c||!s||!l?.compactPositionRowsBuffer||!l?.compactNormalRowsBuffer||!d||!r.uniformBuffer)return!1;let f=mt(n,r,i);e.queue.writeBuffer(r.uniformBuffer,0,f);let p=r.translation?.surfaceDraw?.compactTemperatureRowsBuffer||D,m=n.motionField?.buffer||ee,h=[l.compactPositionRowsBuffer,r.uniformBuffer,s.optical.buffers.recordsBuffer,s.optical.buffers.spectralSamplesBuffer,l.compactNormalRowsBuffer,p,m],g=s.bindGroups.get(r);return g||(g={motionUniform:v(`ulg-worker-native-surface-motion-uniform`,`ulg-worker-native-surface-motion-uniform`,32,72)},s.bindGroups.set(r,g)),(!g.inputs||h.some((e,t)=>e!==g.inputs[t]))&&(g.bindGroup=e.createBindGroup({layout:re,entries:[{binding:0,resource:{buffer:l.compactPositionRowsBuffer}},{binding:1,resource:{buffer:r.uniformBuffer}},{binding:2,resource:{buffer:s.optical.buffers.recordsBuffer}},{binding:3,resource:{buffer:s.optical.buffers.spectralSamplesBuffer}},{binding:4,resource:{buffer:l.compactNormalRowsBuffer}},{binding:5,resource:{buffer:p}},{binding:6,resource:{buffer:m}},{binding:7,resource:{buffer:g.motionUniform}}]}),g.inputs=h),g.temperatureMode=p===D?`uniform-temperature-fallback`:`retained-compact-temperature-rows`,e.queue.writeBuffer(g.motionUniform,0,ht(n,r,f)),t.setPipeline(k[o?`backface`:gt(r)===`vapor`?`vapor`:`opaque`]),t.setBindGroup(0,g.bindGroup),t.setBindGroup(1,a?s.opticsBindGroup:s.opaqueOpticsBindGroup),t.drawIndirect(d,0),!0},he=(t,n)=>{let r=u.get(n);if(!r?.background?.texture)return!1;let i=r.background.width/r.background.height,a=l.width/l.height,o=i>a?[a/i,1]:[1,i/a];return e.queue.writeBuffer(r.backgroundUniform,0,new Float32Array([...o,0,0])),t.setPipeline(k.background),r.backgroundBindTexture!==r.background.texture&&(r.backgroundBindGroup=e.createBindGroup({layout:k.background.getBindGroupLayout(0),entries:[{binding:0,resource:r.background.texture.createView()},{binding:1,resource:C},{binding:2,resource:{buffer:r.backgroundUniform}}]}),r.backgroundBindTexture=r.background.texture),t.setBindGroup(0,r.backgroundBindGroup),t.draw(3),!0},ge=e=>{let t=u.get(e);return Object.freeze({backgroundStatus:t?.background?.status||`not-requested`,backgroundError:t?.background?.error||null,backgroundImageUrl:t?.backgroundUrl||null,environmentPrefilterStatus:t?.background?.environmentStatus||`not-requested`,environmentPrefilterError:t?.background?.environmentError||null,environmentLightingSource:t?.background?.environmentTexture?`native-ggx-prefilter-256x128-9mips-64samples`:`native-analytic-fallback`,opticalTableCacheEntryCount:p.size,temperatureModes:[...new Set(Array.from(t?.bindGroups?.values()??[]).map(e=>e.temperatureMode).filter(Boolean))]})};return{ready:se,prepare:pe,draw:me,drawBackground:he,releaseFrame:j,getDiagnostics:ge,clearValue:e=>{let t=e?.nativeSurfaceAppearance||e?.request?.nativeSurfaceMaterial||{};if(t.backgroundImageUrl)return{r:0,g:0,b:0,a:1};let n=t.backgroundClearValue;if(n&&[`r`,`g`,`b`].every(e=>Number.isFinite(n[e])&&n[e]>=0&&n[e]<=1)&&n.a===1)return{r:n.r,g:n.g,b:n.b,a:1};let r=String(t.backgroundColor||``).replace(/^#/,``);return/^[0-9a-f]{6}$/i.test(r)?{r:parseInt(r.slice(0,2),16)/255,g:parseInt(r.slice(2,4),16)/255,b:parseInt(r.slice(4,6),16)/255,a:1}:{r:0,g:0,b:0,a:1}},transferFrame(e,t){let n=u.get(e);n&&e!==t&&(j(t),u.delete(e),u.set(t,n))},copySceneColor(e,t){e.copyTextureToTexture({texture:t},{texture:l.color},[l.width,l.height])},backDepthView(){return l.backDepth.createView()},dispose(){if(!c){c=!0;for(let e of u.keys())j(e);S([...m])}}}}var vt=`peercompute.ulg.worker-offscreen-resident-isosurface-presentation.v0`,yt=`peercompute.ulg.worker-offscreen-resident-isosurface-request.v0`,bt=`worker-offscreen-resident-isosurface-presentation-enqueued`,xt=`worker-offscreen-resident-isosurface-presentation-rendered`,St=`worker-offscreen-resident-isosurface-presentation-failed`,Ct=`worker-offscreen-resident-isosurface-presentation-superseded`,wt=`worker-owned-true-isosurface`,Tt=`peercompute.ulg.worker-offscreen-resident-isosurface-presentation-frame.v0`,Et=`peercompute.ulg.sph-gpu-render-field.v1`,Dt=1e3/30;function Ot(e){let t=new Float32Array(16);for(let n=0;n<16;n+=1)t[n]=Number(e[n])||0;for(let e=0;e<4;e+=1){let n=e*4;t[n+2]=.5*t[n+2]+.5*t[n+3]}return t}var kt=`no-full-readback`,At=`gpu-conservative-no-readback`,jt=`depth24plus`,Mt=`peercompute.ulg.worker-participating-medium-presentation.v0`,Nt=`not-requested`,Pt=F.ready,Ft=F.empty,It=F.blocked,Lt=Object.freeze([`ordered-isosurface-and-overlay`]),Rt=Object.freeze([`opaque-isosurface`,`depth-clipped-participating-medium`,`transparent-isosurface-and-overlay`]),zt=4,Bt=8,Vt=64,Ht=128,Ut=class extends Error{};`${tt}`;function Q(){return globalThis.performance?.now?.()??Date.now()}function Wt(e,t){return globalThis.GPUBufferUsage?.[e]??t}function Gt(e){return!!(e&&typeof e==`object`&&(e.constructor?.name===`GPUBuffer`||typeof e.mapAsync==`function`||typeof e.getMappedRange==`function`))}function Kt({device:e,retained:t}={}){let r=t?.residentProductMass??null;if(!r)return Object.freeze({productEventBuffer:null,productEventSource:null,productEventCount:0,productEventLiveCountDescriptor:null});let i=r.productEventBuffer??null,o=Number(r.productEventRowCount),s=Number(r.productEventRowCapacity??r.productEventRowCount);if(!(i||r.productEventLiveCountAuthority||a(r)||Number.isFinite(o)&&o>0||Number.isFinite(s)&&s>0))return Object.freeze({productEventBuffer:null,productEventSource:null,productEventCount:0,productEventLiveCountDescriptor:null});let l=i?c(r,e):null,u=l?.expectedRowCapacity??0,d=u*se*Float32Array.BYTES_PER_ELEMENT;if(r.productEventBufferRetained!==!0||!i||!l||!n(l,{handle:r,device:e})||l.hostObserved!==!1||!Number.isSafeInteger(u)||u<=0||l.rowCapacity!==u||l.expectedRowStrideVec4!==se/4||l.rowStrideFloats!==se||!Number.isSafeInteger(o)||o!==u||!Number.isSafeInteger(s)||s!==u||!(Number(i.size)>=d))throw TypeError(`worker-owned isosurface requires an exact retained product-event buffer and authenticated GPU live-count capacity`);return Object.freeze({productEventBuffer:i,productEventSource:r,productEventCount:u,productEventLiveCountDescriptor:l})}function qt(e){if(!e)return null;if(!Object.hasOwn(e,`__ulgActiveBorrowCount`))throw TypeError(`worker-owned isosurface requires a borrowable retained product-event source`);let t=Math.max(0,Math.floor(Number(e.__ulgActiveBorrowCount)||0));if(e.__ulgActiveBorrowCount=t+1,Number(e.__ulgActiveBorrowCount)!==t+1)throw TypeError(`worker-owned isosurface could not pin its retained product-event source`);let n=!1;return()=>n?!1:(n=!0,e.__ulgActiveBorrowCount=Math.max(0,(Number(e.__ulgActiveBorrowCount)||0)-1),!0)}function Jt(e,t){if(!i(t))return null;let n=t?.dispersedMediumOptics??null,a=Number(t?.particleCount),o=Number(n?.rowCount),s=Number(n?.rowStrideFloats),c=Number(n?.bufferByteLength),l=o*s*Float32Array.BYTES_PER_ELEMENT;if(!n||n.ownsBuffer!==!0||n.destroyed===!0||t.ownsDispersedMediumOpticsBuffer!==!0||t.dispersedMediumOpticsAuthority!==n.authority||t.dispersedMediumOpticsBuffer!==n.buffer||t.dispersedMediumOpticsRowCount!==n.rowCount||t.dispersedMediumOpticsRowStrideFloats!==n.rowStrideFloats||t.dispersedMediumOpticsBufferByteLength!==n.bufferByteLength||!Number.isSafeInteger(a)||a<=0||n.particleCount!==a||!Number.isSafeInteger(o)||o!==a||!Number.isSafeInteger(s)||s<=0||!Number.isSafeInteger(c)||c<=0||c!==l||!Number.isSafeInteger(Number(n.buffer?.size))||Number(n.buffer?.size)!==c)throw TypeError(`worker-owned isosurface rejected torn dispersed-medium particle-upload aliases`);return Object.freeze({sidecar:n,release:r(e,n)})}function Yt(e){if(!e||typeof e!=`object`)throw TypeError(`worker-owned isosurface requires object surface metadata`);let t={...e};return(Array.isArray(e.boundsCenterM)||ArrayBuffer.isView(e.boundsCenterM))&&(t.boundsCenterM=Object.freeze(Array.from(e.boundsCenterM))),(Array.isArray(e.colorLinear)||ArrayBuffer.isView(e.colorLinear))&&(t.colorLinear=Object.freeze(Array.from(e.colorLinear))),(Array.isArray(e.opticalScatteringSourceLinear)||ArrayBuffer.isView(e.opticalScatteringSourceLinear))&&(t.opticalScatteringSourceLinear=Object.freeze(Array.from(e.opticalScatteringSourceLinear))),e.opticalState&&typeof e.opticalState==`object`&&(t.opticalState=Object.freeze({...e.opticalState})),Object.freeze(t)}function $(e,t){if(!(Array.isArray(e)||ArrayBuffer.isView(e))||e.length!==t)return null;let n=Array.from(e,Number);return n.every(Number.isFinite)?n:null}function Xt(e){let t=$(e,16);if(!t)return null;let n=Array.from({length:4},(e,n)=>Array.from({length:8},(e,r)=>r<4?t[r*4+n]:+(r-4===n)));for(let e=0;e<4;e+=1){let t=e;for(let r=e+1;r<4;r+=1)Math.abs(n[r][e])>Math.abs(n[t][e])&&(t=r);let r=n[t][e];if(!Number.isFinite(r)||Math.abs(r)<=1e-12)return null;t!==e&&([n[e],n[t]]=[n[t],n[e]]);for(let t=0;t<8;t+=1)n[e][t]/=r;for(let t=0;t<4;t+=1){if(t===e)continue;let r=n[t][e];if(r!==0)for(let i=0;i<8;i+=1)n[t][i]-=r*n[e][i]}}let r=new Float32Array(16);for(let e=0;e<4;e+=1)for(let t=0;t<4;t+=1){let i=n[e][t+4];if(!Number.isFinite(i))return null;r[t*4+e]=i}return r}function Zt(e){if(e?.collectiveOpticalRoute===!0||e?.collectiveOpticalRouteSchema!=null||e?.collectiveOpticalRouteKey!=null||e?.collectiveOpticalRouteId!=null)return!0;if(e?.opticalStateId==null)return!1;let t=Number(e?.opticalStateId);return!Number.isSafeInteger(t)||t!==0}function Qt(e){let t=e?.participatingMedium??null,n=t?.status??Nt,r=n===Pt&&!!t?.packedFrame,i=Math.max(0,Number(t?.collectiveSurfaceCount)||0);return Object.freeze({schema:Mt,status:n,presentationComposition:i>0?`marching-cubes-isosurfaces-plus-participating-medium`:`marching-cubes-isosurfaces`,marchingCubesSurfaceCount:e?.surfaces?.length??0,collectiveOpticalSurfaceCount:i,participatingMediumAggregateDrawCount:+!!r,collectiveOpticalShellFallbackCount:0,participatingMediumDepthClipped:r,participatingMediumPremultipliedAlpha:r,presentationPassOrder:e?.presentationPassOrder??(r?Rt:Lt)})}function $t(e){let t=Math.max(0,Number(e?.drawMotionAgeS)||0),n=Number(e?.motionPacing?.maxSimulationAgeS)||0;if(!(t>0)||!(n>0))return t;let r=n*.65;return r*(1-Math.exp(-t/r))}function en(e={},t={}){let n=t.metadata||{},r=t.translation?.positionTransform||t.descriptor?.positionTransform||{},i=new Float32Array(44),a=$(e.viewProjectionMatrix,16)||[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];i.set(a,0);let o=$(r.originM,3)||[0,0,0];i.set(o,16),i[19]=Number(r.scaleM)||1;let s=Number.isFinite(Number(r.gridBias))?Number(r.gridBias):-.5;i[20]=s,i[21]=s,i[22]=s;let c=Math.max(0,Number(n.transparencyClassId)||0),l=Math.max(0,Number(n.phaseId)||0),u=Number(n.opticalResponseAuthorityFlag)>0,d=c>.5&&c<1.5||l>2.5&&l<3.5,f=Number(n.opticalEffectiveOpacity);i[23]=u&&d?Math.min(1,Math.max(0,Number.isFinite(f)?f:0)):1;let p=$(n.colorLinear,3)||[.72,.82,.94];i.set(p,24);let m=Number(n.opticalRoughness);if(i[27]=Number.isFinite(m)?Math.min(1,Math.max(.05,m)):c>0?.12:.42,i.set($(e.cameraPositionM,3)||[0,0,0],28),i[31]=Math.max(0,Number(n.emissiveTemperatureK)||0),i[32]=c,i[33]=l,i[34]=Number(n.depthWriteFlag)===0?0:1,i[35]=+!!u,e.motionField?.buffer){let n=new Uint32Array(i.buffer);n[36]=t.descriptor?.fieldOffset??0,n[37]=t.metadata?.resolution??0,n[38]=e.motionField.rowCount,i[40]=$t(e),i[41]=Math.abs(i[19])}return i}function tn(e=[]){let t=(Array.isArray(e)?e:[]).map(e=>e?.metadata??e).filter(Boolean).filter(e=>{let t=Number(e.transparencyClassId)||0,n=Number(e.phaseId)||0;return t>.5&&t<1.5||n>2.5&&n<3.5}),n=t.filter(e=>Number(e.opticalResponseAuthorityFlag)>0),r=n.filter(e=>Number(e.opticalEffectiveOpacity)>0);return Object.freeze({schema:`peercompute.ulg.worker-isosurface-optical-presentation.v0`,status:t.length===0?`no-gas-surfaces`:n.length===t.length?`all-gas-surfaces-closure-governed`:`gas-surface-optical-authority-incomplete`,gasSurfaceCount:t.length,closureGovernedGasSurfaceCount:n.length,visibleClosureGasSurfaceCount:r.length,opticallyThinHiddenGasSurfaceCount:n.length-r.length,allGasSurfacesClosureGoverned:t.length>0&&n.length===t.length,heuristicGasOpacityUsed:t.length>n.length,opticalProvenanceSources:[...new Set(n.map(e=>e.opticalProvenanceSource).filter(Boolean))].sort()})}function nn(e){return{errorName:e instanceof Error?e.name:null,errorMessage:e instanceof Error?e.message:String(e),errorStack:e instanceof Error?String(e.stack||``).slice(0,2e3):null}}function rn(e={}){return Object.freeze({schema:vt,presentationGeometry:wt,sameDevicePresentation:!0,gpuToCpuReadbackBytes:0,fullParticleReadbackPerformed:!1,fullParticleReadbackFree:!0,authoritativeStateMutation:!1,scientificValidation:!1,sphValidation:!1,fullPhysicsValidation:!1,...e})}function an({request:e=null,retained:t=null}={}){let n=e?.surfaceTable,r=$(e?.viewProjectionMatrix,16),i=$(e?.cameraPositionM,3),a=[],o=null;try{o=pt(e?.nativeSurfaceMaterial)}catch{a.push(`native-surface-material`)}return e?.schema!==`peercompute.ulg.worker-offscreen-resident-isosurface-request.v0`&&a.push(`request-schema`),e?.enabled!==!0&&a.push(`request-disabled`),(n?.schema!==Et||!(n?.records instanceof Float32Array)||!Array.isArray(n?.metadata)||n.metadata.length!==Number(n.surfaceCount)||n.surfaceCount<=0||n.totalFieldCells<=0)&&a.push(`surface-table`),r||a.push(`view-projection`),i||a.push(`camera-position`),Number.isFinite(Number(e?.fieldPadding))||a.push(`field-padding`),Number(e?.refEdgeM)>0||a.push(`reference-edge`),(t?.status!==`worker-retained-particle-state-ready`||t?.sameWorkerPrivateReferences!==!0||t?.postMessageTransportAllowed!==!1)&&a.push(`same-worker-retained-authority`),(!t?.sphParticleState||!t?.mlsMpmParticleState||!t?.sphParticleUpload||!t?.mlsMpmParticleUpload||!t?.successorSourceFamily&&t?.executionMode!==`tier0-fused-resident-sequence`)&&a.push(`retained-private-references`),(!Gt(t?.sourceStateBuffer)||!Gt(t?.sourceThermoBuffer)||!Gt(t?.sourceMechanicsBuffer)||!Gt(t?.sourceIdentityBuffer))&&a.push(`retained-gpu-buffers`),Object.freeze({ok:a.length===0,status:a.length===0?`worker-owned-isosurface-admission-ready`:`worker-owned-isosurface-admission-blocked`,reason:a.length===0?null:a.join(`,`),blockers:Object.freeze(a),surfaceCount:Math.max(0,Math.floor(Number(n?.surfaceCount)||0)),totalFieldCells:Math.max(0,Math.floor(Number(n?.totalFieldCells)||0)),particleCount:Math.max(0,Math.floor(Number(t?.particleCount)||0)),viewProjectionMatrix:r,cameraPositionM:i,nativeSurfaceMaterial:o})}function on(e={}){return[e.surfaceIndex??0,e.surfaceKey??``,...e.dims||[],...e.scalarStrides||[],e.scalarOffset??0,e.scalarBufferByteLength??0,e.normalSign??-1,e.scalarType??`f32`].join(`|`)}function sn(e){return C({device:e.device,scalarBuffer:e.scalarBuffer,dims:e.dims,scalarStrides:e.scalarStrides,scalarOffset:e.scalarOffset,bufferByteLength:e.scalarBufferByteLength,scalarType:e.scalarType||`f32`,normalSign:e.normalSign,label:e.label||`ulg-worker-isosurface-${e.surfaceKey||e.surfaceIndex||0}`,source:e.source||`ulg-render-field-density-storage-buffer`})}function cn(e){return e?.extensionExecution||null}function ln(e,t){try{e?.releaseTemperatureRows?.()}catch{}try{e?.translation?.destroyExtensionSurfaceBuffers?.({force:!0,releaseLeases:!0,reason:t})}catch{}try{e?.rawExecution?.result?.release?.()}catch{}try{x(e?.uniformBuffer)}catch{}}function un({device:e,context:t,format:n,depthFormat:r=jt,getDepthView:i,getViewportSize:a=null,drawOverlay:o=null,onTerminal:c=null,onFrameSubmitted:d=null,waitForPresentationOpportunity:f=null,getFramebufferEpoch:_=null,nextPresentationQueueCompletionSerial:v=null,temporalNowMs:x=Q,presentationPauseClock:C=A(),captureRenderRows:E=w,buildRenderField:ne=S,buildPresentationFrame:O=null,createNativeSurfaceMaterial:ie=_t,createParticipatingMediumDescriptor:se=Ge,createParticipatingMediumGpu:ce=qe,encodeParticipatingMediumPack:ge=Ze,encodeParticipatingMediumRender:ve=$e,destroyParticipatingMediumPackedFrame:ye=et}={}){if(!e?.createBuffer||!e?.queue?.submit)throw TypeError(`worker-owned isosurface presenter requires a WebGPU device`);if(!t?.getCurrentTexture||!n)throw TypeError(`worker-owned isosurface presenter requires a configured WebGPU canvas context`);if(typeof i!=`function`)throw TypeError(`worker-owned isosurface presenter requires a depth-view provider`);if(typeof _!=`function`)throw TypeError(`worker-owned isosurface presenter requires a framebuffer-epoch provider`);let M=!1,N=0,P=0,xe=!1,F=null,Se=null,I=null,L=null,R=null,Ce=0,z=!0,B=0,we=new AbortController,Te=null,Ee=null,De=null,V=null,Oe=0,ke=0,Ae=null,je=null,Me=null,Ne=Promise.resolve(),H=null,U=null,Pe=()=>{H?.abort(),U?.abort()},W=null,G=null,K=0,q=null,Fe=new Set,Ie=null,J=0,Le=null,Re=!1,ze=0,Be=new Map,Ve=(e,t,n={})=>{try{c?.(rn({status:t,requestGeneration:e.generation,sourceCapturedBeforePhysicsContinuation:!0,...e.receiptFields,...n,updatedAtMs:Q()}))}catch{}},He=(t,n)=>{if(!t)return;let r=()=>{try{t.destroyRenderRowsBuffer?.({reason:n})}catch{try{t.destroyRenderRowsBuffer?.()}catch{}}};try{y(e,r)}catch{r()}},Ue=e=>!e||e.productEventSourceBorrowReleased?!1:(e.productEventSourceBorrowReleased=!0,e.releaseProductEventSourceBorrow?.()===!0),We=e=>!e||e.dispersedMediumSourceBorrowReleased?!1:(e.dispersedMediumSourceBorrowReleased=!0,e.releaseDispersedMediumSourceBorrow?.()===!0),Ke=e=>{if(!e?.ledgerParcelsBorrow)return;let t=e.ledgerParcelsBorrow;e.ledgerParcelsBorrow=null,t.release()},Y=(t,n)=>{if(!t)return;if(V?.releaseFrame(t),t.motionField){let n=t.motionField;t.motionField=null,y(e,()=>n.destroy())}for(let e of t.surfaces||[])ln(e,n);let r=t.participatingMedium;if(r?.packedFrame&&r.released!==!0){r.released=!0;try{ye(r.packedFrame)}catch{}}},X=t=>{let n=R;R=null,n&&mt(()=>{y(e,()=>Y(n.frame,t))}).catch(()=>{})},Je=t=>{if(t)try{y(e,()=>t.destroy())}catch{t.destroy()}},Ye=()=>(Le||=ce(e,{colorFormat:n,depthFormat:r}),Le),Xe=()=>(V||=ie({device:e,format:n,depthFormat:r,onAppearanceReady(){M||vn({reason:`worker-native-appearance-ready`}).catch(()=>{})}}),V),Qe=async e=>{if(!(!e||e.released)){e.released=!0;try{await e.wrapper?.adapter?.release?.({destroyDevice:!1})}catch{}}},tt=async()=>{let e=[...Be.values()];Be.clear(),await Promise.all(e.map(Qe))},nt=async t=>Ie&&J>=t?Ie:(await tt(),Ie?.destroy?.(),J=Math.max(4,Math.ceil(t)),Ie=e.createBuffer({label:`ulg-worker-owned-isosurface-render-field`,size:J,usage:Wt(`STORAGE`,Ht)|Wt(`COPY_SRC`,zt)|Wt(`COPY_DST`,Bt)}),Ie),rt=async t=>{let n=on(t),r=Be.get(n);if(r&&!r.released&&r.scalarBuffer===t.scalarBuffer)return r;r&&await Qe(r);let i=sn(t),a=te({device:e,volume:i,adapterId:`webgpu-marching-cubes.buffer-volume.v0`,adapterFactory({device:e,volume:t}){return T({device:e,volume:t,adapterId:`webgpu-marching-cubes.buffer-volume.v0`})}}),o={signature:n,scalarBuffer:t.scalarBuffer,volume:i,wrapper:a,released:!1};return Be.set(n,o),o},it=e=>[...e.surfaces||[]].sort((t,n)=>{let r=e=>e.translation?.surfaceDraw?.surfaces?.[0]||e.metadata||{},i=e=>Number.isFinite(Number(r(e).renderOrder))?Number(r(e).renderOrder):Number(r(e).transparencyClassId)||0,a=t=>{let n=$(r(t).boundsCenterM,3),i=$(e.cameraPositionM,3);return n&&i?n.reduce((e,t,n)=>e+(t-i[n])**2,0):0};return i(t)-i(n)||(gt(t)===`opaque`?a(t)-a(n):a(n)-a(t))}),at=null,ot=null,ct=Object.freeze({h2o:[.78,.9,.98],ice:[.78,.9,.98],fe:[.55,.56,.6]}),lt=(t,i)=>{if(i?.solidRigidIsosurfaceSplatted===!0)return!1;let a=i?.solidRigidFamily??p(e);return!a||a.destroyed||a.device!==e||!Array.isArray(i.viewProjectionMatrix)?!1:(at??=_e(e,{colorFormat:n,depthFormat:r}),at.draw(t,a,{viewProjection:Ot(i.viewProjectionMatrix),colorLinear:ct[String(a.materials?.[0]).toLowerCase()]??[.7,.7,.72]}),!0)},ut=(t,i)=>{let a=i?.deformableSolidFamily??s(e);if(!a||a.destroyed||a.device!==e||!Array.isArray(i.viewProjectionMatrix))return!1;ot??=m(e,{colorFormat:n,depthFormat:r});let o=Ot(i.viewProjectionMatrix);for(let e of a.entries)ot.draw(t,e.stage,{viewProjection:o,colorLinear:ct[String(e.material).toLowerCase()]??[.76,.58,.36]});return!0},Z=async(n,{viewProjectionMatrix:r=n.viewProjectionMatrix,cameraPositionM:c=n.cameraPositionM,reason:l=`worker-owned-isosurface-frame`,allowLaggedGeneration:u=!1,requiresVisibleFrame:p=!1,requiresRecoverableFrame:m=!1,playbackRevision:h=null,motionOnly:g=!1,submissionBoundary:y=null,onSubmissionQueued:b=null,submissionDeadlineMs:S=null,expectedFramebufferEpoch:C=null,signal:w=null,motionAgeS:T=n.lastDisplayedMotionAgeS||0}={})=>{let E=!1,D=()=>!!(!M&&w?.aborted!==!0&&(E||S==null||Number.isFinite(S)&&x()<=S)&&(h==null||h===B)&&(!g||z)&&n?.invalidationEpoch===P&&(C==null||Number(_())===C)&&n.generation>=Oe&&(!p||L===n)&&(!m||R?.frame===n)&&(N===n.generation||u===!0));if(!D())return!1;let ee=n.participatingMedium?.status===Pt?n.participatingMedium.packedFrame:null,te=ee?Ye():null;if(await Promise.all([Xe().ready,te?.ready]),!D())return!1;let ne=Te||$(r,16),re=Ee||$(c,3);ne&&(n.viewProjectionMatrix=[...ne]),re&&(n.cameraPositionM=[...re]);let O=Xe(),ie=typeof a==`function`?null:t.getCurrentTexture(),ae=$(typeof a==`function`?a():[ie?.width,ie?.height],2);if(!ae||ae.some(e=>!(e>0)))throw Error(`native material presentation requires a positive viewport`);let k;do if(k=De,n.nativeSurfaceAppearance=k||n.request.nativeSurfaceMaterial,await O.prepare(n,ae),!D())return!1;while(k!==De);Te&&(n.viewProjectionMatrix=[...Te]),Ee&&(n.cameraPositionM=[...Ee]);let oe=Xt(n.viewProjectionMatrix);if(!oe)throw Error(`native material requires an invertible camera`);T=Math.max(T,n.lastDisplayedMotionAgeS||0),n.drawMotionAgeS=T;let se=!Re&&typeof e.pushErrorScope==`function`&&typeof e.popErrorScope==`function`,ce=!1,fe=async()=>ce?(ce=!1,e.popErrorScope()):null,A,j,pe;se&&(e.pushErrorScope(`validation`),ce=!0);try{let r=e.createCommandEncoder({label:`ulg-worker-owned-isosurface-presentation`}),a=t.getCurrentTexture(),c=a.createView(),l=i(),u=it(n),d=[`opaque-isosurface`],f=(e,t,r={})=>{if(O.draw(e,n,t,{inverse:oe,...r})!==!0)throw Error(`native isosurface draw is missing mandatory GPU buffers`)},p=r.beginRenderPass({label:`ulg-worker-owned-isosurface-opaque-pass`,colorAttachments:[{view:c,clearValue:O.clearValue(n),loadOp:`clear`,storeOp:`store`}],depthStencilAttachment:{view:l,depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`store`}});try{O.drawBackground(p,n);let t=n?.deformableSolidFamily??s(e),r=t&&!t.destroyed&&t.device===e&&Array.isArray(n.viewProjectionMatrix)?new Set(t.entries.map(e=>Number(e.domainId)).filter(e=>Number.isFinite(e)&&e>0)):null;for(let e of u)gt(e)===`opaque`&&(r&&Number(e?.metadata?.phaseId)===1&&r.has(Number(e?.metadata?.renderDomainId))||f(p,e));lt(p,n),ut(p,n)}finally{p.end()}let m=u.filter(e=>gt(e)===`refractive`);m.length&&d.push(`refractive-isosurface`);for(let e of m){O.copySceneColor(r,a);let t=r.beginRenderPass({label:`ulg-worker-owned-isosurface-refractive-backface-pass`,colorAttachments:[],depthStencilAttachment:{view:O.backDepthView(),depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`store`}});try{f(t,e,{backface:!0})}finally{t.end()}let n=r.beginRenderPass({label:`ulg-worker-owned-isosurface-refractive-pass`,colorAttachments:[{view:c,loadOp:`load`,storeOp:`store`}],depthStencilAttachment:{view:l,depthLoadOp:`load`,depthStoreOp:`store`}});try{f(n,e,{refractive:!0})}finally{n.end()}}if(ee){d.push(`depth-clipped-participating-medium`);let e=r.beginRenderPass({label:`ulg-worker-owned-participating-medium-pass`,colorAttachments:[{view:c,loadOp:`load`,storeOp:`store`}]});try{await ve(te,e,{packedFrame:ee,inverseViewProjectionMatrix:oe,cameraPositionM:n.cameraPositionM,viewportSize:ae,depthTextureView:l,lightDirection:[.38,.82,.42],motionField:n.motionField,motionAgeS:$t(n)})}finally{e.end()}}d.push(`transparent-isosurface-and-overlay`);let h=r.beginRenderPass({label:`ulg-worker-owned-isosurface-transparent-overlay-pass`,colorAttachments:[{view:c,loadOp:`load`,storeOp:`store`}],depthStencilAttachment:{view:l,depthLoadOp:`load`,depthStoreOp:`discard`}});try{for(let e of u)gt(e)===`vapor`&&f(h,e);o?.(h,n.viewProjectionMatrix,n.boxDimsM)}finally{h.end()}if(pe=Object.freeze(d),!D())return await fe(),!1;if(A=Number(_()),!Number.isSafeInteger(A)||A<=0)throw Error(`worker-owned isosurface framebuffer epoch is unavailable`);let g=r.finish();if(j=Q(),Number(_())!==A||!D())return await fe(),!1;e.queue.submit([g]),E=!0,n.lastSubmittedMotionAgeS=T,Oe=Math.max(Oe,n.generation);let v=ce?await fe():null;if(v)throw Error(v.message||String(v));se&&(Re=!0)}catch(e){try{await fe()}catch{}throw e}if(!D()||Number(_())!==A)return!1;if(typeof e.queue?.onSubmittedWorkDone!=`function`)throw Error(`worker-owned isosurface presentation queue completion is unavailable`);let me=typeof v==`function`?Number(v()):ze+1;if(!Number.isSafeInteger(me)||me<=ze)throw Error(`worker-owned isosurface presentation queue completion serial did not advance`);ze=me;let he=e.queue.onSubmittedWorkDone(),ge=!1;Promise.resolve(he).then(()=>{ge=!0},()=>{});let _e=(()=>{try{if(typeof f!=`function`)throw Error(`worker-owned isosurface presentation opportunity observer is unavailable`);return Promise.resolve(f({afterGpuCompletion:he,isCurrent:()=>D()&&Number(_())===A,signal:w})).then(e=>{if(e?.available===!0&&!ge)throw Error(`worker-owned isosurface presentation opportunity preceded GPU completion`);return e})}catch(e){return Promise.reject(e)}})();if(_e.catch(()=>{}),b?.(),await he,!D()||Number(_())!==A)return!1;let ye=Q(),be=await _e,xe=be?.available===!1&&be.method===`worker-request-animation-frame-timeout`;if(!xe&&(!D()||Number(_())!==A))return!1;if(be?.available!==!0)throw new(xe?Ut:Error)(`worker-owned isosurface lacked a post-GPU presentation opportunity`);let F=Number.isFinite(Number(be.observedAtMs))?Number(be.observedAtMs):Q(),Se=tn(n.opticalMetadataSnapshots||n.surfaces);n.presentationPassOrder=pe;let I=Qt(n),Ce=Object.freeze({presentationFrameSchema:Tt,presentationFrameStatus:`worker-owned-isosurface-presentation-opportunity`,presentationFrameAdmitted:!0,nativeMaterialShader:`existing-native-compact-surface-with-retained-motion`,condensedDepthTestEnabled:!0,condensedDepthWriteEnabled:!0,vaporDepthTestEnabled:!0,vaporDepthWriteEnabled:!1,isosurfaceTemporalPresentation:T>0,isosurfacePresentationMotionAgeS:T,isosurfacePresentationSourceTimeS:n.sourceTimeS??null,isosurfacePresentationMotionMethod:T>0?`bounded-gpu-field-velocity-extrapolation`:`committed-source-mesh`,presentationOnly:T>0,authoritativeStateMutation:!1,presentationFrameGpuCompleted:!0,presentationFrameGpuCompletionMethod:`worker-device.queue.onSubmittedWorkDone`,presentationFramePresentationOpportunity:!0,presentationFramePresentationOpportunityMethod:be.method??null,presentationFrameSubmitToGpuCompleteMs:Math.max(0,ye-j),presentationFrameSubmitToPresentationOpportunityMs:Math.max(0,F-j),presentationQueueCompletionCount:ze,presentationQueueCompletionSerial:me,presentationQueueCompletionMethod:`worker-device.queue.onSubmittedWorkDone`,presentationQueueCompletionScope:le,physicsQueuePrefixCoverage:y?ue:de,physicsHostQueueFenceParticipation:y?!0:null,...y?{physicsContinuationBlocked:!0,presentationQosHostQueueFenceCount:1,motionPresentationQosBoundary:y}:{},workerFramebufferEpoch:A,workerOwnedOpticalPresentation:Se,workerOwnedParticipatingMediumPresentation:I,presentationComposition:I.presentationComposition,marchingCubesSurfaceCount:I.marchingCubesSurfaceCount,collectiveOpticalSurfaceCount:I.collectiveOpticalSurfaceCount,participatingMediumStatus:I.status,participatingMediumAggregateDrawCount:I.participatingMediumAggregateDrawCount,collectiveOpticalShellFallbackCount:I.collectiveOpticalShellFallbackCount,participatingMediumDepthClipped:I.participatingMediumDepthClipped,participatingMediumPremultipliedAlpha:I.participatingMediumPremultipliedAlpha,presentationPassOrder:I.presentationPassOrder});n.lastDisplayedMotionAgeS=T;try{d?.({reason:l,generation:n.generation,surfaceCount:n.totalSurfaceCount??n.surfaces.length,sphStep:n.sphStep,...Ce})}catch{}return Ce},dt=0,ft=0,pt=null,mt=e=>{ft+=1;let t=Ne.then(e);return Ne=t.then(e=>{--ft,e&&(pt=x())},()=>{--ft}),t},ht=()=>pt==null||x()-pt>33.333333333333336,yt=(e,t)=>mt(()=>Z(e,t)),wt=e=>{if(M||!z||L!==e||!e?.motionField?.buffer||!e.motionPacing||e.invalidationEpoch!==P||e.generation<Oe)return!1;let t=j(e.motionPacing,x());return t>(e.lastDisplayedMotionAgeS||0)&&t<e.motionPacing.maxSimulationAgeS},Et=({waitForPendingSlot:e=!1}={})=>typeof e!=`boolean`||U||!ht()&&(H||ft>0)?!1:(e||!H)&&wt(L),Dt=()=>{ke+=1,Ae!=null&&globalThis.clearTimeout(Ae),Ae=null,je?.(),je=null},Mt=e=>{if(Dt(),!z||!e?.motionField?.buffer||!e.motionPacing)return;let t=ke,n=B,r=we.signal,i=()=>!M&&L===e&&z&&n===B&&e.invalidationEpoch===P&&ke===t,a=Symbol(`coalesced-isosurface-temporal-frame`),o=!1;(async()=>{for(;i();){let t=x(),s=j(e.motionPacing,t);if(s==null||o&&s>=e.motionPacing.maxSimulationAgeS)return;if(s>(e.lastDisplayedMotionAgeS||0)){let t;try{t=await mt(()=>{if(!i())return!1;let t=j(e.motionPacing,x());return t==null||o&&t>=e.motionPacing.maxSimulationAgeS?!1:t>(e.lastDisplayedMotionAgeS||0)?Z(e,{reason:`worker-owned-isosurface-temporal-presentation`,allowLaggedGeneration:!0,requiresVisibleFrame:!0,playbackRevision:n,motionOnly:!0,signal:r,motionAgeS:t}):a})}catch(n){if(!(n instanceof Ut))throw n;if(!i())return;e.temporalPresentationError=n.message;let r=j(e.motionPacing,x());if(!Number.isFinite(r)||r>=e.motionPacing.maxSimulationAgeS)return;o=!0,t=a}if(!t||!i())return;t!==a&&(o=!1,e.temporalPresentationError=null,Nt(e,`presentation-only retained GPU field motion`,t))}if((e.lastDisplayedMotionAgeS||0)>=e.motionPacing.maxSimulationAgeS)return;let c=1e3/e.motionPacing.targetHz-(x()-t);c>0&&i()&&await new Promise(e=>{je=e,Ae=globalThis.setTimeout(()=>{Ae=null,je=null,e()},c)})}})().catch(t=>{i()&&(e.temporalPresentationError=String(t?.message||t))})},Nt=(e,t,n)=>{let i=Qt(e),a=e.surfaces.length+i.participatingMediumAggregateDrawCount;Ve({generation:e.generation,receiptFields:e.receiptFields},xt,{reason:t,surfaceCount:e.totalSurfaceCount??e.surfaces.length,submittedSurfaceCount:a,activeSurfaceCount:null,indirectDrawCount:a,depthAttachmentFormat:r,depthAttachmentReady:!0,boxWireframeDrawCount:+!!e.boxDimsM,boxDimsM:e.boxDimsM?[...e.boxDimsM]:null,nonemptySurfaceCountMode:`gpu-indirect-not-read-back`,triangleCountMode:`gpu-indirect-not-read-back`,readbackMode:kt,...n})},Lt=(t,n,r,i)=>{let a=t.ledgerParcelsBorrow?.parcels??null;if(!a||a.device!==e||globalThis.__ulgDisableLedgerParcelOptics)return null;let o=r.surfaceTable.metadata,s=i.consumedSurfaceIndices.find(e=>Number(o[e]?.materialId)===a.vaporMaterialId),c=s==null?null:o[s],l=globalThis.__ulgLedgerParcelOptics??={frames:0,routed:0,unrouted:0};return l.frames++,c?(l.routed++,be({device:e,encoder:n,parcels:a,fieldRowsBuffer:i.fieldRowsBuffer,fieldOffset:Number(c.fieldOffset),resolution:Number(c.resolution),fieldPadding:Number(r.fieldPadding),refEdgeM:Number(r.refEdgeM)})):(l.unrouted++,null)},Rt=async(t,n)=>{if((n?.dispersedMediumOptics??null)!==t.dispersedMediumOptics)throw TypeError(`worker-owned isosurface capture did not retain its exact dispersed-medium sidecar`);let r=await nt(t.request.surfaceTable.totalFieldCells*D*Float32Array.BYTES_PER_ELEMENT),i=t.productEvents,a=await ne({device:e,renderRows:n.renderRows,renderRowsBuffer:n.renderRowsBuffer,renderRowsSource:n,dispersedMediumOptics:t.dispersedMediumOptics,schroederSpatialSourceFamily:n.schroederSpatialSourceFamily,surfaceTable:t.request.surfaceTable,particleCount:n.particleCount,productEventBuffer:i.productEventBuffer,productEventSource:i.productEventSource,productEventCount:i.productEventCount,productEventLiveCountDescriptor:i.productEventLiveCountDescriptor,fieldPadding:Number(t.request.fieldPadding),refEdgeM:Number(t.request.refEdgeM),renderSmearDtS:Math.max(0,Number(t.request.renderSmearDtS)||0),readbackMode:kt,retainFieldRowsBuffer:!0,retainMotionFieldBuffer:!0,retainSurfaceBuffer:!1,waitForQueueCompletion:!1,deferCleanup:!0,targetFieldRowsBuffer:r,targetFieldRowsBufferByteLength:J});Ue(t),We(t),He(n,`worker-isosurface-render-field-submitted`),t.capturedReleased=!0;let o=a.surfaceTable.metadata.map(Yt),s=o.map((t,n)=>ee({device:e,renderField:a,surface:a.surfaceTable.metadata[n],surfaceIndex:n})),c=s.find(e=>e?.ok!==!0);if(c)throw a.destroyRenderFieldBuffers?.({force:!0,releaseLeases:!0,reason:`worker-isosurface-descriptor-blocked`}),Error(c.reason||c.status);let l,u,d=null,f=new Set,p;try{if(l=Object.freeze(s.map((e,t)=>Object.freeze({descriptor:e,metadata:o[t]}))),u=o.map((e,t)=>Zt(e)?t:-1).filter(e=>e>=0),u.length>0){d=se({device:e,renderField:a,surfaceDescriptors:u.map(e=>l[e])});let t=d?.status;if(![Pt,Ft,It].includes(t))throw TypeError(`participating-medium descriptor returned an unknown route status`);let n=d.consumedSurfaceIndices;if(!Array.isArray(n))throw TypeError(`participating-medium descriptor omitted consumed surface indices`);f=new Set(n);let r=new Set(u);if(!(f.size===r.size&&[...f].every(e=>Number.isSafeInteger(e)&&r.has(e))))throw TypeError(`participating-medium descriptor did not consume the exact collective optical route set`)}p=s.filter((e,t)=>!f.has(t))}catch(e){throw a.destroyRenderFieldBuffers?.({force:!0,releaseLeases:!0,reason:`worker-participating-medium-descriptor-failed`}),e}let m=e.createCommandEncoder({label:`ulg-worker-owned-isosurface-marching-cubes`}),h=[],_=[],v=null,x=null,S=null,C=t.solidRigidFamily??null,w=!1;try{C&&(S=oe({device:e,encoder:m,family:C,renderField:a}),w=!!S);for(let n of p){let r=await rt(n);re({device:e,descriptor:n,volume:r.volume});let i=await r.wrapper.extractSurface({volume:r.volume,isovalue:n.isovalue,ownsBuffer:!0,readbackMode:At,vertexRowsBudget:Math.max(3,Math.floor(Number(t.request.vertexRowsBudget)||3)),commandEncoder:m}),a=cn(i);if(a?.ok===!1||!a?.result)throw Error(i?.reason||a?.status||`worker-owned marching-cubes extraction failed`);let o={descriptor:n,wrapped:i,rawExecution:a,temperatureRows:null};h.push(o);let s=a.result,c=s.outputDescriptors?.rows?.position||s.rowMetadata?.position,l=c?.buffer||s.outputDescriptors?.retainedBuffers?.position||s.buffer,u=s.actualVertexCounterBuffer||s.vertexCounterBuffer;o.temperatureRows=ae({device:e,commandEncoder:m,compactPositions:{buffer:l,byteLength:c?.bufferByteLength??s.bufferByteLength??l?.size,rowCount:c?.rowCount??s.vertexCount,strideFloats:c?.rowStrideFloats??s.vertexStrideFloats,surfaceGenerationId:s.surfaceGenerationId,volumeGenerationId:s.volumeGenerationId},actualVertexCounter:{buffer:u,byteLength:s.actualVertexCounterBufferByteLength??s.vertexCounterBufferByteLength??u?.size},renderField:{buffer:n.scalarBuffer,byteLength:n.scalarBufferByteLength,dims:n.dims,scalarStrides:n.scalarStrides,scalarOffsetFloats:n.scalarOffset,volumeGenerationId:s.volumeGenerationId},generation:{surfaceGenerationId:s.surfaceGenerationId,volumeGenerationId:s.volumeGenerationId}})}if(d?.status===Pt&&(x=Lt(t,m,a,d),v=await ge(Ye(),m,d),v?.status!==`participating-medium-packed-gpu-resident`||v.readback!==!1))throw TypeError(`participating-medium pack did not return an exact GPU-resident no-readback frame`);if(e.queue.submit([m.finish()]),S||x){let t=S,n=x;S=null,x=null,y(e,()=>{t?.destroy?.(),n?.destroy?.()})}for(let e of h)e.rawExecution.result?.retireTemporaryResourcesAfterSubmit?.();let n=[];for(let t of h){let r=t.descriptor,i=o[r.surfaceIndex],s=await k({device:e,extensionExecution:t.rawExecution,schroederSpatialSourceFamily:a.schroederSpatialSourceFamily,surfaceIndex:r.surfaceIndex,materialId:i.materialId,phaseId:i.phaseId,opticalStateId:i.opticalStateId,material:i.material,phase:i.phase,renderKey:i.renderKey,surfaceKey:i.surfaceKey,isolation:r.isovalue,transparencyClassId:i.transparencyClassId,depthWriteFlag:i.depthWriteFlag,renderOrder:i.renderOrder,positionTransform:r.positionTransform,positionTransformResolution:i.resolution,sourceVoxelLinearIndex:r.fieldOffset,fieldPadding:a.fieldPadding,refEdgeM:a.refEdgeM,positionGridBias:r.positionTransformGridBias,fieldGradient:{buffer:r.scalarBuffer,scalarOffsetFloats:r.scalarOffset,rowStrideFloats:r.cellRowStrideFloats,resolution:i.resolution},readbackMode:kt,compactSummaryReadback:!1,translateVertexRows:!1,allowExtensionDrawIndirectBuffer:!0,retainVertexRowsBuffer:!0,retainDrawRowsBuffer:!0,retainDrawIndirectRowsBuffer:!0,waitForQueueCompletion:!1}),c=Wt(`UNIFORM`,Vt)|Wt(`COPY_DST`,Bt),l=typeof globalThis.GPUDevice==`function`&&e instanceof globalThis.GPUDevice?b(g(e,{bucketKey:`ulg-worker-owned-isosurface-uniform`,label:`ulg-worker-owned-isosurface-uniform-${r.surfaceIndex}`,size:st,usage:c}),e,{bucketKey:`ulg-worker-owned-isosurface-uniform`,size:st,usage:c}):e.createBuffer({label:`ulg-worker-owned-isosurface-uniform-${r.surfaceIndex}`,size:st,usage:c}),u=t.temperatureRows;s.nativeSurfaceTemperatureRows=u,Object.assign(s.surfaceDraw,{compactTemperatureRowsBuffer:u.temperatureRowsBuffer,compactTemperatureRowsBufferRetained:!0,compactTemperatureRowsBufferByteLength:u.temperatureRowsBufferByteLength,compactTemperatureRowsBufferRowCount:u.temperatureRowsBufferRowCount,compactTemperatureRowsStrideFloats:u.temperatureRowsStrideFloats,compactTemperatureRowsSchema:u.temperatureRowsSchema,compactTemperatureRowsLayoutName:u.temperatureRowsLayoutName,compactTemperatureRowsEncoding:u.encoding,compactTemperatureRowsSemantic:u.semantic,compactTemperatureRowsSurfaceGenerationId:u.surfaceGenerationId,compactTemperatureRowsVolumeGenerationId:u.volumeGenerationId,compactTemperatureRowsCoverageSchema:u.coverage.schema,compactTemperatureRowsCoverageComplete:u.coverage.complete,compactTemperatureRowsCoverageRowCount:u.coverage.rowCount,compactTemperatureRowsOwnership:u.temperatureRowsOwnership,compactTemperatureRowsAdditionalSubmitCount:0}),n.push({descriptor:r,metadata:i,translation:s,rawExecution:t.rawExecution,uniformBuffer:l,releaseTemperatureRows:()=>Je(u),bindGroups:new Map}),_.push(n[n.length-1])}let r=a.takeMotionField?.()||null;return a.destroyRenderFieldBuffers?.({force:!0,releaseLeases:!0,reason:`worker-isosurface-extraction-submitted`}),{generation:t.generation,invalidationEpoch:t.invalidationEpoch,sphStep:t.sphStep,sourceTimeS:t.sourceTimeS,motionField:r,request:t.request,receiptFields:t.receiptFields,viewProjectionMatrix:[...t.admission.viewProjectionMatrix],cameraPositionM:[...t.admission.cameraPositionM],boxDimsM:$(t.request.boxDimsM,3),totalSurfaceCount:o.length,opticalMetadataSnapshots:o,participatingMedium:d?{status:d.status,reason:d.reason??null,collectiveSurfaceCount:u.length,consumedSurfaceCount:f.size,packedFrame:v,released:!1}:null,solidRigidFamily:C??null,solidRigidIsosurfaceSplatted:w,surfaces:n}}catch(e){S?.destroy(),x?.destroy(),a.destroyRenderFieldBuffers?.({force:!0,releaseLeases:!0,reason:`worker-isosurface-extraction-failed`});for(let e of _)ln(e,`worker-isosurface-partial-translation-failed`);let t=new Set(_.map(e=>e.rawExecution));for(let e of h)if(!t.has(e.rawExecution)){e.temperatureRows&&Je(e.temperatureRows);try{e.rawExecution?.result?.release?.()}catch{}}if(v)try{ye(v)}catch{}throw e}},Gt=(t,n,r,i)=>{let a=L;L=t,L.sourcePresentedAtMs=x(),L.sourcePresentationPausedWallMs=C.pausedAt(L.sourcePresentedAtMs);let o=a?a.sourcePresentationPausedWallMs:t.sourceTimingPausedWallMs;L.motionPacing=fe(L,a,L.sourcePresentedAtMs,n,{pausedWallDeltaMs:o==null?NaN:L.sourcePresentationPausedWallMs-o}),Mt(L),a&&y(e,()=>{Y(a,`worker-isosurface-replaced`)}),Nt(L,r,i)},en=async()=>{if(!(xe||M)){xe=!0;try{for(;I&&!M;){let e=I;I=null,Se=e;let t=null,n=null;try{if(t=await e.capturePromise,e.invalidationEpoch!==P||M){Ve(e,Ct,{reason:`the worker-owned isosurface presentation was invalidated`});continue}if(n=await(O??Rt)(e,t),n.request=e.request,n.sourceTimeS=e.sourceTimeS,n.sourceTimingPausedWallMs=e.sourceTimingPausedWallMs,e.invalidationEpoch!==P||M)if(!M&&e.invalidationEpoch!==P&&N===e.generation&&q===P)e.invalidationEpoch=P,n.invalidationEpoch=P;else{Y(n,`worker-isosurface-superseded-before-presentation`),n=null,Ve(e,Ct,{reason:`the worker-owned isosurface presentation was invalidated`});continue}if(L&&L.generation>=n.generation){Y(n,`worker-isosurface-older-than-visible-frame`),n=null,Ve(e,Ct,{reason:`a newer isosurface generation is already visible`});continue}let r=!1,i=()=>!M&&Se===e&&N===e.generation,a=async e=>{for(;;)try{return await mt(()=>r&&!i()?!1:Z(n,{reason:e,allowLaggedGeneration:!r}))}catch(e){if(!(e instanceof Ut))throw e;if(!i())return!1;if(r)throw e;r=!0}},o=await a(`committed-worker-isosurface`);for(;!o?.presentationFrameAdmitted&&n.invalidationEpoch!==P&&N===e.generation&&q===P&&P>n.invalidationEpoch&&!M;){let t=P;e.invalidationEpoch=t,n.invalidationEpoch=t,o=await a(`committed-worker-isosurface-after-resize`)}if(!o?.presentationFrameAdmitted){if(n.invalidationEpoch!==P||M||N!==e.generation){Y(n,`worker-isosurface-invalidated-during-presentation`),n=null,Ve(e,Ct,{reason:`the worker-owned isosurface presentation was invalidated during submit`});continue}throw Error(`worker-owned isosurface frame was not current at submit`)}Gt(n,e.sourceTimingBootstrap,`same-device retained state rendered as true isosurface`,o),n=null}catch(t){t instanceof Ut&&n&&!M&&n.generation===N&&n.generation===Oe&&n.invalidationEpoch===P&&(X(`worker-isosurface-recovery-replaced`),R=Object.freeze({frame:n,sourceTimingBootstrap:e.sourceTimingBootstrap,parkedAfterRedrawSequence:Ce}),n=null),n&&Y(n,`worker-isosurface-build-failed`),Ve(e,St,{reason:t instanceof Error?t.message:String(t),...nn(t)})}finally{t&&!e.capturedReleased&&He(t,`worker-isosurface-capture-retired`),Ue(e),We(e),Ke(e),Se=null}}}finally{xe=!1}}},un=()=>{if(F||M)return;let e=en();F=e,e.finally(()=>{F===e&&(F=null),I&&!M&&un()})},dn=(e,t)=>{e&&(Ue(e),We(e),Ke(e),e.capturePromise.then(e=>{He(e,`worker-isosurface-queued-job-superseded`)}).catch(()=>{}),Ve(e,Ct,{reason:t}))},fn=()=>{G&&=(G.resolve(!1),null)},pn=()=>{for(let e of Fe)e();Fe.clear()},mn=()=>{K=Math.max(0,K-1),K===0&&pn()},hn=()=>K===0?Promise.resolve():new Promise(e=>Fe.add(e)),gn=async()=>{for(;G&&!M;){let e=G.allowCandidateRecovery&&G.requestSequence>(R?.parkedAfterRedrawSequence??1/0)&&R?.frame.generation===N&&R.frame.generation===Oe&&R.frame.invalidationEpoch===P?R:null,t=e||L&&L.invalidationEpoch===P&&L.generation>=Oe;if(!t){if(F){await F.catch(()=>{});continue}if(K>0){await hn();continue}}let n=G;G=null;let r=e?.frame||L;if(!t){n.resolve(!1);continue}try{let t=await yt(r,{...n.options,allowLaggedGeneration:!e,requiresVisibleFrame:!e,requiresRecoverableFrame:!!e});if(e&&t&&R===e&&r.generation===N&&r.invalidationEpoch===P&&!M){R=null,Gt(r,e.sourceTimingBootstrap,n.options.reason,t),n.resolve(!0);continue}let i=!!(!e&&t&&L===r&&r.invalidationEpoch===P&&r.generation>=Oe&&!M);if(i)Nt(r,n.options.reason,t);else if(!M&&!G&&(Se||I||K>0)){G=n;continue}n.resolve(i)}catch(t){e&&R?.frame.generation===e.frame.generation&&!(t instanceof Ut)&&X(`worker-isosurface-recovery-failed`),n.reject(t)}}},_n=()=>{if(W||M||!G)return;let e=gn();W=e,e.finally(()=>{W===e&&(W=null),_n()})},vn=(e,{allowCandidateRecovery:t=!1}={})=>{if(M)return Promise.resolve(!1);let n=++Ce,r=$(e?.viewProjectionMatrix,16),i=$(e?.cameraPositionM,3);if(r&&(Te=[...r]),i&&(Ee=[...i]),e?.nativeSurfaceAppearance!=null&&(De=structuredClone(e.nativeSurfaceAppearance)),M||!L&&!R&&K===0&&!Se&&!I)return Promise.resolve(!1);let a,o,s=new Promise((e,t)=>{a=e,o=t});return fn(),G={options:e,allowCandidateRecovery:t,requestSequence:n,resolve:a,reject:o},_n(),s};return Object.freeze({async enqueue({request:t,retained:n,sphStep:r=null,receiptFields:i={},sourceTimingBootstrap:a=null}={}){if(M)return rn({status:St,reason:`worker-owned isosurface presenter is disposed`,...i});let o=an({request:t,retained:n});if(!o.ok)return rn({status:St,reason:o.reason,admission:o,...i});t={...t,nativeSurfaceMaterial:o.nativeSurfaceMaterial},N+=1,X(`worker-isosurface-recovery-superseded`);let s=N,c=n.sphParticleUpload?.time,d=typeof c==`number`&&Number.isFinite(c)?c:null;a=he(a);let f=a?C.pausedAt(a.sourceObservedAtMs):null,p=P,m,g=null,_=null,v=null;try{let t=Jt(e,n.sphParticleUpload);v=t?.sidecar??null,_=t?.release??null,m=Kt({device:e,retained:n}),g=qt(m.productEventSource)}catch(e){return _?.(),g?.(),rn({status:St,reason:e instanceof Error?e.message:String(e),requestGeneration:s,sourceCapturedBeforePhysicsContinuation:!1,admission:o,...i,...nn(e),updatedAtMs:Q()})}let y;K+=1;try{y=await E({device:e,sphParticleState:n.sphParticleState,mlsMpmParticleState:n.mlsMpmParticleState,sphParticleUpload:n.sphParticleUpload,mlsMpmParticleUpload:n.mlsMpmParticleUpload,sourceStateBuffer:n.sourceStateBuffer,sourceThermoBuffer:n.sourceThermoBuffer,sourceIdentityBuffer:n.sourceIdentityBuffer,sourceMechanicsBuffer:n.sourceMechanicsBuffer,schroederSpatialSourceFamily:n.successorSourceFamily,retainRenderRowsBuffer:!0,readbackMode:kt})}catch(e){return mn(),g?.(),_?.(),rn({status:St,reason:e instanceof Error?e.message:String(e),requestGeneration:s,sourceCapturedBeforePhysicsContinuation:!1,admission:o,...i,...nn(e),updatedAtMs:Q()})}if(mn(),(y?.dispersedMediumOptics??null)!==v)return g?.(),_?.(),He(y,`worker-isosurface-dispersed-medium-capture-mismatch`),rn({status:St,reason:`worker-owned isosurface capture did not retain its exact dispersed-medium sidecar`,requestGeneration:s,sourceCapturedBeforePhysicsContinuation:!0,admission:o,...i,updatedAtMs:Q()});let b=!!(M||p!==P),x=!!(!M&&b&&N===s&&q===P);if(b&&!x)return g?.(),_?.(),He(y,`worker-isosurface-capture-invalidated-before-enqueue`),rn({status:Ct,reason:`worker-owned isosurface source capture was invalidated before enqueue`,requestGeneration:s,sourceCapturedBeforePhysicsContinuation:!0,admission:o,...i,updatedAtMs:Q()});let S={sourceTimeS:d,sourceTimingBootstrap:a,sourceTimingPausedWallMs:f,generation:s,request:t,retained:n,admission:o,sphStep:r,receiptFields:i,productEvents:m,dispersedMediumOptics:v,ledgerParcelsBorrow:l(n.sphParticleUpload),solidRigidFamily:h(n.sphParticleUpload)??(n.sphParticleState?.rigidBodies?u(n.sphParticleUpload,n.sphParticleState.rigidBodies,e):null),releaseProductEventSourceBorrow:g,productEventSourceBorrowReleased:!1,releaseDispersedMediumSourceBorrow:_,dispersedMediumSourceBorrowReleased:!1,capturePromise:Promise.resolve(y),invalidationEpoch:x?P:p,capturedReleased:!1};return I&&dn(I,`a newer committed isosurface request replaced this queued request`),I=S,un(),rn({status:bt,reason:`exact committed retained source capture submitted before continuation`,requestGeneration:s,sourceCapturedBeforePhysicsContinuation:!0,surfaceCount:o.surfaceCount,totalFieldCells:o.totalFieldCells,particleCount:o.particleCount,readbackMode:kt,...i,updatedAtMs:Q()})},setPresentationPlaying(e){if(typeof e!=`boolean`)throw TypeError(`presentation playing must be a boolean`);if(M||e===z)return!1;let t=x();return C.setPlaying(e,t),z=e,B+=1,we.abort(),we=new AbortController,Dt(),e?L?.motionPacing&&(L.motionPacing=pe(L.motionPacing,t,L.lastDisplayedMotionAgeS||0),Mt(L)):L&&L.lastSubmittedMotionAgeS>(L.lastDisplayedMotionAgeS||0)&&vn({reason:`worker-isosurface-pause-frozen-redraw`,playbackRevision:B}).catch(()=>{}),!0},async redraw({viewProjectionMatrix:e=null,cameraPositionM:t=null,nativeSurfaceAppearance:n=null,reason:r=`worker-owned-isosurface-camera-redraw`}={}){return vn({viewProjectionMatrix:e,cameraPositionM:t,nativeSurfaceAppearance:n,reason:r},{allowCandidateRecovery:!0})},beginPendingSourceProgress({scheduleId:e,laneId:t,stateKey:n,presentationLaneEpoch:r,sourceTimeS:i,totalStepCount:a}={}){let o=++dt,s=P,c=x(),l=C.pausedAt(c);if(M||typeof e!=`string`||!e.trim()||typeof t!=`string`||!t.trim()||typeof n!=`string`||!n.trim()||!Number.isSafeInteger(r)||r<=0||typeof i!=`number`||!Number.isFinite(i)||i<0||!Number.isSafeInteger(a)||a<=1||!Number.isFinite(c)||c<0)return null;let u=null,d=0,f=c,p=!1;return m=>{if(p||M||!z||o!==dt||s!==P||u&&L!==u||m?.scheduleId!==e)return!1;let h=m.stepOrdinal,g=x();if(!Number.isSafeInteger(h)||h<=d||h>a||m.completedStepCount!==h||!Number.isFinite(g)||g<f)return!1;if(d=h,f=g,h===a)return p=!0,!1;if(!u){let e=L;if(!e?.motionField?.buffer||!e.motionPacing||e.invalidationEpoch!==s||e.sourceTimeS!==i||e.receiptFields?.laneId!==t||e.receiptFields?.stateKey!==n||e.receiptFields?.presentationLaneEpoch!==r)return!1;u=e}let _=(g-c-(C.pausedAt(g)-l))/1e3*(a-h)/h,v=me(u.motionPacing,g,_,u.lastDisplayedMotionAgeS||0);return v===u.motionPacing?!1:(u.motionPacing=v,!0)}},hasSubmissionBoundaryOpportunity(){let e=L;return M||!z||!e?.motionField?.buffer||!e.motionPacing||e.invalidationEpoch!==P?!1:j(e.motionPacing,x())>(e.lastDisplayedMotionAgeS||0)},hasRetainedSubmissionGapOpportunity:Et,presentRetainedSubmissionGap({signal:e=null,waitForPendingSlot:t=!1}={}){if(e?.aborted||!Et({waitForPendingSlot:t}))return Promise.resolve(!1);let n=L,r=P,i=Number(_());if(!Number.isSafeInteger(i)||i<=0)return Promise.resolve(!1);let a=x()+1e3/60,o=H,s=new AbortController,c=AbortSignal.any([s.signal,we.signal,...e?[e]:[]]),l=B,u,d=!1,f=new Promise(e=>{u=e}),p,m=new Promise(e=>{p=e}),h,g={abort:()=>s.abort(),completed:new Promise(e=>{h=e})},v=null,y=e=>{d||(d=!0,globalThis.clearTimeout(v),u(e))},b=()=>{y(!1),p(!1)};c.addEventListener(`abort`,b,{once:!0});let S=e=>{y(!1),c.removeEventListener(`abort`,b),H===g&&(H=null),U===g&&(U=null),h(e===!0&&!c.aborted)},C=()=>!c.aborted&&!M&&z&&l===B&&P===r&&L===n&&n.invalidationEpoch===r&&Number(_())===i&&x()<=a;v=globalThis.setTimeout(()=>s.abort(),1e3/60);let w=()=>{try{if(!C()||H||!wt(n)){S(!1);return}U===g&&(U=null),H=g,mt(async()=>{if(!C()||!wt(n))return!1;let e=await Z(n,{reason:`worker-owned-isosurface-retained-submission-gap`,allowLaggedGeneration:!0,requiresVisibleFrame:!0,playbackRevision:l,motionOnly:!0,signal:c,motionAgeS:j(n.motionPacing,x()),submissionDeadlineMs:a,expectedFramebufferEpoch:i,onSubmissionQueued:()=>y(!0)});return e&&Nt(n,`presentation-only retained mesh between physics submissions`,e),e}).then(e=>S(!!e),()=>S(!1))}catch{S(!1)}};return o?(U=g,Promise.race([o.completed,m]).then(e=>{e===!0?w():S(!1)},()=>S(!1))):w(),f},presentSubmissionBoundary(e,{signal:t=null}={}){if(t?.aborted||M||!z||!e||![`submissionOrdinal`,`completedSubstepCount`,`totalSubstepCount`,`chunkStepCount`].every(t=>Number.isSafeInteger(e[t])&&e[t]>0)||e.completedSubstepCount>=e.totalSubstepCount||e.chunkStepCount>e.completedSubstepCount)return Promise.resolve(!1);let n=Object.freeze({...e}),r=B,i=t?AbortSignal.any([t,we.signal]):we.signal;return mt(async()=>{if(i.aborted||r!==B)return!1;let e=L;if(!e?.motionField?.buffer||!e.motionPacing)return!1;let t=j(e.motionPacing,x());if(!(t>(e.lastDisplayedMotionAgeS||0)))return!1;let a=await Z(e,{reason:`worker-owned-isosurface-submission-boundary`,allowLaggedGeneration:!0,requiresVisibleFrame:!0,motionAgeS:t,submissionBoundary:n,signal:i,playbackRevision:r,motionOnly:!0});return a?(Nt(e,`presentation-only retained mesh at submission boundary`,a),a):!1})},async resize({viewProjectionMatrix:e=null,cameraPositionM:t=null,reason:n=`worker-owned-isosurface-presentation-resize`}={}){if(M)return!1;Pe(),Dt();let r=P;if(P+=1,q=P,R){let e=R,t=e.frame;if(t.generation===N&&t.invalidationEpoch===r){let n={...t,invalidationEpoch:P};R=Object.freeze({...e,frame:n}),mt(()=>{V?.transferFrame(t,n),t.surfaces=[],t.participatingMedium=null,t.motionField=null}).catch(()=>{R?.frame.generation===n.generation&&X(`worker-isosurface-recovery-resize-transfer-failed`)})}else X(`worker-isosurface-recovery-resize-invalidated`)}if(L&&!(K>0||Se||I||R)){let e=L;L={...e,invalidationEpoch:P,surfaces:e.surfaces},V?.transferFrame(e,L),e.surfaces=[],e.participatingMedium=null,e.motionField=null}let i=await vn({viewProjectionMatrix:e,cameraPositionM:t,reason:n},{allowCandidateRecovery:!0});return i&&Mt(L),i},clear({reason:t=`worker-owned-isosurface-presentation-clear`}={}){if(M)return!1;Pe(),Dt(),P+=1,q=null,N+=1,X(t),Te=null,Ee=null,De=null,fn(),dn(I,t),I=null;let n=L;return L=null,n&&y(e,()=>{Y(n,t)}),!0},getStatus(){let e=Qt(L);return Object.freeze({schema:vt,status:M?`worker-owned-isosurface-presenter-disposed`:`worker-owned-isosurface-presenter-ready`,generation:N,presentationPlaying:z,presentationPlaybackRevision:B,running:xe,activeGeneration:Se?.generation??null,queuedGeneration:I?.generation??null,visibleGeneration:L?.generation??null,recoverableGeneration:R?.frame.generation??null,recoverableSphStep:R?.frame.sphStep??null,visibleSphStep:L?.sphStep??null,visibleSourceTimeS:L?.sourceTimeS??null,temporalMotionReady:!!(L?.motionField?.buffer&&L?.motionPacing),temporalMotionAgeS:L?.lastDisplayedMotionAgeS||0,temporalPresentationError:L?.temporalPresentationError||null,visibleSurfaceCount:L?.totalSurfaceCount??L?.surfaces?.length??0,visibleMarchingCubesSurfaceCount:L?.surfaces?.length??0,presentationComposition:e.presentationComposition,participatingMediumStatus:e.status,collectiveOpticalSurfaceCount:e.collectiveOpticalSurfaceCount,participatingMediumAggregateDrawCount:e.participatingMediumAggregateDrawCount,collectiveOpticalShellFallbackCount:e.collectiveOpticalShellFallbackCount,fieldRowsBufferByteLength:J,adapterCacheEntryCount:Be.size})},async dispose(){if(!M){Pe(),Dt(),M=!0,P+=1,q=null,N+=1,X(`worker-isosurface-recovery-dispose`),fn(),pn(),dn(I,`worker-owned isosurface presenter disposed`),I=null,await Promise.all([hn(),F?.catch?.(()=>{}),W?.catch?.(()=>{}),Ne?.catch?.(()=>{})]),Y(L,`worker-isosurface-presenter-dispose`),L=null,await tt(),V?.dispose(),V=null,Ie?.destroy?.(),Ie=null,J=0,Me?.destroy?.(),Me=null;try{Le?.destroy?.()}catch{}Le=null}}})}export{Dt as RETAINED_GAP_STARVATION_MS,bt as ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_ENQUEUED_STATUS,St as ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_FAILED_STATUS,Tt as ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_FRAME_SCHEMA,wt as ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_GEOMETRY,xt as ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS,vt as ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_SCHEMA,Ct as ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_SUPERSEDED_STATUS,yt as ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_REQUEST_SCHEMA,en as buildWorkerOwnedIsosurfaceSurfaceUniformValues,un as createWorkerOwnedIsosurfacePresenter,$t as dampedIsosurfaceShaderMotionAgeS,an as resolveWorkerOwnedIsosurfaceAdmission,Kt as resolveWorkerOwnedIsosurfaceProductEventSource,Yt as snapshotWorkerOwnedSurfaceMetadata,tn as summarizeWorkerOwnedIsosurfaceOpticalPresentation,Ot as threeViewProjectionToWebGpuClipMatrix};