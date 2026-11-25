import{cr as e,sr as t}from"./molecularDynamicsWebGpu-0B_SAXrs.js";import{Ai as n,Ii as r,M as i,Mi as a,Ss as o,Ts as s,W as c,_s as l,c as u,vs as d,ys as f}from"./sphGpuBuffers-DZzlncmj.js";import{acquireQueueOrderedPooledBuffer as p,computeBufferBinding as m,createCachedExplicitBindGroup as h,createCachedExplicitComputePipeline as g,deferSubmittedWorkCleanup as _,getCachedPipelineBindGroupLayout as v,registerQueueOrderedPooledBufferReturn as y,releaseOrDestroyQueueOrderedPooledBuffer as b}from"../runtime/webgpuComputeLayout.js";import{A as x,T as S,a as C,b as w,c as T,f as E,i as ee,j as D,m as te,o as ne,p as O,r as re,t as ie}from"./nativeSurfaceTemperatureWgsl-KWXE9Y6i.js";import{s as ae}from"./sphGpuDeviceIdentity-CxQWvfZe.js";import{ULG_WORKER_PRESENTATION_FRAME_QUEUE_COMPLETION_SCOPE as oe,ULG_WORKER_PRESENTATION_PHYSICS_PREFIX_INCLUDED as se,ULG_WORKER_PRESENTATION_PHYSICS_PREFIX_NOT_ATTRIBUTED as ce}from"../runtime/sph/sphWorkerPresentationQos.js";import{a as le,c as k,i as ue,l as de,n as fe,o as pe,s as me,t as he,u as ge}from"./sphNuclearCherenkovGpu-CRYpTOgC.js";import{createIsosurfaceMotionPacing as _e,createPresentationPauseClock as ve,isosurfaceMotionAge as A,resumeIsosurfaceMotionPacing as ye,slowIsosurfaceMotionPacing as j,snapshotIsosurfaceSourceTimingBootstrap as be}from"./workerOwnedIsosurfaceMotion.js";var xe=`
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
`;function Se(e,{colorFormat:t=`rgba8unorm`,depthFormat:n=`depth24plus`}={}){let r=e.createShaderModule({label:`ulg-solid-member-shape`,code:xe}),i=e.createRenderPipeline({label:`ulg-solid-member-shape`,layout:`auto`,vertex:{module:r,entryPoint:`vs_member`},fragment:{module:r,entryPoint:`fs_member`,targets:[{format:t}]},primitive:{topology:`triangle-list`,cullMode:`back`,frontFace:`ccw`},depthStencil:n?{format:n,depthWriteEnabled:!0,depthCompare:`less`}:void 0}),a=e.createBuffer({label:`ulg-solid-member-shape-uniforms`,size:112,usage:72}),o=new WeakMap;return Object.freeze({draw(t,n,{viewProjection:r,colorLinear:s=[.78,.9,.98],ambient:c=.35,lightDirection:l=[.3,.8,.5]}){let u=new ArrayBuffer(112),d=new Float32Array(u),f=new Uint32Array(u);d.set(r,0),f.set([0,n.memberCount,0,0],16),d.set([...s,1],20),d.set([...l,c],24),e.queue.writeBuffer(a,0,u);let p=o.get(n);p||(p=e.createBindGroup({layout:i.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:a}},{binding:1,resource:{buffer:n.frameBuffer}},{binding:2,resource:{buffer:n.memberBuffer}},{binding:3,resource:{buffer:n.neighborBuffer}},{binding:4,resource:{buffer:n.latticeBuffer}}]}),o.set(n,p)),t.setPipeline(i),t.setBindGroup(0,p),t.draw(n.memberCount*36)}})}var Ce=Object.freeze({wavelengthM:55e-8,refractiveIndex:1.333,asymmetry:.85}),we=Object.freeze({STORAGE:128,UNIFORM:64,COPY_DST:8}),Te=`
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
`;function Ee({device:e,encoder:t,parcels:n,fieldRowsBuffer:r,fieldOffset:i,resolution:a,fieldPadding:o,refEdgeM:s}={}){if(!n?.count||!r||!(a>0)||!(s>0))return null;let c=n.boxDimensionsM[0]/n.cellsPerAxis;if(!(c>0))throw TypeError(`Ledger parcel optics require the parcel gas-cell size`);let l=g(e,{cacheKey:`ulg-ledger-parcel-optics.v1`,label:`ulg-ledger-parcel-optics`,code:Te,entryPoint:`add_parcel_optics`,bindings:[`uniform`,`read-only-storage`,`storage`].map((e,t)=>m(t,e))}),u=e.createBuffer({label:`ulg-ledger-parcel-optics-params`,size:48,usage:we.UNIFORM|we.COPY_DST}),d=new ArrayBuffer(48),f=new Uint32Array(d),p=new Float32Array(d);f.set([n.count,a,i,0],0),p.set([o,s,Ce.wavelengthM,Ce.refractiveIndex],4),p.set([Ce.asymmetry,c,0,0],8),e.queue.writeBuffer(u,0,d);let h=e.createBindGroup({layout:l.bindGroupLayout,entries:[u,n.paramsBuffer,r].map((e,t)=>({binding:t,resource:{buffer:e}}))}),_=t.beginComputePass({label:`ulg-ledger-parcel-optics`});return _.setPipeline(l.pipeline),_.setBindGroup(0,h),_.dispatchWorkgroups(Math.ceil(a**3/64)),_.end(),u}function De(e,{bucketKey:t,label:n,size:r,usage:i}){let a=Math.max(4,Math.ceil(Number(r)||4));return typeof globalThis.GPUDevice==`function`&&e instanceof globalThis.GPUDevice&&typeof e.queue?.onSubmittedWorkDone==`function`?y(p(e,{bucketKey:t,label:n,size:a,usage:i}),e,{bucketKey:t,size:a,usage:i}):e.createBuffer({label:n,size:a,usage:i})}var Oe=`peercompute.ulg.sph-participating-medium-descriptor.v0`,M=`peercompute.ulg.sph-participating-medium-gpu.v0`,N=`peercompute.ulg.sph-participating-medium-packed-frame.v0`,P=Object.freeze({ready:`participating-medium-ready`,empty:`participating-medium-empty`,blocked:`participating-medium-blocked`}),ke=`participating-medium-packed-gpu-resident`,F=`rgba16float`,I=65504,L=Object.freeze({COPY_DST:globalThis.GPUBufferUsage?.COPY_DST??8,UNIFORM:globalThis.GPUBufferUsage?.UNIFORM??64,STORAGE:globalThis.GPUBufferUsage?.STORAGE??128,INDIRECT:globalThis.GPUBufferUsage?.INDIRECT??256}),R=Object.freeze({TEXTURE_BINDING:globalThis.GPUTextureUsage?.TEXTURE_BINDING??4,STORAGE_BINDING:globalThis.GPUTextureUsage?.STORAGE_BINDING??8}),z=8*Uint32Array.BYTES_PER_ELEMENT,Ae=8*Uint32Array.BYTES_PER_ELEMENT,B=40,V=B*Float32Array.BYTES_PER_ELEMENT,je=80,Me=1e-6,Ne=40,Pe=8,Fe=128,Ie=new WeakMap,Le=new WeakMap,H=new WeakMap,Re=`
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
`,ze=`
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
`;function U(e){return typeof e==`object`&&!!e||typeof e==`function`}function Be(e,t=null){let n=Number(e);return Number.isFinite(n)?n:t}function W(e,t){if(!(Array.isArray(e)||ArrayBuffer.isView(e))||e.length!==t)return null;let n=Array.from(e,Number);return n.every(Number.isFinite)?n:null}function G(e,t,n){let r=W(e,n),i=W(t,n);return!!(r&&i&&r.every((e,t)=>e===i[t]))}function Ve(t){return Array.isArray(t)&&t.length===e.length&&t.every((t,n)=>t===e[n])}function He(e){let t=Number(e?.descriptor?.surfaceIndex);if(Number.isSafeInteger(t)&&t>=0)return t;let n=Number(e?.metadata?.index);return Number.isSafeInteger(n)&&n>=0?n:null}function K(e){return Object.freeze(Array.isArray(e)?e.map(He).filter(e=>e!=null):[])}function Ue(e){let t=e?.metadata;return!!(U(t)&&Number.isSafeInteger(Number(t.opticalStateId))&&Number(t.opticalStateId)===0)}function q(e,t=[],n={}){return Object.freeze({schema:Oe,ok:!1,status:P.blocked,reason:e,routeCount:0,collectiveSurfaceCount:t.length,consumedSurfaceIndices:K(t),readback:!1,fullReadback:!1,...n})}function We(){return Object.freeze({schema:Oe,ok:!0,status:P.empty,reason:null,routeCount:0,collectiveSurfaceCount:0,consumedSurfaceIndices:Object.freeze([]),readback:!1,fullReadback:!1})}function Ge(e,t){return!!(U(e)&&U(t)&&[`index`,`resolution`,`fieldOffset`,`fieldCellCount`,`opticalStateId`,`collectiveOpticalRoute`,`collectiveOpticalRouteSchema`,`collectiveOpticalRouteKey`,`collectiveOpticalRouteId`,`opticalResponseAuthorityFlag`,`opticalResponseReady`,`opticalVisibilityFlag`,`opticalBlockedFlag`].every(n=>e[n]===t[n])&&G(e.colorLinear,t.colorLinear,3)&&(e.opticalScatteringSourceLinear==null?t.opticalScatteringSourceLinear==null:G(e.opticalScatteringSourceLinear,t.opticalScatteringSourceLinear,3)))}function Ke(e){let t=W(e?.opticalScatteringSourceLinear,3),n=W(e?.colorLinear,3),r=t||n;return!r||r.some(e=>e<0)?null:r.map(e=>Math.min(e,1))}function qe(t,n){if(!U(t))return`participating medium requires a GPUDevice`;if(!U(n)||n.schema!==`peercompute.ulg.sph-gpu-render-field.v1`)return`participating medium requires the exact ULG render-field schema`;if(n.backend!==`webgpu`)return`participating medium requires a WebGPU render field`;if(n.fieldRowsBufferRetained!==!0||!U(n.fieldRowsBuffer))return`participating medium requires a retained render-field GPU buffer`;if(!ae(n.fieldRowsBuffer,t))return`participating medium rejects a cross-device render-field buffer`;if(n.rowStrideFloats!==e.length)return`participating medium requires the exact render-field cell stride`;if(!Ve(n.rowLayout))return`participating medium requires the exact render-field row layout`;let r=Number(n.fieldRowsBufferByteLength),i=Number(n.fieldRowsBuffer.size),a=Number(n.totalFieldCells)*e.length*Float32Array.BYTES_PER_ELEMENT;return!Number.isSafeInteger(Number(n.totalFieldCells))||Number(n.totalFieldCells)<=0||!Number.isSafeInteger(r)||r!==a||!Number.isSafeInteger(i)||i<r?`participating medium rejects inconsistent render-field buffer bounds`:n.surfaceTable?.schema!==`peercompute.ulg.sph-gpu-render-field.v1`||!Array.isArray(n.surfaceTable.metadata)||n.surfaceTable.metadata.length!==n.surfaceTable.surfaceCount?`participating medium requires the exact render-field surface table`:null}function Je({device:t,renderField:n,volumeDescriptor:r,metadata:i,sourceMetadata:a}){if(!U(r)||r.schema!==`peercompute.ulg.sph-webgpu-marching-cubes-buffer-volume-descriptor.v0`||r.ok!==!0||r.status!==`ulg-render-field-buffer-volume-descriptor-ready`||r.device!==t||r.scalarBuffer!==n.fieldRowsBuffer||r.storageBuffer!==n.fieldRowsBuffer||r.buffer!==n.fieldRowsBuffer||r.sameDeviceStatus===`cross-device-resource`)return`participating medium rejected an unauthenticated field-volume descriptor`;let o=Number(r.surfaceIndex),s=Number(a?.resolution),c=Number(a?.fieldOffset),l=Number(a?.fieldCellCount);return!Number.isSafeInteger(o)||o<0||a!==n.surfaceTable.metadata[o]||!Ge(i,a)||!Number.isSafeInteger(s)||s<2||!Number.isSafeInteger(c)||c<0||l!==s**3||r.fieldOffset!==c||r.fieldCellCount!==l||r.scalarOffset!==c*e.length||r.scalarOffsetBytes!==r.scalarOffset*Float32Array.BYTES_PER_ELEMENT||r.cellRowStrideFloats!==e.length||!G(r.dims,[s,s,s],3)?`participating medium rejected inconsistent field-volume bounds`:r.positionTransform?.enabled!==!0||r.positionTransformStatus!==`ulg-render-field-grid-to-world-transform-ready`||!G(r.positionTransformOriginM,r.positionTransform.originM,3)||!(Number(r.positionTransformScaleM)>0)||r.positionTransformScaleM!==r.positionTransform.scaleM?`participating medium requires an authenticated grid-to-world transform`:n.schroederSpatialSourceFamily&&!T(r,{device:t,sourceFamily:n.schroederSpatialSourceFamily})?`participating medium rejected stale successor field lineage`:null}function Ye(e){let t=Number(e?.opticalStateId);return!!(Object.isFrozen(e)&&e.collectiveOpticalRoute===!0&&e.collectiveOpticalRouteSchema===`peercompute.ulg.sph-collective-dispersed-medium-optical-route.v0`&&typeof e.collectiveOpticalRouteKey==`string`&&e.collectiveOpticalRouteKey.length>0&&Number.isSafeInteger(t)&&t>0&&Number(e.collectiveOpticalRouteId)===t&&e.opticalResponseAuthorityFlag===1&&e.opticalResponseReady===!0&&e.opticalVisibilityFlag===1&&e.opticalBlockedFlag===0&&Ke(e))}function J(e){return Object.freeze({surfaceIndex:e.surfaceIndex,scalarBuffer:e.scalarBuffer,fieldOffset:e.fieldOffset,fieldCellCount:e.fieldCellCount,scalarOffset:e.scalarOffset,scalarOffsetBytes:e.scalarOffsetBytes,cellRowStrideFloats:e.cellRowStrideFloats,positionTransform:e.positionTransform,positionTransformStatus:e.positionTransformStatus,positionTransformScaleM:e.positionTransformScaleM,positionTransformGridBias:e.positionTransformGridBias,positionTransformOriginM:Object.freeze([...e.positionTransformOriginM]),dims:Object.freeze([...e.dims])})}function Y(e,t){return!!(e.surfaceIndex===t.surfaceIndex&&e.scalarBuffer===t.scalarBuffer&&e.fieldOffset===t.fieldOffset&&e.fieldCellCount===t.fieldCellCount&&e.scalarOffset===t.scalarOffset&&e.scalarOffsetBytes===t.scalarOffsetBytes&&e.cellRowStrideFloats===t.cellRowStrideFloats&&e.positionTransform===t.positionTransform&&e.positionTransformStatus===t.positionTransformStatus&&e.positionTransformScaleM===t.positionTransformScaleM&&e.positionTransformGridBias===t.positionTransformGridBias&&G(e.positionTransformOriginM,t.positionTransformOriginM,3)&&G(e.dims,t.dims,3))}function Xe({device:n=null,renderField:r=null,surfaceDescriptors:i=[]}={}){if(!Array.isArray(i))return q(`participating medium surfaceDescriptors must be an array`);if(i.length===0)return We();let a=i.filter(e=>!Ue(e));if(a.length===0)return We();let o=qe(n,r);if(o)return q(o,a);let s=[...a].sort((e,t)=>He(e)-He(t)),c=new Set,l=new Set,u=new ArrayBuffer(s.length*z),d=new Uint32Array(u),f=new Float32Array(u),p=[],m=null,h=null,g=null,_=null;for(let e=0;e<s.length;e+=1){let t=s[e],i=t?.descriptor??null,o=t?.metadata??null,u=He(t),v=Number.isSafeInteger(u)?r.surfaceTable.metadata[u]:null;if(!Ye(o))return q(`participating medium rejected a blocked or noncanonical collective route`,a,{blockedSurfaceIndex:u});let y=Je({device:n,renderField:r,volumeDescriptor:i,metadata:o,sourceMetadata:v});if(y)return q(y,a,{blockedSurfaceIndex:u});let b=Number(o.opticalStateId);if(c.has(b)||l.has(u))return q(`participating medium rejects duplicate route or surface identity`,a,{blockedSurfaceIndex:u});c.add(b),l.add(u);let x=Number(v.resolution),S=Number(i.positionTransformScaleM),C=Number(i.positionTransformGridBias),w=W(i.positionTransformOriginM,3);if(e===0)m=x,h=S,g=C,_=w;else if(x!==m||S!==h||C!==g||!G(w,_,3))return q(`participating medium requires one exact shared grid transform`,a,{blockedSurfaceIndex:u});let T=Ke(o),E=e*8;d[E]=Number(v.fieldOffset),d[E+1]=x,d[E+2]=b,d[E+3]=u,f[E+4]=T[0],f[E+5]=T[1],f[E+6]=T[2],f[E+7]=1,p.push(Object.freeze({surfaceIndex:u,opticalStateId:b,fieldOffset:Number(v.fieldOffset),resolution:x,scatteringColorLinear:Object.freeze([...T]),volumeDescriptor:i,volumeDescriptorSnapshot:J(i),metadata:o,sourceMetadata:v}))}let v=Number(n.limits?.maxTextureDimension3D);if(Number.isFinite(v)&&m>v)return q(`participating medium grid exceeds maxTextureDimension3D`,a);let y=_.map(e=>e-.5*h),b=_.map(e=>e+(m-.5)*h),x={schema:Oe,ok:!0,status:P.ready,reason:null,sourceRenderFieldSchema:r.schema,sourceRenderFieldBackend:r.backend,routeCount:p.length,collectiveSurfaceCount:p.length,consumedSurfaceIndices:Object.freeze(p.map(e=>e.surfaceIndex)),opticalStateIds:Object.freeze(p.map(e=>e.opticalStateId)),resolution:m,dims:Object.freeze([m,m,m]),cellEdgeM:h,fieldMinM:Object.freeze(y),fieldMaxM:Object.freeze(b),fieldRowsBuffer:r.fieldRowsBuffer,fieldRowsBufferByteLength:r.fieldRowsBufferByteLength,fieldCellRowStrideFloats:e.length,temperatureLaneIndex:t.temperatureK,scatteringOpticalDepthLaneIndex:t.scatteringOpticalDepth,absorptionOpticalDepthLaneIndex:t.absorptionOpticalDepth,scatteringAsymmetryOpticalDepthLaneIndex:t.scatteringAsymmetryOpticalDepth,aggregateTextureCount:2,textureFormat:F,storageComponentMax:I,readback:!1,fullReadback:!1,activityMode:`gpu-indirect-not-read-back`,sourceReleaseBoundary:`after-containing-command-buffer-submit`};return Ie.set(x,{active:!0,device:n,renderField:r,surfaceTable:r.surfaceTable,surfaceMetadataArray:r.surfaceTable.metadata,fieldRowsBuffer:r.fieldRowsBuffer,routeRowsBytes:new Uint8Array(u),routes:p,resolution:m,cellEdgeM:h,fieldMinM:y,fieldMaxM:b}),Object.freeze(x)}function X(e,t){if(typeof e?.[t]!=`function`)throw TypeError(`participating medium requires device.${t}()`)}function Ze(e,t,n,r){return typeof e[t]==`function`?Promise.resolve(e[t](r)):(X(e,n),Promise.resolve(e[n](r)))}function Qe(e,{colorFormat:t=`rgba8unorm`,depthFormat:n=`depth24plus`,maxOpticalDepth:r=je,activityEpsilon:i=Me}={}){for(let t of[`createBuffer`,`createTexture`,`createShaderModule`,`createBindGroup`,`createSampler`])X(e,t);if(X(e?.queue,`writeBuffer`),typeof t!=`string`||t.length===0)throw TypeError(`participating medium requires a color format`);if(typeof n!=`string`||n.length===0)throw TypeError(`participating medium requires a depth format`);let a=Be(r),o=Be(i);if(!(a>0)||!(o>=0))throw RangeError(`participating medium optical limits must be finite and nonnegative`);let s=Math.min(a,I),c=e.createShaderModule({label:`ulg-sph-participating-medium-pack-wgsl`,code:Re}),l=e.createShaderModule({label:`ulg-sph-participating-medium-render-wgsl`,code:ze}),u=Ze(e,`createComputePipelineAsync`,`createComputePipeline`,{label:`ulg-sph-participating-medium-pack`,layout:`auto`,compute:{module:c,entryPoint:`pack_main`}}),d=Ze(e,`createRenderPipelineAsync`,`createRenderPipeline`,{label:`ulg-sph-participating-medium-render`,layout:`auto`,vertex:{module:l,entryPoint:`vertex_main`},fragment:{module:l,entryPoint:`fragment_main`,targets:[{format:t,blend:{color:{operation:`add`,srcFactor:`one`,dstFactor:`one-minus-src-alpha`},alpha:{operation:`add`,srcFactor:`one`,dstFactor:`one-minus-src-alpha`}},writeMask:15}]},primitive:{topology:`triangle-list`,cullMode:`none`}}),f={active:!0,device:e,colorFormat:t,depthFormat:n,maxOpticalDepth:s,activityEpsilon:o,packPipelinePromise:u,renderPipelinePromise:d,sampler:e.createSampler({label:`ulg-sph-participating-medium-linear-sampler`,addressModeU:`clamp-to-edge`,addressModeV:`clamp-to-edge`,addressModeW:`clamp-to-edge`,magFilter:`linear`,minFilter:`linear`,mipmapFilter:`nearest`}),emptyMotionBuffer:e.createBuffer({label:`ulg-sph-participating-medium-empty-motion`,size:16,usage:L.STORAGE|L.COPY_DST}),frames:new Set},p={schema:M,status:`participating-medium-gpu-ready-pending-pipelines`,colorFormat:t,depthFormat:n,textureFormat:F,maxOpticalDepth:s,storageComponentMax:I,readback:!1,get destroyed(){return!f.active},ready:Promise.all([u,d]).then(()=>!0),destroy(){if(!f.active)return!1;f.active=!1;for(let e of[...f.frames])at(e);return f.frames.clear(),Z(f.emptyMotionBuffer),!0}};return Le.set(p,f),Object.freeze(p)}function $e(e){let t=Le.get(e);if(!t||!t.active)throw TypeError(`participating medium GPU runtime is missing or destroyed`);return t}function et(e,t){let n=Ie.get(e);if(!n||!n.active||e.status!==P.ready)throw TypeError(`participating medium descriptor is missing, consumed, or blocked`);if(n.device!==t.device||e.fieldRowsBuffer!==n.fieldRowsBuffer)throw TypeError(`participating medium descriptor belongs to a different GPU runtime`);let r=qe(t.device,n.renderField);if(r)throw TypeError(`participating medium render-field source failed revalidation: ${r}`);if(n.renderField.fieldRowsBuffer!==n.fieldRowsBuffer||n.renderField.fieldRowsBufferRetained!==!0||n.renderField.surfaceTable!==n.surfaceTable||n.surfaceTable.metadata!==n.surfaceMetadataArray||!ae(n.fieldRowsBuffer,t.device))throw TypeError(`participating medium render-field/table identity is stale or cross-device`);for(let e of n.routes){if(n.surfaceMetadataArray[e.surfaceIndex]!==e.sourceMetadata||!Ge(e.metadata,e.sourceMetadata)||!Ye(e.metadata)||!Y(e.volumeDescriptor,e.volumeDescriptorSnapshot))throw TypeError(`participating medium route authority changed after descriptor creation`);if(n.renderField.schroederSpatialSourceFamily&&!T(e.volumeDescriptor,{device:t.device,sourceFamily:n.renderField.schroederSpatialSourceFamily}))throw TypeError(`participating medium successor lineage expired before packing`)}return n}function Z(e){try{b(e)}catch{}}function tt(e,t,n,r,i){let a={active:!0,runtime:e,runtimeRecord:t,descriptor:n,descriptorRecord:r,...i},o={schema:N,ok:!0,status:ke,resolution:n.resolution,dims:n.dims,routeCount:n.routeCount,collectiveSurfaceCount:n.collectiveSurfaceCount,consumedSurfaceIndices:n.consumedSurfaceIndices,opticalStateIds:n.opticalStateIds,opticalTexture:i.opticalTexture,scatteringTexture:i.scatteringTexture,drawIndirectBuffer:i.drawIndirectBuffer,drawIndirectOffsetBytes:0,drawCountMode:`gpu-indirect-not-read-back`,sourceBufferConsumptionEncoded:!0,sourceReleaseBoundary:n.sourceReleaseBoundary,readback:!1,fullReadback:!1,get destroyed(){return!a.active},destroy(){return at(o)}};return a.frame=o,H.set(o,a),t.frames.add(o),Object.freeze(o)}async function nt(t,n,r){let i=$e(t);if(!U(n)||typeof n.clearBuffer!=`function`||typeof n.beginComputePass!=`function`)throw TypeError(`participating medium pack requires a GPUCommandEncoder`);let a=et(r,i),o=await i.packPipelinePromise;$e(t),et(r,i);let s=a.resolution,c={size:{width:s,height:s,depthOrArrayLayers:s},dimension:`3d`,format:F,mipLevelCount:1,sampleCount:1,usage:R.STORAGE_BINDING|R.TEXTURE_BINDING},l=[];try{let u=i.device.createTexture({...c,label:`ulg-sph-participating-medium-optical-volume`});l.push(u);let d=i.device.createTexture({...c,label:`ulg-sph-participating-medium-scattering-volume`});l.push(d);let f=u.createView({dimension:`3d`}),p=d.createView({dimension:`3d`}),m=De(i.device,{bucketKey:`ulg-sph-participating-medium-route-rows`,label:`ulg-sph-participating-medium-route-rows`,size:a.routeRowsBytes.byteLength,usage:L.STORAGE|L.COPY_DST});l.push(m);let g=De(i.device,{bucketKey:`ulg-sph-participating-medium-pack-params`,label:`ulg-sph-participating-medium-pack-params`,size:Ae,usage:L.UNIFORM|L.COPY_DST});l.push(g);let _=De(i.device,{bucketKey:`ulg-sph-participating-medium-draw-indirect`,label:`ulg-sph-participating-medium-draw-indirect`,size:4*Uint32Array.BYTES_PER_ELEMENT,usage:L.STORAGE|L.INDIRECT|L.COPY_DST});l.push(_);let y=De(i.device,{bucketKey:`ulg-sph-participating-medium-render-uniforms`,label:`ulg-sph-participating-medium-render-uniforms`,size:V,usage:L.UNIFORM|L.COPY_DST});l.push(y);let b=new ArrayBuffer(Ae),x=new Uint32Array(b),S=new Float32Array(b);x[0]=s,x[1]=r.routeCount,x[2]=e.length/4,S[4]=i.maxOpticalDepth,S[5]=i.activityEpsilon,i.device.queue.writeBuffer(m,0,a.routeRowsBytes),i.device.queue.writeBuffer(g,0,new Uint8Array(b));let C=h(i.device,{label:`ulg-sph-participating-medium-pack-bind-group`,layout:v(o,0),entries:[{binding:0,resource:{buffer:a.fieldRowsBuffer}},{binding:1,resource:{buffer:m}},{binding:2,resource:{buffer:g}},{binding:3,resource:f},{binding:4,resource:p},{binding:5,resource:{buffer:_}}]});n.clearBuffer(_,0,4*Uint32Array.BYTES_PER_ELEMENT);let w=n.beginComputePass({label:`ulg-sph-participating-medium-pack-pass`});w.setPipeline(o),w.setBindGroup(0,C);let T=Math.ceil(s/4);return w.dispatchWorkgroups(T,T,T),w.end(),a.active=!1,tt(t,i,r,a,{opticalTexture:u,scatteringTexture:d,opticalTextureView:f,scatteringTextureView:p,routeRowsBuffer:m,packParamsBuffer:g,drawIndirectBuffer:_,renderUniformBuffer:y,packDispatch:Object.freeze([T,T,T])})}catch(e){a.active=!1;for(let e of l)Z(e);throw e}}function rt(e,{inverseViewProjectionMatrix:t,cameraPositionM:n,viewportSize:r,lightDirection:i=[.38,.82,.42],lightIntensity:a=1,ambientIntensity:o=.18,stepCount:s=Ne,depthEpsilon:c=1e-6,motionAgeS:l=0,motionRowCount:u=0}){let d=W(t,16),f=W(n,3),p=W(r,2),m=W(i,3),h=Be(a),g=Be(o),_=Be(c);if(!d||!f||!p||p.some(e=>!(e>0))||!m||Math.hypot(...m)<=1e-12||!(h>=0)||!(g>=0)||!(_>=0))throw TypeError(`participating medium render uniforms are incomplete or non-finite`);let v=Math.max(Pe,Math.min(Fe,Math.round(Be(s,Ne)))),y=new Float32Array(B);y.set(d,0),y.set(f,16),y[19]=v,y.set(e.descriptorRecord.fieldMinM,20),y[23]=e.descriptorRecord.cellEdgeM,y.set(e.descriptorRecord.fieldMaxM,24),y[27]=g;let b=Math.hypot(...m);y[28]=m[0]/b,y[29]=m[1]/b,y[30]=m[2]/b,y[31]=h,y[32]=p[0],y[33]=p[1],y[34]=_;let x=Number.isFinite(Number(l))&&Number(l)>0?Number(l):0,S=Number.isSafeInteger(Number(u))&&Number(u)>0?Number(u):0;return y[36]=S>0?x:0,y[37]=e.descriptor.routeCount||0,y[38]=e.descriptor.resolution||0,y[39]=S,e.runtimeRecord.device.queue.writeBuffer(e.renderUniformBuffer,0,y),Object.freeze({stepCount:v,viewportSize:Object.freeze([...p]),readback:!1})}async function it(e,t,{packedFrame:n=null,inverseViewProjectionMatrix:r=null,cameraPositionM:i=null,viewportSize:a=null,depthTextureView:o=null,lightDirection:s=[.38,.82,.42],lightIntensity:c=1,ambientIntensity:l=.18,stepCount:u=Ne,depthEpsilon:d=1e-6,motionField:f=null,motionAgeS:p=0,decoupledBurstBypass:m=!1}={}){let h=$e(e),g=H.get(n);if(!g||!g.active||g.runtime!==e||!U(t)||typeof t.setPipeline!=`function`||typeof t.setBindGroup!=`function`||typeof t.drawIndirect!=`function`||!U(o))throw TypeError(`participating medium render requires a live packed frame, pass, and depth view`);let _=await h.renderPipelinePromise;if($e(e),!g.active)throw TypeError(`participating medium packed frame was destroyed before rendering`);let y=f?.buffer&&f?.destroyed!==!0?f.buffer:h.emptyMotionBuffer,b=y===h.emptyMotionBuffer?0:Math.max(0,Math.floor(Number(f?.rowCount)||0)),x=globalThis.__ulgDecoupledPresentationBypassBurst;m&&(globalThis.__ulgDecoupledPresentationBypassBurst=!0);let S;try{S=rt(g,{inverseViewProjectionMatrix:r,cameraPositionM:i,viewportSize:a,lightDirection:s,lightIntensity:c,ambientIntensity:l,stepCount:u,depthEpsilon:d,motionAgeS:p,motionRowCount:b})}finally{m&&(globalThis.__ulgDecoupledPresentationBypassBurst=x)}let C=g.cachedRenderBindGroup;return(!C||g.cachedRenderDepthView!==o||g.cachedRenderMotionBuffer!==y)&&(C=h.device.createBindGroup({label:`ulg-sph-participating-medium-render-bind-group`,layout:v(_,0),entries:[{binding:0,resource:{buffer:g.renderUniformBuffer}},{binding:1,resource:g.opticalTextureView},{binding:2,resource:g.scatteringTextureView},{binding:3,resource:h.sampler},{binding:4,resource:o},{binding:5,resource:{buffer:y}},{binding:6,resource:{buffer:g.routeRowsBuffer}}]}),g.cachedRenderBindGroup=C,g.cachedRenderDepthView=o,g.cachedRenderMotionBuffer=y),t.setPipeline(_),t.setBindGroup(0,C),t.drawIndirect(g.drawIndirectBuffer,0),Object.freeze({status:`participating-medium-render-encoded`,routeCount:n.routeCount,consumedSurfaceIndices:n.consumedSurfaceIndices,drawCountMode:n.drawCountMode,readback:!1,...S})}function at(e){let t=H.get(e);if(!t||!t.active)return!1;t.active=!1,t.runtimeRecord.frames.delete(e);for(let e of[t.opticalTexture,t.scatteringTexture,t.routeRowsBuffer,t.packParamsBuffer,t.drawIndirectBuffer,t.renderUniformBuffer])Z(e);return!0}var ot=`peercompute.ulg.worker-offscreen-resident-isosurface-presentation.v0`,st=`peercompute.ulg.worker-offscreen-resident-isosurface-request.v0`,ct=`worker-offscreen-resident-isosurface-presentation-enqueued`,lt=`worker-offscreen-resident-isosurface-presentation-rendered`,ut=`worker-offscreen-resident-isosurface-presentation-failed`,dt=`worker-offscreen-resident-isosurface-presentation-superseded`,ft=`worker-owned-true-isosurface`,pt=`peercompute.ulg.worker-offscreen-resident-isosurface-presentation-frame.v0`,mt=`peercompute.ulg.sph-gpu-render-field.v1`,ht=1e3/60;function gt(e){let t=new Float32Array(16);for(let n=0;n<16;n+=1)t[n]=Number(e[n])||0;for(let e=0;e<4;e+=1){let n=e*4;t[n+2]=.5*t[n+2]+.5*t[n+3]}return t}var _t=`no-full-readback`,vt=`gpu-conservative-no-readback`,yt=`depth24plus`,bt=`peercompute.ulg.worker-participating-medium-presentation.v0`,xt=`not-requested`,St=P.ready,Ct=P.empty,wt=P.blocked,Tt=Object.freeze([`ordered-isosurface-and-overlay`]),Et=Object.freeze([`opaque-isosurface`,`depth-clipped-participating-medium`,`transparent-isosurface-and-overlay`]),Dt=4,Ot=8,kt=64,At=128,jt=class extends Error{};`${ge}`;function Q(){return globalThis.performance?.now?.()??Date.now()}function Mt(e,t){return globalThis.GPUBufferUsage?.[e]??t}function Nt(e){return!!(e&&typeof e==`object`&&(e.constructor?.name===`GPUBuffer`||typeof e.mapAsync==`function`||typeof e.getMappedRange==`function`))}function Pt({device:e,retained:t}={}){let i=t?.residentProductMass??null;if(!i)return Object.freeze({productEventBuffer:null,productEventSource:null,productEventCount:0,productEventLiveCountDescriptor:null});let o=i.productEventBuffer??null,s=Number(i.productEventRowCount),c=Number(i.productEventRowCapacity??i.productEventRowCount);if(!(o||i.productEventLiveCountAuthority||a(i)||Number.isFinite(s)&&s>0||Number.isFinite(c)&&c>0))return Object.freeze({productEventBuffer:null,productEventSource:null,productEventCount:0,productEventLiveCountDescriptor:null});let l=o?n(i,e):null,u=l?.expectedRowCapacity??0,d=u*O*Float32Array.BYTES_PER_ELEMENT;if(i.productEventBufferRetained!==!0||!o||!l||!r(l,{handle:i,device:e})||l.hostObserved!==!1||!Number.isSafeInteger(u)||u<=0||l.rowCapacity!==u||l.expectedRowStrideVec4!==O/4||l.rowStrideFloats!==O||!Number.isSafeInteger(s)||s!==u||!Number.isSafeInteger(c)||c!==u||!(Number(o.size)>=d))throw TypeError(`worker-owned isosurface requires an exact retained product-event buffer and authenticated GPU live-count capacity`);return Object.freeze({productEventBuffer:o,productEventSource:i,productEventCount:u,productEventLiveCountDescriptor:l})}function Ft(e){if(!e)return null;if(!Object.hasOwn(e,`__ulgActiveBorrowCount`))throw TypeError(`worker-owned isosurface requires a borrowable retained product-event source`);let t=Math.max(0,Math.floor(Number(e.__ulgActiveBorrowCount)||0));if(e.__ulgActiveBorrowCount=t+1,Number(e.__ulgActiveBorrowCount)!==t+1)throw TypeError(`worker-owned isosurface could not pin its retained product-event source`);let n=!1;return()=>n?!1:(n=!0,e.__ulgActiveBorrowCount=Math.max(0,(Number(e.__ulgActiveBorrowCount)||0)-1),!0)}function It(e,t){if(!i(t))return null;let n=t?.dispersedMediumOptics??null,r=Number(t?.particleCount),a=Number(n?.rowCount),o=Number(n?.rowStrideFloats),s=Number(n?.bufferByteLength),l=a*o*Float32Array.BYTES_PER_ELEMENT;if(!n||n.ownsBuffer!==!0||n.destroyed===!0||t.ownsDispersedMediumOpticsBuffer!==!0||t.dispersedMediumOpticsAuthority!==n.authority||t.dispersedMediumOpticsBuffer!==n.buffer||t.dispersedMediumOpticsRowCount!==n.rowCount||t.dispersedMediumOpticsRowStrideFloats!==n.rowStrideFloats||t.dispersedMediumOpticsBufferByteLength!==n.bufferByteLength||!Number.isSafeInteger(r)||r<=0||n.particleCount!==r||!Number.isSafeInteger(a)||a!==r||!Number.isSafeInteger(o)||o<=0||!Number.isSafeInteger(s)||s<=0||s!==l||!Number.isSafeInteger(Number(n.buffer?.size))||Number(n.buffer?.size)!==s)throw TypeError(`worker-owned isosurface rejected torn dispersed-medium particle-upload aliases`);return Object.freeze({sidecar:n,release:c(e,n)})}function Lt(e){if(!e||typeof e!=`object`)throw TypeError(`worker-owned isosurface requires object surface metadata`);let t={...e};return(Array.isArray(e.boundsCenterM)||ArrayBuffer.isView(e.boundsCenterM))&&(t.boundsCenterM=Object.freeze(Array.from(e.boundsCenterM))),(Array.isArray(e.colorLinear)||ArrayBuffer.isView(e.colorLinear))&&(t.colorLinear=Object.freeze(Array.from(e.colorLinear))),(Array.isArray(e.opticalScatteringSourceLinear)||ArrayBuffer.isView(e.opticalScatteringSourceLinear))&&(t.opticalScatteringSourceLinear=Object.freeze(Array.from(e.opticalScatteringSourceLinear))),e.opticalState&&typeof e.opticalState==`object`&&(t.opticalState=Object.freeze({...e.opticalState})),Object.freeze(t)}function $(e,t){if(!(Array.isArray(e)||ArrayBuffer.isView(e))||e.length!==t)return null;let n=Array.from(e,Number);return n.every(Number.isFinite)?n:null}function Rt(e){let t=$(e,16);if(!t)return null;let n=Array.from({length:4},(e,n)=>Array.from({length:8},(e,r)=>r<4?t[r*4+n]:+(r-4===n)));for(let e=0;e<4;e+=1){let t=e;for(let r=e+1;r<4;r+=1)Math.abs(n[r][e])>Math.abs(n[t][e])&&(t=r);let r=n[t][e];if(!Number.isFinite(r)||Math.abs(r)<=1e-12)return null;t!==e&&([n[e],n[t]]=[n[t],n[e]]);for(let t=0;t<8;t+=1)n[e][t]/=r;for(let t=0;t<4;t+=1){if(t===e)continue;let r=n[t][e];if(r!==0)for(let i=0;i<8;i+=1)n[t][i]-=r*n[e][i]}}let r=new Float32Array(16);for(let e=0;e<4;e+=1)for(let t=0;t<4;t+=1){let i=n[e][t+4];if(!Number.isFinite(i))return null;r[t*4+e]=i}return r}function zt(e){if(e?.collectiveOpticalRoute===!0||e?.collectiveOpticalRouteSchema!=null||e?.collectiveOpticalRouteKey!=null||e?.collectiveOpticalRouteId!=null)return!0;if(e?.opticalStateId==null)return!1;let t=Number(e?.opticalStateId);return!Number.isSafeInteger(t)||t!==0}function Bt(e){let t=e?.participatingMedium??null,n=t?.status??xt,r=n===St&&!!t?.packedFrame,i=Math.max(0,Number(t?.collectiveSurfaceCount)||0);return Object.freeze({schema:bt,status:n,presentationComposition:i>0?`marching-cubes-isosurfaces-plus-participating-medium`:`marching-cubes-isosurfaces`,marchingCubesSurfaceCount:e?.surfaces?.length??0,collectiveOpticalSurfaceCount:i,participatingMediumAggregateDrawCount:+!!r,collectiveOpticalShellFallbackCount:0,participatingMediumDepthClipped:r,participatingMediumPremultipliedAlpha:r,presentationPassOrder:e?.presentationPassOrder??(r?Et:Tt)})}function Vt(e){let t=Math.max(0,Number(e?.drawMotionAgeS)||0),n=Number(e?.motionPacing?.maxSimulationAgeS)||0;if(!(t>0)||!(n>0))return t;let r=n*.65;return r*(1-Math.exp(-t/r))}function Ht(e={},t={}){let n=t.metadata||{},r=t.translation?.positionTransform||t.descriptor?.positionTransform||{},i=new Float32Array(44),a=$(e.viewProjectionMatrix,16)||[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];i.set(a,0);let o=$(r.originM,3)||[0,0,0];i.set(o,16),i[19]=Number(r.scaleM)||1;let s=Number.isFinite(Number(r.gridBias))?Number(r.gridBias):-.5;i[20]=s,i[21]=s,i[22]=s;let c=Math.max(0,Number(n.transparencyClassId)||0),l=Math.max(0,Number(n.phaseId)||0),u=Number(n.opticalResponseAuthorityFlag)>0,d=c>.5&&c<1.5||l>2.5&&l<3.5,f=Number(n.opticalEffectiveOpacity);i[23]=u&&d?Math.min(1,Math.max(0,Number.isFinite(f)?f:0)):1;let p=$(n.colorLinear,3)||[.72,.82,.94];i.set(p,24);let m=Number(n.opticalRoughness);if(i[27]=Number.isFinite(m)?Math.min(1,Math.max(.05,m)):c>0?.12:.42,i.set($(e.cameraPositionM,3)||[0,0,0],28),i[31]=Math.max(0,Number(n.emissiveTemperatureK)||0),i[32]=c,i[33]=l,i[34]=Number(n.depthWriteFlag)===0?0:1,i[35]=+!!u,e.motionField?.buffer){let n=new Uint32Array(i.buffer);n[36]=t.descriptor?.fieldOffset??0,n[37]=t.metadata?.resolution??0,n[38]=e.motionField.rowCount,i[40]=Vt(e),i[41]=Math.abs(i[19])}return i}function Ut(e=[]){let t=(Array.isArray(e)?e:[]).map(e=>e?.metadata??e).filter(Boolean).filter(e=>{let t=Number(e.transparencyClassId)||0,n=Number(e.phaseId)||0;return t>.5&&t<1.5||n>2.5&&n<3.5}),n=t.filter(e=>Number(e.opticalResponseAuthorityFlag)>0),r=n.filter(e=>Number(e.opticalEffectiveOpacity)>0);return Object.freeze({schema:`peercompute.ulg.worker-isosurface-optical-presentation.v0`,status:t.length===0?`no-gas-surfaces`:n.length===t.length?`all-gas-surfaces-closure-governed`:`gas-surface-optical-authority-incomplete`,gasSurfaceCount:t.length,closureGovernedGasSurfaceCount:n.length,visibleClosureGasSurfaceCount:r.length,opticallyThinHiddenGasSurfaceCount:n.length-r.length,allGasSurfacesClosureGoverned:t.length>0&&n.length===t.length,heuristicGasOpacityUsed:t.length>n.length,opticalProvenanceSources:[...new Set(n.map(e=>e.opticalProvenanceSource).filter(Boolean))].sort()})}function Wt(e){return{errorName:e instanceof Error?e.name:null,errorMessage:e instanceof Error?e.message:String(e),errorStack:e instanceof Error?String(e.stack||``).slice(0,2e3):null}}function Gt(e={}){return Object.freeze({schema:ot,presentationGeometry:ft,sameDevicePresentation:!0,gpuToCpuReadbackBytes:0,fullParticleReadbackPerformed:!1,fullParticleReadbackFree:!0,authoritativeStateMutation:!1,scientificValidation:!1,sphValidation:!1,fullPhysicsValidation:!1,...e})}function Kt({request:e=null,retained:t=null}={}){let n=e?.surfaceTable,r=$(e?.viewProjectionMatrix,16),i=$(e?.cameraPositionM,3),a=[],o=null;try{o=k(e?.nativeSurfaceMaterial)}catch{a.push(`native-surface-material`)}return e?.schema!==`peercompute.ulg.worker-offscreen-resident-isosurface-request.v0`&&a.push(`request-schema`),e?.enabled!==!0&&a.push(`request-disabled`),(n?.schema!==mt||!(n?.records instanceof Float32Array)||!Array.isArray(n?.metadata)||n.metadata.length!==Number(n.surfaceCount)||n.surfaceCount<=0||n.totalFieldCells<=0)&&a.push(`surface-table`),r||a.push(`view-projection`),i||a.push(`camera-position`),Number.isFinite(Number(e?.fieldPadding))||a.push(`field-padding`),Number(e?.refEdgeM)>0||a.push(`reference-edge`),(t?.status!==`worker-retained-particle-state-ready`||t?.sameWorkerPrivateReferences!==!0||t?.postMessageTransportAllowed!==!1)&&a.push(`same-worker-retained-authority`),(!t?.sphParticleState||!t?.mlsMpmParticleState||!t?.sphParticleUpload||!t?.mlsMpmParticleUpload||!t?.successorSourceFamily&&t?.executionMode!==`tier0-fused-resident-sequence`)&&a.push(`retained-private-references`),(!Nt(t?.sourceStateBuffer)||!Nt(t?.sourceThermoBuffer)||!Nt(t?.sourceMechanicsBuffer)||!Nt(t?.sourceIdentityBuffer))&&a.push(`retained-gpu-buffers`),Object.freeze({ok:a.length===0,status:a.length===0?`worker-owned-isosurface-admission-ready`:`worker-owned-isosurface-admission-blocked`,reason:a.length===0?null:a.join(`,`),blockers:Object.freeze(a),surfaceCount:Math.max(0,Math.floor(Number(n?.surfaceCount)||0)),totalFieldCells:Math.max(0,Math.floor(Number(n?.totalFieldCells)||0)),particleCount:Math.max(0,Math.floor(Number(t?.particleCount)||0)),viewProjectionMatrix:r,cameraPositionM:i,nativeSurfaceMaterial:o})}function qt(e={}){return[e.surfaceIndex??0,e.surfaceKey??``,...e.dims||[],...e.scalarStrides||[],e.scalarOffset??0,e.scalarBufferByteLength??0,e.normalSign??-1,e.scalarType??`f32`].join(`|`)}function Jt(e){return x({device:e.device,scalarBuffer:e.scalarBuffer,dims:e.dims,scalarStrides:e.scalarStrides,scalarOffset:e.scalarOffset,bufferByteLength:e.scalarBufferByteLength,scalarType:e.scalarType||`f32`,normalSign:e.normalSign,label:e.label||`ulg-worker-isosurface-${e.surfaceKey||e.surfaceIndex||0}`,source:e.source||`ulg-render-field-density-storage-buffer`})}function Yt(e){return e?.extensionExecution||null}function Xt(e,t){try{e?.releaseTemperatureRows?.()}catch{}try{e?.translation?.destroyExtensionSurfaceBuffers?.({force:!0,releaseLeases:!0,reason:t})}catch{}try{e?.rawExecution?.result?.release?.()}catch{}try{b(e?.uniformBuffer)}catch{}}function Zt({device:e,context:t,format:n,depthFormat:r=yt,getDepthView:i,getDepthTexture:a=null,getViewportSize:c=null,drawOverlay:m=null,onTerminal:h=null,onFrameSubmitted:g=null,waitForPresentationOpportunity:v=null,getFramebufferEpoch:b=null,nextPresentationQueueCompletionSerial:x=null,temporalNowMs:T=Q,presentationPauseClock:O=ve(),captureRenderRows:ae=S,buildRenderField:k=w,buildPresentationFrame:ge=null,createNativeSurfaceMaterial:xe=me,createParticipatingMediumDescriptor:Ce=Xe,createParticipatingMediumGpu:we=Qe,encodeParticipatingMediumPack:Te=nt,encodeParticipatingMediumRender:De=it,destroyParticipatingMediumPackedFrame:Oe=at}={}){if(!e?.createBuffer||!e?.queue?.submit)throw TypeError(`worker-owned isosurface presenter requires a WebGPU device`);if(!t?.getCurrentTexture||!n)throw TypeError(`worker-owned isosurface presenter requires a configured WebGPU canvas context`);if(typeof i!=`function`)throw TypeError(`worker-owned isosurface presenter requires a depth-view provider`);if(typeof b!=`function`)throw TypeError(`worker-owned isosurface presenter requires a framebuffer-epoch provider`);let M=!1,N=0,P=0,ke=!1,F=null,I=null,L=null,R=null,z=null,Ae=0,B=!0,V=0,je=new AbortController,Me=null,Ne=null,Pe=null,Fe=null,Ie=null,Le=0,H=0,Re=null,ze=null,U=null,Be=Promise.resolve(),W=null,G=null,Ve=()=>{W?.abort(),G?.abort()},He=null,K=null,Ue=0,q=null,We=new Set,Ge=null,Ke=0,qe=null,Je=!1,Ye=0,J=0,Y=0,X=0,Ze=0,$e=null,et=null,Z=null,tt=null,rt=new Set,st=(e=!1)=>{if(rt.size!==0){for(let t of[...rt])if(e||J>=t.targetSerial){rt.delete(t);try{t.wake(J)}catch{}}}},ft=async(e=50)=>{let t=tt;return t?(await Promise.race([t,new Promise(t=>globalThis.setTimeout(t,e))]),!0):!1},mt=async({afterSerial:t=J,timeoutMs:n=14,force:r=!1}={})=>{let i=typeof globalThis.GPUDevice==`function`&&e instanceof globalThis.GPUDevice,a=()=>!!(i&&!M&&B&&R?.motionField?.buffer&&R?.motionPacing&&R.invalidationEpoch===P&&(R.lastDisplayedMotionAgeS||0)<R.motionPacing.maxSimulationAgeS);if(!a())return J;let o=await ft(60);if(o&&!a())return J;let s=!r&&(Y>=5.5||o&&Y>=3.5),c=r?Y>=22?3:Y>=14?2:1:Y<3.5?0:s?Math.min(3,Math.max(1,Math.ceil((Y-3.5)/8))):Math.min(3,Math.max(1,Math.ceil(Y/5))),l=(s||r?Math.max(t,J):t)+c;if(c<=0||J>=l)return J;let u=Math.max(Number(n)||14,Math.min(52,16+c*12)),d=Math.max(4,Math.min(54,u));return new Promise(e=>{let t=!1,n=null,r={targetSerial:l,wake:()=>{t||(t=!0,rt.delete(r),n!=null&&globalThis.clearTimeout(n),e(J))}};rt.add(r),n=globalThis.setTimeout(r.wake,d)})},ht=new Map,bt=(e,t,n={})=>{try{h?.(Gt({status:t,requestGeneration:e.generation,sourceCapturedBeforePhysicsContinuation:!0,...e.receiptFields,...n,updatedAtMs:Q()}))}catch{}},xt=(t,n)=>{if(!t)return;let r=()=>{try{t.destroyRenderRowsBuffer?.({reason:n})}catch{try{t.destroyRenderRowsBuffer?.()}catch{}}};try{_(e,r)}catch{r()}},Tt=e=>!e||e.productEventSourceBorrowReleased?!1:(e.productEventSourceBorrowReleased=!0,e.releaseProductEventSourceBorrow?.()===!0),Et=e=>!e||e.dispersedMediumSourceBorrowReleased?!1:(e.dispersedMediumSourceBorrowReleased=!0,e.releaseDispersedMediumSourceBorrow?.()===!0),Nt=e=>{if(!e?.ledgerParcelsBorrow)return;let t=e.ledgerParcelsBorrow;e.ledgerParcelsBorrow=null,t.release()},Ht=(t,n)=>{if(!t)return;if(Fe?.releaseFrame(t),t.motionField){let n=t.motionField;t.motionField=null,_(e,()=>n.destroy())}for(let e of t.surfaces||[])Xt(e,n);let r=t.participatingMedium;if(r?.packedFrame&&r.released!==!0){r.released=!0;try{Oe(r.packedFrame)}catch{}}},Zt=t=>{let n=z;z=null,n&&gn(()=>{_(e,()=>Ht(n.frame,t))}).catch(()=>{})},Qt=t=>{if(t)try{_(e,()=>t.destroy())}catch{t.destroy()}},$t=()=>(qe||=we(e,{colorFormat:n,depthFormat:r}),qe),en=()=>(Fe||=xe({device:e,format:n,depthFormat:r,onAppearanceReady(){M||In({reason:`worker-native-appearance-ready`}).catch(()=>{})}}),Fe),tn=async e=>{if(!(!e||e.released)){e.released=!0;try{await e.wrapper?.adapter?.release?.({destroyDevice:!1})}catch{}}},nn=async()=>{let e=[...ht.values()];ht.clear(),await Promise.all(e.map(tn))},rn=async t=>Ge&&Ke>=t?Ge:(await nn(),Ge?.destroy?.(),Ke=Math.max(4,Math.ceil(t)),Ge=e.createBuffer({label:`ulg-worker-owned-isosurface-render-field`,size:Ke,usage:Mt(`STORAGE`,At)|Mt(`COPY_SRC`,Dt)|Mt(`COPY_DST`,Ot)}),Ge),an=async t=>{let n=qt(t),r=ht.get(n);if(r&&!r.released&&r.scalarBuffer===t.scalarBuffer)return r;r&&await tn(r);let i=Jt(t),a=ne({device:e,volume:i,adapterId:`webgpu-marching-cubes.buffer-volume.v0`,adapterFactory({device:e,volume:t}){return D({device:e,volume:t,adapterId:`webgpu-marching-cubes.buffer-volume.v0`})}}),o={signature:n,scalarBuffer:t.scalarBuffer,volume:i,wrapper:a,released:!1};return ht.set(n,o),o},on=e=>[...e.surfaces||[]].sort((t,n)=>{let r=e=>e.translation?.surfaceDraw?.surfaces?.[0]||e.metadata||{},i=e=>Number.isFinite(Number(r(e).renderOrder))?Number(r(e).renderOrder):Number(r(e).transparencyClassId)||0,a=t=>{let n=$(r(t).boundsCenterM,3),i=$(e.cameraPositionM,3);return n&&i?n.reduce((e,t,n)=>e+(t-i[n])**2,0):0};return i(t)-i(n)||(de(t)===`opaque`?a(t)-a(n):a(n)-a(t))}),sn=null,cn=null,ln=Object.freeze({h2o:[.78,.9,.98],ice:[.78,.9,.98],fe:[.55,.56,.6]}),un=(t,i)=>{if(i?.solidRigidIsosurfaceSplatted===!0)return!1;let a=i?.solidRigidFamily??f(e);return!a||a.destroyed||a.device!==e||!Array.isArray(i.viewProjectionMatrix)?!1:(sn??=Se(e,{colorFormat:n,depthFormat:r}),sn.draw(t,a,{viewProjection:gt(i.viewProjectionMatrix),colorLinear:ln[String(a.materials?.[0]).toLowerCase()]??[.7,.7,.72]}),!0)},dn=(t,i)=>{let a=i?.deformableSolidFamily??d(e);if(!a||a.destroyed||a.device!==e||!Array.isArray(i.viewProjectionMatrix))return!1;cn??=s(e,{colorFormat:n,depthFormat:r});let o=gt(i.viewProjectionMatrix);for(let e of a.entries)cn.draw(t,e.stage,{viewProjection:o,colorLinear:ln[String(e.material).toLowerCase()]??[.76,.58,.36]});return!0},fn=async(o,{viewProjectionMatrix:s=o.viewProjectionMatrix,cameraPositionM:l=o.cameraPositionM,reason:u=`worker-owned-isosurface-frame`,allowLaggedGeneration:f=!1,requiresVisibleFrame:p=!1,requiresRecoverableFrame:h=!1,playbackRevision:_=null,motionOnly:y=!1,submissionBoundary:S=null,onSubmissionQueued:C=null,submissionDeadlineMs:w=null,expectedFramebufferEpoch:E=null,signal:ee=null,motionAgeS:D=o.lastDisplayedMotionAgeS||0}={})=>{let te=!1,ne=()=>!!(!M&&ee?.aborted!==!0&&(te||w==null||Number.isFinite(w)&&T()<=w)&&(_==null||_===V)&&(!y||B)&&o?.invalidationEpoch===P&&(E==null||Number(b())===E)&&o.generation>=Le&&(!p||R===o)&&(!h||z?.frame===o)&&(N===o.generation||f===!0));if(!ne())return!1;let O=o.participatingMedium?.status===St?o.participatingMedium.packedFrame:null,re=O?$t():null;if(await Promise.all([en().ready,re?.ready]),!ne())return!1;let ie=Me||$(s,16),ae=Ne||$(l,3);ie&&(o.viewProjectionMatrix=[...ie]),ae&&(o.cameraPositionM=[...ae]);let k=en(),pe=typeof c==`function`?null:t.getCurrentTexture(),me=$(typeof c==`function`?c():[pe?.width,pe?.height],2);if(!me||me.some(e=>!(e>0)))throw Error(`native material presentation requires a positive viewport`);let ge;do if(ge=Pe,o.nativeSurfaceAppearance=ge||o.request.nativeSurfaceMaterial,await k.prepare(o,me),!ne())return!1;while(ge!==Pe);Me&&(o.viewProjectionMatrix=[...Me]),Ne&&(o.cameraPositionM=[...Ne]);let _e=Rt(o.viewProjectionMatrix);if(!_e)throw Error(`native material requires an invertible camera`);D=Math.max(D,o.lastDisplayedMotionAgeS||0),o.drawMotionAgeS=D;let ve=!Je&&typeof e.pushErrorScope==`function`&&typeof e.popErrorScope==`function`,A=!1,ye=async()=>A?(A=!1,e.popErrorScope()):null,j,be,xe;ve&&(e.pushErrorScope(`validation`),A=!0);let Se=!S&&typeof globalThis.GPUDevice==`function`&&e instanceof globalThis.GPUDevice,Ce=e=>{if(!Se)return e();let t=globalThis.__ulgDecoupledPresentationBypassBurst;globalThis.__ulgDecoupledPresentationBypassBurst=!0;try{return e()}finally{globalThis.__ulgDecoupledPresentationBypassBurst=t}};try{let s=e.createCommandEncoder({label:`ulg-worker-owned-isosurface-presentation`}),c=t.getCurrentTexture(),l=c.createView(),u=i(),f=on(o),p=[`opaque-isosurface`],h=(e,t,n={})=>{if(k.draw(e,o,t,{inverse:_e,...n})!==!0)throw Error(`native isosurface draw is missing mandatory GPU buffers`)};if(Ce(()=>{let t=s.beginRenderPass({label:`ulg-worker-owned-isosurface-opaque-pass`,colorAttachments:[{view:l,clearValue:k.clearValue(o),loadOp:`clear`,storeOp:`store`}],depthStencilAttachment:{view:u,depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`store`}});try{k.drawBackground(t,o);let n=o?.deformableSolidFamily??d(e),r=n&&!n.destroyed&&n.device===e&&Array.isArray(o.viewProjectionMatrix)?new Set(n.entries.map(e=>Number(e.domainId)).filter(e=>Number.isFinite(e)&&e>0)):null;for(let e of f)de(e)===`opaque`&&(r&&Number(e?.metadata?.phaseId)===1&&r.has(Number(e?.metadata?.renderDomainId))||h(t,e));un(t,o),dn(t,o)}finally{t.end()}let i=f.filter(e=>de(e)===`refractive`);i.length&&p.push(`refractive-isosurface`);for(let t of i){k.copySceneColor(s,c);let i=typeof a==`function`?a():null,d=!!(i&&typeof k.copyOpaqueDepth==`function`&&k.copyOpaqueDepth(s,i)!==!1),f=s.beginRenderPass({label:`ulg-worker-owned-isosurface-refractive-backface-pass`,colorAttachments:[],depthStencilAttachment:{view:k.backDepthView(),depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`store`}});try{h(f,t,{backface:!0})}finally{f.end()}let p=s.beginRenderPass({label:`ulg-worker-owned-isosurface-refractive-pass`,colorAttachments:[{view:l,loadOp:`load`,storeOp:`store`}],depthStencilAttachment:{view:u,depthLoadOp:`load`,depthStoreOp:`store`}});try{h(p,t,{refractive:!0,hasOpaqueDepth:d});let i=o?.request?.nuclearCherenkovSources;if(o?.request&&`nuclearCherenkovSources`in o.request&&!(i?.sources?.length>0))ue(e)?.activeSourceCount>0&&he(e);else{let a=ue(e);if(i?.sources?.length>0&&!(a?.activeSourceCount>0)&&(le(e,{nuclearDescriptor:i}),a=ue(e)),a?.activeSourceCount>0&&a.cherenkovSourcesBuffer){Ie??=fe(e,{colorFormat:n,depthFormat:r});let i=k.getSurfaceDrawResources?.(o,t),s=t.translation?.surfaceVertices,c=t.translation?.surfaceDraw?.drawIndirectRowsBuffer;i?.opticalRecordsBuffer&&s&&c&&t.uniformBuffer&&Ie.draw(p,{compactPositionRowsBuffer:s.compactPositionRowsBuffer,compactNormalRowsBuffer:s.compactNormalRowsBuffer,drawIndirectRowsBuffer:c,cameraUniformBuffer:t.uniformBuffer,opticalRecordsBuffer:i.opticalRecordsBuffer,motionFieldBuffer:o.motionField?.buffer??null,motionUniformBuffer:i.motionUniformBuffer??null,backDepthView:k.backDepthView(),cherenkovSourcesBuffer:a.cherenkovSourcesBuffer})}}}finally{p.end()}}}),O){p.push(`depth-clipped-participating-medium`);let e=s.beginRenderPass({label:`ulg-worker-owned-participating-medium-pass`,colorAttachments:[{view:l,loadOp:`load`,storeOp:`store`}]});try{await De(re,e,{packedFrame:O,inverseViewProjectionMatrix:_e,cameraPositionM:o.cameraPositionM,viewportSize:me,depthTextureView:u,lightDirection:[.38,.82,.42],motionField:o.motionField,motionAgeS:Vt(o),decoupledBurstBypass:Se})}finally{e.end()}}if(p.push(`transparent-isosurface-and-overlay`),Ce(()=>{let e=s.beginRenderPass({label:`ulg-worker-owned-isosurface-transparent-overlay-pass`,colorAttachments:[{view:l,loadOp:`load`,storeOp:`store`}],depthStencilAttachment:{view:u,depthLoadOp:`load`,depthStoreOp:`discard`}});try{for(let t of f)de(t)===`vapor`&&h(e,t);m?.(e,o.viewProjectionMatrix,o.boxDimsM)}finally{e.end()}}),xe=Object.freeze(p),!ne())return await ye(),!1;if(j=Number(b()),!Number.isSafeInteger(j)||j<=0)throw Error(`worker-owned isosurface framebuffer epoch is unavailable`);let g=s.finish();if(be=Q(),Number(b())!==j||!ne())return await ye(),!1;Ce(()=>{e.queue.submit([g])}),te=!0,J+=1,st(),o.lastSubmittedMotionAgeS=D,Le=Math.max(Le,o.generation);let _=A?await ye():null;if(_)throw Error(_.message||String(_));ve&&(Je=!0)}catch(e){try{await ye()}catch{}throw e}if(!ne()||Number(b())!==j)return!1;if(typeof e.queue?.onSubmittedWorkDone!=`function`)throw Error(`worker-owned isosurface presentation queue completion is unavailable`);let we=typeof x==`function`?Number(x()):Ye+1;if(!Number.isSafeInteger(we)||we<=Ye)throw Error(`worker-owned isosurface presentation queue completion serial did not advance`);Ye=we;let Te=Ce(()=>e.queue.onSubmittedWorkDone()),Ee=!1,Oe=Promise.resolve(Te).then(()=>{Ee=!0,tt===Oe&&(tt=null)},()=>{tt===Oe&&(tt=null)});tt=Oe;let ke=(()=>{try{if(typeof v!=`function`)throw Error(`worker-owned isosurface presentation opportunity observer is unavailable`);return Promise.resolve(v({afterGpuCompletion:Te,isCurrent:()=>ne()&&Number(b())===j,signal:ee})).then(e=>{if(e?.available===!0&&!Ee)throw Error(`worker-owned isosurface presentation opportunity preceded GPU completion`);return e})}catch(e){return Promise.reject(e)}})();if(ke.catch(()=>{}),C?.(),await Te,!ne()||Number(b())!==j)return!1;let F=Q(),I=Math.min(40,Math.max(0,F-be));Y=Math.max(I,Y*.85+I*.15);let L=await ke,Ae=L?.available===!1&&L.method===`worker-request-animation-frame-timeout`;if(!Ae&&(!ne()||Number(b())!==j))return!1;if(L?.available!==!0)throw new(Ae?jt:Error)(`worker-owned isosurface lacked a post-GPU presentation opportunity`);let je=Number.isFinite(Number(L.observedAtMs))?Number(L.observedAtMs):Q(),Fe=Ut(o.opticalMetadataSnapshots||o.surfaces);o.presentationPassOrder=xe;let H=Bt(o),Re=Object.freeze({presentationFrameSchema:pt,presentationFrameStatus:`worker-owned-isosurface-presentation-opportunity`,presentationFrameAdmitted:!0,nativeMaterialShader:`existing-native-compact-surface-with-retained-motion`,condensedDepthTestEnabled:!0,condensedDepthWriteEnabled:!0,vaporDepthTestEnabled:!0,vaporDepthWriteEnabled:!1,isosurfaceTemporalPresentation:D>0,isosurfacePresentationMotionAgeS:D,isosurfacePresentationSourceTimeS:o.sourceTimeS??null,isosurfacePresentationMotionMethod:D>0?`bounded-gpu-field-velocity-extrapolation`:`committed-source-mesh`,presentationOnly:D>0,authoritativeStateMutation:!1,presentationFrameGpuCompleted:!0,presentationFrameGpuCompletionMethod:`worker-device.queue.onSubmittedWorkDone`,presentationFramePresentationOpportunity:!0,presentationFramePresentationOpportunityMethod:L.method??null,presentationFrameSubmitToGpuCompleteMs:Math.max(0,F-be),presentationFrameSubmitToPresentationOpportunityMs:Math.max(0,je-be),presentationQueueCompletionCount:Ye,presentationQueueCompletionSerial:we,presentationQueueCompletionMethod:`worker-device.queue.onSubmittedWorkDone`,presentationQueueCompletionScope:oe,physicsQueuePrefixCoverage:S?se:ce,physicsHostQueueFenceParticipation:S?!0:null,...S?{physicsContinuationBlocked:!0,presentationQosHostQueueFenceCount:1,motionPresentationQosBoundary:S}:{},workerFramebufferEpoch:j,workerOwnedOpticalPresentation:Fe,workerOwnedParticipatingMediumPresentation:H,presentationComposition:H.presentationComposition,marchingCubesSurfaceCount:H.marchingCubesSurfaceCount,collectiveOpticalSurfaceCount:H.collectiveOpticalSurfaceCount,participatingMediumStatus:H.status,participatingMediumAggregateDrawCount:H.participatingMediumAggregateDrawCount,collectiveOpticalShellFallbackCount:H.collectiveOpticalShellFallbackCount,participatingMediumDepthClipped:H.participatingMediumDepthClipped,participatingMediumPremultipliedAlpha:H.participatingMediumPremultipliedAlpha,presentationPassOrder:H.presentationPassOrder});o.lastDisplayedMotionAgeS=D;try{g?.({reason:u,generation:o.generation,surfaceCount:o.totalSurfaceCount??o.surfaces.length,sphStep:o.sphStep,...Re})}catch{}return Re},pn=0,mn=0,hn=null,gn=e=>{mn+=1;let t=Be.then(e);return Be=t.then(e=>{--mn,e&&(hn=T())},()=>{--mn}),t},_n=()=>hn==null||T()-hn>16.666666666666668,vn=(e,t)=>gn(()=>fn(e,t)),yn=e=>{if(M||!B||R!==e||!e?.motionField?.buffer||!e.motionPacing||e.invalidationEpoch!==P||e.generation<Le)return!1;let t=A(e.motionPacing,T());return t>(e.lastDisplayedMotionAgeS||0)&&t<e.motionPacing.maxSimulationAgeS},bn=({waitForPendingSlot:e=!1}={})=>typeof e!=`boolean`||G||!_n()&&(W||mn>0)?!1:(e||!W)&&yn(R),xn=()=>{H+=1,Re!=null&&globalThis.clearTimeout(Re),Re=null,ze?.(),ze=null},Sn=t=>{if(xn(),!B||!t?.motionField?.buffer||!t.motionPacing)return;let n=H,r=V,i=je.signal,a=()=>!M&&R===t&&B&&r===V&&t.invalidationEpoch===P&&H===n,o=Symbol(`coalesced-isosurface-temporal-frame`),s=!1,c=!1;(async()=>{for(;a();){let n=T(),l=A(t.motionPacing,n);if(l==null||s&&l>=t.motionPacing.maxSimulationAgeS)return;let u=null;if(l>(t.lastDisplayedMotionAgeS||0)){try{u=await gn(()=>{if(!a())return!1;let e=A(t.motionPacing,T());if(e==null||s&&e>=t.motionPacing.maxSimulationAgeS)return!1;let n=t.lastDisplayedMotionAgeS||0;if(!(e>n))return o;let c=Math.fround(Vt({motionPacing:t.motionPacing,drawMotionAgeS:n}));return Math.fround(Vt({motionPacing:t.motionPacing,drawMotionAgeS:e}))>c?fn(t,{reason:`worker-owned-isosurface-temporal-presentation`,allowLaggedGeneration:!0,requiresVisibleFrame:!0,playbackRevision:r,motionOnly:!0,signal:i,motionAgeS:e}):e>=t.motionPacing.maxSimulationAgeS?!1:o})}catch(e){if(!(e instanceof jt))throw e;if(!a())return;t.temporalPresentationError=e.message;let n=A(t.motionPacing,T());if(!Number.isFinite(n)||n>=t.motionPacing.maxSimulationAgeS)return;s=!0,u=o}if(!u||!a())return;u!==o&&(s=!1,t.temporalPresentationError=null,Cn(t,`presentation-only retained GPU field motion`,u))}if((t.lastDisplayedMotionAgeS||0)>=t.motionPacing.maxSimulationAgeS)return;let d=typeof globalThis.GPUDevice==`function`&&e instanceof globalThis.GPUDevice,f=!!(u&&u!==o&&(Number(u.presentationFrameSubmitToPresentationOpportunityMs)>=4||d&&u.presentationFramePresentationOpportunityMethod===`worker-request-animation-frame-after-gpu-completion`)),p=Math.max(Ze,X+Y),m=!!(L||I||Ue>0||Z!=null&&t.sourceTimeS!=null&&Z>=t.sourceTimeS);if(!t.buildHandoffSlowed&&m&&p>=1&&t.motionPacing&&(t.lastDisplayedMotionAgeS||0)>=t.motionPacing.maxSimulationAgeS*.5&&(t.lastDisplayedMotionAgeS||0)<t.motionPacing.maxSimulationAgeS){t.buildHandoffSlowed=!0;let e=Math.min(.2,Math.max(.12,Ze*1.25/1e3,(X*2+Y*1.5)/1e3)),n=j(t.motionPacing,T(),e,t.lastDisplayedMotionAgeS||0);n!==t.motionPacing&&(t.motionPacing=n)}let h=1e3/t.motionPacing.targetHz-(T()-n),g=d?0:2;!u&&!c&&(t.lastDisplayedMotionAgeS||0)===0&&h>g?(c=!0,h=g):d&&u===o&&h>1&&(h=1),(h>0||d&&!u&&c&&(t.lastDisplayedMotionAgeS||0)===0)&&!f&&a()&&await new Promise(e=>{ze=e,Re=globalThis.setTimeout(()=>{Re=null,ze=null,e()},Math.max(0,h))})}})().catch(e=>{a()&&(t.temporalPresentationError=String(e?.message||e))})},Cn=(e,t,n)=>{let i=Bt(e),a=e.surfaces.length+i.participatingMediumAggregateDrawCount;bt({generation:e.generation,receiptFields:e.receiptFields},lt,{reason:t,surfaceCount:e.totalSurfaceCount??e.surfaces.length,submittedSurfaceCount:a,activeSurfaceCount:null,indirectDrawCount:a,depthAttachmentFormat:r,depthAttachmentReady:!0,boxWireframeDrawCount:+!!e.boxDimsM,boxDimsM:e.boxDimsM?[...e.boxDimsM]:null,nonemptySurfaceCountMode:`gpu-indirect-not-read-back`,triangleCountMode:`gpu-indirect-not-read-back`,readbackMode:_t,...n})},wn=(t,n,r,i)=>{let a=t.ledgerParcelsBorrow?.parcels??null;if(!a||a.device!==e||globalThis.__ulgDisableLedgerParcelOptics)return null;let o=r.surfaceTable.metadata,s=i.consumedSurfaceIndices.find(e=>Number(o[e]?.materialId)===a.vaporMaterialId),c=s==null?null:o[s],l=globalThis.__ulgLedgerParcelOptics??={frames:0,routed:0,unrouted:0};return l.frames++,c?(l.routed++,Ee({device:e,encoder:n,parcels:a,fieldRowsBuffer:i.fieldRowsBuffer,fieldOffset:Number(c.fieldOffset),resolution:Number(c.resolution),fieldPadding:Number(r.fieldPadding),refEdgeM:Number(r.refEdgeM)})):(l.unrouted++,null)},Tn=async(t,n)=>{let r=Q();if((n?.dispersedMediumOptics??null)!==t.dispersedMediumOptics)throw TypeError(`worker-owned isosurface capture did not retain its exact dispersed-medium sidecar`);let i=await rn(t.request.surfaceTable.totalFieldCells*te*Float32Array.BYTES_PER_ELEMENT),a=t.productEvents,o=await k({device:e,renderRows:n.renderRows,renderRowsBuffer:n.renderRowsBuffer,renderRowsSource:n,dispersedMediumOptics:t.dispersedMediumOptics,schroederSpatialSourceFamily:n.schroederSpatialSourceFamily,surfaceTable:t.request.surfaceTable,particleCount:n.particleCount,productEventBuffer:a.productEventBuffer,productEventSource:a.productEventSource,productEventCount:a.productEventCount,productEventLiveCountDescriptor:a.productEventLiveCountDescriptor,fieldPadding:Number(t.request.fieldPadding),refEdgeM:Number(t.request.refEdgeM),renderSmearDtS:Math.max(0,Number(t.request.renderSmearDtS)||0),readbackMode:_t,retainFieldRowsBuffer:!0,retainMotionFieldBuffer:!0,retainSurfaceBuffer:!1,waitForQueueCompletion:!1,deferCleanup:!0,targetFieldRowsBuffer:i,targetFieldRowsBufferByteLength:Ke});Tt(t),Et(t),xt(n,`worker-isosurface-render-field-submitted`),t.capturedReleased=!0,typeof globalThis.GPUDevice==`function`&&e instanceof globalThis.GPUDevice&&B&&R?.motionField?.buffer&&(await ft(50),await new Promise(e=>globalThis.setTimeout(e,0)));let s=o.surfaceTable.metadata.map(Lt),c=s.map((t,n)=>C({device:e,renderField:o,surface:o.surfaceTable.metadata[n],surfaceIndex:n})),l=c.find(e=>e?.ok!==!0);if(l)throw o.destroyRenderFieldBuffers?.({force:!0,releaseLeases:!0,reason:`worker-isosurface-descriptor-blocked`}),Error(l.reason||l.status);let u,d,f=null,m=new Set,h;try{if(u=Object.freeze(c.map((e,t)=>Object.freeze({descriptor:e,metadata:s[t]}))),d=s.map((e,t)=>zt(e)?t:-1).filter(e=>e>=0),d.length>0){f=Ce({device:e,renderField:o,surfaceDescriptors:d.map(e=>u[e])});let t=f?.status;if(![St,Ct,wt].includes(t))throw TypeError(`participating-medium descriptor returned an unknown route status`);let n=f.consumedSurfaceIndices;if(!Array.isArray(n))throw TypeError(`participating-medium descriptor omitted consumed surface indices`);m=new Set(n);let r=new Set(d);if(!(m.size===r.size&&[...m].every(e=>Number.isSafeInteger(e)&&r.has(e))))throw TypeError(`participating-medium descriptor did not consume the exact collective optical route set`)}h=c.filter((e,t)=>!m.has(t))}catch(e){throw o.destroyRenderFieldBuffers?.({force:!0,releaseLeases:!0,reason:`worker-participating-medium-descriptor-failed`}),e}let g=e.createCommandEncoder({label:`ulg-worker-owned-isosurface-marching-cubes`}),v=[],b=[],x=null,S=null,w=null,T=t.solidRigidFamily??null,D=!1;try{T&&(w=E({device:e,encoder:g,family:T,renderField:o}),D=!!w);for(let n of h){let r=await an(n);re({device:e,descriptor:n,volume:r.volume});let i=await r.wrapper.extractSurface({volume:r.volume,isovalue:n.isovalue,ownsBuffer:!0,readbackMode:vt,vertexRowsBudget:Math.max(3,Math.floor(Number(t.request.vertexRowsBudget)||3)),commandEncoder:g}),a=Yt(i);if(a?.ok===!1||!a?.result)throw Error(i?.reason||a?.status||`worker-owned marching-cubes extraction failed`);let o={descriptor:n,wrapped:i,rawExecution:a,temperatureRows:null};v.push(o);let s=a.result,c=s.outputDescriptors?.rows?.position||s.rowMetadata?.position,l=c?.buffer||s.outputDescriptors?.retainedBuffers?.position||s.buffer,u=s.actualVertexCounterBuffer||s.vertexCounterBuffer;o.temperatureRows=ie({device:e,commandEncoder:g,compactPositions:{buffer:l,byteLength:c?.bufferByteLength??s.bufferByteLength??l?.size,rowCount:c?.rowCount??s.vertexCount,strideFloats:c?.rowStrideFloats??s.vertexStrideFloats,surfaceGenerationId:s.surfaceGenerationId,volumeGenerationId:s.volumeGenerationId},actualVertexCounter:{buffer:u,byteLength:s.actualVertexCounterBufferByteLength??s.vertexCounterBufferByteLength??u?.size},renderField:{buffer:n.scalarBuffer,byteLength:n.scalarBufferByteLength,dims:n.dims,scalarStrides:n.scalarStrides,scalarOffsetFloats:n.scalarOffset,volumeGenerationId:s.volumeGenerationId},generation:{surfaceGenerationId:s.surfaceGenerationId,volumeGenerationId:s.volumeGenerationId}})}if(f?.status===St&&(S=wn(t,g,o,f),x=await Te($t(),g,f),x?.status!==`participating-medium-packed-gpu-resident`||x.readback!==!1))throw TypeError(`participating-medium pack did not return an exact GPU-resident no-readback frame`);if(typeof globalThis.GPUDevice==`function`&&e instanceof globalThis.GPUDevice&&B&&R?.motionField?.buffer&&(await ft(50)||h.length>=6||Y>=5.5)&&await new Promise(e=>globalThis.setTimeout(e,0)),e.queue.submit([g.finish()]),w||S){let t=w,n=S;w=null,S=null,_(e,()=>{t?.destroy?.(),n?.destroy?.()})}for(let e of v)e.rawExecution.result?.retireTemporaryResourcesAfterSubmit?.();let n=[];for(let t of v){let r=t.descriptor,i=s[r.surfaceIndex],a=await ee({device:e,extensionExecution:t.rawExecution,schroederSpatialSourceFamily:o.schroederSpatialSourceFamily,surfaceIndex:r.surfaceIndex,materialId:i.materialId,phaseId:i.phaseId,opticalStateId:i.opticalStateId,material:i.material,phase:i.phase,renderKey:i.renderKey,surfaceKey:i.surfaceKey,isolation:r.isovalue,transparencyClassId:i.transparencyClassId,depthWriteFlag:i.depthWriteFlag,renderOrder:i.renderOrder,positionTransform:r.positionTransform,positionTransformResolution:i.resolution,sourceVoxelLinearIndex:r.fieldOffset,fieldPadding:o.fieldPadding,refEdgeM:o.refEdgeM,positionGridBias:r.positionTransformGridBias,fieldGradient:{buffer:r.scalarBuffer,scalarOffsetFloats:r.scalarOffset,rowStrideFloats:r.cellRowStrideFloats,resolution:i.resolution},readbackMode:_t,compactSummaryReadback:!1,translateVertexRows:!1,allowExtensionDrawIndirectBuffer:!0,retainVertexRowsBuffer:!0,retainDrawRowsBuffer:!0,retainDrawIndirectRowsBuffer:!0,waitForQueueCompletion:!1}),c=Mt(`UNIFORM`,kt)|Mt(`COPY_DST`,Ot),l=typeof globalThis.GPUDevice==`function`&&e instanceof globalThis.GPUDevice?y(p(e,{bucketKey:`ulg-worker-owned-isosurface-uniform`,label:`ulg-worker-owned-isosurface-uniform-${r.surfaceIndex}`,size:pe,usage:c}),e,{bucketKey:`ulg-worker-owned-isosurface-uniform`,size:pe,usage:c}):e.createBuffer({label:`ulg-worker-owned-isosurface-uniform-${r.surfaceIndex}`,size:pe,usage:c}),u=t.temperatureRows;a.nativeSurfaceTemperatureRows=u,Object.assign(a.surfaceDraw,{compactTemperatureRowsBuffer:u.temperatureRowsBuffer,compactTemperatureRowsBufferRetained:!0,compactTemperatureRowsBufferByteLength:u.temperatureRowsBufferByteLength,compactTemperatureRowsBufferRowCount:u.temperatureRowsBufferRowCount,compactTemperatureRowsStrideFloats:u.temperatureRowsStrideFloats,compactTemperatureRowsSchema:u.temperatureRowsSchema,compactTemperatureRowsLayoutName:u.temperatureRowsLayoutName,compactTemperatureRowsEncoding:u.encoding,compactTemperatureRowsSemantic:u.semantic,compactTemperatureRowsSurfaceGenerationId:u.surfaceGenerationId,compactTemperatureRowsVolumeGenerationId:u.volumeGenerationId,compactTemperatureRowsCoverageSchema:u.coverage.schema,compactTemperatureRowsCoverageComplete:u.coverage.complete,compactTemperatureRowsCoverageRowCount:u.coverage.rowCount,compactTemperatureRowsOwnership:u.temperatureRowsOwnership,compactTemperatureRowsAdditionalSubmitCount:0}),n.push({descriptor:r,metadata:i,translation:a,rawExecution:t.rawExecution,uniformBuffer:l,releaseTemperatureRows:()=>Qt(u),bindGroups:new Map}),b.push(n[n.length-1])}let i=o.takeMotionField?.()||null;o.destroyRenderFieldBuffers?.({force:!0,releaseLeases:!0,reason:`worker-isosurface-extraction-submitted`});let a=Math.min(200,Math.max(0,Q()-r));return X=X>0?Math.max(a,X*.7+a*.3):a,{generation:t.generation,invalidationEpoch:t.invalidationEpoch,sphStep:t.sphStep,sourceTimeS:t.sourceTimeS,motionField:i,request:t.request,receiptFields:t.receiptFields,viewProjectionMatrix:[...t.admission.viewProjectionMatrix],cameraPositionM:[...t.admission.cameraPositionM],boxDimsM:$(t.request.boxDimsM,3),totalSurfaceCount:s.length,opticalMetadataSnapshots:s,participatingMedium:f?{status:f.status,reason:f.reason??null,collectiveSurfaceCount:d.length,consumedSurfaceCount:m.size,packedFrame:x,released:!1}:null,solidRigidFamily:T??null,solidRigidIsosurfaceSplatted:D,surfaces:n}}catch(e){w?.destroy(),S?.destroy(),o.destroyRenderFieldBuffers?.({force:!0,releaseLeases:!0,reason:`worker-isosurface-extraction-failed`});for(let e of b)Xt(e,`worker-isosurface-partial-translation-failed`);let t=new Set(b.map(e=>e.rawExecution));for(let e of v)if(!t.has(e.rawExecution)){e.temperatureRows&&Qt(e.temperatureRows);try{e.rawExecution?.result?.release?.()}catch{}}if(x)try{Oe(x)}catch{}throw e}},En=(t,n,r,i)=>{let a=R;if(R=t,Z!=null&&t.sourceTimeS!=null&&t.sourceTimeS>Z&&(Z=null),R.sourcePresentedAtMs=T(),$e!=null&&a&&a.sourceTimeS===et){let e=Math.min(260,Math.max(0,R.sourcePresentedAtMs-$e));Ze=Ze>0?Math.max(e,Ze*.7+e*.3):e,$e=null,et=null}R.sourcePresentationPausedWallMs=O.pausedAt(R.sourcePresentedAtMs);let o=a?a.sourcePresentationPausedWallMs:t.sourceTimingPausedWallMs;R.motionPacing=_e(R,a,R.sourcePresentedAtMs,n,{pausedWallDeltaMs:o==null?NaN:R.sourcePresentationPausedWallMs-o}),Sn(R),a&&_(e,()=>{Ht(a,`worker-isosurface-replaced`)}),Cn(R,r,i)},Dn=async()=>{if(!(ke||M)){ke=!0;try{for(;L&&!M;){let e=L;L=null,I=e;let t=null,n=null;try{if(t=await e.capturePromise,e.invalidationEpoch!==P||M){bt(e,dt,{reason:`the worker-owned isosurface presentation was invalidated`});continue}if(n=await(ge??Tn)(e,t),n.request=e.request,n.sourceTimeS=e.sourceTimeS,n.sourceTimingPausedWallMs=e.sourceTimingPausedWallMs,e.invalidationEpoch!==P||M)if(!M&&e.invalidationEpoch!==P&&N===e.generation&&q===P)e.invalidationEpoch=P,n.invalidationEpoch=P;else{Ht(n,`worker-isosurface-superseded-before-presentation`),n=null,bt(e,dt,{reason:`the worker-owned isosurface presentation was invalidated`});continue}if(R&&R.generation>=n.generation){Ht(n,`worker-isosurface-older-than-visible-frame`),n=null,bt(e,dt,{reason:`a newer isosurface generation is already visible`});continue}let r=!1,i=()=>!M&&I===e&&N===e.generation,a=async e=>{for(;;)try{return await gn(()=>r&&!i()?!1:fn(n,{reason:e,allowLaggedGeneration:!r}))}catch(e){if(!(e instanceof jt))throw e;if(!i())return!1;if(r)throw e;r=!0}},o=await a(`committed-worker-isosurface`);for(;!o?.presentationFrameAdmitted&&n.invalidationEpoch!==P&&N===e.generation&&q===P&&P>n.invalidationEpoch&&!M;){let t=P;e.invalidationEpoch=t,n.invalidationEpoch=t,o=await a(`committed-worker-isosurface-after-resize`)}if(!o?.presentationFrameAdmitted){if(n.invalidationEpoch!==P||M||N!==e.generation){Ht(n,`worker-isosurface-invalidated-during-presentation`),n=null,bt(e,dt,{reason:`the worker-owned isosurface presentation was invalidated during submit`});continue}throw Error(`worker-owned isosurface frame was not current at submit`)}En(n,e.sourceTimingBootstrap,`same-device retained state rendered as true isosurface`,o),n=null}catch(t){t instanceof jt&&n&&!M&&n.generation===N&&n.generation===Le&&n.invalidationEpoch===P&&(Zt(`worker-isosurface-recovery-replaced`),z=Object.freeze({frame:n,sourceTimingBootstrap:e.sourceTimingBootstrap,parkedAfterRedrawSequence:Ae}),n=null),n&&Ht(n,`worker-isosurface-build-failed`),bt(e,ut,{reason:t instanceof Error?t.message:String(t),...Wt(t)})}finally{t&&!e.capturedReleased&&xt(t,`worker-isosurface-capture-retired`),Tt(e),Et(e),Nt(e),I=null}}}finally{ke=!1}}},On=()=>{if(F||M)return;let e=Dn();F=e,e.finally(()=>{F===e&&(F=null),L&&!M&&On()})},kn=(e,t)=>{e&&(Tt(e),Et(e),Nt(e),e.capturePromise.then(e=>{xt(e,`worker-isosurface-queued-job-superseded`)}).catch(()=>{}),bt(e,dt,{reason:t}))},An=()=>{K&&=(K.resolve(!1),null)},jn=()=>{for(let e of We)e();We.clear()},Mn=()=>{Ue=Math.max(0,Ue-1),Ue===0&&jn()},Nn=()=>Ue===0?Promise.resolve():new Promise(e=>We.add(e)),Pn=async()=>{for(;K&&!M;){let e=K.allowCandidateRecovery&&K.requestSequence>(z?.parkedAfterRedrawSequence??1/0)&&z?.frame.generation===N&&z.frame.generation===Le&&z.frame.invalidationEpoch===P?z:null,t=e||R&&R.invalidationEpoch===P&&R.generation>=Le;if(!t){if(F){await F.catch(()=>{});continue}if(Ue>0){await Nn();continue}}let n=K;K=null;let r=e?.frame||R;if(!t){n.resolve(!1);continue}try{let t=await vn(r,{...n.options,allowLaggedGeneration:!e,requiresVisibleFrame:!e,requiresRecoverableFrame:!!e});if(e&&t&&z===e&&r.generation===N&&r.invalidationEpoch===P&&!M){z=null,En(r,e.sourceTimingBootstrap,n.options.reason,t),n.resolve(!0);continue}let i=!!(!e&&t&&R===r&&r.invalidationEpoch===P&&r.generation>=Le&&!M);if(i)Cn(r,n.options.reason,t);else if(!M&&!K&&(I||L||Ue>0)){K=n;continue}n.resolve(i)}catch(t){e&&z?.frame.generation===e.frame.generation&&!(t instanceof jt)&&Zt(`worker-isosurface-recovery-failed`),n.reject(t)}}},Fn=()=>{if(He||M||!K)return;let e=Pn();He=e,e.finally(()=>{He===e&&(He=null),Fn()})},In=(e,{allowCandidateRecovery:t=!1}={})=>{if(M)return Promise.resolve(!1);let n=++Ae,r=$(e?.viewProjectionMatrix,16),i=$(e?.cameraPositionM,3);if(r&&(Me=[...r]),i&&(Ne=[...i]),e?.nativeSurfaceAppearance!=null&&(Pe=structuredClone(e.nativeSurfaceAppearance)),M||!R&&!z&&Ue===0&&!I&&!L)return Promise.resolve(!1);let a,o,s=new Promise((e,t)=>{a=e,o=t});return An(),K={options:e,allowCandidateRecovery:t,requestSequence:n,resolve:a,reject:o},Fn(),s};return Object.freeze({async enqueue({request:t,retained:n,sphStep:r=null,receiptFields:i={},sourceTimingBootstrap:a=null}={}){if(M)return Gt({status:ut,reason:`worker-owned isosurface presenter is disposed`,...i});let s=Kt({request:t,retained:n});if(!s.ok)return Gt({status:ut,reason:s.reason,admission:s,...i});t={...t,nativeSurfaceMaterial:s.nativeSurfaceMaterial},N+=1,Zt(`worker-isosurface-recovery-superseded`);let c=N,d=n.sphParticleUpload?.time,f=typeof d==`number`&&Number.isFinite(d)?d:null;a=be(a);let p=a?O.pausedAt(a.sourceObservedAtMs):null,m=P,h,g=null,_=null,v=null;try{let t=It(e,n.sphParticleUpload);v=t?.sidecar??null,_=t?.release??null,h=Pt({device:e,retained:n}),g=Ft(h.productEventSource)}catch(e){return _?.(),g?.(),Gt({status:ut,reason:e instanceof Error?e.message:String(e),requestGeneration:c,sourceCapturedBeforePhysicsContinuation:!1,admission:s,...i,...Wt(e),updatedAtMs:Q()})}let y;Ue+=1;try{y=await ae({device:e,sphParticleState:n.sphParticleState,mlsMpmParticleState:n.mlsMpmParticleState,sphParticleUpload:n.sphParticleUpload,mlsMpmParticleUpload:n.mlsMpmParticleUpload,sourceStateBuffer:n.sourceStateBuffer,sourceThermoBuffer:n.sourceThermoBuffer,sourceIdentityBuffer:n.sourceIdentityBuffer,sourceMechanicsBuffer:n.sourceMechanicsBuffer,schroederSpatialSourceFamily:n.successorSourceFamily,retainRenderRowsBuffer:!0,readbackMode:_t})}catch(e){return Mn(),g?.(),_?.(),Gt({status:ut,reason:e instanceof Error?e.message:String(e),requestGeneration:c,sourceCapturedBeforePhysicsContinuation:!1,admission:s,...i,...Wt(e),updatedAtMs:Q()})}if(Mn(),(y?.dispersedMediumOptics??null)!==v)return g?.(),_?.(),xt(y,`worker-isosurface-dispersed-medium-capture-mismatch`),Gt({status:ut,reason:`worker-owned isosurface capture did not retain its exact dispersed-medium sidecar`,requestGeneration:c,sourceCapturedBeforePhysicsContinuation:!0,admission:s,...i,updatedAtMs:Q()});let b=!!(M||m!==P),x=!!(!M&&b&&N===c&&q===P);if(b&&!x)return g?.(),_?.(),xt(y,`worker-isosurface-capture-invalidated-before-enqueue`),Gt({status:dt,reason:`worker-owned isosurface source capture was invalidated before enqueue`,requestGeneration:c,sourceCapturedBeforePhysicsContinuation:!0,admission:s,...i,updatedAtMs:Q()});let S={sourceTimeS:f,sourceTimingBootstrap:a,sourceTimingPausedWallMs:p,generation:c,request:t,retained:n,admission:s,sphStep:r,receiptFields:i,productEvents:h,dispersedMediumOptics:v,ledgerParcelsBorrow:u(n.sphParticleUpload),solidRigidFamily:o(n.sphParticleUpload)??(n.sphParticleState?.rigidBodies?l(n.sphParticleUpload,n.sphParticleState.rigidBodies,e):null),releaseProductEventSourceBorrow:g,productEventSourceBorrowReleased:!1,releaseDispersedMediumSourceBorrow:_,dispersedMediumSourceBorrowReleased:!1,capturePromise:Promise.resolve(y),invalidationEpoch:x?P:m,capturedReleased:!1};return L&&kn(L,`a newer committed isosurface request replaced this queued request`),L=S,On(),Gt({status:ct,reason:`exact committed retained source capture submitted before continuation`,requestGeneration:c,sourceCapturedBeforePhysicsContinuation:!0,surfaceCount:s.surfaceCount,totalFieldCells:s.totalFieldCells,particleCount:s.particleCount,readbackMode:_t,...i,updatedAtMs:Q()})},setPresentationPlaying(e){if(typeof e!=`boolean`)throw TypeError(`presentation playing must be a boolean`);if(M||e===B)return!1;let t=T();return O.setPlaying(e,t),B=e,V+=1,je.abort(),je=new AbortController,xn(),e||(Z=null,$e=null,et=null,st(!0)),e?R?.motionPacing&&(R.motionPacing=ye(R.motionPacing,t,R.lastDisplayedMotionAgeS||0),Sn(R)):R&&R.lastSubmittedMotionAgeS>(R.lastDisplayedMotionAgeS||0)&&In({reason:`worker-isosurface-pause-frozen-redraw`,playbackRevision:V}).catch(()=>{}),!0},async redraw({viewProjectionMatrix:e=null,cameraPositionM:t=null,nativeSurfaceAppearance:n=null,reason:r=`worker-owned-isosurface-camera-redraw`}={}){return In({viewProjectionMatrix:e,cameraPositionM:t,nativeSurfaceAppearance:n,reason:r},{allowCandidateRecovery:!0})},beginPendingSourceProgress({scheduleId:e,laneId:t,stateKey:n,presentationLaneEpoch:r,sourceTimeS:i,totalStepCount:a}={}){let o=++pn,s=P,c=T(),l=O.pausedAt(c);if(M||typeof e!=`string`||!e.trim()||typeof t!=`string`||!t.trim()||typeof n!=`string`||!n.trim()||!Number.isSafeInteger(r)||r<=0||typeof i!=`number`||!Number.isFinite(i)||i<0||!Number.isSafeInteger(a)||a<=1||!Number.isFinite(c)||c<0)return null;Z=i;let u=null,d=0,f=c,p=!1;return m=>{if(p||M||!B||o!==pn||s!==P||u&&R!==u||m?.scheduleId!==e)return!1;let h=m.stepOrdinal,g=T();if(!Number.isSafeInteger(h)||h<=d||h>a||m.completedStepCount!==h||!Number.isFinite(g)||g<f)return!1;if(d=h,f=g,h===a){if(p=!0,$e=g,et=i,!u){let e=R;e?.motionField?.buffer&&e.motionPacing&&e.invalidationEpoch===s&&e.sourceTimeS===i&&e.receiptFields?.laneId===t&&e.receiptFields?.stateKey===n&&e.receiptFields?.presentationLaneEpoch===r&&(u=e)}if(u&&Math.max(Ze,X+Y)>=1){let e=Math.min(.26,Math.max(.06,Ze*1.15/1e3,(X*2.5+Y*1.5)/1e3)),t=j(u.motionPacing,g,e,u.lastDisplayedMotionAgeS||0);t!==u.motionPacing&&(u.motionPacing=t)}return!1}if(!u){let e=R;if(!e?.motionField?.buffer||!e.motionPacing||e.invalidationEpoch!==s||e.sourceTimeS!==i||e.receiptFields?.laneId!==t||e.receiptFields?.stateKey!==n||e.receiptFields?.presentationLaneEpoch!==r)return!1;u=e}let _=g-c-(O.pausedAt(g)-l),v=Math.max(Ze,X+Y)>=1?Math.min(.26,Math.max(.06,Ze*1.15/1e3,(X*2.5+Y*1.5)/1e3)):0,y=_/1e3*(a-h)/h+v,b=j(u.motionPacing,g,y,u.lastDisplayedMotionAgeS||0);return b===u.motionPacing?!1:(u.motionPacing=b,!0)}},hasSubmissionBoundaryOpportunity(){let e=R;if(M||!B||mn>0||tt!=null||!e?.motionField?.buffer||!e.motionPacing||e.invalidationEpoch!==P)return!1;let t=A(e.motionPacing,T()),n=e.lastDisplayedMotionAgeS||0;if(!(t>n)||!(t<e.motionPacing.maxSimulationAgeS))return!1;let r=Math.fround(Vt({motionPacing:e.motionPacing,drawMotionAgeS:n}));return Math.fround(Vt({motionPacing:e.motionPacing,drawMotionAgeS:t}))>r},getPresentationSubmitSerial(){return J},waitForPresentationSubmitTurn({afterSerial:e=J,timeoutMs:t=12,force:n=!1}={}){return mt({afterSerial:e,timeoutMs:t,force:n})},hasRetainedSubmissionGapOpportunity:bn,presentRetainedSubmissionGap({signal:e=null,waitForPendingSlot:t=!1}={}){if(e?.aborted||!bn({waitForPendingSlot:t}))return Promise.resolve(!1);let n=R,r=P,i=Number(b());if(!Number.isSafeInteger(i)||i<=0)return Promise.resolve(!1);let a=T()+1e3/60,o=W,s=new AbortController,c=AbortSignal.any([s.signal,je.signal,...e?[e]:[]]),l=V,u,d=!1,f=new Promise(e=>{u=e}),p,m=new Promise(e=>{p=e}),h,g={abort:()=>s.abort(),completed:new Promise(e=>{h=e})},_=null,v=e=>{d||(d=!0,globalThis.clearTimeout(_),u(e))},y=()=>{v(!1),p(!1)};c.addEventListener(`abort`,y,{once:!0});let x=e=>{v(!1),c.removeEventListener(`abort`,y),W===g&&(W=null),G===g&&(G=null),h(e===!0&&!c.aborted)},S=()=>!c.aborted&&!M&&B&&l===V&&P===r&&R===n&&n.invalidationEpoch===r&&Number(b())===i&&T()<=a;_=globalThis.setTimeout(()=>s.abort(),1e3/60);let C=()=>{try{if(!S()||W||!yn(n)){x(!1);return}G===g&&(G=null),W=g,gn(async()=>{if(!S()||!yn(n))return!1;let e=await fn(n,{reason:`worker-owned-isosurface-retained-submission-gap`,allowLaggedGeneration:!0,requiresVisibleFrame:!0,playbackRevision:l,motionOnly:!0,signal:c,motionAgeS:A(n.motionPacing,T()),submissionDeadlineMs:a,expectedFramebufferEpoch:i,onSubmissionQueued:()=>v(!0)});return e&&Cn(n,`presentation-only retained mesh between physics submissions`,e),e}).then(e=>x(!!e),()=>x(!1))}catch{x(!1)}};return o?(G=g,Promise.race([o.completed,m]).then(e=>{e===!0?C():x(!1)},()=>x(!1))):C(),f},presentSubmissionBoundary(e,{signal:t=null}={}){if(t?.aborted||M||!B||!e||![`submissionOrdinal`,`completedSubstepCount`,`totalSubstepCount`,`chunkStepCount`].every(t=>Number.isSafeInteger(e[t])&&e[t]>0)||e.completedSubstepCount>=e.totalSubstepCount||e.chunkStepCount>e.completedSubstepCount)return Promise.resolve(!1);let n=Object.freeze({...e}),r=V,i=t?AbortSignal.any([t,je.signal]):je.signal;return gn(async()=>{if(i.aborted||r!==V)return!1;let e=R;if(!e?.motionField?.buffer||!e.motionPacing)return!1;let t=A(e.motionPacing,T());if(!(t>(e.lastDisplayedMotionAgeS||0)))return!1;let a=await fn(e,{reason:`worker-owned-isosurface-submission-boundary`,allowLaggedGeneration:!0,requiresVisibleFrame:!0,motionAgeS:t,submissionBoundary:n,signal:i,playbackRevision:r,motionOnly:!0});return a?(Cn(e,`presentation-only retained mesh at submission boundary`,a),a):!1})},async resize({viewProjectionMatrix:e=null,cameraPositionM:t=null,reason:n=`worker-owned-isosurface-presentation-resize`}={}){if(M)return!1;Ve(),xn();let r=P;if(P+=1,q=P,z){let e=z,t=e.frame;if(t.generation===N&&t.invalidationEpoch===r){let n={...t,invalidationEpoch:P};z=Object.freeze({...e,frame:n}),gn(()=>{Fe?.transferFrame(t,n),t.surfaces=[],t.participatingMedium=null,t.motionField=null}).catch(()=>{z?.frame.generation===n.generation&&Zt(`worker-isosurface-recovery-resize-transfer-failed`)})}else Zt(`worker-isosurface-recovery-resize-invalidated`)}if(R&&!(Ue>0||I||L||z)){let e=R;R={...e,invalidationEpoch:P,surfaces:e.surfaces},Fe?.transferFrame(e,R),e.surfaces=[],e.participatingMedium=null,e.motionField=null}let i=await In({viewProjectionMatrix:e,cameraPositionM:t,reason:n},{allowCandidateRecovery:!0});return i&&Sn(R),i},clear({reason:t=`worker-owned-isosurface-presentation-clear`}={}){if(M)return!1;Ve(),xn(),Z=null,$e=null,et=null,st(!0),P+=1,q=null,N+=1,Zt(t),Me=null,Ne=null,Pe=null,An(),kn(L,t),L=null;let n=R;return R=null,n&&_(e,()=>{Ht(n,t)}),!0},getStatus(){let e=Bt(R);return Object.freeze({schema:ot,status:M?`worker-owned-isosurface-presenter-disposed`:`worker-owned-isosurface-presenter-ready`,generation:N,presentationPlaying:B,presentationPlaybackRevision:V,running:ke,activeGeneration:I?.generation??null,queuedGeneration:L?.generation??null,visibleGeneration:R?.generation??null,recoverableGeneration:z?.frame.generation??null,recoverableSphStep:z?.frame.sphStep??null,visibleSphStep:R?.sphStep??null,visibleSourceTimeS:R?.sourceTimeS??null,temporalMotionReady:!!(R?.motionField?.buffer&&R?.motionPacing),temporalMotionAgeS:R?.lastDisplayedMotionAgeS||0,temporalPresentationError:R?.temporalPresentationError||null,visibleSurfaceCount:R?.totalSurfaceCount??R?.surfaces?.length??0,visibleMarchingCubesSurfaceCount:R?.surfaces?.length??0,presentationComposition:e.presentationComposition,participatingMediumStatus:e.status,collectiveOpticalSurfaceCount:e.collectiveOpticalSurfaceCount,participatingMediumAggregateDrawCount:e.participatingMediumAggregateDrawCount,collectiveOpticalShellFallbackCount:e.collectiveOpticalShellFallbackCount,fieldRowsBufferByteLength:Ke,adapterCacheEntryCount:ht.size})},async dispose(){if(!M){Ve(),xn(),Z=null,$e=null,et=null,M=!0,st(!0),P+=1,q=null,N+=1,Zt(`worker-isosurface-recovery-dispose`),An(),jn(),kn(L,`worker-owned isosurface presenter disposed`),L=null,await Promise.all([Nn(),F?.catch?.(()=>{}),He?.catch?.(()=>{}),Be?.catch?.(()=>{})]),Ht(R,`worker-isosurface-presenter-dispose`),R=null,await nn(),Ie?.dispose?.(),Ie=null,Fe?.dispose(),Fe=null,Ge?.destroy?.(),Ge=null,Ke=0,U?.destroy?.(),U=null;try{qe?.destroy?.()}catch{}qe=null}}})}export{ht as RETAINED_GAP_STARVATION_MS,ct as ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_ENQUEUED_STATUS,ut as ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_FAILED_STATUS,pt as ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_FRAME_SCHEMA,ft as ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_GEOMETRY,lt as ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS,ot as ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_SCHEMA,dt as ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_SUPERSEDED_STATUS,st as ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_REQUEST_SCHEMA,Ht as buildWorkerOwnedIsosurfaceSurfaceUniformValues,Zt as createWorkerOwnedIsosurfacePresenter,Vt as dampedIsosurfaceShaderMotionAgeS,Kt as resolveWorkerOwnedIsosurfaceAdmission,Pt as resolveWorkerOwnedIsosurfaceProductEventSource,Lt as snapshotWorkerOwnedSurfaceMetadata,Ut as summarizeWorkerOwnedIsosurfaceOpticalPresentation,gt as threeViewProjectionToWebGpuClipMatrix};