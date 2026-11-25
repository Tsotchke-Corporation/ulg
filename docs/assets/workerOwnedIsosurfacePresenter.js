import{bn as e,xn as t}from"./eshkolTriadClosures-D-cceDKA.js";import{Ai as n,Cs as r,Ii as i,M as a,Mi as o,W as s,_s as c,bs as l,c as u,gs as d,hs as f}from"./sphGpuBuffers-Dj9b7UXh.js";import{acquireQueueOrderedPooledBuffer as p,computeBufferBinding as m,createCachedExplicitBindGroup as h,createCachedExplicitComputePipeline as g,deferSubmittedWorkCleanup as _,getCachedPipelineBindGroupLayout as v,registerQueueOrderedPooledBufferReturn as y,releaseOrDestroyQueueOrderedPooledBuffer as b}from"../runtime/webgpuComputeLayout.js";import{E as x,M as S,a as C,c as w,g as T,h as E,j as D,m as ee,o as O,r as te,s as ne,u as re,x as ie}from"./nativeSurfaceTemperatureWgsl-BpnEEi35.js";import{s as k}from"./sphGpuDeviceIdentity-CxQWvfZe.js";import{ULG_WORKER_PRESENTATION_FRAME_QUEUE_COMPLETION_SCOPE as ae,ULG_WORKER_PRESENTATION_PHYSICS_PREFIX_INCLUDED as oe,ULG_WORKER_PRESENTATION_PHYSICS_PREFIX_NOT_ATTRIBUTED as se}from"../runtime/sph/sphWorkerPresentationQos.js";import{a as ce,c as le,i as ue,l as de,n as fe,o as pe,s as me,t as he,u as ge}from"./sphNuclearCherenkovGpu-DTAvqHdR.js";import{createIsosurfaceMotionPacing as _e,createPresentationPauseClock as ve,isosurfaceMotionAge as A,resumeIsosurfaceMotionPacing as ye,slowIsosurfaceMotionPacing as be,snapshotIsosurfaceSourceTimingBootstrap as xe}from"./workerOwnedIsosurfaceMotion.js";var Se=`
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
`;function Ce(e,{colorFormat:t=`rgba8unorm`,depthFormat:n=`depth24plus`}={}){let r=e.createShaderModule({label:`ulg-solid-member-shape`,code:Se}),i=e.createRenderPipeline({label:`ulg-solid-member-shape`,layout:`auto`,vertex:{module:r,entryPoint:`vs_member`},fragment:{module:r,entryPoint:`fs_member`,targets:[{format:t}]},primitive:{topology:`triangle-list`,cullMode:`back`,frontFace:`ccw`},depthStencil:n?{format:n,depthWriteEnabled:!0,depthCompare:`less`}:void 0}),a=e.createBuffer({label:`ulg-solid-member-shape-uniforms`,size:112,usage:72}),o=new WeakMap;return Object.freeze({draw(t,n,{viewProjection:r,colorLinear:s=[.78,.9,.98],ambient:c=.35,lightDirection:l=[.3,.8,.5]}){let u=new ArrayBuffer(112),d=new Float32Array(u),f=new Uint32Array(u);d.set(r,0),f.set([0,n.memberCount,0,0],16),d.set([...s,1],20),d.set([...l,c],24),e.queue.writeBuffer(a,0,u);let p=o.get(n);p||(p=e.createBindGroup({layout:i.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:a}},{binding:1,resource:{buffer:n.frameBuffer}},{binding:2,resource:{buffer:n.memberBuffer}},{binding:3,resource:{buffer:n.neighborBuffer}},{binding:4,resource:{buffer:n.latticeBuffer}}]}),o.set(n,p)),t.setPipeline(i),t.setBindGroup(0,p),t.draw(n.memberCount*36)}})}var we=Object.freeze({wavelengthM:55e-8,refractiveIndex:1.333,asymmetry:.85}),Te=Object.freeze({STORAGE:128,UNIFORM:64,COPY_DST:8}),Ee=`
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
`;function De({device:e,encoder:t,parcels:n,fieldRowsBuffer:r,fieldOffset:i,resolution:a,fieldPadding:o,refEdgeM:s}={}){if(!n?.count||!r||!(a>0)||!(s>0))return null;let c=n.boxDimensionsM[0]/n.cellsPerAxis;if(!(c>0))throw TypeError(`Ledger parcel optics require the parcel gas-cell size`);let l=g(e,{cacheKey:`ulg-ledger-parcel-optics.v1`,label:`ulg-ledger-parcel-optics`,code:Ee,entryPoint:`add_parcel_optics`,bindings:[`uniform`,`read-only-storage`,`storage`].map((e,t)=>m(t,e))}),u=e.createBuffer({label:`ulg-ledger-parcel-optics-params`,size:48,usage:Te.UNIFORM|Te.COPY_DST}),d=new ArrayBuffer(48),f=new Uint32Array(d),p=new Float32Array(d);f.set([n.count,a,i,0],0),p.set([o,s,we.wavelengthM,we.refractiveIndex],4),p.set([we.asymmetry,c,0,0],8),e.queue.writeBuffer(u,0,d);let h=e.createBindGroup({layout:l.bindGroupLayout,entries:[u,n.paramsBuffer,r].map((e,t)=>({binding:t,resource:{buffer:e}}))}),_=t.beginComputePass({label:`ulg-ledger-parcel-optics`});return _.setPipeline(l.pipeline),_.setBindGroup(0,h),_.dispatchWorkgroups(Math.ceil(a**3/64)),_.end(),u}function Oe(e,{bucketKey:t,label:n,size:r,usage:i}){let a=Math.max(4,Math.ceil(Number(r)||4));return typeof globalThis.GPUDevice==`function`&&e instanceof globalThis.GPUDevice&&typeof e.queue?.onSubmittedWorkDone==`function`?y(p(e,{bucketKey:t,label:n,size:a,usage:i}),e,{bucketKey:t,size:a,usage:i}):e.createBuffer({label:n,size:a,usage:i})}var j=`peercompute.ulg.sph-participating-medium-descriptor.v0`,M=`peercompute.ulg.sph-participating-medium-gpu.v0`,N=`peercompute.ulg.sph-participating-medium-packed-frame.v0`,P=Object.freeze({ready:`participating-medium-ready`,empty:`participating-medium-empty`,blocked:`participating-medium-blocked`}),ke=`participating-medium-packed-gpu-resident`,F=`rgba16float`,I=65504,L=Object.freeze({COPY_DST:globalThis.GPUBufferUsage?.COPY_DST??8,UNIFORM:globalThis.GPUBufferUsage?.UNIFORM??64,STORAGE:globalThis.GPUBufferUsage?.STORAGE??128,INDIRECT:globalThis.GPUBufferUsage?.INDIRECT??256}),R=Object.freeze({TEXTURE_BINDING:globalThis.GPUTextureUsage?.TEXTURE_BINDING??4,STORAGE_BINDING:globalThis.GPUTextureUsage?.STORAGE_BINDING??8}),Ae=8*Uint32Array.BYTES_PER_ELEMENT,z=8*Uint32Array.BYTES_PER_ELEMENT,B=40,je=B*Float32Array.BYTES_PER_ELEMENT,Me=80,Ne=1e-6,Pe=40,Fe=8,Ie=128,Le=new WeakMap,V=new WeakMap,Re=new WeakMap,ze=`
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
`,Be=`
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
`;function H(e){return typeof e==`object`&&!!e||typeof e==`function`}function U(e,t=null){let n=Number(e);return Number.isFinite(n)?n:t}function W(e,t){if(!(Array.isArray(e)||ArrayBuffer.isView(e))||e.length!==t)return null;let n=Array.from(e,Number);return n.every(Number.isFinite)?n:null}function Ve(e,t,n){let r=W(e,n),i=W(t,n);return!!(r&&i&&r.every((e,t)=>e===i[t]))}function He(e){return Array.isArray(e)&&e.length===t.length&&e.every((e,n)=>e===t[n])}function G(e){let t=Number(e?.descriptor?.surfaceIndex);if(Number.isSafeInteger(t)&&t>=0)return t;let n=Number(e?.metadata?.index);return Number.isSafeInteger(n)&&n>=0?n:null}function K(e){return Object.freeze(Array.isArray(e)?e.map(G).filter(e=>e!=null):[])}function Ue(e){let t=e?.metadata;return!!(H(t)&&Number.isSafeInteger(Number(t.opticalStateId))&&Number(t.opticalStateId)===0)}function We(e,t=[],n={}){return Object.freeze({schema:j,ok:!1,status:P.blocked,reason:e,routeCount:0,collectiveSurfaceCount:t.length,consumedSurfaceIndices:K(t),readback:!1,fullReadback:!1,...n})}function Ge(){return Object.freeze({schema:j,ok:!0,status:P.empty,reason:null,routeCount:0,collectiveSurfaceCount:0,consumedSurfaceIndices:Object.freeze([]),readback:!1,fullReadback:!1})}function Ke(e,t){return!!(H(e)&&H(t)&&[`index`,`resolution`,`fieldOffset`,`fieldCellCount`,`opticalStateId`,`collectiveOpticalRoute`,`collectiveOpticalRouteSchema`,`collectiveOpticalRouteKey`,`collectiveOpticalRouteId`,`opticalResponseAuthorityFlag`,`opticalResponseReady`,`opticalVisibilityFlag`,`opticalBlockedFlag`].every(n=>e[n]===t[n])&&Ve(e.colorLinear,t.colorLinear,3)&&(e.opticalScatteringSourceLinear==null?t.opticalScatteringSourceLinear==null:Ve(e.opticalScatteringSourceLinear,t.opticalScatteringSourceLinear,3)))}function qe(e){let t=W(e?.opticalScatteringSourceLinear,3),n=W(e?.colorLinear,3),r=t||n;return!r||r.some(e=>e<0)?null:r.map(e=>Math.min(e,1))}function Je(e,n){if(!H(e))return`participating medium requires a GPUDevice`;if(!H(n)||n.schema!==`peercompute.ulg.sph-gpu-render-field.v1`)return`participating medium requires the exact ULG render-field schema`;if(n.backend!==`webgpu`)return`participating medium requires a WebGPU render field`;if(n.fieldRowsBufferRetained!==!0||!H(n.fieldRowsBuffer))return`participating medium requires a retained render-field GPU buffer`;if(!k(n.fieldRowsBuffer,e))return`participating medium rejects a cross-device render-field buffer`;if(n.rowStrideFloats!==t.length)return`participating medium requires the exact render-field cell stride`;if(!He(n.rowLayout))return`participating medium requires the exact render-field row layout`;let r=Number(n.fieldRowsBufferByteLength),i=Number(n.fieldRowsBuffer.size),a=Number(n.totalFieldCells)*t.length*Float32Array.BYTES_PER_ELEMENT;return!Number.isSafeInteger(Number(n.totalFieldCells))||Number(n.totalFieldCells)<=0||!Number.isSafeInteger(r)||r!==a||!Number.isSafeInteger(i)||i<r?`participating medium rejects inconsistent render-field buffer bounds`:n.surfaceTable?.schema!==`peercompute.ulg.sph-gpu-render-field.v1`||!Array.isArray(n.surfaceTable.metadata)||n.surfaceTable.metadata.length!==n.surfaceTable.surfaceCount?`participating medium requires the exact render-field surface table`:null}function Ye({device:e,renderField:n,volumeDescriptor:r,metadata:i,sourceMetadata:a}){if(!H(r)||r.schema!==`peercompute.ulg.sph-webgpu-marching-cubes-buffer-volume-descriptor.v0`||r.ok!==!0||r.status!==`ulg-render-field-buffer-volume-descriptor-ready`||r.device!==e||r.scalarBuffer!==n.fieldRowsBuffer||r.storageBuffer!==n.fieldRowsBuffer||r.buffer!==n.fieldRowsBuffer||r.sameDeviceStatus===`cross-device-resource`)return`participating medium rejected an unauthenticated field-volume descriptor`;let o=Number(r.surfaceIndex),s=Number(a?.resolution),c=Number(a?.fieldOffset),l=Number(a?.fieldCellCount);return!Number.isSafeInteger(o)||o<0||a!==n.surfaceTable.metadata[o]||!Ke(i,a)||!Number.isSafeInteger(s)||s<2||!Number.isSafeInteger(c)||c<0||l!==s**3||r.fieldOffset!==c||r.fieldCellCount!==l||r.scalarOffset!==c*t.length||r.scalarOffsetBytes!==r.scalarOffset*Float32Array.BYTES_PER_ELEMENT||r.cellRowStrideFloats!==t.length||!Ve(r.dims,[s,s,s],3)?`participating medium rejected inconsistent field-volume bounds`:r.positionTransform?.enabled!==!0||r.positionTransformStatus!==`ulg-render-field-grid-to-world-transform-ready`||!Ve(r.positionTransformOriginM,r.positionTransform.originM,3)||!(Number(r.positionTransformScaleM)>0)||r.positionTransformScaleM!==r.positionTransform.scaleM?`participating medium requires an authenticated grid-to-world transform`:n.schroederSpatialSourceFamily&&!re(r,{device:e,sourceFamily:n.schroederSpatialSourceFamily})?`participating medium rejected stale successor field lineage`:null}function q(e){let t=Number(e?.opticalStateId);return!!(Object.isFrozen(e)&&e.collectiveOpticalRoute===!0&&e.collectiveOpticalRouteSchema===`peercompute.ulg.sph-collective-dispersed-medium-optical-route.v0`&&typeof e.collectiveOpticalRouteKey==`string`&&e.collectiveOpticalRouteKey.length>0&&Number.isSafeInteger(t)&&t>0&&Number(e.collectiveOpticalRouteId)===t&&e.opticalResponseAuthorityFlag===1&&e.opticalResponseReady===!0&&e.opticalVisibilityFlag===1&&e.opticalBlockedFlag===0&&qe(e))}function J(e){return Object.freeze({surfaceIndex:e.surfaceIndex,scalarBuffer:e.scalarBuffer,fieldOffset:e.fieldOffset,fieldCellCount:e.fieldCellCount,scalarOffset:e.scalarOffset,scalarOffsetBytes:e.scalarOffsetBytes,cellRowStrideFloats:e.cellRowStrideFloats,positionTransform:e.positionTransform,positionTransformStatus:e.positionTransformStatus,positionTransformScaleM:e.positionTransformScaleM,positionTransformGridBias:e.positionTransformGridBias,positionTransformOriginM:Object.freeze([...e.positionTransformOriginM]),dims:Object.freeze([...e.dims])})}function Xe(e,t){return!!(e.surfaceIndex===t.surfaceIndex&&e.scalarBuffer===t.scalarBuffer&&e.fieldOffset===t.fieldOffset&&e.fieldCellCount===t.fieldCellCount&&e.scalarOffset===t.scalarOffset&&e.scalarOffsetBytes===t.scalarOffsetBytes&&e.cellRowStrideFloats===t.cellRowStrideFloats&&e.positionTransform===t.positionTransform&&e.positionTransformStatus===t.positionTransformStatus&&e.positionTransformScaleM===t.positionTransformScaleM&&e.positionTransformGridBias===t.positionTransformGridBias&&Ve(e.positionTransformOriginM,t.positionTransformOriginM,3)&&Ve(e.dims,t.dims,3))}function Ze({device:n=null,renderField:r=null,surfaceDescriptors:i=[]}={}){if(!Array.isArray(i))return We(`participating medium surfaceDescriptors must be an array`);if(i.length===0)return Ge();let a=i.filter(e=>!Ue(e));if(a.length===0)return Ge();let o=Je(n,r);if(o)return We(o,a);let s=[...a].sort((e,t)=>G(e)-G(t)),c=new Set,l=new Set,u=new ArrayBuffer(s.length*Ae),d=new Uint32Array(u),f=new Float32Array(u),p=[],m=null,h=null,g=null,_=null;for(let e=0;e<s.length;e+=1){let t=s[e],i=t?.descriptor??null,o=t?.metadata??null,u=G(t),v=Number.isSafeInteger(u)?r.surfaceTable.metadata[u]:null;if(!q(o))return We(`participating medium rejected a blocked or noncanonical collective route`,a,{blockedSurfaceIndex:u});let y=Ye({device:n,renderField:r,volumeDescriptor:i,metadata:o,sourceMetadata:v});if(y)return We(y,a,{blockedSurfaceIndex:u});let b=Number(o.opticalStateId);if(c.has(b)||l.has(u))return We(`participating medium rejects duplicate route or surface identity`,a,{blockedSurfaceIndex:u});c.add(b),l.add(u);let x=Number(v.resolution),S=Number(i.positionTransformScaleM),C=Number(i.positionTransformGridBias),w=W(i.positionTransformOriginM,3);if(e===0)m=x,h=S,g=C,_=w;else if(x!==m||S!==h||C!==g||!Ve(w,_,3))return We(`participating medium requires one exact shared grid transform`,a,{blockedSurfaceIndex:u});let T=qe(o),E=e*8;d[E]=Number(v.fieldOffset),d[E+1]=x,d[E+2]=b,d[E+3]=u,f[E+4]=T[0],f[E+5]=T[1],f[E+6]=T[2],f[E+7]=1,p.push(Object.freeze({surfaceIndex:u,opticalStateId:b,fieldOffset:Number(v.fieldOffset),resolution:x,scatteringColorLinear:Object.freeze([...T]),volumeDescriptor:i,volumeDescriptorSnapshot:J(i),metadata:o,sourceMetadata:v}))}let v=Number(n.limits?.maxTextureDimension3D);if(Number.isFinite(v)&&m>v)return We(`participating medium grid exceeds maxTextureDimension3D`,a);let y=_.map(e=>e-.5*h),b=_.map(e=>e+(m-.5)*h),x={schema:j,ok:!0,status:P.ready,reason:null,sourceRenderFieldSchema:r.schema,sourceRenderFieldBackend:r.backend,routeCount:p.length,collectiveSurfaceCount:p.length,consumedSurfaceIndices:Object.freeze(p.map(e=>e.surfaceIndex)),opticalStateIds:Object.freeze(p.map(e=>e.opticalStateId)),resolution:m,dims:Object.freeze([m,m,m]),cellEdgeM:h,fieldMinM:Object.freeze(y),fieldMaxM:Object.freeze(b),fieldRowsBuffer:r.fieldRowsBuffer,fieldRowsBufferByteLength:r.fieldRowsBufferByteLength,fieldCellRowStrideFloats:t.length,temperatureLaneIndex:e.temperatureK,scatteringOpticalDepthLaneIndex:e.scatteringOpticalDepth,absorptionOpticalDepthLaneIndex:e.absorptionOpticalDepth,scatteringAsymmetryOpticalDepthLaneIndex:e.scatteringAsymmetryOpticalDepth,aggregateTextureCount:2,textureFormat:F,storageComponentMax:I,readback:!1,fullReadback:!1,activityMode:`gpu-indirect-not-read-back`,sourceReleaseBoundary:`after-containing-command-buffer-submit`};return Le.set(x,{active:!0,device:n,renderField:r,surfaceTable:r.surfaceTable,surfaceMetadataArray:r.surfaceTable.metadata,fieldRowsBuffer:r.fieldRowsBuffer,routeRowsBytes:new Uint8Array(u),routes:p,resolution:m,cellEdgeM:h,fieldMinM:y,fieldMaxM:b}),Object.freeze(x)}function Y(e,t){if(typeof e?.[t]!=`function`)throw TypeError(`participating medium requires device.${t}()`)}function Qe(e,t,n,r){return typeof e[t]==`function`?Promise.resolve(e[t](r)):(Y(e,n),Promise.resolve(e[n](r)))}function $e(e,{colorFormat:t=`rgba8unorm`,depthFormat:n=`depth24plus`,maxOpticalDepth:r=Me,activityEpsilon:i=Ne}={}){for(let t of[`createBuffer`,`createTexture`,`createShaderModule`,`createBindGroup`,`createSampler`])Y(e,t);if(Y(e?.queue,`writeBuffer`),typeof t!=`string`||t.length===0)throw TypeError(`participating medium requires a color format`);if(typeof n!=`string`||n.length===0)throw TypeError(`participating medium requires a depth format`);let a=U(r),o=U(i);if(!(a>0)||!(o>=0))throw RangeError(`participating medium optical limits must be finite and nonnegative`);let s=Math.min(a,I),c=e.createShaderModule({label:`ulg-sph-participating-medium-pack-wgsl`,code:ze}),l=e.createShaderModule({label:`ulg-sph-participating-medium-render-wgsl`,code:Be}),u=Qe(e,`createComputePipelineAsync`,`createComputePipeline`,{label:`ulg-sph-participating-medium-pack`,layout:`auto`,compute:{module:c,entryPoint:`pack_main`}}),d=Qe(e,`createRenderPipelineAsync`,`createRenderPipeline`,{label:`ulg-sph-participating-medium-render`,layout:`auto`,vertex:{module:l,entryPoint:`vertex_main`},fragment:{module:l,entryPoint:`fragment_main`,targets:[{format:t,blend:{color:{operation:`add`,srcFactor:`one`,dstFactor:`one-minus-src-alpha`},alpha:{operation:`add`,srcFactor:`one`,dstFactor:`one-minus-src-alpha`}},writeMask:15}]},primitive:{topology:`triangle-list`,cullMode:`none`}}),f={active:!0,device:e,colorFormat:t,depthFormat:n,maxOpticalDepth:s,activityEpsilon:o,packPipelinePromise:u,renderPipelinePromise:d,sampler:e.createSampler({label:`ulg-sph-participating-medium-linear-sampler`,addressModeU:`clamp-to-edge`,addressModeV:`clamp-to-edge`,addressModeW:`clamp-to-edge`,magFilter:`linear`,minFilter:`linear`,mipmapFilter:`nearest`}),emptyMotionBuffer:e.createBuffer({label:`ulg-sph-participating-medium-empty-motion`,size:16,usage:L.STORAGE|L.COPY_DST}),frames:new Set},p={schema:M,status:`participating-medium-gpu-ready-pending-pipelines`,colorFormat:t,depthFormat:n,textureFormat:F,maxOpticalDepth:s,storageComponentMax:I,readback:!1,get destroyed(){return!f.active},ready:Promise.all([u,d]).then(()=>!0),destroy(){if(!f.active)return!1;f.active=!1;for(let e of[...f.frames])ot(e);return f.frames.clear(),tt(f.emptyMotionBuffer),!0}};return V.set(p,f),Object.freeze(p)}function et(e){let t=V.get(e);if(!t||!t.active)throw TypeError(`participating medium GPU runtime is missing or destroyed`);return t}function X(e,t){let n=Le.get(e);if(!n||!n.active||e.status!==P.ready)throw TypeError(`participating medium descriptor is missing, consumed, or blocked`);if(n.device!==t.device||e.fieldRowsBuffer!==n.fieldRowsBuffer)throw TypeError(`participating medium descriptor belongs to a different GPU runtime`);let r=Je(t.device,n.renderField);if(r)throw TypeError(`participating medium render-field source failed revalidation: ${r}`);if(n.renderField.fieldRowsBuffer!==n.fieldRowsBuffer||n.renderField.fieldRowsBufferRetained!==!0||n.renderField.surfaceTable!==n.surfaceTable||n.surfaceTable.metadata!==n.surfaceMetadataArray||!k(n.fieldRowsBuffer,t.device))throw TypeError(`participating medium render-field/table identity is stale or cross-device`);for(let e of n.routes){if(n.surfaceMetadataArray[e.surfaceIndex]!==e.sourceMetadata||!Ke(e.metadata,e.sourceMetadata)||!q(e.metadata)||!Xe(e.volumeDescriptor,e.volumeDescriptorSnapshot))throw TypeError(`participating medium route authority changed after descriptor creation`);if(n.renderField.schroederSpatialSourceFamily&&!re(e.volumeDescriptor,{device:t.device,sourceFamily:n.renderField.schroederSpatialSourceFamily}))throw TypeError(`participating medium successor lineage expired before packing`)}return n}function tt(e){try{b(e)}catch{}}function nt(e,t,n,r,i){let a={active:!0,runtime:e,runtimeRecord:t,descriptor:n,descriptorRecord:r,...i},o={schema:N,ok:!0,status:ke,resolution:n.resolution,dims:n.dims,routeCount:n.routeCount,collectiveSurfaceCount:n.collectiveSurfaceCount,consumedSurfaceIndices:n.consumedSurfaceIndices,opticalStateIds:n.opticalStateIds,opticalTexture:i.opticalTexture,scatteringTexture:i.scatteringTexture,drawIndirectBuffer:i.drawIndirectBuffer,drawIndirectOffsetBytes:0,drawCountMode:`gpu-indirect-not-read-back`,sourceBufferConsumptionEncoded:!0,sourceReleaseBoundary:n.sourceReleaseBoundary,readback:!1,fullReadback:!1,get destroyed(){return!a.active},destroy(){return ot(o)}};return a.frame=o,Re.set(o,a),t.frames.add(o),Object.freeze(o)}async function rt(e,n,r){let i=et(e);if(!H(n)||typeof n.clearBuffer!=`function`||typeof n.beginComputePass!=`function`)throw TypeError(`participating medium pack requires a GPUCommandEncoder`);let a=X(r,i),o=await i.packPipelinePromise;et(e),X(r,i);let s=a.resolution,c={size:{width:s,height:s,depthOrArrayLayers:s},dimension:`3d`,format:F,mipLevelCount:1,sampleCount:1,usage:R.STORAGE_BINDING|R.TEXTURE_BINDING},l=[];try{let u=i.device.createTexture({...c,label:`ulg-sph-participating-medium-optical-volume`});l.push(u);let d=i.device.createTexture({...c,label:`ulg-sph-participating-medium-scattering-volume`});l.push(d);let f=u.createView({dimension:`3d`}),p=d.createView({dimension:`3d`}),m=Oe(i.device,{bucketKey:`ulg-sph-participating-medium-route-rows`,label:`ulg-sph-participating-medium-route-rows`,size:a.routeRowsBytes.byteLength,usage:L.STORAGE|L.COPY_DST});l.push(m);let g=Oe(i.device,{bucketKey:`ulg-sph-participating-medium-pack-params`,label:`ulg-sph-participating-medium-pack-params`,size:z,usage:L.UNIFORM|L.COPY_DST});l.push(g);let _=Oe(i.device,{bucketKey:`ulg-sph-participating-medium-draw-indirect`,label:`ulg-sph-participating-medium-draw-indirect`,size:4*Uint32Array.BYTES_PER_ELEMENT,usage:L.STORAGE|L.INDIRECT|L.COPY_DST});l.push(_);let y=Oe(i.device,{bucketKey:`ulg-sph-participating-medium-render-uniforms`,label:`ulg-sph-participating-medium-render-uniforms`,size:je,usage:L.UNIFORM|L.COPY_DST});l.push(y);let b=new ArrayBuffer(z),x=new Uint32Array(b),S=new Float32Array(b);x[0]=s,x[1]=r.routeCount,x[2]=t.length/4,S[4]=i.maxOpticalDepth,S[5]=i.activityEpsilon,i.device.queue.writeBuffer(m,0,a.routeRowsBytes),i.device.queue.writeBuffer(g,0,new Uint8Array(b));let C=h(i.device,{label:`ulg-sph-participating-medium-pack-bind-group`,layout:v(o,0),entries:[{binding:0,resource:{buffer:a.fieldRowsBuffer}},{binding:1,resource:{buffer:m}},{binding:2,resource:{buffer:g}},{binding:3,resource:f},{binding:4,resource:p},{binding:5,resource:{buffer:_}}]});n.clearBuffer(_,0,4*Uint32Array.BYTES_PER_ELEMENT);let w=n.beginComputePass({label:`ulg-sph-participating-medium-pack-pass`});w.setPipeline(o),w.setBindGroup(0,C);let T=Math.ceil(s/4);return w.dispatchWorkgroups(T,T,T),w.end(),a.active=!1,nt(e,i,r,a,{opticalTexture:u,scatteringTexture:d,opticalTextureView:f,scatteringTextureView:p,routeRowsBuffer:m,packParamsBuffer:g,drawIndirectBuffer:_,renderUniformBuffer:y,packDispatch:Object.freeze([T,T,T])})}catch(e){a.active=!1;for(let e of l)tt(e);throw e}}function it(e,{inverseViewProjectionMatrix:t,cameraPositionM:n,viewportSize:r,lightDirection:i=[.38,.82,.42],lightIntensity:a=1,ambientIntensity:o=.18,stepCount:s=Pe,depthEpsilon:c=1e-6,motionAgeS:l=0,motionRowCount:u=0}){let d=W(t,16),f=W(n,3),p=W(r,2),m=W(i,3),h=U(a),g=U(o),_=U(c);if(!d||!f||!p||p.some(e=>!(e>0))||!m||Math.hypot(...m)<=1e-12||!(h>=0)||!(g>=0)||!(_>=0))throw TypeError(`participating medium render uniforms are incomplete or non-finite`);let v=Math.max(Fe,Math.min(Ie,Math.round(U(s,Pe)))),y=new Float32Array(B);y.set(d,0),y.set(f,16),y[19]=v,y.set(e.descriptorRecord.fieldMinM,20),y[23]=e.descriptorRecord.cellEdgeM,y.set(e.descriptorRecord.fieldMaxM,24),y[27]=g;let b=Math.hypot(...m);y[28]=m[0]/b,y[29]=m[1]/b,y[30]=m[2]/b,y[31]=h,y[32]=p[0],y[33]=p[1],y[34]=_;let x=Number.isFinite(Number(l))&&Number(l)>0?Number(l):0,S=Number.isSafeInteger(Number(u))&&Number(u)>0?Number(u):0;return y[36]=S>0?x:0,y[37]=e.descriptor.routeCount||0,y[38]=e.descriptor.resolution||0,y[39]=S,e.runtimeRecord.device.queue.writeBuffer(e.renderUniformBuffer,0,y),Object.freeze({stepCount:v,viewportSize:Object.freeze([...p]),readback:!1})}async function at(e,t,{packedFrame:n=null,inverseViewProjectionMatrix:r=null,cameraPositionM:i=null,viewportSize:a=null,depthTextureView:o=null,lightDirection:s=[.38,.82,.42],lightIntensity:c=1,ambientIntensity:l=.18,stepCount:u=Pe,depthEpsilon:d=1e-6,motionField:f=null,motionAgeS:p=0,decoupledBurstBypass:m=!1}={}){let h=et(e),g=Re.get(n);if(!g||!g.active||g.runtime!==e||!H(t)||typeof t.setPipeline!=`function`||typeof t.setBindGroup!=`function`||typeof t.drawIndirect!=`function`||!H(o))throw TypeError(`participating medium render requires a live packed frame, pass, and depth view`);let _=await h.renderPipelinePromise;if(et(e),!g.active)throw TypeError(`participating medium packed frame was destroyed before rendering`);let y=f?.buffer&&f?.destroyed!==!0?f.buffer:h.emptyMotionBuffer,b=y===h.emptyMotionBuffer?0:Math.max(0,Math.floor(Number(f?.rowCount)||0)),x=globalThis.__ulgDecoupledPresentationBypassBurst;m&&(globalThis.__ulgDecoupledPresentationBypassBurst=!0);let S;try{S=it(g,{inverseViewProjectionMatrix:r,cameraPositionM:i,viewportSize:a,lightDirection:s,lightIntensity:c,ambientIntensity:l,stepCount:u,depthEpsilon:d,motionAgeS:p,motionRowCount:b})}finally{m&&(globalThis.__ulgDecoupledPresentationBypassBurst=x)}let C=g.cachedRenderBindGroup;return(!C||g.cachedRenderDepthView!==o||g.cachedRenderMotionBuffer!==y)&&(C=h.device.createBindGroup({label:`ulg-sph-participating-medium-render-bind-group`,layout:v(_,0),entries:[{binding:0,resource:{buffer:g.renderUniformBuffer}},{binding:1,resource:g.opticalTextureView},{binding:2,resource:g.scatteringTextureView},{binding:3,resource:h.sampler},{binding:4,resource:o},{binding:5,resource:{buffer:y}},{binding:6,resource:{buffer:g.routeRowsBuffer}}]}),g.cachedRenderBindGroup=C,g.cachedRenderDepthView=o,g.cachedRenderMotionBuffer=y),t.setPipeline(_),t.setBindGroup(0,C),t.drawIndirect(g.drawIndirectBuffer,0),Object.freeze({status:`participating-medium-render-encoded`,routeCount:n.routeCount,consumedSurfaceIndices:n.consumedSurfaceIndices,drawCountMode:n.drawCountMode,readback:!1,...S})}function ot(e){let t=Re.get(e);if(!t||!t.active)return!1;t.active=!1,t.runtimeRecord.frames.delete(e);for(let e of[t.opticalTexture,t.scatteringTexture,t.routeRowsBuffer,t.packParamsBuffer,t.drawIndirectBuffer,t.renderUniformBuffer])tt(e);return!0}var st=`peercompute.ulg.worker-offscreen-resident-isosurface-presentation.v0`,ct=`peercompute.ulg.worker-offscreen-resident-isosurface-request.v0`,lt=`worker-offscreen-resident-isosurface-presentation-enqueued`,ut=`worker-offscreen-resident-isosurface-presentation-rendered`,dt=`worker-offscreen-resident-isosurface-presentation-failed`,ft=`worker-offscreen-resident-isosurface-presentation-superseded`,pt=`worker-owned-true-isosurface`,mt=`peercompute.ulg.worker-offscreen-resident-isosurface-presentation-frame.v0`,ht=`peercompute.ulg.sph-gpu-render-field.v1`,gt=1e3/60;function _t(e){let t=new Float32Array(16);for(let n=0;n<16;n+=1)t[n]=Number(e[n])||0;for(let e=0;e<4;e+=1){let n=e*4;t[n+2]=.5*t[n+2]+.5*t[n+3]}return t}var vt=`no-full-readback`,yt=`gpu-conservative-no-readback`,bt=`depth24plus`,xt=`peercompute.ulg.worker-participating-medium-presentation.v0`,St=`not-requested`,Ct=P.ready,wt=P.empty,Tt=P.blocked,Et=Object.freeze([`ordered-isosurface-and-overlay`]),Dt=Object.freeze([`opaque-isosurface`,`depth-clipped-participating-medium`,`transparent-isosurface-and-overlay`]),Ot=4,kt=8,At=64,jt=128,Mt=class extends Error{};`${ge}`;function Z(){return globalThis.performance?.now?.()??Date.now()}function Nt(e,t){return globalThis.GPUBufferUsage?.[e]??t}function Q(e){return!!(e&&typeof e==`object`&&(e.constructor?.name===`GPUBuffer`||typeof e.mapAsync==`function`||typeof e.getMappedRange==`function`))}function Pt({device:e,retained:t}={}){let r=t?.residentProductMass??null;if(!r)return Object.freeze({productEventBuffer:null,productEventSource:null,productEventCount:0,productEventLiveCountDescriptor:null});let a=r.productEventBuffer??null,s=Number(r.productEventRowCount),c=Number(r.productEventRowCapacity??r.productEventRowCount);if(!(a||r.productEventLiveCountAuthority||o(r)||Number.isFinite(s)&&s>0||Number.isFinite(c)&&c>0))return Object.freeze({productEventBuffer:null,productEventSource:null,productEventCount:0,productEventLiveCountDescriptor:null});let l=a?n(r,e):null,u=l?.expectedRowCapacity??0,d=u*E*Float32Array.BYTES_PER_ELEMENT;if(r.productEventBufferRetained!==!0||!a||!l||!i(l,{handle:r,device:e})||l.hostObserved!==!1||!Number.isSafeInteger(u)||u<=0||l.rowCapacity!==u||l.expectedRowStrideVec4!==E/4||l.rowStrideFloats!==E||!Number.isSafeInteger(s)||s!==u||!Number.isSafeInteger(c)||c!==u||!(Number(a.size)>=d))throw TypeError(`worker-owned isosurface requires an exact retained product-event buffer and authenticated GPU live-count capacity`);return Object.freeze({productEventBuffer:a,productEventSource:r,productEventCount:u,productEventLiveCountDescriptor:l})}function Ft(e){if(!e)return null;if(!Object.hasOwn(e,`__ulgActiveBorrowCount`))throw TypeError(`worker-owned isosurface requires a borrowable retained product-event source`);let t=Math.max(0,Math.floor(Number(e.__ulgActiveBorrowCount)||0));if(e.__ulgActiveBorrowCount=t+1,Number(e.__ulgActiveBorrowCount)!==t+1)throw TypeError(`worker-owned isosurface could not pin its retained product-event source`);let n=!1;return()=>n?!1:(n=!0,e.__ulgActiveBorrowCount=Math.max(0,(Number(e.__ulgActiveBorrowCount)||0)-1),!0)}function It(e,t){if(!a(t))return null;let n=t?.dispersedMediumOptics??null,r=Number(t?.particleCount),i=Number(n?.rowCount),o=Number(n?.rowStrideFloats),c=Number(n?.bufferByteLength),l=i*o*Float32Array.BYTES_PER_ELEMENT;if(!n||n.ownsBuffer!==!0||n.destroyed===!0||t.ownsDispersedMediumOpticsBuffer!==!0||t.dispersedMediumOpticsAuthority!==n.authority||t.dispersedMediumOpticsBuffer!==n.buffer||t.dispersedMediumOpticsRowCount!==n.rowCount||t.dispersedMediumOpticsRowStrideFloats!==n.rowStrideFloats||t.dispersedMediumOpticsBufferByteLength!==n.bufferByteLength||!Number.isSafeInteger(r)||r<=0||n.particleCount!==r||!Number.isSafeInteger(i)||i!==r||!Number.isSafeInteger(o)||o<=0||!Number.isSafeInteger(c)||c<=0||c!==l||!Number.isSafeInteger(Number(n.buffer?.size))||Number(n.buffer?.size)!==c)throw TypeError(`worker-owned isosurface rejected torn dispersed-medium particle-upload aliases`);return Object.freeze({sidecar:n,release:s(e,n)})}function Lt(e){if(!e||typeof e!=`object`)throw TypeError(`worker-owned isosurface requires object surface metadata`);let t={...e};return(Array.isArray(e.boundsCenterM)||ArrayBuffer.isView(e.boundsCenterM))&&(t.boundsCenterM=Object.freeze(Array.from(e.boundsCenterM))),(Array.isArray(e.colorLinear)||ArrayBuffer.isView(e.colorLinear))&&(t.colorLinear=Object.freeze(Array.from(e.colorLinear))),(Array.isArray(e.opticalScatteringSourceLinear)||ArrayBuffer.isView(e.opticalScatteringSourceLinear))&&(t.opticalScatteringSourceLinear=Object.freeze(Array.from(e.opticalScatteringSourceLinear))),e.opticalState&&typeof e.opticalState==`object`&&(t.opticalState=Object.freeze({...e.opticalState})),Object.freeze(t)}function $(e,t){if(!(Array.isArray(e)||ArrayBuffer.isView(e))||e.length!==t)return null;let n=Array.from(e,Number);return n.every(Number.isFinite)?n:null}function Rt(e){let t=$(e,16);if(!t)return null;let n=Array.from({length:4},(e,n)=>Array.from({length:8},(e,r)=>r<4?t[r*4+n]:+(r-4===n)));for(let e=0;e<4;e+=1){let t=e;for(let r=e+1;r<4;r+=1)Math.abs(n[r][e])>Math.abs(n[t][e])&&(t=r);let r=n[t][e];if(!Number.isFinite(r)||Math.abs(r)<=1e-12)return null;t!==e&&([n[e],n[t]]=[n[t],n[e]]);for(let t=0;t<8;t+=1)n[e][t]/=r;for(let t=0;t<4;t+=1){if(t===e)continue;let r=n[t][e];if(r!==0)for(let i=0;i<8;i+=1)n[t][i]-=r*n[e][i]}}let r=new Float32Array(16);for(let e=0;e<4;e+=1)for(let t=0;t<4;t+=1){let i=n[e][t+4];if(!Number.isFinite(i))return null;r[t*4+e]=i}return r}function zt(e){if(e?.collectiveOpticalRoute===!0||e?.collectiveOpticalRouteSchema!=null||e?.collectiveOpticalRouteKey!=null||e?.collectiveOpticalRouteId!=null)return!0;if(e?.opticalStateId==null)return!1;let t=Number(e?.opticalStateId);return!Number.isSafeInteger(t)||t!==0}function Bt(e){let t=e?.participatingMedium??null,n=t?.status??St,r=n===Ct&&!!t?.packedFrame,i=Math.max(0,Number(t?.collectiveSurfaceCount)||0);return Object.freeze({schema:xt,status:n,presentationComposition:i>0?`marching-cubes-isosurfaces-plus-participating-medium`:`marching-cubes-isosurfaces`,marchingCubesSurfaceCount:e?.surfaces?.length??0,collectiveOpticalSurfaceCount:i,participatingMediumAggregateDrawCount:+!!r,collectiveOpticalShellFallbackCount:0,participatingMediumDepthClipped:r,participatingMediumPremultipliedAlpha:r,presentationPassOrder:e?.presentationPassOrder??(r?Dt:Et)})}function Vt(e){let t=Math.max(0,Number(e?.drawMotionAgeS)||0),n=Number(e?.motionPacing?.maxSimulationAgeS)||0;if(!(t>0)||!(n>0))return t;let r=n*.65;return r*(1-Math.exp(-t/r))}function Ht(e={},t={}){let n=t.metadata||{},r=t.translation?.positionTransform||t.descriptor?.positionTransform||{},i=new Float32Array(44),a=$(e.viewProjectionMatrix,16)||[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];i.set(a,0);let o=$(r.originM,3)||[0,0,0];i.set(o,16),i[19]=Number(r.scaleM)||1;let s=Number.isFinite(Number(r.gridBias))?Number(r.gridBias):-.5;i[20]=s,i[21]=s,i[22]=s;let c=Math.max(0,Number(n.transparencyClassId)||0),l=Math.max(0,Number(n.phaseId)||0),u=Number(n.opticalResponseAuthorityFlag)>0,d=c>.5&&c<1.5||l>2.5&&l<3.5,f=Number(n.opticalEffectiveOpacity);i[23]=u&&d?Math.min(1,Math.max(0,Number.isFinite(f)?f:0)):1;let p=$(n.colorLinear,3)||[.72,.82,.94];i.set(p,24);let m=Number(n.opticalRoughness);if(i[27]=Number.isFinite(m)?Math.min(1,Math.max(.05,m)):c>0?.12:.42,i.set($(e.cameraPositionM,3)||[0,0,0],28),i[31]=Math.max(0,Number(n.emissiveTemperatureK)||0),i[32]=c,i[33]=l,i[34]=Number(n.depthWriteFlag)===0?0:1,i[35]=+!!u,e.motionField?.buffer){let n=new Uint32Array(i.buffer);n[36]=t.descriptor?.fieldOffset??0,n[37]=t.metadata?.resolution??0,n[38]=e.motionField.rowCount,i[40]=Vt(e),i[41]=Math.abs(i[19])}return i}function Ut(e=[]){let t=(Array.isArray(e)?e:[]).map(e=>e?.metadata??e).filter(Boolean).filter(e=>{let t=Number(e.transparencyClassId)||0,n=Number(e.phaseId)||0;return t>.5&&t<1.5||n>2.5&&n<3.5}),n=t.filter(e=>Number(e.opticalResponseAuthorityFlag)>0),r=n.filter(e=>Number(e.opticalEffectiveOpacity)>0);return Object.freeze({schema:`peercompute.ulg.worker-isosurface-optical-presentation.v0`,status:t.length===0?`no-gas-surfaces`:n.length===t.length?`all-gas-surfaces-closure-governed`:`gas-surface-optical-authority-incomplete`,gasSurfaceCount:t.length,closureGovernedGasSurfaceCount:n.length,visibleClosureGasSurfaceCount:r.length,opticallyThinHiddenGasSurfaceCount:n.length-r.length,allGasSurfacesClosureGoverned:t.length>0&&n.length===t.length,heuristicGasOpacityUsed:t.length>n.length,opticalProvenanceSources:[...new Set(n.map(e=>e.opticalProvenanceSource).filter(Boolean))].sort()})}function Wt(e){return{errorName:e instanceof Error?e.name:null,errorMessage:e instanceof Error?e.message:String(e),errorStack:e instanceof Error?String(e.stack||``).slice(0,2e3):null}}function Gt(e={}){return Object.freeze({schema:st,presentationGeometry:pt,sameDevicePresentation:!0,gpuToCpuReadbackBytes:0,fullParticleReadbackPerformed:!1,fullParticleReadbackFree:!0,authoritativeStateMutation:!1,scientificValidation:!1,sphValidation:!1,fullPhysicsValidation:!1,...e})}function Kt({request:e=null,retained:t=null}={}){let n=e?.surfaceTable,r=$(e?.viewProjectionMatrix,16),i=$(e?.cameraPositionM,3),a=[],o=null;try{o=le(e?.nativeSurfaceMaterial)}catch{a.push(`native-surface-material`)}return e?.schema!==`peercompute.ulg.worker-offscreen-resident-isosurface-request.v0`&&a.push(`request-schema`),e?.enabled!==!0&&a.push(`request-disabled`),(n?.schema!==ht||!(n?.records instanceof Float32Array)||!Array.isArray(n?.metadata)||n.metadata.length!==Number(n.surfaceCount)||n.surfaceCount<=0||n.totalFieldCells<=0)&&a.push(`surface-table`),r||a.push(`view-projection`),i||a.push(`camera-position`),Number.isFinite(Number(e?.fieldPadding))||a.push(`field-padding`),Number(e?.refEdgeM)>0||a.push(`reference-edge`),(t?.status!==`worker-retained-particle-state-ready`||t?.sameWorkerPrivateReferences!==!0||t?.postMessageTransportAllowed!==!1)&&a.push(`same-worker-retained-authority`),(!t?.sphParticleState||!t?.mlsMpmParticleState||!t?.sphParticleUpload||!t?.mlsMpmParticleUpload||!t?.successorSourceFamily&&t?.executionMode!==`tier0-fused-resident-sequence`)&&a.push(`retained-private-references`),(!Q(t?.sourceStateBuffer)||!Q(t?.sourceThermoBuffer)||!Q(t?.sourceMechanicsBuffer)||!Q(t?.sourceIdentityBuffer))&&a.push(`retained-gpu-buffers`),Object.freeze({ok:a.length===0,status:a.length===0?`worker-owned-isosurface-admission-ready`:`worker-owned-isosurface-admission-blocked`,reason:a.length===0?null:a.join(`,`),blockers:Object.freeze(a),surfaceCount:Math.max(0,Math.floor(Number(n?.surfaceCount)||0)),totalFieldCells:Math.max(0,Math.floor(Number(n?.totalFieldCells)||0)),particleCount:Math.max(0,Math.floor(Number(t?.particleCount)||0)),viewProjectionMatrix:r,cameraPositionM:i,nativeSurfaceMaterial:o})}function qt(e={}){return[e.surfaceIndex??0,e.surfaceKey??``,...e.dims||[],...e.scalarStrides||[],e.scalarOffset??0,e.scalarBufferByteLength??0,e.normalSign??-1,e.scalarType??`f32`].join(`|`)}function Jt(e){return D({device:e.device,scalarBuffer:e.scalarBuffer,dims:e.dims,scalarStrides:e.scalarStrides,scalarOffset:e.scalarOffset,bufferByteLength:e.scalarBufferByteLength,scalarType:e.scalarType||`f32`,normalSign:e.normalSign,label:e.label||`ulg-worker-isosurface-${e.surfaceKey||e.surfaceIndex||0}`,source:e.source||`ulg-render-field-density-storage-buffer`})}function Yt(e){return e?.extensionExecution||null}function Xt(e,t){try{e?.releaseTemperatureRows?.()}catch{}try{e?.translation?.destroyExtensionSurfaceBuffers?.({force:!0,releaseLeases:!0,reason:t})}catch{}try{e?.rawExecution?.result?.release?.()}catch{}try{b(e?.uniformBuffer)}catch{}}function Zt({device:e,context:t,format:n,depthFormat:i=bt,getDepthView:a,getViewportSize:o=null,drawOverlay:s=null,onTerminal:m=null,onFrameSubmitted:h=null,waitForPresentationOpportunity:g=null,getFramebufferEpoch:v=null,nextPresentationQueueCompletionSerial:b=null,temporalNowMs:E=Z,presentationPauseClock:D=ve(),captureRenderRows:re=x,buildRenderField:k=ie,buildPresentationFrame:le=null,createNativeSurfaceMaterial:ge=me,createParticipatingMediumDescriptor:Se=Ze,createParticipatingMediumGpu:we=$e,encodeParticipatingMediumPack:Te=rt,encodeParticipatingMediumRender:Ee=at,destroyParticipatingMediumPackedFrame:Oe=ot}={}){if(!e?.createBuffer||!e?.queue?.submit)throw TypeError(`worker-owned isosurface presenter requires a WebGPU device`);if(!t?.getCurrentTexture||!n)throw TypeError(`worker-owned isosurface presenter requires a configured WebGPU canvas context`);if(typeof a!=`function`)throw TypeError(`worker-owned isosurface presenter requires a depth-view provider`);if(typeof v!=`function`)throw TypeError(`worker-owned isosurface presenter requires a framebuffer-epoch provider`);let j=!1,M=0,N=0,P=!1,ke=null,F=null,I=null,L=null,R=null,Ae=0,z=!0,B=0,je=new AbortController,Me=null,Ne=null,Pe=null,Fe=null,Ie=null,Le=0,V=0,Re=null,ze=null,Be=null,H=Promise.resolve(),U=null,W=null,Ve=()=>{U?.abort(),W?.abort()},He=null,G=null,K=0,Ue=null,We=new Set,Ge=null,Ke=0,qe=null,Je=!1,Ye=0,q=0,J=0,Xe=0,Y=0,Qe=null,et=null,X=null,tt=null,nt=new Set,it=(e=!1)=>{if(nt.size!==0){for(let t of[...nt])if(e||q>=t.targetSerial){nt.delete(t);try{t.wake(q)}catch{}}}},ct=async(e=50)=>{let t=tt;return t?(await Promise.race([t,new Promise(t=>globalThis.setTimeout(t,e))]),!0):!1},pt=async({afterSerial:t=q,timeoutMs:n=14,force:r=!1}={})=>{let i=typeof globalThis.GPUDevice==`function`&&e instanceof globalThis.GPUDevice,a=()=>!!(i&&!j&&z&&L?.motionField?.buffer&&L?.motionPacing&&L.invalidationEpoch===N&&(L.lastDisplayedMotionAgeS||0)<L.motionPacing.maxSimulationAgeS);if(!a())return q;let o=await ct(60);if(o&&!a())return q;let s=!r&&(J>=5.5||o&&J>=3.5),c=r?J>=22?3:J>=14?2:1:J<3.5?0:s?Math.min(3,Math.max(1,Math.ceil((J-3.5)/8))):Math.min(3,Math.max(1,Math.ceil(J/5))),l=(s||r?Math.max(t,q):t)+c;if(c<=0||q>=l)return q;let u=Math.max(Number(n)||14,Math.min(52,16+c*12)),d=Math.max(4,Math.min(54,u));return new Promise(e=>{let t=!1,n=null,r={targetSerial:l,wake:()=>{t||(t=!0,nt.delete(r),n!=null&&globalThis.clearTimeout(n),e(q))}};nt.add(r),n=globalThis.setTimeout(r.wake,d)})},ht=new Map,gt=(e,t,n={})=>{try{m?.(Gt({status:t,requestGeneration:e.generation,sourceCapturedBeforePhysicsContinuation:!0,...e.receiptFields,...n,updatedAtMs:Z()}))}catch{}},xt=(t,n)=>{if(!t)return;let r=()=>{try{t.destroyRenderRowsBuffer?.({reason:n})}catch{try{t.destroyRenderRowsBuffer?.()}catch{}}};try{_(e,r)}catch{r()}},St=e=>!e||e.productEventSourceBorrowReleased?!1:(e.productEventSourceBorrowReleased=!0,e.releaseProductEventSourceBorrow?.()===!0),Et=e=>!e||e.dispersedMediumSourceBorrowReleased?!1:(e.dispersedMediumSourceBorrowReleased=!0,e.releaseDispersedMediumSourceBorrow?.()===!0),Dt=e=>{if(!e?.ledgerParcelsBorrow)return;let t=e.ledgerParcelsBorrow;e.ledgerParcelsBorrow=null,t.release()},Q=(t,n)=>{if(!t)return;if(Fe?.releaseFrame(t),t.motionField){let n=t.motionField;t.motionField=null,_(e,()=>n.destroy())}for(let e of t.surfaces||[])Xt(e,n);let r=t.participatingMedium;if(r?.packedFrame&&r.released!==!0){r.released=!0;try{Oe(r.packedFrame)}catch{}}},Ht=t=>{let n=R;R=null,n&&hn(()=>{_(e,()=>Q(n.frame,t))}).catch(()=>{})},Zt=t=>{if(t)try{_(e,()=>t.destroy())}catch{t.destroy()}},Qt=()=>(qe||=we(e,{colorFormat:n,depthFormat:i}),qe),$t=()=>(Fe||=ge({device:e,format:n,depthFormat:i,onAppearanceReady(){j||Fn({reason:`worker-native-appearance-ready`}).catch(()=>{})}}),Fe),en=async e=>{if(!(!e||e.released)){e.released=!0;try{await e.wrapper?.adapter?.release?.({destroyDevice:!1})}catch{}}},tn=async()=>{let e=[...ht.values()];ht.clear(),await Promise.all(e.map(en))},nn=async t=>Ge&&Ke>=t?Ge:(await tn(),Ge?.destroy?.(),Ke=Math.max(4,Math.ceil(t)),Ge=e.createBuffer({label:`ulg-worker-owned-isosurface-render-field`,size:Ke,usage:Nt(`STORAGE`,jt)|Nt(`COPY_SRC`,Ot)|Nt(`COPY_DST`,kt)}),Ge),rn=async t=>{let n=qt(t),r=ht.get(n);if(r&&!r.released&&r.scalarBuffer===t.scalarBuffer)return r;r&&await en(r);let i=Jt(t),a=w({device:e,volume:i,adapterId:`webgpu-marching-cubes.buffer-volume.v0`,adapterFactory({device:e,volume:t}){return S({device:e,volume:t,adapterId:`webgpu-marching-cubes.buffer-volume.v0`})}}),o={signature:n,scalarBuffer:t.scalarBuffer,volume:i,wrapper:a,released:!1};return ht.set(n,o),o},an=e=>[...e.surfaces||[]].sort((t,n)=>{let r=e=>e.translation?.surfaceDraw?.surfaces?.[0]||e.metadata||{},i=e=>Number.isFinite(Number(r(e).renderOrder))?Number(r(e).renderOrder):Number(r(e).transparencyClassId)||0,a=t=>{let n=$(r(t).boundsCenterM,3),i=$(e.cameraPositionM,3);return n&&i?n.reduce((e,t,n)=>e+(t-i[n])**2,0):0};return i(t)-i(n)||(de(t)===`opaque`?a(t)-a(n):a(n)-a(t))}),on=null,sn=null,cn=Object.freeze({h2o:[.78,.9,.98],ice:[.78,.9,.98],fe:[.55,.56,.6]}),ln=(t,r)=>{if(r?.solidRigidIsosurfaceSplatted===!0)return!1;let a=r?.solidRigidFamily??c(e);return!a||a.destroyed||a.device!==e||!Array.isArray(r.viewProjectionMatrix)?!1:(on??=Ce(e,{colorFormat:n,depthFormat:i}),on.draw(t,a,{viewProjection:_t(r.viewProjectionMatrix),colorLinear:cn[String(a.materials?.[0]).toLowerCase()]??[.7,.7,.72]}),!0)},un=(t,a)=>{let o=a?.deformableSolidFamily??d(e);if(!o||o.destroyed||o.device!==e||!Array.isArray(a.viewProjectionMatrix))return!1;sn??=r(e,{colorFormat:n,depthFormat:i});let s=_t(a.viewProjectionMatrix);for(let e of o.entries)sn.draw(t,e.stage,{viewProjection:s,colorLinear:cn[String(e.material).toLowerCase()]??[.76,.58,.36]});return!0},dn=async(r,{viewProjectionMatrix:c=r.viewProjectionMatrix,cameraPositionM:l=r.cameraPositionM,reason:u=`worker-owned-isosurface-frame`,allowLaggedGeneration:f=!1,requiresVisibleFrame:p=!1,requiresRecoverableFrame:m=!1,playbackRevision:_=null,motionOnly:y=!1,submissionBoundary:x=null,onSubmissionQueued:S=null,submissionDeadlineMs:C=null,expectedFramebufferEpoch:w=null,signal:T=null,motionAgeS:D=r.lastDisplayedMotionAgeS||0}={})=>{let ee=!1,O=()=>!!(!j&&T?.aborted!==!0&&(ee||C==null||Number.isFinite(C)&&E()<=C)&&(_==null||_===B)&&(!y||z)&&r?.invalidationEpoch===N&&(w==null||Number(v())===w)&&r.generation>=Le&&(!p||L===r)&&(!m||R?.frame===r)&&(M===r.generation||f===!0));if(!O())return!1;let te=r.participatingMedium?.status===Ct?r.participatingMedium.packedFrame:null,ne=te?Qt():null;if(await Promise.all([$t().ready,ne?.ready]),!O())return!1;let re=Me||$(c,16),ie=Ne||$(l,3);re&&(r.viewProjectionMatrix=[...re]),ie&&(r.cameraPositionM=[...ie]);let k=$t(),le=typeof o==`function`?null:t.getCurrentTexture(),pe=$(typeof o==`function`?o():[le?.width,le?.height],2);if(!pe||pe.some(e=>!(e>0)))throw Error(`native material presentation requires a positive viewport`);let me;do if(me=Pe,r.nativeSurfaceAppearance=me||r.request.nativeSurfaceMaterial,await k.prepare(r,pe),!O())return!1;while(me!==Pe);Me&&(r.viewProjectionMatrix=[...Me]),Ne&&(r.cameraPositionM=[...Ne]);let ge=Rt(r.viewProjectionMatrix);if(!ge)throw Error(`native material requires an invertible camera`);D=Math.max(D,r.lastDisplayedMotionAgeS||0),r.drawMotionAgeS=D;let _e=!Je&&typeof e.pushErrorScope==`function`&&typeof e.popErrorScope==`function`,ve=!1,A=async()=>ve?(ve=!1,e.popErrorScope()):null,ye,be,xe;_e&&(e.pushErrorScope(`validation`),ve=!0);let Se=!x&&typeof globalThis.GPUDevice==`function`&&e instanceof globalThis.GPUDevice,Ce=e=>{if(!Se)return e();let t=globalThis.__ulgDecoupledPresentationBypassBurst;globalThis.__ulgDecoupledPresentationBypassBurst=!0;try{return e()}finally{globalThis.__ulgDecoupledPresentationBypassBurst=t}};try{let o=e.createCommandEncoder({label:`ulg-worker-owned-isosurface-presentation`}),c=t.getCurrentTexture(),l=c.createView(),u=a(),f=an(r),p=[`opaque-isosurface`],m=(e,t,n={})=>{if(k.draw(e,r,t,{inverse:ge,...n})!==!0)throw Error(`native isosurface draw is missing mandatory GPU buffers`)};if(Ce(()=>{let t=o.beginRenderPass({label:`ulg-worker-owned-isosurface-opaque-pass`,colorAttachments:[{view:l,clearValue:k.clearValue(r),loadOp:`clear`,storeOp:`store`}],depthStencilAttachment:{view:u,depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`store`}});try{k.drawBackground(t,r);let n=r?.deformableSolidFamily??d(e),i=n&&!n.destroyed&&n.device===e&&Array.isArray(r.viewProjectionMatrix)?new Set(n.entries.map(e=>Number(e.domainId)).filter(e=>Number.isFinite(e)&&e>0)):null;for(let e of f)de(e)===`opaque`&&(i&&Number(e?.metadata?.phaseId)===1&&i.has(Number(e?.metadata?.renderDomainId))||m(t,e));ln(t,r),un(t,r)}finally{t.end()}let a=f.filter(e=>de(e)===`refractive`);a.length&&p.push(`refractive-isosurface`);for(let t of a){k.copySceneColor(o,c);let a=o.beginRenderPass({label:`ulg-worker-owned-isosurface-refractive-backface-pass`,colorAttachments:[],depthStencilAttachment:{view:k.backDepthView(),depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`store`}});try{m(a,t,{backface:!0})}finally{a.end()}let s=o.beginRenderPass({label:`ulg-worker-owned-isosurface-refractive-pass`,colorAttachments:[{view:l,loadOp:`load`,storeOp:`store`}],depthStencilAttachment:{view:u,depthLoadOp:`load`,depthStoreOp:`store`}});try{m(s,t,{refractive:!0});let a=r?.request?.nuclearCherenkovSources;if(r?.request&&`nuclearCherenkovSources`in r.request&&!(a?.sources?.length>0))ue(e)?.activeSourceCount>0&&he(e);else{let o=ue(e);if(a?.sources?.length>0&&!(o?.activeSourceCount>0)&&(ce(e,{nuclearDescriptor:a}),o=ue(e)),o?.activeSourceCount>0&&o.cherenkovSourcesBuffer){Ie??=fe(e,{colorFormat:n,depthFormat:i});let a=k.getSurfaceDrawResources?.(r,t),c=t.translation?.surfaceVertices,l=t.translation?.surfaceDraw?.drawIndirectRowsBuffer;a?.opticalRecordsBuffer&&c&&l&&t.uniformBuffer&&Ie.draw(s,{compactPositionRowsBuffer:c.compactPositionRowsBuffer,compactNormalRowsBuffer:c.compactNormalRowsBuffer,drawIndirectRowsBuffer:l,cameraUniformBuffer:t.uniformBuffer,opticalRecordsBuffer:a.opticalRecordsBuffer,motionFieldBuffer:r.motionField?.buffer??null,motionUniformBuffer:a.motionUniformBuffer??null,backDepthView:k.backDepthView(),cherenkovSourcesBuffer:o.cherenkovSourcesBuffer})}}}finally{s.end()}}}),te){p.push(`depth-clipped-participating-medium`);let e=o.beginRenderPass({label:`ulg-worker-owned-participating-medium-pass`,colorAttachments:[{view:l,loadOp:`load`,storeOp:`store`}]});try{await Ee(ne,e,{packedFrame:te,inverseViewProjectionMatrix:ge,cameraPositionM:r.cameraPositionM,viewportSize:pe,depthTextureView:u,lightDirection:[.38,.82,.42],motionField:r.motionField,motionAgeS:Vt(r),decoupledBurstBypass:Se})}finally{e.end()}}if(p.push(`transparent-isosurface-and-overlay`),Ce(()=>{let e=o.beginRenderPass({label:`ulg-worker-owned-isosurface-transparent-overlay-pass`,colorAttachments:[{view:l,loadOp:`load`,storeOp:`store`}],depthStencilAttachment:{view:u,depthLoadOp:`load`,depthStoreOp:`discard`}});try{for(let t of f)de(t)===`vapor`&&m(e,t);s?.(e,r.viewProjectionMatrix,r.boxDimsM)}finally{e.end()}}),xe=Object.freeze(p),!O())return await A(),!1;if(ye=Number(v()),!Number.isSafeInteger(ye)||ye<=0)throw Error(`worker-owned isosurface framebuffer epoch is unavailable`);let h=o.finish();if(be=Z(),Number(v())!==ye||!O())return await A(),!1;Ce(()=>{e.queue.submit([h])}),ee=!0,q+=1,it(),r.lastSubmittedMotionAgeS=D,Le=Math.max(Le,r.generation);let g=ve?await A():null;if(g)throw Error(g.message||String(g));_e&&(Je=!0)}catch(e){try{await A()}catch{}throw e}if(!O()||Number(v())!==ye)return!1;if(typeof e.queue?.onSubmittedWorkDone!=`function`)throw Error(`worker-owned isosurface presentation queue completion is unavailable`);let we=typeof b==`function`?Number(b()):Ye+1;if(!Number.isSafeInteger(we)||we<=Ye)throw Error(`worker-owned isosurface presentation queue completion serial did not advance`);Ye=we;let Te=Ce(()=>e.queue.onSubmittedWorkDone()),De=!1,Oe=Promise.resolve(Te).then(()=>{De=!0,tt===Oe&&(tt=null)},()=>{tt===Oe&&(tt=null)});tt=Oe;let P=(()=>{try{if(typeof g!=`function`)throw Error(`worker-owned isosurface presentation opportunity observer is unavailable`);return Promise.resolve(g({afterGpuCompletion:Te,isCurrent:()=>O()&&Number(v())===ye,signal:T})).then(e=>{if(e?.available===!0&&!De)throw Error(`worker-owned isosurface presentation opportunity preceded GPU completion`);return e})}catch(e){return Promise.reject(e)}})();if(P.catch(()=>{}),S?.(),await Te,!O()||Number(v())!==ye)return!1;let ke=Z(),F=Math.min(40,Math.max(0,ke-be));J=Math.max(F,J*.85+F*.15);let I=await P,Ae=I?.available===!1&&I.method===`worker-request-animation-frame-timeout`;if(!Ae&&(!O()||Number(v())!==ye))return!1;if(I?.available!==!0)throw new(Ae?Mt:Error)(`worker-owned isosurface lacked a post-GPU presentation opportunity`);let je=Number.isFinite(Number(I.observedAtMs))?Number(I.observedAtMs):Z(),Fe=Ut(r.opticalMetadataSnapshots||r.surfaces);r.presentationPassOrder=xe;let V=Bt(r),Re=Object.freeze({presentationFrameSchema:mt,presentationFrameStatus:`worker-owned-isosurface-presentation-opportunity`,presentationFrameAdmitted:!0,nativeMaterialShader:`existing-native-compact-surface-with-retained-motion`,condensedDepthTestEnabled:!0,condensedDepthWriteEnabled:!0,vaporDepthTestEnabled:!0,vaporDepthWriteEnabled:!1,isosurfaceTemporalPresentation:D>0,isosurfacePresentationMotionAgeS:D,isosurfacePresentationSourceTimeS:r.sourceTimeS??null,isosurfacePresentationMotionMethod:D>0?`bounded-gpu-field-velocity-extrapolation`:`committed-source-mesh`,presentationOnly:D>0,authoritativeStateMutation:!1,presentationFrameGpuCompleted:!0,presentationFrameGpuCompletionMethod:`worker-device.queue.onSubmittedWorkDone`,presentationFramePresentationOpportunity:!0,presentationFramePresentationOpportunityMethod:I.method??null,presentationFrameSubmitToGpuCompleteMs:Math.max(0,ke-be),presentationFrameSubmitToPresentationOpportunityMs:Math.max(0,je-be),presentationQueueCompletionCount:Ye,presentationQueueCompletionSerial:we,presentationQueueCompletionMethod:`worker-device.queue.onSubmittedWorkDone`,presentationQueueCompletionScope:ae,physicsQueuePrefixCoverage:x?oe:se,physicsHostQueueFenceParticipation:x?!0:null,...x?{physicsContinuationBlocked:!0,presentationQosHostQueueFenceCount:1,motionPresentationQosBoundary:x}:{},workerFramebufferEpoch:ye,workerOwnedOpticalPresentation:Fe,workerOwnedParticipatingMediumPresentation:V,presentationComposition:V.presentationComposition,marchingCubesSurfaceCount:V.marchingCubesSurfaceCount,collectiveOpticalSurfaceCount:V.collectiveOpticalSurfaceCount,participatingMediumStatus:V.status,participatingMediumAggregateDrawCount:V.participatingMediumAggregateDrawCount,collectiveOpticalShellFallbackCount:V.collectiveOpticalShellFallbackCount,participatingMediumDepthClipped:V.participatingMediumDepthClipped,participatingMediumPremultipliedAlpha:V.participatingMediumPremultipliedAlpha,presentationPassOrder:V.presentationPassOrder});r.lastDisplayedMotionAgeS=D;try{h?.({reason:u,generation:r.generation,surfaceCount:r.totalSurfaceCount??r.surfaces.length,sphStep:r.sphStep,...Re})}catch{}return Re},fn=0,pn=0,mn=null,hn=e=>{pn+=1;let t=H.then(e);return H=t.then(e=>{--pn,e&&(mn=E())},()=>{--pn}),t},gn=()=>mn==null||E()-mn>16.666666666666668,_n=(e,t)=>hn(()=>dn(e,t)),vn=e=>{if(j||!z||L!==e||!e?.motionField?.buffer||!e.motionPacing||e.invalidationEpoch!==N||e.generation<Le)return!1;let t=A(e.motionPacing,E());return t>(e.lastDisplayedMotionAgeS||0)&&t<e.motionPacing.maxSimulationAgeS},yn=({waitForPendingSlot:e=!1}={})=>typeof e!=`boolean`||W||!gn()&&(U||pn>0)?!1:(e||!U)&&vn(L),bn=()=>{V+=1,Re!=null&&globalThis.clearTimeout(Re),Re=null,ze?.(),ze=null},xn=t=>{if(bn(),!z||!t?.motionField?.buffer||!t.motionPacing)return;let n=V,r=B,i=je.signal,a=()=>!j&&L===t&&z&&r===B&&t.invalidationEpoch===N&&V===n,o=Symbol(`coalesced-isosurface-temporal-frame`),s=!1,c=!1;(async()=>{for(;a();){let n=E(),l=A(t.motionPacing,n);if(l==null||s&&l>=t.motionPacing.maxSimulationAgeS)return;let u=null;if(l>(t.lastDisplayedMotionAgeS||0)){try{u=await hn(()=>{if(!a())return!1;let e=A(t.motionPacing,E());if(e==null||s&&e>=t.motionPacing.maxSimulationAgeS)return!1;let n=t.lastDisplayedMotionAgeS||0;if(!(e>n))return o;let c=Math.fround(Vt({motionPacing:t.motionPacing,drawMotionAgeS:n}));return Math.fround(Vt({motionPacing:t.motionPacing,drawMotionAgeS:e}))>c?dn(t,{reason:`worker-owned-isosurface-temporal-presentation`,allowLaggedGeneration:!0,requiresVisibleFrame:!0,playbackRevision:r,motionOnly:!0,signal:i,motionAgeS:e}):e>=t.motionPacing.maxSimulationAgeS?!1:o})}catch(e){if(!(e instanceof Mt))throw e;if(!a())return;t.temporalPresentationError=e.message;let n=A(t.motionPacing,E());if(!Number.isFinite(n)||n>=t.motionPacing.maxSimulationAgeS)return;s=!0,u=o}if(!u||!a())return;u!==o&&(s=!1,t.temporalPresentationError=null,Sn(t,`presentation-only retained GPU field motion`,u))}if((t.lastDisplayedMotionAgeS||0)>=t.motionPacing.maxSimulationAgeS)return;let d=typeof globalThis.GPUDevice==`function`&&e instanceof globalThis.GPUDevice,f=!!(u&&u!==o&&(Number(u.presentationFrameSubmitToPresentationOpportunityMs)>=4||d&&u.presentationFramePresentationOpportunityMethod===`worker-request-animation-frame-after-gpu-completion`)),p=Math.max(Y,Xe+J),m=!!(I||F||K>0||X!=null&&t.sourceTimeS!=null&&X>=t.sourceTimeS);if(!t.buildHandoffSlowed&&m&&p>=1&&t.motionPacing&&(t.lastDisplayedMotionAgeS||0)>=t.motionPacing.maxSimulationAgeS*.5&&(t.lastDisplayedMotionAgeS||0)<t.motionPacing.maxSimulationAgeS){t.buildHandoffSlowed=!0;let e=Math.min(.2,Math.max(.12,Y*1.25/1e3,(Xe*2+J*1.5)/1e3)),n=be(t.motionPacing,E(),e,t.lastDisplayedMotionAgeS||0);n!==t.motionPacing&&(t.motionPacing=n)}let h=1e3/t.motionPacing.targetHz-(E()-n),g=d?0:2;!u&&!c&&(t.lastDisplayedMotionAgeS||0)===0&&h>g?(c=!0,h=g):d&&u===o&&h>1&&(h=1),(h>0||d&&!u&&c&&(t.lastDisplayedMotionAgeS||0)===0)&&!f&&a()&&await new Promise(e=>{ze=e,Re=globalThis.setTimeout(()=>{Re=null,ze=null,e()},Math.max(0,h))})}})().catch(e=>{a()&&(t.temporalPresentationError=String(e?.message||e))})},Sn=(e,t,n)=>{let r=Bt(e),a=e.surfaces.length+r.participatingMediumAggregateDrawCount;gt({generation:e.generation,receiptFields:e.receiptFields},ut,{reason:t,surfaceCount:e.totalSurfaceCount??e.surfaces.length,submittedSurfaceCount:a,activeSurfaceCount:null,indirectDrawCount:a,depthAttachmentFormat:i,depthAttachmentReady:!0,boxWireframeDrawCount:+!!e.boxDimsM,boxDimsM:e.boxDimsM?[...e.boxDimsM]:null,nonemptySurfaceCountMode:`gpu-indirect-not-read-back`,triangleCountMode:`gpu-indirect-not-read-back`,readbackMode:vt,...n})},Cn=(t,n,r,i)=>{let a=t.ledgerParcelsBorrow?.parcels??null;if(!a||a.device!==e||globalThis.__ulgDisableLedgerParcelOptics)return null;let o=r.surfaceTable.metadata,s=i.consumedSurfaceIndices.find(e=>Number(o[e]?.materialId)===a.vaporMaterialId),c=s==null?null:o[s],l=globalThis.__ulgLedgerParcelOptics??={frames:0,routed:0,unrouted:0};return l.frames++,c?(l.routed++,De({device:e,encoder:n,parcels:a,fieldRowsBuffer:i.fieldRowsBuffer,fieldOffset:Number(c.fieldOffset),resolution:Number(c.resolution),fieldPadding:Number(r.fieldPadding),refEdgeM:Number(r.refEdgeM)})):(l.unrouted++,null)},wn=async(t,n)=>{let r=Z();if((n?.dispersedMediumOptics??null)!==t.dispersedMediumOptics)throw TypeError(`worker-owned isosurface capture did not retain its exact dispersed-medium sidecar`);let i=await nn(t.request.surfaceTable.totalFieldCells*T*Float32Array.BYTES_PER_ELEMENT),a=t.productEvents,o=await k({device:e,renderRows:n.renderRows,renderRowsBuffer:n.renderRowsBuffer,renderRowsSource:n,dispersedMediumOptics:t.dispersedMediumOptics,schroederSpatialSourceFamily:n.schroederSpatialSourceFamily,surfaceTable:t.request.surfaceTable,particleCount:n.particleCount,productEventBuffer:a.productEventBuffer,productEventSource:a.productEventSource,productEventCount:a.productEventCount,productEventLiveCountDescriptor:a.productEventLiveCountDescriptor,fieldPadding:Number(t.request.fieldPadding),refEdgeM:Number(t.request.refEdgeM),renderSmearDtS:Math.max(0,Number(t.request.renderSmearDtS)||0),readbackMode:vt,retainFieldRowsBuffer:!0,retainMotionFieldBuffer:!0,retainSurfaceBuffer:!1,waitForQueueCompletion:!1,deferCleanup:!0,targetFieldRowsBuffer:i,targetFieldRowsBufferByteLength:Ke});St(t),Et(t),xt(n,`worker-isosurface-render-field-submitted`),t.capturedReleased=!0,typeof globalThis.GPUDevice==`function`&&e instanceof globalThis.GPUDevice&&z&&L?.motionField?.buffer&&(await ct(50),await new Promise(e=>globalThis.setTimeout(e,0)));let s=o.surfaceTable.metadata.map(Lt),c=s.map((t,n)=>ne({device:e,renderField:o,surface:o.surfaceTable.metadata[n],surfaceIndex:n})),l=c.find(e=>e?.ok!==!0);if(l)throw o.destroyRenderFieldBuffers?.({force:!0,releaseLeases:!0,reason:`worker-isosurface-descriptor-blocked`}),Error(l.reason||l.status);let u,d,f=null,m=new Set,h;try{if(u=Object.freeze(c.map((e,t)=>Object.freeze({descriptor:e,metadata:s[t]}))),d=s.map((e,t)=>zt(e)?t:-1).filter(e=>e>=0),d.length>0){f=Se({device:e,renderField:o,surfaceDescriptors:d.map(e=>u[e])});let t=f?.status;if(![Ct,wt,Tt].includes(t))throw TypeError(`participating-medium descriptor returned an unknown route status`);let n=f.consumedSurfaceIndices;if(!Array.isArray(n))throw TypeError(`participating-medium descriptor omitted consumed surface indices`);m=new Set(n);let r=new Set(d);if(!(m.size===r.size&&[...m].every(e=>Number.isSafeInteger(e)&&r.has(e))))throw TypeError(`participating-medium descriptor did not consume the exact collective optical route set`)}h=c.filter((e,t)=>!m.has(t))}catch(e){throw o.destroyRenderFieldBuffers?.({force:!0,releaseLeases:!0,reason:`worker-participating-medium-descriptor-failed`}),e}let g=e.createCommandEncoder({label:`ulg-worker-owned-isosurface-marching-cubes`}),v=[],b=[],x=null,S=null,w=null,E=t.solidRigidFamily??null,D=!1;try{E&&(w=ee({device:e,encoder:g,family:E,renderField:o}),D=!!w);for(let n of h){let r=await rn(n);C({device:e,descriptor:n,volume:r.volume});let i=await r.wrapper.extractSurface({volume:r.volume,isovalue:n.isovalue,ownsBuffer:!0,readbackMode:yt,vertexRowsBudget:Math.max(3,Math.floor(Number(t.request.vertexRowsBudget)||3)),commandEncoder:g}),a=Yt(i);if(a?.ok===!1||!a?.result)throw Error(i?.reason||a?.status||`worker-owned marching-cubes extraction failed`);let o={descriptor:n,wrapped:i,rawExecution:a,temperatureRows:null};v.push(o);let s=a.result,c=s.outputDescriptors?.rows?.position||s.rowMetadata?.position,l=c?.buffer||s.outputDescriptors?.retainedBuffers?.position||s.buffer,u=s.actualVertexCounterBuffer||s.vertexCounterBuffer;o.temperatureRows=te({device:e,commandEncoder:g,compactPositions:{buffer:l,byteLength:c?.bufferByteLength??s.bufferByteLength??l?.size,rowCount:c?.rowCount??s.vertexCount,strideFloats:c?.rowStrideFloats??s.vertexStrideFloats,surfaceGenerationId:s.surfaceGenerationId,volumeGenerationId:s.volumeGenerationId},actualVertexCounter:{buffer:u,byteLength:s.actualVertexCounterBufferByteLength??s.vertexCounterBufferByteLength??u?.size},renderField:{buffer:n.scalarBuffer,byteLength:n.scalarBufferByteLength,dims:n.dims,scalarStrides:n.scalarStrides,scalarOffsetFloats:n.scalarOffset,volumeGenerationId:s.volumeGenerationId},generation:{surfaceGenerationId:s.surfaceGenerationId,volumeGenerationId:s.volumeGenerationId}})}if(f?.status===Ct&&(S=Cn(t,g,o,f),x=await Te(Qt(),g,f),x?.status!==`participating-medium-packed-gpu-resident`||x.readback!==!1))throw TypeError(`participating-medium pack did not return an exact GPU-resident no-readback frame`);if(typeof globalThis.GPUDevice==`function`&&e instanceof globalThis.GPUDevice&&z&&L?.motionField?.buffer&&(await ct(50)||h.length>=6||J>=5.5)&&await new Promise(e=>globalThis.setTimeout(e,0)),e.queue.submit([g.finish()]),w||S){let t=w,n=S;w=null,S=null,_(e,()=>{t?.destroy?.(),n?.destroy?.()})}for(let e of v)e.rawExecution.result?.retireTemporaryResourcesAfterSubmit?.();let n=[];for(let t of v){let r=t.descriptor,i=s[r.surfaceIndex],a=await O({device:e,extensionExecution:t.rawExecution,schroederSpatialSourceFamily:o.schroederSpatialSourceFamily,surfaceIndex:r.surfaceIndex,materialId:i.materialId,phaseId:i.phaseId,opticalStateId:i.opticalStateId,material:i.material,phase:i.phase,renderKey:i.renderKey,surfaceKey:i.surfaceKey,isolation:r.isovalue,transparencyClassId:i.transparencyClassId,depthWriteFlag:i.depthWriteFlag,renderOrder:i.renderOrder,positionTransform:r.positionTransform,positionTransformResolution:i.resolution,sourceVoxelLinearIndex:r.fieldOffset,fieldPadding:o.fieldPadding,refEdgeM:o.refEdgeM,positionGridBias:r.positionTransformGridBias,fieldGradient:{buffer:r.scalarBuffer,scalarOffsetFloats:r.scalarOffset,rowStrideFloats:r.cellRowStrideFloats,resolution:i.resolution},readbackMode:vt,compactSummaryReadback:!1,translateVertexRows:!1,allowExtensionDrawIndirectBuffer:!0,retainVertexRowsBuffer:!0,retainDrawRowsBuffer:!0,retainDrawIndirectRowsBuffer:!0,waitForQueueCompletion:!1}),c=Nt(`UNIFORM`,At)|Nt(`COPY_DST`,kt),l=typeof globalThis.GPUDevice==`function`&&e instanceof globalThis.GPUDevice?y(p(e,{bucketKey:`ulg-worker-owned-isosurface-uniform`,label:`ulg-worker-owned-isosurface-uniform-${r.surfaceIndex}`,size:pe,usage:c}),e,{bucketKey:`ulg-worker-owned-isosurface-uniform`,size:pe,usage:c}):e.createBuffer({label:`ulg-worker-owned-isosurface-uniform-${r.surfaceIndex}`,size:pe,usage:c}),u=t.temperatureRows;a.nativeSurfaceTemperatureRows=u,Object.assign(a.surfaceDraw,{compactTemperatureRowsBuffer:u.temperatureRowsBuffer,compactTemperatureRowsBufferRetained:!0,compactTemperatureRowsBufferByteLength:u.temperatureRowsBufferByteLength,compactTemperatureRowsBufferRowCount:u.temperatureRowsBufferRowCount,compactTemperatureRowsStrideFloats:u.temperatureRowsStrideFloats,compactTemperatureRowsSchema:u.temperatureRowsSchema,compactTemperatureRowsLayoutName:u.temperatureRowsLayoutName,compactTemperatureRowsEncoding:u.encoding,compactTemperatureRowsSemantic:u.semantic,compactTemperatureRowsSurfaceGenerationId:u.surfaceGenerationId,compactTemperatureRowsVolumeGenerationId:u.volumeGenerationId,compactTemperatureRowsCoverageSchema:u.coverage.schema,compactTemperatureRowsCoverageComplete:u.coverage.complete,compactTemperatureRowsCoverageRowCount:u.coverage.rowCount,compactTemperatureRowsOwnership:u.temperatureRowsOwnership,compactTemperatureRowsAdditionalSubmitCount:0}),n.push({descriptor:r,metadata:i,translation:a,rawExecution:t.rawExecution,uniformBuffer:l,releaseTemperatureRows:()=>Zt(u),bindGroups:new Map}),b.push(n[n.length-1])}let i=o.takeMotionField?.()||null;o.destroyRenderFieldBuffers?.({force:!0,releaseLeases:!0,reason:`worker-isosurface-extraction-submitted`});let a=Math.min(200,Math.max(0,Z()-r));return Xe=Xe>0?Math.max(a,Xe*.7+a*.3):a,{generation:t.generation,invalidationEpoch:t.invalidationEpoch,sphStep:t.sphStep,sourceTimeS:t.sourceTimeS,motionField:i,request:t.request,receiptFields:t.receiptFields,viewProjectionMatrix:[...t.admission.viewProjectionMatrix],cameraPositionM:[...t.admission.cameraPositionM],boxDimsM:$(t.request.boxDimsM,3),totalSurfaceCount:s.length,opticalMetadataSnapshots:s,participatingMedium:f?{status:f.status,reason:f.reason??null,collectiveSurfaceCount:d.length,consumedSurfaceCount:m.size,packedFrame:x,released:!1}:null,solidRigidFamily:E??null,solidRigidIsosurfaceSplatted:D,surfaces:n}}catch(e){w?.destroy(),S?.destroy(),o.destroyRenderFieldBuffers?.({force:!0,releaseLeases:!0,reason:`worker-isosurface-extraction-failed`});for(let e of b)Xt(e,`worker-isosurface-partial-translation-failed`);let t=new Set(b.map(e=>e.rawExecution));for(let e of v)if(!t.has(e.rawExecution)){e.temperatureRows&&Zt(e.temperatureRows);try{e.rawExecution?.result?.release?.()}catch{}}if(x)try{Oe(x)}catch{}throw e}},Tn=(t,n,r,i)=>{let a=L;if(L=t,X!=null&&t.sourceTimeS!=null&&t.sourceTimeS>X&&(X=null),L.sourcePresentedAtMs=E(),Qe!=null&&a&&a.sourceTimeS===et){let e=Math.min(260,Math.max(0,L.sourcePresentedAtMs-Qe));Y=Y>0?Math.max(e,Y*.7+e*.3):e,Qe=null,et=null}L.sourcePresentationPausedWallMs=D.pausedAt(L.sourcePresentedAtMs);let o=a?a.sourcePresentationPausedWallMs:t.sourceTimingPausedWallMs;L.motionPacing=_e(L,a,L.sourcePresentedAtMs,n,{pausedWallDeltaMs:o==null?NaN:L.sourcePresentationPausedWallMs-o}),xn(L),a&&_(e,()=>{Q(a,`worker-isosurface-replaced`)}),Sn(L,r,i)},En=async()=>{if(!(P||j)){P=!0;try{for(;I&&!j;){let e=I;I=null,F=e;let t=null,n=null;try{if(t=await e.capturePromise,e.invalidationEpoch!==N||j){gt(e,ft,{reason:`the worker-owned isosurface presentation was invalidated`});continue}if(n=await(le??wn)(e,t),n.request=e.request,n.sourceTimeS=e.sourceTimeS,n.sourceTimingPausedWallMs=e.sourceTimingPausedWallMs,e.invalidationEpoch!==N||j)if(!j&&e.invalidationEpoch!==N&&M===e.generation&&Ue===N)e.invalidationEpoch=N,n.invalidationEpoch=N;else{Q(n,`worker-isosurface-superseded-before-presentation`),n=null,gt(e,ft,{reason:`the worker-owned isosurface presentation was invalidated`});continue}if(L&&L.generation>=n.generation){Q(n,`worker-isosurface-older-than-visible-frame`),n=null,gt(e,ft,{reason:`a newer isosurface generation is already visible`});continue}let r=!1,i=()=>!j&&F===e&&M===e.generation,a=async e=>{for(;;)try{return await hn(()=>r&&!i()?!1:dn(n,{reason:e,allowLaggedGeneration:!r}))}catch(e){if(!(e instanceof Mt))throw e;if(!i())return!1;if(r)throw e;r=!0}},o=await a(`committed-worker-isosurface`);for(;!o?.presentationFrameAdmitted&&n.invalidationEpoch!==N&&M===e.generation&&Ue===N&&N>n.invalidationEpoch&&!j;){let t=N;e.invalidationEpoch=t,n.invalidationEpoch=t,o=await a(`committed-worker-isosurface-after-resize`)}if(!o?.presentationFrameAdmitted){if(n.invalidationEpoch!==N||j||M!==e.generation){Q(n,`worker-isosurface-invalidated-during-presentation`),n=null,gt(e,ft,{reason:`the worker-owned isosurface presentation was invalidated during submit`});continue}throw Error(`worker-owned isosurface frame was not current at submit`)}Tn(n,e.sourceTimingBootstrap,`same-device retained state rendered as true isosurface`,o),n=null}catch(t){t instanceof Mt&&n&&!j&&n.generation===M&&n.generation===Le&&n.invalidationEpoch===N&&(Ht(`worker-isosurface-recovery-replaced`),R=Object.freeze({frame:n,sourceTimingBootstrap:e.sourceTimingBootstrap,parkedAfterRedrawSequence:Ae}),n=null),n&&Q(n,`worker-isosurface-build-failed`),gt(e,dt,{reason:t instanceof Error?t.message:String(t),...Wt(t)})}finally{t&&!e.capturedReleased&&xt(t,`worker-isosurface-capture-retired`),St(e),Et(e),Dt(e),F=null}}}finally{P=!1}}},Dn=()=>{if(ke||j)return;let e=En();ke=e,e.finally(()=>{ke===e&&(ke=null),I&&!j&&Dn()})},On=(e,t)=>{e&&(St(e),Et(e),Dt(e),e.capturePromise.then(e=>{xt(e,`worker-isosurface-queued-job-superseded`)}).catch(()=>{}),gt(e,ft,{reason:t}))},kn=()=>{G&&=(G.resolve(!1),null)},An=()=>{for(let e of We)e();We.clear()},jn=()=>{K=Math.max(0,K-1),K===0&&An()},Mn=()=>K===0?Promise.resolve():new Promise(e=>We.add(e)),Nn=async()=>{for(;G&&!j;){let e=G.allowCandidateRecovery&&G.requestSequence>(R?.parkedAfterRedrawSequence??1/0)&&R?.frame.generation===M&&R.frame.generation===Le&&R.frame.invalidationEpoch===N?R:null,t=e||L&&L.invalidationEpoch===N&&L.generation>=Le;if(!t){if(ke){await ke.catch(()=>{});continue}if(K>0){await Mn();continue}}let n=G;G=null;let r=e?.frame||L;if(!t){n.resolve(!1);continue}try{let t=await _n(r,{...n.options,allowLaggedGeneration:!e,requiresVisibleFrame:!e,requiresRecoverableFrame:!!e});if(e&&t&&R===e&&r.generation===M&&r.invalidationEpoch===N&&!j){R=null,Tn(r,e.sourceTimingBootstrap,n.options.reason,t),n.resolve(!0);continue}let i=!!(!e&&t&&L===r&&r.invalidationEpoch===N&&r.generation>=Le&&!j);if(i)Sn(r,n.options.reason,t);else if(!j&&!G&&(F||I||K>0)){G=n;continue}n.resolve(i)}catch(t){e&&R?.frame.generation===e.frame.generation&&!(t instanceof Mt)&&Ht(`worker-isosurface-recovery-failed`),n.reject(t)}}},Pn=()=>{if(He||j||!G)return;let e=Nn();He=e,e.finally(()=>{He===e&&(He=null),Pn()})},Fn=(e,{allowCandidateRecovery:t=!1}={})=>{if(j)return Promise.resolve(!1);let n=++Ae,r=$(e?.viewProjectionMatrix,16),i=$(e?.cameraPositionM,3);if(r&&(Me=[...r]),i&&(Ne=[...i]),e?.nativeSurfaceAppearance!=null&&(Pe=structuredClone(e.nativeSurfaceAppearance)),j||!L&&!R&&K===0&&!F&&!I)return Promise.resolve(!1);let a,o,s=new Promise((e,t)=>{a=e,o=t});return kn(),G={options:e,allowCandidateRecovery:t,requestSequence:n,resolve:a,reject:o},Pn(),s};return Object.freeze({async enqueue({request:t,retained:n,sphStep:r=null,receiptFields:i={},sourceTimingBootstrap:a=null}={}){if(j)return Gt({status:dt,reason:`worker-owned isosurface presenter is disposed`,...i});let o=Kt({request:t,retained:n});if(!o.ok)return Gt({status:dt,reason:o.reason,admission:o,...i});t={...t,nativeSurfaceMaterial:o.nativeSurfaceMaterial},M+=1,Ht(`worker-isosurface-recovery-superseded`);let s=M,c=n.sphParticleUpload?.time,d=typeof c==`number`&&Number.isFinite(c)?c:null;a=xe(a);let p=a?D.pausedAt(a.sourceObservedAtMs):null,m=N,h,g=null,_=null,v=null;try{let t=It(e,n.sphParticleUpload);v=t?.sidecar??null,_=t?.release??null,h=Pt({device:e,retained:n}),g=Ft(h.productEventSource)}catch(e){return _?.(),g?.(),Gt({status:dt,reason:e instanceof Error?e.message:String(e),requestGeneration:s,sourceCapturedBeforePhysicsContinuation:!1,admission:o,...i,...Wt(e),updatedAtMs:Z()})}let y;K+=1;try{y=await re({device:e,sphParticleState:n.sphParticleState,mlsMpmParticleState:n.mlsMpmParticleState,sphParticleUpload:n.sphParticleUpload,mlsMpmParticleUpload:n.mlsMpmParticleUpload,sourceStateBuffer:n.sourceStateBuffer,sourceThermoBuffer:n.sourceThermoBuffer,sourceIdentityBuffer:n.sourceIdentityBuffer,sourceMechanicsBuffer:n.sourceMechanicsBuffer,schroederSpatialSourceFamily:n.successorSourceFamily,retainRenderRowsBuffer:!0,readbackMode:vt})}catch(e){return jn(),g?.(),_?.(),Gt({status:dt,reason:e instanceof Error?e.message:String(e),requestGeneration:s,sourceCapturedBeforePhysicsContinuation:!1,admission:o,...i,...Wt(e),updatedAtMs:Z()})}if(jn(),(y?.dispersedMediumOptics??null)!==v)return g?.(),_?.(),xt(y,`worker-isosurface-dispersed-medium-capture-mismatch`),Gt({status:dt,reason:`worker-owned isosurface capture did not retain its exact dispersed-medium sidecar`,requestGeneration:s,sourceCapturedBeforePhysicsContinuation:!0,admission:o,...i,updatedAtMs:Z()});let b=!!(j||m!==N),x=!!(!j&&b&&M===s&&Ue===N);if(b&&!x)return g?.(),_?.(),xt(y,`worker-isosurface-capture-invalidated-before-enqueue`),Gt({status:ft,reason:`worker-owned isosurface source capture was invalidated before enqueue`,requestGeneration:s,sourceCapturedBeforePhysicsContinuation:!0,admission:o,...i,updatedAtMs:Z()});let S={sourceTimeS:d,sourceTimingBootstrap:a,sourceTimingPausedWallMs:p,generation:s,request:t,retained:n,admission:o,sphStep:r,receiptFields:i,productEvents:h,dispersedMediumOptics:v,ledgerParcelsBorrow:u(n.sphParticleUpload),solidRigidFamily:l(n.sphParticleUpload)??(n.sphParticleState?.rigidBodies?f(n.sphParticleUpload,n.sphParticleState.rigidBodies,e):null),releaseProductEventSourceBorrow:g,productEventSourceBorrowReleased:!1,releaseDispersedMediumSourceBorrow:_,dispersedMediumSourceBorrowReleased:!1,capturePromise:Promise.resolve(y),invalidationEpoch:x?N:m,capturedReleased:!1};return I&&On(I,`a newer committed isosurface request replaced this queued request`),I=S,Dn(),Gt({status:lt,reason:`exact committed retained source capture submitted before continuation`,requestGeneration:s,sourceCapturedBeforePhysicsContinuation:!0,surfaceCount:o.surfaceCount,totalFieldCells:o.totalFieldCells,particleCount:o.particleCount,readbackMode:vt,...i,updatedAtMs:Z()})},setPresentationPlaying(e){if(typeof e!=`boolean`)throw TypeError(`presentation playing must be a boolean`);if(j||e===z)return!1;let t=E();return D.setPlaying(e,t),z=e,B+=1,je.abort(),je=new AbortController,bn(),e||(X=null,Qe=null,et=null,it(!0)),e?L?.motionPacing&&(L.motionPacing=ye(L.motionPacing,t,L.lastDisplayedMotionAgeS||0),xn(L)):L&&L.lastSubmittedMotionAgeS>(L.lastDisplayedMotionAgeS||0)&&Fn({reason:`worker-isosurface-pause-frozen-redraw`,playbackRevision:B}).catch(()=>{}),!0},async redraw({viewProjectionMatrix:e=null,cameraPositionM:t=null,nativeSurfaceAppearance:n=null,reason:r=`worker-owned-isosurface-camera-redraw`}={}){return Fn({viewProjectionMatrix:e,cameraPositionM:t,nativeSurfaceAppearance:n,reason:r},{allowCandidateRecovery:!0})},beginPendingSourceProgress({scheduleId:e,laneId:t,stateKey:n,presentationLaneEpoch:r,sourceTimeS:i,totalStepCount:a}={}){let o=++fn,s=N,c=E(),l=D.pausedAt(c);if(j||typeof e!=`string`||!e.trim()||typeof t!=`string`||!t.trim()||typeof n!=`string`||!n.trim()||!Number.isSafeInteger(r)||r<=0||typeof i!=`number`||!Number.isFinite(i)||i<0||!Number.isSafeInteger(a)||a<=1||!Number.isFinite(c)||c<0)return null;X=i;let u=null,d=0,f=c,p=!1;return m=>{if(p||j||!z||o!==fn||s!==N||u&&L!==u||m?.scheduleId!==e)return!1;let h=m.stepOrdinal,g=E();if(!Number.isSafeInteger(h)||h<=d||h>a||m.completedStepCount!==h||!Number.isFinite(g)||g<f)return!1;if(d=h,f=g,h===a){if(p=!0,Qe=g,et=i,!u){let e=L;e?.motionField?.buffer&&e.motionPacing&&e.invalidationEpoch===s&&e.sourceTimeS===i&&e.receiptFields?.laneId===t&&e.receiptFields?.stateKey===n&&e.receiptFields?.presentationLaneEpoch===r&&(u=e)}if(u&&Math.max(Y,Xe+J)>=1){let e=Math.min(.26,Math.max(.06,Y*1.15/1e3,(Xe*2.5+J*1.5)/1e3)),t=be(u.motionPacing,g,e,u.lastDisplayedMotionAgeS||0);t!==u.motionPacing&&(u.motionPacing=t)}return!1}if(!u){let e=L;if(!e?.motionField?.buffer||!e.motionPacing||e.invalidationEpoch!==s||e.sourceTimeS!==i||e.receiptFields?.laneId!==t||e.receiptFields?.stateKey!==n||e.receiptFields?.presentationLaneEpoch!==r)return!1;u=e}let _=g-c-(D.pausedAt(g)-l),v=Math.max(Y,Xe+J)>=1?Math.min(.26,Math.max(.06,Y*1.15/1e3,(Xe*2.5+J*1.5)/1e3)):0,y=_/1e3*(a-h)/h+v,b=be(u.motionPacing,g,y,u.lastDisplayedMotionAgeS||0);return b===u.motionPacing?!1:(u.motionPacing=b,!0)}},hasSubmissionBoundaryOpportunity(){let e=L;if(j||!z||pn>0||tt!=null||!e?.motionField?.buffer||!e.motionPacing||e.invalidationEpoch!==N)return!1;let t=A(e.motionPacing,E()),n=e.lastDisplayedMotionAgeS||0;if(!(t>n)||!(t<e.motionPacing.maxSimulationAgeS))return!1;let r=Math.fround(Vt({motionPacing:e.motionPacing,drawMotionAgeS:n}));return Math.fround(Vt({motionPacing:e.motionPacing,drawMotionAgeS:t}))>r},getPresentationSubmitSerial(){return q},waitForPresentationSubmitTurn({afterSerial:e=q,timeoutMs:t=12,force:n=!1}={}){return pt({afterSerial:e,timeoutMs:t,force:n})},hasRetainedSubmissionGapOpportunity:yn,presentRetainedSubmissionGap({signal:e=null,waitForPendingSlot:t=!1}={}){if(e?.aborted||!yn({waitForPendingSlot:t}))return Promise.resolve(!1);let n=L,r=N,i=Number(v());if(!Number.isSafeInteger(i)||i<=0)return Promise.resolve(!1);let a=E()+1e3/60,o=U,s=new AbortController,c=AbortSignal.any([s.signal,je.signal,...e?[e]:[]]),l=B,u,d=!1,f=new Promise(e=>{u=e}),p,m=new Promise(e=>{p=e}),h,g={abort:()=>s.abort(),completed:new Promise(e=>{h=e})},_=null,y=e=>{d||(d=!0,globalThis.clearTimeout(_),u(e))},b=()=>{y(!1),p(!1)};c.addEventListener(`abort`,b,{once:!0});let x=e=>{y(!1),c.removeEventListener(`abort`,b),U===g&&(U=null),W===g&&(W=null),h(e===!0&&!c.aborted)},S=()=>!c.aborted&&!j&&z&&l===B&&N===r&&L===n&&n.invalidationEpoch===r&&Number(v())===i&&E()<=a;_=globalThis.setTimeout(()=>s.abort(),1e3/60);let C=()=>{try{if(!S()||U||!vn(n)){x(!1);return}W===g&&(W=null),U=g,hn(async()=>{if(!S()||!vn(n))return!1;let e=await dn(n,{reason:`worker-owned-isosurface-retained-submission-gap`,allowLaggedGeneration:!0,requiresVisibleFrame:!0,playbackRevision:l,motionOnly:!0,signal:c,motionAgeS:A(n.motionPacing,E()),submissionDeadlineMs:a,expectedFramebufferEpoch:i,onSubmissionQueued:()=>y(!0)});return e&&Sn(n,`presentation-only retained mesh between physics submissions`,e),e}).then(e=>x(!!e),()=>x(!1))}catch{x(!1)}};return o?(W=g,Promise.race([o.completed,m]).then(e=>{e===!0?C():x(!1)},()=>x(!1))):C(),f},presentSubmissionBoundary(e,{signal:t=null}={}){if(t?.aborted||j||!z||!e||![`submissionOrdinal`,`completedSubstepCount`,`totalSubstepCount`,`chunkStepCount`].every(t=>Number.isSafeInteger(e[t])&&e[t]>0)||e.completedSubstepCount>=e.totalSubstepCount||e.chunkStepCount>e.completedSubstepCount)return Promise.resolve(!1);let n=Object.freeze({...e}),r=B,i=t?AbortSignal.any([t,je.signal]):je.signal;return hn(async()=>{if(i.aborted||r!==B)return!1;let e=L;if(!e?.motionField?.buffer||!e.motionPacing)return!1;let t=A(e.motionPacing,E());if(!(t>(e.lastDisplayedMotionAgeS||0)))return!1;let a=await dn(e,{reason:`worker-owned-isosurface-submission-boundary`,allowLaggedGeneration:!0,requiresVisibleFrame:!0,motionAgeS:t,submissionBoundary:n,signal:i,playbackRevision:r,motionOnly:!0});return a?(Sn(e,`presentation-only retained mesh at submission boundary`,a),a):!1})},async resize({viewProjectionMatrix:e=null,cameraPositionM:t=null,reason:n=`worker-owned-isosurface-presentation-resize`}={}){if(j)return!1;Ve(),bn();let r=N;if(N+=1,Ue=N,R){let e=R,t=e.frame;if(t.generation===M&&t.invalidationEpoch===r){let n={...t,invalidationEpoch:N};R=Object.freeze({...e,frame:n}),hn(()=>{Fe?.transferFrame(t,n),t.surfaces=[],t.participatingMedium=null,t.motionField=null}).catch(()=>{R?.frame.generation===n.generation&&Ht(`worker-isosurface-recovery-resize-transfer-failed`)})}else Ht(`worker-isosurface-recovery-resize-invalidated`)}if(L&&!(K>0||F||I||R)){let e=L;L={...e,invalidationEpoch:N,surfaces:e.surfaces},Fe?.transferFrame(e,L),e.surfaces=[],e.participatingMedium=null,e.motionField=null}let i=await Fn({viewProjectionMatrix:e,cameraPositionM:t,reason:n},{allowCandidateRecovery:!0});return i&&xn(L),i},clear({reason:t=`worker-owned-isosurface-presentation-clear`}={}){if(j)return!1;Ve(),bn(),X=null,Qe=null,et=null,it(!0),N+=1,Ue=null,M+=1,Ht(t),Me=null,Ne=null,Pe=null,kn(),On(I,t),I=null;let n=L;return L=null,n&&_(e,()=>{Q(n,t)}),!0},getStatus(){let e=Bt(L);return Object.freeze({schema:st,status:j?`worker-owned-isosurface-presenter-disposed`:`worker-owned-isosurface-presenter-ready`,generation:M,presentationPlaying:z,presentationPlaybackRevision:B,running:P,activeGeneration:F?.generation??null,queuedGeneration:I?.generation??null,visibleGeneration:L?.generation??null,recoverableGeneration:R?.frame.generation??null,recoverableSphStep:R?.frame.sphStep??null,visibleSphStep:L?.sphStep??null,visibleSourceTimeS:L?.sourceTimeS??null,temporalMotionReady:!!(L?.motionField?.buffer&&L?.motionPacing),temporalMotionAgeS:L?.lastDisplayedMotionAgeS||0,temporalPresentationError:L?.temporalPresentationError||null,visibleSurfaceCount:L?.totalSurfaceCount??L?.surfaces?.length??0,visibleMarchingCubesSurfaceCount:L?.surfaces?.length??0,presentationComposition:e.presentationComposition,participatingMediumStatus:e.status,collectiveOpticalSurfaceCount:e.collectiveOpticalSurfaceCount,participatingMediumAggregateDrawCount:e.participatingMediumAggregateDrawCount,collectiveOpticalShellFallbackCount:e.collectiveOpticalShellFallbackCount,fieldRowsBufferByteLength:Ke,adapterCacheEntryCount:ht.size})},async dispose(){if(!j){Ve(),bn(),X=null,Qe=null,et=null,j=!0,it(!0),N+=1,Ue=null,M+=1,Ht(`worker-isosurface-recovery-dispose`),kn(),An(),On(I,`worker-owned isosurface presenter disposed`),I=null,await Promise.all([Mn(),ke?.catch?.(()=>{}),He?.catch?.(()=>{}),H?.catch?.(()=>{})]),Q(L,`worker-isosurface-presenter-dispose`),L=null,await tn(),Ie?.dispose?.(),Ie=null,Fe?.dispose(),Fe=null,Ge?.destroy?.(),Ge=null,Ke=0,Be?.destroy?.(),Be=null;try{qe?.destroy?.()}catch{}qe=null}}})}export{gt as RETAINED_GAP_STARVATION_MS,lt as ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_ENQUEUED_STATUS,dt as ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_FAILED_STATUS,mt as ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_FRAME_SCHEMA,pt as ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_GEOMETRY,ut as ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS,st as ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_SCHEMA,ft as ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_SUPERSEDED_STATUS,ct as ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_REQUEST_SCHEMA,Ht as buildWorkerOwnedIsosurfaceSurfaceUniformValues,Zt as createWorkerOwnedIsosurfacePresenter,Vt as dampedIsosurfaceShaderMotionAgeS,Kt as resolveWorkerOwnedIsosurfaceAdmission,Pt as resolveWorkerOwnedIsosurfaceProductEventSource,Lt as snapshotWorkerOwnedSurfaceMetadata,Ut as summarizeWorkerOwnedIsosurfaceOpticalPresentation,_t as threeViewProjectionToWebGpuClipMatrix};